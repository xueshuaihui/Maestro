# I1.9 S2 批次 4（WP-7）独立评审报告

> 评审 Agent：干净上下文独立评审（与实现者分离），**只评审、不改任何产品代码 / 测试代码**。
> 评审时刻 HEAD：`322fb5e43a96739e89a571341495c84bfba4a159`（WP-7 改动尚未提交，在工作区）。
> 唯一写入：本报告 `docs/iterations/iteration-9/review-wp7.md`。

---

## 1. 评审范围与判据来源

### 1.1 评审对象（实测）

| 文件 | 状态 | 行数实测 |
|---|---|---|
| `src/core/orchestrator.js` | 改 | 5244（基线 5029，净增 **215**） |
| `test/wp9/i19-orchestrator.test.js` | 新建 | 411 |

`git diff --numstat src/core/orchestrator.js` = **`218 / 3`**（任务描述写「+221/-3」，以实跑为准：`+218/-3`，净增 215 = 5244−5029）。见建议 S-02。

对照基线：`git show 322fb5e:src/core/orchestrator.js`（5029 行，即 WP-7 改动前）。HEAD 提交信息为 `docs(I1.9): S2 batch-3 independent review PASS + D-12 fix + progress ledger`，确认 322fb5e 为批次 3 收口后的 HEAD；`health.js` / `trace.js` 等 WP-1~3 交付已在该 HEAD 内，故两版均可独立运行。

### 1.2 判据来源（均已自读）

- `docs/iterations/iteration-9/requirement.md`：§3.1 的 AC-03 / AC-04 / AC-05 / AC-16 / AC-17 / AC-18 / AC-19 / AC-24 / AC-26 / AC-27、§3.2 非功能、§3.3 验收前置条件（含「快照夹具启动顺序」「命令口径」「回归基线」）、附录 D-2（跨度）/ D-3（健康度）/ D-4（摘要边界）/ D-6（禁词）/ D-7（授权修改清单 12 处会话发射点逐处定去留）。
- `docs/iterations/iteration-9.md`：§2.6（L177-187）、WP-7 段（L481-487）、§6 契约先冻结点（L615-623）、§8 冲突表（C-04 / C-19 / C-20 / C-22 / C-23）、§3.4 两类新增事件完整 JSON 样例。
- `docs/iterations/iteration-9/decisions.md`：D-1 / D-2 / D-4 / D-10 / D-12 / D-14 / D-15 / D-16。**D-14（追踪号生成时机）、D-15（取消摘要不传 ts）、D-16 ①②③（async / 行号漂移 / `reasonVars` 可选不做）、D-1（12 处存量发射点保留）、D-4（`appendSpan` 只判 `.ok`）、D-2（差集口径）、D-12（纯码值数组）均为已裁决项，本报告不将其重新升格为阻断。**
- 已收口模块只读：`src/core/trace.js`、`src/core/health.js`、`src/core/event-bus.js`、`src/persistence/instance-store.js`（`persist` 的 CAS / `rev` 机制）。
- `docs/iterations/iteration-7/baseline-failures.txt`（8 行基线失败集，第 1/2 行为 NFR-02 p95、第 6 行为 macOS `/private/var` 路径）。

### 1.3 三主链逐字比对采用方案

采用 **方案①**：`git worktree add --detach /tmp/i19-wp7-baseline 322fb5e` 建只读基线工作树（**按要求保留、未删除、未在其中提交**），在基线与当前工作区用**同一份夹具脚本** `/tmp/i19-wp7-chains.mjs`、同一套夹具命令跑 `single` / `code-loop` / `task-loop`，捕获完整 stdout 做逐字 diff。

- 夹具口径：项目根一律 `os.tmpdir()` 下独立 `mkdtemp` 目录、`NODE_ENV=test`、`--host mock`（D-3，`.orch/hosts/mock.json`）、`orch run --cwd .`；`launch.args` 固定指向**同一份** `test/fixtures/mock-acp-agent.js`（两版夹具内容相同，避免路径差异）。验收根不在仓库目录。
- 两棵树一致性核对：`diff -rq /tmp/i19-wp7-baseline/src /Users/xuesh/www/Maestro/src` 仅报 `src/core/orchestrator.js` 不同；`bin/`、`test/fixtures/`、`package.json` **全部一致**。故两版输出差异唯一归因于 WP-7 的 `orchestrator.js`。
- 可变值处理：stdout 含 `mock-sess-<PID>-N`（`process.pid`）、`HH:MM:SS`（`Date.now()`）、`已运行 Ns` / `耗时 Ns`（进度时序），均为需求附录 A-0「可变值约定」允许的随夹具变量。故同时给出**原始 diff**与**归一化后 diff**（归一化只替换上述 4 类，不掩盖任何新增/缺失文字）。
- **方案②未采用**：`test/templates/**` 下只有 `fake-graph.test.js` / `task-loop.test.js`（测试文件，非逐字基线文本），`docs/iterations/iteration-7/evidence/` 只有 `ac12-status/`；全文搜索「实例 INST-001 · 运行中 / 任务已投递 / 交接包 HO-001 已构造」等三链输出文本，除 `requirement.md` 的 AC 描述外无既有逐字基线文件。

---

## 2. 逐项独立验证记录（原始证据）

### A. 冻结红线与越界

**A-1 `grep -c`**

```
$ grep -c "object: 'session'" src/core/orchestrator.js
13
$ git show 322fb5e:src/core/orchestrator.js | grep -c "object: 'session'"
12
```

13 ≤ 13 ✓。基线 12 → 当前 13，增量 1。

**A-2 12 处存量发射点逐字未改、仍在发射**

`git diff -U0 src/core/orchestrator.js | grep -nE "^[+-].*object: 'session'"` 输出**仅 1 行**：

```
48:+      object: 'session',
```

即唯一新增 `object:'session'` 位于 `writeExecutionSummary` 共享辅助函数（当前 `496` 行，`result:'note'` / `reason:'execution.summary'`），无任何 `-` 行 → 12 处存量发射点该行未被改写。

`git diff -U3` 的全部删除行仅 3 行（与 12 处 emit 块无关）：

```
-    session.stateSince = iso();                                        (quiesceSession)
-    session.stateSince = iso();                                        (idleSession)
-    return { ok: true, snapshot: snapshotOf(liveState ?? loaded.state) };   (getStatus)
```

前 2 处为 `const at = iso(); session.stateSince = at;` 的语义等价改写（`at` 复用作摘要 `ts`），第 3 处为 `getStatus` 返回前插入健康度重算，均为 `decisions.md` D-16 ⑤ 已裁决的授权内改写，**不作为阻断**。

12 处行号对照（基线 322fb5e → 当前 WP-7，偏移由 20 个 hunk 累积推出，总 +215）：

| 基线 | 当前 | 偏移 | 处置（据 D-7 L1018-1021 / C-22） |
|---|---|---|---|
| 1004 | 1104 | +100 | 保留（审批） |
| 1046 | 1146 | +100 | 保留（审批） |
| 1102 | 1202 | +100 | 保留（审批） |
| 1133 | 1233 | +100 | 保留（审批） |
| 1203 | 1321 | +118 | 冻结 |
| 1294 | 1412 | +118 | 冻结（quiesceSession 回 idle） |
| 1323 | 1451 | +128 | 冻结（idleSession 回 idle） |
| 2085 | 2223 | +138 | 冻结 |
| 2306 | 2447 | +141 | 冻结 |
| 2325 | 2466 | +141 | 冻结 |
| 3847 | 4000 | +153 | 复用（run.cancelled） |
| 4889 | 5104 | +215 | 冻结（state.change 行内形式） |
| — | **496** | 新增 | `execution.summary`（唯一新增，共享辅助） |

实读 `quiesceSession`（`1400-1436`）/ `idleSession`（`1439-1474`）：两处存量 `ctx.emit({object:'session', ..., result:'applied', reason, detail:null})` 均在，之后才追加 `await writeExecutionSummary(...)`；D 组实跑在 `events.jsonl` 中确见 `session.state` / `output.submitted` / `run.completed` / `run.failed` / `run.cancelled` 等存量事件仍在发射。会话级新增事件类型只有 `execution.summary` 一种（三变体 + 取消 + 多轮的 `EVENT_session_scoped_reasons` 集合均无第二类新类型）✓。

**A-3 越界零改**

```
$ git diff --name-only
.workbuddy/memory/2026-11-09.md
docs/iterations/iteration-9/decisions.md
src/core/orchestrator.js
$ git status --short
 M .workbuddy/memory/2026-11-09.md      （历史遗留，非 WP-7）
 M docs/iterations/iteration-9/decisions.md（主控本轮裁决，非 WP-7）
 M src/core/orchestrator.js              （WP-7）
?? .workbuddy/memory/2026-11-10.md      （历史遗留）
?? docs/iterations/regression-2026-11-09.md / regression-2026-11-09/（历史遗留）
?? test/wp9/i19-orchestrator.test.js     （WP-7 新建）
```

WP-7 恰 **2 个文件**。`git status --short -- src/cli src/daemon src/core/trace.js src/core/health.js src/core/event-bus.js src/persistence src/adapter/session-state.js test/fixtures package.json docs/iterations/iteration-9/requirement.md docs/iterations/iteration-9.md` **无输出** → 禁改路径零改。上述历史遗留 / 主控裁决文件按任务说明不算 WP-7 改动，未误报。

**A-4 纯净 / 中文 / 依赖**

```
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "task-loop,...,compliance-check"
OK: 扫描 24 个文件 … 零命中            ; exit 0
$ node -p "Object.keys(require('./package.json').dependencies||{}).length"
0
$ git diff -U0 src/core/orchestrator.js | grep -E "^\+[^+]" | LC_ALL=C grep -c '[^ -~]'
0                                        ; 新增行零中文硬编码
$ git diff -U0 ... | grep -E "^\+[^+]" | grep -iE "$FORBID"   ; 无输出，零禁词
```

✓ 全部通过。

---

### B. 三主链逐字回归（最高优先级，D-16 ⑥ 要求补做）

**实际命令**（两版仅 `<REPO>` 不同，脚本与夹具完全一致）：

```
$ git worktree add --detach /tmp/i19-wp7-baseline 322fb5e
$ node /tmp/i19-wp7-chains.mjs /tmp/i19-wp7-baseline /tmp/i19-wp7-base2
$ node /tmp/i19-wp7-chains.mjs /Users/xuesh/www/Maestro   /tmp/i19-wp7-cur2
# 脚本内每条链：
cd <mkdtemp(os.tmpdir())> && NODE_ENV=test node <REPO>/bin/orch.js run --cwd . --host mock \
  --template {single|code-loop|task-loop} --task "<对应任务文案>"
#   single:    写一份说明
#   code-loop: 给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js
#   task-loop: 写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md
# 归一化（node 脚本，仅替换 A-0 可变值）：
s.replace(/mock-sess-\d+-\d+/g,"mock-sess-PID-SEQ")
 .replace(/\d{2}:\d{2}:\d{2}/g,"TIME")
 .replace(/已运行 \d+s/g,"已运行 Ns").replace(/耗时 \d+s/g,"耗时 Ns")
$ diff /tmp/i19-wp7-base2-<T>.norm /tmp/i19-wp7-cur2-<T>.norm
```

两版退出码一致：`single exit=0 / 12 行`、`code-loop exit=4 / 11 行`、`task-loop exit=4 / 10 或 9 行`。（`code-loop`/`task-loop` 以升级挂起终态收尾，为默认 mock 无产物时的真实运行输出，两版相同条件下一致。）

**原始 diff（节选，single）**——仅 A-0 可变值：

```
2c2
< 会话已创建 mock-sess-61035-1
---
> 会话已创建 mock-sess-61429-1
8,11c8,11
< 交接包 HO-001  已构造   05:23:07
< 交接包 HO-001  已投递   05:23:07
< 交接包 HO-001  已接受   05:23:07
< 交接包 HO-001  已完成   05:23:08
---
> 交接包 HO-001  已构造   05:23:20
> 交接包 HO-001  已投递   05:23:20
> 交接包 HO-001  已接受   05:23:21
> 交接包 HO-001  已完成   05:23:21
```

**归一化后逐字 diff**：

```
=================== single 归一化逐字 diff ===================
[归一化 diff 为空]
=================== code-loop 归一化逐字 diff ===================
[归一化 diff 为空]
=================== task-loop 归一化逐字 diff ===================
6d5
< 会话 已升级
```

`task-loop` 归一化后仍差 1 行：基线打印 `会话 已升级`，当前工作区不打印。

**该差异的稳定性实证**（为排除「先跑基线再跑当前」的系统负载混杂，做交替对照 `base,cur` 成对，每对同一脚本同一命令）：

| 实验 | 基线有 `会话 已升级` | 当前有 `会话 已升级` |
|---|---|---|
| 单版各 5 次（先基线后当前） | 4/5 | 0/5 |
| 交替 6 对 | 6/6 | 1/6 |
| 合计 | 10/11（≈91%） | 1/11（≈9%） |

交替 6 对逐对：`base=1 cur=0` ×5、`base=1 cur=1` ×1。`code-loop` 交替 3 对：base 3/3、cur 3/3，**两版一致无差异**。

`会话 已升级` 来自 `src/cli/render.js` 的 `renderSessionLine`（`snapshot.session.state === 'escalated'`），由 `src/cli/main.js:855-885` 的 `printSnapshot` 进度轮询打印；两版 CLI / daemon / 夹具代码逐字一致，唯一变量是 `orchestrator.js`。WP-7 在 `saveState` 保存前新增 `await trace.readTraces(...)` + `computeHealth`（`446-479`），并在 `quiesceSession` / `idleSession` 收尾新增 `await writeExecutionSummary(...)` 的 emit，改变了事件/进度轮询时序，使该进度行几乎不再被打印。这构成 `task-loop` 主链终端输出的**稳定一行差异**（详见阻断 F-01）。

补充正面证据：三链 stdout 中**均未出现**健康度行 / 追踪行 / 执行摘要行，WP-7 未把新能力回灌到 `run` 输出（AC-03/AC-18 这一点成立）。但实现者的 `i19-orchestrator.test.js` 用例 9「三主链运行期输出不出现健康度 / 追踪新行」只做「不出现新词」正则，D-16 ⑥ 已明确其不足；本次真实比对正是补上该缺口后发现差异。

---

### C. `getStatus` 一次窄 CAS 与 `health.changed`（独立实跑，非实现者测试）

用**真实 CLI + 真实核心**独立构造 AC-16 快照夹具（按需求 §3.3 L533：先 `instance status` 拉起核心，再写 `state.json`，最后读取）。脚本 `/tmp/i19-wp7-health.mjs`。实跑输出：

```
BOOT_exit: 1 ; BOOT_stdout: 实例 INST-001 · 不存在
SNAP_health: {"nodeTimeoutMs":300000} ; SNAP_rev: 0
S1_exit: 0
S1_state_health: {"level":"normal","reasons":[],"computedAt":"...21:33:55.973Z","nodeTimeoutMs":300000}
S1_state_rev: 1 ; S1_event_count: 0 ; S1_statusMd_exists: true
S1_statusMd_health_line: - 健康度：正常
MID_rev: 1 ; MID_escalations: [{"escalationId":"ESC-001","nodeId":"T-002","state":"pending"}]
S2_state_health: {"level":"attention","reasons":["pending_escalation"],...,"nodeTimeoutMs":300000}
S2_state_rev: 2 ; S2_rev_delta_from_MID: 1 ; S2_event_count: 1
S2_events: [{"object":"health","objectId":"INST-001","from":"normal","to":"attention",
  "result":"applied","reason":"health.changed","detail":{"reasons":["pending_escalation"]},
  "gen":"gen-...","seq":1,"ts":"...21:33:56.572Z","prev_event_hash":"0000...(64)"}]
S3_exit: 0 ; S4_exit: 0 ; S4_state_rev: 2 ; S4_rev_delta_from_S2: 0
S4_event_count: 1 ; S4_event_count_delta_from_S2: 0
CHANGED_fields: {object:"health", objectId:"INST-001", from:"normal", to:"attention",
  result:"applied", reason:"health.changed", reasonsIsArray:true, reasonsAllStrings:true,
  reasons:["pending_escalation"], hasSeq:true, hasTs:true, prevHashLen:64}
S5_event_count: 2  (再移除升级 → attention→normal 第 2 条 health.changed)
S5_recomputed_prevHash_for_2nd: e3e0e65b6370db1752bf82d260e40524a2a9d971d7bcc5bc500f902aaf3aa924
S5_2nd_prevHash_actual:          e3e0e65b6370db1752bf82d260e40524a2a9d971d7bcc5bc500f902aaf3aa924
S5_CHAIN_breakCount: 0 ; S5_seq_values: [1,2] ; S5_ts_monotonic: true
```

逐项：
- 首次读取（缺 `level`）→ 补写完整 `health`（保留 `nodeTimeoutMs:300000`）、`status.md` 刷新出 `- 健康度：正常`、**事件数 0** ✓
- 档位变化 → `rev` 恰 +1（**一次窄 CAS**）+ **恰一条** `health.changed` ✓
- 连续两次同档位 → `rev` 不变、事件数不变、不重复追加 ✓
- `health.changed` 形状逐字段全部符合 §3.4 样例；`detail.reasons` 为**纯码值数组**（D-12）✓；带 `seq`/`ts`/`prev_event_hash`（64 位）✓
- 事件链：2 条事件，第 2 条 `prev_event_hash` 与 `sha256(canonicalize(第1条))` 复算一致，`breakCount=0`、`seq` 递增、`ts` 单调 ✓

**CAS 形状**（静态 + 实跑）：`getStatus` 走 `saveState(instanceId, healthState, { expectedState: expectedOf(healthState) })`（`orchestrator.js:4248`），与 `transit()` 的 `saveState(..., {expectedState: expected})`（`:707`）**同路径、同一 `saveState` 封装**，未绕过 `transit()` 直接 `store.save`；`healthState = loaded.state`（磁盘现值），`expectedOf` 取磁盘现值 `rev`（`:555-562`）。`instance-store.js` `persist`（`:230-282`）先 `readDiskState` 取 `actual.rev`（磁盘现值）做 CAS 比较，`prevRev = actual.rev`、`rev = prevRev + 1`、`state.rev = rev`；`knownRev` 注释明确「rev 无条件基于磁盘现值递增、进程重启不回 1」。实跑 `rev` 0→1→2 递增 ✓。D-7 L1011 只授权一次受控写入，此处恰一次 ✓。

---

### D. `execution.summary` 与取消路径（真实 `mock-acp-agent.js` 夹具）

脚本 `/tmp/i19-wp7-summary.mjs`（三变体，各自独立项目根，`--host mock`）/ `/tmp/i19-wp7-cancel.mjs`（live 取消）/ `/tmp/i19-wp7-driver.mjs`（AC-27）。

**`--fail-tool`（D-10 载体，四项齐全）**：

```
[fail-tool] SUMMARY_count: 1
SUMMARY_events: [{"object":"session","objectId":"mock-sess-73471-1","result":"note",
  "reason":"execution.summary","detail":{"nodeId":"T-001","round":1,
  "summary":{"command":"node out/run.js","exitCode":1,"keyOutputLines":3,"logRef":"host-logs/T-001.log"}},
  "seq":14,"ts":"...14.817Z","prev_event_hash":"ed604ae7..."}]
SUMMARY_command_not_write: true
EVENT_ts_monotonic: true ; EVENT_seq_values: [1..14]
SUMMARY_ts_vs_stateSince: [{ts:"...14.817Z", stateSince:"...14.817Z", equal:true}]
EVENT_session_scoped_reasons: ["session.state","output.submitted","run.failed","execution.summary"]
```

四项取值与 AC-04 / D-10 完全一致，`command` 为 `node out/run.js` 而非 `write` ✓。

**`--fail-tool-no-refs`（缺项存 null）**：

```
[fail-tool-no-refs] SUMMARY_4values: [{"command":"node out/run.js","exitCode":1,
  "keyOutputLines":null,"logRef":null}] ; SUMMARY_count: 1 ; EVENT_ts_monotonic: true
```

✓。（首次因夹具目录名过长触发 macOS unix socket 路径 104 字节上限得到 `ENOTSOCK`，缩短 root 前缀后通过；属评审夹具环境问题，非产品缺陷，见 S-05。）

**成功收尾（`--task "写一份说明"`，`run.completed`）**：

```
[success] RUN_exit: 0 ; SUMMARY_count: 1
SUMMARY_4values: [{"command":null,"exitCode":null,"keyOutputLines":null,"logRef":null}]
SUMMARY_ts_vs_stateSince: [{..., equal:true}] ; quarantined:false
EVENT_session_scoped_reasons: ["session.state","output.submitted","run.completed","execution.summary"]
```

✓ 成功 / 失败 / 取消三种收尾各有摘要，每会话恰 1 条。

**live 取消（AC-26，`--turn-delay-ms 30000` + 第二进程 `orch cancel`）**：

```
SAW_tool_running: true ; CANCEL_exit: 0
SUMMARY_count: 1 ; SUMMARY_all_null: true
SUMMARY_4values: [{"command":null,"exitCode":null,"keyOutputLines":null,"logRef":null}]
STATE_instance_state: cancelled ; STATE_health_level: ended
STATE_sessions: [{state:"idle", toolName:null, quarantined:true}]
EVENT_ts_monotonic: true ; EVENT_seq_values: [1..12]
EVENT_session_scoped_reasons: ["session.state","run.cancelled","execution.summary"]
SUMMARY_ts: ["...28.447Z"] ; LAST_event_ts: ...28.447Z
```

取消四项全 `null`、终态 `cancelled`/`ended`、`orch cancel` 退出码 0（不阻断取消）✓。取消摘要不传 `ts`、由 `emit` 现取样，事件链 `ts` 仍单调（D-15 已裁决为口径澄清，**不升格为阻断**）✓。

**AC-27 同节点多轮（driver 冻结窗口，脚本 `/tmp/i19-wp7-driver.mjs`）**：

```
SUMMARY_count: 3 ; SUMMARY_T001_count: 2 ; SUMMARY_T001_rounds: [1,2] ; SUMMARY_T002_count: 1
SUMMARY_per_session_unique: true ; STATE_sessions_count: 3 ; SUMMARY_count_eq_sessions: true
EVENT_ts_monotonic: true ; EVENT_seq_values: [1..40]
```

T-001 两轮各 1 条、T-002 1 条，每会话恰 1 条、总数 = 会话数 ✓。quiesce/idle 摘要 `ts` 与 `session.stateSince` 同刻（三变体 + 取消均验证 `equal:true`）✓。

---

### E. 跨度与追踪（`--stop-after 3 --scenario backflow-once` 冻结窗口）

同一 driver 冻结窗口实跑（`.mock/stopped-after-3` 出现后取证，再写 `.mock/release` 放行 + `kill -INT`）：

```
SAW_stopped_after_3: true
SPAN_count: 3
SPAN_lines: [
 {"trace_id":"TRC-9168c0d3","instance_id":"INST-001","node_id":"T-001","round":1,
  "start_time":"...00.635Z","end_time":"...02.162Z","status":"done"},
 {"trace_id":"TRC-9168c0d3",...,"node_id":"T-002","round":1,...,"status":"failed"},
 {"trace_id":"TRC-9168c0d3",...,"node_id":"T-001","round":2,...,"status":"done"}]
SPAN_keys_per_line: 3 × ["trace_id","instance_id","node_id","round","start_time","end_time","status"]
SPAN_all_7_fields: true ; SPAN_no_handoff_ids: true ; SPAN_expected_keys: true
SPAN_trace_ids: ["TRC-9168c0d3"]（同一）; SPAN_status_values: ["done","failed","done"]（英文原值）
SPAN_no_in_progress: true ; SPAN_node_round_order: ["T-001#r1","T-002#r1","T-001#r2"]
DERIVE_T001_r1: ["HO-001"] ; DERIVE_T002_r1: ["HO-001","HO-002"] ; DERIVE_T001_r2: ["HO-002"]
DERIVE_HO002_present_in_T002_r1: true
STATE_handoffs: [HO-001(T-001→T-002,r1), HO-002(T-002→T-001,r2)]
DRIVER_exit: 0
```

- 冻结窗口**恰 3 条**跨度，顺序 `T-001 r1 → T-002 r1 → T-001 r2`，与需求 D-2 L950 一致；因停点在 3 条已完成跨度处，反证「节点收尾写跨度早于 `maybeStopAfter`（`orchestrator.js:3285`/`4379`）与 `advance()`（`:3301`）」——若先 advance 再写只会剩 2 条 ✓。
- 每行恰 7 字段、无 `handoff_ids`、`status` 英文原值、同一 `trace_id`、无进行中行 ✓。
- `deriveHandoffIds` 读取时推导：`T-002 r1` 仍推出 `HO-002`（不漏），三条跨度依次为 `[HO-001]` / `[HO-001,HO-002]` / `[HO-002]`，与 D-2 L954 逐字一致 ✓。
- `appendSpan` 失败不阻断节点收尾：`appendNodeSpan`（`:531-553`）返回 `result ?? null`、不抛；`:3374-3380` 有 `try/catch` 且注释「a span append must never block finalizing」；D-4 已裁决「只判 `.ok`」为口径澄清，不升格为阻断 ✓。
- D-14 已裁决「追踪号首次跨度落地时生成、不落 `state.json`」为口径澄清，不升格为阻断 ✓。

---

### F. 性能与副作用（D-16 ⑤ 必查）

`baseline-failures.txt` 第 1/2 行为两条 NFR-02 p95 用例，载体 `test/wp10/perf.test.js`（`readReview` / `verifyProducts({sha256:true})` p95 ≤ 50ms，1MB/5MB）。

```
$ NODE_ENV=test node --test test/wp10/perf.test.js
ok 1 - NFR-02: readReview p95 <= 50ms（1MB / 5MB 文档）
ok 2 - NFR-02: verifyProducts({sha256:true}) p95 <= 50ms（1MB / 5MB 文档）
# tests 2 ; # pass 2 ; # fail 0
```

单独复跑 **2/2 pass / 0 fail**，未出现超出基线 8 条失败集的新增失败（该两条在全量并发时为基线已知环境敏感失败，单独复跑通过符合 D-2 口径）。**未跑全量** `node --test "test/**/*.test.js"`（任务禁止）。

evidence 副作用核对（跑前 / 跑后 `shasum -a 256`）：

```
70aeb63e05dea0992efc6ae7d905317b7baa10a94904258518c3f9b1d38ef055  nfr-perf-atomic.json
3e1c84ff03cde9ef8b80230ec894b7f041b30002e8373afcfbe10fc8c60e822c  nfr-perf-batch.json
59c5dc7db688e239ef868681d2ebf2213e7d66b36edaac3554f0d99306a51739  nfr-perf-render.json
```

跑前跑后**三个哈希完全一致**，`git status --short docs/iterations/iteration-4/evidence/` 跑前跑后均为空 → **本次复跑未改写任何 evidence 文件，无需主控还原**。写入方是 `test/wp11/perf.test.js` 的 `putEvidence('nfr-perf-*.json')`（本次未跑，故未触发）。**副作用文件清单：空。**

需如实指出：NFR-02 测的是 `readReview` / `verifyProducts`，**不经过** `saveState` / `getStatus`，因此不直接覆盖 D-16 ⑤ 关注的「每次调用新增一次 `trace.readTraces` 异步读盘 + `computeHealth`」开销；该开销的实际影响在本报告 B 组已实测为进度轮询时序变化（见 F-01），建议主控在全量门禁中一并关注（见 S-06）。

---

### G. 门禁独立复跑（真实数字，不采信实现者表格）

| # | 命令 | 实跑结果 |
|---|---|---|
| 1 | `node --test test/wp9/i19-orchestrator.test.js` | **9 tests / 9 pass / 0 fail** |
| 2 | `node --test "test/wp9/**/*.test.js"` | **94 tests / 94 pass / 0 fail** |
| 3 | `node --test test/wp4/orchestrator.test.js` | **37 tests / 36 pass / 1 fail** |
| 4 | `node --test test/wp11/status-doc.test.js test/wp9/cli-e2e.test.js` | **16 tests / 16 pass / 0 fail** |
| 5 | `grep -c "object: 'session'" src/core/orchestrator.js` | **13**（≤13） |
| 6 | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` | **0** |
| 7 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | **OK: 扫描 24 个文件 … 零命中；exit 0** |

门禁 3 唯一失败：

```
not ok 33 - task-loop 审核提示词给绝对路径：基址与 readReview 同源，避免宿主写进实例工作区
  + actual   '/private/var/folders/.../out/review.json'
  - expected '/var/folders/.../out/review.json'
  code: 'ERR_ASSERTION'  location: test/wp4/orchestrator.test.js:1513
```

即 macOS `/private/var` 与 `/var` 符号链接差异，属 `baseline-failures.txt` **第 6 行**，按 D-2「失败集合差集 = 0」口径判**非回归**，不误报。其余各门均无新增失败。

---

## 3. 门禁实跑数字表

见 §2-G 表格（7 项）。补充：三主链两版退出码 `single 0/0`、`code-loop 4/4`、`task-loop 4/4`；两版 stdout 归一化逐字 diff：`single` 空、`code-loop` 空、`task-loop` **差 1 行**。

---

## 4. 阻断项清单

### F-01 · `task-loop` 主链在 WP-7 后稳定少一行 `会话 已升级`（三主链逐字回归差异）

- **现象**：方案① 两版真实运行 + A-0 可变值归一化后，`single` / `code-loop` 逐字 diff 为空，但 `task-loop` 归一化 diff 为 `6d5 < 会话 已升级`——基线 322fb5e 打印该进度行，当前工作区（含 WP-7）几乎不打印。
- **证据**：
  - 两棵树 `diff -rq` 仅 `src/core/orchestrator.js` 不同；`bin/`、`test/fixtures/`、`package.json` 逐字一致；夹具脚本与命令两版完全相同。
  - 单版各 5 次：基线 4/5、当前 0/5；**交替 6 对**：基线 6/6、当前 1/6；合计基线 10/11（≈91%）、当前 1/11（≈9%）。`code-loop` 交替 3 对两版 3/3 一致，说明差异仅落在 `task-loop` 升级路径。
  - 原始 diff 见 §2-B；`会话 已升级` 由 `src/cli/main.js:855-885` 的 `printSnapshot` 依 `snapshot.session.state==='escalated'` 打印。
  - 该行在基线本身即具时序 flaky（非 100% 稳定），但 WP-7 使其出现概率从 ≈91% 降到 ≈9%，是**方向明确、可重复、由 `orchestrator.js` 引起**的分布变化，非随机噪声。
- **影响哪个 AC**：**AC-03**（Then「三条主链的终端输出逐字一致，没有…任何文字或顺序变化」无法成立）；连带 **AC-19 / BR-18**「既有状态输出不回归」的「既有输出逐字不变」口径。任务判定口径明确「三主链逐字有差异」= 阻断、「若出现任何一行差异，判阻断」。
- **与已裁决项的关系（不属重新升格）**：D-16 ① 裁决的是 `saveState` 内 `await trace.readTraces` 的**代码结构正确性**（未改签名 / 未改 `trace.js` / 未把异步结果塞同步路径），并非对「输出逐字回归」的豁免；D-16 ⑤ 已把该新增读盘列为性能必查、⑥ 明确要求「补做一次真实三链输出比对」。本项正是按 ⑥ 补做后发现的真实差异，不在「已裁决不得升格」清单（D-14/D-15/D-16 ①②③/D-1/D-4/D-2/D-12）范围内。D-2 差集口径针对**测试失败集合**，不适用于 stdout 行。
- **修复方向**：让 WP-7 新增的异步调用不挤占 `run` 的进度轮询窗口——重点排查 `saveState`（`:450-479`）保存前 `await trace.readTraces(...) + computeHealth` 与 `quiesceSession`/`idleSession` 收尾新增的 `await writeExecutionSummary(...)` emit，二者改变了 `session escalated → idle` 状态在进度快照中可见的时序。目标是把 `task-loop` 该进度行的出现恢复到与 322fb5e 基线一致（≈基线概率、逐字可比），且不改 CLI 渲染、不放宽 AC-03 断言。建议主控结合 D-16 ⑤ 的性能优化方案一并裁决。

---

## 5. 建议项清单

- **S-01（D-16 ⑤ 性能必查结论 + 副作用文件清单）**：NFR-02 两条单独复跑 **2/2 pass / 0 fail**，无超出基线 8 条失败集的新增失败；`nfr-perf-atomic.json` / `nfr-perf-batch.json` / `nfr-perf-render.json` 跑前跑后 SHA-256 完全一致、git 无改动，**副作用文件清单为空，无需主控还原**。（若主控后续跑 `test/wp11/perf.test.js`，注意它会改写这 3 个文件并需还原。）另见 S-06：NFR-02 不经过 `saveState`/`getStatus`，不直接覆盖新增读盘开销。
- **S-02（数字不一致，以实跑为准）**：任务描述与主控表格写 `+221/-3`，实测 `git diff --numstat` 为 **`+218/-3`**（净增 215 = 5244−5029）。其余门禁数字（9/9、94/94、16/16、13、0、purity exit 0、wp4 37/36/1）与 D-16 ⑤ 主控复跑一致。
- **S-03（C 组夹具口径说明，非缺陷）**：C 组 S2 快照按需求 L390 只写最小 `escalations`（无 `reason`/轮次等字段），`instance status` 的升级行渲染出 `原因：?` / `节点：T-002 ?`，属渲染层对不完整快照的降级，非 WP-7 引入；AC-16 判据（健康度行、事件形状、CAS）不受影响。
- **S-04（评审临时产物）**：按要求 `git worktree add --detach /tmp/i19-wp7-baseline 322fb5e` 建立的基线工作树**保留未删、未在其中提交**；`/tmp/i19-wp7-*.mjs`（评审脚本）与 `/tmp/i19-wp7-*.stdout/.meta/.norm`（输出快照）为评审临时产物，均在 `os.tmpdir()` 下，不在仓库内。请主控按需清理。
- **S-05（夹具环境坑，非产品缺陷）**：macOS unix socket 路径 104 字节上限——评审夹具目录名过长（如 `maestro-wp7-sum-fail-tool-no-refs-*` = 113 字节）会触发 `ENOTSOCK: connect .../.orch/core.sock`，缩短 root 前缀后消失。这是评审脚本构造问题，与 WP-7 无关；后续验收脚手架建议统一用短项目根前缀。
- **S-06（性能与时序关联，供主控裁决）**：D-16 ⑤ 关注的 `saveState`/`getStatus` 每次新增 `trace.readTraces` 异步读盘 + `computeHealth`，虽未在 NFR-02 两条用例中产生新增性能失败，但 B 组实测其副作用体现在 `task-loop` 进度行时序（F-01）。建议主控在最终 HEAD 全量门禁时同时关注三链输出与 p95，不要只以「NFR-02 未新增失败」判定该开销无影响。

---

## 6. 结论

**FAIL（阻断 1 / 建议 6）**

- 阻断 1 条：**F-01** —— `task-loop` 主链在 WP-7 后稳定少一行 `会话 已升级`，三主链逐字回归（AC-03）不成立。
- 其余全部通过：A 组冻结红线与越界零改、`grep -c=13`、12 处存量发射点逐字未改且仍在发射、纯净/中文/依赖；C 组 `getStatus` 一次窄 CAS（未绕过 `transit()`、`rev` 基于磁盘现值递增）+ `health.changed` 形状/不重复/事件链复算；D 组 `execution.summary` 四项取值、缺项 `null`、成功/失败/取消三种收尾、每会话恰 1 条、AC-27 多轮、`ts` 单调与 `ts==stateSince`；E 组冻结窗口恰 3 条跨度、7 字段、无 `handoff_ids`、同一 `trace_id`、`HO-002` 不漏；F 组 NFR-02 无新增失败、evidence 无改写；G 组门禁数字全部符合（wp4 唯一失败属基线第 6 行，D-2 非回归）。
- 已裁决项（D-14 / D-15 / D-16 ①②③ / D-1 / D-4 / D-2 / D-12）均**未**重新升格为阻断。

---

## 7. 声明

本评审**未改任何产品代码 / 测试代码**，**未执行 `git commit` / `git add` / `git stash`**，未修改任何仓库内既有文件（含 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`，实测哈希跑前跑后一致）；仓库内**唯一写入为本报告 `docs/iterations/iteration-9/review-wp7.md`**。评审临时产物仅限 `os.tmpdir()` 下的夹具目录、`/tmp/i19-wp7-*.mjs` 脚本、输出快照，以及按任务要求保留的只读基线工作树 `/tmp/i19-wp7-baseline`（未删除、未提交）。所有数字与结论均来自本次独立实跑，未采信实现者自述表格。
