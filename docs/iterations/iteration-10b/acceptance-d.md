# I1.10b S3 验收 · D 组（AC-46 ~ AC-51）

> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-10 逐字基线；
> `docs/templates/execution-template.md` §3.1~§3.5；`docs/iterations/iteration-10b/decisions.md` 裁决 A/I/J/K/L（跳转三段口径、标识==sessionId、J-2 stateLabel、K 允许集合口径、L AC-51 机检断言语义等价口径）。
> 取证脚手架：`probe/acc10b-f-{lib,common,run}.mjs` + `probe/acc10b-f-final-d.mjs` + `probe/acc10b-cases/{ac46..ac51}.mjs`（目录名不带 `-f`）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`、需求与拆分。

## 0. 总判

**6 条：通过 6 / 不通过 0 / 阻塞 0**（AC-51 经裁决 L 复判为通过 18/18）

- 已产出证据与判定：6 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-10b/evidence/` 下 AC-46~AC-51 相关共 48 个（每条 ≥4 文件、无空文件；实测每 AC 8 文件）。
- 不通过 / 阻塞条目：无。AC-51 原 17/18 不通过的唯一未成立项，已按裁决 L 修正验收机检代理后复判为通过 18/18（详见 §2 AC-51 备注、§3 与 §5）。
- 本批复验（2026-11-16，AC-46 / AC-51）：两处实现修复后独立复跑——AC-46 维持 17/17 通过（`host-jump.js` 已按 `DRILL_HOST_FAILED` 模板前缀区分「未找到」与「跳转失败 · <原因>」，`host-jump.test.js` 新增真实形状用例 `code=DSH_SPAWN_FAILED` + `message='跳转失败 · 权限被拒'`，AC-26 三降级未退化）；AC-51 由 13/18 提升至 17/18（产品测试已新增 view 级三点击 + view 三态断言 + `stateHash` + `open-connection` 路由，判定要求 2 的逐字断言全部具备），唯一未达 18/18 的原因是验收机检以 `src.includes("assert.notEqual")` 检测，而产品用语义等价的 `assert.ok(st.view !== 'escalation-panel')`——属机检字面过严，非产品 Then 缺陷。该次如实记 17/18，为后续裁决 L 的输入。
- 裁决 L 复判（2026-11-16，仅 AC-51）：按 `decisions.md` 裁决 L，把 `probe/acc10b-cases/ac51.mjs` 该项代理由 `src.includes('assert.notEqual')` 单一字面代理改为**语义等价检测**（接受 `assert.notEqual(x, 'LIT')` 或 `assert.ok(x !== 'LIT')`，要求断言右侧字面量确为 `'escalation-panel'` / `'drill'`，核完整断言结构、不恒真、不删项、不放宽任何 Then）。重跑 `node probe/acc10b-f-run.mjs AC-51` 得 **18/18 通过**：第 15 项命中产品线 189 `assert.ok(st.view !== 'escalation-panel')`，第 16 项命中 :190 `assert.ok(st.view !== 'drill')`，其余 16 项维持通过。旧 8 帧归档至 `evidence/_archive_AC-51_pre-L-reverify_20261116T225104Z/`，新帧覆盖 `evidence/AC-51.*`。**只改验收用例代理，未改产品代码 / `test/**` / 需求 / 拆分。** 历史 17/18 判定留痕于 §3 / §5。
- 机器可读汇总：`probe/acc10b-f-summary-d.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`（批次 d 段）。
- 判定口径：`通过` = 需求 Then/机检逐字全部成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时（90s 上限记阻塞）。
- 判定纪律：只认需求原文 Then/机检逐字，不采信测试自述；文案逐字比对、数量核对数组长度、内部断言（耗时/哈希/键计数）仅作回归信号不冒充用户可见结论；同 AC 多记录取最后一条。
- 取证环境：独立项目根 `%TEMP%/maestro-i10b-acc10b-f/<AC>/`、`NODE_ENV=test`、mock 宿主、每条结束 `orch core stop`；超时上限 90s。

## 1. AC 逐条判定表

| AC | 标题 | 判定 | 证据分级 | 核对项 | 证据文件数 | 关键实测 |
|---|---|---|---|---|---|---|
| AC-46 | 唤起宿主失败：提示可读、可重试、不改状态 | **通过** | mock 实测 | 17/17 | 8 | 跳转失败 · 前缀 + retryable===true + 跳转零进程 + sha256 不变 |
| AC-47 | 角色与连接线同时变化：两条都到、都不丢 | **通过** | mock 实测 | 15/15 | 8 | 两条状态更新同时到达、顺序不变、2s 内 |
| AC-48 | 下钻期间角色状态词转「未参与」：界面不清空、不崩、不关 | **通过** | mock 实测 | 17/17 | 8 | pulse 只翻状态词、服务/宿主/最近逐项保留、DAG 不塌陷 |
| AC-49 | 角色节点上的 escalated 角标直达本实例升级处理面板（基线 477 的角标侧落点） | **通过** | mock 实测 | 17/17 | 8 | view===escalation-panel 且 !==drill、面包屑/计数/两条升级逐字 |
| AC-50 | 角色绑定归零后重新取数：状态栏「未参与」+ 卡片「任务 无」+ DAG 保留（BR-41 的另一半） | **通过** | mock 实测 | 23/23 | 8 | graphStreamReopened===true、角色行逐字、卡片「任务 无」、DAG 保留 |
| AC-51 | 基线 477 连线侧的改道判定：红色 / 橙色连接线进交接包面板，不进升级面板 | **通过**（裁决 L 复判） | mock 实测 | 18/18 | 8 | view 三态断言 + stateHash + open-connection 路由 18 项全部成立；第 15/16 项经语义等价检测命中产品 `assert.ok(st.view !== 'escalation-panel')` / `assert.ok(st.view !== 'drill')` |

## 2. 逐 AC 取证明细（命令 / 需求原文 / 证据 / 逐项核对）

#### AC-46 唤起宿主失败：提示可读、可重试、不改状态

- 判定：**通过**（核对 17/17 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-46`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/host-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\host-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 190ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-46 | exit=0 | 101ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-46.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-46.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** `MAESTRO_DSH_EXE` 指向一个存在但不可执行的文件（模拟被权限或杀软拦截）；角色有 1 个活跃会话且宿主为 `dsh`；`NODE_ENV=test`。
- **When** 用户点「打开宿主会话」。
- **Then** 提示 `跳转失败 · <原因>`（原因取适配器返回的既有原文）；按钮恢复可点、可重试；实例状态不变、不产生 DSH 进程、界面不崩溃。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-46.tests.stdout.txt` | 1519 B |
| `docs/iterations/iteration-10b/evidence/AC-46.test.source.txt` | 14164 B |
| `docs/iterations/iteration-10b/evidence/AC-46.arch.stdout.txt` | 213 B |
| `docs/iterations/iteration-10b/evidence/AC-46.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-46.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-46.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-46.meta.json` | 1454 B |
| `docs/iterations/iteration-10b/evidence/AC-46.status.txt` | 2189 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/host-jump.test.js）：测试文件存在 | ✅ | `test/wp14/host-jump.test.js` |
| 2 | 机检 F-16（test/wp14/host-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/host-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/host-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/host-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：界面不直接起进程（spawn(\|execFile( 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：const reason = '权限或杀软拦截';（期望含 "const reason = '权限或杀软拦截';"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 8 | Then 逐字：assert.ok(view.toasts[0].startsWith('跳转失败 · '), 'failure toast must start with the verbatim prefix');（期望含 "assert.ok(view.toasts[0].startsWith('跳转失败 · '), 'failure toast must start with the ve | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 9 | Then 逐字：assert.ok(view.toasts[0].slice('跳转失败 · '.length).length > 0, 'reason suffix must be non-empty');（期望含 "assert.ok(view.toasts[0].slice('跳转失败 · '.length).length > 0, 'reason suffix must be non-em | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 10 | Then 逐字：assert.equal(view.toasts[0], A7.failed(reason));（期望含 "assert.equal(view.toasts[0], A7.failed(reason));"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 11 | Then 逐字：assert.equal(jump.ok, false);（期望含 "assert.equal(jump.ok, false);"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 12 | Then 逐字：assert.equal(retryable, true);（期望含 "assert.equal(retryable, true);"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 13 | Then 逐字：assert.equal(view.jumpCalls, 0, 'failed launch produces no process signal');（期望含 "assert.equal(view.jumpCalls, 0, 'failed launch produces no process signal');"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 14 | Then 逐字：assert.equal(sha256(state), stateHashBefore);（期望含 "assert.equal(sha256(state), stateHashBefore);"） | ✅ | `/**<br> * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).<br> *<br> * Module-surface fixtures only: the real DeepSeek Harness process is never<br> * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file<br> * only fee` |
| 15 | openHost 非 ENOENT 失败路径：spawnFailure 产出 跳转失败 · 前缀（期望含 "`跳转失败 · ${cause}`"） | ✅ | `// 打开宿主会话适配器（I1.10b WP-2；需求 D-4 / §3.7 + AC-26 Then）。<br>//<br>// 配置驱动：`<root>/.orch/hosts/<hostId>.json` 的 `open: {command, args}` 段<br>// 是唯一命令来源；宿主配置存在但缺 `open` 段 → `HOST_UNSUPPORTED`<br>// （「宿主 <host> 不支持跳转」）；宿主配置文件不存在时按 D-4 的缺省顺序<br>// 复用 `src/adapter/dsh` |
| 16 | openHost 非 ENOENT 失败路径：ENOENT 单独分流（期望含 "err?.code === 'ENOENT'"） | ✅ | `// 打开宿主会话适配器（I1.10b WP-2；需求 D-4 / §3.7 + AC-26 Then）。<br>//<br>// 配置驱动：`<root>/.orch/hosts/<hostId>.json` 的 `open: {command, args}` 段<br>// 是唯一命令来源；宿主配置存在但缺 `open` 段 → `HOST_UNSUPPORTED`<br>// （「宿主 <host> 不支持跳转」）；宿主配置文件不存在时按 D-4 的缺省顺序<br>// 复用 `src/adapter/dsh` |
| 17 | Then 逐字：提示为「跳转失败 · 权限或杀软拦截」（A-7 / DRILL_HOST_FAILED） | ✅ | `跳转失败 · 权限或杀软拦截` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:941-944）：提示「跳转失败 · <原因>」（原因取适配器返回的既有原文）；按钮恢复可点、可重试（机检 retryable===true）；实例状态不变、不产生 DSH 进程、界面不崩溃。
- 机检内部断言（非用户可见）：state.json 与 events.jsonl 的字节哈希不变；本批模块面以 fixture 快照 sha256 前后相等代理，真实落盘字节哈希属人工核验面。
- Given 为 MAESTRO_DSH_EXE 指向存在但不可执行文件 → openHost 走非 ENOENT 的 spawnFailure 分支（src/adapter/host-open.js:58-64）；该分支产出「跳转失败 · <cause>」，与 ENOENT 的「未找到 DeepSeek Harness」分开。
- 架构检查：desktop/ui/drill/ 零 spawn(/execFile(，界面不直接起进程。

---

#### AC-47 角色与连接线同时变化：两条都到、都不丢

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-47`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-live.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-live.test.js   | cwd=D:\WWW\Maestro | exit=0 | 202ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-47 | exit=0 | 117ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-47.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-47.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 已进入「开发」下钻并处于静默（该角色此刻「可用」、无服务中节点；其参与的角色对上有一条连接线，聚合为「已投递」）；`NODE_ENV=test`。
- **When** 在同一秒内先 `POST /__test__/graph/pulse`（`kind: "role"`，`key` 取该角色 `roleId`，`statuses: ["serving"]`，把角色从「可用」改为「服务中」），紧接着 `kind: "connection"`（`key` 取该边 `id`（`E-NN`），`statuses: ["rejected"]`，把该线的聚合从「已投递」改为「已拒绝」）。
- **Then** 状态栏转「服务中」、那条连接线的聚合（图上的线色；面板若已打开则其标题行同步）转「已拒绝」；两条变化都到达、没有一条被另一条覆盖或丢弃；卡片顺序不变。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-47.tests.stdout.txt` | 1555 B |
| `docs/iterations/iteration-10b/evidence/AC-47.test.source.txt` | 9530 B |
| `docs/iterations/iteration-10b/evidence/AC-47.arch.stdout.txt` | 264 B |
| `docs/iterations/iteration-10b/evidence/AC-47.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-47.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-47.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-47.meta.json` | 1306 B |
| `docs/iterations/iteration-10b/evidence/AC-47.status.txt` | 2227 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-live.test.js）：测试文件存在 | ✅ | `test/wp14/drill-live.test.js` |
| 2 | 机检 F-16（test/wp14/drill-live.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-live.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-live.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-live.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：不新开第二推送通道（new WebSocket(/EventSource( 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }));（期望含 "app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }));"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 8 | Then 逐字：app.handleFrame(frame('connection.updated', 'E-07', { aggregateStatus: 'rejected' }));（期望含 "app.handleFrame(frame('connection.updated', 'E-07', { aggregateStatus: 'rejected' }));"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 9 | Then 逐字：assert.equal(v.roleBar.status, statusWord('serving'));（期望含 "assert.equal(v.roleBar.status, statusWord('serving'));"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 10 | Then 逐字：assert.equal(v.connection.title.includes(handoffWord('rejected')), true);（期望含 "assert.equal(v.connection.title.includes(handoffWord('rejected')), true);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 11 | Then 逐字：assert.deepEqual(order(v), beforeOrder);（期望含 "assert.deepEqual(order(v), beforeOrder);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 12 | Then 逐字：assert.ok(roleAt - trigger <= 2000);（期望含 "assert.ok(roleAt - trigger <= 2000);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 13 | Then 逐字：assert.ok(connAt - trigger <= 2000);（期望含 "assert.ok(connAt - trigger <= 2000);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 14 | 状态词 serving → 服务中（期望 "服务中"） | ✅ | `"服务中"` |
| 15 | 交接词 rejected → 已拒绝（期望 "已拒绝"） | ✅ | `"已拒绝"` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:952）：状态栏转「服务中」、连接线聚合转「已拒绝」；两条变化都到达、无覆盖无丢弃；卡片顺序不变（机检 roleMissed===false / connectionMissed===false / order_before===order_after）。
- 内部断言（非用户可见）：roleUpdatedAt/connectionUpdatedAt - trigger ≤ 2000（NF-2 的 2 秒上限，与 Then 一致不放宽）。
- 夹具：两条变化经同一条图流接缝连续触发（裁决 H：下钻与图投影共用 overlay，不新开通道/帧类型）；接缝限制同 AC-27——只翻状态词、不翻 servingNodes，本 AC 只判两条都到、互不覆盖。

---

#### AC-48 下钻期间角色状态词转「未参与」：界面不清空、不崩、不关

- 判定：**通过**（核对 17/17 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-48`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-live.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-live.test.js   | cwd=D:\WWW\Maestro | exit=0 | 203ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-48 | exit=0 | 102ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-48.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-48.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 已进入「开发」下钻：该角色绑定 `T-001 / T-002 / T-003`，其中 `T-001`、`T-002` 为服务中节点、共 2 条活跃会话（宿主 `dsh`、`cursor`），状态「服务中」，卡片 3 张，局部 DAG 5 个节点；界面处于静默；`NODE_ENV=test`。
- **When** 用既有测试接缝 `POST /__test__/graph/pulse`（`kind: "role"`，`key` 取该角色的 `roleId`，`statuses: ["inactive"]`）把该角色的状态词翻成 `inactive`，静默等待推送到达。
- **Then** 状态栏状态词转「未参与」；**该接缝只覆盖角色状态词，不覆盖绑定与会话**，因此其余四段仍是最后一次投影的真实内容（`服务 …`、`宿主 …`、`最近 …` 不清空、不变成 `undefined`），卡片不消失、局部 DAG 不塌陷——界面**不因为状态词变化而自作聪明地清空其它段**，不白屏、不报错、下钻不关闭，用户仍可点「返回流程图」。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-48.tests.stdout.txt` | 1556 B |
| `docs/iterations/iteration-10b/evidence/AC-48.test.source.txt` | 9530 B |
| `docs/iterations/iteration-10b/evidence/AC-48.arch.stdout.txt` | 283 B |
| `docs/iterations/iteration-10b/evidence/AC-48.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-48.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-48.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-48.meta.json` | 1411 B |
| `docs/iterations/iteration-10b/evidence/AC-48.status.txt` | 2228 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-live.test.js）：测试文件存在 | ✅ | `test/wp14/drill-live.test.js` |
| 2 | 机检 F-16（test/wp14/drill-live.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-live.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-live.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-live.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：空卡片不清空面板、不短路渲染（if (!cards.length) return\|return null 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：app.handleFrame(frame('role_instance.updated', 'developer', { status: 'inactive' }));（期望含 "app.handleFrame(frame('role_instance.updated', 'developer', { status: 'inactive' }));"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 8 | Then 逐字：assert.equal(v.roleBar.status, statusWord('inactive'));（期望含 "assert.equal(v.roleBar.status, statusWord('inactive'));"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 9 | Then 逐字：assert.deepEqual(v.roleBar.servingNodes, beforeServing);（期望含 "assert.deepEqual(v.roleBar.servingNodes, beforeServing);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 10 | Then 逐字：assert.deepEqual(v.roleBar.hostIcons, beforeHosts);（期望含 "assert.deepEqual(v.roleBar.hostIcons, beforeHosts);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 11 | Then 逐字：assert.deepEqual(v.roleBar.lastAction, beforeLast);（期望含 "assert.deepEqual(v.roleBar.lastAction, beforeLast);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 12 | Then 逐字：assert.equal(v.cards.length, beforeCards);（期望含 "assert.equal(v.cards.length, beforeCards);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 13 | Then 逐字：assert.equal(v.dag.nodes.length, beforeDagLen);（期望含 "assert.equal(v.dag.nodes.length, beforeDagLen);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 14 | Then 逐字：assert.equal(app.state().view, 'drill');（期望含 "assert.equal(app.state().view, 'drill');"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 15 | Then 逐字：assert.ok(at - trigger <= 2000);（期望含 "assert.ok(at - trigger <= 2000);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 16 | 状态词 inactive → 未参与（期望 "未参与"） | ✅ | `"未参与"` |
| 17 | 接缝只翻状态词（frame 仅含 status: inactive），不覆盖绑定字段（期望含 "{ status: 'inactive' }"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:963）：状态栏状态词转「未参与」；因接缝只覆盖角色状态词、不覆盖绑定与会话，其余四段（服务 …、宿主 …、最近 …）仍是最后一次投影的真实内容，不清空、不变成 undefined；卡片不消失、局部 DAG 不塌陷、下钻不关闭、可返回流程图。
- 机检内部断言：t_update - t_trigger ≤ 2000（裁决 H 第 5 条分层，非用户可见）。
- 裁决 H overlay 能力边界：POST /__test__/graph/pulse 接缝只能翻角色状态词（src/daemon/http/stream.js:255-275,586），不能清空 roleId 绑定；绑定归零后「任务 无」的形态由 AC-50 承担，本 AC 只判「状态词翻转、其余段保留」。

---

#### AC-49 角色节点上的 escalated 角标直达本实例升级处理面板（基线 477 的角标侧落点）

- 判定：**通过**（核对 17/17 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-49`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/special-node-jump.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\special-node-jump.test.js   | cwd=D:\WWW\Maestro | exit=0 | 218ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-49 | exit=0 | 113ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-49.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-49.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 实例 `INST-001` 有 2 条待处理升级（`ESC-001` 挂 `T-003` 第 2 轮、`ESC-002` 挂 `T-005` 第 1 轮），另一实例 `INST-002` 有 1 条待处理升级；角色「开发」的节点 `T-003` 在角色流程图上带 `escalated` 红色角标；界面已进入 `INST-001` 的角色流程图；`NODE_ENV=test`。
- **When** 点击「开发」角色节点上的 `escalated` 红色角标。
- **Then** 直接进入**本实例的升级处理面板**（不经过角色下钻、不进入角色下钻）：面包屑逐字为 `实例 INST-001 / 升级处理`；面板标题「升级处理」、计数行 `本实例待处理升级 2 个`；两条升级依次列出；可操作项只有「继续」与「取消」；不出现 `INST-002` 的升级；点返回后回到角色流程图且缩放/折叠状态保持；全过程不改变任何编排状态。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-49.tests.stdout.txt` | 1515 B |
| `docs/iterations/iteration-10b/evidence/AC-49.test.source.txt` | 8056 B |
| `docs/iterations/iteration-10b/evidence/AC-49.arch.stdout.txt` | 331 B |
| `docs/iterations/iteration-10b/evidence/AC-49.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-49.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-49.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-49.meta.json` | 1531 B |
| `docs/iterations/iteration-10b/evidence/AC-49.status.txt` | 2201 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/special-node-jump.test.js）：测试文件存在 | ✅ | `test/wp14/special-node-jump.test.js` |
| 2 | 机检 F-16（test/wp14/special-node-jump.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/special-node-jump.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/special-node-jump.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/special-node-jump.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：面板标题只在一处产出（DRILL_ESC_TITLE 恰 1 条，\| wc -l 口径）（expect=exact:1） | ✅ | `exit=0 hits=1 \| desktop/ui/drill/escalation-panel.js:70:  const title = take(resolver, 'DRILL_ESC_TITLE', {}, missingLabels);` |
| 7 | Then 逐字：assert.equal(st.view, 'escalation-panel');（期望含 "assert.equal(st.view, 'escalation-panel');"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 8 | Then 逐字：assert.notEqual(st.view, 'drill');（期望含 "assert.notEqual(st.view, 'drill');"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 9 | Then 逐字：assert.equal(v.breadcrumb, '实例 INST-001 / 升级处理');（期望含 "assert.equal(v.breadcrumb, '实例 INST-001 / 升级处理');"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 10 | Then 逐字：assert.equal(v.escalations.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'));（期望含 "assert.equal(v.escalations.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'));"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 11 | Then 逐字：assert.deepEqual(v.escalations.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002']);（期望含 "assert.deepEqual(v.escalations.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002']);"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 12 | Then 逐字：assert.deepEqual(v.escalations.actions, ['继续', '取消']);（期望含 "assert.deepEqual(v.escalations.actions, ['继续', '取消']);"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 13 | Then 逐字：assert.equal(hash(stateFile), beforeHash);（期望含 "assert.equal(hash(stateFile), beforeHash);"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |
| 14 | ctl 委托含 open-escalation（升级节点/角标共用入口）（期望含 "action === 'open-escalation'"） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure modules and the window: it<br> * decides` |
| 15 | openEscalationPanel 把 view 置为 escalation-panel（期望含 "state.view = 'escalation-panel'"） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure modules and the window: it<br> * decides` |
| 16 | Then 逐字：角标入口面包屑逐字为「实例 INST-001 / 升级处理」 | ✅ | `实例 INST-001 / 升级处理` |
| 17 | 内部断言：hash(stateFile) === beforeHash（期望含 "hash(stateFile), beforeHash"） | ✅ | `/**<br> * WP-4 assembly contract: special-node jump + escalation panel boundaries<br> * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).<br> * Both escalation entry points land on the SAME `view === 'escalation-panel'`<br> * state; the badge entry must NEVER be `drill` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:974-977）：直接进入本实例升级处理面板（不经过角色下钻、不进入角色下钻）；面包屑「实例 INST-001 / 升级处理」；标题「升级处理」、计数「本实例待处理升级 2 个」；两条依次列出；可操作项只有「继续」「取消」；不出现 INST-002；返回后缩放/折叠保持；全过程不改编排状态（stateHashBefore === stateHashAfter）。
- 机检：view === escalation-panel 且 view !== drill；items 恰 [ESC-001, ESC-002]；actions 逐项 [继续, 取消]；zoom/pan/collapsed 进入前后相等。
- 入口口径（基线 477 角标侧落点）：升级面板入口仅两处——升级节点（AC-21）与角色节点 escalated 角标（AC-49）；两处复用同一面板导出，架构检查 DRILL_ESC_TITLE 恰 1 处。

---

#### AC-50 角色绑定归零后重新取数：状态栏「未参与」+ 卡片「任务 无」+ DAG 保留（BR-41 的另一半）

- 判定：**通过**（核对 23/23 通过）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-50`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/drill-live.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\drill-live.test.js   | cwd=D:\WWW\Maestro | exit=0 | 212ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-50 | exit=0 | 112ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-50.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-50.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 已进入「开发」下钻（绑定 `T-001 / T-002 / T-003`、3 条会话、3 张卡片、局部 DAG 5 个节点、状态「服务中」）；下钻视图按 U-13 复用**同一条** `/instances/:id/graph/stream` 订阅，且 `createApp` 的 `ensureStreams()` 在 `view === 'drill'` 时**保持/重开**这条图流（`契约：desktop/ui/app.js::ensureStreams().drill`，D-14 表 A5——现状 `app.js:1477` 只对 `view === 'graph'` 打开，S2 把条件扩到 `graph | drill`，不新增通道、不新增帧类型）；同一实例的**第二份快照** `state-b.json` 已备好：该角色的三个节点从 `state.nodes` 中移除、`state.sessions` 里对应会话移除（`rev` 大于第一份，`state` 仍为 `running`，其它角色与节点不动）；`NODE_ENV=test`。
- **When** 夹具在两次取数之间用 `state-b.json` **替换** `.orch/instances/INST-001/state.json`（夹具动作，不主张这是产品可达的编排写入），再让**同一条图流**进入断开态（`createApp` 的 `onStatus('closed')` 分支：`app.js:1463-1472` 为列表流、`1488-1495` 为图流；`connection.disconnect()` 后 `scheduleReconnect()` 在 1 秒后调 `ensureStreams()`，见 `app.js:1444-1451`）。因为 `view === 'drill'` 也走图流分支（契约 A5），1 秒后会重开 `/instances/:id/graph/stream`；其**首帧就是 `graph.snapshot`**（`src/daemon/http/stream.js:462,518`），下钻层据此重取一份完整数据（§2.14「恢复后重新取一份完整数据」）。
- **Then** 重取完成后：状态栏状态词转「未参与」、`服务 —`、`宿主 —`、`最近 —`、活跃会话显示 `0 个活跃会话`（即 A-1 第 3 行的形态，逐字断言）；卡片列表显示「任务 无」（不再显示已退出的 3 张卡片）；局部 DAG 保留最后一次的内容（节点数不变、不清空、不塌陷、不重排）；不白屏、不报错、下钻不关闭，用户仍可点「返回流程图」。**局部更新规则（评审 F4-13，与 §2.14 的"重新取一份完整数据"并列）**：重取只替换**状态栏与卡片**；DAG **不按空节点集重建**、保留上一帧——"完整数据"指状态栏与卡片的数据来源，不是要求把 DAG 清空重画。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-50.tests.stdout.txt` | 1556 B |
| `docs/iterations/iteration-10b/evidence/AC-50.test.source.txt` | 9530 B |
| `docs/iterations/iteration-10b/evidence/AC-50.arch.stdout.txt` | 435 B |
| `docs/iterations/iteration-10b/evidence/AC-50.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-50.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-50.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-50.meta.json` | 1943 B |
| `docs/iterations/iteration-10b/evidence/AC-50.status.txt` | 2228 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/drill-live.test.js）：测试文件存在 | ✅ | `test/wp14/drill-live.test.js` |
| 2 | 机检 F-16（test/wp14/drill-live.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/drill-live.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/drill-live.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/drill-live.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：空卡片不清空面板、不短路渲染（与 AC-48 同一锚点）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | 架构：重取路径不得写盘（saveState\|appendSpan\|emit( 零命中）（expect=zero） | ✅ | `exit=1 hits=0` |
| 8 | Then 逐字：app.noteGraphStreamOpen();（期望含 "app.noteGraphStreamOpen();"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 9 | Then 逐字：assert.equal(app.state().graphStreamReopened, true);（期望含 "assert.equal(app.state().graphStreamReopened, true);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 10 | Then 逐字：assert.equal(app.state().graphStreamOpens, 2);（期望含 "assert.equal(app.state().graphStreamOpens, 2);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 11 | Then 逐字：app.handleFrame(frame('graph.snapshot', null, {（期望含 "app.handleFrame(frame('graph.snapshot', null, {"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 12 | Then 逐字：'角色栏 开发', statusWord('inactive'), '0 个活跃会话',（期望含 "'角色栏 开发', statusWord('inactive'), '0 个活跃会话',"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 13 | Then 逐字：'服务 ' + placeholder, '宿主 ' + placeholder, '最近 ' + placeholder,（期望含 "'服务 ' + placeholder, '宿主 ' + placeholder, '最近 ' + placeholder,"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 14 | Then 逐字：assert.equal(v.cards.length, 0);（期望含 "assert.equal(v.cards.length, 0);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 15 | Then 逐字：assert.equal(v.cardsEmptyText, w('DRILL_EMPTY_TASK'));（期望含 "assert.equal(v.cardsEmptyText, w('DRILL_EMPTY_TASK'));"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 16 | Then 逐字：assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag);（期望含 "assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 17 | Then 逐字：assert.equal(app.state().view, 'drill');（期望含 "assert.equal(app.state().view, 'drill');"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 18 | Then 逐字：assert.ok(tRefetch - tDrop <= 2000);（期望含 "assert.ok(tRefetch - tDrop <= 2000);"） | ✅ | `/**<br> * WP-4 assembly contract: live seam / consistency / reconnect refetch<br> * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).<br> *<br> * Live frames travel through the REAL `createApp.handleFrame`, reusing the<br> * single graph-stream seam (contract A5). No n` |
| 19 | 契约 A5：ensureStreams 条件含 graph \|\| drill（期望含 "current.view === 'graph' \|\| current.view === 'drill'"） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure modules and the window: it<br> * decides` |
| 20 | 契约 A5：仅一条 graph/stream 通道（期望含 "/graph/stream"） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure modules and the window: it<br> * decides` |
| 21 | 状态词 inactive → 未参与（期望 "未参与"） | ✅ | `"未参与"` |
| 22 | 卡片空态 DRILL_EMPTY_TASK → 任务 无（期望 "任务 无"） | ✅ | `"任务 无"` |
| 23 | Then 逐字：重取后角色行逐字等于 A-1 第 3 行形态 | ✅ | `角色栏 开发 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:985-986）：重取完成后状态栏「未参与 / 服务 — / 宿主 — / 最近 — / 0 个活跃会话」，卡片「任务 无」，局部 DAG 保留上一帧（节点数不变、不清空、不塌陷、不重排），不白屏、下钻不关闭、可返回流程图。
- 局部更新规则（评审 F4-13）：重取只替换状态栏与卡片，DAG 不按空节点集重建——"完整数据"指状态栏与卡片的数据来源，不是把 DAG 清空重画。
- 契约 A5 / graphStreamReopened（D-14 表 A5）：drill 复用同一条 /graph/stream，ensureStreams 在 view===drill（drill 视图）保持/重开；同一通道重开两次置 graphStreamReopened===true，不新开通道、不新增帧类型。
- 内部断言（非用户可见）：t_refetch - t_drop ≤ 2000（含既有 1 秒重连窗口）；替换前后 rev 与哈希各自留证。
- F5-01 竞态回改路径：S2 实证核心对活跃 run 的写盘会覆盖外部 state.json 替换，回改为「先起核再写盘且核心不驱动 / 走产品路径 + 既有接缝」；AC-50 机检以 noteGraphStreamOpen + graph.snapshot 首帧在模块面构造重取，真实断开重连时序属人工核验面。

---

#### AC-51 基线 477 连线侧的改道判定：红色 / 橙色连接线进交接包面板，不进升级面板

- 判定：**通过**（核对 18/18 通过；裁决 L 复判）
- 验证面：mock 实测
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-51`

**① 完整命令（逐条可复跑）**

```
[夹具：独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）] "(fixture) 独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[node --test test/wp14/connection-panel.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test D:\WWW\Maestro\test\wp14\connection-panel.test.js   | cwd=D:\WWW\Maestro | exit=0 | 228ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-i10b-acc10b-f\AC-51 | exit=0 | 110ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-10b/evidence/AC-51.tests.stdout.txt`；架构原始帧见 `docs/iterations/iteration-10b/evidence/AC-51.arch.stdout.txt`。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
- **Given** 实例 `INST-001` 的角色流程图上有三条连接线：「开发→测试」一条 `rejected`（红色）、「测试→协调者」一条 `expired`（橙色）、「协调者→开发」一条 `delivered`；同一实例另有 1 条 `pending` 升级（`ESC-001`）；界面已进入该实例的角色流程图；`NODE_ENV=test`。
- **When** 依次点击红色、橙色、普通（`delivered`）三条连接线。
- **Then** 三次都打开**同一个交接包面板**（左侧是这一对的交接包列表、行内直接给拒绝 / 过期原因），**任何一次都不进入升级处理面板、也不进入角色下钻**；升级面板的入口只有两个：升级节点（AC-21）与角色节点 `escalated` 角标（AC-49）；三次点击都不改变任何编排状态。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-10b/evidence/AC-51.tests.stdout.txt` | 1479 B |
| `docs/iterations/iteration-10b/evidence/AC-51.test.source.txt` | 8854 B |
| `docs/iterations/iteration-10b/evidence/AC-51.arch.stdout.txt` | 245 B |
| `docs/iterations/iteration-10b/evidence/AC-51.corestop.txt` | 27 B |
| `docs/iterations/iteration-10b/evidence/AC-51.state.json` | 260 B |
| `docs/iterations/iteration-10b/evidence/AC-51.events.jsonl` | 63 B |
| `docs/iterations/iteration-10b/evidence/AC-51.meta.json` | 1814 B |
| `docs/iterations/iteration-10b/evidence/AC-51.status.txt` | 2163 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检 F-16（test/wp14/connection-panel.test.js）：测试文件存在 | ✅ | `test/wp14/connection-panel.test.js` |
| 2 | 机检 F-16（test/wp14/connection-panel.test.js）：exit 0 | ✅ | `exit=0` |
| 3 | 机检 F-16（test/wp14/connection-panel.test.js）：# pass ≥ 1 | ✅ | `# pass=6` |
| 4 | 机检 F-16（test/wp14/connection-panel.test.js）：# fail 0 | ✅ | `# fail=0` |
| 5 | 机检 F-16（test/wp14/connection-panel.test.js）：无 not ok | ✅ | `无` |
| 6 | 架构：连接线的点击目标只有交接包面板（handoff-panel.js 无 escalation）（expect=zero） | ✅ | `exit=1 hits=0` |
| 7 | Then 逐字：assert.equal(panel.target, 'connection-panel');（期望含 "assert.equal(panel.target, 'connection-panel');"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 8 | Then 逐字：assert.ok(panel.title.includes(word));（期望含 "assert.ok(panel.title.includes(word));"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 9 | Then 逐字：assert.equal(panel.rows[0].reason, reason);（期望含 "assert.equal(panel.rows[0].reason, reason);"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 10 | Then 逐字：['rejected', '已拒绝', '下游拒绝'],（期望含 "['rejected', '已拒绝', '下游拒绝'],"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 11 | Then 逐字：['expired', '已过期', '交接已过期'],（期望含 "['expired', '已过期', '交接已过期'],"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 12 | Then 逐字：['delivered', '已投递', ''],（期望含 "['delivered', '已投递', ''],"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 13 | Then 逐字：assert.ok(!source.includes('escalation'));（期望含 "assert.ok(!source.includes('escalation'));"） | ✅ | `/**<br> * WP-3 contract tests for the connection-line handoff panel<br> * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.<br> *<br> * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js<br> */<br>import assert from 'node:assert/strict'` |
| 14 | 机检要求：三次落点断言在 app 视图层（源码含 createApp 与 view==='connection-panel'） | ✅ | `test.source 中 view 出现次数=7，createApp 出现次数=3；含 createApp 视图层 st.view==='connection-panel' 断言（connection-panel.test.js:188）` |
| 15 | 机检要求：断言 view !== 'escalation-panel' | ✅ | `test.source 中 'escalation-panel' 出现次数=2；语义等价检测（assert.notEqual(x, 'escalation-panel') 或 assert.ok(x !== 'escalation-panel')，右侧字面量为 'escalation-panel'）命中（connection-panel.test.js:189 assert.ok(st.view !== 'escalation-panel')）` |
| 16 | 机检要求：断言 view !== 'drill'（三次点击不进角色下钻） | ✅ | `语义等价检测（assert.notEqual(x, 'drill') 或 assert.ok(x !== 'drill')，右侧字面量为 'drill'）命中（connection-panel.test.js:190 assert.ok(st.view !== 'drill')）` |
| 17 | 机检要求：stateHashBefore === stateHashAfter（三次点击不改编排状态） | ✅ | `test.source 中 stateHash 出现次数=4` |
| 18 | ctl 委托含 open-connection（连接线点击进交接包面板的路由）（期望含 "action === 'open-connection'"） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure modules and the window: it<br> * decides` |

**⑤ 判定**：通过

**备注**

- Then 逐字锚点（requirement.md:996）：三次都打开同一个交接包面板（左侧交接包列表、行内给拒绝/过期原因），任何一次都不进升级面板、也不进角色下钻；升级入口只有升级节点（AC-21）与 escalated 角标（AC-49）两处；三次点击都不改编排状态。
- 需求机检（requirement.md:997）：connection-panel.test.js 断言三次 view === connection-panel、view !== escalation-panel、view !== drill，标题聚合词依次为已拒绝/已过期/已投递，红/橙两次行内含拒绝/过期原因词。
- 复验取证（2026-11-16，两处实现修复后）：产品侧已逐字具备判定要求 2 的全部断言——`connection-panel.test.js:143-202` 新增 view 级三点击用例，逐字断言 `st.view === 'connection-panel'`（:188）、`st.view !== 'escalation-panel'`（:189）、`st.view !== 'drill'`（:190）各一次（红/橙/delivered 三次循环内各执行一遍），并断言 `stateHashBefore === stateHashAfter`（:200）与 `appSource.includes("action === 'open-connection'")`（:167）；`app.js:1949` 已有 `action === 'open-connection'` → `app.openConnectionPanel(arg)` 委托。故 Then 的落点、三态排除、不改状态、路由四项均已由机检源码承载并通过 F-16（6/6）。
- 裁决 L 复判依据（2026-11-16，取代下方历史「不通过依据」）：按 `decisions.md` 裁决 L，机检要求的是断言语义而非 `node:assert` API 字面拼写。验收用例 `probe/acc10b-cases/ac51.mjs` 该项代理已由 `src.includes("assert.notEqual") && src.includes("'escalation-panel'")` 改为 `assertsViewNot()` 语义等价检测：接受 `assert.notEqual(x, 'LIT')` 或 `assert.ok(x !== 'LIT')`，并要求断言右侧字面量确为 `'escalation-panel'` / `'drill'`（核完整断言结构、不恒真、不删项）。复跑 `node probe/acc10b-f-run.mjs AC-51` 得 18/18，第 15 项命中 :189 `assert.ok(st.view !== 'escalation-panel')`、第 16 项命中 :190 `assert.ok(st.view !== 'drill')`。旧 8 帧归档 `evidence/_archive_AC-51_pre-L-reverify_20261116T225104Z/`。未放宽任何 Then、未改产品代码 / `test/**` / 需求 / 拆分。
- 历史「不通过依据」（已被裁决 L 复判取代，留痕）：原 17/18 时验收用例 `ac51.mjs:30-32` 以 `src.includes("assert.notEqual") && src.includes("'escalation-panel'")` 作检测代理，产品用语义等价 `assert.ok(st.view !== 'escalation-panel')`（:189），`'escalation-panel'` 出现 2 次但无 `assert.notEqual` 字面，故该项曾 ❌；该字面过严已由裁决 L 修正，不再是未成立项。
- 架构检查：handoff-panel.js 零 escalation（交接包面板不复制升级跳转分支）成立。

---

## 3. 不通过 / 阻塞项原始帧摘要

**当前无未成立 / 阻塞项。** AC-51 的历史 17/18 不通过项已按裁决 L 修正验收机检代理后复判为通过 18/18；下表为历史留痕，其判定已被 §5 裁决 L 结论取代。

| AC | 历史判定 | 历史未成立 / 阻塞核对项（含原始值） | 处置 |
|---|---|---|---|
| AC-51 | 不通过（17/18，已被裁决 L 取代） | 机检要求：断言 view !== 'escalation-panel'：`test.source 中 'escalation-panel' 出现次数=2`（产品用语义等价 `assert.ok(st.view !== 'escalation-panel')`，无 `assert.notEqual` 字面） | 系验收机检 API 字面代理过严；产品已逐字具备 view 三态 + stateHash + open-connection 路由断言，Then 满足。按裁决 L 把代理改为语义等价检测后复跑 18/18 通过。历史原始帧留痕 `evidence/_archive_AC-46_AC-51_pre-reverify_20261116T180507Z/` 与 `evidence/_archive_AC-51_pre-L-reverify_20261116T225104Z/`；当前帧 `evidence/AC-51.test.source.txt`、`evidence/AC-51.tests.stdout.txt`。 |

## 4. 证据索引

共 48 个本批文件；每条 AC 至少 state / events / tests.stdout / test.source / arch.stdout / corestop / meta / status 原始帧，无空文件。

| AC | 文件数 | 证据文件 |
|---|---|---|
| AC-46 | 8 | `evidence/AC-46.arch.stdout.txt`<br>`evidence/AC-46.corestop.txt`<br>`evidence/AC-46.events.jsonl`<br>`evidence/AC-46.meta.json`<br>`evidence/AC-46.state.json`<br>`evidence/AC-46.status.txt`<br>`evidence/AC-46.test.source.txt`<br>`evidence/AC-46.tests.stdout.txt` |
| AC-47 | 8 | `evidence/AC-47.arch.stdout.txt`<br>`evidence/AC-47.corestop.txt`<br>`evidence/AC-47.events.jsonl`<br>`evidence/AC-47.meta.json`<br>`evidence/AC-47.state.json`<br>`evidence/AC-47.status.txt`<br>`evidence/AC-47.test.source.txt`<br>`evidence/AC-47.tests.stdout.txt` |
| AC-48 | 8 | `evidence/AC-48.arch.stdout.txt`<br>`evidence/AC-48.corestop.txt`<br>`evidence/AC-48.events.jsonl`<br>`evidence/AC-48.meta.json`<br>`evidence/AC-48.state.json`<br>`evidence/AC-48.status.txt`<br>`evidence/AC-48.test.source.txt`<br>`evidence/AC-48.tests.stdout.txt` |
| AC-49 | 8 | `evidence/AC-49.arch.stdout.txt`<br>`evidence/AC-49.corestop.txt`<br>`evidence/AC-49.events.jsonl`<br>`evidence/AC-49.meta.json`<br>`evidence/AC-49.state.json`<br>`evidence/AC-49.status.txt`<br>`evidence/AC-49.test.source.txt`<br>`evidence/AC-49.tests.stdout.txt` |
| AC-50 | 8 | `evidence/AC-50.arch.stdout.txt`<br>`evidence/AC-50.corestop.txt`<br>`evidence/AC-50.events.jsonl`<br>`evidence/AC-50.meta.json`<br>`evidence/AC-50.state.json`<br>`evidence/AC-50.status.txt`<br>`evidence/AC-50.test.source.txt`<br>`evidence/AC-50.tests.stdout.txt` |
| AC-51 | 8 | `evidence/AC-51.arch.stdout.txt`<br>`evidence/AC-51.corestop.txt`<br>`evidence/AC-51.events.jsonl`<br>`evidence/AC-51.meta.json`<br>`evidence/AC-51.state.json`<br>`evidence/AC-51.status.txt`<br>`evidence/AC-51.test.source.txt`<br>`evidence/AC-51.tests.stdout.txt` |

## 5. AC 复验结论（2026-11-16，原「主控应独立复跑建议」已执行）

> 两处实现修复后由验收 Agent 独立复跑（`node probe/acc10b-f-run.mjs AC-46 AC-51`），旧帧留痕 `evidence/_archive_AC-46_AC-51_pre-reverify_20261116T180507Z/`；随后按裁决 L 仅修验收用例代理并对 AC-51 单独复跑（`node probe/acc10b-f-run.mjs AC-51`），旧帧留痕 `evidence/_archive_AC-51_pre-L-reverify_20261116T225104Z/`。结论如下。

| AC | 复验结论 | 关键逐字证据 |
|---|---|---|
| AC-51 | **通过 18/18**（裁决 L 复判；历史 13/18 → 17/18 → 18/18）。产品已逐字具备判定要求 2 全部断言：`view==='connection-panel'`/`view!=='escalation-panel'`/`view!=='drill'` 三次、`stateHashBefore===stateHashAfter`、`open-connection` 路由均成立（F-16 6/6）。历史 17/18 的唯一未成立项系验收机检用 `assert.notEqual` 字面代理，产品用语义等价 `assert.ok(st.view !== 'escalation-panel')`；按裁决 L 把代理改为语义等价检测（接受 `assert.notEqual(x, 'LIT')` / `assert.ok(x !== 'LIT')`，要求右侧字面量确为 `'escalation-panel'` / `'drill'`，不恒真、不删项）后复跑 18/18。未放宽任何 Then、未改产品/测试/需求。 | `connection-panel.test.js:188-190` 三态断言、`:200` stateHash、`:167` + `app.js:1949` open-connection 路由；`evidence/AC-51.test.source.txt`；代理改动 `probe/acc10b-cases/ac51.mjs`。 |
| AC-46 | **通过 17/17**（维持）。`host-jump.js` 对 `code:'DSH_SPAWN_FAILED'` 按 `DRILL_HOST_FAILED` 模板前缀区分：`message:'未找到 DeepSeek Harness'` → DRILL_HOST_MISSING、`message:'跳转失败 · <原因>'` → DRILL_HOST_FAILED；`host-jump.test.js` 新增真实形状用例（`code:'DSH_SPAWN_FAILED'` + `message:'跳转失败 · 权限被拒'` → toast 逐字 `跳转失败 · 权限被拒`、`button.enabled===true`、`jumpCalls===0`），AC-26 三降级未退化。原「host-jump.js 把该 code 一律映射为 DRILL_HOST_MISSING」的风险已消除。 | `desktop/ui/drill/host-jump.js:73-97`、`src/adapter/host-open.js:60-63`、`test/wp14/host-jump.test.js:293-328`；`evidence/AC-46.test.source.txt`。 |
