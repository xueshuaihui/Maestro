# I1.9 验收报告 · B 组（AC-15 ~ AC-27）

- 验收组：S3 验收 Agent（B 组），与实现者分离，仅取证，不改产品代码与测试代码
- 被测基线：`40eb704`（`docs(I1.9): S2 batch-6 review PASS + D-24 + progress ledger, S2 closed`），S2 已收口
- 判据来源：`docs/iterations/iteration-9/requirement.md`（AC-15 ~ AC-27、§3.2/§3.3、附录 A-0 ~ A-14、附录 D-1 ~ D-11）、`docs/iterations/iteration-9/decisions.md`（D-1 ~ D-24，已裁决项不再判失败）、`progress.md`、`docs/iterations/iteration-7/baseline-failures.txt`
- 环境：macOS（Darwin 25.6.0 / x86_64）、Node `v22.22.2`、统一 `NODE_ENV=test`、统一 `--host mock`（mock ACP：`test/fixtures/mock-acp-agent.js`）
- 取证脚本（新建，可重跑）：
  - `probe/acc9-b-lib.mjs`（公共脚手架：起核心、spawn CLI、快照、规范化哈希、结果收集）
  - `probe/acc9-b-health.mjs`（AC-15 ~ AC-19）
  - `probe/acc9-b-chain-trace.mjs`（AC-20 ~ AC-25）
  - `probe/acc9-b-cancel-rounds.mjs`（AC-26 ~ AC-27）
- 证据根目录：`docs/iterations/iteration-9/evidence/acc9/AC-15` ~ `AC-27`，每条 AC 一个 `result.json`（`checks[]` 逐条 `ok/detail`）

---

## ① 范围与环境

### 1.1 范围

本组覆盖 I1.9 的 13 条验收项：健康度 TTL/事件/写回/只读/不回归（AC-15 ~ AC-19）、非功能契约（AC-20）、事件链兼容与重建（AC-21、AC-25）、追踪进行中与降级（AC-22、AC-23）、会话审计粒度与取消摘要与多轮摘要（AC-24、AC-26、AC-27）。

不在本组范围：AC-01 ~ AC-14（A 组）。

### 1.2 取证纪律（本组执行情况）

| 纪律 | 执行情况 |
| --- | --- |
| 夹具根一律 `os.tmpdir()` | 全部夹具建于 `/var/folders/.../T/acc9-b-*`，无仓库内夹具 |
| `NODE_ENV=test` | 所有 spawn 均注入（`acc9-b-lib.mjs` 的 `envFor()`） |
| 宿主统一 `--host mock` | 有 run 的场景全部显式 `--host mock` 并预置 `.orch/hosts/mock.json` |
| 写快照场景先空目录拉起核心再写 `state.json` | AC-15、AC-16、AC-21、AC-23、AC-25 均先 `startCoreOnEmptyRoot` 并断言「实例 INST-001 · 不存在」后再落盘 |
| `orch run` 带 `--cwd .` | 全部满足 |
| `code-loop`/`task-loop` task 含「产物：<文件名>」行 | 全部满足（否则 `verification.skipped`） |
| 每条 AC 产出证据 + 贴关键原文与退出码 | 见 ② 各条 |
| 冲突/不可构造登记「需主控裁决」 | 见 ③（3 条 + 1 条观察） |

### 1.3 复现命令

```bash
cd /Users/xuesh/www/Maestro
node probe/acc9-b-health.mjs          # AC-15 ~ AC-19
node probe/acc9-b-chain-trace.mjs     # AC-20 ~ AC-25
node probe/acc9-b-cancel-rounds.mjs   # AC-26 ~ AC-27
```

三个脚本末尾各打印 `PASS/FAIL` 汇总并以非零码退出（若失败），同时覆盖写入对应 `evidence/acc9/<AC>/result.json`。

---

## ② 逐 AC 判定表

| AC | 结论 | 证据路径 | 依据（一句） |
| --- | --- | --- | --- |
| AC-15 | **PASS** | `evidence/acc9/AC-15/` | 14m55s 不触发、15m05s 触发且为单原因「慢」、无起算时间不参与；单元等值边界 32/32 |
| AC-16 | **PASS** | `evidence/acc9/AC-16/` | 受控快照 normal → attention 恰 1 条 `health.changed`，`from/to/reasons/seq/prev_event_hash` 全对 |
| AC-17 | **PASS** | `evidence/acc9/AC-17/` | `state.health` 与 `status`/`status.md` 同档同原因，`graph` 文本/JSON 均无 health，实例目录无 `graph.json` |
| AC-18 | **PASS** | `evidence/acc9/AC-18/` | 三次 `status` + 三次 `trace show` 后输出逐字一致、四组深比较不变、`events.jsonl` 哈希不变 |
| AC-19 | **PASS** | `evidence/acc9/AC-19/` | 与 `322fb5e` 工作树对照，删健康度行后 `status` 逐字相等，`graph` 文本/JSON 逐字一致 |
| AC-20 | **PASS** | `evidence/acc9/AC-20/` | 零运行时依赖、31 词纯净扫描 0 命中、`src/daemon` 无宿主分支、新增中文非注释行 0、labels-sync 5/5 |
| AC-21 | **PASS** | `evidence/acc9/AC-21/` | legacy/truncated 两夹具旧字节不变、新 `seq` 从 4 连续、首条 `prev_event_hash` = 旧第 3 条规范化 sha256 |
| AC-22 | **PASS** | `evidence/acc9/AC-22/` | A-10 逐字成立（`跨度 0 条`、`进行中`、结束位 `—`、无「暂无追踪记录」），放行后变 `跨度 1 条`；**D-26 后复验仍 PASS**（见「复验」节） |
| AC-23 | **PASS** | `evidence/acc9/AC-23/` | missing → A-1；badline → 提示在汇总行前且 `跨度 2 条`；notime → 健康度「正常」不误判慢；**D-26 后三夹具复验全 PASS，存疑 2 闭合**（见「复验」节） |
| AC-24 | **PASS** | `evidence/acc9/AC-24/` | A-12 摘要行逐字、`execution.summary` 恰 1 条/会话、遗留实例事件字节不变、`object: 'session'` 计数 13 |
| AC-25 | **PASS** | `evidence/acc9/AC-25/` | 旧 3 行乱码字节不变、新 `seq` 从 1 起、首条 `prev_event_hash` 为 64 个 0、末行 `已跳过 3 行不可读记录` |
| AC-26 | **PASS** | `evidence/acc9/AC-26/` | A-14 四项全「未提供」、`state=cancelled`/`health.level=ended`、摘要四项均为 `null` |
| AC-27 | **PASS** | `evidence/acc9/AC-27/` | `T-001` 摘要 2 条（轮 1/2）、`T-002` 1 条、全文摘要数 = 会话数 3、每会话恰 1 条 |

合计：13 条 AC、201 项机检、0 项失败。

### AC-15 健康度 🟡 待投递超过 TTL 50%

夹具：三个 code-loop 快照实例，各只放一条 `pending` 交接包；`INST-001` `pendingAt = now - 895s`（14:55）、`INST-002` `now - 905s`（15:05）、`INST-003` 无 `pendingAt`/`createdAt`。先空目录起核心 → 断言「实例 INST-001 · 不存在」→ 再逐个 `orch instance status`。

```text
$ orch instance status INST-001
exit=0
实例 INST-001 · 运行中 · 模板 编码闭环
健康度 正常
...
$ orch instance status INST-002
exit=0
实例 INST-002 · 运行中 · 模板 编码闭环
健康度 慢 · 交接包 HO-001 待投递超过 TTL 一半
...
$ orch instance status INST-003
exit=0
健康度 正常
```

等值边界下沉单元级（`evidence/acc9/AC-15/unit-health.log`，`node --test test/wp12/health.test.js`）：`# tests 32 / # pass 32 / # fail 0`，含三条用例名原文 `TTL: now - pendingAt = 900000 (exact) -> NOT handoff_ttl_half`、`= 900001 -> handoff_ttl_half`、`= 899999 -> NOT handoff_ttl_half`。

结论：PASS（12/12）。触发阈值为严格大于 `TTL_HALF_MS = 900000`，三实例互不干扰（`INST-002` 读后状态仍 `pending`）。

### AC-16 健康度在实例状态变化后正确更新并进事件日志

两段取证：

1. 受控快照（机制判据）：首次查看得 `normal`，`firstWrite` 只写盘不发事件（`health.changed` 计数 0）；随后手写追加一条 `pending` 升级记录，二次查看得 `attention`，日志恰 1 条：

```text
$ orch instance log INST-001
exit=0
03:56:12  健康度 INST-001  正常 → 需关注  原因 有待处理升级
```

事件字段：`object=health`、`objectId=INST-001`、`from=normal`、`to=attention`、`detail.reasons=[pending_escalation]`、`seq = before + 1`、`prev_event_hash` 为 64 位十六进制；三次查看同档不再追加。

2. 真实场景对照（`real-task-loop-driver.txt` / `real-status.txt`）：`dispatch-fail-first` 真实运行后健康度为 `健康度 需关注 · 有待处理升级`，但 `health.changed` 计数为 **0** —— 因为 `orch run` 收尾的 `getStatus` 已完成首次补写（firstWrite 不发事件），此后档位不再变化。已登记为③第 1 条。

结论：PASS（21/21）。

### AC-17 健康度写入实例元数据并在两个用户面可见

真实 `task-loop-driver --scenario dispatch-fail-first`（`run` exit 4，升级收尾，预期）。

```text
$ orch instance status INST-001
exit=0
实例 INST-001 · 已挂起 · 模板 通用任务闭环
健康度 需关注 · 有待处理升级
...
$ cat .orch/instances/INST-001/status.md
- 健康度：需关注 · 有待处理升级
```

`state.json`：`health.level=attention`、`health.reasons=["pending_escalation"]`、保留 `nodeTimeoutMs`、`computedAt` 存在。`graph` 文本/JSON 均无 `健康度`/`health` 字段，且实例目录**不存在** `graph.json`。再次查看仍同档同原因。

结论：PASS（14/14）。

### AC-18 健康度只读

同一实例连跑三次 `orch instance status` 与三次 `orch instance trace show`（均 exit 0），三次数出逐字一致；`nodes`/`sessions`/`handoffs`/`escalations` 四组深比较不变，升级数仍 1，`events.jsonl` 字节 sha256 前后同为 `3109f974…12911c`，档位仍 `attention`。

结论：PASS（10/10）。

### AC-19 既有状态输出不回归：只允许新增一行健康度

`git worktree add --detach /tmp/acc9-b-base 322fb5e` 建对照树；`single`、`code-loop` 各跑一次，两棵树输出对照。

```text
# 当前树（single）
exit=0
实例 INST-001 · 已完成
健康度 已结束
节点 已完成 · 耗时 2s
# 基线树（single）
exit=0
实例 INST-001 · 已完成
节点 已完成 · 耗时 2s
```

- 健康度行恰 1 行，且紧跟实例状态行（`index=1`）；
- 删该行后与基线**逐字相等**（`single` 与 `code-loop` 均成立）；
- `graph` 文本与 JSON 两侧逐字一致，均无 health；
- 工作树用后 `git worktree remove --force` + `rm -rf`，无残留。

结论：PASS（18/18）。

### AC-20 非功能：零依赖 / 中文唯一来源 / 纯净扫描 / 无宿主分支

```text
dependencies 键数 = 0
OK: 扫描 24 个文件，src/core, src/daemon 内 task-loop, researcher, writer, reviewer,
    研究员, 撰写者, 审核者, code-loop, developer, tester, ... 零命中
src/daemon 宿主分支扫描：no host branch
git diff 322fb5e..HEAD 新增中文非注释行：none
labels-sync: # tests 5 / # pass 5 / # fail 0
```

补充交叉证据：`evidence/acc9/AC-20/i19-contract-tests.log` —— 9 个 I1.9 契约测试文件合计 `126 tests / 126 pass / 0 fail`。

结论：PASS（7/7）。

### AC-21 事件链历史兼容

- legacy：预置 3 条无 `seq`/`prev_event_hash` 旧记录 → 旧 3 行字节哈希不变（`8b0290b0…7d2a9d`），旧记录条数 3，新 `seq` 为 `4,5,6,…,19` 连续，新首条 `prev_event_hash = fd345617…6fc90f` 且等于第 3 条规范化 sha256；`instance log` 无「不可读行」提示。
- truncated：预置 3 条完整 + 第 4 条截断半行（带行尾 `\n`）→ 旧 4 行字节哈希不变（`2b059e44…2dea2ca`），新 `seq` 从 4 连续，新首条 `prev_event_hash` 仍为第 3 条规范化 sha256，文本视图末行：

```text
已跳过 1 行不可读记录
```

结论：PASS（20/20）。

### AC-22 进行中的跨度

`--hold-session` 实例（当前代码创建，带 `TRC-002568ef`）：

```text
$ orch instance trace show INST-001
exit=0
实例 INST-001 · 追踪 TRC-002568ef
跨度 0 条 · 回流 0 次

03:59:59 → —  T-001  进行中  交接 HO-001

回流链
无
```

逐字命中 A-10，且不出现「暂无追踪记录」。另用 `--turn-delay-ms 30000` 的同形运行中窗口复验：运行中 `跨度 0 条` + `进行中`/`—`，放行后 `跨度 1 条 · 回流 0 次` 且无「进行中」、跨度行有起止时刻。

结论：PASS（16/16）。hold 无「放行完成」通道，见③第 3 条。

### AC-23 追踪三降级

| 夹具 | 输出 | 退出码 |
| --- | --- | --- |
| missing（历史空号形态：无 `traceId` + 无追踪文件） | `实例 INST-001 · 暂无追踪记录` | 0 |
| badline（`{"trace_id":` 半行 + 2 条正常） | 见下 | 0 |
| notime（6 条仅 `end_time`、无 `start_time`） | `健康度 正常` | 0 |

```text
# badline
实例 INST-001 · 追踪 TRC-0000aaaa
追踪记录有 1 行不可读，已跳过
跨度 2 条 · 回流 0 次
```

三夹具均无堆栈；`missing`/`badline` 的 `status` 健康度照常为「正常」，`notime` 不误判为「慢」。

结论：PASS（19/19）。missing 夹具口径见③第 2 条。

### AC-24 会话审计粒度

`--fail-tool` 真实失败节点，`run` exit 1。

```text
$ orch instance log INST-001
exit=0
04:00:52  会话 mock-sess-30733-1  空闲 → 执行中  原因 session.state
04:00:52  会话 mock-sess-30733-1  执行中 → 执行中（tool_call）  原因 session.state
04:00:52  会话 mock-sess-30733-1  执行中 → 执行中（agent_message_chunk）  原因 session.state
04:00:53  会话 mock-sess-30733-1  执行中 → 等待下游  原因 output.submitted
04:00:53  会话 mock-sess-30733-1  等待下游 → 空闲  原因 run.failed
04:00:53  会话 mock-sess-30733-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log
```

- A-12 摘要行逐字，`execution.summary` 恰 1 条 = 会话数 1，`object=session`、`result=note`、`detail.nodeId=T-001`、四项取值与夹具一致；
- 除摘要外无新增会话级事件类型（会话 reason 集合 ⊆ 冻结白名单 `{session.state, output.submitted, run.failed}`，见 `baseline-session-reasons.txt`：`322fb5e` 基线实跑集合为 `output.submitted,run.failed,session.state`，无 `execution.summary`）；
- 预置逐条会话记录的遗留实例：`events.jsonl` 字节哈希与文本均不变，旧逐条记录仍可读；
- 审计粒度计数：`orchestrator.js` `object: 'session'` = **13**（D-24），`src/core` 合计 14（`escalation.js` 存量 1），`src/daemon` 0；
- 完整宿主日志未复制进实例目录。

结论：PASS（22/22）。

### AC-25 事件链整份不可解析

预置 3 行乱码（无一条可解析）后跑 `orch run`：

```text
exit=0
...
04:01:02  会话 mock-sess-30845-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供
已跳过 3 行不可读记录
```

- 旧 3 行字节原样保留（新文件以旧字节为前缀），哈希不变；
- 新 `seq` 从 1 起连续无空洞，新链首条 `prev_event_hash` 为 64 个 0；
- `log --json` 只含新链；无「校验失败/链已断」报错。

结论：PASS（11/11）。

### AC-26 取消收尾的执行摘要

`--turn-delay-ms 30000` 让会话停在 `tool_running`（`tool-running-event.json` 记录到 `session state → tool_running`，`reason=session.state`），由第二进程 `orch cancel`：

```text
$ orch cancel --instance INST-001
exit=0
会话 空闲
节点 T-001 worker 已取消
交接包 HO-001 已拒绝（已撤回）
```

```text
$ orch instance log INST-001
...
04:02:25  会话 mock-sess-33274-1  执行中 → 空闲  原因 run.cancelled
04:02:25  会话 mock-sess-33274-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供

$ orch instance status INST-001
exit=0
实例 INST-001 · 已取消
健康度 已结束
```

`state.json`：`state=cancelled`、`health.level=ended`；JSON 中取消会话 `execution.summary` 恰 1 条，四项均为 `null`。仅记录 `summaryTs` 与 `instanceCancelledTs` 供人工核对（`ts-note.json`），**未对 ts 做等值断言**（D-15）。除 `execution.summary` 与既有冻结会话事件外无新增类型。

结论：PASS（12/12）。

### AC-27 同一节点多轮摘要

`code-loop-driver --scenario backflow-once --stop-after 3 --keep` 后台启动，轮询到 `.mock/stopped-after-3` 冻结点（`state=running`、会话数 3）取证，再写 `.mock/release` + `SIGINT` 正常收尾。

- 全文摘要条数 = 会话数 3；`T-001` 恰 2 条（轮 1、轮 2），`T-002` 恰 1 条（轮 1）；每会话恰 1 条；文本视图摘要行数同为 3；
- `trace show` 中 `T-001` 跨度行 2 条、`T-002` 1 条，汇总 `跨度 3 条 · 回流 1 次`：

```text
$ orch instance trace show INST-001
exit=0
实例 INST-001 · 追踪 TRC-55bba0a1
跨度 3 条 · 回流 1 次

04:02:31 → 04:02:32  T-001 开发  已完成  交接 HO-001
04:02:32 → 04:02:34  T-002 测试  失败  交接 HO-001 HO-002
  失败摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供
04:02:35 → 04:02:36  T-001 开发  已完成  交接 HO-002

回流链
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

结论：PASS（19/19）。

---

## ③ 失败或存疑清单

无 FAIL 判定。以下 2 条为**需主控裁决/知悉**事项（验收结论未因此放宽，亦未改动实现），第 2 条已由 D-26 复验闭合，另有 1 条观察项与 1 条补充观察。

### 1. AC-16 真实场景 `health.changed` 为 0 条（需主控裁决）

- 任务书字面期望「task-loop `dispatch-fail-first` 健康度事件恰一条」；实测真实场景为 **0 条**。
- 机理：`orch run` 收尾的 `getStatus` 已完成首次补写（`firstWrite`，`prevLevel === null`），按设计只写盘不发事件（BR-15）；run 结束后档位恒定，不再产生变化事件。
- 已用受控快照（`normal` → `attention`）证明「档位变化恰 1 条」的机制成立，`from/to/reasons/seq/prev_event_hash` 全对。
- 若主线要求**真实运行**也必须恰 1 条 `health.changed`，则该要求与 BR-15 冲突，需主控裁决；本组按现行为判 PASS 并在此显式登记。

### 2. AC-23 missing 夹具口径（**已闭合**，D-26 复验）

- 原登记：AC 字面写「正常工作实例删掉追踪文件」，但（D-26 之前）当前代码创建的实例带 `state.traceId`，删 `traces.jsonl` 后实际输出为 `追踪 TRC-xxx / 跨度 0 条 · 回流 0 次 / 空行 / 回流链 / 无`，并非 A-1；当时按 D-23 口径改用「历史实例（无 `traceId`）+ 无追踪文件」取证。
- **主控 D-26 裁决**：`hasTrace` 改为「跨度数组（含进行中叠加）非空」，不再依赖 `traceId`。复验结果：当前代码真实跑出的实例（`traceId = TRC-3ed3a6be`、删前 `traces.jsonl` 有 1 条跨度、删后文件不存在）→ `orch trace show` **逐字输出 `实例 INST-001 · 暂无追踪记录`、exit 0、无堆栈**。
- 原口径分歧（新实例不可达 A-1）已消失，本节存疑**关闭**；原历史实例取证与 D-26 复验结论一致，互为印证。详见「复验（D-26 之后）」。

### 3. AC-22 `--hold-session` 无「放行完成」通道（需主控知悉）

- mock 的 `--hold-session` 只能被 cancel 唤醒，无法在同一实例上制造「运行中 → 放行 → 已完成」。
- 处理：hold 实例仅用于 A-10 逐字判据，并以 `orch cancel` 结束（不冒充「放行完成」）；「运行中 → `跨度 1 条`」改用 `--turn-delay-ms 30000` 的同形运行中窗口复验。两者均为当前代码创建的实例，符合 D-23。
- A-10 与放行后形态各自成立，但严格意义上的「同一实例两阶段」未被单实例跑通。

### 4. 观察项（非缺陷）：AC-16 快照 `status` 显示 `原因：?`

- 受控快照中手工追加的升级记录未带 `reason` 字段，`instance status` 的升级明细显示 `原因：?`。属夹具补丁的字段缺失，不影响健康度判据（`pending_escalation` 按「存在待处理升级」判定）。真实场景（AC-17）显示正常：`原因：派遣失败：目标会话不可用`。

### 补充观察（不计入判定）

- AC-27 文本视图中摘要行不带 `[#n]` 序号，且序号计数跳过对应位置（如 `[#9]` 后直接 `[#11]`）。与「逐条状态进主审计、摘要独立成行」的设计取向一致，仅备案。

---

## ④ 证据分级统计

| 分级 | 条数 | 涉及 AC |
| --- | --- | --- |
| **真实核心 + CLI**（真实 `bin/orch.js` 子进程 + 真实 daemon/IPC + mock 宿主/快照） | 13 | AC-15 ~ AC-27 全部（每条均有真实进程级证据） |
| **单元级**（补充证据，非唯一依据） | 2 | AC-15（`test/wp12/health.test.js` 32/32，TTL 等值边界下沉）；AC-20（`labels-sync` 5/5 + 9 个 I1.9 契约测试文件 126/126） |
| **纯静态扫描**（AC-20 主判据） | 1 | AC-20（依赖树、31 词纯净扫描、`src/daemon` 分支扫描、`git diff` 中文行统计） |
| **受阻/未取证** | 0 | — |

机检规模：13 份 `result.json`，`checks` 合计 **201** 项，`failed` 合计 **0**。

| AC | checks | failed | 证据文件数 |
| --- | --- | --- | --- |
| AC-15 | 12 | 0 | 6 |
| AC-16 | 21 | 0 | 7 |
| AC-17 | 14 | 0 | 7 |
| AC-18 | 10 | 0 | 7 |
| AC-19 | 18 | 0 | 17 |
| AC-20 | 7 | 0 | 6 |
| AC-21 | 20 | 0 | 7 |
| AC-22 | 16 | 0 | 6 |
| AC-23 | 19 | 0 | 7 |
| AC-24 | 22 | 0 | 8 |
| AC-25 | 11 | 0 | 4 |
| AC-26 | 12 | 0 | 9 |
| AC-27 | 19 | 0 | 5 |
| 合计 | **201** | **0** | **96** |

---

## ⑤ 未覆盖项与理由

| 未覆盖项 | 理由 |
| --- | --- |
| AC-01 ~ AC-14 | 属 A 组范围，本组不重复取证 |
| 非 mock 宿主的健康度/追踪行为 | 任务书规定宿主统一 `--host mock`；真实宿主（DSH 等）不在本次验收范围 |
| `--hold-session` 的「放行后完成」单实例链路 | mock 无放行通道，见③第 3 条；已用同形窗口替代取证 |
| 带 `traceId` 新实例删除追踪文件后的 A-1 分支 | 该形态实际不落 A-1，见③第 2 条；本组按 D-23 用历史实例取证 |
| 真实场景 `health.changed` 恰 1 条 | 与 BR-15 冲突，见③第 1 条；已用受控快照证明机制 |
| 取消时 `summary.ts` 与 `instanceCancelledTs` 的等值关系 | D-15 已裁决不保证，本组按裁决不做断言 |
| 长时压测 / 性能指标 | 不在 I1.9 AC 范围 |
| Windows 平台 | 本次环境为 macOS，未做跨平台复验 |

---

## 复验（D-26 之后）

- 复验触发：主控 **D-26**（`decisions.md`）——`renderTraceShow` 的 `hasTrace` 由「`traceId` 存在 || 跨度非空」改为「跨度数组（含进行中叠加）非空」，`traceId` 只在有跨度行时用于首行。
- 复验基线：仍为 `40eb704` + 工作区未提交的 D-26 改动（`src/cli/render.js` +14/−3；`test/wp9/**`、`test/wp11/rpc.test.js` 同步改动，119/119 由实现方给出）。
- 复验脚本（新建）：`probe/acc9-b-r2-d26.mjs`，复用 `probe/acc9-b-lib.mjs`；夹具根 `os.tmpdir()`、`NODE_ENV=test`、`--host mock`。
- 结果文件：`evidence/acc9/AC-23/result-d26.json`（29/29 PASS，不覆盖原 `result.json`）。
- 纪律：只读产品代码；未改 `src/**`、`test/**`、夹具、`package.json`、需求/决策文档；未 commit。

### R1 · AC-23 missing（当前代码实例 + 删除追踪文件）

夹具构造（与 D-26 前不同，**不再用历史空号**）：`orch run --template single --host mock` 真实跑完一个实例 → 确认 `state.traceId` 与 `traces.jsonl` 跨度行 → `core stop` → 删除 `traces.jsonl` → 重新查看追踪。

```text
$ orch trace show INST-001
exit=0
实例 INST-001 · 暂无追踪记录
```

```json
{ "runExit": 0, "traceId": "TRC-3ed3a6be", "spansBeforeDelete": 1,
  "tracesExistsAfterDelete": false, "traceShowExit": 0,
  "traceShowStdout": "实例 INST-001 · 暂无追踪记录\n" }
```

`instance status` 同实例 exit 0、健康度照常给出：

```text
实例 INST-001 · 已完成
健康度 已结束
```

判据逐条：逐字 A-1 ✅、exit 0 ✅、无堆栈 ✅、健康度照常 ✅。**存疑 2 闭合**（原分歧点「新实例删文件不可达 A-1」已消失）。

### R2 · AC-23 badline（1 条坏行 + 2 条正常跨度）

```text
$ orch trace show INST-001
exit=0
实例 INST-001 · 追踪 TRC-0000aaaa
追踪记录有 1 行不可读，已跳过
跨度 2 条 · 回流 0 次

10:00:00 → 10:00:10  T-001  已完成  交接 无
10:00:10 → 10:00:30  T-002  已完成  交接 无

回流链
无
```

判据：A-11 提示行位于汇总行之前（第 2 行）✅、正常跨度 2 条 ✅、exit 0 ✅、无堆栈 ✅。

### R3 · AC-23 notime（跨度缺起止时刻）

```text
$ orch trace show INST-001
exit=0
实例 INST-001 · 追踪 TRC-0000bbbb
跨度 6 条 · 回流 0 次

--:--:-- → 10:00:10  T-001  已完成  交接 无
...（共 6 行，起点均渲染为 --:--:--）
```

```text
$ orch instance status INST-001
exit=0
实例 INST-001 · 运行中
健康度 正常
```

判据：exit 0 ✅、无堆栈 ✅、6 条缺 `start_time` 的跨度不构成 P90 样本；同时运行中节点 `T-006` 的 70s 未超 `nodeTimeoutMs=300000`，故健康度仍「正常」、不误判为「慢」✅。

### R4 · AC-22 回归（防 D-26 误伤 A-10）

`--hold-session` 停在运行中的当前代码实例（`traceId = TRC-8f496e5c`）：

```text
$ orch trace show INST-001
exit=0
实例 INST-001 · 追踪 TRC-8f496e5c
跨度 0 条 · 回流 0 次

04:43:49 → —  T-001  进行中  交接 HO-001

回流链
无
```

判据：首行带 `TRC-xxxxxxxx` ✅、`跨度 0 条 · 回流 0 次` ✅、跨度行 `HH:MM:SS → —  T-001  进行中  交接 HO-001` ✅、末两行「回流链」「无」✅、**不出现「暂无追踪记录」** ✅、exit 0 ✅。

机理核对：hold 实例的 `spans` 已含进行中叠加（`overlayRunningSpans`），`spans.length === 1 > 0`，故 `hasTrace` 为真 → 不会被 D-26 的空态分支吞掉。

### R5 · 实现方「`test/wp9/**` 119/119」声明的独立复核

`NODE_ENV=test node --test test/wp9/*.test.js` 独立复跑三次：

| 次序 | tests | pass | fail |
| --- | --- | --- | --- |
| 第 1 次 | 119 | 118 | **1**（当次仅取尾部输出，未落完整 TAP，无法定位用例名） |
| 第 2 次 | 119 | 119 | 0 |
| 第 3 次 | 119 | 119 | 0 |

D-26 直接改动的两个文件（`i19-render.test.js`、`i19-cli.test.js`）连续 3 次 `44/44` 全绿。第 3 次完整日志已归档：`evidence/acc9/AC-23/wp9-after-d26-r2.log`。

**结论**：`test/wp9/**` 的 D-26 相关用例稳定通过；第 1 次的单例失败未能复现、且未留下用例名，原因未定位（可能是本机并发夹具/耗时敏感导致的环境波动），**不作为 D-26 的缺陷证据**，但建议主控在全量回归时留意 flaky。

### 复验结论

| 项 | 结论 | 关键依据 |
| --- | --- | --- |
| AC-23 missing | **PASS** | `实例 INST-001 · 暂无追踪记录`，exit 0；`traceId=TRC-3ed3a6be` 仍在、`traces.jsonl` 已删 |
| AC-23 badline | **PASS** | A-11 在汇总行前、`跨度 2 条`，exit 0 |
| AC-23 notime | **PASS** | 健康度「正常」不判慢，exit 0 |
| AC-22 hold | **PASS** | A-10 逐字成立，exit 0，无「暂无追踪记录」 |
| 存疑 2（AC-23 missing 口径） | **闭合** | D-26 后新实例删文件即落 A-1，原口径分歧消失 |

**复验合计：4 项复验 / 29 项机检 / 0 失败；AC-22、AC-23 结论维持 PASS。**

### 对原章节的影响（不改原文，仅此声明）

- ⑤ 未覆盖项中「带 `traceId` 新实例删除追踪文件后的 A-1 分支」一项，经 D-26 复验**已覆盖**，以本节 R1 为准。
- 结论中「3 条需主控裁决/知悉」的计数，因存疑 2 闭合，现为 **2 条**（AC-16 真实场景事件计数、AC-22 hold 无放行通道）。
- 另注（D-25，同批改动）：四项全 `null` 的会话摘要不再渲染「失败摘要」行。AC-27 原证据中的该行为 `未提供 · 未提供 · 未提供 · 未提供`，D-25 后不再出现；AC-27 的判定依据（`instance log` 每轮摘要条数、`trace` 跨度条数）不依赖该行，19/19 结论不变。此为 D-25 的设计效果，非回归。

---

## 结论

**PASS 13 / FAIL 0 / 阻塞 0**

13 条 AC（AC-15 ~ AC-27）全部通过，201 项机检 0 失败；另登记 3 条需主控裁决/知悉事项与 1 条观察项（均不影响 PASS 判定）。未改动 `src/**`、`test/**`、任何夹具与 `package.json`，未执行 git commit。
