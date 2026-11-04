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
    if (!corrupt) return { ok: true, state: parsed };

    const marked = await markCorrupt(id);
    return {
      ok: false,
      code: 'STATE_CORRUPT',
      backupPath: marked.ok ? marked.backupPath : null,
      params: { path: file },
    };
  }

  /**
   * 读磁盘上的实例状态；仅用于 save 的比较并交换（不触发损坏备份）。
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
   * `opts.expectedState`（可选）：比较并交换 —— 磁盘上现有 `state.state` 与它不一致时
   * 不写，返回 `STORE_CONFLICT`。不传时行为与旧实现完全一致（最后写者胜）。
   */
  async function save(id, state, opts = {}) {
    return enqueueSave(id, () => persist(id, state, opts));
  }

  async function persist(id, state, opts = {}) {
    if (writeBlocked.has(id)) {
      return { ok: false, code: 'STORE_WRITE_BLOCKED_CORRUPT', params: { path: statePath(root, id) } };
    }
    if (state === null || typeof state !== 'object' || Array.isArray(state)) {
      return { ok: false, code: 'STORE_WRITE_FAILED', params: { errno: 'EINVAL', path: statePath(root, id) } };
    }

    if (Object.prototype.hasOwnProperty.call(opts, 'expectedState')) {
      const disk = await readDiskState(id);
      const actual = disk.ok ? disk.state.state ?? null : null;
      if (actual !== opts.expectedState) {
        return {
          ok: false,
          code: 'STORE_CONFLICT',
          params: { expected: opts.expectedState, actual, path: statePath(root, id) },
        };
      }
    }

    // 快照每次落盘都刷新 updatedAt（§3.1），返回值与入参保持同一时刻。
    const updatedAt = new Date().toISOString();
    state.updatedAt = updatedAt;

    const written = await writeJsonAtomic(statePath(root, id), state);
    if (!written.ok) {
      return { ok: false, code: 'STORE_WRITE_FAILED', params: written.params };
    }
    return { ok: true, updatedAt };
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
        // 损坏实例仍然可见（不能假装"没有这个实例"），但标记不可读并阻断后续写入。
        await markCorrupt(id);
        let mtime = null;
        try {
          mtime = (await fs.stat(file)).mtime.toISOString();
        } catch {
          mtime = null;
        }
        items.push(emptyItem(id, mtime));
        continue;
      }

      items.push({
        instanceId: id,
        state: parsed.state ?? null,
        nodeState: parsed.node?.state ?? null,
        sessionState: parsed.session?.state ?? null,
        handoffState: parsed.handoff?.state ?? null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        readable: true,
      });
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

function emptyItem(instanceId, updatedAt) {
  return {
    instanceId,
    state: null,
    nodeState: null,
    sessionState: null,
    handoffState: null,
    updatedAt,
    readable: false,
  };
}
