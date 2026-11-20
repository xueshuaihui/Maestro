/**
 * AC-48 · fresh 默认：每任务新会话（BR-41 / BR-42）。
 *
 * Given：developer 使用默认策略（不写 session_policy），code-loop backflow 跑到两轮开发。
 * When：第一轮开发完成、测试回流到开发第二轮。
 * Then：第二轮开发用新会话 id；role show developer 不出现「会话复用」行；既有输出逐字不变。
 * 夹具：两轮开发会话 id 不同；role show 与 I1.6 基线逐字节相同。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, readState, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
const I16_DEVELOPER_SHOW = [
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '  职责：按任务修改代码，交出声明的产物文件',
  '  技能：code-change, test-run',
  '  工具：read, write, edit, bash',
  '  可唤醒：tester',
  '  来源：内置 assets/roles/developer.yaml',
].join('\n');

export async function run() {
  const c = makeCase('AC-48', {
    scenario: 'code-loop-fresh-default',
    title: 'fresh 默认：每任务新会话',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-48');
  c.root = root;
  try {
    const env = baseEnv();
    const argv = [NODE, DRIVER, '--root', root, '--scenario', 'backflow'];
    let d = runCmd(argv, { cwd: REPO, env, timeout: 180_000 });
    // 批次负载下冷启动偶发 IPC_TIMEOUT：只允许一次同参数重试，断言口径不变。
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
    const devSessions = (state?.sessions ?? []).filter((s) => s.nodeId === 'T-001');
    check(c, 'Given：开发节点有两轮会话（round 1 / round 2）',
      devSessions.length >= 2 && devSessions.some((s) => s.round === 1) && devSessions.some((s) => s.round === 2),
      JSON.stringify(devSessions.map((s) => ({ id: s.sessionId, round: s.round }))));
    const first = devSessions.find((s) => s.round === 1);
    const second = devSessions.find((s) => s.round === 2);
    check(c, 'Then：开发第二轮使用新的会话 id', Boolean(first && second) && first.sessionId !== second.sessionId,
      JSON.stringify({ round1: first?.sessionId, round2: second?.sessionId }));
    eq(c, '夹具：开发节点最终 round=2', (state?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.round, 2);
    eq(c, '夹具：两轮开发各一次 session/new（共 2）', devSessions.length, 2);

    excludes(c, 'Then：role show developer 不出现「会话复用」行', roleShow.stdout, '会话复用');
    excludes(c, 'Then：instance log 不出现复用行', log, '会话 复用');
    eq(c, '夹具：role show developer 与 I1.6 基线逐字节相同',
      roleShow.stdout.replace(/\s+$/, ''), I16_DEVELOPER_SHOW);
    check(c, 'Then：既有输出行数不变（6 行）',
      roleShow.stdout.trimEnd().split(/\r?\n/).length === 6,
      JSON.stringify(roleShow.stdout.trimEnd().split(/\r?\n/).length));

    note(c, '默认 fresh 不写进角色文件、不注入渲染对象；role show 六行逐字沿用 I1.6 基线。');
    note(c, '两轮开发会话 id 取自产品落盘 state.sessions（nodeId=T-001，round=1/2），非 mock 日志文件。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
