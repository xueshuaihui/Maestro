// AC-45 attach 找不到会话（异常 / mock 夹具面）
import {
  makeCase, freshRoot, attachHold, instanceIds, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-45';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：没有 SES-999
    const idsBefore = instanceIds(root);
    c.check('Given：项目根没有 SES-999', idsBefore.length === 0, idsBefore.join(','));

    // When：orch attach SES-999
    const res = c.cmd(await attachHold(root, 'SES-999'), 'orch attach SES-999');
    c.eq('Then：输出「未找到会话 SES-999」', text(res).trim(), '未找到会话 SES-999');
    c.eq('Then：退出码 1', res.exitCode, 1);
    c.eq('机检：没有状态写入（不创建实例）', instanceIds(root).length, 0);
    c.eq('机检：没有状态写入（实例目录集合前后逐字一致）', JSON.stringify(instanceIds(root)), JSON.stringify(idsBefore));
    c.notIncludes('机检：没有状态写入（输出不含已附着会话行）', text(res), '已附着会话');
    c.notIncludes('机检：没有状态写入（输出不含审批行）', text(res), '审批 APR-');
    return conclude(c, root);
  },
}];
