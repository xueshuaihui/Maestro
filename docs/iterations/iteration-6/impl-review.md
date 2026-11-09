# I1.6 S2 实现评审（干净上下文 · 独立复核）

> 评审对象：`1bc86a7..c5c6340`（分支 `feat/i1.6-assets-workflow`，S2 全部 6 个实现提交）
> 评审方式：只读复核 + 实跑取证；不采信任何提交信息 / WP 报告自述，全部判据自行跑命令。
> 依据：`docs/iterations/iteration-6.md`（§1/§2/§4/§6）、`requirement.md` v7（65 AC / 41 BR / 附录 A/D）、`decisions.md`（裁-1~裁-14，含 S2 期裁-11~14）。
> 本文件是本轮唯一写入产物；未改动任何其它文件、未提交 git。

---

## §0 总判

**FAIL（阻断 1 / 建议 5）** —— 实现整体高度忠于契约（19 码逐字、USAGE_LINES 前 8 行机比相等、768/768 全绿、四条纯净扫描全过、AC-61 门禁达标、D-7a/D-7b 恰好授权范围），但 WP-7 存在一处明确的逐字契约违反（A-7 默认正文用了英文占位，`src/cli/skills.js:37-45`），修复成本极低（按裁-12 同原则补一个 labels 新键即可）。**修复 P-01 并复核后即可收口进 S3；P-02 为需求侧矛盾披露，须在 S3 开工前由主控裁决，但不构成 S2 实现缺陷。**

复核方式：`git diff 1bc86a7..HEAD` 逐文件核对 + 逐条实跑（19 码机比、USAGE_LINES 机比、AC-48 三形态 diff I1.5 基线、doc-fanout 夹具 validate/dry-run、workflow diff、AC-48/AC-61 门禁、四条纯净扫描、全量测试）。

---

## §1 文件边界（A 组）

### A1. S2 diff 只触碰授权文件清单 —— PASS

`git diff 1bc86a7..HEAD --stat` 共 23 文件，逐个归属核对：

| 归属 | 文件 |
|---|---|
| WP-1 | `src/registry/workflow-schema.js`、`test/wp12/workflow-schema.test.js` |
| WP-2 | `src/registry/contracts.js`、`test/wp12/role-contracts.test.js` |
| WP-3 | `src/registry/workflows.js`、`test/wp12/workflow-yaml.test.js`、`test/wp12/workflow-validate.test.js` |
| WP-4 | `src/registry/workflow-plan.js`、`test/wp12/workflow-plan.test.js` |
| WP-5 | `src/cli/main.js`、`src/cli/labels.js`、`src/cli/render.js`、`test/wp12/cli-assets.test.js` |
| WP-6 | `src/registry/asset-write.js`、`src/cli/roles.js`、`assets/roles/{researcher,writer}.yaml`、`test/wp11/cli-role.test.js`、`test/wp12/role-write.test.js` |
| WP-7 | `src/cli/skills.js`、`test/wp12/skill-assets.test.js` |
| WP-8 | `src/cli/workflows.js`（不新增第 9 测试文件，裁-10） |
| 治理记录 | `docs/iterations/iteration-6/decisions.md`（+18 行 = 裁-11~14 登记本体与 AC-45 过渡断言说明，即本评审依据所引用的授权文件，非实现越权） |

`test/wp12/` 恰 8 个文件（D-10）。**无第 24 个实现文件。**

### A2. 「不改」清单零改动 —— PASS

`git diff 1bc86a7..HEAD --name-only` 共 23 个；对下列路径做定向 diff，除 `test/wp11/cli-role.test.js`（6 行 = D-7a 三处改动的 +3/−3）外全部零输出：
`src/registry/{index,assets,yaml-lite,role-schema,skill-file}.js`、`src/templates/index.js`、`src/core/**`、`src/daemon/**`、`test/fixtures/**`、`package.json`、`test/wp11/` 其余 8 测试。

### A3. D-7a 恰三行 —— PASS（按裁-11 口径）

`git diff 1bc86a7..HEAD -- test/wp11/cli-role.test.js` 恰 3 处改动（+3/−3）：
- `:354` `9`→`26`（注释同步改 `twenty-five usage lines plus the reason line`，符合 D-7a 授权原文）；
- `:356` `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES])` → `assert.deepEqual(block.slice(0, 8), USAGE_LINES.slice(0, 8))`——D-7a 原文写「`:356` 不动」，但 USAGE_LINES 8→25 后该行字面必败（deepEqual 8 项 vs 25 项）；**裁-11 已授权此机械连带**并登记 R-8，本行断言语义（前 8 行逐字 = I1.5）经机比确认保持（见 B7）；
- `:357` `8`→`25`。

### A4. D-7b 恰两文件两处 —— PASS

`git diff 0cd113b..HEAD -- assets/` 输出恰两文件，且均只动 `wake_allow` 取值：
- `assets/roles/researcher.yaml`：`wake_allow: []` → `wake_allow: [writer]`；
- `assets/roles/writer.yaml`：`wake_allow:\n  - editor` → `wake_allow: [editor, reviewer]`（目标表示法 `[editor, reviewer]` 与 D-7b 授权原文逐字一致）。
其余 `assets/**` 零改动。

---

## §2 契约履行（B 组，逐条 PASS/FAIL）

| # | 判据 | 结果 | 证据 |
|---|---|---|---|
| B1 | `workflow-schema.js` 19 码逐字 = A-15 | **PASS** | 机比脚本：`count: 19 / names equal: true / value===key: true`；四域常量 `workflow/v1`、`role,human,escalate,subworkflow`、`forward,backflow,retest`、`always,passed,failed,human_approved,human_rejected`、`all,any` 全对（`workflow-schema.js:14-53`） |
| B2 | `contracts.js` C-08 顺序与 7 码 params 键 | **PASS** | 每角色按 ⑧工具→⑨唤醒→⑩派生→⑪契约连通（`contracts.js:244-249`）；⑦ 之前各步留在 `role-schema.js`/`index.js` 不重复判；7 码齐，params 键 `{value}`/`{tool,reason}`/`{role}`/`{chain}`/`{field,side}` 与 `labels.js` 模板占位一一对应；同文件同码去重（`contracts.js:253-259`） |
| B3 | `workflows.js` C-09 ①~⑬、errors 6 键、counts 4 键、去重、⑬ 节点级优先 | **PASS**（两处口径取舍见 P-04/P-06） | `WORKFLOW_CHECK_ORDER` 13 步逐字对应 C-09（`workflows.js:63-77`）；`makeError` 6 键、`scope:'workflow'`（`:141-143`）；counts 恰 4 键、`invalid`=涉及文件数（`:715-720`）；同文件同码只报第一条（`:694-700`）；⑬ 节点级 `wake_allow` 优先、角色资产兜底（`:171-184`）——与 AC-37 Given（节点级 `wake_allow: [editor]`）与 AC-61（内置图走角色资产）双口径吻合 |
| B4 | `workflow-plan.js` 8 键形状与 D-5 排序 | **PASS**（1 处报备见 P-03） | 顶层恒 8 键、`layers[]` 2 键 / `branches[]`·`mappings[]`·`policies[]` 各 3 键（`workflow-plan.js:240-249`）；分层=最长路径、回边不参与（`:87-114`）；并行组同层合并（`:120-159`）；mappings 按 (from 层号, to 节点, 序号)（`:215`）；policies 按层号（`:234`）；**branches 按 `(from 层号, to 层号, when)`（`:183`），D-5 字面为 `(from 层号, to, when)`**——AC-28 Then 的三行顺序（T-004→T-006 在前）只有按 to 层号才可达，属「AC Then > 附录 D」的正确取舍，但 decisions.md 无登记 → P-03 报备 |
| B5 | `asset-write.js` 原子写、C-07 键序、三落点 | **PASS** | 同目录 temp+rename，失败 unlink temp、目标不动（`asset-write.js:302-331`）；`ROLE_KEY_ORDER` 与 C-07 十五键逐字同序（`:34-50`）；行内数组 / 空数组 `[]` / 缩进 2 空格；三落点白名单由调用方执行——`roles.js:748`（`.orch/roles/<id>.yaml`）、`skills.js:295,421`（`.orch/skills/<id>/SKILL.md`）、`workflows.js:416`（`.orch/workflows/<id>.yaml`）均为代码内构造，无用户可控旁路 |
| B6 | `main.js` D-6 白名单、两档必填、动态导入兜底 | **PASS** | `FAMILY_FLAGS` 与 D-6 表逐行对照全对齐（role 8 行 + skill 6 行 + workflow 6 行，`main.js:113-140`）；`ROLE_CREATE_REQUIRED` 顺序 `name→group→artifact-type→side-effect`、给 `--from` 跳过（`:182,364-371`）；取值合法性两档都查（AC-54）；`assetFamilyCommand` 动态导入、`ERR_MODULE_NOT_FOUND` 兜底退 2（`:466-479`）；旧命令返回形状不变（diff 仅「positional 从 role 扩到三族」，run/status/cancel/core 键集合不动） |
| B7 | `labels.js` 前 8 行机比、既有表零键增改、`ROLE_WRITE_SUPPLEMENT` | **PASS** | 机比 `git show 0cd113b:src/cli/labels.js`：`old count: 8 / first8 equal: true`；diff 删除行仅 2 行注释 + 1 行尾逗号改写（行内容不变），既有表（`REGISTRY_ERROR`/`YAML_DETAIL`/`ROLE_CLI_TEXT`/`showWake`）零键增改；`ROLE_WRITE_SUPPLEMENT` 为文件尾新增独立表（`labels.js:682-688`，5 键，覆盖派生自 / 契约 side / 内置只读 / 未知字段 / unset 必填），按裁-12 追认评；`ROLE_REASON_TEXT` 7 条 + 三固定句 + `WORKFLOW_REASON_TEXT` 19 条与 A-15 逐字比对全同 |
| B8 | `render.js` 既有函数零删改、新增零中文 | **PASS** | diff 删除行 = 0（`renderRoleList`/`renderRoleShow`/`renderRoleInstanceLine`/`renderRoleValidate` 逐字未动）；新增 399 行经 CJK 正则扫描 0 命中；import 仅 `./labels.js`（裁-9 硬条件「不 import CLI 其它模块」满足） |
| B9 | `roles.js` toRoleJson 10 键、AC-48 十形态抽查、AC-11 计数口径 | **PASS** | `toRoleJson()` 恰 10 键、不含 `wake`/`wakeAllow`（`roles.js:150-164`）；实跑抽查 3 形态：`role list` / `role show developer` / `role validate` 与 `docs/iterations/iteration-5/evidence/AC-01.list.txt`、`AC-02.show.txt` diff 仅基线文件尾随空行（内容逐字一致），`role show researcher|writer` 可唤醒行 = `  可唤醒：writer` / `  可唤醒：editor, reviewer`（D-7b 新值）；AC-11 计数逻辑 `assets = validRoles + skills + invalidFiles`、`validRoles = 21−5 = 16` → `31/16/10/5`（`roles.js:526-532`），与机检口径吻合；workflows 不计入（R-4，`:504`） |
| B10 | `skills.js`/`workflows.js` A-6/A-7/A-9/A-10/A-11 逐字、dry-run 纯函数、scoped/full 计数（裁-13） | **FAIL（P-01）** | 逐字通过项：`skill list` 首行 `技能 10 个（内置 10 · 项目 0）`、`skill show` 六行元数据 + `  正文：`/`  ### 工作方法` 与 A-6 逐字；`workflow list`/`show`/`validate` 首行与 A-8/A-9 逐字；`workflow diff --against` 输出 `对比工作流 fork（项目）与基线 code-loop（内置）`/`~ nodes[0].title：开发 → 开发（改）`/`差异 1 项` 与 A-11 逐字；dry-run 只调 `planWorkflow`、全程不触 `createClient`、临时根实跑无任何 `.orch` 额外文件、两次 stdout 逐字节相同（AC-41）；scoped validate `assets:1`（裁-13，`workflows.js:329-338`）、full=宇宙计数。**FAIL 项：`skill create` 缺省正文为英文占位（`skills.js:37-45`），违反 A-7「### 工作方法」逐字骨架与 WP-7 交付条款 → P-01（阻断）** |
| B11 | `workflow validate`（repo 根全量）counts | **PASS** | 实跑输出 `counts {assets:3, builtin:3, project:0, invalid:0}`、`errors:[]`（AC-61） |
| B12 | AC-52 `dependencies` 键数 0 | **PASS** | `node -e` 实跑输出 `0` |
| B13 | 零第三方依赖、node_modules 不新增运行时依赖 | **PASS** | 新增 8 文件的 import 全部为 `node:*` 与仓内相对路径，无第三方 specifier；`package.json` 零改动且 `dependencies` 不存在 |

---

## §3 门禁实跑（C 组，仓库根 `D:/WWW/Maestro`，Git Bash / Node v22.22.2）

| 命令 | 结果 |
|---|---|
| `node --test --test-concurrency=4 "test/**/*.test.js"` | `# tests 768 / # pass 768 / # fail 0`（≥ 611 下限，AC-50） |
| `purity-check --dirs src/core,src/daemon --forbid "$COMMON"` | exit 0（31 词零命中，16 文件） |
| `purity-check --dirs src/registry --forbid "$NOCOORD"` | exit 0（30 词零命中，11 文件） |
| `purity-check --files src/cli/roles.js,skills.js,workflows.js --forbid "$COMMON"` | exit 0（31 词零命中，3 文件） |
| `node -e` 零 CJK 扫描 | `OK: no CJK`，exit 0 |
| `node -e "…dependencies…" ` | 输出 `0`（AC-52） |
| `node bin/orch.js workflow validate --format json` | `counts {assets:3, builtin:3, project:0, invalid:0}`、`errors:[]`（AC-61） |
| 补充实跑：临时根 doc-fanout `validate` + 两次 `dry-run` | dry-run 两次 stdout 逐字节相同、`.orch` 无额外文件（AC-41）；**validate 报 `WORKFLOW_WAKE_DENIED: researcher → editor`（见 P-02）** |
| 补充实跑：临时根 `workflow create fork --from code-loop` → 改 title → `workflow diff fork --against code-loop` | A-11 三行逐字 + `差异 1 项`（AC-39）；`diff code-loop --against code-loop` → `无差异` |

---

## §4 缺陷清单

| 编号 | 位置 | 原文 / 事实 | 违反什么 | 严重度 | 建议修法 |
|---|---|---|---|---|---|
| **P-01** | `src/cli/skills.js:37-45` | `DEFAULT_BODY = '### Work method\n\n1. Complete the work covered by this skill as required by the task, and state clearly what was done.\n'`（源码自带 TODO 承认未落键） | 需求 A-7「不给 `--body-file` 时的默认正文（逐字）`### 工作方法\n\n1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。`」；拆分 §2.10 WP-7 交付「不给 `--body-file` 时用 A-7 **逐字**默认正文骨架」；C-14 分层（中文只在 labels.js） | **阻断** | 按裁-12 同原则向 `labels.js` 追加新键（如 `SKILL_CLI_TEXT.defaultBody`，不动既有表）并替换常量；在 decisions.md 补一条登记（同裁-12「同类缺口按同一原则处理并逐条登记」的既定口径）；补一条逐字断言进 `test/wp12/skill-assets.test.js` |
| **P-02** | 需求 v7 A-1/A-13 夹具 vs D-3⑬ + D-7b | 实跑（临时根、A-1 夹具逐字、真实 D-7b 资产）：`orch workflow validate doc-fanout` → `唤醒不在白名单内：researcher → editor（WORKFLOW_WAKE_DENIED）`。A-13 夹具的 `T-001→T-003`（researcher→editor）forward 边无节点级 `wake_allow`，而 `researcher.wake_allow=[writer]` 不含 editor | 需求**内部矛盾**：AC-24/27/28/30/31/63 均断言 doc-fanout「全部通过」，但 D-3⑬ 字面 + D-7b 资产使逐字夹具必然报 WAKE_DENIED。S2 实现忠于 D-3⑬，**不是实现缺陷**；S2 单测用注入角色集（`workflow-validate.test.js:97` 的 `researcher wake_allow: ['writer','editor']`）绕开了该矛盾，掩盖了它 | 建议（**S3 开工前必须裁决**） | 需求侧登记（类似 R-9/R-10）：或给 A-13 夹具 `T-001` 补节点级 `wake_allow: [writer, editor]`（AC-37 夹具已确立节点级先例），或裁决 ⑬ 的判定集合口径；否则 S3 的 6 条 doc-fanout AC 将按逐字 Then 全部变红 |
| **P-03** | `src/registry/workflow-plan.js:183` | branches 排序键 `(from 层号, to 层号, when)`；D-5 第 3 步字面 `(from 层号, to, when)` | 与 D-5 字面不一致（但 AC-28 Then 的三行顺序只有按 to 层号才可达，属裁决优先级「AC Then > 附录 D」下的正确取舍） | 建议 | 在 decisions.md 补一条 S2 报备追认（写明取舍依据 AC-28），S3/S4 披露 |
| **P-04** | `src/registry/workflows.js:438-447` | ⑨ 对非 `role` 回流目标跳过 `WORKFLOW_BACKFLOW_NO_LIMIT`，该场景由 ⑫ 报 `TRANSITION_ILLEGAL`；D-3「回边轮次上限」字面无限定 | 与 D-3 ⑨ 字面不一致（但 AC-60 第二段 Then 明确要求 backflow→human 报 `WORKFLOW_TRANSITION_ILLEGAL` 且 `errors[0]` 为该码，AC Then 优先） | 建议 | 同 P-03：decisions.md 补登记 + S4 披露 |
| **P-05** | `src/cli/skills.js:52` | `BODY_FILE_MISSING = 'body file not found: {file}'`（英文占位） | 用法原因行应为中文且唯一来源在 `labels.js`（C-14 分层精神；AC-59 未逐字钉此句，故非 AC 违反） | 建议 | 与 P-01 同一批补 `labels.js` 新键 |
| **P-06** | `src/registry/workflows.js:559-567` | ⑫ 对「入口节点回流」加 `max_rounds` 有界豁免；D-3⑫ 字面「入口节点不得有 `kind: backflow` 入边」无豁免 | 与 D-3⑫ 字面不一致——但内置 `code-loop` 的回边 `T-002→T-001` 目标即入口且 `maxRounds['T-001']=2`，按字面则三条内置图必然非法、AC-61（invalid=0）不可达；实现的「有界回流」读法是 AC-61 唯一可行口径 | 建议 | 同 P-03：decisions.md 补登记 + S4 披露 |

> 说明：S3 验收脚手架（probe/acc6-*）未建不算缺陷；裁-13/14 追认的三处 WP-8 口径（scoped/full 计数、diff 同名内置回退、create 最小合法形、`edges[i].map[j]` 路径）经实跑核验均按追认口径落地，不列入缺陷。

---

## §5 AC → 实现映射抽查（8 条）

| AC | 拆分映射主责 WP | 实现落点 | 抽查结果 |
|---|---|---|---|
| AC-11 | WP-2（协 WP-6） | `contracts.js` 五项 + `roles.js:526-532` 计数 | PASS：`31/16/10/invalid 5` 口径与机检一致；五专属码 + C-08 顺序落地 |
| AC-24 | WP-1（协 WP-3） | `workflow-schema.js` 四类 + `workflows.js` 图级校验 | 实现侧 PASS（四类 nodeType / subworkflow 附加 `workflow` 键齐）；**但 doc-fanout 全量 validate 受 P-02 需求矛盾影响，S3 须先裁决** |
| AC-29 | WP-4（协 WP-8） | `workflows.js:329-338` scoped 计数 | PASS：scoped `assets:1`（裁-13 追认口径） |
| AC-37 | WP-3（协 WP-1/WP-6） | `workflows.js:171-184` 节点级 wake 优先 | PASS：与 Given 的节点级 `wake_allow: [editor]` 口径一致；单测 `workflow-validate.test.js:471` 覆盖 |
| AC-39 | WP-8 | `workflows.js:652-726` diff（BR-37 定义体口径） | PASS：实跑三行逐字 + `差异 1 项`；`无差异`、缺基线句逐字 |
| AC-43 | WP-5 | `labels.js:157` USAGE_LINES 25 行 + `test/wp11/cli-role.test.js:356` 守卫 | PASS：25 行、前 8 行机比 = I1.5 逐字、整块 26 行断言在 D-7a 三行内 |
| AC-52 | WP-5 | `package.json` 无 `dependencies` | PASS：实跑 `0` |
| AC-61 | WP-3（协 WP-6） | `workflows.js` 内置投影参与 ⑬ + D-7b 资产 | PASS：repo 根实跑 `invalid=0 / assets=3 / builtin=3`；`errors` 空 |

---

## §6 结论

**S2 现状不可以直接收口进 S3；修复 P-01 并复核后可以收口。**

依据：
1. **可收口的部分**：文件边界 23 文件全部落在授权清单内（D-7a 恰三行、D-7b 恰两处、8 测试文件齐、不改清单零触碰）；19 码 / 7+19 模板 / USAGE_LINES 前 8 行 / A-6/A-8/A-9/A-11 输出全部机比逐字通过；768/768 全绿（≥611）；四条纯净扫描 + 零 CJK + 零依赖 + AC-61 门禁全过；裁-11~14 的授权与追认口径均按裁决落地。
2. **收口前置**：P-01（阻断）——`skill create` 默认正文须按 A-7 逐字改为中文骨架，走裁-12 既定的「labels 新键 + decisions 登记」通道，改动面一个常量 + 一个键 + 一条断言；修完只需复跑 `test/wp12/skill-assets.test.js` 与全量门禁。
3. **S3 开工前置（非 S2 缺陷）**：P-02 需求侧矛盾（A-13 夹具 vs D-3⑬+D-7b）会令 AC-24/27/28/30/31/63 的逐字 Then 在 S3 必红，须在 S3 派单前由主控登记需求侧修订或裁决取证口径；P-03/P-04/P-06 建议随 S4 一并登记披露。
