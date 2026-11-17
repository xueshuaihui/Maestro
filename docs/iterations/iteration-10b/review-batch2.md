# I1.10b 实现评审报告 · 批次 2（WP-3 纯 UI 模块 + drill-dump）

> 评审对象：`feat/i1.10b-drilldown` 分支、HEAD `b92270b`、WP-3 未提交工作树的 15 个新文件
> 评审 Agent：实现评审 Agent（批次 2，干净上下文，只读；本报告为唯一可写产物）
> 评审日期：2026-11-16
> 判据：`iteration-10b.md` §2.3/§2.4/§3.3~§3.7/§4 WP-3/检查点 2；`requirement.md` v6（AC-05~51 + 附录 A-0~A-10）；`decisions.md`（裁决 H/F4-01/I）；`review-batch1-round2.md` §6；冻结契约 `src/daemon/drill.js` 五导出、`src/daemon/http/labels.js` 63 DRILL_* 键、布局模块
> 原则：自己实跑、不采信自述；每条结论带行号 / 命令输出；阻断只判「越界文件 / 签名不符 / 纯模块约束破坏 / 中文硬编码 / 逐字行不符 / 测试弱化 / 门禁红 / 回归退化」，其余一律建议。

---

## §0 总判（返回格式①）

**总判：PASS。阻断 0 / 建议 4（S-B2-01~S-B2-04，均为建议，无阻断）。**

- 15 个新文件边界精确、既有文件零改动（A）；9 模块 + drill-dump 签名函数名/前二参逐字符合，第三参以 `options={}` 对象承载（功能等价，记 S-B2-01）；纯模块 31 词 purity `exit 0`、CJK `exit 1`（零命中）、零依赖 `0`（B）。
- 63 键零增删、A-1/A-3/A-4/A-5 逐字行经 drill-dump 实跑全通过、10 个未用键归属清晰（C）。
- 四个重点独立核查全部通过（③）；D 维架构检查 29 条零命中 + 4 条正命中全绿；E 维 5 测试 25/25 全绿、无 skip/todo/恒真；F 维门禁全跑通过。
- G 维回归用干净 HEAD worktree 实跑对比：本批次引入新红 = **0**、测试 +25（= 5 新测试全绿条数）、当前失败集合是基线的子集，无回归退化（详见 §1）。

---

## §1 七维逐维结论（返回格式②，逐维一行）

| 维度 | 结论 | 一句证据（实跑 / 行号） |
|---|---|---|
| A 文件边界 | **PASS** | `git ls-files --others` = 恰好 15 个 WP-3 文件（9 UI + drill-dump + 5 test）；`git diff --name-only` 仅 `.workbuddy/memory/MEMORY.md` + iteration-4 evidence 3 个（批次1 已登记 S-05 非产物，本批次未新增）；既有源码/测试零改动 |
| B 签名与纯化 | **PASS** | 10 个导出签名函数名/前二参逐字符合（如 `index.js:27 createDrillView({labels,data,interactions})`、`drill-dump.mjs:67 main(argv=[])`）；31 词 purity `exit 0`（31 文件零命中）、CJK `exit 1`、`node -p deps.length=0`；`decideStatus/cli.labels/fetch/request/document./window./Date.now/fs` 在 drill/ 全零命中；第三参形态差异记 S-B2-01 |
| C 文案逐字 | **PASS** | 63 DRILL_* 键零增删（`grep sort -u wc -l`=63）；A-1 第7行/A-3 六行/A-4 head+证据/A-5 标题+HO-010 行经 drill-dump 实跑逐字相等；10 未用键归属见 §3；drill-dump 自身 CJK 零命中 |
| D 关键规则 | **PASS** | 1 跳无 BFS（dag.js `BFS|bfs|visited|queue`=0）；两次布局 `JSON.stringify` 相等（`drill-dag.test.js:53`）；8 档 `rank[1,2,3,4,5,6,7,8,8]` + assigned 第5档显示折叠（`:76-78`）；HO-010 行时间=时间线末条 09:12:41（dump 实跑）；AC-51 三次只进 connection-panel（`connection-panel.test.js:126`）；四层 1/2/3/4 + 返回 3 次（`subworkflow-drill.test.js:99-106`）；证据不判过期（`expiredAt|ttl|TTL`=0）、方向由 kind（backflow 命中 1 / `state === rejected|expired`=0） |
| E 测试覆盖 | **PASS** | 5 文件覆盖 WP-3 定义全部点（详见 §4）；25 tests 全绿（6+6+5+5+3）、0 skip/0 todo、恒真断言零命中；断言锚点按需求同号 Then（test 名逐条带 AC 号）；来源置换断言 AC-15/39/41 防写死 |
| F 门禁 | **PASS** | 自跑全部 grep（29 条零命中 + 4 条正命中）、31 词双目录 purity exit 0、CJK exit 1、零依赖 0；5 测试全绿；drill-dump 退出码 0/1/2 实跑分流（见 §3）；全量差集见 G |
| G 回归 | **PASS** | 干净 HEAD worktree 全量 1443 tests / fail 17，含 WP-3 工作树 1468 / fail 14：新增红 = 0、+25 全来自 5 新测试、当前失败集是基线子集（少 3 条 CRLF flake）；既有文件/断言零改动。2 条严格口径差集项归因见 S-B2-02 |

---

## §2 四重点独立结论（返回格式③）

1. **`index.js::createDrillView` 承载 `scrollTarget`（AC-06）、`buildDag` 无该字段**：**通过**。`index.js:93` 初始化 `scrollTarget:null`、`:99` `clickNode` 写入；`drill-dag.test.js:63-81` 经 `createDrillView` 断言三次点击 `scrollTarget=A/C/E` 且 highlight 同步。对 `desktop/ui/drill/dag.js` 跑 `grep scrollTarget` **零命中**，其返回对象（`dag.js:142-149`）为 `nodes/edges/lines/bounds/dangling/missingLabels`，无机检对象悬空。

2. **8 档排序、assigned 独立第 5 档（非 round3 否决的 7 档）**：**通过**。`cards.js:13-22 CARD_TIERS = [escalated,failed,running,review,assigned,ready,blocked,done]`（8 档，assigned 第 5）；`:25 STATE_ALIAS={assigned:'running'}` 仅折叠显示词；`drill-cards.test.js:76` 断言 `rank=[1,2,3,4,5,6,7,8,8]`、`:77` `T-012.tier==='assigned'`、`:78` 显示词「执行中」。冻结契约 `src/daemon/drill.js:33` 的 CARD_TIERS 与上一致。

3. **`host-jump.js` 只交付不判定、无真实宿主调用**：**通过**。全文件 import 仅 `../labels/labels.js`；`grep -REn "spawn\(|execFile\(|fetch\(|openHost\(|process\."` **零命中**。`jumpCalls` 由注入 `jumpState.ok` 推导（`host-jump.js:92`）、`sessionChoice:'most-recent-active'` 为描述字段（`:93`）、连点去重仅产出 `dedupeKey/dedupeAt`（`:83,94-95`），未偷做 AC-25/26/33/46 主责判定（WP-5）。

4. **`drill-dump.mjs` 的 `main(argv)` 导出与退出码 0/1/2 分流真实**：**通过**。`drill-dump.mjs:67 export async function main(argv=[])`，node 动态 import 实测 `typeof main==='function'`；实跑退出码：正常 `0`、缺 `--role` `2`、payload 文件不存在 `1`、payload 非对象 `1`（详见 §3 输出）。CLI 输出七字段齐全（`:115-121`）。

---

## §3 C 维与门禁补充证据（逐字行 / 退出码 / 未用键）

### 3.1 drill-dump 逐字行与退出码实跑（脚本构造 §3.3~§3.7 样例夹具，非采信自述）

```
PASS EXIT-OK                      （code=0）
PASS A-1 line7 (roleBar)          角色栏 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 最近 T-002 · 轮次 2/3 · 待校验
PASS A-3 card1 L1/L2/L3           卡片 T-003 …／执行 开发 · 执行中 · 已运行 12m · 工具 write／依赖 T-001 已完成 · 产物 calc.js · 证据 2
PASS A-3 card2 L2                 执行 协调者 · 无会话 · — · 工具 —
PASS A-4 head                     节点 T-003 · 实现登录 · 执行中 · 轮次 1/2
PASS A-4 timeline末               时间线 09:20:12 已升级
PASS A-4 evidence1                证据 1 · artifacts/code/calc.js · 产物 · 可解析
PASS A-5 title                    连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接
PASS A-5 HO-010行                 交接 HO-010 · 第 3 轮 · 已投递 · 09:12:41
PASS A-5 HO-010行时间==时间线末条  09:12:41
PASS A-5 时间线两行               时间线 09:12:40 已构造 / 时间线 09:12:41 已投递（两行时间一致，行时间=末条）
PASS EXIT-BADARG(缺--role)=2
PASS EXIT-READFAIL=1
PASS EXIT-NOTOBJ=1
TOTAL=16 FAIL=0
```

- 注：首次未设 `payload.connection.expandedId` 时 `timelineRows=[]`（CLI 无 `--expand`，展开属交互态，由 `index.js:60` 读 `expandedId`）；补设后两行逐字通过，与 A-5 / AC-19 的 HO-010 时间线基线一致。属契约内行为，不构成缺陷。

### 3.2 63 键完整性与 10 个未用键下游归属

- 63 键逐字值位于 `src/daemon/http/labels.js:124-199`，与附录 A-1~A-10 逐字基线一致（冻结契约，批次1产物，本批次零改）。
- WP-3 15 文件实际引用 53 键；未用 10 键及归属（均在 `test/wp14/labels-drill.test.js` 中被 WP-1 完整断言键值存在，由下游消费）：

| 未用键 | 值 | 下游归属 |
|---|---|---|
| `DRILL_CRUMB_NODE` | `节点 {node}` | WP-4 `drill-entry`/`special-node-jump` 节点层面包屑拼装（A-8） |
| `DRILL_VIEW_BACK_GRAPH` | `返回流程图` | WP-4 `app.js` 返回导航（契约 A3） |
| `DRILL_VIEW_BACK_DRILL` | `返回角色下钻` | WP-4 `drill-switch` 看板返回（AC-16） |
| `DRILL_VIEW_BACK_LEVEL` | `返回上一层` | WP-4 `subworkflow` 逐级返回（AC-36） |
| `DRILL_VIEW_ALL_NODES` | `查看全部节点` | WP-4 `drill-switch` 入口（AC-16） |
| `DRILL_EMPTY_TASK` | `任务 无` | WP-4 `drill-live` 绑定归零卡片空态（AC-50） |
| `DRILL_NODE_MISSING` | `节点 {node} · 不存在` | WP-4 `drill-errors` 节点不存在（AC-31） |
| `DRILL_ROLE_UNUSED` | `角色 {role} · 本实例未使用` | WP-4 `drill-errors` 角色未使用（AC-31） |
| `DRILL_NO_SESSION` | `无会话` | WP-4/WP-5 指示器无会话降级提示（A-9；本批 cards.js 走 `DRILL_INDICATOR_NONE` 同值键） |
| `DRILL_EMPTY_RECORD` | `交接 无` | 连接线面板整段空态（A-9；本批 handoff-panel 走 `DRILL_CONN_EMPTY` 同值键） |

---

## §4 E 维测试覆盖映射（5 文件 ↔ WP-3 定义全部点）

| 测试文件 | tests | 覆盖的 WP-3 定义点（§4 WP-3 交付） | 需求 AC |
|---|---|---|---|
| `drill-dag.test.js` | 6 | 1跳集合/加粗/实虚线/两次布局逐字节相等/联动 scrollTarget/单节点0线不塌陷/待执行缺省+来源置换/ghost-role 不丢节点 | 05/06/38/39/40 |
| `drill-cards.test.js` | 6 | A-3 六行逐字/8档 rank/指示器 7 组 token/特殊与异常五行/耗时 12m→13m/缺值 `—` 与 TBD 置换 | 07/08/09/10/35/41 |
| `node-detail.test.js` | 5 | 四段逐字与空态/时间线正序合并/摘要缺项/证据三态与复制/交接方向语义（状态互换方向不变） | 11/12/13/14/15 |
| `connection-panel.test.js` | 5 | 标题行逐字/4 包 4 行与时间戳倒序/HO-010 时间线两行/60 条长列表/展开保持/anchor≤1px/AC-51 三次落点 | 19/42/43/51 |
| `subworkflow-drill.test.js` | 3 | 三层面包屑/computeLayout 逐字节语义断言/三种降级/四层 1/2/3/4 与返回 3 次 | 17/18/36 |

- 全部 `NODE_ENV=test node --test` 逐文件独占实跑：`# pass` 6/6/6/5/5/3、`# fail 0`、`# skipped 0`、`# todo 0`。
- 弱点扫描：`grep -REn "\.skip\(|\.todo\(|assert\.ok\(true\)|assert\.equal\(1, ?1\)"` 零命中；每文件 21~28 条断言。

---

## §5 G 维回归硬核对比（worktree 干净 HEAD）

```
干净 HEAD b92270b（无 WP-3 15 文件）：tests 1443 / pass 1417 / fail 17 / skipped 9
含 WP-3 工作树：                      tests 1468 / pass 1445 / fail 14 / skipped 9

当前失败集 - 基线失败集 = ∅   （新增红条数 = 0）
基线失败集 - 当前失败集 = { A-1: code-change/SKILL.md…, A-1: developer.yaml…, 两份 legacy 夹具 sha256… }（3 条 CRLF flake 本轮翻绿）
测试增量 1468-1443 = 25 = 5 新测试条数之和（6+6+5+5+3），全部全绿
```

- 14 条失败中 12 条逐字命中 `baseline-failures-win32.txt` 的 16 条登记项；另 2 条（`AC-04：空态、不可读行不阻断…`、`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`）在干净 HEAD 基线全量中**同样失败**，且独占复跑 3 次稳定红——系本机 Windows symlink 权限 EPERM（`review-round3.md:464`）与 2 秒时序窗口（`review-round3.md:527`）既有环境类红，非本批次引入（见 S-B2-02）。
- worktree 已 `git worktree remove --force` 清理，主工作树未受影响。

---

## §6 建议清单（返回格式④前，文风一律建议）

- **S-B2-01（签名文本形态）**：9 模块的第三参用 `options = {}` 对象承载（如 `dag.js:82 buildDag(dag, labels, options={})`、`cards.js:175`、`host-jump.js:37`、`subflow.js:36`、`handoff-panel.js:36`），而 §2.3/§2.4 逐字签名写为解构形态 `{ boldRoleNodeIds }` / `{ now }` / `{ expandedId, anchorRowTop }` / `{ clock }` / `{ levels }`。函数名、前二参、第三参字段语义与返回对象均符合契约，`drill-dag.test.js:40` 等按解构语义调用全绿，故不判阻断。建议批次 3/4 复核 D14 表 D 签名逐字条时，按「字段名一致即通过」口径确认，或在下游装配文档中注明等价形态，避免机检文本误判。
- **S-B2-02（全量差集口径）**：严格按「允许集合 = 16 条 win32 基线」字面，当前全量有 2 条（AC-04 时序、符号链接绕过 EPERM）落在差集内。但 worktree 对比证明二者在干净 HEAD 基线同样红、本批次零改既有文件、独占复跑稳定红且历史评审已登记为环境/时序类。不构成回归退化，故不判阻断。建议批次 4（WP-6）收口时，按裁决 G 为这两条补「文件级隔离复跑」原始帧并纳入允许集合（`docs/iterations/iteration-10b/flake-frames/` 当前不存在），使严格字面差集也归零。
- **S-B2-03（10 未用键消费确认）**：10 个未用键明确归属 WP-4/WP-5（见 §3.2）。建议批次 3 装配时确认 `DRILL_VIEW_*` 四条由 `app.js` 视图控件消费、`DRILL_EMPTY_TASK`/`DRILL_NODE_MISSING`/`DRILL_ROLE_UNUSED` 由 `drill-live`/`drill-errors` 消费，避免到收口出现「键已下发但无渲染出口」。
- **S-B2-04（host-jump 会话来源）**：`host-jump.js:45-47` 在 `latestSessionId` 缺省时回退到 `sessions[0]`，而非按 `lastChangedAt` 取最近活跃。本批模块优先用注入的 `latestSessionId`（符合 BR-24「最近活跃由请求方计算」），不判阻断。建议 WP-5 `host-jump.test.js` 始终按 `maxBy(lastChangedAt)` 注入 `latestSessionId` 并做次序翻转复检（AC-25），不依赖该回退分支。

---

## §7 B2 阻断标题行（返回格式④）

**无。**（阻断 0：无越界文件、无签名不符、无纯模块约束破坏、无中文硬编码、无逐字行不符、无测试弱化、无门禁红、无回归退化。）

---

## §8 移交批次 3 注意事项（返回格式⑤，2 条）

1. **消费实际模块契约**：9 模块第三参为 `options={}` 对象（`{boldRoleNodeIds}/{now}/{expandedId,anchorRowTop,clock}/{clock}/{levels}`）而非解构字面（S-B2-01）；`index.js::createDrillView` 返回对象已承载 `scrollTarget/highlight/clickNode/clickCard/scrollToEnd/back/viewControl`，WP-4 装配直接消费，勿改由 `buildDag` 承载（AC-06 机检锚点在 `index.js`）。`breadcrumb` 由 `payload.breadcrumb={key,instanceId,roleId,roleTitle}` 在渲染层拼行（承 S-03）。
2. **回归与差集纪律**：WP-4/WP-5 合入后跑全量时，除 12 条 win32 登记项外，本机还会稳定出现 `AC-04：空态…`（2秒时序）与 `HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`（symlink EPERM）两条既有红——它们已在干净 HEAD 基线存在、非新红，勿为此放宽断言；按 S-B2-02 在批次 4 补隔离复跑帧纳入允许集合即可。本批次未改任何既有文件/断言，批次 3 须保持 `desktop/ui/drill/**`、`test/wp14/wp13/**` 既有面不动（app.js 仅 WP-4 改）。
