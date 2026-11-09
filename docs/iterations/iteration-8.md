# I1.8 任务拆分与文件级契约（实例管理器完整 + 崩溃恢复 + ACP 恢复方言）

> 需求依据：`docs/iterations/iteration-8/requirement.md` **v3**（1419 行；67 条 AC / 54 条 BR / 8 条 NFR / M-1~M-8 / C-01~C-18 / 附录 A-1~A-10 · B-01~B-17 · C · D-1~D-13）——**唯一事实来源**。
> 上游实现：集成版 main `d4b0f94`（I1.4+I1.5+I1.6 合入）、`src/core/orchestrator.js`（4800+ 行**超集文件**）、`src/daemon/{lifecycle,server}.js`、`src/adapter/acp-client.js`、`src/persistence/{instance-store,paths,atomic-write}.js`、`src/cli/{main,labels,render,roles,skills,workflows}.js`、`src/registry/{role-schema,asset-write,index}.js`、`src/templates/index.js`、`src/core/{state-machine,status-text,advance,event-bus}.js`、`test/fixtures/{code-loop-driver,task-loop-driver,purity-check}.mjs`、`test/fixtures/mock-acp-agent.js`、`test/wp4/orchestrator.test.js`、`test/wp11/role-schema.test.js`、`bin/orch.js`。
> 评审与理解依据：`docs/iterations/iteration-8/review-round3.md`（第 3 轮总判 **PASS** / 阻断 0 / 建议 0 / DoR 13 条全绿）、`docs/iterations/iteration-8/requirement-understanding.md`（§6 Given 可构造性与「待 S2 实现」接缝清单、§7 回归红线、§8 给 S1 的 7 维度 / 8 冻结点 / 6 并行风险面）、`docs/iterations/iteration-8/decisions.md`（裁-1~裁-5）、`docs/iterations/integration-2026-11-09.md`（集成版 CLI 双 workflow 分流、三主链逐字基线重建遗留 **O-I2**）。
> 骨架依据：`docs/templates/execution-template.md` §1.3（8 节固定骨架）/ §1.4（切分四条硬规则 + WP 五字段）/ §1.5（自检 10 条 + 脚本）/ §2.5（实现期门禁四件套）/ §2.8（裁决留痕）；格式范例 `docs/iterations/iteration-6.md`（**仅取结构与五字段格式，不抄其技术结论**）。
> 基线：分支 `feat/i1.8-instance-recovery`，S0 定稿提交 `760b8a1`；需求 v3 头部自述 HEAD `3f35bfa` 为定稿前 HEAD（如实登记差异，不改写需求）。全量测试基线 **992 条 / 988 通过 / 4 失败**（集成版说明 §4 记 **992 / 987 / 5**，总条数同为 992、通过/失败差 1 条属 Windows 并发噪声）；门禁口径为「与 `origin/main` 失败集合差集 = 0 + 条数只增不减」，**不要求零失败、不写死通过数**。`package.json` 零运行时依赖（`dependencies` 键数 0）。
> 本文档边界：只写任务拆分与文件级契约；不实现代码、不做验收、不改需求正文、不增删 / 合并 / 放宽 AC 与 Then、不把范围内条目挪到范围外、不夹带规划外新能力、不写 probe 脚本、不提交 git。唯一新建文件即本文件，LF 行尾；实跑自检脚本放 `%TEMP%` / 内联 `node -e`，不落仓库。

## 0. 迭代定位、范围与退出标准

**一句话目标**：把「daemon 一崩，实例从头再来」变成「重启后接着上次确认过的位置继续」——新增 `checkpoint/v1` 恢复信封、ACP `resume → load → new` 方言回退链与启动恢复编排，已确认节点不重放、轮次不归零、会话按宿主会说的方言接回、崩溃与运行慢分流，并把「检查点 / 崩溃 / 运行慢 / 复用」变成用户看得见的一句话；非恢复路径的三条主链与既有输出逐字不变、零新增运行时依赖。

**In scope**（逐条对应需求 §1.3 的 8 规划子项 + 3 句验收句 + 2 项工程约束，按纪要 §1.1 落位；需求 §1.3 范围内共 12 项，第 1 项规划在 §1.3 拆成 3 项，第 11/12 项为工程约束而非规划外新能力）：

| # | 规划原文（`index.md:815~822` 逐字） | 需求 §1.3 范围内项 | 需求 §2 落点 | AC 主落点 | 主责 WP |
|---|---|---|---|---|---|
| 1 | 「实例管理器完整：状态机、轮次计数、检查点」 | 1 状态机 / 2 轮次计数 / 3 检查点 | §2.2 | AC-01~07、AC-09、AC-10、AC-14、AC-58~60 | WP-4 / WP-1 / WP-5 |
| 2 | 「ACP 会话恢复方言处理：`session/resume`（不回放）、`session/load`（回放/追加）、`resumeOrCreate` 回退链」 | 4 ACP 会话恢复方言 | §2.3 | AC-19~27 | WP-2 |
| 3 | 「崩溃恢复：daemon 重启后从检查点恢复」 | 5 崩溃恢复 | §2.4 | AC-05、AC-09~18、AC-58 | WP-4 |
| 4 | 「角色实例恢复规则：`busy` 角色会话不可恢复时降级为 `available`」 | 6 角色实例恢复 | §2.5 | AC-28~31、AC-64、AC-67 | WP-4 |
| 5 | 「连接线聚合恢复规则：`delivered` 未 `accepted` 标记为 `pending` 并重投」 | 7 连接线聚合恢复 | §2.6 | AC-32~36、AC-61、AC-62 | WP-4 |
| 6 | 「特殊节点恢复规则：`human` 节点保持 `running`」 | 8 特殊节点恢复 | §2.7 | AC-37~41 | WP-4 / WP-6 |
| 7 | 「会话失败区分：ACP 会话进程崩溃 vs 运行慢」 | 9 会话失败区分 | §2.8 | AC-42~47、AC-63 | WP-4 / WP-5 |
| 8 | 「会话复用策略：`reuse` / `fresh`」 | 10 会话复用策略 | §2.9 | AC-48~51、AC-65、AC-66 | WP-3 / WP-4 |
| — | 验收句 1「回流中途 kill daemon，重启后从检查点恢复且不重复已完成节点」 | §2.2 / §2.4 / §2.10 | §2.10 `:311~314` | AC-07、AC-08、AC-09、AC-10、AC-58 | WP-4 |
| — | 验收句 2「ACP 会话恢复方言正确回退」 | §2.3 | §2.3 `:223` | AC-19~23、AC-25、AC-27 | WP-2 |
| — | 验收句 3「角色实例和连接线聚合正确恢复」 | §2.5 / §2.6 | §2.5 / §2.6 | AC-28~36、AC-61~64、AC-67 | WP-4 |
| — | §1.3 第 11 项「用户可见输出」、第 12 项「兼容与纯净」（工程约束，源自 `index.md:711` 回归红线 / BR-44~46） | §1.3 `:62~63` | §2.10、附录 A、D-11 / D-12 | AC-52~57、AC-10、AC-55 | WP-5 / WP-7 |

> 需求 §1.3.3 登记的「无规划逐字来源、但由基线或前序约束推出」的 6 条 BR、9 条 AC（9 态位置投影、`review` 重新核对、检查点写失败告警、`created` 继续投递、`unavailable` 去向、`assigned`/`blocked`/`ready` 保持）属基线派生，In 范围内一并成立，不是规划外夹带。

**Out of scope**（摘要 13 项，逐项全表见需求 §1.3 `:69~81`，本拆分不把任何范围内条目挪到范围外）：① 依赖 I1.7 的 worktree / 产物类型隔离 / 合并顺序（I1.7 合入后必须重跑本迭代全部 AC）；② 项目工作流运行时实例化 `orch run --workflow`（I1.6 B-01）；③ 真实项目工作流里的 `human` / `subworkflow` 运行时（夹具预置状态验证、子工作流不透明保留）；④ 资产版本锁定（只存锁定图快照，不引入版本号体系，B-02）；⑤ 工作流权限匹配（不新增运行时权限检查，B-03）；⑥ 待审批会话审批上下文恢复（真实 DSH 写 cwd 不触发 `session/request_permission`，只按会话不可恢复降级，B-10）；⑦ 三层日志 / 健康度 / `orch trace show`（I1.9，只写恢复事件）；⑧ 角色流程图 / 连接线图形渲染与推送节流（I1.10a/b，只保证文本与 JSON 可见）；⑨ 人工干预队列 / 托盘通知 / 审批面板（I1.11）；⑩ 预算配额 / 并行度上限 / `max_concurrent_sessions` 派发拦截（I1.12 / I1.7）；⑪ Cursor / WorkBuddy 的真实恢复（阶段二 I2.x）；⑫ 旧格式（v1 / 无检查点且模板未知）的自动恢复（按「已中断」保留，提示新建实例）；⑬ 新增 `orch recover` 之类的命令（恢复在 daemon 启动时自动发生）。

**退出标准**（逐条可判定，含数字或逐字口径）：

1. **67/67 AC 全部通过**，按需求 v3 §3.1 同号 **Then** 逐字判定，不改写 / 不合并 / 不放宽。分面（纪要 §2.3 自洽核算）：真实宿主 3（AC-25/26/27）+ 架构检查 3（AC-54/56/57）+ 混合 1（AC-58）+ 边界 17（AC-11/12/13/15/30/33/34/38/39/40/41/46/50/60/65/66/67）+ 机检 12（AC-01/04/06/07/10/16/36/47/51/52/53/55）+ 夹具 31（AC-02/03/05/08/09/14/17/18/19/20/21/22/23/24/28/29/31/32/35/37/42/43/44/45/48/49/59/61/62/63/64）= **67**；风险 P0 41 + P1 26 = 67；锚点机检 28 + 夹具 36 + 架构检查 3 = 67。每条 AC ≥ 4 个证据文件（state / events / stdout / status 原始帧），结论三档 `通过 / 不通过 / 阻塞` 且带证据分级。
2. **全量测试门禁**：`node --test --test-concurrency=4 "test/**/*.test.js"`；基线 992 条 / 988 通过 / 4 失败（集成版 992/987/5）；判定口径 = **与 `origin/main` 的失败用例名集合差集 = 0 + 条数 `tests >= 992` 只增不减**，不要求「零失败」、不写死通过数；既有噪声（Windows symlink `EPERM`、C 盘路径盘符、临时目录 `EBUSY`）不计新增失败；`test/wp10/perf.test.js` 全量并发偶发 p95 ≤ 50ms 越线按模板 §5#22 先单跑诊断、不许放宽预算或删用例。
3. **既有断言零修改（除 D-9 两行）**：仅 `test/wp11/role-schema.test.js:57` 与 `test/wp4/orchestrator.test.js:480/575/578/580/584~586` 可改；`test/wp4/orchestrator.test.js:588~592`「v1 实例必须一字不改」保持原样；其余 `test/**` 一个字符不动；**改后必红是预期**（M-4 / M-5 打破既有精确断言），不得为保绿弱化功能或扩大改动范围；新增断言一律放 `test/wp13/**`。
4. **架构扫描 exit 0**：附录 D-11 五条命令逐字执行全 `exit 0`；第 4 条输出 `0`（`dependencies` 键数 0）、第 5 条输出 `OK: no CJK`；`$COMMON` 31 词显式 `--forbid` 传全（`DEFAULT_FORBID` 只有 4 词）、`$NOCOORD` 30 词扫 `src/registry`；第 3 条按 I1.6 D-9 **三文件口径** `src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js` 逐字沿用、不得收窄为单文件（裁-2）；`labels.js` / `render.js` / `main.js` 合法持有模板名与角色名，不进第 3 条扫描命令，且不得为让扫描变绿改其注释；`src/core` / `src/daemon` 不出现宿主名分支（如 `if (host === 'dsh')`）。
5. **三条主链逐字回归**：`single` / `code-loop` / `task-loop` 非恢复路径输出与 **集成版 `d4b0f94`** 重建的逐字基线归一化 diff 为空（**不是** I1.6 的 `0cd113b`；I1.6 AC-49 逐字断言不能直接套到集成版，O-I2）；无恢复行 / 检查点行 / 复用行；`USAGE_LINES.length === 25` 且前 8 行逐字、`COMMANDS` 不含 `recover`、`orch recover` 退出码 2；非恢复实例 `instance graph --format json` 仍 **11 个顶层键**且顺序不变；`role show developer` 六行逐字不变；`role list` / `role validate` 计数仍 26 资产 / 16 角色 / 10 技能。
6. **NFR-01~08 逐条可判定**：NFR-01 拉起 daemon 到 `orch status` 显示「运行中」≤ 5s；NFR-02 已完成节点提示 0 次、当前轮最多 1 次重发；NFR-03 检查点写失败运行继续且 `state.json` 仍含最新进展；NFR-04 连续两次强杀/重启恢复摘要事件 = 1 份、已完成节点提示 0 次；NFR-05 非恢复三条主链逐字不变、首屏时间不劣化；NFR-06 `dependencies` 键数 0；NFR-07 恢复 / 检查点 / 崩溃 / 运行慢 / 复用行全是中文句子、`{原因}` 位填中文人话、不出现裸 `SESSION_RESTORE_FAILED` 之类英文码；NFR-08 真实宿主面无 DSH / 无凭据 / 无第三方时判「阻塞」并写清尝试路径。
7. **真实宿主面判阻塞口径**：AC-25 / AC-26 / AC-27 / AC-57 必须在隔离 `DSH_HOME`（`%TEMP%` 新建 + 复制 `~/.dsh/.credentials.yaml` + 用完删除）+ `%TEMP%` 项目根下取证，本机 `command -v dsh` / `dsh-acp-server` 为 `NOT_FOUND` 时一律判「**阻塞**」，**不得用 AC-20 的 load 夹具结果冒充真实面**；「阻塞不算失败，伪通过才是」（模板 §3.4），结项时仍带阻塞须补齐观测路径重判或取得书面豁免，不许带阻塞宣布需求结束。
8. **I1.7 边界与重跑**：当前 `origin/main` 不含 I1.7（AC-56 四锚点：`src/core/worktree.js` 不存在、`grep -R "worktree" src/ | wc -l` = 0、`artifact_type.*dir|merge.*order` 无命中、`docs/iterations/iteration-7/requirement.md` 不存在）；恢复只原样保留现有 `artifactRefs`、不读取不推断 worktree；报告登记「**I1.7 合入后 67 条 AC 全部重跑**」并由 I1.7 产物语义复核恢复规则（BR-47 / C-16 / B-01）。
9. **S0 与流程门禁**：`review-round3.md` 总判 PASS、N-01~N-05 清零、DoR 13/13 全绿、需求头部 v3 = 附录 C 末行 v3；本拆分据此开工，不跳过 S0、不宣布需求结束；实现期每 WP 过 §2.5 门禁四件套，评审 PASS 才进下一批（模板 §0.2）。

> **修订记录**：R1 按 `split-review-round1.md` S-01~S-07 逐项修订（阻断 0），需求 v3 正文零改动；待第 2 轮拆分评审。

## 1. 技术选型（结论 + 被否决项）

> 每个关键决策固定三段：**结论 / 理由 / 被否决方案及原因**。被否决项全局连续编号 `#1~#26`，本节合计 **26 条 / 12 个决策**（见 §1.13 汇总表）。裁决优先级固定（模板 §2.8）：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > M/C 契约清单 > 规划文档 > 代码现状`；代码现状排最后，只说明「以前怎么做」，不是标准。

### 1.1 检查点落盘格式与写点

- **结论**：新增 `src/core/checkpoint.js`，产出单一文件 `<root>/.orch/instances/<id>/state/checkpoint.json`（`schema: "checkpoint/v1"`，在实例目录下**新建 `state/` 子目录**，与 `state.json` 同级，不是并列文件）。形状逐字取附录 D-3 样例（§3.1 全文）。写点固定每次成功 `saveState()` **之后**，顺序「**实例记录 → 检查点 → 事件广播**」（C-03）；`transit()`、轮次写、交接状态写、暂停/恢复/挂起/完成、终态都覆盖；`checkpointId` 单调递增、`rev` 与实例记录一致。原子写复用 `src/persistence/atomic-write.js` 的 `writeJsonAtomic`（临时文件 + rename）。写失败只发一次 `checkpoint.write_failed` 事件（每实例每次运行最多 1 次）、不抛给调用方、不回滚 `state.json`、不阻断事件；`orch run` 订阅到该事件打印附录 A-3 的 `检查点写入失败：…` 行。检查点是「恢复信封」不是第二份真相：不含提示词全文、模型输出、凭据、完整对话历史（C-04）。
- **理由**：基线 §5.2 明确 `state/` 含检查点、M-2 / B-16 要求新建子目录且不改 `state.json` 位置；R-2 / R-10 定「实例记录优先、写失败告警继续」；AC-02/03/04/05/06 逐条可机检；原子写守住 NFR-03 与「不留 `.tmp`」。
- **#1 被否决：把检查点写成第二份完整 `state.json` / 以检查点为主真相** —— 违反 R-2、C-05（实例记录优先）、BR-05；会产生两份可写真相，恢复时 `rev` 冲突无法裁决，AC-06「不从检查点静默重建」当场破。
- **#2 被否决：检查点写失败就停止推进 / 回滚已落盘的 `state.json`** —— 违反 R-10、BR-06、NFR-03、AC-04（退出码仍按原流程 0/4/5）；停止推进反而制造更大中断，回滚会丢已确认进展。

### 1.2 ACP 方言探测与回退链

- **结论**：`src/adapter/acp-client.js` 按附录 D-4 做能力归一化 `canResume = Boolean(sessionCapabilities.resume)`、`canLoad = Boolean(sessionCapabilities.load || initialize.loadSession === true)`；方言顺序固定 `resume → load → new`，`fresh` 策略直接 `new`，`reuse` 策略才尝试前两种（R-4 / BR-17 / C-07）。**只看 `initialize` 能力广告与角色策略，绝不按 `hostId` / 宿主名分支**；`resume` 成功 = 接回但不回放（不得假设宿主记得上一轮），`load` 成功 = 回放/追加（不得再投同一份已完成历史），`new` = 全新会话只重发当前轮（C-08 / C-09 / BR-18~20）。每次回退写一条 `recovery.dialect` 事件，`detail` 含 `{from, to, reason}`，日志逐字出现 A-3 的 `恢复：session/resume 失败，回退 session/load（回放）` 等行，绝不静默降级（BR-21）。`session/load` 成功后不重投已完成历史；`resume` 成功后不假设历史存在。真实宿主事实（DSH 内置 acp 广告 `{close, list, resume}` 无 `load`；第三方 `dsh-acp-server` 0.14.4 广告 `loadSession: true`）由 AC-25/27 取证，取不到判阻塞。
- **理由**：规划 816 + C-07/C-08/C-09 逐字；AC-19~27 每种方言各一条夹具；BR-23 明写「适配器不得按宿主名分支」；附录 D-4 已给可执行伪代码。
- **#3 被否决：按 `hostId === 'dsh'` / 宿主名选择方言** —— 直接违反 C-07 / BR-23 / D-4 `:1280`；新增宿主就要改分支，AC-54「`src/core` / `src/daemon` 不出现宿主名分支」与零 CJK/纯净口径连带破。
- **#4 被否决：回退时静默 `new`、不写 `recovery.dialect` 事件 / 不点名从哪种方言退到哪种** —— 违反 BR-21、AC-22/25、需求 §1.2 指标 4「方言回退链可见性 100%」。
- **#5 被否决：`resume` / `load` 成功后把已完成节点的历史重新 `session/prompt` 一遍** —— 违反 C-08 / C-09 / BR-08 / BR-18 / BR-19；AC-20「`session/prompt` 0 次」、AC-24「已完成节点提示 0 次」当场破，BR-08「不重放已完成节点」是基线 §3.6 末句。

### 1.3 `resumeOrCreate` 结构

- **结论**：`resumeOrCreate({ cwd, sessionId, policy = 'fresh', capabilities })` 成功返回 `{restored, dialect, attempts}`（`restored:true` 且 `dialect ∈ {resume, load}`，或 `restored:false, dialect:'new'`）；全失败返回 `{ok:false, code:'SESSION_RESTORE_FAILED', attempts}`。`attempts` 逐次记录 `resume` / `load` / `new` 的失败原因，供调用方落 `recovery.dialect` 事件与 A-3 回退行；`newSession` / `prompt` / `cancel` / `closeSession` 的签名与行为**保持不变**，`fresh` 路径仍走 `newSession`（M-3）。
- **理由**：D-4 伪代码逐字给出返回结构；理解纪要 §8.2 把它列为 B/C 维度共用的「契约先冻结点」第 3 条；结构冻结后 WP-4（调用方）与 WP-2（适配层）才能并行，且 AC-19~23 可按 `attempts` 机检调用顺序。
- **#6 被否决：返回裸布尔 / 直接抛异常让调用方自己猜用了哪种方言** —— 无法产出 A-3 的 `session/resume（不回放）` / `session/load（回放）` / `session/new（新建）` 逐字行，AC-19/20/21 的 `session/*` 调用次数断言失去可观测载体；C-10「恢复失败不静默假装仍在运行」也无法落地。
- **#7 被否决：吞掉 `attempts`、不把失败原因交给调用方落事件** —— 违反 BR-21「每一次方言回退必须在日志里点名」与 D-4 `:1278`「每次回退写一条 `recovery.dialect` 事件」；AC-22 的 `resume → load` 顺序无法复核。

### 1.4 会话复用判定

- **结论**：复用判定收敛为 `src/core/orchestrator.js` 的一个**新增导出纯函数** `selectReusableSession(sessionList, { instanceId, roleId, hostId, nodeId })`（由超集文件唯一负责人 WP-4 实现，WP-3 通过 §2.3 契约调用）：仅在**同一实例、同一 `roleId`、同一 `hostId`、会话 `state === 'idle'`、且 `servingNodeId` 为空或等于当前节点**时返回该会话；角色 `status ∈ {available, cooldown}` **只用于筛选候选角色、不当作会话态**（C-15 / BR-42）。`fresh`（缺省）每次 `newSession`；`reuse` 无空闲会话则新建并继续（AC-65）；跨实例 / 跨宿主 / 正在服务其他节点一律不复用（AC-50 / AC-66）。`session_policy` 缺省 `fresh` **只在派发选择时生效，加载器不得把缺省值注入角色对象用于渲染**（D-13 / A-5）。
- **理由**：规划 822 + 基线能力域 3（`index.md:356`）；C-15 / D-13 逐字给判定条件；把纯函数导出可让 WP-3 的 `session-reuse.test.js` 用内存对象独立验收（§1.4 规则 2），又守住「orchestrator.js 唯一负责人」（规则 1）。
- **#8 被否决：把角色 `status`（`available` / `cooldown` / `busy`）当会话态、或复用 `thinking` / `tool_running` 会话** —— 违反 C-15「角色状态只用于筛选候选角色，不当作会话态」、D-13「找 `state === 'idle'`」；会与四层状态模型（会话 6 态 / 角色 6 态）混用，AC-49/65/66 的判定失去唯一性。
- **#9 被否决：跨实例 / 跨宿主复用，或复用 `servingNodeId` 非空的会话** —— 违反 BR-43 / C-15 / AC-50 / AC-66；跨宿主会话句柄不可移植，占用会话并发复用会串台。
- **#10 被否决：加载器把缺省 `fresh` 写回角色对象并让 `role show` 无条件显示复用行** —— 违反 D-13 `:1412` 与 A-5「仅在源对象显式声明 `session_policy` 时输出」；AC-48「`role show developer` 与 I1.6 基线逐字节相同」、AC-51「未声明不显示」当场破，改变 26 个内置资产的只读渲染。

### 1.5 崩溃与慢的区分

- **结论**：按附录 D-8 / C-12~14 两套判据与两套处置，**`stopReason` 不参与判定**。崩溃判据 = 会话已建立后 transport `onExit` 或 `prompt` 返回 `DSH_SPAWN_FAILED` / `IPC_CLOSED`；处置：写 `session.crash` 事件 + A-6 行 → 按角色策略重建（`fresh` → `newSession`，`reuse` → `resumeOrCreate`）→ 重建成功重发当前轮 prompt 一次、**轮次不变** → 重建失败 `escalated`（`reason: session_crash`）、实例 `suspended`、角色按 C-18 显示「不可用」；**同一派发最多重建一次**，再次崩溃直接升级、不再重建（AC-42/43/63、BR-37/38/52）。运行慢判据 = 会话进程仍存活、状态 `thinking` / `tool_running`、距 `lastEventAt` 超过 `SLOW_MS`（默认 10 分钟，`MAESTRO_TEST_SLOW_MS` 缩短）没有 `session/update`；处置：写 `session.slow` 事件一次 + A-6 行、**不重建**、节点声明了 `timeout`（秒）才在超时后写 `failed_reason: timeout`（本迭代新增落盘字段，语义见 `index.md:164`）并升级人工，未声明只提示继续等待（AC-44/45/46、BR-39/40、R-7）。既有 `STALL_MS = 10s` 只用于显示「无新事件」，不用于失败判定。两类提示逐字互斥（AC-47）。会话升级人工沿用基线既有「已升级」红色圆点、随节点「已升级」派生，**不新增会话状态取值、不新增 CLI 输出**（裁-3）。
- **理由**：规划 821 + 基线能力域 6（`index.md:568`）；C-12 明写「`stopReason` 不参与两者判定」；AC-42~47/63 逐条把两类提示与处置钉死；R-7 / B-08 定「内建三图无 `timeout` 不擅自失败」。
- **#11 被否决：用 `stopReason` 判成败 / 崩溃与慢共用一套「会话 执行中 · 无新事件」提示** —— 违反 C-12 / BR-36 / AC-47；会让用户分不清「进程死了」与「只是慢」，I1.11 的三类待办从此混成一条。
- **#12 被否决：崩溃无限重建 / 运行慢也重建会话 / 重建增加轮次** —— 违反 C-13 / BR-37 / BR-39 / AC-42/43/44/63；无限重建会打爆宿主，轮次增加会让「超过就升级人工」的安全阀失效。
- **#13 被否决：给未声明 `timeout` 的内建图加默认超时并擅自判失败** —— 违反 R-7 / B-08 / BR-40 / AC-46；三张内建图没有 `timeout` 字段，加默认值会改变既有长任务的结局与三条主链逐字红线。

### 1.6 状态机 `phase` 投影

- **结论**：按裁-1 / R-1 / 附录 D-2：`NODE_STATES` **保持 7 项**（`pending` / `running` / `review` / `done` / `failed` / `cancelled` / `escalated`），9 个精确位置由「7 项 + `phase` 投影」承载——`pending` 承载 `blocked` / `ready`，`running` 承载 `assigned` / `running`；`phase` 只允许出现在 `pending` / `running`，其余状态带 `phase` 视为非法。`transit(instanceId, 'node', to, { phase, ... })` 在**写盘前**校验 D-2 的 6 组合法迁移（`blocked→ready`、`ready→assigned`、`assigned→running`、`running→assigned`、`assigned→cancelled`、`assigned→escalated`），其余组合拒绝并落 `rejected / illegal_transition` 事件、磁盘不动；位置变化与 `state` 变化在**同一次 CAS** 保存里完成。恢复不产生迁移：`blocked` / `ready` / `assigned` 直接保持原位置并重新入队，**不新增自环迁移**（不写 `assigned→assigned`）。`snapshotOf()` 只读投影、不写回；工作区 `status.md` 仍按看板列词显示（`assigned` → 「执行中」），CLI 显示精确位置「已分配」，属同一条基线规则（`index.md:166`）两种粒度，**不改 `src/core/status-text.js` 词表**（A-1 / B-17）。
- **理由**：规划 815 逐字含「状态机」（裁-1 不得换名收窄）；基线 §3.1 把 `pending` 定义为 `blocked+ready` 合并显示态、`assigned` 归入 `running` 列；直接扩 9 项会改动所有既有事件、断言与三条主链输出；AC-01 机检锚点写真实 **7 项**且 9 个位置投影齐全。
- **#14 被否决：把 `NODE_STATES` 直接扩成 9 项状态表** —— 违反裁-1 / D-1 `:1155`「不得改动 `state-machine.js` 的 7 项状态表与既有迁移边」；既有事件格式、CAS 形状、三条主链逐字基线全部要改，AC-01「`NODE_STATES` 仍是 7 项」当场破。
- **#15 被否决：为恢复新增 `assigned→assigned` 之类的自环迁移边** —— 违反 D-2 `:1203`「恢复不产生迁移、不得为恢复新增自环迁移」；会污染既有迁移边表与 `rejected / illegal_transition` 判定。
- **#16 被否决：先写 `phase` 再写 `state` 两次 CAS / 恢复旁路直接改节点位置** —— 违反 C-02「同一次 CAS 保存」与 BR-02「任何位置变化必经同一条状态迁移入口」；中途崩溃会产生 `phase` 与 `state` 不一致的半成品快照。

### 1.7 故障注入接缝

- **结论**：M-7 全部接缝只在 `NODE_ENV=test` 生效、生产路径不读：`MAESTRO_TEST_PAUSE=after_assign[:<节点>]` / `after_handoff_created[:<包号>]`、`MAESTRO_FAULT=checkpoint_write:fail`、`MAESTRO_TEST_SLOW_MS`、`MAESTRO_TEST_RECOVERY_HOLD=after_assign`、`MAESTRO_TEST_GRAPH=<绝对路径>`（仅测试的图注入口，给节点声明 `timeout`）；mock agent 新增 `MAESTRO_MOCK_CAPS=resume/load/both/none`、`MAESTRO_MOCK_RESUME=ok/fail`、`MAESTRO_MOCK_LOAD=ok/fail`、`MAESTRO_MOCK_NEW_FAIL=1`、`MAESTRO_MOCK_CRASH=after_first_update/twice`、`MAESTRO_MOCK_SLOW=1`、`MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1`、`MAESTRO_MOCK_PROMPT_FAILURES=<n>`、`MAESTRO_MOCK_PROMPT_LOG=<路径>`。`MAESTRO_TEST_PAUSE` 白名单在既有三值（`after_accepted` / `after_output` / `after_verdict`）之外扩两个值，**不改既有三值的分支与语义**（实文 `orchestrator.js:3971`）；mock agent 的新环境开关由两个 driver 读环境后**转成既有同一组命令行参数**（`--prompt-failures` / `--hold-session` 等），**不改既有参数语义、不改既有场景分支**（D-10 `:1360`）。接缝名与取值域属契约先冻结点（§6），先冻后各包才能并行造现场。
- **理由**：需求 §3.3#3 / M-7 / D-10 逐项登记；理解纪要 §6.3 实跑确认 `src/` 中这些接缝命中 0、新夹具 Glob 0，属 S2 实现期新增、不判缺陷；AC 的 Given 必须可执行且不得出现「历史会话为空闲或已隔离」这类不可构造状态。
- **#17 被否决：生产路径读取 `MAESTRO_*` 变量 / 为造现场改动既有场景分支或既有断言** —— 违反 M-7「全部只在 `NODE_ENV=test` 生效」、D-10「不改既有场景分支与既有断言」；会让非恢复路径三条主链输出变化，AC-52 破。
- **#18 被否决：给 `mock-acp-agent.js` 另起一套 `MAESTRO_MOCK_*` 命令行参数语义 / 改 `--prompt-failures` 的既有行为** —— 违反 D-10 `:1360`「由 driver 读环境后转成同一组参数、不改既有参数语义」；既有夹具面 31 条 AC 的现场会全部漂移，等于改了验收判据。

### 1.8 CLI 文案唯一来源

- **结论**：所有新增中文只在 `src/cli/labels.js`——`NODE_PHASE_LABEL`（A-1 九位置显示词）、恢复/检查点/崩溃/运行慢/复用文案（A-2~A-7）、`ROLE_SESSION_POLICY_INVALID` 原因码文案 `会话复用策略不合法：{value}（可选 reuse / fresh）`（A-10）；既有六张状态表与既有文案一个字符不改（M-6）。`src/cli/render.js` 只在**条件追加行**上扩：恢复行（A-2）、恢复块 + 连接线行（A-4）、崩溃/慢行（A-6）、`role show` 复用行（A-5）、`instance graph --format json` 恢复实例追加 `recovery` / `connections`（M-8 / A-9）；既有渲染分支一个字符不改。`src/core/status-text.js` 词表不改（A-1 `:992` / B-17）。**不新增 CLI 命令**（`orch recover` 仍是用法错误、退出码 2）、`USAGE_LINES` 25 行与前 8 行逐字不变（BR-46 / AC-55）。`recovery` 行只在实例带 `recoveredAt` 时追加，非恢复实例不出现（R-12 / B-13）。恢复/检查点/崩溃/运行慢/复用行全部是中文句子，`{原因}` 位填中文人话，不出现裸英文码（NFR-07）。
- **理由**：模板 §0.3「中文唯一来源 = `src/cli/labels.js`」、M-6 / M-8 / A-1~A-10 / D-1；三族 CLI 与 `src/registry` 零 CJK（D-11 第 5 条 `OK: no CJK`）；`labels.js` / `render.js` / `main.js` 合法持有模板名与角色名，不进 D-11 第 3 条扫描（当前 HEAD 实测 34 处命中、exit 1），不得为让扫描变绿改其注释（D-11 `:1391`）。
- **#19 被否决：把中文散落到 `src/core` / `src/registry` / 三族 CLI，或为让 D-11 第 3 条扫描变绿去改 `labels.js` / `render.js` / `main.js` 的注释与词表** —— 违反模板 §5#10 / §7 红线 6 / D-11 `:1391` / 裁-2；第 3 条按**三文件口径** `roles.js,skills.js,workflows.js` 扫，收窄或改注释都属「为绿放宽」。
- **#20 被否决：新增 `orch recover` 命令 / 扩 `USAGE_LINES` 到 26 行来承载恢复可见性** —— 违反 BR-46 / R-12 / AC-55 / D-12；恢复在 daemon 启动时自动发生，可见性通过既有 `status` / `instance status` / `instance log` / `instance graph` / `role show` / `handoff list` 的**条件追加行**实现，新增命令会扩大命令树与用法块基线。

### 1.9 测试组织

- **结论**：新增用例统一放 `test/wp13/`，沿用 D-10 的 8 文件清单（checkpoint / recovery-boot / dialect / role-recovery / handoff-recovery / session-failure / session-reuse / cli-recovery），并按 §1.4 规则 2「每包自带契约测试」补第 9 个 `test/wp13/fixtures.test.js`（夹具与 M-7 接缝契约自检，D-10「至少 7 个文件」为下限清单、补 1 个不违反）。纯函数类（位置投影、方言选择、检查点组装、复用判定）输入内存对象、不碰磁盘；需要项目根的用例用 `fs.mkdtemp(os.tmpdir())`、**绝不放仓库内**；`cli-recovery.test.js` 直接 `import { main }` 注入 `out` / `cwd`、不 spawn、不启核心、退出码用返回值；崩溃/慢/方言/恢复 hold 全走 M-7 接缝、验收里不 `sleep` 等 10 分钟；真实宿主面单独放 `probe/acc8-f-*` 与 `docs/iterations/iteration-8/evidence/`，不混入单测，无 DSH 判「阻塞」。全量命令固定 `node --test --test-concurrency=4 "test/**/*.test.js"`；回归断言用「**失败集合差集 = 0 + 条数只增不减**」下限式、不写死 992（AC-53 / D-10）。三条主链沿用两个 driver + `NODE_ENV=test`，夹具自述行比对前剔除。
- **理由**：D-9「除两行外 `test/**` 一个字符不许改，新增断言一律 `test/wp13/**`」、D-10 逐条；模板 §2.5 门禁四件套与 §5#14/#22（不硬编码条数、perf 噪声单跑诊断）；真实面与夹具面分目录（模板 §3.2 / BR-48 / NFR-08）。
- **#21 被否决：把新断言追加进既有 `test/wp4/*` / `test/wp11/*`，或改 D-9 两行之外的任何既有断言** —— 违反 D-9 `:1352` / AC-53 / 模板 §7 红线；「改后必红是预期」只能发生在 D-9 点名的两行。
- **#22 被否决：全量测试写死 `tests === 992` 或要求「零失败」** —— 违反 AC-53 `:807`「测试条数只增不减；不要求零失败」、D-10 `:1364`、模板 §2.5「回归断言用下限」；新增一条用例或 Windows 并发多一条 `EBUSY` 就会误判红。

### 1.10 恢复编排的单文件归属（拆分决策）

- **结论**：`src/core/orchestrator.js`（4800+ 行**超集文件**：检查点写点、`reconcileOnBoot` / `recoverInstance`、恢复、崩溃/慢处置、复用选择、角色实例与连接线重算、渲染数据来源全在它）指定 **WP-4 为唯一负责人**；WP-1（`checkpoint.js`）、WP-2（`acp-client.js`）、WP-3（`session_policy` 与 `selectReusableSession` 契约）、WP-5（`labels.js` / `render.js`）、WP-6（夹具与接缝）**一律通过 §2 冻结的签名契约调用，不许各自去改这个文件**（§1.4 规则 1；理解纪要 §8.3 第一条风险）。`src/daemon/server.js` 的启动接线与 `src/cli/main.js` 的按需接线同归 WP-4，避免第二个 WP 触碰核心状态机入口。
- **理由**：理解纪要 §8.3 明确「维度 A（检查点写点）、B（恢复/崩溃慢/复用选择）、E 的部分渲染数据来源都要改 `orchestrator.js`，按 §1.4 规则 1 指定唯一负责人，否则两 Agent 互相覆盖」；模板 §5#1「状态迁移唯一入口 `transit()`」也要求单一改动面。
- **#23 被否决：按维度把 `orchestrator.js` 切成几段分给多个 WP（A 改写点、B 改恢复、E 改渲染数据来源）** —— 正面违反 §1.4 规则 1「同一文件只属一个 WP」；同一文件的多次并发改动必然互相覆盖，且 `transit()` 的 CAS / `rev` / 事件先落盘再广播等不变量无法分段保证。

### 1.11 恢复读取顺序与唯一事实

- **结论**：恢复读取顺序固定「**先实例记录，再检查点**」（C-05）：实例记录可读 → 以实例记录为准；检查点只补「这次运行用的是哪张图」与「上次确认到哪」；`checkpoint.rev > state.rev` 只告警「检查点领先实例记录」、**不采纳**；实例记录不可读 → 维持既有「状态不可读 + `state.json.corrupt` 备份 + 阻断写入」，**不从检查点静默重建**（AC-06）。恢复失败（无可用方言 / 宿主不可达 / 锁定图缺失）→ 实例 `interrupted` 并写可见原因（C-10 / BR-12）。角色实例与连接线聚合仍是**派生视图、不写 `state.json`**，恢复后由核心按节点/会话/交接包重算（C-11 / BR-27 / BR-31）；连接线优先级 `rejected > expired > pending > delivered > accepted > consumed > not_started`（D-6）。恢复后写一条「恢复摘要」事件与对应检查点，重复启动不写第二份（C-06 / BR-13）。
- **理由**：R-2 / C-05 / C-11 / D-5 / D-6 逐字；基线 §6 边界「派生视图」纪律；AC-06 / AC-18 / AC-28~36 的可判定性全靠「唯一事实」不产生第二份可写真相。
- **#24 被否决：`checkpoint.rev > state.rev` 时采纳检查点 / 从检查点静默重建损坏实例** —— 违反 C-05 / BR-05 / AC-06；会让损坏的 `state.json` 被悄悄覆盖，`state.json.corrupt` 备份与前后 `sha256` 断言破。
- **#25 被否决：把角色实例 / 连接线聚合落进 `state.json` 作为第二份持久化真相** —— 违反 C-11 / BR-27 / BR-31 / 基线 §6 边界 #9；派生视图一旦落盘就与交接包状态双写，AC-30/33/34「重启前后逐项相同」与连接线重算口径失控。

### 1.12 三主链回归基线（集成版，不套旧基线）

- **结论**：三条主链 `single` / `code-loop` / `task-loop` 的**逐字基线以集成版 `d4b0f94` 重建**（`git worktree add --detach` 到 `%TEMP%`、`git -c core.autocrlf=false` 避免 CRLF 干扰，同参跑后归一化 diff）；**不是** I1.6 的 `0cd113b`。I1.4 改写过 `render.js`，集成后输出相对 `0cd113b` 预期有变化（集成说明 **O-I2**）；I1.6 AC-49 的逐字断言不能直接套到集成版。S3 须以集成版重建，**不能因「对不上旧基线」而放宽逐字判定**（纪要 §7.2 红线 1）。比对前剔除夹具自述行与「已运行 Ns」/ `HH:mm:ss` / `mock-sess-*` 等易变量，`autocrlf=true` 下提交内容统一 LF、比对前确认 LF 规范化。
- **理由**：`index.md:711` 回归红线 + 集成说明 §5 O-I2 + 纪要 §7.1/§7.2；AC-52「三条主链输出逐字不变」的「不变」必须相对当前 `origin/main`（集成版）定义，否则语义悬空。
- **#26 被否决：沿用 I1.6 的 `0cd113b` 逐字基线 / 因对不上旧基线就放宽 AC-52 的判定强度** —— 违反 O-I2 的建议「I1.7 起以集成版重建逐字基线」、AC-52 / BR-44 / 模板 §0.1 铁律 1「不许因『代码现在这样』改判据」；放宽等于把「逐字不变」降级为「大体不变」。

### 1.13 被否决项汇总

| 决策 | 被否决编号 | 条数 |
|---|---|---|
| 1.1 检查点落盘格式与写点 | #1、#2 | 2 |
| 1.2 ACP 方言探测与回退链 | #3、#4、#5 | 3 |
| 1.3 `resumeOrCreate` 结构 | #6、#7 | 2 |
| 1.4 会话复用判定 | #8、#9、#10 | 3 |
| 1.5 崩溃与慢的区分 | #11、#12、#13 | 3 |
| 1.6 状态机 `phase` 投影 | #14、#15、#16 | 3 |
| 1.7 故障注入接缝 | #17、#18 | 2 |
| 1.8 CLI 文案唯一来源 | #19、#20 | 2 |
| 1.9 测试组织 | #21、#22 | 2 |
| 1.10 恢复编排单文件归属 | #23 | 1 |
| 1.11 恢复读取顺序与唯一事实 | #24、#25 | 2 |
| 1.12 三主链回归基线 | #26 | 1 |
| **合计** | **#1~#26** | **26** |

> 技术选型被否决项 **26 条**（12 个关键决策，用户点名的 9 个决策面全部覆盖且每个都写了「结论 / 理由 / 被否决方案及原因」；另补 3 个拆分/回归/唯一事实决策）。

## 2. 模块划分与文件级接口契约

> 每个文件标注「**新增 / 改 / 不改**」与**归属 WP**；共享大文件（`src/core/orchestrator.js`）与共享文案/渲染文件（`src/cli/labels.js` / `render.js` / `main.js` / `roles.js`）均指定**唯一负责人**，其它 WP 通过本节冻结的签名契约调用、不各自去改。「不改」文件标「边界守护 WP-x」，**不进任何 WP 的负责文件清单**（§4），只声明不许改的部分。所有路径已在仓库 Glob/Read 核实；标注「新增」的文件当前不存在，属 S2/S3 交付。

### 2.1 `src/core/checkpoint.js`（**新增**，WP-1）

- **导出签名**：`export const CHECKPOINT_SCHEMA = 'checkpoint/v1'`；`export function buildCheckpoint({ state, graph, cwd, task })`；`export async function writeCheckpoint(root, id, checkpoint)`；`export async function loadCheckpoint(root, id)`。
- **入参/出参**：`buildCheckpoint` 入参为内存实例状态 + 锁定图对象 + `cwd` / `task`，出参为 §3.1 的 `checkpoint/v1` 完整对象（含 `instanceId` / `rev` / `checkpointId` / `writtenAt` / `coreGeneration` / `instanceState` / `paused` / `halted` / `template` / `graph` / `nodes` / `sessions` / `handoffs` / `escalations` / `artifactRefs`）；`writeCheckpoint` 入参绝对路径根 + 实例 id + 对象，成功 `{ok:true}`、失败 `{ok:false, code}`，**不抛给调用方**；`loadCheckpoint` 返回 `{ok:true, checkpoint}` 或 `{ok:false, code:'CHECKPOINT_UNREADABLE'}`，JSON 解析失败 / schema 不符 / `instanceId` 不符一律后者且**不写任何文件**。
- **约束**：纯组装 + 原子写（复用 `src/persistence/atomic-write.js` 的 `writeJsonAtomic`）；零中文、零宿主名分支、零网络、不写 `assets/**`、不写 `state.json`；不含提示词全文 / 模型输出 / 凭据 / 完整对话历史（C-04）；`checkpoint.rev !== state.rev` 以 `state.rev` 为准、`rev` 大于只告警不采纳（C-05）；`checkpointId` 单调递增；写失败只发一次 `checkpoint.write_failed` 事件（D-3）。归 **WP-1** 唯一所有。

### 2.2 `src/persistence/paths.js`（改，WP-1）

- **导出签名（保持 + 新增）**：既有 `projectRoot` / `orchDir` / `instancesDir` / `instanceDir` / `statePath` / `eventsPath` / `corruptPath` / `coreMetaPath` / `ensureLayout` 等一律不动；**新增** `export function checkpointPath(root, id)` → `path.join(instanceDir(root, id), 'state', 'checkpoint.json')`。
- **入参/出参**：`root` 项目根绝对路径、`id` 实例号；出参绝对路径字符串。
- **约束**：只新增一个路径助手、不手拼路径（D-1）；`state.json` 的路径与格式一个字符不改（M-2）；新建 `state/` 子目录与 `state.json` 同级（B-16）。归 **WP-1** 唯一所有。

### 2.3 `src/core/orchestrator.js`（改，WP-4，**超集文件唯一负责人**）

- **导出签名（保持 + 新增）**：`export function createOrchestrator({...})`（`:306`）保持；返回对象（`:4823` 附近）在既有 `transit` / `reconcileOnBoot` / `interruptAll` / `saveState` / `snapshotOf` 等之外，**新增导出** `selectReusableSession(sessionList, { instanceId, roleId, hostId, nodeId })`（纯函数，§1.4）。内部函数 `transit`（`:537`）扩展可选 `phase` 校验；`saveState`（`:441`）成功返回后触发检查点写点；`snapshotOf`（`:3819`）加只读 `phase` 投影；`reconcileOnBoot`（`:3894`）改为「有检查点或内建模板 → `recoverInstance()`」；`markInterrupted`（`:3929`）/ `interruptAll`（`:3913`）语义不变。
- **入参/出参**：`transit(instanceId, object, to, options = {})` 的 `options.phase` 按 D-2 六组合法表校验，非法落 `rejected / illegal_transition` 且磁盘不动；`reconcileOnBoot({ generation })` 返回 `{ok, interrupted, recovered}`（`recovered` 为新增键，供 `server.js` 启动日志）；`recoverInstance(id, stateDoc, checkpoint)` 内部按 D-5 六步对账；`selectReusableSession` 入参会话数组 + 四字段过滤条件，出参 `session | null`。
- **约束**：检查点写点、位置投影、恢复入口、方言调用、崩溃/慢处置、复用选择、角色/连接线重算**全在本文件**（理解纪要 §8.3）；不得旁路 `store.save` 改状态、`rev` 基于磁盘现值递增、事件先落盘再广播且 `ts` 复用状态变更同一时刻、`seq` 单调（模板 §5#1~#6）；`phase` 与 `state` 同一次 CAS、不新增自环迁移（D-2）；不按宿主名分支、不用 `stopReason` 判成败；`MAESTRO_TEST_PAUSE` 白名单扩两个值但不改既有三值分支（`:3971`）；`MAESTRO_FAULT` 扩 `checkpoint_write:fail` 但不改既有 4 值（`:354~363`）；零中文、零新增运行时依赖。归 **WP-4** 唯一所有，WP-1/2/3/5/6 **只通过本节契约调用，不许改本文件**。

### 2.4 `src/adapter/acp-client.js`（改，WP-2）

- **导出签名（保持 + 新增）**：`export function createAcpClient({ transport, limits, clock })`（`:90`）保持；返回对象（`:426` 附近）在既有 `newSession` / `prompt` / `cancel` / `closeSession` / `resumeOrCreate` 之外**新增** `normalizeCapabilities(initialize)` / `resumeSession(sessionId, { cwd, mcpServers = [] })` / `loadSession(sessionId, { cwd, mcpServers = [] })`。
- **入参/出参**：`normalizeCapabilities` 出参 `{canResume, canLoad, sessionCapabilities}`；`resumeOrCreate({ cwd, sessionId, policy = 'fresh', capabilities })` 成功 `{restored, dialect, attempts}`、全失败 `{ok:false, code:'SESSION_RESTORE_FAILED', attempts}`（§1.3）；`resumeSession` / `loadSession` 分别 `request('session/resume' | 'session/load', { sessionId, cwd, mcpServers })`，超时沿用 `requestTimeoutMs`。
- **约束**：现状 `:314~328` 的 `resumeOrCreate` 只走 `newSession`、注释「会话恢复留给 I1.8」按 M-3 替换；`newSession` / `prompt` / `cancel` / `closeSession` 签名与行为**不变**、`fresh` 仍走 `newSession`；不按 `hostId` / 宿主名分支（C-07）；`resume` 成功不假设历史存在、`load` 成功不重投已完成历史（C-08）；每次回退产出 `attempts` 供调用方落 `recovery.dialect`（D-4）；零中文。归 **WP-2** 唯一所有。

### 2.5 `src/daemon/server.js`（改，WP-4）

- **导出签名（保持）**：`export function createServer({...})`（`:43`）；内部 `reconcileOnBoot()`（`:398`）保持，`:401` 调 `orchestrator.reconcileOnBoot({ generation: gen })`。
- **入参/出参**：`:354` 启动流程调用 `reconcileOnBoot()`；新增启动日志 `CORE_BOOT_RECOVER`（`recovered` / `interrupted` 列表），**不进入用户命令输出**（D-5 `:1311`）；`test.escalate` / `test.handoff` / `test.delivery` / `test.delivery.whenHeld`（`:286~314`）既有接缝语义不变。
- **约束**：不改 `core.ping` 既有字段、不改 `core stop` 语义（D-1）；`interruptAll`（`core stop`）产生的 `interrupted` 不被重新拉起；零中文。归 **WP-4** 唯一所有（与超集文件同一负责人，避免第二 WP 触碰启动恢复入口）。

### 2.6 `src/cli/main.js`（改 / 不改按需接线，WP-4）

- **导出签名（保持）**：`export function parseArgs(argv)`（`:578`）/ `exitCodeFor(code)`（`:587`）/ `export async function main(argv, options = {})`（`:606`）；`COMMANDS`（`:64`）= `{'run','status','cancel','core','role','skill','workflow'}` **7 个、不增不减**。
- **入参/出参**：`options = { cwd, now, out, createClient }` 注入点不变；`main` 旧命令返回对象字段集合一个都不变；既有 `recoverAfterDisconnect`（`:983`，I1.4 断连恢复）不是新增命令、不动。
- **约束**：**无新增命令**、`USAGE_LINES` 25 行不变、`orch recover` 仍用法错误退 2（BR-46 / AC-55 / M-1 `D-1`）；仅当恢复接线确需 `main` 传 `recoveredAt` 等 ctx 时才做最小改动，且归 **WP-4** 唯一负责人；零中文、零资产名。若实现证明无需改，本文件保持 **不改**。

### 2.7 `src/registry/role-schema.js`（改，WP-3）

- **导出签名（保持 + 扩展）**：`ROLE_OPTIONAL_KEYS`（`:39`，现状 5 键 `tools` / `wake_allow` / `inputs` / `outputs` / `dispatchable`）末尾追加 `'session_policy'`；`checkRoleShape(obj, { fileId })`（`:77`）扩枚举校验，非法值报 `ROLE_SESSION_POLICY_INVALID`（明细含原值，文案见 A-10）；既有必填键、既有原因码、`ROLE_MAX_CONCURRENT_INVALID` 等一律不动。
- **入参/出参**：`checkRoleShape` 出参仍 `Array<{code, field, params}>`（沿用既有约定），`ROLE_SESSION_POLICY_INVALID` 计入既有 `errors` 数组、不改 6 键结构（A-10）。
- **约束**：`session_policy` 取值 `reuse` / `fresh`、缺省 `fresh`；**缺省值不得注入角色对象用于渲染**（D-13）；`coordinator` 在 `src/registry/**` 仍只允许出现在 `GROUPS` 一行（D-11 第 2 条 30 词口径）；零 CJK、零资产名字面量。归 **WP-3** 唯一所有。

### 2.8 `src/registry/asset-write.js`（改，WP-3）

- **导出签名（保持 + 扩展）**：`serializeRole(role)`（`:177`）/ `serializeSkill` / `serializeWorkflow` / `atomicWrite({target, text})`（`:302`）签名不变；内部 `ROLE_KEY_ORDER`（`:34`）在 `max_concurrent_sessions` 之后插入 `session_policy`；`ROLE_ALIASES`（`:53`）增 `sessionPolicy`；派生/继承/可编辑键集合 `DERIVE_INHERIT_KEYS` / `EDITABLE_KEYS` 纳入该键，`PROTECTED_KEYS` 不含它（D-13）。
- **入参/出参**：`serializeRole` 只输出源对象里**显式出现**的可选键（沿用 `ROLE_KEY_ORDER` 遍历 + `pickValue`），故 26 个内置资产序列化逐字节不变；`atomicWrite` 契约不变。
- **约束**：既有键序不改、既有 26 内置资产一个字节不改（M-5）；`role create --from` 继承、`role edit --set session_policy=reuse|fresh` / `--unset` 回缺省（D-13）；零 CJK、零资产名。归 **WP-3** 唯一所有。

### 2.9 `src/cli/roles.js`（改，WP-3）

- **导出签名（保持 + 扩展）**：`detailOf(err)`（`:111`）/ `firstRegistryDetail(errors)`（`:144`）/ `export async function roleCommand(parsed, ctx)`（`:1115`）保持；`role show` 在角色源对象**显式声明** `session_policy` 时，于「  可唤醒：...」之后、「  来源：...」之前追加 A-5 的 `  会话复用：复用（reuse）` / `  会话复用：每任务新会话（fresh）` 一行；`role edit --set` / `--unset` / `role create --from` 支持该键。
- **入参/出参**：`parsed` / `ctx` 同既有；出参 `Promise<number>`（0/1/2/3 语义不变）；`role validate --format json` 的 `errors` 含 `ROLE_SESSION_POLICY_INVALID`、计数 26/16/10 不变。
- **约束**：`role show developer` 等既有输出逐字不变（未声明不显示复用行）；复用中文只从 `labels.js`（WP-5）经契约取；零 CJK 字面量、零资产名（D-11 第 3 条三文件口径包含本文件）。归 **WP-3** 唯一所有。

### 2.10 `src/cli/labels.js`（改，WP-5，**中文唯一来源、共享文件唯一负责人**）

- **导出签名（保持 + 新增）**：既有 `INSTANCE_LABEL` / `NODE_LABEL` / `SESSION_LABEL` / `HANDOFF_LABEL` / `ROLE_INSTANCE_STATUS_LABEL` / `USAGE_LINES`（`:183`，25 行）/ `NODE_QUALIFIER` / `NODE_SUFFIX` / `HANDOFF_RETRY_SUFFIX` / `REGISTRY_ERROR` 等**一个键不加不改**；新增 `NODE_PHASE_LABEL`（A-1 九位置显示词）、恢复/检查点/崩溃/运行慢/复用文案常量（A-2~A-7 逐字短语）、`ROLE_SESSION_POLICY_INVALID` 文案 `会话复用策略不合法：{value}（可选 reuse / fresh）`（A-10）。
- **入参/出参**：全部 `Object.freeze` 常量表 / 字符串模板，由 `render.js` 与 CLI 用 `{value}` / `{轮}` / `{N}` 等占位替换读取。
- **约束**：所有新增中文只在此文件；`USAGE_LINES` 前 8 行逐字不变、`length === 25`；既有六张状态表与既有文案一个字符不改（M-6）；本文件**合法持有**模板名与角色名，**不进 D-11 第 3 条扫描命令**、不得为让扫描变绿改其注释（D-11 `:1391` / 裁-2）。归 **WP-5** 唯一所有。

### 2.11 `src/cli/render.js`（改，WP-5，**共享文件唯一负责人**）

- **导出签名（保持 + 新增）**：既有 `renderInstanceLine` / `renderNodeLine` / `renderHandoffLines` / `renderEventLine` / `renderGraphJson`（`:1302`）/ `renderGraphText`（`:1326`）/ `renderRoleShow`（`:1423`）/ `renderRoleInstanceLine`（`:1498`）/ `renderUsage`（`:1025`）等一字不动；**条件追加**恢复行（A-2）、恢复块 + `连接线：… 待投递（重投中）`（A-4）、崩溃/慢行（A-6）、`role show` 复用行（A-5）；`renderGraphJson` 仅在实例带 `recoveredAt` 时在 `current` 之后追加 `recovery`（4 键）/ `connections`（每项 4 键），非恢复实例仍 **11 个顶层键**且顺序不变（A-9 / M-8）。
- **入参/出参**：入参为已组装数据对象（snapshot / graph / rows / recovery / connections），出参 `string` 或 JSON 对象；`--format json` 分支键顺序固定、`graphVersion` 仍为 1。
- **约束**：既有渲染分支逐字不动，优先改「传进去的变量值」而非模板字符串（模板 §5#8）；恢复相关行只在 `recoveredAt` / 对应条件出现，非恢复实例不出现（R-12）；零 CJK 字面量（中文从 `labels.js` 取）。归 **WP-5** 唯一所有。

### 2.12 `test/wp13/**`（**新增**，按 WP 归属，D-10 下限 8 文件 + 补 1 契约自检文件）

> **接口形状（§2.12~§2.15 统一注记，S-02）**：下列 4 个小节登记的均为**测试 / 夹具 / probe 占位文件**，**不产出产品 API，无导出签名与入参出参**（该字段对测试与占位文件不适用）；它们的「契约」由 `test/wp13/*` 的断言、§2.14 的逐字实文锚点与 §5 的归属 WP 承担，验收口径见各 WP 的「验收口径」字段。产品源文件的「导出签名 / 入参出参」见 §2.1~§2.11。本节及 §2.13 / §2.14 / §2.15 的**接口形状一律标「不适用」**，详见各节末尾单行。

| 文件（新增） | 归属 WP | 类型 | 契约内容 |
|---|---|---|---|
| `test/wp13/checkpoint.test.js` | WP-1 | 纯函数 + `fs.mkdtemp` | `checkpoint/v1` 形状、`checkpointId` 单调、`rev` 一致、`CHECKPOINT_UNREADABLE`、不含提示词/输出/凭据 |
| `test/wp13/dialect.test.js` | WP-2 | 纯函数 + 内存 transport stub | 四组能力广告、`resume→load→new` 顺序、`attempts`、全失败 `SESSION_RESTORE_FAILED` |
| `test/wp13/session-reuse.test.js` | WP-3 | 纯函数（内存对象） | `session_policy` 枚举/键序/别名、`role show` 条件行、`selectReusableSession` 的 idle/同宿主/未占用判定（经 §2.3 契约 import） |
| `test/wp13/recovery-boot.test.js` | WP-4 | `fs.mkdtemp` + 接缝 | 启动恢复六步、轮次不重置、跳过已完成、幂等、按实例记录恢复、恢复失败原因、复用派发 |
| `test/wp13/role-recovery.test.js` | WP-4 | `fs.mkdtemp` + 接缝 | `busy→available` / 保持 busy / 重新调度 / `unavailable` 去向 / 无可调度节点保持可用 |
| `test/wp13/handoff-recovery.test.js` | WP-4 | `fs.mkdtemp` + 接缝 | `delivered→pending` 重投、`created` 继续投递、`accepted`/`consumed`/`rejected`/`expired` 不改、连续失败过期升级、连接线聚合 |
| `test/wp13/session-failure.test.js` | WP-4 | `fs.mkdtemp` + 接缝 | 崩溃重建一次/二次直接升级/重建失败升级、运行慢不重建/超时 `failed_reason: timeout`、两类提示互斥 |
| `test/wp13/cli-recovery.test.js` | WP-5 | 直接 `import { main }` 注入 `out`/`cwd` | 恢复行/恢复块/A-3 短语/A-5 复用行/A-6 失败行逐字、13 键 JSON、11 键非恢复、25 行用法块、`orch recover` 退 2 |
| `test/wp13/fixtures.test.js` | WP-6 | 纯断言（不启核心） | M-7 接缝名与取值域、mock 四组能力广告、driver 环境转参数且既有 `--prompt-failures` / `--hold-session` 语义不变、新夹具形状 |

> 9 文件按「纯函数 / IO / CLI 集成 / 夹具契约」分层，WP-1/2/3/5/6 各带一份可独立跑的契约测试，WP-4 带 4 份、WP-7 不新增 `test/wp13` 文件（D-9 两行改既有断言、真实面走 `probe/`）；符合 D-10「至少 7 个文件」下限与 §1.4 规则 2「每包自带契约测试」。

### 2.13 `test/fixtures/mock-acp-agent.js` / 两个 driver / `recovery-driver.mjs` / `recovery/**`（改 + **新增**，WP-6）

- **「导出」/改动内容**：`test/fixtures/mock-acp-agent.js`（现状命令行参数 `--prompt-failures` / `--hold-session` / `--noise-on-prompt` 等，实文 `:112`/`:161`/`:178`）扩展能力广告与失败/崩溃/慢/提示记录；`test/fixtures/code-loop-driver.mjs` / `test/fixtures/task-loop-driver.mjs` 的 `cleanEnv` 读 `MAESTRO_MOCK_*` 环境后转成**既有同一组参数**、并支持 `MAESTRO_TEST_PAUSE` 两个新值与 `--kill-after`（AC-18 连续强杀）；新增 `test/fixtures/recovery-driver.mjs`（场景 `checkpoint-advance` / `dialect-resume` / `redeliver` / `e2e`）、`test/fixtures/recovery/human-node-state.json`（`human` 节点 `running` 预置）、`test/fixtures/recovery/graph-timeout.json`（审核节点 `timeout: 2` 的图注入口夹具）。
- **约束**：全部 `NODE_ENV=test` 生效；**不改既有场景分支、不改既有参数语义、不改既有断言**（M-7 / D-10 `:1360`）；`MAESTRO_TEST_GRAPH` 只在显式设置且 `NODE_ENV=test` 时替换内建图，生产路径不读、CLI `--template` 仍只接受三张内建图（D-8）；真实项目根一律 `%TEMP%`，不放仓库内。归 **WP-6** 唯一所有（理解纪要 §8.3「建议单线处理 F 维度，避免多包各加一套开关」）。
- **接口形状**：不适用（无产品导出签名 / 入参出参；见 §2.12 统一注记）。

### 2.14 `test/wp4/orchestrator.test.js` / `test/wp11/role-schema.test.js`（改，WP-7，**D-9 只有两行**）

- **改动内容（逐字实文已核）**：`test/wp11/role-schema.test.js:57` `assert.deepEqual([...ROLE_OPTIONAL_KEYS], ['tools', 'wake_allow', 'inputs', 'outputs', 'dispatchable']);` → 数组末尾追加 `'session_policy'`；`test/wp4/orchestrator.test.js:480`（用例标题）/ `:575` `assert.deepEqual(result.interrupted, ['INST-009']);` → `[]`、`:578` `'interrupted'` → `'running'`、`:580` `/stopped at node running/` → 「节点仍 `running` 且无 stopped note」、`:584~586` `core.gone` 三行 → 「无 `core.gone`，有 `recovery.*` 事件」，按「按实例记录恢复」改期望。
- **约束**：`test/wp4/orchestrator.test.js:588~592` 的 `legacyAfter` / `legacyBefore` + `assert.equal(legacyAfter, legacyBefore, 'v1 实例必须一字不改')` **保持原样**（裁-5 把 D-9 的 `:588~590` 机械更正为 `:588~592`）；`core stop` / `interruptAll` 相关用例不动；**除这两行外 `test/**` 一个字符不许改**（D-9 `:1352`）；改后必红是预期，不得为保绿弱化功能。归 **WP-7** 唯一所有。
- **接口形状**：不适用（无产品导出签名 / 入参出参；验收靠本节逐字实文锚点与 §2.12 统一注记）。

### 2.15 `probe/acc8-f-*` / `docs/iterations/iteration-8/evidence/**`（**新增占位，S3 验收期**，WP-7）

- **占位说明**：按模板 §3.1 脚手架四件套命名 `probe/acc8-f-lib.mjs` / `acc8-f-common.mjs` / `acc8-f-run.mjs` / `acc8-f-final.mjs`，用例目录 `probe/acc8-cases/`（**不带 `-f`**）、分片 `probe/acc8-f-parts/`、结果 `probe/acc8-f-{results.jsonl,summary.json,blockers.md}`，路径常量导出 `ACC8_PATHS`；证据落 `docs/iterations/iteration-8/evidence/`，命名 `AC-XX.<阶段>.<类型>`。真实宿主面单独一批（AC-25/26/27 + AC-57 隔离守卫），与夹具面分目录。
- **约束**：**本拆分文档不创建这些文件**（纪律：只新建 `docs/iterations/iteration-8.md`）；它们是 S3 验收期交付物，此处仅登记占位与归属 WP-7；`evidence/**` / `probe/**` 是并行产物、由主控单独提交、禁止 `git add -A`（模板 §2.7 / §7 红线 3）。
- **接口形状**：不适用（无产品导出签名 / 入参出参；probe 占位由 S3 验收期交付，见 §2.12 统一注记）。

### 2.16 边界守护文件（**不改**，标边界守护 WP，不进任何 WP 负责文件清单）

| 文件 | 现状实文 | 不许改的部分 | 边界守护 WP |
|---|---|---|---|
| `src/core/state-machine.js` | `NODE_STATES`（`:43`）7 项 | 7 项状态表、既有迁移边（D-1 `:1155` / 裁-1） | WP-4 |
| `src/core/status-text.js` | `renderStatusDoc`（`:274`）/ `CORE_TEXT`（`:14`） | 看板列词表（A-1 `:992` / B-17） | WP-5 |
| `src/templates/index.js` | `GRAPHS`（`:306`）恰 3 键 | 三张内建图任何字段、`getGraph` / `defaultGraph` / `initialNodes` / `promptFor`（D-1 / R-9） | WP-4 |
| `src/persistence/instance-store.js` | `markCorrupt`（`:113`）/ `load`（`:122`）/ `save`（`:187`）/ 返回 `{root,load,save,appendEvent,readEvents,list,markCorrupt,nextSeq}`（`:401`） | `state.json` 格式 / `rev` / CAS / `.corrupt` 损坏处理（M-2） | WP-1 |
| `src/persistence/atomic-write.js` | `writeTextAtomic`（`:40`）/ `writeJsonAtomic`（`:54`）/ `copyToBackup`（`:114`） | 原子写契约，只被 WP-1 复用 | WP-1 |
| `src/core/advance.js` | `planAdvance` 的 `promptText`（`:228`） | 提示词唯一来源、提示词一律给绝对路径（模板 §0.3 / §5#7） | WP-4 |
| `src/core/event-bus.js` / `src/daemon/lifecycle.js` | `emit()` 可选 `ts`、`ensureCore`（`:23`） | 事件先落盘再广播、`ts` 复用同一时刻、`seq` 单调；`ensureCore` / `isAlive` / `stopCore` 语义（模板 §5#4~#6；§3.3#4 强杀用 `kill -9` 不用 `core stop`） | WP-4 |
| `src/registry/index.js` | `loadRegistry` | 加载与 counts、报错顺序（R-4 / D-1） | WP-3 |
| `src/cli/skills.js` / `src/cli/workflows.js` | 三族 CLI | D-11 第 3 条**三文件口径**逐字沿用，不得收窄（裁-2） | WP-7 |
| `test/fixtures/purity-check.mjs` | `DEFAULT_FORBID` 仅 4 词、`--files` 优先（`:27`/`:80`/`:83`） | 只读复用；`--forbid` 必须显式传 31 词全表 | WP-7 |
| `bin/orch.js` / `assets/**` | CLI 入口 / 26 内置资产 | 26 个内置资产一个字节不改（M-5）；入口不改 | WP-3 / WP-7 |
| `docs/index.md` / `docs/templates/requirement-template.md` / `src/cli/labels.js` 既有键 | 需求基线 / 模板 / 既有六张状态表 | 只增不改（M-6 / 需求 D-1） | WP-5 |

## 3. 数据模型

> **唯一事实来源（逐样例标注）**：① **实例记录** `<root>/.orch/instances/<id>/state.json` = **主真相**（M-2 / C-05 / R-2）；② **检查点** `<root>/.orch/instances/<id>/state/checkpoint.json`（`checkpoint/v1`）= **恢复信封**，只补「按哪张图恢复、上次确认到哪」，不是第二份可写真相；③ **角色实例 / 连接线聚合** = **派生视图，不落盘**（C-11 / BR-27 / BR-31），恢复后由核心按节点/会话/交接包重算；④ **`instance graph --format json`** = 只读投影（`renderGraphJson`），非恢复实例 11 键顺序不变、恢复实例追加 2 键（A-9）。

### 3.1 `checkpoint/v1` 完整 JSON 样例（唯一事实来源：恢复信封，逐字取附录 D-3 `:1210~1231`）

```json
{
  "schema": "checkpoint/v1",
  "instanceId": "INST-001",
  "rev": 12,
  "checkpointId": 12,
  "writtenAt": "2026-11-09T10:30:00.000Z",
  "coreGeneration": "gen-...",
  "instanceState": "running",
  "paused": false,
  "halted": false,
  "template": "code-loop",
  "cwd": "/abs/project",
  "task": "任务原文",
  "graph": { "id": "code-loop", "title": "编码闭环", "nodes": [], "edges": [], "maxRounds": {}, "terminals": [], "productPolicy": "declared" },
  "nodes": [{ "nodeId": "T-003", "state": "running", "phase": "assigned", "round": 2, "roleId": "developer", "sessionId": "sess-003", "endedAt": null }],
  "sessions": [{ "sessionId": "sess-003", "nodeId": "T-003", "hostId": "dsh", "state": "thinking", "policy": "fresh", "dialect": null, "lastEventAt": "..." }],
  "handoffs": [{ "handoffId": "HO-006", "from": "T-002", "to": "T-003", "kind": "backflow", "state": "delivered", "deliveryAttempts": 1 }],
  "escalations": [],
  "artifactRefs": []
}
```

字段口径（D-3 / C-04）：`rev` 与 `checkpointId` 随每次成功 `saveState()` 递增；`graph` 是**锁定图快照**（图对象副本，无版本号字段，B-02）；`nodes[]` 记 `state` / `phase` / `round` / `sessionId`；`sessions[]` 记 `policy` / `dialect` / `lastEventAt`；`handoffs[]` 记 `state` / `deliveryAttempts`；`artifactRefs` 原样保留（I1.7 未合入，C-16）。**不含**提示词全文 / 模型输出 / 凭据 / 完整对话历史 / 环境变量。写点在 `saveState()` 成功返回后，顺序「实例记录 → 检查点 → 事件广播」（C-03）。

### 3.2 `state.json` 新增 / 变更键（主真相，形状增量、既有键与 `rev`/CAS/损坏处理全部不变）

```json
{
  "instanceId": "INST-001",
  "state": "running",
  "rev": 12,
  "recoveredAt": "2026-11-09T10:31:00.000Z",
  "coreGeneration": "gen-...",
  "nodes": [
    { "id": "T-003", "state": "running", "phase": "assigned", "round": 2, "roleId": "developer", "sessionId": "sess-003" },
    { "id": "T-004", "state": "failed", "failed_reason": "timeout", "round": 2 }
  ]
}
```

- **新增实例级键**：`recoveredAt`（恢复发生时置，A-2/A-4 恢复行的条件开关）、`coreGeneration`（当前核心代次，`reconcileOnBoot` 跳过 `generation === current`，D-5）。
- **新增节点级键**：`phase`（**仅 `pending` / `running`** 上出现，取值 `blocked` / `ready` / `assigned` / `running`；C-01 / D-2）、`failed_reason: "timeout"`（**本迭代新增落盘**，仅运行慢且节点声明 `timeout` 超时后写，语义见 `index.md:164`；C-14 / D-8）。
- **不变**：`state.json` 的路径、格式、`rev` 递增、CAS、`.corrupt` 备份；`NODE_STATES` 仍 7 项；不带 `phase` 的旧节点按 `state` 直接显示（C-01）；`status.md` 看板列词与 CLI 精确位置两种粒度（A-1 / B-17）。

### 3.3 恢复摘要事件与其它新增事件（`events.jsonl`，事件先落盘再广播、`ts` 复用状态变更同一时刻、`seq` 严格单调）

```json
{"seq": 41, "ts": "2026-11-09T10:31:00.000Z", "type": "recovery.summary", "instanceId": "INST-001", "detail": {"checkpointAt": "2026-11-09T10:30:00.000Z", "skipped": 1, "round": 2, "maxRounds": 3}}
{"seq": 42, "ts": "2026-11-09T10:31:00.010Z", "type": "recovery.dialect", "instanceId": "INST-001", "detail": {"from": "resume", "to": "load", "reason": "host_error", "sessionId": "sess-003"}}
{"seq": 43, "ts": "2026-11-09T10:31:00.020Z", "type": "recovery.role", "instanceId": "INST-001", "detail": {"roleId": "developer", "from": "busy", "to": "available", "reason": "session_unrecoverable"}}
{"seq": 44, "ts": "2026-11-09T10:31:00.030Z", "type": "recovery.human", "instanceId": "INST-001", "detail": {"nodeId": "T-004", "state": "running", "note": "保持等待人工（不重派）"}}
{"seq": 45, "ts": "2026-11-09T10:31:00.040Z", "type": "checkpoint.write_failed", "instanceId": "INST-001", "detail": {"code": "EACCES", "reminderOnce": true}}
{"seq": 46, "ts": "2026-11-09T10:31:00.050Z", "type": "session.crash", "instanceId": "INST-001", "detail": {"nodeId": "T-003", "round": 2, "attempt": 1}}
{"seq": 47, "ts": "2026-11-09T10:31:00.060Z", "type": "session.slow", "instanceId": "INST-001", "detail": {"nodeId": "T-003", "waitedMs": 600000, "rebuild": false}}
```

- **恢复摘要**（C-06）：恢复后写**一条** `recovery.summary`，含检查点时间 / 跳过已完成节点数 / 恢复后轮次；重复启动**不写第二份**（BR-13 / NFR-04 / AC-18 统计 `recovery.summary` 事件数量 = 1）。
- **方言回退**（D-4）：每次回退一条 `recovery.dialect`，`detail` 含 `{from, to, reason}`，对应 A-3 的逐字回退行。
- **写失败**：`checkpoint.write_failed` 每实例每次运行最多 1 次，`orch run` 订阅后打印 A-3 检查点失败行（D-3 / AC-04）。
- **会话失败**：`session.crash` 带 `attempt`（同派发最多 1）、`session.slow` 带 `rebuild:false`（D-8）。

### 3.4 `recovery` / `connections` 追加键（唯一事实来源：只读投影，`renderGraphJson` 在 `current` 之后追加，A-4 / A-9 / M-8）

```json
{
  "graphVersion": 1,
  "instanceId": "INST-001",
  "template": "code-loop",
  "state": "running",
  "paused": false,
  "nodes": [],
  "edges": [],
  "handoffs": [],
  "escalations": [],
  "approvals": [],
  "current": {},
  "recovery": { "checkpointAt": "2026-11-09T10:30:00.000Z", "skipped": 1, "round": 2, "maxRounds": 3 },
  "connections": [{ "from": "T-002", "to": "T-003", "kind": "backflow", "aggregate": "pending" }]
}
```

- 非恢复实例：**11 个顶层键**且顺序不变（`graphVersion` / `instanceId` / `template` / `state` / `paused` / `nodes` / `edges` / `handoffs` / `escalations` / `approvals` / `current`），**不含** `recovery` / `connections`；恢复实例共 **13 键**，末键为 `connections`。
- `recovery` 恰 4 键 `checkpointAt` / `skipped` / `round` / `maxRounds`；`connections[]` 每项恰 4 键 `from` / `to` / `kind` / `aggregate`（A-9）。文本侧对应 `连接线：测试→开发（回流） 待投递（重投中）`，方向沿用既有 `from→to（回流）/（复测）` 格式，无连接线时不打印 `连接线：` 段（A-4）。

### 3.5 会话失败行（唯一事实来源：`labels.js` 的 A-6 逐字文案；`orch run` 滚动输出与 `orch instance log` 可见）

```
会话进程已退出：正在重建会话（节点 {节点号} · 轮次 {轮}/{上限}）
会话已重建 {会话号}（节点 {节点号} · 轮次 {轮}/{上限}）
会话重建失败：已升级人工（节点 {节点号} · 轮次 {轮}/{上限}）
会话无进展：判定为运行慢，不重建会话（节点 {节点号} · 已等待 {N}m）
节点 {节点号} 超时：按运行慢处理，已升级人工（节点 {节点号} · 轮次 {轮}/{上限}）
```

逐字口径：崩溃场景只出现「会话进程已退出 / 正在重建 / 会话已重建 / 重建失败」，慢场景只出现「无进展 / 判定为运行慢 / 不重建 / 节点超时」，**两段文案不互相出现**（AC-47）；`{N}` 在 `MAESTRO_TEST_SLOW_MS=100` 缩短后允许为 `0`，不写死 10（AC-44）；退出码沿用既有挂起 4、不新增退出码（A-8）。

### 3.6 异常态样例（唯一事实来源：上述四类，含异常态，逐条标判定）

```json
{"ok": false, "code": "CHECKPOINT_UNREADABLE", "reason": "JSON 解析失败 / schema 不符 / instanceId 不符"}
```
```json
{"seq": 51, "ts": "...", "type": "recovery.failed", "instanceId": "INST-001", "detail": {"reason": "宿主不可达（MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1）", "state": "interrupted"}}
```
```json
{"instanceId": "INST-002", "state": "interrupted", "recoveredAt": null, "note": "旧实例无检查点：已中断（如需继续请新建实例）"}
```

- **检查点不可读**：`loadCheckpoint` 返回 `CHECKPOINT_UNREADABLE`，**不写任何文件**（D-3）；实例记录不可读时维持既有「状态不可读 + `state.json.corrupt` 备份 + 阻断写入」，原字节前后 `sha256` 相同、**不从检查点静默重建**（AC-06 / C-05）。
- **恢复失败**：无可用方言 / 宿主不可达 / 锁定图缺失 → 实例 `interrupted`，日志逐字 `恢复失败：<原因>；实例已中断（可执行 orch instance log 查看详情）`，不显示「运行中」（C-10 / BR-12 / AC-17）。
- **旧格式实例**：无检查点且模板不在内建三图 → 保持 `interrupted`、提示新建实例、不重写旧快照（BR-11 / AC-15）。
- **三方言全失败降级**：节点「已分配」、角色「可用 · 活跃会话 0/1」、未接受交接「待投递」，实例不进入「运行中」（BR-22 / AC-23）。
- **写失败异常态**：`MAESTRO_FAULT=checkpoint_write:fail` 下 `state.json` 仍有最新进展、检查点文件可能停留在上一份、`orch run` 提醒每次运行最多 1 次、退出码不变（AC-04 / NFR-03 / A-8）。
- **二次崩溃（AC-63 / D-8 `:1343`）**：`MAESTRO_MOCK_CRASH=twice` 下同一派发已重建成功 1 次后再次崩溃。**判定**：`session.crash` 事件只有带 `attempt: 1` 的一条（**不出现第二条 `session.crash`、不出现第二次「正在重建会话」/重建事件**）、`session/new` 只 1 次（比单次崩溃场景少 1 次、重建不再增加）、节点直接 `state: 'escalated'`、实例 `state: 'suspended'`、`round` 仍 2（**轮次不变**）、退出码沿用既有挂起 4、A-6 可见行逐字 `会话重建失败：已升级人工（节点 T-003 · 轮次 2/3）`。**唯一事实来源**：`state.json` 增量片段（§3.2 主真相，字段形状同 §3.2，不新增字段）+ `events.jsonl` 的 `session.crash`（§3.3 带 `attempt`）+ A-6 文案（§3.5 / 需求 `:1057`）；依据 AC-63 Then（`:907~908`）/ D-8 `:1339`/`:1343` / BR-52。上例为 `state.json` 节选，未列出的键同 §3.2。

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "rev": 14,
  "nodes": [{ "id": "T-003", "state": "escalated", "round": 2, "roleId": "developer", "sessionId": "sess-004" }]
}
```

- **重投失败（AC-62 / C-17 / 需求 `:900`）**：恢复后回到「待投递」的交接包连续 3 次重投失败。**判定**：`handoff.state === 'expired'`、`deliveryAttempts === 3`、`escalations` 由 `[]` 变为长度 1（**新增 1 条**；元素形状沿用 `src/core/escalation.js:69~81` 的既有 D-6 升级记录，本样例只节选 4 个既有字段、`escalationId` 按 `nextEscalationId` 递增，**不新增字段 / 不新增原因码**）、`handoffId` 不变且不重置 `deliveryAttempts`（C-17）、`accepted`/`consumed`/`rejected`/`expired` 不进入重投（D-6 `:1322`）、实例不永远停在「已投递」、`orch instance log` 出现升级行（AC-62 Then）。**唯一事实来源**：`state.json` 的 `handoffs[]`（§3.1 `checkpoint/v1` 同形状）与 `escalations`（A-9 11 键顶层键之一）+ 既有 `expired` / `escalateDeliveryFailure`（D-6 `:1321`）；依据 AC-62 Then（`:899~900`）/ BR-51 / C-17（`:176`）/ D-6 `:1321~1322`。夹具 `MAESTRO_MOCK_PROMPT_FAILURES=3` + `MAESTRO_TEST_DELIVERY_DELAY_MS=10`（`:900`，后者为 S-07 登记的**现状既有接缝**）。

```json
{
  "instanceId": "INST-001",
  "rev": 15,
  "handoffs": [{ "handoffId": "HO-006", "from": "T-002", "to": "T-003", "kind": "backflow", "state": "expired", "deliveryAttempts": 3 }],
  "escalations": [{ "escalationId": "ESC-001", "nodeId": "T-003", "round": 2, "state": "pending" }]
}
```

### 3.7 附录 A-1~A-10 逐字来源登记表（S-05；只登记来源，不改写需求附录 A 任何一行）

| A 节 | 标题 | 需求 v3 来源行号 | 拆分文档落点 |
|---|---|---|---|
| A-1 | 节点位置显示 | `:976~992` | §2.10 `NODE_PHASE_LABEL` / §8 冲突 1 / WP-5 验收 AC-01 |
| A-2 | `orch status --instance` / `orch instance status` 恢复行 | `:994~1003` | §2.11 / §3.2 `recoveredAt` / WP-5 AC-10 |
| A-3 | `orch instance log` 新增短语（17 行模板） | `:1005~1027`（代码块 `:1010~1026`） | 下方**逐字副本** / §3.3 事件 / §3.6 异常态 / WP-2·4·5 验收口径 |
| A-4 | `orch instance graph` 恢复块 | `:1029~1039` | §2.11 / §3.4 / WP-5 AC-36 |
| A-5 | `orch role show` 会话复用行 | `:1041~1050` | §2.9 / §2.10 / WP-3·5 AC-48 / AC-51 |
| A-6 | `orch run` / `orch instance log` 会话失败行 | `:1052~1060` | §3.5 逐字五行 / WP-4·5 AC-42~47 |
| A-7 | `orch handoff list` / 状态块 | `:1062~1064` | §2.11（不改既有行格式）/ WP-4 AC-32 / AC-35 |
| A-8 | 退出码 | `:1066~1071` | §0 退出标准 / §3.6 写失败异常态 / WP-4 AC-43 / AC-63 |
| A-9 | JSON 结构 | `:1073~1075` | §2.11 / §3.4 / §6 冻结点 4 / WP-5 AC-36 / AC-55 |
| A-10 | 角色校验新原因码 | `:1077~1079` | §2.7 / §2.10 / §6 冻结点 5 / WP-3·5 AC-51 |

**A-3 的 17 行模板形式（需求 `:1010~1026` 逐字副本，一个字未改）**：

```
恢复：检查点 {HH:MM:SS} · 跳过 {N} 个已完成节点 · 轮次 {轮}/{上限}
恢复：会话 {会话号} · session/resume（不回放）
恢复：会话 {会话号} · session/load（回放）
恢复：会话 {会话号} · session/new（新建）
恢复：session/resume 失败，回退 session/load（回放）
恢复：session/load 失败，回退 session/new（新建）
恢复：角色 {角色中文名} · 服务中 → 可用（会话不可恢复）
恢复：角色 {角色中文名} · 不可用 → 可用（会话已重建）
恢复：交接包 {包号} 已构造 → 继续投递
会话 复用 {会话号}（角色 {角色中文名}）
恢复：连接线 {方向} 已投递 → 待投递（重投）
恢复：人工节点 {节点号} 保持等待人工（不重派）
按实例记录恢复（可能重跑当前轮）
旧实例无检查点：已中断（如需继续请新建实例）
恢复失败：{原因}；实例已中断（可执行 orch instance log 查看详情）
检查点写入失败：{原因}；本次进展已保存，崩溃恢复可能回退到上一个检查点
重新核对：{节点号} · 证据重新校验（不重放会话）
```

> 逐字声明：上列 A-3 17 行是需求 `:1010~1026` 的**逐字副本**；A-1/A-2/A-4/A-5/A-6/A-7/A-9/A-10 只登记索引与来源行号、不复制正文（避免产生第二份可漂移副本，比照裁-4「两份副本逐字相同、任何一侧修改都要同步」的纪律）。拆分文档各处出现的 `恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3`、`恢复：会话 sess-003 · session/resume（不回放）` 等是 **AC Then 的具体值实例**——即同一文案把 `{HH:MM:SS}` / `{会话号}` / `{N}` / `{轮}` / `{上限}` 等占位符替换为具体值后的实例，**无措辞改写**（评审 C⑦）；`{原因}` 与 `<原因>` 只是记法差异，一律取需求附录 A 与 AC Then 原文，不合并、不改一个字。本表**不改写需求附录 A 的任何一行**。

## 4. 工作包拆分

> **7 个 WP 按能力切**（对齐理解纪要 §8.1 的 7 维度 A~G，不按目录切）；每个 WP 固定五字段：`负责文件（k）逐条列 / 依赖 / 交付 / 验收口径 / 可否并行`。**同一文件只属一个 WP**；`src/core/orchestrator.js`（4800+ 行超集文件）指定 **WP-4 唯一负责人**，WP-1/2/3/5/6 通过 §2 的签名契约调用、不各自去改（§1.4 规则 1 / 理解纪要 §8.3）。`src/cli/labels.js` / `render.js` / `main.js` / `roles.js` 亦各指定唯一负责人。依赖成 DAG、每个包自带契约测试、缺字段按契约兼容缺省（规则 2）。**所有 AC 的「验收口径」= 需求 v3 §3.1 同号 Then 的逐字口径**，本节只登记 AC 编号、测试文件与逐字断言锚点，不复制 / 不改写 / 不合并 / 不放宽任何 Then。
> **主责口径说明**：映射表「主责」= 该 AC 判定所依赖的首要交付归属 WP；其中 AC-37 / AC-45 / AC-61 三条的 Given 完全由 M-7 / D-10 新接缝与新夹具决定（理解纪要 §6.6 A 组点名「当前无法取证、待 S2 实现」），主责记**现场构造 WP-6**、产品保持/投递判定由协作 WP-4 承担，备注逐行注记。WP-6 同时是夹具面 31 条 AC 的现场构造协作包。

### WP-1 检查点与持久化契约（依赖：无）

- **负责文件（3）**：`src/core/checkpoint.js`（新增）、`src/persistence/paths.js`（改）、`test/wp13/checkpoint.test.js`（新增）
- **依赖**：无（纯新增 + 一个路径助手，契约先冻结后可最先开工；`writeJsonAtomic` 由边界守护文件只读复用）
- **交付**：`CHECKPOINT_SCHEMA` / `buildCheckpoint` / `writeCheckpoint` / `loadCheckpoint` / `checkpointPath`；`checkpoint/v1` 完整字段形状（§3.1）；`CHECKPOINT_UNREADABLE`；原子写 + `checkpointId` 单调 + `rev` 一致性 + 写失败 `{ok:false, code}` 不抛（§2.1 / §2.2）
- **验收口径**：AC-02、AC-03（主责）；AC-04 / AC-05 / AC-06 的检查点侧契约（协作 WP-4）。测试文件 `test/wp13/checkpoint.test.js`。逐字断言锚点：`checkpointId` 单调递增、`rev` 与实例记录一致、检查点含 `instanceId` / `rev` / `checkpointId` / `graph` / `nodes` / `sessions` / `handoffs` / `paused` / `halted`、不含提示词全文 / 模型输出 / 凭据、`CHECKPOINT_UNREADABLE` 时不写任何文件；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 零产品耦合、只用内存对象与 `%TEMP%` 临时根，是 DAG 叶子；`checkpoint/v1` 形状属批次 0 冻结项，冻住后 WP-4 才能接写点

### WP-2 ACP 恢复方言（依赖：无）

- **负责文件（2）**：`src/adapter/acp-client.js`（改）、`test/wp13/dialect.test.js`（新增）
- **依赖**：无（`resumeOrCreate` 返回结构属批次 0 冻结项；能力归一化口径 C-07 先冻）
- **交付**：`normalizeCapabilities` / `resumeSession` / `loadSession` / `resumeOrCreate`；`canResume` / `canLoad`；`{restored, dialect, attempts}` 与 `{ok:false, code:'SESSION_RESTORE_FAILED', attempts}`；`recovery.dialect` 事件的 `{from,to,reason}` detail 形状；`newSession` / `prompt` / `cancel` / `closeSession` 签名不变（§2.4）
- **验收口径**：AC-19、AC-20、AC-21、AC-22、AC-23、AC-25、AC-26、AC-27（主责）；AC-24 协作 WP-4。测试文件 `test/wp13/dialect.test.js`。逐字断言锚点：`session/resume` 1 次 / `session/load` 0 次（AC-19）、`session/load` 1 次 / `session/resume` 0 次 / `session/prompt` 0 次（AC-20）、`session/new` 1 次 / `session/prompt` 1 次（AC-21）、调用顺序 `resume → load` 且 `new` 为 0（AC-22）、三方言全失败无新会话（AC-23）、`恢复：会话 sess-003 · session/resume（不回放）` / `（回放）` / `session/new（新建）` / `恢复：session/resume 失败，回退 session/load（回放）`；AC-25/26/27 的真实面取证由 WP-7 协作、本机无 DSH 判「阻塞」不伪造通过；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 独立适配层文件、内存 transport stub 即可跑；与 WP-1 无共享文件，是 DAG 叶子

### WP-3 角色 `session_policy` 与会话复用配置（依赖：WP-4 + WP-5）

- **负责文件（4）**：`src/registry/role-schema.js`（改）、`src/registry/asset-write.js`（改）、`src/cli/roles.js`（改）、`test/wp13/session-reuse.test.js`（新增）
- **依赖**：WP-4（§2.3 冻结的 `selectReusableSession` 导出契约；实现期前用契约兼容缺省的内存 stub）、WP-5（`labels.js` 的 A-5 / A-10 文案契约）
- **交付**：`ROLE_OPTIONAL_KEYS` 末尾追加 `'session_policy'`；`ROLE_KEY_ORDER` 放在 `max_concurrent_sessions` 之后、`ROLE_ALIASES` 增 `sessionPolicy`、`DERIVE_INHERIT_KEYS` / `EDITABLE_KEYS` 纳入、`PROTECTED_KEYS` 不含；`checkRoleShape` 的 `ROLE_SESSION_POLICY_INVALID`；`role show` 条件追加行、`role edit --set` / `--unset`、`role create --from` 继承（§2.7~2.9 / D-13）
- **验收口径**：AC-48、AC-49、AC-50、AC-51、AC-65、AC-66（主责）；AC-49 / AC-65 / AC-66 的派发接线由协作 WP-4 承担。测试文件 `test/wp13/session-reuse.test.js`。逐字断言锚点：两轮开发会话 id 不同且 `role show developer` 与 I1.6 基线逐字节相同（AC-48）、两轮会话 id 相同 + `session/new` 只 1 次 + `会话 复用 sess-003（角色 developer）`（AC-49）、两实例会话 id 交集为空（AC-50）、`  会话复用：复用（reuse）` 在「可唤醒」之后「来源」之前 + `ROLE_SESSION_POLICY_INVALID` 计入 `errors` + `role show developer` 无该行（AC-51）、无空闲会话时 `session/new` +1 且复用行 0 次（AC-65）、被复用会话 `hostId` 一致且 `servingNodeId` 为空才选中（AC-66）；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 只依赖已冻结的纯函数签名与文案常量，用内存角色对象独立跑；与 WP-4 无共享文件（不改超集文件）

### WP-4 恢复编排内核（`src/core/orchestrator.js` 超集文件唯一负责人）（依赖：WP-1 + WP-2 + WP-5 + 契约冻结）

- **负责文件（7）**：`src/core/orchestrator.js`（改，**唯一负责人**）、`src/daemon/server.js`（改）、`src/cli/main.js`（改 / 不改按需接线）、`test/wp13/recovery-boot.test.js`（新增）、`test/wp13/role-recovery.test.js`（新增）、`test/wp13/handoff-recovery.test.js`（新增）、`test/wp13/session-failure.test.js`（新增）
- **依赖**：WP-1（检查点契约）、WP-2（`resumeOrCreate` 契约）、WP-5（`labels` / `render` 契约）、批次 0 全部冻结项；`session_policy` 经「角色对象带该字段」的冻结契约读取，不依赖任何实现文件
- **交付**：`transit` 的 `phase` 六组合法校验 + 同一次 CAS；`snapshotOf` 只读 9 位置投影；`saveState` 成功后的检查点写点；`reconcileOnBoot` → `recoverInstance()` 六步对账（选图 / 节点对账 / 会话对账 / 写恢复事件与 `recoveredAt` / `coreGeneration` / 从 `assigned`·`ready` 继续调度 / 致命错误 `interrupted`）；崩溃与慢两套判据与处置；`selectReusableSession` 纯函数导出；角色实例 / 连接线聚合派生重算；`delivered→pending` 重投、`created` 继续投递、重投 3 次失败 `expired` + 升级；`human` / `escalate` / `failed` / `suspended` / `subworkflow` 保持；启动日志 `CORE_BOOT_RECOVER`（§2.3 / §2.5 / §2.6）
- **验收口径**：AC-01、AC-04、AC-05、AC-06、AC-07、AC-08、AC-09、AC-11、AC-12、AC-13、AC-14、AC-15、AC-16、AC-17、AC-18、AC-24、AC-28、AC-29、AC-30、AC-31、AC-32、AC-33、AC-34、AC-35、AC-38、AC-39、AC-40、AC-41、AC-42、AC-43、AC-44、AC-46、AC-58、AC-59、AC-60、AC-62、AC-63、AC-64、AC-67（主责，**39 条**）；AC-10 / AC-36 / AC-47 协作 WP-5、AC-37 / AC-45 / AC-61 协作 WP-6、AC-48~51 / AC-65 / AC-66 协作 WP-3、AC-19~23 协作 WP-2。测试文件 `test/wp13/recovery-boot.test.js` / `role-recovery.test.js` / `handoff-recovery.test.js` / `session-failure.test.js`。逐字断言锚点：`NODE_STATES` 仍是 **7 项** + 9 位置投影齐全（AC-01）、`恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3` 只出现 1 次（AC-10 数据侧）、`round === 2` / `maxRounds === 3`（AC-07）、已完成节点 `session/prompt` 次数 0 且 `node.dispatch` 不含该节点（AC-08/09）、`recovery.summary` 事件数量为 1（AC-18）、`按实例记录恢复（可能重跑当前轮）`（AC-05）、`旧实例无检查点：已中断（如需继续请新建实例）`（AC-15）、`恢复失败：<原因>；实例已中断（可执行 orch instance log 查看详情）`（AC-17）、`恢复：角色 开发 · 服务中 → 可用（会话不可恢复）`（AC-28）、`恢复：连接线 测试→开发（回流） 已投递 → 待投递（重投）`（AC-32）、`重新核对：{节点号} · 证据重新校验（不重放会话）`（AC-14，A-3 第 17 行逐字）、`恢复：人工节点 T-004 保持等待人工（不重派）`（AC-37 数据侧）、`会话进程已退出：正在重建会话（节点 T-003 · 轮次 2/3）` / `会话无进展：判定为运行慢，不重建会话（节点 T-003 · 已等待 {N}m）`（AC-42/44）、`failed_reason === 'timeout'`（AC-45 数据侧）、`state='running'` / `phase='assigned'` 释放后 `phase='running'`（AC-59）、`handoff.state === 'expired'` / `deliveryAttempts === 3`（AC-62）；按各 AC 同号 Then 逐字判定
- **可否并行**：**否** —— DAG 汇合点，依赖 WP-1/2/5 与全部冻结契约就绪；且 `orchestrator.js` 是超集文件，按 §1.4 规则 1 必须单线改动，多 Agent 并行会互相覆盖（理解纪要 §8.3 第一条）

### WP-5 文案与渲染唯一来源（依赖：无）

- **负责文件（3）**：`src/cli/labels.js`（改，**中文唯一来源 / 共享文件唯一负责人**）、`src/cli/render.js`（改，**共享文件唯一负责人**）、`test/wp13/cli-recovery.test.js`（新增）
- **依赖**：无（文案常量与 JSON 键形状属批次 0 冻结项，冻住后 WP-3/4 才能并行接线）
- **交付**：`NODE_PHASE_LABEL`、A-2~A-7 / A-10 全部文案常量、`ROLE_SESSION_POLICY_INVALID` 文案；`render.js` 的恢复行 / 恢复块 + 连接线行 / 崩溃慢行 / 复用行条件追加；`renderGraphJson` 恢复实例追加 `recovery`（4 键）/ `connections`（每项 4 键）在 `current` 之后、非恢复仍 11 键；既有六张状态表 / 既有渲染分支 / `USAGE_LINES` 25 行一字不改（§2.10 / §2.11）
- **验收口径**：AC-10、AC-36、AC-47（主责）；AC-01 / AC-14 / AC-42~45 / AC-51 / AC-52 / AC-55 的文案侧（协作）。测试文件 `test/wp13/cli-recovery.test.js`。逐字断言锚点：`恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3` 只出现 1 次且非恢复实例不出现（AC-10）、`连接线：测试→开发（回流） 待投递（重投中）` + 恢复实例 JSON 含 `recovery` / `connections`、非恢复不含（AC-36）、崩溃输出不含 `判定为运行慢` 且慢输出不含 `正在重建会话`、各自关键短语计数 1（AC-47）、A-3 的 `重新核对：{节点号} · 证据重新校验（不重放会话）`（AC-14）、`  会话复用：复用（reuse）`（AC-51 A-5）、`会话复用策略不合法：{value}（可选 reuse / fresh）`（A-10）、`USAGE_LINES.length === 25` + 前 8 行逐字 + `orch recover` 退 2（AC-55）；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 叶子，只依赖已冻结的字段形状；`cli-recovery.test.js` 直接 `import { main }` 注入 `out` / `cwd`、不 spawn、不启核心，独立可跑

### WP-6 测试夹具、故障注入与现场构造（依赖：批次 0 冻结的 M-7 接缝契约）

- **负责文件（7）**：`test/fixtures/mock-acp-agent.js`（改，能力扩展）、`test/fixtures/code-loop-driver.mjs`（改，环境转参数）、`test/fixtures/task-loop-driver.mjs`（改，环境转参数）、`test/fixtures/recovery-driver.mjs`（新增）、`test/fixtures/recovery/human-node-state.json`（新增）、`test/fixtures/recovery/graph-timeout.json`（新增）、`test/wp13/fixtures.test.js`（新增，夹具契约自检）
- **依赖**：批次 0 冻结的 M-7 接缝名与取值域、mock 四组能力广告、driver 转参数口径；**不依赖任何产品 WP 的实现**（理解纪要 §8.3「建议单线处理 F 维度」）
- **交付**：M-7 全部测试接缝（§1.7 逐字清单）；mock agent 四组能力广告 `resume` `{close,list,resume}` 无 `load` / `load` `loadSession: true` / `both` / `none`；`MAESTRO_MOCK_{RESUME,LOAD}_fail` / `NEW_FAIL` / `CRASH=after_first_update|twice` / `SLOW` / `SPAWN_FAIL_ON_RECOVER` / `PROMPT_FAILURES` / `PROMPT_LOG`；两个 driver 把环境转成既有同一组命令行参数、`MAESTRO_TEST_PAUSE` 扩两个新值、支持连续 `--kill-after`；`recovery-driver.mjs` 四场景、`human-node-state.json`（`nodeType:'human'`, `state:'running'`）、`graph-timeout.json`（审核节点 `timeout: 2`）（§2.13）
- **验收口径**：AC-37、AC-45、AC-61（**主责 = Given 现场构造**；产品保持/投递判定协作 WP-4，见本节开头「主责口径说明」）；夹具面 31 条 AC 的 Given 现场构造（协作）；独立验收靠 `test/wp13/fixtures.test.js` 的 M-7 契约自检。逐字断言锚点：`MAESTRO_MOCK_CAPS=resume` 广告 `{close,list,resume}` 且不含 `load`、`MAESTRO_MOCK_CAPS=load` 广告 `loadSession: true`、`MAESTRO_TEST_PAUSE` 既有三值 `after_accepted` / `after_output` / `after_verdict` 分支语义不变、`--prompt-failures` / `--hold-session` 既有参数语义不变、`MAESTRO_TEST_GRAPH` 仅在 `NODE_ENV=test` 且显式设置时生效、`human-node-state.json` 的 `nodeType === 'human'` 且 `state === 'running'`、`graph-timeout.json` 的审核节点 `timeout === 2`；按各协作 AC 同号 Then 逐字判定（产品侧由 WP-4 承担）
- **可否并行**：可（但须**单线**） —— 理解纪要 §8.3「mock agent 与 driver 的接缝扩展被方言域、崩溃慢域、复用域同时需要，建议单线处理 F 维度，避免多包各加一套开关」；与 WP-1/2/3/5 无共享文件

### WP-7 授权断言、架构门禁与真实宿主面取证（依赖：WP-3 + WP-4 + WP-6）

- **负责文件（4）**：`test/wp4/orchestrator.test.js`（改，**D-9 第二行**）、`test/wp11/role-schema.test.js`（改，**D-9 第一行**）、`probe/acc8-f-*.mjs`（新增占位，S3 验收期）、`docs/iterations/iteration-8/evidence/**`（新增占位，S3 验收期）
- **依赖**：WP-3（`session_policy` 使 `:57` 改后必红）、WP-4（`reconcileOnBoot` 使 `:575/578/580/584~586` 改后必红）、WP-6（夹具与接缝就绪）；真实面取证依赖 WP-4 产品行为就绪
- **交付**：D-9 **两行**授权断言的改后期望（§2.14 逐字）；`:588~592`「v1 实例必须一字不改」保持原样；D-11 五条架构命令的门禁留痕；AC-56 四锚点留痕；`probe/acc8-f-*` 四件套 + `probe/acc8-cases/` + `evidence/` 取证骨架（**本拆分不创建**）；真实宿主面 AC-25/26/27/57 的隔离 `DSH_HOME` 构造与「阻塞」判定记录（§2.15）
- **验收口径**：AC-52、AC-53、AC-54、AC-55、AC-56、AC-57（主责，**6 条**）；AC-25 / AC-26 / AC-27 的真实面取证（协作 WP-2）。测试文件：既有 `test/wp4/orchestrator.test.js` / `test/wp11/role-schema.test.js`（仅两行授权改动）+ D-11 五条命令 + `probe/acc8-f-run.mjs`（S3）。逐字断言锚点：`node --test --test-concurrency=4 "test/**/*.test.js"` 与 `origin/main` 失败集合差集 = 0 且条数 ≥ 992（AC-53）、D-11 五条全 `exit 0` / #4 输出 `0` / #5 输出 `OK: no CJK` / 第 3 条三文件口径（AC-54）、`USAGE_LINES.length === 25` + `COMMANDS` 不含 `recover` + `orch recover` 退 2（AC-55）、三主链与集成版 `d4b0f94` 归一化 diff 空（AC-52）、AC-56 四锚点 `NOT_EXIST` / `0` / `0` / `NOT_EXIST` 且报告登记「I1.7 合入后重跑」、`stat -c %Y ~/.dsh` 前后相同 + 隔离目录删除后不存在 + `git status --porcelain` 不含仓库内新增项目根（AC-57）、AC-25 机检 `sessionCapabilities` 键集含 `close` / `list` / `resume` 不含 `load` 且无 DSH 判「阻塞」（AC-25）；按各 AC 同号 Then 逐字判定
- **可否并行**：**否** —— D-9 两行是「改后必红是预期」的授权改动，按模板 §2.3「修复类任务永远单线」；且真实宿主面按模板 §3.2「真实宿主面单独一批」，末批单线取证；`probe/` / `evidence/` 由主控单独提交、禁止 `git add -A`

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-4 | WP-5、WP-6 | 9 位置投影 + `NODE_STATES` 仍 7 项 + 显示词 |
| AC-02 | WP-1 | WP-4、WP-6 | 检查点随进展推进、`checkpointId` 单调 |
| AC-03 | WP-1 | WP-4、WP-6 | 检查点内容足以恢复「做到哪」 |
| AC-04 | WP-4 | WP-1、WP-5、WP-6 | 写失败提醒每次运行最多 1 次、退出码不变 |
| AC-05 | WP-4 | WP-1、WP-6 | 检查点缺失按实例记录恢复 |
| AC-06 | WP-4 | WP-1、WP-6 | 实例记录不可读不从检查点静默重建 |
| AC-07 | WP-4 | WP-1、WP-5 | 重启后轮次不重置 |
| AC-08 | WP-4 | WP-6 | 已完成节点不重放（prompt log） |
| AC-09 | WP-4 | WP-1、WP-6 | 规划验收句：kill daemon 从检查点继续 |
| AC-10 | WP-5 | WP-4、WP-6 | 恢复摘要一行（A-2 / A-3 / A-4） |
| AC-11 | WP-4 | WP-6 | 挂起实例重启后仍挂起 |
| AC-12 | WP-4 | — | 升级节点重启后仍是已升级 |
| AC-13 | WP-4 | — | 失败节点重启后不自动重跑 |
| AC-14 | WP-4 | WP-5、WP-6 | review 重新核对不重放（A-3 第 17 行逐字） |
| AC-15 | WP-4 | WP-1 | 旧实例无检查点且模板未知 → 已中断 |
| AC-16 | WP-4 | WP-7 | 显式 core stop 仍是已中断 |
| AC-17 | WP-4 | WP-5、WP-6 | 恢复失败时用户看到原因 |
| AC-18 | WP-4 | WP-1、WP-6 | 恢复幂等、`recovery.summary` = 1 |
| AC-19 | WP-2 | WP-6 | resume 方言：不回放 |
| AC-20 | WP-2 | WP-6 | load 方言：回放且不重复投递 |
| AC-21 | WP-2 | WP-6 | new 方言：只重发当前轮 |
| AC-22 | WP-2 | WP-5、WP-6 | resume 失败回退 load、每步可见 |
| AC-23 | WP-2 | WP-4、WP-6 | 三方言全失败按 §3.6 降级 |
| AC-24 | WP-4 | WP-2、WP-6 | resume 成功也不重放已完成节点 |
| AC-25 | WP-2 | WP-7 | 真实 DSH 只广告 resume（真实面取证 WP-7、无 DSH 判阻塞） |
| AC-26 | WP-2 | WP-4、WP-7 | 真实 DSH 重启不重复已完成节点（阻塞口径） |
| AC-27 | WP-2 | WP-7 | 第三方 load：真实可用则真验、否则阻塞 |
| AC-28 | WP-4 | WP-5、WP-6 | busy 且不可恢复 → available |
| AC-29 | WP-4 | WP-6 | busy 且可恢复 → 保持 busy |
| AC-30 | WP-4 | — | available / cooldown / inactive 不受影响 |
| AC-31 | WP-4 | WP-6 | 降级后重新调度回 busy |
| AC-32 | WP-4 | WP-5、WP-6 | delivered → pending 并重投 |
| AC-33 | WP-4 | — | 已 accepted 不重投 |
| AC-34 | WP-4 | — | consumed / rejected / expired 不改 |
| AC-35 | WP-4 | WP-6 | 重投成功回已投递 / 已接受 |
| AC-36 | WP-5 | WP-4 | 连接线聚合在恢复实例图上可见（13 键 JSON） |
| AC-37 | WP-6 | WP-4、WP-5 | 主责 = human 预置夹具现场构造；产品保持判定 WP-4 |
| AC-38 | WP-4 | — | escalate 节点保持 |
| AC-39 | WP-4 | — | failed 节点保持 |
| AC-40 | WP-4 | — | suspended 实例内全部节点保持 |
| AC-41 | WP-4 | — | subworkflow 不透明保留 |
| AC-42 | WP-4 | WP-5、WP-6 | 崩溃重建并重试当前轮 |
| AC-43 | WP-4 | WP-5、WP-6 | 重建失败升级人工、退出码 4 |
| AC-44 | WP-4 | WP-5、WP-6 | 运行慢不重建会话 |
| AC-45 | WP-6 | WP-4、WP-5 | 主责 = `graph-timeout.json` 图注入口现场构造；超时判定 WP-4 |
| AC-46 | WP-4 | WP-6 | 未声明超时继续等待、不擅自失败 |
| AC-47 | WP-5 | WP-4、WP-6 | 崩溃与慢两类提示不混用（A-6 逐字） |
| AC-48 | WP-3 | WP-4、WP-5 | fresh 默认每任务新会话、role show 无复用行 |
| AC-49 | WP-3 | WP-4、WP-5、WP-6 | reuse 复用空闲会话 |
| AC-50 | WP-3 | WP-4 | reuse 不跨实例 |
| AC-51 | WP-3 | WP-5 | 配置可见、非法值 `ROLE_SESSION_POLICY_INVALID` |
| AC-52 | WP-7 | WP-4、WP-5、WP-6 | 非恢复路径三条主链逐字不变（集成版基线） |
| AC-53 | WP-7 | WP-6 | 全量测试失败集合差集 = 0、条数只增不减 |
| AC-54 | WP-7 | — | 架构纯净 31 词扫描 exit 0、零依赖、零 CJK |
| AC-55 | WP-7 | WP-5 | 不新增 CLI 命令、用法块 25 行 |
| AC-56 | WP-7 | WP-4 | I1.7 未合入不依赖 worktree、合入后重跑 |
| AC-57 | WP-7 | — | 真实宿主隔离：不动用户 `~/.dsh`（阻塞口径） |
| AC-58 | WP-4 | WP-1、WP-2、WP-5、WP-6 | 混合 e2e：回流崩溃 → 恢复 → 人工作业 → 完成 |
| AC-59 | WP-4 | WP-5、WP-6 | 已分配节点保持并重新派发 |
| AC-60 | WP-4 | WP-5 | 待执行节点保持原位置、依赖不变 |
| AC-61 | WP-6 | WP-4 | 主责 = `after_handoff_created` 接缝现场构造；继续投递判定 WP-4 |
| AC-62 | WP-4 | WP-6 | 重投连续失败 → 已过期并升级 |
| AC-63 | WP-4 | WP-6 | 二次崩溃直接升级、不再重建 |
| AC-64 | WP-4 | WP-5、WP-6 | 角色不可用 → 可用 → 服务中 |
| AC-65 | WP-3 | WP-4 | reuse 无空闲会话新建、不报错 |
| AC-66 | WP-3 | WP-4 | reuse 不跨宿主、不复用占用会话 |
| AC-67 | WP-4 | WP-5、WP-6 | 角色无可调度节点保持可用 |

> 覆盖核对：67 行、AC-01~AC-67 连续无缺号无重号；每条至少一个主责 WP，跨包均标主责 / 协作。主责计数：WP-1 **2** / WP-2 **8** / WP-3 **6** / WP-4 **39** / WP-5 **3** / WP-6 **3**（Given 现场构造）/ WP-7 **6** = **67**。WP-4 覆盖最多是 `orchestrator.js` 超集文件「唯一负责人制」的必然结果（理解纪要 §8.3 第一条），不是按目录切。

## 5. 交付物清单

> 三列表：路径 → 内容 → 归属 WP。「新增」文件当前不存在，属 S2 实现期 / S3 验收期交付；**本拆分文档只新建 `docs/iterations/iteration-8.md` 自身**，下表其余均为规划中的交付物。

| 路径 | 内容 | 归属 WP |
|---|---|---|
| `docs/iterations/iteration-8.md` | **本次唯一新建文件**：8 节固定骨架的拆分与技术选型文档（本文件） | S1（本拆分工程师） |
| `src/core/checkpoint.js` | **新增**：`checkpoint/v1` 组装 / 原子写 / 读取 / `CHECKPOINT_UNREADABLE` | WP-1 |
| `src/persistence/paths.js` | 改：新增 `checkpointPath(root,id)` | WP-1 |
| `test/wp13/checkpoint.test.js` | **新增**：检查点契约测试 | WP-1 |
| `src/adapter/acp-client.js` | 改：`normalizeCapabilities` / `resumeSession` / `loadSession` / `resumeOrCreate` 回退链 | WP-2 |
| `test/wp13/dialect.test.js` | **新增**：四组能力广告与回退链契约测试 | WP-2 |
| `src/registry/role-schema.js` | 改：`session_policy` 可选键 + 枚举校验 + 原因码 | WP-3 |
| `src/registry/asset-write.js` | 改：键序 / 别名 / 派生继承 / 可编辑键纳入 `session_policy` | WP-3 |
| `src/cli/roles.js` | 改：`role show` 条件复用行 + `--set` / `--unset` / `--from` | WP-3 |
| `test/wp13/session-reuse.test.js` | **新增**：配置 / 校验 / 复用判定契约测试 | WP-3 |
| `src/core/orchestrator.js` | 改（**唯一负责人**）：`phase` 校验 / 检查点写点 / `reconcileOnBoot`→`recoverInstance` / 崩溃慢 / 复用 / 派生重算 / `selectReusableSession` 导出 | WP-4 |
| `src/daemon/server.js` | 改：启动恢复接线 + `CORE_BOOT_RECOVER` 日志 | WP-4 |
| `src/cli/main.js` | 改 / 不改（按需最小接线）；**无新增命令** | WP-4 |
| `test/wp13/recovery-boot.test.js` | **新增**：启动恢复 / 轮次 / 幂等 / 按实例记录恢复 | WP-4 |
| `test/wp13/role-recovery.test.js` | **新增**：角色实例恢复 | WP-4 |
| `test/wp13/handoff-recovery.test.js` | **新增**：交接包 / 连接线聚合恢复 | WP-4 |
| `test/wp13/session-failure.test.js` | **新增**：崩溃 / 慢 / 超时 | WP-4 |
| `src/cli/labels.js` | 改（中文唯一来源）：`NODE_PHASE_LABEL` + A-2~A-7 / A-10 文案 | WP-5 |
| `src/cli/render.js` | 改（共享文件唯一负责人）：恢复行 / 恢复块 / 崩溃慢行 / 复用行 / 13 键 JSON | WP-5 |
| `test/wp13/cli-recovery.test.js` | **新增**：CLI 文案与 JSON 键契约测试 | WP-5 |
| `test/fixtures/mock-acp-agent.js` | 改（能力扩展）：四组能力广告 + 失败 / 崩溃 / 慢 / prompt log 开关 | WP-6 |
| `test/fixtures/code-loop-driver.mjs` | 改：`MAESTRO_MOCK_*` 环境转既有参数、`--kill-after` | WP-6 |
| `test/fixtures/task-loop-driver.mjs` | 改：同上 | WP-6 |
| `test/fixtures/recovery-driver.mjs` | **新增**：`checkpoint-advance` / `dialect-resume` / `redeliver` / `e2e` 四场景 | WP-6 |
| `test/fixtures/recovery/human-node-state.json` | **新增**：`human` 节点 `running` 预置夹具（AC-37） | WP-6 |
| `test/fixtures/recovery/graph-timeout.json` | **新增**：审核节点 `timeout: 2` 的图注入口夹具（AC-45） | WP-6 |
| `test/wp13/fixtures.test.js` | **新增**（D-10 下限 8 文件之外补 1）：M-7 接缝 / 夹具契约自检 | WP-6 |
| `test/wp11/role-schema.test.js` | 改（**D-9 第一行，只有 `:57` 一行**）：`ROLE_OPTIONAL_KEYS` 追加 `'session_policy'` | WP-7 |
| `test/wp4/orchestrator.test.js` | 改（**D-9 第二行，`:480/575/578/580/584~586`**）：按实例记录恢复；`:588~592` 一字不改 | WP-7 |
| `probe/acc8-f-{lib,common,run,final}.mjs` | **新增占位（S3 验收期）**：脚手架四件套，路径常量 `ACC8_PATHS` | WP-7 |
| `probe/acc8-cases/` / `probe/acc8-f-parts/` | **新增占位（S3）**：逐 AC 用例（目录不带 `-f`）+ 核对表分片 | WP-7 |
| `probe/acc8-f-{results.jsonl,summary.json,blockers.md}` | **新增占位（S3）**：结果 / 汇总 / 缺陷台账 | WP-7 |
| `docs/iterations/iteration-8/evidence/**` | **新增占位（S3）**：`AC-XX.<阶段>.<类型>` 原始帧（state / events / stdout / status），真实宿主面与夹具面分目录 | WP-7 |
| `docs/iterations/iteration-8/{report,final-verification,acceptance-fixture,acceptance-product}.md` | **新增占位（S4 收口，非本拆分 / 非 S2 实现交付）**：实现报告 / 终验 / 两 faces 验收文档 | 主控 / 终验 Agent |

**占位说明**：`test/wp13/**` 9 个文件、3 个新夹具、`recovery-driver.mjs` 与 `probe/acc8-*` 全部为「新增」；`probe/acc8-*` 的脚手架命名严格照模板 §3.1（文件带 `-f-`、用例目录 `probe/acc8-cases/` **不带** `-f`、路径常量 `ACC8_PATHS` 不沿用 `ACC3_PATHS`），本拆分不创建、不写 probe 脚本、不提交 git。除 `docs/iterations/iteration-8.md` 外，本阶段不落任何新文件到仓库。

## 6. 依赖与并行策略

**DAG（文本图；依赖编号 WP-1~WP-7 全部存在、无环）**

> 约定：箭头 `A ──> B` = **B 依赖 A**（A 先就绪、B 后开工）。下方「依赖边清单」与 §4 各 WP 标题 /「依赖」字段逐字一致，是 DAG 判定的唯一依据；ASCII 图仅为分层示意。

```
批次 0：契约先冻结（§6 的 10 个冻结点；所有 WP 的共同前置，不占 Agent 名额）
   │
   ├──> WP-1 检查点与持久化契约       依赖：无    [第 1 层 · 叶子]
   ├──> WP-2 ACP 恢复方言             依赖：无    [第 1 层 · 叶子]
   ├──> WP-5 文案与渲染唯一来源       依赖：无    [第 1 层 · 叶子]
   └──> WP-6 夹具 / 接缝 / 现场构造   依赖：无    [第 1 层 · 叶子 · 单线]

WP-1 ──> WP-4    WP-2 ──> WP-4    WP-5 ──> WP-4
   WP-4 恢复编排内核（orchestrator.js 超集文件唯一负责人）   [第 2 层 · 汇合点]
   依赖：WP-1 + WP-2 + WP-5 + 批次 0 冻结契约
   不依赖 WP-3：session_policy 经「角色对象带该字段」的冻结契约读取
   导出 selectReusableSession（§2.3 冻结契约，供 WP-3 import，不改超集文件）

WP-4 ──> WP-3    WP-5 ──> WP-3
   WP-3 session_policy / 复用配置                           [第 3 层]
   依赖：WP-4 的 selectReusableSession 导出契约 + WP-5 文案契约

WP-3 ──> WP-7    WP-4 ──> WP-7    WP-6 ──> WP-7
   WP-7 授权断言 / 架构门禁 / 真实宿主面                   [第 4 层 · 末端]
   依赖：WP-3 + WP-4 + WP-6
```

拓扑序：批次 0 → {WP-1, WP-2, WP-5, WP-6} → WP-4 → WP-3 → WP-7。依赖边集合（后者依赖前者）：`WP-4 ← {WP-1, WP-2, WP-5}`、`WP-3 ← {WP-4, WP-5}`、`WP-7 ← {WP-3, WP-4, WP-6}`。**叶子** WP-1/2/5/6、**中间** WP-4（汇合点）→ WP-3、**末端** WP-7。**无环**：WP-4 的依赖列表不含 WP-3（只在「角色对象带 `session_policy` 字段」的冻结契约层感知 WP-3 产物，不构成对 WP-3 实现文件的依赖）；WP-3 依赖的是 WP-4 的导出契约、方向不反；WP-7 只作汇合末端、无出边；所有依赖编号 ∈ {WP-1..WP-7}，无回边、无悬空编号。图中顶部四条 `──>` 仅表示「批次 0 共同前置」，**不代表四个叶子都汇入 WP-4**（WP-6 不汇入 WP-4，它直连 WP-7）。

**分批顺序（一次最多 2 个 Agent；模板 §2.3）**

- **批次 0（不占 Agent）**：契约先冻结 —— 下列 10 个冻结点由本拆分文档定死，其余包才能并行。
- **第 1 批（2 Agent 并行）**：WP-1 + WP-2 —— 两个零 IO 叶子纯内核，互不依赖、无共享文件。
- **第 2 批（2 Agent 并行）**：WP-5 + WP-6 —— 文案基座与夹具接缝互不依赖；WP-5 是 WP-3 / WP-4 的前置，WP-6 按理解纪要 §8.3「单线处理 F 维度」在本批内独占夹具文件、不与 WP-5 共享。
- **第 3 批（1 Agent，单线）**：WP-4 —— `orchestrator.js` 超集文件唯一负责人，依赖 WP-1/2/5 与全部冻结契约就绪，单线改动。
- **第 4 批（1 Agent）**：WP-3 —— 依赖 WP-4 的 `selectReusableSession` 导出 + WP-5 文案；`:57` 授权断言留到 WP-7 同批处置。
- **第 5 批（1 Agent，末批单线）**：WP-7 —— D-9 两行授权断言（改后必红是预期、修复类单线）、D-11 门禁、真实宿主面单独一批取证；`probe/` / `evidence/` 由主控单独提交。

**契约先冻结点**（逐字写冻结什么；冻住后其余包可并行，否则联调时互相改对方接口；对齐理解纪要 §8.2 的 8 条 + 用户点名项）：

1. **`checkpoint/v1` 字段形状**：逐字冻结附录 D-3 `:1210~1231` 样例的全部键（`schema` / `instanceId` / `rev` / `checkpointId` / `writtenAt` / `coreGeneration` / `instanceState` / `paused` / `halted` / `template` / `cwd` / `task` / `graph` / `nodes` / `sessions` / `handoffs` / `escalations` / `artifactRefs`）+ `loadCheckpoint` 返回 `{ok:true, checkpoint}` / `{ok:false, code:'CHECKPOINT_UNREADABLE'}` + `checkpointPath(root,id)` + 写点顺序「**实例记录 → 检查点 → 事件广播**」+ 写失败只发一次 `checkpoint.write_failed`。WP-1 与 WP-4 共用。
2. **`transit(instanceId, 'node', to, { phase, ... })` 签名与 `phase` 校验表**：逐字冻结 D-2 `:1189~1198` 的 6 组合法迁移 `blocked→ready` / `ready→assigned` / `assigned→running` / `running→assigned`（恢复时会话不可恢复）/ `assigned→cancelled` / `assigned→escalated`；其余组合一律 `rejected / illegal_transition` 且磁盘不动；`phase` 只在 `pending` / `running` 出现、其余状态带 `phase` 视为非法；位置与 `state` **同一次 CAS** 完成、不新增自环迁移；`NODE_STATES` 仍 7 项。WP-4 / WP-5 / WP-6 共用。
3. **`resumeOrCreate` 返回结构**：逐字冻结成功 `{restored, dialect, attempts}`（`dialect ∈ {resume, load, new}`）与全失败 `{ok:false, code:'SESSION_RESTORE_FAILED', attempts}`；冻结能力归一化 `canResume = Boolean(sessionCapabilities.resume)` / `canLoad = Boolean(sessionCapabilities.load || initialize.loadSession === true)`（C-07 / D-4）；冻结每次回退的 `recovery.dialect` 事件 `detail` 形状 `{from, to, reason}`。WP-2 与 WP-4 / WP-7 共用。
4. **`recovery` / `connections` 追加键**：逐字冻结「仅在实例带 `recoveredAt` 时、追加在 `current` 之后」；`recovery` 恰 4 键 `checkpointAt` / `skipped` / `round` / `maxRounds`；`connections[]` 每项恰 4 键 `from` / `to` / `kind` / `aggregate`；非恢复实例仍 **11 个顶层键**且顺序不变、`graphVersion` 仍 1（A-4 / A-9 / M-8）。WP-4 与 WP-5 共用。
5. **`session_policy` 键序与「缺省不注入渲染」**：逐字冻结 `ROLE_KEY_ORDER` 中 `session_policy` 放在 `max_concurrent_sessions` 之后、`ROLE_OPTIONAL_KEYS` 末尾追加 `'session_policy'`、`ROLE_ALIASES` 增 `sessionPolicy`；**「加载器不得把缺省 `fresh` 注入角色对象用于渲染；缺省值只在派发选择时生效」**（D-13 `:1412`）；`ROLE_SESSION_POLICY_INVALID` 文案 `会话复用策略不合法：{value}（可选 reuse / fresh）`（A-10）。WP-3 与 WP-5 共用。
6. **M-7 接缝名与取值域**：逐字冻结 `MAESTRO_TEST_PAUSE=after_assign[:<节点>]` / `after_handoff_created[:<包号>]`、`MAESTRO_FAULT=checkpoint_write:fail`、`MAESTRO_TEST_SLOW_MS`、`MAESTRO_TEST_RECOVERY_HOLD=after_assign`、`MAESTRO_TEST_GRAPH=<绝对路径>`、`MAESTRO_MOCK_CAPS=resume/load/both/none`、`MAESTRO_MOCK_RESUME=ok/fail`、`MAESTRO_MOCK_LOAD=ok/fail`、`MAESTRO_MOCK_NEW_FAIL=1`、`MAESTRO_MOCK_CRASH=after_first_update/twice`、`MAESTRO_MOCK_SLOW=1`、`MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1`、`MAESTRO_MOCK_PROMPT_FAILURES=<n>`、`MAESTRO_MOCK_PROMPT_LOG=<路径>`；全部 `NODE_ENV=test` 生效。WP-6 与 WP-4 / WP-5 共用，先冻后各包才能并行造现场。**另有 2 个现状既有接缝 `MAESTRO_TEST_STOP_AFTER` / `MAESTRO_TEST_DELIVERY_DELAY_MS`（`src/core/orchestrator.js:351`/`:367`）按既有语义复用、不属本迭代新增冻结项**（M-7「不改既有参数语义」/ 需求 `:1360`、§2.13、冻结点 7 已声明复用既有参数）；故需求环境名 17 与本冻结点新增 15 的差集恰为这 2 项，17/15 差集可机检自洽、无需求外夹带。
7. **mock agent 与两个 driver 的接缝扩展（不改既有参数语义）**：逐字冻结「driver 读 `MAESTRO_MOCK_*` 环境后转成**既有同一组命令行参数**（`--prompt-failures` / `--hold-session` 等），**不改既有参数语义、不改既有场景分支、不改既有断言**」（D-10 `:1360`）；`MAESTRO_TEST_PAUSE` 白名单扩两个新值但既有三值 `after_accepted` / `after_output` / `after_verdict` 分支语义不变；`MAESTRO_TEST_GRAPH` 仅在 `NODE_ENV=test` 且显式设置时生效、生产路径不读、CLI `--template` 仍只接受三张内建图。WP-6 与 WP-4 / WP-7 共用。
8. **D-9 两行授权断言的「改后期望值」**：逐字冻结 `test/wp11/role-schema.test.js:57` 数组末尾追加 `'session_policy'`；`test/wp4/orchestrator.test.js:480`（标题）/ `:575` → `[]` / `:578` → `'running'` / `:580` → 「节点仍 `running` 且无 stopped note」/ `:584~586` → 「无 `core.gone`，有 `recovery.*` 事件」，统一按「**按实例记录恢复**」；`:588~592`「v1 实例必须一字不改」**保持原样**（裁-5）；除这两行外 `test/**` 一个字符不许改。**改后必红是预期**。WP-7 与 WP-3 / WP-4 共用。
9. **`recoverInstance()` / `reconcileOnBoot` 六步对账顺序与新增实例键**：逐字冻结 D-5 的 6 步（选图 `checkpoint.graph` 优先 / 节点对账 `done` 跳过·`review` 重新核对·`running→assigned`·`assigned` 保持·`pending` 保持·特殊节点保持 / 会话对账按 D-4 方言 / 写恢复事件与检查点并置 `recoveredAt`·`coreGeneration` / 从 `assigned`·`ready` 继续调度 / 任一致命错误 `interrupted` + `恢复失败`）+ `CORE_BOOT_RECOVER` 启动日志形状 + 恢复摘要事件 `recovery.summary` 的 4 字段（C-06）。WP-4 与 WP-1 / WP-7 共用。
10. **`selectReusableSession` 纯函数签名**：逐字冻结 `selectReusableSession(sessionList, { instanceId, roleId, hostId, nodeId }) → session | null`，判定条件「同实例 / 同 `roleId` / 同 `hostId` / `state === 'idle'` / `servingNodeId` 为空或等于当前节点」、角色 `status ∈ {available, cooldown}` 只用于筛选候选角色（C-15 / D-13）；该函数是 `orchestrator.js` 的**唯一新增导出**，WP-3 通过 §2.3 契约 import、不改超集文件。WP-4 与 WP-3 共用。

**整合检查点（每批合入后跑；命令与预期数字逐条给全，模板 §2.5 门禁四件套）**

```bash
cd /d/WWW/Maestro

# 1) 全量测试（下限断言，不写死条数）
node --test --test-concurrency=4 "test/**/*.test.js"
#   预期：与 origin/main 失败用例名集合差集 = 0；条数 tests >= 992（只增不减）；
#        EPERM / C 盘盘符 / EBUSY 既有噪声不计新增失败；不要求零失败
#        test/wp10/perf.test.js 偶发 p95 越线先单跑 node --test test/wp10/perf.test.js 判噪声，不放宽预算

# 2) 架构纯净五条（D-11 逐字，AC-54；$COMMON 31 词 / $NOCOORD 30 词）
COMMON="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
NOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"                                  # exit 0
node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"                                       # exit 0
node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"  # exit 0（三文件口径不得收窄）
node -e "console.log(Object.keys(require('./package.json').dependencies ?? {}).length)"                            # 输出 0
node -e "const fs=require('fs'),p=require('path');const roots=['src/registry','src/cli/roles.js','src/cli/skills.js','src/cli/workflows.js'];const bad=[];const cjk=t=>[...t].some(c=>{const n=c.codePointAt(0);return n>=0x4e00&&n<=0x9fff;});const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(cjk(fs.readFileSync(d,'utf8')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join('\\n'));process.exit(1);}console.log('OK: no CJK');"  # 输出 OK: no CJK

# 3) 零运行时依赖（与 #2 第 4 条同口径）
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"               # 输出 0

# 4) D-9 两个授权文件（改后必红是预期，改完按「按实例记录恢复」全绿）
node --test test/wp11/role-schema.test.js
node --test test/wp4/orchestrator.test.js
#   预期：仅 :57 与 :480/575/578/580/584~586 两行授权改动；:588~592 一字不改；改完 33/33 与既有全绿

# 5) 用法块 / 命令树 / 11 键 JSON（AC-55 / A-9）
node bin/orch.js --help
node bin/orch.js recover
#   注（S-06）：--help 未注册，是「未知命令触发用法块」路径，exit 2，输出 25 行用法块
#        + 第 26 行「（未知命令：--help）」；CLI 没有可用的 help 参数，不得误读为「help 参数可用」。
#        S3 取证 USAGE_LINES.length === 25 与前 8 行逐字，应直接断言 src/cli/labels.js 的
#        USAGE_LINES 常量（而非依赖 --help 输出）；orch recover 退 2 才是 AC-55 的正式断言。
#   预期：USAGE_LINES.length === 25、前 8 行逐字、COMMANDS 不含 recover、orch recover 退出码 2
#        非恢复实例 instance graph --format json 恰 11 个顶层键且顺序不变

# 6) 三条主链逐字回归（AC-52；基线 = 集成版 d4b0f94，不是 0cd113b；%TEMP% 独立根）
SMOKE="$TEMP/i18-smoke"; mkdir -p "$SMOKE"
BASE="$SMOKE/base"; git worktree add --detach "$BASE" d4b0f94   # git -c core.autocrlf=false 避免 CRLF 干扰
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$SMOKE/code" --scenario pass --cwd "$SMOKE/code/demo" --task "$CODE_TASK" --reset
NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root "$SMOKE/task" --scenario doc-pass --cwd "$SMOKE/task/demo" --task "$DOC_TASK" --reset
#   single 走 bin/orch.js run（mock host，NODE_ENV=test）；三链在 BASE 同参各跑一次
#   归一化：剔除夹具自述行、已运行 Ns、HH:mm:ss、mock-sess-* 后与 BASE 输出 diff
#   预期：三份 diff 均为空（exit 0）；提交内容统一 LF、比对前确认 LF 规范化

# 7) 整批合入后的 AC-56 四锚点（I1.7 边界）
test ! -e src/core/worktree.js ; grep -R "worktree" src/ | wc -l            # 0
grep -R -E "artifact_type.*dir|merge.*order" src/core src/daemon | wc -l   # 0
test ! -e docs/iterations/iteration-7/requirement.md                        # NOT_EXIST
#   预期：报告登记「I1.7 合入后 67 条 AC 全部重跑」
```

**每批预期数字汇总**：`tests >= 992` 且失败集合差集 = 0、`dependencies` = 0、D-11 五条全 `exit 0`（#4 输出 `0`、#5 输出 `OK: no CJK`）、25 行用法块 / 11 键非恢复 JSON / 13 键恢复 JSON、26 资产 / 16 角色 / 10 技能计数不变、D-9 仅两行授权改动、三条主链归一化 diff 空、**67/67 AC**（含真实面 4 条阻塞口径）。第 3 批（WP-4）合入后追加 `recovery.summary` 事件数 = 1 与轮次 `2/3` 机检；第 5 批（WP-7）合入后追加真实面隔离 `DSH_HOME` 守卫与「I1.7 合入后重跑」登记。

## 7. 风险与降级

> 逐条 `风险 | 影响 | 处置（点名文件 / 函数 / AC）`。第 1~8 条逐条覆盖用户点名的 6 个必须吸收项 + 理解纪要 §8.3 的并行风险面；第 9~20 条补回归红线、模板 §5 / §7 硬约束与需求附录 D 的具体约束。

| # | 风险 | 影响 | 处置（点名文件 / 函数 / AC） |
|---|---|---|---|
| 1 | **`src/core/orchestrator.js` 是超集文件**（4800+ 行：检查点写点、`reconcileOnBoot`、恢复、崩溃/慢、复用、渲染数据来源全在它），多 WP 各改一段会互相覆盖 | §1.4 规则 1；理解纪要 §8.3 第一条；AC-01~67 大半 | **指定 WP-4 唯一负责人**；WP-1 通过 `checkpoint.js` 的 `writeCheckpoint` / `loadCheckpoint` 契约、WP-2 通过 `resumeOrCreate`、WP-3 通过 `selectReusableSession` 导出契约、WP-5 通过 `labels` / `render` 契约、WP-6 通过 M-7 接缝调用，**一律不改超集文件**；`transit()`（`:537`）/ `saveState()`（`:441`）/ `snapshotOf()`（`:3819`）/ `reconcileOnBoot()`（`:3894`）的改动全部收敛在 WP-4 单线批次（§6 第 3 批 1 Agent） |
| 2 | **三主链逐字基线是集成版 `d4b0f94`，不是 I1.6 的 `0cd113b`**；I1.4 改写过 `render.js`，集成后输出相对旧基线预期有变化（O-I2），I1.6 AC-49 逐字断言不能直接套 | AC-52 / BR-44 / `index.md:711` / 集成说明 §5 O-I2 / 纪要 §7.2 红线 1 | S3 以 `git worktree add --detach <TEMP> d4b0f94`（`git -c core.autocrlf=false`）**重建逐字基线**，同参跑 `single` / `code-loop` / `task-loop` 归一化 diff（§6 检查点 #6）；**不能因「对不上旧基线」而放宽** AC-52 的逐字判定（模板 §0.1 铁律 1 / §7 红线 2）；比对前剔除夹具自述行与易变量 |
| 3 | **D-9 授权断言两处改后必红**：`test/wp11/role-schema.test.js:57`（M-5 加 `session_policy`）与 `test/wp4/orchestrator.test.js:480/575/578/580/584~586`（M-4 改 `reconcileOnBoot`）；`:588~592`「v1 实例必须一字不改」若被误改将破坏 v1 兼容 | D-9 / 裁-5 / DoR-6 / AC-53；「改后必红是预期」 | WP-7 单线处置：`:57` 数组末尾追加 `'session_policy'`；`:575`→`[]`、`:578`→`'running'`、`:580`→节点仍 `running` 无 stopped note、`:584~586`→无 `core.gone` 有 `recovery.*`；**`:588~592` 一字不改**；其余 `test/**` 一个字符不动，新增断言一律 `test/wp13/**`；不得为保绿弱化功能或扩大改动范围（§6 检查点 #4） |
| 4 | **`autocrlf=true` 行尾坑**：本机 `core.autocrlf=true`，新 worktree 检出把资产 / 夹具文本转成 CRLF，导致 `assets.test.js` 逐字节样本与 `instance-store.test.js` 的 `SHA256SUMS` 断言失败 | 集成说明 §3#5 / §4 / 纪要 §7.2 红线 7；AC-53 失败集合差集口径 | 这是**检出环境差异、不是合并缺陷**；提交内容一律 **LF**（与主工作区 / `origin/main` blob 一致），本拆分文档亦用 LF 写；`git worktree add` 用 `git -c core.autocrlf=false`，比对前确认 LF 规范化；全量失败集合差集判定时不把 CRLF 引起的样本差异算作新增失败（但不许借此放宽 AC） |
| 5 | **真实宿主面阻塞口径**：AC-25 / AC-26 / AC-27 / AC-57 无 DSH CLI 时判「阻塞」，**不得用夹具冒充**；本机 `command -v dsh` / `dsh-acp-server` 为 `NOT_FOUND` | BR-48 / NFR-08 / AC-25 `:584` / AC-27 / AC-57 / 模板 §3.4「阻塞不算失败，伪通过才是」 | WP-7 末批单独一批取证：隔离 `DSH_HOME`（`%TEMP%` 新建 + **复制** `~/.dsh/.credentials.yaml` + 用完删除）、项目根 `%TEMP%`、`stat -c %Y ~/.dsh` 前后相同、`git status --porcelain` 不含仓库内新增项目根；无 DSH / 无凭据 / 无法安装第三方一律判「**阻塞**」并在报告写清尝试路径；AC-27 的 load 语义由 AC-20 夹具兜底但**兜底不等于真实面取证**；结项带阻塞须补齐观测路径或取得书面豁免，不许改写成「通过」 |
| 6 | **I1.7 合入后必须重跑 67 条 AC**：当前 `origin/main` 不含 I1.7（worktree / 产物类型隔离），恢复只认现有 `artifactRefs`；合入后若 `artifactRefs` 指向 worktree 路径，重启可能失效 | BR-47 / C-16 / AC-56 / B-01 / 纪要 §7.3；§3.3#10 | 恢复实现（WP-4）**不得读取 / 推断 worktree 路径**、`artifactRefs` 原样保留（R-9）；AC-56 四锚点留痕（`src/core/worktree.js` 不存在、`grep -R "worktree" src/ | wc -l` = 0、`artifact_type.*dir|merge.*order` 无命中、`iteration-7/requirement.md` 不存在）+ 报告登记「**I1.7 合入后 67 条 AC 全部重跑**」；由 I1.7 产物语义复核恢复规则，若改变 `artifactRefs` 语义在 I1.7 报告追加交叉说明；B-01 标「不阻塞本迭代、**阻塞最终联合验收**」，收口时不得带此未决项宣布联合验收完成 |
| 7 | **渲染与文案双文件**：`src/cli/render.js` 同时承载恢复行 / 恢复块（M-6）与 JSON 追加键（M-8）；`src/cli/labels.js` 是中文唯一来源，二者若分给两个 WP 会互相覆盖 | 理解纪要 §8.3 第二条 / §1.4 规则 1 | 两文件**同归 WP-5 唯一负责人**（§2.10 / §2.11），按「冻结点 4」把 `recovery` / `connections` 键形状定死后包内串行收敛；既有 `renderGraphJson`（`:1302`）/ `renderRoleShow`（`:1423`）/ `USAGE_LINES`（`:183`）一字不动，优先改传入变量值（模板 §5#8） |
| 8 | **mock agent 与两个 driver 的接缝扩展**被方言域 / 崩溃慢域 / 复用域同时需要，多包各加一套开关会让既有场景漂移 | 理解纪要 §8.3 第三条 / D-10 `:1360` / M-7 | **WP-6 单线**独占 `test/fixtures/mock-acp-agent.js` 与两个 driver（§6 第 2 批内单线）；新 `MAESTRO_MOCK_*` 由 driver 转成**既有同一组命令行参数**（`--prompt-failures` / `--hold-session`），不改既有参数语义 / 场景分支 / 断言；`test/wp13/fixtures.test.js` 逐字自检四组能力广告与接缝取值域 |
| 9 | 9 态 `phase` 投影被实现成直接扩 `NODE_STATES` / 为恢复新增自环迁移 / 先写 `phase` 再写 `state` 两次 CAS | 裁-1 / D-1 `:1155` / D-2 / C-01 / C-02 / AC-01 / AC-59 / AC-60 | WP-4：`src/core/state-machine.js` 的 7 项表与迁移边**边界守护不动**；`transit()` 按 D-2 六组合法表在写盘前校验、非法落 `rejected / illegal_transition` 磁盘不动；`phase` 与 `state` 同一次 CAS；恢复保持 `blocked` / `ready` / `assigned` 原位置、不写 `assigned→assigned`；`snapshotOf()` 只读投影；`status.md` 看板列词与 CLI 精确位置两种粒度按 `index.md:166` 裁决、不改 `src/core/status-text.js` 词表（B-17） |
| 10 | 检查点被当成第二份真相 / 写失败停止推进 / 从检查点静默重建损坏实例 | R-2 / R-10 / C-05 / C-11 / BR-05 / BR-06 / AC-04 / AC-06 / AC-18 | WP-1 + WP-4：实例记录**主真相**优先；`loadCheckpoint` 返回 `CHECKPOINT_UNREADABLE` 不写任何文件；`checkpoint.rev > state.rev` 只告警不采纳；实例记录不可读维持既有 `markCorrupt` / `state.json.corrupt` 备份；写失败只发一次 `checkpoint.write_failed`、退出码不变；角色实例 / 连接线聚合**派生视图不落盘**，按 `role_to_sessions` 与交接包优先级重算；恢复摘要 `recovery.summary` 每实例每代仅 1 份 |
| 11 | 崩溃与慢混用一套提示 / 用 `stopReason` 判成败 / 无限重建 / 未声明 `timeout` 擅自失败 | C-12~14 / BR-36~40 / BR-52 / AC-42~47 / AC-63 / R-7 / B-08 | WP-4 按 D-8 两套判据：transport `onExit` / `DSH_SPAWN_FAILED` → 崩溃（`session.crash`、最多重建 1 次、轮次不变、二次崩溃直接升级）；进程存活超 `SLOW_MS` 无 `session/update` → 慢（`session.slow`、不重建、声明 `timeout` 才写 `failed_reason: timeout` 并升级）；`stopReason` 不参与；两类 A-6 文案逐字互斥（AC-47）；会话升级沿用基线既有「已升级」红色圆点、不新增会话态 / CLI 输出（裁-3） |
| 12 | 方言按宿主名分支 / 静默回退 / `resume`·`load` 成功后重发已完成节点历史 | C-07~09 / BR-21 / BR-23 / AC-19~24 / AC-54 | WP-2：只看 `initialize` 能力广告（`canResume` / `canLoad`）与角色策略，不写 `if (host === 'dsh')`；每次回退产出 `attempts` 供 WP-4 落 `recovery.dialect` + A-3 逐字回退行；`resume` 成功不假设历史、`load` 成功不重投已完成历史、已完成节点永不重发；`src/core` / `src/daemon` 不出现宿主名分支（D-11 `:1393`） |
| 13 | `session_policy` 缺省 `fresh` 被注入渲染对象 / 非法值未拒 / 复用跨实例跨宿主 / 复用占用会话 | D-13 / C-15 / A-5 / A-10 / AC-48~51 / AC-65 / AC-66 | WP-3：加载器**不注入缺省**、`role show` 仅在源对象显式声明时追加 A-5 行；`checkRoleShape` 报 `ROLE_SESSION_POLICY_INVALID`；`selectReusableSession`（WP-4 导出）按 idle + 同实例 / 同角色 / 同宿主 + `servingNodeId` 为空判定；26 内置资产、`role list` / `validate` 计数、`role show developer` 六行逐字不变 |
| 14 | 31 词禁词扫描英文注释命中 / 误用 `DEFAULT_FORBID` 4 词 / 第 3 条被收窄成单文件 / 为让扫描变绿改 `labels.js`·`render.js`·`main.js` 注释 | AC-54 / BR-45 / D-11 / 裁-2 / 模板 §7 红线 6 | WP-7 整合检查点 #2 逐字用 `$COMMON` 31 词 / `$NOCOORD` 30 词；`purity-check.mjs` 的 `DEFAULT_FORBID` 只有 4 词、**必须显式 `--forbid` 传全表**（英文注释也算）；第 3 条按 I1.6 D-9 **三文件口径** `roles.js,skills.js,workflows.js` 不得收窄；`labels.js` / `render.js` / `main.js` 合法持有模板名与角色名、不进命令且不得改注释（当前 HEAD 实测 34 处命中、exit 1，属预期）；新增实现零 CJK（#5 `OK: no CJK`） |
| 15 | AC-54 内嵌的 D-11 五条命令副本与附录 D-11 不一致 / S3 只引用 D-11 不按 AC-54 正文取证 | 裁-4 / §3.3#9 / DoR-12 / AC-54 | **WP-7** 逐字守 `test/fixtures/purity-check.mjs`（`--forbid` 显式传 31 词全表、`DEFAULT_FORBID` 仅 4 词不默认启用、第 3 条三文件口径）：§6 检查点 #2 的命令块与 D-11 逐字同形（`$COMMON` 31 词、`$NOCOORD` 30 词、五条命令）；两部分**一字不改、任何一侧修改都要同步**；S3 用例按 **AC-54 正文**内嵌副本取证，不得只引用 D-11；五条实跑全 `exit 0`、#4 输出 `0`、#5 输出 `OK: no CJK`；`src/cli/labels.js` / `render.js` / `main.js` 合法持有模板名与角色名、不进第 3 条命令且不得改注释（裁-2） |
| 16 | 全量测试写死 992 / 要求零失败 / `test/wp10/perf.test.js` 偶发 p95 越线被误判为回归 | AC-53 / D-10 / 模板 §2.5 / §5#14 / §5#22 / 集成说明 §4 | 用「失败集合差集 = 0 + `tests >= 992` 只增不减」下限式，不写死通过数、不要求零失败；`--test-concurrency=4` 稳定门禁；perf 偶发 1~2 条（p95 ≤ 50ms 实测 55~56ms）先单跑 `node --test test/wp10/perf.test.js`（应 2/2）判测量噪声，**不许放宽预算或删用例**；需求 992/988/4 与集成版 992/987/5 差 1 条属噪声浮动，如实登记、不声称复核了全量数字 |
| 17 | 状态迁移被恢复 / 重投 / 复用旁路直接 `store.save` 改状态；`rev` 回 1；事件先广播后落盘；`ts` 与状态变更差 4~8ms；`seq` 不单调 | 模板 §5#1~#6 / BR-02 / AC-01 / C-02 | WP-4 守「状态迁移唯一入口 `transit()`」：以磁盘最新快照为 `from` 重校验 + `save(expectedState)` CAS；`rev` 无条件基于磁盘现值递增；事件**先落盘再广播**、`emit` 失败不改内存状态；事件 `ts` 复用状态变更同一时刻（`startedAt` / `endedAt` 不各自 `iso()`）、`seq` 严格单调、`ts` 不早于同实例上一条；`checkpoint` 写点在 `saveState()` **之后**（C-03 顺序） |
| 18 | 验收项目根放进仓库 / 并发场景 > 10 个 / `driver --keep` 强杀退出码 13 被当成产品码 / `orch core stop` 被误用来模拟强杀 / 提示词用相对路径 | 模板 §0.3 / §3.2 / §5#7 / §5#12 / §5#13 / §5#21 / §3.3#4 / §7 红线 3 | 所有项目根 `%TEMP%/maestro-i18/<AC>` / `fs.mkdtemp(os.tmpdir())`，**绝不放仓库内**；同进程串行 > 10 场景先 `forceKillCore`；退出码断言只对完整跑做（`--keep` 强杀可能是 13）；强杀从 `.orch/core.json` 读 pid 用 `kill -9` / `taskkill //F //PID`，**不用 `orch core stop`**（后者是显式中断、语义不同，AC-16）；提示词一律**绝对路径**（`src/core/advance.js` 的 `planAdvance` 经 `promptText`）；`evidence/**` / `probe/**` 由主控单独提交、禁止 `git add -A` |
| 19 | 新增 CLI 命令 / 用法块被扩到 26 行 / 非恢复实例 JSON 多出 `recovery`·`connections` / `role show developer` 多出复用行 / 内置资产被改 | BR-46 / R-12 / A-9 / A-5 / M-5 / D-12 / AC-48 / AC-52 / AC-55 | `COMMANDS` 保持 7 个、`USAGE_LINES.length === 25` 且前 8 行逐字、`orch recover` 退 2（WP-4 / WP-5 / WP-7 共同守）；`renderGraphJson` 仅 `recoveredAt` 时追加 2 键、非恢复 11 键顺序不变；`role show` 仅显式声明 `session_policy` 时追加行；26 个内置资产一个字节不改；`status.md` 词表不改 |
| 20 | B-07 / B-08 / B-09 / B-12 / B-13 等「需评审裁决」项被实现期悄悄改口径；或把范围内条目挪到范围外让覆盖表变绿 | §1.2「只能补不能减」/ 模板 §7 红线 2·14 / 附录 B / 需求 §1.3 | **WP-5** 守 `src/cli/labels.js`（`USAGE_LINES` / `NODE_PHASE_LABEL` 中文唯一来源、只增不改）、**WP-4** 守 `src/core/orchestrator.js` 的超时判定：拆分一律**按需求 v3 已选口径**落地：检查点写失败「告警继续」（R-10 / BR-06 / AC-04）、未声明 `timeout`「不擅自失败」（R-7 / AC-46）、字段名 `session_policy`（B-09，按裁-6 已裁决、不改名）、`assigned` 显示「已分配」+「等待重新分配会话」（B-12 / A-1）、恢复行只在 `recoveredAt` 时条件追加（R-12 / B-13 / A-2）；这些项在 §8 如实登记为「已裁决（不阻塞）/ 按需求已选口径」，**不阻塞开工、不在实现里改需求、不删 AC、不放宽 Then、不把范围内挪到范围外**；冲突一律「以需求为准」并留痕 |

## 8. 与需求的对齐声明 / 冲突清单

**本文档不新增需求条目。所有逐字文案、状态名、错误码、AC 编号均以 `docs/iterations/iteration-8/requirement.md` **v3** 为准；两者冲突时**以需求为准**并在实现结论中指出。** 裁决优先级固定为（模板 §2.8，与 `decisions.md` 抬头一致）：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > M/C 契约清单 > 规划文档 > 代码现状`；**代码现状排最后**——它只能说明「以前怎么做」，不是标准。本文档是 S1 拆分产物：不改需求正文、不增删 / 合并 AC 与 BR、不放宽任何 Then、不把范围内条目挪到范围外、不夹带规划外新能力、不实现代码、不写验收用例与 probe 脚本、不提交 git；所有自主裁决按 §2.8 记 `decisions.md`（本拆分不新增裁决行）。

**冲突清单（需求 v3 原文 vs 代码现状，逐条给裁决 / 处置与依据）**

| # | 冲突（需求原文 → 代码现状） | 裁决 / 处置 | 依据 |
|---|---|---|---|
| 1 | M-1「9 个精确位置 + `transit()` 可选 `phase` 校验」→ `src/core/state-machine.js:43` `NODE_STATES` 实为 **7 项**；`orchestrator.js:537` `transit` 现状无 `phase` 参数；`src/core` Grep `\bphase\b` 命中 0 | **裁-1 定论**：§2.2 保留「状态机」原文（规划 815 逐字含「状态机」，不得换名收窄）；用户可见位置以基线 **9 态**为准，代码 **7 项 + 位置投影**在附录 D-2 写清一一映射；**不改** `NODE_STATES` 7 项与既有迁移边；AC-01 机检锚点写真实 **7 项**并同时断言 9 态投影齐全（不得虚报 6 项）；B-11 已裁决、不再作为待裁决项 | 裁-1 / R-1 / R-13 / D-2 / D-1 `:1155` / AC-01 / B-11 |
| 2 | M-3「`resume → load → new` 回退链」→ `src/adapter/acp-client.js:314~328` 现状 `resumeOrCreate` 只走 `newSession`，注释明写「会话恢复留给 I1.8」 | 按需求实现 `normalizeCapabilities` / `resumeSession` / `loadSession` / 回退链；`newSession` / `prompt` / `cancel` / `closeSession` 签名与行为**不变**，`fresh` 仍走 `newSession`；只按能力广告分支、不按宿主名（C-07）；现状注释属「以前怎么做」、不是标准 | M-3 / D-4 / C-07~09 / BR-17~23 / AC-19~27 / 纪要 §3.2 M-3 行 |
| 3 | M-4「`running`/`created` 且有检查点或内建模板 → `recoverInstance()`」→ `orchestrator.js:3894~3911` `reconcileOnBoot` 现状把 `running` 一律 `markInterrupted('core.gone')` | **直接冲突并必须改**：D-9 第二行授权 `test/wp4/orchestrator.test.js:480/575/578/580/584~586` 改「按实例记录恢复」期望，**改后必红是预期**；`:588~592`「v1 实例必须一字不改」保持原样（裁-5）；`interruptAll`（`core stop`）不变、终端状态不变、无检查点且模板未知旧实例仍 `interrupted` | M-4 / D-5 / D-9 / 裁-5 / BR-09~12 / AC-05/09~18 |
| 4 | M-5「角色新增可选键 `session_policy`」→ `src/registry/role-schema.js:39` `ROLE_OPTIONAL_KEYS` 现状 5 键；`test/wp11/role-schema.test.js:57` 精确断言 5 键 | **直接冲突并必须改**：D-9 第一行授权 `:57` 数组末尾追加 `'session_policy'`；`ROLE_KEY_ORDER` 放在 `max_concurrent_sessions` 之后、**加载器不得把缺省 `fresh` 注入渲染对象**（D-13）；26 内置资产一个字节不改、`role show developer` / `role list` / `validate` 计数逐字不变 | M-5 / D-13 / A-5 / A-10 / D-9 / 裁-5 / AC-48~51 |
| 5 | M-6「新增 `NODE_PHASE_LABEL` 与恢复/检查点/崩溃/运行慢/复用文案」、M-8「恢复实例 JSON 追加 `recovery` / `connections`」→ `src/cli/labels.js` 现状无这些键、`render.js:1302 renderGraphJson` 现状 11 键 | 只增键、既有六张状态表 / 既有文案 / 既有渲染分支 / `USAGE_LINES` 25 行一字不改；恢复实例 13 键追加在 `current` 之后、非恢复仍 11 键且顺序不变（A-9）；`status.md` 看板列词表 `src/core/status-text.js` 不改（A-1 / B-17）；会话升级「已升级」红色圆点属**既有输出**、按裁-3 **不进 A-3**、不新增会话态 / CLI 输出 | M-6 / M-8 / A-1~A-10 / 裁-3 / D-4 `:1281` / B-17 |
| 6 | C-14「运行慢且节点声明 `timeout` → 写 `failed_reason: timeout`」→ 当前代码无该落盘字段（语义见 `index.md:164`） | **本迭代新增落盘字段**，仅超时分支写；未声明 `timeout` 的内建三图只提示继续等待、不擅自失败（R-7 / B-08 / AC-46）；`MAESTRO_TEST_GRAPH` 仅 `NODE_ENV=test` 注入带 `timeout` 的夹具图、生产路径不读 | C-14 / D-8 / R-7 / B-08 / AC-45 / AC-46 |
| 7 | M-7 全部新接缝 / D-10 新夹具 / 9 态 `phase` 投影 → `src/` Grep 命中 **0**、`test/fixtures/recovery*` / `test/wp13` / `graph-timeout.json` / `human-node-state.json` Glob **0** | 属 **S2 实现期新增（待 S2 实现）**，理解纪要 §6.3 / §6.6 A 组（34 条 AC「当前无法取证」）如实登记，**不判需求缺陷、不改 Then、不放宽判据**；S2 交付接缝与夹具后逐条补证 | M-7 / D-10 / 纪要 §6.3 / §6.6 / review-round3 §7 观测项 |
| 8 | AC-52 / BR-44「三主链逐字不变」→ 集成说明 **O-I2**：I1.4 改写 `render.js`，集成版相对 I1.5 `0cd113b` 基线预期有变化，I1.6 AC-49 逐字断言不能直接套 | **逐字基线以集成版 `d4b0f94` 重建**，S3 以集成版重建、不套 `0cd113b`；不能因「对不上旧基线」放宽 AC-52；`git worktree add --detach` + `core.autocrlf=false` + 归一化 diff（§6 检查点 #6） | 集成说明 §5 O-I2 / `index.md:711` / 纪要 §7.2 红线 1 / AC-52 |
| 9 | AC-53 基线 **992/988/4**（需求 `:805/:964`）vs 集成说明 §4 **992/987/5** → 两份数字差 1 条 | 总条数同为 992、通过/失败差 1 条属 Windows 并发 `EBUSY` 噪声浮动；门禁口径统一为「**失败集合差集 = 0 + 条数只增不减**」、**不要求零失败、不写死通过数**；如实登记差异、不声称复核了全量数字 | 需求 `:964` / 集成说明 §4 / 纪要 §5.2 / §7.1 / AC-53 / D-10 |
| 10 | D-11 第 3 条架构扫描「三文件口径」→ 撰写方曾收窄为 `roles.js` 单文件（v1 F-24），评审实测 34 处命中 | **裁-2**：恢复 I1.6 D-9 三文件口径 `src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js`，不得收窄为单文件；`labels.js` / `render.js` / `main.js` 合法持有模板名与角色名，只在附录备注说明「不纳入及原因」、**不写进扫描命令、不得为让扫描变绿改其注释**；第 4 条零依赖、第 5 条零 CJK 单列 | 裁-2 / `index.md:711` / §1.2「只能补不能减」/ AC-54 / D-11 `:1391` |
| 11 | AC-54 内嵌 D-11 五条命令逐字副本 → v2 只写「31 词表见 D-11」、与 §3.3#9「必须逐字复制完整 `--forbid` 词表」冲突 | **裁-4（选项①）**：AC-54「架构检查」段内嵌 `$COMMON`（31 词）/ `$NOCOORD`（30 词）与五条命令**逐字副本**，与附录 D-11 一字不改、两份副本逐字相同、任何一侧修改都要同步；§3.3#9 一字不改；S3 用例须按 **AC-54 正文**取证、不得只引用 D-11 | 裁-4 / DoR-12 / AC-54 `:818~836` / D-11 `:1369~1387` / §3.3#9 |
| 12 | D-9「保持原样」段写 `:588~590` → 实读 `test/wp4/orchestrator.test.js:588~592`，`:592` 才是「v1 实例必须一字不改」断言行 | **裁-5**：机械更正为 `:588~592`，其余已授权行号（`:480/575/578/580/584~586`）不动；本拆分 §2.14 / §4 WP-7 / §6 冻结点 8 / §7 风险 3 全部按 `:588~592` 落地 | 裁-5 / review-round3 §1 N-05 / D-9 `:1350` |
| 13 | 需求附录 B 的 B-07（写失败告警继续 vs 停止推进）、B-08（未声明超时是否默认失败）、B-09（字段名 `session_policy`，**不改名为 `session_reuse`**）、B-12（`assigned` 显示词）、B-13（恢复行是否始终显示）标「需评审裁决」→ 代码现状与拆分口径可能不一致 | **已裁决（不阻塞）**：按需求 `session_policy` 落地、不改名 `session_reuse`、需求正文 v3 一字不改，仅 S1 评审记录（`split-review-round1.md`）与 `decisions.md` 台账（裁-6 / 裁-7）留痕；B-09 从「需评审裁决」改判「已裁决（不阻塞）」的动作**只在 S1 评审记录与台账留痕**。**如实登记**：「附录 B 正文仍写『需评审裁决』（定稿文本不动），以 `decisions.md` 裁-6 为最终口径」。其余 B-07 / B-08 / B-12 / B-13 按需求 v3 已选口径落地（R-10 / R-7 / A-1 / A-2），B-17 按 `index.md:166` 已裁决、B-11 按裁-1 已裁决；这 5 项在下方如实登记段逐条列出，**不阻塞开工** | 附录 B B-07/08/09/12/13/17/11 / 裁-1 / 裁-6 / 裁-7 / R-7 / R-10 / R-12 / A-1 / A-2 |
| 14 | 需求 §1.3 范围外 13 项（worktree / `orch run --workflow` / human·subworkflow 运行时 / 审批上下文恢复 / 三层日志 / 新 CLI 命令 等）→ 实现期容易顺手把范围内条目挪出去或夹带新能力 | 本拆分 §0 逐条列 Out of scope 13 项、§4 映射表 67/67 全在范围内；**不把任何范围内条目挪到范围外、不夹带规划外新能力**；`subworkflow` 不透明保留（BR-54 / AC-41）、`human` 用夹具预置状态验证（R-6 / B-04）、不新增 `orch recover`（BR-46 / AC-55） | 需求 §1.3 `:69~81` / §1.2「只能补不能减」/ 模板 §7 红线 14 / R-6 / R-9 / R-12 |

**已裁决（不阻塞）与需如实登记的点（如实列出，不隐瞒；均「不阻塞 S1 开工」）**

> B-09 按 `decisions.md` **裁-6 / 裁-7** 已裁决（不阻塞）；其余各项按需求 v3 已选口径如实登记，均**不在实现里改需求正文**。以下「需评审裁决」字样专指**附录 B 定稿正文的原始标注**，不是本拆分仍待裁决。

- **B-09 字段命名（已裁决（不阻塞））**：按裁-6 / 裁-7，**按需求 `session_policy` 落地、不改名 `session_reuse`、需求正文 v3 一字不改**，仅 S1 评审记录（`split-review-round1.md`）与 `decisions.md` 台账留痕；本拆分 §2.7~2.9 / §6 冻结点 5 已据此冻结。**如实登记**：附录 B 正文（需求 `:1115`）仍写「需评审裁决」，属定稿文本、一字不动，**以 `decisions.md` 裁-6 为最终口径**；若违背该裁决另议改名，须同步 M-5 / AC-51 / D-10 / D-13 / A-5 / A-10 与本拆分 §2、§4、§6，属需求修订、须重开 S0 评审循环，不属实现期悄悄改名。
- **B-07 检查点写失败策略**：需求选「告警继续」（R-10 / BR-06 / AC-04），代码现状无检查点故无既有行为；附录 B-07 标「需评审裁决」。**建议**：按需求实现「告警继续」，若改口径需改 BR-06 与 AC-04，不属本拆分可自行调整的范围。
- **B-08 未声明 `timeout` 的默认行为**：需求选「不擅自失败」（R-7 / AC-46），代码现状三张内建图无 `timeout` 字段；**建议**按需求，不新增默认值。
- **B-12 / B-13 显示口径**：`assigned` 显示「已分配」+「等待重新分配会话」（A-1 / AC-59）、恢复行仅 `recoveredAt` 时条件追加（A-2 / AC-10）；B-17 已按 `index.md:166` 裁决两种粒度。**建议**按需求 A-1 / A-2 落地，不改 `src/core/status-text.js` 词表。
- **拆分决策留痕（非需求冲突）**：按 §1.4 规则 2「每包自带契约测试」，在 D-10「至少 7 个文件」下限清单（列 8 个）之外补第 9 个 `test/wp13/fixtures.test.js` 作为 WP-6 的夹具契约自检载体（§1.9 / §2.12 / §5）；这是测试组织决策，不新增产品文件、不新增需求条目、不改既有 `test/**`，请主控在 S1 评审时一并确认。

### 拆分自检（S1 交付实跑，输出摘要见本次返回第 ② 项）

> 按模板 §1.5 的 10 条逐条勾，脚本一律内联 `node -e` / `%TEMP%` 临时脚本、不落仓库；逐条输出写入本次返回，不在本文档内复制大段输出。10 条为：① 8 节 `grep -n "^## "` 齐全且顺序对；② AC 67/67 满覆盖（需求 AC 号集合 vs 本文档引用集合，**映射表必须存在**）；③ 每条 AC 在需求里有同号 `Then`；④ 所有 WP 负责文件两两无交集（路径集合求交）；⑤ DAG 无环且依赖编号存在；⑥ 退出标准逐条可判定；⑦ §2 每文件标归属 WP；⑧ §6 有冻结点与整合检查点；⑨ §7 每条风险有具体处置；⑩ §8 有「不新增需求条目，冲突以需求为准」声明。
