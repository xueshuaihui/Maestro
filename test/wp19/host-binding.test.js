/**
 * Host binding: the seam that turns "the scan found a CLI" into "an instance
 * can start". Without it every start ends in DSH_SPAWN_FAILED, which is what
 * the instance page used to do on a machine where a CLI existed but had no
 * `.orch/hosts/<id>.json`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { bindHost, hostIdForCli, listHosts, removeHost } from '../../src/studio/host.js';
import { loadHostConfig } from '../../src/adapter/host-config.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-host-'));

test('hostIdForCli 收敛成安全文件名', () => {
  assert.equal(hostIdForCli('opencode'), 'opencode');
  assert.equal(hostIdForCli('Claude Code'), 'claude-code');
  assert.equal(hostIdForCli('../evil'), 'evil');
  assert.equal(hostIdForCli(''), 'host');
});

test('bindHost 写出读取端认识的形状', async () => {
  const bound = await bindHost(root, {
    cliId: 'opencode',
    command: process.execPath,
    args: ['--version'],
    permissionPolicy: 'hold',
  });
  assert.equal(bound.ok, true);
  const file = path.join(root, '.orch', 'hosts', 'opencode.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(raw.transport, 'stdio');
  assert.equal(raw.launch.command, process.execPath);
  assert.deepEqual(raw.launch.args, ['--version']);
  assert.equal(raw.limits.permissionPolicy, 'hold');

  // The daemon reads the file back through this loader; a shape mismatch here
  // is exactly the "configured but unusable" state the UI must not allow.
  const loaded = await loadHostConfig({ root, hostId: 'opencode', env: {} });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.launch.command, process.execPath);
});

test('listHosts 区分可用与不可用', async () => {
  const missing = await bindHost(root, { cliId: 'ghost', command: process.execPath, args: [] });
  assert.equal(missing.ok, true);
  fs.writeFileSync(path.join(root, '.orch', 'hosts', 'ghost.json'),
    JSON.stringify({ transport: 'stdio', launch: { command: '/definitely/not/here', args: [] } }));

  const listed = await listHosts(root);
  assert.equal(listed.ok, true);
  const byId = new Map(listed.hosts.map((host) => [host.id, host]));
  assert.equal(byId.get('opencode')?.usable, true);
  assert.equal(byId.get('ghost')?.usable, false);
});

test('bindHost 拒绝不存在的命令与非法 id', async () => {
  const missing = await bindHost(root, { cliId: 'nope', command: '/no/such/binary', args: [] });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'STUDIO_HOST_EXEC_MISSING');

  const relative = await bindHost(root, { cliId: 'rel', command: 'opencode', args: [] });
  assert.equal(relative.ok, false);
  assert.equal(relative.code, 'STUDIO_HOST_EXEC_INVALID');

  const badId = await bindHost(root, { id: 'BAD ID', command: process.execPath, args: [] });
  assert.equal(badId.ok, false);
  assert.equal(badId.code, 'STUDIO_HOST_ID_INVALID');

  const badPolicy = await bindHost(root, {
    cliId: 'pol', command: process.execPath, args: [], permissionPolicy: 'whatever',
  });
  assert.equal(badPolicy.ok, false);
  assert.equal(badPolicy.code, 'STUDIO_HOST_POLICY_INVALID');
});

test('removeHost 删掉后不再列出，重复删除报未知', async () => {
  const removed = await removeHost(root, 'opencode');
  assert.equal(removed.ok, true);
  const listed = await listHosts(root);
  assert.equal(listed.hosts.some((host) => host.id === 'opencode'), false);
  const again = await removeHost(root, 'opencode');
  assert.equal(again.ok, false);
  assert.equal(again.code, 'STUDIO_HOST_UNKNOWN');
});
