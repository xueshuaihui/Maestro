// AC-14 · 规划验收句①的 mock 可复现面：自动发现 + 四项信息准确
// Then：清单自动列出 Codex CLI，名称/路径/版本/状态四项与夹具实际值一致，用户无需输入任何配置。
// 证据级别严格标「mock 实测」；与 AC-12「待本机实测」分开，不冒充真实宿主达标（附录 A-7 / AD-08）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, speakingAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-14';
const FACE = 'mock 面（验收句支撑：AC-01+02+07 串联）';

export const cases = [{
  ac: AC,
  title: '规划验收句①的 mock 可复现面：自动发现 + 四项信息准确',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'flow' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    // 夹具自带版本 + ACP 应答；走 PATH 发现（非 add），证明「用户无需输入任何配置」
    const codex = speakingAgent(bin, 'codex', 'codex 1.2.3');
    noteFixture(c, '夹具「装了至少一种 Agent CLI」：PATH 专属目录 codex（版本 + ACP）', codex);
    const env = baseEnv({ PATH: bin, HOME: path.join(root, 'home') });

    const scan = c.cmd(orch(root, ['scan'], { env }), 'orch cli scan（PATH 专属夹具，无参数）');
    const before = readRegistry(root);
    const bf = (before?.clis ?? []).find((x) => x.cli_id === 'codex');
    const probe = c.cmd(orch(root, ['probe', 'codex'], { env }), 'orch cli probe codex（显式连接测试）');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list');
    const after = readRegistry(root);
    const f = (after?.clis ?? []).find((x) => x.cli_id === 'codex');

    c.eq('scan 退出码 0', scan.exitCode, 0);
    c.eq('probe 退出码 0', probe.exitCode, 0);
    c.eq('①名称：清单自动列出 Codex CLI（与夹具一致）', f?.name, 'Codex CLI');
    c.eq('②路径：=夹具可执行位置', f?.executable, codex);
    c.eq('③版本：=夹具自报版本 codex 1.2.3', f?.version, 'codex 1.2.3');
    c.eq('④状态：探测后为已连接（connected）', f?.connection_status, 'connected');
    c.eq('发现阶段不探测：探测前状态 idle', bf?.connection_status, 'idle');
    c.check('清单四项同时可见',
      listed.stdout.includes('codex  |  Codex CLI  |  codex 1.2.3  |  已连接') && listed.stdout.includes(codex),
      listed.stdout.split('\n').filter((l) => l.includes('codex')).join(' / '));
    c.check('用户无需输入任何配置：scan/probe 未带 --name/--path',
      ![...scan.argv, ...probe.argv].some((a) => a === '--name' || a === '--path'),
      `${scan.argv.join(' ')} ｜ ${probe.argv.join(' ')}`);
    c.eq('证据分级严格为 mock 实测（不冒充 AC-12 真实宿主）', c.evidenceLevel, 'mock 实测');

    c.mid = { fixtureExecutable: codex, beforeFinding: bf, probeStdout: probe.stdout,
      afterFinding: f, listStdout: listed.stdout };
    c.note('本 AC 为 AC-12 规划验收句①的 mock 支撑面（AC-01 + AC-02 + AC-07 三夹具串联）；证据级别 mock 实测，按附录 A-7 与 AC-12 待本机实测严格分开。');
    return finish(c);
  }
}];
