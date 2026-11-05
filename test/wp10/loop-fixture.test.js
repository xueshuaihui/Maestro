/**
 * WP-5 夹具自测：**只**覆盖夹具自身，不依赖产品侧的 `task-loop` 推进（WP-3 未开始）。
 *
 * 1) `--prepare-only` 写出的现场（cursor.json / .orch/hosts/dsh.json / launch.args）
 * 2) 29 个场景 JSON 可解析、nodeId / round 显式、场景名与 D-9 表逐字一致
 * 3) `--reset` 后 cursor 归零
 * 4) mock 可被独立拉起跑完一轮（真实 NDJSON → 按「写入路径：」落盘）
 * 5) 路径不匹配时写 .mock/bad-write-path 且不落文件
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import {
  DEFAULT_TASK,
  MOCK_AGENT_PATH,
  REPO_ROOT,
  getTaskScenario,
  taskScenarioNames,
} from '../fixtures/task-loop-driver.mjs';

const DRIVER = path.join(REPO_ROOT, 'test', 'fixtures', 'task-loop-driver.mjs');
const SCENARIO_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'scenarios', 'task-loop');

// D-9 场景表，逐字（顺序按字母重排，只用于集合比较）。
const D9_SCENARIOS = [
  'dispatch-fail-backflow',
  'dispatch-fail-first',
  'doc-backflow-once',
  'doc-empty',
  'doc-hold-research',
  'doc-missing',
  'doc-pass',
  'doc-previous-missing',
  'doc-previous-modified',
  'doc-reject-twice',
  'doc-slow-reviewer',
  'doc-stale',
  'execution-fail',
  'research-empty',
  'research-missing',
  'research-stale',
  'review-artifact-mismatch',
  'review-artifact-missing',
  'review-bad-json',
  'review-decision-invalid',
  'review-defect-shape',
  'review-evidence-outside',
  'review-evidence-unreadable',
  'review-missing',
  'review-pass-with-defects',
  'review-reject-no-defects',
  'review-says-pass',
  'review-says-reject',
  'review-stale',
];

function tmpRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `maestro-wp5-${name}-`));
}

function cleanup(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // Windows 上偶发占用，交给系统临时目录清理
  }
}

function runDriver(args, timeout = 30_000) {
  return spawnSync(process.execPath, [DRIVER, ...args], {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
  });
}

function toPosix(value) {
  return String(value).replaceAll('\\', '/');
}

function markerExists(root, name) {
  return fs.existsSync(path.join(root, '.mock', name));
}

/**
 * 不经过编排核心，直接用 NDJSON 驱动 mock 跑一步。
 * 只验证夹具：cursor 消费 → 提示词解析 → 落盘。
 */
function runMockOnce({ root, cwd, scenario, promptText }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      MOCK_AGENT_PATH,
      '--root', root,
      '--suite', 'task-loop',
      '--scenario', scenario,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let buffer = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`mock 超时未回话${stderr ? `：${stderr}` : ''}`));
    }, 20_000);

    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);

    const finish = (value) => {
      clearTimeout(timer);
      resolve(value);
    };

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        const nl = buffer.indexOf('\n');
        if (nl < 0) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id === undefined) continue; // 通知帧
        if (message.error) {
          clearTimeout(timer);
          reject(new Error(`mock 返回错误：${JSON.stringify(message.error)}`));
          return;
        }
        if (message.id === 1) {
          send({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd } });
        } else if (message.id === 2) {
          send({
            jsonrpc: '2.0',
            id: 3,
            method: 'session/prompt',
            params: {
              sessionId: message.result.sessionId,
              prompt: [{ type: 'text', text: promptText }],
            },
          });
        } else if (message.id === 3) {
          child.stdin.end();
          finish({ stopReason: message.result?.stopReason ?? null });
          return;
        }
      }
    });

    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  });
}

test('--prepare-only 写出 cursor.json 与 .orch/hosts/dsh.json，launch.args 带 --suite task-loop', () => {
  const root = tmpRoot('prepare');
  const rootReal = fs.realpathSync.native(root);
  try {
    const res = runDriver(['--root', root, '--scenario', 'doc-pass', '--prepare-only', '--reset']);
    assert.equal(res.status, 0, res.stderr);

    const summary = JSON.parse(res.stdout.trim());
    assert.equal(summary.prepareOnly, true);
    assert.equal(summary.suite, 'task-loop');
    assert.equal(summary.root, rootReal);

    const cursor = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { next: 1 });

    const hostPath = path.join(root, '.orch', 'hosts', 'dsh.json');
    assert.equal(fs.existsSync(hostPath), true, '宿主配置必须是 hosts/dsh.json');
    const host = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
    assert.equal(host.id, 'dsh');
    assert.equal(host.transport, 'stdio');
    assert.equal(host.launch.command, process.execPath);
    assert.deepEqual(host.launch.args, [
      MOCK_AGENT_PATH,
      '--root',
      rootReal,
      '--suite',
      'task-loop',
      '--scenario',
      'doc-pass',
    ]);
    for (const arg of host.launch.args) {
      if (['--root', '--suite', '--scenario', 'task-loop', 'doc-pass'].includes(arg)) continue;
      assert.equal(path.isAbsolute(arg), true, `应使用绝对路径：${arg}`);
    }

    // 只准备现场：不启核心、不建实例
    const instances = path.join(root, '.orch', 'instances');
    assert.equal(fs.existsSync(instances) && fs.readdirSync(instances).length > 0, false);
    assert.equal(markerExists(root, 'paused'), false);
  } finally {
    cleanup(root);
  }
});

test('场景 JSON 共 29 个、全部可解析、nodeId 与 round 显式', () => {
  const names = taskScenarioNames();
  assert.equal(names.length, 29, `实际 ${names.length} 个：${names.join(', ')}`);
  assert.deepEqual(names, D9_SCENARIOS, '场景名集合必须与 D-9 场景表逐字一致');

  for (const name of names) {
    const filePath = path.join(SCENARIO_DIR, `${name}.json`);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(Array.isArray(raw.steps) && raw.steps.length > 0, true, `${name} 没有 steps`);
    raw.steps.forEach((step, index) => {
      const where = `${name} 第 ${index + 1} 步`;
      assert.equal(Object.prototype.hasOwnProperty.call(step, 'nodeId'), true, `${where} 缺 nodeId`);
      assert.equal(Object.prototype.hasOwnProperty.call(step, 'round'), true, `${where} 缺 round`);
      assert.equal(typeof step.nodeId, 'string', `${where} nodeId 必须是字符串`);
      assert.equal(Number.isInteger(step.round) && step.round >= 1, true, `${where} round 必须是正整数`);
      assert.equal(['T-001', 'T-002', 'T-003'].includes(step.nodeId), true, `${where} nodeId 越界`);
    });

    // driver 的读取器同样不接受省略
    const scenario = getTaskScenario(name);
    assert.equal(scenario.steps.length, raw.steps.length);
    assert.deepEqual(scenario.steps.map((step) => step.nodeId), raw.steps.map((step) => step.nodeId));
    assert.equal(scenario.steps.every((step) => Number.isInteger(step.round)), true);
  }

  // D-9 明确要求「不得沿用交替默认值」：同一 nodeId 的连续轮次必须是 1、2
  const backflow = getTaskScenario('doc-backflow-once');
  assert.deepEqual(backflow.steps.map((step) => `${step.nodeId}/${step.round}`), [
    'T-001/1', 'T-002/1', 'T-003/1', 'T-002/2', 'T-003/2',
  ]);
  assert.equal(getTaskScenario('review-says-pass').stopAfter, 4);
});

test('--reset 清空 .mock 并把 cursor 归零', () => {
  const root = tmpRoot('reset');
  try {
    fs.mkdirSync(path.join(root, '.mock'), { recursive: true });
    fs.writeFileSync(path.join(root, '.mock', 'cursor.json'), JSON.stringify({ next: 9 }), 'utf8');
    fs.writeFileSync(path.join(root, '.mock', 'stale-marker'), '1', 'utf8');
    fs.writeFileSync(path.join(root, '.mock', 'release'), '', 'utf8');

    const res = runDriver(['--root', root, '--scenario', 'doc-pass', '--prepare-only', '--reset']);
    assert.equal(res.status, 0, res.stderr);

    const cursor = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { next: 1 });
    assert.equal(fs.existsSync(path.join(root, '.mock', 'stale-marker')), false);
    assert.equal(fs.existsSync(path.join(root, '.mock', 'release')), false);

    // 不带 --reset 时保留现场（同一份 cursor 不被悄悄重置）
    fs.writeFileSync(path.join(root, '.mock', 'cursor.json'), JSON.stringify({ next: 5 }), 'utf8');
    const keep = runDriver(['--root', root, '--scenario', 'doc-pass', '--prepare-only']);
    assert.equal(keep.status, 0, keep.stderr);
    const after = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(after, { next: 1 }, 'prepare 总是写新 cursor（只由 --reset 决定是否清目录）');
  } finally {
    cleanup(root);
  }
});

test('mock 独立拉起可跑完一步：按「写入路径：」落盘并记 prompts/1.json', async () => {
  const root = tmpRoot('chain');
  const workspace = path.join(root, 'ws');
  const cwd = path.join(root, 'demo-doc');
  try {
    const prep = runDriver(['--root', root, '--scenario', 'doc-pass', '--prepare-only', '--reset']);
    assert.equal(prep.status, 0, prep.stderr);
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });

    const scenario = getTaskScenario('doc-pass');
    const firstStep = scenario.steps[0];
    const absPath = `${toPosix(workspace)}/${firstStep.artifact}`;
    const promptText = [
      DEFAULT_TASK,
      '',
      `研究笔记：${firstStep.artifact}`,
      `写入路径：${absPath}`,
      '只交研究笔记，不写最终文档。',
    ].join('\n');

    const result = await runMockOnce({ root, cwd, scenario: 'doc-pass', promptText });
    assert.equal(result.stopReason, 'end_turn');

    assert.equal(fs.existsSync(absPath), true, `应按提示词写入 ${absPath}`);
    assert.equal(fs.readFileSync(absPath, 'utf8'), firstStep.content);
    assert.equal(markerExists(root, 'bad-write-path'), false);

    const record = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'prompts', '1.json'), 'utf8'));
    assert.deepEqual(record, { n: 1, nodeId: 'T-001', round: 1, task: promptText });

    const cursor = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { next: 2 });
    assert.equal(markerExists(root, 'exhausted'), false);
  } finally {
    cleanup(root);
  }
});

test('写入路径与 artifact 不匹配时写 .mock/bad-write-path 且不落文件', async () => {
  const root = tmpRoot('badpath');
  const workspace = path.join(root, 'ws');
  const cwd = path.join(root, 'demo-doc');
  try {
    const prep = runDriver(['--root', root, '--scenario', 'doc-pass', '--prepare-only', '--reset']);
    assert.equal(prep.status, 0, prep.stderr);
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });

    const wrong = `${toPosix(workspace)}/artifacts/docs/wrong-name.v1.md`;
    const promptText = [DEFAULT_TASK, '', `写入路径：${wrong}`].join('\n');

    const result = await runMockOnce({ root, cwd, scenario: 'doc-pass', promptText });
    assert.equal(result.stopReason, 'end_turn');

    assert.equal(fs.existsSync(wrong), false, '路径不匹配时不得落盘');
    assert.equal(markerExists(root, 'bad-write-path'), true, '必须留下 bad-write-path 标记');
    const marker = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'bad-write-path'), 'utf8'));
    assert.equal(marker.expected, 'artifacts/reports/research-notes.v1.md');
    assert.equal(marker.found, wrong);
  } finally {
    cleanup(root);
  }
});
