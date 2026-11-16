# I1.10b S3 验收 · C 组（AC-31 ~ AC-45，除 AC-33）

> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-10 逐字基线；
> `docs/templates/execution-template.md` §3.1~§3.5；`docs/iterations/iteration-10b/decisions.md` 裁决 G/H/J。
> 取证脚手架：`probe/acc10b-f-{lib,common,run,final}.mjs` + `probe/acc10b-f-final-c.mjs` + `probe/acc10b-cases/`（目录名不带 `-f`）。
> AC-33 为真实宿主面（一键跳转进程幂等），按任务留待真实宿主批 e，本批跳过（不写 results 行）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。

## 0. 总判

**14 条：通过 14 / 不通过 0 / 阻塞 0**（AC-34 经裁决 K 补帧、AC-37 经补齐 `lastAction.stateSince` 机检，分别由「不通过」复判为「通过」；原判痕迹均保留）

- 已产出证据与判定：14 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-10b/evidence/` 下 AC-31~AC-45 相关共 117 个（每条 ≥4 文件、无空文件；含裁决 K 新增的 2 帧干净 HEAD 基线 TAP；AC-37 复验原判帧另存 `_archive_AC-37_pre-reverify_20261116T175504Z/` 子目录，不计入 117）。
- 不通过 / 阻塞条目：无。AC-34 原为不通过，2026-11-17 按 `decisions.md` 裁决 K 补齐两类原始帧后复判为**通过**；AC-37 原为不通过（16/17，缺 `lastAction.stateSince`），2026-11-16 测试侧按裁决 J F4-05 补齐 5 字段夹具 + `assert.deepEqual` 逐字段断言后重跑复验为**通过**（17/17）。两条原判痕迹保留于本文件 §2/§3 与 `probe/acc10b-f-blockers.md`。
- 机器可读汇总：`probe/acc10b-f-summary-c.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`。
- 判定口径：`通过` = 需求 Then/机检逐字全部成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时。
- 判定纪律：只认需求原文 Then/机检逐字，不采信测试自述；文案逐字比对、数量核对数组长度、内部断言（滚动/耗时）仅作回归信号不冒充用户可见结论；同 AC 多记录取最后一条。

## 1. AC 逐条判定表

| AC | 标题 | 判定 | 证据分级 | 核对项 | 证据文件数 |
|---|---|---|---|---|---|
| AC-31 | 四类运行期异常提示：实例不存在 / 角色未使用 / 节点不存在 / 推送断开 | **通过** | mock 实测 | 15/15 | 8 |
| AC-32 | 同一节点在流程图 / 看板 / 局部 DAG / 卡片四处一致 | **通过** | mock 实测 | 14/14 | 8 |
| AC-34 | 回归门禁：三条主链、命令表、I1.10a 判据无新增红 | **通过**（裁决 K 复判） | mock 实测 | 14/14 | 13 |
| AC-35 | 卡片耗时从进入当前状态起算，刷新不重置 | **通过** | mock 实测 | 12/12 | 8 |
| AC-36 | 四层下钻与逐级返回（面包屑 1/2/3/4、返回 3 次） | **通过** | mock 实测 | 14/14 | 8 |
| AC-37 | 角色在注册表中不存在时状态栏显示「不可用」，其余四项照常可读 | **通过**（复验复判） | mock 实测 | 17/17 | 8 |
| AC-38 | 局部 DAG 的退化边界：单节点 0 线不塌陷 | **通过** | mock 实测 | 12/12 | 8 |
| AC-39 | 端点节点没有运行时状态时按「待执行」呈现 | **通过** | mock 实测 | 11/11 | 8 |
| AC-40 | 节点角色 ID 与注册表对不上：仍画出并按角色节点显示 | **通过** | mock 实测 | 11/11 | 8 |
| AC-41 | 卡片缺值：标题或角色名缺失时显示 `—` | **通过** | mock 实测 | 10/10 | 8 |
| AC-42 | 交接包很多：能滚到最后一条，行文本正确 | **通过** | mock 实测 | 14/14 | 8 |
| AC-43 | 展开期间聚合状态变化：面板刷新，展开的包不跳走 | **通过** | mock 实测 | 13/13 | 8 |
| AC-44 | 本实例 0 条待处理升级：空态与已处理记录 | **通过** | mock 实测 | 15/15 | 8 |
| AC-45 | 「继续」失败：提示既有错误原文，三处状态不变 | **通过** | mock 实测 | 15/15 | 8 |

## 2. 逐 AC 取证明细（命令 / 需求原文 / 证据 / 逐项核对）

#### AC-31 四类运行期异常提示：实例不存在 / 角色未使用 / 节点不存在 / 推送断开

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-31`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-errors.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-errors.test.js   | cwd=D:\WWW\Maestro | exit=0 | 207ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-31 | exit=0 | 116ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-31.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-31.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 四个现场：`INST-999` 不存在；`INST-001` 某角色未参与（无绑定节点）；下钻期间节点被移除后点其 DAG 节点；推送连接被断开；`NODE_ENV=test`。
- **When** 依次触发对应界面动作。
- **Then** 依次显示 `实例 INST-999 · 不存在`、`角色 协调者 · 本实例未使用`（进入下钻后为「未参与」+「任务 无」）、`节点 T-003 · 不存在`、`已断开 · 正在重连…`；四种都不白屏、不打印堆栈，界面仍可返回或重试。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-31.tests.stdout.txt` | 1150 B |
| `docs/iterations/iteration-10b/evidence/AC-31.test.source.txt` | 5699 B |
| `docs/iterations/iteration-10b/evidence/AC-31.arch.stdout.txt` | 204 B |
| `docs/iterations/iteration-10b/evidence/AC-31.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-31.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-31.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-31.meta.json` | 1050 B |
| `docs/iterations/iteration-10b/evidence/AC-31.status.txt` | 1826 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-errors.test.js）：测试文件存在 | ✅ | `test/wp14/drill-errors.test.js` |
| 2 | 机检 F-16（test/wp14/drill-errors.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-errors.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/drill-errors.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-errors.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：渲染层不抛异常（throw new Error 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(EXPECTED.missingInstance, '实例 INST-999 · 不存在')（期望含 "assert.equal(EXPECTED.missingInstance, '实例 INST-999 · 不存在')"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 8 | Then 逐字：assert.equal(EXPECTED.unusedRole, '角色 协调者 · 本实例未使用')（期望含 "assert.equal(EXPECTED.unusedRole, '角色 协调者 · 本实例未使用')"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 9 | Then 逐字：assert.equal(EXPECTED.missingNode, '节点 T-003 · 不存在')（期望含 "assert.equal(EXPECTED.missingNode, '节点 T-003 · 不存在')"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 10 | Then 逐字：assert.equal(EXPECTED.reconnecting, '已断开 · 正在重连…')（期望含 "assert.equal(EXPECTED.reconnecting, '已断开 · 正在重连…')"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 11 | Then 逐字：composed.actions.some（期望含 "composed.actions.some"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 12 | Then 逐字：'back-to-list'（期望含 "'back-to-list'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 13 | Then 逐字：app.state().view, 'drill'（期望含 "app.state().view, 'drill'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 14 | Then 逐字：app.state().view, 'graph'（期望含 "app.state().view, 'graph'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 15 | Then 逐字：w('DRILL_EMPTY_TASK')（期望含 "w('DRILL_EMPTY_TASK')"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |

**⑤ 判定**：通过

**备注**

- 四类异常逐字基线取自 A-9：实例 INST-999 · 不存在 / 角色 协调者 · 本实例未使用 / 节点 T-003 · 不存在 / 已断开 · 正在重连…；均由文案键派生，机检 F-16 逐字通过。
- 界面仍可操作由 compose().actions 的 back-to-list / retry-graph 探针 + view 在 drill→graph 间可迁移证明；不白屏、不抛栈。

---

#### AC-32 同一节点在流程图 / 看板 / 局部 DAG / 卡片四处一致

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-32`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-live.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-live.test.js   | cwd=D:\WWW\Maestro | exit=0 | 240ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-32 | exit=0 | 113ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-32.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-32.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 实例 `INST-001` 的 `T-003` 运行状态为「执行中」；`NODE_ENV=test`。
- **When** 依次导出角色流程图节点、7 列看板归列、局部 DAG 节点、任务卡片四处对 `T-003` 的表示。
- **Then** 四处标题相同（`实现登录`）、状态词相同（`执行中`）、状态色 token 相同（`blue`）；看板落在「执行中」列；卡片落「执行中」档。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-32.tests.stdout.txt` | 1554 B |
| `docs/iterations/iteration-10b/evidence/AC-32.test.source.txt` | 9530 B |
| `docs/iterations/iteration-10b/evidence/AC-32.arch.stdout.txt` | 380 B |
| `docs/iterations/iteration-10b/evidence/AC-32.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-32.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-32.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-32.meta.json` | 1104 B |
| `docs/iterations/iteration-10b/evidence/AC-32.status.txt` | 2226 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-live.test.js）：测试文件存在 | ✅ | `test/wp14/drill-live.test.js` |
| 2 | 机检 F-16（test/wp14/drill-live.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-live.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-live.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-live.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：drill 层不重算状态（decideStatus\|statusReason 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：drill 层不直接 import CLI 文案（cli/labels 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：assert.equal(dagNode.status, graphWord)（期望含 "assert.equal(dagNode.status, graphWord)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 9 | Then 逐字：assert.equal(card.displayStatus, graphWord)（期望含 "assert.equal(card.displayStatus, graphWord)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 10 | Then 逐字：assert.equal(card.tier, 'running')（期望含 "assert.equal(card.tier, 'running')"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 11 | Then 逐字：assert.equal(card.rank, 3)（期望含 "assert.equal(card.rank, 3)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 12 | Then 逐字：assert.equal(w('NODE_LABEL_RUNNING'), graphWord)（期望含 "assert.equal(w('NODE_LABEL_RUNNING'), graphWord)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 13 | Then 逐字：assert.equal(board.columns.includes('running'), true)（期望含 "assert.equal(board.columns.includes('running'), true)"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 14 | Then 逐字：assert.equal(board.columnNames[2], w('DESKTOP_BOARD_COLUMN_RUNNING'))（期望含 "assert.equal(board.columnNames[2], w('DESKTOP_BOARD_COLUMN_RUNNING'))"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点：四处标题相同（实现登录）、状态词相同（执行中）、状态色 token 相同（blue）；看板落 running 列、卡片 tier===running（rank===3，8 档口径见 AC-08）。
- 四层均由同一份投影字段派生：dagNode.status === card.displayStatus === graphWord（同一 nodeWord("running") 词源），文档层不重算状态；架构两条零命中证明未自算状态、未直连 CLI 文案模块。

---

#### AC-34 回归门禁：三条主链、命令表、I1.10a 判据无新增红

- 判定：**通过**（核对 14/14 通过；2026-11-17 按 `decisions.md` 裁决 K 补齐两类原始帧后复判，原判「不通过 / 11/14」见 §3 与 blockers 留痕）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-34`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/regression-drill.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\regression-drill.test.js   | cwd=D:\WWW\Maestro | exit=0 | 18239ms
[git diff --stat HEAD -- 主链三文件] git diff --stat HEAD -- src/cli/main.js src/core/state-machine.js src/core/orchestrator.js   | cwd=D:\WWW\Maestro | exit=0 | 160ms
[基线 handoff-schema（干净 HEAD 818576f^=18438d6，只读 worktree）] NODE_ENV=test node --test test/wp11/handoff-schema.test.js   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-ac34-baseline-818576f-parent | exit=1 | TAP #tests 37 / #pass 34 / #fail 3
[基线 instance-list（干净 HEAD 818576f^=18438d6，只读 worktree）] NODE_ENV=test node --test test/wp13/instance-list.test.js   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-ac34-baseline-818576f-parent | exit=1 | TAP #tests 2 / #pass 1 / #fail 1
[独占复核 handoff-schema-20261117-013251.log] "(frame) handoff-schema-20261117-013251.log"   | cwd=docs/iterations/iteration-10b/flake-frames | exit=1 | 0ms
[独占复核 instance-list-20261117-013251.log] "(frame) instance-list-20261117-013251.log"   | cwd=docs/iterations/iteration-10b/flake-frames | exit=1 | 0ms
[独占复核 handoff-schema-confirm-20261117-013259.log] "(frame) handoff-schema-confirm-20261117-013259.log"   | cwd=docs/iterations/iteration-10b/flake-frames | exit=1 | 0ms
[独占复核 instance-list-confirm-20261117-013259.log] "(frame) instance-list-confirm-20261117-013259.log"   | cwd=docs/iterations/iteration-10b/flake-frames | exit=1 | 0ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-34 | exit=0 | 135ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-34.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-34.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 本迭代实现完成，工作区干净；`NODE_ENV=test`。
- **When** 依次跑三条主链、既有 CLI 格式、I1.10a 全部契约测试、全量测试。
- **Then** `single` / `code-loop` / `task-loop` 三条主链输出逐字不变；`orch instance status` 与 `orch instance graph` 两种格式逐字不变；`USAGE_LINES` 仍 25 行；CLI 命令表与两层子命令表不变；I1.10a 的 44 条 AC 对应测试在**允许集合之外不得出现新增红**；全量测试 **`tests ≥ 1425`（条数只增不减）**，且**失败集合与允许集合的差集 = 0**。允许集合 = `docs/iterations/iteration-10a/baseline-failures-win32.txt` 的 16 条 Windows 平台登记项 ∪ 本迭代实跑观测到且**文件级隔离复跑通过并留帧**的 flake（口径见 §3.3 与 `decisions.md` 裁决 G）。本 AC **不以"某文件 0 失败"、也不以"某一次运行的失败条数"作判据**。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-34.tests.stdout.txt` | 2100 B |
| `docs/iterations/iteration-10b/evidence/AC-34.test.source.txt` | 26167 B |
| `docs/iterations/iteration-10b/evidence/AC-34.arch.stdout.txt` | 250 B |
| `docs/iterations/iteration-10b/evidence/AC-34.fullrun.tap.txt` | 331978 B |
| `docs/iterations/iteration-10b/evidence/AC-34.diffset.txt` | 2972 B |
| `docs/iterations/iteration-10b/evidence/AC-34.newred-recheck.txt` | 21186 B |
| `docs/iterations/iteration-10b/evidence/flake-frames/baseline-HEAD-handoff-schema-20261117-013949.log` | 9520 B（裁决 K ①：干净 HEAD 基线帧） |
| `docs/iterations/iteration-10b/evidence/flake-frames/baseline-HEAD-instance-list-20261117-013949.log` | 1435 B（裁决 K ①：干净 HEAD 基线帧） |
| `docs/iterations/iteration-10b/evidence/flake-frames/_index.md` | —（帧索引，含裁决 K 复判登记） |
| `docs/iterations/iteration-10b/evidence/AC-34.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-34.state.json` | 119 B |
| `docs/iterations/iteration-10b/evidence/AC-34.events.jsonl` | 51 B |
| `docs/iterations/iteration-10b/evidence/AC-34.meta.json` | 1299 B |
| `docs/iterations/iteration-10b/evidence/AC-34.status.txt` | 11022 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/regression-drill.test.js）：测试文件存在 | ✅ | `test/wp14/regression-drill.test.js` |
| 2 | 机检 F-16（test/wp14/regression-drill.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/regression-drill.test.js）：# pass ≥ 1 | ✅ | `# pass=8` |
| 4 | 机检 F-16（test/wp14/regression-drill.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/regression-drill.test.js）：无 not ok | ✅ | `无` |
| 6 | Then 逐字：USAGE_LINES 25 行冻结（期望含 "assert.equal(USAGE_LINES.length, 25"） | ✅ | `/**<br> * I1.10b WP-6 · AC-34 回归门禁 + AC-30 静态面的测试侧支撑（批次 4，DAG 汇合点）。<br> *<br> * 主责 AC-34：三条主链逐字 / `instance status`+`instance graph` 两种格式逐字 /<br> * `USAGE_LINES === 25` / 命令表与两层子命令表不变；另提供「全量四步判定」的测试侧<br> * 支撑：tests ≥ 1425、失败集合 ⊆ 允许集合（win32 16 ∪ 历史 8 ∪ 已登记 AC-0` |
| 7 | Then 逐字：零依赖断言（期望含 "assert.deepEqual(pkg.dependencies ?? {}, {}"） | ✅ | `/**<br> * I1.10b WP-6 · AC-34 回归门禁 + AC-30 静态面的测试侧支撑（批次 4，DAG 汇合点）。<br> *<br> * 主责 AC-34：三条主链逐字 / `instance status`+`instance graph` 两种格式逐字 /<br> * `USAGE_LINES === 25` / 命令表与两层子命令表不变；另提供「全量四步判定」的测试侧<br> * 支撑：tests ≥ 1425、失败集合 ⊆ 允许集合（win32 16 ∪ 历史 8 ∪ 已登记 AC-0` |
| 8 | Then 逐字：31 词禁表冻结（期望含 "assert.equal(WORDS_31.length, 31"） | ✅ | `/**<br> * I1.10b WP-6 · AC-34 回归门禁 + AC-30 静态面的测试侧支撑（批次 4，DAG 汇合点）。<br> *<br> * 主责 AC-34：三条主链逐字 / `instance status`+`instance graph` 两种格式逐字 /<br> * `USAGE_LINES === 25` / 命令表与两层子命令表不变；另提供「全量四步判定」的测试侧<br> * 支撑：tests ≥ 1425、失败集合 ⊆ 允许集合（win32 16 ∪ 历史 8 ∪ 已登记 AC-0` |
| 9 | 架构：主链三文件无产品改动（git diff --stat 空）（expect=zero） | ✅ | `exit=0 hits=0` |
| 10 | 全量取数：tests ≥ 1425（实测 1524） | ✅ | `tests=1524 pass=1500 fail=15 skipped=9` |
| 11 | 全量差集（裁决 K）：observedFail(15) ∖ allowed(18 = win32 16 ∪ S0 基线既有红 2) = 0（应为 0） | ✅ | `差集 = 0：两条原「集合外」红已由干净 HEAD 基线帧证明为 S0 开工基线既有红，计入允许集合；其余 13 条在 win32 16 条内` |
| 12 | 逐文件（裁决 K）：集合外文件 # fail 0 | ✅ | `集合外红 0：test/wp11/handoff-schema.test.js(HANDOFF_EVIDENCE_ESCAPE:符号链接绕过)、test/wp13/instance-list.test.js(AC-04:空态…新实例2秒内…) 均为既有红，不再计入集合外` |
| 13 | 逐文件：ls test/wp13/*.test.js \| wc -l = 36（仅核清单完整，不作判据） | ✅ | `实点 36` |
| 14 | 新红复核（裁决 K）：两条红在干净 HEAD(818576f^) 同样红 → 既有红、非新增 | ✅ | `基线帧 2 份：baseline-HEAD-handoff-schema-20261117-013949.log（not ok 12，#fail 3）、baseline-HEAD-instance-list-20261117-013949.log（not ok 2，#fail 1）；本工作树独占复核 4 帧仍红。两类帧齐备 → 差集 0` |

**⑤ 判定**：通过（裁决 K 复判；tests 1524 ≥ 1425 与「相对基线新增红 = 0」均成立）

**备注**

- 三条主链 / 两种格式 / USAGE_LINES=25 / 命令表 / 零依赖 / 31 词表由机检 F-16（regression-drill.test.js 8/8）承载。
- **裁决 K 复判（2026-11-17）**：允许集合按裁决 G 的**目的性口径**解释 = win32 16 条登记项 ∪ S0 开工基线已观测到的既有红（须有本次基线帧）∪ 隔离复跑通过并留帧的 flake。两条原判「集合外新增红」`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`、`AC-04：空态…新实例 2 秒内…` 属第二类——在干净 HEAD（`818576f^` = `18438d6`，S0/S1 基线，无 I1.10b 实现）上**同样红**，不算本迭代新增红 ⇒ 差集 = 0，AC-34 改判通过。
- **两类原始帧已补齐且齐备**：① 干净 HEAD 基线帧 `evidence/flake-frames/baseline-HEAD-handoff-schema-20261117-013949.log`（`not ok 12`，`#tests 37/#pass 34/#fail 3`，EPERM symlink）、`evidence/flake-frames/baseline-HEAD-instance-list-20261117-013949.log`（`not ok 2`，`#tests 2/#pass 1/#fail 1`，期望 running 实得 completed）——均用 `git worktree add --detach` 在 `%TEMP%/maestro-ac34-baseline-818576f-parent` 只读工作树隔离复跑取得；② 本工作树文件级隔离复跑仍红 4 帧见 `docs/iterations/iteration-10b/flake-frames/`（handoff-schema / instance-list 各首跑 + confirm）。
- **未放宽任何断言、未改 AC Then**：`tests ≥ 1425`（实测 1524）与「相对基线新增红 = 0」仍须成立，本复判只改变「既有红是否计入允许集合」的解释，不改变判据强度。
- 历史留痕（原裁决 G 口径下曾判不通过）：彼时允许集合严格取 win32 16 条 ∪ 隔离复跑通过的 flake，两条不在 16 条内且隔离复跑仍红（非 flake），曾记为差集 = 2；该口径经主控裁决 K 明确为对「新增红」的目的性判定，16 条清单非穷尽平台红全集，故以本复判为准。regression-drill.test.js 注释把二者列为允许集合，与裁决 K 口径一致。

---

#### AC-35 卡片耗时从进入当前状态起算，刷新不重置

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-35`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-cards.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-cards.test.js   | cwd=D:\WWW\Maestro | exit=0 | 242ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-35 | exit=0 | 119ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-35.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-35.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 节点 `T-003` 的 `stateSince` 为「当前注入时刻 − 12 分钟」；`NODE_ENV=test`；渲染时钟注入固定值。
- **When** 连续导出三次卡片（模拟进入、推送更新、重新进入）。
- **Then** 三次执行行都是 `已运行 12m`；把注入时钟推进 60 秒后再导出为 `已运行 13m`；`stateSince` 在三次导出之间不变（没有被界面改写）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-35.tests.stdout.txt` | 1253 B |
| `docs/iterations/iteration-10b/evidence/AC-35.test.source.txt` | 8025 B |
| `docs/iterations/iteration-10b/evidence/AC-35.arch.stdout.txt` | 206 B |
| `docs/iterations/iteration-10b/evidence/AC-35.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-35.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-35.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-35.meta.json` | 933 B |
| `docs/iterations/iteration-10b/evidence/AC-35.status.txt` | 1927 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-cards.test.js）：测试文件存在 | ✅ | `test/wp14/drill-cards.test.js` |
| 2 | 机检 F-16（test/wp14/drill-cards.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-cards.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-cards.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-cards.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：cards.js 不取系统时间（Date.now 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(a[0].elapsed, '12m')（期望含 "assert.equal(a[0].elapsed, '12m')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 8 | Then 逐字：assert.equal(b[0].elapsed, '12m')（期望含 "assert.equal(b[0].elapsed, '12m')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 9 | Then 逐字：assert.equal(c[0].elapsed, '13m')（期望含 "assert.equal(c[0].elapsed, '13m')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 10 | Then 逐字：a[0].lines[1].includes('已运行 12m')（期望含 "a[0].lines[1].includes('已运行 12m')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 11 | Then 逐字：c[0].lines[1].includes('已运行 13m')（期望含 "c[0].lines[1].includes('已运行 13m')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 12 | Then 逐字：assert.equal(JSON.stringify(cards[0].session.stateSince), before)（期望含 "assert.equal(JSON.stringify(cards[0].session.stateSince), before)"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点：三次执行行都是「已运行 12m」，注入时钟推进 60 秒后为「已运行 13m」，stateSince 三次导出之间不变。
- 耗时由注入时钟（NOW）与会话 stateSince 之差得出，模块不取系统时间（Date.now 零命中），刷新不重置。

---

#### AC-36 四层下钻与逐级返回（面包屑 1/2/3/4、返回 3 次）

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-36`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/subworkflow-drill.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\subworkflow-drill.test.js   | cwd=D:\WWW\Maestro | exit=0 | 202ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-36 | exit=0 | 114ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-36.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-36.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 四层定义链：`release-flow`（第 1 层，顶层）→ `publish-child`（第 2 层）→ `child-x`（第 3 层）→ `leaf-y`（第 4 层，最深），相邻层之间各 1 个子工作流节点（共 3 个 `workflow` 引用）；`NODE_ENV=test`。
- **When** 逐层下钻到第 4 层，然后逐级点「返回上一层」回到顶层。
- **Then** 每层面包屑都正确追加 `/ 子工作流 <名称>`；四层的面包屑段数依次为 **1 / 2 / 3 / 4**（第 1 层只有 `实例 INST-001`，第 4 层为 `实例 INST-001 / 子工作流 发布子流程 / 子工作流 child-x / 子工作流 leaf-y` 共 4 段）；逐级返回时每次只退一层（不跳层），从第 4 层回到第 1 层共 **3 次返回**，每次返回后段数依次减 1（4→3→2→1）；回到顶层后视图为 `release-flow` 的角色流程图；返回过程中不出现循环提示。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-36.tests.stdout.txt` | 696 B |
| `docs/iterations/iteration-10b/evidence/AC-36.test.source.txt` | 4609 B |
| `docs/iterations/iteration-10b/evidence/AC-36.arch.stdout.txt` | 560 B |
| `docs/iterations/iteration-10b/evidence/AC-36.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-36.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-36.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-36.meta.json` | 1099 B |
| `docs/iterations/iteration-10b/evidence/AC-36.status.txt` | 1382 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：测试文件存在 | ✅ | `test/wp14/subworkflow-drill.test.js` |
| 2 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：# pass ≥ 1 | ✅ | `# pass=3` |
| 4 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/subworkflow-drill.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：层级由栈结构承载（stack.push\|pop ≥1，不绑写法）（expect=min1） | ✅ | `exit=0 hits=3 \| 51:    if (typeof levelRef === 'string' && levelRef.length > 0) stack.push(levelRef); ; 54:  if (!cycle) stack.push(ref); ; 166:      const popped = stack.pop();` |
| 7 | 架构：层级不持久化（localStorage\|sessionStorage 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：assert.deepEqual([one, two, three, four].map((v) => v.breadcrumb.length), [1, 2, 3, 4])（期望含 "assert.deepEqual([one, two, three, four].map((v) => v.breadcrumb.length), [1, 2, 3, 4])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 9 | Then 逐字：assert.equal(four.returnCount, 3)（期望含 "assert.equal(four.returnCount, 3)"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 10 | Then 逐字：assert.deepEqual(sequence, ['child-x', 'publish-child', 'release-flow'])（期望含 "assert.deepEqual(sequence, ['child-x', 'publish-child', 'release-flow'])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 11 | Then 逐字：实例 INST-001（期望含 "实例 INST-001"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 12 | Then 逐字：子工作流 发布子流程（期望含 "子工作流 发布子流程"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 13 | Then 逐字：子工作流 leaf-y（期望含 "子工作流 leaf-y"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |
| 14 | Then 逐字：assert.deepEqual(iterative, [1, 2, 3, 4])（期望含 "assert.deepEqual(iterative, [1, 2, 3, 4])"） | ✅ | `/**<br> * WP-3 contract tests for sub-workflow drilldown<br> * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the<br> * existing pure graph layout module.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js<br> ` |

**⑤ 判定**：通过

**备注**

- 四层定义链 release-flow → publish-child → child-x → leaf-y（3 个 workflow 引用）；Then 逐字锚点：面包屑段数 1/2/3/4、逐级返回 3 次（returnCount === levels-1 === 3）、每次退一层。
- 层级栈只增删一层由行为断言判（段数 [1,2,3,4] + returnCount===3）；架构检查只要求栈结构承载且不绑写法（F3-08 语义断言），localStorage/sessionStorage 零命中证明层级不持久化。

---

#### AC-37 角色在注册表中不存在时状态栏显示「不可用」，其余四项照常可读

- 判定：**通过**（核对 17/17 通过；2026-11-16 按裁决 J F4-05 补齐 `lastAction.stateSince` 机检后复验复判，原判「不通过 / 16/17」见 §3 与 blockers 留痕）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-37`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-errors.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-errors.test.js   | cwd=D:\WWW\Maestro | exit=0 | 247ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-37 | exit=0 | 120ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-37.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-37.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** `$TEMP/maestro-i10b-unknown-role` 的工作流声明了一个角色 `外部审核`（`roleId: external-auditor`），**绑定两个节点**：`T-020`（运行时**待执行**、无会话、轮次 1/1、`stateSince` `2026-11-15T09:30:00.000Z`）与 `T-021`（运行时**执行中**、轮次 1/1、`stateSince` `2026-11-15T10:04:00.000Z`，晚于 `T-020`、有一条 `thinking` 会话、宿主 `dsh`）；角色注册表里**没有**这个角色（`external-auditor` 查不到）；定义层 `maxRounds` 两个节点均为 `1`；`NODE_ENV=test`；界面已进入该实例的角色流程图。
- **When** 用户点击角色节点「外部审核」。
- **Then** 下钻正常打开：状态栏一行逐字为 `角色栏 外部审核 · 不可用 · 1 个活跃会话 · 服务 T-021 · 宿主 dsh · 最近 T-021 · 轮次 1/1 · 执行中`——**只有状态位是「不可用」**（未知角色导致），其余四项（活跃会话数、服务节点、宿主、最近动作）都按既有投影的真实值照常显示、不整行隐藏；卡片列表有 `T-020`、`T-021` 两张，不白屏、不出现 `undefined`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-37.tests.stdout.txt` | 1150 B |
| `docs/iterations/iteration-10b/evidence/AC-37.test.source.txt` | 5779 B |
| `docs/iterations/iteration-10b/evidence/AC-37.arch.stdout.txt` | 218 B |
| `docs/iterations/iteration-10b/evidence/AC-37.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-37.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-37.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-37.meta.json` | 1224 B |
| `docs/iterations/iteration-10b/evidence/AC-37.status.txt` | 1826 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-errors.test.js）：测试文件存在 | ✅ | `test/wp14/drill-errors.test.js` |
| 2 | 机检 F-16（test/wp14/drill-errors.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-errors.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/drill-errors.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-errors.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：界面不查注册表判定角色（registry\|roleMap 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(bar.status, statusWord('unavailable'))（期望含 "assert.equal(bar.status, statusWord('unavailable'))"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 8 | Then 逐字：assert.equal(bar.statusReason, 'unknown-role')（期望含 "assert.equal(bar.statusReason, 'unknown-role')"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 9 | Then 逐字：'角色栏 外部审核'（期望含 "'角色栏 外部审核'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 10 | Then 逐字：'1 个活跃会话'（期望含 "'1 个活跃会话'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 11 | Then 逐字：'服务 T-021'（期望含 "'服务 T-021'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 12 | Then 逐字：'宿主 dsh'（期望含 "'宿主 dsh'"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 13 | Then 逐字：最近 T-021 · 轮次 1/1 · （期望含 "最近 T-021 · 轮次 1/1 · "） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 14 | Then 逐字：assert.deepEqual(bar.servingNodes, ['T-021'])（期望含 "assert.deepEqual(bar.servingNodes, ['T-021'])"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 15 | Then 逐字：assert.deepEqual(bar.hostIcons, ['dsh'])（期望含 "assert.deepEqual(bar.hostIcons, ['dsh'])"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 16 | Then 逐字：app.state().drillView.cards.length, 2（期望含 "app.state().drillView.cards.length, 2"） | ✅ | `/**<br> * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).<br> * All visible lines are derived from the frozen label table; this file never<br> * authors a Chinese sentence. Interface-still-operable is asserted via the<br> * createA` |
| 17 | 机检逐字：lastAction 含 stateSince=2026-11-15T10:04:00.000Z（requirement.md:843 / 裁决 J F4-05） | ✅ | `机检源码含 stateSince 字段与 ISO 逐字值` |

**⑤ 判定**：通过（复验复判）

**备注**

- 用户可见 Then（状态栏逐字行「角色栏 外部审核 · 不可用 · 1 个活跃会话 · 服务 T-021 · 宿主 dsh · 最近 T-021 · 轮次 1/1 · 执行中」+ 卡片两张 + statusReason=unknown-role 透传）全部由机检源码承载并通过。
- 判定分歧点（原判留痕，2026-11-16 复验已改判为通过）：需求机检逐字要求 roleBar.lastAction 为 5 字段对象（含 stateSince=2026-11-15T10:04:00.000Z），原测机检夹具/断言只有 4 字段——原判该核对项不通过、AC 整体不通过。
- 复验记录（2026-11-16，按裁决 J F4-05 补齐后）：`test/wp14/drill-errors.test.js` 夹具(:87)与 `assert.deepEqual` 断言(:114)均补齐为 5 字段对象、含逐字 `stateSince=2026-11-15T10:04:00.000Z`；重跑 `node probe/acc10b-f-run.mjs AC-37` 得 17/17 全过，机检逐字第 17 条通过，AC-37 复判为**通过**。用户可见 Then 未放宽、三档判定与证据分级照旧（mock 实测）。原判原始帧留痕于 `evidence/_archive_AC-37_pre-reverify_20261116T175504Z/`。

---

#### AC-38 局部 DAG 的退化边界：单节点 0 线不塌陷

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-38`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-dag.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-dag.test.js   | cwd=D:\WWW\Maestro | exit=0 | 201ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-38 | exit=0 | 112ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-38.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-38.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 工作流 `solo-flow` 只有一个角色节点 `T-030`（开发，执行中），该角色没有任何上下游；`NODE_ENV=test`。
- **When** 用户进入「开发」的下钻。
- **Then** 局部 DAG 恰好 1 个节点、0 条连线；图区仍有可见尺寸（不是塌成一条空白），节点在图区内可见；不报错、不出现"暂无数据"之类替代文案。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-38.tests.stdout.txt` | 1376 B |
| `docs/iterations/iteration-10b/evidence/AC-38.test.source.txt` | 5919 B |
| `docs/iterations/iteration-10b/evidence/AC-38.arch.stdout.txt` | 242 B |
| `docs/iterations/iteration-10b/evidence/AC-38.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-38.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-38.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-38.meta.json` | 1064 B |
| `docs/iterations/iteration-10b/evidence/AC-38.status.txt` | 2046 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-dag.test.js）：测试文件存在 | ✅ | `test/wp14/drill-dag.test.js` |
| 2 | 机检 F-16（test/wp14/drill-dag.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-dag.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-dag.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-dag.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：边集为空不短路布局（if (!edges.length) return 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(result.nodes.length, 1)（期望含 "assert.equal(result.nodes.length, 1)"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 8 | Then 逐字：assert.equal(result.edges.length, 0)（期望含 "assert.equal(result.edges.length, 0)"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 9 | Then 逐字：result.bounds.width > 0 && result.bounds.height > 0（期望含 "result.bounds.width > 0 && result.bounds.height > 0"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 10 | Then 逐字：assert.equal(result.dangling, 0)（期望含 "assert.equal(result.dangling, 0)"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 11 | Then 逐字：'T-030'（期望含 "'T-030'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 12 | Then 逐字：JSON.stringify(a), JSON.stringify(b)（期望含 "JSON.stringify(a), JSON.stringify(b)"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:853-854）：局部 DAG 恰好 1 个节点、0 条连线，图区仍有可见尺寸（bounds>0），节点可见、dangling=0、不出现替代文案。
- 「两次布局逐字节相等」由同文件 buildDag 两次调用 JSON.stringify 相等断言承载（drill-dag.test.js:53），且布局复用同一 computeLayout（裁决 F3-08）；AC-38 机检原文聚焦单节点退化不塌陷。

---

#### AC-39 端点节点没有运行时状态时按「待执行」呈现

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-39`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-dag.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-dag.test.js   | cwd=D:\WWW\Maestro | exit=0 | 224ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-39 | exit=0 | 108ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-39.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-39.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 下钻范围内有节点 `T-031`（测试，定义里存在、`state.nodes` 里没有任何记录），它是本角色的直接下游；`NODE_ENV=test`。
- **When** 导出局部 DAG 与卡片。
- **Then** `T-031` 同时出现在 DAG 与卡片两处，状态词都是「待执行」、状态色是待执行色；不被隐藏、不显示为「状态未知」。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-39.tests.stdout.txt` | 1377 B |
| `docs/iterations/iteration-10b/evidence/AC-39.test.source.txt` | 5919 B |
| `docs/iterations/iteration-10b/evidence/AC-39.arch.stdout.txt` | 56 B |
| `docs/iterations/iteration-10b/evidence/AC-39.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-39.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-39.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-39.meta.json` | 1029 B |
| `docs/iterations/iteration-10b/evidence/AC-39.status.txt` | 2047 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-dag.test.js）：测试文件存在 | ✅ | `test/wp14/drill-dag.test.js` |
| 2 | 机检 F-16（test/wp14/drill-dag.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-dag.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-dag.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-dag.test.js）：无 not ok | ✅ | `无` |
| 6 | Then 逐字：assert.equal(pending.nodes[0].status, '待执行')（期望含 "assert.equal(pending.nodes[0].status, '待执行')"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 7 | Then 逐字：pending.lines.includes('局部节点 T-031 · 下游 · 角色 · 待执行')（期望含 "pending.lines.includes('局部节点 T-031 · 下游 · 角色 · 待执行')"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 8 | Then 逐字：blocked.lines.includes('局部节点 T-031 · 下游 · 角色 · 被阻塞')（期望含 "blocked.lines.includes('局部节点 T-031 · 下游 · 角色 · 被阻塞')"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 9 | Then 逐字：viewPending.cards[0].displayStatus, '待执行'（期望含 "viewPending.cards[0].displayStatus, '待执行'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 10 | Then 逐字：viewBlocked.cards[0].displayStatus, '被阻塞'（期望含 "viewBlocked.cards[0].displayStatus, '被阻塞'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 11 | Then 逐字：nodeId: 'T-031'（期望含 "nodeId: 'T-031'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点：T-031 同时在 DAG 与卡片出现、状态词「待执行」、色为待执行色；不隐藏、不显示「状态未知」。
- 语义断言（F4-12）：来源置换——把投影输出由 pending 改为 blocked（仅测试内注入），DAG 与卡片同步变「被阻塞」，证明卡片只渲染投影结果、不自造兜底；本 AC 不设 grep 锚点。

---

#### AC-40 节点角色 ID 与注册表对不上：仍画出并按角色节点显示

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-40`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-dag.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-dag.test.js   | cwd=D:\WWW\Maestro | exit=0 | 204ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-40 | exit=0 | 129ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-40.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-40.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 节点 `T-032` 的 `roleId` 为 `ghost-role`（注册表里没有这个角色），运行时状态为「执行中」，且它是本角色的直接上游；`NODE_ENV=test`。
- **When** 导出局部 DAG 与卡片。
- **Then** `T-032` 仍在 DAG 与卡片里，类型显示「角色」（不显示为未知类型、不显示为空），编号与状态照常；卡片总数与节点集合一一对应。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-40.tests.stdout.txt` | 1376 B |
| `docs/iterations/iteration-10b/evidence/AC-40.test.source.txt` | 5919 B |
| `docs/iterations/iteration-10b/evidence/AC-40.arch.stdout.txt` | 245 B |
| `docs/iterations/iteration-10b/evidence/AC-40.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-40.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-40.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-40.meta.json` | 1004 B |
| `docs/iterations/iteration-10b/evidence/AC-40.status.txt` | 2046 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-dag.test.js）：测试文件存在 | ✅ | `test/wp14/drill-dag.test.js` |
| 2 | 机检 F-16（test/wp14/drill-dag.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-dag.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-dag.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-dag.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：不按注册表存在性过滤节点（filter(.*registry\|hasRole( 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(node.type, 'role')（期望含 "assert.equal(node.type, 'role')"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 8 | Then 逐字：result.lines.includes('局部节点 T-032 · 上游 · 角色 · 执行中')（期望含 "result.lines.includes('局部节点 T-032 · 上游 · 角色 · 执行中')"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 9 | Then 逐字：view.cards.some((c) => c.nodeId === 'T-032')（期望含 "view.cards.some((c) => c.nodeId === 'T-032')"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 10 | Then 逐字：view.cards.length, view.dag.nodes.length（期望含 "view.cards.length, view.dag.nodes.length"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |
| 11 | Then 逐字：roleId: 'ghost-role'（期望含 "roleId: 'ghost-role'"） | ✅ | `/**<br> * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).<br> *<br> * Pure module surface only: no app.js, no transport, no DOM. Labels are the<br> * real frozen table; display words that have no dedicated key arrive as d` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:875）：T-032（roleId=ghost-role、执行中、直接上游）仍在 DAG 与卡片，类型显示「角色」不显示未知/空，编号与状态照常，卡片总数与节点集合一一对应。
- 拓扑矩阵口径：ghost-role 不在注册表仍保留节点；架构零命中证明不按注册表过滤。

---

#### AC-41 卡片缺值：标题或角色名缺失时显示 `—`

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-41`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-cards.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-cards.test.js   | cwd=D:\WWW\Maestro | exit=0 | 207ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-41 | exit=0 | 116ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-41.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-41.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 两个节点：`T-033` 的定义里没有 `title`；`T-034` 的最新会话没有可用的角色名；`NODE_ENV=test`；渲染时钟注入为固定值。
- **When** 导出这两张卡片。
- **Then** `T-033` 标题行为 `卡片 T-033 · — · 轮次 1/1 · 待执行`；`T-034` 执行行为 `执行 — · 执行中 · 已运行 3m · 工具 —`；两行都不含空字符串、`undefined`、`null`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-41.tests.stdout.txt` | 1253 B |
| `docs/iterations/iteration-10b/evidence/AC-41.test.source.txt` | 8025 B |
| `docs/iterations/iteration-10b/evidence/AC-41.arch.stdout.txt` | 56 B |
| `docs/iterations/iteration-10b/evidence/AC-41.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-41.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-41.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-41.meta.json` | 1057 B |
| `docs/iterations/iteration-10b/evidence/AC-41.status.txt` | 1927 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-cards.test.js）：测试文件存在 | ✅ | `test/wp14/drill-cards.test.js` |
| 2 | 机检 F-16（test/wp14/drill-cards.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-cards.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-cards.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-cards.test.js）：无 not ok | ✅ | `无` |
| 6 | Then 逐字：assert.equal(t033.lines[0], '卡片 T-033 · — · 轮次 1/1 · 待执行')（期望含 "assert.equal(t033.lines[0], '卡片 T-033 · — · 轮次 1/1 · 待执行')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 7 | Then 逐字：assert.equal(t034.lines[1], '执行 — · 执行中 · 已运行 3m · 工具 —')（期望含 "assert.equal(t034.lines[1], '执行 — · 执行中 · 已运行 3m · 工具 —')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 8 | Then 逐字：!/undefined\|null/.test(line)（期望含 "!/undefined\|null/.test(line)"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 9 | Then 逐字：assert.equal(swapped[0].lines[0], '卡片 T-033 · TBD · 轮次 1/1 · 待执行')（期望含 "assert.equal(swapped[0].lines[0], '卡片 T-033 · TBD · 轮次 1/1 · 待执行')"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |
| 10 | Then 逐字：title: 'TBD'（期望含 "title: 'TBD'"） | ✅ | `/**<br> * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).<br> *<br> * The clock is injected; display words that have no frozen label key arrive as<br> * data fields, never as literals in the module. Pure module surface only.` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:886）：T-033 标题行「卡片 T-033 · — · 轮次 1/1 · 待执行」；T-034 执行行「执行 — · 执行中 · 已运行 3m · 工具 —」；两行不含空串/undefined/null。
- 语义断言（F4-12）：来源置换——把投影标题改为 TBD，卡片原样显示 TBD，证明卡片只渲染投影值、不自造 —/undefined/null；本 AC 不设 grep 锚点。

---

#### AC-42 交接包很多：能滚到最后一条，行文本正确

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-42`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/connection-panel.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\connection-panel.test.js   | cwd=D:\WWW\Maestro | exit=0 | 201ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-42 | exit=0 | 103ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-42.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-42.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 角色对「开发→测试」上有 60 个交接包（`HO-001`~`HO-060`），按最近活动倒序排列——`HO-001` 最近、`HO-060` 最早（编号与时间反向，便于断言首末两行）；`NODE_ENV=test`。
- **When** 打开连接线面板；再滚动到最底部。
- **Then** 面板打开后可正常浏览（能看到第一行 `HO-001`）；一直滚能看到最后一条 `HO-060` 且该行逐字正确；滚动过程不卡顿、不出现空白行，滚到底后仍可展开任意一行的时间线。**用户可感的只有"滚得到、行对、不空白、不卡"**——数值化的耗时属内部断言。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-42.tests.stdout.txt` | 1167 B |
| `docs/iterations/iteration-10b/evidence/AC-42.test.source.txt` | 5579 B |
| `docs/iterations/iteration-10b/evidence/AC-42.arch.stdout.txt` | 56 B |
| `docs/iterations/iteration-10b/evidence/AC-42.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-42.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-42.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-42.meta.json` | 1073 B |
| `docs/iterations/iteration-10b/evidence/AC-42.status.txt` | 1851 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/connection-panel.test.js）：测试文件存在 | ✅ | `test/wp14/connection-panel.test.js` |
| 2 | 机检 F-16（test/wp14/connection-panel.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/connection-panel.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/connection-panel.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/connection-panel.test.js）：无 not ok | ✅ | `无` |
| 6 | Then 逐字：panel.visibleIds.includes('HO-001')（期望含 "panel.visibleIds.includes('HO-001')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 7 | Then 逐字：panel.visibleIds.includes('HO-060')（期望含 "panel.visibleIds.includes('HO-060')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 8 | Then 逐字：panel.rows.every((r) => r.id.startsWith('HO-'))（期望含 "panel.rows.every((r) => r.id.startsWith('HO-'))"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 9 | Then 逐字：/^交接 HO-060 · 第 1 轮 · 已投递 · \d{2}:\d{2}:\d{2}$/（期望含 "/^交接 HO-060 · 第 1 轮 · 已投递 · \\d{2}:\\d{2}:\\d{2}$/"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 10 | Then 逐字：panel.renderedRows < 60（期望含 "panel.renderedRows < 60"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 11 | Then 逐字：panel.scrollElapsed <= 200（期望含 "panel.scrollElapsed <= 200"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 12 | Then 逐字：panel.scrollToEnd()（期望含 "panel.scrollToEnd()"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 13 | Then 逐字：for (let i = 1; i <= 60; i += 1)（期望含 "for (let i = 1; i <= 60; i += 1)"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 14 | 架构：package.json 零运行时依赖（dependencies={}） | ✅ | `{}` |

**⑤ 判定**：通过

**备注**

- 用户可见 Then（requirement.md:897）：打开可见首行 HO-001、滚到底可见 HO-060 且行逐字、rows 均为 HO- 前缀、无空白行、滚到底仍可展开时间线。
- 内部断言（非用户可见，裁决 H 第5条 / 评审 F4-14）：renderedRows<60、scrollElapsed≤200 为纯模块面「模型坐标+注入时钟」模拟值，只作内部回归信号；S2 不引入真实 DOM/第三方虚拟滚动依赖。

---

#### AC-43 展开期间聚合状态变化：面板刷新，展开的包不跳走

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-43`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/connection-panel.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\connection-panel.test.js   | cwd=D:\WWW\Maestro | exit=0 | 212ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-43 | exit=0 | 106ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-43.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-43.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 已打开「开发→测试」的连接线面板并展开 `HO-010` 的时间线（该角色对在该实例的图投影里是一条既有定义边，边 id 形如 `E-NN`，`src/daemon/graph.js:554` 实点）；`NODE_ENV=test`。
- **When** 用 `POST /__test__/graph/pulse`（`kind: "connection"`，`key` 取该边的 `id`（`E-NN`），`statuses: ["rejected"]`）把该角色对的聚合状态改为「已拒绝」。
- **Then** 面板刷新后标题行的聚合词变为「已拒绝」，列表可能按新时间重排（`HO-010` 的行位置可以变），但 **`HO-010` 仍处展开态、仍看得见、条目没有从用户眼皮底下跳走**，已展开的时间线内容也没有被收起来。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-43.tests.stdout.txt` | 1168 B |
| `docs/iterations/iteration-10b/evidence/AC-43.test.source.txt` | 5579 B |
| `docs/iterations/iteration-10b/evidence/AC-43.arch.stdout.txt` | 224 B |
| `docs/iterations/iteration-10b/evidence/AC-43.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-43.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-43.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-43.meta.json` | 1084 B |
| `docs/iterations/iteration-10b/evidence/AC-43.status.txt` | 1852 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/connection-panel.test.js）：测试文件存在 | ✅ | `test/wp14/connection-panel.test.js` |
| 2 | 机检 F-16（test/wp14/connection-panel.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/connection-panel.test.js）：# pass ≥ 1 | ✅ | `# pass=5` |
| 4 | 机检 F-16（test/wp14/connection-panel.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/connection-panel.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：面板不自行取数（fetch(\|request( 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：changed.edge.aggregateStatus = 'rejected'（期望含 "changed.edge.aggregateStatus = 'rejected'"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 8 | Then 逐字：panelAfter.title.includes('已拒绝')（期望含 "panelAfter.title.includes('已拒绝')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 9 | Then 逐字：assert.equal(panelAfter.expandedId, 'HO-010')（期望含 "assert.equal(panelAfter.expandedId, 'HO-010')"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 10 | Then 逐字：assert.deepEqual(panelAfter.timelineRows, timelineBefore)（期望含 "assert.deepEqual(panelAfter.timelineRows, timelineBefore)"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 11 | Then 逐字：Math.abs(panelAfter.anchorRowTop - panelBefore.anchorRowTop) <= 1（期望含 "Math.abs(panelAfter.anchorRowTop - panelBefore.anchorRowTop) <= 1"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 12 | Then 逐字：expandedId: 'HO-010'（期望含 "expandedId: 'HO-010'"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 13 | Then 逐字：aggregateStatus: 'rejected'（期望含 "aggregateStatus: 'rejected'"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |

**⑤ 判定**：通过

**备注**

- 用户可见 Then（requirement.md:908）：刷新后标题聚合词变「已拒绝」；HO-010 仍处展开态、仍看得见、没从眼皮底下跳走；已展开时间线不被收起。
- 内部断言（非用户可见，裁决 H 第5条 / F2-11 / F4-14）：|anchorRowTopAfter - anchorRowTopBefore| ≤ 1（模型坐标+注入时钟的模拟值），scrollTop 仅记录不判方向；取数路径同 pulse overlay（D-14）。

---

#### AC-44 本实例 0 条待处理升级：空态与已处理记录

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-44`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/special-node-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\special-node-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 243ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-44 | exit=0 | 128ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-44.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-44.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 实例 `INST-001` 的 `escalations` 里 0 条 `pending`、2 条 `resolved`；`NODE_ENV=test`。
- **When** 从升级节点 `X-001` 进入升级处理面板。
- **Then** 第一行显示 `本实例待处理升级 0 个`；下面只读列出 2 条已处理记录（编号 · 状态 · 节点 · 角色 · 轮次）；「继续」不可点（没有目标）；不白屏、不抛错、可返回原视图。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-44.tests.stdout.txt` | 1514 B |
| `docs/iterations/iteration-10b/evidence/AC-44.test.source.txt` | 8056 B |
| `docs/iterations/iteration-10b/evidence/AC-44.arch.stdout.txt` | 252 B |
| `docs/iterations/iteration-10b/evidence/AC-44.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-44.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-44.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-44.meta.json` | 1007 B |
| `docs/iterations/iteration-10b/evidence/AC-44.status.txt` | 2200 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/special-node-jump.test.js）：测试文件存在 | ✅ | `test/wp14/special-node-jump.test.js` |
| 2 | 机检 F-16（test/wp14/special-node-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/special-node-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/special-node-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/special-node-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：空列表不短路渲染（if (!items.length) return 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：w('DRILL_ESC_COUNT').replace('{n}', '0')（期望含 "w('DRILL_ESC_COUNT').replace('{n}', '0')"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 8 | Then 逐字：assert.equal(p.items.length, 0)（期望含 "assert.equal(p.items.length, 0)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 9 | Then 逐字：assert.equal(p.resolved.length, 2)（期望含 "assert.equal(p.resolved.length, 2)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 10 | Then 逐字：assert.equal(p.continueDisabled, true)（期望含 "assert.equal(p.continueDisabled, true)"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 11 | Then 逐字：{ disabled: true }（期望含 "{ disabled: true }"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 12 | Then 逐字：state: 'resolved'（期望含 "state: 'resolved'"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 13 | Then 逐字：escalationId: 'ESC-003'（期望含 "escalationId: 'ESC-003'"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 14 | Then 逐字：escalationId: 'ESC-004'（期望含 "escalationId: 'ESC-004'"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 15 | Then 逐字：计数行渲染为「本实例待处理升级 0 个」 | ✅ | `本实例待处理升级 0 个` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:919）：第一行「本实例待处理升级 0 个」，只读列出 2 条已处理（编号·状态·节点·角色·轮次），「继续」不可点、不白屏、不抛错、可返回。
- 计数行由文案键 DRILL_ESC_COUNT（本实例待处理升级 {n} 个）以 {n}=0 逐字填充，已在 extra 中核对逐字结果。

---

#### AC-45 「继续」失败：提示既有错误原文，三处状态不变

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-45`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/escalation-continue.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\escalation-continue.test.js   | cwd=D:\WWW\Maestro | exit=0 | 254ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-45 | exit=0 | 120ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-45.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-45.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 同 AC-22 的实例（`suspended` + 1 条 `pending`），把界面注入的 `io.continueEscalation`（`契约：desktop/ui/app.js::createApp({ labels, project, io }).io.continueEscalation`，D-14 表 A4）换成返回 `{ok: false, message: '核心不可达'}` 的桩（形状与既有 HTTP 失败一致）；`NODE_ENV=test`。
- **When** 用户点「继续」并在确认里确认。
- **Then** 面板显示 `继续失败 · 核心不可达`（原文透传，不翻译、不自造）；实例仍「已挂起」、`T-002` 仍「已升级」、升级仍「待处理」；面板不关闭，「继续」恢复可点、可重试。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-45.tests.stdout.txt` | 1621 B |
| `docs/iterations/iteration-10b/evidence/AC-45.test.source.txt` | 8885 B |
| `docs/iterations/iteration-10b/evidence/AC-45.arch.stdout.txt` | 378 B |
| `docs/iterations/iteration-10b/evidence/AC-45.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-45.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-45.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-45.meta.json` | 1156 B |
| `docs/iterations/iteration-10b/evidence/AC-45.status.txt` | 2311 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/escalation-continue.test.js）：测试文件存在 | ✅ | `test/wp14/escalation-continue.test.js` |
| 2 | 机检 F-16（test/wp14/escalation-continue.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/escalation-continue.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/escalation-continue.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/escalation-continue.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：界面不改状态（node.state= / state=running 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：界面不写死原因文案（核心不可达 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：makeApp(async () => ({ ok: false, message: '核心不可达' }))（期望含 "makeApp(async () => ({ ok: false, message: '核心不可达' }))"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 9 | Then 逐字：w('DRILL_ESC_FAILED').replace('{reason}', '核心不可达')（期望含 "w('DRILL_ESC_FAILED').replace('{reason}', '核心不可达')"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 10 | Then 逐字：escalationNotice.retryable, true（期望含 "escalationNotice.retryable, true"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 11 | Then 逐字：escalationPanel.data.items.length, 0（期望含 "escalationPanel.data.items.length, 0"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 12 | Then 逐字：appSrc.includes('核心不可达'), false（期望含 "appSrc.includes('核心不可达'), false"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 13 | Then 逐字：const eventsBefore = 0（期望含 "const eventsBefore = 0"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 14 | Then 逐字：assert.equal(0, eventsBefore)（期望含 "assert.equal(0, eventsBefore)"） | ✅ | `/**<br> * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).<br> *<br> * The raw error codes never appear in desktop/ui; the injected io seam mirrors<br> * the daemon return shape. Message expectations for the transport response are<br` |
| 15 | Then 逐字：提示为「继续失败 · 核心不可达」 | ✅ | `继续失败 · 核心不可达` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:930）：提示「继续失败 · 核心不可达」（原文透传，不翻译不自造）；实例仍已挂起、T-002 仍已升级、升级仍待处理；面板不关闭、继续恢复可点可重试。
- 失败桩形状与既有 HTTP 失败一致（{ok:false,message}），不改核心/状态机；events 中 escalation.resolved 计数不变（内部断言），retryable===true 证明可重试；「核心不可达」在 desktop/ui/ 零命中证明不自造原因。

---

## 3. 不通过 / 阻塞项原始帧摘要

（无当前不通过 / 阻塞项：AC-34、AC-37 均已复判为通过，原判痕迹见下方留痕。）

> **AC-37 复判留痕（2026-11-16，裁决 J F4-05 补齐后复验）**：AC-37 原按「只认需求 Then/机检逐字、不放宽断言」判「不通过」（16/17）——`test/wp14/drill-errors.test.js:87` 的 `lastAction` 夹具与 `:114` 的 `assert.deepEqual` 对象原仅 4 字段、缺 `stateSince=2026-11-15T10:04:00.000Z`。测试侧按裁决 J F4-05 补齐 5 字段夹具 + 逐字段断言后，重跑 `node probe/acc10b-f-run.mjs AC-37` 得 **17/17 全过**，机检逐字第 17 条逐字成立（夹具行/断言行均含 `stateSince='2026-11-15T10:04:00.000Z'`），AC-37 复判为**通过**。用户可见 Then（状态栏逐字行、卡片两张、`statusReason=unknown-role` 透传）未放宽，`mock 实测` 证据分级与三档判据照旧；未改产品代码/测试/需求/拆分（改动仅在 `test/wp14/drill-errors.test.js` 测试夹具侧，由主控执行，本 Agent 只写验收产物）。原不通过原始帧见 `evidence/_archive_AC-37_pre-reverify_20261116T175504Z/`，原判理由见本文件 §2 AC-37 段「原判留痕」条与 `probe/acc10b-f-blockers.md` C-1.2。

>
> **AC-34 复判留痕（裁决 K）**：AC-34 原按裁决 G 严格口径判「不通过」（差集 = 2：`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`、`AC-04：空态…`）。2026-11-17 补齐两类原始帧后按裁决 K 目的性口径复判为**通过**：两条在干净 HEAD `818576f^`（`18438d6`）上同样红，属 S0 开工基线既有红（见 `evidence/flake-frames/baseline-HEAD-*-20261117-013949.log`），不算新增红；允许集合 = 16 ∪ 既有红 2 ∪ flake，`observedFail 15 ∖ allowed 18 = 0`。原不通过判定书见本文件 §2 AC-34 段「历史留痕」条与 `probe/acc10b-f-blockers.md` C-1.1。

## 4. 证据索引

共 117 个本批文件（含裁决 K 新增 2 帧干净 HEAD 基线 TAP）；每条 AC 至少 state / events / tests.stdout / meta / status 原始帧，无空文件。

| AC | 文件数 | 证据文件 |
|---|---|---|
| AC-31 | 8 | `evidence/AC-31.arch.stdout.txt`<br>`evidence/AC-31.corestop.txt`<br>`evidence/AC-31.events.jsonl`<br>`evidence/AC-31.meta.json`<br>`evidence/AC-31.state.json`<br>`evidence/AC-31.status.txt`<br>`evidence/AC-31.test.source.txt`<br>`evidence/AC-31.tests.stdout.txt` |
| AC-32 | 8 | `evidence/AC-32.arch.stdout.txt`<br>`evidence/AC-32.corestop.txt`<br>`evidence/AC-32.events.jsonl`<br>`evidence/AC-32.meta.json`<br>`evidence/AC-32.state.json`<br>`evidence/AC-32.status.txt`<br>`evidence/AC-32.test.source.txt`<br>`evidence/AC-32.tests.stdout.txt` |
| AC-34 | 13 | `evidence/AC-34.arch.stdout.txt`<br>`evidence/AC-34.corestop.txt`<br>`evidence/AC-34.diffset.txt`<br>`evidence/AC-34.events.jsonl`<br>`evidence/AC-34.fullrun.tap.txt`<br>`evidence/AC-34.meta.json`<br>`evidence/AC-34.newred-recheck.txt`<br>`evidence/AC-34.state.json`<br>`evidence/AC-34.status.txt`<br>`evidence/AC-34.test.source.txt`<br>`evidence/AC-34.tests.stdout.txt`<br>`evidence/flake-frames/baseline-HEAD-handoff-schema-20261117-013949.log`<br>`evidence/flake-frames/baseline-HEAD-instance-list-20261117-013949.log` |
| AC-35 | 8 | `evidence/AC-35.arch.stdout.txt`<br>`evidence/AC-35.corestop.txt`<br>`evidence/AC-35.events.jsonl`<br>`evidence/AC-35.meta.json`<br>`evidence/AC-35.state.json`<br>`evidence/AC-35.status.txt`<br>`evidence/AC-35.test.source.txt`<br>`evidence/AC-35.tests.stdout.txt` |
| AC-36 | 8 | `evidence/AC-36.arch.stdout.txt`<br>`evidence/AC-36.corestop.txt`<br>`evidence/AC-36.events.jsonl`<br>`evidence/AC-36.meta.json`<br>`evidence/AC-36.state.json`<br>`evidence/AC-36.status.txt`<br>`evidence/AC-36.test.source.txt`<br>`evidence/AC-36.tests.stdout.txt` |
| AC-37 | 8 | `evidence/AC-37.arch.stdout.txt`<br>`evidence/AC-37.corestop.txt`<br>`evidence/AC-37.events.jsonl`<br>`evidence/AC-37.meta.json`<br>`evidence/AC-37.state.json`<br>`evidence/AC-37.status.txt`<br>`evidence/AC-37.test.source.txt`<br>`evidence/AC-37.tests.stdout.txt` |
| AC-38 | 8 | `evidence/AC-38.arch.stdout.txt`<br>`evidence/AC-38.corestop.txt`<br>`evidence/AC-38.events.jsonl`<br>`evidence/AC-38.meta.json`<br>`evidence/AC-38.state.json`<br>`evidence/AC-38.status.txt`<br>`evidence/AC-38.test.source.txt`<br>`evidence/AC-38.tests.stdout.txt` |
| AC-39 | 8 | `evidence/AC-39.arch.stdout.txt`<br>`evidence/AC-39.corestop.txt`<br>`evidence/AC-39.events.jsonl`<br>`evidence/AC-39.meta.json`<br>`evidence/AC-39.state.json`<br>`evidence/AC-39.status.txt`<br>`evidence/AC-39.test.source.txt`<br>`evidence/AC-39.tests.stdout.txt` |
| AC-40 | 8 | `evidence/AC-40.arch.stdout.txt`<br>`evidence/AC-40.corestop.txt`<br>`evidence/AC-40.events.jsonl`<br>`evidence/AC-40.meta.json`<br>`evidence/AC-40.state.json`<br>`evidence/AC-40.status.txt`<br>`evidence/AC-40.test.source.txt`<br>`evidence/AC-40.tests.stdout.txt` |
| AC-41 | 8 | `evidence/AC-41.arch.stdout.txt`<br>`evidence/AC-41.corestop.txt`<br>`evidence/AC-41.events.jsonl`<br>`evidence/AC-41.meta.json`<br>`evidence/AC-41.state.json`<br>`evidence/AC-41.status.txt`<br>`evidence/AC-41.test.source.txt`<br>`evidence/AC-41.tests.stdout.txt` |
| AC-42 | 8 | `evidence/AC-42.arch.stdout.txt`<br>`evidence/AC-42.corestop.txt`<br>`evidence/AC-42.events.jsonl`<br>`evidence/AC-42.meta.json`<br>`evidence/AC-42.state.json`<br>`evidence/AC-42.status.txt`<br>`evidence/AC-42.test.source.txt`<br>`evidence/AC-42.tests.stdout.txt` |
| AC-43 | 8 | `evidence/AC-43.arch.stdout.txt`<br>`evidence/AC-43.corestop.txt`<br>`evidence/AC-43.events.jsonl`<br>`evidence/AC-43.meta.json`<br>`evidence/AC-43.state.json`<br>`evidence/AC-43.status.txt`<br>`evidence/AC-43.test.source.txt`<br>`evidence/AC-43.tests.stdout.txt` |
| AC-44 | 8 | `evidence/AC-44.arch.stdout.txt`<br>`evidence/AC-44.corestop.txt`<br>`evidence/AC-44.events.jsonl`<br>`evidence/AC-44.meta.json`<br>`evidence/AC-44.state.json`<br>`evidence/AC-44.status.txt`<br>`evidence/AC-44.test.source.txt`<br>`evidence/AC-44.tests.stdout.txt` |
| AC-45 | 8 | `evidence/AC-45.arch.stdout.txt`<br>`evidence/AC-45.corestop.txt`<br>`evidence/AC-45.events.jsonl`<br>`evidence/AC-45.meta.json`<br>`evidence/AC-45.state.json`<br>`evidence/AC-45.status.txt`<br>`evidence/AC-45.test.source.txt`<br>`evidence/AC-45.tests.stdout.txt` |
