# I1.9 S2 批次 4（WP-7）修复版独立复评报告（R2）

> 复评 Agent：干净上下文独立复评（与实现者、首轮评审者分离），**只评审、不改任何产品代码 / 测试代码**。
> 复评时刻 HEAD：`322fb5e43a96739e89a571341495c84bfba4a159`（WP-7 修复仍在工作区，未提交）。
> 唯一写入：本报告 `docs/iterations/iteration-9/review-wp7-r2.md`。
> 复评窗口：`2026-11-12 01:05 ~ 01:33 CST`。

---

## 1. 复评范围与判据来源

### 1.1 本轮要复核的对象

| 项 | 内容 |
|---|---|
| 首轮结论 | `review-wp7.md` **FAIL（阻断 1 / 建议 6）**，唯一阻断 **F-01**：`task-loop` 主链稳定少一行 `会话 已升级` |
| 首轮 F-01 证据摘要 | 两树 `diff -rq` 仅 `src/core/orchestrator.js` 不同；单版各 5 次（基线 4/5、当前 0/5）；**交替 6 对（基线 6/6、当前 1/6）**；`code-loop` 交替 3 对两版 3/3；归一化后 `single`/`code-loop` diff 为空、`task-loop` 为 `6d5 < 会话 已升级` |
| 主控裁决 | `decisions.md` **D-17**：判阻断、打回；指定修复方向（消除 `saveState` 每次保存的 `await trace.readTraces + computeHealth`，`computeHealth` 集中到 `getStatus` 读取时执行）；冻结验收口径（**交替 ≥6 对 + A-0 归一化逐字 diff 为空**）；D-17 ⑦ 声明性能必查随之闭合 |
| 归属裁决 | **D-18**：`test/wp9/cli-e2e.test.js` 归 WP-8，不属本 WP |
| 本轮改动实测 | `src/core/orchestrator.js` **+215 / −3**（`git diff --numstat`），文件 5029 → **5241** 行；新增 `test/wp9/i19-orchestrator.test.js`（416 行）。注：首轮评审记录为 `+218/−3`（5244 行），本修复相对首轮版本**净减 3 行**（`saveState` 20 行读盘块 → 10 行同步透传），以本轮实跑为准 |

### 1.2 判据来源（均已自读）

- `docs/iterations/iteration-9/decisions.md` **D-17**（修复方向与验收口径）、**D-18**（cli-e2e 归属）、D-14/D-15/D-16/D-12/D-2/D-1/D-4（已裁决，不得重新升格）。
- `docs/iterations/iteration-9/requirement.md`：AC-03（三主链逐字）、AC-11~AC-18（健康度）、AC-19/BR-18（既有输出不回归）、AC-26/AC-27（取消 / 多轮摘要）、§3.3 L530-532（快照夹具时序、AC-16 两阶段夹具、AC-17 用 `dispatch-fail-first` 真实运行）、L56（健康度**不参与路由**，登记为基线偏差 U-4）。
- `src/core/health.js`（纯函数 `computeHealth`，`now` 注入）、`src/core/event-bus.js`（链式 `seq` / `prev_event_hash` / 首条 64 个 0）、`src/persistence/instance-store.js`（CAS `rev`）。
- `docs/iterations/iteration-7/baseline-failures.txt` 第 6 行（macOS `/private/var` 路径失败，D-2 差集口径判非回归）。

### 1.3 对照基线的有效性核对（不盲信现成资源）

```
$ git -C /tmp/i19-wp7-baseline rev-parse HEAD
322fb5e43a96739e89a571341495c84bfba4a159
$ git -C /tmp/i19-wp7-baseline status --short        # 空输出，工作树干净
$ diff -rq /tmp/i19-wp7-baseline/src  /Users/xuesh/www/Maestro/src
Files /tmp/i19-wp7-baseline/src/core/orchestrator.js and .../src/core/orchestrator.js differ
$ diff -rq /tmp/i19-wp7-baseline/bin  /Users/xuesh/www/Maestro/bin        # 无输出
$ diff -rq /tmp/i19-wp7-baseline/test/fixtures /Users/xuesh/www/Maestro/test/fixtures  # 无输出
$ diff /tmp/i19-wp7-baseline/package.json /Users/xuesh/www/Maestro/package.json        # 无输出
```

基线树为 `322fb5e` 只读工作树、干净；两树**唯一差异**仍是 `src/core/orchestrator.js`，`bin/`、夹具、`package.json` 逐字一致 → 三链输出差异可唯一归因于本 WP。
主控夹具 `/tmp/i19-wp7-chains.mjs` 已核对：每条链在 `os.tmpdir()` 下独立 `mkdtemp` 根、写 `.orch/hosts/mock.json`、`NODE_ENV=test`、`orch run --cwd . --host mock`，任务文本均含「产物：」行（`code-loop`→`calc.js`、`task-loop`→`release-notes.md`），符合产品既有校验。脚本可直接复用，无需重写。

---

## 2. F-01 闭合验证（核心）

### 2.1 主控夹具：交替 7 对 + 3 对自撰任务文本加固

命令（两树仅 `<REPO>` 不同，脚本、夹具、命令逐字一致）：

```
$ node /tmp/i19-wp7-chains.mjs /tmp/i19-wp7-baseline /tmp/r2-base-1
$ node /tmp/i19-wp7-chains.mjs /Users/xuesh/www/Maestro   /tmp/r2-cur-1
$ for i in 1..6:  node /tmp/i19-wp7-chains.mjs /tmp/i19-wp7-baseline /tmp/r2-p$i-base
                  node /tmp/i19-wp7-chains.mjs /Users/xuesh/www/Maestro   /tmp/r2-p$i-cur
```

任务文本（主控脚本原文）：

```
single    : 写一段流程说明
code-loop : 实现一个示例功能\n产物：calc.js
task-loop : 整理一份调研纪要\n产物：release-notes.md
```

**`task-loop` 的 `会话 已升级` 出现次数对照表（grep -c）**

| 对 | 基线 | 当前 | 归一化 diff（single / code-loop / task-loop） |
|---|---|---|---|
| 0（`r2-base-1`/`r2-cur-1`） | 1 | 1 | 0 / 0 / 0 |
| 1 | 1 | 1 | 0 / 0 / 0 |
| 2 | 1 | 1 | 0 / 0 / 0 |
| 3 | 1 | 1 | 0 / 0 / 0 |
| 4 | 1 | 1 | 0 / 0 / 0 |
| 5 | **0** | **0** | 0 / 0 / 0 |
| 6 | 1 | 1 | 0 / 0 / 0 |
| **合计** | **6/7** | **6/7** | **21 次比对全为 0** |

> 第 5 对两树**同时**缺该行（基线自身 flaky 的自然表现），两树**逐对取值完全相同**（7/7 对一致），这是比"总体出现率"更强的判据。`code-loop` 同 chain 亦有 1 次 `会话 已升级`，两树同样逐对一致（7/7 对均 1 vs 1）。

**加固：自撰 task 文本 3 对**（脚本 `/tmp/r2-chains-custom.mjs`，与主控脚本独立，仍保留「产物：」行）：

```
single    : 写一段部署流程说明，三步以内
code-loop : 在 lib.js 里实现 add 函数并让 node --test 通过\n产物：lib.js
task-loop : 为团队写一份季度复盘，含目标、结果与下季度计划\n产物：quarterly-review.md
```

| 加固对 | 基线 `task-loop` | 当前 `task-loop` | 归一化 diff（三链） |
|---|---|---|---|
| 1 | 1 | 1 | 0 / 0 / 0 |
| 2 | 1 | 1 | 0 / 0 / 0 |
| 3 | 1 | 1 | 0 / 0 / 0 |

**总计：主控夹具 7 对 + 自撰文本 3 对 = 10 对交替；`task-loop` 基线 9/10、当前 9/10，逐对一致；30 次归一化比对全部为 0 行。**

### 2.2 归一化口径与原始证据

归一化脚本 `/tmp/r2-normalize.mjs`（只替换 A-0 可变值，不掩盖任何文字）：

```
mock-sess-\d+-\d+  -> mock-sess-PID-SEQ
INST-\d+           -> INST-N
\d{2}:\d{2}:\d{2}  -> TIME
ISO 毫秒时刻        -> ISOTIME
已运行 \d+s / 耗时 \d+s -> 已运行 Ns / 耗时 Ns
\d+(\.\d+)?ms      -> Nms
```

**原始 diff（第 1 对，全部三链）——差异只有 A-0 可变值，无任何语义行差异：**

```
$ diff /tmp/r2-p1-base-task-loop.stdout /tmp/r2-p1-cur-task-loop.stdout
2c2
< 会话已创建 mock-sess-30894-1
---
> 会话已创建 mock-sess-31245-1

$ diff /tmp/r2-p1-base-code-loop.stdout /tmp/r2-p1-cur-code-loop.stdout
2c2  （同上，仅会话号）

$ diff /tmp/r2-p1-base-single.stdout /tmp/r2-p1-cur-single.stdout
2c2  （同上，仅会话号）
8,11c8,11
< 交接包 HO-001  已构造   01:08:33 ... 已完成   01:08:34
---
> 交接包 HO-001  已构造   01:08:45 ... 已完成   01:08:47
```

**归一化后：**

```
$ for c in single code-loop task-loop; do diff /tmp/r2-p1-base-$c.stdout.norm /tmp/r2-p1-cur-$c.stdout.norm; done
（三条链均无输出，diff_lines=0）
```

**当前树 `task-loop` 完整原文（第 1 对）：**

```
实例 INST-001 · 运行中 · 模板 通用任务闭环
会话已创建 mock-sess-31245-1
任务已投递
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 通用任务闭环
升级 ESC-001 待处理 · 节点 T-001 研究员 · 第 1 轮
下一步：orch escalate list --instance INST-001 查看升级；... 要终止请执行 orch cancel --instance INST-001
```

**与基线逐字对齐（含 `会话 已升级`）**。三链退出码两树一致：`single 0/0`、`code-loop 4/4`、`task-loop 4/4`。

### 2.3 F-01 判定

D-17 ⑤ 的验收口径是「**交替 ≥6 对** + 出现率与基线可比 + **A-0 归一化后三条链逐字 diff 为空**」。

- 交替 10 对（7 主控夹具 + 3 自撰文本），`task-loop` 出现率 **基线 9/10 = 当前 9/10**，逐对完全相同，**无显著低于基线**；
- `single` / `code-loop` / `task-loop` 归一化逐字 diff **全部为 0**（30 次比对）；
- 基线自身 flaky 的证据同步保留（第 5 对两树同时缺行），说明当前树已回到基线的分布，而不是"被修成 100%"的另一种偏离。

→ **F-01 闭合**。修复机制（`saveState` 不再读盘 + `getStatus` 在进度轮询窗口内跳过写路径，见 §3.1/§3.2）与输出恢复一致，且未改 CLI 渲染、未加 `sleep`、未放宽断言（`git status --short -- src/cli` 在当时为空，见 §3.4 的并发说明）。

---

## 3. 其余逐项独立验证（原始证据）

### 3.1 `saveState`：不再读盘、不再算健康度，CAS / `refreshWorkspaceStatus` 语义未变

`git diff` 直读（`src/core/orchestrator.js:446-465`）：

```js
  async function saveState(instanceId, state, opts) {
    if (state?.counters) {
      state.counters.eventSeq = Math.max(0, store.nextSeq(instanceId) - 1);
    }
    // Health is recomputed only on the read path (getStatus) ... No disk
    // read and no health computation happen here ...
    if (!state.health || typeof state.health !== 'object') {
      state.health = { nodeTimeoutMs: 30000 };
    } else if (!Number.isFinite(state.health.nodeTimeoutMs)) {
      state.health.nodeTimeoutMs = 30000;
    }
    const pending = opts ? store.save(instanceId, state, opts) : store.save(instanceId, state);
    const saved = await pending;
    if (saved?.ok) await refreshWorkspaceStatus(instanceId, state);
    return saved;
  }
```

逐项：

| 检查点 | 结果 | 证据 |
|---|---|---|
| 函数体内无 `computeHealth` | ✓ | 函数体（446-465）无该符号；全文件仅 `:4223` 一处调用（见 §3.3） |
| 函数体内无 `trace.readTraces` | ✓ | 同上；`readTraces` 仅出现在 `appendNodeSpan`（`:526`）与 `getStatus`（`:4220`） |
| `nodeTimeoutMs` 缺省 `30000` 补全语义保留 | ✓ | `if (!state.health ...) state.health = { nodeTimeoutMs: 30000 }`，且非有限值也回落 30000；`newState` 仍为 `health: { nodeTimeoutMs: 30000 }`（`:841`） |
| `store.save`（含 CAS `expectedState`）未改 | ✓ | 与基线 `git show 322fb5e:...` 的 saveState 逐字对照，仅多出上述**同步**补全 5 行；`opts → store.save(..., opts)` 一字未动 |
| `refreshWorkspaceStatus` 语义未变 | ✓ | 仍是 `if (saved?.ok) await refreshWorkspaceStatus(instanceId, state)` |

**新增异步 IO 检查（D-17 ⑦ / D-16 ⑤）**：`saveState` 的 `await` 仍只有 2 处（`store.save`、`refreshWorkspaceStatus`），与基线完全相同；新增的健康度补全是**同步字段赋值**，不产生新的挂起/读盘。→ 「每次保存不再新增异步 IO」成立，D-16 ⑤ 可判**闭合**（NFR-02 p95 复跑按 D-17 ⑦ 留 WP-9 末批，本轮只判"不再新增 IO"）。

### 3.2 `getStatus`：读取时按真实 `Date.now()` 重算，一次窄 CAS + 一条 `health.changed`

实现（`:4188-4263`）关键片段：

```js
    if (liveState || runWaiters.has(instanceId)) {
      return { ok: true, snapshot: snapshotOf(liveState ?? loaded.state) };
    }
    const at = Date.now();
    ...
    const computed = computeHealth({ state: healthState, graph: graphForState(healthState), traces: landedSpans, now: at });
    const prevLevel = typeof previousHealth.level === 'string' ? previousHealth.level : null;
    const firstWrite = prevLevel === null;
    const changed = prevLevel !== null && prevLevel !== computed.level;
    if (firstWrite || changed) {
      healthState.health = { ...nextHealth };
      const saved = await saveState(instanceId, healthState, { expectedState: expectedOf(healthState) });   // :4245
      if (saved?.ok && changed) { await makeEmitter(instanceId, null)({ object: 'health', ..., reason: 'health.changed', detail: { reasons: computed.reasons }, ts: writtenTs }); }
    }
```

`liveState || runWaiters` 分支是本次修复的**关键**：`run` 进行中的进度轮询（含 `waitForRun` 的终态查询）**不读盘、不写盘**，因此不再把 `escalated → idle` 的瞬时状态挤出 CLI 轮询窗口。该分支返回的仍是基线行为（`snapshotOf(liveState ?? loaded.state)`），未改变运行期输出。

**独立实跑（不经实现者测试）——按需求 §3.3 的 AC-16 两阶段夹具，直调 core `getStatus`**（脚本 `/tmp/r2-ac16.mjs`）：

```
PHASE1_read1: {"snap":{"level":"normal","reasons":[],"computedAt":"...13.178Z","nodeTimeoutMs":300000},
               "disk":{同 snap},"rev":1,"events":0,"md":["- 健康度：正常"]}
PHASE1_read2: {"disk":{level normal, computedAt 未变},"rev":1,"events":0}
  → 追加一条 escalations:[{escalationId:'ESC-001',nodeId:'T-002',state:'pending'}]（不改节点/会话）
PHASE2_read1: {"snap":{"level":"attention","reasons":["pending_escalation"],"computedAt":"...13.438Z","nodeTimeoutMs":300000},
               "disk":{同 snap},"rev":2,"event_delta":1,
               "events":[{"object":"health","objectId":"INST-001","from":"normal","to":"attention",
                          "result":"applied","reason":"health.changed",
                          "detail":{"reasons":["pending_escalation"]},"gen":"gen-1","seq":1,
                          "ts":"2026-11-11T17:31:13.438Z",
                          "prev_event_hash":"0000...0000"(64)}],
               "md":["- 健康度：需关注 · 有待处理升级"]}
PHASE2_read2and3: {"rev":2,"events":1}          ← 同档位重复读取：不写、不追加
SESSIONS_UNCHANGED: []  NODES: ["T-001:done","T-002:pending"]   ← AC-18 四组状态不变
```

再把升级改为 `resolved` 触发第二次档位变化：

```
THIRD_change level= normal delta= 1
EVENTS= [{"seq":1,"from":"normal","to":"attention","prev":"000000000000..."(64)},
         {"seq":2,"from":"attention","to":"normal","prev":"09e9368d7e41..."(64)}]
```

结论逐项：

| 判据 | 结果 |
|---|---|
| 读取时用真实 `Date.now()` 重算 | ✓ 三次读取的 `snapshot.health.computedAt` 各不相同（`...13.178Z` / `...13.438Z` / `...13.623Z`） |
| 首次（`level` 缺失）补写、**不**追加事件 | ✓ PHASE1：`rev 0→1`、`events=0`、`status.md=- 健康度：正常` |
| 档位变化：**恰一次**窄 CAS + **恰一条** `health.changed` | ✓ PHASE2：`rev 1→2`（+1），`event_delta=1` |
| 同档位重复读取不写、不追加 | ✓ read2 / read3：`rev`、`events` 均不变 |
| 事件形状 | ✓ `object:'health'`、`objectId`、`from`、`to`、`result:'applied'`、`reason:'health.changed'`、`detail.reasons` 为**纯码值数组** `["pending_escalation"]`（D-12，无中文）、带 `seq` / `ts` / 64 位 `prev_event_hash`；第二次事件 `prev_event_hash` 非全 0 → 已接链尾 |
| 未绕过 `transit()` | ✓ getStatus 走 `saveState(..., { expectedState: expectedOf(healthState) })`，与 `transit` 内 `saveState(instanceId, working, { expectedState: expected })` 同一封装；无直接 `store.save` |
| `nodeTimeoutMs` 透传 | ✓ `300000` 全程保留，未被 30000 覆盖 |

**CLI 级交叉验证**（`/tmp/r2-health.mjs`、`/tmp/r2-health-first.mjs`，先 `instance status` 拉起核心再写 `state.json`）：首次读取 `health.level` 由 `normal` 变 `attention`、`rev 0→1`、事件恰 1 条、`status.md` 为 `- 健康度：需关注 · 有待处理升级`、第 2/3 次读取不再增加；`level` 缺失场景 `rev 0→1` 但 `events=0`。

**已知现象时序说明**：本次复评**未**观察到"首次读取与核心启动对账 CAS 撞车导致静默跳过"（两次 CLI 夹具的首次读取均成功写入，`saved.ok===true` 且 `changed` 时正常发事件）。该现象在本轮样本中未复现，按任务说明不作为缺陷。

### 3.3 冻结红线

**a) `grep -c "object: 'session'"`**

```
$ grep -c "object: 'session'" src/core/orchestrator.js          → 13   (≤13 ✓)
$ git show 322fb5e:src/core/orchestrator.js | grep -c "object: 'session'" → 12
```

13 处行号：`482`（新增 `writeExecutionSummary` 共享辅助）+ 12 处存量 `1090 / 1132 / 1188 / 1219 / 1307 / 1398 / 1437 / 2209 / 2433 / 2452 / 3986 / 5101`。

**b) 12 处存量发射点逐字未改**

```
$ git diff -U0 src/core/orchestrator.js | grep -nE "^[+-].*object: 'session'"
34:+      object: 'session',        ← 仅此 1 行新增（共享辅助函数）
$ git diff -U0 src/core/orchestrator.js | grep -E "^-[^-]"      ← 全文仅 3 行删除
-    session.stateSince = iso();                          (quiesceSession，改为 const at = iso(); 复用)
-    session.stateSince = iso();                          (idleSession，同上)
-    return { ok: true, snapshot: snapshotOf(liveState ?? loaded.state) };   (getStatus 旧返回，被新读路径块替换)
```

12 个存量 `object:'session'` 所在 emit 块**零删除行**（全文删除总共 3 行，均不在 emit 块内）→ 逐字未改。实跑侧证：会话级事件仍实际发射（见下 c/d 的 `REASONS`）。

**c) `execution.summary` 每会话恰一条（真实 CLI / driver 实跑，非实现者测试）**

| 场景 | 会话数 | 摘要数 | 备注 |
|---|---|---|---|
| `--fail-tool`（`/tmp/r2-summary.mjs`） | 1 | **1** | 四项齐全 `{command:"node out/run.js",exitCode:1,keyOutputLines:3,logRef:"host-logs/T-001.log"}` |
| `--fail-tool-no-refs` | 1 | **1** | `keyOutputLines/logRef` 为 `null`，`command` 未被工具名冒充 |
| 成功收尾（`single`） | 1 | **1** | 四项全 `null` |
| 取消（live，`/tmp/r2-cancel.mjs`） | 1 | **1** | `orch cancel` 退出 0，四项全 `null`，终态 `cancelled`，会话 `idle/quarantined=true`，`REASONS=["session.state","run.cancelled","execution.summary"]` |
| 多轮（`code-loop-driver --scenario backflow-once` 跑完） | **4** | **4** | `rounds=[1,1,2,2]`、`nodes=[T-001,T-002,T-001,T-002]`、每会话唯一、`state=completed`、`ts_monotonic=true`、`seq=1..56` 连续 |

`SUMMARY_count_eq_sessions` 成立；`summaryWritten` 去重键为 `instanceId\0sessionId`，重复收尾（二次 `cancel`）不重复写（取消用例已由 9/9 门禁覆盖，且本轮 live 取消实跑为 1 条）。

**d) 跨度：7 字段 / 冻结窗口 3 条 / 无 `handoff_ids`（`/tmp/r2-spans.mjs`，`--stop-after 3 --scenario backflow-once`）**

```
SAW_stopped_after_3: true
SPAN_count: 3
SPAN_line: {"trace_id":"TRC-2d81f8f9","instance_id":"INST-001","node_id":"T-001","round":1,
            "start_time":"...17:15:58.328Z","end_time":"...17:15:59.629Z","status":"done"}
SPAN_line: {... "node_id":"T-002","round":1, ..., "status":"failed"}
SPAN_line: {... "node_id":"T-001","round":2, ..., "status":"done"}
SPAN_keys: 3 × ["end_time","instance_id","node_id","round","start_time","status","trace_id"]
SPAN_all_7: true ; SPAN_no_handoff_ids: true ; SPAN_no_running: true
SPAN_trace_ids: ["TRC-2d81f8f9"]（同一）
SPAN_node_round_order: ["T-001#r1","T-002#r1","T-001#r2"]
DERIVE_T001_r1: ["HO-001"] ; DERIVE_T002_r1: ["HO-001","HO-002"] ; DERIVE_T001_r2: ["HO-002"]
```

**e) 健康度不参与路由**

```
$ grep -rn "computeHealth" src/core/*.js src/cli/*.js src/daemon/*.js
src/core/health.js:111  (定义)
src/core/orchestrator.js:73   (import)
src/core/orchestrator.js:4223 (getStatus 内唯一调用)
```

`health` 在 orchestrator 内的全部引用（19 处）只落在 `newState` / `saveState` / `getStatus` 三块，调度、路由、`advance()`、`escalate` 判断均不读取 → 符合 requirement L56「不新增任何调度/路由行为改变」。

**f) 纯净扫描 / 依赖**

```
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "<31 词>"
OK: 扫描 24 个文件，... 零命中 ; exit 0
$ node -p "Object.keys(require('./package.json').dependencies||{}).length"
0
```

### 3.4 越界扫描（含一项必须上报的并发事实）

```
$ git status --short            (01:32:26 CST)
 M .workbuddy/memory/2026-11-09.md            ← 历史遗留，非 WP-7
 M docs/iterations/iteration-9/decisions.md   ← 主控裁决，非 WP-7
 M src/cli/main.js                            ← ★ WP-8（01:15:02 起出现）
 M src/core/orchestrator.js                   ← ★ WP-7
 M src/daemon/server.js                       ← ★ WP-8（01:15:14 起出现）
?? .workbuddy/memory/2026-11-10.md            ← 历史遗留
?? docs/iterations/iteration-9/review-wp7.md  ← 首轮评审报告
?? docs/iterations/regression-2026-11-09*     ← 历史遗留
?? test/wp9/i19-cli.test.js                   ← ★ WP-8（01:16:54 创建，01:23:21 仍在改）
?? test/wp9/i19-orchestrator.test.js          ← ★ WP-7 新建
```

**WP-7 自身改动恰为 2 个文件**：`src/core/orchestrator.js`（改）+ `test/wp9/i19-orchestrator.test.js`（新建）。

**必须如实上报的并发事实**：本复评开始（01:05）时的 `git status` **只有** `orchestrator.js` 与 `i19-orchestrator.test.js` 属于代码改动；`src/cli/main.js`、`src/daemon/server.js`、`test/wp9/i19-cli.test.js` 是在 **01:15:02 / 01:15:14 / 01:16:54** 由**并行的 WP-8 实现者**写入的（diff 内容为 `trace show` 命令、健康度状态行渲染等，正是 D-18/拆分文档中 WP-8 的负责文件），**不属于 WP-7 越界**。该并发不影响 WP-7 结论，但影响门禁聚合数字（见 §4）与提交时必须按精确路径 `git add`。

时间线核对（`ls -lT`）：`orchestrator.js` mtime `Nov 11 06:43`（WP-7 修复版，本轮复评全程未变）；三链交替跑全部在 `01:07:47 ~ 01:12:56` 完成，**早于** WP-8 首写（01:15:02），故 F-01 证据针对的是"仅含 WP-7 改动"的树。

---

## 4. 门禁实跑数字（真实数字，附时刻与归属）

| # | 命令 | 实跑结果 | WP-7 判读 |
|---|---|---|---|
| 1 | `node --test test/wp9/i19-orchestrator.test.js` | **9 tests / 9 pass / 0 fail** | ✓ |
| 2 | `node --test "test/wp9/**/*.test.js"` | **104 tests / 101 pass / 3 fail**（01:21） | 3 条失败**全部**位于 WP-8 并发新建的 `test/wp9/i19-cli.test.js`（`instance graph ... 健康度字段`、`instance log：A-12 摘要行 ...`、`instance log --format json ...`），创建于 01:16:54、仍在编辑；见下行剔除后的数字 |
| 2' | 上条剔除 `i19-cli.test.js`（= WP-7 态） | **94 tests / 94 pass / 0 fail**（01:23） | ✓ 与首轮 94/94 完全一致 |
| 3 | `node --test test/wp4/orchestrator.test.js` | **37 tests / 36 pass / 1 fail** | 唯一失败 `task-loop 审核提示词给绝对路径`（`/private/var` vs `/var`）= `baseline-failures.txt` 第 6 行，D-2 差集口径判**非回归** |
| 4 | `node --test test/wp11/status-doc.test.js test/wp9/cli-e2e.test.js` | **16 tests / 16 pass / 0 fail** | ✓（`cli-e2e` 按 D-18 属 WP-8，此处仅作聚合门禁） |
| 5 | `grep -c "object: 'session'" src/core/orchestrator.js` | **13** | ✓ ≤13 |
| 6 | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` | **0** | ✓ |
| 7 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | **OK：扫描 24 个文件，零命中；exit 0** | ✓ |

**关于第 3 项失败**：`wp4` 的 1 条失败与首轮一致，属基线允许集，非回归。
**关于第 2 项的 3 条失败**：不判为 WP-7 的"超出基线失败集的新失败"——它们既不在 WP-7 的文件清单内，也不在 WP-7 的改动面上（`test/wp9/i19-cli.test.js` 在本复评开始时并不存在），且失败断言指向 WP-8 尚未完成的 `instance log/graph` 健康度行视图。按 D-18 的归属划分，应由 WP-8 自己的批次门禁收口。

**未跑全量** `node --test "test/**/*.test.js"`（任务禁止）。本轮亦未运行 `test/wp11/perf.test.js`，故 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` **未被改写**（`git status --short docs/iterations/iteration-4/evidence/` 全程为空）。

---

## 5. 阻断项 / 建议项清单

### 阻断项

**无（阻断 0）。**

F-01 已按 D-17 ⑤ 的冻结口径闭合（10 对交替、逐对一致、30 次归一化比对全 0 行）；`grep=13`、12 处存量发射点逐字未改、CAS 未绕过 `transit()`、`execution.summary` 每会话恰一条、跨度 7 字段 / 冻结窗口 3 条 / 无 `handoff_ids`、健康度不参与路由、纯净扫描 exit 0、`dependencies={}` —— 全部成立；WP-7 改动仅 2 个文件；门禁无 WP-7 归属的新增失败。

### 建议项

- **S-01（工作区并发写入，必须由主控处理）**：本复评期间 WP-8 实现者同时改写了 `src/cli/main.js`、`src/daemon/server.js`、`test/wp9/i19-cli.test.js`（01:15:02 起，截至 01:32 仍在变动）。后果：①`test/wp9/**` 聚合门禁由 94/94 变为 104/101/3，3 条失败全在 WP-8 的半成品文件；②后续任何"全量门禁通过"结论必须在 WP-8 收口后重跑，不能引用本报告 §4 第 2 行；③提交 WP-7 时必须按精确路径 `git add src/core/orchestrator.js test/wp9/i19-orchestrator.test.js`，**不要** `git add -A`。本报告不将其计为 WP-7 越界。
- **S-02（数字口径）**：本修复版 `git diff --numstat src/core/orchestrator.js` = **`215 / 3`**（文件 5029 → 5241）。首轮评审记录为 `218 / 3`（5244 行），差异源于本次 `saveState` 从 20 行异步读盘块收敛为 10 行同步透传（净 −3 行），属预期收敛，不是实现者数字造假；但后续文书引用应以 `215 / 3` 为准。
- **S-03（`getStatus` 的 `liveState || runWaiters` 跳过分支是 AC-03 的承重墙，请登记）**：运行期轮询走"不读盘、不写盘"的快路径，运行期健康度**不重算**（返回 live 快照）。这与基线行为一致、也是 F-01 闭合的机制；但 AC-16/AC-17 的验收必须在"无运行中的核心 / 已结束实例"上执行（需求 §3.3 L530 已明确 AC-11/AC-16 用快照夹具），S3 取证时请勿在 `orch run` 进行中取"档位变化"。**若后续任何 WP 改动此分支（尤其 WP-8 的健康度渲染若改为依赖 `instance.get` 的写路径），F-01 会立刻回归**，建议在 `report.md` §5 与 WP-9 回归守护中登记该行。
- **S-04（取消后的 `state.json.health.level` 为 `null`，属 D-17 口径而非缺陷）**：live 取消实跑终态 `state=cancelled`，但磁盘 `health` 只有 `nodeTimeoutMs`、没有 `level`（因为写路径不再计算，且取消后未发生状态读取）。首次 `instance status` 读取时会补写 `ended` 且**不**追加事件。请 S3 在 AC-26 取证时按"读取后取档位"执行，不要直接断言取消瞬间的 `state.json.health.level`。
- **S-05（首轮 S-01..S-06 的处置状态）**：首轮 S-01（NFR-02 无新增失败 / evidence 未改写）本轮复述成立（本次未跑 `perf` 用例、evidence 零改动）；S-02 见本报告 S-02；S-03/S-05（夹具口径与 macOS socket 长度）为评审脚本问题，与本 WP 无关；S-04（保留 `/tmp/i19-wp7-baseline` 与 `/tmp/i19-wp7-*.mjs`）本轮继续保留，新增 `/tmp/r2-*` 脚本与快照同样在 `os.tmpdir()` 下，未进仓库；S-06（性能与时序关联）随 F-01 闭合与 `saveState` 去掉读盘而**解除**。
- **S-06（摘要在"升级挂起"会话上不产生，属既有语义）**：`task-loop` 的 `dispatch-fail-first` 类路径会话是 `idle → escalated`（`markEscalatedSession`），不经 `quiesceSession`/`idleSession`，故此刻没有 `execution.summary`（实测 `task-loop` 升级终态 `summary_count=0`、`sessions=1`）。这是"未收尾会话不出摘要"的既有语义（摘要随收尾产生），不是本次修复引入；登记以便 S3 在 AC-27 取证时只对"已收尾会话"断言"每会话恰一条"。

---

## 6. 结论

**PASS（阻断 0 / 建议 6）**

- **F-01 闭合**：交替 10 对（主控夹具 7 对 + 自撰任务文本 3 对），`task-loop` 的 `会话 已升级` 出现率基线 9/10、当前 9/10，**逐对完全一致**；`single` / `code-loop` / `task-loop` 的 A-0 归一化逐字 diff **30 次比对全部为 0 行**；基线自身 flaky（第 5 对两树同时缺行）被如实复现，当前树已回到基线分布而非被"修成 100%"。
- **修复机制核实**：`saveState`（`:446-465`）已无 `computeHealth` / `trace.readTraces`，只做同步 `nodeTimeoutMs` 透传，`store.save`（含 CAS）与 `refreshWorkspaceStatus` 语义逐字未变，**save 路径零新增异步 IO**（D-16 ⑤ 可判闭合）；`getStatus`（`:4188-4263`）在读取时用真实 `Date.now()` 重算，首次补写不发事件、档位变化恰一次窄 CAS + 恰一条 `health.changed`（形状、纯码值 `reasons`、`seq`/`prev_event_hash` 全合规）、同档重复读不写。
- 冻结红线与门禁全部成立；WP-7 改动恰 2 个文件，无越界；无 WP-7 归属的新增失败。
- 已裁决项（D-14 / D-15 / D-16 ①②③ / D-12 / D-2 / D-1 / D-4 / D-18）均**未**重新升格为阻断。
- 需主控注意的唯一非代码事项：**评审期间 WP-8 并行写入同一工作区**（S-01），提交与全量门禁需按精确路径与 WP-8 收口后重跑。

---

## 7. 声明

本复评**未修改任何产品代码 / 测试代码**，**未执行 `git commit` / `git add` / `git stash` / `git checkout`**，未在 `/tmp/i19-wp7-baseline` 中提交或修改文件，未改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`（本轮未运行该用例，evidence 目录 `git status` 全程为空）。仓库内**唯一写入为本报告 `docs/iterations/iteration-9/review-wp7-r2.md`**。评审临时产物仅限 `os.tmpdir()` 下的夹具目录与 `/tmp/r2-*.mjs`、`/tmp/r2-*` 输出快照，以及按要求保留的只读基线工作树 `/tmp/i19-wp7-baseline`（未删除、未提交）。所有数字与结论均来自本次独立实跑，未采信实现者或首轮评审的自述表格；与自述不一致处以本轮实跑为准（见 S-02）。

---

# 增量复评（D-19）

> 增量复评时刻：`2026-11-12 02:05 ~ 02:20 CST`，HEAD 仍为 `322fb5e`，改动仍未提交。
> 本节为**增量**：只复核 D-19 引入的三处改动及其影响，不重做 §1~§7 的全量核查（结论沿用上一轮 PASS）。

## 8. 增量范围与判据

- **D-19**（`decisions.md`）：**覆盖 D-14** —— AC-22 要求 A-10 首行带追踪号，但首条跨度未落地时 `state.json` 无号，故改为**实例创建时**落 `state.traceId`；`appendNodeSpan` 优先取 `state.traceId`，缺失才回落到「首条已落地跨度 → `newTraceId()`」；`instance.trace` 同样优先 `state.traceId`。不改 `trace.js`、不改附录 A 逐字基线。
- 本轮评审对象：`src/core/orchestrator.js` 与 `test/wp9/i19-orchestrator.test.js` 的增量。
- 判定口径：D-19 语义自洽 + 未弱化断言 + 零新增 IO/时序 + 三链不回归 + 门禁通过。
- 已裁决不得重升阻断：D-19（覆盖 D-14）、D-15、D-16、D-12、D-2、D-20/D-21/D-22（WP-8 侧）。

## 9. `git diff` 直读：改动确实只有这三处语义

**规模变化**：`git diff --numstat src/core/orchestrator.js` = **`221 / 3`**，文件 **5241 → 5247 行**（+6）。上一轮（D-19 前）为 `215 / 3` / 5241 行。

**机械证据（hunk 签名比对）**：全文 hunk 数仍为 **21**，除两个 hunk 外**每个 hunk 的行数与内容长度都与上一轮完全相同**，只是后续偏移统一 +6：

| hunk（旧 → 新） | 上一轮 | 本轮 | 判定 |
|---|---|---|---|
| `-447,0 +450,10`（saveState） | 10 | **10** | 一字未动 |
| `-455,0 +468,73` → `+468,78` | 73 | **78（+5）** | 仅 `appendNodeSpan` 内 traceId 选择逻辑 |
| `-755,0 +841` → `+846,2` | 1 | **2（+1）** | 仅 `newState` 追加 `traceId` |
| 其余 18 个 hunk | — | 行数全同，偏移 +6 | 未变（含 `getStatus` 的 `+4208,61`、摘要 `writeExecutionSummary`、`quiesceSession`/`idleSession`、6 处 `appendNodeSpan(...)` 调用点） |

**改动一：`newState`（`:846-847`）**

```diff
       sessions: [],
       handoffs: [],
       escalations: [],
+      health: { nodeTimeoutMs: 30000 },
+      traceId: trace.newTraceId(),
     });
```

相对 D-19 前仅新增 `traceId` 一行（`health` 是上一轮既有），追加在末尾；既有 18 个字段的**名称、取值与顺序逐字未变**。

**改动二：`appendNodeSpan`（`:524-534`）**（"旧"= 本 Agent 上一轮直读到的 r2 版本；该文件是工作区改动，`git show HEAD` 中尚无此函数，故以两轮直读对照）

```diff
     const { spans } = await trace.readTraces(store.root, ctx.instanceId);
     const firstId = spans.length > 0 ? spans[0]?.trace_id : null;
+    const stateId = typeof ctx.state?.traceId === 'string' ? ctx.state.traceId : '';
+    const traceId = stateId.length > 0
+      ? stateId
+      : (typeof firstId === 'string' && firstId.length > 0
+        ? firstId
+        : trace.newTraceId());
-    const traceId = typeof firstId === 'string' && firstId.length > 0
-      ? firstId
-      : trace.newTraceId();
     const span = {
       trace_id: traceId,
```

即：`state.traceId` 优先；缺失时才回落到"首条已落地跨度 → `newTraceId()`"。`readTraces` 仍只有这一处调用（未新增第二次读盘）。

**改动三：测试文件**（见 §10）。除此之外**无任何其他变更**：`saveState` 无 `computeHealth`、无 `trace.readTraces`（`:446-465` 逐字同上一轮）；`getStatus` hunk `+4208,61` 行数一致、内容未动；`writeExecutionSummary` / 三处收尾 / 取消路径 / 6 处 `appendNodeSpan` 调用点的时机**均未调整**（hunk 全同）。

## 10. 测试是否被弱化：没有

- 文件 416 → **445 行**（+29），用例 **9 → 10**（新增用例 1b）；`grep -n "\.skip\|\.todo"` **零命中**。
- 原有 9 个用例名称**逐一保留**（`:131 :194 :217 :267 :308 :329 :367 :408 :432`），断言体未删：用例 3（getStatus 一次窄 CAS / 恰一条 `health.changed`）、用例 7（3 条跨度 / 7 字段 / 无 `handoff_ids` / `HO-002` 推导）逐项仍在。
- 用例 1 **加强而非放宽**（严格键集，不是"包含"）：

```js
  const keys = Object.keys(readState(root));
  const frozen = ['schemaVersion', ..., 'escalations'];      // 18 项
  assert.deepEqual(keys.slice(0, frozen.length), frozen);
  assert.equal(keys[frozen.length], 'health');
  assert.equal(keys[frozen.length + 1], 'traceId');
  assert.equal(keys.length, frozen.length + 2, '顶层字段只多 health 与 traceId');
  assert.match(readState(root).traceId, /^TRC-[0-9a-f]{8}$/);
```

- 新增用例 1b（`:171`）：`--turn-delay-ms 30000` 让节点停在 `tool_running`，断言 `state.traceId` 形如 `TRC-xxxxxxxx` **且** `readTraces(root).length === 0` —— 正面证伪"由首条跨度反推"，断言强度足。
- 用例 7 追加（强等式，非包含）：

```js
  const state = readState(root);
  assert.match(state.traceId, /^TRC-[0-9a-f]{8}$/);
  assert.equal(spans[0].trace_id, state.traceId, '首条跨度复用创建时的 state.traceId（不是首条跨度反推）');
```

## 11. D-19 语义独立实跑（`/tmp/r3-traceid.mjs`）

**A) 创建号与落地跨度同值**（`code-loop-driver --scenario backflow-once --stop-after 3`）

```
A_state_traceId:      TRC-81dd60ee
A_span_trace_ids:     ["TRC-81dd60ee"]
A_equal_first_span:   true
A_all_spans_equal:    true
A_span_count:         3
```

**B) 首次派发前（节点 `tool_running`、无跨度）**

```
B_saw_tool_running:   true
B_state_traceId:      TRC-cd0a49c8   match_format: true
B_spans_before_landing: 0
```

即 AC-22 场景（有运行中节点、尚无已落地跨度）下 `state.json` 已有号，`trace show` 首行不再为空。

**C) 历史实例（手写 `state.json` 无 `traceId`、`traces.jsonl` 不存在）**

```
$ (cwd=<root>) node bin/orch.js trace show INST-001
实例 INST-001 · 暂无追踪记录
exit=0
C_state_after: traceId = undefined     ← 未被补写，回落语义生效
```

→ 仍走 A-1「暂无追踪记录」，不报错、不补写（符合 D-19「历史实例回落推导」）。
注：`orch trace show ... --cwd <dir>` 会被 CLI 判为未知参数（`trace` 子命令解析层，WP-8 侧），故 C 组以进程 `cwd` 指定根目录；此项**仅记录**，不下结论。

## 12. 零新增 IO / 零时序影响（判断依据）

| 判断点 | 证据 |
|---|---|
| `newState` 只多一次 `trace.newTraceId()` | `trace.js:22-24`：`TRC-${crypto.randomBytes(4).toString('hex')}` —— **同步、纯内存、无 fs / 无 await** |
| `appendNodeSpan` 未新增第二次 `readTraces` | 全文件 `grep -c readTraces` = **2**（`:525` appendNodeSpan、`:4226` getStatus），与 D-19 前一致；函数内仍只有最初那一次读盘，新增的只是**同步**变量选择 |
| 单一追踪号来源 | `grep -rn "newTraceId("` → 仅 `:847`（创建）与 `:532`（历史实例回落）；写入与展示取同一字段（`server.js:263-265` 已 `state.traceId` 优先，WP-8 侧） |
| `saveState` / `getStatus` 未动 | hunk 行数 `10` 与 `61` 与上一轮完全相同（§9 表） |
| 端到端时序 | 三链 2 对归一化 diff 全 0（§13），与"无时序变化"一致 |

**结论：D-19 不引入新的异步 IO、不改变任何保存/读取/收尾时序。**

## 13. 三主链逐字回归（增量 2 对）

```
$ node /tmp/i19-wp7-chains.mjs /tmp/i19-wp7-baseline /tmp/r3-p$i-base
$ node /tmp/i19-wp7-chains.mjs /Users/xuesh/www/Maestro   /tmp/r3-p$i-cur
```

| 对 | single diff | code-loop diff / `会话 已升级` | task-loop diff / `会话 已升级` |
|---|---|---|---|
| 1 | 0 | 0 / 基线 1、当前 1 | 0 / 基线 1、当前 1 |
| 2 | 0 | 0 / 基线 1、当前 1 | 0 / 基线 1、当前 1 |

退出码两树一致（`single 0/0`、`code-loop 4/4`、`task-loop 4/4`）。按主控口径「**当前不得低于基线**」：2 对均持平（1 vs 1），无退化；叠加上一轮 10 对的结论，F-01 仍闭合。

## 14. 门禁实跑（增量）

| # | 命令 | 实跑结果 |
|---|---|---|
| 1 | `node --test test/wp9/i19-orchestrator.test.js` | **10 tests / 10 pass / 0 fail**（上一轮 9/9，新增 1b） |
| 2 | `node --test "test/wp9/**/*.test.js"` | **107 tests / 107 pass / 0 fail**（WP-8 的 `i19-cli.test.js` 已转绿，上轮 3 条失败消失；含 WP-8 文件） |
| 2' | 剔除 `i19-cli.test.js`（WP-7 态） | **95 tests / 95 pass / 0 fail**（= 上轮 94 + 新增 1b） |
| 3 | `grep -c "object: 'session'" src/core/orchestrator.js` | **13**（≤13） |
| 4 | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` | **0** |
| 5 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | **OK：24 个文件零命中；exit 0** |
| 6 | 额外抽查 `node --test test/wp4/orchestrator.test.js` | **37 / 36 / 1**，唯一失败仍为基线第 6 行（`/private/var`），失败集未扩大 |

## 15. 增量结论

**D-19 增量 PASS（阻断 0 / 建议 4）**

- 三处改动与 D-19 描述**逐一对应**，无越界；`newState` 其余字段与顺序逐字未变；`saveState` / `getStatus` / 摘要与跨度写入时机均未动。
- 测试**未被弱化**（用例 9→10、无 skip、断言由"只多一个字段"加强为"恰多两个字段"、新增"创建即有号且跨度为空"与"跨度号 === state.traceId"两条强断言）。
- 实跑证实：创建号与 3 条跨度同值、运行中无跨度时已有号、历史实例回落 A-1 且不报错。
- 零新增 IO / 零时序影响；三链 2 对归一化 diff 全 0、`会话 已升级` 持平基线；门禁全绿。

### 增量建议

- **S-07（新实例 `state.json` 顶层键 18 → 20）**：`health` + `traceId` 使顶层键集固定为 20。已回归 `wp9` 95/95 与 `wp4` 37/36/1，无新增失败；但 WP-9 回归守护若做"精确键集"断言，需同步到 20 键。
- **S-08（历史实例永不补写 `traceId`）**：旧实例在产生新跨度前一直无稳定号（`trace show` 仍按 A-1 展示）；这是 D-19 的回落口径，非缺陷，建议在 `report.md` §5 与 S3 取证口径中登记一句。
- **S-09（用例 1b 名称笔误）**：`实例创建即有 state.traceId，且此早于任何跨度落地` 中"且此"应为"且它"，纯文案，不影响断言。
- **S-10（工作区仍含 WP-8 并行改动）**：本轮 `git status` 仍显示 `src/cli/main.js`、`src/daemon/server.js`、`test/wp9/i19-cli.test.js`（已转绿）。提交 WP-7 时仍须按精确路径 `git add src/core/orchestrator.js test/wp9/i19-orchestrator.test.js`，全量门禁以 WP-8 收口后的树为准。

### 增量声明

本增量复评**未修改任何产品代码 / 测试代码**，**未执行 `git commit` / `git add` / `git stash` / `git checkout`**，未改动 `/tmp/i19-wp7-baseline`；仓库内唯一写入仍为本报告（本节为追加）。新增临时产物 `/tmp/r3-traceid.mjs`、`/tmp/r3-p*` 快照均在 `os.tmpdir()` / `/tmp` 下，不进仓库。
