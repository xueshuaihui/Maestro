# A2 — 需求理解纪要（S0 评审 PASS 后产出）

> **产物定位**：执行模板 §1.0.5 派单 C 产物。读定稿需求产出理解纪要，**不修改需求正文**（不改 `requirement.md` / 评审记录 / 三件套 / `src/**` / `test/**`；不提交 git）。
> **输入基线**：
> - 定稿需求 `docs/iterations/iteration-A2/requirement.md` **v2**（13 AC / 14 BR / 5 NF；头部版本 L7 = 附录 C 末行 L451，均 v2）。
> - 评审 `review-round1.md` 总判 **PASS**（F-01~F-04 建议 + AS-01 待裁决）→ `review-round2.md` 总判 **PASS**：阻断 0 / 新增 FAIL 0 / 上轮 F 项全部「已修」，回归扫描无新增，AS-01 已记录、AC-11 未变。
> - 适配裁决 `docs/iterations/A-phase-decisions.md` AD-01~AD-10（尤其 AD-04 macOS 路径 / os.tmpdir / NODE_ENV=test、AD-05 A1 已有实现仅作现状参考、AD-06 全量门禁等效口径、AD-07 purity 11 词并集、AD-08 真实宿主未取证判阻塞 + 能力/编排/数据层用 mock 实测）。
> **引用行号**：下列 `requirement.md:Lxxx` 均指 v2 定稿文件行号（全文末行 L515），便于逐条复核。
> **现状复核（事实锚点，HEAD `3e47a51`）**：`bin/orch.js:22-32` 三条分派——`core serve` 内部通道 / `argv[0]==='cli'` → `cliDiscoveryMain(argv.slice(1))` / else → `main(argv)`（冻结的 I1.x parser）；A1 五维常量在 `src/adapter/cli-discovery/capability-matrix.js:13-19`（`acp`/`transport`/`resume_dialect`/`max_concurrent_sessions`/`evidence_hook`）；`.orch/cli-registry.json` 形状由 `src/adapter/cli-discovery/registry.js:127-150` `saveCliRegistry` 定义（含 `schemaVersion`/`clis[]`，每条含 `cli_id`/`name`/`executable`/`capabilities` 与五维字段 + `connection_status`）；`src/cli/labels.js:1254` 为 `CLI_DISCOVERY_TEXT`（尚无 `ORG_TEXT`）；当前仓库**无** `src/org/**`、**无** `org` 命令分支。以上仅为现状定位，不作需求来源。

---

## 1. 范围 In / Out（逐条对应需求 §1.3，L41–L65）

### 1.1 范围内（本次让用户获得的新能力，9 条，L43–L53）

| # | 范围内条目 | 规划落点 | 对应 AC | 需求行 |
|---|---|---|---|---|
| IN-1 | **从已发现 CLI 创建角色，填写职责/契约/技能/所需 CLI 能力四类内容**，可查看/修改/删除 | 389 行 + 391 行验收前半 | AC-01/02/03 | L45（§2.2/§2.3 L86–102） |
| IN-2 | **员工 CRUD 并绑定具体 CLI**：从已发现清单选具体 CLI 绑定，可查/改（含改绑）/删 | 389 行 | AC-04/05/06 | L46（§2.4/§2.5 L104–120） |
| IN-3 | **一角色多员工**：一角色挂 2 名及以上员工，各绑同一或不同 CLI，角色≠Agent | 390 行 + 391 行「挂 2 名员工」 | AC-07 | L47（§2.6 L122–129） |
| IN-4 | **部门归属**：角色与员工归属六部门之一，只做 CRUD 与校验，不做团队编排 | 390 行 | AC-08 | L48（§2.7 L131–138） |
| IN-5 | **角色能力校验**：按员工绑定 CLI 的 A1 五维能力判定，不按 CLI 名称硬配，不满足给可见原因 | 390 行 | AC-09 | L49（§2.8 L140–147） |
| IN-6 | **角色不绑定死某个 CLI**：换绑满足能力的另一已发现 CLI，角色定义不变 | 391 行验收末句 | AC-10 | L50（§2.8 L140–147） |
| IN-7 | **两人可各自建会话（A2 记录语义）**：为两名员工各建一条独立会话记录；真实 ACP 驱动不在本迭代，mock 取证并分级 | 391 行「两人可各自建会话」 | AC-11 | L51（§2.9 L149–156） |
| IN-8 | **员工实例≠会话**：同一员工可开多条会话记录，会话不等于员工本身 | §2.1 关键规则 3 | AC-12 | L52（§2.9 L149–156） |
| IN-9 | **规划验收句整句不降级**：由 AC-13 端到端联合判定，逐字保留、不收窄、不合并 | 391 行整句 | AC-13 | L53（§2.10 L158–162） |

### 1.2 范围外（本次不覆盖，9 项，L55–L65）

| # | 范围外条目 | 留待 / 归属 | 需求行 |
|---|---|---|---|
| OUT-1 | Agent Team 拖拽编排、负责人/并发/协作规则、团队模板 | A3；A2 只产可编排的部门/角色/员工对象与归属关系 | L57 |
| OUT-2 | 12 阶段工作流、门禁、三种运行模式、自定义 DAG | A4 | L58 |
| OUT-3 | 真实 ACP 会话驱动、会话恢复方言、状态机迁移（节点 9 态/会话 6 态/角色 6 态迁移与 CAS）、按能力调度、一角色多员工真实并行 | A5 与阶段 B（**B1** / B2）；A2 只做「创建会话记录」语义，不启动真实会话 | L59 |
| OUT-4 | 跨 CLI 混跑、同一 Team 多 CLI 员工、跨项目复用、第二 CLI 真机接入 | D1 / D2 / D3；A2「换绑」用 A1 mock 夹具取证，不代表真机就绪 | L60 |
| OUT-5 | 桌面壳与组织/部门视图视觉设计、拖拽交互、系统托盘、后台 daemon 常驻 | C1；A2 只保证语义与可复现接缝 | L61 |
| OUT-6 | CLI 扫描、能力探测、重新扫描、手动添加 CLI | A1 已完成；A2 只读消费 `cli_id` 与能力矩阵，不重新实现发现 | L62 |
| OUT-7 | 替用户安装 CLI、修改用户 CLI 配置、写用户系统目录 | 永久范围外（§2.2 边界 / §8 第 3 条）；A2 只写 `.orch/organization/` | L63 |
| OUT-8 | 网页版客户端控制 | 永久范围外（§8 第 2 条） | L64 |
| OUT-9 | 真实宿主取证机器 | AD-08 / D-2 / D-4；A2 会话为 mock 面，真实 ACP 驱动取证由 **B1** 承担，未取证不写「真实宿主达标」 | L65 |

> 用户指定的两项范围外已覆盖：**A3 团队编排 = OUT-1**，**B1 真实会话驱动 = OUT-3**。

---

## 2. AC 清单与分面（13 条，L185–L330）

**面类型口径**：
- **mock 面**：在 `NODE_ENV=test` + 独立项目根 + A1 `cli-registry` mock 夹具（P-2/P-3）上可复现——**A2 全部 13 条 AC 均为 mock 面**。
- **真实宿主面**：需装目标 CLI 的机器取证、未取证判阻塞——**A2 为 0 条**（与 A1 的关键差异：A1 的 AC-12 为真实宿主面且阻塞；A2 会话语义全部收敛为记录创建，见 AS-01 / U-01）。AC-11/12/13 的会话证据级别一律「mock 实测」，**0 次冒充真实宿主达标**（NF-3 / P-6）。

| AC | 一句话场景 | 分面（主） | 面类型 | 需求行 |
|---|---|---|---|---|
| AC-01 | 从 A1 已发现 CLI 建角色，填齐四类内容 + 合法部门；缺项/未选 CLI 被拒 | 角色 CRUD（增） | mock 面 | L189–198 |
| AC-02 | 查看角色并改「技能」「所需 CLI 能力」；非法更新被拒且原值不变 | 角色 CRUD（读/改） | mock 面 | L200–209 |
| AC-03 | 有员工的角色拒删并提示先移除；无员工角色可删，员工不被连带删除 | 角色 CRUD（删/异常） | mock 面 | L211–220 |
| AC-04 | 在角色下创建员工并绑定具体已发现 CLI；未发现 CLI 被拒，角色不记录绑定 | 员工 CRUD（增/绑定 CLI） | mock 面 | L222–231 |
| AC-05 | 查看员工并改绑另一满足能力的已发现 CLI；非法改绑被拒，状态可见、角色页汇总 | 员工 CRUD（读/改） | mock 面 | L233–242 |
| AC-06 | 删除员工；有会话记录时提示「记录仍保留」，不静默丢弃 | 员工 CRUD（删/异常） | mock 面 | L244–253 |
| AC-07 | 同角色挂 2 名员工各绑不同已发现 CLI；角色定义不变，角色≠Agent 对用户可见 | 一角色多员工（关键判断点） | mock 面 | L255–264 |
| AC-08 | 用六部门之一/空/六部门外名称建角色与员工；非法被拒、不产生「无部门」对象 | 部门归属（异常） | mock 面 | L266–275 |
| AC-09 | 绑定 Codex（满足）vs 第二条（未探测）vs 不存在能力：按五维判定、未探测不臆造 | 能力校验（满足/不满足/未探测） | mock 面 | L277–286 |
| AC-10 | 员工从 Codex 换绑第二条满足能力 CLI，角色四类内容/部门/能力逐字不变 | 能力校验（角色不绑死 CLI） | mock 面 | L288–297 |
| AC-11 | 为 pm-1/pm-2 各建一条会话记录：各自独立、关联对应员工与 CLI、互不串台，证据「mock 实测」 | 会话记录（两人各建，mock） | mock 面 | L299–308 |
| AC-12 | 同一员工 pm-1 再建第二条会话：两条独立 session_id、员工配置数不变 | 会话记录（员工实例≠会话，mock） | mock 面 | L310–319 |
| AC-13 | 端到端联合：选 CLI 建角色→挂 2 员工→各建会话→换绑 CLI→角色不变，逐段可判不降级 | 端到端验收句整句（mock） | mock 面 | L321–330 |

### 2.1 分面统计（按主分面归类，合计 13）

| 分面 | AC | 条数 |
|---|---|---|
| 角色 CRUD | AC-01、AC-02、AC-03 | 3 |
| 员工 CRUD（含绑定具体 CLI / 改绑） | AC-04、AC-05、AC-06 | 3 |
| 一角色多员工 | AC-07 | 1 |
| 部门归属 | AC-08 | 1 |
| 能力校验（含角色不绑死 CLI） | AC-09、AC-10 | 2 |
| 会话记录（mock 面） | AC-11、AC-12 | 2 |
| 端到端验收句整句（mock 面） | AC-13 | 1 |
| **合计** | | **13** |

### 2.2 面类型统计

- **mock 面：13 条**（AC-01~AC-13，全部）——均在独立项目根 + `NODE_ENV=test` + P-3 `cli-registry` mock 夹具上可复现；会话面 AC-11/12/13 证据级别「mock 实测」（附录 A-8）。
- **真实宿主面：0 条**——A2 无阻塞面；真实 ACP 会话驱动归 B1（OUT-3 / U-01）。

---

## 3. BR / NF / M / C 契约清单

### 3.1 业务规则 BR-01~BR-14（14 条，§2.11 L164–L179）

| BR | 摘要 | 需求行 |
|---|---|---|
| BR-01 | 创建角色必须从 A1 已发现 CLI 清单选一个作为起点，不能手填不存在的 CLI | L166 |
| BR-02 | 角色须记录并展示职责/契约/技能/所需 CLI 能力四类内容，缺项拒绝并给可见原因 | L167 |
| BR-03 | 角色可增删改查；删除时其下仍有员工则拒绝并提示先移除员工，员工不被连带删除 | L168 |
| BR-04 | 员工必须绑定一个 A1 已发现的具体 CLI；同角色不同员工可绑同一或不同 CLI | L169 |
| BR-05 | 角色不绑定死某个 CLI——只声明所需能力、员工才绑具体 CLI；换绑满足能力的另一已发现 CLI 后角色定义（四类内容+部门）不变 | L170 |
| BR-06 | 员工可增删改查；改包括改绑另一已发现 CLI；非法/未发现/能力不满足的绑定被拒并给原因 | L171 |
| BR-07 | 一角色可挂 2 名及以上员工，角色≠Agent；角色定义不随某员工 CLI 变化 | L172 |
| BR-08 | 角色与员工都必须归属六部门之一；空归属或六部门外名称被拒 | L173 |
| BR-09 | 按员工绑定 CLI 的 A1 五维能力（ACP/transport/会话恢复方言/并发上限/证据钩子）判定；未探测不臆造为支持；满足才可绑定与建会话，不满足给缺哪项能力原因 | L174 |
| BR-10 | 可为两名员工各建一条会话记录、互不串台；A2 仅建记录，真实 ACP 驱动属 B1，证据「mock 实测」 | L175 |
| BR-11 | 员工实例≠会话——同一员工可再开一条独立会话记录，会话不等于员工配置本身 | L176 |
| BR-12 | 员工有可见状态（取值与基线 §4 角色 6 态在员工层体现一致），角色层显示员工状态汇总；只呈现、不迁移（B1） | L177 |
| BR-13 | A2 所有写入只落 `.orch/organization/`，不改 A1 CLI 清单、不改用户 CLI 配置、不写用户系统目录 | L178 |
| BR-14 | 用户可见操作结果数秒内呈现，拒绝给具体原因而非静默失败或缺省默认值 | L179 |

> 评审复核：`review-round2.md` D③ 实跑 BR 双向覆盖——定义 14 / 引用 14 / 零孤立 / 39 次引用覆盖 13 AC。

### 3.2 非功能验收 NF-1~NF-5（5 条，§3.2 L332–L338）

| NF | 摘要 | 需求行 |
|---|---|---|
| NF-1 | 用户可感知的响应：建角色/建改员工/查能力校验/建会话记录数秒内出结果或反馈；拒绝给具体原因 | L334 |
| NF-2 | 数据与配置隔离：A1 CLI 清单与用户 CLI 配置无可见变化，新增写入只在 `.orch/organization/` | L335 |
| NF-3 | 证据分级真实：三态标注；A2 会话面为「mock 实测」，真实 ACP 属 B1，mock 0 次冒充真实证据 | L336 |
| NF-4 | 中文唯一来源 / 零 CJK：新增中文只经 `src/cli/labels.js` 的 `ORG_TEXT` 下发；`src/org/**` 零 CJK | L337 |
| NF-5 | 基线不回归：AD-06 等效口径（受影响面串行 + git worktree 基线树对照，新增红差集 0）；A1 既有断言逐字不放宽，不因新增 `org` 命令族改动 `cli` 分派 | L338 |

### 3.3 M / C 契约

**本迭代未定义 M/C 契约。** 需求 §2/§3 仅定义 BR-01~BR-14、AC-01~AC-13、NF-1~NF-5 与前置条件 P-1~P-6（L340–L347）；无独立 M（里程碑）契约与 C（契约）契约条目。附录 D 的 D-1~D-9 是实现建议/约束，不充当 M/C 契约。

---

## 4. 附录 A / D 索引

### 4.1 附录 A 输出基线（用户可见文案，L351–L424）

- **A-0 可变值约定与文案键摘要（L353–L359）**：占位符 `[角色名]/[员工名]/[部门]/[CLI 名]/[能力项]/[原因]/[时间]/[数量]/[状态]` 取证时按实际替换。本迭代新增/涉及的中文**统一经 `src/cli/labels.js` 的 `ORG_TEXT` 下发、不硬编码**；A1 `CLI_DISCOVERY_TEXT` 现有键取值逐字不变，只追加独立新表。文案键摘要：
  - 对象/字段类：`组织视图`、`角色列表`、`员工列表`、`会话记录`、`职责`、`契约`、`技能`、`所需 CLI 能力`、`所属部门`、`绑定 CLI`、`并发上限`、`可见状态`。
  - 操作/成功类：`创建角色`、`创建员工`、`创建会话记录`、`角色创建成功`、`员工创建成功`、`会话记录已创建`、`角色定义未改变`。
  - 异常原因类：`请先移除其下员工`、`未选择已发现的 CLI`、`四类内容不得为空`、`部门必须为六部门之一`、`未发现该 CLI`、`能力未探测，无法判定满足，请先做能力探测`、`不满足所需能力：缺少 {cap}`。
  - 证据分级类：`证据级别：{level}`、`mock 实测`、`待本机实测（需装有目标 CLI 的机器）`、`已实测（真实宿主面）`。
  - **六部门枚举键**：`产品部`/`研发管理部`/`前端部`/`后端部`/`测试部`/`平台安全部`（领域层零 CJK，经 `ORG_TEXT` 下发）。
  - 五维能力展示词沿用 A1 能力矩阵：`ACP`/`transport（传输方式）`/`会话恢复方言`/`并发上限`/`证据钩子`；「未探测」按 A1 口径显示、不写成「不支持」。
  - 员工可见状态取值与基线 §4 角色 6 态一致（`inactive`/`available`/`busy`/`cooldown`/`unavailable`/`retired`），本迭代**仅呈现、不迁移**（B1）。
- **A-1~A-8 样例（L361–L424）**：A-1 角色创建与详情、A-2 角色 CRUD 异常、A-3 员工详情、A-4 员工创建/改绑、A-5 一角色多员工、A-6 能力校验结果、A-7 部门归属校验、A-8 会话记录与证据分级（会话面一律写「mock 实测」，不写「已实测（真实宿主面）」）。

### 4.2 附录 D 实现约束要点（D-1~D-9，L453–L515）

- **D-1 现状差距（L457–L461）**：已具备（现状参考、不作需求来源）——A1 的 `.orch/cli-registry.json`（`registry.js:127-150`）、五维常量（`capability-matrix.js:13-19`）、`bin/orch.js:24-28` 的 `cli` 分派、`labels.js:1254` 的 `CLI_DISCOVERY_TEXT`、A1 测试 `test/wp16/cli-*.test.js`；当前无 `src/org/**`。差距（S2 补齐，7 项均有 §2/§3 落点）：角色 CRUD、员工 CRUD、一角色多员工、部门归属、能力校验、会话记录、`org` 命令族与 `ORG_TEXT`。不得因 A1 已有代码跳过任何 AC（AD-05）。
- **D-2 数据布局与事实源（L463–L467）**：新增写入只在 `.orch/organization/`；A1 `.orch/cli-registry.json` 为**只读上游输入**，能力判定唯一数据源是其 `clis` 数组、不引入第二份能力数据；写入原子化（临时文件 + rename）；员工删除不静默清除会话记录。
- **D-3 对象关系（L469–L474）**：角色→员工列表（一 `role_id` 对 N `agent_id`，角色记录不含固定 `cli_id` 字段）；员工含 `role_id`/`cli_id`/部门/并发上限/可见状态；会话含独立 `session_id`/`agent_id`/`cli_id`/创建时间/状态；状态仅呈现、不实现 `transit()`/CAS。
- **D-4 能力校验（L476–L480）**：只消费 A1 五维字段，`null`/未探测按「无法判定满足」处理，不臆造、不按 `name`/`cli_id` 硬配；校验函数纯函数、零 CJK、可单测。
- **D-5 中文文案（L482–L485）**：在 `CLI_DISCOVERY_TEXT` 之外**追加独立 `ORG_TEXT` 表**，A1 现有键逐字不动，既有计数断言不受影响；六部门名/错误原因/证据级别/状态词均经 `ORG_TEXT` 下发，`src/org/**` 零 CJK。
- **D-6 命令面（L487–L491）**：在 `bin/orch.js:24-28` 的 `cli` 分支之后追加 `argv[0]==='org'` 分支转调 `src/cli/org.js` 的 `orgMain`；`core serve` 内部通道与 `cli` 分支行为不动；子命令/`--flag` 字面为实现建议，仅进机检/夹具/P-4，不写进 AC 的 Then（U-04）。
- **D-7 测试与夹具接缝（L493–L498）**：独立项目根 `mktemp -d /tmp/maestro-a2-<场景>.XXXXXX`（macOS `os.tmpdir()`）、统一 `NODE_ENV=test`；「已发现 CLI」按 P-3 夹具；新增测试建议 `test/wp17/org-crud.test.js`（AC-01~08）/`org-capability.test.js`（AC-09/10）/`org-session.test.js`（AC-11/12）/`org-acceptance.test.js`（AC-13）；全量门禁按 AD-06。
- **D-8 授权断言修改清单（点名文件 + 行号 + 只改哪段，「只加不改」，L500–L509）**：
  1. `bin/orch.js:24-28`：在 `cli` 分支后追加 `org` 分支；`core serve` 内部通道与 `cli` 分支逐字不动。
  2. `src/cli/labels.js:1254`：在 `CLI_DISCOVERY_TEXT` 后追加独立 `ORG_TEXT` 表；A1 现有键取值逐字不动。
  3. 新增 `src/org/**`（`department.js`/`role.js`/`agent.js`/`session.js`/`validation.js`/`registry.js`/`index.js`）：实现部门枚举、角色/员工/会话关系、能力校验、`.orch/organization/` 读写；领域层零 CJK。
  4. 新增 `src/cli/org.js`：`org` 命令族分派与 flag 解析；只登记/读写项目缓存，不安装/不修改 CLI。
  5. 新增 `test/wp17/org-*.test.js`：AC-01~AC-13 新断言；既有 A1 断言逐字不改、不放宽。
  6. **已核、明确不改的精确断言**：`test/wp2/labels.test.js:271`（`REASON_LABEL` 49 键）、`test/wp9/i19-labels.test.js:293`/`test/wp15/regression.test.js:156`（`USAGE_LINES` 25 行）、`test/wp14/labels-drill.test.js:303-312`（`DESKTOP_LABEL_KEYS` 64+63 键）、`test/wp13/checkpoint.test.js:105`（checkpoint 全键冻结）；`test/wp16/cli-discovery.test.js`/`cli-probe.test.js`/`cli-add.test.js`/`cli-matrix-data.test.js`/`cli-command.test.js`/`cli-acceptance.test.js`（A1 断言，NF-5）。若变红属越界改动，须回退实现而非放宽断言。
- **D-9 编号与标题形态（L511–L515）**：BR-01~14 / AC-01~13 / NF-1~5 连续、三件套 + 机检/夹具/架构检查锚点齐全、BR 双向覆盖；规划 389~391 行逐字映射与三条概念核心边界映射见原文。

---

## 5. 未决问题与假设（附录 B-2，L438–L444）

| ID | 状态 | 是否阻塞开工 | 摘要 | 依据 |
|---|---|---|---|---|
| U-01 | **已由 AS-01 裁决（不阻塞）** | 不阻塞 | A2「两人可各自建会话」= 两条独立会话记录的可验证语义；评审 AS-01 已确认：A2 会话为语义层记录、mock 取证，**真实驱动归 B1**，AC-11 保持不变。若主控改判 A2 必须驱动真实会话，须前置 B1 并重拆迭代，不接受默默放宽 AC-11 | L440 |
| U-02 | 不阻塞（默认已定） | 不阻塞 | 所需能力判定维度默认直接用 A1 五维，不引入命名空间写法；与 A1 能力矩阵同源、不臆造。若评审要求命名空间式标签，需同步改 §2.8/BR-09/AC-09 机检/A-0，不放宽判据 | L441 |
| U-03 | 不阻塞（默认已定） | 不阻塞 | 「挂 2 名员工」默认绑定 A1 mock 夹具中两条不同已发现 CLI；本机仅 WorkBuddy.app 的限制用 P-3 夹具绕过，不依赖真机多 CLI | L442 |
| U-04 | 不阻塞（默认已定） | 不阻塞 | 用户可见操作面默认 `org` 命令族（D-6），桌面视图属 C1；命令字面为实现建议、不写进 AC Then | L443 |
| U-05 | 不阻塞（范围外已界定） | 不阻塞 | §3.3 待验证项「一角色多员工是否产生工作区串台」真实并行验证属 A5/B1；A2 只验「关系可建立、角色不随员工变化」 | L444 |

**阻塞开工的未决问题清单：无。** U-01 已由 AS-01 裁决（会话语义层 mock、真实驱动归 B1、AC-11 不变），U-02~U-05 均「不阻塞 / 已闭合 / 范围外已界定」。与 A1 不同，A2 **无真实宿主面阻塞**（13 条全 mock 面）；真实 ACP 驱动取证是 B1 的范围外事项，不构成本迭代开工阻塞。

---

## 6. Given 可构造性核查（逐条造现场，L342–L347 + 各 AC 夹具）

**统一接缝（§3.1 判定锚点约定 L187、P-1~P-6 L342–L347）**：
- 仓库根 `$MAESTRO_REPO=/Users/xuesh/www/Maestro`（P-1：HEAD `3e47a51`、macOS/zsh/Node v22.22.2）。
- 每条 AC 独立项目根 `ROOT=$(mktemp -d /tmp/maestro-a2-<场景>.XXXXXX)`（macOS `os.tmpdir()`），统一注入 `NODE_ENV=test`（P-2）。
- **「已发现 CLI」唯一构造方式 = P-3 的 A1 `cli-registry` mock 夹具**：在独立项目根写入 A1 形状的 `.orch/cli-registry.json`（`schemaVersion:1`，`clis[]` 每条含 `cli_id`/`name`/`executable`/`capabilities` 与五维 `acp`/`transport`/`resume_dialect`/`max_concurrent_sessions`/`evidence_hook`/`connection_status`）；至少两条满足能力的 CLI（`cli_id=codex`/`name=Codex CLI`/`acp=true`/`max_concurrent_sessions=3`/`connection_status=idle`；`cli_id=claude-code`/`name=Claude Code`），「未探测/不满足」现场追加第三条并把对应维度设 `null`。形状逐字对齐 `registry.js:127-150` `saveCliRegistry` 输出，或复用 A1 `test/wp16/cli-acceptance.test.js` 的 `mockAgent()` + `orch cli scan` 生成后补五维字段。凡 AC 中出现「已发现 CLI」一律以此夹具构造，不写本机不可构造现场。
- 用户可见操作 `node "$MAESTRO_REPO/bin/orch.js" org ...`（P-4，命令字面为实现建议、不写进 Then）；A2 可构造性只依赖 P-2/P-3，不依赖真实宿主。

| AC | 造现场步骤（独立 root + NODE_ENV=test + 具体动作） | 可构造性 |
|---|---|---|
| AC-01 | `ROOT=$(mktemp -d /tmp/maestro-a2-role.XXXXXX)`；按 P-3 写 `.orch/cli-registry.json`（含 `cli_id=codex`）；`cd "$ROOT" && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" org role create --name 产品经理 --from-cli codex --dept 产品部` | ✅ 可构造 |
| AC-02 | 复用 AC-01 的 `$ROOT`；`org role show 产品经理` → `org role update 产品经理 --skill 需求分析 --capability acp`，观察四项变化；非法更新另造输入 | ✅ 可构造 |
| AC-03 | 同 `$ROOT`；先建 R1（挂 1 员工，见 AC-04）与 R2（空角色）；`org role delete 产品经理`（R1）→ `org role delete 空角色`（R2）→ `org role list` | ✅ 可构造 |
| AC-04 | 同 `$ROOT`，角色所需能力声明为 `codex` 已探测具备的能力，清单有第二条 CLI；`org agent create --role 产品经理 --name pm-1 --cli codex --dept 产品部 --max-concurrent 2` | ✅ 可构造 |
| AC-05 | 复用 AC-04 的 pm-1；`org agent show pm-1` → `org agent update pm-1 --cli claude-code`；非法改绑造未发现/能力不满足的 cli_id | ✅ 可构造 |
| AC-06 | 同 `$ROOT` 建好 pm-1；`org agent delete pm-1` → `org role show 产品经理`，查会话记录未静默清除 | ✅ 可构造 |
| AC-07 | 按 P-3 写含 `codex`、`claude-code` 两条满足能力 CLI 的夹具；建角色 → `org agent create --role 产品经理 --name pm-2 --cli claude-code --dept 产品部` → `org role show 产品经理` | ✅ 可构造 |
| AC-08 | `ROOT=$(mktemp -d ...)`；按 P-3 写夹具；`for d in 产品部 研发管理部 前端部 后端部 测试部 平台安全部; do org role create ... --dept "$d"; done` → `org role create --name 非法 ... --dept 不存在部` | ✅ 可构造 |
| AC-09 | 按 P-3 写夹具：Codex `acp=true`，第二条该项 `null`（未探测）；`org agent create ... --cli codex`（允许）→ `org agent create ... --cli unknown-cap`（拒，提示未探测） | ✅ 可构造 |
| AC-10 | 按 P-3 写两条满足能力 CLI；按 AC-04 建 pm-1；`org role show 产品经理 > /tmp/role-before.txt` → `org agent update pm-1 --cli claude-code` → `org role show ... > /tmp/role-after.txt` → `diff` 无差异 | ✅ 可构造 |
| AC-11 | 复用 AC-07 现场（pm-1 绑 codex、pm-2 绑 claude-code）；`org session create --agent pm-1` → `org session create --agent pm-2` → `org session list`；证据级别「mock 实测」 | ✅ 可构造 |
| AC-12 | 复用 AC-11 的 pm-1；`org session create --agent pm-1` → `org session list --agent pm-1`，查两条独立 session_id、员工配置数不变 | ✅ 可构造 |
| AC-13 | `ROOT=$(mktemp -d /tmp/maestro-a2-acceptance.XXXXXX)`；按 P-3 写两条满足能力 CLI；`org role create → agent create ×2 → session create ×2 → role show before → agent update → role show after → diff` 串成一条进程级链，证据「mock 实测」 | ✅ 可构造 |

**Given 可构造性核查结论**：13 条 AC **全部可构造（13 条）**，均可在独立项目根 + `NODE_ENV=test` + P-3 A1 `cli-registry` mock 夹具上复现；**需真实机器 0 条**。P-1~P-6 的命令、夹具、P-3 形状均为需求已定义且经 HEAD `3e47a51` 现状复核的真实锚点；会话面证据为「mock 实测」，真实 ACP 驱动取证归 B1（OUT-3 / U-01），不冒充真实宿主达标。无「历史会话为空闲」式不可复现 Given。

---

## 7. 与上一迭代（A1）的契约差异与回归红线

A2 承接 A1 的 CLI 发现结果，进入 v2 概念模型第二/三层。与 A1 的契约差异与回归红线如下（逐条有据）：

1. **新增 `src/org/` 领域层，不碰 `src/core` / `src/daemon`**：A2 全部新实现落在 `src/org/**`（`department/role/agent/session/validation/registry/index.js`）+ `src/cli/org.js` + `test/wp17/`，purity 扫描口径不变——`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator`（11 词并集，AD-07）→ exit 0，见各 AC 架构检查（L198 等）。新增领域层遵守零 CJK。
2. **中文只在 `src/cli/labels.js`，A1 `CLI_DISCOVERY_TEXT` 逐字不变**：在 `labels.js:1254` 的 `CLI_DISCOVERY_TEXT` 之外**追加独立 `ORG_TEXT` 表**（D-5 / D-8），A1 现有键取值不动；六部门名、错误原因、证据级别、状态词均经 `ORG_TEXT` 下发，`src/org/**` 零 CJK（`node -e` CJK 检测输出 OK，AC-01/08/09 架构检查）。既有计数断言（`REASON_LABEL` 49 / `USAGE_LINES` 25 / `DESKTOP_LABEL_KEYS` 64+63 / checkpoint 全键）不得变红，变红属越界须回退实现（NF-4 / D-5 / D-8）。
3. **不改 `main.js` 冻结 parser，`org` 命令与 `cli` 命令并列独立分流**：现状 `bin/orch.js:22-32` 为 `core serve` / `argv[0]==='cli'` → `cliDiscoveryMain` / else → 冻结 `main(argv)` 三路；A2 只在 `cli` 分支之后追加 `argv[0]==='org'` → `src/cli/org.js` 的 `orgMain`（D-6 / D-8），`core serve` 内部通道与 `cli` 分支行为逐字不动。**新增 `org` 不得改动 `main.js` 既有 parser、不得改变 A1 `cli` 命令分派行为**（NF-5）。
4. **消费 A1 的 `cli_id` / capabilities 五维，只读不写回**：A2 能力判定唯一数据源是 A1 `.orch/cli-registry.json` 的 `clis` 数组（形状锚定 `registry.js:127-150`），五维常量锚定 `capability-matrix.js:13-19`（`acp`/`transport`/`resume_dialect`/`max_concurrent_sessions`/`evidence_hook`）；按能力而非 CLI 名称硬配，未探测不臆造（BR-09 / AC-09 / D-4）。A2 新增写入只在 `.orch/organization/`，不改 A1 CLI 清单、不改用户 CLI 配置、不写用户系统目录（BR-13 / NF-2）。
5. **A1 既有断言逐字不放宽，全量门禁按 AD-06 等效口径**：`test/wp16/cli-*.test.js` 既有断言、既有文案表计数断言逐字保留（NF-5 / D-8）；不得写「全量全绿」——本机按受影响面串行 + git worktree 基线树对照、新增红差集 0（P-5：基准快照 `# tests 1983`/`# fail 17`，flaky 下 17~22 波动，round2 独立实跑 22 红属 AD-06 已声明偏差、与零源码改动无关）。
6. **AC 判定强度不因范围外/语义降级而放宽**：会话语义层收敛为「两条独立会话记录」（AS-01 / U-01）但 AC-11 Then 保持「两人各建会话、互不串台、不是真实推理输出、证据 mock 实测」的用户可见判定，0 次冒充真实宿主达标（NF-3 / P-6）；规划 389~391 行五子项 + 验收四分句逐字映射、三条 v2 概念核心边界（角色≠Agent / 角色不绑 CLI 而员工绑 CLI / 员工实例≠会话）显式落入 §2/§3 与 AC-07/10/12（D-9），AC=13 / BR=14 / Then 未放宽（round2 已确认）。
7. **相比 A1 的面类型差异**：A1 有 1 条真实宿主面（AC-12，AD-08 阻塞）；A2 **无真实宿主面**（13 条全 mock 面），真实 ACP 会话驱动整体移交 B1。该差异不降低 A2 判定强度——A2 会话面证据严格限定「mock 实测」，真实面达标由 B1 另行取证，两迭代证据不得互相顶替。

> 以上红线来自需求 §1.3 / §3.1 架构检查 / §3.2 NF / 附录 D-1/D-5/D-6/D-8/D-9 与 AD-04~AD-08 台账，并经 HEAD `3e47a51` 现状复核。本纪要仅作理解与索引，不新增、不改、不删任何需求条目。
