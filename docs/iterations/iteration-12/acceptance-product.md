# I1.12 验收取证 · 产品面（acceptance product）

> 本文件承载「真实宿主面」取证结论。批次 B（AC-13~AC-23）仅 AC-21 涉及产品面；
> 其余 AC 的夹具/mock 面取证见 `acceptance-fixture.md` 与其 BATCH-B 段落 `acceptance-fixture-b.md`。

## AC-21 · 真实宿主性能证据分级（规划验收⑥）

- 判定：**阻塞**（真实宿主面未取证；按需求 483 行契约 / 484 行阻塞出口锚点 / 裁决 A 第 3 条「阻塞不算失败、伪通过才是」）
- 证据分级：**阻塞**（非 `mock 实测`、非 `已实测（真实宿主面）`）
- 仓库根：`D:/WWW/Maestro`，HEAD=`d20fccc`
- 取证时间：2026-11-19

### Then 目标值（逐字不变）

- `handoff <2s`、`≥20 并发`、`50 活跃会话`（v1→v2 逐字未改；历史措辞「v1 阶段…待本机实测」的法律效力由 v2 新增契约行与 §3.3 第 3 条承担，非降级、非放宽）。

### 证据状态契约核对

| 核对点 | 期望（逐字/契约） | 实测 | 结果 |
|---|---|---|---|
| 真实宿主面证据级别 | `已实测（真实宿主面）` 才能判达标 | `PERF_LEVEL_PENDING`（labels 逐字：`待本机实测`） | 未取证 → 阻塞 |
| mock 面证据级别 | `mock 实测`，仅证明 mock 面 | AC-20 = `mock 实测`（已收口） | 成立，未混用 |
| 两级别不混用 | mock 结果不进入真实宿主达标判据 | `realHostCollected=false`，mock 未顶替 | 成立 |
| 阻塞出口 | 未取证 → 判阻塞 + 附试过路径、不得伪通过 | `blocked=true`，附 triedPaths | 成立 |

### 试过路径（triedPaths）

- 环境变量 `MAESTRO_DSH_EXE` / `MAESTRO_DSH_BIN`：未设置。
- `C:/Program Files/DSH/dsh.exe`：不存在。
- `%LOCALAPPDATA%/DSH/dsh.exe`：不存在。
- `~/.dsh/bin/dsh`：不存在。
- 本机 20 实例 / 50 会话 handoff 取证：`not_collected`。

原始 JSON：`docs/iterations/iteration-12/evidence/AC-21.perf-check.stdout.json`（`level=PERF_LEVEL_PENDING`、`blocked=true`、`triedPaths`）。

### 为何阻塞

真实宿主（DSH 0.2.2-rc.1）性能取证按需求 §3.3 第 3 条与分派表 701 行**留本机**；当前验收环境不具备该宿主面与凭据，验收期前该面未取证。依据裁决 A 第 3 条与 483 行契约「真实宿主面未取证 → 判阻塞并附试过路径，不得用 mock 顶替、不得伪通过」，本 AC 判**阻塞**、不算失败；不阻塞 mock 面（AC-20）收口。

### 解除条件

主控安排本机取证窗口后，用真实 DSH 按附录 D-11 口径采集 20 实例 / 50 会话 handoff 延迟，产出 `level=PERF_LEVEL_REAL`（labels 逐字：`已实测（真实宿主面）`）证据，再复核 AC-21 的 `<2s / ≥20 并发` 判据。在此之前不得将 AC-20 的 `mock 实测` 写成真实宿主达标。

---

## 后续：AC-21 已解除（2026-11-21，本文以上内容为 S3 时点原文）

**用户 2026-11-21 裁决**「跑满 20/50 真实取证」（`decisions.md` 裁决 H，仅覆盖裁决 F 第 1 条的「停在试点」，其余纪律保留），走裁决 F 登记的**出口①**解除，未使用书面豁免。

**执行**：先修 `probe/acc12-perf-pilot.mjs::waitFirstEvent` 的并发事件归属缺陷（改为按 `params.sessionId` 过滤并落 `firstEventRaw`），再用真实 DSH **`0.2.2-rc.5`**（隔离 `DSH_HOME`，未碰用户 `~/.dsh`）跑 **50 会话 / 20 并发**。

**结果**（原始帧 `evidence/AC-21.perf-real-50-20.json`，sha256 `58f1bc2b…4d95b0b`）：

| 项 | 实测 |
|---|---|
| 会话成功 | 50 / 50（0 失败、0 error、0 `-32603`） |
| 归属串台 | 0（逐条 `firstEventRaw.params.sessionId` 与记录 `sessionId` 一致） |
| distinctInstances / distinctSessions | 50 / 50（D-11 要求 ≥20 / ≥50） |
| handoff 延迟 | min 436 / median 695 / **p95 1097** / max 1353 ms（over2s = 0） |
| 级别 | **`PERF_LEVEL_REAL`**（`已实测（真实宿主面）`）、`blocked=false` |

**重判**：AC-21 **21/21 通过**、`grading=已实测（真实宿主面）`；阻塞出口逻辑保留（帧缺失 / PENDING / 不达标仍判阻塞，负控实测 8/21、9/21 均判阻塞）。Then 目标值与需求文本一字未改。回执见 `ac21-realhost-reverify.md`，证据根 `evidence/acc21-real/` 与 `evidence/AC-21.real.*`。

**本文以上段落（S3 时点的「为何阻塞 / 解除条件」）保留为审计链，不再代表当前判定。**
