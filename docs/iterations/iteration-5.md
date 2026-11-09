# I1.5 任务拆分与文件级契约（角色/技能注册表 + 内置角色扩展 + 角色实例模型）

> 需求依据：`docs/iterations/iteration-5/requirement.md` **v6 定稿**（v5 = 4 条结构性缺陷修正，v6 = 8 条连带项修正；以 v6 为准，45 条 AC / 29 条 BR / M-1~M-9 / C-01~C-13 / 附录 A-1~A-7、B-01~B-04、C、D-1~D-9）
> 上游实现：I1.1 ~ I1.3 产品代码（`src/**` + `bin/orch.js`，418 条测试全绿，`node --test "test/**/*.test.js"` 实测 `tests 418 / pass 418 / fail 0`，12.6s）
> 分支：`feat/i1.5-role-registry`（自 main `1490f6d` 切出）｜ I1.4 由其他同学并行实现，本迭代**不依赖 I1.4 的任何新代码**
> 评审依据：需求四轮独立评审（第 1 轮 15 阻塞 / 第 2 轮 8 阻塞 / 第 3 轮 2 阻塞 / 第 4 轮 PASS），见 `requirement.md` 页首状态与附录 C

## 0. 迭代定位、范围与退出标准

**一句话目标**：把硬编码在 `src/templates/index.js`（6 个角色）与 `src/cli/labels.js`（`ROLE_LABEL`）里的"角色名"，换成一等资产——`assets/roles/*.yaml`（16 个）+ `assets/skills/*/SKILL.md`（10 个）这份**可加载、可校验、可查询**的定义；再把"角色在这一次实例里到底在干什么"变成 `buildRoleInstances()` 这份**随时可重算、绝不落盘**的派生视图，最后由 `orch role list / show / validate` 三条**只读**命令对外暴露。

**In scope**（对应需求 §1.3 十条，逐条落位到 WP）

| 需求 §1.3 | 内容 | 主落位 WP | 关键文件 |
|---|---|---|---|
| 1 | 角色注册表两层合并（内置 `assets/roles/` + 项目 `.orch/roles/`，同 id 项目优先，只读） | WP-2 | `src/registry/index.js` |
| 2 | 加载与校验：YAML 子集、9 个必填键、取值域、14 个原因码、逐资产报错 | WP-1 + WP-2 | `yaml-lite.js`、`role-schema.js`、`index.js` |
| 3 | 技能注册表：`skills/<id>/SKILL.md` 前置元数据 + 正文非空 + 目录名即 id + 项目级覆盖 | WP-1 + WP-2 | `skill-file.js`、`index.js` |
| 4 | 内置角色 16 个覆盖五组（5/3/3/3/2），既有 6 个角色 + `worker` 全在表内 | WP-3 | `assets/roles/*.yaml` |
| 5 | 内置技能 10 个，每个至少被一个角色引用 | WP-3 | `assets/skills/*/SKILL.md` |
| 6 | 角色实例模型：六态判定 + `role_to_sessions` + 活跃会话 + 并发上限 + 最近动作 | WP-5 | `src/registry/role-instances.js` |
| 7 | 图角色声明（`single` / `code-loop` / `task-loop` 各加 `roles`） | WP-5 | `src/templates/index.js` |
| 8 | CLI 三条只读命令（`--group` / `--instance` / `--format`） | WP-4 | `src/cli/{roles,main,render,labels}.js` |
| 9 | `orch run` 发起前预检（不合法 → 退出 3，不建会话、不留半个实例） | WP-4 | `src/cli/main.js` |
| 10 | 兼容与纯净（三条主链逐字不变、零依赖、31 词扫描、中文唯一来源） | WP-1 + WP-6 | 3 处注释、`purity-check.mjs` |

**Out of scope**（摘要，全表见需求 §1.3 的范围外表）：角色/技能的创建、编辑、派生、导入导出、diff（I1.6）；产物类型隔离（I1.7）；角色流程图渲染（I1.10a）；资产库浏览（I1.11）；`orch status` 增列角色；I1.4 的共享工作区 / 交接包校验 / CLI 核心命令集扩展。本迭代**不新增任何写入命令**，也不改 `docs/index.md`。

**退出标准**

1. **45/45 AC 通过**，按观测面分三段：**命令面 28 条**（AC-01 ~ AC-18、AC-32 ~ AC-39、AC-44 ~ AC-45，全部不需要宿主；其中 **AC-10 的 Given 仍按需求原样配齐 `NODE_ENV=test` + mock 宿主**，但预检在 `client.connect` 之前返回，宿主实际不会被拉起——按命令面归档，见 §8 #11）、**实例面 13 条**（AC-19 ~ AC-31，全部走仓库内 mock ACP agent + `NODE_ENV=test`）、**架构面 4 条**（AC-40 / AC-41 / AC-43 扫描、AC-42 全量回归）。**真实宿主面 0 条**——本迭代不改 ACP 适配层，凡是需要实例的 AC 都用夹具；`acceptance-product.md` 只出「无真实宿主面」的说明与理由，不出真实跑批。
2. **每条 AC ≥ 4 份证据**落 `docs/iterations/iteration-5/evidence/`，命名 `AC-XX.<阶段>.<类型>`；空文件视为无效证据。
3. **既有 418 条测试不回归**：`fail === 0 && pass === tests && tests >= 418`（下限断言，不写死条数），且既有断言**零修改**（D-8 授权断言清单为空）。
4. **回归红线**：`single` / `code-loop` / `task-loop` 三条主链的终端输出，去掉 `已运行 12s` 与 `HH:mm:ss` 两类易变片段后与 I1.3 基线**逐字一致**（AC-19）。
5. **架构扫描**：附录 D-7 三条命令全部 exit 0（第 1、3 条 31 词，第 2 条 30 词，见 D-7 的 v5 修正），外加"`coordinator` 在 `src/registry` 的命中恰好 1 条且落在 `GROUPS` 行"的定点断言（用 `--json` 判 `hits.length === 1`，**该命令预期 exit 1，不判退出码**）；`src/registry/**` 与 `src/cli/roles.js` 的 CJK 扫描零命中（AC-43）。
6. **零依赖**：`package.json` 的 `dependencies` 键数量为 `0`（AC-41）。
7. **NFR-01 ~ NFR-07 全部满足**；其中 NFR-03（预检 ≤ 100ms）用 `role validate` 单次冷启动耗时实测三次取中位数，不做长跑压测；NFR-02（100 个角色文件 ≤ 2s）用临时根造 100 份副本实测。

---

## 1. 技术选型（结论 + 被否决项）

### 1.1 YAML 解析：自实现子集（需求 D-2）

**结论**：新增 `src/registry/yaml-lite.js`，只实现 D-2 列出的语法（块映射 / 块序列 / 行内序列 / 纯量与引号标量 / 注释 / 布尔 / 整数 / 空值 / 中文标量），遇到不支持的语法一律 `YAML_PARSE_FAILED` 并给 1 基行号。
**理由**：`dependencies` 必须恒为 `{}`（红线 7）；输入面极窄（本轮 26 个自写文件（16 角色 + 10 技能） + I1.6 起的用户文件），语法可控；解析器只返回 `{ok, line, detailKey, detailParams}`，**不产出任何自然语言句子**（中文由 `labels.js` 的 `YAML_DETAIL` 在 CLI 层组装，见 §2.1 / D-3 的 v5 修正），错误语义完全掌握在自己手里。
**被否决**：
- `js-yaml` / `yaml` —— 破坏零依赖红线，且它们对重复键、缩进的处理与新需求 D-2 的判定不一致（要额外覆盖）。
- 把角色文件改成 JSON —— 需求 §1.3-1 与 D-2 已把格式定死为 YAML，改格式等于改需求（红线 2）。
- 直接 `JSON.parse`（"JSON 是 YAML 子集"）—— 写不出 `key: value` 这种最常见形态，I1.6 的编辑器也产不出。

### 1.2 `SKILL.md` 前置元数据：切两段 + 复用 yaml-lite

**结论**：`skill-file.js` 按 `---` 行切成「元数据段 + 正文段」，元数据段交给 `yaml-lite`，正文段原样保留（去首尾空白后为空由 `index.js` 判 `SKILL_BODY_EMPTY`）。
**理由**：需求 §1.3-3 规定单文件 `skills/<id>/SKILL.md`；元数据只 4 个必填键，够用。
**被否决**：
- 拆成 `meta.yaml` + `body.md` 两文件 —— 与单文件契约冲突，且 I1.6 的资产库要按目录列。
- `gray-matter` 等 front-matter 库 —— 破坏零依赖。
- 正文也按 YAML 解析 —— 正文是给人看的 Markdown（含 `1.` 列表、`：` 中文标点），解析必误报。

### 1.3 角色实例：纯函数派生视图，不落盘（C-07 / BR-20）

**结论**：`buildRoleInstances({state, graph, roles})` 是纯函数，输出 `{roles, roleToSessions}`；不读文件、不看时钟，同一输入必得同一输出（NFR-04）。
**理由**：一旦落盘就多出一个能被静默覆盖的写面，与"状态迁移唯一入口 `transit()` + CAS"（硬约束 §5-1/§5-2）直接冲突；派生视图"随时重算"才能保证 AC-30（改 `state.json` 后结果立刻变、且不产生回写）。
**被否决**：
- 在 `state.json` 落 `roleInstances[]` 并在 `transit()` 里维护 —— 每次状态变更都要同事务更新角色实例，`rev`/CAS 语义被污染；重启后还会与真实状态漂移。
- 在 `orchestrator` 里算好并通过事件广播 —— 引擎将被迫知道角色语义（违反红线 6），且"历史事件"无法表达"当前视图"。

### 1.4 角色实例模块放 `src/registry/`，不放 `src/core/`

**结论**：`src/registry/role-instances.js` 只吃 `state` / `graph` / `roles` 三个入参，**不 import `src/core/**`、不 import CLI**。
**理由**：`src/core` 被 31 词扫描覆盖且职责是"推进状态机"；角色视图属于"资产 + 实例的读模型"，与 I1.6 的派生角色同源。
**被否决**：
- 放 `src/core/` —— 把 I1.6 的派生角色、I1.7 的产物类型都拖进引擎，且引擎目录会开始依赖注册表。
- 放 `src/cli/` —— CLI 只做渲染与参数校验，不能持有领域计算（否则 `role show` 与将来的 GUI 会各算一份）。

### 1.5 中文只在 CLI 层组装（D-1 / D-3 / AC-43）

**结论**：`src/registry/**` 只返回机器可读的 `{code, file, scope, field, line, params}`；人话明细由 `src/cli/roles.js` 用 `labels.js` 的 `REGISTRY_ERROR[code]` 模板替换占位符后产出。
**被否决**：
- registry 直接返回中文 `detail` —— AC-43 要求 `src/registry` CJK 零命中，且中文唯一来源是 `labels.js`（硬约束 §5-10）。
- 让 `labels.js` 直接产出完整行（含文件路径）—— 模板与数据耦合；`role validate --format json` 的 `detail` 与文本输出必须同源，两处拼会漂移。

### 1.6 内置资产放仓库根 `assets/`

**结论**：`assets/roles/*.yaml`、`assets/skills/*/SKILL.md`；定位由 `src/registry/assets.js` 用 `import.meta.url` 反推仓库根（B-01）。
**被否决**：
- `src/assets/` —— 资产不是代码，会被 `src` 下的架构扫描、打包与测试覆盖口径牵连。
- `src/templates/assets/` —— 落在 `purity-check` 的白名单 `src/templates/**` 里，等于把资产从守卫范围里摘出去。

### 1.7 目录扫描 + 文件名即 id（C-01 / C-02）

**结论**：扫描 `assets/roles/*.yaml` / `.orch/roles/*.yaml`、`assets/skills/*/SKILL.md` / `.orch/skills/*/SKILL.md`；id 必须与文件名（目录名）一致。**技能侧必须先枚举 `skills/` 下的每个子目录、再检查该目录里的 `SKILL.md`**，不能按文件 glob 找 `*/SKILL.md`——否则 `.orch/skills/half-done/`（目录在、文件不在）永远不会被发现，AC-13 的 `SKILL_FILE_MISSING` 无从产生。
**被否决**：
- 维护 `assets/registry.json` 清单 —— 清单与目录会失同步，I1.6 新增角色要改两处。
- 把资产列进 `package.json` —— 把资产耦合到打包元数据。

### 1.8 给 `purity-check.mjs` 加 `--files`（D-7 / D-8）

**结论**：新增 `--files <逗号分隔，相对仓库根>`；给了 `--files` 时**只扫这些文件**（`--dirs` 视为空，不再叠加默认的 `src/core,src/daemon`），没给时 `--dirs` 的行为与默认值一概不变。
**理由**：D-7 第 3 条要精确扫 `src/cli/roles.js`；`src/cli/labels.js` **合法地**含有 6 个角色名与 3 个中文名，扫整个 `src/cli` 必然误报。而把文件传给 `--dirs` 会因 `readdirSync` 抛错被吞而"扫 0 个文件仍 exit 0"——那是假绿，必须避免。
**被否决**：
- 把整个 `src/cli` 加进扫描目录 —— 必然误报（见上）。
- 把 `roles.js` 挪到 `src/registry` —— 它是参数校验 + 渲染调度 + 退出码，职责不符。
- 另写一次性脚本 —— 守卫必须长期可跑；spike 脚本不许留在产品工程（红线 4）。

### 1.9 `role show --instance` 走 IPC `instance.get`（C-09）

**结论**：与 `status` 同口径 `connect({ensure:true})` → `instance.get`；`STATE_CORRUPT` 沿用既有文案与退出码 1（B-03）。
**被否决**：
- CLI 直接读 `state.json` —— 破坏"单一写者 + 已中断口径统一"（`core stop` 后的 `interrupted` 对账会漏），且 `STATE_CORRUPT` 的备份路径要靠核心给。
- 新增 IPC 方法 `role.list` —— 核心会知道角色概念（违反红线 6）；派生视图在 CLI 侧算，核心不需要新方法。

### 1.10 图角色声明用图对象的 `roles` 字段

**结论**：三个图各加一个 `roles: Object.freeze([...])`：`single = ['worker']`、`code-loop = ['developer','tester','coordinator']`、`task-loop = ['researcher','writer','reviewer']`（**顺序逐字照需求 M-1**；排序由 `buildRoleInstances` 重排，与声明顺序无关）。
**被否决**：
- 在 registry 里写「图 → 角色」反查表 —— registry 不该知道图（`graph` 是 `src/templates` 的事）。
- 只用节点 `roleId` 的并集 —— 那样 `coordinator` 永远进不了集合，AC-20 / AC-25 的 `inactive` 无从产生。

---

## 2. 模块划分与文件级接口契约

> 通则：`src/registry/**` 与 `src/cli/roles.js` **零 CJK 字面量**（AC-43）；`src/registry/**` 不 import `node:http` / `node:https` / `node:net` / `node:dns` / `node:tls`（AC-44）；所有模块 `import` 只用 `node:` 内置（AC-41）。

### 2.1 `src/registry/yaml-lite.js`（新增，WP-1）

**导出**

```js
export function parseYaml(text) // -> {ok:true, value:object} | {ok:false, line:number, detailKey:string, detailParams:object}
```

- `value`：顶层必须是块映射；值为 `string | number | boolean | null | Array | object`。
- `line`：**1 基**行号（注释行计入）。
- `detailKey`：**机器键**，取值只有 4 个 —— `inconsistent-indentation`、`unsupported-token`（`detailParams: {token}`）、`duplicate-key`（`detailParams: {key}`）、`missing-value`（`detailParams: {key}`）。**本模块不产出任何自然语言句子**（含英文整句），中文短语由 `labels.js` 的 `YAML_DETAIL` 映射生成（需求 D-3 的 v5 修正）。
- 同一文件只报**第一条**错误即停止解析（D-2）。
- 语法判定：`#` 只有处于行首或空白之后才算注释（引号内不算）；`key:` 后无内容 → `null`；行内序列 `[a, b]` 支持空数组 `[]`；`\t` 缩进、`---`、`|`、`>`、`&`、`*`、`{`、`<<` 一律 `ok:false`（`unsupported-token`）；同一层级缩进不一致、键重复也是错误。

### 2.2 `src/registry/skill-file.js`（新增，WP-1）

**导出**

```js
export function parseSkillFile(text) // -> {ok:true, meta:object, body:string} | {ok:false, line:number, detailKey:string, detailParams:object}
```

- 首行必须是 `---` 且存在第二个 `---` 收尾；缺失 → `{ok:false, line:1, detailKey:'missing-front-matter', detailParams:{}}`。
- 元数据段解析失败时透传 `yaml-lite` 的 `detailKey` / `detailParams`，`line` 已加上元数据段的起始偏移（**文件内 1 基行号**）。
- `body`：第二个 `---` 之后的原文（保留内部空行）；本模块不判"正文是否为空"（业务规则归 `index.js`）。

### 2.3 `src/registry/role-schema.js`（新增，WP-1）

**导出（常量 + 两个纯校验函数）**

```js
export const ROLE_SCHEMA_VERSION = 'role/v1';
export const SKILL_SCHEMA_VERSION = 'skill/v1';
export const GROUPS = Object.freeze(['coordinator','research','writing','coding','ops']);
export const ARTIFACT_TYPES = Object.freeze(['code','document','dataset','report']);
export const SIDE_EFFECTS = Object.freeze(['none','read','write','exec']);
export const CONCURRENCY_MIN = 1;
export const CONCURRENCY_MAX = 5;
export const ROLE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const ROLE_ID_MIN = 2;
export const ROLE_ID_MAX = 32;
export const ROLE_REQUIRED_KEYS = Object.freeze(['schema','id','name','group','summary','artifact_type','side_effect','skills','max_concurrent_sessions']);
export const SKILL_REQUIRED_KEYS = Object.freeze(['schema','id','name','summary']);
export const ROLE_OPTIONAL_KEYS = Object.freeze(['tools','wake_allow','inputs','outputs','dispatchable']);

export function checkRoleShape(obj, { fileId } = {})  // -> Array<{code, field, params}>
export function checkSkillMeta(meta, { dirId } = {})  // -> Array<{code, field, params}>
```

- 返回数组的**顺序即输出顺序**，与 D-3 的 ③~⑦ 一致：必填键（每个缺失一条 `ROLE_SCHEMA_MISSING` / `SKILL_SCHEMA_MISSING`，`field` 指名）→ id 字符集与文件名（`ROLE_ID_MISMATCH` / `SKILL_ID_MISMATCH`）→ `group` → `artifact_type` → `side_effect` → `max_concurrent_sessions`；技能另有 `applies_to` 取值（`SKILL_GROUP_INVALID`）。
- 只产出机器码与参数，**不拼中文、不读文件、不含任何角色名 / 技能名**（`GROUPS` 是分组枚举，不是资产名）。
- `schema` 键的值不等于版本常量时，按 `ROLE_SCHEMA_MISSING` 处理（`field: 'schema'`）——需求未单列原因码，用现有码表达，登记 `decisions.md`。

### 2.4 `src/registry/assets.js`（新增，WP-2）

**导出**

```js
export function assetsRoot()            // <repo>/assets（绝对路径，模块内缓存一次）
export function builtinRolesDir()       // <repo>/assets/roles
export function builtinSkillsDir()      // <repo>/assets/skills
export function projectRolesDir(root)   // <root>/.orch/roles
export function projectSkillsDir(root)  // <root>/.orch/skills
```

- 仓库根反推：`path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')`。
- **不做存在性判断、不 mkdir**（`REGISTRY_ASSETS_MISSING` 由 `index.js` 判，AC-44 要求加载全程只读）。

### 2.5 `src/registry/index.js`（新增，WP-2）

**导出**

```js
export function loadRegistry({ root, onlyRole = null, builtinRoot = null } = {})
// -> { ok, roles, roleMap, skills, skillMap, errors, counts, groups }
```

- `builtinRoot`：**测试注入点**，缺省 `assetsRoot()`。WP-2 交付时仓库根还没有 `assets/`（归 WP-3），`registry.test.js` 用它指到 `os.tmpdir()` 下自造的**少量**合成资产（只造覆盖 14 个原因码所需的七八份，不追平 26 份——26 份是 WP-3 的产物，见 IC-3）；生产路径不传，行为等于 `assetsRoot()`。另：验 `REGISTRY_ASSETS_MISSING` 的用例要把 `builtinRoot` 指向一个**明确不存在**的路径（如 `path.join(tmp,'no-such')`），不能靠"真 `assets/` 还没造"，否则批 3 资产落地后该用例会翻转。**这是 F-1 冻结项之一。**

**`RoleDef`（内部形状，camelCase）**

```js
{ id, name, group, summary, artifactType, sideEffect, skills: string[],
  tools: string[], wakeAllow: string[], dispatchable: boolean,
  maxConcurrentSessions: number, source: 'builtin'|'project', file: string }
```

- `file`：**相对各自资产根**的路径 —— 内置资产的资产根是仓库根（`assets/roles/<id>.yaml`），项目资产的资产根是 `.orch`（`roles/<id>.yaml`）（与 A-4 的错误行一致）。**A-3 / A-6 要的 `.orch/` 前缀不在这里加**：渲染与 JSON 投影时按 `source === 'project' ? '.orch/' + file : file` 补（见 §2.9），这样同一个字段既服务 A-4 又服务 A-3/A-6，不用存两份。
- `SkillDef`：`{ id, name, summary, appliesTo: string[], commands: string[], body: string, source, file }`（`file` 口径同上：`skills/<id>/SKILL.md` / `assets/skills/<id>/SKILL.md`）。
- `roles` / `skills`：数组，**顺序** = D-4（组顺序 `GROUPS` → `id` 字典序，用 `<` 比较不用 `localeCompare`）；`roleMap` / `skillMap`：`Map`。
- `errors`：`Array<{ code, file, scope:'role'|'skill', field:string|null, line:number|null, params:object }>`，按 `file` 字典序、同文件内按 D-3 顺序。`YAML_PARSE_FAILED` 的 `params` 形如 `{ line, detailKey, detailParams }`（见 D-3 的 v5 修正）。
- `counts`：`{ assets, roles, skills, builtin, project, invalid }`（A-7 的 6 键，**资产级**）。`invalid` 按**文件**计；`assets = roles + skills + invalid`。⚠ 这**不是** `role list` 要的那张表（A-6 的 4 键是**角色级**，`builtin` 是 16 而不是 26），投影规则见 §2.9。
- `groups`：`[{ group, count }]`，固定 5 项、按 `GROUPS` 顺序，`count` 只数**合法角色**（`label` 由 CLI 从 `labels.js` 补）。
- `onlyRole`：只校验该 id 的角色文件（项目优先，找不到该 id 的文件时 `roles` 为空、`errors` 为空、`counts.roles = 0` 由 CLI 判 `找不到角色`），`counts = { assets:1, roles:1|0, skills:0, builtin, project, invalid }`；**`errors` 只保留该角色文件的条目**（技能文件的错误一律丢弃）；**技能表仍全量加载**用于引用解析（否则会误报 `ROLE_SKILL_NOT_FOUND`）。
- 合并规则（C-02）：同 id 项目版**整体覆盖**内置版，`source='project'`；项目目录不存在 = 没有项目资产，不是错误。
- 内置资产根缺失 → 单条 `REGISTRY_ASSETS_MISSING`（`params:{path}`），不再逐文件报错（D-3 第 4 条）。该条**没有所属文件**：`file` 取资产根下的裸目录名 `roles`、`scope` 取 `'role'`（A-7 的 `scope` 只有 `role`/`skill`，不能为空），`field` / `line` 为 `null`；没有任何 AC 观测这一行（环境级失败），口径登记在 §8 #20。
- **只读**：不 mkdir、不 writeFile、不读实例、不联网（C-03 / AC-44）。

### 2.6 `src/registry/role-instances.js`（新增，WP-5）

**导出**

```js
export function buildRoleInstances({ state, graph, roles })
// -> { roles: RoleInstanceView[], roleToSessions: Record<string,string[]> }
export function decideStatus({ terminal, known, boundCount, sessions, servingCount, doneCount })
// -> { status, statusReason }   纯函数，供单测直接打
```

**`RoleInstanceView`（A-6 的 9 键，camelCase）**

```js
{ roleId, roleInstanceId: 'RI-'+roleId, status, statusReason,
  activeSessions: string[], servingNodes: string[], hostIcons: string[],
  maxConcurrentSessions: number, lastAction: null | {nodeId, round, maxRounds, state, stateSince} }
```

- 角色集合 = `graph.roles ∪ graph.nodes[].roleId` 去重（C-04）；排序键 `(role ? GROUPS.indexOf(role.group) : GROUPS.length, role?.id ?? roleId)`。两处都必须防：`indexOf` 对未注册角色返回 `-1` 会排到**最前**，所以用 `GROUPS.length`；第二分量写 `role.id` 会在 `role === undefined` 时直接 **TypeError**，必须 `role?.id ?? roleId`（D-5 的 v5 修正）。
- `bound = state.nodes.filter(n => n.roleId === roleId)`；`serving = bound.filter(n => n.state === 'running' || n.state === 'review')`。
- `sess = state.sessions.filter(s => bound.some(n => n.nodeId === s.nodeId))`；`active = sess.filter(s => s.state !== 'idle' || s.quarantined === true)`（C-06）。
- `known = roles.has(roleId)`；六态判定优先级（D-5 的 v5 修正，命中即停）：`retired > unknown-role > inactive > unavailable > busy > cooldown > available`。**`known === false` 必须排在 `inactive` 之前**——否则"图里声明了、yaml 被删、又没有节点绑定"会算出 `inactive`，而不是需求要求的 `unavailable` / `unknown-role`。
- `statusReason`：`retired` / `inactive` / `busy` / `cooldown` / `available` → `null`；`unknown-role` → `'unknown-role'`；其余 `unavailable` → 有 `s.state === 'escalated'` 取 `'escalated'`，否则 `'quarantined'`。
- `hostIcons`：`serving` 节点对应会话的 `hostId` **去重后保序**（首个 `hostId` 在前），空 → `[]`，`hostId` 为 `null` 的不进数组。
- `lastAction`：`bound` 中 `stateSince` 最大者（同时刻取 `nodeId` 字典序较小者，保证确定性）；`maxRounds = graph.maxRounds?.[nodeId] ?? null`。
- `roleToSessions`：**只写非空**数组（AC-20 要断言"没有 coordinator 键"），会话按 `createdAt` 升序（同刻按 `sessionId`）。
- **未注册角色**（`known === false`）：`maxConcurrentSessions` 取 `null`（注册表里没有值，不能编一个 1）；A-6 的 9 键仍然齐全，`JSON.stringify` 不会丢键。文本展示时该位置用占位符 `—`（见 §2.9）。
- 纯函数：不读文件、不 import CLI、不看 `Date.now()`（AC-31 / NFR-04）。

### 2.7 `src/cli/labels.js`（改，WP-4）

**既有导出一个字符都不动**（`ROLE_LABEL` 保持 6 键，C-13 / D-8），**新增**以下导出：

```js
export const GROUP_LABEL = Object.freeze({ coordinator:'通用协调', research:'研究分析', writing:'内容创作', coding:'编码工程', ops:'业务运营' });
export const ROLE_INSTANCE_STATUS_LABEL = Object.freeze({ inactive:'未参与', available:'可用', busy:'服务中', cooldown:'冷却中', unavailable:'不可用', retired:'已关闭' });
export const ROLE_CLI_TEXT = Object.freeze({ /* 见下 */ });
export const REGISTRY_ERROR = Object.freeze({ /* 14 条模板，A-5 原文 */ });
export const YAML_DETAIL = Object.freeze({ /* detailKey → 中文短语，见下 */ });
export const USAGE_LINES = Object.freeze([ /* 8 行，A-5 原文 */ ]);
```

`YAML_DETAIL`（**5 个键**，对应 `yaml-lite` / `skill-file` 的 `detailKey`）：`'inconsistent-indentation' → '缩进不一致'`、`'unsupported-token' → '不支持的语法：{token}'`、`'duplicate-key' → '键重复：{key}'`、`'missing-value' → '缺少值：{key}'`、`'missing-front-matter' → '缺少前置元数据分隔符'`（共 5 条，`missing-front-matter` 由 `skill-file` 产出）。组装后嵌进 `REGISTRY_ERROR.YAML_PARSE_FAILED` 的 `{detail}`，于是 A-4 的 `第 4 行无法解析：缩进不一致（YAML_PARSE_FAILED）` 可以逐字产出，而 `src/registry` 保持零 CJK（D-3 的 v5 修正）。

`ROLE_CLI_TEXT` 的键（**唯一来源**，`render.js` / `roles.js` 只引用键名，不写字面量）：
`listHeader`（`角色 {total} 个（内置 {builtin} · 项目 {project}）`）、`listRow`（`- {id} {name} · {groupLabel} · {artifactType} · {sideEffect} · 技能 {skillCount} · 并发 {max}`）、`listInvalidTail`（`{n} 个资产未通过校验，执行 orch role validate 查看`）、`showDuty`、`showSkills`、`showTools`、`showWake`、`showSourceBuiltin`、`showSourceProject`、`instanceLine`（`实例 {instanceId}：{status} · 活跃会话 {active}/{max} · 服务节点 {nodes} · 宿主 {host} · {last}`，其中 `{last}` = `最近 {nodeId} · 轮次 {round}/{maxRounds}`；`lastAction` 为 `null` 时 `{last}` 整段退化为 `最近 —`，**不再带 `轮次` 段**——A-3 的 `无最近动作时…整行仍以 最近 — 结尾` 就是这个口径）、`instanceUnused`（`实例 {instanceId}：本实例未使用该角色`）、`unknownRoleNote`（`（注册表中不存在该角色）`）、`validateOk`（`校验资产 {assets} 个：全部通过（角色 {roles} · 技能 {skills}）`）、`validateFail`（`校验资产 {assets} 个：{invalid} 个不合法`）、`validateRow`（`- {file}：{detail}（{code}）`）、`notFoundRole`、`notFoundRoleHint`、`notFoundInstance`、`runRegistryInvalid`（`注册表不合法：{detail}`）、`placeholder`（`—`）、`usageReason`（`{ unknownRoleSub, missingRoleId, badFormat, badGroup, flagNotApplicable }` 五条模板，A-5 原文）。

`REGISTRY_ERROR` 的 14 个键与模板逐字照 A-5 的表；`USAGE_LINES` 逐字照 A-5 的 8 行块。

### 2.8 `src/cli/render.js`（改，WP-4）

**新增导出**

```js
export function renderRoleList({ counts, groups, rows }) // -> string[]（首行 + 每角色一行 + 可选末行）
//   counts 必须是 §2.9 listCounts() 的产物（角色级 4 键 total/builtin/project/invalid），
//   绝不是 loadRegistry 的资产级 6 键——A-2 的首行（共 <total> 个角色…）是文本断言，S3 不会被 JSON 兜住。
export function renderRoleShow({ roleRow, duty, skills, tools, wake, source, instanceLine }) // -> string[]（6 行；instanceLine 非空时 7 行）
//   roleRow 必须是 ROLE_CLI_TEXT.listRow 的产物（A-3 要求 show 首行与 list 行逐字相同，含前导 `- `）
export function renderRoleValidate({ counts, rows })   // -> string[]（首行 + 每个不合法资产一行）
//   counts 是 A-7 的资产级 6 键（首行要 assets / roles / skills / invalid）——与 renderRoleList 的角色级 4 键相反，勿串
export function renderRegistryInvalid(detail)          // -> string（`注册表不合法：<detail>`，A-5）
```

- 只做字符串拼接；**所有中文来自 `labels.js`**；不读文件、不发 IPC（D-1）。
- `USAGE_LINES` 从本文件**移除**，改为 `import { USAGE_LINES } from './labels.js'`；`renderUsage(message)` 的签名与输出格式（尾部 `  （<原因>）`）不变，只是行数从 5 变 8。
- 三个新函数返回**数组**（CLI 逐行 `out`，与既有渲染函数的字符串/数组口径保持"由调用方决定打印时机"的一致性）。

### 2.9 `src/cli/roles.js`（新增，WP-4）

**导出**

```js
export async function roleCommand(parsed, ctx) // -> Promise<number>（退出码）
export function firstRegistryDetail(errors)    // -> string | null：把 errors[0] 组装成人话明细（A-5 的 `注册表不合法：<明细>` 用）
// parsed = { command:'role', sub:'list'|'show'|'validate', positional:string|null, flags:{group?,instance?,format?} }
// ctx    = { cwd, now, out, createClient }（与 main.js 现有 ctx 同形）
```

- 顺序固定：`checkGroupValue()`（**只判一件事**：`--group` 的取值 ∈ `GROUPS`；不合法 → `out(render.renderUsage(ROLE_CLI_TEXT.usageReason.badGroup))`、返回 2）→ `loadRegistry({ root: ctx.cwd, onlyRole })` → 按 `sub` 分流 → 渲染 → 返回退出码。**其余四条用法错误的判定都在 `main.js` 的 `parseArgs` 里做，本文件不重复判**——两处都判会让同一原因出现两套文案（AC-37 会挂）。
- `firstRegistryDetail(errors)` 同时给 `run` 预检用（`main.js` import），保证"第一条明细"只有一处组装逻辑；`errors` 为空返回 `null`。返回值是 **A-4 的行内容去掉 `- ` 前缀**，即 `<相对路径>：<人话明细>（<原因码>）`（A-5 明写"明细版式同 A-4，不带 `- ` 前缀"）。
- **不带 `--instance` 的路径绝不调用 `ctx.createClient`**（AC-38 / BR-24 / C-09）；带 `--instance` 才 `createClient` → `connect({ensure:true})` → `instance.get`（`NOT_FOUND` → 先打角色 6 行再打 `找不到实例：<id>`、退出 1；`STATE_CORRUPT` → **同样先打角色 6 行**、再沿用既有文案、退出 1（B-03 只换末行，不吞角色定义）；`CORE_START_FAILED` → 退出 3）。
- 角色实例：`buildRoleInstances({ state: snapshot, graph: getGraph(snapshot?.template), roles: roleMap })`。
- JSON 投影在本文件内做**纯挑选**（不新增字段、不改语义）：
  - `toRoleJson(roleDef)` → A-6 的 **10 键**；`file` 按 `source === 'project' ? '.orch/' + role.file : role.file` 补前缀（A-6 要求项目版是"相对项目根的 `.orch/...` 路径"）。**文本的 `来源：` 行用同一个函数**（`renderRoleShow` 的 `source` 参数直接传 `toRoleJson(roleDef).file`），否则 A-3 的 `来源：项目 .orch/roles/<id>.yaml` 少一段。
  - `toRoleInstanceJson(view)` → A-6 的 **9 键**。
  - `toListJson({ rows, groups, registry, instance })` → 顶层 `counts` / `groups` / `roles`（+ 带 `--instance` 时的第 4 键 `instance`）。**`counts` 必须现算，不能直传 `registry.counts`**：`total = rows.length`、`builtin = rows.filter(r => r.source === 'builtin').length`、`project = rows.filter(r => r.source === 'project').length`、`invalid = registry.counts.invalid`；`groups` 同样按 `rows`（已按 `--group` 过滤）重算，不是 `registry.groups`；**`--group` 生效时 `groups` 数组只保留被选中的那一组**（长度 1，`count` 为该组行数）——AC-32 机检要 `groups.length === 1`，照 `GROUPS.map(...)` 直接映射会给 5 项。原因：A-6 的 4 键是**角色级**、A-7 的 6 键是**资产级**，同名 `builtin` 一个 16 一个 26（两张表不得混用，A-7 末尾已明写）。
  - `toShowJson({ roleDef, instance, view })` → 顶层恰好三键 `role` / `instance` / `roleInstance`；**不带 `--instance` 时后两者都是 `null`**；带 `--instance` 但该角色不属于本实例时 `roleInstance` 为 `null` 而 `instance` 仍给出 `{instanceId, template, state, roleToSessions}`（A-6）。
  - `toValidateJson({ registry })` → 顶层恰好两键 `counts` / `errors`。`counts` 直传资产级 6 键（`assets` / `roles` / `skills` / `builtin` / `project` / `invalid`）。`errors[]` 必须**逐条重建**成 A-7 的 6 键 `{ code, file, scope, field, line, detail }`：`detail = fill(REGISTRY_ERROR[code], err.params)`，**`params` 不带出去**。写成 `{ ...err, detail }` 会得到 7 键、直接违反 A-7，而 AC-04/05/07 只查 `code/field/file`、AC-33 只查 `role list` 的键集合——**S3 兜不住，必须在实现期写死投影式**。
  - `listCounts(rows, registry)` → 角色级 4 键 `{ total, builtin, project, invalid }`（`total = rows.length`、`builtin`/`project` 按 `rows[].source` 计数、`invalid = registry.counts.invalid`）。**文本与 JSON 共用这一份**：`renderRoleList` 的首行与 `toListJson().counts` 传同一个对象，禁止一处现算、一处直传 `registry.counts`（资产级 `builtin` 是 26、角色级是 16，只有逐字比对才看得出，AC-01/03/32 的首行判定会整条失真）。
- 打印一律 `JSON.stringify(value, null, 2)` 整块输出。
- 本文件 **CJK 零命中**：明细由 `REGISTRY_ERROR[code]` 模板 + `params` 替换产出（占位符替换写成本文件的 `fill()`），其余文案全取 `ROLE_CLI_TEXT`。
- 文本口径（A-3 的实例行）：状态名取 `ROLE_INSTANCE_STATUS_LABEL`；`服务节点` / `宿主` / `最近` 为空时写 `—`；**未注册角色**的并发上限为 `null`，该位置写 `—`（即 `活跃会话 1/—`），并在行尾追加 `（注册表中不存在该角色）`。
- 带 `--instance` 的分支必须在 `finally` 里 `await client.close?.()`，不留驻留连接（NFR-07：role 命令不驻留进程）。
- 不直接读 `state.json`（D-1）。

### 2.10 `src/cli/main.js`（改，WP-4）

- `COMMANDS` 加 `'role'`；`VALUE_FLAGS` 加 `'group'`、`'format'`；`PREFLIGHT_CODES` 加 `'REGISTRY_INVALID'`（→ 退出 3）。
- `parseArgs`：`command === 'role'` 时取子命令到 `sub`、可选位置参数到 `positional`，并内联做**六条**用法校验（`--group` 的**取值**不在其中，归 `roles.js`）——子命令 ∈ {list, show, validate}、`show` 必须有 id、`validate` 至多一个 id、`--group` 仅 `list`、`--instance` 仅 `list`/`show`、`--format` ∈ {text, json}。**其余命令的返回对象字段集合与取值一个都不变**（不新增 `positional` 键，`test/wp6/main.test.js` 的 `deepEqual(flags)` 不受影响）。
- **跨命令严格性不许放松**：`group` / `format` 只对 `role` 生效；`run` / `status` / `cancel` / `core` 给了这两个标志仍然返回用法错误，文案沿用既有的 `  （未知参数：--<key>）`（退出 2）。加了 `VALUE_FLAGS` 不等于让它们"被静默忽略"。
- `main()` 增加分支：`else if (parsed.command === 'role') code = await roleCommand(parsed, ctx);`。
- `runCommand` 预检（C-10）：**两步都要放在 `ctx.createClient(...)` 之前**——现有代码 `src/cli/main.js:202` 是"先 `createClient` 再 `connect`"，只挪到 `connect` 前还不够：`cli-role.test.js` 会用"`createClient` 一被调用就 assert.fail"的桩来验 AC-10，先建 client 会直接红。
  1. `flags.template` 给了但 `getGraph(flags.template) === null` → `out(render.renderError({code:'TEMPLATE_UNKNOWN', params:{name:flags.template}}))`，返回 `exitCodeFor('TEMPLATE_UNKNOWN')`（= 1）。这条保证 `test/wp6/main.test.js:247` 的逐字文案与退出码不变。
  2. `loadRegistry({ root: ctx.cwd })`；`!ok` → `out(render.renderRegistryInvalid(firstRegistryDetail(registry.errors)))`（明细由 `roles.js` 的同一函数组装），返回 3，**不连核心、不建 `.orch/instances`**。
- 用法错误文案仍由 `parseArgs` 产出中文（与既有命令一致），role 分支的五条文案取自 `ROLE_CLI_TEXT.usageReason`（`main.js` import `labels.js`，不新增字面量）。
- **`roles.js` 必须 `import { GROUPS } from '../registry/role-schema.js'`**，不许在本文件复制五个分组字面量——否则 AC-40 第 3 条（31 词扫 `src/cli/roles.js`）会命中 `coordinator`。
- **跨命令严格性要有着落**：`cli-role.test.js` 里补 4 组 `parseArgs` 断言 —— `['run','--cwd','.','--task','t'] + --format json`、`['status','--group','coding']`、`['cancel','--instance','x','--format','json']`、`['core','stop','--group','x']`，四者都必须 `ok === false`（`orch run --format json` / `orch status --group x` 仍是用法错误，M-9）。

### 2.11 `src/templates/index.js`（改，WP-5）

- 三个图对象各加一个字段 `roles: Object.freeze([...])`；**节点、边、`maxRounds`、`productPolicy`、提示词一个字节都不动**（AC-19 逐字回归红线）。
- `single.roles = ['worker']`；`codeLoop.roles = ['developer','tester','coordinator']`；`taskLoop.roles = ['researcher','writer','reviewer']`（逐字照需求 M-1）。
- 导出签名不变：`GRAPHS` 仍是 3 键，`ROLES` / `getGraph` / `defaultGraph` / `promptFor` 一个字符不动。

### 2.12 `test/fixtures/purity-check.mjs`（改，WP-6）

- 新入参 `--files <逗号分隔，相对仓库根>`；解析后存 `opts.files: string[] | null`。
- 给了 `--files`：**只扫这些文件**，不叠加 `DEFAULT_DIRS`，显式 `--dirs` 也不再生效（D-7 原文"`dirs` 视为空"）。
- 未给：`--dirs` 的行为与默认值**完全不变**（含 `目录不存在` 退出 2）。
- `--files` 里的文件不存在 → `console.log('文件不存在：<f>')` + `exit 2`（与目录不存在的既有做法一致，避免"扫 0 个文件 exit 0"的假绿）。
- `--json` 结果对象增加 `files` 字段（未用 `--files` 时为 `null`）；`OK: 扫描 N 个文件…零命中` / `FAIL: <n> 处命中` 汇总行格式不变。
- **`purity.test.js` 里三条命令的词表不是同一份**（D-7 的 v5 修正，务必照抄）：第 1 条 `--dirs src/core,src/daemon` 用 **31 词**；第 2 条 `--dirs src/registry` 用 **30 词（去掉 `coordinator`）**；第 3 条 `--files src/cli/roles.js` 用 **31 词**。三条都断 `exit 0` 且输出以 `OK:` 开头。
- **定点断言单独一条，且不能断 exit 0**：`purity-check.mjs` 的退出码是 `hits.length === 0 ? 0 : 1`（`test/fixtures/purity-check.mjs:115`），而 `GROUPS` 那一行必然命中 1 处 → 这条命令**必然 exit 1**，断 0 就是自相矛盾。正确做法是用 `--json` 读结果，不判退出码：

```bash
node test/fixtures/purity-check.mjs --dirs src/registry --forbid coordinator --json
# 断言（忽略 exit 1）：hits.length === 1
#                     hits[0].file === 'src/registry/role-schema.js'
#                     hits[0].snippet.includes('GROUPS')
```

  它能区分"1 行合法枚举"与"2 行（枚举 + 一处分支）"（后者 `hits.length === 2`）；它区分不了"同一行里既枚举又分支"（子串匹配、无 AST），所以表述要写成"**文本出现恰好 1 行且落在 `GROUPS` 行**"，不要写成"语义上只允许枚举"。
- **不要给 `purity-check.mjs` 加 `--cjk`**：AC-43 的 CJK 扫描按需求 §3.3 第 8 条用 `node -e` 在 `test/wp11/purity.test.js` 里做，命令原文写在这里以便复核：

```bash
# AC-43：src/registry 与 src/cli/roles.js 不得出现 CJK（assets/** 与 labels.js 不受限）
node -e "
const fs=require('fs'),path=require('path');
const bad=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory()) walk(p); else if(/[\u4e00-\u9fff]/.test(fs.readFileSync(p,'utf8'))) bad.push(p);}};
walk('src/registry');
for(const f of ['src/cli/roles.js']) if(/[\u4e00-\u9fff]/.test(fs.readFileSync(f,'utf8'))) bad.push(f);
if(bad.length){console.log('命中：'+bad.join(', '));process.exit(1);}console.log('OK: CJK 零命中');"
```

### 2.13 `src/core/advance.js`、`src/core/orchestrator.js`（改，WP-1）

- 仅改 3 处**注释**里的 `planner`：`src/core/advance.js:65` → `dispatcher`、`src/core/orchestrator.js:1856` → `scheduler`、`src/core/orchestrator.js:2267` → `engine`。
- **零代码改动**（M-8 / D-8）：`git diff` 必须只出现这三行注释；这三处不改，WP-1 之后任何一包跑 31 词扫描都会 FAIL。
- 实测依据：当前 31 词扫 `src/core,src/daemon` 只有这 3 处命中（`FAIL: 3 处命中`，全部是 `planner`）。

### 2.14 `assets/roles/*.yaml`、`assets/skills/*/SKILL.md`（新增，WP-3）

- 16 个角色文件与 10 个技能文件的**取值表**是需求附录 A-1（id / 名称 / 分组 / 产物 / 副作用 / 技能 / 并发），**逐行照抄，不许发挥**。
- 文件形状、必填键、可选键由 §2.3 的 `ROLE_REQUIRED_KEYS` / `ROLE_OPTIONAL_KEYS` 与 §3.1 / §3.3 的样例决定。
- `worker` 是本轮唯一**不引用任何技能**的角色（`skills: []`），用来覆盖"技能为空"的渲染与解析分支。
- 每个技能正文必须写"工作方法"（`### 工作方法` + 编号步骤），至少 3 步；正文非空是 `SKILL_BODY_EMPTY` 的判定对象。

---

## 3. 数据模型

> 唯一事实：**注册表（文件）+ 实例快照（`state.json`）+ 图（代码常量）**。角色实例是这三者的派生，不是第四份事实（C-07）。

### 3.1 角色文件（正常态，`assets/roles/developer.yaml`）

```yaml
schema: role/v1
id: developer
name: 开发
group: coding
summary: 按任务修改代码，交出声明的产物文件
artifact_type: code
side_effect: write
skills:
  - code-change
  - test-run
tools:
  - read
  - write
  - edit
  - bash
wake_allow:
  - tester
max_concurrent_sessions: 1
```

### 3.2 角色文件（异常态，逐份对应 AC-04 ~ AC-09 的夹具）

> 每段围栏里的**第一行就是文件第 1 行**（说明文字一律在围栏外），`line` 按 1 基物理行计——AC-09 要 `line === 4`，所以夹具必须让错误行正好落在第 4 行，任何 YAML 注释都会被计成一行。
> 除有意制造的那一处缺陷外，其余 8 个必填键（含 `skills`）**必须齐全**，否则会多报一条 `ROLE_SCHEMA_MISSING` 把 `errors[0]` 顶掉——AC-04 / AC-05 / AC-07 / AC-06 / AC-08 / AC-09 的机检都要求 `errors[0].code` 是各自那个原因码。AC-09 的夹具（4 空格缩进、无 2 空格父级）对应的 `detailKey` 是 `inconsistent-indentation`（§2.1 的口径是"同一层级缩进不一致"，该夹具属于"子层级比父层级缩进更浅/无父级"，实现时若另立键，A-4 的 `缩进不一致` 就不再逐字，**必须复用这一个键**）。

**① `.orch/roles/no-concurrency.yaml`（AC-04）→ 只缺 `max_concurrent_sessions`，`errors` 长度 1**

```yaml
schema: role/v1
id: no-concurrency
name: 没并发
group: coding
summary: 只缺并发上限
artifact_type: code
side_effect: read
skills: []
```

**② `.orch/roles/writer.yaml`（AC-05）→ 文件叫 `writer.yaml`、声明 `id: wordsmith`**

```yaml
schema: role/v1
id: wordsmith
name: 冒名
group: writing
summary: 文件名与声明 id 不一致
artifact_type: document
side_effect: write
skills: []
max_concurrent_sessions: 1
```

**③ `.orch/roles/bad-group.yaml`（AC-06）→ `group: marketing`**

```yaml
schema: role/v1
id: bad-group
name: 坏分组
group: marketing
summary: 分组不在五组内
artifact_type: report
side_effect: read
skills: []
max_concurrent_sessions: 1
```

**④ AC-07 的三份文件（`artifact_type` / `side_effect` / `max_concurrent_sessions` 各越界一份，其余齐全）**

`.orch/roles/bad-artifact.yaml`：

```yaml
schema: role/v1
id: bad-artifact
name: 坏产物
group: coding
summary: 产物类型不在四类内
artifact_type: slides
side_effect: read
skills: []
max_concurrent_sessions: 1
```

`.orch/roles/bad-side-effect.yaml`：

```yaml
schema: role/v1
id: bad-side-effect
name: 坏副作用
group: coding
summary: 副作用等级不在四级内
artifact_type: code
side_effect: admin
skills: []
max_concurrent_sessions: 1
```

`.orch/roles/bad-concurrency.yaml`：

```yaml
schema: role/v1
id: bad-concurrency
name: 坏并发
group: coding
summary: 并发上限超出 1~5
artifact_type: code
side_effect: read
skills: []
max_concurrent_sessions: 9
```

**⑤ `.orch/roles/ghost-skill.yaml`（AC-08）→ `ROLE_SKILL_NOT_FOUND`，`params.skill: no-such-skill`**

```yaml
schema: role/v1
id: ghost-skill
name: 悬空
group: research
summary: 引用了不存在的技能
artifact_type: report
side_effect: read
skills:
  - no-such-skill
max_concurrent_sessions: 1
```

**⑥ `.orch/roles/broken.yaml`（AC-09）→ `YAML_PARSE_FAILED`，`line: 4`**

```yaml
schema: role/v1
id: broken
name: 坏语法
    summary: 四个空格缩进，前面没有 2 空格的父级可挂
```

### 3.3 技能文件（正常态 + 四种异常态）

```markdown
---
schema: skill/v1
id: code-change
name: 代码修改
summary: 定位到要改的文件，做最小改动，并写清改了什么
applies_to: [coding]
commands: ["node --test"]
---

### 工作方法

1. 先读任务里「产物：」那一行，确认要改的文件。
2. 只改必要位置，不动无关文件。
3. 改完说明：改了哪个文件、为什么这样改。
```

- ① 项目目录 `.orch/skills/half-done/` 存在但没有 `SKILL.md`（AC-13）→ `SKILL_FILE_MISSING`，`params.dir: half-done`（**AC-13 的场景是项目级**，D-9 也禁止测试往仓库目录写东西）。
- ② **AC-14 是同一份文件的两处缺陷，不是"二选一"**：`.orch/skills/quote/SKILL.md` 里 `id: quoting`（目录名是 `quote`）**并且**没有 `summary`。两个缺陷必须同时出现在这一份里，Then 的"对该文件报两条"才有对象：

```markdown
---
schema: skill/v1
id: quoting
name: 引文
---

### 工作方法

1. 只摘原文，不改写。
```

  预期该文件的 `errors` **恰好两条**：`SKILL_SCHEMA_MISSING`（`field: 'summary'`）与 `SKILL_ID_MISMATCH`（`params: { dirId: 'quote', declaredId: 'quoting' }`）；`SKILL_SCHEMA_MISSING` 在前（D-3 的技能校验顺序里第 ③ 步先于第 ④ 步）。注意 `id` 与目录名**故意不一致**，实现时不要"修正"成一致；正文非空，所以不会多报 `SKILL_BODY_EMPTY`。
- ③ 只有元数据、正文为空（AC-15）→ `SKILL_BODY_EMPTY`。**其余必填键（含 `summary`）必须齐全**，否则 `errors[0]` 会被 `SKILL_SCHEMA_MISSING` 顶掉、机检的 `errors[0].code` 判错。
- ④ `applies_to: [marketing]`（AC-16）→ `SKILL_GROUP_INVALID`。同样要求其余必填键齐全（`errors[0].code` 必须是 `SKILL_GROUP_INVALID`），且正文非空。

### 3.4 项目覆盖文件（AC-28 / AC-45 用）

**`.orch/roles/writer.yaml`——只把并发上限从 2 改成 3，其余整份复制（项目版整体覆盖，不继承，C-02）**

```yaml
schema: role/v1
id: writer
name: 撰写者
group: writing
summary: 按研究笔记与缺陷清单撰写完整文档，每轮交一个新版本
artifact_type: document
side_effect: write
skills:
  - doc-draft
max_concurrent_sessions: 3
```

**`.orch/skills/code-change/SKILL.md`——覆盖后 `counts.builtin` 25 / `counts.project` 1 / `counts.skills` 仍 10（AC-45）**

```markdown
---
schema: skill/v1
id: code-change
name: 代码修改（项目版）
summary: 项目自己的改法
applies_to: [coding]
commands: ["npm test"]
---

### 工作方法

1. 只改 `src/` 下的文件。
2. 改完跑 `npm test`。
3. 在 PR 描述里写清根因。
```

### 3.5 实例快照 `state.json`（唯一事实来源，节选真实字段）

```json
{
  "instanceId": "INST-001",
  "state": "running",
  "stateSince": "2026-11-08T10:00:03.000Z",
  "template": "code-loop",
  "halted": false,
  "rev": 17,
  "nodes": [
    {
      "nodeId": "T-001", "roleId": "developer", "round": 1, "state": "done",
      "stateSince": "2026-11-08T10:00:40.000Z", "endedAt": "2026-11-08T10:00:40.000Z",
      "sessionId": "mock-sess-1", "verdict": null
    },
    {
      "nodeId": "T-002", "roleId": "tester", "round": 1, "state": "running",
      "stateSince": "2026-11-08T10:00:45.000Z", "endedAt": null,
      "sessionId": "mock-sess-2", "verdict": null
    }
  ],
  "sessions": [
    { "sessionId": "mock-sess-1", "nodeId": "T-001", "round": 1, "hostId": "dsh",
      "state": "idle", "createdAt": "2026-11-08T10:00:05.000Z", "quarantined": false },
    { "sessionId": "mock-sess-2", "nodeId": "T-002", "round": 1, "hostId": "dsh",
      "state": "thinking", "createdAt": "2026-11-08T10:00:41.000Z", "quarantined": false }
  ]
}
```

**按 D-5 推演这份快照**（`code-loop` 的 `graph.roles = ['developer','tester','coordinator']`）：`developer` → `cooldown`（T-001 `done`、无服务节点、实例未终结）、`tester` → `busy`（T-002 `running`、会话 `thinking`）、`coordinator` → `inactive`（声明但零绑定）。三者的 `lastAction` 分别是 T-001 / T-002 / `null`；`roleToSessions` 有 `developer` 与 `tester` 两个键，**没有** `coordinator`。

异常态（D-5 的判定输入，全部来自既有代码，本迭代不改 `state.json` 形状）：

| 异常态 | 夹具怎么造 | 角色实例结果 |
|---|---|---|
| 实例已终结 | `state.state = 'completed'`（或 `failed` / `cancelled` / `interrupted`） | 全部角色 `retired`（优先级最高） |
| 会话被隔离 | `session.state = 'idle'` + `session.quarantined = true`（隔离与升级两条路径都同时置这两个字段，`src/adapter/session-state.js:236-248`） | 该角色 `unavailable` + `statusReason: 'quarantined'` |
| 会话已升级 | `session.state = 'escalated'` | 该角色 `unavailable` + `statusReason: 'escalated'` |
| 角色不在注册表 | 图里声明了 `roles` 但删掉对应的 yaml（`ac31` 不用这条；**该分支没有 AC**，由 `role-instances.test.js` 单测覆盖） | `unavailable` + `statusReason: 'unknown-role'`，排最后，`maxConcurrentSessions: null` |
| 声明但零绑定 | `graph.roles` 含 `coordinator`，`nodes[].roleId` 不含 | `inactive`，`servingNodes`/`activeSessions` 空，`roleToSessions` 无该键 |

### 3.6 `role list --format json`（派生视图，**不落盘**）

> **本节的样例取自需求 A-6 的示例形态（`developer` 正在服务），与 §3.5 不是同一次运行**——§3.5 那份快照推出来的是 `developer: cooldown`。造夹具时以"你想验哪条 AC"为准：AC-22 取本节这种 `busy`，AC-24 取 §3.5 那种 `cooldown`。

```json
{
  "counts": { "total": 16, "builtin": 16, "project": 0, "invalid": 0 },
  "groups": [
    { "group": "coordinator", "label": "通用协调", "count": 5 },
    { "group": "research", "label": "研究分析", "count": 3 },
    { "group": "writing", "label": "内容创作", "count": 3 },
    { "group": "coding", "label": "编码工程", "count": 3 },
    { "group": "ops", "label": "业务运营", "count": 2 }
  ],
  "roles": [
    {
      "id": "developer", "name": "开发", "group": "coding", "groupLabel": "编码工程",
      "artifactType": "code", "sideEffect": "write", "skills": ["code-change", "test-run"],
      "maxConcurrentSessions": 1, "source": "builtin", "file": "assets/roles/developer.yaml"
    }
  ]
}
```

带 `--instance INST-001` 时**追加第 4 个顶层键**：

```json
{
  "instance": {
    "instanceId": "INST-001", "template": "code-loop", "state": "running",
    "roles": [
      { "roleId": "developer", "roleInstanceId": "RI-developer", "status": "busy",
        "statusReason": null, "activeSessions": ["mock-sess-1"], "servingNodes": ["T-001"],
        "hostIcons": ["dsh"], "maxConcurrentSessions": 1,
        "lastAction": { "nodeId": "T-001", "round": 1, "maxRounds": 2,
                        "state": "running", "stateSince": "2026-11-08T10:00:45.000Z" } }
    ],
    "roleToSessions": { "developer": ["mock-sess-1"], "tester": ["mock-sess-2"] }
  }
}
```

### 3.7 `role validate --format json`（异常态样例）

```json
{
  "counts": { "assets": 27, "roles": 16, "skills": 10, "builtin": 26, "project": 0, "invalid": 1 },
  "errors": [
    { "code": "ROLE_SKILL_NOT_FOUND", "file": "roles/ghost-skill.yaml", "scope": "role",
      "field": "skills", "line": null, "detail": "引用的技能不存在：no-such-skill" }
  ]
}
```

文本版（A-4）：

```
校验资产 27 个：1 个不合法
- roles/ghost-skill.yaml：引用的技能不存在：no-such-skill（ROLE_SKILL_NOT_FOUND）
```

> 自洽核对：`roles 16 + skills 10 + invalid 1 = assets 27 = builtin 26 + project 0 + invalid 1`（`assets = roles + skills + invalid`，且 `builtin + project` 只数**合法**资产——`.orch/roles/ghost-skill.yaml` 不合法，所以 `project` 是 0 而不是 1）。这是"项目里只放了一份坏角色"的最简场景；AC-45 那种"放一份**合法**项目技能"才会让 `project` 变 1、`builtin` 变 25、`assets` 仍是 26。

### 3.8 不落盘声明（AC-30 / AC-44 的判定依据）

| 文件 | 谁写 | 本迭代是否新增写入 |
|---|---|---|
| `state.json` | 仅核心（`transit()` + CAS） | **否**，`role` 命令只经 `instance.get` 读 |
| `events.jsonl` | 仅核心 | **否**，`role` 命令不发事件 |
| `assets/**`、`.orch/roles/**`、`.orch/skills/**` | 人（或 I1.6 的命令） | **否**，加载全程只读 |
| 角色实例 | 无（派生视图） | **否**，每次调用现算 |

---

## 4. 工作包拆分（WP-1 ~ WP-6，文件互不重叠）

> 六包按**能力**切，不按目录切。**`assets/**` 不在本文档 §1.5 自检脚本的抓取范围**（脚本只认 `src|test|bin` 开头的反引号路径），`assets/**` 的归属由本节 WP-3 显式声明并人工核对。

### WP-1 解析层与注释净化（依赖：无）

- **负责文件（8）**：`src/registry/yaml-lite.js`、`src/registry/skill-file.js`、`src/registry/role-schema.js`、`src/core/advance.js`（仅注释）、`src/core/orchestrator.js`（仅注释）、`test/wp11/yaml-lite.test.js`、`test/wp11/skill-file.test.js`、`test/wp11/role-schema.test.js`
- **依赖**：无（第一个包，其余包等它的三个契约）
- **交付**：`parseYaml` / `parseSkillFile` / `checkRoleShape` / `checkSkillMeta` 四个纯函数 + `role-schema.js` 的 10 个常量；3 处 `planner` 注释改写（M-8），让 31 词扫描在 `src/core,src/daemon` 先变绿
- **验收口径**：本包**不含主责 AC**（**已登记为例外**，见 §8 #13）——AC 层面的判定点都在命令面（WP-2 / WP-4），因为每条 AC 的观测点都是 `orch role` 的输出。它的独立验证 = 三个用例文件（≥45 条单测：缩进/注释/引号/行内序列/空值/不支持语法/行号偏移/必填键顺序/取值域/id 正则/`detailKey` 四键）+ 31 词扫描 exit 0 + 「`coordinator` 在 `src/registry` 只出现 1 次」这条定点断言（D-7 的 v5 修正）。**这两条在批 1 就能跑**：`purity-check.mjs` 的 `--dirs` / `--forbid` / `--json` 今天都有，定点断言用 `--dirs src/registry --forbid coordinator --json` 判 `hits.length === 1`（预期目录里只有 `role-schema.js` 的 `GROUPS` 一行命中，故进程退出码为 1，**不断言退出码**）；WP-6 的 `--files` 只服务于 AC-43 的单文件扫描，不阻塞批 1 门禁。**协作**：AC-09（行号精确）、AC-14（`field` 精确）、AC-16（`applies_to` 判定）
- **可否并行**：否 —— 它的返回结构是 WP-2 / WP-4 的判据，必须先冻结

### WP-2 注册表加载、校验与合并（依赖：WP-1）

- **负责文件（3）**：`src/registry/assets.js`、`src/registry/index.js`、`test/wp11/registry.test.js`
- **依赖**：WP-1（`parseYaml` / `parseSkillFile` / `checkRoleShape` / `checkSkillMeta` 的已冻结签名）
- **交付**：`loadRegistry({root, onlyRole, builtinRoot})` 完整管线（D-3 的 4 步校验顺序 + D-4 的合并与排序 + 14 个原因码 + 6 键资产级 `counts` + `groups`）；`assets.js` 的 5 个路径函数
- **验收口径**：**主责** AC-04、AC-05、AC-06、AC-07、AC-08、AC-09、AC-12、AC-13、AC-14、AC-15、AC-16、AC-44、AC-45。`registry.test.js` 用 `fs.mkdtemp` 在 `os.tmpdir()` 下造**两个**根：项目根 + 合成内置根（`builtinRoot` 指过去），逐条覆盖 14 个原因码、合并覆盖、`onlyRole`（含 `errors` 只留该角色文件）、排序、只读（前后 sha256 一致）、不 import 网络模块。**仓库根此时还没有 `assets/`（归 WP-3），所以本包必须依赖 `builtinRoot` 注入点，否则每条用例都只会拿到一条 `REGISTRY_ASSETS_MISSING`。** **协作**：AC-03（项目覆盖的 `source`/`file`）、AC-11（`invalid` 计数）
- **可否并行**：否 —— WP-3 / WP-4 / WP-5 都要它的 `RoleDef` 与 `errors` 形状

### WP-3 内置资产（16 角色 + 10 技能）（依赖：WP-1 的字段契约；验证依赖 WP-2）

- **负责文件（27）**：`assets/roles/arbiter.yaml`、`assets/roles/coordinator.yaml`、`assets/roles/planner.yaml`、`assets/roles/summarizer.yaml`、`assets/roles/worker.yaml`、`assets/roles/data-analyst.yaml`、`assets/roles/fact-checker.yaml`、`assets/roles/researcher.yaml`、`assets/roles/editor.yaml`、`assets/roles/reviewer.yaml`、`assets/roles/writer.yaml`、`assets/roles/code-reviewer.yaml`、`assets/roles/developer.yaml`、`assets/roles/tester.yaml`、`assets/roles/compliance-reviewer.yaml`、`assets/roles/requirement-clarifier.yaml`、`assets/skills/research-brief/SKILL.md`、`assets/skills/fact-check/SKILL.md`、`assets/skills/data-analysis/SKILL.md`、`assets/skills/doc-draft/SKILL.md`、`assets/skills/doc-review/SKILL.md`、`assets/skills/code-change/SKILL.md`、`assets/skills/test-run/SKILL.md`、`assets/skills/code-review/SKILL.md`、`assets/skills/coordination/SKILL.md`、`assets/skills/compliance-check/SKILL.md`、`test/wp11/assets.test.js`
- **依赖**：WP-1（§2.3 的必填/可选键与取值域，契约冻结后即可动笔）；**验证**依赖 WP-2（`loadRegistry` 跑通）
- **交付**：需求附录 A-1 的 16 行取值表逐行落地；10 个技能正文各 ≥3 步「工作方法」；`worker` 的 `skills: []`；同 id 角色中文名与 `labels.js` 的 `ROLE_LABEL` 逐字一致（`developer` 开发 / `tester` 测试 / `coordinator` 协调者 / `researcher` 研究员 / `writer` 撰写者 / `reviewer` 审核者）
- **验收口径**：**主责** AC-17（五组 5/3/3/3/2，每组 ≥2）、AC-18（模板用到的 6 个角色 + `worker` 全在表内、中文名逐字一致）。这两条的 Then 是命令输出（`role list --format json` 的 `groups[].count`），**命令面由验收脚手架（S3）与 WP-4 的 `cli-role.test.js` 复验**；本包提供的等价单测是 `assets.test.js`——直接读真实 `assets/` 并 `import { ROLE_LABEL }` 逐字比对，两者判同一件事，不构成双份事实。**协作**：AC-12（10 个技能全部可解析、技能并集覆盖 10 个）、AC-01（16 行的内容与顺序）
- **可否并行**：可 —— 与 WP-5 零交集，且本包只写数据文件与一个用例

### WP-4 CLI 角色命令与发起前预检（依赖：WP-2、WP-3、WP-5）

- **负责文件（5）**：`src/cli/labels.js`、`src/cli/render.js`、`src/cli/roles.js`、`src/cli/main.js`、`test/wp11/cli-role.test.js`
- **依赖**：WP-2（`Registry` 结果形状）+ **WP-3**（真实 16 角色 / 10 技能，否则 A-2 的 16 行与 AC-01 的数字无从对上）+ **WP-5**（`buildRoleInstances` 的代码，`--instance` 分支真的要调用它）。§2.6 的契约冻结只让本包**能提前动笔写渲染**（F-5），**不构成提前可验收**——它排在第四批就是这个原因。
- **交付**：`GROUP_LABEL` / `ROLE_INSTANCE_STATUS_LABEL` / `ROLE_CLI_TEXT` / `REGISTRY_ERROR`（14 条）/ `YAML_DETAIL`（5 条）/ `USAGE_LINES`（8 行）六张表；四个渲染函数；`roleCommand` + `firstRegistryDetail`；`parseArgs` 的 role 分支；`COMMANDS`/`VALUE_FLAGS`/`PREFLIGHT_CODES` 三处增量；`runCommand` 的两步预检（模板名 → 注册表）
- **验收口径**：**主责** AC-01、AC-02、AC-03、AC-10、AC-11、AC-32、AC-33、AC-34、AC-35、AC-36、AC-37、AC-38、AC-39。`cli-role.test.js` 直接 `import { main }` 并注入 `out` 与 `cwd`（不 spawn、不启核心），逐条断言 A-2/A-3/A-4/A-5/A-6/A-7 的逐字版式与退出码。**协作**：AC-04 ~ AC-09（A-4 的行版式 `- <file>：<detail>（<code>）`）、**AC-12 ~ AC-17**（这六条的判定点是 `role validate` / `role list` 的**命令输出**，资产由 WP-3 提供、版式由本包提供）、AC-45（`counts` 与 `skills` 数组）、AC-43（`roles.js` 的 CJK 零命中）
- **可否并行**：否 —— 它与 WP-3 / WP-5 都要经它才可被 AC 观测，单独一批执行（4 个源文件是本轮最大的包）

### WP-5 角色实例模型与图角色声明（依赖：WP-2）

- **负责文件（3）**：`src/registry/role-instances.js`、`src/templates/index.js`、`test/wp11/role-instances.test.js`
- **依赖**：WP-2（`roleMap` / `RoleDef.group`）+ §2.6 的 `RoleInstanceView` 契约（先冻结契约再写实现；下游的 CLI 包按同一份契约并行渲染，**不构成反向依赖**——本包的**依赖边**只有 WP-2 一条（另需 `import` WP-1 的 `role-schema.js` 常量 `GROUPS`，那只读常量、不构成包级依赖，见 §8 #15））
- **交付**：`buildRoleInstances` + `decideStatus`；六态判定优先级；`roleToSessions`；`hostIcons`；`lastAction`；三个图的 `roles` 字段（`single` 含 `worker`、`code-loop` 含 `coordinator`、`task-loop` 三角色）
- **验收口径**：**主责** AC-19、AC-20、AC-21、AC-22、AC-23、AC-24、AC-25、AC-26、AC-27、AC-28、AC-29、AC-30、AC-31。`role-instances.test.js` 用**内存合成**的 `state` + 合成图（不碰磁盘）覆盖六态、优先级冲突、`unknown-role` 排序、`quarantined` 分支（该分支不设 AC，D-9 指定由本用例覆盖）、`roleToSessions` 含 `idle` 会话、`lastAction` 同刻取小 `nodeId`。AC-19 的三条主链逐字回归在主控整合检查点复跑
- **可否并行**：可 —— 与 WP-3 零交集

### WP-6 架构纯净与回归守卫（依赖：WP-1、WP-2、WP-4、WP-5）

- **负责文件（2）**：`test/fixtures/purity-check.mjs`、`test/wp11/purity.test.js`
- **依赖**：WP-1（注释已净化）、WP-2 / WP-4 / WP-5（被扫描的目录与文件已存在）
- **交付**：`--files` 入参（给了只扫列出的文件；没给行为与默认值不变；文件不存在 exit 2）；`purity.test.js` 的四组断言——D-7 三条扫描命令各断一次 exit 0（**第 1 条 31 词、第 2 条 30 词、第 3 条 31 词**）、`coordinator` 在注册表目录的命中恰好 1 条且落在 `GROUPS` 行（用 `--json` 判 `hits.length === 1` 与 `hits[0].file`，**不断言退出码**）、AC-43 的 CJK 扫描 exit 0、零依赖（`node -e` 读 `package.json`）
- **验收口径**：**主责** AC-40、AC-41、AC-42、AC-43。`purity.test.js` 用 `child_process.spawnSync` 跑 `purity-check.mjs` 与 `node -e`：三条扫描断「退出码 0 + `OK:` 前缀」，定点断言只解析 `--json` 的 `hits`；AC-42 由主控跑全量并留 `results` 原始输出。**协作**：无。⚠ 第 2 条必须用 30 词（去掉 `coordinator`），否则 `role-schema.js` 的 `GROUPS` 枚举会让它构造性 FAIL（D-7 的 v5 修正）。**本包只读其它包的文件、绝不修改**（被扫描的目录与单文件都属于 WP-1/2/4/5）
- **可否并行**：否 —— 必须在其余五包的产物都落地后才能判定

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-4 | WP-3 | 16 行内容来自 WP-3，版式来自 WP-4 |
| AC-02 | WP-4 | — | `role show` 6 行逐字 |
| AC-03 | WP-4 | WP-2 | `source`/`file` 由 WP-2 给 |
| AC-04 | WP-2 | WP-4 | 原因码 WP-2，行版式 WP-4 |
| AC-05 | WP-2 | WP-4 | 同上 |
| AC-06 | WP-2 | WP-4 | 同上 |
| AC-07 | WP-2 | WP-4 | 三条越界各一行 |
| AC-08 | WP-2 | WP-4 | `ROLE_SKILL_NOT_FOUND` |
| AC-09 | WP-2 | WP-1、WP-4 | 行号由 WP-1 的解析器给 |
| AC-10 | WP-4 | WP-2 | `run` 预检退出 3 |
| AC-11 | WP-4 | WP-2 | 坏资产不阻塞列表 |
| AC-12 | WP-2 | WP-3 | 10 个技能可解析、无悬空 |
| AC-13 | WP-2 | WP-3 | `SKILL_FILE_MISSING` |
| AC-14 | WP-2 | WP-1、WP-3 | 缺字段 / id 不一致 |
| AC-15 | WP-2 | WP-3 | 正文空 |
| AC-16 | WP-2 | WP-1、WP-3 | `applies_to` 越界 |
| AC-17 | WP-3 | WP-2 | 五组计数 |
| AC-18 | WP-3 | WP-4 | 中文名与 `ROLE_LABEL` 对照 |
| AC-19 | WP-5 | WP-3 | 图加 `roles` 后主链逐字不变 |
| AC-20 | WP-5 | WP-3、WP-4 | `coordinator` 的 `inactive` |
| AC-21 | WP-5 | WP-3、WP-4 | 三角色顺序 |
| AC-22 | WP-5 | WP-4 | `busy` + 活跃会话 + `servingNodes` |
| AC-23 | WP-5 | WP-4 | `available` |
| AC-24 | WP-5 | WP-4 | `cooldown` |
| AC-25 | WP-5 | WP-3、WP-4 | `inactive` |
| AC-26 | WP-5 | WP-4 | `unavailable`（升级接缝） |
| AC-27 | WP-5 | WP-3、WP-4 | `retired` |
| AC-28 | WP-5 | WP-2、WP-4 | 并发上限来自注册表 |
| AC-29 | WP-5 | WP-4 | `roleToSessions` 多会话 |
| AC-30 | WP-5 | WP-4 | 派生视图不回写 |
| AC-31 | WP-5 | WP-4 | 顺序稳定不重复 |
| AC-32 | WP-4 | WP-2 | `--group` 过滤 |
| AC-33 | WP-4 | WP-2 | 键集合 |
| AC-34 | WP-4 | — | 找不到角色 |
| AC-35 | WP-4 | — | 缺角色 id |
| AC-36 | WP-4 | WP-2 | 单角色校验 |
| AC-37 | WP-4 | — | 三种用法错误 |
| AC-38 | WP-4 | — | 不建 `.orch`、不启核心 |
| AC-39 | WP-4 | — | 实例不存在 |
| AC-40 | WP-6 | WP-1、WP-2、WP-4、WP-5 | 三条扫描 |
| AC-41 | WP-6 | — | 零依赖 |
| AC-42 | WP-6 | 全部 | 全量回归 |
| AC-43 | WP-6 | WP-4 | CJK 零命中 |
| AC-44 | WP-2 | — | 加载只读、不联网 |
| AC-45 | WP-2 | WP-4 | 项目级技能覆盖 |

> 覆盖核对：45 条 AC 全部有主责 WP，无遗漏、无重复主责（13 + 2 + 13 + 13 + 4 = 45）。

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/registry/yaml-lite.js` | YAML 子集解析（`parseYaml`） | WP-1 |
| `src/registry/skill-file.js` | `SKILL.md` 前置元数据与正文拆分 | WP-1 |
| `src/registry/role-schema.js` | 字段契约常量 + `checkRoleShape` / `checkSkillMeta` | WP-1 |
| `src/registry/assets.js` | 内置/项目资产目录定位 | WP-2 |
| `src/registry/index.js` | `loadRegistry`：扫描→解析→校验→合并→引用解析 | WP-2 |
| `src/registry/role-instances.js` | `buildRoleInstances` / `decideStatus` 纯函数 | WP-5 |
| `src/cli/roles.js` | `roleCommand`：参数校验、加载调度、JSON 投影、退出码 | WP-4 |
| `src/cli/labels.js` | +6 张表（分组名 / 六态名 / 命令文案 / 14 条 `REGISTRY_ERROR` / 5 条 `YAML_DETAIL` / 8 行 `USAGE_LINES`） | WP-4 |
| `src/cli/render.js` | +4 个渲染函数；`USAGE_LINES` 改为从 `labels.js` 引入 | WP-4 |
| `src/cli/main.js` | `role` 命令分支、`parseArgs` 扩展、`run` 两步预检、`REGISTRY_INVALID` → 退出 3 | WP-4 |
| `src/templates/index.js` | 三个图各加 `roles` 声明（其余零改动） | WP-5 |
| `src/core/advance.js` | 1 处注释改写（`planner` → `dispatcher`） | WP-1 |
| `src/core/orchestrator.js` | 2 处注释改写（`planner` → `scheduler` / `engine`） | WP-1 |
| `assets/roles/{arbiter,coordinator,planner,summarizer,worker,data-analyst,fact-checker,researcher,editor,reviewer,writer,code-reviewer,developer,tester,compliance-reviewer,requirement-clarifier}.yaml` | 16 个内置角色定义 | WP-3 |
| `assets/skills/{research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check}/SKILL.md` | 10 个内置技能 | WP-3 |
| `test/wp11/yaml-lite.test.js` | 解析器单测（行号、不支持语法、引号、注释、空值） | WP-1 |
| `test/wp11/skill-file.test.js` | 前置元数据拆分单测 | WP-1 |
| `test/wp11/role-schema.test.js` | 字段契约与顺序单测 | WP-1 |
| `test/wp11/registry.test.js` | 14 个原因码、合并、`onlyRole`、排序、只读 | WP-2 |
| `test/wp11/assets.test.js` | 真实 `assets/` 的 26 个资产、五组计数、技能并集、中文名对照 | WP-3 |
| `test/wp11/role-instances.test.js` | 六态、优先级、`unknown-role`、`quarantined`、`roleToSessions`、确定性 | WP-5 |
| `test/wp11/cli-role.test.js` | 三条命令的逐字版式、JSON 键集合、退出码 0/1/2/3 | WP-4 |
| `test/wp11/purity.test.js` | D-7 三条扫描（31/30/31 词，各断退出码 0）+ `coordinator` 定点断言（`--json` 判 `hits.length === 1`，**不断言退出码**）+ CJK 扫描 + 零依赖 | WP-6 |
| `test/fixtures/purity-check.mjs` | +`--files` 入参 | WP-6 |

**交付物之外但必须产出**（主控负责，不进 WP）：`docs/iterations/iteration-5/{report,acceptance-fixture,acceptance-product,decisions}.md`、`docs/iterations/iteration-5/evidence/**`、`probe/acc5-f-*.mjs`、`probe/acc5-cases/**`。

---

## 6. 依赖与并行策略

**DAG**

```
   WP-1（解析层 + 注释净化，无主责 AC）
     │  │
     │  └──────────────（§2.3 字段契约）──────────────► WP-3（16+10 资产）
     ▼                                                        │
   WP-2（注册表加载/校验/合并）                                │（验证：loadRegistry）
     │  │                                                     │
     │  ├───────────────────────────────┐                     │
     ▼                                  ▼                     │
   WP-5（角色实例 + 图声明）        （RoleInstanceView 契约）  │
     │                                  │                     │
     └──────────────┬───────────────────┴─────────────────────┘
                    ▼
              WP-4（CLI + 预检）◄── 需要真实资产（A-2 的 16 行）与 role-instances 的代码
                    │
                    ▼
              WP-6（纯净与回归守卫）
```

- 实线箭头 = **代码依赖**（必须等对方产出）；WP-1 → WP-3 的虚线只依赖 §2.3 的常量表，不依赖 WP-1 的 `.js` 文件。
- **第四批的 WP-4 有两条入边**：WP-3（真实 16 个角色，否则 A-2 的 16 行无从对上）与 WP-5（`--instance` 分支要真的调用 `buildRoleInstances`）。§2.6 的契约冻结只是让 WP-4 **能开始写渲染**，验收仍需两者落地。

- **第一批（1 个）**：WP-1
- **第二批（1 个）**：WP-2
- **第三批（2 个并行）**：WP-3 + WP-5（文件零交集；WP-5 的单测用内存合成角色，不等资产）
- **第四批（1 个）**：WP-4 —— 4 个源文件是本轮最大的包，且它的 AC 全部是命令面，必须拿真实资产与真实 `buildRoleInstances` 才能判绿，**单独一批、不与任何包并行**
- **第五批（1 个）**：WP-6

**契约先冻结点**（冻住后其余包才能并行，改一次要通知全部受影响包）

| # | 冻结对象 | 冻在哪 | 影响包 |
|---|---|---|---|
| F-1 | `parseYaml` / `parseSkillFile` / `checkRoleShape` / `checkSkillMeta` 的签名与返回形状（含 `detailKey` / `detailParams`）+ `loadRegistry` 的 `builtinRoot` 注入点 | §2.1 ~ §2.3、§2.5 | WP-2 |
| F-2 | 16 个角色 id / 10 个技能 id 的**集合**（需求 A-1 的 16 行表已逐字冻结，WP-3 照表落地、WP-4 按同表断言）+ `RoleDef` 的 **13 个键名**与 camelCase 拼写（`id`/`name`/`group`/`summary`/`artifactType`/`sideEffect`/`skills`/`tools`/`wakeAllow`/`dispatchable`/`maxConcurrentSessions`/`source`/`file`） | §2.5 | WP-3、WP-4、WP-5 |
| F-3 | `errors[]` 元素的 6 键 `code/file/scope/field/line/params` + `file` 的相对口径（`roles/x.yaml` / `assets/roles/x.yaml`，**不含 `.orch/` 前缀**——前缀由 CLI 按 `source` 补）+ **输出层投影**：A-7 的 6 键是 `code/file/scope/field/line/detail`，`params` 必须被换成 `detail`（**不是追加**，`{...err, detail}` 会变 7 键） | §2.5 + §2.9 + A-4 / A-7 | WP-4 |
| F-4 | `counts` 的 6 键（资产级，A-7）+ `listCounts()` 的 4 键（角色级，A-6）**是唯一来源，文本首行与 JSON 共用** | §2.5 / §2.9 + A-6 / A-7 | WP-4 |
| F-5 | `RoleInstanceView` 的 9 键 + `roleToSessions` 的"只写非空"+ 六态优先级（含 `unknown-role` 在 `inactive` 之前） | §2.6 + A-6 + D-5 | WP-4 |
| F-6 | `labels.js` 六张表的**导出名与占位符名**（不冻文案，文案以需求附录 A 为准） | §2.7 | WP-4 内部（render ↔ roles） |
| F-7 | 图 `roles` 字段的位置与三张图的取值（含 `code-loop` 的 `['developer','tester','coordinator']` 顺序） | §2.11 + M-1 | WP-4、WP-5 |

**整合检查点（5 个）**

| # | 时机 | 跑什么 | 预期 |
|---|---|---|---|
| IC-1 | 批 1 后 | `node --test "test/**/*.test.js"`；`purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | `fail 0`、`tests >= 418`；扫描 exit 0（这是 3 处注释改写的唯一验收点） |
| IC-2 | 批 2 后 | `node --test test/wp11/*.test.js`（此时 4 个文件：WP-1 的 3 个 + `registry.test.js`）；`node -e` 用 `builtinRoot` 指向**合成内置根**，打印 `counts` | 新增用例全绿；合成根下 `counts` 自洽（`assets = roles + skills + invalid`），**不期望 26**（真实资产在批 3 才落地） |
| IC-3 | 批 3 后 | `node --test test/wp11/*.test.js`（此时 6 个文件，含 `assets.test.js` 与 `role-instances.test.js`）；`node -e` 用真实 `assetsRoot()` 打印 `counts` | 全绿；真实根下 `counts` 为 `{assets:26,roles:16,skills:10,builtin:26,project:0,invalid:0}`、`groups` 为 5/3/3/3/2 |
| IC-4 | 批 4 后 | 手跑 `orch role list` / `role show developer` / `role validate`（`--format text` 与 `json` 各一次）；三条主链冒烟（`single` / `code-loop` / `task-loop`，`%TEMP%` 独立根 + mock）；`role show tester --instance` 手跑 | 输出与 A-2 / A-3 / A-4 / A-6 / A-7 逐字一致、退出码 0；三条主链 exit 0 且归一化后与 I1.3 基线 `diff` 为空；`--instance` 行形态与 A-3 一致 |
| IC-5 | 批 5 后 | 全量测试 + D-7 三条扫描（31/30/31 词）+ 零依赖 + CJK 扫描 + `coordinator` 定点断言（`--json`） | `418+` 全绿；三条扫描与 CJK 与零依赖全 exit 0；定点断言 `hits.length === 1`（**预期 exit 1**）；依赖数为 `0` |

> **IC-3 与 IC-4 的分工**（原稿把两者混在一起，导致检查点要跑还不存在的命令）：`orch role …` 三条命令是**批 4 的产物**，只能放在 IC-4；批 3 只能跑用例，不能跑命令。

---

## 7. 风险与降级

| # | 风险 | 影响 | 处置（点名文件/函数） |
|---|---|---|---|
| 1 | 新增角色 id `planner` 命中引擎 3 处注释，31 词扫描 FAIL | WP-2 之后每一包的门禁都红，误判为"新代码污染" | 放在 WP-1 里先改：`src/core/advance.js:65`、`src/core/orchestrator.js:1856`、`:2267` 三行注释改为 `dispatcher` / `scheduler` / `engine`；IC-1 用 31 词全表复跑确认 exit 0，`git diff` 复核只有注释行 |
| 2 | `parseArgs` 扩展打破既有 `deepEqual(flags)` 断言 | AC-42 红，且 D-8 授权清单为空、不许改断言 | `src/cli/main.js` 只在 `command === 'role'` 分支新增 `positional` 键；其余路径的返回对象**一字不增**；合并后 `node --test test/wp6/main.test.js` 单跑一次 |
| 3 | `USAGE_LINES` 迁移时丢字符或改动首行 | 三处断言同时挂：`test/wp9/cli-e2e.test.js:214`（`includes('用法：orch run')`）、`test/wp6/main.test.js:77`（`includes('orch run\|status\|cancel\|core')`）、AC-35 / AC-37（要看到 role 子行） | 迁移只搬数组、**一个字符都不改**；首行保持 `用法：orch run\|status\|cancel\|core`（A-5 v5 修正：把 `role` 放进首行会让 `wp6:77` 失效，而 D-8 授权清单为空）；`role` 只通过末尾 3 行体现，总行数仍是 8；迁移后 `node -e` 打印 `USAGE_LINES` 与原 5 行逐行比对 |
| 4 | `run` 加注册表预检把既有 `run` 用例拖慢或改变早退路径 | 418 条里带 `run` 的用例变慢/变红 | 预检放在 `client.connect` **之前**且只做一次 `loadRegistry`（26 个小文件）；`TEMPLATE_UNKNOWN` 判定前移后仍走 `render.renderError`，`test/wp6/main.test.js:247` 的 `deepEqual(lines, ['未知模板：code-lop'])` 与退出码 1 不变；NFR-03 用 `role validate` 单次耗时实测（三次取中位） |
| 5 | `role` 命令误启动核心（AC-38 红线） | 全新根下冒出 `.orch`，P0 | `src/cli/roles.js` 里 `createClient` 只在 `flags.instance` 存在时调用；单测 `cli-role.test.js` 注入一个"一被调用就抛"的 `createClient`，三条无 `--instance` 的路径必须不触发 |
| 6 | 角色实例被判成 `retired` 而不是 `inactive`（AC-20 的停点风险） | AC-20 / AC-21 判错 | `decideStatus` 的优先级在 `src/registry/role-instances.js` 里写成单链三元（D-5 原文顺序），并用 `role-instances.test.js` 覆盖"终态优先于 inactive"；验收停点按 §3.3 第 5 条（T-002 第 2 轮执行中，`state === 'running'`） |
| 7 | 活跃会话漏掉被隔离的会话（隔离路径把 `state` 置回 `idle`） | AC-26 的 `unavailable` 判成 `available` | `active = sess.filter(s => s.state !== 'idle' \|\| s.quarantined === true)`（C-06 原文）；用 `role-instances.test.js` 的 `state:'idle' + quarantined:true` 合成用例锁死 |
| 8 | 16 份 YAML 手写出错（缩进、取值、技能引用） | IC-2 / IC-3 红，且错误分散在 26 个文件里 | `assets.test.js` 一次全量校验并打印逐条 `code/file/detail`；WP-3 的门禁命令就是它（`node --test test/wp11/assets.test.js`）。**这里不要写跑 `orch role validate`**：该命令是 WP-4 批 4 的产物，批 3 时还不存在（IC-3 已注明），手工验证留给 IC-4 |
| 9 | 角色中文名与 `ROLE_LABEL` 不一致 | AC-18 红，且会是"改资产还是改 labels"的扯皮 | `assets.test.js` 直接 `import { ROLE_LABEL }` 逐字比对 6 个既有角色；不一致时**以资产为准**但资产必须抄 `ROLE_LABEL` 的现值（C-13：两边一致，`ROLE_LABEL` 不动） |
| 10 | `worker` 不在 `ROLE_LABEL` 里，渲染时查不到中文名 | `role list` 第 5 行打出 `undefined` | 角色中文名一律取 `RoleDef.name`（来自 YAML），渲染层**不查** `ROLE_LABEL`；`ROLE_LABEL` 只用于 I1.1~I1.3 的既有状态行 |
| 11 | 注册表实现里出现资产名（如按 id 写 `if (id === 'developer')`） | AC-40 第 2 条扫描 FAIL | `src/registry/**` 只按 `GROUPS` / `ARTIFACT_TYPES` / `SIDE_EFFECTS` 三个枚举判值，任何按 id 的分支都是缺陷；`purity.test.js` 每包门禁都跑 |
| 12 | 项目级资产目录与实例目录混用（`.orch/roles` vs `.orch/instances`） | 项目根被写坏，AC-38 红 | `src/registry/assets.js` 只拼路径、不 mkdir；`projectRolesDir` / `projectSkillsDir` 是**加载期**唯一拼 `.orch` 的地方，禁止在 `index.js` 里手写 `path.join(root,'.orch',...)`；展示期的 `.orch/` 前缀只在 `roles.js` 的投影函数里补（§2.9），两处不混用 |
| 13 | 全量测试偶发 1 条 `test/wp10/perf.test.js` 失败（负载下 417/418） | 误判为回归 | 先独占复跑；确认与该用例无关再归因（硬约束 §5-22：不许放宽预算、不许删用例） |
| 14 | 验收期 `core stop` 把中间态对账成 `interrupted` | AC-22 ~ AC-26 的中间态取不到 | 验收脚手架在断言时刻用 `state.live` 抢落盘（§3.3 第 5 条），且每个 AC 用独立 root |
| 15 | `GROUPS` 里的 `coordinator` 撞上 D-7 词表，`--dirs src/registry` 构造性 FAIL | AC-40 永远红，且要等到批 5 才炸 | 第 2 条扫描用 **30 词**（去掉 `coordinator`），另加定点断言"`coordinator` 在 `src/registry` 只有 1 行"（`purity.test.js`）；见需求 D-7 的 v5 修正 |
| 16 | `role list` 的 `counts` 误传 `registry.counts`（资产级 26） | AC-01 / AC-03 / AC-32 的数字全错，`--group` 时更错 | `src/cli/roles.js` 的 `listCounts()` 是**唯一来源**：`toListJson().counts`、`renderRoleList` 的**文本首行**、`groups[].count`（按过滤后的行重算）全都用它；`registry.counts` 只在 `role validate` 用。文本首行也要覆盖——A-2 的首行是逐字断言，只修 JSON 会漏（§2.9 / F-4） |
| 17 | 未注册角色被判成 `inactive`；排序时 `indexOf` 返回 `-1` 把它排到最前；排序第二分量写 `role.id` 直接 **TypeError** | AC-31 顺序错、`unknown-role` 观测不到、`role-instances.test.js` 的批 3 门禁必红 | `decideStatus` 加 `known` 并把 `unknown-role` 排在 `inactive` 之前；排序键 `(role ? GROUPS.indexOf(role.group) : GROUPS.length, role?.id ?? roleId)`（D-5 的 v5/v6 修正） |
| 18 | WP-2 交付时仓库根还没有 `assets/`，`loadRegistry` 对任何 root 只返回一条 `REGISTRY_ASSETS_MISSING` | WP-2 的 13 条主责 AC 与 IC-2 全部无法执行 | `loadRegistry` 加 `builtinRoot` 注入点（缺省 `assetsRoot()`），`registry.test.js` 指向 `os.tmpdir()` 下的合成内置根（§2.5 / F-1） |
| 19 | `YAML_PARSE_FAILED` 的明细在两处语言不一致（A-4 要中文、AC-43 要零 CJK） | 联调时互相甩锅，或被迫二选一破契约 | 解析器只返回 `detailKey` + `detailParams`，中文由 `labels.js` 的 `YAML_DETAIL` 组装（§2.1 / §2.7，D-3 的 v5 修正） |
| 20 | 把 `coordinator` 定点断言也写成"exit 0" | `purity-check.mjs` 有命中就 exit 1，这条断言按字面执行必红 | 用 `--json` 判 `hits.length === 1` + `hits[0].file`，**显式不断言退出码**（§2.12）；IC-5 已注明"预期 exit 1" |

---

## 8. 与需求的对齐声明 / 冲突清单

本文档**不新增需求条目**。所有逐字文案、状态名、错误码、AC 编号、JSON 键集合均以 `docs/iterations/iteration-5/requirement.md` **v6 定稿**为准；两者冲突时**以需求为准**，并在实现结论（`report.md` §5）中指出。裁决优先级沿用模板 §2.8：`AC 的 Then/And > 附录 A > 附录 D > M/C > 规划文档 > 代码现状`。

> 本版（拆分文档 v4）已把四轮独立评审的意见全部落地：**第 5 轮**（10 阻塞 + 15 非阻塞，其中 4 条属需求侧结构性缺陷——D-7 第 2 条词表、A-5 用法块首行、D-5 的 `unknown-role` 优先级与排序键、D-3 的 YAML 明细语言，已在**需求 v5** 修正并记入附录 C）、**第 6 轮复评**（4 阻塞 S1~S4 + 14 非阻塞）、**第 7 轮复评**（6 阻塞 B1~B6 + 14 非阻塞 + 6 条存疑，全部在本版落地，其中 B1 的 A-7 键投影与 B4 的 `listCounts()` 唯一来源属"实现期看不出、验收期兜不住"的隐性缺陷，已写进 §2.9 / F-3 / F-4）。

**需求与代码现状的冲突及裁决**

| # | 冲突 | 裁决 | 去向 |
|---|---|---|---|
| 1 | 代码现状：`labels.js` 的 `ROLE_LABEL` 只有 6 个角色；需求要 16 个角色有中文名 | 不扩 `ROLE_LABEL`（`test/wp2/labels.test.js:137` 逐字锁定）。16 个中文名一律来自 YAML 的 `name` 字段（C-13 / D-8） | 已定，无待裁决 |
| 2 | 代码现状：`USAGE_LINES` 在 `render.js`；需求 C-08 / C-13 要求中文唯一来源是 `labels.js` | 迁移到 `labels.js` 并从 `render.js` import；**首行不动**（`test/wp6/main.test.js:77` 逐字断言 `orch run\|status\|cancel\|core`），只在末尾追加 3 行 role 子行，总行数仍 8（A-5 的 v5 修正） | 已定（D-8 已登记为"非断言类改动"） |
| 3 | 代码现状：`src/core/advance.js:65`、`orchestrator.js:1856/2267` 的注释含 `planner`；D-7 要禁这个词 | 改注释（`dispatcher` / `scheduler` / `engine`），零行为变化 | 已定（M-8） |
| 4 | `docs/index.md` §3.3 的 `role_instance` 示例是 snake_case + `last_action_summary` 字符串；C-12 要 camelCase + `lastAction` 对象 | 按 C-12 实现（`roleId` / `activeSessions` / `servingNodes` / `hostIcons` / `maxConcurrentSessions` / `lastAction` 对象）；**不改** `docs/index.md` | 已定，写进 `decisions.md` 一行留痕 |
| 5 | A-5 的用法块把 `role validate` 写成 `[--format json]`；D-6 说 `--format` 三个子命令皆可（`text` \| `json`，缺省 `text`） | 用法块**逐字照 A-5**（只显示 json）；实现上 `validate --format text` 仍接受且等同缺省（A 只约束用法块文字，不约束可接受取值） | 已定，`decisions.md` 留痕 |
| 6 | 需求未写 `role validate <未知角色>` 的行为（A-5 只写了 `role show <未知角色>`） | 与 `role show` 同口径：`找不到角色：<id>` + `可用角色：执行 orch role list 查看`，退出码 1 | `decisions.md` 留痕 |
| 7 | 需求未写 `--group <非法值>` 的行为（A-5 只列了 `--format` 非法） | 判用法错误，退出码 2，原因取 `ROLE_CLI_TEXT.usageReason.badGroup` | `decisions.md` 留痕 |
| 8 | 需求未写 `role list --instance` 的**文本**追加行（A-6 只给了 JSON，且注明"文本追加行由单测覆盖"） | 行数 = 16 + N（N = 本实例的角色实例数）；16 行之后每角色追加一行，**复用 `ROLE_CLI_TEXT.instanceLine`**（与 A-3 的实例行同一模板、同一 `{last}` 口径，不新造文案键）（`  实例 INST-001：服务中 · 活跃会话 1/1 · 服务节点 T-002 · 宿主 dsh · 最近 T-002 · 轮次 1/2`）；由 `cli-role.test.js` 断言，不由 AC 判定 | `decisions.md` 留痕 |
| 9 | 需求未写 `schema` 值不等于 `role/v1` / `skill/v1` 时的原因码 | 复用 `ROLE_SCHEMA_MISSING` / `SKILL_SCHEMA_MISSING`，`field: 'schema'`（不新增第 15 个原因码，C-11 的 14 个是封闭集合） | `decisions.md` 留痕 |
| 10 | D-9 列了 8 个 `test/wp11/` 文件但未指定归属 | 归属见 §4：WP-1 三个、WP-2 一个（`registry`）、WP-3 一个（`assets`）、WP-4 一个（`cli-role`）、WP-5 一个（`role-instances`）、WP-6 一个（`purity`）= 8 | 本文档定，无冲突 |
| 11 | 需求 §3.3 第 4 条把 AC-10 归入"实例类 AC"，但 AC-10 的 Then 是"注册表不合法时发起前停住"，不需要宿主 | 按 AC 的 Given 原样搭环境（`NODE_ENV=test` + mock 宿主配置齐备），再按 Then 判定：预检在 `client.connect` 之前返回，因此**实际不会拉起宿主**，取证仍是"不建会话、不留半个实例、退出 3"。即 Given 照写、Then 照判，两者不冲突；分类差异只影响 `acceptance-fixture.md` 的归档位置（S3 按命令面归档，并在该文档注明 Given 已配齐但未被用到） | `decisions.md` 留痕 |
| 12 | 需求未写 `role validate` 是否受 `--group` / `--instance` 影响 | 两个标志都不适用于 `validate`（D-6 已定"`--group` 仅 list、`--instance` 仅 list/show"），越界即用法错误（A-5 的 `（--<key> 不适用于 role <sub>）`） | 已定（D-6 + A-5） |
| 13 | **模板 §1.4 规则 3** 要求"每个 WP 应对应一组可独立验证的 AC"，而 WP-1（解析层）没有主责 AC | 保留为**契约冻结包**，并按模板 §1.4 规则 3 的本意（每个 WP 都必须"可独立验证"）落实验证物：3 个纯函数用例（≥45 条）+ 31 词扫描 + `coordinator` 定点断言（批 1 用 `grep -c` 手工跑一次，长期守卫在批 5 移交给 `purity.test.js`，见风险 15 / 存疑项）。硬规则"每条 AC 至少一个主责 WP"仍满足（45 条无遗漏）。**不合并进 WP-2** 的理由：合并后单包会有 5 个源文件 + 4 个用例文件，且要把 WP-2~WP-6 全体重编号（§4/§5/§6/§7/§8 与映射表 45 行全动），churn 大而行为零收益；两个包本来就是串行（WP-2 依赖 WP-1），合并不换来任何并行度 | 本文档 §4 WP-1 + 本条登记 |
| 14 | **D-1 / D-4 的返回形状** 写作 `{ok, registry, errors, counts}` 且 D-4 的 `counts` 含 `total`；§2.5 实现为 `{ok, roles, roleMap, skills, skillMap, errors, counts, groups}`（无 `total`） | 按实现摊平：`registry` 容器没有额外价值，摊平后调用方少一层解包；`total` 属于 A-6 的**角色级**表（由 CLI 现算），不进 D-4 的**资产级** `counts`。属附录 D 与附录 A 的口径调和，未改任何语义 | `decisions.md` 留痕 |
| 15 | **D-1 给 `role-instances.js` 的允许依赖是"无"**，但六态排序需要 `GROUPS` | 允许它 import `src/registry/role-schema.js`（同层、零 CJK、无 IO）。"无依赖"的原意是"不碰 IO / 不碰 CLI"，不是"连常量都不能共享" | `decisions.md` 留痕 |
| 16 | **`dispatchable` 有两套口径**：D-3 缺省 `true`，而 `src/templates/index.js:44-51` 的 `coordinator.dispatchable = false` | 本轮 `dispatchable` 只做解析与透传（写进 `RoleDef`），**不参与派发判定**（派发仍由图的 `nodes` 决定）。I1.6 做"从内置派生角色"时再统一，这里不改任何既有行为 | 本条登记，留给 I1.6 |
| 17 | **C-10 的预检顺序**写"任务非空与模板存在 → 注册表合法 → 启动核心"，而 `--task` 的空白串校验今天由核心判（`TASK_EMPTY`） | 只前移"模板存在"与"注册表合法"两步；`--task` 只做 `parseArgs` 的存在性校验（与今天一致）。把空白串判定搬进 CLI 会改动既有错误码归属，超出本轮范围 | 本条登记，`decisions.md` 留痕 |
| 18 | 需求未写"未注册角色的并发上限展示"（A-6 的 9 键必须有 `maxConcurrentSessions`，但注册表里没有这个值） | 取 `null`（不编 1），文本该位置写占位符 `—`（`活跃会话 1/—`），行尾追加 `（注册表中不存在该角色）`。未知角色只能经 `role list --instance` 出现（`role show <未知角色>` 走"找不到角色"退出 1），所以不影响 A-3 的 6 行契约 | `decisions.md` 留痕 |
| 19 | 需求未写"角色命令的用法错误由谁判"（`parseArgs` 在 main.js、`roles.js` 也可能想判） | **只在一处判**：`parseArgs` 判子命令/位置参数/标志适用范围/`--format` 取值；`roles.js` 只判 `--group` 的取值（它手里有 `GROUPS`）。两处都判会让 AC-37 的三条原因出现两套文案 | `decisions.md` 留痕 |
| 20 | **A-7 的 `scope` 只有 `role` / `skill` 两个取值**，但 `REGISTRY_ASSETS_MISSING` 是"整个资产根缺失"，既没有所属文件也不属于任何一类 | `file` 取资产根下的裸目录名 `roles`、`scope` 取 `role`，`field`/`line` 为 `null`；该行**无 AC 观测**（环境级失败），不会让任何 AC 判定失据（§2.5） | `decisions.md` 留痕 |
| 21 | §3.2 / §3.3 只给了 AC-04~AC-09、AC-13、AC-14 的夹具全文；AC-03（项目 `researcher.yaml`）、AC-11（9 行 `broken.yaml`）、AC-15 / AC-16 只给了差异描述 | 这几条的 Given 已在需求里逐字写清，S3 按 Given 现场造夹具即可，不构成口径分歧；§3 的全文样例是为了锁住"围栏第一行即文件第 1 行"与行号，AC-03/11/15/16 不含行号判定，故不补全文 | `decisions.md` 留痕 |

**不新增的需求外行为**：本迭代不加任何写命令、不改 `state.json` 形状、不改 `events.jsonl` 形状、不新增 IPC 方法、不改 `docs/index.md`、不改任何既有测试断言（D-8 清单为空）。
