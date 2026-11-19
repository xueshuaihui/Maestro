# I1.12 验收阻塞 / 缺陷台账（A+B 合并）

- 生成时间：2026-11-19T12:50:45.019Z
- 仓库 HEAD：`d1fce53`
- 判定：通过 22 / 不通过 0 / 阻塞 1（共 23 条 AC）
- 核对项：322/322 通过（AC-21 的 5/5 为阻塞判定出口核对项）
- 证据分级：22 条 `mock 实测`，1 条 `阻塞`（无「已实测（真实宿主面）」证据，未作此声称）

## 阻塞项

### AC-21 · 真实宿主性能证据分级（留本机） —— 阻塞

- **要求什么**：Then 目标值 `handoff <2s / ≥20 并发`；只有「已实测（真实宿主面）」级别证据才能判真实宿主达标（需求 §3.3 第 3 条、裁决 A 第 3 条、阻塞出口锚点）。
- **试过什么**：探测 `MAESTRO_DSH_EXE` / `MAESTRO_DSH_BIN` 环境变量、`C:/Program Files/DSH/dsh.exe`、`%LOCALAPPDATA%/DSH/dsh.exe`、`~/.dsh/bin/dsh`；均不存在或未配置；20 实例 / 50 会话 handoff 取证状态 `not_collected`（triedPaths 共 5 条，见 `docs/iterations/iteration-12/evidence/AC-21.perf-check.stdout.json`）。
- **为什么观测不到**：真实宿主（DSH 0.2.2-rc.1）性能取证按需求与分派表**留本机**，当前验收环境不具备该宿主面与凭据，验收期前该面未取证；实测 `level=PERF_LEVEL_PENDING`（`待本机实测`）、`blocked=true`、`realHostCollected=false`。
- **判定**：判**阻塞**（阻塞不算失败，伪通过才是）；不得用 AC-20 的 mock 实测顶替、不得伪通过。证据：`docs/iterations/iteration-12/evidence/AC-21.given.contract.json`、`docs/iterations/iteration-12/evidence/AC-21.meta.result.json`、`docs/iterations/iteration-12/evidence/AC-21.perf-check.stdout.json`、`docs/iterations/iteration-12/evidence/AC-21.summary.status.txt`；核对表 `probe/acc12-f-parts/AC-21.md`。
- **解除条件**：主控安排本机取证窗口后，用真实 DSH 按附录 D-11 口径采集 20 实例 / 50 会话 handoff，产出 `level=PERF_LEVEL_REAL`（`已实测（真实宿主面）`）证据后复核本 AC。

## 不通过 / 缺陷项

- 无「不通过」AC，无遗留缺陷。AC-01 的 CLI 失配序号缺陷已按裁决 E 修复，复验 22/22 通过，不计为缺陷。

## 证据审计

- 23 条 AC 均 ≥4 份非空 `AC-XX.*` 证据，合计 153 份唯一文件；无 0 字节、无重名、无跨 AC 串号。
- AC-21 为阻塞而非通过：其 4 份证据只支持「真实宿主未取证」这一事实，mock 面结论（AC-20）未被计入真实宿主判据。

## S4 补充诊断（2026-11-19，不改变 AC-21 判定）

- **触发**：S4 收口复核 AC-21 的取证链路，发现「本机无真实宿主面」的表述不成立。
- **核查事实**：
  1. `probe/acc12-cases/AC-21.mjs` 未调用 `probe/acc12-perf.mjs`，直接硬编码 `samples: []` + `evidenceLevel: PERF_LEVEL_PENDING` 构造报告；
  2. 该用例只探 `C:/Program Files/DSH/dsh.exe`、`%LOCALAPPDATA%/DSH/dsh.exe`、`~/.dsh/bin/dsh`，三条都不是本机布局；产品自身 `src/adapter/dsh-launch.js::resolveDshLaunch()` 能正确定位（`source: default`）。
  3. 隔离 `DSH_HOME`（复制凭据、用完即删、未改用户 `~/.dsh`）+ 覆盖 `agent-default-model` 与 `acp` 两处 provider 到 `deepseek-account` 后，真实宿主跑通：
     - `probe/acc12-perf-pilot.json`：宿主 `0.2.2-rc.3`，1 会话 `ok`，交付→首事件 **743.8ms**，`stopReason=end_turn`；
     - `probe/acc12-perf-pilot-5.json`：5 会话 / 2 并发 **5/5 成功**，547 / 665 / 726 / 1008 / 1473 ms，最大 **1473ms < 2s**。
- **为什么不销项**：试点规模未达 D-11 的 20 实例 / 50 会话口径，按 AC-21 机检锚点只能停在 `PERF_LEVEL_PENDING`；按 `decisions.md` 裁决 F，用户选择「停在试点，不再跑全量」，故本项**维持阻塞**。
- **定性修正**：阻塞根因从「本机无真实宿主面」改为「**AC-21 取证脚手架未复用产品宿主发现逻辑，导致未取证**」。
- **解除条件（不变）**：按 D-11 跑满 20 实例 / 50 会话 handoff，产出 `PERF_LEVEL_REAL` 后复判 `<2s / ≥20 并发`；或用户出具书面豁免。
- **证据归属**：以上试点帧落在 `probe/`，属 S4 收口期补充诊断，**不计入 S3 的 153 份验收证据**（S3 证据集已随 `3470241` 冻结）。
