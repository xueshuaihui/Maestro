/**
 * Desktop SSE transport and push throttling (I1.10a WP-2; requirement D-2/D-5,
 * split doc 2.1). Two SSE streams plus the test-only pulse seam:
 *
 * - `GET /instances/stream`            -> `instances.changed`, 500ms merged window.
 * - `GET /instances/:id/graph/stream`  -> first frame `graph.snapshot`, then
 *   increments `role_instance.updated` / `connection.updated` /
 *   `special_node.updated`, and `session.indicator` passthrough.
 * - `POST /__test__/graph/pulse`       -> test projection mutations (registered
 *   by http/server.js only when NODE_ENV=test), in-memory only, never touches
 *   disk (requirement 3.6).
 *
 * Every frame body carries at least `{rev, instanceId, type, key, payload}`
 * (D-2). Frame encoding is hand-written `event: <type>\ndata: <json>\n\n`
 * over `node:http` responses; zero npm dependencies.
 *
 * `rev` discipline (AC-08/10): `rev` advances ONLY through the frozen
 * `isRevEvent` whitelist imported from `../graph.js` (batch-1 contract). The
 * session / execution / health event families carry seq numbers that may be
 * larger than `rev`; they are never compared against it and never advance it.
 * `session.indicator` frames pass through verbatim with the current `rev`
 * unchanged and produce no graph frames.
 *
 * Throttling (AC-09/37): role frames are pushed immediately (no queue, no
 * window). Connection frames go through one `createConnectionThrottle` lane
 * per stream, an injectable-clock pure scheduler whose window starts at the
 * FIRST change of a key and is never extended by later changes; the window
 * end emits the last value seen. The role lane and the connection lane share
 * nothing, so a pending connection window can never delay a role frame.
 */

import { EDGE_VISUAL, LABEL_VISIBLE_STATES, isRevEvent } from '../graph.js';

/** Frame history kept per instance for `sinceRev` replay after reconnect. */
const HISTORY_LIMIT = 512;

/** Encodes one SSE frame: `event: <type>\ndata: <json>\n\n` (D-2). */
export function encodeSseFrame(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Parses one raw SSE text block (`event: ...` / `data: ...`) back to an object. */
export function parseSseBlock(block) {
  let eventName = null;
  let data = null;
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) data = line.slice(5).trim();
  }
  if (eventName === null && data === null) return null;
  let payload = null;
  if (data !== null) {
    try {
      payload = JSON.parse(data);
    } catch {
      payload = null;
    }
  }
  return { event: eventName, data: payload, raw: data };
}

/**
 * Injectable-clock pure scheduler for connection-line merging (AC-09).
 *
 * The window for a key starts at its FIRST `push` and lasts exactly
 * `windowMs`; later pushes within the window only replace the pending value
 * and never move the fire time. When the window ends, `emit(key, payload)`
 * fires once with the last value. A key with a single change still fires at
 * the window end, so the first change is never lost (D-5).
 *
 * `now`, `setTimer` and `clearTimer` are all injectable so unit tests can
 * step a virtual clock across the 1000/1001ms boundary without any real
 * racing (split doc risk 4).
 */
export function createConnectionThrottle({
  windowMs = 1000,
  now,
  setTimer,
  clearTimer,
  emit,
} = {}) {
  if (typeof emit !== 'function') {
    throw new TypeError('createConnectionThrottle: emit must be a function');
  }
  const clock = typeof now === 'function' ? now : Date.now;
  const schedule =
    typeof setTimer === 'function'
      ? setTimer
      : (fn, delayMs) => {
          const timer = setTimeout(fn, delayMs);
          if (typeof timer.unref === 'function') timer.unref();
          return timer;
        };
  const cancel =
    typeof clearTimer === 'function' ? clearTimer : (timer) => clearTimeout(timer);

  /** @type {Map<string, {payload: object, timer: any}>} */
  const pending = new Map();

  function fire(key) {
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    emit(key, entry.payload);
  }

  /**
   * Registers one change. Returns `true` when this push OPENED a new window
   * for the key, `false` when an existing window just got a new last value.
   */
  function push(key, payload) {
    const existing = pending.get(key);
    if (existing) {
      existing.payload = payload; // last value wins; window is NOT extended
      return false;
    }
    const entry = { payload, timer: null };
    pending.set(key, entry);
    entry.timer = schedule(() => fire(key), windowMs);
    return true;
  }

  /** Fires every pending window immediately (used on shutdown). */
  function flush() {
    for (const key of [...pending.keys()]) fire(key);
  }

  function close() {
    for (const entry of pending.values()) {
      cancel(entry.timer);
    }
    pending.clear();
  }

  return { push, flush, close, pendingCount: () => pending.size };
}

function writeSse(res, eventName, data) {
  if (res.destroyed || res.writableEnded) return;
  res.write(encodeSseFrame(eventName, data));
}

function sendSseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
}

function roleFramePayload(node) {
  return {
    status: node.status,
    statusReason: node.statusReason,
    activeSessions: node.activeSessions,
    servingNodes: node.servingNodes,
    hostIcons: node.hostIcons,
    abnormal: node.abnormal,
    abnormalCount: node.abnormalCount,
    lastActivity: node.lastActivity,
  };
}

function edgeFramePayload(edge) {
  return {
    aggregateStatus: edge.aggregateStatus,
    visual: edge.visual,
    parallelCount: edge.parallelCount,
    latestRound: edge.latestRound,
    handoffIds: edge.handoffIds,
    labelVisible: edge.labelVisible,
  };
}

function specialFramePayload(node) {
  return {
    status: node.status,
    abnormal: node.abnormal,
    abnormalCount: node.abnormalCount,
    memberCount: node.memberCount,
    collapsed: node.collapsed,
  };
}

/**
 * The stream hub. `buildGraphSnapshot({ instanceId })` is injected by
 * http/server.js: it reads the instance through the injected read-only
 * readers, resolves the workflow definition and returns
 * `{ok:true, graph, raw}` (the raw snapshot state ships alongside so events
 * can be mapped onto projected nodes without a second read).
 */
export function createStreamHub({ bus, buildGraphSnapshot, clock } = {}) {
  if (!bus || typeof bus.subscribe !== 'function') {
    throw new TypeError('createStreamHub: bus must implement subscribe');
  }
  if (typeof buildGraphSnapshot !== 'function') {
    throw new TypeError('createStreamHub: buildGraphSnapshot must be a function');
  }
  const now = typeof clock === 'function' ? clock : Date.now;

  /** @type {Set<{res, instanceId, ready, queue, unsubscribe, throttle, cleanups}>} */
  const graphStreams = new Set();
  /** @type {Set<{res, unsubscribe, cleanups}>} */
  const listStreams = new Set();

  /** Latest known rev per instance (whitelist events and pulse steps only). */
  const revByInstance = new Map();
  /** In-memory pulse sequence per instance (test projection, never on disk). */
  const pulseSeqByInstance = new Map();
  /**
   * Test projection overlay per instance (pulse seam, requirement 3.6): role
   * status patches and edge aggregate patches applied on top of every freshly
   * built graph. In-memory only; `state.json` / `events.jsonl` never change
   * (AC-27 hash discipline).
   */
  const overlayByInstance = new Map();
  /** Frame history per instance for `sinceRev` replay (whitelist frames only). */
  const historyByInstance = new Map();

  /** @type {Map<string, Promise<void>>} per-instance serial dispatch chains */
  const chains = new Map();

  /** Max whitelist seq seen across all instances, for list-stream frames. */
  let listRev = 0;

  // One shared 500ms lane for the list stream: every whitelist event bumps
  // the single 'instances' key; the window end emits to all list streams.
  const listThrottle = createConnectionThrottle({
    windowMs: 500,
    now,
    emit: () => {
      const data = {
        rev: listRev,
        instanceId: null,
        type: 'instances.changed',
        key: null,
        payload: {},
      };
      for (const stream of [...listStreams]) {
        writeSse(stream.res, 'instances.changed', data);
      }
    },
  });

  function overlayFor(instanceId) {
    let overlay = overlayByInstance.get(instanceId);
    if (!overlay) {
      overlay = { roles: new Map(), edges: new Map() };
      overlayByInstance.set(instanceId, overlay);
    }
    return overlay;
  }

  /** Applies the in-memory test projection on top of a freshly built graph. */
  function applyTestOverlay(graph, instanceId) {
    const overlay = overlayByInstance.get(instanceId);
    if (!overlay) return graph;
    for (const node of graph.nodes) {
      const patch =
        (node.roleId !== null && overlay.roles.get(node.roleId)) ||
        overlay.roles.get(node.id);
      if (patch && node.type === 'role') {
        node.status = patch.status;
      }
    }
    for (const edge of graph.edges) {
      const patch = overlay.edges.get(edge.id);
      if (patch) {
        edge.aggregateStatus = patch.aggregateStatus;
        edge.visual = EDGE_VISUAL[patch.aggregateStatus] ?? edge.visual;
        edge.labelVisible = LABEL_VISIBLE_STATES.has(patch.aggregateStatus);
      }
    }
    return graph;
  }

  /** The pulse contribution to rev (in-memory test projection sequence). */
  function testRev(instanceId) {
    return pulseSeqByInstance.get(instanceId) ?? 0;
  }

  function rememberRev(instanceId, rev) {
    const current = revByInstance.get(instanceId) ?? 0;
    if (Number.isInteger(rev) && rev > current) revByInstance.set(instanceId, rev);
    if (Number.isInteger(rev) && rev > listRev) listRev = rev;
  }

  function pushHistory(instanceId, rev, eventName, data) {
    let history = historyByInstance.get(instanceId);
    if (!history) {
      history = [];
      historyByInstance.set(instanceId, history);
    }
    history.push({ rev, eventName, data });
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
  }

  /** Serial execution per instance: dispatches and snapshot builds never
   * interleave, so frames keep their order and no build-gap queue is needed. */
  function enqueue(instanceId, task) {
    const previous = chains.get(instanceId) ?? Promise.resolve();
    const next = previous.then(task, task);
    chains.set(instanceId, next.catch(() => {}));
    return next;
  }

  /**
   * Single dispatch path shared by the bus subscription and the pulse seam:
   * there is no second data source anywhere.
   */
  function dispatchEvent(instanceId, event) {
    return enqueue(instanceId, () => handleEvent(instanceId, event));
  }

  async function handleEvent(instanceId, event) {
    if (!event || typeof event !== 'object') return;

    // Session family: indicator passthrough only, rev never moves (AC-10).
    if (event.object === 'session') {
      if (event.reason === 'execution.summary') return; // excluded by D-2
      const rev = revByInstance.get(instanceId) ?? 0;
      const data = {
        rev,
        instanceId,
        type: 'session.indicator',
        key: typeof event.objectId === 'string' ? event.objectId : null,
        payload: { state: event.to ?? event.detail?.state ?? null },
      };
      fanOut(instanceId, { kind: 'session', eventName: 'session.indicator', data });
      return;
    }
    // Health family produces no frames at all (D-2 increment list).
    if (event.object === 'health') return;
    // Anything outside the frozen whitelist never advances rev (AC-08/10).
    if (!isRevEvent(event)) return;

    // Synthesized pulse events carry no disk seq: give them the next
    // in-memory pulse sequence above the current rev so rev stays monotonic
    // within the projection (disk events and pulse steps share one ladder).
    if (!Number.isInteger(event.seq)) {
      const nextPulseSeq =
        Math.max(revByInstance.get(instanceId) ?? 0, pulseSeqByInstance.get(instanceId) ?? 0) + 1;
      pulseSeqByInstance.set(instanceId, nextPulseSeq);
      event.seq = nextPulseSeq;
    }
    rememberRev(instanceId, event.seq);
    const rev = revByInstance.get(instanceId) ?? event.seq;

    // Instance-level whitelist events advance rev but draw no element frame
    // (the D-2 increment list has no instance.updated event type).
    if (event.object === 'instance') return;

    const built = await buildGraphSnapshot({ instanceId });
    if (!built || built.ok !== true) return; // unreadable snapshot: no frames
    const { graph, raw } = built;
    const frame = elementFrame(event, graph, raw);
    if (!frame) return;
    const data = { rev, instanceId, type: frame.type, key: frame.key, payload: frame.payload };

    if (frame.type !== 'session.indicator') {
      pushHistory(instanceId, rev, frame.type, data);
    }
    fanOut(instanceId, {
      kind: frame.type === 'connection.updated' ? 'connection' : 'immediate',
      eventName: frame.type,
      data,
    });
  }

  /**
   * Fan one computed frame out to every graph stream of the instance.
   * Connection frames enter the per-stream merge lane; everything else is
   * written immediately. Streams still building their first snapshot queue
   * the frame as a safety net (dispatch chains make this nearly impossible).
   */
  function fanOut(instanceId, { kind, eventName, data }) {
    for (const stream of [...graphStreams]) {
      if (stream.instanceId !== instanceId) continue;
      if (stream.ready) {
        if (kind === 'connection') stream.throttle.push(data.key, { eventName, data });
        else writeSse(stream.res, eventName, data);
      } else {
        stream.queue.push({ kind, eventName, data });
      }
    }
  }

  /** Maps one whitelisted bus event onto its single element frame. */
  function elementFrame(event, graph, raw) {
    if (event.object === 'handoff') {
      const edgeKey = typeof event.detail?.edgeKey === 'string' ? event.detail.edgeKey : null;
      const edge = edgeKey
        ? graph.edges.find((candidate) => candidate.id === edgeKey)
        : graph.edges.find(
            (candidate) =>
              Array.isArray(candidate.handoffIds) && candidate.handoffIds.includes(event.objectId),
          );
      if (!edge) return null;
      return { type: 'connection.updated', key: edge.id, payload: edgeFramePayload(edge) };
    }

    if (event.object === 'node' || event.object === 'special_node' || event.object === 'escalation') {
      const node = locateNode(event, graph, raw);
      if (!node) return null;
      if (node.type === 'role') {
        return { type: 'role_instance.updated', key: node.id, payload: roleFramePayload(node) };
      }
      return { type: 'special_node.updated', key: node.id, payload: specialFramePayload(node) };
    }
    return null;
  }

  function locateNode(event, graph, raw) {
    const objectId = typeof event.objectId === 'string' ? event.objectId : null;
    if (objectId === null) return null;
    // Snapshot node id -> role instance projection (`role:<roleId>`).
    const stateNode = (Array.isArray(raw?.nodes) ? raw.nodes : []).find(
      (candidate) => (candidate?.nodeId ?? candidate?.id) === objectId,
    );
    if (stateNode && typeof stateNode.roleId === 'string') {
      const roleNode = graph.nodes.find((candidate) => candidate.id === `role:${stateNode.roleId}`);
      if (roleNode) return roleNode;
    }
    // Fall back to direct matches: role id, projected node id, or pulse key.
    return (
      graph.nodes.find((candidate) => candidate.roleId === objectId) ??
      graph.nodes.find((candidate) => candidate.id === objectId) ??
      null
    );
  }

  function cleanupStream(stream, streams) {
    streams.delete(stream);
    try {
      stream.unsubscribe();
    } catch {
      // already torn down
    }
    for (const cleanup of stream.cleanups) cleanup();
  }

  /** `GET /instances/stream`: `instances.changed`, 500ms merged (D-2). */
  function handleListStream(res) {
    const stream = { res, unsubscribe: null, cleanups: [] };
    stream.unsubscribe = bus.subscribe((event) => {
      // Only whitelist events trigger a list refresh; session/execution/
      // health noise must not cause refetches.
      if (event && typeof event === 'object' && isRevEvent(event)) {
        if (Number.isInteger(event.seq) && event.seq > listRev) listRev = event.seq;
        listThrottle.push('instances', { seq: event.seq ?? null });
      }
    }, { instanceId: null });
    listStreams.add(stream);
    sendSseHeaders(res);
    res.on('close', () => {
      cleanupStream(stream, listStreams);
    });
    return res;
  }

  /**
   * `GET /instances/:id/graph/stream` (D-2): first frame `graph.snapshot`
   * (always, including reconnects), then increments with `rev > sinceRev`
   * replayed from the in-memory history, then live frames. The snapshot
   * build runs inside the per-instance dispatch chain, so no event can slip
   * between the snapshot and the live subscription.
   */
  async function handleGraphStream(res, { instanceId, sinceRev } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'NOT_FOUND' }));
      return res;
    }

    const stream = {
      res,
      instanceId,
      ready: false,
      queue: [],
      unsubscribe: null,
      cleanups: [],
      throttle: createConnectionThrottle({
        windowMs: 1000,
        now,
        emit: (key, payload) => {
          void key;
          writeSse(res, payload.eventName, payload.data);
        },
      }),
    };
    graphStreams.add(stream);
    stream.unsubscribe = bus.subscribe((event) => {
      dispatchEvent(instanceId, event);
    }, { instanceId });
    res.on('close', () => {
      stream.throttle.close();
      cleanupStream(stream, graphStreams);
    });

    // Build inside the dispatch chain: pending dispatches finish first,
    // later dispatches wait until the snapshot is flushed.
    const built = await enqueue(instanceId, () => buildGraphSnapshot({ instanceId }));
    if (!built || built.ok !== true) {
      stream.throttle.close();
      cleanupStream(stream, graphStreams);
      const code = built?.code === 'STATE_CORRUPT' ? 'STATE_CORRUPT' : 'NOT_FOUND';
      const status = code === 'STATE_CORRUPT' ? 422 : 404;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: code }));
      return res;
    }

    const graph = built.graph;
    const snapshotRev = Math.max(graph.rev, testRev(instanceId));
    rememberRev(instanceId, snapshotRev);
    const data = { rev: snapshotRev, instanceId, type: 'snapshot', key: null, payload: graph };
    sendSseHeaders(res);
    writeSse(res, 'graph.snapshot', data);

    if (Number.isFinite(sinceRev) && sinceRev >= 0) {
      const history = historyByInstance.get(instanceId) ?? [];
      for (const entry of history) {
        if (entry.rev > sinceRev) writeSse(res, entry.eventName, entry.data);
      }
    }

    stream.ready = true;
    // Safety net: frames dispatched while the build was still running.
    const queued = stream.queue.splice(0, stream.queue.length);
    for (const frameEntry of queued) {
      if (frameEntry.kind === 'connection') {
        stream.throttle.push(frameEntry.data.key, {
          eventName: frameEntry.eventName,
          data: frameEntry.data,
        });
      } else {
        writeSse(res, frameEntry.eventName, frameEntry.data);
      }
    }
    return res;
  }

  /**
   * `POST /__test__/graph/pulse` handler (registered by http/server.js only
   * when NODE_ENV=test). Body: `{instanceId, kind, key, count, intervalMs,
   * statuses}`. Mutates the in-memory test projection and feeds synthesized
   * events through the same dispatch path as bus events; never writes disk.
   */
  async function handlePulse(req, res) {
    const body = await readBody(req, 32 * 1024);
    let params = null;
    try {
      params = body.length > 0 ? JSON.parse(body.toString('utf8')) : null;
    } catch {
      params = null;
    }
    const instanceId = typeof params?.instanceId === 'string' ? params.instanceId : null;
    const kind = params?.kind;
    const key = typeof params?.key === 'string' && params.key.length > 0 ? params.key : null;
    if (!instanceId || !['role', 'connection', 'session'].includes(kind)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'BAD_PARAMS' }));
      return res;
    }
    if (kind !== 'session' && key === null) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'BAD_PARAMS' }));
      return res;
    }
    const count = Number.isInteger(params?.count) && params.count > 0 ? params.count : 1;
    const intervalMs =
      Number.isFinite(params?.intervalMs) && params.intervalMs >= 0 ? params.intervalMs : 0;
    const statuses = Array.isArray(params?.statuses) ? params.statuses : [];

    const overlay = overlayFor(instanceId);
    let injected = 0;
    for (let index = 0; index < count; index += 1) {
      const at = index * intervalMs;
      const fire = () => {
        injected += 1;
        const status =
          typeof statuses[index] === 'string' && statuses[index].length > 0
            ? statuses[index]
            : null;
        if (kind === 'role') {
          overlay.roles.set(key, { status: status ?? 'serving' });
          dispatchEvent(instanceId, {
            object: 'node',
            objectId: key,
            from: 'pulse',
            to: status ?? 'serving',
            reason: 'pulse.role',
            detail: { pulse: 'role' },
          });
        } else if (kind === 'connection') {
          overlay.edges.set(key, { aggregateStatus: status ?? 'pending' });
          dispatchEvent(instanceId, {
            object: 'handoff',
            objectId: `pulse-${key}-${index}`,
            from: null,
            to: null,
            reason: 'pulse.connection',
            detail: { pulse: 'connection', edgeKey: key },
          });
        } else {
          dispatchEvent(instanceId, {
            object: 'session',
            objectId: key ?? `pulse-session-${index + 1}`,
            from: null,
            to: status ?? 'tool_running',
            reason: 'session.state',
            detail: { pulse: 'session' },
          });
        }
      };
      if (at === 0) fire();
      else setTimeout(fire, at);
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, injected }));
    return res;
  }

  function close() {
    listThrottle.close();
    for (const stream of [...graphStreams]) {
      stream.throttle.close();
      cleanupStream(stream, graphStreams);
      if (!stream.res.destroyed) stream.res.end();
    }
    for (const stream of [...listStreams]) {
      cleanupStream(stream, listStreams);
      if (!stream.res.destroyed) stream.res.end();
    }
    graphStreams.clear();
    listStreams.clear();
    revByInstance.clear();
    pulseSeqByInstance.clear();
    overlayByInstance.clear();
    historyByInstance.clear();
    chains.clear();
    listRev = 0;
  }

  return {
    handleListStream,
    handleGraphStream,
    handlePulse,
    applyTestOverlay,
    testRev,
    close,
  };
}

/** Reads a request body with a hard cap (D-2: 32KB limit). */
export function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      if (error) reject(error);
      else resolve(value);
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        finish(Object.assign(new Error('PAYLOAD_TOO_LARGE'), { code: 'PAYLOAD_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(null, Buffer.concat(chunks)));
    req.on('error', (err) => finish(err));
  });
}
