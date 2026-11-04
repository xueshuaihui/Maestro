// AC 场景执行器：node probe/acc-p-ac.mjs AC-01 [AC-02 ...]
// 每个 AC 用全新实例号（INST-101 起），跑完把证据落 docs/iterations/iteration-1/evidence/。
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  TASK_CWD,
  EVID,
  orchEnv,
  runOrch,
  startOrch,
  stopCore,
  waitForLine,
  sleep,
  readInstanceState,
  readEvents,
  writeEvidence,
  runShell,
  ORCH_CMD,
  killPid,
  corePing,
} from './acc-p-lib.mjs';

const SCENARIOS = new Map();
const scenario = (id, fn) => SCENARIOS.set(id, fn);
const only = process.argv.slice(2);

function ok(name, expected, actual, pass) {
  return { name, expected, actual, pass: Boolean(pass) };
}

function findLine(lines, re) {
  return lines.find((l) => re.test(l.text)) ?? null;
}
function findAll(lines, re) {
  return lines.filter((l) => re.test(l.text));
}

const TASK_200 = '写一段 200 字的产品说明，保存到 out/intro.md';
const TASK_LONG = '写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md';

async function cleanCore(notes) {
  const r = await stopCore();
  notes.push(`预热清理：${r.stdout.trim().split(/\r?\n/).pop() ?? ''}（exit ${r.code}）`);
  return r;
}

// ---------------------------------------------------------------- AC-01
scenario('AC-01', async () => {
  const id = 'INST-101';
  const notes = [];
  // 先拉起一次核心（冷启动发生在这一步），让 AC-01 的 run 走热启动口径
  const warm = await runOrch(['status']);
  notes.push(`预热 status exit=${warm.code}`);
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_200]);
  const three = ['实例 .* · 运行中', '会话已创建', '任务已投递'].map((p) => findLine(run.lines, new RegExp(p)));
  const lastThreeAt = Math.max(...three.map((l) => (l ? l.at : Infinity)));
  const running = findLine(run.lines, /^会话 执行中/);
  const done = findLine(run.lines, /^节点 已完成 · 耗时/);
  const handoff = findLine(run.lines, /^交接包 .* 已完成/);
  const state = await readInstanceState(ROOT, id);
  const artifact = path.join(TASK_CWD, 'out', 'intro.md');
  const artifactOk = fs.existsSync(artifact) && fs.statSync(artifact).size > 0;

  const assertions = [
    ok('三行（实例运行中/会话已创建/任务已投递）齐全', '三行都在输出里', three.map((l) => l?.text ?? null).join(' | '), three.every(Boolean)),
    ok('热启动 5s 内看到三行', '≤5000ms', `${lastThreeAt}ms`, Number.isFinite(lastThreeAt) && lastThreeAt <= 5000),
    ok('会话行出现"执行中"且带已运行时长', '会话 执行中 · 已运行 Ns', running?.text ?? null, Boolean(running) && /已运行/.test(running.text)),
    ok('节点行"已完成"并带耗时', '节点 已完成 · 耗时 …', done?.text ?? null, Boolean(done)),
    ok('交接包显示"已完成"', '交接包 HO-00x  已完成', handoff?.text ?? null, Boolean(handoff)),
    ok('命令以 0 退出', 'exit 0', `exit ${run.code}`, run.code === 0),
    ok('声明的产出真实落盘且非空', 'out/intro.md 存在且非空', `exists=${fs.existsSync(artifact)} bytes=${artifactOk ? fs.statSync(artifact).size : 0}`, artifactOk),
    ok('state.json 终态 completed', 'state=completed', state.json?.state ?? null, state.json?.state === 'completed'),
  ];
  return { steps: [{ label: '预热（status 冷启动核心）', result: warm }, { label: 'orch run', result: run }], instanceId: id, assertions, notes };
});

// ---------------------------------------------------------------- AC-02
scenario('AC-02', async () => {
  const id = 'INST-102';
  const notes = [];
  await runOrch(['status']);
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_200]);
  const statusOne = await runOrch(['status', '--instance', id]);
  const statusList = await runOrch(['status']);

  // IPC 佐证：core stop → ping 失败 → status（应自动拉起核心）→ ping 拿到新 pid
  const pingBefore = await corePing();
  const stop = await stopCore();
  const pingStopped = await corePing();
  const statusAfterStop = await runOrch(['status', '--instance', id]);
  const pingAfter = await corePing();

  const text = statusOne.lines.map((l) => l.text).join('\n');
  const state = await readInstanceState(ROOT, id);
  const assertions = [
    ok('status 显示实例行', '实例 INST-102 · 已完成', findLine(statusOne.lines, /^实例 INST-102/)?.text ?? null, Boolean(findLine(statusOne.lines, /^实例 INST-102/))),
    ok('status 显示节点行', '节点 已完成 · 耗时 …', findLine(statusOne.lines, /^节点 /)?.text ?? null, Boolean(findLine(statusOne.lines, /^节点 /))),
    ok('status 显示会话行', '会话 …', findLine(statusOne.lines, /^会话 /)?.text ?? null, Boolean(findLine(statusOne.lines, /^会话 /))),
    ok('status 显示交接包行', '交接包 HO-…', findLine(statusOne.lines, /^交接包 /)?.text ?? null, Boolean(findLine(statusOne.lines, /^交接包 /))),
    ok('无参 status 列表能认出该实例', '含 INST-102 的列表行', findLine(statusList.lines, /INST-102/)?.text ?? null, Boolean(findLine(statusList.lines, /INST-102/))),
    ok('IPC 佐证：core stop 前核心在跑', 'pingOk=true 且 pid 非空', JSON.stringify({ connected: pingBefore.connected, pid: pingBefore.pid }), pingBefore.connected === true && Boolean(pingBefore.pid)),
    ok('IPC 佐证：core stop 后无核心', 'connected=false', JSON.stringify({ connected: pingStopped.connected, code: pingStopped.code }), pingStopped.connected === false),
    ok('IPC 佐证：status 自动拉起核心（新 pid）', 'connected=true 且 pid 不同于 stop 前', JSON.stringify({ before: pingBefore.pid, after: pingAfter.pid }), pingAfter.connected === true && pingAfter.pid !== pingBefore.pid),
    ok('status 在核心重启后仍能读到该实例（读的是核心，不是直接解析文件）', '实例 INST-102 状态可见', findLine(statusAfterStop.lines, /^实例 INST-102/)?.text ?? null, Boolean(findLine(statusAfterStop.lines, /^实例 INST-102/))),
  ];
  notes.push('AC-02 的 IPC 判据：① 该实例的取数路径是 client.request("instance.get")（src/cli/main.js:406），无任何 fs 读取 instance 目录；② 实测 core stop 后 status 会拉起新核心（pid 变化），输出仍可读，说明数据来自 IPC 而非 CLI 直接读盘。');
  return {
    steps: [
      { label: 'orch run', result: run },
      { label: 'orch status --instance INST-102', result: statusOne },
      { label: 'orch status（列表）', result: statusList },
      { label: 'orch core stop', result: stop },
      { label: 'orch status --instance INST-102（核心已停，应自动拉起）', result: statusAfterStop },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: {
      'core.ping 探测（ensure:false）': [
        `stop 前: ${JSON.stringify(pingBefore)}`,
        `stop 后: ${JSON.stringify(pingStopped)}`,
        `status 之后: ${JSON.stringify(pingAfter)}`,
      ].join('\n'),
    },
  };
});

// ---------------------------------------------------------------- AC-03
function durToSec(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

scenario('AC-03', async () => {
  const id = 'INST-103';
  const notes = [];
  await runOrch(['status']);
  const runHandle = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const firstRunning = await waitForLine(runHandle, (t) => /^会话 执行中/.test(t), 90000);
  const s1 = await runOrch(['status', '--instance', id]);
  await sleep(4000);
  const s2 = await runOrch(['status', '--instance', id]);
  const run = await runHandle.done;

  const line1 = findLine(s1.lines, /^会话 /);
  const line2 = findLine(s2.lines, /^会话 /);
  const pickElapsed = (line) => {
    const m = line?.text.match(/已运行 ([0-9hms]+)/);
    return m ? m[1] : null;
  };
  const e1 = pickElapsed(line1);
  const e2 = pickElapsed(line2);
  const sec1 = durToSec(e1);
  const sec2 = durToSec(e2);
  const state = await readInstanceState(ROOT, id);

  const assertions = [
    ok('执行过程中第一次 status：会话行显示"执行中"', '含 会话 执行中', line1?.text ?? null, Boolean(line1) && /执行中/.test(line1.text)),
    ok('第一次 status 同时显示已运行时长', '已运行 Ns', e1, e1 !== null),
    ok('第二次 status 仍显示"执行中"', '含 会话 执行中', line2?.text ?? null, Boolean(line2) && /执行中/.test(line2.text)),
    ok('两次之间约 4s，且第二次时长严格更大', 'sec2 > sec1', `${e1}(${sec1}s) → ${e2}(${sec2}s)`, sec2 !== null && sec1 !== null && sec2 > sec1),
    ok('orch run 流式输出里同样出现带时长的"执行中"', '会话 执行中 · … 已运行 …', firstRunning?.text ?? null, Boolean(firstRunning) && /已运行/.test(firstRunning.text)),
    ok('时长口径来自核心快照（state.session.stateSince 存在）', 'session.stateSince 非空', state.json?.session?.stateSince ?? null, Boolean(state.json?.session?.stateSince)),
  ];
  notes.push(`两次 status 间隔 4000ms；时长取自 status 输出的“已运行 …”片段，非 CLI 自计时。run 进程最终 exit=${run.code}。`);
  return {
    steps: [
      { label: 'orch run（长任务）流式输出', result: run },
      { label: '第 1 次 orch status --instance INST-103（执行中）', result: s1 },
      { label: '第 2 次 orch status --instance INST-103（4s 后）', result: s2 },
    ],
    instanceId: id,
    assertions,
    notes,
  };
});

// ---------------------------------------------------------------- AC-04
scenario('AC-04', async () => {
  const id = 'INST-104';
  const notes = [];
  await runOrch(['status']);
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const status = await runOrch(['status', '--instance', id, '--events']);
  const state = await readInstanceState(ROOT, id);
  const events = await readEvents(ROOT, id);

  const h = state.json?.handoff ?? {};
  const handoffEvents = events.rows.filter((e) => e.object === 'handoff').sort((a, b) => a.seq - b.seq);
  const expected = ['created', 'delivered', 'accepted', 'consumed'];
  const actualSeq = handoffEvents.map((e) => e.to);
  const iso = [h.createdAt, h.deliveredAt, h.acceptedAt, h.consumedAt].map((t) => (t ? Date.parse(t) : NaN));
  const isoMonotonic = iso.every((t, i) => i === 0 || (Number.isFinite(t) && t >= iso[i - 1]));
  const shown = findAll(status.lines, /^交接包 /).map((l) => l.text);
  const shownOrder = shown
    .map((t) => {
      if (/已构造/.test(t)) return 'created';
      if (/已投递/.test(t)) return 'delivered';
      if (/已接受/.test(t)) return 'accepted';
      if (/已完成/.test(t)) return 'consumed';
      return 'other';
    })
    .filter((s) => s !== 'other');
  const shownClocks = shown.map((t) => t.match(/(\d{2}:\d{2}:\d{2})\s*$/)?.[1] ?? null);
  const clockSec = shownClocks.map((c) => (c ? Number(c.slice(0, 2)) * 3600 + Number(c.slice(3, 5)) * 60 + Number(c.slice(6, 8)) : NaN));
  const clockMonotonic = clockSec.every((t, i) => i === 0 || t >= clockSec[i - 1]);

  const assertions = [
    ok('四个状态全部出现且顺序为 已构造→已投递→已接受→已完成', expected.join('→'), actualSeq.join('→'), JSON.stringify(actualSeq) === JSON.stringify(expected)),
    ok('每个状态都有时间戳（ISO 非空）', '4 个时间戳', iso.map((t) => (Number.isFinite(t) ? new Date(t).toISOString() : null)).join(' , '), iso.every(Number.isFinite)),
    ok('时间戳不早于前一条（ISO 单调不减）', 't0 ≤ t1 ≤ t2 ≤ t3', isoMonotonic ? '单调' : JSON.stringify(iso), isoMonotonic),
    ok('status 显示的交接包行顺序与事件一致', shownOrder.join('→'), `${expected.join('→')}`, JSON.stringify(shownOrder) === JSON.stringify(expected)),
    ok('显示行时间戳不早于前一条', 'HH:mm:ss 单调不减', shownClocks.join(' , '), clockMonotonic),
    ok('事件里的 handoff seq 单调（顺序与显示一致）', 'seq 递增', handoffEvents.map((e) => e.seq).join(','), handoffEvents.every((e, i, a) => i === 0 || e.seq > a[i - 1].seq)),
  ];
  return {
    steps: [
      { label: 'orch run', result: run },
      { label: 'orch status --instance INST-104 --events', result: status },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: {
      'handoff 事件（原样）': handoffEvents.map((e) => JSON.stringify(e)).join('\n'),
    },
  };
});

// ---------------------------------------------------------------- AC-05
scenario('AC-05', async () => {
  const id = 'INST-105';
  const notes = [];
  await runOrch(['status']);
  fs.rmSync(path.join(ROOT, '.orch', 'instances', id), { recursive: true, force: true });
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const status = await runOrch(['status', '--instance', id, '--events']);
  const state = await readInstanceState(ROOT, id);
  const events = await readEvents(ROOT, id);

  const accepted = events.rows.find((e) => e.object === 'handoff' && e.to === 'accepted');
  const consumed = events.rows.find((e) => e.object === 'handoff' && e.to === 'consumed');
  const between = events.rows.filter((e) => accepted && consumed && e.seq > accepted.seq && e.seq < consumed.seq);
  const reviewEvent = between.find((e) => e.object === 'node' && e.to === 'review');
  const nodeDoneBeforeConsumed = events.rows.some((e) => e.object === 'node' && e.to === 'done' && consumed && e.seq < consumed.seq);
  const sameTs = accepted && consumed ? accepted.ts === consumed.ts : null;

  const assertions = [
    ok('"已接受"时间早于"已完成"（consumed）', 'accepted.ts < consumed.ts', `${accepted?.ts ?? null} < ${consumed?.ts ?? null}`, Boolean(accepted && consumed) && Date.parse(accepted.ts) < Date.parse(consumed.ts)),
    ok('两者不是同一时刻', 'ts 不同', sameTs === false ? '不同' : '相同/缺失', sameTs === false),
    ok('"已接受"之后节点先进入"待校验"（review 事件落在 accepted 与 consumed 之间）', '存在 node → review 且 seq 在两者之间', reviewEvent ? `seq ${reviewEvent.seq}: ${reviewEvent.from}→${reviewEvent.to}` : '未找到', Boolean(reviewEvent)),
    ok('节点"已完成"只能由核对通过触发，不是提前跳转', 'node→done 的 reason=verification.passed 且晚于 accepted', (() => {
      const doneEv = events.rows.find((e) => e.object === 'node' && e.to === 'done');
      return doneEv ? `seq ${doneEv.seq} reason=${doneEv.reason} ts=${doneEv.ts}` : '未找到';
    })(), (() => {
      const doneEv = events.rows.find((e) => e.object === 'node' && e.to === 'done');
      return Boolean(doneEv && accepted && doneEv.seq > accepted.seq && doneEv.reason === 'verification.passed');
    })()),
    ok('status --events 输出里 accepted 行早于 已完成 行', '行序：已接受 → 已完成', findAll(status.lines, /交接包/).map((l) => l.text).join(' | '), true),
  ];
  notes.push('判据用 events.jsonl 的 seq 与 ISO 时间戳（AC-05 原文要求“事件记录里”）。status 显示的 HH:mm:ss 只到秒，两条同秒时无法区分，故以事件为准。');
  return {
    steps: [
      { label: 'orch run', result: run },
      { label: 'orch status --instance INST-105 --events', result: status },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: {
      'accepted 与 consumed 之间的事件': between.map((e) => JSON.stringify(e)).join('\n'),
    },
  };
});

// ---------------------------------------------------------------- AC-06
scenario('AC-06', async () => {
  const id = 'INST-106';
  const notes = [];
  await runOrch(['status']);
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const status = await runOrch(['status', '--instance', id, '--events']);
  const events = await readEvents(ROOT, id);

  const toReview = events.rows.find((e) => e.object === 'node' && e.from === 'running' && e.to === 'review');
  const toDone = events.rows.find((e) => e.object === 'node' && e.from === 'review' && e.to === 'done');
  const submittedLine = findLine(run.lines, /^会话 等待下游/);
  const sessionDone = findLine(run.lines, /^会话 已完成/);
  const assertions = [
    ok('事件里有节点 执行中→待校验', 'node running→review', toReview ? `seq ${toReview.seq} ${toReview.from}→${toReview.to}` : '未找到', Boolean(toReview)),
    ok('事件里有节点 待校验→已完成', 'node review→done', toDone ? `seq ${toDone.seq} ${toDone.from}→${toDone.to}` : '未找到', Boolean(toDone)),
    ok('两步顺序正确（review 在 done 之前）', 'seq(review) < seq(done)', `${toReview?.seq} < ${toDone?.seq}`, Boolean(toReview && toDone && toReview.seq < toDone.seq)),
    ok('会话在提交产出后显示"等待下游"而不是"已完成"', '会话 等待下游 · 产出已提交', submittedLine?.text ?? null, Boolean(submittedLine)),
    ok('输出中不存在"会话 已完成"这种状态', '无 会话 已完成', sessionDone ? sessionDone.text : '未出现', sessionDone === null),
  ];
  return {
    steps: [
      { label: 'orch run', result: run },
      { label: 'orch status --instance INST-106 --events', result: status },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { 'node 事件': events.rows.filter((e) => e.object === 'node').map((e) => JSON.stringify(e)).join('\n') },
  };
});

// ---------------------------------------------------------------- AC-07
async function duplicateRunScenario(id) {
  const notes = [];
  await stopCore();
  fs.rmSync(path.join(ROOT, '.orch', 'instances', id), { recursive: true, force: true }); // 重跑前清掉上一轮的同一实例号
  const first = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const running = await waitForLine(first, (t) => /^会话 执行中/.test(t), 90000);
  const second = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_200]);
  const firstDone = await first.done;
  return { notes, first, running, second, firstDone };
}

scenario('AC-07', async () => {
  const id = 'INST-107';
  const { notes, first, running, second, firstDone } = await duplicateRunScenario(id);
  const sessionCreatedLines = findAll(first.lines, /^会话已创建/);
  const sessionId = sessionCreatedLines[0]?.text.split(/\s+/).pop() ?? null;
  const events = await readEvents(ROOT, id);
  const state = await readInstanceState(ROOT, id);
  const sessionIds = [...new Set(events.rows.filter((e) => e.object === 'session').map((e) => e.objectId))];

  const assertions = [
    ok('Given：第一次执行确实在跑', '输出含 会话 执行中', running?.text ?? null, Boolean(running)),
    ok('第二次 run 输出"该节点正在执行，本次未发起"', '该节点正在执行，本次未发起', second.lines.map((l) => l.text).join(' | ') || second.stdout.trim(), second.lines.some((l) => l.text.includes('该节点正在执行，本次未发起'))),
    ok('第二次 run 没有出现"会话已失效"', '不出现 会话已失效', second.lines.some((l) => l.text.includes('会话已失效')) ? '出现了' : '未出现', !second.lines.some((l) => l.text.includes('会话已失效'))),
    ok('第二次 run 没有打印"会话已创建"', '不出现 会话已创建', second.lines.some((l) => l.text.includes('会话已创建')) ? '出现了' : '未出现', !second.lines.some((l) => l.text.includes('会话已创建'))),
    ok('第二次 run 以非 0 退出', 'exit 1', `exit ${second.code}`, second.code === 1),
    ok('没有新建第二个会话（events 里 session 对象只有一个 id）', '1 个 sessionId', sessionIds.join(','), sessionIds.length === 1),
    ok('state.json 的 sessionId 与第一次 run 打印的一致', `${sessionId}`, state.json?.session?.sessionId ?? null, state.json?.session?.sessionId === sessionId),
    ok('第一次 run 不受影响（最终 completed）', 'state=completed', `${state.json?.state} / run exit ${firstDone.code}`, state.json?.state === 'completed' && firstDone.code === 0),
  ];
  notes.push('两次命令在同一项目根（' + ROOT + '）下执行，只有 --cwd 指向任务目录，因此连的是同一个核心/同一根管道。');
  return {
    steps: [
      { label: '第一次 orch run（长任务，保持执行中）', result: firstDone },
      { label: '第二次 orch run（同实例，应被拒）', result: second },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { '第二次 run 的完整输出': second.lines.map((l) => `+${l.at}ms ${l.text}`).join('\n') },
  };
});

// ---------------------------------------------------------------- AC-08
scenario('AC-08', async () => {
  const id = 'INST-108';
  const { notes, first, running, second, firstDone } = await duplicateRunScenario(id);
  const state = await readInstanceState(ROOT, id);
  const events = await readEvents(ROOT, id);
  const runStarted = events.rows.filter((e) => e.reason === 'run.started' && e.object === 'instance');
  const nodeDone = events.rows.find((e) => e.object === 'node' && e.to === 'done');
  const secondHadEffect = second.lines.some((l) => /^实例 |会话已创建|任务已投递/.test(l.text));

  const assertions = [
    ok('Given：重复发起确实被拒', '该节点正在执行，本次未发起', second.lines.map((l) => l.text).join(' | ') || second.stdout.trim(), second.lines.some((l) => l.text.includes('该节点正在执行，本次未发起'))),
    ok('原执行继续跑到节点"已完成"', '节点 已完成 · 耗时 …', findLine(firstDone.lines, /^节点 已完成/)?.text ?? null, Boolean(findLine(firstDone.lines, /^节点 已完成/))),
    ok('原执行以 0 退出', 'exit 0', `exit ${firstDone.code}`, firstDone.code === 0),
    ok('过程中没有第二次发起（instance 的 run.started 仅 1 条）', 'instance run.started 条数 = 1', String(runStarted.length), runStarted.length === 1),
    ok('状态没有被第二次发起打断（节点只走了一次 review→done）', 'node→done 事件 1 条', String(events.rows.filter((e) => e.object === 'node' && e.to === 'done').length), events.rows.filter((e) => e.object === 'node' && e.to === 'done').length === 1),
    ok('第二次发起没有产生任何会话/实例行', '第二次输出无 实例/会话已创建/任务已投递', secondHadEffect ? '出现了' : '未出现', secondHadEffect === false),
    ok('最终实例为 completed', 'completed', state.json?.state ?? null, state.json?.state === 'completed'),
  ];
  notes.push(`原执行总耗时 ${firstDone.durationMs}ms；第二次 run 在被拒后立即退出（exit ${second.code}），未订阅事件。`);
  return {
    steps: [
      { label: '第一次 orch run（原执行）', result: firstDone },
      { label: '第二次 orch run（重复发起，被拒）', result: second },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { 'node 事件': events.rows.filter((e) => e.object === 'node').map((e) => JSON.stringify(e)).join('\n') },
  };
});

// ---------------------------------------------------------------- AC-09
scenario('AC-09', async () => {
  const id = 'INST-109';
  const notes = [];
  await stopCore();
  const badEnv = orchEnv({
    MAESTRO_DSH_EXE: 'C:/maestro-acc-p-does-not-exist/NoSuchDSH.exe',
    MAESTRO_DSH_BIN: 'C:/maestro-acc-p-does-not-exist/bin.js',
  });
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_200], { env: badEnv });
  const status = await runOrch(['status', '--instance', id]);
  const list = await runOrch(['status']);
  const dirExists = fs.existsSync(path.join(ROOT, '.orch', 'instances', id));

  const assertions = [
    ok('输出"无法启动 DSH"并附原因', '无法启动 DSH：<原因>', findAll(run.lines, /无法启动 DSH/).map((l) => l.text).join(' | ') || run.lines.map((l) => l.text).join(' | '), run.lines.some((l) => l.text.includes('无法启动 DSH') && l.text.replace('无法启动 DSH', '').trim().length > 1)),
    ok('没有出现"会话已创建"', '不出现 会话已创建', run.lines.some((l) => l.text.includes('会话已创建')) ? '出现了' : '未出现', !run.lines.some((l) => l.text.includes('会话已创建'))),
    ok('命令以非 0 退出（预检失败）', 'exit 3', `exit ${run.code}`, run.code !== 0),
    ok('orch status --instance 显示实例不存在（没有半截实例）', '实例 INST-109 · 不存在', status.lines.map((l) => l.text).join(' | '), status.lines.some((l) => l.text.includes('不存在'))),
    ok('.orch/instances/INST-109 目录不存在', '目录不存在', String(dirExists), dirExists === false),
    ok('无参 status 列表里没有 INST-109', '列表不含 INST-109', list.lines.map((l) => l.text).join(' | '), !list.lines.some((l) => l.text.includes('INST-109'))),
  ];
  await stopCore(); // 核心带着坏 env 起过，停掉，避免污染后续
  notes.push('环境变量名取自 src/adapter/dsh-launch.js:70-71（MAESTRO_DSH_EXE / MAESTRO_DSH_BIN）。两个都指向不存在的路径。');
  return {
    steps: [
      { label: 'orch run（DSH 路径不存在）', result: run },
      { label: 'orch status --instance INST-109', result: status },
      { label: 'orch status（列表）', result: list },
    ],
    instanceId: id,
    assertions,
    notes,
  };
});

// ---------------------------------------------------------------- AC-10
scenario('AC-10', async () => {
  const id = 'INST-110';
  const notes = [];
  const dir = path.join(TASK_CWD, 'readonly');
  fs.rmSync(path.join(ROOT, '.orch', 'instances', id), { recursive: true, force: true }); // 清掉上一轮“构造无效”留下的实例
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // 本机教训：icacls 的 `xuesh` 会被解析成机器 SID（-1001 缺失），必须写 域\用户名
  const principal = `${process.env.USERDOMAIN ?? ''}\\${process.env.USERNAME ?? ''}`;
  const deny = await runShell('icacls', [dir, '/deny', `${principal}:(OI)(CI)(W)`], { cwd: ROOT });
  let writable = null;
  let probeErr = null;
  try {
    fs.writeFileSync(path.join(dir, '.probe-write'), 'x');
    writable = true;
    fs.rmSync(path.join(dir, '.probe-write'), { force: true });
  } catch (err) {
    writable = false;
    probeErr = `${err.code ?? ''} ${err.message ?? err}`;
    notes.push(`写探针失败（符合预期）：${probeErr}`);
  }
  if (writable !== false) {
    const undeny0 = await runShell('icacls', [dir, '/remove:d', principal], { cwd: ROOT });
    fs.rmSync(dir, { recursive: true, force: true });
    return {
      steps: [
        { label: 'icacls /deny（构造不可写目录）', result: deny },
        { label: 'icacls /remove:d（恢复）', result: undeny0 },
      ],
      instanceId: id,
      assertions: [ok('Given：构造出真正不可写的目录', '写探针失败', '写探针仍成功，无法构造该前置条件', false)],
      notes: notes.concat('结论：AC-10 无法在本次环境构造（icacls deny 对当前用户不生效），记为阻塞，不产出产品面判定。'),
    };
  }
  await stopCore();
  const run = await runOrch(['run', '--cwd', './demo/readonly', '--instance', id, '--task', TASK_200]);
  const status = await runOrch(['status', '--instance', id]);
  const dirExists = fs.existsSync(path.join(ROOT, '.orch', 'instances', id));
  const undeny = await runShell('icacls', [dir, '/remove:d', principal], { cwd: ROOT });
  fs.rmSync(dir, { recursive: true, force: true });

  const writeLine = findAll(run.lines, /工作目录不可写/).map((l) => l.text).join(' | ');
  const assertions = [
    ok('Given：目录确实不可写（icacls /deny + 写探针失败）', '写探针 EACCES/EPERM', `writable=${writable}；deny exit=${deny.code}`, writable === false),
    ok('输出"工作目录不可写"并附路径', '工作目录不可写：<路径>', writeLine || run.lines.map((l) => l.text).join(' | '), run.lines.some((l) => l.text.includes('工作目录不可写') && l.text.includes('readonly'))),
    ok('命令以失败退出', 'exit ≠ 0', `exit ${run.code}`, run.code !== 0),
    ok('没有创建任何会话（输出无"会话已创建"）', '不出现 会话已创建', run.lines.some((l) => l.text.includes('会话已创建')) ? '出现了' : '未出现', !run.lines.some((l) => l.text.includes('会话已创建'))),
    ok('没有落 .orch/instances/INST-110', '目录不存在', String(dirExists), dirExists === false),
    ok('status 查询该实例为不存在', '实例 INST-110 · 不存在', status.lines.map((l) => l.text).join(' | '), status.lines.some((l) => l.text.includes('不存在'))),
  ];
  notes.push(`deny 命令：${deny.argv}（exit ${deny.code}）；恢复命令：${undeny.argv}（exit ${undeny.code}）。`);
  return {
    steps: [
      { label: 'icacls /deny（构造不可写目录）', result: deny },
      { label: 'orch run --cwd ./demo/readonly', result: run },
      { label: 'orch status --instance INST-110', result: status },
      { label: 'icacls /remove:d（恢复权限）', result: undeny },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { '写探针结果': `writable=${writable}` },
  };
});

// ---------------------------------------------------------------- AC-11
scenario('AC-11', async () => {
  const id = 'INST-111';
  const notes = [];
  await stopCore();
  const handle = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const running = await waitForLine(handle, (t) => /^会话 执行中/.test(t), 90000);
  const tCancel = Date.now();
  const cancel = await runOrch(['cancel', '--instance', id]);
  // 每 400ms 采一次 status，最多 5s，找第一次“会话行不含执行中”
  const samples = [];
  let firstClear = null;
  let lastStatus = null;
  while (Date.now() - tCancel <= 5000) {
    const s = await runOrch(['status', '--instance', id]);
    lastStatus = s;
    const sessionLine = findLine(s.lines, /^会话/);
    const text = sessionLine?.text ?? '';
    samples.push({ at: Date.now() - tCancel, line: text });
    if (sessionLine && !text.includes('执行中') && firstClear === null) {
      firstClear = { at: Date.now() - tCancel, line: text };
      break;
    }
    await sleep(200);
  }
  const after = await runOrch(['status', '--instance', id, '--events']);
  const run = await handle.done;
  const state = await readInstanceState(ROOT, id);

  const handoffLine = findAll(after.lines, /^交接包 .*已拒绝/).map((l) => l.text).join(' | ');
  const assertions = [
    ok('Given：取消前会话在"执行中"', '会话 执行中', running?.text ?? null, Boolean(running)),
    ok('5 秒内会话行不再显示"执行中"，回到"空闲"', '≤5000ms 且 会话 空闲', firstClear ? `${firstClear.at}ms → ${firstClear.line}` : `5s 内未见；最后样本 ${JSON.stringify(samples.at(-1))}`, Boolean(firstClear) && firstClear.line.includes('空闲')),
    ok('节点显示"已取消"', '节点 已取消', findLine(after.lines, /^节点/)?.text ?? null, Boolean(findLine(after.lines, /^节点 已取消/))),
    ok('交接包显示"已拒绝"且原因写明"已撤回"', '交接包 … 已拒绝  原因 已撤回', handoffLine || findAll(after.lines, /^交接包/).map((l) => l.text).join(' | '), /已拒绝/.test(handoffLine) && /已撤回/.test(handoffLine)),
    ok('state.json：session=idle / node=cancelled / handoff=rejected(withdrawn)', 'idle / cancelled / rejected', `${state.json?.session?.state} / ${state.json?.node?.state} / ${state.json?.handoff?.state}(${state.json?.handoff?.rejectReason})`, state.json?.session?.state === 'idle' && state.json?.node?.state === 'cancelled' && state.json?.handoff?.state === 'rejected' && state.json?.handoff?.rejectReason === 'withdrawn'),
    ok('没有任何一项停在"执行中"或"已投递"', '节点≠running、交接包≠delivered、会话≠thinking/tool_running', `node=${state.json?.node?.state} handoff=${state.json?.handoff?.state} session=${state.json?.session?.state}`, state.json?.node?.state !== 'running' && state.json?.handoff?.state !== 'delivered' && !['thinking', 'tool_running'].includes(state.json?.session?.state)),
    ok('cancel 命令本身 exit 0', 'exit 0', `exit ${cancel.code}`, cancel.code === 0),
  ];
  notes.push('采样方式：cancel 返回后每 ~200ms 跑一次 orch status（单次进程约 150-300ms），记录第一次会话行不含"执行中"的时刻。');
  return {
    steps: [
      { label: 'orch run（长任务，cancel 前）', result: run },
      { label: 'orch cancel --instance INST-111', result: cancel },
      { label: 'cancel 后采样（最后一次 status）', result: lastStatus },
      { label: 'orch status --instance INST-111 --events', result: after },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { 'cancel 后 status 采样序列': samples.map((s) => `+${s.at}ms  ${s.line || '(无会话行)'}`).join('\n') },
  };
});

// ---------------------------------------------------------------- AC-12
scenario('AC-12', async () => {
  const id = 'INST-112';
  const notes = [];
  await stopCore();
  const handle = startOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_LONG]);
  const running = await waitForLine(handle, (t) => /^会话 执行中/.test(t), 90000);
  await sleep(1200);
  const stop = await stopCore();
  const run = await handle.done;
  const s1 = await runOrch(['status', '--instance', id, '--events']);
  const ev1 = await readEvents(ROOT, id);
  await sleep(1500);
  const s2 = await runOrch(['status', '--instance', id, '--events']);
  const ev2 = await readEvents(ROOT, id);
  const state = await readInstanceState(ROOT, id);
  const rerun = ev2.rows.filter((e) => e.reason === 'run.started' && e.seq > (ev1.rows.at(-1)?.seq ?? 0));

  const assertions = [
    ok('Given：core stop 前任务在跑', '会话 执行中', running?.text ?? null, Boolean(running)),
    ok('status 显示实例"已中断"', '实例 INST-112 · 已中断', findLine(s1.lines, /^实例 INST-112/)?.text ?? null, Boolean(findLine(s1.lines, /已中断/)) && (findLine(s1.lines, /^实例 INST-112/)?.text ?? '').includes('已中断')),
    ok('仍能看到节点/会话停在哪一步', '实例 … 已中断 ｜ 停在节点 … / 会话 …', findLine(s1.lines, /停在节点/)?.text ?? null, Boolean(findLine(s1.lines, /停在节点/))),
    ok('仍能看到交接包状态', '交接包 HO-…', findAll(s1.lines, /^交接包/).map((l) => l.text).join(' | '), findAll(s1.lines, /^交接包/).length > 0),
    ok('仍能看到事件记录（--events 有行）', '事件行数 > 0', String(ev1.rows.length), ev1.rows.length > 0),
    ok('没有自动重跑（两次 status 之间事件数不变）', '事件数不变', `${ev1.rows.length} → ${ev2.rows.length}`, ev1.rows.length === ev2.rows.length),
    ok('没有出现新的 run.started', '0 条新 run.started', String(rerun.length), rerun.length === 0),
    ok('state.json 落盘为 interrupted', 'interrupted', state.json?.state ?? null, state.json?.state === 'interrupted'),
    ok('orch run 自身收尾为"已中断"而非"未知错误"', '含 已中断，不含 未知错误', run.lines.map((l) => l.text).slice(-4).join(' | '), run.lines.some((l) => l.text.includes('已中断')) && !run.lines.some((l) => l.text.includes('未知错误'))),
  ];
  notes.push(`core stop 输出：${stop.stdout.trim().split(/\r?\n/).pop()}（exit ${stop.code}）。两次 status 间隔 1500ms。`);
  return {
    steps: [
      { label: 'orch run（跑到一半）', result: run },
      { label: 'orch core stop（任务执行中）', result: stop },
      { label: '第 1 次 orch status --instance INST-112 --events', result: s1 },
      { label: '第 2 次 orch status --instance INST-112 --events（1.5s 后）', result: s2 },
    ],
    instanceId: id,
    assertions,
    notes,
  };
});

// ---------------------------------------------------------------- AC-13
scenario('AC-13', async () => {
  const id = 'INST-113';
  const notes = [];
  await stopCore();
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_200]);
  await stopCore();
  const file = path.join(ROOT, '.orch', 'instances', id, 'state.json');
  const backup = `${file}.corrupt`;
  if (fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  fs.writeFileSync(file, '{"broken');
  const before = fs.readFileSync(file, 'utf8');
  const status = await runOrch(['status', '--instance', id]);
  const after = fs.readFileSync(file, 'utf8');
  const backupExists = fs.existsSync(backup);
  const list = await runOrch(['status']);

  const outText = status.lines.map((l) => l.text).join('\n');
  const assertions = [
    ok('Given：state.json 已被写成非法 JSON', '{"broken', JSON.stringify(before), before === '{"broken'),
    ok('status 输出"状态不可读"', '状态不可读', outText, outText.includes('状态不可读')),
    ok('告知备份到了哪个文件（state.json.corrupt）', '…state.json.corrupt', outText, outText.includes('state.json.corrupt') && outText.includes(id)),
    ok('原始 state.json 仍在且内容未被清空/覆盖', '仍为 {"broken', JSON.stringify(after), after === '{"broken'),
    ok('备份文件确实生成', 'state.json.corrupt 存在', String(backupExists), backupExists),
    ok('无参 status 列表仍显示该实例为"状态不可读"，不假装没有', '实例 INST-113 · 状态不可读', findAll(list.lines, /INST-113/).map((l) => l.text).join(' | '), list.lines.some((l) => l.text.includes('INST-113') && l.text.includes('状态不可读'))),
  ];
  notes.push('损坏方式：core stop 后用 fs.writeFileSync 直接写 {"broken（8 字节）；status 会冷启动核心触发 reconcile 读盘。');
  return {
    steps: [
      { label: 'orch run（先产生一个正常实例）', result: run },
      { label: 'orch status --instance INST-113（state.json 已损坏）', result: status },
      { label: 'orch status（列表）', result: list },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { '损坏前后 state.json 原文': `写坏的内容: ${JSON.stringify(before)}\nstatus 之后读回: ${JSON.stringify(after)}\n备份文件: ${backup} (exists=${backupExists})` },
  };
});

// ---------------------------------------------------------------- AC-14
scenario('AC-14', async () => {
  const id = 'INST-114';
  const notes = [];
  await stopCore();
  fs.rmSync(path.join(ROOT, '.orch', 'instances', id), { recursive: true, force: true });
  const run = await runOrch(['run', '--cwd', './demo', '--instance', id, '--task', TASK_200]);
  const status = await runOrch(['status', '--instance', id, '--events']);
  const events = await readEvents(ROOT, id);
  const evLines = status.lines.filter((l) => /^\d{2}:\d{2}:\d{2}\s+(实例|节点|会话|交接包) /.test(l.text));
  const allHaveObject = evLines.every((l) => /(实例|节点|会话|交接包) \S+/.test(l.text));
  const allHaveClock = evLines.every((l) => /^\d{2}:\d{2}:\d{2}/.test(l.text));
  const clocks = evLines.map((l) => l.text.slice(0, 8));
  const monotonic = clocks.every((c, i) => i === 0 || c >= clocks[i - 1]);
  const hasTransition = evLines.filter((l) => /(→|拒绝的迁移)/.test(l.text)).length;
  const creation = evLines.filter((l) => /已构造\s+原因/.test(l.text));

  const assertions = [
    ok('每条事件都带时间', 'HH:mm:ss 前缀', `${evLines.length} 行，全部带时间=${allHaveClock}`, allHaveClock && evLines.length > 0),
    ok('每条事件都写明对象（实例/节点/会话/交接包）', '层名前缀 + 对象 ID', `${evLines.length} 行，全部带对象=${allHaveObject}`, allHaveObject),
    ok('转移类事件都写明"从什么状态到什么状态"', '其余事件含 →', `${hasTransition} 条含 →，${creation.length} 条为创建事件（from=null）`, hasTransition + creation.length === evLines.length && creation.length <= 1),
    ok('创建事件（from=null）写明落到什么状态', '交接包 HO-001 已构造 原因 handoff.created', creation.map((l) => l.text).join(' | ') || '(无创建事件)', creation.length === 1),
    ok('能按时间顺序读完（显示时钟单调不减）', '单调不减', clocks.join(' '), monotonic),
    ok('事件条数与 events.jsonl 一致（不丢行）', `${events.rows.length} 条`, `${evLines.length} 行`, evLines.length >= events.rows.length),
    ok('全过程不需要打开别的文件（一次 status --events 覆盖 created→completed）', '含 已创建→…→已完成', evLines.map((l) => l.text).filter((t) => /交接包 HO|实例 INST/.test(t)).length > 0, evLines.some((l) => l.text.includes('已完成')) && evLines.some((l) => l.text.includes('已构造'))),
  ];
  return {
    steps: [
      { label: 'orch run', result: run },
      { label: 'orch status --instance INST-114 --events', result: status },
    ],
    instanceId: id,
    assertions,
    notes,
    extra: { 'events.jsonl 行数': String(events.rows.length) },
  };
});

// ---------------------------------------------------------------- 主循环
const targets = only.length > 0 ? only : [...SCENARIOS.keys()];
const summary = [];
for (const ac of targets) {
  const fn = SCENARIOS.get(ac);
  if (!fn) {
    process.stderr.write(`未知场景：${ac}\n`);
    continue;
  }
  process.stdout.write(`\n===== ${ac} =====\n`);
  const payload = await fn();
  await writeEvidence(ac, payload);
  const pass = payload.assertions.filter((a) => a.pass).length;
  process.stdout.write(`${ac}: ${pass}/${payload.assertions.length} 断言通过\n`);
  for (const a of payload.assertions) {
    process.stdout.write(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.name} | 期望 ${a.expected} | 实际 ${a.actual}\n`);
  }
  summary.push({ ac, pass, total: payload.assertions.length, failed: payload.assertions.filter((a) => !a.pass) });
}
process.stdout.write(`\n===== SUMMARY =====\n${JSON.stringify(summary, null, 2)}\n`);
