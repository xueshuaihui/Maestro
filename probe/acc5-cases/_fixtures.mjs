// 共享夹具动作（以 `_` 开头，runner 不会当成用例加载）。
// 三条主链的「停在中间态」各有确定的接缝，集中在这里，避免每条 AC 各写一遍时序。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, MOCK, CODE_DRIVER, TASK_DRIVER, SINGLE_TASK, startDriver, startProduct, waitPaused, waitMarker,
  readState, baseEnv, waitUntil, CODE_TASK, prepareCodeLoop, writeHostConfig, orch, ensureDir, noteScenario
} from '../acc5-f-common.mjs';

/**
 * code-loop 停在 T-002 第 2 轮执行中（retest-slow 的第 4 步有 30s 延迟）：
 * T-001 已 done（完成一次回流后）、T-002 running 且会话仍在跑。
 * @returns {Promise<{h:object, state:object}>}
 */
export async function startCodeLoopRetest(root, { timeout = 90000 } = {}) {
  const h = startDriver(root, ['--scenario', 'retest-slow', '--keep'], { driver: CODE_DRIVER, timeout });
  const state = await waitUntil(() => {
    const snap = readState(root);
    const t1 = (snap?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    const t2 = (snap?.nodes ?? []).find((n) => n.nodeId === 'T-002');
    return t1?.state === 'done' && t2?.state === 'running' && t2?.round === 2 ? snap : null;
  }, { timeout: 60000, label: 'code-loop 第 2 轮测试执行中' });
  return { h, state };
}

/**
 * code-loop 停在某一接缝（`MAESTRO_TEST_PAUSE`），返回 {h, state}；state 已等到 T-002 会话落盘。
 * @param {string} pauseSpec 例如 `after_accepted:T-002` / `after_output:T-001`
 */
export async function startCodeLoopPaused(root, pauseSpec, { timeout = 90000 } = {}) {
  const h = startDriver(root, ['--scenario', 'backflow', '--keep'], {
    driver: CODE_DRIVER,
    env: baseEnv({ MAESTRO_TEST_PAUSE: pauseSpec }),
    timeout
  });
  const paused = await waitPaused(root, { timeout: 60000 });
  const state = readState(root);
  return { h, paused, state };
}

/** task-loop 停在「研究已完成、撰写执行中」（撰写接受交接后暂停）。 */
export async function startTaskLoopWriter(root, { timeout = 90000 } = {}) {
  const h = startDriver(root, ['--scenario', 'doc-pass', '--keep'], {
    driver: TASK_DRIVER,
    env: baseEnv({ MAESTRO_TEST_PAUSE: 'after_accepted:T-002' }),
    timeout
  });
  const paused = await waitPaused(root, { timeout: 60000 });
  return { h, paused };
}

/**
 * code-loop 用 dsh 宿主停在 `after_accepted:T-002`（AC-22 要 hostIcons 含 dsh）。
 * 先借 code-loop 驱动备现场，再写 `.orch/hosts/dsh.json`，最后用产品 CLI 起实例。
 */
export function startCodeLoopWithDshHost(root, { cwd = './demo-code', pauseSpec = 'after_accepted:T-002' } = {}) {
  prepareCodeLoop(root, 'backflow');
  writeHostConfig(root, { hostId: 'dsh', scenario: 'backflow' });
  const h = startProduct(root, ['run', '--cwd', cwd, '--task', CODE_TASK,
    '--template', 'code-loop', '--host', 'dsh'], {
    env: baseEnv({ MAESTRO_TEST_PAUSE: pauseSpec }),
    timeout: 90000
  });
  return h;
}

export { waitPaused, waitMarker, readState };

/** single 图的最小宿主：mock 在会话 cwd 里写 out/intro.md（I1.1 wp9 / I1.3 ac36 同款）。 */
export function writeSingleHost(root) {
  const dir = path.join(root, '.orch', 'hosts');
  ensureDir(dir);
  ensureDir(path.join(root, 'work'));
  fs.writeFileSync(path.join(dir, 'dsh.json'), `${JSON.stringify({
    id: 'dsh',
    transport: 'stdio',
    launch: { command: NODE, args: [path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js'), '--write-ref', 'out/intro.md'] },
    limits: {
      initializeTimeoutMs: 15000, requestTimeoutMs: 15000, promptTimeoutMs: 30000,
      quietIdleMs: 30, quietCapMs: 200
    }
  }, null, 2)}\n`, 'utf8');
}

/** 跑一次 `single` 主链（同步，跑完即 completed）。 */
export function runSingleChain(root) {
  writeSingleHost(root);
  noteScenario();
  return orch(root, ['run', '--cwd', './work', '--task', SINGLE_TASK, '--host', 'dsh'], { timeout: 180000 });
}
