# I1.10a 批次 3 实现评审记录（WP-3 / WP-5 / 裁决 H 落地）

> 评审角色：实现评审工程师（只读；本文件为唯一写入产物）
> 评审依据：`docs/iterations/iteration-10a.md`（r2）、`requirement.md`（v2）、`decisions.md`（裁决 A~H，含 G 更正段）、上游冻结契约 `e4f22d0` / `5c9ffac` / `f0fee5c`
> 评审对象：
> - `5b5640c` I1.10a WP-3：实例列表 + 新建实例 REST 路由与 UI 渲染纯模块（9 文件）
> - `baf23f8` I1.10a WP-5：布局 / 视图 / 图例 / 看板纯模块（12 文件）
> - `480a12e` I1.10a WP-3 fix(H)：`test/wp13/http-channel.test.js` 503 断言按裁决 H 修改（1 文件）

## §0 总判

**PASS**（阻断 0 / 建议 9）。批次 3 三笔提交在文件边界、WP-3 与 WP-5 契约、裁决 H 落地、测试与门禁四个面上均成立；未发现需要回退或改需求的缺陷，建议项集中在断言形态、契约文本落点与门禁扫描口径，可在批次 4 开工前/并行消化。

复核方式（全部实跑，本机 macOS / Node v22）：

```bash
# 1) 批 3 十个测试文件（裁决 F：串行）
NODE_ENV=test node --test --test-concurrency=1 \
  test/wp13/instance-list.test.js test/wp13/new-instance.test.js test/wp13/health-hover.test.js \
  test/wp13/graph-layout.test.js test/wp13/legend.test.js test/wp13/view-state.test.js \
  test/wp13/board.test.js test/wp13/board-unknown.test.js test/wp13/focus-mode.test.js \
  test/wp13/http-channel.test.js
# 2) 全量（串行单跑）
NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
# 3) 超基线/基线内失败归因单跑
NODE_ENV=test node --test --test-concurrency=1 test/wp10/perf.test.js
NODE_ENV=test node --test --test-concurrency=1 test/wp7/wp7.test.js
# 4) 边界：逐路径 git diff、文件集合 git show --name-only
# 5) 门禁：purity 三轮（31 词全表逐字复制）+ CJK 扫描 + deps=0 + 四条 ERE grep
```

## §1 边界合规（PASS）

| 项 | 结论 | 证据 |
|---|---|---|
| ① 文件集合 vs 拆分清单 | **精确一致** | `5b5640c` 9 文件 = WP-3 清单（`routes.js` + `list/{list,new-instance,health-hover}.js` + `harness/{collect,render-list}.mjs` + 3 测试）；`baf23f8` 12 文件 = WP-5 清单（`graph/{layout,view,legend}.js` + `board/board.js` + `harness/{layout-dump,board-dump}.mjs` + 6 测试）；`480a12e` 恰 1 文件。三笔均为全新增，除 `480a12e` 外零删除/零改写 |
| ② 禁改清单 | **零触碰** | `git diff --name-only 5b5640c~1 480a12e -- <path>` 逐路径核对：`src/core` / `src/cli` / `src/persistence` / `src/registry` / `src/templates` / `package.json` / `bin` / `test/fixtures` / `src/daemon/http/{server,stream,labels}.js` / `src/daemon/graph.js` / `src/daemon/server.js` / `src/daemon/serve-entry.js` 全部 = 0 个文件 |
| ② 批次 1/2 既有测试 | **仅授权文件** | `comm` 比对 `5b5640c~1` 与 `480a12e` 的 `test/` 树：删除 0；内容变化仅 `test/wp13/http-channel.test.js`（裁决 H 授权），其余既有测试逐字节相同 |
| ③ 零 npm 依赖 | **成立** | `package.json` 零改动；`node -p "...dependencies..."` → `0`；12 个新文件只 import `node:*` 与仓库内相对模块 |

## §2 WP-3 契约核对（PASS）

| AC / 项 | 判据 | 证据 | 结论 |
|---|---|---|---|
| AC-03 六项固定 + 排序 | 四行逐字 A-1（v2 顺序 INST-001/003/004/002）、排序 `attention,slow,normal,ended`、同档 `updatedAt` 倒序、`待处理 0` 显示、`single`→`单节点`、CLI 零反向修改 | `test/wp13/instance-list.test.js:40-45,262-326`（真实 daemon → `collect.mjs` → `render-list.mjs` → `assert.deepEqual(lines, A1_ROWS)`；`sortInstances` 同档三条 A/B/C 断言）；`desktop/ui/list/list.js:82-88,109-132`；`TEMPLATE_LABEL_SINGLE='单节点'` | PASS |
| AC-04 空态 / 不可读 / 实时 | `实例 无`、`实例 {id} · 状态不可读` 不阻断、2 秒内由 `instances.changed` 触发 refetch、静默窗零帧 | `instance-list.test.js:345-360`（空态 + 损坏 `state.json`）、`:362-462`（帧驱动消费者、`firstAppearance.refetchT-postDone ≤ 2000`、`awaitFrameQuiet` 后零新帧、帧名恒 `instances.changed`） | PASS |
| AC-05 新建成功 | `GET /workflows` 恰三模板（顺序/标题逐字）、`POST /instances` 回 `{instanceId}`、2 秒入列、与 CLI 状态词/健康度词逐词相等、只新增一例 | `new-instance.test.js:182-271`（`assert.deepEqual(workflows.body.items,[{single,单节点},…])`；`rowFields[2]===cliFields[1]`、`rowFields[5]===cliHealthLine 词`；重复启动 → `DIR_BUSY` 且实例数不变） | PASS |
| AC-06 校验 / 失败 | 两条校验逐字、缺产物行既有原文逐字、`启动失败 · {reason}`、无堆栈、实例数不变 | `new-instance.test.js:135-176`（`请选择工作流` / `请填写任务说明` / `PRODUCT_LINE_MISSING` 原文 / 缺参保留 `{reason}`）、`:277-319`（坏 `launch.command` → 422 `DSH_SPAWN_FAILED`、两次失败均零实例） | PASS（第三路为模块级，见 B-14） |
| AC-31 项目提示页 | 文案逐字 `DESKTOP_PROJECT_*` | 键值实测：`项目 未指定 · 请填写项目目录` / `项目 不可用 · {path}`；该 AC 主责 WP-1/WP-8，本批文件面无落点，未越权实现 | PASS（N/A） |
| AC-32 八类原因 | 8 行逐字 A-7、第 9 例 `健康度 正常`、只透传不重算、无自造句 | `health-hover.test.js:21-122`（8 例逐字 + normal + 模板替换即改变输出 + 缺参保留 + 未知码退裸行）；`desktop/ui/list/health-hover.js:63-77`；`routes.js:129-139` 直读 `snapshot.health`，无档位重算 | PASS（接线强度见 B-08） |
| 消费纪律 | 平铺键名、无裸字面量、占位符字面替换、键值共享引用不改写 | `list.js` 无 `'single'`/`'code-loop'` 字面量，经 `TEMPLATE_LABEL_<X>` / `INSTANCE_LABEL_<X>` / `HEALTH_LABEL_<X>` 取值；`fill()` 均走 `hasOwnProperty`；`new-instance.js:21-25`、`health-hover.js:29-33`、`board.js:61-65` 同一纪律；`legend.test.js:70` 断言共享键未被改写 | PASS |
| 批 3 后置校验（REST 接缝） | 起 server → 注入 → 200 真数据 → POST 真启动 | 注入面：`http-channel.test.js:272-365`（`registerRoutes(createRoutes(...))` → `GET /instances` 200 + 逐字段 deepEqual、`GET /workflows` 三 id、POST 200 且 `startRun` 恰 1 次）；生产面：`instance-list.test.js` / `new-instance.test.js` 以 `serve-entry --desktop` 起真 daemon（lazy dynamic import 承接）→ 200 真数据 + `POST` 真启动 | PASS（注入口为 stub 编排器，真启动走 lazy 面，见 §4） |

补充说明（非缺陷，登记以免后续误判）：

- 拆分 §2.1 把 `GET /instances/:id/graph` 写在 `routes.js` 名下，实际由 WP-2 `http/server.js:369-381` 内置实现，`routes.js` 头部（`:22-23`）显式声明「不重复实现」。行为面无缺口（AC-07/14 由 WP-2 测试与 `graph-layout.test.js:148-196` 覆盖），属文件归属与拆分文本的落点差异。
- `POST /instances` 的 `cwd` 在 S-02 注入签名（只有 `orchestrator`/`loadWorkflowDef`）下由 `process.argv` 的 `--project` 解析（`routes.js:186-198`）。生产链路（壳 spawn 与测试 spawn）都带 `--project`，已被 `instance-list.test.js:377` 的真实 POST 证明可达；属签名缺口下的可用兜底，见 B-10 之外的说明。
- `deriveHealthReasonVars`（`routes.js:79-126`）与 `src/core/status-text.js:168-214` 规则逐条一致（含 `reasonVars` 优先与 `running` 节点取参），当前无口径分叉；重复实现属维护风险（见 B-08）。

## §3 WP-5 契约核对（PASS）

| AC / 项 | 判据 | 证据 | 结论 |
|---|---|---|---|
| AC-17 层次布局 | 常量 180/80/240/140/40、层号 A0/B1/C1/D2、x=0/240/240/480、同层 y 不等、回流不推层且 `arc`、两次 `JSON.stringify` 字节相等 | `layout.js:25-32,56-123,129-146`；`graph-layout.test.js:60-110`（含回流 ctrl 公式与「输入不被改写」） | PASS |
| AC-18 异常置顶 | 坐标/尺寸差集空、`z` 差集恰 `{B:1}`、相连边 z 同步提升、解除还原 | `layout.js:121,127-131`；`graph-layout.test.js:112-146`（`geometryDiff=[]`、`zDiff={B:1}`、边 z 与 `path` 不变、还原后逐字节相等） | PASS |
| AC-20 缩放平移 | 150%→270、布局坐标不变、复位 100%/(0,0)/清偏移、夹取 0.5/2.0、可逆 | `view.js:141-171`；`view-state.test.js:48-95`（含 `BASE_NODE` 未被改写的 deepEqual） | PASS |
| AC-21 2 跳聚焦 | 可见恰 `[B,C,D]`、边两端可见、标题 `聚焦 C（2 跳）`、Esc 恢复、坐标不变 | `view.js:88-106,187-198`（`⌊hops/2⌋`，按裁决 H 维持）；`focus-mode.test.js:46-91` | PASS（裁决 H 口径，不再复议） |
| AC-22 视图持久化 | 文件形状、重开 = 基础+(40,60)、跨实例隔离、两文件哈希相等；`desktop/ui` 不 import `instanceDir|statePath` | `view-state.test.js:97-144`；门禁 `grep -REn "instanceDir|statePath" desktop/ui` → exit 1；`grep -REn "Date[.]now|fs[.]" desktop/ui` 仅注释命中且 layout.js 零命中 | PASS（写入端覆盖见 B-15） |
| AC-24 看板 7 列 | 列名顺序逐字、`pending`→blocked/ready、`cancelled` 折入 done 计 2、卡片集合、视图状态不变、9 态全覆盖 | `board.js:39-58,184-208`（`blocked/ready/assigned/running/review/done/failed/escalated` + `cancelled` 特判 = 基线 9 态）；`board.test.js:70-106,152-191` | PASS |
| AC-34 图例 | 两行逐字 A-8、anchor `bottom-left`、offset 固定、锚点只随画布、顶层 | `legend.js:23-27,40-61`；`legend.test.js:27-71`（`lines` 逐字 + 键值同源 + JSON 可序列化 + `legendPoint` 忽略 zoom/pan） | PASS（三态断言强度见 B-13） |
| AC-35 未知状态 | 落 `blocked`、标注 `状态未知`、卡片 3 张、不崩、视图不变 | `board.js:191-198,228-231`；`board-unknown.test.js:52-121`（经 `board-dump.mjs` 导出，`unknownTag === DESKTOP_BOARD_UNKNOWN_STATE`） | PASS |
| ⑨ 节点 ID 口径 | 投影 ID `role:<roleId>` 与布局/看板对齐 | 实测 `buildGraph` 输出 `role:alpha`、`nodeIds: []`；`layout.js` 对 id 透明（`centerById` 键即原 id）；`board.js:84-119` 用 `nodeIds` → 同 `roleId` 快照节点兜底；`board.test.js:116-150` 用真投影断言 `T-002→ready / T-003→blocked / title='beta'` | **无断裂** |
| ⑩ 图例形状可供批 4 消费 | 惰性动态 import 可消费、JSDoc 写清 | `renderLegend` 返回纯 JSON `{anchor,layer,offset,lines}`，`legend.test.js:42` 断言 JSON 往返相等；`graph-dump.mjs:171` 的 `legend: null` 槽位可直接落该对象 | PASS（输入形状表述见 B-07） |

## §4 裁决 H 落地核对（PASS）

| 项 | 结论 | 证据 |
|---|---|---|
| ① 只改断言段 | **成立** | `480a12e` 全文件仅 1 个 hunk（`@@ -217,33 +219,147 @@`），替换原用例 `REST routes owned by WP-3 degrade to a structured 503 NOT_READY` 为双形态用例；文件其余 11 个用例逐字节未动，无删除、无 `skip`、无放宽他处断言（`+138/-22` 全部来自双形态扩写） |
| ② 双形态断言 | **实质成立，一处减弱** | 形态一（未注入）：`GET /instances`、`GET /workflows`、`POST /instances` 均 503 `{"error":"NOT_READY"}`；形态二（注入）：`registerRoutes(createRoutes({orchestrator, root}))` → `GET /instances` 200 + 行逐字段 deepEqual（`health.level:'ok'` 证明未重算）、`/workflows` 三 id、`POST` 200 `{ok:true,instanceId:'INST-NEW'}`、`spy.startRunCalls===1`、参数 deepEqual `{cwd:root,task:'hello',template:'single',earlyReturn:true}`。缺口：形态一以「编排器不提供 `startRun`」代替原显式 `startRunCalls===0` 断言（该形态下 `createRoutes` 直接抛错），见 B-09 |
| ③ 同一链路 | **成立** | 形态二用真 `createHttpServer` + 真 `registerRoutes` + 真 `routes.js` handler 表；只有编排器是实现接缝上的 stub（AC-27 允许的唯一写路径就是 `orchestrator.startRun`），未用假 handler 绕过真实现 |

## §5 测试质量与门禁复跑

| 项 | 结果 |
|---|---|
| 批 3 十文件串行 | `# tests 56 / # pass 56 / # fail 0`（23.9s） |
| 全量串行 | `# tests 1291 / # pass 1284 / # fail 6 / # skipped 1`（834s）；skip 为既有平台项 `pipeName 对 Windows 路径大小写不敏感 # SKIP`（非本批） |
| 失败集合 vs 基线 8 条 | `core.stop…`、`cursor.json 并发…`、`main：--cwd…`、`task-loop 审核提示词…`、`NFR-02 verifyProducts p95`、`早返回：turn-delay 3000ms…` —— **全部 ∈ 基线 8 条，差集 = 0**（另 2 条基线项 `readReview p95`、`自动拉起` 本次通过） |
| 超基线失败 | 无。基线内的 2 条额外失败已归因：`test/wp10/perf.test.js` 单跑 `2/2 pass`（负载型）；`test/wp7/wp7.test.js` 单跑 `4/5`（`早返回` 为既有基线失败）。与主控 4 条观测的差异属负载抖动，不影响差集判定 |
| 测试位置与既有测试 | 新增 9 个测试文件全在 `test/wp13/`；既有测试仅 `http-channel.test.js` 按裁决 H 修改 |
| BRE `\|` 假通过 | 十个文件零命中；断言全为 `assert.*` / `deepEqual` |
| 跳过/恒定真 | 无 `.skip` / `.todo` / 恒真断言 |
| purity 31 词（逐字复制需求 D-7） | `src/core,src/daemon` 29 文件 exit 0；`desktop/ui` 7 文件 exit 0；`desktop/harness` 5 文件 exit 0 |
| 零依赖 | `dependencies` 键数 = 0 |
| CJK | `desktop/ui` + `desktop/harness` 全部 0 命中（脚本逐文件核） |
| AC-17 门禁 | `grep -REn "Date[.]now|fs[.]" desktop/ui/graph/layout.js` → 零命中（exit 1） |
| 其它门禁 | `saveState|instance-store|appendSpan` in `src/daemon/http/` → 零命中；`new EventEmitter` → 零命中；`P90|TTL|崩溃` in `desktop/ui` → 零命中；`startRun` in `desktop/ui`+`harness` → 零命中 |

## §6 修复清单（B-07 ~ B-15）

> 均为**建议**级，无阻断。编号接批次 2 评审记录。

**B-07｜`legend.js` 入参 JSDoc 与真实形状不符（批 4 有踩坑风险）**
- 位置：`desktop/ui/graph/legend.js:32-33`、`:45`
- 原文：`@param {...} labels the label key table (DESKTOP_LABEL_KEYS or a /ui/labels payload)`；`lines: [labels?.DESKTOP_LEGEND_ROLE ?? null, ...]`
- 违反：D-2 `/ui/labels` 返回形状是 `{keys:{...}}`，直接传 payload 时两行恒为 `null`；批次 4 `graph-dump.mjs` 惰性 import 后若按 JSDoc 传 payload，会静默产出 `legend.lines=[null,null]`（AC-34/AC-07 断言变空洞）
- 建议修法：JSDoc 改为「flat key table (`DESKTOP_LABEL_KEYS` 或 `/ui/labels` 的 `payload.keys`)」；或在函数内兼容 `labels?.keys ?? labels`。批 4 落地前修
- 严重度：建议（批 4 前置）

**B-08｜AC-32 的 harness / 接口链路未落地，`reasonVars` 派生无端到端断言**
- 位置：`test/wp13/health-hover.test.js:73-78`；`src/daemon/http/routes.js:79-139`
- 原文：测试直接 `{ code: 'node_timeout', nodeId: 'T-001' }` 喂模块；`GET /instances` 的 `health.reasons` 实际对象由 `routes.deriveHealthReasonVars` 现算
- 违反：AC-32 机检「用 harness 对 9 行分别导出悬停态文本…由接口返回的 `health.reasons` 参数渲染」；当前 8 行逐字虽成立，但「接口 → reasons 参数」这一段无断言（派生错节点 ID 不会被发现）
- 建议修法：补一条 `instance-list` 式链路（起 daemon → 写 9 份 `state.health` → `collect.mjs` → `renderHealthHover`）断言 8+1 行；或把 `deriveHealthReasonVars` 抽到可测位置单测其 8 分支
- 严重度：建议

**B-09｜裁决 H 形态一删掉了原「`startRun` 零调用」显式断言，且该形态生产不可达**
- 位置：`test/wp13/http-channel.test.js:222-270`
- 原文：`// no startRun: the WP-3 table cannot be constructed`；原用例的 `assert.equal(spy.startRunCalls ?? 0, 0)` 已消失
- 违反：E② 要求「未注入→503 且 `startRun` 零调用」；现在零调用只因方法不存在（结构上无法计数），且 `attachLazySeams` 的 503 只在 `import('./routes.js')` 抛错时出现（路由文件已在盘上），属不可达配置
- 建议修法：保留该回归护栏但写明「不可达配置/降级兜底」；若需可裁决，改为断言「503 响应体不含任何实例数据 + 项目根下无新实例目录」或对 `registerRoutes` 注入一个恒 503 的失败表并断言编排器未被触达
- 严重度：建议

**B-10｜`POST /instances` 成功体比 D-2 多出 `ok:true`**
- 位置：`src/daemon/http/routes.js:295`
- 原文：`sendJson(res, 200, { ok: true, instanceId: started.instanceId });`
- 违反：拆分 WP-3 契约与 D-2「成功回 `{instanceId}`」；严格按形状断言的消费方（WP-8/批 5）会误判
- 建议修法：去掉 `ok:true`，或在本批回执登记为「对 D-2 的补充」并同步 `http-channel.test.js:352` 的期望
- 严重度：建议

**B-11｜`layout.js` 同层排序用数组下标，未读节点 `order`**
- 位置：`desktop/ui/graph/layout.js:50-53`、`:92-101`
- 原文：`declarationIndex.set(id, i)`（按入参数组序），排序键只有「下标 → id」
- 违反：拆分 §2.2 / D-4「同一层内按定义顺序（`order`）→ 节点 ID 稳定排序」。当前 WP-4 投影恰好按定义序输出节点，所以无行为差；一旦上游重排（如异常置顶/分组前置）同层顺序会漂
- 建议修法：排序键改为 `(node.order ?? index)` → id，并补一条「乱序输入 + order 字段」的断言
- 严重度：建议

**B-12｜`board-dump.mjs` 直接 import 服务端 labels 模块，超出 harness 导入边界**
- 位置：`desktop/harness/board-dump.mjs:25`、`:72`
- 原文：`import { DESKTOP_LABEL_KEYS } from '../../src/daemon/http/labels.js'`
- 违反：拆分 §2.4「harness 均只 import `desktop/ui` 纯模块、自身可做文件 IO」；同批 `collect.mjs` 已用 `--payload` 传 labels，两条 harness 口径不一致
- 建议修法：`labels` 从 `--payload` 读（缺省时由调用方传入），保持 harness 对 `src/**` 零依赖
- 严重度：建议

**B-13｜`grep -Rn "startRun" desktop/` 门禁会被构建产物打红**
- 位置：拆分 §4 WP-3「门禁附加」；实测命中 `desktop/src-tauri/target/release/bundle/macos/Maestro.app/Contents/Resources/src/**`（7 行，均为 bundle 副本）
- 原文：`grep -Rn "startRun" desktop/` **零命中（exit 1）**
- 违反：门禁口径未排除构建产物；本批源码侧（`desktop/ui`、`desktop/harness`）实测零命中，但 S3 按原文复跑会假红
- 建议修法：门禁改为 `grep -REn "startRun" desktop/ui desktop/harness`，或显式 `--exclude-dir=target`
- 严重度：建议（验收口径）

**B-14｜AC-06 第三路只做模块级渲染验证，面板 `open===true` 无断言载体**
- 位置：`test/wp13/new-instance.test.js:156-176`
- 原文：`renderStartFailure({ code: 'PRODUCT_LINE_MISSING', params: {} }, LABELS)` 断言原文
- 违反：AC-06 Then/机检要求「依次点启动…面板 `open === true`、实例数不变」；缺产物行这一路没有经真实 `POST /instances`，面板态属 WP-8，批 3 无载体
- 建议修法：补一条真接口用例（编码闭环仅一行任务 → 422 `PRODUCT_LINE_MISSING` → 渲染逐字 + 实例数不变）；面板 `open` 断言登记到批 5 `errors.test.js`
- 严重度：建议

**B-15｜AC-22 写入端（壳层 `config.rs`）无任何测试，WP-5 侧以夹具直写替代**
- 位置：`test/wp13/view-state.test.js:97-134`；`desktop/src-tauri/src/config.rs:191-197`（`write_view` 写 `{offsets, updatedAt}`）
- 原文：测试自建 `views/INST-001.json` 再回放，`assert.deepEqual(preferences, {...})` 对自造字面量成立
- 违反：AC-22 Then「视图偏好写在 `.orch/desktop/views/INST-001.json`」的写入链路未闭环断言（文件形状与 `config.rs` 实现一致属人工核对）
- 建议修法：批 5/验收补一条「壳命令 `write_view` → 文件内容 → 重开叠加」的跨层断言（或把 `write_view` 经 `--probe` 暴露给 harness）
- 严重度：建议
