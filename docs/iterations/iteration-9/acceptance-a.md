# I1.9 S3 验收 · A 组（AC-01 ~ AC-14）

> 验收 Agent：S3-A（与实现者分离，只做取证；未改动 `src/**`、`test/**`、任何夹具、`package.json`）。
> 判据来源：`docs/iterations/iteration-9/requirement.md`（v7）AC-01~AC-14 全文 + 附录 A-0~A-14 + 附录 D；
> `docs/iterations/iteration-9/decisions.md` D-1~D-24（已裁决项不重复判失败）；
> `docs/iterations/iteration-9/progress.md`（S2 六批门禁）；`docs/iterations/iteration-7/baseline-failures.txt`。

## ① 验收范围与环境

| 项 | 值 |
|---|---|
| 仓库 HEAD | `40eb704`（S2 批次 6 收口，`git log --oneline -1` 实测） |
| 基线树（AC-03 对照） | `git worktree add --detach /tmp/acc9-baseline 322fb5e`（与 `review-wp7-r2` / D-17 ⑤ 同一基线）；取证完成后已 `git worktree remove`（复跑前需重新 add） |
| Node | `v22.22.2` |
| 夹具根 | `os.tmpdir()` = `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T`，统一在 `maestro-acc9a/<AC>/` 下每 AC 一个**独立目录**（绝不放进仓库） |
| 环境变量 | 所有命令 `NODE_ENV=test` |
| 宿主口径 | 一律 `--host mock`，`.orch/hosts/mock.json` 的 `launch.command/args` 指向仓库内 `test/fixtures/mock-acp-agent.js`（D-3） |
| 快照夹具顺序 | 先在空目录执行 `instance status INST-001`（返回「实例 INST-001 · 不存在」）再写 `state.json` / `traces.jsonl`（requirement §3.3，避免启动对账把 `running` 判成 `interrupted`） |
| 时间口径 | CLI 级只用安全余量（31s vs 30s、70s/30s vs P90 50s）；等值边界按需求下沉单元级（`test/wp12/health.test.js`，本次复核 32/32 通过） |
| 探针脚本 | `probe/acc9-a-lib.mjs`、`probe/acc9-a-chain.mjs`、`probe/acc9-a-regress.mjs`、`probe/acc9-a-taskloop-rate.mjs`、`probe/acc9-a-summary.mjs`、`probe/acc9-a-trace.mjs`、`probe/acc9-a-health.mjs`、`probe/acc9-a-ac57-probe.mjs`（只新增，未改既有文件；可复跑） |
| 证据根 | `docs/iterations/iteration-9/evidence/acc9/AC-01` … `AC-14` |

**复跑方式**（均在仓库根、`NODE_ENV=test`）：

```
node probe/acc9-a-chain.mjs     # AC-01 / AC-02
node probe/acc9-a-regress.mjs   # AC-03（需先 git worktree add /tmp/acc9-baseline 322fb5e）
node probe/acc9-a-summary.mjs   # AC-04 / AC-05
node probe/acc9-a-trace.mjs     # AC-06 ~ AC-10
node probe/acc9-a-health.mjs    # AC-11 ~ AC-14
```

---

## ② 逐 AC 判定表

| AC | 结论 | 证据路径（`evidence/acc9/` 下） | 判定依据（一句） |
|---|---|---|---|
| AC-01 事件日志只追加 | **PASS** | `AC-01/`（`captured-events.jsonl`、`final-events.jsonl`、`run-attempts.json`、`stdout-instance-log-json.txt`、`result.json`） | 边跑边抓 2 条事件（终态 16 条），追加后旧前缀字节完全相同、`seq` 1..16 严格递增无空洞、抓取时的旧记录与终态同位置记录规范化哈希逐一相等。 |
| AC-02 链式哈希 | **PASS** | `AC-02/`（`chain-verify.json`、两份 `--format json` 原文） | 两实例各 16 条事件，首条 `prev_event_hash` 均为 64 个 `0`、逐条 `prev == sha256(canonical(上一条))`、断点 0；INST-002 未引用 INST-001 的任何记录指纹。 |
| AC-03 三条主链逐字回归 | **PASS**（复验后） | `AC-03/`（每对 `*-base.txt` / `*-cur.txt`、`*-normalized.json`、`static-gates.txt`、`result.json`、`taskloop-rate-*.txt`；复验：`full-suite-r2.log`、`full-suite-r2-summary.txt`、`verdict-r2.json`、`rpc-test-solo-r2.log`、`cli-e2e-solo-r2.log`、`full-suite-r2-aborted.log`） | **Then 通过**：与 `322fb5e` 基线树交替对照 `single` 3/3、`code-loop` 3/3、`task-loop` 6/6 对 A-0 归一化 diff=0。**机检（复验 r2）通过**：`1157 tests / 1147 pass / 9 fail / 1 skipped`，基线 8 条全部命中，差集仅 C-2（单文件 4/4，D-2 允许的负载 flake）；上一轮确定性失败 AC-57 已由 D-27 消除（单文件 8/8）。详见「复验（D-25/D-26/D-27 之后）」。 |
| AC-04 失败摘要四要素 | **PASS**（复验后） | `AC-04/`（`stdout-trace-show.txt`、`stdout-instance-log.txt`、`stdout-instance-log-json.txt`、`instance-dir-files.txt`；复验：`stdout-trace-show-r2.txt`、`stdout-instance-log-json-r2.txt`、`result-r2.json`） | 跨度行 + `失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log` 逐字命中 A-4，`instance log` 命中 A-12、四项与 JSON 逐项相等；实例目录无完整日志副本。复验：D-25 后四项有值时该行**仍逐字渲染**（未把 A-4 打掉）。 |
| AC-05 摘要边界/缺项 | **PASS**（复验后） | `AC-05/`（`stdout-trace-show.txt`、`stdout-instance-log-json.txt`、`instance-dir-files.txt`；复验：`stdout-trace-show-r2.txt`、`result-r2.json`） | `--fail-tool-no-refs` 下命令与退出码照常、关键输出与日志渲染「未提供」，JSON 两项为 `null`；实例目录只有事件/快照/追踪/`status.md`，无 `.log`、无宿主日志副本。复验：D-25 后部分缺项仍渲染一行（只有四项全 `null` 才抑制）。 |
| AC-06 跨度 7 字段 | **PASS** | `AC-06/`（`traces.jsonl`、`state.json`、`stdout-trace-show.txt`） | `code-loop` 两节点正向跑完（现场用 driver `pass` 场景，见 §④ 现场偏差说明），`state/traces.jsonl` 两条跨度各恰 7 字段、`trace_id` 与 `state.traceId` 相同、两条都带结束时刻与 `交接 HO-001`。 |
| AC-07 回流链按轮次 | **PASS** | `AC-07/`（`traces.jsonl`、`stdout-trace-show.txt`、`result.json`） | `backflow-once` 完整跑完：4 条跨度（`T-001` ×2、`T-002` ×2，`round` 1/1/2/2），回流链恰 1 行 `第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成`；`HO-003` 为 `retest` 未计入。注：`T-002 r1` 失败跨度下方同样有那行「失败摘要（未提供）」，但 AC-07 的 Then 不要求与 A-3 整份逐字，故不影响本 AC 判定（对照见 §③-2）。 |
| AC-08 规划验收①/A-3 逐字 | **PASS**（复验后） | `AC-08/`（`trace-after-fix.txt`、`result-r2.json`、`execution-summary-events-r2.json`、`traces.jsonl`；修复前：`stdout-trace-show.txt`、`result.json`） | 冻结窗口 `--stop-after 3` 重跑：输出 9 行内容（含末行换行共 10 段）与附录 A-3 **逐字全等**，不再出现「失败摘要」行（D-25）；数据侧该跨度确有 `execution.summary` 且四项全 `null`，证明抑制按数据而非丢记录。 |
| AC-09 追踪三形态 | **PASS**（复验后） | `AC-09/`（`stdout-empty.txt` / `stdout-single.txt` / `stdout-missing.txt`、`fixtures.json`；复验：`stdout-empty-r2.txt`、`stdout-single-r2.txt`、`stdout-deleted-traces-r2.txt`、`stdout-hold-session-r2.txt`、`result-r2.json`、`result-ac22-r2.json`） | A-1 逐字 + 退出 0；A-2 逐字（追踪号 / `跨度 1 条 · 回流 0 次` / 一条跨度 / `回流链`+`无`）；A-5 逐字 + 退出 1 + stderr 无堆栈。复验：D-26 后空态只看跨度数组——空实例仍 A-1、删追踪文件的当前代码实例也 A-1（不再输出 `TRC-xxx / 跨度 0 条`），真实 running 节点仍 A-10 且首行带号。 |
| AC-10 追踪只读 | **PASS** | `AC-10/`（三份 `stdout-trace-*.txt`、`sha256-before-after.json`） | 三次 stdout 字节一致；`state.json` / `events.jsonl` / `traces.jsonl` 的 sha256 前后完全相同，事件条数不变，节点/会话/交接包/升级/健康度深比较相等。 |
| AC-11 健康度 🟢 正常 | **PASS** | `AC-11/`（`stdout-instance-status.txt`、`status.md`、`state.json`） | 无异常快照（`nodeTimeoutMs=300000`、无 running 节点）下，实例状态行之后第 2 行为 `健康度 正常`（无原因），`status.md` 为 `- 健康度：正常`，元数据 `level=normal`。 |
| AC-12 健康度 ⚪ 已结束 | **PASS** | `AC-12/`（`stdout-real-completed.txt`、`terminal-states.json`、`status-md-real-completed.md`） | 真实跑完 `single` 显示 `健康度 已结束`；另用四个终态快照（各带历史 `expired` 交接包 + `pending` 升级）复验，`已完成/失败/已取消/已中断` 全部为 `健康度 已结束`。 |
| AC-13 健康度 🔴 六夹具矩阵 | **PASS** | `AC-13/`（`stdout-<fixture>.txt`、`snapshot-<fixture>.json`、`unit-health-test.log`、`result.json`） | 六个独立夹具各只放一种红条件，六条健康度行与 A-6 附逐字相等、每次只显示「需关注」一档；等值边界引用 `test/wp12/health.test.js`（30000 不命中 / 30001 命中）。 |
| AC-14 健康度 🟡 超 P90 | **PASS** | `AC-14/`（`stdout-INST-00{1,2,3}.txt`、`snapshots-and-p90.json`、`unit-health-test.log`） | 三实例：5 样本 P90=50s + 运行 70s → `健康度 慢 · 节点 T-006 执行超过本实例 P90`；30s → `健康度 正常`；4 样本 + 70s → `健康度 正常`；等值边界引用 `health.test.js`（50000 不命中 / 50001 命中）。 |

### 取证时间戳（各 AC 的证据生成时刻，UTC）

| AC | 时间 | AC | 时间 | AC | 时间 | AC | 时间 |
|---|---|---|---|---|---|---|---|
| AC-01 | 2026-11-11T19:50:53Z | AC-02 | 2026-11-11T19:51:02Z | AC-03 | 2026-11-11T19:56:37Z | AC-04 | 2026-11-11T19:59:39Z |
| AC-05 | 2026-11-11T19:59:44Z | AC-06 | 2026-11-11T20:19:03Z | AC-07 | 2026-11-11T20:19:17Z | AC-08 | 2026-11-11T20:19:28Z |
| AC-09 | 2026-11-11T20:19:36Z | AC-10 | 2026-11-11T20:19:47Z | AC-11 | 2026-11-11T20:05:39Z | AC-12 | 2026-11-11T20:05:48Z |
| AC-13 | 2026-11-11T20:06:05Z | AC-14 | 2026-11-11T20:06:09Z | — | — | — | — |

> AC-03 的机检（全量）另在 2026-11-11T20:09Z ~ 20:14Z 完成（`AC-03/full-suite-summary.txt`）；AC-57 差分取证 `AC-03/ac57-events.json` 在 20:17Z 生成。

### 关键行原文

**AC-01**（`AC-01/run-attempts.json` + `result.json`）

```
{ "attempt": 0, "capturedLines": 2, "finalLines": 16, "capturedAt": "2026-11-11T19:50:52.476Z" }
"追加后旧行前缀字节完全一致" ok=true（capturedBytes=565, finalBytes=4963）
"seq 严格递增且无空洞" detail.seqs = [1,2,…,16]
```

**AC-02**（`AC-02/chain-verify.json`）

```
chain1 { n: 16, breaks: [], firstHash: "0000000000000000…" }
chain2 { n: 16, breaks: [], firstHash: "0000000000000000…" }
crossRefs: []
```

**AC-03**（`AC-03/result.json` + `full-suite-summary.txt`）

```
[Then / 三链逐字]  single      diffs [[],[],[]]   exit base [0,0,0] cur [0,0,0]
                  code-loop   diffs [[],[],[]]   exit base [4,4,4] cur [4,4,4]
                  task-loop   diffs [[],[],[],[],[],[]]  upgradeHits base 6 cur 6  exit base/cur 均 4
[静态门禁]         static-gates.txt：dependencies=0；purity-check exit 0（24 文件零命中）

[机检 / 全量]      # tests 1154  # pass 1143  # fail 10  # skipped 1
                  not ok 446  - AC-57：…（实际 9 行 / 期望 8 行）
                  not ok 1040 - C-2 端到端：tool_running 的 status 会话行含"已运行 Ns"（N>0）
                  其余 8 条与 baseline-failures.txt 逐条对应

[AC-57 多出的事件]  "diskReasons": [… "run.cancelled", "execution.summary"]
                  extraEvents[0] = { object:"session", objectId:"sess-001", result:"note",
                                     reason:"execution.summary",
                                     detail:{ nodeId:"T-001", round:null,
                                              summary:{command:null,exitCode:null,keyOutputLines:null,logRef:null} } }
[因果确认]         /tmp/acc9-baseline（322fb5e）单跑 test/wp11/rpc.test.js → 8/8 通过；
                  当前树单跑同一文件 → 7/8（同一条失败），故与 I1.9 新增事件直接相关。
```

**AC-04**（`AC-04/stdout-trace-show.txt` / `stdout-instance-log.txt`）

```
03:58:48 → 03:58:50  T-001  失败  交接 HO-001
  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log

03:58:50  会话 mock-sess-28831-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log
```

**AC-05**（`AC-05/stdout-trace-show.txt`）

```
03:59:01 → 03:59:03  T-001  失败  交接 HO-001
  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 未提供 · 日志 未提供
JSON: "summary": { "command": "node out/run.js", "exitCode": 1, "keyOutputLines": null, "logRef": null }
```

**AC-06**（`AC-06/stdout-trace-show.txt`）

```
实例 INST-001 · 追踪 TRC-8f1ff910
跨度 2 条 · 回流 0 次

04:00:24 → 04:00:25  T-001 开发  已完成  交接 HO-001
04:00:26 → 04:00:27  T-002 测试  已完成  交接 HO-001

回流链
无
```

**AC-07**（`AC-07/stdout-trace-show.txt`）

```
跨度 4 条 · 回流 1 次
…
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

**AC-08**（`AC-08/stdout-trace-show.txt`，逐字与 A-3 的差异已标出）

```
实例 INST-001 · 追踪 TRC-dafc28f9
跨度 3 条 · 回流 1 次

04:01:56 → 04:01:57  T-001 开发  已完成  交接 HO-001
04:01:58 → 04:02:00  T-002 测试  失败  交接 HO-001 HO-002
  失败摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供     ← A-3 中没有这一行
04:02:00 → 04:02:02  T-001 开发  已完成  交接 HO-002

回流链
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

**AC-09**（`AC-09/`，修复前首轮取证）

```
stdout-empty.txt:   实例 INST-001 · 暂无追踪记录        （exit 0）
stdout-single.txt:  实例 INST-001 · 追踪 TRC-…
                    跨度 1 条 · 回流 0 次
                    HH:MM:SS → HH:MM:SS  T-001  已完成  交接 HO-001
                    回流链
                    无                                   （exit 0）
stdout-missing.txt: 实例 INST-999 · 不存在               （exit 1，stderr 空）
```

**AC-10**（`AC-10/sha256-before-after.json`）

```
state   before == after  dc0c26b5f59839df…
events  before == after  3ef41aa15f982cf3…
traces  before == after  8452e0a2f0854ae3…
```

**AC-11**（`AC-11/stdout-instance-status.txt`）

```
实例 INST-001 · 运行中 · 模板 编码闭环
健康度 正常
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s
节点 T-002 测试 待执行
```

**AC-12**（`AC-12/terminal-states.json`）

```
completed   INST-001 → 健康度 已结束   首行 实例 INST-001 · 已完成
failed      INST-002 → 健康度 已结束   首行 实例 INST-002 · 失败
cancelled   INST-003 → 健康度 已结束   首行 实例 INST-003 · 已取消
interrupted INST-004 → 健康度 已结束   首行 实例 INST-004 · 已中断 ｜ 停在节点 已完成 / 会话 -
```

**AC-13**（`AC-13/result.json`，六行逐字）

```
健康度 需关注 · 有待处理升级
健康度 需关注 · 节点 T-001 执行超时
健康度 需关注 · 会话 mock-sess-12345-1 崩溃
健康度 需关注 · 角色 开发 不可用
健康度 需关注 · 连接线 测试→开发 已拒绝
健康度 需关注 · 连接线 测试→开发 已过期
```

**AC-14**（`AC-14/result.json`）

```
INST-001（5 样本、运行 70s）→ 健康度 慢 · 节点 T-006 执行超过本实例 P90
INST-002（5 样本、运行 30s）→ 健康度 正常
INST-003（4 样本、运行 70s）→ 健康度 正常
```

### 单元级等值边界引用（AC-13 / AC-14）

需求 v7 明确「恰好等于阈值的等值边界一律下沉到单元级」，本次按引用取证（并复核该文件 32/32 全绿，日志见 `AC-13/unit-health-test.log`、`AC-14/unit-health-test.log`）：

| 归属 | 用例名（`test/wp12/health.test.js`） | 断言原文 |
|---|---|---|
| AC-13 节点超时 | `node timeout: now - startedAt = 30000 (exact) -> NOT node_timeout` | `assert.strictEqual(level, normal)`；`assert.ok(!reasons.includes(node_timeout))` |
| AC-13 节点超时 | `node timeout: now - startedAt = 30001 -> node_timeout` | `assert.deepStrictEqual(reasons, [node_timeout])` |
| AC-14 P90 等值 | `P90: 5 samples -> P90 = 50000; node duration = 50000 (exact) -> NOT p90_exceeded` | `assert.strictEqual(level, normal)`；`assert.ok(!reasons.includes(p90_exceeded))` |
| AC-14 P90 等值 | `P90: node duration = 50001 -> p90_exceeded` | `assert.deepStrictEqual(reasons, [p90_exceeded])` |
| AC-14 最小样本 | `P90: 4 samples (< 5) -> p90_exceeded never triggers even with a long node` | `assert.strictEqual(level, normal)` |

> 未在 CLI 级构造「恰好等于」的理由：真实时钟读取时 δ>0 必把「恰好」推成「严格大于」（需求 §3.3 / B-3 已裁决），CLI 级只能用 31s / 70s / 30s 这类安全余量。

---

## ③ 失败或存疑清单

> **状态更新（2026-11-11T21:20Z）**：下列 2 项已由主控裁决 D-25 / D-26 / D-27 修复并复验 **PASS**。本节原文保留作为首轮验收的历史记录，复验结论与证据见「复验（D-25/D-26/D-27 之后）」。

| # | 编号 | 现象 | 影响 | 建议（需主控裁决） |
|---|---|---|---|---|
| 1 | **AC-03**（机检） | 全量 `node --test "test/**/*.test.js"` 为 **1154 tests / 1143 pass / 10 fail / 1 skipped**；基线 `baseline-failures.txt` 8 条全部命中，另多 2 条：①`test/wp11/rpc.test.js:346`「events.jsonl 行数应为 8，实际 9」——单跑稳定复现，第 9 条为 `object:session / objectId:sess-001 / result:note / reason:execution.summary`（四项 `null`）；同一测试在基线树 `322fb5e` 上 8/8 通过。②`test/wp9/cli-e2e.test.js:176` C-2——单文件复跑 4/4 通过，为全量并行负载下采样越过 4s `tool_running` 窗口的 flake。 | AC-03 的三条主链 Then（逐字 diff=0）本身通过；不通过的是**机检**「失败集合差集 = 0」，属 S2 收口时未跑全量留下的缺口。 | ① 第 9 条事件是 **I1.9 按 BR-04 / AC-26 必须新增**的取消摘要（取消也是会话收尾），不是实现越权；② 该测试的硬编码 `EXPECTED` 8 条在 I1.9 后已过时，D-8 的「断言修改清单」未包含 `test/wp11/rpc.test.js`，验收侧无权改测试。请主控裁决：(a) 把该用例期望扩到 9 条并补 `execution.summary` 断言（推荐，与 AC-24「会话级新增记录只有 execution.summary」一致）；(b) 若认为取消会话不应写摘要，则与 BR-04/AC-26 冲突，需同时改需求。C-2 建议按 D-2 的 flake 口径处理（单跑通过，且非 I1.9 引入）。 |
| 2 | **AC-08** | 冻结窗口 `orch trace show` 比附录 A-3 **多一行** `  失败摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供`（位于 `T-002 测试 失败` 跨度行下方）。其余 9 行（头、汇总、3 条跨度、空行、回流链标题、`第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成`）逐字一致；`--stop-after 3` 冻结点、3 条已完成跨度、无进行中行均成立，两次复跑结果一致。 | AC-08 的 Then 是「输出与附录 A-3 逐字一致」，该行使其**逐字不成立**，故判 FAIL。但这不是格式漂移： | 冲突根因是**需求内部判据冲突**，不是实现缺陷：① AC-04 Then / 附录 A-4 / BR-04 要求「失败的那一轮在追踪里表现为该跨度下方多出一行摘要」；② 附录 A-3 的基线里没有这一行，AC-08 Then 又要求与 A-3 逐字一致。③ 实现按 D-22「摘要仅在跨度 `status === 'failed'` 时附着」执行，本夹具的 `T-002` 会话确有 `execution.summary`（四项均 `null`，因 mock 场景不上报 execution），因此渲染「未提供」。**请主控二选一**：(a) 修订附录 A-3（补该摘要行）并同步 AC-08 Then —— 推荐，与本迭代「失败可解释」的目标一致；(b) 改实现：四项全 `null` 时不渲染失败摘要行（会与 A-4「未提供不省略」相抵，且需改 `main.js` / 判据）。**不建议**由验收侧放宽 A-3 比对。 |

> 其余 12 条 AC 无失败项、无存疑项。

---

## ④ 证据分级统计

| 分级 | 含义 | AC |
|---|---|---|
| 已实测（真实核心 + CLI） | `bin/orch.js` 拉起真实核心、真实 mock 宿主进程、真实文件落盘，读用户可见 stdout | AC-01、AC-02、AC-03、AC-04、AC-05、AC-06、AC-07、AC-08、AC-09（A-2/A-5）、AC-10、AC-11、AC-12（真实 run 部分）、AC-13、AC-14 |
| 全量实跑（AC-03 机检） | `node --test "test/**/*.test.js"` 一次跑完，与 `baseline-failures.txt` 逐条对账 | AC-03（`full-suite.log` / `full-suite-summary.txt`；`result.json` 只覆盖三链子集，综合判定见 `verdict.json`） |
| 单元级（引用） | 纯函数 `computeHealth({ state, now })` 注入固定 `now` 的等值边界 | AC-13、AC-14（各 2 条等值边界，需求明示不下沉 CLI） |
| 构造快照（CLI 级实测渲染） | 按 AC 自身夹具要求直接写 `state.json` / `traces.jsonl`，再走真实 CLI 渲染 | AC-09（A-1 空实例）、AC-11、AC-12（四终态复验）、AC-13、AC-14 |
| 阻塞 | — | 0 |

**构造快照的理由**（按要求逐项写明）：

- **AC-09 空追踪**：AC-09 夹具原文即「直接写 `state.json`（`state:'created'`、节点 `pending`、无 `traces.jsonl`），不派发节点」。
- **AC-11 / AC-12 终态 / AC-13 / AC-14**：需求 §3.3「健康度矩阵夹具」明确要求用「只含该条件的实例快照」构造，并规定启动顺序（先起核心再写快照）；真实运行会顺带产生第二条原因（例如升级会话同时触发崩溃/角色不可用），无法逐字命中单行。
- **AC-12 的「已完成」分支**另有真实运行取证（`single` 跑完 → `健康度 已结束`），快照只用于补 `failed / cancelled / interrupted` 三个不易构造的终态。

**现场偏差说明**（改用等价现场，判据未放宽）：

- **AC-06 / AC-10 的两节点正向实例**改用仓库内既有驱动 `test/fixtures/code-loop-driver.mjs --scenario pass`（`code-pass` 别名），而不是 AC-06 夹具原文的裸 `orch run --template code-loop`。理由：裸 mock 不产出 `calc.js`，`T-001` 会在产出校验处失败并直接收尾（实测 `AC-03/code-loop-pair0-cur.txt`：`节点 T-001 开发 已升级`、`实例 · 已挂起`），拿不到「开发 → 测试都完成」的两条跨度。驱动仍是真实核心 + 真实 CLI + 真实 mock 宿主，只是把宿主侧产出脚本换成既有场景；AC-10 的只读判据与跨度条数无关，同样用该场景。
- **AC-07 / AC-08 的司机口径**按需求 §3.3 固定为 `code-loop-driver.mjs --scenario backflow-once`（AC-08 另加 `--stop-after 3 --keep`，后台启动 + 轮询 `.mock/stopped-after-3`，断言后写 `.mock/release` 并 `SIGINT`）。

---

## ⑤ 未覆盖项与理由

| 项 | 理由 |
|---|---|
| AC-15 ~ AC-27 | 属 B 组验收范围，不在本组（A 组 AC-01~AC-14）内；本次未取证、未判定。 |
| `orch trace show` 的 JSON 输出 / OpenTelemetry 导出 | 需求 §1.3 明确范围外（U-6 / I1.12），无判据。 |
| 真实 DSH 宿主的日志格式 | 需求 §1.3 范围外（B 类零 DSH 验收、U-2），本迭代按 mock 取证。 |
| 两次以上回流的合并不覆盖 | 需求 U-8 已登记「无夹具、不阻塞」，AC-07 只断言一次回流下的同节点两轮。 |
| 健康度参与路由决策 | U-4 已由主控豁免（D-1），不在本迭代判定范围。 |
| 既有 12 处逐条会话事件的清退 | U-7 已由主控豁免（D-1），清退归 I1.12。 |

---

## 复验（D-25/D-26/D-27 之后）

> 触发：主控裁决 **D-25**（失败摘要行四项全 `null` 时不渲染）、**D-26**（空态判定改为「跨度数组（含进行中叠加）非空」）、**D-27**（`test/wp11/rpc.test.js` AC-57 期望 8 → 9 条）。
> 代码状态：HEAD `40eb704` + 工作树修复（`git status`：`src/cli/render.js` +14/−3、`test/wp9/i19-render.test.js` +66、`test/wp11/rpc.test.js` +9/−1）；验收侧未改任何产品/测试代码。
> 复验探针：`probe/acc9-a-reverify.mjs`（新增，仅调用产品 CLI 与 driver）；命令 `NODE_ENV=test node probe/acc9-a-reverify.mjs`，2026-11-11T20:42:59Z ~ 20:43:35Z，5/5 子项通过。
> 环境：夹具根 `os.tmpdir()/maestro-acc9a/*-r2`、`NODE_ENV=test`、`--host mock`（D-3）。

### 1. AC-08（附录 A-3 逐字）—— PASS

| 项 | 结果 |
|---|---|
| 冻结窗口 | `.mock/stopped-after-3` 出现；3 条已结束跨度（`T-001:1` / `T-002:1` / `T-001:2`），无进行中 |
| 输出结构 | 9 行内容（stdout 以换行结尾，`split('\n')` 得 **10 段**） |
| 逐字比对 | 与附录 A-3 **9/9 行全等**（A-0 归一化后），`a3Exact = true` |
| 失败摘要行 | 0 条（D-25 生效） |
| 数据侧反证 | 该实例确有 `execution.summary` 记录且四项全 `null`（`AC-08/execution-summary-events-r2.json`）——抑制按数据，不是记录丢失 |

关键原文（`AC-08/trace-after-fix.txt`）：

```
实例 INST-001 · 追踪 TRC-1fb42941
跨度 3 条 · 回流 1 次

04:43:02 → 04:43:04  T-001 开发  已完成  交接 HO-001
04:43:04 → 04:43:06  T-002 测试  失败  交接 HO-001 HO-002
04:43:07 → 04:43:08  T-001 开发  已完成  交接 HO-002

回流链
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

### 2. D-25 未打掉 AC-04 / AC-05 —— 均 PASS

AC-04（`--fail-tool`，四项有值）仍逐字渲染 A-4：

```
04:43:12 → 04:43:14  T-001  失败  交接 HO-001
  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log
```

AC-05（`--fail-tool-no-refs`，命令与退出码有值、另两项缺）仍渲染部分缺项行：

```
04:43:18 → 04:43:19  T-001  失败  交接 HO-001
  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 未提供 · 日志 未提供
```

两例均「仅 1 条失败摘要行」，`instance log` 的 A-12 四项与 JSON 不变（`AC-04/result-r2.json`、`AC-05/result-r2.json`）。

### 3. AC-09 / AC-23(missing)（D-26）—— 均 PASS

| 场景 | 实测输出 | 结论 |
|---|---|---|
| 空实例（快照夹具） | `实例 INST-001 · 暂无追踪记录`（exit 0） | A-1 ✓ |
| 真实 `single` 跑完 | 7 行 A-2（首行带 `state.traceId`、`跨度 1 条 · 回流 0 次`、一条跨度、`回流链`/`无`） | A-2 ✓（D-26 不误伤正常追踪） |
| 当前代码实例（`state.traceId=TRC-32cdd9cc`）删除 `state/traces.jsonl` | `实例 INST-001 · 暂无追踪记录`（exit 0，无 `TRC-`、无 `跨度 0 条`） | AC-23 `missing` → A-1 ✓ |
| 真实 `--hold-session` 运行中（`T-001 state=running`） | 7 行 A-10：`实例 INST-001 · 追踪 TRC-860f0ff8` / `跨度 0 条 · 回流 0 次` / `04:43:33 → —  T-001  进行中  交接 HO-001` / `回流链` / `无` | AC-22 未被误伤 ✓ |

> AC-23 属 B 组范围；本节只落验收侧自测的一份，命名带 `-a`（`AC-23/result-a.json`、`AC-23/stdout-missing-traces-a.txt`、`AC-23/fixture-a.json`）以免与 B 组冲突。

### 4. AC-03 机检（全量，D-27 后）—— PASS

```
命令：NODE_ENV=test node --test "test/**/*.test.js"
# tests 1157   # pass 1147   # fail 9   # skipped 1   # cancelled 0
EXIT=1
```

与 `docs/iterations/iteration-7/baseline-failures.txt` 对账：

| 类别 | 数量 | 明细 |
|---|---|---|
| 基线命中 | 8/8 | NFR-02 readReview / NFR-02 verifyProducts / core.stop 5s / cursor.json 并发 / main `--cwd` / task-loop 绝对路径 / 早返回 turn-delay / 自动拉起 detached |
| 新增（相对基线） | 1 | `test/wp9/cli-e2e.test.js:164` C-2 —— 全量并行负载下 `tool_running` 采样时序 flake |
| 已消除 | — | `test/wp11/rpc.test.js:346` AC-57（D-27 后单文件 **8/8**，`rpc-test-solo-r2.log`） |

- **C-2 处置**：单文件复跑 `4 tests / 4 pass / 0 fail`（`cli-e2e-solo-r2.log`），按 D-2「允许 `cli-e2e` 高并发 flake」不计入差集；全量中的首行错误为 `not ok 1040`（`full-suite-r2.log`）。
- **失败集合差集 = 0**（基线 8 条之外唯一一条为已裁定允许的 flake）→ **AC-03 判 PASS**。
- 用例数 1154 → 1157（+3）：D-25 / D-26 在 `test/wp9/i19-render.test.js` 新增 3 个用例（全 `null` 不渲染 / 部分缺项仍渲染 / `0` 与空串算有值）。

**全量环境事故（非产品问题，登记备查）**：本轮第一次尝试在同一命令下停在第 855 例、滞留 23 分钟（`AC-03/full-suite-r2-aborted.log`）。定位为机器上累积 **723 个** `orch core serve` 残留进程，其中 **411 个**的项目目录已被删除、其余 10 分钟内无任何写入——历次测试未回收的核心进程导致 fork/IO 资源紧张。仅清理「项目目录已删除」与「10 分钟无写入」的陈旧进程后，同一命令 **5m52s** 跑完，结果即上表。该现象属**测试环境积压**，不是 I1.9 代码回归。

### 5. `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 变更登记（按要求未回滚）

全量测试会重写这三个性能证据文件（历次运行均如此，非本次修复引入），仅数值变化、结构不变：

| 文件 | 变化 |
|---|---|
| `nfr-perf-atomic.json` | 3 行（耗时/采样值） |
| `nfr-perf-batch.json` | 1 行（耗时值） |
| `nfr-perf-render.json` | 2 行（`firstLineMs 2.571 → 2.346`、`totalMs 3.095 → 3.001`） |

> 按任务书**未回滚**，仅登记文件名与变化摘要，交主控统一处理。

### 6. 复验证据清单（`evidence/acc9/` 下）

| AC | 新增文件 |
|---|---|
| AC-03 | `full-suite-r2.log`、`full-suite-r2-summary.txt`、`full-suite-r2-aborted.log`、`verdict-r2.json`、`rpc-test-solo-r2.log`、`cli-e2e-solo-r2.log` |
| AC-04 | `stdout-trace-show-r2.txt`、`stdout-instance-log-json-r2.txt`、`result-r2.json` |
| AC-05 | `stdout-trace-show-r2.txt`、`result-r2.json` |
| AC-08 | `trace-after-fix.txt`、`result-r2.json`、`execution-summary-events-r2.json`、`stdout-driver-r2.txt` |
| AC-09 | `stdout-empty-r2.txt`、`stdout-single-r2.txt`、`stdout-deleted-traces-r2.txt`、`stdout-hold-session-r2.txt`、`hold-session-state-r2.json`、`result-r2.json`、`result-ac22-r2.json`、`reverify-summary.json` |
| AC-23 | `stdout-missing-traces-a.txt`、`fixture-a.json`、`result-a.json` |

---

## 结论

**PASS 12 / FAIL 2 / 阻塞 0**（共 14 条）　—— 首轮验收（2026-11-11T20:20Z）

- FAIL 2 条：
  - **AC-03**：Then（三主链逐字）通过，**机检**「全量失败集合差集 = 0」不通过（基线 8 + 新增 2；其中 AC-57 确定性、C-2 为负载 flake）。根因 `test/wp11/rpc.test.js` 的 8 条硬编码期望与 I1.9 必需的取消摘要冲突，待主控裁决。
  - **AC-08**：唯一原因是「附录 A-3 未含失败跨度摘要行」与「AC-04/A-4/BR-04 要求失败跨度显示摘要行」的**需求内部冲突**；除该行外 A-3 逐字命中。
- 其余 12 条均为「真实核心 + 真实 CLI」实测通过；AC-13 / AC-14 的精确等值边界按需求下沉单元级（`test/wp12/health.test.js` 32/32）。
- AC-03 的 `task-loop` 的 `会话 已升级` 属基线 flaky（D-17 ⑥）：6/6 对与基线同命中、双方均命中时逐字 diff=0，另 10 对采样 base 8/10 · cur 7/10，判「不低于基线」。

### 复验后结论（2026-11-11T21:20Z）

**PASS 14 / FAIL 0 / 阻塞 0**（共 14 条）

- **AC-03 → PASS**：Then 不变（三主链逐字 diff=0）；机检 r2 为 `1157 tests / 1147 pass / 9 fail / 1 skipped`，基线 8 条全部命中，差集仅 C-2（单文件 4/4，D-2 允许的负载 flake）；AC-57 已由 D-27 消除（单文件 8/8）。
- **AC-08 → PASS**：冻结窗口输出与附录 A-3 9/9 行逐字全等，`失败摘要` 行为 0（D-25）。
- **AC-04 / AC-05 / AC-09 → PASS（复验加固）**：D-25 未打掉 A-4（四项有值）与部分缺项行；D-26 后空实例与删追踪文件均为 A-1，真实 running 节点仍 A-10 且首行带号。
- 其余 9 条结论不变（首轮 PASS）。
