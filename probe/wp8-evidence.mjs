// WP-8 实测证据收集（临时脚本，仅在 probe/ 下）。
// 用法：node probe/wp8-evidence.mjs
import { setup, waitFor } from '../test/wp8/helpers.js';

const INSTANCE = 'INST-001';

async function collect(policy) {
  const switches = policy === 'allow' ? ['--permission=ask', '--write-ref', 'out/a.md'] : ['--permission=ask'];
  const env = await setup({ switches, permissionPolicy: policy });
  try {
    const started = env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md', earlyReturn: policy === 'hold' });
    if (policy === 'hold') {
      await waitFor(async () => {
        const s = await env.orch.getStatus({ instanceId: INSTANCE });
        return s.ok && s.snapshot.session?.state === 'waiting_input';
      });
      const live = await env.orch.getStatus({ instanceId: INSTANCE });
      console.log(`[F-1 ${policy}] live session=${live.snapshot.session.state} node=${live.snapshot.node.state}`);
      await env.orch.cancel({ instanceId: INSTANCE });
    } else {
      const result = await started;
      console.log(`[F-1 ${policy}] result=${JSON.stringify({ ok: result.ok, code: result.code, step: result.params?.step })}`);
    }
    const events = (await env.store.readEvents(INSTANCE)).events;
    const sessionTrail = events
      .filter((ev) => ev.object === 'session' && ev.result === 'applied')
      .map((ev) => `${ev.from}->${ev.to}(${ev.reason})`);
    console.log(`[F-1 ${policy}] session事件: ${sessionTrail.join(' | ') || '(none)'}`);
    const disk = await env.store.load(INSTANCE);
    console.log(`[F-1 ${policy}] 磁盘终态: instance=${disk.state.state} node=${disk.state.node.state} session=${disk.state.session?.state}`);
  } finally {
    await env.teardown();
  }
}

async function f3() {
  const env = await setup({ switches: ['--write-ref', 'out/a.md', '--turn-delay-ms', '700'] });
  try {
    const running = env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md' });
    await waitFor(async () => {
      const s = await env.store.load(INSTANCE);
      return s.ok && s.state.state === 'running' && s.state.session?.state === 'tool_running';
    });
    await new Promise((r) => setTimeout(r, 120));
    const loaded = await env.store.load(INSTANCE);
    loaded.state.state = 'interrupted';
    loaded.state.stateSince = new Date().toISOString();
    await env.store.save(INSTANCE, loaded.state);
    console.log('[F-3] 外部将磁盘改成 interrupted');

    const result = await running;
    console.log(`[F-3] startRun 返回: ok=${result.ok} code=${result.code}`);
    const events = (await env.store.readEvents(INSTANCE)).events;
    console.log(`[F-3] 拒绝事件: ${JSON.stringify(events.filter((ev) => ev.result === 'rejected').at(-1))}`);
    const after = await env.store.load(INSTANCE);
    console.log(`[F-3] 磁盘终态: ${after.state.state}`);
  } finally {
    await env.teardown();
  }
}

for (const policy of ['allow', 'reject', 'hold']) await collect(policy);
await f3();
