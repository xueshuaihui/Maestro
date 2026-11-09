#!/usr/bin/env node
/**
 * I1.7 / AC-12 端到端探针：`orch instance status` 真实透出 code 角色的分支与合并状态。
 *
 * 为什么需要它：WP-5/WP-5b 的 `includeBranch` 只由渲染层单测覆盖（直接调 render 函数），
 * 未验证「磁盘快照 → core IPC `instance.get` → shapeSnapshot → CLI 文本输出」这条完整链路
 * 是否真的把 `branch` / `mergeStatus` 送到用户眼前。本探针在隔离项目根内：
 *   1. 造三个实例快照（已合并 / 冲突升级 / single 负控）；
 *   2. 真实拉起 core（CLI `ensure:true` 自动拉起，走命名管道 IPC）；
 *   3. 跑真实 `node bin/orch.js instance status <id>`，逐条断言 stdout；
 *   4. 负控：`single` 实例输出必须无分支片段（三主链运行期口径不回归）。
 *
 * 隔离：项目根建在 os.tmpdir()（绝不放仓库内，模板红线 3），结束时 `core stop` + 删目录。
 *
 * 用法：`node probe/i17-ac12-status.mjs`
 * 证据：`docs/iterations/iteration-7/evidence/ac12-status/`
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EV = path.join(REPO, 'docs/iterations/iteration-7/evidence/ac12-status');

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 跑一个 CLI 命令，返回 { code, stdout, stderr }。 */
function runCli(args, cwd, { timeoutMs = 90_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(REPO, 'bin/orch.js'), ...args], {
      cwd,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (buf) => {
      stdout += buf.toString('utf8');
    });
    child.stderr.on('data', (buf) => {
      stderr += buf.toString('utf8');
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** 写一个实例快照（最小可读形状：schemaVersion + instanceId 即可通过 store 校验）。 */
async function writeState(root, state) {
  const dir = path.join(root, '.orch', 'instances', state.instanceId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

const AT = '2026-11-10T06:00:00.000Z';

function baseState(instanceId, overrides) {
  return {
    schemaVersion: 2,
    rev: 7,
    instanceId,
    template: 'code-loop',
    state: 'completed',
    halted: false,
    paused: false,
    createdAt: AT,
    stateSince: AT,
    updatedAt: AT,
    nodes: [],
    handoffs: [],
    escalations: [],
    sessions: [],
    ...overrides,
  };
}

const MERGED_ID = 'INST-AC12-MERGED';
const CONFLICT_ID = 'INST-AC12-CONFLICT';
const SINGLE_ID = 'INST-AC12-SINGLE';

async function main() {
  const raw = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-ac12-'));
  // macOS 的 /var → /private/var 符号链接会让项目根指纹前后不一致，统一取 realpath。
  const root = await fs.realpath(raw);
  await fs.mkdir(EV, { recursive: true });
  console.log(`# 隔离项目根：${root}`);

  try {
    // ① 已合并：节点 done + branch + mergeStatus=merged
    await writeState(root, baseState(MERGED_ID, {
      nodes: [
        {
          nodeId: 'T-001',
          roleId: 'developer',
          state: 'done',
          round: 1,
          branch: `maestro/${MERGED_ID}/developer`,
          mergeStatus: 'merged',
          startedAt: '2026-11-10T06:00:10.000Z',
          endedAt: '2026-11-10T06:01:00.000Z',
        },
        { nodeId: 'T-002', roleId: 'tester', state: 'done', round: 1 },
      ],
    }));

    // ② 冲突升级：节点 escalated + mergeStatus=conflict + 待处理升级
    await writeState(root, baseState(CONFLICT_ID, {
      state: 'suspended',
      halted: true,
      stateSince: '2026-11-10T06:02:00.000Z',
      updatedAt: '2026-11-10T06:02:00.000Z',
      nodes: [
        {
          nodeId: 'T-001',
          roleId: 'developer',
          state: 'escalated',
          round: 1,
          branch: `maestro/${CONFLICT_ID}/developer`,
          mergeStatus: 'conflict',
          startedAt: '2026-11-10T06:00:10.000Z',
        },
      ],
      escalations: [
        {
          escalationId: 'ESC-AC12-001',
          instanceId: CONFLICT_ID,
          nodeId: 'T-001',
          round: 1,
          reasonCode: 'merge_conflict',
          reasonDetail: 'merge maestro/INST-AC12-CONFLICT/developer into integration failed',
          state: 'pending',
          createdAt: '2026-11-10T06:02:00.000Z',
        },
      ],
    }));

    // ③ 负控：single 实例（无 branch 字段），输出必须与 I1.1 逐字一致、无分支片段
    await writeState(root, baseState(SINGLE_ID, {
      template: 'single',
      nodes: [{ nodeId: 'T-001', roleId: 'worker', state: 'done', round: 1 }],
    }));

    // ④ 真实跑 CLI（首个命令会触发 core 自动拉起）
    const merged = await runCli(['instance', 'status', MERGED_ID], root);
    const conflict = await runCli(['instance', 'status', CONFLICT_ID], root);
    const single = await runCli(['instance', 'status', SINGLE_ID], root);

    await fs.writeFile(path.join(EV, 'status-merged.txt'), merged.stdout, 'utf8');
    await fs.writeFile(path.join(EV, 'status-conflict.txt'), conflict.stdout, 'utf8');
    await fs.writeFile(path.join(EV, 'status-single.txt'), single.stdout, 'utf8');

    // ⑤ 断言：已合并实例
    record('核心 IPC 往返后退出码为 0（merged）', merged.code === 0, `exit=${merged.code}`);
    record(
      '已合并实例节点行含分支名',
      merged.stdout.includes(`maestro/${MERGED_ID}/developer`),
      merged.stdout.split('\n').find((l) => l.includes('T-001')) ?? '(无 T-001 行)',
    );
    record(
      '已合并实例节点行含合并状态「已合并」',
      merged.stdout.includes('已合并'),
      merged.stdout.split('\n').find((l) => l.includes('T-001')) ?? '(无 T-001 行)',
    );
    record(
      '已合并实例节点行形如 `节点 T-001 开发 … （… 分支 maestro/… · 已合并）`',
      /节点\s+T-001\s+开发.*（.*分支\s+maestro\//.test(merged.stdout),
      merged.stdout.split('\n').find((l) => l.includes('T-001')) ?? '(无 T-001 行)',
    );
    record(
      '已合并实例无「未合并」类噪声（mergeStatus 未误判为 conflict）',
      !merged.stdout.includes('冲突待升级'),
      '未出现「冲突待升级」',
    );

    // ⑥ 断言：冲突升级实例
    record('核心 IPC 往返后退出码为 0（conflict）', conflict.code === 0, `exit=${conflict.code}`);
    record(
      '冲突实例节点行含分支名',
      conflict.stdout.includes(`maestro/${CONFLICT_ID}/developer`),
      conflict.stdout.split('\n').find((l) => l.includes('T-001')) ?? '(无 T-001 行)',
    );
    record(
      '冲突实例节点行合并状态为「冲突待升级」',
      conflict.stdout.includes('冲突待升级'),
      conflict.stdout.split('\n').find((l) => l.includes('T-001')) ?? '(无 T-001 行)',
    );
    record(
      '冲突实例升级块把 reasonCode 映射为中文「合并冲突」',
      conflict.stdout.includes('合并冲突'),
      conflict.stdout.split('\n').find((l) => l.includes('原因')) ?? '(无 原因 行)',
    );
    record(
      '冲突实例保留 escalationId（ESC-AC12-001 可见）',
      conflict.stdout.includes('ESC-AC12-001'),
      conflict.stdout.split('\n').find((l) => l.includes('ESC-AC12-001')) ?? '(无 ESC-AC12-001 行)',
    );

    // ⑦ 断言：single 负控（三主链运行期口径不回归）
    record('single 实例退出码为 0', single.code === 0, `exit=${single.code}`);
    record(
      'single 实例输出无分支片段（逐字回归，不回灌 includeBranch）',
      !single.stdout.includes('分支') && !single.stdout.includes('已合并'),
      JSON.stringify(single.stdout.trim().split('\n')),
    );
    record(
      'single 实例节点行逐字为 I1.1 基线（`节点 已完成`，无节点号/角色）',
      single.stdout.split('\n').includes('节点 已完成'),
      single.stdout.split('\n').find((l) => l.startsWith('节点')) ?? '(无节点行)',
    );

    // ⑧ core 回放：`instance status` 之外，`instance graph` 也应透出（AC-12 graph 视图）
    const graph = await runCli(['instance', 'graph', MERGED_ID], root);
    await fs.writeFile(path.join(EV, 'graph-merged.txt'), graph.stdout, 'utf8');
    record(
      'graph 文本视图同样透出分支名（AC-12 第二视图）',
      graph.code === 0 && graph.stdout.includes(`maestro/${MERGED_ID}/developer`),
      graph.code === 0 ? 'exit=0 且含分支名' : `exit=${graph.code}`,
    );

    // ⑨ 收尾：停 core（隔离根，不影响真实项目）
    const stop = await runCli(['core', 'stop'], root, { timeoutMs: 30_000 });
    record('隔离根 core 已停止', stop.code === 0 || /没有在跑|未运行/.test(stop.stdout), `exit=${stop.code}`);
  } finally {
    const failed = results.filter((r) => !r.ok);
    const summary = {
      probe: 'I1.7 AC-12 end-to-end (real core IPC + real CLI status)',
      head: (await fs.readFile(path.join(REPO, '.git/HEAD'), 'utf8')).trim(),
      startedAt: new Date().toISOString(),
      projectRoot: root,
      total: results.length,
      pass: results.length - failed.length,
      fail: failed.length,
      results,
    };
    await fs.writeFile(path.join(EV, 'ac12-result.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    await fs.rm(root, { recursive: true, force: true });
    console.log(`\n# 合计 ${summary.total} 条：pass=${summary.pass} fail=${summary.fail}`);
    console.log(`# 证据：${path.relative(REPO, EV)}/`);
    process.exitCode = failed.length === 0 ? 0 : 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
