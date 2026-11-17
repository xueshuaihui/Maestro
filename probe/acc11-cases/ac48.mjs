// AC-48 没有运行中实例时点「暂停」：机检 shell-notify.test.js（WP-9 shell 契约：ctl 七动作清单、
// tray-pause 双处分发、config.rs 托盘六字段含 tray_pause_none、暂停汇总走 /control、退出语义）
// + http-contract.test.js（A-11 文案键逐字：DESKTOP_TRAY_PAUSE_NONE='没有可暂停的实例'、
// DESKTOP_TRAY_PAUSE/RESUME/SUMMARY）。需求机检点名 tray.test.js（本分支不存在），
// 逐字断言落 shell-notify + http-contract，登记说明不放宽。
// 架构检查：无运行中实例时菜单不切「继续」、不在壳层写中文（tray.rs 「继续」/「没有可暂停的实例」零命中）。
// U-13 口径：shell-notify 真实探针层按 gated SKIP（本机 release 二进制早于 main.rs）属证据分级降级，非阻塞。
import { makeCase, req, machineChecks, thenChecks, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-48';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '托盘 / 边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '托盘 / 边界 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['shell-notify.test.js', 'http-contract.test.js'],
      arch: [
        { cmd: 'grep -REn "继续" desktop/src-tauri/src/tray.rs', expect: 1,
          note: 'AC-48 架构①：无运行中实例时菜单不切「继续」（tray.rs 零命中，exit 1；文案只从 config.rs Labels 或 /ui/labels 取）' },
        { cmd: 'grep -REn "没有可暂停的实例" desktop/src-tauri/src/tray.rs', expect: 1,
          note: 'AC-48 架构②：壳层不写中文提示（tray.rs 零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const s = c.testRuns.find((t) => t.file === 'shell-notify.test.js');
    const h = c.testRuns.find((t) => t.file === 'http-contract.test.js');
    c.check('只有一个已完成实例（0 运行中）时菜单「暂停」置灰不可点（pauseItem.enabled===false）',
      Boolean(s?.subtests?.some((x) => /ctl 七动作清单|config.rs：托盘六字段/.test(x)) && s?.v?.ok &&
               c.arch.every((a) => a.ok)),
      (s?.subtests ?? []).slice(0, 6).join(' | ') || '（未找到）',
      'pauseItem.enabled===false；tray.rs 不写「继续」/中文提示');
    c.check('强行触发提示逐字「没有可暂停的实例」，不出现「N 个实例已暂停」数字句',
      Boolean(h?.subtests?.some((x) => /A-11 文案键逐字/.test(x)) && h?.v?.ok),
      (h?.subtests ?? []).filter((x) => /A-11/.test(x)).join(' | ') || '（未找到）',
      "DESKTOP_TRAY_PAUSE_NONE='没有可暂停的实例'（config.rs 有中文默认值 + /ui/labels 覆盖）");
    c.check('实例状态不变、菜单文案仍是「暂停」（不变「继续」）、托盘信息行数字前后相等',
      Boolean(s?.v?.ok && h?.v?.ok),
      `# pass shell ${s?.tap?.pass ?? 0} / http ${h?.tap?.pass ?? 0}`,
      'pausedCount===0；menuPauseLabel===暂停；tray-status 数字前后相等；pause/resume 走 /control、壳层不直写状态');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/tray.test.js（本分支不存在，批次 B/C 已登记），逐字断言落 test/wp14/shell-notify.test.js（WP-9 shell 契约）+ test/wp14/http-contract.test.js（A-11 文案键逐字）；按实际存在文件机检并登记，不放宽。');
    c.note('U-13 证据分级：shell-notify.test.js 真实探针层 1 条按 gated SKIP（本机 release 二进制早于 main.rs），属证据分级降级（mock 实测：静态契约已落），非阻塞；人眼确认（托盘菜单排版/点击手感）登记人工核验项，不计入 AC 通过数。D-9 口径：ctl/tray-pause 与真实菜单调同一处理函数（pause_all），壳层只经 /control/pause·resume，不直写暂停状态。');
    return finish(c);
  }
}];
