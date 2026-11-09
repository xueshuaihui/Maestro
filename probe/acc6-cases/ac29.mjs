// AC-29 超时与重试：取值合法可用，越界被拒（混合：用户可见 + 机检）
// Given：timeout-ok.yaml（timeout: 600、retry: 2）与 timeout-bad.yaml（timeout: 0、retry: 9）。
// 裁-13：scoped `workflow validate <id>` 计数只含目标（校验工作流 1 个）。
import {
  makeCase, freshRoot, workflowValidate, workflowDryRun, jsonOf, writeWorkflow,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-29';
const OK_YAML = [
  'schema: workflow/v1',
  'id: timeout-ok',
  'name: 超时合法',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 开发',
  '    timeout: 600',
  '    retry: 2',
  ''
].join('\n');
const BAD_YAML = [
  'schema: workflow/v1',
  'id: timeout-bad',
  'name: 超时越界',
  'entry: T-001',
  'terminal: T-002',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 开发',
  '    timeout: 0',
  '  - id: T-002',
  '    node_type: role',
  '    role: tester',
  '    title: 测试',
  '    retry: 9',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  ''
].join('\n');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);
    writeWorkflow(root, 'timeout-ok', OK_YAML);
    writeWorkflow(root, 'timeout-bad', BAD_YAML);
    c.noteFixture('预置 timeout-ok.yaml（timeout 600 / retry 2）与 timeout-bad.yaml（timeout 0 / retry 9）', '');

    // When：orch workflow validate timeout-ok（scoped）
    const ok = c.cmd(workflowValidate(root, ['timeout-ok']), 'orch workflow validate timeout-ok');
    const okRows = nonEmptyLines(clean(text(ok)));
    c.evText('validate-ok', text(ok));
    c.eq('Then 第一个退出 0', ok.exitCode, 0);
    c.lineEq('Then 校验工作流 1 个：全部通过', okRows[0], '校验工作流 1 个：全部通过');

    // When：orch workflow validate timeout-bad（scoped）
    const bad = c.cmd(workflowValidate(root, ['timeout-bad']), 'orch workflow validate timeout-bad');
    const badRows = nonEmptyLines(clean(text(bad)));
    c.evText('validate-bad', text(bad));
    c.eq('Then 第二个退出 1', bad.exitCode, 1);
    c.includes('Then 报 WORKFLOW_TIMEOUT_INVALID', text(bad), '（WORKFLOW_TIMEOUT_INVALID）');
    c.includes('Then 报 WORKFLOW_RETRY_INVALID', text(bad), '（WORKFLOW_RETRY_INVALID）');

    // When：对合法的那个 dry-run
    const dry = c.cmd(workflowDryRun(root, 'timeout-ok'), 'orch workflow dry-run timeout-ok');
    c.evText('dry-run', text(dry));
    c.includes('Then 预演输出策略行', clean(text(dry)), '- T-001 超时 600s · 重试 2');

    // 机检：预演 JSON 的 policies；合法范围由越界明细佐证
    const json = c.cmd(workflowDryRun(root, 'timeout-ok', ['--format', 'json']), 'orch workflow dry-run timeout-ok --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.deepEq('机检：policies 含 {nodeId, timeout:600, retry:2}', payload?.policies, [{ nodeId: 'T-001', timeout: 600, retry: 2 }]);
    const keySets = (payload?.policies ?? []).map((p) => Object.keys(p).sort().join(','));
    c.eq('机检：policies[] 恰 nodeId/timeout/retry 三键', [...new Set(keySets)].join('|'), 'nodeId,retry,timeout');
    c.includes('机检：timeout 合法范围 1~86400', text(bad), '合法范围：1~86400 的整数');
    c.includes('机检：retry 合法范围 0~5', text(bad), '合法范围：0~5 的整数');

    return finish(c);
  }
}];
