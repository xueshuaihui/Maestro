// AC-68 合法回流包通过校验并投递（正常路径 / mock 夹具面）
// Given：文档闭环第 1 轮，审核者驳回并给出 2 条缺陷与修改要求。
import path from 'node:path';
import {
  makeCase, freshRoot, runScene, readState, readEvents, readPrompts,
  workspacePath, exists, reasonsOf, nodeOf, text, requirementTitle, conclude,
  DOC_TASK,
} from '../acc4-f-common.mjs';

const AC = 'AC-68';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // When：核心推进回流到撰写者（第 2 轮）
    const r = c.cmd(runScene(root, {
      scenario: 'doc-backflow-once', suite: 'task-loop', template: 'task-loop', task: DOC_TASK,
    }), 'orch run task-loop doc-backflow-once');
    const s = readState(root);
    const ev = readEvents(root);
    const prompts = readPrompts(root);
    const bf = (s?.handoffs ?? []).find((h) => h.edge?.kind === 'backflow') ?? null;

    c.check('Given：存在回流包', Boolean(bf), JSON.stringify((s?.handoffs ?? []).map((h) => ({ id: h.handoffId, kind: h.edge?.kind }))));
    c.eq('机检：该包 edge.kind === backflow', bf?.edge?.kind, 'backflow');
    c.eq('机检：defects.length === 2', bf?.defects?.length, 2);
    c.check('机检：revisionRequirement 非空', typeof bf?.revisionRequirement === 'string' && bf.revisionRequirement.trim().length > 0, String(bf?.revisionRequirement));
    c.check('机检：artifactRefs.previous.ref 非空', typeof bf?.artifactRefs?.previous?.ref === 'string' && bf.artifactRefs.previous.ref.length > 0, String(bf?.artifactRefs?.previous?.ref));
    c.check('机检：artifactRefs.previous.ref 指向的文件存在',
      exists(path.join(workspacePath(root), bf?.artifactRefs?.previous?.ref ?? '__none__')),
      path.join(workspacePath(root), bf?.artifactRefs?.previous?.ref ?? '__none__'));
    const hsEvents = ev.filter((e) => e.objectId === bf?.handoffId).map((e) => e.reason);
    c.check('Then：回流包从「已构造」变为「已投递」',
      hsEvents.includes('handoff.created') && hsEvents.includes('handoff.delivered'), hsEvents.join(','));
    c.check('Then：撰写者收到第 2 轮提示',
      Object.values(prompts).some((p) => p.nodeId === 'T-002' && p.round === 2),
      JSON.stringify(Object.values(prompts).map((p) => ({ node: p.nodeId, round: p.round }))));
    c.eq('机检：撰写者 round === 2', nodeOf(s, 'T-002')?.round, 2);
    c.check('机检：events.jsonl 无 handoff.rejected', !reasonsOf(ev).includes('handoff.rejected'), reasonsOf(ev).join(','));
    c.notIncludes('Then：终端不出现「已拒绝（内容不合规）」', text(r), '已拒绝（内容不合规）');
    c.notIncludes('Then：终端不出现升级行', text(r), '升级 ESC-');
    return conclude(c, root);
  },
}];
