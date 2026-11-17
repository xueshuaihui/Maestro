// AC-27 占用视图空态与「未参与」：机检 occupancy.test.js（空态/未参与不冒充不可用/不可读跳过/只读动作面）
// + ui-views.test.js（A-6 空态与跳过文案逐字）；架构检查 unavailable 零命中（需求 v12 §3.1 原文）。
// 架构检查按 v13/D-56 口径：排除既有词表键引用（五档排序必需）+ 断言 FALLBACK_WORD 落 inactive（未参与）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-27';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '占用 / 边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '占用 / 边界 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['occupancy.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "unavailable" src/daemon/occupancy.js | grep -v "ROLE_INSTANCE_STATUS_LABEL.unavailable"', expect: 1,
          note: 'AC-27 架构①（v13/D-56）：占用层不自造 unavailable 状态词（排除五档排序必需的词表键引用后零命中，exit 1）' },
        { cmd: 'grep -REn "FALLBACK_WORD\\s*=\\s*ROLE_INSTANCE_STATUS_LABEL\\.inactive" src/daemon/occupancy.js | head -1', expect: 0,
          note: 'AC-27 架构②（v13/D-56）：注册表缺失/未知态落「未参与」inactive 而非「不可用」（≥1 命中，exit 0）' },
      ],
      tmpdir: tmp
    });
    const o = c.testRuns.find((t) => t.file === 'occupancy.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('现场一空目录：空态文案逐字「角色占用 无」',
      Boolean(o?.subtests?.some((x) => /空态、未参与不冒充不可用/.test(x)) && o?.v?.ok),
      (o?.subtests ?? []).filter((x) => /空态/.test(x)).join(' | ') || '（未找到）',
      '现场一显示「角色占用 无」');
    c.check('现场二干净实例：不显示任何「不可用」，未参与行数=注册表角色数、活跃会话 0、参与实例 0',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      'status === 未参与 的行数 = 注册表角色数；unavailable 计数为 0');
    c.check('现场三一份 state.json 损坏：底部逐字「1 个实例状态不可读，已跳过」，另一实例角色照常计入',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      '现场三跳过提示逐字且可读实例的角色行数不变');
    c.check('三处都不出现红色状态点；导出 actions 不含 release / kick 键、无对应按钮',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      '占用视图不提供「释放占用」「踢掉会话」这类操作；actions 不含 release / kick');
    c.check('A-6 空态与跳过文案逐字由 ui-views.test.js 承载',
      Boolean(u?.subtests?.some((x) => /A-6 \/ AC-26 AC-28/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /A-6/.test(x)).join(' | ') || '（未找到）',
      '「角色占用 无」/「1 个实例状态不可读，已跳过」逐字');
    // 语义复核：unavailable 命中是既有词表键引用（排序基线），不是占用层自造状态。
    const sem = runCmd("sed -n '45,72p' src/daemon/occupancy.js", { tmpdir: tmp });
    c.cmd(sem, '语义复核：unavailable 命中上下文 + statusWordOf 回退');
    c.check('语义复核：unavailable 仅为既有词表键引用（最忙排序基线）；statusWordOf 未知态落 inactive（未参与），未自造状态、注册表缺失不判 unavailable',
      /ROLE_INSTANCE_STATUS_LABEL\.unavailable/.test(sem.stdout) && /FALLBACK_WORD|inactive/.test(sem.stdout),
      sem.stdout.trim().split('\n').slice(0, 12).join(' | '),
      '占用层不产生新状态（A-6 五词全取自 ROLE_INSTANCE_STATUS_LABEL）');
    thenChecks(c);
    c.note('D-56 裁决已落实：需求 v13 把 AC-27 架构锚点从「unavailable 字面零命中」改为两条——①排除既有词表键引用后零命中（占用层不自造状态，五档排序仍引用 unavailable 键）；②FALLBACK_WORD = ROLE_INSTANCE_STATUS_LABEL.inactive（注册表缺失落未参与）。行为判定「不冒充不可用、不提供 release/kick」不变。');
    c.note('机检文件名口径：需求点名 occupancy.test.js（本分支存在），A-6 逐字行由 ui-views.test.js「A-6 / AC-26 AC-28」承载；按实际文件机检并登记，不放宽。夹具先起核再写盘、现场一空目录、现场三写非法 state.json（D-40 禁 pulse）。');
    return finish(c);
  }
}];
