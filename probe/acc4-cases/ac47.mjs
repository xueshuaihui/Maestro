// AC-47 handoff show 展示完整内容（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, handoffShow, readState, handoffOf,
  text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-47';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：一张回流交接包，含缺陷与上一版引用
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（HO-002 回流包）');
    const h2 = handoffOf(readState(root), 'HO-002');
    c.eq('Given：HO-002 是回流包', h2?.edge?.kind, 'backflow');
    c.check('Given：HO-002 含缺陷', (h2?.defects ?? []).length >= 1, JSON.stringify(h2?.defects));

    // When：orch handoff show HO-002 --instance INST-001
    const show = c.cmd(handoffShow(root, 'HO-002', 'INST-001'), 'orch handoff show HO-002 --instance INST-001');
    const out = text(show);
    c.eq('Then：退出码 0', show.exitCode, 0);
    c.includes('Then：输出交接包号', out, '交接包 HO-002');
    c.includes('Then：输出实例', out, '实例：INST-001');
    c.includes('Then：输出方向', out, '方向：测试→开发（回流）');
    c.includes('Then：输出状态', out, '状态：');
    for (const k of ['构造：', '待投递：', '投递：', '接受：', '完成：', '拒绝：', '过期：']) {
      c.includes(`Then：各阶段时间行含「${k}」`, out, k);
    }
    c.includes('Then：输出证据', out, '证据：');
    // 机检：缺陷摘要与证据位置逐字来自交接包
    for (const d of h2?.defects ?? []) {
      c.includes('机检：缺陷摘要逐字来自交接包', out, d.summary);
      c.includes('机检：证据位置逐字来自交接包', out, d.evidence);
    }
    c.includes('Then：修改要求', out, '修改要求：');
    c.includes('Then：复测要求', out, '复测要求：');
    c.includes('Then：尝试次数', out, '尝试：');
    c.includes('Then：最后一次错误', out, '最后错误：');
    c.includes('Then：信箱路径', out, '信箱：');
    c.includes('机检：「尝试」行的分母为 3', out, '/3');
    c.matches('机检：已尝试次数与 deliveryAttempts 一致', out, new RegExp(`尝试：${h2?.deliveryAttempts ?? 0}/3`));
    // 补齐：把「输出状态/证据/修改要求/复测要求」从「只查标签存在」升级为「值逐字来自交接包」。
    c.includes('机检：状态行逐字为「已完成」（consumed 状态词映射）', out, '状态：已完成');
    c.includes('机检：证据行逐字来自交接包 artifactRefs.input', out,
      `证据：${h2?.artifactRefs?.input?.[0] ?? ''}`);
    if (h2?.revisionRequirement) {
      c.includes('机检：修改要求逐字来自交接包', out, String(h2.revisionRequirement));
    }
    if (h2?.retestRequirement) {
      c.includes('机检：复测要求逐字来自交接包', out, String(h2.retestRequirement));
    }
    return conclude(c, root);
  },
}];
