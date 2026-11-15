# I1.11 拆分文档 — 通知 + 人工干预队列 + 资产库浏览 + 工作流画布 + 证据浏览

> 依据：`docs/iterations/iteration-11/requirement.md` **v7**（49 AC / 37 BR / 8 NF，S0 评审闭环 `review-round4.md` **PASS**）、
> `requirement-understanding.md`、`decisions.md`（D-01~D-44）。格式样板：`docs/iterations/iteration-10a.md`（r3）。
> 模板：`docs/templates/execution-template.md` §1.3 / §1.4。分支 `feat/i1.11-notify-queue-assets`，基线 `66e5a6b`。

## 0. 迭代定位、范围与退出标准

**一句话目标**：让用户在桌面壳里被叫得回来（托盘通知）、一处看全并处理所有需要人的事（人工干预队列）、浏览三类资产与全局占用、看懂工作流定义（只读画布）与节点证据（独立视图）——全程零第三方依赖、无打包器、不动核心。

**In scope**（逐条对应需求 §1.3）：托盘通知（三类事件 + 点击定位 + 开关/去重/合并）；人工干预队列（统一列表 + 五种决策动作 + 处理后续跑 + 三处数字同源）；角色库 / 技能库 / 工作流库浏览（列表 + 详情 + 校验状态）；全局角色占用（跨实例聚合）；工作流画布（定义态只读）；证据浏览（按节点五项）；托盘信息行与暂停/继续。

**Out of scope**（摘要，去向见需求 §1.3）：角色下钻 / 节点详情 / 连接线联动 / 一键跳转宿主会话（**I1.10b 并行**，AC-43 明写不依赖）；治理与签名（I1.12）；Web 入口与 IM 通知（阶段二）；批量处置（D-01 已移出）；跨项目根聚合（数据布局变更）。

**退出标准**（可量化）：
1. 49 条 AC 全部通过（机检 / 夹具 / 架构检查三类锚点逐条留证），0 阻塞；
2. 全量回归：失败集合与判定基线（历史 8 条 + 裁决 R-08 的 AC-04）**差集 0**，`tests >= 1425`（下限只增不减，D-21 禁写 `fail === 0`）；
3. 31 词 purity 扫描 `src/core,src/daemon` 与 `desktop/ui` 双 `exit 0`；`package.json` `dependencies` 仍为 0；
4. 三条主链逐字红线不破（`single` 输出、CLI 行格式、`USAGE_LINES` 25 行）；
5. AC-38 端到端三段（收到通知 → 队列处置 → 后续跑 + 数字同步）真实链路走通；
6. AC-39 写操作清单实测成立：面板写操作只有三类（五动作 / 暂停继续 / prefs 四键）。

## 1. 技术选型（结论 + 被否决项）

| 决策 | 结论 | 理由 | 被否决项及原因 |
|---|---|---|---|
| 通知检测点 | 守护进程订阅**既有事件总线**，新增 `src/daemon/notify.js`，不改核心 | D-11 禁改 `src/core/**`；事件总线已有升级/状态变化 | ❌ 核心 hook：违 D-11；❌ 轮询 `state.json`：延迟高、无事件语义 |
| 去重窗口 | 可注入时钟的纯调度器（`now` 参数 + 可注入定时器） | 需求 D-2 / AC-06 要求 9999/10001ms 边界可测 | ❌ `setTimeout` 直调：不可测；❌ 全局去重表落盘：无规划来源 |
| 队列投影 | 遍历本机实例读 `state` 的 pending 升级/审批，**不重算**数字 | D-3；数字三处同源（AC-18） | ❌ daemon 自算 pendingEscalations：破坏「计算只在 core/persistence/shapeSnapshot」口径（D-36） |
| 通知开关存储 | `.orch/desktop/prefs.json` 四键，原子写，`src/daemon/prefs.js` 唯一写入方 | D-42 / U-10；只服务界面自身 | ❌ 写进实例 state：污染实例数据；❌ 存 views.json：语义不符 |
| 写操作入口 | 五条写接口全部经既有裁决路径（`resolveEscalation` / `approval.resolve` / `orch cancel` / `workflow.pause|resume`） | D-1；不得绕过 `transit()` CAS | ❌ HTTP 层直写 `state.json`：违反状态机唯一入口 |
| 资产/占用/画布/证据投影 | 各自独立 `src/daemon/*.js` 只读模块，复用既有注册表/校验/投影 | D-4/D-5/D-6/D-7；不重跑 schema 校验、不复制布局 | ❌ 界面层重算校验：口径漂移；❌ 第二套布局实现：违 F-02/D-6 |
| 桌面 UI | 纯静态 ESM 追加五个视图键，零依赖、无打包器 | AC-40 / BR-26 | ❌ 引框架或打包器：违 NF-1/NF-2 |
| 托盘通知 | 壳层投递 + `--probe` 记录意图与投递结果 | U-13；无头 CI 断言意图而非弹窗 | ❌ 以「真的弹窗」为判据：CI 永远失败 |
| 测试接缝 | `NODE_ENV=test` 的 `POST /__test__/{escalations,approvals,notify-trigger}` + 壳层 `--ctl` 新增四动作 | D-9/D-10 | ❌ `graph/pulse` 造占用：只写 overlay 不写 state（D-40） |
| 条数下限断言 | `test/wp14/regression.test.js` 自断言 `tests >= 1425` | D-44：不改 `scripts/desktop/gate.mjs`（发布面基线） | ❌ 改 gate.mjs 常量：牵动发布流水线登记 |

## 2. 模块划分与文件级接口契约

> 命名以 §2 签名为准，**契约先冻结**：WP-1~6 并行实现时不得偏离这些签名；WP-7 挂接前主控复核一次。

### 2.1 `src/daemon/notify.js`（新增，WP-1）
```js
export const DEDUP = { ESCALATION_MS: 10_000, ANOMALY_MS: 60_000 };   // AC-06
// 创建通知调度器。deps: { now(): number, schedule(fn, ms): cancel }
export function createNotifier({ bus, getInstanceStates, clock, prefsRead }) {}
// 返回 { intents$: AsyncIterable<NotifyIntent>, dispose() }
// NotifyIntent = { kind: 'escalation'|'completed'|'anomaly', ids: string[], instanceId,
//                  title, body, mergedCount, at }   // 逐字文案按 A-1，键在 labels
```

### 2.2 `src/daemon/prefs.js`（新增，WP-1）
```js
// 通知开关唯一写入方（D-42）。文件 <root>/.orch/desktop/prefs.json，四键：
// { enabled: true, escalate: true, completed: true, anomaly: true }，原子写入（tmp+rename）。
export async function readPrefs(root) {}       // 缺文件/缺键 → 全 true 缺省
export async function writePrefs(root, patch) {} // 只接受上述四键子集，多余键拒绝（throw）
```

### 2.3 `src/daemon/queue.js`（新增，WP-2）
```js
// 跨实例统一队列投影（D-3）。只读，不重算 pendingEscalations（读既有快照字段）。
export function buildQueue(root, { instances }) {}
// → { items: QueueItem[], totals: { pendingEscalations, pendingApprovals }, disconnected?: boolean }
// QueueItem = { type: 'escalation'|'approval', id, instanceId, nodeId|null, role, round|null,
//               stateWord, reasonSummary, createdAt }
// 排序：type（escalation 先）→ id 升序 → instanceId 升序
export async function decideEscalation(root, id, decision /* 'pass'|'retry' */) {}  // 经 orchestrator CAS
export async function decideApproval(root, id, decision /* 'allow'|'deny' */) {}    // 经 approval.resolve
// 错误透传：ESCALATION_NOT_PENDING / INSTANCE_NOT_SUSPENDED / APPROVAL_NOT_PENDING /
//           APPROVAL_SESSION_GONE / ACTION_NOT_SUPPORTED（D-3 映射表）
```

### 2.4 `src/daemon/assets-view.js`（新增，WP-3）
```js
export async function listAssets(root, kind /* 'roles'|'skills'|'workflows' */) {}
// → { items: [{ id, name, source: '内置'|'项目', group, validation: '通过'|'不通过'|'未校验' }], unreadable: string[] }
export async function showAsset(root, kind, id) {}
// 详情字段只透传（D-4）：角色（分组/artifact_type/副作用/max_concurrent_sessions/skills/tools/唤醒白名单）、
// 技能（适用/命令/摘要/正文前 BODY_PREVIEW_LINES=20 行）、工作流（节点类型计数/边数/回流数）。
// 校验失败原因与 CLI 原文逐字一致；任何接口不得写 .orch/roles|skills|workflows。
```

### 2.5 `src/daemon/occupancy.js`（新增，WP-4）
```js
export function buildOccupancy(root, { instances }) {}
// → [{ roleId, roleName, group, instances: n, activeSessions: n,
//      servingNodes: string[], status: '服务中'|'可用'|'冷却中'|'不可用'|'未参与' }]
// 复用既有 buildRoleInstances 只读投影；status 取"最忙"（服务中>可用>冷却中>不可用>未参与）；
// 注册表空不得判 unavailable（D-5）；实例不可读跳过并计数。
```

### 2.6 `src/daemon/canvas.js`（新增，WP-5）
```js
export function buildCanvas(root, workflowId) {}
// → { title, readable, valid, nodes: [{ id, nodeType, roleId|null, label }], edges: [{ from, to, kind }], problems?: string[] }
// readable/valid 三态按 D-6 / B-1；取不到输入按 readable=true、nodes 空。
// 校验复用 src/registry/workflow-validate.js；不落盘。
```

### 2.7 `src/daemon/evidence.js`（新增，WP-6）
```js
export function buildEvidence(root, instanceId, nodeId /* null = 全部节点 */) {}
// → { instanceId, items: [{ nodeId, round, command, exitCode, keyOutputLines, logRef, artifactRefs, unreadable: string[] }] }
// 数据源 D-7 三项；缺项 null（界面渲染「未提供」）；只 stat 不读日志正文。
```

### 2.8 `src/daemon/http/server.js` + `src/daemon/http/routes.js`（改，**唯一负责人 WP-7**）
- 挂 D-1 全部只读接口 + 五条写接口 + `GET /queue/stream` / `GET /notifications/stream`（SSE，500ms 合并）；
- 挂 `NODE_ENV=test` 接缝：`POST /__test__/{escalations,approvals,notify-trigger}`（D-10）；
- 既有 8 条路径与 `shapeSnapshot`（900–912）一字不改；`pendingEscalations` 只透传；
- 每条新路由映射到 2.1~2.7 的导出函数，HTTP 层零业务逻辑。

### 2.9 `desktop/ui/{queue,assets,occupancy,canvas,evidence,notify}/**` + `desktop/ui/app.js`（改，**唯一负责人 WP-8**）
- `setView()` 新增 `queue` / `assets` / `occupancy` / `canvas` / `evidence` 五键；既有四视图行为不改；
- `connection.js` 复用既有 SSE 订阅；队列行展开、通知开关设置区（queue 视图顶部）、断线标注（AC-47）；
- `desktop/harness/{queue-dump,assets-dump,occupancy-dump,canvas-dump,evidence-dump}.mjs`：无头读取投影 DOM 断言的夹具出口。

### 2.10 `desktop/src-tauri/src/{tray,probe,config,main}.rs` + `Cargo.toml`（改，**唯一负责人 WP-9**）
- `tray.rs`：菜单加信息行（只读项）+ 暂停/继续；退出路径不动；`tray-quit-confirm` 通道不动（D-9）；
- `probe.rs`：ctl 分发表只新增 `notify-open` / `tray-pause` / `tray-resume` / `queue-open`；探针事件按 D-9 清单追加；
- `config.rs`：只允许 `Labels` 加字段 + `merge_payload` 加 `pick("DESKTOP_TRAY_*")` + 同形态中文默认值；
- `main.rs`：接通知事件与导航；新增 `--no-notify`（只让投递失败）；
- `Cargo.toml`：仅允许通知插件类依赖；`package.json` 不变。

### 2.11 `src/cli/labels.js`（改，WP-7）
- 只在文件末尾追加附录 A-11 键（含 `DESKTOP_QUEUE_*` / `DESKTOP_TRAY_*` / `DESKTOP_NOTIFY_*`）；既有键与 `USAGE_LINES` 不改。

### 2.12 `test/wp14/**`（新增，归属随包：各 WP 自带契约测试，WP-11 持有 `regression.test.js` 与跨域契约）

## 3. 数据模型

### 3.1 `<root>/.orch/desktop/prefs.json`（新增，唯一事实 = `src/daemon/prefs.js`）
```json
{ "enabled": true, "escalate": true, "completed": true, "anomaly": true }
```
异常态：缺文件 / 缺键 → 全 true 缺省；非法值 → 按 true 处理并记 probe 警告（不抛错）；多余键 → 写入方拒绝。

### 3.2 队列条目（响应体样例，异常态含 `round: null` / `nodeId: null`）
```json
{ "type": "escalation", "id": "ESC-007", "instanceId": "INST-001", "nodeId": "T-001",
  "role": "执行者", "round": 1, "stateWord": "待处理", "reasonSummary": "轮次超限", "createdAt": "..." }
```

### 3.3 通知意图事件（`--probe` JSON Lines 一行）
```json
{ "event": "notify", "kind": "escalation", "ids": ["ESC-007"], "instanceId": "INST-001",
  "title": "需要人工处理", "body": "实例 INST-001 · 升级 ESC-007 · 节点 T-001 执行者 · 第 1 轮 · 轮次超限",
  "mergedCount": 1 }
```
投递结果：`{ "event": "notify-delivered", "delivered": false, "reason": "..." }`（`--no-notify` 或无头环境）。

### 3.4 画布 / 证据投影样例：见需求 A-7 / A-8（逐字基线），异常态见 D-6 三态与 D-7 缺项 `null`。

## 4. 工作包拆分

### WP-1 通知域与偏好（依赖：无）
- **负责文件（4）**：`src/daemon/notify.js`、`src/daemon/prefs.js`、`test/wp14/notify.test.js`、`test/wp14/prefs.test.js`
- **交付**：`createNotifier`（三类事件检测 + 双窗口去重合并 + 可注入时钟）、`readPrefs/writePrefs`（四键原子写）、A-1/A-2 逐字文案键引用
- **验收口径**：AC-01/02/03/05/06/07 的意图与去重断言（AC-49 的"已处理"场景由 WP-1 供意图、WP-8 断文案）；`--no-notify` 行为断言与 WP-9 协作
- **可否并行**：可（不碰共享文件）

### WP-2 队列投影与决策映射（依赖：无）
- **负责文件（2）**：`src/daemon/queue.js`、`test/wp14/queue.test.js`
- **交付**：`buildQueue`（合并/排序/空态/断线位）、`decideEscalation/decideApproval`（经 CAS，错误映射表）、排序与三处数字同源数据
- **验收口径**：AC-08/09/10/12/13/14/15/16/17/18/44 的投影与决策断言（写接口挂接由 WP-7，UI 由 WP-8）
- **可否并行**：可

### WP-3 资产库投影（依赖：无）
- **负责文件（2）**：`src/daemon/assets-view.js`、`test/wp14/assets.test.js`
- **交付**：`listAssets/showAsset` 三类资产、校验状态与 CLI 原文一致、不可读行与引用缺失降级
- **验收口径**：AC-19/20/21/22/23/24/25/46
- **可否并行**：可

### WP-4 全局角色占用投影（依赖：无）
- **负责文件（2）**：`src/daemon/occupancy.js`、`test/wp14/occupancy.test.js`
- **交付**：`buildOccupancy` 跨实例聚合、最忙状态序、注册表空不判 unavailable
- **验收口径**：AC-26/27/28（夹具禁 `graph/pulse`，D-40）
- **可否并行**：可

### WP-5 工作流画布投影（依赖：无）
- **负责文件（2）**：`src/daemon/canvas.js`、`test/wp14/canvas.test.js`
- **交付**：`buildCanvas` 定义态投影、readable/valid 三态、回流边 kind
- **验收口径**：AC-29/30/31/45
- **可否并行**：可

### WP-6 证据投影（依赖：无）
- **负责文件（2）**：`src/daemon/evidence.js`、`test/wp14/evidence.test.js`
- **交付**：`buildEvidence` 五项 + 轮次、缺项 null、只 stat 不读正文
- **验收口径**：AC-32/33/34
- **可否并行**：可

### WP-7 HTTP 面、测试接缝与文案键（依赖：WP-1~6 全部）
- **负责文件（4）**：`src/daemon/http/server.js`、`src/daemon/http/routes.js`、`src/cli/labels.js`、`test/wp14/http-contract.test.js`
- **交付**：D-1 全部路由挂接（只读 9 组 + 写 5 条 + 2 条 SSE）、`NODE_ENV=test` 三个 `__test__` 接缝、A-11 文案键追加、错误映射表
- **验收口径**：AC-15/16 的错误映射、AC-17/18 的透传同源、AC-39 写接口清单、AC-40 依赖零新增；既有 8 路径与 `shapeSnapshot` 逐字不动的回归断言
- **可否并行**：否（唯一负责人，等六个投影模块签名冻结）

### WP-8 桌面 UI 五视图与 harness（依赖：WP-7 契约冻结；实现可与 WP-9 并行）
- **负责文件（10+）**：`desktop/ui/app.js`（唯一负责人）、`desktop/ui/{queue,assets,occupancy,canvas,evidence,notify}/**`、`desktop/harness/*.mjs`、`test/wp14/ui-{queue,assets,occupancy,canvas,evidence}.test.js`
- **交付**：五视图 + 队列行展开 + 通知开关设置区 + 断线标注与自动补全 + 画布渲染复用 `graph/layout.js` + 五个 dump 夹具
- **验收口径**：AC-04/05/08/11/14/42/43/47/49 的 UI 断言；A-3~A-8 逐字文案
- **可否并行**：与 WP-9 可（文件无交集）

### WP-9 壳层托盘与通知投递（依赖：WP-7 契约冻结；实现可与 WP-8 并行）
- **负责文件（6）**：`desktop/src-tauri/src/{tray,probe,config,main}.rs`、`desktop/src-tauri/Cargo.toml`、`test/wp14/shell-*.test.js`
- **交付**：信息行 + 暂停/继续菜单、ctl 四新动作、D-9 探针事件、`--no-notify`、`config.rs` 三件事、经 `/control/pause|resume` 逐实例暂停汇总
- **验收口径**：AC-01/02/03/04/07/35/36/37/48 的壳层断言（`tray-quit-confirm` 通道不动）
- **可否并行**：与 WP-8 可

### WP-11 回归红线与整合验收（依赖：WP-1~9 全部）
- **负责文件（3）**：`test/wp14/regression.test.js`、`test/wp14/contract.test.js`、`test/wp14/e2e.test.js`
- **交付**：全量回归差集断言（`tests >= 1425`，D-44）、31 词 purity ×2、依赖零新增、写操作清单、AC-38 端到端三段、AC-43 不依赖 I1.10b
- **验收口径**：AC-38/39/40/41/43
- **可否并行**：否

> 注：无 WP-10（编号预留未用，后续补包从 WP-12 起，避免与历史批次记录混淆）。

### AC → WP 满覆盖映射

| AC | 主责 | 协作 | AC | 主责 | 协作 |
|---|---|---|---|---|---|
| AC-01 | WP-1 | WP-9 | AC-26 | WP-4 | WP-8 |
| AC-02 | WP-1 | WP-9 | AC-27 | WP-4 | WP-8 |
| AC-03 | WP-1 | WP-9 | AC-28 | WP-4 | WP-8 |
| AC-04 | WP-9 | WP-8, WP-1 | AC-29 | WP-5 | WP-8 |
| AC-05 | WP-1 | WP-8 | AC-30 | WP-5 | WP-8 |
| AC-06 | WP-1 | — | AC-31 | WP-5 | WP-8 |
| AC-07 | WP-9 | WP-1 | AC-32 | WP-6 | WP-8 |
| AC-08 | WP-2 | WP-8 | AC-33 | WP-6 | WP-8 |
| AC-09 | WP-2 | WP-7, WP-8 | AC-34 | WP-6 | WP-8 |
| AC-10 | WP-2 | WP-7, WP-8 | AC-35 | WP-9 | WP-2 |
| AC-11 | WP-2 | WP-7, WP-8 | AC-36 | WP-9 | WP-7 |
| AC-12 | WP-2 | WP-7, WP-8 | AC-37 | WP-9 | WP-1 |
| AC-13 | WP-2 | WP-8 | AC-38 | WP-11 | 全部 |
| AC-14 | WP-2 | WP-8 | AC-39 | WP-11 | WP-7 |
| AC-15 | WP-7 | WP-2, WP-8 | AC-40 | WP-11 | — |
| AC-16 | WP-7 | WP-2, WP-8 | AC-41 | WP-11 | — |
| AC-17 | WP-2 | WP-7 | AC-42 | WP-8 | 各域 |
| AC-18 | WP-2 | WP-7 | AC-43 | WP-8 | — |
| AC-19 | WP-3 | WP-8 | AC-44 | WP-2 | WP-8 |
| AC-20 | WP-3 | WP-8 | AC-45 | WP-5 | WP-8 |
| AC-21 | WP-3 | WP-8 | AC-46 | WP-3 | WP-8 |
| AC-22 | WP-3 | WP-8 | AC-47 | WP-8 | WP-7 |
| AC-23 | WP-3 | WP-8 | AC-48 | WP-9 | WP-7 |
| AC-24 | WP-3 | WP-8 | AC-49 | WP-8 | WP-1, WP-9 |
| AC-25 | WP-3 | WP-11 | | | |

## 5. 交付物清单

| 路径 | 内容 | 归属 |
|---|---|---|
| `src/daemon/{notify,prefs,queue,assets-view,occupancy,canvas,evidence}.js` | 七个守护进程只读/单写模块 | WP-1~6 |
| `src/daemon/http/{server,routes}.js`（改） | D-1 接口 + `__test__` 接缝 | WP-7 |
| `src/cli/labels.js`（改） | A-11 文案键追加 | WP-7 |
| `desktop/ui/{queue,assets,occupancy,canvas,evidence,notify}/**` + `app.js`（改） | 五视图 + 通知开关设置区 | WP-8 |
| `desktop/harness/*.mjs` | 五个无头 dump 夹具 | WP-8 |
| `desktop/src-tauri/src/{tray,probe,config,main}.rs` + `Cargo.toml`（改） | 托盘/探针/配置/导航 | WP-9 |
| `test/wp14/*.test.js` | 各域契约 + 回归红线 + e2e | WP-1~9、WP-11 |
| `docs/iterations/iteration-11/{report,acceptance-*,final-verification}.md` | S3/S4 产物 | S3/S4 阶段 |

## 6. 依赖与并行策略

```
WP-1 ─┐
WP-2 ─┤
WP-3 ─┼─→ WP-7 ─→ { WP-8 ∥ WP-9 } ─→ WP-11
WP-4 ─┤
WP-5 ─┤
WP-6 ─┘
```

- **契约先冻结点**：本文件 §2 签名即契约；WP-1~6 并行期间不得偏离。WP-7 开工前主控对照需求附录 D-1 复核一次签名与路由表。
- **分批执行**（每批 1~2 个 Agent，控 429 风险；证据分批落盘防中断丢失）：
  - 批次 A：WP-1 + WP-2（两个 Agent 并行）
  - 批次 B：WP-3 + WP-4（两个 Agent 并行）
  - 批次 C：WP-5 + WP-6（两个 Agent 并行）
  - 批次 D：WP-7（单 Agent，挂接 + 接缝 + 文案键）
  - 批次 E：WP-8 + WP-9（两个 Agent 并行）
  - 批次 F：WP-11（单 Agent 整合）→ S3 验收
- **整合检查点**：每批结束跑 `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"`，判据 = 失败集合与判定基线差集 0 且 `tests >= 1425`；批间还原 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`（已知副作用）。

## 7. 风险与降级

| 风险 | 影响 | 处置（点名） |
|---|---|---|
| Agent 平台 429 限流 | 批次中断 | 每批 1~2 个 Agent；证据即时落盘 `evidence/acc11/`；中断后主控接管（I1.11 S0 先例） |
| `pendingEscalations` 计数口径破坏（D-36） | AC-18 判红 | 禁改 `shapeSnapshot`（server.js:900–912）；daemon 新模块零计数表达式；验收用 AC-18 的函数体切块脚本（单行 grep 是行级假阴性） |
| 托盘行为三平台差异 | AC-35/36 判据漂移 | 判据全打在 `--probe` 事件行（`tray-status` / `tray-pause` / `notify*`），不依赖真实弹窗（U-13） |
| `tray-quit-confirm` 被误移入 ctl 分发器 | I1.10a 退出语义破坏（I1.10a 实测坑） | D-9 明文禁止；WP-9 任务书重申；`test/wp14/shell-*.test.js` 加守护断言 |
| 桌面 UI 负载型 flake | 全量误红 | 沿用 `scripts/desktop/gate.mjs` 的文件级隔离复跑口径；判定按差集 |
| `prefs.json` 并发写 / 非法值 | AC-05 flaky | `prefs.js` tmp+rename 原子写；缺键全 true 缺省；多余键 throw（§3.1） |
| SSE 断线重连丢帧 | AC-47 判红 | 断线保留旧内容 + 「已断开」标注，恢复自动补全；夹具用守护进程可停可起构造 |
| 占用夹具误用 `graph/pulse` | 占用投影读不到（D-40） | WP-4/WP-8 任务书明写：手写 `state.json` + `test.dispatch` |
| 改动越入 `src/core/**` | 违 D-11、逐字红线破 | purity 扫描 + `git diff --name-only` 批后核对；确需改核心先回来改需求 |
| 全量测试改写 NFR 性能证据 | 脏工作区 | 每批后 `git checkout -- docs/iterations/iteration-4/evidence/nfr-perf-*.json` |

## 8. 与需求的对齐声明 / 冲突清单

**声明**：本拆分不新增需求条目，不删减 AC；所有冲突以 `requirement.md` **v7** 为准，裁决以 `decisions.md` D-01~D-44 为准。

**冲突清单**（实现期发现的新冲突必须回填本节并立裁决）：
1. `scripts/desktop/gate.mjs:18` 的 `BASELINE_TESTS = 1157` 为 I1.10a 旧值 → 已裁决 **D-44**：条数下限由 `test/wp14/regression.test.js` 自断言，不改 gate.mjs。
2. 需求 AC-26 括注 `src/registry/role-instances.js:131–138`，实测合并逻辑约 130–141 行 → 语义锚点存在，按「合并逻辑区间」断言，不逐行（不判阻断，源自 requirement-understanding §8）。
3. 无其余冲突。S0 四轮评审（F/G/H/I 四张清单）+ 44 条裁决已全部闭合或显式登记为建议级。
