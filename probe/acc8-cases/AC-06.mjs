/**
 * AC-06 · 实例记录不可读时不从检查点静默重建。
 *
 * 让 code-loop 停在 running（hold-forever），把 state.json 写成非法 JSON，
 * 再执行 `orch status --instance`。断言：显示「状态不可读」、.corrupt 备份存在、
 * 原文件 sha256 不变、不出现「运行中」、退出码按既有口径为 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, orch, runCmd, sha256, sleep, exists,
} from '../acc8-f-lib.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');

export async function run() {
  const c = makeCase('AC-06', { scenario: 'corrupt-state', title: '实例记录不可读时不从检查点静默重建' });
  const root = freshRoot('AC-06');
  c.root = root;
  let child = null;
  try {
    const cwd = path.join(root, 'demo');
    fs.mkdirSync(cwd, { recursive: true });
    runCmd([NODE, DRIVER, '--root', root, '--scenario', 'hold-forever', '--cwd', cwd, '--prepare-only'], { cwd: REPO, env: baseEnv() });
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd, '--task', '写一个计算器。产物：calc.js', '--template', 'code-loop', '--host', 'mock'], {
      cwd: root, env: baseEnv(), stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
    const until = Date.now() + 25_000;
    while (Date.now() < until && !exists(path.join(root, '.mock', 'paused'))) await sleep(150);
    eq(c, 'Given：实例停在 running', readState(root)?.state, 'running');
    check(c, 'Given：检查点存在', exists(path.join(root, '.orch', 'instances', 'INST-001', 'state', 'checkpoint.json')),
      'checkpoint.json');

    const sp = path.join(root, '.orch', 'instances', 'INST-001', 'state.json');
    const corrupt = '{ NOT JSON';
    fs.writeFileSync(sp, corrupt, 'utf8');
    const shaBefore = sha256(fs.readFileSync(sp, 'utf8'));
    evidence(c, 'given', 'corrupt-bytes.txt', corrupt);

    // When：orch status（列表面）与 orch status --instance（实例面）
    const list = orch(root, ['status']);
    const obs = orch(root, ['status', '--instance', 'INST-001']);
    evidence(c, 'then', 'status-list.txt', list.stdout);
    evidence(c, 'then', 'status-instance.txt', obs.stdout);

    includes(c, 'Then：实例显示「状态不可读」', obs.stdout, '状态不可读');
    const backup = path.join(root, '.orch', 'instances', 'INST-001', 'state.json.corrupt');
    check(c, '保留 state.json.corrupt 备份', exists(backup), backup);
    const shaAfter = sha256(fs.readFileSync(sp, 'utf8'));
    eq(c, '机检：state.json 原字节不变（sha256）', shaAfter, shaBefore);
    check(c, '机检：重启前后文件 sha256 相同', shaAfter === sha256(corrupt), shaAfter);
    excludes(c, 'Then：不出现「运行中」', obs.stdout, '运行中');
    check(c, '退出码按既有「状态不可读」口径为 1', obs.exitCode === 1, `${obs.exitCode}`);
    check(c, '不自动用检查点覆盖原文件（非法 JSON 仍在）', fs.readFileSync(sp, 'utf8') === corrupt, '非法 JSON 未被覆盖');
    note(c, 'Given 用 hold-forever 让实例停在 running：终态实例在核心冷启动时会被 reconcileOnBoot 跳过，'
      + '不会触发 state.json 的可读性校验；running 实例经 `orch status --instance` 的 instance.get 才会报 STATE_CORRUPT。');
    try { child.kill('SIGKILL'); } catch { /* 清理 */ }
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
