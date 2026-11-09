# I1.7 实现收口报告（S4）

> 迭代：产物类型隔离 + 代码 worktree 集成
> 需求：`requirement.md` v2（14 AC / BR-01~11，评审 PASS）
> 拆分：`iteration-7.md`（6 WP，AC→WP 14/14 满覆盖）
> 代码 HEAD：`0fc70a9`（评审修复后）；文档基线前为 `3f35bfa`

## 1. 交付清单（提交）

| 顺序 | 提交 | 内容 |
|---|---|---|
| 1 | `e67853b` | WP-1：`paths.js` 追加 `instanceCodeWorktreeDir` / `instanceDataDir`（+ 3 测试） |
| 2 | `dcf4fc1` | WP-5：`labels.js` 追加 7 键；`render.js` `includeBranch` 开关 + graph 透出；`status-text.js` 片段（+ 6 测试） |
| 3 | `e138230` | WP-2：`src/core/code-isolation.js`（worktree/顺序合并队列/冲突 abort+升级/reprocess）（+ 8 测试） |
| 4 | `03bd672` | WP-3：`doc-artifact.js` 新增 `code` 策略 + 角色级覆盖；`templates/index.js` `developer.artifact_type='code'`（+ 6 测试） |
| 5 | `55ad835` | WP-4：`workspace.js` code 图确保 git 仓库；`orchestrator.js` 三钩子（派发建 worktree / done 入队 / resolve 重投）（orchestrator +4 测试） |
| 6 | `490ee15` | WP-5b：`main.js` 仅 `instance status` 接线 `includeBranch:true`（闭 G-01；+ 3 渲染断言） |
| 7 | `8a50866` | WP-6：`i17-regression.test.js` 回归守护（+ 6 测试） |
| 8 | `0fc70a9` | 独立评审 `review-wp2-wp3.md`（PASS）+ 修复 F-01（升级落盘失败不误记已提交）、F-09（移除 `artifactType` 旁路，仅角色表判定） |
| 9 | `c6d9269` | `probe/i17-ac12-status.mjs` + `evidence/ac12-status/`：端到端 `orch instance status` 实测 15/15 |

## 2. 门禁数字（实跑）

- **全量回归**：`node --test "test/**/*.test.js"`（`8a50866`）→ **1028 tests / 1019 pass / 8 fail / 1 skipped**；失败集合与基线 `baseline-failures.txt` 8 条**逐条一致，差集 = 0**；用例 992→1028（+36），通过 983→1019（+36）。R-5/AC-11 满足。
- **wp7 新增测试**：37/37 绿（paths 3 / code-isolation 8 / code-strategy 6 / labels 9 / regression 6 …）。
- **既有回归**：`test/wp10/doc-artifact.test.js` 14/14；`test/templates/**` 28/28；`test/wp4/orchestrator.test.js` 37 用例 36 绿，唯一失败 = 基线 #6（`/private/var` vs `/var` 符号链接，预存在）。I1.7 新增 4 条 worktree 用例全 ok。
- **架构**：`purity-check --dirs src/core,src/daemon --forbid <31词>` → exit 0（22 文件零命中）；`dependencies` 键数 = 0；`code-isolation.js` CJK=0、`if host ==`=0。

## 3. AC 结果

- **14/14 有证据**，详见 `acceptance.md`。
- 分级：端到端实测（AC-12：真实 core IPC + 真实 CLI）1 条、夹具实测（真实本地 git）5 条、故障注入 2 条、回归实测 1 条、单元/渲染 5 条。
- **AC-12 已升级为端到端实测**：`probe/i17-ac12-status.mjs` 在 `os.tmpdir()` 隔离根真实拉起 core，跑真实 `node bin/orch.js instance status`，**15/15**；已合并行含 `（开发 分支 maestro/… · 已合并）`，冲突行含 `冲突待升级` + `原因：合并冲突`，`single` 负控输出逐字为 `节点 已完成`（无分支片段），`instance graph` 同样透出分支名。证据见 `evidence/ac12-status/`。

## 4. 偏差与遗留（如实登记）

1. **执行方式偏差（R-01，已闭）**：WP-2/WP-3 因平台对并行 SubAgent 返回 429，由主控在 Agent 模式代写；随后派干净上下文评审 Agent，总判 PASS（阻断 0 / 建议 10），采纳 F-01/F-09 修复，其余建议记录为已知非阻断。
2. **【已闭合】AC-12 端到端探针**：已补 `probe/i17-ac12-status.mjs`，实跑 15/15 并落证据（`evidence/ac12-status/`）。探针口径为「磁盘快照 → core IPC → CLI 渲染」；字段**写入**侧由 `i17-code-isolation` 队列 + `orchestrator` 钩子单测覆盖，两侧合起来构成 AC-12 全链。
3. **评审建议遗留（非阻断）**：F-02 `reprocess` 依赖进程内 `processed` 映射（daemon 内同一进程成立，跨进程不强）；F-08 `code` 分支用 `path.join(workspaceDir,'worktrees',role)` 与 `instanceCodeWorktreeDir` 等价（orchestrator 未传 `root`）；F-03~F-07/F-10 为健壮性/可注入性建议。

## 5. 风险与后续

- 真实 DSH 宿主写 worktree 的执行面未在本迭代验证（B/C 类，预判 B）；若 I1.8 需要真实宿主并行改文件，可在真实面补 AC-05/07 证据。
- worktree 生命周期清理（U-1）不在本迭代范围。
