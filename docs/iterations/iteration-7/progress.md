# I1.7 进度台账

> 主控调度台账（依据 `docs/templates/execution-template.md` §2.0）。具体工作由 SubAgent 承担，主控只调度、复核、裁决、汇报。

## 阶段状态

| 阶段 | 状态 | 门禁数字 | 证据 | 结论 |
|---|---|---|---|---|
| S0 需求生成与评审 | ✅ 通过 | review-round2 总判 PASS（阻断 0 / 建议 0）；F-01/F-02 闭合 | `requirement.md` v2（定稿）、`requirement-understanding.md`、`review-round1..2.md` | PASS |
| S1 拆分与选型 | ✅ 通过 | 拆分评审 split-review.md（F-01/F-02 阻断 → 修复后自检全绿） | `iteration-7.md`（8 节 + AC→WP 14/14 + 文件零交集；split-review.md） | PASS |
| S2 实现 | ✅ 收口 | 6 WP 全部合入：WP-1 `e67853b`、WP-2 `e138230`、WP-3 `03bd672`、WP-4 `55ad835`、WP-5 `dcf4fc1`、WP-5b `490ee15`、WP-6 `8a50866`；wp7 测试 31→37 条全绿、purity exit 0、deps 0 | `progress.md` §S2 批次台账；单测证据见各 WP | 待独立评审（R-01） |
| S3 验收 | ⏳ 未开始 | — | — | — |
| S4 终验与收口 | ⏳ 未开始 | — | — | — |

## 基线（DoR #9，HEAD `3f35bfa`）

- 全量测试：`node --test "test/**/*.test.js"` → **992 tests / 983 pass / 8 fail / 1 skipped**（耗时 ~226s）。
- **8 条失败均为预存在、与本迭代无关**：NFR-02 性能 p95（2）、`core.stop` 真进程 5s 收敛、`cursor.json` 并发消费、`main --cwd` 相对解析、`task-loop` 审核提示词绝对路径、早返回 turn-delay 时序、自动拉起 detached 真进程。属性能/真进程/并发/时序类环境敏感测试，**不与 I1.7 产物隔离/worktree 工作交集**。
- **回归门禁口径**（与 `requirement.md` AC-11、I1.7 规划「集成版回归门禁」一致）：I1.7 收口后以**失败集合差集 = 0** 判定回归（不得新增超出基线 8 条的失败），且 AC/测试条数只增不减。基线失败集已存档 `baseline-failures.txt`。
- 架构扫描：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` → exit 0（评审实跑确认）。

## S0 Gate（§1.1 13 条 DoR）

| # | 判据 | 结论 |
|---|---|---|
| 1 | 头部版本已定稿、无「评审中/草稿」、附录 C 末行==头部 | ✅ 已改 `状态：定稿`，v2，附录 C 末行 v2 |
| 2 | AC 连续、三件套齐全、有 Then | ✅ AC-01~14 连续，14/14 三件套+Then |
| 3 | 每条 AC 有 机检/夹具/架构检查 之一 | ✅ 14/14 |
| 4 | BR 双向覆盖 | ✅ BR-01~11 双向零孤立 |
| 5 | 附录 A 输出基线覆盖带文案 AC；附录 D 可指导编码 | ✅ |
| 6 | 附录 D 授权断言修改清单点名文件+段 | ⚠️ 点名文件+改动段（行号待 S1 冻结构造时回填，不影响开工） |
| 7 | 无阻塞未决问题 | ✅ U-1/2/3 均不阻塞 |
| 8 | 范围外清单明确 | ✅ §1.3 六条 Out |
| 9 | 全量基线数字已记录且全绿 | ⚠️ 见上「基线」：992/983/8，8 条预存在无关失败；回归以失败集差集=0 为准 |
| 10 | 每条 AC Given 可构造 | ✅ 14/14（understanding §6） |
| 11 | 同一编号跨 AC 语义不漂移 | ✅ |
| 12 | 架构检查给可执行命令 | ✅ 31 词逐字 |
| 13 | S0 评审闭环 PASS、F 清零 | ✅ review-round2 PASS |

**S0 结论**：除 DoR #9「全绿」因 HEAD 预存在 8 条环境敏感失败而改为「失败集差集=0」口径（与 AC-11 一致），其余 12 条全绿，S0 准出。

---

## S2 实现 · 批次台账与缺陷/缺口登记

> 主控每批回收三件事：核 diff（只动授权文件） / 核门禁数字（单测、purity exit 0、零依赖） / 核证据（测试文件与断言）。每 WP 独立评审 Agent（干净上下文）。

### 批次 1（2 并行，已收口）—— WP-1 + WP-5

| WP | commit | 改动文件（与授权一致） | 门禁 | 证据 | 结论 |
|---|---|---|---|---|---|
| WP-1 | `e67853b` | `src/persistence/paths.js`（+21，仅追加两函数）、`test/wp7/i17-paths.test.js`（+40，新建） | 单测 3/3 绿；purity exit 0；既有 5 函数体零改（断言逐字不变通过） | `instanceCodeWorktreeDir`→`<workspace>/worktrees/<roleId>`、`instanceDataDir`→`<workspace>/artifacts/data` 内存断言 | ✅ 通过 |
| WP-5 | `dcf4fc1` | `src/cli/labels.js`（+18，仅追加 7 键）、`src/cli/render.js`（+88/-20，`includeBranch` 开关 + graph 透出）、`src/core/status-text.js`（+48/-4，`renderStatusDoc` 追加片段）、`test/wp7/i17-labels.test.js`（+77，新建） | 单测 6/6 绿；purity exit 0（21 文件 task-loop 零命中）；既有键计数/内容逐字不变 | 7 键中文非空、既有键不变；`includeBranch` 默认 false 防回灌三主链；graph 节点行/JSON 默认透出 branch/mergeStatus | ✅ 通过（含 1 缺口，见下） |

**WP-5 缺口（待 Batch 3 闭环，登记为缺陷/缺口台账 #G-01）**：
- 现象：`orch instance status` 纯文本视图的分支/合并状态未透出（AC-12 文本视图缺口）。
- 根因：main.js 不在 WP-5 四文件授权内；`statusCommand`（main.js 第 1066/1074 行）调用 `render.renderNodeLines(snapshot,{template})` / `render.renderEscalationBlock(snapshot,{template})` 未传 `includeBranch:true`。
- 范围澄清：`run` 前台路径（main.js 第 950/958 行）**必须保持** `includeBranch:false`（F-03，已正确隔离）；graph 视图（main.js 1216/1218）WP-5 已默认透出、无需接线。
- 处置：Batch 3 由接线小任务精确修改 main.js 第 1066/1074 两行加 `includeBranch:true`，补断言，不碰 run 路径与既有非 code 节点输出（AC-12 协作闭环）。

### 批次 2（2 并行，已收口）—— WP-2 + WP-3

> **执行方式说明（重要）**：本批原计划派 2 个干净上下文 SubAgent，但平台对该操作返回 **429 频率限制**（两次派单均失败）。为不阻塞迭代，改由主控在 Agent 模式下直接实现，并**立即补做同口径门禁自检**（diff 范围、单测、purity、零依赖、回归）。**独立评审仍按方法论由干净上下文评审者承担，标记为「待补」**（见下缺陷/缺口台账 #R-01），评审通过前本批不视为最终合格。

| WP | commit | 改动文件（与授权一致） | 门禁 | 证据 | 结论 |
|---|---|---|---|---|---|
| WP-2 | `e138230` | `src/core/code-isolation.js`（+395，新建）、`test/wp7/i17-code-isolation.test.js`（+299，新建） | 单测 **8/8 绿**；purity exit 0（22 文件 31 词零命中）；零依赖 `deps=0`；无 `if host` 分支；真实本地 git（`fs.mkdtemp(os.tmpdir())`） | AC-07（不同文件顺序合并无覆盖）、AC-08（同文件冲突检测→abort 回滚→worktree/分支保留）、AC-13（worktree 创建失败→`WORKTREE_INIT_FAILED`+`worktree_init_failed` 升级条目）、AC-14（合并异常→`merge_aborted`+`mergeStatus=conflict`+reprocess 后成功）、顺序无并发（`maxActive=1`）、生命周期 `pending→merging→merged/conflict` | ✅ 自检通过（独立评审待补 #R-01） |
| WP-3 | `03bd672` | `src/core/doc-artifact.js`（+42/-1，新增 `code` 分支+角色级覆盖）、`src/templates/index.js`（+2，`ROLES.developer.artifact_type='code'`）、`test/wp7/i17-code-strategy.test.js`（+113，新建） | 单测 **6/6 绿**；purity exit 0；零依赖 `deps=0`；**回归**：`test/wp10/doc-artifact.test.js` 14/14 绿、`test/templates/**` 28/28 绿、`test/wp4/orchestrator.test.js` 32/33（唯一失败=基线 #6 `/private/var` vs `/var` 符号链接，预存在、与本次无关） | `resolveNodeProducts` `code` 策略返回 `instanceCodeWorktreeDir` 路径、角色级覆盖（developer `declared`→worktree）、既有 5 分支逐字不变（含 `worker` 节点不被覆盖） | ✅ 自检通过（独立评审待补 #R-01） |

**本批发现的技术要点（供 S3 验收/后续 WP 参考）**：
1. **worktree 建在仓库工作树内可行**：`git worktree add <workspace>/worktrees/<role>` 需仓库已有 HEAD 且身份已配置；`ensureGitRepo` 内置 `git init` + repo-local `user.name/email` + 初始空提交 + `.gitignore(worktrees/)`，否则 `-b` 分支无从创建、merge 会因缺身份报错。
2. **`git merge` 冲突退出码为 1**（当不接管道时）；`detectConflict` 用 `git diff --diff-filter=U` 取 unmerged paths 判定，二者互补。半成品合并由 `git merge --abort` 回滚，两 worktree/分支完整保留（实证）。
3. **角色级覆盖对 code-loop 无副作用**：T-001（developer）`products: []`，`verifyProducts` 对空列表不触盘、直接 `{ok:true,refs:[]}`；故 baseDir 由 `cwd` 改为 worktree 不改变既有编排输出（orchestrator 32/33，唯一失败为基线 #6）。


## 缺陷 / 缺口 / 评审台账

| 编号 | 类型 | 内容 | 处置 | 状态 |
|---|---|---|---|---|
| G-01 | 缺口（WP-5） | `orch instance status` 纯文本视图未透出分支/合并状态（main.js 1066/1074 未传 `includeBranch:true`；950/958 属 run 路径须保持 false） | Batch 3 由接线任务精确改 main.js 两行 + 断言 | 待闭（Batch 3） |
| R-01 | 流程（评审） | WP-2/WP-3 因 SubAgent 429 由主控代写，缺干净上下文独立评审 | 待频率限制恢复后派独立评审 SubAgent（review-wp2-wp3.md），通过前本批不视为最终合格 | 待补 |

### 批次 3（2 并行，已收口）—— WP-4 + WP-5b（main.js 接线，闭 G-01）

| WP | commit | 改动文件 | 门禁 | 结论 |
|---|---|---|---|---|
| WP-4 | `55ad835` | `src/core/orchestrator.js`（+191，三钩子：派发建 worktree / done 入队 / resolve 重投）、`src/core/workspace.js`（+17，code 图确保 git 仓库）、`test/wp4/orchestrator.test.js`（+286，扩清单） | 独立复核：`test/wp4/orchestrator.test.js` 37 用例 **36 绿 / 唯一失败=基线 #6**（`/private/var` vs `/var`）；wp7 31/31；purity exit 0；deps 0；仅动 3 个授权文件 | ✅ 通过 |
| WP-5b | `490ee15` | `src/cli/main.js`（+6/-2，仅 `instance status` 1066/1074 加 `includeBranch:true`；run 路径 950/958 不动）、`test/wp7/i17-labels.test.js`（+52，3 条渲染断言） | `i17-labels` 9/9 绿；`node --check main.js` OK；run 路径逐字不变 | ✅ 通过（**G-01 关闭**） |

> **WP-4 复核要点**：钩子仅契约调用（`isCodeRole`/`prepareCodeWorktree`/`createMergeQueue` 每实例缓存/`applyMergeChange` 经 `saveLive` 投影/`escalateState` 增加 `entry` 预构条目）；合并/冲突/abort 逻辑仍在 `code-isolation`；`transit()` 唯一入口未破；code-loop 既有断言只增不弱（33→37）。

### 批次 4（末批，已收口）—— WP-6 回归守护

| WP | commit | 改动文件 | 门禁 | 结论 |
|---|---|---|---|---|
| WP-6 | `8a50866` | `test/wp7/i17-regression.test.js`（+150，新建） | 6/6 绿：三主链节点行逐字（`single`/`code-loop`/`task-loop`，run 路径无分支回灌）、图结构逐字、doc-single v1/v2 独立、report 追加区、AC-10 角色边界、purity spawn exit 0 + deps 0 | ✅ 通过 |

> 全量回归门禁（失败集合差集 = 0）在 S3/S4 以「全量测试 vs `baseline-failures.txt`」执行，见下方 S3 记录。
