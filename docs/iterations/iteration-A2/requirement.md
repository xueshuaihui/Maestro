# A2 — 基于 CLI 创建角色与员工 · 完整需求文档

- **迭代号**：A2 / 阶段 A（核心形态闭环，承接 A1 的 CLI 发现结果，进入 v2 概念模型的第二层与第三层）
- **依据章节**：`docs/index.md` 第一部分全文——§1 定位与形态（§1.2「不是'一个角色 = 一个 Agent'的编排器」、§1.3 核心用户旅程【建角色】步骤「用户选一个 CLI，创建角色（职责/输入输出/权限/微信技能）；一个角色下可挂多名员工 Agent，各自绑定同一或不同 CLI」与【搭团队】步骤的六部门枚举、§1.4 组织/部门视图、§1.5 CLI 是员工载体并列不嵌套）、§2 概念模型（§2.1 五层模型表与三条关键规则「角色≠Agent / 员工绑定 CLI 而角色不绑定 / 员工实例≠会话」、§2.2 Agent CLI 发现与注册的数据模型 `cli_id` 与 `capabilities`、§2.3 Agent Team 的 `members: role → agents` 一角色多员工形状、§2.4 工作流以角色/员工为编排单位）、§3 架构决策（§3.1 Control Plane 负责组织/部门/角色/员工注册、§3.2 ACP 通用会话协议、§3.3 待验证项「一角色多员工是否产生工作区串台」）、§4 状态模型（角色 6 态 `inactive/available/busy/cooldown/unavailable/retired` 计算到员工 Agent、角色层显示其下员工聚合状态、核心不变量）、§5 核心能力域（能力域 1「组织 / 部门 / 角色 / 员工管理」全部：四级 CRUD、角色声明所需 CLI 能力、一角色多员工、员工绑定具体 CLI、动态创建与释放会话、角色-员工关系校验；能力域 0 的 CLI 清单是 A2 的上游输入）、§7 运行时模型与数据布局（`.orch/organization/`）、§8 边界声明（第 1/4/5 条：CLI 并列不嵌套、角色不绑定 CLI 而员工绑定 CLI、一角色多员工并发受约束）；第二部分 `### A2 — 基于 CLI 创建角色与员工`（389~391 行的三个子项 + **验收**句逐字）、`阶段 A 退出条件`、`关键判断点`表 A2 行；附录待裁决清单 D-2 / D-4（CLI 清单是配置项、本机未取证）；`docs/iterations/A-phase-decisions.md` 裁决 AD-04（macOS 路径 / os.tmpdir / NODE_ENV=test）、AD-06（全量门禁等效口径）、AD-08（真实宿主未取证判阻塞、能力层/编排层/数据层用 mock 实测）。
- **模板路径**：`docs/templates/requirement-template.md`（8 节结构 + 三条用户视角硬约束；本项目自 I1.2 起扩展为附录 A~D，口径差见 `docs/templates/execution-template.md` §1.0.1）。
- **上游契约（只用于向后兼容 / 范围外说明，不充当需求来源）**：A1 定稿 `docs/iterations/iteration-A1/requirement.md`（BR-01~BR-11 / AC-01~AC-15、CLI 清单与能力矩阵、证据分级）；A1 实现产出的 `.orch/cli-registry.json` 形状（`clis` 数组，每条含 `cli_id` / `name` / `executable` / `capabilities` 与五维 `acp` / `transport` / `resume_dialect` / `max_concurrent_sessions` / `evidence_hook` / `connection_status`，当前 HEAD `3e47a51`）；`docs/iterations/A-phase-decisions.md` AD-04 / AD-06 / AD-08 本机口径。
- **版本**：v2
- **状态**：初稿。交干净上下文的独立评审 SubAgent 逐轮评审；本文件不自行宣布评审通过。
- **一句话说明**：让用户从 A1 已发现的 CLI 出发创建角色（声明职责/契约/技能/所需 CLI 能力）与绑定具体 CLI 的员工，一个角色挂多名员工并归属部门，按能力校验而不把角色绑定死某个 CLI，并能为两名员工各创建一条会话记录，落地 v2 概念核心「角色≠Agent、角色不绑定 CLI 而员工绑定 CLI、员工实例≠会话」。

---

## 一、背景与问题

### 1.1 现状与问题

用户走完 A1 后，眼前是一份「本机已发现的 Agent CLI 清单」和一张能力矩阵，下一步按 `docs/index.md` §1.3 的核心旅程应当是【建角色】：「用户选一个 CLI，创建角色（职责/输入输出/权限/微信技能）；一个角色下可挂多名员工 Agent，各自绑定同一或不同 CLI」。这一步今天完全不存在，用户的真实处境是：

- **有 CLI 清单，却没有把它变成任何可组织的东西**：A1 让用户看见了「有哪些 CLI、各自支持什么能力」，但用户无法基于这份清单创建角色，也无法创建员工。§1.3 把「启动 → 扫描 → 建角色员工 → 搭 Team → 建工作流 → 跑通」定为第一入口，A2 不落地，这条链断在第二环。
- **角色和 Agent 被混为一谈**：v1 的角色是静态 YAML，没有「角色 / 员工」两层区分。用户今天无法表达「一个角色下挂多名员工、各自绑定同一或不同 CLI」，`docs/index.md` §1.2 明确「不是'一个角色 = 一个 Agent'的编排器」，§2.1 关键规则 1 要求「一个角色可挂 N 个员工；一个阶段可派多个员工并行」，§3.3 把「一角色多员工」列为阶段 A 必须回答的待验证项。不区分这两层，A3 的 Team 编排就没有可编排的对象。
- **角色一旦选了 CLI 就被绑死**：用户今天若直接把 CLI 写进角色，换一台机器、换一个 CLI 就得重建角色。`docs/index.md` §2.1 关键规则 2 与 §8 第 4 条要求「角色声明所需能力，调度时从满足能力的已发现 CLI 中挑选员工；角色不绑定 CLI，员工绑定 CLI」。验收句「角色不绑定死某个 CLI」正是这条边界的用户可判定口径，今天无从验证。
- **员工没有「绑定哪个具体 CLI」的入口**：有了角色还不够，执行必须落到具体员工与其 CLI 载体上。`docs/index.md` §2.1 五层模型要求员工持有 `cli_id`，§5 能力域 1 要求「员工绑定具体 CLI」；缺了这层，A5 的调度器找不到可派发的执行体。
- **部门归属无处设置**：`docs/index.md` §1.3 【搭团队】步骤要求把角色拖进「产品部 / 研发管理部 / 前端部 / 后端部 / 测试部 / 平台安全部」六个部门。今天没有归属关系，A3 无法按部门组织团队。
- **声明的能力没人校验**：即使角色能声明「所需 CLI 能力」，也无法判断某员工绑定的 CLI 到底满不满足——`docs/index.md` §5 能力域 1 要求「沿用 v1 角色注册表与校验器，扩展'角色-员工'关系校验」，§8 第 4 条要求「调度按能力而非名称」。缺了校验，用户会到运行期才发现选错 CLI。
- **会话和员工被当成同一个东西**：用户今天无法表达「同一个员工配置在不同任务里开多个会话」。`docs/index.md` §2.1 关键规则 3 与 §4 要求员工实例与会话分离、同一员工可开多会话；这条边界不落地，B1 的真实 ACP 会话驱动就没有可挂接的模型。
- **本机真实宿主取证条件仍不具备**：AD-08 / D-2 / D-4 记载本机 PATH 无真实 codex/claude/gemini 等 CLI。A2 的会话记录可基于 A1 的 mock 夹具取证，但真实 ACP 会话驱动属 B1 范围外，证据必须分级、不得用 mock 冒充真实宿主达标。

不解决会怎样：`docs/index.md` 第二部分把「一角色多员工是否可行」列为 A2/A3 关键判断点（「角色≠Agent 是否落地」）；A3 的团队搭建、A4 的工作流、A5 的端到端闭环都以「角色 → 员工 → 会话」为编排对象。A2 不落地，阶段 A 唯一硬判据「能配出并跑通一个 Agent Team + 工作流」无法成立。

### 1.2 目标与成功衡量

做完之后，用户可观测的变化：

1. **从已发现 CLI 建角色，四类内容齐全**：用户从 A1 清单中选一个已发现的 CLI 起步，创建角色并填入职责、契约、技能、所需 CLI 能力四类内容，随后可查看、修改、删除。衡量：四类内容逐项可填可查，角色 CRUD 四类操作各有可复现用例，缺失内容被明确提示而非静默接受。
2. **员工可建、可绑具体 CLI、可维护**：用户创建员工时明确指定一个 A1 已发现的具体 CLI，随后可查看、修改（含改绑 CLI）、删除。衡量：每条员工都能回答「它绑定哪个具体 CLI」，且该 CLI 来自已发现清单，不凭空填写。
3. **一角色挂多员工，角色≠Agent**：用户在同一角色下挂 2 名（及以上）员工，两名员工各自绑定同一或不同 CLI，角色页能同时看到多名员工。衡量：「1 角色 : N 员工」可复现，角色定义不随某一名员工的 CLI 变化而变化。
4. **部门归属可设、可校验**：用户为角色与员工指定所属部门，部门限定为产品部 / 研发管理部 / 前端部 / 后端部 / 测试部 / 平台安全部之一。衡量：六部门枚举齐全，非法/空部门被拒并给出可见原因。
5. **能力声明可校验，角色不绑定死某个 CLI**：角色声明所需 CLI 能力后，系统按员工绑定 CLI 的 A1 五维能力（ACP / transport / 会话恢复方言 / 并发上限 / 证据钩子）判定是否满足；满足才可绑定与建会话，不满足给出可见原因；把某员工的 CLI 换成另一条满足能力的已发现 CLI，角色定义保持不变。衡量：满足/不满足两类判定各有可复现用例，验收句「角色不绑定死某个 CLI」不降级。
6. **两人可各自建会话，员工实例≠会话**：用户为两名员工各创建一条会话记录，两条记录各自独立且分别关联对应员工与其 CLI；同一员工可再开第二条会话。衡量：两名员工的会话记录互不串台；证据分级为「mock 实测」，真实 ACP 会话驱动明确标注属 B1，0 次冒充真实宿主达标。

### 1.3 范围

**范围内（本次让用户获得的新能力）**：

- **从已发现 CLI 创建角色，填写四类内容**：规划 389 行「角色 CRUD（职责/契约/技能/所需 CLI 能力）」与验收句「用户选一个已发现的 CLI 建角色」逐字落地。用户从 A1 清单选一个已发现 CLI 起步，创建角色并填职责、契约、技能、所需 CLI 能力四类内容；角色可查看、修改、删除。（§2.2 / §2.3；AC-01 / AC-02 / AC-03）
- **员工 CRUD 并绑定具体 CLI**：规划 389 行「员工 CRUD 并绑定具体 CLI」逐字落地。用户创建员工时选择一个已发现的具体 CLI，员工可查看、修改（含改绑 CLI）、删除。（§2.4 / §2.5；AC-04 / AC-05 / AC-06）
- **一角色多员工**：规划 390 行「一角色多员工」逐字落地；一个角色可挂 2 名及以上员工，各自绑定同一或不同 CLI；角色≠Agent。（§2.6；AC-07）
- **部门归属**：规划 390 行「部门归属」逐字落地；角色与员工都可归属六部门之一，非法归属被拒。只做到归属的 CRUD 与校验，不做团队编排。（§2.7；AC-08）
- **角色能力校验**：规划 390 行「角色能力校验」逐字落地；角色声明所需 CLI 能力，校验按员工绑定 CLI 的 A1 五维能力判定，不按 CLI 名称硬配；不满足给可见原因。（§2.8；AC-09）
- **角色不绑定死某个 CLI**：验收句「角色不绑定死某个 CLI」逐字落地；更换员工绑定的 CLI（仍为满足角色所需能力的已发现 CLI）不改变角色定义。（§2.8；AC-10）
- **两人可各自建会话**：验收句「两人可各自建会话」逐字落地；A2 层面做到为两名员工各创建一条会话记录（调用 A1 已发现的 `cli_id` 能力语义），两条记录独立可辨；真实 ACP 会话驱动不在本迭代，用 mock 取证并分级。（§2.9；AC-11）
- **员工实例≠会话**：`docs/index.md` §2.1 关键规则 3；同一员工可开多条会话记录，会话不等于员工本身。（§2.9；AC-12）
- **规划验收句整句不降级**：规划 391 行整句「用户选一个已发现的 CLI 建角色并挂 2 名员工，两人可各自建会话；角色不绑定死某个 CLI」由 AC-13 端到端联合判定，逐字保留、不收窄、不合并。（§2.10；AC-13）

**范围外（本次不覆盖，每项注明留待何时或由谁覆盖）**：

- **Agent Team 拖拽编排、负责人/并发/协作规则、团队模板**：留待 A3。A2 只产出可编排的部门 / 角色 / 员工对象与归属关系，不做团队搭建器。
- **12 阶段工作流、门禁、三种运行模式、自定义 DAG**：留待 A4。
- **真实 ACP 会话驱动、会话恢复方言、状态机迁移（节点 9 态 / 会话 6 态 / 角色 6 态迁移与 CAS）、按能力调度任务到具体员工、一角色多员工真实并行**：留待 A5 与阶段 B（B1 / B2），`docs/index.md` §4 与 §5 能力域 5/6。A2 只做到「创建会话记录」的可验证语义，不启动真实 ACP 会话。
- **跨 CLI 混跑、同一 Team 多 CLI 员工、跨项目复用、第二 CLI 真机接入**：留待 D1 / D2 / D3。A2 的「换绑另一 CLI」用 A1 mock 夹具中的多条已发现 CLI 取证，不代表真机多宿主就绪。
- **桌面壳与组织/部门视图的视觉设计、拖拽交互、系统托盘、后台 daemon 常驻**：留待 C1（`docs/index.md` 阶段 C / v1 I1.10a）。A2 只保证语义与可复现接缝，不交付桌面 UI 文件。
- **CLI 扫描、能力探测、重新扫描、手动添加 CLI**：属 A1 已完成范围（`docs/index.md` 第二部分 A1 条目）。A2 只读消费 A1 的 `cli_id` 与能力矩阵，不重新实现发现。
- **替用户安装 CLI、修改用户 CLI 配置、写用户系统目录**：`docs/index.md` §2.2 边界与 §8 第 3 条，永久范围外；A2 只写本项目缓存 `.orch/organization/`。
- **网页版客户端控制**：`docs/index.md` §8 第 2 条边界，永久范围外。
- **真实宿主取证机器**：AD-08 / D-2 / D-4；A2 的会话记录为 mock 面，真实 ACP 驱动取证由 B1 承担，未取证前不写「真实宿主达标」。

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|
| §2.2 从已发现的 CLI 创建角色（职责/契约/技能/所需 CLI 能力） | 走完 A1 扫描、准备搭建组织的用户 | 有 CLI 清单却没有角色 | 从清单选一个已发现 CLI 起步，四类内容逐项可填可查；验收句「选一个已发现的 CLI 建角色」逐字落地 |
| §2.3 查看、修改与删除角色 | 需要调整角色定义的用户 | 角色建完就改不动 | 四类内容可查可改、可删除；删除前有员工时给提示 |
| §2.4 创建员工并绑定具体 CLI | 需要把角色落到执行载体的用户 | 员工没有绑定哪个 CLI 的入口 | 从已发现清单选一个具体 CLI 绑定；规划「员工 CRUD 并绑定具体 CLI」逐字落地 |
| §2.5 查看、修改与删除员工 | 需要维护员工、换绑 CLI 的用户 | 员工建完无法维护 | 可查、可改（含改绑另一已发现 CLI）、可删 |
| §2.6 一角色多员工 | 希望一个角色并行多名员工的用户 | 角色和 Agent 混为一谈 | 一角色挂 2 名及以上员工，各自绑定同一或不同 CLI；角色≠Agent |
| §2.7 部门归属 | 需要按职能组织角色与员工的用户 | 六部门无处设置 | 角色与员工都可选六部门之一，非法/空归属被拒；完整团队编排属 A3 |
| §2.8 角色能力校验（角色不绑定死某个 CLI） | 担心选错 CLI、想换 CLI 复用角色的用户 | 声明的能力没人校验、角色绑死 CLI | 按员工绑定 CLI 的 A1 五维能力判定；换绑满足能力的另一 CLI 不改变角色定义 |
| §2.9 为员工创建会话记录 | 想让两名员工各自开工的用户 | 员工与会话被当成同一个 | 为两名员工各创建一条独立会话记录；同一员工可再开会话；真实 ACP 驱动属 B1，mock 取证明级 |
| §2.10 功能之间的衔接 | 走完整段旅程的用户 | 各步串不起来 | 从选 CLI → 建角色 → 建员工并绑定 → 挂多员工 → 归属部门 → 能力校验 → 各建会话 → 换绑 CLI 角色不变的完整流程，含失败路径 |
| §2.11 用户可见的业务规则 | 全体 | 判定口径不一致 | BR-01~BR-14 集中列出用户可感知的规则，供第三章 AC 双向引用 |

### 2.2 从已发现的 CLI 创建角色

- **使用角色**：走完 A1 扫描、看到 CLI 清单，准备搭建组织的用户。
- **使用场景**：用户已有一份已发现的 CLI 清单，要把其中某个 CLI 作为起点，定义一个可复用的角色。
- **用户操作**：用户从 A1 已发现的 CLI 清单中选一个 CLI，执行创建角色，并填写四类内容——职责（这个角色负责什么）、契约（输入与输出约定）、技能（这个角色应具备的能力）、所需 CLI 能力（这个角色要求其员工载体具备哪些能力，例如支持 ACP、具备工作区隔离）。用户为角色起一个名称，并可指定所属部门（见 §2.7）。
- **预期效果**：用户看到角色创建成功的反馈，角色出现在组织视图中；角色详情能逐项看到刚填的职责、契约、技能、所需 CLI 能力四类内容，以及它关联的部门。选中的 CLI 只是本次创建的起点提示，不是角色的永久绑定（见 §2.8）。
- **异常情况**：未选择任何已发现的 CLI、名称为空、四类内容有缺项或所需 CLI 能力写了清单里不存在的能力项时，创建被拒绝并给出具体原因，不产生一条「半截」角色；用户改好后可重试。
- **边界说明**：用户只能从 A1 已发现的 CLI 中起步，不能手填一个不存在的 CLI；角色定义本身不记录「绑定死某个 CLI」，所需能力是声明而非绑定（§2.1 关键规则 2 / §8 第 4 条）。本步骤交付的是角色定义与其四类内容，不创建员工、不创建会话。

### 2.3 查看、修改与删除角色

- **使用角色**：需要维护角色定义的组织管理者。
- **使用场景**：角色的职责、契约、技能或所需能力发生变化，或角色不再需要。
- **用户操作**：用户在组织视图中查看角色详情，修改四类内容中的任意一项或所属部门，或对不再需要的角色执行删除。
- **预期效果**：修改后角色详情立即显示新内容；删除后角色从组织视图消失。角色修改不影响其下已挂的员工（员工仍存在），只改变角色本身的定义。
- **异常情况**：角色下仍挂着员工时执行删除，用户看到「请先移除其下员工」的提示，删除不生效，员工不被连带删除；修改时填入非法内容（空名称、非法部门、不存在的所需能力）被拒绝并给出原因，角色保持原样。
- **边界说明**：角色可查看、可改、可删即满足规划「角色 CRUD」；角色不因某次修改而绑定某个具体 CLI。角色状态在其下员工上体现（见 §2.5），本迭代不实现状态机迁移（属 B1）。

### 2.4 创建员工并绑定具体 CLI

- **使用角色**：已经建好角色、要让角色落到执行载体的用户。
- **使用场景**：用户定义了角色，现在要创建具体员工来承担它，并明确这个员工由哪个 CLI 驱动。
- **用户操作**：用户选择要挂靠的角色，创建员工并填写员工名称，从一个已发现的 CLI 清单中选定一个具体 CLI 作为该员工的绑定载体，可指定所属部门与并发上限。
- **预期效果**：用户看到员工创建成功的反馈；员工出现在所属角色下，用户能一眼看到「这个员工绑定的是哪个具体 CLI」。同一角色下的不同员工可绑定同一 CLI，也可绑定不同 CLI（§1.3【建角色】「各自绑定同一或不同 CLI」）。
- **异常情况**：未选择角色、名称为空、未选择已发现的具体 CLI、所选 CLI 不满足角色声明的所需能力（见 §2.8）、部门非法时，创建被拒绝并给出具体原因，不产生员工。
- **边界说明**：员工必须绑定一个已发现的具体 CLI——这是「员工绑定 CLI」与「角色不绑定 CLI」的分界（§2.1 关键规则 2 / §8 第 4 条）。员工是角色的执行体而非角色本身（关键规则 1）；员工配置不是会话（关键规则 3）。员工并发上限是用户设定的可见值，真实并发受 CLI 与工作区隔离能力约束（§8 第 5 条）。

### 2.5 查看、修改与删除员工

- **使用角色**：需要维护员工、或想换一个 CLI 复用同一员工配置的用户。
- **使用场景**：员工绑定的 CLI 需要更换、并发上限需要调整，或员工不再需要。
- **用户操作**：用户查看员工详情（所属角色、绑定 CLI、部门、并发上限、当前状态），修改其中可改项（含把绑定 CLI 改为另一条已发现的 CLI），或删除该员工。
- **预期效果**：修改后员工详情立即显示新绑定 CLI 与新配置；改绑为另一条满足角色所需能力的已发现 CLI 后，员工仍挂在原角色下，角色定义不变（§2.8）。员工有用户可见的状态（如可用 / 忙碌等，与基线 §4 角色 6 态在员工层的取值一致），角色页显示其下员工的状态汇总；本迭代交付状态的可见呈现，不实现状态迁移（属 B1）。
- **异常情况**：改绑到一个未发现的 CLI，或改绑到的 CLI 不满足所属角色声明的所需能力时，修改被拒绝并给出原因，员工保持原绑定；删除员工时其已有会话记录的处理按 §2.9 的提示进行，不静默丢弃可见记录。
- **边界说明**：员工可查看、可改、可删即满足规划「员工 CRUD」；员工与其会话是两类对象，删除员工不等于删除其会话记录的可见历史（§2.1 关键规则 3）。

### 2.6 一角色多员工

- **使用角色**：希望一个角色下并行多名员工的用户。
- **使用场景**：用户为「产品经理」「前端开发」这类角色配置多名员工，分别由不同（或相同）CLI 驱动，以便后续并行派工。
- **用户操作**：用户在同一个角色下连续创建第二名、第三名员工，各自绑定一个已发现的具体 CLI；用户查看角色页时看到其下所有员工列表与各自绑定的 CLI。
- **预期效果**：角色页同时显示多名员工，每名员工有独立的名称、绑定 CLI、部门与状态；角色本身仍是同一个定义，不因为员工数量变化而改变。这正是 `docs/index.md` §2.1 关键规则 1 与 §2.3 `members: role → agents` 的形状。
- **异常情况**：给同一角色添加的第二名员工若选了不满足角色所需能力的 CLI，添加被拒绝并给出原因（§2.8）；同名员工在同一角色下重复添加被拒绝并提示已存在。
- **边界说明**：角色≠Agent。角色是职责与契约的宿主无关定义，员工是绑定具体 CLI 的可调度执行体；本迭代做到「一角色挂多员工」的可见关系与校验，真实并行执行与工作区串台验证属 A5 / B1（§3.3 待验证项）。

### 2.7 部门归属

- **使用角色**：需要按职能组织角色与员工的用户。
- **使用场景**：用户为角色和员工指定所属部门，使组织视图能按部门归类。
- **用户操作**：创建或修改角色、员工时，用户从固定六个部门中选择归属：产品部、研发管理部、前端部、后端部、测试部、平台安全部；用户在组织视图中按部门查看其下的角色与员工。
- **预期效果**：角色与员工各自显示所属部门；组织视图能按六部门归类展示，用户能回答「这个角色/员工属于哪个部门」。
- **异常情况**：不选部门、选择六部门之外的名称或留空被拒绝并给出可见原因，角色/员工不被保存为「无部门」状态。
- **边界说明**：部门枚举固定为上述六个（`docs/index.md` §1.3【搭团队】与 §2.3 `departments`）；本迭代只做到「角色/员工归属部门」的 CRUD 与校验，设负责人、并发、协作规则、拖拽编排与团队模板属 A3 范围外。

### 2.8 角色能力校验（角色不绑定死某个 CLI）

- **使用角色**：担心选错 CLI、或希望在换机器/换 CLI 后复用角色的用户。
- **使用场景**：用户给角色声明了「所需 CLI 能力」，要确认某员工绑定的 CLI 确实满足；或想把员工的 CLI 换成另一条已发现 CLI，同时确保角色定义不受影响。
- **用户操作**：用户查看角色的所需能力与其下员工绑定 CLI 的能力对照；为员工绑定或改绑 CLI 时，系统按已发现 CLI 的能力信息做校验。用户看到两类结果——「满足，可以绑定 / 建会话」或「不满足：缺少某项所需能力」。用户把某员工的 CLI 换成另一条满足能力的已发现 CLI 后，再次查看角色详情，四类内容与部门保持不变。
- **预期效果**：满足能力的员工可建会话，不满足的被明确拦下并说明缺哪项能力；角色始终以「所需能力」而非「某个具体 CLI 名」来定义。换绑员工 CLI 后，角色定义不变，证明角色没有绑定死某个 CLI。
- **异常情况**：角色声明的所需能力项在能力清单里不存在、或某已发现 CLI 尚未探测出能力（显示「未探测」而非「不支持」）时，校验不臆造为支持，给出「未探测，无法判定满足」的可见提示，由用户先做能力探测（A1 能力）。
- **边界说明**：校验维度沿用 A1 已发现 CLI 的五维能力（ACP / transport / 会话恢复方言 / 并发上限 / 证据钩子，锚定 `docs/index.md` §2.2:128 与 §5:223），不新增维度、不按 CLI 名称硬配（§8 第 4 条「调度按能力而非名称」）。角色声明能力 ≠ 角色绑定 CLI；调度层面从满足能力的已发现 CLI 中挑选员工属 A5 / B1，本迭代只做绑定时校验。

### 2.9 为员工创建会话记录

- **使用角色**：想让两名员工各自开工、并确认它们互不干扰的用户。
- **使用场景**：用户已建好一个角色并挂了两名员工，要分别为每名员工创建一条会话记录，作为后续真实执行的入口。
- **用户操作**：用户选中某名员工，执行「创建会话记录」；系统按该员工绑定的已发现 CLI 生成一条会话记录，用户再为另一名员工重复此操作。用户也可对同一员工再创建一条会话记录。
- **预期效果**：两名员工各自得到一条会话记录，页面能区分它们分别属于哪名员工、使用哪个 CLI、何时创建；两名员工的会话互不串台。对同一员工再创建时，出现第二条独立记录，说明员工实例与会话不是同一个东西（§2.1 关键规则 3）。
- **异常情况**：员工未绑定 CLI、或其绑定 CLI 不满足角色所需能力时被拒绝并给出原因；员工不存在时被拒绝；本迭代不启动真实 ACP 会话，用户看到的是「会话记录已创建」而非「会话已运行」，不显示真实推理输出。
- **边界说明**：A2 层面「两人可各自建会话」的可验证语义 = 为两名员工各创建一条会话记录（调用 A1 已发现的 `cli_id` 能力语义）；真实的 ACP 会话驱动、会话恢复方言、状态机迁移属 B1 范围外，用 mock 取证并标注证据级别为「mock 实测」，不得冒充真实宿主达标（AD-08）。会话状态词沿用基线 §4 会话 6 态中的可见取值，本迭代不实现状态推进。

### 2.10 功能之间的衔接

用户走完一遍 A2 看到的完整流程：从 A1 已发现的 CLI 清单中选一个 CLI → 创建角色并填职责 / 契约 / 技能 / 所需 CLI 能力 → 为该角色创建第一名员工并绑定一个具体已发现 CLI → 再创建第二名员工并绑定另一条（或同一条）已发现 CLI → 为角色和两名员工指定部门 → 系统按角色所需能力与员工绑定 CLI 的能力做校验，通过则允许建会话、不通过则提示缺哪项能力 → 分别为两名员工各创建一条会话记录，两人各自开工 → 把其中一名员工的 CLI 换成另一条满足能力的已发现 CLI，回到角色页确认角色定义没有任何变化。失败路径：未选 CLI / 四类内容缺项 / 部门非法 / 员工未绑 CLI / 能力不满足 / 能力未探测，均给可见原因且不产生半截对象；有员工的角色不可直接删除，先移除员工。这条流程的产物（组织 / 部门 / 角色 / 员工 / 会话记录）是 A3「Agent Team 搭建器」与 A4「工作流创建器」的直接输入。

规划验收句的完整落地（逐字、不降级）：391 行「用户选一个已发现的 CLI 建角色」→ §2.2 + AC-01；「并挂 2 名员工」→ §2.6 + AC-07；「两人可各自建会话」→ §2.9 + AC-11（A2 层面会话记录语义，mock 取证、分级）；「角色不绑定死某个 CLI」→ §2.8 + AC-10。整句由 AC-13 端到端联合判定，四部分各自独立可判、合起来不收窄。另有三条 v2 概念核心边界同步落地：角色≠Agent（§2.6 / AC-07）、角色不绑定 CLI 而员工绑定 CLI（§2.2 / §2.4 / §2.8 / AC-01 / AC-04 / AC-10）、员工实例≠会话（§2.9 / AC-12）。

### 2.11 用户可见的业务规则

- **BR-01**：创建角色必须从 A1 已发现的 CLI 清单中选一个作为起点；不能手填一个不存在的 CLI。（规划 391 行验收句前半；§2.2）
- **BR-02**：角色必须能记录并展示职责、契约、技能、所需 CLI 能力四类内容；缺项时拒绝创建并给可见原因。（规划 389 行「角色 CRUD（职责/契约/技能/所需 CLI 能力）」；§2.2）
- **BR-03**：角色可创建、查看、修改、删除；删除时其下仍有员工则拒绝并提示先移除员工，员工不被连带删除。（规划 389 行「角色 CRUD」；§2.3）
- **BR-04**：员工必须绑定一个 A1 已发现的具体 CLI；同一角色的不同员工可绑定同一或不同 CLI。（规划 389 行「员工 CRUD 并绑定具体 CLI」；§1.3【建角色】；§2.4）
- **BR-05**：角色不绑定死某个 CLI——角色只声明所需能力，员工才绑定具体 CLI；换绑满足能力的另一已发现 CLI 后，角色定义（四类内容与部门）不变。（规划 391 行验收句末句；§2.1 关键规则 2；§8 第 4 条；§2.8）
- **BR-06**：员工可创建、查看、修改、删除；修改包括改绑另一已发现的具体 CLI；非法/未发现/能力不满足的绑定被拒绝并给原因。（规划 389 行「员工 CRUD」；§2.5）
- **BR-07**：一个角色可挂 2 名及以上员工，角色≠Agent；角色定义不随某名员工的 CLI 变化而变化。（规划 390 行「一角色多员工」与 391 行「挂 2 名员工」；§2.1 关键规则 1；§2.6）
- **BR-08**：角色与员工都必须归属一个部门，部门限定为产品部 / 研发管理部 / 前端部 / 后端部 / 测试部 / 平台安全部之一；空归属或六部门之外的名称被拒绝。（规划 390 行「部门归属」；§1.3【搭团队】；§2.7）
- **BR-09**：角色声明所需 CLI 能力后，绑定/改绑员工时须按该员工绑定 CLI 的 A1 五维能力（ACP / transport / 会话恢复方言 / 并发上限 / 证据钩子）判定；未探测的能力不臆造为支持；满足才可绑定与建会话，不满足给出缺哪项能力的可见原因。（规划 390 行「角色能力校验」；§5 能力域 1；§8 第 4 条；§2.8）
- **BR-10**：可为两名员工各创建一条会话记录，两人各自开工且互不串台；A2 层面仅创建会话记录，真实 ACP 会话驱动属 B1，证据标注为「mock 实测」。（规划 391 行「两人可各自建会话」；§2.9；AD-08）
- **BR-11**：员工实例≠会话——同一员工可再开一条独立会话记录，会话不等于员工配置本身。（§2.1 关键规则 3；§2.9）
- **BR-12**：员工有用户可见状态（取值与基线 §4 角色 6 态在员工层的体现一致），角色层显示其下员工的状态汇总；本迭代只呈现状态，不实现状态机迁移（属 B1）。（§4；§2.5）
- **BR-13**：A2 的所有写入只落在项目缓存 `.orch/organization/`，不改 A1 已发现的 CLI 清单、不改用户 CLI 配置、不写用户系统目录。（§7 数据布局；§2.2 边界；§8 第 3 条）
- **BR-14**：用户可见操作的结果在数秒内呈现，拒绝操作给出具体原因而非静默失败或缺省默认值。（§5 能力域 1；用户可感知响应）

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

> **判定锚点约定**：`$MAESTRO_REPO` = 仓库根 `/Users/xuesh/www/Maestro`。每条 AC 的 Given / When / Then 只写用户可见状态与操作；`机检：` / `夹具：` / `架构检查：` 为复核锚点与可构造现场，不是用户可见判定；用户可见操作统一走 `node "$MAESTRO_REPO/bin/orch.js" org ...`（`org` 为本迭代新增命令族，见附录 D-6，`org` 字面只在此约定与机检/夹具出现，不写进 AC 的 Then）。凡涉及「已发现 CLI」的 Given，一律用 §3.3 P-3 的 A1 `cli-registry` mock 夹具构造，不写本机不可构造的现场。

**AC-01 · 从已发现的 CLI 创建角色，四类内容齐全（规划子项：角色 CRUD；规划验收句「选一个已发现的 CLI 建角色」）**
- 场景类型：功能 / 规划验收句核心
- 风险：高（规划 389 / 391 行；关键判断点前置）
- 引用：BR-01, BR-02, BR-08, BR-14
- **Given** 用户在一个独立临时项目根准备好 A1 的已发现 CLI 环境：清单中有至少一条已发现 CLI（名为 Codex CLI），NODE_ENV=test。
- **When** 用户从该清单选一条 CLI 作为起点，创建角色并填写职责、契约、技能、所需 CLI 能力四类内容，指定一个合法部门。
- **Then** 用户看到角色创建成功的反馈；角色详情逐项显示刚填的四类内容与所属部门；用户未输入任何不存在的 CLI。四类内容缺任一项或未选已发现 CLI 时创建被拒并给出具体原因，不产生半截角色。
- 机检：在 `test/wp17/org-crud.test.js`（本迭代新增，见附录 D-8）断言：只从 fixture 的 `clis` 数组读取 cli_id 作为起点；缺任一必需内容返回失败且不落盘；落盘条目含四类内容与合法部门。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a2-role.XXXXXX); # 按 §3.3 P-3 在 $ROOT/.orch/cli-registry.json 放入含 cli_id=codex 的 clis; cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role create --name 产品经理 --from-cli codex --dept 产品部`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`node -e "const fs=require('fs');if(/[\u4e00-\u9fff]/.test(fs.readFileSync('src/org/role.js','utf8')))process.exit(1);console.log('OK')"` → 输出 OK（新增领域层零 CJK，文案唯一来源 `src/cli/labels.js`）；`grep -REn "writeFile|mkdir|appendFile" src/org/role.js` → 零命中（写入只在 registry 层）。

**AC-02 · 查看与修改角色（规划子项：角色 CRUD 的读/改）**
- 场景类型：功能
- 风险：中
- 引用：BR-02, BR-03, BR-14
- **Given** 用户在独立临时项目根按 AC-01 建好一个角色（四类内容齐全），NODE_ENV=test。
- **When** 用户查看该角色详情，并把「技能」与「所需 CLI 能力」各改一项后保存。
- **Then** 用户看到角色详情立即显示修改后的内容，其余内容与部门保持不变；填入空名称或非法部门时修改被拒并给原因，角色保持原样。
- 机检：`test/wp17/org-crud.test.js` 断言四类内容可分别读取与更新，非法更新返回失败且原值不变。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role update 产品经理 --skill 需求分析 --capability acp`；观察 show 输出四项变化项。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'ORG_TEXT|ORG_' src/cli/labels.js` → 命中，空名称/非法部门文案由文案键下发，不硬编码中文。

**AC-03 · 删除角色：有员工时拒删、无员工时删除（规划子项：角色 CRUD 的删）**
- 场景类型：功能 / 异常
- 风险：中
- 引用：BR-03, BR-14
- **Given** 用户在独立临时项目根建好角色 R1（其下已挂 1 名员工）与角色 R2（其下无员工），NODE_ENV=test。
- **When** 用户先尝试删除 R1，再删除 R2，随后查看组织视图。
- **Then** 删除 R1 被拒并提示「请先移除其下员工」，R1 与其员工都仍在；删除 R2 成功，组织视图不再显示 R2；员工不被连带删除。
- 机检：`test/wp17/org-crud.test.js` 断言有员工角色删除返回失败且员工条目不变、无员工角色删除后组织视图无该角色。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role delete 产品经理; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role delete 空角色; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role list`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nF '请先移除其下员工' src/cli/labels.js` → 命中文案键取值（附录 A-2），组织层无中文硬编码。

**AC-04 · 创建员工并绑定具体已发现 CLI（规划子项：员工 CRUD 并绑定具体 CLI）**
- 场景类型：功能 / 规划子项核心
- 风险：高（规划 389 行；员工绑定 CLI 是概念边界）
- 引用：BR-04, BR-05, BR-13, BR-14
- **Given** 用户在独立临时项目根按 AC-01 建好角色，并把角色所需能力声明为 A1 清单中 Codex CLI 已探测具备的能力；清单中另有第二条已发现 CLI；NODE_ENV=test。
- **When** 用户在该角色下创建员工并绑定 Codex CLI。
- **Then** 用户看到员工创建成功，员工出现在该角色下，详情显示它绑定的具体 CLI 是 Codex CLI；未选具体已发现 CLI、或选了未发现的 CLI 时被拒并给原因。角色本身不记录这条绑定。
- 机检：`test/wp17/org-crud.test.js` 断言员工条目的绑定 cli_id 来自 fixture 的 `clis`、与角色定义分离；未发现 cli_id 被拒。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent create --role 产品经理 --name pm-1 --cli codex --dept 产品部 --max-concurrent 2`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'cli_id|capabilities' src/org/agent.js` → 命中员工绑定字段来自 A1 形状；`grep -nF '.orch/organization' src/org/registry.js` → 命中写入点，未触碰 `.orch/cli-registry.json`。

**AC-05 · 查看、修改员工与改绑 CLI（规划子项：员工 CRUD 的读/改）**
- 场景类型：功能
- 风险：中
- 引用：BR-06, BR-12, BR-14
- **Given** 用户在独立临时项目根按 AC-04 建好员工 pm-1，绑定 Codex CLI，NODE_ENV=test。
- **When** 用户查看员工详情（所属角色 / 绑定 CLI / 部门 / 并发上限 / 可见状态），把绑定 CLI 改绑为另一条满足角色所需能力的已发现 CLI。
- **Then** 用户看到详情显示新绑定 CLI 与新配置，员工仍挂在原角色下，角色定义不变；员工详情有可见状态，角色页显示其下员工状态汇总；改绑到未发现 CLI 或能力不满足的 CLI 时被拒并给原因，保持原绑定。
- 机检：`test/wp17/org-crud.test.js` 断言改绑后员工 cli_id 更新、role_id 不变；非法改绑返回失败且原值不变；状态字段以枚举值呈现（BR-12）。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent show pm-1 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent update pm-1 --cli claude-code`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -REn 'transit|CAS' src/org/` → 零命中（本迭代不实现状态迁移，状态仅可见呈现，属 B1）。

**AC-06 · 删除员工（规划子项：员工 CRUD 的删）**
- 场景类型：功能
- 风险：中
- 引用：BR-06
- **Given** 用户在独立临时项目根建好员工 pm-1，NODE_ENV=test。
- **When** 用户删除 pm-1 并查看角色页。
- **Then** 用户看到 pm-1 从角色下消失；若该员工有会话记录，用户看到「其会话记录仍保留」的提示，不静默丢弃可见记录；角色本身不受影响。
- 机检：`test/wp17/org-crud.test.js` 断言删除后员工条目消失、角色条目不变、会话记录不随员工删除被静默清除。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent delete pm-1 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）。

**AC-07 · 一角色挂 2 名员工（规划子项：一角色多员工 / 验收句「挂 2 名员工」）**
- 场景类型：功能 / 规划子项核心 / 关键判断点
- 风险：高（规划 390 / 391 行；「角色≠Agent 是否落地」关键判断点）
- 引用：BR-04, BR-05, BR-07
- **Given** 用户在独立临时项目根按 AC-01 建好角色，A1 清单中有两条已发现 CLI，两者都满足该角色声明的所需能力；NODE_ENV=test。
- **When** 用户在该角色下创建两名员工，分别绑定这两条不同的已发现 CLI，再查看角色页。
- **Then** 用户看到同一角色下列出多名员工，各自有独立名称、绑定 CLI、部门与状态；角色定义（四类内容与部门）与只有一名员工时完全一致；角色≠Agent 对用户可见——角色是定义，员工是绑定到 CLI 的执行体。
- 机检：`test/wp17/org-crud.test.js` 断言同一 role_id 下 3 条 agent 记录、cli_id 可不同、role 记录不因 agent 数量变化；拒绝同角色同名员工。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent create --role 产品经理 --name pm-2 --cli claude-code --dept 产品部 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'members|agents|role_id' src/org/registry.js` → 命中「角色 → 员工列表」的关系存储，形状对齐 §2.3。

**AC-08 · 部门归属 CRUD 与校验（规划子项：部门归属）**
- 场景类型：功能 / 异常
- 风险：中
- 引用：BR-08, BR-14
- **Given** 用户在独立临时项目根准备创建角色与员工，NODE_ENV=test。
- **When** 用户分别用六个部门之一、空部门、六部门之外的名称创建角色和员工。
- **Then** 合法部门时角色/员工创建成功并显示所属部门，组织视图能按六部门归类；空部门或六部门之外名称时创建被拒并给出可见原因，不产生「无部门」对象。
- 机检：`test/wp17/org-crud.test.js` 断言部门枚举恰为六项（产品部/研发管理部/前端部/后端部/测试部/平台安全部），非法值返回失败且不落盘。
- 夹具：`cd "$ROOT" && for d in 产品部 研发管理部 前端部 后端部 测试部 平台安全部; do NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role create --name "角色-$d" --from-cli codex --dept "$d"; done; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role create --name 非法 --from-cli codex --dept 不存在部`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'DEPARTMENTS|产品部|平台安全部' src/org/department.js src/cli/labels.js` → 命中六部门枚举且中文只在 labels.js，领域层零 CJK。

**AC-09 · 角色能力校验：满足/不满足/未探测（规划子项：角色能力校验）**
- 场景类型：功能 / 异常
- 风险：高（规划 390 行；§8 第 4 条「按能力而非名称」）
- 引用：BR-09, BR-04, BR-14
- **Given** 用户在独立临时项目根建好角色，所需能力声明为 ACP 支持；A1 清单中 Codex CLI 已探测支持 ACP，第二条 CLI 的该项能力为「未探测」；NODE_ENV=test。
- **When** 用户尝试把员工绑定到 Codex CLI、再尝试绑定到第二条（能力未探测的）CLI，并查看结果。
- **Then** 绑定到 Codex CLI 被允许；绑定到「未探测」的 CLI 被拒并提示「未探测，无法判定满足」，不臆造为支持；用户看到的判定依据是能力而非 CLI 名称；清单中不存在的能力项也被拒。
- 机检：`test/wp17/org-capability.test.js` 断言校验只消费 A1 五维能力字段（acp / transport / resume_dialect / max_concurrent_sessions / evidence_hook），未探测值按不可判定处理；不出现按 name/cli_id 硬配的分支。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent create --role 产品经理 --name ok-1 --cli codex --dept 产品部 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent create --role 产品经理 --name bad-1 --cli unknown-cap --dept 产品部`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'acp|transport|resume_dialect|max_concurrent_sessions|evidence_hook' src/org/validation.js` → 命中五维判定；`node -e "const fs=require('fs');if(/[\u4e00-\u9fff]/.test(fs.readFileSync('src/org/validation.js','utf8')))process.exit(1);console.log('OK')"` → 输出 OK。

**AC-10 · 角色不绑定死某个 CLI（规划验收句末句）**
- 场景类型：功能 / 规划验收句核心
- 风险：高（规划 391 行；§2.1 关键规则 2；§8 第 4 条）
- 引用：BR-05, BR-09, BR-07
- **Given** 用户在独立临时项目根按 AC-04 建好员工 pm-1 绑定 Codex CLI，角色四类内容与部门已固定；A1 清单中另有第二条满足角色所需能力的已发现 CLI；NODE_ENV=test。
- **When** 用户把 pm-1 的绑定 CLI 从 Codex CLI 换成第二条已发现 CLI，随后查看角色详情与员工详情。
- **Then** 员工详情显示新绑定 CLI；角色详情的四类内容、部门、所需能力与换绑前逐字一致；用户据此确认角色没有绑定死某个 CLI。若换成不满足能力的 CLI，改绑被拒且角色同样不变。
- 机检：`test/wp17/org-capability.test.js` 断言换绑前后 role 记录深层相等、agent.cli_id 改变；用满足/不满足两组 CLI 各跑一次。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理 > /tmp/role-before.txt && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent update pm-1 --cli claude-code && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理 > /tmp/role-after.txt && diff /tmp/role-before.txt /tmp/role-after.txt` → 无差异。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'cli_id' src/org/role.js` → 零命中（角色定义不含固定 cli_id 绑定字段）。

**AC-11 · 两人可各自建会话（规划验收句；A2 会话记录语义）**
- 场景类型：功能 / 规划验收句核心
- 风险：高（规划 391 行；AD-08 证据分级）
- 引用：BR-09, BR-10, BR-13, BR-14
- **Given** 用户在独立临时项目根按 AC-07 建好一个角色和两名员工（pm-1 绑定 Codex CLI、pm-2 绑定第二条满足能力的已发现 CLI），NODE_ENV=test；证据级别标注为「mock 实测」。
- **When** 用户分别为 pm-1 与 pm-2 各创建一条会话记录，随后查看会话列表。
- **Then** 用户看到两条独立会话记录，各自显示所属员工、使用哪个已发现 CLI、创建时间；两条记录互不串台。用户看到的是「会话记录已创建」，不是真实推理输出；会话状态取可见枚举值，证据级别显示「mock 实测」。
- 机检：`test/wp17/org-session.test.js` 断言两条会话记录 session_id 不同、agent_id 分别对应两名员工、cli_id 取各自员工的已发现 cli_id；未绑 CLI 或能力不满足的员工创建会话被拒；取证数据来自 mock 夹具、证据级别字符串为 CLI/org 文案键的「mock 实测」取值。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session create --agent pm-1 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session create --agent pm-2 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session list`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -REn 'session/(new|prompt)|spawn|initialize' src/org/` → 零命中（A2 不启动真实 ACP 会话，仅创建记录，真实驱动属 B1）；`grep -nF 'mock 实测' src/cli/labels.js` → 命中证据分级文案键（附录 A-8）。

**AC-12 · 员工实例≠会话：同一员工可开多条会话（§2.1 关键规则 3）**
- 场景类型：功能 / 概念边界
- 风险：高（v2 概念核心，评审重点）
- 引用：BR-11, BR-10
- **Given** 用户在独立临时项目根按 AC-11 为 pm-1 创建好第一条会话记录，NODE_ENV=test。
- **When** 用户再次为同一名 pm-1 创建第二条会话记录，随后查看该员工的会话列表。
- **Then** 用户看到 pm-1 名下出现两条独立会话记录，各自有自己的标识与创建时间；员工本身仍只有一条配置。用户据此确认「员工实例≠会话」，同一员工可在不同任务中开多个会话。
- 机检：`test/wp17/org-session.test.js` 断言同一 agent_id 下存在两条不同 session_id 的记录，且 agent 配置记录数不变。
- 夹具：`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session create --agent pm-1 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session list --agent pm-1` → 两条记录。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -nE 'agent_id|session_id' src/org/session.js` → 命中两条独立标识，会话记录不复用员工配置标识。

**AC-13 · 规划验收句整句端到端（不降级、不收窄、不合并）**
- 场景类型：功能 / 规划验收句整句
- 风险：高（规划 391 行整句；阶段 A 形态前置）
- 引用：BR-01, BR-04, BR-07, BR-10, BR-05
- **Given** 用户在独立临时项目根准备好 A1 已发现 CLI 清单（至少两条满足所需能力的 CLI，均来自 A1 `cli-registry` mock 夹具），NODE_ENV=test；证据级别「mock 实测」。
- **When** 用户从清单选一条 CLI 建角色并填齐四类内容 → 在该角色下挂 2 名员工（各绑一条已发现 CLI，归属合法部门）→ 为两名员工各创建一条会话记录 → 把其中一名员工的 CLI 换绑为另一条满足能力的已发现 CLI → 查看角色详情。
- **Then** 用户完成规划验收句全流程：角色由已发现 CLI 起步创建、角色下确有 2 名员工、两人各有独立会话记录且互不串台、换绑员工 CLI 后角色定义逐字不变；四段结论分别可判、合起来不降级。会话证据级别显示「mock 实测」，不宣称真实 ACP 会话已跑通。
- 机检：`test/wp17/org-acceptance.test.js` 串联 AC-01 / AC-07 / AC-11 / AC-10 的断言为一条端到端进程级用例，逐段输出可判定结果；会话面断言证据级别为「mock 实测」。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a2-acceptance.XXXXXX); # 按 §3.3 P-3 在 $ROOT/.orch/cli-registry.json 放入 cli_id=codex、cli_id=claude-code 两条满足所需能力的 clis; cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role create --name 产品经理 --from-cli codex --dept 产品部 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent create --role 产品经理 --name pm-1 --cli codex --dept 产品部 --max-concurrent 2 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent create --role 产品经理 --name pm-2 --cli claude-code --dept 产品部 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session create --agent pm-1 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org session create --agent pm-2 && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理 > /tmp/role-before.txt && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org agent update pm-1 --cli claude-code && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role show 产品经理 > /tmp/role-after.txt && diff /tmp/role-before.txt /tmp/role-after.txt`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（AD-07）；`grep -REn "install|chmod|writeFile" src/cli/org.js` → 零命中（不安装/不修改 CLI、CLI 层不直接落盘）。

### 3.2 非功能验收标准

- **NF-1（用户可感知的响应）**：用户创建角色、创建/改绑员工、查看能力校验结果、创建会话记录后，在数秒内看到结果或明确的「处理中 / 校验中」反馈；被拒绝的操作给出具体原因而非静默失败或缺省默认值。（BR-14；§2.2~§2.9）
- **NF-2（数据与配置隔离）**：用户完成 A2 操作后，A1 的已发现 CLI 清单与用户 CLI 自身配置不发生任何可见变化；新增写入只出现在项目缓存 `.orch/organization/`。（BR-13；§7；§8 第 3 条）
- **NF-3（证据分级真实）**：所有会话相关判定按「mock 实测 / 待本机实测（需装有目标 CLI 的机器）/ 已实测（真实宿主面）」分级标注；A2 的「两人可各自建会话」为「mock 实测」，真实 ACP 会话驱动属 B1，未取证前不写「真实宿主达标」，mock 结果 0 次冒充真实证据。（BR-10；AD-08；附录 A-8）
- **NF-4（中文唯一来源 / 零 CJK）**：新增中文只经 `src/cli/labels.js` 的 `ORG_TEXT` 下发；新增领域层（`src/org/**`）保持零 CJK；六部门名、错误原因、证据级别、状态词均有文案键，不硬编码。（§5；AD-07；AC-08 / AC-09 架构检查）
- **NF-5（基线不回归）**：按 AD-06 等效口径，受影响面串行 + git worktree 基线树对照，新增红差集为 0；A1 的 `test/wp16/cli-*.test.js` 既有断言、既有文案表计数断言逐字不放宽；不因新增 `org` 命令族改动 A1 的 `cli` 命令分派行为。（AD-05 / AD-06；附录 D-8）

### 3.3 验收前置条件

- **P-1（仓库与环境）**：在仓库根 `/Users/xuesh/www/Maestro` 执行；macOS / zsh / Node v22.22.2；当前 HEAD `3e47a51`；所有复核脚本注入 `NODE_ENV=test`（AD-04）。
- **P-2（独立项目根）**：每条 AC 用 `ROOT=$(mktemp -d /tmp/maestro-a2-<场景>.XXXXXX)` 作为独立项目根（macOS 用 `os.tmpdir()`，非 `%TEMP%`，AD-04）；所有夹具文件都放进该临时树，不触碰用户真实 `~/.codex`、`PATH`、`/Applications`、真实全局 npm 包。
- **P-3（A1 已发现 CLI 的 mock 夹具，构造「已发现 CLI」的唯一方式）**：在独立项目根写入一份 A1 形状的 `.orch/cli-registry.json`，至少两条 `clis` 条目，字段含 `cli_id` / `name` / `executable` / `capabilities` 与五维 `acp` / `transport` / `resume_dialect` / `max_concurrent_sessions` / `evidence_hook` / `connection_status`，`schemaVersion: 1`。其中一条设为 `cli_id=codex` / `name=Codex CLI` / `acp=true` / `max_concurrent_sessions=3` / `connection_status=idle`；另一条设为 `cli_id=claude-code` / `name=Claude Code` / 同样满足所需能力；如需「未探测 / 能力不满足」现场，追加第三条并把对应维度设为 `null`。示例：在 `$ROOT` 下用 `node -e` 写 JSON 到 `$ROOT/.orch/cli-registry.json`（形状逐字对齐 A1 的 `registry.js` `saveCliRegistry` 输出），或复用 A1 的 `test/wp16/cli-acceptance.test.js` 的 `mockAgent()` + `orch cli scan` 生成后再补五维字段。凡 AC 中出现「已发现 CLI」，Given 必须以此夹具构造，不写本机不可构造的现场。
- **P-4（用户可见操作接缝）**：用户可见操作走 `node "$MAESTRO_REPO/bin/orch.js" org ...`（`org role create|show|update|delete|list`、`org agent create|show|update|delete`、`org session create|list`，命令字面为实现建议，见附录 D-6）；`org` 字面只出现在判定锚点约定与机检/夹具，不写进 AC 的 Then。角色/员工/会话的可构造性只依赖 P-2 / P-3，不依赖真实宿主。
- **P-5（全量门禁等效口径，AD-06）**：本机按 AD-06 采用受影响面串行 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` + git worktree 基线树对照、新增红差集 0；报告须如实标注本机限制（历史并发 EXIT 137 / 全量非零退出 / flaky 偏差），不放宽任何 AC 判据。A1 既有断言逐字保留（NF-5）。**本轮实跑基线数字（2026-11-23，仓库根 `/Users/xuesh/www/Maestro`，`NODE_ENV=test`，全量 `node --test "test/**/*.test.js"`）：`# tests 1983` / `# pass 1963` / `# fail 17` / `# skipped 3` / `# cancelled 0` / `# todo 0` / `duration_ms 502534`；另一次同命令 `tail -4` 实跑为 `# skipped 3` / `# cancelled 0` / `# todo 0` / `duration_ms 401651`。两次全量耗时约 6~8.5 分钟，属 AD-06 所记本机并发负载过重 / 耗时过长情形，故按 AD-06「受影响面串行 + git worktree 基线树对照、新增红差集 0」等效口径收口；17 条红为当前基线树既有（本轮仅改需求文档、零源码改动），新增红差集 0；不放宽任何 AC 判据。**
- **P-6（证据分级约束，AD-08）**：AC-11 / AC-12 / AC-13 的会话面一律在 `NODE_ENV=test` mock 夹具上取证，结果标注「mock 实测」；真实 ACP 会话驱动属 B1，取证机器由主控/用户安排，未取证前相关 B1 AC 判阻塞，不得用 A2 的 mock 结果顶替。

---

## 附录 A · 输出基线（用户可见文案）

### A-0 可变值约定与文案键

- 占位符取证时按实际值替换：`[角色名]` / `[员工名]` / `[部门]` / `[CLI 名]` / `[能力项]` / `[原因]` / `[时间]` / `[数量]` / `[状态]`。
- 下列中文为用户可见且本迭代新增/涉及，统一由 `src/cli/labels.js` 的 `ORG_TEXT` 下发，不硬编码；A1 的 `CLI_DISCOVERY_TEXT` 现有键取值逐字不变，只追加独立新表：`组织视图`、`角色列表`、`员工列表`、`会话记录`、`职责`、`契约`、`技能`、`所需 CLI 能力`、`所属部门`、`绑定 CLI`、`并发上限`、`可见状态`、`创建角色`、`创建员工`、`创建会话记录`、`角色创建成功`、`员工创建成功`、`会话记录已创建`、`请先移除其下员工`、`未选择已发现的 CLI`、`四类内容不得为空`、`部门必须为六部门之一`、`未发现该 CLI`、`能力未探测，无法判定满足，请先做能力探测`、`不满足所需能力：缺少 {cap}`、`证据级别：{level}`、`mock 实测`、`待本机实测（需装有目标 CLI 的机器）`、`已实测（真实宿主面）`、`角色定义未改变`。
- 部门枚举固定为六个中文键（经 `ORG_TEXT` 下发，领域层零 CJK）：`产品部` / `研发管理部` / `前端部` / `后端部` / `测试部` / `平台安全部`。
- 五维能力展示词沿用 A1 能力矩阵：ACP / transport（传输方式）/ 会话恢复方言 / 并发上限 / 证据钩子；「未探测」按 A1 口径显示，不写成「不支持」。
- 员工可见状态取值与基线 §4 角色 6 态在员工层的体现一致，角色 6 态逐字取值为 `inactive` / `available` / `busy` / `cooldown` / `unavailable` / `retired`（来自 `docs/index.md` §4）；本迭代仅呈现、不迁移，状态机迁移属 B1（BR-12 / AD-08）。

### A-1 角色创建与详情

```
角色创建成功
名称：[角色名]  所属部门：[部门]
职责：[职责]  契约：[契约]  技能：[技能]  所需 CLI 能力：[能力项]
创建起点：[CLI 名]（仅起点提示，角色不绑定该 CLI）
```

### A-2 角色 CRUD 异常提示

```
创建失败：未选择已发现的 CLI
创建失败：四类内容不得为空（职责/契约/技能/所需 CLI 能力）
删除失败：请先移除其下员工
```

### A-3 员工详情

```
员工：[员工名]  所属角色：[角色名]
绑定 CLI：[CLI 名]  所属部门：[部门]  并发上限：[数量]  可见状态：[状态]
```

### A-4 员工创建 / 改绑提示

```
员工创建成功
改绑成功：绑定 CLI 已更新为 [CLI 名]（角色定义未改变）
创建失败：未发现该 CLI / 不满足所需能力：缺少 [能力项] / 部门必须为六部门之一
```

### A-5 一角色多员工

```
角色：[角色名]  员工数：[数量]
  - [员工名1]  绑定 CLI：[CLI 名]
  - [员工名2]  绑定 CLI：[CLI 名]
```

### A-6 能力校验结果

```
能力校验：满足（依据 [能力项]），可以绑定 / 建会话
能力校验：不满足——[原因]
能力未探测，无法判定满足，请先做能力探测
```

### A-7 部门归属校验

```
部门：产品部 / 研发管理部 / 前端部 / 后端部 / 测试部 / 平台安全部
创建失败：部门必须为六部门之一
```

### A-8 会话记录与证据分级

```
会话记录已创建  [员工名]  [CLI 名]  [时间]
会话记录列表：[数量] 条（同一员工可有多条）
证据级别：mock 实测
```

会话面一律写「mock 实测」；不写「已实测（真实宿主面）」，真实 ACP 驱动取证属 B1（NF-3 / P-6）。

## 附录 B · 术语与未决问题

### B-1 术语

- **角色（Role）**：职责与契约的宿主无关定义，含职责 / 契约 / 技能 / 所需 CLI 能力四类内容；不绑定具体 CLI（`docs/index.md` §2.1 五层模型）。
- **员工（Agent）**：角色的一个可调度执行体，绑定一个 A1 已发现的具体 CLI；角色≠Agent，一个角色可挂多名员工（§2.1 关键规则 1/2）。
- **会话记录（Session Record）**：A2 层面为某员工创建的一条会话记录，关联该员工与其已发现 `cli_id`；不等于员工配置，同一员工可有多条（§2.1 关键规则 3）。真实 ACP 会话驱动属 B1。
- **所需 CLI 能力**：角色声明的对员工载体的能力要求，判定维度沿用 A1 五维（ACP / transport / 会话恢复方言 / 并发上限 / 证据钩子，锚定 §2.2:128 与 §5:223）；声明能力 ≠ 绑定 CLI（§8 第 4 条）。
- **六部门**：产品部 / 研发管理部 / 前端部 / 后端部 / 测试部 / 平台安全部（§1.3【搭团队】/ §2.3）；A2 只做归属 CRUD 与校验，团队编排属 A3。
- **A1 已发现 CLI**：经 A1 扫描写入 `.orch/cli-registry.json` 的 `clis` 条目，含 `cli_id` 与五维能力；A2 只读消费，不重新发现。
- **mock 实测 / 待本机实测 / 已实测**：证据分级三态（沿用 A1 附录 A-7）；A2 会话面为「mock 实测」，真实 ACP 会话驱动未取证前判阻塞（AD-08）。

### B-2 未决问题与假设（含是否阻塞）

- **U-01（不阻塞；范围已界定）**：A2 的「两人可各自建会话」按 AC-11 定义为「创建两条独立会话记录」的可验证语义，真实 ACP 会话驱动 / 恢复方言 / 状态机迁移属 B1 范围外。该口径已写入 §1.3 范围外、§2.9 边界、BR-10、AC-11、P-6、附录 A-8，无需评审另裁；本轮评审 AS-01 已确认：A2 会话为语义层记录、mock 取证，真实驱动归 B1，AC-11 保持不变；若主控改判 A2 必须驱动真实会话，须把 B1 工作前置并重新拆迭代，不接受默默放宽 AC-11。
- **U-02（不阻塞；默认已定，需评审知悉）**：所需能力的判定维度默认直接用 A1 五维（`acp` / `transport` / `resume_dialect` / `max_concurrent_sessions` / `evidence_hook`），不新引入命名空间写法（如 §2.1 举例的 `acp.acp_support` / `workspace.isolation`）。理由：与 A1 已落地的能力矩阵同源、可校验、不臆造。若评审要求支持命名空间式能力标签，需同步改 §2.8 / BR-09 / AC-09 机检 / 附录 A-0 五维展示词，不放宽「未探测不臆造、按能力而非名称」的判据。
- **U-03（不阻塞；默认已定）**：验收句「挂 2 名员工」的两名员工默认绑定 A1 mock 夹具中两条不同的已发现 CLI，以同时证明「一角色多员工」与「角色不绑定死某个 CLI」；本机只有 WorkBuddy.app 的客观限制（D-2 / D-4）用 P-3 夹具绕过，不依赖真机多 CLI。若评审要求两名员工绑定同一 CLI 也判通过，需明确该变体并补一条 AC，不删 AC-07 / AC-10。
- **U-04（不阻塞；默认已定）**：用户可见操作面默认采用 `org` 命令族（附录 D-6），桌面组织/部门视图属 C1。命令字面为实现建议、不写进 AC 的 Then（§3.1 约定 / P-4）；若主控另指定命令字面，只改实现锚点与机检/夹具，不放宽任何 AC。
- **U-05（不阻塞；范围外已界定）**：`docs/index.md` §3.3 待验证项「一角色多员工是否产生工作区串台」的真实并行验证属 A5 / B1；A2 只验证「关系可建立、角色不随员工变化」，不验证并发执行。若评审要求 A2 提前验证串台，须把 A5 相关工作前置，不接受据此放宽 AC-07。

## 附录 C · 变更记录

| 版本 | 日期 | 变更内容 | 变更位置 |
|---|---|---|---|
| v1 | 2026-11-23 | 初稿：按三件套撰写完整 8 节。第一部分逐字落地规划 389~391 行：389 行「角色 CRUD（职责/契约/技能/所需 CLI 能力）」→ §2.2 / §2.3 → AC-01/02/03；389 行「员工 CRUD 并绑定具体 CLI」→ §2.4 / §2.5 → AC-04/05/06；390 行「一角色多员工」→ §2.6 → AC-07、「部门归属」→ §2.7 → AC-08、「角色能力校验」→ §2.8 → AC-09；391 行验收句四部分分别落到 AC-01 / AC-07 / AC-11 / AC-10，并由 AC-13 端到端联合判定，不降级。三条 v2 概念核心边界（角色≠Agent / 角色不绑定 CLI 而员工绑定 CLI / 员工实例≠会话）显式落入 §2.6/§2.2/§2.4/§2.8/§2.9 与 AC-07/10/12。建立 BR-01~BR-14、AC-01~AC-13、NF-1~NF-5；显式处理范围外（Team/工作流/真实 ACP 驱动/调度/多宿主/桌面/只读边界）与 AD-04/06/08 口径；登记未决 U-01~U-05。交独立评审，不自行宣布通过。 | 全文；头部版本 = 本表末行 |
| v2 | 2026-11-23 | 轮次1 / 修 F-01~F-04 + AS-01 裁决记录：F-01 AC-07 When「第二名与第三名员工」改「两名员工」（措辞，判定不变）；F-02 附录 A-0 逐字列角色 6 态取值并标仅呈现不迁移（B1）；F-03 AC-13 夹具改为独立 root + NODE_ENV=test + 可执行命令链；F-04 按 AD-06 在 §3.3 P-5 补记全量基线数字与新增红差集 0；AS-01 在附录 B U-01 标注评审已确认会话为语义层记录、mock 取证、真实驱动归 B1，AC-11 不变。13 AC / 14 BR / 8 节结构不变，不放宽任何 Then。 | AC-07 When、附录 A-0、AC-13 夹具、§3.3 P-5、附录 B U-01、头部版本；头部版本 = 本表末行 |

## 附录 D · 实现约束（技术要点，仅供编码参考，不进入需求判定）

> 本附录是实现建议，不写入 §2 / §3 正文；评审与验收以第二 / 第三部分及附录 A 为准。文件 / 行号为当前仓库现状定位（HEAD `3e47a51`），实现时若漂移以「只改授权清单所列段、保持逐字基线」为准。

### D-1 现状差距（上游 A1 已提供 vs 本需求）

- 已具备（现状参考，不作需求来源）：A1 的 `.orch/cli-registry.json`（`clis` 数组含 `cli_id` / `capabilities` / 五维能力字段 / `connection_status`，`src/adapter/cli-discovery/registry.js:127-150`）、能力矩阵五维常量（`capability-matrix.js:13-19`）、`bin/orch.js:24-28` 的 `cli` 命令分派、`src/cli/labels.js:1254` 的 `CLI_DISCOVERY_TEXT`、A1 测试 `test/wp16/cli-*.test.js`。当前仓库无 `src/org/**`。
- 差距（S2 需补齐，均已在本需求 §2/§3 有落点）：① 角色 CRUD 与四类内容（AC-01/02/03）；② 员工 CRUD 与绑定具体 CLI（AC-04/05/06）；③ 一角色多员工关系（AC-07）；④ 部门归属枚举与校验（AC-08）；⑤ 能力校验按 A1 五维、按能力而非名称（AC-09/10）；⑥ 会话记录创建与两条独立、员工实例≠会话（AC-11/12）；⑦ `org` 命令族与 `ORG_TEXT` 文案表（NF-4 / P-4）。
- 不得因「已有 A1 代码」而跳过任何 AC；A1 已有实现先于本编排完成（AD-05），其代码只作向后兼容/范围外说明，A2 仍走完整流程。

### D-2 数据布局与事实源

- 新增写入只在 `.orch/organization/`（§7）：建议分文件存 `departments.json` / `roles.json` / `agents.json` / `sessions.json`，或单一 `organization.json` 分段；具体划分由拆分文档定，遵循「AC → WP 满覆盖、文件零交集」。
- A1 的 `.orch/cli-registry.json` 是只读上游输入：角色/员工/会话只引用其 `cli_id` 与五维能力，不写回、不修改（BR-13 / NF-2）。能力判定的唯一数据源是注册清单的 `clis` 数组，不引入第二份能力数据（呼应 A1 D-4）。
- 写入原子化（临时文件 + rename），与 A1 `registry.js` 纪律一致；员工删除不静默清除其会话记录（AC-06）。

### D-3 对象关系（§2.1 / §2.3 形状）

- 角色 → 员工列表：一个 `role_id` 对应 N 个 `agent_id`（§2.3 `members: role → agents`）；角色记录不含固定 `cli_id` 绑定字段（AC-10 架构检查）。
- 员工绑定：每条员工含 `role_id` / `cli_id` / 部门 / 并发上限 / 可见状态；`cli_id` 必须来自 A1 `clis`（AC-04 / AC-09）。
- 会话记录：每条含独立 `session_id` / `agent_id` / `cli_id` / 创建时间 / 可见状态；同一 `agent_id` 可多条（AC-12）。
- 可见状态：员工状态取基线 §4 角色 6 态在员工层的枚举值，仅呈现、不实现 `transit()` / CAS（AC-05 架构检查，属 B1）。

### D-4 能力校验（AC-09 / AC-10）

- 只消费 A1 五维字段 `acp` / `transport` / `resume_dialect` / `max_concurrent_sessions` / `evidence_hook`（`capability-matrix.js:13-19`）；`null` / 未探测按「无法判定满足」处理，不臆造为支持；不出现按 `name` / `cli_id` 硬配的分支（§8 第 4 条）。
- 所需能力项若在能力清单里不存在，绑定/改绑被拒（AC-09）；校验通过才可建会话（AC-11）。
- 校验函数纯函数、零 CJK、可单测（`src/org/validation.js`）。

### D-5 中文文案（附录 A 落地）

- 在 `src/cli/labels.js:1254` 的 `CLI_DISCOVERY_TEXT` 之外**追加独立 `ORG_TEXT` 表**，A1 现有键取值逐字不动（A-0 不变基线）；`test/wp2/labels.test.js:271`（`REASON_LABEL` 49 键）、`test/wp9/i19-labels.test.js:293` / `test/wp15/regression.test.js:156`（`USAGE_LINES` 25 行）、`test/wp14/labels-drill.test.js:303-312`（`DESKTOP_LABEL_KEYS` 64+63 键）、`test/wp13/checkpoint.test.js:105`（checkpoint 全键冻结）等既有计数断言不受独立新表影响；若变红属越界改动，须回退实现而非放宽断言（NF-5）。
- 六部门名、错误原因、证据级别、状态词均经 `ORG_TEXT` 下发；新增领域层 `src/org/**` 零 CJK（AD-07 / NF-4）。

### D-6 命令面（P-4 的实现建议）

- 在 `bin/orch.js:24-28` 的 `argv[0] === 'cli'` 分支之后追加 `argv[0] === 'org'` 分支，转调 `src/cli/org.js` 的 `orgMain`；既有 `core serve` 内部通道与 `cli` 分支行为不动（向后兼容）。
- `org` 子命令建议：`role create|show|update|delete|list`、`agent create|show|update|delete`、`session create|list`；flag 建议 `--name` / `--from-cli` / `--cli` / `--role` / `--dept` / `--skill` / `--capability` / `--max-concurrent` / `--agent`。这些字面为实现建议，仅进入机检/夹具/P-4，不写进 AC 的 Then（U-04）。
- `--format json` 机器输出直接 JSON.stringify 组织对象，无渲染层（对齐 A1 CLI 纪律）。

### D-7 测试与夹具接缝（全局）

- 独立项目根 `$(mktemp -d /tmp/maestro-a2-<场景>.XXXXXX)`（macOS `os.tmpdir()`，AD-04）；统一 `NODE_ENV=test`。
- 「已发现 CLI」夹具按 P-3：直接写 A1 形状的 `.orch/cli-registry.json`，或复用 `test/wp16/cli-acceptance.test.js` 的 `mockAgent()` + `orch cli scan` 生成后补五维字段；不触碰真实本机 CLI。
- 新增测试建议放 `test/wp17/`：`org-crud.test.js`（AC-01~08）、`org-capability.test.js`（AC-09/10）、`org-session.test.js`（AC-11/12）、`org-acceptance.test.js`（AC-13）；进程级用例走 `bin/orch.js`。
- 全量门禁按 AD-06：受影响面串行 + git worktree 基线树对照、新增红差集 0；purity 禁词表按 AD-07 口径不变（11 词并集扫 `src/core,src/daemon`），新增领域层遵守零 CJK。

### D-8 授权断言修改清单（点名文件 + 行号 + 只改哪一段）

> 下列为当前 HEAD `3e47a51` 现状定位；「只加不改」——新行为打破既有精确断言时只扩本清单，不许弱化功能、不许删 AC/BR。

- `bin/orch.js:24-28`：在 `cli` 分支之后追加 `org` 分支（D-6 / AC-01/13）；`core serve` 内部通道与 `cli` 分支逐字不动。
- `src/cli/labels.js:1254`：在 `CLI_DISCOVERY_TEXT` 之后追加独立 `ORG_TEXT` 表（D-5 / A-0）；A1 现有键取值逐字不动。
- 新增 `src/org/**`（`department.js` / `role.js` / `agent.js` / `session.js` / `validation.js` / `registry.js` / `index.js`）：实现部门枚举、角色/员工/会话关系、能力校验、`.orch/organization/` 读写；领域层零 CJK（AC-09/10/11/12 架构检查）。
- 新增 `src/cli/org.js`：`org` 命令族分派与 flag 解析（D-6）；只登记/读写项目缓存，不安装/不修改 CLI（AC-13 架构检查）。
- 新增 `test/wp17/org-*.test.js`：AC-01~AC-13 的新断言（D-7）；既有 A1 断言逐字不改、不放宽。
- **已核、明确不改的精确断言**：`test/wp2/labels.test.js:271`、`test/wp9/i19-labels.test.js:293`、`test/wp15/regression.test.js:156`、`test/wp14/labels-drill.test.js:303-312`、`test/wp13/checkpoint.test.js:105`（D-5 计数断言）；`test/wp16/cli-discovery.test.js` / `cli-probe.test.js` / `cli-add.test.js` / `cli-matrix-data.test.js` / `cli-command.test.js` / `cli-acceptance.test.js`（A1 断言，NF-5）。若实现期发现任何上述断言变红，属越界改动，须回退实现而非放宽断言。

### D-9 编号与标题形态

- BR-01~BR-14、AC-01~AC-13、NF-1~NF-5 连续编号；每条 AC 含 `场景类型 / 风险 / 引用` 三件套与 `机检：` / `夹具：` / `架构检查：` 判定锚点；每条 AC 引用至少一个真实存在的 BR，每条 BR 至少被一条 AC 引用（双向覆盖）。
- 规划 389~391 行逐字映射：389 行「角色 CRUD（职责/契约/技能/所需 CLI 能力）」→ §2.2 + §2.3 → AC-01/02/03；389 行「员工 CRUD 并绑定具体 CLI」→ §2.4 + §2.5 → AC-04/05/06；390 行「一角色多员工」→ §2.6 → AC-07；390 行「部门归属」→ §2.7 → AC-08；390 行「角色能力校验」→ §2.8 → AC-09；391 行验收句前半「选一个已发现的 CLI 建角色」→ §2.2 → AC-01；391 行「并挂 2 名员工」→ §2.6 → AC-07；391 行「两人可各自建会话」→ §2.9 → AC-11（mock 面，分级）；391 行末句「角色不绑定死某个 CLI」→ §2.8 → AC-10；391 行整句 → §2.10 → AC-13。反向扫描无「夹带」，规划无条目落入范围外。
- 三条概念核心边界映射：角色≠Agent → §2.6 / AC-07；角色不绑定 CLI 而员工绑定 CLI → §2.2 / §2.4 / §2.8 / AC-01 / AC-04 / AC-10；员工实例≠会话 → §2.9 / AC-12。
