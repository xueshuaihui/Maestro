// AC-31 角色实例顺序稳定且不重复（夹具 + 机检）
import {
  makeCase, freshRoot, roleListJson, roleIdsOf, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { startTaskLoopWriter } from './_fixtures.mjs';

const AC = 'AC-31';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：task-loop 运行中
    const { h, paused } = await startTaskLoopWriter(root);
    try {
      c.check('Given 夹具：.mock/paused 存在（实例 running）', Boolean(paused), paused ? 'paused 存在' : '未等到 paused');

      // When：连续两次读
      const first = roleListJson(root);
      const second = roleListJson(root);
      c.cmd(first.res, 'orch role list --instance INST-001 --format json（第 1 次）');
      c.cmd(second.res, 'orch role list --instance INST-001 --format json（第 2 次）');
      const a = roleIdsOf(first.payload);
      const b = roleIdsOf(second.payload);
      c.evJson('orders', { first: a, second: b });

      // Then
      c.deepEq('Then 两次的 roleId 顺序完全一致', b, a);
      c.deepEq('And 都是 researcher / reviewer / writer', a, ['researcher', 'reviewer', 'writer']);
      c.check('机检：两次输出逐字节相同（NFR-04）',
        JSON.stringify(first.payload) === JSON.stringify(second.payload),
        `第 1 次 ${a.length} 条 / 第 2 次 ${b.length} 条`);
      c.check('机检：没有重复角色', new Set(a).size === a.length, JSON.stringify(a));
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-pass --keep（MAESTRO_TEST_PAUSE=after_accepted:T-002）', h);
    }

    return finish(c);
  }
}];
