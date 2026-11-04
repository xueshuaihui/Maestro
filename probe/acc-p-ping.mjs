// 探活：ensure:false 连核心，报告 pid / 是否在跑（用于 AC-02 的 IPC 佐证）。
// 不改产品任何状态：只发 core.ping。
import path from 'node:path';
import { createClient } from '../src/daemon/client.js';

const root = path.join(process.env.TEMP, 'maestro-acc-p', 'proj');
const client = createClient({ root });
const out = { root, connected: false, pid: null, generation: null, code: null };
try {
  const conn = await client.connect({ ensure: false });
  out.connected = conn.ok === true;
  out.code = conn.code ?? null;
  if (conn.ok) {
    out.coldStart = conn.coldStart ?? null;
    out.elapsedMs = conn.elapsedMs ?? null;
    const pong = await client.ping();
    out.pid = pong.ok ? pong.result?.pid ?? null : null;
    out.generation = pong.ok ? pong.result?.generation ?? null : null;
    out.pingOk = pong.ok === true;
  }
} catch (err) {
  out.error = String(err?.message ?? err);
} finally {
  await client.close?.();
}
process.stdout.write(`${JSON.stringify(out)}\n`);
