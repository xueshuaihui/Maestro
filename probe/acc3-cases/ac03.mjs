// AC-03 撰写完成后，审核者收到本轮文档引用（夹具：doc-pass 完整跑完）。
import path from 'node:path';
import {
  makeCase, freshRoot, runSync, statusText, coreStop, forceKillCore,
  text, lines, readState, nodeOf, handoffOf, promptOf, wsPath, fileInfo, taskDir,
  requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-03';
const SCENARIO = 'doc-pass';
const DOC = 'artifacts/docs/release-notes.v1.md';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '撰写完成后，审核者收到本轮文档引用',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      // Given：夹具场景 doc-pass 已完整跑完
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);

      // Then 1：撰写者产物存在且非空
      const doc = fileInfo(wsPath(root, DOC));
      c.check('机检：release-notes.v1.md 存在且 bytes > 0', doc.exists && doc.bytes > 0, `${doc.exists} / ${doc.bytes} B`);

      // Then 2/3：审核者提示词（第 3 次派发）
      const p3 = promptOf(root, 3);
      const task = p3?.task ?? '';
      c.check('机检：`.mock/prompts/3.json` 存在且是 T-003 第 1 轮', Boolean(p3) && p3.nodeId === 'T-003' && p3.round === 1,
        p3 ? `nodeId=${p3.nodeId} round=${p3.round}` : '缺失');
      c.includes('prompt 的 task 含「本轮文档引用：artifacts/docs/release-notes.v1.md」', task, `本轮文档引用：${DOC}`);

      // 需求原文写的是「out/review.json」；HEAD 150c7c6 把它改成绝对路径（分隔符随宿主平台）。
      // 这里按路径同一性断言：`审核文件写入路径：` 的值必须是绝对路径，且解析结果等于 <任务目录>/out/review.json。
      const m = /审核文件写入路径：(.+)/.exec(task);
      const given = m ? m[1].trim() : '';
      const resolved = given ? path.resolve(taskDir(root), given) : '';
      const expected = path.join(taskDir(root), 'out', 'review.json');
      c.check('prompt 含审核文件路径 out/review.json（绝对路径、解析到 <任务目录>/out/review.json）',
        Boolean(m) && path.isAbsolute(given) && path.resolve(resolved) === path.resolve(expected),
        m ? `${given} → ${resolved}` : '未找到「审核文件写入路径：」行');
      c.note(`「out/review.json」在 prompt 里是宿主绝对路径（150c7c6 修法）：实测 \`${given}\`；逐字前斜杠形态只出现在 state 的 review.reviewPath。`);

      // Then 4/5：HO-002
      const s = readState(root);
      c.eq('机检：审核文件的相对引用（T-003 review.reviewPath）仍是 out/review.json',
        nodeOf(s, 'T-003')?.review?.reviewPath, 'out/review.json');
      const ho2 = handoffOf(s, 'HO-002');
      c.eq('机检：HO-002 edge = T-002→T-003 forward', ho2 ? `${ho2.edge?.from}→${ho2.edge?.to}/${ho2.edge?.kind}` : '缺失',
        'T-002→T-003/forward');
      c.eq('机检：HO-002 state = consumed', ho2?.state, 'consumed');
      const inputs = JSON.stringify(ho2?.artifactRefs?.input ?? []);
      c.includes('机检：HO-002 artifactRefs.input 含 ' + DOC, inputs, DOC);

      // Then 6：T-002 最终行
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t2line = lines(text(st)).find((l) => l.startsWith('节点 T-002 ')) ?? '';
      c.includes('节点 T-002 的最终行含「产物 ' + DOC + '」', t2line, `产物 ${DOC}`);
      c.eq('机检：T-002 state/round = done/1', `${nodeOf(s, 'T-002')?.state}/${nodeOf(s, 'T-002')?.round}`, 'done/1');

      c.check('夹具完整跑完（退出码 0）', run.exitCode === 0, `exit=${run.exitCode}`);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
