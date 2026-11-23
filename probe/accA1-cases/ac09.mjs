// AC-09 · CLI 能力矩阵横向对比（mock 面：矩阵）
// Then：五维齐全（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子）；已探测显示真实结论、
// 未探测显示「未探测」；矩阵与清单探测结果一致、无反向冲突。缺任一维判不通过。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, speakingAgent, versionAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-09';
const FACE = 'mock 面（矩阵 / 五维数据）';
const DIMS = ['ACP', 'stdio·transport', '会话恢复方言', '并发上限', '证据钩子'];

export const cases = [{
  ac: AC,
  title: 'CLI 能力矩阵横向对比（规划子项：CLI 能力矩阵）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'matrix' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const speaking = speakingAgent(path.join(root, 'bin'), 'codex-mock', 'codex 1.2.3');
    const stub = versionAgent(path.join(root, 'bin'), 'stub', 'stub 0.1');
    noteFixture(c, '两个 CLI：MockCLI 已探测、StubCLI 未探测', `${speaking} / ${stub}`);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    c.cmd(orch(root, ['add', '--name', 'MockCLI', '--path', speaking], { env }), 'add MockCLI');
    c.cmd(orch(root, ['add', '--name', 'StubCLI', '--path', stub], { env }), 'add StubCLI');
    c.cmd(orch(root, ['scan'], { env }), 'orch cli scan');
    const probed = c.cmd(orch(root, ['probe', 'mockcli'], { env }), 'orch cli probe mockcli（仅探测一个）');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list（矩阵）');
    const reg = readRegistry(root);
    const mockF = (reg?.clis ?? []).find((x) => x.cli_id === 'mockcli');
    const stubF = (reg?.clis ?? []).find((x) => x.cli_id === 'stubcli');
    const t = listed.stdout;

    c.eq('probe 退出码为 0', probed.exitCode, 0);
    const header = DIMS.join('  |  ');
    c.check('矩阵恰好包含五类维度（逐字表头）', t.includes(header), t.split('\n').filter((l) => l.includes('ACP')).join(' / '));
    for (const d of DIMS) c.includes(`矩阵含维度「${d}」`, t, d);
    c.check('已探测 CLI 行显示真实结论：ACP=支持', /MockCLI:\s*\n支持\s*\|/.test(t),
      t.split('\n').filter((l) => /MockCLI|支持|未探测/.test(l)).slice(0, 4).join(' / '));
    c.check('已探测 CLI 未探出的维度显示「未探测」而非臆造',
      /MockCLI:\s*\n支持\s*\|\s*未探测\s*\|\s*未探测\s*\|\s*未探测\s*\|\s*未探测/.test(t),
      t.split('\n').filter((l) => l.includes('未探测')).slice(0, 3).join(' / '));
    c.check('未探测 CLI 五维均为「未探测」而非空白或「不支持」',
      /StubCLI:\s*\n未探测\s*\|\s*未探测\s*\|\s*未探测\s*\|\s*未探测\s*\|\s*未探测/.test(t),
      t.split('\n').filter((l) => l.includes('StubCLI') || l.trim().startsWith('未探测')).join(' / '));
    c.eq('矩阵数据源与清单一致：已探测项 acp=true', mockF?.acp, true);
    c.eq('矩阵数据源与清单一致：未探测项 acp=null', stubF?.acp, null);
    c.check('无「清单不支持而矩阵支持」的反向冲突',
      mockF?.acp === true && stubF?.acp !== true && t.includes('支持') && !/StubCLI:\s*\n支持/.test(t),
      `mock.acp=${mockF?.acp} stub.acp=${stubF?.acp}`);

    c.mid = { dimensions: DIMS, mockFinding: mockF, stubFinding: stubF, matrixStdout: t };
    c.note('证据钩子维度当前无实现支撑（D-1 差距），按规划列示并显示「未探测」，不删维、不臆造；矩阵视图细节由 C1 交付，A1 判数据可支撑横向对比。');
    return finish(c);
  }
}];
