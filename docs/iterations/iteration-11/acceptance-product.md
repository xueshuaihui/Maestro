# I1.11 真实宿主面验收

## 结论

**本迭代无逐 AC 的真实宿主面取证**——49 条 AC 的验收结论全部为 **mock 实测**（见 `acceptance-fixture.md` 与 `probe/acc11-f-summary.json`）。本文件按模板 §4.3 占位，说明原因、已做的替代验证与启用真实面的路径；不把 mock 结论伪写为「已实测（真实宿主）」。

## 原因（环境硬事实）

1. **Cursor**：本机只装了 IDE，没有 `cursor-agent` CLI（`agent acp` 不可用），无法起真实 ACP 宿主逐条取证。
2. **DSH**：真实 DSH 可用，但 49 条 AC 的通知/队列/资产/占用/画布/证据/壳层判定中，绝大多数依赖 `NODE_ENV=test` 接缝（`POST /__test__/*`）与注入时钟（9999/10001ms、60s 合并窗口）——真实宿主不支持这些接缝，无法逐字复现机检条件；此前迭代（I1.1~I1.3）的真实面取证只针对 1 条关键 AC。
3. **Tauri 壳层**：本机 release 二进制构建于 `main.rs` 通知链路改动之前；U-13 允许无头/CI 环境系统通知投递失败，探针层按 `delivered=false` 判据留证。

## 已做的替代验证（证据分级：mock 实测）

| 面 | 验证方式 | 证据 |
|---|---|---|
| 通知 10s/60s 边界 | 注入时钟单测（9999/10001ms、mergedCount `[1,2,3,4]`） | `evidence/AC-06/`、`test/wp14/notify.test.js` |
| 队列五动作 | mock 宿主真实等待会话（`allow`→approved、`deny`→denied）；处置全经既有 CAS | `evidence/AC-12/`、`AC-15/`、`test/wp14/queue.test.js` |
| 三段端到端 | 真 store + orchestrator + daemon HTTP + mock 宿主，短 TMPDIR | `evidence/AC-38/`、`test/wp14/e2e.test.js` |
| 壳层托盘/通知 | 静态契约 11 条（ctl 七动作、双处分发、`--no-notify`、探针事件名、SSE 替换投递） | `evidence/AC-35/`、`AC-36/`、`AC-48/`、`test/wp14/shell-notify.test.js` |
| 三主链逐字 | `bin/orch.js run --host mock` ×6，A-0 归一化逐字 diff 0 | `test/wp14/regression.test.js`、`evidence/AC-40/` |

## 启用真实面的路径（不影响本迭代结论）

1. 重建壳层：`npm run desktop:build`（或 `cargo build --release --manifest-path desktop/src-tauri/Cargo.toml`）；`test/wp14/shell-notify.test.js` 的 1 条真实探针用例（当前 SKIP）将自动启用，断言 ctl 四动作经 `notify-open` / `tray-pause` / `tray-resume` / `queue-open` 触发 `ctl-fired` / `nav` / `tray-pause` 与 `.done` 改名。
2. 真实 DSH 面：按 D-45「先起核再写盘」+ 真实等待会话路径，选取 AC-38 三段 E2E 做 1 条真实宿主复核（参照 I1.3 AC-40 的 313.6s 一次跑通先例）；需隔离 `DSH_HOME` 并复制 `~/.dsh/.credentials.yaml`。
3. Cursor 面：待 `cursor-agent` CLI 可用后补 ACP 宿主取证。

## 时间线与耗时

- S3 逐 AC 取证 4 批（AC-01~13 / 14~26 / 27~38 / 39~49），单 AC 限时 90s，重跑裁决项 7 条；总耗时以各批 `results.jsonl` 的 `durationMs` 为准。
- 无真实宿主面耗时可记。

## 证据清单

本文件不新增原始帧；全部证据见 `docs/iterations/iteration-11/evidence/`（49 目录 / 588 文件）。
