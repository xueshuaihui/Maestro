/**
 * Graph + role constants (`src/templates/index.js`).
 *
 * This is the ONLY product directory allowed to spell the built-in template names
 * and role names (AC-28). `src/core` and `src/daemon` stay literal-free: the engine
 * receives these objects by injection and never looks a template up by name.
 *
 * Node shape:
 *   { id, nodeId, roleId, order, title, artifactPolicy, judge, products, wakeFrom, prompt }
 * I1.3 optional node fields (only `task-loop` sets them):
 *   artifactDir / artifactExt / reviewPath / downstreamGate
 *
 * Graph shape: `productPolicy` is `'declared'` when absent (I1.1 / I1.2 behaviour) and
 * `'doc-single'` for the single-document loop.
 * `id` is the iteration-2 spelling; `nodeId` is kept as the same value so the
 * snapshot/D-6 field name needs no translation inside the engine.
 *
 * Edge shape: { from, to, kind:'forward'|'backflow'|'retest', condition }
 * `terminal` is the single terminal node id; `terminals` is the array form kept for
 * readers that project D-6 snapshots.
 */

/**
 * Built-in roles. The coordinator is defined but not dispatched (D-1).
 * `researcher` / `writer` / `reviewer` carry the `task-loop` wording (requirement D-4).
 */
export const ROLES = Object.freeze({
  developer: Object.freeze({
    roleId: 'developer',
    labelKey: 'developer',
    dispatchable: true,
    duty: '按任务修改代码，交出「产物：」一行声明的文件',
    mustDeliver: ['任务里「产物：<路径>」声明的文件'],
    prompt: 'forward'
  }),
  tester: Object.freeze({
    roleId: 'tester',
    labelKey: 'tester',
    dispatchable: true,
    duty: '运行测试命令，并以 out/verdict.json 交出结构化判定',
    mustDeliver: ['out/verdict.json'],
    prompt: 'verify'
  }),
  coordinator: Object.freeze({
    roleId: 'coordinator',
    labelKey: 'coordinator',
    dispatchable: false,
    duty: '汇总两节点的结论并给出下一步（本迭代只定义，不派发）',
    mustDeliver: [],
    prompt: null
  }),
  /** T-001: background / facts / constraints / outline suggestions. Never the final document. */
  researcher: Object.freeze({
    roleId: 'researcher',
    labelKey: 'researcher',
    dispatchable: true,
    duty: '调研任务背景，交出固定路径的研究笔记',
    mustDeliver: ['artifacts/reports/research-notes.v1.md'],
    prompt: 'research'
  }),
  /** T-002: full document every round, one new versioned file per round. */
  writer: Object.freeze({
    roleId: 'writer',
    labelKey: 'writer',
    dispatchable: true,
    duty: '按研究笔记与缺陷清单撰写完整文档，每轮交一个新版本',
    mustDeliver: ['artifacts/docs/<名>.v<轮次>.md'],
    prompt: 'write'
  }),
  /** T-003: only the review file counts; the conversation is ignored. */
  reviewer: Object.freeze({
    roleId: 'reviewer',
    labelKey: 'reviewer',
    dispatchable: true,
    duty: '审阅本轮文档，只以 out/review.json 交出结论',
    mustDeliver: ['out/review.json'],
    prompt: 'review'
  })
});

/**
 * The review-file schema block appended to a reviewer's prompt (requirement D-8).
 *
 * `{docRef}` is filled by `promptFor()` with this round's document reference; every
 * other brace pair below is literal JSON notation and is never substituted (the
 * placeholder regex only matches `{` + word chars + `}`).
 */
export const REVIEW_REQUIREMENT =
  '只认审核文件：{"decision":"pass"|"reject","artifact":"{docRef}",' +
  '"defects":[{"summary":"一句话缺陷","evidence":"{docRef}#L1"}],"revisionRequirement":"..."}\n' +
  '判定为 reject 时至少一条缺陷；判定为 pass 时 defects 必须为空。\n不要修改文档。';

/** Revision requirement used when the review file carries none (requirement D-5). */
export const DEFAULT_REVISION_REQUIREMENT = '请按缺陷清单逐条修改后交出新版本';

/**
 * Built-in prompts. Wording lives here so the engine never assembles Chinese.
 *
 * `single` is byte-for-byte the I1.1 text; `forward` / `backflow` / `retest` are the
 * I1.2 coding-loop wording and are unchanged. `research` / `write` / `writeRevision` /
 * `review` are the I1.3 additions (requirement D-8).
 */
export const PROMPT_TEMPLATES = Object.freeze({
  single: '{task}\n\n完成后直接结束，不需要额外说明。',
  forward: '{task}',
  backflow:
    '{task}\n\n上一轮判定不通过，请按下列缺陷修正：\n{defectLines}\n复测要求：{retestRequirement}',
  retest: '{task}\n\n上一轮缺陷：{defectCount} 条\n产物：{products}\n请复测并把结构化判定写到 out/verdict.json。',
  research:
    '{task}\n\n研究笔记：{researchRef}\n写入路径：{writePath}\n只交研究笔记，不写最终文档。',
  write:
    '{task}\n\n研究笔记：{researchRef}\n本轮文档引用：{docRef}\n写入路径：{writePath}\n每一轮交完整文档，不要改写上一版。',
  writeRevision:
    '{task}\n\n上一轮审核不通过，请按下列缺陷修改：\n{defectLines}\n修改要求：{revisionRequirement}\n' +
    '研究笔记：{researchRef}\n上一版文档引用：{previousRef}\n本轮文档引用：{docRef}\n' +
    '写入路径：{writePath}\n不得改写上一版文件。',
  review:
    '{task}\n\n本轮文档引用：{docRef}\n工作区：{workspaceDir}\n审核文件写入路径：{reviewPath}\n' +
    REVIEW_REQUIREMENT
});

/** Verdict requirement appended to a judging node's prompt (never to a worker's). */
export const VERDICT_REQUIREMENT =
  '\n\n完成后把结构化判定写到 out/verdict.json：{"verdict":"pass"|"fail","defects":[{"summary":"一句话缺陷","evidence":"证据文件路径"}]}；判定为 fail 时必须给出至少一条带证据路径的缺陷。';

/** Backflow detail line; rendered one per defect. */
export const DEFECT_LINE = '缺陷 {i}：{summary}（证据 {evidence}）';

/** Default retest requirement when a verdict carries none. */
export const DEFAULT_RETEST_REQUIREMENT = '按上方每条缺陷修正后重新提交产物';

function nodeOf(graph, id) {
  if (!graph || !Array.isArray(graph.nodes)) return null;
  return graph.nodes.find((node) => node.id === id || node.nodeId === id) ?? null;
}

/** Single-node graph: identical to I1.1 (node T-001, handoff HO-001, roleId 'worker'). */
const single = Object.freeze({
  id: 'single',
  showTemplate: false,
  entry: 'T-001',
  terminal: 'T-001',
  terminals: Object.freeze(['T-001']),
  maxRounds: Object.freeze({ 'T-001': 1 }),
  nodes: Object.freeze([
    Object.freeze({
      id: 'T-001',
      nodeId: 'T-001',
      roleId: 'worker',
      order: 1,
      title: null,
      artifactPolicy: 'heuristic',
      judge: 'none',
      products: Object.freeze([]),
      wakeFrom: Object.freeze([]),
      prompt: 'single'
    })
  ]),
  edges: Object.freeze([])
});

/** Two-node coding loop: build, then verify, then backflow or retest. */
const codeLoop = Object.freeze({
  id: 'code-loop',
  showTemplate: true,
  entry: 'T-001',
  terminal: 'T-002',
  terminals: Object.freeze(['T-002']),
  maxRounds: Object.freeze({ 'T-001': 2, 'T-002': 2 }),
  nodes: Object.freeze([
    Object.freeze({
      id: 'T-001',
      nodeId: 'T-001',
      roleId: 'developer',
      order: 1,
      title: '开发',
      artifactPolicy: 'declared',
      judge: 'none',
      products: Object.freeze([]),
      wakeFrom: Object.freeze(['backflow']),
      prompt: 'forward'
    }),
    Object.freeze({
      id: 'T-002',
      nodeId: 'T-002',
      roleId: 'tester',
      order: 2,
      title: '测试',
      artifactPolicy: 'verdict',
      judge: 'verdict',
      products: Object.freeze(['out/verdict.json']),
      wakeFrom: Object.freeze(['retest']),
      prompt: 'verify'
    })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'T-001', to: 'T-002', kind: 'forward', condition: null }),
    Object.freeze({
      from: 'T-002',
      to: 'T-001',
      kind: 'backflow',
      condition: 'verdict-fail',
      requiresHandoff: true
    }),
    Object.freeze({ from: 'T-001', to: 'T-002', kind: 'retest', condition: 'reopen-failed-target' })
  ])
});

/**
 * Three-node document loop: research, write, review, then backflow or retest.
 *
 * `productPolicy: 'doc-single'` tells the engine that this graph declares exactly one
 * `产物：<文件名>.md` line and keeps every artifact inside the instance workspace
 * (requirement D-8). Graphs without the field behave as `declared` (I1.1 / I1.2).
 */
const taskLoop = Object.freeze({
  id: 'task-loop',
  showTemplate: true,
  entry: 'T-001',
  terminal: 'T-003',
  terminals: Object.freeze(['T-003']),
  maxRounds: Object.freeze({ 'T-001': 1, 'T-002': 2, 'T-003': 2 }),
  productPolicy: 'doc-single',
  nodes: Object.freeze([
    Object.freeze({
      id: 'T-001',
      nodeId: 'T-001',
      roleId: 'researcher',
      order: 1,
      title: '研究员',
      artifactPolicy: 'fixed-workspace',
      artifactDir: 'artifacts/reports',
      artifactExt: '.md',
      judge: 'none',
      products: Object.freeze(['artifacts/reports/research-notes.v1.md']),
      downstreamGate: true,
      wakeFrom: Object.freeze([]),
      prompt: 'research'
    }),
    Object.freeze({
      id: 'T-002',
      nodeId: 'T-002',
      roleId: 'writer',
      order: 2,
      title: '撰写者',
      artifactPolicy: 'versioned-doc',
      artifactDir: 'artifacts/docs',
      artifactExt: '.md',
      judge: 'none',
      products: Object.freeze([]),
      downstreamGate: true,
      wakeFrom: Object.freeze(['backflow']),
      prompt: 'write'
    }),
    Object.freeze({
      id: 'T-003',
      nodeId: 'T-003',
      roleId: 'reviewer',
      order: 3,
      title: '审核者',
      artifactPolicy: 'review',
      reviewPath: 'out/review.json',
      judge: 'review',
      products: Object.freeze([]),
      downstreamGate: false,
      wakeFrom: Object.freeze(['retest']),
      prompt: 'review'
    })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'T-001', to: 'T-002', kind: 'forward', condition: null }),
    Object.freeze({ from: 'T-002', to: 'T-003', kind: 'forward', condition: null }),
    Object.freeze({
      from: 'T-003',
      to: 'T-002',
      kind: 'backflow',
      condition: 'review-reject',
      requiresHandoff: true
    }),
    Object.freeze({ from: 'T-002', to: 'T-003', kind: 'retest', condition: 'reopen-failed-target' })
  ])
});

export const GRAPHS = Object.freeze({ single, 'code-loop': codeLoop, 'task-loop': taskLoop });

export const DEFAULT_GRAPH = 'single';

/** Resolve a graph by name; unknown names return null (never throw). */
export function getGraph(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  return Object.prototype.hasOwnProperty.call(GRAPHS, name) ? GRAPHS[name] : null;
}

/** The default graph object. */
export function defaultGraph() {
  return GRAPHS[DEFAULT_GRAPH];
}

/**
 * Initial `nodes[]` in the D-6 shape. `stateAt` is stamped verbatim (caller owns time).
 */
export function initialNodes(graph, { stateAt = null } = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  // The document loop needs three extra fields (D-6). They are only created for graphs
  // that declare `productPolicy: 'doc-single'`, so I1.1 / I1.2 node shapes stay byte for
  // byte what they were.
  const docSingle = graph?.productPolicy === 'doc-single';
  return nodes.map((node) => {
    const base = {
      nodeId: node.id ?? node.nodeId,
      roleId: node.roleId,
      round: 0,
      state: 'pending',
      stateSince: stateAt,
      startedAt: null,
      roundStartedAt: null,
      endedAt: null,
      failure: null,
      note: null,
      verdict: null,
      sessionId: null,
      artifactRefs: []
    };
    if (!docSingle) return base;
    return { ...base, reviewReason: null, review: null, artifactHistory: [] };
  });
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function defectLines(defects) {
  return (Array.isArray(defects) ? defects : [])
    .map((defect, index) =>
      fill(DEFECT_LINE, {
        i: index + 1,
        summary: defect?.summary ?? '',
        evidence: defect?.evidence ?? ''
      })
    )
    .join('\n');
}

/**
 * Assemble the dispatch prompt.
 *
 * I1.3 adds four `node.prompt` keys (`research` / `write` / `review`) which are checked
 * **before** the edge-kind branches: a `task-loop` backflow targets the writer, so the
 * revision prompt must win over the coding-loop `backflow` wording. `single` / `forward`
 * / `verify` are not new keys and fall through to the I1.2 branches byte for byte.
 *
 * Version references are computed by the caller (`src/core/doc-artifact.js#docRef`) and
 * passed in, so this module never joins a `v<n>` filename itself.
 *
 * @param {{graph?:object, node?:object, handoff?:object, task?:string,
 *          products?:string[], defects?:object[], retestRequirement?:string,
 *          defectCount?:number, revisionRequirement?:string, round?:number,
 *          researchRef?:string, docRef?:string, previousRef?:string,
 *          writePath?:string, workspaceDir?:string, reviewPath?:string}} options
 * @returns {string}
 */
export function promptFor({
  graph = null,
  node = null,
  handoff = null,
  task = '',
  products = [],
  defects = [],
  retestRequirement = null,
  defectCount = null,
  revisionRequirement = null,
  round = null,
  researchRef = null,
  docRef = null,
  previousRef = null,
  writePath = null,
  workspaceDir = null,
  reviewPath = null
} = {}) {
  const kind = handoff?.edge?.kind ?? null;
  const target = node ?? (graph ? nodeOf(graph, handoff?.edge?.to) : null);

  // I1.3 keys first; the fallbacks read the declaring node so the wording stays single-sourced.
  if (target?.prompt === 'research') {
    return fill(PROMPT_TEMPLATES.research, {
      task,
      researchRef: researchRef ?? target.products?.[0] ?? null,
      writePath
    });
  }
  if (target?.prompt === 'write') {
    const isRevision = kind === 'backflow' || Number(round) > 1;
    if (!isRevision) {
      return fill(PROMPT_TEMPLATES.write, { task, researchRef, docRef, writePath });
    }
    return fill(PROMPT_TEMPLATES.writeRevision, {
      task,
      defectLines: defectLines(defects),
      revisionRequirement: revisionRequirement || DEFAULT_REVISION_REQUIREMENT,
      researchRef,
      previousRef,
      docRef,
      writePath
    });
  }
  if (target?.prompt === 'review') {
    return fill(PROMPT_TEMPLATES.review, {
      task,
      docRef,
      workspaceDir,
      reviewPath: reviewPath ?? target.reviewPath ?? null
    });
  }

  // I1.2 branches, unchanged.
  if (kind === 'backflow') {
    return fill(PROMPT_TEMPLATES.backflow, {
      task,
      defectLines: defectLines(defects),
      retestRequirement: retestRequirement || DEFAULT_RETEST_REQUIREMENT
    });
  }
  if (kind === 'retest') {
    return fill(PROMPT_TEMPLATES.retest, {
      task,
      defectCount: Number.isInteger(defectCount) ? defectCount : (defects?.length ?? 0),
      products: (Array.isArray(products) ? products : []).join(' ')
    });
  }
  if (!target || target.prompt === 'single') {
    return fill(PROMPT_TEMPLATES.single, { task });
  }
  const base = fill(PROMPT_TEMPLATES.forward, { task });
  return target.judge === 'verdict' ? `${base}${VERDICT_REQUIREMENT}` : base;
}
