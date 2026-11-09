# I1.7 验收证据映射（S3 · 14 条 AC）

> 依据：`requirement.md` v2 §3.1 的 AC-01~AC-14 逐字标题；证据全部来自本迭代实际提交与实跑。
> 基线：`3f35bfa`（992 tests / 983 pass / 8 fail）。本迭代 HEAD（S2 收口）`8a50866` + 文档 `05dc41f`。
> **回归门禁**：全量实跑 1028 tests / 1019 pass / 8 fail / 1 skipped，失败集合与基线 8 条逐条一致（差集 = 0）。

## 证据分级口径

| 分级 | 含义 |
|---|---|
| 回归实测 | 全量 `node --test "test/**/*.test.js"` 实跑，与基线失败集合比对 |
| 夹具实测 | 真实本地 git（`fs.mkdtemp(os.tmpdir())`，非 mock、非 DSH）实跑 |
| 故障注入 | 通过注入 `execa` 制造 worktree/merge 失败，验证升级路径 |
| 单元 | 纯内存/渲染层断言 |
| 待补 | 尚未有端到端探针证据 |

## AC → 证据映射

| AC | 标题（节选） | 结论 | 证据（测试::用例 / commit） | 分级 | 备注 |
|---|---|---|---|---|---|
| AC-01 | code → 独立 worktree 与分支被创建 | ✅ | `i17-code-isolation::createWorktree`（worktree 目录 + `maestro/<inst>/<role>` 分支就绪）；`i17-code-strategy::artifactPolicy=code`；`i17-paths::instanceCodeWorktreeDir`（`e67853b`/`e138230`/`03bd672`） | 夹具实测 | — |
| AC-02 | document → 版本化文件区（回归逐字） | ✅ | `i17-regression::AC-02`（v1/v2 并存且不同）；`test/wp10/doc-artifact.test.js` 14/14；task-loop 既有测试 | 单元+回归 | — |
| AC-03 | dataset → 快照区 | ✅ | `i17-paths::instanceDataDir` → `<workspace>/artifacts/data`（`e67853b`） | 单元 | 仅路径落点隔离，不做 git 隔离（BR-08） |
| AC-04 | report → 只追加区（回归逐字） | ✅ | `i17-regression::AC-04`（`REPORTS_DIR` 不变、`research-notes.v1.md` 归属） | 单元+回归 | — |
| AC-05 | 两 code 角色并行，worktree/分支独立不串扰 | ✅ | `i17-code-isolation::AC-07`（两 worktree 各自改动、互不覆盖）；`orchestrator` code 节点得到 `branch`/worktree | 夹具实测 | — |
| AC-06 | 核心托管顺序合并、进度可见 | ✅ | `i17-code-isolation::createMergeQueue`（`maxActive=1`，严格串行）；生命周期 `pending→merging→merged/conflict`；`i17-labels` 渲染状态词 | 夹具实测 | — |
| AC-07 | 验收句 1：不同文件顺序合并无覆盖 | ✅ | `i17-code-isolation::AC-07`（真实 git：a.txt/b.txt 合并后都保留） | 夹具实测 | 规划验收句之一 |
| AC-08 | 验收句 2：同文件冲突被检测并升级 | ✅ | `i17-code-isolation::AC-08`（`MERGE_CONFLICT` + `detectConflict` + `abortMerge` 回滚 + 两分支保留）；队列路径升级 `merge_conflict` | 夹具实测 | 规划验收句之二 |
| AC-09 | 冲突裁决后可继续合并（复用既有入口） | ✅ | `i17-code-isolation::AC-14`（`reprocess('ESC-001')` 再次 merge 成功）+ `reprocess 未知号`；`orchestrator` hook 3 `reprocess`（`55ad835`） | 夹具实测 | 复用 I1.4 `escalate resolve`，不新造入口 |
| AC-10 | 非 code 角色不做 git 隔离 | ✅ | `i17-code-strategy::ROLES.developer 带 code，其余不带`；`i17-regression::AC-10` | 单元 | `worker` 节点不被覆盖（单链不变） |
| AC-11 | doc-single 文档闭环逐字不变 + 全量差集=0 | ✅ | 全量实跑 1028/1019/8，差集=0（见 `progress.md` S3 回归门禁）；`i17-regression::R-1` 三主链节点行逐字 | 回归实测 | R-5 满足（条数只增不减） |
| AC-12 | worktree/分支/合并/冲突在实例视图可见 | ✅ | **端到端实跑** `probe/i17-ac12-status.mjs` **15/15**：真实 core（命名管道 IPC）+ 真实 `node bin/orch.js instance status`，三种实例快照输出落 `evidence/ac12-status/`；已合并行 `节点 T-001 开发 已完成 · 第 1 轮 · 耗时 50s · （开发 分支 maestro/INST-AC12-MERGED/developer · 已合并）`，冲突行 `… · 冲突待升级` + 升级块 `原因：合并冲突`；`single` 负控输出 `实例 INST-AC12-SINGLE · 已完成` / `节点 已完成`（无分支片段）；`instance graph` 文本视图同样透出分支名。渲染层另有 `i17-labels::(c)` 9/9，接线见 `490ee15` | **端到端实测**（真实 core IPC + 真实 CLI） | 已闭合 |
| AC-13 | worktree/分支创建失败 → 升级而非静默失败 | ✅ | `i17-code-isolation::AC-13`（注入 `worktree add` 失败→`WORKTREE_INIT_FAILED`+`worktree_init_failed` 条目）；`orchestrator` hook 1 升级（`55ad835`） | 故障注入 | — |
| AC-14 | 合并异常 → 升级而非静默丢失改动 | ✅ | `i17-code-isolation::AC-14`（注入 merge 失败→`merge_aborted` 升级 + `mergeStatus=conflict` + abort + 改动保留） | 故障注入 | — |

## 结论与剩余项

- **14/14 AC 均有证据，且全部达到「实测」级**：夹具实测（AC-07/08/09）、故障注入（AC-13/14）、回归实测（AC-11）、端到端实测（AC-12：真实 core IPC + 真实 CLI 输出）。
- **流程剩余已关闭**：`#R-01` 独立评审（`review-wp2-wp3.md`）已补，PASS（阻断 0 / 建议 10），F-01/F-09 已修（`0fc70a9`）。
- **S3 已收尾**：AC-12 端到端探针 `probe/i17-ac12-status.mjs` 实跑 15/15，证据落 `evidence/ac12-status/`（`ac12-result.json` + 4 份原始 stdout）。
- **注意（探针口径）**：该探针构造的是磁盘上已含 `branch/mergeStatus` 的快照，验证的是「快照 → core IPC → CLI 渲染」链路；`branch/mergeStatus` 的**写入**由 `i17-code-isolation`（队列 + `applyStateChange`）与 `orchestrator` 钩子覆盖，两者合起来才构成 AC-12 全链。
