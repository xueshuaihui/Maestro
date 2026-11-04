# I1.1 实现评审（第 2 轮）

> 评审人：独立评审员 ｜ 基准：`requirement.md` **v5（唯一验收依据）** ｜ 对照：`review-round1.md`、`iteration-1.md`、`dsh-probe.md`
> 评审快照：2026-11-04 22:44（本地）｜ 工作区：`D:/WWW/Maestro`（Node v22.22.2 / Windows）
> 本轮所有结论均为**实跑**：全量测试、真核心双进程、手工改盘、CLI 三 policy 端到端。文中 `文件:行` 与命令输出一一对应。

## 0. 总判

**仍需修复（阻断 2）**

- 上一轮 7 个阻断项：**6 项确认修复，1 项（B-6）核心侧已修但 CLI 渲染引入新缺陷**。
- 新发现阻断 2 项：
  - **C-1（阻断）**：`SESSION_INVALID` 在 `orch run/status` 被渲染成 `未知错误：unknown session`（`src/cli/render.js:220-238` 无该分支），**AC-20 必挂**。
  - **C-2（阻断）**：会话处于 `tool_running` 时行内**不含“已运行 Ns”**（`src/cli/render.js:147-152`），`orch status` 连续两次采样完全一致，**AC-03 必挂**（见 §4 实测）。
- 建议级问题 5 项（§2），上一轮建议项 12 条中已修 4 条、未修 7 条、建议不修/需澄清 1 条（§3）。
- 回归：`node --test "test/**/*.test.js"` → **197 pass / 0 fail**；`npm test` 仍不可用（同上一轮的 `MODULE_NOT_FOUND`）。

**复核方式**

| 用途 | 方式 |
|---|---|
| 全量契约测试 | `node --test "test/**/*.test.js"` → 197/197 |
| 双核心竞态（B-2） | `probe/tmp-r2-core.mjs`：真 `bin/orch.js core serve` 起 A → `run.start`（`--hold-session` 冻结写盘）→ 同项目起 B → 比对 `state.json` 字节与 `events.jsonl` |
| CAS 冲突（B-3） | `probe/tmp-r2-core.mjs`：A 跑到 `tool_running` → 手工把 `state.json` 改 `interrupted` → 等 `run.wait` → 查盘与 `rejected` 事件 |
| 五条失败路径（B-4/B-6/B-7） | 同脚本进程内真 store/bus/orchestrator + mock：`--host-error` / `--unknown-error` / 核对失败 / `--permission=deny` / `--session-missing` / policy=reject |
| CLI 端到端（4 命令 / 三 policy / 退出码 / 文案） | `probe/tmp-r2-cli.mjs`、`probe/tmp-r2-cli2.mjs`、`probe/tmp-r2-cli3.mjs` |
| 夹具探针 | 直接跑 `test/fixtures/probe-adapter.mjs` 的 `session-state` / `tool-name` / `handoff` 三种 observe |

> 临时脚本（均在 `probe/`，前缀 `tmp-r2-`）：`tmp-r2-core.mjs`、`tmp-r2-cli.mjs`、`tmp-r2-cli2.mjs`、`tmp-r2-cli3.mjs`。`os.tmpdir()` 下 `r2-*` 目录已全部清理，未触碰 `docs/iterations/iteration-1/evidence/`（评审期间由其他 Agent 生成）。

---

## 1. 七项修复复审表

| ID | 结论 | 证据 | 新问题 |
|---|---|---|---|
| **B-1** | **已修** | ① 产生路径：`src/adapter/acp-client.js:130-179` 把宿主请求交给 `onPermission`，`src/core/orchestrator.js:564-566` 订阅后在应答前落 `session → waiting_input`（`orchestrator.js:621-668`）；② 三策略闭环：allow→`waiting_input→thinking`、reject→`waiting_input→idle`、hold→不应答等外部决定（`:670-681`、`:684-713`）；③ BR-03：hold 中途 `orch status` 实测 `节点 执行中` + `会话 等待审批：write`，磁盘 `node.state=running`；④ hold + `orch cancel` 实测：向挂起的 permission 回 `cancelled`（`:1210-1218`），终态 `会话 空闲 / 节点 已取消 / 交接包 已拒绝（已撤回）`，`orch cancel` exit 0 | 无 |
| **B-2** | **已修** | `src/daemon/server.js:229-262`：`listenOnce()` 成功后才 `reconcileOnBoot()`；`EADDRINUSE` 且 `probeAlive()` 为真时在 `:240-241` 直接返回 `CORE_ALREADY_RUNNING`，不落任何状态。实测（真双进程）：B exit=0；`state.json` 前后 sha256 均为 `7b426730936e…`，**字节级一致**；`events.jsonl` 无新增行；无 `core.gone` 事件 | 唯一副作用是 B 在 `.orch/core.log` 追加一行 `SERVE_ENTRY_START`（`serve-entry.js:49`），属诊断日志，不影响状态 |
| **B-3** | **已修（附边角）** | `transit()` 每次 `store.load` 以磁盘为 `from` 重新校验（`orchestrator.js:205-282`），`save` 带 `expectedState` 做 CAS（`instance-store.js:126-159`）。实测（静默窗口后改盘）：`run.wait` 返回 `state=interrupted`，最终磁盘 `instance=interrupted`（**不是 completed**），事件 `{"object":"instance","from":"interrupted","to":"completed","result":"rejected","reason":"illegal_transition"}`；3 次重试只在真冲突时使用，单写者下不会把合法迁移无限拒绝 | **边角**：不等待静默、在某个 `save` 的“读盘→rename”窗口内手工改盘，**第一次实测被在飞快照覆盖**（最终又被写成 `completed`、无 `rejected`）。这是 `store.save` 的跨进程 TOCTOU（读检查与 rename 非原子），不属“核心内部两写者”，但会让人工篡改偶尔失效 |
| **B-4** | **已修** | 全部失败分支收敛到 `idle` 的调用点：`finishPromptError`→`quiesceSession`（`orchestrator.js:1007`）、核对失败（`:955`）、completed 迁移被拒（`:921`）、`failRunUnexpected`（`:1051`）、`cancel`（`:1248`）。实测六条路径终态均为 `session=idle`：host-error、unknown-error、verify-failed、permission-deny、session-missing、policy-reject。未发现停在 `thinking` 的失败终态 | 无（preflight 失败时 `session=null`，本就没有会话行） |
| **B-5** | **已修（附注）** | ① `mock-acp-agent.js:235-241`：`--hold-session` 现在真的挂住 prompt（不发帧、直到 cancel）；② `probe-adapter.mjs:179-199` 输出 `normalizer.getSession(...)` 的真实观察，无记录时显式给 `observedState:null`（实测 `{"state":"idle","observedState":null,...}`）；③ 产品侧不再在建会话同拍置 `thinking`（`orchestrator.js:546-549`），实测 `--hold-session` 下 `status` 为 `会话 空闲`，且无 `session→thinking` 事件（`test/wp8/f5-hold.test.js`） | 探针在“归一化器无记录”时仍以字面量 `idle` 兜底，严格说不是“观察值”；但它同时输出 `observedState:null`，不再自证。真正证据已由产品级 `f5` 用例承担 |
| **B-6** | **修了但引入新问题** | 夹具修好：`mock-acp-agent.js:394-397` 建会话即标 `closed`，`:222` 使 prompt 回 `-32602 unknown session`；核心正确分类为 `SESSION_INVALID`（本轮脚本：`code=SESSION_INVALID`）。**但 CLI 展示错**：`renderNodeFailure` 没有 `SESSION_INVALID` 分支，`orch run` 实跑输出 `节点 失败 · 未知错误：unknown session` + `未知错误：unknown session`，exit 1 | 见 **C-1**：AC-20 的 Then「我看到『会话已失效，需要重新创建』」不成立 |
| **B-7** | **已修** | `mock-acp-agent.js:296-312`：`deny` 先发 `request_permission` 再回 `refusal`；`orchestrator.js:979-983` 的 `step` 取 `permission.action → toolName → unknown-tool`。实测 `--permission=deny`：`params.step="write"`；CLI 输出 `审批被拒绝，任务中止于 write`，无 `null`；同时 `handoff=rejected(permission_denied)`、`node=failed` | 无 |

---

## 2. CLI 层问题（新代码）

> 逐字文案核对：`src/cli/labels.js:44-56` 的 9 条与需求 2.6 **逐字一致**（渲染实测：`无法启动 DSH：…` / `工作目录不可写：…` / `核心进程启动失败：…` / `该节点正在执行，本次未发起` / `会话已失效，需要重新创建` / `审批被拒绝，任务中止于 write` / `执行失败：<原文>` / `核对失败：未找到声明的产出 …` / `未知错误：<原文>`），外加契约登记的 `STATE_CORRUPT`。文案表本身没问题，问题在**使用它的分支**。

| ID | 严重度 | 文件:行 | 现象 | 期望 |
|---|---|---|---|---|
| **C-1** | **阻断** | `src/cli/render.js:220-238`（`renderNodeFailure`）、`src/cli/main.js:324-326` | `--session-missing` 场景：核心返回 `SESSION_INVALID`，CLI 却打印 `节点 失败 · 未知错误：unknown session` / `未知错误：unknown session`（实测） | 显示 `会话已失效，需要重新创建`；`renderNodeFailure` 补 `SESSION_INVALID` 分支，或 run 收尾按 `failure.code` 调 `renderError` |
| **C-2** | **阻断** | `src/cli/render.js:147-152`、`src/cli/main.js:398` | `tool_running` 行只输出 `会话 执行中 · 调用工具（write）`，**不含时长**；`orch status` 隔 1.2s 两次输出完全一致（实测），AC-03「时长比上一次查询时更大」无法满足 | `tool_running` 行追加 `· 已运行 Ns`（或用独立行）；需求 2.3 的“调用工具”样例与 AC-03 需在契约层统一口径 |
| **C-3** | 中 | `src/cli/main.js:298-305`、`render.js:371-385` | 跑到一半 `orch core stop`：`orch run` 收尾打印 `未知错误：IPC_CLOSED`（实测），把“核心被停”说成“未知错误” | 核心断开时识别为 `interrupted`，打印 `实例 … 已中断 ｜ 停在节点/会话 …`（或至少不归入宿主未知错误） |
| **C-4** | 中 | `src/cli/main.js:398` vs `:248-250` | `orch run` 会走 `renderSessionStall`（实测 `已运行 10s · 无新事件`），但 `orch status --instance` 只调 `renderSessionLine`，同样静默 11s 时**不显示“无新事件”**（实测） | `status` 也先试 `renderSessionStall`，两处口径一致（AC-23 的“查看状态”更可能走 status） |
| **C-5** | 低 | `bin/orch.js:13-14` | 用 `argv.includes('core') && argv.includes('serve')` 判定内部通道；`orch run --cwd core --task serve` 这类合法参数组合会被劫持去起核心 | 只看 `argv[0]==='core' && argv[1]==='serve'` |
| **C-6** | 低 | `src/cli/labels.js:55`、`main.js:446` | 多出第 10 条用户可见文案 `实例已结束（{state}），本迭代不支持重跑`（实测），需求 2.6 只有 9 条 | 要么登记为契约文案，要么改为只回结构化码、不新增用户文案 |
| **C-7** | 低 | `src/cli/main.js:394-395` | `已中断` 时先打 `实例 INST-002 · 已中断`，再打 `实例 INST-002 · 已中断 ｜ 停在节点 …`，重复一行 | 只保留带 note 的那一行 |
| **S-1 关联** | 低 | `src/daemon/server.js:182-190` | `instance.get` 只回 `params`，丢掉 `getStatus` 的 `backupPath`；CLI 用 `corruptPath(ctx.cwd,id)` 现算才“看起来对” | 透出 `backupPath`（见 §3 S-1） |

**其余 CLI 核对结论**

- 参数解析与退出码符合 §2.14：无参数/未知命令/缺 `--task` → **2**；`--cwd` 不存在 → **3**；`run` 成功 → **0**；失败 → **1**；`core stop`（未运行）→ **0**（实测）。
- 三行**确实在会话建立后立即打印**：`实例/会话已创建/任务已投递` 全在 **455ms** 打出，而 turn 结束在 **4057ms**（读代码：`main.js:234-240` 在 `run.wait` 之前，未 await run.wait）。
- AC-07：`NODE_BUSY` 时只打 `该节点正在执行，本次未发起`（实测 exit 1），未订阅、未打三行、无 `会话已失效`；代码在 `main.js:224-228` 直接 return，订阅在 `:279` 之后。
- AC-03 时长来源：`renderSessionLine` 用 `snapshot.elapsedMs`（核心快照，`orchestrator.js:1308-1312`），非 CLI 自计时——口径正确，问题只在 `tool_running` 不显示。
- AC-12：`status` 实测 `实例 … 已中断 ｜ 停在节点 执行中 / 会话 执行中`，无自动重跑。
- AC-13：实测打印真实备份路径 `…\INST-002\state.json.corrupt`，`state.json` 未被清空/覆盖（字节一致），`.corrupt` 存在。
- 全仓**没有任何路径会打印“已过期”**：`grep 已过期 src/` 只命中 `labels.js:40` 的映射表，`renderHandoffLines` 的 order 不含 `expired`（`render.js:249-255`）。
- `core serve`：`bin/orch.js:13-14` 转调 `serve-entry.js` 且**不** `process.exit`；实测自动拉起可用。

---

## 3. 建议项现状（S-1 ~ S-12）

| ID | 结论 | 证据 / 理由 |
|---|---|---|
| S-1 | **未修** | `server.js:186-188` 仍只回 `code/params`；`backupPath` 在 `orchestrator.getStatus` 顶层（`orchestrator.js:1341-1343`）被丢弃。CLI 用 `corruptPath()` 现算兜底（`main.js:379`），验收看得对，但契约面仍缺字段 |
| S-2 | **未修** | `verify-artifact.js:89` 仍把裸 token 全量收；实测 `"用 Node.js 写一段说明，保存到 out/intro.md"` → `["out/intro.md","Node.js"]`，随后必判 `MISSING`。建议只在引导词后取路径，裸 token 仅接受含 `/` 的形式 |
| S-3 | **已修（折中）** | 核对失败时给 `handoff.note='verification_failed'`（`orchestrator.js:953-954`），不再“干净地挂 accepted”；但仍非终态，需在 I1.4 明确 |
| S-4 | **未修** | `transit` 对 `emit` 的返回值仍不看（`orchestrator.js:244-247`）；事件落盘失败时状态已 save 成功，迁移照样算成功 |
| S-5 | **未修** | `markInterrupted` 仍先补 `created→running` 再判 `interrupted`（`orchestrator.js:1404-1413`）；事件里凭空多一步“运行过” |
| S-6 | **判断不该修（需契约澄清）** | `orchestrator.js:897-905` 的中文 note 是需求 2.4 原文口径（“注明‘未声明产出，跳过存在性检查’”）；与契约 §1.5「中文只在 labels」冲突，应由契约裁决，而非实现改字 |
| S-7 | **未修** | `factory.js:43-118` 全程未调 `probeDshInstalled`；真实安装缺 bin 时仍靠 spawn/exit 的 stderr 兜底（本轮 AC-09 实测能给出 Node 的完整栈，但文案不是“未找到 <path>”） |
| S-8 | **已修** | `review` 阶段取消改为 `review→failed` + `note='cancelled_in_review'`（`orchestrator.js:1254-1264`），不再是孤儿 |
| S-9 | **未修** | `instance-store.js:254-264`：`list()` 仍 `markCorrupt`，而 `allocateInstanceId` 每次都 `list()`（`orchestrator.js:297-309`），读路径带写副作用 |
| S-10 | **已修** | `reserved.add(id)` 与分配同处 `'@allocate'` 临界区（`orchestrator.js:1131-1136`） |
| S-11 | **未修** | `handoff-tracker.js:78-96`：先改 `state` 再 `emit` 且吞异常；orchestrator 的 `flushHandoff` 也不看 emit 结果，事件丢失仍可能发生 |
| S-12 | **未修** | `startRun` 仍不返回 `stream`，`server.js:151-154` 的 `drainStream` 不可达（`:588-605` 死代码）；契约 `iteration-1.md:651-653` 仍写 `stream`，两套口径 |

---

## 4. 回归结果

### 4.1 契约测试

```
$ node --test "test/**/*.test.js"
# tests 197
# pass 197
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7837.8
```

### 4.2 `npm test`

```
$ npm test
# Error: Cannot find module 'D:\WWW\Maestro\test'   (code: MODULE_NOT_FOUND)
# pass 0 / fail 1
```

结论：**不可用**（与上一轮一致）。建议（只给建议，未改文件）：

```json
"scripts": {
  "test": "node --test \"test/**/*.test.js\"",
  "test:wp8": "node --test \"test/wp8/*.test.js\""
}
```

Node 22 自己展开 glob，Windows `cmd` 下 `npm test` 也能跑；若担心 npm 的引号处理，可用等价的显式列表：`node --test test/wp1/*.test.js test/wp2/*.test.js … test/wp8/*.test.js`。

### 4.3 三种 permissionPolicy 的 CLI 实跑（mock 宿主，临时项目根）

**allow**（`--permission=ask` + `limits.permissionPolicy=allow`，`--turn-delay-ms 3500`，exit 0）

```
+ 455ms  实例 INST-001 · 运行中
+ 455ms  会话已创建 mock-sess-30408-1
+ 455ms  任务已投递
+ 465ms  会话 等待审批：write
+ 486ms  会话 执行中 · 调用工具（write）
+3997ms  会话 执行中 · 已运行 4s
+4007ms  会话 等待下游 · 产出已提交
+4044ms  会话 空闲
+4057ms  节点 已完成 · 耗时 4s
+4059ms  交接包 HO-001  已构造 / 已投递 / 已接受 / 已完成
```

**reject**（`--permission=ask` + policy=reject，exit 1）

```
+ 442ms  会话 等待审批：write
+ 466ms  会话 空闲
+ 502ms  节点 失败 · 审批被拒绝，任务中止于 write
+ 505ms  交接包 HO-001  已拒绝   原因 审批被拒
+ 505ms  审批被拒绝，任务中止于 write
```

**hold**（`--permission=ask` + policy=hold；`status` 中途采样后 `cancel`）

```
# status（中途）
实例 INST-001 · 运行中
节点 执行中
会话 等待审批：write
交接包 HO-001  已投递 / 已接受
# cancel
会话 空闲
节点 已取消
交接包 HO-001 已拒绝（已撤回）
```

三种策略的会话行文案分别为 `等待审批：write → 执行中 · 调用工具（write）`、`等待审批：write → 空闲`、`等待审批：write`（挂起），均与需求 2.3 的用词一致；`hold` 下节点保持 `执行中`（BR-03）。

### 4.4 一次完整成功运行的事件序列（AC-04 / AC-05 / AC-06 / BR-09 的直接证据）

```
1  instance created -> running        applied  run.started
2  node     pending -> running        applied  run.started
3  handoff  null -> created           applied  handoff.created
4  handoff  created -> delivered      applied  handoff.delivered
5  session  idle -> thinking          applied  session.state          <-- 第 4~5 条之间就是 AC-15 的“已建未投递”窗口
6  handoff  delivered -> accepted     applied  turn.first_event
7  session  thinking -> tool_running  applied  session.state
8  session  tool_running -> thinking  applied  session.state
9  session  thinking -> waiting_dependency applied output.submitted
10 node     running -> review         applied  output.submitted
11 node     review -> done            applied  verification.passed
12 handoff  accepted -> consumed      applied  handoff.consumed
13 instance running -> completed      applied  run.completed
14 session  waiting_dependency -> idle applied run.completed
```

`accepted`(6) 早于 `consumed`(12)，两者之间节点经 `review`(10)；`consumed` 在 `verification.passed`(11) 之后，符合“核对通过才算完成”（X3 口径）。

---

## 5. 新引入的风险

| # | 风险 | 证据 | 影响 |
|---|---|---|---|
| R-1 | **`store.save` 的 CAS 不是跨进程原子**：`readDiskState` 与 `rename` 之间有窗口，外部手工改盘可被在飞快照覆盖 | 本轮第一次 B-3 实测：手工改 `interrupted` 后最终仍 `completed`、无 `rejected`（静默窗口下复测才正确） | 单写者前提下不影响验收；但“人工篡改/外部工具修复状态”这种运维动作不可靠，宜在文档里明说只有核心可写 |
| R-2 | **`permissionPolicy` 进入核心**：`orchestrator.js:16-18` 直接 import `adapter/host-config.js`，`policyFor` 自己读 `<root>/.orch/hosts/<id>.json`（`:104-114`），并新增常量 `DEFAULT_HOST_ID='dsh'`（`:24`） | 契约 §1.2「`src/core/` 禁词 dsh，核心只依赖注入接口」 | 核心开始认识宿主配置文件与 `dsh` 默认值；I1.4 多宿主时会散。建议把 policy 解析放回装配层，核心只收 `permissionPolicy` 值（构造参数已存在） |
| R-3 | `saveLive()` 只把 `STORE_CONFLICT` 记为 `conflicted` 标志，`STORE_WRITE_FAILED` 结果**完全忽略**（`orchestrator.js:291-295`），且 `conflicted` 全仓无读取点 | `grep conflicted` 只有赋值 | 磁盘写失败时内存继续推进、无事件、无日志，状态与证据可能静默分叉（BR-10 的边界） |
| R-4 | `handlePermission` 对“sessionId 不匹配”的审批请求**无条件 allow-once**（`orchestrator.js:627-630`） | 代码直读 | 多会话/异常宿主下会绕过 reject/hold 策略；本迭代单会话，风险低但语义可疑 |
| R-5 | `bin/orch.js:13` 的 `argv.includes(...)` 判定内部通道，可被普通 run 参数命中（见 C-5） | 实跑 `orch run --cwd core --task serve` 会去起核心 | 低概率的命令劫持 |
| R-6 | 契约仍写 `startRun -> {stream}`，实现已改 `run.start + run.wait`，`drainStream` 为死代码 | `iteration-1.md:651-653`、`server.js:151-154,588-605` | 文档/实现两套口径，I1.4 接手会误用 |
| R-7 | 未捕获异常面：`enqueue(ctx, fn)` 的 `ctx.chain` 若在 `finishRun` 之前拒绝，直到 `finishRun/cleanup` 才被 `catch`，中间存在 `unhandledRejection` 窗口 | `orchestrator.js:601-604, 828, 1017-1021` | 低概率（emit 极少 reject），但会触发进程级兜底日志 |

**`store.save` 绕过状态机检查（关键项）结果：未发现绕过。**

```
$ grep -rn "store\.save\|\.save(" src/ bin/ | grep -v saveState\|enqueueSave\|注释
src/core/orchestrator.js:90   (类型检查)
src/core/orchestrator.js:174  saveState() 的唯一出口
```

- 所有状态写入都经 `saveState`；`saveState` 只被 `claimRun`（首建快照/“半截实例”规则）、`handleUpdate`、`finishRun`、`applyCancel`、`transit` 调用。
- `node/instance/handoff` 的**迁移**全部经 `transit()`（含 `markInterrupted`、`applyCancel`）；直接写 `state.state='running'` 只出现在 `claimRun:425-441` 的初始构造（此时尚未落盘、且随后手工补了 `run.started` 事件）。
- 会话（`session`）没有状态机，`handleUpdate`/`quiesceSession` 直接改字段并 emit，符合契约（会话只作指示）。
- 核心禁词：`grep -riE "dsh|stdio|transport" src/core/ | grep -v hostId` 命中 `error-map.js` 的 `DSH_SPAWN_FAILED`（需求 §2.9 规定的错误码，非宿主分支）与 `orchestrator.js:24` 的 `DEFAULT_HOST_ID='dsh'`（见 R-2）。

---

## 6. AC 逐条预判（26 条）

| AC | 预判 | 一句依据 |
|---|---|---|
| AC-01 | 能过 | CLI 实测 455ms 出三行、6 行齐全、`节点 已完成 · 耗时 4s`、交接包 `已完成`，exit 0 |
| AC-02 | 能过 | `status` 无参列表 + `--instance` 四类状态均实测（含损坏实例以“状态不可读”可见） |
| AC-03 | **会挂** | **C-2**：`tool_running` 行无“已运行 Ns”，1.2s 间隔两次 `status` 输出逐字相同 |
| AC-04 | 能过 | 实测四步时间戳 `:07→:07→:07→:11`，顺序与事件一致 |
| AC-05 | 能过 | §4.4 实测：`accepted`=seq6 早于 `consumed`=seq12；中间 seq10 为 `node running→review`，非同一时刻 |
| AC-06 | 能过 | §4.4 实测：seq10 `node running→review` → seq11 `review→done`；seq9 会话为 `waiting_dependency`，CLI 显示 `等待下游 · 产出已提交` |
| AC-07 | 能过 | 实测第二次 run 只输出 `该节点正在执行，本次未发起`，exit 1，无新会话行、无 `会话已失效` |
| AC-08 | 能过 | 被拒后原 run 继续到 `节点 已完成`（同一次实测的后半段） |
| AC-09 | 能过 | mock 指向不存在的 bin：exit 3、`无法启动 DSH：<stderr 原文>`、`instances` 目录为空、`status` 显示“实例 无” |
| AC-10 | 待验 | `claimRun:378-387` 有 `realpath + W_OK`；Windows 下真“不可写目录”难稳定构造，且“目录不存在”被并入同一文案（实测 exit 3） |
| AC-11 | 能过 | hold 下 `cancel` 实测三对象收敛；wp4 另有 10s turn 的 cancel 用例 |
| AC-12 | 能过 | `core stop` 后 `status` 实测 `已中断 ｜ 停在节点 执行中 / 会话 执行中`，无自动重跑；`state.json` 重启后仍 interrupted |
| AC-13 | 能过 | 实测打印真实 `.corrupt` 路径、原 `state.json` 字节不变、备份存在（但 `backupPath` 走的是 CLI 现算兜底，见 S-1） |
| AC-14 | 能过 | `status --events` 逐行 `时间 对象 ID 从→到 原因`，`seq` 单调 |
| AC-15 | 能过 | `--hold-session` 产品实测 `会话 空闲` 且无 `session→thinking` 事件；探针输出 `observedState:null` |
| AC-16 | 能过 | 探针 `--slow-tool git_push` → `toolName=git_push`；CLI 实测 `调用工具（write）` |
| AC-17 | 能过 | hold 实测 `会话 等待审批：write` + `节点 执行中`，节点未跳 `已完成` |
| AC-18 | 能过 | `--permission=deny` 实测 `审批被拒绝，任务中止于 write`、`节点 失败`、`交接包 已拒绝 · 原因 审批被拒` |
| AC-19 | 能过 | 探针 `--noise-on-prompt`：首条噪声时 `state=delivered`，turn 后 `accepted`（`stateAfterTurn`） |
| AC-20 | **会挂** | **C-1**：核心 `SESSION_INVALID` 正确，但 CLI 输出 `未知错误：unknown session`，不是 `会话已失效，需要重新创建` |
| AC-21 | 能过 | `--host-error` 实测 `执行失败：mock-host: …`（逐字）、`节点 失败`、交接包 `已拒绝`；“停在哪一步”只有节点行，缺独立 step 字段（建议补，不单独阻断） |
| AC-22 | 能过 | `--unknown-error` 实测 `未知错误：mock-host: E_QUASAR_7719 …`，原文未改写/截断 |
| AC-23 | 待验 | 静默 11s：`orch run` 实测 `已运行 10s · 无新事件`；但 `orch status` 不显示（**C-4**），验收若走 status 会挂 |
| AC-24 | 能过 | `--accept-delay-ms 3500` 中途 status 实测 `已投递 ｜ 等待目标响应 · 已等待 1s`，全程无 `已过期`，节点保持 `执行中`，最终 `已完成` |
| AC-25 | 待验 | 每个 run 新建 adapter + normalizer，物理隔离，结构上成立；但**仍无脚本**构造“上一任务收尾帧 + 第二个会话” |
| AC-26 | 能过 | `attempt-transition.mjs` 实测 `ILLEGAL_TRANSITION`，`status --events` 出现 `节点 T-001 拒绝的迁移：已完成 → 执行中` |

**汇总**：能过 21 ｜ 会挂 2（AC-03、AC-20）｜ 待验 3（AC-10、AC-23、AC-25）。

---

## 附：本轮明确的“不能进验收”的理由

1. **AC-20 的展示面确定失败**：核心已能构造 `SESSION_INVALID`，但用户看到的是“未知错误”（C-1）。这是 B-6 的收口缺口，不是新场景。
2. **AC-03 的时长面确定失败**：`orch status` 在工具调用窗口不给时长，两次查询无差异（C-2）。文档层（契约 2.14 与 AC-03）本身冲突，需要在修代码前先定口径；按“需求 v5 是唯一验收依据”，应补时长。
3. 其余 5 个阻断项（B-1/2/3/4/5/7）已用真进程、真磁盘、真 CLI 复测通过；B-3 的跨进程 TOCTOU（R-1）与 `permissionPolicy` 入核心（R-2）记入技术债，不阻断本轮验收。
