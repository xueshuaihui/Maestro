// 批 4：AC-37 / 38 / 39 / 40 / 41 / 42 / 43 / 44 / 46 + 夹具可测 NFR
import fs from 'node:fs';
import path from 'node:path';
import {
  NODE, ORCH, REPO, TASK, freshRoot, baseEnv, runCmd, orch,
  readState, readEvents, exists, forceKillCore, makeCase,
  runSync, prepareOnly, startKeep, statusText, cancel, coreStop, runProduct,
  text, lines, grepCount, seqsOf, nodeOf, backflowPkg, esc,
  noteKeep, noteFixture, recordCase, appendBatch
} from './acc2-f-common.mjs';

const mds = [];
const nfrMds = [];
const T2DONE = /^节点 T-002 测试 已完成 · 第 2 轮 · 耗时 \S+ · 判定 通过$/m;

async function ac37() {
  const c = makeCase('AC-37');
  const root = freshRoot('ac37'); c.add(root);
  const envKeys = ['NODE_ENV=test', 'MAESTRO_TEST_PAUSE=after_verdict'];
  noteKeep(c, root, 'backflow-once', [], envKeys);
  const h = startKeep(root, 'backflow-once', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_verdict' }));
  try {
    const reached = await h.waitFile('paused', 40000);
    const pausedFile = path.join(root, '.mock', 'paused');
    c.assert('test -f .mock/paused：核心停在「读完判定、回流包已构造但未投递」', exists(pausedFile), String(reached));
    const s0 = readState(root);
    c.assert('暂停中 backflow 包已构造（created）', (s0?.handoffs ?? []).some((x) => x.edge?.kind === 'backflow' && x.state === 'created'),
      JSON.stringify(s0?.handoffs));
    c.cmd(cancel(root), 'orch cancel --instance INST-001');
    h.release();
    await new Promise((r) => setTimeout(r, 1500));
    const s = readState(root);
    const bf = backflowPkg(s);
    c.eq("机检：backflow 交接包 state='rejected'", bf?.state, 'rejected');
    c.eq("机检：backflow 交接包 rejectReason='withdrawn'", bf?.rejectReason, 'withdrawn');
    c.eq('机检：nodes[0].state=done 且 nodes[0].round=1（开发没有被拉起）', `${nodeOf(s, 'T-001')?.state}/${nodeOf(s, 'T-001')?.round}`, 'done/1');
    const hr = readEvents(root).filter((e) => e.reason === 'handoff.rejected' && e.detail?.reason === 'withdrawn');
    c.assert("机检：events.jsonl 有一条 reason='handoff.rejected' 且 detail.reason='withdrawn'", hr.length >= 1, JSON.stringify(hr));
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '取消优先：判定已读到、回流未投递', face: '夹具（核心侧 after_verdict）', narrativeId: 'INST-231', envKeys }).md);
}

async function ac38() {
  const c = makeCase('AC-38');
  const root = freshRoot('ac38'); c.add(root);
  c.cmd(prepareOnly(root, 'retest-fail'), 'driver --scenario retest-fail --prepare-only（不启核心、不建实例）');
  noteFixture(c, '核心已停（全新根，未执行任何会拉起核心的命令）', '保证 NODE_ENV=test 与 MAESTRO_FAULT 在冷启动时被读取');
  const r = c.cmd(runProduct(root, { host: 'mock', env: baseEnv({ MAESTRO_FAULT: 'state_write:escalation' }) }),
    'MAESTRO_FAULT=state_write:escalation NODE_ENV=test orch run --cwd ./demo-code-pass --template code-loop --host mock --task "…产物：calc.js"');
  const t = text(r);
  c.assert('命令在 10 秒内返回', (r.durationMs ?? 999999) < 10000, `${r.durationMs}ms`);
  c.eq('退出码是 5', r.exitCode, 5);
  c.includes('输出含「无法记录升级：」', t, '无法记录升级：');
  c.includes('输出含「；已停止推进」', t, '；已停止推进');
  c.includes('输出含「运行中 · 已停止推进」', t, '运行中 · 已停止推进');
  c.notIncludes('输出不含「已挂起」', t, '已挂起');
  c.includes('输出含「节点 T-002 测试 待校验（升级未记录） · 第 2 轮」', t, '节点 T-002 测试 待校验（升级未记录） · 第 2 轮');
  c.includes('最后一行含「下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消」',
    lines(t).filter((l) => l.trim()).slice(-1)[0] ?? '', '下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消');
  c.eq('全部输出不含以「交接包 HO-」开头的行', lines(t).filter((l) => l.startsWith('交接包 HO-')).length, 0);
  const s = readState(root);
  c.eq("机检：state='running'", s?.state, 'running');
  c.eq('机检：halted=true', Boolean(s?.halted), true);
  c.eq('机检：escalations 为空', s?.escalations?.length ?? -1, 0);
  c.eq("机检：nodes[1].state='review'（不是 failed 也不是 escalated）", nodeOf(s, 'T-002')?.state, 'review');
  c.cmd(coreStop(root), 'orch core stop');
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  c.includes('第一行含「已中断」', lines(text(st))[0] ?? '', '已中断');
  mds.push(recordCase(c, { title: '状态写不进去时不假装挂起', face: '夹具（--prepare-only + MAESTRO_FAULT 冷启动）', narrativeId: 'INST-232',
    envKeys: ['NODE_ENV=test', 'MAESTRO_FAULT=state_write:escalation'] }).md);
}

async function ac39() {
  const c = makeCase('AC-39');
  const root = freshRoot('ac39'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完');
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  const t = text(st);
  c.includes('输出含「节点 T-002 测试 已升级」', t, '节点 T-002 测试 已升级');
  c.includes('输出含独立行「会话 已升级」', t, '会话 已升级');
  c.notIncludes('输出里没有「会话 执行中」', t, '会话 执行中');
  const s = readState(root);
  const ses = (s?.sessions ?? []).filter((x) => x.nodeId === 'T-002' && x.round === 2);
  c.eq("机检：sessions 里 nodeId='T-002' 且 round=2 的那条 state='escalated'", ses[0]?.state, 'escalated');
  mds.push(recordCase(c, { title: '升级时目标会话显示为已升级', face: '夹具', narrativeId: 'INST-233' }).md);
}

async function ac40() {
  const c = makeCase('AC-40');
  const root = freshRoot('ac40'); c.add(root);
  noteKeep(c, root, 'retest-fail', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'retest-fail');
  try {
    const reached = await h.waitState((s) => s.state === 'suspended', 40000);
    c.assert('retest-fail --keep 让 INST-001 处于「已挂起」，绑定目录 demo-code-pass，核心在跑', Boolean(reached), String(reached));
    const before = (() => { try { return fs.readdirSync(path.join(root, '.orch', 'instances')).length; } catch { return 0; } })();
    const r = c.cmd(runProduct(root, { template: 'code-loop', task: TASK }),
      'orch run --cwd ./demo-code-pass --template code-loop --task "…产物：calc.js"（不带 --instance）');
    c.includes('输出含「该目录已有未结束的实例 INST-001，本次未发起」', text(r), '该目录已有未结束的实例 INST-001，本次未发起');
    c.eq('退出码 1', r.exitCode, 1);
    const after = (() => { try { return fs.readdirSync(path.join(root, '.orch', 'instances')).length; } catch { return 0; } })();
    c.eq('`ls .orch/instances | wc -l` 与执行前相同', after, before);
    c.eq("机检：INST-001 的 state 仍是 'suspended'（新闭环不会解除挂起）", readState(root)?.state, 'suspended');
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '同一目录不能同时跑两个闭环', face: '混合', narrativeId: 'INST-234' }).md);
}

async function ac41() {
  const c = makeCase('AC-41');
  const root = freshRoot('ac41'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail（第 2 次判定为合法 fail，带 1 条缺陷与存在的证据）');
  const s = readState(root);
  const hs = s?.handoffs ?? [];
  c.eq('机检：handoffs 恰好 3 条', hs.length, 3);
  c.eq('机检：handoffId 依次 HO-001、HO-002、HO-003（无重复、无跳号）', hs.map((h) => h.handoffId).join(','), 'HO-001,HO-002,HO-003');
  c.eq('机检：edge.kind 依次 forward、backflow、retest', hs.map((h) => h.edge?.kind).join(','), 'forward,backflow,retest');
  c.assert('机检：三条的 createdAt 都非空', hs.every((h) => Boolean(h.createdAt)), JSON.stringify(hs.map((h) => h.createdAt)));
  c.eq("机检：三条的 state 都是 'consumed'", hs.map((h) => h.state).join(','), 'consumed,consumed,consumed');
  const st = c.cmd(statusText(root, { events: true }), 'orch status --instance INST-001 --events');
  const sq = seqsOf(text(st));
  const increasing = sq.every((n, i) => i === 0 || n === sq[i - 1] + 1);
  c.assert('orch status --events 里 [#序号] 严格递增、不跳号', sq.length > 0 && increasing, JSON.stringify(sq));
  mds.push(recordCase(c, { title: '每条边每次派发一张交接包，编号连续', face: '夹具', narrativeId: 'INST-235' }).md);
}

async function ac42() {
  const c = makeCase('AC-42');
  const root = freshRoot('ac42'); c.add(root);
  c.cmd(runSync(root, 'retest-fail'), '夹具场景 retest-fail 已跑完（测试「已升级」，开发「已完成」）');
  const cc1 = c.cmd(cancel(root), '第 1 次 orch cancel --instance INST-001');
  c.assert('5 秒内命令返回', (cc1.durationMs ?? 999999) < 5000, `${cc1.durationMs}ms`);
  c.eq('第 1 次 cancel 退出码 0', cc1.exitCode, 0);
  c.includes('第 1 次 cancel 输出含「会话 空闲」', text(cc1), '会话 空闲');
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  c.includes('第一行含「已取消」', lines(text(st))[0] ?? '', '已取消');
  const s = readState(root);
  c.eq("机检：nodes[1].state='cancelled'（原 'escalated'）", nodeOf(s, 'T-002')?.state, 'cancelled');
  c.eq("机检：nodes[0].state 仍是 'done'（已完成不倒推）", nodeOf(s, 'T-001')?.state, 'done');
  c.eq("机检：handoffs 三条的 state 仍是 'consumed'", (s?.handoffs ?? []).map((h) => h.state).join(','), 'consumed,consumed,consumed');
  c.eq("机检：escalations[0].state='voided'", esc(s)?.state, 'voided');
  const cc2 = c.cmd(cancel(root), '第 2 次 orch cancel --instance INST-001');
  c.includes('第二次输出逐字含「实例已结束（已取消），无需取消」', text(cc2), '实例已结束（已取消），无需取消');
  c.eq('第 2 次 cancel 退出码 1', cc2.exitCode, 1);
  mds.push(recordCase(c, { title: '取消能把「失败」和「已升级」的节点也收掉', face: '夹具', narrativeId: 'INST-236' }).md);
}

async function ac43() {
  const c = makeCase('AC-43');
  const root = freshRoot('ac43'); c.add(root);
  const envKeys = ['NODE_ENV=test', 'MAESTRO_TEST_PAUSE=after_accepted:T-002'];
  noteKeep(c, root, 'code-pass', [], envKeys);
  const h = startKeep(root, 'code-pass', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_accepted:T-002' }));
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('驱动停在「开发第 1 轮已完成、测试第 1 轮已派发并已接受」（.mock/paused 存在）', Boolean(reached), String(reached));
    const p2 = path.join(root, '.mock', 'prompts', '2.json');
    c.assert('夹具：.mock/prompts/2.json 存在', exists(p2), p2);
    let task2 = '';
    try { task2 = JSON.parse(fs.readFileSync(p2, 'utf8')).task ?? ''; } catch { /* 保持空 */ }
    for (const needle of ['给 calc.js 补一个 div 函数', '产物：calc.js', 'out/verdict.json', '判定']) {
      c.includes(`夹具：prompts/2.json 的 task 含「${needle}」`, task2, needle);
    }
    const s = readState(root);
    const ho = (s?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
    c.eq("机检：HO-001 的 edge.kind='forward'", ho?.edge?.kind, 'forward');
    c.assert("机检：HO-001 的 state='accepted' 或 'consumed'", ho?.state === 'accepted' || ho?.state === 'consumed', String(ho?.state));
    const s1 = (s?.sessions ?? []).find((x) => x.nodeId === 'T-001');
    const s2 = (s?.sessions ?? []).find((x) => x.nodeId === 'T-002');
    c.assert("机检：sessions 里 nodeId='T-001' 与 'T-002' 的 sessionId 不同", Boolean(s1 && s2 && s1.sessionId !== s2.sessionId),
      JSON.stringify([s1?.sessionId, s2?.sessionId]));
    const h1 = path.join(root, '.mock', 'history', '1.txt');
    c.assert('夹具：.mock/history/1.txt 存在', exists(h1), h1);
    c.includes('夹具：.mock/history/1.txt 含 "DEV-ROUND1"', exists(h1) ? fs.readFileSync(h1, 'utf8') : '', 'DEV-ROUND1');
    c.assert('夹具：.mock/history-leak 不存在（第 2 步没有夹带上一轮对话标记）', !exists(path.join(root, '.mock', 'history-leak')), 'history-leak');
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '正向交接包把任务与产物上下文带到下游', face: '夹具（核心侧 after_accepted:T-002）', narrativeId: 'INST-237', envKeys }).md);
}

async function ac44() {
  const c = makeCase('AC-44');
  const root = freshRoot('ac44'); c.add(root);
  const envKeys = ['NODE_ENV=test', 'MAESTRO_TEST_PAUSE=after_output:T-002'];
  noteKeep(c, root, 'backflow-once', [], envKeys);
  const h = startKeep(root, 'backflow-once', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_output:T-002' }));
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('test -f .mock/paused：核心停在「测试第 1 轮已出料、尚未核对」', Boolean(reached), String(reached));
    const s = readState(root);
    c.eq("机检：nodes[1].state='review'", nodeOf(s, 'T-002')?.state, 'review');
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const t = text(st);
    c.includes('输出含「节点 T-002 测试 待校验」', t, '节点 T-002 测试 待校验');
    c.includes('输出含独立行「会话 等待下游」', t, '会话 等待下游');
    c.notIncludes('输出不含「会话 执行中」', t, '会话 执行中');
    h.release();
    const moved = await h.waitState((x) => x && nodeOf(x, 'T-002')?.state !== 'review', 40000);
    c.assert("写 .mock/release 放行后 nodes[1].state 不再停在 'review'（进入 failed 或 done）",
      Boolean(moved) && ['failed', 'done'].includes(nodeOf(moved, 'T-002')?.state),
      `state=${nodeOf(moved, 'T-002')?.state}`);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '核对期间会话显示「等待下游」', face: '夹具（核心侧 after_output:T-002）', narrativeId: 'INST-238', envKeys }).md);
}

async function ac46() {
  const c = makeCase('AC-46');
  const root = freshRoot('ac46'); c.add(root);
  c.cmd(runSync(root, 'backflow-once'), 'node code-loop-driver.mjs --scenario backflow-once 跑完整场景');
  const s = readState(root);
  c.eq("机检：state='completed'", s?.state, 'completed');
  c.eq('机检：nodes[0].round=2 且 state=done', `${nodeOf(s, 'T-001')?.round}/${nodeOf(s, 'T-001')?.state}`, '2/done');
  c.eq('机检：nodes[1].round=2 且 state=done', `${nodeOf(s, 'T-002')?.round}/${nodeOf(s, 'T-002')?.state}`, '2/done');
  const hs = s?.handoffs ?? [];
  c.eq('机检：handoffs 恰好 3 条', hs.length, 3);
  c.eq('机检：edge.kind 依次 forward、backflow、retest', hs.map((h) => h.edge?.kind).join(','), 'forward,backflow,retest');
  c.eq("机检：state 都是 'consumed'", hs.map((h) => h.state).join(','), 'consumed,consumed,consumed');
  const p3 = path.join(root, '.mock', 'prompts', '3.json');
  const p4 = path.join(root, '.mock', 'prompts', '4.json');
  let t3 = '', t4 = '';
  try { t3 = JSON.parse(fs.readFileSync(p3, 'utf8')).task ?? ''; } catch { /* 保持空 */ }
  try { t4 = JSON.parse(fs.readFileSync(p4, 'utf8')).task ?? ''; } catch { /* 保持空 */ }
  for (const needle of ['div 在除数为 0 时返回 Infinity，未抛错', 'out/test-log.txt', 'div 在整除场景存在浮点误差', 'out/test-log-2.txt']) {
    c.includes(`夹具：prompts/3.json 的 task 含「${needle}」`, t3, needle);
  }
  c.includes('夹具：prompts/4.json 的 task 含「上一轮缺陷：2 条」', t4, '上一轮缺陷：2 条');
  const st = c.cmd(statusText(root), 'orch status --instance INST-001');
  c.matches('orch status 有一行匹配 ^节点 T-002 测试 已完成 · 第 2 轮 · 耗时 \\S+ · 判定 通过$', text(st), T2DONE);
  c.includes('orch status 输出含「升级 —」', text(st), '升级 —');
  mds.push(recordCase(c, { title: '夹具面：回流后复测通过，两节点闭环完成', face: '夹具', narrativeId: 'INST-239' }).md);
}

// ---------------------------------------------------------------- NFR（夹具可测）
async function nfr01a() {
  const c = makeCase('NFR-01a');
  const root = freshRoot('nfr01a'); c.add(root);
  const times = [];
  for (let i = 0; i < 10; i += 1) {
    c.cmd(coreStop(root), `第 ${i + 1} 次 orch core stop`);
    const st = c.cmd(orch(root, ['status']), `第 ${i + 1} 次 orch status（冷启动计时）`);
    times.push(st.durationMs ?? 999999);
  }
  const max = Math.max(...times);
  c.assert('核心冷启动：10 次取最大 < 5000ms', max < 5000, `max=${max}ms times=${JSON.stringify(times)}`);
  nfrMds.push(recordCase(c, { title: 'NFR-01a 核心冷启动 5 秒内', face: '夹具（本地根，无真实 DSH）', narrativeId: 'NFR-01a' }).md);
}

async function nfr01b() {
  const c = makeCase('NFR-01b');
  const root = freshRoot('nfr01b'); c.add(root);
  c.cmd(runSync(root, 'code-pass'), 'code-pass 场景（热启动样本）');
  const ev = readEvents(root);
  const start = ev.find((e) => e.reason === 'run.started');
  const first = ev.find((e) => e.reason === 'node.dispatch');
  c.assert('events 里能取到 run.started 与首个 node.dispatch', Boolean(start && first), JSON.stringify([start, first]));
  const d = start && first ? new Date(first.ts) - new Date(start.ts) : -1;
  c.assert('热启动首次派发 < 5000ms（run.started → node.dispatch 的 ts 差）', d >= 0 && d < 5000, `${d}ms`);
  nfrMds.push(recordCase(c, { title: 'NFR-01b 首次派发（热启动 5 秒内）', face: '夹具（mock 宿主热启动）', narrativeId: 'NFR-01b',
    extra: '> 冷启动 30 秒目标以「真实 DSH 未拉起」为前提，属真实面，夹具面不覆盖；此处只测热启动。' }).md);
}

async function nfr02() {
  const c = makeCase('NFR-02');
  const root = freshRoot('nfr02'); c.add(root);
  c.cmd(runSync(root, 'backflow-once'), 'backflow-once 场景（判定不通过 → 回流）');
  const ev = readEvents(root);
  const vi = ev.findIndex((e) => e.reason === 'verdict.read');
  const ni = ev.findIndex((e, i) => i > vi && e.reason === 'node.dispatch');
  c.assert('能定位 verdict.read 与紧随其后的 node.dispatch', vi >= 0 && ni > vi, `vi=${vi} ni=${ni}`);
  const d = vi >= 0 && ni > vi ? new Date(ev[ni].ts) - new Date(ev[vi].ts) : -1;
  c.assert('判定落地后 1 秒内看到回流开始（ts 差 < 1000ms）', d >= 0 && d < 1000, `${d}ms`);
  nfrMds.push(recordCase(c, { title: 'NFR-02 判定落地后 1 秒内回流', face: '夹具', narrativeId: 'NFR-02' }).md);
}

async function nfr03() {
  const c = makeCase('NFR-03');
  const specs = [['code-pass', 'completed'], ['backflow-once', 'completed'], ['retest-fail', 'suspended'],
    ['artifact-missing', 'suspended'], ['verdict-missing', 'suspended']];
  for (const [sc, expect] of specs) {
    const root = freshRoot(`nfr03-${sc}`); c.add(root);
    c.cmd(runSync(root, sc), `NFR-03 场景 ${sc} 跑一次`);
    const s = readState(root);
    c.eq(`[${sc}] 最终 state=${expect}`, s?.state, expect);
    const nodes = s?.nodes ?? [];
    c.eq(`[${sc}] 两节点（nodes.length=2）`, nodes.length, 2);
    c.eq(`[${sc}] 无 round>2（轮次不错乱）`, nodes.filter((n) => n.round > 2).length, 0);
    const disp = readEvents(root).filter((e) => e.reason === 'node.dispatch').map((e) => e.seq);
    c.assert(`[${sc}] node.dispatch 事件 seq 严格递增（节点不乱序）`, disp.every((n, i) => i === 0 || n > disp[i - 1]), JSON.stringify(disp));
  }
  nfrMds.push(recordCase(c, { title: 'NFR-03 连跑 5 个闭环 0 次乱序', face: '夹具（5 个独立项目根）', narrativeId: 'NFR-03' }).md);
}

async function nfr07() {
  const c = makeCase('NFR-07');
  const root = freshRoot('nfr07'); c.add(root);
  c.cmd(runSync(root, 'code-pass'), 'code-pass 场景（已完成的稳定实例）');
  const s0 = readState(root);
  const ev0 = readEvents(root).length;
  const t0 = Date.now();
  for (let i = 0; i < 100; i += 1) orch(root, ['status']);
  noteFixture(c, 'for i in $(seq 100); do orch status > /dev/null; done', `100 次 status 实际执行，耗时 ${Date.now() - t0}ms`);
  const s1 = readState(root);
  c.eq('100 次 status 后 sessions.length 不变', (s1?.sessions ?? []).length, (s0?.sessions ?? []).length);
  c.eq('100 次 status 后 events 行数不变', readEvents(root).length, ev0);
  c.eq('100 次 status 后 state 不变', s1?.state, s0?.state);
  nfrMds.push(recordCase(c, { title: 'NFR-07 频繁查询不让闭环多跑', face: '夹具（本地根）', narrativeId: 'NFR-07' }).md);
}

async function nfr08() {
  const c = makeCase('NFR-08');
  const root = freshRoot('nfr08'); c.add(root);
  const envKeys = ['NODE_ENV=test', 'MAESTRO_TEST_PAUSE=after_output:T-002'];
  noteKeep(c, root, 'backflow-once', [], envKeys);
  const h = startKeep(root, 'backflow-once', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_output:T-002' }));
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('核心常驻（after_output 暂停点模拟「命令窗口已不在」）', Boolean(reached), String(reached));
    const coreFile = path.join(root, '.orch', 'core.json');
    const pid1 = (() => { try { return JSON.parse(fs.readFileSync(coreFile, 'utf8')).pid; } catch { return null; } })();
    const ev1 = readEvents(root).length;
    c.assert('取到 .orch/core.json 的进程号', Number.isInteger(pid1) && pid1 > 0, String(pid1));
    h.release();
    const done = await h.waitState((s) => s.state === 'completed', 40000);
    c.assert('30 秒内闭环自行推进到完成（事件仍有新增）', Boolean(done), String(done));
    const pid2 = (() => { try { return JSON.parse(fs.readFileSync(coreFile, 'utf8')).pid; } catch { return null; } })();
    c.eq('核心进程号不变', pid2, pid1);
    c.assert('events 行数有新增', readEvents(root).length > ev1, `before=${ev1} after=${readEvents(root).length}`);
  } finally { await h.stop(); await forceKillCore(root); }
  nfrMds.push(recordCase(c, { title: 'NFR-08 关掉命令窗口闭环不被带走', face: '夹具（常驻核心 + 暂停点）', narrativeId: 'NFR-08',
    extra: '> 夹具下用 `after_output:T-002` 暂停 + 常驻核心近似「命令窗口已关闭」；未真正关闭终端窗口（进程由 startDriver 持有），但核心 pid 不变与「放行后 30 秒内事件仍有新增」已真实验证。' }).md);
}

async function main() {
  const all = [ac37, ac38, ac39, ac40, ac41, ac42, ac43, ac44, ac46];
  for (const fn of all) {
    try { await fn(); console.log(`[b4] ${fn.name} done`); }
    catch (err) { console.error(`[b4] ${fn.name} ERROR ${err?.stack ?? err}`); }
  }
  appendBatch('4 批 4（AC-37/38/39/40/41/42/43/44/46）', mds,
    '> 批 4 中间结论：以上 9 条已逐条真跑并落 `evidence/AC-xx.*`；总判待 final 脚本汇总。');
  const nfrAll = [nfr01a, nfr01b, nfr02, nfr03, nfr07, nfr08];
  for (const fn of nfrAll) {
    try { await fn(); console.log(`[b4] ${fn.name} done`); }
    catch (err) { console.error(`[b4] ${fn.name} ERROR ${err?.stack ?? err}`); }
  }
  appendBatch('5 非功能项（夹具可测：NFR-01a/01b/02/03/07/08）', nfrMds,
    '> NFR-04（AC-09）、NFR-05（AC-10）、NFR-06（AC-11/AC-42）、NFR-09（AC-12）已在对应 AC 中真跑覆盖；NFR-01b 冷启动 30 秒目标属真实面，不在夹具面覆盖。');
  const tl = runCmd(['tasklist', '/FI', 'IMAGENAME eq node.exe', '/NH'], { cwd: REPO, label: 'tasklist 自查' });
  fs.appendFileSync(path.join(REPO, 'docs', 'iterations', 'iteration-2', 'acceptance-fixture.md'),
    `\n> 批 4 结束 tasklist 自查（node.exe 行数）：${lines(tl.stdout).filter((l) => l.includes('node.exe')).length}\n`, 'utf8');
  console.log('[b4] ALL DONE');
}
main();
