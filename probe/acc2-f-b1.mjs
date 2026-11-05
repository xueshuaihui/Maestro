// 批 1：AC-02 / 04 / 05 / 06 / 07 / 08 / 09 / 10 / 11 / 12
import fs from 'node:fs';
import path from 'node:path';
import {
  NODE, ORCH, REPO, TASK, freshRoot, baseEnv, runCmd, orch,
  readState, readEvents, sha256File, exists, forceKillCore, makeCase, sleep,
  runSync, prepareOnly, startKeep, statusText, statusNoInstance, cancel, coreStop,
  runProduct, text, lines, grepCount, seqsOf, nodeOf, backflowPkg, esc,
  noteKeep, noteFixture, recordCase, appendBatch, initReport
} from './acc2-f-common.mjs';

const mds = [];
const T1 = '节点 T-001 开发 已完成 · 第 2 轮';

async function ac02() {
  const c = makeCase('AC-02');
  const root = freshRoot('ac02'); c.add(root);
  c.cmd(runSync(root, 'code-pass'), 'code-pass 场景跑完（成功路径）');
  const st = c.cmd(statusText(root, { events: true }), 'orch status --instance INST-001 --events');
  const t = text(st);
  const re = /^\[#\d+\] \d{2}:\d{2}:\d{2}  节点 T-00([12])  派发 → 执行中  原因 派发 · 第 \d+ 轮$/gm;
  const m = [...t.matchAll(re)];
  c.eq('输出里恰有 2 行匹配「节点 T-00n  派发 → 执行中  原因 派发 · 第 N 轮」', m.length, 2);
  c.eq('两行 n 依次为 1、2', m.map((x) => x[1]).join(','), '1,2');
  const idxs = m.map((x) => Number(/\[#(\d+)\]/.exec(x[0])[1]));
  c.assert('两行的 [#序号] 严格递增', idxs.length === 2 && idxs[0] < idxs[1], JSON.stringify(idxs));
  const ls = lines(t);
  const t1done = ls.findIndex((l) => l.includes('节点 T-001') && l.includes('待校验 → 已完成'));
  const bad = ls.findIndex((l, i) => l.includes('节点 T-002') && l.includes('执行中') && t1done >= 0 && i < t1done);
  c.assert('不存在 [#序号] 更小、含「节点 T-002」且含「执行中」的行出现在「节点 T-001」的「待校验 → 已完成」之前',
    t1done >= 0 && bad < 0, `t1doneSeqLine=${t1done} earlierT002RunningLine=${bad}`);
  mds.push(recordCase(c, { title: '顺序推进，执行区间不重叠', face: '夹具（mock 宿主复现产品成功路径 + 产品命令 status --events）', narrativeId: 'INST-201' }).md);
}

async function ac04() {
  const c = makeCase('AC-04');
  const root = freshRoot('ac04'); c.add(root);
  noteKeep(c, root, 'retest-hold', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'retest-hold');
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('夹具停在「测试第 2 轮执行中」（.mock/paused 存在）', Boolean(reached), String(reached));
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const t = text(st);
    c.eq("grep -c '^节点 T-'", grepCount(t, /^节点 T-/m), 2);
    const devLine = lines(t).find((l) => l.startsWith('节点 T-001')) ?? '';
    const testLine = lines(t).find((l) => l.startsWith('节点 T-002')) ?? '';
    c.includes('开发行含「第 2 轮」', devLine, '第 2 轮');
    c.includes('测试行含「第 2 轮」', testLine, '第 2 轮');
    const ho = lines(t).filter((l) => l.startsWith('交接包 HO-'));
    c.assert(`grep '^交接包 HO-' 同时能找到「开发→测试」与「测试→开发（回流）」`,
      ho.some((l) => l.includes('开发→测试')) && ho.some((l) => l.includes('测试→开发（回流）')), ho.join(' | '));
    const tsRe = /\d{2}:\d{2}:\d{2}/;
    c.eq('节点行与实例行都不匹配 \\d{2}:\\d{2}:\\d{2}',
      lines(t).filter((l) => (l.startsWith('节点 T-') || l.startsWith('实例 ')) && tsRe.test(l)).length, 0);
    c.assert('交接包行匹配时间戳', ho.some((l) => tsRe.test(l)), ho.join(' | '));
    const order = [];
    for (const l of lines(t)) {
      if (l.startsWith('实例 ')) order.push('实例');
      else if (l.startsWith('节点 T-')) order.push('节点');
      else if (l.startsWith('会话 ')) order.push('会话');
      else if (l.startsWith('交接包 HO-')) order.push('交接包');
      else if (l.startsWith('升级 ')) order.push('升级');
    }
    const seq = order.filter((x, i) => i === 0 || x !== order[i - 1]);
    c.eq('输出段序符合附录 A-2（实例 → 节点 ×2 → 会话 → 交接包 → 升级）', seq.join('>'), '实例>节点>会话>交接包>升级');
    c.eq("grep -c '节点 T-001 开发 已完成'", grepCount(t, /节点 T-001 开发 已完成/), 1);
    c.assert("grep -c '交接包 HO-001  开发→测试  已' 大于 0", t.includes('交接包 HO-001  开发→测试  已'), ho[0] ?? '');
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '节点表能看全两行、轮次与两条方向的交接包', face: '混合（夹具推进 + 产品命令 status）', narrativeId: 'INST-202' }).md);
}

async function ac05() {
  const c = makeCase('AC-05');
  const root = freshRoot('ac05'); c.add(root);
  noteKeep(c, root, 'backflow-once', ['--stop-after', '3'], ['NODE_ENV=test', 'MAESTRO_TEST_STOP_AFTER=3']);
  const h = startKeep(root, 'backflow-once', ['--stop-after', '3']);
  try {
    const reached = await h.waitFile('stopped-after-3', 40000);
    c.assert('驱动停在「开发第 2 轮产出已核对通过、复测尚未派发」（.mock/stopped-after-3 存在）', Boolean(reached), String(reached));
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const t = text(st);
    const p3 = path.join(root, '.mock', 'prompts', '3.json');
    c.assert('夹具：.mock/prompts/3.json 存在', exists(p3), p3);
    let task3 = '';
    try { task3 = JSON.parse(fs.readFileSync(p3, 'utf8')).task ?? ''; } catch { /* 保持空 */ }
    for (const needle of ['div 在除数为 0 时返回 Infinity，未抛错', 'out/test-log.txt', 'div 在整除场景存在浮点误差', 'out/test-log-2.txt']) {
      c.includes(`夹具：prompts/3.json 的 task 含「${needle}」`, task3, needle);
    }
    const bf = backflowPkg(s);
    c.assert('机检：存在 edge.kind=backflow 的交接包', Boolean(bf), JSON.stringify(bf));
    c.eq('机检：backflow 包 defects[] 恰好 2 条', bf?.defects?.length ?? -1, 2);
    const cwd = path.join(root, 'demo-code-pass');
    for (const d of (bf?.defects ?? [])) {
      const f = path.join(cwd, d.evidence);
      const ok = exists(f) && fs.statSync(f).size > 0;
      c.assert(`机检：缺陷证据可打开且非空 ${d.evidence}`, ok, `${f} size=${exists(f) ? fs.statSync(f).size : 'missing'}`);
    }
    c.eq('机检：nodes[0].state=done', nodeOf(s, 'T-001')?.state, 'done');
    c.eq('机检：nodes[0].round=2', nodeOf(s, 'T-001')?.round, 2);
    c.eq('机检：nodes[1].state=failed', nodeOf(s, 'T-002')?.state, 'failed');
    c.eq('机检：nodes[1].round=1', nodeOf(s, 'T-002')?.round, 1);
    c.eq('机检：backflow 包 state=consumed', bf?.state, 'consumed');
    c.assert('机检：backflow 包 wakeConsumedAt 非空', Boolean(bf?.wakeConsumedAt), String(bf?.wakeConsumedAt));
    const dev = (s?.sessions ?? []).filter((x) => x.nodeId === 'T-001');
    c.assert('机检：sessions 里 nodeId=T-001 的两条记录 sessionId 不同',
      dev.length >= 2 && dev[0].sessionId !== dev[1].sessionId, JSON.stringify(dev.map((x) => x.sessionId)));
    c.includes(`orch status 输出含「${T1}」`, t, T1);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '测试不通过时自动回流，开发确实收到缺陷', face: '夹具', narrativeId: 'INST-203',
    envKeys: ['NODE_ENV=test', 'MAESTRO_TEST_STOP_AFTER=3'] }).md);
}

async function ac06() {
  const c = makeCase('AC-06');
  const root = freshRoot('ac06'); c.add(root);
  noteKeep(c, root, 'backflow-once', ['--stop-after', '3'], ['NODE_ENV=test']);
  const h = startKeep(root, 'backflow-once', ['--stop-after', '3']);
  try {
    const reached = await h.waitFile('stopped-after-3', 40000);
    c.assert('夹具停在「开发 done/round2、测试 failed/round1」', Boolean(reached), String(reached));
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const t = text(st);
    c.eq("grep -c '^节点 T-' 仍是 2", grepCount(t, /^节点 T-/m), 2);
    c.includes('开发行含「第 2 轮」', lines(t).find((l) => l.startsWith('节点 T-001')) ?? '', '第 2 轮');
    c.eq('机检：state.json 的 nodes.length 仍是 2', readState(root)?.nodes?.length ?? -1, 2);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '回流不新建节点卡片', face: '夹具', narrativeId: 'INST-204' }).md);
}

async function ac07() {
  const c = makeCase('AC-07');
  const root = freshRoot('ac07'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完');
  const st1 = c.cmd(statusText(root), 'orch status --instance INST-001（第 1 次）');
  const t1 = text(st1);
  const evCount1 = readEvents(root).length;
  await sleep(60000);
  const st2 = c.cmd(statusText(root), '等 60 秒后重查 orch status --instance INST-001');
  const t2 = text(st2);
  const s = readState(root);
  const ev = readEvents(root);
  c.eq('机检：state.json 的 state=suspended', s?.state, 'suspended');
  c.eq('机检：nodes[1].state=escalated', nodeOf(s, 'T-002')?.state, 'escalated');
  c.eq('机检：nodes[1].round=2', nodeOf(s, 'T-002')?.round, 2);
  c.eq('机检：nodes[0].round=2', nodeOf(s, 'T-001')?.round, 2);
  const rev = ev.filter((e) => e.objectId === 'T-002' && e.from === 'review' && e.to === 'escalated');
  const rrun = ev.filter((e) => e.objectId === 'T-002' && e.from === 'running' && e.to === 'escalated');
  c.assert('机检：T-002 存在 from=review、to=escalated 的事件', rev.length >= 1, JSON.stringify(rev));
  c.eq('机检：不存在 from=running、to=escalated 的事件', rrun.length, 0);
  c.eq('机检：events.jsonl 的行数在 60 秒前后相同', ev.length, evCount1);
  c.includes('第 1 次查询的第一行含「已挂起」', lines(t1)[0] ?? '', '已挂起');
  c.includes('两次查询的第 2 次第一行含「已挂起」', lines(t2)[0] ?? '', '已挂起');
  c.eq('机检：不存在 round=3 的节点记录', (s?.nodes ?? []).filter((n) => n.round === 3).length, 0);
  mds.push(recordCase(c, { title: '第 2 次仍不通过就停止回流', face: '夹具（含真实 60 秒静默观察）', narrativeId: 'INST-205' }).md);
}

async function ac08() {
  const c = makeCase('AC-08');
  const root = freshRoot('ac08'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完');
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  const t = text(st);
  c.includes('输出含「节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条」', t, '节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条');
  c.includes('输出含「升级 ESC-001 待处理」', t, '升级 ESC-001 待处理');
  c.includes('输出含「原因：回流超上限：测试已派发 2 次仍未通过」', t, '原因：回流超上限：测试已派发 2 次仍未通过');
  c.includes('输出含「节点：T-002 测试 · 第 2 轮」', t, '节点：T-002 测试 · 第 2 轮');
  c.includes('输出含「缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）」', t, '缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）');
  const s = readState(root);
  c.eq('机检：escalations.length=1', s?.escalations?.length ?? -1, 1);
  c.eq('机检：escalations[0].nodeId=T-002', esc(s)?.nodeId, 'T-002');
  c.eq('机检：escalations[0].round=2', esc(s)?.round, 2);
  c.eq('机检：escalations[0].state=pending', esc(s)?.state, 'pending');
  mds.push(recordCase(c, { title: '升级挂在具体节点上，说得清为什么', face: '夹具', narrativeId: 'INST-206' }).md);
}

async function ac09() {
  const c = makeCase('AC-09');
  const root = freshRoot('ac09'); c.add(root);
  noteKeep(c, root, 'retest-fail', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'retest-fail');
  try {
    const reached = await h.waitState((s) => s.state === 'suspended', 40000);
    c.assert('夹具 retest-fail 跑完且核心仍在跑（--keep），实例已挂起', Boolean(reached), String(reached));
    const sBefore = readState(root);
    const evBefore = readEvents(root);
    const evCount1 = evBefore.length;
    const sessions1 = (sBefore?.sessions ?? []).length;
    const disp1 = evBefore.filter((e) => e.reason === 'node.dispatch').length;
    const esc1 = evBefore.filter((e) => e.reason === 'escalation.created').length;
    await sleep(60000);
    const sAfter = readState(root);
    const evAfter = readEvents(root);
    c.eq('机检：events.jsonl 行数不变', evAfter.length, evCount1);
    c.eq('机检：sessions.length 不变', (sAfter?.sessions ?? []).length, sessions1);
    c.eq('机检：这 60 秒内没有新增 reason=node.dispatch', evAfter.filter((e) => e.reason === 'node.dispatch').length, disp1);
    c.eq('机检：这 60 秒内没有新增 reason=escalation.created', evAfter.filter((e) => e.reason === 'escalation.created').length, esc1);
    c.eq("机检：state.json 的 state 仍是 'suspended'", sAfter?.state, 'suspended');
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.includes('orch status 第一行含「已挂起」', lines(text(st))[0] ?? '', '已挂起');
    const stAll = c.cmd(statusNoInstance(root), '不带 --instance 的 orch status');
    const row = lines(text(stAll)).find((l) => l.includes('INST-001')) ?? '';
    c.includes('列表里 INST-001 那行含「已挂起」', row, '已挂起');
    c.includes('列表里 INST-001 那行含「待处理升级 1」', row, '待处理升级 1');
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '挂起后不再自动继续', face: '夹具（核心 --keep 在跑 + 真实 60 秒静默）', narrativeId: 'INST-207' }).md);
}

async function ac10() {
  const c = makeCase('AC-10');
  const root = freshRoot('ac10'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完');
  const evPath = path.join(root, '.orch', 'instances', 'INST-001', 'events.jsonl');
  const hashBefore = sha256File(evPath);
  c.cmd(coreStop(root), 'orch core stop');
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  const t = text(st);
  const hashAfter = sha256File(evPath);
  c.includes('第一行含「已挂起」', lines(t)[0] ?? '', '已挂起');
  c.notIncludes('第一行不含「已中断」', lines(t)[0] ?? '', '已中断');
  c.includes('输出含「节点 T-002 测试 已升级 · 第 2 轮」', t, '节点 T-002 测试 已升级 · 第 2 轮');
  c.includes('输出含「升级 ESC-001 待处理」', t, '升级 ESC-001 待处理');
  c.eq('机检：events.jsonl 的 sha256 与 stop 前相同', hashAfter, hashBefore);
  const s = readState(root);
  c.eq('机检：state 仍是 suspended', s?.state, 'suspended');
  c.eq('机检：halted 不变（false）', Boolean(s?.halted), false);
  c.eq('机检：轮次仍为 2', nodeOf(s, 'T-002')?.round, 2);
  c.eq('机检：升级仍在', s?.escalations?.length ?? -1, 1);
  mds.push(recordCase(c, { title: '重启后仍挂起，轮次与升级都在', face: '混合', narrativeId: 'INST-208' }).md);
}

async function ac11() {
  const c = makeCase('AC-11');
  const root = freshRoot('ac11'); c.add(root);
  noteKeep(c, root, 'retest-slow', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'retest-slow');
  try {
    const reached = await h.waitState((s) => (s?.handoffs ?? []).some((x) => x.handoffId === 'HO-003' && x.state === 'accepted'), 40000);
    c.assert('夹具推进到「测试第 2 轮执行中」（step4 delayMs=30000，HO-003 已接受）', Boolean(reached), String(reached));
    const st0 = c.cmd(statusText(root), 'orch status --instance INST-001（取消前）');
    c.includes('取消前输出含「交接包 HO-003  开发→测试（复测）  已接受」', text(st0), '交接包 HO-003  开发→测试（复测）  已接受');
    const cc = c.cmd(cancel(root), 'orch cancel --instance INST-001');
    c.assert('orch cancel 在 5 秒内返回', (cc.durationMs ?? 999999) < 5000, `${cc.durationMs}ms`);
    const st = c.cmd(statusText(root), '5 秒内执行 orch status --instance INST-001');
    const t = text(st);
    c.includes('第一行含「已取消」', lines(t)[0] ?? '', '已取消');
    c.includes('输出含「节点 T-001 开发 已完成 · 第 2 轮」（已完成不倒推）', t, T1);
    const s = readState(root);
    c.eq("机检：nodes[1].state='cancelled'（原 'running'）", nodeOf(s, 'T-002')?.state, 'cancelled');
    const ho3 = (s?.handoffs ?? []).find((x) => x.handoffId === 'HO-003');
    c.eq("机检：HO-003 的 state='rejected'", ho3?.state, 'rejected');
    c.eq("机检：HO-003 的 rejectReason='withdrawn'", ho3?.rejectReason, 'withdrawn');
    c.includes('输出含「会话 空闲」', t, '会话 空闲');
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '运行中取消，5 秒内收干净', face: '混合', narrativeId: 'INST-209' }).md);
}

async function ac12() {
  const c = makeCase('AC-12');
  const root = freshRoot('ac12'); c.add(root);
  c.cmd(prepareOnly(root, 'retest-fail'), 'driver --scenario retest-fail --prepare-only（只写 cursor.json 与 mock.json）');
  c.cmd(orch(root, ['status']), '核心已热（先执行过一次 orch status）');
  const r = c.cmd(runProduct(root, { host: 'mock' }), 'orch run --cwd ./demo-code-pass --template code-loop --host mock --task "…产物：calc.js"');
  const t = text(r);
  c.assert('命令在 10 秒内返回', (r.durationMs ?? 999999) < 10000, `${r.durationMs}ms`);
  c.eq('退出码是 4', r.exitCode, 4);
  const ls = lines(t).filter((l) => l.trim().length > 0);
  const tail = ls.slice(-3);
  c.matches('倒数第 3 行匹配 ^实例 INST-\\d+ · 已挂起 · 模板 编码闭环$', tail[0] ?? '', /^实例 INST-\d+ · 已挂起 · 模板 编码闭环$/);
  c.matches('倒数第 2 行匹配 ^升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮$', tail[1] ?? '', /^升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮$/);
  c.matches('最后一行匹配 ^下一步：查看详情 .*；本版本不能继续，要终止请执行 orch cancel --instance INST-\\d+$', tail[2] ?? '', /^下一步：查看详情 .*；本版本不能继续，要终止请执行 orch cancel --instance INST-\d+$/);
  c.eq('全部输出不含以「节点 T-」开头的行', lines(t).filter((l) => l.startsWith('节点 T-')).length, 0);
  c.eq('全部输出不含以「交接包 HO-」开头的行', lines(t).filter((l) => l.startsWith('交接包 HO-')).length, 0);
  for (const w of ['未知错误', '执行失败', '核对失败']) c.notIncludes(`全部输出不含「${w}」`, t, w);
  mds.push(recordCase(c, { title: '挂起时 orch run 自己结束，不报错', face: '夹具（--prepare-only 构造现场 + 产品命令 orch run）', narrativeId: 'INST-210' }).md);
}

async function main() {
  initReport();
  const all = [ac02, ac04, ac05, ac06, ac07, ac08, ac09, ac10, ac11, ac12];
  for (const fn of all) {
    try { await fn(); console.log(`[b1] ${fn.name} done`); }
    catch (err) { console.error(`[b1] ${fn.name} ERROR ${err?.stack ?? err}`); }
  }
  appendBatch('1 批 1（AC-02/04/05/06/07/08/09/10/11/12）', mds,
    '> 批 1 中间结论：以上 10 条已逐条真跑并落 `evidence/AC-xx.*`；总判待 4 批齐备后由 final 脚本汇总。');
  const tl = runCmd(['tasklist', '/FI', 'IMAGENAME eq node.exe', '/NH'], { cwd: REPO, label: 'tasklist 自查' });
  fs.appendFileSync(path.join(REPO, 'docs', 'iterations', 'iteration-2', 'acceptance-fixture.md'),
    `\n> 批 1 结束 tasklist 自查（node.exe 行数）：${lines(tl.stdout).filter((l) => l.includes('node.exe')).length}\n`, 'utf8');
  console.log('[b1] ALL DONE');
}
main();
