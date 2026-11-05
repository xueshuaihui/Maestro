/**
 * I1.2 真实面验收（独立验收员 P）—— 补充验证 + NFR 计量。
 *
 * 职责（全部只读实现、不改 mock、不改 src/test/bin）：
 *  1) AC-45：从已落盘 evidence 复算 verdict.read(fail) 的 seq 断言与全部机检项
 *  2) AC-22：I1.1 抽查的补充验证 —— AC-13 损坏不清空 / AC-12 不重跑 / AC-07 重复发起
 *  3) NFR：NFR-01a（10 次核心冷启动计时）/ NFR-01b（run.started→首个 node.dispatch）/ NFR-02（verdict.read→回流 dispatch）
 *
 * 只新增 evidence 下 AC-22.* / AC-45.* / NFR-0xx-real.* 前缀文件，不覆盖夹具面文件。
 * 用法：node probe/acc2-p-final.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ORCH = path.join(REPO, 'bin', 'orch.js');
const EV = path.join(REPO, 'docs/iterations/iteration-2/evidence');
const B = path.join(process.env.TEMP, 'maestro-acc-p2');
const SMOKE = path.join(B, 'smoke');

const env = {
  ...process.env,
  DSH_HOME: path.join(B, 'dsh-home').replaceAll('\\', '/'),
  ELECTRON_RUN_AS_NODE: '1'
};
for (const k of [
  'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'MAESTRO_TEST_PAUSE',
  'MAESTRO_TEST_STOP_AFTER', 'MAESTRO_FAULT', 'MAESTRO_PERMISSION_POLICY'
]) delete env[k];

function write(name, data) {
  fs.writeFileSync(path.join(EV, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf8');
}
function readText(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function orch(args, cwd) {
  const r = spawnSync(process.execPath, [ORCH, ...args], { cwd, env, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
}
function events(label, dir = EV) {
  const t = readText(path.join(dir, `${label}.events.jsonl`));
  if (!t) return [];
  return t.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const ms = (e) => Date.parse(e.ts);
const meta = (l) => JSON.parse(readText(path.join(EV, `${l}.meta.json`)));

const report = {};

// ---------- 1) AC-45 机检复核 ----------
{
  const ev45 = events('AC-45');
  const dispatches = ev45
    .filter((e) => e.reason === 'node.dispatch')
    .map((e) => ({ seq: e.seq, nodeId: e.objectId, round: e.detail?.round, ts: e.ts }));
  const vFail = ev45.filter((e) => e.reason === 'verdict.read' && e.detail?.verdict === 'fail');
  const vPass = ev45.filter((e) => e.reason === 'verdict.read' && e.detail?.verdict === 'pass');
  const t002r1 = dispatches.find((d) => d.nodeId === 'T-002' && d.round === 1);
  const t001r2 = dispatches.find((d) => d.nodeId === 'T-001' && d.round === 2);
  const seqOk = !!vFail.length && !!t002r1 && !!t001r2 &&
    vFail[0].seq > t002r1.seq && vFail[0].seq < t001r2.seq;

  const state = JSON.parse(readText(path.join(EV, 'AC-45.state.json')));
  const st45 = readText(path.join(EV, 'AC-45.status.txt')) ?? '';
  const out45 = readText(path.join(EV, 'AC-45.output.txt')) ?? '';
  const sessionsT001 = (state.sessions ?? []).filter((s) => s.nodeId === 'T-001').map((s) => s.sessionId);

  report.ac45 = {
    exitCode: meta('AC-45').exitCode,
    state: state.state,
    nodes: (state.nodes ?? []).map((n) => ({ nodeId: n.nodeId, roleId: n.roleId, round: n.round, state: n.state })),
    roundsPresent: [...new Set((state.nodes ?? []).map((n) => n.round))],
    noRound3: !(state.nodes ?? []).some((n) => n.round === 3),
    handoffs: (state.handoffs ?? []).map((h) => ({
      handoffId: h.handoffId, kind: h.edge?.kind, state: h.state, defects: (h.defects ?? []).length
    })),
    verdictReadFail: vFail.map((e) => ({ seq: e.seq, ts: e.ts, detail: e.detail })),
    verdictReadPass: vPass.map((e) => ({ seq: e.seq, ts: e.ts })),
    allDispatches: dispatches,
    t002Round1Dispatch: t002r1,
    t001Round2DispatchAfterBackflow: t001r2,
    seqAssertion: {
      failSeq: vFail[0]?.seq ?? null,
      t002Round1DispatchSeq: t002r1?.seq ?? null,
      t001Round2DispatchSeq: t001r2?.seq ?? null,
      rule: 'failSeq > T-002 第1轮 dispatch.seq 且 failSeq < T-001 第2轮 dispatch.seq',
      pass: seqOk
    },
    sessionsT001,
    sessionsT001Distinct: new Set(sessionsT001).size >= 2,
    statusHasT002Round2Pass: /^节点 T-002 测试 已完成 · 第 2 轮 · 耗时 \S+ · 判定 通过$/m.test(st45),
    statusHasUpgradeDash: /升级 —/.test(st45),
    finalOutputTail: out45.trim().split('\n').slice(-4),
    spawnToThreeLinesMs: meta('AC-45').timeouts.spawnToThreeLinesMs,
    spawnToTerminalMs: meta('AC-45').timeouts.spawnToTerminalMs
  };
  write('AC-45.assertions.json', report.ac45);
}

// ---------- 2) NFR-01b / NFR-02 ----------
{
  const labels = ['AC-01', 'AC-03', 'AC-21', 'AC-22', 'AC-45'];
  const rows = labels.map((l) => {
    const ev = events(l);
    const s = ev.find((e) => e.reason === 'run.started');
    const f = ev.find((e) => e.reason === 'node.dispatch');
    return {
      label: l,
      runStartedTs: s?.ts ?? null,
      firstDispatchTs: f?.ts ?? null,
      firstDispatchNode: f?.objectId ?? null,
      deltaMs: (s && f) ? ms(f) - ms(s) : null,
      seqStart: s?.seq ?? null,
      seqFirst: f?.seq ?? null
    };
  });
  const evSmoke = events('SMOKE', SMOKE);
  const sS = evSmoke.find((e) => e.reason === 'run.started');
  const sF = evSmoke.find((e) => e.reason === 'node.dispatch');
  const smokeRow = {
    label: 'SMOKE',
    runStartedTs: sS?.ts ?? null,
    firstDispatchTs: sF?.ts ?? null,
    firstDispatchNode: sF?.objectId ?? null,
    deltaMs: (sS && sF) ? ms(sF) - ms(sS) : null,
    seqStart: sS?.seq ?? null,
    seqFirst: sF?.seq ?? null
  };
  const all = [smokeRow, ...rows];
  const maxDelta = Math.max(...all.map((r) => r.deltaMs ?? 0));

  write('NFR-01b-real.json', {
    definition: '§3.2 NFR-01b：读 events.jsonl 里 reason=run.started 与首个 node.dispatch 的 ts 差，10 次取最大，冷热分开记（热 5s / 冷 30s，冷启动=DSH 未拉起）',
    caveat: '本次真实面每条采集前均执行过 orch core stop（DSH 子进程关闭），故 6 个样本全部是「冷启动」口径。需求写「10 次取最大」，本次实测 6 次（5 条 AC + 冒烟）；真实闭环单条 49–326s，为控制平台限流未凑满 10 次，如实标注，未伪造补齐。热启动（DSH 已拉起后的首次派发）因每条 AC 用独立项目根、必须重新拉起 DSH，本次未单独隔离构造，不给数字。',
    rows: all,
    sampleCount: all.length,
    maxDeltaMs: maxDelta,
    targetColdMs: 30000,
    passCold: maxDelta < 30000,
    userPerceivedColdStart: {
      metric: '采集器 spawn → 三行（敲下命令到看见实例运行中/会话已创建/任务已投递）',
      samples: labels.map((l) => ({
        label: l,
        spawnToThreeLinesMs: meta(l).timeouts.spawnToThreeLinesMs,
        spawnToTerminalMs: meta(l).timeouts.spawnToTerminalMs
      })),
      note: 'v15 的事件差口径不含 DSH 进程拉起；用户真正可感知的冷启动是 spawn→三行，一并给出，均以实测为准。'
    }
  });

  const ev45 = events('AC-45');
  const vFail = ev45.filter((e) => e.reason === 'verdict.read' && e.detail?.verdict === 'fail');
  const disps = ev45.filter((e) => e.reason === 'node.dispatch');
  const next = vFail.length ? disps.find((d) => d.seq > vFail[0].seq) : null;
  const delta = (vFail.length && next) ? ms(next) - ms(vFail[0]) : null;
  write('NFR-02-real.json', {
    definition: '§3.2 NFR-02：verdict.read 与紧随其后的 node.dispatch 的 ts 差（1 秒内）',
    source: 'AC-45 真实回流闭环（唯一产生 verdict.read(fail) 的真实面样本）',
    verdictReadTs: vFail[0]?.ts ?? null,
    verdictReadSeq: vFail[0]?.seq ?? null,
    nextDispatch: next ? { seq: next.seq, nodeId: next.objectId, round: next.detail?.round, ts: next.ts } : null,
    deltaMs: delta,
    targetMs: 1000,
    pass: delta !== null && delta <= 1000
  });
  report.nfr02DeltaMs = delta;
}

// ---------- 3) NFR-01a：10 次核心冷启动计时 ----------
{
  const rootA = path.join(B, 'proj-ac01');
  const samples = [];
  for (let i = 0; i < 10; i += 1) {
    const stop = orch(['core', 'stop'], rootA);
    const t0 = performance.now();
    const st = orch(['status'], rootA);
    const dt = performance.now() - t0;
    samples.push({ i: i + 1, ms: Math.round(dt * 100) / 100, coreStopExit: stop.code, statusExit: st.code });
  }
  const maxA = Math.max(...samples.map((s) => s.ms));
  write('NFR-01a-real.json', {
    definition: '§3.2 NFR-01a：orch core stop 后 time orch status > /dev/null，10 次取最大，5 秒内',
    note: '用 node bin/orch.js 代替 orch；spawnSync 墙钟计时，含核心冷启动拉起 + 列出实例。',
    samples,
    sampleCount: samples.length,
    maxMs: maxA,
    targetMs: 5000,
    pass: maxA < 5000
  });
  report.nfr01aMaxMs = maxA;
}

// ---------- 4) AC-22：I1.1 抽查补充验证 ----------
{
  const root22 = path.join(B, 'proj-ac22');
  const instDir = path.join(root22, '.orch', 'instances', 'INST-304');
  const statePath = path.join(instDir, 'state.json');
  const eventsPath = path.join(instDir, 'events.jsonl');

  // I1.1 AC-13：状态记录损坏时不静默清空
  const before = readText(statePath);
  write('AC-22.AC-13.state-before.json', before);
  const broken = '{"broken": ';
  fs.writeFileSync(statePath, broken, 'utf8');
  const r13 = orch(['status', '--instance', 'INST-304'], root22);
  write('AC-22.AC-13.status.txt', r13.out);
  const corruptPath = statePath + '.corrupt';
  const corruptText = readText(corruptPath);
  const res13 = {
    i11AC: 'AC-13 状态记录损坏时不静默清空',
    expected: '看到「状态不可读」并被告知备份文件；原文件仍在，没有被清空或覆盖',
    statusExit: r13.code,
    statusOutput: r13.out,
    hasStateUnreadable: /状态不可读/.test(r13.out),
    mentionsBackupName: /state\.json\.corrupt|备份/.test(r13.out),
    corruptBackupExists: fs.existsSync(corruptPath),
    corruptBackupContent: corruptText,
    corruptBackupHoldsBrokenOriginal: (corruptText ?? '').includes('broken'),
    stateJsonAfter: readText(statePath),
    judgment: /状态不可读/.test(r13.out) && fs.existsSync(corruptPath)
  };
  write('AC-22.AC-13.result.json', res13);
  report.ac13 = { pass: res13.judgment, hasStateUnreadable: res13.hasStateUnreadable, corruptBackupExists: res13.corruptBackupExists };
  // 恢复现场，避免影响后续
  fs.writeFileSync(statePath, before, 'utf8');

  // I1.1 AC-12：重启后能查，但不偷偷重跑
  const evBefore = readText(eventsPath);
  orch(['core', 'stop'], root22);
  const st12a = orch(['status', '--instance', 'INST-304'], root22);
  const st12b = orch(['status', '--instance', 'INST-304', '--events'], root22);
  const evAfter = readText(eventsPath);
  write('AC-22.AC-12.status.txt', st12a.out);
  write('AC-22.AC-12.status-events.txt', st12b.out);
  const firstLine = st12a.out.trim().split('\n')[0] ?? '';
  const res12 = {
    i11AC: 'AC-12 重启后能查，但不偷偷重跑',
    eventsBeforeLines: evBefore.trim().split('\n').length,
    eventsAfterLines: evAfter.trim().split('\n').length,
    eventsUnchanged: evBefore === evAfter,
    statusFirstLine: firstLine,
    instanceStillCompleted: /已完成/.test(firstLine),
    noNewDispatchAfterStop:
      (evAfter.match(/"reason":"node.dispatch"/g) ?? []).length ===
      (evBefore.match(/"reason":"node.dispatch"/g) ?? []).length,
    judgment: evBefore === evAfter && /已完成/.test(firstLine)
  };
  write('AC-22.AC-12.result.json', res12);
  report.ac12 = { pass: res12.judgment, eventsUnchanged: res12.eventsUnchanged };

  // I1.1 AC-07：重复发起同一实例的同一节点被拒（真实面并发复现）
  const TASK1 = '写一段 200 字的产品说明，保存到 out/intro2.md';
  const TASK2 = '写一段说明，保存到 out/intro3.md';
  const p1 = spawn(process.execPath,
    [ORCH, 'run', '--cwd', 'demo', '--instance', 'INST-306', '--task', TASK1],
    { cwd: root22, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let p1out = '';
  let p1err = '';
  p1.stdout.on('data', (b) => { p1out += b.toString('utf8'); });
  p1.stderr.on('data', (b) => { p1err += b.toString('utf8'); });
  await new Promise((r) => setTimeout(r, 3000)); // 等 P1 进入「执行中」
  const p2 = orch(['run', '--cwd', 'demo', '--instance', 'INST-306', '--task', TASK2], root22);
  const p1exit = await new Promise((r) => p1.on('close', (code, signal) => r({ code, signal })));
  write('AC-22.AC-07.p1.output.txt', p1out + p1err);
  write('AC-22.AC-07.p2.output.txt', p2.out);
  const res07 = {
    i11AC: 'AC-07 重复发起同一实例的同一节点被拒（NODE_BUSY）',
    expected: '该节点正在执行，本次未发起；且没有新建第二个会话',
    p1Exit: p1exit,
    p2Exit: p2.code,
    p2Output: p2.out,
    hasI11ExpectedText: p2.out.includes('该节点正在执行，本次未发起'),
    p1Tail: p1out.trim().split('\n').slice(-3),
    note: 'v15 的 AC-08 注明 D-4 重排了发起前检查顺序；本条以真实输出为准，与 I1.1 期望逐字对照，不改写断言。'
  };
  write('AC-22.AC-07.result.json', res07);
  report.ac07 = { pass: res07.hasI11ExpectedText, p2Output: p2.out.slice(0, 300), p2Exit: p2.code };

  // 收尾：清核心（两个用过的根）
  orch(['core', 'stop'], root22);
  orch(['core', 'stop'], rootA_owner());
}

function rootA_owner() {
  return path.join(B, 'proj-ac01');
}

console.log(JSON.stringify(report, null, 2));
