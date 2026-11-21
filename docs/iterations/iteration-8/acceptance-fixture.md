# I1.8 夹具面验收（67 条 AC 逐条索引）

| 项 | 内容 |
|---|---|
| 覆盖 | **67 条 AC**（含 4 条真实宿主面，其详表见 `acceptance-product.md`） |
| 用例 | `probe/acc8-cases/AC-01..67.mjs`，每条可单跑：`node probe/acc8-f-run.mjs AC-XX` |
| 明细 | 每条 AC 一节：需求原文 Then → 核对项表（期望 / 实测）→ 判定 + 备注。v3 口径 67 条落在 `evidence/acc8/AC-XX.part.md`；**v4 重跑的 8 条**（AC-15/23/37/42/43/45/63/67）落在 `evidence/acc8-v4/AC-XX.part.md` |
| 结果（v4 合并口径） | **65 通过 / 0 不通过 / 2 阻塞**；核对项 **724**（通过 723 / 失败 1）；**457 份被引用帧**（59 条未变 AC 沿用 `evidence/acc8/` 原始帧 + 8 条 v4 重跑 + AC-58/AC-62 夹具返工帧，见 `evidence/acc8-v4/_acc8-f-summary.json`） |
| 复跑口径 | v3：批次跑（`--batch all`）53/12/2，对 12 条非通过项按**裁-20r 逐条独占复跑**后定为 55/10/2（台账 `probe/i18-s2/batch7-isolated-rerun.txt`）。v4：需求 v4 经四轮独立评审终审 PASS 后，用 `ACC8_EVID=acc8-v4` 重跑 8 条 AC，8/8 通过；与其余 59 条（未变、原始帧不动）合并为 67 条 |
| 判定纪律 | 三档：通过 / 不通过（保留原始期望与实测，不删断言）/ 阻塞（客观取不到，不用空集或替代目录冒充） |

> 本轮（2026-11-21）与上一版差异：① 产品返工 AC-49 4/7 → **7/7**、AC-60 6/8 → **10/10**、
> AC-53 2/3 → **5/5**；AC-08 / AC-31 批次内红、独占复跑全绿，按裁-20r 判负载 flake 剔除。
> ② **需求 v4 修订并终审 PASS 后**，8 条需求冲突（AC-15/23/37/42/43/45/63/67）按新判据重跑全部通过
> （99 核对项 88 通过 → 108 核对项 108 通过），合并后不通过 10 → **2**（仅剩 AC-58 / AC-62 夹具缺口）。
> 原始 v3 帧与判定一字不改，作为历史留痕保留在 `evidence/acc8/`。

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
| AC-15 | 旧实例无检查点且模板未知 → 已中断并提示新建 | **通过（v4）** | 12/12 | 8 | [AC-15.part.md](evidence/acc8-v4/AC-15.part.md) |
| AC-16 | 显式 core stop 仍是已中断，不自动恢复 | **通过** | 11/11 | 10 | [AC-16.part.md](evidence/acc8/AC-16.part.md) |
| AC-17 | 恢复失败时用户看到原因 | **通过** | 9/9 | 7 | [AC-17.part.md](evidence/acc8/AC-17.part.md) |
| AC-18 | 恢复幂等：重复启动不重复推进 | **通过** | 8/8 | 8 | [AC-18.part.md](evidence/acc8/AC-18.part.md) |
| AC-19 | resume 方言：广告 resume 时走不回放 | **通过** | 9/9 | 8 | [AC-19.part.md](evidence/acc8/AC-19.part.md) |
| AC-20 | load 方言：广告 load 时走回放且不重复投递 | **通过** | 10/10 | 7 | [AC-20.part.md](evidence/acc8/AC-20.part.md) |
| AC-21 | new 方言：两种都不支持时新建并只重发当前轮 | **通过** | 10/10 | 7 | [AC-21.part.md](evidence/acc8/AC-21.part.md) |
| AC-22 | resume 失败时回退 load，且每一步可见 | **通过** | 10/10 | 7 | [AC-22.part.md](evidence/acc8/AC-22.part.md) |
| AC-23 | 三种方言都失败时按 §3.6 降级 | **通过（v4）** | 16/16 | 10 | [AC-23.part.md](evidence/acc8-v4/AC-23.part.md) |
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
| AC-37 | human 节点保持 running，等待人工 | **通过（v4）** | 10/10 | 7 | [AC-37.part.md](evidence/acc8-v4/AC-37.part.md) |
| AC-38 | escalate 节点保持 escalated | **通过** | 10/10 | 6 | [AC-38.part.md](evidence/acc8/AC-38.part.md) |
| AC-39 | failed 节点保持 failed | **通过** | 9/9 | 6 | [AC-39.part.md](evidence/acc8/AC-39.part.md) |
| AC-40 | suspended 实例内全部节点保持原状 | **通过** | 12/12 | 7 | [AC-40.part.md](evidence/acc8/AC-40.part.md) |
| AC-41 | subworkflow 节点在恢复中保持不透明 | **通过** | 13/13 | 7 | [AC-41.part.md](evidence/acc8/AC-41.part.md) |
| AC-42 | 会话进程崩溃：重建并重试当前轮 | **通过（v4）** | 15/15 | 7 | [AC-42.part.md](evidence/acc8-v4/AC-42.part.md) |
| AC-43 | 会话重建失败 → 升级人工 | **通过（v4）** | 14/14 | 6 | [AC-43.part.md](evidence/acc8-v4/AC-43.part.md) |
| AC-44 | 运行慢：不重建会话 | **通过** | 15/15 | 5 | [AC-44.part.md](evidence/acc8/AC-44.part.md) |
| AC-45 | 运行慢 + 节点超时 → 记超时失败并升级人工 | **通过（v4）** | 15/15 | 8 | [AC-45.part.md](evidence/acc8-v4/AC-45.part.md) |
| AC-46 | 运行慢且未声明超时 → 继续等待，不擅自失败 | **通过** | 13/13 | 7 | [AC-46.part.md](evidence/acc8/AC-46.part.md) |
| AC-47 | 崩溃与运行慢的两类提示不混用 | **通过** | 17/17 | 5 | [AC-47.part.md](evidence/acc8/AC-47.part.md) |
| AC-48 | fresh 默认：每任务新会话 | **通过** | 9/9 | 5 | [AC-48.part.md](evidence/acc8/AC-48.part.md) |
| AC-49 | reuse：同一角色第二轮复用空闲会话 | **通过** | 7/7 | 6 | [AC-49.part.md](evidence/acc8/AC-49.part.md) |
| AC-50 | reuse 不跨实例 | **通过** | 7/7 | 7 | [AC-50.part.md](evidence/acc8/AC-50.part.md) |
| AC-51 | 角色配置可见，非法值被拒 | **通过** | 16/16 | 8 | [AC-51.part.md](evidence/acc8/AC-51.part.md) |
| AC-52 | 非恢复路径的三条主链不变（基线 014fa6a） | **通过** | 12/12 | 5 | [AC-52.part.md](evidence/acc8/AC-52.part.md) |
| AC-53 | 全量测试回归门禁：失败集合差集为 0 | **通过** | 5/5 | 1 | [AC-53.part.md](evidence/acc8/AC-53.part.md) |
| AC-54 | 架构纯净：31 词扫描 exit 0、零依赖 | **通过** | 8/8 | 2 | [AC-54.part.md](evidence/acc8/AC-54.part.md) |
| AC-55 | 不新增 CLI 命令，用法块不变 | **通过** | 9/9 | 4 | [AC-55.part.md](evidence/acc8/AC-55.part.md) |
| AC-56 | I1.7 已合入：恢复实现不依赖 worktree / 产物隔离（按裁-12 重判） | **通过** | 6/6 | 1 | [AC-56.part.md](evidence/acc8/AC-56.part.md) |
| AC-57 | 真实宿主隔离：不动用户 ~/.dsh | **通过** | 10/10 | 1 | [AC-57.part.md](evidence/acc8/AC-57.part.md) |
| AC-58 | 用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成 | **通过（夹具返工）** | 16/16 | 17 | [AC-58.part.md](evidence/acc8-v4/AC-58.part.md) |
| AC-59 | 恢复前已分配的节点保持已分配并重新派发 | **通过** | 11/11 | 9 | [AC-59.part.md](evidence/acc8/AC-59.part.md) |
| AC-60 | 待执行节点恢复后保持原位置，依赖不变 | **通过** | 10/10 | 9 | [AC-60.part.md](evidence/acc8/AC-60.part.md) |
| AC-61 | 已构造未投递的交接包恢复后继续投递 | **通过** | 9/9 | 7 | [AC-61.part.md](evidence/acc8/AC-61.part.md) |
| AC-62 | 重投连续失败 → 已过期并升级 | **通过（夹具返工）** | 9/9 | 10 | [AC-62.part.md](evidence/acc8-v4/AC-62.part.md) |
| AC-63 | 重建后的会话再次崩溃 → 直接升级，不再重建 | **通过（v4）** | 16/16 | 8 | [AC-63.part.md](evidence/acc8-v4/AC-63.part.md) |
| AC-64 | 重建失败 / 宿主不可达 → 角色不可用，恢复后回到可用 | **通过** | 10/10 | 10 | [AC-64.part.md](evidence/acc8/AC-64.part.md) |
| AC-65 | reuse 但没有空闲会话 → 新建，不报错 | **通过** | 7/7 | 6 | [AC-65.part.md](evidence/acc8/AC-65.part.md) |
| AC-66 | reuse 不跨宿主、不复用正在服务其他节点的会话 | **通过** | 13/13 | 7 | [AC-66.part.md](evidence/acc8/AC-66.part.md) |
| AC-67 | 角色恢复后既无可用会话也无可调度节点 → 按既有优先序显示（冷却中） | **通过（v4）** | 10/10 | 12 | [AC-67.part.md](evidence/acc8-v4/AC-67.part.md) |

## 二、0 条不通过（v4 合并口径）

> 原 10 条不通过已全部消除：8 条需求冲突随需求 v4 重跑转绿（见 §三），
> 2 条夹具缺口经用户裁-21m 授权返工后重跑转绿（AC-58 16/16、AC-62 9/9）。
> 判定纪律不变：原始期望与实测均保留、不删断言、不写恒真期望；v3 口径的 10 条记录原文保留在
> `evidence/acc8/AC-XX.part.md` 与 `report.md` 的历史轮次存档中。

| 归口 | 条数（按 AC） | AC |
|---|---|---|
| 需求冲突（改需求才可过） | **0** | v4 的 8 条已重跑通过：AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-63、AC-67 |
| 夹具缺口（补观测路径/时序即可重判） | **0** | AC-58 / AC-62 经裁-21m 授权返工夹具后重跑通过 |
| 产品缺陷 | **0** | — |

> 算术：0 + 0 = **0**，与总表一致。**没有**为了让测试变绿而改产品实现或放宽机检。
> **须复核的夹具解释**：AC-58 的 `e2e` 图由 `backflow` 改为 `pass`（原回流的首轮故意失败会回流重测 T-001，
> 与 Then「已完成节点不重跑」在同一 kill 点不可兼得），改后由「交接包重投 + 已完成节点保留」承担可验面。
> 若独立终验不认此解释，须先改需求再重跑，不得默默放行（裁-21m、`evidence/acc8-v4/_merge-notes.md`）。

## 三、已消除的 13 条（3 条产品返工 + 8 条需求 v4 修订 + 2 条夹具返工）

| AC | 返工前 | 返工后 | 落地内容 | 留痕 |
|---|---|---|---|---|
| AC-49 | 不通过 4/7（两轮各建新会话、无复用行） | **通过 7/7** | CLI `run` 经 `roleSessionPolicies()` 把角色文件里显式的 `session_policy: reuse` 快照进 `state.sessionPolicies`；`buildSession` 补 `roleId`/`instanceId`/`servingNodeId`；派发路径改为「先试复用（`resume`/`load` 两站）再新建」，命中写 `session.reuse` 事件 + 「会话 复用 {id}（角色 {id}）」行 | 裁-20k、裁-20k-补、裁-20m |
| AC-60 | 不通过 6/8（`continueRecovery` 只续派 assigned/created/redeliver，漏 `pending`+`ready`） | **通过 10/10** | `recoverInstance` 收集 `nodePosition(node)==='ready'` 的 `pending` 节点进 `plan.ready`；`continueRecovery` 末尾续派，且**派前重读磁盘**确认仍 `pending`（否则与 `redeliver` 二次派发同一节点） | 裁-20b、裁-20b-补、裁-20n |
| AC-53 | 不通过 2/3（差集口径撞三主链时序 flake） | **通过 5/5** | 门禁按「失败集合差集 = 0」判定，新增红必须逐条独占复跑（TAP `location:` 反查所属文件 + `--test-concurrency=1`）证伪，**不设白名单预赦**；台账 `AC-53.diffset.txt` 显示「新增失败 (空)」「剔除 flake 后的差集 (空)」 | 裁-20j、裁-20p、裁-20q、裁-20r |
| AC-15 | 不通过 9/10（机检 `sha256` 不变，与落 `interrupted` 互斥） | **通过 12/12** | 机检改为「除 6 项随状态写入的元数据外逐叶子不变」，业务字段逐字不变；两枚 hash 仍写帧供复核但不再做判据 | 裁-21a、裁-21c、review-v4-round4 |
| AC-23 | 不通过 8/10（「不进入运行中」无锚点、预开会话被误判） | **通过 16/16** | 主断言改 `state.state === 'running'`；`recovery.dialect` 落「恰 1 `new` + 2 `fallback`」可数锚点；继续调度交 AC-31 / AC-60 覆盖 | 裁-21d③、裁-21f①、裁-21h② |
| AC-37 | 不通过 9/10（要求 `graph` 渲染图外 human 节点） | **通过 10/10** | 观测通道改 `orch status` 节点行「节点 T-004 执行中 · 第 N 轮」；明确 `graph` 只渲染图声明节点 | 裁-21d① |
| AC-42 | 不通过 13/15（逐字 T-003·2/3） | **通过 15/15** | 文案按 `detail` 动态填充；`round` 与崩溃前一致（不写「或更大」，避免与 BR-37 互斥） | 裁-21a、裁-21d② |
| AC-43 | 不通过 13/14（逐字 T-003·2/3） | **通过 14/14** | 文案按 `rebuild_failed` 的 `detail` 动态填充；退出码 4 / `suspended` 判据不动 | 裁-21a |
| AC-45 | 不通过 14/15（轮次 2/3 不可满足） | **通过 15/15** | 轮次/上限绑 `session.timeout` 的 `detail.round` / `detail.maxRounds`；**恢复实测成立的 `T-003` 字面**（唯一放宽方向的分句已收紧） | 裁-21k（review-v4-round4 S-01） |
| AC-63 | 不通过 15/16（逐字 T-003·2/3） | **通过 16/16** | 机检换可数锚点 `session.rebuilt` 1 / `rebuild_failed` 1 / `state.sessions` 2 | 裁-21f② |
| AC-67 | 不通过 7/9（要求显示「可用」） | **通过 10/10** | 标题/Then 改「按既有优先序显示（冷却中）」；新增恢复前后两帧 `orch role show` 逐字相同取证；取点按裁-21l 操作化 | 裁-21e、裁-21g①、裁-21h①、裁-21l |
| AC-58 | 不通过 9/16（固定 kill 窗口错位 + 观察窗太短） | **通过 16/16** | driver 新增 `--kill-when=done-running-created` 状态驱动 kill + 终态轮询双快照；**e2e 图改 pass 属夹具解释，须终验复核** | 裁-21m |
| AC-62 | 不通过 2/9（重投落到真实 DSH，mock 开关从未生效） | **通过 9/9** | Given T-002 改 running + 绑定 mock 会话；mock 新增 `--delivery-failures 3`，前 3 次 prompt 在任何 turn 事件前返回 -32603，由产品核心推到 expired + 升级 | 裁-21m |

本轮全量：**1927 条 / 1895 pass / 21 fail / 11 skip**，对基线 `014fa6a`（1841/1808/22/11）
**EXTRA = 0**，并顺带修好 1 条基线红（`live 取消…`）。逐条台账见 `probe/i18-s2/batch7-isolated-rerun.txt`。

## 四、2 条阻塞（用户裁决：书面豁免）

| AC | 核对 | 原因 | 是否用替代物冒充 | 处置 |
|---|---|---|---|---|
| AC-26 | 5/5 | 机检锚点 `workspace/artifacts/**` 在编码闭环实例下不存在 | **否**（空集只记 block，不产生通过记录） | 裁-20o：**书面豁免**（锚点客观不存在，不再要求补环境取证） |
| AC-27 | 2/3 | 第三方 `dsh-acp-server` bin 启动失败（`ERR_UNSUPPORTED_ESM_URL_SCHEME`）；本机仅有 Electron 版 DSH，无 `dsh` CLI | **否**（保留原始 stderr 帧） | 裁-20o：**书面豁免**（需 `dsh` CLI 的前置条件在本机不成立） |

> 豁免「阻塞」不等于改判「通过」：两条仍计入阻塞档，Done 判定的 `blocked` 计数保留为 2，
> 由用户在 `_acc8-f-blockers.md`「处置结论」表书面接受。
