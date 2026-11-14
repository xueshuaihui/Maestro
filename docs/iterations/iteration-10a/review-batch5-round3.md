# I1.10a 批次 5 复评记录（round 3 · 聚焦复核裁决 R）

> 复评对象：`3886927`（裁决 R 的修复：静态面免鉴权 + sessionStorage 凭据恢复 + project 提示页），4 文件。
> 上一轮对象 `46af77a` / `9c9a50a` / `adafebe` / `1c9ea95` / `dd178e1` 仅做回归确认。
> 复评依据：`review-batch5-round2.md` §5 残留 R-03~R-08、`decisions.md` 裁决 R、需求 AC-30（六句 + F-17）/ AC-31 / AC-22 / AC-01 / AC-26 / AC-27、附录 D-1、拆分 §2.2、§3.1 判定口径。
> 方式：只读 + 本记录；`serve-entry --project /tmp/maestro-r3 --desktop` 真实起服（端口/令牌取自 `.orch/desktop.json`），全部断言为本评审自己发出；测试串行 `--test-concurrency=1`；WorkBuddy 注入的 `NODE_OPTIONS` shim 会拒绝测试的 `mkdir`，故测试统一以 `env -u NODE_OPTIONS` 运行。

## §0 复评总判

**PASS**。R-03 / R-04 / R-06 **三项全部闭合**，残留阻断 **0**、建议 **6**（R-05、R-07、R-08 为裁决 R 已登记项；R-09~R-11 为本轮新增，均不阻断）。

| R-03 | R-04 | R-06 |
|---|---|---|
| **已闭合** | **已闭合** | **已闭合** |

判定要点：R-03 的「闭合」按硬约束以 **静态子资源无凭据 200** 为准——本评审从 index.html 解析 `import './app.js'`，按浏览器规则 `new URL(spec, documentUrl)` 解析（query 不继承），匿名为 200 且与 Bearer 正文逐字相同；再把整张模块图 BFS 拉全（16 个 module，含 `graph/*`、`list/*`、`labels/labels.js`、`connection.js`、`project.js`）**全部 200**，不是「只顶层文档 200」。数据面未被放松：`/ui/labels`、`/ui/labels?token=`、`/instances`、`/instances/stream`、`/instances/:id/graph` 匿名均为 401。

## §1 R-03 闭合判定（自跑原始输出）

### 1.1 静态面：顶层文档 + 模块图第二跳 + 整图 BFS

```
GET /ui/?token (no header) -> status = 200   content-type = text/html; charset=utf-8
  html import specifier = ./app.js
  resolved module url  = http://127.0.0.1:57206/ui/app.js      # query 不继承，正是浏览器解析结果
GET /ui/app.js（无任何凭据）      -> 200  text/javascript; charset=utf-8
GET /ui/app.js（Bearer）          -> 200  byte-identical to anonymous body = true  (65069 B)
GET /ui/list/list.js（app.js 的第一个相对 import，无凭据） -> 200  与 Bearer 正文相同 = true
module graph reachable from index.html -> 16 modules; non-200: 0
200 /ui/app.js  /ui/list/list.js  /ui/list/health-hover.js  /ui/list/new-instance.js
200 /ui/graph/layout.js  /ui/graph/view.js  /ui/graph/collapse.js  /ui/graph/style.js
200 /ui/graph/highlight.js  /ui/graph/node-rows.js  /ui/graph/edge-rows.js  /ui/graph/legend.js
200 /ui/labels/labels.js  /ui/board/board.js  /ui/connection.js  /ui/project.js
GET /ui/（无凭据）                -> 200
```

说明：`index.html` 里唯一的子资源就是 inline module 的 `import './app.js'`，CSS 全内联、无外链字体/图片，故 16 个 module 全绿即真实 WebView 的模块图可完整加载；`#app` 不再为空。

### 1.2 数据面未被放松（同一进程、同一端口）

```
GET /ui/labels（无凭据）              -> 401 {"error":"UNAUTHORIZED"}
GET /ui/labels?token=<正确令牌>        -> 401 {"error":"UNAUTHORIZED"}      ← 关键：query 不再是数据面凭据
GET /ui/labels + Bearer               -> 200  keys=147
GET /instances（无凭据）              -> 401 {"error":"UNAUTHORIZED"}
GET /instances?token=<正确令牌>        -> 401 {"error":"UNAUTHORIZED"}
GET /instances/stream（无凭据）        -> 401
GET /instances/INST-001/graph（无凭据） -> 401
```

页面侧仍走 Bearer：`createLoopbackTransport` 对每个数据请求都固定带 `Authorization: Bearer`（`app.js:1709-1727`），`/ui/labels` 也在其中，故静态面公开不会把数据面拽下水。

### 1.3 `claimedByHandler` 判定路径复核

代码路径：`authorized()`（`server.js:376-383`）→ `claimedByHandler()`（`server.js:341-354`）→ `isStaticFile()`（`server.js:357-364`）→ `resolveStaticPath()`（`server.js:492-499`）。

1. **数据面不可能误走静态放行**：`resolveStaticPath` 对非 `/ui`、`/ui/` 前缀直接返回 `null`（`server.js:493`），所以 `/instances`、`/instances/stream`、`/workflows` 无论磁盘上有什么同名文件都不可能被判成静态；`/instances` 命中「同名静态文件」在结构上不成立。
2. **`/ui/labels` 先被认领**：`claimedByHandler` 在静态判定**之前**执行，`pathname === '/ui/labels'` 显式返回 `true`（`server.js:347`），即使 static root 里真有一个名叫 `labels` 的文件也不会放行。
3. 实测（本评审另起一个 `staticRoot=/tmp/maestro-r3-shadow-ui`、里面故意放了 `labels`/`instances` 两个同名真文件，并注入了一条 `/ui/injected` 路由）：

```
anon   GET /ui/app.js（真文件）              -> 200
anon   GET /ui/labels（static root 有同名文件）-> 401 {"error":"UNAUTHORIZED"}
bearer GET /ui/labels（同上）                -> 200 {"keys":{...}}
anon   GET /ui/injected（注入路由在 /ui/ 下） -> 401
bearer GET /ui/injected                      -> 200 handler
anon   GET /ui/nonexistent                  -> 401
anon   POST /ui/app.js                      -> 401（公开面只对 GET）
anon   GET /labels（/ui 之外）               -> 401
```

4. 唯一残余风险仍是 R-05：`claimedByHandler` 末尾 `return fallbackDispatcher !== null`（`server.js:353`）。当前 `routes.js` 返回数组（`routes.js:307 return [`），`fallbackDispatcher` 恒为 `null`，故不触发；一旦将来改成 `{handle}` 整路径 dispatcher，**所有**请求都被判认领，静态公开分支整体失效、R-03 当场复现。裁决 R 已登记不修，见 §5。

## §2 R-04 / R-06 判定

### 2.1 R-04（sessionStorage 单键恢复）——**已闭合**

本评审用假 `window`/`sessionStorage` 驱动真实 `takeLocationCredentials()`（`app.js:1569-1607`），不用实现自述：

```
A node/no-window/no-storage          :: null                       # 无 DOM 环境安全跳过
B query creds                        :: {"port":51234,"token":"tok-query","project":"/tmp/p"}
B replaceState args                   :: [null,"","/ui/"]          # token 与 project 都被抹除
B storage writes                      :: [["maestro.desktop.token","tok-query"]]
B storage keys                        :: ["maestro.desktop.token"]   # 单键
B localStorage getter hits            :: 0                         # localStorage 零访问
C reload creds (same module)          :: {"port":51234,"token":"tok-query","project":null}
C reload creds (fresh module)         :: {"port":51234,"token":"tok-query","project":null}
C reload replaceState calls (fresh)   :: 0                          # 干净 URL 不再改写
D priority query>storage token        :: tok-query                  # 旧值 tok-stale 被覆盖
E memory fallback after scrub         :: tok-query                  # query>storage>内存
F throwing storage query creds        :: {"port":51234,"token":"tok-throw","project":null}
F throwing storage memory fallback    :: {"port":51234,"token":"tok-throw","project":null}
G history throws                      :: {"port":51234,"token":"tok-h","project":null}
```

- 优先级顺序 `query > sessionStorage > 内存` 成立；只有 query 值会写回单键（非 query 来源不重复写）。
- `localStorage` 在 `desktop/ui` 零命中（grep 仅 `sessionStorage`，且只有 `app.js:1533/1536-1557` 三个位置）；`console.*` 在 `desktop/ui` 零命中，不打印令牌。
- 存储被禁用/抛异常（`F`）、`history.replaceState` 抛异常（`G`）、无 `window`（`A`）都不阻断页面，降级为内存令牌。
- 与裁决 R.3 一致：单键 `maestro.desktop.token`、地址栏 `replaceState` 抹除、无持久化存储、无打印。

### 2.2 R-06（project 提示页）——**已闭合**

`createApp` 经 `initialProject()`（`app.js:171-183`）兜住缺失摘要，实测四种必判输入 + 两种边界：

```
R-06 undefined          :: {"view":"project","msg":"项目缺失，请用 --project 打开一个项目","emptyText":null,"rows":0,"operable":false}
R-06 null               :: 同上
R-06 {}                 :: 同上
R-06 {root:""}          :: 同上
R-06 {root:"   "}       :: 同上
R-06 {root:null,view:null} :: 同上
R-06 unusable dir       :: {"view":"project","msg":"项目 不可用 · /tmp/does-not-exist-r3","emptyText":null}
R-06 late labels before :: {"view":"project","msg":null}
R-06 late labels after  :: {"view":"project","msg":"项目缺失，请用 --project 打开一个项目"}
```

- 四种输入（缺失 / `null` / 空对象 / 空 root）都进 `view === 'project'`，`emptyText === null`、`rows.length === 0`、`operable === false`——**不是列表空态**；不可用目录走 `DESKTOP_PROJECT_INVALID` 并在句子里带路径。
- labels 迟到（先 `null`，落表后 `setLabels`）文案仍能解析（`compose()` 的 `projectMessage` 回落到 `projectMessage(state.project, state.labels)`，`app.js:648-650`）。
- 文案取自真实 `/ui/labels`（147 键）：`DESKTOP_PROJECT_MISSING = "项目 未指定 · 请填写项目目录"`、`DESKTOP_PROJECT_INVALID = "项目 不可用 · {path}"`，与 AC-31 附录 A-3 逐字一致；`desktop/ui` 无中文硬编码（CJK 扫描 0）。
- 用真实标签 + 真实壳导航参数（`?token=<真>&project=%2Ftmp%2Fmaestro-r3`）装配：`mountProject.view=instances`、`model.view=instances`、`projectMessage=null`、`operable=true`——有项目时**不会**被误挡在提示页（与 AC-31 现场三同向）。

## §3 回归检查

### 3.1 前两轮 11 项 + Q-1/Q-2

| 项 | 结论 | 本轮证据 |
|---|---|---|
| B-22 视图偏好三层实参与读回 | 未回归 | `errors.test.js` AC-22 用例 ok；transport 三字段实参未改（`app.js:1736+`） |
| B-23 SSE `graph.snapshot` 解析 | 未回归 | `errors.test.js` seam 1 ok；`parseSseBlock` 未在本轮 diff 内 |
| B-24 装配层几何重复 | 未回归 | 本轮 `app.js` diff 只涉及 `initialProject` 与凭据函数，paint/layout 段零改动 |
| B-25 窗口送达链 | **本轮闭合** | §1 的 16 module 全 200；服务端与页面链路同时成立 |
| B-26 看板 stateNodes | 未回归 | `graph-stream.test.js` / `board.test.js` 全绿（4 文件 49/49） |
| B-27~B-29 本地 fill / 描边 token / 组端点名 | 未回归 | 本轮未触相关段；`desktop/ui` purity、CJK、标签键数 147 均未变 |
| B-30 EOF 重连 | 未回归 | 静态判定未改；无 DOM 级用例（R-07 仍登记） |
| B-31 接缝用例（含 invoke 实参形状） | 未回归 | `ok 16 - B-31 seam 2: writeViewOffsets hands the shell the three-field invoke shape` |
| B-32 EOF 空白 | 未回归 | `git show --check 3886927` rc=0 |
| Q-1 project 优先级 | 未回归 | `ok 18 - Q-1: the query project reaches state.project.root and the offsets seam`；`initialProject` 只在「既无 view 又无 root」时接管，`resolveProject` 产出的 `instances` 摘要原样保留 |
| Q-2 看板输入形状 | 未回归 | 同上，`board.test.js` 全绿 |
| AC-30 六句 + F-17 | 未回归 | `errors.test.js` scene 1~6 与 F-17 全部 ok；且真实模块图可加载，「不白屏」成立 |
| AC-31 提示页 | 未回归且增强 | `ok 8 - AC-31` 与 `ok 871 - project-guard: missing / invalid / valid views`；新增 `ok 19 - R-06` |

### 3.2 授权面与文件集合

`git show --name-only 3886927` = `desktop/ui/app.js`、`src/daemon/http/server.js`、`test/wp13/errors.test.js`、`test/wp13/http-channel.test.js`——与裁决 R「影响文件」四项逐字一致，无集合外改动，禁改面（`src/core`/`src/cli`/`src/persistence`/`http/{routes,stream,labels}.js`/`desktop/ui/{list,graph,board,labels}`/`index.html`/`spawn.rs`/`package.json`）零 diff。

### 3.3 断言是否被削弱

测试侧删除行共 **8 行**，全部属于被裁决 R 取代的旧用例（`git show 3886927 -- test/ | grep '^-'`）：

```
-test('static /ui/* accepts the query token while the data plane stays Bearer-only', ...)
-  // Decision M / B-25 ...
-      assert.equal(anonymous.status, 401);
-      assert.deepEqual(JSON.parse(await anonymous.text()), { error: 'UNAUTHORIZED' });
```

即「static 匿名 401」这一条按 R.1 **被有意反转**为 200；而同一用例里 `/ui/labels?token=` 的 401 断言逐字保留，并**新增** `/ui/app.js` 匿名 200 与正文一致、`/ui/labels` 匿名 401、`/instances` 匿名 401 三类断言。数据面 AC 断言无一条被删弱，新增 3 条（R-04×2、R-06×1）全部是加强。

### 3.4 机械项

| 检查 | 结果 |
|---|---|
| `desktop/ui` 零 CJK | 17 文件 0 命中 |
| 零依赖 | `dependencies/devDependencies = 0/0` |
| `grep -REn "saveState\|emit\(" src/daemon/graph.js` | 零命中（rc=1） |
| 测试专用分支（`NODE_ENV`/`process.env`/`__TEST__`/`isTest`）在 `desktop/ui` | 零命中 |
| purity（45 文件 / 31 词表） | `OK … 零命中`，exit 0 |

## §4 门禁复跑输出（串行）

### ① 四个 wp13 文件

```
env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 \
  test/wp13/http-channel.test.js test/wp13/errors.test.js test/wp13/graph-stream.test.js test/wp13/board.test.js
1..49  # tests 49  # pass 49  # fail 0  # skipped 0  (8974 ms)
ok 48 - decision R: the static face is public while the data plane stays Bearer-only
ok 16 - B-31 seam 2: writeViewOffsets hands the shell the three-field invoke shape
ok 18 - Q-1: the query project reaches state.project.root and the offsets seam
ok 19 - R-06 … ok 20 - R-04 … ok 21 - R-04 …
```

### ② 全量（串行，339.7s）

```
env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
1..1355  # tests 1355  # pass 1349  # fail 5  # skipped 1
not ok 101  - NFR-02: verifyProducts({sha256:true}) p95 <= 50ms
not ok 830  - AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 …
not ok 1049 - task-loop 审核提示词给绝对路径…
not ok 1100 - core.stop：先回包再断连，5s 内收敛…
not ok 1118 - main：--cwd 相对当前 shell 目录解析…
```

**差集结论 = 0**：

- 与主控基线（1355 / 1348 / 6 / 1：NFR-02、task-loop、core.stop、cursor.json 并发、main --cwd、早返回）共有 4 条（NFR-02、task-loop、core.stop、main --cwd）。
- 本评审独有：`AC-04`（`instance-list.test.js:413`，expected `running` / actual `completed`）。已用 **R 之前的快照**归因：`git archive dd178e1` 到 `/tmp/maestro-r3-pre` 单跑同一文件，**同一条断言同样失败**（`not ok 2 … expected 'running' actual 'completed'`），且该文件不在本批 4 文件内、零 diff → 既有测试的时序竞态（round 2 在 `aca57d6` 上亦已复现），非本轮引入。
- 主控独有：`cursor.json 并发`、`早返回` 本次通过 → 同为环境敏感 flake。
- 故两个方向都是 flake 摆动，本批引入的失败 **0** 条；`AC-04` 建议按 R-08 固定登记（本机可稳定复现，说明基线应允许它双向）。

### ③ 架构 / 机械

```
purity src/core,src/daemon,desktop/ui（45 文件，31 词全表） -> OK, exit 0
CJK（desktop/ui）                                          -> 0（17 文件）
deps/devDeps                                               -> 0/0
git show --check 3886927                                   -> rc 0
```

### ④ S-02 端到端（本评审独立起服，`serve-entry --project /tmp/maestro-r3 --desktop`，端口 57206）

```
GET /ui/                         200  text/html
GET /ui/app.js（无凭据）          200  65069 B（与 Bearer 逐字相同）
GET /ui/**（16 module 全图）      200 × 16
GET /ui/labels（无凭据）          401
GET /ui/labels?token=<正确>       401
GET /ui/labels + Bearer          200  keys=147
GET /instances（无凭据）          401
GET /instances/stream（无凭据）    401
GET /instances/INST-001/graph（无凭据） 401
```

## §5 残留项

| # | 级别 | 位置 | 现象 | 建议 |
|---|---|---|---|---|
| R-05 | 建议（已登记，不修） | `server.js:353` | `claimedByHandler` 末尾 `return fallbackDispatcher !== null`：一旦 `routes.js` 改成整路径 `{handle}`（当前 `routes.js:307` 返回数组，未触发），**所有**路径被判 handler 认领，静态公开分支整体失效，R-03 会原样复发（匿名 `/ui/app.js` 变 401、白屏） | 改批 6/7 动 `routes.js` 形态时，把兜底改为「dispatcher 显式声明该路径」，或删除兜底让静态分支参与判定；并保留「匿名 `/ui/app.js` 必须 200」的常备断言（`http-channel.test.js` 已加） |
| R-07 | 建议（已登记，不修） | `app.js:1447-1478` | B-30 只有 `onStatus` 静态判定，无 DOM 级 closed→reconnect 用例 | 批 6/S3 用最小假 DOM 或壳探针补一条 |
| R-08 | 建议（基线） | `test/wp13/instance-list.test.js:413` | AC-04 在本机当前树与 `dd178e1` 快照均稳定失败（mock 完成早于首帧 refetch 的竞态），主控本轮却为绿 | 按「环境敏感 flake」登记进基线（允许双向），或把断言改为不要求首帧 refetch 为 `running` |
| R-09 | 建议 | `app.js:1559-1607` | `takeLocationCredentials` 的文档注释写着第四优先级 `__MAESTRO_DESKTOP__.token`（`app.js:1561`），实现只取 `query ?? storage ?? memory`；实测仅注入 `{port,token}`（无 query/storage）返回 `null`（`F injected token only :: null`）。`dd178e1` 时该路径可用，属行为回退（当前壳只走 query，故不影响验收） | 二选一：接回 `injected.token`（也让 R-03 的 init-script 备选方案继续可用），或删掉注释里的第四源描述；并补一条 `__MAESTRO_DESKTOP__.token` 的用例 |
| R-10 | 建议 | `app.js:1585-1592` ↔ `spawn.rs:186-195` | reload 只恢复 token，不恢复 project：`replaceState` 把 URL 抹成 `/ui/`，sessionStorage 只有 token → 重载后 `resolveMountProject` 得 `null`，首屏变成「项目 未指定」提示页。实测 `R-06 real reload (token restored, project lost) :: {"creds":"tok-reload","mountProject":null,"view":"project"}`。R-04 只要求 token 恢复（已达成），但「重载后仍在原项目」未达成 | 壳侧在 reload 前重新导航（带 `?token&project`），或页面侧把 project 记入第二个 sessionStorage 键（需追加裁决 R.3 的存储范围）；S3 打开窗口前请按当前行为校准预期 |
| R-11 | 建议 | `app.js:171-183` | `initialProject` 的兜底条件是「既无 `view` 又无 `root`」，因此 `{view:'instances'}` 且无 root 的摘要会绕过守卫、直接进列表空态（实测 `view:"instances"`, `operable:true`）。当前无调用方这样构造（全仓 `view: 'instances'` 零命中），属不可达边界 | 若要严格贴合 AC-31 的「无 root 必提示」，改成「root 不可用即 `resolveProject`」，`view` 字段不得单独豁免；顺带补一条 `{view:'instances'}` 用例 |

观察（非残留，随裁决 R.1 的预期结果，不必修）：

- `GET /ui/?token=deadbeef` 现在返回 200（静态面公开，错令牌不再被挡）；页面会带着错令牌去取数据面，表现为连接失败，而不是白屏。与 R.1 自洽。
- `GET /ui/<不存在的文件>`（无凭据）返回 401 而不是 404——静态面判定以「真实文件」为准，未知路径落回 Bearer 分支；不泄露数据（静态树本身即公开源码）。
- `/ui/labels` 的响应不再接受 query 令牌，壳侧若还有别的 `?token=` 数据请求会退化为 401；本轮全仓核对只在静态导航使用 query，无其它调用点。

## §6 能否进批次 6（WP-9）

**可以进。** 阻断已清零：模块图 16 个文件匿名 200 且正文与 Bearer 逐字相同（AC-30「不白屏」、AC-31 首屏、AC-22 视图偏好、AC-01/26 的窗口面重新可达），数据面 5 条 401 断言仍成立，R-04/R-06 的行为均有本评审独立复现记录，回归面无回退，门禁差集为 0。

进批 6 前建议主控注意三点（均不阻断）：

1. R-05 是**单点定时炸弹**：批 6/WP-9 若有人动 `src/daemon/http/routes.js` 的导出形态（数组 → `{handle}`），静态面公开会整体失效而测试未必第一时间喊疼——`http-channel.test.js` 的「匿名 `/ui/app.js` 200」用例是唯一护栏，别删。
2. R-10：S3 的「双击即用 → 重载」预期请按当前行为写（重载会到「项目 未指定」），否则验收现场会误判为回归。
3. R-08（AC-04）本机稳定失败、主控机器通过，建议在 S3 前把基线口径写成「环境敏感 flake，允许双向」，避免每轮都重新归因。
