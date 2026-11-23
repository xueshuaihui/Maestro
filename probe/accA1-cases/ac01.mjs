// AC-01 · PATH 上的 CLI 被自动发现并罗列（mock 面：发现 + 罗列）
// Then 判据逐项照抄需求 §3.1 L167：名称 Codex CLI / 路径=夹具可执行 / 状态可用 / 来源命令搜索路径 / 无需输入路径。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, versionAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-01';
const FACE = 'mock 面（发现 + 罗列）';

export const cases = [{
  ac: AC,
  title: 'PATH 上的 CLI 被自动发现并罗列（规划子项：扫描 PATH + 罗列名称/路径/状态）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'scan' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const bin = versionAgent(path.join(root, 'bin'), 'codex', 'codex 1.2.3');
    noteFixture(c, 'PATH 专属目录放入 codex 可执行', bin);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    const before = readRegistry(root);
    c.snap('before', { registry: before });
    const scanned = c.cmd(orch(root, ['scan'], { env }), 'orch cli scan（PATH 仅含夹具 bin）');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list');
    const reg = readRegistry(root);
    const f = (reg?.clis ?? []).find((x) => x.cli_id === 'codex');

    c.eq('scan 退出码为 0', scanned.exitCode, 0);
    c.eq('清单自动出现该项：名称显示为 Codex CLI', f?.name, 'Codex CLI');
    c.eq('路径显示为刚放入的可执行文件位置', f?.executable, bin);
    c.eq('连接状态显示为「可用」（内部 idle）', f?.connection_status, 'idle');
    c.eq('not_on_path=false（在 PATH 上）', f?.not_on_path, false);
    c.check('来源标注为命令搜索路径（evidence type=path）',
      (f?.evidence ?? []).some((e) => e.type === 'path'), JSON.stringify(f?.evidence));
    c.check('清单行含名称 / 路径 / 可用 / path',
      listed.stdout.includes('codex  |  Codex CLI') && listed.stdout.includes(bin)
        && listed.stdout.includes('可用') && /\|\s*path\s*$/m.test(listed.stdout),
      listed.stdout.split('\n').filter((l) => l.includes('codex')).join(' / '));
    c.check('用户不需要输入任何路径：scan 未带 --path / --name',
      !scanned.argv.some((a) => a === '--path' || a === '--name'), scanned.argv.join(' '));

    c.mid = { beforeRegistry: before, finding: f, scanStdout: scanned.stdout, listStdout: listed.stdout };
    c.note('本机 /Applications 可能额外命中 WorkBuddy.app（unreachable），不影响 codex 行的 Then 判据；PATH/HOME 已隔离到夹具根。');
    return finish(c);
  }
}];
