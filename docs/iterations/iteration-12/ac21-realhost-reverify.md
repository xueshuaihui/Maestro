# AC-21 真实宿主面重判回执（独立验收 Agent）

- 日期：2026-11-21
- 执行人：I1.12 AC-21 独立验收 Agent（干净上下文，非主控、非产物作者）
- 依据：用户 2026-11-21 书面裁决「跑满 20/50 真实取证解除阻塞」
- HEAD：`af92c9c91ef7f7e218ade9ae567256b6cf889e27`（main）

## 1. 复核方法

1. 自读判据：requirement.md AC-21（476–486 行）、附录 D-11（687–692 行）、decisions.md 裁决 A 第 3 条（17 行）与裁决 F（97–118 行）；不采信任务书转述。
2. 自读脚手架与产品：`probe/acc12-cases/AC-21.mjs`（旧版硬编码空样本 + PENDING）、`acc12-f-common.mjs` / `acc12-f-lib.mjs` / `acc12-f-final.mjs` 汇总约定、`probe/acc12-perf-pilot.mjs`（并发归属已修）、`src/core/perf-baseline.js`（`statsOf` / `collectHandoffLatency` / `buildPerfReport` / `PERF_LEVELS` / `PERF_TARGETS`）、`src/cli/labels.js:976-978`。
3. 独立复算脚本（临时目录，非仓库文件）：逐条遍历正式帧 50 条 `sessions`，核对 `firstEventRaw.params.sessionId` 与记录 `sessionId`、`firstEventMs` 有限且 ≥0、`samples.latencyMs === round(firstEventMs)`、`error` / `-32603` / 首事件方法；用产品 `statsOf` 复算 median/p95/max，用 `buildPerfReport` 复算 level/blocked/ok/bottleneck。
4. 负控：把帧路径替换为「缺失」与「PENDING/空样本」两种情形重跑用例，确认仍判阻塞（见 §6）。

## 2. 逐条数字（正式帧 `AC-21.perf-real-50-20.json`）

| 项目 | 独立复算值 | 帧内嵌值 | 结论 |
|---|---|---|---|
| sha256 | `58f1bc2b3e21911ce9d930416224c898bf8fd27ee0af37373a3b1def24d95b0b` | 同（主控给出） | 一致 |
| 宿主 / 发现 | `0.2.2-rc.5` / `source=default` | 同 | 一致，走产品发现逻辑 |
| sessions / samples | 50 / 50 | 50 / 50 | 一致 |
| okSessions / failedSessions | 50 / 0 | 50 / 0 | 一致 |
| distinctInstances / distinctSessions | 50 / 50 | 50 / 50 | 一致（≥20 / ≥50） |
| 归属串台（raw sessionId ≠ 记录 sessionId） | **0** | 0 | 一致 |
| firstEventMs 非有限 / 负值 | 0 | — | 全 50 条有效 |
| latencyMs 与 firstEventMs 不一致 | 0 | — | 全 50 条一致 |
| error / `-32603` | 0 / 0 | 0 | 无 error |
| 首事件方法非 `session/update` | 0 | — | 全 50 条可归属 |
| min | 436 ms | — | — |
| median（产品 `statsOf`） | **695** | 695 | 一致 |
| p95（产品 `statsOf`） | **1097** | 1097 | 一致 |
| max | 1353 ms | 1353 | 一致 |
| ≥2000ms 条数 | 0 | — | 无逐条超预算 |
| `buildPerfReport` | `ok=true, level=PERF_LEVEL_REAL, blocked=false, bottleneck=null` | `perfLevel=REAL, perfBlocked=false` | 一致 |
| conclusion | `MEASURED_REAL_HOST` | 同 | 一致 |

两份冒烟帧亦已复核：`smoke-1` 1/1、902ms、`PENDING`；`smoke-8` 8/8、max 1081ms、`PENDING`，均 0 串台、0 error，按 D-11 不达 20/50 仍为试点级别，未计入达标判据。

### 数值差异披露（重要）
任务书转述主控复算为「median 698 / p95 1077」，与产品 `statsOf` 复算的 **695 / 1097** 不同。原因：50 条排序后 P95 索引为 `46.55`，产品 `statsOf` 在 `sorted[46]=1077` 与 `sorted[47]=1113` 间线性插值得 `1096.8→1097`；1077 是低位索引取值，698 同理是低端取值而非插值中位数。帧内嵌 `collectedByProduct.stats` 为 695/1097/1353，与本次独立复算一致。**D-11 以产品 `statsOf` 为权威口径**，本次判定采用 695/1097；两个口径均 < 2s，不影响判定，但建议主控核对其他文档若引用了 1077。

## 3. 用例改动 diff 摘要

文件：`probe/acc12-cases/AC-21.mjs`（304 insertions / 46 deletions）。

- 取证来源：删除 `samples: []` + `PERF_LEVELS.pending` 硬编码，改为读取 `evidence/AC-21.perf-real-50-20.json` 的 `sessions` / `samples` / `summary.perfLevel`。
- 复算：引入产品 `statsOf` + `buildPerfReport`，级别由帧读出后经产品复算，不自行实现分位。
- 核对项：由原 5 条扩到 **21 条**，新增级别 REAL、blocked=false、ok/bottleneck、distinctInstances≥20、distinctSessions≥50、p95<2000、逐档数据、归属 0 串台、原始帧 50 条、样本 50 条、无 error/-32603、firstEventMs 有效、latency 一致、首事件可归属、mock 不顶替、中文级别不混用、结论/发现方式。
- 阻塞出口保留：`collected` 为假（帧缺失 / 级别 pending / 不达标 / 串台 / error）即 `block()`，仍判阻塞；`given.contract.json` 原 3 行（含 Then 目标值文案）逐字保留，仅追加重判锚点与 D-11 负载口径。
- 隔离：证据写独立根 `evidence/acc21-real/`（可用 `ACC12_EVID_ROOT` 覆盖）；自检按需写 `%TEMP%`；改用本地 runner，不写 `probe/acc12-f-parts/AC-21.md`、不写 `probe/acc12-f-results-b.jsonl`。

## 4. 判定

- **verdict = 通过**（21/21 核对项通过，0 失败）
- **grading = 已实测（真实宿主面）**（取自 `labels[PERF_LEVEL_REAL]`，非 mock）
- Then 机检逐条：真实宿主级别 `PERF_LEVEL_REAL` ✓；mock 级别 `PERF_LEVEL_MOCK` 不混用 ✓；20 实例（实测 50）/ 50 会话（实测 50）达标 ✓；p95 1097 < 2000 ✓；报告含 median/p95/max 逐档数据 ✓；无 mock 顶替（`conclusion=MEASURED_REAL_HOST`、宿主发现 `source=default`）✓。
- 阻塞根因已解除：裁决 F 第 3 条所述「脚手架未使用产品宿主发现逻辑」已由 `acc12-perf-pilot.mjs` 修复并经本帧 `source=default` 证实。

## 5. 新证据根与产物清单

根：`docs/iterations/iteration-12/evidence/acc21-real/`

| 文件 | 说明 |
|---|---|
| `AC-21.perf-check.stdout.json` | 级别 REAL、blocked=false、ok=true、完整复算数字 |
| `AC-21.given.contract.json` | Then 目标值原文 + 阻塞/重判锚点 + D-11 负载口径 |
| `AC-21.meta.result.json` | perfCheck + 产品 report + 21 条核对项 |
| `AC-21.summary.status.txt` | 重判状态摘要 |
| `AC-21.checklist.md` | 21 条核对表 + 复算摘要 + 需求 AC 原文 |
| `results.jsonl` | AC-21 重判结果行（evidenceFiles 指向本根，sourceFrameSha256 指向正式帧） |

结果行格式参照 `probe/acc12-f-results-b.jsonl` 的 AC-21 行，`batch=b-reverify`，**未覆盖**该文件中的旧行。

## 6. 阻塞出口负控（逻辑保留验证）

| 情形 | verdict | level | blocked | 说明 |
|---|---|---|---|---|
| 正式帧缺失 | 阻塞 | PENDING | true | 8/21 项通过，13 项失败，blocked reason 写明 frame=false |
| 帧级别改 PENDING + 空样本 | 阻塞 | PENDING | true | 9/21 项通过，12 项失败 |

两负控均写 `%TEMP%` 独立根、已删除，未污染正式证据根。证明用例不是无条件通过。

## 7. 与裁决 F 的关系

- 用户 2026-11-21 书面裁决「跑满 20/50 真实取证解除阻塞」**覆盖裁决 F 第 1 条**（停在试点、AC-21 维持阻塞）；第 4 条规定的唯一解除路径（按 D-11 跑满 20/50 产出 `PERF_LEVEL_REAL` 后复判 <2s）已满足。
- 裁决 F 其余纪律继续有效并已遵守：不伪造、不 mock 顶替（§4）、不回溯 S3 冻结证据（§8）、试点帧不计入 S3 证据（smoke 帧仅作复核，未写入新证据根的达标判据）。
- 裁决 F 第 3 条观察项（阻塞根因定性修正）由本帧 `source=default` 进一步印证。

## 8. 未变项声明

以下均**未改动**：
- 需求 `requirement.md` / `requirement-understanding.md`（含 AC-21 Then 目标值 `handoff <2s` / `≥20 实例` / `50 会话` 的逐字文案）；
- 产品代码 `src/**`（含 `perf-baseline.js`、`labels.js`）；
- 模板与验收脚手架公共文件（`acc12-f-lib.mjs` / `acc12-f-common.mjs` / `acc12-f-final.mjs` / `acc12-perf-pilot.mjs`）；
- S3 冻结的 4 份 v3 帧（`AC-21.perf-check.stdout.json` / `given.contract.json` / `meta.result.json` / `summary.status.txt`，sha256 见 §2 说明，git 无改动）；
- `probe/acc12-f-results-b.jsonl` 中的旧 AC-21 阻塞行（仍为 1 条，未覆盖）；
- `probe/acc12-f-parts/AC-21.md` 及其余 AC 的证据与判定。

本次仅新增：`probe/acc12-cases/AC-21.mjs` 修改、`docs/iterations/iteration-12/evidence/acc21-real/` 新证据根、本回执文档。
