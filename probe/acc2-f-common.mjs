// I1.2 夹具面验收 —— 公用动作 / 断言辅助 / 证据与报告生成（只读产品，不改实现）。
import fs from 'node:fs';
import path from 'node:path';
import {
  NODE, ORCH, DRIVER, SEAM, TRANSITION, REPO, EVID, BASE, TASK,
  freshRoot, baseEnv, runCmd, orch, driver,
  readState, readEvents, instanceIds, sha256File, exists,
  startDriver, forceKillCore, makeCase, saveEvidence, summarize, sleep, out
} from './acc2-f-lib.mjs';

export {
  NODE, ORCH, DRIVER, SEAM, TRANSITION, REPO, EVID, BASE, TASK,
  freshRoot, baseEnv, runCmd, orch, driver,
  readState, readEvents, instanceIds, sha256File, exists,
  startDriver, forceKillCore, makeCase, saveEvidence, summarize, sleep, out
};

export const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-2', 'acceptance-fixture.md');
export const PARTS = path.join(REPO, 'probe', 'acc2-f-parts');
export const RESULTS = path.join(REPO, 'probe', 'acc2-f-results.jsonl');

export function ensureParts() { fs.mkdirSync(PARTS, { recursive: true }); }
export function text(res) { return `${res?.stdout ?? ''}${res?.stderr ?? ''}`; }
export function lines(t) { return String(t).split('\n'); }
export function grepCount(t, re) { return lines(t).filter((l) => re.test(l)).length; }

export function statusText(root, { instance = 'INST-001', events = false, env } = {}) {
  const args = ['status', '--instance', instance];
  if (events) args.push('--events');
  return orch(root, args, env ? { env } : {});
}
export function statusNoInstance(root, { events = false } = {}) {
  const args = ['status'];
  if (events) args.push('--events');
  return orch(root, args);
}
export function cancel(root, instance = 'INST-001') { return orch(root, ['cancel', '--instance', instance]); }
export function coreStop(root, env) { return orch(root, ['core', 'stop'], env ? { env } : {}); }
export function runSync(root, scenario, extra = [], opts = {}) { return driver(root, ['--scenario', scenario, ...extra], opts); }
export function prepareOnly(root, scenario) { return driver(root, ['--scenario', scenario, '--prepare-only']); }
export function startKeep(root, scenario, extra = [], env = baseEnv()) {
  return startDriver(root, ['--scenario', scenario, '--keep', ...extra], { env });
}
export function runProduct(root, { instance = null, host = null, template = 'code-loop', task = TASK, cwd = './demo-code-pass', env } = {}) {
  const args = ['run', '--cwd', cwd];
  if (instance) args.push('--instance', instance);
  if (template) args.push('--template', template);
  if (host) args.push('--host', host);
  args.push('--task', task);
  return orch(root, args, env ? { env } : {});
}
export function seam(root, { instance = 'INST-001', call, node = null }) {
  const args = ['--root', root, '--instance', instance, '--call', call];
  if (node) args.push('--node', node);
  return runCmd([NODE, SEAM, ...args], { cwd: REPO, label: `seam ${call}${node ? ' ' + node : ''}` });
}
export function attempt(root, { instance = 'INST-001', object = 'node', node = null, from, to }) {
  const args = ['--root', root, '--instance', instance, '--object', object, '--from', from, '--to', to];
  if (node) args.push('--node', node);
  return runCmd([NODE, TRANSITION, ...args], { cwd: REPO, label: `attempt-transition ${object} ${from}->${to}` });
}
export function purity(extra = []) {
  return runCmd([NODE, path.join(REPO, 'test', 'fixtures', 'purity-check.mjs'),
    '--dirs', 'src/core,src/daemon', '--forbid', 'code-loop,developer,tester,coordinator', ...extra],
  { cwd: REPO, label: 'purity-check' });
}
export function nodeTest(file) {
  return runCmd([NODE, '--test', file], { cwd: REPO, label: `node --test ${file}` });
}

/** 把「长驻 --keep 的 driver 命令」记进 c.commands（startDriver 是 spawn，无 runCmd 结果）。 */
export function noteKeep(c, root, scenario, extra = [], envKeys = []) {
  c.commands.push({
    label: `driver --scenario ${scenario} --keep ${extra.join(' ')}（长驻，startDriver 管理）`,
    argv: [NODE, DRIVER, '--root', root, '--scenario', scenario, '--keep', ...extra],
    cwd: REPO, exitCode: null, durationMs: 0,
    stdout: `(长驻进程，由 startDriver 管理；env 关键键：${envKeys.join(', ') || '无'})`, stderr: ''
  });
}
/** 记录夹具手工动作（拷贝文件、写标记等），保持「命令」清单完整。 */
export function noteFixture(c, label, detail) {
  c.commands.push({ label: `夹具：${label}`, argv: [`(fixture) ${label}`], cwd: REPO, exitCode: 0, durationMs: 0, stdout: String(detail), stderr: '' });
}

export function nodeOf(s, id) { return (s?.nodes ?? []).find((n) => n.nodeId === id) ?? null; }
export function handoff(s, pred) { return (s?.handoffs ?? []).find(pred) ?? null; }
export function backflowPkg(s) { return handoff(s, (h) => h.edge?.kind === 'backflow'); }
export function esc(s) { return (s?.escalations ?? [])[0] ?? null; }
export function seqsOf(t) { return [...String(t).matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1])); }

function pick(o, keys) {
  const r = {};
  for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k];
  return r;
}
export function slimState(s) {
  if (!s) return null;
  return {
    instanceId: s.instanceId, state: s.state, template: s.template, halted: s.halted, rev: s.rev,
    counters: s.counters,
    nodes: (s.nodes ?? []).map((n) => pick(n, ['nodeId', 'roleId', 'round', 'state', 'note', 'verdict', 'failure'])),
    sessions: (s.sessions ?? []).map((x) => pick(x, ['sessionId', 'nodeId', 'round', 'state', 'hostId'])),
    handoffs: (s.handoffs ?? []).map((h) => pick(h, ['handoffId', 'edge', 'state', 'createdAt', 'deliveredAt', 'acceptedAt', 'consumedAt', 'rejectedAt', 'rejectReason', 'wakeConsumedAt', 'defects'])),
    escalations: (s.escalations ?? []).map((e) => pick(e, ['escalationId', 'nodeId', 'round', 'reasonCode', 'reasonDetail', 'state', 'defects'])),
  };
}
const EVENT_NEEDLES = ['node.dispatch', 'escalation.created', 'escalation.voided', 'verdict.read',
  'backflow.constructed', 'wake.rejected', 'handoff.rejected', 'illegal_transition', 'core.gone',
  'run.started', 'run.halted', 'rounds.exceeded', 'handoff.consumed', 'verification.passed',
  'verification.failed', 'core.suspend', 'output.submitted'];
export function slimEvents(events) {
  const all = events.map((e) => JSON.stringify(e));
  const hit = all.filter((l) => EVENT_NEEDLES.some((n) => l.includes(n)));
  const tail = all.slice(-5);
  return [...new Set([...hit, ...tail])];
}

/** 单条 AC：落 evidence → 写 parts/AC-xx.md → append results.jsonl → 返回 markdown。 */
export function recordCase(c, { title, face = '夹具', narrativeId, envKeys = [], cmdNote = '', extra = '' } = {}) {
  const sum = summarize(c);
  const verdict = sum.pass ? '通过' : '不通过';
  saveEvidence(c, { verdict, title, face, narrativeId });
  ensureParts();

  const rootsToScan = c.roots.length ? c.roots : [];
  const stateBlocks = [];
  const eventBlocks = [];
  for (const root of rootsToScan) {
    for (const id of instanceIds(root)) {
      const s = readState(root, id);
      if (s) stateBlocks.push({ __root: path.basename(root), instanceId: id, state: slimState(s) });
      const evs = readEvents(root, id);
      if (evs.length) eventBlocks.push({ __root: path.basename(root), instanceId: id, events: evs });
    }
  }

  const cmdLines = c.commands.map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') || String(a).includes('\n') ? JSON.stringify(a) : a)).join(' ');
    return `${cmd.label ? '[' + cmd.label + '] ' : ''}${argv}   | cwd=${cmd.cwd} | exit=${cmd.exitCode} | ${cmd.durationMs}ms`;
  });

  const KEY = /实例 |节点 T-|会话 |交接包 HO-|升级 ESC-|原因|缺陷|判定|核对失败|已挂起|已取消|已中断|无需取消|已升级|等待下游|待校验|非法迁移|零命中|OK:|FAIL:|NODE_BUSY|wake.rejected|ILLEGAL_TRANSITION|"ok"|"code"|"reused"|history|pass|fail|扫描|命中|tests|# pass/;
  const keyLines = [];
  for (const cmd of c.commands) {
    const ls = lines(`${cmd.stdout ?? ''}${cmd.stderr ?? ''}`).filter((l) => KEY.test(l));
    keyLines.push(...ls.slice(0, 50));
  }
  const keyText = keyLines.slice(0, 110).join('\n');

  const asserts = c.assertions.map((a) =>
    `- ${a.ok ? '✅' : '❌'} ${a.text}${a.ok ? '' : `\n    - 实际：\`${String(a.actual ?? '').slice(0, 500)}\``}`).join('\n');
  const failed = c.assertions.filter((a) => !a.ok);
  const failCompare = failed.length === 0 ? '' : '\n**实际 vs 期望（逐字）**：\n' + failed.map((a) =>
    `- ${a.text}\n  - 实际：\`${String(a.actual ?? '').slice(0, 700)}\``).join('\n');

  const stateJson = stateBlocks.length
    ? '```json\n' + JSON.stringify(stateBlocks.length === 1 ? stateBlocks[0].state : stateBlocks, null, 2) + '\n```'
    : '（无 state.json）';
  const evLines = eventBlocks.flatMap((b) => slimEvents(b.events).map((l) => `${b.__root}/${b.instanceId} ${l}`)).slice(0, 70);
  const evJson = evLines.length ? '```\n' + evLines.join('\n') + '\n```' : '（无 events.jsonl）';

  const md = [
    `#### ${c.ac} ${title}`, '',
    `- 项目根：${rootsToScan.map((r) => '`' + r + '`').join('、') || '（无）'}（叙事实例号 \`${narrativeId ?? '-'}\`；实际 \`state.json\` 为 \`INST-001\`，由产品自动分配）`,
    `- 验证面：${face}${envKeys.length ? ' ｜ 关键 env：' + envKeys.map((k) => '`' + k + '`').join('、') : ''}${cmdNote ? ' ｜ ' + cmdNote : ''}`, '',
    '**① 完整命令 + 夹具场景/开关**', '', '```', ...cmdLines, '```', '',
    `> 每条命令 stdout+stderr 全文见 \`evidence/${c.ac}.output.json\`；下表为关键行摘录。`, '',
    '**② 原始输出（关键行）**', '', '```', keyText || '（无输出）', '```', '',
    '**③ 状态证据**', '',
    `state.json 相关字段（JSON 原文；完整见 \`evidence/${c.ac}.state.json\`）：`, '', stateJson, '',
    `events.jsonl 相关行（JSON 原文；完整见 \`evidence/${c.ac}.events.jsonl\`）：`, '', evJson, '',
    `**④ 判定**：${verdict}（断言 ${c.assertions.filter((a) => a.ok).length}/${c.assertions.length} 通过）`, '',
    asserts, failCompare, extra ? '\n' + extra : '', '', '---', ''
  ].join('\n');

  fs.writeFileSync(path.join(PARTS, `${c.ac}.md`), md, 'utf8');
  fs.appendFileSync(RESULTS, JSON.stringify({
    ac: c.ac, title, face, narrativeId, verdict, pass: sum.pass,
    total: c.assertions.length, ok: c.assertions.filter((a) => a.ok).length,
    failed: failed.map((a) => ({ text: a.text, actual: a.actual })),
    roots: rootsToScan
  }) + '\n', 'utf8');
  return { md, verdict, sum };
}

export function appendBatch(sectionTitle, mds, extra = '') {
  fs.appendFileSync(REPORT, `\n### 1.${sectionTitle}\n\n` + mds.join('\n') + (extra ? '\n' + extra : ''), 'utf8');
}
export function initReport() {
  fs.writeFileSync(REPORT, [
    '# I1.2 验收记录（夹具面）', '',
    '> 依据：`docs/iterations/iteration-2/requirement.md` **v15** §3.1（AC-01~46，AC-17/AC-30 作废）、§3.2 NFR、§3.3 前置条件、附录 A（输出基线）/ D（文案与错误码逐字表）。',
    '> 执行：Windows / Git Bash / Node ' + process.version + '；项目根一律 `%TEMP%/maestro-acc-f2/proj/<case>/`；**mock 宿主**（`--host mock`），无真实模型凭据、不设 `DSH_HOME`。',
    '> 本文件由 `probe/acc2-f-*.mjs` 分 4 批生成；每批结束即落 `evidence/AC-xx.*` 与本文件分节中间结论，最后由 `probe/acc2-f-final.mjs` 补 §0/§2/§3/§4。',
    '', '## 0. 总判', '', '（第 4 批完成后由 `probe/acc2-f-final.mjs` 补写）', '',
    '## 1. AC 逐条记录（命令 / 原始输出 / 状态证据 / 判定）', ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(RESULTS, '', 'utf8');
  ensureParts();
}
