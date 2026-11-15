# I1.8 S2 第 1 批合入 main 集成说明（2026-11-15）

> 本文是主控对「功能分支合入主分支」的**裁决与门禁留痕**，不属于 I1.8 需求或验收判据。
> 集成提交：`c1915c3`（父 `5246f3b` = 合入时的 `origin/main`；`2a74368` = `feat/i1.8-instance-recovery` 分支头）。
> 证据分级：以下结论均为**本机实测（mock / 机检面）**；真实宿主面仍为「阻塞」。

## 1. 分支拓扑与裁决

```
3f35bfa ─┬─ 760b8a1 ─ ae89f27 ─ 41829e0 ─ 2a74368   feat/i1.8-instance-recovery（I1.8 S0 / S1 / S2 第 1 批）
         │                                              ↑ 4 个提交，基线为 I1.6 集成收尾
         └─ … 71 提交（I1.7 代码隔离 worktree / I1.9 追踪与 CLI / I1.10a 桌面 UI + CI release）
              └─ 3210c0c ─ 5246f3b   origin/main（门禁期间又新增 1 提交，仅改桌面 spawn.rs / smoke.mjs）
                              └─ c1915c3   merge（本次集成）
```

- 功能分支从 `3f35bfa` 拉出时**不含 I1.7**；期间主线独立推进，两边在 `src/persistence/paths.js`、`test/wp13/` 等路径上各自新增内容。
- 裁决：**以最新 `origin/main` 为第一父、`--no-ff` 合入功能分支**。`git merge-tree --write-tree` 试算（`4935ead`）显示零冲突；实际合并树与试算树一致，未改任何既有验收断言。
- 门禁期间远端新增 `5246f3b`（Windows 壳启 daemon 的 cwd/stderr/探活修复，**仅 2 个桌面文件**），故把尚未推送的本地 merge 重置到最新 main 后重建了一个干净的 merge 节点，避免双 merge 拓扑；`6305ab5`（旧 merge）未推送，可由 reflog 找回。

## 2. 冲突面与语义核查（零冲突块，但逐项核过）

| 交汇点 | 主线 | 功能分支 | 核查结论 |
|---|---|---|---|
| `src/persistence/paths.js` | I1.7/I1.9 新增 `instanceStateDir` / `instanceTracesPath`（`<instanceDir>/state`） | WP-1 新增 `checkpointPath`（`<instanceDir>/state/checkpoint.json`） | 同目录、语义兼容；`test/wp9/i19-trace.test.js` 的既有形状断言保持 |
| `src/adapter/acp-client.js` | 相对 `3f35bfa` **零改动** | WP-2 新增 `normalizeCapabilities` / `canResume` / `canLoad` / `resumeSession` / `loadSession`，并重写 `resumeOrCreate` | 返回契约从 `{ok,result}` 变为 `{restored,dialect,attempts}`（失败 `{ok:false,code:'SESSION_RESTORE_FAILED',attempts}`）。`git grep` 全仓调用点仅**定义 / 导出 / 新增 `test/wp13/dialect.test.js`**，主线运行时零消费，三主链不经过；WP-4 接线按新契约（裁-8e） |
| `test/wp13/` | 已有 34 个桌面/看板用例 | 新增 `checkpoint.test.js` / `dialect.test.js` | 文件名零冲突，共存后共 36 个文件 |
| I1.6 验收证据 | — | 此前门禁重跑 AC-49 曾把证据改成「不通过」 | 已恢复 HEAD，重跑原始帧另存 `iteration-8/evidence/gate-batch1/`；本次合入**未污染** 65/65 证据链 |

## 3. 合入后门禁（主控实跑，最终树 `bf652cd`）

| 门禁 | 结果 |
|---|---|
| `node --test test/wp13/{checkpoint,dialect}.test.js` | **25 / 25 通过** |
| `node --check` 三文件 | OK |
| D-11 五条架构扫描 | 全 `exit 0`：`src/core,src/daemon` 30 文件、`src/registry` 11 文件、三族 CLI 3 文件零命中；`deps=0`；`OK: no CJK` |
| 全量 `node --test --test-concurrency=4 "test/**/*.test.js"` | **1425 / 1392 pass / 24 fail / 9 skipped**，exit 1（既有平台噪声，非零失败不是本次判据） |
| 失败集合差集 | 与「`3210c0c` + 功能分支」树（22 fail）相比多 2 条：`test/wp13/regression.test.js` 的 task-loop 会话行串扰、`test/wp9/i19-regression.test.js` 的 `code-loop 无法创建工作区：workspace_init_failed`。**独占复跑**（`--test-concurrency=1`，18 / 17 pass / 0 fail / 1 skipped，exit 0）确认是 Windows 并发资源竞争 flake，**新增失败 = 0** |
| 基线对照 | 在 `3210c0c` 隔离 worktree 同命令复跑，跑到 1337+ 条时因 `EBUSY` 清理抖动与桌面/HTTP 用例挂起（11 分钟后终止、未写出汇总，如实登记）；已产出的 25 条失败名**覆盖**合并树全部 22 条失败名。基线多出的 3 条（A-1 逐字节样本 ×2、legacy SHA256SUMS）系 worktree CRLF 展开的假红，合并树无此红 |

条数口径：需求 AC-53 要求「条数只增不减、失败集合差集 = 0、不要求零失败」，本批新增 25 条用例，条数 1425 只增；既有的 `promptFailures:2` / `--host-error 早返回` / `HANDOFF_EVIDENCE_ESCAPE` / `resolveEvidenceRef` / `可注入 fs：stat` 与桌面 `lsof`、SSE 时序等均为主线既有 Windows 噪声。

## 4. 风险与遗留（S4 报告必须列）

1. **本分支只到 S2 第 1 批**：WP-1/WP-2 是**尚未接线**的新增模块，当前运行链路不经过；I1.8 的 S2 剩余 4 批（WP-5+6 / WP-4 / WP-3 / WP-7）、S3 验收、S4 收口均未完成，合入不等于 I1.8 验收通过。
2. **主线已含 I1.7**：需求 v3 明确「I1.7 合入后 67 条 AC 全部重跑」，S3 前必须重跑，不得沿用 `3f35bfa` 基线结论。
3. **门禁 ④ 未闭合**：三主链逐字基线须按现主干重建；用 I1.5 存量 `0cd113b` 跑 AC-49 必红（O-I2：I1.4 共享工作区提示词 + task-loop 状态行顺序），不是回归。
4. **真实宿主面阻塞**：AC-25/26/27/57 本机无 DSH CLI，按 BR-48 判「阻塞」，留 WP-7 末批取证，不得用夹具冒充。
5. `resumeOrCreate` 返回契约已变，WP-4 接线时须按裁-8e 显式传 `currentPrompt` 且不得重复发 prompt（否则 AC-21 的 `session/prompt` 变 2 次）。

## 5. 处置声明

- 本地 `main` 合入后推送 `origin/main`；功能分支 `feat/i1.8-instance-recovery` **保留不删除**，并快进同步到合入后的 main，避免后续 S2 批次继续基于落后 72 提交的旧基线。
- 基线隔离 worktree 用后已 `git worktree remove --force` + `prune` 清理；测试写入的 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 测量值已恢复 HEAD，未进提交。
- 未创建集成分支、未改写任何迭代的 `report.md` / 验收证据。

## 6. 推送期并行同步（补记）

首次 `git push origin main` 被 `non-fast-forward` 拒绝：另一位同学并行推送了 `eff4e2f`
（I1.10a S3：Windows 子进程路径规范化，**仅 `desktop/src-tauri/src/spawn.rs`**，与 I1.8 零交集）。
主控重新 `git fetch` 后以 `ort` 策略生成同步 merge `49a8c6d` 并推送成功，
故主线最终存在两个 merge 节点：`c1915c3`（I1.8 功能合入）与 `49a8c6d`（并行提交同步），
两者都未改写 I1.8 的合入内容。功能分支随后快进同步到最终 main，保留不删除。
