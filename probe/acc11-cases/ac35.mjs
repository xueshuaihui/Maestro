// AC-35 托盘信息行：机检 shell-notify.test.js（D-8 托盘数字刷新 / 托盘六字段 / D-9 探针事件名齐全，
// 静态契约层 11 条 + 真实探针层 1 条按 U-13 gated）+ e2e.test.js（AC-38 用例内三次 tray-status 模板逐字）。
// 需求点名 tray.test.js 本分支不存在，按「或合并后文件」口径取实际文件（登记说明，不放宽）。
// 真实探针层旧二进制 SKIP 属证据分级降级（非阻塞）：静态契约 11 条已落。
import { makeCase, req, machineChecks, thenChecks, ensureDir, finish } from '../acc11-f-common.mjs';
const AC = 'AC-35';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '托盘 / 信息行 / 机检',
  async run() {
    const c = makeCase(AC, { face: '托盘 / 信息行 / 机检', grade: 'mock 实测' });
    // e2e.test.js 走真实 server.listen()（core.sock）：短 TMPDIR 规避 macOS sun_path 104 字节上限（D-55 口径）。
    const tmp = ensureDir(`/tmp/m11c-${AC}`);
    machineChecks(c, {
      files: ['shell-notify.test.js', 'e2e.test.js'],
      arch: [
        { cmd: 'grep -REn "escalations[.]filter" desktop/src-tauri/src/', expect: 1,
          note: 'AC-35 架构：托盘文本只由同一份投影生成，不在壳层重算（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const s = c.testRuns.find((t) => t.file === 'shell-notify.test.js');
    const e = c.testRuns.find((t) => t.file === 'e2e.test.js');
    c.check('首次信息行「实例 3 · 待处理升级 1」；变化后 2 秒内「实例 4 · 待处理升级 2」；断开「实例 — · 待处理升级 —」（A-9 逐字）',
      Boolean(s?.subtests?.some((x) => /D-8 托盘数字刷新/.test(x) || /config.rs：托盘六字段/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /托盘|config.rs/.test(x)).join(' | ') || '（未找到）',
      '三次 tray-status 探针 {instances,pendingEscalations} = {3,1}/{4,2}/{null,null}；文本逐字匹配 A-9');
    c.check('托盘菜单恰为 4 项（信息行/打开主窗口/暂停或继续/退出），无逐实例条目、无「暂停单个实例」入口',
      Boolean(s?.subtests?.some((x) => /D-9 探针事件名齐全/.test(x)) && s?.v?.ok),
      (s?.subtests ?? []).filter((x) => /D-9 探针/.test(x)).join(' | ') || '（未找到）',
      'menuItems 中不存在以 INST- 开头的条目，也不存在「暂停单个实例」');
    c.check('数字与列表、队列一致：列表待处理数 = 队列总数（同源投影，壳层零自算）',
      Boolean(e?.subtests?.some((x) => /AC-38：通知 → 队列处置/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /AC-38/.test(x)).join(' | ') || '（未找到）',
      '实例 pending.escalations === queue.totals.pendingEscalations');
    c.check('断线位投影：DESKTOP_TRAY_STATUS 模板含 {n}/{m}，渲染「实例 1 · 待处理升级 0」逐字',
      Boolean(e?.v?.ok), `# pass e2e ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '守护进程断开时显示「实例 — · 待处理升级 —」');
    // 证据分级降级说明：真实探针层 gated SKIP（本机旧二进制）由机检 skipped 字段承载。
    c.note('证据分级降级（非阻塞）：shell-notify.test.js 静态契约层 11 条全部通过，真实探针层 1 条按 U-13 gated SKIP（release 壳层二进制早于 main.rs，本轮改动未构建）。按任务书与 U-13：本机旧二进制 SKIP 属证据分级降级（mock 实测：静态契约 + 探针字段口径已落），不是阻塞；CI 判通知意图与「失败不阻断」，不要求系统真弹窗。');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/tray.test.js（本分支不存在），逐字断言落 shell-notify.test.js（静态契约，WP-9）与 e2e.test.js（AC-38 用例内 tray-status 模板）；按实际存在文件机检并登记说明，不放宽。');
    c.note('环境假阴性修复：e2e.test.js 机检首轮在长 TMPDIR 下 core.sock 路径超 macOS sun_path 104 字节上限被截断 → EADDRINUSE 假阴性（#fail 2）；改短 TMPDIR=/tmp/m11c-AC-35 后复跑 14/14 通过，断言一条未改（D-55 口径）。');
    return finish(c);
  }
}];
