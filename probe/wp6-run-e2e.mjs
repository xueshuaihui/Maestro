// WP-6 端到端计时探针：spawn 真实 CLI，把每一行到达时刻标成相对命令启动的毫秒。
// 仅用于本次验收取证，不属于产品代码。
import { spawn } from 'node:child_process';

const [projectRoot, taskCwd, instanceId, task] = process.argv.slice(2);
const t0 = Date.now();

const child = spawn(
  process.execPath,
  ['D:/WWW/Maestro/bin/orch.js', 'run', '--cwd', taskCwd, '--instance', instanceId, '--task', task],
  { cwd: projectRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
);

let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    console.log(`${String(Date.now() - t0).padStart(6, ' ')}ms  ${line}`);
  }
});

child.stderr.on('data', (chunk) => {
  for (const line of chunk.toString('utf8').split('\n')) {
    if (line.trim()) console.log(`${String(Date.now() - t0).padStart(6, ' ')}ms  [stderr] ${line}`);
  }
});

child.on('exit', (code, signal) => {
  if (buffer.trim()) console.log(`${String(Date.now() - t0).padStart(6, ' ')}ms  ${buffer.trim()}`);
  console.log(`${String(Date.now() - t0).padStart(6, ' ')}ms  [exit] code=${code} signal=${signal}`);
});
