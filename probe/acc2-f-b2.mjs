// 批 2：AC-13 / 14 / 15 / 16 / 18 / 19 / 20 / 23 / 24 / 25
import fs from 'node:fs';
import path from 'node:path';
import {
  NODE, ORCH, REPO, TASK, freshRoot, baseEnv, runCmd, orch,
  readState, readEvents, sha256File, exists, forceKillCore, makeCase,
  runSync, startKeep, statusText, cancel, coreStop, runProduct,
  text, lines, grepCount, seqsOf, nodeOf, backflowPkg, esc, attempt,
  noteFixture, recordCase, appendBatch
} from './acc2-f-common.mjs';

const mds = [];
const REASON_PREFIX = '原因：核对失败：';

function escalatedNoBackflow(c, root, s, st, reasonCode, reasonText, tag) {
  c.eq(`[${tag}] 机检：escalations[0].reasonCode=${reasonCode}`, esc(s)?.reasonCode, reasonCode);
  c.includes(`[${tag}] 输出含「${reasonText}」`, text(st), reasonText);
  c.eq(`[${tag}] 机检：nodes[0].state=done`, nodeOf(s, 'T-001')?.state, 'done');
  c.eq(`[${tag}] 机检：nodes[0].round=1`, nodeOf(s, 'T-001')?.round, 1);
  c.eq(`[${tag}] 机检：不存在 edge.kind=backflow 的交接包`, (s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length, 0);
}

async function ac13() {
  const c = makeCase('AC-13');
  const root = freshRoot('ac13'); c.add(root);
  c.cmd(runSync(root, 'verdict-missing'), '夹具场景 verdict-missing（verdict 显式 null）');
  const s = readState(root);
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  c.eq("机检：nodes[1].state='escalated'", nodeOf(s, 'T-002')?.state, 'escalated');
  c.eq("机检：escalations[0].reasonCode='verdict_missing'", esc(s)?.reasonCode, 'verdict_missing');
  c.includes('orch status 输出含「核对失败：未找到判定文件 out/verdict.json」', text(st), '核对失败：未找到判定文件 out/verdict.json');
  c.eq('机检：nodes[0].state=done', nodeOf(s, 'T-001')?.state, 'done');
  c.eq('机检：nodes[0].round=1', nodeOf(s, 'T-001')?.round, 1);
  c.eq('机检：不存在 edge.kind=backflow 的交接包', (s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length, 0);
  mds.push(recordCase(c, { title: '判定文件缺失不回流，直接升级', face: '夹具', narrativeId: 'INST-211' }).md);
}

async function ac14() {
  const c = makeCase('AC-14');
  const names = ['verdict-bad-json', 'verdict-no-field', 'verdict-maybe', 'verdict-pass-with-defects'];
  for (const name of names) {
    const root = freshRoot(`ac14-${name}`); c.add(root);
    c.cmd(runSync(root, name, ['--reset']), `夹具场景 ${name}（独立项目根，--reset 只清该根 .mock/）`);
    const s = readState(root);
    const st = c.cmd(statusText(root), `orch status --instance INST-001（${name}）`);
    c.includes(`[${name}] 四次都出现「已升级」`, text(st), '已升级');
    c.includes(`[${name}] 原因原文以「核对失败：」开头`, text(st), REASON_PREFIX);
    c.eq(`[${name}] nodes[0].state=done`, nodeOf(s, 'T-001')?.state, 'done');
    c.eq(`[${name}] nodes[0].round=1`, nodeOf(s, 'T-001')?.round, 1);
    c.eq(`[${name}] 不存在 edge.kind=backflow 的交接包`, (s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length, 0);
    c.eq(`[${name}] escalations[0].reasonCode=verdict_invalid`, esc(s)?.reasonCode, 'verdict_invalid');
  }
  mds.push(recordCase(c, { title: '判定不可解析的四种样本都不回流', face: '夹具（4 个独立项目根）', narrativeId: 'INST-212' }).md);
}

async function ac15() {
  const c = makeCase('AC-15');
  const root = freshRoot('ac15'); c.add(root);
  // v16: observe the mid-state. In the terminal state T-002 has passed round 2,
  // so the node line shows the current verdict and round 1's "判定 不通过" is gone.
  const h = startKeep(root, 'verdict-says-fail', ['--stop-after', '3']);
  try {
    const reached = await h.waitFile('stopped-after-3', 60000);
    c.assert('夹具停在「开发第 2 轮核对完成、复测派发前」（.mock/stopped-after-3 出现）', Boolean(reached), String(reached));
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const stE = c.cmd(statusText(root, { events: true }), 'orch status --instance INST-001 --events');
    c.includes('输出含「判定 不通过」', text(st), '判定 不通过');
    c.assert('机检：存在 edge.kind=backflow 的交接包（说明触发了回流）', Boolean(backflowPkg(s)), JSON.stringify(s?.handoffs));
    const vr = readEvents(root).filter((e) => e.reason === 'verdict.read');
    c.assert("机检：events 有一条 reason='verdict.read'", vr.length >= 1, JSON.stringify(vr));
    const d = vr[0]?.detail ?? {};
    c.eq("机检：detail.source='file'", d.source, 'file');
    c.eq("机检：detail.path='out/verdict.json'", d.path, 'out/verdict.json');
    c.eq("机检：detail.verdict='fail'", d.verdict, 'fail');
    c.includes('orch status --events 输出含「原因 读取判定」', text(stE), '原因 读取判定');
    // Evidence must be captured while the mid-state is still on disk.
    mds.push(recordCase(c, { title: '判定以文件为准，不以对话为准', face: '夹具', narrativeId: 'INST-213' }).md);
  } finally {
    await h.stop();
  }
}

async function ac16() {
  const c = makeCase('AC-16');
  {
    const root = freshRoot('ac16-stale'); c.add(root);
    c.cmd(runSync(root, 'verdict-stale'), '夹具场景 verdict-stale');
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq("[stale] 机检：escalations[0].reasonCode='verdict_stale'", esc(s)?.reasonCode, 'verdict_stale');
    c.includes('[stale] 输出含「核对失败：判定文件不是本轮新写 out/verdict.json」', text(st), '核对失败：判定文件不是本轮新写 out/verdict.json');
    c.notIncludes('[stale] 输出不含「未找到判定文件」', text(st), '未找到判定文件');
    c.eq('[stale] 机检：nodes[0].state=done', nodeOf(s, 'T-001')?.state, 'done');
    c.eq('[stale] 机检：nodes[0].round=1', nodeOf(s, 'T-001')?.round, 1);
    c.eq('[stale] 机检：无回流交接包', (s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length, 0);
  }
  {
    const root = freshRoot('ac16-stale-retest'); c.add(root);
    c.cmd(runSync(root, 'verdict-stale-retest'), '夹具场景 verdict-stale-retest（前 3 步正常，step4 旧 mtime）');
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq("[stale-retest] 机检：escalations[0].reasonCode='verdict_stale'", esc(s)?.reasonCode, 'verdict_stale');
    c.eq('[stale-retest] 机检：nodes[1].round=2', nodeOf(s, 'T-002')?.round, 2);
    c.eq("[stale-retest] 机检：nodes[1].state='escalated'", nodeOf(s, 'T-002')?.state, 'escalated');
    c.includes('[stale-retest] 输出含「核对失败：判定文件不是本轮新写 out/verdict.json」', text(st), '核对失败：判定文件不是本轮新写 out/verdict.json');
  }
  mds.push(recordCase(c, { title: '判定文件不是本轮新写 → 单独的原因，不误报「未找到」', face: '夹具（2 个独立项目根）', narrativeId: 'INST-214' }).md);
}

async function ac18() {
  const c = makeCase('AC-18');
  const root = freshRoot('ac18'); c.add(root);
  c.cmd(runSync(root, 'verdict-no-defects'), '夹具场景 verdict-no-defects（fail + defects=[]）');
  const s = readState(root);
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  escalatedNoBackflow(c, root, s, st, 'verdict_invalid', '核对失败：判定为不通过，但没有缺陷清单', 'AC-18');
  mds.push(recordCase(c, { title: '不通过但没有缺陷清单，不回流', face: '夹具', narrativeId: 'INST-215' }).md);
}

async function ac19() {
  const c = makeCase('AC-19');
  const root = freshRoot('ac19'); c.add(root);
  c.cmd(runSync(root, 'verdict-missing-evidence'), '夹具场景 verdict-missing-evidence（证据指向不存在文件）');
  const s = readState(root);
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  escalatedNoBackflow(c, root, s, st, 'verdict_invalid', '核对失败：缺陷证据不可解析', 'AC-19');
  mds.push(recordCase(c, { title: '缺陷证据打不开，也不回流', face: '夹具', narrativeId: 'INST-216' }).md);
}

async function ac20() {
  const c = makeCase('AC-20');
  const root = freshRoot('ac20'); c.add(root);
  const src = path.join(REPO, 'test', 'fixtures', 'legacy-v1');
  const instDir = path.join(root, '.orch', 'instances');
  const rels = ['OLD-001/state.json', 'OLD-001/events.jsonl', 'OLD-002/state.json', 'OLD-002/events.jsonl'];
  const targets = {};
  for (const rel of rels) {
    const dst = path.join(instDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(src, rel), dst);
    targets[rel] = dst;
  }
  noteFixture(c, 'mkdir -p .orch/instances/OLD-001 OLD-002 并拷入 legacy-v1 四个文件',
    rels.map((r) => `cp test/fixtures/legacy-v1/${r} -> ${targets[r]}`).join('\n'));
  const sums = {};
  for (const l of fs.readFileSync(path.join(src, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
    const m = /^([a-f0-9]{64})\s+(\S+)$/.exec(l.trim());
    if (m) sums[m[2]] = m[1];
  }
  const hashAtCopy = {};
  for (const rel of rels) {
    hashAtCopy[rel] = sha256File(targets[rel]);
    c.eq(`夹具：${rel} 的 sha256 与交付物 SHA256SUMS 一致`, hashAtCopy[rel], sums[rel]);
  }
  const s1 = c.cmd(statusText(root, { instance: 'OLD-001', events: true }), 'orch status --instance OLD-001 --events');
  const s2 = c.cmd(statusText(root, { instance: 'OLD-002', events: true }), 'orch status --instance OLD-002 --events');
  c.includes('OLD-001 能看到「节点」行', text(s1), '节点 ');
  c.assert('OLD-001 能看到事件记录（v1 事件行为 I1.1 版式，不带 [#seq]）',
    lines(text(s1)).filter((l) => /原因 /.test(l)).length >= 1,
    lines(text(s1)).filter((l) => /原因 /.test(l)).join(' | '));
  c.includes('OLD-002 能看到「节点」行', text(s2), '节点 ');
  c.assert('OLD-002 能看到事件记录（v1 事件行为 I1.1 版式，不带 [#seq]）',
    lines(text(s2)).filter((l) => /原因 /.test(l)).length >= 1,
    lines(text(s2)).filter((l) => /原因 /.test(l)).join(' | '));
  for (const [tag, st] of [['OLD-001', s1], ['OLD-002', s2]]) {
    c.notIncludes(`${tag} 不显示「模板」`, text(st), '模板');
    c.eq(`${tag} 不显示「第 n 轮」`, lines(text(st)).filter((l) => /第 \d+ 轮/.test(l)).length, 0);
  }
  c.includes('OLD-002 仍显示「运行中」', lines(text(s2))[0] ?? '', '运行中');
  c.notIncludes('OLD-002 没有被对账改成「已中断」', text(s2), '已中断');
  c.cmd(coreStop(root), 'orch core stop 后重查一次');
  const s2b = c.cmd(statusText(root, { instance: 'OLD-002', events: true }), 'orch status --instance OLD-002 --events（重启后）');
  c.includes('重启后 OLD-002 仍显示「运行中」', lines(text(s2b))[0] ?? '', '运行中');
  c.notIncludes('重启后 OLD-002 仍未被改成「已中断」', text(s2b), '已中断');
  const cc = c.cmd(cancel(root, 'OLD-001'), 'orch cancel --instance OLD-001');
  c.includes('cancel OLD-001 看到「该实例为旧格式，本版本只支持查看」', text(cc), '该实例为旧格式，本版本只支持查看');
  c.eq('cancel OLD-001 退出码 1', cc.exitCode, 1);
  fs.mkdirSync(path.join(root, 'demo'), { recursive: true });
  noteFixture(c, 'mkdir -p ./demo（保证 run 的 cwd 可写，使检查能走到 LEGACY_READ_ONLY）', path.join(root, 'demo'));
  const rr = c.cmd(runProduct(root, { instance: 'OLD-002', host: null, template: null, cwd: './demo', task: '…' }),
    'orch run --cwd ./demo --instance OLD-002 --task "…"');
  c.includes('run --instance OLD-002 看到同样提示', text(rr), '该实例为旧格式，本版本只支持查看');
  c.eq('run --instance OLD-002 退出码 1', rr.exitCode, 1);
  for (const rel of rels) c.eq(`夹具：${rel} 四个文件 sha256 与拷贝时完全一致`, sha256File(targets[rel]), hashAtCopy[rel]);
  mds.push(recordCase(c, { title: '旧格式实例只读可查（含「看也不改」）', face: '混合（夹具造 v1 现场 + 产品命令查询）', narrativeId: 'INST-217' }).md);
}

async function ac23() {
  const c = makeCase('AC-23');
  const root = freshRoot('ac23'); c.add(root);
  const before = (() => { try { return fs.readdirSync(path.join(root, '.orch', 'instances')).length; } catch { return 0; } })();
  const r1 = c.cmd(runProduct(root, { template: 'no-such-template', task: TASK }), '① orch run --template no-such-template --task "…产物：calc.js"');
  const r2 = c.cmd(runProduct(root, { template: 'code-loop', task: '   ' }), '② orch run --template code-loop --task "   "');
  const r3 = c.cmd(runProduct(root, { template: 'code-loop', task: '给 calc.js 补 div' }), '③ orch run --template code-loop --task "给 calc.js 补 div"（缺产物行）');
  c.includes('① 输出含「未知模板：no-such-template」', text(r1), '未知模板：no-such-template');
  c.includes('② 输出含「任务描述不能为空」', text(r2), '任务描述不能为空');
  c.includes('③ 输出含「编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）」', text(r3), '编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）');
  for (const [tag, r] of [['①', r1], ['②', r2], ['③', r3]]) c.eq(`${tag} 退出码是 1（不是 2）`, r.exitCode, 1);
  const after = (() => { try { return fs.readdirSync(path.join(root, '.orch', 'instances')).length; } catch { return 0; } })();
  c.eq('`ls .orch/instances | wc -l` 与执行前相同', after, before);
  const evCreated = (() => {
    try {
      return fs.readdirSync(path.join(root, '.orch', 'instances')).filter((id) =>
        exists(path.join(root, '.orch', 'instances', id, 'events.jsonl')));
    } catch { return []; }
  })();
  c.eq('机检：events.jsonl 没有被创建（三个目录都不存在）', evCreated.length, 0);
  mds.push(recordCase(c, { title: '发起前拦截三种注定跑不通的请求', face: '产品命令（夹具根，mock 现场，未派发）', narrativeId: 'INST-218' }).md);
}

async function ac24() {
  const c = makeCase('AC-24');
  const root = freshRoot('ac24'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完');
  const st = c.cmd(statusText(root, { events: true }), 'orch status --instance INST-001 --events');
  const t = text(st);
  const re1 = /^\[#\d+\] \d{2}:\d{2}:\d{2}  节点 T-001  派发 → 执行中  原因 派发 · 第 \d+ 轮$/gm;
  const m1 = [...t.matchAll(re1)];
  c.eq('输出里有 2 行匹配「节点 T-001  派发 → 执行中  原因 派发 · 第 N 轮」', m1.length, 2);
  const rounds = readEvents(root).filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-001').map((e) => e.detail?.round).sort((a, b) => a - b);
  c.eq('机检：这 2 条事件的 detail.round 分别是 1 和 2', JSON.stringify(rounds), '[1,2]');
  const re2 = /^\[#\d+\] \d{2}:\d{2}:\d{2}  升级 ESC-001  待处理  原因 创建升级$/m;
  c.eq('输出里有 1 行匹配「升级 ESC-001  待处理  原因 创建升级」', (t.match(new RegExp(re2.source, 'gm')) ?? []).length, 1);
  c.includes('输出含「缺陷 1：」', t, '缺陷 1：');
  c.includes('输出含「复测要求：」', t, '复测要求：');
  const bad = lines(t).filter((l) => l.startsWith('[#') && !/^\[#\d+\] \d{2}:\d{2}:\d{2}  \S+ \S+  .+  原因 .+$/.test(l));
  c.eq('所有状态迁移行都匹配 ^\\[#\\d+\\] \\d{2}:\\d{2}:\\d{2}  \\S+ \\S+  .+  原因 .+$', bad.length, 0);
  mds.push(recordCase(c, { title: '事件记录里有轮次与升级', face: '夹具', narrativeId: 'INST-219' }).md);
}

async function ac25() {
  const c = makeCase('AC-25');
  const root = freshRoot('ac25'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完');
  c.cmd(cancel(root), 'orch cancel --instance INST-001（使 nodes[1]/T-002 变 cancelled）');
  c.cmd(coreStop(root), 'orch core stop（夹具直接调状态机，不得与核心并发写 events.jsonl）');
  const before = readEvents(root).length;
  const at = c.cmd(attempt(root, { object: 'node', node: 'T-002', from: 'cancelled', to: 'running' }),
    'attempt-transition.mjs --object node --node T-002 --from cancelled --to running');
  const ev = readEvents(root);
  const added = ev.slice(before);
  const rej = added.filter((e) => e.result === 'rejected' && e.reason === 'illegal_transition');
  c.assert("机检：events.jsonl 新增一条 result='rejected'、reason='illegal_transition' 的记录", rej.length >= 1,
    `exit=${at.exitCode} added=${JSON.stringify(added)} stdout=${text(at).slice(0, 500)}`);
  c.includes("机检：detail.message 含 'not in the transition table'", JSON.stringify(rej), 'not in the transition table');
  c.eq("机检：T-002 的 state 仍为 'cancelled'", nodeOf(readState(root), 'T-002')?.state, 'cancelled');
  mds.push(recordCase(c, { title: '非法迁移被拒绝', face: '夹具', narrativeId: 'INST-220' }).md);
}

async function main() {
  const all = [ac13, ac14, ac15, ac16, ac18, ac19, ac20, ac23, ac24, ac25];
  for (const fn of all) {
    try { await fn(); console.log(`[b2] ${fn.name} done`); }
    catch (err) { console.error(`[b2] ${fn.name} ERROR ${err?.stack ?? err}`); }
  }
  appendBatch('2 批 2（AC-13/14/15/16/18/19/20/23/24/25）', mds,
    '> 批 2 中间结论：以上 10 条已逐条真跑并落 `evidence/AC-xx.*`；总判待 4 批齐备后由 final 脚本汇总。');
  const tl = runCmd(['tasklist', '/FI', 'IMAGENAME eq node.exe', '/NH'], { cwd: REPO, label: 'tasklist 自查' });
  fs.appendFileSync(path.join(REPO, 'docs', 'iterations', 'iteration-2', 'acceptance-fixture.md'),
    `\n> 批 2 结束 tasklist 自查（node.exe 行数）：${lines(tl.stdout).filter((l) => l.includes('node.exe')).length}\n`, 'utf8');
  console.log('[b2] ALL DONE');
}
main();
