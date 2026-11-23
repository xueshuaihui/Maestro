// AC-07 · 能力探测握手成功并展示能力（mock 面：能力探测之握手）
// Then：看到「探测完成：ACP 支持」+ 会话能力（会话恢复/关闭/列表）+ 状态已连接 + 最近探测时间刷新。
// 用 test/wp16 手法生成 speaking-NDJSON 模拟 agent（P-5），经 add 登记后显式 probe。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, speakingAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-07';
const FACE = 'mock 面（能力探测：ACP 握手）';

export const cases = [{
  ac: AC,
  title: '能力探测握手成功并展示能力（规划子项：能力探测）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'probe' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const mock = speakingAgent(path.join(root, 'bin'), 'codex-mock', 'codex 1.2.3');
    noteFixture(c, 'speaking-NDJSON 模拟 agent（initialize 应答 close/list/resume）', mock);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    const added = c.cmd(orch(root, ['add', '--name', 'MockCLI', '--path', mock], { env }), 'orch cli add --name MockCLI --path <mock>');
    const before = readRegistry(root);
    const bf = (before?.clis ?? []).find((x) => x.cli_id === 'mockcli');
    c.snap('before-probe', { finding: bf });
    const probed = c.cmd(orch(root, ['probe', 'mockcli'], { env }), 'orch cli probe mockcli（ACP 握手）');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list（探测后）');
    const after = readRegistry(root);
    const af = (after?.clis ?? []).find((x) => x.cli_id === 'mockcli');

    c.eq('add 退出码为 0', added.exitCode, 0);
    c.eq('probe 退出码为 0', probed.exitCode, 0);
    c.check('用户看到「探测完成：ACP 支持」结论',
      probed.stdout.includes('MockCLI 探测完成：ACP 支持'), probed.stdout.trim());
    c.eq('acp=true（握手成功）', af?.acp, true);
    c.check('能看到声明的会话能力 close/list/resume',
      ['close', 'list', 'resume'].every((k) => (af?.capabilities ?? []).includes(k)),
      JSON.stringify(af?.capabilities));
    c.eq('状态更新为 connected（用户可见「已连接」）', af?.connection_status, 'connected');
    c.check('最近探测时间被刷新（探测前 null → 探测后非空）',
      bf?.verified_at === null && Boolean(af?.verified_at),
      `${JSON.stringify(bf?.verified_at)} → ${JSON.stringify(af?.verified_at)}`);
    c.check('清单状态列显示「已连接」', listed.stdout.includes('MockCLI') && listed.stdout.includes('已连接'),
      listed.stdout.split('\n').filter((l) => l.includes('MockCLI')).join(' / '));
    c.eq('未探出的维度不臆造：transport=null', af?.transport, null);
    c.eq('未探出的维度不臆造：resume_dialect=null', af?.resume_dialect, null);
    c.eq('未探出的维度不臆造：evidence_hook=null', af?.evidence_hook, null);

    c.mid = { mockScript: mock, beforeFinding: bf, probeStdout: probed.stdout,
      afterFinding: af, listStdout: listed.stdout };
    c.note('握手只发 initialize，不创建真实任务会话（§2.4 / D-3）；会话能力取自 initialize 响应的 sessionCapabilities。');
    return finish(c);
  }
}];
