# I1.4 WP-8 验收报告

**70 条：通过 70 / 不通过 0 / 阻塞 0 / 未执行 0**

**已执行 70 / 未执行 0**

## 1. 总判与证据分级

- 通过 70 / 不通过 0 / 阻塞 0 / 未执行 0（共 70 条）。
- 证据分级：已实测（真实宿主）0 / mock 实测 70 / 阻塞 0 / 未执行 0。
- 当前环境 macOS、无 DSH 真实宿主；真实宿主为 Windows 侧能力，故「已实测（真实宿主）」为 0 属如实结论，非伪造通过。
- evidence/ 共 633 个文件（630 个 `AC-*` 证据 + 3 个 `nfr-perf-*.json` 性能证据），覆盖 70 条 AC。

## 2. 分批结果

| 批次 | 区间 | 通过 | 不通过 | 阻塞 | 未执行 |
|---|---|---|---|---|---|
| a | AC-01~15 | 15 | 0 | 0 | 0 |
| b | AC-16~30 | 15 | 0 | 0 | 0 |
| c | AC-31~45 | 15 | 0 | 0 | 0 |
| d | AC-46~60 | 15 | 0 | 0 | 0 |
| e | AC-61~70 | 10 | 0 | 0 | 0 |

## 3. 判定口径

- 每条 AC 的 case 把需求 §3.1 的每个 Then / 机检点转成可执行断言；不做「只 includes 一个词」的弱判定，不合并多条 AC。
- 证据落盘：`state.json` / `events.jsonl` / stdout / `status.md` / 命令退出码，存 `evidence/`，并在 `results.jsonl` 记录路径；每条 AC ≥ 1 份可复核原始帧。
- 分批落盘：`--all` 按 a~e 五批执行，每批立刻写 `results.jsonl` 与 `evidence/`；`final` 从已落盘结果重建，支持只重跑受影响批次。
- 独立项目根：每 AC 一个 `os.tmpdir()/maestro-acc-p4/<AC>`，绝不在仓库目录里跑。

## 3.1 逐条 AC 结论与证据路径

| AC | 判定 | 证据分级 | 核对项通过/总数 | 证据路径 |
|---|---|---|---|---|
| AC-01 | 通过 | mock 实测 | 17/17 | `evidence/AC-01.attempts.json`<br>`evidence/AC-01.events.jsonl`<br>（共 9 份） |
| AC-02 | 通过 | mock 实测 | 22/22 | `evidence/AC-02.attempts.json`<br>`evidence/AC-02.events.jsonl`<br>（共 9 份） |
| AC-03 | 通过 | mock 实测 | 24/24 | `evidence/AC-03.attempts.json`<br>`evidence/AC-03.events.jsonl`<br>（共 9 份） |
| AC-04 | 通过 | mock 实测 | 23/23 | `evidence/AC-04.attempts.json`<br>`evidence/AC-04.events.jsonl`<br>（共 9 份） |
| AC-05 | 通过 | mock 实测 | 7/7 | `evidence/AC-05.attempts.json`<br>`evidence/AC-05.events.jsonl`<br>（共 9 份） |
| AC-06 | 通过 | mock 实测 | 6/6 | `evidence/AC-06.attempts.json`<br>`evidence/AC-06.events.jsonl`<br>（共 9 份） |
| AC-07 | 通过 | mock 实测 | 59/59 | `evidence/AC-07.attempts.json`<br>`evidence/AC-07.events.jsonl`<br>（共 9 份） |
| AC-08 | 通过 | mock 实测 | 6/6 | `evidence/AC-08.attempts.json`<br>`evidence/AC-08.events.jsonl`<br>（共 9 份） |
| AC-09 | 通过 | mock 实测 | 14/14 | `evidence/AC-09.attempts.json`<br>`evidence/AC-09.events.jsonl`<br>（共 9 份） |
| AC-10 | 通过 | mock 实测 | 12/12 | `evidence/AC-10.attempts.json`<br>`evidence/AC-10.events.jsonl`<br>（共 9 份） |
| AC-11 | 通过 | mock 实测 | 14/14 | `evidence/AC-11.attempts.json`<br>`evidence/AC-11.events.jsonl`<br>（共 9 份） |
| AC-12 | 通过 | mock 实测 | 16/16 | `evidence/AC-12.attempts.json`<br>`evidence/AC-12.events.jsonl`<br>（共 9 份） |
| AC-13 | 通过 | mock 实测 | 14/14 | `evidence/AC-13.attempts.json`<br>`evidence/AC-13.events.jsonl`<br>（共 9 份） |
| AC-14 | 通过 | mock 实测 | 20/20 | `evidence/AC-14.attempts.json`<br>`evidence/AC-14.events.jsonl`<br>（共 9 份） |
| AC-15 | 通过 | mock 实测 | 8/8 | `evidence/AC-15.attempts.json`<br>`evidence/AC-15.events.jsonl`<br>（共 9 份） |
| AC-16 | 通过 | mock 实测 | 11/11 | `evidence/AC-16.attempts.json`<br>`evidence/AC-16.events.jsonl`<br>（共 9 份） |
| AC-17 | 通过 | mock 实测 | 11/11 | `evidence/AC-17.attempts.json`<br>`evidence/AC-17.events.jsonl`<br>（共 9 份） |
| AC-18 | 通过 | mock 实测 | 4/4 | `evidence/AC-18.attempts.json`<br>`evidence/AC-18.events.jsonl`<br>（共 9 份） |
| AC-19 | 通过 | mock 实测 | 7/7 | `evidence/AC-19.attempts.json`<br>`evidence/AC-19.events.jsonl`<br>（共 9 份） |
| AC-20 | 通过 | mock 实测 | 9/9 | `evidence/AC-20.attempts.json`<br>`evidence/AC-20.events.jsonl`<br>（共 9 份） |
| AC-21 | 通过 | mock 实测 | 20/20 | `evidence/AC-21.attempts.json`<br>`evidence/AC-21.events.jsonl`<br>（共 9 份） |
| AC-22 | 通过 | mock 实测 | 7/7 | `evidence/AC-22.attempts.json`<br>`evidence/AC-22.events.jsonl`<br>（共 9 份） |
| AC-23 | 通过 | mock 实测 | 9/9 | `evidence/AC-23.attempts.json`<br>`evidence/AC-23.events.jsonl`<br>（共 9 份） |
| AC-24 | 通过 | mock 实测 | 11/11 | `evidence/AC-24.attempts.json`<br>`evidence/AC-24.events.jsonl`<br>（共 9 份） |
| AC-25 | 通过 | mock 实测 | 6/6 | `evidence/AC-25.attempts.json`<br>`evidence/AC-25.events.jsonl`<br>（共 9 份） |
| AC-26 | 通过 | mock 实测 | 10/10 | `evidence/AC-26.attempts.json`<br>`evidence/AC-26.events.jsonl`<br>（共 9 份） |
| AC-27 | 通过 | mock 实测 | 7/7 | `evidence/AC-27.attempts.json`<br>`evidence/AC-27.events.jsonl`<br>（共 9 份） |
| AC-28 | 通过 | mock 实测 | 24/24 | `evidence/AC-28.attempts.json`<br>`evidence/AC-28.events.jsonl`<br>（共 9 份） |
| AC-29 | 通过 | mock 实测 | 10/10 | `evidence/AC-29.attempts.json`<br>`evidence/AC-29.events.jsonl`<br>（共 9 份） |
| AC-30 | 通过 | mock 实测 | 7/7 | `evidence/AC-30.attempts.json`<br>`evidence/AC-30.events.jsonl`<br>（共 9 份） |
| AC-31 | 通过 | mock 实测 | 10/10 | `evidence/AC-31.attempts.json`<br>`evidence/AC-31.events.jsonl`<br>（共 9 份） |
| AC-32 | 通过 | mock 实测 | 10/10 | `evidence/AC-32.attempts.json`<br>`evidence/AC-32.events.jsonl`<br>（共 9 份） |
| AC-33 | 通过 | mock 实测 | 9/9 | `evidence/AC-33.attempts.json`<br>`evidence/AC-33.events.jsonl`<br>（共 9 份） |
| AC-34 | 通过 | mock 实测 | 7/7 | `evidence/AC-34.attempts.json`<br>`evidence/AC-34.events.jsonl`<br>（共 9 份） |
| AC-35 | 通过 | mock 实测 | 9/9 | `evidence/AC-35.attempts.json`<br>`evidence/AC-35.events.jsonl`<br>（共 9 份） |
| AC-36 | 通过 | mock 实测 | 13/13 | `evidence/AC-36.attempts.json`<br>`evidence/AC-36.events.jsonl`<br>（共 9 份） |
| AC-37 | 通过 | mock 实测 | 8/8 | `evidence/AC-37.attempts.json`<br>`evidence/AC-37.events.jsonl`<br>（共 9 份） |
| AC-38 | 通过 | mock 实测 | 6/6 | `evidence/AC-38.attempts.json`<br>`evidence/AC-38.events.jsonl`<br>（共 9 份） |
| AC-39 | 通过 | mock 实测 | 7/7 | `evidence/AC-39.attempts.json`<br>`evidence/AC-39.events.jsonl`<br>（共 9 份） |
| AC-40 | 通过 | mock 实测 | 7/7 | `evidence/AC-40.attempts.json`<br>`evidence/AC-40.events.jsonl`<br>（共 9 份） |
| AC-41 | 通过 | mock 实测 | 15/15 | `evidence/AC-41.attempts.json`<br>`evidence/AC-41.events.jsonl`<br>（共 9 份） |
| AC-42 | 通过 | mock 实测 | 10/10 | `evidence/AC-42.attempts.json`<br>`evidence/AC-42.events.jsonl`<br>（共 9 份） |
| AC-43 | 通过 | mock 实测 | 12/12 | `evidence/AC-43.attempts.json`<br>`evidence/AC-43.events.jsonl`<br>（共 9 份） |
| AC-44 | 通过 | mock 实测 | 12/12 | `evidence/AC-44.attempts.json`<br>`evidence/AC-44.events.jsonl`<br>（共 9 份） |
| AC-45 | 通过 | mock 实测 | 7/7 | `evidence/AC-45.attempts.json`<br>`evidence/AC-45.events.jsonl`<br>（共 9 份） |
| AC-46 | 通过 | mock 实测 | 10/10 | `evidence/AC-46.attempts.json`<br>`evidence/AC-46.events.jsonl`<br>（共 9 份） |
| AC-47 | 通过 | mock 实测 | 29/29 | `evidence/AC-47.attempts.json`<br>`evidence/AC-47.events.jsonl`<br>（共 9 份） |
| AC-48 | 通过 | mock 实测 | 7/7 | `evidence/AC-48.attempts.json`<br>`evidence/AC-48.events.jsonl`<br>（共 9 份） |
| AC-49 | 通过 | mock 实测 | 17/17 | `evidence/AC-49.attempts.json`<br>`evidence/AC-49.events.jsonl`<br>（共 9 份） |
| AC-50 | 通过 | mock 实测 | 11/11 | `evidence/AC-50.attempts.json`<br>`evidence/AC-50.events.jsonl`<br>（共 9 份） |
| AC-51 | 通过 | mock 实测 | 18/18 | `evidence/AC-51.attempts.json`<br>`evidence/AC-51.events.jsonl`<br>（共 9 份） |
| AC-52 | 通过 | mock 实测 | 8/8 | `evidence/AC-52.attempts.json`<br>`evidence/AC-52.events.jsonl`<br>（共 9 份） |
| AC-53 | 通过 | mock 实测 | 7/7 | `evidence/AC-53.attempts.json`<br>`evidence/AC-53.events.jsonl`<br>（共 9 份） |
| AC-54 | 通过 | mock 实测 | 16/16 | `evidence/AC-54.attempts.json`<br>`evidence/AC-54.events.jsonl`<br>（共 9 份） |
| AC-55 | 通过 | mock 实测 | 13/13 | `evidence/AC-55.attempts.json`<br>`evidence/AC-55.events.jsonl`<br>（共 9 份） |
| AC-56 | 通过 | mock 实测 | 16/16 | `evidence/AC-56.attempts.json`<br>`evidence/AC-56.events.jsonl`<br>（共 9 份） |
| AC-57 | 通过 | mock 实测 | 18/18 | `evidence/AC-57.attempts.json`<br>`evidence/AC-57.events.jsonl`<br>（共 9 份） |
| AC-58 | 通过 | mock 实测 | 9/9 | `evidence/AC-58.attempts.json`<br>`evidence/AC-58.events.jsonl`<br>（共 9 份） |
| AC-59 | 通过 | mock 实测 | 9/9 | `evidence/AC-59.attempts.json`<br>`evidence/AC-59.events.jsonl`<br>（共 9 份） |
| AC-60 | 通过 | mock 实测 | 11/11 | `evidence/AC-60.attempts.json`<br>`evidence/AC-60.events.jsonl`<br>（共 9 份） |
| AC-61 | 通过 | mock 实测 | 11/11 | `evidence/AC-61.attempts.json`<br>`evidence/AC-61.events.jsonl`<br>（共 9 份） |
| AC-62 | 通过 | mock 实测 | 13/13 | `evidence/AC-62.attempts.json`<br>`evidence/AC-62.events.jsonl`<br>（共 9 份） |
| AC-63 | 通过 | mock 实测 | 9/9 | `evidence/AC-63.attempts.json`<br>`evidence/AC-63.events.jsonl`<br>（共 9 份） |
| AC-64 | 通过 | mock 实测 | 14/14 | `evidence/AC-64.attempts.json`<br>`evidence/AC-64.events.jsonl`<br>（共 9 份） |
| AC-65 | 通过 | mock 实测 | 8/8 | `evidence/AC-65.attempts.json`<br>`evidence/AC-65.events.jsonl`<br>（共 9 份） |
| AC-66 | 通过 | mock 实测 | 16/16 | `evidence/AC-66.attempts.json`<br>`evidence/AC-66.events.jsonl`<br>（共 9 份） |
| AC-67 | 通过 | mock 实测 | 7/7 | `evidence/AC-67.attempts.json`<br>`evidence/AC-67.events.jsonl`<br>（共 9 份） |
| AC-68 | 通过 | mock 实测 | 12/12 | `evidence/AC-68.attempts.json`<br>`evidence/AC-68.events.jsonl`<br>（共 9 份） |
| AC-69 | 通过 | mock 实测 | 10/10 | `evidence/AC-69.attempts.json`<br>`evidence/AC-69.events.jsonl`<br>（共 9 份） |
| AC-70 | 通过 | mock 实测 | 11/11 | `evidence/AC-70.attempts.json`<br>`evidence/AC-70.events.jsonl`<br>（共 9 份） |

## 4. 未通过 / 阻塞项

（无）

## 4.1 未执行项（后续批次续派）

（无）

## 4.2 收口期 3 处 src 修复（B-01 补修）

- 收口期 `src/**` 共 3 处最小修复（登记见 `probe/acc4-f-blockers.md`）：① `src/cli/main.js:953` AC-29③ 文案（评审裁定保留）；② `src/core/orchestrator.js:1606` AC-65 会话创建失败时把已落 `created` 的孤儿包并入升级同一次 CAS（评审裁定保留）；③ `src/core/orchestrator.js:4400` AC-66 恢复复用暂停前已构造的 `created` 包（评审判 FAIL，本轮补修）。
- ③ 已按 D-7.4 第 1 步补齐三重门控（`toNodeId === 目标节点` / `round === targetRound` / 该轮无已开始会话）与 `node.round >= targetRound → stop` 防重，并有竞态单测锁定：`test/wp11/resume-reuse-guard.test.js` 5 用例实测 **5/5 通过**（补修前同用例 1/5 通过）。补修仍属**同一处**修复，`src/**` 无第 4 处改动；补修前后证据路径见 `probe/acc4-f-parts/BLK-03-B01-evidence.json`。
- ③ 复用仍走 resume 旁路直调 `dispatchInState`，未改为 `advance()` / `planAdvance` 的 `reuseHandoffId` 统一路径（收口期方案 1 最小改动）；故**不宜写成「已完全符合 D-7.4」**，残留风险交主线裁决。
- 本轮重跑 AC-53 / AC-61 / AC-65 / AC-66 与 `node probe/acc4-f-final.mjs`，70 条 AC 结论与证据路径表不变：通过 70 / 不通过 0 / 阻塞 0 / 未执行 0。

## 4.3 收口期测试健壮性加固（NFR-06：白名单外新增失败 = 0）

> 只改 3 个测试文件的**等待方式**，`src/**` 本轮新增改动 0 处、不碰 §7.2 的 9 条白名单、不改任何断言语义/强度；逐条明细与留痕见 `probe/acc4-f-blockers.md` 同名章节。

- **背景（加固前快照）**：主线全量 641 用例 / 628 pass / 12 fail / 1 skip；12 fail = 9 条 §7.2 白名单 + **3 条白名单外新增失败**。三条单跑所属文件全绿（`escalation-resolve.test.js` 6/6、`resume-reuse-guard.test.js` 5/5、`acp-client.test.js` 8/8），确认为全量并发负载下的时序假红，非产品回归。统一修法：等**可观测终态**，不靠固定 sleep / 后台 drive 内部计数。
- **加固后主线独占复跑**：641 用例 / 631 pass / 9 fail / 1 skip，9 条失败与 §7.2 白名单 9/9 前缀匹配，白名单外新增失败 0，成功数 631 ≥ 409。
- **逐条登记**：

| 文件:行号 | 对应 AC | 改了什么 | 等待条件 / 上限 | 断言 |
|---|---|---|---|---|
| `test/wp11/resume-reuse-guard.test.js:208` 正例 | AC-66 / AC-53（复用门控与 rev） | harness 新增 `h.waitForDispatch(expected)`；正例 `await h.settle()` → `await h.waitForDispatch(before.counters.dispatchCount + 1)` | 轮询 `counters.dispatchCount >= expected` 且 `events` 出现 `node.dispatch`（复用 `dispatchEvents`）；**15000ms**，超时抛清晰错误 | 5 条断言逐字保留，含 `dispatchCount === before+1`（恰好 +1） |
| `test/wp11/escalation-resolve.test.js:269` | AC-49（paused 收尾） | `waitFile(marker, 8000)` → `30000`；`waitForRun({ timeoutMs: 8000 })` → `30000` | `waitFile` 20ms 轮询、上限 **30000ms**；`timeoutMs` 是 `Promise.race` 超时哨兵，同源放宽 **30000ms** | 「应在派发边界停住」期望仍 `true`；`waited.ok` / `paused` / `state` / 事件数 / `dispatchCount` / `sessions` 全不变 |
| `test/wp3/acp-client.test.js:203`（I1.1 既有文件） | 无独占 AC（I1.1 既有回归用例，负载健壮性加固） | 仅第 212 行固定 `setTimeout(200)` → 轮询 | 轮询 `updates` 出现 `tool_call`，25ms 间隔，**5000ms** 上限，超时由原 `assert.ok(...)` 兜底 | `assert.ok(...)` 逐字保留；`cancelled.ok` / `prompted.ok` / `stopReason === 'cancelled'` 全不变 |

- **为什么不算弱化断言**：只改「断言前等什么」，不改「断言判什么」。`h.settle()` 本体未改（3 个负例仍靠它、断言 dispatchCount 不增加，改成等 +1 会令负例超时）；`waitFile` 期望值仍是 `true`（没出现仍判红，未改成「没出现也算通过」）；无 `equal`→`ok`、无放宽期望、无跳过失败分支、无 try/catch 吞超时。等待条件里的 `>=` 仅判「何时停等」，产品多派发时 `=== before+1` 仍如实判红。
- **留痕**：`test/wp3/acp-client.test.js` 是 tracked，`git diff -- test/wp3/acp-client.test.js` 仅一个 hunk（删固定 sleep、增 4 行轮询），其余 7 用例 / imports / 全部断言一字未动；登记同步落 `probe/acc4-f-blockers.md`。
- **验证（本轮实测）**：单跑 3 文件 5/5、6/6、8/8（fail 0）；并发压力 **3 轮**（每轮 11 进程 = 3 目标 + 8 个 24s CPU/IO worker）每轮 3 目标全绿；定向 AC-49 17/17、AC-53 7/7、AC-61 11/11、AC-66 16/16（通过 4 / 不通过 0 / 阻塞 0）；`final` = `70 条：通过 70 / 不通过 0 / 阻塞 0 / 未执行 0`；`purity-check` exit 0；`git diff -- src/` 哈希前后相等、内容哈希快照（1112 文件）仅 5 个允许文件变化。
- **结论 / 需主线裁决**：模拟并发负载下 NFR-06「白名单外新增失败 = 0」成立，本轮未跑全量回归（留主线独占）。上限 30s/15s/5s 相对主线实测负载留有约 9s 以上余量；若主线全量仍复发，先按清晰失败信息分辨「等待超时」还是「真断言失败」，超时只可再放宽上限，绝不改断言或把红并入白名单。

## 5. NFR 性能证据

- `test/wp11/perf.test.js`：3 条**确定性结构断言**（NFR-05 原子写 / 50 张包批量写 / NFR-01 100 事件 50 包渲染完整性），实测耗时落盘 `evidence/nfr-perf-*.json`；**不设墙钟阈值**，避免复现 §7.2 白名单 `test/wp10/perf.test.js` 两条负载相关红。
- `evidence/nfr-perf-atomic.json`：status.md=135.728ms、inbox/HO-001.json=162.893ms。
- `evidence/nfr-perf-batch.json`：total=145.61ms。
- `evidence/nfr-perf-render.json`：total=3.3ms；首行=2.601ms。
- NFR-02 / 03 / 04（暂停、审批、待投递重试、`status` 时效、3 次失败升级、`pause/resume` 返回）由 AC-15~20、AC-49~52、AC-60~61 逐条取证；NFR-06 由 `node --test "test/**/*.test.js"` 全量回归、NFR-07 由 `package.json` 依赖检查实测（见最终验收汇报）。

> 逐条记录（命令 / 需求原文 / 证据 / 判定）见 `docs/iterations/iteration-4/acceptance-fixture.md` 与 `probe/acc4-f-parts/`。