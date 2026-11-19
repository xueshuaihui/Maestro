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
