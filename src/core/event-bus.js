/**
 * 核心事件总线：补时间戳与序号 → 落盘 → 成功后才广播（§2.10 / BR-10）。
 *
 * 两条纪律：
 * 1. 事件必落盘。`store.appendEvent` 失败时返回 `STORE_WRITE_FAILED` 且**不广播**，
 *    不允许"只发内存事件"，否则事后复盘会缺行。
 * 2. 单实例串行。按 `instanceId` 串成 promise 链，避免并发写同一 `events.jsonl`
 *    导致行交错或 seq 重号。
 *
 * 注：`replay` 是拆分文档 §2.10 冻结的方法名，方法名沿用契约（不计入核心禁词）。
 */
// 审计链固定起点：首条事件 `prev_event_hash` 为 64 个 0（D-1 L940）。
const ZERO_HASH = '0'.repeat(64);

export function createEventBus({ store, clock } = {}) {
  if (!store || typeof store.appendEvent !== 'function' || typeof store.nextSeq !== 'function') {
    throw new TypeError('createEventBus: 需要一个实现 appendEvent/nextSeq 的 store');
  }

  /** @type {Set<{handler: Function, instanceId: string|null}>} */
  const subscribers = new Set();
  /** @type {Map<string, Promise<void>>} */
  const chains = new Map();

  const nowMs = () => (typeof clock === 'function' ? clock() : Date.now());

  /**
   * 调用方自带时间戳的归一化：只接受可解析的字符串，统一回写成总线口径
   * （ISO-8601 UTC 毫秒）。不合法返回 null，交回 `clock()` 现取。
   */
  function normalizeTs(value) {
    if (typeof value !== 'string' || value.length === 0) return null;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
  }

  function subscribe(handler, { instanceId } = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError('subscribe: handler 必须是函数');
    }
    const entry = { handler, instanceId: instanceId ?? null };
    subscribers.add(entry);
    return () => {
      subscribers.delete(entry);
    };
  }

  function broadcast(instanceId, event) {
    for (const entry of subscribers) {
      if (entry.instanceId !== null && entry.instanceId !== instanceId) continue;
      try {
        entry.handler(event);
      } catch {
        // 订阅者自己的异常不得反向影响 emit 结果，也不得阻断其他订阅者。
      }
    }
  }

  function enqueue(instanceId, task) {
    const previous = chains.get(instanceId) ?? Promise.resolve();
    const next = previous.then(task, task);
    const guard = next.catch(() => {});
    chains.set(instanceId, guard);
    guard.then(() => {
      if (chains.get(instanceId) === guard) chains.delete(instanceId);
    });
    return next;
  }

  /**
   * 发一条事件。
   *
   * `event.instanceId` 只作路由键：用于定位实例目录与订阅者，**不落盘、不广播**
   * （落盘行的字段严格按 §3.2，避免多出一个不在契约里的字段）。
   *
   * `event.ts`（可选）：调用方已持有"该事件真正发生的时刻"时传入，总线原样采用
   * 并只做格式归一；缺省仍由 `clock()` 现取，既有调用方零感知。用于把
   * `node.dispatch` 的 ts 锁死成派发时刻（AC-35 的逐字等式）。
   *
   * @returns {Promise<{ok:true, seq:number, ts:string}
   *   | {ok:false, code:'STORE_WRITE_FAILED', params?:{errno:string|null, path:string}}>}
   */
  function emit(event) {
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      throw new TypeError('emit: event 必须是对象');
    }
    const { instanceId, ts: tsHint, ...rest } = event;
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      throw new TypeError('emit: event.instanceId 必填');
    }

    return enqueue(instanceId, async () => {
      // 1) 审计链尾读：序号与上一条指纹来自 `readTailForChain` 的**同一次尾读**
      //    （D-1 L942 / §7 R-6），禁止先取序号再取指纹两次读。序号口径沿用
      //    既有 `nextSeq`，不改单调性。单实例串行队列内执行，不引入第二条序号来源。
      //    store 未实现 `readTailForChain`（例如测试注入的 mock store）时降级到
      //    既有 `nextSeq` + 64 个 `0` 固定起点，不抛错、不让既有测试变红。
      let seq;
      let prevHash;
      if (typeof store.readTailForChain === 'function') {
        const tail = await store.readTailForChain(instanceId);
        seq = tail.seq;
        prevHash = tail.prevHash ?? ZERO_HASH;
      } else {
        seq = await store.nextSeq(instanceId);
        prevHash = ZERO_HASH;
      }
      // 2) 时间戳统一 ISO-8601 UTC 毫秒，不自拼格式；调用方给了就用调用方的。
      const ts = normalizeTs(tsHint) ?? new Date(nowMs()).toISOString();
      const record = { ...rest, seq, ts, prev_event_hash: prevHash };

      // 3) 先落盘。
      const appended = await store.appendEvent(instanceId, record);
      if (!appended || appended.ok !== true) {
        return { ok: false, code: 'STORE_WRITE_FAILED', params: appended?.params };
      }

      // 4) 只有落盘成功才广播。
      broadcast(instanceId, record);
      return { ok: true, seq, ts };
    });
  }

  /** 读该实例的全部事件（单行损坏由 store 跳过并计数，不整体失败）。 */
  async function replay(instanceId) {
    if (typeof store.readEvents !== 'function') {
      throw new TypeError('replay: store 未实现 readEvents');
    }
    const read = await store.readEvents(instanceId);
    if (!read || read.ok !== true) {
      const err = new Error(`replay: 读取事件失败（${read?.code ?? 'UNKNOWN'}）`);
      err.code = read?.code ?? 'STORE_READ_FAILED';
      err.params = read?.params;
      throw err;
    }
    // 仍返回事件数组：既有调用者（server.js `instance.events`、既有测试）拿到的
    // 形状不变。把 `readEvents` 已统计的 `badLines` 作为数组上的附带字段透出给
    // 下游（WP-8 的 `instance log` 跳过行提示），值与读取层同源、不另算。
    // 非枚举属性：对 length / JSON.stringify / Object.keys / 深比较 / 展开透明，
    // 因此既有数组断言与 daemon 的 JSON 序列化逐字不回归。
    const events = read.events;
    Object.defineProperty(events, 'badLines', {
      value: read.badLines,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return events;
  }

  /** 启动时从 events.jsonl 末行恢复的下一个序号。 */
  function nextSeq(instanceId) {
    return store.nextSeq(instanceId);
  }

  return { emit, subscribe, replay, nextSeq };
}
