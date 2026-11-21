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
 * - v4 机检改为「除 state/stateSince/rev/updatedAt/health/counters.eventSeq 六项外内容不变」，
 *   逐叶子比对 given/then 的 state.json（sha256 证据保留供复核，但不再拿 hash 相等做判据）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, statePath, sha256, GRADING_MOCK,
} from '../acc8-f-lib.mjs';

/** 把对象摊成「叶子路径 → JSON 字符串」；数组作为原子叶子，便于逐字比对业务字段。 */
function leafMap(obj) {
  const out = {};
  const walk = (value, prefix) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) walk(child, prefix ? `${prefix}.${key}` : key);
    } else {
      out[prefix] = JSON.stringify(value);
    }
  };
  walk(obj, '');
  return out;
}

/** v4 六项白名单：health 整棵子树可动，counters 只放 eventSeq。 */
const V4_ALLOWED_LEAVES = new Set([
  'state', 'stateSince', 'rev', 'updatedAt', 'counters.eventSeq',
]);
const isV4Allowed = (key) => V4_ALLOWED_LEAVES.has(key) || key === 'health' || key.startsWith('health.');
const V4_BIZ_FIELDS = ['nodes', 'sessions', 'handoffs', 'escalations', 'template', 'task'];

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

    // v4：逐叶子比对 given/then，差异键集合必须落在六项白名单内。
    const givenLeaves = leafMap(JSON.parse(beforeBytes));
    const thenLeaves = leafMap(JSON.parse(afterBytes));
    const changedLeaves = [...new Set([...Object.keys(givenLeaves), ...Object.keys(thenLeaves)])]
      .filter((key) => givenLeaves[key] !== thenLeaves[key]);
    const unexpectedLeaves = changedLeaves.filter((key) => !isV4Allowed(key));
    check(c, '机检：state.json 差异键集合 ⊆ v4 六项白名单（state/stateSince/rev/updatedAt/health/counters.eventSeq）',
      unexpectedLeaves.length === 0,
      JSON.stringify({ changed: changedLeaves, unexpected: unexpectedLeaves }));
    const bizFieldDiffs = V4_BIZ_FIELDS.filter((key) => givenLeaves[key] !== thenLeaves[key]);
    check(c, '机检：nodes/sessions/handoffs/escalations/template/task 逐字不变',
      bizFieldDiffs.length === 0, JSON.stringify({ bizFieldDiffs }));
    check(c, 'Then：有用户可见提示（已中断状态行 + 旧实例无检查点提示行）',
      status.stdout.includes('已中断')
        && log.stdout.includes('旧实例无检查点：已中断（如需继续请新建实例）'),
      JSON.stringify({ status: status.stdout, log: log.stdout }));
    check(c, 'Then：没有尝试恢复（无 recovery.summary / recovery.record 事件）',
      !events.some((e) => e.reason === 'recovery.summary' || e.reason === 'recovery.record'),
      JSON.stringify(events.filter((e) => String(e.reason).startsWith('recovery.'))));
    note(c, '产品 reconcileOnBoot 对真正旧格式（schemaVersion<2）直接 continue，不中断也不写 legacy 行；'
      + '为走到需求期望的「旧实例无检查点」提示，手写 state 用 schemaVersion=2 + 未知模板 + 无检查点。');
    note(c, 'v4 机检按裁-21c 的六项白名单逐叶子比对：状态、状态时间、记录版本、更新时间、健康度、'
      + '事件计数随「转 interrupted」必然更新，其余业务字段（nodes/sessions/handoffs/escalations/template/task）逐字不动，'
      + '验收点是「不猜测、不按检查点重建、节点/会话/交接包一个不动」。');
    note(c, 'sha256-before-after.txt 证据继续写出 before/after 两个 hash 供人工复核，但不再把 hash 相等当判据'
      + '（markInterrupted 必重写 state.json，hash 必然变化）。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
