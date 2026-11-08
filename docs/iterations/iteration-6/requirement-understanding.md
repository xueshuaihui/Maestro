# I1.6 需求理解纪要（S0 PASS 后 · 需求理解工程师）

> **依据**：`docs/iterations/iteration-6/requirement.md` **v7 定稿**（1685 行；65 条 AC、BR-01~BR-41、NFR-01~NFR-07、M-1~M-7、C-01~C-14、附录 A 输出基线 / B 术语与未决问题 / C 变更记录 / D 实现约束）。
> **评审**：`review-round1.md`（FAIL，阻断 6 / 建议 16）、`review-round2.md`（FAIL，阻断 1 / 建议 4）、`review-round3.md`（**§0 PASS、阻断 0、§8「不需要第 4 轮」**）。
> **裁决**：`decisions.md`（裁-1 ~ 裁-7 + 「18 → 17 条命令」口误更正；第二节 F-01~F-22 处置；第九节 H-01~H-04 处置）。
> **执行标准**：`docs/templates/execution-template.md` §1.0.5、§1.1（13 条 DoR）、§1.4、§2.5、§3.1~3.4、§4.4、§5（22 条全流程硬约束）、§7（14 条红线）。
> **三件套**：`docs/index.md` 第一部分（需求基线；§7 附表把 I1.6 判为「**B · 零 DSH**」，:684 定义、:694 预判 B 并注明「待 §3.3 确认」）、`git show 0cd113b:docs/index.md` 741~753 行（I1.6 条目）、`docs/templates/requirement-template.md`（8 节 + 三条用户视角硬约束）。
> **环境**：Windows 11 / Git Bash / `node v22.22.2`（实跑）；分支 `feat/i1.6-assets-workflow`；HEAD 基线 `0cd113b`；I1.5 已收口（611/611 全绿，45/45 AC）。
> **职责边界**：本纪要只做「理解」，**不改需求正文、不写实现代码、不写拆分文档、不判任何 AC 通过与否、不提交 git**；唯一写入 = 本文件。所有数字与结论来自 v7 原文逐句读 + 实跑命令 + 源码实读，不采信任何产物自述的「已覆盖 / 已确认」。

## 本纪要的实跑核查清单（不采信自述，全部自己跑过）

| # | 命令 / 读法 | 实测结论 |
|---|---|---|
| 1 | `wc -l docs/iterations/iteration-6/requirement.md` | 1685 行 |
| 2 | `grep -c "^#### AC-" requirement.md` + node 切块连续性脚本 | AC 65 条、编号 1~65 连续、无缺号、65 条均含 `**Then**` 与三件套 |
| 3 | `grep -cE "^\| BR-[0-9]+" requirement.md` + BR 双向脚本 | BR 定义 41、最大 BR-41、定义未引用 0、引用未定义 0 |
| 4 | node 计数脚本（NFR / M / C / 附录 C 版本行 / 头部） | NFR 7、M 7、C 14、附录 C `v1..v7` 七行齐、头部 `**版本**：v7` = 末行 v7、状态「**定稿**」 |
| 5 | `node --test --test-concurrency=4 "test/**/*.test.js"` | **611/611 全绿**（`# tests 611 / # pass 611 / # fail 0`） |
| 6 | `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"` | `0`（package.json 无 `dependencies` 键，AC-52 前置成立） |
| 7 | `git show 0cd113b:docs/index.md \| sed -n '741,753p'` | 743~751 为 7 组规划条目、749/750/751 三组命令 5+6+6=17 条、753 四条验收句；工作区 `docs/index.md:787` 与之逐字一致 |
| 8 | node 三面脚本（§3.3 分组展开） | 命令面 35 / 校验器面 24 / 回归与门禁面 6 = 65，无重复、无缺号 |
| 9 | `test/wp11/cli-role.test.js:349-358` 实读 | :354 `assert.equal(block.length, 9, 'eight usage lines plus the reason line');`、:356 `slice(0, 8)` 守卫、:357 `assert.equal(USAGE_LINES.length, 8);` |
| 10 | `src/cli/labels.js:155-164` + A-12 用法块脚本 | `USAGE_LINES` 现为 8 行（首行 `用法：orch run|status|cancel|core`）；A-12 用法块 25 行且前 8 行与 `USAGE_LINES` 逐字一致 |
| 11 | `src/cli/roles.js:91-104`、`:266-276`、`:296-312`、`:315` 实读 | `toRoleJson()` 10 键不含 `wake`/`wakeAllow`；文本 `baseLines` 取 `wake: role.wakeAllow`、JSON payload 用 `roleJson` |
| 12 | `src/templates/index.js:292`、`src/cli/main.js:57-86`、`src/registry/index.js:289/:389-396` | `GRAPHS` 恰 3 键（single/code-loop/task-loop）；`COMMANDS` 仅 5 个无 skill/workflow；`loadRegistry` counts = `roles.length + skills.length + invalid` |
| 13 | `assets/roles/researcher.yaml:13`、`assets/roles/writer.yaml:14-15` | 当前仍为 `wake_allow: []` / `[editor]`（= 0cd113b 基准值，D-7b 属实现期改动） |
| 14 | `ls assets/roles/*.yaml`(16) / `assets/skills/*/`(10) / `test/wp11/*.test.js`(9) / `test/fixtures/` | 16 角色 + 10 技能；`test/wp12/` 不存在（需求阶段，D-10 实现期新建）；四个点名夹具均存在 |
| 15 | `docs/iterations/iteration-5/report.md:23/297/320` | 既有测试基线 **611/611**（评审后复验），三条主链 AC-19 27/27 逐字、无真实宿主面 |

---

## §1 范围（In / Out）

### §1.1 In scope —— 7 组规划能力逐条对应需求 §1.3

依据需求 §1.3 范围内（50~62 行）、§1.3.1 规划逐项对应表（85~101 行）、以及 `review-round3.md` §1 的 29 行覆盖表（29/29「覆盖」）。

| # | 规划能力（`0cd113b:docs/index.md` 741~753） | 需求 §2 节号 | AC 号段 | 需求内落点 |
|---|---|---|---|---|
| 1 | 自定义角色三条路径（从零 / 从内置派生 / 导入包） | §2.2、§2.3、§2.4（写命令）、§2.1-A/B/C | **AC-01 ~ AC-10**、AC-53 ~ AC-59 | §2.2 `role create`；§2.3 `--from` / `export` / `import`；§2.4 `edit` / `diff`；附录 A-2/A-3/A-4/A-5、D-4 |
| 2 | 角色校验器五项（schema 完整性 / 技能引用 / 契约连通 / 权限闭环 / 派生链无循环） | §2.5（281~290 行表） | **AC-11 ~ AC-15**、AC-53 | 仍是同一条 `orch role validate`（不新增命令、不改版式）；C-08 检查顺序 ①~⑪；A-15 新增原因码 |
| 3 | 工作流完整原语 11 项（顺序 / 并行 fan-out·fan-in / 条件分支 / 回流循环 / 轮次上限 / 超时 / 重试 / 人工节点 / 子工作流 / 升级 / 终止；**字段映射按基线能力域 2 单列**） | §2.7、§2.8 | **AC-24、AC-27 ~ AC-30、AC-37、AC-63 ~ AC-64** | §1.2 指标 4（38 行）、§1.3 项 7（59 行）、R-10（129 行）、裁-5；A-1/A-13 `doc-fanout`、A-10 预演文本、A-14 JSON |
| 4 | 节点模型补 `node_type`（role / human / escalate / subworkflow；JSON 键 `nodeType`） | §2.7（319~326 四类节点表） | **AC-22、AC-24 ~ AC-26、AC-62** | §1.3 项 6（58 行）、B.1（1448 行）、M-7（143 行）、D-2、D-3 ⑤；字段名逐字沿用规划 746（F-04） |
| 5 | 工作流校验器六项（可达性 / 回流轮次上限 / 并行 scope 不重叠 / 变量引用 / 状态转换 / 唤醒权限） | §2.9（371~378 行表） | **AC-31 ~ AC-38、AC-60 ~ AC-61、AC-64** | C-09 检查顺序 ①~⑬、D-3 判定口径、BR-21 ~ BR-26 / BR-35 / BR-36 / BR-39 / BR-40 / BR-41；静态图约束（裁-1、R-9） |
| 6 | CLI 资产命令集 **17 条**（role 5 + skill 6 + workflow 6） | §2.2 ~ §2.10 | **AC-01 ~ AC-10、AC-16 ~ AC-23、AC-38 ~ AC-48、AC-53 ~ AC-59** | §1.2 指标 7（41 行）、M-1（137 行）、A-12 用法块 25 行（前 8 行逐字 + 17 行新命令）、D-6 白名单、B-07（17 条口径） |
| 7 | 四条规划验收句 | §2.3 / §2.9 / §2.7 / §2.8 | **AC-05、AC-31、AC-24、AC-41** | 派生改技能行为变化→AC-05；契约不连通被拒→AC-31；含 human/escalate 校验通过→AC-24；dry-run 不启会话→AC-41（四条 AC 标题或引用行显式标「规划验收」，round3 C① 4/4） |

> 补充（§1.3.2 登记，105~114 行）：用法块集中一份、用法错误矩阵、只读不建 `.orch`、写只写 `.orch`、`run --workflow` 边界、兼容与纯净（AC-43 ~ AC-52）**并非 I1.6 规划逐字原文**，而是基线 §5.2 / §6 与 I1.5 CLI 纪律、逐字红线的延续；需求已在 §1.3.1:95 与 §1.3.2 逐条登记真实来源（F-09 已修），不构成规划外新能力。

### §1.2 Out of scope —— 需求 §1.3 范围外清单逐项（14 项，66~81 行）

| # | 不做的事 | 留给谁 | 为什么本迭代不做（需求原文理由） |
|---|---|---|---|
| 1 | 用项目工作流发起实例 `orch run --workflow` | **未分配**（登记为未决 B-01，建议 I1.7 或 I1.8 承接） | 本迭代工作流是「定义与校验」资产：可列出/查看/校验/dry-run/diff，但 `orch run` 仍只认三个内建模板名、`未知模板：<名字>` 文案不变（68 行）；接进运行时等于重写派发路径，与「三条主链逐字不变」正面冲突（R-3:122） |
| 2 | 把角色技能正文、角色契约拼进派发提示词 | **仍不做** | I1.5 R-6 的理由继续成立；提示词有逐字断言（69 行） |
| 3 | 派发时按 `max_concurrent_sessions` 拦截第 N+1 个会话 | **I1.7** | 需要并行原语落地 + 隔离空间（70 行） |
| 4 | `artifact_type` 驱动的目录隔离（**worktree** / 版本化文件区 / 快照 / 只追加区） | **I1.7** | 本迭代只把 `artifact_type` 当契约字段读（71 行） |
| 5 | 角色包/工作流包的**依赖闭包、签名校验、版本兼容检查、来源追溯** | **I1.12** | 本迭代的「包」= 单个可导出/导入的资产文件；`import` 只装这一个文件，缺技能直接拒绝导入（裁-3，72 行） |
| 6 | **崩溃恢复、ACP 恢复方言、会话复用策略** | **I1.8** | 本迭代不碰适配层（73 行） |
| 7 | **角色流程图/工作流画布渲染、折叠组节点下钻** | **I1.10a / I1.10b / I1.11** | 本迭代只把「工作流里有子工作流/人工/升级节点」变成可校验的数据（74 行） |
| 8 | 工作流的 `pause / resume / abort` | **I1.4（实例侧）** | 那是实例操作，不是资产操作，本迭代不重复实现（75 行） |
| 9 | 多人协作下的资产锁、并发写冲突 | **不做** | 写命令是单进程一次性写；冲突检测不在本迭代（76 行） |
| 10 | 资产的权限、链式哈希审计 | **I1.12** | 本迭代不做 ACL（77 行） |
| 11 | 产物合并 / 汇总顺序（并行按声明顺序合并、代码 git 合并、文档版本合并、数据人工裁决） | **I1.7** | 基线能力域 2 单列项；本迭代只把并行组/作用域/映射变成可校验的数据，不落合并动作（78 行） |
| 12 | 版本锁定（实例启动时锁定资产版本） | **I1.8** | 需要实例管理器；本迭代没有运行时，没有「运行中资产更新」场景（79 行） |
| 13 | 工作流的权限匹配（节点权限与角色工具集匹配） | **I1.8** | 需要派发链路与宿主权限模型；本迭代「权限」只在角色侧（权限闭环）与图侧（唤醒白名单）落地（80 行） |
| 14 | 节点 **9 态运行时迁移**（`done→running`、`failed→escalated`、`escalated→cancelled` 等） | **I1.8** | 本迭代没有运行时；「节点状态转换合法性」按静态图约束实现（裁-1，81 行；§2.9:380、BR-25、R-9） |

> 特别点名四项与后续迭代的对应：**I1.7 worktree**（#4，71 行）→ 产物隔离要按角色契约分配空间；**I1.8 九态运行时迁移与崩溃恢复**（#6 + #14，73/81 行）→ 本迭代零运行时、不碰适配层；**I1.10a 流程图渲染**（#7，74 行）→ 本迭代只产出可校验数据、不渲染；**I1.12 资产包依赖闭包与签名**（#5 + #10，72/77 行）→ 本迭代「包」= 单文件，闭包/验签/ACL/审计全部留待 I1.12。

---

## §2 AC 清单与分面

### §2.1 65 条 AC 完整表

「主题」为逐条概括（不贴标题）；「场景类型 / 引用 BR」取自需求各 AC 的 `场景类型：` / `引用：` 行（脚本抽取 + 原文核对）；「锚点」为需求给出的判定锚点类型；「归属面」按需求 §3.3 第 3 条三面分组。

| AC | 一句话主题（概括） | 场景类型 | 判定锚点类型 | 引用 BR | 归属面 |
|---|---|---|---|---|---|
| AC-01 | 从零 `role create` 一次生成合法项目角色：三行输出、首行变 17 个、文件含默认字段、JSON `source=project` | 正常路径 | 机检 | BR-02、BR-03、BR-07 | 命令面 |
| AC-02 | 无 `--from` 时缺 `--name`/`--group`/`--side-effect` 三次都退 2、打印用法块、不建 `.orch` | 异常 | 机检 | BR-03 | 命令面 |
| AC-03 | 同名项目角色已存在先拒（`加 --force 覆盖`）、文件不变；加 `--force` 后覆盖成功、名字生效 | 异常 | 机检 | BR-08 | 命令面 |
| AC-04 | `--from developer` 四项全省仍建出合法角色、继承工具/白名单/并发/产物/组、只覆盖技能，show 多「派生自」行且 JSON 仍 10 键 | 正常路径 | 机检（另有 `机操：` 笔误，见 §2.4） | BR-02、BR-04、BR-05、BR-38 | 命令面 |
| AC-05 | 派生角色改技能引用后 `show` 技能行、`list` 技能数、`validate` 三处可见变化且仍全通过 | 正常路径 | 机检 | BR-04、BR-12 | 命令面 |
| AC-06 | 派生链成环（a↔b）报两条 `ROLE_DERIVE_CYCLE`、改成 ghost 后只报一条 `ROLE_DERIVE_MISSING`，按文件名字典序 | 异常 | 机检 | BR-06 | 命令面 |
| AC-07 | `export --out` → 拷到另一项目根 → `import` 后可用：带 `derived_from`、逐字节相同、validate 全通过 | 正常路径 | 机检 | BR-02、BR-09、BR-10 | 命令面 |
| AC-08 | 导入悬空技能文件与同名已存在两种情形都退 1、`.orch/roles/` 不落任何新文件 | 异常 | 机检 | BR-07、BR-08、BR-10 | 命令面 |
| AC-09 | `edit` 就地规范化重写项目角色（四行含「注释不保留」）；改内置 `developer` 被拒且 `assets/**` sha256 不变 | 混合 | 机检 | BR-07、BR-09 | 命令面 |
| AC-10 | `role diff` 三行差异（`+ derived_from` / `~ name` / `~ skills`）+ `差异 3 项`；逐字段相同角色末行「无差异」 | 正常路径 | 机检 | BR-11 | 命令面 |
| AC-11 | 五份坏角色 + 一条工作流一次 `role validate --format json` 报出五专属码、计数 31/16/10/invalid 5、errors 仍 6 键 | 异常 | 机检 | BR-06、BR-12、BR-13、BR-14 | 校验器面 |
| AC-12 | 契约连通逐字段判：scout 输入没来源、scribe 输出没去处各一条 `ROLE_CONTRACT_UNBOUND`，`notes` 两边都不报 | 异常 | 机检 | BR-13 | 校验器面 |
| AC-13 | 三份 `side_effect`/`tools` 错配角色各报 `ROLE_PERMISSION_MISMATCH`、三条明细固定句 | 异常 | 机检 | BR-14 | 校验器面 |
| AC-14 | 白名单悬空（ghost）与自唤醒（w2）各报 `ROLE_WAKE_UNKNOWN` / `ROLE_WAKE_SELF` | 异常 | 机检 | BR-14 | 校验器面 |
| AC-15 | 空项目根下 26 个内置资产仍全通过，文本一行、JSON counts 6 键与 I1.5 逐字节相同 | 回归 | 机检 | BR-12、BR-32 | 回归与门禁面 |
| AC-16 | `skill list` 首行 + 10 行（按 id 字典序）+ JSON 顶层 2 键 / counts 4 键 / 技能对象 7 键 | 正常路径 | 机检 | BR-15、BR-29 | 命令面 |
| AC-17 | `skill show code-change` 前 6 行元数据 + 第 7 行 `### 工作方法` 正文 + JSON 两键 | 正常路径 | 机检 | BR-15 | 命令面 |
| AC-18 | `skill create quote` 三行输出、自动填骨架正文、随后 `skill validate` 首行 11 个全通过 | 正常路径 | 机检 | BR-07、BR-15、BR-16 | 命令面 |
| AC-19 | `skill validate` 定位 `half`（缺 summary）与 `empty`（空正文）两个坏文件、两专属码、计数 12 | 异常 | 机检 | BR-16 | 命令面 |
| AC-20 | 技能 `export` → 跨项目 `import` 后可用：逐字节相同、list 首行 `内置 9 · 项目 1`、validate 全通过 | 正常路径 | 机检 | BR-08、BR-15 | 命令面 |
| AC-21 | `workflow list` 三内置图首行 + 三行（2/1/3 节点）+ JSON 对象恰 6 键、内置 `file:null` | 正常路径 | 机检 | BR-17、BR-29 | 命令面 |
| AC-22 | `workflow show code-loop` 入口/终点/两节点/三边（含回流轮次上限 2）+ 节点 11 键 `nodeType`、edges[1] backflow | 正常路径 | 机检 | BR-17、BR-19 | 命令面 |
| AC-23 | 项目工作流同名整体覆盖内置：`list` 首行 `内置 2 · 项目 1`、show 来源变「项目」、file 指向 `.orch/workflows/` | 正常路径 | 机检 | BR-18 | 命令面 |
| AC-24 | 四类 `node_type` 齐备的 `doc-fanout` 校验通过（规划验收句；escalate 终点无出边不算不可达 BR-35） | 正常路径 | 机检 | BR-19、BR-20、BR-35 | 校验器面 |
| AC-25 | `node_type: script` / human 缺 `title` / role 缺 `role` 三份工作流各报对应原因码 | 异常 | 机检 | BR-19 | 校验器面 |
| AC-26 | 子工作流引用 ghost 与自引用成环各报 `WORKFLOW_SUB_UNKNOWN` / `WORKFLOW_SUB_CYCLE` | 异常 | 机检 | BR-19 | 校验器面 |
| AC-27 | 并行 `draft` 组在预演里占同一层一行（含 `汇合：all`）、两节点不在同层分两行、layers/edges 计数可核对 | 正常路径 | 机检 | BR-20、BR-23、BR-27 | 校验器面 |
| AC-28 | 三条条件分支在预演中逐条列出、`branches` 三元素 `{from,to,when}`、when 集合固定 | 正常路径 | 机检 | BR-20、BR-25、BR-27 | 校验器面 |
| AC-29 | `timeout:600`/`retry:2` 合法可用、`timeout:0`/`retry:9` 越界被拒、预演显示策略行与 policies 段 | 混合 | 机检 | BR-20、BR-27 | 校验器面 |
| AC-30 | 两条字段映射在预演中可核对、`mappings` 两元素恰 3 键、首条 `from` 逐字 | 正常路径 | 机检 | BR-24、BR-27 | 校验器面 |
| AC-31 | 给 T-002 加 `outline` 输入却无映射报 `WORKFLOW_MAPPING_INCOMPLETE`、补映射后通过（规划验收句） | 异常 | 机检 | BR-24 | 校验器面 |
| AC-32 | 追加孤立节点 T-007 报 `WORKFLOW_UNREACHABLE`、明细含 T-007 | 异常 | 机检 | BR-21 | 校验器面 |
| AC-33 | 追加 `T-003→T-002` backflow 边但目标无 `max_rounds` 报 `WORKFLOW_BACKFLOW_NO_LIMIT`、补 2 后通过 | 异常 | 机检 | BR-22 | 校验器面 |
| AC-34 | 并行组两节点 scope 同为 `draft` 报 `WORKFLOW_SCOPE_OVERLAP`、组只剩 1 节点改报 `WORKFLOW_SCOPE_INVALID` | 异常 | 机检 | BR-23 | 校验器面 |
| AC-35 | 映射 `from` 指向非上游 `T-003.research.notes` 报 `WORKFLOW_VAR_UNKNOWN` | 异常 | 机检 | BR-24 | 校验器面 |
| AC-36 | escalate 有正向出边 / human 出边去掉 `when` 各报 `WORKFLOW_TRANSITION_ILLEGAL`（明细含 T-005 / 人工条件） | 异常 | 机检 | BR-25 | 校验器面 |
| AC-37 | forward 边源 `writer` 白名单 `[editor]` 不含目标 `reviewer` 报 `WORKFLOW_WAKE_DENIED`、换 `editor` 后通过 | 异常 | 机检 | BR-26 | 校验器面 |
| AC-38 | `workflow validate` 文本一行 `校验工作流 3 个：全部通过`、JSON 顶层 2 键 / counts 4 键 / errors 6 键 | 正常路径 | 机检 | BR-20 | 校验器面 |
| AC-39 | `workflow diff fork` 一行 `~ nodes[0].title` + `差异 1 项`；一字不改的 `copy` 末行「无差异」 | 混合 | 机检 | BR-11、BR-18 | 命令面 |
| AC-40 | `workflow create --from code-loop` 生成可校验项目工作流；追加 `--force` 三段用例（同名先拒 / 覆盖成功 / 不合法内容仍被拒且 sha256 不变） | 正常路径 | 机检 | BR-07、BR-17、BR-08 | 命令面 |
| AC-41 | `dry-run` 不建 `instances/`/`core.json`、既有文件 sha256 不变、两次 stdout 逐字节相同（规划验收句） | 边界 | 机检 | BR-27 | 命令面 |
| AC-42 | 不合法工作流（ghost-role）`dry-run` 直接给「预演被拒」+ 提示、无编排计划行、不建实例 | 异常 | 机检 | BR-20、BR-27 | 命令面 |
| AC-43 | 用法块 25 行、前 8 行与 I1.5 逐字相同、9~25 行 17 条新命令、整块 26 行、退 2 | 正常路径 | 机检 | BR-29 | 命令面 |
| AC-44 | 三族 × 四类（未知子命令 / 未知参数 / 标志用错子命令 / 缺位置参数）共 12 次都退 2、原因文案各不同 | 异常 | 机检 | BR-29 | 命令面 |
| AC-45 | 十条只读命令不建 `.orch`、不连核心、`assets/**` sha256 清单前后一致 | 边界 | 机检 | BR-30 | 命令面 |
| AC-46 | 九条写命令新增文件只落三处 `.orch` 与显式 `--out`、`assets/**` 与 `git status` 不变、不建 `core.json` | 边界 | 机检 | BR-01、BR-30 | 命令面 |
| AC-47 | 项目工作流不能被 `orch run --template` 实例化：`未知模板：doc-fanout` 退 1、无实例/无 core.json | 边界 | 机检 | BR-28 | 命令面 |
| AC-48 | I1.5 `role` 三命令十形态逐字回归；D-7b 两行「可唤醒」为唯一例外（AC-48 逐字钉住）；两条 JSON 仍 `toRoleJson()` 10 键不变 | 回归 | 机检（含 D-7b 资产比对） | BR-32 | 命令面 |
| AC-49 | 三条主链（`single`/`code-loop`/`task-loop`）用夹具 + `NODE_ENV=test` 跑、去「已运行 Ns」与时间戳后与 `0cd113b` 逐字一致 | 回归 | 夹具 + 机检 | BR-33 | 回归与门禁面 |
| AC-50 | 全量测试 `--test-concurrency=4` 下限断言 `fail===0 && pass===tests && tests>=611` | 回归 | 机检 | BR-33、BR-34 | 回归与门禁面 |
| AC-51 | 四条架构检查命令（D-9 逐字副本：`$COMMON` 31 词 / `$NOCOORD` / 三条 `purity-check.mjs` / 一条 `node -e` 零 CJK）全部退出 0 | 架构检查 | 架构检查 | BR-31 | 回归与门禁面 |
| AC-52 | `package.json` 的 `dependencies` 键数量为 0 | 架构检查 | 架构检查 | BR-34 | 回归与门禁面 |
| AC-53 | 能力域 1 三项顺延：三份坏角色 + 一条工作流一次 `role validate` 恰好四条错误、同文件 `p.yaml` 多类各一行 | 异常路径 | 机检 | BR-06、BR-12、BR-13、BR-14 | 命令面 |
| AC-54 | `role create` 四个必填参数取值非法（`nope`/`doc`/`heavy`）三次退 2、25 行用法块 + 一行原因、不建文件 | 异常路径 | 机检 | BR-03、BR-07、BR-38 | 命令面 |
| AC-55 | 导入缺 `schema` / `schema: workflow/v1` 两份文件都一行 `ROLE_SCHEMA_MISSING` 拒绝、不落盘、total 仍 16 | 异常路径 | 机检 | BR-07、BR-10、BR-12 | 命令面 |
| AC-56 | `edit --set` 未知键 / `--unset` 必填键两次退 2 且文件不变；合法 `set+unset` 成功并规范化重写 | 异常路径 | 机检 | BR-02、BR-07 | 命令面 |
| AC-57 | 改不存在角色、`role diff`/`workflow diff` 缺基线各退 1；`--against developer` 按角色 diff 口径给差异、净增 `name` 正向断言 | 异常路径 | 机检 | BR-11、BR-37 | 命令面 |
| AC-58 | 内置资产只读：导入内置 id / `skill create code-change` 冒名 / `--force` / 同名项目技能四种情形都不动 `assets/**` | 异常路径 | 机检 | BR-01、BR-08、BR-09、BR-10 | 命令面 |
| AC-59 | `skill create` 的 `--applies-to`/`--commands`/`--body-file` 生效；坏组退 2、缺摘要退 2、空正文退 1 且不落盘 | 正常路径 | 机检 | BR-07、BR-15、BR-16 | 命令面 |
| AC-60 | 补充面：`task.<字段>` 输入恒合法、backflow 指向 human 非法、空白名单 forward 被拒、retest 指 role 合法 | 异常路径 | 机检 | BR-24、BR-25、BR-26、BR-39 | 校验器面 |
| AC-61 | 三条内置图 `invalid=0` 门禁；把 `writer.wake_allow` 改回 `[editor]` 后 `workflow validate` 变红（`内置 ` 前缀）、验完立即还原 | 边界 | 机检 | BR-20、BR-26、BR-39、BR-41 | 校验器面 |
| AC-62 | `node_type` 四类取值异常 + 子工作流引用/跨工作流环，四类原因码各至少一行、`errors[0]` 确定 | 异常路径 | 机检 | BR-19、BR-36 | 校验器面 |
| AC-63 | 11 项原语逐项可表达且逐项可见（预演首行/并行组汇合/三分支/超时重试/人工/子工作流/升级/终止 + show 回流轮次上限） | 正常路径 | 机检 | BR-19、BR-20、BR-27、BR-35 | 回归与门禁面 |
| AC-64 | 终态定义：`human`/`escalate` 天然终点合法、普通 `role` 无出边且不在 terminal 报 `WORKFLOW_UNREACHABLE` | 边界 | 机检 | BR-21、BR-35、BR-36 | 校验器面 |
| AC-65 | 校验顺序与错误排序固定：两次 `validate --format json` 逐字节相同、首行 `5 个：2 个不合法`、首条错误不依赖遍历巧合 | 边界 | 机检 | BR-20、BR-40 | 校验器面 |

### §2.2 分面统计（与需求 §3.3 第 3 条对齐）

| 面 | AC 号段（需求 §3.3:1033-1035） | 条数 | 前置要点 |
|---|---|---|---|
| 命令面 | AC-01~AC-10、AC-16~AC-23、AC-39~AC-48、AC-53~AC-59 | **35** | 全新临时项目根 + 需预置资产由该 AC 自己写入；判终端输出与 `.orch/**` 文件 |
| 校验器面 | AC-11~AC-14、AC-24~AC-38、AC-60~AC-62、AC-64~AC-65 | **24** | 全新项目根 + 该 AC 预置的坏资产；以原因码、C-08/C-09 顺序、`--format json` 计数为核心 |
| 回归与门禁面 | AC-15、AC-49~AC-52、AC-63 | **6** | I1.5 逐字回归、全量测试、架构纯净/零依赖扫描、11 项原语与内置三图门禁 |

**合计 35 + 24 + 6 = 65，无重复、无缺号**（node 展开脚本实跑）。AC-49 / AC-50 按 §3.3 第 4 条是「第 3 条各面的特例」，均归回归与门禁面、不另设面名。场景类型分布实跑：正常路径 21 / 异常 20 / 异常路径 8 / 混合 3 / 回归 4 / 边界 7 / 架构检查 2（合计 65）。

### §2.3 逐字回归红线类 AC 与异常/失败路径 AC

**逐字回归红线类**（任务点名的 6 条 + 需求内同源的 5 条）：

| AC | 钉住的逐字对象 | 依据 |
|---|---|---|
| **AC-43** | 用法块 25 行、`USAGE_LINES.slice(0,8)` 与 I1.5 逐字一致、整块 26 行 | BR-29、M-2、D-7a `:356` 守卫 |
| **AC-48** | `role list/show/validate` 文本与 JSON（除 D-7b 两行「可唤醒」外 0 处）、10 键 `role` 对象、资产仅两处 `wake_allow` 差异 | BR-32、D-8、裁-6/裁-7、AC-48:855-860 |
| **AC-49** | `single`/`code-loop`/`task-loop` 三条主链归一化后与 `0cd113b` 逐字一致 | BR-33、I1.5 report.md:24（AC-19 27/27） |
| **AC-50** | 全量 `611` 只增不减、`fail===0`、既有断言修改仅限 D-7a 两行 | BR-33/34、NFR-06、D-10 下限断言 |
| **AC-51** | 架构纯净四条命令（31 词 `$COMMON`、30 词 `$NOCOORD`、逐文件扫、零 CJK）全部退出 0 | BR-31、C-14、D-9、红线 6 |
| **AC-52** | `package.json` `dependencies` 键数 0 | BR-34、红线 7 |
| AC-15 | 26 内置资产 `校验资产 26 个：全部通过（角色 16 · 技能 10）` 逐字 + counts 6 键 | BR-12/32、R-4 |
| AC-47 | `未知模板：doc-fanout` 文案、`orch run` 预检行为不变 | BR-28、D-8:1654（`test/wp6/main.test.js:247` 不改） |
| AC-61 | 内置三图 `invalid=0`；改坏 `wake_allow` 必须变红 | BR-41、裁-2、D-7b |
| AC-45 / AC-46 | `assets/**` sha256 清单、`git status --porcelain assets` 前后逐字一致 | BR-01/30、C-02/C-06 |

**异常 / 失败路径 AC 清单**（按需求 `场景类型` 抽取，实跑脚本 + 原文核对）：

- 场景类型 = 异常 / 异常路径 / 混合，共 **31 条**：AC-02、AC-03、AC-06、AC-08、AC-09、AC-11、AC-12、AC-13、AC-14、AC-19、AC-25、AC-26、AC-29、AC-31、AC-32、AC-33、AC-34、AC-35、AC-36、AC-37、AC-39、AC-42、AC-44、AC-53、AC-54、AC-55、AC-56、AC-57、AC-58、AC-60、AC-62。
- 另有 **4 条边界/回归类 AC 内含失败路径断言**（`review-round3.md` §3 C③ 口径一并计入）：AC-61（资产改坏后变红）、AC-64（`no-end` 报 `WORKFLOW_UNREACHABLE`）、AC-65（`2 个不合法`）、AC-47（`未知模板` 退 1）。
- 合计异常/失败路径相关 **35 条**；覆盖超时重试越界（AC-29）、回流无轮次上限（AC-33）、并行 scope 重复（AC-34）、变量引用（AC-35）、空白名单（AC-60）、派生链成环（AC-06）、`--force` 覆盖不合法内容仍被拒（AC-40 追加用例）等。

### §2.4 AC-04 锚点标签笔误（登记，不判缺陷）

AC-04:501 出现 `- **机操：**` 标签，不在 §3.1:466 四类观测口径（`机检：`/`夹具：`/`架构检查：`）内；AC-04 另有合法 `机检：`（:500），故 C④ 不受影响。此项即 `review-round3.md` H-04（建议级），`decisions.md` 第九节已转「S3 验收 / 实现期按 `机检（补充）` 理解；若顺手修文案需走需求修订」，**不改 v7 正文**。本纪要 §2.1 表按「机检」记，并在备注登记该笔误。

---

## §3 BR / M / C 契约清单

### §3.1 BR-01 ~ BR-41 一句话清单（需求 §2.12:418-458）

| BR | 一句话规则 |
|---|---|
| BR-01 | 写命令只写 `.orch/roles|skills|workflows/**` 与显式 `--out` 的那个文件；内置资产只读，任何命令不改 `assets/**` |
| BR-02 | 从零 / 派生 / 导入三条路径产出的都是普通项目角色文件，之后 `show`/`edit`/`validate`/`diff` 一视同仁 |
| BR-03 | 无 `--from` 时从零创建必须给 id、中文名、分组、产物类型、副作用等级，缺一退 2 不建文件；有 `--from` 时可省（BR-38） |
| BR-04 | 派生写下来源；未显式给的字段继承来源、显式给的覆盖 |
| BR-05 | 派生不给中文名默认「<来源中文名>（派生）」 |
| BR-06 | 派生来源必须存在；派生链不得成环（含自己派生自己） |
| BR-07 | 先校验后落盘：不合法不写文件并给第一条原因码 |
| BR-08 | 目标已存在拒绝，只有 `--force` 覆盖，且 `--force` 不跳过校验 |
| BR-09 | 内置角色/技能只读：可导出、可作派生来源，不能就地编辑、不能导入覆盖 |
| BR-10 | `import` 只装单文件，不解析闭包/验签/检查版本兼容（留 I1.12）；缺依赖（悬空技能）拒导入 |
| BR-11 | `diff` 只打印不同字段、末行给项数、一致说「无差异」、默认与同名内置基线比 |
| BR-12 | 角色校验五项在同一条 `orch role validate` 给结论；命令名/首行/计数口径/退出码与 I1.5 完全一致 |
| BR-13 | 契约连通逐字段判（输入有来源、输出有去处），只对「被至少一个工作流引用」的角色生效 |
| BR-14 | 权限闭环：工具集与副作用等级自洽、工具名限 `read/write/edit/bash`、白名单角色存在且不含自己 |
| BR-15 | 技能格式仍是 `skills/<id>/SKILL.md`（前置元数据 + 正文），可建/看/校验/导出/导入，正文不进派发提示词 |
| BR-16 | 技能校验沿用既有原因码与版式，计数只算技能 |
| BR-17 | 工作流是声明式资产 `.orch/workflows/<id>.yaml`；三内建图以只读「内置工作流」可列出/查看/作基线与派生来源 |
| BR-18 | 同名项目工作流整体覆盖同名内置基线（不逐字段合并） |
| BR-19 | 每个节点必须有 `node_type`，类型决定必填字段与允许的连接方式 |
| BR-20 | 工作流校验六项逐项专属原因码；同文件不同码各一条、同码只一条 |
| BR-21 | 可达性：所有节点从入口可达，且每个都能走到终态（`terminal` 或任意 `human`/`escalate`，见 BR-35） |
| BR-22 | 只要存在一条回流边，被回流节点就必须声明轮次上限 |
| BR-23 | 并行组至少两个节点，同组各节点产物作用域不得重复 |
| BR-24 | 变量引用必须解析得到；下游每个输入都必须有来源，否则算契约不连通 |
| BR-25 | 状态转换合法性是**静态图约束**（非 §3.1 九态迁移）：入口不得被回流、escalate 无出边、human 出边须人工条件、回流只指 role |
| BR-26 | 唤醒权限：每条 forward 边源角色白名单须含目标；`[]`=不许主动唤醒；backflow/retest 不受约束但目标须 role；三内置图同规则不豁免 |
| BR-27 | `dry-run` 纯静态推演：不起核心/不建会话/不建实例/不写文件/不联网，两次输出逐字节相同 |
| BR-28 | 本迭代不给 `orch run` 增加工作流入参；`--template` 只认三内建名，`未知模板：<名字>` 文案不变 |
| BR-29 | 全部资产命令帮助集中在一份用法块；前 8 行逐字不变，新增 17 行对应 17 条子命令 |
| BR-30 | 只读命令（含 diff/dry-run）不建 `.orch`、不启/连核心；写命令也不连核心 |
| BR-31 | 新增中文只来自 `labels.js`；新增实现文件不出现资产名字面量 |
| BR-32 | I1.5 `role list/show/validate` 文本与 JSON 逐字不变；唯一增量是派生 show 多「派生自」行；唯一例外是 D-7b 两行「可唤醒」（AC-48 钉住）；`toRoleJson()` 不含 `wakeAllow` 故两类 JSON 不受影响 |
| BR-33 | 三条主链终端输出与 I1.5 逐字一致 |
| BR-34 | 不新增运行时依赖；`package.json` 的 `dependencies` 键数量仍为 0 |
| BR-35 | 终态 = `terminal` 指定节点 或任意 `human` 节点 或任意 `escalate` 节点 |
| BR-36 | 节点类型与出入边矩阵（裁-1）：role 可入可出、human/escalate 终点型、subworkflow 按单一节点、回流只指 role |
| BR-37 | **仅 `orch workflow diff`** 口径：只比定义体 `summary/entry/terminal/nodes/edges`，忽略 `schema/id/name`，按下标配对、缺省按缺省值、项数=行数；**角色 diff 口径另见 §2.4/BR-11**，两套不可混用 |
| BR-38 | 派生时参数可省（F-03）：给了 `--from` 时 group/artifact-type/side-effect 继承、name 用默认派生名，四项全省也能建合法角色 |
| BR-39 | 唤醒权限对所有被校验工作流生效（含三内置图），不豁免不收窄；空数组=不许主动唤醒 |
| BR-40 | 校验顺序与错误排序固定（F-11）：按 C-09 ①~⑬、项内 YAML 声明顺序、输出按文件排序，「恰好 N 条」「第一条」确定 |
| BR-41 | 三条内置工作流必须全部通过六项校验（`invalid=0`）：D-7b 资产对齐的回归红线，改回 `wake_allow` 必须变红 |

### §3.2 M-1 ~ M-7 契约变更：改了什么 / 为什么 / 对 I1.5 的兼容影响（需求 §1.4:135-143）

| M | 改了什么 | 为什么 | 对 I1.5 的兼容影响 |
|---|---|---|---|
| **M-1** | `COMMANDS` 增 `skill`/`workflow`；`role` 子命令扩到 8 条；`VALUE_FLAGS` 增 `from/name/artifact-type/side-effect/summary/skills/tools/wake-allow/max-concurrent/set/unset/out/against/body-file/applies-to/commands`；新增可重复标志 `set/unset` 与布尔标志 `force` | 规划要求 17 条资产命令 | 旧命令、旧参数、旧退出码逐字不变；每个子命令有独立标志白名单，跨子命令使用仍是用法错误（I1.5 C-2 / M-9 纪律反向成立）。当前 `src/cli/main.js:57` 仍是 5 命令、`VALUE_FLAGS`:59-69 仅 9 个，M-1 属实现期扩表 |
| **M-2** | `USAGE_LINES` 8 → 25 行（前 8 行逐字不变，追加 17 条子命令行） | 17 条新命令必须有唯一帮助入口（R-8） | **授权修改** `test/wp11/cli-role.test.js:354`（9→26）与 `:357`（8→25）；`:356` 的 `slice(0,8)` 不动。其余测试文件一个字符都不动（附录 D-7a） |
| **M-3** | **不改** `src/registry/index.js` 的 `loadRegistry`；新增独立的工作流加载器与计划器 | R-4：改 `loadRegistry` 会让 I1.5 的 26 资产基线与 `role list` 的 16 角色计数同时变红（`src/registry/index.js:389-396` 实读 `assets = roles.length + skills.length + invalid`） | 只增文件；`loadRegistry` 返回结构、计数口径、报错顺序全部不变；`role validate` 资产集合不含工作流（C-11） |
| **M-4** | 角色文件新增可选键 `derived_from`（已有可选键不变） | 派生链无循环需要一条可追溯的边 | `checkRoleShape` 只校验「出现过的键」，新增可选键不改变任何既有角色合法性；**不需要改动任何内置资产**；本迭代对内置资产的唯一改动是 D-7b 两处 `wake_allow` 对齐 |
| **M-5** | 角色实例 JSON、`role list/show/validate` 的 JSON 与文本一律**不加键、不改版式**；派生信息只出现在 `role show` 第 7 行（仅派生）、`role export` 文件内容、`role diff` 输出 | 保住 `test/wp11/cli-role.test.js:285-300 / 499 / 523 / 563 / 577-590` 全部键集合断言 | 非派生角色（含 16 内置）输出逐字不变（**除 D-7b 授权、AC-48 逐字固定的 researcher/writer 两处「可唤醒」行外**）；`--format json` 因 `toRoleJson()` 不含 `wakeAllow` 而不受影响 |
| **M-6** | `src/cli/labels.js` 新增：三族命令文案、7 条角色新原因码、19 条工作流原因码、5 条条件与类型标签 | 中文唯一来源 | 既有表一个键都不加不改；新增表只被新代码引用。当前 `labels.js:92` `showWake`、`:155-164` `USAGE_LINES` 是既有基线 |
| **M-7** | 工作流资产节点新增必填 `node_type`（`role`/`human`/`escalate`/`subworkflow`；JSON 键 `nodeType`）；内建图投影节点一律 `node_type: role` | 规划 746 要求补 `node_type`（F-04：字段名逐字沿用规划，不改写成 `type`） | 内建图对象本身不改（`src/templates/index.js:292` `GRAPHS` 恰 3 键）；`state.json` 节点结构不改（本迭代不实例化项目工作流） |

### §3.3 C-01 ~ C-14 补充契约：约束哪个行为（需求 §1.4:145-162）

| C | 约束的行为 |
|---|---|
| C-01 | 三族资产 id 命名与落盘文件名一致（`^[a-z][a-z0-9-]*$`、2~32 字符；角色/工作流 `<id>.yaml`、技能目录 `<id>`） |
| C-02 | 写命令三个默认落点 + 显式 `--out` 那个文件的唯一例外；不得写 `assets/**`、不得创建其它目录 |
| C-03 | 写命令先校验后落盘：内存里跑完整校验、出现任一原因码即不写、输出「<动作>被拒：<明细>（<原因码>）」退 1 |
| C-04 | 落盘原子（同目录临时文件 + rename）：失败时目标保持原样、不留 `.tmp` 残留（NFR-05） |
| C-05 | 目标已存在拒绝并提示「（加 --force 覆盖）」；`--force` 只覆盖文件、不跳过校验 |
| C-06 | 内置资产只读：`role edit`/`role import`/`skill create` 同名覆盖内置拒绝；`role export`/`role create --from`/`workflow create --from` 可读内置 |
| C-07 | 序列化口径固定（key 顺序、只输出出现过的可选键、数组行内 `[a, b]`、2 空格缩进、注释不保留、重写即规范化） |
| C-08 | 角色校验器检查顺序 ①~⑪ 固定（必填→id/文件名→group→artifact_type→side_effect→max_concurrent_sessions→技能引用→权限闭环→白名单→派生链→契约连通）；同文件同码只报第一条 |
| C-09 | 工作流校验器检查顺序 ①~⑬ 固定 + 项内遍历顺序（①~⑬ 从小到大、同项按 YAML 声明顺序、同节点按 A-1 字段顺序）+ `errors` 输出排序（项目按文件名字典序、内置以「内置 」前缀参与排序） |
| C-10 | 内置工作流由三内建图投影（节点 `role`、`title` 取图节点 title、`max_rounds` 取 `maxRounds`、边 `when` 归一化；运行时条件一律归 `always`），不落盘、不参与写命令，但**参与全部六项校验含唤醒权限**（裁-2） |
| C-11 | `workflow validate` 资产集合 = 内置 3 + 项目（同名覆盖）；`role validate` 资产集合不变（角色 + 技能）；两命令计数各自独立、不得混用 |
| C-12 | `dry-run` 是纯函数：不连/不起核心、不建 `.orch`、不写任何文件、不创建 `.orch/instances`；同输入两次输出逐字节相同 |
| C-13 | 失败码两层：资产级（角色 7 + 工作流 19）只出现在 `validate`/写命令被拒/`dry-run` 被拒；命令级 6 码（`ROLE_NOT_FOUND`/`SKILL_NOT_FOUND`/`WORKFLOW_NOT_FOUND`/`ASSET_EXISTS`/`ASSET_READONLY`/`BASELINE_MISSING`）决定退出码与首句、不进资产错误表；退出码 0/1/2/3 语义沿用 |
| C-14 | 语言口径：`src/registry/**`、`src/cli/roles.js`、`src/cli/skills.js`、`src/cli/workflows.js` 零 CJK、零资产名字面量；中文与原因码模板只在 `labels.js`；`src/core`、`src/daemon` 不 import 任何注册表模块 |

### §3.4 授权断言修改清单（重点）

**（一）D-7a：既有断言只有两行（需求 1623~1632 行，`test/wp11/cli-role.test.js`）**

| 文件 | 行 | 现状（实读） | 只改这一段 | 理由 |
|---|---|---|---|---|
| `test/wp11/cli-role.test.js` | **354** | `assert.equal(block.length, 9, 'eight usage lines plus the reason line');` | 把 `9` 改成 `26`，注释改成 `twenty-five usage lines plus the reason line` | 用法块 8→25 行（M-2），整块行数 = 25 + 1 原因行 |
| `test/wp11/cli-role.test.js` | **357** | `assert.equal(USAGE_LINES.length, 8);` | 把 `8` 改成 `25` | 同上 |

- **第 356 行 `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES]);` 不得改动**：它正是「前 8 行逐字不变」的守卫（AC-43）。
- 除这两行外 `test/**` 一个字符都不许改；新增断言一律放新文件（D-10 `test/wp12/`）。F-12 已把行号从 353 更正为 354；round3 §5.2 判 F-12「保持已修」。

**（二）D-7b：两处内置资产 `wake_allow` 对齐（需求 1634~1641 行，裁-2 的唯一例外）**

| 文件 | 行 | 现状（实读） | 对齐为 | 层次 |
|---|---|---|---|---|
| `assets/roles/researcher.yaml` | 13 | `wake_allow: []` | `wake_allow: [writer]` | 实现阶段由开发者改**仓库文件**（交付的仓库内容），**不是任何 CLI 命令的运行时行为** |
| `assets/roles/writer.yaml` | 14-15 | `wake_allow:` / `  - editor` | `wake_allow: [editor, reviewer]` | 同上 |

- 理由：`task-loop` 的 `researcher→writer`、`writer→reviewer` 是正向边，I1.5 的白名单会让这两条边触发 `WORKFLOW_WAKE_DENIED`；只改取值、不动字段结构，是让 BR-26/BR-39/BR-41 在三条内置图上同时成立的最小修正（R-6）。
- 运行时 `assets/**` 仍只读，故 BR-01 / AC-46 / AC-58 的「内置只读」口径不变；`AC-48` 逐字钉住两行新值、`AC-61` 作回归门禁。
- **与 AC-61 的层次区分**：D-7b 是「实现期把基线值改成对齐值」；AC-61 的 When 是「验收期临时把 `writer.wake_allow` 改回 `[editor]` 验证 `workflow validate` 变红，验完立即还原」，两者顺序不可颠倒。

**（三）H-01 的 `--instance` 形态边界 —— 标为 S1 待裁决**

- D-7b / BR-32 / AC-48 点名的「唯一例外两行」只写了**不带 `--instance` 的纯 `role show researcher` / `role show writer`** 的「可唤醒」行。
- 源码实读：`src/cli/roles.js:269-276` 在 `format === 'json'` **之前**就用 `wake: role.wakeAllow` 生成 `baseLines`；`:315` 文本分支先 `for (const line of baseLines) out(line)` 再追加 `instanceLine`。因此 `role show researcher --instance X` / `role show writer --instance X` 的文本「可唤醒」行**同样**会随 D-7b 从 `—`/`editor` 变为 `writer`/`editor, reviewer`（I1.5 `evidence/AC-28.show-builtin.txt:4` 是 `  可唤醒：editor` 的既有输出基线）。该形态未被例外点名、无 AC 覆盖，BR-32「其余 I1.5 既有输出一字不变」字面与之不完全自洽。
- **处置（decisions.md 第九节）**：不改 v7 正文；**转 S1 任务拆分**，在「授权断言修改清单」里明确 `--instance` 形态是否纳入两行例外，并由实现 Agent 补机检。
- **本纪要标注为「S1 待裁决」，不判阻断**：`review-round3.md` §5.3 H-01 与 §8 均判建议级、不阻断；I1.5 无测试逐字锁该行（实跑 `grep -rn "可唤醒\|show-builtin" test/wp11/*.test.js` 仅命中 `:152` 的 developer `  可唤醒：tester`），变化源单一，核心回归红线（developer / list / validate / 三条主链 / 两类 JSON）全有 AC 覆盖，AC-50（611 全绿）不受影响。

---

## §4 附录 A / D 索引

### §4.1 附录 A-1 ~ A-15：是什么输出基线 / 被哪些 AC 引用（需求 1045~1435 行）

| A | 是什么输出基线 | 被哪些 AC 引用（需求内可核对） |
|---|---|---|
| **A-1** | 新增资产字段口径：角色新增可选键 `derived_from`；`workflow/v1` 必填/可选键、四类节点必填、边 `kind/when/join/map` 取值域、`join` 汇合语义 | A-13 夹具全文即 A-1；AC-22/24/25/26/27~38/62/63/64 的节点与边字段；AC-29/30 的 timeout/retry/map；M-4/M-7/D-2 依据 |
| **A-2** | `orch role create` 成功三行 / 被拒一行 / 已存在一行 | AC-01、AC-02、AC-03、AC-54；AC-08/55/58 复用「被拒」句式 |
| **A-3** | `orch role edit` 成功四行（含「已按规范格式重写，注释不保留」）/ 内置不可编辑 / 被拒不写回 | AC-09、AC-56、AC-57；AC-05（edit 后的 show/list 变化） |
| **A-4** | `role export` / `role import` 输出（带 `--out` 一行、不带时 stdout 文件正文；import 成功两行、被拒句式） | AC-07、AC-08、AC-55、AC-58 |
| **A-5** | `role diff` 输出（对比行、`+/-/~` 前缀、`差异 N 项`、一致时「无差异」、数组/`null` 写法） | AC-10、AC-57；round3 §6 X1 把「差异 3 项 / `~ name`」与 AC-10 逐字对账 0 不一致 |
| **A-6** | `skill list` / `skill show` 输出（首行 + 行格式、六行元数据 + `正文：` + 缩进正文） | AC-16、AC-17、AC-20 |
| **A-7** | `skill create` / `validate` / `export` / `import` 输出 + 不给 `--body-file` 时的默认正文骨架（逐字） | AC-18、AC-19、AC-20、AC-59 |
| **A-8** | `workflow list` / `workflow show` 输出（行格式、节点行、边行方向/轮次上限/条件/字段映射条数） | AC-21、AC-22、AC-23、AC-63（`show code-loop` 的 `T-002 → T-001 回流 · 轮次上限 2`） |
| **A-9** | `workflow validate` 输出（全通过一行、坏资产逐条 `- <路径>：<明细>（<码>）`、内置写 `内置 <id>` 且以「内置 」前缀排序） | AC-24、AC-31~AC-38、AC-38、AC-60、AC-61（`1 个不合法` 与 `内置 ` 句式）、AC-62、AC-64、AC-65（`校验工作流 5 个：2 个不合法`） |
| **A-10** | `workflow dry-run` 输出（首行计数、层行/并行组层行固定带 ` · 汇合：all|any`、三段小标题、条件中文映射、末行结论、被拒句式） | AC-27（并行组行）、AC-28（分支三行）、AC-29（超时重试行）、AC-30（映射两行）、AC-41（末行）、AC-42（被拒）、AC-63（首行/层行/1 个子工作流） |
| **A-11** | `workflow diff` 输出（对比行、`~ nodes[0].title` 字段路径写法、`差异 1 项`、无差异、缺基线提示） | AC-39、AC-57 |
| **A-12** | 用法块 **25 行**（前 8 行 I1.5 逐字 + 17 条新命令）+ 用法错误追加一行 = 26 行 + `role create` 四项两档口径 | AC-43、AC-44、AC-54、AC-02、AC-04；M-2、R-8、D-7a |
| **A-13** | 夹具工作流 `doc-fanout` 全文（即 A-1 的 YAML，逐字使用） | AC-24、AC-27 ~ AC-38、AC-41、AC-42、AC-63 全部复用 |
| **A-14** | JSON 结构基线：role diff 三键/changes 四键、skill list/show/validate、workflow list/show/validate/dry-run 的顶层与各对象键集合（含 `layers[]` 2 键、`branches[]` 3 键、`mappings[]` 3 键、`policies[]` 3 键） | 几乎所有机检结构断言：AC-10/16/17/19/21/22/24/27/28/29/30/38/39/57/63 等；也是「`toRoleJson()` 10 键」的对照口径 |
| **A-15** | 新增原因码（角色 7 + 工作流 19）明细模板 + 命令级 6 失败码 + 退出码 0/1/2/3 | AC-11~14、AC-19、AC-25/26/29、AC-31~37、AC-42、AC-53、AC-55、AC-58/59/60/61/62/64/65 |

> 需求 1047 行声明「附录 A 是**唯一**输出基线，AC-01 ~ AC-48 中涉及命令输出的判定依据；未登记的输出不得改动」；round3 §6 X1 实跑「附录 A 逐字输出 ↔ 引用它的 AC Then，逐字不一致数 0」。

### §4.2 附录 D-1 ~ D-10：实现约束 / 对应 AC 或 BR / 落到哪些 `src/` 文件（需求 1496~1685 行）

| D | 实现约束 | 对应的 AC / BR | 落到哪些文件 |
|---|---|---|---|
| **D-1** | 模块与文件边界表（10 行职责/允许依赖/禁止）+ **不得改动**清单（`loadRegistry`、`src/templates/index.js`、`src/core/**`、`src/daemon/**`、`assets/**`；唯一例外 D-7b） | M-1~M-7、C-14、BR-31、AC-45/46/51 | 新增 `src/registry/{workflow-schema,workflows,workflow-plan,contracts,asset-write}.js`；扩 `src/cli/{roles,skills,workflows,labels,main}.js` |
| **D-2** | 工作流 YAML 子集约束：沿用 `yaml-lite.js` 不新增解析能力；禁行内映射/块标量/锚点/`---`/制表符/标量里 `{`；解析失败 `YAML_PARSE_FAILED` 带 1 基行号 | AC-24/63 夹具可解析、C-09 ①、BR-19 | `src/registry/yaml-lite.js`（沿用）、`workflow-schema.js`、`workflows.js` |
| **D-3** | 工作流校验顺序 ①~⑬ 可执行版 + 判定口径逐条写死（可达性终态、回边轮次、并行组、变量引用正则、映射完整性、控制流边豁免 ⑪、状态转换、**⑬ 唤醒权限**） | AC-31~38/60~62/64/65、BR-20~26/35/36/39/40/41、C-09、裁-1/裁-2 | `workflows.js`、`workflow-schema.js`、`contracts.js` |
| **D-4** | 角色写命令落盘规则（create/edit/export/import 四段流程；校验入口与 `role validate` **同一套** `checkRoleShape` + 技能解析 + `contracts.js`，不得另写判定；`--from` 继承字段集合；派生默认名模板在 `labels.js`；内置只读判定用 `source === 'builtin'`） | AC-01/03/04/07/08/09/40/55/56/58、BR-02/04/05/07/08/09/10、C-02~C-07 | `asset-write.js`、`src/cli/roles.js` |
| **D-5** | `planWorkflow({workflow, task})` 纯函数：最长路径分层、并行组、分支、映射、策略、子工作流计数；不看时钟/不联网/不读实例，两次输出逐字节相同 | AC-27/28/29/30/41/42/63、BR-27、C-12、NFR-02/04 | `workflow-plan.js` |
| **D-6** | CLI 参数与白名单（18 个子命令的位置参数/允许标志表）；白名单检查放解析**之后**（保证「未知参数」与「标志用错子命令」两句不同）；`--set/--unset` 进 `REPEATABLE_FLAGS`、`--force` 进 `BOOLEAN_FLAGS`；`role create` 两档必填顺序 `--name→--group→--artifact-type→--side-effect` | AC-02/44/54/56/59、BR-03/29/38、C-13、M-1 | `src/cli/main.js`（`COMMANDS`/`VALUE_FLAGS`/`BOOLEAN_FLAGS`/`REPEATABLE_FLAGS`/`ROLE_FLAGS` 扩展；当前 `:57-86` 为 I1.5 形态） |
| **D-7a** | 授权断言修改清单（只有两行） | M-2、AC-43/50、BR-29 | `test/wp11/cli-role.test.js:354/357`（`:356` 守卫不动） |
| **D-7b** | 内置资产对齐授权（裁-2 的唯一例外） | 裁-2、BR-26/39/41、AC-48/61、B-03 | `assets/roles/{researcher,writer}.yaml`（实现期改仓库文件） |
| **D-8** | 兼容性红线表（role 三命令文本/JSON、三条主链、`orch run` 预检与「未知模板」、`loadRegistry` 计数与报错顺序；唯一例外 D-7b 两行「可唤醒」由 AC-48 逐字固定） | BR-32/33、AC-15/47/48/49、§1.2 指标 8 | `test/wp11/cli-role.test.js:285-300/499/523/530/577-590`、`test/wp11/registry.test.js`、`test/wp6/main.test.js:247`（均不改且全绿） |
| **D-9** | 架构纯净扫描 **四条完整命令**（`$COMMON` 31 词、`$NOCOORD`、三条 `purity-check.mjs`、一条 `node -e` 零 CJK）；四条都必须退出 0；第 2 条保留 I1.5 定点断言（`coordinator` 在 `src/registry/**` 只允许出现在 `role-schema.js` 的 `GROUPS` 一行） | AC-51、BR-31、C-14、红线 6 | `test/fixtures/purity-check.mjs`（实读存在，`DEFAULT_FORBID` 只有 4 词、必须显式 `--forbid` 传全表）、`node -e` |
| **D-10** | 测试与夹具约束：新增用例放 `test/wp12/` **8 个文件**；纯函数用例不碰磁盘；项目根用 `fs.mkdtemp(os.tmpdir())` 不放仓库内；`cli-assets.test.js` 直接 `import { main }` 注入 `out`/`cwd` 不 spawn；全量命令固定 `node --test --test-concurrency=4 "test/**/*.test.js"` + 下限断言；AC-49 沿用 drivers + `mock-acp-agent.js` + `NODE_ENV=test` | AC-49/50、NFR-06、D-7a | `test/wp12/{role-write,role-contracts,skill-assets,workflow-schema,workflow-yaml,workflow-validate,workflow-plan,cli-assets}.test.js`（实跑当前不存在，实现期新建） |

**特别说明（任务点名的四处）：**

1. **D-3 的 ⑬ 唤醒权限口径**（1547、1560 行）：只检查 `kind: forward` 的边；`from` 是 `role` 节点时其 `wake_allow` 不含 `to` 角色 → `WORKFLOW_WAKE_DENIED`；`wake_allow: []` 表示「不允许主动唤醒任何角色」，此时只要有 forward 出边就报该码；`backflow`/`retest` 跳过本项（由 ⑫ 保证目标必须是 `role`）；`to` 不是 `role` 节点时跳过。**「所有工作流，含三条内置图」**（裁-2、BR-39/41）—— 这正是 D-7b 要对齐两处 `wake_allow` 的动因，也是 AC-61「改坏资产 `workflow validate` 先红」门禁的依据；另 ⑪ 写死 backflow/retest 控制流边跳过（不携带产物映射）、可达性终态含 `human`/`escalate`、⑤ 字段名 `node_type`。
2. **D-7a / D-7b 的层次**（1621 行伞形说明）：「附录 D-7 = D-7a（既有断言的两行授权）+ D-7b（内置资产对齐的唯一例外），两节合称 D-7」。D-7a 改的是 `test/wp11/cli-role.test.js` 的**两行既有精确断言**（用法块 8→25 的连带）；D-7b 改的是 `assets/**` 的**两处 `wake_allow` 取值**（让唤醒权限在内置三图上成立）。两者一个是测试断言、一个是仓库资产，都在实现期由开发者改，都不是 CLI 运行时行为；AC-50 的「既有断言修改仅限附录 D-7 点名的两行」指 D-7a。
3. **D-9 的四条架构检查命令**（1659~1674 行；AC-51:885-902 已逐字复制进 AC 内，注明「D-9 为唯一权威、不得改动」）：① `purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"`（31 词，与 I1.5 相同）；② `--dirs src/registry --forbid "$NOCOORD"`（30 词 = 31 词去 `coordinator`）；③ `--files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"`（逐文件扫，`labels.js` 合法持有资产名、不得整目录扫）；④ `node -e` 零 CJK 扫描（roots = `src/registry` + 三族 CLI 文件）。四条都必须退出 0。
4. **D-10 的 `test/wp12/` 八个测试文件**（1680 行）：`role-write.test.js`、`role-contracts.test.js`、`skill-assets.test.js`、`workflow-schema.test.js`、`workflow-yaml.test.js`、`workflow-validate.test.js`、`workflow-plan.test.js`、`cli-assets.test.js`。其中 `workflow-schema` / `workflow-plan` 为纯函数类（输入内存对象、不碰磁盘）；`cli-assets.test.js` 不 spawn、退出码用返回值。

---

## §5 未决问题与假设

### §5.1 附录 B 的 B-01 ~ B-08（需求 1467~1478 行）

| # | 当前结论 | 是否阻塞开工 | 承接迭代 |
|---|---|---|---|
| **B-01** | 项目工作流何时能被 `orch run` 实例化：本迭代**不做**运行时实例化，`run --template` 仍只认三个内建模板名（BR-28）；建议在 I1.7（并行与作用域）或 I1.8（实例管理器）承接，并在规划侧补一条迭代条目 | **不阻塞 I1.6**；**阻塞 I1.10a**（其验收需要「含人工节点与子工作流的实例在流程图上拓扑完整」），需规划方裁决归属 | I1.7 / I1.8（登记 B-01；I1.10a 依赖该裁决） |
| **B-02** | 工作流是否需要「版本号」字段供 I1.12 版本兼容检查：本迭代不加，`schema: workflow/v1` 即版本位 | 不阻塞 | I1.12（版本兼容检查） |
| **B-03** | 内置 `task-loop` 的 `writer→reviewer` 与 `writer.wake_allow=[editor]` 不一致：唤醒权限对**所有**被校验工作流生效（含三内置图，不豁免不收窄，裁-2/R-6/BR-39/BR-41）；按 D-7b 对齐 researcher/writer 两处 `wake_allow`；新增 AC-61 作「资产改坏 `workflow validate` 先红」门禁；两行「可唤醒」由 AC-48 逐字固定、JSON 不受影响 | 不阻塞 I1.6 | 本迭代已闭环（裁-2 / 裁-6 / D-7b / AC-48 / AC-61） |
| **B-04** | `derived_from` 是否支持多级继承字段解析：**不支持**，派生是一次复制、来源只在 A→B 这一层；链只用于「来源存在性」与「成环检测」 | 不阻塞 | 无（本迭代定论） |
| **B-05** | `role edit` 是否保留文件注释：**不保留**（规范化重写），命令输出末行明说（A-3） | 不阻塞 | 无 |
| **B-06** | `workflow create --from` 是否复制 `timeout`/`retry`/`map`：**复制全部结构与策略字段**（节点、边、超时、重试、映射、并行组、作用域），不复制运行时产物 | 不阻塞 | 无 |
| **B-07** | 主控口述「三组共 18 个命令」与规划不符：规划原文逐条相加是 **17 条**（`0cd113b:docs/index.md:749-751` = role 5 + skill 6 + workflow 6），「18」是口述口误，按 17 条实现；`decisions.md`「口误更正」已登记 | 不阻塞 | 无（本迭代定论） |
| **B-08** | 契约连通是否对「只写了角色、还没写工作流」的用户产生噪音：**不会**，只对「被至少一个工作流引用」的角色生效（BR-13） | 不阻塞 | 无 |

### §5.2 `review-round3.md` §7 的 6 条规划歧义（315~324 行）

| # | 歧义 | 已由哪条裁决处理 | 是否还需规划方书面确认 |
|---|---|---|---|
| 1 | 「节点状态转换合法性」口径（747；基线 §3.1 九态 vs 能力域 2 校验项，本迭代无运行时） | **裁-1**：按静态图约束实现（R-9 / §2.9:380 / BR-25 / BR-36 / D-3 ⑫），九态迁移明确留 I1.8 | 需求侧已定稿；decisions.md 裁-1 已登记，round3「不重开、不替规划方裁决」。书面确认非开工前置 |
| 2 | 「角色对唤醒权限」是否含内置工作流 + I1.5 逐字红线例外审批口径（747，联动 0cd113b:713/722） | **裁-2**（含三内置图、不豁免）+ **裁-6**（红线限定为「除 D-7b 两行外 0 处」、AC-48 追加四条钉住）+ **D-7b** | 主口径已裁决。**本轮延伸 H-01 暴露的 `role show <researcher\|writer> --instance` 文本形态是否纳入例外，round3 §7-2 建议规划方在任务拆分前给一句口径（明写「不阻断本轮」）；decisions.md 第九节已转 S1** |
| 3 | 「导入包」的「包」边界（743） | **裁-3**：包 = 单文件；依赖闭包/签名/版本兼容/来源追溯留 I1.12（§1.3:72 登记范围外） | 不需再确认（范围外已登记） |
| 4 | 「派生角色修改技能引用后行为变化符合预期」中的「行为」（753） | **裁-4**：收敛为 AC-05 的 `role show` / `role list` / `role validate` 三处可见变化（技能正文不进派发提示词，I1.5 R-6） | 不需再确认 |
| 5 | 「工作流完整原语」计数口径（745 的 6 项 vs 基线 335 的 11 项） | **裁-5**：统一 11 项（fan-out/fan-in 算 1 项、含升级/终止），字段映射按能力域 2 单列；R-10、§1.2:38 / §1.3:59 / AC-63 逐项落地，F-21 已修 | round3 §7-5 仍写「仍需规划方统一一处枚举」；需求侧已按裁-5 逐项落 AC-63、round3 §1 数清 6/6，属建议级枚举口径确认，**不影响开工** |
| 6 | 「保持向后兼容 / 旧调用方式不得失效」边界（0cd113b:713/722，属 I1.4 条目） | 由 BR-32/33、§1.2 指标 8、D-8 合并承接；例外审批口径与第 2 条联动、**已由裁-6 定** | 不需再确认（与第 2 条同一裁决链） |

### §5.3 4 条建议 H-01 ~ H-04 的处置 / 承接阶段（`decisions.md` 第九节，206~217 行）

| H | 处置（一律不改 v7 正文） | 承接阶段 |
|---|---|---|
| **H-01** | 在「授权断言修改清单」里明确 `role show researcher/writer --instance` 文本形态是否纳入两行例外，并由实现 Agent 补机检；不判为已修 | **S1 任务拆分** |
| **H-02** | 验收 Agent 写 `ac48.mjs` 时补 `grep` 逐字比对与「差异行数 === 2 且仅两处 `wake_allow`」断言（AC-48:859 机检只覆盖原六条、:860 只打印差异未给「恰好两处」机判定） | **S3 验收** |
| **H-03** | 拆分文档的 AC-48 契约里写清「原六条逐字 + 追加四条 = 十条」两段，消除「六条 / 十条」并列的误读 | **S1 任务拆分** |
| **H-04** | AC-04:501 的 `机操：` 按「机检（补充）」理解；实现期若顺手修文案需走需求修订，不在 v7 正文擅自改 | **S3 验收 / 实现期** |

> 四条均为建议级、**不判为已修**、不构成 S0 准出阻塞（round3 §0 阻断 0、§8「不需要第 4 轮」）。

### §5.4 结论：是否存在阻塞 S1 开工的未决问题

**结论：不存在。**

可核对依据：
1. B-01 ~ B-08 逐条结论明确，全部「不阻塞 I1.6」（§5.1）；唯一标「阻塞」的是 B-01 对 **I1.10a** 的阻塞，与本迭代开工无关（需求 1471 行、round3 §4 E④ PASS）。
2. 6 条规划层歧义全部由裁-1 ~ 裁-7 登记在 `decisions.md`（第一节 7 行 + 口误更正），需求侧已按裁决落地；H-01 的 `--instance` 边界与第 5 条的枚举口径属「建议规划方给一句口径」，round3 §7/§8 均标注不阻断，且 decisions.md 第九节已明确转 S1/S3 承接阶段。
3. `review-round3.md` §0 总判 **PASS / 阻断 0 / 建议 4**、§5.1 G-01~G-05「已修 5 / 未修 0」、§5.2 F-01~F-22「保持已修 22 / 回归变红 0」、§8「不需要第 4 轮」，且明确「H-01~H-04 不构成实现方不可两全 / 验收不可执行 / 开工阻塞」。
4. 执行模板 §1.1 的 13 条 DoR 全绿（见 §8）；S0 Gate（§1.0.5 / §0.2）满足：最后一轮 PASS、F 项清零、覆盖表 29/29「覆盖」、反向扫描无夹带、`requirement-understanding.md` 产出即本文件。
5. 本迭代为「B · 零 DSH」（`docs/index.md:684` 定义、:694 预判 B；需求 §3.3 第 3/8 条确认验收面全部是静态资产与终端输出），无「必须本机真实宿主 + 凭据」这类开工前置。

---

## §6 Given 可构造性核查（逐条 65 条）

### §6.1 统一口径（先定义，避免 65 行重复）

- **项目根**：`R<AC>` = `%TEMP%/maestro-acc-p6/<AC 编号>/`（全新独立目录，开始前**不存在** `.orch`；需求 §3.1:468、§3.3 第 2 条）。绝不放仓库内（红线 21 / D-10）。
- **`orch`**：一律等价 `node "$REPO/bin/orch.js"`；`$REPO` = 仓库根，`$ROOT` = 该 AC 的项目根（需求 §3.1:468、§3.3 第 1 条）。
- **`NODE_ENV=test`**：按需求 §3.3 第 3/4 条的权威结论，**仅 AC-49 / AC-50 涉及实例/夹具、必须注入 `NODE_ENV=test`**（仓库内 `test/fixtures/mock-acp-agent.js` + `code-loop-driver.mjs` / `task-loop-driver.mjs`）；其余 **63 条为命令面 / 校验器面 / 架构面**，只读静态资产与终端输出，**不需要宿主、不需要 `NODE_ENV=test`**。任务书「`NODE_ENV=test` 必注入」的口径对应的是「涉及实例/夹具的 AC」，本迭代只有 AC-49/50 属于此类；本纪要按需求 §3.3 如实标注，不把该环境变量误套到全部 65 条。
- **接缝**：`命` = `orch role|skill|workflow` 三族命令；`校` = `orch role validate` / `orch workflow validate`；`具` = `test/fixtures/{code-loop-driver,task-loop-driver}.mjs` + `mock-acp-agent.js` + `NODE_ENV=test`；`架` = `test/fixtures/purity-check.mjs` + `node -e`；`基` = `git show 0cd113b:assets/...` / `git worktree add --detach 0cd113b` / `docs/iterations/iteration-5/evidence/` + `sha256sum` / `diff`。
- **判定锚点**：需求每条 AC 都给出 `机检：` / `夹具：` / `架构检查：` 开头的**完整命令**（round3 §6 X6 实跑「机检：65 / 架构检查：6 / 夹具：2」、缺件 0）；本表「锚点可执行」= 需求给出的命令形式完整、确定、可复核，且所依赖的接缝在实现完成后存在。**不判任何 AC 通过与否**。
- **需求阶段的观测边界（如实登记，不替评审下结论）**：当前仓库不存在 `src/registry/{workflows,workflow-schema,workflow-plan,contracts,asset-write}.js`、`src/cli/{skills,workflows}.js` 与 `test/wp12/**`（实跑 `ls` 确认），因此 `orch workflow validate/dry-run --format json` 的 `layers/branches/mappings/policies`、`errors[].code` 等机检命令**在需求阶段跑不出真实输出**，`round3.md` §6 末「观测不到的路径」已如实登记。这属于「实现完成后取证」，**不构成 Given 不可构造或锚点不可执行**。

### §6.2 逐条核查表（65 行）

| AC | 前置怎么造 | 用哪个接缝 | 真实宿主 | 锚点可执行 | 备注 |
|---|---|---|---|---|---|
| AC-01 | 空 `R<AC>`，直接跑 `role create lead-dev --name … --skills code-change,test-run` | 命 + `role list --format json` | 否 | 是（机检） | 三行输出/`counts.project===1`/文件首行 `schema: role/v1` 均可复核 |
| AC-02 | 空 `R<AC>`，三条都**不带** `--from` | 命（用法块） | 否 | 是（机检） | 三次退 2 + `test -e "$ROOT/.orch"` 为假；顺序依赖 D-6 两档必填 |
| AC-03 | 先由 AC-01 同一命令建出 `lead-dev`，再不带/带 `--force` | 命 + `grep -c` | 否 | 是（机检） | 「先建后改」类：两段各自稳定；`--force` 不跳过校验（C-05） |
| AC-04 | 空 `R<AC>`，`role create lead-dev --from developer --skills test-run`（四项全省） | 命 + `role show --format json` | 否 | 是（机检） | **先建后改**起点；`derived_from`/默认名 `开发（派生）`/继承 5 字段、JSON 仍 10 键；:501 `机操：` 笔误（H-04），:500 有合法机检 |
| AC-05 | 承接 AC-04 的 `lead-dev`，`role edit --set skills=test-run,code-review` 后跑 show/list/validate | 命 + 机检 | 否 | 是（机检） | **先建后改**；三处可见变化 + `counts.invalid===0`；依赖 AC-04 前置 |
| AC-06 | 空 `R<AC>` 预置 `a.yaml`(`derived_from:b`) 与 `b.yaml`(`derived_from:a`)，再把 b 改 ghost | 校（`role validate --format json`） | 否 | 是（机检） | 环上每文件一条、`errors[0].file` 按文件名字典序；C-08 ⑩ |
| AC-07 | 项目根 A（含 AC-04 的 lead-dev）+ 空项目根 B；`export --out` → 拷文件 → B 里 `import` | 命 + `diff` 逐字节 | 否 | 是（机检） | 两个独立项目根；导出文件带 `derived_from: developer` |
| AC-08 | 空 `R<AC>` 预置 `ghost.yaml`(悬空技能) 与 `lead-dev.yaml`，且已有 `.orch/roles/lead-dev.yaml` | 命 + 文件清单前后比对 | 否 | 是（机检） | `.orch/roles` 清单两次执行前后逐字相同；`ghost.yaml` 不落盘 |
| AC-09 | 承接 AC-01 的 `lead-dev`；再对内置 `developer` 发 edit | 命 + `sha256sum assets/roles/developer.yaml` | 否 | 是（机检） | 混合路径；「改内置被拒」且内置 sha256 前后相同 |
| AC-10 | 承接 AC-04 的 lead-dev + 一份与内置 developer 逐字段相同的项目覆盖文件 | 命（`role diff`）+ `--format json` | 否 | 是（机检） | 角色 diff 口径（忽略 id、name 全比，BR-11）；`changes` 长度 3 |
| AC-11 | 空 `R<AC>` 预置 5 份坏角色 + `use-c.yaml` 工作流 | 校 + JSON 计数 | 否 | 是（机检） | `counts.assets===31 / roles 16 / skills 10 / invalid 5`（与 `loadRegistry` 口径一致，M-3 不改） |
| AC-12 | 空 `R<AC>` 预置 scout/scribe + `solo` 工作流（边带 `map`） | 校 + JSON | 否 | 是（机检） | 字段级口径 F-05；两处 `detail` 都不含 `notes` |
| AC-13 | 空 `R<AC>` 预置 r1/r2/r3 三份工具-副作用错配角色 | 校 + JSON | 否 | 是（机检） | 三条固定明细句；按文件名排序 |
| AC-14 | 空 `R<AC>` 预置 `w1.yaml`(ghost) 与 `w2.yaml`(自唤醒) | 校 + JSON | 否 | 是（机检） | `ROLE_WAKE_UNKNOWN` / `ROLE_WAKE_SELF` |
| AC-15 | 空 `R<AC>`（无任何项目资产、无工作流） | 校 + 基（I1.5 evidence 逐字 diff） | 否 | 是（机检） | 26 内置资产一行输出 + counts 6 键；§3.3 第 6 条「执行前后字节对比」类 |
| AC-16 | 空 `R<AC>`，跑 `skill list` | 命 + JSON | 否 | 是（机检） | 总行数 11；counts 4 键、技能对象 7 键（A-14） |
| AC-17 | 空 `R<AC>`，跑 `skill show code-change` | 命 + JSON | 否 | 是（机检） | `lines[5]==='  正文：'`、`lines[6]==='  ### 工作方法'` |
| AC-18 | 空 `R<AC>`，`skill create quote …` 后 `skill validate` | 命 + JSON | 否 | 是（机检） | 默认正文骨架（A-7）；`counts.invalid===0`、首行 11 个 |
| AC-19 | 空 `R<AC>` 预置 `half/SKILL.md`(缺 summary) 与 `empty/SKILL.md`(空正文) | 校 + JSON | 否 | 是（机检） | `codes` 两元素；`counts.assets===12` |
| AC-20 | 项目根 A + 空项目根 B，`skill export --out` → 拷 → `import` | 命 + `diff` | 否 | 是（机检） | 两个独立项目根；`内置 9 · 项目 1` |
| AC-21 | 空 `R<AC>`，跑 `workflow list` | 命 + JSON | 否 | 是（机检） | 三内置图（GRAPHS 恰 3 键）；`file===null` |
| AC-22 | 空 `R<AC>`，跑 `workflow show code-loop` | 命 + JSON | 否 | 是（机检） | 节点 11 键 `nodeType`；`edges[1].kind==='backflow'` |
| AC-23 | 空 `R<AC>` 预置 `.orch/workflows/code-loop.yaml`（3 节点 4 边） | 命 + JSON | 否 | 是（机检） | 同名整体覆盖（BR-18）；`source==='project'` |
| AC-24 | 空 `R<AC>` 预置 A-1/A-13 的 `doc-fanout`（四类 node_type 齐备） | 校（`workflow validate doc-fanout`）+ JSON | 否 | 是（机检） | **规划验收句**；T-005 escalate 无出边不算不可达（BR-35）；`counts.assets===4` |
| AC-25 | 空 `R<AC>` 预置 `bad-type`/`no-title`/`no-role` 三份工作流 | 校 + JSON | 否 | 是（机检） | 三类原因码；`errors[0].file` 字典序 = bad-type.yaml |
| AC-26 | 空 `R<AC>` 预置 `sub-ghost`/`sub-self` | 校 + JSON | 否 | 是（机检） | `WORKFLOW_SUB_UNKNOWN` / `WORKFLOW_SUB_CYCLE` |
| AC-27 | 空 `R<AC>` 预置 A-13 `doc-fanout`（T-002/T-003 同组 draft） | 校 + `dry-run` + JSON | 否 | 是（机检） | 并行组占一行 `汇合：all`（F-19）；`layers[1].parallel===true` |
| AC-28 | 承接 A-13 `doc-fanout`（T-004 两出边 + T-006 失败边） | `dry-run` + JSON | 否 | 是（机检） | `branches` 3 元素，when 集合 `{human_approved,human_rejected,failed}` |
| AC-29 | 空 `R<AC>` 预置 `timeout-ok` 与 `timeout-bad` | 校 + `dry-run` + JSON | 否 | 是（机检） | 混合：合法 600/2、越界 0/9；`policies` 含 `{nodeId,timeout:600,retry:2}` |
| AC-30 | 承接 A-13 `doc-fanout` | `dry-run` + JSON | 否 | 是（机检） | `mappings` 2 元素恰 3 键、首条 `from` 逐字 |
| AC-31 | 把 A-13 的 `T-002.inputs` 改成 `[brief, outline]` 且无映射；补映射后再验 | 校 + JSON | 否 | 是（机检） | **规划验收句**；`WORKFLOW_MAPPING_INCOMPLETE` → 补映射 `counts.invalid===0` |
| AC-32 | A-13 追加孤立 `T-007`(role/tester) | 校 + JSON | 否 | 是（机检） | `WORKFLOW_UNREACHABLE` 明细含 T-007；注意不引入 T-005 的同类错误（BR-35 已修 F-01） |
| AC-33 | A-13 追加 `T-003→T-002` backflow（`when: failed`，源是 role）；T-002 补 `max_rounds:2` 后再验 | 校 + JSON | 否 | 是（机检） | F-06 已改回边源为 role；只加边不改 scope，不与 AC-34 夹具互污；⑪ 控制流边豁免 |
| AC-34 | A-13 把 T-002/T-003 的 scope 都改 `draft`；再把并行组改到只剩 1 节点 | 校 + JSON | 否 | 是（机检） | `WORKFLOW_SCOPE_OVERLAP` → `WORKFLOW_SCOPE_INVALID` |
| AC-35 | A-13 把 `T-001→T-002` 映射 `from` 改成 `T-003.research.notes` | 校 + JSON | 否 | 是（机检） | `WORKFLOW_VAR_UNKNOWN` 明细含该引用 |
| AC-36 | A-13 追加 `T-005→T-006` forward；再去掉 T-004 两出边的 `when` | 校 + JSON | 否 | 是（机检） | 两次都 `WORKFLOW_TRANSITION_ILLEGAL`，明细分别含 T-005 / 人工条件 |
| AC-37 | 空 `R<AC>` 预置 `wake.yaml`（writer `[editor]` → reviewer）；把下游换 editor 后再验 | 校 + JSON | 否 | 是（机检） | `WORKFLOW_WAKE_DENIED` → 换 editor 通过；D-3 ⑬ 只查 forward |
| AC-38 | 空 `R<AC>`（只有内置三图） | 校（文本 + JSON） | 否 | 是（机检） | 文本一行、JSON 顶层 2 键 / counts 4 键 / errors 6 键 |
| AC-39 | `workflow create fork --name 分叉版 --from code-loop` 后改一个节点标题；另建一字不改的 `copy` | 命（`workflow diff`）+ JSON | 否 | 是（机检） | 工作流 diff 口径（忽略 schema/id/name，BR-37）；`无差异` 可达 |
| AC-40 | 空 `R<AC>` `workflow create fork --from code-loop`；追加段预置已存在的 `fork.yaml`（合法→不合法）三次 `--force` | 命 + `grep -c` + `sha256sum` | 否 | 是（机检） | **`--force` 重点**：第三段把 fork.yaml 换成不合法内容、即使 `--force` 仍被拒且 sha256 不变（BR-08/C-05）；G-03 已修、AC 内三段用例齐全 |
| AC-41 | 空 `R<AC>` 预置 A-13 `doc-fanout`，先记录 `.orch` 目录清单与 sha256 清单 | `dry-run` + `find … sha256sum` 前后 + 两次 stdout 比对 | 否 | 是（机检） | **规划验收句**；`test -e "$ROOT/.orch/instances"` / `core.json` 为假；C-12 纯函数 |
| AC-42 | A-13 把 T-001 的 `role` 改成 `ghost-role` | `dry-run` + stdout 不含「编排计划」 | 否 | 是（机检） | `预演被拒：…（WORKFLOW_ROLE_UNKNOWN）` + 提示 |
| AC-43 | 空 `R<AC>`，跑 `orch role bogus` | 命 + `USAGE_LINES.length`/`slice(0,8)` | 否 | 是（机检） | **逐字红线**：25 行、前 8 行与 I1.5 逐字、整块 26 行；D-7a `:356` 守卫 |
| AC-44 | 空 `R<AC>`，三族 × 四类共 12 次用法错误 | 命 + `grep -c '（'` | 否 | 是（机检） | 12 次退 2、原因文案各不同、用法块恒 25 行；D-6 白名单检查放解析之后 |
| AC-45 | 空 `R<AC>`，依次跑 10 条只读命令 | 命 + `test -e "$ROOT/.orch"` + `assets` sha256 | 否 | 是（机检） | §3.3 第 6 条字节对比类；`workflow diff code-loop` 对内置自比无差异 |
| AC-46 | 空 `R<AC>`，先记录 `assets/**` sha256，再跑 9 条写命令 | 命 + `git status --porcelain assets` + sha256 | 否 | 是（机检） | §3.3 第 6 条字节对比类；`test -e "$ROOT/.orch/core.json"` 为假 |
| AC-47 | 空 `R<AC>` 预置合法项目工作流 `doc-fanout`，跑 `orch run --template doc-fanout` | 命（`run`）+ 文件存在性 | 否 | 是（机检） | `未知模板：doc-fanout` 退 1；D-8 的 `test/wp6/main.test.js:247` 不改 |
| AC-48 | 空 `R<AC>`，跑十条命令（原六条 + researcher/writer 文本与 JSON 四条） | 命 + 基（I1.5 evidence 逐字 diff + `git show 0cd113b:assets/...`） | 否 | 是（机检） | **逐字红线 + 资产对齐重点**：机检(859) 六条 evidence diff；机检(860) 资产比对「恰好两处 `wake_allow`」；**H-02/H-03 提示**：追加四条的新值/10 键由 Then 文字断言承担、evidence 无内置 researcher/writer 纯 show 基线，S3 需补 `grep` 逐字命令（见 §9 风险 9） |
| AC-49 | `%TEMP%/maestro-acc-p6/AC-49/` + `mock-acp-agent.js`，注入 `NODE_ENV=test`；`git worktree add --detach 0cd113b` 挂基线树 | 具（code-loop-driver / task-loop-driver / `bin/orch.js run` 直跑）+ 基（两条 `sed` 归一化 + `diff`） | 否 | 是（夹具 + 机检） | **三条主链重点**：`git -c core.autocrlf=false` 避免 CRLF；去「已运行 Ns」与 `HH:mm:ss` 后 diff 为空；`.mock/prompts/*.json` 的 task 文本与基线一致；驱动自述行比对前剔除（D-10） |
| AC-50 | 实现完成后的源码树 | `node --test --test-concurrency=4 "test/**/*.test.js"` | 否 | 是（机检） | **全量测试重点**：下限断言 `fail===0 && pass===tests && tests>=611`、不写死条数；既有断言修改仅限 D-7a 两行；实跑当前 611/611 |
| AC-51 | 实现完成后的源码树 | 架（4 条完整命令，AC 内 885~902 逐字副本 = D-9） | 否 | 是（架构检查） | **四条架构检查重点**：`$COMMON` 31 词 / `$NOCOORD` 30 词 / 三条 `purity-check.mjs` / `node -e` 零 CJK；D-9 为唯一权威；当前 `purity-check.mjs` 实存，第 2/3 条扫的新增实现文件实现期才有 |
| AC-52 | 实现完成后的 `package.json` | 架（`node -e` 读 dependencies） | 否 | 是（架构检查） | 实跑当前 `0`；AC-51 与 AC-52 是 §3.3 第 7 条「只用仓库内工具」类 |
| AC-53 | 空 `R<AC>` 预置 c/p/d 三份坏角色 + `use-c.yaml` | 校（文本 + JSON） | 否 | 是（机检） | 四条错误、`p.yaml` 多类各一行、C-08 顺序固定；命令面 AC 不注入 `NODE_ENV=test`（需求 915 行明写） |
| AC-54 | 空 `R<AC>`，三条非法取值命令 | 命 + `test -e "$ROOT/.orch"` + 用法块行数 | 否 | 是（机检） | 25 行用法块 + 一行原因 = 26 行；`role bogus` 恒 25 行 |
| AC-55 | 空 `R<AC>` 预置 `not-role.yaml` 与 `wrong-schema.yaml` | 命 + 文件存在性 + `counts.total===16` | 否 | 是（机检） | 两次一行 `ROLE_SCHEMA_MISSING`、不落盘；`import` 只装单文件（裁-3） |
| AC-56 | 空 `R<AC>` 先 `role create` 建 lead-dev，再三条 edit | 命 + `grep -c` | 否 | 是（机检） | 前两次退 2 文件不变；第三次成功且规范化重写（注释不保留） |
| AC-57 | 空 `R<AC>` 预置 `my-role.yaml` 与 `my-wf.yaml`（均无同名内置基线） | 命（`edit` / `role diff` / `workflow diff` / `--against`）+ JSON | 否 | 是（机检） | 角色 diff 口径（忽略 id、name 全比）与工作流 diff 口径不可混用（BR-11 vs BR-37）；净增 `name` 正向断言（v6 修补 1） |
| AC-58 | 空 `R<AC>` 预置 `developer.yaml` 与 `.orch/skills/quote/SKILL.md`，先记录 `assets/**` sha256 | 命 + `git status --porcelain assets` + sha256 | 否 | 是（机检） | 四次执行后 `assets/**` 一字节未变；`--force` 也不豁免内置（C-06） |
| AC-59 | 空 `R<AC>` 预置 `body.md` 与 `empty.md` | 命 + `grep -c` + `test -e` | 否 | 是（机检） | 四类口径：成功 / 坏组退 2 / 缺摘要退 2 / 空正文退 1；`--body-file` 生效 |
| AC-60 | 空 `R<AC>` 预置 `task-var`/`backflow-target`/`wake-empty`/`retest-ok` 四条工作流 | 校（4 次 `workflow validate`）+ JSON | 否 | 是（机检） | `counts.invalid` 依次 0/1/1/0；`task.<字段>` 恒合法、⑪ 控制流边豁免、⑬ 空白名单有 forward 即被拒 |
| AC-61 | 空 `R<AC>`（只有内置三图），**D-7b 对齐后**；临时把 `assets/roles/writer.yaml` 改回 `[editor]`，验完立即还原 | 校（文本 + JSON）+ 基（`内置 ` 前缀排序） | 否 | 是（机检） | **内置工作流 + 资产改坏再还原重点**：`counts.invalid===0 / assets 3 / builtin 3` → 改回后 `invalid===1`、`WORKFLOW_WAKE_DENIED`、`errors[0].file` 以 `内置 ` 开头；**该临时改动须在验收用例内 `finally` 还原**，且顺序在 D-7b 实现期对齐之后（见 §9 风险 4） |
| AC-62 | 空 `R<AC>` 预置 `bad-type`/`esc-no-title`/`sub-no-wf`/`sub-ghost`/`sub-a`/`sub-b`（跨工作流环） | 校（文本 + JSON） | 否 | 是（机检） | 四类原因码各至少一行；`errors[0].file`=bad-type.yaml、明细含四个合法取值；C-09 ①~⑬ 顺序固定 |
| AC-63 | 空 `R<AC>` 预置 A-1/A-13 `doc-fanout` | 校 + `dry-run` + `workflow show code-loop` + JSON | 否 | 是（机检） | **11 项原语重点**：预演首行逐字、并行组 `汇合：all`、三分支、超时重试、人工/子工作流/升级/终止逐项可见；`workflow show code-loop` 的回流轮次上限 2、`edges[1].kind==='backflow'`、`nodes` 存在 `maxRounds===2`；`layers/branches/mappings/policies` 四段齐全 |
| AC-64 | 空 `R<AC>` 预置 `human-end`/`escalate-end`/`no-end` 三条工作流 | 校（3 次）+ JSON | 否 | 是（机检） | human/escalate 天然终态合法、普通 role 无终点报 `WORKFLOW_UNREACHABLE`；`T-H.nodeType==='human'` |
| AC-65 | 空 `R<AC>` 预置 `bad-type.yaml` 与 `wake.yaml`，内置三图按 D-7b 对齐后合法 | 校（`--format json` 连续两次 + 文本）+ `sha256sum` | 否 | 是（机检） | **错误排序重点**：两次 JSON 经 `sha256sum` 相同；`errors.map(file:code)` 两条按「文件名字典序 + 同文件内 C-09 ①~⑬」固定；`counts.assets===5 / invalid===2`；BR-40 |

### §6.3 本迭代是否有真实宿主面 AC —— 判定

**判定：无。65/65 均不涉及真实宿主。**

依据（自己读 + 实跑）：
1. 需求 §3.3 第 3 条（1032 行）明写「除第 4~7 条另述的特例外，**全部不需要宿主、不需要 `NODE_ENV=test`**，只读写项目根下的资产文件与终端输出」；第 8 条（1040 行）「本迭代的验收面全部是**静态资产与终端输出**」，且「不存在『历史会话恰好空闲』这类不可构造的前置状态」。
2. 第 4 条特例只有 AC-49 / AC-50，用的是**仓库内 `test/fixtures/mock-acp-agent.js` + `*-driver.mjs`**（mock ACP agent，非真实 DSH / 真实模型 / 凭据），项目根放 `%TEMP%`、绝不放仓库内。
3. `docs/index.md:684` 定义「**B · 零 DSH** = 全部 AC 由机检 / 仓库内 `mock-acp-agent.js` / 单测覆盖，验收不接真实宿主」；`:694` 把 I1.6 预判为 B 并注明「需求定稿时须把『不引入真实宿主面』写进 §3.3」—— v7 §3.3 已写入，**预判在定稿后确认成立**。
4. I1.5 同形态（`report.md:7`「本迭代无真实宿主面，已注明理由」、`docs/index.md:693` 判 B）已作为先例收口。

因此本表「真实宿主」列 **65 行全为「否」**；被标为「不可构造 / 锚点不可执行 / 需真实宿主」的 AC **清单：无**。

### §6.4 给 S1 / S3 的风险提示（怀疑点，不替评审下结论）

以下均**不判为「不可构造 / 锚点不可执行」**，仅作为实现与取证时的注意项（需求阶段如实登记）：

1. **AC-48**（H-02 / H-03）：机检(859) 只覆盖原六条 evidence 逐字 diff；追加四条里的「两处新值 / 10 键 / 其余行逐字」是 Then 文字声明，未落成可复制命令；`docs/iterations/iteration-5/evidence/` 无内置 researcher/writer 的**纯 show** 基线（`AC-03.show.txt` 是项目版 researcher、`AC-28.show-builtin.txt` 是带 `--instance` 的 writer）；机检(860) 只 `diff` 打印差异、未给「恰好两处」机判定。→ S3 写 `ac48.mjs` 时补 `grep -c` 逐字比对与差异行数断言（decisions.md H-02）。
2. **AC-48 / BR-32**（H-01）：`--instance` 文本形态的「可唤醒」行未被两行例外点名（详见 §3.4 三）。→ S1 拆分前给一句口径。
3. **AC-49**：三类主链需 `git worktree add --detach 0cd113b` 挂基线树 + `git -c core.autocrlf=false`，并按 AC-49 给的两条 `sed` 归一化；驱动自述行 `{"ok":true,"root":…}` 须在比对前剔除（D-10）。基线 worktree 未挂载则该 AC 的「逐字」锚点无从复核。
4. **AC-61**：要**临时改仓库文件** `assets/roles/writer.yaml` 再还原；须与 D-7b 的「实现期对齐」区分顺序，并在用例 `finally` 里保证还原，否则污染后续 AC 与 `git status`。
5. **AC-51**：四条命令在 AC-51:885-902 已逐字复制（D-9 唯一权威），但第 2 条扫 `src/registry`、第 3 条扫 `src/cli/skills.js`/`workflows.js` 这些文件**实现期才存在**；需求阶段无法实跑真实输出（round3 §6「观测不到的路径」）。当前 `test/fixtures/purity-check.mjs` 实存且 `DEFAULT_FORBID` 只有 4 词，必须显式 `--forbid` 传全表。
6. **AC-24/27/28/29/30/31/32/33/34/35/36/41/42/63** 等涉及 `workflow validate/dry-run --format json` 的 `layers/branches/mappings/policies`、`errors[].code`：依赖 I1.6 新增实现文件与 `test/wp12/**`（当前不存在），取证在实现完成后进行；判定顺序已由 C-08/C-09、BR-40 写死，不依赖遍历巧合。
7. **AC-04**：`:501` 的 `机操：` 标签笔误（H-04），按「机检（补充）」理解；另有 :500 合法 `机检：`，不影响 C④。
8. **AC-40 / AC-58**：`--force` 三段用例与「内置只读」都要求「文件 sha256 / `assets/**` 前后不变」，取证须先求 sha256 清单（§3.3 第 6 条）。
9. **AC-50**：必须用下限断言（611），不写死条数；既有断言修改仅限 D-7a 两行；套件并发抖动按 `--test-concurrency=4`（执行模板 §5 第 22 条）。

---

## §7 与 I1.5 的契约差异与回归红线

### §7.1 本迭代新增 / 改变的契约（逐条）

| # | 契约 | 需求落点 | 相对 I1.5 的变化 |
|---|---|---|---|
| 1 | **17 条新命令**：role `create/edit/export/import/diff`（5）、skill `list/show/create/validate/export/import`（6）、workflow `list/show/create/validate/diff/dry-run`（6） | §1.3 项 10、§1.2 指标 7、M-1、A-12、D-6、B-07 | I1.5 只有 `role list/show/validate`（`src/cli/main.js:57` COMMANDS 仅 5 个、`ROLE_SUBS`:71 仅 3 个）；扩展到 8 个 role 子命令 + 两族新命令 = 20 条子命令中的 17 条新增 |
| 2 | **`workflow/v1` 资产**：`.orch/workflows/<id>.yaml`（节点 `node_type`、边 `kind/when/join/map`、`schema: workflow/v1`）；三内建图以只读「内置工作流」投影 | §1.3 项 5、A-1、C-10、R-1 | I1.5 三张图只是 `src/templates/index.js` 里的硬编码对象（`GRAPHS` 恰 3 键，:292 实读）；本迭代不新增内建图、不改内建图任一字段（R-1，避免打破 `test/templates/task-loop.test.js:298-300` 与三条主链逐字） |
| 3 | **四条校验器链**（附录 D-1 / §2.5 / §2.6 / §2.9）：① `role validate` 扩到 5 项（schema 完整性/技能引用/契约连通/权限闭环/派生链无循环，C-08 ①~⑪）② `skill validate`（沿用 I1.5 既有 4 原因码与版式、计数只算技能，BR-16）③ `workflow validate` 6 项（C-09 ①~⑬、D-3）④ `contracts.js` 的 `checkRoleContracts` 跨工作流看角色契约连通（BR-13，且契约连通需读工作流但**不计入** `role validate` 资产计数，R-4） | §2.5/§2.6/§2.9、D-1/D-3/D-4 | I1.5 的 `role validate` 只回答「字段齐全 / 技能存在」两类（round3 §1 表 #4/#5）；新增三类结论复用同一条命令、同一版式与计数口径（BR-12） |
| 4 | **`node_type` 四类**（`role`/`human`/`escalate`/`subworkflow`；JSON 键 `nodeType`），每类必填字段与合法出入边（裁-1、BR-36） | §1.3 项 6、§2.7、M-7、B.1、A-1、D-3 ⑤ | I1.5 节点模型只有 `roleId` 一种身份（M-7）；内建图投影节点一律 `role`，`src/templates/index.js` 与 `state.json` 结构不改 |
| 5 | **两处内置资产对齐**（D-7b）：`researcher.wake_allow: [] → [writer]`、`writer.wake_allow: [editor] → [editor, reviewer]` | §1.2 指标 8、BR-32、AC-48、AC-61、D-7b、裁-2/裁-6 | I1.5 的 26 内置资产「一个字节不改」（I1.5 M-7 声明）；本迭代**唯一**允许改的 `assets/**` 是这两行取值，且是开发期改仓库文件、非 CLI 运行时行为 |
| 6 | **用法块 8 → 25 行**（前 8 行逐字不变，追加 17 条子命令行） | M-2、R-8、A-12、AC-43、D-7a | `src/cli/labels.js:155-164` 现为 8 行；授权改 `test/wp11/cli-role.test.js:354`(9→26) 与 `:357`(8→25)，`:356` 守卫不动 |
| 7 | **`test/wp12/` 八个测试文件** + 全量测试下限从 611 起算 | D-10、AC-50、NFR-06 | I1.5 新增 `test/wp11/**`（8 文件）且「不修改任何既有断言」；本迭代新增 `test/wp12/**`（8 文件），且既有断言**只允许** D-7a 点名的两行改动 |

> 另：新增 `derived_from` 可选键（M-4）、7 条角色新原因码 + 19 条工作流原因码（M-6 / A-15）、CLI 标志白名单扩展（M-1 / D-6）、`workflow validate` 独立计数集合（C-11）—— 均属上述契约的内部支撑，不改 I1.5 既有输出。

### §7.2 回归红线清单（逐条，含判定方式）

| 红线 | 判定方式 / 锚点 | 需求依据 |
|---|---|---|
| `single` / `code-loop` / `task-loop` 三条主链**逐字** | AC-49：`NODE_ENV=test` + 夹具 + `git worktree add --detach 0cd113b` 基线树，按两条 `sed`（去「已运行 Ns」/`HH:mm:ss`）归一化后 `diff` 为空；`.mock/prompts/*.json` 的 task 文本一致。I1.5 report.md:24 记 AC-19 27/27 逐字 | BR-33、D-8、AC-49 |
| `role list` / `show` / `validate` **文本与 JSON**（除 D-7b 两行「可唤醒」例外） | AC-48：十条命令（原六条 + researcher/writer 文本与 JSON 四条）与 I1.5 `evidence/` 逐字 diff；`test/wp11/cli-role.test.js` 全绿（:285-300 / 499 / 523 / 530 / 577-590 不改） | BR-32、D-8、裁-6/裁-7、AC-15/48 |
| **用法块前 8 行逐字** | AC-43：`USAGE_LINES.length===25` 且 `slice(0,8)` 与 I1.5 基线逐字相同；`:356` `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES])` 是守卫、不得改动 | BR-29、M-2、D-7a、AC-43 |
| **既有测试条数只增不减（基线 611）** | AC-50：`node --test --test-concurrency=4 "test/**/*.test.js"` → `fail===0 && pass===tests && tests>=611`（下限断言、不写死条数）；既有断言修改仅限 D-7 点名的两行。实跑当前 611/611、fail 0 | BR-33/34、NFR-06、D-10、I1.5 report.md:23/297/320 |
| **零依赖** | AC-52：`node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"` 输出 `0`；实跑通过 | BR-34、红线 7 |
| **架构纯净禁词表** | AC-51：四条完整命令（D-9 逐字副本）全退 0：`$COMMON` 31 词扫 `src/core,src/daemon`、`$NOCOORD` 30 词扫 `src/registry`、31 词逐文件扫三族 CLI、`node -e` 零 CJK；`coordinator` 在 `src/registry/**` 仅允许出现在 `role-schema.js` 的 `GROUPS` 一行 | BR-31、C-14、D-9、AC-51 |
| **`src/core` / `src/daemon` 不出现模板名与角色名字面量** | 同上第 1 条（31 词含 `task-loop`/`code-loop`/`researcher`/`writer`/`reviewer`/`developer`/`tester`/`coordinator` 等，英文注释也算）；`src/core/graph.js:4-6` 实读为纯函数、注释明写「never spells a template or role name」；C-14 另禁 `src/core`/`src/daemon` import 任何注册表模块 | BR-31、C-14、D-9、红线 6 |

补充红线：`orch run` 预检与 `未知模板` 文案（AC-47 + `test/wp6/main.test.js:247` 不改，D-8:1654）、`loadRegistry` 计数与报错顺序（`test/wp11/registry.test.js` 不改且全绿，D-8:1655）、`assets/**` sha256 前后一致（AC-45/46/58）。

### §7.3 为什么 `toRoleJson()` 不含 `wakeAllow` → 两类 JSON 不受两处资产改动影响（给源码行号）

| 源码位置（实读） | 事实 |
|---|---|
| `src/cli/roles.js:91-104` | `function toRoleJson(role)` 返回 **10 键**：`id` / `name` / `group` / `groupLabel` / `artifactType` / `sideEffect` / `skills` / `maxConcurrentSessions` / `source` / `file`；**不含 `wake` / `wakeAllow`** |
| `src/cli/roles.js:210` | `listRoles` 的 JSON 角色列表 = `rows.map(toRoleJson)`；`cli-role.test.js:285-300` 断言顶层 `{counts, groups, roles}` 3 键、`counts` 4 键、每个角色对象恰上面 10 键 |
| `src/cli/roles.js:266` | `showRole` 里 `const roleJson = toRoleJson(role);` |
| `src/cli/roles.js:296-312` | `format === 'json'` 分支的 payload = `{ role: roleJson, instance: null, roleInstance: view }`（3 键）；`role` 对象就是 10 键的 `roleJson`，**没有 `wakeAllow` 字段** |
| `src/cli/roles.js:269-276` | 文本分支在 JSON 判断**之前**用 `render.renderRoleShow({ ..., wake: role.wakeAllow, ... })` 生成 `baseLines` |
| `src/cli/roles.js:315` | `for (const line of baseLines) out(line)` —— 文本「可唤醒」行来自 `role.wakeAllow`（**会**随 D-7b 变化），随后才追加 `instanceLine` |
| `src/cli/render.js:1024-1040`（`:1038`）、`src/cli/labels.js:92` | `renderRoleShow` 用 `showWake: '  可唤醒：{wake}'` 模板，`join(wake)` 空数组 → `—` |

**推论**：D-7b 只改 `assets/roles/{researcher,writer}.yaml` 的 `wake_allow` 取值 → 只影响 `role.wakeAllow` 这一输入 → 只影响 `showRole` 的**文本** `baseLines` 里那一行「可唤醒」（AC-48 逐字钉住 `  可唤醒：writer` / `  可唤醒：editor, reviewer`，是 I1.5 逐字红线的**唯一例外两行**）。`role list --format json` 与 `role show --format json` 走的是 `toRoleJson()` 的 10 键对象，**不读 `wakeAllow`**，故与 I1.5 基线逐字节相同、不受两处资产改动影响（BR-32、D-8 伞形说明、裁-6/裁-7、AC-48:858 明写不写 `['writer']`/`['editor','reviewer']` 之类源码里不存在的字段断言）。

> 遗留边界（H-01）：`--instance` 形态的文本「可唤醒」行同样取 `role.wakeAllow`，会随 D-7b 变化但未被两行例外点名 —— 见 §3.4（三），标为 S1 待裁决，不改 v7 正文。

---

## §8 DoR 13 条符合性（执行模板 §1.1，逐条给证据）

| # | DoR 判据 | 判定 | 证据（需求行号 / 评审记录 / 实跑命令） |
|---|---|---|---|
| 1 | 头部版本已定稿、无草稿字样、附录 C 末行与头部一致 | **PASS** | 头部 6 行 `> **版本**：v7 ｜ **状态**：**定稿**（S0 第 3 轮独立评审 PASS，2026-11-09；review-round3.md）`；实跑 `grep -n "^\| v[0-9] \|"` 得 `v1..v7` 七行齐、末行 `v7` = 头部 `v7`；`review-round3.md` §0/§8 PASS |
| 2 | AC 编号连续、每条有「场景类型 / 风险 / 引用」三件套、都有 `**Then**` | **PASS** | node 切块实跑：`AC 块数 65 / 缺号 无 / max 65`；65 条均含 `场景类型：`/`风险：`/`引用：`（无一为「无」）与 `**Then**`；`review-round3.md` §6 脚本「AC 缺件: 无」 |
| 3 | 每条 AC 至少有 `机检：` / `夹具：` / `架构检查：` 之一作为判定锚点 | **PASS** | 实跑 65 条均含完整锚点命令（`机检：` 65 / `架构检查：` 6 / `夹具：` 2，round3 §6 X6）；AC-49 夹具+机检、AC-51/52 架构检查、AC-04 另有 `机操：` 笔误但 :500 有合法 `机检：`（H-04 建议级、不判缺陷，见 §2.4） |
| 4 | BR 双向覆盖（每条 BR 被引用、每条引用真实存在） | **PASS** | 实跑脚本：`BR 定义 41 / 最大 41 / 定义未引用 无 / 引用未定义 无`；`review-round3.md` §6 第 11 项同结论；需求 §2.12:418-458 为定义区 |
| 5 | 附录 A 输出基线覆盖所有带文案的 AC；附录 D 实现约束能直接指导编码 | **PASS** | 附录 A-1~A-15（实跑 15 个小节标题）覆盖 role/skill/workflow 三族全部输出与 JSON 结构；附录 D-1~D-10（实跑 11 个小节标题，含 D-7a/D-7b 拆节）给出模块边界、YAML 子集、D-3 ①~⑬ 判定口径、D-6 白名单、D-9 四条完整命令、D-10 八文件清单；`review-round3.md` §4 E③ 判 PASS |
| 6 | 附录 D「授权断言修改清单」点名文件 + 行号 + 只改哪一段 | **PASS** | D-7a（1623~1632 行）点名 `test/wp11/cli-role.test.js:354`（9→26）与 `:357`（8→25），明写 `:356` `slice(0,8)` 守卫不得改动、其余 `test/**` 一字不改；实读 :349-358 与需求逐字一致；D-7b 另点名两处资产。**附注**：H-01 的 `--instance` 形态边界按 `decisions.md` 第九节转 S1 拆分确认（建议级，不改正文），不构成 DoR 缺陷 |
| 7 | 无阻塞实现的「假设」状态未决问题；前置条件里的命令与夹具真实存在 | **PASS** | B-01~B-08 逐条结论明确、全部「不阻塞 I1.6」（§5.1）；需求 §3.3 点名的 `test/fixtures/{code-loop-driver,task-loop-driver}.mjs`、`mock-acp-agent.js`、`purity-check.mjs` 实跑 `ls test/fixtures/` 全部存在；`node --test` 实跑 611/611；`review-round3.md` §4 E④ PASS |
| 8 | 范围外清单明确（哪些留给后续迭代） | **PASS** | §1.3 范围外 66~81 行 **14 项**逐项注明承接（I1.7 / I1.8 / I1.10a / I1.10b / I1.11 / I1.12 / I1.4 / 不做 / 未分配 B-01）；本纪要 §1.2 全表复述；`review-round3.md` §2 A③ / §1 反向扫描 B 判 PASS |
| 9 | 全量测试当前基线数字已记录（`<基线>`）且全绿 | **PASS** | 需求 §3.3 第 9 条 / AC-50 / NFR-06 / D-10 记 **611**；`docs/iterations/iteration-5/report.md:23/297/320` 记 611/611；**本纪要实跑** `node --test --test-concurrency=4 "test/**/*.test.js"` → `# tests 611 / # pass 611 / # fail 0` |
| 10 | 每条 AC 的 Given 可构造（禁止不可复现的空闲态；写明独立项目根 + `NODE_ENV=test` 接缝 + 具体步骤） | **PASS** | 需求 §3.1:468 定义 `%TEMP%/maestro-acc-p6/<AC 编号>/` 独立根、`orch`=`node "$REPO/bin/orch.js"`；§3.3 第 2/4/8 条明写「不存在历史会话恰好空闲这类不可构造状态」「验收面全部是静态资产与终端输出」，AC-49/50 用 `mock-acp-agent.js` + `NODE_ENV=test`；本纪要 §6 逐条 65 行给出前置/接缝/锚点。附注：模板第 10 条列举的 `test.escalate/test.handoff/test.delivery` 是实例类迭代的接缝名，本迭代为资产面、无实例 AC，按 §3.3 以三面分组 + AC-49/50 夹具接缝给出可构造步骤（round3 §3 D④ / §4 E④ 均判 PASS） |
| 11 | 同一编号跨 AC 语义不漂移（术语表单列） | **PASS** | 附录 B.1（1440~1465 行）22 行术语表定死 `node_type`(YAML)/`nodeType`(JSON)、`derived_from`、`fan-out/fan-in`、`parallel_scope` vs `scope`、`when` 闭集、`内置投影` 等易混口径；实跑 `node_type=38 / nodeType=10 / 裸 type: 0`（round3 §6 X4）；`INST-001`/`SES-001` 类复用本迭代无实例编号 |
| 12 | 架构检查必须给可执行命令（AC 里写出完整 `--forbid` 词表，不写「执行架构扫描」） | **PASS** | AC-51:885-902 已把 D-9 的 `$COMMON`（31 词）、`$NOCOORD`、三条 `purity-check.mjs` 命令与第 4 条 `node -e` 零 CJK 命令**逐字复制进 AC 内**，并注明「D-9 为唯一权威、不得改动」；AC-52 给完整 `node -e`；round3 §5.1 G-04「已修」、§6 X6「执行架构扫描 0 命中 / 见附录 实质命中 0」 |
| 13 | S0 评审闭环已 PASS | **PASS** | **review-round1.md（421 行，FAIL：阻断 6 / 建议 16）、review-round2.md（401 行，FAIL：阻断 1 / 建议 4）、review-round3.md（340 行，§0 **PASS、阻断 0**）三轮齐全**；最后一轮 §0 总判 PASS、§8「**不需要第 4 轮**」；**F 项清零**：round3 §5.2「保持已修 22 / 回归变红 0 / 新引入 0」、§5.1 G-01~G-05「已修 5 / 未修 0」；**规划逐句覆盖表 29/29「覆盖」**，符合性全「一致」，无 `部分 / 缺漏 / 越界 / 收窄`；**两张反向扫描无「夹带」**（§1 反向扫描 A：65 条 AC 无「无来源且未登记」项、§1.3.2 已登记 7 类非规划来源；反向扫描 B：零缺漏）；**头部版本 `v7` = 附录 C 末行 `v7` = v7**（实跑）；DoR 第 13 条满足 |

**结论：13/13 全 PASS，非 PASS 项：无（0 条 FAIL / 0 条「需 S1 补」就 DoR 判定而言）。**

> DoR 全绿 ≠ 无待办：`review-round3.md` 新增的 **H-01 ~ H-04 共 4 条建议级待办**，`decisions.md` 第九节明确「一律不改 v7 需求正文、转 S1 任务拆分 / S3 验收 / 实现期处理，不判为已修」（见本纪要 §5.3）。这些是 S1/S3 的承接动作，**不是 DoR 判定缺陷**：round3 §0 阻断 0、§8「不需要第 4 轮」，S0 Gate（执行模板 §1.0.5 / §0.2）已满足，S1 可开工。

---

## §9 给 S1 拆分 / S2 实现 / S3 验收的风险提示

### §9.1 风险与处置（14 条，逐条点名文件 / 函数 / AC 号）

| # | 风险 | 影响 | 建议处置（点名文件 / 函数 / AC） |
|---|---|---|---|
| 1 | `src/cli/main.js` 的 `parseArgs` 参数白名单扩表易放宽用法错误 | M-1 / D-6 / AC-44 / AC-54 / AC-56 | `COMMANDS`（现 `:57` 仅 5 个）增 `skill`/`workflow`；`VALUE_FLAGS`(`:59-69`)、`BOOLEAN_FLAGS`(`:58`)、新增 `REPEATABLE_FLAGS`(`--set`/`--unset`）与 `--force`；**每子命令独立标志白名单按 D-6 表落 18 行**，白名单检查放解析**之后**（`:96 parseArgs`），保证「未知参数：--nope」与「--<键> 不适用于 <族> <子命令>」是两句不同文案（I1.5 C-2/M-9 纪律反向成立）；`role create` 两档必填顺序固定 `--name→--group→--artifact-type→--side-effect`（AC-02 依赖此顺序），`--from` 时跳过四项（AC-04/BR-38） |
| 2 | `src/registry/index.js` 的 `loadRegistry` 被顺手改计数 | M-3 / R-4 / AC-11 / AC-15 / AC-53 | `loadRegistry`(`:289`) **不得改动**：其 counts(`:389-396`) = `roles.length + skills.length + invalid`、报错顺序全不变；新增独立工作流加载器 `workflows.js`（C-11 独立计数）。否则 I1.5「26 资产」与 `role list` 的 16 角色计数同时变红，`test/wp11/registry.test.js` 破 |
| 3 | `src/cli/labels.js` 用法块 8→25 行时前 8 行被改 / 中文散落 | M-2 / M-6 / BR-29 / BR-31 / AC-43 / AC-51 | `USAGE_LINES`(`:155-164`) 扩到 25 行、**前 8 行逐字不动**（`test/wp11/cli-role.test.js:356` 是守卫）；所有新增中文（三族文案、7 角色 + 19 工作流原因码、条件/类型标签）只在 `labels.js`，新增实现零 CJK（C-14、AC-51 第 4 条 `node -e`）；`showWake`(`:92`) 模板不动 |
| 4 | 两处内置资产对齐与 AC-61 临时改坏的顺序 / 还原 | D-7b / 裁-2 / AC-48 / AC-61 / BR-41 | 实现期先把 `assets/roles/researcher.yaml:13`、`writer.yaml:14-15` 对齐（**只改 `wake_allow` 取值、不动字段结构**）；AC-61 的 When 是在**对齐之后**临时把 writer 改回 `[editor]` 验证 `workflow validate` 变红，**必须 `finally` 立即还原**到对齐值，否则污染 `git status --porcelain assets`、AC-46/58 与后续 AC；AC-48 机检(860) 要比对 `git show 0cd113b:assets/...`，断言「差异恰好两处 `wake_allow`」 |
| 5 | `--force` 被实现成「跳过校验」 | BR-08 / C-05 / AC-40 追加用例 / AC-58 | `asset-write.js` 里 `--force` 只覆盖文件、**必须仍跑完整校验**（AC-40 第三段：把 `fork.yaml` 换成不合法内容再带 `--force` 仍被拒、sha256 不变）；`skill create`/`role import` 遇内置 id 一律 `ASSET_READONLY`，`--force` 也不豁免（AC-58） |
| 6 | 角色 diff 与工作流 diff 两套口径串用 | BR-11 vs BR-37 / F-02 / G-02 / AC-10 / AC-39 / AC-57 | `role diff` 忽略 `id`、**`name` 与其余键全比**（AC-10 的 `~ name`）；`workflow diff` 忽略 `schema/id/name`、只比定义体（AC-39）。`src/cli/roles.js` 与 `src/cli/workflows.js` 各用各的 diff 函数，别共用一套 `diffAssets`；AC-57 机检净增 `name` 正向断言（v6 修补 1） |
| 7 | C-08 / C-09 检查顺序或错误排序不确定 | BR-40 / C-08 / C-09 / D-3 / AC-53 / AC-62 / AC-65 | `role validate` 按 C-08 ①~⑪、`workflow validate` 按 C-09 ①~⑬ 逐项执行；项内按 YAML 声明顺序、`errors` 输出按文件名字典序（内置以「内置 」前缀参与）；同一文件同码只报第一条。AC-65 的「两次 JSON 逐字节相同 / 首条确定」依赖此，不能用 `Set`/`Object` 的偶然遍历序 |
| 8 | `dry-run` 被实现成起了核心 / 写盘 | C-12 / BR-27 / NFR-04 / AC-41 / AC-42 | `src/registry/workflow-plan.js` 的 `planWorkflow({workflow, task})` 保持纯函数（D-5：不读实例、不看时钟、不联网、不写文件）；AC-41 用 `find "$ROOT/.orch" -type f -exec sha256sum {} +` 前后比对 + 两次 stdout 逐字节比对；`src/cli/workflows.js` 不得直读 `state.json`（D-1） |
| 9 | AC-48 追加四条断言缺可复制机检命令 / evidence 无内置 researcher/writer 纯 show 基线 | H-02 / H-03 / AC-48 / S3 | S1 拆分文档把 AC-48 写清「原六条逐字 + 追加四条 = 十条」两段（H-03）；S3 写 `ac48.mjs` 时补 `grep -c '  可唤醒：writer'` / `grep -c '  可唤醒：editor, reviewer'` 逐字比对、两条 JSON 的 10 键断言，以及「资产差异行数 === 2 且仅两处 `wake_allow`」机判定（H-02）。注意 `docs/iterations/iteration-5/evidence/` 里 `AC-03.show.txt` 是项目版 researcher、`AC-28.show-builtin.txt` 是带 `--instance` 的 writer，**别拿来做纯 show 全行 diff** |
| 10 | `yaml-lite` 子集被超出（用了行内映射 / 块标量 / `{`） | D-2 / AC-24 / AC-63 / C-09 ① | 工作流节点/边一律映射序列（`- id: T-001` 后跟同缩进键），A-1/A-13 夹具逐字使用；字段值含冒号用引号；解析失败 `YAML_PARSE_FAILED` 带 1 基行号。`src/registry/yaml-lite.js` 沿用、不新增解析能力 |
| 11 | `src/templates/index.js` 的 `GRAPHS` 被改 / 新增内建图 | R-1 / C-10 / AC-21 / AC-22 / AC-49 / AC-63 | `GRAPHS`(`:292`) 恰 3 键（single/code-loop/task-loop），任一字段都不改；`test/templates/task-loop.test.js:298-300` 断言 `GRAPHS` 恰好三键、`single`/`code-loop` 不得有 `productPolicy`。内置工作流用**只读投影**（C-10）实现，不新增 `assets/workflows/**` 文件 |
| 12 | 并发场景 >10 个 / 同目录占用快检放错位置 / 全量测试写死条数 | AC-49 / AC-50 / NFR-06 / 执行模板 §5 第 11/14/22 条 | 夹具现场「同进程串行场景 ≤ 10 个」（执行模板 §0.3），>10 先 `forceKillCore`；`asset-write.js` 原子写（C-04：临时文件 + rename）把**同目录占用快检放写锁之前**（§5 第 11 条，否则等 60s 报 `IPC_TIMEOUT`）、锁内保留复核防竞态；AC-50 用下限断言 `fail===0 && pass===tests && tests>=611`，**不写死 611**（§5 第 14 条）；全量套件偶发 1~2 条 `test/wp10/perf.test.js` 越线属测量噪声，用 `--test-concurrency=4` 稳定门禁 + 先单跑 perf.test.js 诊断（§5 第 22 条），不许放宽预算 |
| 13 | 验收脚手架命名 / 项目根位置 / 事件帧与时间戳口径 | S3 / AC-49 / 执行模板 §3.1 / §5 第 4/5/6/21 条 | 脚手架文件带 `-f-`（`acc6-f-lib.mjs` / `-f-common.mjs` / `-f-run.mjs` / `-f-final.mjs`），**用例目录 `acc6-cases/` 不带 `-f`**（§3.1 命名约定，I1.3 曾误建 `acc3-f-cases/`）；路径常量导出为 `ACC6_PATHS`；项目根一律 `%TEMP%`、绝不放仓库内（§5 第 21 条）；AC-49 按需求给的两条 `sed` 去「已运行 Ns」与 `HH:mm:ss` 后逐字 diff，驱动自述行 `{"ok":true,"root":…}` 比对前剔除（D-10）；事件 `ts` 复用状态变更同一时刻、`seq` 严格单调、`emit` 先落盘再广播（§5 第 4/5/6 条）—— 本迭代不改 `src/core`，这些是「不改即不破坏」的回归纪律 |
| 14 | 新增实现出现资产名字面量 / CJK / import 注册表 | C-14 / BR-31 / AC-51 / 红线 6 / D-9 | `src/registry/**`、`src/cli/{roles,skills,workflows}.js` 零 CJK、零资产名字面量；`src/core` / `src/daemon` 不 import 任何注册表模块、不出现模板名/角色名（AC-51 四条命令全退 0；`purity-check.mjs` 的 `DEFAULT_FORBID` 只有 I1.2 四词、**必须显式 `--forbid "$COMMON"` 传 31 词全表**，含英文注释也算）；`labels.js` 是唯一合法持有资产名的文件，第 3 条命令必须**逐文件扫**、不得整目录扫 `src/cli` |

### §9.2 前序迭代硬约束（执行模板 §5 的 22 条）在本迭代的适用性

**总判定：22 条全部仍然适用**，只是因本迭代为「资产面、零运行时」，适用形态分两类：

**（A）直接适用 / 有本迭代 AC 直接门禁的（9 条）**

| # | 约束 | 本迭代落点 |
|---|---|---|
| 4 | 事件先落盘再广播；`emit` 失败不得改内存状态 | 本迭代不改 `src/core`，由 AC-49 三条主链逐字回归兜住 |
| 5 | 事件 `ts` 复用状态变更同一时刻（`iso()` 会差 4~8ms） | 同上；AC-49 的归一化 `sed` 只去「已运行 Ns」与 `HH:mm:ss`，时间戳口径不得被新代码改写 |
| 6 | 事件 `seq` 严格单调、`ts` 不早于同实例上一条 | 同上（AC-49） |
| 9 | `task-loop` 与 `code-loop` 事件行渲染分流；`single`/`code-loop` 输出是逐字回归红线 | **AC-49** 直接门禁；I1.5 report.md:24 已记 27/27 逐字 |
| 10 | 所有中文只在 `src/cli/labels.js`，核心不 import CLI | **BR-31 / C-14 / AC-51**（第 3/4 条命令 + `src/core`/`src/daemon` 不 import 注册表） |
| 11 | 忙检查放在写锁**之前**（否则同目录并发等 60s 报 `IPC_TIMEOUT`）；锁内保留复核 | **C-04 原子写 / `asset-write.js`**（见 §9.1 风险 12） |
| 14 | 验收脚本禁止硬编码测试条数；时间断言允许同秒内比较 | **AC-50** 下限断言 `tests>=611`（见 §9.1 风险 12） |
| 21 | 验收项目根绝不放仓库目录；`ELECTRON_RUN_AS_NODE` 跑 Electron 前要删 | **需求 §3.1/§3.3** `%TEMP%/maestro-acc-p6/<AC>/`、D-10 `fs.mkdtemp(os.tmpdir())` |
| 22 | 全量测试偶发 1~2 条 fail 在 `test/wp10/perf.test.js`（p95 ≤ 50ms）属测量噪声；先单跑再独占复跑全量、不放宽预算 | **AC-50 / NFR-06** 用 `--test-concurrency=4` 稳定门禁（见 §9.1 风险 12） |

**（B）以「不改即不破坏」方式继续适用（13 条）**：#1（`orchestrator.transit()` 唯一状态迁移入口 + CAS）、#2（`rev` 基于磁盘现值递增、`halted` 独立 save）、#3（CAS 三处同步）、#7（提示词一律绝对路径）、#8（模板字符串别动、优先改传入变量值）、#12（`driver --keep` 强杀退出码可能是 13）、#13（`orch core stop` 把非终态对账成 `interrupted`）、#15（只认 `verdict` 严格 pass/fail）、#16（`stopReason` 不判成败）、#17（ACP 分帧 NDJSON）、#18（真实宿主写 cwd 内文件不触发 `session/request_permission`）、#19（核心不依赖宿主上报产物指纹）、#20（`load` 后 drain-quiet、`-32602` 同码双义）—— 这些是运行时 / 宿主 / 适配层 / 派发链路的纪律。需求附录 D-1 明写**不得改动 `src/core/**`、`src/daemon/**`、`src/templates/index.js`（任何字段）、`src/registry/index.js` 的加载与计数**；本迭代零运行时、不实例化项目工作流（`orch run --workflow` 在范围外），因此这些约束不被主动触发，AC-49（三条主链）、AC-47（`orch run` 预检与「未知模板」文案）、AC-15（26 资产基线）是它们的回归门禁。

> 另有执行模板 §7 的 14 条红线全部适用，尤其：#2「不许改需求来迁就实现、不许删减/合并 AC」、#6「`src/core`/`src/daemon` 不出现模板名/角色名字面量」、#7「不新增第三方运行时依赖」、#9「主控不代写需求理解/拆分/验收产物」（本纪要即 SubAgent 产出）、#13「不许跳过 S0 进 S1」（S0 已 PASS）、#14「不许为让覆盖表变绿而改需求方向」。本纪要严格遵守：只写本文件、不改需求正文、不增删 AC/BR、不放宽 Then、不实现代码、不写拆分文档、不判 AC、不提交 git。

---

**本纪要结论**：`requirement.md` v7 定稿在「范围 / AC 分面 / BR·M·C 契约 / 附录 A·D 索引 / 未决问题 / Given 可构造性 / 回归红线 / DoR 13 条」八个维度均可核对；**65/65 条 AC Given 可构造、判定锚点可执行、均不涉及真实宿主**；**不存在阻塞 S1 开工的未决问题**；**DoR 13/13 全 PASS**。4 条建议级 H 项按 `decisions.md` 第九节转 S1 / S3 承接，不构成 S0 准出阻塞。本文件为唯一写入，未改需求正文、未实现代码、未写拆分文档、未判 AC、未提交 git。
