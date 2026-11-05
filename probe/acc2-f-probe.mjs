// 诊断：mock 侧 hold（session/new 前暂停）期间核心 IPC 是否仍响应。
import { freshRoot, startKeep, orch, statusText, runProduct, TASK, seam, forceKillCore, text } from './acc2-f-common.mjs';

const root = freshRoot('probe-hold');
const h = startKeep(root, 'hold-forever');
try {
  const r = await h.waitState((s) => s.state === 'running' && (s?.nodes ?? []).some((n) => n.nodeId === 'T-001' && n.state === 'running'), 40000);
  console.log('reached T-001 running =', Boolean(r));
  await new Promise((res) => setTimeout(res, 1500));
  const probes = [
    ['orch status --instance', () => statusText(root)],
    ['orch status (list)', () => orch(root, ['status'])],
    ['orch run --instance INST-001', () => runProduct(root, { instance: 'INST-001', template: 'code-loop', task: TASK })],
    ['call-seam dispatchToNode T-001', () => seam(root, { call: 'dispatchToNode', node: 'T-001' })],
  ];
  for (const [label, fn] of probes) {
    const t = Date.now();
    const res = fn();
    console.log(`--- ${label}: exit=${res.exitCode} ${Date.now() - t}ms\n${text(res).slice(0, 320)}`);
  }
} finally {
  await h.stop();
  await forceKillCore(root);
}
