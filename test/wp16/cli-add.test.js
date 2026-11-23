/**
 * WP-4 / `orch cli add`: valid registration, duplicate rejection and the
 * three classes of invalid input (AC-13 / AC-06), plus persistence across a
 * rescan (AC-05 / AC-10). Commands go through the real bin/orch.js entry.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { CLI_DISCOVERY_TEXT as T, fill } from '../../src/cli/labels.js';

const ORCH = fileURLToPath(new URL('../../bin/orch.js', import.meta.url));
const REGISTRY = path.join('.orch', 'cli-registry.json');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-add-'));
  return {
    root,
    registryPath: path.join(root, REGISTRY),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

function run(root, args) {
  const result = spawnSync(process.execPath, [ORCH, 'cli', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  if (result.error) throw result.error;
  return { code: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

function executable(root, name = 'mytool') {
  const target = path.join(root, name);
  fs.writeFileSync(target, '#!/bin/sh\necho "mytool 0.1"\n', 'utf8');
  fs.chmodSync(target, 0o755);
  return target;
}

function readRegistry(fx) {
  return JSON.parse(fs.readFileSync(fx.registryPath, 'utf8'));
}

test('CLI-A1: valid add persists user_config and appears immediately in list', () => {
  const fx = fixture();
  try {
    const tool = executable(fx.root);
    const result = run(fx.root, ['add', '--name', 'MyCLI', '--path', tool]);
    assert.equal(result.code, 0, result.err);
    assert.ok(result.out.includes(fill(T.ADD_OK, { name: 'MyCLI', path: tool })));

    const registry = readRegistry(fx);
    assert.equal(registry.user_config.length, 1);
    assert.equal(registry.user_config[0].name, 'MyCLI');
    assert.equal(registry.user_config[0].executable, tool);
    assert.equal(registry.user_config[0].cli_id, 'mycli');
    assert.ok(registry.user_config[0].added_at, 'added_at stamped');

    const userFinding = registry.clis.find((cli) =>
      cli.evidence.some((evidence) => evidence.type === 'user-config'));
    assert.ok(userFinding, 'new item is visible in clis right after add');
    assert.equal(userFinding.name, 'MyCLI');
    assert.equal(userFinding.executable, tool);

    const list = run(fx.root, ['list']);
    assert.equal(list.code, 0, list.err);
    assert.match(list.out, /MyCLI/);
    assert.match(list.out, new RegExp(tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    fx.cleanup();
  }
});

test('CLI-A2: duplicate path is rejected without creating a duplicate entry', () => {
  const fx = fixture();
  try {
    const tool = executable(fx.root);
    assert.equal(run(fx.root, ['add', '--name', 'MyCLI', '--path', tool]).code, 0);
    const second = run(fx.root, ['add', '--name', 'MyCLI', '--path', tool]);
    assert.equal(second.code, 1, 'duplicate rejected');
    assert.ok(second.out.includes(fill(T.ADD_EXISTS, { path: tool })));

    const registry = readRegistry(fx);
    assert.equal(registry.user_config.length, 1, 'no duplicate user_config entry');
    const userFindings = registry.clis.filter((cli) =>
      cli.evidence.some((evidence) => evidence.type === 'user-config'));
    assert.equal(userFindings.length, 1, 'no duplicate cli');

    // A relative spelling of the same executable is still a duplicate.
    fs.mkdirSync(path.join(fx.root, 'sub'), { recursive: true });
    const alias = path.join('sub', '..', 'mytool');
    const third = run(fx.root, ['add', '--name', 'Other', '--path', alias]);
    assert.equal(third.code, 1);
    assert.equal(readRegistry(fx).user_config.length, 1);
  } finally {
    fx.cleanup();
  }
});

test('CLI-A5: a symlink to an already-added executable is rejected as duplicate (realpath canonicalisation)', () => {
  const fx = fixture();
  try {
    const target = executable(fx.root, 'mytool');
    assert.equal(run(fx.root, ['add', '--name', 'MyCLI', '--path', target]).code, 0);

    // A real symlink (not a `sub/..` spelling) is what canonicalPath's
    // fs.realpathSync guards against: path.resolve alone would not catch it.
    const link = path.join(fx.root, 'mytool-link');
    fs.symlinkSync(target, link);
    assert.equal(fs.realpathSync(link), fs.realpathSync(target),
      'symlink resolves to the registered target (macOS realpath normalisation)');

    const dup = run(fx.root, ['add', '--name', 'ViaLink', '--path', link]);
    assert.equal(dup.code, 1, 'symlink path rejected as duplicate');
    assert.ok(dup.out.includes(fill(T.ADD_EXISTS, { path: path.resolve(link) })), dup.out);

    const registry = readRegistry(fx);
    assert.equal(registry.user_config.length, 1, 'still exactly one user_config entry');
    const userFindings = registry.clis.filter((cli) =>
      cli.evidence.some((evidence) => evidence.type === 'user-config'));
    assert.equal(userFindings.length, 1, 'still exactly one cli');
  } finally {
    fx.cleanup();
  }
});

test('CLI-A3: invalid input is rejected with readable reasons and no disk write', () => {
  const fx = fixture();
  try {
    const tool = executable(fx.root);
    const missing = path.join(fx.root, 'does-not-exist');
    // A directory is rejected on every platform: POSIX passes X_OK for it but
    // `isFile()` fails, while Windows has no exec bit at all so the isFile()
    // guard is the only portable signal. A plain .txt would pass on Windows
    // (X_OK degrades to existence there), which would test nothing.
    const notExecutable = path.join(fx.root, 'plain-dir');
    fs.mkdirSync(notExecutable, { recursive: true });

    const cases = [
      { args: ['add', '--name', '', '--path', tool], text: T.ADD_FAIL_EMPTY_NAME },
      { args: ['add', '--name', 'MyCLI', '--path', ''], text: T.ADD_FAIL_EMPTY_PATH },
      { args: ['add', '--name', 'MyCLI', '--path', missing], text: T.ADD_FAIL_NOT_FOUND },
      { args: ['add', '--name', 'MyCLI', '--path', notExecutable], text: T.ADD_FAIL_NOT_EXECUTABLE }
    ];
    for (const { args, text } of cases) {
      const result = run(fx.root, args);
      assert.equal(result.code, 1, `${text} exits 1`);
      assert.ok(result.out.includes(text), `readable reason: ${text}`);
      assert.ok(result.out.includes('添加失败'), 'reason is user-visible Chinese wording');
      assert.equal(fs.existsSync(fx.registryPath), false, 'invalid add never writes registry');
    }
  } finally {
    fx.cleanup();
  }
});

test('CLI-A4: manually added item survives a rescan (AC-05 / AC-10)', () => {
  const fx = fixture();
  try {
    const tool = executable(fx.root);
    const added = run(fx.root, ['add', '--name', 'MyCLI', '--path', tool]);
    assert.equal(added.code, 0, added.err);
    const before = readRegistry(fx).user_config;

    const scanned = run(fx.root, ['scan'], { PATH: '', HOME: path.join(fx.root, 'home') });
    assert.equal(scanned.code, 0, scanned.err);
    const after = readRegistry(fx);
    assert.equal(after.user_config.length, before.length, 'user_config not dropped by rescan');
    assert.equal(after.user_config[0].cli_id, before[0].cli_id);
    assert.equal(after.user_config[0].executable, before[0].executable);
    assert.equal(after.user_config[0].name, before[0].name);
    assert.equal(after.user_config[0].added_at, before[0].added_at);
    assert.notEqual(after.scanned_at, null, 'scanned_at refreshed');

    const listed = run(fx.root, ['list']);
    assert.equal(listed.code, 0, listed.err);
    assert.match(listed.out, /MyCLI/);
    assert.ok(listed.out.includes(T.MATRIX_TITLE), 'matrix segment rendered after rescan');
  } finally {
    fx.cleanup();
  }
});
