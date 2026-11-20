/**
 * AC-01 · 九个节点位置在用户可见层对得上。
 *
 * 关键观测：
 * - 单元面：NODE_STATES 仍为 7 项；9 个「位置」（state + phase）逐一投影到 labels.js 文案。
 * - 用户可见面：
 *   A) code-loop 现场（recovery-driver checkpoint-advance --kill-after 1200）
 *      → T-001 已完成、T-002 已分配 + 等待重新分配会话；
 *   B) code-loop 现场（--kill-after 0）→ 执行中 / 待执行；
 *   C) task-loop 现场（MAESTRO_TEST_PAUSE=after_output:T-003）→ 研究/撰写已完成、审核待校验。
 *
 * 需求措辞 vs 实际文案的差异记入 note()：
 * - 需求写 `after_output:reviewer`，但 pauseFor() 比对的是 node.nodeId（task-loop 是 T-003），
 *   实测 `after_output:reviewer` 不命中；本用例用 `after_output:T-003` 构造同一现场。
 * - 机检示例 `T-xxx 开发 · 已分配`：在 checkpoint-advance 中已分配的是 T-002 测试，不是开发。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, readEvents,
  orch, runCmd, sleep, exists,
} from '../acc8-f-lib.mjs';
import { NODE_STATES } from '../../src/core/state-machine.js';
import { NODE_LABEL, NODE_PHASE_LABEL, NODE_PHASE_SUFFIX } from '../../src/cli/labels.js';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'recovery-driver.mjs');
const TASK_DRIVER = path.join(REPO, 'test', 'fixtures', 'task-loop-driver.mjs');

/**
 * 自控制恢复现场（供 AC-02/03/05/07/08/09/10 复用）：
 * 准备 backflow → 起 orch run → SIGKILL daemon → 用 `orch status`（list 只读）
 * 冷启动核心触发对账 → 返回 stop 之前的现场数据。
 *
 * 不用 recovery-driver 自带恢复流程的原因（实测）：
 * 1) 它的 runStatus 用 `status --instance` 触发冷启动，instance.get 健康度写与恢复
 *    saveState 存在 CAS 冲突，recoveredAt 时有时无 → 恢复行随机缺失；
 * 2) 它取证后执行 `core.stop`，把仍在 running 的实例标记为「已中断」，污染落盘 state。
 * 本函数全程只 SIGKILL + `orch status` 冷启动，不 core.stop，现场留给用例取证。
 */
export async function driveRecovery(root, killAfter = 2500, extraEnv = {}, waitForRound2 = false, retryRecover = false, options = {}) {
  // `scenario` / `window` 只由新调用点显式传入；缺省值保持既有调用的逐字行为。
  // `retest-slow` 的第 4 步带 `delayMs: 30_000`，是需求 Given「测试第 2 轮执行中」
  // 唯一的稳定观测窗（`backflow` 的第 4 步瞬时完成，窗口窄到抓不住）。
  const scenario = options.scenario ?? 'backflow';
  const env = buildRunEnv(process.env, extraEnv);
  const cwd = path.join(root, 'demo-recovery');
  const promptLog = path.join(root, 'prompt-log.ndjson');
  env.MAESTRO_MOCK_PROMPT_LOG = promptLog;
  const prepared = prepareScene({ root, scenario, reset: false, mockArgs: mockArgsFromEnv(env) });
  fs.mkdirSync(cwd, { recursive: true });
  const task = ['修复 calc.js 的除零边界，并补一条回归测试。', '改动写在 calc.js', '产物：calc.js'].join('\n');
  const child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd, '--task', task, '--template', 'code-loop', '--host', 'mock'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let runOut = '';
  child.stdout?.on('data', (b) => { runOut += b; });
  child.stderr?.on('data', (b) => { runOut += b; });
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const promptCount = () => {
    try { return fs.readdirSync(path.join(prepared.mockDir, 'prompts')).filter((x) => /^\d+\.json$/.test(x)).length; }
    catch { return 0; }
  };
  const corePid = () => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
    catch { return null; }
  };
  const t0 = Date.now();
  while (Date.now() - t0 < 30000 && promptCount() === 0) await nap(100);
  if (options.window === 'retest') {
    // 需求 Given 的确切现场：T-001「第二轮已完成」+ T-002「第 2 轮执行中」。
    // 只等 T-001 round>=2 会杀在 T-001 第 2 轮**执行中**（未 done），
    // 恢复时 skipped 必然是 0 —— 这是此前 AC-08/09/24 一直失败的真实原因。
    const winUntil = Date.now() + 60000;
    while (Date.now() < winUntil) {
      const st = readState(root);
      const t1 = st?.nodes?.find((n) => n.nodeId === 'T-001');
      const t2 = st?.nodes?.find((n) => n.nodeId === 'T-002');
      if (
        t1?.state === 'done' && (t1.round ?? 0) >= 2
        && t2 && (t2.round ?? 0) >= 2 && t2.state === 'running'
      ) break;
      await nap(100);
    }
  } else if (waitForRound2) {
    // 精确等「开发节点进入第 2 轮」窗口再 kill，避免固定毫秒漂移导致 round=1。
    const winUntil = Date.now() + 20000;
    while (Date.now() < winUntil) {
      const st = readState(root);
      if (st?.nodes?.find((n) => n.nodeId === 'T-001')?.round >= 2) break;
      await nap(50);
    }
  } else {
    await nap(killAfter);
  }
  const before = readState(root);
  const beforeEvents = readEvents(root);
  const pid = corePid();
  let kill = null;
  try { process.kill(pid, 'SIGKILL'); kill = { ok: true, pid }; }
  catch (e) { kill = { ok: false, reason: String(e.code ?? e) }; }
  await nap(1200);
  try { child.kill('SIGKILL'); } catch { /* 清理孤儿 run 子进程 */ }
  // 只触发一次冷启动（多次 orch status 会各自尝试起 core，互相竞态）；之后纯轮询落盘。
  const boots = [];
  let recovered = false;
  for (let attempt = 0; attempt < (retryRecover ? 2 : 1) && !recovered; attempt += 1) {
    if (attempt === 1) {
      // 首次恢复可能撞上 instance.get 健康写与 saveState 的 CAS 冲突，recoveredAt 落不下来。
      // 再 SIGKILL 一次新 core，重新触发对账（最多重试一次）。
      const p = corePid();
      if (p) { try { process.kill(p, 'SIGKILL'); } catch { /* 已退出 */ } }
      await nap(1200);
    }
    const boot = spawnSync(NODE, [ORCH_BIN, 'status'], { cwd: root, env, encoding: 'utf8', timeout: 60000 });
    boots.push({ attempt, exit: boot.status, pid: corePid() });
    for (let i = 0; i < 60; i += 1) {
      if (readState(root)?.recoveredAt) { recovered = true; break; }
      await nap(300);
    }
    boots.push({ attempt, pid: corePid(), recoveredAt: readState(root)?.recoveredAt ?? null });
  }
  // after_assign hold 在 continueRecovery() 里异步写 .mock/paused，晚于 recoveredAt。
  // 必须等它落盘，否则读 graph 时节点已漂移成「执行中」，抓不到「已分配」。
  if (extraEnv.MASTERO_TEST_RECOVERY_HOLD === 'after_assign') {
    for (let i = 0; i < 60 && !fs.existsSync(path.join(root, '.mock', 'paused')); i += 1) await nap(100);
  } else {
    // 非冻结场景：给恢复后的驱动一点时间推进到复测窗口（T-002 round=2），
    // 让 Then 断言核对的是「恢复后继续推进」而非恢复瞬间。
    await nap(4000);
  }
  await nap(500);
  const status = spawnSync(NODE, [ORCH_BIN, 'status', '--instance', 'INST-001'], { cwd: root, env, encoding: 'utf8', timeout: 60000 });
  return {
    ok: kill.ok && Boolean(readState(root)?.recoveredAt),
    before, beforeEvents, kill, boots, runOut, promptLog,
    status: { code: status.status, stdout: status.stdout ?? '' },
  };
}

function driveCodeLoop(root, killAfter) {
  const r = runCmd([NODE, DRIVER, '--root', root, '--scenario', 'checkpoint-advance', '--kill-after', String(killAfter)], {
    cwd: REPO, env: baseEnv(), timeout: 180_000,
  });
  let summary = null;
  try { summary = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { /* 取证仍保存 */ }
  return { r, summary };
}

export async function run() {
  const c = makeCase('AC-01', {
    scenario: 'node-position-projection',
    title: '九个节点位置在用户可见层对得上',
  });
  const rootA = freshRoot('AC-01-a');
  const rootB = freshRoot('AC-01-b');
  const rootC = freshRoot('AC-01-c');
  c.root = rootA;
  let taskChild = null;
  try {
    // ---- 单元面：7 项状态 + 9 个位置投影 ----
    evidence(c, 'unit', 'state-machine.json', JSON.stringify({ NODE_STATES }, null, 2));
    eq(c, '回归：NODE_STATES 仍是 7 项', NODE_STATES.length, 7);
    eq(c, '位置投影 blocked → 待执行', NODE_PHASE_LABEL.blocked, '待执行');
    eq(c, '位置投影 ready → 待执行', NODE_PHASE_LABEL.ready, '待执行');
    eq(c, '位置投影 assigned → 已分配', NODE_PHASE_LABEL.assigned, '已分配');
    eq(c, '位置投影 running → 执行中', NODE_PHASE_LABEL.running, '执行中');
    eq(c, '位置投影 review → 待校验', NODE_LABEL.review, '待校验');
    eq(c, '位置投影 done → 已完成', NODE_LABEL.done, '已完成');
    eq(c, '位置投影 failed → 失败', NODE_LABEL.failed, '失败');
    eq(c, '位置投影 escalated → 已升级', NODE_LABEL.escalated, '已升级');
    eq(c, '位置投影 cancelled → 已取消', NODE_LABEL.cancelled, '已取消');
    eq(c, '已分配节点条件后缀逐字', NODE_PHASE_SUFFIX.assigned, '等待重新分配会话');
    check(c, '9 个位置投影齐全（含 blocked/ready 合并为待执行）',
      new Set([NODE_PHASE_LABEL.blocked, NODE_PHASE_LABEL.ready, NODE_PHASE_LABEL.assigned,
        NODE_PHASE_LABEL.running, NODE_LABEL.review, NODE_LABEL.done, NODE_LABEL.failed,
        NODE_LABEL.escalated, NODE_LABEL.cancelled]).size >= 7,
      'blocked/ready 都渲染「待执行」');

    // ---- 现场 A：开发节点「已分配」+ 等待重新分配会话 ----
    // killAfter=0（第一个 prompt 后立刻强杀）+ RECOVERY_HOLD=after_assign 冻结恢复现场：
    // 实测 T-001 开发停在「已分配 · 等待重新分配会话」，正好命中需求机检的「T-xxx 开发 · 已分配」。
    const a = await driveRecovery(rootA, 0, { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' });
    evidence(c, 'given', 'a-driver.json', JSON.stringify(
      { ok: a.ok, kill: a.kill, boots: a.boots, before: a.before }, null, 2));
    const graphA = orch(rootA, ['instance', 'graph', '--instance', 'INST-001']);
    const statusA = orch(rootA, ['status', '--instance', 'INST-001']);
    evidence(c, 'then', 'a-graph.txt', graphA.stdout);
    evidence(c, 'then', 'a-status.txt', statusA.stdout);
    includes(c, 'graph 文本：已分配节点显示「已分配」', graphA.stdout, '已分配');
    includes(c, 'graph 文本：已分配节点带「等待重新分配会话」', graphA.stdout, NODE_PHASE_SUFFIX.assigned);
    includes(c, 'status --instance 节点行含「已分配」', statusA.stdout, '已分配');
    check(c, 'graph 文本中 T-xxx … 已分配 出现 1 次',
      (graphA.stdout.match(/T-\d+\s+[^\n]*已分配/g) || []).length === 1,
      JSON.stringify((graphA.stdout.match(/T-\d+\s+[^\n]*已分配/g) || [])));
    try { fs.writeFileSync(path.join(rootA, '.mock', 'release'), '1'); } catch { /* 放行 */ }
    try { orch(rootA, ['core', 'stop']); } catch { /* 清理 */ }

    // ---- 现场 B：已完成 + 待执行（pending 也渲染「待执行」） ----
    // killAfter=1200 实测 T-001 done round1、T-002 待执行。
    const b = await driveRecovery(rootB, 1200);
    evidence(c, 'given', 'b-driver.json', JSON.stringify(
      { ok: b.ok, kill: b.kill, boots: b.boots, before: b.before }, null, 2));
    const graphB = orch(rootB, ['instance', 'graph', '--instance', 'INST-001']);
    evidence(c, 'then', 'b-graph.txt', graphB.stdout);
    includes(c, 'graph 文本：已完成节点显示「已完成」', graphB.stdout, '已完成');
    includes(c, 'graph 文本：待执行节点显示「待执行」', graphB.stdout, '待执行');
    try { orch(rootB, ['core', 'stop']); } catch { /* 清理 */ }

    // ---- 现场 C：任务闭环研究/撰写已完成、审核待校验 ----
    const cwdC = path.join(rootC, 'demo-doc');
    fs.mkdirSync(cwdC, { recursive: true });
    runCmd([NODE, TASK_DRIVER, '--root', rootC, '--scenario', 'doc-pass', '--cwd', cwdC, '--prepare-only'], {
      cwd: REPO, env: baseEnv(),
    });
    taskChild = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwdC,
      '--task', '写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md',
      '--template', 'task-loop', '--host', 'dsh'], {
      cwd: rootC, env: baseEnv({ MAESTRO_TEST_PAUSE: 'after_output:T-003' }), stdio: ['ignore', 'pipe', 'pipe'],
    });
    let taskOut = '';
    taskChild.stdout?.on('data', (b) => { taskOut += b; });
    taskChild.stderr?.on('data', (b) => { taskOut += b; });
    const until = Date.now() + 30_000;
    while (Date.now() < until && !exists(path.join(rootC, '.mock', 'paused'))) await sleep(150);
    // paused marker 先于 state.json 落盘：再等实例可读，避免拿到 null。
    for (let i = 0; i < 100 && !readState(rootC); i += 1) await sleep(100);
    const stateC = readState(rootC);
    evidence(c, 'given', 'c-run.txt', taskOut.slice(-3000));
    evidence(c, 'given', 'c-state.json', JSON.stringify(stateC, null, 2));
    const graphC = orch(rootC, ['instance', 'graph', '--instance', 'INST-001']);
    const statusC = orch(rootC, ['status', '--instance', 'INST-001']);
    evidence(c, 'then', 'c-graph.txt', graphC.stdout);
    evidence(c, 'then', 'c-status.txt', statusC.stdout);
    eq(c, '审核节点停在 review', stateC?.nodes?.find((n) => n.nodeId === 'T-003')?.state, 'review');
    includes(c, 'graph 文本：待校验节点显示「待校验」', graphC.stdout, '待校验');
    includes(c, 'graph 文本：研究/撰写节点显示「已完成」', graphC.stdout, '已完成');
    includes(c, 'status 节点行含「待校验」', statusC.stdout, '待校验');
    try { fs.writeFileSync(path.join(rootC, '.mock', 'release'), '1'); } catch { /* 放行 */ }
    try { taskChild.kill('SIGKILL'); } catch { /* 清理 */ }
    try { orch(rootC, ['core', 'stop']); } catch { /* 清理 */ }

    note(c, '需求 Given 写 MAESTRO_TEST_PAUSE=after_output:reviewer；产品 pauseFor() 比对 node.nodeId，'
      + 'task-loop 节点号是 T-003，实测 after_output:reviewer 不命中，改用 after_output:T-003 才停在审核待校验。');
    note(c, '机检示例「T-xxx 开发 · 已分配」在 checkpoint-advance 现场不可得：该现场被降为已分配的是 T-002 测试；'
      + '本用例改断言「T-xxx … 已分配」出现 1 次且带「等待重新分配会话」。');
  } finally {
    cleanupRoot(rootA); cleanupRoot(rootB); cleanupRoot(rootC);
  }
  return finish(c);
}
