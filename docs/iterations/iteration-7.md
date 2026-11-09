# I1.7 产物类型隔离 + 代码 worktree 集成 · 任务拆分与文件级契约

> 需求依据：`docs/iterations/iteration-7/requirement.md` **v2**（14 条 AC、BR-01~11、附录 A~D，评审 PASS）
> 上游实现：I1.6 收口（`docs/iterations/iteration-6.md`，HEAD `3f35bfa`），本迭代在其上增量落地 code worktree 隔离
> 评审依据：`docs/iterations/iteration-7/review-round2.md`（总判 PASS、F-01/F-02 闭合）
> 修订 v2：依 `split-review.md` F-01/F-02/F-03 将合并编排逻辑整体收归 WP-2 `src/core/code-isolation.js`（§2.2 增补合并队列/顺序/冲突/升级/重投/字段生命周期），§2.6 `orchestrator.js` 重写为最小契约调用钩子，§8 补 render.js/status-text.js/orchestrator 最小钩子授权外裁决（覆盖全部 9 个被改文件）

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：按角色声明的 `artifact_type` 把产物落到隔离区——`code` 走独立 git worktree（独立分支 + 核心顺序合并 + 冲突升级）、`document` 走版本化文件区、`dataset` 走快照区、`report` 走只追加区；既有三主链逐字不破。

**In scope**（对应需求 §1.3，逐条落位）：
- In-1 四类 `artifact_type` 隔离落地：`code`→worktree、`document`→版本化文件区、`dataset`→快照区、`report`→只追加区（AC-01~04 / BR-01~04）。
- In-2 代码角色独立 worktree+分支、核心托管顺序合并、进度可见（AC-05/06 / BR-01/05/09）。
- In-3 合并冲突检测 + 复用 I1.2/I1.4 升级机制（AC-08/09 / BR-07/09）。
- In-4 两条规划验收句可复现（AC-07/08 / BR-06/07）。
- In-5 边界（AC-10 / BR-08）、失败路径（AC-13/14 / BR-11）、可见性（AC-12 / BR-09）。

**Out of scope**（摘要，全表见需求 §1.3）：崩溃恢复/ACP 恢复方言（I1.8）、版本锁（I1.12+）、跨类型汇总裁决、真实 git 远程推送、worktree 生命周期清理（U-1）、冲突自动解决（Out-6）。

**退出标准**（逐条可判定，口径含数字/逐字）：
1. **全部 14 条 AC 有判定**：每条 AC 的逐字 Then（需求 §3.1）均有对应机检/夹具断言通过；规划验收句 AC-07/AC-08 在夹具现场实跑通过；失败路径 AC-13/AC-14 通过故障注入构造并通过；证据分级见 S3 验收产物。
2. **回归基线不破（仅允许授权清单变化）**：全量测试 `fail === 0 && pass === tests && tests >= 992`（下限断言，992 = HEAD `3f35bfa` 基线；8 条预存在环境敏感失败属已知，与本迭代无关，失败集合差集 = 0，即本迭代不得新增任何失败、亦不得删除既有已通过用例）；`src/templates/index.js` 仅 `ROLES.developer` 增 `artifact_type: 'code'`，三主链 `single`/`code-loop`/`task-loop` 输出逐字不变（AC-11）。
3. **回归红线（R-1~R-6）**：三主链输出逐字（R-1）、`doc-single` 文档闭环逐字（R-2，`artifacts/docs/<名>.v1.md` 与 `.v2.md` 并存且独立、`artifacts/reports/` 追加语义不变）、`package.json` 的 `dependencies` 恒为 `{}`（R-3）、`purity-check --forbid <31词>` 对 `src/core,src/daemon` 必 `exit 0`（R-4）、既有 AC 条数只增不减（R-5）、`resolveNodeProducts` 既有分支语义不动（R-6）；新行为打破既有精确断言一律扩清单/补测试，不许弱化断言或放宽 `Then`（D-7 L369）。
4. **架构扫描口径**：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>` 必须 `exit 0`；新增 `code-isolation.js` 不得出现 31 禁词、不得出现 `if host ==`；新增图/角色字面量只许落在 `src/templates/**`。
5. **NFR 全部满足**：NF-1 冲突绝不静默覆盖（升级队列可见）、NF-2 合并顺序/进度可见（不翻日志）、NF-3 零新增第三方依赖（`dependencies` 键数 = 0）。

---

## 1. 技术选型（结论 + 被否决项）

### 1.1 code 隔离用 git worktree 而非平铺目录
**结论**：每个 `code` 角色在 `<workspace>/worktrees/<roleId>` 建独立 git worktree，分支 `maestro/<instanceId>/<roleId>`（需求 D-1/D-2）。
**理由**：worktree 让多个角色在同一仓库各自检出不同分支、并行改动物理互不串扰；合并进集成线 `maestro/<instanceId>/integration` 可被 git 原生检测冲突。
**被否决**：平铺 `artifacts/code/<roleId>` 独立目录（基线 §5.2 示意形态）——它无法复用 git 冲突检测与分支语义，合并仲裁需自造，违背 BR-07「检测冲突」与 R-1 透明原则；需求 D-1 已明确 worktree 是基线示意的具体实现形态，不再另建平铺目录。

### 1.2 合并顺序由核心托管队列而非并发 merge
**结论**：code 节点 done 后入合并队列，核心按确定顺序（节点 order / 完成到达顺序，U-3）逐个 `git merge`，前一次完成/升级后才进行下一次，禁止并发（D-4）。
**理由**：并发 merge 会互相踩工作树、冲突判定不可复现；顺序队列保证 BR-05「不并发合并」、NF-2「可观测可复现」。
**被否决**：「分发即并发各自 merge」——冲突检测与回滚无法串接，违反 BR-05，且失败路径 AC-14 无法稳定构造。

### 1.3 冲突检测用 `git diff --name-only --diff-filter=U` / merge 退出码
**结论**：merge 后执行 `git diff --name-only --diff-filter=U`，或检查 `git merge` 退出码；unmerged paths 非空即冲突，随即 `git merge --abort` 回滚半成品合并，保留两角色 worktree 与分支（D-5）。
**理由**：git 原生、确定、可在 `/tmp` 本地仓库构造，无需真实 DSH/远程；与 B 类零 DSH 夹具面一致。
**被否决**：自解析文件三路合并内容——实现复杂且易错，违背「只检测 + 升级、不自动解冲突」（BR-07、Out-6）。

### 1.4 升级复用 I1.2/I1.4 escalation 不新造 UI
**结论**：冲突 / worktree 创建失败 / 合并异常 → 调用既有 `commitEscalation`（`src/core/escalation.js`），`reasonCode` 取 `merge_conflict` / `worktree_init_failed` / `merge_aborted`，节点入既有 `escalated` 态；用户用既有 `orch escalate list` / `orch escalate resolve` 处理（D-6）。
**理由**：复用既有状态机与 UI，不新增升级界面（BR-11、需求 §2.5），AC-09 直接复用 I1.4 命令族裁决。
**被否决**：新造「合并冲突」专用界面 / 新状态——违反「不新造 UI」与既有 `escalated→cancelled` 取消路径（I1.2），且扩大回归面。

### 1.5 artifact_type → 隔离策略映射复用既有 resolveNodeProducts
**结论**：在 `resolveNodeProducts` 仅新增 `code` 策略分支（返回 worktree 路径），`document`/`dataset`/`report` 沿用既有 `versioned-doc`/`declared`/`heuristic` 分支语义不变（D-3/D-7）。
**理由**：最小改动面，守住 R-6；`productPolicy: 'doc-single'` 行为不变。
**被否决**：把四类隔离都重写成全新模块——破坏既有 I1.3 文档闭环逐字基线（R-2），风险高且无收益。

### 1.6 dataset/report 落盘沿用基线命名、不引入新隔离机制
**结论**：`dataset` 快照区走新增 `instanceDataDir` → `<workspace>/artifacts/data`（与基线 §5.2 `data` 对齐）；`report` 继续落既有 `artifacts/reports`（D-1）。两者只靠路径函数隔离，不做 git 隔离（BR-08）。
**理由**：与基线 §1.5/§6 边界声明第 4 条「不对非编码任务强制 git 隔离」一致；AC-03/AC-04 仅断言路径隔离与追加语义。
**被否决**：为 dataset/report 也引入 worktree——违反 BR-08 且超出范围。

---

## 2. 模块划分与文件级接口契约

> 每个文件标注「新增 / 改 / 不改」与归属 WP。共享/既存文件（如 `src/core/orchestrator.js`、`src/cli/render.js`、`src/core/status-text.js`、`src/cli/labels.js`）均指定唯一负责人，其余包通过 §2 签名契约调用、不各自去改。

### 2.1 `src/persistence/paths.js`（改，WP-1）

- **导出签名（保持 + 新增）**：既有 `instanceDocsDir`/`instanceReportsDir`/`instanceSharedDir`/`instanceStageDir`/`instanceWorkspaceDir` 等**不变**；新增 `export function instanceCodeWorktreeDir(root, id, roleId)` 与 `export function instanceDataDir(root, id)`。
- **入参/出参**：`instanceCodeWorktreeDir(root, id, roleId)` → `<workspace>/worktrees/<roleId>`（即 `path.join(instanceWorkspaceDir(root, id), 'worktrees', roleId)`）；`instanceDataDir(root, id)` → `<workspace>/artifacts/data`（即 `path.join(instanceWorkspaceDir(root, id), 'artifacts', 'data')`）。`root`/`id`/`roleId` 为字符串，任一为空/非法按既有 `projectRoot`/`path.join` 口径处理（不静默回退）。
- **约束**：仅**追加导出**，不改动任何既有函数体（D-7 L373）；新增函数零 IO、零中文、零禁词；不出现 31 禁词（R-4）。归 WP-1 唯一所有。

### 2.2 `src/core/code-isolation.js`（新增，WP-2）

- **导出签名**：
  - `export async function ensureGitRepo(workspaceDir, { fs } = {})`：若 `<workspace>` 非 git 仓库则 `git init`，返回 `{ ok:true, created:boolean }` 或 `{ ok:false, code, cause }`。
  - `export async function createWorktree({ workspaceDir, instanceId, roleId, fs = nodeFs, execa = null } = {})`：执行 `git worktree add <worktreeDir> -b maestro/<instanceId>/<roleId>`，返回 `{ ok:true, branch, worktreeDir }` 或 `{ ok:false, code:'WORKTREE_INIT_FAILED', cause }`（分支名冲突/权限不足等归此类）。
  - `export async function mergeIntoIntegration({ workspaceDir, instanceId, roleId, fs, execa } = {})`：将 `maestro/<instanceId>/<roleId>` 合并进 `maestro/<instanceId>/integration`（fast-forward 或 `--no-ff`），返回 `{ ok:true, merged:boolean }` / `{ ok:false, code:'MERGE_CONFLICT'|'MERGE_ABORTED', conflictPaths? }`。
  - `export function detectConflict({ workspaceDir, fs } = {})`：`git diff --name-only --diff-filter=U` 或读取 merge 退出码，返回 `{ conflict:boolean, paths:string[] }`。
  - `export async function abortMerge({ workspaceDir, fs } = {})`：`git merge --abort`，返回 `{ ok:true }` / `{ ok:false, code }`。
  - `export function buildMergeEscalation({ nodeId, round, reasonCode, reasonDetail })`：`reasonCode ∈ {'merge_conflict','worktree_init_failed','merge_aborted'}`，返回 `src/core/escalation.js#buildEscalation` 同形状的升级条目（不落盘，由调用方提交）。
  - `export function createMergeQueue({ commitEscalation, getState, applyStateChange, fs = nodeFs, execa = null } = {})`：**本模块拥有的合并编排核心**。返回队列控制器 `{ enqueue(nodeRef), reprocess(escalationId), size() }`，按确定顺序（节点 order / 完成到达顺序，U-3）**逐个** `mergeIntoIntegration` + `detectConflict`——**前一次完成/升级后才进行下一次、禁止并发**（D-4）；命中冲突 → `abortMerge` 回滚半成品合并 + `buildMergeEscalation({reasonCode:'merge_conflict'})` + `commitEscalation`（节点 `escalated`，AC-08）；合并异常（工作树脏/被中断）→ `buildMergeEscalation({reasonCode:'merge_aborted'})` + `commitEscalation`（AC-14）；`escalate resolve` 裁决后将对应 `escalationId` 经 `reprocess` 重投队列再次 merge（AC-09）。`branch`/`mergeStatus`（`pending`/`merging`/`merged`/`conflict`）字段**经注入的 `getState`/`applyStateChange` 回调写回调用方状态**，**本模块不直接写 orchestrator 状态**（AC-12）。
- **入参/出参**：所有 git 操作为本地，仅 `init`/`worktree add`/`branch`/`merge`，**不 push、不 rebase/squash**（D-2）；`fs` 可注入（`node:fs/promises` 默认），`execa` 为可选命令执行注入（默认走 `node:child_process` 的 `spawn` 同步等价，命令串逐字含上述 git 参数）。`createMergeQueue` 的 `commitEscalation` 复用既有 `src/core/escalation.js#commitEscalation`；`applyStateChange` 形如 `({ nodeId, branch, mergeStatus }) => void`，由调用方（WP-4）注入以把字段写回 `state.nodes[]`。
- **约束**：**不得出现 31 禁词、不得出现 `if host ==` 分支**（D-7 L377）；零中文（文案一律经 `labels.js` 键渲染）；**合并顺序/无并发/冲突检测+abort+升级/合并异常升级/branch+mergeStatus 生命周期/escalate resolve 重投全部由本模块 `createMergeQueue` 实现，调用方（WP-4）仅契约调用、不再实现合并队列逻辑**；冲突检测与 `abort` 成对出现，保证半成品合并回滚、两 worktree/分支完整保留（AC-08/AC-14）。归 WP-2 唯一所有。

### 2.3 `src/core/doc-artifact.js`（改，WP-3）

- **导出签名（保持 + 新增分支）**：`resolveNodeProducts(def, context)` 既有 5 分支（`review`/`fixed-workspace`/`versioned-doc`/`declared`/`heuristic`）**语义不变**；新增 `if (policy === 'code')` 分支，返回 `{ ok:true, policy:'code', baseDir: instanceCodeWorktreeDir(root, id, roleId), products }`（经 WP-1 的 `instanceCodeWorktreeDir`），`root/id/roleId` 取自 `context.state` 与 `context.node`。
- **入参/出参**：`def.artifactPolicy` 新增取值 `'code'`；`context` 需额外携带 `instanceId`（已在 `state.instanceId`）。`code` 分支失败时返回既有 `fail(code)` 形状（`WORKSPACE_MISSING` 等）。
- **约束**：`code` 分支为**纯增量**，不修改其他分支语义（R-6）；`NODE_POLICIES` 冻结数组**不**强制扩展（避免影响既有校验），`code` 在 `def.artifactPolicy` 直接判定即可（若既有校验引用 `NODE_POLICIES`，则该处按兼容缺省允许 `code`）；零禁词。归 WP-3 唯一所有。

### 2.4 `src/templates/index.js`（改，WP-3）

- **导出签名（保持 + 一处字段）**：`ROLES` 冻结对象中 `ROLES.developer` 增加字段 `artifact_type: 'code'`（基于 `labelKey:'developer'` 的对象，仅该角色，不动 `tester`/`coordinator`/`researcher`/`writer`/`reviewer`）；`GRAPHS`/`getGraph`/`PROMPT_TEMPLATES`/`ROLES` 其余字段**零改动**（R-1/D-7 L372）。
- **入参/出参**：无（`Object.freeze` 常量表）；`code-loop` 的 `T-001` 节点 `artifactPolicy: 'declared'` 不变——`artifact_type` 是 role 级覆盖，node 级 `productPolicy/artifactPolicy` 行为不变（D-3：`code` 优先走 worktree，不受 `productPolicy` 限制）。
- **约束**：这是**唯一允许出现角色/模板名字面量**的文件（红线 6：`src/templates/**` 不扫纯净）；新增 `developer.artifact_type` 后，`code-loop` 既有编排输出（节点态、handoff、CLI 文案）逐字不变（R-1/D-7 L368）——worktree 隔离对既有编排断言透明。归 WP-3 唯一所有。

### 2.5 `src/core/workspace.js`（改，WP-4）

- **导出签名（保持 + 一段 if 分支）**：`prepareWorkspace({ root, instanceId, graph, state, fs })` 既有 doc-single 预建逻辑**不变**；在识别到图含 `artifact_type: 'code'` 的节点时，新增一段 `if` 分支：确保 `<workspace>` 为 git 仓库（调 WP-2 的 `ensureGitRepo`，或就地 `git init`），失败仍返回既有 `WORKSPACE_INIT_FAILED` 形状（退出码 3）（D-7 L374）。
- **入参/出参**：`graph` 遍历 `nodes[].roleId` → `ROLES[roleId].artifact_type` 判是否含 code；不预建 worktree（worktree 在派发节点时由 WP-4 调 WP-2 创建）。
- **约束**：仅补一段 `if`，不改动 doc-single 既有逻辑（R-2）；零禁词。归 WP-4 唯一所有。

### 2.6 `src/core/orchestrator.js`（改，WP-4）——唯一负责人（仅契约调用钩子）

> **定位**：合并编排逻辑（合并队列、code 节点派发 worktree、冲突检测+abort+升级、合并异常升级、`branch`/`mergeStatus` 字段生命周期、`escalate resolve` 重投）**全部在 WP-2 `src/core/code-isolation.js` 实现**（需求 D-7 L377 授权该模块拥有「合并队列、冲突检测」）。本文件**不实现**任何合并队列/冲突/升级逻辑，仅作为契约调用钩子串接。

- **钩子 1（code 节点派发）**：派发 code 角色节点时调 `code-isolation.createWorktree`；失败则经 `code-isolation.buildMergeEscalation({reasonCode:'worktree_init_failed'})` + 既有 `commitEscalation` 使节点入 `escalated`（AC-13）。
- **钩子 2（code 节点 done）**：节点完成后调 `code-isolation.createMergeQueue({ commitEscalation, getState, applyStateChange }).enqueue(nodeRef)`（或复用已持有的队列实例 `.enqueue`），将合并编排交给 WP-2 队列；队列内部顺序 merge、冲突 `abortMerge`+升级、异常 `merge_aborted` 升级、`branch`/`mergeStatus` 经注入的 `applyStateChange` 回调写回——本文件不再写合并逻辑（AC-06/AC-08/AC-14）。
- **钩子 3（`escalate resolve` 后重投）**：`orch escalate resolve` 裁决/手动合并重投后，调 `code-isolation` 队列的 `reprocess(escalationId)` 重新触发该节点合并（AC-09，复用 I1.4 升级机制，不新造入口）。
- **约束**：**合并队列/冲突/升级逻辑不在本文件实现（主责 WP-2）**；`branch`/`mergeStatus` 字段由 WP-2 经注入的 `applyStateChange` 回调写回，本文件不另写合并逻辑；节点态唯一入口 `transit()`（已有约束），新增 `branch`/`mergeStatus` 字段按兼容缺省（`stateAt` 旧快照缺字段按 undefined 处理，不影响既有 D-6 形状）；`code-loop` 既有精确断言若被 `resolveNodeProducts` code 分支影响，按 D-7 L369 **扩清单/补测试**而非弱化；零禁词（角色/模板名不落 `src/core`）。归 WP-4 唯一所有。

### 2.7 `src/cli/labels.js`（改，WP-5）——中文唯一来源

- **导出签名（保持 + 追加键）**：新增 7 个键（仅追加，既有键零改动）：`CODE_ROLE_BRANCH`（`<角色> 分支 {branch}`）、`MERGE_PENDING`（合并待执行）、`MERGE_MERGING`（合并中）、`MERGE_MERGED`（已合并）、`MERGE_CONFLICT`（冲突待升级）、`ESCALATION_REASON_MERGE_CONFLICT`（合并冲突）、`ESCALATION_REASON_WORKTREE_INIT_FAILED`（worktree/分支创建失败）（附录 A / D-7 L376）。
- **入参/出参**：均为 `Object.freeze` 常量/模板，由 `render.js`/`status-text.js` 经 `{branch}` 等占位替换读取；`ESCALATION_REASON_*` 接入既有 `REASON_LABEL` 或升级原因渲染通道（复用 I1.4 升级渲染）。
- **约束**：只追加、不改既有键（M-6 口径）；所有新增中文只在此文件（红线 10）。归 WP-5 唯一所有。

### 2.8 `src/cli/render.js`（改，WP-5）——唯一负责人

- **改动内容**：在 `orch instance status` / `orch instance graph --format json` 的节点行渲染里，对 code 角色节点追加「分支名 + 合并状态」片段（取自 `NODE_QUALIFIER`/`MERGE_*` 文案）；冲突升级条目经既有 `ESCALATION_BLOCK` 渲染，原因文案用新增 `ESCALATION_REASON_*`（AC-12/AC-08/AC-09）。
- **约束**：既有单/双链渲染逐字不动；新增片段按既有 `NODE_QUALIFIER` 括号包裹口径；零中文（文案一律来自 `labels.js`）。归 WP-5 唯一所有。

> **F-03 范围隔离（归 WP-5）**：上述 `branch`/`mergeStatus` 可见性追加**仅**作用于 `orch instance status` / `orch instance graph --format json` / `status.md` 三视图，绝不进入三主链（`single`/`code-loop`/`task-loop`）的运行期输出（节点态/handoff/CLI 文案）与回归快照；实现侧须确认 `run` 命令节点渲染路径与 `instance status` 节点渲染路径相互独立（或共用渲染函数加 `includeBranch` 开关防止回灌），确保不破 AC-11 / R-1。

### 2.9 `src/core/status-text.js`（改，WP-5）——唯一负责人

- **改动内容**：`renderStatusDoc(state, graph, options)` 在 code 角色节点的状态行追加分支名与合并状态（`CODE_ROLE_BRANCH`/`MERGE_*`），使 `status.md` 对用户可见（AC-12）。
- **约束**：既有 `renderStatusDoc` 非 code 节点输出逐字不变；仅对含 `branch`/`mergeStatus` 字段的节点追加片段；零禁词。归 WP-5 唯一所有。

> **F-03 范围隔离（归 WP-5）**：上述 `branch`/`mergeStatus` 可见性追加**仅**作用于 `status.md`（即 `renderStatusDoc` 产出）视图，绝不进入三主链（`single`/`code-loop`/`task-loop`）的运行期输出（节点态/handoff/CLI 文案）与回归快照；实现侧须确认 `run` 命令节点渲染路径与 `status.md` 渲染路径相互独立（或加 `includeBranch` 开关防止回灌），确保不破 AC-11 / R-1。

### 2.10 测试文件（新增，按 WP 归属）

| 文件 | 归属 | 类型 |
|---|---|---|
| `test/wp7/i17-paths.test.js` | WP-1 | 纯函数（内存拼接，不碰磁盘）：`instanceCodeWorktreeDir`/`instanceDataDir` 路径形状 |
| `test/wp7/i17-code-isolation.test.js` | WP-2 | `fs.mkdtemp(os.tmpdir())` 本地 git 仓库：worktree 创建/分支/合并/冲突检测/abort/escalation build |
| `test/wp7/i17-code-strategy.test.js` | WP-3 | 纯函数（内存）：`resolveNodeProducts` 的 `code` 策略返回 worktree 路径；`ROLES.developer.artifact_type==='code'` |
| `test/wp7/i17-labels.test.js` | WP-5 | 直接 `import { <新增键> }`：7 个新增键存在且文案非空、既有键不变 |
| `test/wp7/i17-regression.test.js` | WP-6 | 三主链重跑 + doc-single/task-loop 逐字 + 纯净复跑（见 §4 WP-6） |

> `test/wp4/orchestrator.test.js` 为 I1.6 既存 code-loop 回归/集成测试文件，**归 WP-4 唯一所有**：本迭代在该文件内按 D-7 L369 扩展 code-loop 场景的 worktree 路径断言（扩清单、不弱化），并补 code-isolation 集成用例；其余 `test/**` 一个字符不许改。

---

## 3. 数据模型

> **唯一事实来源**：① 实例 `state.json`（落盘，`src/core/orchestrator.js` 写 code 节点 `branch`/`mergeStatus`）；② worktree 目录 `<workspace>/worktrees/<roleId>` 与集成线分支 `maestro/<instanceId>/integration`（git 仓库内，不落 `state.json`）；③ `artifacts/data/<snapshot>` 与 `artifacts/reports/*`（文件系统）。以下为完整样例，含异常态。

### 3.1 `state.json`（含 code 角色的分支/合并状态 + 升级态，节选）

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "rev": 12,
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "escalated",
      "stateSince": "2026-11-09T10:00:00.000Z",
      "startedAt": "2026-11-09T09:58:00.000Z",
      "endedAt": "2026-11-09T10:00:00.000Z",
      "failure": null,
      "note": null,
      "verdict": null,
      "sessionId": "sess-001",
      "artifactRefs": ["worktrees/developer/a.py"],
      "branch": "maestro/INST-001/developer",
      "mergeStatus": "conflict"
    },
    {
      "nodeId": "T-002",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "branch": "maestro/INST-001/developer-b",
      "mergeStatus": "merged"
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-001",
      "round": 1,
      "reasonCode": "merge_conflict",
      "reasonDetail": "合并 maestro/INST-001/developer 入集成线时发生冲突",
      "defects": [],
      "state": "pending",
      "createdAt": "2026-11-09T10:00:00.000Z",
      "resolvedAt": null,
      "resolution": null,
      "voidedAt": null
    }
  ]
}
```

> 字段唯一事实：`branch`/`mergeStatus` 为 code 角色节点新增字段，旧快照缺字段按 `undefined` 兼容（不影响 D-6 既有形状）；`mergeStatus ∈ {pending, merging, merged, conflict}`；`escalations[].reasonCode` 新增三值（`merge_conflict`/`worktree_init_failed`/`merge_aborted`），与 I1.2/I1.4 既有 `execution_failed` 等共存。

### 3.2 产物文件 / 事件 / 快照样例

**worktree 目录（物理隔离）**
```
<workspace>/worktrees/developer/            # T-001 的 git worktree，分支 maestro/INST-001/developer
<workspace>/worktrees/developer/a.py         # 该角色独立改动，不进共享区/他人工作树
<workspace>/worktrees/developer-b/           # T-002 的独立 worktree，互不串扰（AC-05）
.git/  (集成线分支 maestro/INST-001/integration 在此仓库内)
```

**data 快照区（AC-03，按轮次独立命名）**
```
<workspace>/artifacts/data/dataset-role.r1.snapshot    # 第一轮快照
<workspace>/artifacts/data/dataset-role.r2.snapshot    # 第二轮独立快照，互不影响
```
> 命名指纹（U-2）由实现侧在 D-1 约束内决定（轮次或内容哈希均可），只要「每轮独立、互不影响」。

**reports 只追加区（AC-04，回归逐字）**
```
<workspace>/artifacts/reports/research-notes.v1.md     # 追加而非覆盖，文件持续累积
```

**事件样例（`events.jsonl`，复用既有 reason 词表 + 新增冲突 reason）**
```json
{"object":"node","objectId":"T-001","from":"running","to":"escalated","reason":"state.change"}
{"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","reason":"escalation.created","detail":{"nodeId":"T-001","round":1,"reasonCode":"merge_conflict"}}
```
> 冲突/创建失败/合并异常三类事件复用 `escalation.created` reason（I1.4 既有），`detail.reasonCode` 区分三类；不新增事件 reason 词。

---

## 4. 工作包拆分（WP-1 ~ WP-6，文件互不重叠）

> 6 个 WP 按**能力**切（不按目录切）；每个 WP 固定五字段。同一文件只属一个 WP；共享文件 `orchestrator.js`/`render.js`/`status-text.js`/`labels.js`/`workspace.js` 均指定唯一负责人，其余包通过 §2 签名契约调用。依赖成 DAG；每包自带契约测试，缺字段按契约兼容缺省。**所有 AC 的「验收口径」= 需求 v2 §3.1 同号 Then 逐字口径，本文档只登记 AC 编号、测试文件与逐字断言锚点，不复制、不改写、不合并、不放宽任何 Then。**

### WP-1 路径与 data 快照区基座（依赖：无）

- **负责文件（2）**：`src/persistence/paths.js`、`test/wp7/i17-paths.test.js`
- **依赖**：无（纯路径函数，契约先冻结后最先开工）
- **交付**：`instanceCodeWorktreeDir(root, id, roleId)` → `<workspace>/worktrees/<roleId>`；`instanceDataDir(root, id)` → `<workspace>/artifacts/data`；既有 5 个函数体零改动
- **验收口径**：AC-01/AC-03/AC-05 的路径落点部分、AC-10 的「非 code 不创建 worktree」反例（路径函数层面）；测试文件 `i17-paths.test.js`（内存拼接、不碰磁盘）；逐字断言锚点：worktree 路径恰为 `<workspace>/worktrees/<roleId>`、`instanceDataDir` 恰为 `<workspace>/artifacts/data`、既有 `instanceDocsDir` 等输出逐字不变；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 零 IO、零禁词、零中文、不依赖任何下游文件，是 DAG 的叶子

### WP-2 code-isolation 核心模块（依赖：WP-1）

- **负责文件（2）**：`src/core/code-isolation.js`、`test/wp7/i17-code-isolation.test.js`
- **依赖**：WP-1（`instanceCodeWorktreeDir` 路径形状）
- **交付**：`ensureGitRepo` / `createWorktree`（失败 `WORKTREE_INIT_FAILED`）/ `mergeIntoIntegration`（冲突 `MERGE_CONFLICT`、异常 `MERGE_ABORTED`）/ `detectConflict`（`git diff --name-only --diff-filter=U`）/ `abortMerge` / `buildMergeEscalation`（三 reasonCode）/ **`createMergeQueue`（合并队列：按确定顺序逐个 merge、前次完成/升级后才下一次、禁止并发、冲突 `abortMerge`+`merge_conflict` 升级、合并异常 `merge_aborted` 升级、`escalate resolve` 后 `reprocess` 重投、`branch`/`mergeStatus` 经注入的 `applyStateChange` 回调写回）**；仅本地 git、不 push、不 rebase/squash；零禁词（含英文注释）、零 `if host ==`
- **验收口径**：**合并机制主责归本包**——AC-06（合并顺序：队列顺序执行、无并发 merge、进度可观测由 WP-5 三视图呈现）、AC-07（不同文件顺序合并无覆盖）、AC-08（同文件冲突检测 + 半成品回滚 + 两 worktree 保留）、AC-13（创建失败返回 `WORKTREE_INIT_FAILED` 并 build 升级）、AC-14（合并异常 build `MERGE_ABORTED` 升级 + 回滚 + 改动保留）的「合并机制」部分均在本包 `createMergeQueue` 实现；AC-01/AC-05 的 worktree+分支创建亦在本包；测试文件 `i17-code-isolation.test.js`（`fs.mkdtemp` 本地 git，B 类零 DSH）；逐字断言锚点：worktree 目录存在、分支 `maestro/<instanceId>/<roleId>` 存在、`git merge` 后 `git diff --name-only --diff-filter=U` 非空即冲突、`git merge --abort` 后两 worktree 与分支仍在、合并队列顺序执行（前次完成/升级后才下一次）、冲突→`merge_conflict` 升级、异常→`merge_aborted` 升级、`reprocess` 重投再次 merge；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 只依赖 WP-1 已冻结的路径契约，用内存/临时仓库独立跑

### WP-3 隔离策略与角色契约（依赖：WP-1）

- **负责文件（3）**：`src/core/doc-artifact.js`、`src/templates/index.js`、`test/wp7/i17-code-strategy.test.js`
- **依赖**：WP-1（`instanceCodeWorktreeDir`）
- **交付**：`resolveNodeProducts` 新增 `code` 策略（返回 worktree `baseDir`，既有 5 分支语义零改动，R-6）；`ROLES.developer` 增 `artifact_type: 'code'`（`tester`/`coordinator` 等不动）；`code-loop` 编排输出逐字不变（R-1）
- **验收口径**：AC-01/AC-05 的「artifact_type→隔离映射」、AC-10 的「非 code 角色不进 git worktree（沿用版本化文件区）」；测试文件 `i17-code-strategy.test.js`（内存）；逐字断言锚点：`resolveNodeProducts({artifactPolicy:'code',...})` 返回 `baseDir` 等于 `<workspace>/worktrees/<roleId>`、`ROLES.developer.artifact_type === 'code'`、`ROLES.tester.artifact_type` 为 `undefined`、`code-loop` 用户可见编排输出（节点态/handoff/CLI 文案）逐字不变；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 只依赖 WP-1，与 WP-2 无共享文件

### WP-4 编排接入（orchestrator + workspace 唯一负责人）（依赖：WP-1 + WP-2 + WP-3）

- **负责文件（3）**：`src/core/workspace.js`、`src/core/orchestrator.js`、`test/wp4/orchestrator.test.js`
- **依赖**：WP-1（路径）、WP-2（worktree/merge/escalation build 契约）、WP-3（`resolveNodeProducts` code 策略 + `ROLES.developer.artifact_type`）
- **交付**：`prepareWorkspace` 补「含 code 角色则确保 workspace 为 git 仓库」的 `if` 分支（doc-single 逻辑不变，失败仍 `WORKSPACE_INIT_FAILED`）；**合并编排逻辑（合并队列/冲突检测+abort+升级/合并异常升级/`branch`+`mergeStatus` 生命周期/`escalate resolve` 重投）主责在 WP-2 `code-isolation.js`（§2.2 `createMergeQueue`）**；本文件仅作契约调用钩子：派发 code 节点调 `code-isolation.createWorktree`（失败经 `buildMergeEscalation({reasonCode:'worktree_init_failed'})`+`commitEscalation` 使节点 `escalated`）、code 节点 done 调 `code-isolation` 队列 `enqueue`、`escalate resolve` 后调队列 `reprocess` 重投合并；**禁止在 orchestrator 内实现合并队列/冲突/升级逻辑**
- **验收口径**：本包仅负责「**触发钩子 + 状态字段写入 + `escalate resolve` 重投触发**」，**不验收合并机制本身**（合并顺序/无并发/冲突检测+回滚+升级/合并异常升级/字段生命周期主责归 WP-2，见 WP-2 验收口径 AC-06/08/13/14）。具体：AC-09（WP-4 主责——`orch escalate resolve` 裁决后调 `code-isolation` 队列 `reprocess` 重投、节点继续、集成线含该文件改动）；AC-12 协作（WP-5 主责渲染、本包负责触发钩子使 `branch`/`mergeStatus` 经注入回调落盘、state 含该文字、冲突升级条目可见）；测试文件 `test/wp4/orchestrator.test.js`（按 D-7 L369 扩展 code-loop 场景 worktree 路径断言 + 补 code-isolation 集成用例，不弱化既有断言）；逐字断言锚点：合并队列前次完成/升级后才下一次（编排逻辑在 WP-2，本包仅断言钩子触发）、节点 `mergeStatus` 经 `MERGE_MERGED`/`MERGE_CONFLICT` 渲染、`escalations[].reasonCode` 三新增值、`NODE_ENV=test` 故障注入使 worktree 创建失败→升级生成、合并异常→升级生成且改动不丢失（经钩子触发断言）；按各 AC 同号 Then 逐字判定
- **可否并行**：否 —— 强依赖 WP-1/2/3 契约，且 `orchestrator.js`/`workspace.js` 为 I1.6 逐字回归（R-1/R-2）与新增 code 行为的共用大文件，须在下游契约冻结后单线改动

### WP-5 文案与可见性渲染（依赖：契约先冻结点 ①/④）

- **负责文件（4）**：`src/cli/labels.js`、`src/cli/render.js`、`src/core/status-text.js`、`test/wp7/i17-labels.test.js`
- **依赖**：契约先冻结点 ①（state 字段 `branch`/`mergeStatus` 形状）与 ④（三新增 `ESCALATION_REASON_*` 键名）——字段/键名由本文档定死，WP-5 据此渲染
- **交付**：`labels.js` 追加 7 键（`CODE_ROLE_BRANCH`/`MERGE_PENDING`/`MERGE_MERGING`/`MERGE_MERGED`/`MERGE_CONFLICT`/`ESCALATION_REASON_MERGE_CONFLICT`/`ESCALATION_REASON_WORKTREE_INIT_FAILED`，既有键零改动）；`render.js` 在 `orch instance status`/`graph --format json` 节点行追加分支名+合并状态、冲突升级条目复用 `ESCALATION_BLOCK` 渲染原因；`status-text.js` 在 `renderStatusDoc` 对 code 节点追加分支/合并状态；非 code 节点输出逐字不变
- **验收口径**：AC-01/AC-05/AC-12 的可见性（分支名、合并状态文字、冲突升级条目可见）、AC-08/AC-09/AC-13/AC-14 的升级原因文案（`ESCALATION_REASON_*`）；测试文件 `i17-labels.test.js`（直接 import 新增键）；逐字断言锚点：`MERGE_MERGED` 渲染「已合并」、`MERGE_CONFLICT` 渲染「冲突待升级」、`ESCALATION_REASON_MERGE_CONFLICT` 文案非空中文字符串、既有键计数与内容逐字不变、`orch instance status` 输出含 code 角色分支名与合并状态；按各 AC 同号 Then 逐字判定
- **可否并行**：可（与 WP-1/2/3 同批）—— 只消费冻结的字段/键名契约，不依赖 orchestrator 是否已写完（缺字段按兼容缺省渲染降级）

### WP-6 回归守护（三主链逐字 + 纯净 + 全量门禁）（依赖：WP-1~WP-5）

- **负责文件（1）**：`test/wp7/i17-regression.test.js`（新增）；另声明 test/templates/task-loop.test.js 与 test/wp4/orchestrator.test.js 为既有回归/集成文件、属**边界守护**（不可被本迭代改动破坏，WP-4 仅在后者内按 D-7 L369 扩清单、不弱化；两者均不计入 WP-6 的负责文件清单）
- **依赖**：WP-1~WP-5 全部合入
- **交付**：重跑三主链 `single`/`code-loop`/`task-loop` 并断言输出逐字不变（R-1）；重跑 `task-loop` 版本化文档与 `artifacts/reports/` 追加语义不变（R-2/AC-02/AC-04）；复跑 31 词纯净扫描与零依赖门禁（R-3/R-4）；全量测试下限断言 `tests >= 992` 且失败集合差集 = 0（R-5/AC-11）
- **验收口径**：AC-02（document 版本化逐字）、AC-04（report 追加逐字）、AC-11（三主链输出逐字、全量失败集合差集 = 0）；测试文件 `i17-regression.test.js`（`fs.mkdtemp` + 三主链 driver 在 `%TEMP%` 独立根）；逐字断言锚点：`artifacts/docs/<名>.v1.md` 与 `.v2.md` 并存且内容独立、`artifacts/reports/research-notes.v1.md` 追加语义不变、与 `origin/main` HEAD `3f35bfa` 的全量失败集合差集为 0、`dependencies` 键数 0、`purity-check --forbid <31词>` exit 0；按各 AC 同号 Then 逐字判定
- **可否并行**：否 —— DAG 汇合点，依赖全部就绪后末批单线合入并跑全量门禁

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-2 | WP-1、WP-3、WP-5 | code worktree+分支创建：路径(WP-1)/策略(WP-3)/渲染(WP-5) 协作 |
| AC-02 | WP-6 | — | 回归 · document 版本化文件区逐字不变 |
| AC-03 | WP-1 | — | dataset 快照区：`instanceDataDir` 路径落点 |
| AC-04 | WP-6 | — | 回归 · report 只追加区逐字不变 |
| AC-05 | WP-2 | WP-1、WP-3、WP-5 | 两 code 角色并行 worktree/分支独立不串扰 |
| AC-06 | WP-2 | WP-4 | 合并顺序由核心托管（WP-2 `createMergeQueue` 顺序执行、无并发 merge）；进度可见（WP-5 三视图渲染） |
| AC-07 | WP-2 | WP-4 | 验收句 1：不同文件顺序合并无覆盖 |
| AC-08 | WP-2 | WP-4、WP-5 | 验收句 2：同文件冲突检测 + 升级 + 回滚 |
| AC-09 | WP-4 | WP-2、WP-5 | 复用既有升级入口裁决后继续合并 |
| AC-10 | WP-3 | WP-1 | 非 code 角色不做 git 隔离（artifact_type 映射） |
| AC-11 | WP-6 | WP-4 | 回归 · 三主链逐字 + 全量失败集合差集 = 0 |
| AC-12 | WP-5 | WP-4 | 可见性：分支/合并/冲突在实例视图可见 |
| AC-13 | WP-2 | WP-4、WP-5 | 失败路径：worktree 创建失败→升级而非静默失败 |
| AC-14 | WP-2 | WP-4、WP-5 | 失败路径：合并异常→升级而非静默丢失改动 |

> 覆盖核对：AC-01~AC-14 连续编号、一行一条、无缺号无重复；每行至少一个主责 WP，跨包标协作 WP；合计 **14/14**。

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/persistence/paths.js` | 追加 `instanceCodeWorktreeDir`/`instanceDataDir`（既有函数不变） | WP-1 |
| `src/core/code-isolation.js` | 新增：git 仓库确保/worktree/分支/**合并队列（顺序执行、无并发、冲突 abort+升级、异常 merge_aborted 升级、reprocess 重投）/冲突检测/回滚/escalation build/**branch+mergeStatus 经注入回调写回** | WP-2 |
| `src/core/doc-artifact.js` | `resolveNodeProducts` 新增 `code` 策略分支（既有分支语义不变） | WP-3 |
| `src/templates/index.js` | `ROLES.developer` 增 `artifact_type: 'code'` | WP-3 |
| `src/core/workspace.js` | `prepareWorkspace` 补 code 角色确保 git 仓库的 `if` 分支 | WP-4 |
| `src/core/orchestrator.js` | 仅契约调用钩子（派发调 `code-isolation.createWorktree`、done 调队列 `enqueue`、escalate resolve 调 `reprocess` 重投）；合并编排逻辑主责在 WP-2 | WP-4 |
| `src/cli/labels.js` | 追加 7 个文案键（既有键不变） | WP-5 |
| `src/cli/render.js` | 实例状态/图渲染追加分支名+合并状态、冲突原因文案 | WP-5 |
| `src/core/status-text.js` | `renderStatusDoc` 对 code 节点追加分支/合并状态 | WP-5 |
| `test/wp7/i17-paths.test.js` | WP-1 契约测试（纯函数） | WP-1 |
| `test/wp7/i17-code-isolation.test.js` | WP-2 契约测试（本地 git 仓库） | WP-2 |
| `test/wp7/i17-code-strategy.test.js` | WP-3 契约测试（内存） | WP-3 |
| `test/wp4/orchestrator.test.js` | WP-4 集成测试（扩 code-loop worktree 断言 + 补 code-isolation 集成，不弱化） | WP-4 |
| `test/wp7/i17-labels.test.js` | WP-5 契约测试（import 新增键） | WP-5 |
| `test/wp7/i17-regression.test.js` | WP-6 三主链逐字 + 纯净 + 全量门禁 | WP-6 |

---

## 6. 依赖与并行策略

**DAG（文本图，依赖编号全部存在且无环）**

```
WP-1 (paths 纯函数，叶子)
  ├──> WP-2 (code-isolation，依赖路径形状)
  ├──> WP-3 (doc-artifact 策略 + developer artifact_type，依赖路径)
  └──> WP-4 (orchestrator + workspace，依赖 WP-1/2/3)

WP-5 (labels/render/status-text，依赖冻结的 state 字段 + 键名契约)
  └──> WP-4 (消费 branch/mergeStatus 渲染，仅契约依赖，可同批)

WP-4 ──> WP-6 (回归守护，依赖全部就绪)
WP-5 ──> WP-6
WP-2 ──> WP-4 ──> WP-6
WP-3 ──> WP-4 ──> WP-6
```

叶子：WP-1；汇合点：WP-6。无环，依赖编号 WP-1~WP-6 全部存在。

**分批顺序（一次最多 2 个 Agent）**

- **契约先冻结点（批次 0 之前，由本文档定死，不占 Agent 名额）**：见下方清单。
- **第 1 批（2 并行）**：WP-1（paths）+ WP-5（labels 追加键 + 渲染框架，基于冻结的字段/键名契约）。
- **第 2 批（2 并行）**：WP-2（code-isolation）+ WP-3（doc-artifact 策略 + developer artifact_type）。
- **第 3 批（1）**：WP-4（orchestrator + workspace 唯一负责人，强依赖 WP-1/2/3）。
- **第 4 批（1）**：WP-6（回归守护，依赖全部合入）。

**契约先冻结点**（必须先定死，冻住后其余包可并行）：
1. `paths.js` 两函数签名与返回形状：`instanceCodeWorktreeDir(root,id,roleId)` → `<workspace>/worktrees/<roleId>`；`instanceDataDir(root,id)` → `<workspace>/artifacts/data`（§2.1）。
2. `code-isolation.js` 六函数签名与返回形状，以及三 `reasonCode` 字符串常量 `merge_conflict`/`worktree_init_failed`/`merge_aborted`、失败码 `WORKTREE_INIT_FAILED`/`MERGE_CONFLICT`/`MERGE_ABORTED`（§2.2）。
3. `resolveNodeProducts` 的 `code` 策略返回 `{ok:true,policy:'code',baseDir:instanceCodeWorktreeDir(...),products}`，既有 5 分支语义零改动；`ROLES.developer.artifact_type === 'code'`（§2.3/2.4）。
4. `labels.js` 7 个新增键名与中文文案（§2.7）；state 字段名 `branch`/`mergeStatus` 与取值 `pending`/`merging`/`merged`/`conflict`（§3.1）。
5. `code-isolation.js` 合并队列语义（主责）：`createMergeQueue` 顺序执行、禁止并发 merge、冲突→`abortMerge`+`merge_conflict` 升级、异常→`merge_aborted` 升级、`escalate resolve` 后 `reprocess` 重投、`branch`/`mergeStatus` 经注入 `applyStateChange` 回调写回；`orchestrator.js` 仅契约调用钩子（派发调 `createWorktree`、done 调 `enqueue`、escalate resolve 调 `reprocess`，§2.2/§2.6）。

**整合检查点（每批合入后跑，给完整命令与预期数字）**

```bash
cd /Users/xuesh/www/Maestro

# 1) 全量测试（下限断言，不写死条数）
node --test "test/**/*.test.js"
#   预期：fail === 0 && pass === tests && tests >= 992（基线 992，只增不减；8 条预存在环境敏感失败与本迭代无关，失败集合差集 = 0）

# 2) 架构纯净（31 词逐字，R-4/AC-01~14）
FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"   # exit 0

# 3) 零依赖（R-3/NF-3/AC-11）
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"   # 输出 0

# 4) 三主链冒烟（AC-11，$TEMP 独立根；driver 内部即 bin/orch.js run --host mock）
SMOKE="$TEMP/i17-smoke"; mkdir -p "$SMOKE"
CODE_TASK=$'给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js'
DOC_TASK=$'写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md'
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$SMOKE/code" --scenario pass --cwd "$SMOKE/code/demo" --task "$CODE_TASK" --reset > "$SMOKE/code.out" 2>&1   # 退出 0
NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root "$SMOKE/task" --scenario doc-pass --cwd "$SMOKE/task/demo" --task "$DOC_TASK" --reset > "$SMOKE/task.out" 2>&1   # 退出 0
#   归一化后与 3f35bfa 基线逐字 diff（剔除夹具自述行 / mock-sess 会话号 / 耗时 Ns），预期三份 diff 为空（R-1）

# 5) 新增契约测试（WP-1~WP-5）
node --test test/wp7/i17-paths.test.js test/wp7/i17-code-isolation.test.js test/wp7/i17-code-strategy.test.js test/wp7/i17-labels.test.js   # 全绿

# 6) 回归守护（WP-6）
node --test test/wp7/i17-regression.test.js   # 全绿；断言 doc-single 逐字、全量失败集合差集 = 0
```

每批合入后预期数字汇总：**992 下限（只增不减）**、**0 运行时依赖**、**31 词纯净 exit 0**、**三主链输出逐字不变**、**14/14 AC**、**既有断言仅按 D-7 L369 扩清单（不弱化）**。

---

## 7. 风险与降级

> 逐条 `风险 | 影响 | 处置（点名文件 / 函数 / AC）`。

| # | 风险 | 影响 | 处置（点名文件 / 函数 / AC） |
|---|---|---|---|
| 1 | `paths.js` 新增函数误改既有函数体 / 引入禁词 | R-4/AC-01~14、回归红线 | WP-1：`instanceCodeWorktreeDir`/`instanceDataDir` 仅经 `path.join` 拼接，不动既有 5 函数；零中文、零禁词；`i17-paths.test.js` 断言既有 `instanceDocsDir` 等输出逐字不变 |
| 2 | `code-isolation.js` 出现 31 禁词或 `if host ==` 分支 | R-4/红线 6、AC-01~14 | WP-2：纯本地 git 操作，禁词/字面量只许在 `src/templates/**`；新增模块不得出现 `if host ==`；`i17-code-isolation.test.js` 用 `fs.mkdtemp` 本地仓库独立跑 |
| 3 | worktree 创建失败未升级而静默丢失 | BR-11/AC-13 | WP-2 `createWorktree` 失败返回 `WORKTREE_INIT_FAILED` 并 `buildMergeEscalation({reasonCode:'worktree_init_failed'})`；WP-4 调 `commitEscalation` 使节点 `escalated`、进程不异常退出 |
| 4 | 并发 merge 互相踩工作树 / 冲突判定不可复现 | BR-05/AC-06/AC-14 | WP-2 `createMergeQueue` **禁止并发 merge**，前次完成/升级后才下一次；WP-2 `mergeIntoIntegration` 单点执行；orchestrator 仅经钩子触发（§2.2/§2.6）；AC-06 断言队列顺序 |
| 5 | 冲突后未回滚半成品合并、丢失一方改动 | BR-07/AC-08/AC-14 | WP-2 `detectConflict` 命中即 `abortMerge`，保留两 worktree/分支；AC-08 断言 `git diff --name-only --diff-filter=U` 非空且两 worktree 仍在 |
| 6 | 给 `developer` 补 `artifact_type:code` 破坏 `code-loop` 逐字输出 | R-1/D-7 L368/AC-11 | WP-3：`ROLES.developer` 仅增字段，`code-loop` 节点 `artifactPolicy:'declared'` 不变；WP-4 按 D-7 L369 扩 `test/wp4/orchestrator.test.js` 的 code-loop 断言覆盖 worktree 路径，**不弱化**；三主链归一化 diff 为空 |
| 7 | `resolveNodeProducts` 误改既有 5 分支语义 | R-6/AC-02/AC-04 | WP-3：仅新增 `code` 分支，既有 `review`/`fixed-workspace`/`versioned-doc`/`declared`/`heuristic` 一行不改；`NODE_POLICIES` 冻结数组按兼容缺省允许 `code` |
| 8 | 新增中文散落到 `src/core`/`src/cli` 非 labels 文件 | 红线 10/AC-12 | WP-5：所有新增中文只在 `labels.js`；`render.js`/`status-text.js` 只引用键名渲染，文案零硬编码 |
| 9 | 合并队列/分支状态字段破坏 `state.json` 既有 D-6 形状 | R-1/AC-12 | WP-2 经注入的 `applyStateChange` 回调写回 `branch`/`mergeStatus`（code 节点新增字段，旧快照缺字段按 `undefined` 兼容）；WP-4 仅经钩子触发，节点态仍经 `transit()` 唯一入口；非 code 节点无新增字段 |
| 10 | 升级复用改坏 I1.2/I1.4 既有 `escalated→cancelled` 路径 | BR-11/AC-09/D-6 | WP-2/WP-4：复用 `src/core/escalation.js#commitEscalation`，`reasonCode` 仅作 `detail` 区分，不新增节点态、不新造 UI；AC-09 复用 `orch escalate resolve` 验证裁决后继续 |
| 11 | 三主链/全量测试回归（依赖收敛、perf 抖动） | R-1/R-5/AC-11 | WP-6 末批全量门禁：失败集合差集 = 0、tests >= 992（下限不写死）；偶发 `test/wp10/perf.test.js` 越线按 I1.5 口径先单跑诊断、不放宽预算 |
| 12 | 验收项目根放进仓库 / 验收产物卷进功能 commit | 模板 §5 第 21 条/红线 3 | 全部 AC 项目根 `%TEMP%`（`fs.mkdtemp`），绝不放仓库内；`evidence/**`/`probe/**` 由主控单独提交，禁止 `git add -A` |
| 13 | `purity-check` 误用 `DEFAULT_FORBID`（仅 I1.2 四词） | R-4/红线 6/AC-01~14 | 整合检查点第 2 组逐字传 31 词全表（`--forbid "$FORBID"`）；`src/core`/`src/daemon` 含英文注释也算命中 |
| 14 | 故障注入构造 AC-13/AC-14 现场不可复现 | AC-13/AC-14 | WP-2/WP-4 提供注入点（如 `execa` 注入让 `git worktree add`/`git merge` 失败）；验收经 `NODE_ENV=test` 注入，断言升级生成 + 改动保留 |

---

## 8. 与需求的对齐声明 / 冲突清单

本文档**不新增需求条目**。所有逐字文案、状态名、错误码、AC 编号、BR 编号均以 `requirement.md` v2 为准；两者冲突时**以需求为准**并在实现结论中指出。

**需求与代码现状的冲突及裁决**：

1. **冲突**：基线 `workspace.js` 的 `prepareWorkspace` 仅在 `productPolicy==='doc-single'` 预建产物区，未对 code 角色确保 git 仓库。**裁决**：在识别到 code 角色时补一段 `if`（仅 git 确保、不预建 worktree），doc-single 逻辑逐字不变（D-7 L374 / §2.5）。
2. **冲突**：`src/core/doc-artifact.js` 的 `resolveNodeProducts` 无 `code` 策略，无法把 code 产物指向 worktree。**裁决**：仅新增 `code` 分支，既有 5 分支语义零改动（R-6 / D-7 L375 / §2.3）。
3. **冲突**：`paths.js` 无 code worktree / data 快照路径函数。**裁决**：仅追加两函数，既有权重函数体不改（D-7 L373 / §2.1）。
4. **冲突**：内置 `developer` 无 `artifact_type`，code 隔离无内置角色触发（`src/templates/index.js`）。**裁决**：`ROLES.developer` 增 `artifact_type:'code'`（仅该角色），`code-loop` 输出逐字不变（R-1 / D-7 L372 / §2.4）。
5. **冲突**：`labels.js` 缺 AC-01/05/08/09/12/13/14 所需用户可见文案键。**裁决**：仅追加 7 个键，既有键不改（D-7 L376 / §2.7）。
6. **冲突**：需求给 `developer` 补 `artifact_type:code` 后，`code-loop` 主链输出须逐字不变——worktree 隔离对既有编排断言透明（R-1/D-7 L368）。**裁决**：`code-loop` 节点 `artifactPolicy:'declared'` 不变，`resolveNodeProducts` 的 code 分支只影响 `baseDir`；若 `test/wp4/orchestrator.test.js` 的 code-loop 精确断言因路径变化失败，**扩清单/补测试覆盖 worktree 路径，不弱化断言或放宽 Then**（D-7 L369）。

7. **冲突（授权外、本迭代受控变更）**：合并编排逻辑（合并队列、code 节点派发 worktree、冲突检测+abort+升级、合并异常升级、`branch`/`mergeStatus` 字段生命周期、`escalate resolve` 重投）如需落到 `src/core/orchestrator.js`，但该文件**不在 D-7 授权清单**（D-7 L371~377 仅点名 6 文件，并授权新增 `code-isolation.js` 拥有「合并队列、冲突检测」）。**裁决**：上述合并编排逻辑**整体收归 WP-2 `src/core/code-isolation.js`**（§2.2 `createMergeQueue`，与 D-7 L377 一致）；`orchestrator.js` **仅保留最小契约调用钩子**（§2.6：派发调 `createWorktree`、done 调 `enqueue`、escalate resolve 调 `reprocess`），**不实现合并队列/冲突/升级逻辑**；该最小钩子作为「D-7 授权外、本迭代受控变更」点名裁决，实现侧按 D-7 L369 只扩清单不弱化。

8. **冲突（授权外、本迭代受控变更）**：`src/cli/render.js`、`src/core/status-text.js` 不在 D-7 授权清单，但 AC-12 可见性必需——`render.js` 须在 `orch instance status`/`orch instance graph` 节点行追加分支名+合并状态，`status-text.js` 须在 `renderStatusDoc` 对 code 节点追加分支/合并状态（§2.8/§2.9）。**裁决**：此二文件作为「AC-12 必需、但超出 D-7 授权清单」的修改点，明确纳入本迭代受控变更，仅追加 code 节点分支/合并状态片段、零禁词、零中文（文案一律 `labels.js` 键）、非 code 节点逐字不变、不触 R-1/R-4；实现侧按 D-7 L369 只扩清单不弱化。> **F-03 范围隔离（归 WP-5）**：上述 `branch`/`mergeStatus` 可见性追加**仅**作用于 `orch instance status` / `orch instance graph` / `status.md` 三视图，绝不进入三主链（`single`/`code-loop`/`task-loop`）的运行期输出（节点态/handoff/CLI 文案）与回归快照；实现侧须确认 `run` 命令节点渲染路径与 `instance status`/`status.md` 节点渲染路径相互独立（或加 `includeBranch` 开关防止回灌），确保不破 AC-11 / R-1。

**实现侧自由裁量（U-1/U-2/U-3，均不阻塞开工，不影响 AC 判定）**：worktree 生命周期清理（实例终止保留/删除）、data 快照命名（轮次或内容哈希）、合并顺序细则（节点 order 优先或完成到达顺序优先）——由实现侧在 D-1/D-4 约束内定，须保证可观测、可复现、不破坏回归红线。

---

## 9. 拆分质量自检（§1.5 逐条勾选）

| # | 检查 | 结果 |
|---|---|---|
| 1 | 8 节齐全、标题与顺序一致（§0~§8） | ✅ 已按 §1.6 骨架：`迭代定位`/`技术选型`/`模块划分`/`工作包拆分`/`交付物清单`/`依赖与并行策略`/`风险与降级`/`对齐声明`（本文档增 §9 自检节，置于 §8 之后，不改动 0~8 顺序） |
| 2 | 每条 AC 都出现在某个 WP 的「验收口径」里 | ✅ 映射表 14/14，AC-01~AC-14 全部命中 |
| 3 | 每条 AC 都能在需求里找到同号 Then | ✅ AC-01~14 均对应 requirement.md §3.1 同号 Then |
| 4 | 所有 WP 的负责文件两两无交集 | ✅ WP-1~WP-6 文件清单零交集（paths/code-isolation/doc-artifact/templates/workspace/orchestrator/labels/render/status-text + 各 test 文件各归其主） |
| 5 | 依赖图无环，且每个 WP 的依赖编号都存在 | ✅ DAG 无环，依赖编号 WP-1~WP-6 全部存在 |
| 6 | §0 退出标准逐条可判定（有数字或逐字口径） | ✅ 含 `tests >= 992`、失败集合差集 = 0、`dependencies` 键数 0、31 词 `exit 0`、三主链逐字 diff 为空 |
| 7 | §2 每个文件都标注了归属 WP | ✅ 每个文件标题后标注（WP-x），测试文件于 §2.10 归属 |
| 8 | §6 有「契约先冻结点」与「整合检查点」 | ✅ §6 含 5 项契约先冻结点 + 6 组整合检查点命令 |
| 9 | §7 每条风险都有具体处置（点名文件/函数） | ✅ 14 条风险均点名文件/函数/AC |
| 10 | §8 声明「不新增需求条目，冲突以需求为准」 | ✅ §8 首句声明 + 8 条冲突裁决（D-7 授权内 6 + 授权外 3 文件收归/受控裁决） |

> 自检结论：§1.5 十项**全绿**。
