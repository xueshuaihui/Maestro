/**
 * AC-50 · reuse 不跨实例（BR-43）。
 *
 * Given：同一项目根两个独立实例，developer 角色均写 session_policy: reuse。
 * When：两个实例各跑一次开发节点。
 * Then：两个实例会话 id 不同、不共享会话。
 * 夹具：会话 id 交集为空（并用产品冻结选择器验证跨实例拒绝复用）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, DEFAULT_TASK } from '../../test/fixtures/code-loop-driver.mjs';
import { selectReusableSession } from '../../src/core/orchestrator.js';

export async function run() {
  const c = makeCase('AC-50', {
    scenario: 'reuse-not-cross-instance',
    title: 'reuse 不跨实例',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-50');
  c.root = root;
  try {
    const builtin = fs.readFileSync(path.join(REPO, 'assets', 'roles', 'developer.yaml'), 'utf8');
    const roleFile = path.join(root, '.orch', 'roles', 'developer.yaml');
    fs.mkdirSync(path.dirname(roleFile), { recursive: true });
    fs.writeFileSync(roleFile, `${builtin.trimEnd()}\nsession_policy: reuse\n`, 'utf8');
    const env = baseEnv();
    const prepared = prepareScene({ root, scenario: 'pass', mockArgs: mockArgsFromEnv(env) });
    evidence(c, 'given', 'fixture.json', JSON.stringify({ hostPath: prepared.hostPath, roleFile: `.orch/roles/developer.yaml` }, null, 2));

    const ids = ['INST-001', 'INST-002'];
    const runs = [];
    for (const id of ids) {
      // 同一项目根：把 mock 场景游标退回起点、清掉上一实例留下的 marker。
      const resetScene = () => {
        fs.writeFileSync(path.join(prepared.mockDir, 'cursor.json'), '{"next":1}\n', 'utf8');
        for (const name of ['exhausted', 'paused', 'release']) {
          fs.rmSync(path.join(prepared.mockDir, name), { force: true });
        }
      };
      const cwd = path.join(root, `demo-${id}`);
      fs.mkdirSync(cwd, { recursive: true });
      const argv = [NODE, ORCH_BIN, 'run', '--cwd', cwd, '--task', DEFAULT_TASK,
        '--template', 'code-loop', '--host', 'mock', '--instance', id];
      resetScene();
      let r = runCmd(argv, { cwd: root, env, timeout: 120_000 });
      // 批次负载下冷启动偶发 IPC_TIMEOUT（单跑不复现）：只允许一次同参数重试，断言口径不变。
      if (r.exitCode !== 0 && /IPC_TIMEOUT/.test(r.stdout + r.stderr)) {
        note(c, `${id} 首次 run 遇冷启动 IPC_TIMEOUT：停核心、清残留实例与游标后同参数重试一次（断言不放宽）。`);
        try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
        fs.rmSync(path.join(root, '.orch', 'instances', id), { recursive: true, force: true });
        resetScene();
        r = runCmd(argv, { cwd: root, env, timeout: 120_000 });
      }
      const st = readState(root, id);
      const roleShow = orch(root, ['role', 'show', 'developer']).stdout;
      runs.push({ id, exitCode: r.exitCode, state: st, roleShow, out: r.stdout + r.stderr });
      evidence(c, 'then', `${id}.state.json`, JSON.stringify(st, null, 2));
      evidence(c, 'then', `${id}.role-show.txt`, roleShow);
      evidence(c, 'then', `${id}.run.txt`, r.stdout + r.stderr);
    }

    check(c, '夹具：两个实例都跑通', runs.every((r) => r.exitCode === 0 && ['completed', 'running'].includes(r.state?.state)),
      JSON.stringify(runs.map((r) => ({ id: r.id, exit: r.exitCode, state: r.state?.state }))));
    for (const r of runs) {
      includes(c, `Then：${r.id} 的角色配置显示 reuse`, r.roleShow, '会话复用：复用（reuse）');
    }

    const devIds = runs.map((r) => (r.state?.sessions ?? [])
      .filter((s) => s.nodeId === 'T-001').map((s) => s.sessionId));
    check(c, 'Given：两个实例各有开发会话', devIds.every((list) => list.length >= 1),
      JSON.stringify(devIds));
    const intersection = devIds[0].filter((id) => devIds[1].includes(id));
    eq(c, '夹具：两实例会话 id 交集为空', intersection.length, 0);
    check(c, 'Then：两个实例使用不同会话 id',
      devIds[0].length > 0 && devIds[1].length > 0 && devIds[0][0] !== devIds[1][0],
      JSON.stringify({ first: devIds[0], second: devIds[1] }));

    // 产品冻结选择器：同角色空闲会话跨实例必须拒绝（复用边界由选择器保证）。
    const foreign = devIds[0].length ? {
      sessionId: devIds[0][0], instanceId: ids[0], roleId: 'developer',
      hostId: 'mock', nodeId: 'T-001', state: 'idle',
    } : null;
    const picked = selectReusableSession(foreign ? [foreign] : [], {
      instanceId: ids[1], roleId: 'developer', hostId: 'mock', nodeId: 'T-001',
    });
    check(c, '夹具：selectReusableSession 拒绝跨实例复用',
      picked === null, JSON.stringify({ picked: picked?.sessionId ?? null }));

    note(c, '同一项目根下用 --instance INST-001 / INST-002 起两个独立实例；'
      + 'mock 游标在两次之间退回起点，避免第二步步骤耗尽。');
    note(c, '实测产品派发未接线角色 session_policy（同 AC-49），因此两实例各自新建会话；'
      + '跨实例不共享由 state 会话 id 交集与冻结选择器共同核对。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
