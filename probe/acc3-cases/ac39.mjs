// AC-39 事件记录覆盖审核与下游门控（可观测面）。
// 口径：A-2 第 7 段 —— 事件行中段是「从 → 到」或（result='note'）中文原因词；
// 任何未翻译的英文 reason 都不得出现（需求点名 'review.passed' / 'node.dispatch'）。
import {
  makeCase, freshRoot, runSync, statusEvents, text, lines, nonEmptyLines, readEvents,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-39';
const SCENARIO = 'doc-backflow-once';
const SCENARIO_BAD = 'review-bad-json';
const TERMS = ['派发', '读取审核', '审核驳回', '审核通过', '证据核对通过', '下游已接受', '构造回流', '交接已投递', '已完成'];

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '事件记录覆盖审核与下游门控',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const rootA = freshRoot(`${AC}-a`);
    const rootB = freshRoot(`${AC}-b`);
    c.add(rootA); c.add(rootB);

    try {
      // Given 夹具场景 doc-backflow-once 已完整跑完
      const run = c.cmd(runSync(rootA, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：doc-backflow-once 跑完退出码 0', run.exitCode, 0);

      // When 我执行 orch status --instance INST-001 --events
      const st = c.cmd(statusEvents(rootA), 'orch status --instance INST-001 --events');
      const t = text(st);
      c.eq('When status --events 退出码 0', st.exitCode, 0);

      // Then 输出含 9 个中文词
      for (const term of TERMS) {
        c.includes(`Then 输出含「${term}」`, hitLine(t, term), term);
      }

      // And 输出不含任何未翻译的英文 reason
      const events = readEvents(rootA);
      const reasons = [...new Set(events.map((e) => e.reason).filter((r) => typeof r === 'string' && r.includes('.')))];
      const leaked = reasons.filter((r) => t.includes(r));
      c.eq('And 输出不含任何未翻译的英文 reason（枚举 events 的全部 reason）', leaked.join(',') || '（零命中）', '（零命中）');
      c.notIncludes('And 输出不含「review.passed」', t, 'review.passed');
      c.notIncludes('And 输出不含「node.dispatch」', t, 'node.dispatch');
      c.note('失败项同源于 probe/acc3-f-blockers.md 的 BLK-D1：task-loop 的 result=\'note\' 事件行仍把英文 reason 当中段、'
        + '并重复追加「原因 <中文>」；A-2 第 7 段 / D-5 要求中段直接用中文原因词且不再追加「原因」段。');

      // And 机检：object 覆盖 node / session / handoff
      const objects = [...new Set(events.map((e) => e.object))];
      c.check('And 机检：events 的 object 覆盖 node / session / handoff',
        ['node', 'session', 'handoff'].every((o) => objects.includes(o)), objects.join(','));

      // And 机检：review.read 的 detail 含 path='out/review.json' 与 results 计数
      const reads = events.filter((e) => e.reason === 'review.read');
      c.check('And 机检：有 review.read 事件（两轮审核）', reads.length >= 2, `${reads.length} 条`);
      c.check("And 机检：review.read.detail.path='out/review.json'",
        reads.every((e) => e.detail?.path === 'out/review.json'),
        reads.map((e) => e.detail?.path).join(','));
      c.check('And 机检：review.read.detail.results 是计数（reject 轮为 2）',
        reads.some((e) => e.detail?.decision === 'reject' && e.detail?.results === 2),
        reads.map((e) => `${e.detail?.decision}:${e.detail?.results}`).join(','));

      // Given 另起全新根，夹具场景 review-bad-json 已完整跑完并挂起
      const bad = c.cmd(runSync(rootB, SCENARIO_BAD), `driver --scenario ${SCENARIO_BAD}（完整跑完并挂起）`);
      c.eq('Given 前置：review-bad-json 退出码 4（已挂起）', bad.exitCode, 4);

      // When 我执行 orch status --instance INST-001 --events
      const st2 = c.cmd(statusEvents(rootB), 'orch status --instance INST-001 --events（review-bad-json）');
      c.eq('When status --events 退出码 0（第二个根）', st2.exitCode, 0);

      const events2 = readEvents(rootB);
      const invalid = events2.find((e) => e.reason === 'review.invalid');
      c.check('Then 机检：有 review.invalid 事件', Boolean(invalid), invalid ? `seq=${invalid.seq}` : '（缺失）');
      c.check('Then 机检：review.invalid.detail 含 reasonCode', typeof invalid?.detail?.reasonCode === 'string' && invalid.detail.reasonCode.length > 0,
        String(invalid?.detail?.reasonCode));
      c.check('Then 机检：review.invalid.detail 含 message', typeof invalid?.detail?.message === 'string' && invalid.detail.message.length > 0,
        String(invalid?.detail?.message).slice(0, 200));

      const objects2 = [...new Set(events2.map((e) => e.object))];
      c.check('Then 机检：events 的 object 覆盖 escalation', objects2.includes('escalation'), objects2.join(','));
      const created = events2.filter((e) => e.reason === 'escalation.created');
      c.check('Then 机检：含 escalation.created', created.length >= 1,
        created.map((e) => `${e.objectId}:${e.to}`).join(',') || '（缺失）');
      c.check('Then 机检：status 事件段把升级行翻成中文（含「创建升级」）',
        nonEmptyLines(text(st2)).some((l) => l.includes('创建升级')), hitLine(text(st2), '升级 ESC-001'));
    } finally {
      for (const r of [rootA, rootB]) {
        c.cmd(coreStop(r), 'orch core stop');
        await forceKillCore(r);
      }
    }
    return finish(c);
  }
}];
