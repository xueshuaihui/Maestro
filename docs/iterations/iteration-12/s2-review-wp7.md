# I1.12 WP-7 S2 独立评审

> 评审角色：S2 实现独立评审工程师（只读；未参与实现；未采信任何自述结论）
> 评审对象：HEAD `fc384ef87109b10b6a0495e75dda835b8c3ab8e8`（`feat(I1.12): 批次2 WP-4/5/6 包生态可观测与性能基线（评审 PASS）`）之上的未提交工作区改动
> 判据：`requirement.md` v2.1（23 AC / A-0~A-7 / D-1~D-14）、`iteration-12.md` §2.7 / §4 WP-7 / §6 检查点 3 / §8、`decisions.md` 裁决 A/B/C、`execution-template.md` §0.4 / §2.2b / §2.5 / §3.4 / §7
> 唯一写入：本文件。未改 `src/**`、`test/**`、需求 / 拆分 / 裁决文档，未执行 `git add` / `commit`。

## 0. 总判

**FAIL**；**阻断 3**（P0×1、P1×2）／**建议 6**（P2×5、P3×1）。

- 工作区相对 HEAD 仅含 7 个 WP-7 授权文件：`src/cli/labels.js`、`src/cli/main.js`、`src/core/escalation.js`、`src/core/orchestrator.js`（M）与 `src/cli/verify.js`、`test/wp15/wiring.test.js`、`test/wp15/regression.test.js`（新增）。提交范围本身干净（`git status --short` 已核），但**文件内部改动越过 D-13 授权段**，且核心接线被实现为 advisory no-op。
- 阻断根因：`src/core/orchestrator.js` 的**四处门禁全部是 `void <decision>` + `catch {}` 吞错**，能力模块的判定结果不进入任何控制流；`wiring.test.js:328` 反而把 `void` 哨兵写成「必须存在」的期望值，使 22/22 全绿成为假绿。按现状合入将破坏 AC-03/04/07/08/11/12/23（详见 F-01/F-02/F-03）。
- 复核命令（全部实跑）：两契约测试 `22/22 pass`、`git diff --check exit 0`、purity 双目录 31 词均 `exit 0`、`transit(` 命中 6（与基线一致）、`orch --help` 仍 25 行且新命令不可见。命令与输出摘要见 §4。
- 例外说明：AC-06 的「拒绝交接 + 升级」经既有 `validateHandoff` 内建链**真实生效**（非 advisory），但该判定结构 `decision` 未被暴露给 I1.11，且新 reason 无事件生成，故 AC-06/23 仍判部分 FAIL。

## 1. 逐条判定表（A~G）

| 维度 | 判定 | 依据（文件:行号 / 命令输出） |
|---|---|---|
| **A 提交范围** | **PASS** | `git status --short` 仅 7 个 WP-7 文件（4 M + 3 ??），无其它 WP、无 `evidence/**` / `probe/**` / `test/templates/**` / 历史证据；`git diff --check` exit 0。注：文件内部越权段在 B 维判。 |
| **B D-13 与冻结基线** | **FAIL** | 挂载与分派大部分落地：`main.js:190-194` `FAMILY_MODULES` 逐字追加 verify/migrate/export 三条、既有 `skill`/`workflow` 不动；`main.js:207` `RUNTIME_COMMANDS` 追加三顶层命令；`main.js:221` 追加 `verify:['import','review']`；`verify.js:57-183` 四目标分派且真实调用 `audit-verify`/`pack`/`governance`。`USAGE_LINES`（`labels.js:183-208`）25 行逐字未改，新块 `USAGE_LINES_I112`（`labels.js:1009`）独立。但：`main.js:220` **改动了冻结的 `RUNTIME_SUBS.workflow`**（追加 `'export','import'`，D-13:704 明令既有 workflow 映射不动），且 workflow 走 `parseAssetArgs` 分流（`main.js:613,620-621,690`）该追加实际无效；`main.js:225` 与 `:230` 把 `package`/`yes` **同时**登记进 BOOLEAN 与 VALUE flags（`:495` boolean 优先，导致 `--package=<值>` 被拒）。`wake.rejected` 键值、`RUNTIME_SUBS.workflow` 以外既有映射、`test/templates/**`、三主链基线文件均未改。 |
| **C AC 判据强度** | **FAIL** | `orchestrator.js:1706 void parallelism`、`:3147 void freshness`、`:3160 void review`、`:3242 void budgetDecision`、`:4509 void wakeDecision`——四处门禁均为 advisory no-op，且外层 `catch {}` 吞错；`decideWake` 实参为 `sourceRole:null, roles:null`（`:4503-4507`），即便非 void 也无法正确判定。AC-03/04 越权不拦截、无目标会话阻断、无 reason 事件；AC-07/08 未裁决仍推进；AC-11/12 不限制派发、不挂起。AC-01/02/13~18 的命令载体则真实接上能力模块（PASS）。详见 §2。 |
| **D 中文唯一来源与文案** | **FAIL** | 新增中文全部在 `labels.js`（`I112_VOCAB` :902、`CHAIN_*` :930、A-3~A-7 :934-1000），`verify.js`/两测试经自动扫描零 CJK、零 `\u` 转义（PASS）；标签值与附录 A 逐字一致（`wiring.test.js:139-212` 从 `requirement.md` 运行时解析比对，全绿）。但 `labels.js:354` 将导出的冻结 `REASON_LABEL` 改为可变 `REASON_LABEL_BASE`，`:417-423` 用 `Object.defineProperty(..., { enumerable:false })` 追加 `wake.not-whitelisted`：属性可查找但**不可枚举**，不满足「追加键 + 既有枚举逐字不变」中「追加键」的可枚举语义——`Object.keys`/`{...REASON_LABEL}`/`JSON.stringify` 均看不到新键，`test/wp2/labels.test.js:269` 的 `length===48` 正是被其规避的软断言。详见 F-05。 |
| **E 测试真实性** | **FAIL** | `wiring.test.js:328-348` 测试名即 `advisory-only`，`:343` 断言 `void` 哨兵「must be non-blocking」——把与需求 Then 直接冲突的期望**硬编码为通过条件**，主动将越权/过期/高风险/预算门禁写软；`:89` 固化越界的 `RUNTIME_SUBS.workflow` 改动。命令表/门禁仅为静态 `includes`（`:81-100,328-348`），四门禁零行为断言；四 verify 目标仅用 `ctx.deps` stub（`:254-322`），按拆分工单允许但 Samuel 不覆盖真实能力包解析。`regression.test.js:59-73` 自定 `judgeRun` 语义、`:134-143` 仅静态检查 `test/wp14/regression-drill.test.js` 含基线字符串，**未实跑**全量与三主链。`transit(` 计数断言 `:165 ===6` 与实测一致（PASS）；`USAGE_LINES` 仅断言 length 与首尾行（`:146-148`，弱）。 |
| **F 门禁实跑** | **FAIL** | `NODE_ENV=test node --test ...` → 22/22 pass（但假绿，见 E）；`git diff --check` exit 0；purity 双目录 31 词 exit 0；`transit(`=6；`deps` 由 `regression.test.js` 实读 `{}`。但 `node bin/orch.js --help` 输出恰 25 行、**verify/migrate/export 三命令完全不可见**，`USAGE_LINES_I112` 无任何消费方（仅测试引用）——按裁决 A 第 2 条 + `iteration-12.md:54` 退出标准 5「三新增命令以独立用法块追加」判 FAIL。详见 F-06。 |
| **G 缺陷清单** | **9 条** | 见 §3。阻断 3、建议 6。 |

## 2. AC-01~AC-23 覆盖强度表

> 「WP-7 真实生效路径」指当前工作区是否存在由 WP-7 提供、能让 Then 在运行时成立的路径；能力包在 HEAD 中已存在且被真实调用者标注为「HEAD 既有」。

| AC | 需求 Then 摘要（行号） | WP-7 真实生效路径 | 判定 | 证据 |
|---|---|---|---|---|
| 01 篡改校验 | 原件通过、副本首处失配序号+非 0、原件哈希不变（262） | `verify.js:128-136` → `audit-verify.verifyChain({root,instanceId,fs})`，冻结签名、真实调用（裁决 C 第 1 条） | **PASS** | `verify.js:129-135`；链实现只读由 WP-1 负责 |
| 02 I1.9 衔接 | 旧行字节/序号不变、新行 N+1 接续、无第二起点（273） | 同 `verify <实例>` 载体；本 WP 不改链、不改 `event-bus.js` 写路径 | **PASS** | diff 无 `event-bus.js`；衔接逻辑在 HEAD 能力包 |
| 03 白名单内投递 | 交接投递、目标执行、拒绝事件 0（284） | `decideWake` 仅 `:4503` 被调用且 `void`，不产生任何新路径（既有行为不变但新判定不生效） | **FAIL** | `orchestrator.js:4503-4509`；`decideWake` 全仓调用点仅 `:4503` 与测试 |
| 04 越权拦截留痕 | 不投递、会话未创建、恰 1 条 `wake.not-whitelisted`、既有码不变（295-296） | `void wakeDecision`；`buildGovernanceRejection`（`escalation.js:366`）**无任何产品调用点**，永远不生成拒绝事件 | **FAIL** | `orchestrator.js:4509`；`grep buildGovernanceRejection` 仅定义与静态测试 |
| 05 指纹一致放行 | 一致照常投递、过期拒绝 0（306） | HEAD 既有 `validateHandoff`（`handoff-schema.js:448-456`）末尾 blocking freshness；`orchestrator.js:3114` 调用，一致时继续 | **PASS** | `handoff-schema.js:452-455`；`orchestrator.js:3123-3134` |
| 06 过期拒绝+升级 | 不一致/缺失均拒绝、升级各 1、判定含关联节点、零 UI（317-318） | 拒绝+升级经 `validateHandoff`→`escalateState(handoff_invalid)`（`:3126-3133`）真实生效；但 WP-7 的 `:3147 void freshness` 丢弃 `decision`，结构化判定未暴露给 I1.11，新 reason 无事件 | **FAIL（部分）** | `orchestrator.js:3123-3147`；`handoff-schema.js:383-446` |
| 07 缺终审挡下 | 校验不通过+节点定位、补后通过、启动被挡（328） | `verify.js:170-182` 调 `validateHighRiskReview`，缺终审返回非 0 + `HIGH_RISK_MISSING_REVIEW`（校验阶段 PASS）；但「尝试启动被挡」无运行时路径（`:3160 void review`） | **FAIL（部分）** | `verify.js:171-182`；`orchestrator.js:3151-3160` |
| 08 未裁决不推进 | 未裁决下游不执行、裁决被记录（339） | `void review`，未裁决仍按既有流程投递/推进 | **FAIL** | `orchestrator.js:3151-3160` |
| 09 主审计粒度 | node/handoff/health 进主审计（350） | `isPrimaryAuditEvent` 仅在 `governance.js` 导出，WP-7 未接线；无实跑证据 | **FAIL** | `iteration-12.md:205` 要求该门禁接线；diff 无对应调用 |
| 10 派生不单独审计 | 无 connection/role 独立审计、聚合可重算（361） | WP-7 协作列为「—」，本包无职责；基线文件未改、无新增独立审计类型 | **PASS（未改动）** | `iteration-12.md:391`；diff 未触碰审计写入点 |
| 11 并行上限排队 | 执行≤2、等待≥3、补位、无失败（372） | `void parallelism`，`queued` 不参与派发决策 | **FAIL** | `orchestrator.js:1695-1706` |
| 12 预算耗尽挂起 | suspended、无 failed、原轮次恢复（383） | `void budgetDecision`，`suspend`/`resumeRound` 不参与状态决策 | **FAIL** | `orchestrator.js:3232-3242` |
| 13 包导出闭包 | 闭包成员齐全、缺/环对照失败定位（394） | `verify import`/`migrate` 挂载真实接 HEAD `pack.js`；`roles.js`/`workflows.js` 在本 HEAD 已接（裁决 B） | **PASS** | `main.js:192-193`；`verify.js:153-168`；本次 diff 未改 `roles.js`/`workflows.js` |
| 14 有效签名导入 | 导入成功、确认含签名有效+版本兼容（405） | `verify <包>`→`pack.verifyPackage` 真实调用，成功输出 `PACK_IMPORT_OK`（A-6 逐字） | **PASS** | `verify.js:138-151`；`labels.js:934` |
| 15 坏包拒绝 | 签名无效/版本不兼容均拒、资产前后一致（416） | `verifyPackage` 失败码映射 `PACK_SIGNATURE_INVALID`/`PACK_VERSION_INCOMPATIBLE`，返回非 0 | **PASS** | `verify.js:101-105,149-150` |
| 16 migrate 升级 | 清单与改写一一对应、摘要条数=清单（427） | `migrate` 挂载 → HEAD `src/cli/migrate.js::migrateCommand`；flag `--yes`/`--backup` 已加 | **PASS（载体）** | `main.js:192`；行为由 WP-4 能力包负责 |
| 17 migrate 异常 | 最新无需迁移、坏引用保原、二次幂等（438） | 同上载体；未改能力包 | **PASS（载体）** | `main.js:192` |
| 18 OTel 导出 | 事件+跨度导出、前后哈希/状态/条数不变（449） | `export` 挂载 → HEAD `src/cli/otel.js::exportCommand`；flag `--out`/`--instance` 已加 | **PASS（载体）** | `main.js:193` |
| 19 反模式三类信号 | 三类命中带定位、数据不足不误报、只读（460） | 无 CLI 载体；拆分 §4 中 AC-19 协作 WP 为「—」，信号不可经 CLI 查看 | **阻塞** | `iteration-12.md:400`；`antipattern.js` 无命令挂载（观察项 F-08，主责 WP-5） |
| 20 mock 压测 | 20/50 handoff<2s、级别 `mock 实测`（471） | WP-7 未介入，未污染分级；证据分级由 HEAD `perf-baseline.js` 负责 | **PASS（不在范围）** | diff 无 perf 相关改动 |
| 21 真实宿主分级 | 未取证判阻塞、不得 mock 顶替（482-484） | WP-7 未介入；AC-21 真实面未取证属 U-01，非本包问题 | **PASS（不在范围）** | diff 无 perf 相关改动 |
| 22 回归红线 | 78 AC 只增不改、≥1425+差集 0、purity、USAGE 25、三主链、deps、transit（494） | purity/deps/transit/USAGE 实跑或实读 PASS；但全量与三主链未实跑（`regression.test.js` 仅静态断言），且 `RUNTIME_SUBS.workflow` 改动破坏「既有成员不动」 | **FAIL** | `main.js:220`；`regression.test.js:59-73,134-143` |
| 23 I1.11 边界 | 只产出判定结果、含原因+关联节点、零交集、可消费（505） | 文件零交集 PASS；但 wake/stale/review 判定全被 `void` 丢弃，I1.11 无可消费结构化结果 | **FAIL（部分）** | `orchestrator.js:3147,3160,4509`；`git status` 无 I1.11 文件 |

## 3. FAIL 清单

> 格式：偏差点 / 原文依据 / 最小修法 / 严重度 / 影响 AC。严重度 P0=合入即破坏核心验收，P1=门禁被架空，P2=口径/可消费性偏差，P3=代码卫生。

**F-01（P0）四处门禁为 `void <decision>` advisory no-op**
- 偏差点：`orchestrator.js:1706,3147,3160,3242,4509` 丢弃全部判定结果，外层 `catch {}` 吞错；`decideWake` 传 `sourceRole:null, roles:null`（`:4503-4507`）。
- 原文依据：`requirement.md:295-296`（AC-04「不投递、不创建或驱动目标会话…恰 1 条 reason 事件」）、`:317-318`（AC-06）、`:339-340`（AC-08）、`:372-373`（AC-11）、`:383-384`（AC-12）；`iteration-12.md:205`（「四处门禁调用，transit 唯一入口不变」）；任务书 C 项「若运行时只做 `void <decision>` 的 advisory hook，判 FAIL 并写明哪条 Then 被降级」。
- 最小修法：① gate1 传真实 `sourceRole`/`roles`，当 `decideWake().allowed===false` 时调用 `escalation.buildGovernanceRejection({reasonCode:'wake.not-whitelisted'})` 经既有 `commitEscalation` 落恰 1 条拒绝事件，`return {action:'stop'}`，不投递/不建会话；② gate2 删除冗余 void hook（既有的 `validateHandoff` 已 blocking），或显式处理 `freshness.ok===false`；③ gate3a/3b 依 `queued`/`suspend`+`resumeRound` 决定排队或 `suspended`，统一走 `transit()`；④ gate4 在 `review.blocked` 时停等人工裁决、不推进下游。禁止 `catch {}` 静默吞错（至少记诊断）。
- 影响 AC：03、04、07、08、11、12、23（七条 Then 降级为 advisory）。

**F-02（P1）测试把 `void` advisory 固化为通过条件，制造假绿**
- 偏差点：`wiring.test.js:328` 测试名 `advisory-only`；`:343` 断言 `void` 哨兵「must be non-blocking」；四门禁仅静态 `includes`，零行为断言，四 verify 目标仅 stub。
- 原文依据：`execution-template.md` §3.4 第 1/2 条「只认需求 Then/And，不许为绿放宽断言；代码行为与需求冲突判不通过」、§2.2b「不许采信自述、逐条 PASS/FAIL」；任务书 E 项「断言写软、硬编码与需求冲突的期望值、只测静态字符串」。
- 最小修法：删除 `:336-344` 的 `void` 哨兵断言，改为行为断言——注入 stub 使 `decideWake` 返回拒绝 / `decideBudget` 返回 `suspend` / `validateHighRiskReview` 返回 `blocked`，断言 orchestrator 不投递、生成恰 1 条拒绝事件、实例转 `suspended`、下游未执行。
- 影响 AC：03、04、07、08、11、12（门禁被测试反向锁定，22/22 假绿掩盖 F-01）。

**F-03（P1）拒绝构造与治理判定无消费出口**
- 偏差点：`escalation.js:366 buildGovernanceRejection` 全仓仅定义与静态测试引用，无产品调用；`validateEvidenceFreshness` 的 `decision`、`validateHighRiskReview` 的判定结构被 `void` 丢弃，I1.11 无可读取的结构化判定。
- 原文依据：`requirement.md:296`（拒绝事件含来源/目标/原因）、`:317`（「判定结果（是否过期、原因、关联节点），供 I1.11 消费」）、`:505`（「判定结果可被 I1.11 侧读取」）；`decisions.md:56`（裁决 C 第 3 条：缺键抛错、不回落硬编码）。
- 最小修法：把 `buildGovernanceRejection` 接入 F-01 的 gate1 拒绝路径；在新 reason 事件 `detail` 或 ctx 只读出口携带 `decision`/`reviewDecision` 结构（不含视图字段），供 I1.11 消费。
- 影响 AC：04（恰 1 条 reason 事件）、06（判定含关联节点）、23（可消费性）。

**F-04（P2）越界改动冻结的 `RUNTIME_SUBS.workflow` 且无效**
- 偏差点：`main.js:220` 将 `workflow: ['pause','resume','abort']` 改为含 `'export','import'`；`wiring.test.js:89` 固化该改动。workflow 走 `parseAssetArgs`（`main.js:613,620-621,690`），不经 `parseRuntimeArgs`，该追加实际不影响 workflow 命令解析；assetFamily 的 workflow 子命令表（`:99` 断言）仍未含 export/import。
- 原文依据：`requirement.md:704`（D-13「既有 `core/instance/escalate/handoff/workflow/trace` 映射不动」）；`iteration-12.md:201`（「RUNTIME_SUBS 追加 verify 两子命令，既有映射不动」）；`decisions.md:35-36`（裁决 B 仅授权 `workflows.js` 的 handler 子段，未授权 main.js 映射）。
- 最小修法：恢复 `main.js:220` 为 `workflow: ['pause','resume','abort']`，删除 `wiring.test.js:89`；若 workflow 包 export/import 确需 CLI 入口，改 assetFamily 的 workflow 子命令表并走主控书面扩 D-13，不得静默改冻结映射。
- 影响 AC：22（既有命令表成员逐字不变）、23（授权边界）。

**F-05（P2）`REASON_LABEL` 新键以 non-enumerable 追加，不满足「追加键」可枚举语义**
- 偏差点：`labels.js:354` 把导出冻结对象改为可变 `REASON_LABEL_BASE`，`:417-423` 用 `Object.defineProperty(..., { enumerable:false })` 加键，`:423` 再冻结。
- 原文依据：`requirement.md:641`（D-3「在 `REASON_LABEL` 同步加键，避免缺键输出原始英文 reason」）；`iteration-12.md:203`（「`REASON_LABEL` 追加 `wake.not-whitelisted`，既有键值逐字不动」）；`decisions.md:18`（裁决 A 第 4 条）。具体证据：`Object.keys(REASON_LABEL)` 与 `{...REASON_LABEL}` 不含新键；`test/wp2/labels.test.js:217,269` 的 `deepEqual` 与 `length===48` 正因其不可枚举而未变——即这是为让旧软断言维持「48」而选的技巧，任何按枚举渲染 reason 的消费方仍会漏键并输出原始英文 reason。
- 最小修法：主控裁决二选一——(a) 将新键作为普通可枚举属性加入，并授权同步把 `test/wp2/labels.test.js:269` 期望由 48 改 49（属扩 D-13 授权清单，非放宽功能断言）；(b) 书面确认所有消费方仅用 `REASON_LABEL[key]` 属性访问，记录 non-enumerable 为冻结兼容方案。当前「静默 non-enumerable」不满足「追加键」口径。
- 影响 AC：04（reason 可见性）、22（既有键断言与新增键口径）、23。

**F-06（P2）`USAGE_LINES_I112` 无消费方，`--help` 新命令不可见**
- 偏差点：`labels.js:1009 USAGE_LINES_I112` 仅在 `wiring.test.js:113-120` 被断言存在；`main.js` 的 usage/help 路径未引用它，`node bin/orch.js --help` 实测恰 25 行、无 verify/migrate/export。
- 原文依据：`decisions.md:16`（裁决 A 第 2 条「三个新命令以独立用法块追加，不改既有行」）；`iteration-12.md:54`（退出标准 5「`orch --help` 既有 25 行逐字不变；三新增命令以独立用法块追加」）；`requirement.md:702`（D-13「新增命令以独立用法块追加」）。
- 最小修法：让 `USAGE_LINES_I112` 在既有 25 行之后被 help 实际输出（保持前 25 行逐字），或由主控书面裁决确认 help 只显示 25 行且新块以其它可核对方式登记，否则「独立用法块追加」未落地。
- 影响 AC：22（USAGE 口径）、命令可发现性（AC-01/14/16/18 夹具依赖冻结命令名）。

**F-07（P2）回归测试用静态断言/自定函数代替实跑**
- 偏差点：`regression.test.js:59-73` `judgeRun` 自定语义且仅测该函数；`:134-143` 只静态检查 `test/wp14/regression-drill.test.js` 含 `CHAINS`/`baseline:` 字符串；未实跑全量 `>=1425 + 差集 0` 与三主链逐字比对；`:146-148` USAGE 仅验 length 与首尾。
- 原文依据：`requirement.md:494-497`（AC-22 机检含全量命令、purity、三主链逐字、`USAGE_LINES` 比对）；`iteration-12.md:483`（检查点 3「全量四步判定、23 条 AC 架构检查全表复核」）；`execution-template.md` §2.5「回归断言用下限，不写死条数」。
- 最小修法：`judgeRun` 改为消费真实 `summary.json`/`results.jsonl` 或实跑子进程结果；三主链用 `test/fixtures/<driver>.mjs` 实跑并与 `test/templates/**` 逐字比对；USAGE 断言 25 行全部逐字一致。
- 影响 AC：22（全量/三主链回归判据）。

**F-08（P2）AC-19 无 CLI 查看载体**
- 偏差点：拆分 §4 中 AC-19 协作 WP 为「—」，`src/cli` 无 antipattern 查看命令，`detectAntipatterns`（HEAD `antipattern.js`）无命令入口。
- 原文依据：`requirement.md:458-460`（AC-19「用户分别查看四个实例的反模式信号」）；`iteration-12.md:400`（AC-19 主责 WP-5、协作「—」）。
- 最小修法：主控裁决——为 antipattern 增加只读 CLI 查看入口，或书面确认 AC-19 在 S3 以模块直调取证、无需 CLI。此为观察项，主责 WP-5，不单独阻断 WP-7。
- 影响 AC：19（Then「可查看」）。

**F-09（P3）`package`/`yes` 同时登记为 boolean 与 value flag**
- 偏差点：`main.js:225` `RUNTIME_BOOLEAN_FLAGS` 含 `package`/`yes`，`:230` `RUNTIME_VALUE_FLAGS` 又含二者；`:495` boolean 分支优先 `continue`，使 VALUE 中的同名项成为死配置，`--package=<值>` 报「不接受取值」。
- 原文依据：`requirement.md:706`（D-13「只追加新命令所需 flag，既有 flag 集合不动」）。
- 最小修法：`package` 仅留 BOOLEAN（verify `<包>` 为位置参数，`--package` 作目标开关，密钥用 `--public-key`），`yes` 仅留 BOOLEAN；从 VALUE 表删除二者。
- 影响 AC：14/16/18（CLI 用例形态）、22（flag 白名单口径）。

## 4. 实跑命令与输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `git log -1 --format="%H %s"` / `git status --short` / `git diff --stat` | HEAD=`fc384ef…`；4 M + 3 ??（恰 7 个 WP-7 文件）；diff 285 insertions / 12 deletions |
| 2 | `git diff --check` | exit 0，无空白错误 |
| 3 | `NODE_ENV=test node --test test/wp15/wiring.test.js test/wp15/regression.test.js` | `tests 22 / pass 22 / fail 0 / skipped 0`，duration ~333ms（假绿，见 F-02） |
| 4 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | `OK: 扫描 38 个文件 … 零命中`，exit 0 |
| 5 | `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>` | `OK: 扫描 31 个文件 … 零命中`，exit 0 |
| 6 | `node bin/orch.js --help` | 恰 25 行（既有基线逐字），末行 `（未知命令：--help）`；`grep -E "verify\|migrate\|export"` 无命中 |
| 7 | `grep -REn "transit\(" src/core \| wc -l` | 6（与 `wiring.test.js:354`/`regression.test.js:165` 基线一致；`async function transit(` 唯一） |
| 8 | `grep -REn "buildGovernanceRejection" src test` | 仅 `escalation.js:366` 定义 + `wiring.test.js:364` 静态断言，无产品调用 |
| 9 | `grep -REn "decideWake\(|validateEvidenceFreshness\(|decideParallelism\(|decideBudget\(" src` | WP-7 调用点 `orchestrator.js:1700/3142/3237/4503` 均为 void；另 `handoff-schema.js:455` 为 blocking 内建链 |
| 10 | `sed -n '3100,3160p' src/core/orchestrator.js` | `validateHandoff` 失败 → `escalateState({reasonCode:'handoff_invalid', pendingHandoff})` → `return {action:'stop'}`；其后 gate2/gate4 为 void |

> 31 词 `--forbid` 原文取自 `requirement.md:495`（AC-22 机检），与 `D-12`/`requirement.md:697` 完全一致，顺序未改。
> 未跑全量测试，避免覆盖历史证据（按任务书 F 项要求）。
