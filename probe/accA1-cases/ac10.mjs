// AC-10 · 重新扫描刷新清单（mock 面：重扫）
// Then：清单 N→N+1、新 CLI 出现、扫描时间更新为本次；用户手加条目仍在（BR-08）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, versionAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-10';
const FACE = 'mock 面（重扫刷新）';

export const cases = [{
  ac: AC,
  title: '重新扫描刷新清单（规划子项：重新扫描）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'rescan' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    const codex = versionAgent(bin, 'codex', 'codex 1.2.3');
    const tool = versionAgent(root, 'mytool', 'mytool 0.1');
    noteFixture(c, '初始夹具：bin/codex + 用户手加 mytool', `${codex} / ${tool}`);
    const env = baseEnv({ PATH: bin, HOME: path.join(root, 'home') });

    c.cmd(orch(root, ['add', '--name', 'MyCLI', '--path', tool], { env }), 'orch cli add MyCLI');
    const first = c.cmd(orch(root, ['scan'], { env }), 'orch cli scan（第一次，记 N）');
    const reg1 = readRegistry(root);
    const n1 = reg1?.clis?.length ?? 0;
    const at1 = reg1?.scanned_at;
    c.snap('first-scan', { count: n1, scannedAt: at1, cliIds: (reg1?.clis ?? []).map((x) => x.cli_id) });

    const gemini = versionAgent(bin, 'gemini', 'gemini 2.0');
    noteFixture(c, '重扫前在命令搜索路径新放 gemini', gemini);
    const second = c.cmd(orch(root, ['scan'], { env }), 'orch cli scan（重新扫描）');
    const reg2 = readRegistry(root);
    const n2 = reg2?.clis?.length ?? 0;
    const at2 = reg2?.scanned_at;
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list（重扫后）');
    const geminiF = (reg2?.clis ?? []).find((x) => x.cli_id === 'gemini');
    const mycliF = (reg2?.clis ?? []).find((x) => x.cli_id === 'mycli');

    c.eq('第一次 scan 退出码 0', first.exitCode, 0);
    c.eq('第二次 scan 退出码 0', second.exitCode, 0);
    c.eq('清单项数 N→N+1', n2, n1 + 1);
    c.check('新 CLI 出现（gemini，来源 path）',
      geminiF?.executable === gemini && (geminiF?.evidence ?? []).some((e) => e.type === 'path'),
      JSON.stringify(geminiF ?? null));
    c.check('扫描时间更新为本次（scanned_at 变化）', at2 !== at1 && Boolean(at2),
      `${JSON.stringify(at1)} → ${JSON.stringify(at2)}`);
    c.check('用户手加条目仍在（BR-08：cli_id=mycli，path 不变）',
      mycliF?.cli_id === 'mycli' && mycliF?.executable === tool, JSON.stringify(mycliF ?? null));
    c.check('清单可见新 CLI 与手加 CLI',
      listed.stdout.includes('Gemini CLI') && listed.stdout.includes('MyCLI'),
      listed.stdout.split('\n').filter((l) => /Gemini|MyCLI/.test(l)).join(' / '));
    c.snap('second-scan', { count: n2, scannedAt: at2, cliIds: (reg2?.clis ?? []).map((x) => x.cli_id) });

    c.mid = { first: { count: n1, scannedAt: at1 }, second: { count: n2, scannedAt: at2 },
      geminiFinding: geminiF, userConfigFinding: mycliF, listStdout: listed.stdout };
    c.note('重扫覆盖写唯一缓存 .orch/cli-registry.json；自动发现部分刷新，user_config 段合并保留，不触碰 .orch 下其他文件。');
    return finish(c);
  }
}];
