/**
 * 通知域：订阅既有事件总线，把三类事件（升级待处理 / 实例完成 / 实例异常）
 * 归一为通知意图，交给壳层投递（I1.11 §2.1 / 附录 D-2）。
 *
 * 三条纪律：
 * 1. 只读不改。检测点全部落在总线订阅上；本模块不写实例状态、不落盘、
 *    不产生任何编排事件——通知是「触达」，不是「状态」。
 * 2. 去重窗口是可注入时钟的纯调度：`clock.now()` 取时刻、`clock.schedule`
 *    挂延迟回调，9999ms / 10001ms 边界用注入时钟断言。未注入 `schedule`
 *    时，异常合并退化为「即发 + 窗口抑制」模式（无合并计数），升级与
 *    完成两类不受影响。
 * 3. 任何单点失败（状态读不到、偏好读不到）都不得中断后续意图的产生：
 *    读失败按缺省处理，该条意图丢弃，下一条照常。
 *
 * 意图文案的字面量全部集中在 NOTIFY_LABELS（A-1 / D-26：正文恒为 5 段、
 * ` · ` 分隔、取不到的段渲染 `—` 不省略），后续由 HTTP 批次搬进文案键表。
 */
/** 去重窗口常量（AC-06）：同一升级 10s 一次；同类异常 60s 合并。 */
export const DEDUP = Object.freeze({ ESCALATION_MS: 10_000, ANOMALY_MS: 60_000 });

/**
 * 通知文案字面量（A-1 / A-2 逐字基线）。标题形如 `通知 升级待处理 · INST-001`；
 * 正文五段：`实例 {id} · 升级 {编号} · 节点 {节点} {角色} · 第 {n} 轮 · {原因摘要}`。
 */
export const NOTIFY_LABELS = Object.freeze({
  TITLE_PREFIX: '通知',
  CATEGORY: Object.freeze({
    escalation: '升级待处理',
    completed: '实例完成',
    anomaly: '实例异常',
  }),
  SEG_INSTANCE: '实例',
  SEG_ESCALATION: '升级',
  SEG_NODE: '节点',
  SEG_ROUND_PREFIX: '第',
  SEG_ROUND_SUFFIX: '轮',
  SEG_MISSING: '—',
  SEG_SEPARATOR: ' · ',
  /** 实例状态词（与既有状态词表同口径，不自造）。 */
  STATE: Object.freeze({
    created: '已创建',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    interrupted: '已中断',
    suspended: '已挂起',
  }),
  /** 健康度「需关注」档；其余档位不出现在异常摘要里。 */
  HEALTH_ATTENTION: '需关注',
  /** 合并形态：`已中断，共 4 次，最近：…`。 */
  MERGE_COUNT_PREFIX: '共',
  MERGE_COUNT_SUFFIX: '次',
  MERGE_LATEST_PREFIX: '最近：',
});

const L = NOTIFY_LABELS;

/**
 * 创建通知调度器。
 *
 * @param {object} deps
 * @param {{subscribe: Function}} deps.bus 既有事件总线（只需 subscribe）。
 * @param {() => Array<object>} [deps.getInstanceStates]
 *   实例状态只读投影：返回全部实例的快照数组（元素含 instanceId / state /
 *   health.level / nodes[] / escalations[] / workflowName，字段可缺）。
 *   缺省时按「读不到」处理，正文相应段渲染 `—`，意图照常产生。
 * @param {{now?: () => number, schedule?: (fn: Function, ms: number) => () => void}} [deps.clock]
 *   可注入时钟。`now` 缺省取系统毫秒；`schedule` 缺省时异常合并退化为
 *   即发 + 抑制模式。
 * @param {() => Promise<{enabled:boolean, escalate:boolean, completed:boolean, anomaly:boolean}>}
 *   [deps.prefsRead] 通知开关读取（缺省视为全开）。
 * @returns {{ intents$: AsyncIterable<object>, dispose: () => void }}
 *   `intents$` 逐条产出 NotifyIntent：
 *   `{ kind: 'escalation'|'completed'|'anomaly', ids: string[], instanceId,
 *      title, body, mergedCount, at }`。
 */
export function createNotifier({ bus, getInstanceStates, clock, prefsRead } = {}) {
  if (!bus || typeof bus.subscribe !== 'function') {
    throw new TypeError('createNotifier: bus 必须实现 subscribe');
  }

  const nowFn = typeof clock?.now === 'function' ? clock.now : Date.now;
  const scheduleFn = typeof clock?.schedule === 'function' ? clock.schedule : null;
  const readPrefsSafe = typeof prefsRead === 'function' ? prefsRead : null;

  // ---- 意图流：单消费异步迭代器（SSE 一处订阅即可） ----
  const buffer = [];
  const waiters = [];
  let finished = false;

  function pushIntent(intent) {
    if (finished) return;
    const waiter = waiters.shift();
    if (waiter) waiter({ value: intent, done: false });
    else buffer.push(intent);
  }

  function finish() {
    if (finished) return;
    finished = true;
    while (waiters.length > 0) waiters.shift()({ value: undefined, done: true });
  }

  const intents$ = {
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift(), done: false });
          }
          if (finished) return Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve) => waiters.push(resolve));
        },
        return() {
          // 消费方提前退出（for-await break）等价于弃用整个通知器。
          dispose();
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };

  // ---- 去重状态 ----
  /** @type {Map<string, number>} 升级编号 → 上次发意图的时刻。 */
  const escalationSeen = new Map();
  /** @type {Map<string, number>} 实例 → 最近一次升级创建的处理时刻（抑制由新升级引起的异常信号，D-2）。 */
  const escalationCreated = new Map();
  /** @type {Set<string>} 已发过完成通知的实例（生命周期一次）。 */
  const completedSeen = new Set();
  /**
   * @type {Map<string, object>} 异常合并组（按实例聚合：中断与健康度刷新同属
   *   一类，60s 窗口内合并为一条）。
   */
  const anomalyGroups = new Map();
  /** @type {Map<string, number>} 退化模式（无 schedule）下的异常抑制表。 */
  const anomalySeen = new Map();

  // ---- 事件分类（D-2 三类检测点，全部来自既有总线事件） ----
  function classify(event) {
    if (!event || typeof event !== 'object') return null;
    if (event.object === 'escalation' && event.to === 'pending') {
      return { kind: 'escalation', escalationId: event.objectId, at: nowFn(), event };
    }
    if (event.object === 'instance' && event.to === 'completed') {
      return { kind: 'completed', instanceId: event.objectId, at: nowFn(), event };
    }
    if (
      event.object === 'instance' &&
      (event.to === 'failed' || event.to === 'interrupted')
    ) {
      return { kind: 'anomaly', anomalyKind: event.to, instanceId: event.objectId, at: nowFn(), event };
    }
    if (event.object === 'health' && event.to === 'attention') {
      return { kind: 'anomaly', anomalyKind: 'attention', instanceId: event.objectId, at: nowFn(), event };
    }
    return null;
  }

  // ---- 安全读取 ----
  async function loadStates() {
    if (typeof getInstanceStates !== 'function') return [];
    try {
      const states = await getInstanceStates();
      return Array.isArray(states) ? states : [];
    } catch {
      return [];
    }
  }

  async function loadPrefs() {
    const fallback = { enabled: true, escalate: true, completed: true, anomaly: true };
    if (!readPrefsSafe) return fallback;
    try {
      const prefs = await readPrefsSafe();
      if (!prefs || typeof prefs !== 'object') return fallback;
      return {
        enabled: prefs.enabled !== false,
        escalate: prefs.escalate !== false,
        completed: prefs.completed !== false,
        anomaly: prefs.anomaly !== false,
      };
    } catch {
      return fallback;
    }
  }

  // ---- 文案拼装（A-1 五段固定段序；缺段渲染 `—` 不省略） ----
  function stateWord(state) {
    return L.STATE[state] ?? null;
  }

  function segInstance(instanceId) {
    return `${L.SEG_INSTANCE} ${instanceId ?? L.SEG_MISSING}`;
  }

  function segEscalation(escalationId) {
    return `${L.SEG_ESCALATION} ${escalationId ?? L.SEG_MISSING}`;
  }

  function segNode(nodeId, roleName) {
    if (!nodeId && !roleName) return `${L.SEG_NODE} ${L.SEG_MISSING}`;
    return `${L.SEG_NODE} ${nodeId ?? L.SEG_MISSING} ${roleName ?? L.SEG_MISSING}`;
  }

  function segRound(round) {
    const n = Number.isInteger(round) ? round : L.SEG_MISSING;
    return `${L.SEG_ROUND_PREFIX} ${n} ${L.SEG_ROUND_SUFFIX}`;
  }

  function buildBody({ instanceId, escalationId = null, nodeId = null, roleName = null, round = null, summary }) {
    return [
      segInstance(instanceId),
      segEscalation(escalationId),
      segNode(nodeId, roleName),
      segRound(round),
      summary || L.SEG_MISSING,
    ].join(L.SEG_SEPARATOR);
  }

  function buildTitle(kind, instanceId) {
    return `${L.TITLE_PREFIX} ${L.CATEGORY[kind]} ${L.SEG_SEPARATOR.trim()} ${instanceId}`;
  }

  function findNode(snapshot, nodeId) {
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    if (nodeId) {
      const hit = nodes.find((n) => n?.nodeId === nodeId);
      if (hit) return hit;
    }
    // 异常 / 完成没有明确节点时：先取卡住的节点，再退到清单末位。
    return (
      nodes.find((n) => n?.state === 'running' || n?.state === 'review') ??
      nodes[nodes.length - 1] ??
      null
    );
  }

  /** 从事件细节里取最近一次原因（不做任何编排语义重算）。 */
  function reasonOf(event) {
    const detail = event?.detail;
    if (detail === null || detail === undefined || typeof detail !== 'object') return null;
    if (typeof detail.message === 'string' && detail.message.length > 0) return detail.message;
    if (Array.isArray(detail.reasons)) {
      const joined = detail.reasons
        .filter((r) => typeof r === 'string' && r.length > 0)
        .join('，');
      return joined.length > 0 ? joined : null;
    }
    return null;
  }

  // ---- 三类意图的产生 ----
  async function emitEscalation(occ) {
    const states = await loadStates();
    const snapshot = states.find(
      (s) =>
        Array.isArray(s?.escalations) &&
        s.escalations.some(
          (e) => e?.escalationId === occ.escalationId && e?.state === 'pending',
        ),
    );
    // 状态里找不到待处理条目：条目已不在 pending（或实例不可读），不发过期意图。
    if (!snapshot || typeof snapshot.instanceId !== 'string') return;
    const instanceId = snapshot.instanceId;
    escalationCreated.set(instanceId, occ.at);

    const last = escalationSeen.get(occ.escalationId);
    if (last !== undefined && occ.at - last < DEDUP.ESCALATION_MS) return;
    escalationSeen.set(occ.escalationId, occ.at);

    const entry = snapshot.escalations.find((e) => e?.escalationId === occ.escalationId);
    const nodeId = entry?.nodeId ?? occ.event?.detail?.nodeId ?? null;
    const round = entry?.round ?? occ.event?.detail?.round ?? null;
    const node = findNode(snapshot, nodeId);
    const roleName = node?.roleName ?? null;
    const reason = entry?.reasonDetail || occ.event?.detail?.reasonDetail || null;

    pushIntent({
      kind: 'escalation',
      ids: [occ.escalationId],
      instanceId,
      title: buildTitle('escalation', instanceId),
      body: buildBody({
        instanceId,
        escalationId: occ.escalationId,
        nodeId,
        roleName,
        round,
        summary: reason,
      }),
      mergedCount: 1,
      at: occ.at,
    });
  }

  async function emitCompleted(occ) {
    const instanceId = occ.instanceId;
    if (completedSeen.has(instanceId)) return;
    completedSeen.add(instanceId);

    const states = await loadStates();
    const snapshot = states.find((s) => s?.instanceId === instanceId) ?? null;
    const node = findNode(snapshot, null);
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    const doneCount = nodes.filter((n) => n?.state === 'done').length;
    // 第 5 段：`已完成，{工作流名} {完成数}/{总数}`；读不到清单时只留状态词。
    const summary =
      nodes.length > 0
        ? `${stateWord('completed')}，${snapshot?.workflowName ?? L.SEG_MISSING} ${doneCount}/${nodes.length}`
        : stateWord('completed');

    pushIntent({
      kind: 'completed',
      ids: [],
      instanceId,
      title: buildTitle('completed', instanceId),
      body: buildBody({
        instanceId,
        nodeId: node?.nodeId ?? null,
        roleName: node?.roleName ?? null,
        round: node?.round ?? null,
        summary,
      }),
      mergedCount: 1,
      at: occ.at,
    });
  }

  function flushAnomalyGroup(group) {
    anomalyGroups.delete(group.instanceId);
    // 窗口关闭定型（D-46）：count > 1 补发一条合并形态定稿；count === 1
    // 只清组——首条早已即发，无需重复。
    if (group.count > 1) {
      pushIntent({
        kind: 'anomaly',
        ids: [],
        instanceId: group.instanceId,
        title: buildTitle('anomaly', group.instanceId),
        body: group.body,
        mergedCount: group.count,
        at: nowFn(),
      });
    }
  }

  async function emitAnomaly(occ) {
    // 由新升级引起的异常信号（升级创建后紧随的健康度刷新等）不再重复发，
    // 避免与升级意图重复（D-2 ③）。升级窗口外的新异常按新事实正常发出。
    const lastEscalation = escalationCreated.get(occ.instanceId);
    if (lastEscalation !== undefined && occ.at - lastEscalation < DEDUP.ESCALATION_MS) return;

    // 异常按实例聚合（中断与健康度刷新同属一类）。合并呈现按 D-46：
    // 首条即发（mergedCount 1）→ 窗口内并入立即重发更新意图（计数递增、
    // 正文切合并形态）→ 窗口关闭定型；壳层按 (kind, instanceId) 替换呈现。
    const group = anomalyGroups.get(occ.instanceId);
    if (group) {
      if (occ.at - group.anchor < DEDUP.ANOMALY_MS) {
        group.count += 1;
        const reason = reasonOf(occ.event);
        if (reason) group.latest = reason;
        group.body = mergedAnomalyBody(group.instanceId, group.word, group.count, group.latest);
        pushIntent({
          kind: 'anomaly',
          ids: [],
          instanceId: group.instanceId,
          title: buildTitle('anomaly', group.instanceId),
          body: group.body,
          mergedCount: group.count,
          at: occ.at,
        });
        return;
      }
      // 窗口已过但回调尚未触发（时钟被测试拨快）：先清算旧组，再开新组。
      flushAnomalyGroup(group);
    }

    const states = await loadStates();
    const snapshot = states.find((s) => s?.instanceId === occ.instanceId) ?? null;
    const word = stateWord(snapshot?.state) ?? stateWord(occ.event?.to) ?? L.SEG_MISSING;
    const reason = reasonOf(occ.event);

    if (!scheduleFn) {
      // 退化模式：即发 + 窗口抑制（无合并计数）。
      const last = anomalySeen.get(occ.instanceId);
      if (last !== undefined && occ.at - last < DEDUP.ANOMALY_MS) return;
      anomalySeen.set(occ.instanceId, occ.at);
      pushIntent({
        kind: 'anomaly',
        ids: [],
        instanceId: occ.instanceId,
        title: buildTitle('anomaly', occ.instanceId),
        body: singleAnomalyBody(occ.instanceId, word, snapshot),
        mergedCount: 1,
        at: occ.at,
      });
      return;
    }

    const fresh = {
      instanceId: occ.instanceId,
      count: 1,
      latest: reason,
      anchor: occ.at,
      word,
      body: null,
      cancel: null,
    };
    // 首条立即发（AC-03 / BR-01 的 ≤2s 时效），合并窗口只管后续并入。
    fresh.body = singleAnomalyBody(occ.instanceId, word, snapshot);
    pushIntent({
      kind: 'anomaly',
      ids: [],
      instanceId: occ.instanceId,
      title: buildTitle('anomaly', occ.instanceId),
      body: fresh.body,
      mergedCount: 1,
      at: occ.at,
    });
    const timer = scheduleFn(() => flushAnomalyGroup(fresh), DEDUP.ANOMALY_MS);
    fresh.cancel = typeof timer === 'function' ? timer : null;
    anomalyGroups.set(occ.instanceId, fresh);
  }

  /** 单条异常正文：`{状态词}，需关注`（A-1 异常类固定摘要），节点与轮次取可用项。 */
  function singleAnomalyBody(instanceId, word, snapshot) {
    const node = findNode(snapshot, null);
    return buildBody({
      instanceId,
      nodeId: node?.nodeId ?? null,
      roleName: node?.roleName ?? null,
      round: node?.round ?? null,
      summary: `${word}，${L.HEALTH_ATTENTION}`,
    });
  }

  /** 合并正文（A-1）：`{状态词}，共 N 次，最近：{最近原因}`，节点与轮次置 `—`。 */
  function mergedAnomalyBody(instanceId, word, count, latest) {
    let summary = `${word}，${L.MERGE_COUNT_PREFIX} ${count} ${L.MERGE_COUNT_SUFFIX}`;
    if (latest) summary += `，${L.MERGE_LATEST_PREFIX}${latest}`;
    return buildBody({ instanceId, summary });
  }

  // ---- 单条意图是否放行（开关优先，窗口次之） ----
  function allowedByPrefs(prefs, kind) {
    if (!prefs.enabled) return false;
    if (kind === 'escalation') return prefs.escalate;
    if (kind === 'completed') return prefs.completed;
    return prefs.anomaly;
  }

  // ---- 事件泵：串行处理，任何一条失败不阻断后续 ----
  const queue = [];
  let pumping = false;

  function onEvent(event) {
    if (finished) return;
    const occ = classify(event);
    if (!occ) return;
    queue.push(occ);
    void pump();
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length > 0) {
        const occ = queue.shift();
        try {
          const prefs = await loadPrefs();
          if (!allowedByPrefs(prefs, occ.kind)) continue;
          if (occ.kind === 'escalation') await emitEscalation(occ);
          else if (occ.kind === 'completed') await emitCompleted(occ);
          else await emitAnomaly(occ);
        } catch {
          // 单条意图的产生失败（状态读异常等）不阻断后续事件。
        }
      }
    } finally {
      pumping = false;
    }
  }

  const unsubscribe = bus.subscribe(onEvent);

  function dispose() {
    unsubscribe();
    for (const group of anomalyGroups.values()) {
      if (typeof group.cancel === 'function') group.cancel();
    }
    anomalyGroups.clear();
    escalationSeen.clear();
    escalationCreated.clear();
    anomalySeen.clear();
    completedSeen.clear();
    queue.length = 0;
    finish();
  }

  return { intents$, dispose };
}
