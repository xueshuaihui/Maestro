/**
 * AC-42 · 会话进程崩溃：重建并重试当前轮（BR-36 / BR-37）。
 *
 * Given/When：recovery-driver --scenario crash-rebuild（MAESTRO_MOCK_CRASH=after_first_update）。
 * Then：先「会话进程已退出：正在重建会话」，再「会话已重建 <新会话>」；节点继续、轮次不变。
 * 夹具：断言新会话 id 与旧不同、round 与崩溃前一致、当前轮 session/prompt 2 次
 * （v4：文案节点号/轮次/上限按实测 detail 动态填充，不再写死 T-003/2/3）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, readState, readEvents, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { SESSION_FAILURE_TEXT, fill } from '../../src/cli/labels.js';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'recovery-driver.mjs');

/** 同族用例（AC-43/44/47）复用的真机驱动：不经 shell，落盘后读产品事件与日志。 */
export function driveRecoveryScenario(root, scenario, extraEnv = {}) {
  const env = baseEnv(extraEnv);
  const r = runCmd([NODE, DRIVER, '--root', root, '--scenario', scenario], {
    cwd: REPO, env, timeout: 180_000,
  });
  let summary = null;
  try { summary = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { /* 证据仍落盘 */ }
  const instanceId = summary?.instanceId ?? 'INST-001';
  return {
    r, summary, env, instanceId,
    events: readEvents(root, instanceId),
    state: readState(root, instanceId),
    log: orch(root, ['instance', 'log', '--instance', instanceId]).stdout,
    status: orch(root, ['status', '--instance', instanceId]).stdout,
  };
}

export function promptsOf(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export async function run() {
  const c = makeCase('AC-42', {
    scenario: 'crash-rebuild',
    title: '会话进程崩溃：重建并重试当前轮',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-42');
  c.root = root;
  const promptLog = path.join(root, 'prompt-log.ndjson');
  try {
    const d = driveRecoveryScenario(root, 'crash-rebuild', { MAESTRO_MOCK_PROMPT_LOG: promptLog });
    const prompts = promptsOf(promptLog);
    evidence(c, 'given', 'driver-summary.json', JSON.stringify({
      ok: d.summary?.ok, scenario: d.summary?.scenario, exitCodes: d.summary?.exitCodes,
      runMs: d.summary?.runMs, graphScenario: d.summary?.graphScenario,
    }, null, 2));
    evidence(c, 'given', 'run-output.txt', d.r.stderr);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.state, null, 2));
    evidence(c, 'then', 'instance-log.txt', d.log);
    evidence(c, 'then', 'status.txt', d.status);
    evidence(c, 'then', 'prompt-log.ndjson', prompts.map((p) => JSON.stringify(p)).join('\n'));

    check(c, '夹具：crash-rebuild 场景跑通', d.summary?.ok === true,
      JSON.stringify({ ok: d.summary?.ok, exitCodes: d.summary?.exitCodes }));

    const crashEvents = d.events.filter((e) => e.reason === 'session.crash');
    const rebuiltEvents = d.events.filter((e) => e.reason === 'session.rebuilt');
    eq(c, '夹具：session.crash 事件 1 条', crashEvents.length, 1);
    eq(c, '夹具：session.rebuilt 事件 1 条', rebuiltEvents.length, 1);

    const crashLine = fill(SESSION_FAILURE_TEXT.crash, crashEvents[0]?.detail ?? {});
    const rebuiltLine = fill(SESSION_FAILURE_TEXT.rebuilt, rebuiltEvents[0]?.detail ?? {});
    includes(c, 'Then：先出现「会话进程已退出：正在重建会话」', d.log, crashLine);
    includes(c, 'Then：再出现「会话已重建 <新会话 id>」', d.log, rebuiltLine);
    check(c, 'Then：崩溃行在重建行之前',
      d.log.indexOf(crashLine) >= 0 && d.log.indexOf(crashLine) < d.log.indexOf(rebuiltLine),
      JSON.stringify({ crashAt: d.log.indexOf(crashLine), rebuiltAt: d.log.indexOf(rebuiltLine) }));

    const oldId = (d.state?.sessions ?? [])[0]?.sessionId ?? null;
    const newId = rebuiltEvents[0]?.detail?.sessionId ?? null;
    check(c, '夹具：新会话 id 与旧会话不同', Boolean(newId) && newId !== oldId,
      JSON.stringify({ oldId, newId }));
    eq(c, '夹具：crash 与 rebuilt 的轮次相同（当前轮不变）',
      rebuiltEvents[0]?.detail?.round, crashEvents[0]?.detail?.round);

    const round = crashEvents[0]?.detail?.round;
    // mock 的 prompt-log 从提示词推断 nodeId，提示词不含「第 N 轮」，故 round 为 null；
    // 当前轮的两次 prompt 以崩溃节点归属核对（崩溃前原始 1 次 + 重建后重试 1 次）。
    const retryPrompts = prompts.filter((p) => p.nodeId === crashEvents[0]?.detail?.nodeId);
    eq(c, '夹具：当前轮 session/prompt 2 次（原始 + 重试，按崩溃节点归属）', retryPrompts.length, 2);
    check(c, '夹具：两次 prompt 分属旧/新会话 id',
      new Set(retryPrompts.map((p) => p.sessionId)).size === 2,
      JSON.stringify(retryPrompts.map((p) => p.sessionId)));

    // v4：round 与崩溃前一致（BR-37 明写「轮次不增加」，不写「或更大」）。
    eq(c, '夹具：round 与崩溃前一致（BR-37 轮次不增加，不写「或更大」）',
      rebuiltEvents[0]?.detail?.round, crashEvents[0]?.detail?.round);
    // v4：文案按实测 detail（nodeId/round/maxRounds）动态填充，不再写死 T-003/2/3。
    const crashDetail = crashEvents[0]?.detail ?? {};
    const crashParen = `（节点 ${crashDetail.nodeId} · 轮次 ${crashDetail.round}/${crashDetail.maxRounds}）`;
    includes(c, 'Then：文案按实测 detail 填充「（节点 <当前节点> · 轮次 <当前轮>/<上限>）」',
      d.log, crashParen);
    const node = (d.state?.nodes ?? []).find((n) => n.nodeId === crashEvents[0]?.detail?.nodeId);
    check(c, 'Then：节点继续执行且轮次未变', ['done', 'review', 'running'].includes(node?.state)
      && node?.round === round, JSON.stringify(node));
    // driver 末尾 core.stop 会把实例标成「已中断」；判定取 stop 前的 afterRecovery 快照。
    check(c, 'Then：实例仍在推进（未挂起/未失败，取 core.stop 前快照）',
      ['running', 'completed'].includes(d.summary?.afterRecovery?.state),
      JSON.stringify({ beforeStop: d.summary?.afterRecovery?.state, afterStop: d.state?.state }));
    excludes(c, 'Then：崩溃场景不出现运行慢提示', d.log, '判定为运行慢');

    note(c, 'v4 改法（裁-21a / 裁-21d②）：round 断言改为「与崩溃前一致」（BR-37 轮次不增加，不写「或更大」），'
      + `实测崩溃/重建明细为 ${JSON.stringify(crashDetail)}；文案里的节点号/轮次/上限按该明细动态填充，`
      + '不再写死 T-003/2/3。崩溃重建、新会话 id 不同、当前轮 prompt 2 次等 Then 实质不变。');
    note(c, '会话号形态：需求示例 sess-003 是真实 DSH 形态，mock 为 mock-sess-<pid>-<seq>；'
      + '本用例不断言具体编号，只断言新旧不同与事件明细一致。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
