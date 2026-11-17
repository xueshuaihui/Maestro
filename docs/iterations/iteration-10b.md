# I1.10b 任务拆分与文件级契约（角色下钻 + 联动 + 特殊节点交互 + 一键跳转）

> 需求依据：`docs/iterations/iteration-10b/requirement.md` **v5**（1701 行，51 条 AC / 43 条 BR / 7 条 NF / 附录 A~D；5 轮独立评审，round5 总判 PASS、阻断 0 / 建议 3）。**本拆分以它为唯一验收依据：不增 / 不删 / 不合并 AC，不放宽任何 Then，不把范围条目挪到范围外。**
> 上游实现：I1.10a 收口（分支 `feat/i1.10b-drilldown`，基线 HEAD `66e5a6b`；全量基线 **1425 tests**，失败集合按裁决 G 三段式判定，允许集合 = `docs/iterations/iteration-10a/baseline-failures-win32.txt` 的 16 条平台登记项 ∪ 留帧 flake）
> 评审依据：`docs/iterations/iteration-10b/decisions.md`（裁决 A~I，效力最高）、`requirement-understanding.md`（AC 分面 / D-14 锚点 / 移交 S1 注意事项）、`progress.md`（S0 收口要点）
> 拆分自检口径：模板 `docs/templates/execution-template.md` §1.3（0~8 骨架）/ §1.4（WP 四硬规则 + 五字段 + §4 末尾满覆盖表）/ §1.5（10 条自检）/ §1.6（可复制骨架）；形态样板 `docs/iterations/iteration-10a.md`（r3，12 WP）
> 契约优先级（模板 §2.8）：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > M/C 契约清单 > 规划文档 > 代码现状`。代码现状只用于核对签名与行段（本轮全部实点，见 §2 / §8），不作需求来源。

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：把「角色流程图看见红点」到「弄清楚为什么、处理掉、让它继续跑」这段路补齐——点角色进入下钻（状态栏 + 1 跳局部 DAG + 任务卡片）、点卡片看会话时间线与证据、点连接线看交接包明细、点人工 / 升级节点直达处置，子工作流逐层下钻，并能一键唤起 DeepSeek Harness 并给出可核对（剪贴板 + 与实例状态里的 `sessionId` 一致）的会话标识；全程不需要终端。

**In scope**（逐条对应需求 §1.3「范围内」11 条，落位到 WP）：

| # | 范围条目（需求 §1.3） | 需求 §2 落点 | AC | 主责 WP |
|---|---|---|---|---|
| 1 | 角色下钻视图（状态栏五项 + 局部 DAG 1 跳 + 卡片列表，返回后流程图状态不丢） | §2.2~§2.4 | AC-01/02/05/38 | WP-3 / WP-4 |
| 2 | 任务卡片（三层 + 6 态指示器 + 节点类型特殊显示 + 耗时换算） | §2.5 | AC-07/08/09/10/35 | WP-3 |
| 3 | DAG 与卡片联动（滚动 + 高亮，零死链） | §2.6 | AC-06 | WP-3 |
| 4 | 节点详情层（四段 + 空态 + 证据可复制） | §2.7 | AC-11~15 | WP-3 |
| 5 | 「查看全部节点」切换（复用 I1.10a 7 列看板，原路返回下钻） | §2.8 | AC-16 | WP-4 |
| 6 | 子工作流下钻（逐层 + 逐级返回 + 三种降级） | §2.9 | AC-17/18/36 | WP-3 |
| 7 | 连接线点击（交接包列表 + 每包时间线 + 历史轮次） | §2.10 | AC-19/42/43 | WP-3 |
| 8 | 特殊节点交互（人工 → 详情；升级节点 / `escalated` 角标 → 本实例升级面板） | §2.11 | AC-20/21/49 | WP-3 / WP-4 |
| 9 | 升级处理闭环（唯一动作「继续」，经既有 `resolveEscalation` 的 retry 语义） | §2.12 | AC-22/23/24/44/45 | WP-2 / WP-3 / WP-4 |
| 10 | 一键跳转宿主会话（裁决 A 三段口径 + 裁决 I 核对方式 + 四种降级） | §2.13 | AC-25/26/33/46 | WP-5 |
| 11 | 下钻层实时性与只读（2 秒内更新、会话变化不重排、浏览全程只读） | §2.14 | AC-27/28/47/48/50 | WP-4 / WP-2 |

新增异常边界与架构守门条目（AC-30/31/32/34/37/39/40/41/51）按 AC→WP 映射表落 WP-1~WP-6。

**Out of scope**（摘要，全表见需求 §1.3；本拆分不重排、不收窄）：

- 通知 / 跨实例人工干预队列 / 审批裁决 / 重派终止 / 角色技能工作流库 / 托盘增强 → **I1.11**；证据过期检测 / 指纹校验 / 权限拦截 / 性能基线 → **I1.12**；多宿主跳转 / Web 远程查看 → **I2.4**。
- 按会话自动定位（深链）：**规划不可达**（裁决 A：DSH 0.2.2-rc.1 无会话级深链），本迭代按「唤起 + 标识可核对」交付，AC-25/AC-29 均带显式偏离说明。
- 窗口级自动判定：本机无 Rust / MSVC（裁决 B），全部界面判据走纯模块面 + `createApp` 装配路径 + 回环接口面；窗口内动作登记人工核验项。
- 运行时推进 `human` / `escalate` / `subworkflow` 节点：承 I1.10a U-4，实例由夹具构造。
- 看板拖动排序 / 筛选 / 批量、多项目多窗口、导出打印分享：不在本迭代。
- **本拆分明确不动的既有行为**（需求 D-13）：CLI 命令表 / `USAGE_LINES` 25 行 / 三条主链输出、核心 RPC 方法表、`buildRoleInstances` / 图投影 / 布局 / 看板 / 折叠 / 标签策略、I1.10a 的 44 条 AC 与全部逐字文案、`desktop/ui/graph|board|list/**`、`src/core/**` / `src/registry/**` / `src/cli/**` / `src/persistence/**` / `src/templates/**`。

**退出标准**（逐条可判定，含数字或逐字口径）：

1. **AC 51 条 100% 通过 / 0 不通过 / 0 阻塞**：AC-01~AC-51 每条 `**Then**` 均有对应机检 / 夹具 / 架构检查断言通过；证据按「AC 号 + 阶段 + 类型」落 `docs/iterations/iteration-10b/evidence/`，每条至少 4 份原始帧（出处：模板 §3.3「每条 AC 至少 4 个证据文件」，非本拆分自加需求）；AC-25 / AC-33 为 C 类真实面（本机 DSH 0.2.2-rc.1），窗口前置 / 剪贴板 / 拖拽手感登记人工核验项、不计自动通过数；收口不带阻塞。
2. **回归基线不破（裁决 G 三段式）**：全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` 满足 ① `tests ≥ 1425`（条数只增不减）；② 失败集合与允许集合（16 条登记项 ∪ 留帧 flake，帧落 `docs/iterations/iteration-10b/flake-frames/`）**差集 = 0**；③ 集合外新红先单文件独占复跑、禁 `--no-flake-confirm` 一类开关。**不以单次失败条数（21/15/14）作判据**；`test/wp13/http-channel.test.js` 与 `test/wp13/readonly-local.test.js` 为本机稳定红、在登记项内，**不得要求 `# fail 0`**。
3. **既有面逐字不变**：三条主链（`single` / `code-loop` / `task-loop`）终端输出、`orch instance status` / `instance graph` 两种格式、CLI 命令表与两层子命令表、`USAGE_LINES` 25 行、核心 RPC 方法表不动；I1.10a 的 44 条 AC 判据与附录 A-1~A-14 全部逐字文案不改；既有测试文件除 D-11 授权的 `test/wp13/labels-desktop.test.js` 三处（63 行 `EXPECTED_DESKTOP_KEYS` 追加、131 行 `EXPECTED_DESKTOP_VALUES` 追加、310 行 `147` 断言改为 `147 + 新增键数`）外一律不改。
4. **架构门禁**：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词全表>` 与 `--dirs desktop/ui,desktop/harness --forbid <31 词全表>` 均 `exit 0`；`desktop/ui/**` 与 `desktop/harness/**` CJK 零命中；`node -p "Object.keys(require('./package.json').dependencies||{}).length"` 输出 `0`；全部 51 条 AC 的架构检查按各自期望值（零命中 `exit 1` / ≥1 条 `exit 0`）通过。
5. **D-14 契约锚点落地复核**：表 A 的 5 条（A1 `drill-dump.mjs::main`、A2 `applyTestOverlay` 第二调用点、A3 返回流程图导航方法、A4 `io.continueEscalation`、A5 `ensureStreams().drill`）全部落地并逐条复核；表 D 的 15 条按「未落地记不计通过、不判红」口径复核；表 C1（会话标识 ↔ DSH 落盘目录名）S2 开工首日实测留痕。
6. **D-10 / D-11 授权边界**：`git show --stat` 逐 WP 核对只动授权文件与点名行段（§2 逐文件登记）；`src/core/**` / `src/registry/**` / `src/cli/**` / `src/persistence/**` / `src/templates/**` / `desktop/ui/graph|board|list/**` / `desktop/src-tauri/**` 一行不改。
7. **NF-1~NF-7 全部满足**：NF-1 进入速度（AC-01/06/17，内部断言）、NF-2 实时性 ≤2s（AC-27/47）、NF-3 处置 ≤2s（AC-22/23）、NF-4 稳定性 40 次导航（AC-28，U-16 内部口径）、NF-5 只读与本地性（AC-28/22；`readonly-local` 仅记录实测值不卡点）、NF-6 无回归（AC-34）、NF-7 零依赖 / 零中文 / 31 词扫描（AC-30）。

---

## 1. 技术选型（结论 + 被否决项）

### 1.1 下钻前端模块：`desktop/ui/drill/` 独立目录的纯渲染 / 投影模块

**结论**：下钻全部界面逻辑落 9 个新文件 `desktop/ui/drill/{role-bar,dag,cards,node-detail,handoff-panel,escalation-panel,host-jump,subflow,index}.js`，全部为纯函数模块（不访问 DOM / `fs` / `Date.now` / `window`），由 `desktop/ui/app.js` 的 `createApp({labels, project, io})` 装配；验收用 `desktop/harness/drill-dump.mjs` 直接 import 同一批模块对文本 / 结构逐字断言（需求判定口径 1、D-14 表 A1）。模块导出签名按 D-14 表 D 登记为契约（D2~D9 + D15），先冻结后并行。
**理由**：① 判定口径 1 要求下钻四段 / 面板 / 面包屑全部由纯模块生成，窗口只是宿主；② `app.js` 现状 1837 行，塞入下钻逻辑会让「文件唯一负责人」失效并污染 I1.10a 已交付的四视图行为；③ `desktop/ui/board/board.js` 是 I1.10a 只读基线（D-13 冻结），下钻卡片排序（8 档 tier）与看板归列是两套口径（显示词折叠 ≠ 档位折叠，F4-01），不能共用实现也不能互相改写。
**被否决**：
- **塞进 `board.js` / `app.js` 内联**：违反判定口径 1（`desktop/ui/drill/*.js` 必须独立可 dump）、违反 D-13（`board.js` 行为零改）、大文件多负责人违反 §1.4 硬规则 1。
- **React / Vue 等框架或第二套渲染**：零 npm 依赖红线（BR-29/NF-7）+「不另写一套渲染逻辑」；被裁决 H 第 5 条的分层口径直接排除。

### 1.2 下钻取数：daemon 侧只读投影 `src/daemon/drill.js` + 7 个回环端点

**结论**：下钻数据由服务端纯投影产出：新增 `src/daemon/drill.js`（纯函数 + 只读读取器 `loadState` / `replayEvents` / `readTraces`，`now` 由调用方传入，D-1/D-2），经 `src/daemon/http/routes.js` 追加 5 条 GET、`src/daemon/http/server.js` 白名单与分派段追加 2 条 POST（D-3，合计 5 GET + 2 POST = 7 端点）。下钻投影与图投影**共用同一份实例快照 + 同一个 in-memory pulse overlay**：下钻路由构建投影后调用既有导出 `createStreamHub().applyTestOverlay(graph, instanceId)`（`stream.js:255` 定义 / `650` 导出，既有唯一调用 `server.js:318`，S2 在下钻路由新增**第二处调用点**，契约 A2，不改 overlay 结构）。
**理由**：① AC-13 架构检查禁止 `execution.summary` 出现在 `desktop/ui/`——界面不直接读事件流，摘要由 daemon 只读投影选定唯一一条；② AC-27/43/47 的机检要求 `POST /__test__/graph/pulse` 对下钻视图天然生效，唯一可行路径就是共用 overlay（裁决 H 第 2 条）；③ daemon 只下发「键 + 结构化数据」、不拼整句中文（A-10 职责划分），折叠 / 占位 / 拼行在渲染层。
**被否决**：
- **界面层自行读 `state.json` / 事件流拼装**：违反 AC-13 / AC-32 架构检查（`grep execution\.summary desktop/ui/`、`grep cli/labels desktop/ui/drill/` 零命中）与 BR-29。
- **新增下钻专用推送通道 / 新增事件类型 / `new EventEmitter`**：被裁决 H 第 2 条与 U-13 明令否决；AC-27/47 架构检查 `grep -REn "new WebSocket\(|new EventSource\(" desktop/ui/drill/ src/daemon/drill.js` 与 `grep -REn "new EventEmitter|setInterval\(.*refetch" src/daemon/drill.js desktop/ui/drill/` 必须零命中。
- **为下钻私建 overlay 映射（`overlayByInstance` / `overlayRoles`）**：AC-27 架构检查明令零命中，只允许读取既有 hub 导出。

### 1.3 下钻订阅与断线重取：扩 `ensureStreams()` 图流条件（契约 A5），不新增通道

**结论**：下钻层复用既有 `/instances/:id/graph/stream` 订阅；`desktop/ui/app.js` 的 `ensureStreams()` 图流打开条件由现状 `view === 'graph'`（实点 `app.js:1477`）扩为 `graph || drill`，沿用 `graphStreamId` 去重；断开后走既有重连骨架（`onStatus('closed')` → `scheduleReconnect()` 1 秒后重开，实点 `app.js:1444-1451` / `1488-1495`），重开首帧 `graph.snapshot`（`stream.js:462,518`）触发下钻重取。`view === 'drill'` 的保持 / 重开是**新增调用点**（D-14 表 A5 / 表 D D14），不是新接口、不是新帧类型。重取只替换状态栏与卡片，局部 DAG 保留上一帧（F4-13 局部更新规则）。
**理由**：AC-50 的「绑定归零 → 重取」只能靠「第二份快照 + 断开重连 + 首帧重取」构造（pulse 接缝改不了绑定，见 §7 风险 1）；复用同一条流是 U-13 的唯一合规解。
**被否决**：
- **新增第二条 SSE 通道或新帧类型**：U-13 / AC-47 架构检查否决。
- **`retryConnection()`**：实点 `desktop/ui/connection.js:173` 的 `retry()` 守卫为 `status === 'failed'`（172 行是方法声明），AC-50 的现场是 `closed` 而非 `failed`，不可用（D-14 表 B4）。

### 1.4 返回流程图的导航方法：新增方法，不复用既有退回路径（契约 A3）

**结论**：`app.js` 新增专用的「返回流程图」导航方法，行为 = 从 `drill` 回到 `graph`，保留 `graph` / `graphId` / `viewState` / `collapse` / `layout` / `offsets` / `zoom` / `pan`，只清下钻相关字段。
**理由**：实点核验三个反例边界——`backToList()`（`app.js:410-417`）把 `state.viewState` 置 `null`；`openGraph()`（`app.js:310`）与 `rebuildGraph()`（`app.js:389`，内部 `app.js:396` 处 `createViewState`）都会重建视图状态、复位缩放。AC-02 的行为断言（返回后 `viewState !== null` 且五组值逐字段相等）与架构检查（`createViewState(` 在 `app.js` 恰好 2 处 = 396/462，`desktop/ui/drill/` 内零命中、`backToList(` 零命中）据此成立。
**被否决**：复用 `backToList()` / `openGraph()` / `rebuildGraph()`——三者都会丢或重建视图状态，AC-02 必判红。

### 1.5 一键跳转：配置驱动适配器 `src/adapter/host-open.js` + 「最近活跃」由请求方计算

**结论**：daemon 侧新增 `src/adapter/host-open.js::openHost`（契约 D10）：解析 `<root>/.orch/hosts/<hostId>.json` 的 `open: {command, args}` 段，缺省时复用 `src/adapter/dsh-launch.js` 的 `resolveDshLaunch`（实点：`dsh-launch.js:69` 导出）推导 DSH exe 路径；`spawn(command, args, {detached: true, stdio: 'ignore'})` 后不等待不轮询；同一 `(instanceId, sessionId)` 500ms 窗口去重（BR-33）。多活跃会话取「最近活跃」由**界面（请求方）**按 BR-24 计算后传 `sessionId`，适配器只按传入值执行；返回体带 `sessionChoice: 'most-recent-active'`（F-21）。错误码形状：`DSH_SPAWN_FAILED` + 路径不存在 → 「未找到 DeepSeek Harness」；宿主配置无 `open` 段 → 「宿主 <host> 不支持跳转」。
**理由**：U-10 配置驱动是基线 96/361 行的既有约束；AC-25 架构检查 `grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js` 零命中、`grep -REn "hosts/" src/adapter/host-open.js` ≥1 条命中，把宿主分支写死在 daemon 会直接判红。
**被否决**：
- **daemon 里 `if host == 'dsh'` / `switch (host)` 分支**：AC-25 架构检查明令零命中（U-10）。
- **适配器自行挑选会话**：BR-24 规定跳转目标必须确定（最近活跃），选择逻辑在请求方，适配器自行挑选会让 AC-25 的派生断言失效。
- **读取 DSH 用户配置 / 写 `~/.dsh`**：D-4 明令禁止。

### 1.6 升级「继续」：唯一写路由转发既有裁决，错误码不越过界面层

**结论**：`POST /instances/:id/escalations/:escalationId/continue` 是本迭代**唯一写路由**，转发既有 `orchestrator.resolveEscalation({decision:'retry'})`（裁决 C，与 `orch escalate resolve --decision retry` 同一条核心路径）；失败返回 `{ok:false, code, messageKey, message}`——`code` 只留在 daemon 侧（`ESCALATION_NOT_PENDING` / `INSTANCE_NOT_SUSPENDED`，实点 `src/core/escalation.js:89`、`src/core/orchestrator.js:5049/5052`），daemon 新增「码 → messageKey」映射字面量（`DRILL_ESC_ALREADY` / `DRILL_ESC_NOT_SUSPENDED`，D-3），界面只按 `messageKey` 分支选文案。界面侧经新增可选 transport 方法 `io.continueEscalation({instanceId, escalationId})`（契约 A4，注入形状同既有 `io.getLabels()`，实点 `app.js:192-205`）。
**理由**：AC-22 架构检查禁止 `state = 'running'|node.state = ` 出现在 `src/daemon/http/` 与 `desktop/ui/drill/`；AC-23 架构检查双向判据（原始码在 `desktop/ui/` 与 `desktop/harness/` 零命中、`DRILL_ESC_*` 在 `desktop/ui/drill/` ≥1、原始码在 `src/core src/daemon src/cli` ≥1）。
**被否决**：
- **界面直接改状态字段**：AC-22/AC-45 架构检查明令零命中。
- **界面判原始 `code`**：AC-23 的「码不越过界面层」双向扫描直接否决。

### 1.7 文案键底座：`DRILL_*` 前缀追加到 `DESKTOP_LABEL_KEYS`，`src/cli/labels.js` 零改动

**结论**：新增键只追加到 `src/daemon/http/labels.js` 的 `DESKTOP_LABEL_KEYS`（实点 `labels.js:31`；`ROLE_INSTANCE_STATUS_LABEL` 平铺下发在 23/137 行），键集合与逐字值按需求 A-10 全表；既有键值一字不改；`UI_LABEL_KEYS` 平铺逻辑不动。配套 D-11 授权修改 `test/wp13/labels-desktop.test.js` 三处（63 行键清单追加、131 行值断言追加、310 行 `147` 计数断言改为 `147 + N`）。
**理由**：U-12（承 I1.10a 裁决 E）的 daemon 单文件方案；AC-03 架构检查 `grep -REn "ROLE_INSTANCE_STATUS_LABEL" src/daemon/http/labels.js` ≥1 条命中是现状事实锚点。
**被否决**：改 `src/cli/labels.js`（D-1「不得修改」红线）；中文写进 `desktop/ui/**`（AC-07/30 的 CJK 零命中 + 31 词扫描）。

### 1.8 文本断言通道：新增 `desktop/harness/drill-dump.mjs`（契约 A1）

**结论**：新增 harness `drill-dump.mjs`，CLI 形态 `node desktop/harness/drill-dump.mjs --payload <graph.json> --role <roleId> [--node <id>] [--edge <id>] [--escalations <instanceId>] [--out <file>]`，导出 `main(argv)`（退出码 0/1/2），stdout / `--out` 输出 `{breadcrumb, roleBar, dag, cards, detail, connection, escalations}` JSON；实现仿同目录既有 `graph-dump.mjs`（实点：`parseArgs` / `fail()` 同形态，`--payload` 既可输入也可输出）。
**理由**：D-14 表 A1 的同类既有实现依据；判定口径 1 要求对文本 / 结构逐字断言。
**被否决**：复用 `collect.mjs`——实点确认它只采 `GET /instances` 与 `GET /ui/labels`、**不产图**（裁决 H 第 4 条：AC-01 不得用它）；复用 `graph-dump.mjs` 扩参——它是 I1.10a 交付物，属 D-13 冻结面。

### 1.9 卡片排序与档位：8 档 `tier` 常量逐字对齐基线 489

**结论**：`desktop/ui/drill/cards.js` 导出档位常量序 `escalated > failed > running > review > assigned > ready > blocked > done`（8 档，数值 `rank` 1~8 单调不减），`assigned` 显示词折叠为「执行中」但**档位独立**；`pending` 按"上游是否全部完成"拆 `ready` / `blocked`；未知状态落 `blocked` 档带 `unknown` 标记（与 `board.js` 兜底同口径、不共用实现）。
**理由**：F4-01（阻断）恢复基线 489 的 8 档；AC-08 断言 `rank` 序列 `[1,2,3,4,5,6,7,8,8]` 且 `T-012` 的 `tier === 'assigned'`；AC-10 断言 `Z-001` 的 `tier === 'blocked'` 且图投影 `boardColumn === 'blocked'`。
**被否决**：把 `assigned` 折进 `running` 档（v4 前的写法）——F4-01 明确阻断，A-0 的「显示词折叠 ≠ 排序档位折叠」口径被打破。

### 1.10 长列表与滚动类机检承载：原生滚动 + 分页渲染 + 模型坐标

**结论**：连接线面板用原生滚动 + 只渲染可视区分页（`renderedRows < 60`，60 条夹具下），不引第三方虚拟滚动库（D-8）；AC-42/43 的 `scrollElapsed` / `anchorRowTop` / `renderedRows` 在**纯模块面**用"模型坐标 + 注入时钟"计算，标注内部断言、不冒充用户可见结论（裁决 H 第 5 条 / F4-14）。
**被否决**：虚拟滚动 npm 库（零依赖红线）；为此引入真实 DOM / 浏览器依赖（裁决 B 无窗口面，且 S2 不为此引入浏览器依赖）。

### 1.11 测试目录与既有测试边界

**结论**：新增 `test/wp14/`（17 个文件，名单 = D-9，本拆分逐文件归属见 §4）；除 D-11 授权的 `labels-desktop.test.js` 三处外，`test/wp13/**` 36 个既有文件（实点 `ls test/wp13/*.test.js | wc -l` = 36）是回归门禁，一个都不改。
**被否决**：把新测试并入 `test/wp13/`（U-14 明令新开 wp14）；为让既有红变绿而放宽断言（模板红线 1）。

---

## 2. 模块划分与文件级接口契约

> 逐文件给出「新增 / 改、导出签名、入参出参、归属 WP」。标注「改」的 5 个既有文件（`routes.js` / `server.js` / `http/labels.js` / `app.js` / `labels-desktop.test.js`）是 D-10 / D-11 点名的最小改动面，各自唯一负责 WP；「只读基线」目录是 D-13 冻结面、不算任何 WP 的负责文件。全部新增 / 改文件：零中文（`desktop/ui/**`、`desktop/harness/**`）、零 31 禁词、零 `if host ==` 分支、零第三方依赖。
> **契约锚点总表**（D-14 表 A 五条在本节的落点）：A1 → §2.4 `drill-dump.mjs`；A2 → §2.1 `routes.js`（第二调用点）；A3 → §2.5 `app.js`（返回导航方法）；A4 → §2.5 `app.js`（`io.continueEscalation`）；A5 → §2.5 `app.js`（`ensureStreams().drill`）。表 D 15 条随各文件导出签名逐条落地（D1→§2.1、D2~D9/D15→§2.3、D10→§2.1、D11→§2.4、D12→§2.6、D13→§2.7、D14→§2.5）。

### 2.1 daemon 侧（WP-2 / WP-1）

- `src/daemon/drill.js`（**新增**，WP-2）—— 契约 D1：`契约：src/daemon/drill.js::buildDrill`。导出：
  - `buildDrill({ state, workflowDef, roles, graph, now })` → `{ breadcrumb, roleBar, dag: {nodes, edges, bounds, dangling}, cards }`（角色下钻一次性数据，D-3 第 1 行）；
  - `buildNodeDetail({ state, workflowDef, events, handoffs, nodeId, workspace, cwd })` → `{ node, timeline[], summary|null, evidence[], handoffs[] }`；
  - `buildConnectionPanel({ state, workflowDef, handoffs, edgeId, graph })` → `{ edge, handoffs:[{...timeline[]}] }`；
  - `buildEscalationList({ state })` → `{ items[] }`（只取 `state === 'pending'`）；
  - `buildSubflowGraph({ workflowDef, ref, visited })` → `{ nodes[], edges[], workflow }`（复用 `server.js` 的 `resolveSubWorkflows` 口径与深度上限，`visited` 集合循环检测）。
  - 约束：纯函数 + 只读读取器（`loadState` / `replayEvents` / `readTraces`，只 import 不改 `src/persistence/**`）；不读系统时间（`now` 由调用方传入）；`grep -REn "saveState|appendSpan|emit\(|Date[.]now|new EventEmitter" src/daemon/drill.js` 零命中（AC-01/11/12/19/28/50）；不出现 `等 |折叠`（折叠在渲染层，AC-04）；不出现 `overlayRoles|overlayEdges` 私建映射（AC-27）；不出现 `dsh` 宿主分支（AC-25）。
  - 投影规则照 D-2 逐条：局部 DAG 1 跳、卡片 8 档排序、指示器取 `createdAt` 最新会话、时间线按 `ts` 升序、摘要取 `round` 最大 `ts` 最新一条、证据按出现顺序去重编号、交接按最近时间戳倒序、子工作流递归 + 循环检测、角色状态栏三条硬口径（`hostIcons` 只随服务中节点会话 / `lastAction` 覆盖全部绑定节点 / 无绑定节点全空）。
- `src/adapter/host-open.js`（**新增**，WP-2）—— 契约 D10：`契约：src/adapter/host-open.js::openHost`。导出 `openHost({ root, hostId, instanceId, sessionId, env })` → `{ok:true, host, sessionId, sessionChoice:'most-recent-active'} | {ok:false, code, message}`。解析顺序：宿主配置 `open` 段 → 缺省复用 `src/adapter/dsh-launch.js` 的 `resolveDshLaunch`（只 import 不改）。约束：`grep -REn "hosts/" src/adapter/host-open.js` ≥1 条命中（AC-25）；spawn `detached` 不等待；500ms 去重窗口；不读 DSH 用户配置、不写 `~/.dsh`。
- `src/daemon/http/routes.js`（**改**，WP-2）—— D-10 授权段：只在现有返回表（实点 306~330 行的 `return [...]`，现有 GET /instances、POST /instances、GET /workflows 三条不动）**追加 5 条 GET 路由条目**：`GET /instances/:id/drill/:roleId`、`GET /instances/:id/nodes/:nodeId`、`GET /instances/:id/connections/:edgeId`、`GET /instances/:id/escalations`、`GET /instances/:id/subworkflow/:ref`。每条 handler 只组装输入并调 `drill.js` 对应导出；下钻路由在构建投影后调用既有 `createStreamHub().applyTestOverlay(graph, instanceId)`（**契约 A2 的第二调用点**；hub 实例经 `server.js` 注入或惰性动态 import，与既有 S-02 容缺接缝同机制）。约束：不改既有三条的处理器与参数解析；`grep -REn "dsh" src/daemon/http/routes.js` 零命中（AC-25）；全部只读。
- `src/daemon/http/server.js`（**改**，WP-2）—— D-10 授权段：只在 handler 白名单判定（实点 `claimedByHandler`，约 337~360 行）与分派段（实点 414~460 行）**追加分支**：`POST /instances/:id/escalations/:escalationId/continue`（唯一写路由，转发 `orchestrator.resolveEscalation({decision:'retry'})`，失败映射 `{ok:false, code, messageKey, message}`）与 `POST /hosts/open`（body `{instanceId, sessionId}`，调 `src/adapter/host-open.js::openHost`）。约束：`shapeSnapshot` / `buildGraphSnapshot` / 鉴权 / 静态资源 / `matchPattern` 不动；`grep -REn "state = 'running'|node\.state = " src/daemon/http/` 零命中（AC-22）。
- `src/daemon/http/labels.js`（**改**，WP-1）—— D-10 授权段：只在 `DESKTOP_LABEL_KEYS`（实点 31 行起）**追加** A-10 全表 `DRILL_*` 键（面包屑 / 角色栏 / 局部 DAG / 卡片 / 指示器 / 详情 / 连接线 / 升级面板 / 打开宿主 / 视图控件 / 降级提示 / `DRILL_ROLE_STATUS_TOKEN`）；既有键、`UI_LABEL_KEYS` 平铺逻辑（实点 132~148 行）不动。约束：`grep -REn "ROLE_INSTANCE_STATUS_LABEL" src/daemon/http/labels.js` ≥1 条命中（AC-03 现状事实锚点）。

### 2.2 只读基线（不改，不算负责文件 —— D-13 硬边界重申）

`src/core/**`（含 `orchestrator.js` / `escalation.js` / `state-machine.js`）、`src/registry/**`（`role-instances.js` 只 import：`buildRoleInstances` 的 9 字段投影 `roleId` / `roleInstanceId` / `status` / `statusReason` / `activeSessions[]` / `servingNodes[]` / `hostIcons[]` / `maxConcurrentSessions` / `lastAction{nodeId,round,maxRounds,state,stateSince}`，实点 `role-instances.js:123` 起是下钻状态栏的唯一事实来源）、`src/cli/**`、`src/persistence/**`（只 import）、`src/templates/**`、`src/daemon/graph.js`、`src/daemon/server.js`、`src/adapter/dsh-launch.js` / `host-config.js`（只 import）、`desktop/ui/graph/**` / `board/**` / `list/**` / `labels/**` / `connection.js` / `project.js` / `index.html`、`desktop/harness/{collect,graph-dump,board-dump,layout-dump,render-list}.mjs`、`test/wp13/**`（除 D-11 一处）、`test/fixtures/**`、`bin/orch.js`、`desktop/src-tauri/**`。本迭代没有任何「必须改核心」的理由；实现中发现必须改 → 先回来改需求（D-1）。

### 2.3 界面纯模块（WP-3 / WP-5 消费）

全部在 `desktop/ui/drill/`（WP-3 负责除 host-jump 外的 8 个文件，host-jump 归 WP-3 交付、其判定测试归 WP-5）；零 DOM / `fs` / `Date.now` / `window`；中文一律按键取值（词表常量**名**允许出现，被禁的是自算状态 / 自造中文 / 直接 import CLI 文案模块——AC-32 两条锚点 `decideStatus|statusReason`、`cli/labels` 零命中）。

- `desktop/ui/drill/role-bar.js`（**新增**，WP-3）—— 契约 D2：`契约：desktop/ui/drill/role-bar.js::renderRoleBar`。`renderRoleBar(roleBar, labels)` → `{ line, status, statusReason, activeSessions, servingNodes, servingFolded, hostIcons, lastAction }`。规则（A-1 三条硬口径）：`status` 取投影 token 经 `DRILL_ROLE_STATUS_TOKEN` 映中文（不重算）；服务节点取 `servingNodes`，>2 折叠 `服务 <首个> 等 N 个`；宿主只随服务中节点会话出现、空则 `宿主 —`；`lastAction === null` 时 `最近 —` 且其后不打印轮次与状态。约束：`grep -REn "statusReason|decideStatus" desktop/ui/drill/` 中被禁的是**重算语义**（AC-03/32：drill 不重算状态；`statusReason` 作为投影字段的透传键名按 AC-37 机检仍需出现在导出对象上——两锚点所指为 `decideStatus` 类自算函数与派生逻辑，实现时以 AC-03/AC-32 的语义判据为准，AC-37 的 `roleBar.statusReason === 'unknown-role'` 是投影字段断言）。
- `desktop/ui/drill/dag.js`（**新增**，WP-3）—— 契约 D3：`契约：desktop/ui/drill/dag.js::buildDag`。`buildDag(dag, labels, { boldRoleNodeIds })` → `{ nodes:[{nodeId, relation, type, status, statusColor, bold}], edges:[{from,to,direction,style,aggregateStatus}], lines[] }`。约束：1 跳只取直接前后驱（`grep -REn "BFS|bfs|visited|queue" desktop/ui/drill/dag.js` 零命中，AC-05）；联动只改视图状态（`grep -REn "fetch\(|request\(" desktop/ui/drill/dag.js` 零命中，AC-06）；边集为空不短路布局（AC-38）。
- `desktop/ui/drill/cards.js`（**新增**，WP-3）—— 契约 D4：`契约：desktop/ui/drill/cards.js::buildCards`。导出档位常量 `CARD_TIERS = ['escalated','failed','running','review','assigned','ready','blocked','done']` 与 `buildCards(cards, labels, { now })` → `cards[].lines[]`（三层一张）。规则：8 档排序（§1.9）、`assigned` 显示词折叠、未知状态落 blocked 标「状态未知」、耗时 = `now - stateSince`（`Ns/Nm/NmSs` 口径）、无会话整段「无会话」形态。约束：`grep -REn "Date[.]now" desktop/ui/drill/cards.js` 零命中（AC-35）；`grep -REn "sort\(.*Date|updatedAt" desktop/ui/drill/cards.js` 零命中（AC-08）；`grep -REn "已运行|轮次|依赖" desktop/ui/drill/` 零命中（AC-07，中文走文案键）；`grep -REn "if \(!cards\.length\) return|return null" desktop/ui/drill/cards.js` 零命中（AC-48/50）。
- `desktop/ui/drill/node-detail.js`（**新增**，WP-3）—— 契约 D5：`契约：desktop/ui/drill/node-detail.js::buildNodeDetail`。`buildNodeDetail(detail, labels)` → `{ head, sections[4] }`（会话状态时间线 / ACP 摘要 / 证据引用 / 交接包历史，空段保留标题给「无记录」）。约束：时间线不读系统时间（`Date[.]now` 零命中，AC-12）；证据不判过期（`expiredAt|ttl|TTL` 零命中，「已过期|过期」在证据段零命中，AC-14）；方向由定义边 `kind` 决定（`backflow` ≥1 命中、`state === 'rejected'|state === 'expired'` 零命中，AC-15）；不引用升级面板（`escalation` 零命中，AC-20）；摘要经 daemon 投影（`execution\.summary` 在 `desktop/ui/` 零命中，AC-13）。
- `desktop/ui/drill/handoff-panel.js`（**新增**，WP-3）—— 契约 D6：`契约：desktop/ui/drill/handoff-panel.js::buildHandoffPanel`。`buildHandoffPanel(panel, labels, { expandedId, anchorRowTop })` → `{ title, rows[], expandedId, timelineRows[] }`。规则：标题行聚合取最严重（`已拒绝 > 已过期 > 待投递 > 已投递 > 已接受 > 已完成 > 未开始`）；行数恒等于交接包个数；行时间 = 最近活动；时间线只列真实发生过的状态。约束：不自行取数（`fetch\(|request\(` 零命中，AC-43）；连接线点击目标只有交接包面板（`escalation` 零命中，AC-51）；不引虚拟滚动依赖（AC-42）。
- `desktop/ui/drill/escalation-panel.js`（**新增**，WP-3）—— 契约 D7：`契约：desktop/ui/drill/escalation-panel.js::buildEscalationPanel`。`buildEscalationPanel(list, labels)` → `{ title, countLine, items[], resolved[], actions:['继续','取消'], continueDisabled }`。约束：按实例过滤（`listAll|instanceIds` 零命中，AC-21）；空列表不短路渲染（`if \(!items\.length\) return` 零命中，AC-44）；不含重派 / 终止 / 允许 / 拒绝（`reassign|terminate|approve|deny` 零命中，AC-24）；面板标题只在两入口共用一处产出（AC-49）。
- `desktop/ui/drill/subflow.js`（**新增**，WP-3）—— 契约 D9：`契约：desktop/ui/drill/subflow.js::buildSubflow`。`buildSubflow({ ref, workflowDef, registry }, labels, { levels })` → `{ nodes[], edges[], breadcrumb[], legend, degraded }`。规则：复用既有布局模块（`graph/layout` ≥1 命中、不自建 `computeLayout`，AC-17）；层级栈承载（`stack\.push|stack\.pop` ≥1 命中或等价、`localStorage|sessionStorage` 零命中，AC-36）；循环检测基于已访问 ref 集合（`while \(true\)` 零命中，AC-18）；三种降级逐字。
- `desktop/ui/drill/host-jump.js`（**新增**，WP-3 交付 / WP-5 判定）—— 契约 D8：`契约：desktop/ui/drill/host-jump.js::buildHostJump`。`buildHostJump({ hostId, activeSessions, latestSessionId, jumpState }, labels, { clock })` → `{ button:{enabled,disabledReason,label}, toasts[], jumpCalls, sessionChoice }`。规则：仅 DSH + 活跃会话可用；多会话取最近活跃并在按钮旁标明；四种降级逐字（A-7）；连点去重（同一结果复用，不产生第二个进程信号）。约束：`grep -REn "setInterval|setTimeout\(.*open|useEffect.*open" desktop/ui/drill/host-jump.js` 零命中（AC-33）；`grep -REn "spawn\(|execFile\(" desktop/ui/drill/` 零命中（AC-46）；`grep -REn "DeepSeek Harness" desktop/ui/` 零命中（产品名走文案键，AC-26）。
- `desktop/ui/drill/index.js`（**新增**，WP-3）—— 契约 D15：`契约：desktop/ui/drill/index.js::createDrillView`。聚合入口：`createDrillView({ labels, data, interactions })` → 下钻三块（状态栏 / 局部 DAG / 卡片列表）+ 详情 / 面板的装配描述对象；被 `app.js` import。约束：不聚合 host-jump 的跳转执行（执行在 transport 层）；不出现 `NODE_ENV === 'test'` 测试专用分支（AC-29）。

### 2.4 harness（WP-3）

- `desktop/harness/drill-dump.mjs`（**新增**，WP-3）—— 契约 A1/D11：`契约：desktop/harness/drill-dump.mjs::main`。`export async function main(argv: string[]): Promise<number>`（0 成功 / 1 构造或读取失败 / 2 参数错误）；CLI 形态与输出形状见 §1.8；只 import `desktop/ui/drill/` 纯模块，自身可做文件 IO（读 `--payload`、写 `--out`）；零中文。

### 2.5 界面装配（WP-4）

- `desktop/ui/app.js`（**改**，WP-4 唯一负责人）—— D-10 授权段，只做四类新增：
  1. 下钻 / 子工作流 / 节点详情 / 升级面板的视图状态与导航方法，含**返回流程图的专用导航方法**（**契约 A3**：保留视图状态五组值，不复用 `backToList()` / `openGraph()` / `rebuildGraph()`，`createViewState(` 在本文件仍恰好 2 处 = 396/462）；
  2. `ensureStreams()` 图流打开条件由 `view === 'graph'`（实点 1477 行）扩为 `graph || drill`（**契约 A5 / D14**：沿用 `graphStreamId` 去重，不新增通道 / 帧类型）；
  3. 新增可选 transport 方法 `continueEscalation({instanceId, escalationId}) => Promise<{ok, code?, messageKey?, message?}>`（**契约 A4**；真实实现走 POST continue；未注入时按钮走真实 POST；AC-23②/AC-45 用 `createApp({ io: { ...realIo, continueEscalation: stub } })` 注入）；
  4. `__MAESTRO_CTL__`（实点 1517~1531 行）追加下钻相关动作；既有四视图行为、探针事件（137~146 行）不动。
  - 约束：不新增测试专用渲染分支；`grep -REn "createViewState\(" desktop/ui/app.js` 恰好 2 条（AC-02）；`grep -REn "backToList\(" desktop/ui/drill/` 零命中（AC-02④）；`grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/ui/` 零命中（AC-23）。

### 2.6 测试（WP-1~WP-6，逐文件归属见 §4；契约 D12）

`test/wp14/` 17 个新文件 = D-9 名单，全覆盖：`drill-entry` / `drill-dag` / `drill-cards` / `node-detail` / `drill-switch` / `subworkflow-drill` / `connection-panel` / `special-node-jump` / `escalation-continue` / `host-jump` / `drill-live` / `drill-readonly` / `acceptance-drill-e2e` / `labels-drill` / `drill-errors` / `regression-drill` + `drill-fixtures`（夹具构造自检 + 回环接口面最小契约断言；「不绑定 AC 判定」的主责归属不变，角色扩展见 §8.2 第 14 条）。执行方式照判定口径 5：先 `test -f` 再 `NODE_ENV=test node --test test/wp14/<file>.test.js`，断言 `# pass ≥ 1`、`# fail 0`，禁止全量 glob 代替。唯一授权修改的既有测试：`test/wp13/labels-desktop.test.js` 三处（D-11，实点 63 / 131 / 310 行）。

### 2.7 真实面校验器（WP-5）

- `probe/acc10b-jump-verify.mjs`（**新增**，WP-5）—— 契约 D13：`契约：probe/acc10b-jump-verify.mjs::main`。CLI：`node probe/acc10b-jump-verify.mjs <sessionId> --check process`（点击前后 `Get-Process -Name 'DeepSeek Harness'` 计数 0 → ≥1 / 恰 1）；`--check session-dir` 仅用于 D-14 表 C1 待验事实的首日一次性实测（只读，不作为 AC-25 判据）；不写死期望标识（标识由命令行参数传入）；凭据不入证据。

---

## 3. 数据模型

> **唯一事实来源**：下钻不落盘——下钻投影是 `state.json` + 工作流定义 + 事件链的只读内存派生（同 I1.10a 图投影的裁决口径），随时可重建。角色级结论的唯一事实来源是 `buildRoleInstances` 的 **9 字段投影**（实点 `src/registry/role-instances.js:123` 起；裁决 H 第 1 条）：`roleId` / `roleInstanceId` / `status` / `statusReason` / `activeSessions[]` / `servingNodes[]` / `hostIcons[]` / `maxConcurrentSessions` / `lastAction{nodeId,round,maxRounds,state,stateSince}`；其中 `hostIcons` 只来自服务中节点的会话（`:72-86`），因此「0 个活跃会话却有宿主」的形态**在投影里不存在**。下钻 `roleBar.status` 取**经 overlay 覆盖后的图投影角色节点 token**（经 `DRILL_ROLE_STATUS_TOKEN` 映中文），其余字段取**同一次** `buildRoleInstances` 投影（overlay 不改这些字段）。以下样例为形状说明，时间戳 / 实例号为示意值；用户可见逐字文案以附录 A-0~A-10 为准。

### 3.1 `state.json`（节选：含未知状态、升级挂起、0 会话三类异常态）

```json
{
  "schemaVersion": 2,
  "rev": 42,
  "state": "suspended",
  "workflowRef": "release-flow",
  "nodes": [
    { "nodeId": "T-001", "roleId": "dev", "title": "实现登录", "state": "running", "round": 1, "stateSince": "2026-11-15T09:40:00.000Z" },
    { "nodeId": "T-002", "roleId": "dev", "title": "联调", "state": "review", "round": 2, "stateSince": "2026-11-15T10:04:00.000Z" },
    { "nodeId": "T-003", "roleId": "dev", "title": "修复", "state": "escalated", "round": 2, "stateSince": "2026-11-15T10:10:00.000Z" },
    { "nodeId": "Z-001", "roleId": "dev", "title": "未知任务", "state": "mystery", "round": 1, "stateSince": "2026-11-15T09:00:00.000Z" },
    { "nodeId": "T-010", "roleId": "tester", "title": "回归", "state": "pending", "round": 1, "stateSince": "2026-11-15T09:05:00.000Z" }
  ],
  "sessions": [
    { "sessionId": "d6425e69-2b97-40a5-a209-2788ae8af24d", "nodeId": "T-001", "state": "thinking", "hostId": "dsh", "createdAt": "2026-11-15T09:40:10.000Z", "lastChangedAt": "2026-11-15T09:41:00.000Z", "currentTool": "write" },
    { "sessionId": "0af3...c91", "nodeId": "T-002", "state": "waiting_dependency", "hostId": "cursor", "createdAt": "2026-11-15T10:04:10.000Z", "lastChangedAt": "2026-11-15T10:05:00.000Z" }
  ],
  "handoffs": [
    { "handoffId": "HO-008", "fromNodeId": "T-001", "toNodeId": "T-003", "kind": "forward", "state": "rejected", "round": 1, "rejectReason": "下游拒绝", "updatedAt": "2026-11-15T08:58:02.000Z", "products": ["artifacts/code/calc.js"], "defects": [{ "evidence": "defects/d1.md" }], "artifactRefs": ["logs/T-003.log"] }
  ],
  "escalations": [
    { "escalationId": "ESC-001", "nodeId": "T-003", "round": 2, "state": "pending", "reasonDetail": "测试第 2 轮失败", "defects": [{ "summary": "断言失败", "evidence": "defects/d1.md" }] },
    { "escalationId": "ESC-002", "nodeId": "T-005", "round": 1, "state": "resolved" }
  ],
  "health": { "score": 62 }
}
```

- 异常态语义：`Z-001` 的 `mystery`（不在节点九态内）→ 卡片落「被阻塞」档、标「状态未知」，与看板 `column === 'blocked'` 同口径（裁决 D）；`T-003` `escalated` + 实例 `suspended` + 1 条 `pending` 升级 → 升级面板现场（AC-22/23/29，**必须由 `test.escalate` 真实接缝产出，禁止手写 `state:'suspended'` + `escalations`**，D-14 表 B2）；`T-010` 待执行 0 会话 → `服务 —` / `宿主 —` 但 `最近 T-010`（`lastAction` 覆盖全部绑定节点）。
- 夹具顺序（§3.3）：先空目录起核（`orch instance status` 返回不存在）再写盘，避免核心把异代 `created`/`running` 判为已中断。

### 3.2 角色实例投影（`buildRoleInstances` 9 字段，唯一事实来源）

```json
{
  "roleId": "dev",
  "roleInstanceId": "dev",
  "status": "unavailable",
  "statusReason": "escalated-session",
  "activeSessions": [{ "sessionId": "d6425e69-...", "state": "thinking", "hostId": "dsh" }],
  "servingNodes": ["T-001", "T-002"],
  "hostIcons": ["dsh", "cursor"],
  "maxConcurrentSessions": 3,
  "lastAction": { "nodeId": "T-002", "round": 2, "maxRounds": 3, "state": "review", "stateSince": "2026-11-15T10:04:00.000Z" }
}
```

- 界面不重算、不补字段、不引入投影之外的字段（如「绑定节点数」）；六态派生输入见需求 D-5，ACP 不可直接得出任何角色态（U-03）。

### 3.3 下钻一次性数据 `GET /instances/:id/drill/:roleId`（含异常态）

```json
{
  "breadcrumb": "实例 INST-001 / 角色 开发",
  "roleBar": {
    "statusToken": "unavailable", "statusReason": "unknown-role",
    "activeSessions": 1, "servingNodes": ["T-021"], "hostIcons": ["dsh"],
    "lastAction": { "nodeId": "T-021", "round": 1, "maxRounds": 1, "state": "running", "stateSince": "2026-11-15T10:04:00.000Z" }
  },
  "dag": {
    "nodes": [
      { "nodeId": "T-020", "relation": "self", "type": "role", "status": "pending" },
      { "nodeId": "T-032", "relation": "upstream", "type": "role", "status": "running", "roleId": "ghost-role" }
    ],
    "edges": [ { "id": "E-09", "from": "T-032", "to": "T-020", "direction": "forward" } ],
    "bounds": { "width": 240, "height": 80 }, "dangling": 0
  },
  "cards": [
    { "nodeId": "T-020", "tier": "ready", "rank": 6, "title": null, "round": "1/1", "session": null },
    { "nodeId": "Z-001", "tier": "blocked", "rank": 7, "unknownStatus": true, "boardColumn": "blocked" }
  ]
}
```

- 异常态：未知角色（`statusReason: 'unknown-role'`，状态位「不可用」其余四项照常，AC-37）；角色 ID 对不上（`ghost-role` 仍画出，AC-40）；0 会话（`hostIcons: []` 与 `activeSessions: 0` 同时出现，宿主段渲染 `宿主 —`）；0 绑定节点（`servingNodes` / `hostIcons` / `lastAction` 全空，`最近 —`）。
- daemon 下发「键 + 结构化数据」，不拼整句中文、不做折叠与占位（A-10 职责划分）；`roleBar.line` 的拼行发生在 `role-bar.js` 渲染层。

### 3.4 节点详情 `GET /instances/:id/nodes/:nodeId`（含全空态）

```json
{
  "node": { "nodeId": "T-003", "title": "实现登录", "state": "running", "round": 1, "maxRounds": 2, "nodeType": "role" },
  "timeline": [ { "ts": "2026-11-15T09:12:03.000Z", "sessionState": "running" }, { "ts": "2026-11-15T09:15:41.000Z", "sessionState": "review" } ],
  "summary": { "command": "npm test", "exitCode": 1, "keyOutputLines": 12, "logRef": "logs/T-003.log" },
  "evidence": [
    { "index": 1, "ref": "artifacts/code/calc.js", "type": "artifact", "status": "resolvable" },
    { "index": 2, "ref": "defects/d1.md", "type": "defect", "status": "missing" }
  ],
  "handoffs": [ { "handoffId": "HO-006", "direction": "forward", "round": 1, "state": "consumed", "lastActivity": "2026-11-15T09:20:11.000Z" } ]
}
```

- 全空态：`summary: null`、`timeline/evidence/handoffs: []` → 详情段渲染 `时间线 无记录` / `摘要 无记录` / `证据 无记录` / `交接 无记录`（保留段标题）。
- 证据状态只由「引用能否解析到可读文件」决定（相对实例 workspace 或 `cwd`），不做指纹、不做 TTL（U-07）。

### 3.5 连接线面板 `GET /instances/:id/connections/:edgeId`

```json
{
  "edge": { "id": "E-01", "fromRole": "dev", "toRole": "tester", "direction": "forward", "aggregateStatus": "rejected", "parallelCount": 2 },
  "handoffs": [
    { "handoffId": "HO-010", "round": 3, "state": "delivered", "lastActivity": "2026-11-15T09:12:41.000Z",
      "timeline": [ { "ts": "2026-11-15T09:12:40.000Z", "state": "built" }, { "ts": "2026-11-15T09:12:41.000Z", "state": "delivered" } ] },
    { "handoffId": "HO-011", "round": 3, "state": "delivered", "lastActivity": "2026-11-15T09:12:39.000Z", "timeline": [] },
    { "handoffId": "HO-009", "round": 2, "state": "expired", "lastActivity": "2026-11-15T09:05:10.000Z", "timeline": [] },
    { "handoffId": "HO-008", "round": 1, "state": "rejected", "rejectReason": "下游拒绝", "lastActivity": "2026-11-15T08:58:02.000Z", "timeline": [] }
  ]
}
```

- 行数恒等于交接包个数（并行不合并行）；行时间 = 最近一次活动（与时间线末条一致）；时间线只列真实发生过的状态；聚合结论按基线 395 优先级取最严重。
- overlay 复用（契约 A2）：面板标题行的聚合词取自**被同一 pulse overlay 覆盖过的图投影**；交接包行来自同一份实例快照（overlay 不改 `handoffs`）。

### 3.6 升级列表与「继续」响应（含错误形状）

```json
{ "items": [ { "escalationId": "ESC-001", "state": "pending", "nodeId": "T-003", "roleId": "dev", "round": 2, "reasonDetail": "测试第 2 轮失败", "defects": [{ "summary": "断言失败", "evidence": "defects/d1.md" }] } ] }
```

```json
{ "ok": true, "escalationId": "ESC-001" }
{ "ok": false, "code": "ESCALATION_NOT_PENDING", "messageKey": "DRILL_ESC_ALREADY", "message": "升级 ESC-001 已处理 · 状态 已处理" }
{ "ok": false, "code": "INSTANCE_NOT_SUSPENDED", "messageKey": "DRILL_ESC_NOT_SUSPENDED", "message": "实例 未挂起 · 无法继续" }
```

- `code` 只在 daemon 侧出现（映射字面量落 D-3）；`messageKey` 给界面分支；`message` 为既有错误原文（供 `继续失败 · <原文>` 透传，界面不翻译不自造）。

### 3.7 打开宿主 `POST /hosts/open`

```json
{ "ok": true, "host": "dsh", "sessionId": "d6425e69-2b97-40a5-a209-2788ae8af24d", "sessionChoice": "most-recent-active" }
{ "ok": false, "code": "HOST_UNSUPPORTED", "message": "宿主 mock 不支持跳转" }
{ "ok": false, "code": "DSH_SPAWN_FAILED", "message": "未找到 DeepSeek Harness" }
```

- 请求体 `{instanceId, sessionId}`，`sessionId` 由界面按「最近活跃」规则算出（BR-24）；标识的可核对口径 = 等于 `state.sessions[].sessionId`（裁决 I；「目录同名」为 D-14 表 C1 待验事实，不进任何 Then / 机检）。

---

## 4. 工作包拆分（WP-1 ~ WP-6，文件互不重叠）

> 切分依据四条硬规则（模板 §1.4）：① 文件清单互不重叠（35 个登记文件两两零交集，脚本核验见文末附录）；② 依赖成 DAG，每包可独立验收（包内契约测试不依赖下游文件；缺字段按契约兼容缺省）；③ 按能力切不按目录切（每 WP 对应一组可独立验证的 AC）；④ AC → WP 满覆盖（51/51，映射表在 §4 末尾）。
> 说明两点切分取舍：**「看板补齐」不单开 WP**——AC-16 的看板是 I1.10a 既有模块原样复用（D-13 冻结），本迭代的交付面只有 `app.js` 的入口与返回路径，归 WP-4；**升级闭环跨三包**——面板模块（WP-3）+ 唯一写路由（WP-2）+ 装配接缝（WP-4），按文件归属拆、AC 主责在映射表逐条标注。

### WP-1 中文文案键底座与授权断言（批次 1；依赖：无）

- **负责文件（3）**：`src/daemon/http/labels.js`（改）、`test/wp13/labels-desktop.test.js`（改，D-11 三处）、`test/wp14/labels-drill.test.js`（新）
- **依赖**：无（叶子；A-10 全表键名与逐字值是 **§6 契约先冻结点 ①**，冻住后 WP-2~WP-6 才可开发）
- **交付**：`DESKTOP_LABEL_KEYS` 追加 A-10 全部 `DRILL_*` 键与逐字值（含 `DRILL_ROLE_STATUS_TOKEN` 五 token 映射）；D-11 三处授权修改（63 行键清单追加、131 行值断言追加、310 行 `147` 断言改 `147 + N`）；`labels-drill.test.js` 断言新增键齐全、既有按键值逐字不变、`desktop/ui` + `desktop/harness` CJK 命中数为 0。
- **验收口径**：主责 **AC-30**（文案唯一来源 / 界面零中文 / 键集合断言部分；31 词双目录扫描与全量差集为静态 + 门禁面，协作 WP-6）；协作 AC-03/04/07/09/10/11/19/20/24/26/31/44/49（全部逐字文案的键值来源）。契约测试：`labels-drill.test.js` + `labels-desktop.test.js` 既有 147 键零改动断言。逐条按需求同号 Then 判定。
- **可否并行**：可 —— 纯常量表 + 一处授权断言追加，与所有包无共享文件。

### WP-2 daemon 下钻数据面：只读投影 + 7 端点 + 宿主适配器（批次 1；依赖：WP-1 键名契约冻结）

- **负责文件（5）**：`src/daemon/drill.js`（新）、`src/adapter/host-open.js`（新）、`src/daemon/http/routes.js`（改）、`src/daemon/http/server.js`（改）、`test/wp14/drill-fixtures.test.js`（新）
- **依赖**：WP-1（`DRILL_ESC_ALREADY` / `DRILL_ESC_NOT_SUSPENDED` 等 messageKey 字面——键名冻结即可并行开发，不依赖键值合入）
- **交付**：`buildDrill` / `buildNodeDetail` / `buildConnectionPanel` / `buildEscalationList` / `buildSubflowGraph` 五个只读投影导出（§2.2 全签名）；`routes.js` 追加 5 条 GET（含 **契约 A2 第二调用点**：投影构建后调用既有 `applyTestOverlay(graph, instanceId)`）；`server.js` 白名单与分派段追加 `POST /instances/:id/escalations/:escalationId/continue`（转发既有 `resolveEscalation({decision:'retry'})`，错误码 → messageKey 映射）与 `POST /hosts/open`（调 `openHost`）；`openHost` 配置驱动 + 500ms 去重 + 既有错误形状；`drill-fixtures.test.js` 夹具构造自检（先起核再写盘、pulse / `test.escalate` / `escalate resolve` 接缝真实产出、`schemaVersion: 2`），并**并入回环接口面的最小契约断言**（不新增文件、D-9 文件清单与映射归属不变）：① 5 条 GET 端点（§2.2 追加的 drill / nodes / connections / escalations / subworkflow）响应形状符合 §3.3~§3.6；② `test.escalate` + `escalate resolve` 产出真实现场后连发两次 `POST .../continue`，第二次 `code === 'ESCALATION_NOT_PENDING'`（AC-23① 端到端复核同口径，真实守卫非桩）；③ `POST /hosts/open` 对 mock 宿主返回 `HOST_UNSUPPORTED` 错误形状（§3.7）；④ 五个投影导出（状态栏 / 任务卡 / 节点详情 / 连接线 / 升级）对夹具快照的基本形状断言。主责 AC 判定的归属不变（见 §8.2 第 14 条）。
- **验收口径**：主责 **AC-22**（唯一写路由与真实裁决路径；终态等价断言的夹具面）、**AC-23**（错误码 → messageKey 映射 + 真守卫端到端：连发两次 continue 得 `ESCALATION_NOT_PENDING`）、**AC-25/26/46 的 daemon 面**（`/hosts/open` 路由、适配器错误形状、`hosts/` 解析 ≥1 命中）；协作 AC-01/04/13/19/27/37/43/47/50（投影字段面与 overlay 取数路径，界面判定主责 WP-3/WP-4）。契约测试：`drill-fixtures.test.js` **包内契约测试可独立跑通**——`NODE_ENV=test node --test test/wp14/drill-fixtures.test.js` 绿（含上述回环接口面最小契约断言），本包据此满足模板 §1.4 硬规则 2「每包可独立验收：包内自带契约测试」；既有全量零回归；AC 判定的下游装配 / 判定测试（WP-4/WP-5）仍在本包合入后的批次 3 执行，本包验收不依赖它们。
- **可否并行**：可 —— 与 WP-1 仅依赖冻结的键名字面；与 WP-3 仅共享 §6 冻结点 ② 的端点 JSON 形状契约。
- **门禁附加**：`grep -REn "saveState|appendSpan|emit\(|Date[.]now" src/daemon/drill.js` 零命中；`grep -REn "state = 'running'|node\.state = " src/daemon/http/` 零命中；`grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js` 零命中；purity `--dirs src/core,src/daemon` 31 词 `exit 0`。

### WP-3 下钻 UI 纯模块与 drill-dump 文本投影（批次 2；依赖：WP-1 + WP-2）

- **负责文件（15）**：`desktop/ui/drill/role-bar.js`（新）、`desktop/ui/drill/dag.js`（新）、`desktop/ui/drill/cards.js`（新）、`desktop/ui/drill/node-detail.js`（新）、`desktop/ui/drill/handoff-panel.js`（新）、`desktop/ui/drill/escalation-panel.js`（新）、`desktop/ui/drill/subflow.js`（新）、`desktop/ui/drill/host-jump.js`（新）、`desktop/ui/drill/index.js`（新）、`desktop/harness/drill-dump.mjs`（新）、`test/wp14/drill-dag.test.js`（新）、`test/wp14/drill-cards.test.js`（新）、`test/wp14/node-detail.test.js`（新）、`test/wp14/connection-panel.test.js`（新）、`test/wp14/subworkflow-drill.test.js`（新）
- **依赖**：WP-1（键值逐字）、WP-2（端点 JSON 形状与投影字段契约——§6 冻结点 ②，冻住后可并行开发）
- **交付**：9 个纯模块（§2.3 全签名与约束）+ `drill-dump.mjs`（契约 A1，`main(argv)` 导出）+ 5 个模块级契约测试：`drill-dag.test.js`（1 跳集合 / 加粗 / 实虚线 / 两次布局逐字节相等 / 联动 scrollTarget（**AC-06 断言的承载模块为 `desktop/ui/drill/index.js::createDrillView({labels, data, interactions})`，契约 D15（§2.3）**——`buildDag`（D3）返回对象无 `scrollTarget` 字段，避免机检对象悬空） / 单节点 0 线不塌陷 / 待执行缺省 / ghost-role 不丢节点）、`drill-cards.test.js`（A-3 六行逐字 / 8 档排序 `rank [1..8,8]` / 指示器 7 组 token / 特殊与异常五行 / 耗时 12m→13m / 缺值 `—` 与 TBD 置换）、`node-detail.test.js`（四段逐字与空态 / 时间线正序合并 / 摘要缺项 / 证据三态与复制 / 交接方向语义断言）、`connection-panel.test.js`（标题行逐字 / 4 包 4 行与时间戳倒序 / HO-010 时间线两行 / 60 条长列表 / 展开保持 / AC-51 三次落点）、`subworkflow-drill.test.js`（三层面包屑 / `computeLayout` 语义断言 / 三种降级 / 四层 1/2/3/4 与返回 3 次）。
- **验收口径**：主责 **AC-05/06/07/08/09/10/11/12/13/14/15/17/18/19/20/21/24/35/36/38/39/40/41/42/43/44/51**（映射表标注协作包）；`host-jump.js` 模块交付、其判定（AC-25/26/33/46）主责 WP-5。逐条按需求同号 Then 判定；模块级测试不依赖 `app.js`（纯模块面），满足「不依赖下游文件」。
- **可否并行**：可 —— 只消费冻结契约；与 WP-2 无共享文件。
- **门禁附加**：`grep -REn "Date[.]now|fs[.]|window" desktop/ui/drill/` 零命中；CJK 零命中；`grep -REn "NODE_ENV === 'test'" desktop/ui/drill/` 零命中；purity `--dirs desktop/ui,desktop/harness` 31 词 `exit 0`。

### WP-4 界面装配、导航与实时接缝（批次 3，单线；依赖：WP-1 + WP-2 + WP-3）

- **负责文件（8）**：`desktop/ui/app.js`（改，唯一负责人）、`test/wp14/drill-entry.test.js`（新）、`test/wp14/drill-switch.test.js`（新）、`test/wp14/drill-live.test.js`（新）、`test/wp14/drill-readonly.test.js`（新）、`test/wp14/drill-errors.test.js`（新）、`test/wp14/special-node-jump.test.js`（新）、`test/wp14/escalation-continue.test.js`（新）
- **依赖**：WP-1（文案键）+ WP-2（7 端点与 io 形状）+ WP-3（drill 模块与 `createDrillView`）
- **交付**：`app.js` 四类新增（§2.5：下钻视图状态与导航 / 契约 A3 返回方法 / 契约 A5 `ensureStreams().drill` / 契约 A4 `io.continueEscalation` / `__MAESTRO_CTL__` 动作）；7 个装配路径契约测试：`drill-entry.test.js`（AC-01 A-1 第 7 行逐字 + `view === 'drill'` + 注入时钟 ≤1000ms + state.json 哈希不变；AC-02 `viewState` 五组值逐字段相等 + 三条静态锚点；AC-03 五词子集 + 零「已关闭」；AC-04 第 4/2/3 行逐字）、`drill-switch.test.js`（AC-16 列名数组 + 返回 `view === 'drill'` + scrollTop 相等）、`drill-live.test.js`（AC-27 状态词 2s 到达 + 顺序不变；AC-32 四处一致；AC-47 两条都到；AC-48 只翻状态词其余段保留；AC-50 `graphStreamReopened === true` + 卡片清空 + DAG 保留）、`drill-readonly.test.js`（AC-28 三文件哈希 + `opCount===40` / `fetchCount===30` / `maxFetchesPerView===1` 内部断言）、`drill-errors.test.js`（AC-31 四类异常逐字；AC-37 未知角色逐字）、`special-node-jump.test.js`（AC-20 人工节点详情；AC-21/24/44 面板与动作边界；AC-49 角标入口 `view === 'escalation-panel'` 且 `view !== 'drill'`）、`escalation-continue.test.js`（AC-22 两份等价夹具各跑一条路径；AC-23 注入桩 + 真守卫复核；AC-45 失败透传）。
- **验收口径**：主责 **AC-01（view 面）/02/16/22（点击路径）/27/28/31/45/47/48/49/50**；协作 AC-03/04/20/21/23/24/32/37/44（模块面主责 WP-3）。逐条按需求同号 Then 判定。
- **可否并行**：否 —— `app.js` 是大文件唯一负责人（现状 1837 行），汇集三个上游包做装配，必须单线。
- **门禁附加**：`grep -REn "createViewState\(" desktop/ui/app.js` 恰好 2 条；`grep -REn "backToList\(" desktop/ui/drill/` 零命中；`grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/ui/` 零命中；既有四视图探针事件零改动。

### WP-5 一键跳转判定与真实面校验（批次 3；依赖：WP-1 + WP-2 + WP-3；可与 WP-4 并行）

- **负责文件（2）**：`test/wp14/host-jump.test.js`（新）、`probe/acc10b-jump-verify.mjs`（新）
- **依赖**：WP-1（A-7 文案键）+ WP-2（`/hosts/open` 契约与 `openHost` 错误形状）+ WP-3（`host-jump.js` 模块契约）；AC-25/AC-33 的真实面另依赖本机 DSH 0.2.2-rc.1（不可用判**阻塞**，不得用夹具顶替）。
- **交付**：`host-jump.test.js`（AC-25 期望值从夹具数据 `maxBy(lastChangedAt)` 派生 + `expected.id === state.sessions[].sessionId` 同源断言 + 次序翻转复检（运行期改写 `SESS-A.lastChangedAt` 三态留证）；AC-26 三降级逐字 + 进程计数不变；AC-33 `autoSpawn===0` / `jumpCalls===1` / `toasts===1`；AC-46 `跳转失败 · ` 前缀 + `retryable === true` + 状态哈希不变）；`probe/acc10b-jump-verify.mjs`（真实面只读校验器，`--check process` / `--check session-dir` 仅 C1 实测）。
- **验收口径**：主责 **AC-25/26/33/46**；协作 WP-2（daemon 面）、WP-3（模块）、WP-4（按钮装配）。逐条按需求同号 Then 判定。
- **可否并行**：可 —— 与 WP-4 无共享文件（模块面判定不依赖 `app.js` 装配断言）。
- **门禁附加**：`grep -REn "DeepSeek Harness" desktop/ui/` 零命中；`grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/harness/` 零命中（AC-23④ 同口径）；probe 只读进程表、不写死期望标识。

### WP-6 回归与端到端架构守门（批次 4，单线；依赖：WP-1 ~ WP-5 全部合入）

- **负责文件（2）**：`test/wp14/acceptance-drill-e2e.test.js`（新）、`test/wp14/regression-drill.test.js`（新）
- **依赖**：WP-1 + WP-2 + WP-3 + WP-4 + WP-5 全部合入（DAG 汇合点）
- **交付**：`acceptance-drill-e2e.test.js`（AC-29 九步探针序列 `graph-shown → drill-shown → detail-shown → evidence-shown → escalation-shown → continued → graph-returned → subflow-shown → graph-restored`，七条 Then 逐条 + 七条 Then 的机检断言 + 无终端/CLI 事件 + 内部断言 `t_continued - t_confirm ≤ 2000`）；`regression-drill.test.js`（AC-34：三条主链逐字 / 两种格式逐字 / `USAGE_LINES === 25` / 命令表与子命令表不变；AC-30 的 31 词双目录扫描与零依赖断言；全量四步判定口径的测试侧支撑）。
- **验收口径**：主责 **AC-29/34**；协作 AC-30（静态扫描部分由 WP-1 交付、全量差集面在此收口）、全部 AC（回归兜底）。
- **可否并行**：否 —— DAG 汇合点，末批单线合入并跑全量门禁。
- **门禁附加**：四件套全量复跑（全量测试 ≥1425 + 差集 0、purity 双目录、零依赖、主链冒烟）；AC-29 架构检查 `grep -REn "NODE_ENV === 'test'" desktop/ui/drill/` 零命中。

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注（机检文件归属） |
|---|---|---|---|
| AC-01 | WP-3 | WP-4 | roleBar/dag/cards 逐字（WP-3 投影）；`view === 'drill'` 装配断言在 `drill-entry.test.js`（WP-4） |
| AC-02 | WP-4 | WP-3 | 契约 A3 返回方法；`drill-entry.test.js` |
| AC-03 | WP-3 | WP-1、WP-4 | 五词子集 + 零「已关闭」；`drill-entry.test.js` |
| AC-04 | WP-3 | WP-1、WP-4 | A-1 第 4/2/3 行逐字；`drill-entry.test.js` |
| AC-05 | WP-3 | WP-2 | 1 跳 / 加粗 / 实虚线；`drill-dag.test.js`（WP-3） |
| AC-06 | WP-3 | WP-4 | 联动滚动高亮；`drill-dag.test.js` |
| AC-07 | WP-3 | WP-1 | A-3 六行逐字；`drill-cards.test.js` |
| AC-08 | WP-3 | WP-2 | 8 档排序 `rank [1..8,8]`；`drill-cards.test.js` |
| AC-09 | WP-3 | WP-1、WP-2 | 指示器 7 组 token；`drill-cards.test.js` |
| AC-10 | WP-3 | WP-2 | 特殊 / 未知五行逐字；`drill-cards.test.js` |
| AC-11 | WP-3 | WP-2 | 四段齐全与空态；`node-detail.test.js` |
| AC-12 | WP-3 | WP-2 | 时间线正序合并；`node-detail.test.js` |
| AC-13 | WP-3 | WP-2 | 摘要缺项占位（daemon 选定唯一摘要）；`node-detail.test.js` |
| AC-14 | WP-3 | WP-2 | 证据两态 + 复制 + 不判过期；`node-detail.test.js` |
| AC-15 | WP-3 | WP-2 | 交接历史双向倒序 + 方向语义断言；`node-detail.test.js` |
| AC-16 | WP-4 | WP-3 | 看板复用 + 原路返回；`drill-switch.test.js`（WP-4） |
| AC-17 | WP-3 | WP-2 | 子工作流逐层下钻 + `computeLayout` 语义断言；`subworkflow-drill.test.js` |
| AC-18 | WP-3 | WP-2 | 三种降级；`subworkflow-drill.test.js` |
| AC-19 | WP-3 | WP-2 | 连接线面板 4 行 + 时间线；`connection-panel.test.js` |
| AC-20 | WP-3 | WP-4 | 人工节点详情逐字；`special-node-jump.test.js`（WP-4） |
| AC-21 | WP-3 | WP-4 | 升级面板两实例作用域；`special-node-jump.test.js` |
| AC-22 | WP-2 | WP-4、WP-6 | 唯一写路由 + 真实裁决；`escalation-continue.test.js`（WP-4） |
| AC-23 | WP-2 | WP-4 | 错误码映射 + 真守卫复核；`escalation-continue.test.js` |
| AC-24 | WP-3 | WP-4 | actions 恰为 ['继续','取消']；`special-node-jump.test.js` + `escalation-continue.test.js` |
| AC-25 | WP-5 | WP-2、WP-3、WP-4 | 真实面 C 类；`host-jump.test.js`（WP-5）+ probe |
| AC-26 | WP-5 | WP-2、WP-3 | 三降级逐字；`host-jump.test.js` |
| AC-27 | WP-4 | WP-2 | overlay 复用（契约 A2）+ 2s 到达；`drill-live.test.js`（WP-4） |
| AC-28 | WP-4 | WP-2 | 只读红线 + 内部口径 40/30；`drill-readonly.test.js` |
| AC-29 | WP-6 | WP-2~WP-5 | 规划验收句端到端九步；`acceptance-drill-e2e.test.js` |
| AC-30 | WP-1 | WP-6 | 键表 / 零中文 / 31 词静态面；`labels-drill.test.js` + `regression-drill.test.js` |
| AC-31 | WP-4 | WP-2 | 四类运行期异常；`drill-errors.test.js` |
| AC-32 | WP-3 | WP-4 | 四处一致同一投影；`drill-live.test.js` |
| AC-33 | WP-5 | WP-2、WP-4 | 连点单进程；`host-jump.test.js` + probe |
| AC-34 | WP-6 | WP-1 | 回归门禁三段式；`regression-drill.test.js` |
| AC-35 | WP-3 | WP-2 | 耗时不重置；`drill-cards.test.js` |
| AC-36 | WP-3 | WP-2 | 四层 1/2/3/4 + 返回 3 次；`subworkflow-drill.test.js` |
| AC-37 | WP-3 | WP-2 | 未知角色投影字段逐字；`drill-errors.test.js` |
| AC-38 | WP-3 | — | 单节点 0 线不塌陷；`drill-dag.test.js` |
| AC-39 | WP-3 | — | 待执行缺省 + 来源置换断言；`drill-dag.test.js` |
| AC-40 | WP-3 | — | ghost-role 不丢节点；`drill-dag.test.js` |
| AC-41 | WP-3 | — | 缺值 `—` + TBD 置换；`drill-cards.test.js` |
| AC-42 | WP-3 | — | 60 条长列表；`connection-panel.test.js` |
| AC-43 | WP-3 | WP-2 | 展开保持 + 锚点 ≤1px（内部断言）；`connection-panel.test.js` |
| AC-44 | WP-3 | WP-4 | 0 待处理空态；`special-node-jump.test.js` |
| AC-45 | WP-4 | WP-2 | 失败透传可重试；`escalation-continue.test.js` |
| AC-46 | WP-5 | WP-2 | 唤起失败可重试；`host-jump.test.js` |
| AC-47 | WP-4 | WP-2 | 并发两条都到；`drill-live.test.js` |
| AC-48 | WP-4 | WP-2 | 状态词翻转其余段保留；`drill-live.test.js` |
| AC-49 | WP-4 | WP-3 | 角标入口同一面板；`special-node-jump.test.js` |
| AC-50 | WP-4 | WP-2 | 契约 A5 重取 + DAG 保留；`drill-live.test.js` |
| AC-51 | WP-3 | WP-4 | 连线侧改道判定；`connection-panel.test.js` |

> 覆盖核对：AC-01~AC-51 连续编号、一行一条、无缺号、无重号、无合并；每行恰好一个主责 WP；合计 **51/51**。主责分布：WP-1（AC-30）、WP-2（AC-22/23）、WP-3（32 条：01/03~15/17~21/24/32/35~44/51）、WP-4（10 条：02/16/27/28/31/45/47/48/49/50）、WP-5（4 条：25/26/33/46）、WP-6（2 条：29/34）。机检文件 17 个全部登记归属：WP-1×1、WP-2×1（drill-fixtures，不绑定 AC）、WP-3×5、WP-4×7、WP-5×1、WP-6×2。

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/daemon/drill.js` | 下钻只读投影 5 导出（契约 D1） | WP-2 |
| `src/adapter/host-open.js` | 宿主打开适配器（契约 D10） | WP-2 |
| `src/daemon/http/routes.js`（改） | 追加 5 条 GET + 契约 A2 第二调用点 | WP-2 |
| `src/daemon/http/server.js`（改） | 白名单 + 2 条 POST 分派 + 错误码映射 | WP-2 |
| `src/daemon/http/labels.js`（改） | `DESKTOP_LABEL_KEYS` 追加 `DRILL_*` 全表 | WP-1 |
| `desktop/ui/app.js`（改） | 下钻视图 / 契约 A3/A4/A5 / CTL 动作 | WP-4 |
| `desktop/ui/drill/role-bar.js` | 状态栏渲染（契约 D2） | WP-3 |
| `desktop/ui/drill/dag.js` | 局部 DAG 渲染（契约 D3） | WP-3 |
| `desktop/ui/drill/cards.js` | 卡片三层 + 8 档档位（契约 D4） | WP-3 |
| `desktop/ui/drill/node-detail.js` | 详情四段（契约 D5） | WP-3 |
| `desktop/ui/drill/handoff-panel.js` | 连接线面板（契约 D6） | WP-3 |
| `desktop/ui/drill/escalation-panel.js` | 升级面板（契约 D7） | WP-3 |
| `desktop/ui/drill/subflow.js` | 子工作流下钻（契约 D9） | WP-3 |
| `desktop/ui/drill/host-jump.js` | 一键跳转模块（契约 D8） | WP-3 |
| `desktop/ui/drill/index.js` | 下钻装配入口（契约 D15） | WP-3 |
| `desktop/harness/drill-dump.mjs` | 文本 / 结构导出探针（契约 A1/D11） | WP-3 |
| `test/wp13/labels-desktop.test.js`（改） | D-11 三处授权断言追加 | WP-1 |
| `test/wp14/labels-drill.test.js` | 新增键 + 零中文断言（AC-30） | WP-1 |
| `test/wp14/drill-fixtures.test.js` | 夹具构造自检 + 回环接口面最小契约断言（不绑定 AC 判定主责） | WP-2 |
| `test/wp14/drill-dag.test.js` | AC-05/06/38/39/40 | WP-3 |
| `test/wp14/drill-cards.test.js` | AC-07/08/09/10/35/41 | WP-3 |
| `test/wp14/node-detail.test.js` | AC-11/12/13/14/15 | WP-3 |
| `test/wp14/connection-panel.test.js` | AC-19/42/43/51 | WP-3 |
| `test/wp14/subworkflow-drill.test.js` | AC-17/18/36 | WP-3 |
| `test/wp14/drill-entry.test.js` | AC-01/02/03/04 | WP-4 |
| `test/wp14/drill-switch.test.js` | AC-16 | WP-4 |
| `test/wp14/drill-live.test.js` | AC-27/32/47/48/50 | WP-4 |
| `test/wp14/drill-readonly.test.js` | AC-28 | WP-4 |
| `test/wp14/drill-errors.test.js` | AC-31/37 | WP-4 |
| `test/wp14/special-node-jump.test.js` | AC-20/21/24/44/49 | WP-4 |
| `test/wp14/escalation-continue.test.js` | AC-22/23/45 | WP-4 |
| `test/wp14/host-jump.test.js` | AC-25/26/33/46 | WP-5 |
| `test/wp14/acceptance-drill-e2e.test.js` | AC-29 | WP-6 |
| `test/wp14/regression-drill.test.js` | AC-34（+ AC-30 静态面） | WP-6 |
| `probe/acc10b-jump-verify.mjs` | 真实面只读校验器（契约 D13） | WP-5 |

合计 **35 个登记文件**（新增 30 + 修改 5）；夹具现场一律 `%TEMP%/maestro-i10b-*`（绝不进仓库）、`NODE_ENV=test`、`--host mock`（`test/fixtures/mock-acp-agent.js`）；flake 帧落 `docs/iterations/iteration-10b/flake-frames/`（收口产物，不属 WP 负责文件）。

---

## 6. 依赖与并行策略

```
契约先冻结（§6 冻结点 ①②③）
        │
批次 1 ──► WP-1 文案键底座 ─────┐
批次 1 ──► WP-2 daemon 数据面 ──┤（两者并行；WP-2 只依赖 WP-1 的键名字面冻结）
        │                       │
批次 2 ──► WP-3 UI 纯模块 + drill-dump（依赖 WP-1 键值 + WP-2 端点形状契约）
        │                       │
批次 3 ──► WP-4 装配与导航（单线，依赖 WP-1/2/3）
批次 3 ──► WP-5 跳转判定与真实面（依赖 WP-1/2/3；与 WP-4 并行，无共享文件）
        │                       │
批次 4 ──► WP-6 回归与 e2e 守门（单线，依赖 WP-1~WP-5 全部合入）
```

- **DAG 边**：WP-2→WP-1、WP-3→{WP-1, WP-2}、WP-4→{WP-1, WP-2, WP-3}、WP-5→{WP-1, WP-2, WP-3}、WP-6→{WP-1, WP-2, WP-3, WP-4, WP-5}；无环，每边均为「上游交付物被下游 import / 调用」的静态依赖。
- **契约先冻结点**（三处，冻住后各包并行，联调不互相改接口）：
  1. **文案键冻结（WP-1 产出）**：A-10 全表 `DRILL_*` 键名 + 逐字值（含 `DRILL_ROLE_STATUS_TOKEN`）；`DRILL_ESC_ALREADY` / `DRILL_ESC_NOT_SUSPENDED` 两个 messageKey 字面。
  2. **下钻投影取数路径与端点形状冻结（WP-2 产出）**：D-3 的 7 端点（5 GET + 2 POST）请求 / 响应 JSON 形状（§3.3~§3.7）、`buildDrill` 等五导出签名、**契约 A2**（下钻路由调用既有 `applyTestOverlay` 的第二调用点位置与参数）、**契约 A4**（`io.continueEscalation` 注入形状）、**契约 A5**（`ensureStreams().drill` 条件扩展）、**契约 A1**（`drill-dump.mjs` CLI 形态与输出形状）、**契约 A3**（返回导航方法行为：保留五组视图状态值）。此冻结点对应任务要求「先冻结下钻投影取数路径与 D-14 契约签名，再并行 UI / 测试」。其中 A4/A5 冻结的是 D-14 表 A4/A5 的契约**描述**（供 WP-3/WP-5 并行开发引用）；`app.js` 侧产物归 WP-4，非 WP-2 交付物。
  3. **drill 模块导出签名冻结（WP-3 产出，D-14 表 D2~D9/D15）**：九个模块的导出函数名与返回对象字段（§2.3），WP-4/WP-5/WP-6 据此装配与断言。
- **整合检查点（3 个）**：
  - **检查点 1（批次 1 末）**：`labels-desktop.test.js` 全绿（147 + N 键）；`drill-fixtures.test.js` 全绿且**含 7 端点行为验证**（5 条 GET 响应形状断言各 ≥1、连发两次 continue 第二次 `ESCALATION_NOT_PENDING`、`/hosts/open` 对 mock 宿主返回 `HOST_UNSUPPORTED` 错误形状、五个投影导出基本形状断言各 ≥1）；既有全量零回归（≥1425、差集 0）；purity `src/core,src/daemon` `exit 0`；`GET /ui/labels` 下发全量新键。
  - **检查点 2（批次 2 末）**：WP-3 的 5 个契约测试全绿（纯模块面）；`drill-dump.mjs` 对 §3.3~§3.7 样例夹具的导出与 A-1/A-3/A-4/A-5 逐字行比对通过；purity `desktop/ui,desktop/harness` `exit 0`、CJK 零命中。
  - **检查点 3（批次 3 末）**：WP-4 七个装配测试 + WP-5 跳转测试全绿；AC-25/AC-33 真实面在本机 DSH 上执行或明确登记 `阻塞`；三条主链冒烟逐字不变。
  - **检查点 4（批次 4 末，收口）**：全量四步判定（取数 → 差集 → 逐文件 → 新红复核）；51 条 AC 架构检查全表复核；D-14 表 A 落地复核、表 C1 首日实测留痕。

---

## 7. 风险与降级

| # | 风险 | 影响 | 处置（点名文件 / 函数） |
|---|---|---|---|
| 1 | **AC-50 的 `state-b.json` 替换与核心运行期写盘竞态未证明**（round5 建议 F5-01，progress.md 移交） | AC-50 的夹具在核心存活时替换 `state.json`，若核心按 `rev` 回写会破坏「绑定归零」现场，机检假绿或假红 | **S2 开工先做最小实验**（WP-2 的 `drill-fixtures.test.js` 第一步）：核心存活时用 `state-b.json` 替换 `%TEMP%` 根的 `state.json`，观察核心是否回写、`rev` 冲突表现；竞态成立则回改构造方式（如先 `orch core stop` 再替换、重进），**AC 判定强度不变**；结果与留痕登记 `drill-fixtures.test.js` 与验收报告 |
| 2 | **AC-42/43 滚动指标仅模型坐标承载**（round5 建议 F5-02） | `scrollElapsed` / `anchorRowTop` 是模拟值，不冒充用户可见结论；若实现期引入真实 DOM 依赖会违反零依赖与裁决 B | 按 D-9 承载实现（`handoff-panel.js` 模型坐标 + 注入时钟），验收报告保留「长列表滚动手感」人工核验项；`renderedRows < 60` 仅内部指标（D-8）；不引入虚拟滚动库 |
| 3 | **`sessionId` ↔ DSH 落盘目录名待验**（round5 建议 F5-03 = D-14 表 C1，裁决 I） | 若「目录同名」不成立，`在 DSH 中按标识定位` 的提示文案体验落空 | **S2 开工首日**由 WP-5 用 `probe/acc10b-jump-verify.mjs --check session-dir` 在有活跃会话的实例上取 3 条只读比对；一致补注 U-15 / D-4，不一致删该说法；**两种情况都不改任何 AC 判定强度**（AC-25 只判「标识 == `state.sessions[].sessionId`」） |
| 4 | **AC-25/AC-33 依赖真实 DSH**（C 类真实面） | DSH 不可用时无法取证；用夹具顶替属伪通过 | DSH 不可用判 **`阻塞`**（需求 §3.3 真实面判定），不得改写为夹具通过；三条活跃会话不足时在同一工作区用真实 DSH 补齐；窗口前置 / 剪贴板登记人工核验项不计自动通过数；由 WP-5 承担，检查点 3 明确登记判定 |
| 5 | **全量测试平台 flake**（裁决 G 三段式；progress.md 移交回归纪律） | 失败条数在 21/15/14 摆动、成员翻转；误判新红或误放真红 | 只按三段式判定：`tests ≥ 1425` + 允许集合（16 条登记项 ∪ 留帧 flake）差集 = 0；集合外新红先单文件独占复跑（`node --test --test-concurrency=1 test/wp13/<file>.test.js`），通过记 flake 留帧到 `docs/iterations/iteration-10b/flake-frames/`，仍失败判红；**禁 `--no-flake-confirm` 一类开关**；`http-channel` / `readonly-local` 两稳定红按登记项豁免、不得要求 `# fail 0`（AC-34 / WP-6 执行） |
| 6 | **契约锚点误判**：未落地路径的零命中 / `test -f` 在 S2 前返回 `exit 2` | S3 复核时把「未落地」误记为失败（假红），或反过来把 `exit 2` 当通过 | 按 D-14 表 D 口径：未落地一律记「未落地、不计通过」**不判红**；S2 落地后按原期望值逐条复核（表 A 5 条 + 表 D 15 条）；混合路径整体 `exit 2` 同口径；由主控在检查点 4 复核 |
| 7 | **`app.js` 大文件跨包改动风险**（现状 1837 行，WP-4 唯一负责人） | WP-3/WP-5 若顺手改 `app.js` 会破坏文件唯一归属与 I1.10a 四视图行为 | 硬规则 1：`app.js` 只属 WP-4；WP-3/WP-5 只交付模块与测试；每 WP 回收时 `git show --stat` 核对授权文件清单；既有四视图探针事件（`app.js:137-146`）与 `createViewState` 恰好 2 处作为静态哨兵 |
| 8 | **`server.js` / `routes.js` 授权行段外溢** | 分派段追加分支时误改 `matchPattern` / 鉴权 / `buildGraphSnapshot`，破坏 I1.10a 回归 | D-10 授权段只追加：`routes.js` 只在实点 306~330 行返回表追加 5 条；`server.js` 只在 `claimedByHandler`（337~360）与分派段（414~460）追加；既有三条路由、`/ui/labels`、pulse、window-probe 分支零改动；AC-22/AC-27 架构检查兜底 |
| 9 | **「运行中 + 待处理升级」不可由产品路径产生**（裁决 H 第 6 条；实点 `src/core/orchestrator.js:5051-5052` 守卫） | AC-23② 若手写该状态组合会虚构产品不可达现场 | Given 按接缝真实产出写：①现场用 `test.escalate`（`src/daemon/server.js:345-352`）+ `escalate resolve` 预置；②现场改用契约 A4 注入桩（形状与 daemon 真实返回一致）；真实守卫另由端到端复核覆盖（连发两次 continue） |
| 10 | **D-11 断言追加引发键计数漂移** | WP-3 实现期若临时加键，`labels-desktop.test.js` 的 `147 + N` 断言与 A-10 表不一致 | 键集合在冻结点 ① 一次定死；实现期发现缺键 → 回改需求（A-10），不在实现里悄悄补键；`drill-fixtures.test.js` 与 `labels-drill.test.js` 双向核对键集合 |
| 11 | **夹具顺序颠倒导致核心判「已中断」** | 快照夹具先写盘后起核，核心把异代 `created`/`running` 判为已中断，AC 现场全废 | 所有 WP 的夹具按 §3.3 铁序：空目录先起核（`orch instance status` 返回不存在）再写 `state.json` / `events.jsonl` / 工作流定义；`drill-fixtures.test.js` 把该顺序做成自检断言 |

---

## 8. 与需求 v5 的对齐声明

本文档不新增需求条目、不删改任何 AC / BR / NF、不放宽任何 Then；所有逐字文案、状态名、错误码、AC 编号、判定强度均以 `docs/iterations/iteration-10b/requirement.md` **v5**（51 AC / 43 BR / 7 NF）为准；两者冲突时**以需求为准**并在实现结论中指出。裁决 A~I 全部落盘 `decisions.md`，本拆分逐条执行、不再二次裁决。

### 8.1 主控裁决 A~I 逐条落地

| 裁决 | 落点 |
|---|---|
| A（一键跳转三段口径，规划不可达偏离） | §0 Out of scope / §1.5 / WP-5；AC-25/AC-29 的偏离说明原样保留，不声称「自动选中该会话」 |
| B（无窗口级自动判据） | §0 Out of scope；全部界面判据走纯模块面 + `createApp` + 回环接口面；窗口内动作人工核验 |
| C（升级面板只给「继续」） | §1.6；WP-2 唯一写路由转发 `resolveEscalation({decision:'retry'})`；AC-24 断言 actions 恰为 ['继续','取消'] |
| D（未知状态档位统一） | §1.9 / §3.1（`Z-001` 落 blocked 档 + 看板同口径） |
| E（只补不减的修订口径） | 本拆分沿用：不删 AC、不合并、不放宽 Then |
| G（回归基线三段式） | §0 退出标准 2 / §7 风险 5；不以单次失败条数作判据 |
| H（判据落在真实投影与接缝） | §3（9 字段唯一事实来源 +「0 会话却有宿主」不存在）、§1.2（overlay 共用）、§1.8（harness 只用真实存在的）、§7 风险 9 |
| I（会话标识核对方式） | §1.5 / §3.7 / §7 风险 3；判据只到「标识 == `state.sessions[].sessionId`」，目录同名是 C1 待验事实 |
| F（架构检查可执行性） | §2 各文件约束逐条给期望值（零命中 / ≥1 / 恰 N 且计数先实点） |

### 8.2 需求与代码现状的冲突及裁决出处

| # | 冲突 | 现状实点 | 需求落点与裁决出处 |
|---|---|---|---|
| 1 | 规划 871/874 行「跳转到 DSH 对应会话」在 DSH 0.2.2-rc.1 上不可逐字达成（无会话级深链） | `decisions.md` 裁决 A 实测表 | 需求 §2.13 / AC-25 / AC-29 按三段口径交付并显式标注偏离（裁决 A + I） |
| 2 | 基线 477 行「点击红色/橙色连接线或 escalated 角标 → 升级面板」与规划 869 行「连接线点击展开交接包列表」落点冲突 | 需求 §2.10 取舍段 | 连线侧改道进交接包面板、角标侧进升级面板（BR-43 / AC-51）；本拆分 WP-3 `handoff-panel.js` 零 `escalation` 引用、WP-4 `special-node-jump.test.js` 断言 `view !== 'drill'` |
| 3 | 基线 450 行「服务节点 = 当前绑定节点 ID 列表」与 A-1 七行逐字矛盾 | `src/registry/role-instances.js`（`servingNodes` 只含 running/review） | 取 `servingNodes` 服务中口径（F4-08）：「全部绑定节点」由 `lastAction` 承载（A-1 说明段） |
| 4 | `ensureStreams()` 现状只对 `view === 'graph'` 打开图流 | `desktop/ui/app.js:1477` 实点 | 新增 `drill` 分支为**调用点**而非新接口（契约 A5 / 表 D D14；F4-04） |
| 5 | `backToList()` 会清空 `viewState`，不能用作返回路径 | `desktop/ui/app.js:410-417` 实点 | 新增专用返回导航方法（契约 A3；F3-09） |
| 6 | pulse 接缝只能翻角色状态词，不能清空绑定 | `src/daemon/http/stream.js:255-275,586` 实点 | AC-48（状态词翻转）与 AC-50（绑定归零改用第二份快照 + 重连重取）分半覆盖（F3-02 / 裁决 H 第 6 条） |
| 7 | 「运行中 + 待处理升级」不可由产品路径产生 | `src/core/orchestrator.js:5051-5052` 守卫实点 | AC-23② 改用契约 A4 注入桩判定（F3-04 / 裁决 H 第 6 条） |
| 8 | `ESCALATION_NOT_PENDING` / `INSTANCE_NOT_SUSPENDED` 现状只在核心与 CLI 侧，`src/daemon/` 0 处 | `src/core/escalation.js:89`、`orchestrator.js:5049/5052` 实点 | daemon 新增「码 → messageKey」映射字面量（D-3 / F2-16）；码不越过界面层 |
| 9 | Windows 无 `lsof`，`http-channel` / `readonly-local` 为稳定红 | 需求 §3.3 回归基线 | 按登记项豁免、不得要求 `# fail 0`（裁决 G / F2-01） |
| 10 | 全量失败条数三次观测 21/15/14 且成员翻转 | 需求 §3.3 | 三段式判定、flake 留帧、禁跳过开关（裁决 G / F2-02） |
| 11 | 本机无 Rust / MSVC，Tauri 壳不可构建 | `cargo --version` 为 command not found | 不设窗口级自动判据（裁决 B / U-04） |
| 12 | `labels-desktop.test.js` 的键总数断言现状为 `147` | 实点 310 行（`EXPECTED_DESKTOP_KEYS` 63 行 / `EXPECTED_DESKTOP_VALUES` 131 行） | D-11 授权改「147 + 本迭代新增键数」，既有 147 键一个不改 |
| 13 | `statusReason` 字面在 `desktop/ui/drill/` 的锚点张力：AC-03/AC-32 架构检查要求 `grep -REn "statusReason\|decideStatus" desktop/ui/drill/` 零命中，而 AC-37 断言 `roleBar.statusReason === 'unknown-role'`（投影字段透传） | `src/registry/role-instances.js:123` 起（`statusReason` 是 `buildRoleInstances` 9 字段投影的既有字段） | 两锚点所指为**重算语义**而非字面常量（裁决 F 第 2 条：锚点指向被禁语义），与需求 AC-32 的同口径说明（`requirement.md:786`「锚点指向被禁的语义而不是常量名」）一致；`statusReason` 属裁决 H 第 1 条 9 字段口径的投影透传键，实现时以对象展开等不含字面量的写法承载，或以 AC-03/AC-32 的语义判据复核（§2.3 `role-bar.js` 约束段同此解释） |
| 14 | D-9 对 `drill-fixtures.test.js` 的「不绑定 AC 判定」措辞与模板 §1.4 硬规则 2「每包可独立验收：包内自带契约测试」的张力（split-review SR-01） | `split-review.md` §5 疑点 2（批次 1 收口时 WP-2 核心交付无包内行为断言） | 回环接口面最小契约断言（5 GET 响应形状 / 连发两次 continue 第二次 `ESCALATION_NOT_PENDING` / `/hosts/open` 对 mock 宿主返回 `HOST_UNSUPPORTED` / 五个投影导出基本形状）**并入** `drill-fixtures.test.js`：不新增文件、D-9 的 17 文件清单不变；映射表 AC 主责归属与「WP-2×1（drill-fixtures，不绑定 AC）」的机检文件归属标注**均不变**（该文件不承担 AC-22/23/25/26/46 的主责判定机检，只提供包内独立验收的最小契约面） |

### 8.3 拆分范围自查

- 本拆分的 35 个登记文件与 D-1（新增）/ D-10（修改授权）/ D-11（断言授权）逐一对得上，**没有超出授权清单的文件**；没有为绕过 AC 而新增「测试专用渲染分支」；没有把任何范围条目挪到范围外；round5 建议 3 条（F5-01/02/03）全部进 §7 风险并给出点名处置。

---

## 附录：拆分质量自检结果（模板 §1.5，交付前逐条勾）

| # | 检查 | 结果 |
|---|---|---|
| 1 | 8 节齐全、标题与顺序一致（§0~§8） | PASS（`grep -n "^## " docs/iterations/iteration-10b.md` 输出 0~8 共 9 个节标题，节号与顺序与模板 §1.3 一致） |
| 2 | 每条 AC 都出现在某个 WP 的「验收口径」/ 映射表里 | PASS（AC-01~AC-51 在 §4 映射表 51 行全覆盖，主责 WP 唯一） |
| 3 | 每条 AC 都能在需求里找到同号 Then | PASS（需求 v5 附录 D-12 机械取号 51 条；映射表编号连续无缺号无重号） |
| 4 | 所有 WP 的负责文件两两无交集 | PASS（脚本核验：6 个 WP 的负责文件合计 35 条路径，两两交集为空，输出见交付回执 ④） |
| 5 | 依赖图无环，且每个 WP 的依赖编号都存在 | PASS（DAG 边 WP-2→1、WP-3→{1,2}、WP-4→{1,2,3}、WP-5→{1,2,3}、WP-6→{1..5}；人工 + 脚本核验无环） |
| 6 | §0 退出标准逐条可判定 | PASS（7 条均有数字或逐字口径：51/51、≥1425 + 差集 0、USAGE_LINES 25、purity exit 0、deps 0、D-14 复核口径、NF 锚点） |
| 7 | §2 每个文件都标注了归属 WP | PASS（35 文件逐条标 WP-1~WP-6；只读基线段显式声明 D-13 冻结面） |
| 8 | §6 有「契约先冻结点」与「整合检查点」 | PASS（冻结点 ①②③ + 检查点 1~4） |
| 9 | §7 每条风险都有具体处置（点名文件/函数） | PASS（11 条风险全部点名文件与函数 / 命令） |
| 10 | §8 声明「不新增需求条目，冲突以需求为准」 | PASS（§8 开头显式声明 + 14 条冲突逐条给裁决出处） |
