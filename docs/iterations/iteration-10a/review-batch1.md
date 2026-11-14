# I1.10a 批次 1 实现评审记录（WP-7 + WP-4）

## §0 总判

- **总判：FAIL**（阻断 1 / 建议 3）。
- **评审对象**：`e4f22d0`（WP-7 桌面文案键底座）+ `5c9ffac`（WP-4 图投影引擎）；基线父提交 `1959935`。
- **复核方式（评审岗实跑命令清单）**：
  1. `git show --stat e4f22d0` / `git show --stat 5c9ffac` / `git diff --name-only e4f22d0~1 5c9ffac`
  2. `git diff --stat e4f22d0~1 5c9ffac -- src/core src/cli/main.js src/cli/render.js src/persistence src/templates src/registry src/cli/labels.js package.json bin test/fixtures` → 输出为空（禁改清单零 diff）
  3. `node -e "Object.keys(require('./package.json').dependencies||{}).length"` → 0（devDependencies 亦 0）
  4. `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词全表>` → exit 0（27 文件零命中）
  5. `grep -REn "saveState|emit\(" src/daemon/graph.js` → 零命中（exit 1，ERE 形态）
  6. `grep -REn "if host ==|switch \(host\)" src/daemon/ desktop/harness/` → 零命中（exit 1）
  7. `NODE_ENV=test node --test "test/**/*.test.js"`（串行单跑，裁决 F）→ 1214 tests / 9 fail
  8. 超基线失败单独复跑：`test -f test/wp9/cli-e2e.test.js && NODE_ENV=test node --test test/wp9/cli-e2e.test.js` → 4/4 全绿（负载型 flake，不计入差集）
  9. 4 个新增 wp13 测试按 `test -f` 固化形态单独复跑 → 25+18+8+6 = 57 全 pass
  10. 同源对比脚本（CLI `renderGraphJson` vs 桌面 `buildGraph`，code-loop 夹具实例，见 §3⑦）
- **唯一阻断**：B-01（WP-7 越权新增 `src/daemon/http/labels-route.js`，见 §6）。

## §1 边界合规

| 项 | 结论 | 依据 |
|---|---|---|
| ① WP-4 文件集合 | **PASS** | 5 文件与拆分 §4 WP-4 清单逐一精确一致：`src/daemon/graph.js`、`test/wp13/graph-projection.test.js`、`test/wp13/edge-aggregate.test.js`、`test/wp13/edge-visual.test.js`、`desktop/harness/graph-dump.mjs` |
| ① WP-7 文件集合 | **FAIL（B-01）** | 实际 3 文件：`labels.js` / `labels-desktop.test.js` 与裁决 E 口径一致，但多出 `src/daemon/http/labels-route.js`——既不在 D-10 新增文件授权清单（`src/daemon/http/{server,routes,stream,labels}.js`）、也不在拆分 WP-7 负责文件清单；且其导出的 `{method,pattern,handler}` 路由描述与 S-02 接缝（WP-2 `registerRoutes`/`registerLabels`、WP-3 `routes.js`）的形状职责重叠 |
| ② 禁改清单 | **PASS** | `git diff e4f22d0~1 5c9ffac -- <禁改路径>` 全部为空；`src/cli/labels.js` 零改动符合裁决 E；既有测试文件零改动（改动全集 = 8 个新增文件） |
| ③ 零 npm 依赖 | **PASS** | dependencies = 0、devDependencies = 0，两笔提交未触 package.json |

## §2 WP-7 键契约核对表

| 项 | 结论 | 说明 |
|---|---|---|
| ① 键全集 vs 附录 A-0~A-14 | **PASS（带 2 条建议偏差）** | 61 新增键 + 83 复用键 = 144；A-1~A-13 全部样例行经 `fill()` 渲染逐字断言（全角冒号 `子工作流：`、` · ` 分隔符、`{xx}` 占位名逐一对上）；偏差见 B-03（`DESKTOP_BOARD_COLUMNS` 键名）、B-04（空态/不可读新造键） |
| ② 占位符纪律 | **PASS** | 冻结测试含字面替换与缺参保留原样断言（`fill('宿主 {hosts}', {})` → `宿主 {hosts}`），只替换、不转义、不加工 |
| ③ 复用键平铺同源 | **PASS** | `flattenTable('表名_成员名')` 与 `src/cli/labels.js` 十张表成员一一对应；测试以独立成员名清单锚定「既有键计数与内容逐字不变」（`HEALTH_REASON.node_timeout`、`ERROR_TEMPLATE.PRODUCT_LINE_MISSING`、`DIR_BUSY` 等逐字锚点齐全）；`USAGE_LINES` 仍 25 行 |
| ④ 冻结测试键集合断言 | **PASS** | `deepEqual(Object.keys(UI_LABEL_KEYS).sort(), EXPECTED_ALL_KEYS)` + 数量 144 断言，多键/少键都 fail；期望清单为显式手写清单，非实现自证 |
| ⑤ AC-28 锚点 | **PASS** | CJK 扫描（desktop/ui + desktop/harness，含注释，正则口径含 CJK 标点/兼容区）、`/ui/labels` 覆盖契约键集合、新增键非空、deps 为空四段机检均在 `labels-desktop.test.js` 内落实 |
| ⑥ 词表外中文落点 | **PASS（带 1 条建议）** | `desktop/**`（harness/graph-dump.mjs）CJK 零命中；`src/daemon/graph.js` CJK 零命中；`labels.js` 中文 = 裁决 E 既定口径不挑；`labels-route.js` 10 行中文注释随 B-01 处理（B-02） |

## §3 WP-4 投影契约核对表

| 项 | 结论 | 说明 |
|---|---|---|
| ① `buildGraph` 形状 vs D-2 / §3.4 | **PASS** | 返回 `{rev, instanceId, template, state, workflow:{ref,readable}, nodes[], edges[]}`；节点含 D-2 全部字段（emptyNode 统一形状，含 `nodeIds`/`memberCount`/`collapsed`/`lastActivity`）；边含 `{id,from,to,direction,aggregateStatus,handoffIds[],parallelCount,latestRound,visual{color,dash,arrow,animation,badge},labelVisible}`，与 §3.4 样例逐字段一致；附加字段 `round`/`maxRounds`/`group`/`workflow`（subworkflow 引用）为下游消费所需，不违反样例 |
| ② 纯函数（AC-07 架构锚点） | **PASS** | `grep -REn "saveState|emit\(" src/daemon/graph.js` 零命中（exit 1，ERE）；不读盘（数据全部入参）、不取系统时间（`now` 形参保留、`void now`，仅 `Date.parse` 解析入参字符串）、不写盘；确定性 + 输入不可变有专项测试 |
| ③ 四类 node_type 节点形状 | **PASS** | role（角色实例单位，`role:<roleId>`）、human/escalate（定义层 + `state.nodes` 缺失落 `pending`）、subworkflow（`workflow` 引用 + `memberCount` 子定义角色去重数（夹具 C-003/C-004 同角色去重为 3）+ 子定义缺失 `memberCount:null` 灰色 + `collapsed:true`）、group（仅 >12 生成，节点与成员同时存在、`nodeIds` 指回成员）；未知 `node_type` 按 role 渲染保留 ID 有专项测试 |
| ④ edges 聚合 | **PASS** | 7 态 `AGGREGATE_PRIORITY` 顺序与 A-11/AC-16 一致且 7×7 表驱动锁定；回流弧线 `direction:'backflow'` 独立成线、无第三条同向线；`parallelCount` 只数最新轮（多轮回流「只体现最近一轮」§2.8 口径，同轮并行才计并行——口径自洽且有专项测试 `parallelCount counts only the latest round`）；`handoffIds` 全轮保留、`latestRound` 取最大轮；无交接包定义边落 `not_started`；无定义边支撑的交接包不画线 |
| ⑤ rev 白名单 | **PASS** | `REV_WHITELIST = {node, handoff, escalation, instance, special_node}`；核心事件 `object` 实测全集为 `{approval, escalation, handoff, health, instance, node, session}`，session/execution/health/approval 结构性排除；专项测试断言 seq 25（白名单最大）且 session/execution/health 事件不推进、无白名单事件 rev=0；`special_node` 为核心尚未产生的前向兼容条目，无害 |
| ⑥ 角色六态→五 token 映射 | **PASS** | `busy→serving`、`retired→inactive`、其余恒等（available/cooldown/unavailable），与 §2.6 五态用户可见语义一致；缺注册表「图声明即已知」有专项测试（`omega` 落 `inactive` 而非 `unavailable`） |
| ⑦ 与 CLI `renderGraphJson` 同源 | **PASS** | 实跑对比（code-loop 夹具实例）：CLI 2 定义节点全部被投影覆盖（role 型映射 `role:<roleId>`）、3 条定义边全部有对应投影线（forward+retest 同向合并、backflow 独立）；投影多出的 `role:coordinator` 来自模板 `graph.roles` 声明（D-3「图声明即已知」正确行为） |
| ⑧ AC-14 层号锚点口径 | **PASS** | 批次 1 的 AC-14 断言只做拓扑面（节点/边集合、dangling=0、回流独立、subworkflow 折叠信息），未断言层号；层号 `{T-001:0,…}` 按 AC-14 机检归属 `graph-layout.test.js`（WP-5，批次 3，拆分 §4 WP-5「协作 AC-14 层号断言」）——批次 1 无错位断言，口径自洽；提醒：WP-5 实现时布局消费的是投影 ID（`role:dev`）而非定义 ID，届时夹具需按投影 ID 对齐 |

## §4 测试质量

| 项 | 结论 | 说明 |
|---|---|---|
| ① 目录与既有测试 | **PASS** | 4 个新测试文件全部在 `test/wp13/`；既有测试零改动（§1②） |
| ② 断言锚定需求原文 | **PASS** | AC-07（8 节点 9 边/悬空 0/类型状态/方向聚合状态，图例两行按 S-03 后置并有注释声明）、AC-14（拓扑完整四边全画）、AC-15（A-11 七态 token 逐项 + `hidden` 开关，期望表手写在测试内而非 import 常量）、AC-16（2 边/`rejected`/`parallelCount===2`/7×7 优先级表驱动）、AC-28（§2⑤） |
| ③ `test -f` 形态 | **PASS** | 4 个文件均以 `test -f … && node --test` 固化形态复跑通过（`# pass ≥ 1`、`# fail 0`）；无文件存在性假通过风险 |
| ④ BRE `\|` 假通过 | **PASS** | 新增文件无任何 `grep` 调用；本次评审所有扫描均为 ERE/rg/Python 口径 |
| ⑤ 顺序依赖/共享状态 | **PASS** | 纯内存投影 + `mkdtempSync` 一次性临时根 + `finally` 清理；无跨用例共享可变态、无 sleep 硬等 |

## §5 门禁复跑输出（串行，裁决 F）

```
1) 全量测试（基线父提交 1959935 之上）
   NODE_ENV=test node --test "test/**/*.test.js"
   → # tests 1214  # pass 1204  # fail 9  # skipped 1   （基线 1157 / 8；条数只增 ✓）
   失败集合与 docs/iterations/iteration-7/baseline-failures.txt 差集：
   - 基线 8 条全部逐字命中
   - 超基线 1 条：「C-2 端到端：tool_running 的 status 会话行含"已运行 Ns"（N>0）」
     归因（裁决 F 单独复跑）：test -f test/wp9/cli-e2e.test.js && NODE_ENV=test node --test test/wp9/cli-e2e.test.js
     → 4/4 全绿（exit 0）。该条为时序型负载 flake（既有 wp9 文件，两笔提交未触碰），不计入差集。
   ⇒ 差集 = 0 ✓
2) 31 词全表扫描
   node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <D-7 31 词逐字>
   → OK（27 文件零命中）exit 0 ✓
   第二轮 --dirs desktop/ui → 「目录不存在」exit 2：desktop/ui 尚无任何文件（WP-5/6/8 未落地），
   批次 1 时序下第二轮不适用；批次 3 起必须补跑两轮口径（B-05 备注，非缺陷）。
3) 零依赖
   node -e "Object.keys(require('./package.json').dependencies||{}).length" → 0 ✓（devDependencies 亦 0）
4) AC-07 架构锚点
   grep -REn "saveState|emit\(" src/daemon/graph.js → 零命中（exit 1）✓
新增测试单独复跑（test -f 固化形态）：
   labels-desktop 25/25 · graph-projection 18/18 · edge-aggregate 8/8 · edge-visual 6/6（共 57，全 pass）
```

## §6 修复清单

| 编号 | 位置 | 原文/事实 | 违反哪条 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| B-01 | `e4f22d0` 新增 `src/daemon/http/labels-route.js`（40 行，导出 `UI_LABELS_PATH`/`labelsResponseBody`/`respondUiLabels`/`createLabelsRoute`） | WP-7 实际文件集合比裁决 E 口径多出该文件 | 拆分 §4 WP-7 负责文件清单（2 文件）+ D-10 新增文件授权清单穷尽性（`src/daemon/http/{server,routes,stream,labels}.js`）；与 S-02 接缝的 `registerRoutes`/`registerLabels`（WP-2）与 `routes.js`（WP-3）职责形状重叠 | 删除该文件；`labels-desktop.test.js` 改为只测 `labelKeysPayload()`（S-02 注入/惰性 import 承接属 WP-2 的接缝测试面，响应头等 HTTP 语义由 WP-2 判定）；`UI_LABELS_PATH` 路径常量归 `http/server.js`（拆分 §2.1 已定） | **阻断** |
| B-02 | `src/daemon/http/labels-route.js:1-9` 等 10 行中文注释 | src/daemon/** 出现 CJK 注释 | 拆分 §2「所有新增/改文件…src/daemon/** 禁 CJK」（裁决 E 只授权键表文件 `labels.js` 的中文键值） | 随 B-01 删除自然消除；若主控裁定保留该文件，则注释改英文 | 建议 |
| B-03 | `src/daemon/http/labels.js:95-101` | 需求 A-14 / 拆分 §2.4 点名键 `DESKTOP_BOARD_COLUMNS` 未按名落地，改为 7 个 `DESKTOP_BOARD_COLUMN_*`（看板七列文案全覆盖、逐字一致） | A-14 键名冻结契约（键名全集是下游 WP-5 的取值依据） | 批次 3（WP-5 board.js）开工前请主控二选一：① 补需求修订把 A-14 该行改为 `DESKTOP_BOARD_COLUMN_*` 前缀族；② labels.js 增补 `DESKTOP_BOARD_COLUMNS` 聚合键。未裁决前 WP-5 不得自行动键名 | 建议 |
| B-04 | `src/daemon/http/labels.js:38-39`（`DESKTOP_LIST_EMPTY` / `DESKTOP_LIST_UNREADABLE`） | A-14 空态/不可读行归属写「复用 `INSTANCE_EMPTY` / `renderInstanceUnreadable` 的文案」，但 `INSTANCE_EMPTY` 键在 `src/cli/labels.js` 不存在、不可读文案是 `src/cli/render.js:309` 内联拼接 | A-14 归属表述（实现新造两键、值逐字一致，行为面达标） | 登记裁决留痕（代码现状使「复用既有键」不可满足，冻结面不允许改 render.js）；或在需求修订中把 A-14 该两行改为点名 `DESKTOP_LIST_EMPTY`/`DESKTOP_LIST_UNREADABLE` | 建议 |

备注（非 B 项）：`labels.js` 新增键中 `DESKTOP_PLACEHOLDER`/`DESKTOP_EDGE_NOT_STARTED`/`DESKTOP_EDGE_DIRECTION_*`/`DESKTOP_EDGE_ROW_ACCEPTED_HOVER`/`DESKTOP_QUIT_CONFIRM_QUIT|_CANCEL`/`DESKTOP_LIST_FIELD_*` 超出 A-14 点名清单，但均在 `DESKTOP_*` 通配组内且为 A-0/A-4/A-5/A-6/A-9/A-11 逐字文案所必需，冻结测试已按精确集合锁定，不另立项。
