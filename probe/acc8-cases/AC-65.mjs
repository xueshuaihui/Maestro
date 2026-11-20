/**
 * AC-65 · reuse 但没有空闲会话 → 新建，不报错（BR-42 / D-13）。
 *
 * Given：角色文件写 `session_policy: reuse`；该角色**没有空闲会话**。
 * When：新节点被派发。Then：新建会话；不出现「会话 复用」行；派发正常继续。
 *
 * 现场为什么不是「一条 CLI 端到端」：
 * `advance()` 的图推进严格串行（一次只派发一个节点），单条 CLI 运行里同角色的
 * 两个节点不可能同时在飞，需求夹具写的「两个节点同角色并发」在当前编排模型不可达
 * （裁-20l）。因此 Given 由 **`test.dispatch` 接缝 + 预置 `state.json`** 构造：
 * 预置一个同角色但 `thinking` 的会话（没有空闲会话），再走真实 `dispatchInState`
 * 分支派发 T-001，断言「新建 + 0 条 `session.reuse`」。产品代码路径不变，只把宿主
 * 换成 mock。证据见 `test/wp13/session-reuse-dispatch.test.js` 的 AC-65 用例。
 *
 * 端到端部分只保留「策略开启后派发仍正常继续、配置可见」——它**不是**本条的 Given
 * （backflow 现场里第一轮结束后会话是空闲的，属 AC-49 的现场），旧断言
 * 「端到端不出现复用行」建立在「派发未接线」的缺陷现场上，接线后该断言已不适用。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  makeCase, eq, check, includes, evidence, note, finish,
} from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, readState, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { selectReusableSession } from '../../src/core/orchestrator.js';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
const REUSE_TEST = path.join(REPO, 'test', 'wp13', 'session-reuse-dispatch.test.js');

/** 跑一个测试文件并解析 TAP 的计数行。 */
function tapCounts(stdout) {
  const pick = (key) => {
    const hit = new RegExp(`^# ${key} (\\d+)$`, 'm').exec(stdout);
    return hit ? Number.parseInt(hit[1], 10) : null;
  };
  return { tests: pick('tests'), pass: pick('pass'), fail: pick('fail'), skipped: pick('skipped') };
}

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

    // ① Given + Then 的机检：预置「无空闲会话」现场，走真实派发分支。
    const unit = runCmd([NODE, '--test', REUSE_TEST], { cwd: REPO, env, timeout: 180_000 });
    evidence(c, 'then', 'reuse-dispatch-test.txt', unit.stdout + unit.stderr);
    const counts = tapCounts(unit.stdout);
    check(c, '机检：派发接线用例文件 exit 0', unit.exitCode === 0,
      JSON.stringify({ exit: unit.exitCode, counts }));
    check(c, '机检：无失败用例（fail = 0）', counts.fail === 0, JSON.stringify(counts));
    check(c, '机检：AC-65 用例存在且通过（无空闲会话 → 新建、不写复用行）',
      /^ok \d+ - AC-65/m.test(unit.stdout), counts.tests === null ? '未解析到 TAP' : `tests=${counts.tests}`);

    // ② 端到端：策略开启后派发仍正常继续、配置可见。
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
    evidence(c, 'given', 'driver-output.txt', d.stdout + d.stderr);
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);

    includes(c, 'Then：role show 显示「会话复用：复用（reuse）」', roleShow.stdout, '会话复用：复用（reuse）');
    check(c, 'Then：派发正常继续（backflow 跑到终态，无报错）',
      d.exitCode === 0 && state?.state === 'completed',
      JSON.stringify({ exit: d.exitCode, state: state?.state ?? null }));

    // ③ 冻结选择器：同角色但都不空闲（thinking / 正服务其他节点）→ 不复用。
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

    note(c, '裁-20l：AC-65 的 Given（该角色没有空闲会话）在当前严格串行推进下无法用一条 CLI '
      + '运行构造；改由 `test.dispatch` 接缝 + 预置 state.json 构造 Given，走真实 dispatchInState '
      + '分支取证「新建 + 0 条 session.reuse」，Then 判据按需求原文，未放宽。');
    note(c, '原「端到端不出现复用行」断言建立在「派发未接线」这一缺陷现场（裁-18a）之上：'
      + '接线后 backflow 现场本身有一个空闲会话，属 AC-49 的 Given，不再是本条的现场，故该断言撤销；'
      + '本条的 Then 由机检用例承担，并额外保留「策略开启不影响正常推进」的端到端佐证。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
