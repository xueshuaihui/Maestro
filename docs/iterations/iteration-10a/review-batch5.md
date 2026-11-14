# I1.10a 批次 5（WP-8 界面装配与连接态/降级）实现评审记录

> 评审对象：`46af77a`（`desktop/ui/app.js` / `connection.js` / `project.js` / `index.html` / `test/wp13/errors.test.js`，5 文件 / +2619）
> 评审依据：`docs/iterations/iteration-10a.md`（r2）§2.1/§2.2/§3/§4 WP-8；`requirement.md`（v2）AC-30/31/01/26/08/37/15/21/22、附录 A-2/A-4/A-6/A-11/A-12、D-2/D-5/D-7/D-9/D-11、§3.1 五条；`decisions.md` A~L；`review-batch4-round2.md` §6.3 与 `review-batch4.md` §6.3 七条接口风险
> 评审方式：只读 + 本记录；机械扫描用 Python / `grep -RE`（ERE）；测试串行 `--test-concurrency=1`；S-02 端到端独立起服实跑（端口/令牌一律取自 `.orch/desktop.json`）

## §0 总判

**FAIL**。阻断 **4** / 建议 **7**（B-22~B-32）。

阻断集中在「装配与真实接缝」而非纯模块契约：

1. **B-22**：AC-22 的视图偏好**写入形状双层包裹**，且重开流程**不读回**偏好（`app.js` 默认 transport ↔ `config.rs` 命令签名错位）。
2. **B-23**：SSE `graph.snapshot` 首帧/重连全量在真实解析路径上被**丢弃**（`data.type='snapshot'` 未归一），AC-08「重连补全量」与 AC-30 现场五第二句不可达。
3. **B-24**：装配层**二次实现弧线几何**（`edgeGeometry` + `ARC_LIFT`），违反 WP-8 门禁附加「装配层不新增渲染逻辑」与判定口径 1。
4. **B-25**：WebView **鉴权 token / project 摘要未送达**——批次 2 B-05「WP-8 开工前必须先决」在 `decisions.md` 无裁决、壳侧导航仍为裸 URL；真实壳内 `/ui/labels` 必 401，AC-30/31/22 端到端不可达（责任面 WP-1/WP-2 接缝，非本 5 文件可闭合）。

复核命令清单：

```bash
git diff aca57d6 46af77a --name-status
git diff aca57d6 46af77a -- src/ package.json desktop/src-tauri/
NODE_ENV=test node --test --test-concurrency=1 test/wp13/errors.test.js
NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>
node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid <31 词>
node -p "Object.keys(require('./package.json').dependencies||{}).length + '/' + Object.keys(require('./package.json').devDependencies||{}).length"
grep -R "decideStatus" desktop/ --exclude-dir=target        # 零命中
python3 <CJK 正则扫描 desktop/ui desktop/harness>            # 零命中
# S-02：spawn serve-entry --desktop → 读 .orch/desktop.json → 断言 4 路由 + 401
```

## §1 边界合规

| 项 | 结论 | 证据 |
|---|---|---|
| ① 恰 5 文件 | **PASS** | `git diff --name-status` 仅 5 个 `A`；`src/`、`package.json`、`desktop/src-tauri/` 三处 diff 为空；既有测试零改动 |
| ② 零 npm 依赖 | **PASS** | `dependencies/devDependencies` = `0/0`；新文件只 import 相对模块 |
| ③ `index.html` 纯静态 | **PASS** | 无框架/打包器/外链；唯一 inline module 只 `import { mountApp } from './app.js'`（`index.html:78-83`） |

补充：`desktop/ui` 17 文件（含 `index.html`）与 `desktop/harness` 5 文件 CJK **零命中**；`grep -R "decideStatus" desktop/ --exclude-dir=target` 零命中。

## §2 AC-30 六现场 + F-17 逐句核对

| 现场 | 键/来源（147 键表） | 不白屏 | 不打堆栈 | 可操作出口 | 结论 |
|---|---|---|---|---|---|
| ① `实例 INST-999 · 不存在` | `DESKTOP_GRAPH_MISSING`（`{id}` 填充，`app.js:316-321`） | 空图 + notice，列表一动作可达 | 404 走 catch/分支，不抛 | `back-to-list` + `retry-graph` | **PASS** |
| ② `流程图定义不可读 · 已按内置模板显示` | `DESKTOP_DEF_UNREADABLE`（`app.js:348-355`） | 保留回退节点/边（测试 nodes=2、edges=1） | 无抛 | `back-to-list`（retryable=false） | **PASS** |
| ③ `子工作流 child-x · 角色数未知` | `DESKTOP_SUBFLOW_UNKNOWN`，由 WP-6 `renderSpecialRow` 取表；装配不拼中文 | 特殊节点留在画布，其余图照常 | 无抛 | `back-to-list` | **PASS** |
| ④ `连接守护进程失败 · 请确认项目目录后重试` | `DESKTOP_CONN_FAILED`（`connection.js:44`） | 状态行常显，不清屏 | 传输错误只记 `lastError`，不上屏 | `retry-connection` | **PASS** |
| ⑤ `已断开 · 正在重连…` | `DESKTOP_CONN_RECONNECTING`（`connection.js:43`） | `keepsContent()=true`，保留最后图 | 无抛 | `retry-connection`/自动重连 | **PASS**（模块/装配；真实 EOF 触发见 B-30） |
| ⑥ `实例 {id} · 状态不可读` | `DESKTOP_LIST_UNREADABLE` / `renderListUnreadable`（A-2 复用） | 不可读行不阻断其它行（3 行保留 2 行可读） | 无抛 | 列表仍可点其它行 | **PASS** |
| **F-17 瞬态** | 先 `DESKTOP_CONN_CONNECTING`；`tick()` 严格 `>` 10s 才 `failed`；`retry()` 重开窗口；传输立刻 reject 不短路（`connection.js:71-84/161-180`） | — | — | 注入 `now` 可测，无真实等待 | **PASS**（10000ms 仍 connecting、10001ms failed） |

文本来源核对：六句全部经 `resolveLabels`/147 键表下发；`app.js`/`connection.js` 零中文常量（Python 扫描零命中）。测试用真实 `UI_LABEL_KEYS` 作标签源，非自造键。

## §3 其余主责/协作 AC

| AC | 结论 | 核对点 |
|---|---|---|
| AC-31 | **PASS** | `resolveProject` 优先级 `arg > env > remembered`；高优先级不可用**不回退**（`project.js:82-99`）；missing/invalid 两页与「remembered 进列表」均测；`app` 装配 `view='project'` 且 `operable=false` |
| AC-01 | **PASS** | `view='instances'` 默认；六字段行走 `renderListRow`、四档排序走 `sortInstances`；`待处理 0` 保留；`healthText` 走 `renderHealthHover` |
| AC-26 | **PASS** | `buildGraphShownProbe` = `{event,instanceId,view,nodes,edges,dangling}`；`buildClosedProbe` = `{event:'closed',view:'instances',window:{visible:false}}`；openGraph 成功才发探针 |
| AC-08 / AC-37 | **FAIL（协作）** | 分流本身正确（role/special/connection → graph；session → 仅指示器；instances.changed → refetch）；但 **SSE `graph.snapshot` 真实帧被丢弃**（B-23）→ 重连全量不生效 |
| AC-15 | **PASS** | 默认过滤 `not_started`；开关后灰虚线出现，工具栏文案切换；测试逐条断言 |
| AC-21 | **PASS** | 双击 2 跳（可见恰 B/C/D）；标题 `聚焦 C（2 跳）`；Esc 恢复 5 节点；坐标不动 |
| AC-22 | **FAIL（协作）** | 跨实例隔离与复位有；**文件形状双层包裹 + 重开不读回**（B-22）→ `.orch/desktop/views/<id>.json` 非 §3.2 形状，AC-22 Then 不成立 |

## §4 装配纪律

| 项 | 结论 | 说明 |
|---|---|---|
| ① 装配层不新增渲染逻辑 | **FAIL** | 行文本/看板列/高亮集合/样式 token 基本复用；但 `edgeGeometry`（`app.js:1169-1185`）用 `ARC_LIFT` 重算二次贝塞尔控制点，而 `layout.js:133-142` 已返回 `path.ctrl` → 重复实现的布局几何（B-24）。次要：`fill` 复制 `fillTemplate`（B-27）、看板 unknown 文本在 painter 拼接、节点描边按 `abnormal` 自判（B-28） |
| ② 禁测试专用渲染分支 | **PASS** | `grep -nE "NODE_ENV|process\.env|__TEST__|isTest"` 于 4 个 UI 文件 rc=1 零命中；测试直接走 `createApp` |
| ③ 批 4 七条接口风险 | **PASS**（逐条） | 1 标签形状：传平铺键表（`resolveLabels().keys`）；2 折叠≠布局：`autoCollapse` 后 `computeLayout`，容器保留（AC-19 计数）；3 `toggleGroup` 传模型：`app.js:435`；4 先折叠再 `hoverSet`：`setHover`/`composeGraph` 均用 collapse；5 边行注入 `fromTitle/toTitle`：`app.js:810-816`；6 组名走冻结键：节点行经 `renderSpecialRow`（边端点见 B-29）；7 z 只取样式层：`style.z`，布局 z 未叠加 |
| ④ 纯模块未被绕过 | **基本 PASS** | 节点坐标全走 `computeLayout`+`view.screen`；行文本全走 `render*`；看板列走 `projectBoard`；唯一几何重复在边弧线（B-24）；看板输入形状另见 B-26 |

## §5 测试质量与门禁复跑

### ① WP-8 契约测试

```
test/wp13/errors.test.js  ->  1..15  # tests 15  # pass 15  # fail 0  # skipped 0
```

六现场 + F-17 + AC-31/01/26/08/37/15/21/22 + S-02 端到端均在其中；全部经 `createApp` 真实装配（非只测纯模块）；断言使用真实 `UI_LABEL_KEYS`，无自造键。无 BRE `\|`；无跨用例共享可变状态。**测试质量结论：形态合格，但接缝覆盖不足**（B-31）。

### ② 全量串行（`--test-concurrency=1`，约 23 分钟）

```
1..1343  # tests 1343  # pass 1337  # fail 5  # skipped 1
not ok 1037  task-loop 审核提示词给绝对路径…
not ok 1088  core.stop：先回包再断连，5s 内收敛…
not ok 1096  cursor.json 并发消费 20 次不重复
not ok 1106  main：--cwd 相对当前 shell 目录解析…
not ok 1205  早返回：turn-delay 3000ms 下 startRun 1s 内 resolve…
```

5 条全部 ⊂ `baseline-failures.txt` 的 8 条基线（两条 NFR-02 本轮实跑通过，故 5 而非 6）；**差集 = 0**。总数 1343 = 批 4 的 1328 + 本批新增 15，条数只增不减。

### ③ 架构 / 零依赖 / CJK

```
purity src/core,src/daemon（29 文件，31 词全表）-> OK, exit 0
purity desktop/ui（16 文件，31 词全表）        -> OK, exit 0
deps/devDeps                                    -> 0/0
decideStatus（desktop/ --exclude-dir=target）   -> rc=1 零命中
CJK（Python 正则，desktop/ui 17 + harness 5）   -> 0 命中
```

### ④ S-02 端到端（本评审独立实跑，非复用测试）

起 `serve-entry --project <tmp> --desktop`，端口/令牌从 `.orch/desktop.json` 读取：

```
desktop.json fields = generation,pid,port,startedAt,token（token 64 hex）
GET /ui/labels             200  keys=147
GET /instances             200  items=1（写盘 INST-001 后）
GET /workflows             200  items=3  [single, code-loop, task-loop]
GET /instances/INST-001/graph 200  nodes=1  edges=0  workflow.readable=true
GET /instances（无凭据）     401  {"error":"UNAUTHORIZED"}
```

S-02 接缝结论：**PASS**。观察项（不在本批判定）：SIGTERM 后 500ms 内 `desktop.json` 仍在（可能只是进程未退完，属 WP-2 删除路径，留 S3 复核）。

## §6 修复清单（B-22 起，编号承接批 4 的 B-21）

| # | 位置 | 原文 / 现状 | 违反哪条 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| **B-22** | `desktop/ui/app.js:462-467`、`:1513-1517` ↔ `desktop/src-tauri/src/config.rs:192-200` | `dragEnd` 调 `persistOffsets({ offsets, updatedAt })`；默认 transport 把该**整包**作为 `offsets` 传给 `write_view_command`；壳内 `write_view` 再包一层 → 文件成 `{offsets:{offsets:{…},updatedAt:…},updatedAt:…}`。且全仓无 `read_view_command` 调用，`openGraph` 只把 offsets 清空，不读回 | AC-22 Then（`.orch/desktop/views/INST-001.json` 为 §3.2 形状；重开后 B = 基础 +(40,60)）；拆分 §2.2/§3.2；`review-batch4-round2` §6.3 消费前提 | `invoke('write_view_command', { root, instance_id, offsets: payload.offsets })`；`openGraph` 打开实例时 `read_view_command` 取 `{offsets}` 并 `applyOffsets`，按实例号失效则忽略；补一条断言 invoke 实参形状 + 重开坐标的用例 | **阻断** |
| **B-23** | `src/daemon/http/stream.js:516` ↔ `desktop/ui/app.js:1430-1445`、`:492-496` | 首帧 `data.type='snapshot'`、`event='graph.snapshot'`；`parseSseBlock` 取 `type: payload.type ?? eventName` → `'snapshot'`；`handleFrame` 仅认 `'graph.snapshot'` → 落空返回 `repaint:'none'` | AC-08「重连补全量」；AC-30 现场五「重连后取全量快照」；拆分 §2.2 `connection.js` 契约；D-2 帧契约 | `parseSseBlock` 优先返回 `event`，或 `handleFrame` 同时认 `'snapshot'`；补一条从 `event: graph.snapshot\ndata: …` 原文解析到 `setGraph` 的集成断言 | **阻断** |
| **B-24** | `desktop/ui/app.js:47`、`:1169-1185` ↔ `desktop/ui/graph/layout.js:125-146` | 导入 `ARC_LIFT` 并用屏幕中心二次计算 `ctrl`；布局已输出 `path:{kind:'arc',ctrl}`，装配层未消费 | 拆分 §4 WP-8 门禁附加「装配层不新增渲染逻辑」；需求 §3.1 判定口径 1（窗口只是宿主，不另写渲染逻辑） | 由纯模块提供屏幕变换（如 `view.screenPoint(ctrl)`）或在装配层对 `placed.path.ctrl` 仅做 `*zoom+pan` 线性变换；删除 `ARC_LIFT` 导入与本地二次贝塞尔公式 | **阻断** |
| **B-25** | `desktop/src-tauri/src/spawn.rs:176-179`、`main.rs:123-130` ↔ `desktop/ui/index.html:79-82`、`app.js:1420-1428` | 壳 `win.navigate("http://127.0.0.1:<port>/ui/")` 裸 URL；页面只能从 query 或 `window.__MAESTRO_DESKTOP__` 取 token，二者均无人写入；project 摘要也无注入点 | 批次 2 `review-batch2.md:92` B-05（**WP-8 开工前必须先决**）；`decisions.md` 无对应裁决；AC-30/31/22 端到端；D-1 鉴权 | 主控裁决（建议）：仅 `GET /ui/` 首次导航接受 `?token=`（不落日志），或壳初始化脚本注入 `{port,token,project}`；裁决后 WP-1/WP-2 各改一处。**本批 5 文件无法闭合** | **阻断（跨包/待裁决）** |
| B-26 | `desktop/ui/app.js:94-103`、`:663-669` ↔ `desktop/ui/board/board.js:152-208` | `boardCardsFromGraph` 把图投影节点当快照节点喂给 `projectBoard`（`state: node.status`）；角色节点 status 是 `serving/available…`，看板只认 `pending/running/done…` → 角色卡全部落 `unknown`→`blocked` | AC-24/AC-35 在真实 UI 的呈现；§2.2「看板卡片来自 `state.nodes`」 | 看板需要快照节点状态：由 WP-3 路由补 `state.nodes` 投影或 WP-4 在 graph payload 带编排态；在此之前不要在 UI 伪造 `state.nodes`，或在 decisions 登记为 S3 缺口 | 建议（高，S3 必踩） |
| B-27 | `desktop/ui/app.js:867-873` ↔ `desktop/ui/labels/labels.js:55-61` | 装配层第三份 `fill()`（list/node-rows/edge-rows 已各有一份） | 裁决 L R-02「不下沉则不要抄第三份」；装配纪律单一来源 | 改用 `fillTemplate`（`labels/labels.js` 已导出），删除本地 `fill` | 建议 |
| B-28 | `desktop/ui/app.js:1145` ↔ `desktop/ui/graph/node-rows.js:190-197` | 节点描边仅按 `node.abnormal` 取红/灰，`row.visual.statusColor`（A-9 五 token）被携带但从未渲染 | 拆分 §2.2 行渲染 token 复用；AC-11 五要素用户面 | painter 使用 `node.visual.statusColor` 映射 CSS，`abnormal` 只负责角标/脉冲 | 建议 |
| B-29 | `desktop/ui/graph/collapse.js:107-117` ↔ `desktop/ui/app.js:810-816` | 组容器 `title` 存原始 group id；边行 `fromTitle/toTitle` 取该 title，>12 角色场景的组间边显示 `coding` 而非 `编码工程` | A-11 端点显示名；裁决 K 组名纪律（节点行已合规，边行未复用） | 注入端点名时对 `type==='group'` 走 `renderSpecialRow` 的组名解析（或让 collapse 携带 `groupKey` 由装配查表） | 建议 |
| B-30 | `desktop/ui/app.js:1477-1480`、`:1345-1352`、`:1367-1375` | `openStream` 正常 EOF 走 `finish('closed')`，两个 `onStatus` 只处理 `'error'` → 守护进程优雅关闭时既不显示「已断开 · 正在重连…」也不重连 | AC-30 现场五 / AC-08 / NF-3 重连语义 | `'closed'` 与 `'error'` 同路径：`disconnect()` + `scheduleReconnect()`（保留 `destroy()` 主动 abort 的区分） | 建议 |
| B-31 | `test/wp13/errors.test.js:441-502`、`:561-580` | 推送用例直接调 `handleFrame({type:'graph.snapshot'…})`，从不经过 `parseSseBlock`；AC-22 只断言 transport 入参，不断言 `invoke('write_view_command')` 实参 | 测试质量（接缝未覆盖，B-22/B-23/B-25 由此漏网） | 增加「SSE 原文 → 解析 → 图替换」用例；`writeViewOffsets` 注入 spy 断言 invoke 参数字段；补一条「重开实例读回偏移」用例 | 建议 |
| B-32 | `desktop/ui/app.js:1530` | 文件末尾多一个空行（`git show --check` exit 2） | 仓库卫生 | 删除多余空行 | 建议（微） |

## §7 进入批次 6 前必须先处理 / S3 风险

**必须先处理（否则 WP-9 的端到端与 S3 验收会直接红）**

1. **B-22**（AC-22 文件形状 + 读回）——S3 会按 `.orch/desktop/views/<id>.json` 断言，现形状必失败。
2. **B-23**（SSE 重连快照）——AC-08/AC-30 现场五的重连补全量在真实帧上不可达。
3. **B-25**（token/project 送达）——不裁决则真实壳主窗口 401/无 project，AC-01/26/30/31/22 的窗口面全部不可验收；建议随批 6 开工前落 `decisions.md`。
4. **B-24**（装配层几何重复）——WP-9 的「装配层不新增渲染逻辑」门禁会按本条判红；若主控接受「屏幕空间重算」为渲染宿主职责，需在 decisions 明示豁免，否则先改为变换布局 `ctrl`。

**S3 验收会踩的风险（建议批 6 顺带登记）**

- B-26 看板输入形状：真实 UI 的 7 列会把角色卡全标「状态未知/被阻塞」，AC-24/35 的窗口面与 harness 结论不一致。
- B-29 组间边端点显示英文 group id，AC-19 的 13 角色场景在边行文本上会露馅。
- B-30 优雅关闭不触发重连，NF-3 的「重连 ≤5s」在 `core.stop`/重启路径上缺证据。
- S-02 的 `desktop.json` 退出删除未在本批复核（WP-2 路径），S3 的 AC-27/收口第 6 条需补测。
- 环境卫生：全量跑会改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`，本轮已 `git checkout --` 还原；工作区仅余评审前既有的 `.workbuddy/memory` 改动与未跟踪的 `Cargo.lock`/`gen/`。
