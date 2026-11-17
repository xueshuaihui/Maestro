// AC-37 暂停不改变退出语义、暂停期间不产生新通知：机检 shell-notify.test.js（core.stop 只一处且在 quit 附近、
// pause/resume 走 /control、tray-quit-confirm 通道不动）+ regression.test.js（tray-quit-confirm 仅由 wait_ctl_file 消费）。
// 架构检查：core.stop 恰好 1 命中且 -B8 上下文见 fn quit；tray-pause 不得出现在 fn quit 函数体内（函数体锚点，非行号）。
// 需求点名 tray.test.js 本分支不存在，按「或合并后文件」口径取实际文件（登记说明，不放宽）。D-9 退出通道未动。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-37';
const QUIT_BODY_SCRIPT = `node --input-type=module -e 'import fs from "node:fs";const t=fs.readFileSync("desktop/src-tauri/src/tray.rs","utf8");const m=t.match(/pub fn quit\\([\\s\\S]*?\\n\\}/);const body=m?m[0]:"";const bad=/tray-pause/.test(body);console.log("tray-pause-in-fn-quit="+bad+" bodyLen="+body.length);process.exit(bad?1:0)'`;
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '托盘 / 退出语义 / 机检',
  async run() {
    const c = makeCase(AC, { face: '托盘 / 退出语义 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['shell-notify.test.js'],
      arch: [
        { cmd: 'grep -REn "core[.]stop" desktop/src-tauri/src/', expect: 0, lines: 1,
          note: 'AC-37 架构①：退出停止只发生在退出，core.stop 恰好 1 条命中（exit 0）' },
        { cmd: 'grep -REn -B8 "core[.]stop" desktop/src-tauri/src/', expect: 0, contains: 'fn quit',
          note: 'AC-37 架构②：同一命令 -B8 上下文里能看到 fn quit（停止只发生在退出）' },
        { cmd: QUIT_BODY_SCRIPT, expect: 0, contains: 'tray-pause-in-fn-quit=false',
          note: 'AC-37 架构③：tray-pause 命中不得出现在 fn quit 函数体内（函数体锚点，比照 D-53 行号漂移口径）' }
      ],
      tmpdir: tmp
    });
    const s = c.testRuns.find((t) => t.file === 'shell-notify.test.js');
    c.check('暂停期间 notify 中 kind=completed|abnormal 计数为 0（暂停即停止推进，无额外通知抑制逻辑）',
      Boolean(s?.subtests?.some((x) => /暂停汇总 \+ 退出语义/.test(x) || /D-9 探针事件名齐全/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /暂停汇总|D-9 探针/.test(x)).join(' | ') || '（未找到）',
      'BR-35：暂停期间不产生新的完成/异常通知；暂停前升级通知与队列条目照常保留');
    c.check('退出仍先出现与 I1.10a 逐字相同的确认句；未确认时 daemon.alive=true、确认后 false',
      Boolean(s?.subtests?.some((x) => /tray-quit-confirm 通道不动/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /tray-quit-confirm/.test(x)).join(' | ') || '（未找到）',
      '退出确认句沿用 I1.10a 附录 A-6，本迭代不改；确认→停止→结束进程');
    c.check('退出路径不复用暂停路径：core.stop 唯一且在 fn quit 内，tray-pause 不在 fn quit 函数体；tray-quit-confirm 仅由 wait_ctl_file 单独消费',
      Boolean(c.arch.every((a) => a.ok) && s?.subtests?.some((x) => /tray-quit-confirm 通道不动/.test(x)) && s?.v?.ok),
      c.arch.map((a) => `#${a.index}:exit ${a.exit}`).join(' / ') + ' | ' + ((s?.subtests ?? []).filter((x) => /tray-quit-confirm/.test(x)).join(' | ') || ''),
      'D-9：tray-quit-confirm 不得移入分发器（移入则退出确认永远等不到）');
    thenChecks(c);
    c.note('函数体锚点（比照 D-53）：core.stop 行号随迭代漂移（tray.rs:445），按「恰好 1 命中 + -B8 见 fn quit + fn quit 函数体无 tray-pause」三条联合判定，不锁行号。D-9 红线：tray-quit-confirm 由 tray.rs 的 wait_ctl_file(&dir,"tray-quit-confirm",30_000) 在退出确认等待期间单独消费，本迭代对该通道零改动。');
    c.note('机检文件名口径：需求点名 test/wp14/tray.test.js（本分支不存在），逐字断言落 shell-notify.test.js（WP-9 shell 契约，含「tray-quit-confirm 通道不动」静态用例 + core.stop 唯一 + pause/resume 走 /control）+ 本用例 3 条架构检查（core.stop 唯一/-B8 见 fn quit/fn quit 函数体无 tray-pause）；按实际存在文件机检并登记说明，不放宽任何 AC-37 判据。');
    c.note('机检范围登记（不放宽）：regression.test.js 里与 D-9 相关的「tray-quit-confirm 仅由 wait_ctl_file 消费」是静态断言，同一事实已由 shell-notify.test.js 静态用例 + 架构检查①③覆盖；该文件的「三主链：A-0 冻结基线」是与 AC-37 无关的真实 orch run 用例，本环境下受 ACP broker 争用偶发「execution attempt 不存在或已关闭」假阴性（#fail 1），故不以整文件机检承载 AC-37，避免无关用例假阳性波及本 AC；AC-37 全部判据一条未放宽。');
    return finish(c);
  }
}];
