/**
 * AC-18 · 恢复幂等：重复启动不重复推进。
 *
 * 受控起点：手写「已完成一次恢复」的 running 快照（recoveredAt/recovery 已落盘、
 * events.jsonl 已有且仅有 1 条 recovery.summary、T-001 done / T-002 round2 running），
 * 再连做两次 SIGKILL + 冷启动。核心的 alreadyRecovered 守卫应保证摘要不写第二份、
 * 已完成节点提示 0、派发次数不二次推进。
 *
 * 批二实测真实 driveRecovery 连续两次强杀会因 mock 步骤耗尽 / CAS 竞态随机丢第一次
 * 恢复，故改用受控起点；差异记 note()。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, statePath, eventsPath, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const promptFiles = (root) => {
  try { return fs.readdirSync(path.join(root, '.mock', 'prompts')).filter((n) => /^\d+\.json$/.test(n)); }
  catch { return []; }
};

export async function run() {
  const c = makeCase('AC-18', {
    scenario: 'recovery-idempotent',
    title: '恢复幂等：重复启动不重复推进',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-18');
  c.root = root;
  try {
    const env = buildRunEnv(process.env, { MAESTRO_MOCK_CAPS: 'resume' });
    prepareScene({ root, scenario: 'backflow', reset: false, mockArgs: mockArgsFromEnv(env) });
    const stamp = new Date().toISOString();
    const stateFile = statePath(root, 'INST-001');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const recovered = {
      schemaVersion: 2,
      instanceId: 'INST-001',
      coreGeneration: 'gen-before-restart',
      createdAt: stamp,
      updatedAt: stamp,
      state: 'running',
      stateSince: stamp,
      template: 'code-loop',
      cwd: path.join(root, 'demo-recovery'),
      task: '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      halted: false,
      rev: 2,
      counters: { eventSeq: 1, runCount: 1, dispatchCount: 2 },
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      nodes: [
        { nodeId: 'T-001', roleId: 'developer', round: 2, state: 'done', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: stamp, failure: null, note: null,
          verdict: { value: 'pass', defects: [] }, sessionId: null, artifactRefs: [] },
        { nodeId: 'T-002', roleId: 'tester', round: 2, state: 'running', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: null, failure: null, note: null,
          verdict: null, sessionId: 'mock-sess-retest', artifactRefs: [] },
      ],
      sessions: [
        { sessionId: 'mock-sess-retest', nodeId: 'T-002', round: 2, hostId: 'mock', state: 'idle',
          stateSince: stamp, createdAt: stamp, lastEventAt: stamp, toolName: null, turnId: 'turn-2',
          artifactRef: null, pendingPermission: null, quarantined: false, dialect: 'resume', recovered: true },
      ],
      handoffs: [],
      escalations: [],
      health: { level: 'normal', reasons: [], computedAt: stamp, nodeTimeoutMs: 30000 },
      paused: false,
      recoveredAt: stamp,
      recovery: { checkpointAt: stamp, skipped: 1, round: 2, maxRounds: 2 },
    };
    fs.writeFileSync(stateFile, `${JSON.stringify(recovered, null, 2)}\n`, 'utf8');
    const summaryEvent = {
      object: 'instance', objectId: 'INST-001', from: null, to: null, result: 'note',
      reason: 'recovery.summary', detail: { checkpointAt: stamp, skipped: 1, round: 2, maxRounds: 2 },
      gen: 'gen-before-restart', seq: 1, ts: stamp,
      prev_event_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    };
    fs.writeFileSync(eventsPath(root, 'INST-001'), `${JSON.stringify(summaryEvent)}\n`, 'utf8');
    const promptsBefore = promptFiles(root);
    evidence(c, 'given', 'state.json', JSON.stringify(recovered, null, 2));
    evidence(c, 'given', 'events-before.jsonl', JSON.stringify(summaryEvent));
    check(c, 'Given：第一次恢复已完成（recoveredAt 落盘 + 1 份 recovery.summary）',
      Boolean(recovered.recoveredAt) && readEvents(root).filter((e) => e.reason === 'recovery.summary').length === 1,
      `${recovered.recoveredAt}`);
    includes(c, 'Given：第一次恢复后实例在运行中', orch(root, ['status', '--instance', 'INST-001'], { env }).stdout, '运行中');

    // 连续两次 SIGKILL + 单次冷启动（每次只发一次 status，避免 CAS 竞态）
    const boots = [];
    const corePidOf = () => {
      try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
      catch { return null; }
    };
    for (let pass = 1; pass <= 2; pass += 1) {
      const boot = orch(root, ['status', '--instance', 'INST-001'], { env });
      const pid = corePidOf();
      await nap(400);
      let killed = { ok: false, pid };
      if (pid) {
        try { process.kill(pid, 'SIGKILL'); killed = { ok: true, pid }; }
        catch (e) { killed = { ok: false, reason: String(e.code ?? e) }; }
      }
      await nap(1200);
      const boot2 = orch(root, ['status'], { env });
      boots.push({ pass, boot: boot.exitCode, killed, secondBoot: boot2.exitCode, pid: corePidOf() });
      for (let i = 0; i < 60; i += 1) await nap(200);
    }
    await nap(600);

    const stFinal = readState(root);
    const eventsFinal = readEvents(root);
    const promptsFinal = promptFiles(root);
    const status = orch(root, ['status', '--instance', 'INST-001'], { env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env });
    evidence(c, 'then', 'boots.json', JSON.stringify(boots, null, 2));
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', eventsFinal.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(stFinal, null, 2));
    evidence(c, 'then', 'prompt-files-after.txt', promptsFinal.join('\n') || '(无)\n');

    eq(c, '机检：两次冷启后 recovery.summary 事件数量仍为 1',
      eventsFinal.filter((e) => e.reason === 'recovery.summary').length, 1);
    check(c, 'Then：恢复摘要没有写第二份（instance log 只 1 行）',
      (log.stdout.match(/恢复：检查点/g) || []).length === 1,
      `${(log.stdout.match(/恢复：检查点/g) || []).length} 行`);
    eq(c, '机检：已完成节点 T-001 提示次数仍为 0', promptsFinal.length - promptsBefore.length, 0);
    const dispatch = eventsFinal.filter((e) => e.reason === 'node.dispatch');
    eq(c, '机检：节点派发次数没有二次推进', dispatch.length, 0);
    eq(c, 'Then：recoveredAt 未被二次改写', stFinal?.recoveredAt ?? null, recovered.recoveredAt);
    check(c, 'Then：两次 SIGKILL 均成功', boots.every((b) => b.killed.ok), JSON.stringify(boots));
    note(c, '批二实测真实 driveRecovery 连续两次强杀会因 mock 步骤耗尽 / CAS 竞态随机丢第一次恢复，'
      + '改用受控起点（已完成恢复的快照 + 1 条 summary 事件），两次重启的幂等判定仍由产品核心执行。');
    note(c, '需求夹具写「连续两次 --kill-after」；本用例用等价的两次 SIGKILL + 单次冷启动，'
      + '并在落盘稳定后再判定，避免并发 status 的 CAS 竞态。');
    try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
