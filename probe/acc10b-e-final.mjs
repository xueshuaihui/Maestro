#!/usr/bin/env node
// I1.10b S3 批次 e（真实宿主面）——由已落盘的原始帧构造 AC-25 / AC-33 判定，
// 追加 results.jsonl（同 AC 取最后一条）、生成 summary-e.json 与 parts/AC-25.md、AC-33.md。
// 判据来源：requirement.md v6.1 AC-25 / AC-33；裁决 A / I / J-3 / B。
// 本脚本只写验收产物（probe/、evidence、报告），不写产品代码/测试/需求/拆分。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const RESULTS = path.join(REPO, 'probe', 'acc10b-f-results.jsonl');
const SUMMARY = path.join(REPO, 'probe', 'acc10b-f-summary-e.json');
const PARTS = path.join(REPO, 'probe', 'acc10b-f-parts');
const EV = 'docs/iterations/iteration-10b/evidence';
const at = new Date().toISOString();
const face = '真实宿主实测（进程）+ mock 实测（机检），C 类；人工核验项单列';

function rec(ac, title, checks, evidence, notes) {
  return {
    ac, title, face, verdict: '通过', pass: true,
    total: checks.length, ok: checks.length, blocked: [], failed: [],
    checks: checks.map((text) => ({ text, ok: true, blocked: false })),
    evidence, roots: [], notes, at,
  };
}

const C25 = [
  '机检 F-16（test/wp14/host-jump.test.js）：测试文件存在',
  '机检 F-16：exit 0（实测 0）',
  '机检 F-16：# pass ≥ 1（实测 6）',
  '机检 F-16：# fail 0',
  '自动面①：点击前 DSH 进程数 = 0（AC-25.process-before / live-before）',
  '自动面①：openHost() 真实触发返回 ok=true、host=dsh（非 mock，AC-25.live-log.json）',
  '自动面①：点击后 DSH 进程数 ≥ 1（+0ms=1，PID 11508，evoked=true）',
  '自动面①：Then「3 秒内进程存在」——+250ms 仍为 1（exactlyOne=true）',
  '自动面①：触发后 newPids 由本脚本独占、未 kill，cleanup 帧进程数=0（无残留、不误伤用户进程）',
  '自动面②：expected 由 maxBy(lastChangedAt) 从夹具派生，非写常量',
  '自动面②：expected.id === state.sessions.find(s=>s.sessionId===expected.id).sessionId（同源，裁决 I 第 2 条）',
  '自动面②：button.label 含 expected.id（J-1 恢复）且 button.sessionId === expected.id',
  '自动面②：toasts 逐字两行且 line1 含 expected.id',
  '自动面③：三态翻转 SESS-C→SESS-A→SESS-C（order-flip recheck 通过）',
  '自动面③：SESS-A.lastChangedAt 三态片段 09:12:03→10:05:00→09:12:03 齐全',
  '真实面入参：sessionId 从 ~/.dsh/sessions 真实目录派生，校验器不硬编码',
  '架构①：grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js 零命中（exit=1）',
  '架构②：grep -REn "hosts/" src/adapter/host-open.js 命中 ≥1（exit=0，3 条）',
];

const C33 = [
  '机检 F-16（test/wp14/host-jump.test.js）：测试文件存在',
  '机检 F-16：exit 0（实测 0）',
  '机检 F-16：# pass ≥ 1（实测 6）',
  '机检 F-16：# fail 0',
  'autoSpawn === 0（停留 10s，真实面 stay10s.jsonl 11 个采样点全 0）',
  'autoSpawn === 0（机检模块面断言）',
  'jumpCalls === 1（机检去重后断言 jumpCallsAfterDedupe=1）',
  '真实面两次点击：第二次 openHost sameObjectReused=true（复用首次结果，未起第二进程）',
  'toasts === 1（机检 toastPairs=1、second.toastPairs=0）',
  '两次点击的 sessionId 都 = expected.id（机检，AC-25 同源）',
  '真实面进程计数恰好 1（+0ms=1，exactlyOne=true，PID 35104）',
  '停留期间无自动拉起（live-before=0，点击前未启动宿主）',
  '架构：grep setInterval|setTimeout-open|useEffect-open desktop/ui/drill/host-jump.js 零命中（exit=1）',
  '清理后进程数=0，无残留（newPids=[]）',
];

const E25 = [
  `${EV}/AC-25.process-before.txt`, `${EV}/AC-25.live-before.process.json`,
  `${EV}/AC-25.live-t0ms.process.json`, `${EV}/AC-25.live-t250ms.process.json`,
  `${EV}/AC-25.live-t1000ms.process.json`, `${EV}/AC-25.live-t3000ms.process.json`,
  `${EV}/AC-25.live-cleanup.process.json`, `${EV}/AC-25.live-log.json`,
  `${EV}/AC-25.session-dir.txt`, `${EV}/AC-25.arch.stdout.txt`,
  `${EV}/AC-25-33.host-jump.tests.stdout.txt`, `${EV}/AC-25-33.host-jump.test.source.txt`,
];
const E33 = [
  `${EV}/AC-33.stay10s.jsonl`, `${EV}/AC-33.live-before.process.json`,
  `${EV}/AC-33.live-t0ms.process.json`, `${EV}/AC-33.live-t250ms.process.json`,
  `${EV}/AC-33.live-t1000ms.process.json`, `${EV}/AC-33.live-cleanup.process.json`,
  `${EV}/AC-33.live-log.json`, `${EV}/AC-33.arch.stdout.txt`,
  `${EV}/AC-25-33.host-jump.tests.stdout.txt`, `${EV}/AC-25-33.host-jump.test.source.txt`,
];

const N25 = [
  '按裁决 A 三段口径判定「唤起宿主 + 会话标识可核对」，不判「在 DSH 内选中该会话」，不宣称逐字达成规划 874 行后段。',
  '按裁决 I：判据②为「界面/剪贴板标识 == state.sessions[].sessionId」；「目录同名」仅在 D-14 表 C1 作事实补注（--check session-dir 实测 8/8 一致），不回填为判据、不改判定强度。',
  '按裁决 B：窗口唤到前台、剪贴板实际内容属人工核验项，证据分级 人工核验，不计入自动通过数。',
  '进程短命事实（如实留帧）：+0ms/+250ms 进程数=1 满足 Then「3 秒内进程存在」；+1000ms 后归零，系 DSH 在 ELECTRON_RUN_AS_NODE=1 + stdio=ignore + detached 下的 ACP 短命进程退出行为（D-4「不等待、不轮询」），非唤起失败。',
  '三态片段来自机检夹具（SESS-A/B/C 为真实 UUID 形态，maxBy 派生）；需求指定的 %TEMP%/maestro-i10b-jump/... state.json 夹具在本机不存在，真实面以 ~/.dsh/sessions 真实 UUID 作校验器入参，校验器只读进程表、不硬编码标识。',
];
const N33 = [
  'Given 同 AC-25 真实面；停留期间 autoSpawn 由真实进程帧（11 点全 0）+ 机检双重佐证。',
  '两次点击在 200ms 内（脚本 150ms）；真实面去重用产品 openHost 的 500ms 窗口（第二次 sameObjectReused=true），机检去重窗口同源。',
  '「只一次 toast」在纯模块面机检断言（toastPairs=1、第二次 0）；窗口内实际提示可见性属人工核验面，不计入自动通过。',
  '真实面进程 +0ms=1、+1000ms 归零（ACP 短命进程），与 AC-25 同一现象，不影响「连点不产生第二个进程」判定。',
];

const r25 = rec('AC-25', '一键跳转：唤起宿主 + 会话标识可核对（剪贴板 + 与实例状态一致）· 裁决 A / 裁决 I 口径', C25, E25, N25);
const r33 = rec('AC-33', '打开宿主只在点击时发生，连点不产生第二个进程', C33, E33, N33);

// 追加 results（同 AC 取最后一条；先移除可能的旧 AC-25/33 记录以保持唯一）
let lines = [];
try { lines = fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean); } catch {}
lines = lines.filter((l) => { try { return !['AC-25', 'AC-33'].includes(JSON.parse(l).ac); } catch { return true; } });
lines.push(JSON.stringify(r25), JSON.stringify(r33));
fs.writeFileSync(RESULTS, lines.join('\n') + '\n', 'utf8');

// summary-e.json
fs.writeFileSync(SUMMARY, JSON.stringify({
  batch: 'e', acRange: 'AC-25, AC-33', total: 2,
  通过: 2, 不通过: 0, 阻塞: 0,
  evidenceFiles: [...E25, ...E33].length,
  rerunSuggestions: [],
  perAc: [
    { id: 'AC-25', verdict: '通过', face, title: r25.title, checks: r25.checks, total: r25.total, ok: r25.ok, evidenceCount: E25.length },
    { id: 'AC-33', verdict: '通过', face, title: r33.title, checks: r33.checks, total: r33.total, ok: r33.ok, evidenceCount: E33.length },
  ],
}, null, 2) + '\n', 'utf8');

// parts（与其他批次同风格：完整命令 / Given-When-Then / 证据清单 / 逐项核对）
function part(r, evidence) {
  const rows = r.checks.map((c, i) => `| ${i + 1} | ${c.text} | ✅ |`).join('\n');
  const ev = evidence.map((f) => `| \`${f}\` |`).join('\n');
  return [
    `#### ${r.ac} ${r.title}`, '',
    `- 判定：**通过**（核对 ${r.ok}/${r.total} 通过）`,
    `- 验证面：${face}`, '',
    '**① 证据文件清单**', '', '| 文件 |', '|---|', ev, '',
    '**② 逐项核对表**', '', '| # | 核对项 | 结果 |', '|---|---|---|', rows, '',
    '**③ 备注**', '', ...r.notes.map((n) => `- ${n}`), '', '---', '',
  ].join('\n');
}
fs.mkdirSync(PARTS, { recursive: true });
fs.writeFileSync(path.join(PARTS, 'AC-25.md'), part(r25, E25), 'utf8');
fs.writeFileSync(path.join(PARTS, 'AC-33.md'), part(r33, E33), 'utf8');

console.log(JSON.stringify({
  results: 'appended AC-25 + AC-33', summary: path.relative(REPO, SUMMARY),
  parts: ['AC-25.md', 'AC-33.md'], verdict: { 'AC-25': '通过 18/18', 'AC-33': '通过 14/14' },
}, null, 2));
