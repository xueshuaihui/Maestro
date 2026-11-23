// AC-08 · 探测失败/超时以可读结果呈现（mock 面：诊断之失败超时）
// Then：硬超时内返回 + 「探测失败 + 具体原因」+ 状态未就绪 + 清单保留 + 不卡死不抛堆栈。
// 用卡死 CLI 触发真实 CLI_PROBE_TIMEOUT（A1-13 口径，300ms 级由适配器 timeout 控制，这里走默认 5s/10s）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, hangingAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-08';
const FACE = 'mock 面（诊断：探测失败 / 超时）';

export const cases = [{
  ac: AC,
  title: '探测失败/超时以可读结果呈现（§2.4 异常）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'timeout' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const hung = hangingAgent(path.join(root, 'bin'), 'hung');
    noteFixture(c, '卡死不响应的 CLI（sleep 8，探测默认超时 5s/10s）', hung);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    c.cmd(orch(root, ['add', '--name', 'HungCLI', '--path', hung], { env }), 'orch cli add --name HungCLI --path <hung>');
    const probed = c.cmd(orch(root, ['probe', 'hungcli'], { env, timeout: 30000 }), 'orch cli probe hungcli（卡死目标）');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list（超时后）');
    const reg = readRegistry(root);
    const f = (reg?.clis ?? []).find((x) => x.cli_id === 'hungcli');

    c.check('在硬超时内返回（<20s，未无限期卡住）', probed.durationMs < 20000, `${probed.durationMs}ms`);
    c.check('未抛异常堆栈', !/Error:|\n\s+at\s/.test(probed.stderr ?? ''), probed.stderr?.trim().slice(0, 500) || '（stderr 空）');
    c.check('用户看到「探测失败 + 具体原因」',
      probed.stdout.includes('HungCLI 探测失败：') && probed.stdout.includes('probe timed out'),
      probed.stdout.trim());
    c.eq('失败按数据返回：acp=null（不写 false 冒充不支持）', f?.acp, null);
    c.eq('状态标为 unreachable（用户可见「未就绪」）', f?.connection_status, 'unreachable');
    c.check('清单保留该项（不静默丢弃）', listed.stdout.includes('HungCLI') && listed.stdout.includes('未就绪'),
      listed.stdout.split('\n').filter((l) => l.includes('HungCLI')).join(' / '));
    c.check('探测失败不伪造 ACP 支持', !listed.stdout.includes('HungCLI 探测完成：ACP 支持'),
      listed.stdout.split('\n').filter((l) => l.includes('HungCLI')).join(' / '));

    c.mid = { hungScript: hung, probeStdout: probed.stdout, probeStderr: probed.stderr,
      probeDurationMs: probed.durationMs, finding: f, listStdout: listed.stdout };
    c.note('probeVersion 默认 5s、probeAcp 默认 10s 硬超时，二者并行；超时 kill 子进程并返回 {ok:false,code:CLI_PROBE_TIMEOUT}，不抛异常。');
    return finish(c);
  }
}];
