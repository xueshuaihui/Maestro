// AC-69 合法复测包通过校验并投递（正常路径 / mock 夹具面）
// Given：编码闭环第 1 轮测试判定不通过；开发按缺陷修复后 calc.js 存在且非空。
import path from 'node:path';
import fs from 'node:fs';
import {
  makeCase, freshRoot, runScene, readState, readEvents, readPrompts,
  taskDir, exists, reasonsOf, nodeOf, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-69';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // When：核心构造复测包并派发测试第 2 轮
    const r = c.cmd(runScene(root, { scenario: 'backflow' }), 'orch run code-loop backflow');
    const s = readState(root);
    const ev = readEvents(root);
    const prompts = readPrompts(root);
    const rt = (s?.handoffs ?? []).find((h) => h.edge?.kind === 'retest') ?? null;

    c.check('Given：存在复测包', Boolean(rt), JSON.stringify((s?.handoffs ?? []).map((h) => ({ id: h.handoffId, kind: h.edge?.kind }))));
    c.eq('机检：该包 edge.kind === retest', rt?.edge?.kind, 'retest');
    c.check('机检：artifactRefs.input 含 calc.js',
      (rt?.artifactRefs?.input ?? []).some((ref) => String(ref).includes('calc.js')),
      JSON.stringify(rt?.artifactRefs?.input));
    const calcPath = path.join(taskDir(root), 'calc.js');
    c.check('机检：calc.js 文件存在且非空',
      exists(calcPath) && fs.statSync(calcPath).size > 0, calcPath);
    const hsEvents = ev.filter((e) => e.objectId === rt?.handoffId).map((e) => e.reason);
    c.check('Then：复测包投递（含 handoff.delivered）', hsEvents.includes('handoff.delivered'), hsEvents.join(','));
    c.check('Then：测试收到第 2 轮提示',
      Object.values(prompts).some((p) => p.nodeId === 'T-002' && p.round === 2),
      JSON.stringify(Object.values(prompts).map((p) => ({ node: p.nodeId, round: p.round }))));
    c.eq('机检：测试 round === 2', nodeOf(s, 'T-002')?.round, 2);
    c.check('机检：events.jsonl 无 handoff.rejected', !reasonsOf(ev).includes('handoff.rejected'), reasonsOf(ev).join(','));
    c.notIncludes('Then：终端不出现拒绝', text(r), '已拒绝（');
    c.notIncludes('Then：终端不出现升级', text(r), '升级 ESC-');
    return conclude(c, root);
  },
}];
