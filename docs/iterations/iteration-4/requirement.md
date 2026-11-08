# I1.4 — 共享工作区 + 交接包校验 + CLI 核心命令集

> 迭代：阶段一 · I1.4 ｜ 依据：`docs/index.md`（§3.1 节点状态、§3.2 会话状态、§3.4 交接包状态、§5.2 数据布局、§5.4 共享工作区、§5.7 CLI 输出、能力域 1 / 2 / 4 / 5 / 6、I1.4 条目）｜ 模板：`docs/templates/requirement-template.md`
> 状态：**v23（六轮评审 PASS；第 6 轮的 6 条非阻塞建议已全部收口）** ｜ 上游：I1.1 / I1.2 / I1.3（I1.3 实现中；契约见 `docs/iterations/iteration-3/requirement.md` v5，实现见 `src/`）
> 契约变更 **M-1 ~ M-12**、补充契约 **C-01 ~ C-14**；业务规则 **BR-01 ~ BR-46**；AC **70 条**；附录 A 输出基线、附录 B 术语与未决问题、附录 C 变更记录、附录 D 实现约束。
>
> **读法**：第二部分只写"我看得到、做得到"的事，不出现内部字段名与迁移表；第三部分每条 AC 都以用户可观察结果或明确的机检/夹具/架构检查开头；实现细节集中在附录 D。
>
> **本迭代的一句话**：把"各个 Agent 各写各的、交接靠人搬、出了问题只能取消"变成"同一工作区里按约定交接、交接前先验内容、唤醒消息不丢、所有人工动作都能在 CLI 完成"。

---

## 一、背景与问题

### 1.1 现状与问题

I1.1 到 I1.3 之后，一条命令已经能让单节点、编码闭环、文档闭环自己转起来。但真正把多个 Agent 放在同一个任务里时，我仍然卡在四件事上：

- **上下文没有公共落点**。研究员查到的约束、开发写下的接口说明、测试留下的复现步骤，全都停在各自对话里。下一个环节要么重新问，要么由我复制粘贴。想找一个"大家都认同的当前结论"，只能翻 `state.json` 或回忆聊天记录。
- **交接包"看起来有"，但没人验内容**。交接包里写着产物路径，路径可能已经被删、被清空、写成了目录，或者根本不在工作区里；核心仍然照常派发。下游拿到一份坏引用，跑一轮才发现，轮次、会话和时间都白花。
- **唤醒消息只存在于内存里**。一旦投递失败，核心只能直接升级或失败；消息本身没有落盘，无法知道"到底要交给谁、带什么上下文"，也无法重试。用户看到的是"突然失败"，而不是"正在重投"。
- **CLI 只能发起、看状态、取消**。升级之后只能看或取消，不能裁决"通过 / 失败 / 重新分配"；宿主请求审批时只能等取消；交接包只能整段看状态，不能单独查一包；实例跑到一半想暂停、恢复、终止，没有命令；会话出问题想附着看，也没有入口。
- **"暂停"没有语义**。现在只有"取消"这一个终止动作；想在下游派发前停一下、修个文件、再继续，只能取消后重来，轮次和已完成的节点全部作废。

**不解决会怎样**：I1.5 的角色实例、I1.6 的声明式工作流、I1.7 的产物隔离、I1.11 的人工干预队列，都要求"工作区可共享、交接包可信、消息可持久、人工动作有入口"。如果这一轮仍把交接当作"把字符串塞进 prompt"，后面每加一种角色或工作流，都要再补一套丢失重试、证据校验和 CLI 分支；`stage/`、`status.md`、`pending` 也会退化成只存在于文档里的名词。

### 1.2 目标与成功衡量

| # | 指标 | 目标值 | 怎么量 |
|---|---|---|---|
| 1 | 下一个环节需要我手工搬运上下文的次数 | 0 次 | 连跑 5 次编码闭环与 5 次文档闭环；检查每个节点的提示词都带工作区、共享区与本节点阶段区路径 |
| 2 | 坏交接包被派发的次数 | 0 次 | 对"缺字段 / 缺证据 / 文件不存在 / 文件为空 / 路径越界 / 哈希不符 / 回流缺缺陷"逐项各跑一次；全部停在升级，派发计数不增加 |
| 3 | 投递失败后消息丢失的次数 | 0 次 | 让前两次投递失败、第三次成功；信箱文件三次都可读，最终交接包为已投递 |
| 4 | 人工动作必须依赖改文件或读源码的次数 | 0 次 | 启动、看状态、附着、查日志、看图、处理升级、审批、查交接、暂停、恢复、终止各用一条命令完成 |
| 5 | 旧命令与旧实例的回归 | 0 处 | I1.1 ~ I1.3 的 `run` / `status` / `cancel` / `core stop` 在非新状态下逐字不变；旧格式实例只读可查 |
| 6 | 共享工作区、校验、信箱、命令集共用一套引擎 | 1 套 | 架构检查：`src/core/**` 与 `src/daemon/**` 不出现模板名/角色名；三种模板共用同一工作区与交接校验路径 |

### 1.3 范围

**范围内**

1. **共享工作区**：实例工作区新增 `shared/`、`status.md`；多节点实例为每个节点建 `stage/<节点号>/`；`status.md` 由核心生成并在每次状态变化后刷新。
2. **交接包 schema 校验**：交接包投递前检查必填字段、至少一条证据引用、证据文件存在且非空、路径不越界、上一版哈希一致、回流缺陷与修改要求齐全；不合格就拒绝该交接包并升级来源节点。
3. **持久化信箱**：唤醒消息先原子写入 `.orch/inbox/<实例号>/<交接包号>.json`，再投递；投递失败自动重试最多 2 次（首次 + 2 次重试，共 3 次尝试）；重试期间显示"待投递"，耗尽后交接包"已过期"并升级。
4. **`orch run` / `orch status` 补全**：保留原有参数与输出；新增 `run --approval allow|reject|hold`；`status` 增加暂停限定词、待处理审批行、待投递重试次数；挂起后的"下一步"改为给出 `orch escalate resolve`。
5. **`orch instance status / log / graph`**：按实例查看状态、事件时间线、节点与边摘要；`graph` 支持 `--format text|json`，JSON 供回归对比。
6. **`orch attach <session_id>`**：只读附着会话，输出最近事件并持续跟随；Ctrl-C 脱离，不改变实例。
7. **`orch escalate list / resolve`**：跨实例或按实例列出升级；把待处理升级裁决为通过 / 失败 / 重新分配。
8. **`orch approve <approval_id> --decision allow|deny`**：处理宿主审批；审批有稳定编号，允许或拒绝后会话继续或按原口径失败。
9. **`orch handoff list / show`**：按实例列出交接包；查看单包的字段、证据、缺陷、时间与信箱位置。
10. **`orch workflow pause / resume / abort <instance_id>`**：暂停只阻止下一次派发、不打断当前回合；恢复继续；终止等同取消。
11. **升级人工裁决出边**：`escalated → done / failed / 重新分配` 三条出边落地；处理完自动推进或按结果收尾。
12. **兼容与可追溯**：I1.1 ~ I1.3 的调用方式与既有输出不回归；旧格式实例仍只读可查；所有新动作写事件记录。

**范围外**

| 不做的事 | 留给谁 | 备注 |
|---|---|---|
| 桌面端人工干预队列、托盘通知、通知中心 | I1.11 | 本迭代只做 CLI 与持久化数据 |
| 真正的 ACP 会话恢复、daemon 重启后继续投递 | I1.8 | 本迭代只保证消息先落盘，崩溃恢复规则不在本轮 |
| 向附着会话注入输入、代 Agent 继续对话 | I1.8 | 本迭代 `attach` 只读跟随 |
| 执行日志摘要、日志 artifact 引用、trace span | I1.9 | `instance log` 只读事件日志 |
| 角色注册表、角色实例、`max_concurrent_sessions` | I1.5 | `graph` 只画节点级图，不画角色实例 |
| 声明式工作流文件、`workflow list/create/validate/diff/dry-run` | I1.6 | 本迭代 `workflow` 只控制已存在实例 |
| OS 级文件权限、代码 worktree、数据集快照 | I1.7 | `shared/` / `stage/` 是声明式可见域 + 提示词约定，核心不做 ACL |
| 链式哈希、配额、证据过期、签名 | I1.12 | 本迭代只做必填与可解析校验 |
| 自动修复坏交接包 | 不做 | 校验失败一律升级，由人决定重跑或失败 |
| 部分改写 / diff 合并 / 自动切换版本 | 不做 | 由各角色交完整新版本 |

### 1.3.1 与 I1.4 规划的逐项对应

| 规划条目（`docs/index.md` I1.4） | 本需求落点 | 验收 |
|---|---|---|
| 共享工作区：`shared/`、`stage/`、`status.md` | §2.2；附录 A-1、D-1 | AC-01 ~ AC-07、AC-59 |
| 交接包 schema 校验：缺少必填字段或证据引用时拒绝投递 | §2.3；附录 D-3 | AC-08 ~ AC-14、AC-68、AC-69 |
| 持久化信箱：唤醒消息先落盘再投递，失败重试 | §2.4；附录 D-4 | AC-15 ~ AC-20、AC-63、AC-65 |
| `orch run` / `orch status` 补全参数与输出，保持向后兼容 | §2.5、§2.6；附录 A-2 | AC-36 ~ AC-38、AC-54 |
| `--template` 完整参数族（`docs/index.md:722` 注记） | §2.5 命令表（`single\|code-loop\|task-loop`，缺省 `single`） | AC-01 ~ AC-03（三种模板各一） |
| `orch instance status` / `log` / `graph --format json/text` | §2.7；附录 A-3 / A-4 | AC-38 ~ AC-43 |
| `orch attach <session_id>` | §2.8；附录 A-3 | AC-44、AC-45 |
| `orch escalate list / resolve` | §2.9；附录 A-3 | AC-21 ~ AC-30 |
| `orch approve <approval_id> --decision allow\|deny` | §2.10；附录 A-3 | AC-31 ~ AC-35、AC-67 |
| `orch handoff list / show <handoff_id>` | §2.11；附录 A-3 | AC-46 ~ AC-48、AC-70 |
| `orch workflow pause / resume / abort <instance_id>` | §2.12；附录 A-3 | AC-49 ~ AC-53、AC-66 |
| **验收**：CLI 完成启动、状态、附着、升级处理、审批、交接查看、暂停/恢复/终止 | §2.13 走完一遍；见右列 | AC-21 ~ AC-53、AC-60 ~ AC-64、AC-66、AC-67、AC-70 |
| **验收**：交接包缺证据时被拒绝并触发升级 | §2.3；AC-10 | AC-10、AC-14 |
| **验收**：`escalated → done / failed / 重新分配` | §2.9；附录 D-6 | AC-23 ~ AC-30 |
| **验收**：兼容、架构纯净与查看只读 | §3.1（AC-54 ~ AC-58）、§3.2 NFR-06；附录 D-11 | AC-54 ~ AC-58 |

**规划解释登记（R）**

| 编号 | 解释 | 理由 |
|---|---|---|
| R-1 | `attach` 在 I1.4 是**只读附着**：最近事件 + 持续跟随 + Ctrl-C 脱离；不向会话注入输入 | ACP 输入转发与恢复属于 I1.8 的会话恢复方言；本迭代先把"看得到、不改变"做稳 |
| R-2 | `shared/` / `stage/` 是**声明式可见域**：核心建目录、写约定路径、在提示词里告知角色；不在 OS 层阻止越权读写 | OS 级隔离与 worktree 属于 I1.7；本迭代不承诺 ACL 强制 |
| R-3 | 规划中的"重新分配"在 CLI 取值为 `retry`：新建会话、该节点轮次 +1、只重跑该节点，并由人工本次授权额外一轮 | 与 I1.2 / I1.3 的 `node.dispatch` 轮次计数保持一致；不重跑已完成的上游 |
| R-4 | `workflow pause/resume/abort` 只控制**已存在的实例**；`workflow list/show/create/validate/diff/dry-run` 留给 I1.6 | 规划把工作流定义放在 I1.6；I1.4 只补实例生命周期入口 |
| R-5 | `instance graph` 画**节点级图**（节点、边、交接、升级、审批）；角色实例图留给 I1.5 | 本迭代没有角色实例模型，画出来只能是伪数据 |
| R-6 | `instance log` 读**事件日志**；执行日志摘要与日志 artifact 留给 I1.9 | 规划明确 I1.9 才做执行日志 |
| R-7 | 能力域 4 的"宿主离线时唤醒保持 pending"在本迭代落为"最多 3 次尝试后 `pending → expired` 并升级"；不承诺宿主恢复后自动续投 | 自动续投依赖 I1.8 的崩溃恢复与会话恢复；本迭代先把"不丢、不假成功"做稳 |
| R-8 | 能力域 2 的"目标角色 schema 校验"在本迭代只做交接包自身字段与证据校验；角色产物 schema 留给 I1.5 | I1.5 才引入角色与产物契约；I1.4 的校验对象是包，不是角色输入 |
| R-9 | 能力域 5/6 中依赖角色契约或工作流原语的规则不在 I1.4：实例健康度/连接聚合视图、唤醒白名单路由拦截、人工终审节点、并行度与预算配额、会话崩溃与超时的原因细分、字段映射与产物版本锁定 | 这些规则需要角色注册表（I1.5）与工作流完整原语（I1.6）提供数据模型；I1.4 只交付"共享工作区 + 交接包校验 + CLI 入口"，不为占位造伪字段 |
| R-10 | 取消一张**已尝试投递、尚未确认**的交接包，走 `pending → rejected`（`rejectReason='withdrawn'`），展示"已拒绝（已撤回）"，而不是 `expired` | `docs/index.md` §3.4 的 `rejected` 触发条件含"交接包已构造未投递时取消撤回"；`pending` 属于"尚未投递确认"，语义一致。该出边在 §3.4 状态图中未画出，登记为规划解释，不改 §3.4 的 7 个状态枚举 |
| R-11 | `stage/<nodeId>/` 是**节点自己的阶段区**：本节点写、下游读；与 `docs/index.md` §5.4「阶段参与者可读，上游可写」同义——上游写自己的 stage，下游读它。不实现"上游写入下游目录" | 按节点拥有阶段区，才能在提示词里给出稳定路径；跨节点写同一目录会引入并发覆盖，留给 I1.7 的产物隔离 |

### 1.4 对 I1.1 / I1.2 / I1.3 契约的修改（授权变更）

> 说明：M 是"必须改代码 / 数据结构"的变更；C 是补充契约（实现时必须按此口径，避免出现两套解释）。未列出的既有契约保持不变。

| 编号 | 现状（I1.3 v5 / 代码） | 变更 | 为什么 | 兼容 / 影响 |
|---|---|---|---|---|
| **M-1** | `src/persistence/paths.js` 只有 `instanceWorkspaceDir` / `instanceDocsDir` / `instanceReportsDir`；`prepareWorkspace` 只在 `doc-single` 下建 `workspace/artifacts/{docs,reports}` | 新增 `sharedDir` / `stageDir` / `statusPath` / `inboxDir`；所有实例启动时建 `workspace/shared/` 与 `workspace/status.md`；多节点图额外建 `workspace/stage/<nodeId>/`；`artifacts/{docs,reports}` 仍仅文档闭环预建 | 规划要求共享工作区三层可见域 | 新目录只增不改；`single` 的 CLI 输出不变；工作区建不起来仍退出 3 |
| **M-2** | 没有 `status.md`；模板图没有展示标题；状态中文只在 `labels.js` | 新增核心侧 `status.md` 生成器（原子写）；图对象新增 `title`（`单节点` / `编码闭环` / `通用任务闭环`）；状态中文由核心侧独立文案表提供，CLI 仍以 `labels.js` 为唯一来源 | `status.md` 是给人看的交接棒，不能只写机器字段 | `status.md` 每次状态落盘后刷新；人工修改会被下一次刷新覆盖；不改变 CLI 输出 |
| **M-3** | 交接包只有 `handoffId/edge/state/时间/defects/artifactRefs/revisionRequirement`；没有落盘 `instanceId/round/fromNodeId/toNodeId`；没有 schema 校验 | 交接包追加 `instanceId`、`round`、`fromNodeId`、`toNodeId`、`deliveryAttempts`、`pendingAt`、`expiredAt`、`lastError`、`retestRequirement`；新增 `src/core/handoff-schema.js`，在投递前校验 | 规划要求缺字段/缺证据拒绝投递；没有落盘来源与轮次就无法定位坏包 | 追加字段；旧快照缺字段按"不参与校验"处理；`single` 的引导交接包不参与本校验 |
| **M-4** | `REJECT_REASONS = ['target_rejected','permission_denied','withdrawn']`；`created → delivered`；`pending` 无产生路径；`expired` 无产生路径 | 拒绝原因追加 `invalid_payload` / `delivery_failed`；状态机允许 `delivered → pending`（收到任何 turn 内事件前投递失败，回落等待重试）、`pending → delivered`、`pending → expired`、`pending → rejected`（取消撤回，见 R-10）；`pending` 必须有 `pendingAt` 与 `deliveryAttempts` | 坏内容、投递不出去、重试耗尽必须可区分；规划要求持久化信箱与重试；`delivered` 是"提示词已交给宿主"的乐观态，失败后回落 `pending` | 首次投递即成功仍走 `created → delivered`（不额外落 `pending`）；不新增 `created → pending`（代码在调用 `adapter.prompt` 后立即置 `delivered`，失败只能发生在 `delivered` 之后）；旧成功路径事件数不变 |
| **M-5** | 投递只有一次 `adapter.prompt`；失败走会话创建/执行失败路径；没有信箱 | 新增 `.orch/inbox/<instanceId>/<handoffId>.json` 原子写；先落盘再投递；投递失败重试最多 2 次（共 3 次尝试，间隔 200ms、500ms）；耗尽后 `pending → expired` 并升级；**只作用于图驱动交接包（`edge !== null`）** | 规划要求持久化信箱与失败重试 | 会话创建失败仍按 I1.2 一次尝试后 `dispatch_failed`，不进入重试；`single` 的 `HO-001` 与图入口无包派发不写信箱、不重试，分别沿用 I1.2 / I1.3 失败路径；重试不新增 `node.dispatch`、不新增会话、不增加轮次 |
| **M-6** | 升级状态只有 `pending → voided`；`escalated` 节点只能取消；实例 `suspended` 只能取消 | 升级追加 `resolved` 状态与 `resolution/resolvedAt`；节点允许 `escalated → running / done / failed`；实例允许 `suspended → running / completed / failed`；新增 `escalation.resolve` | 规划要求 `escalated → done / failed / 重新分配` | 取消路径不变；已处理升级不可再次处理；旧 `voided` 保持 |
| **M-7** | 审批只存在内存 `ctx.permission`；`hold` 策略只能等取消；没有审批编号 | 新增实例级 `approvals[]`（`APR-nnn`，`pending/approved/denied/withdrawn`）；`run --approval hold` 生成待处理审批；`approve` 允许/拒绝；取消作废待审批 | 规划要求 `orch approve` 与人工干预入口 | 默认策略仍为 `allow`；不出现审批时 `status` 输出不变；I1.1 hold 测试的"唯一外部决定是取消"改为"取消或审批" |
| **M-8** | 实例只有 `suspended` 与 `halted` 两个停止语义；没有暂停 | 新增实例级 `paused` 布尔标记；`pause` 只阻止下一次派发，当前回合跑完；`resume` 清除并继续；`abort` 等同 `cancel`；`run.wait` 在暂停于派发边界生效时返回，前台 `orch run` 打印已暂停实例行与恢复提示并退出 0 | 规划要求 `workflow pause/resume/abort` | 不新增实例状态枚举；`paused` 随快照落盘；不打断当前回合；未暂停时 `run.wait` 行为不变 |
| **M-9** | CLI 只有 `run/status/cancel/core stop`；解析器只支持单层命令；`VALUE_FLAGS` 无 `approval/decision/format` | 扩展命令树与位置参数：`instance` / `attach` / `escalate` / `approve` / `handoff` / `workflow`；新增 `--approval`、`--decision`、`--format`、`--all` | 规划要求 CLI 核心命令集 | 旧命令与旧参数逐字可用；未知命令仍退出 2；退出码体系沿用 0/1/2/3/4/5 |
| **M-10** | 快照没有 `paused`、`approvals`、`pendingApprovals`、`handoff.deliveryAttempts` | `snapshotOf` / `shapeSnapshot` / `instance-store.list` 投影补上述字段；缺省值必须让旧快照输出不变 | 新命令要读、旧命令不能回归 | 旧快照投影为 `paused:false`、`approvals:[]`、`pendingApprovals:0`，不打印新行 |
| **M-11** | `labels.js` 无审批、已处理、暂停、新错误码；挂起下一步只提"查看/取消" | 新增审批/已处理/重新分配/暂停文案、A-5 所列命令级错误文案（命令级码由各自渲染器使用，只有通用码进 `ERROR_TEMPLATE`）、新原因词条；挂起下一步改为给出 `escalate list/resolve` | 新动作必须可读、可操作 | 仅"挂起后的下一步"一行按 M-11 更新，其余旧基线不变 |
| **M-12** | 测试断言：`REJECT_REASONS` 精确数组、hold"唯一决定是取消"、错误码清单、状态迁移表、`test/templates/fake-graph.test.js` 的交接包 16 键、`test/wp2/state-machine.test.js` 的四处排他性断言 | 同步更新这些**授权断言**；新增校验/信箱/审批/暂停/命令 AC 的夹具；新增故障值 `inbox_write:fail`、`workspace_status_write:fail` 只在 `NODE_ENV=test` 下生效 | 新能力必须可验 | 只改被本需求明确列出的断言；其他 I1.1 ~ I1.3 断言不动 |

#### 补充契约条目（C-01 ~ C-14）

| 编号 | 契约 |
|---|---|
| C-01 | 工作区根一律是 `.orch/instances/<instanceId>/workspace`；所有提示词里的路径都写绝对路径，禁止写 `~` 或相对仓库根。 |
| C-02 | `status.md` 是核心产物：核心每次成功落盘快照后重写；人工修改视为临时备注，下一次刷新会被覆盖。 |
| C-03 | `stage/<nodeId>/` 由该节点写入、其下游只读；`shared/` 由核心/人工写入、所有节点只读。I1.4 只做目录与提示词约定，不做 OS ACL。 |
| C-04 | 交接包校验、信箱落盘与投递重试只针对**图驱动**的交接包（`edge !== null`）；`single` 的 `HO-001` 引导包与图入口的无包派发不参与，仍走 I1.2 / I1.3 的失败路径。 |
| C-05 | "证据引用"指 `artifactRefs.input[]`、`artifactRefs.previous.ref`，以及回流包的 `defects[].evidence`；`output` 是未来要写的路径，不要求已存在。 |
| C-06 | 至少一条证据引用是硬要求（`input`、`previous.ref`、回流缺陷证据任一即可）；没有证据的图驱动交接包一律拒绝。回流还要求 `defects` 非空且至少一条 `revisionRequirement` 或 `retestRequirement`；构建回流包时若两者都为空，按提示词同款默认复测要求落盘，不能让引擎自己的默认值成为校验失败原因。 |
| C-07 | 证据路径解析顺序：绝对路径 → 必须在工作区或任务目录内；`artifacts/` 开头 → 工作区相对；其余 → 任务目录相对。禁止 `..` 逃逸。回流缺陷证据在解析前先剥离 `#L<n>` / `#L<n>-L<m>` 后缀；基准按证据所属来源节点的产物策略选择（产物落在工作区的节点以工作区为基准，否则以任务目录为基准），实现不得按模板名分支；`input` / `previous.ref` 不剥离行号后缀。 |
| C-08 | 信箱文件必须先于第一次 `adapter.prompt` 原子落盘；落盘成功后记录 `handoff.inboxed` 事件，再发起投递；落盘失败不得投递。文件名固定 `<handoffId>.json`，内容含目标会话、目标节点、提示词、尝试次数与最后错误。 |
| C-09 | 投递重试只针对图驱动交接包（`edge !== null`）的 `adapter.prompt` 本身失败且尚未收到任何 turn 内事件的情况；已收到事件后的失败沿用 I1.2 / I1.3 的失败路径。 |
| C-10 | 重试期间交接包为 `pending`；首次尝试在收到任何 turn 内事件前失败时，由乐观置位的 `delivered` 回落到 `pending`（`delivered` 只在调用 `adapter.prompt` 后置位，失败说明消息未被宿主确认）；首次成功不回落。耗尽后 `expired`，节点升级原因 `delivery_failed`。 |
| C-11 | 审批编号 `APR-nnn` 在实例内单调递增、不复用；升级编号 `ESC-nnn` 在实例内单调递增、不复用；交接包编号 `HO-nnn` 沿用既有规则。 |
| C-12 | 跨实例命令（`escalate resolve` / `approve` / `handoff show`）在编号不唯一时必须要求 `--instance`；不带时若唯一则可用，歧义则报错且不写任何状态。 |
| C-13 | 所有"人工动作"（resolve / approve / pause / resume / abort）都必须基于最新状态 CAS 写入、成功后再发事件；写入冲突返回 `STORE_CONFLICT`，不得假装成功。无运行时持有者时先读盘再写；核心正持有该实例运行时状态时，pause/resume 的写盘排入实例写队列（D-7.2），以运行时 `rev` 为基准，同样不得跳过冲突检查。 |
| C-14 | 暂停只阻塞"下一次派发"；已进入的派发、当前回合、正在进行的重试都允许收尾。恢复时若已有完成节点待推进，立即推进一次。 |

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| # | 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|---|
| A | 共享工作区 | 所有角色、人工 | 上下文没有公共落点 | `shared/`、`stage/<节点>/`、`status.md` 建好并在每次状态变化后刷新 |
| B | 交接包校验 | 核心、人工 | 坏引用被照常派发 | 投递前验字段、证据、路径、哈希、回流内容；不合格拒绝并升级 |
| C | 持久化信箱与重试 | 核心、人工 | 投递失败消息丢失 | 先落盘再投递；最多 3 次尝试；待投递/已过期可见 |
| D | 状态与日志命令 | 人工 | 只能看一屏状态 | `instance status/log/graph`，图支持 text/json |
| E | 会话附着 | 人工 | 会话出问题看不到现场 | `attach` 只读跟随最近事件，Ctrl-C 脱离 |
| F | 升级处理 | 人工 | 升级后只能取消 | `escalate list/resolve`，通过/失败/重新分配 |
| G | 审批处理 | 人工 | hold 后只能取消 | `approve` 允许/拒绝，审批有编号、可查、可作废 |
| H | 交接查看 | 人工 | 交接包只能看一行状态 | `handoff list/show`，字段、证据、缺陷、时间、信箱 |
| I | 暂停/恢复/终止 | 人工 | 想停一下只能取消 | `workflow pause/resume/abort`，暂停不打断当前回合 |

### 2.2 A 共享工作区：大家在同一张桌子上干活

- **使用角色**：所有被派发的角色；人工查看者。
- **使用场景**：一个实例包含两个及以上节点，后面的节点需要读前面的结论；或者我想不打开 `state.json` 就知道现在做到哪。
- **用户操作**：正常发起 `orch run`；不需要额外参数。发起后打开实例目录即可看到工作区。
- **预期效果**：
  - 每个实例都有 `workspace/shared/` 与 `workspace/status.md`。
  - 多节点实例还按节点建 `workspace/stage/<节点号>/`，例如 `stage/T-001/`、`stage/T-002/`。
  - `shared/` 是公共区：所有人可读，核心与人工可写；角色的提示词明确写"共享区只读"。
  - `stage/<节点号>/` 是该节点的阶段区：本节点可写，下游只读；提示词给出本节点阶段区与上游阶段区的绝对路径。
  - `status.md` 是一页纸的交接棒：实例、模板、状态、是否暂停、任务、当前节点、所有节点进度、最近交接包、待处理升级、待处理审批。
  - 每次节点/交接包/升级/审批状态变化或暂停/恢复后，`status.md` 自动刷新（会话状态只更新卡片指示器，不写入 `status.md`）；我不会看到半截文件。
- **异常情况**：
  - 工作区建不出来（目录不可写、磁盘满）→ 发起前停住，提示"无法创建工作区：…"，退出码 3；不会建会话、不会派发。
  - `status.md` 后续刷新失败 → 核心继续推进，但终端在 `--events` 里能看到一次"工作区状态写入失败"；不会把已落盘的状态回滚。
- **边界说明**：I1.4 只保证目录、路径与提示词约定；不阻止某个 Agent 越权读写，也不做代码 worktree。真正的隔离留给 I1.7。

### 2.3 B 交接包校验：坏包不许出门

- **使用角色**：核心自动执行；人工在升级后查看原因。
- **使用场景**：上游节点完成，核心要把产物、证据、缺陷或修改要求交给下游。
- **用户操作**：无需操作。正常完成上游后自动校验；校验失败时在 `orch status` / `orch run` / `escalate list` 里看到原因。
- **预期效果**：
  - 交接包先校验，校验通过后随本次派发一起记录为"已构造"；校验失败则记录为"已拒绝"并升级（拒绝记录与升级同一次落盘）。
  - 必填内容：交接包号、实例号、轮次、来源节点、目标节点、方向、构造时间；至少一条证据引用。
  - 证据必须能解析：文件存在、是普通文件、内容非空、路径不越出工作区/任务目录；若带上一版哈希，哈希必须一致。
  - 回流包还必须有至少一条缺陷（摘要与证据位置都不能为空），以及修改要求或复测要求。
  - 校验失败时：该交接包显示"已拒绝（内容不合规）"；来源节点升级；实例挂起；没有会话、没有派发、轮次不增加。
  - 升级原因写明是哪一包、缺什么，例如"交接包 HO-002 内容不合规：缺少证据引用 out/calc.js"。
- **异常情况**：证据文件在校验后被删除或改写，下游仍可能读到旧内容；I1.4 只保证"投递那一刻可解析"，不保证投递后不变（产物锁定留给 I1.7）。
- **边界说明**：`single` 的引导交接包没有上游证据，不参与本校验；图驱动的交接包才校验。

### 2.4 C 持久化信箱：消息先落地，再敲门

- **使用角色**：核心自动执行；人工查看。
- **使用场景**：核心要唤醒下游会话，宿主暂时拒绝或超时。
- **用户操作**：无需操作；需要时执行 `orch handoff show <交接包号> --instance <实例号>` 查看信箱位置与尝试次数。
- **预期效果**：
  - 只对**图驱动交接包**（开发→测试这类真实交接）写信箱与重试；单节点与图入口没有真实交接包，不写"待投递"、不重试。
  - 投递前先把消息写入 `.orch/inbox/<实例号>/<交接包号>.json`；文件里能看到目标节点、目标会话、提示词、尝试次数与最后一次错误。
  - 第一次投递失败：交接包从"已投递"回落为"待投递 · 重试 1/2"，节点仍为执行中；200ms 后进行第 2 次尝试，再 500ms 后进行第 3 次尝试（首次 + 2 次重试，共 3 次）。
  - 任一次成功：交接包变为"已投递"，后续按原流程接受/完成。
  - 三次尝试都失败：交接包显示"已过期"；节点升级；实例挂起；原因写"交接包 HO-002 投递失败（已尝试 3 次）：…"。
  - 信箱写入失败：不投递，交接包显示"已拒绝（投递失败）"，节点升级、实例挂起。
- **异常情况**：
  - 会话创建就失败（还没有会话可投递）→ 沿用 I1.2 口径：一次尝试后立即升级，不进入重试、不写"待投递"。
  - 单节点（`single`）或图入口的首个派发没有真实交接包 → `prompt` 失败不进入重试，分别沿用 I1.2 的失败结果与 I1.3 的执行失败升级。
  - 已收到宿主事件后再失败 → 沿用 I1.2 / I1.3 的失败路径，不盲目重试。
- **边界说明**：I1.4 不处理"投递成功但核心崩溃后重投"；信箱文件会留给 I1.8 的恢复逻辑。

### 2.5 D 命令面：从"三条命令"到"一套操作"

- **使用角色**：人工操作者。
- **使用场景**：日常启动、巡检、排障、处理异常、交接查看。
- **用户操作**：按下表使用；旧命令写法不变。
- **预期效果**：

| 命令 | 作用 | 主要参数 |
|---|---|---|
| `orch run` | 发起实例 | `--cwd`、`--task`、`--instance`、`--template single\|code-loop\|task-loop`（缺省 `single`）、`--host`、新增 `--approval allow\|reject\|hold` |
| `orch status` | 列表或单实例状态 | `--instance`、`--events` |
| `orch instance status <实例号>` | 单实例状态（与 `status --instance` 同口径） | 位置参数或 `--instance` |
| `orch instance log <实例号>` | 事件时间线 | `--format text\|json`（缺省 text） |
| `orch instance graph <实例号>` | 节点级图摘要 | `--format text\|json`（缺省 text） |
| `orch attach <会话号>` | 只读附着会话 | 无 |
| `orch escalate list` | 列出升级 | `--instance`、`--all` |
| `orch escalate resolve <升级号>` | 裁决升级 | `--instance`、`--decision pass\|fail\|retry` |
| `orch approve <审批号>` | 处理审批 | `--instance`（歧义时必填）、`--decision allow\|deny` |
| `orch handoff list` | 列出交接包 | `--instance` |
| `orch handoff show <交接包号>` | 查看单包 | `--instance`（歧义时必填） |
| `orch workflow pause <实例号>` | 暂停下一次派发 | 位置参数或 `--instance` |
| `orch workflow resume <实例号>` | 恢复推进 | 位置参数或 `--instance` |
| `orch workflow abort <实例号>` | 终止（等同取消） | 位置参数或 `--instance` |
| `orch cancel --instance <实例号>` | 取消（保留） | `--instance` |
| `orch core stop` | 停核心（保留） | 无 |

- **异常情况**：
  - 未知命令 / 缺参数 / 非法 `--format` / 非法 `--decision` → 用法错误，退出码 2，并打印正确用法。
  - 编号找不到 / 编号在多个实例中重复 / 升级已处理 / 审批已处理 → 明确提示，退出码 1，不写任何状态。
  - 实例已结束 / 已挂起 / 已停止推进时执行不适用动作 → 明确提示当前状态与不能执行的原因，退出码 1。
- **边界说明**：`orch run` / `status` / `cancel` / `core stop` 的旧参数、旧输出与旧退出码保持不变；新字段只在新状态或新命令中出现。

### 2.6 E `run` / `status`：旧写法不变，新状态看得见

- **使用角色**：人工操作者。
- **使用场景**：日常发起与巡检。
- **用户操作**：`orch run --cwd . --task "…" [--template code-loop|task-loop|single] [--approval hold]`；`orch status --instance INST-001`。
- **预期效果**：
  - 原有三行、节点表、会话行、交接包行、升级块、退出码不变。
  - 实例暂停时，实例行显示"运行中（已暂停）"；列表行同样带这个限定词。
  - 有审批记录时，在升级块之后按审批号逐条显示状态（待处理/已通过/已拒绝/已作废）：`审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write`。
  - `orch run` 等待期间一旦出现待审批，终端打印同一审批行；审批处理后会继续流式输出会话行。
  - 有重试时，交接包行显示"待投递 · 重试 2/2"。
  - 挂起后的"下一步"改为：可以 `escalate list` 查看、`escalate resolve` 处理，仍可 `cancel` 终止；不再说"本版本不能继续"。
- **异常情况**：审批拒绝后，沿用原"审批被拒绝，任务中止于 <动作>"的结果；不会出现第二套拒绝文案。
- **边界说明**：`status` 不带 `--instance` 的列表仍按原格式；仅当有暂停/待审批时追加限定词或计数。

### 2.7 F 实例视图：状态、日志、图

- **使用角色**：人工操作者、回归测试。
- **使用场景**：想知道"现在到哪、发生过什么、结构长什么样"。
- **用户操作**：
  - `orch instance status INST-001`
  - `orch instance log INST-001 [--format text|json]`
  - `orch instance graph INST-001 [--format text|json]`
- **预期效果**：
  - `status` 与 `orch status --instance` 同口径，便于脚本迁移。
  - `log` 按事件顺序输出：时间、层、编号、变化、原因；`json` 输出原始事件数组，便于复盘。
  - `graph` 的 `text` 是节点与边的 ASCII 摘要；`json` 是稳定字段、稳定顺序的结构化数据，含实例、模板、状态、暂停、节点、边、交接包、升级、审批、当前节点。
  - 图里没有角色实例、没有连接线聚合；这是 I1.5 之后的事。
- **异常情况**：实例不存在 → 沿用 I1.1 的 `实例 INST-999 · 不存在`，退出码 1；空事件 → 输出"事件 —"。
- **边界说明**：`graph` 不写状态；`log` 不触发状态变化。

### 2.8 G 附着会话：看现场，不动手

- **使用角色**：人工排障者。
- **使用场景**：某个会话长时间"执行中"或"等待审批"，想看看最近发生了什么。
- **用户操作**：`orch attach <会话号>`；按 Ctrl-C 脱离。（下文 `SES-001` 均为示例；实际会话号由宿主 `session/new` 返回，形如 `mock-sess-…`，可从 `orch run` 的「会话已创建」行或 `instance log --format json` 的会话事件取得。）
- **预期效果**：
  - 第一行："已附着会话 SES-001（实例 INST-001 · 节点 T-001 开发）"。
  - 随后打印该会话最近 20 条事件，并持续跟随新事件。
  - 若该会话有待审批，紧跟一行审批信息。
  - Ctrl-C 后打印"已脱离会话 SES-001"，退出码 0；实例、节点、会话状态都不变。
- **异常情况**：会话号不存在 → "未找到会话 SES-999"，退出码 1。
- **边界说明**：I1.4 不向会话发送任何输入；真正的交互式附着留给 I1.8。

### 2.9 H 升级处理：从"只能看"到"能拍板"

- **使用角色**：人工决策者。
- **使用场景**：轮次超限、派发失败、执行失败、交接包不合规或投递耗尽。
- **用户操作**：
  - `orch escalate list [--instance INST-001] [--all]`
  - `orch escalate resolve ESC-001 --decision pass|fail|retry [--instance INST-001]`
- **预期效果**：
  - `list` 默认列出所有实例的**待处理**升级；带 `--instance` 只看一个实例；`--all` 连已处理/已作废一起列。两个参数同时给出时**先按实例过滤、再由 `--all` 放开状态范围**（即"只看该实例的全部升级"），不是二选一、也不报错。
  - 每行包含：升级号、实例号、节点与角色、轮次、状态、原因摘要。
  - `pass`：人工认定该节点本轮通过。若它是终节点 → 实例已完成；若它有下游 → 节点变已完成并立即推进下游。
  - `fail`：节点失败、实例失败，不再推进；下游不启动。
  - `retry`（重新分配）：为该节点新建一个会话、轮次 +1、只重跑该节点；实例回到运行中；人工本次额外授权一轮，后续再次失败仍会升级。
  - 处理成功打印"升级 ESC-001 已处理（通过/失败/重新分配）"和当前实例行；处理完自动推进，不需要再敲 `run`。
  - 同一升级只能处理一次；第二次提示"已处理"，退出码 1，状态不变。
  - 不同原因允许的决策不同：交接包不合规、派发失败、执行失败、投递耗尽不能"通过"（没有可接受的产出）；轮次超限可以"通过"；所有原因都允许"失败"与"重新分配"。
- **异常情况**：
  - 升级号不存在 / 在多个实例中重复 → 明确提示；歧义时要求 `--instance`。
  - 实例不是挂起状态 → 提示原因，拒绝处理。
  - `retry` 后新会话仍建不起来 → 再次升级，不假装运行中。
- **边界说明**：处理升级不会重跑已完成的上游节点；不会改变历史轮次的产物。

### 2.10 I 审批处理：允许或拒绝一次具体动作

- **使用角色**：人工审批者。
- **使用场景**：发起时选择了 `--approval hold`，宿主请求执行某个工具动作。
- **用户操作**：
  - 发起：`orch run --cwd . --task "…" --approval hold`
  - 查看：`orch status --instance INST-001`
  - 处理：`orch approve APR-001 --decision allow|deny [--instance INST-001]`
- **预期效果**：
  - 宿主请求审批时，会话显示"等待审批：<动作>"，节点仍是执行中；核心生成待处理审批 `APR-001`。
  - `allow`：审批显示已通过，会话继续执行；任务正常往下走。
  - `deny`：审批显示已拒绝，会话停止本轮；`single` 沿用"审批被拒绝，任务中止于 <动作>"的失败结果，多节点图沿用既有的执行失败升级路径（节点升级、实例挂起）。
  - 同一审批只能处理一次；第二次提示"已处理"。
  - 取消实例时，所有待处理审批变为已作废，不会留下永远"待处理"的幽灵。
  - 审批号在多个实例中重复时，`approve` 要么找到唯一匹配，要么要求 `--instance`；不会猜。
- **异常情况**：会话已不在运行（核心重启等）→ 提示"审批已失效"，不假装已放行。
- **边界说明**：默认策略仍是自动放行；`--approval reject` 可让所有请求直接拒绝（沿用既有策略）；只有 `hold` 会产生待处理审批。**两个词不要混**：`--approval reject` 是**发起时的策略**（宿主的每次请求直接拒绝，不产生待处理项、不需要人工介入）；`--decision deny` 是**对某一条已存在的待处理审批的单次裁决**（`--decision allow|deny` 是 `approve` 的参数）。

### 2.11 J 交接包查看：每一包都能单独查

- **使用角色**：人工排障者、审计者。
- **使用场景**：想知道第 2 轮到底交给下游什么、证据在哪、为什么被拒。
- **用户操作**：
  - `orch handoff list [--instance INST-001]`
  - `orch handoff show HO-002 --instance INST-001`
- **预期效果**：
  - `list` 按实例、按包号列出：包号、实例、方向、状态、最后时间；方向显示"开发→测试"/"测试→开发（回流）"/"开发→测试（复测）"。
  - `show` 显示：实例、方向、状态（拒绝时带原因）、构造/待投递/投递/接受/完成/拒绝/过期时间、证据、缺陷、修改要求或复测要求、尝试次数与最后一次错误、信箱文件位置。
  - 状态包含"已构造 / 待投递 / 已投递 / 已接受 / 已完成 / 已拒绝 / 已过期"，与终端其他位置一致。
- **异常情况**：包号不存在 → "未找到交接包 HO-999"；包号在多个实例重复且未给 `--instance` → 要求指定实例，退出码 1。
- **边界说明**：`show` 只读，不重投、不修改包。

### 2.12 K 暂停 / 恢复 / 终止：停在派发边界

- **使用角色**：人工操作者。
- **使用场景**：想在下游派发前改个文件、看一眼前一步产物，再继续；或者临时让实例停止推进。
- **用户操作**：
  - `orch workflow pause INST-001`
  - `orch workflow resume INST-001`
  - `orch workflow abort INST-001`
- **预期效果**：
  - `pause`：实例行立刻显示"运行中（已暂停）"；当前正在执行的回合允许跑完；核心不再发起**新的**派发。暂停与派发以**本次派发提交**为界：还没落交接包时暂停 → 本次不派发、不留包；交接包已落盘但尚未派发时暂停 → 包保留为"已构造"（恢复后派发），恢复时用**原包**投递一次，不重复造包、不重复计数；派发已提交后暂停 → 这次派发照常开始并跑完，但不会再发起下一次派发。前台 `orch run` 在暂停生效且当前回合收尾后打印已暂停的实例行与恢复提示，退出码 0（不当作挂起或失败）。恢复后从该边界继续。
  - `resume`：清除暂停；若当前没有回合在跑且已有完成节点等待推进，立即推进一次；仍有回合在跑时只清暂停，由该回合收尾后继续推进，不会重复派发同一节点。实例行恢复为"运行中"。
  - `abort`：与 `orch cancel --instance` 完全一致，输出取消结果行。
  - 暂停期间 `status`、`status.md`、`instance graph` 都显示"已暂停"。
  - 重复 `pause` / `resume` 不报错，打印当前实例行，退出码 0。
- **异常情况**：
  - 实例已结束 / 已挂起 / 已停止推进时执行不适用动作 → 提示当前状态，拒绝暂停或恢复，退出码 1。
- **边界说明**：暂停不打断当前回合，不等于"冻结进程"；需要立即停止请用 `abort`/`cancel`。

### 2.13 功能之间的衔接：走完一遍

1. 我执行 `orch run --cwd ./demo --task "…" --template code-loop`。
2. 实例目录出现 `workspace/shared/`、`workspace/stage/T-001/`、`workspace/stage/T-002/`、`workspace/status.md`；`status.md` 显示开发执行中。
3. 开发完成后，核心构造交接包，校验 `calc.js` 存在且非空，写入 `.orch/inbox/INST-001/HO-001.json`，再派发测试；`status.md` 与 `orch status` 都显示交接包已投递。
4. 如果 `calc.js` 被删了：交接包显示已拒绝（内容不合规），开发节点升级，实例挂起；`orch status` 的下一步提示我用 `escalate list/resolve`。
5. 我执行 `orch escalate list --instance INST-001`，看到原因；修好文件后执行 `orch escalate resolve ESC-001 --instance INST-001 --decision retry`，开发节点重新跑一轮，新交接包重新校验、投递。
6. 测试第 1 轮失败：回流包带缺陷与复测要求，校验通过后回到开发；第 2 轮仍失败 → 升级。
7. 我也可以先 `orch workflow pause INST-001`，让当前回合跑完但不再派发；改完文件后 `resume` 继续。
8. 如果宿主请求审批且我是 hold 策略：`orch run` 终端出现审批行；我在另一个终端 `orch approve APR-001 --decision allow`，会话继续；拒绝时，单节点沿用"审批被拒绝，任务中止于 <动作>"，多节点沿用既有执行失败路径（节点升级、实例挂起）。
9. 任何时候我都能 `orch attach <会话号>` 看会话现场、`orch instance log` 看时间线、`orch instance graph --format json` 做回归对比、`orch handoff show` 查单包。
10. 想终止：`orch workflow abort INST-001`，输出与 `orch cancel` 一致。

### 2.14 用户可见的业务规则

| 编号 | 规则 |
|---|---|
| BR-01 | 每个实例都有 `shared/` 与 `status.md`；多节点实例每个节点有独立的 `stage/<节点号>/`。 |
| BR-02 | `shared/` 所有人可读、核心/人工可写；`stage/<节点号>/` 本节点可写、下游只读；`status.md` 由核心维护。 |
| BR-03 | `status.md` 在每次状态变化后刷新，内容包含实例、模板、状态、暂停、任务、当前节点、节点进度、交接包、升级、审批。 |
| BR-04 | `status.md` 必须整文件原子替换，用户永远看不到半截内容。 |
| BR-05 | 图驱动的交接包在投递前必须校验；校验不通过不得投递。 |
| BR-06 | 交接包必须有交接包号、实例号、轮次、来源节点、目标节点、方向、构造时间，以及至少一条证据引用（输入、上一版引用或回流缺陷证据）。 |
| BR-07 | 证据必须是存在、非空、可解析、不越界的普通文件；带上一版哈希时必须一致。 |
| BR-08 | 回流交接包必须有至少一条缺陷（摘要与证据位置非空），以及修改要求或复测要求。 |
| BR-09 | 校验失败：交接包显示"已拒绝（内容不合规）"，来源节点升级，实例挂起，不建会话、不派发、不增加轮次。 |
| BR-10 | 唤醒消息必须先原子写入信箱，再投递；信箱写不进去不得投递。 |
| BR-11 | 投递失败自动重试，最多 2 次（首次 + 2 次重试，共 3 次尝试）；重试期间显示"待投递 · 重试 N/2"。 |
| BR-12 | 3 次尝试都失败：交接包"已过期"，节点升级，实例挂起，原因写明投递失败。 |
| BR-13 | 会话创建失败沿用 I1.2 口径：一次尝试后升级，不进入投递重试；单节点与图入口的提示词失败也不进入信箱重试。 |
| BR-14 | 重试不得新增派发次数、轮次或会话；同一节点同一轮只对应一张交接包。 |
| BR-15 | 待处理升级可以裁决为通过、失败、重新分配；同一升级只能处理一次。 |
| BR-16 | 通过：终节点 → 实例已完成；中间节点 → 节点已完成并立即推进下游。 |
| BR-17 | 失败：节点失败、实例失败，不再推进。 |
| BR-18 | 重新分配：新建会话、轮次 +1、只重跑该节点，实例恢复运行；人工本次额外授权一轮。 |
| BR-19 | 交接包不合规、派发失败、执行失败、投递耗尽不允许"通过"；轮次超限允许"通过"；所有原因都允许"失败"和"重新分配"。 |
| BR-20 | 处理升级必须实例处于挂起且未停止推进；否则拒绝并保持原状。 |
| BR-21 | 只有 `--approval hold`（或宿主配置为 hold）才生成待处理审批；默认自动放行。 |
| BR-22 | 审批允许 → 会话继续；审批拒绝 → `single` 沿用原"审批被拒绝，任务中止于 <动作>"的失败口径；多节点图沿用 I1.2 / I1.3 的执行失败路径（节点升级、实例挂起），不新造第二套失败文案。 |
| BR-23 | 同一审批只能处理一次；取消实例时待处理审批全部作废。 |
| BR-24 | 暂停只阻止下一次派发，不打断当前回合、当前派发或正在进行的重试。 |
| BR-25 | 恢复清除暂停；若有已完成节点等待推进，立即推进一次。 |
| BR-26 | 重复暂停 / 恢复不报错，打印当前实例行并成功返回。 |
| BR-27 | 终止等同取消，沿用取消的结果行、覆盖范围与退出码。 |
| BR-28 | 暂停状态必须在实例行、列表行、`status.md` 与 `instance graph` 中可见。 |
| BR-29 | `run/status/cancel/core stop` 的旧参数、旧输出、旧退出码必须保持；新字段只在新状态下出现。 |
| BR-30 | 命令退出码沿用：0 成功、1 运行/业务失败、2 用法错误、3 开始前失败、4 挂起收尾、5 停止推进收尾。 |
| BR-31 | 编号在实例内单调递增且不复用；跨实例命令遇到重复编号时必须要求指定实例，不得猜测。 |
| BR-32 | 列表为空时输出明确的空态行（`升级 —` / `交接包 —` / `事件 —`），不输出空白。 |
| BR-33 | `attach` 只读：不改变实例、节点、会话状态，不向会话注入输入。 |
| BR-34 | `instance graph --format json` 的字段与顺序稳定，可直接用于回归对比。 |
| BR-35 | CLI 用户可见中文集中在 CLI 文案模块；`status.md` 由核心侧独立文案表生成，核心状态词必须与 CLI 文案逐字一致并有对照测试；核心与 daemon 不出现 D-11.2 的 **11 词并集**（I1.2 四词 + I1.3 七词）中任一模板专有字面量（`single` 是核心允许的缺省模板标识，不在扫描表内）。 |
| BR-36 | 不新增运行时依赖；`package.json` 的 `dependencies` 仍为空。 |
| BR-37 | 取消必须覆盖新增的待投递交接包、待处理审批、暂停状态与挂起实例。 |
| BR-38 | 旧格式实例（v1 单对象）仍只读可查；新命令不得把它们写坏。 |
| BR-39 | 工作区初始化失败必须在发起前停住，退出码 3，且不创建会话。 |
| BR-40 | 处理升级后必须自动推进或按结果收尾，不需要用户再敲 `run`。 |
| BR-41 | 所有人工动作（resolve / approve / pause / resume / abort）都必须留下事件记录。 |
| BR-42 | `status` / `instance status` 按审批号逐条打印该实例的全部审批记录（待处理/已通过/已拒绝/已作废）；`orch run` 只在新审批产生时打印待处理行；没有审批记录的旧流程输出不变。 |
| BR-43 | `handoff list/show`、`escalate list` 的排序必须稳定：先实例号、再编号。 |
| BR-44 | 单节点引导交接包不参与 schema 校验与信箱重试，其原有输出不变。 |
| BR-45 | 任何命令都不得修改与它动作无关的状态；查看类命令严格只读。 |
| BR-46 | 交接包被拒绝、投递过期、升级处理、审批、暂停/恢复都必须能被 `instance log` 看到。 |

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

> **观测口径**：本迭代允许四类观测——① **命令输出**（用户直接看到）；② **机检**：`.orch/instances/<id>/state.json`、`events.jsonl`、`.orch/inbox/**`、`workspace/status.md` 的字段与文件；③ **夹具**：`.mock/prompts/<n>.json`、`.mock/` 标记、夹具 stdout；④ **架构检查**：源码字面量扫描与依赖检查。②③④类断言一律以 **`机检：`** / **`夹具：`** / **`架构检查：`** 开头。查看类 AC 默认在全新项目根执行，每个 AC 开始前清空 `.orch`；多实例 AC 中的 `INST-A/B/C` 是占位符，实际使用运行中生成的 `INST-nnn`。
>
> 每条 AC 的 Given 都是用户可见或测试可准备的前置状态；When 是用户命令或夹具动作；Then 是用户可见结果或上述明确标注的观测。

#### AC-01 编码闭环启动后出现共享工作区

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-01、BR-02
- **Given** 一个全新的项目根，目录可写
- **When** 我执行 `orch run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop`
- **Then** 实例目录下出现 `workspace/shared/`、`workspace/stage/T-001/`、`workspace/stage/T-002/`、`workspace/status.md`；`orch status --instance INST-001` 的首行仍是原来的实例行
- **机检：** `workspace/shared` 与两个 `stage` 都是目录；`status.md` 是一份可读 Markdown

#### AC-02 文档闭环每个节点都有阶段区

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-01
- **Given** 一个全新的项目根，任务含一行 `产物：release-notes.md`
- **When** 我执行 `orch run --cwd ./demo --task "写发布说明，产物：release-notes.md" --template task-loop`
- **Then** 工作区出现 `shared/`、`stage/T-001/`、`stage/T-002/`、`stage/T-003/`、`status.md`
- **机检：** 三个 stage 目录都存在；`status.md` 的节点段落列出 T-001、T-002、T-003

#### AC-03 单节点工作区新增但不改旧输出

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-01、BR-29、BR-44
- **Given** 一个全新的项目根
- **When** 我执行 `orch run --cwd ./demo --task "写下说明"`
- **Then** 终端前三行与 I1.1 基线逐字一致；实例目录出现 `workspace/shared/` 与 `workspace/status.md`；不出现 `stage/`；`status.md` 含实例行与状态行，不含 `## 节点` 段
- **机检：** `stage` 目录不存在；`handoffs` 只有引导包且不参与 schema 校验，没有 `handoff.rejected` 事件

#### AC-04 `status.md` 随状态变化刷新

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-03
- **Given** 编码闭环已启动，开发和测试各完成过一次状态变化
- **When** 我打开 `workspace/status.md`
- **Then** 文件包含实例号与模板名（标题行）、当前状态、暂停、任务、当前节点、工作区绝对路径、两个节点各自的状态与轮次、最近交接包、升级与审批段落；节点状态与 `orch status` 显示一致
- **机检：** 文件在每次 `events.jsonl` 出现节点/交接包/升级/审批状态变化后 1 秒内包含对应中文状态

#### AC-05 人工修改 `status.md` 会被下一次刷新覆盖

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-02、BR-03
- **Given** 实例正在运行，我手工在 `status.md` 里加了一行"待办：修 calc.js"
- **When** 下一个节点状态变化发生
- **Then** 该手写行消失，`status.md` 恢复为核心生成的内容
- **机检：** 刷新后的文件不含我写的字符串

#### AC-06 工作区建不出来时发起前停住

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-39
- **Given** 夹具用既有故障注入 `MAESTRO_FAULT=workspace_init:fail` 让工作区建不出来
- **When** 我执行 `orch run --cwd ./demo --task "…" --template code-loop`
- **Then** 终端出现"无法创建工作区：…"；退出码 3；没有会话、没有派发、没有留下半个实例目录
- **机检：** `.orch/instances/INST-001` 不存在；`events.jsonl` 没有 `node.dispatch`

#### AC-07 多节点提示词带工作区上下文段

- 场景类型：夹具 ｜ 风险：P0 ｜ 引用：BR-02、BR-03
- **Given** 编码闭环完整跑一轮（含 1 次回流与 1 次复测），文档闭环完整跑一轮（含 1 次驳回回流）
- **When** 依次派发：code-loop 入口 T-001、forward T-002、backflow T-001（第 2 轮）、retest T-002（第 2 轮）；task-loop T-001 研究、T-002 撰写、T-003 审核、T-002 撰写（回流第 2 轮）、T-003 复测审核（第 2 轮）
- **Then** 9 个多节点提示词末尾都出现附录 A-6 的「工作区上下文」段；入口（code-loop T-001 首次、task-loop T-001）只有前三行；其余为四行；task-loop 审核（两轮）正文已有 `工作区：`，末尾只追加后三行（`共享区（只读）` / `本节点阶段区` / `上游阶段区（只读）`），不重复 `工作区：`；单节点提示词不出现该段
- **夹具：** 逐个 `.mock/prompts/<n>.json` 的 `task` 逐字包含 `工作区：<工作区绝对路径>`、`共享区（只读）：<工作区绝对路径>/shared`、`本节点阶段区：<工作区绝对路径>/stage/<本节点>`；非入口另含 `上游阶段区（只读）：<工作区绝对路径>/stage/<来源节点>`
- **机检：** 审核提示词中的 `工作区：` 行只有一条；只传 `node`、不带 `graph` 的 `promptFor` 单元调用不追加该段；生产派发的每次调用都带 `graph`（`single` 图只有 1 个节点，因而不追加），判定只按节点数、不按模板名

#### AC-08 正常交接包通过校验并投递

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-05、BR-06、BR-07
- **Given** 开发节点完成，`calc.js` 存在且非空
- **When** 核心推进到测试
- **Then** 交接包从"已构造"变为"已投递"；测试会话收到提示；终端不出现拒绝或升级
- **机检：** `events.jsonl` 含 `handoff.delivered`，且该事件之后该包 `state` 为 `delivered` 或 `consumed`；没有 `handoff.rejected` 事件

#### AC-09 缺必填字段的交接包被拒绝并升级

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-05、BR-06、BR-09
- **Given** 用 `NODE_ENV=test` 下的 `test.handoff` 接缝构造一张缺少目标节点字段的交接包草稿（尚未记录为"已构造"，绕过上游产物核对，只验证交接层）
- **When** 接缝让这张包进入投递路径
- **Then** 该包显示"已拒绝（内容不合规）"；来源节点升级；实例挂起；没有新会话、没有新派发
- **机检：** 包 `rejectReason` 为 `invalid_payload`；`handoffs` 中该包只以 `rejected` 出现、没有 `created` 记录；`events.jsonl` 有 `handoff.rejected` 与 `escalation.created`，没有 `node.dispatch`；`sessions.length` 不增加

#### AC-10 缺证据引用被拒绝并升级

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-05、BR-07、BR-09
- **Given** 用同一接缝构造一张没有任何证据引用的交接包草稿（上游产物核对已通过，专门验证交接层兜底）
- **When** 接缝让这张包进入投递路径
- **Then** 终端升级原因显示"缺少证据引用"；交接包已拒绝；实例挂起；下游未启动
- **机检：** `escalations[0].reasonCode === 'handoff_invalid'`；`reasonDetail` 含"缺少证据引用"

#### AC-11 证据文件不存在或为空被拒绝

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-07、BR-09
- **Given** 用同一接缝构造一张引用 `calc.js` 的交接包草稿，并在投递前把该文件删除（或写成 0 字节）
- **When** 接缝让这张包进入投递路径
- **Then** 交接包已拒绝（内容不合规）；升级原因指出该文件不存在或为空
- **机检：** `reasonDetail` 含 `calc.js`；下游节点 `round` 不变

#### AC-12 证据越界或哈希不符被拒绝

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-07、BR-09
- **Given** 用同一接缝构造一张回流边的包草稿（`edgeKind='backflow'`，文档闭环 `round=2`，此时上一版引用存在），把证据引用改成 `../secret.txt`（并在工作区外放一个同名可读文件），或把上一版引用的哈希改成与文件实际哈希不一致
- **When** 接缝让这张包进入投递路径
- **Then** 交接包已拒绝；升级原因指出路径越界或哈希不符
- **机检：** 即使工作区外文件真实存在，越界引用仍被拒绝；`artifactRefs.previous.sha256` 与文件哈希不等时被拒绝

#### AC-13 回流包缺缺陷或修改要求被拒绝

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-08、BR-09
- **Given** 用同一接缝构造一张回流包草稿，其 `defects` 为空，或用 `empty-requirements` 清空修改要求与复测要求（绕过 C-06 的默认补全，专验交接层兜底）。I1.3 的审核解析器本会在更早阶段拦住这类输入，本 AC 专门验证交接层兜底
- **When** 接缝让这张包进入回流路径
- **Then** 回流包已拒绝；来源节点升级；撰写者/开发不会被派发
- **机检：** `rejectReason === 'invalid_payload'`；目标节点没有新会话；来源节点 `escalated`，`reasonCode === 'handoff_invalid'`

#### AC-14 校验失败时零派发且原因可见

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-09、BR-46
- **Given**  AC-10 的坏包场景
- **When** 我执行 `orch status --instance INST-001` 与 `orch status --instance INST-001 --events`
- **Then** 交接包行显示已拒绝（内容不合规）；升级块给出节点、轮次、原因与下一步；日志里能看到拒绝与升级事件；没有"执行中"的假会话
- **机检：** `sessions.length` 不增加；`counters.dispatchCount` 不增加

#### AC-15 信箱先落盘再投递

- 场景类型：夹具 ｜ 风险：P0 ｜ 引用：BR-10
- **Given** 编码闭环开发完成，核心准备唤醒测试
- **When** 核心投递交接包
- **Then** 信箱文件在宿主收到提示词之前已存在且内容完整；日志顺序能证明"先落盘、后投递"
- **机检：** `events.jsonl` 中 `handoff.inboxed` 出现在该包 `handoff.delivered` 之前；`.orch/inbox/INST-001/HO-001.json` 可解析且含目标节点、目标会话、提示词、`deliveryAttempts` 与 `lastError`；不依赖 `.mock/prompts/2.json` 的写入时机（mock 在 `sessionNew` 时就会建占位文件，不能作为先后证据）

#### AC-16 一次投递失败后重试成功

- 场景类型：异常恢复 ｜ 风险：P0 ｜ 引用：BR-10、BR-11
- **Given** 宿主对第一次 `prompt` 返回失败、第二次成功
- **When** 核心投递交接包
- **Then** 交接包短暂显示"待投递 · 重试 1/2"，随后变为"已投递"；测试会话最终收到提示
- **机检：** `events.jsonl` 含 `handoff.pending`（`detail.deliveryAttempts === 1`）且位于最终 `handoff.delivered` 之前；包 `deliveryAttempts === 2`；场景根 `.mock/prompt-attempts-<sessionId>.json` 的 `attempts === 2`；目标节点只有 1 个会话（重试不新建会话）；`node.dispatch` 只有一条
- **补充：** 同一场景改用 `promptFailures: 2` 重跑一次：第 3 次成功，包 `deliveryAttempts === 3`，`events.jsonl` 有两次 `handoff.pending`（attempts 1、2），最终出现 `handoff.delivered`。

#### AC-17 重试耗尽后升级

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-11、BR-12
- **Given** 宿主连续 3 次拒绝 `prompt`（首次 + 2 次重试）
- **When** 核心投递交接包
- **Then** 交接包显示"已过期"；节点升级；实例挂起；升级原因写明已尝试 3 次
- **机检：** 包 `state === 'expired'`、`deliveryAttempts === 3`、`expiredAt` 非空；信箱文件 `deliveryAttempts === 3` 且 `lastError` 非空；场景根 `.mock/prompt-attempts-<sessionId>.json` 的 `attempts === 3`；`escalations[0].reasonCode === 'delivery_failed'`；目标节点仍只有 1 个会话（重试不新增会话）

#### AC-18 重试不增加派发、轮次或会话

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-14
- **Given**  AC-16 的重试场景
- **When** 重试完成
- **Then** 终端没有重复的"派发"事件；节点轮次仍是本轮
- **机检：** `counters.dispatchCount` 只加 1；目标节点 `round` 不变；`events.jsonl` 中 `reason === 'node.dispatch'` 只有一条

#### AC-19 会话创建失败仍按一次尝试升级

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-13、BR-29
- **Given** I1.2 的编码闭环 `dispatch-fail-first` 夹具（首个节点 `sessionNew` 失败）
- **When** 我发起编码闭环
- **Then** 实例直接挂起并显示升级；没有"待投递"、没有重试、没有会话记录
- **机检：** `escalations[0].reasonCode === 'dispatch_failed'`；`sessions.length === 0`（首派会话没建起来）；`node.dispatch` 只有一条；`handoffs` 中没有 `created` 包

#### AC-20 信箱写不进去时不投递

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-10
- **Given** 在编码闭环成功路径上（开发为第 1 步、测试为第 2 步），夹具用本迭代新增、仅 `NODE_ENV=test` 生效的故障值 `MAESTRO_FAULT=inbox_write:fail` 让信箱写入失败
- **When** 核心准备投递
- **Then** 宿主没有收到提示；交接包显示已拒绝（投递失败）；节点升级、实例挂起
- **机检：** 场景根 `.mock/prompts/2.json` 的 `task` 仍为 `null`（测试节点这次 mock 启动时建立的占位未被 `session/prompt` 覆盖），且场景根 `.mock/prompt-attempts-<目标会话 ID>.json` 不存在；目标会话最多 1 个且为 `idle`；`rejectReason === 'delivery_failed'`

#### AC-21 跨实例列出待处理升级

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-15、BR-43
- **Given** 两个实例各有一个待处理升级，其中 INST-001 另有一条已处理升级与一条已作废升级；另有一个全新项目根，没有任何实例与升级
- **When** 我执行 `orch escalate list`，再执行 `orch escalate list --all`，再执行 `orch escalate list --instance INST-001 --all`，最后在全新项目根执行 `orch escalate list`
- **Then** 默认两行都出现，先按实例号、再按升级号排序；行内含实例号、节点与角色、轮次、状态、原因摘要；`--all` 时已处理升级以"已处理（通过/失败/重新分配）"、已作废升级以"已作废"出现；`--instance` 与 `--all` 同时给出时只看该实例、但含其已处理与已作废；没有升级时输出 `升级 —`
- **机检：** 各次输出行序稳定；默认不含已处理/已作废，`--all` 含全部，`--instance INST-001 --all` 只含 INST-001 的三行（待处理 + 已处理 + 已作废）

#### AC-22 按实例过滤升级

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-15
- **Given** 两个实例都有升级
- **When** 我执行 `orch escalate list --instance INST-001`
- **Then** 只出现 INST-001 的升级行
- **机检：** 输出不含 INST-002

#### AC-23 通过处理终节点升级 → 实例完成

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-15、BR-16、BR-40
- **Given** 编码闭环终节点 T-002 因轮次超限升级，实例挂起
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision pass`
- **Then** 输出"升级 ESC-001 已处理（通过）"与当前实例行 `实例 INST-001 · 已完成 · 模板 编码闭环`；节点为已完成；不需要再敲 `run`
- **机检：** 升级 `state === 'resolved'`、`resolution === 'pass'`；实例 `completed`；节点 `done`

#### AC-24 通过处理中间节点升级 → 下游继续

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-16、BR-40
- **Given** 先在任务目录放好非空 `calc.js`；用 `NODE_ENV=test` 的 `test.escalate` 接缝把开发节点置为 `rounds_exceeded` 升级（`reasonCode: 'rounds_exceeded'`），并给该节点注入 `artifactRefs: [{ ref: 'calc.js' }]`，确保人工 `pass` 后能构造出有证据的交接包；测试尚未派发
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision pass`
- **Then** 开发节点变已完成，核心立即推进测试；交接包校验通过；`orch status` 显示测试执行中或已完成
- **机检：** 实例 `running` 或 `completed`；出现一次新的 `node.dispatch`；下游节点 `round` 增加；没有 `handoff.rejected` 事件

#### AC-25 失败处理升级 → 实例失败

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-17
- **Given** 编码闭环一个待处理升级，实例挂起
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision fail`
- **Then** 输出"升级 ESC-001 已处理（失败）"与当前实例行 `实例 INST-001 · 失败 · 模板 编码闭环`；没有新的下游派发
- **机检：** 节点 `failed`、实例 `failed`；`dispatchCount` 不再增加

#### AC-26 重新分配 → 新会话、新一轮、只重跑该节点

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-18、BR-40
- **Given** 独立项目根；开发节点已派发过一次并回到空闲（mock 回合结束后会话即 `idle`，无需额外等待）；用 `NODE_ENV=test` 的 `test.escalate` 接缝把该节点置为 `rounds_exceeded` 升级（`reasonCode: 'rounds_exceeded'`），实例挂起、测试尚未派发
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision retry`
- **Then** 输出"升级 ESC-001 已处理（重新分配）"与当前实例行 `实例 INST-001 · 运行中 · 模板 编码闭环`；开发节点出现新会话、轮次 +1；测试没有被重跑
- **机检：** `sessions.length` 增加 1；目标节点 `round` 增加 1；其他节点 `round` 不变；旧会话不再是 `running`（按 D-6.6 隔离）

#### AC-27 同一升级不能处理两次

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-15
- **Given** 独立项目根，按 AC-23 的步骤重放至升级已处理
- **When** 我再次执行同一 `resolve`
- **Then** 提示升级已处理；退出码 1；实例状态和轮次不变
- **机检：** 没有第二条 `escalation.resolved` 事件

#### AC-28 不允许的决策被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-19
- **Given** 升级原因为"交接包不合规"、"派发失败"、"执行失败"或"投递耗尽"
- **When** 我对四种原因各执行一次 `orch escalate resolve <升级号> --instance <实例号> --decision pass`
- **Then** 提示该升级不支持"通过"；退出码 1；升级仍是待处理
- **机检：** 实例仍挂起；节点仍未完成

#### AC-29 找不到、歧义或状态不对时拒绝处理

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-20、BR-31
- **Given** 升级号不存在、或两个实例都有 ESC-001、或实例不是挂起（三个子场景各用独立项目根，避免前置互斥）
- **When** 我分别执行：① `orch escalate resolve ESC-001 --instance INST-001 --decision fail`（升级不存在）；② `orch escalate resolve ESC-001 --decision fail`（两个实例都有 ESC-001，不带 `--instance`）；③ `orch escalate resolve ESC-001 --instance INST-002 --decision fail`（INST-002 不是挂起）
- **Then** 分别提示"未找到升级 ESC-001""请加 --instance""实例 INST-002 当前不是挂起状态，不能处理升级"；退出码 1；没有任何写入
- **机检：** 所有实例 `rev` 不变

#### AC-30 重新分配后仍失败会再次升级

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-18、BR-40
- **Given** 用夹具让重新分配时的新会话创建失败（`retry` 尚未执行）
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision retry`
- **Then** 生成新的升级；实例再次挂起；不会显示"运行中"；`resolve` 命令按挂起收尾，退出码 4
- **机检：** `escalations` 数量增加 1；实例 `suspended`

#### AC-31 审批允许后会话继续

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-21、BR-22
- **Given** 用 `--template single --approval hold` 发起，宿主请求 `write` 动作，实例等待审批
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision allow`
- **Then** 输出"审批 APR-001 已通过 · 动作 write"；会话从"等待审批"回到执行中；任务最终按正常路径结束
- **机检：** 审批 `state === 'approved'`；出现 `permission.allowed` 事件；`status --instance` 的审批行显示"已通过"

#### AC-32 审批拒绝后沿用原失败口径

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-22
- **Given** 用 `--template single --approval hold` 发起，处于等待审批
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision deny`
- **Then** 输出"审批 APR-001 已拒绝 · 动作 write"；随后 `orch run` 以"审批被拒绝，任务中止于 write"收尾
- **机检：** 审批 `denied`；实例 `failed`；节点 `failed`；没有第二套原因文案

#### AC-33 同一审批不能处理两次

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-23
- **Given** 独立项目根，按 AC-31 的步骤重放至审批已通过
- **When** 我再次执行 `approve APR-001`
- **Then** 提示审批已处理；退出码 1；实例状态不变
- **机检：** 审批 `state` 只变一次；只有一条审批处理事件（`permission.allowed`）

#### AC-34 审批号歧义时要求指定实例

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-31
- **Given** 两个实例都有 `APR-001`，另有一个不存在的 `APR-999`
- **When** 我不带 `--instance` 执行 `orch approve APR-001 --decision allow`，再执行 `orch approve APR-999 --instance INST-001 --decision allow`
- **Then** 前者提示"审批号 APR-001 在多个实例中存在，请加 --instance"，后者提示"未找到审批 APR-999"；退出码都是 1；实例都不变
- **机检：** 相关实例 `rev` 不变

#### AC-35 取消时待处理审批作废

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-23、BR-37
- **Given** 实例处于等待审批
- **When** 我执行 `orch cancel --instance INST-001`
- **Then** 实例取消；审批行显示已作废；宿主收到取消，不会留下"待处理"
- **机检：** 审批 `withdrawn`；实例 `cancelled`；会话 `idle`

#### AC-36 `status` 显示审批与暂停

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-28、BR-42
- **Given** 实例 A 已暂停；实例 B 有 `hold` 待处理审批且未暂停；实例 C 是 I1.3 的无审批旧实例；实例 D 有三条已处理审批（已通过 / 已拒绝 / 已作废）
- **When** 我分别执行 `orch status --instance INST-A`、`--instance INST-B`、`--instance INST-C`、`--instance INST-D`，再执行不带参数的 `orch status`
- **Then** A 的实例行显示"运行中（已暂停）"；B 在升级块之后出现待处理审批行；C 不出现审批行；D 按审批号逐条显示"已通过 / 已拒绝 / 已作废"；不带参数的列表行中 A 同样带"（已暂停）"、B 带"待处理审批 1"
- **机检：** C 的实例输出与 I1.3 A-2 逐字一致；列表行含 A/B 的限定词

#### AC-37 `run` 等待期间出现审批行

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-42
- **Given** `orch run --approval hold` 正在等待，宿主请求审批
- **When** 审批产生
- **Then** 终端在会话行之后打印审批行，含审批号、节点、角色、动作；不需要退出 `run` 就能看到
- **机检：** `run` 进程 stdout 含 `APR-001`

#### AC-38 `instance status` 与 `status --instance` 同口径

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-30
- **Given** 同一个运行中实例，以及一个不存在的实例号
- **When** 我分别对 `INST-001` 执行 `orch instance status INST-001` 与 `orch status --instance INST-001`；再把实例号换成 `INST-999` 各执行一次
- **Then** `INST-001` 两次输出逐字一致（时间相关行在同一秒内比较）；`INST-999` 两次都输出 `实例 INST-999 · 不存在`
- **机检：** 存在时退出码都是 0；不存在时都是 1；`.orch` 不变

#### AC-39 `instance log` 文本按顺序输出事件

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-32、BR-46
- **Given** 一个完成过回流与升级的实例
- **When** 我执行 `orch instance log INST-001`
- **Then** 事件按发生顺序逐行输出；含拒绝、升级、处理升级等新事件；没有事件时输出"事件 —"
- **机检：** 行序与 `events.jsonl` 的 `seq` 一致

#### AC-40 `instance log --format json` 输出原始事件数组

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-46
- **Given** 同上
- **When** 我执行 `orch instance log INST-001 --format json`
- **Then** stdout 是可解析的 JSON 数组，元素字段与事件日志一致，顺序一致
- **机检：** `JSON.parse` 成功；数组长度等于 `events.jsonl` 可解析行数

#### AC-41 `instance graph --format json` 稳定可回归

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-34
- **Given** 一个已完成的编码闭环实例
- **When** 我执行 `orch instance graph INST-001 --format json`
- **Then** 输出含 `graphVersion`、`instanceId`、`template`、`state`、`paused`、`nodes`、`edges`、`handoffs`、`escalations`、`approvals`、`current`；节点含节点号、标题、角色、状态、轮次；边含来源、目标、方向
- **机检：** 键顺序与附录 A-4 一致；两次执行输出逐字一致

#### AC-42 `instance graph --format text` 可读

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-28、BR-34
- **Given** 一个编码闭环实例
- **When** 我执行 `orch instance graph INST-001`
- **Then** 首行是实例、模板、状态；随后每个节点一行；最后"边："段落逐条列出方向，有升级/审批时在其后追加摘要行；暂停时首行带"（已暂停）"
- **机检：** 输出为纯 ASCII 结构字符（中文字符除外）

#### AC-43 图反映暂停、挂起、审批与升级

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-28、BR-34
- **Given** 实例 A 已暂停且有待审批（`hold`）；实例 B 有升级
- **When** 我分别执行 `orch instance graph INST-A --format json` 与 `orch instance graph INST-B --format json`
- **Then** A 的 `paused === true` 且 `approvals` 含待处理项；B 的 `escalations` 含待处理项且 `paused === false`；`current` 指向各自当前节点或为 `null`
- **机检：** 字段值与 `state.json` 一致

#### AC-44 `attach` 只读跟随

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-33
- **Given** 一个正在执行且有历史、宿主已请求审批（`hold`）的会话；会话号从发起时 `orch run` 输出的 `会话已创建 <会话号>` 行取得，或从 `orch instance log INST-001 --format json` 中 `object === 'session'` 的 `objectId` 取得（形如 `mock-sess-…`，由宿主给出）
- **When** 我执行 `orch attach <该会话号>`，看到最近事件后按 Ctrl-C
- **Then** 首行显示该会话号、实例、节点；若该会话有待审批，紧跟一行审批信息；随后输出该会话最近事件（行数 ≤ 20 且 ≥ 1）；脱离后实例状态、节点轮次、会话状态都不变
- **机检：** 附着前后 `state.json` 的 `state/rev` 与节点、会话状态不变；stdout 含 `APR-` 行

#### AC-45 `attach` 找不到会话

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-30、BR-33
- **Given** 没有 SES-999
- **When** 我执行 `orch attach SES-999`
- **Then** 输出"未找到会话 SES-999"；退出码 1
- **机检：** 没有状态写入

#### AC-46 `handoff list` 跨实例稳定排序

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-43
- **Given** 两个实例各有多张交接包
- **When** 我执行 `orch handoff list`，再执行 `orch handoff list --instance INST-001`
- **Then** 前者先按实例号、再按包号排序，每行含包号、实例、方向、状态、最后时间；后者只出现 INST-001 的交接包；空时输出"交接包 —"
- **机检：** 排序稳定，不随快照数组顺序变化

#### AC-47 `handoff show` 展示完整内容

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-43、BR-46
- **Given** 一张回流交接包，含缺陷与上一版引用
- **When** 我执行 `orch handoff show HO-002 --instance INST-001`
- **Then** 输出实例、方向、状态、各阶段时间、证据、缺陷逐条、修改/复测要求、尝试次数、最后一次错误、信箱路径
- **机检：** 缺陷摘要与证据位置逐字来自交接包；"尝试"行的分母为 3，已尝试次数与 `deliveryAttempts` 一致

#### AC-48 交接包找不到或歧义

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-31
- **Given** 包号 HO-999 不存在；另有两个实例都有一张 HO-001
- **When** 我依次执行 `orch handoff show HO-999 --instance INST-001` 与 `orch handoff show HO-001`（不带 `--instance`）
- **Then** 前者提示"未找到交接包 HO-999"，后者提示"交接包号 HO-001 在多个实例中存在，请加 --instance"；两次退出码都是 1
- **机检：** 没有状态写入

#### AC-49 暂停停在下一次派发边界

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-24、BR-28
- **Given** 编码闭环开发正在执行，测试尚未派发；用既有 `MAESTRO_TEST_PAUSE=after_output:<开发节点>` 接缝（`NODE_ENV=test`）在开发产出后停住（项目根出现 `.mock/paused`）
- **When** 我执行 `orch workflow pause INST-001`，然后放行接缝（`.mock/release`）
- **Then** 实例行变为"运行中（已暂停）"；开发当前回合跑完并落盘 `done`；跑完后没有测试派发；前台 `orch run` 打印已暂停收尾并退出 0；`status` 与 `status.md` 都显示已暂停
- **机检：** 磁盘快照 `paused === true`、`halted === false`；开发节点 `done`；`counters.dispatchCount` 仍为 1；测试 `round === 0`；`handoffs` 中没有指向测试的包（不存在 `created` 孤儿包）；`events.jsonl` 中开发节点之后没有新的 `node.dispatch`；`workspace/status.md` 含 `- 暂停：是`

#### AC-50 恢复后从边界继续

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-25、BR-40
- **Given** 独立项目根，按 AC-49 的步骤重放至"已暂停且开发已完成"（或在 `NODE_ENV=test` 下用 `MAESTRO_TEST_PAUSE` 接缝 + `workflow pause` 构造）
- **When** 我执行 `orch workflow resume INST-001`
- **Then** 实例行恢复"运行中"；核心立即派发测试；测试最终完成
- **机检：** `paused === false`；以 `events.jsonl` 出现指向测试的 `node.dispatch` 为同步点断言；测试 `round` 增加 1；指向测试的交接包恰好 1 张且 `deliveryAttempts === 1`；`workspace/status.md` 含 `- 暂停：否`

#### AC-51 重复暂停 / 恢复幂等

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-26
- **Given** 实例停在开发→测试的派发边界且已暂停（AC-49 状态，独立项目根）；本场景在 `NODE_ENV=test` 下改用不带节点限定的 `MAESTRO_TEST_PAUSE=after_output`，使恢复后的测试回合也停在同一接缝；第一次 `resume` 前与每次放行前都先删除上次留下的 `.mock/release` 与 `.mock/paused`
- **When** 我再执行一次 `pause`，然后执行两次 `resume`（等测试回合的 `.mock/paused` 重新出现后再发第二次 `resume`），再放行测试回合
- **Then** 三次都打印当前实例行；退出码 0；只有第一次 `resume` 产生一次派发，第二次不再派发
- **机检：** `paused` 最终为 `false`；`events.jsonl` 中 `node.dispatch` 共 2 条（开发、测试各一条）；指向测试的交接包恰好 1 张、测试节点会话恰好 1 个；第二次 `resume` 前后 `dispatchCount` 与测试节点 `round` 都不变

#### AC-52 终止等同取消

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-27
- **Given** 一个运行中实例
- **When** 我执行 `orch workflow abort INST-001`
- **Then** 输出与 `orch cancel --instance INST-001` 相同的结果行；实例取消
- **机检：** 实例 `cancelled`；节点、会话、交接包、升级按取消规则收尾

#### AC-53 非运行实例不能暂停或恢复

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-24
- **Given** 实例已完成、已挂起或已停止推进
- **When** 我执行 `pause` 或 `resume`
- **Then** 提示当前状态与不能执行的原因；退出码 1；状态不变
- **机检：** `rev` 不变

#### AC-54 旧命令基线不回归

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-29
- **Given** 全新项目根
- **When** 我重跑 I1.1 的单节点、I1.2 的编码闭环、I1.3 的文档闭环（task-loop）成功路径，以及 I1.1 的 `status` 列表、`cancel`、`core stop`；其中单节点一次不带 `--template`、一次显式带 `--template single`
- **Then** 除"挂起后的下一步"按 M-11 更新外，其余输出、顺序、退出码与 I1.3 基线逐字一致；显式 `--template single` 与不带该参数的输出逐字相同（实例行不带"· 模板 …"后缀）
- **机检：** 旧夹具全部通过；`status` 无审批/暂停时不出现新行；两次单节点运行的首行与节点表 diff 为空

#### AC-55 旧格式实例只读可查

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-38
- **Given** 一个 I1.1 的 v1 单对象实例
- **When** 我执行 `orch status --instance`、`orch instance status`、`orch instance log`、`orch instance graph`
- **Then** 都能读出旧字段，按单节点显示；不写 `state.json`；不因缺新字段报错
- **机检：** `rev` 不变；`graph` 的 `template` 为 `single`

#### AC-56 架构纯净与零依赖

- 场景类型：架构检查 ｜ 风险：P0 ｜ 引用：BR-35、BR-36
- **Given** 当前源码
- **When** 我执行 `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator`
- **Then** 退出码 0、扫描文件数 > 0、零命中；`package.json.dependencies` 不存在或为空对象
- **架构检查：** 上述命令（禁词取 I1.2 四词与 I1.3 七词的并集，不依赖脚本默认的 I1.2 四词表）+ 依赖读取；另有 `status.md` 状态词与 `labels.js` 的逐词对照断言（`test/wp2/labels.test.js`）；三个模板的交接包构造与校验都只经 `src/core/handoff-schema.js`（源码 import 检查，不允许模板内联校验）

#### AC-57 新动作都有审计事件

- 场景类型：机检 ｜ 风险：P1 ｜ 引用：BR-41、BR-46
- **Given** 一次包含校验失败、投递重试、审批、暂停、升级处理、恢复的完整流程
- **When** 我执行 `orch instance log INST-001 --format json`
- **Then** 能分别找到交接包拒绝、投递等待/过期、审批创建/处理、暂停/恢复、升级创建/处理的事件与原因
- **机检：** 事件 `reason` 覆盖本流程涉及的 `handoff.inboxed`、`handoff.pending`、`handoff.expired`、`handoff.rejected`、`escalation.created`、`escalation.resolved`、`approval.created`、`permission.allowed`、`permission.denied`、`workflow.paused`、`workflow.resumed`；`approval.withdrawn` 与 `workspace.status_write_failed` 分别由 AC-35、AC-59 覆盖，不在本 AC 断言

#### AC-58 查看类命令严格只读

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-45
- **Given** 任意运行中实例，且核心已由前一条命令拉起并完成启动对账
- **When** 我执行 `status`、`instance status/log/graph`、`handoff list/show`、`escalate list`
- **Then** 实例 `state.json`、节点、会话、交接包、升级、审批都不变（`attach` 的只读性由 AC-44 用等待审批的稳定会话覆盖）
- **机检：** 命令前后 `rev` 不变

#### AC-59 `status.md` 刷新失败不回滚状态

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-03、BR-04
- **Given** 夹具用 `MAESTRO_FAULT=workspace_status_write:fail` 让 `status.md` 写入失败
- **When** 实例发生一次节点状态变化
- **Then** 实例继续推进；`status` 仍显示新状态；`instance log` 能看到一次"工作区状态写入失败"，已落盘状态不回滚
- **机检：** `state.json` 的节点状态已更新；`events.jsonl` 含 `workspace.status_write_failed`；后续状态变化仍会尝试刷新

#### AC-60 取消覆盖暂停与待审批

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-37
- **Given** 一个已暂停、且在暂停时已进入的回合里出现 `hold` 待处理审批的实例
- **When** 我执行 `orch cancel --instance INST-001`
- **Then** 实例取消；暂停标记清除；审批行显示已作废；不会留下"待处理"
- **机检：** 实例 `cancelled`、`paused === false`；审批 `withdrawn`；会话 `idle`

#### AC-61 取消时待投递交接包不再重试

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-37、C-14
- **Given** 宿主对首次 `prompt` 返回失败（mock 步字段 `promptFailures: 1`），并用 `NODE_ENV=test` 的 `test.delivery` 接缝（`hold`）让交接包停在"待投递 · 重试 1/2"的重试等待点
- **When** 我执行 `orch cancel --instance INST-001`，随后 `test.delivery release`
- **Then** 实例取消；该交接包显示"已拒绝（已撤回）"；释放后也不再发起重试；信箱文件保留可查
- **机检：** 实例 `cancelled`；包 `state === 'rejected'`、`rejectReason === 'withdrawn'`；`release` 后场景根 `.mock/prompt-attempts-<sessionId>.json` 的 `attempts` 不再增加（不以 `prompts/<n>.json` 是否被覆盖判定）；`.orch/inbox/INST-001/<包号>.json` 仍存在；`deliveryAttempts` 不再增加

#### AC-62 多节点审批拒绝走既有执行失败路径

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-22
- **Given** 用 `--template code-loop --approval hold` 发起，开发节点等待审批
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision deny`
- **Then** 输出"审批 APR-001 已拒绝 · 动作 write"；沿 I1.2 / I1.3 的 `refusal` 路径收尾：节点升级、实例挂起，不出现第二套失败文案
- **机检：** 审批 `denied`；来源节点 `escalated`；实例 `suspended`；`escalations[0].reasonCode === 'execution_failed'`；不出现 `failed` 实例行

#### AC-63 单节点投递失败不进入信箱重试

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-13、BR-44
- **Given** 用 `--template single` 发起，mock 以既有 `--host-error` 开关对所有 `prompt` 返回失败（单节点没有重试）
- **When** 核心投递引导包 `HO-001`
- **Then** 不出现"待投递"、不重试；实例按 I1.2 的失败口径收尾
- **机检：** `<任务 cwd>/.mock/prompt-attempts-<sessionId>.json` 的 `attempts === 1`（非场景模式基准见 D-10）；`events.jsonl` 没有 `handoff.pending`；`.orch/inbox/INST-001/HO-001.json` 不存在；实例 `failed`、节点 `failed`、会话 `idle`；`nodes[0].failure.code === 'HOST_ERROR'`（CLI 退出 1）

#### AC-64 非法参数按用法错误退出

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-30
- **Given** 我分别执行 `orch run --cwd ./demo --task "…" --approval maybe`、`orch instance graph INST-001 --format yaml`、`orch escalate resolve ESC-001 --decision maybe`、`orch approve APR-001 --decision maybe`
- **When** 参数解析完成
- **Then** 分别提示 `--approval` 只允许 `allow|reject|hold`、`--format` 只允许 `text|json`、`escalate resolve` 的 `--decision` 只允许 `pass|fail|retry`、`approve` 的 `--decision` 只允许 `allow|deny`；四条退出码均为 2；不创建实例、不写任何实例状态
- **机检：** `.orch/instances` 下没有新实例目录；已有实例 `rev` 不变；stdout/stderr 含允许值说明

#### AC-65 下游会话创建失败不留未投递包

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-13、BR-29
- **Given** I1.2 的编码闭环 `dispatch-fail-retest` 夹具（复测节点 `sessionNew` 失败），此前的开发与测试轮次已完成
- **When** 核心投递复测交接包
- **Then** 实例挂起并显示升级；不出现"待投递"与重试；该交接包以"已拒绝（投递失败）"收尾，不留"已构造"的孤儿包
- **机检：** 本轮复测包（最后一指向测试节点的包）`state === 'rejected'`、`rejectReason === 'delivery_failed'`；`handoffs` 中没有该节点本轮的 `created` 包；`escalations[0].reasonCode === 'dispatch_failed'`；没有 `handoff.pending`

#### AC-66 暂停落在交接包已构造、尚未派发之间

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-14、BR-24、BR-25
- **Given** 用 `NODE_ENV=test` 下的 `MAESTRO_TEST_PAUSE=after_verdict` 让编码闭环在回流包已落盘、派发尚未提交时停住（项目根出现 `.mock/paused`）
- **When** 我执行 `orch workflow pause INST-001`，放行接缝（`.mock/release`），等前台 `orch run` 以暂停收尾（退出 0）后再执行 `orch workflow resume INST-001`
- **Then** 暂停期间该包显示"已构造"；恢复后核心用**同一张包**派发一次，不产生第二张包，也不重复计数
- **机检：** 暂停落定后指向该节点的 `created` 包恰好 1 张、目标节点 `round` 未增加、`dispatchCount` 未增加、没有**新增**的 `node.dispatch`（此前的开发/测试派发仍在）；恢复后该 `handoffId` 变为 `delivered`/`consumed`、`deliveryAttempts === 1`、`dispatchCount` 恰好 +1，指向该节点的包仍只有 1 张，`node.dispatch` **新增**恰好 1 条

#### AC-67 核心重启后审批已失效

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-23、BR-45
- **Given** 用 `--template single --approval hold` 发起，宿主请求 `write` 动作，实例等待审批；随后执行 `orch core stop`，再由下一条命令自动拉起新核心
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision allow`
- **Then** 提示"审批 APR-001 已失效：会话不在运行"；退出码 1；审批仍为待处理，不假装已放行
- **机检：** 审批 `state === 'pending'`；`events.jsonl` 没有 `permission.allowed`；实例 `rev` 在命令前后不变

#### AC-68 合法回流包通过校验并投递

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-05、BR-06、BR-07、BR-08
- **Given** 文档闭环第 1 轮：撰写者已产出 `artifacts/docs/release-notes.v1.md`，审核者驳回并给出 2 条缺陷（摘要与证据位置均非空）与修改要求
- **When** 核心推进回流到撰写者（第 2 轮）
- **Then** 回流包从"已构造"变为"已投递"（随后"已接受"）；撰写者收到第 2 轮提示；终端不出现"已拒绝（内容不合规）"或升级
- **机检：** 该包 `edge.kind === 'backflow'`、`defects.length === 2`、`revisionRequirement` 非空、`artifactRefs.previous.ref` 非空且文件存在；`events.jsonl` 无 `handoff.rejected`；撰写者 `round === 2`

#### AC-69 合法复测包通过校验并投递

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-05、BR-06、BR-07
- **Given** 编码闭环第 1 轮测试判定不通过；开发按缺陷修复后 `calc.js` 存在且非空
- **When** 核心构造复测包并派发测试第 2 轮
- **Then** 复测包投递；测试收到第 2 轮提示；终端不出现拒绝或升级
- **机检：** 该包 `edge.kind === 'retest'`、`artifactRefs.input` 含 `calc.js` 且文件存在；`events.jsonl` 无 `handoff.rejected`；测试 `round === 2`

#### AC-70 编号唯一时 `handoff show` 可省略 `--instance`

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-31
- **Given** 只有一个实例有 HO-002，另一个实例没有该包号
- **When** 我执行 `orch handoff show HO-002`
- **Then** 正常输出该包详情；退出码 0；不需要 `--instance`
- **机检：** 输出含 `交接包 HO-002`；命令前后 `rev` 不变

### 3.2 非功能验收标准

| # | 场景 | 目标 |
|---|---|---|
| NFR-01 | 本机执行任一新命令（100 个事件、50 张交接包以内） | 2 秒内看到首行输出 |
| NFR-02 | 暂停、审批、待投递重试次数变化 | `status` 在 1 秒内反映 |
| NFR-03 | 3 次投递尝试全部失败 | 2 秒内看到升级，不让用户以为还在跑 |
| NFR-04 | `workflow pause/resume` | 1 秒内返回；`abort` 沿用取消的 5 秒收敛 |
| NFR-05 | `status.md` 与信箱写入 | 原子替换，进程被强杀也不留下半截 JSON/Markdown |
| NFR-06 | 回归 | I1.1 ~ I1.3 既有测试除 M-12 与附录 D-10 列出的授权断言外全部通过 |
| NFR-07 | 依赖 | 不新增运行时依赖，安装后无需联网即可运行 |

### 3.3 验收前置条件

1. Node.js 24 与本仓库依赖已安装；`npm link` 后 `orch` 可用（或在仓库根用 `node bin/orch.js`）。
2. 每个 AC 使用全新临时项目根；开始前不存在 `.orch`，避免旧实例干扰。
3. 需要真实宿主的 AC 使用仓库内 mock ACP agent；需要 hold 的 AC 用 `--approval hold` 或宿主配置 `permissionPolicy=hold`，并让 mock 以 `--permission=ask` 启动（默认 `auto` 不会发审批请求）。
4. 需要投递失败的 AC 使用扩展后的 mock 步字段（首次/前两次 `prompt` 失败）或既有 `--host-error` 开关；mock 的尝试计数文件用于断言实际尝试次数，不修改生产代码开关。
5. 需要交接包校验失败、中间节点 `rounds_exceeded`、或待投递中取消的 AC 使用 `NODE_ENV=test` 下注册的接缝：`test.handoff`（构造坏包）、`test.escalate`（可选 `reasonCode` 与 `artifactRefs`）、`test.delivery`（`hold`/`release`）；生产进程没有这些 RPC。
6. 需要工作区/信箱/状态页故障的 AC 使用 `MAESTRO_FAULT` 注入：`workspace_init:fail` 沿用既有行为；新增值 `inbox_write:fail`、`workspace_status_write:fail` 只在 `NODE_ENV=test` 下生效（与 `test.*` 接缝同一门控），生产进程不会因环境变量误触发。
7. 需要并发/暂停/重试边界的 AC 使用 `hold`、慢回合或 `test.delivery` 接缝，确保能稳定停在"开发完成、测试未派发"或"待投递未重试"。
8. 需要旧实例的 AC 使用 I1.1 夹具生成的 v1 快照。
9. 所有机检以实例根 `.orch/instances/<id>/` 与项目根 `.orch/inbox/**` 为准；mock 夹具路径按 D-10 的基准（场景根或任务 cwd）；时间断言允许同一秒内比较。
10. Windows 下用 Git Bash 或 PowerShell 等价命令；本文命令以 POSIX shell 书写。
11. C-13 的并发写冲突（`STORE_CONFLICT`）与 D-7 的暂停/派发原子性作为实现约束，由实现侧单测覆盖，本轮不设独立用户 AC；A-5 的提示文案随实现落地。

---

## 附录 A 输出基线（**唯一**，AC-01 ~ AC-07、AC-14 ~ AC-70 中涉及文件与命令输出的判定依据）

> 既有基线（I1.1 §3 的输出要求、I1.2 A-1~A-4、I1.3 A-1~A-4）继续有效。本附录只登记**新增或变更**的输出；未登记的输出不得改动。

### A-1 工作区布局与 `status.md`

```
.orch/instances/INST-001/workspace/
├── shared/                     # 公共区：所有人可读
├── stage/
│   ├── T-001/                  # 开发自己的阶段区
│   └── T-002/                  # 测试自己的阶段区
├── status.md                   # 核心维护的人类可读交接棒
└── artifacts/
    ├── docs/      # 仅文档闭环预建
    └── reports/   # 仅文档闭环预建
```

`single` 实例没有 `stage/`；`code-loop` / `task-loop` 每个节点一个 `stage/<nodeId>/`。`artifacts/{docs,reports}` 仅文档闭环（`productPolicy='doc-single'`）预建；编码闭环与单节点按产物需要创建，不保证启动后存在。

`status.md`（编码闭环运行中样例；时间与任务随实例变化）：

```markdown
# INST-001 编码闭环

- 状态：运行中
- 暂停：否
- 任务：实现 calc.js，产物：calc.js
- 当前节点：T-002 测试
- 更新：2026-11-06T10:30:05.000Z
- 工作区：/abs/path/.orch/instances/INST-001/workspace

## 节点

- T-001 开发：已完成 · 第 1 轮
- T-002 测试：执行中 · 第 1 轮

## 交接包

- HO-001 开发→测试：已接受 · 输入 calc.js

## 升级

- 无

## 审批

- 无
```

有升级/审批时：

```markdown
## 升级

- ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮 · 回流超上限：测试已派发 2 次仍未通过

## 审批

- APR-001 待处理 · 节点 T-001 开发 · 动作 write
```

暂停时 `- 暂停：是`。`status.md` 永远以原子替换写入，不追加。

`single` 实例的 `status.md` 同结构，但省略 `## 节点` 段与"当前节点"行（单节点没有可区分的节点标题）；`## 交接包` 只有引导包 HO-001；`## 升级` / `## 审批` 仍保留。

### A-2 `run` / `status` 的新增行

1. 实例暂停时，实例行把状态替换为 `运行中（已暂停）`：

```
实例 INST-001 · 运行中（已暂停） · 模板 编码闭环
```

`single` 仍是：

```
实例 INST-001 · 运行中（已暂停）
```

列表行同口径，把状态词替换为 `运行中（已暂停）`：

```
实例 INST-001 · 运行中（已暂停） · 模板 编码闭环 · 待处理审批 1 · 节点 执行中 · 会话 执行中 · 耗时 3m · 更新 10:30:05
```

2. 审批行（`status --instance`、`instance status`、`orch run` 共用；`status` / `instance status` 按审批号逐条列出全部状态，`run` 只推送新产生的待处理行）：

```
审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write
审批 APR-002 已通过 · 节点 T-001 开发 · 动作 write
审批 APR-003 已作废 · 节点 T-001 开发 · 动作 write
```

`single` 实例没有节点与角色，同一行省去"节点 …"段：

```
审批 APR-001 已通过 · 动作 write
```

3. 待投递重试行（交接包逐包行追加限定词）：

```
交接包 HO-002  开发→测试  待投递 · 重试 2/2   10:30:02
```

4. 挂起后的下一步（替换 I1.3 的 `NEXT_STEP_SUSPENDED` 与 `ESCALATION_BLOCK.next`）：

```
  下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-001 --instance INST-001 --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance INST-001
```

`halted` 的下一步不变（仍只能取消）。

5. `status` 列表行的待审批计数：仅当 `pendingApprovals > 0` 时追加：

```
实例 INST-001 · 运行中 · 模板 编码闭环 · 待处理升级 1 · 待处理审批 1 · 节点 执行中 · 会话 等待审批 · 耗时 3m · 更新 10:30:05
```

6. 前台 `orch run` 遇暂停的收尾（D-7.9）：只打印实例行与下面一行，退出码 0；不打印节点表、交接包行与升级块：

```
实例 INST-001 · 运行中（已暂停） · 模板 编码闭环
  下一步：恢复推进 orch workflow resume INST-001
```

### A-3 新命令输出

**`orch instance status INST-001`**：与 `orch status --instance INST-001` 逐字一致。

**`orch instance log INST-001`**：

- 每行沿用 `status --events` 的事件行格式（`code-loop` / `task-loop` 带 `[#n]`，`single` 不带）。
- 没有事件时只输出：

```
事件 —
```

**`orch instance log INST-001 --format json`**：输出事件对象的 JSON 数组（稳定顺序、缩进 2 空格）。

**`orch instance graph INST-001`（text）**：

```
实例 INST-001 · 编码闭环 · 已完成
T-001 开发 · 已完成 · 第 1 轮
T-002 测试 · 已完成 · 第 1 轮
边：
  T-001 -> T-002 正向
  T-002 -> T-001 回流
  T-001 -> T-002 复测
```

暂停时首行：

```
实例 INST-001 · 编码闭环 · 运行中（已暂停）
```

有升级/审批时，在"边："之后追加：

```
升级：ESC-001 T-002 待处理
审批：APR-001 T-001 待处理
```

没有边时输出 `边：` 下一行 `  无`。`single` 实例同结构：`template` 为 `single`、首行模板名为 `单节点`、无节点边，其余键顺序不变。

**`orch escalate list`**：

```
升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过
```

已处理且带 `--all` 时状态列：

```
升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过
```

空态：

```
升级 —
```

**`orch escalate resolve`**：

```
升级 ESC-001 已处理（通过）
实例 INST-001 · 已完成 · 模板 编码闭环
```

`fail` 第二行为实例失败行；`retry` 第二行为实例运行行。第二行的实例行与 `status --instance` 同口径（`single` 不带模板，多节点带"· 模板 <名>"）。若处理导致再次升级，第二行为挂起收尾（实例行 + 升级摘要 + 下一步）。

**`orch approve`**：

```
审批 APR-001 已通过 · 动作 write
```

或：

```
审批 APR-001 已拒绝 · 动作 write
```

**`orch handoff list`**：

```
交接包 HO-001  实例 INST-001  开发→测试  已完成  10:30:05
交接包 HO-002  实例 INST-001  测试→开发（回流）  已拒绝（内容不合规）  10:30:06
```

空态：

```
交接包 —
```

"最后时间"取 `expiredAt / pendingAt / consumedAt / rejectedAt / acceptedAt / deliveredAt / createdAt` 中最近的非空时间；状态列使用与终端其他位置相同的中文与拒绝原因。

**`orch handoff show HO-002 --instance INST-001`**：

```
交接包 HO-002
  实例：INST-001
  方向：测试→开发（回流）
  状态：已拒绝（内容不合规）
  构造：10:30:02  待投递：—  投递：—  接受：—  完成：—  拒绝：10:30:06  过期：—
  证据：out/verdict.json
  缺陷：除零边界缺失（证据 out/missing-log.txt）
  修改要求：请补除零分支
  复测要求：—
  尝试：0/3
  最后错误：—
  信箱：—
```

信箱文件存在时显示相对项目根的路径（如 `.orch/inbox/INST-001/HO-002.json`）；校验失败而未写信箱时打印 `—`，不显示一个不存在的路径。无对应项一律打印 `—`，不省略行。

**`orch attach <会话号>`**（下例的 `SES-001` 为示例，实际编号由宿主给出）：

```
已附着会话 SES-001（实例 INST-001 · 节点 T-001 开发）
审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write
10:30:05  会话 SES-001  执行中 → 执行中（tool_call）  原因 状态变化
...
已脱离会话 SES-001
```

没有事件时只有首尾两行。事件行沿用 `instance log` 的格式；`...` 表示持续跟随，实际行数取决于事件数。

**`orch workflow pause INST-001`**：

```
实例 INST-001 · 运行中（已暂停） · 模板 编码闭环
```

**`orch workflow resume INST-001`**：

```
实例 INST-001 · 运行中 · 模板 编码闭环
```

**`orch workflow abort INST-001`**：与 `orch cancel --instance INST-001` 输出一致。

### A-4 `instance graph --format json` 基线

编码闭环已完成样例（键顺序固定）：

```json
{
  "graphVersion": 1,
  "instanceId": "INST-001",
  "template": "code-loop",
  "state": "completed",
  "paused": false,
  "nodes": [
    {
      "nodeId": "T-001",
      "title": "开发",
      "roleId": "developer",
      "state": "done",
      "round": 1
    },
    {
      "nodeId": "T-002",
      "title": "测试",
      "roleId": "tester",
      "state": "done",
      "round": 1
    }
  ],
  "edges": [
    { "from": "T-001", "to": "T-002", "kind": "forward" },
    { "from": "T-002", "to": "T-001", "kind": "backflow" },
    { "from": "T-001", "to": "T-002", "kind": "retest" }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "from": "T-001",
      "to": "T-002",
      "kind": "forward",
      "state": "consumed",
      "round": 1
    }
  ],
  "escalations": [],
  "approvals": [],
  "current": null
}
```

- 运行中时 `current` 为 `{"nodeId":"T-002","sessionId":"SES-…","state":"running"}`；无活动节点为 `null`。
- `handoffs` 按包号升序；`escalations` 按编号升序；`approvals` 按编号升序。
- `nodes` 按图声明顺序。
- `template` 是英文模板名；节点 `title` 保留图中的中文标题，`roleId` 保留英文标识。
- `escalations` / `approvals` 元素是实例快照中对应条目的原样投影（字段与 `state.json` 一致，不含渲染用中文）；非空逐字基线取 A-3 的升级块与审批行同一字段值，AC-42 据此比较。

### A-5 新增错误与退出码

| 场景 | 错误码 | 输出 | 退出码 |
|---|---|---|---|
| 会话不存在 | `SESSION_NOT_FOUND` | `未找到会话 {id}` | 1 |
| 升级不存在 | `ESCALATION_NOT_FOUND` | `未找到升级 {id}` | 1 |
| 升级已处理 | `ESCALATION_NOT_PENDING` | `升级 {id} 已处理（{state}），无需再次处理` | 1 |
| 升级决策不允许 | `ESCALATION_DECISION_INVALID` | `升级 {id} 不支持「{decision}」；可选：{allowed}` | 1 |
| 升级号歧义 | `ESCALATION_AMBIGUOUS` | `升级号 {id} 在多个实例中存在，请加 --instance` | 1 |
| 实例非挂起 | `INSTANCE_NOT_SUSPENDED` | `实例 {id} 当前不是挂起状态，不能处理升级` | 1 |
| 审批不存在 | `APPROVAL_NOT_FOUND` | `未找到审批 {id}` | 1 |
| 审批已处理 | `APPROVAL_NOT_PENDING` | `审批 {id} 已处理（{state}），无需再次处理` | 1 |
| 审批号歧义 | `APPROVAL_AMBIGUOUS` | `审批号 {id} 在多个实例中存在，请加 --instance` | 1 |
| 审批会话已失效 | `APPROVAL_SESSION_GONE` | `审批 {id} 已失效：会话不在运行` | 1 |
| 交接包不存在 | `HANDOFF_NOT_FOUND` | `未找到交接包 {id}` | 1 |
| 交接包号歧义 | `HANDOFF_AMBIGUOUS` | `交接包号 {id} 在多个实例中存在，请加 --instance` | 1 |
| 实例当前状态不能暂停 | `INSTANCE_NOT_PAUSABLE` | `实例 {id} 当前为{state}，不能暂停` | 1 |
| 实例当前状态不能恢复 | `INSTANCE_NOT_RESUMABLE` | `实例 {id} 当前为{state}，不能恢复` | 1 |
| 非法 `--format` / `--decision` / `--approval` / 缺参数 | `USAGE_ERROR` | 用法错误 + 正确用法 | 2 |
| 写入冲突（`STORE_CONFLICT`） | `STORE_CONFLICT` | `操作冲突，请重试` | 1 |
| 工作区初始化失败 | `WORKSPACE_INIT_FAILED` | `无法创建工作区：{cause}` | 3 |
| 实例挂起收尾 | 实例行 + 升级摘要 + 下一步 | 4 |
| 停止推进收尾 | `无法记录升级：{cause}；已停止推进` + 实例行 + 节点行 + 下一步 | 5 |

**成功路径退出码**：`escalate resolve` 成功 0（若处理后立即再次挂起则为 4）；`approve` 处理 allow 或 deny 均 0；`pause` / `resume` 成功或幂等 0；`workflow abort` 成功 0（等同 `cancel`）；查看类命令（`instance status/log/graph`、`attach` 正常脱离、`handoff list/show`、`escalate list`）0。

### A-6 多节点提示词的「工作区上下文」段

所有多节点派发（`code-loop` 的入口 / forward / backflow / retest，`task-loop` 的 research / write / review；含图入口的无包派发）在模板正文之后空一行追加：

```
工作区：<workspaceAbs>
共享区（只读）：<workspaceAbs>/shared
本节点阶段区：<workspaceAbs>/stage/<本节点号>
上游阶段区（只读）：<workspaceAbs>/stage/<上游节点号>
```

- 入口节点（无上游交接包）只追加前三行。
- `single` 不追加。
- **追加条件**：`promptFor` 调用同时带 `graph` 且 `graph.nodes.length > 1`；只传 `node` 的单元调用不追加，保持既有整串断言不变。
- **生产路径必须带 `graph`**：所有派发入口（`advance` 的"新构造包"与"复用既有包"两条、`test.dispatch` 的复用包路径、恢复/重新分配时按落盘包重建提示词）一律传 `graph`，包括 `single`；`single` 的图只有一个节点，因此按**节点数**判定即可，不得在核心再写 `template !== 'single'` 之类的模板名分支（模板名字面量只能在 `src/templates/**`，见 D-1、D-11）。
- 若模板正文已含 `工作区：` 行（`task-loop` 审核模板），不再重复追加该行，只追加后三行。
- `PROMPT_TEMPLATES` 常量保持不变；该段由 `promptFor` 在填充后拼接，不进入模板表。
- 上游节点取本次派发所沿边的来源节点（forward / backflow / retest 一致）。

---

## 附录 B 术语与未决问题

### B.1 术语

| 术语 | 含义 |
|---|---|
| 共享工作区 | `.orch/instances/<id>/workspace`，含 `shared/`、`stage/`、`status.md` 与 `artifacts/` |
| `status.md` | 核心生成的单页交接棒；人工可读，人工修改会被覆盖 |
| 证据引用 | 交接包里指向已存在产物的路径；本迭代校验 `artifactRefs.input[]`、`artifactRefs.previous.ref` 与回流包的 `defects[].evidence` |
| 信箱 | `.orch/inbox/<instanceId>/<handoffId>.json`，唤醒消息的持久化副本 |
| 待投递 | 消息已落盘、正在重试；不是"已投递"，也不是"已过期" |
| 重新分配 | 升级裁决的一种：新建会话、轮次 +1、只重跑该节点 |
| 审批 | 宿主请求的单个工具动作；编号 `APR-nnn`，不是升级 |
| 审批策略 `--approval allow\|reject\|hold` | **发起时**的策略：放行 / 一律拒绝（不产生待处理项）/ 挂起等人工 |
| 审批裁决 `--decision allow\|deny` | **对一条待处理审批**的单次决定；`deny` 与策略里的 `reject` 不是同一个开关 |
| 附着 | 只读跟随会话事件；不是向会话注入输入 |
| 暂停 | 阻止下一次派发；不打断当前回合 |

### B.2 未决问题与假设

| 编号 | 内容 | 状态 |
|---|---|---|
| B-01 | `stage/<nodeId>/` 的可见域是"本节点写、下游读"；与 `docs/index.md` §5.4「上游可写」同义（上游写自己的 stage，下游读它）。如果后续工作流要求"上游写下游目录"，在 I1.6 重新定义 | 假设 |
| B-02 | `shared/` 由核心/人工写入，Agent 只读；核心本轮不主动写业务文件，只建目录 | 假设 |
| B-03 | 交接包校验在"投递那一刻"成立，不保证投递后文件不变；产物锁定在 I1.7 | 已定 |
| B-04 | 重试只覆盖图驱动交接包（`edge !== null`）的 `adapter.prompt` 失败且尚未收到 turn 内事件；单节点/图入口不重试；已收事件后的失败沿用旧路径 | 已定 |
| B-05 | `retry` 允许所有升级原因；`pass` 只允许"轮次超限"；`fail` 允许所有原因 | 已定 |
| B-06 | 处理升级要求实例处于挂起且未停止推进；升级/取消时 `paused` 已清零，因此挂起实例不会处于暂停态 | 已定 |
| B-07 | `abort` 等同 `cancel`，不新增独立终止语义 | 已定 |
| B-08 | 审批拒绝沿用既有权限失败路径，不新造第二套失败文案 | 已定 |
| B-09 | `attach` 只读；交互式输入留给 I1.8 | 已定 |
| B-10 | `instance graph` 只画节点级；角色实例图留给 I1.5 | 已定 |
| B-11 | `workflow` 在 I1.4 只控制实例；工作流定义命令留给 I1.6 | 已定 |
| B-12 | 跨实例编号歧义一律要求 `--instance`，不自动选择"最近"或"唯一活跃" | 已定 |
| B-13 | `status.md` 中的模板/角色显示来自图数据与核心文案表，不引入 CLI 依赖 | 已定 |
| B-14 | 旧挂起实例的"下一步"文案会变化；这是 M-11 的授权变更 | 已定 |

---

## 附录 C 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-11-06 | 初稿：按 `docs/index.md` I1.4 规划建立共享工作区、交接包校验、持久化信箱、CLI 命令集、升级裁决、审批、暂停/恢复/终止七块；新增 M-1 ~ M-12、C-01 ~ C-14、BR-01 ~ BR-46、AC-01 ~ AC-60；附录 A 给出工作区、新命令与 graph JSON 基线 |
| v2 | 2026-11-06 | 一次评审修复：重试口径统一为"首次 + 2 次重试（共 3 次尝试）"，显示 `重试 N/2`；多节点审批拒绝明确走既有 `refusal` 升级路径（新增 AC-62）；AC-15 改用 `handoff.inboxed` 事件顺序判定；AC-60 拆分为暂停+待审批与待投递中取消两条（新增 AC-61）；补充 `test.handoff` 的 `edgeKind/snapshot`、故障值 `NODE_ENV=test` 门控、状态机排他断言与 fake-graph 键集合的授权修改 |
| v3 | 2026-11-06 | 二次评审修复：M-4 补 `pending → rejected`；AC-24 用 `test.escalate(reasonCode='rounds_exceeded')` 构造中间节点；AC-61 改用 `test.delivery` 确定性等待点，并在 D-4 增加每次重试前的取消检查；D-10 增列挂起下一步 5 处文案断言授权；登记 R-7（`created → pending` 与规划图示差异）；补充 A-1 artifacts 预建范围、A-4 非空元素投影、D-9 `handoffToState` 白名单；AC-12 补 `edgeKind`，AC-29 补暂停拒绝，AC-36 补旧实例 C |
| v4 | 2026-11-06 | 三轮评审修复：删除不可达的"挂起实例已暂停→先恢复"分支（D-6.2、BR-20、AC-29、A-5、§2.9/§2.12、B-06）；D-6.4 改为 `endedAt` 置裁决时刻以保证 `advance` 能选中节点；D-5 改为现有嵌套 `permission.respond` 参数形状；证据集合扩展为 `input` ∪ `previous.ref` ∪ 回流缺陷证据，D-3/C-05/C-06/BR-06 同步，修复文档闭环首轮回流无证据的误拒；AC-12 改为 backflow `round=2`；AC-43 拆分暂停与升级两个实例；A-2 列表行改为暂停+待审批；补 attach 审批行、AC-44 证据、BR-44/AC-59 映射、call-seam `--reason-code` |
| v5 | 2026-11-06 | 四轮评审修复：C-07/D-3.5 补回流缺陷证据的行号后缀剥离与来源基准；D-2 补 `created → delivered`，D-4.5 定义 delivered 在 `adapter.prompt` 调用后立即置位（不等回合 resolve）；AC-13 的"修改/复测皆空"改用 `empty-requirements` 接缝并登记 D-10；D-6.4 增加被裁决节点会话回 idle；D-6.9/D-7.3 明确裁决与恢复后的推进驱动；A-1 样例补当前节点；AC-43 命令形态修正 |
| v6 | 2026-11-06 | 五轮评审修复：投递失败的 `pending` 起点改为 `delivered → pending`（与规划图示一致，删除不可达的 `created → pending` 与 R-7 登记），M-4/C-10/D-2/D-4 同步；信箱与重试明确只作用于 `edge !== null` 的图驱动交接包，单节点与图入口不写信箱、不重试（M-5/C-04/C-09/§2.4/BR-13/BR-44/B-04 同步），新增 AC-63 锁定单节点 `HOST_ERROR` 回归 |
| v7 | 2026-11-06 | 六轮评审修复：AC-24 通过 `test.escalate` 注入 `artifactRefs` 并由真实证据构造合规包；D-4 明确重试在投递层完成、早于任何节点/会话迁移；D-2 补齐 tracker 的 `created → rejected`、`pending/expired` 方法与 snapshot 字段；AC-63 改用 mock 尝试计数文件；补 `expiredAt` 投影与最后时间、列表行暂停/审批断言、重试与待审批文案词条、C-07 模板无关基准、BR-19/AC-28 的投递耗尽、§1.3.1 兼容类映射 |
| v8 | 2026-11-06 | 七轮评审修复：改正 D-2 测试说明的自相矛盾；`handoff show` 补尝试次数/最后错误并同步 AC-47/A-3；D-2 点名 `state-machine.js` 的 `TABLES.handoff` 新边；D-4.9 明确耗尽时先升级再落定 promise；AC-15/17 补信箱字段机检；新增 AC-64 覆盖非法 `--approval` 退出 2；A-1 示例路径统一为 `calc.js` |
| v9 | 2026-11-06 | 八轮评审（无阻塞）后的非阻塞收口：D-10 明确 mock 非场景模式的 `.mock` 基准；A-5 补 `STORE_CONFLICT`；D-2 定义 `handoff.pending` 事件 detail；D-8 的 `attach` 数据源补 `approval.list`；A-3 补 `pendingAt` 与"待投递"时间行；AC-64 扩展到非法 `--format`/`--decision`；AC-20 改称"本迭代新增故障值" |
| v10 | 2026-11-06 | 九轮评审修复：D-10 改正非场景模式 `.mock` 基准为任务 `--cwd` 解析目录（宿主 spawn cwd，不是项目根），并要求尝试计数早于 `--host-error` 早返回；AC-63 机检路径按任务 cwd 定位；AC-20 改用"占位 `task` 仍为 `null` + 无 `prompt-attempts` 文件"替代空泛的"无新增记录"；非阻塞收口：§2.11 `show` 补"待投递"、D-8 `approval.list` 按会话过滤、A-5 补非法 `--approval`、M-1 明确 `artifacts/{docs,reports}` 仍仅文档闭环预建 |
| v11 | 2026-11-06 | 十轮评审修复：D-7.4 暂停门控改为单一提交点（落包 CAS 前检查；暂停先提交则不落包/不发 `handoff.created`；落包后本次派发继续，不再设 `dispatchInState` 第三道检查），消除 `created` 孤儿包与 BR-14 冲突，§2.12 同步边界说明；AC-20 机检改为场景根 `.mock/prompts/2.json` 占位与目标会话计数文件；AC-49/50 补"无指向测试的孤儿包/包恰好一张"；非阻塞收口：AC-17 授权每次尝试重写信箱、AC-61 改用计数文件、AC-63 改断言 `failure.code`、BR-35 对齐 7 词扫描、M-12/D-10.5 三处→四处 |
| v12 | 2026-11-07 | 十一轮评审修复：D-7.4 改为真正的单次 CAS（交接包推入、轮次/派发计数、节点与实例状态一次提交；`handoff.created`/`node.dispatch` 在 CAS 后发出），消除"落包与派发两次写"之间被暂停插入而遗留 `created` 包的窗口；D-7.2/7.3 补暂停/恢复对运行时 `rev` 的同步与跨进程重读合并，避免当前回合以 `STORE_CONFLICT` 收尾；D-7.3 明确 resume 的后台推进与 1 秒返回；D-4.7 明确下游会话创建失败把交接包置 `rejected`/`delivery_failed`，新增 AC-65；非阻塞收口：AC-10 固化"缺少证据引用"、AC-11 改用 `calc.js`、AC-41 改用已完成实例、AC-16/17/61 统一场景根计数、A-5 补错误码列、§3.3-9 补信箱根、D-2 暂停行收敛为 `running`、登记 R-7/R-8 |
| v13 | 2026-11-07 | 十二/十三轮评审修复：D-7.2/7.3 改为 pause/resume 与 `saveLive` 共用 `store` 的实例写序列，且 `expectedState` 在队列任务内取值（消除假 CAS 冲突），删除不可观测的"不得以 STORE_CONFLICT 收尾"；D-7.4 恢复两阶段派发（落包 → 接缝 → 派发提交），明确"包已构造、尚未派发"时暂停保留 `created` 包、恢复复用同一包且不重发 `handoff.created`，保留 I1.2 `after_verdict` 中间态；新增 AC-66；AC-49 改用既有暂停接缝并改为可观测机检；AC-50 加派发同步点；AC-51 改为无节点限定接缝 + 每周期清理 `release/paused`；D-4/D-3 把 `deliveryAttempts` 定义为"每次 `adapter.prompt` 前自增"（首次成功=1），`handoff.round` 定义为目标派发后轮次；D-6.6 轮次只由派发提交自增；D-4.2 明示升级事务的会话终态覆盖参数；D-7.9/A-2.6 定义前台 `orch run` 暂停收尾与 `NEXT_STEP_PAUSED`；D-10 澄清命令级错误码不进核心 `CODES`、接缝用法与复用包事件口径；AC-19/AC-65 夹具归属改回 I1.2；§1.3.1 补 AC-65/AC-66 并修正 approve 映射；登记 R-9 |
| v14 | 2026-11-07 | 十四/十五轮评审修复：CAS 比较字段扩为 `state/halted/rev/paused`（`casSnapshot`/`compareExpected`/`expectedOf` 同步，旧快照缺省按 `false`），D-7.4 落包与派发两步的冲突分支都重读 `paused` 再分流，派发 CAS 用接缝后读盘快照的期望值且 `paused` 固定 `false`，消除"暂停先落盘却被派发覆盖"；D-7.2 期望值取读盘现值、写冲突由调用方重新入队（禁止队列任务内再 `save`），补 `saveLive` 的 `rev`/`paused` 回填重试；D-7.4 第 1 步增加**读盘**目标门控与"`targetRound` 轮无会话"的复用条件，D-7.3/D-6.9 改为锁外后台推进入口（claim 句柄 → `advance()` → `driveGraph` 收尾）并从会话取 `hostId`，消除重复派发、孤儿包与回合无人收尾；未持锁重入、恢复后宿主错配三处隐患同步关闭；D-3.2 证据基准统一回 C-07，D-3.5 校验提前到写入 `created` 前并登记 `handoff_invalid`；D-10 授权三处 `actual` 深比较随 `paused` 更新，新增暂停/派发原子性单测；AC-49 补 `status.md` 断言，AC-51 明确首轮 `resume` 前清理与轮次断言，AC-66 的 `node.dispatch` 改为"新增"断言；顺手修正旧基线归属、术语与 §2.9 决策清单 |
| v15 | 2026-11-07 | 十六/十七轮评审修复：D-6.9 按裁决拆分入口——`pass` 走 `advance()`、`retry` 由裁决自身 `dispatchInState` 直派（轮次只由该次派发提交自增）再交给后台 `driveGraph` 收尾，明确升级事务 CAS 冲突重放一次；D-7.4 复用 `created` 包时提示词由已落盘包的 `defects`/要求/`artifactRefs` 经 `promptFor` 重建，不再依赖本轮 `verdict`，复用只发 `node.dispatch`；D-7.3 的 `driveGraph` 在 `advance` 返回暂停态后、删句柄前重读磁盘，未暂停且仍在运行则再推进；D-7.2 无活动回合的暂停/恢复写入在队列内校验业务前置（`running` 且未挂起，恢复还须 `paused === true`），冲突由调用方作为新 `save` 重试；D-2 让 `delivered({ atMs, attempt })` 写入尝试数（未传不写该键），与 AC-16 的 `deliveryAttempts === 2` 对齐；D-6.8 轮次门限由四处补齐为五处，纳入 `shouldWake`/`checkWakeGate` 的 `extraRounds`；D-9.8 只写交接包上实际存在的键；AC-57 的机检收敛为流程实际产生的事件集；AC-29 补 `--decision` 使命令与退出码 1 对应，AC-30 补命令，AC-28 补"执行失败"，AC-40/AC-45/AC-64 的 BR 引用归位；AC-07 覆盖测试节点上游只读子句，AC-42 允许升级/审批摘要行，AC-58 注明 Ctrl-C 脱离；A-2 补 `single` 审批行形状 |
| v16 | 2026-11-07 | 十八轮评审修复：实例不存在的输出沿用 I1.1 的 `实例 {id} · 不存在`（删除 A-5 新增的 `INSTANCE_NOT_FOUND` 行），AC-38 补存在/不存在两分支；NFR-06 的回归授权范围补上附录 D-10；AC-21 补 `升级 —` 空态，AC-34 补"审批不存在"，新增 AC-67（核心重启后 `approve` 返回 `APPROVAL_SESSION_GONE`、审批仍待处理、退出 1），全文 AC 计数与映射同步为 67 条；D-7.3 改为退出前**先删句柄再读盘**、需要时另起一次后台 `driveGraph`，关闭恢复写盘与删句柄之间的活动性空洞；D-7.2 给 `ctx.conflicted` 定义收尾——`driveGraph` 以 `STORE_CONFLICT` 停止并按 A-5 提示，不再"按既有路径"（代码中无该路径）；D-4.2 明确新会话尚未落盘，`commitEscalation` 需用新会话叠加参数并入读盘状态后再覆盖终态；D-10 把 `test.handoff` 注册改到 `src/daemon/server.js`、`test.escalate` 的 `reasonCode`/`artifactRefs` 需由 server 转发且先在 `escalateOnce` 中以一次 CAS 落盘 `artifactRefs` |
| v17 | 2026-11-07 | 十九轮评审修复：D-2 审批迁移把"会话失效"限定为核心运行中观察到会话不可应答，并注明核心重启不迁移、`approve` 返回 `APPROVAL_SESSION_GONE`（与 AC-67 对齐）；AC-21 补全新项目根的零升级场景；AC-58 移除运行中实例上的 `attach` 断言（其只读性由 AC-44 的稳定会话覆盖）；D-7.2 补回合收尾/`complete` 分支的 CAS 冲突重放一次，并要求 `waitForRun` 透传 `STORE_CONFLICT` 失败码，关闭"`reject` 后静默退出、实例停在 `running`"的窗口；D-7.3 的自恢复改为复用 `resume` 的后台入口（同步检查+claim、无 `await`），避免另起空 `driveGraph` 与双驱动；D-4.2 的会话叠加参数同时覆盖节点 `sessionId`/`round` 并参数化会话终态与事件 `to`；D-10 补三组新增冲突/隔离用例 |
| v18 | 2026-11-08 | 独立评审（干净上下文）修复：① AC-07 改为覆盖 `code-loop` 与 `task-loop` 的「工作区上下文」段，新增 A-6，并授权 `test/templates/task-loop.test.js` 逐字断言更新；② D-10.6 补 `test/wp6/render.test.js:602–608` 的 `ESCALATION_BLOCK.next` 授权；③ AC-48 补具体包号，命令可执行；④ AC-23/25/26 的实例行改为带模板名的完整当前实例行；⑤ 新增 AC-68/69（合法回流/复测包通过校验）、AC-70（唯一编号 `show` 省略 `--instance`）；⑥ AC-56 给出可执行架构扫描命令并改为 11 词并集，D-11.2 同步；⑦ 新增 R-10 登记 `pending → rejected` 取消撤回；⑧ AC-04/21/44/46/58/64 补断言与完整命令；AC 计数 67 → 70 |
| v19 | 2026-11-08 | 二次独立评审修复：① A-6 补追加条件（`promptFor` 带 `graph` 且 `graph.nodes.length > 1`；只传 `node` 不追加），D-10.1.2 收窄到以 `graph` 调用的断言；② AC-44 改为先用 `orch status` 取实际会话号，§2.8 标注 `SES-001` 为示例；③ D-10.1.3 授权 `instance-store.list` 投影新增 `paused/approvals/pendingApprovals`；④ D-10.3 改为点名 `labels.test.js` 四处精确对象与 39→48 条原因；⑤ AC-27/33/50 补独立项目根重放。非阻塞收口：AC-03/04/08/56、§3.1 观测口径、§3.3#3 补断言与说明，新增 R-11 登记 `stage/` 语义 |
| v20 | 2026-11-08 | 三次独立评审修复：① AC-44 的会话号来源改为 `orch run` 的「会话已创建」行或 `instance log --format json` 的会话事件（`status` 会话行不含 id）；② BR-35 与 AC-56/D-11.2 统一为 11 词并集，`single` 改为"允许的缺省标识、不在表内"；③ AC-07 扩展到 8 类派发（含 writer / backflow / retest），并修正审核节点只追加后三行；④ A-6 的共享区行改为 `共享区（只读）`，与 §2.2 对齐。非阻塞收口：A-3 resolve 样例补模板、AC-02/08/16/28/29/56/57 补断言、§2.2 明确会话状态不写 `status.md`、§3.3 补 `--permission=ask` 与 C-13 说明 |
| v21 | 2026-11-08 | 四次独立评审修复：AC-29 ③ 的期望文案改为 `实例 INST-002`（与命令一致）；非阻塞收口：AC-29 三子场景各用独立项目根、AC-30 明确"夹具让新会话创建失败"、A-1 交接包样例改为"已接受"、§2.2 刷新触发补暂停/恢复、D-1 的 `labels.js` 改为"CLI 侧唯一中文来源"、A-3 补 attach 事件行格式说明、D-10.3 补核心状态词与 `labels.js` 的逐词对照断言 |
| v22 | 2026-11-08 | 五次评审 PASS 后的非阻塞收口：AC-07 的派发计数改为 9（补 T-003 复测审核）、A-1 补 `single` 的 `status.md` 版式、D-4.4 明确每次失败尝试都发 `handoff.pending`、D-10.6 授权用法摘要首行不变、AC-36 补三种终态审批、D-10.4 澄清 `WORKSPACE_INIT_FAILED` 已存在 |
| v23 | 2026-11-08 | 第六次（独立、干净上下文）评审 PASS，其余 6 条非阻塞建议收口：① AC-26 的前置改为可复现（独立项目根 + `test.escalate` 接缝 + 旧会话已回空闲），机检补"旧会话不再 `running`"；② §2.10 与附录 B 明确 `--approval reject`（发起时策略）与 `--decision deny`（单次裁决）不是同一开关；③ AC-54 增加显式 `--template single` 与缺省等价的断言；④ §2.9 与 AC-21 明确 `--instance` 与 `--all` 同时给出时"先按实例过滤、再由 `--all` 放开状态范围"；⑤ AC-50 机检补 `status.md` 的 `- 暂停：否`；⑥ A-6 补"生产派发一律带 `graph`、只按节点数判定"（避免核心出现模板名字面量），AC-07 机检同步。AC 计数仍为 70 |

---

## 附录 D 实现约束（非用户可见，供实现与任务拆分使用）

### D-1 模块与文件边界

| 模块 | 职责 | 约束 |
|---|---|---|
| `src/persistence/paths.js` | 新增 `sharedDir` / `stageDir` / `statusPath` / `inboxDir` | 只拼路径，不读写 |
| `src/core/workspace.js`（新） | 建工作区、写 `status.md`、原子替换 | 不 import CLI；不出现模板/角色字面量；使用图数据与状态文案表 |
| `src/core/handoff-schema.js`（新） | 校验交接包字段与证据 | 纯函数；返回 `{ok, code, detail}`；不写状态 |
| `src/core/inbox.js`（新） | 原子写/读/更新信箱消息 | 先写临时文件再 rename；失败返回错误码 |
| `src/core/approvals.js`（新） | `APR-nnn` 分配、创建、处理、作废 | 只改内存对象；落盘由调用方一次 CAS |
| `src/core/state-machine.js` | 新迁移边与状态集合 | 见 D-2 |
| `src/core/orchestrator.js` | 工作区初始化、校验、投递重试、审批、暂停、升级裁决 | 所有新路径保持单写者/CAS；不 import `labels.js` |
| `src/daemon/server.js` | 新 RPC：`escalation.resolve`、`approval.list/resolve`、`workflow.pause/resume/abort`、`session.locate`（名称可调整，语义固定） | 参数校验在边界；不拼中文 |
| `src/cli/main.js` | 命令树、位置参数、新 flag、分发 | 不拼中文；不直接读 `state.json` |
| `src/cli/render.js` | 新命令渲染、审批/暂停/重试行、graph text | 所有中文来自 `labels.js` |
| `src/cli/labels.js` | 新文案/错误码/原因词条 | CLI 侧唯一中文来源；核心侧状态文案表另行维护并逐字对照 |
| `src/templates/index.js` | 图对象加 `title`；`promptFor` 在多节点派发时于正文末尾追加 A-6 的「工作区上下文」段（`PROMPT_TEMPLATES` 常量不变） | 仍允许模板名/角色名；`single` 提示词不变；正文已有 `工作区：` 行时不重复追加 |

### D-2 状态迁移表（新增边）

**实例**

| 从 | 到 | 触发 | 备注 |
|---|---|---|---|
| `suspended` | `running` | `escalate resolve retry` / 中间节点 `pass` | 先落裁决，再推进 |
| `suspended` | `completed` | 终节点 `pass` | 终态 |
| `suspended` | `failed` | `resolve fail` | 终态 |
| `running`（暂停/恢复只允许运行中实例） | 同状态 | `pause` / `resume` | 只改 `paused` 布尔，不迁移状态；幂等返回不调用 `can()`、不落迁移 |
| `running` | `cancelled` | `workflow abort` / `cancel` | 沿用取消 |

**节点**

| 从 | 到 | 触发 |
|---|---|---|
| `escalated` | `running` | `resolve retry` 派发 |
| `escalated` | `done` | `resolve pass` |
| `escalated` | `failed` | `resolve fail` |
| `escalated` | `cancelled` | 取消（保留） |

**交接包**

| 从 | 到 | 触发 |
|---|---|---|
| `created` | `delivered` | 调用 `adapter.prompt` 后立即乐观置位（不等回合结束） |
| `delivered` | `pending` | 收到任何 turn 内事件前投递失败，回落准备重试 |
| `pending` | `delivered` | 重试调用 `adapter.prompt` 成功 |
| `pending` | `expired` | 3 次尝试失败 |
| `created` | `rejected` | 校验失败 / 信箱写失败 / 会话创建失败（D-4.7）（state-machine 既有；tracker 本迭代补齐） |
| `pending` | `rejected` | 取消（`rejectReason='withdrawn'`） |

**升级**

| 从 | 到 | 触发 |
|---|---|---|
| `pending` | `resolved` | `escalate resolve` 成功 |
| `pending` | `voided` | 取消（保留） |

**审批**

| 从 | 到 | 触发 |
|---|---|---|
| `pending` | `approved` | `approve --decision allow` |
| `pending` | `denied` | `approve --decision deny` |
| `pending` | `withdrawn` | 取消；或核心在运行中观察到会话已不可应答 |

核心重启后没有内存 `respond` 时**不迁移审批状态**：`approve` 返回 `APPROVAL_SESSION_GONE`（D-5.9 / AC-67），审批保持 `pending`，由后续取消收尾。

**集合调整**：`CANCELABLE_HANDOFF` 增加 `pending`；`ESCALATION_STATES` 增加 `resolved`；新增 `APPROVAL_STATES`；`src/core/state-machine.js` 的 `TABLES.handoff` 增加 `delivered → pending` 与 `pending → rejected`；`src/adapter/handoff-tracker.js` 需同步：
- `LEGAL.created` 增加 `rejected`（校验失败 / 信箱写失败的直写拒绝；现有 tracker 没有这条边）；
- `LEGAL.delivered` 增加 `pending`，`LEGAL.pending` 增加 `rejected`（取消直写路径不变）；
- 新增 `delivered({ atMs, attempt })`、`pending({ atMs, attempt, lastError })` 与 `expired({ atMs, attempts })` 迁移方法，分别发出 `handoff.delivered` / `handoff.pending` / `handoff.expired`（`pending` / `expired` 的 `detail` 至少含 `deliveryAttempts` 与 `lastError`），并更新 `deliveryAttempts`、`deliveredAt`、`pendingAt`、`expiredAt`；`delivered` 传入 `attempt` 时写入该值、未传时不写该键（保持既有调用与旧快照兼容）；
- `snapshot()` 增加 `deliveryAttempts`、`pendingAt`、`expiredAt`、`lastError` 四个字段，供 D-9.8 的 `handoffToState` 投影保留。

`test/wp3/handoff-tracker.test.js` 只做新增用例（覆盖从 `created` 直拒、`delivered → pending` 回落与重试、`pending → expired` 迁移，以及 `delivered({ attempt })` 把尝试数写进快照）；除 D-10.1 授权的 `REJECT_REASONS` 精确数组外，既有断言不动。

### D-3 交接包结构与校验顺序

1. `buildHandoff` 追加落盘字段：`instanceId`、`round`、`fromNodeId`、`toNodeId`、`retestRequirement`、`deliveryAttempts: 0`、`pendingAt: null`、`expiredAt: null`、`lastError: null`。`round` 取**目标节点本次派发后的轮次**（即构造时的 `目标 round + 1`），与派发提交自增后的 `node.round` 一致。`deliveryAttempts: 0` 表示"尚未尝试"；每次调用 `adapter.prompt` **之前**自增，首次尝试即为 1、成功也保留该值（因此首次成功为 1，一次失败后成功为 2）。回流包构建时 `revisionRequirement` / `retestRequirement` 为空则按提示词语义补默认值（文档闭环补修改要求、编码闭环补复测要求，C-06），不能让引擎自己的默认值成为校验失败原因。
2. 校验顺序（遇到第一个失败即返回）：
   1. `edge !== null`（`single` 引导包跳过）；
   2. `handoffId` 非空；`instanceId` 非空；`round` 为正整数；`fromNodeId`、`toNodeId` 非空且与 `edge.from/to` 一致；
   3. `edge.kind ∈ {forward, backflow, retest}`；`createdAt` 可解析；
   4. `artifactRefs` 是对象；`input` 是数组（允许为空）。证据集合 = `input` ∪ `previous.ref` ∪（`backflow` 的 `defects[].evidence`），至少一条非空；
   5. 逐条解析证据集合中的路径（`previous` 或 `previous.ref` 为 null 时跳过）：存在、普通文件、大小 > 0、路径不越界；`previous.sha256` 存在时校验 SHA-256；回流缺陷证据先剥离 `#L<n>` / `#L<n>-L<m>` 再解析，解析基准一律按 C-07（`artifacts/` 前缀走工作区、其余走任务目录、绝对路径须落在两者之一，按来源节点产物策略取基准），不得按模板名或角色名分支；
   6. `backflow`：`defects` 非空；每条 `summary` 与 `evidence` 非空；`revisionRequirement` 或 `retestRequirement` 非空。
3. 返回码：`HANDOFF_FIELD_MISSING` / `HANDOFF_EDGE_INVALID` / `HANDOFF_EVIDENCE_MISSING` / `HANDOFF_EVIDENCE_UNREADABLE` / `HANDOFF_EVIDENCE_EMPTY` / `HANDOFF_EVIDENCE_ESCAPE` / `HANDOFF_HASH_MISMATCH` / `HANDOFF_BACKFLOW_INCOMPLETE`。
4. 失败文案：`交接包 {id} 内容不合规：{detail}`；`detail` 必须含包号、字段或路径；缺少证据时 `detail` 固定含"缺少证据引用"。
5. 校验对草稿在**写入 `created` 包的 CAS 之前**执行（D-7.4 第 1 步末先校验、第 2 步再落包）；失败时把该包以 `rejected` / `invalid_payload` 落盘，且与来源节点升级（`reasonCode` 固定为 `handoff_invalid`，`reasonDetail` 用第 4 条文案）、实例挂起写入**同一次 CAS**；只发 `handoff.rejected` 与 `escalation.created`，不发 `handoff.created` / `node.dispatch`；不建信箱、不建会话、不增加轮次。实现上扩展 `escalateState` / `commitEscalation` 接受一张待拒绝的交接包，与升级同一次落盘。

### D-4 信箱与重试

1. 适用范围：仅 `edge !== null` 的图驱动交接包。文件路径 `.orch/inbox/<instanceId>/<handoffId>.json`；内容：
   ```json
   {
     "handoffId": "HO-001",
     "instanceId": "INST-001",
     "fromNodeId": "T-001",
     "toNodeId": "T-002",
     "sessionId": "SES-…",
     "promptText": "…",
     "createdAt": "…",
     "deliveryAttempts": 1,
     "deliveredAt": null,
     "lastError": null
   }
   ```
2. 写入：临时文件 + `rename`；失败返回 `INBOX_WRITE_FAILED`，交接包 `rejected` / `delivery_failed`，节点升级 `delivery_failed`，实例挂起。若目标会话已创建（可能尚未落盘——`dispatchInState` 在会话创建到首次 `saveLive` 之间有窗口），在同一落盘中把该会话置 `idle` + `quarantined`（覆盖升级事务默认的 `escalated`），不得留下"执行中"或"已升级"的假会话；`commitEscalation` 会从磁盘重读状态，因此给 `escalateState` / `commitEscalation` 增加**新会话叠加参数**：把尚未落盘的会话对象并入读盘状态，**同时覆盖目标节点的 `sessionId` 与 `round`**（派发落盘早于这两项赋值，否则会按旧会话隔离），再把会话终态、`quarantined` 与事件目标状态一起传给 `applyInMemory`（会话事件的 `to` 不得硬编码 `escalated`），不靠事后补写。
3. 尝试次数：共 3 次（首次 + 最多 2 次重试）；失败间隔 200ms、500ms；用可取消的定时器。每次重试前重新检查实例状态，已 `cancelled` 则清理定时器、不再尝试；取消实例时立即停止后续尝试，待投递交接包按取消规则转 `rejected` / `withdrawn`，信箱文件保留供审计。`NODE_ENV=test` 下可用 `test.delivery` 在重试等待点确定性暂停/放行。
4. 第 1 次尝试在收到任何 turn 内事件前失败：交接包由乐观置位的 `delivered` 回落 `pending`，置 `pendingAt` 与 `deliveryAttempts=1`，一次 CAS 落盘并发 `handoff.pending`；此后每次尝试（含最后一次失败）同步更新 `deliveryAttempts` 与 `lastError`，各发一条 `handoff.pending`（带本次 `deliveryAttempts` 与 `lastError`），并重写信箱文件中的对应字段。不新增 `created → pending`：代码在调用 `adapter.prompt` 后已置 `delivered`，失败只能发生在 `delivered` 之后。
5. 成功：`pending → delivered`（首次即成功则保持 `created → delivered`）；置位时刻是"调用 `adapter.prompt` 后立即"，以提示词已交给宿主为准，不等待回合 resolve；这样同一回合内先到的 turn 事件仍能看到 `delivered` 并正常推进 `accepted`。调用 `delivered({ atMs, attempt })` 传入本次尝试数，`deliveryAttempts` 保留；信箱文件的 `deliveredAt` 更新为成功时间；后续接受/完成沿用原逻辑。
6. 耗尽：`pending → expired`；节点升级 `delivery_failed`，`reasonDetail` 含尝试次数与最后错误；实例挂起；目标会话在同一落盘中置 `idle` + `quarantined`（不置 `escalated`）。
7. 不重试：`createAdapter` / 会话创建失败（沿用 I1.2 `dispatch_failed`；若本次是图驱动交接包，在随后写入升级的同一次落盘中把它置 `rejected` / `delivery_failed`，不留 `created`）；`single` 的 `HO-001` 与图入口的无交接包派发（分别沿用 I1.2 失败结果与 I1.3 `execution_failed` 升级）；已收到任何 turn 内事件后的失败（沿用 I1.2 / I1.3）。
8. 重试不得调用 `dispatchInState` 第二次，不得 `node.round += 1`，不得新建会话。
9. 失败判定与重试必须在投递层完成：`ctx.promptPromise` 对外只暴露最终结果；第一次失败与整个重试期间，图节点收尾函数（`finishGraphNode`）不得继续执行 `hasSubmittedOutput`、`running → review` 或任何会话迁移，节点保持 `running`、会话保持当前状态。重试成功后再按正常回合核对与推进。耗尽时投递层先完成升级写入，再落定 `promptPromise`；收尾函数随后被 `isRunStopped` 短路，不得二次升级。
10. 耗尽转 `expired` 时同时写 `expiredAt`；`handoff show` 与列表的"最后时间"使用 `expiredAt`（A-3）。

### D-5 审批

1. 审批只在 `permissionPolicy === 'hold'` 时创建；默认 `allow`，`reject` 直接拒绝。
2. `run --approval hold` 覆盖宿主配置；取值只允许 `allow|reject|hold`，否则用法错误退出 2。CLI 把 `approvalPolicy` 传入 `run.start`，daemon 在校验边界检查取值后转交 orchestrator；未传时仍按宿主配置（缺省 `allow`）。
3. 创建：`APR-nnn`（实例内递增）、`instanceId`、`nodeId`、`sessionId`、`action`、`toolCallId`、`state='pending'`、`createdAt`、`resolvedAt=null`、`resolution=null`。
4. 审批与 `session.state='waiting_input'`、`pendingPermission` 在同一次 CAS 落盘；事件 `approval.created`。
5. `allow`：审批 `approved`；调用现有 `permission.respond({ outcome: { outcome: 'selected', optionId: 'allow-once' } })`；会话回 `thinking`；事件 `permission.allowed`（`detail.approvalId`）。
6. `deny`：审批 `denied`；调用现有 `permission.respond({ outcome: { outcome: 'selected', optionId: 'reject-once' } })`；沿用 `settlePermission('reject')` 与既有失败路径；事件 `permission.denied`（`detail.approvalId`）；不得新造失败码。
7. 同一审批二次处理返回 `APPROVAL_NOT_PENDING`；跨实例搜索唯一匹配才允许省略 `--instance`。
8. 取消：所有 `pending` 审批 `withdrawn`；有内存 `respond` 时先取消；事件 `approval.withdrawn`。
9. 无内存 `respond`（核心重启）时 `approve` 返回 `APPROVAL_SESSION_GONE`，不写 `approved`。

### D-6 升级裁决

1. 新增 `resolved` 状态；条目字段 `resolution ∈ {pass, fail, retry}`、`resolvedAt`。
2. 前置：实例 `suspended`、`halted !== true`、升级 `pending`（升级时 `paused` 已按 D-7.6 清零，无需再判暂停）。
3. 决策约束：
   - `pass`：仅 `reasonCode === 'rounds_exceeded'` 允许；
   - `fail`：所有原因；
   - `retry`：所有原因。
4. `pass`：节点 `escalated → done`，清 `note`，`endedAt` 置为裁决时刻（保证 `advance` 的 `latestEndedNodeId` 仍能选中它）；被裁决节点的会话回 `idle`；若节点是终节点 → 实例 `completed`；否则实例 `running`，同一事务后调用推进。
5. `fail`：节点 `escalated → failed`，实例 `failed`；所有活动会话回 `idle` 并隔离；不再推进。
6. `retry`：实例 `suspended → running`；给节点记 `extraRounds += 1`；新建会话并派发；轮次由派发提交自增一次（不得在 retry 路径另行自增）；历史会话 `idle` 并隔离；只重跑该节点，不重跑上游。被拒绝/已过期的旧交接包保持原状，新一轮构造新包（新包号），不得复活旧包。
7. `retry` 的提示词：优先复用最近一张指向该节点的交接包（含缺陷/修改要求）；没有则按任务与图节点提示词组装。
8. 轮次上限判断改为 `node.round >= maxRounds + (node.extraRounds ?? 0)`；必须覆盖全部五处门限：`advance.js` 的 `verdict-fail` 回流与 `passed` 前进、`orchestrator.js` 的 review `reject` 与 verdict `fail`，以及 `advance.js` 的唤醒门限 `shouldWake`（由 `checkWakeGate` 传入目标节点，使 `extraRounds` 同样计入）。人工 `retry` 只授权一轮，之后再次失败立即升级。
9. 裁决与节点/实例变化一次 CAS 落盘；事件 `escalation.resolved`；随后按裁决结果走不同入口，均**不在已持锁的调用栈里重入 `advance`**（`withLock` 不可重入）：
   - `pass`：claim 句柄 → 调一次 `advance()` → 有派发则把 ctx 交给句柄并后台 `driveGraph` 收尾；无则释放句柄。
   - `retry`：由裁决自身完成 D-6.6 的建会话 + `dispatchInState` 派发（轮次只由该次派发提交自增），再把返回的 ctx 交给已 claim 的句柄并后台 `driveGraph` 收尾；**不得**在直派之后再调 `advance()`（目标已 `running`，会被 D-7.4 第 1 步门控判忙，导致刚建的回合无人收尾）。
   - `fail`：不推进，按既有收尾。
   句柄必须带图定义（`graphForState`，供 `driveGraph` 判定单节点）；重建适配器的 `hostId` 取最近会话的 `hostId`；`advance`/`dispatch` 的失败走既有升级路径。升级事务自身（`escalateState` / `commitEscalation`）的 CAS 冲突必须重新读盘、在新状态上重放一次；不得因暂停/恢复的无锁写盘插在"读"与"写"之间而把升级降级为 `halted`。
10. 已 `resolved` / `voided` 的升级不再参与 `findPending`。
11. `retry` 再次建会话失败时，节点回到 `escalated` 并生成新升级；不得把旧升级重新置为待处理。

### D-7 暂停 / 恢复 / 终止

1. `paused` 是实例级布尔，默认 `false`；落盘；快照投影 `paused`。实例 CAS 的比较字段同步扩为 `state/halted/rev/paused`：`casSnapshot` / `compareExpected` 增加 `paused`，`expectedOf` 带上 `Boolean(state.paused)`（旧快照缺字段按 `false` 比较）；不显式提供该键的既有调用行为不变。这样任何旧快照都不能把已落盘的 `paused` 覆盖回 `false`。
2. `pause`：仅 `state === 'running'` 且 `halted !== true` 允许；已暂停幂等返回（不写盘、不发事件）；一次 CAS 写 `paused=true`；事件 `workflow.paused`。
   - **写序列**：pause/resume **不得取实例锁**（推进过程会在 `after_verdict` 等接缝处持锁等待，取锁会让暂停命令卡住；与取消同理）。写盘一律经 `store.save` 的实例写序列（`instance-store.js` 的 `enqueueSave`），并让 `expectedState` 在**队列任务内、写盘前一刻**取值（为此 `store.save` 需支持传取值函数）；取值一律用**读盘现值**（含 `state/halted/rev/paused`），不能用内存里已经改过的 `state.paused`，否则会自己跟自己冲突。有活动回合（句柄 `currentCtx` 非空）时，先改该回合内存 `state.paused`，队列任务内读盘取期望值、把目标 `paused` 应用到待写快照后 CAS 落盘，写成功后 `state.rev` 就地更新，回合后续写入自然以最新 `rev` 为基准；没有活动回合时在队列任务内读盘、置 `paused`、CAS 写入。队列任务内读盘后**先校验业务前置条件**（`state === 'running'` 且 `halted !== true`，恢复时还要求 `paused === true`）：不满足就不写盘、按 AC-53 的"当前状态不能暂停/恢复"返回，**不得**把 `paused` 写到已取消/已挂起/已完成的实例上。满足时用读盘现值作期望值提交；只有跨进程写入导致冲突时，才由调用方**重新发起一次 `save`**（每次都是独立入队、期望值函数在新任务内重新读盘），最多 3 次——**不得在队列任务内再调用 `store.save`**，否则会等待自己所在的写链而死锁。这样暂停写盘不会与回合写盘交错，也不会因排队期间 `rev` 变化产生假冲突。
   - **回合写盘的回填**：`saveLive` 仍按回合快照取期望值；若因暂停/恢复写盘抢先而 `STORE_CONFLICT`，读盘取 `rev` 与 `paused` 后重试一次（`state` / `halted` 仍按快照比较，其它写入者改了这两项则不重试），写成功后把 `rev` 就地回填；重试仍冲突才置 `ctx.conflicted`；`driveGraph` 在本次回合收尾后检查该标记，以 `STORE_CONFLICT` 停止本轮驱动（不再写盘、不升级），`waitForRun` 必须把该失败 outcome 的 `code` 原样返回（现实现恒返回 `ok:true`，需改），CLI 按 A-5 打印"操作冲突，请重试"并退出 1；下次推进从磁盘重读。不能静默丢写。**回合收尾与完成判断的 CAS**（`finishGraphNode` / `advance` 的节点与实例写，含 `complete` 分支）遇 `STORE_CONFLICT` 时，先读盘取最新 `rev`/`paused` 重放一次（暂停不阻断当前回合收尾）；仍冲突才按上面的冲突收尾，不得返回 `reject` 后让 `driveGraph` 静默退出并把实例留在 `running`。
   - 取消/升级已先落盘时，上面的前置条件校验会拒绝写入并返回"当前状态不能暂停/恢复"（不返回 `STORE_CONFLICT`、不假装成功）；真正的 `STORE_CONFLICT` 只剩跨进程竞争，按冲突的既有路径收尾。
3. `resume`：仅 `state === 'running'` 且 `halted !== true` 允许；未暂停幂等返回（不写盘、不发事件）；一次 CAS 写 `paused=false`，写序列与第 2 条相同（同样使用队列内取 expected 的写法；无持有者在任务内读盘、写盘、冲突重读重放，最多 3 次）；事件 `workflow.resumed`。只有本次写盘真正把 `paused` 从 `true` 改为 `false` 时才触发推进（幂等返回不推进），且触发条件为 `activeRuns` 中**没有该实例未完成的运行句柄**（包括 `currentCtx` 暂时为空但驱动循环尚未退出的窗口）——有句柄时只清 `paused`，由既有 `driveGraph` 循环继续，避免同一节点被两条路径各派发一次。触发时走锁外的后台推进入口（与 `run` 同一套）：先 claim 运行句柄，再调用一次 `advance()`（其内部自取实例锁；`withLock` 不可重入，**不得**在已持锁的调用栈里再调 `advance`）；`advance` 返回 `dispatch` 时把 ctx 交给句柄并后台启动 `driveGraph(handle)` 收尾（`driveGraph` 是唯一收尾回合、resolve `run.wait` 的循环），返回 `stop` / `paused` 则释放句柄。重建适配器的 `hostId` 取最近一个会话持久化的 `hostId`（`state.sessions`），没有则 `null`；判定的目标节点门控由 D-7.4 第 1 步再挡一次。`driveGraph` 在 `advance` 返回 `paused` 后，**先同步**把句柄标记 `finished` 并从 `activeRuns` 删除，**再**读盘：若 `paused` 已被恢复改回 `false`、实例仍 `running`，且 `activeRuns` 中没有该实例的新句柄，则以**与 `resume` 相同的后台推进入口**另起一次驱动（同步完成 `activeRuns` 检查与 claim，中间不得有 `await`；再 `advance()`，有派发则把 ctx 交给句柄并 `driveGraph` 收尾，无则释放）；已有新句柄则让该句柄驱动。本次驱动仍按暂停快照 resolve `run.wait` 收尾。必须先删句柄再读盘——否则恢复写盘落在"读盘"与"删句柄"之间时，恢复侧看到旧句柄而不触发推进，`driveGraph` 又因读到暂停而退出，形成无人驱动的活性空洞。推进在后台驱动中执行，`resume` 命令在提交后 1 秒内返回（NFR-04），不等回合跑完。
4. 暂停门控以**派发提交**为界，分三步，三步都走同一实例写序列；所有相关 CAS 的比较字段含 `paused`（第 1 条）：
   1. 构造：先算本次派发后的轮次 `targetRound = 目标节点当前 round + 1`，再**读盘**取目标节点现状——若该节点已是 `running` / `review`，或读盘后的 `node.round >= targetRound`（说明本轮派发已提交，或另一条推进已抢先），本次推进以 `action: 'stop'` 结束，不构造、不落包、不派发，避免同一节点被重复派发或留下孤儿 `created` 包。否则查找可复用的 `created` 包（`toNodeId` 等于本次目标、`round` 等于 `targetRound`、且该节点**在 `targetRound` 轮没有已开始的会话**——旧轮次会话不算）；找到就沿用该 `handoffId`、跳过落包，进入第 3 步。没有才构造交接包草稿（含回流包的 `wakeConsumedAt`），不写 `state`，并按 D-3 完成校验（失败走 D-3.5 的拒绝 + 升级同一次落盘，本轮推进结束）。
   2. 落包（仅图驱动）：提交前**读盘**检查 `paused`（推进持有的内存快照可能早于暂停写盘）；已暂停 → 本次推进以 `action: 'paused'` 停止，不落包、不派发。未暂停 → 一次 CAS 落盘交接包（`created`，期望值含 `paused: false`）；CAS 冲突时重读磁盘：`paused === true` → 按暂停停止（不落包、不派发），否则按既有 CAS 冲突路径返回 `reject`。落盘成功后发 `handoff.created`；回流时再发 `backflow.constructed`，然后经过 I1.2 的 `after_verdict` 接缝。入口/single 派发没有包，直接进入第 3 步。
   3. 派发：**再次读盘**确认 `paused`。已暂停 → 保留刚落盘的 `created` 包（它是"已构造（等待恢复后派发）"，不是孤儿），以 `action: 'paused'` 停止：不发 `node.dispatch`、不建会话、不增加轮次；恢复时必须复用这张包（按 `toNodeId` + 本次 `round` 选最新 `created` 包，投递同一 `handoffId`），不得另造第二张。未暂停 → 一次 CAS 完成 `node.round + 1`、`dispatchCount + 1`、节点置 `running`、实例置 `running`；期望值取**接缝后重新读盘的那份推进快照**（`advanceLocked` 在 `after_verdict` 之后 `store.load` 的新状态）的 `state/halted/rev`，`paused` 固定为 `false`（即使内存对象已被暂停写改为 `true`，也不能拿它当期望值），且不在队列任务内重取，因此只要暂停写盘先于本 CAS 提交就必定冲突。CAS 冲突时重读磁盘：`paused === true` 则按暂停停止（保留包，不派发），否则按既有冲突路径处理。派发成功后发 `node.dispatch`，再建会话、写信箱、投递；此后到达的暂停不再阻断这次派发（第 5 条）。
   派发 CAS 因其他原因失败时按既有冲突路径处理，并把刚落盘的 `created` 包置 `rejected` / `delivery_failed`（**仅当该包仍为 `created`**；若取消已先把它置为 `rejected` / `withdrawn`，保留原拒绝原因），不得留下无人派发的 `created` 包。复用既有包的派发只发 `node.dispatch`，不再发 `handoff.created` / `backflow.constructed`（`test.dispatch` 亦同），也不重走 `after_verdict` 接缝；其提示词用**落盘包本身**的 `defects` / `revisionRequirement` / `retestRequirement` / `artifactRefs` 走既有 `promptFor` 重建，不得依赖本次推进的 `verdict`（恢复时为 `null`，编码闭环的 `node.verdict` 也不存缺陷明细）。`driveGraph` 在 `action: 'paused'` 时结束本轮驱动并 resolve `run.wait`（快照带 `paused === true`、实例仍 `running`、`halted === false`）。
5. 当前回合、当前派发、正在进行的投递重试不被打断；重试结束后若 `paused`，不再推进。
6. 升级/取消时 `paused` 清零。
7. `abort` 直接复用 `cancel` 的实现与渲染，不新增状态。
8. `status.md`、`snapshotOf`、`instance-store.list` 投影均带 `paused`。
9. 前台 `orch run` 的暂停收尾：`run.wait` 返回的快照若 `paused === true` 且实例仍 `running`，CLI 按挂起收尾的同一形态打印实例行（含"（已暂停）"）与一行"下一步：`orch workflow resume <instanceId>`"，不打印节点表、交接包行与升级块，退出码 0（暂停不是失败，也不是挂起）。`run.wait` 在"暂停于派发边界生效、当前回合已收尾"时返回；不得让前台一直等到 30 分钟超时。

### D-8 命令与渲染

| 命令 | 读取 | 写入/动作 | 渲染 |
|---|---|---|---|
| `instance status` | `instance.get` | 无 | 与 `status --instance` 共用 |
| `instance log` | `instance.get` + `instance.events` | 无 | `renderEventLines`；json 原样 |
| `instance graph` | `instance.get` + 模板定义（CLI 侧） | 无 | 新 `renderGraphText` / `renderGraphJson` |
| `attach` | `session.locate` + `instance.events` + `approval.list`（按 `sessionId` 过滤） | 无 | 会话事件行 + 首尾行；有待审批时插审批行 |
| `escalate list` | `instance.list` + 快照 | 无 | 新列表行 |
| `escalate resolve` | `escalation.resolve` | 裁决 | 结果行 + 实例行 |
| `approve` | `approval.list/resolve` | 审批 | 审批结果行 |
| `handoff list/show` | `instance.get`（可批量） | 无 | 新列表/详情 |
| `workflow pause/resume/abort` | 新 RPC | 暂停/恢复/取消 | 实例行 / 取消行 |

新增 `labels.js` 词条至少包括：

- `LAYER.approval = '审批'`
- `APPROVAL_LABEL = {pending:'待处理', approved:'已通过', denied:'已拒绝', withdrawn:'已作废'}`
- `ESCALATION_LABEL.resolved = '已处理'`
- `RESOLUTION_LABEL = {pass:'通过', fail:'失败', retry:'重新分配'}`
- `HANDOFF_REJECT_REASON.invalid_payload = '内容不合规'`、`delivery_failed = '投递失败'`
- `HANDOFF_PENDING_LABEL = '待投递'`、`HANDOFF_RETRY_SUFFIX = '重试 {n}/2'`、`HANDOFF_EXPIRED_LABEL = '已过期'`
- `PENDING_APPROVAL_SUFFIX = '待处理审批 {n}'`
- `INSTANCE_PAUSED_SUFFIX = '（已暂停）'`
- `NEXT_STEP_PAUSED = '下一步：恢复推进 orch workflow resume {id}'`（前台 `orch run` 遇暂停收尾时打印）
- 新原因：`handoff.inboxed`、`handoff.pending`、`handoff.expired`、`escalation.resolved`、`approval.created`、`approval.withdrawn`、`workflow.paused`、`workflow.resumed`、`workspace.status_write_failed`
- 复用既有原因：`handoff.rejected`（`detail.reason` 为 `invalid_payload` / `delivery_failed` / `withdrawn`）、`handoff.delivered`、`permission.allowed` / `permission.denied`（审批 allow/deny 沿用会话事件，`detail` 带 `approvalId`）

新事件必须在 `REASON_LABEL` 有中文词条，否则会漏出英文。

### D-9 状态结构与兼容

1. 实例追加 `paused: false`、`approvals: []`；旧快照缺省投影为 `false/[]`。
2. 节点追加 `extraRounds`（缺省 0，不参与旧输出）。
3. 交接包追加 `instanceId/round/fromNodeId/toNodeId/retestRequirement/deliveryAttempts/pendingAt/expiredAt/lastError`；旧包缺省不校验、不打印。
4. 升级追加 `resolvedAt/resolution`；`state` 可取值增加 `resolved`。
5. `snapshotOf` 追加 `paused`、`approvals`、`pendingApprovals`；`shapeSnapshot` 与 `instance-store.projectItem` 同步。
6. `schemaVersion` 仍为 2；旧 v1 快照只读，不补写字段。
7. 所有新字段缺省时必须让旧 CLI 输出逐字不变。
8. `handoffToState` 的投影白名单必须补 `instanceId/round/fromNodeId/toNodeId/retestRequirement/deliveryAttempts/pendingAt/expiredAt/lastError`（或改为"未知字段原样保留"），且**只写交接包上实际存在的键**（tracker 快照没有这些键时不得写成 `undefined`），确保 tracker 的 `session/update` 不会把新字段冲掉。

### D-10 夹具与测试同步

**授权断言修改**

1. `test/wp3/handoff-tracker.test.js`：`REJECT_REASONS` 精确数组增加 `invalid_payload`、`delivery_failed`。
1.1 CAS 快照形状：`casSnapshot` 增加 `paused` 后，冲突返回的 `actual` 多出该键，以下**只改 actual 深比较**（不改冲突语义）：`test/wp1/instance-store.test.js` 约 212、273 行的 `actual` 加 `paused: false`（并新增一条 `{ expected: { paused: true } }` 冲突用例）；`test/wp8/f3-cas.test.js` 约 53 行同改。
1.2 `test/templates/task-loop.test.js`：**以 `graph` 调用** `promptFor` 的多节点逐字断言（约 165–190、247–282 行）按 A-6 追加「工作区上下文」段后更新；只传 `node` 的调用（约 135–145、203–224 行）、`PROMPT_TEMPLATES` 常量断言、`single` 逐字断言与「模板表只追加不修改」断言保持不变。
1.3 `test/wp1/instance-store.test.js`：list 投影整对象断言（约 335–349 行）每项增加 `paused: false`、`approvals: []`、`pendingApprovals: 0`；v1 单字段用例（约 352–369 行）只查单字段，不受影响。
2. `test/wp8/f1-permission.test.js`：hold 用例的"唯一外部决定是取消"改为"取消或 `approve`"；新增 allow/deny 用例。
3. `test/wp2/labels.test.js`：四处**既有精确对象断言**必须同步更新——`LAYER`（约 181–187 行）加 `approval: '审批'`；`ESCALATION_LABEL`（约 132–134 行）加 `resolved: '已处理'`；`HANDOFF_REJECT_REASON`（约 173–177 行）加 `invalid_payload: '内容不合规'`、`delivery_failed: '投递失败'`；`REASON_LABEL`（约 192–234 行）由 39 条改为 48 条，新增 `handoff.inboxed`、`handoff.pending`、`handoff.expired`、`escalation.resolved`、`approval.created`、`approval.withdrawn`、`workflow.paused`、`workflow.resumed`、`workspace.status_write_failed`。另新增暂停/重试/审批行文案与 `NEXT_STEP_PAUSED`、`WORKSPACE_INIT_FAILED`、`STORE_CONFLICT` 的断言，以及核心状态词与 `labels.js` 的逐词对照断言（`status.md` 生成器 vs CLI 文案）。
4. `test/wp2/error-map.test.js`：`src/core/error-map.js` 的 `CODES`/`ERROR_TEXT_KEY` 只承载 prompt/preflight 分类用的码；本附录 A-5 的命令级错误码（`*_NOT_FOUND` / `*_AMBIGUOUS` / `*_NOT_PENDING` / `*_INVALID` 等）由各命令的渲染器处理，**不加入** `CODES`，该测试的精确清单不变。只有进入 `renderError` 的通用码才加到 `ERROR_TEMPLATE`（`WORKSPACE_INIT_FAILED` 已在；本迭代新增的通用码只有 `STORE_CONFLICT`），并在 `test/wp2/labels.test.js` 补断言。
5. `test/wp2/state-machine.test.js`：迁移表增加 D-2 的边；同时更新以下**排他性断言**（只动这四处以及迁移表本身）：
   - "node: escalated has exactly one exit (cancel)"（约 240 行）→ 改为"取消仍是唯一终止边，另允许裁决出边"；
   - `suspended -> running/completed` 为假的断言（约 309–310 行）→ 改为 `suspended -> running/completed/failed` 为真；
   - `escalated -> running` 为假的断言（约 350 行）→ 改为 `escalated -> running/done/failed` 为真；`CANCELABLE_HANDOFF` 精确数组（约 340 行）增加 `pending`。
6. 挂起下一步文案：`test/wp2/labels.test.js`（`ESCALATION_BLOCK.next`、`NEXT_STEP_SUSPENDED`，约 245–259 行）、`test/wp6/main.test.js`（约 298 行）、`test/wp6/render.test.js`（约 602–608、624、1039 行；其中 602–608 是 `ESCALATION_BLOCK.next` 的逐字断言）按 A-2 的新文案更新；`NEXT_STEP_HALTED` 与 halted 路径保持不变；新增 `NEXT_STEP_PAUSED` 词条断言。`test/wp6/main.test.js` 约 77 行的用法摘要首行保持不变（M-9 只在用法里追加新命令行，不改首行）。
7. `test/templates/fake-graph.test.js`（约 203–232 行）：交接包精确键断言从 16 键增加 `instanceId`、`round`、`fromNodeId`、`toNodeId`、`retestRequirement`、`deliveryAttempts`、`pendingAt`、`expiredAt`、`lastError` 九键；只改这一处键集合，不改其余行为断言。
8. 新增用例（不改既有断言）：回合收尾与 `complete` 分支的 CAS 冲突重放一次；`waitForRun` 透传 `STORE_CONFLICT` 失败 outcome；信箱写失败时新会话叠加后按 `idle` + `quarantined` 隔离且节点 `sessionId` 指向新会话。

**新增夹具**

- 交接包校验接缝：在 `src/daemon/server.js` 注册 `test.handoff`（仅 `NODE_ENV=test`，与既有 `test.escalate` 同一门控，生产进程没有该 RPC），并在 `test/fixtures/call-seam.mjs` 增加同名调用入口，参数 `{instanceId, nodeId, edgeKind?, round?, mutate}`；核心按正常边（或 `edgeKind` 指定的 forward/backflow/retest 边、`round` 指定的轮次）构造一张包后、校验前应用 `mutate`（`missing-to` / `no-evidence`（清空 input、previous 与回流缺陷证据）/ `remove-evidence` / `escape-ref` / `hash-mismatch` / `backflow-empty-defects` / `empty-requirements`（清空修改与复测要求）），然后走正式投递路径并返回 `{ok, handoffId, escalationId, edgeKind, snapshot}`；`snapshot` 为校验前该包的深拷贝，供哈希与回流用例断言。生产进程没有该 RPC。
- 升级接缝：扩展既有 `test.escalate`（仍仅 `NODE_ENV=test`），参数增加可选 `reasonCode`（缺省 `execution_failed`，允许 `rounds_exceeded`）与 `artifactRefs`（可选数组；写入被升级节点，供人工 `pass` 后构造合规交接包）。`src/daemon/server.js` 必须把这两个参数转发给 `escalateOnce`；`escalateOnce` 在调用 `escalateState` 前先用一次 CAS 把 `artifactRefs` 写入磁盘上的被升级节点（`commitEscalation` 会重读磁盘，只改内存会丢），`reasonCode` 作为本次升级入参。`test/fixtures/call-seam.mjs` 的参数解析同步增加 `--reason-code` 与 `--artifact-ref`（`--node` 旧用法不变）；AC-24 用 `rounds_exceeded` + `artifactRef` 构造中间节点 `pass`，不改生产路径。
- 投递等待接缝：新增 `test.delivery`（仅 `NODE_ENV=test`），参数 `{instanceId, action: 'hold'|'release'}`；`hold` 让下一次投递重试停在等待点，`release` 放行。AC-61 用它确定性触发"待投递中取消"，不依赖 200ms 窗口。
- 交接包校验：缺字段接缝、`input`/`previous`/缺陷证据全空、文件删除、0 字节、`../` 越界、上一版哈希不符、回流缺缺陷。
- 派发接缝：派发入口必须同时支持"推入草稿"（`advance` 路径）与"引用既有包"（`test.dispatch` 复用 `state.handoffs` 中的包）两种形态；接缝只传 `handoffId`，不得重复推入第二张 `created` 包，也不得为复用包重发 `handoff.created`。`test.dispatch` 现有用例（含 `dispatch-fail-*`）的事件条数与包数保持不变。
- 信箱：首次失败/第二次成功、三次失败、`MAESTRO_FAULT=inbox_write:fail`。
- 状态页：`MAESTRO_FAULT=workspace_status_write:fail`。
- 审批：`--approval hold` + `--permission=ask`，allow/deny/取消。
- 暂停：开发完成、测试未派发的边界；暂停后恢复；暂停落在"包已构造、尚未派发"之间；暂停 + 待审批后取消；待投递中取消。
- 暂停接缝用法：既有 `MAESTRO_TEST_PAUSE` 在实例启动时解析一次、运行中不可改（仅 `NODE_ENV=test` 生效）；不带节点限定（`after_output` / `after_verdict`）时每个回合都停，带 `after_output:<nodeId>` 时只停该节点。每个暂停周期按"删除 `.mock/release`（若有）→ 等 `.mock/paused` 出现 → 执行命令 → 删除 `.mock/paused` → 写 `.mock/release`"推进，避免上一周期遗留的 `release` 让下一周期直接放行。
- 暂停与派发提交的原子性（单元测试，不依赖真实时序）：在 `store.save` 的实例写序列中先排入一次暂停写盘，再用旧快照的期望值执行派发 CAS，断言 `STORE_CONFLICT`、磁盘 `paused === true`、没有新建会话与 `node.dispatch`；另测派发快照 `paused: false` 与磁盘 `paused: true` 冲突。
- 升级裁决：终节点 pass、中间节点 pass、fail、retry 新会话。
- 命令：`instance log/graph`、`attach`、`handoff list/show`、`escalate list`、`workflow`。
- 旧实例：I1.1 v1 快照。
- 架构检查：`test/fixtures/purity-check.mjs` 的 `--forbid` 显式传 11 词并集（I1.2 四词 + I1.3 七词）；AC-56 的命令即基线，不依赖脚本默认的四词表。

**mock 扩展**

- 步字段支持 `promptFailures: n`（前 n 次 `prompt` 返回错误，之后成功）。mock 每次收到 `session/prompt` 都把 `.mock/prompt-attempts-<sessionId>.json` 写为 `{attempts}`（计数在该次 `prompt` 的任何成功/失败/`--host-error` 早返回之前完成）；失败另记 `.mock/prompt-failures-<sessionId>.json`（内容 `{attempts, failures}`）。场景步与单节点 `--host-error` 两种模式都计数：场景模式的 `.mock` 位于场景根；非场景模式（如 `--host-error`）位于 mock 进程 cwd，即宿主 spawn 时传入的任务 `--cwd` 解析后目录（不是项目根），路径为 `<任务目录>/.mock/prompt-attempts-<sessionId>.json`，供 AC-16/17/61/63 断言实际尝试次数。
- 保持原有 12 个 I1.1 开关与 I1.2 / I1.3 场景不变；新字段缺省不改变行为。
- 串行场景数量仍按 I1.3 约束分批 ≤10，避免资源耗尽。

### D-11 架构与零依赖

1. 新增核心模块只接收注入的图数据与状态；不按模板名/角色名分支。
2. 源码字面量扫描取 11 词并集：I1.2 的 `code-loop`、`developer`、`tester`、`coordinator` 与 I1.3 的 `task-loop`、`researcher`、`writer`、`reviewer`、`研究员`、`撰写者`、`审核者`；英文注释也算。`purity-check.mjs` 必须用 `--forbid` 显式传全表（脚本默认表只有 I1.2 四词），不得依赖默认值。
3. `status.md` 的模板名/角色名从图对象 `title` 与节点 `title` 取；核心文案表只含状态/字段名。核心状态词必须与 `src/cli/labels.js` 的状态词逐字一致，测试需加一条对照断言，防止两份文案漂移。
4. `package.json.dependencies` 保持为空；不引入 YAML、模板、CLI 解析库。
5. 所有新文件写到临时路径后 `rename`；`fsync` 口径沿用 `atomic-write.js`。
