// AC-37 run 等待期间出现审批行（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, prepareScene, launch, baseEnv, CODE_TASK,
  text, lines, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-37';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：orch run --approval hold 正在等待，宿主请求审批（多节点带节点/角色）
    prepareScene(root, { scenario: null, mockArgs: ['--permission=ask', '--write-ref=note.md'] });
    const h = launch(root, ['run', '--cwd', './demo', '--task', CODE_TASK, '--template', 'code-loop', '--approval', 'hold'],
      { env: baseEnv(), timeout: 30000 });
    const seen = await h.waitOutput('APR-', 25000);
    c.check('Given：等待期间审批产生（stdout 出现 APR- 行）', Boolean(seen), h.stdout.slice(0, 500));
    c.keep('orch run --template code-loop --approval hold（前台，等待审批）', h);

    const aprLine = lines(h.stdout).find((l) => l.startsWith('审批 APR-')) ?? '';
    c.includes('Then：审批行含审批号', aprLine, '审批 APR-001');
    c.includes('Then：审批行含节点号', aprLine, '节点 T-001');
    c.includes('Then：审批行含角色', aprLine, '开发');
    c.includes('Then：审批行含动作', aprLine, '动作 write');
    c.check('Then：审批行打印在会话行之后', h.stdout.indexOf('会话已创建') >= 0 && h.stdout.indexOf('审批 APR-001') > h.stdout.indexOf('会话已创建'), h.stdout.slice(0, 500));
    c.check('Then：不需要退出 run 就能看到（断言时刻 run 仍在运行）', h.exited === false, `exited=${h.exited}`);
    c.includes('机检：run 进程 stdout 含 APR-001', h.stdout, 'APR-001');
    await h.stop();
    return conclude(c, root);
  },
}];
