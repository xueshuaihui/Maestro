// WP-7 夹具自测：只驱动 mock-acp-agent.js 单进程与 call-seam.mjs，
// 不启动编排核心、不跑产品代码（§4 WP-7）。
// 覆盖：promptFailures 确定性尝试计数、--host-error 早返回前写计数、
//       call-seam --help、3 个新 --call 形态可构造、参数与 server.js payload 对齐。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.resolve(HERE, '..', 'fixtures', 'mock-acp-agent.js');
const SEAM = path.resolve(HERE, '..', 'fixtures', 'call-seam.mjs');

// orchestrator.js applyHandoffMutation 冻结的 8 个 mutate 字面量。
const MUTATES = [
  'missing-to', 'missing-field', 'no-evidence', 'remove-evidence',
  'escape-ref', 'hash-mismatch', 'backflow-empty-defects', 'empty-requirements',
];

function tmpRoot(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `maestro-wp7-${tag}-`));
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function attemptsFile(root, sessionId) {
  return path.join(root, '.mock', `prompt-attempts-${sessionId}.json`);
}

function failuresFile(root, sessionId) {
  return path.join(root, '.mock', `prompt-failures-${sessionId}.json`);
}

// 短轮询 + 明确上限（不引入真实定时器长等待）。
function waitFor(predicate, { timeoutMs = 3000, intervalMs = 15 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      let value;
      try {
        value = predicate();
      } catch {
        return; // 文件写一半等瞬时状态：继续轮询
      }
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('waitFor 超时'));
      }
    }, intervalMs);
  });
}

/** 起一个 mock 单进程，收集 stdout 的 NDJSON 帧。 */
function startMock({ args, cwd }) {
  const child = spawn(process.execPath, [MOCK, ...args], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const frames = [];
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { frames.push(JSON.parse(line)); } catch { /* 忽略非 JSON 行 */ }
    }
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return {
    child,
    frames,
    send: (frame) => child.stdin.write(JSON.stringify(frame) + '\n'),
    get stderr() { return stderr; },
  };
}

function stopMock(mock) {
  try { mock.child.stdin.end(); } catch { /* ignore */ }
  try { mock.child.kill('SIGTERM'); } catch { /* ignore */ }
}

async function rpc(mock, id, method, params) {
  mock.send({ jsonrpc: '2.0', id, method, params });
  return waitFor(() => mock.frames.find((f) => f.id === id) ?? null, { timeoutMs: 3000 });
}

async function newSession(mock, root) {
  const init = await rpc(mock, 1, 'initialize', {});
  assert.ok(init.result, `initialize 应有 result：${JSON.stringify(init)}`);
  const created = await rpc(mock, 2, 'session/new', { cwd: root });
  assert.ok(created.result?.sessionId, `session/new 应返回 sessionId：${JSON.stringify(created)}`);
  // 既有 session id 形态不变（I1.1 夹具链依赖）。
  assert.match(created.result.sessionId, /^mock-sess-\d+-\d+$/);
  return created.result.sessionId;
}

function prompt(mock, id, sessionId) {
  return rpc(mock, id, 'session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: 'wp7 fixture prompt' }],
  });
}

function runSeam(args) {
  const res = spawnSync(process.execPath, [SEAM, ...args], { encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function seamJson(args) {
  const res = runSeam(args);
  assert.equal(res.status, 0, `call-seam 应 exit 0：${res.stderr}`);
  return JSON.parse(res.stdout.trim().split('\n')[0]);
}

test('promptFailures:2 -> attempts 依次 1/2/3，前 2 次 -32603 第 3 次 end_turn', async (t) => {
  const root = tmpRoot('pf2');
  const mock = startMock({ args: ['--prompt-failures=2'], cwd: root });
  t.after(() => { stopMock(mock); cleanup(root); });

  const sessionId = await newSession(mock, root);
  const outcomes = [];
  for (let n = 1; n <= 3; n += 1) {
    const res = await prompt(mock, 10 + n, sessionId);
    outcomes.push(res.error ? 'error' : res.result?.stopReason ?? null);
    // 计数文件是覆盖写（{attempts}）：逐次断言内容依次为 1 / 2 / 3。
    const value = await waitFor(() => {
      const file = attemptsFile(root, sessionId);
      if (!fs.existsSync(file)) return null;
      try {
        const parsed = readJson(file);
        return parsed.attempts === n ? parsed : null;
      } catch { return null; }
    }, { timeoutMs: 3000 });
    assert.equal(value.attempts, n, `第 ${n} 次 prompt 后 attempts 应为 ${n}`);
  }

  assert.deepEqual(outcomes[0], 'error');
  assert.deepEqual(outcomes[1], 'error');
  assert.equal(outcomes[2], 'end_turn'); // 同一会话第 3 次成功：失败不影响 session/new 与后续帧
  const failures = readJson(failuresFile(root, sessionId));
  assert.equal(failures.attempts, 2);
  assert.equal(failures.failures, 2);
});

test('--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）', async (t) => {
  const root = tmpRoot('hosterr');
  const mock = startMock({ args: ['--host-error'], cwd: root });
  t.after(() => { stopMock(mock); cleanup(root); });

  const sessionId = await newSession(mock, root);
  const res = await prompt(mock, 20, sessionId);
  assert.ok(res.error, `--host-error 应返回错误帧：${JSON.stringify(res)}`);
  assert.equal(res.error.code, -32603);

  const value = await waitFor(() => {
    const file = attemptsFile(root, sessionId);
    if (!fs.existsSync(file)) return null;
    try { return readJson(file); } catch { return null; }
  }, { timeoutMs: 3000 });
  assert.equal(value.attempts, 1, '早返回前必须已落 attempts=1');
});

test('call-seam.mjs --help 打印新用法并 exit 0', () => {
  const res = runSeam(['--help']);
  assert.equal(res.status, 0);
  for (const needle of [
    'test.handoff', 'test.delivery', 'test.delivery.whenHeld',
    '--reason-code', '--artifact-ref', '--mutate', '--action', '--dry-run',
  ]) {
    assert.ok(res.stdout.includes(needle), `--help 应含 ${needle}`);
  }
});

test('3 个新 --call 形态（test.handoff / test.delivery / test.delivery.whenHeld）dry-run 可构造', () => {
  const cases = [
    {
      args: ['--call', 'test.handoff', '--instance', 'INST-001', '--node', 'T-001', '--mutate', 'no-evidence', '--dry-run'],
      method: 'test.handoff',
      check: (p) => {
        assert.equal(p.instanceId, 'INST-001');
        assert.equal(p.nodeId, 'T-001');
        assert.equal(p.mutate, 'no-evidence');
      },
    },
    {
      args: ['--call', 'test.delivery', '--instance', 'INST-001', '--action', 'hold', '--dry-run'],
      method: 'test.delivery',
      check: (p) => {
        assert.equal(p.instanceId, 'INST-001');
        assert.equal(p.action, 'hold');
      },
    },
    {
      args: ['--call', 'test.delivery.whenHeld', '--dry-run'],
      method: 'test.delivery.whenHeld',
      check: (p) => assert.deepEqual(p, {}),
    },
  ];
  for (const c of cases) {
    const payload = seamJson(c.args);
    assert.equal(payload.ok, true);
    assert.equal(payload.dryRun, true);
    assert.equal(payload.method, c.method);
    c.check(payload.params);
  }
});

test('call-seam 参数逐字对齐 server.js payload（8 个 mutate / reasonCode / artifactRefs）', () => {
  for (const mutate of MUTATES) {
    const payload = seamJson([
      '--call', 'test.handoff', '--instance', 'I', '--node', 'N', '--mutate', mutate, '--dry-run',
    ]);
    assert.equal(payload.params.mutate, mutate);
  }
  const esc = seamJson([
    '--call', 'test.escalate', '--instance', 'I', '--node', 'N',
    '--reason-code', 'rounds_exceeded', '--artifact-ref', 'a.md', '--artifact-ref', 'b.md', '--dry-run',
  ]);
  assert.equal(esc.params.reasonCode, 'rounds_exceeded');
  assert.deepEqual(esc.params.artifactRefs, ['a.md', 'b.md']);

  const handoff = seamJson([
    '--call', 'test.handoff', '--instance', 'I', '--node', 'N',
    '--mutate', 'hash-mismatch', '--edge-kind', 'backflow', '--round', '2', '--dry-run',
  ]);
  assert.equal(handoff.params.edgeKind, 'backflow');
  assert.equal(handoff.params.round, 2);
});

test('未知 --call / 未知参数给明确非零退出，不静默忽略', () => {
  const badCall = runSeam(['--call', 'bogus', '--dry-run']);
  assert.notEqual(badCall.status, 0);
  assert.match(badCall.stderr, /未知接缝/);
  const badArg = runSeam(['--bogus', 'x']);
  assert.notEqual(badArg.status, 0);
  assert.match(badArg.stderr, /未知参数/);
});
