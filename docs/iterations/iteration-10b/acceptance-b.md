# I1.10b S3 验收 · B 组（AC-16 ~ AC-30，除 AC-25）

> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-10 逐字基线；
> `docs/templates/execution-template.md` §3.2~§3.4；`docs/iterations/iteration-10b/decisions.md` 裁决 A~J（重点 J-1/J-2、H、I）。
> 取证脚手架：`probe/acc10b-f-{lib,common,run,final}.mjs` + `probe/acc10b-f-final-b.mjs` + `probe/acc10b-cases/`（目录名不带 `-f`）。
> AC-25 为真实宿主面（一键跳转唤起宿主 + 会话标识核对），按任务留待真实宿主批 e，本批跳过（不写 results 行、不建用例）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`、`requirement.md`。

## 0. 总判

**14 条：通过 14 / 不通过 0 / 阻塞 0**

- 已产出证据与判定：14 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-10b/evidence/` 下本批 AC-16~AC-30（除 25）共 114 个（每条 ≥4 文件、无空文件，覆盖 14 条 AC）。
- 不通过 / 阻塞条目：无。
- 机器可读汇总：`probe/acc10b-f-summary-b.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`。
- 判定口径：`通过` = 需求 Then/机检逐字全部成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时。
- 判定纪律：只认需求原文 Then/机检逐字，不采信测试自述；文案逐字比对、数量核对数组长度、内部断言（耗时/opCount/坐标）仅作回归信号不冒充用户可见结论；同 AC 多记录取最后一条。

## 1. AC 逐条判定表

| AC | 标题 | 判定 | 证据数 | 分级 | 关键实测 |
|---|---|---|---|---|---|
| AC-16 | 「查看全部节点」切到 7 列看板并能原路回到下钻 | **通过** | 8 | mock 实测 | 看板 7 列（被阻塞/可调度/执行中/待校验/已完成/失败/已升级）由 DESKTOP_BOARD_COLUMN_* 文案键逐项取值；返回后 view==='drill'（不是流程图），highlight/scrollTarget/DAG 选中态保持，面包屑切回「实例 INST-001 / 角色 开 |
| AC-17 | 子工作流逐层下钻与逐级返回（规划验收句中段） | **通过** | 8 | mock 实测 | 三层面包屑 实例 INST-001 / 子工作流 发布子流程 / 子工作流 child-x；第一层 3 节点 1 内部边、第二层 1 节点；图例两行逐字同 A-8；返回后上一层视图状态保持。 |
| AC-18 | 子工作流三种降级：读不到 / 循环 / 空 | **通过** | 8 | mock 实测 | ① 子工作流 child-y · 角色数未知（不进入、就地显示）；② 子工作流定义存在循环 · 已停止下钻（停在当前层，depth=2 不再增长，不递归不卡死）；③ 进入后空图 + 角色 无 + 返回入口。 |
| AC-19 | 连接线面板：交接包列表、每包时间线、历史轮次 | **通过** | 8 | mock 实测 | 标题「连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接」（按基线优先级聚合为已拒绝；2 并行指第 3 轮两包并行）；4 行倒序 HO-010/HO-011/HO-009/HO-008（行数=交接包个数=4，并行不合并行）。 |
| AC-20 | 点击人工节点跳到人工任务详情 | **通过** | 8 | mock 实测 | 面包屑「实例 INST-001 / 节点 H-001」；视觉灰色盾牌 token（visual.shape==='shield'）、状态待执行、轮次 0/1；交接段「交接 HO-012 · 正向 · 第 1 轮 · 已接受 · 09:20:00」（由 DRILL_DETAIL_HANDOFF + 文 |
| AC-21 | 点击升级节点跳到本实例升级处理面板 | **通过** | 8 | mock 实测 | 面板标题「升级处理」（DRILL_ESC_TITLE）、计数「本实例待处理升级 2 个」（DRILL_ESC_COUNT 替换 {n}=2）；两条依次列出 ESC-001 / ESC-002（编号·状态·节点·角色·轮次）。 |
| AC-22 | 「继续」让实例从已挂起恢复运行（规划验收句末段） | **通过** | 8 | mock 实测 | 2 秒内实例 state suspended→running、节点 T-002 escalated→running、escalations[0].state→resolved；提示「已继续 · ESC-001」（DRILL_ESC_DONE）；三处视图字段一致。 |
| AC-23 | 升级已处理 / 实例未挂起两种异常 | **通过** | 9 | mock 实测 | Then ①逐字「升级 ESC-001 已处理 · 状态 已处理」（裁决 J-2：daemon 新增结构字段 stateLabel 取 CLI ESCALATION_LABEL.resolved，不再靠注入文案键；63 键冻结、两处 147+63 精确断言不变，逐字行由 extra 真机 evalu |
| AC-24 | 升级面板不越界：只有继续与取消 | **通过** | 8 | mock 实测 | 可操作项恰为「继续」与「取消」两项（actions 数组逐项等于 [DRILL_ESC_CONTINUE, DRILL_ESC_CANCEL] = ['继续','取消']）；面板不含重派、终止、允许、拒绝、批量、跨实例筛选、通知开关。 |
| AC-26 | 跳转的三种降级：无会话 / 非 DSH / 未安装 | **通过** | 8 | mock 实测 | ① 0 活跃会话→按钮置灰+悬停「无可跳转会话」；② mock 宿主→「宿主 mock 不支持跳转」；③ MAESTRO_DSH_EXE 不存在→「未找到 DeepSeek Harness」。三条提示逐字取自 A-7 冻结文案，降级原因只由适配器错误码映射。 |
| AC-27 | 下钻层实时更新，会话变化不重排 | **通过** | 8 | mock 实测 | 状态词由可用转服务中（statusWord('serving')，用户不刷新即见）；5 次会话变化只让对应卡片指示器跟着变，卡片顺序 order_before===order_after、DAG 节点集合不变、不整体重绘。 |
| AC-28 | 只读：浏览与跳转不改状态，只有「继续」会改 | **通过** | 8 | mock 实测 | 所有只读浏览结束后，state/events/traces 三份文件字节哈希相等、四组状态深比较相等，三处视图（状态栏/卡片/DAG）与操作前一致；全程无「已变更/已提交」提示、无白屏崩溃；连续导航无闪烁无重复加载。 |
| AC-29 | 规划验收句端到端：发现异常 → 下钻 → 卡片 → 证据 → 处理升级 → 实例继续（全程无终端 | **通过** | 8 | mock 实测 | 九步探针序列 ANCHOR：graph-shown→drill-shown→detail-shown→evidence-shown→escalation-shown→continued→graph-returned→subflow-shown→graph-restored，顺序固定。 |
| AC-30 | 文案唯一来源、界面零中文、31 词扫描、零依赖 | **通过** | 9 | mock 实测（静态机检面） | dependencies==={}（node -p 输出 0）；desktop/ui+desktop/harness 无中文字面量（CJK 命中 0，由 labels-drill 机检核对）；新增文案键经文案表下发（A-10 63 键齐全、既有键值不变）；31 词双目录 purity 零命中；回归失 |

## 2. 逐 AC 取证明细（命令 / 需求原文 / 证据 / 逐项核对）

#### AC-16 「查看全部节点」切到 7 列看板并能原路回到下钻

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-16`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-switch.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-switch.test.js   | cwd=D:\WWW\Maestro | exit=0 | 294ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-16 | exit=0 | 149ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-16.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-16.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 已进入「开发」下钻，滚动到第 3 张卡片并高亮 `T-002`；`NODE_ENV=test`。
- **When** 点「查看全部节点」；再点「返回角色下钻」。
- **Then** 看板显示 7 列（列名与顺序沿用 I1.10a：被阻塞 / 可调度 / 执行中 / 待校验 / 已完成 / 失败 / 已升级）；返回后视图是**下钻**而不是流程图，滚动位置、高亮 `T-002`、DAG 选中态都保持；面包屑在下钻与看板之间正确切换。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-16.tests.stdout.txt` | 782 B |
| `docs/iterations/iteration-10b/evidence/AC-16.test.source.txt` | 4295 B |
| `docs/iterations/iteration-10b/evidence/AC-16.arch.stdout.txt` | 235 B |
| `docs/iterations/iteration-10b/evidence/AC-16.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-16.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-16.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-16.meta.json` | 1227 B |
| `docs/iterations/iteration-10b/evidence/AC-16.status.txt` | 1458 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-switch.test.js）：测试文件存在 | ✅ | `test/wp14/drill-switch.test.js` |
| 2 | 机检 F-16（test/wp14/drill-switch.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-switch.test.js）：# pass ≥ 1 | ✅ | `# pass=3` |
| 4 | 机检 F-16（test/wp14/drill-switch.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-switch.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：看板列名只由既有模块提供，下钻层不复制（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(app.state().view, 'board')（期望含 "assert.equal(app.state().view, 'board')"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 8 | Then 逐字：assert.deepEqual(composed.board.columnNames, EXPECTED_COLUMNS)（期望含 "assert.deepEqual(composed.board.columnNames, EXPECTED_COLUMNS)"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 9 | Then 逐字：assert.equal(composed.board.columns.length, 7)（期望含 "assert.equal(composed.board.columns.length, 7)"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 10 | Then 逐字：DESKTOP_BOARD_COLUMN_BLOCKED（期望含 "DESKTOP_BOARD_COLUMN_BLOCKED"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 11 | Then 逐字：DESKTOP_BOARD_COLUMN_ESCALATED（期望含 "DESKTOP_BOARD_COLUMN_ESCALATED"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 12 | Then 逐字：assert.equal(st.view, 'drill', '返回的是下钻，不是流程图')（期望含 "assert.equal(st.view, 'drill', '返回的是下钻，不是流程图')"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 13 | Then 逐字：assert.equal(st.drillView.highlight, beforeHighlight)（期望含 "assert.equal(st.drillView.highlight, beforeHighlight)"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 14 | Then 逐字：assert.equal(st.drillView.scrollTarget, beforeScroll)（期望含 "assert.equal(st.drillView.scrollTarget, beforeScroll)"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |
| 15 | Then 逐字：'实例 INST-001 / 角色 开发'（期望含 "'实例 INST-001 / 角色 开发'"） | ✅ | `/**<br> * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).<br> * Drives the real createApp navigation; column names come from the frozen<br> * board module + label table, never authored in this file.<br> */<br>import test from 'node:test';<br>i` |

**⑤ 判定**：通过

**备注**

- Then 逐字：看板 7 列（被阻塞/可调度/执行中/待校验/已完成/失败/已升级）由 DESKTOP_BOARD_COLUMN_* 文案键逐项取值；返回后 view==='drill'（不是流程图），highlight/scrollTarget/DAG 选中态保持，面包屑切回「实例 INST-001 / 角色 开发」。
- 内部断言（非用户可见）：scrollTop 前后相等（scrollTarget 索引比对）；机检 # pass≥1、# fail 0。
- 架构锚点：下钻层 desktop/ui/drill/ 对 DESKTOP_BOARD_COLUMN_|被阻塞|可调度 零命中（exit 1），证明未复制第二套列名。

---

#### AC-17 子工作流逐层下钻与逐级返回（规划验收句中段）

- 判定：**通过**（核对 20/20 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-17`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/subworkflow-drill.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\subworkflow-drill.test.js   | cwd=D:\WWW\Maestro | exit=0 | 278ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-17 | exit=0 | 122ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-17.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-17.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 工作流 `release-flow` 含 `S-001`（`workflow: publish-child`，内部 3 个角色节点），`publish-child` 又含 `S-002`（`workflow: child-x`，内部 1 个角色节点）；`NODE_ENV=test`。
- **When** 在流程图上点 `S-001`；在子工作流图上点 `S-002`；再点面包屑的第一层「实例 INST-001」。
- **Then** 三次层级分别为 `实例 INST-001 / 子工作流 发布子流程`、`实例 INST-001 / 子工作流 发布子流程 / 子工作流 child-x`、回到角色流程图；第一层子图有 3 个角色节点、1 条内部边，第二层有 1 个角色节点；每层都复用同一套布局与图例（图例两行逐字同 I1.10a A-8）；返回后上一层缩放与折叠状态保持。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-17.tests.stdout.txt` | 694 B |
| `docs/iterations/iteration-10b/evidence/AC-17.test.source.txt` | 4609 B |
| `docs/iterations/iteration-10b/evidence/AC-17.arch.stdout.txt` | 442 B |
| `docs/iterations/iteration-10b/evidence/AC-17.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-17.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-17.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-17.meta.json` | 1121 B |
| `docs/iterations/iteration-10b/evidence/AC-17.status.txt` | 1380 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：测试文件存在 | ✅ | `test/wp14/subworkflow-drill.test.js` |
| 2 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：# pass ≥ 1 | ✅ | `# pass=3` |
| 4 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：子图复用既有布局模块 graph/layout（引用存在，不绑定条数）（expect=min1） | ✅ | `exit=0 hits=1 \| 11:import { computeLayout } from '../graph/layout.js';` |
| 7 | 架构：drill 不自建第二套 computeLayout（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：import { computeLayout } from '../../desktop/ui/graph/layout.js'（期望含 "import { computeLayout } from '../../desktop/ui/graph/layout.js'"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 9 | Then 逐字：assert.deepEqual(child.breadcrumb, ['实例 INST-001', '子工作流 发布子流程'])（期望含 "assert.deepEqual(child.breadcrumb, ['实例 INST-001', '子工作流 发布子流程'])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 10 | Then 逐字：assert.deepEqual(grand.breadcrumb, [（期望含 "assert.deepEqual(grand.breadcrumb, ["） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 11 | Then 逐字：'子工作流 child-x',（期望含 "'子工作流 child-x',"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 12 | Then 逐字：assert.equal(child.nodes.length, 3)（期望含 "assert.equal(child.nodes.length, 3)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 13 | Then 逐字：assert.equal(child.edges.length, 1)（期望含 "assert.equal(child.edges.length, 1)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 14 | Then 逐字：assert.equal(grand.nodes.length, 1)（期望含 "assert.equal(grand.nodes.length, 1)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 15 | Then 逐字：图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与（期望含 "图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 16 | Then 逐字：图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流（期望含 "图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 17 | Then 逐字：const expected = computeLayout({（期望含 "const expected = computeLayout({"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 18 | Then 逐字：child.nodes.map((n) => [n.x, n.y, n.layer, n.z])（期望含 "child.nodes.map((n) => [n.x, n.y, n.layer, n.z])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 19 | Then 逐字：expected.nodes.map((n) => [n.x, n.y, n.layer, n.z])（期望含 "expected.nodes.map((n) => [n.x, n.y, n.layer, n.z])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 20 | Then 逐字：assert.deepEqual(back.breadcrumb, ['实例 INST-001', '子工作流 发布子流程'])（期望含 "assert.deepEqual(back.breadcrumb, ['实例 INST-001', '子工作流 发布子流程'])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：三层面包屑 实例 INST-001 / 子工作流 发布子流程 / 子工作流 child-x；第一层 3 节点 1 内部边、第二层 1 节点；图例两行逐字同 A-8；返回后上一层视图状态保持。
- 复用性语义断言：把第一层子图节点/边单独喂给 desktop/ui/graph/layout.js 的 computeLayout，断言 child.nodes 的 [x,y,layer,z] 与该次输出逐字节相等（等价实现/再导出同样通过，不数 import 次数）。

---

#### AC-18 子工作流三种降级：读不到 / 循环 / 空

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-18`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/subworkflow-drill.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\subworkflow-drill.test.js   | cwd=D:\WWW\Maestro | exit=0 | 245ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-18 | exit=0 | 162ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-18.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-18.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 三个现场：① `S-001` 指向不存在的 `child-y`；② `child-a` 的子流程为 `child-b`、`child-b` 的子流程为 `child-a`；③ `S-003` 指向的内部 0 个角色节点；`NODE_ENV=test`。
- **When** 依次点击三个折叠组。
- **Then** ①不进入，就地显示 `子工作流 child-y · 角色数未知`，其余图照常；②提示 `子工作流定义存在循环 · 已停止下钻` 并停在当前层，不递归、不卡死（用户感觉不到等待）；③进入后显示空图与 `角色 无`，提供返回入口。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-18.tests.stdout.txt` | 696 B |
| `docs/iterations/iteration-10b/evidence/AC-18.test.source.txt` | 4609 B |
| `docs/iterations/iteration-10b/evidence/AC-18.arch.stdout.txt` | 222 B |
| `docs/iterations/iteration-10b/evidence/AC-18.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-18.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-18.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-18.meta.json` | 1116 B |
| `docs/iterations/iteration-10b/evidence/AC-18.status.txt` | 1382 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：测试文件存在 | ✅ | `test/wp14/subworkflow-drill.test.js` |
| 2 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：# pass ≥ 1 | ✅ | `# pass=3` |
| 4 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：循环检测基于已访问 ref 集合，不用 while(true)（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(missing.degraded.kind, 'missing')（期望含 "assert.equal(missing.degraded.kind, 'missing')"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 8 | Then 逐字：assert.equal(missing.degraded.text, '子工作流 child-y · 角色数未知')（期望含 "assert.equal(missing.degraded.text, '子工作流 child-y · 角色数未知')"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 9 | Then 逐字：assert.equal(missing.nodes.length, 0)（期望含 "assert.equal(missing.nodes.length, 0)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 10 | Then 逐字：assert.equal(cyc.degraded.kind, 'cycle')（期望含 "assert.equal(cyc.degraded.kind, 'cycle')"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 11 | Then 逐字：assert.equal(cyc.degraded.text, '子工作流定义存在循环 · 已停止下钻')（期望含 "assert.equal(cyc.degraded.text, '子工作流定义存在循环 · 已停止下钻')"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 12 | Then 逐字：assert.equal(cyc.depth, 2)（期望含 "assert.equal(cyc.depth, 2)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 13 | Then 逐字：assert.equal(empty.degraded.kind, 'empty')（期望含 "assert.equal(empty.degraded.kind, 'empty')"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 14 | Then 逐字：assert.equal(empty.degraded.text, '角色 无')（期望含 "assert.equal(empty.degraded.text, '角色 无')"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 15 | Then 逐字：assert.equal(empty.nodes.length, 0)（期望含 "assert.equal(empty.nodes.length, 0)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：① 子工作流 child-y · 角色数未知（不进入、就地显示）；② 子工作流定义存在循环 · 已停止下钻（停在当前层，depth=2 不再增长，不递归不卡死）；③ 进入后空图 + 角色 无 + 返回入口。
- 架构锚点：循环检测基于已访问 ref 集合，subflow.js 对 while(true) 零命中（exit 1）。内部断言 ② elapsed≤100 由注入时钟承载，用户可见 Then 只判"用户感觉不到等待"。

---

#### AC-19 连接线面板：交接包列表、每包时间线、历史轮次

- 判定：**通过**（核对 16/16 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-19`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/connection-panel.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\connection-panel.test.js   | cwd=D:\WWW\Maestro | exit=0 | 316ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-19 | exit=0 | 143ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-19.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-19.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 角色对「开发→测试」上有 **4 个交接包**：`HO-008`（第 1 轮、已拒绝、08:58:02）、`HO-009`（第 2 轮、已过期、09:05:10）、`HO-010`（第 3 轮、已投递、09:12:41——行时间取最近活动，与其时间线末条 `09:12:41 已投递` 一致）、`HO-011`（第 3 轮、已投递、09:12:39，与 `HO-010` 并行，两包 `parallelCount` 均为 2）；另有角色对「测试→协调者」无任何交接包；`NODE_ENV=test`。
- **When** 点击「开发→测试」的连接线并展开第 3 轮的 `HO-010` 时间线；再点击「测试→协调者」的连接线。
- **Then** 标题行逐字为 `连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接`（这一对里有被拒绝的包，按基线优先级 `已拒绝 > 已过期 > 待投递 > 已投递 > …` 聚合即为「已拒绝」，不可能是「已投递」；`2 并行交接` 指第 3 轮同时有 2 个并行交接包）；列表 **4 行**按最近活动倒序（`HO-010 / HO-011 / HO-009 / HO-008`，**行数 = 交接包个数 = 4**，并行不合并行），每行符合附录 A-5；展开 `HO-010` 后时间线显示 `已构造 → 已投递`（只显示真实发生过的状态，不显示未发生的 `已接受`）；历史第 1、2 轮可展开并直接显示拒绝/过期原因；「测试→协调者」显示「交接 无」。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-19.tests.stdout.txt` | 1170 B |
| `docs/iterations/iteration-10b/evidence/AC-19.test.source.txt` | 5579 B |
| `docs/iterations/iteration-10b/evidence/AC-19.arch.stdout.txt` | 209 B |
| `docs/iterations/iteration-10b/evidence/AC-19.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-19.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-19.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-19.meta.json` | 1190 B |
| `docs/iterations/iteration-10b/evidence/AC-19.status.txt` | 1854 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/connection-panel.test.js）：测试文件存在 | ✅ | `test/wp14/connection-panel.test.js` |
| 2 | 机检 F-16（test/wp14/connection-panel.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/connection-panel.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/connection-panel.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/connection-panel.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：时间线只用交接包既有时间戳，不取当前时间（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(panel.title, '连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接')（期望含 "assert.equal(panel.title, '连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 8 | Then 逐字：assert.equal(panel.rows.length, 4)（期望含 "assert.equal(panel.rows.length, 4)"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 9 | Then 逐字：assert.deepEqual(panel.rows.map((r) => r.id), ['HO-010', 'HO-011', 'HO-009', 'HO-008'])（期望含 "assert.deepEqual(panel.rows.map((r) => r.id), ['HO-010', 'HO-011', 'HO-009', 'HO-008'])"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 10 | Then 逐字：assert.deepEqual(panel.rows.map((r) => r.time), ['09:12:41', '09:12:39', '09:05:10', '08:58:02'])（期望含 "assert.deepEqual(panel.rows.map((r) => r.time), ['09:12:41', '09:12:39', '09:05:10', '08: | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 11 | Then 逐字：'交接 HO-010 · 第 3 轮 · 已投递 · 09:12:41'（期望含 "'交接 HO-010 · 第 3 轮 · 已投递 · 09:12:41'"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 12 | Then 逐字：'时间线 09:12:40 已构造'（期望含 "'时间线 09:12:40 已构造'"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 13 | Then 逐字：'时间线 09:12:41 已投递'（期望含 "'时间线 09:12:41 已投递'"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 14 | Then 逐字：assert.equal(panel.rows.find((r) => r.id === 'HO-010').time, '09:12:41')（期望含 "assert.equal(panel.rows.find((r) => r.id === 'HO-010').time, '09:12:41')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 15 | Then 逐字：assert.equal(empty.emptyText, '交接 无')（期望含 "assert.equal(empty.emptyText, '交接 无')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 16 | Then 逐字：assert.equal(empty.rows.length, 0)（期望含 "assert.equal(empty.rows.length, 0)"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |

**⑤ 判定**：通过

**备注**

- Then 逐字：标题「连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接」（按基线优先级聚合为已拒绝；2 并行指第 3 轮两包并行）；4 行倒序 HO-010/HO-011/HO-009/HO-008（行数=交接包个数=4，并行不合并行）。
- HO-010 行时间=其最近活动 09:12:41=展开时间线末条 09:12:41（一致）；时间线恰好 [09:12:40 已构造, 09:12:41 已投递]，不补未发生的已接受；第 1、2 轮可展开显示拒绝/过期原因；「测试→协调者」显示「交接 无」。

---

#### AC-20 点击人工节点跳到人工任务详情

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-20`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/special-node-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\special-node-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 277ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-20 | exit=0 | 195ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-20.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-20.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 人工节点 `H-001`（标题「人工验收」，运行时无状态记录、无会话），上游交接包 `HO-012` 已接受、时间 `09:20:00`，且该包**不带** `products` / `defects` / `artifactRefs`（故证据段为空态）；`NODE_ENV=test`。**编号说明**：本 AC 与 AC-19 / AC-29 是两个独立夹具（各在自己的 `$TEMP` 目录），`HO-008` 在 AC-19 / AC-29 / A-5 里是「开发→测试」的**已拒绝**包（`08:58:02`），本 AC 不复用该编号，避免同一编号在不同夹具里出现两种状态。
- **When** 在流程图上点击 `H-001`。
- **Then** 进入节点详情，面包屑 `实例 INST-001 / 节点 H-001`；详情以人工节点样式呈现（灰色盾牌 token）、状态为「待执行」、轮次 `0/1`；交接段逐字显示 `交接 HO-012 · 正向 · 第 1 轮 · 已接受 · 09:20:00`；时间线、摘要、证据三段按 A-4 的空态行显示，逐字为 `时间线 无记录` / `摘要 无记录` / `证据 无记录`；提供「返回流程图」。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-20.tests.stdout.txt` | 1516 B |
| `docs/iterations/iteration-10b/evidence/AC-20.test.source.txt` | 8056 B |
| `docs/iterations/iteration-10b/evidence/AC-20.arch.stdout.txt` | 200 B |
| `docs/iterations/iteration-10b/evidence/AC-20.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-20.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-20.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-20.meta.json` | 1255 B |
| `docs/iterations/iteration-10b/evidence/AC-20.status.txt` | 2202 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/special-node-jump.test.js）：测试文件存在 | ✅ | `test/wp14/special-node-jump.test.js` |
| 2 | 机检 F-16（test/wp14/special-node-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/special-node-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/special-node-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/special-node-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：人工节点详情不引用升级面板（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(v.breadcrumb, '实例 INST-001 / 节点 H-001')（期望含 "assert.equal(v.breadcrumb, '实例 INST-001 / 节点 H-001')"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 8 | Then 逐字：assert.equal(v.detail.visual.shape, 'shield')（期望含 "assert.equal(v.detail.visual.shape, 'shield')"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 9 | Then 逐字：assert.equal(lines('handoff')[0],（期望含 "assert.equal(lines('handoff')[0],"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 10 | Then 逐字：w('DRILL_DETAIL_HANDOFF')（期望含 "w('DRILL_DETAIL_HANDOFF')"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 11 | Then 逐字：.replace('{id}', 'HO-012').replace('{direction}', w('DESKTOP_EDGE_DIRECTION_FORWARD'))（期望含 ".replace('{id}', 'HO-012').replace('{direction}', w('DESKTOP_EDGE_DIRECTION_FORWARD'))"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 12 | Then 逐字：.replace('{round}', '1').replace('{state}', handoffWord('accepted')).replace('{time}', '09:20:00')（期望含 ".replace('{round}', '1').replace('{state}', handoffWord('accepted')).replace('{time}', ' | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 13 | Then 逐字：nodeType: 'human'（期望含 "nodeType: 'human'"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 14 | Then 逐字：assert.equal(/escalation/.test(src), false)（期望含 "assert.equal(/escalation/.test(src), false)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |

**⑤ 判定**：通过

**备注**

- Then 逐字：面包屑「实例 INST-001 / 节点 H-001」；视觉灰色盾牌 token（visual.shape==='shield'）、状态待执行、轮次 0/1；交接段「交接 HO-012 · 正向 · 第 1 轮 · 已接受 · 09:20:00」（由 DRILL_DETAIL_HANDOFF + 文案键逐项替换拼出）。
- 三段空态按 A-4 逐字：时间线 无记录 / 摘要 无记录 / 证据 无记录（由 DRILL_DETAIL_NONE.replace({section}) 拼行）；提供「返回流程图」。HO-012 不带 products/defects/artifactRefs，故证据段为空态。
- 夹具独立：本 AC 不复用 AC-19 的 HO-008 编号，避免同编号两种状态。

---

#### AC-21 点击升级节点跳到本实例升级处理面板

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-21`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/special-node-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\special-node-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 305ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-21 | exit=0 | 112ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-21.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-21.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 实例 `INST-001` 有 2 条待处理升级（`ESC-001` 节点 `T-003` 第 2 轮、`reasonDetail` 逐字为 `测试第 2 轮失败`、`defects` 为 `[{summary:'断言失败', evidence:'defects/d1.md'}]`；`ESC-002` 节点 `T-005` 第 1 轮、`reasonDetail` 为 `合并冲突`、`defects` 为 `[{summary:'冲突未解决', evidence:'defects/d2.md'}]`），另一实例 `INST-002` 有 1 条待处理升级；`NODE_ENV=test`。
- **When** 点击 `INST-001` 升级节点 `X-001`。
- **Then** 面板标题「升级处理」、`本实例待处理升级 2 个`；两条依次列出（编号 · 状态 · 节点 · 角色 · 轮次）；展开第一条后逐字显示 `原因：测试第 2 轮失败` 与 `缺陷：断言失败（证据 defects/d1.md）`（与 A-6 同形，值取自 Given 的 `reasonDetail` / `defects`）；**不出现** `INST-002` 的升级（本实例作用域）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-21.tests.stdout.txt` | 1515 B |
| `docs/iterations/iteration-10b/evidence/AC-21.test.source.txt` | 8056 B |
| `docs/iterations/iteration-10b/evidence/AC-21.arch.stdout.txt` | 228 B |
| `docs/iterations/iteration-10b/evidence/AC-21.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-21.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-21.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-21.meta.json` | 1099 B |
| `docs/iterations/iteration-10b/evidence/AC-21.status.txt` | 2201 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/special-node-jump.test.js）：测试文件存在 | ✅ | `test/wp14/special-node-jump.test.js` |
| 2 | 机检 F-16（test/wp14/special-node-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/special-node-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/special-node-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/special-node-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：面板数据按实例过滤，不 listAll/instanceIds（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(p.title, w('DRILL_ESC_TITLE'))（期望含 "assert.equal(p.title, w('DRILL_ESC_TITLE'))"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 8 | Then 逐字：assert.equal(p.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'))（期望含 "assert.equal(p.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'))"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 9 | Then 逐字：assert.deepEqual(p.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002'])（期望含 "assert.deepEqual(p.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002'])"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 10 | Then 逐字：assert.equal(p.items[0].reasonLine, '原因：测试第 2 轮失败')（期望含 "assert.equal(p.items[0].reasonLine, '原因：测试第 2 轮失败')"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 11 | Then 逐字：assert.equal(p.items[0].defectLines[0], '缺陷：断言失败（证据 defects/d1.md）')（期望含 "assert.equal(p.items[0].defectLines[0], '缺陷：断言失败（证据 defects/d1.md）')"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 12 | Then 逐字：assert.equal(JSON.stringify(p.items).includes('INST-002'), false)（期望含 "assert.equal(JSON.stringify(p.items).includes('INST-002'), false)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 13 | Then 逐字：reasonDetail: '合并冲突'（期望含 "reasonDetail: '合并冲突'"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |

**⑤ 判定**：通过

**备注**

- Then 逐字：面板标题「升级处理」（DRILL_ESC_TITLE）、计数「本实例待处理升级 2 个」（DRILL_ESC_COUNT 替换 {n}=2）；两条依次列出 ESC-001 / ESC-002（编号·状态·节点·角色·轮次）。
- 展开第一条逐字「原因：测试第 2 轮失败」「缺陷：断言失败（证据 defects/d1.md）」（值取自 Given 的 reasonDetail/defects，与 A-6 同形）；不出现 INST-002 的升级（本实例作用域）。

---

#### AC-22 「继续」让实例从已挂起恢复运行（规划验收句末段）

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-22`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/escalation-continue.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\escalation-continue.test.js   | cwd=D:\WWW\Maestro | exit=0 | 418ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-22 | exit=0 | 231ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-22.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-22.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** `$TEMP/maestro-i10b-continue` 用真实核心 + mock 宿主、按模板 `code-loop`（节点只有 `T-001` 开发 → `T-002` 测试，两者 `maxRounds` 均为 2）演出的实例 `INST-001`：节点 **`T-002`** 连续失败 2 次后升级，实例 `state: suspended`，`escalations` 有 1 条 `pending`（`ESC-001`，挂在该 `T-002` 上）；界面已打开升级处理面板；`NODE_ENV=test`。
- **When** 用户点「继续」并在确认里确认。
- **Then** 2 秒内：实例状态由「已挂起」变「运行中」、`T-002` 回到「执行中」、该升级变「已处理」；面板提示 `已继续 · ESC-001`；状态栏/局部 DAG/卡片三处同时反映（不需要刷新）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-22.tests.stdout.txt` | 1621 B |
| `docs/iterations/iteration-10b/evidence/AC-22.test.source.txt` | 8885 B |
| `docs/iterations/iteration-10b/evidence/AC-22.arch.stdout.txt` | 250 B |
| `docs/iterations/iteration-10b/evidence/AC-22.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-22.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-22.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-22.meta.json` | 1186 B |
| `docs/iterations/iteration-10b/evidence/AC-22.status.txt` | 2311 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/escalation-continue.test.js）：测试文件存在 | ✅ | `test/wp14/escalation-continue.test.js` |
| 2 | 机检 F-16（test/wp14/escalation-continue.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/escalation-continue.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/escalation-continue.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/escalation-continue.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：界面与 HTTP 层不得直接改状态，只能调既有裁决（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：两份等价夹具各跑一条路径，终态逐项相等；UI 路径经 io.continueEscalation（期望含 "两份等价夹具各跑一条路径，终态逐项相等；UI 路径经 io.continueEscalation"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 8 | Then 逐字：const fixtureA = fixture();（期望含 "const fixtureA = fixture();"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 9 | Then 逐字：const fixtureB = fixture();（期望含 "const fixtureB = fixture();"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 10 | Then 逐字：assert.deepEqual(terminal(terminalA), terminal(terminalB))（期望含 "assert.deepEqual(terminal(terminalA), terminal(terminalB))"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 11 | Then 逐字：assert.equal(result.ok, true)（期望含 "assert.equal(result.ok, true)"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 12 | Then 逐字：w('DRILL_ESC_DONE').replace('{id}', 'ESC-001')（期望含 "w('DRILL_ESC_DONE').replace('{id}', 'ESC-001')"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 13 | Then 逐字：assert.ok(clock.t - trigger <= 2000)（期望含 "assert.ok(clock.t - trigger <= 2000)"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |

**⑤ 判定**：通过

**备注**

- Then 逐字：2 秒内实例 state suspended→running、节点 T-002 escalated→running、escalations[0].state→resolved；提示「已继续 · ESC-001」（DRILL_ESC_DONE）；三处视图字段一致。
- 机检核心：两份等价夹具 A（界面继续经 io.continueEscalation）/ B（同一快照走 CLI escalate resolve --decision retry）各只跑一条路径，比较终态逐项相等、同形同位；不在同一份夹具上先后跑两条（否则命中 ESCALATION_NOT_PENDING）。内部断言 elapsed≤2000。

---

#### AC-23 升级已处理 / 实例未挂起两种异常

- 判定：**通过**（核对 23/23 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-23`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/escalation-continue.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\escalation-continue.test.js   | cwd=D:\WWW\Maestro | exit=0 | 293ms
[evaluate DRILL_ESC_ALREADY + ESCALATION_LABEL.resolved] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe -e "import('./src/cli/labels.js').then(async cli=>{const ui=await import('./src/daemon/http/labels.js');const t=ui.UI_LABEL_KEYS['DRILL_ESC_ALREADY'];console.log('TPL='+t);console.log('STATE='+cli.ESCALATION_LABEL.resolved);console.log('LINE='+t.replaceAll('{id}','ESC-001').replaceAll('{state}',cli.ESCALATION_LABEL.resolved));})"   | cwd=D:\WWW\Maestro | exit=0 | 87ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-23 | exit=0 | 103ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-23.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-23.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 两个现场，**都按既有接缝的真实产出写，不虚构产品不可达的状态组合**：① 用既有测试接缝 `test.escalate`（`src/daemon/server.js:345-352`，仅 `NODE_ENV=test` 挂载；转到 `orchestrator.escalateOnce`）在实例 `INST-001` 的节点 `T-002` 上制造一条升级——该接缝的真实产出是「节点 `escalated` + 会话 `escalated`/`quarantined` + 实例 `state: suspended` + `escalations[0] = {state:'pending', escalationId:'ESC-001'}`」（`src/core/escalation.js:120-160`）；随后**在点「继续」之前**用既有裁决路径把它处理掉（`node "$MAESTRO_REPO/bin/orch.js" escalate resolve ESC-001 --instance INST-001 --decision retry`），此时 `escalations[0].state === 'resolved'`；② 面板现场同 ①（真升级记录仍在，`state: resolved`），但把界面注入的 `io.continueEscalation`（`契约：desktop/ui/app.js::createApp({ labels, project, io }).io.continueEscalation`，D-14 表 A4）换成返回 `{ok: false, code: 'INSTANCE_NOT_SUSPENDED', messageKey: 'DRILL_ESC_NOT_SUSPENDED', message: '实例 未挂起 · 无法继续'}` 的桩（**形状与 daemon 真实返回一致**，与 AC-45 用同一注入点）——**说明**：`test.escalate` 只会产出 `suspended`，而「运行中 / 非挂起 + 待处理升级」这个组合**不可由产品路径产生**（`src/core/orchestrator.js:5051-5052` 的守卫要求 `state === 'suspended' && halted !== true`，而挂起态无法被 `workflow resume` 恢复、取消又会把 pending 升级置 `voided`），因此 ② 按裁决 H 第 6 条改用「既有注入点 + 接缝真实错误形状」，Given 不写这个组合本身；`NODE_ENV=test`。
- **When** 在两个现场分别点「继续」。
- **Then** ①显示 `升级 ESC-001 已处理 · 状态 已处理`，列表刷新，不重复提交；②显示 `实例 未挂起 · 无法继续`，面板不关闭；两次都不崩、实例状态不变、不新增裁决记录。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-23.tests.stdout.txt` | 1621 B |
| `docs/iterations/iteration-10b/evidence/AC-23.test.source.txt` | 8885 B |
| `docs/iterations/iteration-10b/evidence/AC-23.arch.stdout.txt` | 2678 B |
| `docs/iterations/iteration-10b/evidence/AC-23.escalation-label.txt` | 118 B |
| `docs/iterations/iteration-10b/evidence/AC-23.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-23.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-23.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-23.meta.json` | 1497 B |
| `docs/iterations/iteration-10b/evidence/AC-23.status.txt` | 2919 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/escalation-continue.test.js）：测试文件存在 | ✅ | `test/wp14/escalation-continue.test.js` |
| 2 | 机检 F-16（test/wp14/escalation-continue.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/escalation-continue.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/escalation-continue.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/escalation-continue.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：① 原始错误码不越界面层（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：②a DRILL_ESC_ALREADY 在 drill 层（expect=min1） | ✅ | `exit=0 hits=1 \| desktop/ui/drill/escalation-panel.js:90:    already: 'DRILL_ESC_ALREADY',` |
| 8 | 架构：②b DRILL_ESC_NOT_SUSPENDED 在 drill 层（expect=min1） | ✅ | `exit=0 hits=1 \| desktop/ui/drill/escalation-panel.js:91:    notSuspended: 'DRILL_ESC_NOT_SUSPENDED',` |
| 9 | 架构：③a ESCALATION_NOT_PENDING 在核心/daemon/CLI（expect=min1） | ✅ | `exit=0 hits=8 \| src/core/escalation.js:89:  if (!entry \|\| entry.state !== 'pending') return { ok: false, code: 'ESCALATION_NOT_PENDING' }; ; src/core/orchestrator.js:5049:      return fail('ESCALATION_NOT_PENDING', { escalationId, state: entry.state }); ; s` |
| 10 | 架构：③b INSTANCE_NOT_SUSPENDED 在核心/daemon/CLI（expect=min1） | ✅ | `exit=0 hits=7 \| src/core/orchestrator.js:5052:      return fail('INSTANCE_NOT_SUSPENDED', { instanceId: id, state: state.state }); ; src/daemon/http/server.js:62:  INSTANCE_NOT_SUSPENDED: 'DRILL_ESC_NOT_SUSPENDED', ; src/daemon/http/server.js:68: * Command-le` |
| 11 | 架构：④ 原始错误码不在探针层（expect=zero） | ✅ | `exit=1 hits=0` |
| 12 | Then 逐字：assert.equal(app.state().escalationNotice.text, '升级 ESC-001 已处理 · 状态 ' + ESCALATION_LABEL.resolved)（期望含 "assert.equal(app.state().escalationNotice.text, '升级 ESC-001 已处理 · 状态 ' + ESCALATION_LAB | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 13 | Then 逐字：stateLabel: ESCALATION_LABEL.resolved（期望含 "stateLabel: ESCALATION_LABEL.resolved"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 14 | Then 逐字：assert.equal(result.stateLabel, ESCALATION_LABEL.resolved)（期望含 "assert.equal(result.stateLabel, ESCALATION_LABEL.resolved)"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 15 | Then 逐字：assert.equal(result.messageKey, 'DRILL_ESC_ALREADY')（期望含 "assert.equal(result.messageKey, 'DRILL_ESC_ALREADY')"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 16 | Then 逐字：assert.equal(app.state().escalationNotice.text, '实例 未挂起 · 无法继续')（期望含 "assert.equal(app.state().escalationNotice.text, '实例 未挂起 · 无法继续')"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 17 | Then 逐字：连发两次第二次得 ALREADY（真实非桩）（期望含 "连发两次第二次得 ALREADY（真实非桩）"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 18 | Then 逐字：assert.equal(second.code, 'ESCALATION_NOT_PENDING')（期望含 "assert.equal(second.code, 'ESCALATION_NOT_PENDING')"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 19 | Then 逐字：assert.equal(second.messageKey, 'DRILL_ESC_ALREADY')（期望含 "assert.equal(second.messageKey, 'DRILL_ESC_ALREADY')"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 20 | Then 逐字：assert.equal(second.stateLabel, ESCALATION_LABEL.resolved)（期望含 "assert.equal(second.stateLabel, ESCALATION_LABEL.resolved)"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 21 | stateLabel 模板逐字（DRILL_ESC_ALREADY）（期望含 "TPL=升级 {id} 已处理 · 状态 {state}"） | ✅ | `TPL=升级 {id} 已处理 · 状态 {state}<br>STATE=已处理<br>LINE=升级 ESC-001 已处理 · 状态 已处理<br>` |
| 22 | 状态词来自 CLI 唯一中文源（ESCALATION_LABEL.resolved）（期望含 "STATE=已处理"） | ✅ | `TPL=升级 {id} 已处理 · 状态 {state}<br>STATE=已处理<br>LINE=升级 ESC-001 已处理 · 状态 已处理<br>` |
| 23 | Then 逐字：升级 ESC-001 已处理 · 状态 已处理（J-2）（期望含 "LINE=升级 ESC-001 已处理 · 状态 已处理"） | ✅ | `TPL=升级 {id} 已处理 · 状态 {state}<br>STATE=已处理<br>LINE=升级 ESC-001 已处理 · 状态 已处理<br>` |

**⑤ 判定**：通过

**备注**

- Then ①逐字「升级 ESC-001 已处理 · 状态 已处理」（裁决 J-2：daemon 新增结构字段 stateLabel 取 CLI ESCALATION_LABEL.resolved，不再靠注入文案键；63 键冻结、两处 147+63 精确断言不变，逐字行由 extra 真机 evaluate 核对）；②「实例 未挂起 · 无法继续」，面板不关闭，两次都不崩、状态不变、不新增裁决。
- 机检内部断言：① 现场对同一实例连发两次 continue，第二次得 ESCALATION_NOT_PENDING 且提示与 ① 逐字一致（真守卫、非桩）；escalations[0].state 未被二次改写、events 中 escalation.resolved 计数不变。
- Given 纪律：现场由既有 test.escalate + escalate resolve 产出，不手写 suspended+escalations；② 只换注入的 io.continueEscalation 桩（形状与 daemon 真实返回一致），不改 state.json。

---

#### AC-24 升级面板不越界：只有继续与取消

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-24`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/special-node-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\special-node-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 249ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-24 | exit=0 | 116ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-24.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-24.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 升级处理面板已打开（同 AC-21）。
- **When** 导出面板的全部可操作项与全部可调用动作。
- **Then** 可操作项恰为 `继续` 与 `取消` 两项；面板不含重派、终止、允许、拒绝、批量、跨实例筛选、通知开关；下钻层到数据层暴露的动作只有「继续」一个写动作。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-24.tests.stdout.txt` | 1510 B |
| `docs/iterations/iteration-10b/evidence/AC-24.test.source.txt` | 8056 B |
| `docs/iterations/iteration-10b/evidence/AC-24.arch.stdout.txt` | 226 B |
| `docs/iterations/iteration-10b/evidence/AC-24.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-24.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-24.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-24.meta.json` | 1233 B |
| `docs/iterations/iteration-10b/evidence/AC-24.status.txt` | 2196 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/special-node-jump.test.js）：测试文件存在 | ✅ | `test/wp14/special-node-jump.test.js` |
| 2 | 机检 F-16（test/wp14/special-node-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/special-node-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/special-node-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/special-node-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：无重派/终止/允许/拒绝动作（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.deepEqual(p.actions, [w('DRILL_ESC_CONTINUE'), w('DRILL_ESC_CANCEL')])（期望含 "assert.deepEqual(p.actions, [w('DRILL_ESC_CONTINUE'), w('DRILL_ESC_CANCEL')])"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 8 | Then 逐字：assert.deepEqual(p.actions, ['继续', '取消'])（期望含 "assert.deepEqual(p.actions, ['继续', '取消'])"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 9 | Then 逐字：面板可操作项恰为继续与取消；写动作只有 continue（期望含 "面板可操作项恰为继续与取消；写动作只有 continue"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 10 | Then 逐字：assert.equal(/reassign\|terminate\|approve\|deny/.test(src), false)（期望含 "assert.equal(/reassign\|terminate\|approve\|deny/.test(src), false)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 11 | Then 逐字：assert.equal(/reassign\|terminate\|approve\|deny/.test(daemon), false)（期望含 "assert.equal(/reassign\|terminate\|approve\|deny/.test(daemon), false)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |

**⑤ 判定**：通过

**备注**

- Then 逐字：可操作项恰为「继续」与「取消」两项（actions 数组逐项等于 [DRILL_ESC_CONTINUE, DRILL_ESC_CANCEL] = ['继续','取消']）；面板不含重派、终止、允许、拒绝、批量、跨实例筛选、通知开关。
- 机检：special-node-jump.test.js 断言 actions 逐项；escalation-continue.test.js 承担「写动作只有 continue」（transport seam 为唯一写动作，见 app.js:337 Contract A4）。两处 # pass≥1、# fail 0。
- 架构锚点：desktop/ui/drill/ 与 src/daemon/drill.js 对 reassign|terminate|approve|deny 零命中（exit 1）。

---

#### AC-26 跳转的三种降级：无会话 / 非 DSH / 未安装

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-26`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/host-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\host-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 267ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-26 | exit=0 | 152ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-26.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-26.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 三个现场：① 角色有 0 条活跃会话（会话全部 `idle`）；② 该角色会话宿主为 `mock`；③ `MAESTRO_DSH_EXE` 指向不存在的路径；`NODE_ENV=test`。
- **When** 依次点击「打开宿主会话」。
- **Then** ①按钮置灰、悬停提示 `无可跳转会话`；②提示 `宿主 mock 不支持跳转`；③提示 `未找到 DeepSeek Harness`；三次都不抛异常、不改变实例状态、不产生 DSH 进程。第四种降级（唤起失败 `跳转失败 · <原因>`）由 AC-46 单独判定，本 AC 不重复判定。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-26.tests.stdout.txt` | 1272 B |
| `docs/iterations/iteration-10b/evidence/AC-26.test.source.txt` | 12642 B |
| `docs/iterations/iteration-10b/evidence/AC-26.arch.stdout.txt` | 190 B |
| `docs/iterations/iteration-10b/evidence/AC-26.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-26.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-26.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-26.meta.json` | 1247 B |
| `docs/iterations/iteration-10b/evidence/AC-26.status.txt` | 1942 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/host-jump.test.js）：测试文件存在 | ✅ | `test/wp14/host-jump.test.js` |
| 2 | 机检 F-16（test/wp14/host-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/host-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/host-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/host-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：产品名走文案键，不在 UI 硬编码（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：none: '无可跳转会话'（期望含 "none: '无可跳转会话'"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 8 | Then 逐字：unsupported: (host) => `宿主 ${host} 不支持跳转`（期望含 "unsupported: (host) => `宿主 ${host} 不支持跳转`"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 9 | Then 逐字：missing: '未找到 DeepSeek Harness'（期望含 "missing: '未找到 DeepSeek Harness'"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 10 | Then 逐字：assert.equal(none.button.enabled, false)（期望含 "assert.equal(none.button.enabled, false)"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 11 | Then 逐字：assert.equal(none.button.disabledReason, A7.none)（期望含 "assert.equal(none.button.disabledReason, A7.none)"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 12 | Then 逐字：assert.equal(mock.button.disabledReason, A7.unsupported('mock'))（期望含 "assert.equal(mock.button.disabledReason, A7.unsupported('mock'))"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 13 | Then 逐字：assert.deepEqual(missing.toasts, [A7.missing])（期望含 "assert.deepEqual(missing.toasts, [A7.missing])"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 14 | Then 逐字：assert.equal(spawnSignals, 0, 'degradations must not produce a host-launch signal')（期望含 "assert.equal(spawnSignals, 0, 'degradations must not produce a host-launch signal')"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 15 | Then 逐字：assert.equal(sha256(makeState()), stateHashBefore, 'instance state unchanged')（期望含 "assert.equal(sha256(makeState()), stateHashBefore, 'instance state unchanged')"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |

**⑤ 判定**：通过

**备注**

- Then 逐字：① 0 活跃会话→按钮置灰+悬停「无可跳转会话」；② mock 宿主→「宿主 mock 不支持跳转」；③ MAESTRO_DSH_EXE 不存在→「未找到 DeepSeek Harness」。三条提示逐字取自 A-7 冻结文案，降级原因只由适配器错误码映射。
- 三次都不抛异常、不改变实例状态（stateHashBefore 不变）、不产生 DSH 进程（spawnSignals===0）。第四种降级「跳转失败 · <原因>」由 AC-46 单独判定，本 AC 不重复。
- 架构锚点：desktop/ui/ 对 DeepSeek Harness 零命中（exit 1），产品名走文案键。

---

#### AC-27 下钻层实时更新，会话变化不重排

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-27`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-live.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-live.test.js   | cwd=D:\WWW\Maestro | exit=0 | 292ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-27 | exit=0 | 328ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-27.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-27.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 已进入「开发」下钻（该角色此刻状态为「可用」，绑定节点存在但都不在服务中，故没有服务中节点）；记下 5 张卡片的顺序与 DAG 的节点集合；`NODE_ENV=test`。
- **When** 先用 `POST /__test__/graph/pulse`（`kind: "role"`，`key` 取该角色的 `roleId`，`statuses: ["serving"]`）把该角色从「可用」改为「服务中」，再在 200ms 内用 `kind: "session"` 让某会话连续变化 5 次；随后静默等待，让推送按既有规则到达。
- **Then** 状态栏的状态词转「服务中」（用户不用刷新就能看到）；会话的 5 次变化只让对应卡片的指示器跟着变，**卡片顺序不变、卡片不跳动、局部 DAG 不重排**，界面没有整体重绘的闪烁感。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-27.tests.stdout.txt` | 1555 B |
| `docs/iterations/iteration-10b/evidence/AC-27.test.source.txt` | 9530 B |
| `docs/iterations/iteration-10b/evidence/AC-27.arch.stdout.txt` | 425 B |
| `docs/iterations/iteration-10b/evidence/AC-27.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-27.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-27.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-27.meta.json` | 1156 B |
| `docs/iterations/iteration-10b/evidence/AC-27.status.txt` | 2227 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-live.test.js）：测试文件存在 | ✅ | `test/wp14/drill-live.test.js` |
| 2 | 机检 F-16（test/wp14/drill-live.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-live.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-live.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-live.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：下钻层不新增事件类型/定时器（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：drill.js 无私建 overlay 映射（只读既有 hub）（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：状态词 2s 内到达、会话 5 次变化只动指示器不重排（期望含 "状态词 2s 内到达、会话 5 次变化只动指示器不重排"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 9 | Then 逐字：app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }))（期望含 "app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }))"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 10 | Then 逐字：app.handleFrame(frame('session.indicator', 'SESS-' + i, { state: 'thinking' }))（期望含 "app.handleFrame(frame('session.indicator', 'SESS-' + i, { state: 'thinking' }))"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 11 | Then 逐字：assert.equal(v.roleBar.status, statusWord('serving'))（期望含 "assert.equal(v.roleBar.status, statusWord('serving'))"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 12 | Then 逐字：assert.deepEqual(order(v), beforeOrder)（期望含 "assert.deepEqual(order(v), beforeOrder)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 13 | Then 逐字：assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag)（期望含 "assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 14 | Then 逐字：assert.ok(roleAt - trigger <= 2000)（期望含 "assert.ok(roleAt - trigger <= 2000)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 15 | Then 逐字：assert.ok(app.state().frames.session <= 5)（期望含 "assert.ok(app.state().frames.session <= 5)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |

**⑤ 判定**：通过

**备注**

- Then 逐字：状态词由可用转服务中（statusWord('serving')，用户不刷新即见）；5 次会话变化只让对应卡片指示器跟着变，卡片顺序 order_before===order_after、DAG 节点集合不变、不整体重绘。
- 内部断言（非用户可见）：roleAt-trigger≤2000ms；每张卡片 top/height 差集空、dagCoords 差集空、indicatorFrames≤5。取数路径复用同一 pulse overlay（裁决 H 第 2 条），只翻状态词不翻 servingNodes/hostIcons，属已知限制照实登记。

---

#### AC-28 只读：浏览与跳转不改状态，只有「继续」会改

- 判定：**通过**（核对 18/18 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-28`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-readonly.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-readonly.test.js   | cwd=D:\WWW\Maestro | exit=0 | 485ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-28 | exit=0 | 156ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-28.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-28.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 一个运行中的实例与已进入下钻的界面；记下 `state.json`、`events.jsonl`、`traces.jsonl` 的字节哈希与节点/会话/交接包/升级四组状态；`NODE_ENV=test`。
- **When** 依次：进入/退出下钻 3 次、切看板与返回、展开 3 个交接包、打开 2 个节点详情、复制 3 条证据、下钻子流程并返回、点击「打开宿主会话」（mock 宿主，走降级）——**以上为前置动作，不计入下面的取数统计**；随后做 NF-4 的连续导航（进入下钻 / 退出 / 进入看板 / 下钻子流程各若干轮；**具体的次数与组合是机检的操作定义，不写进用户可见判据**）。
- **Then** 所有操作结束后，界面上状态栏、卡片列表、局部 DAG 三处与操作前**完全一致**（同一节点同一状态词、同一顺序），全程没有出现任何"已变更 / 已提交"类提示，也没有一次白屏或崩溃；连续导航下来界面仍然**切换无闪烁、无等待感**（进某个视图不用盯着空白等），从界面侧看不到重复加载的迹象；随后在一次「继续」操作后，界面才出现状态变化与该操作的提示（与本 AC 的只读断言分开记账）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-28.tests.stdout.txt` | 856 B |
| `docs/iterations/iteration-10b/evidence/AC-28.test.source.txt` | 5903 B |
| `docs/iterations/iteration-10b/evidence/AC-28.arch.stdout.txt` | 243 B |
| `docs/iterations/iteration-10b/evidence/AC-28.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-28.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-28.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-28.meta.json` | 1203 B |
| `docs/iterations/iteration-10b/evidence/AC-28.status.txt` | 1536 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-readonly.test.js）：测试文件存在 | ✅ | `test/wp14/drill-readonly.test.js` |
| 2 | 机检 F-16（test/wp14/drill-readonly.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-readonly.test.js）：# pass ≥ 1 | ✅ | `# pass=3` |
| 4 | 机检 F-16（test/wp14/drill-readonly.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-readonly.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill 层与 daemon 不写状态/不追加 span/不 emit（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(hash(files.state), before.state)（期望含 "assert.equal(hash(files.state), before.state)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 8 | Then 逐字：assert.equal(hash(files.events), before.events)（期望含 "assert.equal(hash(files.events), before.events)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 9 | Then 逐字：assert.equal(hash(files.traces), before.traces)（期望含 "assert.equal(hash(files.traces), before.traces)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 10 | Then 逐字：assert.deepEqual(after, groupsBefore)（期望含 "assert.deepEqual(after, groupsBefore)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 11 | Then 逐字：assert.equal(app.state().escalationNotice, null)（期望含 "assert.equal(app.state().escalationNotice, null)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 12 | Then 逐字：assert.equal(st.opCount, 40)（期望含 "assert.equal(st.opCount, 40)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 13 | Then 逐字：assert.equal(st.fetchCount, 30)（期望含 "assert.equal(st.fetchCount, 30)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 14 | Then 逐字：assert.ok(st.fetchCount <= st.opCount)（期望含 "assert.ok(st.fetchCount <= st.opCount)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 15 | Then 逐字：assert.equal(st.maxFetchesPerView, 1)（期望含 "assert.equal(st.maxFetchesPerView, 1)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 16 | Then 逐字：assert.equal(st.crashCount, 0)（期望含 "assert.equal(st.crashCount, 0)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 17 | Then 逐字：assert.equal(st.daemonRestarts, 0)（期望含 "assert.equal(st.daemonRestarts, 0)"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |
| 18 | Then 逐字：唯一写动作「继续」之后才出现状态变化提示（与只读分开记账）（期望含 "唯一写动作「继续」之后才出现状态变化提示（与只读分开记账）"） | ✅ | `/**<br> * WP-4 assembly contract: read-only browsing + stability counters (AC-28).<br> * Verifies the three state files are never written and the four state groups<br> * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.<br> */<br>import tes` |

**⑤ 判定**：通过

**备注**

- Then 逐字：所有只读浏览结束后，state/events/traces 三份文件字节哈希相等、四组状态深比较相等，三处视图（状态栏/卡片/DAG）与操作前一致；全程无「已变更/已提交」提示、无白屏崩溃；连续导航无闪烁无重复加载。
- 内部断言（非用户可见，故不入 Then）：opCount===40（进入下钻/退出/看板/子流程各 10）、fetchCount===30（10+10+10）、maxFetchesPerView===1、crashCount===0、daemonRestarts===0；随后一次「继续」才出现状态变化与提示。

---

#### AC-29 规划验收句端到端：发现异常 → 下钻 → 卡片 → 证据 → 处理升级 → 实例继续（全程无终端）

- 判定：**通过**（核对 29/29 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-29`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/acceptance-drill-e2e.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\acceptance-drill-e2e.test.js   | cwd=D:\WWW\Maestro | exit=0 | 389ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-29 | exit=0 | 138ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-29.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-29.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- 判据（规划逐字）：人在面板上完整走「角色流程图发现异常→下钻到角色→查看任务卡片→展开证据→处理升级→实例继续」，不需要终端；子工作流可下钻。**规划 874 行后段「一键跳转能打开 DSH 对应会话」不在本 AC 的判定范围内**——该段在 DSH 0.2.2-rc.1 上不可逐字达成，按裁决 A 由 AC-25 以「唤起 + 会话标识可核对（剪贴板 + 与实例状态一致）」判定；**本 AC 不声称该语义已达成，也不声称它被 AC-25「覆盖」**（属裁决 A 的偏离说明，证据见 `decisions.md`）。
- **Given** `$TEMP/maestro-i10b-acceptance` 的实例 `INST-001`：工作流含角色节点、1 个人工节点、1 个升级节点、1 个子工作流折叠组 `S-001`（`workflow: publish-child`，内部 **3 个角色节点**）；**异常面与证据面在 Given 里就造全**：① `T-003` 已升级、实例 `suspended`、1 条 `pending` 升级 `ESC-001` → 该角色在图上挂**红色角标**；② 角色对「开发→测试」上有一条 **`rejected` 的交接包 `HO-008`**（定义边 `kind: forward`）→ 该连线在图上呈**红色**（`rejected` 的视觉编码，I1.10a 既有；橙色 `expired` 的夹具在 AC-19，本 AC 不重复）；③ `T-003` 的最近一轮 `execution.summary` 逐字为 `{command:'npm test', exitCode:1, keyOutputLines:12, logRef:'logs/T-003.log'}`；`T-003` 的出向交接包 `HO-008` 携带 `products: ['artifacts/code/calc.js']`、`defects: [{evidence:'defects/d1.md'}]`、`artifactRefs: ['logs/T-003.log']`（证据段的三条引用由此而来）；项目根内真实存在 `artifacts/code/calc.js` 与 `logs/T-003.log`，`defects/d1.md` 故意不创建（与 AC-14 同一夹具口径）；④ `ESC-001` 的 `reasonDetail` 逐字为 `测试第 2 轮失败`、`defects` 为 `[{summary:'断言失败', evidence:'defects/d1.md'}]`（与 A-6 / AC-21 同一组字面值）；⑤ 升级节点 `X-001` 通过定义边 `T-003→X-001` 与本角色 1 跳相连，故第 ④ 步返回下钻后它在局部 DAG 上可见并可点击；`NODE_ENV=test`；界面已进入该实例的角色流程图。
- **When** 依次走下列**九步**（覆盖 Then 的 7 条；第 ⑦ 步是从升级面板回到角色流程图——先关闭面板回到角色下钻、再点「返回流程图」；第 ⑧、⑨ 步覆盖 Then 第 7 条）：① 在图上点击挂红色角标的角色 → ② 点排序第一的卡片 → ③ 展开证据段 → ④ 返回下钻 → ⑤ 点局部 DAG 上的升级节点 `X-001` → ⑥ 点「继续」并确认 → ⑦ 关闭升级面板回到角色下钻、再点「返回流程图」回到角色流程图 → ⑧ 点 `S-001` 折叠组进入子工作流 → ⑨ 点面包屑第一层回到角色流程图。
- **Then** 下列 **7 条**逐条成立（对应规划验收句的前两段；条数与下面列举的条数一致）：
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-29.tests.stdout.txt` | 2306 B |
| `docs/iterations/iteration-10b/evidence/AC-29.test.source.txt` | 18880 B |
| `docs/iterations/iteration-10b/evidence/AC-29.arch.stdout.txt` | 192 B |
| `docs/iterations/iteration-10b/evidence/AC-29.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-29.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-29.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-29.meta.json` | 1511 B |
| `docs/iterations/iteration-10b/evidence/AC-29.status.txt` | 2998 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/acceptance-drill-e2e.test.js）：测试文件存在 | ✅ | `test/wp14/acceptance-drill-e2e.test.js` |
| 2 | 机检 F-16（test/wp14/acceptance-drill-e2e.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/acceptance-drill-e2e.test.js）：# pass ≥ 1 | ✅ | `# pass=8` |
| 4 | 机检 F-16（test/wp14/acceptance-drill-e2e.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/acceptance-drill-e2e.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill 层无测试专用渲染分支（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：'graph-shown',（期望含 "'graph-shown',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 8 | Then 逐字：'drill-shown',（期望含 "'drill-shown',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 9 | Then 逐字：'detail-shown',（期望含 "'detail-shown',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 10 | Then 逐字：'evidence-shown',（期望含 "'evidence-shown',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 11 | Then 逐字：'escalation-shown',（期望含 "'escalation-shown',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 12 | Then 逐字：'continued',（期望含 "'continued',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 13 | Then 逐字：'graph-returned',（期望含 "'graph-returned',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 14 | Then 逐字：'subflow-shown',（期望含 "'subflow-shown',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 15 | Then 逐字：'graph-restored',（期望含 "'graph-restored',"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 16 | Then 逐字：assert.deepEqual(probes.map((p) => p.event), PROBE_ORDER（期望含 "assert.deepEqual(probes.map((p) => p.event), PROBE_ORDER"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 17 | Then 逐字：assert.deepEqual(p.abnormalRoles, ['T-003']（期望含 "assert.deepEqual(p.abnormalRoles, ['T-003']"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 18 | Then 逐字：assert.deepEqual(p.rejectedEdges, ['E-02']（期望含 "assert.deepEqual(p.rejectedEdges, ['E-02']"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 19 | Then 逐字：assert.equal(d.sections, 4（期望含 "assert.equal(d.sections, 4"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 20 | Then 逐字：assert.match(d.summaryLine, /退出码 1/（期望含 "assert.match(d.summaryLine, /退出码 1/"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 21 | Then 逐字：assert.ok(e.lines.some((l) => l.includes('可解析'))（期望含 "assert.ok(e.lines.some((l) => l.includes('可解析'))"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 22 | Then 逐字：assert.equal(p.count, 1（期望含 "assert.equal(p.count, 1"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 23 | Then 逐字：assert.equal(p.instanceState, 'running'（期望含 "assert.equal(p.instanceState, 'running'"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 24 | Then 逐字：assert.equal(p.nodeWord, '执行中'（期望含 "assert.equal(p.nodeWord, '执行中'"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 25 | Then 逐字：assert.equal(p.notice, word('DRILL_ESC_DONE', { id: 'ESC-001' })（期望含 "assert.equal(p.notice, word('DRILL_ESC_DONE', { id: 'ESC-001' })"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 26 | Then 逐字：assert.deepEqual(terminalEvents, []（期望含 "assert.deepEqual(terminalEvents, []"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 27 | Then 逐字：assert.equal(sub.roles, 3（期望含 "assert.equal(sub.roles, 3"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 28 | Then 逐字：assert.equal(back.view, 'graph'（期望含 "assert.equal(back.view, 'graph'"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |
| 29 | Then 逐字：timing.tContinued - timing.tConfirm <= 2000（期望含 "timing.tContinued - timing.tConfirm <= 2000"） | ✅ | `/**<br> * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。<br> *<br> * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片<br> * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。<br> *<br> * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面<br> * + 回环接口面」：所有九步都由真实 `createA` |

**⑤ 判定**：通过

**备注**

- Then 七条逐条：①红色角标+红色（rejected）连接线；②状态栏不可用/DAG 标 T-003/首卡 T-003；③四段齐全+证据含可解析+摘要退出码 1；④ESC-001 原因缺陷两行逐字等于 A-6；⑤继续后 suspended→running、提示「已继续 · ESC-001」无需刷新；⑥探针集无终端/CLI 事件；⑦S-001 进入子工作流 3 角色可见、面包屑第一层回流程图。
- 九步探针序列 ANCHOR：graph-shown→drill-shown→detail-shown→evidence-shown→escalation-shown→continued→graph-returned→subflow-shown→graph-restored，顺序固定。
- 内部断言：t_continued - t_confirm ≤ 2000（注入时钟，裁决 H 第 5 条）。复用 WP-6 已交付用例；规划 874 后段按裁决 A 归 AC-25，不在本 AC 判定范围。

---

#### AC-30 文案唯一来源、界面零中文、31 词扫描、零依赖

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测（静态机检面）
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-30`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test）；本 AC 为仓库静态检查，不读写 %TEMP% 业务数据] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test）；本 AC 为仓库静态检查，不读写 %TEMP% 业务数据"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/labels-drill.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\labels-drill.test.js   | cwd=D:\WWW\Maestro | exit=0 | 272ms
[node -p dependencies length] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe -p Object.keys(require('./package.json').dependencies||{}).length   | cwd=D:\WWW\Maestro | exit=0 | 94ms
[purity-check --dirs src/core,src/daemon --forbid <31 词>] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check   | cwd=D:\WWW\Maestro | exit=0 | 160ms
[purity-check --dirs desktop/ui,desktop/harness --forbid <31 词>] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\purity-check.mjs --dirs desktop/ui,desktop/harness --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check   | cwd=D:\WWW\Maestro | exit=0 | 119ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-30 | exit=0 | 141ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-30.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-30.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 本迭代实现完成；`NODE_ENV=test`。
- **When** 检查依赖、中文来源、禁词与宿主分支。
- **Then** `dependencies` 仍为 `{}`；`desktop/ui` 与 `desktop/harness` 无任何中文字面量；下钻层新增文案全部经文案表下发（键集合见附录 A-10）；`src/core` / `src/daemon` 零命中 31 词；全量测试的失败集合与允许集合差集为 0（口径见 §3.3 与裁决 G）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-30.tests.stdout.txt` | 2037 B |
| `docs/iterations/iteration-10b/evidence/AC-30.test.source.txt` | 20206 B |
| `docs/iterations/iteration-10b/evidence/AC-30.deps.stdout.txt` | 10 B |
| `docs/iterations/iteration-10b/evidence/AC-30.arch.stdout.txt` | 1285 B |
| `docs/iterations/iteration-10b/evidence/AC-30.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-30.state.json` | 158 B |
| `docs/iterations/iteration-10b/evidence/AC-30.events.jsonl` | 60 B |
| `docs/iterations/iteration-10b/evidence/AC-30.meta.json` | 1182 B |
| `docs/iterations/iteration-10b/evidence/AC-30.status.txt` | 5137 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/labels-drill.test.js）：测试文件存在 | ✅ | `test/wp14/labels-drill.test.js` |
| 2 | 机检 F-16（test/wp14/labels-drill.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/labels-drill.test.js）：# pass ≥ 1 | ✅ | `# pass=8` |
| 4 | 机检 F-16（test/wp14/labels-drill.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/labels-drill.test.js）：无 not ok | ✅ | `无` |
| 6 | 机检源码锚点：const CJK_PATTERN = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/（期望含 "const CJK_PATTERN = /[\\u3000-\\u303F\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF] | ✅ | `/**<br> * I1.10b WP-1：DRILL_* 下钻文案键冻结测试（`test/wp14/labels-drill.test.js`）。<br> *<br> * 承担（需求 AC-30 机检 + 拆分文档 §4 WP-1 + 附录 D-11）：<br> * ① A-10 全表 63 个 `DRILL_*` 新增键齐全，值逐字等于冻结基线（措辞与附录<br> *    A-1 ~ A-9 样例行一字不差；`DRILL_ROLE_STATUS_TOKEN` 为五 token JSON 映射）；<br> * ` |
| 7 | 机检源码锚点：test('AC-30：desktop/ui 与 desktop/harness 的 CJK 命中数为 0（子目录缺失按 0 命中）'（期望含 "test('AC-30：desktop/ui 与 desktop/harness 的 CJK 命中数为 0（子目录缺失按 0 命中）'"） | ✅ | `/**<br> * I1.10b WP-1：DRILL_* 下钻文案键冻结测试（`test/wp14/labels-drill.test.js`）。<br> *<br> * 承担（需求 AC-30 机检 + 拆分文档 §4 WP-1 + 附录 D-11）：<br> * ① A-10 全表 63 个 `DRILL_*` 新增键齐全，值逐字等于冻结基线（措辞与附录<br> *    A-1 ~ A-9 样例行一字不差；`DRILL_ROLE_STATUS_TOKEN` 为五 token JSON 映射）；<br> * ` |
| 8 | 机检源码锚点：EXPECTED_DRILL_KEYS（期望含 "EXPECTED_DRILL_KEYS"） | ✅ | `/**<br> * I1.10b WP-1：DRILL_* 下钻文案键冻结测试（`test/wp14/labels-drill.test.js`）。<br> *<br> * 承担（需求 AC-30 机检 + 拆分文档 §4 WP-1 + 附录 D-11）：<br> * ① A-10 全表 63 个 `DRILL_*` 新增键齐全，值逐字等于冻结基线（措辞与附录<br> *    A-1 ~ A-9 样例行一字不差；`DRILL_ROLE_STATUS_TOKEN` 为五 token JSON 映射）；<br> * ` |
| 9 | 机检源码锚点：DESKTOP_LABEL_KEYS（期望含 "DESKTOP_LABEL_KEYS"） | ✅ | `/**<br> * I1.10b WP-1：DRILL_* 下钻文案键冻结测试（`test/wp14/labels-drill.test.js`）。<br> *<br> * 承担（需求 AC-30 机检 + 拆分文档 §4 WP-1 + 附录 D-11）：<br> * ① A-10 全表 63 个 `DRILL_*` 新增键齐全，值逐字等于冻结基线（措辞与附录<br> *    A-1 ~ A-9 样例行一字不差；`DRILL_ROLE_STATUS_TOKEN` 为五 token JSON 映射）；<br> * ` |
| 10 | 机检源码锚点：UI_LABEL_KEYS（期望含 "UI_LABEL_KEYS"） | ✅ | `/**<br> * I1.10b WP-1：DRILL_* 下钻文案键冻结测试（`test/wp14/labels-drill.test.js`）。<br> *<br> * 承担（需求 AC-30 机检 + 拆分文档 §4 WP-1 + 附录 D-11）：<br> * ① A-10 全表 63 个 `DRILL_*` 新增键齐全，值逐字等于冻结基线（措辞与附录<br> *    A-1 ~ A-9 样例行一字不差；`DRILL_ROLE_STATUS_TOKEN` 为五 token JSON 映射）；<br> * ` |
| 11 | dependencies 恰为 {}（键数 0）（期望 "0"） | ✅ | `"0"` |
| 12 | 架构① src/core,src/daemon 31 词 purity exit 0（31 词全量字面） | ✅ | `exit=0<br>OK: 扫描 31 个文件，src/core, src/daemon 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, coordinator, arbiter, planner, summarizer, worker, data-analyst, fact-checker, editor, code-reviewer, compliance-reviewer, requ` |
| 13 | 架构② desktop/ui,desktop/harness 31 词 purity exit 0（31 词全量字面） | ✅ | `exit=0<br>OK: 扫描 31 个文件，desktop/ui, desktop/harness 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, coordinator, arbiter, planner, summarizer, worker, data-analyst, fact-checker, editor, code-reviewer, compliance-reviewe` |
| 14 | 禁词表恰好 31 词（不全写"同一词表"）（期望 31） | ✅ | `31` |

**⑤ 判定**：通过

**备注**

- Then 逐字：dependencies==={}（node -p 输出 0）；desktop/ui+desktop/harness 无中文字面量（CJK 命中 0，由 labels-drill 机检核对）；新增文案键经文案表下发（A-10 63 键齐全、既有键值不变）；31 词双目录 purity 零命中；回归失败集合差集 0（口径见 §3.3/裁决 G，由 AC-34 回归门禁承担）。
- 回归差集口径由裁决 G 三段式承载，不在本 AC 写死单一失败数字；本 AC 只判静态四面（依赖/中文/文案键/禁词）。

---

## 3. 不通过 / 阻塞项原始帧摘要

（本批无不通过 / 阻塞项；14 条判定全部为「通过」，证据分级 `mock 实测`。）

## 4. 汇总数字

| 项 | 值 |
|---|---|
| AC 总数（本批） | 14 |
| 通过 / 不通过 / 阻塞 | 14 / 0 / 0 |
| 核对项总数（通过 / 总） | 231 / 231 |
| 证据文件数（本批） | 114 |
| 覆盖 AC 数 | 14 |

> 四处一致：`results.jsonl`（本批 14 行，同 AC 取最后一条）、`summary-b.json`（total=14）、`parts/`（本批 14 份）、`evidence/`（本批 114 文件）均指向同一组判定。

## 5. 主控应独立复跑的 AC 建议（§3.5）

| AC | 理由 |
|---|---|
| AC-22 | 规划验收句末段唯一写动作（继续→实例恢复），两份等价夹具各跑一条路径的终态相等，是核心写链门控。 |
| AC-23 | 真守卫双 continue + 裁决 J-2 stateLabel 逐字；并发/重复提交异常停点，最易被放宽。 |
| AC-29 | 九步探针序列 + 七条 Then 端到端，覆盖无终端、子工作流、升级继续整链，复跑一次可交叉验证多条。 |

> 复跑命令：`node probe/acc10b-f-run.mjs AC-22 AC-23 AC-29`；复核每条 `evidence/AC-xx.*` 原始帧是否支撑其判定，尤其 AC-23 的 `escalation-label.txt`（J-2 逐字）与 AC-22 的双夹具终态。

## 6. 证据索引

共 114 个本批文件；每条 AC 至少 state / events / tests.stdout / arch.stdout / meta / status 原始帧，无空文件。

| AC | 文件数 | 证据文件 |
|---|---|---|
| AC-16 | 8 | `evidence/AC-16.arch.stdout.txt`<br>`evidence/AC-16.corestop.txt`<br>`evidence/AC-16.events.jsonl`<br>`evidence/AC-16.meta.json`<br>`evidence/AC-16.state.json`<br>`evidence/AC-16.status.txt`<br>`evidence/AC-16.test.source.txt`<br>`evidence/AC-16.tests.stdout.txt` |
| AC-17 | 8 | `evidence/AC-17.arch.stdout.txt`<br>`evidence/AC-17.corestop.txt`<br>`evidence/AC-17.events.jsonl`<br>`evidence/AC-17.meta.json`<br>`evidence/AC-17.state.json`<br>`evidence/AC-17.status.txt`<br>`evidence/AC-17.test.source.txt`<br>`evidence/AC-17.tests.stdout.txt` |
| AC-18 | 8 | `evidence/AC-18.arch.stdout.txt`<br>`evidence/AC-18.corestop.txt`<br>`evidence/AC-18.events.jsonl`<br>`evidence/AC-18.meta.json`<br>`evidence/AC-18.state.json`<br>`evidence/AC-18.status.txt`<br>`evidence/AC-18.test.source.txt`<br>`evidence/AC-18.tests.stdout.txt` |
| AC-19 | 8 | `evidence/AC-19.arch.stdout.txt`<br>`evidence/AC-19.corestop.txt`<br>`evidence/AC-19.events.jsonl`<br>`evidence/AC-19.meta.json`<br>`evidence/AC-19.state.json`<br>`evidence/AC-19.status.txt`<br>`evidence/AC-19.test.source.txt`<br>`evidence/AC-19.tests.stdout.txt` |
| AC-20 | 8 | `evidence/AC-20.arch.stdout.txt`<br>`evidence/AC-20.corestop.txt`<br>`evidence/AC-20.events.jsonl`<br>`evidence/AC-20.meta.json`<br>`evidence/AC-20.state.json`<br>`evidence/AC-20.status.txt`<br>`evidence/AC-20.test.source.txt`<br>`evidence/AC-20.tests.stdout.txt` |
| AC-21 | 8 | `evidence/AC-21.arch.stdout.txt`<br>`evidence/AC-21.corestop.txt`<br>`evidence/AC-21.events.jsonl`<br>`evidence/AC-21.meta.json`<br>`evidence/AC-21.state.json`<br>`evidence/AC-21.status.txt`<br>`evidence/AC-21.test.source.txt`<br>`evidence/AC-21.tests.stdout.txt` |
| AC-22 | 8 | `evidence/AC-22.arch.stdout.txt`<br>`evidence/AC-22.corestop.txt`<br>`evidence/AC-22.events.jsonl`<br>`evidence/AC-22.meta.json`<br>`evidence/AC-22.state.json`<br>`evidence/AC-22.status.txt`<br>`evidence/AC-22.test.source.txt`<br>`evidence/AC-22.tests.stdout.txt` |
| AC-23 | 9 | `evidence/AC-23.arch.stdout.txt`<br>`evidence/AC-23.corestop.txt`<br>`evidence/AC-23.escalation-label.txt`<br>`evidence/AC-23.events.jsonl`<br>`evidence/AC-23.meta.json`<br>`evidence/AC-23.state.json`<br>`evidence/AC-23.status.txt`<br>`evidence/AC-23.test.source.txt`<br>`evidence/AC-23.tests.stdout.txt` |
| AC-24 | 8 | `evidence/AC-24.arch.stdout.txt`<br>`evidence/AC-24.corestop.txt`<br>`evidence/AC-24.events.jsonl`<br>`evidence/AC-24.meta.json`<br>`evidence/AC-24.state.json`<br>`evidence/AC-24.status.txt`<br>`evidence/AC-24.test.source.txt`<br>`evidence/AC-24.tests.stdout.txt` |
| AC-26 | 8 | `evidence/AC-26.arch.stdout.txt`<br>`evidence/AC-26.corestop.txt`<br>`evidence/AC-26.events.jsonl`<br>`evidence/AC-26.meta.json`<br>`evidence/AC-26.state.json`<br>`evidence/AC-26.status.txt`<br>`evidence/AC-26.test.source.txt`<br>`evidence/AC-26.tests.stdout.txt` |
| AC-27 | 8 | `evidence/AC-27.arch.stdout.txt`<br>`evidence/AC-27.corestop.txt`<br>`evidence/AC-27.events.jsonl`<br>`evidence/AC-27.meta.json`<br>`evidence/AC-27.state.json`<br>`evidence/AC-27.status.txt`<br>`evidence/AC-27.test.source.txt`<br>`evidence/AC-27.tests.stdout.txt` |
| AC-28 | 8 | `evidence/AC-28.arch.stdout.txt`<br>`evidence/AC-28.corestop.txt`<br>`evidence/AC-28.events.jsonl`<br>`evidence/AC-28.meta.json`<br>`evidence/AC-28.state.json`<br>`evidence/AC-28.status.txt`<br>`evidence/AC-28.test.source.txt`<br>`evidence/AC-28.tests.stdout.txt` |
| AC-29 | 8 | `evidence/AC-29.arch.stdout.txt`<br>`evidence/AC-29.corestop.txt`<br>`evidence/AC-29.events.jsonl`<br>`evidence/AC-29.meta.json`<br>`evidence/AC-29.state.json`<br>`evidence/AC-29.status.txt`<br>`evidence/AC-29.test.source.txt`<br>`evidence/AC-29.tests.stdout.txt` |
| AC-30 | 9 | `evidence/AC-30.arch.stdout.txt`<br>`evidence/AC-30.corestop.txt`<br>`evidence/AC-30.deps.stdout.txt`<br>`evidence/AC-30.events.jsonl`<br>`evidence/AC-30.meta.json`<br>`evidence/AC-30.state.json`<br>`evidence/AC-30.status.txt`<br>`evidence/AC-30.test.source.txt`<br>`evidence/AC-30.tests.stdout.txt` |
