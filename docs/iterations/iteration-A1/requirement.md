# A1 — Agent CLI 发现与罗列 · 完整需求文档

- **迭代号**：A1 / 阶段 A（核心形态闭环，产品第一入口）
- **依据章节**：`docs/index.md` 第一部分全文——§1 定位与形态（§1.1 一句话定位、§1.2 它不是什么、§1.3 核心用户旅程、§1.4 App 形态与 CLI 发现页、§1.5 与宿主 CLI 并列不嵌套、§1.6 任务类型与产物）、§2 概念模型（§2.1 五层模型、§2.2 Agent CLI 发现与注册含发现来源表/能力探测/数据模型/边界、§2.3 Agent Team、§2.4 工作流与阶段、§2.5 统一项目知识库）、§3 架构（§3.1 Control Plane、§3.2 ACP 通用会话协议、§3.3 待验证项之「CLI 发现覆盖率 / 能力探测可靠性」）、§4 状态模型（连接状态 `idle | connected | unreachable | probing` 与核心不变量）、§5 核心能力域（能力域 0「Agent CLI 发现与接入」全部含 D-2 技术调研结论与集成策略、能力域 1 对员工绑定 CLI 的后续依赖）、§6 内置场景模板（作为目标场景之一，非本迭代范围）、§7 运行时模型与数据布局（`cli-registry.json`）、§8 边界声明（第 1/2/3/4/8 条）；第二部分 `### A1 — Agent CLI 发现与罗列`（3 个子项 + **验收**句 + **证据前提**句逐字）、`阶段 A 退出条件`、`关键判断点`表 A1 行；附录待裁决清单 D-2 / D-4；`docs/iterations/A-phase-decisions.md` 裁决 AD-01~AD-10（尤其 AD-05 已有实现仅作现状参考、AD-06 全量门禁等效口径、AD-08 真实 CLI 未取证判阻塞）。
- **模板路径**：`docs/templates/requirement-template.md`（8 节结构 + 三条用户视角硬约束；本项目自 I1.2 起扩展为附录 A~D，口径差见 `docs/templates/execution-template.md` §1.0.1）
- **现状参考**（只用于向后兼容/范围外说明，不充当需求来源）：`src/adapter/cli-discovery/`（known-agents / discover / probe / registry / index.js）、`src/cli/cli-discovery.js`、`src/cli/labels.js` 的 `CLI_DISCOVERY_TEXT`、`test/wp16/cli-discovery.test.js`、`test/wp16/cli-probe.test.js`、commit `a80af4f`。
- **版本**：v2
- **状态**：修复稿（轮次1，按 review-round1 的 F-01~F-06 逐项修订）。交独立评审 SubAgent 二次评审，本文件不自行宣布评审通过。
- **一句话说明**：让用户启动应用即可自动发现本机已安装的 Agent CLI，按名称/路径/版本/连接状态罗列，探测能力并测试连接、给出能力矩阵与不可达诊断、支持重新扫描与手动添加自定义 CLI，作为 v2 核心用户旅程「扫描 → 建角色员工 → 搭 Team → 建工作流 → 跑通」的第一入口。

---

## 一、背景与问题

### 1.1 现状与问题

用户拿到 beta.3 后打开应用，看到的第一个可用界面是「选工作流 → 填任务 → 看实例列表」，整个旅程里没有「本机有哪些 Agent CLI」这一步。用户今天的真实处境是：

- **必须先自己搞定 CLI 才能开始**：用户得先在终端或网页里装好 Codex / Claude Code / Gemini CLI / OpenCode / WorkBuddy 之类客户端，记住它装在哪里、叫什么命令，再去手写 `.orch/hosts/<id>.json` 才能让引擎有东西可接。`docs/index.md` §7 明确 v2 要「不再需要手写即可运行」，`docs/index.md` 第二部分阶段 A 结束标志也是「全程无需 CLI/手写配置」——这一步今天完全缺失。
- **装了什么没人告诉用户**：应用不扫描本机，用户无法回答「我机器上到底装了哪几个 Agent CLI、版本是多少、路径在哪」。v1 把 CLI 当「被配置的宿主」，不是「被发现的员工载体」（§1.1 / §1.2）。
- **装了却找不到的被静默丢弃**：像 macOS 上的 WorkBuddy.app 这种装了但不在 PATH 的 CLI，旧流程里等同于「不存在」，用户看不到任何线索，也得不到「装了但不在 PATH」的提示。§2.2 边界明确「不可达的 CLI 标 unreachable 并给出修复建议，不静默丢弃」。
- **能不能驱动只能靠猜**：没有能力探测，用户不知道某个 CLI 是否支持 ACP、能否恢复会话、能开几个并发、有没有证据钩子，建角色时选错 CLI 要到运行期才暴露。§3.3 把「能力探测可靠性」列为阶段 A 必须回答的待验证项。
- **清单写死在目标场景里会误导用户**：目标场景模板列出 Codex/Claude Code/Cursor/Gemini CLI/OpenCode，但 D-2 实测本机只检出 WorkBuddy.app。发现器必须通用、清单是配置项不硬编码（§5 能力域 0）；否则用户按模板装了 CLI 仍扫不到，或产品误以为自己只支持那几个。
- **取证条件不具备**：AD-08 / D-2 / D-4 记载本机 PATH 无真实 codex/claude/gemini 等 CLI，真实宿主握手无法在本机取证。若把真实宿主面 AC 当「已通过」，等于拿 mock 顶替真实证据。

不解决会怎样：`docs/index.md` 把「本机 CLI 能否稳定发现并探测能力」列为 A1 关键判断点（「核心入口是否成立」），把 CLI 扫描定为 §1.3 核心用户旅程的第一入口；阶段 A 退出条件的唯一硬判据是「能配出并跑通一个 Agent Team + 工作流」。A1 不落地，A2 的「基于 CLI 建角色员工」、A3 的 Team 搭建、A5 的端到端闭环全部无从开始，阶段 A 无法收口。

### 1.2 目标与成功衡量

做完之后，用户可观测的变化：

1. **自动发现且信息准确**：在一台装有至少一种 Agent CLI 的机器上启动应用，清单自动出现该 CLI，名称、路径、版本、连接状态四项与实际一致。衡量：四类来源（PATH / 应用目录 / 包管理器 / 用户配置）各有可复现命中用例，目标 CLI 漏报 0、无中生有误报 0、四项信息与夹具实际值一致率 100%。
2. **不可达可见、不静默丢弃**：装了但不在 PATH、或握手失败的 CLI，100% 出现在清单中并带可见原因与修复提示，用户不会面对一个「什么都没扫到」的空页却不知道为什么。
3. **能力与连接可判定**：对可驱动的 CLI，用户能看到能力探测结论（ACP 支持、stdio/transport 传输方式、会话恢复方言、并发上限、证据钩子五类，锚定规划 `docs/index.md` §2.2:128 与 §5:223）与连接测试结果；能力矩阵可横向对比这五类，未探测出的能力不臆造。衡量：每条展示的能力都有对应探测取证，臆造 0。
4. **清单可刷新、CLI 可手加**：用户执行一次重新扫描即刷新清单；手动添加一个自定义可执行路径后，该 CLI 出现在清单中且可被执行连接测试。衡量：重新扫描刷新成功率 100%，手动添加命中率 100%。
5. **证据分级真实**：真实宿主面明确「需装有目标 CLI 的机器」前置条件，未取证判阻塞、不判通过；mock / 夹具面全部可复现。衡量：阻塞项 100% 标注取证前提，mock 结果 0 次冒充真实宿主达标。

### 1.3 范围

**范围内（本次让用户获得的新能力）**：

- **自动扫描本机 Agent CLI**：覆盖 PATH、应用目录、包管理器、用户配置四类来源；首次启动即执行。规划 383 行「扫描 PATH / 应用目录 / 包管理器 / 用户配置」逐字保留；用户配置来源与手动添加合并落在 §2.7。（对应 §2.2、§2.7）
- **CLI 清单罗列**：向用户展示名称、路径、版本、连接状态，并附来源提示；规划 383 行「罗列名称、路径、版本、连接状态」逐字保留。（§2.3）
- **能力探测与连接测试**：对发现的 CLI 做显式、只读、带超时的轻量握手，结论用户可见。规划 384 行「能力探测与连接测试」逐字保留。（§2.4）
- **CLI 能力矩阵**：把各 CLI 的可驱动能力横向呈现，供后续建角色选 CLI 使用。规划 384 行「CLI 能力矩阵」逐字保留。（§2.5）
- **重新扫描与不可达诊断**：支持手动重新扫描刷新清单；对不可达 CLI 给出原因与修复建议，不静默丢弃。规划 384 行「重新扫描与不可达诊断」逐字保留。（§2.6）
- **手动添加自定义 CLI**：用户可登记一个自定义可执行文件路径，覆盖/补充自动发现，出现在清单中并可被连接测试。规划 385 行「手动添加自定义 CLI 可执行」逐字保留。（§2.7）
- **真实宿主验收句与证据前提**：规划 385 行「在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且信息准确」与 386 行「需在装有目标 CLI 的机器上取证」逐字落到 §3.1 的 AC-12 / AC-14，不降级、不收窄。（§2.8 / §3.1）

**范围外（本次不覆盖，每项注明留待何时或由谁覆盖）**：

- **桌面壳与 CLI 发现页的视觉设计、交互细化、系统托盘、后台 daemon 常驻**：留待 C1（`docs/index.md` 阶段 C / v1 I1.10a）。A1 只保证清单/状态/操作的用户可见语义与可复现接缝，不交付桌面 UI 文件。
- **基于 CLI 创建角色与员工、一角色多员工、部门归属、角色能力校验**：留待 A2。A1 只产出「可被选择的 CLI 清单 + 能力信息」。
- **Agent Team 拖拽搭建、团队模板**：留待 A3。
- **12 阶段工作流创建器、门禁、三种运行模式**：留待 A4。
- **按能力把任务调度到具体员工、真实 ACP 会话驱动、一角色多员工并行**：留待 A5 与阶段 B（B1）。A1 只产出能力矩阵供调度器消费，不实现调度。
- **多 CLI 混跑、同一 Team 多 CLI 员工、跨项目复用**：留待 D1 / D2 / D3。
- **替用户安装软件、修改用户 CLI 配置、写入用户系统目录**：`docs/index.md` §2.2 边界、§8 第 3 条明确扫描只读；本迭代永久范围外。
- **网页版客户端控制**：`docs/index.md` §8 第 2 条边界，永久范围外。
- **把 `npx geiger-scan` 作为运行时硬依赖**：`docs/index.md` §5 能力域 0 集成策略明确「不把 npx geiger-scan 作为运行时硬依赖、本地零依赖实现」；本迭代永久范围外。
- **真实宿主取证机器**：本机无真实 Agent CLI（AD-08 / D-2 / D-4），取证机器由主控/用户安排；未取证前相关 AC 判阻塞，不判通过、不用 mock 顶替。

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|
| §2.2 自动扫描本机 CLI（PATH / 应用目录 / 包管理器） | 首次或重新进入应用的用户 | 不知道本机装了哪些 CLI | 三类来源自动只读发现并汇总；用户配置来源见 §2.7，四类合计覆盖规划「扫描 PATH / 应用目录 / 包管理器 / 用户配置」 |
| §2.3 CLI 清单罗列（名称 / 路径 / 版本 / 连接状态） | 所有用户 | 看不到清单、信息不准 | 四项用户可见信息 + 来源提示 + 扫描时间；规划「罗列名称、路径、版本、连接状态」逐字落地 |
| §2.4 能力探测与连接测试 | 准备选 CLI 建角色的用户 | 不知道 CLI 能不能被驱动 | 显式、只读、带超时的探测与连接测试，结论用户可见 |
| §2.5 CLI 能力矩阵 | 准备在多个 CLI 间选择的用户 | 无法横向比较能力 | 按探测结果呈现能力对比，未探出能力不臆造 |
| §2.6 重新扫描与不可达诊断 | 新装了 CLI、或装了却找不到的用户 | 清单不刷新、被静默丢弃 | 重新扫描刷新；不可达 CLI 保留在清单并给原因与修复提示 |
| §2.7 用户配置与手动添加自定义 CLI | 有自定义或未识别 CLI 的用户 | 自动发现遗漏或需补充 | 用户配置作为第四类来源；手动登记可执行路径后出现在清单并可连接测试 |
| §2.8 功能之间的衔接 | 走完整旅程的用户 | 各步串不起来 | 从启动 → 扫描 → 罗列 → 探测 → 矩阵 → 重新扫描/诊断 → 手加的完整用户流程，含失败路径 |

### 2.2 自动扫描本机 Agent CLI（PATH / 应用目录 / 包管理器）

- **使用角色**：第一次打开应用、或想确认本机有哪些 Agent CLI 的用户。
- **使用场景**：用户刚装完（或怀疑自己装过）Agent CLI，希望应用自己找出来，而不是让他填路径。
- **用户操作**：用户启动应用（等价于进入 CLI 发现页/执行扫描），应用自动对本机做一次只读扫描；扫描覆盖三类来源——可执行命令所在位置（PATH）、已安装的应用（macOS 应用目录等）、包管理器安装的全局包（npm 全局等）。用户不需要输入任何路径或配置。
- **预期效果**：用户看到扫描完成的提示，以及「发现 N 个 Agent CLI」的清单；每个发现项标注它来自哪类来源，让用户知道为什么被列出来。首次启动与用户主动重新扫描执行同一套发现逻辑。
- **异常情况**：某类来源不可读（目录不存在、无权限、包管理器命令不可用）时，该来源跳过并计入「来源概览」，不导致整个扫描失败；用户看到的是「发现了多少、从哪些来源发现」，而不是报错中断。
- **边界说明**：扫描只读——不安装、不修改用户 CLI 配置、不写用户系统目录；发现「装了但不在 PATH」的 CLI 也会保留（见 §2.6）；扫描只是找「候选载体」，不代表该 CLI 一定能被驱动（能否驱动由 §2.4 决定）。

### 2.3 CLI 清单罗列（名称 / 路径 / 版本 / 连接状态）

- **使用角色**：所有打开应用的用户，尤其是准备基于 CLI 建角色的人。
- **使用场景**：扫描完成后，用户需要一眼看清「有哪些 CLI、各自在哪、什么版本、现在能不能连」。
- **用户操作**：用户查看 CLI 清单；清单按稳定的顺序展示（不随文件系统顺序每次乱跳），每行给出：名称、路径（在 PATH 上显示可执行位置；仅装了应用/包但不在 PATH 的显示对应安装位置或「已安装但不在 PATH」）、版本（探测到则显示实际版本，未探测显示占位）、连接状态（可用 / 已连接 / 未就绪 / 检测中之一）、来源提示、扫描时间。
- **预期效果**：四项核心信息与用户机器上实际安装情况一致；同名可执行在多个 PATH 目录出现时只列一项、取靠前那个，用户看到的是去重后的干净清单。每行另可见「可用能力摘要」与「并发上限摘要」，对应规划 `docs/index.md` §1.3:50「展示 CLI 清单：名称、路径、版本、可用能力、连接状态、并发上限」中的「可用能力、连接状态、并发上限」——清单给出摘要（哪些已探出/未探出、并发上限数值或未探测），五维的完整横向对比见 §2.5 能力矩阵（详情不在清单展开，不新增 AC）。四项仍是清单核心最小集，摘要不臆造。
- **异常情况**：一个 CLI 都没发现时，用户看到明确的空态提示与「安装一个 Agent CLI 后重新扫描」的引导，而不是一个空白页面；版本探测未成功时显示占位而非编造版本号；能力/并发未探出时摘要显示「未探测」而非编造值。
- **边界说明**：连接状态是「此刻的连接可用性」，不是「能力」——状态为「可用」只表示在 PATH 上找到、尚未握手；真正的可驱动结论见 §2.4。清单是配置项、不硬编码固定几个 CLI 名（D-2 / §5 能力域 0）。清单上的能力/并发上限只是摘要落点（对齐 §1.3:50），完整五维判定以 §2.5 矩阵为准，两者用同一份探测结果、不矛盾。

### 2.4 能力探测与连接测试

- **使用角色**：准备选一个 CLI 去建角色/员工的用户。
- **使用场景**：用户想知道「这个 CLI 到底能不能被 Maestro 驱动、能不能恢复会话、能开几个并发、有没有证据钩子」，而不是靠猜。
- **用户操作**：用户对清单中某个 CLI 主动发起一次探测/连接测试（只读）：应用向该 CLI 做一次轻量 ACP 握手，读取它声明支持的能力，随后立即结束，不开始任何实际任务。
- **预期效果**：用户看到探测结论——五类能力：① 是否支持 ACP、② stdio/transport（IPC 传输方式）、③ 会话恢复方言、④ 并发上限、⑤ 证据钩子（逐字对齐规划 `docs/index.md` §2.2:128 与 §5:223）；状态从「可用/未就绪」更新为「已连接」或「未就绪」，并显示最近探测时间。
- **异常情况**：CLI 不存在、不可执行、握手无响应、超时或崩溃时，用户看到「探测失败 + 具体原因」的可见提示，清单保留该项，状态标为「未就绪」；探测过程有硬超时，一个卡死的 CLI 不会让应用卡住。探测从不抛异常给用户，只以可读结果呈现。
- **边界说明**：探测是显式、按需、只读的——不自动对每个 CLI 后台探测；握手只做 `initialize` 级别的能力声明读取，不创建真实任务会话；能力探测结果收敛在适配器层，不进入控制核心（§3.2）。真实宿主的握手结论需在有目标 CLI 的机器上取证（AD-08）。

### 2.5 CLI 能力矩阵

- **使用角色**：要在多个 CLI 之间做选择、或想一眼看清「谁支持什么」的用户。
- **使用场景**：用户装了多个 CLI，需要对比它们各自支持的能力，决定把哪个用作员工载体。
- **用户操作**：用户查看能力矩阵——一张按 CLI 横向对比的视图，**维度完整五类**：① ACP 支持、② stdio / transport（IPC 传输方式）、③ 会话恢复方言、④ 并发上限、⑤ 证据钩子；每个单元格取自对应 CLI 的探测结论。五类逐字对齐规划 `docs/index.md` §2.2:128「ACP / stdio / 会话恢复方言 / 并发上限 / 证据钩子」与 §5:223「ACP / transport / 恢复方言 / 并发 / 证据钩子」，不得删维、合并或少列任一维度。
- **预期效果**：用户能快速判断「哪个 CLI 能满足某个角色声明的所需能力」，五类维度均可横向对比；矩阵与清单使用同一份探测结果，不出现「清单说支持、矩阵说不支持」的自相矛盾。
- **异常情况**：某 CLI 尚未探测时，矩阵中该 CLI 的五个维度均显示「未探测」而非空白或「不支持」，并提示用户先做连接测试；探测失败的能力按「未探出」处理，不臆造为支持。
- **边界说明**：能力矩阵是只读呈现，不在此处改 CLI 能力、不绑定角色（绑定角色是 A2 的事）；矩阵维度随适配器能力声明扩展，但本迭代**固定上述完整五类维度**（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子），第五类 stdio/transport 不得再省略。证据钩子维度当前无实现支撑属 S2 差距（D-1），按规划列示、不作臆造，不因此删维。

### 2.6 重新扫描与不可达诊断

- **使用角色**：新装了 CLI、升级过 CLI、或发现某个 CLI 列不出来/连不上的用户。
- **使用场景**：用户刚装完一个新 CLI 想让它出现在清单里；或某个 CLI 明明装了却显示「未就绪」，想知道为什么。
- **用户操作**：用户点击「重新扫描」，应用重新执行 §2.2 的发现逻辑并刷新清单与扫描时间；对状态为「未就绪」的项，用户查看诊断信息。
- **预期效果**：新装的 CLI 出现在刷新后的清单中；不可达项保留在清单里，并给出可读的失败原因与修复建议（例如「已安装但不在 PATH，请把可执行加入 PATH 或手动添加路径」「探测超时，请重试」）。用户能据此采取下一步动作，而不是面对一个无解释的空结果。
- **异常情况**：重新扫描本身失败（来源全部不可读）时，保留上一次可见的清单并给出提示，不把清单清空成空态；不可达诊断不自动执行探测（避免卡住），需用户按 §2.4 主动发起探测。
- **边界说明**：重新扫描只刷新发现缓存，不改用户系统、不覆盖用户手动添加的自定义 CLI（§2.7 的条目在重新扫描后仍需保留）；不可达项「不静默丢弃」是 §2.2 边界的硬要求。

### 2.7 用户配置与手动添加自定义 CLI

- **使用角色**：装了未被自动发现清单识别的 CLI、或希望精确指定某个可执行文件路径的用户。
- **使用场景**：用户有一个自定义/内部 CLI，或某个 CLI 装了但自动扫描没找到、需要手动告诉应用它在哪里。
- **用户操作**：用户手动添加一个自定义 CLI——提供它的名称和可执行文件路径，确认后应用把它纳入清单；用户配置作为第四类发现来源，保存用户已登记的自定义路径，使它们在扫描与重新扫描后仍然保留。
- **预期效果**：添加成功后，该自定义 CLI 出现在清单中，带有用户给的名称和路径；用户可以对它执行 §2.4 的连接测试，测试结果与自动发现的 CLI 一样可见；重新扫描不会抹掉它。
- **异常情况**：用户提供空名称、空路径、不存在的路径或不可执行的文件时，添加被拒绝并给出具体原因，不写入清单；重复添加同一路径时提示已存在、不产生重复项。
- **边界说明**：手动添加只登记「去哪里找这个 CLI」，不替用户安装软件、不修改用户 CLI 自身配置；手动添加的条目与自动发现条目在清单中同等对待（同样有名称/路径/版本/状态、同样可探测）；手动添加能力覆盖/补充自动发现，但不允许借此修改其他 CLI 的信息。

### 2.8 功能之间的衔接

用户走完一遍 A1 看到的完整流程：启动应用 → 应用自动执行扫描（PATH / 应用目录 / 包管理器 / 用户配置）→ 看到「发现 N 个 Agent CLI」的清单，每项有名称、路径、版本、连接状态与来源 → 对感兴趣的 CLI 发起连接测试，看到能力探测结论，状态更新为「已连接/未就绪」→ 在能力矩阵里横向对比各 CLI 支持的能力 → 若新装了 CLI 或某 CLI 连不上，点击重新扫描刷新清单，并查看不可达诊断与修复提示 → 若某个 CLI 自动发现扫不到，手动添加它的名称与路径，随后对它做连接测试。失败路径：扫描来源不可读只跳过该来源、不清空清单；探测超时/失败只标「未就绪」并给原因、不卡住应用；一个 CLI 都没发现时看到空态引导而非空白页。这条流程的产物（CLI 清单 + 能力矩阵）是 A2「基于 CLI 建角色与员工」的直接输入。

规划验收句的完整落地：规划 385 行「在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且信息准确」对应 §2.2 + §2.3 的「自动扫描 + 四项信息准确」并在 §3.1 AC-12（真实宿主面，前置需装目标 CLI 的机器）与 AC-14（mock 夹具可复现面）判定；规划 385 行「手动添加自定义 CLI 可执行」对应 §2.7 并在 AC-13 判定。两句均不降级、不收窄、不合并。

### 2.9 用户可见的业务规则

- **BR-01**：扫描是只读的——不安装软件、不修改用户 CLI 配置、不写用户系统目录。（§8 第 3 条；§2.2 边界）
- **BR-02**：自动扫描覆盖 PATH、应用目录、包管理器三类来源；用户配置作为第四类来源（§2.7）。（规划 383 行）
- **BR-03**：清单至少向用户展示名称、路径、版本、连接状态四项信息，并标注来源与扫描时间。（规划 383 行）
- **BR-04**：已安装但不在 PATH、或探测失败的 CLI 必须保留在清单中，并给出可读原因与修复建议，不得静默丢弃。（§2.2 边界；规划 384 行）
- **BR-05**：版本与能力信息必须来自实际探测；未探出的显示占位/「未探测」，不得编造。（§2.3 / §2.5）
- **BR-06**：能力探测与连接测试是用户显式触发、只读、带硬超时的；失败以可读结果呈现，不抛异常、不卡住应用。（§2.4）
- **BR-07**：能力矩阵按各 CLI 的实际探测结论、**完整五类维度**（ACP 支持 / stdio·transport 传输方式 / 会话恢复方言 / 并发上限 / 证据钩子，锚定 `docs/index.md` §2.2:128 与 §5:223）呈现；五个维度均须横向可比，未探测的能力显示「未探测」而非「不支持」，探测失败按「未探出」处理、不臆造为支持，不因某维度缺实现而删维。（§2.5；附录 D-4）
- **BR-08**：重新扫描刷新清单与扫描时间，且不覆盖用户手动添加的条目；扫描失败时保留上一次清单。（§2.6）
- **BR-09**：用户可手动添加自定义 CLI（名称 + 可执行路径），添加后出现在清单中并可被连接测试；非法/重复输入被拒绝且不写入。（规划 385 行；§2.7）
- **BR-10**：在一台装有至少一种 Agent CLI 的机器上启动应用，必须自动列出该 CLI 且四项信息准确。（规划 385 行验收句前半）；真实宿主取证须在装有目标 CLI 的机器上进行，未取证判阻塞不判通过（规划 386 行证据前提；AD-08 / D-4）。
- **BR-11**：CLI 清单与能力矩阵是配置项、不硬编码固定 CLI 集合；不同机器上清单随实际安装情况变化。（§5 能力域 0；D-2）

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

> **判定锚点约定**： `$MAESTRO_REPO` = 仓库根 `/Users/xuesh/www/Maestro`。夹具一律用独立项目根 `$(mktemp -d /tmp/maestro-a1-<场景>.XXXXXX)`，注入 `NODE_ENV=test`。用户可见操作统一用 `node "$MAESTRO_REPO/bin/orch.js" cli list|scan|probe|add`（`cli` 是 `bin/orch.js:24` 已接线的顶层命令；`add` 为本迭代补齐，见附录 D-6）；需要隔离单一发现来源时用 §3.3 定义的适配器注入接缝。每条 AC 的 Given/When/Then 只写用户可见状态与操作；`机检：` / `夹具：` / `架构检查：` 为复核锚点，不是用户可见判定。

**AC-01 · PATH 上的 CLI 被自动发现并罗列（规划子项：扫描 PATH + 罗列名称/路径/状态）**
- 场景类型：功能
- 风险：高（规划子项核心 / 关键判断点「核心入口是否成立」）
- 引用：BR-02, BR-03, BR-11
- **Given** 用户在一台独立临时机器上，把名为 `codex` 的可执行文件放进一个专属目录并把该目录作为唯一的命令搜索路径，`NODE_ENV=test`。
- **When** 用户在该机器上启动应用执行扫描，随后查看 CLI 清单。
- **Then** 清单自动出现该项，名称显示为 Codex CLI，路径显示为刚放入的可执行文件位置，连接状态显示为「可用」，来源标注为命令搜索路径；用户不需要输入任何路径。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js` 中 A1-01 断言：findings 含 `cli_id=codex`、`executable` 等于注入 bin 路径、`connection_status=idle`、`not_on_path=false`、evidence 含 `type=path`。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-path.XXXXXX); mkdir -p "$ROOT/bin"; printf '#!/bin/sh\necho "codex 1.2.3"\n' > "$ROOT/bin/codex"; chmod +x "$ROOT/bin/codex"; cd "$ROOT" && PATH="$ROOT/bin" NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -REn "writeFile|mkdir|appendFile" src/adapter/cli-discovery/discover.js` → 零命中（PATH 发现只读，不写扫描目录）；`node -e "const fs=require('fs');if(/[\u4e00-\u9fff]/.test(fs.readFileSync('src/adapter/cli-discovery/discover.js','utf8')))process.exit(1);console.log('OK')"` → 输出 OK（领域层零 CJK，中文唯一来源 `src/cli/labels.js`）；A1-06 断言扫描前后目录列表一致。

**AC-02 · 版本信息准确（规划验收句「信息准确」的版本维度）**
- 场景类型：功能
- 风险：高（规划验收句核心）
- 引用：BR-03, BR-05, BR-10
- **Given** 用户在 AC-01 的夹具机器上，`codex` 可执行对被版本查询返回一行可识别的版本文本，`NODE_ENV=test`。
- **When** 用户对该项执行一次探测，再查看清单。
- **Then** 清单中该 CLI 的版本显示为探测实际读到的版本文本，与可执行文件自报版本一致；未探测前版本显示为占位而非编造值。
- 机检：`NODE_ENV=test node --test test/wp16/cli-probe.test.js` 中 A1-11 断言 `probeVersion` 取首个非空行（`v` 开头）；A1-12 断言合并后 `version` 为探测值。
- 夹具：在 AC-01 夹具基础上 `node "$MAESTRO_REPO/bin/orch.js" cli probe codex`，观察清单版本列由占位变为 `codex 1.2.3`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'probeVersion|version: null|version = null' src/adapter/cli-discovery/discover.js src/adapter/cli-discovery/probe.js` → 命中，确认版本走显式 `probeVersion`、发现阶段不自动探测。

**AC-03 · 应用目录中的 CLI 被识别（规划子项：扫描应用目录）**
- 场景类型：功能
- 风险：中
- 引用：BR-02, BR-03, BR-04
- **Given** 用户在独立临时机器上，于应用目录夹具中放置一个 `WorkBuddy.app` 安装标记，但没有把它放进命令搜索路径，`NODE_ENV=test`。
- **When** 用户执行扫描并查看清单。
- **Then** 清单出现 WorkBuddy，来源标注为应用目录，路径显示安装位置；因不在命令搜索路径，其连接状态显示为「未就绪」并带「已安装但不在 PATH」提示，而不是被丢弃。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js` 中 A1-04 断言：`workbuddy` 被列出、evidence 含 `type=app`、`connection_status=unreachable`。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-app.XXXXXX); mkdir -p "$ROOT/apps/WorkBuddy.app"; NODE_ENV=test node -e 'import("'"$MAESTRO_REPO"'/src/adapter/cli-discovery/index.js").then(m=>console.log(JSON.stringify(m.discoverAgentClis({appDirs:["'$ROOT'/apps"],home:"'$ROOT'/home",pathEntries:[]}).findings)))'`（适配器注入接缝见 §3.3）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'defaultAppDirs|/Applications|Applications' src/adapter/cli-discovery/discover.js` → 命中，确认按平台默认目录解析、macOS 含 `~/Applications` 与 `/Applications`；`node -e "const fs=require('fs');if(/[\u4e00-\u9fff]/.test(fs.readFileSync('src/adapter/cli-discovery/discover.js','utf8')))process.exit(1);console.log('OK')"` → 输出 OK（领域层零 CJK）。

**AC-04 · 包管理器全局包被识别（规划子项：扫描包管理器）**
- 场景类型：功能
- 风险：中
- 引用：BR-02, BR-03
- **Given** 用户在独立临时机器上，包管理器全局根目录夹具中存在一个已知 CLI 的全局包目录（如 `opencode-ai`），且该 CLI 不在命令搜索路径，`NODE_ENV=test`。
- **When** 用户执行扫描并查看清单。
- **Then** 清单出现对应的 OpenCode，来源标注为包管理器全局包，路径显示全局包位置，状态为「未就绪」并提示不在 PATH。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js` 中 A1-07 断言 `KNOWN_AGENT_CLI` 含 `opencode`；针对 `npmGlobalRoot` 注入的断言须命中 `type='npm-global'` evidence。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-npm.XXXXXX); mkdir -p "$ROOT/npm/opencode-ai"; NODE_ENV=test node -e '...discoverAgentClis({npmGlobalRoot:"'$ROOT'/npm",pathEntries:[],home:"'$ROOT'/home"})...'`（同 AC-03 接缝）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'npmGlobalRoot|npmPackagePaths' src/adapter/cli-discovery/discover.js` → 命中可注入参数；`grep -nF 'if (!npmGlobalRoot) return []' src/adapter/cli-discovery/discover.js` → 命中，确认默认 null 时不臆造全局包发现。

**AC-05 · 用户配置 CLI 在扫描后保留（规划子项：扫描用户配置）**
- 场景类型：功能
- 风险：中
- 引用：BR-02, BR-08, BR-09
- **Given** 用户在独立临时机器上，先按 §2.7 手动添加一个自定义 CLI 并确认成功，此时清单中有该项，`NODE_ENV=test`。
- **When** 用户执行一次重新扫描。
- **Then** 该自定义 CLI 仍在清单中、信息与添加时一致，不被自动发现结果覆盖或抹掉。
- 机检：机检断言重新扫描前后注册清单中用户配置条目 `cli_id` 与路径不变、唯一；重新扫描只更新自动发现来源部分。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-userconf.XXXXXX); cd "$ROOT"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli add --name MyCLI --path "$ROOT/bin/mytool"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli list`（`add` 命令见 D-6）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -n "saveCliRegistry" src/adapter/cli-discovery/registry.js` → 命中用户配置持久化入口；`grep -nE 'userConfig|user_config|custom' src/adapter/cli-discovery/discover.js src/adapter/cli-discovery/registry.js` → 命中表示用户配置独立段已实现；当前零命中属 D-1 差距①（S2 待补），不得据此放宽 AC-05，判定仍以机检/夹具的「重扫前后条目不变、不混写覆盖」为准（D-5 / D-6）。

**AC-06 · 不可达 CLI 被保留并给出诊断（规划子项：不可达诊断；§2.6 异常）**
- 场景类型：功能 / 异常
- 风险：高（§2.2 边界硬要求）
- 引用：BR-04, BR-05
- **Given** 用户在独立临时机器上，仅存在 `.codex` 主目录标记而 `codex` 不在命令搜索路径，清单中出现一个「未就绪」的 Codex，`NODE_ENV=test`。
- **When** 用户查看该不可达项的诊断信息，并对它发起一次连接测试。
- **Then** 该项仍在清单中，显示「已安装但不在 PATH」的可见原因与修复提示；连接测试失败时显示「探测失败 + 具体原因」，状态保持「未就绪」；不出现「什么都没扫到」的空态。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js` 中 A1-02 断言 home marker 单独也列、`executable=null`、`not_on_path=true`、`connection_status=unreachable`。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-unreach.XXXXXX); mkdir -p "$ROOT/home/.codex"; NODE_ENV=test node -e '...discoverAgentClis({home:"'$ROOT'/home",pathEntries:[],appDirs:[]})...'`；观察输出含 codex 且状态未就绪。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'evidence\.length\s*===\s*0' src/adapter/cli-discovery/discover.js` → 仅命中 :155 一处跳过条件，确认不可达项「有证据即列出」、不是静默 `continue`；机检 A1-02 断言 `unreachable`。

**AC-07 · 能力探测握手成功并展示能力（规划子项：能力探测）**
- 场景类型：功能
- 风险：高（规划子项核心 / 阶段 A 待验证项「能力探测可靠性」）
- 引用：BR-05, BR-06, BR-07
- **Given** 用户在独立临时机器上，有一个按 ACP 方言应答 `initialize` 的迷你模拟 CLI 作为探测目标，`NODE_ENV=test`（真实宿主握手见 AC-14）。
- **When** 用户对该 CLI 执行连接测试。
- **Then** 用户看到「探测完成：ACP 支持」的结论，并能看到该 CLI 声明的会话能力（如会话恢复/关闭/列表）；状态更新为「已连接」，最近探测时间被刷新。
- 机检：`NODE_ENV=test node --test test/wp16/cli-probe.test.js` 中 A1-10 断言 `probeAcp` 解析 NDJSON initialize 响应、`acp=true`、`sessionCapabilities=['close','list','resume']`、`connection_status=connected`；A1-12 断言能力合并去重。
- 夹具：`NODE_ENV=test node --test test/wp16/cli-probe.test.js`（该测试用 `mockAcpScript()` 生成 speaking-NDJSON 的模拟 agent，`process.execPath` 作 executable）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE "session/(new|prompt)" src/adapter/cli-discovery/probe.js` → 仅命中 :111 英文注释（无可执行原语调用，握手只发 `initialize`；英文注释命中属 AD-07 已知口径）；`grep -REn "if host ==|if\(host" src/core src/daemon` → 零命中（能力探测收敛在 adapter 层，§3.2）。

**AC-08 · 探测失败/超时以可读结果呈现（§2.4 异常）**
- 场景类型：功能 / 异常
- 风险：高
- 引用：BR-05, BR-06
- **Given** 用户在独立临时机器上，有一个卡住不响应或崩溃的 CLI 作为探测目标，`NODE_ENV=test`。
- **When** 用户对该 CLI 执行连接测试。
- **Then** 应用在硬超时内返回，用户看到「探测失败 + 具体原因」，状态标为「未就绪」，清单保留该项；应用不卡死、不弹出异常堆栈。
- 机检：`NODE_ENV=test node --test test/wp16/cli-probe.test.js` 中 A1-13 断言超时返回 `{ok:false, code:'CLI_PROBE_TIMEOUT'}` 而非抛出；A1-09 断言损坏的缓存被报告为 `CLI_REGISTRY_INVALID` 而非静默接受。
- 夹具：`NODE_ENV=test node --test test/wp16/cli-probe.test.js`（`probeVersion` 用 `setTimeout` 模拟卡死、timeout 300ms）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'throw new|throw ' src/adapter/cli-discovery/probe.js` → 零命中；`grep -nE 'ok: false|code:' src/adapter/cli-discovery/probe.js` → 命中 `{ok:false, code, params}` 约定（探测失败以数据返回、不抛异常）。

**AC-09 · CLI 能力矩阵横向对比（规划子项：CLI 能力矩阵）**
- 场景类型：功能
- 风险：中
- 引用：BR-05, BR-07
- **Given** 用户在独立临时机器上，清单中至少有两个 CLI，其中一个已探测出 ACP/会话恢复能力、另一个尚未探测，`NODE_ENV=test`。
- **When** 用户查看能力矩阵。
- **Then** 矩阵按 CLI 横向展示 **ACP 支持 / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子五个维度**，已探测 CLI 的每个维度显示其真实结论，未探测 CLI 的每个维度均显示「未探测」而非空白或「不支持」；五类维度齐全、缺任一维度判不通过；矩阵结论与清单的探测结果一致，无自相矛盾。
- 机检：机检断言矩阵**恰好包含五类维度**（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子，缺一或少列维度判红），每个单元格值来自对应 finding 的 `capabilities` / `acp` / `transport` / 会话恢复方言标记 / `max_concurrent_sessions` / 证据钩子标记探测结果；未探测项的五个维度值为「未探测」；无「清单不支持而矩阵支持」的反向冲突。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-matrix.XXXXXX); cd "$ROOT"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli probe <已发现CLI>; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli list`（能力矩阵以清单/探测数据为数据源，矩阵视图细节由 C1 交付，A1 只判定数据可支撑矩阵，见 §1.3 范围外）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`node -e "const fs=require('fs');if(/[\u4e00-\u9fff]/.test(fs.readFileSync('src/adapter/cli-discovery/registry.js','utf8')))process.exit(1);console.log('OK')"` → 输出 OK（领域层零 CJK，中文唯一来源 `src/cli/labels.js`，NF-4）；`grep -nE 'capabilities|max_concurrent_sessions|acp|transport' src/adapter/cli-discovery/registry.js` → 命中能力字段且仅一份数据源，不引入第二份（D-4）。

**AC-10 · 重新扫描刷新清单（规划子项：重新扫描）**
- 场景类型：功能
- 风险：中
- 引用：BR-08
- **Given** 用户在独立临时机器上先扫描得到清单 N 项，随后在命令搜索路径夹具中新放一个此前未发现的 CLI，`NODE_ENV=test`。
- **When** 用户执行重新扫描并查看清单。
- **Then** 清单项数变为 N+1，新 CLI 出现，扫描时间更新为本次；用户手动添加的条目仍在（BR-08）。
- 机检：`NODE_ENV=test node --test test/wp16/cli-probe.test.js` 中 A1-08 断言注册清单 round-trip 保持条目形状；机检追加断言 scan 后新条目写入、旧条目保留、`scanned_at` 更新。
- 夹具：`cd "$ROOT"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli list; # 记录 N; printf '#!/bin/sh\n' > "$ROOT/bin/newcli"; chmod +x "$ROOT/bin/newcli"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli list # 期望 N+1`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -REn "writeFile|mkdir|appendFile" src/adapter/cli-discovery/discover.js` → 零命中（发现阶段不写扫描目录）；`grep -n "saveCliRegistry" src/adapter/cli-discovery/registry.js` → 命中唯一缓存写入口 `.orch/cli-registry.json`，不触碰 `.orch` 下其他文件。

**AC-11 · 扫描只读，不改动用户机器（BR-01；§8 边界）**
- 场景类型：功能 / 安全
- 风险：高
- 引用：BR-01
- **Given** 用户在独立临时机器上有一个待扫描的夹具目录树，记录其初始内容，`NODE_ENV=test`。
- **When** 用户执行扫描。
- **Then** 被扫描的目录与用户 CLI 配置前后字节不变；应用不安装软件、不写用户系统目录；唯一允许写入的是本项目缓存 `.orch/cli-registry.json`。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js` 中 A1-06 断言扫描前后 `readdirSync` 一致；A1-07 断言发现模块无 CJK 字面量（文案统一在 labels.js）。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-readonly.XXXXXX); # 记录 sha256 前后; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan; # 比对扫描 target 目录 sha256 不变`。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，英文注释也命中，AD-07）；`grep -REn "writeFile|mkdir|appendFile" src/adapter/cli-discovery/discover.js` → 对扫描目标路径零命中（缓存写入只在 registry.js）；`node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"` → 输出 0（零运行时依赖，NF-4）。

**AC-12 · 规划验收句①（真实宿主面）：装了至少一种 Agent CLI 的机器启动应用自动列出且信息准确**
- 场景类型：功能 / 规划验收句核心
- 风险：高（规划 385 行；AD-08 阻塞项）
- 引用：BR-03, BR-10, BR-11
- **Given** **需一台装有目标 Agent CLI 的机器**（如装有 Codex CLI 且其在命令搜索路径中）。本机当前无真实 Agent CLI（AD-08 / D-2 / D-4），此 Given 在本机不可构造；未取得该机器前本 AC 判**阻塞**，不判通过、不用 mock 顶替。
- **When** 用户在该机器上启动应用执行一次扫描，随后查看 CLI 清单。
- **Then** 清单自动列出该目标 CLI，名称、路径、版本、连接状态与实际安装情况一致；用户不需要任何手写配置或命令行参数。
- 机检：取证机器专属——在装有目标 CLI 的机器上执行 `cd <独立项目根> && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan`，断言清单含目标 CLI 且四项字段与 `which <bin>` / `<bin> --version` 实测一致；本机执行须显式记录「本机无目标 CLI → 阻塞」并附试过路径（PATH 实测无 codex/claude/gemini，仅 WorkBuddy.app）。
- 夹具：取证机器由主控/用户安排（D-4）；本机先用 AC-14 的 mock 夹具证明逻辑可复现，但 mock 结果不得作为本 AC「真实宿主达标」的证据。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -REn "autoProbe|setInterval" src/adapter/cli-discovery src/cli/cli-discovery.js` → 零命中（探测走显式 opt-in，不在应用启动时后台自动握手，§2.4）。

**AC-13 · 规划验收句②：手动添加自定义 CLI 可执行**
- 场景类型：功能 / 规划验收句核心
- 风险：高（规划 385 行）
- 引用：BR-09
- **Given** 用户在独立临时机器上有一个自定义可执行文件（自动发现不会识别），准备添加它，`NODE_ENV=test`。
- **When** 用户执行添加，提供名称与该可执行文件路径，随后查看清单。
- **Then** 该自定义 CLI 出现在清单中，名称与路径与用户填写一致；用户可对它执行连接测试并看到结果；重复添加同一路径被拒绝且不产生重复项；非法输入（空名称、空路径、不存在文件）被拒绝并给出原因、不写入清单。
- 机检：机检断言添加后注册清单含该 `{name, path}` 且唯一；重复/非法添加返回失败且不改变清单；随后 probe 返回的结论写入该项。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-add.XXXXXX); printf '#!/bin/sh\necho "mytool 0.1"\n' > "$ROOT/mytool"; chmod +x "$ROOT/mytool"; cd "$ROOT"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli add --name MyCLI --path "$ROOT/mytool"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli list`（`add` 命令为 A1 补齐，见 D-6）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE "add|name|path" src/cli/cli-discovery.js` → 命中 add 分支的 `--name` / `--path` 解析（实现建议字面见 D-6）；`grep -REn "install|chmod" src/cli/cli-discovery.js` → 零命中（只登记路径，不安装/不修改该 CLI 配置，D-6）。

**AC-14 · 规划验收句①的 mock 可复现面：自动发现 + 四项信息准确**
- 场景类型：功能 / 规划验收句支撑（mock 面）
- 风险：高（规划 385 行支撑；AD-08 的 mock 取证出口）
- 引用：BR-03, BR-05, BR-10
- **Given** 用户在独立临时机器上，用夹具构造一个「装了至少一种 Agent CLI」的环境：专属命令搜索路径中有一个返回可识别版本的 `codex` 可执行，`NODE_ENV=test`。
- **When** 用户启动应用执行扫描，随后对发现的项执行连接测试，再查看清单。
- **Then** 清单自动列出 Codex CLI，名称、路径、版本、连接状态四项与夹具实际值一致（路径=夹具可执行位置、版本=夹具自报版本、状态探测后为「已连接」），用户无需输入任何配置。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js test/wp16/cli-probe.test.js` 全通过：A1-01（发现 + 状态 idle）、A1-11（版本准确）、A1-10（探测后 connected）、A1-12（合并）联合覆盖本 AC 的四项信息准确。
- 夹具：AC-01 + AC-02 + AC-07 三夹具串联；结果标注证据级别为「mock 实测」，按附录 A-7 与 AC-12 的「待取证」严格分开，不得冒充真实宿主达标。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'NODE_ENV|process\.env' test/wp16/cli-discovery.test.js test/wp16/cli-probe.test.js` → 命中夹具环境隔离（`NODE_ENV=test`）；`node -e "const fs=require('fs');if(/[\u4e00-\u9fff]/.test(fs.readFileSync('src/adapter/cli-discovery/probe.js','utf8')))process.exit(1);console.log('OK')"` → 输出 OK（领域层零 CJK，不触碰真实 `~/.codex` / `PATH` / `/Applications`）。

**AC-15 · 空态与来源概览可见（§2.3 / §2.6 异常）**
- 场景类型：功能 / 异常
- 风险：中
- 引用：BR-03, BR-04
- **Given** 用户在独立临时机器上，四类来源夹具均为空（没有可执行、没有应用标记、没有全局包、没有用户配置），`NODE_ENV=test`。
- **When** 用户执行扫描并查看清单。
- **Then** 用户看到明确的空态提示与「请安装一个 Agent CLI 后重新扫描」的引导，而不是空白页；同时看到来源概览（扫描了哪些来源、各自发现 0 项）。
- 机检：`NODE_ENV=test node --test test/wp16/cli-discovery.test.js` 中 A1-05 断言无证据即无 finding（无误报）；机检追加断言空态文案键由 `CLI_DISCOVERY_TEXT.NONE` / `NONE_HINT` 下发（附录 A-1）。
- 夹具：`ROOT=$(mktemp -d /tmp/maestro-a1-empty.XXXXXX); cd "$ROOT"; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan; NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli list`（以注入空来源接缝运行，避免扫到真实本机）。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；`grep -nE 'NONE|NONE_HINT' src/cli/cli-discovery.js` → 命中 `renderList` 的 `T.NONE` / `T.NONE_HINT` 分支（:52-53），确认空态判定走文案键、不依赖真实本机 PATH/HOME，`CLI_DISCOVERY_TEXT` 为唯一中文来源。

### 3.2 非功能验收标准

- **NF-1（用户可感知的响应）**：用户发起扫描或连接测试后，在数秒内看到结果或明确的「检测中/探测中」反馈；连接测试带硬超时，一个卡死的 CLI 不会让应用无限期无响应。（§2.4；探测超时为数据而非异常，A1-13）
- **NF-2（只读安全）**：用户执行扫描后，被扫描的本机 CLI 与用户配置不发生任何可见变化；应用不在用户机器上静默安装或改写任何东西。（BR-01；A1-06）
- **NF-3（证据分级真实）**：所有验收结果按「mock 实测 / 待本机实测（需装有目标 CLI 的机器）/ 已实测（真实宿主面）」分级标注；未取证的真实宿主面判阻塞，mock 结果 0 次冒充真实宿主达标。（AD-08；附录 A-7）
- **NF-4（零依赖 / 纯净）**：应用不依赖用户机器上是否有 Node/npx 或联网拉包即可完成发现；新增中文只经 `src/cli/labels.js` 下发；领域层保持零 CJK、文案唯一来源。（§5 能力域 0 集成策略；AD-07；A1-07）
- **NF-5（基线不回归）**：本迭代新增能力不使既有全量测试回归；按 AD-06 等效口径，受影响面串行 + git worktree 基线树对照，新增红差集为 0，不放宽任何 AC 判据。

### 3.3 验收前置条件

- **P-1（仓库与环境）**：在仓库根 `/Users/xuesh/www/Maestro`（HEAD `f2b5742`）执行；macOS / zsh / Node v22.22.2；复核脚本设 `NODE_ENV=test`。
- **P-2（独立项目根）**：每条 AC 用 `ROOT=$(mktemp -d /tmp/maestro-a1-<场景>.XXXXXX)` 作为独立项目根，所有夹具文件（可执行、home 标记、应用标记、全局包目录）都放在该临时树内；不触碰用户真实 `~/.codex`、`PATH`、`/Applications`、真实全局 npm 包。
- **P-3（测试接缝）**：用户可见操作用 `node "$MAESTRO_REPO/bin/orch.js" cli list|scan|probe|add`；需要隔离单一来源（应用目录 / 包管理器 / home 标记）时，用适配器注入接缝直接调用 `src/adapter/cli-discovery/index.js` 导出的 `discoverAgentClis(options)`，注入 `pathEntries` / `appDirs` / `npmGlobalRoot` / `home` / `clock`（现有测试 A1-01~A1-07 即此接缝）。这是 `NODE_ENV=test` 下的可复现实验点，不是新增用户操作。
- **P-4（真实宿主取证机器，AD-08 / D-4）**：AC-12 的前置条件是「一台装有目标 Agent CLI 的机器」；该机器由主控/用户安排。本机当前 PATH 无 codex/claude/gemini 等真实 CLI（仅检出 WorkBuddy.app），AC-12 在本机判阻塞，附试过路径；收口时若仍阻塞，按执行模板 §4.5 升级用户书面豁免，不得把 mock 结果写成真实宿主达标。
- **P-5（mock ACP 夹具）**：能力握手类 AC（AC-07 / AC-14）用 `test/wp16/cli-probe.test.js` 的 `mockAcpScript()` speaking-NDJSON 模拟 agent 取证，证据级别标为「mock 实测」。
- **P-6（全量门禁等效口径与实测基线，AD-06）**：本机 2026-11-23 在仓库根实跑 `node --test "test/**/*.test.js" 2>&1 | tail -5` 两次，每次约 224s：第一次 `# fail 20 / # cancelled 0 / # skipped 3 / # todo 0`；第二次完整摘要 `# tests 1947 / # pass 1923 / # fail 21 / # cancelled 0 / # skipped 3 / # todo 0`，退出码 1（非零）。失败项均为既有桌面壳 / 会话 / 性能等旧迭代用例，A1 面（`test/wp16/cli-discovery.test.js` / `cli-probe.test.js`）无红；两次 fail 数 20→21 说明存在 flaky，**不得写「全量全绿」**。历史全量并发曾 EXIT 137（负载过重，非产品缺陷）；按 AD-06 采用受影响面串行 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` + git worktree 基线树对照、新增红差集 0 作为等效口径。报告须如实标注本机限制（并发 EXIT 137 史 / 全量非零退出 / flaky 偏差 / 实测基线 1947-1923-21），不放宽任何 AC 判据。

---

## 附录 A · 输出基线（用户可见文案）

### A-0 可变值约定（适用 A-1 ~ A-7）

- 占位符在取证时按实际值替换：`[N]` → 实际发现数量、`[名称]` → CLI 名称、`[路径]` → 实际可执行/安装路径、`[版本]` → 探测到的版本文本、`[状态]` → 连接状态文案、`[来源]` → 来源类型、`[时间]` → 实际时间、`[原因]` → 具体失败原因、`[位置]` → 实际文件路径。
- 下列中文文案为用户可见且新增/涉及本迭代，统一由 `src/cli/labels.js` 的 `CLI_DISCOVERY_TEXT` 下发，不出现硬编码字面量：`本机 Agent CLI`、`扫描时间`、`未发现可用的 Agent CLI`、`请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描`、`用法：orch cli list|scan|probe <cli_id> [--format json]`、`未知子命令：{sub}`、`未找到 CLI：{id}`、`扫描完成，发现 {n} 个 Agent CLI`、`标识`、`名称`、`版本`、`路径`、`状态`、`来源`、`可用`、`已连接`、`未就绪`、`检测中`、`已安装但不在 PATH`、`{name} 探测完成：ACP {acp}`、`{name} 探测失败：{cause}`、`支持`、`不支持`、`扫描结果已保存至 {path}`、`CLI 注册表格式不正确`。手动添加与能力矩阵相关新增文案按同一表追加（见 D-7）。
- 不变文案基线（逐字沿用 commit `a80af4f` 已落地的 `CLI_DISCOVERY_TEXT` 键值，不改）：以上 A-0 第二条的 25 个键取值逐字不变；`test/wp2/labels.test.js` 的 `REASON_LABEL` 49 键、`USAGE_LINES` 25 行、`DESKTOP_LABEL_KEYS` 64+63 键等既有计数断言不受本迭代新增表影响（见 D-9）。
- 连接状态词与基线 §4 一致：`idle → 可用`、`connected → 已连接`、`unreachable → 未就绪`、`probing → 检测中`。「未就绪」是用户可见状态词，对应内部 `unreachable`（内部标识见 D-1，不进入 §2/§3 用户视角）。

### A-1 CLI 清单：表头与空态

```
本机 Agent CLI
扫描时间: [时间]

标识  |  名称  |  版本  |  状态  |  路径  |  来源
------------------------------------------------
[cli_id]  |  [名称]  |  [版本]  |  [状态]（已安装但不在 PATH）  |  [路径]  |  [来源]

未发现可用的 Agent CLI
请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描
```

### A-2 扫描完成与保存提示

```
扫描完成，发现 [N] 个 Agent CLI
扫描结果已保存至 [位置]
```

### A-3 连接测试：成功

```
[名称] 探测完成：ACP 支持
```

探测后清单状态列由「可用/未就绪」更新为「已连接」，最近探测时间刷新。

### A-4 连接测试：失败 / 不可达诊断

```
[名称] 探测失败：[原因]
[状态：未就绪]  [原因：已安装但不在 PATH]
```

### A-5 重新扫描

```
扫描完成，发现 [N] 个 Agent CLI
扫描时间: [时间]
```

### A-6 手动添加自定义 CLI

```
已添加 [名称]  [路径]
已存在：[路径]（未重复添加）
添加失败：[原因：名称为空 | 路径为空 | 文件不存在 | 不可执行]
```

### A-7 证据分级标注

```
证据级别：[mock 实测 | 待本机实测（需装有目标 CLI 的机器） | 已实测（真实宿主面）]
```

未取证的真实宿主面一律写「待本机实测（需装有目标 CLI 的机器）」并判阻塞；mock 面写「mock 实测」；两者不得混用，mock 结果不得进入真实宿主达标判据（AC-12 / AC-14）。

## 附录 B · 术语与未决问题

### B-1 术语

- **Agent CLI**：可被 Maestro 发现、并作为员工 Agent 执行载体的命令行客户端（如 Codex CLI / Claude Code / Gemini CLI / OpenCode / WorkBuddy 等）；CLI 是执行层，与 Maestro 并列不嵌套（§1.5 / §8 第 1 条）。
- **发现（discovery）**：只读扫描本机 PATH / 应用目录 / 包管理器 / 用户配置，得出「候选 CLI 清单」；不等于能力探测、不等于可驱动。
- **能力探测（probe）**：对发现的 CLI 做显式、只读、带超时的 ACP `initialize` 握手，读取其声明的完整五类能力（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子，锚定 `docs/index.md` §2.2:128 与 §5:223）；结果写入 CLI 能力矩阵的五个维度（§2.2 / §3.2 / §2.5）。
- **连接状态**：用户对「此刻这个 CLI 连不连得上」的可见判断，取 `idle=可用 / connected=已连接 / unreachable=未就绪 / probing=检测中`（§4）。与「能力」不同：可用不代表能驱动。
- **CLI 能力矩阵**：把各 CLI 的探测能力横向对比的只读视图；本迭代产出可支撑矩阵的数据与判定，矩阵视觉视图由 C1 交付。
- **用户配置 / 手动添加**：第四类发现来源——用户登记自定义可执行路径（覆盖/补充自动发现）；区别于自动发现的候选清单。
- **不可达（unreachable）**：有安装证据但无可执行、或探测失败的 CLI；按 §2.2 边界必须保留在清单并给修复建议，不静默丢弃。
- **CLI 注册表缓存**：扫描结果的本地缓存（`.orch/cli-registry.json`），是扫描的快照而非事实源；可用重新扫描刷新，不写用户机器其他位置。
- **真实宿主面 / mock 面**：前者需在装有目标 CLI 的机器上取证（未取证判阻塞，AD-08）；后者在 `NODE_ENV=test` 夹具上可复现；证据分级见附录 A-7。

### B-2 未决问题与假设（含是否阻塞开工）

- **U-01（阻塞 AC-12，不阻塞其余开工；需主控/用户安排取证机器）**：本机无真实 Agent CLI（AD-08 / D-2 / D-4），「装了至少一种 Agent CLI 的机器上启动应用自动列出」的真实宿主面 AC-12 在本机不可构造，判阻塞并附试过路径；mock 面 AC-14 可全量复现。请主控按 D-4 安排装有目标 CLI 的取证机器，或按执行模板 §4.5 升级用户书面豁免；豁免前 AC-12 不判通过。
- **U-02（不阻塞；需评审确认首版优先 CLI 清单）**：D-2 待用户确认首版优先接入的具体 CLI 清单；已知实现识别表含 Claude Code / Codex / Gemini CLI / Qwen / OpenCode / Aider / DSH / Copilot / Continue / Grok / WorkBuddy / Cursor 等（现状参考）。§2/§3 的判定为「发现器通用、清单是配置项、按实际安装变化」，不绑定具体清单；请评审确认首版优先集，仅影响附录 D 识别表维护，不放宽任何 AC。
- **U-03（已闭合，不阻塞；依据：§2.5 / BR-07 / AC-09 已按规划补全五维）**：规划只写「CLI 能力矩阵」四字，维度按规划 `docs/index.md` §2.2:128「ACP / stdio / 会话恢复方言 / 并发上限 / 证据钩子」与 §5:223「ACP / transport / 恢复方言 / 并发 / 证据钩子」展开为**完整五类**（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子）；F-01 已把曾少列第五类 stdio·transport 的 §2.5 / BR-07 / AC-09 补回该维度，附录 D-4 同步。维度若再有增删，须同步改 §2.5 / BR-07 / AC-09 Then+机检 / D-4，不放宽「未探测显示未探测、与清单一致」的判据。
- **U-04（已闭合，不阻塞；依据：附录 D-11 + §1.3 范围外 + 执行模板 §1.0.4）**：规划 385 行「启动应用能自动列出」在 A1 阶段的可运行用户面确认为 **`orch cli` 命令面**（`cli scan` / `cli list` / `cli probe` / `cli add`），桌面壳 + CLI 发现页首屏属 C1（`docs/index.md` 阶段 C；§1.3 范围外已列明）。该口径已作为**已裁决实现约束**写入附录 D-11：AC-12 的 Given/When/Then 保持用户视角「启动应用执行扫描 → 自动列出且信息准确」，`orch cli` 字面只出现在 §3.1 判定锚点约定与机检/夹具，**不写进 AC-12 的 Then**；不因桌面壳由 C1 交付而默默放宽 AC-12。本项无需再评审确认；若主控改判 A1 必须交付桌面首屏自动扫描，须把 C1 工作前置并重新拆迭代。
- **U-05（已闭合，不阻塞；依据：附录 D-6 + BR-09 / AC-13 用户视角判定）**：`cli add --name <名称> --path <路径>` 明确为**实现建议字面**（本迭代补齐的内部命令，现状仅 `list|scan|probe`，见 D-6），**非规划原文**——规划 385 行只写「手动添加自定义 CLI 可执行」，未规定命令字面。字面仅进入机检/夹具/D-6/D-9；BR-09 与 AC-13 的用户可见判定（添加后出现在清单并可连接测试、非法/重复被拒）不依赖该字面。本项无需再评审确认；字面若由主控另行指定，只改实现锚点，不放宽任何 AC。

## 附录 C · 变更记录

| 版本 | 日期 | 变更内容 | 变更位置 |
|---|---|---|---|
| v1 | 2026-11-23 | 初稿：按三件套撰写完整 8 节。第一部分逐字落地规划 382–386 行：A1 三个子项（扫描四类来源 / 罗列四项信息 / 能力探测与连接测试 / 能力矩阵 / 重新扫描与不可达诊断 / 手动添加）分别落到 §2.2~§2.7，规划**验收**句两句分别落到 AC-12（真实宿主面，标注阻塞前提）与 AC-13（手动添加），并由 AC-14 提供 mock 可复现面；建立 BR-01~BR-11、AC-01~AC-15、NF-1~NF-5；显式处理范围外（桌面/角色/Team/工作流/调度/多宿主/只读边界）与 AD-05/06/08 口径；登记未决 U-01~U-05。交独立评审，不自行宣布通过。 | 全文；头部版本 = 本表末行 |
| v2 | 2026-11-23 | 轮次1 按 review-round1 逐项修复 F-01~F-06：F-01 把能力矩阵补回被删的第五类 stdio·transport、恢复规划完整五维（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子），同步 §1.2 目标3、§2.3 摘要、§2.4、§2.5 用户操作/预期/异常/边界、B-1、BR-07、U-03、D-4、AC-09 的 Then 与机检判据；F-02 闭合 U-04（附录 D-11 写明 A1 可运行面 = `orch cli`，桌面首屏属 C1）；F-03 闭合 U-05（D-6 标 `cli add` 为实现建议、非规划原文）；F-04 在 §2.3 补「可用能力摘要 / 并发上限摘要」用户可见落点；F-05 为 15 条 AC 补可执行架构检查命令（purity 完整 11 词表 + 中文唯一来源 node 检查 + 针对性 grep）；F-06 在 §3.3 P-6 记实测基线 1947/1923/21 与 AD-06 等效口径及本机限制。BR-01~BR-11、AC-01~AC-15 编号连续，Then 未删减放宽，8 节结构不变，括号指引 0。 | 头部版本行；§1.2 目标3；§2.3；§2.4；§2.5；BR-07；AC-01~AC-15 架构检查；AC-09 Then/机检；§3.3 P-6；附录 B 的 B-1/U-03/U-04/U-05；附录 D-4/D-6/D-11；本表末行 |

## 附录 D · 实现约束（技术要点，仅供编码参考，不进入需求判定）

> 本附录是实现建议，不写入 §2 / §3 正文；评审与验收以第二 / 第三部分及附录 A 为准。文件 / 行号为当前仓库现状定位（HEAD `f2b5742`），实现时若漂移以「只改授权清单所列段、保持逐字基线」为准。A1 已有实现先于本编排完成（commit `a80af4f`，AD-05），本附录用于 S2 做差距核对与补齐，不重复造轮子。

### D-1 现状差距（已有实现 vs 本需求）

- 已具备（现状参考，不作需求来源）：PATH / home 标记 / 应用目录 / npm 全局发现（`discover.js`）、版本与 ACP 握手探测（`probe.js`）、`.orch/cli-registry.json` 缓存（`registry.js`）、`orch cli list|scan|probe` 命令（`src/cli/cli-discovery.js`）、中文文案表 `CLI_DISCOVERY_TEXT`（`labels.js:1254`）、测试 `test/wp16/cli-discovery.test.js` / `cli-probe.test.js`。
- 差距（S2 需补齐，均已在本需求 §2/§3 有落点）：① 用户配置作为第四类来源并在重新扫描后保留（AC-05 / BR-02 / BR-08）；② 手动添加自定义 CLI 命令与入口（AC-13 / BR-09）；③ 能力矩阵的数据呈现支撑（AC-09 / BR-07）；④ 已安装但不在 PATH 的修复建议与不可达诊断的可读呈现（AC-06 / BR-04）；⑤ 真实宿主取证（AC-12，阻塞）。
- 不得因「已有代码」而跳过任何 AC 的判定；AD-05 明确 A1 仍走完整 S0→S4 流程，已有代码仅作现状参考。

### D-2 发现来源与只读纪律

- 四类来源：PATH（`resolveOnPath`，不依赖 `which`/shell）、home 标记（仅证据，不证明在 PATH）、应用目录（macOS `~/Applications` + `/Applications`；Windows Program Files；Linux XDG）、包管理器全局根（`npmGlobalRoot` 可注入，默认 null）。发现结果每条带 `evidence`（`type=path|home|app|npm-global`），供 UI 显示来源（§2.2 / AC-01~04）。
- 「报告条件」：有任意 evidence 即列出；PATH 可执行为可用载体（`idle`），仅 home/app/npm 标记者标 `unreachable` + `not_on_path=true` 并给修复建议——实现必须保留这种项，不得静默 `continue`（AC-06 / BR-04）。
- 只读：发现阶段不 spawn、不写扫描目录；版本/ACP 探测是显式分离步骤；缓存写入仅在 `registry.js` 的 `saveCliRegistry`，原子写（临时文件 + rename）。

### D-3 探测与连接测试

- 两个独立、按需触发的探测：`probeVersion`（spawn `<executable> --version`，取首个非空行、截断长度）；`probeAcp`（spawn `<executable> --acp`，NDJSON 写 `initialize`，解析 `id=1 && result` 的响应，提取 `sessionCapabilities`）。
- 硬超时：version 默认 5s、acp 默认 10s；超时 kill 子进程并返回 `{ok:false, code:'CLI_PROBE_TIMEOUT'}`；所有失败以 `{ok:false, code, params}` 数据返回，不抛（AC-08）。
- ACP 握手收敛在 adapter 层，不进核心（§3.2）；daemon 不出现 `if host == '...'`；能力探测结果为调度器（A5/B1）按能力选员工的输入。

### D-4 能力矩阵数据（AC-09）

- 矩阵固定五类维度：ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子（锚定 §2.2:128 / §5:223，不得删为四类）；不得引入第二份能力数据，直接消费注册清单中每条 finding 的 `capabilities` / `acp` / `transport` / 会话恢复方言标记 / `max_concurrent_sessions` / 证据钩子标记；未探测项的**每个维度**显示「未探测」（BR-07），探测失败按「未探出」，不臆造为支持（BR-05）。证据钩子当前无实现支撑属 S2 差距（D-1），按规划列示、不删维、不臆造。
- 矩阵视觉视图由 C1 交付；A1 只保证数据可支撑横向对比且判定可复现（AC-09）。如评审要求 A1 产出最简文本矩阵，按 `renderList` 追加独立渲染段，不改既有 25 行清单表头顺序。

### D-5 重新扫描与不可达诊断（AC-06 / AC-10）

- 重新扫描重新执行发现并覆盖写 `.orch/cli-registry.json`（`scanned_at` 更新），但用户配置条目须合并保留、不被自动发现结果抹掉（BR-08 / AC-05）。
- 不可达诊断文案经 `CLI_DISCOVERY_TEXT` 下发：「已安装但不在 PATH」提示加入 PATH 或手动添加；探测失败提示具体 `cause` 并建议重试；诊断不自动执行探测（避免卡住）。
- 缓存损坏（`schemaVersion !== 1` 或 `clis` 非数组）返回 `CLI_REGISTRY_INVALID`，不静默接受（A1-09）；重新扫描失败保留上一次清单。

### D-6 手动添加与用户配置（AC-05 / AC-13，最大差距）

- 新增命令字面建议 `orch cli add --name <名称> --path <路径>`（**实现建议，非规划原文**；U-05 已闭合）：规划 385 行只写「手动添加自定义 CLI 可执行」，未规定命令字面；本字面仅供机检/夹具与本附录使用，BR-09 与 AC-13 的用户可见判定不依赖它（字面若由主控另指定，只改实现锚点、不放宽 AC）。在 `src/cli/cli-discovery.js` 的 `SUBS`（当前 `list|scan|probe`，第 29 行）追加 `add`；校验名称非空、路径非空、文件存在且可执行，重复路径拒绝且不产生重复项（BR-09）。
- 用户配置来源须独立持久化（建议在 `.orch/cli-registry.json` 中以独立段或单独文件记录用户登记项），重新扫描时与自动发现 findings 合并、不覆盖（AC-05）。放置位置与文件划分由拆分文档定，遵循「AC → WP 满覆盖、文件零交集」。
- 手动添加条目不安装、不修改该 CLI 配置；与自动发现条目同等进入清单、同等可探测（§2.7 边界）。

### D-7 中文文案与基线（附录 A 的落地）

- `src/cli/labels.js:1254` 的 `CLI_DISCOVERY_TEXT` 现有 25 键取值逐字不变（附录 A-0 不变基线）；手动添加与矩阵相关新文案只在该表末尾追加新键，不改动既有键值。
- 连接状态中文映射固定 `idle=可用 / connected=已连接 / unreachable=未就绪 / probing=检测中`（§4 / 附录 A-0）；新增领域层零 CJK，文案唯一来源仍为 labels.js（AD-07 / NF-4 / A1-07）。

### D-8 测试与夹具接缝（全局）

- 独立项目根 `$(mktemp -d /tmp/maestro-a1-<场景>.XXXXXX)`（macOS 用 `os.tmpdir()`，非 `%TEMP%`，AD-04）；统一 `NODE_ENV=test`。
- 发现类夹具用 `discoverAgentClis(options)` 注入 `env` / `home` / `pathEntries` / `appDirs` / `npmGlobalRoot` / `clock` / `platform`（现有 A1-01~A1-07）；探测类夹具用 `test/wp16/cli-probe.test.js` 的 mock ACP agent（A1-10~A1-13）。
- 全量门禁按 AD-06：受影响面串行 + git worktree 基线树对照、新增红差集 0；`dependencies` 恒为 `{}`；purity 禁词表按 AD-07 口径不变（11 词并集扫 `src/core,src/daemon`），新增领域层遵守零 CJK。

### D-9 授权断言修改清单（点名文件 + 行号 + 只改哪一段）

> 下列为当前 HEAD `f2b5742` 现状定位；「只加不改」——新行为打破既有精确断言时只扩本清单，不许弱化功能、不许删 AC/BR。

- `src/cli/cli-discovery.js:29`（`SUBS = new Set(['list','scan','probe'])`）：只追加 `add` 成员，不改既有 `list|scan|probe` 行为（D-6 / AC-13）。
- `src/cli/cli-discovery.js:79-101`（子命令分派 / flag 解析）：追加 `add` 分支与 `--name` / `--path` flag 解析，既有分支与 `--format` 解析不动（D-6）。
- `src/cli/labels.js:1254-1280`（`CLI_DISCOVERY_TEXT`）：末尾追加手动添加 / 矩阵相关新键；现有 25 键取值逐字不动（D-7 / 附录 A-0）。
- `src/adapter/cli-discovery/discover.js:112-185`（`discoverAgentClis`）：追加用户配置来源合并逻辑；既有 PATH / home / app / npm 发现与「有 evidence 即列出」纪律不动（D-2 / AC-05）。
- `src/adapter/cli-discovery/registry.js:47-77`（`saveCliRegistry`）：追加用户配置条目的持久化合并不覆盖自动发现 findings；既有原子写与 schema 校验不动（D-5 / AC-05）。
- `src/adapter/cli-discovery/index.js:5-8`：如新增用户配置/手动添加导出，只追加 export，不改既有导出（D-1）。
- `test/wp16/cli-discovery.test.js` / `test/wp16/cli-probe.test.js`：追加用户配置保留、手动添加、矩阵数据、不可达诊断的新断言；既有 A1-01~A1-13 断言逐字不改、不放宽（AC-05 / AC-09 / AC-13）。
- **已核、明确不改的精确断言**：`test/wp2/labels.test.js:271`（`REASON_LABEL` 49 键）、`test/wp9/i19-labels.test.js:293` / `test/wp15/regression.test.js:156`（`USAGE_LINES` 25 行）、`test/wp14/labels-drill.test.js:303-312`（`DESKTOP_LABEL_KEYS` 64+63 键）、`test/wp13/checkpoint.test.js:105`（checkpoint 全键冻结）——本迭代新增 `CLI_DISCOVERY_TEXT` 是独立新表，不触碰上述表/计数；若实现期发现任何上述断言变红，属越界改动，须回退实现而非放宽断言（NF-5 / AD-06）。

### D-10 编号与标题形态

- BR-01~BR-11、AC-01~AC-15、NF-1~NF-5 连续编号；每条 AC 含 `场景类型 / 风险 / 引用` 三件套与至少一条 `机检：` / `夹具：` / `架构检查：` 判定锚点；每条 AC 引用至少一个真实存在的 BR，每条 BR 至少被一条 AC 引用（双向覆盖）。
- 规划 382–386 行逐字映射：383 行「扫描 PATH/应用目录/包管理器/用户配置」→ §2.2 + §2.7 → AC-01/03/04/05；383 行「罗列名称/路径/版本/连接状态」→ §2.3 → AC-01/02/15；384 行「能力探测与连接测试」→ §2.4 → AC-07/08；384 行「CLI 能力矩阵」→ §2.5 → AC-09；384 行「重新扫描与不可达诊断」→ §2.6 → AC-06/10；385 行验收句前半 → §2.8 → AC-12（真实面，阻塞）+ AC-14（mock 面）；385 行验收句后半「手动添加」→ §2.7 → AC-13；386 行证据前提 → §3.3 P-4 / AC-12 Given / 附录 A-7。反向扫描无「夹带」，规划无条目落入范围外。

### D-11 A1 阶段「启动应用」的可运行用户面（U-04 闭合）

- **已裁决实现约束**：A1 阶段「启动应用即可运行用户面」= `orch cli` 命令面（`bin/orch.js` 的 `cli scan` / `cli list` / `cli probe` / `cli add`），这是规划 385 行「在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且信息准确」在本迭代的可执行落点。桌面壳 + CLI 发现页的首屏视觉与自动扫描交互属 C1（`docs/index.md` 阶段 C，§1.3 范围外已列明），不在 A1 交付。
- **判定边界**：AC-12 的 Given/When/Then 保持用户视角「启动应用执行扫描 → 自动列出该 CLI 且信息准确」；`orch cli` 字面只出现在 §3.1 判定锚点约定、机检与夹具中，**不得写进 AC-12 的 Then**。A1 若被改判要求交付桌面首屏，须把 C1 工作前置并重新拆迭代，不接受默默放宽 AC-12。该项已闭合，不留「待评审确认」悬置。
