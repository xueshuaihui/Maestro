// AC-15 ~ AC-26 夹具面验收执行器。
// 用法：node probe/acc-f-run.mjs [AC-15 ...]
// 所有项目根在 %TEMP%/maestro-acc-f/proj/<case>/；不触碰产品代码与产品面临时目录。
import fs from 'node:fs';
import path from 'node:path';

import {
  EVID,
  PROJ_ROOT,
  REPO,
  makeJudgment,
  contains,
  eventsPathOf,
  killCore,
  listNodeProcesses,
  makeJudgment as _mj,
  pickEvents,
  prepareCase,
  readEvents,
  readEventsRaw,
  readState,
  runAttemptTransition,
  runOrch,
  runProbe,
  saveEvidence,
  sleep,
  startOrch,
  stateExcerpt,
  stopCore,
  waitFor,
  waitHandoff,
  waitSession,
  writeHostConfig,
} from './acc-f-lib.mjs';

const WANT = process.argv.slice(2).filter((x) => !x.startsWith('-'));
const only = (id) => WANT.length === 0 || WANT.includes(id);

const TASK_WITH_ARTIFACT = '写一段 200 字的产品说明，保存到 out/intro.md';
const TASK_PLAIN = '写一段说明，完成后直接结束。';

function snapRun(handle) {
  return {
    command: handle.rec.command,
    cwd: handle.rec.cwd,
    exitCode: handle.rec.exitCode,
    stdout: handle.rec.stdout,
    stderr: handle.rec.stderr,
    elapsedMs: handle.rec.elapsedMs,
  };
}

async function settle(handle, timeoutMs = 60_000) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const out = await Promise.race([handle.done, timeout]);
  clearTimeout(timer);
  if (out === null && handle.rec.exitCode === null) {
    try {
      handle.child.kill();
    } catch {
      // ignore
    }
  }
  return snapRun(handle);
}

function sessionEvents(events) {
  return events.filter((ev) => ev?.object === 'session' && ev?.result === 'applied');
}

function findEvent(events, pred) {
  return events.find(pred) ?? null;
}

function eventSummary(ev) {
  if (!ev) return null;
  return {
    seq: ev.seq,
    ts: ev.ts,
    object: ev.object,
    objectId: ev.objectId,
    from: ev.from,
    to: ev.to,
    result: ev.result,
    reason: ev.reason,
    detail: ev.detail,
  };
}

const summary = [];

function record(id, meta, commands, states, eventsRaw, judgment) {
  const files = saveEvidence(id, { meta, commands, states, eventsRaw });
  summary.push({ id, verdict: judgment.verdict, failed: judgment.failed, files });
  console.error(
    `[${id}] ${judgment.verdict}${judgment.failed.length ? `（失败：${judgment.failed.join(',')}）` : ''}`,
  );
}

// ------------------------------------------------------------------ AC-15
async function ac15() {
  const root = prepareCase('AC-15', ['--hold-session']);
  const commands = [];
  let run = null;
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_WITH_ARTIFACT]);
    await waitSession(root, 'INST-001', (s, se) => se.state === 'idle' && s.handoff?.state === 'delivered', '会话建立且已投递');
    await sleep(300);
    const st = runOrch(root, ['status', '--instance', 'INST-001']);
    commands.push({ label: 'status（--hold-session 停住、未接任务）', ...st });

    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');

    const cancel = runOrch(root, ['cancel', '--instance', 'INST-001']);
    commands.push({ label: 'cancel（收尾，避免留孤儿）', ...cancel });
    commands.push({ label: 'orch run（后台，--hold-session）', ...(await settle(run, 20_000)) });

    const se = state?.session ?? {};
    const thinkingEvents = events.filter((ev) => ev.object === 'session' && ev.to === 'thinking');
    const probe = runProbe({ switches: '--hold-session', observe: 'session-state' });
    commands.push({ label: 'probe-adapter --observe session-state', ...probe });

    const checks = [
      { id: 'status 显示 会话 空闲', ok: contains(st.stdout, '会话 空闲'), actual: st.stdout },
      { id: 'status 不出现 会话 执行中', ok: !contains(st.stdout, '会话 执行中'), actual: st.stdout },
      { id: 'state.session.state = idle', ok: se.state === 'idle', actual: se.state },
      { id: '无 session→thinking 事件', ok: thinkingEvents.length === 0, actual: thinkingEvents.map(eventSummary) },
      {
        id: 'probe 观察值为 idle 且 observedState 为 null（未自证）',
        ok: probe.json?.session?.state === 'idle' && probe.json?.observedState === null,
        actual: probe.json,
      },
    ];
    record(
      'AC-15',
      {
        id: 'AC-15',
        title: '会话建好但没接任务是空闲',
        face: '夹具',
        root,
        switches: ['--hold-session'],
        judgment: makeJudgment(checks),
        notes: ['--hold-session 让 prompt 收到后完全不发帧，复现“会话已建、未接任务”窗口。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-16
async function ac16() {
  const root = prepareCase('AC-16', ['--slow-tool', 'write', '--turn-delay-ms', '5000']);
  const commands = [];
  let run = null;
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN]);
    await waitSession(root, 'INST-001', (_s, se) => se.state === 'tool_running', '会话进入 tool_running');
    const st = runOrch(root, ['status', '--instance', 'INST-001']);
    commands.push({ label: 'status（tool_running 窗口内）', ...st });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');

    const probe = runProbe({ switches: '--slow-tool write --turn-delay-ms 800', observe: 'tool-name' });
    commands.push({ label: 'probe-adapter --observe tool-name', ...probe });
    commands.push({ label: 'orch run（后台，--slow-tool write --turn-delay-ms 5000）', ...(await settle(run, 30_000)) });

    const se = state?.session ?? {};
    const checks = [
      {
        id: '会话行 = 执行中 · 调用工具（write）',
        ok: /会话 执行中 · 调用工具（write）/.test(st.stdout),
        actual: st.stdout,
      },
      { id: '工具名非空白', ok: typeof se.toolName === 'string' && se.toolName.trim().length > 0, actual: se.toolName },
      { id: 'state.session.toolName = write', ok: se.toolName === 'write', actual: se.toolName },
      {
        id: 'probe 观察到 tool_running + 工具名 write',
        ok: probe.json?.session?.state === 'tool_running' && probe.json?.session?.toolName === 'write',
        actual: probe.json?.session,
      },
    ];
    record(
      'AC-16',
      {
        id: 'AC-16',
        title: '调工具时看得见工具名',
        face: '夹具',
        root,
        switches: ['--slow-tool', 'write', '--turn-delay-ms', '5000'],
        judgment: makeJudgment(checks),
        notes: ['--turn-delay-ms 撑宽 tool_call 到 completed 之间的观察窗口；probe 另起一次自带 800ms 窗口。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-17
async function ac17() {
  const root = prepareCase('AC-17', ['--permission', 'ask']);
  const commands = [];
  let run = null;
  const env = { MAESTRO_PERMISSION_POLICY: 'hold' };
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN], { env });
    await waitSession(root, 'INST-001', (_s, se) => se.state === 'waiting_input', '会话进入 waiting_input（hold）');
    await sleep(250);
    const st = runOrch(root, ['status', '--instance', 'INST-001'], { env });
    commands.push({ label: 'status（policy=hold + permission=ask）', ...st });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');

    commands.push({ label: 'cancel（hold 收尾）', ...runOrch(root, ['cancel', '--instance', 'INST-001'], { env }) });
    commands.push({ label: 'orch run（后台，policy=hold）', ...(await settle(run, 20_000)) });

    const se = state?.session ?? {};
    const node = state?.node ?? {};
    const permEvent = findEvent(
      events,
      (ev) => ev.object === 'session' && ev.to === 'waiting_input' && ev.reason === 'permission.requested',
    );
    const checks = [
      { id: '会话行 = 等待审批：write', ok: contains(st.stdout, '会话 等待审批：write'), actual: st.stdout },
      { id: '节点行仍 = 执行中', ok: contains(st.stdout, '节点 执行中'), actual: st.stdout },
      { id: '节点未跳到 已完成', ok: !contains(st.stdout, '节点 已完成'), actual: st.stdout },
      { id: 'state.session.state = waiting_input', ok: se.state === 'waiting_input', actual: se.state },
      { id: 'state.node.state = running（BR-03）', ok: node.state === 'running', actual: node.state },
      { id: 'pendingPermission.action = write', ok: se.pendingPermission?.action === 'write', actual: se.pendingPermission },
      { id: '有 session→waiting_input 事件（permission.requested）', ok: Boolean(permEvent), actual: eventSummary(permEvent) },
    ];
    record(
      'AC-17',
      {
        id: 'AC-17',
        title: '等待审批时节点仍在执行中',
        face: '夹具',
        root,
        switches: ['--permission=ask'],
        env,
        judgment: makeJudgment(checks),
        notes: ['真实宿主写 cwd 内文件不触发审批（requirement v5 已注明），故本项只走夹具。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-18
async function ac18() {
  const root = prepareCase('AC-18', ['--permission', 'ask']);
  const commands = [];
  const env = { MAESTRO_PERMISSION_POLICY: 'reject' };
  try {
    const run = runOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN], {
      env,
      timeoutMs: 40_000,
    });
    commands.push({ label: 'orch run（policy=reject + permission=ask）', ...run });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');

    const node = state?.node ?? {};
    const session = state?.session ?? {};
    const handoff = state?.handoff ?? {};
    const rejectedEvent = findEvent(events, (ev) => ev.object === 'handoff' && ev.to === 'rejected');
    const deniedEvent = findEvent(events, (ev) => ev.object === 'node' && ev.to === 'failed');

    const checks = [
      { id: '输出含 审批被拒绝，任务中止于 write', ok: contains(run.stdout, '审批被拒绝，任务中止于 write'), actual: run.stdout },
      { id: 'step 不是 null', ok: !contains(run.stdout, '中止于 null') && !contains(run.stdout, '中止于 ?'), actual: run.stdout },
      { id: '节点 = 失败', ok: node.state === 'failed', actual: node.state },
      { id: 'node.failure.code = PERMISSION_DENIED', ok: node.failure?.code === 'PERMISSION_DENIED', actual: node.failure },
      { id: '交接包 = 已拒绝', ok: handoff.state === 'rejected', actual: handoff.state },
      { id: '拒绝原因 = 审批被拒（permission_denied）', ok: handoff.rejectReason === 'permission_denied', actual: handoff.rejectReason },
      { id: '会话收敛到 idle', ok: session.state === 'idle', actual: session.state },
      { id: '事件含 handoff→rejected（审批被拒）', ok: Boolean(rejectedEvent) && rejectedEvent?.detail?.reason === 'permission_denied', actual: eventSummary(rejectedEvent) },
      { id: '事件含 node→failed', ok: Boolean(deniedEvent), actual: eventSummary(deniedEvent) },
    ];
    record(
      'AC-18',
      {
        id: 'AC-18',
        title: '审批被拒时交接包是已拒绝',
        face: '夹具',
        root,
        switches: ['--permission=ask'],
        env,
        judgment: makeJudgment(checks),
        notes: ['用环境变量 MAESTRO_PERMISSION_POLICY=reject 让核心对审批请求回 reject-once；--permission=ask 保证审批请求真的发生。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-19
async function ac19() {
  const root = prepareCase('AC-19', ['--noise-on-session-new', '--accept-delay-ms', '3000']);
  const commands = [];
  let run = null;
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN]);
    await waitHandoff(root, 'INST-001', (h) => h.state === 'delivered', '交接包已投递');
    await sleep(600); // 让 session/new 后立刻发出的无关刷新消息到达
    const st = runOrch(root, ['status', '--instance', 'INST-001']);
    commands.push({ label: 'status（噪声已到、目标尚未开始处理任务）', ...st });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');

    // 探针需要一条“交付之后、首个 turn 事件之前”的噪声才能机读采样：
    // --noise-on-session-new 的噪声在 delivered 之前到达（同样必须被忽略），
    // --noise-on-prompt 的噪声在 delivered 之后到达（用于断言它不改变 delivered）。
    const probe = runProbe({
      switches: '--noise-on-session-new --noise-on-prompt --accept-delay-ms 1500',
      observe: 'handoff',
    });
    commands.push({ label: 'probe-adapter --observe handoff', ...probe });
    commands.push({ label: 'orch run（后台，噪声 + 3000ms 接受延迟）', ...(await settle(run, 30_000)) });
    const finalEvents = readEvents(root, 'INST-001');

    const handoff = state?.handoff ?? {};
    const acceptedEvent = findEvent(finalEvents, (ev) => ev.object === 'handoff' && ev.to === 'accepted');
    const NOISE = new Set(['usage_update', 'available_commands_update']);
    const checks = [
      { id: 'status 交接包 = 已投递', ok: contains(st.stdout, '交接包 HO-001  已投递'), actual: st.stdout },
      { id: 'status 不出现 已接受', ok: !contains(st.stdout, '已接受'), actual: st.stdout },
      { id: 'state.handoff.state = delivered', ok: handoff.state === 'delivered', actual: handoff.state },
      {
        id: 'probe：交付后首条噪声到达时 handoff 仍 = delivered',
        ok: probe.json?.handoff?.state === 'delivered',
        actual: probe.json?.handoff,
      },
      { id: 'probe 确实收到噪声帧（>=2：session/new + prompt）', ok: (probe.json?.noiseCount ?? 0) >= 2, actual: probe.json?.noiseCount },
      {
        id: 'probe：噪声之后 turn 真的发生、最终才 accepted',
        // probe 的 handoff 对象是“首条交付后噪声到达时”的快照（state=delivered、acceptedSignal=null 属预期）；
        // 最终状态单独放在 stateAfterTurn，配合 turnEventSeen 证明 accepted 来自真实 turn 事件。
        ok: probe.json?.handoff?.stateAfterTurn === 'accepted' && probe.json?.turnEventSeen === true,
        actual: { stateAfterTurn: probe.json?.handoff?.stateAfterTurn, turnEventSeen: probe.json?.turnEventSeen, turnEventCount: probe.json?.turnEventCount },
      },
      {
        id: '产品面 accepted 最终由 turn 事件触发（不是 usage/available_commands）',
        ok: Boolean(acceptedEvent) && !NOISE.has(acceptedEvent?.detail?.event),
        actual: eventSummary(acceptedEvent),
      },
    ];
    record(
      'AC-19',
      {
        id: 'AC-19',
        title: '只有对方真开始干活才算已接受',
        face: '夹具',
        root,
        switches: ['--noise-on-session-new', '--accept-delay-ms', '3000'],
        judgment: makeJudgment(checks),
        notes: [
          '产品面：--noise-on-session-new 在 session/new 返回后立刻推 available_commands_update；--accept-delay-ms 3000 保证采样时目标还没开始处理。',
          'probe 会自动补 --noise-on-prompt 与 250ms 接受延迟，因此“delivered 时收到噪声”的判定可被机读。',
        ],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-20
async function ac20() {
  const root = prepareCase('AC-20', ['--session-missing']);
  const commands = [];
  try {
    const run = runOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN], { timeoutMs: 40_000 });
    commands.push({ label: 'orch run（--session-missing）', ...run });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    const node = state?.node ?? {};

    const MSG_INVALID = '会话已失效，需要重新创建';
    const MSG_BUSY = '该节点正在执行，本次未发起';
    const checks = [
      { id: `输出含「${MSG_INVALID}」`, ok: contains(run.stdout, MSG_INVALID), actual: run.stdout },
      { id: `输出不含「${MSG_BUSY}」`, ok: !contains(run.stdout, MSG_BUSY), actual: run.stdout },
      { id: '两条提示不是同一条（逐字不同）', ok: MSG_INVALID !== MSG_BUSY, actual: { MSG_INVALID, MSG_BUSY } },
      { id: 'node.failure.code = SESSION_INVALID', ok: node.failure?.code === 'SESSION_INVALID', actual: node.failure },
      { id: '节点 = 失败', ok: node.state === 'failed', actual: node.state },
      {
        id: '事件里没有把 SESSION_INVALID 记成 NODE_BUSY',
        ok: !events.some((ev) => ev?.detail?.code === 'NODE_BUSY'),
        actual: events.filter((ev) => ev?.detail?.code).map(eventSummary),
      },
    ];
    record(
      'AC-20',
      {
        id: 'AC-20',
        title: '会话失效与“正在执行”是两条不同提示',
        face: '夹具',
        root,
        switches: ['--session-missing'],
        judgment: makeJudgment(checks),
        notes: ['mock 的 session/new 正常返回 id 后立刻标记 closed，后续 prompt 回 -32602 unknown session。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-21
async function ac21() {
  const root = prepareCase('AC-21', ['--host-error']);
  const commands = [];
  try {
    const run = runOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN], { timeoutMs: 40_000 });
    commands.push({ label: 'orch run（--host-error）', ...run });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    const node = state?.node ?? {};
    const handoff = state?.handoff ?? {};
    const RAW = 'mock-host: upstream model request failed (code 500)';
    const failedEvent = findEvent(events, (ev) => ev.object === 'node' && ev.to === 'failed');

    const checks = [
      { id: `输出含「执行失败：${RAW}」`, ok: contains(run.stdout, `执行失败：${RAW}`), actual: run.stdout },
      { id: '宿主原文未被改写/截断', ok: state?.hostRaw?.lastError?.message === RAW, actual: state?.hostRaw?.lastError },
      { id: '节点 = 失败', ok: node.state === 'failed', actual: node.state },
      { id: '能看出停在哪一步（节点 T-001 执行中→失败）', ok: Boolean(failedEvent) && failedEvent?.objectId === 'T-001', actual: eventSummary(failedEvent) },
      { id: '交接包不显示已完成', ok: !contains(run.stdout, '交接包 HO-001  已完成') && handoff.state !== 'consumed', actual: { stdout: run.stdout, handoffState: handoff.state } },
      { id: '交接包 = 已拒绝', ok: handoff.state === 'rejected', actual: handoff.state },
    ];
    record(
      'AC-21',
      {
        id: 'AC-21',
        title: '执行失败保留宿主原文与出错步骤',
        face: '夹具',
        root,
        switches: ['--host-error'],
        judgment: makeJudgment(checks),
        notes: ['“停在哪一步”在本迭代只有单节点，由节点 T-001 的 running→failed 事件与「节点 失败」行共同表达。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-22
async function ac22() {
  const root = prepareCase('AC-22', ['--unknown-error']);
  const commands = [];
  try {
    const run = runOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN], { timeoutMs: 40_000 });
    commands.push({ label: 'orch run（--unknown-error）', ...run });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    const RAW = 'mock-host: E_QUASAR_7719 unrecognized failure token';
    const line = `未知错误：${RAW}`;
    const stored = state?.hostRaw?.lastError?.message;
    const checks = [
      { id: `输出含「${line}」`, ok: contains(run.stdout, line), actual: run.stdout },
      { id: '原文与 mock 固定串逐字一致', ok: stored === RAW, actual: stored },
      { id: '原文长度未被截断', ok: typeof stored === 'string' && stored.length === RAW.length, actual: { got: stored?.length, want: RAW.length } },
      { id: '节点 = 失败 且 code = UNKNOWN_ERROR', ok: state?.node?.state === 'failed' && state?.node?.failure?.code === 'UNKNOWN_ERROR', actual: state?.node },
    ];
    record(
      'AC-22',
      {
        id: 'AC-22',
        title: '没见过的错误原样透出',
        face: '夹具',
        root,
        switches: ['--unknown-error'],
        judgment: makeJudgment(checks),
        notes: ['mock 返回 -32099 + 生僻原文，核心归入 UNKNOWN_ERROR 并原样保留。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-23
async function ac23() {
  const root = prepareCase('AC-23', ['--turn-delay-ms', '12000']);
  const commands = [];
  let run = null;
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN]);
    const t0 = Date.now();
    await waitSession(root, 'INST-001', (_s, se) => se.state === 'tool_running', '进入 tool_running');
    // 必须真的撑过 10s 阈值
    while (Date.now() - t0 < 11_000) await sleep(200);
    const st = runOrch(root, ['status', '--instance', 'INST-001']);
    commands.push({ label: 'status（静默已超过 10s 阈值）', ...st });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    const idleMs = Date.now() - Date.parse(state?.session?.lastEventAt ?? '');
    commands.push({ label: 'orch run（后台，--turn-delay-ms 12000）', ...(await settle(run, 40_000)) });

    const checks = [
      { id: '会话仍显示 执行中', ok: contains(st.stdout, '会话 执行中'), actual: st.stdout },
      { id: '附带「无新事件」', ok: contains(st.stdout, '无新事件'), actual: st.stdout },
      { id: '附带已运行时长', ok: /已运行 \d+[sm]/.test(st.stdout), actual: st.stdout },
      { id: `已静默 > 10s（实测 ${Math.round(idleMs / 100) / 10}s）`, ok: idleMs > 10_000, actual: idleMs },
      { id: '没有出现「失败」', ok: !contains(st.stdout, '失败'), actual: st.stdout },
      { id: '没有出现「已失效」', ok: !contains(st.stdout, '已失效'), actual: st.stdout },
      { id: 'status --instance 走的是 stall 行（C-4）', ok: /会话 执行中 · 已运行 .*无新事件/.test(st.stdout), actual: st.stdout },
    ];
    record(
      'AC-23',
      {
        id: 'AC-23',
        title: '长时间没动静不判失败',
        face: '夹具',
        root,
        switches: ['--turn-delay-ms', '12000'],
        judgment: makeJudgment(checks),
        notes: ['mock 的 tool_call_update(in_progress) 保持 12s 不发新帧；采样点在第 11s。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-24
async function ac24() {
  const root = prepareCase('AC-24', ['--accept-delay-ms', '3000']);
  const commands = [];
  let run = null;
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN]);
    await waitHandoff(root, 'INST-001', (h) => h.state === 'delivered', '交接包已投递');
    const st = runOrch(root, ['status', '--instance', 'INST-001']);
    commands.push({ label: 'status（目标尚未开始处理）', ...st });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    const deliveredAt = Date.parse(state?.handoff?.deliveredAt ?? '');
    const waitedMs = Number.isFinite(deliveredAt) ? Date.now() - deliveredAt : null;
    commands.push({ label: 'orch run（后台，--accept-delay-ms 3000）', ...(await settle(run, 30_000)) });

    const checks = [
      { id: '交接包仍显示 已投递', ok: contains(st.stdout, '交接包 HO-001  已投递'), actual: st.stdout },
      { id: '显示等待时长', ok: /等待目标响应 · 已等待 \d+[sm]/.test(st.stdout), actual: st.stdout },
      { id: '没有出现 已过期', ok: !contains(st.stdout, '已过期'), actual: st.stdout },
      { id: '节点没有变成 失败', ok: !contains(st.stdout, '节点 失败') && state?.node?.state !== 'failed', actual: { stdout: st.stdout, nodeState: state?.node?.state } },
      { id: 'state.handoff.state = delivered', ok: state?.handoff?.state === 'delivered', actual: state?.handoff?.state },
      { id: `已等待 > 0（实测 ${waitedMs}ms）`, ok: Number.isFinite(waitedMs) && waitedMs > 0, actual: waitedMs },
    ];
    record(
      'AC-24',
      {
        id: 'AC-24',
        title: '目标迟迟不开始，也不判过期',
        face: '夹具',
        root,
        switches: ['--accept-delay-ms', '3000'],
        judgment: makeJudgment(checks),
        notes: ['--accept-delay-ms 3000 让 prompt 后 3s 才发首帧；采样在 delivered 后立即进行。'],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-25
async function ac25() {
  // 两个任务必须吃不同开关：INST-001 快速跑完并在 turn 结束后推噪声；
  // INST-002 用 6s 接受延迟撑出“它自己还没开始处理”的观察窗口。
  // 宿主配置在每次 run 的 claim 阶段读取，因此可以在 INST-001 启动后改配置。
  const root = prepareCase('AC-25', ['--noise-at-turn-end', '--turn-delay-ms', '1500']);
  const commands = [];
  let r1 = null;
  let r2 = null;
  try {
    r1 = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN]);
    // 交付→已接受的窗口只有几毫秒（首个 turn 帧立即到），不能等 handoff=delivered，
    // 否则必然采样不到；这里只等“会话已建立”，INST-002 紧接着发起。
    await waitSession(root, 'INST-001', (s) => Boolean(s.session), 'INST-001 会话已建立');

    // INST-001 仍在 turn 中：改配置给 INST-002，然后紧接着发起第二个任务
    writeHostConfig(root, ['--noise-at-turn-end', '--turn-delay-ms', '200', '--accept-delay-ms', '6000']);
    r2 = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-002', '--task', TASK_PLAIN]);
    await waitSession(root, 'INST-002', (_s, se) => se.state === 'idle', 'INST-002 会话建立且空闲');

    const done1 = await settle(r1, 30_000);
    commands.push({ label: 'INST-001 orch run（--noise-at-turn-end --turn-delay-ms 1500）', ...done1 });
    await sleep(500); // 等 INST-001 的收尾噪声到达

    const t2 = readState(root, 'INST-002');
    const sinceCreatedMs = Date.now() - Date.parse(t2?.session?.createdAt ?? '');
    const st = runOrch(root, ['status', '--instance', 'INST-002']);
    commands.push({ label: `status INST-002（发起后 ${sinceCreatedMs}ms，第一个任务已结束、收尾噪声已发）`, ...st });
    const s2 = readState(root, 'INST-002');
    const e2During = readEvents(root, 'INST-002'); // 采样时的事件（应还没有自己的 turn）
    const e1 = readEvents(root, 'INST-001');
    const done2 = await settle(r2, 40_000);
    commands.push({ label: 'INST-002 orch run（--accept-delay-ms 6000）', ...done2 });
    const e2 = readEvents(root, 'INST-002');

    // 直接用探针证明 --noise-at-turn-end 真的在 turn 结束后发噪声帧
    const probeNoise = runProbe({ switches: '--noise-at-turn-end --turn-delay-ms 200', observe: 'handoff' });
    commands.push({ label: 'probe-adapter --observe handoff（证明 turn 结束噪声确实存在）', ...probeNoise });

    const ses2 = sessionEvents(e2);
    const noiseNames = new Set(['usage_update', 'available_commands_update']);
    const noiseDriven = ses2.filter((ev) => noiseNames.has(ev?.detail?.event));
    const firstTurnIdx = e2.findIndex(
      (ev) => ev.object === 'session' && ['agent_thought_chunk', 'agent_message_chunk', 'tool_call', 'tool_call_update'].includes(ev?.detail?.event),
    );

    const checks = [
      { id: '采样时 INST-002 实例仍在运行（不是已完成的终态假象）', ok: /实例 INST-002 · 运行中/.test(st.stdout), actual: st.stdout },
      { id: `采样发生在 INST-002 自己开始处理之前（created→采样 ${Math.round(sinceCreatedMs)}ms < 6000ms）`, ok: sinceCreatedMs < 6000, actual: sinceCreatedMs },
      { id: 'INST-002 会话显示 空闲', ok: contains(st.stdout, '会话 空闲'), actual: st.stdout },
      { id: 'INST-002 不显示 会话 执行中', ok: !contains(st.stdout, '会话 执行中'), actual: st.stdout },
      { id: 'state(INST-002).session.state = idle', ok: s2?.session?.state === 'idle', actual: s2?.session?.state },
      { id: 'INST-002 无由噪声触发的会话状态事件', ok: noiseDriven.length === 0, actual: noiseDriven.map(eventSummary) },
      {
        id: '采样时 INST-002 还没有任何 thinking/tool_running 事件（确实没开始处理）',
        ok: e2During.filter((ev) => ev.object === 'session' && ['thinking', 'tool_running'].includes(ev.to)).length === 0,
        actual: e2During.filter((ev) => ev.object === 'session').map(eventSummary),
      },
      { id: 'INST-002 后来确实有自己的首个 turn 事件', ok: firstTurnIdx >= 0, actual: firstTurnIdx },
      {
        id: 'INST-001 确实走完并产生 turn 结束噪声（probe noiseCount >= 1）',
        ok: e1.some((ev) => ev.object === 'instance' && ev.to === 'completed') && (probeNoise.json?.noiseCount ?? 0) >= 1,
        actual: { inst1Completed: e1.filter((ev) => ev.object === 'instance').map(eventSummary), noiseCount: probeNoise.json?.noiseCount },
      },
      {
        id: 'INST-002 的会话事件全部属于它自己的 sessionId（无串台）',
        ok: ses2.every((ev) => ev.objectId === s2?.session?.sessionId),
        actual: ses2.map((ev) => ev.objectId),
      },
    ];
    record(
      'AC-25',
      {
        id: 'AC-25',
        title: '上一个任务的收尾不影响下一个',
        face: '夹具',
        root,
        switches: [
          'INST-001: --noise-at-turn-end --turn-delay-ms 1500',
          'INST-002: --noise-at-turn-end --turn-delay-ms 200 --accept-delay-ms 6000',
        ],
        judgment: makeJudgment(checks),
        sample: {
          atMsAfterCreate: sinceCreatedMs,
          status: st.stdout,
          state: stateExcerpt(s2),
          instance002EventCountAtSample: e2During.length,
        },
        notes: [
          '构造：INST-001 在 turn 结束后推 usage/commands 噪声；INST-002 紧接着发起且 6s 内不开始处理，采样点在其发起后约 2s。',
          '本迭代每次 run 都新建会话（fresh），因此第一个任务的 update 不可能路由到第二个会话；本条同时核对事件层没有串台。',
        ],
      },
      commands,
      { 'INST-001': stateExcerpt(readState(root, 'INST-001')), 'INST-002': stateExcerpt(readState(root, 'INST-002')) },
      { 'INST-001': readEventsRaw(root, 'INST-001'), 'INST-002': readEventsRaw(root, 'INST-002') },
      makeJudgment(checks),
    );
  } finally {
    if (r1) await settle(r1, 5_000);
    if (r2) await settle(r2, 5_000);
    stopCore(root);
  }
}

/** 附带（用户提示的口径）：cancel 后迟到 update 不得把会话翻回执行中。 */
async function ac25CancelLateUpdate() {
  const root = prepareCase('AC-25-cancellate', ['--slow-tool', 'write', '--turn-delay-ms', '8000']);
  const commands = [];
  let run = null;
  try {
    run = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN]);
    await waitSession(root, 'INST-001', (_s, se) => se.state === 'tool_running', '进入 tool_running');
    const cancel = runOrch(root, ['cancel', '--instance', 'INST-001']);
    commands.push({ label: 'cancel（tool_running 中）', ...cancel });
    const cancelledAt = Date.now();
    await sleep(1500); // 让 mock 的迟到 tool_call_update 到达
    const st = runOrch(root, ['status', '--instance', 'INST-001']);
    commands.push({ label: 'status（cancel 后 1.5s，迟到帧已到）', ...st });
    const state = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    commands.push({ label: 'orch run（后台）', ...(await settle(run, 20_000)) });

    // 只看 cancel 命令返回之后产生的事件（取消前那次 tool_running 是正常进展，不算迟到帧）
    const lateSessionEvents = events.filter(
      (ev) => ev.object === 'session' && ev.to === 'tool_running' && Date.parse(ev.ts ?? '') > cancelledAt,
    );
    const checks = [
      { id: '会话回到 空闲（不显示执行中）', ok: contains(st.stdout, '会话 空闲') && !contains(st.stdout, '会话 执行中'), actual: st.stdout },
      { id: '节点 = 已取消', ok: state?.node?.state === 'cancelled', actual: state?.node?.state },
      { id: '交接包 = 已拒绝（已撤回）', ok: state?.handoff?.state === 'rejected' && state?.handoff?.rejectReason === 'withdrawn', actual: state?.handoff },
      { id: '取消后没有新的 session→tool_running 事件', ok: lateSessionEvents.length === 0, actual: lateSessionEvents.map(eventSummary) },
      { id: `迟到窗口已过（${Date.now() - cancelledAt}ms）`, ok: Date.now() - cancelledAt > 1000, actual: Date.now() - cancelledAt },
    ];
    record(
      'AC-25.supplement',
      {
        id: 'AC-25.supplement',
        title: '取消后的迟到 update 不改回执行中（用户提示口径，BR-06 相邻）',
        face: '夹具',
        root,
        switches: ['--slow-tool', 'write', '--turn-delay-ms', '8000'],
        judgment: makeJudgment(checks),
        notes: [
          '这条不是 requirement 里 AC-25 的 Gherkin 文本（AC-25 原文是“上一个任务的收尾不影响下一个”），作为补充观察记录。',
        ],
      },
      commands,
      { 'INST-001': stateExcerpt(state) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    if (run) await settle(run, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ AC-26
async function ac26() {
  const root = prepareCase('AC-26', ['--write-ref', 'out/intro.md']);
  const commands = [];
  try {
    const run = runOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_WITH_ARTIFACT], { timeoutMs: 60_000 });
    commands.push({ label: 'orch run（--write-ref out/intro.md，先造出 done）', ...run });
    const before = readState(root, 'INST-001');
    const attempt = runAttemptTransition(root, 'INST-001', 'node', 'done', 'running');
    commands.push({ label: 'attempt-transition --object node --from done --to running', ...attempt });
    const after = readState(root, 'INST-001');
    const events = readEvents(root, 'INST-001');
    const rejected = events.find(
      (ev) => ev.object === 'node' && ev.result === 'rejected' && ev.from === 'done' && ev.to === 'running',
    );

    const checks = [
      { id: '前置：节点确实是 done', ok: before?.node?.state === 'done', actual: before?.node?.state },
      { id: 'attempt-transition 退出码 = 0（拒绝成功）', ok: attempt.exitCode === 0, actual: attempt.exitCode },
      { id: '夹具输出含「已拒绝」', ok: contains(attempt.stdout, '已拒绝'), actual: attempt.stdout },
      { id: '拒绝码 = ILLEGAL_TRANSITION', ok: contains(attempt.stdout, 'ILLEGAL_TRANSITION'), actual: attempt.stdout },
      { id: '状态保持 done', ok: after?.node?.state === 'done', actual: after?.node?.state },
      {
        id: 'events.jsonl 有 result=rejected 的拒绝迁移',
        ok: Boolean(rejected) && rejected?.reason === 'illegal_transition',
        actual: eventSummary(rejected),
      },
    ];
    record(
      'AC-26',
      {
        id: 'AC-26',
        title: '非法状态迁移被拒绝',
        face: '夹具',
        root,
        switches: ['--write-ref', 'out/intro.md', '+ test/fixtures/attempt-transition.mjs'],
        judgment: makeJudgment(checks),
        notes: ['requirement §3.3 列的 --illegal-transition 开关在 mock-acp-agent.js 中不存在；按任务书使用 attempt-transition.mjs 走同一 store/bus。'],
      },
      commands,
      { 'INST-001.before': stateExcerpt(before), 'INST-001.after': stateExcerpt(after) },
      { 'INST-001': readEventsRaw(root, 'INST-001') },
      makeJudgment(checks),
    );
  } finally {
    stopCore(root);
  }
}

// ------------------------------------------------------------------ NFR-03
async function nfr03() {
  const root = prepareCase('NFR-03', ['--turn-delay-ms', '0']);
  const commands = [];
  const states = {};
  const eventsRaw = {};
  const perRun = [];
  try {
    const t0 = Date.now();
    for (let i = 1; i <= 10; i += 1) {
      const id = `INST-${String(i).padStart(3, '0')}`;
      const run = runOrch(root, ['run', '--cwd', './demo', '--instance', id, '--task', TASK_PLAIN], { timeoutMs: 45_000 });
      const state = readState(root, id);
      const events = readEvents(root, id);
      perRun.push({
        instanceId: id,
        exitCode: run.exitCode,
        elapsedMs: run.elapsedMs,
        state: stateExcerpt(state),
        eventCount: events.length,
        stdoutTail: run.stdout.trim().split('\n').slice(-6),
      });
      commands.push({ label: `第 ${i} 次 orch run`, ...run });
      states[id] = stateExcerpt(state);
      eventsRaw[id] = readEventsRaw(root, id);
    }
    const totalMs = Date.now() - t0;
    const list = runOrch(root, ['status']);
    commands.push({ label: 'status（列出全部实例）', ...list });
    const one = runOrch(root, ['status', '--instance', 'INST-005', '--events']);
    commands.push({ label: 'status --instance INST-005 --events', ...one });

    const checks = [];
    for (const r of perRun) {
      const s = r.state;
      checks.push({ id: `${r.instanceId} 退出码 0`, ok: r.exitCode === 0, actual: r.exitCode });
      checks.push({
        id: `${r.instanceId} 五类信息齐全`,
        ok: Boolean(s?.instanceId && s?.node?.nodeId && s?.session?.sessionId && s?.handoff?.handoffId && r.eventCount > 0),
        actual: { instanceId: s?.instanceId, node: s?.node?.nodeId, session: s?.session?.sessionId, handoff: s?.handoff?.handoffId, events: r.eventCount },
      });
      checks.push({ id: `${r.instanceId} 节点 done / 交接包 consumed`, ok: s?.node?.state === 'done' && s?.handoff?.state === 'consumed', actual: { node: s?.node?.state, handoff: s?.handoff?.state } });
    }
    const listed = (list.stdout.match(/^实例 INST-\d+ ·/gm) ?? []).length;
    checks.push({ id: 'status 列出 10 个实例', ok: listed === 10, actual: listed });
    checks.push({ id: 'status --instance --events 能查到事件', ok: /交接包 HO-001/.test(one.stdout) && /\d{2}:\d{2}:\d{2}/.test(one.stdout), actual: one.stdout.split('\n').slice(0, 8) });

    record(
      'NFR-03',
      {
        id: 'NFR-03',
        title: '连续 10 个任务：0 次状态错乱、0 条记录缺失',
        face: '夹具',
        root,
        switches: ['--turn-delay-ms', '0'],
        runs: 10,
        totalMs,
        judgment: makeJudgment(checks),
        notes: ['每个实例独立跑完；逐实例核对 实例/节点/会话/交接包/事件 五项。'],
      },
      commands,
      states,
      eventsRaw,
      makeJudgment(checks),
    );
  } finally {
    stopCore(root);
  }
}

// ------------------------------------------------------------------ NFR-04 / NFR-06
async function nfr0406() {
  const root = prepareCase('NFR-04', []);
  const commands = [];
  let run2 = null;
  try {
    // 先造一个已完成实例，确保“重启后能查全”
    const run1 = runOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-001', '--task', TASK_PLAIN], { timeoutMs: 45_000 });
    commands.push({ label: 'INST-001 run（先完成一个）', ...run1 });

    // 换夹具开关：让第二个任务在 tool_running 停 8s
    writeHostConfig(root, ['--turn-delay-ms', '8000', '--slow-tool', 'write']);
    run2 = startOrch(root, ['run', '--cwd', './demo', '--instance', 'INST-002', '--task', TASK_PLAIN]);
    await waitSession(root, 'INST-002', (_s, se) => se.state === 'tool_running', 'INST-002 进入 tool_running');

    const eventsBeforeKill = readEvents(root, 'INST-002');
    const preGen = readState(root, 'INST-002')?.coreGeneration ?? null;
    const killAt = Date.now();
    const kill = killCore(root);
    commands.push({ label: 'taskkill /F 核心（核心 pid 来自 .orch/core.json）', exitCode: kill.exitCode, stdout: kill.output, stderr: '', command: `taskkill /F /PID ${kill.meta?.pid}` });
    const killedRun = await settle(run2, 20_000);
    commands.push({ label: 'INST-002 orch run（核心被强杀后自行收尾）', ...killedRun });

    await sleep(600);
    const list = runOrch(root, ['status'], { timeoutMs: 60_000 });
    commands.push({ label: 'status（重启核心，列出全部实例）', ...list });
    const st2 = runOrch(root, ['status', '--instance', 'INST-002', '--events']);
    commands.push({ label: 'status --instance INST-002 --events（重启后）', ...st2 });

    const after1 = readState(root, 'INST-001');
    const after2 = readState(root, 'INST-002');
    const ev1 = readEvents(root, 'INST-001');
    const ev2 = readEvents(root, 'INST-002');

    const runStartedNode = ev2.filter((ev) => ev.object === 'node' && ev.reason === 'run.started');
    // “重启后的新增事件”用核心代际区分：旧核心写的事件 gen = 本次 run 的 generation，
    // 重启后新核心写的事件 gen 不同（reconcile 的 interrupted 就是这个 gen）。
    const isPostRestart = (ev) =>
      preGen && typeof ev?.gen === 'string' ? ev.gen !== preGen : Date.parse(ev?.ts ?? '') > killAt;
    const nodeRunningAfterRestart = ev2.filter((ev) => isPostRestart(ev) && ev.object === 'node' && ev.to === 'running');
    const deliveredEvents = ev2.filter((ev) => ev.object === 'handoff' && ev.to === 'delivered');
    const restartExtra = ev2.filter((ev) => isPostRestart(ev));

    // 再等 2s 确认没有偷偷重跑
    const eventCountA = readEvents(root, 'INST-002').length;
    await sleep(2000);
    const eventCountB = readEvents(root, 'INST-002').length;
    const stateAfterWait = readState(root, 'INST-002');
    const procs = listNodeProcesses();

    const nfr04Checks = [
      { id: 'status 列出 INST-001', ok: contains(list.stdout, '实例 INST-001'), actual: list.stdout },
      { id: 'status 列出 INST-002 且标 已中断', ok: /实例 INST-002 · 已中断/.test(list.stdout), actual: list.stdout },
      { id: 'INST-001 仍为 已完成（5 项可查）', ok: after1?.state === 'completed' && after1?.node?.state === 'done' && Boolean(after1?.session && after1?.handoff) && ev1.length > 0, actual: stateExcerpt(after1) },
      { id: 'INST-002 状态 = interrupted', ok: after2?.state === 'interrupted', actual: after2?.state },
      { id: 'INST-002 的节点/会话/交接包/事件仍可查', ok: Boolean(after2?.node && after2?.session && after2?.handoff) && ev2.length > 0, actual: { node: after2?.node?.state, session: after2?.session?.state, handoff: after2?.handoff?.state, events: ev2.length } },
      { id: 'status --instance 显示停点', ok: /已中断 ｜ 停在节点/.test(st2.stdout), actual: st2.stdout },
    ];
    const nfr06Checks = [
      { id: '重启后没有新增 node→running 事件', ok: nodeRunningAfterRestart.length === 0, actual: nodeRunningAfterRestart.map(eventSummary) },
      { id: 'run.started（节点）只发生 1 次', ok: runStartedNode.length === 1, actual: runStartedNode.map(eventSummary) },
      { id: 'handoff delivered 只发生 1 次', ok: deliveredEvents.length === 1, actual: deliveredEvents.map(eventSummary) },
      { id: '重启后 2s 内事件数不再增长（未自动重跑）', ok: eventCountA === eventCountB, actual: { before: eventCountA, after: eventCountB } },
      { id: '实例保持 interrupted', ok: stateAfterWait?.state === 'interrupted', actual: stateAfterWait?.state },
      { id: '重启后的新增事件只有 interrupted 判定', ok: restartExtra.every((ev) => ev.to === 'interrupted' || ev.reason === 'core.gone' || ev.result === 'rejected'), actual: restartExtra.map(eventSummary) },
    ];

    record(
      'NFR-04',
      {
        id: 'NFR-04',
        title: '强杀核心后重启：实例/节点/会话/交接包/事件 5 项仍可查',
        face: '夹具',
        root,
        switches: ['--turn-delay-ms', '8000', '--slow-tool', 'write'],
        kill,
        judgment: makeJudgment(nfr04Checks),
        notes: ['强杀发生在 INST-002 的 tool_running 阶段（8s 窗口内），确保不是“刚好跑完”。'],
      },
      commands,
      { 'INST-001': stateExcerpt(after1), 'INST-002': stateExcerpt(after2) },
      { 'INST-001': readEventsRaw(root, 'INST-001'), 'INST-002': readEventsRaw(root, 'INST-002') },
      makeJudgment(nfr04Checks),
    );

    record(
      'NFR-06',
      {
        id: 'NFR-06',
        title: '中断后重开不偷偷重跑',
        face: '夹具',
        root,
        switches: ['--turn-delay-ms', '8000', '--slow-tool', 'write'],
        judgment: makeJudgment(nfr06Checks),
        notes: ['与 NFR-04 同一份现场；额外观察 2s 窗口内事件数不增长、run.started 次数不增加。'],
        nodeProcesses: procs,
      },
      commands,
      { 'INST-002': stateExcerpt(after2) },
      { 'INST-002': readEventsRaw(root, 'INST-002') },
      makeJudgment(nfr06Checks),
    );
  } finally {
    if (run2) await settle(run2, 5_000);
    stopCore(root);
  }
}

// ------------------------------------------------------------------ main
async function main() {
  fs.mkdirSync(PROJ_ROOT, { recursive: true });
  fs.mkdirSync(EVID, { recursive: true });
  const cases = [
    ['AC-15', ac15],
    ['AC-16', ac16],
    ['AC-17', ac17],
    ['AC-18', ac18],
    ['AC-19', ac19],
    ['AC-20', ac20],
    ['AC-21', ac21],
    ['AC-22', ac22],
    ['AC-23', ac23],
    ['AC-24', ac24],
    ['AC-25', ac25],
    ['AC-25.supplement', ac25CancelLateUpdate],
    ['AC-26', ac26],
    ['NFR-03', nfr03],
    ['NFR-04', nfr0406],
  ];
  for (const [id, fn] of cases) {
    if (!only(id)) continue;
    console.error(`\n=== ${id} ===`);
    try {
      await fn();
    } catch (err) {
      console.error(`[${id}] 执行异常：${err?.stack ?? err}`);
      summary.push({ id, verdict: '阻塞', error: String(err?.message ?? err) });
    }
  }
  fs.writeFileSync(path.join(EVID, '_fixture-run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.error(`\n完成 ${summary.length} 项；evidence 目录：${EVID}`);
}

main().catch((err) => {
  console.error(err?.stack ?? err);
  process.exit(1);
});
