# I1.12 批次 2（WP-4/5/6）实现评审 · review-batch2.md

> 评审角色：实现评审 Agent（批次 2，干净上下文，只读）；唯一可写文件 = 本文件。
> 仓库根 `D:/WWW/Maestro`，分支 `feat/i1.12-governance`，基线 HEAD `a0d1be4`。
> 评审对象：工作树中 WP-4/5/6 共 15 个文件（2 改 + 13 新）。判据来源：`requirement.md` v2.1、`iteration-12.md`、`decisions.md` 裁决 A/B/C、上游只读基线 `a0d1be4`。

---

## §0 总判

**总判：FAIL**。阻断 **1** 条（B2-01），建议 **6** 条（S1~S6）。

- 六维结论：A PASS / B PASS / C PASS / D PASS（AC-20/21 级别值写法另触发 B2-01）/ E PASS。
- 唯一阻断位于「中文唯一来源 `src/cli/labels.js`」铁律：WP-6 把三个用户可见证据级别值以 Unicode 码点硬编码进源码常量（详见 §5.1、§6 B2-01）。
- 除该阻断外，文件边界、授权段、只读性、签名、AC 判定强度、测试与门禁全部达标；AC-21 probe 真实面实跑合规。

**实跑命令清单**（完整输出摘要见 §7）：

1. `git status --short` / `git rev-parse HEAD` / `git branch --show-current`
2. `git diff --stat a0d1be4 -- src/cli/roles.js src/cli/workflows.js` + 两条完整 `git diff`
3. 4 组只读 grep（pack / otel-export / antipattern / perf-baseline / probe）
4. `grep -P "[\x{4e00}-\x{9fff}]"` 全部新源码 + `grep -E "\\u[0-9a-fA-F]{4}"` 隐藏转义
5. `NODE_ENV=test node --test` 6 个契约文件；上游 8 个只读基线文件
6. `node test/fixtures/purity-check.mjs` ×3 目录、`node -p deps`、`git diff --name-only` + I1.11 差集
7. 全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` + 15 条失败逐条差集比对
8. `node probe/acc12-perf.mjs --check`（解析 level/blocked/observed/triedPaths）
9. `git -c core.autocrlf=false checkout-index -f` 恢复被全量测试覆盖的历史证据（风险 10）

---

## §1 文件边界与授权段核查（维度 A）

**结论：PASS。**

### 1.1 文件集合（15/15 精确匹配）

`git status --short` + `git ls-files --others --exclude-standard` 得改动文件恰 15 个：

| WP | 声明文件数 | 实得文件 |
|---|---|---|
| WP-4 | 7 | `src/core/pack.js`(新)、`src/cli/roles.js`(改)、`src/cli/workflows.js`(改)、`src/cli/migrate.js`(新)、`test/wp15/{pack-closure,pack-sign,migrate}.test.js`(新) |
| WP-5 | 5 | `src/core/otel-export.js`(新)、`src/core/antipattern.js`(新)、`src/cli/otel.js`(新)、`test/wp15/{otel-export,antipattern}.test.js`(新) |
| WP-6 | 3 | `src/core/perf-baseline.js`(新)、`test/wp15/perf-mock.test.js`(新)、`probe/acc12-perf.mjs`(新) |

无越界文件、无 WP 间交叉文件。I1.11 差集 `grep -iE "i1[._-]11|notify|interven|evidence-view|canvas|tray"`（tracked + untracked）**零命中**（exit 1）。

### 1.2 roles.js / workflows.js 授权段（逐段 `git diff a0d1be4`）

两份文件均 **零删除行**：
- `src/cli/roles.js`：`80 insertions(+)`，`0 deletions`。
- `src/cli/workflows.js`：`83 insertions(+)`，`0 deletions`。

插入点逐一核对符号锚点（与裁决 B 第 1 条、D-13 授权补注一致）：

| 文件 | 插入位置 | 行号（hunk） | 是否授权段 | 判定 |
|---|---|---|---|---|
| roles.js | `exportRole` 函数体开头，`--package` 分支（32 行） | 851→853 后 | `exportRole`（裁决 B 明列） | PASS |
| roles.js | `importRole` 函数体开头，签名包门禁块（45 行） | 873→905 后 | `importRole`（裁决 B 明列） | PASS |
| roles.js | `roleCommand` 中 `sub === 'export'/'import'` 分发前注释（3 行） | 1161→1238 后 | `roleCommand` export/import 分发子段 | PASS |
| workflows.js | `workflowCommand` switch 中新增 `case 'export'/'case 'import'`（83 行） | 816→816 后，`default:` 之前 | `workflowCommand` export/import 子段 | PASS |

**既有逐字基线未动**：`ROLE_WRITE_TEXT` / `WORKFLOW_CLI_TEXT` 各键、既有失败码、`role export`/`role import` 的 YAML 路径、`workflowCommand` 的 `list/show/create/validate/diff/dry-run` 六个 case 全部保持原行；基线 `workflows.js` 的 switch 仅有上述六 case（无 export/import），新增 case 不存在重复标签。新增代码引用的 `atomicWrite`（roles.js:32 / workflows.js:36 基线已 import）、`writeFailure`、`readTextFile`、`notFound`、`fill`、退出码常量均为既有符号，无 ReferenceError。

**D-7 签名主体说明**：冻结的 `buildPackage({asset, registry, root})` 不含 privateKey，pack.js 只产 `manifest`/`files`、签名由调用方生成——与 §2.4 逐字冻结一致，非越界（详见 §5.2）。

---

## §2 只读与写路径核查（维度 B）

**结论：PASS。** 全部 grep 实跑：

| 检查 | 命令 | 结果 | 判定 |
|---|---|---|---|
| pack 写点 | `grep -nE "writeFile\|appendFile" src/core/pack.js` | 仅 4 处：`:400`（importPackage staged）、`:578`（applyMigrations restore）、`:590`（backup）、`:613`（staged） | PASS——`verifyPackage`/`listMigrations`/`buildPackage` 零写；`entryText`/`walkAssetFiles` 只读 |
| otel 写点 | `grep -nE "writeFile\|appendFile" src/core/otel-export.js` | 仅 1 处 `:189 io.writeFile(out, ...)` | PASS——`out` 为导出目标，非事件/追踪路径（详见 §5.3） |
| antipattern 只读 | `grep -REn "emit\(|transit\(|escalat" src/core/antipattern.js` | 零命中（exit 1） | PASS |
| perf 核心只读 | `grep -E "writeFile\|appendFile\|unlink\|\.dsh\|spawn\(\|exec\(" src/core/perf-baseline.js` | 零命中（exit 1） | PASS——纯函数，无宿主/产品状态写入 |
| probe 写点 | `grep -nE "writeFile\|appendFile\|unlink\|spawn\(\|exec\(" probe/acc12-perf.mjs` | 仅 1 处 `:248 fs.writeFileSync(opts.out, ...)` | PASS——仅 `--out`；`observeDsh`/`observeInstances` 全为 stat/readdir/readFile |
| 禁 bash 夹具 | `grep -n "bash" probe + 6 tests` | 仅注释与 test 禁用词表断言中 | PASS——无 bash 执行器 |

**spy 断言（AC-18 只读证据）**：`test/wp15/otel-export.test.js:136-141` 明确断言 `writeFile` 调用恰 1 次、`writes[0].target === out`、且从未写 `eventsFile`/`tracesFile`；配合 `:115-134` 的源文件 sha256 / state 深比较 / 事件条数不变断言，只读性可静态 + 动态双重证明。

---

## §3 导出签名与返回结构核查（维度 C）

**结论：PASS。** 逐导出与 §2.4/2.5/2.6 冻结签名比对：

| 模块 | 冻结签名 | 实现位置 | 返回结构 | 判定 |
|---|---|---|---|---|
| pack.js | `buildPackage({asset,registry,root})` | `pack.js:168` | `{ok,manifest,files}` / `{ok:false,code,detail}` | PASS |
| pack.js | `verifyPackage({pkg,publicKey,systemVersion})` | `pack.js:264` | `{ok,signatureValid,versionCompatible}` / `{ok:false,code:'SIGNATURE_INVALID'\|'VERSION_INCOMPATIBLE',detail}` | PASS |
| pack.js | `importPackage({pkg,publicKey,systemVersion,root,fs})` | `pack.js:343` | `{ok,installed}` / `{ok:false,code,detail}` | PASS |
| pack.js | `listMigrations({root,registry})` | `pack.js:496` | `{items:[{from,to,file,field}],total}` | PASS（额外 `name`/`targetExists` 为超集） |
| pack.js | `applyMigrations({root,plan,backupDir,fs})` | `pack.js:541` | `{ok,changed,summary}` / `{ok:false,code,detail}` | PASS |
| otel-export.js | `exportOtel({events,spans,instanceId,out,fs})` | `otel-export.js:168` | `{ok,count:{events,spans},out}` / `{ok:false,code,badLines}` | PASS |
| antipattern.js | `detectAntipatterns({graph,state,traces,events,config})` | `antipattern.js:293` | `{signals:[{type,instanceId,nodeId,detailKey}],insufficientData}` | PASS |
| otel.js | `exportCommand(parsed,ctx) → number` | `otel.js:66` | 退出码 | PASS |
| migrate.js | `migrateCommand(parsed,ctx) → number` | `migrate.js:55` | 退出码 | PASS |
| perf-baseline.js | `collectHandoffLatency({events,spans,round})` | `perf-baseline.js:169` | `{samples:[{instanceId,sessionId,handoffId,latencyMs}],stats:{median,p95,max}}` | PASS |
| perf-baseline.js | `buildPerfReport({samples,evidenceLevel,target})` | `perf-baseline.js:208` | `{ok,level,stats,bottleneck,blocked}` | PASS（字段名齐全；`level` 取值写法见 B2-01） |
| probe | `main(argv) → number` | `probe:185` | 退出码 + stdout JSON | PASS |

OTLP 映射字段（`trace_id`/`span_id`/`start_time`/`end_time`/`status`/`handoff_ids`、`instance_id`、`skipped.badLines`）见 `otel-export.js:120-154, 181-186`，与 §3.6 / D-9 一致；三类信号 `type` 与 `detailKey` 见 `antipattern.js:15-30`，与冻结点⑤一致。

---

## §4 AC 判定强度核查（维度 D）

**结论：PASS（AC-13~21 逐条）。** AC-20/21 的级别值字面写法问题归入 §5.1 / B2-01，不算 Then 被弱化。

| AC | 判定 | 行号证据 |
|---|---|---|
| **AC-13** 闭包齐全 / 循环拒绝 | PASS | `pack-closure.test.js:107-132`（角色闭包=技能+派生父、排除无关资产、快照只读）、`:134-146`（子工作流闭包）、`:148-159`（缺失依赖报 `DEPENDENCY_MISSING` + 名字）、`:161-174`（循环报 `DEPENDENCY_CYCLE` + chain 定位） |
| **AC-14** 有效签名 + 兼容版本导入成功 | PASS（文案键待 WP-7） | `pack-sign.test.js:96-116`（`verifyPackage` 三 true、导入 installed=2、labelKey）；确认中文由 `PACK_IMPORT_OK` 键经 labels 下发（见 S1） |
| **AC-15** 无效签名 / 不兼容版本拒绝、资产前后一致 | PASS | `pack-sign.test.js:118-134`（篡改签名→`SIGNATURE_INVALID` + 快照相等 + 无 stage）、`:136-152`（版本 4→`VERSION_INCOMPATIBLE` + 快照相等）、`:154-167`（先验签后验版本、改 manifest 失效）、`:169-195`（摘要不符 / 不覆盖已存在资产） |
| **AC-16** migrate 清单/改写一一对应、最新无需 | PASS | `migrate.test.js:77-93`（3 项 from→to 一一对应）、`:95-120`（apply 后逐项升级、备份哈希=原、正文未改）、`:171-183`（清单条数=摘要条数） |
| **AC-17** 坏引用保原、幂等 | PASS | `migrate.test.js:122-136`（二次 list=0、二次 apply 不改）、`:138-151`（最新 `migrateCommand` 零写）、`:153-169`（缺失目标→`MIGRATION_TARGET_MISSING` + 原字节不变、无备份残留） |
| **AC-18** 事件+跨度导出、前后哈希不变、不可读行跳过 | PASS | `otel-export.test.js:88-113`（OTLP 字段齐全）、`:115-142`（哈希/state/条数 + spy）、`:144-153`（无追踪零 span）、`:155-168`（坏行计数=4 不崩）、`:175-209`（三类型分派 / 未知类型零写） |
| **AC-19** 三类信号带定位、数据不足不误报 | PASS | `antipattern.test.js:77-108`（三类各命中一次含 instanceId/nodeId/detailKey）、`:110-121`（数据不足零信号）、`:123-158`（三类共存）、`:160-174`（输入不变 + 源码 grep 零命中 + 零 CJK） |
| **AC-20** mock 20/50/handoff<2s/级别 mock | PASS（级别写法见 B2-01） | `perf-mock.test.js:104-114`（夹具只读+tmpdir+NODE_ENV）、`:116-137`（20 实例/50 会话/P95<2s/逐档数据）、`:139-153`（`mock` 级别、ok=true、blocked=false）、`:172-202`（未达标三类瓶颈定位、不伪造） |
| **AC-21** 未取证 blocked:true、mock 不顶替 | PASS | `perf-mock.test.js:155-170`（三值不混、仅 pending 阻塞、未知值 fail-closed）；`probe --check` 实跑（§7.8）得 `level=待本机实测`、`blocked=true`、`ok=false`、`conclusion=BLOCKED_UNCOLLECTED`、9 会话/0 handoff、11 条 triedPaths、note 明示 mock 不顶替 |

**D-7 / D-8 / D-9 / D-10 / D-11 / D-13 落点**：分别见 `pack.js:264-424`（先验后写、Ed25519、临时目录原子导入）、`pack.js:496-642`（备份优先、改写引用、幂等）、`otel-export.js:181-192`、`antipattern.js:32-36`（阈值实现参数）、`perf-baseline.js:29-34, 138-162, 208-228`、授权段见 §1.2。

---

## §5 四重点独立核查

### 5.1 三值分级的中文写法 —— **判定：违反铁律（阻断 B2-01）**

**结论：FAIL。** 这三个值属「用户可见文案」，必须走 `labels.js` 键；WP-6 的实现不能接受为「报告内部枚举」。

证据链：

1. **判据明文列为 user-facing**：`requirement.md:535`（A-0）把 `mock 实测` / `已实测（真实宿主面）` / `待本机实测` 与 `签名有效`、`数据不足` 等并列写入「下列中文文案与层名为用户可见且新增，统一由 `src/cli/labels.js` 下发，不出现硬编码字面量」清单；`requirement.md:588`（A-7）要求性能行逐字呈现「证据级别 [mock 实测 | 已实测（真实宿主面） | 待本机实测]」；AC-20 Then（`requirement.md:471`）、AC-21 Then（`:482`）、`iteration-12.md:56`（退出标准 7）、D-11（`requirement.md:691`）均以三值作为对外证据级别。
2. **运行时确实呈现给用户**：`perf-baseline.js:16-20` 的 `PERF_LEVELS` 以 `\u5b9e\u6d4b` 等码点写死，`buildPerfReport` 把该值直接放进 `level`（`:213, 227`），`probe/acc12-perf.mjs:211, 219-245` 把 `level` 原样写入 stdout 报告 JSON——不是仅内部比较的隐藏枚举。
3. **源码注释自证**：`perf-baseline.js:12-14` 写「All user-facing Chinese lives behind the frozen PERF_LEVELS keys below (source stays ASCII; values are assembled from code points)」——自认是 user-facing，只是用码点规避 CJK 静态扫描（`perf-mock.test.js:241` 的零 CJK 断言正是被规避对象）。
4. **"码点转义≠非硬编码"**：`grep -P "[\x{4e00}-\x{9fff}]"` 零命中只说明文本不可读，不改变「中文逐字字面驻留源码、`labels.js` 非唯一来源」的事实。实跑 `node -e` 取出三值即 `mock 实测` / `已实测（真实宿主面）` / `待本机实测`（逐码点核对 U+5B9E U+6D4B 等）。
5. **违反条款**：BR-19（`requirement.md:248`）、NF-4（`:515`）、AC-22 Then（`:494`）、`iteration-12.md:53`（退出标准 4「新增中文只经 labels.js」）、D-12（`:698`）。`decisions.md` 裁决 C 第 3 条（`:56`）已确立既有范式：**能力包只产出文案键、WP-7 在 `labels.js` 加键、缺键抛错、不回落硬编码中文**；本包未循此范式。

**修法（本包不改 `labels.js` 的授权约束下，由 WP-6 改自己的文件）**：

- `perf-baseline.js:16-20`：把 `PERF_LEVELS` 改为 ASCII 机器键，例如 `{ mock:'PERF_LEVEL_MOCK', real:'PERF_LEVEL_REAL', pending:'PERF_LEVEL_PENDING' }`；源码（含 `\u` 转义）零中文。
- `perf-baseline.js:198-227`：`validLevel` / `blocked` / `level` 按机器键判定与返回，fail-closed 语义（未知值→pending→blocked）与「仅 pending 阻塞」不变；§2.6 冻结的"三值"语义由 WP-7 在 `labels.js` 的三键取值承载，A-7 行 588 的逐字呈现由 WP-7 接线层取 labels 后拼装。
- `probe/acc12-perf.mjs:211, 219-245`：随之上报机器键；报告 JSON 中若需中文呈现，须经 labels（或保持机器键由消费端映射），不得把中文写死。
- **移交 WP-7**：在 `labels.js` 加 `PERF_LEVEL_MOCK/REAL/PENDING` 三键，取值逐字为上述三中文，并加断言「三值逐字、不混用、缺键抛错」。
- 契约优先级说明：AC-22 Then 的「中文唯一来源」属 Then 级判据，高于 §2.6 示例中的取值字面；按机器键返回不属「签名不符」，与裁决 C 对 `CHAIN_*` 的处理同构。

### 5.2 WP-4 签名主体 —— **判定：可接受（记建议 S2/S3）**

- D-7（`requirement.md:662-667`）只要求「包内含 manifest 与签名块、非对称签名、公钥随包分发、先验签后校验版本、原子导入」，**未要求 `pack.js` 自己持有私钥签名**；§2.4 逐字冻结 `buildPackage({asset, registry, root}) → {ok, manifest, files}`，签名块由调用方/CLI 层追加是正确落点，不构成签名不符或 D-7 违背。
- AC-14「确认签名有效」仍可判定：`verifyPackage`（`pack.js:264-336`）验外部签名 + 兼容区间，`pack-sign.test.js:101-105, 126-131, 161-167` 实测有效/篡改/改 manifest 三态；机检锚点成立。
- **但发现接线缺口（建议，非阻断）**：`roles.js:875-877` 的 `--package` 导出 payload 仅 `{manifest, files, compat}`，**无 `signature` 字段**；而 `roles.js:911-914` 的导入门禁要求 `candidate.manifest && candidate.signature && candidate.compat` 三者齐全——导出→导入往返当前不通。`workflows.js` 同构（`:831-833` 导出、`:890-893` 导入门禁）。须由 WP-7 在 CLI 接线补签名步骤与密钥来源；pack.js 保持不签名（冻结签名不含 privateKey）。按阻断边界「契约提示/跨 WP 依赖/实现裁量点一律建议」，不记阻断。

### 5.3 otel-export.js 的 writeFile —— **判定：允许范围（PASS）**

- 唯一 `io.writeFile(out, ...)` 在 `otel-export.js:189`，`out` 由调用方传入（§2.5 明列 `out` 为导出目标），非 `events`/`spans` 源路径；模块头部 `:7-9` 与 D-9（`requirement.md:677-678`）均要求本地文件导出、只读源数据。
- 测试有明确 spy 断言：`otel-export.test.js:136-141` 断言 `writeFile` 恰 1 次、`target === out`、且从未写 `eventsFile`/`tracesFile`；`:115-134` 断言源/state 哈希与条数不变。
- 结论：符合「对事件/追踪路径零写」约束，不算只读性破坏。

### 5.4 AC-21 probe 真实面 —— **判定：符合裁决 A 第 3 条与 483/484 行契约（PASS）**

实跑 `node probe/acc12-perf.mjs --check`（完整输出见 §7.8）：

- **退出码 0**：阻塞出口按「阻塞不算失败」设计（`probe:16-17, 250`）。
- `level = "待本机实测"`、`blocked = true`、`ok = false`、`conclusion = "BLOCKED_UNCOLLECTED"`、`readOnly = true`。
- `observed`：本机 9 个 DSH 会话记录、`dshRecordsWithHandoff = 0`、`dshTimedHandoffs = 0`、`handoffSamples = 0`；未取证即阻塞，无伪造达标。
- `triedPaths` 11 条（含 `C:\Users\xuesh\.dsh\sessions` 及 9 个 `session.v4.jsonl.zstd`、仓库 `.orch/instances`），满足 483 行「附试过路径」。
- `note` 明示 "blocked, not failed. Mock data never substituted."；probe 不 import mock 夹具、不写死期望值、无 `--out` 外写操作。
- 与 `perf-mock.test.js:155-170` 的「三值不混、mock 永不产出 real level、未知值 fail-closed」共同满足裁决 A 第 3 条 / 484 行阻塞出口锚点。

---

## §6 修复清单

### B2-01【阻断】`src/core/perf-baseline.js:16-20` 三值中文以 `\u` 码点硬编码，违反「中文唯一来源 `labels.js`」铁律

- **位置**：`src/core/perf-baseline.js:16-20`（`PERF_LEVELS`），连带 `:198-227`（`validLevel`/`blocked`/`level`）、`probe/acc12-perf.mjs:211, 219-245`。
- **原文**：`mock: 'mock \u5b9e\u6d4b'`、`real: '\u5df2\u5b9e\u6d4b\uff08\u771f\u5b9e\u5bbf\u4e3b\u9762\uff09'`、`pending: '\u5f85\u672c\u673a\u5b9e\u6d4b'`。
- **违反条款**：A-0（`requirement.md:535`）、A-7（`:588`）、AC-20/21 Then（`:471, 482`）、BR-19（`:248`）、NF-4（`:515`）、AC-22 Then（`:494`）、`iteration-12.md:53`、D-12（`:698`）、裁决 C 第 3 条（`decisions.md:56`）。
- **建议修法**：见 §5.1——WP-6 把 `PERF_LEVELS` 改为 ASCII 机器键并同步 `buildPerfReport` / probe；labels 三键 + A-7 逐字呈现由 WP-7 补；不改 `labels.js` 的授权约束。
- **严重度**：**阻断**（中文硬编码违反铁律，属阻断判据边界明列项）。

### 建议清单（6 条，均非阻断）

| 编号 | 建议 | 依据 |
|---|---|---|
| **S1** | WP-7 在 `labels.js` 补本次新增文案键并替换 CLI 英文 fallback：`PACK_IMPORT_OK`（A-6「导入成功 [签名有效 · 版本兼容]」）、`MIGRATE_TEXT.*`、`OTEL_TEXT.*`/`EXPORT_TEXT.*`、`SIGNAL_*`、`PERF_LEVEL_*`。当前 `labels.js` 对这些键零命中（`grep` 实测），`migrate.js:24-35` / `otel.js:24-42` 始终走 ASCII fallback，A-6/A-7 逐字文案未落地；缺键按裁决 C 第 3 条抛错、不回落硬编码中文。 | AC-14/16/18/19 Then、A-6/A-7、裁决 C |
| **S2** | WP-7 接线补签名步骤：`role export --package` / `workflow export` 产出的包当前无 `signature` 字段，导入门禁要求三者齐全，往返不通；签名与密钥来源放 CLI 层，pack.js 保持不签名。另 `workflows.js:884` 输出裸 `checked.labelKey + count`（如 `PACK_IMPORT_OK 2`），应换 A-6 文案。 | §5.2、§2.4 冻结签名 |
| **S3** | WP-7 在 `main.js` 的 flags 白名单 / `RUNTIME_SUBS` / `FAMILY_MODULES` 追加本次新增参数与子命令：`--package`、`--version`、`--public-key`、`--out`、`--yes`、`--backup`、`workflow export/import`。当前包内测试直调模块全绿，但 CLI 解析层可能先拒绝，端到端未验证。 | D-13、裁决 A 第 1/2 条 |
| **S4** | `workflows.js:884-886` 的 export 成功行复用 `WORKFLOW_CLI_TEXT.created`（既有「已创建」语义）而非导出专用键，语义偏差；WP-7 接线时改用专用文案键或由 A-6 覆盖。 | 裁决 B「只加不改」精神下的新路径呈现 |
| **S5** | 全量回归会覆盖 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`（`iteration-12.md:500` 风险 10）。本轮实跑已按文档口径 `git -c core.autocrlf=false checkout-index -f` 恢复并核 diff 空；批次 3 应把历史证据目录设为只读或纳入回归守卫。 | 风险 10、本轮实跑 |
| **S6** | 产物骨架写「8 个测试文件」，但批次 2 实际只有 6 个契约文件（WP-4×3 / WP-5×2 / WP-6×1），42 测试全绿；「8」对应批次 1 的 WP-1/2/3 文件数，属模板口径差异，建议主控在批次 3 汇总时统一措辞。 | §4 文件归属、实跑 42/42 |

---

## §7 实跑命令与输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `git status --short` / `git rev-parse HEAD` / `git branch --show-current` | 15 文件（2 M + 13 ??）；HEAD `a0d1be4b9f808d11c3b171d039b6d1b5d9decfc1`；分支 `feat/i1.12-governance` |
| 2 | `git diff --stat a0d1be4 -- src/cli/roles.js src/cli/workflows.js` | roles `80 insertions(+)`、workflows `83 insertions(+)`，**均 0 deletions** |
| 3 | `git diff a0d1be4 -- roles.js workflows.js` | 插入点见 §1.2 表；既有键/码/行为零改 |
| 4 | pack/otel/antipattern/perf/probe 5 组 grep | 见 §2 表；antipattern 与 perf 核心禁词零命中 |
| 5 | `grep -P "[\x{4e00}-\x{9fff}]"` 新源码 | 零命中（CJK 静态门禁 PASS，但见 #6） |
| 6 | `grep -E "\\u[0-9a-fA-F]{4}"` 新源码 | `perf-baseline.js:17-19` 三处中文码点（B2-01 证据）；实跑解码为 `mock 实测` / `已实测（真实宿主面）` / `待本机实测` |
| 7 | `NODE_ENV=test node --test` 6 契约文件 | `# tests 42 / pass 42 / fail 0 / skipped 0 / todo 0` |
| 8 | `NODE_ENV=test node --test` 上游 8 只读基线文件 | `# tests 112 / pass 111 / fail 1`；唯一失败 `AC-27…401` 在 `baseline-failures-win32.txt:26` 登记项内 → 差集 0 |
| 9 | `purity-check.mjs --dirs src/core` / `src/daemon` / `desktop/ui,desktop/harness`（31 词） | 三目录均 `exit 0`（扫 27 / 11 / 31 文件，零命中） |
| 10 | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` | `0` |
| 11 | `{git diff --name-only a0d1be4; git ls-files --others --exclude-standard} \| grep -iE "i1[._-]11\|notify\|interven\|evidence-view\|canvas\|tray"` | 零命中（exit 1） |
| 12 | 全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` | `# tests 1631 / pass 1607 / fail 15 / skipped 9 / todo 0`；1631−1589(批次1 round2) = 42 = 新增契约数 |
| 13 | 15 条失败逐条差集比对 | 13 条落 `baseline-failures-win32.txt`（`--host-error`、`resolveEvidenceRef`、`可注入 fs`、`desktop port lsof`、`AC-27`、`newState`、`execution.summary`、`--fail-tool`、`--stop-after 3`、`grep -c session`、`三主链`、`S-07`、`promptFailures`）；2 条 flake 留帧 `iteration-10b/evidence/flake-frames/`（`HANDOFF_EVIDENCE_ESCAPE 符号链接绕过`、`AC-04 空态/2秒 timing`，与 `review-batch1.md:175` 一致）→ **差集 0** |
| 14 | `node probe/acc12-perf.mjs --check` | `exit 0`；`level=待本机实测`、`blocked=true`、`ok=false`、`conclusion=BLOCKED_UNCOLLECTED`、`dshSessionRecords=9`、`dshTimedHandoffs=0`、`triedPaths` 11 条、`note` 明示 mock 不顶替 |
| 15 | `git -c core.autocrlf=false checkout-index -f` 恢复 iteration-4 历史证据 | 恢复后 `git status --short` 回到初始 15 文件，`git diff --stat -- docs/iterations/iteration-4/evidence/` 空 |

> 说明：全量测试（#12）触发 `iteration-12.md:500` 风险 10——覆盖写历史证据；已按文档口径恢复，工作树除评审对象 15 文件外无改动。本文件（review-batch2.md）为本轮唯一新增的非评审对象文件。
