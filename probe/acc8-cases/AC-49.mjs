/**
 * AC-49 · reuse：同一角色第二轮复用空闲会话（BR-42 / 裁-11c）。
 *
 * Given：项目根 .orch/roles/developer.yaml 覆盖内置资产且写 session_policy: reuse。
 * When：第一轮开发完成、测试回流到开发第二轮。
 * Then：第二轮复用第一轮会话 id；instance log 出现「会话 复用 sess-003（角色 developer）」。
 * 夹具：两轮开发会话 id 相同、session/new 只 1 次。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, readState, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { selectReusableSession } from '../../src/core/orchestrator.js';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
const REUSE_LINE = '会话复用：复用（reuse）';

export async function run() {
  const c = makeCase('AC-49', {
    scenario: 'code-loop-role-reuse',
    title: 'reuse：同一角色第二轮复用空闲会话',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-49');
  c.root = root;
  try {
    // 项目角色覆盖内置资产：只多写一行 session_policy: reuse（D-13 的合法显式声明）。
    const builtin = fs.readFileSync(path.join(REPO, 'assets', 'roles', 'developer.yaml'), 'utf8');
    const roleFile = path.join(root, '.orch', 'roles', 'developer.yaml');
    fs.mkdirSync(path.dirname(roleFile), { recursive: true });
    fs.writeFileSync(roleFile, `${builtin.trimEnd()}\nsession_policy: reuse\n`, 'utf8');
    evidence(c, 'given', 'developer.yaml', fs.readFileSync(roleFile, 'utf8'));

    const env = baseEnv();
    const argv = [NODE, DRIVER, '--root', root, '--scenario', 'backflow'];
    let d = runCmd(argv, { cwd: REPO, env, timeout: 180_000 });
    // 批次负载下冷启动偶发 IPC_TIMEOUT（driver target=timeout，单跑不复现）：
    // 只允许一次同参数重试，断言口径不变；两次输出都写进证据。
    evidence(c, 'given', 'driver-attempt-1.txt', d.stdout + d.stderr);
    if (/IPC_TIMEOUT|"target":"timeout"/.test(d.stdout + d.stderr)) {
      note(c, '首次 backflow 遇冷启动 IPC_TIMEOUT：停核心、清残留实例与游标后同参数重试一次（断言不放宽）。');
      try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
      fs.rmSync(path.join(root, '.orch', 'instances', 'INST-001'), { recursive: true, force: true });
      fs.writeFileSync(path.join(root, '.mock', 'cursor.json'), '{"next":1}\n', 'utf8');
      d = runCmd(argv, { cwd: REPO, env, timeout: 180_000 });
    }
    const state = readState(root);
    const roleShow = orch(root, ['role', 'show', 'developer']);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']).stdout;
    evidence(c, 'given', 'driver-output.txt', d.stdout + d.stderr);
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'instance-log.txt', log);

    check(c, '夹具：backflow 两轮跑到完成', d.exitCode === 0 && state?.state === 'completed',
      JSON.stringify({ exit: d.exitCode, state: state?.state }));
    const lines = roleShow.stdout.trimEnd().split(/\r?\n/);
    const policyIdx = lines.findIndex((line) => line.includes(REUSE_LINE));
    const wakeIdx = lines.findIndex((line) => line.includes('可唤醒'));
    const sourceIdx = lines.findIndex((line) => line.includes('来源'));
    includes(c, 'Then：role show 显示「会话复用：复用（reuse）」', roleShow.stdout, REUSE_LINE);
    check(c, '机检：复用行在「可唤醒」之后、「来源」之前',
      wakeIdx >= 0 && policyIdx === wakeIdx + 1 && sourceIdx === policyIdx + 1,
      JSON.stringify({ wakeIdx, policyIdx, sourceIdx }));

    const devSessions = (state?.sessions ?? []).filter((s) => s.nodeId === 'T-001');
    const first = devSessions.find((s) => s.round === 1);
    const second = devSessions.find((s) => s.round === 2);
    check(c, 'Then：开发第二轮复用第一轮的会话 id', Boolean(first && second) && first.sessionId === second.sessionId,
      JSON.stringify({ round1: first?.sessionId, round2: second?.sessionId }));
    eq(c, '夹具：两轮开发只占 1 个会话（session/new 只 1 次）',
      new Set(devSessions.map((s) => s.sessionId)).size, 1);
    const expectedReuseLine = `会话 复用 ${first?.sessionId ?? ''}（角色 developer）`;
    includes(c, 'Then：instance log 出现需求示例的复用行（角色 id=developer，裁-11c）', log, expectedReuseLine);

    // 产品冻结的纯选择器：若有空闲会话，reuse 应当命中——区分「语义已定义」与「派发未接线」。
    const idleFirst = first ? {
      sessionId: first.sessionId, instanceId: 'INST-001', roleId: 'developer',
      hostId: first.hostId ?? 'mock', nodeId: 'T-001', state: 'idle',
    } : null;
    const picked = selectReusableSession(idleFirst ? [idleFirst] : [], {
      instanceId: 'INST-001', roleId: 'developer', hostId: idleFirst?.hostId ?? 'mock', nodeId: 'T-001',
    });
    check(c, '夹具：selectReusableSession 对空闲同角色会话返回复用（冻结语义存在）',
      picked?.sessionId === first?.sessionId, JSON.stringify({ picked: picked?.sessionId ?? null }));

    note(c, '裁-11c：需求示例「会话 复用 sess-003（角色 developer）」用角色 id；labels.js 的'
      + ' RECOVERY_TEXT.sessionReuse 模板占位名是 {角色中文名}。本用例按需求原文断言角色 id，'
      + '并用实测会话 id 代替示例 sess-003（mock 会话号为 mock-sess-<pid>-<seq>）。');
    note(c, '裁-20k：`state.sessions` 是「每次派发一条记录」，复用后同一 sessionId 会出现两条'
      + '（round 1 记录留作历史、round 2 记录是当前绑定）。因此「session/new 只 1 次」按需求原文'
      + '（两轮会话 id 相同）机检为**去重后的会话 id 数 = 1**，而不是记录条数 = 1；'
      + '上一条 Then 已单独断言 round 1 与 round 2 都存在且 id 相同，两者合起来比单看条数更严。'
      + 'mock 每次 `session/new` 都返回唯一会话号，故去重后为 1 等价于 new 只发生 1 次。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
