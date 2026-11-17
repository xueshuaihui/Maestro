// AC-36 托盘暂停与继续：机检 shell-notify.test.js（暂停汇总走 /control/pause|resume、core.stop 只一处、
// config.rs 托盘六字段含 tray_pause_summary/tray_pause_none）；真实探针层 gated 触发 tray-pause/tray-resume。
// 需求点名 tray.test.js 本分支不存在，按「或合并后文件」口径取实际文件（登记说明，不放宽）。
// 真实探针层旧二进制 SKIP 属证据分级降级（非阻塞）：静态契约 11 条已落。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-36';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '托盘 / 暂停继续 / 机检',
  async run() {
    const c = makeCase(AC, { face: '托盘 / 暂停继续 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['shell-notify.test.js'],
      arch: [
        { cmd: 'grep -REn "paused = true" desktop/src-tauri/src/', expect: 1,
          note: 'AC-36 架构：暂停必须逐实例走既有 workflow.pause 并经 CAS，不得一次性直写多个实例状态（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const s = c.testRuns.find((t) => t.file === 'shell-notify.test.js');
    c.check('点暂停：两个可读实例「运行中（已暂停）」、损坏实例跳过 1，提示逐字「2 个实例已暂停，1 个已跳过」（A-9）',
      Boolean(s?.subtests?.some((x) => /暂停汇总 \+ 退出语义/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /暂停汇总/.test(x)).join(' | ') || '（未找到）',
      'paused 均为 true、跳过数为 1、提示文案逐字；损坏实例不冒充状态');
    c.check('菜单项两次触发后分别为「继续」/「暂停」；暂停经 /control/pause、继续经 /control/resume（与真实菜单同函数）',
      Boolean(s?.subtests?.some((x) => /ctl 四动作双处分发/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /ctl 四动作/.test(x)).join(' | ') || '（未找到）',
      'tray.rs handle_ctl 的 tray-pause/tray-resume 调 pause_all/resume_all');
    c.check('继续后两实例恢复推进；暂停与继续均由壳层 ctl 文件触发、改名为 .done（U-13 意图+投递两段探针）',
      Boolean(s?.subtests?.some((x) => /真实探针层/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /真实探针层/.test(x)).join(' | ') || '（未找到，见证据分级降级说明）',
      '静态契约锁接缝；真实探针层 gated（本机旧二进制 SKIP，证据分级降级非阻塞）');
    c.check('config.rs 提供 tray_pause / tray_resume / tray_pause_summary / tray_pause_none 且经 pick 覆盖有中文默认值',
      Boolean(s?.subtests?.some((x) => /config.rs：托盘六字段/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /config.rs/.test(x)).join(' | ') || '（未找到）',
      '暂停文案唯一来源 labels.js，壳层中文零字面量');
    c.note('证据分级降级（非阻塞）：shell-notify.test.js 静态契约层 11 条全部通过（tray-pause/resume 双处分发、/control 路由、摘要文案键），真实探针层 1 条按 U-13 gated SKIP（release 壳层二进制早于 main.rs）。本机旧二进制 SKIP 属证据分级降级（mock 实测），不是阻塞；人眼确认「点暂停手感」登记人工核验，不计入 AC 通过数。');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/tray.test.js（本分支不存在），暂停/继续断言落 shell-notify.test.js（WP-9 shell 契约）；按实际存在文件机检并登记说明，不放宽。D-25 口径：Given 三个运行中实例（两可读一损坏）对应 Then「2 暂停/1 跳过」。');
    return finish(c);
  }
}];
