/**
 * Studio authoring HTTP actions (role fields / role.update / skill.create).
 *
 * These are the three actions added so the desktop wizard can customize roles
 * and skills without falling back to the CLI. Each test drives the real
 * /studio/action route with an isolated temp root; no repository files are
 * written, and the frozen /assets/* read-only surface is untouched.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createHttpServer } from '../../src/daemon/http/server.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';

async function fixture() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'maestro-author-'));
  const home = path.join(root, 'home');
  await fs.promises.mkdir(home, { recursive: true });
  await fs.promises.mkdir(path.join(root, '.orch'), { recursive: true });
  const savedHome = process.env.HOME;
  const savedProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;

  const bus = createEventBus({ store: createStore({ root }) });
  const server = createHttpServer({
    root,
    orchestrator: {
      async start() { return { ok: false }; },
      async listInstances() { return { ok: true, items: [] }; },
      async getStatus() { return { ok: false }; },
      async reconcileOnBoot() { return { ok: true, interrupted: [] }; },
      async interruptAll() { return { ok: true, interrupted: [] }; },
      async dispose() {}
    },
    bus,
    graph: {
      loadState: async (id) => ({ ok: true, state: { instanceId: id } }),
      replayEvents: async () => [],
      readTraces: async () => ({ spans: [] })
    }
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  const { port, token } = server.meta;
  const base = `http://127.0.0.1:${port}`;

  const action = async (payload) => {
    const res = await fetch(`${base}/studio/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  };
  const state = async () => {
    const res = await fetch(`${base}/studio/state`, { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  };
  const close = async () => {
    await server.close();
    process.env.HOME = savedHome;
    process.env.USERPROFILE = savedProfile;
    await fs.promises.rm(root, { recursive: true, force: true });
  };
  return { root, action, state, close };
}

test('role.add persists duty/summary/skills/contract/requires and projects them', async () => {
  const f = await fixture();
  try {
    const added = await f.action({
      action: 'role.add', name: '测试角色', code: 'qa-api', dept: 'qa',
      duty: '接口测试', summary: '摘要',
      skills: ['acp-session', 'diff-review'],
      inputs: ['spec'], outputs: ['report'], requires: { acp: true }
    });
    assert.equal(added.ok, true, JSON.stringify(added));
    const role = (await f.state()).roles.find((r) => r.id === 'qa-api');
    assert.ok(role);
    assert.equal(role.duty, '接口测试');
    assert.equal(role.summary, '摘要');
    assert.deepEqual(role.skills, ['acp-session', 'diff-review']);
    assert.deepEqual(role.contract.inputs, ['spec']);
    assert.deepEqual(role.contract.outputs, ['report']);
    assert.equal(role.requires.acp, true);
  } finally {
    await f.close();
  }
});

test('role.update patches skills/duty/requires without losing untouched fields', async () => {
  const f = await fixture();
  try {
    await f.action({ action: 'role.add', name: '测试角色', code: 'qa-api', duty: '原职责', skills: ['keep'] });
    const updated = await f.action({
      action: 'role.update', id: 'qa-api', duty: '新职责', skills: ['a', 'b'], requires: { acp: false }
    });
    assert.equal(updated.ok, true, JSON.stringify(updated));
    const role = (await f.state()).roles.find((r) => r.id === 'qa-api');
    assert.equal(role.duty, '新职责');
    assert.deepEqual(role.skills, ['a', 'b']);
    assert.equal(role.requires.acp, false);
  } finally {
    await f.close();
  }
});

test('skill.create writes a valid SKILL.md and reports resolvable errors', async () => {
  const f = await fixture();
  try {
    const created = await f.action({
      action: 'skill.create', id: 'my-skill', name: '我的技能', summary: '测试技能',
      appliesTo: ['coding'], commands: ['orch run']
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    const text = await fs.promises.readFile(path.join(f.root, '.orch', 'skills', 'my-skill', 'SKILL.md'), 'utf8');
    assert.match(text, /schema: skill\/v1/);
    assert.match(text, /id: my-skill/);
    assert.match(text, /applies_to: \[coding\]/);

    const dup = await f.action({ action: 'skill.create', id: 'my-skill', name: 'X', summary: 'X' });
    assert.equal(dup.ok, false);
    assert.equal(dup.code, 'STUDIO_SKILL_EXISTS');
    assert.equal(typeof dup.labelKey, 'string');

    const badGroup = await f.action({
      action: 'skill.create', id: 'bad-group', name: 'X', summary: 'X', appliesTo: ['nope']
    });
    assert.equal(badGroup.ok, false);
    assert.equal(badGroup.code, 'SKILL_GROUP_INVALID');
    assert.equal(typeof badGroup.labelKey, 'string');
  } finally {
    await f.close();
  }
});
