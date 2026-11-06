// AC-09 第 2 轮通过 → 闭环完成，两版共存（夹具：doc-backflow-once 完整跑完）。
import {
  makeCase, freshRoot, runSync, statusText, coreStop, forceKillCore,
  text, lines, readState, nodeOf, wsPath, fileInfo, sha256File,
  requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-09';
const SCENARIO = 'doc-backflow-once';
const V1 = 'artifacts/docs/release-notes.v1.md';
const V2 = 'artifacts/docs/release-notes.v2.md';
const DUR = String.raw`(?:\d+(?:\.\d+)?(?:ms|s|m|h))+`;

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '第 2 轮通过 → 闭环完成，两版共存',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      const out = text(run);

      c.eq('命令退出码是 0', run.exitCode, 0);
      c.includes('输出含「节点 T-002 撰写者 已完成 · 第 2 轮」', out, '节点 T-002 撰写者 已完成 · 第 2 轮');
      c.matches('输出含「节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过」', out,
        new RegExp(`节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 ${DUR} · 审核 通过`));

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      c.includes('输出含「实例 INST-001 · 已完成 · 模板 通用任务闭环」', text(st), '实例 INST-001 · 已完成 · 模板 通用任务闭环');
      const t2line = lines(text(st)).find((l) => l.startsWith('节点 T-002 ')) ?? '';
      c.includes('status 的 T-002 行是「节点 T-002 撰写者 已完成 · 第 2 轮」', t2line, '节点 T-002 撰写者 已完成 · 第 2 轮');
      c.includes('status 的 T-002 行产物仍是 v2（本轮引用）', t2line, `产物 ${V2}`);

      // 机检：两版共存，v1 未被改写
      const s = readState(root);
      const t2 = nodeOf(s, 'T-002');
      const f1 = fileInfo(wsPath(root, V1));
      const f2 = fileInfo(wsPath(root, V2));
      const rec1 = (t2?.artifactHistory ?? []).find((x) => x.round === 1 && x.ref === V1);
      const now1 = sha256File(wsPath(root, V1));
      c.check('机检：v1 与 v2 同时存在', f1.exists && f1.bytes > 0 && f2.exists && f2.bytes > 0,
        `v1=${f1.exists}/${f1.bytes}B v2=${f2.exists}/${f2.bytes}B`);
      c.check('机检：v1 的 sha256 与第 1 轮记录一致', Boolean(rec1?.sha256) && now1 === rec1.sha256,
        `now=${now1} recorded=${rec1?.sha256 ?? '缺失'}`);
      c.eq('机检：artifactHistory 恰好两条（v1 第 1 轮 + v2 第 2 轮）',
        (t2?.artifactHistory ?? []).map((x) => `${x.round}:${x.ref}`).join(','), `1:${V1},2:${V2}`);

      // 机检：审核结论
      const t3 = nodeOf(s, 'T-003');
      c.eq('机检：T-003 review.decision = pass', t3?.review?.decision, 'pass');
      c.eq('机检：T-003 review.artifact = ' + V2, t3?.review?.artifact, V2);

      // 机检：终态
      c.eq('机检：实例 state = completed', s?.state, 'completed');
      const pending = (s?.escalations ?? []).filter((e) => e.state === 'pending');
      c.eq('机检：无 pending 升级', pending.length, 0);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
