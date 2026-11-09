/**
 * 实例持久化：`state.json`（快照、原子写）+ `events.jsonl`（整行追加）（§2.11 / §1.4）。
 *
 * 两条硬规则：
 * 1. 事件整行一次追加，不用 writeStream、不缓冲多行 —— 崩溃/强杀时不能丢行（NFR-03）。
 * 2. 快照损坏时**复制**为 `state.json.corrupt` 并保留原文件，随后该实例写入被阻断，
 *    直到人工处理（AC-13 / BR-16）。绝不静默清空或重建。
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import {
  corruptPath,
  eventsPath,
  instanceDir,
  instancesDir,
  statePath,
} from './paths.js';
import { copyToBackup, writeJsonAtomic } from './atomic-write.js';

/**
 * 快照可读的最小判据：必须是对象，且 `schemaVersion` 与 `instanceId` 都在。
 * 只校验存在性，不校验取值 —— 取值错误属于业务问题，不该触发"损坏备份"。
 */
function isReadableState(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.schemaVersion !== undefined &&
    value.schemaVersion !== null &&
    typeof value.instanceId === 'string' &&
    value.instanceId.length > 0
  );
}

function readFailed(err, filePath) {
  return { ok: false, code: 'STORE_READ_FAILED', params: { errno: err?.code ?? null, path: filePath } };
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * 磁盘快照的 CAS 摘要。缺字段按「未写」处理（`rev` 缺失视为 0），不抛错 ——
 * v1 快照没有 `halted` / `rev` / `paused`，读取方不应该因为字段缺失而失败。
 */
function casSnapshot(snapshot) {
  return {
    state: snapshot?.state ?? null,
    halted: Boolean(snapshot?.halted),
    rev: Number.isInteger(snapshot?.rev) ? snapshot.rev : 0,
    // 'paused' 参与 CAS 比较；旧快照缺字段时按 false（D-7.1）。
    paused: Boolean(snapshot?.paused),
  };
}

/**
 * 逐字段比较，**只比 `expected` 里显式提供了的键**（便于「只写 halted」这类窄条件写）。
 *
 * - `string`：v1 旧语义，只比 `disk.state.state`；冲突时 `actual` 也是字符串（旧断言不变）。
 * - `{state?, halted?, rev?, paused?}`：v2 新语义；冲突时 `actual` 是四元摘要。
 * - 其他形状（null / 数字 / 数组）：一律按冲突处理，绝不静默放行。
 *
 * `paused` 只在调用方显式提供时才比较，既有调用行为不变（D-7.1）。
 *
 * @returns {null | {expected:any, actual:any}}
 */
function compareExpected(expected, actual) {
  if (typeof expected === 'string') {
    return actual.state === expected ? null : { expected, actual: actual.state };
  }
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    return { expected, actual };
  }
  const mismatch =
    (hasOwn(expected, 'state') && actual.state !== expected.state) ||
    (hasOwn(expected, 'halted') && actual.halted !== Boolean(expected.halted)) ||
    (hasOwn(expected, 'rev') && actual.rev !== expected.rev) ||
    (hasOwn(expected, 'paused') && actual.paused !== Boolean(expected.paused));
  return mismatch ? { expected, actual } : null;
}

export function createStore({ root } = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('createStore: root 必填');
  }

  // 本次进程生命周期内被判定损坏的实例：恒阻断写入，重启后由下一次 load 重新判定。
  const writeBlocked = new Set();
  // 单实例追加串行化：避免并发 appendFile 在同一文件上交错行。
  const appendChains = new Map();
  // 单实例快照串行化：让 CAS 的“读 → 比较 → 写”在同一进程内不被打断。
  const saveChains = new Map();
  // 已知的整快照版本：只在内存里缓存，作为读盘失败时的补充（`rev` 基准优先取磁盘现值）。
  const revCache = new Map();

  function enqueueSave(id, task) {
    const previous = saveChains.get(id) ?? Promise.resolve();
    const next = previous.then(task, task);
    const guard = next.catch(() => {});
    saveChains.set(id, guard);
    guard.then(() => {
      if (saveChains.get(id) === guard) saveChains.delete(id);
    });
    return next;
  }

  /**
   * 复制快照为 `state.json.corrupt`，并把该实例加入写入阻断集合。
   * 原 `state.json` 保持原字节不变。
   */
  async function markCorrupt(id) {
    const src = statePath(root, id);
    const dst = corruptPath(root, id);
    const copied = await copyToBackup(src, dst);
    writeBlocked.add(id);
    if (!copied.ok) return { ok: false, code: copied.code, params: copied.params };
    return { ok: true, backupPath: dst };
  }

  async function load(id) {
    const file = statePath(root, id);
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch (err) {
      if (err?.code === 'ENOENT') return { ok: false, code: 'NOT_FOUND', params: { path: file } };
      return readFailed(err, file);
    }

    let parsed = null;
    let corrupt = false;
    try {
      parsed = JSON.parse(text);
    } catch {
      corrupt = true;
    }
    if (!corrupt && !isReadableState(parsed)) corrupt = true;
    if (!corrupt) {
      // 只登记内存里的版本，不写盘：v1 快照「看也不改」（AC-20）。
      revCache.set(id, Number.isInteger(parsed.rev) ? parsed.rev : 0);
      return { ok: true, state: parsed };
    }

    const marked = await markCorrupt(id);
    return {
      ok: false,
      code: 'STATE_CORRUPT',
      backupPath: marked.ok ? marked.backupPath : null,
      params: { path: file },
    };
  }

  /**
   * 读磁盘上的实例状态；save 用它取重放前值（CAS 比较 / 无 CAS 时的 rev 基准），
   * 不触发损坏备份。
   * @returns {Promise<{ok:true, state:object}|{ok:false}>}
   */
  async function readDiskState(id) {
    try {
      const text = await fs.readFile(statePath(root, id), 'utf8');
      const parsed = JSON.parse(text);
      if (!isReadableState(parsed)) return { ok: false };
      return { ok: true, state: parsed };
    } catch {
      return { ok: false };
    }
  }

  /**
   * 落盘快照。
   *
   * `opts.expectedState`（可选）：比较并交换 —— 与磁盘现值不符时不写，返回 `STORE_CONFLICT`。
   * - `string`（I1.1 旧语义）：只比磁盘 `state.state`；
   * - `{state?, halted?, rev?, paused?}`（v2）：逐字段比较**提供了的键**；
   * - `function(diskState) → 上述任一形状`：在队列任务内、**读盘之后写盘之前**求值
   *   （D-7.2 的 pause/resume 写序列：期望值必须取读盘现值，排队期间 `rev` 变化不算冲突）。
   *   函数抛错按写失败处理（`errno: 'EXPECTED_FN'`），绝不当成 CAS 通过。
   * 不传时与旧实现行为一致（最后写者胜，不做 CAS 比较），但**仍然读盘取前值**——
   * `rev` 必须全局单调，不能因为内存缓存未命中就回落到 0（进程重启后首个无 CAS 写
   * 会把 `rev` 打回 1，后续 `expectedState:{rev}` 全部误判）。
   *
   * 每次成功写入把 `state.rev` 置为 `prevRev + 1`，`prevRev` 一律以**磁盘现值为准**
   * （读盘失败才退回内存缓存 / 入参快照自带的 `rev` / 0），并在返回值里回报。
   */
  async function save(id, state, opts = {}) {
    return enqueueSave(id, () => persist(id, state, opts));
  }

  /**
   * 无 CAS 比较时的前值来源：**磁盘现值优先**，读不到才退回内存缓存 → 入参快照自带 rev → 0。
   *
   * 缓存只当"读盘失败时的补充"，且与磁盘取较大值 —— 缓存命中也不能让 `rev` 回退
   * （例如另一进程已经写过更大的 `rev`）。
   */
  function knownRev(id, state, diskRev) {
    let prev = 0;
    if (Number.isInteger(diskRev)) prev = diskRev;
    const cached = revCache.get(id);
    if (Number.isInteger(cached) && cached > prev) prev = cached;
    if (Number.isInteger(state.rev) && state.rev > prev) prev = state.rev;
    return prev;
  }

  async function persist(id, state, opts = {}) {
    if (writeBlocked.has(id)) {
      return { ok: false, code: 'STORE_WRITE_BLOCKED_CORRUPT', params: { path: statePath(root, id) } };
    }
    const file = statePath(root, id);
    if (state === null || typeof state !== 'object' || Array.isArray(state)) {
      return { ok: false, code: 'STORE_WRITE_FAILED', params: { errno: 'EINVAL', path: file } };
    }

    // 任何形态都先读一次盘：CAS 要拿它比较，"不带 expectedState"要拿它做 rev 基准。
    const disk = await readDiskState(id);
    const actual = casSnapshot(disk.ok ? disk.state : null);
    const diskRev = disk.ok ? actual.rev : null;

    let prevRev = null;
    if (hasOwn(opts, 'expectedState')) {
      let expected = opts.expectedState;
      if (typeof expected === 'function') {
        // 取值函数在队列任务内、读盘之后求值：pause/resume 用它把 'paused' 的期望值
        // 取成读盘现值，排队期间 rev 变化不产生假冲突（D-7.2）。
        try {
          expected = expected(disk.ok ? disk.state : null);
        } catch {
          // 取值函数本身失败：既不能放行，也不能当成冲突（那会诱发无意义重试）。
          return { ok: false, code: 'STORE_WRITE_FAILED', params: { errno: 'EXPECTED_FN', path: file } };
        }
      }
      const conflict = compareExpected(expected, actual);
      if (conflict) {
        // 冲突不写盘：原文件字节保持不变。
        return {
          ok: false,
          code: 'STORE_CONFLICT',
          params: { expected: conflict.expected, actual: conflict.actual, path: file },
        };
      }
      prevRev = actual.rev;
    }
    if (prevRev === null) prevRev = knownRev(id, state, diskRev);

    const rev = prevRev + 1;
    // 快照每次落盘都刷新 updatedAt（§3.1），返回值与入参保持同一时刻。
    const updatedAt = new Date().toISOString();
    state.updatedAt = updatedAt;
    state.rev = rev;

    const written = await writeJsonAtomic(file, state);
    if (!written.ok) {
      return { ok: false, code: 'STORE_WRITE_FAILED', params: written.params };
    }
    revCache.set(id, rev);
    return { ok: true, updatedAt, rev };
  }

  function appendEvent(id, ev) {
    if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) {
      return Promise.resolve({
        ok: false,
        code: 'STORE_WRITE_FAILED',
        params: { errno: 'EINVAL', path: eventsPath(root, id) },
      });
    }

    const previous = appendChains.get(id) ?? Promise.resolve();
    const task = () => doAppend(id, ev);
    const next = previous.then(task, task);
    // 链上只保留"已消化异常"的守卫版，避免一次失败让后续追加全部短路。
    const guard = next.catch(() => {});
    appendChains.set(id, guard);
    guard.then(() => {
      if (appendChains.get(id) === guard) appendChains.delete(id);
    });
    return next;
  }

  async function doAppend(id, ev) {
    const file = eventsPath(root, id);
    try {
      await fs.mkdir(instanceDir(root, id), { recursive: true });
      // 单次整行追加：一行一个 syscall，不做多行缓冲。
      await fs.appendFile(file, `${JSON.stringify(ev)}\n`, 'utf8');
    } catch (err) {
      return { ok: false, code: 'STORE_WRITE_FAILED', params: { errno: err?.code ?? null, path: file } };
    }
    return { ok: true, seq: ev?.seq ?? null };
  }

  async function readEvents(id) {
    const file = eventsPath(root, id);
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch (err) {
      if (err?.code === 'ENOENT') return { ok: true, events: [], badLines: 0 };
      return readFailed(err, file);
    }

    const events = [];
    let badLines = 0;
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (line === '') continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // 单行损坏只跳过并计数，不让整份事件记录不可读（历史仍可复盘）。
        badLines += 1;
      }
    }
    return { ok: true, events, badLines };
  }

  async function list() {
    const dir = instancesDir(root);
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err?.code === 'ENOENT') return { ok: true, items: [] };
      return readFailed(err, dir);
    }

    const items = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const file = statePath(root, id);

      let text;
      try {
        text = await fs.readFile(file, 'utf8');
      } catch (err) {
        if (err?.code === 'ENOENT') {
          // 半截实例：只有 events.jsonl、没有 state.json —— 不进列表（§2.12）。
          continue;
        }
        items.push(emptyItem(id, null));
        continue;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      if (!isReadableState(parsed)) {
        // 损坏实例仍然可见（不能假装"没有这个实例"），但只在**内存**里标记写入阻断：
        // 读路径不写任何文件（评审 S-9），`.corrupt` 备份只由显式 load 失败路径产生。
        writeBlocked.add(id);
        let mtime = null;
        try {
          mtime = (await fs.stat(file)).mtime.toISOString();
        } catch {
          mtime = null;
        }
        items.push(emptyItem(id, mtime));
        continue;
      }

      revCache.set(id, Number.isInteger(parsed.rev) ? parsed.rev : 0);
      items.push(projectItem(root, id, parsed));
    }

    items.sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0));
    return { ok: true, items };
  }

  /**
   * 下一个可用序号：读 `events.jsonl` 末行 `seq` + 1；空文件/文件不存在返回 1。
   * 末行若是半行或坏行，则继续向前找最近一条可解析的 seq —— 强杀留下的半行不应让
   * 序号回到 1（否则会与已有行重复）。
   */
  function nextSeq(id) {
    let text;
    try {
      text = fsSync.readFileSync(eventsPath(root, id), 'utf8');
    } catch {
      return 1;
    }
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i].trim();
      if (line === '') continue;
      try {
        const ev = JSON.parse(line);
        if (Number.isInteger(ev?.seq)) return ev.seq + 1;
      } catch {
        // 末行可能被强杀截断，继续往前找。
      }
    }
    return 1;
  }

  return { root, load, save, appendEvent, readEvents, list, markCorrupt, nextSeq };
}

/**
 * `list()` 的只读投影：只取摘要字段，**不复制数组元素**（大对象留在原快照里）。
 *
 * v2 读数组（`nodes[0]` / 最后一个会话 / 最后一张交接包 / `escalations` 计数）；
 * v1 读单对象，`template` 固定 `single`、`pendingEscalations` 为 0。
 * `paused` / `approvals` / `pendingApprovals` 对旧快照缺省为 `false` / `[]` / `0`。
 * 任何字段缺失都退化成 `null` / `0`，不抛错。
 */
function projectItem(root, id, snapshot) {
  const schemaVersion = Number.isInteger(snapshot.schemaVersion) ? snapshot.schemaVersion : 1;
  const isV2 = schemaVersion >= 2;
  const nodes = isV2 && Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const sessions = isV2 && Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  const handoffs = isV2 && Array.isArray(snapshot.handoffs) ? snapshot.handoffs : [];
  const escalations = isV2 && Array.isArray(snapshot.escalations) ? snapshot.escalations : [];
  const approvals = isV2 && Array.isArray(snapshot.approvals) ? snapshot.approvals : [];

  let pendingEscalations = 0;
  if (isV2) {
    for (const escalation of escalations) {
      if (escalation?.state === 'pending') pendingEscalations += 1;
    }
  }

  let pendingApprovals = 0;
  for (const approval of approvals) {
    if (approval?.state === 'pending') pendingApprovals += 1;
  }

  return {
    instanceId: id,
    schemaVersion,
    template: isV2 ? (typeof snapshot.template === 'string' ? snapshot.template : null) : 'single',
    // v1 快照可能自带 cwd；缺失时退回项目根（实例目录 `.orch/instances/<id>` 的上级祖先）。
    cwd: typeof snapshot.cwd === 'string' && snapshot.cwd.length > 0 ? snapshot.cwd : root,
    state: snapshot.state ?? null,
    paused: Boolean(snapshot.paused),
    nodeState: isV2 ? (nodes[0]?.state ?? null) : (snapshot.node?.state ?? null),
    sessionState: isV2
      ? (sessions[sessions.length - 1]?.state ?? null)
      : (snapshot.session?.state ?? null),
    handoffState: isV2
      ? (handoffs[handoffs.length - 1]?.state ?? null)
      : (snapshot.handoff?.state ?? null),
    pendingEscalations,
    approvals,
    pendingApprovals,
    updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : null,
    readable: true,
  };
}

function emptyItem(instanceId, updatedAt) {
  return {
    instanceId,
    schemaVersion: null,
    template: null,
    cwd: null,
    state: null,
    paused: false,
    nodeState: null,
    sessionState: null,
    handoffState: null,
    pendingEscalations: 0,
    approvals: [],
    pendingApprovals: 0,
    updatedAt,
    readable: false,
  };
}
