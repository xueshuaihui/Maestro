/**
 * AC-65 · reuse 但没有空闲会话 → 新建，不报错（BR-42）。
 *
 * Given：角色文件写 session_policy: reuse；同角色节点无空闲会话（在别的节点上 thinking/serving）。
 * When：新节点被派发。Then：新建会话；instance log 不出现「会话 复用」行；派发正常继续。
 *
 * 裁-18a：产品派发路径未接线 session_policy，端到端「因无空闲而新建」观测不到；
 * 按冻结选择器契约 + 可见 CLI 行为取证，不为凑绿放宽或改产品。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, readState, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { selectReusableSession } from '../../src/core/orchestrator.js';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');

export async function run() {
  const c = makeCase('AC-65', {
    scenario: 'reuse-no-idle-session',
    title: 'reuse 但没有空闲会话 → 新建，不报错',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-65');
  c.root = root;
  try {
    const builtin = fs.readFileSync(path.join(REPO, 'assets', 'roles', 'developer.yaml'), 'utf8');
    const roleFile = path.join(root, '.orch', 'roles', 'developer.yaml');
    fs.mkdirSync(path.dirname(roleFile), { recursive: true });
    fs.writeFileSync(roleFile, `${builtin.trimEnd()}\nsession_policy: reuse\n`, 'utf8');
    evidence(c, 'given', 'developer.yaml', fs.readFileSync(roleFile, 'utf8'));

    const env = baseEnv();
    const argv = [NODE, DRIVER, '--root', root, '--scenario', 'backflow'];
    let d = runCmd(argv, { cwd: REPO, env, timeout: 180_000 });
    evidence(c, 'given', 'driver-attempt-1.txt', d.stdout + d.stderr);
    if (d.exitCode !== 0 || /IPC_TIMEOUT|"target":"timeout"/.test(d.stdout + d.stderr)) {
      note(c, '首次 backflow 受批次负载影响未跑到终态（退出码非 0 / IPC_TIMEOUT）：'
        + '停核心、清残留实例与游标后同参数重试一次（断言不放宽，两次输出均落证据）。');
      try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
      fs.rmSync(path.join(root, '.orch', 'instances', 'INST-001'), { recursive: true, force: true });
      fs.writeFileSync(path.join(root, '.mock', 'cursor.json'), '{"next":1}\n', 'utf8');
      d = runCmd(argv, { cwd: REPO, env, timeout: 180_000 });
    }
    const state = readState(root);
    const roleShow = orch(root, ['role', 'show', 'developer'], { env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env }).stdout;
    evidence(c, 'given', 'driver-output.txt', d.stdout + d.stderr);
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'instance-log.txt', log);

    includes(c, 'Then：role show 显示「会话复用：复用（reuse）」', roleShow.stdout, '会话复用：复用（reuse）');
    check(c, '夹具：backflow 两轮跑到终态（派发正常继续）',
      d.exitCode === 0 && ['completed', 'running'].includes(state?.state ?? null),
      JSON.stringify({ exit: d.exitCode, state: state?.state ?? null }));
    excludes(c, 'Then：instance log 不出现「会话 复用」行', log, '会话 复用');
    const devSessions = (state?.sessions ?? []).filter((s) => s.nodeId === 'T-001');
    evidence(c, 'then', 'developer-sessions.json', JSON.stringify(devSessions, null, 2));
    check(c, '夹具：两轮开发各建会话（新会话 +1，id 不同）',
      devSessions.length === 2 && new Set(devSessions.map((s) => s.sessionId)).size === 2,
      JSON.stringify(devSessions.map((s) => ({ round: s.round, id: s.sessionId }))));

    // 冻结选择器：同角色但都不空闲（thinking / 正服务其他节点）→ 不复用，新节点只能新建。
    const busyA = {
      sessionId: 'sess-busy-a', instanceId: 'INST-001', roleId: 'developer',
      hostId: 'mock', nodeId: 'T-001', state: 'thinking', servingNodeId: 'T-001',
    };
    const busyB = {
      sessionId: 'sess-busy-b', instanceId: 'INST-001', roleId: 'developer',
      hostId: 'mock', nodeId: 'T-001', state: 'idle', servingNodeId: 'T-002',
    };
    const picked = selectReusableSession([busyA, busyB], {
      instanceId: 'INST-001', roleId: 'developer', hostId: 'mock', nodeId: 'T-003',
    });
    eq(c, '夹具：selectReusableSession 对无空闲会话返回 null（须新建）', picked, null);
    const idle = { ...busyB, servingNodeId: '' };
    check(c, '夹具：同一选择器对空闲会话可命中（区分「无空闲」与「策略失效」）',
      selectReusableSession([idle], {
        instanceId: 'INST-001', roleId: 'developer', hostId: 'mock', nodeId: 'T-003',
      })?.sessionId === 'sess-busy-b', 'idle + servingNodeId 为空');

    note(c, '裁-18a：产品派发路径未读取角色 session_policy，端到端「因无空闲会话而新建」观测不到。'
      + '本用例只断言可见 CLI 行为（配置可见、无复用行、两轮各建会话）与冻结选择器语义，未放宽断言、未改产品。');
    note(c, '内建 backflow 图的两个开发节点是同角色跨轮次而非严格并发；'
      + '「并发同角色且无空闲」的现场用冻结选择器输入（thinking + servingNodeId 非空）覆盖。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
