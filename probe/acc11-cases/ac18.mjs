// AC-18 三处数字一致：机检 queue.test.js（D-36 totals 只读快照字段 + AC-13 三处数字序列）
// + e2e.test.js（AC-38 真链路三处数字同源）；D-36 函数体切块脚本（D-53 行号漂移 900→1018 按函数体锚点）。
// 架构检查按 v12/D-55 口径 6 条；第 5 条改为「零自算」（排除注释与 D-9 探针字段名），不放宽真实计数零命中要求。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-18';
const SHAPE_SCRIPT = `node --input-type=module -e 'import fs from "node:fs";import path from "node:path";const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap((e)=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);const COUNT=/(\\.filter\\(|\\.reduce\\(|\\.length|\\+= *1|\\.push\\()/;const hits=[];for(const f of walk("src/daemon").filter((x)=>x.endsWith(".js"))){const lines=fs.readFileSync(f,"utf8").split("\\n");let fn="<top>";for(let i=0;i<lines.length;i++){const m=lines[i].match(/^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+([A-Za-z0-9_$]+)/);if(m)fn=m[1];if(!lines[i].includes("pendingEscalations"))continue;hits.push({f,line:i+1,fn,count:COUNT.test(lines.slice(i,i+4).join("\\n"))});}}const bad=hits.filter((h)=>h.count&&h.fn!=="shapeSnapshot");console.log("occurrences="+hits.length+" countExpr="+hits.filter((h)=>h.count).length+" outsideShapeSnapshot="+bad.length);process.exit(bad.length===0?0:1)'`;
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '一致性 / 计数 / 机检',
  async run() {
    const c = makeCase(AC, { face: '一致性 / 计数 / 机检', grade: 'mock 实测' });
    // e2e.test.js 走真实 server.listen()（<root>/.orch/core.sock，macOS sun_path 上限 104 字节）；
    // 本机 os.tmpdir() 长路径经 caseTmp 叠加后 119 字节触发截断 + EADDRINUSE（假阴性），改用短 TMPDIR，断言不变。
    const tmp = ensureDir(`/tmp/m11b-${AC}`);
    machineChecks(c, {
      files: ['queue.test.js', 'e2e.test.js'],
      arch: [
        { cmd: 'grep -REn "pendingEscalations" src/daemon/', expect: 0, note: 'AC-18 架构①：daemon 透传行存在（基线 5 行；D-53 行号漂移后实测 9 行，允许新增同类透传，不得新增计数表达式），有命中 exit 0' },
        { cmd: 'grep -REn -A3 "pendingEscalations" src/daemon/', expect: 0, contains: "escalations.filter((entry) => entry?.state === 'pending').length", note: 'AC-18 架构②：多行感知检出跨行计数表达式（server.js shapeSnapshot 回退，基线 905→现 1023 行按 D-53 漂移）' },
        { cmd: SHAPE_SCRIPT, expect: 0, contains: 'outsideShapeSnapshot=0', note: 'AC-18 架构③：函数体切块——daemon 计数表达式只许在 shapeSnapshot 内（D-36，单行 grep 假阴性已弃用）' },
        { cmd: 'grep -REn "escalations[.]filter|escalations[.]reduce" src/daemon/', expect: 0, lines: 1, note: 'AC-18 架构④：escalations.filter/reduce 恰好 1 条（server.js:1023 回退计数），不得新增第二条' },
        { cmd: 'grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src | grep -vE ":\\s*[0-9]+:\\s*(//|\\*)" | grep -vE "\\\"pendingEscalations\\\"\\s*:"', expect: 1, note: 'AC-18 架构⑤（v12/D-55）：界面与壳层零自算——排除 //、///、* 注释行与 D-9 要求下发的 tray-status 探针字段名（真实计数表达式仍零命中，exit 1）' },
        { cmd: 'grep -REn "escalations[.]filter" desktop/ui/', expect: 1, note: 'AC-18 架构⑥：界面不按条目数组自行过滤计数，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const e2e = c.testRuns.find((t) => t.file === 'e2e.test.js');

    // 需求 Then 逐字三处数字（权威期望，不按代码现状改写）：初始 4=3+1 / 托盘 2（只数升级）；
    // 处置升级后 队列3 / 托盘1 / INST-001 行2；处置审批后 队列2 / 托盘1（审批不计入）/ INST-001 行1。
    c.check('三处数字逐字（需求 Then）：初始 队列4 / 托盘2 / INST-001=3 / INST-002=1（3+1=4）',
      Boolean(q?.v?.ok && e2e?.v?.ok),
      `queue # pass ${q?.tap?.pass ?? 0} / e2e # pass ${e2e?.tap?.pass ?? 0}`,
      'queue.total === Σ instances.pendingCount = 3+1 = 4；tray 待处理升级 M=2（只数升级）');
    c.check('处置一条升级后：队列 3 / 托盘 1 / INST-001 行 2（2 秒内同步）',
      Boolean(q?.v?.ok && e2e?.v?.ok),
      `# pass queue ${q?.tap?.pass ?? 0} / e2e ${e2e?.tap?.pass ?? 0}`,
      '处置升级后 队列3 / 托盘1 / INST-001 行2');
    c.check('再处置一条审批后：队列 2 / 托盘仍 1（审批不计入托盘升级数）/ INST-001 行 1',
      Boolean(q?.v?.ok && e2e?.v?.ok),
      `# pass queue ${q?.tap?.pass ?? 0} / e2e ${e2e?.tap?.pass ?? 0}`,
      '处置审批后 队列2 / 托盘1 / INST-001 行1');
    // D-36 数据侧：totals 只读既有快照字段，不按数组重算。
    c.check('D-36 数据侧：queue.test.js totals 只读快照字段不重算（pendingEscalations=5 直接透传）',
      Boolean(q?.subtests?.some((x) => /totals 只读既有快照计数字段.*AC-18/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /totals 只读/.test(x)).join(' | ') || '（未找到）',
      'queue.totals.pendingEscalations === 5（快照字段，非 filter 计数）');
    c.check('AC-13 三处数字各自同步用例存在（机检序列由该用例 + AC-38 承载）',
      Boolean(q?.subtests?.some((x) => /跨实例分别处置互不影响.*AC-13/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /跨实例分别处置/.test(x)).join(' | ') || '（未找到）',
      'countsOf 三处数字序列；机检由 queue.test.js 承载');

    // 语义复核：arch⑤ 的 2 条命中来自 tray.rs 文档注释 + tray-status 探针字段名（§3.3 要求下发），
    // 且 tray.pending 取自 daemon 投影 item.pending.escalations，并非壳层自行计数。
    const shellHits = runCmd('grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src', { tmpdir: tmp });
    c.cmd(shellHits, '语义复核：arch⑤ 桌面壳层命中原文');
    const src = runCmd("sed -n '296,306p' desktop/src-tauri/src/main.rs", { tmpdir: tmp });
    c.cmd(src, '语义复核：tray.pending 取值来源（daemon 投影 vs 壳层自算）');
    c.check('语义复核：arch⑤ 命中为探针字段名/注释，pending 来自 daemon 投影 item.pending.escalations（非壳层自算）',
      /tray-status/.test(shellHits.stdout) && /get\("pending"\)/.test(src.stdout),
      `${shellHits.stdout.trim().split('\n').slice(0, 4).join(' | ')} || ${src.stdout.trim().split('\n').slice(0, 6).join(' | ')}`,
      'tray.rs:103 注释 + tray.rs:113 探针字段名（§3.3 要求）；main.rs 读 item.pending.escalations 下发');

    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/queue-count.test.js（本分支不存在），三处数字断言合并进 test/wp14/queue.test.js「跨实例分别处置互不影响，三处数字各自同步（AC-13）」+「buildQueue totals 只读快照字段（D-36 / AC-18 数据侧）」+ test/wp14/e2e.test.js「AC-38 三处数字同步」真链路。按实际文件机检并登记说明，不放宽。');
    c.note('D-36/D-53 口径：单行 grep 判零计数是假阴性（server.js:905 跨行表达式漏检），已改用函数体切块脚本（arch③）；shapeSnapshot 行号随迭代漂移（基线 900→当前 1018），按函数体锚点而非行号判定。arch③ 实测 occurrences=9 / countExpr=2 / outsideShapeSnapshot=0（基线 occurrences=5，新增 4 行均为同类透传，D-36 允许）；core/persistence 既有计数与 shapeSnapshot 未改（D-36/D-11 未授权改）。');
    c.note('D-55 裁决已落实：需求 v12 把架构⑤从「pendingEscalations 字面零命中」改为「零自算」——排除注释行与 D-9/§3.3 明确要求下发的 tray-status 探针字段名（main.rs:300 从 daemon 投影 item.pending.escalations 读取，壳层不计数）。①~④ 多行感知 + 函数体切块 + 真实计数表达式零命中断言全部保留，界面/壳层零自算语义不放宽。');
    return finish(c);
  }
}];
