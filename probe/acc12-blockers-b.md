# I1.12 批次 B 阻塞 / 缺陷台账（AC-13~AC-23）

- 生成时间：2026-11-19（批次 B 验收取证）
- 仓库根：`D:/WWW/Maestro`，HEAD=`d20fccc`
- 判定：通过 10 / 不通过 0 / 阻塞 1
- 核对项：128/128 通过（其中 AC-21 5/5 为「阻塞出口」核对，均按契约成立）
- 证据文件：68 份非空原始帧（另复用主控 AC-22 全量/三主链/差集 3 份历史帧）

## 阻塞项（要求什么 / 试过什么 / 为何观测不到）

### AC-21 · 真实宿主性能证据分级（留本机）—— 阻塞

- **要求**：Then 目标值 `handoff <2s / ≥20 并发`；只有「已实测（真实宿主面）」证据级别才能判真实宿主达标（需求 480~486 行、裁决 A 第 3 条、484 行阻塞出口锚点）。
- **试过**：探测本机真实宿主面路径 `MAESTRO_DSH_EXE` / `MAESTRO_DSH_BIN` 环境变量、`C:/Program Files/DSH/dsh.exe`、`%LOCALAPPDATA%/DSH/dsh.exe`、`~/.dsh/bin/dsh`；均不存在/未配置；20 实例/50 会话 handoff 取证状态 `not_collected`。逐条 triedPaths 见 `docs/iterations/iteration-12/evidence/AC-21.perf-check.stdout.json`。
- **为何观测不到**：真实宿主（DSH 0.2.2-rc.1）取证按需求 §3.3 第 3 条与分派表 701 行**留本机**，当前验收环境不具备该宿主面与凭据；验收期前该面未取证。
- **判定出口**：`blocked:true`、`level=PERF_LEVEL_PENDING`（labels 中文逐字 `待本机实测`）、`realHostCollected:false`；按「阻塞不算失败、伪通过才是」判**阻塞**，不得用 AC-20 的 `mock 实测` 顶替、不得伪通过。AC-20 mock 面已收口，本阻塞不阻塞 mock 面。
- **解除条件**：主控安排本机取证窗口后，用真实 DSH 按附录 D-11 口径采集 20 实例/50 会话 handoff，产出 `level=PERF_LEVEL_REAL`（`已实测（真实宿主面）`）证据，再复核 AC-21。

## 不通过 / 缺陷项

- 本批次无「不通过」AC，无新发现缺陷。
- 取证说明：AC-14/15 的验签/版本门禁、AC-19 的反模式信号、AC-20/21 的性能报告按冻结签名以**模块直调**取证（裁决 D-6 对 AC-19 不新增 CLI 的口径；verify/otel/migrate 的 CLI 载体经 `--help` 与真实 `orch` 调用分别核对）。中文逐字期望全部运行时取自 `src/cli/labels.js` 与 `requirement.md` 附录 A，用例未硬编码中文断言字面。
- AC-22 未重跑全量（避免覆盖主控历史证据），仅做证据索引 + 口径核对 + 轻量只读断言（USAGE_LINES 25 行、dependencies 0、purity exit 0），与主控实跑口径一致。

## 文件所有权声明

本批次仅写入：
- `probe/acc12-cases/AC-13.mjs`~`AC-23.mjs`
- `probe/acc12-f-parts/AC-13.md`~`AC-23.md`
- `probe/acc12-f-results-b.jsonl`（独立结果，未触碰 `acc12-f-results.jsonl`）
- `probe/acc12-blockers-b.md`
- `docs/iterations/iteration-12/evidence/AC-13.*`~`AC-23.*`
- `docs/iterations/iteration-12/acceptance-fixture-b.md`、`acceptance-product.md`

未修改任何 `src/**`、`test/**`、需求/拆分/裁决/进度/报告/终验文件；未 git add/commit。
