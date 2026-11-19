# I1.12 WP-7 S2 独立评审（第 2 轮）

> 评审角色：S2 实现独立评审工程师（第 2 轮；未参与实现；未读 `s2-fix-wp7.md`，未采信任何"已修复"字样）
> 评审对象：HEAD `fc384ef` 之上工作区的 WP-7 产物 7 个（`src/cli/main.js`、`src/cli/labels.js`、`src/cli/verify.js`、`src/core/orchestrator.js`、`src/core/escalation.js`、`test/wp15/wiring.test.js`、`test/wp15/regression.test.js`）＋主控裁决 D 授权同步的 `test/wp2/labels.test.js`
> 判据：`requirement.md` v2.1（AC-01~AC-23 / A-0~A-7 / D-1~D-14）、`iteration-12.md` §2.7 / §4 WP-7 / §6 检查点 3、`decisions.md` 裁决 D、`execution-template.md` §3.4 / §2.2b / §7
> 唯一写入：本文件。未改 `src/**`、`test/**`、需求 / 拆分 / 裁决文档；未执行 `git add` / `commit`。

## 0. 总判

**FAIL**；**阻断 1**（N-01，P2）／**建议 1**（N-02，P3）；**上轮 F 项闭合 9/9**（F-01~F-09 全部闭合，其中 F-08 按裁决 D-6 不修亦判闭合）。

- 上轮 3 个阻断（F-01 四门禁 void no-op、F-02 测试假绿、F-03 判定无消费出口）与 6 个建议已全部闭合：四门禁 verdict 进入真实控制流且按 D-1 只约束"显式配置"实例；`void` 哨兵及 advisory-only 测试已删除；拒绝构造与判定结构有真实消费出口；冻结映射与双登记已恢复；`--help` 实测 31 行（25+6）；`REASON_LABEL` 新键改为可枚举且 `labels.test.js` 只同步裁决 D 第 3 条两处。
- 全量重扫未发现新的越权 / 中文硬编码 / 断言放宽；`transit(`=6、`deps`=0、`git diff --check` exit 0、purity 双目录 31 词 exit 0，均与基线一致。
- 但全量重扫发现 1 个新的功能缺陷 **N-01（P2，阻断）**：`src/cli/verify.js:177` 的 `verify review <工作流>` 通过判定把 `needsHumanReview===true` 也当作"校验未通过"，而真实 `validateHighRiskReview` 对"已配人工终审路径"返回 `{ok:true, needsHumanReview:true, blocked:false}`（能力包 `governance.js:302`）。实跑证明补齐终审路径后 `verify review` 仍输出"校验未通过"、退出码 1，违反 AC-07 Then「补上 human 节点或升级路径后，校验通过」。该 CLI 载体是 D-13 冻结的 AC-07 校验面，属 WP-7 产物，故判 FAIL。
- 复核命令（全部实跑，摘要见 §5）：6 个测试文件 `82/82 pass`；`node bin/orch.js --help` 31 行（前 25 行逐字 + 6 行新块）；purity 双目录 31 词 exit 0；`deps`=0；`git diff --check` exit 0；`transit(`=6；`verify review` 真实模块抽查复现 N-01。未跑全量测试以免覆盖历史证据（按任务 C 项要求）。

## 1. 上轮 F-01~F-09 逐条复核表

| 编号 | 上轮问题 | 本轮三态 | 文件行号与实跑/实读证据 |
|---|---|---|---|
| F-01 | 四处门禁 `void <decision>` advisory no-op、`catch {}` 吞错 | **已闭合** | 四处 verdict 均进入控制流：`orchestrator.js:1885-1905`（并行度，verdict→`return{stop}`，无 failed 写）、`:3350-3372`（终审，verdict→`emit`+`reviewDecision`+`return{stop}`）、`:3452-3481`（预算，verdict→`buildGovernanceRejection`+`escalateState`，suspended）、`:4759-4806`（唤醒，传真实 `sourceRole/targetRole/roles`→verdict→拒绝事件+`escalateState`+`return{stop}`）。辅助 gate 函数 `:310/:332/:351/:367` 返回冻结 verdict 数据、不落盘。全仓 grep 无 `void (wakeDecision\|freshness\|parallelism\|budgetDecision\|review)`；`wiring.test.js:358` 反向断言该模式不存在。D-1 口径成立：`hasExplicitConcurrency`(`:559`)/`hasExplicitBudget`(`:567`)/`roles&&sourceRole&&targetRole`(`:4756`) 仅对显式配置 blocking，未配置实例放行（`:336/:355` 与 wiring.test.js:449/509 均断言 `explicit:false→verdict null`）。空 `catch`（`:1906/:3374/:3483/:4808`）仅兜底 capability 模块缺失，模块真实存在（`ls src/core/{governance,budget,escalation}.js` 均在）且 `loadCapability`(`:555`) 可导入，不吞判定；残留 fail-open 风险见 N-02。 |
| F-02 | 测试把 void advisory 固化为通过条件 | **已闭合** | `wiring.test.js:355` 测试名改为 "four gate decisions enter control flow; no advisory void sentinel remains"；`:358` 断言 void 正则为 false；`:389-427`（唤醒拒绝）、`:430-453`（预算挂起）、`:456-490`（终审 blocked/pending）、`:493-510`（并行排队）均为行为断言，注入 stub 校验 `verdict.blocked/reasonCode/resumeRound/queued/nodeIds` 及 `explicit:false` 放行。上轮 advisory-only 与 "must be non-blocking" 期望已删除。 |
| F-03 | 拒绝构造与治理判定无消费出口 | **已闭合** | `buildGovernanceRejection` 由唤醒路径 `orchestrator.js:4777` 与预算路径 `:3464` 真实调用（不再死代码；`escalation.js:357-396` 定义，`:387-388` 附 `governanceDecision`/`resumeRound`）。证据过期判定 `check.decision` 挂到 `handoff.freshnessDecision`(`:3324-3325`，D-2 不新增第二套 blocking，复用 `validateHandoff` 链末尾 `handoff-schema.js:455`）；终审判定 `reviewDecision` 挂到 `handoff.reviewDecision`(`:3362`)。判定结构含原因 + 关联节点，无 UI 字段。 |
| F-04 | 越界改动冻结 `RUNTIME_SUBS.workflow` | **已闭合** | `main.js:221` 恢复为 `workflow: ['pause','resume','abort']`；`wiring.test.js:98` 逐字断言。assetFamily 的 workflow 子命令表 `:110` 仍为冻结 `['list','show','create','validate','diff','dry-run']`，未被越界追加。 |
| F-05 | `REASON_LABEL` 新键 non-enumerable 规避旧断言 | **已闭合** | `labels.js:403-408` 新键 `'wake.not-whitelisted': '越权唤醒被拒绝'` 作为普通可枚举属性直接写入冻结对象，`Object.defineProperty` 技巧已移除；既有键（含 `wake.rejected`）逐字不动。`test/wp2/labels.test.js` diff 仅两处：`:250` 加枚举键、`:271` `48→49`——正是裁决 D 第 3 条授权范围。实跑 labels.test.js 全绿。 |
| F-06 | `USAGE_LINES_I112` 无消费方，`--help` 新命令不可见 | **已闭合** | `main.js:633-636` `isHelpRequest`，`:664-668` `out([...USAGE_LINES, ...USAGE_LINES_I112])`。实跑 `node bin/orch.js --help` 输出 31 行、exit 2，前 25 行与 `USAGE_LINES` 逐字一致、后 6 行为 verify/migrate/export 独立块；`wiring.test.js:134-147` 用 `deepEqual` 比对 25+6 行。`USAGE_LINES` 仍 `length===25`(labels.js / wiring:118 / regression:156)。 |
| F-07 | 回归测试用静态断言/自定函数代替实跑 | **已闭合（依裁决 D-5）** | 裁决 D 第 5 条明确 `regression.test.js` 保留为结构性门禁、`judgeRun` 为 S3 消费的下限与差集判定函数、不冒充全量实跑，且"不放宽 AC-22"；全量 ≥1425 + 差集 0 与三主链逐字比对由 S3 取证、S4 复核。`regression.test.js:1-21` 已显式声明该口径；`:118-132` purity 双目录与 `:134-138` deps 为子进程实跑。按 D-5 不把 S3 取证写成 WP-7 FAIL，本项闭合。 |
| F-08 | AC-19 无 CLI 查看载体 | **已闭合（按裁决 D-6，不修）** | 裁决 D 第 6 条：冻结命令名不扩张，AC-19 由 `detectAntipatterns` 只读模块直调取证（S3 用例），不新增 CLI 子命令，不构成 WP-7 阻塞项。`src/cli` 无 antipattern 查看命令的现状即符合裁决，故不修也算闭合；`iteration-12.md:400` 拆分中 AC-19 主责 WP-5、协作"—"一致。 |
| F-09 | `package`/`yes` 同时登记 boolean 与 value flag | **已闭合** | `main.js:224` `RUNTIME_BOOLEAN_FLAGS = new Set(['events','all','package','yes'])`；`:225-232` `RUNTIME_VALUE_FLAGS` 仅 `public-key/out/backup`（`package`/`yes`/`version` 已移除，`:227-230` 注释说明 boolean 优先导致死配置）。`wiring.test.js:99-100` 逐字断言 boolean 集合与 version 不在 VALUE 表。 |

## 2. 全量重扫表（六维）

| 维度 | 判定 | 证据 |
|---|---|---|
| ① 提交范围与授权 | **PASS** | `git status --short`：`4 M`（labels/main/escalation/orchestrator）＋`3 ??`（verify/regression/wiring）＝7 个 WP-7 产物；`M decisions.md` 为裁决 D 授权同步；`M test/wp2/labels.test.js` diff 仅 2 处精确断言同步（裁决 D 第 3 条授权）。无其它 WP、`evidence/**`/`probe/**`/`test/templates/**`、I1.11 文件或历史证据卷入。`git diff --check` exit 0。 |
| ② D-13 命令表/help/flags | **PASS** | `main.js:193-197` FAMILY_MODULES 逐字追加 verify/migrate/export 三条、skill/workflow 不动；`:207-211` RUNTIME_COMMANDS 追加三顶层命令；`:221` 追加 `verify:['import','review']`、workflow 恢复冻结值；`:224-232` flags 修正。USAGE_LINES 25 行逐字 + USAGE_LINES_I112 6 行独立块（`labels.js:1003-1010`）。`--help` 实跑 31 行。`verify.js:122-183` 四目标分派（chain/package/import/review）各调冻结签名能力模块；缺键抛错不回落中文（`:49-54 requireLabel`）。 |
| ③ AC Then 强度 / 四门禁 / 逐字基线 | **FAIL（仅 N-01）** | 四门禁真实生效、无 `void`（见 F-01）；`transit(`=6 且 `async function transit(` 唯一（`orchestrator.js:809`）；事件先落盘：`escalateState`(`:2176-2248`) 经 `commitEscalation`→`saveState`(`:877/:943`) 后 `emitMany`，异步 emit 用 `tracked()` 收集并在事务结束前 `await`（`:2194-2224`）。逐字基线：USAGE 25 行、`wake.rejected` 值、既有 REASON_LABEL 键、三主链登记（`regression.test.js:144-153`）均未变。**但** `verify.js:177` review 通过判定存在 N-01，破坏 AC-07「补齐后校验通过」CLI Then。 |
| ④ 中文唯一来源与 A-0~A-7 逐字 | **PASS** | 新增中文全部集中在 `labels.js`（`I112_VOCAB` `:892`、CHAIN/A-3~A-7 `:913-1010`）。`wiring.test.js:166-225` 从 `requirement.md` 运行时解析 A-0 的 24 词与 A-1~A-7 逐行 `deepEqual` 比对，实跑全绿；`:535-540` 与 regression:180-189 断言 `verify.js`/两测试零 CJK、零 `\u` 转义。`main.js` 中 `需要子命令` 为 HEAD 既有行（`git show fc384ef:main.js:509` 证实），非新增硬编码。purity desktop/ui,desktop/harness 31 词 exit 0。 |
| ⑤ 测试软断言/假绿 | **PASS（本轮无新增放宽）** | 上轮 advisory 假绿已清除（F-02）。四门禁改为行为断言；verify 四目标用冻结签名 stub 注入（拆分 §4 WP-7 允许只校接线形状）。`labels.test.js` 的两处改动是裁决 D 授权的精确同步（48→49、加键），非功能断言放宽；USAGE 断言未放宽（仍 25 行 + 逐行 deepEqual）。未发现新软断言。 |
| ⑥ purity 双目录/零依赖/diff-check | **PASS** | 31 词 `--forbid` 取自 `requirement.md:495` AC-22 原文；`purity-check.mjs --dirs src/core,src/daemon` 扫 38 文件 exit 0、`--dirs desktop/ui,desktop/harness` 扫 31 文件 exit 0；`node -p Object.keys(require('./package.json').dependencies\|\|{}).length` = 0；`git diff --check fc384ef` exit 0；`transit(`=6。 |

## 3. AC-01~AC-23 强度结论

> 沿用上轮 PASS 的 AC 不再展开：AC-01/02（链校验载体，冻结签名 `verifyChain({root,instanceId,fs})` 未变）、AC-05（既有 blocking `validateHandoff`）、AC-10（派生不单独审计，基线未改）、AC-13~18（包/migrate/OTel 载体挂载）、AC-20/21（性能，WP-6 不介入）、AC-22（回归红线，D-5 口径下结构性门禁）。以下仅列本轮变化与风险项。

| AC | 本轮强度变化 | 结论 |
|---|---|---|
| AC-03/04 | 唤醒门禁由 void 改为真实 verdict→拒绝事件（`wake.not-whitelisted`）+ `escalateState`，传真实 source/target/roles；`checkWakeGate` 既有 `wake.rejected` 分支逐字不动（`:4735-4737`）。未配置角色的既有实例放行（D-1）。 | 由 FAIL → PASS（Then 在显式配置场景真实生效） |
| AC-06 | D-2 口径：`check.decision`（含指纹不一致/缺失原因与关联节点）挂 `handoff.freshnessDecision` 供 I1.11 消费；复用既有 blocking 链，不新增第二套调用（`wiring.test.js:368` 断言 `validateEvidenceFreshness(` 计数为 0）。 | 由 FAIL(部分) → PASS |
| AC-07 | 运行时 reviewGate 已真实 blocked/停等（`:3350-3372`），缺终审被挡路径闭合。**但 CLI 载体 `verify review` 的"补齐后校验通过"路径被 N-01 破坏**（`verify.js:177`）。机检 Then「补齐后校验通过」在 WP-7 载体上不成立。 | **FAIL（N-01）** |
| AC-08 | reviewGate 对 `needsHumanReview && !hasHumanRuling` 返回 `HIGH_RISK_REVIEW_PENDING` verdict 并停等、记 `reviewDecision`（`:405-416`、`:3362`）；`hasHumanRuling` 检测既有 escalation/approval 裁决（`:574-584`），不新增实例状态。 | 由 FAIL → PASS |
| AC-09 | `classifyGovernanceEvent`(`:425-430`) 调 `governance.isPrimaryAuditEvent` 给治理事件打 `primaryAudit` 标记，在终审拒绝(`:3363`)与唤醒拒绝(`:4797`)落盘；主审计写入点未改。 | 由 FAIL → PASS（接线落地） |
| AC-11 | 并行度门禁 verdict→`return{stop}`、节点保持 ready/queued、无 failed 写（`:1885-1905`）；仅 `hasExplicitConcurrency` 实例生效（D-1）。 | 由 FAIL → PASS |
| AC-12 | 预算门禁 verdict→`buildGovernanceRejection(reasonCode,resumeRound)`+`escalateState`→suspended、无 failed（`:3452-3481`）；仅 `hasExplicitBudget` 实例生效。 | 由 FAIL → PASS |
| AC-23 | 判定结构含原因 + 关联节点、无 UI 字段；改动文件与 I1.11 零交集；`check.decision`/`reviewDecision`/`governanceDecision` 均提供只读消费出口。 | 由 FAIL(部分) → PASS |

## 4. 新发现问题清单

**N-01（P2，阻断）`verify review <工作流>` 把"已配终审路径"误判为"缺终审校验未通过"**
- 偏差点：`src/cli/verify.js:177` 通过条件为 `result?.ok === true && result?.blocked !== true && result?.needsHumanReview !== true`。真实 `governance.validateHighRiskReview` 对"高风险节点下游已有人工节点/升级路径"返回 `{ok:true, needsHumanReview:true, blocked:false, reason:null}`（`governance.js:302`），此时 `needsHumanReview!==true` 为假 → 落入 `:181` 输出 `HIGH_RISK_MISSING_REVIEW`（"校验未通过 / 下游缺少人工终审"）并返回退出码 1。
- 原文依据：`requirement.md:328` AC-07 Then「补上 human 节点或升级路径后，校验通过、可正常启动」；`:329` 机检「补齐后校验通过」；`:330` 夹具「分别校验」；D-13:704 / `iteration-12.md:204` 冻结 `verify review <工作流> → validateHighRiskReview`（WP-7 载体）。
- 实跑证据（真实模块注入，非 stub）：
  - 已配终审路径 `{nodes:[{id:T-004,highRisk:true},{id:T-005,type:human}],edges:[T-004→T-005]}`：能力包返回 `{"ok":true,"needsHumanReview":true,"blocked":false,...}` → `verifyCommand` 退出码 **1**，输出 `"工作流 [名称] 校验未通过 [高风险节点 [节点] 下游缺少人工终审]"`（应为退出码 0 + `校验通过`）。
  - 缺终审路径 `T-004→T-006(type:task)`：返回 `{ok:false,blocked:true}` → 退出码 1（正确）。
- 覆盖缺口：`wiring.test.js:336-349` 仅测 `blocked:true` 的缺终审 stub，`verify review` 的"补齐后通过"路径无任何断言（`:475` 的 `needsHumanReview:true/blocked:false` 只用于 reviewGate 行为测试，未覆盖 verify.js 载体）。
- 影响 AC：AC-07（补齐后校验通过的 CLI Then）、连带 AC-08 校验面口径。
- 最小修法：`verify.js:177` 通过条件去掉 `&& result?.needsHumanReview !== true`，改为 `result?.ok === true && result?.blocked !== true`（needsHumanReview 只是"存在高风险节点需人工把关"的正常标记，非校验失败）；并在 `wiring.test.js` 补一条"已配终审 stub → 退出码 0 + `VERIFY_REVIEW_PASSED`"的断言。

**N-02（P3，建议）四门禁空 `catch {}` 对整段拒绝路径 fail-open**
- 偏差点：`orchestrator.js:1906/3374/3483/4808` 的空 catch 包住"loadCapability + gate 判定 + 拒绝落盘 `escalateState`/`emit`"整段；若判定已生成但后续 `escalateState`/`emit` 抛异常，会被静默吞掉并 fall-through 到派发（fail-open）。
- 判定说明：当前能力模块真实存在、可导入，`loadCapability` 正常路径不会抛错，显式配置场景实测进入 verdict 并 blocking，故**不判 FAIL**；但作为安全门禁的异常处理，空吞且无诊断不符模板 §3.4 的可观测精神。
- 建议：将 `try` 收窄到仅 `loadCapability`，或在 catch 中记录诊断（不改动既有逐字输出），避免"判定已出却被吞"。

## 5. 实跑命令与输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `git status --short` / `git rev-parse HEAD` / `git diff --stat fc384ef` | HEAD=`fc384ef…`；4 M + 3 ?? 共 7 个 WP-7 文件，另 `M decisions.md`（裁决 D）、`M test/wp2/labels.test.js`（2 处授权同步）；无越权文件。 |
| 2 | `NODE_ENV=test node --test test/wp15/wiring.test.js test/wp15/regression.test.js test/wp2/labels.test.js test/wp15/chain-verify.test.js test/wp15/governance-wake.test.js test/wp15/budget.test.js` | `tests 82 / pass 82 / fail 0 / skipped 0`，duration ~385ms。 |
| 3 | `node bin/orch.js --help` | 31 行、exit 2；前 25 行与 `USAGE_LINES` 逐字一致，后 6 行为 `orch verify <实例>/<包>/import/review`、`orch migrate`、`orch export` 独立块。 |
| 4 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | `OK: 扫描 38 个文件 … 零命中`，exit 0。 |
| 5 | `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>` | `OK: 扫描 31 个文件 … 零命中`，exit 0。 |
| 6 | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` | `0`。 |
| 7 | `git diff --check fc384ef` | exit 0，无空白错误。 |
| 8 | `grep -REn "transit\(" src/core \| wc -l` | `6`（`async function transit(` 唯一，与 wiring.test.js:517 / regression.test.js:175 基线一致）。 |
| 9 | `grep -nE "decideWake\|validateEvidenceFreshness\|decideParallelism\|decideBudget\|validateHighRiskReview\|void \|buildGovernanceRejection" src/core/orchestrator.js` | 四门禁调用点 `:1885/:3350/:3452/:4759` 均 `const { verdict } =`；无 `void <decision>`；`buildGovernanceRejection` 在 `:3464/:4777` 被真实调用。 |
| 10 | 真实模块抽查 `verifyCommand({sub:'review',...})` + `validateHighRiskReview`（`node --input-type=module -e`） | 已配终审路径：`raw={"ok":true,"needsHumanReview":true,"blocked":false}` → exit **1** + "校验未通过"（N-01 复现）；缺终审路径：`raw={ok:false,blocked:true}` → exit 1（正确）。 |

> 31 词 `--forbid` 原文取自 `requirement.md:495`（AC-22 机检），与 D-12 / `requirement.md:697` 完全一致，顺序未改。
> 未跑全量测试（`node --test "test/**/*.test.js"`），避免覆盖历史证据（任务 C 项要求）；AC-22 全量与三主链逐字比对按裁决 D-5 属 S3 验收取证、S4 复核，不在本轮 WP-7 评审范围。
