// AC-38 规划验收句端到端三段：机检 e2e.test.js（AC-38 真链路：通知→队列证据→重派→后续跑+三处数字同步）
// + http-contract.test.js（三段只读接口 GET /queue|/evidence|/occupancy|/instances 同源投影）
// + shell-notify.test.js（notify-open 点击接缝）；短 TMPDIR（macOS socket sun_path 104 字节上限，D-55 口径）。
// 需求点名 acceptance-e2e.test.js 本分支不存在，逐字三段已合并进 e2e.test.js（登记说明，不放宽）。
// 架构检查：三段渲染与 AC-08/AC-32/AC-26 同一批模块，无测试专用渲染分支。
import { makeCase, req, machineChecks, thenChecks, ensureDir, finish } from '../acc11-f-common.mjs';
const AC = 'AC-38';
const RENDER_SCRIPT = `node --input-type=module -e 'import fs from "node:fs";const checks=[["desktop/ui/queue/queue.js","renderQueueRow"],["desktop/ui/evidence/evidence.js","renderEvidence"],["desktop/ui/occupancy/occupancy.js","renderOccupancyRow"]];const miss=checks.filter(([f,k])=>!fs.readFileSync(f,"utf8").includes("export function "+k));console.log("render-modules-missing="+miss.length);process.exit(miss.length?1:0)'`;
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '规划验收 / 端到端 / 机检',
  async run() {
    const c = makeCase(AC, { face: '规划验收 / 端到端 / 机检', grade: 'mock 实测' });
    // e2e.test.js 走真实 server.listen()（<root>/core.sock，macOS sun_path 104 字节上限）；
    // 本机长 os.tmpdir() 经 TMPDIR 叠加触发截断 + EADDRINUSE 假阴性，改用短 TMPDIR（D-55 口径），断言不变。
    const tmp = ensureDir(`/tmp/m11c-${AC}`);
    machineChecks(c, {
      files: ['e2e.test.js', 'http-contract.test.js', 'shell-notify.test.js'],
      arch: [
        { cmd: 'grep -REn "NODE_ENV|__test__|__TEST__|testOnly|test-only|TEST_RENDER" desktop/ui/queue/ desktop/ui/evidence/ desktop/ui/occupancy/', expect: 1,
          note: 'AC-38 架构①：三段渲染模块无测试专用渲染分支（零命中，exit 1）' },
        { cmd: 'grep -REn "buildQueue|buildEvidence|buildOccupancy" src/daemon/http/routes.js', expect: 0, contains: 'buildQueue',
          note: 'AC-38 架构②：三段只读接口复用同一批 daemon 投影模块（buildQueue 等，≥1 命中 exit 0）' },
        { cmd: RENDER_SCRIPT, expect: 0, contains: 'render-modules-missing=0',
          note: 'AC-38 架构③：队列/证据/占用 UI 三段渲染函数各在共享模块导出（与 AC-08/AC-32/AC-26 同批，非测试专用分支）' }
      ],
      tmpdir: tmp
    });
    const e = c.testRuns.find((t) => t.file === 'e2e.test.js');
    const h = c.testRuns.find((t) => t.file === 'http-contract.test.js');
    const s = c.testRuns.find((t) => t.file === 'shell-notify.test.js');
    c.check('段①通知出现：标题附录 A-1 升级标题，正文按「 · 」切恰 5 段、第 1 段「实例 INST-001」、第 2 段逐字「升级 ESC-001」',
      Boolean(e?.subtests?.some((x) => /AC-38：通知 → 队列处置/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /AC-38/.test(x)).join(' | ') || '（未找到）',
      'notify(kind=escalation) 意图含 kind/ids/title/body/mergedCount；bodySegments.length===5');
    c.check('段②队列可见 → 查看证据 → 重派 → 条目消失且实例 5 秒内回运行中（三处数字同步）',
      Boolean(e?.v?.ok), `# pass e2e ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '队列 ESC-001 可见、证据含命令与退出码、处置后队列计数归零、disk.state=running、resolution=retry');
    c.check('段③占用视图「开发」一行参与实例数与活跃会话数与实例流程图状态一致',
      Boolean(e?.v?.ok && h?.subtests?.some((x) => /GET \/occupancy\/roles/.test(x)) && h?.v?.ok),
      `e2e #pass ${e?.tap?.pass ?? 0} / http #pass ${h?.tap?.pass ?? 0}`,
      'devRow.instances≥1、hosts=[mock]；occupancy 与流程图同源（AC-28）');
    c.check('三段事件序列闭环：notify → notify-open → nav(queue,ESC-001) → evidence-shown(T-001) → action(retry) → queue-empty → nav(occupancy) → occupancy-row(开发)',
      Boolean(s?.subtests?.some((x) => /D-9 探针事件名齐全/.test(x)) && e?.v?.ok),
      (s?.subtests ?? []).filter((x) => /D-9 探针/.test(x)).join(' | ') || '（未找到）',
      '探针事件名齐全：notify / notify-open / nav / evidence-shown / action');
    c.check('三段只读接口同源投影：GET /queue|/evidence|/occupancy/roles|/instances 由同一批 buildQueue/buildEvidence/buildOccupancy 驱动',
      Boolean(h?.subtests?.some((x) => /GET \/queue/.test(x)) &&
               h?.subtests?.some((x) => /GET \/evidence/.test(x)) &&
               h?.subtests?.some((x) => /GET \/occupancy\/roles/.test(x)) && h?.v?.ok && c.arch.every((a) => a.ok)),
      (h?.subtests ?? []).filter((x) => /GET \/(queue|evidence|occupancy)/.test(x)).join(' | ') || '（未找到）',
      '队列/证据/占用三段渲染与 AC-08/AC-32/AC-26 同一批模块');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/acceptance-e2e.test.js（本分支不存在），三段逐字断言已合并进 test/wp14/e2e.test.js「AC-38：通知 → 队列处置 → 后续跑 + 三处数字同步」真链路 + http-contract.test.js 三段只读接口；按实际存在文件机检并保留原始 TAP，登记说明不放宽。');
    c.note('D-55/环境假阴性：短 TMPDIR=/tmp/m11c-AC-38 规避 macOS socket 104 字节上限（长 os.tmpdir() 叠加会截断 core.sock 路径致 EADDRINUSE 假阴性），断言一条未改。D-53/live 快照：数据侧断言用磁盘快照 + buildQueue/buildOccupancy，不依赖 getStatus live 快照。shell-notify 真实探针层按 U-13 gated SKIP（本机旧二进制）属证据分级降级，非阻塞。');
    return finish(c);
  }
}];
