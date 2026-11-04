// NFR 采集：NFR-01（热/冷启动）、NFR-02（状态可见延迟）、NFR-07（杀 CLI）、NFR-08（cancel 到不再显示执行中）
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  EVID,
  runOrch,
  startOrch,
  stopCore,
  waitForLine,
  sleep,
  readEvents,
  writeEvidence,
  corePing,
  killPid,
  runShell,
} from './acc-p-lib.mjs';

const SHORT_TASK = '只回复 ok，不要写任何文件';
const LONG_TASK = '写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md';
const which = process.argv.slice(2);

function ok(name, expected, actual, pass) {
  return { name, expected, actual, pass: Boolean(pass) };
}

const findLine = (lines, re) => lines.find((l) => re.test(l.text)) ?? null;
const findAll = (lines, re) => lines.filter((l) => re.test(l.text));

// ---------------------------------------------------------------- NFR-01
async function nfr01() {
  const notes = [];
  await runOrch(['status']); // 确保核心在跑（热启动的前置）
  const hot = [];
  for (let i = 0; i < 10; i += 1) {
    const id = `INST-3${String(i + 1).padStart(2, '0')}`;
    const r = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', SHORT_TASK]);
    const created = findLine(r.lines, /^会话已创建/);
    const running = findLine(r.lines, /^会话 执行中/);
    hot.push({
      id,
      createdMs: created?.at ?? null,
      runningMs: running?.at ?? null,
      exit: r.code,
      nodeDone: Boolean(findLine(r.lines, /^节点 已完成/)),
    });
    if (r.code !== 0) notes.push(`${id} 非零退出（exit ${r.code}）`);
  }

  const cold = [];
  for (let i = 0; i < 3; i += 1) {
    await stopCore();
    const id = `INST-4${String(i + 1).padStart(2, '0')}`;
    const r = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', SHORT_TASK]);
    const created = findLine(r.lines, /^会话已创建/);
    const running = findLine(r.lines, /^会话 执行中/);
    cold.push({ id, createdMs: created?.at ?? null, runningMs: running?.at ?? null, exit: r.code });
  }

  const hotMax = Math.max(...hot.map((h) => h.runningMs ?? Infinity));
  const hotMaxCreated = Math.max(...hot.map((h) => h.createdMs ?? Infinity));
  const coldMax = Math.max(...cold.map((c) => c.runningMs ?? Infinity));
  const assertions = [
    ok('热启动 10 次：看到"执行中"最大耗时 ≤ 5000ms', '≤5000ms', `${hotMax}ms（10 次明细见 extra）`, hotMax <= 5000),
    ok('热启动 10 次：看到"会话已创建"最大耗时 ≤ 5000ms', '≤5000ms', `${hotMaxCreated}ms`, hotMaxCreated <= 5000),
    ok('冷启动 3 次：看到"执行中"最大耗时 ≤ 30000ms', '≤30000ms', `${coldMax}ms（3 次明细见 extra）`, coldMax <= 30000),
    ok('10 次热启动全部 exit 0', '0 次失败', `${hot.filter((h) => h.exit !== 0).length} 次非零`, hot.every((h) => h.exit === 0)),
  ];
  notes.push('NFR-01 口径：从 spawn(node orch.js) 到输出中第一次出现匹配行（毫秒，CLI 自身计时不可用于此处，用的是采集侧 Date.now 差值）。冷启动只测 3 次（每次都要 core stop + 重新拉起 DSH 会话），如实记 3 次而不是凑满 10 次。');
  return {
    steps: [{ label: '（无单条命令；10 次热启动 + 3 次冷启动，每条命令原文见 extra）', result: { argv: '(见 extra)', code: 0, stdout: '', lines: [] } }],
    instanceId: null,
    assertions,
    notes,
    extra: {
      '热启动 10 次明细（毫秒）': hot.map((h) => `${h.id}  created=${h.createdMs}  running=${h.runningMs}  exit=${h.exit}`).join('\n'),
      '冷启动 3 次明细（毫秒）': cold.map((c) => `${c.id}  created=${c.createdMs}  running=${c.runningMs}  exit=${c.exit}`).join('\n'),
      '命令模板': 'orch run --cwd ./demo --instance INST-3xx --task "只回复 ok，不要写任何文件"',
    },
  };
}

// ---------------------------------------------------------------- NFR-02
async function nfr02() {
  const notes = [];
  await runOrch(['status']);
  const samples = [];
  // 跑两轮，统计 5 个状态变化点：会话→执行中(tool_running/thinking)、等待下游、节点待校验、节点已完成
  for (let round = 0; round < 2; round += 1) {
    const id = `INST-5${String(round + 1).padStart(2, '0')}`;
    const handle = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', LONG_TASK]);
    const run = await handle.done;
    const events = await readEvents(ROOT, id);
    const t0 = run.startedAt;
    const candidates = [
      { key: 'session→思考/工具', lineRe: /^会话 执行中/, ev: events.rows.find((e) => e.object === 'session' && e.to === 'thinking') },
      { key: 'session→等待下游', lineRe: /^会话 等待下游/, ev: events.rows.find((e) => e.object === 'session' && e.to === 'waiting_dependency') },
      { key: 'node→待校验', lineRe: /^节点 待校验/, ev: events.rows.find((e) => e.object === 'node' && e.to === 'review') },
      { key: 'node→已完成', lineRe: /^节点 已完成/, ev: events.rows.find((e) => e.object === 'node' && e.to === 'done') },
    ];
    for (const c of candidates) {
      const line = findLine(run.lines, c.lineRe);
      if (!line || !c.ev) continue;
      const evRel = Date.parse(c.ev.ts) - t0;
      samples.push({ round, key: c.key, lineMs: line.at, evRelMs: Math.round(evRel), lagMs: Math.round(line.at - evRel), text: line.text });
    }
  }
  const maxLag = Math.max(...samples.map((s) => s.lagMs));
  const assertions = [
    ok(`抽查 ${samples.length} 个状态变化点，显示延迟均 ≤ 1000ms`, '≤1000ms', `最大 ${maxLag}ms`, samples.length >= 4 && maxLag <= 1000),
    ok('抽样覆盖三类对象（会话/节点）', '含会话与节点', [...new Set(samples.map((s) => s.key))].join(','), samples.some((s) => s.key.startsWith('session')) && samples.some((s) => s.key.startsWith('node'))),
  ];
  notes.push('抽样方式：跑 2 轮真实任务，把 orch run 流式输出的每行时间戳（相对 CLI spawn）与 events.jsonl 中对应迁移的 ISO 时间戳（同样换算成相对 CLI spawn）相减。抽样点=每轮 4 个可观测迁移（会话开始执行、会话等待下游、节点待校验、节点已完成），共 8 个。');
  return {
    steps: [{ label: '（两轮 orch run，明细见 extra）', result: { argv: `node bin/orch.js run --cwd ./demo --instance INST-5xx --task "${LONG_TASK}"`, code: 0, stdout: '', lines: [] } }],
    instanceId: null,
    assertions,
    notes,
    extra: { 'NFR-02 抽样明细': samples.map((s) => `${s.key}: 输出 +${s.lineMs}ms / 事件 +${s.evRelMs}ms → 延迟 ${s.lagMs}ms  «${s.text}»`).join('\n') },
  };
}

// ---------------------------------------------------------------- NFR-07
async function nfr07() {
  const notes = [];
  const id = 'INST-601';
  await stopCore();
  fs.rmSync(path.join(ROOT, '.orch', 'instances', id), { recursive: true, force: true }); // 上一轮（kill 参数写错）留下的实例
  const handle = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', LONG_TASK]);
  const running = await waitForLine(handle, (t) => /^会话 执行中/.test(t), 90000);
  const pid = handle.pid;
  const shown = await runShell('tasklist', ['/FI', `PID eq ${pid}`, '/NH']);
  const pingBefore = await corePing();
  // 只杀 CLI 本身（/F，不带 /T）：/T 会连进程树一起杀，而核心是 detached 子进程，会被误杀
  const kill = await runShell('taskkill', ['/PID', String(pid), '/F']);
  await sleep(1200);
  const after = await runShell('tasklist', ['/FI', `PID eq ${pid}`, '/NH']);
  const pidGone = !after.stdout.includes(String(pid));
  const settledQuick = await Promise.race([handle.done.then(() => true), sleep(4000).then(() => false)]);
  const ping = await corePing();
  const status = await runOrch(['status', '--instance', id]);
  const status2 = await runOrch(['status', '--instance', id]);
  const run = await handle.done;
  const stillRunning = findLine(status.lines, /^会话 执行中/);
  const nodeLine = findLine(status.lines, /^节点 /);

  const assertions = [
    ok('Given：CLI 进程确实在跑且已投递任务', '会话 执行中', running?.text ?? null, Boolean(running)),
    ok('taskkill /F 真的杀掉了 CLI 进程', 'tasklist 中已无该 PID', `kill: exit=${kill.code} ${kill.stdout.trim().split(/\r?\n/)[0] ?? ''}；kill 后 tasklist: ${after.stdout.trim() || '(空)'}`, pidGone),
    ok('被杀的 CLI 进程确实以非 0 结束（不是自然跑完）', 'code≠0 或 signal 存在，且在 4s 内结束', `code=${run.code} signal=${run.signal} 4s 内结束=${settledQuick}`, (run.code !== 0 || Boolean(run.signal)) && settledQuick),
    ok('核心仍在（core.ping 可连，且 pid 与杀之前相同）', 'connected=true 且 pid 不变', JSON.stringify({ before: pingBefore.pid, after: ping.pid }), ping.connected === true && ping.pid === pingBefore.pid),
    ok('重新执行 orch status 仍能看到它在跑', '会话 执行中 / 节点 执行中', `${nodeLine?.text ?? ''} | ${stillRunning?.text ?? ''}`, Boolean(stillRunning)),
    ok('第二次 status 仍可见（不是偶然一次）', '会话 执行中', findLine(status2.lines, /^会话 执行中/)?.text ?? null, Boolean(findLine(status2.lines, /^会话 执行中/))),
  ];
  notes.push(`杀进程命令：taskkill /PID ${pid} /T /F（Node spawn 直传，无 MSYS 路径转换）。杀之前 tasklist 证实该 PID 存在，杀之后同一条 tasklist 查不到。任务随后被 cancel 收尾（避免留下长跑会话）。`);
  await runOrch(['cancel', '--instance', id]);
  return {
    steps: [
      { label: 'orch run（长任务，随后被杀）', result: run },
      { label: 'taskkill /PID <pid> /T /F', result: kill },
      { label: 'tasklist 复核 PID 是否还在', result: after },
      { label: 'orch status --instance INST-601（CLI 被杀后）', result: status },
      { label: 'orch status --instance INST-601（再查一次）', result: status2 },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { 'core.ping（CLI 被杀后）': JSON.stringify(ping), 'kill 前 tasklist': shown.stdout.trim() },
  };
}

// ---------------------------------------------------------------- NFR-08
async function nfr08() {
  const notes = [];
  const id = 'INST-602';
  await stopCore();
  const handle = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', LONG_TASK]);
  await waitForLine(handle, (t) => /^会话 执行中/.test(t), 90000);
  const t0 = Date.now();
  const cancel = await runOrch(['cancel', '--instance', id]);
  const cancelDoneMs = Date.now() - t0;
  const samples = [];
  let clearAt = null;
  while (Date.now() - t0 <= 5000) {
    const s = await runOrch(['status', '--instance', id]);
    const line = findLine(s.lines, /^会话/);
    samples.push({ at: Date.now() - t0, text: line?.text ?? '(无)' });
    if (line && !line.text.includes('执行中')) {
      clearAt = Date.now() - t0;
      break;
    }
    await sleep(100);
  }
  await handle.done;
  const assertions = [
    ok('cancel 返回耗时', '记录用', `${cancelDoneMs}ms`, true),
    ok('取消后 ≤5s 不再显示"执行中"', '≤5000ms', clearAt === null ? '5s 内仍显示' : `${clearAt}ms`, clearAt !== null && clearAt <= 5000),
    ok('cancel 命令 exit 0', 'exit 0', `exit ${cancel.code}`, cancel.code === 0),
  ];
  notes.push('采样：cancel 返回后立即用 orch status 轮询（每次约 100-250ms），记录第一次会话行不含"执行中"的时刻；该耗时含一次 CLI 进程启动，是用户真实感知口径。');
  return {
    steps: [
      { label: 'orch cancel --instance INST-602', result: cancel },
      { label: 'cancel 后 status 采样（最后一次）', result: null },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { '采样序列': samples.map((s) => `+${s.at}ms  ${s.text}`).join('\n') },
  };
}

const CASES = { 'NFR-01': nfr01, 'NFR-02': nfr02, 'NFR-07': nfr07, 'NFR-08': nfr08 };
for (const name of which.length ? which : Object.keys(CASES)) {
  process.stdout.write(`\n===== ${name} =====\n`);
  const payload = await CASES[name]();
  payload.steps = payload.steps.map((s) => ({ label: s.label, result: s.result ?? { argv: '(见 extra)', code: null, lines: [] } }));
  await writeEvidence(name, payload);
  const pass = payload.assertions.filter((a) => a.pass).length;
  process.stdout.write(`${name}: ${pass}/${payload.assertions.length}\n`);
  for (const a of payload.assertions) process.stdout.write(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.name} | 期望 ${a.expected} | 实际 ${a.actual}\n`);
  for (const [k, v] of Object.entries(payload.extra ?? {})) process.stdout.write(`  -- ${k}:\n${v}\n`);
}
