// AC-44 任务目录不可写 / 工作区建不出来 → 发起前停住，退出码 3。
//
// 两个分支各起全新根：
//  A）--cwd ./no-such-dir → CWD_NOT_WRITABLE（绝对路径，只断言前后缀）
//  B）MAESTRO_FAULT=workspace_init:fail → 必须先确认根下没有正在运行的核心
//     （该故障只在核心冷启动读一次，src/core/orchestrator.js:253-259）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, orch, baseEnv, text, lines, nonEmptyLines, instanceIds, exists,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-44';
const TASK = '写发布说明。产物：release-notes.md';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '任务目录不可写 / 工作区建不出来 → 发起前停住',
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const rootA = freshRoot(`${AC}-a`);
    const rootB = freshRoot(`${AC}-b`);
    c.add(rootA); c.add(rootB);

    try {
      // ---------------------------------------------------------------- 分支 A
      const a = c.cmd(
        orch(rootA, ['run', '--template', 'task-loop', '--cwd', './no-such-dir', '--task', TASK]),
        `orch run --template task-loop --cwd ./no-such-dir --task "${TASK}"`
      );
      const at = text(a);
      const al = nonEmptyLines(at);
      c.eq('Then 退出码 3', a.exitCode, 3);
      c.eq('Then 输出单行', al.length, 1);
      c.check('Then 那一行以「工作目录不可写：」开头', String(al[0]).startsWith('工作目录不可写：'), al[0]);
      c.check('Then 那一行以「no-such-dir」结尾（冒号后是绝对路径）',
        String(al[0]).endsWith('no-such-dir') && /^工作目录不可写：[A-Za-z]:[\\/]/.test(String(al[0])), al[0]);
      const instA = path.join(rootA, '.orch', 'instances');
      const emptyA = !exists(instA) || fs.readdirSync(instA).length === 0;
      c.check('And 机检：.orch/instances 不存在或为空目录', emptyA,
        exists(instA) ? `存在，${fs.readdirSync(instA).length} 项` : '不存在');
      c.check('And 机检：.orch/instances/INST-001 不存在', !exists(path.join(instA, 'INST-001')), path.join(instA, 'INST-001'));

      // ---------------------------------------------------------------- 分支 B
      fs.mkdirSync(path.join(rootB, 'demo-doc'), { recursive: true });
      const pre = c.cmd(coreStop(rootB), 'orch core stop（根 B 冷启动前置：确认没有正在运行的核心）');
      c.includes('Given 前置：根 B 下没有正在运行的核心', text(pre), '核心未在运行');

      const b = c.cmd(
        orch(rootB, ['run', '--template', 'task-loop', '--cwd', './demo-doc', '--task', TASK],
          { env: baseEnv({ MAESTRO_FAULT: 'workspace_init:fail' }) }),
        `MAESTRO_FAULT=workspace_init:fail orch run --template task-loop --cwd ./demo-doc --task "${TASK}"`
      );
      const bt = text(b);
      c.includes('Then 输出含「无法创建工作区：注入故障（workspace_init:fail）」',
        lines(bt).find((l) => l.includes('无法创建工作区：注入故障（workspace_init:fail）')) ?? '（未出现）', '无法创建工作区：注入故障（workspace_init:fail）');
      c.eq('Then 退出码 3', b.exitCode, 3);

      const instB = path.join(rootB, '.orch', 'instances');
      const emptyB = !exists(instB) || fs.readdirSync(instB).length === 0;
      c.check('And 机检：.orch/instances 为空（本次新建的 INST-001 已删除）', emptyB,
        exists(instB) ? `存在，${fs.readdirSync(instB).length} 项` : '不存在');
      c.check('And 机检：没有 INST-001 目录', !exists(path.join(instB, 'INST-001')), path.join(instB, 'INST-001'));
      c.check('And 机检：不留 workspace/ 空壳', !exists(path.join(instB, 'INST-001', 'workspace')), path.join(instB, 'INST-001', 'workspace'));
      c.check('And 机检：没有写 state.json', !exists(path.join(instB, 'INST-001', 'state.json')), path.join(instB, 'INST-001', 'state.json'));
      const prompts = path.join(rootB, '.mock', 'prompts');
      const noPrompts = !exists(prompts) || fs.readdirSync(prompts).length === 0;
      c.check('And 机检：.mock/prompts 不存在或为空（没有发起任何会话）', noPrompts,
        exists(prompts) ? `${fs.readdirSync(prompts).length} 项` : '不存在');
      c.eq('And 机检：根 B 实例列表为空', instanceIds(rootB).join(',') || '（空）', '（空）');
      c.note('分支 B 的 MAESTRO_FAULT 只在核心冷启动时读一次：根 B 为全新根，core stop 明确回「核心未在运行」'
        + '（无热核心），因此注入必然生效；跑前没有旧核心残留。');
    } finally {
      for (const r of [rootA, rootB]) {
        c.cmd(coreStop(r), 'orch core stop');
        await forceKillCore(r);
      }
    }
    return finish(c);
  }
}];
