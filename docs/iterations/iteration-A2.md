# A2 任务拆分与文件级契约（基于 CLI 创建角色与员工）

> **需求依据**：`docs/iterations/iteration-A2/requirement.md` **v2**（13 AC / 14 BR / 5 NF / 附录 A~D；头部 L7 = 附录 C 末行 L451，均 v2）
> **理解基线**：`docs/iterations/iteration-A2/requirement-understanding.md`（评审 round1/round2 总判 PASS；AS-01 已裁决）
> **适配裁决**：`docs/iterations/A-phase-decisions.md` AD-01~AD-10（AD-04 macOS 路径 / `os.tmpdir` / `NODE_ENV=test`；AD-05 A1 已有实现仅作现状参考；AD-06 全量门禁等效口径；AD-07 purity 11 词并集；AD-08 真实宿主未取证判阻塞 + 能力/编排/数据层 mock 实测；AD-10 一次 ≤2 并行）
> **上游现状（HEAD `3e47a51`，仅定位不作需求来源）**：`bin/orch.js:22-32` 三路分派（`core serve` 内部通道 / `cli` → `cliDiscoveryMain` / else → 冻结 `main(argv)`）；`src/cli/labels.js:1254` 的 `CLI_DISCOVERY_TEXT`（尚无 `ORG_TEXT`）；A1 五维常量 `src/adapter/cli-discovery/capability-matrix.js:13-19`；A1 注册表形状 `src/adapter/cli-discovery/registry.js:127-150`。当前无 `src/org/**`、无 `org` 分支。
> **职责边界**：本文档仅做拆分与技术选型；不改 `src/**`、不改需求/评审/三件套、不提交 git。实现由下游 S2 承担。

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：让用户从 A1 已发现的 CLI 出发创建角色（职责/契约/技能/所需 CLI 能力）与绑定具体 `cli_id` 的员工，一个角色挂 2 名以上员工并归属六部门，按 A1 五维能力校验而不把角色绑定死某个 CLI，并为两名员工各创建一条独立会话记录（mock 取证），落地 v2 三条概念核心边界。

**In scope**（逐条对应需求 §1.3，L43–L53）：
1. 从已发现 CLI 创建角色 + 查看/修改/删除（角色 CRUD 四类内容）→ AC-01/02/03。
2. 员工 CRUD 并绑定具体已发现 CLI（含改绑）→ AC-04/05/06。
3. 一角色挂 2 名员工（角色≠Agent）→ AC-07。
4. 部门归属：角色与员工归属六部门之一，只做归属 CRUD 与校验 → AC-08。
5. 角色能力校验（按 A1 五维、按能力而非名称、未探测不臆造）→ AC-09。
6. 角色不绑定死某个 CLI（换绑满足能力的 CLI 后角色逐字不变）→ AC-10。
7. 两人各创建一条会话记录（语义层、mock 实测、互不串台）→ AC-11。
8. 员工实例≠会话（同一员工可开多条独立会话）→ AC-12。
9. 规划验收句整句端到端（不降级/不收窄/不合并）→ AC-13。

**Out of scope**（摘要，全表见需求 §1.3 L55–L65）：Team 拖拽编排/负责人/并发协作/团队模板（A3）；12 阶段工作流/门禁/运行模式/DAG（A4）；真实 ACP 会话驱动/恢复方言/状态机迁移与 CAS/按能力调度/一角色多员工真实并行（A5 与 B1/B2）；跨 CLI 混跑与真机多宿主（D1~D3）；桌面壳与组织视图视觉/拖拽/托盘/daemon（C1）；CLI 扫描与能力探测（A1 已完成，A2 只读消费）；安装/修改 CLI/写用户系统目录（永久）；网页版控制（永久）；真实宿主取证机器（B1，A2 会话为 mock 面，0 次冒充真实达标）。

**退出标准**（逐条可判定）：
1. **13/13 AC 通过**（AC-01~AC-13）：每条的用户可见 Then + `机检：` + `夹具：` + `架构检查：` 三锚点齐全且实跑绿；面类型分布 = mock 面 13 / 真实宿主面 0；会话证据 13 处标注均为「mock 实测」，真实宿主达标断言 0 处。
2. **测试落地**：`test/wp17/` 下 4 个测试文件（crud / capability / session / acceptance）与夹具存在且对 AC-01~13 全绿；A1 `test/wp16/` 既有断言逐字不放宽（`git diff` 对 wp16 与文案计数断言零改动）。
3. **架构检查逐条达标**：各 AC 所列 `purity-check.mjs --dirs src/core,src/daemon --forbid …`（11 词并集）→ exit 0；`src/org/**` 零 CJK（AC-01/09 的 `node -e` 检测输出 `OK`）；`role.js` 零 `cli_id`、`role.js` 零 `writeFile|mkdir|appendFile`；`src/org/` 零 `transit|CAS`、零 `session/(new|prompt)|spawn|initialize`；`src/cli/org.js` 零 `install|chmod|writeFile`；`grep` 命中项按需求逐字命中（`.orch/organization` in registry、`members|agents|role_id` in registry、`cli_id|capabilities` in agent、`agent_id|session_id` in session、五维 in validation、`DEPARTMENTS|六部门` in department+labels、`ORG_TEXT|ORG_` 与「请先移除其下员工」「mock 实测」in labels）。
4. **NF-1~NF-5 全部满足**：拒绝操作均有具体原因码（非静默/非缺省）；A1 CLI 清单与用户 CLI 配置零可见变化，新增写入只在项目缓存；三态证据分级正确；中文仅 `labels.js` 下发、领域层零 CJK；AD-06 等效口径下新增红差集 0。
5. **拆分自检（§1.5 十条）全绿**：`grep '^## '` 节号 0~8 齐全；AC 满覆盖映射表 13 行；WP 负责文件两两无交集；DAG 无环且依赖编号均存在；§0 退出标准逐条含数字/逐字口径；§2 每文件标注归属 WP；§6 有契约先冻结点与整合检查点；§7 每条风险点名文件/函数；§8 声明不新增需求条目、冲突以需求为准。

---

## 1. 技术选型（结论 + 被否决项）

> 每条均给「结论 / 理由 / 被否决方案 + 否决原因」。所有决策服从需求附录 D 与三条概念边界（§2.1/§8），不新增需求条目。

### 1.1 组织数据落点：`.orch/organization.json` 单文件 vs 多文件
**结论**：单一文件 `<root>/.orch/organization.json`，`schemaVersion: 1`，三段数组 `roles` / `agents` / `sessions` 同文件分段；写入临时文件 + `rename` 原子落盘，入口唯一为 `src/org/registry.js` 的 `saveOrganization`。
**理由**：需求 D-2 允许单文件分段；单一事实源避免 `roles`/`agents`/`sessions` 多文件间的半提交与引用悬空；AC-07 的 `members: role → agents` 关系与 AC-06「删员工不删会话」需在同一文件内原子表达；AC-04 架构检查点名 `.orch/organization` 写入点。
**被否决**：`departments.json`/`roles.json`/`agents.json`/`sessions.json` 多文件 —— 跨文件无事务保证，删员工与会话保留的一致性需额外协调，且写入点从 1 个变 4 个，违反 D-2「写入原子化」与 BR-13「唯一写入面」的纪律。

### 1.2 角色能力 vs 角色绑定 CLI（概念边界）
**结论**：角色记录只含四类内容（职责/契约/技能/所需能力）+ 部门 + 元数据，**字段集不含 `cli_id`**；所需能力用 A1 五维键（`acp`/`transport`/`resume_dialect`/`max_concurrent_sessions`/`evidence_hook`）声明期望值；具体 `cli_id` 只写在员工记录。校验按能力、不按 `name`/`cli_id` 硬配。
**理由**：§2.1 关键规则 2 / §8 第 4 条 / BR-05 / AC-10 架构检查（`grep cli_id src/org/role.js` 零命中）。换绑员工 CLI 时只改 `agent.cli_id`，`role` 对象深层不变。
**被否决**：把 `cli_id` 写进角色字段（用户选哪个 CLI 就绑定哪个）—— 直接违反 AC-10 与「角色不绑定死某个 CLI」验收句；按 CLI 名称硬配 —— 违反 §8 第 4 条「调度按能力而非名称」。

### 1.3 会话：语义层记录持久化 vs 真实 ACP 驱动（B1）
**结论**：A2 只创建**会话记录**（`session_id`/`agent_id`/`cli_id`/`created_at`/`status`/`evidence_level='mock'`），不启动进程、不发 `session/new`/`session/prompt`、不 `spawn`/`initialize`；证据一律「mock 实测」。真实 ACP 会话驱动、恢复方言、状态机迁移归 B1。
**理由**：AS-01 / U-01 已裁决：会话为语义层记录、mock 取证、真实驱动归 B1，AC-11 保持不变；AC-11 架构检查要求 `src/org/` 零 `session/(new|prompt)|spawn|initialize`。
**被否决**：A2 直接驱动真实 ACP 会话 —— 本机无真实宿主（AD-08 / D-2 / D-4），会把 mock 冒充真实证据；因「只是记录」而删除或放宽 AC-11 —— 违反 AS-01「不接受默默放宽 AC-11」，AC-11 的 Then 逐字保留。

### 1.4 命令面：`org` 独立分流 vs 改 `main.js` parser
**结论**：在 `bin/orch.js` 的 `argv[0]==='cli'` 分支之后追加 `argv[0]==='org'` → `src/cli/org.js` 的 `orgMain`；`core serve` 内部通道与 `cli` 分支、冻结的 `main(argv)` parser 逐字不动。`org` 子命令拥有独立 parser 与 flag 解析。
**理由**：冻结面不可触碰（NF-5 / 理解纪要 §7 第 3 条）；A1 已用独立分流先例（`cliDiscoveryMain`）。
**被否决**：把 `org` 子命令并入 `src/cli/main.js` 既有 parser，或复用 `cli` 分派 —— 触碰冻结 I1.x parser，回归风险不可控，违反 AD-05/NF-5。

### 1.5 员工可见状态：仅呈现 vs 状态机迁移
**结论**：员工记录持 `status` 字段，取值用角色 6 态枚举（`inactive`/`available`/`busy`/`cooldown`/`unavailable`/`retired`）之一，仅做可见呈现与角色页汇总；`src/org/` 不出现 `transit`/`CAS`，不实现迁移。
**理由**：BR-12 / AC-05 架构检查（零 `transit|CAS`）；状态机迁移与 CAS 属 B1（需求 §1.3 范围外）。
**被否决**：A2 实现 6 态迁移与 CAS —— 越界到 B1，且会引入并发/工作区串台等本迭代不验证的语义（U-05）。

### 1.6 能力数据源：只读 A1 清单单一事实源 vs 复制第二份
**结论**：能力判定的唯一数据源是 `<root>/.orch/cli-registry.json` 的 `clis[]` 五维字段（`src/org/registry.js` 的 `loadDiscoveredClis` 只读打开）；A2 不落盘第二份能力数据；`null` = 未探测。
**理由**：D-2 / D-4 / BR-13 / NF-2；与 A1 能力矩阵同源才不自相矛盾；未探测不臆造为支持。
**被否决**：在 `organization.json` 内缓存一份 CLI 能力快照 —— 双源不一致风险，且写回 A1 清单会破坏只读边界。

### 1.7 部门表示：领域层英文 code + labels 中文 vs 领域层中文
**结论**：`src/org/department.js` 的 `DEPARTMENTS` 为 6 个英文 code（`product`/`rd-management`/`frontend`/`backend`/`qa`/`platform-security`），零 CJK；CLI 的 `--dept` 接收中文部门名，经 `labels.js` 的 `ORG_TEXT.DEPARTMENT` 反查为 code 后写入领域对象；展示时 code → 中文由 labels 下发。
**理由**：NF-4「所有中文只在 labels.js / 领域层零 CJK」与 AC-08 架构检查（`grep DEPARTMENTS src/org/department.js` 命中、`产品部|平台安全部` 在 labels 命中）同时成立。
**被否决**：把六个中文部门名直接写进 `department.js` —— 违反领域层零 CJK；把中文枚举键省掉、让用户输入任意字符串 —— 违反 BR-08 六部门校验。

### 1.8 失败语义：`{ok:false,code,params}` vs 抛异常
**结论**：领域层所有可能失败的函数统一返回 `{ok:false, code, params}`（英文 code 常量，如 `ROLE_HAS_AGENTS`/`CAP_NOT_PROBED`），零 `throw`；CLI 层按 code 经 `ORG_TEXT` 渲染中文原因。
**理由**：A1 `probe.js` 已确立该纪律；BR-14「拒绝给具体原因而非静默失败」；领域层零 CJK 要求原因只能是 code。
**被否决**：领域层 `throw new Error(中文)` 由上层 catch —— 领域层含中文、破坏零 CJK，且堆栈暴露给用户。

### 1.9 写入点：registry 集中原子写 vs 各域分散写
**结论**：仅 `src/org/registry.js` 触碰 `fs`；role/agent/session/validation/department/model/schema 均为纯函数，接收 `org` 对象与注入的 `deps`，返回新 `org`，由 CLI 层调用 `saveOrganization` 一次落盘。
**理由**：AC-01 架构检查（`grep writeFile src/org/role.js` 零命中）与 §1.1 的原子一致性；纯领域层可独立单测、可并行开发。
**被否决**：每个域自己 `import fs` 写文件 —— 多点写入、半提交风险、违反 AC-01 架构检查。

### 1.10 测试目录与夹具：`test/wp17/` 新增 vs 复用 `wp16`
**结论**：新增 `test/wp17/`（承接 A1 的 `wp16`），含 4 个测试文件 + `fixtures.mjs`；「已发现 CLI」一律按 P-3 写 A1 形状 `.orch/cli-registry.json`（`os.tmpdir()` + `NODE_ENV=test`），不复用/不改 A1 断言。
**理由**：D-7 / AD-04 / NF-5；A1 `wp16` 断言冻结不得改动。
**被否决**：把 A2 断言塞进 `test/wp16/` —— 污染 A1 冻结断言，回归基线不可比。

---

## 2. 模块划分与文件级接口契约

> 标记：**新增** = 本迭代新建；**修改** = 在既有文件「只加不改」追加一段。归属 WP 见 §4；每个文件只归一个 WP。
> 通用约束：领域层（`src/org/**`）与 `src/cli/org.js` **零 CJK**；所有失败返回 `{ok:false, code, params}`；不新增依赖；不 `throw`。

### 2.1 `src/org/schema.js`（新增，WP-1）
**导出**：`SCHEMA_VERSION=1`；`ROLE_STATUS`/`SESSION_STATUS`/`AGENT_STATUS`（各 `Object.freeze` 的 6 态字符串数组，取值 `inactive/available/busy/cooldown/unavailable/retired`）；`EVIDENCE_LEVEL=Object.freeze({MOCK:'mock',PENDING:'pending',REAL:'real'})`；`CAPABILITY_DIMENSIONS=Object.freeze(['acp','transport','resume_dialect','max_concurrent_sessions','evidence_hook'])`；`FAIL=Object.freeze({...})` 失败码常量表。
**入参/出参**：无入参，仅供常量读取。
**约束**：零 CJK、零 fs；`SESSION_STATUS` 具体 6 态取值按基线 §4「会话 6 态」对齐（见 §8 裁决点 R1）。

### 2.2 `src/org/model.js`（新增，WP-1）
**导出**：`emptyOrganization()` → `{schemaVersion:1, roles:[], agents:[], sessions:[]}`；`normalizeOrganization(raw)` → organization | `null`；`makeRole(input)` → role 记录；`makeAgent(input)` → agent 记录；`makeSession(input)` → session 记录；`nextId(prefix, existing, clock)` → 唯一 id 字符串。
**入参/出参**：
- `makeRole({role_id,name,department,duty,contract,skills,required_capabilities,created_at,updated_at})` → `{role_id,name,department,duty,contract,skills,required_capabilities,created_at,updated_at}`（**字段集不含 `cli_id`**）。
- `makeAgent({agent_id,role_id,name,cli_id,department,max_concurrent,status,created_at,updated_at})` → agent 记录（`cli_id` 来自 A1 清单）。
- `makeSession({session_id,agent_id,cli_id,created_at,status,evidence_level})` → session 记录（独立 `session_id`，不等于 `agent_id`）。
**约束**：纯构造+缺省填充，零 fs、零 CJK；`nextId` 接受注入 `clock`/`existing` 以保证测试中确定性。

### 2.3 `src/org/department.js`（新增，WP-1）
**导出**：`DEPARTMENTS=Object.freeze(['product','rd-management','frontend','backend','qa','platform-security'])`；`isDepartment(code)` → boolean；`codeFromLabel(label, ORG_TEXT)` → code | `null`。
**入参/出参**：`codeFromLabel` 接收 CLI 中文部门名与 `ORG_TEXT.DEPARTMENT` 映射，返回英文 code 或 `null`（非法/空）。
**约束**：领域层零 CJK；中文部门名只在 `labels.js`；`DEPARTMENTS` 恰 6 项且顺序固定（AC-08）。

### 2.4 `src/org/registry.js`（新增，WP-2）
**导出**：`ORGANIZATION_FILE='.orch/organization.json'`；`organizationPath(root)` → abs path；`loadOrganization(root)` → `{ok:true,org,path}` | `{ok:false,code,params}`；`saveOrganization(root,org)` → `{ok:true,path}` | `{ok:false,code,params}`（临时文件 + `rename`）；`findRole(org,key)`/`findAgent(org,key)` → record | `null`；`findAgentsByRole(org,role_id)` → agent[]（支撑 `members: role → agents`）；`loadDiscoveredClis(root)` → `{ok:true,clis}` | `{ok:false,code,params}`（**只读** A1 `.orch/cli-registry.json`，不写回）。
**入参/出参**：`root` = 独立项目根（P-2）；`key` = `role_id`/`agent_id` 或可展示名（由 CLI 层传入，领域层按 id/name 匹配）。
**约束**：本模块是 `src/org/` 唯一允许 `fs` 写的文件；字面量 `.orch/organization` 与 `members`/`agents`/`role_id` 必须出现（AC-04/07）；不触碰 `.orch/cli-registry.json` 的写句柄。

### 2.5 `src/org/role.js`（新增，WP-3）
**导出**：`listRoles(org)` → role[]；`showRole(org,key)` → `{ok:true,role}` | fail；`roleView(org,key)` → `{ok:true,role,members:agent[],statusSummary:object}` | fail；`createRole(org,input,deps)` → `{ok:true,org,role}` | fail；`updateRole(org,key,patch,deps)` → 同；`deleteRole(org,key)` → `{ok:true,org}` | fail。
**入参/出参**：`input`/`patch` 含 `name`/`from_cli`/`department`/`duty`/`contract`/`skills`/`required_capabilities`；`deps.discoveredClis` 提供已发现 CLI 列表用于 BR-01 起点校验。
**约束**：`createRole` 校验 `from_cli` 在 `deps.discoveredClis`、四类内容非空、部门合法，否则返回对应 code 且不产生半截角色；`deleteRole` 若 `findAgentsByRole` 非空 → `{ok:false,code:'ROLE_HAS_AGENTS',params:{key}}`；**本文件源码不得出现字符串 `cli_id`**（AC-10），也不得出现 `writeFile|mkdir|appendFile`（AC-01）。

### 2.6 `src/org/agent.js`（新增，WP-4）
**导出**：`listAgents(org,filter)` → agent[]；`showAgent(org,key)` → `{ok:true,agent}` | fail；`createAgent(org,input,deps)` → `{ok:true,org,agent}` | fail；`updateAgent(org,key,patch,deps)` → 同；`deleteAgent(org,key)` → `{ok:true,org,remainingSessions:number}` | fail。
**入参/出参**：`input` 含 `role_id`/`name`/`cli_id`/`department`/`max_concurrent`；`deps.discoveredClis` + `deps.checkCapabilities` 用于 BR-04/09 校验；同角色同名拒绝（`AGENT_EXISTS`）。
**约束**：`updateAgent` 中 `role_id` 不可改，`cli_id` 改绑须重新过能力校验；`status` 仅用枚举呈现；`deleteAgent` **不删 sessions**，仅返回其会话数供 CLI 提示；源码出现 `cli_id` 与 `capabilities`（AC-04）；零 `transit|CAS`（AC-05）。

### 2.7 `src/org/validation.js`（新增，WP-5）
**导出**：`checkCapabilities(requiredCaps, cli, dims=CAPABILITY_DIMENSIONS)` → `{ok:true,code:'CAP_OK'}` | `{ok:false,code,params}`；`unknownCapability(requiredCaps, dims)` → cap | `null`。
**入参/出参**：`requiredCaps` 为角色所需能力对象；`cli` 为 A1 清单一条（含五维字段）；`code` ∈ `CAP_NOT_PROBED`（维度值 `null`/缺失）/ `CAP_MISSING`（`params.cap` 指出缺哪项）/ `CAP_UNKNOWN`（所需能力项不在五维内）。
**约束**：纯函数、零 CJK、零 fs；五维字面量 `acp|transport|resume_dialect|max_concurrent_sessions|evidence_hook` 出现（AC-09）；出现 `null` 按「无法判定满足」处理，不臆造为支持；不得按 `name`/`cli_id` 分支。

### 2.8 `src/org/session.js`（新增，WP-6）
**导出**：`createSession(org,input,deps)` → `{ok:true,org,session}` | fail；`listSessions(org,filter)` → session[]；`sessionsOf(org,agent_id)` → session[]。
**入参/出参**：`input={agent_id}`；`deps` 提供 agent 查找与能力复核；成功时 `makeSession` 写入 `evidence_level=EVIDENCE_LEVEL.MOCK`、`cli_id` 取该员工绑定值、`session_id` 由 `nextId` 生成（同一 `agent_id` 可多次调用得到不同 `session_id`）。
**约束**：拒绝未绑 CLI / 能力不满足 / agent 不存在（对应 code）；源码出现 `agent_id|session_id`（AC-12）；**零 `session/(new|prompt)|spawn|initialize`**（AC-11），不启动真实会话。

### 2.9 `src/org/index.js`（新增，WP-7）
**导出**：barrel re-export 上述 8 个模块的公开符号；`orgApi` 聚合对象供 CLI 层注入。
**入参/出参**：无。
**约束**：零 CJK、零 fs；仅转出，不新增逻辑。

### 2.10 `src/cli/org.js`（新增，WP-7）
**导出**：`orgMain(argv)` → `Promise<number>`（退出码 0/1/2）。
**入参/出参**：`argv` 为 `org` 之后的剩余参数；子命令 `role create|show|update|delete|list`、`agent create|show|update|delete`、`session create|list`；flag `--name`/`--from-cli`/`--cli`/`--role`/`--dept`/`--duty`/`--contract`/`--skill`/`--capability`/`--max-concurrent`/`--agent`/`--format json`。
**约束**：零 CJK，所有文案经 `ORG_TEXT` + `fill` 下发；按 code 渲染中文原因；`--format json` 直接 `JSON.stringify`；**源码零 `install|chmod|writeFile`**（AC-13）；写入只经注入的 registry `saveOrganization`；中文 `--dept` 经 `codeFromLabel` 转 code。

### 2.11 `src/cli/labels.js`（修改，WP-7）
**导出**：在 `CLI_DISCOVERY_TEXT`（L1254）之后**追加独立 `ORG_TEXT`**（A1 现有键取值逐字不动）。
**内容键**：对象/字段类（组织视图/角色列表/员工列表/会话记录/职责/契约/技能/所需 CLI 能力/所属部门/绑定 CLI/并发上限/可见状态）；操作/成功类（创建角色/创建员工/创建会话记录/角色创建成功/员工创建成功/会话记录已创建/角色定义未改变）；异常原因类（请先移除其下员工/未选择已发现的 CLI/四类内容不得为空/部门必须为六部门之一/未发现该 CLI/能力未探测，无法判定满足，请先做能力探测/不满足所需能力：缺少 {cap}）；证据分级类（证据级别：{level}/mock 实测/待本机实测（需装有目标 CLI 的机器）/已实测（真实宿主面））；`DEPARTMENT` 六项中文映射（产品部/研发管理部/前端部/后端部/测试部/平台安全部）；`REASON` code → 中文原因表；6 态状态词。
**约束**：独立新表、不动既有键与既有计数断言（D-5/D-8）；`grep` 命中 `ORG_TEXT|ORG_`、「请先移除其下员工」、「mock 实测」、`产品部|平台安全部`。

### 2.12 `bin/orch.js`（修改，WP-7）
**改动**：在 `cli` 分支（L24-28）之后追加 `else if (argv[0] === 'org') { const code = await orgMain(argv.slice(1)); process.exit(code); }`；顶部追加 `import { orgMain } from '../src/cli/org.js';`。
**约束**：`core serve` 内部通道、`cli` 分支、`main(argv)` 分支逐字不动（NF-5）。

---

## 3. 数据模型

### 3.1 `.orch/organization.json`（主样例：1 角色 / 2 员工绑不同 CLI / 会话记录）

```json
{
  "schemaVersion": 1,
  "roles": [
    {
      "role_id": "role-1",
      "name": "产品经理",
      "department": "product",
      "duty": "定义产品需求与优先级",
      "contract": "输入：用户反馈；输出：需求文档",
      "skills": "需求分析,优先级排序",
      "required_capabilities": { "acp": true, "max_concurrent_sessions": 2 },
      "created_at": "2026-11-23T10:00:00.000Z",
      "updated_at": "2026-11-23T10:00:00.000Z"
    }
  ],
  "agents": [
    {
      "agent_id": "agent-1",
      "role_id": "role-1",
      "name": "pm-1",
      "cli_id": "codex",
      "department": "product",
      "max_concurrent": 2,
      "status": "available",
      "created_at": "2026-11-23T10:05:00.000Z",
      "updated_at": "2026-11-23T10:05:00.000Z"
    },
    {
      "agent_id": "agent-2",
      "role_id": "role-1",
      "name": "pm-2",
      "cli_id": "claude-code",
      "department": "product",
      "max_concurrent": 1,
      "status": "inactive",
      "created_at": "2026-11-23T10:06:00.000Z",
      "updated_at": "2026-11-23T10:06:00.000Z"
    }
  ],
  "sessions": [
    {
      "session_id": "sess-1",
      "agent_id": "agent-1",
      "cli_id": "codex",
      "created_at": "2026-11-23T10:10:00.000Z",
      "status": "available",
      "evidence_level": "mock"
    },
    {
      "session_id": "sess-2",
      "agent_id": "agent-2",
      "cli_id": "claude-code",
      "created_at": "2026-11-23T10:11:00.000Z",
      "status": "available",
      "evidence_level": "mock"
    },
    {
      "session_id": "sess-3",
      "agent_id": "agent-1",
      "cli_id": "codex",
      "created_at": "2026-11-23T10:12:00.000Z",
      "status": "available",
      "evidence_level": "mock"
    }
  ]
}
```

**样例要点对应边界**：
- `sess-1` 与 `sess-3` 同 `agent_id=agent-1` 但 `session_id` 不同 → 员工实例≠会话（AC-12）。
- `agent-1`/`agent-2` 同 `role_id=role-1` 但 `cli_id` 不同；`role-1` 字段集无 `cli_id` → 一角色多员工、角色不绑定 CLI（AC-07/10）。
- 三条 session 的 `evidence_level` 均为 `"mock"`（code），展示中文由 labels 下发为「mock 实测」（AC-11/NF-3）。

### 3.2 异常态样例（同样落在该文件内，不静默丢失）

```json
{
  "schemaVersion": 1,
  "roles": [
    { "role_id": "role-2", "name": "空角色", "department": "qa", "duty": "", "contract": "", "skills": "", "required_capabilities": {}, "created_at": "…", "updated_at": "…" }
  ],
  "agents": [],
  "sessions": [
    {
      "session_id": "sess-orphan",
      "agent_id": "agent-deleted",
      "cli_id": "codex",
      "created_at": "…",
      "status": "retired",
      "evidence_level": "mock"
    }
  ]
}
```
- `sess-orphan` 的 `agent_id` 指向已删除员工 → AC-06：删员工不静默清除会话记录；`status:"retired"` 为可见枚举，不代表迁移。
- `role-2` 四类内容为空是**历史/非法残留示意**，仅用于展示「缺项拒绝创建」的校验对象；正常写入路径下此类对象不会产生（AC-01）。

### 3.3 事件 / 产物样例（非落盘、用户可见输出）

**成功事件（A-1/A-5/A-8 合并呈现，中文均来自 `ORG_TEXT`）**：
```
角色创建成功
名称：产品经理  所属部门：产品部
职责：定义产品需求与优先级  契约：输入：用户反馈；输出：需求文档  技能：需求分析,优先级排序  所需 CLI 能力：acp, max_concurrent_sessions=2
创建起点：Codex CLI（仅起点提示，角色不绑定该 CLI）
角色：产品经理  员工数：2
  - pm-1  绑定 CLI：Codex CLI
  - pm-2  绑定 CLI：Claude Code
会话记录已创建  pm-1  Codex CLI  2026-11-23T10:10:00.000Z
会话记录列表：3 条（同一员工可有多条）
证据级别：mock 实测
```

**失败事件（领域层返回对象 → CLI 渲染，落盘不发生）**：
```
// 领域层：{ ok:false, code:'ROLE_HAS_AGENTS', params:{ key:'role-1' } }
// 用户可见：删除失败：请先移除其下员工

// 领域层：{ ok:false, code:'CAP_NOT_PROBED', params:{ cap:'acp' } }
// 用户可见：能力未探测，无法判定满足，请先做能力探测

// 领域层：{ ok:false, code:'CAP_MISSING', params:{ cap:'transport' } }
// 用户可见：不满足所需能力：缺少 transport
```

**`--format json` 产物**：直接 `JSON.stringify` 对应 role/agent/session 对象或组织数组，无渲染层（对齐 A1 CLI 纪律）。

**唯一事实源标注**：`.orch/organization.json` 是角色/员工/会话的写入事实源；`.orch/cli-registry.json` 是能力判定的只读上游事实源；用户可见文案的唯一事实源是 `src/cli/labels.js` 的 `ORG_TEXT`。

---

## 4. 工作包拆分（WP-1 ~ WP-8，文件互不重叠）

> 五字段固定；依赖成 DAG；领域层模块通过注入 `deps` 解耦（WP-2~WP-6 仅依赖 WP-1，可并行）。所有 AC 的 CLI 验收统一在 WP-8 进程级落地。

### WP-1 契约基座：schema/model/department（依赖：无）
- **负责文件（3）**：`src/org/schema.js`、`src/org/model.js`、`src/org/department.js`
- **依赖**：无
- **交付**：`SCHEMA_VERSION=1`；三态 6 态枚举与 `EVIDENCE_LEVEL`/`CAPABILITY_DIMENSIONS`/`FAIL` 常量表；`emptyOrganization`/`normalizeOrganization`/`makeRole`/`makeAgent`/`makeSession`/`nextId`；`DEPARTMENTS` 6 code + `isDepartment` + `codeFromLabel`。冻结整个领域数据形状（尤其 `role` 无 `cli_id`、`session` 独立 `session_id`）。
- **验收口径**：`node -e` 检测三文件零 CJK 输出 `OK`；`DEPARTMENTS.length===6`；`makeRole()` 返回对象无 `cli_id` 键；`makeSession()` 两次调用 id 不同。支撑 AC-01/07/08/10/12 的架构检查。
- **可否并行**：可（无依赖，须最先冻结，其余 WP 均依赖本包契约）。

### WP-2 存储层 registry（依赖：WP-1）
- **负责文件（1）**：`src/org/registry.js`
- **依赖**：WP-1
- **交付**：`organizationPath`/`loadOrganization`/`saveOrganization`（原子写）/`findRole`/`findAgent`/`findAgentsByRole`/`loadDiscoveredClis`；`.orch/organization.json` 单文件读写；只读 A1 清单。
- **验收口径**：临时根下 save→load 深层相等；`findAgentsByRole` 返回 `members: role → agents` 形状；不产生 `.orch/cli-registry.json` 写操作；AC-04/07 的 `grep` 命中。
- **可否并行**：可（与 WP-3/4/5/6 并行，仅依赖 WP-1 契约）。

### WP-3 角色域（依赖：WP-1、WP-2 注入）
- **负责文件（1）**：`src/org/role.js`
- **依赖**：WP-1、WP-2（通过 `deps` 注入，非编译期耦合）
- **交付**：`listRoles`/`showRole`/`roleView`/`createRole`/`updateRole`/`deleteRole`；四类内容必填校验、`from_cli` 起点校验、有员工拒删（`ROLE_HAS_AGENTS`）、角色页状态汇总。
- **验收口径**：覆盖 AC-01/02/03/10 的领域判定；`grep -nE 'cli_id' src/org/role.js` 零命中；`grep -REn 'writeFile|mkdir|appendFile' src/org/role.js` 零命中；换绑前后 `showRole` 深层相等。
- **可否并行**：可（与 WP-2/4/5/6 并行）。

### WP-4 员工域（依赖：WP-1、WP-2 注入）
- **负责文件（1）**：`src/org/agent.js`
- **依赖**：WP-1、WP-2（注入）、WP-5 能力校验（注入 `deps.checkCapabilities`，接口已在 WP-1 冻结）
- **交付**：`listAgents`/`showAgent`/`createAgent`/`updateAgent`/`deleteAgent`；绑定与改绑 `cli_id`、同角色同名拒绝、删员工保留会话、状态仅呈现。
- **验收口径**：覆盖 AC-04/05/06 领域判定；`grep -nE 'cli_id|capabilities' src/org/agent.js` 命中；`grep -REn 'transit|CAS' src/org/` 零命中；非法改绑原值不变。
- **可否并行**：可（能力校验函数接口在 WP-1 已冻结，可按契约并行开发）。

### WP-5 能力校验（依赖：WP-1）
- **负责文件（1）**：`src/org/validation.js`
- **依赖**：WP-1
- **交付**：`checkCapabilities`/`unknownCapability`；五维判定、`null` 未探测、缺项 code、未知能力项拒绝；纯函数零副作用。
- **验收口径**：覆盖 AC-09/10 领域判定；五维 `grep` 命中；零 CJK `node -e` 输出 `OK`；不按 `name`/`cli_id` 分支。
- **可否并行**：可（仅依赖 WP-1）。

### WP-6 会话记录域（依赖：WP-1、WP-2 注入）
- **负责文件（1）**：`src/org/session.js`
- **依赖**：WP-1、WP-2（注入）
- **交付**：`createSession`/`listSessions`/`sessionsOf`；会话记录创建、独立 `session_id`、未绑 CLI/能力不满足拒绝、`evidence_level='mock'`。
- **验收口径**：覆盖 AC-11/12 领域判定；`grep -nE 'agent_id|session_id' src/org/session.js` 命中；`grep -REn 'session/(new|prompt)|spawn|initialize' src/org/` 零命中；同一 `agent_id` 两条不同 `session_id`。
- **可否并行**：可（仅依赖 WP-1）。

### WP-7 命令面与文案（依赖：WP-1~WP-6）
- **负责文件（4）**：`src/cli/org.js`、`src/cli/labels.js`、`bin/orch.js`、`src/org/index.js`
- **依赖**：WP-1、WP-2、WP-3、WP-4、WP-5、WP-6
- **交付**：`orgMain` 全子命令与 flag 解析；`ORG_TEXT` 新表；`bin/orch.js` 的 `org` 独立分支；`src/org/index.js` barrel。
- **验收口径**：`grep -nE 'ORG_TEXT|ORG_' src/cli/labels.js` 命中；`grep -nF '请先移除其下员工' src/cli/labels.js` 与 `grep -nF 'mock 实测' src/cli/labels.js` 命中；`grep -REn 'install|chmod|writeFile' src/cli/org.js` 零命中；A1 `cli`/`core serve`/`main` 分支逐字不变。
- **可否并行**：否（整合点，须等 WP-1~6 领域 API 冻结后接入）。

### WP-8 测试与证据脚手架（依赖：WP-7）
- **负责文件（5）**：`test/wp17/fixtures.mjs`、`test/wp17/org-crud.test.js`、`test/wp17/org-capability.test.js`、`test/wp17/org-session.test.js`、`test/wp17/org-acceptance.test.js`
- **依赖**：WP-7
- **交付**：`makeTempRoot`/`writeCliRegistry`（P-3 A1 形状夹具，含 `codex`/`claude-code`/`unknown-cap` 与 `null` 未探测维度）/`runOrg`（进程级 spawn 入口 orch，注入 `NODE_ENV=test`）；4 个测试文件覆盖 AC-01~13 的用户可见断言 + 机检 + 架构检查。
- **验收口径**：4 文件对 13 AC 全绿；A1 `test/wp16/` 零改动；AD-06 等效口径下新增红差集 0；AC-13 端到端链逐段可判、`diff` 无差异。
- **可否并行**：否（依赖完整命令面；内部 4 个测试文件可在夹具冻结后分工并行编写）。

### AC → WP 满覆盖映射

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-3 | WP-1、WP-7、WP-8 | 角色创建四类内容+起点校验；`role.js` 零 `cli_id`/零写盘 |
| AC-02 | WP-3 | WP-7、WP-8 | 角色查看/修改；非法更新原值不变 |
| AC-03 | WP-3 | WP-7、WP-8 | 有员工拒删 `ROLE_HAS_AGENTS`；文案键在 labels |
| AC-04 | WP-4 | WP-1、WP-2、WP-7、WP-8 | 员工绑定具体 CLI；不写回 A1 清单 |
| AC-05 | WP-4 | WP-5、WP-7、WP-8 | 改绑能力校验；状态仅呈现、零 `transit|CAS` |
| AC-06 | WP-4 | WP-2、WP-8 | 删员工保留会话记录 |
| AC-07 | WP-3、WP-4 | WP-1、WP-2、WP-8 | 一角色挂 2 员工（`members: role → agents`）；角色定义不变 |
| AC-08 | WP-1 | WP-7、WP-8 | 六部门枚举+校验；中文只在 labels |
| AC-09 | WP-5 | WP-2、WP-7、WP-8 | 五维判定、未探测不臆造、按能力非名称 |
| AC-10 | WP-3、WP-4 | WP-5、WP-8 | 换绑满足能力 CLI；角色对象深层相等 |
| AC-11 | WP-6 | WP-2、WP-7、WP-8 | 两人各建会话记录、互不串台、证据「mock 实测」 |
| AC-12 | WP-6 | WP-1、WP-8 | 同一员工两条独立 `session_id`、员工配置数不变 |
| AC-13 | WP-8 | WP-1~WP-7 | 端到端整句：选 CLI→建角色→挂 2 员工→各建会话→换绑→角色不变 |

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/org/schema.js` | schemaVersion、6 态枚举、证据级别码、五维常量、失败码表 | WP-1 |
| `src/org/model.js` | `emptyOrganization`/`normalizeOrganization`/`makeRole`/`makeAgent`/`makeSession`/`nextId` | WP-1 |
| `src/org/department.js` | `DEPARTMENTS` 6 code、`isDepartment`、`codeFromLabel` | WP-1 |
| `src/org/registry.js` | organization.json 原子读写、关系查询、A1 清单只读 | WP-2 |
| `src/org/role.js` | 角色 CRUD、`roleView`、有员工拒删 | WP-3 |
| `src/org/agent.js` | 员工 CRUD、绑定/改绑、删员工保留会话 | WP-4 |
| `src/org/validation.js` | 五维能力校验纯函数 | WP-5 |
| `src/org/session.js` | 会话记录创建与列举（mock 语义） | WP-6 |
| `src/org/index.js` | barrel 导出、`orgApi` | WP-7 |
| `src/cli/org.js` | `orgMain` 子命令分派、flag 解析、渲染 | WP-7 |
| `src/cli/labels.js` | 追加独立 `ORG_TEXT` 表（旧键不动） | WP-7 |
| `bin/orch.js` | 追加 `argv[0]==='org'` 分支（旧分支不动） | WP-7 |
| `test/wp17/fixtures.mjs` | 临时根、P-3 CLI 夹具、进程级运行器 | WP-8 |
| `test/wp17/org-crud.test.js` | AC-01~08 断言 | WP-8 |
| `test/wp17/org-capability.test.js` | AC-09/10 断言 | WP-8 |
| `test/wp17/org-session.test.js` | AC-11/12 断言 | WP-8 |
| `test/wp17/org-acceptance.test.js` | AC-13 端到端链断言 | WP-8 |

---

## 6. 依赖与并行策略

**DAG 文本图**：
```
WP-1 (契约基座: schema/model/department)
 ├──────────┬──────────┬──────────┬──────────┐
 WP-2       WP-3       WP-4       WP-5       WP-6
(registry) (role)     (agent)   (validation)(session)
 └──────────┴──────────┴──────────┴──────────┘
                    │
                  WP-7 (命令面 + 文案 + 分流 + barrel)
                    │
                  WP-8 (测试与证据)
```
- WP-2~WP-6 之间**无编译期依赖**（通过 WP-1 冻结的接口 + 注入 `deps` 解耦）；WP-4 对能力校验仅依赖 WP-1 已冻结的 `checkCapabilities` 签名。

**分批顺序**（AD-10：一次 ≤2 个大 Agent 并行）：
- **第 0 批（单线，冻结）**：WP-1 —— 领域数据形状与函数签名全部定死，产出可 import 的骨架。
- **第 1 批（并行，2 组）**：{WP-2, WP-3} 与 {WP-4, WP-5} 分两轮；WP-6 随第 1 批末位或第 2 批首位单线补齐。
- **第 2 批（单线，整合）**：WP-7 —— 接入命令面、`ORG_TEXT`、`org` 分流，跑通进程级 `org role create`。
- **第 3 批（单线，验收）**：WP-8 —— 夹具冻结后 4 个测试文件可分工并行编写，最终汇总门禁。

**契约先冻结点**（WP-1 完成即冻结，之后下游按契约并行）：
1. `organization.json` 三段形状与字段集（**role 无 `cli_id`**、session 独立 `session_id`、agent 含 `role_id`+`cli_id`）。
2. 所有领域函数签名与 `{ok:false,code,params}` 返回形状；失败 code 表（`ROLE_HAS_AGENTS`/`CAP_NOT_PROBED`/`CAP_MISSING`/`CAP_UNKNOWN`/`AGENT_EXISTS`/`CLI_NOT_FOUND`/`DEPT_INVALID`/`CONTENT_EMPTY`/`NO_CLI_SELECTED` 等）。
3. `DEPARTMENTS` 6 code 与 `ORG_TEXT.DEPARTMENT` 中文映射、`CAPABILITY_DIMENSIONS` 五维、`SESSION_STATUS` 6 态取值、`EVIDENCE_LEVEL` 三码。
4. `org` 子命令与 flag 字面、退出码 0/1/2、`--format json` 输出约定。

**整合检查点（3 个）**：
- **CP-1（WP-1 后）**：跑 §2.1~2.3 的零 CJK 检测、`DEPARTMENTS.length===6`、`makeRole` 无 `cli_id`；冻结契约后方可放行下游。
- **CP-2（WP-2~6 后、WP-7 前）**：跑 WP-2/3/4/5/6 的架构 `grep`（零 `transit|CAS`、零 `session/(new|prompt)|spawn|initialize`、`role.js` 零 `cli_id`、五维命中）；领域层单测（save→load 深层相等、能力判定矩阵）。
- **CP-3（WP-7+WP-8 后）**：全 CLI 进程级用例 + AC-13 端到端链；purity 11 词并集 exit 0；A1 `test/wp16/` 与文案计数断言零 diff；AD-06 等效口径新增红差集 0；证据分级三态核对（会话 13 处「mock 实测」、真实宿主达标 0 处）。

---

## 7. 风险与降级

| # | 风险 | 影响 | 处置（点名文件/函数） |
|---|---|---|---|
| R-1 | 角色被误写入 `cli_id`，破坏「角色不绑定 CLI」 | AC-10 失败、核心边界失真 | `src/org/model.js` 的 `makeRole` 字段集不含 `cli_id`；`src/org/role.js` 全程不出现该字符串；CP-1/CP-2 以 `grep -nE 'cli_id' src/org/role.js` 零命中拦截 |
| R-2 | 真实 ACP 会话被偷渡实现（spawn/session-new） | 违反 AS-01、mock 冒充真实证据 | `src/org/session.js` 的 `createSession` 仅调 `makeSession`；CP-2 以 `grep -REn 'session/(new\|prompt)\|spawn\|initialize' src/org/` 零命中拦截；会话 `evidence_level` 恒为 `EVIDENCE_LEVEL.MOCK` |
| R-3 | 领域层混入中文 | NF-4 / AC-01/09 架构检查失败 | 所有 `src/org/**` 与 `src/cli/org.js` 零 CJK；中文原因统一为 `FAIL` code → `labels.js` 的 `ORG_TEXT.REASON`；CP-1 用 `node -e` CJK 检测 |
| R-4 | 既有文案计数断言变红（REASON_LABEL 49 / USAGE_LINES 25 / DESKTOP_LABEL_KEYS 64+63 / checkpoint 全键） | NF-5 回归失败 | `src/cli/labels.js` 只追加独立 `ORG_TEXT`，不动 `CLI_DISCOVERY_TEXT` 等既有表；若变红属越界，回退实现而非放宽断言（D-8） |
| R-5 | 改到 `main.js` 冻结 parser 或 `cli` 分支 | NF-5 回归、A1 CL I 分派被破坏 | `bin/orch.js` 仅追加 `org` 分支；`src/cli/org.js` 自带独立 parser；CP-3 对 A1 分支与 `test/wp16/` 做 `git diff` 零改动核对 |
| R-6 | 能力判定按 `name`/`cli_id` 硬配或把 `null` 当支持 | AC-09 失败、选错 CLI | `src/org/validation.js` 的 `checkCapabilities` 只遍历 `CAPABILITY_DIMENSIONS`；`null` → `CAP_NOT_PROBED`；code review 核对无 name/cli_id 分支；WP-5 单测覆盖三态 |
| R-7 | 删员工时静默清除会话记录 | AC-06 失败、可见历史丢失 | `src/org/agent.js` 的 `deleteAgent` 只删 `agents[]`，返回 `remainingSessions` 供 `src/cli/org.js` 提示；`test/wp17/org-crud.test.js` 断言 sessions 不变 |
| R-8 | 多文件写入导致半提交 | AC-04/07 一致性失败 | 单文件 `.orch/organization.json`；`src/org/registry.js` 的 `saveOrganization` 用临时文件 + `rename`；唯一写入点 |
| R-9 | 换绑后角色对象被意外改写 | AC-10 失败 | `src/org/role.js` 不改 role；`src/org/agent.js` 的 `updateAgent` 只改 `agent.cli_id`；AC-10 用例 `role show` 前后 `diff` 必须无差异 |
| R-10 | 会话 `session_id` 与 `agent_id` 复用、串台 | AC-11/12 失败 | `src/org/model.js` 的 `nextId` 用注入 `clock`+`existing` 保证唯一；`src/org/session.js` 的 `sessionsOf` 按 `agent_id` 过滤；WP-6 单测断言两条 id 不同 |
| R-11 | 本机全量门禁 EXIT 137 / 17 条既有红被误判为新增 | AD-06 口径破坏 | 采用受影响面串行 + git worktree 基线树对照、新增红差集 0；如实标注基线 `# tests 1983 / # fail 17`；不放宽任何 AC 判据（需求 §3.3 P-5） |
| R-12 | 一次并行超过 2 个 Agent 触发平台 429 | 派单中断 | AD-10 严格 ≤2 并行；修复类单线；每 Agent 分批落盘证据；WP-2~6 按 §6 分两轮推进 |

---

## 8. 与需求的对齐声明 / 冲突清单

本文档不新增需求条目。所有用户可见文案（附录 A）、状态名（6 态）、错误原因（BR/AC 所列）、证据分级词、AC 编号与判定强度，均以 `docs/iterations/iteration-A2/requirement.md` **v2** 为准；两者冲突时**以需求为准**，并在实现结论中指出。

**与代码现状/需求措辞的潜在歧义及本拆分的处置**（均不改动需求）：
- **R1（会话 6 态具体取值）**：需求 §2.9 / 附录 A-0 只说「会话状态词沿用基线 §4 会话 6 态中的可见取值」，未在本文档引用范围内逐字列出该 6 态字符串。本拆分在 `schema.js` 的 `SESSION_STATUS` 暂与角色 6 态同值（`inactive/available/busy/cooldown/unavailable/retired`）作**呈现用**枚举，不实现迁移。**需评审裁决**：确认会话 6 态的逐字取值；若与基线 §4 不一致，仅改 `schema.js` 常量与 labels 展示词，不动任何 AC。
- **R2（单文件 vs 目录措辞）**：需求 §7 / BR-13 写 `.orch/organization/`，D-2 允许「单一 organization.json 分段」。本拆分选单文件 `.orch/organization.json`（§1.1）。两者语义一致（项目缓存、非用户目录），以 D-2 的授权为准；若主控坚持目录形态，仅调整 `registry.js` 的路径常量，AC 判定不变。
- **R3（部门表示）**：需求 A-0 称「六个中文键经 ORG_TEXT 下发、领域层零 CJK」。本拆分以英文 code 落领域层、中文经 `labels.js` 映射，正是「领域层零 CJK + 中文只在 labels」的可实现形态；不新增第七个部门，不改六部门集合。
- **R4（能力维度写法）**：按 U-02 默认用 A1 五维原生键，不引入 `acp.acp_support` 等命名空间写法；如需支持，须回改需求 §2.8/BR-09/AC-09 机检，本拆分不自行扩展。
- **R5（命令字面）**：`org` 子命令与 flag 字面为 D-6/U-04 的实现建议，只进入机检/夹具/P-4，未写进任何 AC 的 Then；若主控另指定命令字面，只改实现锚点与机检/夹具，不放宽任何 AC。

**明确不做的越界项**（对齐范围外）：不实现 Team 编排（A3）、工作流（A4）、真实 ACP 会话驱动/状态机迁移/CAS/按能力调度/真实并行（A5/B1）、桌面 UI（C1）、CLI 发现重做（A1）；不删除或放宽 AC-11，不用 mock 冒充真实宿主达标（AD-08 / NF-3 / AS-01）。
