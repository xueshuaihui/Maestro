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
