# I1.3 验收中发现的缺陷（只记录，不修）

> 纪律：`src/**`、`test/**`、`bin/**` 只读。发现产品/夹具缺陷一律记在这里，由验收负责人决定处置。
> 每条格式：AC 编号 / 现象 / 最小复现命令 / 原始输出片段 / 疑似代码位置。

（暂无。脚手架 smoke（AC-01）未发现缺陷。）

## 记录模板

### BLK-xx ｜ AC-xx ｜ 一句话现象

- **现象**：
- **最小复现**：
  ```bash
  node probe/acc3-f-run.mjs AC-xx
  # 或
  node test/fixtures/task-loop-driver.mjs --root <根> --scenario <场景> ...
  ```
- **原始输出片段**：
  ```text
  （粘贴 evidence/AC-xx.output.json 里的 stdout/stderr，不要改写）
  ```
- **疑似代码位置**：`src/core/xxx.js:NN`（只读定位，未修改）
- **影响**：哪几条 Then/And 不成立 / 哪条 AC 因此阻塞

---

## 批次 C（AC-22 ~ AC-35）记录

### BLK-C1 ｜ AC-25 / AC-26 ｜ 占用方首派未返回时，同目录第二次发起得到 IPC_TIMEOUT 而不是 DIR_BUSY

- **现象**：目录占用方停在**第 1 次派发**（`session/new` 内暂停）时，同目录的第二次 `orch run` 不会返回 `DIR_BUSY`，而是排在 `@dir:` 锁上直至 60s 握手超时，输出「未知错误：IPC_TIMEOUT」，退出码 1。占用方停在首次派发之后（如 `hold.when='prompt'`、第 2 次派发）时行为正确。
- **最小复现**：
  ```bash
  node test/fixtures/code-loop-driver.mjs --root <根> --scenario hold-forever --cwd <根>/demo-doc --keep   # 后台，等 .mock/paused
  cd <根> && node <repo>/bin/orch.js run --cwd ./demo-doc --task "写一篇发布说明。产物：release-notes.md" --template task-loop --host dsh
  ```
- **原始输出片段**（首次尝试 AC-26 方向二时实测，耗时 63.3s）：
  ```text
  未知错误：IPC_TIMEOUT
  ```
- **疑似代码位置**：`src/core/orchestrator.js:2779-2781`（只对「显式 instanceId 且 activeRuns 命中」做前置拒绝，不覆盖同目录的新实例）与 `:2787`（`withLock(dirKey)` 把 `claimRun` 连同首派一起罩住）。
- **影响**：AC-25 / AC-26 在「占用方首派尚未返回」这一时刻拿不到需求要求的「该目录已有未结束的实例 INST-001，本次未发起」。AC-25/AC-26 的正式判据用「首派之后」的暂停点（`doc-hold-research` 的 `hold.when='prompt'`、`hold-test` 的第 2 次派发），两条 AC 判定仍为通过；此处只登记该时刻的偏差。建议：在取 `@dir` 锁之前先用 `store.list()` 做一次目录占用快检（与 `findDirBusy` 同口径）。

### BLK-C2 ｜ AC-35 ｜ `startedAt` 与第 1 轮 `node.dispatch` 事件 ts 稳定差 4~8ms（逐字等式不成立）

- **现象**：`T-002.startedAt` 早于第 1 轮 `node.dispatch` 事件的 `ts` 4~8ms，`=` 判据不成立；语义（取第 1 轮、第 2 轮不重置）成立。
- **最小复现**：
  ```bash
  node probe/acc3-f-run.mjs AC-35
  ```
- **原始输出片段**：
  ```text
  startedAt=2026-11-06T13:24:10.809Z vs dispatch=2026-11-06T13:24:10.817Z（差 8ms）
  ```
- **疑似代码位置**：`src/core/orchestrator.js:1121-1126`（`at = iso()` 先写 `startedAt`/`roundStartedAt`）与 `:1134-1145`（`saveState` 落盘之后才 `emit`，事件 `ts` 由 bus 生成）。
- **影响**：AC-35「And 机检：T-002 的 `startedAt` = 第 1 轮 `node.dispatch` 事件 ts」不成立（其余 19 条成立）。该等式与「先落盘再发事件」的因果顺序天然冲突，且随磁盘延迟抖动（4~8ms），**疑似需求措辞精度问题而非功能缺陷**；建议改判据为「`startedAt` ≤ 第 1 轮 `node.dispatch` ts 且 > `run.started` ts」，或让 `node.dispatch` 复用 `at` 作为事件 `ts`。

---

## 批次 D（AC-36 ~ AC-39 + AC-41 ~ AC-45）记录

### BLK-D1 ｜ AC-39 ｜ `task-loop` 的 `result='note'` 事件行把英文 reason 当中段，还重复「原因」段

- **现象**：`orch status --instance INST-001 --events` 在 `task-loop` 下，`result='note'` 的事件行渲染成
  `[#<seq>] <时间>  节点 T-00n  <英文 reason>  原因 <中文词>`，与 A-2 第 7 段 / D-5「note 行中段直接用中文原因词、
  **不再追加「原因」段**（如 `[#12] 10:00:10  节点 T-003  读取审核`）」不符。实际泄漏的英文 reason：
  `review.evidence_verified`、`review.read`、`review.rejected`、`review.passed`、`backflow.constructed`；
  其中 `review.passed` 正是 AC-39 点名的反例。
- **最小复现**：
  ```bash
  node test/fixtures/task-loop-driver.mjs --root <根> --scenario doc-backflow-once
  cd <根> && node <repo>/bin/orch.js status --instance INST-001 --events | grep -n 'review\.'
  # 或
  node probe/acc3-f-run.mjs AC-39
  ```
- **原始输出片段**（`docs/iterations/iteration-3/evidence/AC-39.status.txt`，节选）：
  ```text
  [#8] 21:42:48  节点 T-001  review.evidence_verified  原因 证据核对通过
  [#31] 21:42:49  节点 T-003  review.read  原因 读取审核
  [#33] 21:42:49  节点 T-003  review.rejected  原因 审核驳回
  [#37] 21:42:49  交接包 HO-003  backflow.constructed  原因 构造回流
  [#59] 21:42:49  节点 T-003  review.passed  原因 审核通过
  ```
- **疑似代码位置**：`src/cli/render.js:826-831`（`eventMiddle()` 只处理 `node.dispatch` 与 `escalation→pending`，
  没有 `result==='note'` 分支）→ `:810-823`（`legacyMiddle()` 在 `from/to/note` 都为空时返回 `String(event.reason)`）；
  `:864`（`renderEventLine` 无条件追加 `  原因 ${eventReasonText(event)}`）。需求落点：`requirement.md:1307`（A-2 第 7 段）与 `:1647`（D-5 note 行渲染）。
- **影响**：AC-39 的「And 输出不含任何未翻译的英文 reason（如 `review.passed`、`node.dispatch`）」不成立
  （同一根因使 2 条核对项失败：全量 reason 枚举 + `review.passed`；其余 24 条通过）。用户可见面出现英文机器码，
  风险定级 **P1**。修复时必须按 D-5 只对 `task-loop` 分流（`single` / `code-loop` 保持 I1.2 版式），
  否则会踩 AC-36 的输出回归红线；本迭代未修改产品代码。
