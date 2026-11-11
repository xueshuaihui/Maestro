# I1.9 S4 终验报告（独立终验 Agent）

> 角色边界：本报告的撰写者与实现 Agent、验收 Agent 均不重合，使用干净上下文。全程只读产品代码 / 测试代码 / 验收文档 / 需求文档，未做任何修改、未执行 `git commit`。
> 唯一写入：本文件；复核脚本仅落在 `/tmp`（`/tmp/fv-chains.mjs`、`/tmp/fv-*.log`），未写入仓库。

---

## 1. 终验范围与环境

| 项 | 值 |
|---|---|
| 仓库 | `/Users/xuesh/www/Maestro` |
| HEAD | `51c83f1`（`docs(I1.9): S3 acceptance A/B + evidence, decisions D-25..D-27`） |
| 基线树 | `git worktree add --detach /tmp/fv-base 322fb5e`，用后已 `git worktree remove --force`（`git worktree list` 无残留） |
| Node | `v22.22.2` |
| 平台 | macOS Darwin 25.6.0 / x86_64 |
| 终验时间 | 2026-11-12 05:22 ~ 06:05（CST） |
| 夹具纪律 | 一律 `os.tmpdir()` 独立根、`NODE_ENV=test`、`--host mock`，`.orch/hosts/mock.json` 指向仓库内 `test/fixtures/mock-acp-agent.js`；未把验收根放进仓库 |
| 依据 | `docs/templates/execution-template.md` §3.6 / §4.5；`requirement.md` v7（27 AC / 25 BR）；`iteration-9.md`（9 WP）；`acceptance-a.md` / `acceptance-b.md`；`decisions.md` D-0~D-27；`baseline-failures.txt` |

终验对象统计（实盘）：

| 项 | 数 |
|---|---|
| AC 总数 | 27（AC-01 ~ AC-27，连续） |
| 验收结论 | A 组 PASS 14 / FAIL 0；B 组 PASS 13 / FAIL 0；合计 **PASS 27 / FAIL 0 / 阻塞 0** |
| 证据目录 | `evidence/acc9/AC-01` ~ `AC-27`，共 **27** 个目录 |
| 证据文件 | **255** 个；每 AC 均有 `result.json`（27/27） |
| 拆分文档 | 9 个 WP（WP-1 ~ WP-9），S2 六批全部评审 PASS |

---

## 2. 六项逐项判定

### 2.1 结果完整性 —— PASS

**检查方法**：核对 27 条 AC 是否全部有结论、结论是否 100% 通过、WP 交付项是否有结论、`summary` 类产物是否覆盖全部 AC。

**实跑/实盘**：

```
$ ls -d docs/iterations/iteration-9/evidence/acc9/AC-*   → 27
$ ls docs/iterations/iteration-9/evidence/acc9/AC-*/result.json | wc -l  → 27
$ python3 汇总 27 份 result.json → checks 合计 319，failed 合计 1（仅 AC-08/result.json 为修复前旧记录）
```

- `acceptance-a.md` 复验后结论：**PASS 14 / FAIL 0 / 阻塞 0**（AC-01 ~ AC-14）。
- `acceptance-b.md` 结论：**PASS 13 / FAIL 0 / 阻塞 0**（AC-15 ~ AC-27）。
- `iteration-9.md` 中 9 个 WP 均有 S2 评审 PASS 记录（`progress.md` 批次 1~6）。

**判定**：**PASS**。27/27 AC 有结论、通过率 100%、0 不通过、0 阻塞。

**产物形态说明（不阻断）**：本迭代未生成模板 §4.4 所列的 `summary.json` / `results.jsonl` / `blockers.md`，由 `acceptance-a.md` / `acceptance-b.md` + 每 AC `result.json` 承担同一职责；结论覆盖完整。`AC-08/result.json` 是 D-25 修复前的首轮记录（`pass:false`），最终判定须取 `AC-08/result-r2.json`（`a3Exact:true`、`pass:true`），符合 §3.5「同一 AC 多条记录取最后一条」。

### 2.2 证据支撑性 —— PASS

**检查方法**：抽查 9 条 AC，覆盖四类（逐字回归 / 输出基线 / 健康度 / 追踪与摘要），逐份打开原始帧（stdout / JSON / 行数 / 哈希），确认「结论 → 原始帧」可复核，空文件或只有结论的判无效。

| AC | 证据文件 | 原始帧要点 | 有效性 | 结论是否被支撑 |
|---|---|---|---|---|
| AC-03 | `AC-03/*-pair*-base.txt` / `*-cur.txt`、`result.json`、`verdict-r2.json`、`full-suite-r2.log` | 12 对原始 stdout（single 3 / code-loop 3 / task-loop 6），按 A-0 归一化后逐行 diff 0；`verdict-r2` 记录 `1157/1147/9/1` 与 `diffFromBaseline:0` | 有效 | 是 |
| AC-08 | `AC-08/trace-after-fix.txt`、`result-r2.json`、`execution-summary-events-r2.json` | 9 行 A-3 归一化后 9/9 全等；`a3Exact:true`；数据侧 3 条 `execution.summary` 四项全 `null` | 有效 | 是（D-25 生效，抑制按数据） |
| AC-13 | `AC-13/stdout-<fixture>.txt` ×6、`snapshot-*.json`、`result.json` | 六条健康度行逐字输出（升级 / 超时 / 崩溃 / 角色 / 连接线拒绝 / 过期），每夹具只含目标条件 | 有效 | 是 |
| AC-16 | `AC-16/status-first.txt` / `status-second.txt` / `log-text.txt`、`result.json` | `健康度 正常` → `健康度 需关注 · 有待处理升级`；`03:56:12 健康度 INST-001  正常 → 需关注  原因 有待处理升级`；21 项 checks 全 ok | 有效 | 是 |
| AC-17 | `AC-17/status.txt`、`status.md`、`graph.txt`、`graph.json`、`result.json` | `status` / `status.md` 同档同原因；`graph` 文本与 JSON 均无 health；无 `graph.json` 文件 | 有效 | 是 |
| AC-22 | `AC-22/trace-hold.txt`、`trace-delay-running.txt`、`trace-delay-done.txt` | `跨度 0 条 · 回流 0 次` + `HH:MM:SS → —  T-001  进行中  交接 HO-001`；同一 `TRC-54a78f76` 放行后变 `跨度 1 条` 且无「进行中」 | 有效 | 是 |
| AC-23 | `AC-23/badline-trace.txt`、`notime-trace.txt` / `notime-status.txt`、`missing-after-d26-r2.txt`、`result-d26.json` | badline 提示在汇总行前 + `跨度 2 条`；notime 6 条跨度 + `健康度 正常`；missing `暂无追踪记录`（exit 0）；D-26 复验 29/29 | 有效 | 是 |
| AC-26 | `AC-26/cancel.txt`、`log-text.txt`、`status.txt`、`result.json` | `orch cancel` exit 0；`执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供`；`已取消` + `健康度 已结束` | 有效 | 是 |
| AC-27 | `AC-27/log-text.txt`、`log.json`、`trace.txt`、`result.json` | `T-001` 摘要 2 条（轮 1/2）、`T-002` 1 条、全文摘要数 = 会话数 3；`trace` 中 `T-001` 2 条跨度、`T-002` 1 条 | 有效（见备注） | 是 |

**备注（均不构成无效证据）**：

1. `AC-08/result.json` 与 `result-r2.json` 并存，前者为修复前失败记录（已核对失败项正是多出的「失败摘要」行），后者为最终记录；验收文档明确以 r2 为准。
2. `AC-27` 的 `trace.txt` 生成于 D-25 之前，仍含一行「失败摘要 … 未提供」；D-25 后当前代码不再渲染该行。AC-27 的 Then 判据是「摘要条数 / 跨度条数」，原始帧中的 2/1/3 计数不受该行影响，故结论仍被支撑；建议主控在 `report.md` §5 注明该证据的时间点。
3. `AC-13` 的待处理升级夹具 `原因：?` 是手工补丁缺 `reason` 字段所致（验收 B 已登记为观察项），健康度判定只看「存在待处理升级」，不影响逐字行。
4. 未发现空证据文件或「只有结论、没有原始帧」的条目。

### 2.3 判定未被放宽 —— PASS

**检查方法**：抽 6 条 AC，把 `acceptance-*.md` 的期望值与 `requirement.md` 的 Then 逐字对照，确认没有把「阻塞」写成「通过」、没有把逐字降级为「包含」。

| AC | 需求 Then 摘要 | 验收期望 | 是否一致 |
|---|---|---|---|
| AC-04 | 四项逐字：`失败摘要 命令 node out/run.js`、`退出码 1`、`关键输出 3 行`、`日志 host-logs/T-001.log`；`instance log` 同摘要；成功节点也有摘要 | 逐字 A-4 + A-12；JSON 四项与夹具一致；`成功实例同样有 execution.summary 记录` | 一致（未放宽） |
| AC-08 | 输出与附录 A-3 **逐字一致** | `a3Exact:true`，9/9 行全等，且断言「不再出现失败摘要行」 | 一致（比首轮更严） |
| AC-13 | 六夹具六条健康度行逐字等于 A-6 附 | 六条 stdout 逐字命中，每次只显示「需关注」一档 | 一致 |
| AC-16 | 正常 → 需关注；日志行逐字 A-8；JSON `reason=health.changed`、`detail.reasons` 含 `pending_escalation`；同档重复查看不追加 | 21 项 checks 覆盖 from/to/reasons/seq/prev_event_hash 与「同档位再查不追加」 | 一致 |
| AC-26 | A-14 四项全「未提供」；`已取消` / `健康度 已结束`；`orch cancel` exit 0；每会话恰 1 条摘要 | 逐条命中；摘要四项 JSON 均为 `null`；无第二类会话级事件 | 一致 |
| AC-27 | `T-001` 2 条摘要、`T-002` 1 条；两条数 = 会话轮次；`trace` 跨度数同；全文摘要数 = 会话数 | 2/1/3 与 `trace` 2/1 全部命中 | 一致 |

补充复核：

- AC-03 的「逐字」按 A-0 归一化（时刻 / 会话号 / `已运行 Ns` / `耗时 Ns` / `TRC-xxxxxxxx`），我另用**未折叠刷新行**的归一化重算 12 对原始 stdout，diff 仍为 0（single 3/3、code-loop 3/3、task-loop 6/6），不是靠折叠掩盖差异。
- AC-22 的 A-10 首行由 `--hold-session` 实例命中；「运行中 → 放行完成」由 `--turn-delay-ms 30000` 的**同一实例**（`TRC-54a78f76`）两阶段命中，不是用不同实例拼接判据。
- 首轮 AC-03 / AC-08 判 FAIL、修复后以 r2 重新取证再判 PASS，未把首轮 FAIL 直接改写成 PASS。

### 2.4 门禁与回归 —— PASS（按 D-2 口径；字面全绿未复现）

**实跑命令与输出**：

```
$ cd /Users/xuesh/www/Maestro
$ NODE_ENV=test node --test "test/**/*.test.js"
# 第 1 次：tests 1157 / pass 1143 / fail 13 / skipped 1 / cancelled 0   EXIT=1   duration 581968.67ms
# 第 2 次：tests 1157 / pass 1139 / fail 17 / skipped 1 / cancelled 0   EXIT=1   duration 667274.56ms

$ node -p "Object.keys(require('./package.json').dependencies||{}).length"        → 0
$ node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))" → 25
$ grep -c "object: 'session'" src/core/orchestrator.js                            → 13
$ grep -rc "object: 'session'" src/core/*.js | awk ...                             → 14（orchestrator 13 + escalation 1）
$ grep -rc "object: 'session'" src/daemon/*.js | awk ...                           → 0
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>  → OK / exit 0（24 文件零命中）
$ grep -rn "if (host ==|switch (host)" src/core src/daemon                         → 无命中
$ NODE_ENV=test node --test test/wp9/**/*.test.js                                  → 119 / 119 / 0
$ NODE_ENV=test node --test test/wp11/**/*.test.js                                 → 385 / 385 / 0
$ NODE_ENV=test node --test test/wp12/**/*.test.js                                 → 190 / 190 / 0
```

**失败集合 vs 基线**：基线 8 条在两次全量中**全部命中**；其余失败均为时序 / 并发 / 负载敏感项，逐文件单独复跑**全部通过**（明细见 §3）。因此按已裁决的 D-2 口径（基线差集 0 + 单文件可复现负载 flake 说明）判 **PASS**。

**必须如实登记的偏差**：本机两次全量均**不是字面全绿**（13 / 17 条失败），比验收 r2 的 9 条多。多出的失败全部是时间阈值型断言（cancel < 3000ms、`waitFor` 20s、冷启动 14s、5s 收敛、P90 采样），单文件复跑全绿，且两次全量的失败集合并不相同（第 2 次另出 4 条 permission 用例），说明是**环境负载波动**而非确定性的产品回归。该现象与 `acceptance-a.md` 复验记录的「723 个残留 `orch core serve` 导致全量停滞」属同类环境问题。

### 2.5 缺陷与遗留 —— PASS（有观察项，无未完成 AC）

- D-25（四项全 `null` 不渲染失败摘要）、D-26（`hasTrace` 改按跨度数组）、D-27（AC-57 期望 8→9）均已落地并在 `acceptance-a.md` 复验节重新取证：AC-08 9/9 逐字、AC-04/05 未被 D-25 打掉、AC-09/22/23 未被 D-26 误伤、`test/wp11/rpc.test.js` 单文件 8/8。
- 无 `blockers.md`；`acceptance-a.md` §③ 的 2 条首轮 FAIL 已闭合，`acceptance-b.md` §③ 的 3 条为「需主控裁决/知悉」观察项，均未阻断 AC：
  1. AC-16 真实 `dispatch-fail-first` 场景 `health.changed=0`：符合 BR-15「首次补写不算档位变化」，机制由受控快照（normal→attention 恰 1 条）证明；建议 `report.md` §5 登记。
  2. AC-22 `--hold-session` 无「放行完成」通道：A-10 由 hold 实例命中，运行中→完成由 `--turn-delay-ms 30000` 同一实例命中；判据未被放宽。
  3. AC-16 快照 `原因：?`：夹具补丁缺 `reason` 字段，属取证夹具瑕疵，不影响健康度判据。
- 另有观察：`progress.md` 的 S3/S4 两行仍为「⏳ 未开始」，与已提交的 S3 验收文档不一致，属主控台账未回填，建议收口时更新；不影响任何 AC。

### 2.6 提交范围 —— PASS

```
$ git log --oneline 322fb5e..HEAD
51c83f1 docs(I1.9): S3 acceptance A/B + evidence, decisions D-25..D-27
0af69d8 I1.9 S3 fixes: D-25 summary line needs data, D-26 empty trace by spans, D-27 AC-57 expects 9 events
40eb704 docs(I1.9): S2 batch-6 review PASS + D-24 + progress ledger, S2 closed
a17e9fe I1.9 WP-9: regression guard for three chains, status/graph baselines and static gates (D-24)
e5a7e2f docs(I1.9): S2 batch-4/5 reviews PASS + decisions D-18..D-23 + progress ledger
f956580 I1.9 WP-8: trace show command, status health line, log summary dispatch and read-only instance.trace (D-20..D-23)
83833fa I1.9 WP-7: core integration for traces, execution summaries and read-time health (D-17 saveState fix, D-19 state.traceId)
```

- 4 个功能/测试 commit（`83833fa`、`f956580`、`a17e9fe`、`0af69d8`）的 `git show --name-only` 只含 `src/**` / `test/**`，**0 个** `docs/iterations/iteration-9/evidence/**` 或 `probe/**` 文件。
- `51c83f1` 是收口文档提交，含 258 个 `docs/iterations/iteration-9/**` 文件与 14 个 `probe/acc9-*.mjs`；`probe/` 是模板 §4.4 允许的验收脚手架，且与功能代码分属不同提交，不构成「功能 commit 卷入证据」。
- `git status --short` 只剩历史遗留与本次全量跑产生的性能证据改动（见 §8），无 `src/**` / `test/**` 改动。

---

## 3. 全量测试失败集合 vs 基线（逐条）

基线来源：`docs/iterations/iteration-7/baseline-failures.txt`（8 条）。

| # | 失败用例（原文） | 所属文件/类别 | 基线 | 第 1 次全量 | 第 2 次全量 | 单文件复跑 | 处置 |
|---|---|---|---|---|---|---|---|
| B1 | NFR-02: readReview p95 <= 50ms（1MB / 5MB 文档） | NFR / 性能 | ✔ | not ok 100 | not ok 100 | — | 基线，D-2 |
| B2 | NFR-02: verifyProducts({sha256:true}) p95 <= 50ms（1MB / 5MB 文档） | NFR / 性能 | ✔ | not ok 101 | not ok 101 | — | 基线，D-2 |
| B3 | core.stop：先回包再断连，5s 内收敛，core.json 仍可读 | 真进程 / 时序 | ✔ | not ok 902 | not ok 902 | — | 基线，D-2 |
| B4 | cursor.json 并发消费 20 次不重复 | 并发 | ✔ | not ok 910 | not ok 910 | — | 基线，D-2 |
| B5 | main：--cwd 相对当前 shell 目录解析，不作为项目根 | 时序 | ✔ | not ok 920 | not ok 920 | — | 基线，D-2 |
| B6 | task-loop 审核提示词给绝对路径：基址与 readReview 同源，避免宿主写进实例工作区 | macOS 路径 | ✔ | not ok 851 | not ok 851 | wp4 单文件 37/36/1，仅此条失败 | 基线，D-2 |
| B7 | 早返回：turn-delay 3000ms 下 startRun 1s 内 resolve，随后 waitForRun 到 completed | 时序 | ✔ | not ok 1019 | not ok 1019 | — | 基线，D-2 |
| B8 | 自动拉起：detached 起真进程，ping 拿到 pid/generation，stopCore 清干净 | 真进程 | ✔ | not ok 905 | not ok 905 | — | 基线，D-2 |
| X1 | cancel：立即落终态（数组结果），不等宿主（turn-delay 10s） | `test/wp4/orchestrator.test.js:390` | — | not ok 823（4300ms） | not ok 823（4568ms） | 36/37 中**通过**（仅 B6 失败） | 负载 flake，D-2 说明 |
| X2 | code-loop 取消优先：after_verdict 停住时取消，回流包 created → rejected(withdrawn) | `test/wp4/orchestrator.test.js:820` | — | not ok 830（waitFor 超时） | not ok 830（waitFor 超时） | 同上，**通过** | 负载 flake，D-2 说明 |
| X3 | C-2 端到端：tool_running 的 status 会话行含"已运行 Ns"（N>0） | `test/wp9/cli-e2e.test.js` | — | not ok 1040 | not ok 1040 | `cli-e2e` 4/4 **通过** | 验收 r2 已按 D-2 允许；负载 flake |
| X4 | C-3 端到端：跑到一半 core stop → 已中断，无未知错误，exit 1 | `test/wp9/cli-e2e.test.js` | — | not ok 1041 | not ok 1041 | `cli-e2e` 4/4 **通过** | 负载 flake |
| X5 | --stop-after 3 冻结窗口恰 3 条跨度、7 字段、无 handoff_ids、HO-002 读取时推导 | `test/wp9/i19-orchestrator.test.js:367` | — | not ok 1092（waitFor 超时） | not ok 1092（waitFor 超时） | 单文件 10/10 **通过** | 负载 flake |
| X6 | F-1 hold：--permission=ask → 会话 waiting_input 且节点仍 running；cancel 收尾 | `test/wp8/f1-permission.test.js:43` | — | 通过 | not ok 1025 | wp8 两文件 11/11 **通过** | 仅第 2 次出现的负载 flake |
| X7 | F-1 reject：--permission=ask → PERMISSION_DENIED，params.step=write | `test/wp8/f1-permission.test.js:81` | — | 通过 | not ok 1026 | 同上，**通过** | 同上 |
| X8 | F-1 allow：--permission=ask 跑完，事件里 waiting_input 有进有出 | `test/wp8/f1-permission.test.js:104` | — | 通过 | not ok 1027 | 同上，**通过** | 同上 |
| X9 | F-4 --permission=deny：params.step 非空且渲染文案不含 null | `test/wp8/f4-error.test.js:32` | — | 通过 | not ok 1034 | 同上，**通过** | 同上 |

**差集结论**：

- 第 1 次：基线 8/8 命中；新增 5 条（X1~X5），全部单文件复跑通过。
- 第 2 次：基线 8/8 命中；新增 9 条（X1~X9），全部单文件复跑通过。
- 两次新增集合不同（第 2 次多出 X6~X9，且 X1/X2 的耗时从 4300ms 升到 4568ms），失败全部集中在时间/并发阈值断言；**无任何确定性新增失败**。
- 按 D-2「失败集合差集 = 0（单文件可复现负载 flake 说明）」判 **PASS**；但**字面「全量全绿」未达成**，主控需在 `report.md` §4/§5 如实登记环境负载与残留核心进程情况。
- 附注：`node --test "test/wp9/**"`（带引号）在本机会把目录当模块加载而报 `MODULE_NOT_FOUND`；按文件展开 `test/wp9/**/*.test.js` 为 119/119。

---

## 4. 门禁数字表

| 门禁 | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 零依赖 | `node -p "Object.keys(require('./package.json').dependencies||{}).length"` | 0 | **0** | PASS |
| 中文唯一来源 | `node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))"` | 25 | **25** | PASS |
| 会话发射点（单文件） | `grep -c "object: 'session'" src/core/orchestrator.js` | 13 | **13** | PASS |
| 会话发射点（core 合计） | `grep -rc` 汇总 | 14（含 escalation 1） | **14**（orchestrator 13 + escalation 1） | PASS |
| 会话发射点（daemon） | `grep -rc` 汇总 | 0 | **0** | PASS |
| 31 词纯净扫描 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | exit 0 | **exit 0（24 文件零命中）** | PASS |
| 宿主分支 | `grep -rn "if (host ==\|switch (host)" src/core src/daemon` | 无命中 | **无命中** | PASS |
| wp9 | `node --test test/wp9/**/*.test.js` | 全绿 | **119 / 119 / 0** | PASS |
| wp11 | `node --test test/wp11/**/*.test.js` | 全绿 | **385 / 385 / 0** | PASS |
| wp12 | `node --test test/wp12/**/*.test.js` | 全绿 | **190 / 190 / 0** | PASS |
| 全量 | `node --test "test/**/*.test.js"` | 差集 0 | 1157 tests；两次 13 / 17 fail，基线 8/8 命中，其余均单文件通过 | PASS（D-2 口径） |
| 三主链 | 见 §5 | exit / 终态 / 无新增词 | 见 §5 | PASS |

---

## 5. 三主链实跑记录

**现场**：`os.tmpdir()/maestro-fv/{cur-*,base-*,cmp-*}` 独立根；每根预置 `.orch/hosts/mock.json`（`launch.command = process.execPath`，`args = [test/fixtures/mock-acp-agent.js]`）；命令统一：

```
cd <root> && NODE_ENV=test node <repo>/bin/orch.js run --cwd . --template <tpl> --host mock --task "<task>"
```

任务与终态：

| 链 | task | 退出码 | 终态（`state.json`） | 健康度/追踪/执行摘要/已跳过 |
|---|---|---|---|---|
| single | `写一份说明` | **0** | `completed`；`T-001:done`；sessions 1 | **均未出现** |
| code-loop | `实现一个示例功能\n产物：calc.js` | **4** | `suspended`；`T-001:escalated` / `T-002:pending`；sessions 1 | **均未出现** |
| task-loop | `整理一份调研纪要\n产物：release-notes.md` | **4** | `suspended`；`T-001:escalated` / `T-002:pending` / `T-003:pending`；sessions 1 | **均未出现** |

> `code-loop` / `task-loop` 的 `suspended` 与 exit 4 是该 mock 任务在缺少对应产物时的既有收尾形态（验收 AC-03 记录的期望退出码同样为 4），不是本次回归。

**与 `322fb5e` 交替对照（每链 1 对，base→cur）**：

| 链 | base exit | cur exit | A-0 归一化后 diff 行数 | `会话 已升级` base/cur |
|---|---|---|---|---|
| single | 0 | 0 | **0** | false / false |
| code-loop | 4 | 4 | **0** | true / true |
| task-loop | 4 | 4 | **0** | true / true |

结论：三条链退出码与基线一致、归一化后逐字 diff 为 0、无新增可见词。`git worktree remove --force /tmp/fv-base` 已执行，`git worktree list` 只剩仓库主树与历史遗留的 `/private/tmp/i19-wp7-baseline`（非本次创建，未动）。

---

## 6. 证据抽查表

| AC | 证据文件（`evidence/acc9/`） | 是否有效 | 结论是否被支撑 | 备注 |
|---|---|---|---|---|
| AC-03 | `AC-03/single-pair{0,1,2}-{base,cur}.txt`、`code-loop-pair*`、`task-loop-pair*`、`result.json`、`verdict-r2.json` | 有效 | 是 | 原始 stdout 12 对；我另做未折叠归一化复核，diff 0 |
| AC-08 | `AC-08/trace-after-fix.txt`、`result-r2.json`、`execution-summary-events-r2.json` | 有效 | 是 | 9/9 行全等；`a3Exact:true` |
| AC-13 | `AC-13/stdout-{pending,timeout,crash,role,conn-rejected,conn-expired}.txt`、`result.json` | 有效 | 是 | 六行逐字；单原因夹具 |
| AC-16 | `AC-16/status-first.txt`、`status-second.txt`、`log-text.txt`、`result.json` | 有效 | 是 | 正常→需关注；A-8 行逐字；21 项 checks 0 fail |
| AC-17 | `AC-17/status.txt`、`status.md`、`graph.txt`、`graph.json`、`result.json` | 有效 | 是 | 两用户面同档；graph 无 health |
| AC-22 | `AC-22/trace-hold.txt`、`trace-delay-running.txt`、`trace-delay-done.txt`、`result.json` | 有效 | 是 | 同实例 `TRC-54a78f76` 两阶段 |
| AC-23 | `AC-23/badline-trace.txt`、`notime-trace.txt`、`missing-after-d26-r2.txt`、`result-d26.json` | 有效 | 是 | D-26 复验 29/29 |
| AC-26 | `AC-26/cancel.txt`、`log-text.txt`、`status.txt`、`result.json` | 有效 | 是 | A-14 四项全「未提供」 |
| AC-27 | `AC-27/log-text.txt`、`log.json`、`trace.txt`、`result.json` | 有效（时效备注） | 是 | 生成于 D-25 前，含已废止的失败摘要行；2/1/3 计数不受影响 |

**无效证据**：0 条。未发现空文件、只有结论无原始帧、或原始帧与 acceptance 结论矛盾的情况。

---

## 7. 判定抽查表

| AC | 需求 Then 摘要 | 验收期望 | 是否一致 |
|---|---|---|---|
| AC-04 | 四项逐字 + `instance log` 同摘要 + 成功节点也有摘要 | 逐字 A-4/A-12；JSON 四项逐项相等；成功实例摘要记录存在 | 一致 |
| AC-08 | 与附录 A-3 逐字一致 | 9/9 行全等（A-0 归一化），0 条失败摘要行 | 一致 |
| AC-13 | 六夹具六条 A-6 附行逐字 | 六条 stdout 逐字命中 | 一致 |
| AC-16 | 正常→需关注 + A-8 行 + JSON 码值 + 同档不重复 | 21 项 checks 覆盖全部字段与不重复条件 | 一致 |
| AC-26 | A-14 四项全「未提供」+ `已取消`/`已结束` + cancel exit 0 | 逐条命中；JSON 四项 `null`；无第二类会话事件 | 一致 |
| AC-27 | `T-001` 2 条 / `T-002` 1 条，摘要数 = 会话数，trace 跨度同 | 2/1/3 与 trace 2/1 命中 | 一致 |

**结论**：未发现「阻塞写成通过」或「逐字降级为包含」；首轮 FAIL（AC-03 机检、AC-08 A-3 多行）保持 FAIL 记录，修复后以 `-r2` 证据重新判定，未回填原记录。

---

## 8. 提交范围抽查

**功能 commit 文件范围**：

| commit | 文件 | 是否含 `evidence/**` 或 `probe/**` |
|---|---|---|
| `83833fa` WP-7 | `src/core/orchestrator.js`、`test/wp9/i19-orchestrator.test.js` | 否 |
| `f956580` WP-8 | `src/cli/main.js`、`src/daemon/server.js`、`test/wp9/i19-cli.test.js` | 否 |
| `a17e9fe` WP-9 | `test/wp9/i19-regression.test.js` | 否 |
| `0af69d8` S3 修复 | `src/cli/render.js`、`test/wp11/rpc.test.js`、`test/wp9/i19-render.test.js` | 否 |

**`git status --short` 终态**：

```
 M .workbuddy/memory/2026-11-09.md
 M docs/iterations/iteration-4/evidence/nfr-perf-atomic.json
 M docs/iterations/iteration-4/evidence/nfr-perf-batch.json
 M docs/iterations/iteration-4/evidence/nfr-perf-render.json
?? .workbuddy/memory/2026-11-10.md
?? docs/iterations/regression-2026-11-09.md
?? docs/iterations/regression-2026-11-09/
```

- 无 `src/**` / `test/**` 改动。
- `.workbuddy/memory/*` 与 `docs/iterations/regression-2026-11-09*` 是任务书声明的历史遗留。
- **性能证据改动登记（按要求未回滚）**：两次全量测试重写了 3 个 `nfr-perf-*.json`：
  - `nfr-perf-atomic.json`：3 行（`platform` `win32` → `darwin`；用例 `ms` `10.275 → 753.945`、`9.912 → 622.47`）；
  - `nfr-perf-batch.json`：1 行（`totalMs` `7.874 → 4521.054`）；
  - `nfr-perf-render.json`：2 行（`firstLineMs` `2.571 → 3.308`、`totalMs` `3.095 → 4.219`）。
  - 说明：改动是全量测试的副作用，数值受并行负载与平台影响，结构未变；未回滚，交主控统一处理。

---

## 9. Done 全项核对表（§4.5）

| # | 条件 | 核对结果 | 判定 |
|---|---|---|---|
| 1 | 需求里的任务全部通过 | 27/27 AC PASS（A 组 14 + B 组 13）；9 个 WP 均有 PASS 结论 | **PASS** |
| 2 | 零失败、零阻塞 | `不通过 = 0`、`阻塞 = 0` | **PASS** |
| 3 | 门禁全绿 | 依赖 0 / USAGE 25 / 纯净扫描 exit 0 / 会话计数 13-14-0 / wp9 119 / wp11 385 / wp12 190 / 三链 exit 与终态符合 / 全量按 D-2 差集口径通过（字面全绿未复现，见 §3） | **PASS（D-2 口径）** |
| 4 | 缺陷与遗留收口 | D-25/26/27 闭合；无未完成 AC；AC-16 真实事件计数、AC-22 hold 通道为已登记观察项；无 `blockers.md` 未处置项 | **PASS** |
| 5 | 终验与复核 | 本报告总判 PASS；主控需按 §3.5 自行复跑 3~5 条关键 AC（本报告已独立实跑三链、门禁与 9 条证据抽查） | **PASS** |
| 6 | 数字一致 | `acceptance-a/b`、27 份 `result.json` 与证据实盘一致（27 目录 / 255 文件 / 27 result）；`report.md` 尚未生成，属 S4 主控收口产物，需回填本报告数字 | **PASS（待主控回填 report.md）** |
| 7 | 需求评审闭环已 PASS | 需求 v7；7 轮独立评审，`review-round7.md` PASS（阻断 0 / 建议 0）；规划覆盖 12/12；DoR 13 条 12 绿 + 第 9 条按 D-2 口径偏离；头部版本与附录 C 一致 | **PASS** |

---

## 10. 总判定

**PASS**

一句话结论：I1.9 的 27 条 AC 全部通过、0 失败、0 阻塞，证据可复核、判定未被放宽、功能提交范围干净；门禁与三主链符合预期。唯一需要主控知悉的是本机两次全量测试因环境负载出现 5 / 9 条时序类额外失败（基线 8 条之外），全部单文件复跑通过，按已裁决的 D-2 口径不构成产品回归。

**存疑/待办（不影响 PASS，但需主控收口时处理）**：

1. `report.md` 尚未生成，需按本报告与 `acceptance-*.md` 回填数字，并在 §4/§5 登记本次全量的负载 flake 与残留 `orch core serve` 环境情况。
2. `progress.md` 的 S3 / S4 状态仍为「未开始」，需更新为已收口。
3. `AC-08/result.json`（修复前 `pass:false`）与 `result-r2.json` 并存、`AC-27` 证据早于 D-25，建议在报告或证据索引中注明「取最后一条」，避免后人误读。
4. `nfr-perf-*.json` 三文件已被全量测试改写（数值与平台字段变化），未回滚，见 §8。
5. AC-16 真实场景 `health.changed=0` 与 AC-22 `--hold-session` 无放行通道属已登记观察项，建议在 `report.md` §5 保留说明。

---

## 11. 声明

本终验 Agent 在本次工作中：

- **未修改**任何产品代码（`src/**`）、测试代码（`test/**`）、夹具、`package.json`、验收文档（`acceptance-*.md`）、需求文档（`requirement.md` / `iteration-9.md`）或决策文档（`decisions.md`）；
- **未执行** `git commit`、`git push`、`git reset` 等写操作；
- 仅新增本文件；复核脚本与日志只落在 `/tmp`（`/tmp/fv-chains.mjs`、`/tmp/fv-full.log`、`/tmp/fv-full2.log`、`/tmp/fv-wp*.log`）；
- `git worktree add /tmp/fv-base 322fb5e` 仅用于对照，已 `git worktree remove --force` 清理；
- 全量测试导致的 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 改写已登记、未回滚。

终验 Agent：S4（独立于实现 Agent 与验收 Agent）
时间：2026-11-12 06:05 CST
