/**
 * AC-23 · 三种方言都失败时按 §3.6 降级。
 *
 * Given 自控制一个 running 实例：T-001 done / T-002 running(phase=assigned) +
 * 会话 idle + 一张 HO-001 delivered 且 acceptedAt=null 的交接包（指向 T-002）。
 * caps=both + resume/load fail + newFail=1；**不写** `.mock/recovery` 标记：
 * newFail 一旦叠加该标记，会让 session/new 在 adapterFactory.create 阶段失败，
 * 核心按 host_unreachable 中断实例（recovery.failed），走不到 §3.6 会话级降级。
 * 方言选择与恢复降级仍由产品核心 + 真 mock ACP 适配器执行，用例只写 Given 现场。
 *
 * v4 口径：主断言 state.state === 'running'（halted === false 仅附带）；
 * recovery.dialect 恰 3 条（1 条 dialect=new/restored:false + 2 条 fallback:true）；
 * 会话条目只比 Given 多 1 条；无 node.dispatch（继续调度由 AC-31 / AC-60 覆盖）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-23', {
    scenario: 'all-dialects-failed',
    title: '三种方言都失败时按 §3.6 降级',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-23');
  c.root = root;
  try {
    const extra = {
      MAESTRO_MOCK_CAPS: 'both',
      MAESTRO_MOCK_RESUME: 'fail',
      MAESTRO_MOCK_LOAD: 'fail',
      MAESTRO_MOCK_NEW_FAIL: '1',
    };
    const env = buildRunEnv(process.env, { ...extra, MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' });
    const promptLog = path.join(root, 'prompt-log.ndjson');
    env.MAESTRO_MOCK_PROMPT_LOG = promptLog;
    const prepared = prepareScene({ root, scenario: 'backflow', reset: false, mockArgs: mockArgsFromEnv(env) });
    const cwd = path.join(root, 'demo-recovery');
    fs.mkdirSync(cwd, { recursive: true });

    // Given：手写 running 现场 + delivered 未 accepted 交接包（方言/降级仍由产品核心执行）。
    const stateFile = path.join(root, '.orch', 'instances', 'INST-001', 'state.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const stamp = new Date().toISOString();
    const givenHandoff = {
      handoffId: 'HO-001',
      instanceId: 'INST-001',
      edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      state: 'delivered',
      createdAt: stamp,
      pendingAt: null,
      deliveredAt: stamp,
      acceptedAt: null,
      consumedAt: null,
      rejectedAt: null,
      rejectReason: null,
      wakeConsumedAt: null,
      acceptedSignal: null,
      ambiguityWindowMs: null,
      defects: [],
      note: '等待复测',
      artifactRefs: null,
      round: 2,
      fromNodeId: 'T-001',
      toNodeId: 'T-002',
      retestRequirement: null,
      deliveryAttempts: 1,
      expiredAt: null,
      lastError: null,
    };
    const givenState = {
      schemaVersion: 2,
      instanceId: 'INST-001',
      coreGeneration: 'gen-before-recovery',
      createdAt: stamp,
      updatedAt: stamp,
      state: 'running',
      stateSince: stamp,
      template: 'code-loop',
      cwd,
      task: '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      halted: false,
      paused: false,
      rev: 1,
      counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      nodes: [
        { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: stamp, failure: null, note: null,
          verdict: { value: 'pass', defects: [] }, sessionId: 'mock-sess-dev-done', artifactRefs: [] },
        { nodeId: 'T-002', roleId: 'tester', round: 2, state: 'running', phase: 'assigned', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: null, failure: null, note: null,
          verdict: null, sessionId: 'mock-sess-retest', artifactRefs: [] },
      ],
      sessions: [
        { sessionId: 'mock-sess-retest', nodeId: 'T-002', round: 2, hostId: 'mock', state: 'idle',
          stateSince: stamp, createdAt: stamp, lastEventAt: stamp, toolName: null, turnId: 'turn-1',
          artifactRef: null, pendingPermission: null, quarantined: false },
      ],
      handoffs: [givenHandoff],
      escalations: [],
      health: { level: 'normal', reasons: [], computedAt: stamp, nodeTimeoutMs: 30000 },
    };
    fs.writeFileSync(stateFile, `${JSON.stringify(givenState, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(prepared.mockDir, 'cursor.json'), '{"next":1}\n', 'utf8');
    fs.rmSync(path.join(prepared.mockDir, 'cursor.lock'), { force: true });
    fs.rmSync(path.join(prepared.mockDir, 'exhausted'), { force: true });

    evidence(c, 'given', 'state.json', JSON.stringify(givenState, null, 2));
    evidence(c, 'given', 'handoffs-before.json', JSON.stringify([givenHandoff], null, 2));

    // When：冷启动触发 reconcileOnBoot（产品核心 + 真 mock ACP 适配器执行方言选择与降级）。
    const bootEnv = buildRunEnv(process.env, { ...extra, MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' });
    bootEnv.MAESTRO_MOCK_PROMPT_LOG = promptLog;
    const boots = [];
    for (let attempt = 0; attempt < 2 && !readState(root)?.recoveredAt; attempt += 1) {
      const boot = orch(root, ['status'], { env: bootEnv });
      boots.push({ attempt, exit: boot.exitCode });
      for (let i = 0; i < 80 && !readState(root)?.recoveredAt; i += 1) await nap(300);
    }
    for (let i = 0; i < 120 && !fs.existsSync(path.join(root, '.mock', 'paused')); i += 1) await nap(100);

    const afterState = readState(root);
    const events = readEvents(root);
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: bootEnv });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: bootEnv });
    const roleShow = orch(root, ['role', 'show', 'tester', '--instance', 'INST-001'], { env: bootEnv });
    const handoffList = orch(root, ['handoff', 'list', '--instance', 'INST-001'], { env: bootEnv });

    evidence(c, 'then', 'boots.json', JSON.stringify(boots, null, 2));
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(afterState, null, 2));
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'handoff-list.txt', handoffList.stdout);

    const dialectEvents = events.filter((e) => e.reason === 'recovery.dialect');
    // 裁-16b：fallback 标记在 detail 内，不是事件顶层。
    const fallbacks = dialectEvents.filter((e) => e.detail?.fallback === true);
    evidence(c, 'then', 'dialect-events.json', JSON.stringify(dialectEvents, null, 2));

    const node = (afterState?.nodes ?? []).find((n) => n.nodeId === 'T-002');
    const handoffAfter = (afterState?.handoffs ?? []).find((h) => h.handoffId === 'HO-001');

    check(c, 'Given：三方言均失败的恢复窗口构造成功（recoveredAt 落盘 + 交接包未 accepted）',
      Boolean(afterState?.recoveredAt)
        && givenHandoff.state === 'delivered' && givenHandoff.acceptedAt === null,
      JSON.stringify({ recoveredAt: afterState?.recoveredAt ?? null, given: givenHandoff }));
    check(c, 'Then：节点显示「已分配」（running + phase=assigned）',
      node?.state === 'running' && node?.phase === 'assigned', JSON.stringify(node));
    includes(c, 'Then：status 节点行显示「已分配」', status.stdout, '已分配');
    includes(c, '夹具：role show 显示「可用 · 活跃会话 0/1」', roleShow.stdout, '可用 · 活跃会话 0/1');
    includes(c, '夹具：handoff list 显示「待投递」', handoffList.stdout, '待投递');
    eq(c, '机检（主）：state.state === running（降级只降会话面，不把实例判为中断）',
      afterState?.state ?? null, 'running');
    eq(c, '机检（附带）：state.halted === false', afterState?.halted ?? null, false);
    check(c, '夹具：日志可见 resume→load 回退',
      fallbacks.some((e) => e.detail?.from === 'resume' && e.detail?.to === 'load'),
      JSON.stringify(fallbacks));
    check(c, '夹具：日志可见 load→new 回退',
      fallbacks.some((e) => e.detail?.from === 'load' && e.detail?.to === 'new'),
      JSON.stringify(fallbacks));
    // v4：recovery.dialect 恰 3 条 —— 1 条 dialect=new/restored:false + 2 条 fallback:true。
    const newDialectEvents = dialectEvents.filter(
      (e) => e.detail?.dialect === 'new' && e.detail?.restored === false,
    );
    eq(c, '夹具：recovery.dialect 恰 3 条', dialectEvents.length, 3);
    eq(c, '夹具：dialect=new 且 restored:false 恰 1 条', newDialectEvents.length, 1);
    eq(c, '夹具：fallback:true 回退行恰 2 条', fallbacks.length, 2);
    eq(c, '夹具：恢复后会话条目只比 Given 多 1 条（adapterFactory.create 预开的会话）',
      (afterState?.sessions ?? []).length, givenState.sessions.length + 1);
    check(c, '夹具：新会话条目 sessionId 与 dialect=new 事件的 sessionId 相同',
      (afterState?.sessions ?? []).some((s) => s.sessionId === newDialectEvents[0]?.detail?.sessionId),
      JSON.stringify({
        sessionIds: (afterState?.sessions ?? []).map((s) => s.sessionId),
        newDialect: newDialectEvents[0]?.detail ?? null,
      }));
    eq(c, '夹具：无 node.dispatch（继续调度由 AC-31 / AC-60 覆盖，不在本条断言）',
      events.filter((e) => e.reason === 'node.dispatch').length, 0);
    // 交接包 delivered → pending 的产品核心动作（由 recovery.redeliver 驱动，非手写）。
    eq(c, 'Then：交接包由 delivered 变为 pending', handoffAfter?.state ?? null, 'pending');

    note(c, 'Given 用受控 state.json（T-001 done / T-002 running(phase=assigned) + HO-001 delivered 未 accepted），'
      + '方言选择与恢复降级仍由产品核心连真 mock ACP 适配器执行。');
    note(c, '未写 .mock/recovery 标记：newFail 叠加该标记会让 session/new 在 adapterFactory.create 阶段失败，'
      + '核心按 host_unreachable 中断实例（recovery.failed），走不到 §3.6 会话级降级；去掉后 adapter 预开会话成功，'
      + 'resume/load 均失败，核心按 dialect=new 完成会话级降级（recovery.summary、节点已分配、角色可用、交接待投递）。');
    note(c, 'sessions 用 idle（非 thinking）：否则 dialect=new 落地后旧会话仍 thinking，'
      + 'role show 的「活跃会话 0/1」会变成 1/1。');
    note(c, 'v4 主断言改为 state.state === running：BR-22 的「不把实例判为中断」由「节点已分配 / 角色可用 · 0/1 / '
      + '交接待投递 + recovery.dialect 降级行」承载，实例容器保持 running 才能继续调度；halted === false 单独无判别力'
      + '（interrupted / suspended 的 halted 同为 false），只作附带断言。');
    note(c, 'v4 会话口径：recovery.dialect 恰 3 条（resume→load、load→new 两条 fallback:true + 一条 dialect=new/restored:false）；'
      + '真 adapterFactory.create 在 create 时预开会话，new 方言直接复用它，故恢复后会话条目只比 Given 多 1 条，'
      + '事件 sessionId 指向它。继续调度由 AC-31 / AC-60 覆盖，本条不断言 node.dispatch。');

    try {
      fs.writeFileSync(path.join(root, '.mock', 'release'), '1');
    } catch {
      /* 放行 */
    }
    try { orch(root, ['core', 'stop'], { env: bootEnv }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
