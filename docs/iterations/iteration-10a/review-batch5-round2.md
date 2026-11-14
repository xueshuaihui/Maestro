# I1.10a 批次 5 复评记录（round 2）

> 复评对象：`46af77a`（WP-8 主体）、`9c9a50a`（M / B-25）、`adafebe`（O / B-26）、`1c9ea95`（N/O/P）、`dd178e1`（Q）
> 复评依据：`review-batch5.md`（round 1）、`decisions.md` 裁决 M/N/O/P/Q、拆分 §2.1/§2.2/§4 WP-8、需求 AC-30/08/22/24/31/37 等
> 方式：只读 + 本记录；机械扫描用 `/usr/bin/grep` / Python；测试串行 `--test-concurrency=1`；S-02 独立起服实跑（端口/令牌取自 `.orch/desktop.json`）

## §0 复评总判

**FAIL**。残留阻断 **1**（B-25 / Q-1 的真实窗口链路）/ 建议 **5**（R-04~R-08）。

B-22~B-32 三态：

| B-22 | B-23 | B-24 | B-25 | B-26 | B-27 | B-28 | B-29 | B-30 | B-31 | B-32 | Q-1 | Q-2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 已闭合 | 已闭合 | 已闭合 | **未闭合** | 已闭合 | 已闭合 | 已闭合 | 已闭合 | 已闭合 | 已闭合 | 已闭合 | **部分闭合** | 已闭合 |

唯一阻断不是「又发现了新缺陷」，而是 **裁决 M 的送达方案在真实浏览器链路上只覆盖了顶层文档**：`/ui/?token=` 能返回 index.html，但页面里的 `import './app.js'` 是相对模块请求，浏览器解析相对 URL 时 **不继承 query**，`/ui/app.js`（以及后续 `connection.js`、`labels/labels.js`…）无凭据 → 401；服务器也没有下发任何 cookie，壳侧也没有 `__MAESTRO_DESKTOP__` 注入。真实 WebView 打开后模块图加载失败，`#app` 永远为空（白屏），AC-30/31/22/01 的窗口面仍不可验收。

其余 10 项阻断/建议均为已闭合；上一轮的 B-22/B-23/B-24/B-26 已在代码与真实数据面上闭合。

## §1 阻断闭合判定

### B-22（AC-22 视图偏好三层实参与读回）——**已闭合**

代码路径：

- `persistOffsets` 只传 `{ root, instance_id, offsets }`（`desktop/ui/app.js:726-736`），transport 原样 `invoke('write_view_command', { root, instance_id, offsets })`（`app.js:1682-1686`）。
- `openGraph` 在取图前 `await readOffsets(id)`（`app.js:303-308`），`readViewOffsets` 传 `{ root, instance_id }`（`app.js:1687-1691`），读回后经 `rebuildGraph` 的 `applyOffsets`（`app.js:384`）叠加。
- 壳侧 `write_view` 只包一层 `{ offsets, updatedAt }`（`config.rs:192-200`），与拆分 §3.2 逐字一致；两个 command 都已注册（`main.rs:110-116`）。

本评审用假 `__TAURI__.core.invoke` 驱动真实 transport（非测试自述）：

```
read call  = ["read_view_command",{"root":"/tmp/maestro-r2-a","instance_id":"INST-001"}]
offsets after read = {"role:tester":{"dx":40,"dy":60}}
write call = ["write_view_command",{"root":"/tmp/maestro-r2-a","instance_id":"INST-001",
              "offsets":{"role:tester":{"dx":40,"dy":60},"role:developer":{"dx":10,"dy":20}}}]
offsets 内嵌 offsets/updatedAt = false
```

`read_view_command` 抛错时：`view=graph`、`graph.nodes=3`、`compose().graph.nodes=3`、`notice=null`、`lastError=boom` —— **读失败不阻断渲染**。
`errors.test.js:665` 的 seam 3 也用「壳侧单层文件」做重开读回（`reopened.x/y = base+40/+60`），形态合格。

### B-23（SSE `graph.snapshot` 解析）——**已闭合**

从真实守护进程抓原文（`GET /instances/INST-001/graph/stream`，Bearer）：

```
event: graph.snapshot
data: {"rev":0,"instanceId":"INST-001","type":"snapshot",...,"payload":{...nodes/edges/stateNodes...}}
```

用真实原文驱动 `parseSseBlock` → `createApp().handleFrame`：

```
frame.event = graph.snapshot | frame.type = graph.snapshot | data.type = snapshot
handleFrame -> {"type":"graph.snapshot","repaint":"graph"}
after graph nodes = 3 | edges = 2
```

`parseSseBlock` 已改为 event 名优先（`app.js:1582-1597`），`handleFrame` 同时认 `graph.snapshot` 与 `snapshot`（`app.js:499-506`）。AC-08「重连补全量」在真实帧上可达。

### B-24（装配层几何重复）——**已闭合**

- `grep -n "ARC_LIFT" desktop/ui/app.js` → rc=1 零命中，`layout.js` 的导入已只剩 `computeLayout`。
- 控制点来自 `placed.path.ctrl`，经与节点同一 `view.screen` 线性变换（`app.js:907-917`）；绘线只剩 `M … Q ctrl …`（`app.js:1254-1267`），无第二次贝塞尔控制点构造。
- 说明：标签定位的 `mid` 仍按二次曲线 t=0.5 取值（`app.js:1265`），这是文本摆放坐标、不是导线几何重算，不构成 B-24。

### B-25 + Q-1（WebView 凭据送达 / project 送达）——**未闭合（阻断）**

**服务端三态本身是成立的**（真实起服实测，`serve-entry --project /tmp/maestro-r2-a --desktop`）：

| 请求 | 结果 |
|---|---|
| `GET /ui/?token` | 200（index.html 正文） |
| `GET /ui/index.html?token` | 200 |
| `GET /ui/app.js?token` | 200 |
| `GET /ui/` 无凭据 | 401 |
| `GET /ui/labels?token` | **401** |
| `GET /ui/labels` + Bearer | 200（147 键） |
| `GET /instances?token` | **401** |
| `GET /instances` + Bearer | 200 |
| `GET /instances/stream?token` | **401** |
| `GET /ui/..%2fsrc…?token` | 401（目录穿越） |
| `GET /ui/?token=deadbeef` | 401 |

**但真实窗口链路断在静态子资源**：

```
new URL('./app.js', 'http://127.0.0.1:56004/ui/?token=…') -> http://127.0.0.1:56004/ui/app.js   # query 不继承
GET /ui/app.js（无 token）            -> 401
GET /ui/labels/labels.js（无 token）  -> 401
GET /ui/?token 响应头                 -> 无 Set-Cookie
grep __MAESTRO_DESKTOP__/initialization_script desktop/src-tauri/src -> 零命中
```

`index.html:78-83` 的 inline module 相对导入 `./app.js`，浏览器按文档 URL 解析但不继承 query；服务器只认 `?token=` 或 Bearer，壳侧又没有注入全局，因此 **模块图从第一个 import 起就 401**。页面没有 JS 执行，`#app` 为空，用户面是白屏（连 AC-30 的「不白屏」都不成立），Q-1 的 project 也永远到不了 `state.project.root`。

Q-1 的页面与壳侧代码本身是对的：

- 壳侧 `query_pairs_mut().append_pair("token", …).append_pair("project", …)`（`spawn.rs:186-195`），自动百分号编码；
- 页面 `takeLocationCredentials()` 同时捕获 token/project 并 `history.replaceState` 抹除（`app.js:1522-1554`）；
- 本评审实跑：`creds={port:56004,token:abc,project:/tmp/maestro-r2-a}`、`replaceState=[null,"","/ui/"]`、`resolveMountProject().root=/tmp/maestro-r2-a`、`view=instances`；
- token 只存模块级变量，无 `localStorage/sessionStorage`（`app.js:1507-1512` 只有注释），无 `console.*` 打印（grep rc=1）。

所以 Q-1 计 **部分闭合**（代码路径成立，窗口面被 B-25 的同一条送达链阻断）。

### B-26 + Q-2（看板输入形状与 role 绑定）——**已闭合**

真实链路（`GET /instances/INST-001/graph`，code-loop：T-001 上游 running、T-002 pending）：

```
nodes = 3（role:coordinator / role:developer / role:tester）
stateNodes = [{"nodeId":"T-001","roleId":"developer","state":"running"},
              {"nodeId":"T-002","roleId":"tester","state":"pending"}]
SSE 首帧 payload 同样携带 stateNodes（键集合含 stateNodes）
```

用 `createApp` 真实装配后 `setView('board')`：

```
board cards = [{"id":"T-001","state":"running","column":"running"},
               {"id":"T-002","state":"pending","column":"blocked"}]
```

即「上游 running → 下游 pending 落 blocked」，不是全落 `ready`。`boardStateNodes` 只吃 `graph.stateNodes`（`app.js:93-104`），`projectBoard({state:{nodes: payload.stateNodes}})`（`app.js:673-680`）；`graph.js` 只做 `{nodeId, roleId, state}` 纯搬运（`graph.js:590-601`），`roleId` 非字符串归 null。

## §2 建议项闭合判定

| 项 | 结论 | 证据 |
|---|---|---|
| B-27 本地 fill | **已闭合** | `app.js` 无 `function fill(`/`fillTemplate`；`fill` 命中仅为 SVG 属性；两处提示改走 `noticeText → resolveLabels().text`（`app.js:695-698`） |
| B-28 描边 token | **已闭合** | painter 取 `visual.statusColor ?? visual.color` 映射五色（`app.js:1203-1217`）；`abnormal` 只参与 `badge`/`pulse`，不再决定红/灰 |
| B-29 组端点名 | **已闭合** | 13 角色真实装配（8 coding + 5 research）后组间边行实测：`连接线 编码工程→研究分析 · 正向 · `；`displayNameOf` 对 `type==='group'` 走 `GROUP_LABEL_*`（`app.js:919-936`） |
| B-30 EOF 重连 | **已闭合（静态）** | 列表流与图流的 `onStatus` 均为 `status === 'error' \|\| status === 'closed'` → `disconnect()+scheduleReconnect()`（`app.js:1429-1438/1454-1461`）；`openStream` 的 `finish` 有 `finished` 闸门，主动 `destroy()` 先置 finished 再 abort → 不回调、不重连（`app.js:1599-1637`）。未新增 DOM 级用例，见 R-07 |
| B-31 接缝用例 | **已闭合** | seam 1 用 SSE 原文 `parseSseBlock` 后断言图替换（`errors.test.js:608`）；seam 2 断言 `invoke` 三字段实参（`:638`）；seam 3 真正走写文件→重开读回（`:665`）；Q-1 用例覆盖查询捕获/抹除/优先级/落点（`:725`） |
| B-32 EOF 空行 | **已闭合** | 文件末尾只剩一个 `\n`；`git diff aca57d6..dd178e1 --check` rc=0，`git show --check 1c9ea95/dd178e1` rc=0。注：历史提交 `46af77a` 自身仍会报 `app.js:1530 new blank line at EOF`（不改写历史则无法消除），当前树干净 |

## §3 回归与边界

| 项 | 结论 | 证据 |
|---|---|---|
| ① 文件集合 | **PASS** | 区间 `aca57d6..dd178e1` 恰 10 文件：WP-8 5 文件 + M（`server.js`/`spawn.rs`/`http-channel.test.js`）+ O（`graph.js`/`graph-projection.test.js`）+ Q（`spawn.rs`/`app.js`/`graph.js`/`graph-projection.test.js`/`errors.test.js`）。Q 点名的 `index.html` 未改——`mountApp` 已从 `credentials` 读 project，`index.html` 现有 `project: injected.project ?? undefined` 不需要改，属「授权但无需改动」，不算越权；也没有集合外文件 |
| ② 禁改面 | **PASS** | `git diff --stat` 对 `src/core`、`src/cli`、`src/persistence`、`src/registry`、`src/templates`、`http/{routes,stream,labels}.js`、`desktop/ui/{list,graph,board,labels}`、`package.json` 全为空 |
| ③ 断言削弱 | **PASS** | 测试删除行仅 18 行：`errors.test.js` 6 行（旧 `writeViewOffsets(instanceId,payload,root)` 签名 + `payload.updatedAt` 断言，被「三字段实参 + 壳侧单层文件含 updatedAt」替代）；`graph-projection.test.js` 12 行（旧 `{nodeId,state}` 断言，被 `{nodeId,roleId,state}` 更强断言替代）。无 AC 断言被删弱 |
| ④ 零 CJK | **PASS** | Python 扫描 `desktop/ui` + `desktop/harness`（js/mjs/html/css/json）→ 0 命中 |
| ⑤ 零依赖 | **PASS** | `dependencies/devDependencies = 0/0` |
| ⑥ `saveState\|emit(` | **PASS** | `src/daemon/graph.js` 零命中（rc=1） |
| ⑦ 测试专用分支 | **PASS** | `desktop/ui` + `desktop/harness` 的 `NODE_ENV/process.env/__TEST__/isTest` 零命中（rc=1） |

## §4 门禁复跑输出

> 环境说明：WorkBuddy 注入的 `NODE_OPTIONS=--require=…node-language-shim.cjs` 会让测试的 `mkdir` 被 broker 拒绝（`CODEBUDDY_BROKER_DENY`）并产生 10s 超时；首轮带 shim 的全量（跑到 261 条时已 12 个拒绝）**作废**。下列数字为 `NODE_OPTIONS=` 且串行单跑的结果。

### ① 五个 wp13 文件

```
NODE_ENV=test node --test --test-concurrency=1 test/wp13/errors.test.js \
  test/wp13/graph-projection.test.js test/wp13/http-channel.test.js \
  test/wp13/board.test.js test/wp13/board-unknown.test.js
1..64  # tests 64  # pass 64  # fail 0  # skipped 0
```

### ② 全量（串行，320s）

```
1..1352  # tests 1352  # pass 1346  # fail 5  # skipped 1
not ok 101  NFR-02: verifyProducts({sha256:true}) p95 <= 50ms
not ok 827  AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 …
not ok 1046 task-loop 审核提示词给绝对路径
not ok 1097 core.stop：先回包再断连，5s 内收敛
not ok 1115 main：--cwd 相对当前 shell 目录解析
```

归因：

- 101/1046/1097/1115 全部 ⊂ 基线 8 条（主控本轮 6 条的子集；`cursor.json 并发`、`早返回 turn-delay` 本次通过）。
- 827（`instance-list.test.js:413`，期望 `running` 实得 `completed`）不在主控列表。**已用批次前快照归因**：`git archive aca57d6 | tar -x -C /tmp/maestro-pre` 后在 `/tmp/maestro-pre` 单跑同一文件，**同一条断言同样失败**（expected running / actual completed），且该文件在本批 10 文件之外、零 diff → 判定为既有测试时序问题，非本批引入；建议主控把它登记进基线。
- 因此本批差集 = 0（以批次前快照为参照）。

### ③ 架构 / 机械

```
purity src/core,src/daemon,desktop/ui（45 文件，31 词全表） -> OK, exit 0
CJK（desktop/ui + desktop/harness）                        -> 0
deps/devDeps                                               -> 0/0
```

### ④ S-02 端到端（本评审独立起服）

```
GET /ui/labels         200  keys=147
GET /instances         200  items=1（写盘 INST-001 后）
GET /workflows         200  items=3  [single, code-loop, task-loop]
GET /instances/INST-001/graph 200  nodes=3  edges=2  stateNodes=2
GET /instances（无凭据）       401  {"error":"UNAUTHORIZED"}
GET /ui/labels?token=…         401  {"error":"UNAUTHORIZED"}
GET /ui/?token=…               200  （仅顶层文档）
GET /ui/app.js（无凭据）       401  ← 真实窗口模块图的断点
```

### ⑤ 壳侧

```
cd desktop/src-tauri && cargo check --offline
Finished `dev` profile ... in 1.86s   EXIT=0
```

## §5 残留项

| # | 级别 | 位置 | 现象 | 建议 |
|---|---|---|---|---|
| **R-03** | **阻断** | `desktop/ui/index.html:78-83` ↔ `src/daemon/http/server.js:372-381` ↔ `spawn.rs:186-195` | 顶层 `?token=` 只能认证 index.html；模块的静态相对导入不继承 query，`/ui/app.js` 等全部 401，页面无 JS 执行（白屏），AC-30/31/22/01 窗口面不可达 | 修送达链而不是再放宽数据面。优先 **裁决 M 方案（b）**：壳侧在页面加载前注入 `window.__MAESTRO_DESKTOP__={port,token,project}`（Tauri `initialization_script`，需把窗口创建挪到 desktop.json 就绪之后）；或等价地：`/ui/` 顶层导航 200 时下发 `HttpOnly; Path=/ui/` cookie，`authorized` 仅在**静态文件分支**接受该 cookie。验收必须加一条「浏览器同源第二跳」检查：顶层 200 后，`/ui/app.js` 也必须 200 |
| R-04 | 建议（高） | `app.js:1537-1545` | `replaceState` 抹除 query 后，窗口重载/再次导航丢失 token → 401；cookie/init-script 方案可一并解决 | 与 R-03 同修，并补 reload 用例 |
| R-05 | 建议 | `server.js:339-353` | `claimedByHandler` 末尾 `return fallbackDispatcher !== null`：一旦 `routes.js` 改成 whole-path dispatcher（返回 `{handle}`），所有路径都被判为 handler 所有，静态 query token 全失效。当前 routes 返回数组故未触发 | 把兜底判断改为「仅当 dispatcher 声明了该路径」或直接删除该兜底，改为静态文件优先判定 |
| R-06 | 建议（高，既有） | `app.js:181`、`index.html:80-82` | 无 `--project` 时壳显示打包的 index.html，`mountApp` 无 creds/无 project → `createApp` 默认 `view='instances'`，AC-31 的 `project-missing`/`project-invalid` 页在真实窗口不出现（探针里 view 是 project-missing，用户面不是） | WP-8 内一行可修：`resolveMountProject(...) ?? resolveProject({})`，让无 root 时进入 blocked 页；S3 的 AC-31 窗口面需要这条 |
| R-07 | 建议 | `app.js:1429-1438/1454-1461` | B-30 只有静态路径判定，无 DOM 级 closed→reconnect 用例 | 批 6/S3 用最小假 DOM 或壳探针补一条 |
| R-08 | 建议（基线） | `test/wp13/instance-list.test.js:413` | AC-04 在批次前快照 `aca57d6` 上同样失败（mock 完成早于首帧 refetch 的竞态） | 登记进基线或改测试为首帧 refetch 不要求 `running` |

## §6 能否进批次 6（WP-9）

**不能。** WP-9 的整合与 S3 验收会直接在真实壳里打开 `/ui/`：当前模块图 401、页面白屏，AC-30 六现场、AC-31 首屏、AC-22 视图偏好、AC-01/24 的窗口面全部不可验收——这正是 WP-9 要证明的东西。

建议主控：

1. 先按 R-03 重开裁决 M（init-script 注入或静态 cookie 二选一），只改 `server.js` + `spawn.rs/main.rs` 的送达链，不必动数据面鉴权；
2. 补一条「顶层文档 + 第二个静态子资源」的验收断言进 `http-channel.test.js`，防止同类漏网；
3. 修完后 **只需复评送达链 + S-02 的窗口两跳**，其余 10 项已闭合，无需整批重跑。
