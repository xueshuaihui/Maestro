// AC-55 旧格式实例只读可查（回归 / mock 夹具面）
import {
  makeCase, freshRoot, installLegacyV1, statusText, instanceStatus,
  instanceLog, instanceGraph, graphJson, readState, sha256File, statePath,
  text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-55';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：一个 I1.1 的 v1 单对象实例
    installLegacyV1(root, 'OLD-001');
    const stateFile = statePath(root, 'OLD-001');
    const hashBefore = sha256File(stateFile);
    const revBefore = readState(root, 'OLD-001')?.rev;
    c.eq('Given：schemaVersion === 1', readState(root, 'OLD-001')?.schemaVersion, 1);

    // When：四条查看类命令
    const st = c.cmd(statusText(root, 'OLD-001'), 'orch status --instance OLD-001');
    const is = c.cmd(instanceStatus(root, 'OLD-001'), 'orch instance status OLD-001');
    const lg = c.cmd(instanceLog(root, 'OLD-001'), 'orch instance log OLD-001');
    const g = c.cmd(instanceGraph(root, 'OLD-001', 'json'), 'orch instance graph OLD-001 --format json');
    const gj = graphJson(g);

    c.eq('Then：status --instance 退出码 0', st.exitCode, 0);
    c.eq('Then：instance status 退出码 0', is.exitCode, 0);
    c.eq('Then：instance log 退出码 0', lg.exitCode, 0);
    c.eq('Then：instance graph 退出码 0', g.exitCode, 0);
    c.includes('Then：都能读出旧字段，按单节点显示（实例行）', text(st), '实例 OLD-001 · 已完成');
    c.includes('Then：按单节点显示（节点行）', text(st), '节点 已完成');
    c.includes('Then：交接包旧字段可读', text(st), '交接包 HO-001');
    c.includes('Then：instance log 读出旧事件', text(lg), '原因 run.started');
    c.eq('机检：graph 的 template 为 single', gj?.template, 'single');
    c.check('机检：不因缺新字段报错（graph 输出含 nodes/edges/current）',
      Array.isArray(gj?.nodes) && Array.isArray(gj?.edges) && 'current' in (gj ?? {}), JSON.stringify(Object.keys(gj ?? {})));
    c.eq('机检：不写 state.json（字节不变）', sha256File(stateFile), hashBefore);
    c.eq('机检：rev 不变', readState(root, 'OLD-001')?.rev, revBefore);
    return conclude(c, root);
  },
}];
