/**
 * AC-46 · 运行慢且未声明超时 → 继续等待，不擅自失败（BR-40）。
 *
 * Given：内建 code-loop 图（节点无 timeout）；MAESTRO_MOCK_SLOW=1 让会话存活无进展。
 * When：等待超过慢阈值。
 * Then：只有「运行慢」提示；节点仍执行中；不失败/不升级；可自行 cancel。
 * 机检：instance graph 节点仍 running；failed_reason 不存在；session/new 次数不变。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch, baseEnv, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import {
  prepareScene, mockArgsFromEnv, buildRunEnv, DEFAULT_TASK,
} from '../../test/fixtures/code-loop-driver.mjs';
import { SESSION_FAILURE_TEXT, fill } from '../../src/cli/labels.js';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-46', {
    scenario: 'slow-no-timeout',
    title: '运行慢且未声明超时 → 继续等待，不擅自失败',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-46');
  c.root = root;
  let child = null;
  let env = null;
  try {
    env = buildRunEnv(process.env, { MAESTRO_MOCK_SLOW: '1', MAESTRO_TEST_SLOW_MS: '100' });
    const prepared = prepareScene({ root, scenario: 'pass', mockArgs: mockArgsFromEnv(env) });
    const cwd = path.join(root, 'demo-slow');
    fs.mkdirSync(cwd, { recursive: true });
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd, '--task', DEFAULT_TASK,
      '--template', 'code-loop', '--host', 'mock'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let runOut = '';
    child.stdout?.on('data', (b) => { runOut += b; });
    child.stderr?.on('data', (b) => { runOut += b; });

    const until = Date.now() + 30_000;
    let events = [];
    while (Date.now() < until) {
      events = readEvents(root);
      if (events.some((e) => e.reason === 'session.slow')) break;
      await nap(100);
    }
    // 再等若干慢 tick：确保「没有 timeout」不是因为还没走到判定。
    await nap(1500);
    events = readEvents(root);
    const state = readState(root);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env }).stdout;
    const graphJson = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env }).stdout;
    evidence(c, 'given', 'fixture.json', JSON.stringify({ hostPath: prepared.hostPath, slowMs: env.MAESTRO_TEST_SLOW_MS }, null, 2));
    evidence(c, 'given', 'run-output.txt', runOut);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'instance-log.txt', log);
    evidence(c, 'then', 'graph.json.txt', graphJson);

    const slows = events.filter((e) => e.reason === 'session.slow');
    eq(c, '夹具：session.slow 事件 1 条', slows.length, 1);
    const slowLine = fill(SESSION_FAILURE_TEXT.slow, {
      nodeId: slows[0]?.detail?.nodeId ?? '',
      minutes: Math.floor((Number(slows[0]?.detail?.waitedMs) || 0) / 60000),
    });
    includes(c, 'Then：只出现「运行慢」提示', log, slowLine);

    const node = (state?.nodes ?? []).find((n) => n.nodeId === slows[0]?.detail?.nodeId);
    eq(c, '机检：instance graph 节点仍 running', node?.state, 'running');
    check(c, "机检：failed_reason 不存在", !('failed_reason' in (node ?? {})), JSON.stringify(node));
    eq(c, '夹具：没有 session.timeout 事件', events.filter((e) => e.reason === 'session.timeout').length, 0);
    eq(c, 'Then：没有 escalation.created', events.filter((e) => e.reason === 'escalation.created').length, 0);
    eq(c, '夹具：没有 session.rebuilt', events.filter((e) => e.reason === 'session.rebuilt').length, 0);
    excludes(c, 'Then：没有失败行', log, '判定为运行慢，已升级人工');
    excludes(c, 'Then：没有升级行', log, '已升级人工');
    check(c, '机检：session/new 次数不变（仍 1 个会话）', (state?.sessions ?? []).length === 1,
      JSON.stringify((state?.sessions ?? []).map((s) => s.sessionId)));
    check(c, 'Then：实例仍在运行', ['running', 'completed'].includes(state?.state), JSON.stringify({ state: state?.state }));

    // Then 末句：用户可以自行 cancel（产品命令真跑，不靠夹具标记）。
    const cancel = orch(root, ['cancel', '--instance', 'INST-001'], { env });
    evidence(c, 'then', 'cancel.txt', JSON.stringify({ exitCode: cancel.exitCode, stdout: cancel.stdout, stderr: cancel.stderr }, null, 2));
    eq(c, 'Then：可自行 cancel（退出码 0）', cancel.exitCode, 0);
    eq(c, 'Then：cancel 后实例为 cancelled', readState(root)?.state, 'cancelled');

    note(c, '内建 pass 图未声明 timeout，即使多等若干慢 tick 也不升级；'
      + '与 AC-45 的注入图（T-003 timeout:2）形成对照。');
  } finally {
    try { child?.kill('SIGKILL'); } catch { /* 清理 */ }
    try { if (env) orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
    cleanupRoot(root);
  }
  return finish(c);
}
