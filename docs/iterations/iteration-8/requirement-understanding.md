# I1.8 需求理解纪要（S0 PASS 后 · 供 S1 拆分输入）

> **依据**：`docs/iterations/iteration-8/requirement.md` **v3**（1419 行，头部 `:6` = 附录 C 末行 `:1133`）全文逐条自读；`docs/templates/execution-template.md` §1.0.5 / §1.1（13 条 DoR）/ §1.3（拆分文档 8 节骨架）；`docs/iterations/iteration-8/review-round3.md`（第 3 轮总判 PASS，阻断 0 / 建议 0，DoR 13 条全绿 —— 仅作交叉核对，**不采信其任何自述结论**）；`docs/iterations/iteration-8/decisions.md`（裁-1~裁-5）；`docs/index.md` 第一部分 §3.1~§3.6（四层状态模型 + 恢复规则）、第二部分 `#### I1.8`（`:813~824`）、`:696 / :703 / :711 / :1003~1020`；`docs/iterations/iteration-6/report.md` §5；`docs/iterations/integration-2026-11-09.md`。
> **角色**：需求理解工程师。**不做评审、不出新评审结论**；S0 已 PASS 是主控给定的事实，本纪要据定稿需求理解其范围、契约、可构造性与回归约束，不改需求的 Then、不删范围、不放宽断言、不宣布任何新的评审判定。
> **数字自核（自己机械统计，不采信需求自述）**：AC **67**（`#### AC-01`~`AC-67` 连续逐条读 §3.1）、BR **54**（§2.11 表）、NFR **8**（§3.2 表）、M **8**（§1.4）、C **18**（§1.4）、附录 A **10 节**（A-1~A-10）、附录 D **13 节**（D-1~D-13）、附录 B 未决问题 **17 条**（B-01~B-17）、范围外 **13 项**（§1.3 表 `:69~81`）、规划 **8 子项 + 3 句验收**（`index.md:815~824`）。AC 分面、风险分布、BR 反向引用均逐条自算，见 §2 / §3。
> **代码现状只用于核查可构造性**：`test/fixtures/{code-loop-driver,task-loop-driver,mock-acp-agent,purity-check}.mjs/js`、`src/daemon/{lifecycle,server}.js`、`src/core/orchestrator.js`、`src/adapter/acp-client.js`、`src/persistence/instance-store.js` 已读 / Grep 核实；接缝实文见 §6.2。
> **只读纪律**：本文件是本次唯一新建文件；未修改 `requirement.md` / `review-round*.md` / `decisions.md` / `index.md` / 模板 / `src/**` / `test/**` / `assets/**`；未跑全量测试（避免改写 `docs/iterations/iteration-4/evidence/*.json`，故无需 `git checkout --`）；只读实跑（`command -v dsh`、Grep、`git status`）不落仓库。核查时分支 `feat/i1.8-instance-recovery`、HEAD `3f35bfa`、`git status --short` 仅 `?? docs/iterations/iteration-8/`。

---

## 1. 范围 In / Out

### 1.1 In —— 逐项对应规划 8 子项 + 3 句验收

规划原文逐字取自 `index.md:815~824`；落点行号为需求 v3 行号。「范围内」清单在需求 §1.3 是 **12 项**（`:52~63`），其中第 1 项规划（状态机/轮次/检查点）在 §1.3 拆成 3 项，第 6/7/8 项规划分别对应 §1.3 的「特殊节点恢复 / 会话失败区分 / 会话复用策略」，§1.3 第 11、12 项是工程约束（用户可见输出、兼容与纯净），非规划外新能力。

| # | 规划原文（逐字，`index.md` 行号） | 需求 §1.3 范围内项 | 需求 §2 落点 | AC 落点（主） |
|---|---|---|---|---|
| 1 | 「实例管理器完整：状态机、轮次计数、检查点」（815） | 1 状态机 / 2 轮次计数 / 3 检查点（`:52~54`） | §2.2 `:196~212` | AC-01~07、AC-09、AC-10、AC-14、AC-58~60 |
| 2 | 「ACP 会话恢复方言处理：`session/resume`（不回放）、`session/load`（回放/追加）、`resumeOrCreate` 回退链」（816） | 4 ACP 会话恢复方言（`:55`） | §2.3 `:214~227` | AC-19~27 |
| 3 | 「崩溃恢复：daemon 重启后从检查点恢复」（817） | 5 崩溃恢复（`:56`） | §2.4 `:229~243` | AC-05、AC-09~18、AC-58 |
| 4 | 「角色实例恢复规则：`busy` 角色会话不可恢复时降级为 `available`」（818） | 6 角色实例恢复（`:57`） | §2.5 `:245~257` | AC-28~31、AC-64、AC-67 |
| 5 | 「连接线聚合恢复规则：`delivered` 未 `accepted` 标记为 `pending` 并重投」（819） | 7 连接线聚合恢复（`:58`） | §2.6 `:259~270` | AC-32~36、AC-61、AC-62 |
| 6 | 「特殊节点恢复规则：`human` 节点保持 `running`」（820） | 8 特殊节点恢复（`:59`） | §2.7 `:272~282` | AC-37~41 |
| 7 | 「会话失败区分：ACP 会话进程崩溃 vs 运行慢」（821） | 9 会话失败区分（`:60`） | §2.8 `:284~293` | AC-42~47、AC-63 |
| 8 | 「会话复用策略：`reuse` / `fresh`」（822） | 10 会话复用策略（`:61`） | §2.9 `:295~305` | AC-48~51、AC-65、AC-66 |
| — | §1.3 第 11 项「用户可见输出」、第 12 项「兼容与纯净」（`:62~63`） | 工程约束，源自 `index.md:711` 回归红线 / BR-44~46 | §2.10 `:309~319`、附录 A、D-11/D-12 | AC-52~57、AC-10、AC-55 |

**3 句验收（`:824`）逐字 → AC**：
1. 「回流中途 kill daemon，重启后从检查点恢复且不重复已完成节点」→ AC-07 / AC-08 / AC-09 / AC-10 / AC-58（现场 = 开发第二轮「已完成」、测试复测「执行中」，`done=1`、`skipped===1`）。
2. 「ACP 会话恢复方言正确回退」→ AC-19~23、AC-25、AC-27（`resume → load → new` 逐步可见，BR-21）。
3. 「角色实例和连接线聚合正确恢复」→ AC-28~36、AC-61~64、AC-67。

另按需求 §1.3.3 登记的「无规划逐字来源、但由基线/前序约束推出」的 6 条 BR、9 条 AC 属于基线派生（9 态位置投影、`review` 重新核对、检查点写失败告警、`created` 继续投递、`unavailable` 去向、`assigned`/`blocked`/`ready` 保持），不是规划外夹带，In 范围内一并成立。

### 1.2 Out —— 逐项列 §1.3 的 13 项范围外（`:69~81`）

| # | 不做的事 | 留给谁 | 备注（需求原文口径） |
|---|---|---|---|
| 1 | 依赖 I1.7 的 worktree / 产物类型隔离 / 合并顺序 | I1.7 | 当前 main 不含 I1.7；只用现有 `artifactRefs`；**I1.7 合入后必须重跑本迭代回归**（详见 §1.4 / §7.3） |
| 2 | 项目工作流的运行时实例化（`orch run --workflow`） | I1.7 / 后续运行时迭代 | I1.6 已登记 B-01；本迭代只恢复「已经存在的实例」 |
| 3 | 真实项目工作流里的 `human` / `subworkflow` 运行时 | I1.7 / I1.10a | `human` 恢复规则用夹具预置状态验证；`subworkflow` 作为不透明节点保留、不展开 |
| 4 | 资产版本锁定（实例启动时锁定资产版本） | 后续迭代 | 只在检查点保存「锁定图快照」，不引入资产版本号体系（B-02） |
| 5 | 工作流权限匹配（节点权限与角色工具集匹配） | 后续迭代 | 不新增运行时权限检查（B-03） |
| 6 | 待审批会话的审批上下文恢复 | I1.11 | 真实 DSH 写 cwd 文件不触发 `session/request_permission`，审批只能靠夹具；本迭代不恢复审批请求（B-10） |
| 7 | 三层日志、健康度计算、`orch trace show` | I1.9 | 只写恢复事件，不做链式哈希与健康度 |
| 8 | 角色流程图 / 连接线的图形渲染与推送节流 | I1.10a / I1.10b | 只把恢复后的角色实例与连接线聚合数据算对，文本/JSON 可见 |
| 9 | 人工干预队列、托盘通知、审批面板 | I1.11 | 只保证恢复后状态可查询 |
| 10 | 预算 / 配额、并行度上限、`max_concurrent_sessions` 派发拦截 | I1.12 / I1.7 | 复用时只做「同角色同实例内选一个空闲会话」 |
| 11 | Cursor / WorkBuddy 的真实恢复 | 阶段二 I2.x | 只验证 DSH 内置 acp（resume）与第三方 `dsh-acp-server`（load，真实或夹具） |
| 12 | 旧格式（v1 / 无检查点的历史实例）的自动恢复 | 不做 | 无检查点且模板未知时按「已中断」保留，提示新建实例；不猜测、不重写旧快照 |
| 13 | 新增 `orch recover` 之类的命令 | 不做 | 恢复在 daemon 启动时自动发生；用户仍用既有 `status` / `instance status` / `instance log` / `instance graph` 观察 |

### 1.3 I1.7 边界（三层口径，逐条对应 BR-47 / C-16 / AC-56 / B-01）

1. **当前 main 不含 I1.7**：`docs/iterations/iteration-7/requirement.md` 不存在（AC-56 判据，本次实跑 `NOT_EXIST`）；`src/core/worktree.js` 不存在、`grep -R "worktree" src/ | wc -l` = 0、`grep -R -E "artifact_type.*dir|merge.*order" src/core src/daemon` = 0（AC-56 四锚点本次实跑全真、非恒假）。`index.md:1010` 依赖链为 `… → I1.6 → I1.7 → I1.8 → …`，但需求头部 `:8` 与 §3.3#10 明确「当前 main 不含 I1.7」。
2. **不依赖其能力**：恢复只读取现有 `artifactRefs`，不读取、不推断 worktree 路径（R-9、C-16、B-01）；`subworkflow` 不透明保留；`orch run --workflow` 运行时实例化仍范围外。
3. **合入后重跑**：BR-47「I1.7 合入后必须重跑本迭代全部 AC」；AC-56 架构检查段要求报告登记「I1.7 合入后重跑」；B-01 进一步要求「由 I1.7 的产物语义复核恢复规则，若改变 `artifactRefs` 语义需在 I1.7 报告追加交叉说明」，并标「阻塞 I1.7 与本迭代的最终联合验收」。详见 §7.3。

---

## 2. AC 清单与分面（67 条）

### 2.1 分面口径（自己定义、逐条唯一归类、不重不漏）

用户要求的「面」共 6 类：**真实宿主 / 夹具 / 机检 / 架构检查 / 边界 / 混合**。这 6 类不是需求自带的字段，本纪要按「**主取证面**」自行判定，判定优先级固定如下（每条 AC 恰好归入 1 类，故各类计数之和必为 67）：

1. 需求「场景类型」标注 `真实宿主` → **真实宿主面**；
2. 标注 `架构检查` → **架构检查面**；
3. 标注 `混合` → **混合面**；
4. 标注 `边界` → **边界面**（其验收目标是边界/回归不变量；虽也带机检或夹具锚点，但为免重复计数统一归此面）；
5. 其余（正常路径 / 夹具 / 异常 / 用户可见 / 回归）按**判定锚点**分：锚点 `机检：` → **机检面**，锚点 `夹具：` → **夹具面**。

**交叉核对（自己机械统计，不采信需求/评审自述）**：按需求每条 AC 的判定锚点逐条数，得 `机检 28 + 夹具 36 + 架构检查 3 = 67`（与 `execution-template.md` §1.1 DoR-3 的 67/67 一致，此处仅作算术交叉验证，不引用评审结论）。按「场景类型」逐条数：真实宿主 3、架构检查 3、混合 1、边界 17、其余 43；其余 43 条按锚点拆为机检 12 / 夹具 31。故 6 面计数 = `真实宿主 3 + 架构检查 3 + 混合 1 + 边界 17 + 机检 12 + 夹具 31 = 67`。

### 2.2 67 条 AC 一张表

> 列：AC 号 / 一句话标题（需求 §3.1 标题逐字压缩）/ 面 / 风险等级 / 引用 BR（需求「引用：」行逐字）。

| AC | 一句话标题 | 面 | 风险 | 引用 BR |
|---|---|---|---|---|
| AC-01 | 九个节点位置在用户可见层对得上 | 机检 | P0 | BR-01、BR-02 |
| AC-02 | 检查点随每一件进展推进 | 夹具 | P0 | BR-03、BR-04 |
| AC-03 | 检查点内容足以恢复「做到哪」 | 夹具 | P0 | BR-04、BR-05 |
| AC-04 | 检查点写失败时用户看得到，运行不中断 | 机检 | P1 | BR-06 |
| AC-05 | 检查点缺失但实例记录完整时按实例记录恢复 | 夹具 | P1 | BR-05、BR-09 |
| AC-06 | 实例记录不可读时不从检查点静默重建 | 机检 | P0 | BR-05、BR-12 |
| AC-07 | 重启后轮次不重置 | 机检 | P0 | BR-07 |
| AC-08 | 已完成节点不重放 | 夹具 | P0 | BR-08 |
| AC-09 | 回流中途 kill daemon，重启后从检查点继续（规划验收句） | 夹具 | P0 | BR-07、BR-08、BR-09、BR-12 |
| AC-10 | 恢复摘要一行说清「从哪来、跳过多少、第几轮」 | 机检 | P1 | BR-05、BR-09 |
| AC-11 | 挂起实例重启后仍挂起 | 边界 | P0 | BR-09、BR-35 |
| AC-12 | 升级节点重启后仍是已升级 | 边界 | P0 | BR-15 |
| AC-13 | 失败节点重启后不自动重跑 | 边界 | P0 | BR-16 |
| AC-14 | 待校验节点恢复只重新核对，不重放会话 | 夹具 | P1 | BR-14 |
| AC-15 | 旧实例无检查点且模板未知 → 已中断并提示新建 | 边界 | P1 | BR-11 |
| AC-16 | 显式 core stop 仍是已中断，不自动恢复 | 机检 | P0 | BR-10 |
| AC-17 | 恢复失败时用户看到原因 | 夹具 | P0 | BR-12 |
| AC-18 | 恢复幂等：重复启动不重复推进 | 夹具 | P0 | BR-13 |
| AC-19 | resume 方言：广告 resume 时走不回放 | 夹具 | P0 | BR-17、BR-18 |
| AC-20 | load 方言：广告 load 时走回放且不重复投递 | 夹具 | P0 | BR-17、BR-19 |
| AC-21 | new 方言：两种都不支持时新建并只重发当前轮 | 夹具 | P0 | BR-17、BR-20 |
| AC-22 | resume 失败时回退 load，且每一步可见 | 夹具 | P0 | BR-21 |
| AC-23 | 三种方言都失败时按 §3.6 降级 | 夹具 | P0 | BR-22 |
| AC-24 | resume 成功也不重放已完成节点 | 夹具 | P0 | BR-18、BR-08 |
| AC-25 | 真实 DSH：只广告 resume、不广告 load，恢复走 resume | 真实宿主 | P0 | BR-23、BR-48 |
| AC-26 | 真实 DSH：重启不重复已完成节点 | 真实宿主 | P0 | BR-08、BR-48 |
| AC-27 | 第三方 load 方言：真实可用则真验，否则阻塞 | 真实宿主 | P1 | BR-23、BR-48 |
| AC-28 | 角色 busy 且会话不可恢复 → available | 夹具 | P0 | BR-24、BR-27 |
| AC-29 | 角色 busy 且会话可恢复 → 保持 busy | 夹具 | P1 | BR-25 |
| AC-30 | available / cooldown / inactive 不受恢复影响 | 边界 | P1 | BR-26 |
| AC-31 | 降级后重新调度，角色回到 busy | 夹具 | P1 | BR-24 |
| AC-32 | delivered 未 accepted → pending 并重投 | 夹具 | P0 | BR-28、BR-31 |
| AC-33 | 已 accepted 的交接包不重投 | 边界 | P1 | BR-29 |
| AC-34 | consumed / rejected / expired 恢复后不改 | 边界 | P1 | BR-30 |
| AC-35 | 重投成功后回到已投递 / 已接受 | 夹具 | P0 | BR-28 |
| AC-36 | 连接线聚合在恢复实例的图上可见 | 机检 | P1 | BR-31 |
| AC-37 | human 节点保持 running，等待人工 | 夹具 | P0 | BR-32 |
| AC-38 | escalate 节点保持 escalated | 边界 | P0 | BR-33 |
| AC-39 | failed 节点保持 failed | 边界 | P0 | BR-34 |
| AC-40 | suspended 实例内全部节点保持原状 | 边界 | P0 | BR-35 |
| AC-41 | subworkflow 节点在恢复中保持不透明 | 边界 | P1 | BR-54 |
| AC-42 | 会话进程崩溃：重建并重试当前轮 | 夹具 | P0 | BR-36、BR-37 |
| AC-43 | 会话重建失败 → 升级人工 | 夹具 | P0 | BR-38 |
| AC-44 | 运行慢：不重建会话 | 夹具 | P0 | BR-36、BR-39 |
| AC-45 | 运行慢 + 节点超时 → 记超时失败并升级人工 | 夹具 | P1 | BR-40 |
| AC-46 | 运行慢且未声明超时 → 继续等待，不擅自失败 | 边界 | P1 | BR-40 |
| AC-47 | 崩溃与运行慢的两类提示不混用 | 机检 | P1 | BR-36 |
| AC-48 | fresh 默认：每任务新会话 | 夹具 | P0 | BR-41、BR-42 |
| AC-49 | reuse：同一角色第二轮复用空闲会话 | 夹具 | P0 | BR-42 |
| AC-50 | reuse 不跨实例 | 边界 | P1 | BR-43 |
| AC-51 | 角色配置可见，非法值被拒 | 机检 | P1 | BR-41 |
| AC-52 | 非恢复路径的三条主链不变 | 机检 | P0 | BR-44 |
| AC-53 | 全量测试回归门禁：失败集合差集为 0 | 机检 | P0 | BR-44、BR-45 |
| AC-54 | 架构纯净：31 词扫描 exit 0、零依赖 | 架构检查 | P0 | BR-45 |
| AC-55 | 不新增 CLI 命令，用法块不变 | 机检 | P1 | BR-46 |
| AC-56 | I1.7 未合入：不依赖 worktree，合入后重跑 | 架构检查 | P0 | BR-47 |
| AC-57 | 真实宿主隔离：不动用户 `~/.dsh` | 架构检查 | P0 | BR-48 |
| AC-58 | 用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成 | 混合 | P0 | BR-09、BR-10、BR-15、BR-24、BR-28、BR-32、BR-36 |
| AC-59 | 恢复前就「已分配」的节点保持已分配并重新派发 | 夹具 | P0 | BR-53 |
| AC-60 | 「待执行」节点恢复后保持原位置，依赖不变 | 边界 | P1 | BR-53 |
| AC-61 | 已构造未投递的交接包恢复后继续投递 | 夹具 | P1 | BR-49 |
| AC-62 | 重投连续失败 → 已过期并升级 | 夹具 | P1 | BR-51 |
| AC-63 | 重建后的会话再次崩溃 → 直接升级，不再重建 | 夹具 | P0 | BR-52 |
| AC-64 | 重建失败 / 宿主不可达 → 角色显示「不可用」，恢复后回到可用 | 夹具 | P1 | BR-50 |
| AC-65 | reuse 但没有空闲会话 → 新建，不报错 | 边界 | P1 | BR-42 |
| AC-66 | reuse 不跨宿主、不复用正在服务其他节点的会话 | 边界 | P1 | BR-43 |
| AC-67 | 角色恢复后既无可用会话也无可调度节点 → 保持「可用」 | 边界 | P1 | BR-24、BR-50 |

### 2.3 分面统计（自洽核算）

| 面 | 计数 | AC 号 |
|---|---|---|
| 真实宿主 | **3** | AC-25、AC-26、AC-27 |
| 架构检查 | **3** | AC-54、AC-56、AC-57 |
| 混合 | **1** | AC-58 |
| 边界 | **17** | AC-11、12、13、15、30、33、34、38、39、40、41、46、50、60、65、66、67 |
| 机检 | **12** | AC-01、04、06、07、10、16、36、47、51、52、53、55 |
| 夹具 | **31** | AC-02、03、05、08、09、14、17、18、19、20、21、22、23、24、28、29、31、32、35、37、42、43、44、45、48、49、59、61、62、63、64 |
| **合计** | **67** | 3+3+1+17+12+31 = **67** |

> 夹具面 31 条精确清单即上表该行（31 个 AC 号，逐条可数）；AC-58 归混合面、AC-50/65/67 归边界面、AC-27 归真实宿主面、AC-54/56/57 归架构检查面，均不计入夹具面。
> 风险分布（自己逐条数）：**P0 41 条 / P1 26 条 = 67**。锚点维度交叉：**机检 28 / 夹具 36 / 架构检查 3 = 67**。两个维度都自洽，且分面是「唯一归类」、锚点是「可重叠的取证手段」，二者不矛盾。

### 2.4 真实宿主面 AC 清单及隔离 `DSH_HOME` 构造要求

**真实宿主面 3 条**：AC-25（DSH 内置 acp 只广告 resume、无 load，恢复走 resume）、AC-26（真实 DSH 重启不重复已完成节点）、AC-27（第三方 `dsh-acp-server` 0.14.4 广告 `loadSession: true`，真实可用则真验、否则判「阻塞」）。**AC-57** 是配套的环境隔离守卫（架构检查面，`:854~860`），与真实宿主面一并取证，不混入夹具面。

**隔离 `DSH_HOME` 构造要求**（来自 §3.3#6 `:962`、§3.3#7 `:963`、AC-25 `:581`、AC-57 `:859`、BR-48 `:372`、NFR-08 `:953`）：

1. 在 `%TEMP%` 下**新建**目录作为 `DSH_HOME`；把 `~/.dsh/.credentials.yaml` **复制**进去（不移动、不修改用户 `~/.dsh`）；用完删除隔离目录。
2. 真实项目根一律放 `%TEMP%`，**不放仓库内**；`NODE_ENV` 不注入测试接缝（真实面不用 mock）。
3. DSH 版本基线 `0.2.2-rc.1`；先用探针确认 `initialize` 返回的 `sessionCapabilities` 键集含 `close` / `list` / `resume`、**不含 `load`**（AC-25 机检口径）。
4. 环境守卫（AC-57）：`stat -c %Y ~/.dsh` 前后相同；隔离目录删除后不存在；`git status --porcelain` 不含仓库内新增项目根。
5. 审批类场景（`waiting_input`）只能靠夹具（真实 DSH 写 cwd 内文件不触发 `session/request_permission`），不得把真实面的「没有审批」当通过；本迭代不恢复审批上下文（B-10）。
6. **无 DSH / 无凭据 / 凭据无法复制 / 无法安装第三方** → 按 BR-48、NFR-08 判「**阻塞**」，报告写清尝试路径，**不用夹具结果冒充真实面**（AC-27 的 load 语义由 AC-20 夹具兜底，但兜底不等于真实面取证）。本次环境实测见 §5.2。

---

## 3. BR / M / C 契约清单

### 3.1 BR-01~54 一句话摘要 + 被哪些 AC 引用

> 摘要按 §2.11 `:325~378` 逐条压缩；「被引用」列由 67 条 AC 的「引用：」行逐条反查自算（54 条 BR 全部被至少 1 条 AC 引用，与 DoR-4 双向要求一致；此处只报自己数的结果）。

| BR | 一句话摘要 | 被哪些 AC 引用 |
|---|---|---|
| BR-01 | 节点 9 个精确位置；`blocked`/`ready`→「待执行」、`assigned`→「已分配」 | AC-01 |
| BR-02 | 任何位置变化必经同一条状态迁移入口，恢复/重投/复用不得旁路改状态 | AC-01 |
| BR-03 | 每件可确认进展后立即写检查点（分配/执行/核对/状态/轮次/交接/暂停恢复挂起完成） | AC-02 |
| BR-04 | 检查点记住进度摘要，不记对话全文/模型输出/凭据 | AC-02、AC-03 |
| BR-05 | 恢复时实例记录优先、检查点补锁定图与「上次确认到哪」，不可读时维持既有处理 | AC-03、AC-05、AC-06、AC-10 |
| BR-06 | 检查点写失败只提示不停推进，允许回退上一检查点 | AC-04 |
| BR-07 | 轮次从检查点/实例记录恢复，绝不重置 | AC-07、AC-09 |
| BR-08 | 恢复后不重放已完成节点 | AC-08、AC-09、AC-24、AC-26 |
| BR-09 | 只有 `running`/`created` 且有检查点（或内建模板）自动恢复；`suspended` 不恢复 | AC-05、AC-09、AC-10、AC-11、AC-58 |
| BR-10 | 显式 `core stop` 的「已中断」不自动恢复 | AC-16、AC-58 |
| BR-11 | 旧实例无检查点且模板未知 → 保持「已中断」并提示新建 | AC-15 |
| BR-12 | 恢复失败 → 「已中断」并给可见原因，不假装运行 | AC-06、AC-09、AC-17 |
| BR-13 | 恢复幂等：重复启动不重复推进、不重复写摘要 | AC-18 |
| BR-14 | `review` 恢复只重新核对证据、不重放会话 | AC-14 |
| BR-15 | `escalated` 恢复保持「已升级」，不重派、不自动生成新升级 | AC-12、AC-58 |
| BR-16 | `failed`（code-loop）恢复保持「失败」，不自动重跑 | AC-13 |
| BR-17 | 方言顺序固定 `resume → load → new`；`fresh` 直接 `new` | AC-19、AC-20、AC-21 |
| BR-18 | `session/resume` 不回放、不假设宿主记得上一轮、不重发已完成节点 | AC-19、AC-24 |
| BR-19 | `session/load` 回放/追加，不重复投递同一份已完成历史 | AC-20 |
| BR-20 | `session/new` 全新会话，只重发当前轮 | AC-21 |
| BR-21 | 每一次方言回退必须在日志点名，不得静默降级 | AC-22 |
| BR-22 | 三方言全失败 → 节点「已分配」、角色「可用」、未接受交接「待投递」 | AC-23 |
| BR-23 | DSH 内置 acp 只会 resume、不会 load；第三方会 load；适配器不得按宿主名分支 | AC-25、AC-27 |
| BR-24 | 角色 `busy` 且会话不可恢复 → `available` 并重新调度服务节点 | AC-28、AC-31、AC-58、AC-67 |
| BR-25 | 角色 `busy` 且会话可恢复 → 保持 `busy`，活跃会话数不变 | AC-29 |
| BR-26 | `available`/`cooldown`/`inactive` 不受恢复影响；不新增「恢复中」角色态 | AC-30 |
| BR-27 | 角色实例仍是派生视图，恢复后按会话重算 | AC-28 |
| BR-28 | `delivered` 未 `accepted` → 恢复为 `pending` 并重投 | AC-32、AC-35、AC-58 |
| BR-29 | 已 `accepted` 的交接包不重投 | AC-33 |
| BR-30 | `consumed`/`rejected`/`expired` 恢复后不改 | AC-34 |
| BR-31 | 连接线聚合不单独持久化，恢复后按优先级重算并在图上可见 | AC-32、AC-36 |
| BR-32 | `human` 节点恢复保持 `running`（等待人工），不重派不跳过 | AC-37、AC-58 |
| BR-33 | `escalate` 节点恢复保持 `escalated`，不重派 | AC-38 |
| BR-34 | `failed` 节点恢复保持 `failed`，不自动重跑 | AC-39 |
| BR-35 | `suspended` 实例内所有节点保持原状，不重派、不重新核对 | AC-11、AC-40 |
| BR-36 | 会话进程崩溃与运行慢必须给两类不同提示，不得混用 | AC-42、AC-44、AC-47、AC-58 |
| BR-37 | 崩溃每次派发最多重建一次，重建成功重发当前轮，轮次不增加 | AC-42 |
| BR-38 | 崩溃重建失败 → 升级人工，实例挂起 | AC-43 |
| BR-39 | 运行慢不重建会话，只提示，继续等待 | AC-44 |
| BR-40 | 运行慢且声明超时 → `failed_reason: timeout` 记失败并升级；未声明 → 继续等待 | AC-45、AC-46 |
| BR-41 | 角色可配 `reuse`/`fresh`，默认 `fresh`，与今天一致 | AC-48、AC-51 |
| BR-42 | `reuse` 只复用同实例/同角色/同宿主且 `idle` 的会话；`fresh` 每次新建 | AC-48、AC-49、AC-65 |
| BR-43 | 复用不跨实例、不跨宿主、不复用正在服务其他节点的会话 | AC-50、AC-66 |
| BR-44 | 非恢复路径既有输出逐字不变；恢复行只在恢复时追加 | AC-52、AC-53 |
| BR-45 | 零新增运行时依赖；`src/core`/`src/daemon` 31 词禁词扫描 exit 0 | AC-53、AC-54 |
| BR-46 | 不新增 CLI 命令；用法块 25 行、既有子命令参数不变 | AC-55 |
| BR-47 | I1.7 未合入前不依赖 worktree / 产物隔离；合入后重跑全部 AC | AC-56 |
| BR-48 | 真实宿主面必须在隔离 `DSH_HOME` + 复制凭据下验收；无法真实复现判「阻塞」 | AC-25、AC-26、AC-27、AC-57 |
| BR-49 | `created` 未投递交接包恢复后继续投递，不重构、不换包号、不重置重试次数 | AC-61 |
| BR-50 | 崩溃重建失败/宿主不可达 → 角色「不可用」；接回或重建成功回「可用」，重派回「服务中」 | AC-64、AC-67 |
| BR-51 | 重投连续失败 → 最终「已过期」并升级人工 | AC-62 |
| BR-52 | 同一次派发重建后再次崩溃 → 直接升级，不再重建 | AC-63 |
| BR-53 | 恢复后原本「已分配」保持并重新派发；「待执行」保持原位置、依赖不变 | AC-59、AC-60 |
| BR-54 | `subworkflow` 恢复中保持不透明，不展开内部节点、不向内部派发 | AC-41 |

### 3.2 M-1~M-8 授权变更逐条（改哪个文件 / 与哪条既有断言冲突 / D-9 授权）

> M 是「必须改代码/数据结构」的变更（§1.4 `:147~154`）；D-1 `:1139~1155` 给出文件边界，D-9 `:1345~1352` 是**唯一**允许改既有测试断言的清单。裁决优先级固定「AC 的 Then/And > 附录 A > 附录 D > M/C > 规划 > 代码现状」（`decisions.md` 抬头）。

| M | 改哪个文件（D-1 边界） | 变更要点 | 与既有断言 / 契约的冲突 | D-9 授权关系 |
|---|---|---|---|---|
| **M-1** | `src/core/orchestrator.js`（`transit()` 增加可选 `phase` 校验、`snapshotOf()` 投影）；**不改** `src/core/state-machine.js` 的 7 项状态表与既有迁移边（D-1 `:1155` 明令） | 新增 9 个精确位置；`pending` 承载 `blocked`/`ready`，`running` 承载 `assigned`/`running`；位置变化随同一次 CAS 落盘 | 与「`NODE_STATES` 仍是 7 项」的回归断言（AC-01 `:392` 机检）不构成改动——该断言保持；与既有迁移边不冲突（不新增自环迁移，D-2 `:1203`） | 无（不改测试文件） |
| **M-2** | 新增 `src/core/checkpoint.js`；扩展 `src/persistence/paths.js`（`checkpointPath`）、`src/core/orchestrator.js`（写点） | 新增 `instances/<id>/state/checkpoint.json`（`checkpoint/v1`），在实例目录下**新建 `state/` 子目录**，与 `state.json` 同级 | `state.json` 的路径/格式/`rev`/CAS/损坏处理全部不变；`instance-store.js` 既有 `markCorrupt` / `.corrupt` 备份（实文 `:113~115`）不改 | 无 |
| **M-3** | `src/adapter/acp-client.js`（扩展） | 新增 `resumeSession`/`loadSession`、能力归一化、`resumeOrCreate` 按 `resume→load→new` 回退；识别 `sessionCapabilities.resume/load`、`loadSession:true` | 与 **现状实文** `acp-client.js:314~328` 冲突：现状 `resumeOrCreate` 只走 `newSession`、注释明写「会话恢复留给 I1.8」；`newSession`/`prompt`/`cancel`/`closeSession` 签名与行为不变，`fresh` 仍走 `newSession` | 无 |
| **M-4** | `src/core/orchestrator.js`（`reconcileOnBoot`，实文 `:3894`）、`src/daemon/server.js`（实文 `:398` 调用） | `running`/`created` 且有检查点或内建模板 → `recoverInstance()`；`suspended`、显式 `core stop` 的 `interrupted` 跳过；恢复时 `assigned` 保持并重新调度、`delivered→pending` 重投、`created` 继续投递 | **直接冲突并必须改**：`test/wp4/orchestrator.test.js:480/575/578/580/584~586` 现状断言 `reconcileOnBoot` 把 `running` 判 `interrupted`（实文 `:575` `assert.deepEqual(result.interrupted, ['INST-009'])`、`:578` `'interrupted'`、`:580` `/stopped at node running/`、`:584~586` `core.gone` 三行）。`interruptAll`（`core stop`）不变 | **D-9 第二行**（本 M 是 D-9 存在的唯一原因） |
| **M-5** | `src/registry/role-schema.js`、`src/registry/asset-write.js`、`src/cli/roles.js`（扩展） | 角色新增可选键 `session_policy`（`reuse`/`fresh`，缺省 `fresh`）；`role show` 显式声明才多一行；`role edit --set` / `role create --from` 支持 | **直接冲突并必须改**：`test/wp11/role-schema.test.js:57` 现状 `assert.deepEqual([...ROLE_OPTIONAL_KEYS], ['tools','wake_allow','inputs','outputs','dispatchable']);`（5 键）。既有 26 内置资产一个字节不改；`role show developer` 逐字不变；`role list`/`validate` 计数不变 | **D-9 第一行** |
| **M-6** | `src/cli/labels.js`、`src/cli/render.js`（扩展） | 新增 `NODE_PHASE_LABEL`、恢复/检查点/崩溃/运行慢/复用文案、`ROLE_SESSION_POLICY_INVALID` 原因码文案；`render.js` 增条件追加行 | 只增键；既有六张状态表、既有文案、`USAGE_LINES` 25 行一个字符不改（A-1 `:992` 明确不改 `src/core/status-text.js` 词表） | 无 |
| **M-7** | `test/fixtures/mock-acp-agent.js`（能力扩展）、两个 driver（环境转参数）、新增 `test/fixtures/recovery/**` 与 `test/wp13/**` | 新增测试接缝（全部 `NODE_ENV=test` 生效）：`MAESTRO_TEST_PAUSE=after_assign[:节点]`/`after_handoff_created[:包号]`、`MAESTRO_FAULT=checkpoint_write:fail`、`MAESTRO_TEST_SLOW_MS`、`MAESTRO_TEST_RECOVERY_HOLD=after_assign`、`MAESTRO_TEST_GRAPH=<绝对路径>`；mock 新增 `MAESTRO_MOCK_CAPS/RESUME/LOAD/NEW_FAIL/CRASH/SLOW/SPAWN_FAIL_ON_RECOVER/PROMPT_FAILURES/PROMPT_LOG` | 全部只在 `NODE_ENV=test` 生效、生产路径不读；**不改**既有场景分支与既有断言（D-10 `:1360`「由 driver 读环境后转成同一组参数，不改既有参数语义」）。当前 `src/` Grep 命中 **0**、新夹具 Glob **0**，属实现期新增 | 无（新增断言一律 `test/wp13/**`） |
| **M-8** | `src/cli/render.js`（扩展） | `instance graph --format json` 仅在实例带 `recoveredAt` 时追加 `recovery` 与 `connections`（追加在 `current` 之后） | 非恢复实例 JSON **11 个顶层键**与顺序不变（A-9 `:1075`）、`graphVersion` 仍为 1；`USAGE_LINES` 不变 | 无 |

**D-9 授权断言清单（两行，逐字实文已核，见 §4.3）**：
- 第一行 `test/wp11/role-schema.test.js:57` → 数组末尾追加 `'session_policy'`（对应 M-5）。
- 第二行 `test/wp4/orchestrator.test.js:480`（用例标题）/ `:575` / `:578` / `:580` / `:584~586` → 按「按实例记录恢复」改期望；**同文件 `:588~592`「v1 实例必须一字不改」后半段保持原样**；`core stop` / `interruptAll` 相关用例不动（对应 M-4）。
- **除这两行外 `test/**` 一个字符不许改**；新增断言一律放 `test/wp13/**`（D-9 `:1352`）。

### 3.3 C-01~C-18 补充契约逐条（§1.4 `:160~177`）

| C | 契约（一句话） |
|---|---|
| C-01 | `phase` 只在 `pending`/`running` 上使用；其余状态 `phase` 必须缺省；显示词按 A-1；不带 `phase` 的旧节点按 `state` 直接显示 |
| C-02 | `transit()` 收到 `phase` 时写盘前校验 6 组合法迁移（`blocked→ready`、`ready→assigned`、`assigned→running`、`running→assigned`、`assigned→cancelled`、`assigned→escalated`），其余拒绝并落 `rejected/illegal_transition`；无 `phase` 走既有 7 项表 |
| C-03 | 检查点在每次成功 `saveState()` 之后写；写盘顺序固定「实例记录 → 检查点 → 事件广播」；写失败不回滚、不阻断事件 |
| C-04 | 检查点不含提示词全文、模型输出、凭据、完整对话历史；只含进度/会话标识/交接标识/锁定图快照/引用 |
| C-05 | 恢复读取顺序：先实例记录再检查点；实例记录可读以其为准；检查点 `rev` 大于实例记录只告警不采纳；不可读维持既有「状态不可读 + 备份 + 阻断写入」，不从检查点静默重建 |
| C-06 | 恢复后写一条「恢复摘要」事件与对应检查点；重复启动不得写第二份摘要 |
| C-07 | 方言选择只看 `initialize` 能力广告与角色策略，不得按宿主名分支 |
| C-08 | `resume` 成功 = 接回但不回放，不得假设宿主记得上一轮；`load` 成功 = 回放/追加，不得再投同一份已完成历史 |
| C-09 | `resume`/`load` 成功后按最后会话态决定「只等待 / 只重发当前轮一次 / 永不重发已完成节点」；会话升级人工沿用基线既有「已升级」红色圆点（裁-3：不新增会话状态取值、不新增 CLI 输出） |
| C-10 | 恢复失败（无可用方言/宿主不可达/锁定图缺失）→ 实例 `interrupted` 并写可见原因，不静默假装运行 |
| C-11 | 角色实例与连接线聚合仍是派生视图、不写 `state.json`；`unavailable` 只由「会话崩溃且重建失败 / 宿主不可达」产生，恢复后按派生规则回「可用」或「服务中」（见 C-18） |
| C-12 | 崩溃判据 = 会话建立后 transport 退出 / `DSH_SPAWN_FAILED`；运行慢判据 = 进程存活且超慢阈值无 `session/update`；`stopReason` 不参与判定 |
| C-13 | 崩溃重建每次派发最多一次；成功后重发当前轮提示；再次崩溃直接升级人工；重建不增加轮次 |
| C-14 | 运行慢不重建；节点声明 `timeout` 才在超时后按 `failed_reason: timeout` 处理（**本迭代新增落盘字段**，语义见 `index.md:164`，当前代码无该字段）；未声明只提示继续等待；慢阈值默认 10 分钟、`MAESTRO_TEST_SLOW_MS` 可缩短 |
| C-15 | `reuse` 只在同一实例/角色/宿主、会话 `idle`、未被其他节点占用时复用；角色 `available`/`cooldown` 只用于筛选候选角色、不当会话态；`fresh` 每次新建；跨实例/跨宿主不复用 |
| C-16 | I1.7 未合入前恢复不得读取 worktree、不得推断产物隔离目录，`artifactRefs` 原样保留；I1.7 合入后全部 AC 重跑并由 I1.7 产物语义复核 |
| C-17 | `created` 交接包恢复后继续投递：不重构、不改 `handoffId`、不重置 `deliveryAttempts`；`rejected`/`expired` 不因恢复重投 |
| C-18 | `unavailable` 只在「崩溃且重建失败 / 宿主不可达」出现；恢复后接回或重建成功按 C-11 回 `available`/`busy`，仍不可达保持 `unavailable` 并在 `role show` 可见，不写第二份真相 |

---

## 4. 附录 A / D 索引

### 4.1 A-1~A-10 各登记哪类输出（附录 A 开头 `:974`：「只登记新增/变更输出；未登记的输出不得改动」）

| 附录 | 登记哪类输出 | 消费它的 AC（主） |
|---|---|---|
| A-1（`:976~992`） | **节点 9 位置显示词表**（`blocked`/`ready`→待执行、`assigned`→已分配+「等待重新分配会话」、`running`→执行中、人工节点+「等待人工」）；`status.md` 看板列词与 CLI 精确位置两种粒度口径 | AC-01、AC-59、AC-60、AC-37 |
| A-2（`:994~1003`） | `orch status --instance` / `instance status` 的**恢复行** `恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3`（只在 `recoveredAt` 时追加） | AC-10、AC-09 |
| A-3（`:1005~1027`） | `orch instance log` **17 行新增短语**（恢复摘要、三方言、回退、角色降级、交接重投、复用、连接线、人工节点、按实例记录恢复、旧实例提示、恢复失败、检查点写失败、**重新核对**） | AC-14、AC-19~24、AC-28、AC-32、AC-37、AC-49、AC-61 |
| A-4（`:1029~1039`） | `orch instance graph` **恢复块**（恢复行 + `连接线：… 待投递（重投中）`）+ `--format json` 追加 `recovery`/`connections` | AC-10、AC-36、AC-58 |
| A-5（`:1041~1050`） | `orch role show` **会话复用行**（`  会话复用：复用（reuse）` / `每任务新会话（fresh）`），位置在「可唤醒」之后、「来源」之前 | AC-51、AC-49 |
| A-6（`:1052~1060`） | `orch run` / `instance log` **会话失败 5 行**（进程已退出/已重建/重建失败/无进展运行慢/节点超时） | AC-42~45、AC-47、AC-63 |
| A-7（`:1062~1064`） | `orch handoff list` / 状态块：**不新增字段**，沿用既有 `待投递` 与 `待投递 · 重试 {n}/2` | AC-32、AC-35、AC-62 |
| A-8（`:1066~1071`） | **退出码**：检查点写失败不改退出码；重建失败/超时升级沿用挂起 4；恢复失败只影响实例状态；不新增退出码 | AC-04、AC-43、AC-45 |
| A-9（`:1073~1075`） | **JSON 结构**：非恢复实例 11 顶层键与顺序；恢复实例追加 `recovery`（4 键）/`connections`（每项 4 键）共 13 键，追加在 `current` 之后 | AC-36、AC-52、AC-55 |
| A-10（`:1077~1079`） | **新原因码** `ROLE_SESSION_POLICY_INVALID` 文案 `会话复用策略不合法：{value}（可选 reuse / fresh）`，计入既有 `errors` 数组、不改 6 键结构 | AC-51 |

### 4.2 D-1~D-13 各指导哪个实现点

| 附录 | 指导哪个实现点 |
|---|---|
| D-1（`:1139~1155`） | **模块与文件边界**：逐文件职责/允许依赖/禁止；「不得改动」清单（`index.md`、需求模板、`src/templates/index.js` 字段、`assets/**` 字节、`state-machine.js` 7 项表与迁移边）→ 直接喂 S1 的 §2 文件级契约与 WP 归属 |
| D-2（`:1157~1204`） | **9 态 ↔ 7 项 + `phase` 投影**：`transit()` 的 `phase` 校验表、写盘同 CAS、`snapshotOf()` 只读、不新增自环迁移 → AC-01 / C-01 / C-02 / M-1 |
| D-3（`:1206~1238`） | **检查点格式与写点**：`checkpoint/v1` 完整 JSON 样例、原子写、写失败只发一次提醒（`checkpoint.write_failed`）、`loadCheckpoint` 返回 `{ok,checkpoint}`、`rev` 一致性 → AC-02~06 / M-2 / C-03~06 |
| D-4（`:1240~1281`） | **ACP 方言**：能力归一化、`resumeSession`/`loadSession`/`resumeOrCreate` 伪代码、调用方恢复后动作、每次回退写 `recovery.dialect` 事件、不按 `hostId` 分支 → AC-19~27 / M-3 / C-07~09 |
| D-5（`:1283~1311`） | **启动恢复 `reconcileOnBoot` / `recover()` 六步顺序**：选图、节点对账、会话对账、写恢复事件与 `recoveredAt`、从 `assigned`/`ready` 继续调度、致命错误 `interrupted` → AC-05/09~18/58 / M-4 / C-05/06/10/11 |
| D-6（`:1313~1322`） | **角色实例与连接线恢复**：`role_to_sessions` 派生、连接线优先级 `rejected>expired>pending>delivered>accepted>consumed>not_started`、`delivered→pending` 保留 `deliveryAttempts`、`created` 继续投递、重投 3 次失败 `expired`+升级 → AC-28~36/61/62/64/67 |
| D-7（`:1324~1330`） | **特殊节点恢复**：`human`/`escalate`/`failed`/`suspended`/`subworkflow` 各自保持规则 → AC-37~41 |
| D-8（`:1332~1343`） | **崩溃与运行慢**：判据、处置 4 步、慢阈值/SLOW_MS、`failed_reason: timeout` 新增落盘、`MAESTRO_TEST_GRAPH` 图注入口、`MAESTRO_MOCK_CRASH=twice` → AC-42~47/63 / C-12~14 |
| D-9（`:1345~1352`） | **授权断言修改清单（只有两行）**：见 §3.2 / §4.3；「除两行外 `test/**` 一个字符不许改」 |
| D-10（`:1354~1365`） | **测试与夹具约束**：新增用例放 `test/wp13/`（至少 7 文件清单）、纯函数不碰磁盘、`fs.mkdtemp` 在 `os.tmpdir()`、崩溃/慢/方言/hold 走 M-7 接缝、`cli-recovery.test.js` 直接 `import { main }`、真实宿主面单独放 `probe/`/`evidence/`、全量命令固定 `--test-concurrency=4`、回归断言用差集不写死 992 |
| D-11（`:1367~1393`） | **架构禁词扫描五条命令**（AC-54 的完整命令；31 词 / 30 词 / 三文件口径 / 零依赖 / 零 CJK）；`:1391` 说明为何 `labels.js`/`render.js`/`main.js` 不进第 3 条（当前 HEAD 实测 34 处命中、exit 1），且不得为让扫描变绿去改这些文件；不得出现宿主名分支 |
| D-12（`:1395~1406`） | **兼容性红线表**：三主链、`status`/`instance status`/`graph` 非恢复输出、`role show developer` 六行、`role list`/`validate` 计数（26/16/10）、`USAGE_LINES.length===25`、全量测试差集 0 且条数 ≥ 992、D-11 五条 exit 0 |
| D-13（`:1408~1418`） | **会话复用**：`session_policy` 加入 `ROLE_OPTIONAL_KEYS`/`ROLE_KEY_ORDER`/`ROLE_ALIASES`/`DERIVE_INHERIT_KEYS`/`EDITABLE_KEYS`（`PROTECTED_KEYS` 不含）；加载器不得把缺省 `fresh` 注入渲染对象；`fresh`/`reuse` 派发选择；恢复时方言链与回退行 → AC-48~51/65/66 / M-5 / C-15 |

### 4.3 三个特别标注

**(1) A-3 第 17 行「重新核对」（AC-14）**：A-3 短语表 `:1009~1026` 共 **17 行**，第 17 行是 `:1026` `重新核对：{节点号} · 证据重新校验（不重放会话）`。该逐字短语在需求中出现 4 处且完全一致：A-3 `:1026`、AC-14 Then `:495`、AC-14 夹具 `:496`、附录 C `:1133`。来源登记在 §1.3.3 `:127`（基线 §3.6 `:289`「`review` → `review`：等待核心重新校验」）+ BR-14 `:338` + D-5 `:1304`（「`review` 重新核对」伪代码口径）。S3 对 AC-14 取证必须逐字比对该行，不得用「重新校验」「重新核对证据」等变体。

**(2) AC-54 内嵌 D-11 五条命令逐字副本（裁-4）**：AC-54 的「架构检查」段 `:818~836` 内嵌 ` ```bash ` 块（17 行），与附录 D-11 `:1369~1387` 代码块（17 行）**逐字相同**（本次逐行比对：`$COMMON` = `task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 共 **31 词**；`$NOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')` 共 **30 词**；`coordinator` 出现 1 次；五条命令 = #1 引擎 31 词 / #2 `src/registry` 30 词 / #3 三文件 `roles.js,skills.js,workflows.js` / #4 零依赖输出 `0` / #5 零 CJK 输出 `OK: no CJK`）。裁-4（选项①）要求：§3.3#9 `:965` 与 D-11 **一字不改**、两份副本逐字相同、任何一侧修改都要同步；S3 用例须按 **AC-54 正文**取证，不得只引用 D-11。第 3 条按 I1.6 D-9 的**三文件口径**，不得收窄为单文件（裁-2）。

**(3) D-9 授权断言清单（实文逐字核对）**：
- `test/wp11/role-schema.test.js:57` → 实文 `  assert.deepEqual([...ROLE_OPTIONAL_KEYS], ['tools', 'wake_allow', 'inputs', 'outputs', 'dispatchable']);`（`:55` 用例标题「declares nine required role keys and five optional ones」）。授权改为末尾追加 `'session_policy'`。
- `test/wp4/orchestrator.test.js` → `:480` 用例标题「reconcileOnBoot：v2 旧 generation 的运行中实例 → interrupted；v1 保持原样」；`:575` `assert.deepEqual(result.interrupted, ['INST-009']);`；`:578` `assert.equal(loaded.state.state, 'interrupted');`；`:580` `assert.match(loaded.state.nodes[0].note, /stopped at node running/);`；`:584~586` `core.gone` 三行（`:584` `const gone = read.events.filter((e) => e.reason === 'core.gone');`、`:585` `assert.equal(gone.length >= 1, true);`、`:586` `assert.equal(gone[0].from, 'running');` / `to==='interrupted'`）；`:588~592` `legacyAfter`/`legacyBefore` + `assert.equal(legacyAfter, legacyBefore, 'v1 实例必须一字不改');` **保持原样**。D-9 现文写「同文件 v1 实例一字不改的后半段断言（`:588~592`）保持原样」（裁-5 把 `:588~590` 机械更正为 `:588~592`）。
- 除这两行外 `test/**` 一个字符不许改；新增断言放 `test/wp13/**`；`mock-acp-agent.js` 实现期扩展属夹具能力扩展，不改既有场景分支与既有断言（D-9 `:1352`）。

---

## 5. 未决问题与假设

### 5.1 附录 B 的 B-01~B-17 逐条

> 「是否阻塞开工」按需求 `:1105` 表列逐条如实登记；「已裁决依据」只对 **裁-1~裁-5** 实际覆盖的条目点名，其余写「裁-1~裁-5 未直接覆盖」并给出真实依据，不硬套。

| # | 问题 | 是否阻塞开工 | 已裁决依据（裁-1~裁-5） | 后续动作 |
|---|---|---|---|---|
| B-01 | I1.7 未合入，worktree / 产物隔离恢复语义未知；`artifactRefs` 指向 worktree 时重启可能失效 | 否（但**阻塞 I1.7 与本迭代最终联合验收**） | 裁-1~裁-5 未直接覆盖；依据 = 主控给定边界 + `index.md:696` 预判 C + R-9 / C-16 / BR-47 | 只原样保留 `artifactRefs`；I1.7 合入后重跑全部 AC，由 I1.7 复核；若改变 `artifactRefs` 语义，在 I1.7 报告追加交叉说明（见 §7.3） |
| B-02 | I1.6 曾把「资产版本锁定」顺延到 I1.8，但规划未列 | 否 | 裁-1~裁-5 未直接覆盖 | 只在检查点保存锁定图快照，不引入版本号；登记给后续迭代 |
| B-03 | I1.6 曾把「工作流权限匹配」顺延到 I1.8，但规划未列 | 否 | 裁-1~裁-5 未直接覆盖 | 不新增运行时权限检查；静态校验仍归 I1.6 |
| B-04 | `human` 节点运行时入口尚不存在（`orch run --workflow` 范围外） | 否（**阻塞 I1.10a 真实人工节点验收**） | 裁-1~裁-5 未直接覆盖；依据 = R-6 + §1.3 范围外第 3 项 | 用夹具预置状态验证恢复规则（AC-37 / AC-58）；真实人工节点运行留 I1.7 / I1.10a |
| B-05 | 第三方 `dsh-acp-server` 真实 load 面是否本机可装 | 否 | 裁-1~裁-5 未直接覆盖 | AC-27「真实可用则真验，否则阻塞」；load 语义由 AC-20 夹具兜底，不用夹具冒充真实面 |
| B-06 | 真实 DSH `session/resume` 成功但会话不继续吐事件 | 否（需在真实面报告确认） | 裁-1~裁-5 未直接覆盖；依据 = C-09 + BR-39/40 | 按「resume 不回放」处理：最后态 `thinking`/`tool_running` 只等待；若实际不继续，用户看到「运行慢」按 BR-39/40 处理；AC-25 记录实际行为 |
| B-07 | 检查点写失败是「告警继续」还是「停止推进」 | 否（**需评审裁决**） | 裁-1~裁-5 未直接覆盖；需求选「告警继续」（R-10） | 若评审改口径，需改 BR-06 与 AC-04；当前按 R-10 实现 |
| B-08 | 未声明 `timeout` 的内建模板，运行慢是否应有默认超时 | 否（**需评审裁决**） | 裁-1~裁-5 未直接覆盖；需求选「不擅自失败」（R-7） | 若评审要求默认超时，需新增默认值并改 AC-46 |
| B-09 | 角色字段名用 `session_policy` 还是 `session_reuse` | 否（**需评审裁决**） | 裁-1~裁-5 未直接覆盖；需求选 `session_policy`（与规划词一致） | 若改名需同步 M-5、AC-51、D-10/D-13 |
| B-10 | 待审批会话（`waiting_input`）恢复后如何处理 | 否（**阻塞 I1.11 审批恢复**） | 裁-3 部分相关（会话 `escalated` 沿用既有显示器、不新增会话态）；本条本身是**环境事实**，非业务规则 | 不恢复审批上下文，按会话不可恢复规则降级；审批队列留 I1.11；写在 §3.3#7，不再作为 BR（原 BR-49 已迁出） |
| B-11 | 节点 9 态用「位置投影」而非直接扩 `NODE_STATES` 是否满足规划「状态机完整」 | 否（**已裁决**） | **裁-1 定论**：§2.2 保留「状态机」语义、用户可见位置以基线 9 态为准、代码 7 项 + 投影在 D-2 写清映射、AC-01 锚点写真实 7 项 | 不再作为待裁决项；S1/S2 按 D-2 实现，不改 7 项表 |
| B-12 | `assigned` 显示「已分配」还是「执行中（已分配未开始）」 | 否（**需评审裁决**） | 裁-1~裁-5 未直接覆盖（裁-1 只定 9 态/7 项/锚点，未定显示词）；需求选「已分配」+「等待重新分配会话」 | 基线 `index.md:166` 把 `assigned` 归入 `running` 列「已分配未开始」子状态，两者语义一致；若改口径需同步 A-1 / AC-01 / AC-59 |
| B-13 | `orch status --instance` 恢复行只在 `recoveredAt` 时出现，是否应始终显示检查点 | 否（**需评审裁决**） | 裁-1~裁-5 未直接覆盖；需求选条件追加（R-12）以守住非恢复路径逐字不变 | 若评审要求始终显示，需改 A-2 与 AC-10 |
| B-14 | `subworkflow` 节点恢复是否应展开内部节点 | 否 | 裁-1~裁-5 未直接覆盖；依据 = §6 边界 #7 + 范围外第 3 项 | 不透明保留，展开留 I1.7 / I1.10a（AC-41 / BR-54） |
| B-15 | 真实宿主面若无法复制 `~/.dsh/.credentials.yaml`（权限/安全策略） | 否 | 裁-1~裁-5 未直接覆盖；依据 = BR-48 / NFR-08 | 判「阻塞」，报告写清尝试路径；不得把夹具结果标成真实面 |
| B-16 | 检查点文件路径定为 `instances/<id>/state/checkpoint.json` | 否 | 裁-1~裁-5 未直接覆盖；依据 = `index.md` §5.2 的 `state/` 目录写法 | 在实例目录下**新建 `state/` 子目录**（与 `state.json` 同级，非并列文件）；不改现有 `state.json` 位置（D-3 / M-2） |
| B-17 | `status.md` 写「执行中」而 CLI 写「已分配」——同一节点两处两种说法 | 否（**已裁决**） | 裁-1~裁-5 未直接点名本条；**按基线 `index.md:166` 裁决**（与裁-1 的 9 态口径同源） | `status.md` 看板列词「执行中」、CLI 精确位置「已分配」，属同一规则两种粒度；口径写进 A-1 `:992`，不改 `src/core/status-text.js` 词表 |

### 5.2 「观测不到」的项单列与处置口径（不判缺陷 / 不模糊）

| 观测项 | 试过的路径（本次实跑 / 实读） | 为什么观测不到 | 处置口径 |
|---|---|---|---|
| **真实 DSH 方言事实**（AC-25/26/27 的 `{close,list,resume}` 无 `load`、`loadSession:true`；AC-57 隔离） | `command -v dsh` → `NOT_FOUND`；`command -v dsh-acp-server` → `NOT_FOUND`；`~/.dsh` 存在但仅 `.anonymous-user-id` / `.credentials.yaml`(478B) / `profiles` / `sessions` / `storages`，本机仅桌面 exe 无 CLI；未尝试安装 | 本机无 DSH CLI 与第三方 server，无法真实复现宿主能力广告与恢复行为 | **判「阻塞」**（BR-48 `:372` / NFR-08 `:953` / AC-25 `:584`「无 DSH 判阻塞、不伪造通过」）；报告写清尝试路径；AC-27 的 load 语义由 AC-20 夹具兜底但不得冒充真实面；隔离 `DSH_HOME` 构造要求见 §2.4 |
| **M-7 新接缝 / D-10 新夹具** | Grep `MAESTRO_TEST_GRAPH\|MAESTRO_TEST_RECOVERY_HOLD\|MAESTRO_TEST_SLOW_MS\|MAESTRO_MOCK_\|checkpoint_write:fail\|after_assign\|after_handoff_created` 于 `src/` → **0 命中**；Glob `test/fixtures/recovery*` / `test/wp13/**` / `graph-timeout.json` / `human-node-state.json` → **0 文件**；`src/core/orchestrator.js:353~363` 实文只认 4 个既有 `MAESTRO_FAULT` 值；`acp-client.js:314~328` 现状只走 `newSession` | 这些是 M-7 `:153` / D-10 `:1354~1365` 登记的 **S2 实现期交付**，当前 main（`3f35bfa`）不含 | **实现期新增（待 S2 实现）**，不判缺陷；按需求 §3.3#3 与 D-10 口径，依赖它们的 AC 当前无法取证（清单见 §6.6），S2 交付后补证 |
| **9 态 `phase` 投影** | Grep `\bphase\b` 于 `src/core` → **0 命中**；D-2 `:1157~1204` 已给 9↔7 映射与 `transit()` 的 `phase` 校验表（纯设计，非代码） | 当前代码无 `phase` 参数实现；投影属 M-1 / C-01 / C-02 的 S2 交付 | **实现期新增 / 沿用 D-2 映射**；S2 实现后 AC-01/59/60 取证；不据当前 0 命中判需求缺陷 |
| **全量测试数字** | 本次**未**重跑 `node --test --test-concurrency=4 "test/**/*.test.js"`（会改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`，按硬约束规避）；只读核对 `git status --short` = `?? docs/iterations/iteration-8/` | 无本轮实跑数字；需求 v3 `:805/:964` 记 **992 条 / 988 通过 / 4 失败**（EPERM / C 盘盘符 / EBUSY 既有噪声），集成说明 §4 记 **992 / 987 / 5**（集成分支，并发时多 1 条 EBUSY） | **沿用基线**：门禁按 `index.md:711`「与 `origin/main` 失败集合差集 = 0」+「条数只增不减」，**不要求零失败、不写死通过数**（需求 `:964` 明写「条数与噪声随机器浮动」）；两份数字条数同为 992、通过/失败差 1 条属噪声浮动，如实登记差异（§7.2），不声称复核了全量数字 |

---

## 6. Given 可构造性核查（重点 · 67 条逐条）

### 6.1 全局构造口径与一条重要区分

- **独立项目根**：每条 AC 用 `%TEMP%/maestro-i18/<AC>`（§3.3#2 `:958`），**不放仓库内**；`NODE_ENV=test` 必须注入（两个 driver 的 `cleanEnv` 实文 `task-loop-driver.mjs:228` / `code-loop-driver.mjs:470` 均 `return { ...env, NODE_ENV: 'test', ...extra }`）；测试结束 `orch core stop` 并删除项目根。
- **强杀构造**：从 `<root>/.orch/core.json` 读 `pid`，`kill -9 <pid>`（Git Bash 用 `taskkill //F //PID <pid>`）；**不得**用 `orch core stop` 代替强杀（§3.3#4 `:960`，`core stop` 是显式中断、语义不同）。`src/daemon/lifecycle.js:23~47` 的 `ensureCore` 通过任意 `orch` 命令自动拉起；`:111~120` `readMetaPid` 从 `coreMetaPath` 读 pid（仅 `core stop` 超时提示用，不参与连接地址决策）。
- **同进程串行 > 10 个场景先 `forceKillCore`**；`driver --keep` 被强杀退出码可能是 13，退出码断言只对完整跑做（模板 §5#12）。
- **重要区分**：本节「可构造」指 **Given 现场**在当前 main 上能否用现有接缝/夹具造出来；**不等于该 AC 当下即可取证** —— 绝大多数恢复类 AC 的 Then 依赖 S2 才存在的产品行为（检查点读写、`resumeSession`/`loadSession`、`recoverInstance()`、`phase` 投影、`session_policy`、`failed_reason: timeout` 落盘、`recovery.*` 事件）。S2 之前的「Given 可构造」只是现场可预置，Then 取证统一在 S2 之后。§6.6 的「当前无法取证」特指 **Given 本身造不出来**（依赖 M-7/D-10 新接缝/新夹具）或 **真实宿主观测不到**两类，不把「产品行为尚未实现」重复计为逐条缺陷。

### 6.2 现有接缝实文（自己 Grep 核实，可直接用）

| 接缝 | 实文位置 | 现状取值 / 语义 |
|---|---|---|
| `MAESTRO_TEST_PAUSE` | `src/core/orchestrator.js:350`（`parsePauseSpec`）、白名单 `:3971`、触发点 `:1248` / `:2185` / `:2861` | 仅 `after_accepted` / `after_output` / `after_verdict` 三值；`:3971` `if (!['after_accepted','after_output','after_verdict'].includes(kind)) return null;` —— **`after_assign` / `after_handoff_created` 当前不被解析** |
| `MAESTRO_TEST_STOP_AFTER` | `orchestrator.js:351~352`；driver `code-loop-driver.mjs:715` / `task-loop-driver.mjs:381` | 步进停止，driver 以 `--stop-after` 传入 |
| `MAESTRO_FAULT` | `orchestrator.js:353~363` | 仅 4 值：`state_write:escalation`(`:354`)、`workspace_init:fail`(`:357`)、`inbox_write:fail`(`:360`, isTest)、`workspace_status_write:fail`(`:363`, isTest)；**无 `checkpoint_write:fail`** |
| `MAESTRO_TEST_DELIVERY_DELAY_MS` | `orchestrator.js:365~369` | isTest 下确定性重投延时（生产 200/500ms） |
| `test.escalate` / `test.handoff` / `test.delivery` / `test.delivery.whenHeld` / `test.dispatch` | `src/daemon/server.js:286~314` | `NODE_ENV=test` 下注册的 RPC 接缝；`test.handoff` 需 `['instanceId','nodeId','mutate']`、`test.delivery` 需 `['instanceId','action']` |
| `code-loop-driver.mjs` / `task-loop-driver.mjs` | `code-loop-driver.mjs:212` `retest-slow`、`:242` `backflow-hold`、`:275` `SCENARIOS`；`task-loop-driver.mjs:29` `TASK_SCENARIOS_DIR` | `--root <绝对路径> --scenario <名>`；`NODE_ENV=test` 由 `cleanEnv` 注入；**无 `--kill-after` 参数**（Grep 0 命中） |
| `mock-acp-agent.js` 现有开关 | `:112` `--prompt-failures`、`:161` `--hold-session`、`:178` 用法行、`:569/:881/:960` `shouldFailPrompt` | 命令行参数（非 `MAESTRO_MOCK_*` 环境变量）；D-10 `:1360` 要求 M-7 的新 `MAESTRO_MOCK_*` 由 driver 读环境后转成**同一组参数**、不改既有参数语义 |
| `purity-check.mjs` | `:27` `DEFAULT_FORBID = ['code-loop','developer','tester','coordinator']`（仅 4 词）、`:80` `--files` 优先于 `--dirs`、`:83` `--forbid` | **必须显式 `--forbid` 传全表**（D-11 31 词）；支持 `--files` 三文件口径 |
| 既有 CLI / 持久化 | `src/daemon/lifecycle.js`（`isAlive`/`ensureCore`/`stopCore`）、`src/persistence/instance-store.js:113~115`（`markCorrupt` / `state.json.corrupt`）、`orch status --instance` / `instance log` / `instance graph` / `role show` / `handoff list` | 非法 JSON → 「状态不可读 + `.corrupt` 备份」是既有能力（AC-06 可直接构造）；`orch core stop` 是显式中断（AC-16） |

### 6.3 M-7 / D-10 登记的「实现期新增」接缝（**待 S2 实现**）

以下全部在 `src/` Grep 命中 **0**、新夹具 Glob **0**，是 M-7 `:153` / §3.3#3 `:959` / D-10 `:1354~1365` 登记的 S2 交付，**当前无法取证，不判缺陷**：

- **新增/扩展接缝**：`MAESTRO_TEST_PAUSE=after_assign[:<节点>]`、`MAESTRO_TEST_PAUSE=after_handoff_created[:<包号>]`、`MAESTRO_FAULT=checkpoint_write:fail`、`MAESTRO_TEST_SLOW_MS`、`MAESTRO_TEST_RECOVERY_HOLD=after_assign`、`MAESTRO_TEST_GRAPH=<绝对路径>`（仅测试的图注入口，给节点声明 `timeout`）。
- **mock agent 新增环境开关**：`MAESTRO_MOCK_CAPS=resume/load/both/none`、`MAESTRO_MOCK_RESUME=ok/fail`、`MAESTRO_MOCK_LOAD=ok/fail`、`MAESTRO_MOCK_NEW_FAIL=1`、`MAESTRO_MOCK_CRASH=after_first_update/twice`、`MAESTRO_MOCK_SLOW=1`、`MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1`、`MAESTRO_MOCK_PROMPT_FAILURES=<n>`、`MAESTRO_MOCK_PROMPT_LOG=<路径>`。
- **新夹具/新文件**：`test/fixtures/recovery-driver.mjs`（含 `checkpoint-advance` / `dialect-resume` / `redeliver` / `e2e` 场景）、`test/fixtures/recovery/human-node-state.json`、`test/fixtures/recovery/graph-timeout.json`、`test/wp13/**`（至少 7 个测试文件）。
- **新产品落盘/事件**（S2 才存在，Given 造不出）：`instances/<id>/state/checkpoint.json`、`failed_reason: timeout` 字段、`recovery.summary` / `recovery.dialect` / `recovery.role` / `recovery.human` / `session.crash` / `session.slow` 事件、`recoveredAt` / `coreGeneration`。

### 6.4 67 条 AC 逐条盘点（夹具面 / 机检面 / 架构检查面 / 边界面 / 混合面；真实宿主面 AC-25/26/27 在 §6.5 单独展开）

> 本表共 **67 行**，逐条对应 AC-01~67：其中 **64 行有实质构造内容**（夹具面与真实宿主面**分开写**——AC-25/26/27 三行为指向 §6.5 的占位行，AC-57 为真实宿主配套守卫、在 §6.5 一并取证），满足「夹具面与真实宿主面分开写」。
> 「根/环境」列统一 `%TEMP%/maestro-i18/AC-XX` + `NODE_ENV=test`（每条独立，跑完删除）。「接缝」列：`[现]` = §6.2 现有实文；`[待S2]` = §6.3 实现期新增。「取证」列：`可构造`（Given 现场现有手段可造）/ `待S2`（Given 依赖新接缝/新夹具，当前无法取证，不判缺陷）/ `阻塞`（真实宿主观测不到）。

| AC | 根 / 环境 | 接缝（现 / 待S2） | 具体步骤 | 夹具 / 故障注入 | 取证 |
|---|---|---|---|---|---|
| AC-01 | AC-01 / test | `[现]` `PAUSE=after_output:reviewer`；`[待S2]` `RECOVERY_HOLD=after_assign` | 任务闭环跑到「研究撰写已完成、审核待校验」停住 → 恢复后节点停在「已分配」 → `instance graph` / `status --instance` | 新单测逐一覆盖 9 位置投影 | 待S2 |
| AC-02 | AC-02 / test | `[待S2]` `recovery-driver.mjs`(不存在) + `checkpoint.json`(不存在) | 编码闭环跑到测试节点核对通过 → 读检查点 → 强杀 → 重启 → 看恢复行 | 每次进展后读 `state/checkpoint.json`，断言 `checkpointId` 单调、`rev` 一致 | 待S2 |
| AC-03 | AC-03 / test | `[现]` `retest-slow` + `kill -9`；`[待S2]` `checkpoint.json` | 回流复测（开发 done/2、测试 running/2）强杀 → 重启 → `instance log` | 读检查点断言含 `instanceId/rev/checkpointId/graph/nodes/sessions/handoffs/paused/halted`，不含提示词/输出/凭据 | 待S2 |
| AC-04 | AC-04 / test | `[待S2]` `FAULT=checkpoint_write:fail` | 注入 → 发起编码闭环跑到首节点完成 → 看 `orch run` 输出与退出码 | 日志提醒 ≥1 且每次运行最多 1 次；`state.json` 仍有最新进展 | 待S2 |
| AC-05 | AC-05 / test | `[现]` `retest-slow` + `kill -9` + 手工删文件；`[待S2]` `checkpoint.json`（需先存在才可删） | 跑到第二轮 → 删 `state/checkpoint.json` → 强杀 → 重启 → `status --instance` | 断言已完成节点 `session/prompt` 0 次、当前轮允许 1 次重发 | 待S2 |
| AC-06 | AC-06 / test | `[现]` 写非法 `state.json` + 既有 `markCorrupt`/`.corrupt`；`[待S2]` 检查点存在 | 把实例记录写成非法 JSON、检查点存在 → `orch status` | 断言原字节不变、`.corrupt` 存在、前后 `sha256` 相同 | 待S2 |
| AC-07 | AC-07 / test | `[现]` `retest-slow` + `kill -9` + `orch status` | 第二轮回流强杀 → 重启 → `instance graph` / `status --instance` | `--format json` 断言 `round===2`、`maxRounds===3` | 可构造 |
| AC-08 | AC-08 / test | `[现]` `retest-slow`；`[待S2]` `MAESTRO_MOCK_PROMPT_LOG` | 复测窗口强杀 → 重启跑到结束 → 读 prompt log | `delayMs=30000`；已完成开发节点提示 0 次、`node.dispatch` 不含该节点 | 待S2 |
| AC-09 | AC-09 / test | `[现]` `retest-slow` + `kill -9`/`taskkill` + `orch status` | 等 `T-001 done`/`T-002 running`(round=2) → 杀 `.orch/core.json` 的 pid → `status` 拉起 | 断言恢复行、`skipped===1`、已完成节点提示 0 次 | 可构造 |
| AC-10 | AC-10 / test | `[现]` 承接 AC-09 | AC-09 恢复完成后 `status --instance` | 恢复行只出现 1 次；`graph --format text` 顶部同样一行；非恢复实例不出现 | 可构造 |
| AC-11 | AC-11 / test | `[现]` 预置 `suspended` 实例（`test.escalate` 轮次超限） | 重启 → `status --instance` | 重启前后 `graph --format json` 的 `state` 与节点逐项相同；无新增 `node.dispatch`/`verification.*` | 可构造 |
| AC-12 | AC-12 / test | `[现]` `test.escalate` 造 `escalated` + `suspended` | 重启 → `status --instance` | `escalations` 中 `pending` 数不变；`node.dispatch` 不变 | 可构造 |
| AC-13 | AC-13 / test | `[现]` mock `--prompt-failures` / verdict 造 `failed_reason: verdict_fail` | 重启 → `status --instance` | 节点 `state==='failed'`；无新 `node.dispatch` | 可构造 |
| AC-14 | AC-14 / test | `[现]` `PAUSE=after_output:reviewer`；`[待S2]` `MAESTRO_MOCK_PROMPT_LOG` | 任务闭环停审核 `review`、证据存在 → 强杀 → 重启 | mock prompt log 中审核节点提示 0 次；`instance log` 含逐字短语 `重新核对：{节点号} · 证据重新校验（不重放会话）`（A-3 第 17 行） | 待S2 |
| AC-15 | AC-15 / test | `[现]` 预置旧格式实例（写 `state.json`，模板名不在内建三图） | 重启 → `status` | 实例记录 `sha256` 不变；无新增 `node.dispatch`；状态 `interrupted` | 可构造 |
| AC-16 | AC-16 / test | `[现]` `orch core stop` + `orch status` | 运行中 `core stop` → 再次 `status` | `core stop` 后 `interrupted`；`status` 拉起后仍 `interrupted`；无恢复摘要 | 可构造 |
| AC-17 | AC-17 / test | `[待S2]` `MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1` | 有检查点、恢复时宿主不可达 → 重启 | 断言 `interrupted` 且日志含 `恢复失败` | 待S2 |
| AC-18 | AC-18 / test | `[待S2]` 连续 `--kill-after`（driver 当前无此参数，Grep 0 命中）+ `recovery.summary` 事件 | AC-09 恢复后再强杀一次并重启 | 统计 `recovery.summary` 事件 = 1（同一实例同一代）；已完成节点提示仍 0 | 待S2 |
| AC-19 | AC-19 / test | `[待S2]` `MAESTRO_MOCK_CAPS=resume` + `recovery-driver --scenario dialect-resume` | mock 广告 `{close,list,resume}` 无 load → 第二轮强杀 → 重启 | mock 调用序列：`session/resume` 1 次、`session/load` 0 次 | 待S2 |
| AC-20 | AC-20 / test | `[待S2]` `MAESTRO_MOCK_CAPS=load` | 广告 `loadSession:true`、最后态 `thinking` → 重启 | `session/load` 1、`session/resume` 0、`session/prompt` 0 | 待S2 |
| AC-21 | AC-21 / test | `[待S2]` `MAESTRO_MOCK_CAPS=none` | 不广告 resume/load、最后态 `idle` → 重启 | `session/new` 1、`session/prompt` 1、已完成节点 0 | 待S2 |
| AC-22 | AC-22 / test | `[待S2]` `MAESTRO_MOCK_CAPS=both` + `MAESTRO_MOCK_RESUME=fail` | resume 返回宿主错误 → 重启 | 调用顺序 `resume→load`、`new` 0；日志两行逐字（A-3 #4/#2） | 待S2 |
| AC-23 | AC-23 / test | `[待S2]` `CAPS=both` + `RESUME=fail` + `LOAD=fail` + `NEW_FAIL=1` | running/busy/delivered 现场 → 三方言全失败 | 节点/角色/交接三者状态 + 降级行；`session/new` 失败后无新会话 | 待S2 |
| AC-24 | AC-24 / test | `[待S2]` `MAESTRO_MOCK_CAPS=resume` | 回流复测现场、会话可 resume → 重启继续 | prompt log 中已完成节点 0、当前节点 ≤1 | 待S2 |
| AC-25 | 真实宿主面（§6.5） | `[现]` 探针 + 隔离 `DSH_HOME` | 见 §6.5 | 见 §2.4 | 阻塞 |
| AC-26 | 真实宿主面（§6.5） | `[现]` 隔离环境 + `kill -9` | 见 §6.5 | `workspace/artifacts/**` 产物 mtime 不变 | 阻塞 |
| AC-27 | 真实宿主面（§6.5） | `[现]` 第三方 `dsh-acp-server` 或阻塞 | 见 §6.5 | 真实可用则 `session/load`；否则判阻塞（AC-20 夹具仅兜底语义） | 阻塞 |
| AC-28 | AC-28 / test | `[待S2]` `RECOVERY_HOLD=after_assign` + `MAESTRO_MOCK_CAPS=none` | 开发角色 busy 会话不可恢复、`after_assign` 暂停 → 重启 → `role show developer --instance` | hold 点读 `role show`；日志 `恢复：角色 开发 · 服务中 → 可用（会话不可恢复）` | 待S2 |
| AC-29 | AC-29 / test | `[待S2]` `MAESTRO_MOCK_CAPS=resume` + `RECOVERY_HOLD=after_assign` | busy 可 resume → 重启 → `role show` | `服务中 · 活跃会话 1/1`；不出现「服务中 → 可用」 | 待S2 |
| AC-30 | AC-30 / test | `[现]` 预置三角色 `available`/`cooldown`/`inactive` | 重启 | `role list --instance` 三行状态词逐字不变；`role_to_sessions` 不变 | 可构造 |
| AC-31 | AC-31 / test | `[待S2]` 承接 AC-28 的 `RECOVERY_HOLD` 释放（`.mock/release` 或 `test.handoff`） | 释放 hold 让恢复继续派发 | 节点 `已分配→执行中`；`role show` 回 `服务中 · 活跃会话 1/1` | 待S2 |
| AC-32 | AC-32 / test | `[现]` `PAUSE=after_accepted:developer` 之前强杀 | `delivered` 未 accepted 时强杀 → 重启 → `handoff list --instance` | handoff `state==='pending'`、`deliveryAttempts>=1` | 可构造 |
| AC-33 | AC-33 / test | `[现]` 预置 `accepted` 未 `consumed` 交接包 | 强杀 → 重启 | `handoff.state==='accepted'`；`deliveryAttempts` 不变；无 `handoff.pending` | 可构造 |
| AC-34 | AC-34 / test | `[现]` 预置 `consumed`/`rejected`/`expired` 三张包 | 重启 | `handoff list` 三行状态词逐字节相同 | 可构造 |
| AC-35 | AC-35 / test | `[待S2]` `recovery-driver --scenario redeliver` | AC-32 的 `pending` 包、目标会话可用 → 完成重投 | 状态序列 `pending→delivered→accepted` | 待S2 |
| AC-36 | AC-36 / test | `[现]` 承接 AC-32 恢复实例 | `instance graph <实例>` | `--format json` 恢复实例含 `recovery`/`connections`、非恢复不含；`connections[].aggregate` 与文本一致 | 可构造 |
| AC-37 | AC-37 / test | `[待S2]` `test/fixtures/recovery/human-node-state.json`（不存在） | 预置 `human` 节点 `running`、强杀 → 重启 → `instance status` / `graph` | `nodeType==='human'`、`state==='running'`、无 `node.dispatch` | 待S2 |
| AC-38 | AC-38 / test | `[现]` 预置 `escalate` 节点 `escalated`（写 `state.json`） | 重启 | `state==='escalated'`；`escalations` 计数不变 | 可构造 |
| AC-39 | AC-39 / test | `[现]` 预置 `failed` 节点（code-loop） | 重启 | `state==='failed'`；`node.dispatch` 不变 | 可构造 |
| AC-40 | AC-40 / test | `[现]` 预置 `suspended` 实例（节点 running/review/escalated） | 重启 | 重启前后 `graph --format json` 的 `nodes` 数组逐项相同 | 可构造 |
| AC-41 | AC-41 / test | `[现]` 预置 `subworkflow` 节点 `running` | 重启 | 节点数不变；无内部节点 id 的新事件 | 可构造 |
| AC-42 | AC-42 / test | `[待S2]` `MAESTRO_MOCK_CRASH=after_first_update` | 开发节点执行中、会话首个事件后退出 → 看 `run` / `instance log` | 新会话 id 与旧不同、`round===2`、`session/prompt` 当前轮 2 次 | 待S2 |
| AC-43 | AC-43 / test | `[待S2]` `CRASH=after_first_update` + `NEW_FAIL=1` | 会话退出且重建 `new` 失败 → 看 `orch run` | 退出码 4；`status --instance` 显示「已挂起」 | 待S2 |
| AC-44 | AC-44 / test | `[待S2]` `MAESTRO_MOCK_SLOW=1` + `MAESTRO_TEST_SLOW_MS=100` | 会话存活但超慢阈值无事件 → 看 `run` / `instance log` | 慢行匹配 `已等待 \d+m`（`{N}` 允许 0）；`session/new` 次数不变 | 待S2 |
| AC-45 | AC-45 / test | `[待S2]` `MAESTRO_TEST_GRAPH=<graph-timeout.json>` + `MOCK_SLOW=1` + `SLOW_MS=100` + 新夹具 `graph-timeout.json` | 注入给审核节点声明 `timeout:2` 的图、会话慢存活 → 等超时 | `failed_reason==='timeout'`、节点 `escalated`、`escalations` +1、`session/new` 不变 | 待S2 |
| AC-46 | AC-46 / test | `[待S2]` `MAESTRO_MOCK_SLOW=1`（慢接缝）+ 内建三图之一 | 节点无 `timeout`、会话慢存活 → 等超慢阈值 | `instance graph` 节点仍 `running`；`failed_reason` 不存在；`session/new` 不变 | 待S2 |
| AC-47 | AC-47 / test | `[待S2]` 一次 `MOCK_CRASH` 场景 + 一次 `MOCK_SLOW` 场景 | 比较两次 `orch run` 输出 | 崩溃输出不含「判定为运行慢」；慢输出不含「正在重建会话」；各自关键短语计数 1 | 待S2 |
| AC-48 | AC-48 / test | `[现]` `code-loop` 场景（默认无 `session_policy`） | 第一轮开发完成、测试回流到开发第二轮 | 两轮开发会话 id 不同；`role show developer` 与 I1.6 基线逐字节相同 | 可构造 |
| AC-49 | AC-49 / test | `[现]` 项目根 `.orch/roles/developer.yaml` 覆盖内置资产（写 `session_policy: reuse`） | 第一轮完成、回流第二轮 | 两轮会话 id 相同、`session/new` 只 1 次；日志 `会话 复用 sess-003（角色 developer）` | 可构造 |
| AC-50 | AC-50 / test | `[现]` 同一项目根下两个实例 | 两实例各跑一次开发节点 | 会话 id 交集为空 | 可构造 |
| AC-51 | AC-51 / test | `[现]` 角色文件写 `reuse` / `always` + `role show` / `role validate` | 合法角色与非法角色各一份 | `role show` 行位置（可唤醒后、来源前）；`role validate --format json` 的 `errors` 含 `ROLE_SESSION_POLICY_INVALID` | 可构造 |
| AC-52 | AC-52 / test | `[现]` 三链 driver + `origin/main` 干净工作树 | 分别跑 `single`/`code-loop`/`task-loop` 并与 `origin/main` 输出比较 | 归一化后 diff 空；`instance graph`/`status`/`role show` 既有断言全绿 | 可构造 |
| AC-53 | AC-53 / test | `[现]` `node --test --test-concurrency=4 "test/**/*.test.js"` | 实跑全量、记录两侧失败用例名集合做差 | 条数只增不减；差集 = 0；不要求固定通过数（见 §7.2） | 可构造 |
| AC-54 | AC-54 / test | `[现]` `purity-check.mjs` 显式 `--forbid` 全 31 词 + `--files` 三文件 | 逐字执行 D-11 五条命令（AC-54 `:818~836` 内嵌副本） | 五条 exit 0；#4 输出 `0`；#5 输出 `OK: no CJK` | 可构造 |
| AC-55 | AC-55 / test | `[现]` `orch --help` / `orch recover` / `orch help` | 检查命令树与用法块 | `USAGE_LINES.length===25`；`COMMANDS` 不含 `recover`；`orch recover` 退出码 2；前 8 行逐字 | 可构造 |
| AC-56 | AC-56 / test | `[现]` shell 锚点（本次实跑 4 项全真） | `test ! -e src/core/worktree.js`；`grep -R "worktree" src/ \| wc -l`；`grep -R -E "artifact_type.*dir\|merge.*order"`；`test ! -e docs/iterations/iteration-7/requirement.md` | 输出 `NOT_EXIST/0/0/NOT_EXIST`；报告登记「I1.7 合入后重跑」 | 可构造 |
| AC-57 | AC-57 / test（真实宿主配套） | `[现]` `stat -c %Y ~/.dsh` + `git status --porcelain` | 执行 AC-25/26 前后准备与清理隔离目录 | `~/.dsh` mtime 前后相同；隔离目录删除后不存在；仓库内无新增项目根 | 阻塞* |
| AC-58 | AC-58 / test | `[待S2]` `recovery-driver --scenario e2e` + 人工节点夹具（不存在） | 回流复测现场 + 夹具预置人工节点 → 复测中途强杀 → 重启、看状态、释放 hold、继续 | 断言恢复摘要/节点轮次/角色状态/交接状态/人工节点状态五组 | 待S2 |
| AC-59 | AC-59 / test | `[待S2]` `MAESTRO_TEST_RECOVERY_HOLD=after_assign` | 节点「已分配」停在派发点 → 强杀 → 重启 → `instance graph` | 重启后 `state='running'`/`phase='assigned'`，释放后 `phase='running'`；`node.dispatch` 只 +1 | 待S2 |
| AC-60 | AC-60 / test | `[现]` 预置「依赖未满足」+「可调度」两类待执行节点 | 强杀 → 重启 | `nodes[].phase` 与 `edges` 逐项相同；只有可调度节点 `node.dispatch` 增加 | 可构造 |
| AC-61 | AC-61 / test | `[待S2]` `MAESTRO_TEST_PAUSE=after_handoff_created`（扩展值） | `created` 未投递窗口强杀 → 重启 → `handoff list --instance` | `handoffId` 不变、`deliveryAttempts` 不重置、无第二张同方向包 | 待S2 |
| AC-62 | AC-62 / test | `[待S2]` `MAESTRO_MOCK_PROMPT_FAILURES=3`；`[现]` `MAESTRO_TEST_DELIVERY_DELAY_MS=10` | 恢复回 `pending` 的包、目标连续 3 次拒绝投递 | `handoff.state==='expired'`、`deliveryAttempts===3`、`escalations` +1 | 待S2 |
| AC-63 | AC-63 / test | `[待S2]` `MAESTRO_MOCK_CRASH=twice` | 已崩溃重建成功一次、重建后会话再崩溃 | `session/new` 比单次崩溃少 1、节点 `escalated`、退出码 4 | 待S2 |
| AC-64 | AC-64 / test | `[待S2]` `CRASH=after_first_update` + `NEW_FAIL=1` + `CAPS=resume` | 重建失败看 `role show` → 重启让重建成功 | 角色状态词序列 `不可用 → 可用 → 服务中` | 待S2 |
| AC-65 | AC-65 / test | `[现]` 角色文件 `session_policy: reuse` + 两节点同角色并发 | 新节点派发 | `session/new` +1；「会话 复用」行 0 次 | 可构造 |
| AC-66 | AC-66 / test | `[现]` 一个实例里两个 `reuse` 角色/两种宿主 | 新节点派发 | 被复用会话 `hostId` 与新会话一致；`servingNodeId` 为空才选中；复用行无跨宿主角色 | 可构造 |
| AC-67 | AC-67 / test | `[待S2]` `MAESTRO_MOCK_CAPS=none` + `RECOVERY_HOLD=after_assign` | 角色会话不可恢复、服务节点终态/不可调度 → 重启 → `role show` | `role_to_sessions` 无该角色条目；`session/new` 次数不变 | 待S2 |

> `*` AC-57 的场景类型是「架构检查」、锚点也是架构检查（分面归架构检查面），但其 Given 是「执行真实 DSH 面的 AC-25/26」，随真实宿主面一并取证；`stat`/`git status` 断言本身可单跑，作为真实宿主面配套取证在 AC-25/26 阻塞时一并列「阻塞/待补证」，不单独伪造成通过。

### 6.5 真实宿主面（单独写，不混入夹具面）

| AC | 隔离 `DSH_HOME` 构造 | 具体步骤 | 夹具/故障注入 | 取证 |
|---|---|---|---|---|
| AC-25 | `%TEMP%` 新建 `DSH_HOME` + 复制 `~/.dsh/.credentials.yaml`；项目根 `%TEMP%`；用完删除 | 探针确认宿主只广告 `{close,list,resume}` 无 `load` → 编码闭环跑到第二轮 → 强杀 daemon → 重启 → `instance log` | 无（真实面，不用 mock）；`initialize` 返回的 `sessionCapabilities` 键集机检 | 阻塞（本机 `dsh` NOT_FOUND） |
| AC-26 | 承接 AC-25 隔离环境 | 第一轮已完成、第二轮强杀 → 重启等恢复 → 看 `instance log` 恢复摘要 + `workspace/artifacts/**` 产物 mtime | 无；`workspace/status.md` 可能被刷新、不在断言范围 | 阻塞（同上） |
| AC-27 | 本机安装 `dsh-acp-server` 0.14.4 或无法安装 | 用它跑编码闭环、第二轮强杀 → 重启 → `instance log` | 真实可用看 `session/load（回放）` 无 `session/resume`；装不上判「阻塞」并写尝试路径；AC-20 夹具仅兜底 load **语义**、不冒充真实面 | 阻塞（`dsh-acp-server` NOT_FOUND） |
| AC-57 | `%TEMP%` 隔离目录 + 不动 `~/.dsh` | AC-25/26 前后 `stat -c %Y ~/.dsh`、隔离目录删除检查、`git status --porcelain` | 无 | 随 AC-25/26 阻塞（配套守卫） |

**真实面观测不到的试过路径与原因**（本次实跑，见 §5.2）：`command -v dsh` → `NOT_FOUND`；`command -v dsh-acp-server` → `NOT_FOUND`；`~/.dsh` 仅有 `.credentials.yaml`(478B) / `profiles` / `sessions` / `storages` / `.anonymous-user-id`，本机仅桌面 exe 无 CLI；未尝试安装（分派结论 `index.md:703` 要求真实面留本机）。按 BR-48 / NFR-08 **判「阻塞」，不伪造通过**；「阻塞不算失败，伪通过才是」（模板 §3.4）。

### 6.6 当前无法取证的 AC 号与原因汇总

**A 组 · 待 S2 实现（Given 依赖 M-7/D-10 新增接缝 / 新夹具 / 新产品文件，当前 `src/` Grep 命中 0、新夹具 Glob 0，不判缺陷）—— 34 条**：
AC-01、AC-02、AC-03、AC-04、AC-05、AC-06、AC-08、AC-14、AC-17、AC-18、AC-19、AC-20、AC-21、AC-22、AC-23、AC-24、AC-28、AC-29、AC-31、AC-35、AC-37、AC-42、AC-43、AC-44、AC-45、AC-46、AC-47、AC-58、AC-59、AC-61、AC-62、AC-63、AC-64、AC-67。

- 归因：`MAESTRO_TEST_RECOVERY_HOLD`（01/28/29/31/59/67）、`MAESTRO_MOCK_PROMPT_LOG`（08/14）、`recovery-driver.mjs`（02/35/58）、`checkpoint.json`（02/03/05/06）、`FAULT=checkpoint_write:fail`（04）、`MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER`（17）、连续 `--kill-after` + `recovery.summary`（18，driver 当前无该参数）、`MAESTRO_MOCK_CAPS/RESUME/LOAD/NEW_FAIL`（19~24/28/29/64/67）、`human-node-state.json`（37）、`MAESTRO_MOCK_CRASH/NEW_FAIL/SLOW/PROMPT_FAILURES`（42/43/47/62/63/64）、`MAESTRO_TEST_SLOW_MS`/`MAESTRO_MOCK_SLOW`（44/46/47）、`MAESTRO_TEST_GRAPH` + `graph-timeout.json`（45）、`PAUSE=after_handoff_created`（61）。
- 处置：**实现期新增（待 S2 实现）**，按 §3.3#3、M-7 `:153`、D-10 `:1354~1365` 登记；S2 交付接缝与夹具后逐条补证，不据此判需求缺陷、不改 Then。

**B 组 · 真实宿主观测不到（判「阻塞」）—— 4 条**：AC-25、AC-26、AC-27、AC-57（配套守卫）。原因与试过路径见 §6.5 / §5.2；按 BR-48 / NFR-08 处理，交回本机补证，不用夹具结果冒充。

**合计当前无法取证 38 条**（34 待 S2 + 4 阻塞）；其余 **29 条** Given 现场现有手段可构造（AC-07、09、10、11、12、13、15、16、30、32、33、34、36、38、39、40、41、48、49、50、51、52、53、54、55、56、60、65、66），但其 Then 取证仍统一在 S2 产品行为落地之后（§6.1 的区分）。29 + 34 + 4 = 67。

---

## 7. 与上一迭代的契约差异与回归红线清单

### 7.1 相对 I1.6 定稿与集成版 main 的差异

**I1.6 定稿基线**（`iteration-6/report.md` §6 `:167~171`、§5 `:156~165`）：需求 v7（65 AC）→ 8 WP → 65/65 AC、769/769 测试；`purity-check.mjs` / mock ACP agent / 三链 driver 零改动复用；I1.5 的 26 资产、`loadRegistry`、既有渲染函数签名逐字保持；用法块 25 行；三条主链以 `0cd113b` 基线逐字回归；`orch run` 不接工作流（AC-47 / R-3，运行时留 I1.7+）。**遗留观察项（§5）**：R-8~R-14 需求侧披露、O-1 空字符串序列化、O-2 `role validate` 计数头、O-3 `workflow create --from` 丢弃节点级 `wake_allow`、O-4 `role diff --against` 与 D-2 同根因、R-3 范围边界 —— 均「不影响结论」，其中 O-3 / R-3 建议 I1.7+ 处理，本迭代仍不接 `orch run --workflow`（§1.3 范围外第 2 项），不构成 I1.8 的回归面变化。

**集成版 main**（`integration-2026-11-09.md`，HEAD `d4b0f94`）：以 `origin/main`(I1.4) 为第一父一次性合入 I1.6；`src/cli/main.js` 双 `workflow` 分流、`render.js` 统一用 `labels.js` 的 25 行 `USAGE_LINES`；全量门禁 **992 条 / 987 通过 / 5 失败**，`origin/main` 对照 641/637/4，**失败集合差集 = 0**；D-9 词表已扩到 **31 词**。遗留：O-I1（25 行用法块不含 I1.4 的 `instance/attach/escalate/approve/handoff/workflow pause` 用法行，为保 AC-43 逐字基线暂不追加）、**O-I2（三主链逐字回归基线未重跑**：I1.4 改写了 `render.js`，集成后 `single/code-loop/task-loop` 相对 I1.5 `0cd113b` 基线预期有变化；I1.6 AC-49 逐字断言不能直接套到集成版；建议 I1.7 起以集成版重建逐字基线）、O-I3（`workflow` 双语义长期应统一）、O-I4（I1.4 台账更正）。

**I1.8 相对上述两者的契约差异（新增/变更，全部来自 M-1~M-8 / C-01~C-18）**：
1. 新增 `instances/<id>/state/checkpoint.json`（`state/` 子目录）与 `src/core/checkpoint.js`（M-2、D-3）；
2. `acp-client.js` 从「永远 new」变为 `resume→load→new` 回退链（M-3、D-4）—— 与现状实文 `:314~328` 直接冲突；
3. `reconcileOnBoot` 从「running/created 一律 interrupted」变为「有检查点/内建模板 → recoverInstance」（M-4、D-5）—— 直接打破 D-9 第二行既有断言；
4. 节点 9 态 `phase` 位置投影（M-1、D-2）：**不改** `NODE_STATES` 7 项与既有迁移边；
5. 角色新增 `session_policy`（M-5、D-13）—— 打破 D-9 第一行 5 键断言；
6. 新增恢复/检查点/崩溃/运行慢/复用文案与 `ROLE_SESSION_POLICY_INVALID`（M-6、A-1~A-10）；
7. `instance graph --format json` 恢复实例追加 `recovery`/`connections`（M-8、A-9），非恢复实例仍 11 键；
8. `failed_reason: timeout` 新增落盘（C-14 / D-8）、`recovery.*` / `session.crash` / `session.slow` 新事件（D-5/D-8）；
9. 新增 M-7 测试接缝与 `test/wp13/**`、`test/fixtures/recovery/**`（实现期新增，当前不存在）。

**保持不变（逐字红线）**：`NODE_STATES` 7 项与既有迁移边、`state.json` 格式/`rev`/CAS/损坏处理、`USAGE_LINES` 25 行与前 8 行、26 资产 / 16 角色 / 10 技能计数、既有 6 键结构、三条主链非恢复路径逐字、非恢复实例 11 键 JSON 顺序、31 词禁词扫描口径（三文件）、零依赖、`src/core`/`src/daemon` 不出现模板名/角色名字面量、中文唯一来源 `labels.js`。

**数字差异如实登记**：需求 v3 `:805/:964` 记基线 **992/988/4**；集成说明 §4 记 **992/987/5**。两者总条数同为 992，通过/失败差 1 条属 Windows 并发环境噪声（需求 `:964` 明写「条数与噪声随机器浮动」；集成说明 §4 说明集成分支并发时多 1 条 `EBUSY`）。**不声称复核了全量数字**，门禁口径统一为「失败集合差集 = 0 + 条数只增不减」，不写死通过数（§5.2）。

### 7.2 回归红线清单（逐条可判定）

| # | 红线 | 判定口径 | 来源 |
|---|---|---|---|
| 1 | **三主链逐字不变** | `single`/`code-loop`/`task-loop` 非恢复路径输出与基准逐字一致；无恢复行/检查点行/复用行；`instance graph`/`status`/`role show` 既有断言全绿（AC-52）| `index.md:711`、D-12、AC-52。**注意 O-I2**：基准是**集成版 main**（`d4b0f94`）而非 I1.6 的 `0cd113b`；I1.6 AC-49 逐字断言不能直接套用到集成版，S1/S3 须以集成版重建逐字基线，不能因「对不上旧基线」而放宽 |
| 2 | **31 词禁词扫描 exit 0** | `purity-check.mjs` 显式 `--forbid` 传全 31 词（`$COMMON`）；`DEFAULT_FORBID` 只有 4 词、必须显式传全；第 1 条 `--dirs src/core,src/daemon`、第 2 条 `--dirs src/registry` 用 30 词 `$NOCOORD`、第 3 条 `--files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js` **三文件口径不得收窄**（裁-2） | D-11、AC-54、BR-45、`index.md:711` |
| 3 | **零依赖** | `Object.keys(require('./package.json').dependencies ?? {}).length === 0`（D-11 #4 输出 `0`） | NFR-06、BR-45、AC-54 |
| 4 | **零 CJK（新增实现）** | D-11 #5 输出 `OK: no CJK`；中文唯一来源 `labels.js` 与 `assets/**`；`src/core`/`src/daemon` 不出现模板名/角色名字面量（含英文注释） | D-11 #5、模板 §5#10 / §7 红线 6 |
| 5 | **既有断言只按 D-9 授权改** | 仅 `test/wp11/role-schema.test.js:57` 与 `test/wp4/orchestrator.test.js:480/575/578/580/584~586` 两行可改；`:588~592`「v1 实例必须一字不改」保持原样；其余 `test/**` 一个字符不许改；新增断言放 `test/wp13/**` | D-9、裁-5、DoR-6 |
| 6 | **全量测试基线 992/988/4 与「失败集合差集 = 0」** | `node --test --test-concurrency=4 "test/**/*.test.js"`；按测试名取两侧失败用例集合做差 = 0；条数只增不减（下限断言 `tests >= 992`，不写死 `tests === 992`）；**不要求零失败**（4 条 EPERM / C 盘盘符 / `EBUSY` 既有噪声）；`test/wp10/perf.test.js` 全量并发偶发 p95 越线按模板 §5#22 单跑判噪声、不放宽预算 | `index.md:711`、AC-53、§3.3#8、D-10、集成说明 §4 |
| 7 | **`autocrlf` 行尾坑** | 本机 `core.autocrlf=true`，新 worktree 检出会把资产/夹具文本转成 CRLF，导致 `assets.test.js` 逐字节样本与 `instance-store.test.js` 的 `SHA256SUMS` 断言失败；**这是检出环境差异、不是合并缺陷**；提交内容一律 LF（与主工作区 / `origin/main` blob 一致）；比对前确认 LF 规范化 | 集成说明 §3#5、§4 |
| 8 | **其余全流程硬约束** | 状态迁移唯一入口 `transit()`（不得旁路 `store.save`）；`rev` 基于磁盘现值递增；事件先落盘再广播、`ts` 复用状态变更同一时刻、`seq` 单调；提示词给绝对路径；`stopReason` 不判成败；ACP 分帧 NDJSON；验收脚本不硬编码测试条数；`driver --keep` 强杀退出码可能是 13、退出码断言只对完整跑做；`orch core stop` 会把非终态对账成 `interrupted` | `execution-template.md` §5 全流程硬约束（需求 §1.4 抬头 `:143` 亦重申） |
| 9 | **不新增 CLI 命令** | `USAGE_LINES.length === 25`、`COMMANDS` 不含 `recover`、`orch recover` 退出码 2、`orch help` 前 8 行逐字（AC-55） | BR-46、D-12、A-8 |

### 7.3 I1.7 合入后的重跑要求

- BR-47 / C-16 / AC-56 / B-01 / §3.3#10：**I1.7 合入后必须重跑本迭代全部 67 条 AC**，并由 I1.7 的产物语义复核恢复规则；AC-56 架构检查段要求报告登记「I1.7 合入后重跑」。
- 复核重点：若 I1.7 改变 `artifactRefs` 语义（指向 worktree 路径），重启后可能失效（B-01），需在 I1.7 报告追加一条交叉说明；`subworkflow` 不透明保留（AC-41 / BR-54）与 `human` 运行时（B-04）需按 I1.7/I1.10a 的真实能力重判。
- 当前 main 不含 I1.7（AC-56 四锚点本次实跑全真），本迭代不依赖其能力（§1.3）；B-01 标「不阻塞本迭代、**阻塞 I1.7 与本迭代的最终联合验收**」—— 收口时不得带着该未决项宣布联合验收完成。

---

## 8. 给 S1 拆分的输入提示（只给维度与文件边界，不写正式工作包、不替 S1 做拆分决策）

> 以下仅为**建议的 WP 切分维度**与文件边界提示，供拆分/选型 Agent 参考；工作包编号、依赖 DAG、负责文件清单、验收口径与「AC → WP 满覆盖映射」由 S1 按 `execution-template.md` §1.3 / §1.4 自行产出。硬规则提醒：§1.4 规则 1「同一文件只能属于一个 WP，大文件（如 `orchestrator.js`）指定**唯一负责人**」、规则 3「按能力切，不按文件类型切」、规则 4「AC → WP 满覆盖」。

### 8.1 建议的 WP 切分维度（按能力域 / 文件边界）

| 维度 | 能力域 | 涉及文件（来自 D-1 `:1139~1155`） | 对应 AC 簇（提示，不是分配） |
|---|---|---|---|
| A | **检查点与持久化** | 新增 `src/core/checkpoint.js`、扩展 `src/persistence/paths.js`（`checkpointPath`）、`src/core/orchestrator.js` 写点 | AC-02~06、AC-10、AC-18、AC-52（D-3 / M-2 / C-03~06） |
| B | **恢复编排（启动对账）** | `src/core/orchestrator.js`（`reconcileOnBoot`/`recoverInstance`/节点对账/角色·连接线重算/崩溃慢处置/复用选择）、`src/daemon/server.js`（启动接线） | AC-05、AC-09~18、AC-28~36、AC-58~64、AC-67（D-5/D-6/D-7/D-8 / M-1/M-4） |
| C | **ACP 方言适配** | `src/adapter/acp-client.js`（`resumeSession`/`loadSession`/`resumeOrCreate` 回退链） | AC-19~27、AC-24（D-4 / M-3 / C-07~09） |
| D | **角色配置与注册表** | `src/registry/role-schema.js`、`src/registry/asset-write.js`、`src/cli/roles.js` | AC-48~51、AC-65、AC-66（D-13 / M-5 / A-5 / A-10） |
| E | **文案与渲染** | `src/cli/labels.js`、`src/cli/render.js`（含 `instance graph --format json` 追加键） | AC-01、AC-10、AC-36、AC-42~47、AC-55、A-1~A-10（M-6 / M-8） |
| F | **测试夹具与接缝** | `test/fixtures/mock-acp-agent.js`、两个 driver、新增 `test/fixtures/recovery/**` / `recovery-driver.mjs` / `test/wp13/**` | 全部夹具面 AC 的现场构造（M-7 / D-10） |
| G | **架构检查与回归** | 无产品文件（`purity-check.mjs` 只读复用）；D-9 授权的 `test/wp4/orchestrator.test.js`、`test/wp11/role-schema.test.js` 两行 | AC-52~57、AC-53、AC-54（D-9 / D-11 / D-12） |

### 8.2 契约先冻结点（§1.3 §6 / §1.4 规则 2 建议先定死的字段与返回结构）

1. `checkpoint/v1` 的完整字段形状（D-3 `:1210~1231` 样例）+ `loadCheckpoint` 返回 `{ok, checkpoint}` / `CHECKPOINT_UNREADABLE`；
2. `transit(instanceId,'node',to,{ phase, ... })` 的签名与 D-2 `:1189~1198` 的 `phase` 校验表（A/B/E 三个维度共用）；
3. `resumeOrCreate` 返回结构 `{restored, dialect, attempts}` 与能力归一化口径（D-4 `:1244~1267`，B/C 维度共用）；
4. `recoverInstance()` / `reconcileOnBoot` 的六步对账顺序与 `recoveredAt`/`coreGeneration`（D-5，B 与 F 共用）；
5. `instance graph --format json` 追加键 `recovery`（4 键）/ `connections[]`（4 键）的形状与「追加在 `current` 之后」（A-4/A-9，B 与 E 共用）；
6. `session_policy` 在 `ROLE_KEY_ORDER` 中的位置（`max_concurrent_sessions` 之后）与「加载器不得把缺省 `fresh` 注入渲染对象」（D-13，D 与 E 共用）；
7. M-7 接缝名与取值域（`MAESTRO_MOCK_*` / `MAESTRO_TEST_*`）—— F 与 B/E 共用，**先冻结后各包才能并行造现场**；
8. D-9 两行授权断言的「改后期望值」（尤其 `test/wp4/orchestrator.test.js:575/578/580` 改为「按实例记录恢复」），B 与 G 共用。

### 8.3 并行风险面（同文件冲突 / 需单线）

| 风险 | 同文件冲突点 | 提示（不替 S1 决策） |
|---|---|---|
| **`orchestrator.js` 是超集文件** | 维度 A（检查点写点）、B（`reconcileOnBoot`/恢复/崩溃慢/复用选择）、E 的部分渲染数据来源都要改 `src/core/orchestrator.js`（实文 4800+ 行） | 按 §1.4 规则 1 指定**唯一负责人**，其它维度通过契约调用、不许各自去改；否则两 Agent 互相覆盖 |
| **渲染与文案双文件** | `src/cli/render.js` 同时承载恢复行/恢复块（M-6）、JSON 追加键（M-8）；`src/cli/labels.js` 是中文唯一来源，E 维度内部也可能再分 | 同一 WP 内收敛，或按「先冻结点 5」把 JSON 键形状定死后串行 |
| **mock agent 与 driver 的接缝扩展** | `test/fixtures/mock-acp-agent.js` 被方言域(C)、崩溃慢域(B)、复用域(B) 同时需要新开关；两个 driver 需把 `MAESTRO_MOCK_*` 转成同一组命令行参数 | D-10 `:1360` 规定「不改既有参数语义」「不改既有场景分支」；建议**单线**处理 F 维度，避免多包各加一套开关 |
| **D-9 授权行与新增断言的边界** | `test/wp4/orchestrator.test.js` / `test/wp11/role-schema.test.js` 只允许改两行；`test/wp13/**` 新增断言 | G 维度与 B/D 维度需明确「既有断言只两行可改」；改后必红（M-4/M-5 打破精确断言）是**预期**，不得为保绿弱化功能或扩大改动范围 |
| **`session_policy` 跨校验与显示** | `src/registry/role-schema.js`（枚举校验）与 `src/cli/roles.js`（`role show` 条件追加行）、`asset-write.js`（键序/别名） | 按「先冻结点 6」定死键序与「缺省不注入渲染」后并行；`test/wp11/role-schema.test.js:57` 是唯一授权改点 |
| **真实宿主面与夹具面隔离** | AC-25/26/27 真实面（判阻塞）与 AC-20 夹具（load 语义兜底）容易混用 | 按模板 §3.2「真实宿主面单独一批」、§3.4「观测不到判阻塞」；不得把夹具结果标成真实面（BR-48 / NFR-08），S3 取证时两类证据分目录 |

---

## 附：本纪要的自查（供主控复核，不构成评审结论）

- 8 节齐全：§1 范围 In/Out（含 8 子项 + 3 验收 + 13 范围外 + I1.7 三层边界）、§2 AC 67 条表与分面、§3 BR/M/C、§4 附录 A/D 索引与三特别标注、§5 未决问题与观测项、§6 Given 可构造性（67 条逐条 + 真实面单列 + 无法取证汇总）、§7 契约差异与回归红线、§8 S1 输入提示。
- 数字自洽：分面 3+3+1+17+12+31 = **67**；风险 P0 41 + P1 26 = 67；锚点 28+36+3 = 67；Given 盘点 29 可构造 + 34 待 S2 + 4 阻塞 = 67；BR 54 全部被引用；M 8 / C 18 / NFR 8 / A 10 节 / D 13 节 / B 17 条 / 范围外 13 项均逐条点数。
- 只读：唯一新建本文件；未跑全量测试、未改写 `docs/iterations/iteration-4/evidence/*.json`；只读实跑（Grep / `command -v` / `git status`）不落仓库。
