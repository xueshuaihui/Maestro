这次提供 **Maestro V3.2 完整交付版**，包含完整可交互原型和完整页面规格书，不再只展示调整摘要。

**Maestro V3.2 完整交付**

文件已生成

**完整可交互原型**

打开或下载 Maestro V3.2 原型 HTML

包含需求创建、团队选择与创建、工作流选择与创建、节点执行人映射、任务级 CLI 分配、执行监控、会话和恢复等交互。

**完整页面规格书**

下载 Maestro V3.2 完整规格书（Markdown）

包含业务对象模型、对象关系、信息架构、页面规格、状态机、四条核心操作链路、异常处理和 17 项验收用例。

## **一、完整版本的核心业务模型**

本版的业务关系固定为：

**Work Item — 需求 / 任务**

用户提出的本次业务目标。

**Workflow — 工作流**

定义执行步骤、节点、依赖和验收。

**Team — 团队**

定义团队成员及成员的角色资格。

**Node Executor Plan — 本次节点执行人映射**

将工作流节点映射给团队中的具体员工。

**Task Assignment — 节点任务分配**

任务就绪后，确定执行员工和本机 Agent CLI。

**Employee Session + Host Session**

按需创建、复用、唤醒或恢复会话。

## **二、完整页面目录**

| 页面编号 | 页面名称            | 核心功能                   |
| ---- | --------------- | ---------------------- |
| P00  | 本机 Agent CLI 扫描 | 启动时扫描本机 CLI            |
| P01  | 需求/任务工作台        | 查看和管理需求                |
| P02  | 新建需求向导          | 选择或创建团队、工作流            |
| P03  | 需求详情            | 查看需求执行方案和历史            |
| P04  | 团队库             | 管理可复用团队                |
| P05  | 团队编辑器           | 维护团队成员和角色资格            |
| P06  | 工作流库            | 管理可复用工作流               |
| P07  | 工作流编辑器          | 设计节点 DAG               |
| P08  | 员工档案            | 管理数字员工                 |
| P09  | 角色库             | 管理岗位职责和能力要求            |
| P10  | 执行中心            | 管理工作流实例                |
| P11  | 工作流执行视图         | 观察节点、员工和执行状态           |
| P12  | 节点分配面板          | 分配员工和 Agent CLI        |
| P13  | 员工执行活动面板        | 查看员工当前具体活动             |
| P14  | 任务和会话详情         | 查看 Attempt、Session 和产物 |
| P15  | 中断恢复            | 恢复原会话或通过检查点恢复          |
| P16  | 产物与事件           | 管理交付产物和审计事件            |

## **三、四条核心操作链路**

1. **已有团队 + 已有工作流：** 创建需求 → 选择资产 → 自动匹配员工 → 调整节点执行人 → 创建执行实例。
2. **新建团队 + 新建工作流：** 创建需求 → 定义工作流 → 组建团队 → 映射执行人 → 保存资产或仅用于本次需求。
3. **节点执行：** 任务 Ready → 确定员工 → 选择 CLI → 保存待启动分配 → 启动 → 按需创建/唤醒会话 → 监控执行。
4. **异常恢复：** 任务中断 → 查看执行记录 → 恢复原宿主会话或切换 CLI → 检查点恢复 → 继续工作流。

## **四、完整页面规格书正文**

以下是完整规格书的正文版本，下载文件与此处内容对应。

# Maestro V3.2 — 需求驱动的团队与工作流执行控制台

**版本：** V3.2\
**产品形态：** Tauri Desktop + Maestro Daemon\
**视觉方向：** 浅色、简洁、专业工作台\
**核心调整：** 需求/任务成为业务入口；团队和工作流是服务于需求的两类独立可复用资产；团队成员是工作流执行节点的执行者；CLI 只在节点任务实际分配时确定。

---

# 1. 核心产品定义

Maestro 的使用起点是用户收到一个新的需求或任务。

用户创建 Work Item 时，可以：

1. 选择已有工作流，也可以创建新的工作流。
2. 选择已有团队，也可以创建新的团队。
3. 将团队成员映射到工作流中的执行节点。
4. 检查工作流节点是否有人负责、团队能力是否满足要求。
5. 确认执行方案并创建工作流实例。

## 1.1 核心对象

- **Work Item：** 本次要完成的业务目标。
- **Workflow Definition：** 定义怎么做，包括节点、依赖、门禁和交接。
- **Team Definition：** 定义谁来做，包括团队成员和成员角色。
- **Role Definition：** 定义岗位职责、技能、输入输出和能力要求。
- **Employee Profile：** 长期存在的数字员工身份，不绑定 CLI，也不固定属于某个团队。
- **Team Member：** 员工在某个团队中的成员关系及角色资格。
- **Node Executor Plan：** 本次需求中，每个工作流节点具体由哪个员工执行。
- **Task Assignment：** 节点真正执行前，确定本次执行员工和 Agent CLI。
- **Employee Session：** Maestro 维护的员工逻辑会话身份。
- **Host Session：** 某个 Agent CLI/Adapter 实际创建或恢复的会话。

## 1.2 对象隔离规则

| 对象                   | 保存什么                             | 不保存什么                   |
| -------------------- | -------------------------------- | ----------------------- |
| Employee Profile     | 员工身份、名称、说明、角色资格、启用状态             | CLI、Team ID、Session ID  |
| Role Definition      | 岗位职责、技能、输入输出、能力要求、验收标准           | 员工、团队、CLI               |
| Team Definition      | 团队成员、成员角色、成员优先级                  | Workflow ID、CLI、Session |
| Workflow Definition  | 节点、角色要求、依赖、条件、门禁、交接              | Employee ID、Team ID、CLI |
| Work Item            | 需求内容、工作流快照、团队快照、执行人映射            | 宿主会话细节                  |
| Task Assignment      | 本次 Employee、CLI、环境和权限快照          | 员工档案或团队定义修改             |
| Employee Session     | 员工逻辑身份、会话状态、上下文和检查点              | 员工档案属性                  |
| Host Session Binding | CLI、Adapter、Host Session ID、恢复能力 | 员工身份本身                  |

---

# 2. 核心对象关系

```
Employee Profile
  ├── Employee A
  ├── Employee B
  └── Employee C

Role Definition
  ├── Product Manager
  ├── Architect
  ├── Frontend Engineer
  ├── Backend Engineer
  └── QA

Employee + Role
  └── Team Definition
       ├── Team Member A
       ├── Team Member B
       └── Team Member C

Role Definition
  └── Workflow Definition
       ├── Node A requires Product Manager
       ├── Node B requires Architect
       ├── Node C requires Frontend
       ├── Node D requires Backend
       └── Node E requires QA

Work Item
  ├── Request Content
  ├── Workflow Snapshot + Version
  ├── Team Snapshot + Version
  ├── Node Executor Plan
  └── Workflow Run
       ├── Task Instance
       │    └── Task Assignment
       │         ├── Employee
       │         ├── Agent CLI
       │         └── Attempt
       │              ├── Employee Session ID
       │              └── Host Session Binding
       └── Artifact / Handoff / Event / Approval
```

关系约束：

1. 一个团队可以执行多个不同工作流。
2. 一个工作流可以由多个不同团队执行。
3. 一个需求选择一个工作流版本和一个团队版本。
4. 工作流节点只声明所需角色，不指定员工。
5. 团队成员通过角色资格成为节点候选执行人。
6. 本次需求必须形成明确的 Node ID → Employee ID 映射。
7. 任务进入 Ready 后才选择 CLI。
8. 员工、团队和工作流定义都不持有 CLI 绑定。
9. Work Item 创建时固定资产版本和节点执行人映射快照。
10. 后续变更执行方案必须留下修订历史，不覆盖既有执行记录。

---

# 3. 团队模型

团队是可复用的员工组合，不是工作流的附属配置。

团队包含：

- Team ID、名称、描述、版本。
- 团队成员列表。
- 每个成员的 Employee ID。
- 成员在团队中承担的角色资格。
- 成员优先级或主备关系。
- 成员是否参与新需求分配。
- 可选容量和并发配置。

团队不包含 Workflow ID、CLI ID 或 Session ID。

一个团队成员可以承担多个角色，一个角色也可以由多个成员承担。

例如：

| 团队成员 | 员工         | 团队内角色资格     |
| ---- | ---------- | ----------- |
| A    | 小深         | 产品经理、评审专家   |
| B    | Cursor-架构师 | 架构师、评审专家    |
| C    | 前端工程师 A    | 前端工程师       |
| D    | 后端工程师 A    | 后端工程师       |
| E    | QA 工程师 A   | QA 工程师      |
| F    | 全栈工程师 B    | 前端工程师、后端工程师 |

员工档案的角色资格表示员工具备的能力；Team Member 的角色资格表示员工在这个团队中被允许承担的岗位。

团队库支持：

- 创建、编辑和复制团队。
- 添加、移除成员。
- 调整成员角色。
- 设置主成员、备用成员和优先级。
- 发布新版本。
- 停用团队。

新建团队时，用户可以从员工档案选择成员、设置团队内角色，并选择保存到团队库或仅用于本次需求。

---

# 4. 工作流模型

工作流是可复用的协作方法定义，回答“需求应该如何完成”。

包含：

- Workflow ID、名称、描述、版本。
- 节点 DAG。
- 每个 Agent 节点的 Role ID 要求。
- 输入输出契约。
- 节点验收条件。
- 节点依赖。
- 并行和汇合规则。
- 条件分支。
- Human Task 和 Approval Gate。
- Handoff 契约。
- Retry、Fallback、Escalation 和 Failure Policy。

工作流不配置具体员工、团队或 Agent CLI。

每个 Agent 节点至少定义：

- Node ID。
- 节点名称。
- Role ID。
- 任务说明和指令模板。
- 输入输出契约。
- 前置依赖。
- 执行能力要求。
- 验收条件。
- 超时策略。
- 失败策略。

人工审批、人工补充输入和最终验收定义为 Human Task 或 Approval Gate，不分配 Agent CLI，也不创建 Employee Session。

工作流支持：

- 从内置模板创建。
- 选择已有工作流。
- 复制已有工作流后修改。
- 在新需求中直接创建。
- 仅用于本次需求或发布到工作流库。

修改工作流产生新版本，已启动需求继续引用原版本。

---

# 5. Work Item：需求/任务主入口

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
- Workflow Snapshot 和版本。
- Team Snapshot 和版本。
- Node Executor Plan。
- 当前 Workflow Run。
- 历史 Workflow Runs。
- Work Item 状态。

## 5.1 工作流和团队的选择组合

| 工作流 | 团队 | 场景              |
| --- | -- | --------------- |
| 已有  | 已有 | 复用成熟流程和团队       |
| 已有  | 新建 | 流程成熟，但本次需求需要新团队 |
| 新建  | 已有 | 现有团队处理新类型需求     |
| 新建  | 新建 | 完全新的需求和协作模式     |

## 5.2 创建向导

分为五步：

1. 需求信息。
2. 选择或创建工作流。
3. 选择或创建团队。
4. 节点执行人映射。
5. 运行前检查与确认。

创建完成后，Work Item 与 Workflow Run 建立关系；员工会话和 CLI 绑定都尚未创建。

---

# 6. 节点执行人映射

工作流只知道节点需要什么角色；团队包含多名员工。两者组合时必须明确本次需求由谁执行每个节点。

例如：

```
Node PM       → Team Member A / Employee EMP-001
Node Architect → Team Member B / Employee EMP-002
Node Frontend  → Team Member C / Employee EMP-003
Node Backend   → Team Member D / Employee EMP-004
Node QA        → Team Member E / Employee EMP-005
Node Acceptance → Human Approver
```

映射属于本次 Work Item 执行方案，不写回工作流定义，也不写回团队定义。

系统根据工作流节点的 Role ID，从本次团队成员中筛选匹配员工：

- 只有团队成员可以成为本次节点执行人。
- 成员必须具备节点要求的角色资格。
- 唯一候选人可以自动预选。
- 多个候选人按团队优先级预选，并允许用户修改。
- 没有候选人时阻止确认，提示添加成员或调整角色资格。
- 人工节点不需要员工映射。

同一员工可以承担多个节点，但默认一个员工同一时间只执行一个前台任务。

如果两个并行节点映射给同一员工：

- 提示将串行处理。
- 允许用户改派。
- 如果保留，Scheduler 将其中一个节点排队。
- 不允许默认并发写入同一个 Employee Session。

节点尚未启动前可以修改执行人。任务已运行后，不能覆盖当前 Attempt 的执行者；必须结束或中断后创建新分配，并保留历史。

---

# 7. Agent CLI 与任务分配

Agent CLI 是本机执行资源，不属于员工或团队。

本机启动扫描：

- 名称。
- 路径。
- 版本。
- Adapter/协议。
- 能力声明。
- 健康状态。
- 认证状态。
- 会话恢复能力。

扫描只更新 CLI 资源池，不创建员工、团队或会话。

节点进入 Ready 后，进入 Task Assignment：

- 员工默认来自 Node Executor Plan。
- 用户可在团队中选择其他符合角色要求的成员。
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

状态：

- Draft：尚未完成选择。
- Prepared：员工和 CLI 已选，尚未创建或唤醒会话。
- Preflight：启动预检查。
- Locked：开始创建或唤醒 Host Session，执行配置固定。
- Released：分配结束。
- Failed：启动或分配失败。

Prepared 不创建 Employee Session 或 Host Session，允许修改员工和 CLI。

---

# 8. 员工会话生命周期

创建员工档案只生成 Employee ID。

以下操作都不创建会话：

- 将员工加入团队。
- 创建 Work Item。
- 选择团队和工作流。
- 保存 Node Executor Plan。
- 保存 Task Assignment Prepared。

只有节点真正开始执行时才按需创建或唤醒会话。

两层会话身份：

**Employee Session ID：** Maestro 维护的员工逻辑会话身份，代表数字员工长期工作的身份上下文。

**Host Session ID：** Agent CLI/宿主实际创建的会话 ID，按 CLI/Adapter 映射维护。

节点启动时：

1. 读取执行员工。
2. 检查 Employee Session。
3. 没有则创建 Employee Session ID。
4. 查询本次 CLI 对应 Host Session Binding。
5. 存在兼容会话则唤醒或恢复。
6. 不存在或失效则创建新的 Host Session Binding。
7. 记录 Host Session ID。
8. 创建 Attempt 并执行任务。

第一阶段默认同一员工串行执行。其他 Work Item 需要排队、改派或等待。未来如支持并行，必须引入隔离子会话和明确上下文边界。

---

# 9. 中断与恢复

任务中断后保留：

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

恢复方式 A：恢复原宿主会话

- 选择原 CLI。
- 检查 Host Session 是否存在、兼容并支持恢复。
- 成功后继续原 Attempt。

恢复方式 B：通过检查点恢复

- 允许选择另一 CLI。
- 沿用 Employee Session ID。
- 创建新的 Host Session Binding。
- 创建新的 Attempt，并关联原 Attempt。
- 将检查点和 Artifact References 作为恢复上下文。

跨 CLI 不直接复用 Host Session ID。

恢复失败必须保留中断状态，不能伪造恢复成功。

---

# 10. 四条核心用户操作链路

## 链路 A：已有团队 + 已有工作流

1. 用户进入需求/任务。
2. 点击新建需求。
3. 输入标题、背景、目标和附件。
4. 选择已有工作流。
5. 选择已有团队。
6. 检查工作流节点的角色需求是否被团队覆盖。
7. 系统预选节点执行人。
8. 用户调整映射。
9. 检查并行节点的员工冲突。
10. 确认执行方案。
11. 创建 Work Item 和 Workflow Run。
12. 只创建任务 DAG，不启动员工、不分配 CLI、不创建会话。

## 链路 B：新建团队 + 新建工作流

1. 创建 Work Item。
2. 新建工作流。
3. 定义节点、角色要求、依赖和人工门禁。
4. 选择保存到工作流库或仅用于本次需求。
5. 新建团队。
6. 从员工档案添加成员并设置团队内角色。
7. 选择保存到团队库或仅用于本次需求。
8. 生成节点执行人映射。
9. 检查角色覆盖和并发冲突。
10. 创建执行方案和 Workflow Run。

## 链路 C：节点就绪后执行

1. 上游依赖完成，节点进入 Ready。
2. Scheduler 读取节点执行人映射。
3. 检查员工是否启用、是否空闲。
4. 确定执行员工。
5. 从本机 CLI 资源池选择满足能力要求的 CLI。
6. 创建 Task Assignment Prepared。
7. 用户可以修改员工或 CLI。
8. 用户启动任务。
9. Assignment 锁定。
10. 按需创建或唤醒 Employee Session 和 Host Session。
11. 创建 Attempt。
12. 展示员工活动、公开工具事件和产物。
13. 任务完成后验收输出，推进下游依赖。

## 链路 D：异常与恢复

1. Agent 或 Host 中断。
2. 保存 Attempt、日志、会话映射和检查点。
3. Task 标记 Interrupted 或 Failed。
4. 用户查看员工、CLI、Host Session、错误和恢复能力。
5. 选择恢复原 Host Session，或更换 CLI/员工并通过检查点恢复。
6. 新建或继续 Attempt。
7. 任务重新执行。
8. 完成后重新触发依赖检查。

---

# 11. 信息架构

| 一级导航  | 页面                   |
| ----- | -------------------- |
| 启动与资源 | 本机 Agent CLI 扫描      |
| 需求工作台 | 需求列表、创建向导、需求详情       |
| 执行中心  | 执行实例、流程视图、任务视图、事件时间线 |
| 团队库   | 团队列表、团队编辑器、团队版本      |
| 工作流库  | 工作流列表、工作流编辑器、版本管理    |
| 员工档案  | 员工列表、员工详情、员工会话历史     |
| 角色库   | 角色列表、角色详情            |
| 产物与事件 | 产物、Handoff、事件、审计     |
| 系统设置  | Daemon、扫描、调度、权限策略    |

---

# 12. 页面规格

## P00 本机 Agent CLI 扫描

系统打开后的第一入口。展示扫描进度、发现数量、可用数量、异常数量、CLI 名称、路径、版本、协议、能力和健康状态。支持重新扫描、完整扫描、手动添加路径和健康检查。扫描不创建员工、团队或会话。

## P01 需求/任务工作台

展示需求数量、执行中、待人工处理、待验收。列表展示标题、关联工作流、关联团队、状态和创建时间。用户从这里创建或打开需求。详情显示工作流和团队版本快照。

## P02 新建需求向导

五步：需求信息；选择或创建工作流；选择或创建团队；节点执行人映射；运行前检查与确认。

## P03 需求详情

展示需求内容、Workflow Snapshot、Team Snapshot、Node Executor Plan、当前及历史 Workflow Runs、产物和事件。提供流程视图、节点列表和执行历史。

## P04 团队库

展示团队名称、版本、说明、成员数量、角色覆盖、成员及其角色、最近使用的 Work Item。不显示适用工作流字段，不提供 CLI 配置。

## P05 团队编辑器

设置名称和描述；从员工档案选择成员；为成员设置团队内角色；设置主成员、备用成员和优先级；保存产生新版本。不选择工作流，不选择 CLI，不创建会话。

## P06 工作流库

展示名称、版本、用途、节点数量、Agent 节点和人工节点数量、主要阶段、并行关系、内置/草稿/已发布状态。支持编辑、复制、发布和用于新需求。

## P07 工作流编辑器

画布定义节点 DAG。Agent 节点选择 Role Definition；Human 节点定义审批人和人工处理条件；配置依赖、并行、汇合、条件、输入输出、验收和失败策略。不指定 Employee、Team 或 CLI。

## P08 员工档案

展示员工名称、Employee ID、说明、角色资格、启用状态、加入的团队汇总、当前执行任务及会话创建状态。不允许绑定 CLI 或团队。

## P09 角色库

维护角色职责、技能、输入输出契约、能力要求和验收规则。工作流节点引用角色；员工档案定义可承担资格；团队成员定义团队内角色范围。

## P10 执行中心

展示 Workflow Run 列表、关联 Work Item、Workflow 版本和 Team 版本、状态、完成率、Ready 节点、执行中节点、中断节点和人工待处理数量。

## P11 工作流执行视图

按节点展示节点名称、Role 要求、本次团队执行成员、实际执行员工、任务状态、CLI（分配后才显示）、会话状态（创建后才显示）和最近活动。提供任务表格和事件时间线。

## P12 节点分配面板

展示节点角色要求、符合要求的团队成员、本机可用 CLI 候选、CLI 能力、会话计划。支持保存 Prepared 和保存并启动。Prepared 阶段允许修改员工和 CLI；启动会话后锁定。

## P13 员工执行活动面板

展示员工身份、所属团队/角色、当前 Work Item、节点、CLI、Employee Session ID、Host Session ID、Attempt、开始时间、运行时长、最近活动。只展示宿主公开状态事件、工具事件、文件操作、命令事件和产物摘要，不展示 Agent 私有推理。

## P14 任务和会话详情

展示 Task ID、Node ID、Role、计划执行人、实际执行人、Task Assignment 历史、Attempt 历史、Employee Session ID、Host Session Binding 历史、产物、Handoff 和错误证据。

## P15 中断恢复

明确区分恢复原宿主会话与检查点重建会话。展示原 CLI、Host Session ID、恢复能力、最后活动和检查点。跨 CLI 恢复建立新的 Host Session Binding 和新的 Attempt，保留原员工身份和 Employee Session ID。

## P16 产物与事件

Artifact 可追踪到 Work Item、Workflow Run、Task、Employee、CLI、Attempt 和 Handoff。事件记录团队/工作流版本、节点映射、Task Assignment、会话创建和恢复。人工审批、异常恢复和交付验收留下审计事件。

---

# 13. 状态及业务规则

Work Item：

`draft → configured → ready_to_run → running → waiting_human / blocked → ready_for_acceptance → accepted → delivered`

也可能进入 `cancelled`。

Team Definition：

`draft → published → deprecated`

Workflow Definition：

`draft → published → deprecated`

修改团队和工作流产生新版本，已有 Work Item 使用快照。

Node Task：

`waiting_dependency → ready → assignment_prepared → preflight → creating_session → running → succeeded`

异常分支：`interrupted / blocked / failed / cancelled / skipped`。

Assignment：

`draft → prepared → preflight → locked → released`

或进入 `failed`。

Employee Session ID 是按员工逻辑身份维护的长期标识。Host Session Binding 按 CLI/Adapter 维护，不跨 CLI 直接复用 Host Session ID。

---

# 14. 异常边界

1. 团队没有覆盖工作流节点角色：阻止确认，提示缺少岗位成员。
2. 一个员工被分配到并行节点：提示串行执行影响，可改派或接受排队。
3. 团队成员被停用：未启动节点需要重新映射；运行中节点按中断和恢复策略处理。
4. 团队定义被修改：现有 Work Item 快照不自动变化。
5. 工作流定义被修改：现有 Run 继续使用旧版本。
6. CLI 在任务启动前失效：Assignment 保持可编辑，不创建 Session。
7. CLI 在运行中断连：保留 Attempt 和 Host Session 引用，进入恢复流程。
8. 员工已在其他 Work Item 执行：按串行策略排队、改派或等待。
9. 新建团队/工作流选择仅用于本次需求：保存 Work Item Snapshot，不进入公共资产库。
10. 新建团队/工作流选择保存到库：先创建可复用资产版本，再由本次 Work Item 引用该版本。

---

# 15. 原型覆盖范围

HTML 原型覆盖：

- 启动扫描页。
- 需求/任务列表。
- 新建需求向导。
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

原型使用本地模拟数据，不会真实扫描本机 CLI、连接 Daemon、启动 Agent 或调用 ACP。模拟操作只用于演示状态变化。

---

# 16. 验收用例

| ID     | 场景               | 通过标准                                                       |
| ------ | ---------------- | ---------------------------------------------------------- |
| V32-01 | 新建需求，选已有工作流和已有团队 | Work Item 同时引用二者，二者之间没有固定关联                                |
| V32-02 | 新建需求，创建新工作流和新团队  | 两项均可选择仅用于本次或保存到库                                           |
| V32-03 | 团队被多个工作流复用       | 团队定义不记录 Workflow ID                                        |
| V32-04 | 工作流被多个团队复用       | 工作流定义不记录 Team ID 或 Employee ID                             |
| V32-05 | 工作流节点匹配团队成员      | 每个 Agent 节点映射符合 Role 要求的成员                                 |
| V32-06 | 团队缺少角色覆盖         | 预检失败并说明缺少的角色                                               |
| V32-07 | 同一员工分配并行节点       | 显示串行/排队提示，不允许同一会话并发写入                                      |
| V32-08 | 创建 Work Item     | 创建需求、版本快照、执行人映射和 Run/Task，不创建 CLI 分配和 Session              |
| V32-09 | 节点 Ready         | 从本次团队中选择执行员工，再选择本机 CLI                                     |
| V32-10 | 保存 Prepared      | 员工和 CLI 已记录，但会话未创建；允许修改                                    |
| V32-11 | 启动节点             | 锁定 Assignment，按需创建/复用员工会话和 Host Session                    |
| V32-12 | 员工更换 CLI         | 不修改员工档案和团队；仅新任务 Assignment 选择新 CLI                         |
| V32-13 | 中断后恢复原宿主         | 宿主支持且会话存在时可继续原 Attempt                                     |
| V32-14 | 跨 CLI 检查点恢复      | 创建新 Host Session Binding 和新 Attempt，保留 Employee Session ID |
| V32-15 | 修改团队或工作流资产       | 已有 Work Item 继续使用原快照                                       |
| V32-16 | 人工节点             | 不分配员工，不分配 CLI，不创建 Employee Session                         |
| V32-17 | 交付验收             | 所有产物、测试、风险和人工验收记录可追溯                                       |

---

# 17. 最终设计结论

Maestro 的业务主线：

**用户提出需求/任务 → 选择或创建工作流 → 选择或创建团队 → 团队成员映射到工作流节点 → 创建本次执行方案 → 节点按依赖进入 Ready → 任务级分配员工与 Agent CLI → 按需创建/唤醒员工会话 → 执行与交接 → 异常恢复/缺陷回流 → 最终验收交付。**

团队回答“谁来做”，工作流回答“怎么做”，需求/任务决定“这一次要做什么”。

团队和工作流都是可复用、可维护的长期资产，但它们的组合关系属于具体需求的执行方案。团队成员是本次工作流节点的执行者；CLI 是节点真正执行时选择的本机执行工具；会话是员工工作过程中按需创建和维护的运行资源。

**版本边界提醒：** V3.2 已经纠正了团队与工作流的关系。下一步进入开发前，建议先冻结这套对象关系和版本快照规则，再把原型中模拟交互逐一对应到 Daemon API 和事件模型。