/**
 * AC-26 · 真实 DSH：重启不重复已完成节点。
 *
 * 机检（需求 `:592`）：
 *  - 服务端 `instance log` 中已完成节点无第二次 `node.dispatch`；
 *  - `workspace/artifacts/**` 下产物文件的修改时间不因恢复而变化
 *    （`workspace/status.md` 可能被刷新，不在断言范围）；
 *  - 无 DSH 时判「阻塞」。
 *
 * 取证方式：与 AC-25 同一次真实编码闭环的强杀 / 重启（`realCrashRecovery` 进程内只真跑一次）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, evidence, eq, check, block, note, finish, realCrashRecovery } from '../acc8-f-common.mjs';
import { GRADING_REAL, snapshotTree } from '../acc8-f-lib.mjs';

/** 恢复前已存在的产物文件，恢复后必须逐条 mtime + sha256 不变（status.md 与 .git 不在范围内）。 */
function diffUnchanged(before, after) {
  const afterMap = new Map(after.map((f) => [f.path, f]));
  const changed = [];
  for (const f of before) {
    if (f.path === 'status.md') continue;
    const now = afterMap.get(f.path);
    if (!now) changed.push({ path: f.path, reason: 'missing' });
    else if (now.mtimeMs !== f.mtimeMs || now.sha256 !== f.sha256 || now.size !== f.size) {
      changed.push({ path: f.path, reason: 'changed' });
    }
  }
  return changed;
}

export async function run() {
  const c = makeCase('AC-26', {
    scenario: 'real-host-no-replay',
    title: '真实 DSH：重启不重复已完成节点',
    grading: GRADING_REAL,
  });

  const rec = await realCrashRecovery({ label: 'ac25' });
  c.root = rec.home?.projectRoot ?? null;

  if (rec.error) {
    evidence(c, 'error', 'flow.txt', `${rec.error}\n${rec.run?.stderr ?? ''}`);
    note(c, `真实宿主流程失败：${rec.error}`);
    return finish(c);
  }

  const doneNodes = (rec.before?.nodes ?? []).filter((n) => n.state === 'done').map((n) => n.nodeId);
  const instRoot = path.join(c.root, '.orch', 'instances', 'INST-001');
  const artifactsDir = path.join(instRoot, 'workspace', 'artifacts');
  const afterEvents = rec.after?.recoveryEvents ?? [];
  const artifactBefore = rec.artifacts?.before ?? [];
  const artifactAfter = snapshotTree(artifactsDir);

  evidence(c, 'before', 'workspace.artifacts.json', JSON.stringify({
    artifactsDir,
    artifactsDirExists: fs.existsSync(artifactsDir),
    files: artifactBefore,
    stageFiles: rec.artifacts?.stageBefore ?? [],
    workspaceFiles: (rec.artifacts?.workspaceBefore ?? []).map((f) => f.path),
  }, null, 2));
  evidence(c, 'after', 'workspace.artifacts.json', JSON.stringify({
    files: artifactAfter,
    stageFiles: rec.artifacts?.stageAfter ?? [],
  }, null, 2));
  evidence(c, 'then', 'events.recovery.json', JSON.stringify(afterEvents, null, 2));
  evidence(c, 'then', 'recover.log', rec.logAfterRecovery || rec.restart?.stdout || '(empty)');

  // 1) 已完成节点无第二次 node.dispatch
  check(c, '强杀窗口含已完成节点', doneNodes.length >= 1, JSON.stringify(doneNodes));
  for (const id of doneNodes) {
    eq(c, `已完成节点 ${id} 无第二次 node.dispatch`, rec.after?.dispatch?.[id] ?? 0, rec.before?.dispatch?.[id] ?? 0);
    const replay = afterEvents.filter((e) => e.reason === 'node.dispatch' && (e.objectId === id || e.detail?.nodeId === id));
    eq(c, `恢复事件里没有 ${id} 的 node.dispatch`, replay.length, 0);
  }

  // 2) 产物文件 mtime / sha256 不因恢复变化（机检锚点：workspace/artifacts/**）
  //    约定：编码闭环 + I1.7 代码隔离下该目录未必存在；两种情形都如实登记，不做替代性放宽。
  eq(c, 'workspace/artifacts/** 恢复前后逐条 mtime/sha256 不变', diffUnchanged(artifactBefore, artifactAfter), []);
  if (artifactBefore.length === 0 && artifactAfter.length === 0) {
    note(c, `机检锚点空转：实例 ${instRoot} 下不存在 workspace/artifacts/**（编码闭环的产物落在 worktrees/ 与 stage/，`
      + '且 stage/ 在强杀窗口内为空）；该锚点在本场景**无法取证**，不据此宣称「产物未变」，也不用替代目录冒充通过。');
    block(c, 'AC-26 第二条机检（`workspace/artifacts/**` 产物 mtime 不因恢复变化）在本机实跑场景下不可取证：'
      + '编码闭环实例没有 `workspace/artifacts/**`（产物在 I1.7 worktree / stage 区，强杀窗口内 stage 为空）。'
      + '按 NFR-08 判「阻塞」，不用空集冒充通过、不用替代目录冒充通过；第一条机检（已完成节点无第二次 node.dispatch）已实测通过。');
  } else {
    check(c, '产物锚点非空（非空转取证）', artifactBefore.length > 0, JSON.stringify(artifactBefore.map((f) => f.path)));
  }

  // 3) 恢复摘要可见（跳过已完成节点）
  const summary = afterEvents.find((e) => e.reason === 'recovery.summary');
  check(c, 'instance log 含恢复摘要（跳过已完成节点）', Boolean(summary), JSON.stringify(summary?.detail ?? null));
  if (summary) eq(c, '恢复摘要 skipped 与已完成节点数一致', summary.detail?.skipped ?? null, doneNodes.length);

  return finish(c);
}
