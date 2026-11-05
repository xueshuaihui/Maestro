#!/usr/bin/env node
/**
 * AC-26 fixture: submit one illegal transition to the core state machine and let the
 * rejection land in the same events.jsonl as production events (through the event bus).
 *
 * Usage:
 *   node test/fixtures/attempt-transition.mjs \
 *     --root <project root> --instance INST-001 \
 *     --object node --from done --to running
 *
 * Exit codes:
 *   0  rejected with ILLEGAL_TRANSITION (the expected demonstration)
 *   1  the transition was accepted (defect)
 *   2  fixture preconditions not met (missing dependency / instance / state mismatch)
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createInstanceSM,
  createNodeSM,
  createHandoffSM
} from '../../src/core/state-machine.js';

const REL = {
  store: '../../src/persistence/instance-store.js',
  bus: '../../src/core/event-bus.js'
};

const URL_BY_KEY = {
  store: new URL(REL.store, import.meta.url),
  bus: new URL(REL.bus, import.meta.url)
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SM_FACTORY = {
  instance: createInstanceSM,
  node: createNodeSM,
  handoff: createHandoffSM
};

function usage() {
  console.error(
    '用法：node test/fixtures/attempt-transition.mjs --root <项目根> --instance <实例号> ' +
      '--object <instance|node|handoff> --from <状态> --to <状态> [--node <节点号>] [--handoff <交接包号>]'
  );
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function fail(code, message) {
  console.error(message);
  process.exitCode = code;
}

async function loadDependency(key) {
  const filePath = fileURLToPath(URL_BY_KEY[key]);
  const display = path.relative(PROJECT_ROOT, filePath);
  if (!existsSync(filePath)) {
    throw new Error(`夹具依赖未就绪：${display}`);
  }
  try {
    return await import(URL_BY_KEY[key].href);
  } catch (err) {
    throw new Error(`夹具依赖未就绪：${display}（${err && err.message ? err.message : err}）`);
  }
}

/**
 * The state the snapshot carries for the addressed object.
 * v1 has single `node` / `handoff` objects; v2 has `nodes[]` / `handoffs[]`.
 * `--node` / `--handoff` select one element by id (AC-25 targets T-002).
 */
function readObjectState(snapshot, object, instanceId, selector = {}) {
  if (object === 'instance') {
    return { state: snapshot.state, objectId: snapshot.instanceId || instanceId };
  }
  if (object === 'node') {
    const list = Array.isArray(snapshot.nodes)
      ? snapshot.nodes
      : snapshot.node ? [snapshot.node] : [];
    const found = selector.nodeId
      ? list.find((item) => item.nodeId === selector.nodeId)
      : list[0];
    return { state: found ? found.state : undefined, objectId: found ? found.nodeId : undefined };
  }
  const list = Array.isArray(snapshot.handoffs)
    ? snapshot.handoffs
    : snapshot.handoff ? [snapshot.handoff] : [];
  const found = selector.handoffId
    ? list.find((item) => item.handoffId === selector.handoffId)
    : list[0];
  return { state: found ? found.state : undefined, objectId: found ? found.handoffId : undefined };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['root', 'instance', 'object', 'from', 'to'];

  for (const key of required) {
    if (args[key] === undefined || args[key] === true) {
      usage();
      fail(2, `缺少参数：--${key}`);
      return;
    }
  }

  const object = String(args.object);
  const from = String(args.from);
  const to = String(args.to);
  const instanceId = String(args.instance);
  const root = path.resolve(process.cwd(), String(args.root));

  if (!SM_FACTORY[object]) {
    fail(2, `--object 取值非法：${object}（只接受 instance / node / handoff）`);
    return;
  }

  let storeModule;
  let busModule;
  try {
    storeModule = await loadDependency('store');
    busModule = await loadDependency('bus');
  } catch (err) {
    fail(2, err && err.message ? err.message : String(err));
    return;
  }

  if (typeof storeModule.createStore !== 'function') {
    fail(2, `夹具依赖未就绪：${REL.store} 未导出 createStore`);
    return;
  }
  if (typeof busModule.createEventBus !== 'function') {
    fail(2, `夹具依赖未就绪：${REL.bus} 未导出 createEventBus`);
    return;
  }

  const store = storeModule.createStore({ root });

  const loaded = await store.load(instanceId);
  if (!loaded || !loaded.ok) {
    fail(2, `读取实例失败：${instanceId}，code=${loaded ? loaded.code : 'UNKNOWN'}`);
    return;
  }

  const current = readObjectState(loaded.state, object, instanceId, {
    nodeId: typeof args.node === 'string' ? args.node : null,
    handoffId: typeof args.handoff === 'string' ? args.handoff : null
  });
  if (!current.state) {
    fail(2, `实例快照里没有 ${object} 的状态：${instanceId}`);
    return;
  }
  if (current.state !== from) {
    fail(
      2,
      `实际状态与 --from 不一致：${object} 实际为 ${current.state}，--from 为 ${from}`
    );
    return;
  }

  const bus = busModule.createEventBus({ store });
  const gen =
    typeof loaded.state.coreGeneration === 'string' ? loaded.state.coreGeneration : undefined;
  let lastEmit = null;

  const sm = SM_FACTORY[object]({
    emit: async (event) => {
      lastEmit = await bus.emit({ instanceId, ...(gen ? { gen } : {}), ...event });
      return lastEmit;
    }
  });

  const result = await sm.apply(from, to, {
    objectId: current.objectId,
    reason: 'fixture.attempt_transition',
    detail: { source: 'fixture/attempt-transition' }
  });

  if (lastEmit && lastEmit.ok === false) {
    fail(2, `事件落盘失败：code=${lastEmit.code}`);
    return;
  }

  console.log(JSON.stringify(result, null, 2));

  if (result.ok === true) {
    fail(1, `迁移本该被拒绝却被接受：${object} ${from} -> ${to}`);
    return;
  }
  if (result.code !== 'ILLEGAL_TRANSITION') {
    fail(2, `拒绝码不是 ILLEGAL_TRANSITION：${result.code}`);
    return;
  }

  console.log(`已拒绝：${object} ${from} -> ${to}（${result.code}）`);
  process.exitCode = 0;
}

main().catch((err) => {
  fail(2, `夹具执行失败：${err && err.stack ? err.stack : err}`);
});
