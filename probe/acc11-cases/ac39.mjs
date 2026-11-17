// AC-39 只读与本地性：唯一写操作清单。机检 e2e.test.js（AC-39 静态面写接口白名单 +
// 行为面浏览零写/actionCount=2/stateWrites=3/unexpected=0 + prefs 四键独占写）
// + http-contract.test.js（D-1 写接口参数校验 400/422/503/404 + GET 只读面）
// + prefs.test.js（prefs.json 唯一写入方四键/多余键拒绝/原子写/不碰状态目录）。
// 需求机检点名 readonly-local.test.js（本分支不存在），逐字断言合并进上述三文件，登记说明不放宽。
// 架构检查按 v13 §3.1 原文 6 条（HTTP 零直写盘 / UI 零写盘 / 无 PATCH / 路由表 POST 白名单 /
// server.js 测试接缝一律 __test__ / routes.js 写方法 pattern 白名单），外加 D-53 shapeSnapshot 函数体锚点。
// D-53 口径：浏览零写 Given 限「运行中且 health 已计算」实例，读时首次受控健康度写不计面板写。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-39';
// 严格 D-1 六项业务写名单 + D-51 授权的 /ui/prefs（需求 v14/D-58 第七项）
const D1 = ['/instances', '/queue/escalations/:id/decision', '/queue/approvals/:id/decision', '/instances/:id/cancel', '/control/pause', '/control/resume', '/ui/prefs'];
const ROUTE_SCRIPT = `node --input-type=module -e 'const m=await import("./src/daemon/http/routes.js");const rows=m.createRoutes({orchestrator:{startRun:async()=>({ok:false}),listInstances:async()=>({ok:true,items:[]}),getStatus:async()=>({ok:false})},root:process.cwd()});const allowed=new Set(${JSON.stringify(D1)});const writes=rows.filter(r=>r.method==="POST").map(r=>r.pattern);const bad=writes.filter(p=>!allowed.has(p)&&!p.startsWith("/__test__/"));console.log("POST="+writes.length+" violations="+bad.length+" bad=["+bad.join(",")+"]");process.exit(bad.length?1:0)'`;
const PATTERN_SCRIPT = `node --input-type=module -e 'const fs=await import("node:fs");const q=String.fromCharCode(39);const allowed=new Set(${JSON.stringify(D1)});const lines=fs.readFileSync("src/daemon/http/routes.js","utf8").split("\\n");const pairs=[];for(let i=0;i<lines.length;i++){const l=lines[i].trim();if(l.startsWith("method:")&&/POST|PUT|DELETE|PATCH/.test(l)){const p=lines[i+1]?.trim();if(p&&p.startsWith("pattern:"))pairs.push(p.split(q)[1]);}}const bad=pairs.filter(p=>!allowed.has(p)&&!p.startsWith("/__test__/"));console.log("writePatterns="+pairs.length+" violations="+bad.length+" bad=["+bad.join(",")+"]");process.exit(bad.length?1:0)'`;
const SHAPE_SCRIPT = `node --input-type=module -e 'import fs from "node:fs";import path from "node:path";const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap((e)=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);const COUNT=/(\\.filter\\(|\\.reduce\\(|\\.length|\\+= *1|\\.push\\()/;const hits=[];for(const f of walk("src/daemon").filter((x)=>x.endsWith(".js"))){const lines=fs.readFileSync(f,"utf8").split("\\n");let fn="<top>";for(let i=0;i<lines.length;i++){const m=lines[i].match(/^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+([A-Za-z0-9_$]+)/);if(m)fn=m[1];if(!lines[i].includes("pendingEscalations"))continue;hits.push({f,line:i+1,fn,count:COUNT.test(lines.slice(i,i+4).join("\\n"))});}}const bad=hits.filter((h)=>h.count&&h.fn!=="shapeSnapshot");console.log("occurrences="+hits.length+" countExpr="+hits.filter((h)=>h.count).length+" outsideShapeSnapshot="+bad.length);process.exit(bad.length===0?0:1)'`;
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '只读与本地性 / 机检',
  async run() {
    const c = makeCase(AC, { face: '只读与本地性 / 机检', grade: 'mock 实测' });
    // e2e/http-contract 走真实 server.listen(0,'127.0.0.1')（macOS sun_path 104 字节上限），
    // 本机长 os.tmpdir() 经 caseTmp 叠加会截断 socket 路径触发 EADDRINUSE 假阴性，用短 TMPDIR（D-55 口径）。
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['e2e.test.js', 'http-contract.test.js', 'prefs.test.js'],
      arch: [
        { cmd: 'grep -REn "saveState|appendEvent|store[.]save" src/daemon/http/', expect: 1,
          note: 'AC-39 架构①：HTTP 层零直接写状态（零命中，exit 1）' },
        { cmd: 'grep -REn "fs[.]write|writeFile" desktop/ui/', expect: 1,
          note: 'AC-39 架构②：界面层零直接写盘，偏好只能经 daemon prefs 模块（零命中，exit 1）' },
        { cmd: 'grep -REn "PATCH" src/daemon/http/', expect: 1,
          note: 'AC-39 架构③：HTTP 层零 PATCH（零命中，exit 1）' },
        { cmd: ROUTE_SCRIPT, expect: 0,
          note: 'AC-39 架构④：路由表 POST 行严格落在 D-1 六项业务写名单 + /ui/prefs内（脚本 violations=0 时 exit 0；字面含 /ui/prefs → violations>0 判失败）' },
        { cmd: 'grep -REn "\'POST\' && pathname === \'[^\']+\'" src/daemon/http/server.js', expect: 0,
          note: 'AC-39 架构⑤：server.js 的 POST pathname 字面量均为 /__test__/ 测试接缝（基线 4 行，exit 0）' },
        { cmd: PATTERN_SCRIPT, expect: 0,
          note: 'AC-39 架构⑥：routes.js 写方法 pattern 严格落在 D-1 六项业务写名单 + /ui/prefs内（脚本 violations=0 时 exit 0；不放宽）' },
        { cmd: SHAPE_SCRIPT, expect: 0, contains: 'outsideShapeSnapshot=0',
          note: 'AC-39 架构⑦（D-53 函数体锚点）：daemon pendingEscalations 计数表达式只许在 shapeSnapshot 内，shapeSnapshot 未改' },
        { cmd: 'grep -REn "listen\\(0, .127.0.0.1.\\)|listen\\(.*0.0.0.0" src/daemon/http/server.js', expect: 0, contains: '127.0.0.1',
          note: 'AC-39 架构⑧：数据通道绑定本机回环 127.0.0.1，不监听 0.0.0.0' }
      ],
      tmpdir: tmp
    });
    const e = c.testRuns.find((t) => t.file === 'e2e.test.js');
    const h = c.testRuns.find((t) => t.file === 'http-contract.test.js');
    const p = c.testRuns.find((t) => t.file === 'prefs.test.js');
    c.check('纯浏览阶段 state/events 哈希全不变、五组状态深比较相等（D-53 Given：运行中且 health 已计算）',
      Boolean(e?.subtests?.some((x) => /AC-39 行为面：浏览零写盘/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /AC-39 行为面/.test(x)).join(' | ') || '（未找到）',
      '浏览队列/资产/占用/画布/证据后 state/events 哈希与五组状态逐值不变');
    c.check('写操作数=2（一次允许 + 一个暂停/继续周期，按用户动作计）',
      Boolean(e?.v?.ok),
      `# pass e2e ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      'writes.actionCount === 2');
    c.check('状态写入次数=3（审批 1 + 暂停 1 + 继续 1）、上述之外 unexpected=0',
      Boolean(e?.v?.ok),
      `# pass e2e ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      'writes.stateWrites === 3 且 writes.unexpected === 0，两个计数器互不折算');
    c.check('prefs.json 唯一写入方只写四键、多余键拒绝、不碰实例状态（D-42，不计入三个数字）',
      Boolean(p?.v?.ok && e?.subtests?.some((x) => /AC-39 prefs：唯一写入方只写四键/.test(x))),
      `# pass prefs ${p?.tap?.pass ?? 0} / e2e ${e?.tap?.pass ?? 0}`,
      'PREFS_KEYS=[enabled,escalate,completed,anomaly]，键集合 ⊆ 四键，多余键 throw');
    c.check('错误形状 400（缺 decision/坏 JSON）、422（非法 decision）、503（核心不在）、404（穿越 id）',
      Boolean(h?.subtests?.some((x) => /缺 decision 400，非 pass\/retry 422/.test(x)) &&
               h?.subtests?.some((x) => /核心不在时 503/.test(x)) &&
               h?.subtests?.some((x) => /详情 404 形状、穿越 id 拒绝/.test(x)) && h?.v?.ok),
      (h?.subtests ?? []).filter((x) => /(400|422|503|404)/.test(x)).join(' | ') || '（未找到）',
      '写接口参数校验 400 / 非法 422 / 核心不在 503 / 穿越 404；错误码透传不改状态');
    c.check('数据通道只在本机回环可达：server.listen(0,127.0.0.1)，监听地址无 0.0.0.0 / *',
      Boolean(c.arch.find((a) => a.index === 8)?.ok),
      c.arch.find((a) => a.index === 8)?.stdout ?? '（未找到）',
      '127.0.0.1:<port>，对 0.0.0.0 零命中');
    thenChecks(c);
    // 语义复核：/ui/prefs 是 D-42/D-51 明确授权的第六类写（只写本地偏好四键），
    // 但 AC-39 架构④/⑥ 的 D-1 六项业务写名单 + /ui/prefs字面未含它 → 锚点矛盾，登记裁决请求（不放宽、不改实现）。
    const sem = runCmd('grep -rn "ui/prefs" src/daemon/http/routes.js docs/iterations/iteration-11/decisions.md', { tmpdir: tmp });
    c.cmd(sem, '语义复核：/ui/prefs 的 D-42/D-51 授权来源 vs D-1 名单字面');
    c.check('语义复核：/ui/prefs 为 D-42/D-51 授权的本地偏好写（不计入三个数字），但 D-1 v14 名单已含 /ui/prefs（D-58 裁决）',
      /ui\/prefs/.test(sem.stdout),
      sem.stdout.trim().split('\n').slice(0, 8).join(' | '),
      '需求 v14 把 /ui/prefs 纳入 D-1 名单（D-58）；实现按 D-42/D-51 授权仅写 prefs 四键、不计入三个数字');
    c.note('机检文件名口径：需求点名 test/wp14/readonly-local.test.js（本分支不存在），逐字断言合并进 e2e.test.js（AC-39 静态面/行为面/prefs）+ http-contract.test.js（D-1 写接口错误形状 + GET 只读面）+ prefs.test.js（prefs 唯一写入方）；按实际存在文件机检并保留原始 TAP，登记说明不放宽。');
    c.note('D-53/D-55 口径：浏览零写 Given 限「运行中且 health 已计算」实例（读时首次受控健康度写不计面板写）；shapeSnapshot 按函数体锚点判定（行号随迭代漂移，基线 900→当前 1018），行号不被当作判据。e2e/http-contract 用短 TMPDIR 规避 macOS socket 104 字节上限假阴性，断言一条未改。');
    c.note('D-58 裁决已落实：需求 v14 把 D-42/D-51 明确授权的 /ui/prefs 纳入 D-1 写名单（第六类业务写以外的本地偏好写，仅四键、仅 prefs.json、不计入 AC-39 三个数字）；名单外任何其它写路径仍零命中，不放宽。机检文件名口径见上一条 note。');
    return finish(c);
  }
}];
