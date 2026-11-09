# I1.4 / WP-8 遗留产品修复登记（含 B-01 补修）

> 纪律：本轮（WP-8 第二批）**不改 `src/**`**，不 git add/commit，不动 §7.2 的 9 条白名单用例，不改 requirement.md(v26) / iteration-4.md / package.json / src/cli/labels.js。
> 下面 3 处是**上一轮中断前已写入工作区**的既有产品修复（`git status` 里 `src/**` 为 M），正好是 WP-8 允许的上限（**≤3 处**）。本轮只核对、登记、给出保留结论；**本轮新增 src 改动：0 处**。
> 若本轮发现新的产品缺陷，只写入本文件交主线裁决，不动手。
> 本轮 70 条 AC 全部通过（通过 70 / 不通过 0 / 阻塞 0 / 未执行 0），**未发现新的产品缺陷**。
> **B-01 补修轮（本文件本次更新）**：③ 经评审判 FAIL，本轮在**同一处**（`src/core/orchestrator.js` 的 ③ 区域）按 D-7.4 第 1 步补齐三重门控 + 防重，新增竞态单测并重跑受影响 AC；补修仍属**同一处**修复，`src/**` 仍只有 3 处改动、**无第 4 处**；70 条 AC 结论与证据路径表不变。不 git add/commit，不改 §7.2 的 9 条白名单用例、requirement.md(v26) / iteration-4.md / package.json / 既有 wp11 测试 / probe/acc4-cases/*。
> 口径：每处写「文件:行号 + 对应 AC + 原因 + 修复前后证据 + 是否保留」。修复前证据固化在 `probe/acc4-f-parts/BLK-before.json`（上一轮 `/tmp/acc4-probe-e*.json` 原始日志易失），修复后证据在 `docs/iterations/iteration-4/evidence/`。

---

## BLK-01 ｜ `src/cli/main.js:953` ｜ AC-29③ ｜ `INSTANCE_NOT_SUSPENDED` 文案 `{id}` 应传实例号

- **文件:行号**：`src/cli/main.js:953`（`escalate resolve` 的 `if (!res.ok)` 分支内 `commandError(out, res.code, { id: ... })`）。
- **对应 AC**：AC-29 ③「实例 INST-002 当前不是挂起状态，不能处理升级」（需求 `requirement.md:665` Then③；A-5 文案基线 `src/cli/labels.js` 的 `INSTANCE_NOT_SUSPENDED: '实例 {id} 当前不是挂起状态，不能处理升级'`）。
- **原因**：`escalate resolve` 的命令级错误统一用 `{ id: escalationId }` 渲染。当 RPC 返回 `INSTANCE_NOT_SUSPENDED`（实例不是挂起）时，`{id}` 被填成**升级号** ESC-001，输出 `实例 ESC-001 当前不是挂起状态，不能处理升级`；文案要求的是**实例号** INST-002。其余错误码（`ESCALATION_NOT_FOUND` / `ESCALATION_AMBIGUOUS` 等）确实应传升级号，不能一律改成实例号。
- **修复**：按错误码分流 —— `id: res.code === 'INSTANCE_NOT_SUSPENDED' ? instanceId : escalationId`，其余参数（`decision`、`res.params`）照旧。
- **修复前证据**：`probe/acc4-f-parts/BLK-before.json` → `AC-29(3)_修复前_按旧参数口径重建`：只读调用 `render.renderCommandError('INSTANCE_NOT_SUSPENDED', { id: 'ESC-001' })` 得 `实例 ESC-001 当前不是挂起状态，不能处理升级`（旧参数）；改为 `{ id: 'INST-002' }` 得 `实例 INST-002 当前不是挂起状态，不能处理升级`。上一轮该子场景的原始 stdout 未留存，`/tmp/acc4-discovery7.json` 的 `AC29_proper.nonSuspended` 只拿到 `未找到升级 ESC-001`（当时子场景③前置未构造成功），故以「labels.js 逐字模板 + 修复前代码路径 + 只读重建」为可复核证据，如实标注。
- **修复后证据**：`docs/iterations/iteration-4/evidence/AC-29.status.txt` 子场景③逐字输出 `实例 INST-002 当前不是挂起状态，不能处理升级`；`AC-29.output.json` 同帧；`probe/acc4-cases/ac29.mjs` 断言 `c.includes(..., '实例 INST-002 当前不是挂起状态，不能处理升级')`，AC-29 **10/10 通过**。
- **是否保留**：**保留**。理由：直接对应 AC-29③ 的逐字基线；只在该错误码分支改 `id`，其余错误仍传升级号，AC-29①② 与 AC-27 / AC-28（决策拒绝文案）均通过，无回归；不触碰 `src/cli/labels.js`。

---

## BLK-02 ｜ `src/core/orchestrator.js:1606` ｜ AC-65 ｜ 会话创建失败时把已落 `created` 的孤儿包并入升级的同一次 CAS 置 `rejected`

- **文件:行号**：`src/core/orchestrator.js:1606`（`dispatchInState` 内 `createAdapter` 失败 catch → `escalateState(...)` 调用处）。
- **对应 AC**：AC-65「下游会话创建失败不留未投递包」（`requirement.md:953-954`）：本轮复测包 `state === 'rejected'`、`rejectReason === 'delivery_failed'`、`handoffs` 中没有该节点本轮的 `created` 包、`escalations[0].reasonCode === 'dispatch_failed'`、没有 `handoff.pending`；BR-13 / BR-29。
- **原因**：派发前交接包已以 `created` 落盘；`dispatch-fail-retest` 夹具让复测节点 `sessionNew` 失败时，旧实现只 `escalateState(...)` 生成 `dispatch_failed` 升级，没有把这张 `created` 包收尾，于是 `handoffs` 里留下 **`state: 'created'` 的孤儿包**（`rejectReason: null`、`deliveryAttempts: 0`），且没有 `handoff.rejected` 事件。
- **修复**：catch 内先取 `const pendingHandoff = (state.handoffs ?? []).find(item => item?.handoffId === handoffId) ?? null;`，再给 `escalateState` 追加 `pendingHandoff: { ...pendingHandoff, rejectReason: 'delivery_failed' }`，让**升级的同一次 CAS** 把该包一并置 `rejected`（不额外多一次快照写，符合「坏包拒绝 + 升级同一次 CAS」的 D-3 口径）。
- **修复前证据**：`probe/acc4-f-parts/BLK-before.json` → `AC-65_修复前.实测`（原始 `/tmp/acc4-probe-e.json#ac65` 与 `/tmp/acc4-probe-e2.json#ac65`）：`runExit=4`、`state=suspended`、`handoffs` 末张 `{"id":"HO-003","state":"created","reason":null,"to":"T-002","kind":"retest","attempts":0}`，`esc=[{"code":"dispatch_failed","state":"pending"}]`，`reasons` 末尾 `...escalation.created,state.change,state.change,core.suspend`（**无 `handoff.rejected`**）。
- **修复后证据**：`docs/iterations/iteration-4/evidence/AC-65.state.json` → `HO-003 state=rejected, rejectReason=delivery_failed, deliveryAttempts=0`，`handoffs` 中无 `created`；`AC-65.events.jsonl` 含 `handoff.rejected`、无 `handoff.pending`；`AC-65.status.txt` 含 `已拒绝（投递失败）`；`probe/acc4-cases/ac65.mjs` **8/8 通过**。
- **是否保留**：**保留**。理由：AC-65 / BR-13、BR-29 明确要求；并入同一次 CAS，不引入额外写；AC-19（首派会话创建失败、无预置包场景）仍 **7/7 通过**，`pendingHandoff` 为 `null` 时该扩展参数不生效，未回归。

---

## BLK-03 ｜ `src/core/orchestrator.js:4400-4489` ｜ AC-66 ｜ 恢复时复用暂停前已构造的 `created` 包（B-01 补修后）

- **文件:行号**：`src/core/orchestrator.js:4400-4489`（`resume` 拉起的后台 drive 的 `(async () => { ... })()` 内）。本轮 B-01 补修**仍在这一处**，**不是第 4 处 `src/**` 改动**。
- **对应 AC**：AC-66「暂停落在交接包已构造、尚未派发之间」（`requirement.md:961-962`）：暂停期间该包显示「已构造」；恢复后核心用**同一张包**派发一次，不产生第二张包，也不重复计数；机检要求 `deliveryAttempts === 1`、`dispatchCount` 恰好 +1、指向该节点的包仍只有 1 张、`node.dispatch` 新增恰好 1 条；BR-14 / BR-24 / BR-25。
- **原因**：`MAESTRO_TEST_PAUSE=after_verdict` 让回流包已落盘（`created`、`defects=2`）、派发尚未提交时暂停。旧实现的后台 drive 重新走规划，构造了**第二张** `created` 包（无 `defects`），被 `handoff-schema` 以 `invalid_payload`（「回流缺少defects」）拒绝，原 `created` 包仍挂着，实例反而挂起，`dispatchCount` 未 +1。
- **修复（③ 引入时，补修前形态）**：后台 drive 启动后先 `[...(state.handoffs ?? [])].reverse().find(item => item?.state === 'created' && item?.edge)`，命中则直接以该 `pending.handoffId` + `retryPromptText(state, { nodeId }, graphForState(state))` 调 `dispatchInState`，复用同一张包，不再重新规划。评审判此形态 **FAIL**：查找条件仅 `state === 'created' && item.edge` + `reverse()` 取最新，缺 D-7.4 第 1 步（`requirement.md:1631`）三重门控；`nodeId` 由选中包反推、无 `node.round >= targetRound → stop` 防重；用暂停前内存副本复用，竞态下（派发已提交而包残留 `created`）会误复用 / 重复派发 / 重复计数。
- **B-01 补修（本轮，同一处；方案 1 最小改动）**：保留 resume 旁路，③ 补齐门控，未改 §4.9 的 WP-4 独占区（`advanceLocked` / `dispatchInState` / `planAdvance` / `advance.js` 零改动）：
  1. 目标节点与 `targetRound` 由 `planAdvance(fresh)` 独立确定（口径 `targetRound = 目标节点当前 round + 1`，见 `advance.js:483/569` 与 `iteration-4.md` §2.10），**不再由选中包反推 `nodeId`**；
  2. 查找 `created` 包加三重门控：`item.toNodeId === targetNodeId`、`item.round === targetRound`、`该轮无已开始会话`（`state.sessions` 中 `nodeId + round` 命中即不复用，旧轮次会话不算）；
  3. 加 D-7.4 第 1 步防重 stop：`isNodeBusyState(targetNode)` 或 `node.round >= 构造时 targetRound`（即 `handoff.round`）命中即 `stop`，不构造第二张包、不回退 `advance()` 重新规划，保证「一包一派发」、`dispatchCount` 不重复增加；
  4. 复用前 `store.load` 重读盘上最新 `fresh` 快照（不用暂停前内存副本 `state`），`dispatchInState(fresh, ...)` 的 `expectedForDispatch` 取盘上 `rev` —— AC-53 的 rev 语义不变。
- **修复前证据（③ 引入前）**：`probe/acc4-f-parts/BLK-before.json` → `AC-66_修复前`（原始 `/tmp/acc4-probe-e2.json#ac66_pause` 与 `#ac66_resume`）：暂停时 `HO-002 state=created, defects=2`；恢复后 `HO-002` 仍 `created`，新增 `HO-003 state=rejected, reason=invalid_payload, defects=0`，`esc=[{"code":"handoff_invalid","detail":"交接包 HO-003 内容不合规：回流缺少defects"}]`，`reasons` 含 `workflow.paused, workflow.resumed, handoff.rejected, escalation.created`，`dispatch=2`、`dispatchEvents=2`（恢复未产生派发）。
- **补修前证据（本轮 B-01）**：`probe/acc4-f-parts/BLK-03-B01-evidence.json` → `before`：补修前 ③ 代码形态、主线 AC-66 实测 `state.json` 摘要、竞态单测实跑 `tests 5 / pass 1 / fail 4`（临时换回补修前 `orchestrator.js` 实跑，随后逐字恢复）。
- **修复后证据（主线 ③ 引入时实测）**：`docs/iterations/iteration-4/evidence/AC-66.state.json` → 仅 2 张包（`HO-001 consumed`、`HO-002 accepted`，**无第二张**），`deliveryAttempts=1`，`dispatchCount=3`（暂停时 2 → +1），`escalations=[]`；`AC-66.events.jsonl` 含 `workflow.resumed, node.dispatch, handoff.inboxed, handoff.delivered`，**无 `handoff.rejected`**、无第二张 `handoff.created`；`probe/acc4-cases/ac66.mjs` **16/16 通过**。本轮重跑 AC-66 后该结论不变。
- **补修后证据（本轮 B-01）**：`probe/acc4-f-parts/BLK-03-B01-evidence.json` → `after`；竞态单测 `test/wp11/resume-reuse-guard.test.js`（5 用例：竞态主场景「派发已提交但包仍残留 `created`」+ 三重门控 3 个负例 + 门控全通过正例）实测 **tests 5 / pass 5 / fail 0**；受影响的 AC-53 / AC-61 / AC-65 / AC-66 重跑与 `node probe/acc4-f-final.mjs` 结果见本文件汇总及 `docs/iterations/iteration-4/report.md`。
- **是否保留**：**保留（补修后）**。理由：AC-66 / BR-14、BR-24、BR-25 明确要求；③ **已按 D-7.4 第 1 步补齐三重门控 + 防重，并有竞态用例锁定**；补修仍属**同一处**修复，不是第 4 处 `src/**` 改动；AC-49 / AC-50 / AC-51 的正常暂停恢复路径仍分别 **17/17、11/11、18/18 通过**，未回归。**不宜写成「已完全符合 D-7.4」**：复用仍走 resume 旁路直调 `dispatchInState`，未改为 `advance()` / `planAdvance` 的 `reuseHandoffId` 统一路径（方案 1 的取舍，残留风险交主线裁决）。

---

## 汇总

| 编号 | 文件:行号 | AC | 是否保留 | 修复后实测 |
|---|---|---|---|---|
| BLK-01 | `src/cli/main.js:953` | AC-29③ | 保留 | 10/10 |
| BLK-02 | `src/core/orchestrator.js:1606` | AC-65 | 保留 | 8/8 |
| BLK-03 | `src/core/orchestrator.js:4400-4489` | AC-66 | 保留（B-01 补修） | 16/16（补修后重跑） |

- 3 处均**建议保留**，无「建议回退」项；若主线对「修复前证据未留存原始 stdout」有疑义，BLK-01 可复跑 `node probe/acc4-f-run.mjs AC-29` 复核修复后输出，修复前口径见 `BLK-before.json`。
- 本轮 70 条 AC 全绿，无阻塞、无新增产品缺陷；`src/**` 仍只有 3 处改动，本轮**未新增第 4 处**（③ 为同一处补修，非新增改动点）。
- **B-01 补修**：③ 已按 D-7.4 第 1 步补齐三重门控 + 防重并有竞态用例锁定，补修**仍属同一处**（`src/core/orchestrator.js:4400-4489`）、**无第 4 处 `src/**` 改动**；补修前后证据路径见 `probe/acc4-f-parts/BLK-03-B01-evidence.json`，竞态单测文件 `test/wp11/resume-reuse-guard.test.js`。`src/**` 仍只有 3 处改动。

---

## 收口期测试健壮性加固（NFR-06：白名单外新增失败 = 0）

> 纪律：本节只登记**测试等待方式**的加固。`src/**` 本轮新增改动 **0 处**（BLK-01~03 三处既有修复原样保留）；不碰 §7.2 的 9 条白名单用例；不动 `requirement.md`(v26) / `iteration-4.md` / `package.json` / `probe/acc4-cases/*` / 其它 `test/wp11/*.test.js`；零新增依赖；不 git add/commit。本轮只改 3 个测试文件 + 本文件 + `docs/iterations/iteration-4/report.md` 共 5 个文件。

- **背景**：主线最终全量 `node --test "test/**/*.test.js"` = 641 用例 / 628 pass / 12 fail / 1 skip / 316s。12 fail 中 9 条是 §7.2 白名单（NFR-06 v26 豁免），另 **3 条是白名单外新增失败**；三者单跑各自所属文件全绿（`escalation-resolve.test.js` 6/6、`resume-reuse-guard.test.js` 5/5、`acp-client.test.js` 8/8），确认为**全量并发负载下的时序假红，不是产品回归**。根因都是「靠固定 sleep / 实现内部计数 / 过短上限判完成」，负载下后台 drive、标记文件、`tool_call` 帧尚未就绪就执行断言。
- **统一原则**：等**可观测终态**，不靠固定 sleep、不靠后台 drive 内部计数；等待带明确上限与清晰失败信息；超时由原断言兜底失败，不 try/catch 吞掉、不跳过、不删断言。

### 逐条登记（3 个文件）

| # | 文件:行号 | 对应 AC | 改了什么 | 新的等待条件与上限 |
|---|---|---|---|---|
| 1 | `test/wp11/resume-reuse-guard.test.js:208`（正例） | AC-66 / AC-53（复用门控与 rev） | harness 新增可复用 `h.waitForDispatch(expected)`；正例把 `await h.settle()` 换成 `await h.waitForDispatch(before.counters.dispatchCount + 1)` | 轮询 `disk().counters.dispatchCount >= expected` 且 `events` 出现 `node.dispatch`（复用文件既有 `dispatchEvents` helper）；上限 **15000ms**；超时抛「派发终态未到达：期望…上限…最后观测…」 |
| 2 | `test/wp11/escalation-resolve.test.js:269` | AC-49（paused 收尾） | `waitFile(marker, 8000)` → `waitFile(marker, 30000)`；`waitForRun({ timeoutMs: 8000 })` → `timeoutMs: 30000` | `waitFile` 本身即 20ms 轮询，仅把上限放宽到 **30000ms** 覆盖全量负载（主线该例负载下 duration 20717ms）；`waitForRun` 的 `timeoutMs` 是 `Promise.race` 超时哨兵，超时返回 `WAIT_TIMEOUT` 会令 `assert.equal(waited.ok, true)` 假红，同源放宽到 **30000ms** |
| 3 | `test/wp3/acp-client.test.js:203`（I1.1 既有文件） | 无独占 AC（I1.1 既有回归用例，负载健壮性加固） | 仅第 212 行 `await new Promise(r => setTimeout(r, 200))` 换成轮询等待 | 轮询 `updates` 出现 `tool_call` 帧，间隔 25ms，上限 **5000ms**；超时后仍由原 `assert.ok(...)` 兜底失败 |

### 为什么不算弱化断言（期望值前后逐条对比）

- 文件 1 正例 5 条断言逐字保留：`dispatchCount === before.counters.dispatchCount + 1`（**仍是恰好 +1，未放宽为 ok / >=**）、`dispatchEvents(events) === 1`、`handoffs.length === before.handoffs.length`、`handoffId === 'HO-001'`、`N2.round === 1`。等待条件里的 `>= expected` 只用于判断**何时停止等待**；一旦产品多派发，等待立即返回而 `=== before+1` 断言仍如实判红。
- `h.settle()` **本体未改**：它被竞态主场景 + 3 个负例共用，负例断言 `dispatchCount 不增加 / dispatchEvents === 0`，若把 `settle` 改成「等 dispatchCount+1」会让负例永远超时。故只在 harness **新增** `h.waitForDispatch` 供正例使用，负例与 `h.settle()` 一字未动。
- 文件 2：`assert.equal(await waitFile(marker, ...), true, '应在派发边界停住')` 期望值仍是 **`true`**（标记没出现依旧判红，未改成「没出现也算通过」），只把等待上限 8000 → 30000；`waited.ok === true` / `snapshot.paused === true` / `snapshot.state === 'running'` / `node.dispatch` 事件数 `=== 1` / `dispatchCount === 1` / `sessions.length === 1` 全部不变。放宽 `timeoutMs` 是等待参数，不是断言。
- 文件 3：`assert.ok(updates.some(u => u.update?.sessionUpdate === 'tool_call'))` 逐字保留；`cancelled.ok === true`、`prompted.ok === true`、`prompted.result.stopReason === 'cancelled'` 全部不变。没有 `equal`→`ok`、没有放宽期望值、没有把失败分支改成跳过、没有 try/catch 吞超时。

### 留痕（I1.1 既有文件 `test/wp3/acp-client.test.js`）

- 该文件是 tracked，`git diff -- test/wp3/acp-client.test.js` 只有**一个 hunk**：删固定 `setTimeout(200)`、增 4 行轮询；`imports` / `LIMITS` / 其余 7 个用例 / 全部断言（含 213 行 `assert.ok(...)`）一字未动。
- 改动登记同步落在本文件与 `report.md` §4.3，两处逐字一致，便于复核。

### 验证结果（本轮实测）

- 单跑（fail 0）：`resume-reuse-guard.test.js` 5/5、`escalation-resolve.test.js` 6/6、`acp-client.test.js` 8/8。
- 并发压力（`/tmp/maestro-hardening/load-run.mjs`，**3 轮**，每轮 11 个并发 node 进程 = 3 个目标测试 + 8 个持续 24s 的 CPU/IO busy worker）：第 1/2/3 轮三个目标分别 5/5、6/6、8/8，**每轮 3 目标全绿，合计 3 轮全绿**。
- 定向 AC：`node probe/acc4-f-run.mjs AC-49 AC-53 AC-61 AC-66` → AC-49 17/17、AC-53 7/7、AC-61 11/11、AC-66 16/16，`[run] 完成：通过 4 / 不通过 0 / 阻塞 0`。
- `node probe/acc4-f-final.mjs`（不带 `--emit-docs`，不覆盖手写章节）→ `[final] 70 条：通过 70 / 不通过 0 / 阻塞 0 / 未执行 0`。
- `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid ...` → `exit 0`，扫描 21 文件零命中。
- 改动范围：`git diff -- src/` 哈希前后相等（`src/**` 零改动）；与改动前基线对比 `git diff --name-only` 仅新增 `test/wp3/acp-client.test.js` 一行（另 4 个允许文件为 untracked，不进 diff）；文件内容哈希快照（1112 个文件）仅 5 个允许文件变化。

### 结论与残余风险

- 3 条白名单外新增失败的假红根因已消除；断言语义/强度零改动，NFR-06「白名单外新增失败 = 0」在模拟并发负载下成立。**本轮未跑全量回归**（约 5 分钟，留主线最后独占跑）。
- 上限余量：30s / 15s / 5s 相对主线实测负载（该例 20717ms）留有约 9s 以上余量；`h.settle()` 仍由负例使用，但负例语义为「不派发」、全量下从未假红，不在本轮 3 条范围。
- **需主线裁决**：若主线最后独占全量回归仍出现这 3 条中任一红，先按清晰失败信息分辨「等待超时」还是「真断言失败」；若是超时且负载超出模拟强度，只可再放宽等待上限（绝不改断言、不把红并入白名单）。方案同 `report.md` §4.3。
