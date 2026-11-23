# A1 任务拆分与文件级契约（Agent CLI 发现与罗列）

> 需求依据：`docs/iterations/iteration-A1/requirement.md` **v2**（15 AC / 11 BR / 5 NF；附录 A-0~A-7、D-1~D-11）
> 上游实现：commit `a80af4f` —— `src/adapter/cli-discovery/`（known-agents / discover / probe / registry / index）、`src/cli/cli-discovery.js`、`src/cli/labels.js` 的 `CLI_DISCOVERY_TEXT`、`bin/orch.js` 的 `cli` 分流、`test/wp16/cli-discovery.test.js` / `cli-probe.test.js`（A1-01~A1-13）
> 理解纪要：`docs/iterations/iteration-A1/requirement-understanding.md`（S0 PASS 后产出）
> 适配裁决：`docs/iterations/A-phase-decisions.md` AD-01~AD-10（尤其 AD-05 现状参考、AD-06 门禁等效口径、AD-07 purity 口径、AD-08 真实面阻塞）
> 拆分口径：只写 `docs/iterations/iteration-A1.md`；不改需求 / 评审 / `src/**` / `test/**`；不提交 git。

## 0. 迭代定位、范围与退出标准

**一句话目标**：在 `orch cli` 可运行面上，让用户启动即能只读发现本机四类来源的 Agent CLI、罗列四项信息、按需探测五类能力并横向对比，且真实宿主面按 AD-08 如实判阻塞。

**In scope**（逐条对应需求 §1.3，7 项）：
- IN-1 四类来源自动发现（PATH / 应用目录 / 包管理器 / **用户配置**，对应 AC-01/03/04/05）——前三类和 PATH 去重已有实现，本迭代**补齐用户配置来源**。
- IN-2 清单罗列四项 + 来源 + 扫描时间（AC-01/02/15）——已有实现保留，补「来源概览」与不臆造占位。
- IN-3 能力探测与连接测试（AC-02/07/08）——已有实现保留，补能力字段落位与失败数据口径。
- IN-4 五类能力矩阵数据（AC-09）——**补齐**：单源投影，不引入第二份数据。
- IN-5 重新扫描与不可达诊断（AC-06/10）——**补齐**可读修复建议与用户配置合并不覆盖。
- IN-6 手动添加自定义 CLI（AC-13）——**补齐** `cli add` 命令与校验（D-1 差距②）。
- IN-7 真实宿主验收句与证据前提（AC-12 阻塞 / AC-14 mock 支撑）——**补齐**证据分级脚手架。

**Out of scope**（摘要，全表见需求 §1.3 L50–L61）：桌面壳与 CLI 发现页首屏视觉（C1）；基于 CLI 建角色 / Team / 工作流 / 调度（A2~A5）；多 CLI 混跑（D1~D3）；替用户安装软件 / 改用户 CLI 配置 / 写系统目录（永久）；网页版（永久）；`npx geiger-scan` 运行时硬依赖（永久）；真实宿主取证机器（主控 / 用户安排，未取证判阻塞）。

**退出标准**（逐条可判定）：
1. **AC 判定**：15 条 AC 中 14 条 mock 面（AC-01~AC-11、AC-13~AC-15）按各自 Given/夹具/机检可复现通过；**AC-12 判阻塞**并附「本机无目标 CLI」试过路径（PATH 实测无 codex/claude/gemini，仅 WorkBuddy.app）与取证前提；不得写「15/15 全通过」或「全量全绿」（NF-3 / AD-08）。
2. **全量门禁等效口径（AD-06）**：受影响面串行 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` + git worktree 基线树对照，新增红差集 **= 0**；报告如实标注实测基线 `# tests 1947 / # pass 1923 / # fail 21`、flaky 20→21、历史并发 EXIT 137，不放宽任何 AC 判据。
3. **回归红线**：附录 D-9「已核、明确不改的精确断言」4 处逐字不红（`test/wp2/labels.test.js:271` REASON_LABEL 49；`test/wp9/i19-labels.test.js:293` 与 `test/wp15/regression.test.js:156` USAGE_LINES 25；`test/wp14/labels-drill.test.js:303-312` DESKTOP_LABEL_KEYS 64+63；`test/wp13/checkpoint.test.js:105` checkpoint 全键）；A1-01~A1-13 既有断言与 `CLI_DISCOVERY_TEXT` 25 键取值逐字不变。若变红属越界，回退实现而非放宽断言。
4. **架构扫描**：purity `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` → exit 0（11 词并集，AD-07）；领域层 CJK 检测对 `discover.js` / `probe.js` / `registry.js` / `capability-matrix.js` 输出 OK；`node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"` → 0。
5. **能力矩阵硬判据（AC-09）**：矩阵恰好五类维度（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子），缺一判红；未探测项五维全显示「未探测」；与清单同源、无反向冲突。
6. **只读与写入唯一（AC-11）**：扫描前后被扫目录字节一致；唯一写入点 `.orch/cli-registry.json`；`grep -REn "writeFile|mkdir|appendFile" src/adapter/cli-discovery/discover.js` 零命中。
7. **拆分自身约束**：§4 AC→WP 映射 15/15；WP 负责文件两两无交集；D-1 五项差距全部落到 WP（见 §8）。

## 1. 技术选型（结论 + 被否决项）

### 1.1 发现识别表：本地移植 vs 运行时依赖 geiger
**结论**：沿用已移植的本地识别表 `src/adapter/cli-discovery/known-agents.js`（12 条 CLI 定义 + `CLI_STATUS` + `SCHEMA_VERSION`），S2 不新增运行时依赖、仅按 U-02 评审结论维护表项。
**理由**：NF-4 / §1.3 范围外明确「不把 `npx geiger-scan` 作为运行时硬依赖、本地零依赖」；桌面端不能假设用户有 Node/npx 或联网。识别表是配置项，发现器通用、清单随实际安装变化（BR-11）。
**被否决**：`npx geiger-scan` 作为运行时依赖 / 动态拉取识别表 —— 违反零依赖与只读纪律，且把能力探测外包出去（D-2）。

### 1.2 能力握手：NDJSON vs LSP
**结论**：沿用 `probeAcp` 的 ACP 方言 NDJSON（逐行 `JSON.parse`，只认 `id===1 && result` 的 `initialize` 响应），握手后立即结束，不发 `session/new` / `session/prompt`。
**理由**：D-3 / AC-07；握手只做 `initialize` 级能力声明读取，不创建真实任务会话；能力探测收敛在 adapter 层，不进核心（AC-07 架构检查 `grep -REn "if host ==|if\(host" src/core src/daemon` 零命中）。
**被否决**：LSP `Content-Length` 分帧握手 —— 协议不匹配 Maestro ACP 方言，且会引入非本迭代的会话语义；实测夹具 `mockAcpScript()` 说 NDJSON。

### 1.3 命令面：独立分流 vs 改 main.js parser
**结论**：沿用 `bin/orch.js` 对 `argv[0]==='cli'` 的独立分流（已实现，`bin/orch.js:24-28`），S2 只在 `src/cli/cli-discovery.js` 的 `SUBS` 追加 `add` 及分派 / flag 分支。
**理由**：I1.x `main()` parser 是冻结面；独立分流隔离命令解析与写入，满足回归红线（理解纪要 §7 第 3 条 / D-9 #1~#2）。
**被否决**：把 `cli` 子命令并入 `src/cli/main.js` 的既有 parser —— 触碰冻结面，精确断言回归风险不可控。

### 1.4 用户配置来源落点：注册表内独立段 vs 单独文件
**结论**：在 `.orch/cli-registry.json` 内以 `user_config` 独立段持久化（`schemaVersion` 保持 1、旧字段兼容），`discoverAgentClis({ userConfig })` 在扫描时合并为带 `evidence.type='user-config'` 的 finding；`saveCliRegistry` 落盘时按 evidence 拆分并保留该段。
**理由**：AC-11 要求唯一写入点是 `cli-registry.json`；D-5 / D-6 要求重扫合并不覆盖；单文件 + 既有原子写（临时文件 + rename）即可闭环，无需新写入点。
**被否决**：新建 `.orch/cli-user.json` 单独文件 —— 增加第二个写入点，破坏「唯一写入」口径，且两文件一致性无事务保障。

### 1.5 手动添加持久化：写 user_config 段 vs 直接写 clis
**结论**：`cli add` 只写 `user_config` 段（登记 `{name, executable, version_args}`，经存在性 + 可执行校验），条目在 `scan` 时由 WC-1 合并进 `clis`；重复的 `executable`（`path.resolve` 后比较）直接拒绝。
**理由**：直接写 `clis` 会在下一次自动扫描覆盖写时被抹掉（AC-05 / BR-08）；只登记「去哪里找」，不安装、不改该 CLI 配置（§2.7 边界）。
**被否决**：`add` 直接追加到 `clis` 并试图与自动发现去重 —— 与重扫覆盖写冲突，无法保证「重扫前后条目不变」。

### 1.6 能力矩阵：单源投影 vs 第二份数据
**结论**：新增纯函数 `buildMatrixData(clis)`（WP-3），直接从注册清单的 finding 字段投影五维，**不落盘、不缓存第二份数据**；`cli list` 追加独立渲染段（`renderMatrix`），不改既有清单表头顺序。
**理由**：D-4 明确「不得引入第二份能力数据」；矩阵视觉视图属 C1（OUT-1），A1 只保证数据可支撑横向对比 + 可复现判定（AC-09）；清单与矩阵同源才不会自相矛盾（BR-07）。
**被否决**：新建 `matrix.json` / 在 adapter 内缓存矩阵结果 —— 双源不一致风险，违反 D-4。

### 1.7 探测触发：显式 opt-in vs 启动后台自动
**结论**：`probe` 由用户显式调用；禁止 `autoProbe` / `setInterval` 在启动时后台握手。
**理由**：§2.4 / AC-12 架构检查要求 `grep -REn "autoProbe|setInterval" src/adapter/cli-discovery src/cli/cli-discovery.js` 零命中；一个卡死的 CLI 不能拖住应用（NF-1）。
**被否决**：首次启动即对所有 CLI 后台探测 —— 不可复现、拖慢首屏、且会把 mock 结果误当就绪证据。

### 1.8 失败语义：数据返回 vs 抛异常
**结论**：所有探测 / 缓存失败统一返回 `{ok:false, code, params}`（`CLI_PROBE_TIMEOUT` / `CLI_PROBE_INVALID` / `CLI_PROBE_SPAWN_FAILED` / `CLI_REGISTRY_INVALID`），`probe.js` 零 `throw`；超时 kill 子进程。
**理由**：AC-08 / BR-06；硬超时 version 5s / acp 10s；失败以可读结果呈现，不弹堆栈、不卡死。
**被否决**：抛异常由上层 catch —— 会破坏「探测从不抛异常给用户」的硬边界。

### 1.9 中文文案：labels 追加新键 vs 领域层内联
**结论**：新增文案（手动添加 / 矩阵 / 诊断修复建议）只追加到 `src/cli/labels.js` 的 `CLI_DISCOVERY_TEXT` 表末尾；现有 25 键取值**逐字不动**（含 `USAGE`）；领域层零 CJK。
**理由**：NF-4 / D-7 / A1-07；测试未对 `CLI_DISCOVERY_TEXT` 做键数断言（已核 test/ 零命中），追加安全；D-9 点名的 4 处其他表计数断言不触碰。
**被否决**：为让 `USAGE` 显示 `add` 而改既有键值 / 在 adapter 内联中文 —— 违反「逐字不变」与 CJK 检测。

### 1.10 证据分级：mock / 阻塞分离 vs 统一 PASS
**结论**：每份取证标注三态之一「mock 实测 / 待本机实测（需装有目标 CLI 的机器）/ 已实测（真实宿主面）」；AC-12 判阻塞并附试过路径，AC-14 标「mock 实测」且不得进入 AC-12 达标判据；收口仍阻塞按执行模板 §4.5 升级用户书面豁免。
**理由**：AD-08 / NF-3 / 附录 A-7；本机 PATH 无真实 codex/claude/gemini，造真实宿主现场不可行。
**被否决**：把 mock 结果写成「真实宿主达标」/ 因已有实现就跳过 S0→S4 —— 拿 mock 顶替真实证据，违反 AD-05/AD-08。

## 2. 模块划分与文件级接口契约

> 状态标记：**保留** = 已有实现且本迭代不改；**补齐** = 在已有实现上「只加不改」；**新增** = 本迭代新建。归属 WP 见 §4；每个文件只归一个 WP。

### 2.1 `src/adapter/cli-discovery/discover.js`（补齐，WP-1）
**导出**：`discoverAgentClis(options = {})` → `{ok:true, schemaVersion:1, scanned_at, sources, findings}`。
**入参新增**：`options.userConfig?: Array<{cli_id?, name, executable, version_args?, added_at?}>`；其余 `env/home/platform/pathEntries/appDirs/npmGlobalRoot/clock/fileSystem/known/pathApi` 不变。
**出参扩展**：每条 finding 在既有字段（`cli_id/name/executable/version/detected_at/capabilities/max_concurrent_sessions/connection_status/not_on_path/verified_at/evidence/version_args`）上新增矩阵字段并一律以 `null` 起步：`acp: boolean|null`、`transport: string|null`、`resume_dialect: string|null`、`evidence_hook: boolean|null`；`null` 语义 = 未探测（中文「未探测」由 labels 映射，文件内零 CJK）。
**约束**：`userConfig` 条目生成 `evidence:[{type:'user-config', value:executable}]`、`connection_status=idle`、`not_on_path=false`；既有 `if (evidence.length === 0) continue` 与 PATH/home/app/npm 发现纪律不动；发现阶段零 spawn、零写入（AC-11）。

### 2.2 `src/adapter/cli-discovery/registry.js`（补齐，WP-1）
**导出**：`loadCliRegistry(root)`、`saveCliRegistry(root, scanResult, options = {})`、`cliRegistryPath(root)`、`CLI_REGISTRY_FILE`（签名向后兼容）。
**入参新增**：`options.userConfig?: Array<user_config 条目>`；不传时从磁盘既有注册表读取 `user_config` 段。
**出参 / 落盘形状**：注册表顶层新增 `user_config: Array<{cli_id, name, executable, version_args, added_at}>`；`clis` 仍为全部 finding（自动 + 用户），`schemaVersion` 保持 1；`loadCliRegistry` 对旧文件缺 `user_config` 按 `[]` 兼容。
**约束**：`saveCliRegistry` 在写盘前按 evidence 是否含 `type='user-config'` 拆分并重算 `user_config` 段，保证探测回写（`probe` 分支）与重新扫描都不丢用户项；原子写与 `CLI_REGISTRY_INVALID` 校验不动（A1-08/A1-09）。

### 2.3 `src/adapter/cli-discovery/index.js`（补齐，WP-1）
**导出**：既有 6 组导出不动；仅追加 `export { buildMatrixData } from './capability-matrix.js'`（由 WP-1 在契约冻结时追加，WP-3 提供实现）。
**入参 / 出参**：无（纯 re-export）。
**约束**：只追加 export 行，不改既有导出顺序（D-9 #6）。

### 2.4 `src/adapter/cli-discovery/probe.js`（补齐，WP-2）
**导出**：`probeVersion(finding, options)`、`probeAcp(finding, options)`、`withProbeResults(finding, {version, acp})`（签名不变）。
**出参扩展**：`withProbeResults` 合并时额外写入 `acp: boolean|null`（取 `acp?.ok && acp.acp`）；`transport` / `resume_dialect` / `evidence_hook` **保持 null 不臆造**（D-4：证据钩子无实现支撑，按规划列示但不编造）；`capabilities` 去重合并、`max_concurrent_sessions`、`connection_status`、`verified_at` 行为不变（A1-12 逐字保留）。
**约束**：零 `throw`；超时 code 与 5s/10s 口径不变；NDJSON `initialize` 不发送 `session/new` / `session/prompt`（AC-07 架构检查仅注释命中允许）。

### 2.5 `src/adapter/cli-discovery/capability-matrix.js`（新增，WP-3）
**导出**：`MATRIX_DIMENSIONS`（冻结常量，顺序固定 `['acp','transport','resume_dialect','max_concurrent_sessions','evidence_hook']`）与 `buildMatrixData(clis) → {dimensions: string[], rows: Array<{cli_id, name, acp, transport, resume_dialect, max_concurrent_sessions, evidence_hook}>}`。
**入参**：`clis` = 注册清单 `clis` 数组（只读）。
**出参**：逐行取 finding 对应字段的原值（bool / string / number / null），不填中文、不填默认值、不落盘；`null` 原样透传给 CLI 层映射为「未探测」。
**约束**：零 CJK；维度数组恰好 5 项，删维 / 合并判红（BR-07 / AC-09）；不读取第二份数据源。

### 2.6 `src/cli/cli-discovery.js`（补齐，WP-4）
**导出**：`cliDiscoveryMain(argv) → Promise<number>`（签名不变）。
**入参 / 分派**：`SUBS` 追加 `add`；flag 解析追加 `--name` / `--path`（`--format` 解析与既有分支不动）；`add` 分支校验名称非空、路径非空、`fs.accessSync(X_OK)` 存在且可执行、`path.resolve` 后重复拒绝，成功写 `user_config` 段；`scan` 分支把 `loaded.registry.user_config` 作为 `options.userConfig` 传入 `discoverAgentClis`；`list` 分支在 `renderList` 之后追加 `renderMatrix(buildMatrixData(registry.clis))` 输出段。
**出参**：用户可见文案全部经 `T.*`；空态 `T.NONE` / `T.NONE_HINT`（:52-53）与 `NOT_ON_PATH` 诊断提示保留并补修复建议新键；退出码 0/1/2 语义不变。
**约束**：零 CJK；零 `install` / `chmod` / 自动探测；不改 `renderList` 既有表头顺序（D-4）。

### 2.7 `src/cli/labels.js`（补齐，WP-4）
**导出**：`CLI_DISCOVERY_TEXT` 末尾追加新键：`ADD_OK`、`ADD_EXISTS`、`ADD_FAIL_EMPTY_NAME`、`ADD_FAIL_EMPTY_PATH`、`ADD_FAIL_NOT_FOUND`、`ADD_FAIL_NOT_EXECUTABLE`、`MATRIX_TITLE`、`MATRIX_COL_*`（5 个）、`NOT_PROBED`、`HINT_ADD_PATH`、`EVIDENCE_LEVEL_*`（3 个），具体键名在 CP-1 冻结。
**入参 / 出参**：无（常量表）。
**约束**：现有 25 键取值逐字不变（含 `USAGE`）；不改 `REASON_LABEL` / `USAGE_LINES` / `DESKTOP_V2_LABEL` / checkpoint 表（D-7 / D-9）。

### 2.8 `src/adapter/cli-discovery/known-agents.js`（保留，不改）
**导出**：`KNOWN_AGENT_CLI`、`CLI_STATUS`、`SCHEMA_VERSION`。
**约束**：U-02「首版优先 CLI 清单」待评审，仅影响本表维护，不在 A1 改；A1-07 断言本表零 CJK、cli_id 唯一。

### 2.9 `bin/orch.js`（保留，不改）
**导出**：`isInternalChannel(args)`；`argv[0]==='cli'` 时转 `cliDiscoveryMain(argv.slice(1))`（:24-28）。
**约束**：`cli add` 经 `cliDiscoveryMain` 分流，无需改本文件；I1.x `main()` 面不动（§1.3）。

### 2.10 测试与证据文件（归属见 §4）
- `test/wp16/cli-discovery.test.js`（补齐，WP-1）：A1-01~A1-07 逐字不改，追加用户配置来源 / 重扫保留 / finding 矩阵字段 / 来源概览断言。
- `test/wp16/cli-probe.test.js`（补齐，WP-2）：A1-08~A1-13 逐字不改，追加 `acp` 字段落位与「不臆造」断言。
- `test/wp16/cli-matrix-data.test.js`（新增，WP-3）：`buildMatrixData` 五维 / 缺维判红 / `null` 透传。
- `test/wp16/cli-command.test.js`（新增，WP-4）：`cli add` 合法 / 重复 / 非法三类、`scan→list` 用户配置保留、矩阵渲染段、空态与诊断文案。
- `test/wp16/cli-acceptance.test.js`（新增，WP-5）：子进程级 AC-12/14/15 集成、证据三态标注、AC-12 阻塞记录与试过路径。

## 3. 数据模型

### 3.1 `.orch/cli-registry.json`（完整样例：含已探测、unreachable、用户配置三类共存）
唯一事实 = 本机扫描快照（非用户机器事实源）；`schemaVersion=1`；缓存损坏（`schemaVersion!==1` 或 `clis` 非数组）返回 `CLI_REGISTRY_INVALID`。
```json
{
  "schemaVersion": 1,
  "scanned_at": "2026-11-23T00:00:00.000Z",
  "sources": { "path_entries": 1, "home": "/tmp/maestro-a1-path.XYZ/home", "app_dirs": 2, "npm_global_root": null },
  "user_config": [
    { "cli_id": "mycli", "name": "MyCLI", "executable": "/tmp/maestro-a1-add.XYZ/mytool", "version_args": ["--version"], "added_at": "2026-11-23T00:05:00.000Z" }
  ],
  "clis": [
    {
      "cli_id": "codex", "name": "Codex CLI",
      "executable": "/tmp/maestro-a1-path.XYZ/bin/codex", "version": "codex 1.2.3",
      "detected_at": "2026-11-23T00:00:00.000Z",
      "capabilities": ["close", "list", "resume"],
      "acp": true, "transport": null, "resume_dialect": "resume",
      "max_concurrent_sessions": null, "evidence_hook": null,
      "connection_status": "connected", "not_on_path": false,
      "verified_at": "2026-11-23T00:02:00.000Z",
      "evidence": [{ "type": "path", "value": "/tmp/maestro-a1-path.XYZ/bin/codex", "note": "codex" }]
    },
    {
      "cli_id": "workbuddy", "name": "WorkBuddy",
      "executable": null, "version": null,
      "detected_at": "2026-11-23T00:00:00.000Z",
      "capabilities": [],
      "acp": null, "transport": null, "resume_dialect": null,
      "max_concurrent_sessions": null, "evidence_hook": null,
      "connection_status": "unreachable", "not_on_path": true, "verified_at": null,
      "evidence": [{ "type": "app", "value": "/tmp/maestro-a1-app.XYZ/apps/WorkBuddy.app" }]
    },
    {
      "cli_id": "mycli", "name": "MyCLI",
      "executable": "/tmp/maestro-a1-add.XYZ/mytool", "version": null,
      "detected_at": "2026-11-23T00:05:00.000Z",
      "capabilities": [],
      "acp": null, "transport": null, "resume_dialect": null,
      "max_concurrent_sessions": null, "evidence_hook": null,
      "connection_status": "idle", "not_on_path": false, "verified_at": null,
      "evidence": [{ "type": "user-config", "value": "/tmp/maestro-a1-add.XYZ/mytool" }]
    }
  ]
}
```
> 异常态要点：unreachable 项 `executable=null` / `not_on_path=true` / 矩阵五字段全 `null`（CLI 显示「未探测」+「已安装但不在 PATH」修复建议），但**保留在 clis 中**（BR-04）；用户配置项由 `user_config` 段重建，重扫前后 `cli_id` 与 `executable` 不变（AC-05）。

### 3.2 finding 形状（discoverAgentClis 出参节选）
```json
{ "ok": true, "schemaVersion": 1, "scanned_at": "2026-11-23T00:00:00.000Z",
  "sources": { "path_entries": 1, "home": "...", "app_dirs": 2, "npm_global_root": null },
  "findings": [{ "cli_id": "codex", "name": "Codex CLI", "executable": "/tmp/.../bin/codex",
    "version": null, "detected_at": "...", "capabilities": [],
    "acp": null, "transport": null, "resume_dialect": null,
    "max_concurrent_sessions": null, "evidence_hook": null,
    "connection_status": "idle", "not_on_path": false, "verified_at": null,
    "evidence": [{ "type": "path", "value": "/tmp/.../bin/codex", "note": "codex" }],
    "version_args": ["--version"] }] }
```
### 3.3 事件 / 产物样例
- `probeAcp` 成功：`{ok:true, acp:true, protocolVersion:1, capabilities:["session"], sessionCapabilities:["close","list","resume"], exitCode:0, connection_status:"connected"}`；失败：`{ok:false, code:"CLI_PROBE_TIMEOUT", params:{cause:"probe timed out", timeoutMs:10000}}`。
- `buildMatrixData` 行：`{cli_id:"codex", name:"Codex CLI", acp:true, transport:null, resume_dialect:"resume", max_concurrent_sessions:null, evidence_hook:null}` → CLI 映射为 `支持 | 未探测 | resume | 未探测 | 未探测`。
- `cli list` 文本产物：既有 6 列清单表头保持原序，其后追加「能力矩阵」段（5 列 + 来源概览）；空态仍为 `CLI_DISCOVERY_TEXT.NONE` / `NONE_HINT` 两行。
- 证据分级标注（附录 A-7）：`证据级别：mock 实测`（AC-01~11/13~15）；`证据级别：待本机实测（需装有目标 CLI 的机器）`（AC-12，判阻塞 + 附试过路径）。

## 4. 工作包拆分（WP-1 ~ WP-5，文件互不重叠）

### WP-1 发现层补齐：用户配置第四类来源 + finding 契约（依赖：无）
- **负责文件（4）**：`src/adapter/cli-discovery/discover.js`、`src/adapter/cli-discovery/registry.js`、`src/adapter/cli-discovery/index.js`、`test/wp16/cli-discovery.test.js`
- **依赖**：无
- **交付**：`discoverAgentClis(options.userConfig)` 合并逻辑；finding 五类矩阵字段（`acp/transport/resume_dialect/max_concurrent_sessions/evidence_hook`）以 `null` 起步；`user_config` 独立段与 `saveCliRegistry` 拆分保留；`index.js` 追加 `buildMatrixData` 导出；`test/wp16/cli-discovery.test.js` 追加用户配置 / 重扫保留 / 矩阵字段 / 来源概览断言。
- **验收口径**：AC-01 / AC-03 / AC-04 / AC-05 / AC-06（数据侧）/ AC-10 / AC-11 / AC-15（数据侧）；A1-01~A1-07 逐字不改；purity exit 0、CJK 检测 OK、`grep -n "saveCliRegistry"` 命中、`grep -REn "writeFile|mkdir|appendFile" ...discover.js` 零命中。
- **可否并行**：可（无依赖）；但需在 CP-1 前冻结 finding 字段与 `user_config` 形状供 WP-2/3/4 消费。

### WP-2 探测层补齐：能力字段落位 + 失败数据契约（依赖：WP-1）
- **负责文件（2）**：`src/adapter/cli-discovery/probe.js`、`test/wp16/cli-probe.test.js`
- **依赖**：WP-1（finding 字段契约）
- **交付**：`withProbeResults` 写入 `acp` 字段；`transport/resume_dialect/evidence_hook` 保持 `null`；A1-08~A1-13 逐字不改，追加 `acp` 落位与「不臆造」断言。
- **验收口径**：AC-02 / AC-07 / AC-08 / AC-14（探测侧）；`NODE_ENV=test node --test test/wp16/cli-probe.test.js` 全通过；`grep -nE 'throw new|throw ' ...probe.js` 零命中；`grep -nE 'ok: false|code:' ...probe.js` 命中；CJK 检测 OK。
- **可否并行**：可与 WP-3 并行（同依赖 WP-1，文件不重叠）。

### WP-3 能力矩阵数据：五维投影与单源契约（依赖：WP-1、WP-2）
- **负责文件（2）**：`src/adapter/cli-discovery/capability-matrix.js`、`test/wp16/cli-matrix-data.test.js`
- **依赖**：WP-1（finding 字段）、WP-2（字段落位）
- **交付**：`MATRIX_DIMENSIONS` 冻结常量（恰好 5 项）与 `buildMatrixData(clis)`；`test/wp16/cli-matrix-data.test.js` 断言五维齐全、缺维判红、`null` 原样透传、无第二数据源。
- **验收口径**：AC-09（数据侧）；五维集合与 `docs/index.md` §2.2:128 / §5:223 一致；领域层零 CJK；`capabilities` 仅作会话明细、不占维度。
- **可否并行**：可与 WP-2 并行（依赖相同、文件不重叠）；必须在 WP-4 之前完成以便冻结维度键名。

### WP-4 CLI 命令面与用户可见呈现（依赖：WP-1、WP-2、WP-3）
- **负责文件（4）**：`src/cli/cli-discovery.js`、`src/cli/labels.js`、`test/wp16/cli-command.test.js`、`test/wp16/cli-add.test.js`
- **依赖**：WP-1 + WP-2 + WP-3（消费 finding / 矩阵字段 / `buildMatrixData`）
- **交付**：`SUBS` 追加 `add`；`--name`/`--path` 解析与校验分支；`scan` 传 `userConfig`；`renderMatrix` 追加段；labels 末尾追加新键（25 键不动）；两个新增测试文件覆盖 add 合法/重复/非法、重扫保留、矩阵渲染、空态与诊断文案。
- **验收口径**：AC-05（命令侧）/ AC-06（可读诊断）/ AC-09（渲染侧）/ AC-10（命令侧）/ AC-12（命令面）/ AC-13 / AC-14（命令面）/ AC-15；`grep -nE "add|name|path" ...cli-discovery.js` 命中、`grep -REn "install|chmod" ...cli-discovery.js` 零命中、`grep -nE 'NONE|NONE_HINT'` 命中 :52-53；D-9 四处精确断言不红。
- **可否并行**：否（须在 WP-1/2/3 契约冻结后启动，否则联调互改接口）。

### WP-5 测试与证据脚手架、真实宿主阻塞与门禁（依赖：WP-1、WP-2、WP-3、WP-4）
- **负责文件（1）**：`test/wp16/cli-acceptance.test.js`
- **依赖**：WP-1 + WP-2 + WP-3 + WP-4（全链路就绪）
- **交付**：子进程级 `orch cli scan|list|probe|add` 集成用例；证据三态标注辅助函数；AC-12「本机无目标 CLI → 阻塞」记录 + 试过路径；AC-14 mock 面与 AC-12 真实面隔离断言；AD-06 等效门禁脚本封装与红差集对照。
- **验收口径**：AC-12 / AC-14 / AC-15（集成侧）/ NF-3 / NF-5；AC-12 必须显示阻塞且 mock 0 次冒充真实；串行门禁新增红差集 0、如实标注 1947/1923/21；`grep -REn "autoProbe|setInterval" src/adapter/cli-discovery src/cli/cli-discovery.js` 零命中。
- **可否并行**：否（整合批次，最后启动）。

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注（主责判定理由） |
|---|---|---|---|
| AC-01 | WP-1 | WP-5 | PATH 发现已有，保留 + 回归断言；集成取证 WP-5 |
| AC-02 | WP-2 | WP-4 | 版本探测 + `withProbeResults` 落位 |
| AC-03 | WP-1 | WP-5 | 应用目录发现已有，保留 + 回归 |
| AC-04 | WP-1 | — | npm 全局发现已有，默认 null 不臆造 |
| AC-05 | WP-1 | WP-4 | **D-1 差距①**：用户配置来源 + 重扫合并不覆盖（数据侧 WP-1，命令侧 WP-4） |
| AC-06 | WP-4 | WP-1、WP-5 | **D-1 差距④**：可读修复建议（WP-4），unreachable 数据纪律（WP-1） |
| AC-07 | WP-2 | WP-5 | ACP NDJSON 握手 + 会话能力 |
| AC-08 | WP-2 | — | 超时/失败以数据返回，零 throw |
| AC-09 | WP-3 | WP-1、WP-2、WP-4 | **D-1 差距③**：五维数据（WP-1/2/3），渲染与缺维判红（WP-4） |
| AC-10 | WP-1 | WP-4 | 重扫写 `scanned_at` + 用户项保留（WP-1），命令面（WP-4） |
| AC-11 | WP-1 | WP-5 | 只读纪律 + 唯一写入点 |
| AC-12 | WP-5 | WP-1、WP-2、WP-4 | **AD-08 阻塞**：mock/机检取证，真实面判阻塞；命令面 WP-4 |
| AC-13 | WP-4 | WP-1 | **D-1 差距②**：`cli add` 校验与持久化 |
| AC-14 | WP-5 | WP-1、WP-2、WP-4 | AC-12 的 mock 支撑面，证据级别「mock 实测」 |
| AC-15 | WP-4 | WP-1、WP-5 | 空态与来源概览文案（WP-4），来源数据（WP-1） |

## 5. 交付物清单

| 路径 | 内容 | WP |
|---|---|---|
| `src/adapter/cli-discovery/discover.js` | 补齐：`userConfig` 合并、finding 五字段 `null` 起步、来源概览 | WP-1 |
| `src/adapter/cli-discovery/registry.js` | 补齐：`user_config` 段持久化合并不覆盖、旧文件兼容 | WP-1 |
| `src/adapter/cli-discovery/index.js` | 补齐：追加 `buildMatrixData` 导出 | WP-1 |
| `test/wp16/cli-discovery.test.js` | 补齐：用户配置 / 重扫保留 / 矩阵字段 / 来源概览断言（A1-01~07 不改） | WP-1 |
| `src/adapter/cli-discovery/probe.js` | 补齐：`acp` 字段落位、不臆造字段、零 throw | WP-2 |
| `test/wp16/cli-probe.test.js` | 补齐：`acp` / 不臆造断言（A1-08~13 不改） | WP-2 |
| `src/adapter/cli-discovery/capability-matrix.js` | 新增：`MATRIX_DIMENSIONS` + `buildMatrixData` | WP-3 |
| `test/wp16/cli-matrix-data.test.js` | 新增：五维 / 缺维判红 / `null` 透传 | WP-3 |
| `src/cli/cli-discovery.js` | 补齐：`add` 分支、`--name/--path`、scan 传 `userConfig`、`renderMatrix` | WP-4 |
| `src/cli/labels.js` | 补齐：`CLI_DISCOVERY_TEXT` 末尾追加新键（25 键不动） | WP-4 |
| `test/wp16/cli-command.test.js` | 新增：重扫保留 / 矩阵渲染 / 空态 / 诊断文案 | WP-4 |
| `test/wp16/cli-add.test.js` | 新增：add 合法 / 重复 / 非法三类 | WP-4 |
| `test/wp16/cli-acceptance.test.js` | 新增：AC-12 阻塞 + AC-14 mock + 证据三态 + 门禁封装 | WP-5 |
| `docs/iterations/iteration-A1/evidence/`（产物目录，非源码） | 各 AC 取证记录、阻塞试过路径、红差集对照报告 | WP-5 |
| `src/adapter/cli-discovery/known-agents.js` | **保留不改**（U-02 待评审，仅维护识别表） | — |
| `bin/orch.js` | **保留不改**（`cli` 分流已就绪） | — |

## 6. 依赖与并行策略

**DAG 文本图**
```
WP-1 ──────────────┬──────────────→ WP-4 ──→ WP-5
  │                │                 ↑
  ├──→ WP-2 ──→ WP-3 ───────────────┤
  │                (五维键名)        │
  └────────────────(finding 契约)────┘
WP-5 ← WP-1 ∧ WP-2 ∧ WP-3 ∧ WP-4
```
即：WP-1 无依赖先行；WP-2 依赖 WP-1；WP-3 依赖 WP-1+WP-2；WP-4 依赖 WP-1+WP-2+WP-3；WP-5 依赖全部。

- **第一批**：WP-1（唯一入口，先落 finding 契约与 `user_config` 形状）。
- **第二批**：WP-2 ∥ WP-3（同依赖 WP-1，文件不重叠，可 2 Agent 并行，符合 AD-10 ≤2）。
- **第三批**：WP-4（命令面整合，消费前三批冻结的字段与键名）。
- **第四批**：WP-5（证据脚手架、AC-12 阻塞记录、门禁）。

**契约先冻结点（CP-Freeze，WP-1 落地后立刻冻结，其余包按此并行）**
1. finding 字段全集及 `null=未探测` 语义：`cli_id/name/executable/version/detected_at/capabilities/acp/transport/resume_dialect/max_concurrent_sessions/evidence_hook/connection_status/not_on_path/verified_at/evidence/version_args`。
2. 注册表形状：`schemaVersion=1`、`sources`、`user_config[]`（`{cli_id,name,executable,version_args,added_at}`）、`clis[]`；evidence 类型枚举 `path|home|app|npm-global|user-config`。
3. 函数签名：`discoverAgentClis({userConfig})`、`saveCliRegistry(root, scan, {userConfig})`、`withProbeResults(f, {version,acp})`、`buildMatrixData(clis)→{dimensions,rows}`。
4. 错误码：`CLI_PROBE_TIMEOUT` / `CLI_PROBE_INVALID` / `CLI_PROBE_SPAWN_FAILED` / `CLI_REGISTRY_INVALID`。
5. 五维键名与顺序：`acp / transport / resume_dialect / max_concurrent_sessions / evidence_hook`（WP-3 定，WP-4 渲染遍历同一数组）。
6. labels 新增键名清单（WP-4 在 CP-2 前定；25 旧键不动）。

**整合检查点（3 个）**
- **CP-1**（WP-1+WP-2 合入）：适配器层 A1-01~A1-13 全通过；`user_config` round-trip 保留；CJK 检测 OK；purity exit 0；确认契约冻结 1~4 项。
- **CP-2**（WP-3+WP-4 合入）：`cli scan→list→probe→add→scan` 端到端；五维矩阵输出恰好 5 列、未探测显示「未探测」；空态与诊断文案走 labels；D-9 四处精确断言不红；确认冻结 5~6 项。
- **CP-3**（WP-5 合入）：证据三态标注正确；AC-12 阻塞 + 试过路径齐全、mock 0 次冒充真实；AD-06 串行门禁 + worktree 基线对照新增红差集 0。

## 7. 风险与降级

| # | 风险 | 影响 | 处置（点名文件 / 函数） |
|---|---|---|---|
| R1 | 用户配置条目被重新扫描的自动发现覆盖抹掉 | AC-05 / BR-08 失败 | WP-1 `saveCliRegistry` 落盘前按 evidence `type='user-config'` 拆分重算 `user_config` 段；WP-4 `cliDiscoveryMain` 的 `scan` 分支把 `loaded.registry.user_config` 作为 `options.userConfig` 传 `discoverAgentClis` |
| R2 | `labels.js` 25 键或 D-9 四处精确计数断言变红 | NF-5 回归红线破 | WP-4 新键只追加到 `CLI_DISCOVERY_TEXT` 末尾、`USAGE` 不动；若 `test/wp2/labels.test.js:271` 等变红属越界，**回退 WP-4 的 labels 改动**而非放宽断言 |
| R3 | 能力矩阵被删成四类 / 第五类 stdio·transport 漏列 | AC-09 / BR-07 / U-03 失败 | WP-3 `MATRIX_DIMENSIONS` 冻结恰好 5 项，`buildMatrixData` 遍历该常量；WP-4 `renderMatrix` 不自定义维度；缺维判红 |
| R4 | 证据钩子等未实现能力被臆造为「支持」 | BR-05 / BR-07 失败 | WP-1 `discoverAgentClis` 五字段 `null` 起步；WP-2 `withProbeResults` 仅写 `acp`/`capabilities`/`max_concurrent_sessions`，`transport`/`resume_dialect`/`evidence_hook` 保持 `null`；WP-4 把 `null` 映射为 `T.NOT_PROBED` |
| R5 | 探测卡死拖住应用 / 抛堆栈 | AC-08 / NF-1 失败 | WP-2 `runCommand` 硬超时（version 5s / acp 10s）+ kill + `{ok:false,code,params}`；`probe.js` 零 `throw`；禁止 `autoProbe`/`setInterval` |
| R6 | AC-12 真实宿主面本机不可构造被误判通过 | AD-08 / NF-3 失败 | WP-5 `cli-acceptance.test.js` 标注「待本机实测（需装有目标 CLI 的机器）」并判阻塞、记录试过路径；AC-14 mock 结果隔离；收口仍阻塞按执行模板 §4.5 升级用户书面豁免 |
| R7 | 全量门禁 flaky（20→21）/ 并发 EXIT 137 被误报全绿 | NF-5 / AD-06 口径失败 | WP-5 采用受影响面串行 + git worktree 基线树对照、新增红差集 0；如实写 1947/1923/21 与 flaky 偏差，不写「全量全绿」 |
| R8 | 领域层 CJK 泄漏 / 运行时依赖混入 | NF-4 / A1-07 失败 | WP-1/2/3 新代码零 CJK（`discover.js`/`probe.js`/`registry.js`/`capability-matrix.js` 均过 `node -e` CJK 检测）；新文案只在 `labels.js`；`package.json.dependencies` 恒为 0 |
| R9 | 手动添加非法 / 重复输入产生重复项或误改用户机器 | AC-13 / BR-09 / BR-01 失败 | WP-4 `cliDiscoveryMain` 的 `add` 分支：`path.resolve` 后判重、`fs.accessSync(X_OK)` 校验、空值拒绝；零 `install`/`chmod`；失败走 `T.ADD_FAIL_*` 且不写盘 |
| R10 | 已有实现被误改（AD-05 现状参考当作需求来源） | 工作重复 / 回归 | 各 WP 按 §2「保留/补齐/新增」执行；A1-01~A1-13 与 25 键逐字不改；WP 负责文件零交集；不因代码已存在而跳过 D-1 五项差距的 WP 落位 |

## 8. 与需求的对齐声明 / 冲突清单

本文档**不新增需求条目**。所有 AC 编号（15）、BR 编号（11）、NF 编号（5）、状态词、错误码、用户可见文案与判定强度，均以 `docs/iterations/iteration-A1/requirement.md` **v2** 为准；两者冲突时**以需求为准**，并在实现结论中指出。

D-1 五项差距 → WP 落位核对（不因已有代码而漏排，也不重复造已有模块）：
- ① 用户配置第四类来源 + 重扫保留 → **WP-1**（discover + registry）+ WP-4（add/scan 命令面）。
- ② 手动添加命令与入口 → **WP-4**（SUBS add + 校验 + labels 新键）。
- ③ 能力矩阵数据呈现 → **WP-1**（finding 五字段）+ WP-2（落位）+ **WP-3**（单源投影）+ WP-4（渲染）。
- ④ 已安装但不在 PATH 修复建议 / 不可达诊断可读呈现 → WP-1（unreachable 数据纪律）+ **WP-4**（labels 新键 + 诊断渲染）。
- ⑤ 真实宿主取证 → **WP-5**（AC-12 阻塞 + 证据三态 + 门禁），按 AD-08 判阻塞。

已闭合裁决的承接：U-03（五维不删维）→ WP-3 常量冻结；U-04（A1 可运行面 = `orch cli`，桌面首屏属 C1）→ §0 In/Out 与 WP-4/WP-5 仅命令面；U-05（`cli add` 为实现建议字面、非规划原文）→ WP-4 命令字面只进机检/夹具，不改 BR-09/AC-13 用户判定。

需评审裁决 / 未决点（不阻塞本拆分，列出供主控）：
- **U-01（阻塞 AC-12，不阻塞其余 14 条）**：真实宿主取证机器由主控/用户安排；豁免前 AC-12 不判通过，mock 不顶替。
- **U-02（不阻塞）**：首版优先 CLI 清单待用户确认；仅影响 `known-agents.js` 表维护，发现器通用性不变、不放宽任何 AC。
- **文案键名细节**：§2.7 的 `CLI_DISCOVERY_TEXT` 新增键名在 CP-2 前由 WP-4 定稿；须保持 25 旧键逐字不变，中文不进领域层。
- **矩阵渲染触发方式**：本拆分取「`cli list` 追加独立矩阵段、不改既有表头顺序」（D-4 建议）；若评审要求独立子命令，仅改 WP-4 渲染入口与 labels 键名，不放宽 AC-09 五维判据。
