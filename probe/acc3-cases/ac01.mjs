// AC-01 发起通用任务闭环，三节点按序建好（夹具：doc-hold-research + 产品 status）。
import {
  makeCase, freshRoot, prepareOnly, startKeep, statusText, coreStop, forceKillCore,
  text, lines, instanceIds, readState, nodeOf, exists, workspacePath, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-01';
const SCENARIO = 'doc-hold-research';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '发起通用任务闭环，三节点按序建好',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：全新项目根，先 --prepare-only 备现场
    c.cmd(prepareOnly(root, SCENARIO), 'driver --scenario doc-hold-research --prepare-only（备现场）');

    // When：--keep 发起，停在 T-001 的 session/prompt 之前
    const h = startKeep(root, SCENARIO, [], undefined, 20000);

    try {
      const ready = await h.waitOutput((s) => {
        const ls = lines(s).filter((l) => l.trim().length > 0);
        return ls.length >= 3 && s.includes('实例 INST-001 · 运行中 · 模板 通用任务闭环')
          && ls.some((l) => l === '任务已投递');
      }, 10000);
      const threeLineMs = Date.now() - h.startedAt;
      c.check('10 秒内输出含「实例 INST-001 · 运行中 · 模板 通用任务闭环」（前三行已到齐）', Boolean(ready), `${threeLineMs}ms；实际字节 ${h.stdout.length}`);

      const head = lines(h.stdout).filter((l) => l.trim().length > 0);
      c.eq('第 1 行是「实例 INST-001 · 运行中 · 模板 通用任务闭环」', head[0] ?? '', '实例 INST-001 · 运行中 · 模板 通用任务闭环');
      c.matches('第 2 行匹配 ^会话已创建 \\S+$', head[1] ?? '', /^会话已创建 \S+$/);
      c.eq('第 3 行是「任务已投递」', head[2] ?? '', '任务已投递');

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('输出含「节点 T-001 研究员 执行中 · 第 1 轮」', t, '节点 T-001 研究员 执行中 · 第 1 轮');
      c.includes('输出含「节点 T-002 撰写者 待执行」', t, '节点 T-002 撰写者 待执行');
      c.includes('输出含「节点 T-003 审核者 待执行」', t, '节点 T-003 审核者 待执行');

      // 机检
      const s = readState(root);
      c.eq('机检：实例号是 INST-001', s?.instanceId, 'INST-001');
      c.eq('机检：nodes 依次为 T-001/T-002/T-003', (s?.nodes ?? []).map((n) => n.nodeId).join(','), 'T-001,T-002,T-003');
      c.eq('机检：roleId 依次为 researcher/writer/reviewer', (s?.nodes ?? []).map((n) => n.roleId).join(','), 'researcher,writer,reviewer');
      const others = ['T-002', 'T-003'].map((id) => {
        const n = nodeOf(s, id);
        return `${id}=${n?.state}/${n?.round}`;
      }).join(',');
      c.eq('机检：T-001 是 running 且 round=1', `${nodeOf(s, 'T-001')?.state}/${nodeOf(s, 'T-001')?.round}`, 'running/1');
      c.eq('机检：T-002/T-003 是 pending 且 round=0', others, 'T-002=pending/0,T-003=pending/0');
      const ws = workspacePath(root);
      c.check('机检：workspace/artifacts/docs 存在', exists(`${ws}/artifacts/docs`), `${ws}/artifacts/docs`);
      c.check('机检：workspace/artifacts/reports 存在', exists(`${ws}/artifacts/reports`), `${ws}/artifacts/reports`);
      c.check('机检：.orch/instances 下只有 INST-001', instanceIds(root).join(',') === 'INST-001', instanceIds(root));
      c.snap(root, 'state.live');
      c.note('`state.live.json` 是 status 断言时刻的原始快照（T-001 running）；收尾 `state.json` 是 orch core stop 之后的产品快照（非终态实例按既有口径记 interrupted），两者不是同一时刻。');
    } finally {
      await h.stop();
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
      c.keep('driver --scenario doc-hold-research --keep 最终输出（长驻进程由脚手架终止，exit 不作产品退出码）', h, h.argv);
    }
    return finish(c);
  }
}];
