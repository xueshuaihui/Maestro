// checkpoint/v1 envelope: assembly, atomic persistence, guarded reads.
import fs from 'node:fs/promises';
import { writeJsonAtomic } from '../persistence/atomic-write.js';
import { checkpointPath } from '../persistence/paths.js';

export { checkpointPath };

export const CHECKPOINT_SCHEMA = 'checkpoint/v1';

const UNREADABLE = 'CHECKPOINT_UNREADABLE';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectOrEmpty(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function projectNode(entry) {
  const e = objectOrEmpty(entry);
  return {
    nodeId: e.nodeId ?? e.id ?? null,
    state: e.state ?? null,
    phase: e.phase ?? null,
    round: Number.isInteger(e.round) ? e.round : 0,
    roleId: e.roleId ?? null,
    sessionId: e.sessionId ?? null,
    endedAt: e.endedAt ?? null,
  };
}

function projectSession(entry) {
  const e = objectOrEmpty(entry);
  return {
    sessionId: e.sessionId ?? null,
    nodeId: e.nodeId ?? null,
    hostId: e.hostId ?? null,
    state: e.state ?? null,
    policy: e.policy ?? null,
    dialect: e.dialect ?? null,
    lastEventAt: e.lastEventAt ?? null,
  };
}

function projectHandoff(entry) {
  const e = objectOrEmpty(entry);
  return {
    handoffId: e.handoffId ?? e.id ?? null,
    from: e.from ?? null,
    to: e.to ?? null,
    kind: e.kind ?? null,
    state: e.state ?? null,
    deliveryAttempts: Number.isInteger(e.deliveryAttempts) ? e.deliveryAttempts : 0,
  };
}

function cloneEntry(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? { ...value } : value;
}

function cloneGraph(value) {
  return { ...objectOrEmpty(value) };
}

/**
 * Build the checkpoint/v1 envelope from an in-memory instance snapshot, a locked
 * graph snapshot plus the run cwd and task text. Only the whitelisted fields are
 * carried over: prompt text, model output, credentials and full history are dropped.
 */
export function buildCheckpoint({ state, graph, cwd, task } = {}) {
  const s = objectOrEmpty(state);
  const rev = Number.isInteger(s.rev) ? s.rev : 0;

  return {
    schema: CHECKPOINT_SCHEMA,
    instanceId: typeof s.instanceId === 'string' ? s.instanceId : '',
    rev,
    checkpointId: rev,
    writtenAt: new Date().toISOString(),
    coreGeneration: s.coreGeneration ?? null,
    instanceState: typeof s.state === 'string' ? s.state : null,
    paused: Boolean(s.paused),
    halted: Boolean(s.halted),
    template: typeof s.template === 'string' ? s.template : null,
    cwd: typeof cwd === 'string' ? cwd : (typeof s.cwd === 'string' ? s.cwd : null),
    task: typeof task === 'string' ? task : (typeof s.task === 'string' ? s.task : null),
    graph: cloneGraph(graph),
    nodes: asArray(s.nodes).map(projectNode),
    sessions: asArray(s.sessions).map(projectSession),
    handoffs: asArray(s.handoffs).map(projectHandoff),
    escalations: asArray(s.escalations).map(cloneEntry),
    artifactRefs: asArray(s.artifactRefs).map(cloneEntry),
  };
}

async function readPriorId(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Number.isInteger(parsed?.checkpointId) ? parsed.checkpointId : -1;
  } catch {
    return -1;
  }
}

/** Persist a checkpoint atomically; never throws. Failure is reported as {ok:false, code}. */
export async function writeCheckpoint(root, id, checkpoint) {
  try {
    if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
      return { ok: false, code: 'CHECKPOINT_INVALID' };
    }
    const file = checkpointPath(root, id);
    const lastId = await readPriorId(file);
    const incoming = Number.isInteger(checkpoint.checkpointId) ? checkpoint.checkpointId : 0;
    const nextId = Math.max(incoming, lastId + 1);
    const payload = { ...checkpoint, checkpointId: nextId };
    const written = await writeJsonAtomic(file, payload);
    if (!written.ok) {
      return { ok: false, code: written.params?.errno ?? written.code ?? 'CHECKPOINT_WRITE_FAILED' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err?.code ?? 'CHECKPOINT_WRITE_FAILED' };
  }
}

/** Read a checkpoint as a pure read; never writes any file. */
export async function loadCheckpoint(root, id) {
  const file = checkpointPath(root, id);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    const value = objectOrEmpty(parsed);
    if (value.schema !== CHECKPOINT_SCHEMA) return { ok: false, code: UNREADABLE };
    if (value.instanceId !== id) return { ok: false, code: UNREADABLE };
    return { ok: true, checkpoint: parsed };
  } catch {
    return { ok: false, code: UNREADABLE };
  }
}
