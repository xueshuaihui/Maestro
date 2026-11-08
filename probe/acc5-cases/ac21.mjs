// AC-21 每个图角色恰好一个角色实例（夹具 + 机检）
import {
  makeCase, freshRoot, TASK_DRIVER, startDriver, waitPaused, roleListJson, viewOf,
  baseEnv, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-21';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：task-loop 运行中（研究已完成、撰写执行中）—— 暂停在撰写接受交接之后
    const h = startDriver(root, ['--scenario', 'doc-pass', '--keep'], {
      driver: TASK_DRIVER,
      env: baseEnv({ MAESTRO_TEST_PAUSE: 'after_accepted:T-002' }),
      timeout: 90000
    });
    try {
      const paused = await waitPaused(root, { timeout: 60000 });
      c.check('Given 夹具：.mock/paused 存在（撰写回合在飞行、实例仍 running）', Boolean(paused),
        paused ? 'paused 存在' : '未等到 paused');

      const { res, payload } = roleListJson(root);
      c.cmd(res, 'orch role list --instance INST-001 --format json');
      c.evJson('payload', payload);

      const views = payload?.instance?.roles ?? [];
      c.eq('Then instance.roles 长度 3', views.length, 3);
      c.deepEq('Then 顺序为 researcher / reviewer / writer（分组顺序 → id 字典序）',
        views.map((v) => v.roleId), ['researcher', 'reviewer', 'writer']);
      c.check('机检：没有重复角色', new Set(views.map((v) => v.roleId)).size === 3,
        JSON.stringify(views.map((v) => v.roleId)));
      c.check('Then 每个元素都带 roleId 与 roleInstanceId',
        views.every((v) => typeof v.roleId === 'string' && typeof v.roleInstanceId === 'string'),
        JSON.stringify(views.map((v) => [v.roleId, v.roleInstanceId])));
      c.check("机检：每个元素的 roleInstanceId === 'RI-' + roleId（A-6 的键，不是 instanceId）",
        views.every((v) => v.roleInstanceId === `RI-${v.roleId}`),
        JSON.stringify(views.map((v) => v.roleInstanceId)));
      c.eq('机检：去重后角色数仍为 3', new Set(views.map((v) => v.roleId)).size, 3);
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-pass --keep（MAESTRO_TEST_PAUSE=after_accepted:T-002）', h);
    }

    return finish(c);
  }
}];
