// I1.9 S3 验收 A 组：AC-01（事件日志只追加）/ AC-02（链式哈希）。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-chain.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-01|AC-02/
import fs from 'node:fs';

import {
  ZERO_HASH, eventsPath, freshRoot, makeChecks, nowIso, parseEventJson,
  readJson, recordHash, removeProject, report, runCli, spawnCli, stopCore,
  waitFor, writeEvidence, writeMockConfig,
} from './acc9-a-lib.mjs';

const TASK = '写一份说明';

/** AC-01：跑一个单节点实例，边跑边抓一份 events.jsonl 副本，跑完比对旧行前缀。 */
async function ac01() {
  const { checks, check } = makeChecks();
  const runs = [];

  let root = null;
  let captured = null;
  let finalBytes = null;
  let res = null;

  // 若抓取时机太晚（副本 == 终态），重跑最多 3 次，保证「追加」有可比的前缀。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    root = freshRoot('AC-01');
    writeMockConfig(root);
    const { done } = spawnCli(root, [
      'run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', TASK,
    ]);
    const file = eventsPath(root);
    const got = await waitFor(() => {
      try {
        const buf = fs.readFileSync(file);
        return buf.length > 0 ? buf : null;
      } catch {
        return null;
      }
    }, { timeoutMs: 60_000, label: 'events.jsonl 首条记录' });
    captured = got.ok ? got.value : null;
    res = await done;
    finalBytes = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
    const capturedLines = captured ? captured.toString('utf8').split('\n').filter((l) => l.trim() !== '').length : 0;
    const finalLines = finalBytes.toString('utf8').split('\n').filter((l) => l.trim() !== '').length;
    runs.push({ attempt, capturedLines, finalLines, capturedAt: nowIso() });
    if (captured && capturedLines > 0 && capturedLines < finalLines) break;
  }

  check('run 退出码 0', res.exitCode === 0, { exitCode: res.exitCode, stderr: res.stderr });
  check('运行中抓到 events.jsonl 非空副本', captured !== null && captured.length > 0,
    runs[runs.length - 1]);

  const prefixOk = captured !== null && finalBytes !== null
    && finalBytes.subarray(0, captured.length).equals(captured);
  check('追加后旧行前缀字节完全一致', prefixOk, {
    capturedBytes: captured?.length ?? 0, finalBytes: finalBytes?.length ?? 0,
  });

  const log = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  check('instance log --format json 退出码 0', log.exitCode === 0, { exitCode: log.exitCode });
  const events = parseEventJson(log.stdout);

  const seqs = events.map((e) => e.seq);
  const strictlyIncreasing = seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1);
  check('seq 严格递增且无空洞', strictlyIncreasing && seqs.length > 0, { seqs });

  const capturedSeq = captured
    ? captured.toString('utf8').split('\n').filter((l) => l.trim() !== '')
      .map((l) => { try { return JSON.parse(l).seq; } catch { return null; } })
    : [];
  check('抓取副本中的序号是终态序号的前缀（旧记录未被改写/重排）',
    capturedSeq.length > 0 && capturedSeq.every((s, i) => s === seqs[i]), { capturedSeq, head: seqs.slice(0, capturedSeq.length) });

  // 「事件条数只增不减」：抓取时 N 条，最终 >= N 条且旧 N 条内容哈希逐一相等。
  const capturedEvents = captured
    ? captured.toString('utf8').split('\n').filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l))
    : [];
  const oldHashOk = capturedEvents.length > 0
    && capturedEvents.every((ev, i) => recordHash(ev) === recordHash(events[i]));
  check('抓取时的旧记录与终态同位置记录规范化哈希逐一相等', oldHashOk);

  writeEvidence('AC-01', 'stdout-run.txt', res.stdout + res.stderr);
  writeEvidence('AC-01', 'stdout-instance-log-json.txt', log.stdout + log.stderr);
  writeEvidence('AC-01', 'captured-events.jsonl', captured?.toString('utf8') ?? '');
  writeEvidence('AC-01', 'final-events.jsonl', finalBytes?.toString('utf8') ?? '');
  writeEvidence('AC-01', 'run-attempts.json', runs);
  const payload = { task: TASK, root, checks, pass: checks.every((c) => c.ok) };
  report('AC-01', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

/** AC-02：单实例逐条链校验 + 同根第二个实例的链互不串接。 */
function verifyChain(events) {
  const breaks = [];
  if (events.length === 0) return { ok: false, breaks: [{ i: -1, why: 'empty' }], firstHash: null };
  if (events[0].prev_event_hash !== ZERO_HASH) {
    breaks.push({ i: 0, why: 'first prev_event_hash != 64 zeros', got: events[0].prev_event_hash });
  }
  for (let i = 1; i < events.length; i += 1) {
    const expected = recordHash(events[i - 1]);
    if (events[i].prev_event_hash !== expected) {
      breaks.push({ i, seq: events[i].seq, expected, got: events[i].prev_event_hash });
    }
  }
  return { ok: breaks.length === 0, breaks, firstHash: events[0].prev_event_hash };
}

function ac02() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-02');
  writeMockConfig(root);

  const run1 = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', TASK]);
  const log1 = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);

  const run2 = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--instance', 'INST-002', '--task', TASK]);
  const log2 = runCli(root, ['instance', 'log', 'INST-002', '--format', 'json']);

  check('两次 run 退出码 0', run1.exitCode === 0 && run2.exitCode === 0,
    { run1: run1.exitCode, run2: run2.exitCode, stderr1: run1.stderr, stderr2: run2.stderr });
  check('两次 instance log 退出码 0', log1.exitCode === 0 && log2.exitCode === 0,
    { log1: log1.exitCode, log2: log2.exitCode });

  const events1 = parseEventJson(log1.stdout);
  const events2 = parseEventJson(log2.stdout);
  const chain1 = verifyChain(events1);
  const chain2 = verifyChain(events2);

  check('INST-001 首条 prev_event_hash = 64 个 0', events1[0]?.prev_event_hash === ZERO_HASH, { got: events1[0]?.prev_event_hash });
  check('INST-001 链断点数为 0', chain1.ok, { breaks: chain1.breaks, n: events1.length });
  check('INST-002 首条 prev_event_hash = 64 个 0', events2[0]?.prev_event_hash === ZERO_HASH, { got: events2[0]?.prev_event_hash });
  check('INST-002 链断点数为 0', chain2.ok, { breaks: chain2.breaks, n: events2.length });

  // 两条链互不串接：第二条链的非零 prev 不得指向第一条链的任何记录哈希。
  const hashes1 = new Set(events1.map(recordHash));
  const crossRefs = events2
    .map((e, i) => ({ i, prev: e.prev_event_hash }))
    .filter((x) => x.prev !== ZERO_HASH && hashes1.has(x.prev));
  check('INST-002 未引用 INST-001 的任何记录指纹（链不串）', crossRefs.length === 0, {
    crossRefs,
    chain1RecordHashes: [...hashes1].length,
  });
  check('两实例记录自身的指纹集合不同（各是一条独立链）',
    [...events2.map(recordHash)].some((h) => !hashes1.has(h)), {
      n1: events1.length, n2: events2.length,
    });

  // `object: 'instance'` 的事件必须挂在自己实例上；node/handoff/session 的 objectId
  // 是实例内标识，不要求等于实例号（既有事件形状）。
  const ownInstanceEvents = events2.filter((e) => e.object === 'instance');
  check('INST-002 的实例级事件全部写的是 INST-002',
    ownInstanceEvents.length > 0 && ownInstanceEvents.every((e) => e.objectId === 'INST-002'),
    { instanceEvents: ownInstanceEvents.map((e) => e.objectId) });

  writeEvidence('AC-02', 'stdout-run-inst001.txt', run1.stdout + run1.stderr);
  writeEvidence('AC-02', 'stdout-run-inst002.txt', run2.stdout + run2.stderr);
  writeEvidence('AC-02', 'stdout-log-inst001-json.txt', log1.stdout + log1.stderr);
  writeEvidence('AC-02', 'stdout-log-inst002-json.txt', log2.stdout + log2.stderr);
  writeEvidence('AC-02', 'chain-verify.json', {
    chain1: { n: events1.length, breaks: chain1.breaks, firstHash: chain1.firstHash },
    chain2: { n: events2.length, breaks: chain2.breaks, firstHash: chain2.firstHash },
    crossRefs,
  });
  const payload = { task: TASK, root, checks, pass: checks.every((c) => c.ok) };
  report('AC-02', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

const result = { at: nowIso(), ac01: await ac01(), ac02: ac02() };
process.stdout.write(`\n=== SUMMARY ===\nAC-01 ${result.ac01.pass ? 'PASS' : 'FAIL'}\nAC-02 ${result.ac02.pass ? 'PASS' : 'FAIL'}\n`);
process.exit(result.ac01.pass && result.ac02.pass ? 0 : 1);
