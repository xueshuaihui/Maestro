# I1.7 终验（S4）

> 判据来源：`iteration-7.md` 「退出标准」5 条 + `requirement.md` AC-01~14。
> 终验代码 HEAD：`c6d9269`（AC-12 探针提交）；基线 HEAD：`3f35bfa`。

## 1. 退出标准逐条

| # | 判据 | 结论 | 证据 |
|---|---|---|---|
| 1 | 14 条 AC 均有判定；AC-07/AC-08 规划验收句夹具现场实跑；AC-13/AC-14 故障注入通过 | ✅ | `acceptance.md`；`i17-code-isolation::AC-07/08/13/14`；AC-12 端到端 15/15（§3 已闭合） |
| 2 | 回归基线不破：失败集合差集 = 0、tests >= 992、三主链逐字、`ROLES.developer` 仅增 `artifact_type` | ✅ | 全量 1028/1019/8，差集 = 0；`i17-regression::R-1`；`templates/index.js` 仅 +2 行 |
| 3 | 回归红线 R-1~R-6 | ✅ | 三主链逐字（regression）；doc-single 14/14；`dependencies`=0；purity exit 0；既有用例只增不减（992→1028）；`resolveNodeProducts` 既有 5 分支语义不变（`i17-code-strategy` R-6 用例 + `doc-artifact` 14/14） |
| 4 | 架构扫描：31 禁词 exit 0；`code-isolation.js` 无 31 词、无 `if host ==`；角色/图字面量只在 `src/templates/**` | ✅ | purity 实跑「扫描 22 文件零命中」exit 0；`code-isolation.js` CJK=0 / `if host ==`=0 |
| 5 | NFR：冲突绝不静默覆盖、合并顺序/进度可见、零新增依赖 | ✅ | `AC-08`（abort+升级）；`AC-06`（`maxActive=1` + 状态词）；`deps=0` |

## 2. 门禁实跑（复核命令）

```bash
node --test "test/**/*.test.js"                       # 1028/1019/8/1（差集=0）
node --test "test/wp7/*.test.js"                      # 37/37
node --test test/wp10/doc-artifact.test.js            # 14/14
node --test "test/templates/**/*.test.js"             # 28/28
node --test test/wp4/orchestrator.test.js             # 37 用例 36 绿；唯一失败=基线 #6
node probe/i17-ac12-status.mjs                        # 15/15（真实 core IPC + 真实 CLI）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>   # exit 0
node -e "console.log(Object.keys(require('./package.json').dependencies||{}).length)"  # 0
```

## 3. 未闭合项（明确登记）

1. **【已闭合】AC-12 端到端探针**：`probe/i17-ac12-status.mjs` 在 `os.tmpdir()` 隔离根内真实拉起 core（命名管道 IPC），造三个实例快照后跑真实 `node bin/orch.js instance status`，**15/15 全绿**，证据落 `evidence/ac12-status/`：
   - 已合并：`节点 T-001 开发 已完成 · 第 1 轮 · 耗时 50s · （开发 分支 maestro/INST-AC12-MERGED/developer · 已合并）`
   - 冲突：`节点 T-001 开发 已升级 · 第 1 轮 · （开发 分支 maestro/INST-AC12-CONFLICT/developer · 冲突待升级）` + `升级 ESC-AC12-001 待处理` / `原因：合并冲突`
   - 负控 `single`：`实例 INST-AC12-SINGLE · 已完成` / `节点 已完成`（无分支片段，三主链不回灌）
   - `instance graph` 文本视图：同样含 `maestro/INST-AC12-MERGED/developer`
   - 口径说明：探针验证「磁盘快照 → core IPC → CLI 渲染」；`branch/mergeStatus` 的写入由 `i17-code-isolation` + `orchestrator` 钩子单测覆盖，两者合起来构成 AC-12 全链。
2. **真实宿主面未验证**：worktree 隔离在真实 DSH 会话中的执行面（B/C 类预判 B），I1.7 以本地 git 夹具为准。
3. **评审建议遗留（非阻断）**：F-02/F-08 及健壮性建议，见 `report.md §4`。

## 4. 终验结论

- 退出标准 1~5 **全部满足**；S2 实现、S3 回归门禁、AC-12 端到端探针均通过。
- **判定：PASS**（2026-11-10 07:20 由 Conditional PASS 转为 PASS，闭合项见 §3 第 1 条）。
