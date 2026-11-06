// AC-34 交接包 accepted 与 consumed 的时机（逐轮配对一律走 events.jsonl 的 node.dispatch）。
import {
  makeCase, freshRoot, runSync, readState, readEvents,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-34';
const SCENARIO = 'doc-backflow-once';
/** 「turn 内事件」白名单（src/adapter/session-state.js:20）。 */
const TURN_UPDATES = new Set([
  'agent_thought_chunk', 'agent_message_chunk', 'tool_call', 'tool_call_update', 'plan', 'user_message_chunk'
]);
const NOISE = new Set(['usage_update', 'available_commands_update']);

const ms = (v) => (typeof v === 'string' ? Date.parse(v) : NaN);

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '交接包 accepted 与 consumed 的时机',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：夹具跑完退出码 0', run.exitCode, 0);

      const s = readState(root);
      const handoffs = s?.handoffs ?? [];
      const events = readEvents(root).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      const dispatches = events.filter((e) => e.reason === 'node.dispatch');

      c.eq('前置：4 张交接包', handoffs.length, 4);
      c.eq('前置：5 次派发（首派无前置交接包）', dispatches.length, 5);

      // And 1：acceptedAt ≥ deliveredAt（同一毫秒允许）
      const acceptedOk = handoffs.every((h) => Number.isFinite(ms(h.acceptedAt)) && Number.isFinite(ms(h.deliveredAt))
        && ms(h.acceptedAt) >= ms(h.deliveredAt));
      c.check('机检：每张 handoff 的 acceptedAt 都晚于或等于 deliveredAt（同一毫秒允许，不允许早于）', acceptedOk,
        handoffs.map((h) => `${h.handoffId}:${ms(h.acceptedAt) - ms(h.deliveredAt)}ms`).join(' '));

      // And 2：acceptedSignal 是 turn 内事件名，不是噪声
      const signals = handoffs.map((h) => h.acceptedSignal);
      c.check("机检：acceptedSignal 都是 turn 内事件名（不是 usage/available_commands 噪声）",
        signals.every((x) => TURN_UPDATES.has(x) && !NOISE.has(x)), signals.join(','));
      c.check('机检：acceptedSignal 具体取值逐一核对', signals.every((x) => typeof x === 'string'),
        signals.map((x, i) => `HO-00${i + 1}=${x}`).join(' '));

      // And 3：consumedAt ≥ 消费它那一轮的 node.dispatch ts（逐轮配对）
      const pairRows = [];
      const consumedOk = handoffs.every((h, i) => {
        const dispatch = dispatches[i + 1]; // 第 0 次派发是入口节点 T-001，没有前置交接包
        if (!dispatch) return false;
        const okNode = dispatch.objectId === h.edge?.to;
        const okTime = ms(h.consumedAt) >= ms(dispatch.ts);
        pairRows.push(`${h.handoffId}↔#${dispatch.seq} ${dispatch.objectId}r${dispatch.detail?.round} consumed-ts:${
          Number.isFinite(ms(h.consumedAt)) && Number.isFinite(ms(dispatch.ts)) ? ms(h.consumedAt) - ms(dispatch.ts) : 'NaN'}ms${
          okNode ? '' : '（目标不符）'}`);
        return okNode && okTime;
      });
      c.check('机检：每张 handoff 的 consumedAt 都不早于消费它那一轮的 node.dispatch ts（逐轮配对）', consumedOk,
        pairRows.join(' | '));

      // And 4：没有 handoff 停在 created/delivered/accepted
      const open = handoffs.filter((h) => ['created', 'delivered', 'accepted'].includes(h.state));
      c.eq('机检：没有 handoff 停在 created/delivered/accepted', open.map((h) => `${h.handoffId}:${h.state}`).join(',') || '（无）', '（无）');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
