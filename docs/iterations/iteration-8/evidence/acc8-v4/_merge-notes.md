# acc8-v4 证据根：合并口径说明

- 生成时间：2026-11-21
- 需求依据：`docs/iterations/iteration-8/requirement.md` **v4**（四轮独立评审，`review-v4-round4.md` 总判 **PASS / 阻断 0 / 建议 4**）

## 为什么要单独开证据根

需求 v4 修订后，原 10 条不通过中的 8 条需求冲突（AC-15 / AC-23 / AC-37 / AC-42 / AC-43 / AC-45 / AC-63 / AC-67）
的 Then / 机检 / 夹具期望值都变了。为保留审计链，**v3 原始判定与原始帧一字不改**，仍留在 `evidence/acc8/`；
v4 重跑用 `ACC8_EVID=acc8-v4 NODE_ENV=test node probe/acc8-f-run.mjs <AC>` 写在本目录。

## 合并规则

| 来源 | AC | 判定来源 | 核对项 | 被引用帧 |
|---|---|---|---|---|
| v3 未变（沿用） | 59 条（除下列 8 条） | `evidence/acc8/_acc8-f-results.jsonl` | 616（601 通过 / 15 失败） | 389 |
| v4 重跑 | AC-15 / AC-23 / AC-37 / AC-42 / AC-43 / AC-45 / AC-63 / AC-67 | 本目录 `_acc8-f-results.jsonl`（重跑原始记录） | 108（108 通过 / 0 失败） | 66 |
| 夹具返工重跑（裁-21m） | AC-58 / AC-62 | 本目录（v3 原始帧仍在 `evidence/acc8/`） | 25（25 通过 / 0 失败） | 27 |
| **合并** | **67 条** | 本目录 `_acc8-f-results.jsonl`（59 + 8 + 2，按 AC 号排序） | **724（723 通过 / 1 失败）** | **457** |

合并后判定：**65 通过 / 0 不通过 / 2 阻塞（AC-26 / AC-27，裁-21b 书面豁免）**。唯一失败核对项属于阻塞 AC-27。

**夹具解释披露（须终验复核）**：AC-58 的 `e2e` 图由 `backflow` 改为 `pass`，原回流的「首轮故意失败 → 重测 T-001」与需求 Then「已完成节点不重跑」在同一 kill 点不可兼得；改后由「交接包重投 + 已完成节点保留」承担可验面。若终验不认此解释，须先改需求再重跑，不得默默放行（裁-21m）。

## 复核入口

- 本目录 `_acc8-f-summary.json`：合并后的 67 条逐 AC 判定。
- 本目录 `_acc8-f-blockers.md`：阻塞与不通过清单，`## 处置结论` 之后为主控手填（裁-20w，重生成会保留）。
- 本目录 `AC-XX.part.md`：8 条 v4 重跑的逐项核对表；原 v3 同号文件仍在 `evidence/acc8/`，两版并存、不覆盖。
- AC-67 的「恢复前帧」按裁-21l 操作化：取 `MAESTRO_TEST_RECOVERY_HOLD=after_assign` 暂停点
  （恢复写入已落定、重新派发之前），与恢复完成后各取一次 `orch role show` 整段逐字比对。
- AC-45 的 `T-003` 字面按裁-21k 恢复：只参数化实测不可满足的轮次与上限，绑 `session.timeout` 的
  `detail.round` / `detail.maxRounds`（帧 seq31 实测 `1/2`），判据不放宽。
