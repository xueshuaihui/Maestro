# I1.8 实现报告（实例管理器完整 · 崩溃恢复 · ACP 恢复方言）

| 项 | 内容 |
|---|---|
| 需求 | `docs/iterations/iteration-8/requirement.md`（v3，**67 条 AC / 54 BR / 8 NFR**；S0 评审 r1 FAIL → r2 FAIL → **r3 PASS**） |
| 拆分与契约 | `docs/iterations/iteration-8.md`（812 行 / 7 WP / 10 个契约冻结点；S1 评审 r1 FAIL → **r2 PASS**） |
| 验收记录 | `docs/iterations/iteration-8/evidence/acc8/`（**539 个文件 / 453 份被引用帧**，67 条 `*.part.md` 逐条核对表） |
| 终验记录 | `docs/iterations/iteration-8/final-verification.md`（**独立终验 Agent**，返工后重开一轮） |
| 裁决台账 | `docs/iterations/iteration-8/decisions.md`（裁-1 ~ 裁-20y） |
| 环境 | Windows 10/11 · Node v22.22.2 · DSH `0.2.2-rc.5`（需求记 rc.1，实测优先）· Git Bash |
| 完成时间 | 2026-11-21（S4 收口尝试） |

## 0 总体结论

**未达成退出标准（模板 §4.5 Done 未满足）**。一句话：**两条产品缺口（AC-49 / AC-60）已返工落地并通过验收，10 条 AC 仍卡在「需求文本与冻结基线冲突 + 夹具缺口」，2 条真实宿主面阻塞按用户书面裁决豁免**。按 §4.5「不许带着不通过宣布需求结束」，本报告**不宣布 I1.8 收口**。

| 判定项 | 数字 | 结论 |
|---|---|---|
| AC 总数 | 67 | — |
| 通过 | **55** | — |
| 不通过 | **10** | 见 §5.1 |
| 阻塞 | **2** | AC-26（真实宿主机检锚点不可取证）、AC-27（第三方 `load` 方言不可用）——**书面豁免**，仍如实记 `blocked=1` |
| 核对项 | **714**（通过 688 / 失败 26） | — |
| 证据 | **453 份被引用帧**（`evidence/acc8/` 目录 539 个文件） | 分级：mock 58、真实宿主 4、架构门禁 5 |
| 全量测试 | **1927 / 1895 pass / 21 fail / 11 skip**（另一次独立实跑为 1894/22，见下） | 对基线 `014fa6a`（1841/1808/22/11）失败集合 **EXTRA = 0** |
| 全量数字的抖动 | 两次独立实跑差 **1 条** | `--host-error 早返回（-32603）…（AC-63）` 在负载下偶发；独占复跑单文件**通过**，按裁-20r 判负载 flake 并剔除（帧 `AC-53.isolated.host-error-32603-*.log`）。**EXTRA=0 的结论两次都成立，但 tests/pass 会在 ±（0~1）条上波动**，引用时须连带这句 |
| 架构扫描 | purity `exit 0`（45 文件）、`dependencies = 0` | 门禁全绿 |
| 用法块 / 状态机 | `--help` 31 行、`NODE_STATES = 7` | 逐字未变 |
| Done 七项 | **2 PASS / 5 FAIL**（独立终验第 2 轮判定；PASS 第 3、7 项） | 见 `final-verification.md` |

**一句话能力结论**：daemon 崩溃后能按检查点续跑——已完成节点不重跑、轮次不归零、会话按 `resume → load → new` 方言链接回、接不回的按基线 §3.6 降级到「已分配」并把角色放回「可用」；恢复失败时用户能看到原因；`session_policy: reuse` 的角色**第二轮真的复用同一会话**（`会话 复用 mock-sess-…（角色 developer）`）；恢复后**可调度的待执行节点会被继续派发**、依赖未满足的原地不动。

**本轮最强的一条新证据**：AC-60 曾被认为「需求自相矛盾、不可通过」。补上 D-5 第 5 步后，用 `MAESTRO_TEST_RECOVERY_HOLD=after_assign`（挂在**派发之前**）把两件事分开取证——hold 点两节点仍是 `ready`/`blocked`（位置不变），释放后 `node.dispatch` 恰 1 条且属可调度节点。实测 **10/10**，帧 `evidence/acc8/AC-60.then.graph-hold.json.txt` 与 `.then.dispatch.json`。

**最难一条的实测证据**：AC-03（检查点足以恢复「做到哪」）需要在「T-001 done r2 + T-002 running r2」的精确窗口强杀 daemon。此前用固定 `killAfter` 永远杀不准；本轮改为 `retest-slow`（第 4 步 `delayMs=30s`）+ 轮询状态到目标窗口，并修复了「恢复落盘 CAS 冲突被静默放弃」的产品缺陷后，实测 **33/33 全绿**，帧 `evidence/acc8/AC-03.then.instance-log.txt` 可见 `恢复：检查点 … 跳过 1 个已完成节点 · 轮次 2/2`。

## 1 交付物

| 类别 | 内容 |
|---|---|
| 产品代码 | `src/core/orchestrator.js`（phase 投影、`transit` 六组合法迁移、六步对账、恢复摘要、`continueRecovery`、`selectReusableSession`、恢复 CAS 重试）、`src/adapter/acp-client.js`（load 方言透传）、`src/cli/labels.js`（+134 行文案，中文唯一来源）、`src/cli/render.js`（+261/-5，10 个新渲染器）、`src/registry/role-schema.js` / `asset-write.js` / `role-instances.js`、`src/cli/roles.js` / `main.js` |
| 依赖 | **零新增**（`dependencies` 键数 = 0，与基线一致） |
| 测试与夹具 | `test/wp13/**`（101 例：检查点 / 方言 / 恢复启动 / 会话复用 / **复用派发接线** / 失败区分 / 交接恢复 / CLI 恢复）、`test/fixtures/recovery-driver.mjs`（637 行）、`mock-acp-agent.js`（+324 行四组能力广告 + 9 个行为开关）、`recovery/human-node-state.json` / `graph-timeout.json` |
| 验收脚手架 | `probe/acc8-f-lib.mjs` / `acc8-f-common.mjs` / `acc8-f-run.mjs` / `acc8-f-final.mjs`、`probe/acc8-cases/AC-01..67.mjs`（**67 条可复跑用例**）、`probe/acc8-realhost.mjs` |
| 验收产物 | `evidence/acc8/`：539 个文件（453 份被引用帧）、`_acc8-f-results.jsonl`（67 条）、`_acc8-f-summary.json`、`_acc8-f-blockers.md`（含书面豁免处置结论）、`AC-53.diffset.txt`、`probe/i18-s2/batch7-isolated-rerun.txt`（12 条独占复跑台账） |

## 2 AC 逐条判定

口径：**通过 = 该 AC 全部核对项为真**；`不通过` 保留原始期望值与实测值，未删除、未放宽（详见 `evidence/acc8/AC-XX.part.md`）。

| AC | 标题 | 判定 | 核对 | 证据分级 |
|---|---|---|---|---|
| AC-01 | 九个节点位置在用户可见层对得上 | **通过** | 22/22 | mock 实测 |
| AC-02 | 检查点随每一件进展推进 | **通过** | 8/8 | mock 实测 |
| AC-03 | 检查点内容足以恢复「做到哪」 | **通过** | 33/33 | mock 实测 |
| AC-04 | 检查点写失败时用户看得到，运行不中断 | **通过** | 9/9 | mock 实测 |
| AC-05 | 检查点缺失但实例记录完整时按实例记录恢复 | **通过** | 10/10 | mock 实测 |
| AC-06 | 实例记录不可读时不从检查点静默重建 | **通过** | 9/9 | mock 实测 |
| AC-07 | 重启后轮次不重置 | **通过** | 10/10 | mock 实测 |
| AC-09 | 回流中途 kill daemon，重启后从检查点继续 | **通过** | 9/9 | mock 实测 |
| AC-10 | 恢复摘要一行说清「从哪来、跳过多少、第几轮」 | **通过** | 9/9 | mock 实测 |
| AC-11 | 挂起实例重启后仍挂起 | **通过** | 9/9 | mock 实测 |
| AC-12 | 升级节点重启后仍是已升级 | **通过** | 9/9 | mock 实测 |
| AC-13 | 失败节点重启后不自动重跑 | **通过** | 13/13 | mock 实测 |
| AC-14 | 待校验节点恢复只重新核对，不重放会话 | **通过** | 12/12 | mock 实测 |
| AC-16 | 显式 core stop 仍是已中断，不自动恢复 | **通过** | 11/11 | mock 实测 |
| AC-17 | 恢复失败时用户看到原因 | **通过** | 9/9 | mock 实测 |
| AC-18 | 恢复幂等：重复启动不重复推进 | **通过** | 8/8 | mock 实测 |
| AC-19 | resume 方言：广告 resume 时走不回放 | **通过** | 9/9 | mock 实测 |
| AC-20 | load 方言：广告 load 时走回放且不重复投递 | **通过** | 10/10 | mock 实测 |
| AC-21 | new 方言：两种都不支持时新建并只重发当前轮 | **通过** | 10/10 | mock 实测 |
| AC-22 | resume 失败时回退 load，且每一步可见 | **通过** | 10/10 | mock 实测 |
| AC-24 | resume 成功也不重放已完成节点 | **通过** | 10/10 | mock 实测 |
| AC-25 | 真实 DSH：只广告 resume、不广告 load，恢复走 resume | **通过** | 13/13 | 真实宿主实测 |
| AC-26 | 真实 DSH：重启不重复已完成节点 | **阻塞** | 5/5 | 真实宿主实测 |
| AC-27 | 第三方 load 方言：真实可用则真验，否则阻塞 | **阻塞** | 2/3 | 真实宿主实测 |
| AC-28 | 角色 busy 且会话不可恢复 → available | **通过** | 10/10 | mock 实测 |
| AC-29 | 角色 busy 且会话可恢复 → 保持 busy | **通过** | 8/8 | mock 实测 |
| AC-30 | available / cooldown / inactive 不受恢复影响 | **通过** | 11/11 | mock 实测 |
| AC-32 | delivered 未 accepted → pending 并重投 | **通过** | 9/9 | mock 实测 |
| AC-33 | 已 accepted 的交接包不重投 | **通过** | 9/9 | mock 实测 |
| AC-34 | consumed / rejected / expired 恢复后不改 | **通过** | 10/10 | mock 实测 |
| AC-35 | 重投成功后回到已投递 / 已接受 | **通过** | 7/7 | mock 实测 |
| AC-36 | 连接线聚合在恢复实例的图上可见 | **通过** | 12/12 | mock 实测 |
| AC-38 | escalate 节点保持 escalated | **通过** | 10/10 | mock 实测 |
| AC-39 | failed 节点保持 failed | **通过** | 9/9 | mock 实测 |
| AC-40 | suspended 实例内全部节点保持原状 | **通过** | 12/12 | mock 实测 |
| AC-41 | subworkflow 节点在恢复中保持不透明 | **通过** | 13/13 | mock 实测 |
| AC-44 | 运行慢：不重建会话 | **通过** | 15/15 | mock 实测 |
| AC-46 | 运行慢且未声明超时 → 继续等待，不擅自失败 | **通过** | 13/13 | mock 实测 |
| AC-47 | 崩溃与运行慢的两类提示不混用 | **通过** | 17/17 | mock 实测 |
| AC-48 | fresh 默认：每任务新会话 | **通过** | 9/9 | mock 实测 |
| AC-49 | reuse：同一角色第二轮复用空闲会话 | **通过** | 7/7 | mock 实测 |
| AC-50 | reuse 不跨实例 | **通过** | 7/7 | mock 实测 |
| AC-51 | 角色配置可见，非法值被拒 | **通过** | 16/16 | mock 实测 |
| AC-52 | 非恢复路径的三条主链不变（基线 014fa6a） | **通过** | 12/12 | 架构门禁实测 |
| AC-53 | 全量测试回归门禁：失败集合差集为 0 | **通过** | 4/4 | 架构门禁实测 |
| AC-54 | 架构纯净：31 词扫描 exit 0、零依赖 | **通过** | 8/8 | 架构门禁实测 |
| AC-55 | 不新增 CLI 命令，用法块不变 | **通过** | 9/9 | 架构门禁实测 |
| AC-56 | I1.7 已合入：恢复实现不依赖 worktree / 产物隔离（按裁-12 重判） | **通过** | 6/6 | 架构门禁实测 |
| AC-57 | 真实宿主隔离：不动用户 ~/.dsh | **通过** | 10/10 | 真实宿主实测 |
| AC-59 | 恢复前已分配的节点保持已分配并重新派发 | **通过** | 11/11 | mock 实测 |
| AC-60 | 待执行节点恢复后保持原位置，依赖不变 | **通过** | 10/10 | mock 实测 |
| AC-61 | 已构造未投递的交接包恢复后继续投递 | **通过** | 9/9 | mock 实测 |
| AC-64 | 重建失败 / 宿主不可达 → 角色不可用，恢复后回到可用 | **通过** | 10/10 | mock 实测 |
| AC-65 | reuse 但没有空闲会话 → 新建，不报错 | **通过** | 7/7 | mock 实测 |
| AC-66 | reuse 不跨宿主、不复用正在服务其他节点的会话 | **通过** | 13/13 | mock 实测 |
| AC-31 | 降级后重新调度，角色回到 busy | **通过** | 8/8 | mock 实测 |
| AC-08 | 已完成节点不重放 | **通过** | 9/9 | mock 实测 |
| AC-15 | 旧实例无检查点且模板未知 → 已中断并提示新建 | **不通过** | 9/10 | mock 实测 |
| AC-23 | 三种方言都失败时按 §3.6 降级 | **不通过** | 8/10 | mock 实测 |
| AC-37 | human 节点保持 running，等待人工 | **不通过** | 9/10 | mock 实测 |
| AC-42 | 会话进程崩溃：重建并重试当前轮 | **不通过** | 13/15 | mock 实测 |
| AC-43 | 会话重建失败 → 升级人工 | **不通过** | 13/14 | mock 实测 |
| AC-45 | 运行慢 + 节点超时 → 记超时失败并升级人工 | **不通过** | 14/15 | mock 实测 |
| AC-58 | 用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成 | **不通过** | 9/16 | mock 实测 |
| AC-62 | 重投连续失败 → 已过期并升级 | **不通过** | 2/9 | mock 实测 |
| AC-63 | 重建后的会话再次崩溃 → 直接升级，不再重建 | **不通过** | 15/16 | mock 实测 |
| AC-67 | 角色恢复后既无可用会话也无可调度节点 → 保持可用 | **不通过** | 7/9 | mock 实测 |

## 3 验收中发现并修复的缺陷

### 3.1 产品缺陷（6 处，均为主控亲修 + 回归单测）

| # | 现象 | 根因 | 修法 | 复验 |
|---|---|---|---|---|
| D-1 | 适配器无方言原语时实例被误判「已中断」 | `recoverSessionEntry` 在 `initializeAdapterOnly` 已成功（宿主可达）后仍返 `host_unreachable / unavailable:true` | 改返 `no_dialect / unavailable:false`，走会话级降级（节点 `running→assigned`、角色 `available`） | `wp4` 37/37 |
| D-2 | `load` 方言永不可达（AC-20/22 红） | `initialize()` 只保留 `sessionCapabilities`，丢掉顶层 `loadSession` 标志 → `canLoad` 恒 false | 归一化时把顶层标志并入 `capabilities` | AC-20 6/10→**10/10**、AC-22 →**10/10**；`dialect.test.js` 16/16 |
| D-3 | 三方言全失败时实例被中断 | `all_dialects_failed` 返 `unavailable:true`，被当宿主不可达 | 改 `false`，按 BR-22 走会话级降级 | AC-23 关键 Then 全达成 |
| D-4 | 连接线渲染出 `tester→developer` | `main.js` 把角色 **id** 直接传给 `formatHandoffDirection`，漏了 `roleLabel()` | 补 `roleLabel()` 转换（中文仍只在 `labels.js`） | AC-32 8/9→**9/9** |
| D-5 | 「恢复失败：；实例已中断」原因为空 | `markInterrupted` 只写 `detail.note`，CLI 从 `detail.reason ?? code` 取值为空 | 新增可选 `extraDetail`，`fatal` 写入 `detail.reason` | AC-17 8/9→**9/9** |
| D-6 | **恢复落盘 CAS 冲突被静默放弃** | `recoverInstance` 末尾 `saveState(expectedState)` 一旦冲突就 `return { ok: false }`——不写摘要、不标中断、不写原因；用户看到「运行中」，实例实际从未恢复（违反 BR-12） | 冲突时重载磁盘快照、用新 `rev` 重算恢复记录再落盘（≤2 次）；仍冲突则 `markInterrupted` **显式中断**并给可见原因 | AC-03 29/33→**33/33**、AC-09 →**9/9**、AC-24 →**10/10**、AC-08 →**9/9**；`recovery-boot.test.js` 17/17 |

### 3.1b 返工落地（2 条产品缺口，S4 后按用户裁决补齐）

| # | 缺口 | 落地内容 | 复验 |
|---|---|---|---|
| D-7 | **AC-49 reuse 派发未接线**（原：核心零处读 `session_policy`、`buildSession` 无 `roleId`、`createAdapter` 强制 `newSession`） | ① CLI 按源资产读显式 `session_policy` → `run.start` → `state.sessionPolicies`（不进 checkpoint）；② `buildSession` 补 `roleId` / `instanceId` / `servingNodeId` / `reused`；③ 派发时 `reuseCandidate()` + `attachReusableSession()`（`initializeAdapterOnly` + `resumeSession`/`loadSession`，失败静默回退 `new`）；④ 命中写 `session.reuse` → `会话 复用 {id}（角色 {id}）` | AC-49 **4/7→7/7**、AC-65 7/7、AC-66 13/13；新增 `test/wp13/session-reuse-dispatch.test.js` 5/5 |
| D-8 | **AC-60 D-5 第 5 步只做一半**（`continueRecovery` 只续派 assigned / created / redeliver，漏 pending-ready） | `recoverInstance` 收集 `nodePosition==='ready'` 的 pending 节点进 `plan.ready`；`continueRecovery` 在其余步骤之后派发，且**派前重读磁盘确认仍是 pending**（防 redeliver 已派发的节点被二次派发） | AC-60 **6/8→10/10**；`recovery-boot.test.js` 17/17、`handoff-recovery.test.js` 6/6 |

### 3.2 用例与夹具缺陷（纠正，非放宽）

| # | 问题 | 处理 |
|---|---|---|
| U-1 | AC-07 把需求机检 `maxRounds===3` 改成「正整数」凑通过 | 收紧为「恢复行分母 === 内建模板真值 2」，不放宽、不伪造 3 |
| U-2 | AC-22/23 把 `fallback` 当事件顶层字段（实为 `detail.fallback`） | 修正字段路径 |
| U-3 | AC-08 C07 绑死「崩溃前 round===1」（旧固定窗口的错误现场） | 改为语义断言「崩溃时 running 且 round≥2，恢复后不回退」 |
| U-4 | `driveRecovery` 硬编码 `backflow`，窗口窄到抓不住「T-002 第 2 轮执行中」 | 新增可选 `{ scenario, window }`（缺省行为逐字不变），AC-03/08/09/24 改用 `retest-slow` + 精确窗口 |
| U-5 | AC-26 在**空集**上判「产物未变 ✓」 | 把该断言移入非空分支；空集只记 `block`，不产生通过记录 |
| U-6 | AC-56 仍留全仓 `grep=0`，与裁-12 的 diff 口径冲突 | 改为「全仓命中数 === 基线值 2（不新增）」，仍拒绝任何新增命中 |
| U-7 | AC-49 的夹具按「一次派发一条会话记录」写死 `devSessions.length===1`，与同条「round 1 / round 2 都在」互斥 | 改为**去重后会话 id 数 = 1**（需求原文「两轮会话 id 相同、`session/new` 只 1 次」的等价机检），round 1/2 各自存在的断言保留 |
| U-8 | AC-65 / AC-66 原靠「复用行恒为 0」（派发未接线时的恒真观测）判通过 | Given 改由 `test.dispatch` 接缝 + 预置 `state.json` 构造（thinking / 正服务他节点 / 跨宿主），走真实 `dispatchInState`；撤销恒真断言，判据按需求原文 |
| U-9 | `test/wp9/i19-regression.test.js` 的 AC-24 冻结「会话发射点 ≤13、白名单 9 项」，被 I1.8 的 `session.reuse` 撞红 | 上限 13→14、白名单 +1，并把新增项**单列**为「`session.reuse` 写入点恰 1 处」；既有 9 项与 `execution.summary` 恰 1 处的断言原样保留 |
| U-10 | `test/wp13/recovery-boot.test.js` 的 AC-60 断言「恢复后 phase 完全不变」，与 D-5 第 5 步（派发）冲突 | 拆成两步：hold 点断言位置不变、release 后断言可调度被派发且阻塞节点不动 |

### 3.3 证据分级

- **mock 实测** 58 条：夹具 / mock ACP 实跑；
- **真实宿主实测** 4 条（AC-25 / 26 / 27 / 57）：隔离 `DSH_HOME`、真实 DSH `0.2.2-rc.5`；
- **架构门禁实测** 5 条（AC-52~56）：纯净扫描 / 零依赖 / 三主链 / 全量回归。

## 4 门禁与复现

```bash
# 1) 全量测试（本轮实测 1927 / 1895 pass / 21 fail / 11 skip；失败集合 ⊆ 基线 22 条，EXTRA = 0）
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"

# 2) 架构纯净扫描（预期 exit 0，45 文件零命中）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"

# 3) 零依赖（预期 0）
node -e "console.log(Object.keys(require('./package.json').dependencies || {}).length)"

# 4) 用法块与状态机（预期 31 行 / 7 项）
node bin/orch.js --help | wc -l
node -e "import('./src/core/state-machine.js').then(m=>console.log(m.NODE_STATES.length))"

# 5) 单条 AC / 全量清单（证据落 evidence/acc8/）
node probe/acc8-f-run.mjs AC-03
node probe/acc8-f-run.mjs --list          # 67/67 就绪

# 6) 重算汇总（summary.json / blockers.md）
node probe/acc8-f-final.mjs
```

> **门禁抖动说明**：`AC-53`（全量回归门禁）的判据是「新增失败集合为空」。按裁-20r，对**本次实际出现**的每条新增红逐条独占复跑（`--test-concurrency=1` 单文件）：单跑通过判负载 flake 并附独立帧，仍红才计入差集。**不设任何白名单**（终验指出预置名单等于预赦）。本轮最终实跑 **EXTRA = 0**，帧 `AC-53.diffset.txt` / `probe/i18-s2/acc53-isolated.txt`。
> 该分支不是死代码：末次 AC-53 实跑里确实出现过 1 条新增红（`--host-error 早返回（-32603）…（AC-63）`），
> 独占复跑单文件 **通过** → 判负载 flake 并剔除（帧 `AC-53.machine.AC-53.isolated.host-error-32603-attempts-1AC-63.log`），
> 「剔除 flake 后的差集」为空、本条判通过。也就是说「核了才剔」这条路径是被真实走到的。

## 5 未达项、阻塞与边界

> 本节按模板 §4.5 的分工拆开写，避免把「未完成」混进「不影响结论」：
> **5.1 是 10 条未达 AC（直接阻断 Done#1/#2，绝不算「不影响结论」）**；5.2 是 2 条阻塞（用户书面豁免，但**未改判通过**、计数仍为 2）；
> 只有 5.3 观察项与 5.4 边界才属「不影响结论」。

### 5.1 10 条不通过（逐条归口，阻断 Done）

> 归口前先做了「独占复跑」（`probe/i18-s2/batch7-isolated-rerun.txt`）：批次里 12 条未通过中，**AC-08 / AC-31 单跑全绿**（负载 flake，按复跑结果定为通过），其余 10 条单跑仍红、判定不变。

| AC | 核对 | 归口 | 具体原因 | 处置 |
|---|---|---|---|---|
| AC-15 | 9/10 | 需求矛盾 | 机检要求「`state.json` sha256 不变」与「转为 `interrupted`」不可兼得（中断必重写 state） | 改需求或书面豁免 |
| AC-23 | 8/10 | 需求矛盾 + 产品行为 | Then「实例不进入运行中」与 BR-22 降级 + D-5 继续调度冲突；另三方言失败路径在真 factory 下会被「create 预开会话」短路 | 改需求；预开会话列观察项 |
| AC-37 | 9/10 | 需求 / 夹具 | `graph --format text` 只渲染图声明节点，夹具 `T-004` 不在内建 `code-loop` 图内 | 改需求或换夹具图 |
| AC-42 / 43 / 45 / 63 | 13/15、13/14、14/15、15/16 | 需求文案 | Then 逐字要求「节点 **T-003** · 轮次 **2/3**」，内建图无 T-003 且 `maxRounds=2`（I1.1 逐字红线） | 改需求文案为「按实际节点 / 轮次」 |
| AC-58 | 9/16 | 夹具缺口 | `e2e` 恢复后只等 `waitMs=5000`，未到「完成 / 升级」终态 | 延长观察窗（补齐前不改判） |
| AC-62 | 2/9 | 夹具缺口 | 产品侧「3 次失败 → expired → 升级」**已实现**（`orchestrator.js:2039~2062`）并有 `wp13/handoff-recovery.test.js` 单测覆盖；mock 缺「重投前连续 3 次确定性失败」端到端接缝 | 补 mock 接缝 |
| AC-67 | 7/9 | 需求矛盾 | Given「服务节点都已终态」命中 `doneCount>0 → cooldown`（I1.5 契约），与 Then「显示可用」冲突 | 改需求 |

**已消除的 3 条**（S4 后返工）：AC-49（→7/7，D-7）、AC-60（→10/10，D-8）、AC-53（→4/4，裁-20r）。

> **AC-45 的 4 条曾经是假阴性**：独立终验第 2 轮查证 `events` 止于 seq 31（`session.timeout`），`state.updatedAt` 只比它晚 5ms，
> 「节点已升级 / 实例已挂起 / escalations+1 / reasonCode=timeout」这 4 条升级与挂起事件（#32~#35）在快照之后才落盘；
> 同一用例后面读的 `status` 已显示全部达成。已把读点从「timeout 事件出现即读」改为「等 `suspended` + `escalations≥1` 落定再读」
> （等待有上限 20s，落不下来仍判红，**期望值一个未改**），复跑 **14/15**，只剩 C05 的逐字文案「（节点 T-003 · 轮次 2/3）」不成立。

### 5.2 2 条阻塞（用户裁决：书面豁免）

| AC | 阻塞事实 | 豁免处置 | 留痕 |
|---|---|---|---|
| AC-26 | 真实 DSH 跑通、已完成节点无第二次 `node.dispatch` 已实测；但机检锚点 `workspace/artifacts/**` 在编码闭环实例下**客观不存在**（产物在 I1.7 `worktrees/` 与 `stage/`，强杀窗口内 `stage/` 为空） | 保留 `blocked=1`，**不用空集/替代目录冒充通过**；按用户书面裁决豁免补证据 | `AC-26.part.md`（5/5）、`AC-26.then.*` 原始帧、`_acc8-f-blockers.md` 处置结论 |
| AC-27 | `dsh-acp-server@0.14.4` 安装成功但入口启动即抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME … Received protocol 'c:'`（本机只有 Electron 形态 DSH，无 `dsh` CLI） | 保留 `blocked=1`，**不用夹具冒充真实方言面**；按用户书面裁决豁免补环境 | `AC-27.probe.third-party-boot.txt` 原始 stderr、`_acc8-f-blockers.md` 处置结论 |

### 5.3 观察项（不影响结论，但需登记）

> 以下只列**不影响结论**的项。任何未达 AC 都不出现在本小节。

1. **方法学**：AC-20/23 的部分断言通过「受控 `state.json` 起手 + 产品核心执行恢复动作」取证，方言选择与降级动作仍由产品完成，但 Given 的可信度低于真实跑图。
2. **`ROLE_DIFF_KEYS` 未纳入**、`role show --format json` 不加键（裁-11a/11b）。
3. **AC-49 模板占位名与实际填充不符**（需求示例用角色 id，`labels.js` 模板占位名是「角色中文名」，裁-11c）。
4. **真实宿主写 cwd 内文件不触发 `session/request_permission`**（与需求 §3.3#7 的描述不符）。
5. **宿主版本**：需求记 `0.2.2-rc.1`，实测 **`0.2.2-rc.5`**（裁-13f，实测优先）。
6. **`test/wp11/role-schema.test.js` 标题**仍写 "five optional ones"，实际 6 个可选键（断言已更新，标题文案未改）。
7. **`recovery.handoff` 事件**显示 `created→delivered`，而 `handoff list` 仍显示「已构造」——事件与视图存在一拍差（AC-58 记录）。
8. **提交粒度**：`d054ca2` 把产品修复与 435 份证据帧放在同一个 commit（模板要求功能 commit 不夹带 `evidence/**`）——已发生，无法追溯拆分。本轮已按「`fix` / `test` / `docs+evidence`」三段提交，`fix` 与 `test` 的 evidence 均为 **0** 个文件。
9. **三主链逐字结论是概率性的**：AC-52 独立复跑首次 11/12（`test/wp9` 的 code-loop 链偶发多出「已升级/已挂起」行），单跑 8/8 全绿、整条重跑 12/12。即「三主链逐字不变」在负载下有小概率假红，**不能单次跑就下结论**。
10. **`.gitattributes` 的证据树空白豁免**（裁-20u）：从 `evidence/**/*.log` 扩到 `docs/iterations/**/evidence/**` 一条规则。它只关 `git diff --check` 的告警、**不改工作树与提交里的字节**，故不构成验收判据放宽；理由是证据帧里「`原因 ` 后为空值」这类尾空格本身就是产品真实输出。
11. **跨迭代证据污染已根治**（裁-20v）：`test/wp11/perf.test.js` 原先把本机实测耗时直接写进 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`，每次全量跑都会改写 I1.4 已收口的证据。现默认写系统临时目录，需显式 `NFR_EVID_DIR=…` 才写回仓库。
12. **AC-58 的证据不同源**（未修）：C01~C13 用 e2e 根（无 human 节点），C14~C16 另起一个 human 预置根，两套证据拼在一张表，未满足 Given 的「一个独立项目根」。已记入 `_acc8-f-blockers.md` 处置表，需用户授权后重做夹具。

### 5.4 边界

- I1.7 已合入 main；I1.8 不依赖 worktree / 产物隔离（`diff` 口径零新增，AC-56）。
- 对照基线统一为 **I1.8 开工点 `014fa6a`**（1841/1808/22/11），红名单 `probe/i18-s2/baseline-014fa6a-reds.txt`。
- 全量测试必须注入 `NODE_ENV=test`（`test/wp13/graph-stream.test.js` 的 pulse 接缝依赖它）；漏注会造成 8 条 404 假红。

## 6 与前序迭代的关系

- **复用**：I1.1 内建三图（`single` / `task-loop` / `code-loop`）与 `USAGE_LINES` 25 行逐字未变；I1.2/I1.3 的派发与退出码语义未变；I1.5/I1.6 的 `role show` 六行基线未变（仅在显式声明 `session_policy` 时追加一行）。
- **改动契约**：`state.json` 新增 `phase`（仅 `pending`/`running` 承载）、`recovery` / `recoveredAt` / `coreGeneration`；`checkpoint` 严格 9 字段（不得扩）；`graph --format json` 在恢复实例上追加 `recovery` / `connections`，非恢复实例仍 11 键且顺序不变。
- **回归保证**：`transit()` 仍是唯一迁移入口（同一次 CAS 落 `phase`）；事件先落盘再广播；中文唯一来源 `labels.js`；全量差集对照 `014fa6a`，EXTRA = 0。

## 附录 命令速查

```bash
node probe/acc8-f-run.mjs --list             # 67 条用例就绪情况
node probe/acc8-f-run.mjs AC-03              # 单条
node probe/acc8-f-run.mjs --batch all        # 全量（约 30 分钟）
node probe/acc8-f-run.mjs --batch range:AC-01..AC-10
node probe/acc8-f-final.mjs                  # 重算 summary / blockers
git log --oneline 014fa6a..HEAD              # 本迭代提交
```
