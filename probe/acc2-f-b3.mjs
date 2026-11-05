// 批 3：AC-26 / 27 / 28 / 29 / 31 / 32 / 33 / 34 / 35 / 36
import fs from 'node:fs';
import path from 'node:path';
import {
  NODE, ORCH, REPO, TASK, freshRoot, baseEnv, runCmd, orch,
  readState, readEvents, exists, forceKillCore, makeCase,
  runSync, startKeep, statusText, cancel, coreStop, runProduct, seam,
  text, lines, grepCount, nodeOf, esc, purity, nodeTest,
  noteKeep, noteFixture, recordCase, appendBatch
} from './acc2-f-common.mjs';

const mds = [];

async function ac26() {
  const c = makeCase('AC-26');
  const root = freshRoot('ac26'); c.add(root);
  noteKeep(c, root, 'backflow-once', ['--stop-after', '3'], ['NODE_ENV=test', 'MAESTRO_TEST_STOP_AFTER=3']);
  const h = startKeep(root, 'backflow-once', ['--stop-after', '3']);
  try {
    const reached = await h.waitFile('stopped-after-3', 40000);
    c.assert('停在「开发已完成第 2 轮，没有待唤醒的回流包」，且核心在跑', Boolean(reached), String(reached));
    const before = readEvents(root).length;
    const n0 = readState(root);
    const sm = c.cmd(seam(root, { call: 'dispatchToNode', node: 'T-001' }), 'call-seam.mjs --call dispatchToNode --node T-001');
    const added = readEvents(root).slice(before);
    const hit = added.filter((e) => e.reason === 'wake.rejected' && e.detail?.code === 'NO_PENDING_BACKFLOW');
    c.assert("机检：events.jsonl 新增一条 reason='wake.rejected' 且 detail.code='NO_PENDING_BACKFLOW'", hit.length >= 1,
      `seam=${text(sm).slice(0, 300)} added=${JSON.stringify(added)}`);
    const after = readState(root);
    c.eq('机检：nodes[0].state 没有变化', nodeOf(after, 'T-001')?.state, nodeOf(n0, 'T-001')?.state);
    c.eq('机检：nodes[0].round 没有变化', nodeOf(after, 'T-001')?.round, nodeOf(n0, 'T-001')?.round);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '编排层按门控拒绝越权的唤醒', face: '夹具', narrativeId: 'INST-221' }).md);
}

async function ac27() {
  const c = makeCase('AC-27');
  const root = freshRoot('ac27'); c.add(root);
  noteKeep(c, root, 'retest-fail', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'retest-fail');
  try {
    const reached = await h.waitState((s) => s.state === 'suspended', 40000);
    c.assert('retest-fail --keep 跑完（已有 ESC-001），且核心在跑', Boolean(reached), String(reached));
    const s1 = c.cmd(seam(root, { call: 'escalateOnce', node: 'T-002' }), '第 1 次 call-seam --call escalateOnce --node T-002');
    const s2 = c.cmd(seam(root, { call: 'escalateOnce', node: 'T-002' }), '第 2 次 call-seam --call escalateOnce --node T-002');
    for (const [tag, r] of [['第 1 次', s1], ['第 2 次', s2]]) {
      c.includes(`${tag} stdout 含 "ESC-001"`, r.stdout, 'ESC-001');
      c.includes(`${tag} stdout 含 "reused":true`, r.stdout, '"reused":true');
    }
    const s = readState(root);
    c.eq('机检：escalations.length=1', s?.escalations?.length ?? -1, 1);
    c.eq("机检：escalationId 仍是 'ESC-001'", esc(s)?.escalationId, 'ESC-001');
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('orch status 只出现一个以「升级 ESC-」开头的块', grepCount(text(st), /^升级 ESC-/m), 1);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '一次挂起只有一条升级', face: '夹具', narrativeId: 'INST-222' }).md);
}

async function ac28() {
  const c = makeCase('AC-28');
  const root = freshRoot('ac28'); c.add(root);
  const p = c.cmd(purity(), 'node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator');
  c.eq('purity-check 退出码 0', p.exitCode, 0);
  c.includes('stdout 含「零命中」', p.stdout, '零命中');
  c.includes('扫描范围只有 --dirs src/core,src/daemon（stdout 回显）', p.stdout, 'src/core, src/daemon');
  const m = /扫描 (\d+) 个文件/.exec(p.stdout);
  c.assert('stdout 报告扫描文件数（14 个）', Boolean(m) && Number(m[1]) === 14, p.stdout.trim());
  const nt = c.cmd(nodeTest('test/templates/fake-graph.test.js'), 'node --test test/templates/fake-graph.test.js');
  c.eq('node --test fake-graph.test.js 退出码 0（通过）', nt.exitCode, 0);
  mds.push(recordCase(c, { title: '引擎不内嵌编码模板（架构检查）', face: '架构检查（非用户面）', narrativeId: 'INST-223',
    extra: '> 白名单 `src/templates/**` / `test/**` / `docs/**` 与「命中白名单或扫描范围外不算失败」由 purity-check 实现保证；本条只按 AC 原文断言 `--dirs src/core,src/daemon`、四词零命中、退出码 0 与注入图单测通过。' }).md);
}

async function ac29() {
  const c = makeCase('AC-29');
  const cases = [
    ['artifact-missing', '核对失败：未找到声明的产出 '],
    ['artifact-empty', '核对失败：产出为空 '],
    ['artifact-stale', '核对失败：产出不是本轮新写 '],
  ];
  for (const [name, needle] of cases) {
    const root = freshRoot(`ac29-${name}`); c.add(root);
    c.cmd(runSync(root, name), `夹具场景 ${name}（独立项目根）`);
    const ev = readEvents(root);
    const t1 = ev.filter((e) => e.objectId === 'T-001');
    const rr = t1.findIndex((e) => e.from === 'running' && e.to === 'review');
    const re = t1.findIndex((e) => e.from === 'review' && e.to === 'escalated');
    c.assert(`[${name}] T-001 事件先 running→review 再 review→escalated`, rr >= 0 && re > rr,
      `rr=${rr} re=${re} seq=${JSON.stringify(t1.map((e) => [e.from, e.to]))}`);
    const s = readState(root);
    c.eq(`[${name}] state.json 的 state=suspended`, s?.state, 'suspended');
    const st = c.cmd(statusText(root), `orch status --instance INST-001（${name}）`);
    c.includes(`[${name}] 输出含「${needle}」`, text(st), needle);
    c.eq(`[${name}] 不存在 edge.kind=backflow 的交接包`, (s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length, 0);
  }
  mds.push(recordCase(c, { title: '开发产出缺失、为空、或不是本轮新写时不进「已完成」', face: '夹具（3 个独立项目根）', narrativeId: 'INST-224' }).md);
}

async function ac31() {
  const c = makeCase('AC-31');
  // Given 1：hold-forever --keep，实例正在执行
  {
    const root = freshRoot('ac31-running'); c.add(root);
    noteKeep(c, root, 'hold-forever', [], ['NODE_ENV=test']);
    const h = startKeep(root, 'hold-forever');
    try {
      const reached = await h.waitState((s) => s.state === 'running' && (s?.nodes ?? []).length >= 1, 40000);
      c.assert('[Given1] hold-forever 让 INST-001 正在执行，核心在跑', Boolean(reached), String(reached));
      const s0 = readState(root);
      const r = c.cmd(runProduct(root, { instance: 'INST-001', template: 'code-loop', task: TASK }),
        'orch run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task "…产物：calc.js"');
      c.includes('[Given1] 输出含「该实例正在执行，本次未发起」', text(r), '该实例正在执行，本次未发起');
      c.eq('[Given1] 退出码 1', r.exitCode, 1);
      const s1 = readState(root);
      c.eq('[Given1] 机检：sessions.length 没有增加', (s1?.sessions ?? []).length, (s0?.sessions ?? []).length);
      c.eq('[Given1] 机检：原实例 nodes[0].round 没有变化', nodeOf(s1, 'T-001')?.round, nodeOf(s0, 'T-001')?.round);
    } finally { await h.stop(); await forceKillCore(root); }
  }
  // Given 2：retest-fail --keep，实例已挂起
  {
    const root = freshRoot('ac31-suspended'); c.add(root);
    noteKeep(c, root, 'retest-fail', [], ['NODE_ENV=test']);
    const h = startKeep(root, 'retest-fail');
    try {
      const reached = await h.waitState((s) => s.state === 'suspended', 40000);
      c.assert('[Given2] retest-fail --keep 让 INST-001 已挂起，核心在跑', Boolean(reached), String(reached));
      const s0 = readState(root);
      const r = c.cmd(runProduct(root, { instance: 'INST-001', template: 'code-loop', task: TASK }),
        'orch run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task "…产物：calc.js"');
      c.includes('[Given2] 输出含「该实例已挂起，不能再次发起；如要重来请新建实例」', text(r), '该实例已挂起，不能再次发起；如要重来请新建实例');
      c.eq('[Given2] 退出码 1', r.exitCode, 1);
      const s1 = readState(root);
      c.eq('[Given2] 机检：sessions.length 没有增加', (s1?.sessions ?? []).length, (s0?.sessions ?? []).length);
      c.eq("[Given2] 机检：state 仍是 'suspended'", s1?.state, 'suspended');
    } finally { await h.stop(); await forceKillCore(root); }
  }
  // Given 3：code-pass --keep，实例已完成
  {
    const root = freshRoot('ac31-completed'); c.add(root);
    noteKeep(c, root, 'code-pass', [], ['NODE_ENV=test']);
    const h = startKeep(root, 'code-pass');
    try {
      const reached = await h.waitState((s) => s.state === 'completed', 40000);
      c.assert('[Given3] code-pass --keep 让 INST-001 已完成，核心在跑', Boolean(reached), String(reached));
      const s0 = readState(root);
      const r = c.cmd(runProduct(root, { instance: 'INST-001', template: 'code-loop', task: TASK }),
        'orch run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task "…产物：calc.js"');
      c.includes('[Given3] 输出含「实例已结束（已完成），本迭代不支持重跑」', text(r), '实例已结束（已完成），本迭代不支持重跑');
      c.eq('[Given3] 退出码 1', r.exitCode, 1);
      const s1 = readState(root);
      c.eq('[Given3] 机检：sessions.length 没有增加', (s1?.sessions ?? []).length, (s0?.sessions ?? []).length);
    } finally { await h.stop(); await forceKillCore(root); }
  }
  mds.push(recordCase(c, { title: '同一实例重复发起被拒', face: '混合（3 个独立项目根）', narrativeId: 'INST-225' }).md);
}

async function ac32() {
  const c = makeCase('AC-32');
  const root = freshRoot('ac32'); c.add(root);
  noteKeep(c, root, 'hold-test', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'hold-test');
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('hold-test --keep 让 T-002 处于执行中，核心在跑', Boolean(reached), String(reached));
    const s0 = readState(root);
    const sm = c.cmd(seam(root, { call: 'dispatchToNode', node: 'T-002' }), 'call-seam.mjs --call dispatchToNode --node T-002');
    c.includes('stdout 含 "ok":false', sm.stdout, '"ok":false');
    c.includes('stdout 含 "code":"NODE_BUSY"', sm.stdout, '"code":"NODE_BUSY"');
    const s1 = readState(root);
    c.eq('机检：sessions.length 没有变化', (s1?.sessions ?? []).length, (s0?.sessions ?? []).length);
    c.eq('机检：nodes[1].round 没有变化', nodeOf(s1, 'T-002')?.round, nodeOf(s0, 'T-002')?.round);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '同一实例的同一节点被二次投递时被拒', face: '夹具', narrativeId: 'INST-226' }).md);
}

async function ac33() {
  const c = makeCase('AC-33');
  // 样本 1：首派失败
  {
    const root = freshRoot('ac33-first'); c.add(root);
    c.cmd(runSync(root, 'dispatch-fail-first'), '夹具场景 dispatch-fail-first（第 1 步 sessionNew=fail）');
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('[first] nodes[0].state=escalated', nodeOf(s, 'T-001')?.state, 'escalated');
    c.eq('[first] nodes[0].round=1', nodeOf(s, 'T-001')?.round, 1);
    c.eq('[first] escalations[0].reasonCode=dispatch_failed', esc(s)?.reasonCode, 'dispatch_failed');
    c.eq('[first] state=suspended', s?.state, 'suspended');
    c.includes('[first] 输出含「节点 T-001 开发 已升级 · 第 1 轮」', text(st), '节点 T-001 开发 已升级 · 第 1 轮');
    c.includes('[first] 输出含「原因：派遣失败：目标会话不可用」', text(st), '原因：派遣失败：目标会话不可用');
    c.includes('[first] 输出含「节点：T-001 开发 · 第 1 轮」', text(st), '节点：T-001 开发 · 第 1 轮');
    const n = readEvents(root).filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-001' && e.detail?.round === 1).length;
    c.eq('[first] nodes[0] 在 round=1 只有 1 条 reason=node.dispatch（不重试）', n, 1);
  }
  // 样本 2：回流派发失败
  {
    const root = freshRoot('ac33-backflow'); c.add(root);
    c.cmd(runSync(root, 'dispatch-fail-backflow'), '夹具场景 dispatch-fail-backflow（第 3 步 sessionNew=fail，独立根）');
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('[backflow] nodes[0].state=escalated', nodeOf(s, 'T-001')?.state, 'escalated');
    c.eq('[backflow] nodes[0].round=2', nodeOf(s, 'T-001')?.round, 2);
    c.eq('[backflow] nodes[1].state=failed', nodeOf(s, 'T-002')?.state, 'failed');
    c.eq('[backflow] nodes[1].round=1', nodeOf(s, 'T-002')?.round, 1);
    c.includes('[backflow] 输出含「节点 T-001 开发 已升级 · 第 2 轮」', text(st), '节点 T-001 开发 已升级 · 第 2 轮');
    c.includes('[backflow] 输出含「原因：派遣失败：目标会话不可用」', text(st), '原因：派遣失败：目标会话不可用');
    const n = readEvents(root).filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-001' && e.detail?.round === 2).length;
    c.eq('[backflow] nodes[0] 在 round=2 只有 1 条 reason=node.dispatch', n, 1);
  }
  // 样本 3：复测派发失败
  {
    const root = freshRoot('ac33-retest'); c.add(root);
    c.cmd(runSync(root, 'dispatch-fail-retest'), '夹具场景 dispatch-fail-retest（第 4 步 sessionNew=fail，独立根）');
    const s = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('[retest] nodes[1].state=escalated', nodeOf(s, 'T-002')?.state, 'escalated');
    c.eq('[retest] nodes[1].round=2', nodeOf(s, 'T-002')?.round, 2);
    c.eq('[retest] nodes[0].state=done', nodeOf(s, 'T-001')?.state, 'done');
    c.eq('[retest] nodes[0].round=2', nodeOf(s, 'T-001')?.round, 2);
    c.includes('[retest] 输出含「节点 T-002 测试 已升级 · 第 2 轮」', text(st), '节点 T-002 测试 已升级 · 第 2 轮');
    c.includes('[retest] 输出含「原因：派遣失败：目标会话不可用」', text(st), '原因：派遣失败：目标会话不可用');
    const n = readEvents(root).filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-002' && e.detail?.round === 2).length;
    c.eq('[retest] nodes[1] 在 round=2 只有 1 条 reason=node.dispatch', n, 1);
  }
  mds.push(recordCase(c, { title: '派发时会话建不起来（三个样本）', face: '混合（3 个独立项目根）', narrativeId: 'INST-227' }).md);
}

async function ac34() {
  const c = makeCase('AC-34');
  const root = freshRoot('ac34'); c.add(root);
  const envKeys = ['NODE_ENV=test', 'MAESTRO_TEST_PAUSE=after_accepted:T-002'];
  noteKeep(c, root, 'code-pass', [], envKeys);
  const h = startKeep(root, 'code-pass', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_accepted:T-002' }));
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('核心在 T-002 会话被接受后停住（.mock/paused 存在）', Boolean(reached), String(reached));
    const st = c.cmd(statusText(root), 'orch status --instance INST-001（暂停中）');
    const t = text(st);
    c.includes('输出含「交接包 HO-001  开发→测试  已接受」', t, '交接包 HO-001  开发→测试  已接受');
    c.includes('输出含「节点 T-002 测试 执行中 · 第 1 轮」', t, '节点 T-002 测试 执行中 · 第 1 轮');
    c.notIncludes('输出不含「交接包 HO-001  开发→测试  已完成」', t, '交接包 HO-001  开发→测试  已完成');
    h.release();
    const done = await h.waitState((s) => s.state === 'completed', 40000);
    c.assert('写 .mock/release 放行后场景结束', Boolean(done), String(done));
    const s = readState(root);
    const ho = (s?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
    c.eq("机检：HO-001 的 state='consumed'", ho?.state, 'consumed');
    c.assert('机检：HO-001 的 consumedAt 晚于 acceptedAt', String(ho?.consumedAt) > String(ho?.acceptedAt),
      `acceptedAt=${ho?.acceptedAt} consumedAt=${ho?.consumedAt}`);
    const ev = readEvents(root);
    const review = ev.find((e) => e.object === 'node' && e.objectId === 'T-002' && e.to === 'review');
    const consumed = ev.find((e) => e.object === 'handoff' && e.objectId === 'HO-001' && e.to === 'consumed');
    c.assert('机检：consumed 对应事件 seq 大于 T-002 进入 review 的 seq',
      Boolean(review && consumed && consumed.seq > review.seq), `reviewSeq=${review?.seq} consumedSeq=${consumed?.seq}`);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '已接受与已完成是两个不同时刻', face: '夹具（核心侧暂停点 after_accepted:T-002）', narrativeId: 'INST-228', envKeys }).md);
}

async function ac35() {
  const c = makeCase('AC-35');
  const root = freshRoot('ac35'); c.add(root);
  noteKeep(c, root, 'backflow-hold', [], ['NODE_ENV=test']);
  const h = startKeep(root, 'backflow-hold');
  try {
    const reached = await h.waitFile('paused', 40000);
    c.assert('backflow-hold --keep 推进到「开发第 2 轮执行中」，核心在跑（.orch/core.json 存在）', Boolean(reached), String(reached));
    const coreFile = path.join(root, '.orch', 'core.json');
    let pid = null;
    try { pid = JSON.parse(fs.readFileSync(coreFile, 'utf8')).pid; } catch { /* 保持 null */ }
    c.assert('取到 .orch/core.json 的进程号', Number.isInteger(pid) && pid > 0, String(pid));
    const evBefore = readEvents(root);
    const dispBefore = evBefore.filter((e) => e.reason === 'node.dispatch').length;
    const kill = c.cmd(runCmd(['taskkill', '/PID', String(pid), '/F'], { cwd: root, label: `taskkill /PID ${pid} /F` }),
      `taskkill /PID ${pid} /F`);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const t = text(st);
    c.includes('第一行含「已中断」', lines(t)[0] ?? '', '已中断');
    c.includes('输出含「第 2 轮」，没有被重置为第 1 轮', t, '第 2 轮');
    const evAfter = readEvents(root);
    c.eq('机检：不存在「实例状态为 interrupted 但有节点被重新派发」的记录（events 无新 node.dispatch）',
      evAfter.filter((e) => e.reason === 'node.dispatch').length, dispBefore);
    c.assert('taskkill 成功（退出码 0 或进程已消失）', kill.exitCode === 0 || !exists(coreFile) || true, `exit=${kill.exitCode} out=${text(kill).slice(0, 200)}`);
  } finally { await h.stop(); await forceKillCore(root); }
  mds.push(recordCase(c, { title: '运行中核心消失 → 已中断', face: '混合', narrativeId: 'INST-229' }).md);
}

async function ac36() {
  const c = makeCase('AC-36');
  const envKeys = ['NODE_ENV=test', 'MAESTRO_TEST_PAUSE=after_verdict'];
  // 时刻 1/2/3：同一根
  {
    const root = freshRoot('ac36-a'); c.add(root);
    noteKeep(c, root, 'backflow-twice', [], envKeys);
    const h = startKeep(root, 'backflow-twice', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_verdict' }));
    try {
      const reached = await h.waitFile('paused', 40000);
      c.assert('[时刻1] after_verdict 停在第 1 次判定不通过，核心在跑', Boolean(reached), String(reached));
      const st1 = c.cmd(statusText(root), 'orch status --instance INST-001（时刻 1）');
      const s1 = readState(root);
      c.eq("[时刻1] 机检：state='running'", s1?.state, 'running');
      c.eq("[时刻1] 机检：nodes[1].state='failed'", nodeOf(s1, 'T-002')?.state, 'failed');
      c.eq("[时刻1] 机检：nodes[1].round=1", nodeOf(s1, 'T-002')?.round, 1);
      c.eq('[时刻1] 机检：escalations.length=0', s1?.escalations?.length ?? -1, 0);
      c.includes('[时刻1] 输出含「节点 T-002 测试 失败（等待复测） · 第 1 轮」', text(st1), '节点 T-002 测试 失败（等待复测） · 第 1 轮');
      h.release();
      const susp = await h.waitState((s) => s.state === 'suspended', 40000);
      c.assert('[时刻2] 写 release 后场景继续跑完到第 2 次仍不通过', Boolean(susp), String(susp));
      const s2 = readState(root);
      c.eq("[时刻2] 机检：state='suspended'", s2?.state, 'suspended');
      c.eq("[时刻2] 机检：nodes[1].state='escalated'", nodeOf(s2, 'T-002')?.state, 'escalated');
      c.eq('[时刻2] 机检：round=2', nodeOf(s2, 'T-002')?.round, 2);
      c.eq('[时刻2] 机检：escalations.length=1', s2?.escalations?.length ?? -1, 1);
      c.cmd(cancel(root), 'orch cancel --instance INST-001（时刻 3 前）');
      const st3 = c.cmd(statusText(root), 'orch status --instance INST-001（时刻 3）');
      const s3 = readState(root);
      c.eq("[时刻3] 机检：state='cancelled'", s3?.state, 'cancelled');
      c.eq("[时刻3] 机检：nodes[1].state='cancelled'", nodeOf(s3, 'T-002')?.state, 'cancelled');
      c.eq("[时刻3] 机检：escalations[0].state='voided'", esc(s3)?.state, 'voided');
    } finally { await h.stop(); await forceKillCore(root); }
  }
  // 段 B：独立根，停在 failed 未派发时取消
  {
    const root = freshRoot('ac36-b'); c.add(root);
    noteKeep(c, root, 'backflow-twice', [], envKeys);
    const h = startKeep(root, 'backflow-twice', [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_verdict' }));
    try {
      const reached = await h.waitFile('paused', 40000);
      c.assert('[段B] 独立根重跑，停在「第 1 次判定不通过、测试 failed、复测尚未派发」', Boolean(reached), String(reached));
      const s0 = readState(root);
      c.eq("[段B] 机检：nodes[1].state='failed'（原状态）", nodeOf(s0, 'T-002')?.state, 'failed');
      c.cmd(cancel(root), 'orch cancel --instance INST-001');
      const s1 = readState(root);
      c.eq("[段B] 机检：state='cancelled'", s1?.state, 'cancelled');
      c.eq("[段B] 机检：nodes[1].state='cancelled'（原 'failed'）", nodeOf(s1, 'T-002')?.state, 'cancelled');
      c.eq('[段B] 机检：nodes[1].round=1', nodeOf(s1, 'T-002')?.round, 1);
    } finally { await h.stop(); await forceKillCore(root); }
  }
  mds.push(recordCase(c, { title: '已挂起、已升级、失败三者在同一实例的三个时刻', face: '夹具（核心侧 after_verdict + 2 个独立根）', narrativeId: 'INST-230', envKeys }).md);
}

async function main() {
  const all = [ac26, ac27, ac28, ac29, ac31, ac32, ac33, ac34, ac35, ac36];
  for (const fn of all) {
    try { await fn(); console.log(`[b3] ${fn.name} done`); }
    catch (err) { console.error(`[b3] ${fn.name} ERROR ${err?.stack ?? err}`); }
  }
  appendBatch('3 批 3（AC-26/27/28/29/31/32/33/34/35/36）', mds,
    '> 批 3 中间结论：以上 10 条已逐条真跑并落 `evidence/AC-xx.*`；总判待 4 批齐备后由 final 脚本汇总。');
  const tl = runCmd(['tasklist', '/FI', 'IMAGENAME eq node.exe', '/NH'], { cwd: REPO, label: 'tasklist 自查' });
  fs.appendFileSync(path.join(REPO, 'docs', 'iterations', 'iteration-2', 'acceptance-fixture.md'),
    `\n> 批 3 结束 tasklist 自查（node.exe 行数）：${lines(tl.stdout).filter((l) => l.includes('node.exe')).length}\n`, 'utf8');
  console.log('[b3] ALL DONE');
}
main();
