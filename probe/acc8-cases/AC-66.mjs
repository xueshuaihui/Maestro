/**
 * AC-66 · reuse 不跨宿主、不复用正在服务其他节点的会话（BR-43）。
 *
 * 机检用产品冻结的选择器 selectReusableSession（session-reuse.test.js 同款口径）：
 * - 跨宿主不复用；正在服务其他节点（servingNodeId 非空且非本节点）不复用；
 * - 仅 servingNodeId 为空/同节点且 state=idle 才选中，且 hostId 与新会话宿主一致；
 * - 非 idle / 跨角色一律不选。
 * 可见 CLI：两个角色均写 session_policy: reuse；真跑一遍后复用行次数为 0
 * （裁-18a 派发未接线，不能把「无复用行」当成跨宿主边界已被端到端验证）。
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
  const c = makeCase('AC-66', {
    scenario: 'reuse-host-and-serving-boundary',
    title: 'reuse 不跨宿主、不复用正在服务其他节点的会话',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-66');
  c.root = root;
  try {
    for (const id of ['developer', 'tester']) {
      const builtin = fs.readFileSync(path.join(REPO, 'assets', 'roles', `${id}.yaml`), 'utf8');
      const file = path.join(root, '.orch', 'roles', `${id}.yaml`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${builtin.trimEnd()}\nsession_policy: reuse\n`, 'utf8');
    }
    const roleDev = orch(root, ['role', 'show', 'developer']);
    const roleTest = orch(root, ['role', 'show', 'tester']);
    evidence(c, 'given', 'role-show.txt', `${roleDev.stdout}\n${roleTest.stdout}`);
    includes(c, 'Given：developer 显示 reuse 配置', roleDev.stdout, '会话复用：复用（reuse）');
    includes(c, 'Given：tester 显示 reuse 配置', roleTest.stdout, '会话复用：复用（reuse）');

    const env = baseEnv();
    const d = runCmd([NODE, DRIVER, '--root', root, '--scenario', 'backflow'], {
      cwd: REPO, env, timeout: 180_000,
    });
    const state = readState(root);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env }).stdout;
    evidence(c, 'then', 'driver-output.txt', d.stdout + d.stderr);
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'instance-log.txt', log);
    excludes(c, 'Then：复用行里不出现跨宿主角色（本机复用行 0 条）', log, '会话 复用');

    const options = { instanceId: 'INST-001', roleId: 'developer', nodeId: 'T-003' };
    const crossHost = {
      sessionId: 'sess-003', instanceId: 'INST-001', roleId: 'developer',
      hostId: 'cursor', state: 'idle', servingNodeId: '',
    };
    const busyOther = { ...crossHost, hostId: 'dsh', servingNodeId: 'T-002' };
    const freeSame = { ...crossHost, hostId: 'dsh', servingNodeId: '' };
    const sameNode = { ...freeSame, servingNodeId: 'T-003' };
    const picked = selectReusableSession([crossHost, busyOther, freeSame], { ...options, hostId: 'dsh' });
    const pickedSameHost = selectReusableSession([crossHost], { ...options, hostId: 'cursor' });
    evidence(c, 'then', 'selector-inputs.json', JSON.stringify({
      crossHost, busyOther, freeSame, sameNode, options,
    }, null, 2));
    evidence(c, 'then', 'selector-outputs.json', JSON.stringify({
      picked: picked ?? null, pickedSameHost: pickedSameHost ?? null,
    }, null, 2));

    eq(c, '机检：跨宿主会话不被选中', selectReusableSession([crossHost], { ...options, hostId: 'dsh' }), null);
    check(c, '机检：同宿主时跨宿主候选可命中（选择器确实按 hostId 过滤）',
      pickedSameHost?.sessionId === 'sess-003', JSON.stringify(pickedSameHost ?? null));
    eq(c, '机检：正在服务其他节点（T-002）的会话不被选中',
      selectReusableSession([busyOther], { ...options, hostId: 'dsh' }), null);
    check(c, '机检：仅 servingNodeId 为空的空闲会话被选中',
      picked?.sessionId === 'sess-003', JSON.stringify(picked ?? null));
    eq(c, '机检：被复用会话 hostId 与新会话宿主一致', picked?.hostId ?? null, 'dsh');
    check(c, '机检：servingNodeId 为本节点也可复用',
      selectReusableSession([sameNode], { ...options, hostId: 'dsh' })?.sessionId === 'sess-003',
      JSON.stringify(sameNode));
    eq(c, '机检：非 idle 会话不复用',
      selectReusableSession([{ ...freeSame, state: 'thinking' }], { ...options, hostId: 'dsh' }), null);
    eq(c, '机检：跨角色会话不复用',
      selectReusableSession([{ ...freeSame, roleId: 'tester' }], { ...options, hostId: 'dsh' }), null);

    note(c, '裁-18a：产品派发路径未接线 session_policy，可见复用行恒为 0；'
      + '本用例按需求机检以冻结选择器取证跨宿主/服务节点边界，不把恒 0 的复用行当作端到端通过。');
    note(c, '两种宿主用选择器的 hostId 入参模拟（dsh / cursor）：真机同时拉起两种宿主超出本机 mock 面，'
      + '与 test/wp13/session-reuse.test.js 的 AC-66 口径一致。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
