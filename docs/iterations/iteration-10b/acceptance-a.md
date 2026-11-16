# I1.10b S3 验收 · A 组（AC-01 ~ AC-15）

> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-4 逐字基线；
> `docs/templates/execution-template.md` §3.1~§3.5；`docs/iterations/iteration-10b/decisions.md` 裁决 G/H/J。
> 取证脚手架：`probe/acc10b-f-{lib,common,run,final}.mjs` + `probe/acc10b-cases/`（目录名不带 `-f`）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。

## 0. 总判

**15 条：通过 15 / 不通过 0 / 阻塞 0**

- 已产出证据与判定：15 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-10b/evidence/` 下 120 个（覆盖 15 条 AC，每条 ≥4 文件、无空文件）。
- 不通过 / 阻塞条目：无。
- 机器可读汇总：`probe/acc10b-f-summary.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`。
- 判定口径：`通过` = 需求 Then/And 全部核对项成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时（写明要求/试过路径/为何观测不到）。
- 判定纪律：只认需求原文 Then，不采信测试自述；文案逐字比对、数量核对数组长度、时序实测毫秒（`t_drill-t_click ≤ 1000`）。

## 1. AC 逐条判定表

| AC | 标题 | 判定 | 证据分级 | 核对项 | 证据文件数 |
|---|---|---|---|---|---|
| AC-01 | 从角色流程图进入角色下钻，状态栏 / 局部 DAG / 卡片一次可用 | **通过** | mock 实测 | 21/21 | 8 |
| AC-02 | 返回流程图后，流程图视图状态原样保留 | **通过** | mock 实测 | 20/20 | 8 |
| AC-03 | 角色状态栏只出现五个状态词，已结束实例显示「未参与」 | **通过** | mock 实测 | 11/11 | 8 |
| AC-04 | 状态栏的折叠、占位与多宿主并列 | **通过** | mock 实测 | 19/19 | 8 |
| AC-05 | 局部 DAG 只显示 1 跳，状态色 / 加粗 / 实线虚线正确 | **通过** | mock 实测 | 14/14 | 8 |
| AC-06 | 点击 DAG 任一节点都能滚动到对应卡片并高亮 | **通过** | mock 实测 | 10/10 | 8 |
| AC-07 | 任务卡片三层信息逐字正确 | **通过** | mock 实测 | 12/12 | 8 |
| AC-08 | 卡片按状态优先级排序，同档按归属与编号 | **通过** | mock 实测 | 11/11 | 8 |
| AC-09 | 会话指示器 6 态与「等待审批：动作」文案 | **通过** | mock 实测 | 15/15 | 8 |
| AC-10 | 特殊节点卡片与未知类型兜底 | **通过** | mock 实测 | 14/14 | 8 |
| AC-11 | 节点详情四段齐全，空段保留标题并给「无记录」 | **通过** | mock 实测 | 16/16 | 8 |
| AC-12 | 会话状态时间线：跨会话按时间正序合并 | **通过** | mock 实测 | 13/13 | 8 |
| AC-13 | ACP 事件摘要：四项齐全与缺项占位 | **通过** | mock 实测 | 9/9 | 8 |
| AC-14 | 证据引用：可解析 / 缺失两态，可复制，不判过期 | **通过** | mock 实测 | 11/11 | 8 |
| AC-15 | 交接包历史：入/出双向、按最近活动倒序 | **通过** | mock 实测 | 13/13 | 8 |

## 2. 逐 AC 取证明细（命令 / 需求原文 / 证据 / 逐项核对）

#### AC-01 从角色流程图进入角色下钻，状态栏 / 局部 DAG / 卡片一次可用

- 判定：**通过**（核对 21/21 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-01`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-entry.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-entry.test.js   | cwd=D:\WWW\Maestro | exit=0 | 209ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-01 | exit=0 | 97ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-01.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-01.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** `$TEMP/maestro-i10b-entry` 项目根内有一个实例 `INST-001`，工作流 5 个节点：`T-001`（开发，**执行中** `running`，轮次 1/3、`stateSince` `2026-11-15T09:40:00.000Z`）、`T-002`（开发，**待校验** `review`，轮次 2/3、`stateSince` `2026-11-15T10:04:00.000Z`，晚于其余绑定节点）、`T-003`（开发，**已完成** `done`，轮次 1/3、`stateSince` `2026-11-15T09:50:00.000Z`）、`T-004`（测试，待执行）、`T-005`（测试，已完成）；边 4 条：`T-001→T-004`、`T-002→T-004`、`T-004→T-003`、`T-005→T-002`（回流）。角色「开发」绑定 `T-001 / T-002 / T-003`；**3 条会话**：`T-001` 上一条 `thinking`（宿主 `dsh`）、`T-002` 上一条 `waiting_dependency`（宿主 `cursor`）、`T-003` 上一条 **`idle`**（宿主 `dsh`，空闲故不计入活跃）——因此**服务中节点恰为 `T-001, T-002`**、**活跃会话数 2**、**宿主去重后为 `dsh cursor`**、**最近动作是 `T-002`（轮次 2/3 · 待校验 · `stateSince` `2026-11-15T10:04:00.000Z`）**、**角色状态为「服务中」**；定义层 `maxRounds` 三个绑定节点均为 3；`NODE_ENV=test`；界面以 `createApp` 装配并已进入该实例的角色流程图。
- **When** 用户点击角色节点「开发」。
- **Then** 打开即见角色下钻（不出现等待或闪烁）：面包屑逐字为 `实例 INST-001 / 角色 开发`；状态栏一行逐字等于附录 A-1 **第 7 行**（`角色栏 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 最近 T-002 · 轮次 2/3 · 待校验`——五段全部由 Given 的投影结果决定，不是"若干"，**不存在「0 会话却有宿主」的形态**）；局部 DAG 的节点集合恰为 `T-001, T-002, T-003, T-004, T-005`（该角色 3 个节点 + 1 跳上下游 `T-004`、`T-005`），没有悬空端点；卡片数等于 5，首张是档位最高的一张（「执行中」的 `T-001` 排在「待校验」的 `T-002` 之前，见 BR-06 的档位序）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-01.tests.stdout.txt` | 1608 B |
| `docs/iterations/iteration-10b/evidence/AC-01.test.source.txt` | 10631 B |
| `docs/iterations/iteration-10b/evidence/AC-01.arch.stdout.txt` | 350 B |
| `docs/iterations/iteration-10b/evidence/AC-01.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-01.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-01.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-01.meta.json` | 1112 B |
| `docs/iterations/iteration-10b/evidence/AC-01.status.txt` | 2281 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-entry.test.js）：测试文件存在 | ✅ | `test/wp14/drill-entry.test.js` |
| 2 | 机检 F-16（test/wp14/drill-entry.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-entry.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-entry.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-entry.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill.js 无 saveState/appendSpan（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：drill.js 无宿主 if/switch 硬判（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：assert.equal(st.view, 'drill')（期望含 "assert.equal(st.view, 'drill')"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 9 | Then 逐字：'实例 INST-001 / 角色 开发'（期望含 "'实例 INST-001 / 角色 开发'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 10 | Then 逐字：'角色栏 开发'（期望含 "'角色栏 开发'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 11 | Then 逐字：'2 个活跃会话'（期望含 "'2 个活跃会话'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 12 | Then 逐字：'服务 T-001, T-002'（期望含 "'服务 T-001, T-002'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 13 | Then 逐字：'宿主 dsh cursor'（期望含 "'宿主 dsh cursor'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 14 | Then 逐字：最近 T-002 · 轮次 2/3 · （期望含 "最近 T-002 · 轮次 2/3 · "） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 15 | Then 逐字：assert.equal(view.cards.length, 5)（期望含 "assert.equal(view.cards.length, 5)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 16 | Then 逐字：assert.equal(view.cards[0].nodeId, 'T-001')（期望含 "assert.equal(view.cards[0].nodeId, 'T-001')"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 17 | Then 逐字：assert.equal(view.roleBar.activeSessions, 2)（期望含 "assert.equal(view.roleBar.activeSessions, 2)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 18 | Then 逐字：assert.deepEqual(view.roleBar.servingNodes, ['T-001', 'T-002'])（期望含 "assert.deepEqual(view.roleBar.servingNodes, ['T-001', 'T-002'])"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 19 | Then 逐字：assert.deepEqual(view.roleBar.hostIcons, ['dsh', 'cursor'])（期望含 "assert.deepEqual(view.roleBar.hostIcons, ['dsh', 'cursor'])"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 20 | Then 逐字：assert.ok(st.drillTiming.enteredAt - clickAt <= 1000)（期望含 "assert.ok(st.drillTiming.enteredAt - clickAt <= 1000)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 21 | Then 逐字：assert.equal(hash(stateFile), before)（期望含 "assert.equal(hash(stateFile), before)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点：附录 A-1 第 7 行「角色栏 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 最近 T-002 · 轮次 2/3 · 待校验」；源码由文案键拼行，逐字核对取拼行所需片段，机检 F-16 通过证明投影结果逐字相等。
- 内部断言：t_drill - t_click ≤ 1000（注入时钟 5000→5300，差 300ms）；进入前后 state.json 字节哈希不变（只读）。

---

#### AC-02 返回流程图后，流程图视图状态原样保留

- 判定：**通过**（核对 20/20 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-02`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-entry.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-entry.test.js   | cwd=D:\WWW\Maestro | exit=0 | 218ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-02 | exit=0 | 101ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-02.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-02.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 同 AC-01 的实例已进入流程图；用户已把缩放设为 150%、平移到 `(120, -40)`、把 `T-002` 拖动 `(+40, +60)`、折叠「编码工程」组、双击 `T-003` 进入 2 跳聚焦；`NODE_ENV=test`。
- **When** 进入「开发」下钻，再点「返回流程图」。
- **Then** 回到流程图后：缩放仍为 150%、平移仍为 `(120, -40)`、`T-002` 仍有 `(+40, +60)` 偏移、折叠状态与聚焦模式都与进入前一致；没有任何一次重新取数导致位置重置。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-02.tests.stdout.txt` | 1607 B |
| `docs/iterations/iteration-10b/evidence/AC-02.test.source.txt` | 10631 B |
| `docs/iterations/iteration-10b/evidence/AC-02.arch.stdout.txt` | 676 B |
| `docs/iterations/iteration-10b/evidence/AC-02.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-02.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-02.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-02.meta.json` | 1062 B |
| `docs/iterations/iteration-10b/evidence/AC-02.status.txt` | 2281 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-entry.test.js）：测试文件存在 | ✅ | `test/wp14/drill-entry.test.js` |
| 2 | 机检 F-16（test/wp14/drill-entry.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-entry.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-entry.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-entry.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：app.js createViewState 恰好 2 处（expect=exact:2） | ✅ | `exit=0 hits=2 \| 496:      const next = m.createViewState({ ; 695:      const next = m.createViewState({` |
| 7 | 架构：drill 内零 new createViewState（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | 架构：drill 内零整图重放（expect=zero） | ✅ | `exit=1 hits=0` |
| 9 | 架构：drill 内零 backToList（expect=zero） | ✅ | `exit=1 hits=0` |
| 10 | Then 逐字：vs.setZoom(1.5)（期望含 "vs.setZoom(1.5)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 11 | Then 逐字：vs.setPan(120, -40)（期望含 "vs.setPan(120, -40)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 12 | Then 逐字：vs.applyOffsets({ 'T-002': { dx: 40, dy: 60 } })（期望含 "vs.applyOffsets({ 'T-002': { dx: 40, dy: 60 } })"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 13 | Then 逐字：vs.focus('T-003', 2)（期望含 "vs.focus('T-003', 2)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 14 | Then 逐字：app.backToGraph()（期望含 "app.backToGraph()"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 15 | Then 逐字：s1.viewState !== null（期望含 "s1.viewState !== null"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 16 | Then 逐字：s1.viewState.getZoom(), before.zoom（期望含 "s1.viewState.getZoom(), before.zoom"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 17 | Then 逐字：s1.viewState.getPan(), before.pan（期望含 "s1.viewState.getPan(), before.pan"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 18 | Then 逐字：s1.viewState.getOffsets(), before.offsets（期望含 "s1.viewState.getOffsets(), before.offsets"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 19 | Then 逐字：s1.viewState.getFocus(), before.focus（期望含 "s1.viewState.getFocus(), before.focus"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 20 | Then 逐字：assert.equal(hits.length, 2)（期望含 "assert.equal(hits.length, 2)"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：缩放 150%、平移 (120,-40)、T-002 偏移 (+40,+60)、折叠编码工程组、2 跳聚焦 T-003，返回后五组逐字段相等；机检由 viewState 真值断言承载，避免走 backToList() 把状态整体清空。
- 架构检查第 ④ 条：返回实现在 app.js，backToList() 会把 viewState 置 null；机检断言返回后 viewState !== null 且五组值相等，使走错路径必然判红。

---

#### AC-03 角色状态栏只出现五个状态词，已结束实例显示「未参与」

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-03`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-entry.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-entry.test.js   | cwd=D:\WWW\Maestro | exit=0 | 207ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-03 | exit=0 | 102ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-03.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-03.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 两个实例：`INST-001`（运行中，5 个角色分别为可用 / 服务中 / 冷却中 / 不可用 / 未参与）、`INST-002`（已完成，同一个工作流）；`NODE_ENV=test`。
- **When** 依次进入两个实例中每个角色的下钻。
- **Then** 十个状态栏里的状态词只取自 `未参与 / 可用 / 服务中 / 冷却中 / 不可用`；`INST-002` 的角色全部显示「未参与」；界面上任何位置都不出现「已关闭」。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-03.tests.stdout.txt` | 1608 B |
| `docs/iterations/iteration-10b/evidence/AC-03.test.source.txt` | 10631 B |
| `docs/iterations/iteration-10b/evidence/AC-03.arch.stdout.txt` | 783 B |
| `docs/iterations/iteration-10b/evidence/AC-03.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-03.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-03.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-03.meta.json` | 1008 B |
| `docs/iterations/iteration-10b/evidence/AC-03.status.txt` | 2282 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-entry.test.js）：测试文件存在 | ✅ | `test/wp14/drill-entry.test.js` |
| 2 | 机检 F-16（test/wp14/drill-entry.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-entry.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-entry.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-entry.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill 无自算状态语义（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：daemon 下发状态词表（expect=min1） | ✅ | `exit=0 hits=4 \| 23:  ROLE_INSTANCE_STATUS_LABEL, ; 118:  // 五种 token，值与 `ROLE_INSTANCE_STATUS_LABEL` 同值），以 JSON 字符串承载 ; 197:  // 角色状态 token → 中文（A-10 逐字五 token 映射，与 ROLE_INSTANCE_STATUS_LABEL 同值）。` |
| 8 | 架构：desktop/ui + harness 无「已关闭」（expect=zero） | ✅ | `exit=1 hits=0` |
| 9 | Then 逐字：'可用', '服务中', '冷却中', '不可用', '未参与'（期望含 "'可用', '服务中', '冷却中', '不可用', '未参与'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 10 | Then 逐字：word('NODE_LABEL_REVIEW')（期望含 "word('NODE_LABEL_REVIEW')"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 11 | Then 逐字：allUi.includes('已关闭'), false（期望含 "allUi.includes('已关闭'), false"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：十行状态词只取「未参与/可用/服务中/冷却中/不可用」五词，INST-002 全「未参与」，任何位置不出现「已关闭」；机检把五词集合与界面全文扫描并列核对。
- 架构口径（裁决 H / A-10）：drill 不重算状态，中文值只在文案表，daemon 平铺下发键与词表。

---

#### AC-04 状态栏的折叠、占位与多宿主并列

- 判定：**通过**（核对 19/19 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-04`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-entry.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-entry.test.js   | cwd=D:\WWW\Maestro | exit=0 | 208ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-04 | exit=0 | 111ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-04.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-04.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 三个角色现场（**被断言的每一段都由 Given 的投影结果决定，夹具不手写状态词与整行**，且每个现场都是既有投影真能产出的形态）：① `开发`——绑定 `T-001 需求澄清 / T-002 实现登录 / T-003 联调` 三个节点且**三个都是服务中节点**（`T-001` 执行中、`T-002` 待校验、`T-003` 执行中；`stateSince` 依次 `2026-11-15T09:40:00.000Z` / `2026-11-15T10:04:00.000Z` / `2026-11-15T09:50:00.000Z`，`T-002` 最晚），3 条非空闲会话分别挂在 `T-001`（宿主 `dsh`）、`T-002`（宿主 `cursor`）、`T-003`（宿主 `dsh`）→ **活跃会话 3、服务节点折叠为 `服务 T-001 等 3 个`、宿主去重按服务中节点顺序为 `dsh cursor`、最近动作 `T-002` 轮次 `2/3` 状态「待校验」`stateSince` `2026-11-15T10:04:00.000Z`**，角色状态「服务中」（→ A-1 第 4 行）；② `测试`——**有 1 个绑定节点 `T-010`（待执行）、0 条会话**：服务中节点为空（→ `服务 —`）、宿主为空（→ `宿主 —`，**这里同时演示"0 会话一定没有宿主"**）、最近动作是 `T-010`（→ `最近 T-010 · 轮次 1/1 · 待执行`）、状态「可用」（→ A-1 第 2 行）；③ `协调者`——**没有任何绑定节点**、0 条会话：状态「未参与」、`服务 —`、`宿主 —`、`最近 —`（→ A-1 第 3 行）；三个现场共用一份 `state.json` 与一份工作流定义，定义层 `maxRounds` 为 `T-001/T-002/T-003 → 3`、`T-010 → 1`；`NODE_ENV=test`。
- **When** 分别进入三者的下钻。
- **Then** 三行逐字等于附录 A-1 的**第 4、2、3 行**——第 4 行 `角色栏 开发 · 服务中 · 3 个活跃会话 · 服务 T-001 等 3 个 · 宿主 dsh cursor · 最近 T-002 · 轮次 2/3 · 待校验`、第 2 行 `角色栏 测试 · 可用 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 T-010 · 轮次 1/1 · 待执行`、第 3 行 `角色栏 协调者 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —`：服务节点超过 2 个折叠为 `服务 T-001 等 3 个`、多宿主并列 `宿主 dsh cursor`、0 会话为 `0 个活跃会话`、无服务中节点为 `服务 —`、**无宿主为 `宿主 —`（不出现"0 会话却有宿主"）**、无绑定节点为 `最近 —`（且其后不再打印轮次与状态）；不出现 `undefined` / `null` / 空字段。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-04.tests.stdout.txt` | 1608 B |
| `docs/iterations/iteration-10b/evidence/AC-04.test.source.txt` | 10631 B |
| `docs/iterations/iteration-10b/evidence/AC-04.arch.stdout.txt` | 187 B |
| `docs/iterations/iteration-10b/evidence/AC-04.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-04.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-04.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-04.meta.json` | 1098 B |
| `docs/iterations/iteration-10b/evidence/AC-04.status.txt` | 2282 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-entry.test.js）：测试文件存在 | ✅ | `test/wp14/drill-entry.test.js` |
| 2 | 机检 F-16（test/wp14/drill-entry.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-entry.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-entry.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-entry.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：daemon 不拼折叠/省略文案（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：'服务 T-001 等 3 个'（期望含 "'服务 T-001 等 3 个'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 8 | Then 逐字：'宿主 dsh cursor'（期望含 "'宿主 dsh cursor'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 9 | Then 逐字：'3 个活跃会话'（期望含 "'3 个活跃会话'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 10 | Then 逐字：app.state().drillView.roleBar.servingFolded, true（期望含 "app.state().drillView.roleBar.servingFolded, true"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 11 | Then 逐字：app.state().drillView.roleBar.servingNodes.length, 3（期望含 "app.state().drillView.roleBar.servingNodes.length, 3"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 12 | Then 逐字：'角色栏 测试'（期望含 "'角色栏 测试'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 13 | Then 逐字：'0 个活跃会话'（期望含 "'0 个活跃会话'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 14 | Then 逐字：lastAction: { nodeId: 'T-010'（期望含 "lastAction: { nodeId: 'T-010'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 15 | Then 逐字：最近 T-010 · 轮次 1/1 · （期望含 "最近 T-010 · 轮次 1/1 · "） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 16 | Then 逐字：app.state().drillView.roleBar.hostIcons, []（期望含 "app.state().drillView.roleBar.hostIcons, []"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 17 | Then 逐字：'角色栏 协调者'（期望含 "'角色栏 协调者'"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 18 | Then 逐字：lastAction: null（期望含 "lastAction: null"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |
| 19 | Then 逐字：app.state().drillView.roleBar.lastAction, null（期望含 "app.state().drillView.roleBar.lastAction, null"） | ✅ | `/**<br> * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).<br> *<br> * The assertions drive the REAL `createApp` assembly path with real frozen<br> * label keys and the real `createDrillView` module. No test-only render<br> * ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：第 4 行「服务 T-001 等 3 个 · 宿主 dsh cursor」、第 2 行「测试 · 可用 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 T-010 · 轮次 1/1 · 待执行」、第 3 行「协调者 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —」，无 undefined/null/空字段。
- 夹具不手写状态词与整行：折叠与占位只在渲染层，daemon 只下发 servingNodes[]/hostIcons[] 结构化字段。

---

#### AC-05 局部 DAG 只显示 1 跳，状态色 / 加粗 / 实线虚线正确

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-05`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-dag.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-dag.test.js   | cwd=D:\WWW\Maestro | exit=0 | 205ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-05 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-05.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-05.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 工作流 `A(开发) → B(开发) → C(测试) → D(开发)`，另有 `B → E(开发)` 与回流 `D → B`；运行时 `A` 已完成、`B` 执行中、`C` 待执行、`D` 待执行、`E` 已完成；`NODE_ENV=test`。
- **When** 进入「开发」的下钻。
- **Then** 可见节点恰为 `A, B, C, D, E`（本角色 A/B/D + 1 跳 C/E）；可见连线恰为 `A→B, B→C, B→E, C→D, D→B` 五条；`D→B` 画成虚线且方向标为「回流」、其余四条画成实线且标为「正向」；`A/B/D` 三个本角色节点的边框明显比 `C/E` 粗（用户一眼能分出"哪些是我的"）；没有悬空端点，也没有线画到画布外；同一份数据两次打开，节点与连线的位置完全一致（不跳动）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-05.tests.stdout.txt` | 1377 B |
| `docs/iterations/iteration-10b/evidence/AC-05.test.source.txt` | 5919 B |
| `docs/iterations/iteration-10b/evidence/AC-05.arch.stdout.txt` | 190 B |
| `docs/iterations/iteration-10b/evidence/AC-05.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-05.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-05.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-05.meta.json` | 1026 B |
| `docs/iterations/iteration-10b/evidence/AC-05.status.txt` | 2047 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-dag.test.js）：测试文件存在 | ✅ | `test/wp14/drill-dag.test.js` |
| 2 | 机检 F-16（test/wp14/drill-dag.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-dag.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-dag.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-dag.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：dag.js 不做图遍历 BFS（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：result.nodes.map((n) => n.nodeId), ['A', 'B', 'D', 'C', 'E']（期望含 "result.nodes.map((n) => n.nodeId), ['A', 'B', 'D', 'C', 'E']"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 8 | Then 逐字：result.nodes.filter((n) => n.bold).map((n) => n.nodeId), ['A', 'B', 'D']（期望含 "result.nodes.filter((n) => n.bold).map((n) => n.nodeId), ['A', 'B', 'D']"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 9 | Then 逐字：result.dangling, 0（期望含 "result.dangling, 0"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 10 | Then 逐字：back.style, 'dashed'（期望含 "back.style, 'dashed'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 11 | Then 逐字：'局部连线 D→B · 回流 · 待执行'（期望含 "'局部连线 D→B · 回流 · 待执行'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 12 | Then 逐字：'局部连线 A→B · 正向 · 已完成'（期望含 "'局部连线 A→B · 正向 · 已完成'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 13 | Then 逐字：'solid'（期望含 "'solid'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 14 | Then 逐字：JSON.stringify(a), JSON.stringify(b)（期望含 "JSON.stringify(a), JSON.stringify(b)"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |

**⑤ 判定**：通过

**备注**

- Then 逐字：可见节点恰为 A/B/C/D/E（本角色 A/B/D + 1 跳 C/E），连线 A→B/B→C/B→E/C→D/D→B 五条，D→B 虚线标「回流」其余实线标「正向」，本角色三节点加粗，无悬空端点，两次布局坐标逐字节相等。
- 架构：1 跳只取直接前后驱，禁 BFS/visited/queue（A-2 局部节点/连线行由投影产出）。

---

#### AC-06 点击 DAG 任一节点都能滚动到对应卡片并高亮

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-06`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-dag.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-dag.test.js   | cwd=D:\WWW\Maestro | exit=0 | 204ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-06 | exit=0 | 103ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-06.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-06.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 同 AC-05 的下钻视图（5 张卡片）；`NODE_ENV=test`。
- **When** 依次点击 `A`、`C`、`E` 三个节点。
- **Then** 每次点击后，右侧列表都滚到该节点对应的那张卡片上并把它高亮（用户能确认"点对了"）；三次都命中，没有一次"点了没反应"；卡片已在可视区时也照样给一次高亮；高亮持续到下一次点击。**不用等**：从点击到看到结果没有可感知的停顿（数值阈值属内部断言，见机检）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-06.tests.stdout.txt` | 1377 B |
| `docs/iterations/iteration-10b/evidence/AC-06.test.source.txt` | 5919 B |
| `docs/iterations/iteration-10b/evidence/AC-06.arch.stdout.txt` | 190 B |
| `docs/iterations/iteration-10b/evidence/AC-06.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-06.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-06.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-06.meta.json` | 958 B |
| `docs/iterations/iteration-10b/evidence/AC-06.status.txt` | 2047 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-dag.test.js）：测试文件存在 | ✅ | `test/wp14/drill-dag.test.js` |
| 2 | 机检 F-16（test/wp14/drill-dag.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-dag.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-dag.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-dag.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：dag.js 联动不重新取数（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：view.scrollTarget, target（期望含 "view.scrollTarget, target"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 8 | Then 逐字：view.highlight, target（期望含 "view.highlight, target"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 9 | Then 逐字：view.lastElapsed <= 200（期望含 "view.lastElapsed <= 200"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 10 | Then 逐字：view.cards.length, view.dag.nodes.length（期望含 "view.cards.length, view.dag.nodes.length"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |

**⑤ 判定**：通过

**备注**

- Then 逐字：依次点击 A、C、E，每次滚到对应卡片并高亮，三次都命中、卡片已在可视区也给高亮、高亮持续到下一次点击；「不用等」为内部断言 elapsed ≤ 200ms（注入时钟）。
- 联动只改视图状态，不触发重新取数（dag.js 零 fetch/request）。

---

#### AC-07 任务卡片三层信息逐字正确

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-07`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-cards.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-cards.test.js   | cwd=D:\WWW\Maestro | exit=0 | 203ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-07 | exit=0 | 107ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-07.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-07.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 两张卡片现场，**A-3 第 1~6 行里被逐字断言的每个字段都在这里钉住**：`T-003`——标题 `实现登录`、归属角色「开发」、节点状态**执行中**（`running`）、轮次 **1/2**、该节点最新会话状态**执行中**（`thinking`）、`stateSince` = 注入时钟 − **12 分钟**、当前工具 **`write`**、依赖 **`T-001`（已完成）**、产物 **`calc.js`**、证据引用 **2** 条；`T-001`——标题 **`需求澄清`**、归属角色「协调者」、节点状态**已完成**（`done`）、轮次 **1/1**、**没有任何会话**、无依赖、无产物、证据 **0** 条；`NODE_ENV=test`；渲染时钟注入为固定值。
- **When** 导出这两张卡片的三层文本。
- **Then** 逐字等于附录 A-3 的第 1~6 行（三行一张、两张共六行）；`已运行 12m` 由注入时钟与 `stateSince` 得出；无会话时执行行显示 `执行 协调者 · 无会话 · — · 工具 —`；依赖为空显示 `依赖 —`、产物为空显示 `产物 —`、证据为 0 显示 `证据 0`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-07.tests.stdout.txt` | 1251 B |
| `docs/iterations/iteration-10b/evidence/AC-07.test.source.txt` | 8025 B |
| `docs/iterations/iteration-10b/evidence/AC-07.arch.stdout.txt` | 214 B |
| `docs/iterations/iteration-10b/evidence/AC-07.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-07.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-07.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-07.meta.json` | 837 B |
| `docs/iterations/iteration-10b/evidence/AC-07.status.txt` | 1925 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-cards.test.js）：测试文件存在 | ✅ | `test/wp14/drill-cards.test.js` |
| 2 | 机检 F-16（test/wp14/drill-cards.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-cards.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-cards.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-cards.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill 中文走文案键（无中文模板字面量）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：卡片 T-003 · 实现登录 · 轮次 1/2 · 执行中（期望含 "卡片 T-003 · 实现登录 · 轮次 1/2 · 执行中"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 8 | Then 逐字：执行 开发 · 执行中 · 已运行 12m · 工具 write（期望含 "执行 开发 · 执行中 · 已运行 12m · 工具 write"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 9 | Then 逐字：依赖 T-001 已完成 · 产物 calc.js · 证据 2（期望含 "依赖 T-001 已完成 · 产物 calc.js · 证据 2"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 10 | Then 逐字：卡片 T-001 · 需求澄清 · 轮次 1/1 · 已完成（期望含 "卡片 T-001 · 需求澄清 · 轮次 1/1 · 已完成"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 11 | Then 逐字：执行 协调者 · 无会话 · — · 工具 —（期望含 "执行 协调者 · 无会话 · — · 工具 —"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 12 | Then 逐字：依赖 — · 产物 — · 证据 0（期望含 "依赖 — · 产物 — · 证据 0"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |

**⑤ 判定**：通过

**备注**

- Then 逐字：A-3 六行（正常卡三行 + 空值卡三行）；已运行 12m 由注入时钟与 stateSince 得出。
- 卡片文本模板只来自文案表，drill 目录对「已运行/轮次/依赖」零命中。

---

#### AC-08 卡片按状态优先级排序，同档按归属与编号

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-08`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-cards.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-cards.test.js   | cwd=D:\WWW\Maestro | exit=0 | 190ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-08 | exit=0 | 105ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-08.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-08.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 下钻范围内 9 个节点，逐一点名（编号 / 状态 / 归属）：`T-010` 已升级 / 本角色、`T-011` 失败 / 下游、`T-012` **`assigned`（已分配）/ 上游**、`T-013` `running`（执行中）/ 本角色、`T-014` 待校验 / 下游、`T-015` 待执行且上游已全部完成（可调度）/ 上游、`T-016` 待执行且上游未完成（被阻塞）/ 本角色、`T-017` 已完成 / 本角色、`T-018` 已完成 / 下游；九个节点覆盖基线 489 的**全部 8 个档位**（`done` 两例）；`NODE_ENV=test`。
- **When** 导出卡片顺序。
- **Then** 顺序为 `T-010 → T-011 → T-013 → T-014 → T-012 → T-015 → T-016 → T-017 → T-018`：档位顺序逐字对齐基线 489——**已升级 > 失败 > 执行中 > 待校验 > 已分配 > 可调度 > 被阻塞 > 已完成**（8 档）；`assigned` 是**独立一档**，位于「待校验」之后、「可调度」之前，**不得抬到「待校验」之前**；`T-012` 的**显示词**仍是「执行中」（显示词折叠不等于排序折叠，见 BR-06）；同档内先本角色、再上游、再下游，最后按节点编号升序；已完成的 `T-017`（本角色）排在 `T-018`（下游）之前。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-08.tests.stdout.txt` | 1252 B |
| `docs/iterations/iteration-10b/evidence/AC-08.test.source.txt` | 8025 B |
| `docs/iterations/iteration-10b/evidence/AC-08.arch.stdout.txt` | 199 B |
| `docs/iterations/iteration-10b/evidence/AC-08.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-08.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-08.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-08.meta.json` | 992 B |
| `docs/iterations/iteration-10b/evidence/AC-08.status.txt` | 1926 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-cards.test.js）：测试文件存在 | ✅ | `test/wp14/drill-cards.test.js` |
| 2 | 机检 F-16（test/wp14/drill-cards.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-cards.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-cards.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-cards.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：cards.js 排序不读时间/DOM（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：'T-010', 'T-011', 'T-013', 'T-014', 'T-012', 'T-015', 'T-016', 'T-017', 'T-018'（期望含 "'T-010', 'T-011', 'T-013', 'T-014', 'T-012', 'T-015', 'T-016', 'T-017', 'T-018'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 8 | Then 逐字：assert.deepEqual(result.map((c) => c.rank), [1, 2, 3, 4, 5, 6, 7, 8, 8])（期望含 "assert.deepEqual(result.map((c) => c.rank), [1, 2, 3, 4, 5, 6, 7, 8, 8])"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 9 | Then 逐字：assert.equal(result.find((c) => c.nodeId === 'T-012').tier, 'assigned')（期望含 "assert.equal(result.find((c) => c.nodeId === 'T-012').tier, 'assigned')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 10 | Then 逐字：assert.equal(result.find((c) => c.nodeId === 'T-012').displayStatus, '执行中')（期望含 "assert.equal(result.find((c) => c.nodeId === 'T-012').displayStatus, '执行中')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 11 | Then 逐字：'escalated', 'failed', 'running', 'review', 'assigned', 'ready', 'blocked', 'done'（期望含 "'escalated', 'failed', 'running', 'review', 'assigned', 'ready', 'blocked', 'done'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |

**⑤ 判定**：通过

**备注**

- Then 逐字：8 档顺序「已升级>失败>执行中>待校验>已分配>可调度>被阻塞>已完成」，assigned 独立一档位于 review 之后、ready 之前；rank 序列 [1,2,3,4,5,6,7,8,8] 单调不减（9 节点含 done 两例）；T-012 显示词「执行中」但档位 assigned。
- 显示词折叠 ≠ 排序档位折叠（F4-01）。

---

#### AC-09 会话指示器 6 态与「等待审批：动作」文案

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-09`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-cards.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-cards.test.js   | cwd=D:\WWW\Maestro | exit=0 | 192ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-09 | exit=0 | 123ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-09.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-09.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 6 张卡片分别对应 6 种会话：空闲、执行中、执行中且正在调用工具、等待审批（动作 `git_push`）、等待下游、已升级；另有一张卡片没有任何会话；`NODE_ENV=test`。
- **When** 导出 7 张卡片的状态栏投影。
- **Then** 逐项等于附录 A-3 的指示器表：`idle → 空闲/灰/无动画`、`thinking → 执行中/蓝/脉冲`、`tool_running → 执行中/蓝/脉冲/工具图标`、`waiting_input → 等待审批：git_push/黄/无动画`、`waiting_dependency → 等待下游/黄`、`escalated → 已升级/红`、无会话 → `无会话/灰`；每张卡片只有一个指示器。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-09.tests.stdout.txt` | 1252 B |
| `docs/iterations/iteration-10b/evidence/AC-09.test.source.txt` | 8025 B |
| `docs/iterations/iteration-10b/evidence/AC-09.arch.stdout.txt` | 171 B |
| `docs/iterations/iteration-10b/evidence/AC-09.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-09.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-09.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-09.meta.json` | 1085 B |
| `docs/iterations/iteration-10b/evidence/AC-09.status.txt` | 1926 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-cards.test.js）：测试文件存在 | ✅ | `test/wp14/drill-cards.test.js` |
| 2 | 机检 F-16（test/wp14/drill-cards.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-cards.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-cards.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-cards.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：desktop/ui 无硬编码 git_push（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：'等待审批：git_push'（期望含 "'等待审批：git_push'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 8 | Then 逐字：'：git_push'（期望含 "'：git_push'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 9 | Then 逐字：['空闲', 'gray', 'none', null, '']（期望含 "['空闲', 'gray', 'none', null, '']"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 10 | Then 逐字：['执行中', 'blue', 'pulse', null, '']（期望含 "['执行中', 'blue', 'pulse', null, '']"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 11 | Then 逐字：['执行中', 'blue', 'pulse', 'tool', '']（期望含 "['执行中', 'blue', 'pulse', 'tool', '']"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 12 | Then 逐字：['等待下游', 'yellow', 'none', null, '']（期望含 "['等待下游', 'yellow', 'none', null, '']"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 13 | Then 逐字：['已升级', 'red', 'none', null, '']（期望含 "['已升级', 'red', 'none', null, '']"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 14 | Then 逐字：['无会话', 'gray', 'none', null, '']（期望含 "['无会话', 'gray', 'none', null, '']"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 15 | Then 逐字：assert.equal(result.length, 7)（期望含 "assert.equal(result.length, 7)"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |

**⑤ 判定**：通过

**备注**

- Then 逐字：7 组 {label,color,animation,icon,detail} 逐项等于 A-3 指示器表；idle→空闲/灰、thinking→执行中/蓝/脉冲、tool_running→执行中/蓝/脉冲/工具图标、waiting_input→等待审批：git_push/黄、waiting_dependency→等待下游/黄、escalated→已升级/红、无会话→无会话/灰；每卡一个指示器。
- 动作名来自数据（approvals 记录），desktop/ui 对 git_push 零命中。

---

#### AC-10 特殊节点卡片与未知类型兜底

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-10`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-cards.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-cards.test.js   | cwd=D:\WWW\Maestro | exit=0 | 184ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-10 | exit=0 | 103ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-10.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-10.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 下钻范围内有 5 个节点，逐项钉住「编号 / 类型 / 标题 / 轮次 / 状态」：① `H-001`，`node_type: human`，标题 `人工验收`，轮次 `0/1`，运行时无记录（按「待执行」）；② `X-001`，`node_type: escalate`，标题 `人工裁决`，轮次 `2/2`，节点状态「已升级」；③ `S-001`，`node_type: subworkflow`（`workflow: 发布子流程`，内部 3 个角色），轮次 `1/1`，运行时无记录（按「待执行」）；④ `U-001`，`node_type: notify-broadcast`（**未知类型**，定义里不属于 human/escalate/subworkflow/role），标题 `播报确认`，轮次 `1/1`，运行时状态 `pending`（按「待执行」）；⑤ `Z-001`，`node_type: role`，标题 `未知任务`，轮次 `1/1`，运行时状态为历史值 `mystery`（非九态）；`NODE_ENV=test`。
- **When** 导出卡片。
- **Then** 五张卡片逐行等于附录 A-3 的**五行特殊/异常逐字行**（人工节点行、升级节点行、子工作流行、未知类型行 `卡片 U-001 · 播报确认 · 轮次 1/1 · 待执行`、未知状态行 `卡片 Z-001 · 未知任务 · 轮次 1/1 · 状态未知`）；`U-001` 按角色节点显示（无类型前缀）并保留编号；`mystery` 节点落在**「被阻塞」档**且标题行末尾为「状态未知」，同一节点在 7 列看板上也归「被阻塞」列（同口径，不是"看板阻塞、卡片可调度"）；卡片总数 = 5，无卡片丢失、无异常抛出。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-10.tests.stdout.txt` | 1253 B |
| `docs/iterations/iteration-10b/evidence/AC-10.test.source.txt` | 8025 B |
| `docs/iterations/iteration-10b/evidence/AC-10.arch.stdout.txt` | 199 B |
| `docs/iterations/iteration-10b/evidence/AC-10.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-10.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-10.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-10.meta.json` | 958 B |
| `docs/iterations/iteration-10b/evidence/AC-10.status.txt` | 1927 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-cards.test.js）：测试文件存在 | ✅ | `test/wp14/drill-cards.test.js` |
| 2 | 机检 F-16（test/wp14/drill-cards.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-cards.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-cards.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-cards.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill 不按标题猜类型（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：卡片 人工节点 H-001 · 人工验收 · 轮次 0/1 · 待执行（期望含 "卡片 人工节点 H-001 · 人工验收 · 轮次 0/1 · 待执行"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 8 | Then 逐字：卡片 升级节点 X-001 · 人工裁决 · 轮次 2/2 · 已升级（期望含 "卡片 升级节点 X-001 · 人工裁决 · 轮次 2/2 · 已升级"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 9 | Then 逐字：卡片 子工作流：发布子流程 · 角色 3 · 轮次 1/1 · 待执行（期望含 "卡片 子工作流：发布子流程 · 角色 3 · 轮次 1/1 · 待执行"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 10 | Then 逐字：卡片 U-001 · 播报确认 · 轮次 1/1 · 待执行（期望含 "卡片 U-001 · 播报确认 · 轮次 1/1 · 待执行"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 11 | Then 逐字：卡片 Z-001 · 未知任务 · 轮次 1/1 · 状态未知（期望含 "卡片 Z-001 · 未知任务 · 轮次 1/1 · 状态未知"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 12 | Then 逐字：z.tier, 'blocked'（期望含 "z.tier, 'blocked'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 13 | Then 逐字：z.boardColumn, 'blocked'（期望含 "z.boardColumn, 'blocked'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 14 | Then 逐字：assert.equal(result.length, 5)（期望含 "assert.equal(result.length, 5)"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |

**⑤ 判定**：通过

**备注**

- Then 逐字：A-3 五行特殊/异常逐字；U-001 按角色节点显示无类型前缀并保留编号；mystery 节点落「被阻塞」档、标题末尾「状态未知」且看板同归 blocked；卡片总数 5，无丢失无异常。
- 架构：类型只从定义层 node_type 读（裁决 D）；drill 对具体标题零命中。

---

#### AC-11 节点详情四段齐全，空段保留标题并给「无记录」

- 判定：**通过**（核对 16/16 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-11`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/node-detail.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\node-detail.test.js   | cwd=D:\WWW\Maestro | exit=0 | 189ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-11 | exit=0 | 105ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-11.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-11.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 两个节点：`T-003`（有 3 条时间线、1 条摘要、**3 条证据**（1 条产物 + 1 条缺陷 + 1 条产物引用）、1 条交接）、`T-004`（四段全空）；`NODE_ENV=test`。
- **When** 依次打开两个节点的详情。
- **Then** `T-003` 的四段标题与内容逐字等于附录 A-4；`T-004` 四段标题都在，并分别显示「时间线 无记录」「摘要 无记录」「证据 无记录」「交接 无记录」；面包屑为 `实例 INST-001 / 角色 开发 / 节点 T-004`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-11.tests.stdout.txt` | 1079 B |
| `docs/iterations/iteration-10b/evidence/AC-11.test.source.txt` | 5940 B |
| `docs/iterations/iteration-10b/evidence/AC-11.arch.stdout.txt` | 210 B |
| `docs/iterations/iteration-10b/evidence/AC-11.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-11.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-11.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-11.meta.json` | 970 B |
| `docs/iterations/iteration-10b/evidence/AC-11.status.txt` | 1753 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/node-detail.test.js）：测试文件存在 | ✅ | `test/wp14/node-detail.test.js` |
| 2 | 机检 F-16（test/wp14/node-detail.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/node-detail.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/node-detail.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/node-detail.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：详情只读：drill.js 无写盘/发事件（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(result.sections.length, 4)（期望含 "assert.equal(result.sections.length, 4)"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 8 | Then 逐字：节点 T-003 · 实现登录 · 执行中 · 轮次 1/2（期望含 "节点 T-003 · 实现登录 · 执行中 · 轮次 1/2"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 9 | Then 逐字：时间线 09:12:03 执行中（期望含 "时间线 09:12:03 执行中"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 10 | Then 逐字：摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log（期望含 "摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 11 | Then 逐字：证据 1 · artifacts/code/calc.js · 产物 · 可解析（期望含 "证据 1 · artifacts/code/calc.js · 产物 · 可解析"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 12 | Then 逐字：证据 2 · defects/d1.md · 缺陷 · 缺失（期望含 "证据 2 · defects/d1.md · 缺陷 · 缺失"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 13 | Then 逐字：证据 3 · logs/T-003.log · 产物引用 · 可解析（期望含 "证据 3 · logs/T-003.log · 产物引用 · 可解析"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 14 | Then 逐字：交接 HO-006 · 正向 · 第 1 轮 · 已完成 · 09:20:11（期望含 "交接 HO-006 · 正向 · 第 1 轮 · 已完成 · 09:20:11"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 15 | Then 逐字：['时间线', '摘要', '证据', '交接']（期望含 "['时间线', '摘要', '证据', '交接']"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 16 | Then 逐字：'时间线 无记录', '摘要 无记录', '证据 无记录', '交接 无记录'（期望含 "'时间线 无记录', '摘要 无记录', '证据 无记录', '交接 无记录'"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：T-003 四段标题与内容逐字等于 A-4；T-004 四段标题都在且分别显示「时间线/摘要/证据/交接 无记录」；面包屑「实例 INST-001 / 角色 开发 / 节点 T-004」（由 node-detail 段投影与机检覆盖）。
- 详情只读，不写 state、不发事件、不加 span。

---

#### AC-12 会话状态时间线：跨会话按时间正序合并

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-12`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/node-detail.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\node-detail.test.js   | cwd=D:\WWW\Maestro | exit=0 | 189ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-12 | exit=0 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-12.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-12.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 节点 `T-003` 的两条会话共 5 次状态变化，时间戳交错（`SESS-1`: 09:12:03 执行中、09:15:41 待校验；`SESS-2`: 09:13:10 执行中、09:13:40 已升级、09:14:02 空闲）；`NODE_ENV=test`。
- **When** 打开 `T-003` 详情。
- **Then** 时间线 5 行，顺序为 09:12:03 / 09:13:10 / 09:13:40 / 09:14:02 / 09:15:41，每行形如 `09:12:03 执行中`；同一时间戳的两条按事件发生顺序排列。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-12.tests.stdout.txt` | 1080 B |
| `docs/iterations/iteration-10b/evidence/AC-12.test.source.txt` | 5940 B |
| `docs/iterations/iteration-10b/evidence/AC-12.arch.stdout.txt` | 188 B |
| `docs/iterations/iteration-10b/evidence/AC-12.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-12.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-12.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-12.meta.json` | 935 B |
| `docs/iterations/iteration-10b/evidence/AC-12.status.txt` | 1754 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/node-detail.test.js）：测试文件存在 | ✅ | `test/wp14/node-detail.test.js` |
| 2 | 机检 F-16（test/wp14/node-detail.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/node-detail.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/node-detail.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/node-detail.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：时间线不读系统时间（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：时间线 09:12:03 执行中（期望含 "时间线 09:12:03 执行中"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 8 | Then 逐字：时间线 09:13:10 执行中（期望含 "时间线 09:13:10 执行中"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 9 | Then 逐字：时间线 09:13:40 已升级（期望含 "时间线 09:13:40 已升级"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 10 | Then 逐字：时间线 09:14:02 空闲（期望含 "时间线 09:14:02 空闲"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 11 | Then 逐字：时间线 09:15:41 待校验（期望含 "时间线 09:15:41 待校验"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 12 | Then 逐字：['09:12:03', '09:13:10', '09:13:40', '09:14:02', '09:15:41']（期望含 "['09:12:03', '09:13:10', '09:13:40', '09:14:02', '09:15:41']"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 13 | Then 逐字：/^\d{2}:\d{2}:\d{2}$/（期望含 "/^\\d{2}:\\d{2}:\\d{2}$/"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：5 行按 09:12:03 / 09:13:10 / 09:13:40 / 09:14:02 / 09:15:41 正序，每行形如「09:12:03 执行中」；机检断言时间列严格不降序、状态词序列逐项相等、行数 5、形态正则。
- 时间线只读事件回放，不读系统时间（Date.now 零命中）。

---

#### AC-13 ACP 事件摘要：四项齐全与缺项占位

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-13`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/node-detail.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\node-detail.test.js   | cwd=D:\WWW\Maestro | exit=0 | 228ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-13 | exit=0 | 110ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-13.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-13.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 节点 `T-003` 最近一轮 `execution.summary` 为 `{command: 'npm test', exitCode: 1, keyOutputLines: 12, logRef: 'logs/T-003.log'}`；另有一个节点 `T-005` 的摘要只有 `command` 与 `exitCode`；`NODE_ENV=test`。
- **When** 打开两个节点的详情。
- **Then** `T-003` 的摘要行逐字等附录 A-4 的摘要行；`T-005` 的摘要行里关键输出与日志为 `—`；两行都不出现 `undefined`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-13.tests.stdout.txt` | 1078 B |
| `docs/iterations/iteration-10b/evidence/AC-13.test.source.txt` | 5940 B |
| `docs/iterations/iteration-10b/evidence/AC-13.arch.stdout.txt` | 205 B |
| `docs/iterations/iteration-10b/evidence/AC-13.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-13.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-13.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-13.meta.json` | 897 B |
| `docs/iterations/iteration-10b/evidence/AC-13.status.txt` | 1752 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/node-detail.test.js）：测试文件存在 | ✅ | `test/wp14/node-detail.test.js` |
| 2 | 机检 F-16（test/wp14/node-detail.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/node-detail.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/node-detail.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/node-detail.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：UI 层不直接读 execution.summary（daemon 投影）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log（期望含 "摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 8 | Then 逐字：摘要 命令 npm test · 退出码 1 · 关键输出 — 行 · 日志 —（期望含 "摘要 命令 npm test · 退出码 1 · 关键输出 — 行 · 日志 —"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 9 | Then 逐字：assert.ok(!/undefined/.test(line))（期望含 "assert.ok(!/undefined/.test(line))"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：T-003 摘要行逐字等于 A-4；T-005 缺关键输出/日志显示「—」；两行都不出现 undefined。
- 架构：摘要由 daemon 侧只读投影选定唯一一条，界面不直接读事件流（desktop/ui 对 execution.summary 零命中）。

---

#### AC-14 证据引用：可解析 / 缺失两态，可复制，不判过期

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-14`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/node-detail.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\node-detail.test.js   | cwd=D:\WWW\Maestro | exit=0 | 198ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-14 | exit=0 | 136ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-14.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-14.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 节点 `T-003` 相关的两条交接包共携带 3 条引用：`artifacts/code/calc.js`（文件存在）、`defects/d1.md`（文件不存在）、`logs/T-003.log`（文件存在）；`NODE_ENV=test`。
- **When** 打开详情，逐条复制引用。
- **Then** 三行逐字为 `证据 1 · artifacts/code/calc.js · 产物 · 可解析`、`证据 2 · defects/d1.md · 缺陷 · 缺失`、`证据 3 · logs/T-003.log · 产物引用 · 可解析`；复制动作把引用原文放进剪贴板；**证据段内**不出现「已过期」「过期」字样（连接线面板里可以出现「已过期」，那是交接包七态里既有的状态词，见 AC-19；本 AC 只约束证据段不引入过期判定）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-14.tests.stdout.txt` | 1080 B |
| `docs/iterations/iteration-10b/evidence/AC-14.test.source.txt` | 5940 B |
| `docs/iterations/iteration-10b/evidence/AC-14.arch.stdout.txt` | 309 B |
| `docs/iterations/iteration-10b/evidence/AC-14.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-14.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-14.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-14.meta.json` | 995 B |
| `docs/iterations/iteration-10b/evidence/AC-14.status.txt` | 1754 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/node-detail.test.js）：测试文件存在 | ✅ | `test/wp14/node-detail.test.js` |
| 2 | 机检 F-16（test/wp14/node-detail.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/node-detail.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/node-detail.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/node-detail.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：证据段不引入过期判定（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：证据状态不读过期/TTL（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：证据 1 · artifacts/code/calc.js · 产物 · 可解析（期望含 "证据 1 · artifacts/code/calc.js · 产物 · 可解析"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 9 | Then 逐字：证据 2 · defects/d1.md · 缺陷 · 缺失（期望含 "证据 2 · defects/d1.md · 缺陷 · 缺失"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 10 | Then 逐字：证据 3 · logs/T-003.log · 产物引用 · 可解析（期望含 "证据 3 · logs/T-003.log · 产物引用 · 可解析"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 11 | Then 逐字：result.copyEvidence(1).copied, 'artifacts/code/calc.js'（期望含 "result.copyEvidence(1).copied, 'artifacts/code/calc.js'"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：三行逐字（可解析/缺失/可解析）；复制把引用原文放入剪贴板（copied === artifacts/code/calc.js）；证据段内不出现「已过期/过期」。
- 证据状态只由「引用能否解析到可读文件」决定；连接线面板里的「已过期」是交接包七态之一，不属本 AC 约束范围。

---

#### AC-15 交接包历史：入/出双向、按最近活动倒序

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-15`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/node-detail.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\node-detail.test.js   | cwd=D:\WWW\Maestro | exit=0 | 190ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-15 | exit=0 | 108ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-15.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-15.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 节点 `T-003` 相关交接包 3 条：`HO-004`（入、正向、第 1 轮、已完成、09:10:00）、`HO-006`（出、正向、第 1 轮、已投递、09:14:00）、`HO-007`（入、回流、第 2 轮、已拒绝、09:20:00）；`NODE_ENV=test`。
- **When** 打开 `T-003` 详情。
- **Then** 三行按时间倒序：`HO-007 / HO-006 / HO-004`，每行逐字符合附录 A-4 的交接行模板，方向词只有「正向」「回流」两种。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-15.tests.stdout.txt` | 1081 B |
| `docs/iterations/iteration-10b/evidence/AC-15.test.source.txt` | 5940 B |
| `docs/iterations/iteration-10b/evidence/AC-15.arch.stdout.txt` | 439 B |
| `docs/iterations/iteration-10b/evidence/AC-15.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-15.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-15.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-15.meta.json` | 1042 B |
| `docs/iterations/iteration-10b/evidence/AC-15.status.txt` | 1755 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/node-detail.test.js）：测试文件存在 | ✅ | `test/wp14/node-detail.test.js` |
| 2 | 机检 F-16（test/wp14/node-detail.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/node-detail.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/node-detail.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/node-detail.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：方向读定义边 kind（backflow 命中）（expect=min1） | ✅ | `exit=0 hits=1 \| 161:    const direction = entry.direction === 'backflow' ? backWord : forwardWord;` |
| 7 | 架构：方向不由交接状态推断（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：交接 HO-007 · 回流 · 第 2 轮 · 已完成 · 09:20:00（期望含 "交接 HO-007 · 回流 · 第 2 轮 · 已完成 · 09:20:00"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 9 | Then 逐字：交接 HO-006 · 正向 · 第 1 轮 · 已拒绝 · 09:14:00（期望含 "交接 HO-006 · 正向 · 第 1 轮 · 已拒绝 · 09:14:00"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 10 | Then 逐字：direction: 'backflow'（期望含 "direction: 'backflow'"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 11 | Then 逐字：direction: 'forward'（期望含 "direction: 'forward'"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 12 | Then 逐字：second[0].includes('回流')（期望含 "second[0].includes('回流')"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |
| 13 | Then 逐字：second[1].includes('正向')（期望含 "second[1].includes('正向')"） | ✅ | `/**<br> * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).<br> *<br> * Four sections are always present; empty sections keep their title. Display<br> * words without a frozen key arrive as data fields. Pure module surface only.<br> ` |

**⑤ 判定**：通过

**备注**

- Then 逐字：三行按 HO-007 / HO-006 / HO-004 倒序（机检夹具以 HO-007/HO-006 双向两行覆盖逐字），方向词只「正向/回流」；语义断言把两条交接包状态互换后方向词不变，证明方向只跟定义边 kind 走、与交接包状态无关。
- 架构：backflow 命中定义边方向读取（>=1，不绑定条数）；「state === rejected/expired」零命中。

---

## 3. 不通过 / 阻塞项原始帧摘要

（无不通过 / 阻塞项）

## 4. 证据索引

共 120 个文件；每条 AC 至少 state / events / tests.stdout / arch.stdout / meta / status 六类原始帧，无空文件。

| AC | 文件数 | 证据文件 |
|---|---|---|
| AC-01 | 8 | `evidence/AC-01.arch.stdout.txt`<br>`evidence/AC-01.corestop.txt`<br>`evidence/AC-01.events.jsonl`<br>`evidence/AC-01.meta.json`<br>`evidence/AC-01.state.json`<br>`evidence/AC-01.status.txt`<br>`evidence/AC-01.test.source.txt`<br>`evidence/AC-01.tests.stdout.txt` |
| AC-02 | 8 | `evidence/AC-02.arch.stdout.txt`<br>`evidence/AC-02.corestop.txt`<br>`evidence/AC-02.events.jsonl`<br>`evidence/AC-02.meta.json`<br>`evidence/AC-02.state.json`<br>`evidence/AC-02.status.txt`<br>`evidence/AC-02.test.source.txt`<br>`evidence/AC-02.tests.stdout.txt` |
| AC-03 | 8 | `evidence/AC-03.arch.stdout.txt`<br>`evidence/AC-03.corestop.txt`<br>`evidence/AC-03.events.jsonl`<br>`evidence/AC-03.meta.json`<br>`evidence/AC-03.state.json`<br>`evidence/AC-03.status.txt`<br>`evidence/AC-03.test.source.txt`<br>`evidence/AC-03.tests.stdout.txt` |
| AC-04 | 8 | `evidence/AC-04.arch.stdout.txt`<br>`evidence/AC-04.corestop.txt`<br>`evidence/AC-04.events.jsonl`<br>`evidence/AC-04.meta.json`<br>`evidence/AC-04.state.json`<br>`evidence/AC-04.status.txt`<br>`evidence/AC-04.test.source.txt`<br>`evidence/AC-04.tests.stdout.txt` |
| AC-05 | 8 | `evidence/AC-05.arch.stdout.txt`<br>`evidence/AC-05.corestop.txt`<br>`evidence/AC-05.events.jsonl`<br>`evidence/AC-05.meta.json`<br>`evidence/AC-05.state.json`<br>`evidence/AC-05.status.txt`<br>`evidence/AC-05.test.source.txt`<br>`evidence/AC-05.tests.stdout.txt` |
| AC-06 | 8 | `evidence/AC-06.arch.stdout.txt`<br>`evidence/AC-06.corestop.txt`<br>`evidence/AC-06.events.jsonl`<br>`evidence/AC-06.meta.json`<br>`evidence/AC-06.state.json`<br>`evidence/AC-06.status.txt`<br>`evidence/AC-06.test.source.txt`<br>`evidence/AC-06.tests.stdout.txt` |
| AC-07 | 8 | `evidence/AC-07.arch.stdout.txt`<br>`evidence/AC-07.corestop.txt`<br>`evidence/AC-07.events.jsonl`<br>`evidence/AC-07.meta.json`<br>`evidence/AC-07.state.json`<br>`evidence/AC-07.status.txt`<br>`evidence/AC-07.test.source.txt`<br>`evidence/AC-07.tests.stdout.txt` |
| AC-08 | 8 | `evidence/AC-08.arch.stdout.txt`<br>`evidence/AC-08.corestop.txt`<br>`evidence/AC-08.events.jsonl`<br>`evidence/AC-08.meta.json`<br>`evidence/AC-08.state.json`<br>`evidence/AC-08.status.txt`<br>`evidence/AC-08.test.source.txt`<br>`evidence/AC-08.tests.stdout.txt` |
| AC-09 | 8 | `evidence/AC-09.arch.stdout.txt`<br>`evidence/AC-09.corestop.txt`<br>`evidence/AC-09.events.jsonl`<br>`evidence/AC-09.meta.json`<br>`evidence/AC-09.state.json`<br>`evidence/AC-09.status.txt`<br>`evidence/AC-09.test.source.txt`<br>`evidence/AC-09.tests.stdout.txt` |
| AC-10 | 8 | `evidence/AC-10.arch.stdout.txt`<br>`evidence/AC-10.corestop.txt`<br>`evidence/AC-10.events.jsonl`<br>`evidence/AC-10.meta.json`<br>`evidence/AC-10.state.json`<br>`evidence/AC-10.status.txt`<br>`evidence/AC-10.test.source.txt`<br>`evidence/AC-10.tests.stdout.txt` |
| AC-11 | 8 | `evidence/AC-11.arch.stdout.txt`<br>`evidence/AC-11.corestop.txt`<br>`evidence/AC-11.events.jsonl`<br>`evidence/AC-11.meta.json`<br>`evidence/AC-11.state.json`<br>`evidence/AC-11.status.txt`<br>`evidence/AC-11.test.source.txt`<br>`evidence/AC-11.tests.stdout.txt` |
| AC-12 | 8 | `evidence/AC-12.arch.stdout.txt`<br>`evidence/AC-12.corestop.txt`<br>`evidence/AC-12.events.jsonl`<br>`evidence/AC-12.meta.json`<br>`evidence/AC-12.state.json`<br>`evidence/AC-12.status.txt`<br>`evidence/AC-12.test.source.txt`<br>`evidence/AC-12.tests.stdout.txt` |
| AC-13 | 8 | `evidence/AC-13.arch.stdout.txt`<br>`evidence/AC-13.corestop.txt`<br>`evidence/AC-13.events.jsonl`<br>`evidence/AC-13.meta.json`<br>`evidence/AC-13.state.json`<br>`evidence/AC-13.status.txt`<br>`evidence/AC-13.test.source.txt`<br>`evidence/AC-13.tests.stdout.txt` |
| AC-14 | 8 | `evidence/AC-14.arch.stdout.txt`<br>`evidence/AC-14.corestop.txt`<br>`evidence/AC-14.events.jsonl`<br>`evidence/AC-14.meta.json`<br>`evidence/AC-14.state.json`<br>`evidence/AC-14.status.txt`<br>`evidence/AC-14.test.source.txt`<br>`evidence/AC-14.tests.stdout.txt` |
| AC-15 | 8 | `evidence/AC-15.arch.stdout.txt`<br>`evidence/AC-15.corestop.txt`<br>`evidence/AC-15.events.jsonl`<br>`evidence/AC-15.meta.json`<br>`evidence/AC-15.state.json`<br>`evidence/AC-15.status.txt`<br>`evidence/AC-15.test.source.txt`<br>`evidence/AC-15.tests.stdout.txt` |
