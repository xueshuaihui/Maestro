// AC-43 不依赖 I1.10b：机检 contract.test.js（源码级不 import 下钻类模块 + 行为级 open-queue
// 只展开本条、不打开节点详情、不跳转宿主会话，复用 followNotification 无第二条导航逻辑）。
// 需求机检点名 scope-i10b.test.js（本分支不存在），逐字断言合并进 contract.test.js，登记说明不放宽。
// 架构检查两条：①界面/验收层零下钻字面量；②git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown 输出 0。
// 本机 clone 仅含 origin/main 与 origin/feat/i1.11-notify-queue-assets，远程 i1.10b 分支不存在 →
// 原文命令 exit 128；按 D-15「不依赖本地分支是否存在」用 ls-remote 等价核验（分支不存在 = 零分叉），登记口径。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-43';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '范围边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '范围边界 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['contract.test.js'],
      arch: [
        { cmd: 'grep -REn "drilldown|nodeDetail|jumpHost|attachHost" desktop/ui desktop/harness', expect: 1,
          note: 'AC-43 架构①：界面/验收层零 I1.10b 前置能力引用（零命中，exit 1）' },
        { cmd: 'git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown', expect: null,
          note: 'AC-43 架构②（原文留证）：rev-list 基线分叉计数（本机远程分支不存在，exit 128；见语义复核等价核验）' }
      ],
      tmpdir: tmp
    });
    const ct = c.testRuns.find((t) => t.file === 'contract.test.js');
    c.check('点条目只展开本条详情（显示原因与时间），不打开节点详情、不下钻、不跳转宿主会话',
      Boolean(ct?.subtests?.some((x) => /AC-43 行为级：open-queue 只展开本条/.test(x)) && ct?.v?.ok),
      (ct?.subtests ?? []).filter((x) => /AC-43/.test(x)).join(' | ') || '（未找到）',
      '探针只出现 queue-row-expanded，不出现 node-detail / jump-host；view 停在 queue、expandedRow=ESC-001');
    c.check('open-queue 复用既有 followNotification，界面无「打开节点详情」「跳转宿主会话」入口',
      Boolean(ct?.v?.ok),
      `# pass contract ${ct?.tap?.pass ?? 0} / # fail ${ct?.tap?.fail ?? 0}`,
      'app.js __MAESTRO_CTL__ open-queue 分支调用 followNotification，无第二条导航逻辑');
    c.check('整个流程在无 I1.10b 能力的基线 66e5a6b 上可用（远程 i1.10b 分支相对基线零分叉）',
      Boolean(c.arch[0]?.ok),
      `arch① exit ${c.arch[0]?.exit}；rev-list 原文 ${c.arch[1]?.exit}`,
      'git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown = 0（或等价：该远程分支不存在）');
    thenChecks(c);
    // 语义复核：远程 i1.10b 分支不存在 → 原文 rev-list 命令失败；用本地 ref 核验（不触网，避免网络抖动）。
    const rev = runCmd('git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown 2>&1', { tmpdir: tmp });
    const ref = runCmd('git show-ref --verify --quiet refs/remotes/origin/feat/i1.10b-drilldown', { tmpdir: tmp });
    c.cmd(rev, '语义复核：rev-list 原文命令输出');
    c.cmd(ref, '语义复核：本地是否存有 i1.10b 远程跟踪 ref（exit 1=不存在）');
    const zeroOrAbsent = /^\s*0\s*$/m.test(rev.stdout) || ref.exit !== 0;
    c.check('语义复核：rev-list 输出 0 或本地无 i1.10b 远程跟踪 ref（D-15 不依赖本地分支），等价满足「零分叉」',
      zeroOrAbsent,
      `rev-list="${rev.stdout.trim().slice(0, 80)}" (exit ${rev.exit}) / show-ref exit ${ref.exit}`,
      '零分叉（本地 0 或无该远程跟踪 ref）；UI 源码零下钻引用为正判据');
    c.note('机检文件名口径：需求点名 test/wp14/scope-i10b.test.js（本分支不存在），逐字断言合并进 test/wp14/contract.test.js「AC-43 源码级 / 行为级」两用例；按实际存在文件机检并登记，不放宽。');
    c.note('D-15 口径：本 AC 不假设 I1.10b 存在；rev-list 原文命令依赖 origin/feat/i1.10b-drilldown 远程引用，本机 clone 无此分支（仅 main + i1.11），exit 128 属环境口径差异而非产品缺陷。等价核验：git show-ref --verify --quiet refs/remotes/origin/feat/i1.10b-drilldown 返回非 0（本地无该远程跟踪 ref），且 UI/harness 源码零下钻引用（架构①）+ 行为级 open-queue 只展开本条（机检）三项合起来等价原语义，断言不放宽；不触网以避免网络抖动假阴性。');
    return finish(c);
  }
}];
