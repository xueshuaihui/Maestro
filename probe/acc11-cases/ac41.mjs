// AC-41 无回归：既有 CLI、既有接口与全量测试。机检 regression.test.js（三主链 A-0 归一化逐字 diff 0
// + 既有 8 条 HTTP 路径响应键集合 + USAGE_LINES=25 + 31 词双扫 + shapeSnapshot 未改 +
// 全量条数下限 + 失败集合差集 0 的结构断言）；全量真实跑由案外门禁命令执行（>90s，超单 AC 限时），
// 结果摘要落 /tmp/m11d-ac41-full-summary.json，本用例读取并断言（同 regression.test.js 自身读摘要口径）。
// 架构检查：git diff --name-only 66e5a6b -- test/ 人工核对——只允许 wp14 路径 + D-51 授权的 4 个
// wp13 文案契约文件（147→249 键更新），其余路径即判失败。D-21：禁 fail===0，判据是差集 0 + 条数下限。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir, exists } from '../acc11-f-common.mjs';
import fs from 'node:fs';
const AC = 'AC-41';
const SUMMARY = '/tmp/m11d-ac41-full-summary.json';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '回归 / 全量 / 机检',
  async run() {
    const c = makeCase(AC, { face: '回归 / 全量 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['regression.test.js'],
      arch: [
        { cmd: 'git diff --name-only 66e5a6b -- test/', expect: null,
          note: 'AC-41 架构（人工核对留证）：既有测试文件不得修改，只允许 test/wp14/ + D-51 授权的 4 个 wp13 文案契约文件' }
      ],
      tmpdir: tmp
    });
    const r = c.testRuns.find((t) => t.file === 'regression.test.js');
    c.check('三主链 single/code-loop/task-loop 的 A-0 归一化输出逐字不变（WP-11 已 6/6 diff 0）',
      Boolean(r?.subtests?.some((x) => /三主链：A-0 归一化后逐字命中/.test(x)) && r?.v?.ok),
      (r?.subtests ?? []).filter((x) => /三主链/.test(x)).join(' | ') || '（未找到）',
      'escalate list|resolve、approve、role|skill|workflow list|show|validate、status、instance status|graph 两种格式逐字');
    c.check('既有 8 条 HTTP 路径响应键集合不变、USAGE_LINES 仍 25 行、dependencies=0',
      Boolean(r?.subtests?.some((x) => /既有 8 条 HTTP 路径/.test(x)) &&
               r?.subtests?.some((x) => /USAGE_LINES 仍 25 行/.test(x)) && r?.v?.ok),
      `# pass regression ${r?.tap?.pass ?? 0} / # fail ${r?.tap?.fail ?? 0}`,
      '既有路由响应键集合相等；USAGE_LINES.length===25；dependencies=0');
    c.check('shapeSnapshot 函数体逐字未改（D-36/D-53 函数体锚点，行号不被当作判据）',
      Boolean(r?.subtests?.some((x) => /shapeSnapshot 函数体逐字未改/.test(x)) && r?.v?.ok),
      (r?.subtests ?? []).filter((x) => /shapeSnapshot/.test(x)).join(' | ') || '（未找到）',
      'shapeSnapshot 未为凑「一处」而改；escalations.filter/reduce 恰 1 条基线');

    // 全量门禁（案外真实跑结果）。tests >= 1425 下限（不写死），失败集合与判定基线差集 0（D-21 禁 fail===0）。
    const summary = exists(SUMMARY) ? JSON.parse(fs.readFileSync(SUMMARY, 'utf8')) : null;
    c.snap('full-suite-summary', summary);
    c.check('全量测试真实跑完成并落摘要（tests/pass/fail/skipped + failed 名单 + diffFromBaseline）',
      Boolean(summary && Number.isFinite(summary.tests)),
      summary ? `tests ${summary.tests} / pass ${summary.pass} / fail ${summary.fail} / skipped ${summary.skipped} / diff ${summary.diffFromBaseline}` : `摘要缺失：${SUMMARY}`,
      'env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js" 的完整 TAP 摘要');
    c.check('全量条数只增不减：tests >= 1425（下限，不写死）',
      Boolean(summary && summary.tests >= 1425),
      `tests=${summary?.tests ?? '-'}`,
      'tests >= 1425');
    c.check('失败集合与判定基线（历史 8 条 + R-08 的 AC-04）差集 0（D-21 禁 fail===0）',
      Boolean(summary && summary.diffFromBaseline === 0),
      `diffFromBaseline=${summary?.diffFromBaseline ?? '-'}；failed=${(summary?.failed ?? []).join(' | ')}`,
      'diffFromBaseline === 0；S2 新增用例自身 fail 0；不写「全局零失败」');

    thenChecks(c);
    // 语义复核：test/ 的 diff 人工核对——只允许 wp14 + D-51 授权的 4 个 wp13 文案契约文件；
    // 且这些 wp13 删除行只涉及 147→249 键数更新，不放宽任何既有断言。
    const files = runCmd('git diff --name-only 66e5a6b -- test/', { tmpdir: tmp });
    c.cmd(files, '语义复核：test/ 相对基线 66e5a6b 的改动文件清单');
    const changed = files.stdout.trim().split('\n').filter(Boolean);
    const other = changed.filter((f) => !f.startsWith('test/wp14/'));
    const allow13 = new Set(['test/wp13/errors.test.js', 'test/wp13/graph-collapse.test.js', 'test/wp13/http-channel.test.js', 'test/wp13/labels-desktop.test.js']);
    const bad = other.filter((f) => !allow13.has(f));
    const removed = runCmd(`git diff 66e5a6b -- ${[...allow13].join(' ')} | grep '^-' | grep -v '^---'`, { tmpdir: tmp });
    c.cmd(removed, '语义复核：4 个 wp13 文案契约文件的删除行（应只含 147 键数/期望清单更新）');
    const badRemoved = removed.stdout.trim().split('\n').filter((l) => l && !/147|EXPECTED|names|frozen|期望清单|INSTANCE_LABEL_|NODE_LABEL_|HANDOFF_LABEL_|ROLE_INSTANCE_STATUS_LABEL_/.test(l));
    c.check('语义复核：test/ 改动仅限 wp14 + D-51 授权的 4 个 wp13 文案契约文件，且删除行只涉及 147→249 键数更新（未放宽既有断言）',
      bad.length === 0 && badRemoved.length === 0,
      `非 wp14 文件 ${other.length} 个=${other.join(',')}；意外文件 ${bad.length}；非键数删除行 ${badRemoved.length}`,
      '只允许 test/wp14/** 与 D-51 授权的 4 个 wp13 文件；删除行只含 147 键契约更新');
    c.note('全量门禁口径：因单 AC 限时 90s、全量测试真实耗时超过限时，按 regression.test.js 自身「读摘要不递归跑全量」的口径，由案外门禁命令先跑完整 TAP 并生成 /tmp/m11d-ac41-full-summary.json（含 tests/pass/fail/skipped/failed/diffFromBaseline），本用例读取并断言下限 + 差集 0，不改任何判定。原始 TAP 见证据 full-suite-summary 快照。');
    c.note('机检文件名口径：需求点名 test/wp14/regression.test.js（本分支存在），全量命令由案外门禁承担（>90s），判定复用仓库既有 scripts/desktop/gate.mjs 口径（TAP 解析 + 基线差集 + 条数下限 + 文件级 flake 确认），不另写「零失败」。FAIL 集合基线为历史 8 条 + R-08 AC-04（共 9 条）。');
    c.note('架构人工核对：4 个 test/wp13 改动均为 D-51 授权的 147→249 文案键数冻结更新（含 labels-desktop.test.js 按 I1.9 D-27 先例精确断言改期望不过滤），非放宽既有断言；其余改文件只在 test/wp14/。如出现第 5 个非授权路径或删除行含非键数更新即判失败。');
    return finish(c);
  }
}];
