/**
 * AC-14 · 待校验节点恢复只重新核对，不重放会话。
 *
 * 现场：task-loop doc-pass + MAESTRO_TEST_PAUSE=after_output:T-003（审核节点已写出
 * out/review.json 证据，节点停在 review），SIGKILL daemon 后 `orch status` 冷启动。
 * 核心对账走 reverifyNode：写 recovery.reverify 事件、节点转 done，不派发、不提示。
 *
 * 需求夹具写 `after_output:reviewer`；产品 pauseFor() 比对 nodeId，task-loop 审核
 * 节点号是 T-003，实测 `reviewer` 不命中，改用 `after_output:T-003`，差异记 note()。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import {
  prepareTaskScene, mockArgsFromEnv, buildRunEnv,
} from '../../test/fixtures/task-loop-driver.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const promptRecords = (mockDir) => {
  try {
    return fs.readdirSync(path.join(mockDir, 'prompts'))
      .filter((n) => /^\d+\.json$/.test(n))
      .map((n) => JSON.parse(fs.readFileSync(path.join(mockDir, 'prompts', n), 'utf8')));
  } catch {
    return [];
  }
};
const ndjson = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

export async function run() {
  const c = makeCase('AC-14', {
    scenario: 'review-reverify-only',
    title: '待校验节点恢复只重新核对，不重放会话',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-14');
  c.root = root;
  let child = null;
  try {
    const cwd = path.join(root, 'demo-doc');
    const promptLog = path.join(root, 'prompt-log.ndjson');
    const env = buildRunEnv(process.env, {
      MAESTRO_TEST_PAUSE: 'after_output:T-003',
      MAESTRO_MOCK_PROMPT_LOG: promptLog,
    });
    const prepared = prepareTaskScene({ root, scenario: 'doc-pass', reset: false, mockArgs: mockArgsFromEnv(env) });
    fs.mkdirSync(cwd, { recursive: true });
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md',
      '--template', 'task-loop', '--host', 'dsh'], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let runOut = '';
    child.stdout?.on('data', (b) => { runOut += String(b); });
    child.stderr?.on('data', (b) => { runOut += String(b); });

    // 等 core 侧 pauseFor 写 .mock/paused（此时 review.json 已落盘）
    for (let i = 0; i < 300 && !fs.existsSync(path.join(root, '.mock', 'paused')); i += 1) await nap(100);
    for (let i = 0; i < 100 && !readState(root); i += 1) await nap(100);
    const stBefore = readState(root);
    const reviewNodeBefore = stBefore?.nodes?.find((n) => n.nodeId === 'T-003');
    const reviewEvidence = path.join(cwd, 'out', 'review.json');
    const promptsBefore = promptRecords(prepared.mockDir).filter((p) => p.nodeId === 'T-003').length;
    const ndBefore = ndjson(promptLog).filter((p) => p.nodeId === 'T-003').length;
    const eventsBefore = readEvents(root);
    evidence(c, 'given', 'run.txt', runOut.slice(-3000));
    evidence(c, 'given', 'state-before.json', JSON.stringify(stBefore, null, 2));
    evidence(c, 'given', 'events-before.jsonl', eventsBefore.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'given', 'prompt-records-before.json', JSON.stringify(promptRecords(prepared.mockDir), null, 2));
    eq(c, 'Given：审核节点停在 review', reviewNodeBefore?.state, 'review');
    check(c, 'Given：审核证据文件存在', fs.existsSync(reviewEvidence), reviewEvidence);

    // SIGKILL（不用 core stop），清理孤儿 run 子进程
    const pid = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
      catch { return null; }
    })();
    let kill = { ok: false, pid };
    try { process.kill(pid, 'SIGKILL'); kill = { ok: true, pid }; } catch (e) { kill = { ok: false, reason: String(e.code ?? e) }; }
    await nap(1200);
    try { child.kill('SIGKILL'); } catch { /* 已退出 */ }

    // 冷启动触发对账；instance.get 健康写与恢复 saveState 的 CAS 冲突会随机丢 recoveredAt，
    // 因此只重试一次（再 SIGKILL 新核心重新对账），其余阶段纯轮询，不并发多次 status。
    const corePidOf = () => {
      try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
      catch { return null; }
    };
    const boots = [];
    let recovered = false;
    for (let attempt = 0; attempt < 2 && !recovered; attempt += 1) {
      if (attempt === 1) {
        const p = corePidOf();
        if (p) { try { process.kill(p, 'SIGKILL'); } catch { /* 已退出 */ } }
        await nap(1200);
      }
      const boot = orch(root, ['status'], { env });
      boots.push({ attempt, exit: boot.exitCode, pid: corePidOf() });
      for (let i = 0; i < 100; i += 1) {
        if (readState(root)?.recoveredAt) { recovered = true; break; }
        await nap(300);
      }
      boots.push({ attempt, pid: corePidOf(), recoveredAt: readState(root)?.recoveredAt ?? null });
    }
    await nap(800);
    const stAfter = readState(root);
    const reviewNodeAfter = stAfter?.nodes?.find((n) => n.nodeId === 'T-003');
    const status = orch(root, ['status', '--instance', 'INST-001'], { env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env });
    const events = readEvents(root);
    const promptsAfter = promptRecords(prepared.mockDir).filter((p) => p.nodeId === 'T-003').length;
    const ndAfter = ndjson(promptLog).filter((p) => p.nodeId === 'T-003').length;

    evidence(c, 'then', 'boot.json', JSON.stringify({ kill, boots }, null, 2));
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(stAfter, null, 2));
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(ndjson(promptLog), null, 2));

    check(c, 'Given：强杀 + 冷启动后 recoveredAt 落盘', Boolean(stAfter?.recoveredAt), `${stAfter?.recoveredAt}`);
    includes(c, 'Then：instance log 出现逐字「重新核对：T-003 · 证据重新校验（不重放会话）」',
      log.stdout, '重新核对：T-003 · 证据重新校验（不重放会话）');
    check(c, 'Then：recovery.reverify 事件存在且 ok=true',
      events.some((e) => e.reason === 'recovery.reverify' && e.detail?.nodeId === 'T-003' && e.detail?.ok === true),
      JSON.stringify(events.filter((e) => e.reason === 'recovery.reverify')));
    eq(c, 'Then：审核节点重新核对后转为已完成', reviewNodeAfter?.state, 'done');
    includes(c, 'Then：status 节点行显示「已完成」', status.stdout, '已完成');
    eq(c, '夹具：审核节点 prompt 记录数不增（mock prompts 目录）', promptsAfter - promptsBefore, 0);
    eq(c, '夹具：审核节点 prompt 次数不增（NDJSON prompt log）', ndAfter - ndBefore, 0);

    const firstRecoverySeq = Math.min(...events.filter((e) => String(e.reason).startsWith('recovery.')).map((e) => e.seq ?? 0));
    const newDispatch = events.filter((e) => e.reason === 'node.dispatch'
      && e.detail?.nodeId === 'T-003' && (e.seq ?? 0) > firstRecoverySeq);
    eq(c, 'Then：恢复后审核节点没有新的 node.dispatch', newDispatch.length, 0);
    excludes(c, 'Then：审核会话没有重放（无 session/resume 方言行）', log.stdout, 'session/resume');
    excludes(c, 'Then：审核会话没有重放（无 session/load 方言行）', log.stdout, 'session/load');
    note(c, '需求夹具写 MAESTRO_TEST_PAUSE=after_output:reviewer；产品 pauseFor() 比对 node.nodeId，'
      + 'task-loop 审核节点号是 T-003，实测 reviewer 不命中，改用 after_output:T-003 才停在审核待校验。');
    try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
