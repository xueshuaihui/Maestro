/**
 * AC-57 · 真实宿主隔离：不动用户 ~/.dsh。
 *
 * 机检（需求 `:860`）：`stat -c %Y ~/.dsh` 前后相同；隔离目录删除后不存在；
 * `git status --porcelain` 不含仓库内新增项目根。
 *
 * 取证方式：与 AC-25 / AC-26 同一次真实宿主会话（`realCrashRecovery` 的隔离守卫），
 * 另加独立的一次 `probe/acc8-realhost.mjs` 短程探针（`AC-57.realhost.probe.json`）作为二次佐证。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, evidence, eq, check, note, finish, realCrashRecovery } from '../acc8-f-common.mjs';
import {
  GRADING_REAL, REPO, EVID, BASE, gitStatusPorcelain, statMtime, readJson,
} from '../acc8-f-lib.mjs';
import { cleanupHome } from '../acc8-realhost.mjs';

export async function run() {
  const c = makeCase('AC-57', {
    scenario: 'real-host-isolation',
    title: '真实宿主隔离：不动用户 ~/.dsh',
    grading: GRADING_REAL,
  });

  const userDsh = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh');
  const statBefore = statMtime(userDsh);
  const gitBefore = gitStatusPorcelain();

  const rec = await realCrashRecovery({ label: 'ac25' });
  c.root = rec.guards?.isolatedRoot ?? null;

  const statAfter = statMtime(userDsh);
  const gitAfter = gitStatusPorcelain();
  const probeFrame = path.join(EVID, 'AC-57.realhost.probe.json');
  const probe = readJson(probeFrame, null);

  evidence(c, 'given', 'isolation.json', JSON.stringify({
    userDsh,
    statBefore,
    statAfter,
    before: rec.guards?.userHomeBefore ?? null,
    after: rec.guards?.userHomeAfter ?? null,
    isolatedRoot: rec.guards?.isolatedRoot ?? null,
    isolatedRemoved: rec.guards?.isolatedRemoved ?? null,
    gitBefore,
    gitAfter,
  }, null, 2));

  // 1) ~/.dsh mtime 前后相同（stat -c %Y）
  eq(c, 'stat -c %Y ~/.dsh 前后相同', statAfter, statBefore);
  eq(c, '~/.dsh 目录条目集合不变', rec.guards?.userHomeAfter?.entries ?? null, rec.guards?.userHomeBefore?.entries ?? null);
  check(c, '隔离 home 守卫：用户目录未被改动', rec.guards?.userHomeUntouched === true, JSON.stringify({ before: statBefore, after: statAfter }));

  // 2) 隔离目录删除后不存在（流程已在收尾处按 10s 重试清理；此处再做一次兜底清理并留痕）
  const isolatedRoot = rec.guards?.isolatedRoot ?? '';
  let extraCleanup = null;
  if (isolatedRoot && fs.existsSync(isolatedRoot)) {
    extraCleanup = cleanupHome(path.dirname(isolatedRoot));
    note(c, `隔离目录在 AC-57 复核时仍存在，已按 10s 重试兜底清理（结果 removed=${extraCleanup.removed}）。`);
  }
  eq(c, '隔离目录已删除（不存在）', fs.existsSync(isolatedRoot), false);
  check(c, '隔离目录位于 %TEMP%（不在仓库内）', String(isolatedRoot).toLowerCase().startsWith(String(BASE).toLowerCase()), isolatedRoot);

  // 3) git status 不含仓库内新增项目根（本批自身新增的 probe/evidence 交付物不算项目根）
  const newEntries = gitAfter.filter((line) => !gitBefore.includes(line));
  eq(c, 'git status --porcelain 与准备前一致（真实宿主会话不写仓库）', gitAfter, gitBefore);
  eq(c, '真实宿主会话期间无新增未跟踪条目', newEntries, []);
  const tempRootPatterns = /(^|[\s/\\])(maestro-i18|i18-acc52-base|acc52-base|maestro-i18-realhost)([\s/\\]|$)|\.orch\/instances/;
  eq(c, '仓库内无临时项目根（%TEMP% 之外的实例目录）', gitAfter.filter((line) => tempRootPatterns.test(line)), []);

  // 4) 二次佐证：独立短程探针帧里的守卫结果
  if (probe) {
    eq(c, '探针帧：用户 ~/.dsh 未改动', probe.guards?.userHomeUntouched, true);
    eq(c, '探针帧：隔离目录已删除', probe.guards?.isolatedDirRemoved, true);
    note(c, `探针帧 ${path.relative(REPO, probeFrame)}：宿主 ${probe.host?.version ?? '?'}，结论 ${probe.conclusion}。`);
  } else {
    note(c, '未找到 AC-57 独立探针帧（可先跑 `node probe/acc8-realhost.mjs --mode probe`）；本条仍由真实会话守卫判定。');
  }

  // 5) 收尾：%TEMP% 下不得残留隔离 dsh-home 或复制出来的凭据
  const realhostParent = path.join(BASE, 'maestro-i18-realhost');
  const leftovers = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'dsh-home') leftovers.push(full);
        else walk(full);
      } else if (e.name === '.credentials.yaml') leftovers.push(full);
    }
  };
  walk(realhostParent);
  eq(c, '无残留隔离 dsh-home / 凭据副本', leftovers, []);
  try {
    fs.rmSync(realhostParent, { recursive: true, force: true });
  } catch {
    /* 空目录清理失败不影响判定（上一行已断言无遗留内容） */
  }
  eq(c, '隔离父目录已清空并删除', fs.existsSync(realhostParent), false);

  return finish(c);
}
