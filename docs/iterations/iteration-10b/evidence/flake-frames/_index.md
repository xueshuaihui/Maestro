# I1.10b 批次 4 · flake / 环境红隔离复跑留帧

> 依据：`decisions.md` 裁决 G（差集判定 + 隔离复跑 + 留证）、`review-batch2.md` S-B2-02、
> `review-batch3.md` S-B3-03、WP-6 门禁要求。目录与帧均为 WP-6 新建；**未改动任何既有 evidence 文件**。

判定口径：允许集合 = win32 16 条登记项 ∪ 历史 8 条基线 ∪ 已登记 `AC-04` / `HANDOFF_EVIDENCE_ESCAPE`
∪ 已留帧 flake。本机两条环境/时序红**已显式登记在允许集合内**，故差集判定归零；
留帧只用于如实记录隔离复跑结论，**不放宽任何断言、不要求本机全绿**。

| # | 登记项 | 归属测试文件 | 隔离复跑命令 | 帧 | 结论 |
|---|---|---|---|---|---|
| 1 | `AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新` | `test/wp13/instance-list.test.js` | `NODE_ENV=test node --test --test-concurrency=1 test/wp13/instance-list.test.js` | `AC-04-timing-instance-list-20261117T000000.log` | 隔离复跑**仍红**（2s 时序窗口：期望 `running`，实得 `completed`，`# fail 1`）。属 TIMING 环境类，已在允许集合内（AC-04 登记项 + R-08 允许项），按差集口径判允许。 |
| 2 | `HANDOFF_EVIDENCE_ESCAPE：符号链接绕过` | `test/wp11/handoff-schema.test.js:182` | `NODE_ENV=test node --test --test-concurrency=1 test/wp11/handoff-schema.test.js` | `HANDOFF_EVIDENCE_ESCAPE-symlink-handoff-schema-20261117T000000.log` | 隔离复跑**仍红**（本机 `EPERM: operation not permitted, symlink`，文件 `# tests 37 / # pass 34 / # fail 3`）。属 Windows symlink 权限环境限制（[PRIV]，见 `review-round3.md:464`），已在允许集合内，按差集口径判允许。 |

备注：`review-batch3.md` S-B3-03 另登记 `实例创建即有 state.traceId…`（`test/wp9/i19-orchestrator.test.js`，
独占复跑 2/2 PASS）属并发/时序 flake；本目录仅建档任务点名的上述两条环境/时序红，
该条如在全量中观测到，按「新红复核 → 单文件独占复跑通过 → 记 flake」口径另行留帧，不改判定强度。

---

## 裁决 K 复判补帧（2026-11-17）

> 依据：`decisions.md` 裁决 K 第 2 条——验收 Agent 必须补两类原始帧才可改判 AC-34；主控独立复核干净 HEAD 的 TAP。
> 本复判**只补帧、不改判据**：`tests ≥ 1425` 与「相对基线新增红 = 0」仍成立，未放宽任何断言、未改任何 AC 的 Then。

### ① 干净 HEAD 基线帧（`818576f^` = `18438d6`，S0/S1 基线，无 I1.10b 实现）

用 `git worktree add --detach` 在 `%TEMP%/maestro-ac34-baseline-818576f-parent` 建只读工作树（`git rev-parse HEAD` = `18438d60be38aace5e4290c83b963ff656a6128e`），分别隔离复跑，TAP 原始输出落本目录：

| 帧 | 命令（cwd = 基线 worktree） | exit | TAP 摘要 | 失败项标题 |
|---|---|---|---|---|
| `baseline-HEAD-handoff-schema-20261117-013949.log` | `NODE_ENV=test node --test test/wp11/handoff-schema.test.js` | 1 | `#tests 37 / #pass 34 / #fail 3 / #skipped 0` | `not ok 12 - HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`（`EPERM ... symlink ... link.js`，`test/wp11/handoff-schema.test.js:182:1`）；另 `not ok 31 resolveEvidenceRef 纯路径判定`、`not ok 33 可注入 fs：stat 结果决定通过，且不产生任何写`（均为 Windows 盘符/路径分隔符环境类） |
| `baseline-HEAD-instance-list-20261117-013949.log` | `NODE_ENV=test node --test test/wp13/instance-list.test.js` | 1 | `#tests 2 / #pass 1 / #fail 1 / #skipped 0` | `not ok 2 - AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新`（`expected 'running' / actual 'completed'`，`test/wp13/instance-list.test.js:332:1`） |

**结论**：两条在干净 HEAD 上同样红 ⇒ 裁决 K 的事实前提成立，属 S0 开工基线既有红，**不算本迭代新增红**。

### ② 本工作树文件级隔离复跑帧（已有，直接引用）

`docs/iterations/iteration-10b/flake-frames/` 下 4 帧：`handoff-schema-20261117-013251.log`、`handoff-schema-confirm-20261117-013259.log`（`not ok 12`，`#fail 3`）；`instance-list-20261117-013251.log`、`instance-list-confirm-20261117-013259.log`（`not ok 2`，`#fail 1`）。与基线帧失败项标题逐字一致。

### ③ 全量 TAP 帧复核

`evidence/AC-34.fullrun.tap.txt`：`#tests 1524 ≥ 1425`、`#pass 1500 / #fail 15 / #skipped 9`；`evidence/AC-34.diffset.txt` 的差集成员确为上述两条（其余 13 条在 win32 16 条登记项内）。按裁决 K：允许集合 = 16 ∪ 既有红 2 ∪ flake = 18，`observedFail 15 ∖ allowed 18 = 0` ⇒ AC-34 复判**通过**。
