/**
 * AC-15 · 旧实例无检查点且模板未知 → 已中断并提示新建。
 *
 * 不真跑图：手写 `.orch/instances/INST-001/state.json`（schemaVersion=2、state=running、
 * template=当前三张内建图之外的 id、无 checkpoint.json），`orch status --instance` 冷启动
 * 触发 reconcileOnBoot 的「检查点不可读 + 未知图」分支。
 *
 * 差异记 note()：
 * - 产品对真正旧格式（schemaVersion<2）在 reconcileOnBoot 直接 continue（跳过，不中断、
 *   不写 legacy 行）；要走到需求期望的 legacy 行必须给 schemaVersion>=2。
 * - markInterrupted 会重写 state.json，机检「sha256 不变」与本路径不可兼得，按原文保留断言。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, statePath, sha256, GRADING_MOCK,
} from '../acc8-f-lib.mjs';

export async function run() {
  const c = makeCase('AC-15', {
    scenario: 'legacy-unknown-template',
    title: '旧实例无检查点且模板未知 → 已中断并提示新建',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-15');
  c.root = root;
  try {
    const stateFile = statePath(root, 'INST-001');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const state = {
      schemaVersion: 2,
      instanceId: 'INST-001',
      coreGeneration: 'gen-before-boot',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      state: 'running',
      stateSince: '2026-01-01T00:00:00.000Z',
      template: 'i18-unknown-template',
      cwd: root,
      task: '旧格式实例，无检查点',
      halted: false,
      rev: 1,
      counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      nodes: [],
      sessions: [],
      handoffs: [],
      escalations: [],
      health: { level: 'normal', reasons: [], computedAt: '2026-01-01T00:00:00.000Z', nodeTimeoutMs: 30000 },
      paused: false,
    };
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    const beforeBytes = fs.readFileSync(stateFile, 'utf8');
    const beforeHash = sha256(beforeBytes);
    const beforeEvents = readEvents(root);
    evidence(c, 'given', 'state.json', beforeBytes);
    evidence(c, 'given', 'preconditions.json', JSON.stringify({
      stateFile, checkpointExists: fs.existsSync(path.join(path.dirname(stateFile), 'state', 'checkpoint.json')),
      sha256: beforeHash, eventsBefore: beforeEvents.length,
    }, null, 2));
    check(c, 'Given：手写实例记录可读（schemaVersion=2 / instanceId=INST-001）',
      state.schemaVersion === 2 && state.instanceId === 'INST-001', `${state.schemaVersion}/${state.instanceId}`);
    check(c, 'Given：模板名不在当前三张内建图里',
      !['single', 'code-loop', 'task-loop'].includes(state.template), state.template);
    check(c, 'Given：无 checkpoint.json',
      !fs.existsSync(path.join(path.dirname(stateFile), 'state', 'checkpoint.json')), 'checkpoint.json 不存在');

    // 冷启动：instance.list 只读触发 ensureCore → reconcileOnBoot
    const boot = orch(root, ['status', '--instance', 'INST-001']);
    for (let i = 0; i < 60 && readState(root)?.state !== 'interrupted'; i += 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const status = orch(root, ['status', '--instance', 'INST-001']);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);
    const afterState = readState(root);
    const afterBytes = fs.readFileSync(stateFile, 'utf8');
    const afterHash = sha256(afterBytes);
    const events = readEvents(root);

    evidence(c, 'then', 'boot.txt', boot.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', afterBytes);
    evidence(c, 'then', 'sha256-before-after.txt', `before=${beforeHash}\nafter=${afterHash}\n`);

    includes(c, 'Then：实例显示「已中断」', status.stdout, '已中断');
    includes(c, 'Then：instance log 出现逐字「旧实例无检查点：已中断（如需继续请新建实例）」',
      log.stdout, '旧实例无检查点：已中断（如需继续请新建实例）');
    check(c, '机检：对账事件含 recovery.legacy',
      events.some((e) => e.reason === 'recovery.legacy'),
      JSON.stringify(events.filter((e) => String(e.reason).startsWith('recovery.'))));
    eq(c, '机检：状态仍 interrupted', afterState?.state, 'interrupted');
    const newDispatch = events.filter((e) => e.reason === 'node.dispatch');
    eq(c, '机检：没有新增 node.dispatch', newDispatch.length, 0);
    eq(c, '机检：实例记录 sha256 不变（需求原文）', afterHash, beforeHash);
    check(c, 'Then：没有尝试恢复（无 recovery.summary / recovery.record 事件）',
      !events.some((e) => e.reason === 'recovery.summary' || e.reason === 'recovery.record'),
      JSON.stringify(events.filter((e) => String(e.reason).startsWith('recovery.'))));
    note(c, '产品 reconcileOnBoot 对真正旧格式（schemaVersion<2）直接 continue，不中断也不写 legacy 行；'
      + '为走到需求期望的「旧实例无检查点」提示，手写 state 用 schemaVersion=2 + 未知模板 + 无检查点。');
    note(c, '机检「sha256 不变」与「转为 interrupted」在本产品路径上不可兼得：markInterrupted 必须重写 state.json。'
      + '按原文保留断言并如实判不通过，未放宽。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
