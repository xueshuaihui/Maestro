# Maestro V3.2 实现任务拆分规划（双机并行版）

> 生成时间：2026-11-28
> 原型提交：`0551b9e`（已合入本地 `main`）
> 任务基线：**本规划合入后的 `main` HEAD**（由 T00 在开工前公布并推送到 `origin/main`）
> 需求来源：`docs/index.md`（V3.2 口径，L80–L745）、`docs/maestro_v3_2_page_spec.md`（P00–P16 / §3–§9 / §13 / §16）
> 交互基准：`docs/maestro_v3_2_prototype.html`（1167 行，含 17 条验收用例落点表）
> 代码现状：引擎底座完整；V3.2 的 Work Item / Assignment / 两层 Session / Delivery 在 `src/` 中**完全没有**；`src/studio/` 的 Team / Employee 语义与 V3.2 冲突（见 §1.1）。

---

## 0. 使用前必读：执行协议（所有任务、两台机器统一遵守）

### 0.1 本次需求范围与非目标

**目标**：把 V3.2 原型中演示的行为实现为真实产品能力——真实 CLI 扫描、真实 Daemon API、真实 Task Assignment、真实 ACP 会话、真实恢复与审计，覆盖 P00–P16、§3–§9、§13 状态机、V32-01～V32-17 全部验收用例。

**非目标**（不要自作主张扩大范围）：

1. 不重写既有引擎（`src/core/**`、`src/daemon/server.js`、`src/persistence/**`、`src/adapter/**` 主体、`test/wp1`～`test/wp16`）。
2. 不改动 `docs/index.md`、`docs/maestro_v3_2_page_spec.md`、`docs/maestro_v3_2_prototype.html`——它们是冻结的规格与交互基准。
3. 不在本次把 `src/studio/**` v2 语义就地改造成 V3.2；采用 §1.1 的隔离新域方案。
4. 不引入第三方 npm 依赖（`package.json` 必须保持 `dependencies: {}`）。
5. 不做 Windows 签名、Release 发布、多语言；只交付功能实现与验证证据。

### 0.2 开工前置条件（主线负责人执行，一次即可）

本地 `main` 在原型提交 `0551b9e` 时已领先 `origin/main` **2 个提交**；本规划合入后领先 3 个。两台机器必须先拿到同一基线，否则功能分支起点不同：

```bash
cd /Users/xuesh/www/Maestro
git fetch origin
git push origin main                    # 把原型提交 + 本规划 + 前序提交一起推上去
git rev-parse HEAD                      # 两台机器都应从此 sha 建分支；T00 公布它作为 baseSha
```

> 未完成这一步前，**禁止**任何任务开始实现。每个任务的报告必须记录 `baseSha`（即 T00 公布的 sha）。

### 0.3 每个任务的固定实现流程（不得跳步）

| 步骤 | 动作 | 硬性要求 |
|---|---|---|
| 1 | 领取与建分支 | `git fetch origin` → `git switch main` → `git pull --ff-only origin main` → `git switch -c feature/v32-TXX-<slug> origin/main`；确认 `git rev-parse HEAD` 等于 §0.2 公布的基线（或已合入的前序任务 sha） |
| 2 | 读规格 | 读本任务「需求描述」列出的规格章节 + 原型对应函数（附录 A），逐条转成 REQ 清单 |
| 3 | 实现 | 只改「文件所有权」列出的路径；共享文件按 §1.2 归唯一任务所有 |
| 4 | 自测 | 写任务专属单测（文件名见任务详情），运行「验证清单」的命令；**不得删断言/降阈值** |
| 5 | 失败循环 | 按 §0.5 分类、修复、复跑，直到本任务全部验证项通过 |
| 6 | 提交 | `git add <仅本任务文件>` → `git commit -m "feat(v32): TXX <标题>"`；不 `--amend` 已合入提交 |
| 7 | 合入 main | `git fetch origin` → `git rebase origin/main` → 复跑验证 → `git switch main && git merge --ff-only feature/v32-TXX-<slug>` → `git push origin main` |
| 8 | 报告 | 写 `docs/v32/reports/TXX.md`（模板见 §0.6），再提交该报告（同一提交或紧随其后的独立提交均可） |

**禁止**：在 `main` 上直接改代码；跨任务改别人的文件；把未验证的代码合入；用 `git push --force`；把验证失败当 flake 上报而不做独占复跑。

### 0.4 双机并行与冲突避免

- 机器 A、机器 B 各自只认领「排程表」中分配给自己的任务；同一波次内两机文件集合**互斥**（见 §1.2）。
- 每个任务有**独占文件所有权**；若实现中发现必须改他人文件，停下来在报告中写 `BLOCKED`，由主线负责人裁决，不自行越界。
- 同步点（§3.2）：每完成一个波次，两机都 `git fetch`，确认 main 已包含对方任务；跨模块的集成断言在同步点补，不提前写死对方尚未实现的行为。
- 所有任务以 §1.3 契约为准并行开发；契约未覆盖的字段**先追加到 `src/v32/contracts.js`（T01 所有）并通知另一机**，不要各自加私有字段。

### 0.5 失败循环与差集纪律（验证不通过时照此执行）

1. **先分类**：① 契约不符（本任务 bug）；② 断言写法问题；③ 负载型 flake；④ 前序任务未合入导致的环境缺失。
2. **flake 证伪**：使用 `NODE_ENV=test TMPDIR=/tmp/v32t node --test --test-concurrency=1 <文件>` 独占复跑 2 次；两次都绿才登记 flake，并在报告写清原始失败帧。
3. **差集判定**：全量回归看「失败集合差集 = 0」，不是硬写 `fail === 0`。基线对照 `git worktree add /tmp/v32base origin/main` 出来的树，**不是**本分支合入前的旧帧；同名失败若 `failureType` 从 `EBUSY` 变成断言失败，算**新增红**。
4. **不得**：改冻结用例标题；把 `deepEqual` 放宽为子集；删除失败用例；新增测试时硬编码测试条数（用 `tests >= 基线 && pass === tests`）。
5. 修复后从步骤 4 重跑；循环直到本任务「验证清单」全绿，才进入提交与合入。

### 0.6 证据与报告规范

每任务写 `docs/v32/reports/TXX.md`，模板：

```markdown
# TXX <标题> 完成报告
- baseSha: <建分支时的 sha>
- headSha: <合入提交 sha>
- 机器 / 任务窗口: A | B
- 需求逐条结论: TXX-R1 PASS / TXX-R2 PASS / ...（FAIL 需写原因与修复轮次）
- 验证命令与结果: 命令原文 + 关键摘要行 + 失败集合差集结论
- 证据分级: 已实测（真实宿主） / mock 实测 / 阻塞（三选一，附可复核原始帧路径）
- 已知偏差 / 未覆盖: 无则写「无」
- 合入后 main sha: <sha>
```

**证据落盘红线**：测试默认写 `%TEMP%` / `TMPDIR=/tmp/v32t`；**不得**写 `docs/iterations/**/evidence/**`（历史教训：会改写其它迭代证据）。原始帧放 `docs/v32/reports/raw/TXX/`，且 `.gitattributes` 不对其做空白 strip。

### 0.7 全局技术红线（每条任务都要遵守）

1. V3.2 领域状态写入**唯一入口**是 `store.transit()`；引擎实例状态仍只走 `orchestrator.transit()`（`src/core/orchestrator.js:947`），严禁直接 `store.save` 改引擎状态。
2. 事件**先落盘再广播**；事件 `ts` 与状态变更同一时刻；事件带 `prevHash/hash` 哈希链。
3. `Prepared` 不建任何 Session；`Locked` 才开始创建/唤醒会话；人工节点永不建 Session、不选 CLI。
4. 恢复策略 A 失败时保持 `interrupted` 并写审计，**禁止静默降级**为策略 B。
5. `src/core/**`、`src/daemon/**`、`desktop/ui/**` 零 CJK 字面量（含注释、全角标点）；文案走 `ctx.t('V32_...')` / `ctx.st(...)`，且键必须真的被 `GET /ui/labels` 下发。macOS 上 `grep -P` 不可用，自查用 `python3 -c` 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]`。
6. 图/角色字面量只能出现在 `src/templates/**`；V3.2 的角色/节点数据来自 `src/v32/contracts.js` 的枚举与 API，**不得**在 core/daemon 写死岗位名。
7. 测试环境变量：`NODE_ENV=test`（`/__test__/*` 接缝按它注册），`TMPDIR` 用短路径（POSIX `sun_path` 104 字节上限）。
8. 全量命令：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"`（引号必须保留；`npm test` 会 MODULE_NOT_FOUND）。
9. 门禁：`node scripts/desktop/gate.mjs`；基线 1157 条、9 条允许失败、测试数只增不减、`dependencies={}`、31 词纯净双扫、版本三处对齐。

---

## 1. 架构决策与模块边界

### 1.1 为什么新增 `src/v32/` 而不是就地改 `src/studio/`

现状事实（已核对）：

- `src/studio/schema.js:129` 的 `emptyStudio()` 只有 `{departments, roles, employees, sessions, teams, flows, tasks, defects, changes, runs}`，**无 workItems / assignments / deliveries**。
- `src/studio/team.js:59,71` 的 Team 带 `flowId`（V3.2 §3.1 明确禁止）；`src/studio/org.js:138-148` 的 Employee 强制 `cliId` 且单 `roleId`（V3.2 §1.2 / §3.2 禁止与限制）。
- `src/studio/org.js:189 openSession` 只是 `mode:'record'` 的语义记录，无两层会话。
- `test/wp17`、`test/wp18` 与 `scripts/verify-authoring-ui.mjs` 大量冻结 v2 Studio 行为；就地改会同时撞红几十条冻结用例。

因此：**V3.2 作为独立领域模块实现**，自持 CAS 存储与 HTTP 路由；桌面壳新增 V3.2 页面并让其成为业务主入口；v2 Studio 保留但不再是 V3.2 链路的一部分。引擎底座通过 `src/v32/bridge.js` 单向复用，不改引擎源码。

### 1.2 目录与文件所有权总表（并行防冲突的关键）

| 所有者 | 独占路径（其它任务禁止修改） |
|---|---|
| T01 | `src/v32/contracts.js`、`ids.js`、`errors.js`、`store.js`、`events.js`、`audit.js`、`index.js`（骨架）、`test/wp21/v32-contracts.test.js`、`v32-store.test.js`、`v32-events.test.js`、`test/wp21/fixtures/v32-*.json` |
| T02 | `src/v32/cli-pool.js`、`src/daemon/http/v32/cli-routes.js`、`desktop/ui/v32/cli-page.js`、`test/wp21/v32-cli-pool.test.js` |
| T03 | `src/v32/roles.js`、`src/daemon/http/v32/roles-routes.js`、`desktop/ui/v32/roles-page.js`、`test/wp21/v32-roles.test.js` |
| T04 | `src/v32/employees.js`、`src/daemon/http/v32/employees-routes.js`、`desktop/ui/v32/employees-page.js`、`test/wp21/v32-employees.test.js` |
| T05 | `src/v32/teams.js`、`src/daemon/http/v32/teams-routes.js`、`desktop/ui/v32/teams-page.js`、`test/wp21/v32-teams.test.js` |
| T06 | `src/v32/workflows.js`、`src/v32/graph.js`、`src/daemon/http/v32/workflows-routes.js`、`desktop/ui/v32/workflows-page.js`、`test/wp21/v32-workflows.test.js`、`test/wp21/v32-dag.test.js` |
| T07 | `src/v32/work-items.js`、`src/v32/preflight.js`、`src/daemon/http/v32/work-items-routes.js`、`desktop/ui/v32/work-items-page.js`、`desktop/ui/v32/wizard.js`、`test/wp21/v32-work-items.test.js`、`v32-preflight.test.js` |
| T08 | `src/v32/mapping.js`、`src/daemon/http/v32/mapping-routes.js`、`desktop/ui/v32/mapping-panel.js`、`test/wp21/v32-mapping.test.js` |
| T09 | `src/v32/assignments.js`、`src/daemon/http/v32/assignments-routes.js`、`desktop/ui/v32/assignment-panel.js`、`test/wp21/v32-assignments.test.js` |
| T10 | `src/v32/sessions.js`、`src/v32/bridge.js`、`src/daemon/http/v32/sessions-routes.js`、`desktop/ui/v32/session-panel.js`、`test/wp21/v32-sessions.test.js`、`v32-bridge.test.js` |
| T11 | `src/v32/runs.js`、`src/daemon/http/v32/runs-routes.js`、`desktop/ui/v32/run-page.js`、`desktop/ui/v32/activity-panel.js`、`test/wp21/v32-runs.test.js` |
| T12 | `src/v32/recovery.js`、`src/daemon/http/v32/recovery-routes.js`、`desktop/ui/v32/recovery-panel.js`、`test/wp21/v32-recovery.test.js` |
| T13 | `src/v32/human-gates.js`、`src/daemon/http/v32/human-routes.js`、`desktop/ui/v32/human-gate-dialog.js`、`test/wp21/v32-human.test.js` |
| T14 | `src/v32/delivery.js`、`src/v32/records.js`、`src/daemon/http/v32/records-routes.js`、`desktop/ui/v32/records-page.js`、`desktop/ui/v32/delivery-dialog.js`、`test/wp21/v32-delivery.test.js`、`v32-audit.test.js` |
| T15 | `src/daemon/http/v32-routes.js`、`src/daemon/http/routes.js`（仅加挂载两行）、`test/wp21/v32-api-contract.test.js` |
| T16 | `desktop/ui/shell/nav.js`、`shell/index.js`、`shell/chrome.js`、`shell/pages.js`、`desktop/ui/app.js`、`desktop/ui/v32/index.js`、`desktop/ui/v32/v32.css`、`src/daemon/http/labels.js`、`src/cli/labels.js`、`test/wp21/v32-labels.test.js`、`test/wp13/v32-shell.test.js` |
| T17 | `scripts/verify-v32.mjs`、`test/wp21/v32-acceptance.test.js`、`package.json`（只加 `verify:v32` script）、`docs/v32/reports/acceptance.md` |
| T18 | `docs/v32/reports/final-verification.md`（不新增源码；只做全量回归与门禁复跑） |
| 主线负责人 | `docs/maestro_v3_2_implementation_plan.md`（本文档，只读）、`.workbuddy/memory/**`、分支合并裁决 |

**共享但只读的既有模块**（任何任务都不得修改）：`src/core/**`、`src/persistence/**`、`src/adapter/cli-discovery/**`、`src/daemon/server.js`、`src/templates/**`、`scripts/desktop/gate.mjs`。若确需改动，写入报告 `BLOCKED` 交给主线负责人。

### 1.3 统一契约（所有任务按此实现，T01 负责落成代码）

#### 1.3.1 存储与事件

```js
// src/v32/contracts.js（T01 导出，其他任务 import，不要自行复制常量）
export const V32_SCHEMA_VERSION = 1;
export const V32_STATE_FILE = '.orch/v32/state.json';
export const V32_EVENTS_FILE = '.orch/v32/events.jsonl';
export const V32_AUDIT_FILE = '.orch/v32/audit.jsonl';

export const ID_PREFIX = Object.freeze({
  role:'ROLE', employee:'EMP', team:'TEAM', workflow:'WF', workItem:'WI',
  run:'RUN', task:'TASK', assignment:'ASSIGN', employeeSession:'ES',
  hostBinding:'HB', attempt:'ATT', artifact:'ART', event:'EVT', audit:'AUD'
});

export const WORK_ITEM_STATUS = Object.freeze([
  'draft','configured','ready_to_run','running','waiting_human','blocked',
  'ready_for_acceptance','accepted','delivered','cancelled'
]);
export const TASK_STATUS = Object.freeze([
  'waiting_dependency','ready','assignment_prepared','preflight','creating_session',
  'waiting_queue','running','succeeded','human_waiting','interrupted','blocked',
  'failed','cancelled','skipped'
]);
export const ASSIGNMENT_STATUS = Object.freeze([
  'draft','prepared','preflight','locked','released','failed'
]);
export const ASSET_STATUS = Object.freeze(['draft','published','deprecated']);
export const NODE_TYPES = Object.freeze(['agent','human']);
export const AUDIT_TYPES = Object.freeze([
  'role.published','employee.updated','team.published','team.deprecated',
  'workflow.published','workflow.deprecated','work_item.created','plan.revised',
  'mapping.changed','assignment.locked','session.created','recovery.succeeded',
  'recovery.failed','human.approved','delivery.accepted','delivery.delivered'
]);
```

状态文件结构（顶层数组固定，新字段只能追加在末尾）：

```js
{
  schemaVersion: 1,
  rev: <number>,                 // 每次 transit +1，重启不回退
  updatedAt: <ISO string>,
  roles: [], employees: [], teams: [], workflows: [],
  workItems: [], assignments: [], sessions: {employees:[], hostBindings:[], attempts:[]},
  runs: [], deliveries: [], cliPool: {installs:[], scan:{mode,startedAt,finishedAt,status}},
  artifacts: []
}
```

Store API（唯一写入口）：

```js
const store = createV32Store({ root, now: () => new Date().toISOString() });
store.read();                                   // 返回深拷贝快照
store.get(kind, id); store.list(kind);
store.transit(mutator, { expectedRev, reason, actor });
//  mutator(draft) 内只能改 draft；返回 { ok:true, value, events?:[] } 或 { ok:false, code, params }
//  成功：原子写 state.json（rev+1）→ 追加 events.jsonl / audit.jsonl → 再广播
store.appendEvent(event); store.appendAudit(event);  // 仅供 transit 内部调用
store.events({ workItemId, runId, type, limit }); store.audit({ type, limit });
```

对象形状（最小字段，允许追加；**禁止**出现「不该保存的字段」列）：

| 实体 | 必需字段 | 禁止字段 |
|---|---|---|
| Role | `id,name,description,duties,skills[],inputs[],outputs[],requires{},acceptance[],version,status,versions[]` | 员工 / 团队 / CLI ID |
| Employee | `id,name,description,qualifications:[roleId],enabled,createdAt,updatedAt` | `cliId`, `teamId`, `sessionId`, 单一 `roleId` |
| Team | `id,name,description,version,status,versions[],members:[{employeeId,roles[],primary,priority,participate,capacity}],createdAt` | `workflowId`, CLI / Session 字段 |
| Workflow | `id,name,description,version,status,kind,nodes[],edges[],versions[],createdAt` | `employeeId`, `teamId`, `cliId` |
| Node(agent) | `id,type:'agent',name,roleId,instruction,inputs[],outputs[],deps[],capabilities{},acceptance[],timeout,failurePolicy,retry,fallback,handoff,condition` | 员工 ID / CLI ID |
| Node(human) | `id,type:'human',name,human:{approver,mode,condition},inputs[],outputs[],deps[],acceptance[]` | `roleId` 之外的执行人/CLI/Session |
| WorkItem | `id,title,description,background,goal,projectDir,attachments[],priority,creator,createdAt,status,workflowSnapshot,teamSnapshot,nodeExecutorPlan,runId,historyRuns[],planRevisions[],deliveryRecord` | 宿主会话细节 |
| Assignment | `id,runId,taskId,nodeId,employeeId,cliInstallationId,cliFingerprint,adapterVersion,workingDir,inputArtifactRefs[],permissionSnapshot,status,createdAt,updatedAt` | 员工档案/团队定义快照本体 |
| EmployeeSession | `id,employeeId,status,contextRefs[],checkpointRef,createdAt,updatedAt` | 员工档案属性 |
| HostBinding | `id,employeeSessionId,cliInstallationId,adapter,hostSessionId,resumable,compatible,capabilities,status,lastActivity` | 员工身份本身 |
| Attempt | `id,taskId,assignmentId,employeeSessionId,hostBindingId,resumedFrom,status,startedAt,endedAt,checkpointRef,artifactRefs[],activity[],error` | — |
| Run | `id,workItemId,workflowVersion,teamVersion,tasks[],status,createdAt,finishedAt,stats` | — |
| Artifact | `id,name,kind,workItemId,runId,taskId,employeeId,cliInstallationId,attemptId,handoffId,path,createdAt` | — |

错误与事件格式：

```js
// 所有领域函数统一返回
{ ok:true, value } | { ok:false, code:'V32_<CODE>', params:{...} }

// 事件（events.jsonl 与 audit.jsonl 同行格式）
{
  id, seq, ts, type, actor,
  refs: { workItemId, runId, taskId, assignmentId, employeeId,
          cliInstallationId, employeeSessionId, hostBindingId, attemptId },
  payload: {},
  prevHash, hash   // sha256(canonicalize({...无 hash 字段}))
}
```

#### 1.3.2 HTTP API 契约

- 全部挂在 `/v32/` 下，`Content-Type: application/json`；错误响应沿用 `{ok:false,code,params}`，HTTP 400（校验）/ 404（不存在）/ 409（状态冲突）。
- 每个域任务导出**路由片段**：`export function createV32XRoutes(deps) { return [{method, pattern, handler}] }`。T15 提供 `createV32Routes(deps)` 汇总并在 `src/daemon/http/routes.js` 挂载。
- 路由清单（各任务负责自己的段）：

| 前缀 | 方法/路径 | 所属任务 |
|---|---|---|
| `/v32/cli` | `GET /scan?mode=quick\|full`、`GET /`、`POST /`、`POST /:id/health`、`GET /:id/capabilities` | T02 |
| `/v32/roles` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/publish`、`POST /:id/deprecate` | T03 |
| `/v32/employees` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/toggle` | T04 |
| `/v32/teams` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/publish`、`POST /:id/deprecate`、`POST /:id/copy` | T05 |
| `/v32/workflows` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`GET /:id/graph`、`POST /:id/publish`、`POST /:id/deprecate`、`POST /:id/copy` | T06 |
| `/v32/work-items` | `GET /`、`POST /`、`GET /:id`、`POST /:id/preflight`、`POST /:id/start`、`POST /:id/cancel`、`POST /:id/revise`、`POST /:id/deliver` | T07 |
| `/v32/mapping` | `GET /:workItemId/candidates`、`PUT /:workItemId`、`GET /:workItemId/conflicts` | T08 |
| `/v32/assignments` | `POST /prepare`、`GET /:id`、`PUT /:id`、`POST /:id/start`、`POST /:id/release` | T09 |
| `/v32/sessions` | `GET /:employeeId`、`GET /:employeeId/bindings`、`POST /:employeeId/ensure`、`POST /:bindingId/wake` | T10 |
| `/v32/runs` | `GET /`、`GET /:id`、`POST /:id/tasks/:taskId/queue`、`POST /:id/tasks/:taskId/complete`、`POST /:id/tasks/:taskId/interrupt`、`GET /:id/events` | T11 |
| `/v32/recovery` | `GET /:taskId/options`、`POST /:taskId/recover-original`、`POST /:taskId/recover-checkpoint` | T12 |
| `/v32/human` | `POST /:taskId/approve`、`POST /:taskId/reject`、`GET /:taskId/policy` | T13 |
| `/v32/records` | `GET /artifacts`、`GET /artifacts/:id/trace`、`GET /events`、`GET /audit`、`GET /:workItemId/delivery` | T14 |

#### 1.3.3 桌面 UI 契约

- 新增 `desktop/ui/v32/` 页面模块；每模块导出：

```js
export default {
  viewId: 'v32-work-items',        // 唯一
  section: 'work_items',           // 对应导航分组
  labelKey: 'V32_NAV_WORK_ITEMS',
  render(ctx, model) { /* 返回 HTML 字符串，事件只用 data-action / data-arg */ },
  actions: { 'v32-wi-open': (arg, ctx) => {} }
};
```

- `ctx = { t, st, api, nav, toast, modal, closeModal, refresh, state }`；`api` 是 `fetch('/v32/...')` 的薄封装，错误按 `{ok:false,code,params}` 抛出。
- 所有文案 `ctx.t('V32_...')`；新增键必须用 append-only 方式同时加入 `src/daemon/http/labels.js` 的 `UI_LABEL_KEYS` 与值表，CLI 可见的再镜像到 `src/cli/labels.js`（T16 统一做，其他任务只写键名并在报告列出）。
- 导航与页签结构由 T16 在 `desktop/ui/shell/nav.js` 注册；页面模块不得直接改导航。
- `desktop/ui/v32/graph.js`（T06 独占）导出 `layoutDag(nodes,edges)`、`validateDag(nodes,edges)`、`renderGraph({nodes,edges,mode,stateMap,selected,onSelect,onEdit})`；`mode` 取 `definition | runtime | edit`，交互至少含缩放 50%–200%、适应画布、拖动平移、点选、上下游高亮；行为对齐原型 `showWorkflowDag` / `graphHTML` / `graphRefresh`。

#### 1.3.4 与引擎的桥接（T10 独占）

`src/v32/bridge.js` 只封装既有实现，不改引擎：

```js
export function createBridge({ store, adapterFactory, now }) {
  return {
    async startHost({ assignment, node, workItem }),   // buildAdapter + createSession，返回 HostBinding
    async wakeHost({ binding, attempt }),              // 原宿主恢复（策略 A）
    async createHost({ assignment, employeeSession }), // 新宿主（策略 B / 首次）
    async pollActivity({ bindingId, since }),          // 公开事件，不含私有推理
    async stopHost({ bindingId, reason })
  };
}
```

复用点：`src/adapter/factory.js:43 buildAdapter`、`acp-client.js:27 normalizeCapabilities / :44 canResume / :48 canLoad`、`session-state.js:42 createNormalizer`、`stdio-transport.js:25`、`dsh-launch.js:69 resolveDshLaunch`。

### 1.4 测试组织约定

- 新测试统一放 `test/wp21/`，文件名 `v32-*.test.js`，夹具放 `test/wp21/fixtures/v32-*.json`。
- 单文件跑法：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-<域>.test.js"`。
- 本域全跑：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-*.test.js"`。
- 全量：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"`。
- 所有测试使用临时目录（`fs.mkdtempSync(path.join(os.tmpdir(),'v32-'))`），结束清理；禁止读写真实 `~/.maestro`、`~/.orch` 或仓库内其它迭代证据目录。

---

## 2. 覆盖矩阵（确保任务并集 = 全部需求）

### 2.1 规格章节 → 任务

| 规格章节 | 内容 | 主责任务 | 协同 |
|---|---|---|---|
| §1 核心对象/隔离规则/关系约束 | 10 对象、8 条隔离、10 条关系 | T01 | 全部 |
| §3 团队模型 | 3.1 定义、3.2 成员与角色、3.3 复用、3.4 新建来源 | T05 | T04, T07 |
| §4 工作流模型 | 4.1 定义、4.2 Agent 节点 11 项、4.3 人工节点、4.4 复用 | T06 | T03, T13 |
| §5 Work Item | 5.1 14 字段、5.2 四种组合、5.3 五步向导 | T07 | T05, T06, T08 |
| §6 执行人映射 | 6.1 独立映射、6.2 自动匹配、6.3 并行冲突、6.4 替换 | T08 | T07, T09 |
| §7 CLI 与分配 | 7.1 扫描 8 项、7.2 Assignment 11 项、7.3 6 态 | T02, T09 | T10 |
| §8 会话生命周期 | 8.1 不建会话的 6 种操作、8.2 两层身份、8.3 启动 8 步、8.4 串行 | T10 | T09, T11 |
| §9 中断与恢复 | 11 项保留信息、策略 A / B、失败保持中断 | T12 | T10, T11, T14 |
| §10 链路 A/B/C/D | 四链路全部步骤与分支 | T07, T11, T12 | T05–T10 |
| §11 信息架构 | 一级导航 9 组 | T16 | 全部 |
| §12 P00–P16 | 见 §2.2 | 见 §2.2 | — |
| §13 状态机 | 见 §2.4 | 见 §2.4 | — |
| §14 异常边界 | 10 条，见 §2.6 | T05–T14 | — |
| §15/§7.2 原型覆盖 | 19 项，见附录 A | 全部 | — |
| §16 验收用例 | V32-01～17，见 §2.5 | T17 | 全部 |

### 2.2 P00–P16 → 任务

| 页面 | 主责 | 页面 | 主责 |
|---|---|---|---|
| P00 本机 Agent CLI 扫描 | T02 | P09 角色库 | T03 |
| P01 需求/任务工作台 | T07 | P10 执行中心 | T11 |
| P02 五步向导 | T07 + T08 | P11 工作流执行视图 | T11 |
| P03 需求详情 | T07 + T14 | P12 节点分配面板 | T09 |
| P04 团队库 | T05 | P13 员工活动面板 | T11 |
| P05 团队编辑器 | T05 | P14 任务与会话详情 | T10 + T11 |
| P06 工作流库 | T06 | P15 中断恢复 | T12 |
| P07 工作流编辑器（DAG） | T06 | P16 产物与事件 | T14 |
| P08 员工档案 | T04 | 系统设置 / 验收自检 | T16 + T17 |

### 2.3 状态机 → 任务

| 状态机 | 合法迁移 | 实现任务 | 关键断言 |
|---|---|---|---|
| Work Item §13.1 | `draft→configured→ready_to_run→running→waiting_human/blocked→ready_for_acceptance→accepted→delivered`，另 `cancelled` | T07 + T11 + T14 | 非法迁移返回 `V32_ILLEGAL_TRANSITION` 且不落盘 |
| Team §13.2 | `draft→published→deprecated` | T05 | publish 生成新版本；deprecated 不可选为新需求 |
| Workflow §13.3 | `draft→published→deprecated` | T06 | 发布后修改生成新版本；旧 Work Item 快照不变 |
| Node Task §13.4 | `waiting_dependency→ready→assignment_prepared→preflight→creating_session→running→succeeded`，分支 `interrupted/blocked/failed/cancelled/skipped/waiting_queue/human_waiting` | T11 | 依赖未完成时不可 `ready`；完成后下游解锁 |
| Assignment §13.5 | `draft→prepared→preflight→locked→released`，分支 `failed` | T09 | `prepared` 无 Session；`locked` 后员工/CLI 不可改 |
| 会话 §13.6 | Employee Session 长期稳定；Host Binding 按 CLI/Adapter，不跨 CLI 复用 | T10 | 跨 CLI 必然新 Binding；Employee Session ID 不变 |

### 2.4 V32-01～17 → 任务与验证落点

| 用例 | 场景 | 实现任务 | 自动化脚本断言（T17） |
|---|---|---|---|
| V32-01 | 已有工作流 + 已有团队 | T07 | WorkItem 同时持有两快照，两快照内无对方 ID 字段 |
| V32-02 | 新建工作流 + 新建团队 | T07 + T05 + T06 | 两种「仅本次 / 保存到库」都成功；仅本次不进公共库 |
| V32-03 | 团队被多工作流复用 | T05 | team 对象无 `workflowId`；两个 WorkItem 引用同 team 版本 |
| V32-04 | 工作流被多团队复用 | T06 | workflow 对象无 `teamId/employeeId`；DAG 图模式可渲染 |
| V32-05 | 节点匹配团队成员 | T08 | 每个 agent 节点映射成员具备对应 roleId 资格 |
| V32-06 | 缺少角色覆盖 | T07 `preflight` | 返回 `V32_ROLE_GAP`，列出缺失角色，无法创建 |
| V32-07 | 同员工并行节点 | T08 + T09 | 提示串行；占用时可选改派或排队；无并发写同一 Session |
| V32-08 | 创建 Work Item | T07 | 创建后 `status=configured`，无 Assignment / Session / CLI |
| V32-09 | 节点 Ready | T09 | 候选员工来自本次团队快照；CLI 来自本机资源池且能力匹配 |
| V32-10 | 保存 Prepared | T09 | `prepared` 有员工+CLI，Session 数为 0，可修改 |
| V32-11 | 启动节点 | T09 + T10 | Assignment `locked`；按需建 Employee/Host Session；Attempt 存在 |
| V32-12 | 员工更换 CLI | T09 + T04 | Employee Profile / Team 无变化；仅新 Assignment 选新 CLI |
| V32-13 | 恢复原宿主 | T12 | 存在且兼容可恢复 → 继续原 Attempt；不可用 → 保持 interrupted + 审计 |
| V32-14 | 跨 CLI 检查点恢复 | T12 | 新 Binding + 新 Attempt，`resumedFrom` 指向旧 Attempt，Employee Session ID 不变 |
| V32-15 | 修改团队/工作流资产 | T05 + T06 + T07 | 发布新版本后旧 WorkItem 快照逐字不变 |
| V32-16 | 人工节点 | T06 + T11 + T13 | 无 employeeId / cliId / sessionId；批准写审计 |
| V32-17 | 交付验收 | T14 | `accepted→delivered`，`deliveryRecord` 含测试/风险/验收人，事件可追溯 |

### 2.5 异常边界与链路 → 任务

| 异常边界（§14 编号） | 处理任务 |
|---|---|
| 1 角色未覆盖 → 阻止确认并列出缺失角色 | T07 |
| 2 同员工并行 → 提示 + 改派/排队 | T08、T09 |
| 3 团队成员停用 → 未启动重映射、运行中走中断恢复 | T04、T08、T12 |
| 4 团队修改 → 快照不变 | T05、T07 |
| 5 工作流修改 → 旧 Run 用旧版本 | T06、T11 |
| 6 CLI 启动前失效 → Assignment 保持可编辑、不建 Session | T02、T09 |
| 7 CLI 运行中断连 → 保留引用进入恢复 | T12 |
| 8 员工在别的 WorkItem 执行 → 排队/改派/等待 | T10、T11 |
| 9 仅用于本次 → WorkItem Snapshot，不进资产库 | T05、T06、T07 |
| 10 保存到库 → 先建资产版本再引用 | T05、T06、T07 |

链路 A（已有+已有）→ T07；链路 B（新建+新建）→ T05+T06+T07；链路 C（节点执行）→ T09+T10+T11；链路 D（异常恢复）→ T12+T14。四链路的完整端到端脚本由 T17 串起来。

---

## 3. 波次与排程

### 3.1 波次表（A/B 两台机器）

| 波次 | 机器 A | 机器 B | 同步点（必须都合入 main 才进下一波） |
|---|---|---|---|
| W0（阻塞） | T01 契约与存储 | 等待 / 只做文档阅读 | `origin/main` 含 `src/v32/contracts.js` 与 store 测试全绿 |
| W1 资产 | T02 CLI 池、T03 角色库、T05 团队库 | T04 员工档案、T06 工作流与 DAG | 四类资产 API + 页面可独立打开，资产域测试全绿 |
| W2 需求 | T07 Work Item 与五步向导 | T08 映射与并行冲突 | 能创建含快照+映射的 WorkItem；预检拒绝角色缺口 |
| W3 分配 | T09 Assignment 生命周期 | T10 两层会话与桥接 | `prepared` 无会话、`locked` 有会话；跨 CLI 不复用 Binding |
| W3b 执行 | T11 Run 编排与执行视图 | T12 恢复 A/B（按 T01 契约并行开发，W3b 同步点联调） | Task DAG 可跑到 succeeded；两种恢复都可验证 |
| W4 治理 | T13 人工门禁 | T14 产物/事件/审计/交付 | 人工节点无会话；交付可追溯 |
| W5 接入 | T15 路由聚合 | T16 桌面壳与文案 | `/v32/*` 全通；桌面可从导航进入全部 V3.2 页面 |
| W6 收口 | T17 17 条验收自动化 | T18 全量回归与门禁 | 17/17 通过；差集 0；门禁 exit 0 |

> W3b 的 T12 与 T11 并行开发时，只能依赖 T01 契约 + `test/wp21/fixtures/v32-run.json` 假数据；不得提前引用 T11 未合入的函数签名。

### 3.2 同步点检查（每个波次结束执行）

```bash
git fetch origin && git switch main && git pull --ff-only origin main
NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-*.test.js"
node scripts/desktop/gate.mjs --skip-tests
```

两机都在报告里写「同步点已过 + main sha」；若对方任务尚未合入，等待而不是自行实现对方能力。

---

## 4. 任务详单

---

### T00（前置，主线负责人）冻结基线并推送

- **分支**：不建功能分支，直接在 `main` 操作。
- **需求**：R0-1 确认本规划已合入本地 `main`，推送 `main` 到 `origin/main`；R0-2 公布此时的 `HEAD` 作为唯一 `baseSha`；R0-3 建 `docs/v32/reports/` 目录占位。
- **验证**：`git rev-parse origin/main` 与公布的 `baseSha` 一致。
- **完成**：两台机器都能从该 sha 建分支。

---

### T01（W0，阻塞全局）领域契约与 CAS 存储内核

- **分支**：`feature/v32-T01-contracts`
- **依赖**：无（必须最先合入）
- **需求描述**：
  - **T01-R1** 按 §1.3.1 导出全部常量：ID 前缀、四类状态枚举、资产状态、节点类型、审计类型；枚举必须与规格 §13 逐字一致（含 `waiting_queue` / `human_waiting`）。
  - **T01-R2** 实现 `validate(kind,obj)`：按 §1.3.1 对象表逐字段校验；额外强制「不该保存的字段」不存在（如 Employee 有 `cliId`、Team 有 `workflowId`、Workflow 节点有 `employeeId`、人工节点有 `cliId`）→ 返回 `V32_FORBIDDEN_FIELD`。
  - **T01-R3** 实现 `createV32Store()`：读 `.orch/v32/state.json`；不存在时按顶层结构初始化；`read()` 返回深拷贝；`get/list` 只读。
  - **T01-R4** `transit(mutator,{expectedRev,reason,actor})` 是唯一写入口：基于磁盘最新快照校验 `expectedRev`，不等则 `V32_REV_CONFLICT`；mutator 内改 draft；成功后 `rev+1`、原子写、再追加事件/审计，**最后**返回新快照；任何失败不得改内存状态。
  - **T01-R5** 事件/审计哈希链：`seq` 单调、`prevHash` 指向上一条、字段顺序规范化后 sha256；`verifyChain()` 可校验全链；`events()/audit()` 支持按 workItemId/runId/type 过滤与 limit。
  - **T01-R6** 每次 `transit` 若 `events` 中含 §1.3.1 `AUDIT_TYPES`，自动写入 `audit.jsonl`；人工审批 / 恢复 / 交付三类缺一不可。
  - **T01-R7** 提供 `test/wp21/fixtures/v32-*.json` 假数据：role、employee、team、workflow（含 agent+human 节点）、workItem、run、assignment；供后续并行任务使用，字段必须完全符合契约。
  - **T01-R8** `src/v32/index.js` 骨架只导出已实现模块；后续任务追加自己的导出（各自改自己文件，index.js 由 T01 预留 `export *` 聚合写法或每个任务在自己文件被 import 时使用相对路径——**不要**多个任务同时编辑 index.js）。
- **实现步骤**：① 常量与校验 → ② 原子写与 CAS → ③ 事件链 → ④ 夹具 → ⑤ 单测。
- **验证清单**：
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-contracts.test.js"`：断言禁止字段全部被拒、枚举逐字一致。
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-store.test.js"`：断言并发 `transit` 只有一个成功、rev 递增、`expectedRev` 过期返回冲突、失败不改文件。
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-events.test.js"`：断言哈希链、顺序、过滤、审计自动写入。
  - 全量差集 0（对照 `origin/main` 基线树）。
- **完成定义**：三套单测全绿 + 夹具被至少 2 个后续任务实际引用 + 报告落盘。

---

### T02（W1）CLI 资源池：真实扫描、能力与健康检查

- **分支**：`feature/v32-T02-cli-pool`
- **依赖**：T01
- **需求描述**：
  - **T02-R1**（P00 / §7.1）快扫与完整扫描两阶段：快扫发现路径与名称；完整扫描补齐版本、Adapter/协议、能力声明、健康状态、认证状态、会话恢复能力；扫描过程写 `cliPool.scan` 进度，界面可显示阶段。
  - **T02-R2** 复用 `src/adapter/cli-discovery/discover.js` 与 `probe.js`，**只读引用**；不把 `npx geiger-scan` 作运行时依赖。
  - **T02-R3** 扫描只更新 CLI 资源池；断言不创建 Employee / Team / Session / WorkItem。
  - **T02-R4** 手动添加路径：落库 `installs[]`，字段含 `id,name,path,version,adapter,capabilities,health,auth,resumable,fingerprint,source:'scan'|'manual'`；重复路径按 fingerprint 去重。
  - **T02-R5** 健康检查回写 `health`；失效 CLI 标记 `health:'unavailable'`，Assignment 可选它但启动预检必须拒绝（由 T09 消费）。
  - **T02-R6** `GET /v32/cli/:id/capabilities` 输出能力矩阵，供节点能力预检（T07/T09）使用。
  - **T02-R7**（P00 页面）`desktop/ui/v32/cli-page.js` 展示扫描进度、发现/可用/异常数量、CLI 明细与「重新扫描 / 完整扫描 / 手动添加 / 健康检查」入口；文案键 `V32_CLI_*` 列表写入报告交 T16。
- **实现步骤**：① 包装发现层 → ② 扫描状态机 → ③ 路由片段 → ④ 页面 → ⑤ 单测（mock probe）。
- **验证清单**：
  - `node --test "test/wp21/v32-cli-pool.test.js"`：mock 3 个 CLI（2 可用 1 失效），断言 8 项信息齐全、快扫/完整扫描阶段事件、手动添加落库、扫描不产生其它实体。
  - API 冒烟：起测试 daemon，`GET /v32/cli/scan?mode=quick` → 200 且 `scan.status` 从 `running` 到 `done`；`GET /v32/cli` 返回数组。
  - CDP 页面检查：`cli-page` 渲染后存在进度条与 3 行 CLI，无 CJK 字面量（跑 §0.7 正则自查）。
- **证据分级**：mock 实测（真实 CLI 探测依赖宿主，报告如实标注）。

---

### T03（W1）角色库（P09）

- **分支**：`feature/v32-T03-roles`
- **依赖**：T01
- **需求描述**：
  - **T03-R1** Role CRUD：字段按 §1.3.1；`duties/skills/inputs/outputs/acceptance` 均为数组，`requires` 用 `src/studio/schema.js:74 CAPABILITY_DIMENSIONS` 同款五维（只读引用，不改它）。
  - **T03-R2** 版本与状态：`draft→published→deprecated`；publish 生成新版本并写 `role.published` 审计；deprecated 不可被工作流节点引用。
  - **T03-R3** 三层联动可读性：API `GET /v32/roles/:id/refs` 返回「被哪些工作流节点引用 / 哪些员工声明资格 / 哪些团队声明承担」（只读汇总，不反向写入）。
  - **T03-R4**（P09）页面展示职责、技能、输入输出、能力要求、验收规则，支持新建/编辑/发布/停用；文案键交 T16。
- **验证清单**：
  - `test/wp21/v32-roles.test.js`：字段校验、非法迁移、发布新版本、停用后节点引用被拒、`refs` 汇总正确。
  - `GET /v32/roles` 与 `/:id/refs` 返回结构与契约一致。
  - 页面 CDP 打开无运行时错误；`ctx.t` 键无空值。

---

### T04（W1）员工档案（P08）

- **分支**：`feature/v32-T04-employees`
- **依赖**：T01（与 T03 可并行）
- **需求描述**：
  - **T04-R1** Employee 只保存身份、名称、说明、角色资格数组、启用状态；`validate` 已禁止 `cliId/teamId/sessionId`；本任务保证所有写路径都过 validate。
  - **T04-R2** 多角色资格：一名员工可声明多个 Role ID；`toggle` 只改 `enabled`，不改资格。
  - **T04-R3** 停用联动：返回 `affected` 列表（哪些团队含该成员、哪些 WorkItem 的未启动节点映射到此员工、哪些运行中任务在用），供 T08/T12 消费；**不自动改快照**。
  - **T04-R4**（P08）页面展示名称、Employee ID、说明、资格、启用状态；「加入的团队」只读；「当前任务 / 会话是否已创建」只在有运行态数据时展示；页面**不提供** CLI 或团队绑定入口。
- **验证清单**：
  - `test/wp21/v32-employees.test.js`：多资格写入成功、禁止字段被拒、停用返回 affected 且快照逐字不变。
  - API `POST /:id/toggle` 后断言 WorkItem 快照哈希不变。
  - 页面检查：不存在 `cliId` 输入控件。

---

### T05（W1）团队库与团队编辑器（P04 / P05）

- **分支**：`feature/v32-T05-teams`
- **依赖**：T01、T04（可先按契约并行，联调在 W1 同步点）
- **需求描述**：
  - **T05-R1**（§3.1）Team 定义含 ID/名称/描述/版本、成员列表、成员 Employee ID、团队内角色资格、主备与优先级、是否参与新分配、可选容量；**禁止** `workflowId` 与任何 CLI/Session 字段。
  - **T05-R2**（§3.2）成员可承担一个或多个角色；团队角色必须是员工全局资格的子集，超集返回 `V32_ROLE_NOT_QUALIFIED`。
  - **T05-R3**（§3.3）支持创建、编辑成员、增删成员、调整角色、主备/优先级、复制、发布新版本、停用；每次 publish 生成新版本并写审计。
  - **T05-R4**（P04）团队库展示名称/版本/说明/成员数/角色覆盖/成员明细/最近使用 WorkItem；**不显示**「适用工作流」，**不提供** CLI 配置。
  - **T05-R5**（P05）编辑器从员工档案勾选成员、逐人选择团队内角色、设置主备与优先级；保存产生新版本。
  - **T05-R6**（V32-03）同一团队可被多个不同工作流引用，团队对象不变。
  - **T05-R7**（§14-4）团队修改后既有 WorkItem 的 `teamSnapshot` 逐字不变。
  - **T05-R8**（§3.4 / V32-02）支持「保存到库」与「仅用于本次需求」；后者只进 WorkItem snapshot，不进入 teams[]。
- **验证清单**：
  - `test/wp21/v32-teams.test.js`：禁止字段、资格子集、主备优先级、publish 版本递增、deprecated 不可新用、copy 不共享引用、快照隔离。
  - API：`POST /:id/copy` 后原团队无变化；`GET /` 列表无 `workflowId` 字段。
  - 页面 CDP：团队库表格无「工作流」列；编辑器无 CLI 控件。
  - V32-03 断言：两个不同 workflow 的 WorkItem 引用同 team 版本。

---

### T06（W1）工作流库与 DAG 流程图编辑器（P06 / P07）

- **分支**：`feature/v32-T06-workflows`
- **依赖**：T01、T03（角色 ID 来源）
- **需求描述**：
  - **T06-R1**（§4.1）Workflow 定义含 ID/名称/描述/版本、节点 DAG、Agent 节点 Role ID、输入输出契约、验收条件、依赖、并行/汇合、条件分支、Human Task / Approval Gate、Handoff、Retry/Fallback/Escalation/Failure Policy；**禁止** Employee ID / Team ID / CLI。
  - **T06-R2**（§4.2）Agent 节点 11 项字段齐全（见 §1.3.1）；缺任一字段 validate 拒绝。
  - **T06-R3**（§4.3 / V32-16）Human 节点只有 `human:{approver,mode,condition}` 与契约字段，禁止 `roleId` 之外的执行人、CLI、Session；人工节点不参与员工映射。
  - **T06-R4**（P06）库列表展示名称/版本/用途/节点数/Agent 与人工节点数/主要阶段与并行关系/内置·草稿·已发布；支持编辑、复制、发布新版本、用于新需求。
  - **T06-R5**（P07）编辑器支持：画布定义 DAG；Agent 节点选 Role ID；Human 节点定义审批人/条件；配置依赖、并行、汇合、条件、输入输出、验收、失败策略；**不出现**员工/团队/CLI 选择。
  - **T06-R6** 实现 `src/v32/graph.js`：`layoutDag` 按依赖层级布局；`validateDag` 检测未知依赖与环；`renderGraph` 支持 definition/runtime/edit 三模式、缩放 50%–200%、适应画布、拖动平移、点选、上下游高亮，行为对齐原型 `showWorkflowDag / graphHTML / graphRefresh / graphAutoLayout`。
  - **T06-R7**（§4.4 / V32-04）工作流可被多个团队复用；对象内无 Team/Employee 字段；DAG 图模式可渲染。
  - **T06-R8**（V32-15 / §14-5）修改发布新版本；既有 WorkItem 快照与运行中 Run 继续用旧版本。
  - **T06-R9**（V32-02）支持「保存到库」与「仅用于本次需求」。
- **验证清单**：
  - `test/wp21/v32-workflows.test.js`：11 项字段校验、禁止字段、human 节点约束、publish 版本、快照隔离、四种复用来源。
  - `test/wp21/v32-dag.test.js`：环检测、未知依赖、并行分支标注、三种模式渲染函数存在。
  - API `GET /v32/workflows/:id/graph` 返回布局后的 nodes/edges；CDP 打开编辑器，图有箭头与并行标签。
  - `python3 -c` 零 CJK 自查：`src/v32/workflows.js`、`src/v32/graph.js`、`desktop/ui/v32/workflows-page.js`。

---

### T07（W2）Work Item 与五步创建向导（P01 / P02 / P03）

- **分支**：`feature/v32-T07-work-items`
- **依赖**：T02–T06（W1 全部合入）
- **需求描述**：
  - **T07-R1**（§5.1）Work Item 14 字段齐全；创建后 `status='configured'`；`workflowSnapshot`/`teamSnapshot` 固化所选版本，`nodeExecutorPlan` 固化映射；`runId` 指向新建 Run，`historyRuns=[]`，`deliveryRecord=null`。
  - **T07-R2**（§5.2 / 链路 A/B）四种组合全部可用：已有+已有、已有+新建、新建+已有、新建+新建；新建资产可选「仅本次」（进 snapshot 不进资产库）或「保存到库」（先建资产版本再引用）。
  - **T07-R3**（§5.3 / P02）五步向导严格为：①需求信息（标题/描述/背景/目标/项目目录/附件）②工作流③团队④节点执行人映射（调用 T08 面板）⑤预检确认（覆盖、员工有效性、并行冲突、CLI 能力、输入资料）。
  - **T07-R4**（§6.2 / V32-06）`preflight` 返回逐项结果；角色未覆盖返回 `V32_ROLE_GAP` 并列出缺失角色，阻止创建；员工失效、CLI 能力不足同样阻止。
  - **T07-R5**（V32-08）创建时只建 Task DAG，**不创建** Assignment / Employee Session / Host Binding；断言三者数量为 0。
  - **T07-R6**（§13.1）状态机：`configured→ready_to_run`（用户点启动）`→running`；`waiting_human/blocked` 由 T11 触发；`ready_for_acceptance→accepted→delivered` 由 T14 触发；`cancelled` 可从非终态进入；非法迁移拒绝。
  - **T07-R7**（P01）工作台展示需求数量、执行中、待人工、待验收；列表含标题/关联工作流/团队/状态/创建时间。
  - **T07-R8**（P03）详情页展示需求内容、Workflow Snapshot、Team Snapshot、Node Executor Plan、当前与历史 Run、产物与事件入口；提供流程视图 / 节点列表 / 执行历史；显示「执行方案快照」与「修订」入口（修订逻辑 T11 提供）。
  - **T07-R9**（§14-9/10）仅本次的资产不进入公共库；保存到库的资产先有版本号再被引用。
- **验证清单**：
  - `test/wp21/v32-work-items.test.js`：14 字段、四组合、快照隔离、创建后零 CLI/零 Session、状态机非法迁移。
  - `test/wp21/v32-preflight.test.js`：五类检查逐项通过/失败；角色缺口文案含缺失角色名（来自 mock 夹具）。
  - CDP：五步向导可从第 1 步走到第 5 步并返回；预检失败时「创建」按钮 disabled。
  - V32-01/02/06/08 断言在 T17 中可复用。

---

### T08（W2）节点执行人映射与并行冲突（§6）

- **分支**：`feature/v32-T08-mapping`
- **依赖**：T01（与 T07 并行；W2 同步点与向导第 4 步联调）
- **需求描述**：
  - **T08-R1**（§6.1）映射属于 Work Item 执行方案，**不写回** Workflow / Team；示例映射结构 `{[nodeId]: employeeId|null}`；human 节点固定 `null`。
  - **T08-R2**（§6.2）候选只来自本次团队快照的成员；成员必须具备节点 Role ID 资格；唯一候选自动预选；多候选按 `priority` 预选且可改；无候选返回 `V32_NO_CANDIDATE` 并提示补成员/调资格。
  - **T08-R3**（§6.3 / V32-07）并行判定使用**可达闭包**：两节点互不可达才算并行，传递依赖不得误报；同一员工被映射给并行节点时返回警告 `V32_SERIAL_QUEUE`，提示「同一员工将串行处理这两个节点」，可改派或接受排队。
  - **T08-R4**（§6.4）节点未启动可改映射并写 `plan.revised` 审计；已启动节点不可覆盖当前 Attempt 执行者，须先中断/结束再新建 Assignment，且必须显式选择是否继承检查点与产物上下文；已完成节点历史执行者不可变。
  - **T08-R5**（§14-3）团队成员停用时：未启动节点映射标记为需重映射，运行中节点不自动改，交给 T12。
  - **T08-R6**（P02 第 4 步）`desktop/ui/v32/mapping-panel.js` 展示节点 → 候选成员下拉、并行冲突提示、改派/排队选择；Human 节点显示「不分配员工」。
- **验证清单**：
  - `test/wp21/v32-mapping.test.js`：候选资格、优先级预选、无候选拒绝、可达闭包并行判定（含 A→B→C 时 A/C 不算并行）、改派与排队、启动后改映射被拒、审计写入。
  - `GET /v32/mapping/:workItemId/conflicts` 返回冲突清单与建议。
  - CDP：向导第 4 步两个并行节点映射同一员工时出现串行提示。

---

### T09（W3）Task Assignment 生命周期与 CLI 选择（P12 / §7）

- **分支**：`feature/v32-T09-assignments`
- **依赖**：T07、T08、T02
- **需求描述**：
  - **T09-R1**（§7.2）节点进入 Ready 后创建 Assignment，11 项字段齐全；员工默认取 Node Executor Plan，可在本次团队内改选符合角色的成员；CLI 从本机资源池选且必须满足节点 `capabilities`；设置工作目录与权限快照；输入产物引用来自上游 Artifact。
  - **T09-R2**（§7.3 / §13.5）状态机 `draft→prepared→preflight→locked→released`，失败进 `failed`；`prepared` 可改员工与 CLI；`locked` 后禁止修改（返回 `V32_ASSIGNMENT_LOCKED`）；`released` 在任务结束/取消时写。
  - **T09-R3**（V32-10）保存 Prepared **不创建** Employee Session / Host Session；断言 `sessions.employees` 与 `hostBindings` 数量不变。
  - **T09-R4**（V32-09 / V32-12）CLI 选择按能力匹配；更换 CLI 只影响本次 Assignment，Employee Profile 与 Team 定义逐字不变；失效 CLI 在 preflight 阶段拒绝，Assignment 保持 `prepared` 可编辑。
  - **T09-R5**（§14-2 / V32-07）占用冲突：目标员工正执行其它任务时提供「改派」与「保留并排队」；排队节点进入 `waiting_queue`，**禁止**并发写同一 Employee Session。
  - **T09-R6**（P12）面板展示节点角色要求、合格成员（默认选中映射成员）、本机 CLI 候选及能力、会话计划（创建/复用/唤醒/恢复）、「保存 Prepared」「保存并启动」；启动按钮走 `preflight→locked` 并通知 T10 建会话。
  - **T09-R7** Assignment 每次状态变化写事件，`locked` 写审计。
- **验证清单**：
  - `test/wp21/v32-assignments.test.js`：11 字段、能力过滤、prepared 可改、locked 拒改、prepared 零会话、失效 CLI 拒绝、排队不并发、V32-12 不改档案/团队。
  - API：`POST /prepare` → 200 且 status=prepared；`POST /start` → locked 且触发会话创建（T10 联调点）。
  - CDP：面板默认选中映射成员；CLI 下拉只出现能力匹配项。

---

### T10（W3）两层会话与 ACP 桥接（§8）

- **分支**：`feature/v32-T10-sessions`
- **依赖**：T01、T09（与 T09 并行开发，W3 同步点联调）
- **需求描述**：
  - **T10-R1**（§8.1）以下操作**都不创建会话**：创建 Employee Profile、加入团队、创建 Work Item、选工作流/团队、保存映射、保存 Prepared；每条都有单测断言。
  - **T10-R2**（§8.2）Employee Session 是员工长期逻辑身份；Host Binding 按 CLI/Adapter 维护；跨 CLI **不得**复用 Host Session ID；同一 Employee Session ID 在不同 CLI 下可有多个 Binding。
  - **T10-R3**（§8.3）节点启动 8 步：读执行员工 → 查 Employee Session → 无则创建 → 按 CLI 查 Binding → 兼容可恢复则唤醒 → 否则新建 Binding → 记录 Host Session ID → 创建 Attempt 并写事件。
  - **T10-R4**（§8.4 / §14-8）员工在别的 WorkItem 执行时：排队 / 选备选成员 / 用户改派；同一员工同一时刻只允许一个前台 Attempt；不引入子会话。
  - **T10-R5** `src/v32/bridge.js` 按 §1.3.4 封装既有 adapter，**不改** `src/adapter/**` / `src/core/**`；ACP 方言差异收敛在 bridge 内；公开活动只取宿主状态/工具/文件/命令/产物事件，不取私有推理。
  - **T10-R6**（P14 部分）`session-panel.js` 展示 Employee Session ID、Host Binding 历史（CLI/Adapter/Host Session ID/恢复能力/状态）、Attempt 列表；无会话时显示「节点启动后创建」。
  - **T10-R7** 会话创建/唤醒写事件，创建写审计。
- **验证清单**：
  - `test/wp21/v32-sessions.test.js`：6 种不建会话操作、8 步启动顺序、跨 CLI 新 Binding、同员工并发被排队、Attempt 关联正确。
  - `test/wp21/v32-bridge.test.js`：mock adapter 下 startHost/wakeHost/createHost/pollActivity 调用顺序与参数；无真实 ACP 依赖。
  - API `GET /v32/sessions/:employeeId` 与 `/bindings` 结构正确。
  - 运行时错误 0；纯 CJK 自查通过。

---

### T11（W3b）Workflow Run 编排、执行视图与活动流（P10 / P11 / P13）

- **分支**：`feature/v32-T11-runs`
- **依赖**：T09、T10（与 T12 并行开发）
- **需求描述**：
  - **T11-R1**（§13.4）Task 状态机完整实现；上游依赖未完成不可 `ready`；`succeeded` 后解锁下游；人工节点进 `human_waiting` 等 T13；异常进 `interrupted/blocked/failed`；`waiting_queue` 由 T09 排队触发。
  - **T11-R2**（链路 C）执行步骤：Ready → 读映射 → 成员有效性/空闲检查 → 确认员工 → 选 CLI → Prepared → 启动 → Locked → 建会话 → Attempt → 活动展示 → 完成验收与下游推进。
  - **T11-R3**（§14-4/5）团队/工作流资产修改后，Run 继续使用创建时版本快照；成员停用时未启动节点标记需重映射。
  - **T11-R4**（P10）执行中心列表：Run ID、Work Item、Workflow 版本、Team 版本、状态、完成率、Ready/执行中/中断/人工待处理数量；实时计算完成率（不能用硬编码）。
  - **T11-R5**（P11）执行视图：按节点展示名称/Role/计划与实际执行人/状态/CLI（Assignment 完成后才显示）/员工会话状态（创建后才显示）/最近活动；提供任务表格与事件时间线；默认进入流程图模式（复用 T06 `renderGraph` 的 `runtime` 模式），线性视图保留。
  - **T11-R6**（P13）活动面板：员工身份、所属团队/角色、当前 WorkItem/节点/CLI、Employee/Host Session ID（存在才显示）、Attempt、开始时间、运行时长、最近活动；只展示公开事件；由事件/Attempt/产物动态生成，不用静态文案。
  - **T11-R7**（P03 修订入口）执行方案修订：未启动节点可改映射，旧 Run 归档到 `historyRuns`、`planRevisions` 追加、新建 Run 并更新 `workItem.runId`；已完成节点历史不变。
  - **T11-R8**（P14）任务详情：Task ID、Node ID、Role、计划/实际执行人、Assignment 历史、Attempt 历史、Employee Session、Host Binding 历史、产物/Handoff/错误证据。
  - **T11-R9** 所有状态迁移写事件，关键迁移（启动/完成/人工等待）写审计。
- **验证清单**：
  - `test/wp21/v32-runs.test.js`：依赖解锁、非法迁移、完成率计算、快照隔离、修订归档与 runId 更新、活动面板由事件生成。
  - API：`GET /v32/runs` 列表字段；`POST /:id/tasks/:taskId/complete` 后下游变 `ready`。
  - CDP：执行中心默认显示流程图；节点状态着色；点击节点打开任务详情与会话信息。
  - V32-15 断言：发布新版本后旧 Run 快照哈希不变。

---

### T12（W4，可与 T11 并行开发）中断恢复 A/B（P15 / §9）

- **分支**：`feature/v32-T12-recovery`
- **依赖**：T01、T10、T11 契约（联调在 W3b/W4 同步点）
- **需求描述**：
  - **T12-R1**（§9）中断保留 11 项：WorkItem ID、Run ID、Task ID、Assignment ID、Employee ID、CLI Installation ID+Fingerprint、Employee Session ID、Host Session ID、Attempt ID、最后活动事件、检查点与产物引用；缺一项即失败。
  - **T12-R2**（策略 A）恢复原宿主：必须选原 CLI；检查原 Host Session 存在、兼容、支持恢复；成功则**继续原 Attempt**并回写 Binding 状态；任一项不满足保持 `interrupted`，写 `recovery.failed` 审计，**禁止静默降级**为策略 B。
  - **T12-R3**（策略 B）检查点恢复：允许选另一 CLI；沿用 Employee Session ID；新建 Host Binding；新建 Attempt 并写 `resumedFrom` 指向原 Attempt；把检查点与 Artifact References 作为恢复上下文；写 `recovery.succeeded` 审计。
  - **T12-R4**（§14-7）CLI 运行中断连：保留 Attempt 与 Host Session 引用，进入恢复流程，不得清空。
  - **T12-R5**（P15）面板展示原 CLI、Host Session ID、恢复能力、最后活动、检查点，以及两种恢复策略的明确入口与失败后的诊断信息。
  - **T12-R6** 恢复完成后重新触发依赖检查（通知 T11）。
- **验证清单**：
  - `test/wp21/v32-recovery.test.js`：11 项保留；策略 A 成功/失败两路；策略 B 新 Binding 新 Attempt 且 Employee Session ID 不变；跨 CLI 不复用 Host Session ID；失败保持 interrupted 且有审计。
  - API：`GET /:taskId/options` 返回两种策略及可用性；`POST /recover-original` 在不可恢复时返回 `V32_RECOVERY_UNAVAILABLE` 且状态不变。
  - CDP：恢复面板显示原 CLI 与检查点；失败时提示保持中断。
  - V32-13/14 断言交给 T17。

---

### T13（W4）人工节点与审批门禁（§4.3 / P07 / P16）

- **分支**：`feature/v32-T13-human-gates`
- **依赖**：T06、T11
- **需求描述**：
  - **T13-R1** Human Task / Approval Gate 定义：审批方式（单人/多人/会签）、审批人（角色或指定员工）、人工补充输入条件、超时与默认动作；字段存在 node.human 内。
  - **T13-R2**（V32-16）人工节点**不分配员工、不分配 CLI、不创建 Employee Session / Host Binding / Attempt**；批准动作只改 Task 状态并写审计。
  - **T13-R3** 审批校验：审批人身份/角色必须符合 node.human 定义；不符合返回 `V32_APPROVER_INVALID`；驳回走异常边界（回退或升级，按节点失败策略）。
  - **T13-R4** 批准后：Task `succeeded`、解锁下游；若所有节点完成，WorkItem 进入 `ready_for_acceptance` 并写审计。
  - **T13-R5**（P07 编辑器）Human 节点属性区可配置审批方式/审批人/条件/超时，且不出现员工 Agent 分配或 CLI 控件。
  - **T13-R6** 审批/驳回均写 `human.approved` 类审计事件，可追溯审批人与时间。
- **验证清单**：
  - `test/wp21/v32-human.test.js`：零 Session/零 CLI、审批人校验、批准解锁、驳回分支、审计写入。
  - API：`POST /:taskId/approve` 无效审批人返回 409/400 且不改状态。
  - CDP：人工节点详情无 CLI/Session 字段；批准后流程图节点变绿。

---

### T14（W4）产物、事件、审计与交付验收（P16 / §13.1）

- **分支**：`feature/v32-T14-delivery`
- **依赖**：T11、T12、T13
- **需求描述**：
  - **T14-R1**（P16）Artifact 可追踪七维：WorkItem、Workflow Run、Task、Employee、CLI、Attempt、Handoff；`GET /artifacts/:id/trace` 返回完整链路与事件引用。
  - **T14-R2**（P16）事件记录覆盖：团队/工作流版本选择、节点映射、Task Assignment、会话创建与恢复；人工审批、异常恢复、交付验收**必须**写审计（与 T01 审计类型对齐）。
  - **T14-R3**（§13.1 / V32-17）交付验收：`ready_for_acceptance→accepted→delivered`；`deliveryRecord` 结构化保存产物清单、测试结果、风险/遗留问题、验收人、验收时间；审计可追溯。
  - **T14-R4** 需求详情产物卡片：展示本 WorkItem 全部 Artifact（名称/ID/类型/节点/Task/Employee/CLI/Attempt/Handoff）与「溯源」入口。
  - **T14-R5**（P16）记录页：产物表、事件时间线（结构化表格：时间/类型/对象/操作者/载荷摘要）、审计链校验状态；支持按 WorkItem 过滤。
  - **T14-R6** 事件/审计只读；不得提供删除入口；哈希链校验失败时页面显示明确告警。
- **验证清单**：
  - `test/wp21/v32-delivery.test.js`：状态迁移、deliveryRecord 字段、审计写入、非法迁移拒绝。
  - `test/wp21/v32-audit.test.js`：七维溯源、事件过滤、哈希链校验、三类必须审计事件存在。
  - API：`GET /v32/records/artifacts/:id/trace` 返回七维非空（人工节点产物允许 Employee 为空）。
  - CDP：记录页表格可读、无横向溢出；交付弹窗字段齐全。

---

### T15（W5）HTTP 路由聚合与 API 契约测试

- **分支**：`feature/v32-T15-api`
- **依赖**：T02–T14 全部路由片段
- **需求描述**：
  - **T15-R1** 新建 `src/daemon/http/v32-routes.js`：`createV32Routes(deps)` 汇总所有片段，统一错误响应与 JSON 头，统一 404/405。
  - **T15-R2** 在 `src/daemon/http/routes.js` 仅加两行：import + 把 `createV32Routes` 返回的路由展开进 `routes` 数组；**不得改动** `shapeSnapshot` 及任何既有路由。
  - **T15-R3** 统一请求校验：所有 POST/PUT body 走契约 validate；错误码与 HTTP 状态映射固定（400/404/409）。
  - **T15-R4** `test/wp21/v32-api-contract.test.js` 逐条打 §1.3.2 路由表，断言状态码与响应形状；已有片段缺失时只报告缺哪条，不替别人实现。
- **验证清单**：
  - `test/wp21/v32-api-contract.test.js` 全绿（路由表条数 = 表中条数）。
  - `GET /ui/labels` 仍 200；既有 `/instances`、`/workflows` 契约逐字回归。
  - `node scripts/desktop/gate.mjs --skip-tests` exit 0。

---

### T16（W5）桌面壳集成、导航与零 CJK 文案

- **分支**：`feature/v32-T16-shell`
- **依赖**：T15 + 全部页面模块（可依 §1.3.3 契约并行开发页面，联调在 W5 同步点）
- **需求描述**：
  - **T16-R1**（§11）导航按「启动与资源 / 需求工作台 / 执行中心 / 团队库 / 工作流库 / 员工档案 / 角色库 / 产物与事件 / 系统设置」分组；在 `desktop/ui/shell/nav.js` 注册 V3.2 view，保留历史 view ID 兼容既有深链。
  - **T16-R2** `desktop/ui/v32/index.js` 汇总所有页面模块；`desktop/ui/app.js` 的 `handleAction` 增加 `v32-*` 动作分派；页面只用 `data-action/data-arg`，不改全局渲染契约。
  - **T16-R3** 所有文案键注册到 `src/daemon/http/labels.js` 的 `UI_LABEL_KEYS` 与值表（append-only，冻结断言逐字比对），CLI 可见的镜像到 `src/cli/labels.js`；**键必须真被 `GET /ui/labels` 下发**，否则空表头/空按钮。
  - **T16-R4** 零 CJK：V3.2 新增源码（含注释）用 `python3 -c` 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]` 扫描为 0；变量不得叫 `editor`（31 词禁表，按整词扫）；分隔符用空格或 `·`。
  - **T16-R5** 输入控件带 `data-field`；动作在 `pointerdown` 响应且同时派发 `click`（600ms 去重窗口）；导航锚点唯一化（`.sidebar [data-section=…]` / `.secbar .sec-tab[data-tab=…]`）。
  - **T16-R6** `updateStudio` 类 mutator 返回 `{ok:true,value:{...}}`，只透传 `.value`；`atomicWrite` 异步需 await。
  - **T16-R7** 组织页不再是 iframe 内另一套视觉：V3.2 页面直接使用主壳标签栏与样式（原型中此问题为已知遗留，实现时纠正）。
  - **T16-R8** `test/wp13/v32-shell.test.js`：从导航进入 9 个分组、页面渲染非空、动作可触发、`data-field` 存在。
- **验证清单**：
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-labels.test.js" "test/wp13/v32-shell.test.js"` 全绿。
  - `python3 -c` 零 CJK 自查（对 `desktop/ui/v32/**`、`src/v32/**` 新增文件）。
  - CDP 逐一打开 9 个导航入口，截图核对浅色布局无溢出；`npm run verify:nav` 无新增红。
  - `GET /ui/labels` 返回所有 `V32_*` 键且值非空。

---

### T17（W6）V32-01～17 验收自动化

- **分支**：`feature/v32-T17-acceptance`
- **依赖**：T16
- **需求描述**：
  - **T17-R1** `scripts/verify-v32.mjs`：起隔离临时项目（`MAESTRO_CONFIG_DIR` 必须隔离，避免污染真实 `~/.maestro/projects.json`），通过 HTTP API 依序执行 17 条用例，每条输出 `PASS/FAIL` 与关键状态片段。
  - **T17-R2** 17 条用例严格按 §2.4 的场景与通过标准断言；**不得只检查文字存在**，要检查对象字段、状态与事件。
  - **T17-R3** 覆盖四链路 A/B/C/D 的端到端脚本：A（已有+已有）、B（新建+新建）、C（Ready→Assignment→Session→完成）、D（中断→恢复 A 失败→恢复 B 成功）。
  - **T17-R4** 断言禁止硬编码测试条数；用 `fail=0 && pass===tests && tests>=17`。
  - **T17-R5** `package.json` 只加一条 `"verify:v32": "node scripts/verify-v32.mjs"`；不改其它 script。
  - **T17-R6** `test/wp21/v32-acceptance.test.js` 以单元测试形式覆盖同一组断言（不依赖 GUI），供门禁使用。
- **验证清单**：
  - `npm run verify:v32` → 17/17 PASS，退出码 0。
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-acceptance.test.js"` 全绿。
  - 报告 `docs/v32/reports/acceptance.md` 含逐条结果与实际命令输出摘要。
  - 失败时按 §0.5 循环，不得跳过任一用例。

---

### T18（W6）全量回归、门禁与交付收口

- **分支**：`feature/v32-T18-final`（只写报告，不新增源码）
- **依赖**：T17
- **需求描述**：
  - **T18-R1** 用 `git worktree add /tmp/v32base origin/main` 建立基线树，在基线与当前树分别跑全量测试，比较失败集合与失败原因；新增红必须为 0。
  - **T18-R2** 全量命令：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"`；记录 tests/pass/fail/skip。
  - **T18-R3** 门禁 `node scripts/desktop/gate.mjs` exit 0；若失败按 §0.5 判定，不得以「历史基线也有」掩盖新增红。
  - **T18-R4** 复核覆盖矩阵 §2：每个章节、页面、状态、异常、用例都有已合入任务与证据链接。
  - **T18-R5** `docs/v32/reports/final-verification.md` 汇总：基线 sha、最终 sha、逐任务结论、17/17、差集结论、门禁结论、已知偏差。
- **验证清单**：全量测试 + 门禁 + `npm run verify:v32` 三项全绿；报告落盘后合入 main。
- **完成定义**：两机确认所有任务已合入，main 上从零复跑三项验证仍全绿。

---

## 5. 总体验收与完成定义

### 5.1 最终必须全部通过的检查

```bash
cd /Users/xuesh/www/Maestro
git fetch origin && git switch main && git pull --ff-only origin main

# 1) 领域测试
NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-*.test.js"

# 2) 全量回归（约 12 分钟，macOS）
NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"

# 3) 17 条验收
npm run verify:v32

# 4) 发布门禁
node scripts/desktop/gate.mjs

# 5) 零 CJK 与文案键
python3 -c 'import re,pathlib,sys; bad=[(str(p),n) for p in pathlib.Path("src/v32").rglob("*.js") for n,l in enumerate(p.read_text().splitlines(),1) if re.search(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]",l)]; print(bad); sys.exit(1 if bad else 0)'
```

### 5.2 完成定义（缺一不可）

1. §2 覆盖矩阵中每一行都有已合入任务，且报告中对应 REQ 全部 PASS。
2. 17 条验收用例全部由真实 API / 状态驱动通过，不是页面文案检查。
3. P00–P16 在桌面壳内可从导航进入并操作，无 iframe 内第二套视觉。
4. 全量失败集合差集 = 0；新增红 = 0；门禁 exit 0。
5. `docs/v32/reports/T01.md` ～ `T18.md` 全部存在且含 baseSha / headSha / 验证结果。
6. 每台机器确认自己分支已合入且无遗留 WIP。

### 5.3 阻塞升级规则

出现以下情况，任务保持 `in_progress`，写 `BLOCKED` 报告并交主线负责人，**不得自行降标准合入**：

- 契约字段不够用，需要改 `src/v32/contracts.js`（T01 独占）。
- 必须修改 `src/core/**`、`src/persistence/**`、`src/adapter/**`、`src/daemon/server.js`。
- 新增 npm 依赖才能完成。
- 前序任务未合入导致无法验证，且等待超过一个同步点。
- 全量回归出现新增红且独占复跑仍红。

---

## 附录 A：原型函数 → 实现落点

| 原型函数（docs/maestro_v3_2_prototype.html） | 实现任务 |
|---|---|
| `scanPage` / `scanCli` / `checkCli` / `addCliPath` / `confirmAddCli` | T02 |
| `workItemsPage` / `openWorkItem` / `workItemDetail` / `startRun` / `cancelWorkItem` | T07 |
| `startWorkItemWizard` / `wizardWorkflow` / `wizardTeam` / `wizardNext` / `wizardBack` / `createWorkItem` / `preflightWizard` / `changeWizardMode` / `changeWizardAsset` / `readWizardTeam` | T07 |
| `showExecutionPlan` / `reviseExecutionPlan` / `saveExecRevision` / `showRunHistory` | T11 |
| `showWizardNodeDesigner` / `saveWizardNodes` / `parallelPairs` / `parallelConflicts` / `eligibleMembers` | T08 + T06 |
| `teamsPage` / `editTeam` / `toggleTeamRoleBox` / `saveTeam` / `copyTeam` / `deprecateTeam` / `showTeamVersions` | T05 |
| `workflowsPage` / `editWorkflow` / `wfGraphEditor` / `graphAddNode` / `graphAddEdge` / `graphAutoLayout` / `checkWorkflowDag` / `saveWorkflow` / `publishWorkflow` / `showWorkflowDag` | T06 |
| `employeesPage` / `newEmployee` / `saveEmployee` / `editEmployeeProfile` / `saveEmployeeProfile` / `employeeDetail` | T04 |
| `rolesPage` / `roleDetail` / `editRole` / `createRole` / `saveRole` | T03 |
| `runsPage` / `openRun` / `runRuntimeCards` / `runDetail` / `setRunTab` | T11 |
| `taskActionBtn` / `assignTask` / `cliCapsHtml` / `saveTaskAssignment` / `reassignTask` / `confirmQueue` / `drainQueue` / `startTask` | T09 |
| `sessionExplain` / `activityPanel` / `taskDetail` | T10 + T11 |
| `completeTask` / `unlockDownstream` / `interruptTask` / `resumeTask` / `failResume` / `confirmResume` / `pauseRun` / `continueRun` | T11 + T12 |
| `approveHumanTask` | T13 |
| `openDelivery` / `confirmDelivery` / `artifactTrace` / `showEvents` / `setRecordsTab` / `recordsPage` / `runAcceptanceCheck` | T14 |
| `settingsPage` / `saveSettings` / `nav` / `render` | T16 |

## 附录 B：已知坑位速查（来自本仓库历史）

1. `npm test` 报 MODULE_NOT_FOUND；用 `node --test "test/**/*.test.js"`（带引号）。
2. macOS `grep -P` 静默返回空；零 CJK 自查用 `python3 -c` 正则。
3. POSIX socket `sun_path` 104 字节，`TMPDIR` 必须短（`/tmp/v32t`），否则长路径导致连接假死。
4. `core.autocrlf=true` 下 `git restore` 后 status 假报 M：用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 刷新。
5. `NODE_ENV=test` 必须带，否则 `/__test__/graph/pulse` 等接缝不注册，测试假红。
6. 桌面动作在 `pointerdown` 响应，`click` 有 600ms 去重；自动化要同时派发。
7. 输入控件无 `data-field` 会在实时帧重绘时丢光标。
8. Tauri 同步 command 跑主线程；带超时往返的命令必须 `#[tauri::command(async)]`（本轮一般不涉及 Rust，但接线时勿踩）。
9. 事件与落盘有毫秒级先后，取证要「等迁移落定」再读，避免假阴性。
10. 手写台账要活过重生成：整文件重写的生成器先摘出人工段再接回（本轮报告由各任务独占文件，不适用全局生成器）。
