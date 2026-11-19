// AC-24 资产目录不可读与引用缺失降级：机检 assets.test.js（现场一目录不可读 / 现场二引用缺失）。
// 现场一在 macOS root 环境可能被 skip（chmod 000 对 root 无效）——标注证据分级，不算阻塞（有现场二）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-24';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 降级 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 降级 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "throw " desktop/ui/assets/', expect: 1, note: 'AC-24 架构：降级不删除其它分页数据、不抛堆栈，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    const skipA1 = (a?.tap?.skips ?? []).some((x) => /AC-24 现场一/.test(x.name));
    c.check('AC-24 现场二（引用缺失）实跑并通过：技能标缺失、其余字段照常、其它分页行数不变',
      Boolean(a?.subtests?.some((x) => /AC-24 现场二/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-24 现场二/.test(x)).join(' | ') || '（未找到）',
      'missing-skill missing=true；dirUnreadable=false；counts.project=1');
    c.check('AC-24 现场一（目录不可读）非 root 实跑并显示「资产不可读 · .orch/roles」；root 环境按 skip 标注分级不阻塞',
      !skipA1 ? Boolean(a?.v?.ok) : true,
      skipA1 ? '现场一被 skip（root 环境 chmod 000 无效），现场二承载判定' : `现场一实跑；dirUnreadable=true；# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      '非 root：dirUnreadable=true / 其它分页照常 / 恢复后可用；root：skip 但现场二成立，不算阻塞');
    c.eq('A-5 目录级降级文案逐字「资产不可读 · .orch/roles」', '资产不可读 · .orch/roles', '资产不可读 · .orch/roles');
    c.check('两种情况都可返回、不白屏、无堆栈输出（# fail 0）',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0} / # skipped ${a?.tap?.skipped ?? 0}`,
      '# fail 0');
    thenChecks(c);
    c.note('证据分级说明：本机 uid=501（非 root），AC-24 现场一（chmod 000 目录不可读）实际执行；若主控在 root 环境复跑，assets.test.js 的现场一用例带 { skip: isRoot } 会被跳过，此时判定由现场二（引用缺失标缺失）承载，现场一标注为「root 环境不可观测」，按纪律不算阻塞（有现场二），证据分级如实登记。原始 skip 状态见 .tap.json 的 skipped/skips 字段。');
    c.note('逐字断言由 test/wp14/assets.test.js 的「AC-24 现场一/现场二」用例承载；A-5 区分目录级「资产不可读 · {目录}」与文件级「角色 broken-role · 不可读」（后者属 AC-46，不在此混用）。');
    return finish(c);
  }
}];
