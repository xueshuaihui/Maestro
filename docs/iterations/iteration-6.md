# I1.6 任务拆分与文件级契约（自定义角色 + 工作流完整原语 + 校验器 + CLI 资产命令集）

> 需求依据：`docs/iterations/iteration-6/requirement.md` **v7**（65 条 AC / 41 条 BR / NFR-01~07 / M-1~M-7 / C-01~C-14 / 附录 A·B·C·D）
> 上游实现：I1.5 的 `src/registry/{index,role-schema,skill-file,assets,role-instances,yaml-lite}.js`、`src/cli/{main,roles,render,labels}.js`、`src/templates/index.js`、`test/wp11/*.test.js`（9 文件）、`test/fixtures/{purity-check,code-loop-driver,task-loop-driver}.mjs` 与 `mock-acp-agent.js`、`assets/roles/*.yaml`（16）、`assets/skills/*/SKILL.md`（10）
> 评审依据：`docs/iterations/iteration-6/review-round3.md`（第 3 轮 PASS / 阻断 0 / 建议 4）、`docs/iterations/iteration-6/decisions.md`（裁-1~裁-7 + 口误更正 + 第九节 H 处置）、`docs/iterations/iteration-6/requirement-understanding.md`（九节纪要）
> 骨架依据：`docs/templates/execution-template.md` §1.3 / §1.4 / §1.5 / §1.6 / §2.5 / §5 / §7；前序样板 `docs/iterations/iteration-5.md`、`iteration-3.md`
> 基线：分支 `feat/i1.6-assets-workflow`，HEAD `118dde4`，全量测试 611/611，架构扫描 exit 0，`package.json` 零运行时依赖
> 本文档边界：只写任务拆分与文件级契约；不实现代码、不改需求正文、不增删 AC/BR、不放宽任何 Then、不写验收用例与 probe 脚本、不提交 git。

## 0. 迭代定位、范围与退出标准

**一句话目标**：在 I1.5 只读注册表之上，新增「自定义角色三条路径 + 角色校验器五项 + 技能/工作流资产命令 17 条 + 工作流 11 原语与校验器六项 + 静态 dry-run」，且除 D-7b 授权的两行「可唤醒」外，I1.5 既有输出与三条主链逐字节不变、零运行时依赖、零 DSH。

**In scope**（逐条对应需求 §1.3 范围内与 §1.3.1，按纪要 §1.1 的 7 组规划能力落位）：

| # | 规划能力（7 组） | 需求落点 | AC 号段 | 主责 WP |
|---|---|---|---|---|
| 1 | 自定义角色三条路径（从零 / 从内置派生 / 导入包）+ 角色写命令 create·edit·export·import·diff | §1.3 项 1·2、§2.2~§2.4、附录 A-2~A-5、D-4 | AC-01~AC-10、AC-53~AC-59 | WP-6 |
| 2 | 角色校验器五项（schema 完整性 / 技能引用 / 契约连通 / 权限闭环 / 派生链无循环），仍是同一条 `role validate` | §1.3 项 3、§2.5、C-08、A-15 | AC-11~AC-15、AC-53 | WP-2 / WP-6 |
| 3 | 工作流完整原语 11 项（顺序 / 并行 fan-out·fan-in / 条件分支 / 回流循环 / 轮次上限 / 超时 / 重试 / 人工节点 / 子工作流 / 升级 / 终止；字段映射按能力域 2 单列） | §1.3 项 7、§2.7·§2.8、A-1·A-13·A-14、裁-5、R-10 | AC-24、AC-27~AC-30、AC-37、AC-63~AC-64 | WP-4 / WP-1 |
| 4 | 节点模型补 `node_type`（role / human / escalate / subworkflow；JSON 键 `nodeType`） | §1.3 项 6、§2.7、M-7、D-2、D-3⑤ | AC-22、AC-24~AC-26、AC-62 | WP-1 |
| 5 | 工作流校验器六项（可达性 / 回流轮次上限 / 并行 scope 不重叠 / 变量引用 / 状态转换 / 唤醒权限；含三条内置图、不豁免） | §1.3 项 8、§2.9、C-09、D-3、BR-21~26·35·36·39·40·41 | AC-31~AC-38、AC-60~AC-62、AC-64~AC-65 | WP-3 / WP-1 |
| 6 | CLI 资产命令集 17 条（role 5 + skill 6 + workflow 6）+ 一份 25 行用法块 + 用法错误矩阵 + 只读/落盘纪律 | §1.3 项 10、§1.2 指标 7、M-1、A-12、D-6、B-07 | AC-01~AC-10、AC-16~AC-23、AC-38~AC-48、AC-53~AC-59 | WP-5 / WP-7 / WP-8 |
| 7 | 四条规划验收句（派生改技能行为变化 / 契约不连通被拒 / 含 human·escalate 校验通过 / dry-run 不启会话） | §2.3 / §2.9 / §2.7 / §2.8 | AC-05、AC-31、AC-24、AC-41 | WP-6 / WP-3 / WP-1 / WP-4 |

> 补充（需求 §1.3.2 登记）：用法块集中一份、用法错误矩阵、只读不建 `.orch`、写只写 `.orch`、`run --workflow` 边界、兼容与纯净（AC-43~AC-52）并非规划逐字原文，而是基线 §5.2 / §6 与 I1.5 CLI 纪律、逐字红线的延续；本拆分不新增需求条目，只按需求已登记的落点分派 WP。

**Out of scope**（摘要，全表见需求 §1.3:66-81 共 14 项）：① `orch run --workflow` 实例化（B-01，建议 I1.7/I1.8）；② 技能正文/角色契约拼进派发提示词（仍不做）；③ 按 `max_concurrent_sessions` 拦截第 N+1 会话（I1.7）；④ `artifact_type` 目录隔离 worktree（I1.7）；⑤ 包的依赖闭包/签名/版本兼容/来源追溯（I1.12，本迭代包 = 单文件）；⑥ 崩溃恢复 / ACP 恢复方言 / 会话复用（I1.8）；⑦ 角色流程图 / 工作流画布渲染 / 折叠组下钻（I1.10a·b / I1.11）；⑧ 工作流 pause/resume/abort（I1.4 实例侧）；⑨ 多人协作资产锁与并发写冲突（不做）；⑩ 资产权限 / 链式哈希审计（I1.12）；⑪ 产物合并 / 汇总顺序（I1.7）；⑫ 版本锁定（I1.8）；⑬ 工作流权限匹配（I1.8）；⑭ 节点 9 态运行时迁移（I1.8，本迭代按静态图约束，裁-1 / R-9）。

**退出标准**（逐条可判定，含数字或逐字口径）：

1. **65/65 AC 全部通过**，按需求 v7 §3.1 同号 Then 逐字判定：命令面 35（AC-01~10·16~23·39~48·53~59）+ 校验器面 24（AC-11~14·24~38·60~62·64~65）+ 回归与门禁面 6（AC-15·49~52·63）= 65；证据按面落 `%TEMP%/maestro-acc-p6/<AC 编号>/`，逐条 Then 不改写、不合并、不放宽。
2. **全量测试下限断言**：`node --test --test-concurrency=4 "test/**/*.test.js"` 结果满足 `fail === 0 && pass === tests && tests >= 611`（只写下限，不写死 611）。
3. **既有断言零修改**（除 D-7a 两行）：`test/wp11/cli-role.test.js:354` 的 `9`→`26`、`:357` 的 `8`→`25`；`:356` 的 `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES]);` 逐字不动；其余 `test/**` 一个字符不动。
4. **架构扫描四条全 exit 0**（D-9 逐字副本）：`$COMMON` 31 词扫 `src/core,src/daemon`；`$NOCOORD` 30 词扫 `src/registry`；`$COMMON` 31 词逐文件扫 `src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js`（不得整目录扫 `src/cli`）；`node -e` 零 CJK 扫 `src/registry` + 三族 CLI；英文注释也算命中；`coordinator` 在 `src/registry/**` 只允许出现在 `role-schema.js` 的 `GROUPS` 一行。
5. **零运行时依赖**：`node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"` 输出 `0`。
6. **三条主链逐字回归**（AC-49）：`single` / `code-loop` / `task-loop`，`NODE_ENV=test`，driver 只用 `test/fixtures/code-loop-driver.mjs` 与 `test/fixtures/task-loop-driver.mjs`，去「已运行 Ns」片段与 `HH:mm:ss` 后与 `0cd113b` 基线逐字一致；既有 `orch run` 预检与 `未知模板：<名字>` 文案不变（AC-47）。
7. **NFR-01~07 逐条可判定**：NFR-01 20 节点/30 边 `validate` 2 秒内给出结论；NFR-02 同规模 `dry-run` 2 秒内打印末行；NFR-03 100 个合法角色 `role list` 2 秒内出首行；NFR-04 同一只读命令连跑两次输出逐字节相同；NFR-05 成功路径返回时文件已落盘且无 `*.tmp` 残留；NFR-06 `fail === 0 && tests >= 611` 且三条主链输出不变；NFR-07 零运行时依赖、全部资产命令离线可用。
8. **D-7a 两行授权断言生效**：`USAGE_LINES.length === 25`、`renderUsage(msg)` 整块 26 行、前 8 行与 I1.5 逐字一致，`:356` 守卫保留。
9. **D-7b 两处资产对齐**：`assets/roles/researcher.yaml` 的 `wake_allow: []` → `wake_allow: [writer]`、`assets/roles/writer.yaml` 的 `wake_allow: [editor]` → `wake_allow: [editor, reviewer]`；`git diff` 恰好这两处、其余 `assets/**` 与 `0cd113b` 逐字节相同；`orch workflow validate --format json` 的 `counts.invalid === 0 && counts.assets === 3`（AC-61 门禁）。
10. **用法块可数**：`USAGE_LINES` 25 行 = 前 8 行逐字 + 17 条新命令逐行可数；用法错误追加一行原因合计 26 行、退出码 2（AC-43/44）。
11. **S0 已 PASS 轮次**：`review-round3.md` 第 3 轮 PASS、阻断 0、建议 4（H-01~H-04）、§8「不需要第 4 轮」；需求 v7 定稿、纪要 DoR 13/13 全 PASS；本拆分据此开工，不重开 S0。
12. **B 类零 DSH**：本迭代不接真实宿主面，验收面全部是静态资产与终端输出；所有验收项目根统一 `%TEMP%/maestro-acc-p6/<AC 编号>/`，绝不放仓库目录内。

## 1. 技术选型（结论 + 被否决项）

> 每个关键决策固定三段：**结论 / 理由 / 被否决方案及原因**。被否决项全局连续编号 `#1~#19`，本节合计 **19 条**（见 §1.13 汇总表）。

### 1.1 工作流 YAML 解析层：复用 `yaml-lite` vs 第三方 YAML

- **结论**：工作流资产一律沿用 `src/registry/yaml-lite.js` 的 `parseYaml(text)`，不新增解析能力；`src/registry/workflows.js` 在解析前按 D-2 校验 YAML 子集（映射序列、禁行内映射 `{...}` / 块标量 `|` `>` / 锚点 `&` `*` / `---` / 制表符缩进 / 标量里 `{`；含冒号的值加引号），解析失败一律 `YAML_PARSE_FAILED` 带 1 基行号，`{detail}` 由 `labels.js` 的 `YAML_DETAIL` 组装。
- **理由**：A-1 / A-13 的 `doc-fanout` 全文只用「映射序列 + 字符串数组 + 整数」，`yaml-lite` 已覆盖；C-14 / AC-52 要求零新增运行时依赖；沿用同一解析器可让角色/技能/工作流三类资产的解析错误文案、行号口径完全一致。
- **#1 被否决：引入第三方 YAML（js-yaml / yaml / gray-matter 等）** —— 直接违反 BR-34「不新增运行时依赖」与 AC-52「`dependencies` 键数 0」；且第三方库会放开 D-2 明令禁止的锚点/块标量/标签语法，使「合法工作流」集合失控、AC-24/63 夹具口径不再唯一。

### 1.2 内置三图：只读投影 vs 落盘 `assets/workflows/**`

- **结论**：三张内建图 `single` / `code-loop` / `task-loop` 以 **只读投影**（C-10 / R-1）进入工作流集合——`workflows.js` 的 `projectBuiltinWorkflows(builtinGraphs)` 把 `src/templates/index.js` 的 `GRAPHS` 逐图转成 `workflow/v1` 形状：`source='builtin'`、`file=null`、节点 `node_type: role`、`title` 取图节点 `title`（`null` 时取角色中文名）、`max_rounds` 取 `maxRounds[nodeId]`、边 `kind` 取图边 `kind`、`when` 取 `condition` 归一化（`null` 与运行时条件一律归 `always`）。投影不落盘、不参与任何写命令，但**参与全部六项校验含唤醒权限**（裁-2 / BR-39 / BR-41）。
- **理由**：`src/templates/index.js` 的 `GRAPHS` 恰好 3 键被 `test/templates/task-loop.test.js:298-300` 逐字锁住（`single`/`code-loop` 不得有 `productPolicy`），新增内建图或改任一字段会当场打破三条主链逐字红线（AC-49）；投影让 `list/show/diff/create` 有基线且零风险；`assets/workflows/**` 一旦落盘就多出 3 个「内置资产」需要纳入 D-7b「assets 只读」与 AC-45/46/58 的 sha256 清单，口径全面变复杂。
- **#2 被否决：把三张图复制成 `assets/workflows/*.yaml` 落盘** —— 违反 D-1「不得改动 `assets/**`（唯一例外 D-7b 两处 `wake_allow`）」与 R-1/AC-49 逐字红线；且落盘后内置工作流可被 `role import` / `--force` 之外的路径触碰，破坏 BR-01「内置只读」。

### 1.3 校验器组织：纯函数模块 vs 塞进 CLI

- **结论**：校验能力拆成 4 个新增纯函数/加载模块，职责由 D-1 逐行定死——`workflow-schema.js`（字段契约、19 个 `WORKFLOW_*` 原因码常量、四类节点与 `kind/when/join` 取值域、单节点/单边形状）、`contracts.js`（`checkRoleContracts({roles, workflows})`：契约连通 / 权限闭环 / 派生链，纯函数）、`workflows.js`（扫描 + 投影 + C-09 ①~⑬ 编排 + counts，唯一允许 `node:fs` 的校验侧文件）、`workflow-plan.js`（`planWorkflow({workflow, task})` 纯函数）。四者均「不写文件、不出现中文、不出现具体资产名」。
- **理由**：C-14 / AC-51 要求 `src/registry/**` 零 CJK、零资产名字面量；D-4 要求写命令与 `role validate` 共用同一套 `checkRoleShape` + 技能解析 + `contracts.js`，「不得另写一份判定」；纯函数模块可让 `workflow-schema.test.js` / `workflow-plan.test.js` 用内存对象、不碰磁盘（D-10），也让 WP 之间按契约并行。
- **#3 被否决：把校验逻辑直接写进 `src/cli/roles.js` / `skills.js` / `workflows.js`** —— 会造成「写命令一条判定、`validate` 另一条判定」，正面违反 D-4 / BR-07「先校验后落盘」与 C-08/C-09 顺序一致性；CLI 文件出现中文与资产名字面量会当场触发 AC-51 第 3/4 条扫描变红。
- **#4 被否决：把四类校验合进一个 `workflow-validator.js` 大文件** —— 无法让 `workflow-schema`（形状）、`contracts`（角色侧）、`workflows`（图级判定）、`workflow-plan`（预演）各自独立跑契约测试，违背 §1.4 规则 2「每包可独立验收」；且一个文件同时含 IO 与纯函数会让 D-10 的两类测试口径混在一起。

### 1.4 `dry-run` 编排计划的数据结构

- **结论**：`planWorkflow({workflow, task})` 返回**内存纯对象**，顶层恰 8 键 `id` / `name` / `nodeCount` / `edgeCount` / `layers` / `branches` / `mappings` / `policies`（不含 `warnings` 时不输出该键）；`layers[]` 恰 2 键 `parallel` / `nodes`，`branches[]` 恰 3 键 `from` / `to` / `when`，`mappings[]` 恰 3 键 `from` / `to` / `edge`，`policies[]` 恰 3 键 `nodeId` / `timeout` / `retry`（A-14）。生成顺序按 D-5：最长路径分层（回边只标注不参与）→ 同层同 `parallel_scope` 合并为 `parallel=true` 一条层记录 → `when != always` 的边按 `(from 层号, to, when)` 稳定排序 → `map` 项按 `(from 层号, to 节点, 序号)` → `timeout`/`retry` 非空节点按层号 → `subworkflow` 的 `workflow` 解析出节点数写进节点描述。不读实例、不看时钟、不联网、不写文件。
- **理由**：C-12 / BR-27 / NFR-04 要求不建 `.orch/instances`、两次输出逐字节相同；A-14 已把 8 键与各子键集合逐字锁死，纯对象最容易做 JSON 与文本双通道一致（AC-38）、最容易做两次逐字节比对（AC-41）。
- **#5 被否决：把编排计划写成 `.orch/plans/*.json` 落盘文件** —— 违反 C-12「不写任何文件 / 不建 `.orch`」与 AC-41「既有文件 sha256 前后不变 / 两次 stdout 逐字节相同」；落盘还会引入「计划文件是否算资产」的新计数口径。
- **#6 被否决：`dry-run` 直接复用 `GRAPHS` 的运行时节点对象 / `state.json` 形状** —— `state.json` 是实例侧运行时结构，本迭代零运行时、不实例化项目工作流（BR-28 / R-3）；复用会让 `planWorkflow` 依赖核心状态，违反 D-1「`workflow-plan.js` 禁止读写文件、看时钟」与 C-14「`src/core`/`src/daemon` 不 import 注册表」。

### 1.5 写命令的原子写（临时文件 + rename）

- **结论**：`asset-write.js` 的 `atomicWrite({target, text})` 先写**同目录**临时文件再 `rename`；失败时目标保持原样、不留 `.tmp`（C-04 / NFR-05）。写入前一律先在内存跑完整校验，任一原因码出现即不写文件并输出 `<动作>被拒：<明细>（<原因码>）`、退 1（C-03 / BR-07 / R-7）。默认落点只有三处 `.orch/roles/<id>.yaml`、`.orch/skills/<id>/SKILL.md`、`.orch/workflows/<id>.yaml`，或用户显式 `--out <路径>` 的那一个文件（C-02 / BR-01）；`--force` 只覆盖文件、**不跳过校验**（C-05 / BR-08）。同目录占用快检放在写锁**之前**，锁内保留复核（执行模板 §5 第 11 条）。
- **理由**：NFR-05「不会有半成品文件残留」与 AC-46「只写 `.orch`」要求原子性；AC-40 第三段「把 `fork.yaml` 换成不合法内容再带 `--force` 仍被拒、sha256 不变」要求 `--force` 不绕过校验；AC-58「冒名内置 / `--force` 都不动 `assets/**`」要求内置只读判定用 `source === 'builtin'`。
- **#7 被否决：`fs.writeFileSync(target, text)` 直接覆盖** —— 中途失败会留下半文件，违反 C-04 / NFR-05；且无法保证 AC-46 的 `git status` 前后一致。
- **#8 被否决：先落盘再校验（不合法再回滚删除）** —— 违反 R-7 / BR-07「不合法不留半成品」；回滚删除本身又是一次写，AC-45/46 的 sha256 清单会观测到中间态。

### 1.6 `node_type`（YAML 键）/ `nodeType`（JSON 键）映射

- **结论**：资产文件里的键**逐字写 `node_type`**（四类取值 `role` / `human` / `escalate` / `subworkflow`，M-7 / F-04：需求 v7 明确 `type:` 残留为 0）；JSON 输出键为驼峰 `nodeType`（`workflow show --format json` 的节点对象恰 11 键，A-14）。转换只在「资产 → 内存对象」与「内存对象 → JSON」两处单点发生（`workflows.js` 解析侧 + CLI 序列化侧），不扩散到 `src/templates/index.js` 与 `state.json`。内建图投影出的节点一律 `node_type: role`（C-10）。
- **理由**：规划 746 逐字要求字段名 `node_type`；F-04 已把全文 `type:` 残留清零；与 I1.5 既有 `artifactType` / `groupLabel` / `maxConcurrentSessions` 的驼峰 JSON 口径一致；单点转换避免同一份数据在 YAML/JSON/内存里三套键名。
- **#9 被否决：统一用 `type:` 作为资产键** —— 与需求 v7 / 规划 746 逐字冲突（F-04 已修），且 `type` 会与 `schema` / `kind` 语义混淆；违反 §8「冲突以需求为准」。
- **#10 被否决：资产文件里直接写 `nodeType`** —— 破坏 A-1 / A-13 夹具的逐字基线，AC-24/27~38/62/63 全部复用该夹具，一处改键会让机检全红；也违反「YAML 键逐字为 `node_type`」的需求口径。

### 1.7 新增 CLI 三族文件与 `main.js` 接线

- **结论**：三族各导出统一签名 `roleCommand(parsed, ctx)` / `skillCommand(parsed, ctx)` / `workflowCommand(parsed, ctx)`（`→ Promise<number>`，沿用 I1.5 `roleCommand` 形态）。`src/cli/main.js` 是 `COMMANDS` / `VALUE_FLAGS` / `BOOLEAN_FLAGS` / `REPEATABLE_FLAGS` / 各子命令 `*_SUBS` 与 `*_FLAGS` 白名单的**唯一负责人**（WP-5）：`COMMANDS` 增 `skill` / `workflow`；`ROLE_SUBS` 从 `list,show,validate` 扩到 8 条；按 D-6 的 18 行表逐子命令落标志白名单；`--set`/`--unset` 进 `REPEATABLE_FLAGS`（解析成数组）、`--force` 进 `BOOLEAN_FLAGS`；白名单检查放在 `parseArgs` 解析**之后**（保留「未知参数：--nope」与「--<键> 不适用于 <族> <子命令>」两句不同文案，I1.5 C-2 / M-9）；`main()` 按 `parsed.command` 分派到三族 `xxxCommand`，旧命令 `run/status/cancel/core` 的返回对象字段集合一个都不变。`role create` 两档必填顺序固定 `--name → --group → --artifact-type → --side-effect`（无 `--from` 时四项必填、先缺先报、缺一退 2；给 `--from` 时四项可省、跳过检查，BR-38 / AC-02 / AC-04）。
- **理由**：M-1 / D-6 要求 17 条新命令接入但旧命令、旧参数、旧退出码逐字不变；AC-44 要求三族 × 四类用法错误共 12 次都退 2 且原因文案各不同；共享文件（`main.js` / `labels.js` / `roles.js` / `render.js` / `src/registry/index.js`）必须指定唯一负责人，否则两个 Agent 互相覆盖（§1.4 规则 1）。
- **#11 被否决：把 skill/workflow 的子命令全部塞进 `src/cli/roles.js`** —— 会让 `roles.js` 同时承担三族、中文与资产名散落，触发 AC-51；且 `role` 三命令逐字回归（AC-48）与新增命令混在一个文件里，回归风险不可控。
- **#12 被否决：每条命令一个独立 `bin/*.js` 入口** —— 违反 BR-29「全部资产命令的帮助集中在一份用法块」与 A-12 的 25 行单一来源；也无法复用 `main.js` 的白名单与退出码语义。

### 1.8 `test/wp12/` 的测试组织

- **结论**：新增用例统一放 `test/wp12/` 的 **8 个文件**（D-10）：`role-write.test.js`、`role-contracts.test.js`、`skill-assets.test.js`、`workflow-schema.test.js`、`workflow-yaml.test.js`、`workflow-validate.test.js`、`workflow-plan.test.js`、`cli-assets.test.js`。`workflow-schema` / `workflow-plan` 是纯函数类（输入内存对象、不碰磁盘）；需要项目根的用例用 `fs.mkdtemp(os.tmpdir())` 造，绝不放仓库内；`cli-assets.test.js` 直接 `import { main }` 注入 `out` / `cwd`，不 spawn、不启核心，退出码用返回值；AC-49 沿用 `code-loop-driver.mjs` / `task-loop-driver.mjs` + `mock-acp-agent.js` + `NODE_ENV=test`。全量命令固定 `node --test --test-concurrency=4 "test/**/*.test.js"`。
- **理由**：D-7a 只允许改 `test/wp11/cli-role.test.js` 两行，其余 `test/**` 零修改，新增断言必须放新目录；8 文件按「纯函数 / IO / CLI 集成」分层，正好让 WP-1~WP-7 各带一份可独立跑的契约测试。
- **#13 被否决：把新用例追加进 `test/wp11/*.test.js`** —— 违反 D-7a「除两行外 `test/**` 一个字符都不许改」与 AC-50「既有断言修改仅限 D-7 点名的两行」。
- **#14 被否决：只建一个 `test/wp12/assets.test.js` 大一统文件** —— 无法按 WP 独立跑契约测试（§1.4 规则 2），且与 D-10 点名的 8 文件清单逐字冲突。

### 1.9 `loadRegistry` 边界：独立工作流加载器 vs 改 `index.js`

- **结论**：`src/registry/workflows.js` 自带 `loadWorkflows({root, builtinGraphs})`，返回 `{ok, workflows, workflowMap, errors, counts}`；`src/registry/index.js` 的 `loadRegistry({root, onlyRole, builtinRoot})` **不改加载、不改 counts（`roles.length + skills.length + invalid`）、不改报错顺序**（M-3 / R-4 / D-1）。`role validate` 需要读工作流做契约连通时，由 `src/cli/roles.js` 调 `loadWorkflows` 拿内存集合传给 `contracts.js`，**不计入** `role validate` 的资产计数（R-4：把工作流算进 26 资产会让 I1.5 基线当场变红）。`workflow validate` 的计数独立为 `counts = { assets, builtin, project, invalid }`（C-11 / D-3）。
- **理由**：`test/wp11/registry.test.js` 锁住 counts 与报错顺序；AC-15 要求「26 个内置资产仍全通过」逐字；AC-11 要求 `role validate` 的 counts 仍 6 键、errors 仍 6 键。
- **#15 被否决：改 `loadRegistry` 让它顺带加载工作流并计入 assets** —— 违反 M-3 / D-1「不得改动 `src/registry/index.js` 的加载与计数」；会让 I1.5 的「校验资产 26 个」与 `role list` 的 16 角色计数同时变红（R-4）。

### 1.10 角色 diff 与工作流 diff：两套口径 vs 共用

- **结论**：`src/cli/roles.js` 与 `src/cli/workflows.js` 各用各的 diff 函数，不共用 `diffAssets`。`role diff` 忽略 `id`、`name` 与其余键全比（AC-10 的 `~ name` 由此而来，BR-11 / BR-37）；`workflow diff` 忽略 `schema` / `id` / `name`、只比定义体 `summary` / `entry` / `terminal` / `nodes` / `edges`，节点与边按下标配对、字段路径写 `nodes[0].title`（A-11 / BR-37 / F-02 / G-02）。两者缺省键按缺省值比较、差异项数 = 差异行数、一致时「无差异」。
- **理由**：F-02 / G-02 已把「两套口径串用」列为历史缺陷；AC-10 要 `~ name`、AC-39 要 `~ nodes[0].title`，共用一套会互相污染；AC-57 机检追加「净增 `name` 正向断言」（v6 修补 1）。
- **#16 被否决：三族共用一套 `diffAssets(base, target)`** —— AC-39 的「`name` 不属于比对范围、不产生 `~ name`」与 AC-10 的「`~ name` 是差异行」直接互斥，共用必破其一。

### 1.11 用法块与中文唯一来源

- **结论**：`src/cli/labels.js` 的 `USAGE_LINES` 由 8 行扩到 **25 行**（前 8 行逐字不动、追加 17 条新命令行，A-12）；`renderUsage(message)` 用法错误时追加一行 `  （<原因>）` 合计 26 行。新增中文（三族文案、7 条 `ROLE_*` + 19 条 `WORKFLOW_*` 原因码明细模板、5 条条件与类型标签、派生默认名 `{base}（派生）`）**只在 `labels.js`**；`src/registry/**` 与三族 CLI 实现零 CJK、零资产名字面量（C-14 / BR-31 / AC-51）。既有表一个键都不加不改（M-6）。
- **理由**：R-8 / BR-29 要求唯一帮助入口；D-7a 只授权 `test/wp11/cli-role.test.js` 的 `:354` / `:357` 两行同步；AC-51 第 3 条命令必须**逐文件扫**三族 CLI（不能整目录扫 `src/cli`，因为 `labels.js` 合法持有资产名）。
- **#17 被否决：在每个子命令里各自 print 自己的帮助行** —— 违反 BR-29「集中成一份用法块」与 A-12「25 行」；且 `USAGE_LINES.length === 25` / 整块 26 行的 AC-43 断言无法成立。

### 1.12 包边界、`.orch/workflows` 路径助手与 `--force` 语义

- **结论**：本迭代「包」= **单个可导出/导入的资产文件**（裁-3 / B-05 / 需求 §1.3:72），`role import` / `skill import` 只装这一个文件、缺技能直接拒绝导入，不做依赖闭包/签名/版本兼容/来源追溯。`.orch/workflows` 目录路径在 `src/registry/workflows.js` 内部用 `path.join(root, '.orch', 'workflows')` 内联拼接，**不新增 `projectWorkflowsDir(root)`、不改 `src/registry/assets.js`**（D-1 清单未点名 `assets.js`，避免扩大改动范围）。命令级失败码（`ROLE_NOT_FOUND` / `SKILL_NOT_FOUND` / `WORKFLOW_NOT_FOUND` / `ASSET_EXISTS` / `ASSET_READONLY` / `BASELINE_MISSING`）只决定退出码与首句文案，不进资产错误表（C-13）。
- **理由**：D-1 的「不得改动」清单只列 `index.js` 加载与计数、`templates/index.js`、`src/core/**`、`src/daemon/**`、`assets/**`；`assets.js` 虽未被禁改，但也未被列入 10 行新增清单，按执行模板 §6「必须改契约清单之外的既有契约 → 标待评审、不自行扩大改动范围」，选择零改动最稳；裁-3 已把包边界定为单文件。
- **#18 被否决：在 `src/registry/assets.js` 新增 `projectWorkflowsDir(root)`** —— D-1 的 10 行文件边界表未含 `assets.js`，新增导出会让「改动范围」超出需求授权，且 `assets.js` 属于 I1.5 既有契约文件，动它会被 AC-45/46/58 的「既有文件不变」类断言扫到；内联拼接语义等价、零风险。
- **#19 被否决：实现包的依赖闭包 / 签名校验 / 版本兼容 / 来源追溯** —— 需求 §1.3:72 明确留给 I1.12，本迭代实现即越界（§1.2「完善需求只能补，不能减」的反向约束：不得把范围外挪进范围内）。

### 1.13 被否决项汇总

| 决策 | 被否决编号 | 条数 |
|---|---|---|
| 1.1 YAML 解析层 | #1 | 1 |
| 1.2 内置三图 | #2 | 1 |
| 1.3 校验器组织 | #3、#4 | 2 |
| 1.4 dry-run 计划结构 | #5、#6 | 2 |
| 1.5 原子写 | #7、#8 | 2 |
| 1.6 node_type 映射 | #9、#10 | 2 |
| 1.7 CLI 三族接线 | #11、#12 | 2 |
| 1.8 测试组织 | #13、#14 | 2 |
| 1.9 loadRegistry 边界 | #15 | 1 |
| 1.10 两套 diff | #16 | 1 |
| 1.11 用法块/中文 | #17 | 1 |
| 1.12 包边界/assets.js | #18、#19 | 2 |
| **合计** | **#1~#19** | **19** |

> 技术选型被否决项 **19 条**（12 个关键决策，8 个点名决策全部覆盖且每个都写了「结论 / 理由 / 被否决方案及原因」）。

## 2. 模块划分与文件级接口契约

> 每个文件标注「新增 / 改 / 不改，WP-x」。「不改」文件标「边界守护 WP」，不进任何 WP 的负责文件清单（§4），只声明不许改的部分；共享文件（`src/cli/main.js`、`labels.js`、`render.js`、`roles.js`、`src/registry/index.js`）均指定唯一负责人。

### 2.1 `src/registry/workflow-schema.js`（新增，WP-1）

- **导出签名**：`export const WORKFLOW_SCHEMA_VERSION = 'workflow/v1'`；`export const NODE_TYPES = Object.freeze(['role','human','escalate','subworkflow'])`；`export const EDGE_KINDS = Object.freeze(['forward','backflow','retest'])`；`export const WHEN_VALUES = Object.freeze(['always','passed','failed','human_approved','human_rejected'])`；`export const JOIN_VALUES = Object.freeze(['all','any'])`；`export const WORKFLOW_REASONS = Object.freeze(/* 19 个 WORKFLOW_* 原因码常量，A-15 */)`；`export function checkWorkflowShape(obj, { fileId } = {})`；`export function checkNodeShape(node)`；`export function checkEdgeShape(edge)`。
- **入参/出参**：入参为内存对象（已由 `parseYaml` 解析后的 workflow / 单个 node / 单个 edge）与可选 `fileId`；出参为 `Array<{code, field, params}>` 形状问题数组（沿用 `role-schema.js` 的 `checkRoleShape` 返回约定，`field` 可为 `null`，`params` 为 `{}` 占位对象）。
- **约束**：纯函数、零 IO、零中文、零资产名字面量；不得读写文件（`node:fs` 禁止）；19 个原因码常量名逐字等于 A-15；`timeout` 1~86400、`retry` 0~5、`max_rounds` 1~9 的取值域在此定义；`node_type` 不在四类 / 类型必填字段缺失分别对应 `WORKFLOW_NODE_TYPE_INVALID` / `WORKFLOW_NODE_FIELD_MISSING`。归 WP-1 唯一所有。

### 2.2 `src/registry/contracts.js`（新增，WP-2）

- **导出签名**：`export function checkRoleContracts({ roles, workflows } = {})`。
- **入参/出参**：`roles` 为 `loadRegistry` 的角色对象数组、`workflows` 为 `loadWorkflows` 的 `workflowMap`/集合（内存对象，可为兼容缺省的空数组）；出参为 `Array<{code, file, scope:'role', field, params}>` 问题数组，原因码限定 7 个新增 `ROLE_*`：`ROLE_TOOL_UNKNOWN` / `ROLE_PERMISSION_MISMATCH` / `ROLE_WAKE_UNKNOWN` / `ROLE_WAKE_SELF` / `ROLE_DERIVE_MISSING` / `ROLE_DERIVE_CYCLE` / `ROLE_CONTRACT_UNBOUND`（A-15）。
- **约束**：纯函数、零 IO、零中文、零资产名；「契约连通」逐字段判（BR-13：每个输入有来源、每个输出有去处，只对被至少一个工作流引用的角色生效）、「权限闭环」按 BR-14（工具集与副作用等级自洽 + 唤醒白名单存在且不含自己）、「派生链」按 BR-06，检查顺序按 C-08 ①~⑪，同一文件同一原因码只报第一条；缺 `workflows` 时按契约兼容缺省（不因下游未写完而抛错）。归 WP-2 唯一所有。

### 2.3 `src/registry/workflows.js`（新增，WP-3）

- **导出签名**：`export function projectBuiltinWorkflows(builtinGraphs)`；`export async function loadWorkflows({ root, builtinGraphs } = {})`（亦可为同步，按 D-3 口径实现，返回结构固定）；`export const WORKFLOW_CHECK_ORDER = Object.freeze(/* C-09 ①~⑬ */)`。
- **入参/出参**：`root` 为项目根绝对路径、`builtinGraphs` 为 `src/templates/index.js` 的 `GRAPHS`（只读）；出参严格 `{ ok, workflows, workflowMap, errors, counts }`，其中 `counts = { assets: 参与校验数（含不合法）, builtin, project, invalid: 涉及文件数 }`（4 键，D-3 / A-14），`errors[]` 每项沿用 `index.js` 的 `makeError` 6 键 `{ code, file, scope, field, line, params }` 且 `scope` 恒为 `'workflow'`。
- **约束**：唯一允许 `node:fs` 的校验侧文件，但**只读**（扫描 `<root>/.orch/workflows/*.yaml`，不存在即跳过），不得写文件、不得建目录、不得联网、不得出现中文与图名；内置投影按 C-10（source='builtin'、file=null）；合并按「内置按 id → 项目整体覆盖」（BR-18 / R-2）；校验顺序按 C-09 ①~⑬、判定口径逐条按 D-3（可达性终态含 `human`/`escalate`、回边 `max_rounds`、并行 scope、`map.from` 正则 `^(task|[A-Za-z0-9-]+)\.[A-Za-z0-9_.-]+$`、⑪ 控制流边豁免、⑫ 状态转换、⑬ 唤醒权限「所有工作流含三条内置图」）；`errors` 先按文件排序（内置以「内置 」前缀参与）、同文件内按检查顺序，同一文件同码只报第一条；不得 import `src/core`、`src/daemon`。归 WP-3 唯一所有。

### 2.4 `src/registry/workflow-plan.js`（新增，WP-4）

- **导出签名**：`export function planWorkflow({ workflow, task } = {})`。
- **入参/出参**：`workflow` 为 `workflows.js` 内存工作流对象、`task` 为 `--task` 文本（缺省按空串兼容）；出参为 §1.4 的 8 键纯对象（不含 `warnings` 时不输出该键）。
- **约束**：纯函数、零 IO、零中文、零资产名；不读实例、不看时钟、不联网、不写文件（D-5 / C-12 / NFR-04）；分层、并行组、分支、映射、策略、子工作流计数按 D-5 的 6 步与稳定排序键；同一输入两次输出逐字节相同。归 WP-4 唯一所有。

### 2.5 `src/cli/main.js`（改，WP-5）——共享文件唯一负责人

- **导出签名（保持）**：`export function parseArgs(argv)`、`export function exitCodeFor(code)`、`export async function main(argv, options = {})`。
- **入参/出参（保持 + 扩展）**：`parseArgs` 返回 `{ok:true, command, sub, flags[, positional]} | {ok:false, code:'USAGE', message}`；`positional` 仍只在 `role`/`skill`/`workflow` 三族上出现，`run/status/cancel/core` 的返回对象字段集合一个都不变；`main` 的 `options` 仍为 `{cwd, now, out, createClient}`，注入点不变（`cli-assets.test.js` 直接 import 用）。
- **约束**：`COMMANDS` 由 `{'run','status','cancel','core','role'}` 增 `skill`/`workflow`；`ROLE_SUBS` 扩到 8 条并新增 `SKILL_SUBS`（6）/ `WORKFLOW_SUBS`（6）；`VALUE_FLAGS` 增 `from/name/artifact-type/side-effect/summary/skills/tools/wake-allow/max-concurrent/set/unset/out/against/body-file/applies-to/commands`；新增 `REPEATABLE_FLAGS`（`set`/`unset`，解析成数组）与 `BOOLEAN_FLAGS` 增 `force`；按 D-6 的 18 行表逐子命令落 `ROLE_FLAGS`/`SKILL_FLAGS`/`WORKFLOW_FLAGS` 白名单；白名单检查放解析**之后**；`role create` 两档必填顺序固定；`--force` 出现在三族之外仍是 `未知参数：--force`；零中文、零资产名；`run` 预检两步（模板名 `getGraph` + 注册表 `loadRegistry`）与 `未知模板：<名字>` 文案不变（AC-47 / `test/wp6/main.test.js:247` 不改）。归 WP-5 唯一所有，WP-6/7/8 通过「统一 `xxxCommand` 签名 + 白名单结构」契约调用，不各自来改。

### 2.6 `src/cli/labels.js`（改，WP-5）——中文唯一来源、共享文件唯一负责人

- **导出签名（保持 + 新增）**：`USAGE_LINES` 扩到 25 行（前 8 行逐字不动）；新增 `ROLE_REASON_TEXT`（7 条）、`WORKFLOW_REASON_TEXT`（19 条）、`CONDITION_LABEL`（`passed→判定通过` / `failed→判定不通过` / `human_approved→人工通过` / `human_rejected→人工驳回`）、`NODE_TYPE_LABEL`（`角色节点/人工节点/升级节点/子工作流`）、`WORKFLOW_CLI_TEXT`（list/show/validate/dry-run/diff 首句）、`SKILL_CLI_TEXT`、`DERIVED_NAME_TEMPLATE = '{base}（派生）'`。既有 `REGISTRY_ERROR`(14) / `YAML_DETAIL` / `ROLE_CLI_TEXT` / `showWake: '  可唤醒：{wake}'` 一个键都不加不改。
- **入参/出参**：全部为 `Object.freeze` 的常量表 / 字符串模板，由 `render.js` 与三族 CLI 用 `{name}` 占位替换读取。
- **约束**：`USAGE_LINES` 前 8 行与 I1.5 逐字一致（`:356` 守卫）；第 9~25 行逐条对应 17 条新命令（A-12）；所有新增中文只在此文件；`labels.js` 是 AC-51 第 3 条命令里**唯一合法持有资产名**的文件（故该条必须逐文件扫、不得整目录扫 `src/cli`）。归 WP-5 唯一所有。

### 2.7 `src/cli/render.js`（改，WP-5）——共享文件唯一负责人

- **导出签名（保持 + 新增）**：`renderUsage(message)` 保持（`[...USAGE_LINES, \`  （${message}）\`]`）；新增 `renderSkillList` / `renderSkillShow` / `renderSkillValidate` / `renderWorkflowList` / `renderWorkflowShow` / `renderWorkflowValidate` / `renderWorkflowDryRun` / `renderRoleDiff` / `renderWorkflowDiff`（具体行数与版式逐字取自 A-5~A-11）。既有 `renderRoleList` / `renderRoleShow` / `renderRoleInstanceLine` / `renderRoleValidate` 一个字符不动。
- **入参/出参**：入参为已经组装好的数据对象（counts / rows / workflow / nodes / edges / plan / changes），出参为 `string`（多行文本，行间 `\n`）；`--format json` 分支不经过这些函数，由 CLI 直接 `JSON.stringify`。
- **约束**：D-1 的 10 行边界表未列 `render.js`，但用户 §2 点名要求覆盖且其承载 A-5~A-11 的文本版式——裁决为「需扩三族渲染函数，归 WP-5 唯一负责人」（见 §8 冲突清单第 7 条；该扩权已由主控书面确认 = decisions.md 第十节**裁-9**：D-1 是最小文件集而非封闭清单，硬条件 = 中文仍只来自 `labels.js`、既有 `renderRoleShow()` / `renderRoleInstanceLine()` 的签名与输出逐字不变、不 import CLI 其它模块）；既有 I1.5 渲染函数逐字不动（D-8 / 裁-6 / AC-48）；文本模板字符串本身尽量别动，优先改传入变量值（模板 §5 第 8 条）。归 WP-5 唯一所有。

### 2.8 `src/registry/asset-write.js`（新增，WP-6）

- **导出签名**：`export function serializeRole(role)`；`export function serializeSkill(meta, body)`；`export function serializeWorkflow(workflow)`；`export async function atomicWrite({ target, text })`。
- **入参/出参**：`serializeRole` 入参为角色内存对象，出参为按 C-07 固定 key 顺序（`schema, id, name, group, summary, artifact_type, side_effect, derived_from, skills, tools, wake_allow, inputs, outputs, dispatchable, max_concurrent_sessions`）、只输出源对象里出现过的可选键、数组行内 `[a, b]`、空数组 `[]`、缩进 2 空格、注释不保留的 YAML 文本；`atomicWrite` 入参为 `{target: 绝对路径, text: 已序列化文本}`，成功返回 `{ok:true}`，失败返回 `{ok:false, code}` 且不改动目标、不留 `.tmp`。
- **约束**：只允许写 `.orch/roles/**`、`.orch/skills/**`、`.orch/workflows/**` 与显式 `--out` 指向的那一个文件；不得写 `assets/**`；零中文、零资产名；同目录临时文件 + `rename`；同目录占用快检在写锁之前、锁内复核（模板 §5 第 11 条）；`--force` 只覆盖不跳过校验（校验由调用方 `roles.js`/`skills.js`/`workflows.js` 在调 `atomicWrite` **之前**完成，C-03）。归 WP-6 唯一所有，WP-7/WP-8 通过签名契约调用。

### 2.9 `src/cli/roles.js`（改，WP-6）——共享文件唯一负责人

- **导出签名（保持 + 扩展）**：`export async function roleCommand(parsed, ctx)` 保持；`export function detailOf(err)` / `export function firstRegistryDetail(errors)` 保持；新增内部 `createRole` / `editRole` / `exportRole` / `importRole` / `diffRole`（不新增导出，经 `roleCommand` 分派）。
- **入参/出参**：`parsed` 同 WP-5 的 `parseArgs` 结果（`sub` 扩到 8 条、含 `flags.set`/`flags.unset` 数组）、`ctx = {cwd, out, createClient, now}`；出参 `Promise<number>`：0 成功 / 1 资产或目标不合法 / 2 用法错误 / 3 预检失败（沿用既有退出码语义）。
- **约束**：`toRoleJson()` 的 **10 键一个不加不改**（裁-7 / D-8 / AC-48:858）；`showRole` 的 `baseLines` 用 `wake: role.wakeAllow` 的方式不变（D-7b 只改输入值、不改代码结构）；`role validate` 接入 WP-2 的 `checkRoleContracts` 且**共用同一份输出与计数口径、不新增命令、不改版式**（BR-12 / AC-11）；契约连通需要的 workflows 由本文件调 `loadWorkflows` 得到、**不计入 `role validate` 的 26 资产计数**（R-4）；`--from` 继承字段集合按 D-4（不继承 `id`/`derived_from`）；内置只读判定用 `source === 'builtin'`；`role diff` 用本文件自己的 diff 函数（忽略 `id`、与 WP-8 的 workflow diff 不共用，F-02）；零中文、零资产名、不直读 `state.json`。归 WP-6 唯一所有。

### 2.10 `src/cli/skills.js`（新增，WP-7）

- **导出签名**：`export async function skillCommand(parsed, ctx)`。
- **入参/出参**：`parsed.sub ∈ {list, show, create, validate, export, import}`，`ctx` 同 WP-5；出参 `Promise<number>`（0/1/2/3 同 §2.9）。
- **约束**：`skill` 六条子命令；资产格式仍是 `skills/<id>/SKILL.md`（BR-15），`parseSkillFile(text)` 沿用不改；`skill create` 必填检查 `--name → --summary`（D-6），不给 `--body-file` 时用 A-7 逐字默认正文骨架；`skill validate` 沿用 I1.5 既有 4 原因码与版式、计数只算技能（BR-16）；写落盘一律走 WP-6 的 `atomicWrite`（契约调用，不碰该文件）；零中文、零资产名、不联网。归 WP-7 唯一所有。

### 2.11 `src/cli/workflows.js`（新增，WP-8）

- **导出签名**：`export async function workflowCommand(parsed, ctx)`。
- **入参/出参**：`parsed.sub ∈ {list, show, create, validate, diff, dry-run}`；出参 `Promise<number>`（0/1/2/3 同 §2.9）。
- **约束**：依赖 `registry/*`、`render`、`labels`、`templates/index.js`（**只取 `GRAPHS` 作只读基线，不改任何字段**，R-1 / C-10）；`dry-run` 只调 `planWorkflow` 纯函数、**不得直读 `state.json` / 连核心 / 起核心 / 建 `.orch/instances`**（C-12 / D-1 / AC-41）；`workflow diff` 用本文件自己的 diff 函数（忽略 `schema`/`id`/`name`、只比定义体，BR-37）；`workflow create --from` 复制全部结构与策略字段（B-06）；`workflow create` 落盘走 WP-6 的 `atomicWrite`；零中文、零资产名。归 WP-8 唯一所有。

### 2.12 `src/templates/index.js`（不改，边界守护 WP-3）

- **导出签名（保持）**：`GRAPHS = Object.freeze({ single, 'code-loop': codeLoop, 'task-loop': taskLoop })`（恰 3 键）、`getGraph(name)` / `defaultGraph()` / `ROLES` / `PROMPT_TEMPLATES` 等一律不动。
- **约束**：D-1「不得改动 `src/templates/index.js`（任何字段）」与 R-1 / `test/templates/task-loop.test.js:298-300`（`GRAPHS` 恰 3 键、`single`/`code-loop` 不得有 `productPolicy`）；WP-3 的 `projectBuiltinWorkflows` 与 WP-8 的 `create --from` / `diff` 只**读** `GRAPHS`，不写。唯一读取方按只读契约接入，边界守护归 WP-3（WP-8 经 WP-3 的投影结果间接使用，不直接改图）。

### 2.13 `src/registry/index.js`（不改，边界守护 WP-3）

- **导出签名（保持）**：`export function loadRegistry({ root, onlyRole = null, builtinRoot = null } = {})` → `{ ok, roles, skills, errors, counts }`；`counts = { assets: roles.length + skills.length + invalid, roles, skills, builtin, project, invalid }`（6 键）。
- **约束**：M-3 / D-1 / R-4 明确**不得改动**加载与计数、不得改报错顺序；`role validate` 的「26 资产」逐字基线（AC-15）与 `role list` 的 16 角色计数靠它守住；`test/wp11/registry.test.js` 不改且全绿。工作流加载另起 `workflows.js`（WP-3），计数两表独立、不得混用（C-11）。边界守护归 WP-3。

### 2.14 `src/registry/assets.js`（不改，边界守护 WP-3）

- **导出签名（保持）**：`assetsRoot()` / `builtinRolesDir()` / `builtinSkillsDir()` / `projectRolesDir(root)` / `projectSkillsDir(root)`。
- **约束**：D-1 的 10 行边界表未含本文件、10.12 决策已定「不新增 `projectWorkflowsDir(root)`」；`.orch/workflows` 路径由 `workflows.js` 内联 `path.join` 拼接；本文件零改动，避免 AC-45/46/58 的「既有文件不变」类断言扫到。边界守护归 WP-3。

### 2.15 `src/registry/yaml-lite.js`（不改，沿用，边界守护 WP-3）

- **导出签名（保持）**：`export function parseYaml(text)`（`:216`）。
- **约束**：D-2「沿用、不新增解析能力」；所有工作流 YAML 经它解析，禁用语法由 `workflows.js` 在解析前后按 D-2 拦；`YAML_PARSE_FAILED` 的 `{detail}` 由 `labels.js` 的 `YAML_DETAIL` 组装（I1.5 D-3 v5 口径不变）。边界守护归 WP-3。

### 2.16 `src/registry/role-schema.js`（不改，沿用，边界守护 WP-2）

- **导出签名（保持）**：`GROUPS` / `ARTIFACT_TYPES` / `SIDE_EFFECTS` / `ROLE_ID_PATTERN` / `ROLE_REQUIRED_KEYS` / `ROLE_OPTIONAL_KEYS` / `checkRoleShape(obj,{fileId})` / `checkSkillMeta(meta,{dirId})` / `SKILL_*` 常量。
- **约束**：M-4 的 `derived_from` 新可选键按「只校验出现过的键」天然兼容，**不需要改动本文件**；`coordinator` 在 `src/registry/**` 只允许出现在 `GROUPS` 一行（AC-51 第 2 条定点断言）；写命令与 `role validate` 共用 `checkRoleShape`（D-4），不另写判定。边界守护归 WP-2。

### 2.17 `src/registry/skill-file.js`（不改，沿用，边界守护 WP-7）

- **导出签名（保持）**：`export function parseSkillFile(text)`（`:25`）。
- **约束**：技能资产前置元数据 + 正文格式不变（BR-15）；`skill show` / `validate` / `import` 复用它，不新增解析器。边界守护归 WP-7。

### 2.18 `assets/roles/researcher.yaml` / `assets/roles/writer.yaml`（改，WP-6；D-7b 唯一例外）

- **「导出」/改动内容**：`researcher.yaml` 第 13 行 `wake_allow: []` → `wake_allow: [writer]`；`writer.yaml` 第 14~15 行 `wake_allow: [editor]` → `wake_allow: [editor, reviewer]`。
- **约束**：**只改 `wake_allow` 取值、不动任何字段结构、不动其它 14 个内置资产、不动 10 个技能**；发生在实现阶段由开发者改**仓库文件**，不是任何 CLI 命令的运行时行为（BR-01 / AC-46 / AC-58 的「内置只读」口径不变）；与 AC-61「验收期临时把 `writer.wake_allow` 改回 `[editor]` 验证变红、验完 `finally` 立即还原」的层次不可颠倒；AC-48 机检要比对 `git show 0cd113b:assets/...`，断言「差异恰好两处 `wake_allow`」。归 WP-6 唯一所有。

### 2.19 `test/wp11/cli-role.test.js`（改，WP-6；D-7a 只有两行）

- **改动内容**：`:354` `assert.equal(block.length, 9, 'eight usage lines plus the reason line');` 的 `9`→`26`、注释改 `twenty-five usage lines plus the reason line`；`:357` `assert.equal(USAGE_LINES.length, 8);` 的 `8`→`25`。
- **约束**：`:356` `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES]);` **逐字不得改动**（前 8 行逐字守卫，AC-43）；除这两行外 `test/**` 一个字符不许改；新增断言一律放 `test/wp12/`（D-10）。归 WP-6 唯一所有。

### 2.20 `test/wp12/` 八个文件（新增，按 WP 归属）

| 文件 | 归属 | 类型 | 契约内容 |
|---|---|---|---|
| `test/wp12/workflow-schema.test.js` | WP-1 | 纯函数（不碰磁盘） | 19 原因码常量、四类 `node_type`、边 `kind/when/join` 取值域、`checkWorkflowShape`/`checkNodeShape`/`checkEdgeShape` |
| `test/wp12/role-contracts.test.js` | WP-2 | 纯函数（内存对象） | `checkRoleContracts`：契约连通逐字段、权限闭环三固定句、派生链成环/缺失、7 个 `ROLE_*` 码 |
| `test/wp12/workflow-yaml.test.js` | WP-3 | `fs.mkdtemp(os.tmpdir())` | D-2 子集、`YAML_PARSE_FAILED` 1 基行号、内置投影 C-10、同名整体覆盖 BR-18 |
| `test/wp12/workflow-validate.test.js` | WP-3 | `fs.mkdtemp(os.tmpdir())` | C-09 ①~⑬ 顺序、D-3 判定、counts 4 键、errors 6 键、AC-61 三条内置 `invalid=0` 门禁 |
| `test/wp12/workflow-plan.test.js` | WP-4 | 纯函数（不碰磁盘） | 8 键计划、layers/branches/mappings/policies 子键、稳定排序、两次逐字节相同 |
| `test/wp12/cli-assets.test.js` | WP-5 | 直接 `import { main }` 注入 `out`/`cwd` | 25 行用法块、12 次用法错误矩阵、只读不建 `.orch`、写只写 `.orch`、退出码用返回值、不 spawn |
| `test/wp12/role-write.test.js` | WP-6 | `fs.mkdtemp(os.tmpdir())` | create/edit/export/import/diff、`--force`、原子写无 `.tmp`、派生继承、`role diff` 三行 |
| `test/wp12/skill-assets.test.js` | WP-7 | `fs.mkdtemp(os.tmpdir())` | skill 六命令、默认正文骨架、`skill validate` 两专属码、export/import 逐字节 |

> 8 文件按「纯函数 / IO / CLI 集成」分层，WP-1~WP-7 各带一份可独立跑的契约测试；WP-8（工作流命令族）不新增第 9 个文件，其命令层断言按能力落在上述既有 8 文件集合内（见 §4 WP-8 与 §6/§7 说明），符合 D-10「8 个文件」的唯一清单。

## 3. 数据模型

> **唯一事实来源（三类，逐样例标注）**：① **资产文件** `<root>/.orch/workflows/<id>.yaml`（用户可写、唯一持久化事实）；② **只读投影** `src/templates/index.js` 的 `GRAPHS` → 内存 workflow 形状（不落盘、不参与写命令、参与全部六项校验含唤醒权限，C-10 / 裁-2）；③ **内存计划** `planWorkflow` 的输出（不落盘、不写实例、两次逐字节相同，C-12）。`state.json` / `src/core/**` / `src/daemon/**` 本迭代零触碰。

### 3.1 `workflow/v1` 完整 YAML 样例（唯一事实来源：资产文件，逐字取自 A-1 / A-13 夹具 `doc-fanout`）

```yaml
schema: workflow/v1
id: doc-fanout
name: 文档并行版
summary: 研究后两人并行撰写，汇总后人工确认
entry: T-001
terminal: T-006
nodes:
  - id: T-001
    node_type: role
    role: researcher
    title: 研究
    timeout: 600
    retry: 2
    outputs: [research.notes]
  - id: T-002
    node_type: role
    role: writer
    title: 撰写A
    parallel_scope: draft
    scope: draft-a
    inputs: [brief]
  - id: T-003
    node_type: role
    role: editor
    title: 撰写B
    parallel_scope: draft
    scope: draft-b
    inputs: [brief]
  - id: T-004
    node_type: human
    title: 人工确认
  - id: T-005
    node_type: escalate
    title: 升级
  - id: T-006
    node_type: subworkflow
    workflow: code-loop
    title: 代码闭环
edges:
  - from: T-001
    to: T-002
    map:
      - from: T-001.research.notes
        to: brief
  - from: T-001
    to: T-003
    map:
      - from: T-001.research.notes
        to: brief
  - from: T-002
    to: T-004
  - from: T-003
    to: T-004
  - from: T-004
    to: T-006
    when: human_approved
  - from: T-004
    to: T-005
    when: human_rejected
  - from: T-006
    to: T-005
    when: failed
```

字段口径（A-1 / D-2）：必填 `schema`(固定 `workflow/v1`)/`id`/`name`/`entry`/`terminal`/`nodes`（非空）；可选 `summary`/`edges`。节点必填 `id`+`node_type`，按类型追加 `role`→`role`、`human`/`escalate`→`title`、`subworkflow`→`workflow`；节点可选 `title`/`timeout`(1~86400)/`retry`(0~5)/`max_rounds`(1~9)/`parallel_scope`/`scope`(缺省=节点 id)/`inputs`/`outputs`。边必填 `from`/`to`，可选 `kind`(forward/backflow/retest，缺省 forward)/`when`(always/passed/failed/human_approved/human_rejected，缺省 always)/`join`(all/any，缺省 all)/`map`(`{from,to}` 列表)。`join` 决定 fan-in 汇合条件，`dry-run` 并行组层行显示 ` · 汇合：all|any`。四类 `node_type`、并行组（`parallel_scope: draft` + `scope: draft-a/draft-b`）、条件分支（`when`）、子工作流（`workflow: code-loop`）、超时/重试（`timeout: 600`/`retry: 2`）、字段映射（`map`）全部在本样例内可表达。

### 3.2 补充样例：`backflow` 与 `max_rounds`（唯一事实来源：只读投影，取自 A-8:1273 的 `workflow show code-loop` 与 C-10）

A-13 夹具不含回边；回流边与轮次上限由内置 `code-loop` 只读投影承载（AC-22 / AC-33 / AC-63）：

```yaml
# 说明性片段（不是落盘资产）：code-loop 投影出的节点与回边形状
nodes:
  - id: T-001
    node_type: role
    role: developer
    title: 开发
  - id: T-002
    node_type: role
    role: tester
    title: 测试
    max_rounds: 2
edges:
  - from: T-001
    to: T-002
    kind: forward
  - from: T-002
    to: T-001
    kind: backflow        # 回边：to 节点必须有 max_rounds，缺则 WORKFLOW_BACKFLOW_NO_LIMIT
  - from: T-001
    to: T-002
    kind: retest          # 控制流边：⑪ 不携带产物映射、⑫ 目标必须是 role 节点
```

`workflow show code-loop` 文本逐字对应 `T-002 → T-001 回流 · 轮次上限 2`（A-8:1273）。D-3 的 ⑨ 要求「存在 `kind: backflow` 的边时其 `to` 节点必须有 `max_rounds`」；⑪ 写死 `backflow`/`retest` 控制流边豁免（不携带产物映射）；⑬ 唤醒权限只检查 `kind: forward` 的边。

### 3.3 `workflow validate --format json` 的 counts 与 errors（唯一事实来源：`loadWorkflows` 内存结果）

**全通过**（A-9 / A-14：`workflow validate` 顶层恰 2 键、counts 恰 4 键、文本一行 `校验工作流 3 个：全部通过`）：

```json
{
  "counts": { "assets": 3, "builtin": 3, "project": 0, "invalid": 0 },
  "errors": []
}
```

**有坏资产**（A-9 的 `校验工作流 5 个：2 个不合法` 对应；内置以「内置 」前缀参与排序）：

```json
{
  "counts": { "assets": 5, "builtin": 3, "project": 2, "invalid": 2 },
  "errors": [
    {
      "code": "WORKFLOW_NODE_TYPE_INVALID",
      "file": "workflows/bad-type.yaml",
      "scope": "workflow",
      "field": "node_type",
      "line": null,
      "params": { "value": "script" }
    },
    {
      "code": "WORKFLOW_WAKE_DENIED",
      "file": "内置 wake",
      "scope": "workflow",
      "field": null,
      "line": null,
      "params": { "from": "writer", "to": "reviewer" }
    }
  ]
}
```

`errors[]` 每项恰 **6 键** `{code, file, scope, field, line, params}`（沿用 `src/registry/index.js:61-70` 的 `makeError`，`scope` 恒为 `'workflow'`），与 `role validate` 的 `counts` 6 键 / `errors` 6 键口径各自独立、不得混用（C-11 / R-4）。文本行 `- <相对路径>：<明细>（<原因码>）`，项目写 `workflows/<id>.yaml`、内置写 `内置 <id>`（A-9）。

### 3.4 `workflow dry-run --format json` 的 `layers/branches/mappings/policies`（唯一事实来源：内存计划 `planWorkflow`）

```json
{
  "id": "doc-fanout",
  "name": "文档并行版",
  "nodeCount": 6,
  "edgeCount": 7,
  "layers": [
    { "parallel": false, "nodes": ["T-001"] },
    { "parallel": true,  "nodes": ["T-002", "T-003"] },
    { "parallel": false, "nodes": ["T-004"] },
    { "parallel": false, "nodes": ["T-006"] },
    { "parallel": false, "nodes": ["T-005"] }
  ],
  "branches": [
    { "from": "T-004", "to": "T-006", "when": "human_approved" },
    { "from": "T-004", "to": "T-005", "when": "human_rejected" },
    { "from": "T-006", "to": "T-005", "when": "failed" }
  ],
  "mappings": [
    { "from": "T-001.research.notes", "to": "brief", "edge": "T-001→T-002" },
    { "from": "T-001.research.notes", "to": "brief", "edge": "T-001→T-003" }
  ],
  "policies": [
    { "nodeId": "T-001", "timeout": 600, "retry": 2 }
  ]
}
```

顶层恰 8 键；不含 `warnings` 时不输出该键；`layers[]` 恰 2 键 `parallel`/`nodes`、`branches[]` 恰 3 键 `from`/`to`/`when`、`mappings[]` 恰 3 键 `from`/`to`/`edge`、`policies[]` 恰 3 键 `nodeId`/`timeout`/`retry`（A-14）。文本通道逐字按 A-10：首行 `编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流`、并行组层行段尾固定 ` · 汇合：all`、三段小标题 `条件分支：`/`字段映射：`/`超时与重试：`（空段连标题不打印）、末行 `结论：编排可执行，未启动任何会话`。

### 3.5 `role diff` / `workflow diff` 的 `changes[]`（唯一事实来源：两个命令各自的内存比对结果，不落盘）

`role diff --format json`（A-14：顶层恰 3 键 `base`/`target`/`changes`，`changes[]` 恰 4 键 `field`/`kind`/`base`/`target`；忽略 `id`、`name` 与其余键全比，BR-11）：

```json
{
  "base": "developer",
  "target": "lead-dev",
  "changes": [
    { "field": "derived_from", "kind": "added",   "base": null,                    "target": "developer" },
    { "field": "name",         "kind": "changed", "base": "开发",                 "target": "开发（派生）" },
    { "field": "skills",       "kind": "changed", "base": ["code-change", "test-run"], "target": ["test-run"] }
  ]
}
```

文本通道逐字按 A-5：`+ derived_from：developer` / `~ name：开发 → 开发（派生）` / `~ skills：code-change, test-run → test-run` / `差异 3 项`；数组按 `a, b` 拼接、空数组与 `null` 写 `—`、一致时第 2 行 `无差异`。

`workflow diff --format json`（A-11 / BR-37：忽略 `schema`/`id`/`name`、只比定义体、`changes[].field` 用 `nodes[0].title` 字段路径写法）：

```json
{
  "base": "code-loop",
  "target": "fork",
  "changes": [
    { "field": "nodes[0].title", "kind": "changed", "base": "开发", "target": "开发（改）" }
  ]
}
```

文本通道逐字按 A-11：`~ nodes[0].title：开发 → 开发（改）` / `差异 1 项`；一致时 `无差异`；缺基线时 `缺少对比基线：<id>（用 --against 指定内置工作流或文件）`、退出 1。**两套 diff 口径不可串用**（F-02 / G-02 / §1.10 #16）。

### 3.6 异常态样例（唯一事实来源：命令终端输出 + 资产文件，均不落新盘）

**① 校验失败（A-9，退出 1，不写文件）**

```
校验工作流 5 个：2 个不合法
- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）
- 内置 wake：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）
```

`role create` 被拒只印一行 `创建被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）`（A-2）；`skill create` 空正文退 1 且不落盘（AC-59）；`import` 被拒 `导入被拒：<明细>（<原因码>）` / `导入被拒：文件不存在：<路径>`（A-4）。

**② 资产只读（A-3 / A-2，退出 1，`assets/**` sha256 不变）**

```
内置角色不可编辑：先 orch role create <新角色> --from developer
```

冒名内置 id 的 `skill create code-change`、`role import` 内置 id、`--force` 一律 `ASSET_READONLY`（AC-58）；命令级失败码只决定首句与退出码，不进资产错误表（C-13）。

**③ `--force` 覆盖失败 / 覆盖不合法内容仍被拒（C-05 / AC-40 第三段）**

```
已存在同名项目工作流：.orch/workflows/fork.yaml（加 --force 覆盖）
```

把 `fork.yaml` 换成不合法内容再带 `--force`：

```
创建被拒：<明细>（<原因码>）
```

`assets/**` 与 `git status` 不变、目标文件内容保持上一次合法值、无 `*.tmp` 残留（NFR-05）。`workflow dry-run` 对不合法工作流：`预演被拒：<第一条明细>（<原因码>）` + `执行 orch workflow validate 查看全部问题`、无编排计划行、不建实例、退出 1（A-10 / AC-42）。

## 4. 工作包拆分（WP-1 ~ WP-8，文件互不重叠）

> 8 个 WP 按**能力**切（不按目录切）；每个 WP 固定五字段：`负责文件（k）逐条列 / 依赖 / 交付 / 验收口径 / 可否并行 + 一句话原因`。同一文件只属于一个 WP；共享文件 `src/cli/main.js`、`src/cli/labels.js`、`src/cli/render.js`、`src/cli/roles.js` 均指定唯一负责人，其它包通过 §2 的签名契约调用、不各自去改。依赖成 DAG；每包自带契约测试，缺字段时按契约兼容缺省（§1.4 规则 2）。**所有 AC 的「验收口径」= 需求 v7 §3.1 同号 Then 的逐字口径，本文档只登记 AC 编号、测试文件与逐字断言锚点，不复制、不改写、不合并、不放宽任何 Then。**

### WP-1 工作流字段契约内核（依赖：无）

- **负责文件（2）**：`src/registry/workflow-schema.js`、`test/wp12/workflow-schema.test.js`
- **依赖**：无（纯函数内核，契约先冻结后可最先开工）
- **交付**：`WORKFLOW_SCHEMA_VERSION`、`NODE_TYPES`（4 值）、`EDGE_KINDS`（3 值）、`WHEN_VALUES`（5 值）、`JOIN_VALUES`（2 值）、`WORKFLOW_REASONS`（19 个 `WORKFLOW_*` 常量逐字等于 A-15）、`checkWorkflowShape(obj,{fileId})`、`checkNodeShape(node)`、`checkEdgeShape(edge)`；`timeout`/`retry`/`max_rounds` 取值域常量
- **验收口径**：AC-22、AC-24~AC-26、AC-62、AC-63、AC-64 的形状/取值域部分；测试文件 `workflow-schema.test.js`（纯内存对象、不碰磁盘）；逐字断言锚点：`节点类型取值非法：{value}；合法取值：role / human / escalate / subworkflow`（A-15 `WORKFLOW_NODE_TYPE_INVALID`）、`超时取值非法：{value}；合法范围：1~86400 的整数`、`重试取值非法：{value}；合法范围：0~5 的整数`；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 零 IO、零中文、零资产名、不依赖任何下游文件，是 DAG 的叶子

### WP-2 角色契约校验纯函数（依赖：WP-1）

- **负责文件（2）**：`src/registry/contracts.js`、`test/wp12/role-contracts.test.js`
- **依赖**：WP-1（复用 `workflow-schema.js` 的形状与常量契约；缺字段按兼容缺省）
- **交付**：`checkRoleContracts({roles, workflows})`，产出 7 个 `ROLE_*` 原因码（A-15）；契约连通逐字段判（BR-13）、权限闭环三固定句（BR-14）、派生链成环/缺失（BR-06）；C-08 ①~⑪ 顺序；`workflows` 缺省按空数组兼容
- **验收口径**：AC-11、AC-12、AC-13、AC-14、AC-15、AC-53、AC-05（技能引用变化后 `validate` 仍全通过）；测试文件 `role-contracts.test.js`（内存对象）；逐字断言锚点：`契约不连通：{field} 没有{side}`、`副作用等级为 read 的角色不能带写工具 {tool}`、`唤醒白名单里的角色不存在：{role}`、`唤醒白名单不能包含自己：{role}`、`派生来源不存在：{role}`、`派生链成环：{chain}`、一次 `role validate --format json` 报出五专属码且计数 `31/16/10/invalid 5`（AC-11）；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 只依赖 WP-1 已冻结的纯函数契约，用内存 fixture 独立跑

### WP-3 工作流加载 / 内置投影 / 校验顺序编排（依赖：WP-1）

- **负责文件（3）**：`src/registry/workflows.js`、`test/wp12/workflow-yaml.test.js`、`test/wp12/workflow-validate.test.js`
- **依赖**：WP-1（形状与 19 原因码常量）
- **交付**：`projectBuiltinWorkflows(builtinGraphs)`（C-10 只读投影、source='builtin'、file=null）、`loadWorkflows({root, builtinGraphs})` → `{ok, workflows, workflowMap, errors, counts}`、`WORKFLOW_CHECK_ORDER`（C-09 ①~⑬）；D-3 判定口径逐条写死（可达性终态含 human/escalate、回边 `max_rounds`、并行 scope、`map.from` 正则、⑪ 控制流边豁免、⑫ 状态转换、⑬ 唤醒权限含三条内置图）；counts 4 键；errors 6 键且排序固定；`src/registry/index.js` / `assets.js` / `yaml-lite.js` / `src/templates/index.js` 的「不改」边界由本包守护（§2.12~2.15）
- **验收口径**：AC-21、AC-23、AC-24、AC-31~AC-38、AC-60、AC-61、AC-62、AC-64、AC-65；测试文件 `workflow-yaml.test.js`、`workflow-validate.test.js`（`fs.mkdtemp(os.tmpdir())`，项目根绝不放仓库内）；逐字断言锚点：`校验工作流 3 个：全部通过`、`校验工作流 5 个：2 个不合法`、`节点不可达：{node}`、`回流目标缺少轮次上限：{node}`、`并行组 {scope} 只有 1 个节点`、`变量引用无法解析：{ref}`、`{node} 的输入 {field} 没有来源`、`升级节点 {node} 不能有正向出边`、`唤醒不在白名单内：{from} → {to}`、两次 `validate --format json` 逐字节相同（AC-65）、三条内置图 `invalid=0`（AC-61）；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 只依赖 WP-1；用内存 `builtinGraphs` 与临时项目根独立跑，不依赖 CLI 层是否写完

### WP-4 dry-run 编排计划纯函数（依赖：WP-1）

- **负责文件（2）**：`src/registry/workflow-plan.js`、`test/wp12/workflow-plan.test.js`
- **依赖**：WP-1（形状契约）
- **交付**：`planWorkflow({workflow, task})` 8 键计划（§3.4）；D-5 的 6 步与稳定排序键；不读实例、不看时钟、不联网、不写文件
- **验收口径**：AC-27、AC-28、AC-29、AC-30、AC-41、AC-42、AC-63；测试文件 `workflow-plan.test.js`（纯内存对象、不碰磁盘）；逐字断言锚点：`编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流`、并行组层行 ` · 汇合：all`、`branches` 三元素 `{from,to,when}` 且 when 集合固定、`mappings` 两元素恰 3 键且首条 `from` 逐字、`policies` 段、末行 `结论：编排可执行，未启动任何会话`、两次 stdout 逐字节相同（AC-41）、不建 `instances/` 与 `core.json`（AC-41）；按各 AC 同号 Then 逐字判定
- **可否并行**：可 —— 纯函数，与 WP-2/WP-3 无共享文件

### WP-5 CLI 三族接线与文案基座（依赖：无，共享文件唯一负责人）

- **负责文件（4）**：`src/cli/main.js`、`src/cli/labels.js`、`src/cli/render.js`、`test/wp12/cli-assets.test.js`（`render.js` 超出 D-1 十行表已由主控裁-9 扩权确认，硬条件见 §2.7 与 decisions.md 第十节）
- **依赖**：无（骨架先冻结，WP-6/7/8 通过签名契约调用）
- **交付**：`COMMANDS` 增 `skill`/`workflow`、`ROLE_SUBS` 扩到 8、`SKILL_SUBS`/`WORKFLOW_SUBS`（各 6）、`VALUE_FLAGS`/`BOOLEAN_FLAGS`/`REPEATABLE_FLAGS` 扩展、按 D-6 的 18 行逐子命令白名单、`main()` 三族分派、`USAGE_LINES` 25 行（前 8 行逐字）、`ROLE_REASON_TEXT`(7)/`WORKFLOW_REASON_TEXT`(19)/`CONDITION_LABEL`/`NODE_TYPE_LABEL`/三族 CLI 文案/派生名模板、三族渲染函数（§2.7）；`run` 预检与 `未知模板：<名字>` 文案不变
- **验收口径**：AC-02、AC-43、AC-44、AC-45、AC-46、AC-47、AC-49、AC-50、AC-51、AC-52、AC-54、AC-56、AC-59（用法/白名单/门禁部分）；测试文件 `cli-assets.test.js`（直接 `import { main }` 注入 `out`/`cwd`、不 spawn、退出码用返回值）；逐字断言锚点：用法块 25 行、`USAGE_LINES.slice(0,8)` 与 I1.5 逐字一致、整块 26 行、三族 × 四类共 12 次都退 2 且原因文案各不同（AC-44）、`未知参数：--nope` 与 `--<键> 不适用于 <族> <子命令>` 两句不同、`未知模板：doc-fanout` 退 1（AC-47）、`fail === 0 && pass === tests && tests >= 611`（AC-50）、四条架构命令全退 0（AC-51）、`dependencies` 键数 0（AC-52）、三条主链归一化后与 `0cd113b` 逐字一致（AC-49）；按各 AC 同号 Then 逐字判定
- **可否并行**：可（但必须先开工）—— 它是 `main.js`/`labels.js`/`render.js` 的唯一负责人，三个共享文件的结构先冻结，WP-6/7/8 才能按契约接线

### WP-6 角色资产写入（原子写 + 8 子命令 + D-7b 资产对齐 + D-7a 两行授权）（依赖：WP-1 + WP-2 + WP-3 + WP-5）

- **负责文件（6）**：`src/registry/asset-write.js`、`src/cli/roles.js`、`assets/roles/researcher.yaml`、`assets/roles/writer.yaml`、`test/wp11/cli-role.test.js`、`test/wp12/role-write.test.js`
- **依赖**：WP-1（形状）、WP-2（`checkRoleContracts`）、WP-3（`loadWorkflows` 供契约连通，不改 `loadRegistry` 计数）、WP-5（白名单/文案/`renderRoleDiff`）
- **交付**：`serializeRole`/`serializeSkill`/`serializeWorkflow`/`atomicWrite`（C-07 序列化 + C-04 原子写 + 三落点白名单）；`roleCommand` 扩到 8 条子命令 create/edit/export/import/diff；`role validate` 接入五项且共用同一输出与计数口径；`role diff` 独立 diff 函数；D-7b 两处 `wake_allow` 对齐；D-7a 两行授权（`:354` 9→26、`:357` 8→25，`:356` 不动）；`toRoleJson()` 10 键不加不改
- **验收口径**：AC-01~AC-10、AC-15、AC-48、AC-53~AC-58、AC-57（角色 diff 部分）；测试文件 `role-write.test.js`（`fs.mkdtemp`）+ `test/wp11/cli-role.test.js` 既有断言全绿（仅两行授权改动）；逐字断言锚点：`已创建项目角色：.orch/roles/lead-dev.yaml` 三行、`已存在同名项目角色：...（加 --force 覆盖）`、`创建被拒：<明细>（<原因码>）`、`（已按规范格式重写，注释不保留）`（A-3）、`+ derived_from：developer` / `~ name：开发 → 开发（派生）` / `~ skills：...` / `差异 3 项`（A-5/AC-10）、`  可唤醒：writer` / `  可唤醒：editor, reviewer`（D-7b，AC-48 唯一例外两行）、`校验资产 26 个：全部通过（角色 16 · 技能 10）`（AC-15）、两条 JSON 仍 `toRoleJson()` 10 键不含 `wake`/`wakeAllow`（AC-48:858）；按各 AC 同号 Then 逐字判定
- **可否并行**：否 —— 强依赖 WP-5 的白名单与用法块逐行对应，且 `roles.js` 是 I1.5 逐字回归（AC-48）与新增命令的共用文件，须在 WP-5 冻结后单线改动

### WP-7 技能命令族（依赖：WP-5 + WP-6）

- **负责文件（2）**：`src/cli/skills.js`、`test/wp12/skill-assets.test.js`
- **依赖**：WP-5（白名单/文案/渲染）、WP-6（`asset-write` 序列化与原子写签名契约）
- **交付**：`skillCommand(parsed, ctx)` 六条子命令 list/show/create/validate/export/import；`skill create` 必填 `--name → --summary`；不给 `--body-file` 时 A-7 逐字默认正文骨架；`skill validate` 沿用 I1.5 既有 4 原因码与版式、计数只算技能
- **验收口径**：AC-16、AC-17、AC-18、AC-19、AC-20、AC-58、AC-59；测试文件 `skill-assets.test.js`（`fs.mkdtemp`）；逐字断言锚点：`技能 10 个（内置 10 · 项目 0）`、行格式 `- <id> <名称> · <适用组|—> · 命令 <n>`、`### 工作方法`（show 第 7 行 / create 默认正文）、`已创建项目技能：.orch/skills/quote/SKILL.md`、`校验技能 <N> 个：全部通过` / `<M> 个不合法`、`内置 9 · 项目 1`（AC-20）、`skill create` 坏组退 2 / 缺摘要退 2 / 空正文退 1 且不落盘（AC-59）；按各 AC 同号 Then 逐字判定
- **可否并行**：可（与 WP-8 同批）—— 只通过签名契约依赖 WP-6 的 `atomicWrite`，与 WP-8 无共享文件

### WP-8 工作流命令族（依赖：WP-1 + WP-2 + WP-3 + WP-4 + WP-5 + WP-6）

- **负责文件（1）**：`src/cli/workflows.js`
- **依赖**：WP-1（形状）、WP-2（契约）、WP-3（`loadWorkflows`）、WP-4（`planWorkflow`）、WP-5（白名单/文案/渲染）、WP-6（`asset-write`）
- **交付**：`workflowCommand(parsed, ctx)` 六条子命令 list/show/create/validate/diff/dry-run；`workflow diff` 独立 diff 函数（只比定义体，BR-37）；`dry-run` 只调 `planWorkflow` 纯函数；`workflow create --from` 复制全部结构与策略字段（B-06）；只取 `GRAPHS` 作只读基线、不改任何字段
- **验收口径**：AC-21、AC-22、AC-23、AC-38、AC-39、AC-40、AC-41、AC-42、AC-45、AC-46、AC-47、AC-57、AC-63 的命令层部分；**自带契约测试**：本包不新增第 9 个测试文件——D-10 的 8 个文件是唯一新增测试集合，workflow 命令层断言按能力落在既有集合内（list/show/validate/dry-run/diff 的 JSON 与文本双通道由 `workflow-validate.test.js` 与 `cli-assets.test.js` 承载，详见 §5/§6），本包独立验收靠此命令（下方「独立验收命令（裁-10）」），不依赖下游 WP 已写完（缺字段按契约兼容缺省）——以内存 stub 独立跑命令层、不新增第 9 个测试文件；逐字断言锚点：`工作流 3 个（内置 3 · 项目 0）`、`- code-loop 编码闭环 · 2 节点 · 3 边 · 内置`、`  入口：T-001 · 终点：T-002`、`校验工作流 3 个：全部通过`、`~ nodes[0].title：开发 → 开发（改）` / `差异 1 项`、`已创建项目工作流：.orch/workflows/fork.yaml`、`预演被拒：<第一条明细>（<原因码>）`；按各 AC 同号 Then 逐字判定
- **可否并行**：否 —— 依赖全部 registry 层与骨架层就绪，是 DAG 的汇合点，末批单线合入
- **独立验收命令（裁-10）**：本包不新增第 9 个测试文件（decisions.md 第十节裁-10：接受现有分工，不改文件零交集），独立验收靠下面两条可直接复制的命令——① 跑 D-10 第 8 文件承载的命令层断言；② 内联 `import { workflowCommand }` 命令层冒烟，`cwd` 指向 `%TEMP%` 独立项目根、`out` 注入数组、不 spawn 进程、不启核心（D-10:1683 同口径）。**不依赖下游 WP 已写完**（缺字段按契约兼容缺省）：实现落地前实跑两条均得「模块尚未实现」退出 1（`Could not find 'test/wp12/cli-assets.test.js'` / `ERR_MODULE_NOT_FOUND: ...src/cli/workflows.js`，实跑记录见 §8 处置段），实现落地后预期两条均退出 0、② 输出以 `工作流 3 个（内置 3 · 项目 0）` 起头：

```bash
cd /d/WWW/Maestro
# ① D-10 第 8 文件的命令层契约断言
node --test test/wp12/cli-assets.test.js
# ② 内联命令层冒烟：list 子命令 + 内存 stub ctx（缺字段按契约兼容缺省）
WP8_ROOT="$TEMP/i16-smoke/wp8-root"; mkdir -p "$WP8_ROOT"
node --input-type=module -e "
import { workflowCommand } from './src/cli/workflows.js';
const out = [];
const code = await workflowCommand(
  { sub: 'list', flags: {}, positional: [] },
  { cwd: process.argv[1], out: (s) => out.push(String(s)), createClient: null, now: () => 0 }
);
console.log(out.join('\n'));
process.exit(code === 0 ? 0 : 1);
" "$WP8_ROOT"
```

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-6 | WP-5 | 命令面 · 从零建角色三行输出 + JSON source=project |
| AC-02 | WP-5 | WP-6 | 命令面 · 两档必填顺序，缺一退 2 不建 .orch |
| AC-03 | WP-6 | WP-5 | 命令面 · 同名先拒 / --force 覆盖 |
| AC-04 | WP-6 | WP-1、WP-5 | 命令面 · --from 继承覆盖与「派生自」行（H-04 按机检补充理解） |
| AC-05 | WP-6 | WP-2 | 规划验收 · 派生改技能后 show/list/validate 三处可见变化 |
| AC-06 | WP-6 | WP-2 | 命令面 · 派生链成环 / 缺失两码，按文件名字典序 |
| AC-07 | WP-6 | — | 命令面 · export→import 带 derived_from 逐字节相同 |
| AC-08 | WP-6 | WP-2 | 命令面 · 导入两种情形都退 1、不落盘 |
| AC-09 | WP-6 | — | 命令面 · edit 规范化重写四行 / 内置不可编辑 |
| AC-10 | WP-6 | — | 命令面 · role diff 三行 + 差异 3 项 / 无差异 |
| AC-11 | WP-2 | WP-6 | 校验器面 · 五专属码一次报出、计数 31/16/10/invalid 5 |
| AC-12 | WP-2 | WP-6 | 校验器面 · 契约连通逐字段判 |
| AC-13 | WP-2 | — | 校验器面 · 权限闭环三固定句 |
| AC-14 | WP-2 | — | 校验器面 · 白名单悬空 / 自唤醒两码 |
| AC-15 | WP-6 | WP-2 | 回归与门禁面 · 26 内置资产逐字基线不变 |
| AC-16 | WP-7 | WP-5 | 命令面 · skill list 首行 + 10 行 + JSON 键集合 |
| AC-17 | WP-7 | — | 命令面 · skill show 六行元数据 + 正文 |
| AC-18 | WP-7 | WP-6 | 命令面 · skill create 三行 + 默认正文 |
| AC-19 | WP-7 | — | 命令面 · skill validate 两坏文件两专属码 |
| AC-20 | WP-7 | WP-6 | 命令面 · 技能 export→import 逐字节相同 |
| AC-21 | WP-8 | WP-3 | 命令面 · workflow list 三内置 + JSON 6 键 file:null |
| AC-22 | WP-8 | WP-1、WP-3 | 命令面 · workflow show 节点 11 键 nodeType / 回流轮次上限 2 |
| AC-23 | WP-8 | WP-3 | 命令面 · 同名项目整体覆盖内置 |
| AC-24 | WP-1 | WP-3 | 规划验收 · 四类 node_type 齐备校验通过（BR-35 终态） |
| AC-25 | WP-1 | WP-3 | 校验器面 · 非法 node_type 与类型必填字段被拒 |
| AC-26 | WP-1 | WP-3 | 校验器面 · 子工作流引用 ghost / 自引用成环两码 |
| AC-27 | WP-4 | WP-1、WP-8 | 校验器面 · 并行组在预演占同一层一行、汇合 all |
| AC-28 | WP-4 | WP-8 | 校验器面 · 三条件分支在预演逐条列出 |
| AC-29 | WP-4 | WP-1、WP-8 | 校验器面 · timeout/retry 合法与越界、策略行与 policies 段 |
| AC-30 | WP-4 | WP-8 | 校验器面 · 两字段映射、mappings 两元素恰 3 键 |
| AC-31 | WP-3 | WP-1 | 规划验收 · 契约不连通被拒（WORKFLOW_MAPPING_INCOMPLETE） |
| AC-32 | WP-3 | WP-1 | 校验器面 · 孤立节点 WORKFLOW_UNREACHABLE |
| AC-33 | WP-3 | WP-1 | 校验器面 · backflow 目标缺 max_rounds 被拒 |
| AC-34 | WP-3 | WP-1 | 校验器面 · 并行 scope 重复 / 组只剩 1 节点两码 |
| AC-35 | WP-3 | WP-1 | 校验器面 · map.from 指向非上游 WORKFLOW_VAR_UNKNOWN |
| AC-36 | WP-3 | WP-1 | 校验器面 · escalate 出边 / human 无条件 WORKFLOW_TRANSITION_ILLEGAL |
| AC-37 | WP-3 | WP-1、WP-6 | 校验器面 · writer 白名单不含 reviewer WORKFLOW_WAKE_DENIED |
| AC-38 | WP-8 | WP-3 | 命令面 · validate 文本与 JSON 一致、counts/errors 键集合 |
| AC-39 | WP-8 | — | 命令面 · workflow diff 一行 ~ nodes[0].title + 差异 1 项 / 无差异 |
| AC-40 | WP-8 | WP-6 | 命令面 · --from 生成 + --force 三段用例（不合法仍被拒 sha256 不变） |
| AC-41 | WP-4 | WP-8 | 规划验收 · dry-run 不建 instances/core.json、两次 stdout 逐字节相同 |
| AC-42 | WP-4 | WP-8 | 命令面 · 不合法工作流 dry-run 直接被拒、无计划行 |
| AC-43 | WP-5 | — | 命令面 · 用法块 25 行、前 8 行逐字、整块 26 行、退 2 |
| AC-44 | WP-5 | WP-7、WP-8 | 命令面 · 三族 × 四类共 12 次都退 2、原因文案各不同 |
| AC-45 | WP-5 | WP-7、WP-8 | 边界 · 十条只读命令不建 .orch、不连核心、sha256 清单一致 |
| AC-46 | WP-6 | WP-5、WP-8 | 边界 · 九条写命令只写三处 .orch 与显式 --out |
| AC-47 | WP-5 | WP-8 | 边界 · 项目工作流不能被 run 实例化、未知模板文案不变 |
| AC-48 | WP-6 | WP-5 | 回归 · role 三命令十形态逐字 + D-7b 两行唯一例外（H-02/H-03 处置见 §7） |
| AC-49 | WP-5 | WP-6 | 回归与门禁面 · 三条主链逐字回归（不改即不破坏） |
| AC-50 | WP-5 | WP-1~WP-8 | 回归与门禁面 · 全量测试下限断言 tests >= 611 |
| AC-51 | WP-5 | WP-1~WP-8 | 回归与门禁面 · 四条架构检查命令全退 0 |
| AC-52 | WP-5 | — | 回归与门禁面 · dependencies 键数 0 |
| AC-53 | WP-2 | WP-6 | 命令面 · 能力域 1 三项顺延、同文件多类各一行 |
| AC-54 | WP-5 | WP-6 | 异常路径 · role create 四必填取值非法三次退 2、不建文件 |
| AC-55 | WP-6 | WP-1 | 异常路径 · 导入非角色文件被拒、不落盘、total 仍 16 |
| AC-56 | WP-5 | WP-6 | 异常路径 · edit --set/--unset 用法错误不改动文件 |
| AC-57 | WP-6 | WP-8 | 异常路径 · 改不存在角色 / diff 缺基线 / --against 正向断言 |
| AC-58 | WP-6 | WP-7 | 异常路径 · 内置资产只读四种情形都不动 assets |
| AC-59 | WP-7 | WP-5 | 命令面 · skill create --applies-to/--commands/--body-file 与取值错误 |
| AC-60 | WP-1 | WP-3 | 校验器面 · 补充面变量/状态/唤醒/复测四项 |
| AC-61 | WP-3 | WP-6 | 校验器面 · 三条内置图 invalid=0、改坏 wake_allow 先红后立即还原 |
| AC-62 | WP-1 | WP-3 | 校验器面 · node_type 四类异常 + 子工作流环、errors[0] 确定 |
| AC-63 | WP-4 | WP-8、WP-3 | 回归与门禁面 · 11 项原语逐项可表达且逐项可见 |
| AC-64 | WP-3 | WP-1 | 校验器面 · human/escalate 天然终点合法、普通 role 无出边被拒 |
| AC-65 | WP-3 | WP-1 | 校验器面 · 校验顺序与错误排序固定、两次 JSON 逐字节相同 |

> 覆盖核对：AC-01~AC-65 连续编号、一行一条、无缺号无重复；每行至少一个主责 WP，跨包标协作 WP；合计 **65/65**。

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `docs/iterations/iteration-6.md` | 本拆分文档（8 节骨架 + 文件级契约 + WP + 65 条映射 + 自检摘要） | S1（本文件，唯一写入） |
| `src/registry/workflow-schema.js` | 工作流字段契约、19 原因码常量、节点/边形状检查 | WP-1 |
| `src/registry/contracts.js` | `checkRoleContracts` 角色契约五项纯函数 | WP-2 |
| `src/registry/workflows.js` | 加载 / 内置投影 / C-09 校验顺序 / counts | WP-3 |
| `src/registry/workflow-plan.js` | `planWorkflow` 8 键内存计划纯函数 | WP-4 |
| `src/cli/main.js` | COMMANDS / 白名单 / 17 命令接线 / run 预检不变 | WP-5 |
| `src/cli/labels.js` | 25 行 USAGE_LINES + 中文唯一来源 + 7+19 原因码 + 条件/类型标签 | WP-5 |
| `src/cli/render.js` | 三族文本渲染函数（既有 I1.5 渲染逐字不动） | WP-5 |
| `src/registry/asset-write.js` | 规范化序列化 + 原子写 + 三落点白名单 | WP-6 |
| `src/cli/roles.js` | role 8 子命令 + validate 五项接入 + role diff 独立口径 | WP-6 |
| `assets/roles/researcher.yaml` | `wake_allow: [] → [writer]`（D-7b 唯一例外） | WP-6 |
| `assets/roles/writer.yaml` | `wake_allow: [editor] → [editor, reviewer]`（D-7b 唯一例外） | WP-6 |
| `src/cli/skills.js` | skill 六条子命令 | WP-7 |
| `src/cli/workflows.js` | workflow 六条子命令（含 dry-run / diff / create --from） | WP-8 |
| `test/wp12/workflow-schema.test.js` | 纯函数形状/取值域契约测试 | WP-1 |
| `test/wp12/role-contracts.test.js` | 角色契约五项纯函数测试 | WP-2 |
| `test/wp12/workflow-yaml.test.js` | YAML 子集 / 投影 / 覆盖测试 | WP-3 |
| `test/wp12/workflow-validate.test.js` | C-09 顺序 / counts / AC-61 门禁测试 | WP-3 |
| `test/wp12/workflow-plan.test.js` | 8 键计划纯函数测试 | WP-4 |
| `test/wp12/cli-assets.test.js` | 直接 import main 的用法块 / 错误矩阵 / 落盘纪律测试 | WP-5 |
| `test/wp12/role-write.test.js` | 角色写命令 / --force / 原子写 / 派生测试 | WP-6 |
| `test/wp12/skill-assets.test.js` | 技能六命令测试 | WP-7 |
| `test/wp11/cli-role.test.js` | 仅 `:354`/`:357` 两行授权改动，`:356` 守卫不动 | WP-6（D-7a） |
| `src/registry/index.js` | 不改（loadRegistry 加载与计数边界） | 边界守护 WP-3 |
| `src/registry/assets.js` | 不改（不新增 projectWorkflowsDir） | 边界守护 WP-3 |
| `src/registry/yaml-lite.js` | 不改（沿用 parseYaml） | 边界守护 WP-3 |
| `src/registry/role-schema.js` | 不改（沿用 checkRoleShape / GROUPS） | 边界守护 WP-2 |
| `src/registry/skill-file.js` | 不改（沿用 parseSkillFile） | 边界守护 WP-7 |
| `src/templates/index.js` | 不改（GRAPHS 恰 3 键，只读投影源） | 边界守护 WP-3 |
| `src/cli/render.js`（既有 I1.5 函数） | 不改（renderRoleList/Show/InstanceLine/Validate 逐字） | WP-5 守护 |
| `test/fixtures/purity-check.mjs` | 沿用不改（--dirs / --files / --forbid，AC-51） | 夹具 · 不属于 WP |
| `test/fixtures/code-loop-driver.mjs` | 沿用不改（AC-49 主链，NODE_ENV=test） | 夹具 · 不属于 WP |
| `test/fixtures/task-loop-driver.mjs` | 沿用不改（AC-49 主链，NODE_ENV=test） | 夹具 · 不属于 WP |
| `test/fixtures/mock-acp-agent.js` | 沿用不改（AC-49 夹具） | 夹具 · 不属于 WP |
| `test/wp11/*.test.js`（其余 8 文件） | 既有断言零修改 | 既有 · 不属于 WP |
| `package.json` | 不改（`dependencies` 恒为 `{}`） | 既有 · 不属于 WP |
| `docs/iterations/iteration-6/requirement.md` v7 | 不改（唯一事实来源） | S0 定稿 |
| `docs/iterations/iteration-6/requirement-understanding.md` | 不改 | S0 产物 |
| `docs/iterations/iteration-6/review-round3.md` | 不改（第 3 轮 PASS） | S0 产物 |
| `docs/iterations/iteration-6/decisions.md` | S1 评审处置追加第十节（裁-8~裁-10）；S0 内容不改 | S0 产物 + S1 追加 |

> **S3 验收脚手架与项目根约定（不属于任何 WP 负责文件，由 S3 独立派单）**：四件套固定命名为 `probe/acc6-f-lib.mjs` / `probe/acc6-f-common.mjs` / `probe/acc6-f-run.mjs` / `probe/acc6-f-final.mjs`；用例目录 `probe/acc6-cases/`（**不带 `-f`**）、分片目录 `probe/acc6-f-parts/`；路径常量导出为 `ACC6_PATHS`；所有验收项目根统一 `%TEMP%/maestro-acc-p6/<AC 编号>/`，用 `fs.mkdtemp(os.tmpdir())` 造、绝不放仓库内。按用户硬约束，probe 脚本与验收用例**不写进任何 WP 的负责文件清单**，也不在本文档内实现。

## 6. 依赖与并行策略

**DAG（文本图，依赖编号全部存在且无环）**

```
WP-5 (CLI 骨架/白名单/文案，唯一负责人，先冻结)
  ├──> WP-6 (角色资产写入)  ──┬──> WP-7 (技能命令)
  ├──> WP-7 (技能命令)         └──> WP-8 (工作流命令)
  └──> WP-8 (工作流命令)              ▲
                                      │
WP-1 (workflow-schema 纯函数)          │
  ├──> WP-2 (contracts 纯函数) ────────┤
  ├──> WP-3 (workflows 加载/校验) ─────┤
  └──> WP-4 (workflow-plan 纯函数) ────┘

WP-2 ──> WP-6（role validate 五项接入）
WP-3 ──> WP-6（契约连通读工作流，不计入 26 资产）/ WP-8（list/show/validate/diff）
WP-4 ──> WP-8（dry-run）
WP-6 ──> WP-7 / WP-8（atomicWrite 签名契约）
```

叶子：WP-1、WP-5；汇合点：WP-8。无环，依赖编号 WP-1~WP-8 全部存在。

**分批顺序（一次最多 2 个 Agent）**

- **契约先冻结点（批次 0 之前，由本文档定死，不占 Agent 名额）**：见下方契约先冻结点清单。
- **第 1 批（1 Agent）**：WP-5 —— 骨架、白名单、`USAGE_LINES` 25 行、三族渲染函数先冻结，否则 WP-6/7/8 无法接线。
- **第 2 批（2 Agent 并行）**：WP-1 + WP-2 —— 两个零 IO 纯函数内核，互不依赖。
- **第 3 批（2 Agent 并行）**：WP-3 + WP-4 —— 依赖 WP-1 已冻结的形状契约；一个管加载/校验 IO，一个管预演纯函数。
- **第 4 批（2 Agent 并行）**：WP-6 + WP-7 —— 依赖 WP-5 骨架 + WP-1/2/3 结果；`roles.js` 单线改动（D-7b/ D-7a 同批），`skills.js` 通过 `atomicWrite` 签名契约并行。
- **第 5 批（1 Agent）**：WP-8 —— DAG 汇合点，依赖全部就绪，末批单线合入。

**契约先冻结点**（列出必须先定死的字段 / 返回结构，冻住后其余包可并行）：

1. `workflow/v1` 资产的键名与取值域：`schema/id/name/entry/terminal/nodes/edges`、`node_type` 四类、`kind/when/join` 取值域、`timeout`(1~86400)/`retry`(0~5)/`max_rounds`(1~9)（A-1 / D-2）。
2. **19 个 `WORKFLOW_*` + 7 个 `ROLE_*` 原因码常量名与明细模板**（A-15），逐字冻结；命令级 6 失败码单独一层（C-13）。
3. `loadWorkflows` 返回结构 `{ok, workflows, workflowMap, errors, counts}` 与 **counts 4 键** `{assets, builtin, project, invalid}`；`errors[]` 6 键 `{code, file, scope, field, line, params}`、`scope` 恒为 `'workflow'`（D-3 / A-14 / §2.3）。
4. `planWorkflow` 的 **8 键计划形状**与 `layers[]`(2 键)/`branches[]`(3 键)/`mappings[]`(3 键)/`policies[]`(3 键)（D-5 / A-14 / §3.4）。
5. `asset-write` 的**原子写契约**（同目录临时文件 + rename、失败不留 `.tmp`、只写三处 `.orch/**` 与显式 `--out`、`--force` 不跳过校验、序列化 key 顺序按 C-07）。
6. `main.js` 的**参数白名单结构**：`COMMANDS` / `ROLE_SUBS`·`SKILL_SUBS`·`WORKFLOW_SUBS` / `VALUE_FLAGS` / `BOOLEAN_FLAGS` / `REPEATABLE_FLAGS` / 按 D-6 的 18 行逐子命令 `*_FLAGS`；白名单检查放解析之后；两档必填顺序。
7. **用法块 25 行的前 8 行逐字**（A-12 / D-7a `:356` 守卫），后 17 行逐条对应 17 条命令。
8. 三族统一签名 `xxxCommand(parsed, ctx) -> Promise<number>` 与 `parsed` 的 `positional` 只在三族出现；`node_type`(YAML) / `nodeType`(JSON) 单点转换口径；`toRoleJson()` 10 键不变。

**整合检查点（每批合入后跑，给完整命令与预期数字）**

```bash
cd /d/WWW/Maestro

# 1) 全量测试（下限断言，不写死条数）
node --test --test-concurrency=4 "test/**/*.test.js"
#   预期：fail === 0 && pass === tests && tests >= 611

# 2) 架构纯净四条（D-9 逐字，AC-51）
COMMON="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
NOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"                                  # exit 0
node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"                                       # exit 0
node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"  # exit 0
node -e "const fs=require('fs'),p=require('path');const roots=['src/registry','src/cli/roles.js','src/cli/skills.js','src/cli/workflows.js'];const bad=[];const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(/[\u4e00-\u9fff]/.test(fs.readFileSync(d,'utf8')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join('\n'));process.exit(1);}console.log('OK: no CJK');"  # exit 0 / OK: no CJK

# 3) 零依赖（AC-52）
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"               # 输出 0

# 4) 三条主链冒烟（AC-49，$TEMP 独立根；场景名实跑自 scenarioNames() / taskScenarioNames()）
#    场景名取自 scenarioNames() / taskScenarioNames() 实跑值：pass / doc-pass（--help 复核）；任务文本为实值、无占位符
SMOKE="$TEMP/i16-smoke"
mkdir -p "$SMOKE"
CODE_TASK=$'给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js'
DOC_TASK=$'写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md'

# 4a) single：需求 AC-49:868「single 用 bin/orch.js run 直跑」；B 类零 DSH 走 mock 宿主
#     host 配置按 I1.5 收口同款（probe/acc5-cases/ac19.mjs 的 writeSingleHost；AC-19.single-baseline.txt 即此配置产出）：
#     .orch/hosts/dsh.json 指向 test/fixtures/mock-acp-agent.js --write-ref out/intro.md（launch.command 取 process.execPath），不接真实宿主面
SINGLE_ROOT="$SMOKE/single-$(date +%s)"   # 全新项目根：实例号从 INST-001 起算，与基线逐字可比
node -e "const fs=require('fs'),p=require('path');const root=process.argv[1];fs.mkdirSync(p.join(root,'work'),{recursive:true});fs.mkdirSync(p.join(root,'.orch','hosts'),{recursive:true});fs.writeFileSync(p.join(root,'.orch','hosts','dsh.json'),JSON.stringify({id:'dsh',transport:'stdio',launch:{command:process.execPath,args:[p.resolve('test/fixtures/mock-acp-agent.js'),'--write-ref','out/intro.md']},limits:{initializeTimeoutMs:15000,requestTimeoutMs:15000,promptTimeoutMs:30000,quietIdleMs:30,quietCapMs:200}},null,2)+'\n');" "$SINGLE_ROOT"   # 退出 0，写 mock host
(cd "$SINGLE_ROOT" && NODE_ENV=test node /d/WWW/Maestro/bin/orch.js run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md" --host dsh) > "$SMOKE/single.out" 2>&1   # 退出 0
(cd "$SINGLE_ROOT" && NODE_ENV=test node /d/WWW/Maestro/bin/orch.js core stop) > /dev/null 2>&1   # 退出 0；orch run 不自带 core stop，回收常驻核心

# 4b) code-loop / task-loop：driver 内部即 bin/orch.js run --host mock，NODE_ENV=test 注入；--task 实值与 driver DEFAULT_TASK 逐字一致
CODE_ROOT="$SMOKE/code-$(date +%s)"; TASK_ROOT="$SMOKE/task-$(date +%s)"   # 全新项目根，实例号与基线逐字可比
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$CODE_ROOT" --scenario pass --cwd "$CODE_ROOT/demo" --task "$CODE_TASK" --reset > "$SMOKE/code-loop.out" 2>&1   # 退出 0
NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root "$TASK_ROOT" --scenario doc-pass --cwd "$TASK_ROOT/demo" --task "$DOC_TASK" --reset > "$SMOKE/task-loop.out" 2>&1   # 退出 0

# 4c) 归一化后与 0cd113b 基线逐字 diff（AC-49:869 两条 sed 逐字）
#     基线文本：docs/iterations/iteration-5/evidence/AC-19.{single,code-loop,task-loop}-baseline.txt（I1.5 收口 0cd113b 同一命令输出，需求 AC-15:589）
#     基线重生成：git worktree add --detach "$SMOKE/base" 0cd113b（git -c core.autocrlf=false 避免 CRLF 干扰），在该树同参跑 4a/4b
#     比对前剔除夹具自述行（D-10:1685 / §7 #13）与 mock-sess 会话号 / 耗时 Ns 易变量（AC-19.meta.json notes）
norm() { sed -E 's/已运行 [0-9]+s//g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}//g' "$1" | sed -E 's/mock-sess-[0-9]+-[0-9]+/mock-sess-SESS/g; s/耗时 [0-9]+s/耗时 Ns/g' | grep -v '^{"ok":true' | tr -d '\r' | sed '/^$/d'; }
for c in single code-loop task-loop; do
  diff <(norm "docs/iterations/iteration-5/evidence/AC-19.$c-baseline.txt") <(norm "$SMOKE/$c.out")
done
#   预期：三份 diff 均为空（实跑 exit 0，见本节末「整合检查点实跑记录」）

# 5) 工作流门禁（AC-61）
node bin/orch.js workflow validate --format json
#   预期：counts.invalid === 0 && counts.assets === 3

# 6) 用法块与既有断言（AC-43 / D-7a）
node --test test/wp11/cli-role.test.js
#   预期：全绿；USAGE_LINES.length === 25；slice(0,8) 与 I1.5 逐字一致
```

每批合入后的预期数字汇总：**611 下限（只增不减）**、**0 个运行时依赖**、**invalid=0 / assets=3**、**25 行用法块 / 26 行带原因**、**65/65 AC**、**既有断言仅 2 行授权改动**、`assets/**` 差异恰好 **2 处 `wake_allow`**。第 4 批（WP-6 含 D-7b）合入后追加 `git show 0cd113b:assets/...` 逐文件比对；第 5 批（WP-8）合入后追加 AC-47 `未知模板：doc-fanout` 退 1 与 `dry-run` 两次 stdout 逐字节比对。

### 整合检查点实跑记录（本修订实跑，仓库根 `D:/WWW/Maestro`，Git Bash / Node v22.22.2）

> 第 1 组全量测试 / 第 2 组架构扫描 / 第 3 组零依赖 / 第 5、6 组为既有门禁复述，口径与命令未改、不在本轮修复面内（第 1 组全量约 70~180s，实现期按批合入复跑）；本轮实跑覆盖**第 4 组三条主链全部命令 + 4c 归一化 diff**，以及 WP-8 独立验收命令（裁-10，实现落地前不可全绿，如实登记）。

| 命令 | 实跑输出摘要 |
|---|---|
| 4a host 配置写入 | `node -e …dsh.json…` 退出 0；文件内容 `launch.args = [node.exe, …mock-acp-agent.js, --write-ref, out/intro.md]`（I1.5 收口同款，AC-19.single-baseline.txt 即此配置产出） |
| 4a single 直跑 | `orch.js run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md" --host dsh` **退出 0**；输出 11 行：`实例 INST-001 · 运行中`、`会话已创建 mock-sess-…`、`节点 已完成 · 耗时 1s`、交接包 HO-001 构造→投递→接受→完成，与基线同形；`core stop` 退出 0 |
| 4b code-loop | `--scenario pass --cwd <root>/demo --task "$CODE_TASK" --reset` **退出 0**；driver 收尾摘要 `state=completed`、`两节点 done`、`handoffs=1 forward` 三项 checks 全 ok |
| 4b task-loop | `--scenario doc-pass --cwd <root>/demo --task "$DOC_TASK" --reset` **退出 0**；T-001/T-002/T-003 全 completed（审核 通过）、HO-001/HO-002 已完成 |
| 4c 归一化 diff | 需求两条 `sed`（`已运行 Ns` / `HH:mm:ss`）+ 夹具自述行剔除（`{"ok":true,…}`）+ `mock-sess-<pid>-<n>` / `耗时 Ns` 易变量归一（授权依据 `AC-19.meta.json` notes），与 `docs/iterations/iteration-5/evidence/AC-19.{single,code-loop,task-loop}-baseline.txt`（`0cd113b` 同一命令输出）比对：**三份 diff 均为空（exit 0，0 行差异）** |

场景名为实跑取值（非照抄）：`scenarioNames()` 实跑 34 个（`pass` / `code-pass` / `backflow` / `rounds-exceeded` …）、`taskScenarioNames()` 实跑 29 个（`doc-pass` / `doc-backflow-once` / `doc-reject-twice` …）。实跑注意：项目根复用会使实例号递增为 `INST-002`、归一化后仍与基线差一行，故本组命令一律用**全新项目根**（`date +%s` 后缀，同需求「全新临时项目根」口径）。

| WP-8 独立验收命令（裁-10） | 实跑输出摘要 |
|---|---|
| ① `node --test test/wp12/cli-assets.test.js` | 退出 1：`Could not find 'test/wp12/cli-assets.test.js'` —— D-10 第 8 文件尚未实现（本阶段只做拆分）；实现落地后预期退出 0 |
| ② 内联 `import { workflowCommand }` 冒烟 | 退出 1：`ERR_MODULE_NOT_FOUND: …src/cli/workflows.js` —— WP-8 未实现；命令本身语法有效、`--input-type=module -e` 与 `argv[1]` 传参被 Node 正常接受；实现落地后预期退出 0、输出以 `工作流 3 个（内置 3 · 项目 0）` 起头 |

## 7. 风险与降级

> 逐条 `风险 | 影响 | 处置（点名文件 / 函数 / AC）`。第 1~14 条逐条对应纪要 §9.1 的 14 条风险提示；第 15~24 条补 H-01~H-04、执行模板 §5/§7 相关硬约束与用户硬规则。

| # | 风险 | 影响 | 处置（点名文件 / 函数 / AC） |
|---|---|---|---|
| 1 | `src/cli/main.js` 的 `parseArgs` 白名单扩表时放宽用法错误 | M-1 / D-6 / AC-44 / AC-54 / AC-56 | WP-5：`COMMANDS` 增 `skill`/`workflow`，`VALUE_FLAGS`/`BOOLEAN_FLAGS` 扩表、新增 `REPEATABLE_FLAGS`(`--set`/`--unset`) 与 `--force`；按 D-6 的 18 行逐子命令落白名单；白名单检查放 `parseArgs` 解析**之后**（`:96` 现状），保证「未知参数：--nope」与「--<键> 不适用于 <族> <子命令>」两句不同；`role create` 两档必填顺序固定 `--name→--group→--artifact-type→--side-effect`（AC-02 依赖），`--from` 时跳过四项（AC-04 / BR-38） |
| 2 | `src/registry/index.js` 的 `loadRegistry` 被顺手改计数 | M-3 / R-4 / AC-11 / AC-15 / AC-53 | WP-3 边界守护：`loadRegistry`(`:289`) **不得改动**，counts(`:389-396`) = `roles.length + skills.length + invalid`、报错顺序全不变；新增独立 `workflows.js`（C-11 独立计数）；`role validate` 的契约连通读工作流由 `src/cli/roles.js` 调 `loadWorkflows` 得到、**不计入 26 资产**，否则 `test/wp11/registry.test.js` 与 AC-15 破 |
| 3 | `src/cli/labels.js` 用法块 8→25 行时前 8 行被改 / 中文散落 | M-2 / M-6 / BR-29 / BR-31 / AC-43 / AC-51 | WP-5：`USAGE_LINES`(`:155-164`) 扩到 25 行、**前 8 行逐字不动**（`test/wp11/cli-role.test.js:356` 是守卫）；所有新增中文（三族文案、7+19 原因码、条件/类型标签）只在 `labels.js`；新增实现零 CJK（AC-51 第 4 条 `node -e`）；`showWake`(`:92`) 模板不动 |
| 4 | 两处内置资产对齐与 AC-61 临时改坏的顺序 / 还原 | D-7b / 裁-2 / AC-48 / AC-61 / BR-41 | WP-6：实现期先把 `assets/roles/researcher.yaml:13`、`writer.yaml:14-15` 对齐（只改 `wake_allow` 取值、不动字段结构）；AC-61 的 When 是在**对齐之后**临时把 `writer` 改回 `[editor]` 验证 `workflow validate` 变红，**必须 `finally` 立即还原**，否则污染 `git status --porcelain assets`、AC-46/58 与后续 AC；AC-48 机检要比对 `git show 0cd113b:assets/...` 断言「差异恰好两处 `wake_allow`」 |
| 5 | `--force` 被实现成「跳过校验」 | BR-08 / C-05 / AC-40 追加用例 / AC-58 | WP-6：`src/registry/asset-write.js` 的 `--force` 只覆盖文件、**仍跑完整校验**（校验在调 `atomicWrite` 之前由三族 CLI 完成），AC-40 第三段把 `fork.yaml` 换成不合法内容再带 `--force` 仍被拒、sha256 不变；`skill create` / `role import` 遇内置 id 一律 `ASSET_READONLY`，`--force` 不豁免（AC-58） |
| 6 | 角色 diff 与工作流 diff 两套口径串用 | BR-11 vs BR-37 / F-02 / G-02 / AC-10 / AC-39 / AC-57 | WP-6 与 WP-8 各用各的 diff 函数：`role diff` 忽略 `id`、`name` 与其余键全比（AC-10 的 `~ name`）；`workflow diff` 忽略 `schema/id/name`、只比定义体（AC-39）；不共用 `diffAssets`；AC-57 机检净增 `name` 正向断言（v6 修补 1） |
| 7 | C-08 / C-09 检查顺序或错误排序不确定 | BR-40 / C-08 / C-09 / D-3 / AC-53 / AC-62 / AC-65 | WP-2 按 C-08 ①~⑪、WP-3 按 C-09 ①~⑬ 逐项执行；项内按 YAML 声明顺序、同文件同码只报第一条；`errors` 按文件名字典序（内置以「内置 」前缀参与）、同文件内按检查顺序；AC-65「两次 JSON 逐字节相同 / 首条确定」依赖此，禁用 `Set`/`Object` 的偶然遍历序 |
| 8 | `dry-run` 被实现成起了核心 / 写盘 | C-12 / BR-27 / NFR-04 / AC-41 / AC-42 | WP-4：`src/registry/workflow-plan.js` 的 `planWorkflow({workflow, task})` 保持纯函数（D-5：不读实例、不看时钟、不联网、不写文件）；AC-41 用 `find "$ROOT/.orch" -type f -exec sha256sum {} +` 前后比对 + 两次 stdout 逐字节比对；WP-8 的 `src/cli/workflows.js` 不得直读 `state.json`（D-1） |
| 9 | AC-48 追加四条断言缺可复制机检命令 / evidence 无内置 researcher/writer 纯 show 基线 | H-02 / H-03 / AC-48 / S3 | 本拆分在 WP-6 的 AC-48 契约里写清「**原六条逐字 + 追加四条 = 十条**」两段（H-03，不改正文措辞）；S3 写 `ac48.mjs` 时补 `grep -c '  可唤醒：writer'` / `grep -c '  可唤醒：editor, reviewer'` 逐字比对、两条 JSON 的 10 键断言与「资产差异行数 === 2 且仅两处 `wake_allow`」机判定（H-02）；**不得**拿 `docs/iterations/iteration-5/evidence/AC-03.show.txt`（项目版 researcher）或 `AC-28.show-builtin.txt`（带 `--instance` 的 writer）做纯 show 全行 diff |
| 10 | `yaml-lite` 子集被超出（行内映射 / 块标量 / `{`） | D-2 / AC-24 / AC-63 / C-09 ① | WP-3：工作流节点/边一律映射序列（`- id: T-001` 后跟同缩进键），A-1/A-13 夹具逐字使用；字段值含冒号用引号；解析失败 `YAML_PARSE_FAILED` 带 1 基行号；`src/registry/yaml-lite.js` 沿用、不新增解析能力 |
| 11 | `src/templates/index.js` 的 `GRAPHS` 被改 / 新增内建图 | R-1 / C-10 / AC-21 / AC-22 / AC-49 / AC-63 | WP-3 边界守护：`GRAPHS`(`:292`) 恰 3 键（single/code-loop/task-loop），任一字段都不改；`test/templates/task-loop.test.js:298-300` 断言恰好三键、single/code-loop 不得有 `productPolicy`；内置工作流用**只读投影**实现，不新增 `assets/workflows/**` |
| 12 | 并发场景 >10 个 / 同目录占用快检放错位置 / 全量测试写死条数 | AC-49 / AC-50 / NFR-06 / 模板 §5 第 11/14/22 条 | 夹具现场「同进程串行场景 ≤ 10 个」（执行模板 §0.3），>10 先 `forceKillCore`；`asset-write.js` 原子写把**同目录占用快检放写锁之前**（§5 第 11 条，否则等 60s 报 `IPC_TIMEOUT`）、锁内保留复核防竞态；AC-50 用下限断言 `fail===0 && pass===tests && tests>=611`、**不写死 611**（§5 第 14 条）；全量套件偶发 1~2 条 `test/wp10/perf.test.js`（p95 ≤ 50ms）越线属测量噪声，用 `--test-concurrency=4` 稳定门禁 + 先单跑 `node --test test/wp10/perf.test.js` 诊断（§5 第 22 条），**不许放宽预算或删用例** |
| 13 | 验收脚手架命名 / 项目根位置 / 事件帧与时间戳口径 | S3 / AC-49 / 模板 §3.1 / §5 第 4/5/6/21 条 | 脚手架文件带 `-f-`（`acc6-f-lib/common/run/final.mjs`）、**用例目录 `probe/acc6-cases/` 不带 `-f`**、分片 `probe/acc6-f-parts/`、路径常量导出 `ACC6_PATHS`；项目根一律 `%TEMP%/maestro-acc-p6/<AC>/`、绝不放仓库内（§5 第 21 条）；AC-49 按需求给的两条 `sed` 去「已运行 Ns」与 `HH:mm:ss` 后逐字 diff，驱动自述行 `{"ok":true,"root":…}` 比对前剔除（D-10）；事件 `ts` 复用状态变更同一时刻、`seq` 严格单调、`emit` 先落盘再广播（§5 第 4/5/6 条）——本迭代不改 `src/core`，这些是「不改即不破坏」的回归纪律 |
| 14 | 新增实现出现资产名字面量 / CJK / import 注册表 | C-14 / BR-31 / AC-51 / 红线 6 / D-9 | WP-1~WP-8：`src/registry/**`、`src/cli/{roles,skills,workflows}.js` 零 CJK、零资产名字面量；`src/core`/`src/daemon` 不 import 任何注册表模块、不出现模板名/角色名（AC-51 四条命令全退 0；`purity-check.mjs` 的 `DEFAULT_FORBID` 只有 I1.2 四词、**必须显式 `--forbid "$COMMON"` 传 31 词全表**，含英文注释也算）；`labels.js` 是唯一合法持有资产名的文件，第 3 条命令必须**逐文件扫**、不得整目录扫 `src/cli` |
| 15 | H-01：`role show researcher/writer --instance` 文本「可唤醒」行未被 D-7b 两行例外点名 | BR-32 字面 / AC-48 / 裁-6 | 本拆分在「授权断言修改清单」（§2.19 / WP-6）明确该形态：D-7b 只授权纯 `role show researcher` / `role show writer` 两行；`--instance` 形态由 `src/cli/roles.js:269-276` 的 `baseLines` 同源产生、会随 D-7b 变化，但**不在本迭代既有逐字基线内**，不改 v7 正文、不新增 AC；由实现 Agent 补一条机检（只读断言、不放宽 Then）、并列入 §8 冲突清单请主控给一句口径（decisions.md 第九节转 S1，不阻断开工） |
| 16 | H-02 / H-03：AC-48「六条 / 十条」并列误读、追加四条缺机判定 | AC-48 / S3 | 见第 9 条；拆分文档只写清「原六条逐字 + 追加四条 = 十条」两段（H-03），机检命令补齐（H-02）由 S3 承接，本文档不改需求正文、不代写验收用例 |
| 17 | H-04：AC-04:501 的 `机操：` 标签笔误 | AC-04 / §3.1 观测口径 | 按 `机检（补充）` 理解（decisions.md 第九节）；本拆分 WP-6 的 AC-04 验收口径只引用同号 Then、不复制该标签；实现期若顺手修文案需走需求修订，不在 v7 正文擅自改 |
| 18 | 模板字符串逐字红线被顺手改 | 模板 §5 第 8 条 / AC-48 / AC-49 / D-8 | WP-5 的 `src/cli/render.js` 既有 I1.5 渲染函数、`labels.js` 的 `showWake` / `REGISTRY_ERROR` 一个字符不动；优先改「传进去的变量值」而非模板本身；三条主链输出、`role list/show/validate` 文本与 JSON 逐字回归由 AC-48/49 钉住 |
| 19 | `src/core` / `src/daemon` 禁词扫描英文注释也算、误用 `DEFAULT_FORBID` | AC-51 / 红线 6 / D-9 / C-14 | 整合检查点第 2 组四条命令逐字使用 D-9 的 `$COMMON` 31 词 / `$NOCOORD` 30 词；`src/core`/`src/daemon` 不出现模板名/角色名字面量（含英文注释，如 `task-loop`/`developer`/`coordinator`）；`coordinator` 在 `src/registry/**` 只允许出现在 `role-schema.js` 的 `GROUPS` 一行 |
| 20 | 既有断言零修改被破坏 / `test/wp11/cli-role.test.js:356` 守卫被误改 | D-7a / AC-43 / AC-50 / M-2 | WP-6 只改 `:354`(9→26) 与 `:357`(8→25) 两行；`:356` `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES])` 逐字不动；其余 `test/**` 一个字符不动；新增断言一律放 `test/wp12/` 的 8 文件 |
| 21 | 验收项目根放进仓库 / 验收产物卷进功能 commit | 模板 §5 第 21 条 / §7 红线 3 / AC-49 | 所有 AC 的项目根 `%TEMP%/maestro-acc-p6/<AC>/`，`fs.mkdtemp(os.tmpdir())`；`evidence/**` / `probe/**` 是并行产物、由主控单独提交，禁止 `git add -A`；本拆分不写 probe 脚本、不提交 git |
| 22 | 并发场景 >10 个资源耗尽 / 全量测试偶发抖动 | 模板 §5 第 11/22 条 / NFR-06 | 见第 12 条：`--test-concurrency=4` 稳定门禁、先单跑 `perf.test.js` 诊断、不放宽预算；>10 场景先 `forceKillCore`；一次最多 2 个 Agent 并行（§6 分批） |
| 23 | 三条主链与 `orch run` 预检被新增工作流命令污染 | AC-47 / AC-49 / BR-28 / BR-33 / D-8 | WP-5 的 `main.js` 旧命令返回对象字段集合一个都不变、`run` 两步预检与 `未知模板：<名字>` 文案不变（`test/wp6/main.test.js:247` 不改）；WP-8 不给 `orch run` 增加 `--workflow`；本迭代零运行时、不实例化项目工作流（R-3） |
| 24 | 零 DSH 判断被「真实宿主 + 凭据」类前置带偏 / 需求被偷偷改 | 需求 §3.3 / B 类 / 模板 §7 红线 2·14 | 本迭代验收面全部是静态资产与终端输出、不接真实宿主面（B 类零 DSH）；不新增需求条目、不删减/合并 AC、不放宽 Then、不把范围外挪进范围内；冲突一律「以需求为准」并记 §8，不自行改需求迁就实现 |

## 8. 与需求的对齐声明 / 冲突清单

本文档不新增需求条目。所有逐字文案、状态名、错误码、AC 编号均以 `requirement.md` v7 为准；两者冲突时**以需求为准**并在实现结论中指出。裁决优先级固定为（执行模板 §2.8）：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > M/C 契约清单 > 规划文档 > 代码现状`；代码现状只说明「以前怎么做」，不是标准。本文档是 S1 拆分产物，不改需求正文、不增删 AC/BR、不放宽任何 Then、不实现代码、不写验收用例与 probe 脚本、不提交 git。

**冲突清单（需求 / 裁决 / 代码现状）**

| # | 冲突 | 裁决 / 处置 | 依据 |
|---|---|---|---|
| 1 | D-7b 两处内置资产 `wake_allow` 改动 vs I1.5「26 内置资产一个字节不改」逐字红线 | 裁-2 / 裁-6：唤醒权限对**所有**被校验工作流生效（含三条内置图、不豁免不收窄），唯一例外就是这两行 `可唤醒`，由 AC-48 逐字固定、AC-61 作回归门禁；`--format json` 因 `toRoleJson()` 不含 `wakeAllow` 而不受影响（裁-7 以源码为准）；改动是实现期改仓库文件、不是 CLI 运行时行为，BR-01 / AC-46 / AC-58「内置只读」口径不变。**裁-8 补充**：`role show researcher/writer --instance X` 的「可唤醒」行由同一份 `role.wakeAllow` 经 `renderRoleShow` 渲染，视为同一两行的派生渲染，**不新增第三条例外、不改 v7 定稿需求**；WP-6 保证两种文本形态一致，S3 在 `ac48.mjs` 补一条 `--instance` 形态的同源逐字机检（比对两行文本相同、不建新基线） | D-7b / D-8 / 裁-2 / 裁-6 / 裁-7 / **裁-8** / R-6 / BR-26·39·41 / AC-48·61 |
| 2 | 用法块 8→25 行 vs `test/wp11/cli-role.test.js:354/357` 既有精确断言（9 / 8） | M-2 / D-7a：**只授权两行**——`:354` 的 `9`→`26`、`:357` 的 `8`→`25`；`:356` 的 `slice(0, 8)` 守卫逐字不动；其余 `test/**` 一个字符不动；整块 = 25 行 + 1 原因行 = 26、退 2 | M-2 / R-8 / A-12 / D-7a / AC-43·50 / BR-29 |
| 3 | 17 条新命令（role 5 + skill 6 + workflow 6）vs `main.js` 现有 `COMMANDS` 仅 5 个、`ROLE_SUBS` 仅 3 个 | M-1 / D-6 / B-07（口误更正：规划逐条相加是 17 不是 18）：`COMMANDS` 增 `skill`/`workflow`、`ROLE_SUBS` 扩到 8、按 D-6 的 18 行表逐子命令落白名单；旧命令、旧参数、旧退出码逐字不变；白名单检查放解析之后 | M-1 / D-6 / A-12 / AC-44·54 / BR-29 / decisions.md「口误更正」 |
| 4 | `node_type` 新字段 vs `src/templates/index.js` 的 `GRAPHS` 内建图对象只读（恰 3 键） | M-7 / C-10 / R-1：资产字段名逐字 `node_type`（JSON `nodeType`），内建图对象**任何字段都不改**，投影出的节点一律 `node_type: role`；`state.json` 节点结构不改（本迭代不实例化项目工作流）；不新增 `assets/workflows/**` | M-7 / F-04 / C-10 / R-1 / BR-19 / AC-22·24~26·62 / `test/templates/task-loop.test.js:298-300` |
| 5 | 「节点状态转换合法性」口径（运行时九态 vs 静态图约束，本迭代零运行时） | 裁-1 / R-9：按**静态图约束**实现（按 `node_type` 规定合法出入边、BR-25 / BR-36 / D-3 ⑫），九态迁移明确留 I1.8；不替规划方裁决、不重开 S0 | 裁-1 / R-9 / §2.9:380 / BR-25·36 / D-3⑫ / 需求 §1.3:81 |
| 6 | 「包」边界 / 「工作流完整原语 11 vs 12 项」 / 「派生行为」口径 | 裁-3（包 = 单文件、闭包/签名/版本兼容留 I1.12）、裁-5（统一 11 项、字段映射按能力域 2 单列、R-10）、裁-4（行为收敛为 AC-05 的 show/list/validate 三处可见变化）；需求侧已按裁决逐条落地，均不再确认 | 裁-3 / 裁-4 / 裁-5 / R-10 / §1.3:72 / §1.2:38 / B-04·05·06·07 |
| 7 | `src/cli/render.js` 不在 D-1 的 10 行文件边界表内，但 A-5~A-11 的文本版式需要渲染函数 | **裁决**：D-1 是职责表而非「禁改表」，D-1 的「不得改动」清单只列 `index.js` 加载与计数、`templates/index.js`、`src/core/**`、`src/daemon/**`、`assets/**`；`render.js` 需扩三族渲染函数（§2.7），归 WP-5 唯一负责人，既有 I1.5 渲染函数逐字不动；D-1 未点名 `assets.js` → 裁决不新增 `projectWorkflowsDir`、由 `workflows.js` 内联拼路径（§1.12 #18），不扩大改动范围。**主控已书面确认扩权 = decisions.md 第十节裁-9**：D-1 是最小文件集而非封闭清单，硬条件 = 中文仍只来自 `labels.js`、既有 `renderRoleShow()` / `renderRoleInstanceLine()` 签名与输出逐字不变、不 import CLI 其它模块 | D-1 / M-6 / A-5~A-11 / **裁-9** / 模板 §6「不自行扩大改动范围」/ 用户 §2 点名 |
| 8 | 6 条规划层歧义 + 4 条建议级 H 项 | 6 条歧义全部由裁-1~裁-7 登记、需求侧已落地（review-round3.md §7「不重开、不替规划方裁决」）；H-01~H-04 一律**不改 v7 正文**，按 decisions.md 第九节转 S1/S3：H-01 在本拆分「授权断言修改清单」明确 `--instance` 形态并请主控给一句口径（不阻断）、H-02 由 S3 写 `ac48.mjs` 补 grep/差异行数机检、H-03 在本拆分 WP-6 的 AC-48 契约写清「6 + 4 = 10」两段、H-04 按 `机检（补充）` 理解 | review-round3.md §5.3 / §7 / §8 / decisions.md 第九节 / 纪要 §5.2·§5.3 |
| 9 | S0 准出与开工前置 | `review-round3.md` §0 总判 **PASS / 阻断 0 / 建议 4** / §8「不需要第 4 轮」；纪要 DoR 13/13 全 PASS、65/65 AC Given 可构造、B 类零 DSH、不存在阻塞 S1 开工的未决问题；本拆分据此开工，不跳过 S0、不宣布需求结束 | 模板 §1.1 / §7 红线 13 / 纪要 §5.4 / §8 |

**需要主控裁决的冲突（如实列出，不隐瞒）**

- **H-01 / `--instance` 形态口径（已由主控裁决 = decisions.md 第十节裁-8，不再待裁决）**：D-7b / BR-32 / AC-48 点名的「唯一例外两行」只写了不带 `--instance` 的纯 `role show researcher` / `role show writer` 的「可唤醒」行；`src/cli/roles.js:269-276` 在 `format === 'json'` 之前就用 `wake: role.wakeAllow` 生成 `baseLines`，`:315` 文本分支先打 `baseLines` 再追加 `instanceLine`，故 `role show researcher --instance X` / `role show writer --instance X` 的文本「可唤醒」行同样会随 D-7b 变化。**裁-8 决定**：不新增第三条例外、不改 v7 定稿需求——需求 v7 的 D-7b「两行例外」指**两个角色**，不是两种命令形态；`--instance` 形态视为同一两行的派生渲染（同一份 `role.wakeAllow` 经 `renderRoleShow` 输出，不是新的数据源）；WP-6 必须保证两种文本形态的「可唤醒」行一致；S3 验收在 `ac48.mjs` 里补一条 `--instance` 形态的**同源逐字机检**（比对两行文本相同，不建新基线）。round3 §7-2 的「不阻断本轮」结论不变。

### 拆分自检（实跑输出）

> 交付前在仓库根 `D:/WWW/Maestro`、分支 `feat/i1.6-assets-workflow`、HEAD `118dde4` 实跑用户给定脚本（原样，未改写脚本逻辑），实际输出如下。

**（一）用户给定三段脚本的实际输出**

```
--- 8 节 ---
10:## 0. 迭代定位、范围与退出标准
45:## 1. 技术选型（结论 + 被否决项）
148:## 2. 模块划分与文件级接口契约
273:## 3. 数据模型
513:## 4. 工作包拆分（WP-1 ~ WP-8，文件互不重叠）
653:## 5. 交付物清单
700:## 6. 依赖与并行策略
779:## 7. 风险与降级
810:## 8. 与需求的对齐声明 / 冲突清单
--- AC 覆盖 ---
需求 AC: 65 | 未覆盖: 无
WP 数: 8 | 登记文件数: 24 | 重叠: 无
--- 依赖编号存在 ---
517:### WP-1 工作流字段契约内核（依赖：无）
525:### WP-2 角色契约校验纯函数（依赖：WP-1）
533:### WP-3 工作流加载 / 内置投影 / 校验顺序编排（依赖：WP-1）
541:### WP-4 dry-run 编排计划纯函数（依赖：WP-1）
549:### WP-5 CLI 三族接线与文案基座（依赖：无，共享文件唯一负责人）
557:### WP-6 角色资产写入（原子写 + 8 子命令 + D-7b 资产对齐 + D-7a 两行授权）（依赖：WP-1 + WP-2 + WP-3 + WP-5）
565:### WP-7 技能命令族（依赖：WP-5 + WP-6）
573:### WP-8 工作流命令族（依赖：WP-1 + WP-2 + WP-3 + WP-4 + WP-5 + WP-6）
```

**（二）补充核对脚本的实际输出**（下列「总行数」为追加本『拆分自检』段之后的终稿值，复跑 `wc -l` 校验一致；映射表 / 连续性 / 被否决项 / §2 小节数为全文统计，追加段前后结果不变）

```
--- 总行数 ---
892
--- 映射表行数 / 连续性 ---
映射表数据行: 65
缺号: 无 | 重复: 0
--- 被否决项条数 ---
19
--- §2 标注 WP 的文件小节数 ---
19
```

**（三）硬规则核对结论**

| 硬规则 | 实跑结果 |
|---|---|
| 8 节齐全、节号 `## 0.`~`## 8.` 顺序不改、标题逐字按 §1.3 表 | 通过（`grep "^## "` 实跑输出 9 行 = §0 定位节 1 行 + §1~§8 正文 8 节，与 §1.3 表 / §1.6 骨架 / `iteration-5.md` 样板逐字一致；文件头 `# I1.6...` 是单 `#`、不匹配 `^## `；§4 标题沿用 §1.6 骨架与样板的「工作包拆分（WP-1 ~ WP-N，文件互不重叠）」写法） |
| AC → WP 满覆盖 65/65、编号连续、不缺号不重复 | 通过（需求 AC 65、未覆盖「无」、映射表 65 行、缺号「无」、重复 0） |
| WP 负责文件两两无交集 | 通过（8 个 WP、登记 24 个带反引号路径、重叠「无」） |
| 依赖编号全部存在、依赖成 DAG | 通过（WP-1~WP-8 八个 `### WP-` 标题齐全，§6 DAG 无环） |
| 每条 AC 的验收口径可回溯需求同号 Then | 通过（§4 声明「只登记 AC 编号 / 测试文件 / 逐字断言锚点，不复制不改写不合并不放宽任何 Then」；映射表 65 行 AC 号与需求 §3.1 同号） |
| §2 每个文件标注归属 WP | 通过（§2 共 19 个文件小节全部标注「新增/改，WP-x」或「不改，边界守护 WP-x」；§2.20 表格内 8 个 `test/wp12/` 文件逐个标 WP） |
| §6 有契约先冻结点与整合检查点 | 通过（§6「契约先冻结点」8 条 + 「整合检查点」6 组完整命令与预期数字） |
| §7 每条风险有具体处置（点名文件/函数） | 通过（24 行风险表，第 1~14 行逐条对应纪要 §9.1，15~24 补 H 项与模板 §5/§7 硬约束） |
| §1 技术选型每个决策含被否决项 | 通过（12 个决策小节、19 条被否决项 `#1~#19`、§1.13 汇总表） |
| §8 声明「不新增需求条目，冲突以需求为准」 | 通过（§8 首段逐字声明 + 9 行冲突清单 + 1 条主控裁决项） |

> 自检脚本原样执行、输出未做任何美化；以上为命令真实 stdout 的逐字转录。（此节为拆分文档首版收尾的历史留痕；本次第 1 轮拆分评审修订的写入范围见下方「第 1 轮拆分评审处置」段。）

---

### 第 1 轮拆分评审处置（`split-review-round1.md` §5，S-01 ~ S-04）

> 第 1 轮独立评审总判 **FAIL（阻断 1 / 建议 3）**。本段为修订处置留痕，供第 2 轮干净上下文评审逐条复核；**不自行宣布评审通过**，补完仍交第 2 轮评审。

| 编号 | 评审判定 | 处置 |
|---|---|---|
| S-01（阻断） | §6 主链冒烟命令参数名错误（driver 的 `parseDriverArgv` 只认 `--scenario`），原样实跑退出码 2 | **已修 + 已实跑**：三条主链命令全部落为 `--scenario <实跑场景名>`（`pass` / `doc-pass`）与 `single` 直跑（`bin/orch.js run --host dsh`，host 配置取 I1.5 收口同款 `mock-acp-agent.js --write-ref out/intro.md`）；实跑三命令均**退出 0**，4c 归一化后与 `0cd113b` 基线**三份 diff 均为空**（实跑输出摘要见 §6「整合检查点实跑记录」） |
| S-02（建议） | §6 残留尖括号占位符（场景名 / 任务文本两处）、「三条主链」只给两条命令、归一化 diff 命令不完整 | **已修**：全文占位符 0 残留（本轮自检 grep 0 命中）；`single` 命令补齐；归一化 diff 给出含基线文件路径（`docs/iterations/iteration-5/evidence/AC-19.{single,code-loop,task-loop}-baseline.txt`）与夹具易变量归一的完整可复制命令；任务文本为实值（与两个 driver 的 `DEFAULT_TASK` 逐字一致） |
| S-03（建议） | `src/cli/render.js` 超出需求附录 D-1 十行边界表 | **由主控裁-9 处置**：允许扩权、归 WP-5 唯一负责；硬条件 = 中文仍只来自 `labels.js`、既有 `renderRoleShow()` / `renderRoleInstanceLine()` 的签名与输出逐字不变、不 import CLI 其它模块；登记于 `decisions.md` 第十节，落点 §2.7 / §4 WP-5 / §8 冲突 7 |
| S-04（建议） | WP-8 无专属契约测试文件，与模板 §1.4 规则 2 字面张力 | **由主控裁-10 处置**：接受现有分工（裁决优先级「附录 D 实现约束 > 模板」，D-10 点名 8 文件且已按能力分给 WP-1~WP-7），不新增第 9 个测试文件、不改文件零交集；WP-8 补两条可直接复制的独立验收命令（本阶段实跑退 1 = 模块尚未实现，实现落地后预期退 0，见 §4 WP-8 与 §6 实跑记录），登记于 `decisions.md` 第十节 |
| 附带 | H-01 `--instance` 形态口径（评审 §7 冲突 1 转呈） | **由主控裁-8 处置**：不新增第三条例外、不改 v7 定稿需求——D-7b「两行例外」指两个角色而非两种命令形态，`--instance` 形态视为同一两行的派生渲染；WP-6 保证两种文本形态的「可唤醒」行一致；S3 在 `ac48.mjs` 补一条 `--instance` 形态的同源逐字机检（比对两行文本相同，不建新基线）；§8 冲突 1 与「需要主控裁决的冲突」段已同步 |

本次修订可写且只可写 `docs/iterations/iteration-6.md` 与 `docs/iterations/iteration-6/decisions.md`（后者新增第十节裁-8 / 裁-9 / 裁-10、第九节 H-01 承接阶段补注、头部职责行更新）；未改 `requirement.md`（v7 定稿）、`requirement-understanding.md`、`review-round*.md`、`split-review-round1.md`、`progress.md`、`src/**`、`test/**`、`assets/**`、`docs/index.md`、`docs/templates/**`；未改 §4 的 AC→WP 映射表 65 行、任何 WP 的负责文件集合（仅 WP-8 追加独立验收命令说明）、任何 AC 的 Then 口径、§2 其它接口签名；未提交 git。
