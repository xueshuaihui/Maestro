/**
 * AC-45 · 运行慢 + 节点超时 → 记超时失败并升级人工（BR-40）。
 *
 * Given：仅测试生效的图注入口 MAESTRO_TEST_GRAPH=<abs graph-timeout.json>（T-003 timeout:2），
 *   task-loop doc-slow-reviewer 让审核节点慢但进程存活。
 * When：超时到达。
 * Then：「节点 T-003 超时：按运行慢处理，已升级人工」；节点已升级；不重建会话。
 * 夹具：failed_reason==='timeout'、escalated、escalations 新增 1 条、session/new 次数不变。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import {
  prepareTaskScene, mockArgsFromEnv, buildRunEnv, DEFAULT_TASK,
} from '../../test/fixtures/task-loop-driver.mjs';
import { SESSION_FAILURE_TEXT, fill } from '../../src/cli/labels.js';

const GRAPH = path.join(REPO, 'test', 'fixtures', 'recovery', 'graph-timeout.json');
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-45', {
    scenario: 'slow-timeout',
    title: '运行慢 + 节点超时 → 记超时失败并升级人工',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-45');
  c.root = root;
  const promptLog = path.join(root, 'prompt-log.ndjson');
  let child = null;
  let env = null;
  try {
    env = buildRunEnv(process.env, {
      MAESTRO_TEST_SLOW_MS: '100',
      MAESTRO_TEST_GRAPH: GRAPH,
      MAESTRO_MOCK_PROMPT_LOG: promptLog,
    });
    const prepared = prepareTaskScene({
      root, scenario: 'doc-slow-reviewer', mockArgs: mockArgsFromEnv(env),
    });
    const cwd = path.join(root, 'demo-review');
    fs.mkdirSync(cwd, { recursive: true });
    evidence(c, 'given', 'fixture.json', JSON.stringify({
      graph: GRAPH, scenario: 'doc-slow-reviewer', hostPath: prepared.hostPath,
      slowMs: env.MAESTRO_TEST_SLOW_MS,
    }, null, 2));

    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd, '--task', DEFAULT_TASK,
      '--template', 'task-loop', '--host', 'dsh'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let runOut = '';
    child.stdout?.on('data', (b) => { runOut += b; });
    child.stderr?.on('data', (b) => { runOut += b; });

    const until = Date.now() + 30_000;
    let events = [];
    while (Date.now() < until) {
      events = readEvents(root);
      if (events.some((e) => e.reason === 'session.timeout')) break;
      await nap(100);
    }
    // 升级/挂起是在 `session.timeout` 之后才落盘的：超时事件先写，`escalations` 与实例
    // `suspended` 紧随其后（终验第 2 轮实测 events 止于 seq 31、state.updatedAt 只比
    // timeout 晚 5ms，#32~#35 在其后）。原实现读到 timeout 就立刻读 state.json，读到的是
    // 迁移前快照，把 4 条本该成立的核对项判成失败（假阴性）。这里改为等迁移落定再读；
    // 等待有上限，落不下来仍按原断言判红——**期望值一个也没改**。
    let settled = false;
    const settleUntil = Date.now() + 20_000;
    while (Date.now() < settleUntil) {
      const probe = readState(root);
      if (probe?.state === 'suspended' && (probe?.escalations ?? []).length >= 1) {
        settled = true;
        break;
      }
      await nap(100);
    }
    events = readEvents(root);
    const state = readState(root);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env }).stdout;
    const status = orch(root, ['status', '--instance', 'INST-001'], { env }).stdout;
    const graph = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env }).stdout;
    evidence(c, 'given', 'run-output.txt', runOut);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'settle.txt', `# 等待「升级 + 挂起」落定：settled=${settled}\n`
      + `# events 末条 seq=${events.at(-1)?.seq ?? '-'} ts=${events.at(-1)?.ts ?? '-'}\n`
      + `# state.updatedAt=${state?.updatedAt ?? '-'} state=${state?.state ?? '-'} `
      + `escalations=${(state?.escalations ?? []).length}\n`);
    evidence(c, 'then', 'instance-log.txt', log);
    evidence(c, 'then', 'status.txt', status);
    evidence(c, 'then', 'graph.txt', graph);

    const timeouts = events.filter((e) => e.reason === 'session.timeout');
    eq(c, '夹具：session.timeout 事件 1 条（注入图 timeout 生效）', timeouts.length, 1);
    eq(c, '夹具：session.slow 事件 1 条（先判运行慢）',
      events.filter((e) => e.reason === 'session.slow').length, 1);
    const detail = timeouts[0]?.detail ?? {};
    const timeoutLine = fill(SESSION_FAILURE_TEXT.timeout, detail);
    includes(c, 'Then：出现按 labels 渲染的「节点 T-003 超时：按运行慢处理，已升级人工」', log, timeoutLine);
    check(c, '夹具：超时节点是 T-003', detail.nodeId === 'T-003', JSON.stringify(detail));
    includes(c, 'Then：需求示例逐字「（节点 T-003 · 轮次 2/3）」', log, '（节点 T-003 · 轮次 2/3）');

    const node = (state?.nodes ?? []).find((n) => n.nodeId === 'T-003');
    eq(c, "夹具：failed_reason === 'timeout'", node?.failed_reason, 'timeout');
    eq(c, 'Then：审核节点显示「已升级」（escalated）', node?.state, 'escalated');
    eq(c, 'Then：实例挂起', state?.state, 'suspended');
    eq(c, '夹具：escalations 新增 1 条', (state?.escalations ?? []).length, 1);
    eq(c, '夹具：升级原因 reasonCode=timeout', state?.escalations?.[0]?.reasonCode, 'timeout');
    includes(c, 'Then：status 节点行显示「已升级」', status, '节点 T-003 审核者 已升级');

    eq(c, '夹具：没有 session.rebuilt（不重建会话）',
      events.filter((e) => e.reason === 'session.rebuilt').length, 0);
    eq(c, '夹具：没有 session.crash', events.filter((e) => e.reason === 'session.crash').length, 0);
    excludes(c, 'Then：不出现「正在重建会话」', log, '正在重建会话');
    const reviewSessions = (state?.sessions ?? []).filter((s) => s.nodeId === 'T-003');
    eq(c, '夹具：T-003 会话数不变（1，未被超时重开）', reviewSessions.length, 1);

    note(c, '口径冲突（同裁-14b）：注入图 graph-timeout.json 的 T-003 maxRounds=2，'
      + `实测 timeout 明细 ${JSON.stringify(detail)}；需求示例「轮次 2/3」按原文保留断言并如实判不通过。`);
    note(c, 'doc-slow-reviewer 的审核步骤 delayMs=60000 让进程存活且无新 update；'
      + 'MAESTRO_TEST_SLOW_MS=100 缩短慢阈值，timeout:2 为图声明的真实秒数。');
  } finally {
    try { child?.kill('SIGKILL'); } catch { /* 清理 */ }
    try { if (env) orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
    cleanupRoot(root);
  }
  return finish(c);
}
