# I1.3 任务拆分与文件级契约（非编码闭环）

> 需求依据：`docs/iterations/iteration-3/requirement.md` **v5**（45 条 AC / BR-01~40 / M-1~M-10 / C-01~C-14 / 附录 A~D）
> 上游实现：I1.2（`src/core/{graph,advance,verdict,escalation,verify-artifact,state-machine,orchestrator}.js`，337 用例）+ I1.1 单节点
> 评审依据：`docs/iterations/iteration-3/review-v4-consistency.md`（5 阻断 + 10 重要 + 5 次要，已按此修到 v5）

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：在 I1.2 的同一套图引擎上再加一张 `task-loop` 图（研究 → 撰写 → 审核），实现文档版本化、审核文件判定、驳回回流、下游门控与两轮上限升级，且 `single` / `code-loop` 的输出与行为逐字不变。

**In scope**（对应需求 §1.3 的 10 条）：三节点图与三角色、`artifacts/{docs,reports}` 版本区、`out/review.json`、证据模型泛化、驳回回流、两轮上限与升级、`reviewReason` 子状态（仅 `task-loop`）、引擎复用、兼容可追溯。

**Out of scope**（摘要 6 条，全表见需求 §1.3）：`shared/` / `stage/` / `status.md`（I1.4）、交接包信箱与重投（I1.4）、角色注册表与 `orch role`（I1.5）、声明式工作流（I1.6）、产物类型隔离（I1.7）、`escalated` 的人工裁决出边（I1.4）。另：`code-loop` 不回填 `downstream`（R-1）、不做 diff/部分改写、不做版本回滚命令。

**退出标准**

1. **45 条 AC 全部通过**：真实面 1 条（AC-40）+ 夹具面 36 条 + 用户可见 5 条 + 架构 1 条 + 混合 2 条，每条有可复核证据。
2. **I1.2 的 337 个用例仍全绿**，仅允许 D-9 登记的两处授权断言变化（`test/templates/fake-graph.test.js:214-229` 的 `buildHandoff` 键集合、`test/wp2/labels.test.js` 的 `REASON_LABEL` 条数 33→39）。
3. `single` 与 `code-loop` 的 `orch run` / `orch status` / `--events` 输出逐字不变（AC-36）。
4. AC-38 架构扫描：`src/core/**` + `src/daemon/**` 对 7 个禁词零命中（`test/fixtures/purity-check.mjs --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者`）。
5. NFR-01~10 全部满足（零依赖、p95 ≤ 50ms、status ≤ 500ms、夹具 5 连跑一致、状态文件无绝对路径/正文）。

---

## 1. 技术选型（结论 + 被否决项）

### 1.1 第二个模板怎么进引擎

**结论**：`src/templates/index.js` 新增 `task-loop` 图与三个角色，节点与图级字段按 M-2 扩展；`createOrchestrator({graph})` 的注入机制不变，`serve-entry.js` 已经把 `GRAPHS` 传进去。

```js
// 图级：productPolicy: 'declared' | 'doc-single'（缺省 declared）
// 节点级可选：downstreamGate / artifactDir / artifactExt / reviewPath /
//             artifactPolicy 扩展 fixed-workspace | versioned-doc | review / prompt 扩展
```

**否决**：(a) 在 `orchestrator.js` 里 `if (template === 'task-loop')` 分支 —— 违反 AC-38 禁词，且 `src/core` 不许出现模板名；(b) 图写 YAML —— 属 I1.6；(c) 新建 `task-orchestrator.js` —— 违反 M-7/D-1 的"同一引擎"。

### 1.2 提示词分派

**结论**（对应 B-4 的修复）：`promptFor()` 的**新键**（`research` / `write` / `review`）由 `node.prompt` 分派；既有的 `single`、`forward`、`verify` 与**按 `handoff.edge.kind` 选 `backflow`/`retest`** 的分支**逐字保留**（`templates/index.js:221-242`）。`write` 再按 `round === 1` / `round > 1` 选文本。

**否决**：把 `edge.kind` 分支删掉、只按 `node.prompt` 分派 —— `code-loop` 的回流提示词会退化成裸任务文本（缺陷与证据全丢），且现有测试不断言提示词文本，会静默上线。

### 1.3 产物解析的唯一入口

**结论**：新增 `src/core/doc-artifact.js`，`resolveNodeProducts(def, { node, state })` 按 `artifactPolicy` 分派：

| `artifactPolicy` | 本轮产物 | 基准目录 |
|---|---|---|
| `fixed-workspace` | 图节点 `products[]` 原样 | `workspaceDir` |
| `versioned-doc` | `<artifactDir>/<stem>.v<round>.md` | `workspaceDir` |
| `review` | 不解析产物（走 `readReview`） | — |
| `declared` / `heuristic`（I1.2 缺省） | `products[]` 或任务 `产物：` 行 | `cwd` |

`finishArtifactNode()`、`hasSubmittedOutput()`、`buildHandoff()` 三处**都走它**。

**否决**：在 `advance.js` 里另写一份 `productsOf()` 回退到任务行 —— 正是复核 B-3 指出的坑：`doc-single` 下会得到裸文件名 `release-notes.md`，AC-03/AC-08 直接错。`productsOf()` 在 `productPolicy === 'doc-single'` 时**禁止**回退。

### 1.4 审核校验器的形态

**结论**：新增 `src/core/review.js`，`readReview({ cwd, workspaceDir, expectedArtifact, roundStartedAt, fs, now })`，11 步顺序（D-7），命中即返回 `{ ok:false, code, stage, reasonCode, reasonDetail, reviewPath, detail }`。

**文案注入**：`review.js` 直接 `import { REVIEW_TEXT, ARTIFACT_TEXT } from '../cli/labels.js'` —— 与 `verdict.js:16` **完全同构**（I1.2 已开这个口子，`src/core` 引 `src/cli/labels` 不破坏分层，labels 是纯常量表）。

**否决**：(a) 参数注入文案 —— 每个调用点都要传，且 `hasSubmittedOutput` 与 `finishReviewNode` 会各传一次，易漂移；(b) 塞进 `verdict.js` 按 `judge` 分支 —— `verdict.js` 是 `out/verdict.json` 的专用校验器，混进来会让 code-loop 路径也被改。

### 1.5 下游门控的写入点与一次 CAS

**结论**（D-3 / C-09）：三个时机，各一次落盘。

1. **核对之前**：`finishGraphNode()` 现有的 `running → review`（`makeTransitioner(ctx)('node','review','output.submitted')`）那次迁移里，**仅当 `def.downstreamGate === true`** 同时写 `node.reviewReason = 'evidence'`；随后现有的 `saveLive(ctx)` 落盘，再 `pauseFor('after_output')`。→ `after_output` 暂停点可见 `待校验（核对证据）`。
2. **核对通过**：`finishArtifactNode()` 成功分支里，门控节点不迁 `done`，而是 `reviewReason = 'downstream'` + `endedAt = iso()` + emit `review.evidence_verified`（`result:'note'`），会话保持 `waiting_dependency`；**先 `consumeHandoff(ctx,'handoff.consumed')`（I1.2 同位置），再一次 `saveLive`**。
3. **下游首个 turn 帧**：`handleUpdate()` 里 `tracker.observeTurnEvent()` 返回 accepted 的那一帧，若 `源节点.state==='review' && 源节点.reviewReason==='downstream' && handoff.state==='accepted'`：源节点 `review → done`（`reason='review.downstream_accepted'`，detail 带 `round`）、源会话 `waiting_dependency → idle`。**改 live 状态 + 手工 emit `result='applied'`，不走 `transit()`**（它自带一次 CAS），由该帧现有的排队的 `saveLive` 一起落盘。

**否决**：在 `advance()` 里判下游是否接受 —— 下游接受是**帧事件**，`advance` 只在节点收尾后被调用，会晚一拍且要额外轮询；在 `advance` 里补一次 `saveLive` —— 两次 CAS，违反 C-09/NFR-03。

### 1.6 CLI 渲染的分流

**结论**：`render.js` 的新分支全部按 `productPolicy === 'doc-single'`（或 `template !== 'single' && template !== 'code-loop'`）门控：

- `nodeQualifier()` 判定顺序固定：`single` 短路 → `halted` → `review` 按 `reviewReason`（仅 `downstreamGate`）→ `failed` 且 `note === '等待复审'` → `failed` 兜底 `（等待复测）`。
- **新增分支必须排在 `halted` 之后**：现有实现把 `node.qualifier ?? node.note` 的查表放在 `halted` 判定之前，直接复用会让停止推进的实例丢掉 `（升级未记录）`。
- 后缀（`· 产物` / `· 审核 通过` / `· 审核 驳回 · 缺陷 N 条`）与新增的两支耗时（`review(downstream)`、`failed+等待复审`）**只在 `doc-single` 渲染**。
- `handoffStateLines` **不需要新分支**：现有函数在 `template !== 'single'` 时已带方向与 2/2/3 空格，`task-loop` 直接复用。
- `renderInterruptedNote()` 优先读 `snapshot.interruptedNodeId`，读不到回落 `snapshot.node`（`single`/`code-loop` 的旧快照都不带该字段）。

**否决**：为 `task-loop` 新写一套渲染函数 —— 会让 `single`/`code-loop` 的逐字样例行失去共享，回归风险翻倍；在 `render.js` 里复制一份状态名表 —— 违反 labels 唯一来源（NFR-09）。

### 1.7 夹具形态

**结论**：新增 `test/fixtures/task-loop-driver.mjs`，**复用** `code-loop-driver.mjs` 的三件事：`cleanEnv`（必须注入 `NODE_ENV='test'`，否则 `MAESTRO_TEST_*` 静默空转）、`--stop-after` 的轮询方式、退出码透传。`mock-acp-agent.js` 加 `--suite task-loop`，`--suite` 缺省时 I1.2 行为逐字不变。

**否决**：(a) 新写一套 mock 宿主 —— 会绕过 `host-config → stdio-transport → acp-client`，夹具失去可信度；(b) 在 driver 里直接改 `state.json` 造状态 —— I1.2 已明令禁止。

### 1.8 数据与兼容

**结论**：`schemaVersion` 仍为 `2`，全部为**追加字段**（`reviewReason` / `review` / `artifactHistory` / `artifactStem` / 交接包 `artifactRefs` 与 `revisionRequirement`）。旧状态缺字段按 `null` / `[]` 读取；v1 只读。

**否决**：升到 `schemaVersion: 3` —— 会让 I1.2 实例的读取路径分裂，且本迭代没有破坏性变更。

---

## 2. 模块划分与文件级契约

### 2.1 `src/templates/index.js`（改）

```js
// 角色：新增三项，coordinator 保持"只定义不派发"
ROLES.researcher = { roleId:'researcher', labelKey:'researcher', dispatchable:true,
  duty:'…', mustDeliver:['artifacts/reports/research-notes.v1.md'], prompt:'research' };
ROLES.writer    = { …, prompt:'write' };
ROLES.reviewer  = { …, prompt:'review' };

// 提示词：新增四段（research / write 首轮 / write 回流 / review）
PROMPT_TEMPLATES.research = '{task}\n\n研究笔记：artifacts/reports/research-notes.v1.md\n' +
  '写入路径：{writePath}\n只交研究笔记，不写最终文档。';
PROMPT_TEMPLATES.write = '{task}\n\n研究笔记：{researchRef}\n本轮文档引用：{docRef}\n' +
  '写入路径：{writePath}\n每一轮交完整文档，不要改写上一版。';
PROMPT_TEMPLATES.writeRevision =
  '{task}\n\n上一轮审核不通过，请按下列缺陷修改：\n{defectLines}\n修改要求：{revisionRequirement}\n' +
  '研究笔记：{researchRef}\n上一版文档引用：{previousRef}\n本轮文档引用：{docRef}\n' +
  '写入路径：{writePath}\n不得改写上一版文件。';
PROMPT_TEMPLATES.review = '{task}\n\n本轮文档引用：{docRef}\n工作区：{workspaceDir}\n' +
  '审核文件写入路径：{reviewPath}\n只认审核文件：{reviewSchema}\n' +
  '判定为 reject 时至少一条缺陷；判定为 pass 时 defects 必须为空。\n不要修改文档。';

export const REVIEW_REQUIREMENT = /* review.json 的 schema 提示，逐字见 D-8 */;
export const DEFAULT_REVISION_REQUIREMENT = '请按缺陷清单逐条修改后交出新版本';

// 图
GRAPHS['task-loop'] = {
  id:'task-loop', showTemplate:true, entry:'T-001', terminal:'T-003',
  terminals:['T-003'], maxRounds:{ 'T-001':1, 'T-002':2, 'T-003':2 },
  productPolicy:'doc-single',
  nodes:[
    { id:'T-001', nodeId:'T-001', roleId:'researcher', order:1, title:'研究员',
      artifactPolicy:'fixed-workspace', artifactDir:'artifacts/reports', artifactExt:'.md',
      products:['artifacts/reports/research-notes.v1.md'], downstreamGate:true,
      judge:'none', wakeFrom:[], prompt:'research' },
    { id:'T-002', nodeId:'T-002', roleId:'writer', order:2, title:'撰写者',
      artifactPolicy:'versioned-doc', artifactDir:'artifacts/docs', artifactExt:'.md',
      products:[], downstreamGate:true, judge:'none', wakeFrom:['backflow'], prompt:'write' },
    { id:'T-003', nodeId:'T-003', roleId:'reviewer', order:3, title:'审核者',
      artifactPolicy:'review', reviewPath:'out/review.json', products:[],
      downstreamGate:false, judge:'review', wakeFrom:['retest'], prompt:'review' }
  ],
  edges:[
    { from:'T-001', to:'T-002', kind:'forward',  condition:null },
    { from:'T-002', to:'T-003', kind:'forward',  condition:null },
    { from:'T-003', to:'T-002', kind:'backflow', condition:'review-reject', requiresHandoff:true },
    { from:'T-002', to:'T-003', kind:'retest',   condition:'reopen-failed-target' }
  ]
};

// promptFor：新键在前，既有 edge.kind 分支原样保留
export function promptFor({ graph, node, handoff, task, products, defects,
  retestRequirement, revisionRequirement, defectCount, artifactStem, round,
  workspaceDir, reviewPath } = {})
// 1) kind === 'backflow' → 原有分支（code-loop 不动）
// 2) kind === 'retest'   → 原有分支（code-loop 不动）
// 3) 新增：target.prompt === 'research' → research 模板
//    target.prompt === 'write'    → round <= 1 ? write : writeRevision（回流轮才填缺陷）
//    target.prompt === 'review'   → review 模板
// 4) target.prompt === 'single' → 原有 single 模板
// 5) 兜底：forward（+ verdict requirement），与 I1.2 逐字一致
```

**必须**：`task-loop` 的节点 `title` 只能是 `研究员`/`撰写者`/`审核者` 这三个中文（升级原因 `回流超上限：审核者已派发 2 次仍未通过` 由 `ESC_TEXT.roundsPrefix + title + …` 拼出，引擎里不许出现"审核者"字面量）。

### 2.2 `src/core/doc-artifact.js`（新增，纯函数 + 少量 IO）

```js
export const DOCS_DIR = 'artifacts/docs';
export const REPORTS_DIR = 'artifacts/reports';
export const RESEARCH_REF = 'artifacts/reports/research-notes.v1.md';

/** 任务里的产物声明：doc-single 专用，返回原文 token（用于逐字回显） */
export function parseProductDeclaration(task)
// → { ok:true, name:'release-notes.md', stem:'release-notes' }
// → { ok:false, code:'PRODUCT_LINE_MISSING_TASK_LOOP' | 'PRODUCT_INVALID_TASK_LOOP',
//      raw:'../release-notes.md' | null }
// 规则（D-8）：恰好一行全角 `产物：`；token 非空、无 / \ .. 盘符与控制字符、
// 以 .md 结尾、去掉 .md 后不以 .v<数字> 结尾。**不得复用 extractProductLines**。

/** 版本引用（唯一拼接点） */
export function docRef({ artifactDir = DOCS_DIR, artifactExt = '.md', stem, round })
// → `artifacts/docs/<stem>.v<round>.md`

/** 按节点策略解析本轮产物（唯一入口） */
export function resolveNodeProducts(def, { node = null, state = null, workspaceDir = null } = {})
// → { ok:true, baseDir, products:string[], policy:'fixed-workspace'|'versioned-doc'|'declared'|'heuristic' }
// → { ok:false, code, detail }
// fixed-workspace: products = def.products（原样）
// versioned-doc  : products = [docRef({...def, stem: state.artifactStem, round: node.round})]
// declared/heuristic: def.products 或 extractProductLines(state.task)
// review         : { ok:false, code:'NO_PRODUCTS' }（调用方走 readReview）

/** 上一版完整性（D-8 第 2 步） */
export async function verifyPrevious({ baseDir, ref, sha256, fs })
// → { ok:true } | { ok:false, code:'artifact_previous_missing'|'artifact_previous_modified', ref }

/** 文件指纹（流式，不读正文进内存） */
export async function sha256Of(absPath, { fs } = {})
// → { ok:true, sha256, bytes } | { ok:false, code:'READ_FAILED' }
```

### 2.3 `src/core/review.js`（新增）

```js
import { REVIEW_TEXT, ARTIFACT_TEXT } from '../cli/labels.js';

export const REVIEW_PATH = 'out/review.json';

export function parseReview(rawText)
// → { ok:true, review:{ decision, artifact, defects:[{summary,evidence}],
//      defectCount, revisionRequirement } }
// → { ok:false, code, stage, reasonCode, reasonDetail }

export async function readReview({ cwd, workspaceDir, expectedArtifact,
  roundStartedAt, fs, now })
// 11 步顺序严格按需求 D-7；命中即返回
// → 成功 { ok:true, review:{ decision, artifact, defects, defectCount,
//          revisionRequirement, reviewPath, readAt } }
// → 失败 { ok:false, code, stage, reasonCode, reasonDetail, reviewPath,
//          detail:{stage, reasonCode, message} }
```

**铁律**：只读 `decision` / `artifact` / `defects` / `revisionRequirement`；`defects` 不合法整份无效（不返回部分缺陷）；证据只 `stat` 不读内容；`#L<n>` 剥离后校验；绝对路径 / 盘符 / `..` 一律 `review_evidence_unreadable`；不做任何状态写入。

### 2.4 `src/core/verify-artifact.js`（改）

```js
export async function verifyProducts({ cwd, products, roundStartedAt, baseDir = cwd,
  sha256 = false, fs, now } = {})
// 返回 refs 元素：{ ref, absPath, exists, bytes, mtime, verifiedAt, sha256? }
// 前六字段一个都不能少、不能改名；sha256 关闭时**不生成该键**（不是 null）
```

`extractDeclaredArtifacts` / `verifyArtifacts`（I1.1 的启发式路径）**一行不动**。

### 2.5 `src/persistence/paths.js`（改）

```js
export function instanceWorkspaceDir(root, id) // <root>/.orch/instances/<id>/workspace
export function instanceDocsDir(root, id)      // …/workspace/artifacts/docs
export function instanceReportsDir(root, id)   // …/workspace/artifacts/reports
```

**禁止**其他模块手拼 `.orch/instances/...`（NFR-06）。

### 2.6 `src/core/advance.js`（改）

| 函数 | 改动 |
|---|---|
| `latestNodeId(nodes)` | 纳入 `state==='review' && reviewReason==='downstream'`（与 `orchestrator.latestEndedNodeId` 同步） |
| `classifyNodeOutcome(state, nodeId, verdict)` | `review && reviewReason==='downstream'` → `'passed'`；其他 `review` 仍 `'error'`；`failed` 且 `node.review?.decision` 存在时，`'pass'`→`'passed'`、`'reject'`→`'verdict-fail'` |
| `planAdvance({...})` | `verdict-fail` 分支：`defects = verdict?.defects?.length ? verdict.defects : node.review?.defects`；`revisionRequirement = verdict?.retestRequirement ?? node.review?.revisionRequirement`；`products` 改由 `resolveNodeProducts()` 提供（不再用会回退的 `productsOf`） |
| `buildHandoff({...})` | 追加 `artifactRefs`（`{input,output,previous}`）与 `revisionRequirement`；按边取值见 §3.3 |
| `buildBackflowHandoff` | 同上，且 `promptFor` 传 `revisionRequirement` |

### 2.7 `src/core/orchestrator.js`（改，最大）

| 位置 | 改动 |
|---|---|
| `latestEndedNodeId(state)` | 纳入 `review(downstream)` |
| `handoffToState(snapshot)` | 仅当源对象**确实带**该字段时投影 `artifactRefs` / `revisionRequirement`（与 `edge/defects/note` 同规则） |
| `applyHandoff` 的两处调用（`dispatchInState` 的 delivered、`consumeHandoff`） | 显式重组快照时把 `artifactRefs` / `revisionRequirement` 一起传入，否则 `accepted → consumed` 会抹掉 |
| `hasSubmittedOutput(ctx, def)` | `judge==='review'` → `readReview()` 判定；其余走 `resolveNodeProducts()`，`baseDir` 按策略取；**不再回退任务 `产物：` 行** |
| `finishGraphNode(ctx)` | `running→review` 迁移里，`def.downstreamGate` 时同写 `reviewReason='evidence'`；`def.judge==='review'` → `finishReviewNode` |
| `finishArtifactNode(ctx, def)` | 核对前 `round>1` 先 `verifyPrevious`；核对通过后按策略投影 `artifactRefs`、追加 `artifactHistory`；门控节点走 `downstream` 分支（不迁 done），非门控保持 I1.2 |
| `finishReviewNode(ctx, def)`（新增） | `expectedArtifact = ctx.handoff?.artifactRefs?.input[0] ?? 上游 artifactRefs[0].ref`；`readReview` → pass `done` / reject 未超限 `failed`+`note='等待复审'`+`endedAt` / reject 超限或无效 `escalate`；事件 `review.read`/`passed`/`rejected`/`invalid` |
| `handleUpdate(ctx, update)` | accepted 那一帧：源节点 `review→done` + 源会话 `waiting_dependency→idle`，手工 emit，帧内一次 `saveLive` |
| `startRun({...})` | 按 `graph.productPolicy` 校验产物行（D-8 的检查顺序 1~7）；建工作区、失败回滚本次实例目录；写 `state.artifactStem`；`WORKSPACE_INIT_FAILED` 加入 preflight |
| `applyCancel` 节点循环 | `node.reviewReason = null`（与 `endedAt` 同处） |
| `snapshotOf(state)` | 派生只读 `interruptedNodeId`：第一条 `running` 或 `review` 的节点 id，否则 `null`（**不落 state.json**） |
| `markHalted` 调用点 | 升级落盘失败时同时 `node.reviewReason = null`（维持不变式） |

**红线**：`driveGraph → finishGraphNode → advance → planAdvance` 不变；`finishGraphNode` 仍是唯一收尾入口。

### 2.8 `src/cli/labels.js`（改）

新增（逐字见 D-4/D-5）：`TEMPLATE_LABEL['task-loop']`、`ROLE_LABEL.{researcher,writer,reviewer}`、`NODE_QUALIFIER.{evidence_check,waiting_downstream,waiting_review}`、`ESCALATION_LABEL` 已有、`REVIEW_TEXT`（11 条）、`ARTIFACT_TEXT`（5 条）、`DEFAULT_REVISION_REQUIREMENT`、`REASON_LABEL` 新增 6 条（`review.read/passed/rejected/invalid/downstream_accepted/evidence_verified`）、`ERROR_TEMPLATE` 新增 3 条（`PRODUCT_LINE_MISSING_TASK_LOOP`/`PRODUCT_INVALID_TASK_LOOP`/`WORKSPACE_INIT_FAILED`）、`BACKFLOW_REVISION_LINE`。

**不许改**：既有 9 条 I1.1 `ERROR_TEMPLATE` 原文、`VERDICT_TEXT` 的 6 条、`formatDuration` 行为。

### 2.9 `src/cli/render.js`（改）

按 §1.6。`PLACEHOLDERS` **不扩项**（新文案只用既有的 `{name}` / `{cause}` / `{path}`）。`formatDuration(0)` 保持 `0s`；**已派发节点若 `startedAt` 与 `endedAt` 同毫秒，渲染层钳到 `1s`**（AC-35 的"不含耗时 0s"由此成立，`single`/`code-loop` 不经过该分支）。

### 2.10 `src/cli/main.js`（改）

`PREFLIGHT_CODES` 加 `WORKSPACE_INIT_FAILED`；退出码 `EXIT_SUSPENDED = 4`、`EXIT_HALTED = 5`；`run` 的收尾按 A-3 逐字（挂起三行 / 停止推进先一行错误再三行）；`status` 打节点表、会话行、交接包行、升级块。

### 2.11 `test/fixtures/mock-acp-agent.js`（改）

新增 `--suite task-loop`（经宿主 `launch.args` 传入）；step 支持 `artifact` / `artifactSkip` / `artifactUtimes` / `content` / `review` / `reviewSkip` / `reviewDecoy` / `reviewUtimes` / `mutatePrevious` / `remove` / `delayMs` / `hold.when='prompt'` / `hostError` / `sessionNew`。`--suite` 缺省时走现有 code-loop 分支，逐字不变。

**`reviewDecoy:'workspace'`**：从提示词的 `工作区：<绝对路径>` 取根再拼 `out/review.json`（v5 已把该行加进审核提示词）。

### 2.12 `test/fixtures/task-loop-driver.mjs`（新增）

```
node test/fixtures/task-loop-driver.mjs --root <绝对路径> --scenario <名>
  [--cwd <任务目录>] [--task <文本>] [--stop-after <n>] [--keep] [--prepare-only] [--reset]
```
- 只写 `<root>/.mock/` 与 `<root>/.orch/hosts/dsh.json`；实例一律由 `bin/orch.js run` 发起。
- `launch.args = [mockAgent, '--root', root, '--suite', 'task-loop', '--scenario', name]`。
- **必须** `cleanEnv` 注入 `NODE_ENV='test'`（否则暂停/定点/故障注入静默空转）。
- 除 `--prepare-only` 外**原样透传** `orch run` 的 stdout，并以同一退出码退出。

---

## 3. 数据模型

### 3.1 `task-loop` 的 `state.json`（两轮驳回后挂起，节选自实例）

```json
{
  "schemaVersion": 2,
  "instanceId": "INST-001",
  "state": "suspended",
  "stateSince": "2026-11-06T02:10:00.000Z",
  "createdAt": "2026-11-06T02:00:00.000Z",
  "cwd": "D:\\tmp\\maestro-i13\\demo-doc",
  "task": "写一篇发布说明…\n产物：release-notes.md",
  "template": "task-loop",
  "artifactStem": "release-notes",
  "halted": false,
  "rev": 23,
  "nodes": [
    { "nodeId": "T-001", "roleId": "researcher", "round": 1, "state": "done",
      "stateSince": "2026-11-06T02:00:04.000Z", "startedAt": "2026-11-06T02:00:01.000Z",
      "roundStartedAt": "2026-11-06T02:00:01.000Z", "endedAt": "2026-11-06T02:00:04.000Z",
      "failure": null, "note": null, "verdict": null, "sessionId": "mock-sess-1-1",
      "reviewReason": null, "review": null,
      "artifactRefs": [{ "ref": "artifacts/reports/research-notes.v1.md", "bytes": 812,
        "sha256": "9f2c…", "verifiedAt": "2026-11-06T02:00:04.000Z" }],
      "artifactHistory": [{ "round": 1, "ref": "artifacts/reports/research-notes.v1.md",
        "sha256": "9f2c…", "bytes": 812, "verifiedAt": "2026-11-06T02:00:04.000Z" }] },
    { "nodeId": "T-002", "roleId": "writer", "round": 2, "state": "done",
      "startedAt": "2026-11-06T02:00:04.000Z", "roundStartedAt": "2026-11-06T02:05:00.000Z",
      "endedAt": "2026-11-06T02:07:00.000Z", "note": null,
      "reviewReason": null, "review": null,
      "artifactRefs": [{ "ref": "artifacts/docs/release-notes.v2.md", "bytes": 2048,
        "sha256": "a1b2…", "verifiedAt": "2026-11-06T02:07:00.000Z" }],
      "artifactHistory": [
        { "round": 1, "ref": "artifacts/docs/release-notes.v1.md", "sha256": "c3d4…",
          "bytes": 1536, "verifiedAt": "2026-11-06T02:02:00.000Z" },
        { "round": 2, "ref": "artifacts/docs/release-notes.v2.md", "sha256": "a1b2…",
          "bytes": 2048, "verifiedAt": "2026-11-06T02:07:00.000Z" } ] },
    { "nodeId": "T-003", "roleId": "reviewer", "round": 2, "state": "escalated",
      "startedAt": "2026-11-06T02:03:00.000Z", "roundStartedAt": "2026-11-06T02:08:00.000Z",
      "endedAt": "2026-11-06T02:09:00.000Z", "failure": null, "note": null,
      "reviewReason": null,
      "review": { "decision": "reject", "defectCount": 2, "reviewPath": "out/review.json",
        "artifact": "artifacts/docs/release-notes.v2.md", "readAt": "2026-11-06T02:09:00.000Z",
        "defects": [
          { "summary": "缺少「回滚方案」一节", "evidence": "artifacts/docs/release-notes.v2.md#L1" },
          { "summary": "升级步骤没有说明旧数据迁移", "evidence": "artifacts/docs/release-notes.v2.md#L18" } ],
        "revisionRequirement": "补写「回滚方案」一节；说明数据迁移与回退顺序。" },
      "artifactRefs": [], "artifactHistory": [] }
  ],
  "sessions": [
    { "sessionId": "mock-sess-1-1", "nodeId": "T-001", "round": 1, "state": "idle",
      "stateSince": "2026-11-06T02:00:04.000Z", "createdAt": "2026-11-06T02:00:01.000Z" }
  ],
  "handoffs": [
    { "handoffId": "HO-001", "edge": { "from": "T-001", "to": "T-002", "kind": "forward" },
      "state": "consumed", "createdAt": "…", "deliveredAt": "…", "acceptedAt": "…",
      "consumedAt": "…", "rejectedAt": null, "rejectReason": null, "wakeConsumedAt": null,
      "acceptedSignal": "agent_message_chunk", "ambiguityWindowMs": 120,
      "defects": [], "note": null,
      "artifactRefs": { "input": ["artifacts/reports/research-notes.v1.md"],
        "output": "artifacts/docs/release-notes.v1.md", "previous": null },
      "revisionRequirement": null },
    { "handoffId": "HO-003", "edge": { "from": "T-003", "to": "T-002", "kind": "backflow" },
      "state": "consumed", "wakeConsumedAt": "2026-11-06T02:07:00.000Z",
      "defects": [ { "summary": "…", "evidence": "artifacts/docs/release-notes.v1.md#L1" } ],
      "artifactRefs": { "input": ["artifacts/docs/release-notes.v1.md"],
        "output": "artifacts/docs/release-notes.v2.md",
        "previous": { "ref": "artifacts/docs/release-notes.v1.md", "sha256": "c3d4…" } },
      "revisionRequirement": "补写「回滚方案」一节。" }
  ],
  "escalations": [
    { "escalationId": "ESC-001", "state": "pending", "nodeId": "T-003", "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：审核者已派发 2 次仍未通过",
      "defects": [ { "summary": "…", "evidence": "…" } ],
      "createdAt": "2026-11-06T02:09:00.000Z" }
  ],
  "counters": { "eventSeq": 71, "runCount": 1, "dispatchCount": 5 },
  "hostRaw": { "stopReason": "end_turn", "lastError": null, "agentInfo": null }
}
```

**约束**（NFR-08）：除 `cwd` 外无绝对路径、无文档正文；`artifactRefs` 只留 `{ref, bytes, sha256, verifiedAt}`。

### 3.2 `out/review.json` 样例与非法样本

合法通过：
```json
{ "decision": "pass", "artifact": "artifacts/docs/release-notes.v2.md", "defects": [] }
```
合法驳回：见 §3.1 的 `T-003.review`。

6 类非法（对应 D-7 的步）：

| 样本 | 命中步 | 机器码 |
|---|---|---|
| 文件不存在 | 1 | `REVIEW_MISSING` / `review_missing` |
| mtime 早于本轮 | 2 | `REVIEW_STALE` / `review_stale` |
| `{` 或 `[1,2]` / `null` | 4/5 | `REVIEW_UNPARSABLE` / `REVIEW_SCHEMA_INVALID` → `review_invalid` |
| `decision:"maybe"` | 6 | `REVIEW_DECISION_INVALID` → `review_invalid` |
| 缺 `artifact` | 7 | `REVIEW_ARTIFACT_MISSING` |
| `reject` + `defects:[]` | 9 | `REVIEW_REJECT_NO_DEFECTS` |
| 缺陷缺 `evidence` | 10 | `REVIEW_DEFECT_SHAPE` |
| 证据 `../outside.md#L1` | 11 | `REVIEW_EVIDENCE_UNREADABLE` |

### 3.3 交接包 `artifactRefs` 按边取值（唯一事实）

| 边 | `input` | `output` | `previous` |
|---|---|---|---|
| `T-001→T-002` forward | 源节点 `artifactRefs[0].ref` | `docRef({stem, round: 目标轮次})` | `null` |
| `T-002→T-003` forward | 源节点 `artifactRefs[0].ref`（= 本轮 v\<n\>） | `null` | `null` |
| `T-003→T-002` backflow | **目标轮次 n−1** → `v<n-1>`（不取 T-003.artifactRefs，它为空） | 目标轮次 n → `v<n>` | `{ref: v<n-1>, sha256: state.nodes[T-002].artifactHistory[n-1].sha256}` |
| `T-002→T-003` retest | 源节点 `artifactRefs[0].ref`（= v\<n\>） | `null` | `null` |

`revisionRequirement`：仅回流包有值，取 `node.review.revisionRequirement`，空则 `DEFAULT_REVISION_REQUIREMENT`。

### 3.4 事件 detail

| reason | detail |
|---|---|
| `review.read` | `{source:'file', path:'out/review.json', decision:'pass'\|'reject', results:<缺陷数>}` |
| `review.invalid` | `{reasonCode, stage, message}` |
| `review.downstream_accepted` | `{handoffId, fromNodeId, round}` |
| `review.evidence_verified` | `{ref, sha256}` |
| `backflow.constructed`（task-loop） | `{defects, revisionRequirement}`（渲染 `修改要求：`，不是 `复测要求：`） |

---

## 4. 工作包拆分（6 个，文件互不重叠）

### WP-1 模板与文案（契约层，无依赖）

- `src/templates/index.js`
- `src/cli/labels.js`
- `test/wp2/labels.test.js`
- `test/templates/task-loop.test.js`（新增：图结构、四边、maxRounds、`promptFor` 四段逐字片段）

验收：`REASON_LABEL` 39 条、`REVIEW_TEXT` 11 条、`ARTIFACT_TEXT` 5 条；`npx node --test test/wp2/ test/templates/task-loop.test.js` 全绿；`single`/`code-loop` 的模板对象逐字不变。

### WP-2 规则层（依赖 WP-1 的文案键）

- `src/core/review.js`（新增）
- `src/core/doc-artifact.js`（新增）
- `src/core/verify-artifact.js`（只加 `baseDir`/`sha256`）
- `src/persistence/paths.js`
- `test/wp10/review.test.js`（新增，11 步 + 注入 fs 桩覆盖 D-7 的第 3/5 步）
- `test/wp10/doc-artifact.test.js`（新增）
- `test/wp10/perf.test.js`（新增，NFR-02）
- `test/wp4/verify-artifact.test.js`（**既有断言一条不改**，只新增）

验收：`review.test.js` 覆盖 11 步与 6 类非法；`doc-artifact.test.js` 覆盖 5 条产物名规则与版本引用；`verify-artifact.test.js` 旧的 6 字段断言仍绿；p95 ≤ 50ms。

### WP-3 推进层（依赖 WP-1 + WP-2）

- `src/core/advance.js`
- `src/core/orchestrator.js`
- `src/adapter/session-state.js`（若需：`waiting_dependency` 的出边守卫）
- `test/wp4/orchestrator.test.js`
- `test/wp8/f2-reconcile.test.js`、`f3-cas.test.js`、`f5-hold.test.js`、`helpers.js`
- `test/templates/fake-graph.test.js`（仅 D-9 登记的键集合）

验收：`code-loop` 一轮/回流/上限三条事件序列与 I1.2 逐字一致；`task-loop` 的 `finishReviewNode` 三分支、下游门控（`review(evidence) → review(downstream) → done`）、`consumeHandoff` 字段保留、一次 CAS（`rev` 只 +1）。

### WP-4 CLI（依赖 WP-1 + WP-3 的快照字段）

- `src/cli/render.js`
- `src/cli/main.js`
- `test/wp6/render.test.js`
- `test/wp9/render-fixes.test.js`
- `test/wp9/cli-e2e.test.js`
- `test/perf/task-loop-timing.mjs`（新增，NFR-04）

验收：A-2 每类行逐字（含六种会话、带方向交接包、升级块、`[#seq]`）；`single`/`code-loop` 旧样例逐字（含 `renderInterruptedNote` 的两条既有用例）；退出码 4/5。

### WP-5 夹具（依赖 WP-1 的提示词文本）

- `test/fixtures/task-loop-driver.mjs`（新增）
- `test/fixtures/scenarios/*.json`（新增，29 个）
- `test/fixtures/mock-acp-agent.js`（加 `--suite task-loop`）
- `test/wp10/loop-fixture.test.js`（新增：`--prepare-only`、cursor 消费、mock 单跑一轮）

验收：29 个场景可独立运行；`--prepare-only` 写出 `.mock/cursor.json` 与 `.orch/hosts/dsh.json`；`--suite` 缺省时 I1.2 的 23 个场景逐字不变。

### WP-6 集成收口（依赖全部）

- 端到端跑通 `doc-pass` / `doc-backflow-once` / `doc-reject-twice`
- 修接缝（快照字段、事件 reason、退出码）
- 全量 `node --test "test/**/*.test.js"` 全绿
- `purity-check` 7 词扫描 exit 0

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/templates/index.js` | `task-loop` 图、三角色、四段提示词、`promptFor` 新分支 | WP-1 |
| `src/cli/labels.js` | 模板/角色/限定词/后缀/审核文案/事件原因/错误码 | WP-1 |
| `src/core/review.js` | 11 步校验器 | WP-2 |
| `src/core/doc-artifact.js` | 产物名、版本引用、上一版完整性、sha256 | WP-2 |
| `src/core/verify-artifact.js` | `baseDir` / `sha256` 追加 | WP-2 |
| `src/persistence/paths.js` | 三个工作区路径函数 | WP-2 |
| `src/core/advance.js` | 门控分类、按边取值、`buildHandoff` 新字段 | WP-3 |
| `src/core/orchestrator.js` | 审核收尾、下游门控、工作区、快照停点 | WP-3 |
| `src/cli/render.js` | 限定词、后缀、耗时、停点节点 | WP-4 |
| `src/cli/main.js` | 退出码 4/5、preflight | WP-4 |
| `test/fixtures/task-loop-driver.mjs` | 场景驱动 | WP-5 |
| `test/fixtures/scenarios/*.json` | 29 个场景 | WP-5 |
| `test/fixtures/mock-acp-agent.js` | `--suite task-loop` | WP-5 |
| `test/wp2/labels.test.js`、`test/wp4/*`、`test/wp6/render.test.js`、`test/wp8/*`、`test/wp9/*`、`test/wp10/*`、`test/perf/*`、`test/templates/*` | 测试同步 | 各包 |

---

## 6. 依赖与并行策略

```
WP-1（模板+文案，无依赖）
  ├─→ WP-2（规则层）      ┐
  └─→ WP-5（夹具）        ├─→ WP-3（推进层）→ WP-4（CLI）→ WP-6（收口）
                          ┘
```

- **第一批**：WP-1 单独开工（它是所有包的字面量来源，必须先冻结）。
- **第二批**：WP-2 与 WP-5 并行（文件零交集；WP-5 只依赖 WP-1 的提示词格式，不依赖 WP-2）。
- **第三批**：WP-3（同时依赖 WP-1 的图数据与 WP-2 的 `resolveNodeProducts` / `readReview`）。
- **第四批**：WP-4（依赖 WP-3 的 `snapshot` 新字段；可先按契约写、缺字段时兼容缺省）。
- **第五批**：WP-6 收口。

**契约先冻结点**：`GRAPHS['task-loop']` 的节点字段、`resolveNodeProducts` 的返回结构、`readReview` 的返回结构、`artifactRefs` 按边取值、`snapshot.interruptedNodeId`。这五处一旦冻结，WP-3/WP-4/WP-5 可并行。

---

## 7. 风险与降级

| # | 风险 | 影响 | 处置 |
|---|---|---|---|
| R1 | `orchestrator.js` 2912 行，`latestEndedNodeId` 有两处同名逻辑（orchestrator 与 advance） | 只改一处 → `advance` 选不到 `review(downstream)`，门控卡死 | WP-3 必须同时改两处，并加一条"两处返回值一致"的单测 |
| R2 | 下游门控走 `transit()` 会多一次 CAS | `rev` 跳 2，C-09/NFR-03 挂 | 帧内改 live + 手工 emit，由该帧 `saveLive` 落盘 |
| R3 | `hasSubmittedOutput` 回退任务 `产物：` 行 | T-002 被裸文件名误判为"已交卷"，导致提前核对失败 | 强制走 `resolveNodeProducts`；`doc-single` 禁止回退 |
| R4 | `artifactRefs` 按边取值错（backflow 的 `input` 用目标轮次） | AC-03/AC-08 红，且 6 个包各自实现一遍 | 以 §3.3 为唯一事实，`buildHandoff` 内部只调 `doc-artifact` |
| R5 | `single` / `code-loop` 输出回归 | AC-36 红线 | 新分支全部按 `productPolicy === 'doc-single'` 门控；每批跑 `test/wp9/cli-e2e.test.js` |
| R6 | 夹具漏 `NODE_ENV='test'` | 暂停/定点/故障注入静默空转，表现为 60s 超时 | `task-loop-driver` 复用 `cleanEnv`；`loop-fixture.test.js` 断言 `.mock/stopped-after-2` 出现 |
| R7 | `mock` 的 `reviewDecoy` 找不到工作区 | AC-13 的干扰文件写不出 | 审核提示词已加 `工作区：<绝对路径>`（v5），mock 只认这一行 |
| R8 | 真实面模型不按话术（第 1 轮不主动留缺陷） | AC-40 不稳定 | 允许最多 3 次重试；3 次不稳记为"真实面不稳定"，不阻塞（需求已写） |
| R9 | Windows `mtime` 精度与 `-120000` 偏移 | `review-stale` / `doc-stale` 偶发误判 | 偏移取 120s（远大于 1s 精度）；场景不加 `delayMs` |
| R10 | 29 个场景的 mock 扩展量大 | WP-5 拖期 | 场景 JSON 与 driver 分离，先做 `doc-pass`/`doc-backflow-once`/`doc-reject-twice` 三条主链，再补异常场景 |

---

## 8. 与需求 v5 的对齐声明

本文档不新增需求条目。所有逐字文案、状态名、错误码、AC 编号均以 `requirement.md` v5 为准；两者冲突时**以需求为准**并在实现回复中指出。复核报告 `review-v4-consistency.md` 的 20 项已在 v5 落地，本文档的契约（§3.3 按边取值、§1.5 一次 CAS、§2.2 不复用 `extractProductLines`）即其实现口径。
