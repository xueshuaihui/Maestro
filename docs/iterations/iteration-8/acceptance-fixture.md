# I1.8 夹具面验收（67 条 AC 逐条索引）

| 项 | 内容 |
|---|---|
| 覆盖 | **67 条 AC**（含 4 条真实宿主面，其详表见 `acceptance-product.md`） |
| 用例 | `probe/acc8-cases/AC-01..67.mjs`，每条可单跑：`node probe/acc8-f-run.mjs AC-XX` |
| 明细 | 每条 AC 一节：需求原文 Then → 核对项表（期望 / 实测）→ 判定 + 备注，落在 `evidence/acc8/AC-XX.part.md` |
| 结果 | **55 通过 / 10 不通过 / 2 阻塞**；核对项 **714**（通过 688 / 失败 26）；**453 份被引用帧**（`_acc8-f-results.jsonl` 与 `_acc8-f-summary.json` 同源） |
| 复跑口径 | 批次跑（`--batch all`）得 53/12/2；对 12 条非通过项按**裁-20r 逐条独占复跑**后定为 55/10/2，台账 `probe/i18-s2/batch7-isolated-rerun.txt` |
| 判定纪律 | 三档：通过 / 不通过（保留原始期望与实测，不删断言）/ 阻塞（客观取不到，不用空集或替代目录冒充） |

> 本轮（2026-11-21 返工后）与上一版差异：AC-49 4/7 → **7/7 通过**、AC-60 6/8 → **10/10 通过**、
> AC-53 2/3 → **4/4 通过**（三条均为产品返工 + 门禁口径落地，见 §三）；AC-08 / AC-31 在批次内红、
> 独占复跑全绿，按裁-20r 判为负载 flake，剔除。

## 一、总表

| AC | 标题 | 判定 | 核对项 | 证据 | 明细 |
|---|---|---|---|---|---|
| AC-01 | 九个节点位置在用户可见层对得上 | **通过** | 22/22 | 10 | [AC-01.part.md](evidence/acc8/AC-01.part.md) |
| AC-02 | 检查点随每一件进展推进 | **通过** | 8/8 | 6 | [AC-02.part.md](evidence/acc8/AC-02.part.md) |
| AC-03 | 检查点内容足以恢复「做到哪」 | **通过** | 33/33 | 5 | [AC-03.part.md](evidence/acc8/AC-03.part.md) |
| AC-04 | 检查点写失败时用户看得到，运行不中断 | **通过** | 9/9 | 5 | [AC-04.part.md](evidence/acc8/AC-04.part.md) |
| AC-05 | 检查点缺失但实例记录完整时按实例记录恢复 | **通过** | 10/10 | 8 | [AC-05.part.md](evidence/acc8/AC-05.part.md) |
| AC-06 | 实例记录不可读时不从检查点静默重建 | **通过** | 9/9 | 3 | [AC-06.part.md](evidence/acc8/AC-06.part.md) |
| AC-07 | 重启后轮次不重置 | **通过** | 10/10 | 4 | [AC-07.part.md](evidence/acc8/AC-07.part.md) |
| AC-08 | 已完成节点不重放 | **通过** | 9/9 | 5 | [AC-08.part.md](evidence/acc8/AC-08.part.md) |
| AC-09 | 回流中途 kill daemon，重启后从检查点继续 | **通过** | 9/9 | 5 | [AC-09.part.md](evidence/acc8/AC-09.part.md) |
| AC-10 | 恢复摘要一行说清「从哪来、跳过多少、第几轮」 | **通过** | 9/9 | 6 | [AC-10.part.md](evidence/acc8/AC-10.part.md) |
| AC-11 | 挂起实例重启后仍挂起 | **通过** | 9/9 | 7 | [AC-11.part.md](evidence/acc8/AC-11.part.md) |
| AC-12 | 升级节点重启后仍是已升级 | **通过** | 9/9 | 5 | [AC-12.part.md](evidence/acc8/AC-12.part.md) |
| AC-13 | 失败节点重启后不自动重跑 | **通过** | 13/13 | 10 | [AC-13.part.md](evidence/acc8/AC-13.part.md) |
| AC-14 | 待校验节点恢复只重新核对，不重放会话 | **通过** | 12/12 | 10 | [AC-14.part.md](evidence/acc8/AC-14.part.md) |
| AC-15 | 旧实例无检查点且模板未知 → 已中断并提示新建 | **不通过** | 9/10 | 8 | [AC-15.part.md](evidence/acc8/AC-15.part.md) |
| AC-16 | 显式 core stop 仍是已中断，不自动恢复 | **通过** | 11/11 | 10 | [AC-16.part.md](evidence/acc8/AC-16.part.md) |
| AC-17 | 恢复失败时用户看到原因 | **通过** | 9/9 | 7 | [AC-17.part.md](evidence/acc8/AC-17.part.md) |
| AC-18 | 恢复幂等：重复启动不重复推进 | **通过** | 8/8 | 8 | [AC-18.part.md](evidence/acc8/AC-18.part.md) |
| AC-19 | resume 方言：广告 resume 时走不回放 | **通过** | 9/9 | 8 | [AC-19.part.md](evidence/acc8/AC-19.part.md) |
| AC-20 | load 方言：广告 load 时走回放且不重复投递 | **通过** | 10/10 | 7 | [AC-20.part.md](evidence/acc8/AC-20.part.md) |
| AC-21 | new 方言：两种都不支持时新建并只重发当前轮 | **通过** | 10/10 | 7 | [AC-21.part.md](evidence/acc8/AC-21.part.md) |
| AC-22 | resume 失败时回退 load，且每一步可见 | **通过** | 10/10 | 7 | [AC-22.part.md](evidence/acc8/AC-22.part.md) |
| AC-23 | 三种方言都失败时按 §3.6 降级 | **不通过** | 8/10 | 10 | [AC-23.part.md](evidence/acc8/AC-23.part.md) |
| AC-24 | resume 成功也不重放已完成节点 | **通过** | 10/10 | 6 | [AC-24.part.md](evidence/acc8/AC-24.part.md) |
| AC-25 | 真实 DSH：只广告 resume、不广告 load，恢复走 resume | **通过** | 13/13 | 5 | [AC-25.part.md](evidence/acc8/AC-25.part.md) |
| AC-26 | 真实 DSH：重启不重复已完成节点 | **阻塞** | 5/5 | 4 | [AC-26.part.md](evidence/acc8/AC-26.part.md) |
| AC-27 | 第三方 load 方言：真实可用则真验，否则阻塞 | **阻塞** | 2/3 | 2 | [AC-27.part.md](evidence/acc8/AC-27.part.md) |
| AC-28 | 角色 busy 且会话不可恢复 → available | **通过** | 10/10 | 9 | [AC-28.part.md](evidence/acc8/AC-28.part.md) |
| AC-29 | 角色 busy 且会话可恢复 → 保持 busy | **通过** | 8/8 | 8 | [AC-29.part.md](evidence/acc8/AC-29.part.md) |
| AC-30 | available / cooldown / inactive 不受恢复影响 | **通过** | 11/11 | 10 | [AC-30.part.md](evidence/acc8/AC-30.part.md) |
| AC-31 | 降级后重新调度，角色回到 busy | **通过** | 8/8 | 8 | [AC-31.part.md](evidence/acc8/AC-31.part.md) |
| AC-32 | delivered 未 accepted → pending 并重投 | **通过** | 9/9 | 7 | [AC-32.part.md](evidence/acc8/AC-32.part.md) |
| AC-33 | 已 accepted 的交接包不重投 | **通过** | 9/9 | 7 | [AC-33.part.md](evidence/acc8/AC-33.part.md) |
| AC-34 | consumed / rejected / expired 恢复后不改 | **通过** | 10/10 | 9 | [AC-34.part.md](evidence/acc8/AC-34.part.md) |
| AC-35 | 重投成功后回到已投递 / 已接受 | **通过** | 7/7 | 10 | [AC-35.part.md](evidence/acc8/AC-35.part.md) |
| AC-36 | 连接线聚合在恢复实例的图上可见 | **通过** | 12/12 | 5 | [AC-36.part.md](evidence/acc8/AC-36.part.md) |
| AC-37 | human 节点保持 running，等待人工 | **不通过** | 9/10 | 7 | [AC-37.part.md](evidence/acc8/AC-37.part.md) |
| AC-38 | escalate 节点保持 escalated | **通过** | 10/10 | 6 | [AC-38.part.md](evidence/acc8/AC-38.part.md) |
| AC-39 | failed 节点保持 failed | **通过** | 9/9 | 6 | [AC-39.part.md](evidence/acc8/AC-39.part.md) |
| AC-40 | suspended 实例内全部节点保持原状 | **通过** | 12/12 | 7 | [AC-40.part.md](evidence/acc8/AC-40.part.md) |
| AC-41 | subworkflow 节点在恢复中保持不透明 | **通过** | 13/13 | 7 | [AC-41.part.md](evidence/acc8/AC-41.part.md) |
| AC-42 | 会话进程崩溃：重建并重试当前轮 | **不通过** | 13/15 | 7 | [AC-42.part.md](evidence/acc8/AC-42.part.md) |
| AC-43 | 会话重建失败 → 升级人工 | **不通过** | 13/14 | 6 | [AC-43.part.md](evidence/acc8/AC-43.part.md) |
| AC-44 | 运行慢：不重建会话 | **通过** | 15/15 | 5 | [AC-44.part.md](evidence/acc8/AC-44.part.md) |
| AC-45 | 运行慢 + 节点超时 → 记超时失败并升级人工 | **不通过** | 14/15 | 8 | [AC-45.part.md](evidence/acc8/AC-45.part.md) |
| AC-46 | 运行慢且未声明超时 → 继续等待，不擅自失败 | **通过** | 13/13 | 7 | [AC-46.part.md](evidence/acc8/AC-46.part.md) |
| AC-47 | 崩溃与运行慢的两类提示不混用 | **通过** | 17/17 | 5 | [AC-47.part.md](evidence/acc8/AC-47.part.md) |
| AC-48 | fresh 默认：每任务新会话 | **通过** | 9/9 | 5 | [AC-48.part.md](evidence/acc8/AC-48.part.md) |
| AC-49 | reuse：同一角色第二轮复用空闲会话 | **通过** | 7/7 | 6 | [AC-49.part.md](evidence/acc8/AC-49.part.md) |
| AC-50 | reuse 不跨实例 | **通过** | 7/7 | 7 | [AC-50.part.md](evidence/acc8/AC-50.part.md) |
| AC-51 | 角色配置可见，非法值被拒 | **通过** | 16/16 | 8 | [AC-51.part.md](evidence/acc8/AC-51.part.md) |
| AC-52 | 非恢复路径的三条主链不变（基线 014fa6a） | **通过** | 12/12 | 5 | [AC-52.part.md](evidence/acc8/AC-52.part.md) |
| AC-53 | 全量测试回归门禁：失败集合差集为 0 | **通过** | 4/4 | 1 | [AC-53.part.md](evidence/acc8/AC-53.part.md) |
| AC-54 | 架构纯净：31 词扫描 exit 0、零依赖 | **通过** | 8/8 | 2 | [AC-54.part.md](evidence/acc8/AC-54.part.md) |
| AC-55 | 不新增 CLI 命令，用法块不变 | **通过** | 9/9 | 4 | [AC-55.part.md](evidence/acc8/AC-55.part.md) |
| AC-56 | I1.7 已合入：恢复实现不依赖 worktree / 产物隔离（按裁-12 重判） | **通过** | 6/6 | 1 | [AC-56.part.md](evidence/acc8/AC-56.part.md) |
| AC-57 | 真实宿主隔离：不动用户 ~/.dsh | **通过** | 10/10 | 1 | [AC-57.part.md](evidence/acc8/AC-57.part.md) |
| AC-58 | 用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成 | **不通过** | 9/16 | 16 | [AC-58.part.md](evidence/acc8/AC-58.part.md) |
| AC-59 | 恢复前已分配的节点保持已分配并重新派发 | **通过** | 11/11 | 9 | [AC-59.part.md](evidence/acc8/AC-59.part.md) |
| AC-60 | 待执行节点恢复后保持原位置，依赖不变 | **通过** | 10/10 | 9 | [AC-60.part.md](evidence/acc8/AC-60.part.md) |
| AC-61 | 已构造未投递的交接包恢复后继续投递 | **通过** | 9/9 | 7 | [AC-61.part.md](evidence/acc8/AC-61.part.md) |
| AC-62 | 重投连续失败 → 已过期并升级 | **不通过** | 2/9 | 9 | [AC-62.part.md](evidence/acc8/AC-62.part.md) |
| AC-63 | 重建后的会话再次崩溃 → 直接升级，不再重建 | **不通过** | 15/16 | 8 | [AC-63.part.md](evidence/acc8/AC-63.part.md) |
| AC-64 | 重建失败 / 宿主不可达 → 角色不可用，恢复后回到可用 | **通过** | 10/10 | 10 | [AC-64.part.md](evidence/acc8/AC-64.part.md) |
| AC-65 | reuse 但没有空闲会话 → 新建，不报错 | **通过** | 7/7 | 6 | [AC-65.part.md](evidence/acc8/AC-65.part.md) |
| AC-66 | reuse 不跨宿主、不复用正在服务其他节点的会话 | **通过** | 13/13 | 7 | [AC-66.part.md](evidence/acc8/AC-66.part.md) |
| AC-67 | 角色恢复后既无可用会话也无可调度节点 → 保持可用 | **不通过** | 7/9 | 9 | [AC-67.part.md](evidence/acc8/AC-67.part.md) |

## 二、10 条不通过的逐条记录

> 这些不是「用例写错」而是**真实结论**。每条都给出：需求原文要点 → 实测 → 归口 → 处置。
> 原始期望/实测见对应 `AC-XX.part.md` 的核对表，未做任何放宽。
> 归口分三类：**需求冲突**（改需求才能过）、**夹具缺口**（补观测路径/时序即可重判）、**产品缺陷**（本轮为 0 条）。

### AC-15 旧实例无检查点且模板未知 → 已中断并提示新建（9/10）

- **需求 Then**：实例显示「已中断」+ 提示新建。
- **机检**：`state.json` 的 sha256 **不变**。
- **实测**：显示「已中断」✅；sha256 变了（`d7e905…` → `f15790…`）。
- **归口**：**需求自相矛盾**——`markInterrupted` 必须重写 `state.json` 才能落 `interrupted`，与「sha256 不变」不可兼得。
- **处置**：改需求或书面豁免（未裁决，保持不通过）。

### AC-23 三种方言都失败时按 §3.6 降级（8/10）

- **需求 Then**：节点「已分配」、角色「可用 · 活跃会话 0/1」、交接「待投递」、**实例不进入「运行中」**。
- **实测**：前三项全部达成 ✅；实例仍为 `running`（`orch status` 首行显示「运行中」）；另 `session/new` 失败后仍产生新会话（C09）。
- **归口**：**需求矛盾**——BR-22 要求「降级后继续调度」（D-5 第 5 步），就不可能是非运行态；C09 系真 `adapterFactory.create` 在 create 时预开会话，三方言全失败分支在 CLI 真 factory 路径下不可达。
- **处置**：改需求；预开会话列为观察项（`report.md` §5.3）。

### AC-37 human 节点保持 running，等待人工（9/10）

- **需求 Then**：`graph` 显示「T-004 人工确认 · 执行中 · 第 1 轮 · 等待人工」。
- **实测**：`status` 显示「节点 T-004 执行中 · 第 1 轮」✅，但 `graph --format text` 只渲染图声明的 T-001/T-002，不含 T-004。
- **归口**：**需求与渲染口径冲突**——`graphNodes()` 按图声明渲染是既有设计，改它会撞三主链逐字基线。
- **处置**：改需求（允许 `graph` 展示图外节点）或改用内建图内的 human 节点作夹具。

### AC-42 / AC-43 / AC-45 / AC-63 会话崩溃三态（13/15、13/14、14/15、15/16）

- **需求 Then**：逐字「（节点 **T-003** · 轮次 **2/3**）」，AC-42 机检还要求 `round === 2`。
- **实测**：文案模板一致，但实际填充为「节点 T-001 · 轮次 1/2」（内建图只有 T-001/T-002，`maxRounds=2` 是 I1.1 逐字红线）。
- **归口**：**需求文案假设了一个不存在的图**（3 节点 / 3 轮）——四条共同的唯一红点就是这条逐字断言。
- **AC-45 曾有 4 条假阴性，已修**：C07 节点 `escalated`、C08 实例 `suspended`、C09 `escalations` 新增 1、
  C10 `reasonCode=timeout` 原先读 `state.json` 的时刻早于迁移落盘。独立终验第 2 轮查证：`events` 止于 seq 31 的
  `session.timeout`，`state.updatedAt` 只比它晚 5ms，升级/挂起事件 #32~#35 在其后才落盘，而同一次运行后面读的 `status`
  已显示「已挂起 / 节点 T-003 已升级 / ESC-001 待处理」。已把读点改为「等 `suspended` + `escalations≥1` 落定再读」
  （上限 20s，落不下来仍判红，**期望值一字未改**），复跑 **14/15**，只剩上面那条逐字文案。
- **处置**：改需求文案为「按实际节点与轮次填充」（同 AC-10 已明确写「按实际值」）；AC-45 的时序项已无遗留。

### AC-58 用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成（9/16）

- **需求 Then**：恢复行含跳过数与轮次；已完成节点不重跑；最终实例**完成或升级**。
- **实测**：7 条未通过——C03 无「跳过/轮次」、C05 `skipped=0`、C06 `node.dispatch` 计数 0（非 1）、C07 prompt 计数 0、
  C09 角色降级重调度证据为空、C10 重派后节点状态未取到、C13 收尾 `state=running`。
- **归口**：**夹具缺口（e2e kill 窗口 + 观察窗）**——`given.driver-attempts.json` 的 attempt 0 记录崩溃前状态为
  `T-001 running 第 2 轮 / T-002 failed 第 1 轮 / HO-002 created`，**没有任何 `done` 节点**，因此恢复时 `skipped` 必然为 0、
  也不会出现「重派已完成节点」的 `node.dispatch`/prompt 记录；C03/C05/C06/C07/C09/C10 都是这份窗口与断言预期错位。
  C13 是同一口径冲突（driver 恢复后只等 `waitMs=5000ms`，未到「完成/升级」终态）。**不是产品没推进**。
- **处置**：重定 kill 点（命中「有已完成节点 + 有 in-flight 节点」的窗口）并延长观察窗后重判；
  未经授权不改夹具、不把「已构造」改写成通过（详见该节备注末两条）。


### AC-62 重投连续失败 → 已过期并升级（2/9）

- **需求 Then**：`handoff.state === 'expired'`、`deliveryAttempts === 3`、`handoff list` 显示「已过期」、`escalations` +1、`reasonCode = delivery_failed`。
- **实测**：交接包直接 `accepted`，`deliveryAttempts = 1`，无升级。
- **归口**：**夹具缺口**——产品侧「3 次失败 → expired → 升级」已实现（`orchestrator.js:2039~2062`）且有单测，
  但 mock 没有「重投前连续 3 次确定性失败」的端到端接缝。
- **处置**：给 mock 补失败接缝后重判（**不伪造 expired**）。

### AC-67 角色恢复后既无可用会话也无可调度节点 → 保持可用（7/9）

- **需求 Then**：`role show` 显示「可用」。
- **实测**：显示「冷却中 · 活跃会话 0/1」。
- **归口**：**需求与角色六态规则冲突**——Given「服务节点都已终态」命中 `doneCount>0 → cooldown`（I1.5 起的既有优先序 `busy > cooldown > available`）。
- **处置**：改需求（或明确「恢复后强制置 available」会覆盖既有冷却语义，需产品裁决）。

### 汇总

| 归口 | 条数（按 AC） | AC |
|---|---|---|
| 需求冲突（改需求才可过） | 8 | AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-63、AC-67 |
| 夹具缺口（补观测路径/时序即可重判） | 2 | AC-58、AC-62 |
| 产品缺陷 | **0** | — |

> 算术：8 + 2 = **10**，与总表一致。上一版写成「7 + 3 − 1 = 10」，实际是 **AC-67 漏进汇总表、AC-45 被计两次**，
> 独立终验第 2 轮已指出，本版改正（AC-45 现只余 1 项逐字文案不成立，取证时序那 4 项已修）。

## 三、本轮已消除的 3 条（返工落地）

| AC | 返工前 | 返工后 | 落地内容 | 留痕 |
|---|---|---|---|---|
| AC-49 | 不通过 4/7（两轮各建新会话、无复用行） | **通过 7/7** | CLI `run` 经 `roleSessionPolicies()` 把角色文件里显式的 `session_policy: reuse` 快照进 `state.sessionPolicies`；`buildSession` 补 `roleId`/`instanceId`/`servingNodeId`；派发路径改为「先试复用（`resume`/`load` 两站）再新建」，命中写 `session.reuse` 事件 + 「会话 复用 {id}（角色 {id}）」行 | 裁-20k、裁-20k-补、裁-20m |
| AC-60 | 不通过 6/8（`continueRecovery` 只续派 assigned/created/redeliver，漏 `pending`+`ready`） | **通过 10/10** | `recoverInstance` 收集 `nodePosition(node)==='ready'` 的 `pending` 节点进 `plan.ready`；`continueRecovery` 末尾续派，且**派前重读磁盘**确认仍 `pending`（否则与 `redeliver` 二次派发同一节点） | 裁-20b、裁-20b-补、裁-20n |
| AC-53 | 不通过 2/3（差集口径撞三主链时序 flake） | **通过 4/4** | 门禁按「失败集合差集 = 0」判定，新增红必须逐条独占复跑（TAP `location:` 反查所属文件 + `--test-concurrency=1`）证伪，**不设白名单预赦**；台账 `AC-53.diffset.txt` 显示「新增失败 (空)」「剔除 flake 后的差集 (空)」 | 裁-20j、裁-20p、裁-20q、裁-20r |

本轮全量：**1927 条 / 1895 pass / 21 fail / 11 skip**，对基线 `014fa6a`（1841/1808/22/11）
**EXTRA = 0**，并顺带修好 1 条基线红（`live 取消…`）。逐条台账见 `probe/i18-s2/batch7-isolated-rerun.txt`。

## 四、2 条阻塞（用户裁决：书面豁免）

| AC | 核对 | 原因 | 是否用替代物冒充 | 处置 |
|---|---|---|---|---|
| AC-26 | 5/5 | 机检锚点 `workspace/artifacts/**` 在编码闭环实例下不存在 | **否**（空集只记 block，不产生通过记录） | 裁-20o：**书面豁免**（锚点客观不存在，不再要求补环境取证） |
| AC-27 | 2/3 | 第三方 `dsh-acp-server` bin 启动失败（`ERR_UNSUPPORTED_ESM_URL_SCHEME`）；本机仅有 Electron 版 DSH，无 `dsh` CLI | **否**（保留原始 stderr 帧） | 裁-20o：**书面豁免**（需 `dsh` CLI 的前置条件在本机不成立） |

> 豁免「阻塞」不等于改判「通过」：两条仍计入阻塞档，Done 判定的 `blocked` 计数保留为 2，
> 由用户在 `_acc8-f-blockers.md`「处置结论」表书面接受。
