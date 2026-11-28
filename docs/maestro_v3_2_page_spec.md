# Maestro V3.2 — 需求驱动的团队与工作流执行控制台

**版本：** V3.2  
**产品形态：** Tauri Desktop + Maestro Daemon  
**视觉方向：** 浅色、简洁、专业工作台  
**核心调整：** 需求/任务成为业务入口；团队和工作流是服务于需求的两类独立可复用资产；团队成员是工作流执行节点的执行者；CLI 只在节点任务实际分配时确定。

---

## 1. V3.2 的核心产品定义

Maestro 的使用起点不是“先建立一个工作流”，而是用户拿到一个新的需求或任务。

用户创建一个需求/任务（Work Item）时，可以：

1. 选择一个已有工作流，也可以为本次需求创建新工作流。
2. 选择一个已有团队，也可以为本次需求创建新团队。
3. 将团队成员映射到工作流中的执行节点。
4. 检查工作流节点是否都有人负责、团队能力是否满足要求。
5. 确认执行方案并创建工作流实例。

**概念分工：**

- **需求/任务（Work Item）：** 本次要完成的业务目标，是一次协作的起点。
- **工作流（Workflow Definition）：** 定义完成需求要经过哪些步骤、节点、依赖和门禁，即“怎么做”。
- **团队（Team Definition）：** 定义由哪些员工组成、各成员能承担哪些角色，即“谁来做”。
- **角色（Role Definition）：** 定义岗位职责、技能、输入输出规范和能力要求。
- **员工（Employee Profile）：** 长期存在的数字员工身份。员工不绑定 CLI，也不固定属于某个团队。
- **团队成员（Team Member）：** 员工在某个团队中的成员关系，以及该员工在该团队中承担的角色资格。
- **节点执行人映射（Node Executor Plan）：** 本次需求中，工作流的每个 Agent 节点具体由哪个团队成员执行。
- **任务级执行分配（Task Assignment）：** 节点真正准备执行时，将具体员工与本机 Agent CLI 绑定到本次任务。
- **员工会话（Employee Session）：** Maestro 为员工维护的逻辑会话身份，在员工第一次真正执行任务时按需创建。
- **宿主会话（Host Session）：** 某个 Agent CLI/Adapter 实际创建或恢复的会话 ID。

### 1.1 必须坚持的隔离规则

| 对象 | 保存什么 | 不保存什么 |
|---|---|---|
| Employee Profile | 员工身份、名称、说明、角色资格、启用状态 | CLI ID、CLI 路径、Team ID、Session ID |
| Role Definition | 岗位职责、技能、输入输出、能力要求、验收标准 | 员工、团队、CLI |
| Team Definition | 团队成员、成员在团队内承担的角色、成员优先级 | Workflow ID、CLI ID、Session ID |
| Workflow Definition | 节点、角色要求、依赖、条件、门禁、交接和失败策略 | Employee ID、Team ID、CLI ID、Session ID |
| Work Item | 需求内容、选用的工作流版本、选用的团队版本、本次节点执行人映射 | 不直接持有宿主会话细节 |
| Task Assignment | 本次节点的 Employee ID、CLI Installation ID、环境和权限快照 | 不修改员工档案或团队定义 |
| Employee Session | 员工逻辑会话身份、会话状态、上下文和检查点引用 | 不作为员工档案字段 |
| Host Session Binding | CLI、Adapter、Host Session ID、恢复能力和兼容性 | 不替代 Employee ID |

---

## 2. 核心对象关系

```text
Employee Profile ─────┐
                      ├── Team Definition (可复用团队)
Role Definition ───────┘       └── Team Members
                                 ├── Employee A + Role(s)
                                 ├── Employee B + Role(s)
                                 └── Employee C + Role(s)

Role Definition ───────── Workflow Definition (可复用工作流)
                              ├── Node A requires Role PM
                              ├── Node B requires Role Architect
                              ├── Node C requires Role Frontend
                              ├── Node D requires Role Backend
                              └── Node E requires Role QA

New Work Item
  ├── Request Content
  ├── Workflow Snapshot + Version
  ├── Team Snapshot + Version
  ├── Node Executor Plan (Workflow Node → Team Member / Employee)
  └── Workflow Run
       ├── Task Instance A
       │    └── Task Assignment (Employee + Agent CLI)
       │         └── Attempt
       │              ├── Employee Session ID
       │              └── Host Session Binding / Host Session ID
       ├── Task Instance B
       └── Handoff / Artifact / Event / Approval
```

### 2.1 关系约束

1. 一个团队可以执行多个不同工作流。
2. 一个工作流可以由多个不同团队执行。
3. 一个需求/任务在创建执行方案时选择一个工作流版本和一个团队版本。
4. 工作流节点通过 Role ID 声明所需岗位，不指定员工。
5. 团队成员通过其在团队中的角色资格，成为工作流节点的候选执行人。
6. 本次需求必须形成明确的 `Node ID → Employee ID` 执行人映射。
7. 任务进入 Ready 后，才创建任务级分配，并选择本次执行的 Agent CLI。
8. 员工档案、团队定义和工作流定义都不持有 CLI 绑定。
9. Work Item 创建时固定所用的 Workflow/Team 版本和节点执行人映射快照，避免库中定义后续修改影响正在执行的需求。
10. 同一个 Work Item 后续如需变更执行方案，应产生新的执行方案修订或新的 Workflow Run，并保留旧记录。

---

## 3. 团队的正确模型

### 3.1 团队是什么

团队是一个可复用的员工组合，不是工作流的附属配置。

团队定义包含：

- Team ID、名称、描述、版本。
- 团队成员列表。
- 每个成员的 Employee ID。
- 成员在该团队中承担的角色资格。
- 成员优先级或主/备关系。
- 成员是否参与新需求分配。
- 可选的容量/并发配置。

团队不包含 `workflowId`，也不包含 CLI 或会话信息。

### 3.2 团队成员与角色

一个团队成员可以承担一个或多个角色。一个角色也可以由团队中的多个成员承担。

例如：

| 团队成员 | 员工 | 团队内角色资格 |
|---|---|---|
| Member A | 小深 | 产品经理、评审专家 |
| Member B | Cursor-架构师 | 架构师、评审专家 |
| Member C | 前端工程师 A | 前端工程师 |
| Member D | 后端工程师 A | 后端工程师 |
| Member E | QA 工程师 A | QA 工程师 |
| Member F | 全栈工程师 B | 前端工程师、后端工程师 |

员工档案中的角色资格表示该员工具备的能力；Team Member 中的角色资格表示该员工在这个团队中被允许承担的岗位。团队角色可以是员工全局资格的子集，不应超过员工已经具备的资格，除非通过明确的能力授权流程。

### 3.3 团队复用

团队库允许：
- 创建团队。
- 编辑成员。
- 调整成员承担的角色。
- 添加或移除成员。
- 设置主成员和备选成员。
- 复制团队。
- 发布新版本。
- 停用团队。

同一个团队可以在需求 A 选择完整研发工作流，也可以在需求 B 选择 PRD 评审工作流。团队本身不需要知道自己将执行哪个工作流。

### 3.4 新建团队的来源

创建需求时允许快速新建团队：

- 从员工档案中勾选成员。
- 显示每个员工具备的角色。
- 选择其在本团队中承担的角色。
- 检查团队成员是否覆盖本次工作流的角色要求。
- 可选择“保存到团队库供后续复用”或“仅用于本次需求”。

---

## 4. 工作流的正确模型

### 4.1 工作流是什么

工作流是可复用的协作方法定义，回答“需求应该如何完成”。

工作流包含：
- Workflow ID、名称、描述、版本。
- 节点 DAG。
- 每个 Agent 节点的 Role ID 要求。
- 输入/输出契约。
- 节点验收条件。
- 节点间依赖。
- 并行分支和汇合规则。
- 条件分支。
- Human Task 和 Approval Gate。
- Handoff 契约。
- Retry、Fallback、Escalation 和 Failure Policy。

工作流不配置具体员工、团队和 Agent CLI。

### 4.2 Agent 节点定义

每个 Agent 节点至少需要：

- Node ID。
- 节点名称。
- Role ID。
- 任务说明/指令模板。
- 输入契约。
- 输出契约。
- 前置依赖。
- 执行能力要求。
- 验收条件。
- 超时策略。
- 失败策略。

### 4.3 人工节点

人工审批、人工补充输入、最终验收等应定义为 Human Task 或 Approval Gate。

人工节点没有 Employee Agent 执行人，不进行 Agent CLI 分配，也不创建 Employee Session。

### 4.4 工作流复用

用户可以：
- 从内置模板选择。
- 从工作流库选择已有工作流。
- 复制既有工作流后修改。
- 在新需求流程中直接创建新工作流。
- 选择“只用于本次需求”或“发布到工作流库”。

工作流修改产生新版本。已启动的需求继续引用原版本。

---

## 5. 需求/任务（Work Item）是主入口

### 5.1 Work Item 定义

Work Item 表示用户希望团队完成的一项业务需求、项目任务或交付事项。

字段：
- Work Item ID。
- 标题。
- 需求描述。
- 背景与目标。
- 项目/工作空间。
- 输入附件和参考资料。
- 优先级。
- 创建人和创建时间。
- Workflow Definition 快照及版本。
- Team Definition 快照及版本。
- Node Executor Plan。
- 当前 Workflow Run。
- 历史 Workflow Runs。
- Work Item 状态。

### 5.2 一个需求如何选择工作流和团队

创建需求时必须独立选择：

**工作流选择：**
- 选择已有工作流。
- 为本次需求创建新的工作流。
- 新建工作流可以只作用于当前需求，也可以保存为工作流库资产。

**团队选择：**
- 选择已有团队。
- 为本次需求创建新团队。
- 新建团队可以只作用于当前需求，也可以保存到团队库。

四种组合都必须支持：

| 工作流 | 团队 | 场景 |
|---|---|---|
| 已有 | 已有 | 最快启动，复用成熟方案 |
| 已有 | 新建 | 流程成熟，但本次需求需要新团队 |
| 新建 | 已有 | 现有团队处理新类型需求 |
| 新建 | 新建 | 完全新的需求和协作模式 |

### 5.3 需求创建向导

建议分为五步：

1. 需求信息。
2. 选择/创建工作流。
3. 选择/创建团队。
4. 节点执行人映射。
5. 运行前检查与确认。

创建完成后，Work Item 与 Workflow Run 建立关系；员工会话和 CLI 绑定都尚未创建。

---

## 6. 节点执行人映射

这是团队和工作流真正组合起来的地方。

### 6.1 为什么需要独立映射

工作流只知道节点需要哪个角色；团队包含多名员工。两者组合时必须明确本次需求由谁执行每个节点。

因此需要 `Node Executor Plan`：

```text
Work Item Execution Plan
  Workflow Node N-PM      → Team Member A / Employee EMP-001
  Workflow Node N-ARCH    → Team Member B / Employee EMP-002
  Workflow Node N-FE      → Team Member C / Employee EMP-003
  Workflow Node N-BE      → Team Member D / Employee EMP-004
  Workflow Node N-QA      → Team Member E / Employee EMP-005
  Workflow Node N-ACCEPT  → Human Approver
```

该映射属于本次 Work Item 执行方案，不写回工作流定义，也不写回团队定义。

### 6.2 自动匹配与人工调整

系统根据工作流节点的 Role ID，从本次团队成员中筛选匹配成员。

规则：
- 只有团队成员可以成为本次工作流节点的执行人。
- 成员必须在团队中具备节点要求的角色资格。
- 如果存在一个候选人，可以自动预选。
- 如果存在多个候选人，按团队优先级预选，并允许用户修改。
- 如果没有候选人，阻止确认执行方案，提示添加团队成员或调整角色资格。
- 人工节点不需要员工映射。

### 6.3 并行节点和同一员工冲突

同一个员工可以承担多个节点，但默认一个员工同一时间只执行一个前台任务。

如果两个并行节点被映射给同一个员工：
- 显示“同一员工将串行处理这两个节点”的提示。
- 允许用户改派另一个团队成员。
- 如果用户确认保留，Scheduler 在执行时将其中一个节点排队。
- 不允许默认并发写入同一个 Employee Session。

### 6.4 节点执行人替换

在节点尚未启动前，用户可以在本次 Work Item 中修改执行人映射。

任务已运行后：
- 不允许悄悄覆盖当前 Attempt 的执行者。
- 可以中断/结束当前 Attempt，再创建新的 Task Assignment。
- 如果更换员工，必须明确选择新员工是否继承检查点和产物上下文。
- 已完成节点的历史执行者保持不变。

---

## 7. Agent CLI 与任务分配

### 7.1 CLI 不归员工或团队所有

Agent CLI 是本机执行资源池中的安装实例。一个员工可以在不同节点任务中使用不同 CLI；不同员工也可以在不同任务中使用同一个 CLI。

本机启动首先扫描 CLI：
- 名称。
- 路径。
- 版本。
- Adapter/协议。
- 能力声明。
- 健康状态。
- 认证状态。
- 会话恢复能力。

扫描只更新 CLI 资源池，不创建员工、不创建团队、不创建会话。

### 7.2 CLI 选择发生在节点任务级

Node Executor Plan 确定该节点由哪个团队成员执行。

节点进入 Ready 后，进入 Task Assignment：
- 员工默认使用 Node Executor Plan 中的成员。
- 用户可在团队中选择符合角色要求的其他成员。
- 选择本次任务使用的 CLI。
- 设置工作目录和必要权限。
- 检查 CLI 能力和健康状态。
- 保存为 Prepared 或直接启动。

Task Assignment 保存：
- Assignment ID。
- Workflow Run ID。
- Task ID / Node ID。
- Employee ID。
- CLI Installation ID。
- CLI Fingerprint。
- Adapter 版本。
- 工作目录。
- 输入产物引用。
- 权限快照。
- Assignment 状态。

### 7.3 Prepared 与 Locked

- `Draft`：尚未选择员工或 CLI。
- `Prepared`：已选择员工和 CLI，尚未创建/唤醒宿主会话。可以修改员工和 CLI。
- `Preflight`：执行启动检查。
- `Locked`：开始创建/唤醒 Host Session，本次执行的员工、CLI 和环境快照固定。
- `Released`：分配结束并释放资源。
- `Failed`：启动或分配失败。

保存 Prepared 不创建 Employee Session 和 Host Session。

---

## 8. 员工会话生命周期

### 8.1 员工档案不创建会话

创建 Employee Profile 只生成 Employee ID。

将员工加入团队，不创建会话。

创建 Work Item，不创建会话。

选择团队和工作流，不创建会话。

保存 Node Executor Plan，不创建会话。

保存 Task Assignment Prepared，不创建会话。

只有节点真正开始执行时才按需创建或唤醒会话。

### 8.2 两层会话身份

**Employee Session ID：** Maestro 维护的员工逻辑会话身份。代表这个数字员工长期工作的身份上下文。

**Host Session ID：** Agent CLI/宿主实际创建的会话 ID。必须按 CLI/Adapter 映射维护。

同一个员工的逻辑身份保持稳定；不同 CLI 可能分别拥有不同 Host Session ID。

### 8.3 会话创建/复用

当节点启动时：

1. 读取执行员工。
2. 检查是否已经有 Employee Session。
3. 没有则创建 Employee Session ID。
4. 根据本次任务的 CLI 查询对应 Host Session Binding。
5. 如果有兼容且可恢复的 Host Session，则尝试唤醒/恢复。
6. 如果不存在或失效，则创建新的 Host Session Binding。
7. 记录 Host Session ID。
8. 创建 Attempt 并执行任务。

### 8.4 同一员工的并发

第一阶段默认同一员工串行执行。员工若正在一个工作流中执行任务，其他 Work Item 不能同时写入该员工同一个逻辑会话。

调度策略：
- 等待员工释放。
- 使用团队中的备选成员。
- 用户手动改派。

后续如支持并行，需要引入隔离的子会话和明确的上下文边界。

---

## 9. 中断与恢复

任务中断后，必须保留：
- Work Item ID。
- Workflow Run ID。
- Task ID。
- Assignment ID。
- Employee ID。
- CLI Installation ID 和 Fingerprint。
- Employee Session ID。
- Host Session ID。
- Attempt ID。
- 最后活动事件。
- 检查点和已生成产物。

恢复方式：

**A. 恢复原宿主会话**
- 选择原 CLI。
- 检查原 Host Session 是否还存在、是否兼容、是否支持恢复。
- 如果成功，继续原 Attempt。

**B. 通过检查点恢复**
- 允许选择另一 CLI。
- 沿用 Employee Session ID。
- 在新 CLI 下创建新的 Host Session Binding。
- 创建新的 Attempt，并关联 `Resumed From Attempt ID`。
- 将检查点和 Artifact References 作为恢复上下文。

跨 CLI 不直接复用 Host Session ID。

恢复失败时必须保持中断状态，允许继续诊断或重新分配，不得伪造恢复成功。

---

## 10. 四条核心用户操作链路

### 链路 A：新需求选择现有团队和工作流

1. 用户进入“需求 / 任务”。
2. 点击“新建需求 / 任务”。
3. 输入标题、背景、目标和附件。
4. 选择已有工作流。
5. 选择已有团队。
6. 系统检查工作流节点的角色需求是否被团队成员覆盖。
7. 系统预选每个节点执行人。
8. 用户调整节点执行人映射。
9. 系统检查并行节点是否重复使用同一员工。
10. 用户确认执行方案。
11. 创建 Work Item 和 Workflow Run。
12. 只创建任务 DAG，不启动员工、不分配 CLI、不创建会话。

### 链路 B：新需求创建新团队和新工作流

1. 用户创建 Work Item。
2. 在工作流选择中选择“新建工作流”。
3. 定义节点、角色要求、依赖和人工门禁。
4. 选择保存到工作流库，或仅用于本次需求。
5. 在团队选择中选择“新建团队”。
6. 从员工档案中添加成员并设置团队内角色。
7. 选择保存到团队库，或仅用于本次需求。
8. 生成节点执行人映射。
9. 检查覆盖和并发冲突。
10. 创建执行方案和 Workflow Run。

### 链路 C：节点就绪后执行

1. 上游依赖完成，节点进入 Ready。
2. Scheduler 读取 Work Item 的节点执行人映射。
3. 检查团队成员是否仍然启用、是否空闲。
4. 用户确认或自动确定执行员工。
5. 从本机 Agent CLI 资源池选择满足节点能力要求的 CLI。
6. 创建 Task Assignment Prepared。
7. 用户可以修改员工或 CLI。
8. 用户启动任务。
9. Assignment 锁定。
10. 按需创建/唤醒 Employee Session 和 Host Session。
11. 创建 Attempt。
12. 展示员工当前活动、公开工具事件和产物。
13. 任务完成后验收输出，推进下游依赖。

### 链路 D：执行异常与恢复

1. Agent/Host 中断或任务执行失败。
2. 保存 Attempt、日志、会话映射和检查点。
3. Task 标记 Interrupted 或 Failed。
4. 用户查看当前员工、CLI、Host Session、错误和恢复能力。
5. 选择恢复原 Host Session，或更换 CLI/员工并通过检查点恢复。
6. 新建或继续 Attempt。
7. 任务重新进入执行。
8. 完成后重新触发依赖检查。

---

## 11. 信息架构与导航

| 一级导航 | 页面 | 核心问题 |
|---|---|---|
| 启动与资源 | 本机 Agent CLI 扫描 | 当前本机有哪些可用执行工具？ |
| 需求工作台 | 需求/任务列表、创建向导、需求详情 | 我要完成什么？选什么团队和工作流？ |
| 执行中心 | 执行实例、流程视图、任务视图、事件时间线 | 当前团队执行到哪里？每个节点是谁在做？ |
| 团队库 | 团队列表、团队编辑器、团队版本 | 哪些员工组成了可复用团队？ |
| 工作流库 | 工作流列表、工作流编辑器、版本管理 | 有哪些可复用执行流程？ |
| 员工档案 | 员工列表、员工详情、员工会话历史 | 有哪些数字员工，具备什么角色资格？ |
| 角色库 | 角色列表、角色详情 | 岗位职责和能力要求是什么？ |
| 产物与事件 | 产物、Handoff、事件、审计 | 执行结果和历史证据在哪里？ |
| 系统设置 | Daemon、扫描、调度、权限策略 | 本机执行环境如何治理？ |

---

## 12. 页面规格

### P00 本机 Agent CLI 扫描

- 系统打开后的第一入口。
- 展示扫描进度、发现数量、可用数量、异常数量。
- 展示 CLI 名称、路径、版本、协议/Adapter、能力和健康状态。
- 扫描结果只进入本机执行资源池，不创建员工、团队或会话。
- 支持重新扫描、完整扫描、手动添加路径和健康检查。

### P01 需求/任务工作台

- 展示需求数量、执行中、待人工处理、待验收。
- 列表展示标题、关联工作流、关联团队、状态和创建时间。
- 用户从这里创建新需求或打开既有需求。
- 需求详情中显示本次工作流和团队版本快照。

### P02 新建需求向导

五步：

1. 需求信息：标题、描述、背景、目标、项目目录、附件。
2. 工作流：选已有或新建；新建可保存到库或仅用于本次需求。
3. 团队：选已有或新建；新建可保存到库或仅用于本次需求。
4. 节点执行人映射：每个 Agent 节点从团队成员中选择执行者；Human 节点不分配员工。
5. 预检确认：检查覆盖、员工有效性、并行冲突、CLI 资源池能力和输入资料。

### P03 需求详情

展示：
- 需求内容。
- 使用的 Workflow Snapshot。
- 使用的 Team Snapshot。
- Node Executor Plan。
- 当前和历史 Workflow Run。
- 产物和事件。

提供流程视图、节点列表和执行历史入口。

### P04 团队库

团队卡片展示：
- 团队名称、版本和说明。
- 成员数量。
- 角色覆盖范围。
- 成员列表及其在团队中的角色。
- 最近使用的 Work Item。

不显示适用工作流字段，不提供 CLI 配置。

### P05 团队编辑器

- 设置团队名称和描述。
- 从员工档案选择成员。
- 为每个成员选择团队内角色资格。
- 支持主成员、备用成员和优先级。
- 保存产生新版本。
- 不选择工作流，不选择 CLI，不创建会话。

### P06 工作流库

工作流卡片展示：
- 名称、版本、用途。
- 节点数量。
- Agent 节点与人工节点数量。
- 主要阶段和并行关系。
- 是否内置、草稿或已发布。

提供编辑、复制、发布新版本和用于新需求。

### P07 工作流编辑器

- 画布定义节点 DAG。
- Agent 节点选择 Role Definition。
- Human 节点定义审批人/人工处理条件。
- 配置依赖、并行、汇合、条件、输入输出、验收和失败策略。
- 不指定具体 Employee ID、Team ID 或 CLI。

### P08 员工档案

- 员工名称、Employee ID、说明、角色资格、启用状态。
- 显示员工加入哪些团队（只读汇总）。
- 显示当前执行任务和会话是否已创建（运行态信息）。
- 不允许在员工档案中绑定 CLI 或团队。

### P09 角色库

- 角色职责、技能、输入输出契约、能力要求和验收规则。
- 工作流节点引用角色。
- 员工档案定义可承担资格。
- 团队成员定义在团队内实际承担的角色范围。

### P10 执行中心

- 工作流 Run 列表。
- 关联 Work Item、Workflow 版本和 Team 版本。
- 当前状态、完成率、Ready 节点、执行中节点、中断节点和人工待处理数量。

### P11 工作流执行视图

主视图按工作流节点展示：
- 节点名称。
- Role 要求。
- 本次团队执行成员。
- 实际执行员工。
- 任务状态。
- CLI（完成 Task Assignment 后才显示）。
- 员工会话状态（创建后才显示）。
- 最近活动。

同时提供任务表格和事件时间线。

### P12 节点分配面板

- 展示节点角色要求。
- 展示本次团队中符合要求的成员。
- 默认选中 Node Executor Plan 中的成员。
- 展示本机可用 CLI 候选及其能力。
- 展示会话计划：创建、复用、唤醒或恢复。
- 支持保存 Prepared 和保存并启动。
- Prepared 阶段可以修改员工和 CLI；启动会话后本次 Assignment 锁定。

### P13 员工执行活动面板

- 员工身份、所属团队/角色、当前 Work Item、节点、CLI。
- Employee Session ID 和 Host Session ID（存在时才显示）。
- 当前 Attempt、开始时间、运行时长、最近活动。
- 展示宿主公开的状态事件、工具事件、文件操作、命令事件和产物摘要。
- 不展示 Agent 私有推理过程。

### P14 任务和会话详情

- Task ID、Node ID、Role、计划执行人、实际执行人。
- Task Assignment 历史。
- Attempt 历史。
- Employee Session ID。
- Host Session Binding 历史。
- 输出产物、Handoff 和错误证据。

### P15 中断恢复

- 明确区分恢复原宿主会话与使用检查点重建会话。
- 展示原 CLI、Host Session ID、恢复能力、最后活动和检查点。
- 跨 CLI 恢复建立新的 Host Session Binding 和新的 Attempt。
- 保留原员工身份和 Employee Session ID。

### P16 产物与事件

- Artifact 可追踪到 Work Item、Workflow Run、Task、Employee、CLI、Attempt 和 Handoff。
- 事件记录团队/工作流版本、节点映射、Task Assignment、会话创建和恢复。
- 人工审批、异常恢复和交付验收必须留下审计事件。

---

## 13. 状态及业务规则

### 13.1 Work Item

`draft → configured → ready_to_run → running → waiting_human / blocked → ready_for_acceptance → accepted → delivered`

也可能进入 `cancelled`。

### 13.2 Team Definition

`draft → published → deprecated`

修改团队成员和角色形成新版本。已创建的 Work Item 使用快照。

### 13.3 Workflow Definition

`draft → published → deprecated`

修改节点、依赖和规则形成新版本。已创建的 Work Item 使用快照。

### 13.4 Node Task

`waiting_dependency → ready → assignment_prepared → preflight → creating_session → running → succeeded`

异常分支：`interrupted / blocked / failed / cancelled / skipped`。

### 13.5 Assignment

`draft → prepared → preflight → locked → released`

或进入 `failed`。

### 13.6 员工会话

Employee Session ID 是按员工逻辑身份维护的长期标识。

Host Session Binding 按 CLI/Adapter 维护，不跨 CLI 直接复用 Host Session ID。

---

## 14. 重要异常边界

1. 团队没有覆盖某个工作流节点所需角色：不允许确认执行方案，提示缺少哪些岗位成员。
2. 一个员工被分配到并行节点：提示串行执行影响，可改派或接受排队。
3. 团队成员被停用：未启动节点需要重新映射；运行中节点按中断和恢复策略处理。
4. 团队定义被修改：现有 Work Item 快照不自动变化。
5. 工作流定义被修改：现有 Run 继续使用旧版本。
6. CLI 在任务启动前失效：Assignment 保持可编辑，不创建 Session。
7. CLI 在运行中断连：保留 Attempt 和 Host Session 引用，进入恢复流程。
8. 员工已在其他 Work Item 执行：按串行策略排队、改派或等待。
9. 新建团队/工作流选择“仅本次需求”：保存 Work Item Snapshot，不进入公共资产库。
10. 新建团队/工作流选择“保存到库”：先创建可复用资产版本，再在本次 Work Item 中引用该版本。

---

## 15. V3.2 原型覆盖范围

本版 HTML 原型覆盖：

- 启动扫描页。
- 需求/任务列表。
- 新建需求四步向导。
- 已有/新建工作流选择。
- 已有/新建团队选择。
- 团队成员选择。
- Workflow Node → Team Member 执行人映射。
- 团队库与团队编辑器。
- 工作流库与工作流节点编辑器。
- 员工档案。
- 执行中心。
- 工作流节点执行视图。
- 节点任务级 Employee + CLI 分配。
- Prepared 后可修改、启动后锁定。
- Employee Session / Host Session 详情。
- 节点完成后依赖解锁。
- 中断和恢复演示。
- 人工节点批准演示。
- 事件时间线。

原型使用本地模拟数据，不会真实扫描本机 CLI、连接 Daemon、启动 Agent 或调用 ACP。页面中“模拟完成”“模拟中断”等操作只用于演示状态变化。

---

## 16. 验收用例

| ID | 场景 | 通过标准 |
|---|---|---|
| V32-01 | 新建需求，选已有工作流和已有团队 | Work Item 同时绑定二者，二者之间没有固定关联字段 |
| V32-02 | 新建需求，创建新工作流和新团队 | 两项都可选择仅用于本次或保存到库 |
| V32-03 | 团队被多个工作流复用 | 团队定义不需要记录 Workflow ID |
| V32-04 | 工作流被多个团队复用 | 工作流定义不需要记录 Team ID 或 Employee ID |
| V32-05 | 工作流节点匹配团队成员 | 每个 Agent 节点映射一个符合 Role 要求的团队成员 |
| V32-06 | 团队缺少角色覆盖 | 执行方案不能通过预检，并说明缺少的角色 |
| V32-07 | 同一员工分配并行节点 | 显示串行/排队提示，不允许同一会话并发写入 |
| V32-08 | 创建 Work Item | 只创建需求、版本快照、执行人映射和 Run/Task，不创建 CLI 分配和 Session |
| V32-09 | 节点 Ready | 从本次团队中选执行员工，再选择本机 CLI |
| V32-10 | 保存 Prepared | 员工和 CLI 已记录，但员工会话仍未创建；允许修改 |
| V32-11 | 启动节点 | 锁定 Assignment，按需创建/复用员工会话和 Host Session |
| V32-12 | 员工更换 CLI | 不修改员工档案和团队；仅新任务 Assignment 选择新 CLI |
| V32-13 | 中断后恢复原宿主 | 宿主支持且会话存在时可继续原 Attempt |
| V32-14 | 跨 CLI 检查点恢复 | 创建新 Host Session Binding 和新 Attempt，保留 Employee Session ID |
| V32-15 | 修改团队或工作流资产 | 已有 Work Item 继续使用原快照 |
| V32-16 | 人工节点 | 不分配员工，不分配 CLI，不创建 Employee Session |
| V32-17 | 交付验收 | 所有产物、测试、风险和人工验收记录可追溯 |

---

## 17. 最终设计结论

Maestro 的业务主线是：

**用户提出需求/任务 → 选择或创建工作流 → 选择或创建团队 → 团队成员映射到工作流节点 → 创建本次执行方案 → 节点按依赖进入 Ready → 任务级分配员工与 Agent CLI → 按需创建/唤醒员工会话 → 执行与交接 → 异常恢复/缺陷回流 → 最终验收交付。**

团队回答“谁来做”，工作流回答“怎么做”，需求/任务决定“这一次要做什么”。

团队和工作流都是可复用、可维护的长期资产，但它们的组合关系属于具体需求的执行方案，不应把团队永久绑定到某个工作流。

团队成员就是本次工作流节点的执行者；CLI 是节点真正执行时选择的本机执行工具；会话是员工工作过程中按需创建和维护的运行资源。
