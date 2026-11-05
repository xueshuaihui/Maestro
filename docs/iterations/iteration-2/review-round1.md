# I1.2 实现评审（第 1 轮）

> **处置状态（收口时补记）**：本轮 2 个阻断项（BLK-01 / BLK-02）已全部修复并复验，最终 44/44 通过。**本文件保留第 1 轮原始结论不改写**；逐项处置、验收阶段新发现缺陷与最终核对见 `review-round2.md`，迭代总报告见 `report.md`。

> 评审人：独立评审子 Agent ｜ 基准：requirement.md v15 ｜ 快照：2026-11-05 20:22:20（Git Bash `date`）
>
> 约束声明：本轮只做评审，未写实现代码；未修改任何 `src/**`、`test/**`、`bin/**`、`docs/**` 已有文件；仅新增本报告。
> 未创建任何 `probe/rv-*.mjs`（本轮无需临时脚本）；临时产物均在 `%TEMP%/maestro-rv1/` 与 `/tmp/maestro-rv1-*.txt`。
> 未触碰 `%TEMP%/maestro-acc-f2/`、`%TEMP%/maestro-acc-p2/`；未执行 `git commit`。
> 全量测试本轮实跑：`node --test $(find test -name '*.test.js' -o -name '*.test.mjs' | sort)` → `FILE_COUNT=30`、`ALL_TESTS_EXIT=0`、`# tests 337 / # pass 337 / # fail 0`。

## 0. 总判

**需修复后验收，阻断 2 项（BLK-01 / BLK-02）。**

- 44 条有效 AC（AC-17 / AC-30 已作废）预判：**会挂 2 条**（AC-28、AC-42）、**待验 3 条**（AC-01 / AC-03 / AC-45，真实面不可构造）、**能过 39 条**。
- 31 条 BR 逐条对照：全部「符合」，但 BR-18 的第二次取消文案存在落地缺口（详见 BLK-02）。
- 2 项阻断均为「需求逐字/架构约束」类，非功能主流程崩溃；两节点主流程、回流、升级、取消、判定、产物、v1 只读、single 回归实测均通过。
- 另有 9 项建议项（不阻断）与 6 处需求/契约偏离，需主 Agent 逐条确认口径。

## 1. 阻断项

| ID | 对应 AC/BR | 文件:行 | 现象 | 为什么会导致验收失败 | 期望行为 |
|---|---|---|---|---|---|
| **BLK-01** | AC-28（架构检查，BR 无）/ BR-16 旁证 | `docs/iterations/iteration-2/requirement.md:882`；`src/core/state-machine.js:87`、`:89`；`test/templates/fake-graph.test.js:294-300`；`test/fixtures/purity-check.mjs`（Glob → No files found） | ① AC-28 的 `When` 指定 `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator`，该脚本**不存在**；② 即使补齐脚本，`src/core` 的 Grep 结果仍命中 `state-machine.js:87 // ... (developer only)`、`:89 // ... (tester only)`；③ `fake-graph.test.js:294-300` 明确把 `state-machine.js` 列为「WP-1 豁免」，故单测 12/12 通过**不等于**架构干净；④ `src/daemon` 四词 Grep → No matches found（干净） | AC-28 的 `Then` 要求「退出码 0，四个字面量在 `--dirs` 指定的两个目录里都不出现（注释也算）」。`src/core` 实际含 `developer` / `tester`（在扫描范围内、非白名单），扫描必然非 0 退出；且 `When` 的脚本缺失导致命令根本无法执行 | 补齐 `test/fixtures/purity-check.mjs`；清除 `src/core/state-machine.js:87/:89` 两条注释中的 `developer` / `tester` 字面量（AC-28 明确「注释也算」），使 `src/core` + `src/daemon` 四词零命中；`fake-graph.test.js` 取消对 `state-machine.js` 的豁免或改由 purity 脚本统一判定 |
| **BLK-02** | AC-42（BR-18）/ D-5:1592 | `docs/iterations/iteration-2/requirement.md:1080`、`:1592`；`src/core/orchestrator.js:2394-2395`、`:2433-2434`；`src/cli/labels.js:126`、`:136`；`src/core/error-map.js:19`、`:108` | 第二次 `orch cancel --instance INST-001`（实例已 `cancelled`）走 `cancel()` / `cancelLive()` 的 `TERMINAL.has(...)` 分支，返回 `fail(CODES.INSTANCE_TERMINAL, {state})`，文案为 `实例已结束（{state}），本迭代不支持重跑`（`labels.js:126`）。`CANCEL_NOT_NEEDED`（`labels.js:136`，逐字 `实例已结束（{state}），无需取消`）虽已定义，但全 `src` Grep 仅命中该定义处，**无任何业务路径引用**（`error-map.js` 亦无该 code） | AC-42 最后一个 `When/Then`：第二次取消期望输出含 `实例已结束（已取消），无需取消`、退出码 1（requirement.md:1080）。实际输出含 `…本迭代不支持重跑`，不含「无需取消」→ 该 Then 判定失败。退出码 1 与期望一致（`main.js:130` `exitCodeFor` 业务错误→1），仅文案不符 | 在 `cancel()` / `cancelLive()` 的终态分支改用 `CANCEL_NOT_NEEDED`（并把该 code 补进 `error-map.js` / `renderError` 映射），使第二次取消输出逐字为 `实例已结束（已取消），无需取消` |

**实际 vs 期望汇总**

- BLK-01 实际：脚本缺失（`Glob **/purity-check.mjs` → No files found）＋ `Grep code-loop|developer|tester|coordinator src/core` → `state-machine.js:87`、`:89` 两处命中；`src/daemon` 干净。期望：脚本存在且退出码 0、两目录四词零命中。
- BLK-02 实际：`实例已结束（已取消），本迭代不支持重跑`（`orchestrator.js:2395` → `labels.js:126`）。期望：`实例已结束（已取消），无需取消`（requirement.md:1080 / D-5:1592）。

## 2. 建议项（不阻断）

| ID | 主题 | 文件:行 | 说明 |
|---|---|---|---|
| SUG-01 | `handoff-tracker.js` 的 `LEGAL.created` 缺 `rejected`，且 D-8 测试同步未做 | `src/adapter/handoff-tracker.js:26`；`docs/iterations/iteration-2/requirement.md:1635`；`src/core/state-machine.js:96` | `state-machine.js:96` 已补 `created:['delivered','rejected']`，但 `handoff-tracker.js:26` 仍为 `created:['delivered']`。产品取消路径 `applyCancel`（`orchestrator.js:2511`）**绕过 tracker 直接改 state**，故 AC-11 / AC-37 不受影响；但 `tracker.rejected()`（`orchestrator.js:1326-1327`，failRun 分支）若遇 `created` 包会返回 illegal。D-8:1635 明确要求 `test/wp3/handoff-tracker.test.js` 补 `created→rejected` 断言，当前 `grep created.*rejected` 仅命中 `test/wp2/state-machine.test.js:64` 与 `test/wp4/orchestrator.test.js:790`，未见 wp3 断言。按「D-8 逐条核对」口径应补齐；按「44 条 AC 验收」口径不阻断 |
| SUG-02 | `src/core` 禁词 `dsh` 命中（K.37） | `src/core/orchestrator.js:664` | 注释「丢了它会退回默认宿主（dsh），把 mock 夹具的会话换掉」含 `dsh`。AC-28 的 `--forbid` 四词不含 `dsh`，但 K.37 单独要求 `src/core` 无 `dsh`/`stdio`/`transport`；`stdio`/`transport` 零命中，`dsh` 注释命中。若按「注释也算」严格口径需清理 |
| SUG-03 | `npm test` 脚本在本机失败 | `package.json:13`（`"test": "node --test test/"`）；本轮实测 `NPM_TEST_EXIT=1`、`# tests 1 / # fail 1` | Node `v22.22.2` / Windows 下 `node --test test/` 把目录当模块解析报 `Cannot find module`。**非用例红**：显式文件列表 30 个文件 `ALL_TESTS_EXIT=0`、`337/337 pass`。若验收方直接跑 `npm test` 会误判为全量失败，建议把脚本改为显式文件列表或 `node --test test/**/*.test.js` |
| SUG-04 | `maxRounds` 契约自相矛盾 | `docs/iterations/iteration-2.md:70` vs `:410`；`src/templates/index.js:107` | 文件级契约 `:70` 写 `maxRounds={'T-002':2}`（只 T-002），`:410` 与实现 `:107` 写 `{'T-001':2,'T-002':2}`。行为上 `code-pass` / 回流闭环均通过（T-001=2 不影响「第 2 轮测试通过即完成」），但需主 Agent 裁定权威口径，避免 I1.4 沿用错值 |
| SUG-05 | 「已过期」映射残留 | `src/cli/labels.js:42`；`src/cli/render.js:609`；`src/adapter/handoff-tracker.js:6`、`:29`；`src/cli/render.js:562` | `labels.js:42` 仍有 `expired:'已过期'`，`renderCancelLines:609` 用 `HANDOFF_LABEL[handoff?.state]`（若出现 `expired` 会打印）。但 `handoff-tracker.js:6` 明确「禁止任何 TTL / 定时器 / 超时判 expired —— expired 零产生路径」、`:29` pending 无产生路径、`render.js:562` 注释「绝不显示"已过期"」、`render.js:496` `HANDOFF_ORDER` 不含 `expired` → 当前产品路径不会打印（I.29 结论「无」）。建议删除死映射 |
| SUG-06 | 判定 schema 类错误的 `stage` 口径 | `src/core/verdict.js:192`、`:198` | `VERDICT_SCHEMA_INVALID` 返回 `stage:'schema'`，拆分文档 `iteration-2.md` 用 `unparsable` 口径。不影响 AC-14 机检（只断言「不回流」），但对账时需统一 |
| SUG-07 | `shouldWake` 的 backflow `eligibleStates` 比 D-2 宽 | `src/core/advance.js:192`（`shouldWake`） | 实现 backflow 允许目标节点 `['done','failed']`，D-2 文字为「目标必须是开发且 `done→running`」。当前图只有两节点、行为未越界，但契约口径需确认 |
| SUG-08 | `session` 表 `escalated:['idle']` 与注释矛盾 | `src/core/state-machine.js:114-115` | 注释「Escalated has no outbound edge except cancel」，表却给 `escalated:['idle']`。实际由 `session-state.js:90` `escalated_guard` 拦截迟到帧（G.22 结论「不会翻回 thinking」），不阻断，建议对齐 |
| SUG-09 | 真实面 3 条 AC 待验 | `docs/iterations/iteration-2/requirement.md:553`、`:1347` | AC-01 / AC-03 / AC-45 依赖「真实 DSH + 真实模型」，评审环境不可构造；夹具等价路径 `code-pass` / `backflow-once` 已覆盖机检。验收前需在真实宿主补跑，缺：真实 DSH 安装 + 可稳定失败的真实模型样例 |

## 3. AC 逐条预判（44 行表）

> 有效 AC = 46 条 − AC-17 / AC-30（已作废，requirement.md:757 / :903）。「会挂」的实际 vs 期望见 §1。

| AC | 验证面 | 预判 | 依据（文件:行 / 实测命令输出） |
|---|---|---|---|
| AC-01 | 产品命令 | 待验 | 真实 DSH+真实模型不可构造（requirement.md:553、:1347）；夹具等价 `code-pass` 实测 `state=completed`、nodes T-001/T-002 均 `done`（`code-loop-driver.mjs:268/:542`）；图定义 `templates/index.js:101-147`。缺：真实宿主 + 真实模型 |
| AC-02 | 产品命令 | 能过 | `graph.js:83` nextNode / `:113` edgeFor 顺序边；`orchestrator.js:1686` advanceLocked 单节点推进；显式文件列表 337/337 绿 |
| AC-03 | 产品命令 | 待验 | 同 AC-01（真实面成功闭环，requirement.md:553）；`graph.js:134` isTerminalNode / `templates/index.js:107` terminals=T-002；夹具 code-pass 实测 `state=completed`。缺：真实 DSH |
| AC-04 | 混合 | 能过 | `render.js:449` renderNodeLines / `:546` renderHandoffLines；`labels.js:77` HANDOFF_DIRECTION；code-loop `status --events` 实测带方向交接包（`开发→测试`） |
| AC-05 | 夹具 | 能过 | `advance.js:192` shouldWake / `:147` buildBackflowHandoff；`graph.js:113` edgeFor `verdict-fail`→backflow；`templates/index.js:52` PROMPT_TEMPLATES.backflow；`code-loop-driver.mjs:268` 含 backflow-once 场景 |
| AC-06 | 夹具 | 能过 | 回流复用节点：`advance.js:192` shouldWake 复用 node；`orchestrator.js:976` node.round+=1（不新建）；337 绿 |
| AC-07 | 夹具 | 能过 | `templates/index.js:107` maxRounds T-002=2；`graph.js:151` maxRoundsOf；`advance.js:205` ROUNDS_EXCEEDED；`orchestrator.js:1538` finishVerdictNode → `escalation.js:161` commitEscalation |
| AC-08 | 夹具 | 能过 | `escalation.js:59` buildEscalation / `:161` commitEscalation；`render.js:637` renderEscalationBlock；`state-machine.js:104` escalation 表 |
| AC-09 | 夹具 | 能过 | `state-machine.js:81` `suspended:['cancelled']`、`:142` TERMINAL_INSTANCE 不含 suspended；`orchestrator.js:1686` advanceLocked 对 halted/suspended 停；`main.js:33` EXIT_SUSPENDED |
| AC-10 | 混合 | 能过 | `state-machine.js:150` CORE_IMMUTABLE 含 suspended；`orchestrator.js:2657` reconcileOnBoot / `:2676` interruptAll 用 `:63` CORE_IMMUTABLE 跳过；round/rev 落盘 `instance-store.js` |
| AC-11 | 混合 | 能过 | `orchestrator.js:2443` applyCancel / `:2509-2522` handoff→rejected(withdrawn) / `:2527-2539` voided；`render.js:586` renderCancelLines |
| AC-12 | 夹具 | 能过 | `main.js:33` EXIT_SUSPENDED=4 / `:337-338` renderRunTail + 返回 4；`render.js:678` renderRunTail 三行收尾 |
| AC-13 | 夹具 | 能过 | `verdict.js:154` VERDICT_MISSING；`orchestrator.js:1540` readVerdict 失败走升级非回流；`code-loop-driver.mjs:268` verdict-missing 场景 |
| AC-14 | 夹具 | 能过 | `verdict.js:64` parseVerdict / `:192,:198` VERDICT_SCHEMA_INVALID / `:109` verifyEvidence；四样本 requirement.md:1338；337 绿 |
| AC-15 | 夹具 | 能过 | `verdict.js:136` readVerdict 以文件为准；`orchestrator.js:1355` 传 roundStartedAt；`code-loop-driver.mjs` verdict-says-fail 场景 |
| AC-16 | 夹具 | 能过 | `verdict.js:158-160` VERDICT_STALE 用 `roundStartedAt`（非 startedAt）；`orchestrator.js:979` node.roundStartedAt；verdict-stale / verdict-stale-retest 场景 |
| AC-18 | 夹具 | 能过 | `verdict.js:192` VERDICT_SCHEMA_INVALID（失败但无缺陷）；`code-loop-driver.mjs:268` verdict-no-defects |
| AC-19 | 夹具 | 能过 | `verdict.js:109` verifyEvidence；`code-loop-driver.mjs:268` verdict-missing-evidence |
| AC-20 | 混合 | 能过 | `orchestrator.js:104` isLegacy / `:2393,:2432,:2448,:2290` LEGACY_READ_ONLY；`instance-store.js` load 不回写；`test/fixtures/legacy-v1/SHA256SUMS`（OLD-001 `completed` / OLD-002 `running`，均 `schemaVersion:1`） |
| AC-21 | 产品命令 | 能过 | **实测**：`%TEMP%/maestro-rv1/` 下 `orch run ... --host mock` 退出码 0，输出按 A-1 段序（实例行→会话已创建→任务已投递→会话状态行→节点行→交接包行），首行「实例 INST-001 · 运行中」无「模板」，HO-001 四状态齐全；`render.js:778-781` single 无 seq |
| AC-22 | 混合 | 能过 | **实测**：single `status --instance INST-001 --events` 中 `grep -c '\[#'`=0；显式文件列表 `337/337 pass`；`render.js:771` rejected 走 I1.1 版式 |
| AC-23 | 产品命令 | 能过 | `verify-artifact.js:204` PRODUCT_LINE `/产物：/`；`labels.js:128-130` TASK_EMPTY / TEMPLATE_UNKNOWN / PRODUCT_LINE_MISSING 逐字对 D-5:1582-1584；`orchestrator.js:2301,:2309` DIR_BUSY |
| AC-24 | 夹具 | 能过 | `event-bus.js:12` createEventBus（seq / appendEvent）；`render.js:789` renderBackflowDetail（6 空格缺陷行 + 复测行）；D-5:1595-1596 逐字 |
| AC-25 | 夹具 | 能过 | `orchestrator.js:425-438` 非法迁移 emit `result:'rejected' / reason:'illegal_transition'` 后直接 return、无 saveState；`:398` 未知 object 返回 UNKNOWN_OBJECT |
| AC-26 | 夹具 | 能过 | `advance.js:217` checkWakeGate / `:192` shouldWake / `:205` ROUNDS_EXCEEDED；`orchestrator.js:1766,:2814` 消费后置 wakeConsumedAt |
| AC-27 | 夹具 | 能过 | `escalation.js:42` findPending / `:161` commitEscalation 一次 CAS；`orchestrator.js:259` fault 注入 |
| AC-28 | 架构检查（非用户面） | **会挂** | **BLK-01**：`purity-check.mjs` 缺失（Glob → No files found）；`src/core` Grep 命中 `state-machine.js:87` developer、`:89` tester（requirement.md:882 四词含注释）；`fake-graph.test.js:294-300` 显式豁免 state-machine.js；`src/daemon` 四词 Grep → No matches found。实际 vs 期望见 §1 |
| AC-29 | 夹具 | 能过 | `verify-artifact.js:300` verifyProducts / `:330` `产出为空 ${ref}` / `:308` roundStartedAt；`orchestrator.js:1364,:1503` 传 node.roundStartedAt |
| AC-31 | 混合 | 能过 | `orchestrator.js:2290,:2298` INSTANCE_RUNNING / isLegacy；`labels.js:132` 逐字；`code-loop-driver.mjs:268` hold-forever |
| AC-32 | 夹具 | 能过 | `orchestrator.js:966` dispatchInState NODE_BUSY；`labels.js`（NODE_BUSY，D-4）；`code-loop-driver.mjs:268` hold-test |
| AC-33 | 混合 | 能过 | `orchestrator.js:976,:979,:984` 轮次+1 / dispatchCount+1 在拉起 adapter 之前；`escalation.js:161` dispatch_failed 升级；BR-24；dispatch-fail-first/backflow/retest 三场景（requirement.md:1345） |
| AC-34 | 夹具 | 能过 | `handoff-tracker.js:53` createHandoffTracker（delivered / accepted / consumed 三时刻）；`render.js:546`；code-pass 实测 HO-001 四状态 |
| AC-35 | 混合 | 能过 | `orchestrator.js:2657` reconcileOnBoot / `:2676` interruptAll / `:63` CORE_IMMUTABLE；`lifecycle.js:23` ensureCore / `:49` stopCore；`render.js:270` renderCoreGoneNote |
| AC-36 | 夹具 | 能过 | `state-machine.js:142-157` 五组常量；`labels.js:6/:16/:45` INSTANCE_LABEL.suspended / NODE_LABEL.escalated / ESCALATION_LABEL；`code-loop-driver.mjs:268` retest-fail |
| AC-37 | 夹具 | 能过 | `orchestrator.js:2443` applyCancel / `:2509-2522` created→rejected(withdrawn)；`advance.js:25` PENDING_HANDOFF_STATES；backflow-once 场景 |
| AC-38 | 夹具 | 能过 | `escalation.js:216-217` `state_write:escalation` 只作用升级那一次写 / `:275` markHalted 独立写 `halted:true`；`labels.js:135` ESCALATION_WRITE_FAILED / D-5:1597「已停止推进」 |
| AC-39 | 夹具 | 能过 | `session-state.js:90` escalated_guard（迟到帧丢弃）；`state-machine.js:108-115` session 表；`orchestrator.js:135` latestSession |
| AC-40 | 混合 | 能过 | `orchestrator.js:2301,:2309` DIR_BUSY；`labels.js:131` 逐字对 D-5:1585 |
| AC-41 | 夹具 | 能过 | `advance.js:93` nextHandoffId / `:106` buildHandoff；`labels.js:77` HANDOFF_DIRECTION；code-loop `status --events` 实测编号连续、带方向 |
| AC-42 | 夹具 | **会挂** | **BLK-02**：`orchestrator.js:2394-2395`（cancel）/ `:2433-2434`（cancelLive）终态返回 INSTANCE_TERMINAL（`labels.js:126`「本迭代不支持重跑」）；`CANCEL_NOT_NEEDED`（`labels.js:136`）逐字已定义但全 src 无引用。实际 vs 期望见 §1 |
| AC-43 | 夹具 | 能过 | `templates/index.js:211` promptFor / `:242` `judge==='verdict'` 追加 VERDICT_REQUIREMENT（`:61`，含 `out/verdict.json` 与「判定」）；code-pass 实测正向交接含判定要求 |
| AC-44 | 夹具 | 能过 | `orchestrator.js:1207-1217` / `:1397-1405` 置 waiting_dependency、`:1435` `pauseFor('after_output')`（核对前暂停）；`session-state.js:191-195`；`render.js:282` renderSessionLine |
| AC-45 | 产品命令（真实 DSH + 真实模型） | 待验 | 真实宿主 + 真实模型不可构造（requirement.md:553、:1347「AC-45 不用夹具」，场景清单无 `demo-code-fail`）；夹具等价 `backflow-once`（AC-46）。缺：真实 DSH + 真实模型稳定失败样例 |
| AC-46 | 夹具 | 能过 | `code-loop-driver.mjs:268` SCENARIOS 含 backflow-once / `:542` assertScenario；code-pass 实测 `state=completed` 两节点 done；337/337 绿 |

## 4. BR 逐条预判（31 行表）

> BR-01 ~ BR-31 连续（requirement.md:512、:516-546）。预判口径：符合 / 偏离 / 待验。

| BR | 预判 | 依据（文件:行 / 实测） |
|---|---|---|
| BR-01 | 符合 | `graph.js:83` nextNode / `:113` edgeFor；`orchestrator.js:1686` advanceLocked 顺序推进 |
| BR-02 | 符合 | `verdict.js:136` readVerdict 只读 `out/verdict.json`；`orchestrator.js:1355` |
| BR-03 | 符合 | `verdict.js:154,:160,:192` 六类失败；`orchestrator.js:1538` finishVerdictNode 全部走升级、`graph.js:113` 的 `verdict-fail` 仅指合法 fail 带缺陷→回流（非判定坏） |
| BR-04 | 符合 | `orchestrator.js:976` node.round+=1；`advance.js:192` shouldWake 复用节点；节点表始终两行 |
| BR-05 | 符合 | `templates/index.js:107` maxRounds T-002=2；`graph.js:151` maxRoundsOf；`advance.js:205` ROUNDS_EXCEEDED |
| BR-06 | 符合 | `state-machine.js:81` suspended 只进 `cancelled`；`orchestrator.js:1686` advanceLocked 对 halted/suspended 停 |
| BR-07 | 符合 | `labels.js:6/:16/:45` INSTANCE_LABEL.suspended「已挂起」/ NODE_LABEL.escalated「已升级」/ ESCALATION_LABEL；D-5:1602-1604 |
| BR-08 | 符合 | `escalation.js:59` buildEscalation（nodeId/round/reason 原文）；`render.js:637` renderEscalationBlock |
| BR-09 | 符合 | `verdict.js:109` verifyEvidence；`templates/index.js:52` PROMPT_TEMPLATES.backflow 带缺陷与证据 |
| BR-10 | 符合 | `orchestrator.js:966` dispatchInState 每轮新建 session；code-loop `status --events` 实测不同会话号 |
| BR-11 | 符合 | `instance-store.js:65` compareExpected / rev 递增；`atomic-write.js:42,:64,:79` fsync + rename；`orchestrator.js:979` roundStartedAt |
| BR-12 | 符合 | `orchestrator.js:104` isLegacy / `:2290,:2393,:2432` LEGACY_READ_ONLY；`test/fixtures/legacy-v1/SHA256SUMS`（哈希不变） |
| BR-13 | 符合 | `orchestrator.js:1374` finishGraphNode 先 `review` 再核对通过 `done`；`verify-artifact.js:300` |
| BR-14 | 符合 | `graph.js:134` isTerminalNode（T-002）；`templates/index.js:107` terminals；`escalation.js:161` 宿主报错升级 |
| BR-15 | 符合 | `orchestrator.js:2298` INSTANCE_RUNNING / `:966` NODE_BUSY；`labels.js:132` |
| BR-16 | 符合 | `event-bus.js:12` createEventBus（seq）；`render.js:783` code-loop `[#seq]`、`:778-781` single 保持 I1.1 |
| BR-17 | 符合 | `escalation.js:42` findPending / `:161` commitEscalation 单次 CAS；`orchestrator.js:259` |
| BR-18 | 符合（文案缺口见 BLK-02） | `orchestrator.js:2443` applyCancel 收敛四数组、取消后不投递；第二次取消文案走 INSTANCE_TERMINAL 而非 CANCEL_NOT_NEEDED（BLK-02） |
| BR-19 | 符合 | `handoff-tracker.js:53` createHandoffTracker（accepted ≠ consumed）；`render.js:546` |
| BR-20 | 符合 | `labels.js:128-130` 三条逐字；`verify-artifact.js:204` PRODUCT_LINE；`orchestrator.js:2301` DIR_BUSY |
| BR-21 | 符合 | `orchestrator.js:2301,:2309` DIR_BUSY（仅 code-loop 设限） |
| BR-22 | 符合 | `advance.js:93` nextHandoffId / `:106` buildHandoff；`labels.js:77` 方向文本 |
| BR-23 | 符合 | `main.js:33` EXIT_SUSPENDED=4 / `:337-338` renderRunTail；`render.js:678` 三行收尾 |
| BR-24 | 符合 | `orchestrator.js:966,:976` 派发建会话失败仍计一次并升级；`escalation.js:161` dispatch_failed；实例 suspended、退出码 4 |
| BR-25 | 符合 | `escalation.js:216-217` fault 只作用升级写 / `:275` markHalted 独立 halted:true；`labels.js:135` |
| BR-26 | 符合 | `templates/index.js:52` PROMPT_TEMPLATES（forward / backflow / retest 三类上下文） |
| BR-27 | 符合 | `orchestrator.js:104,:2290` v1 拒绝；`instance-store.js` load 不回写；legacy-v1 哈希一致 |
| BR-28 | 符合 | `orchestrator.js:1207-1217,:1397-1405` waiting_dependency、`:1435` after_output 暂停；`render.js:282` |
| BR-29 | 符合 | **实测**：single run/status 逐字保持 I1.1（A-1 段序、退出码 0、审批/失效提示不变）；`render.js:778-781` |
| BR-30 | 符合 | `orchestrator.js:2657` reconcileOnBoot / `:2676` interruptAll / `:63` CORE_IMMUTABLE；`render.js:270` renderCoreGoneNote |
| BR-31 | 符合 | `advance.js:192,:198-200,:205` created\|delivered + wakeConsumedAt===null + ROUNDS_EXCEEDED；`orchestrator.js:1766,:2814` 消费置位 |

## 5. 与需求/契约的偏离

| # | 偏离 | 文件:行 | 权威口径 | 处理建议 |
|---|---|---|---|---|
| 1 | AC-28 架构约束不满足（脚本缺失 + src/core 命中禁词 + 单测豁免） | requirement.md:882；state-machine.js:87/:89；fake-graph.test.js:294-300 | requirement v15（最高） | BLK-01，必修 |
| 2 | 第二次取消文案不符 D-5 | requirement.md:1080/:1592；orchestrator.js:2394-2395；labels.js:126/:136 | requirement v15 D-5 | BLK-02，必修 |
| 3 | `handoff-tracker.js` 的 `LEGAL.created` 缺 `rejected`、`test/wp3/handoff-tracker.test.js` 未补断言 | handoff-tracker.js:26；requirement.md:1635；state-machine.js:96 | D-8（需求附录） | SUG-01；按 D-8 硬约束则应升级为阻断 |
| 4 | `maxRounds` 契约自相矛盾 | iteration-2.md:70 vs :410；templates/index.js:107 | iteration-2.md（次高） | SUG-04，主 Agent 裁定 |
| 5 | `transit` 非唯一状态迁移入口（但 CAS 无绕过） | orchestrator.js:329 saveState / :389 transit / :2443 applyCancel / :966 dispatchInState；`grep 'store.save'` 仅命中 `:234`、`:333` 两处封装 | iteration-2.md / review-contract.md S2 | 单对象迁移走 transit；批量取消/派发直接改 state 后经 saveState+CAS。CAS 唯一写路径，未见绕过；若契约要求「所有迁移必走 transit」需补文档或改造 |
| 6 | `shouldWake` backflow `eligibleStates` 比 D-2 宽 | advance.js:192 | D-2 | SUG-07 |
| 7 | 判定 schema 类 `stage:'schema'` vs 拆分文档 `unparsable` | verdict.js:192/:198 | iteration-2.md | SUG-06 |
| 8 | `session.escalated:['idle']` 与「仅 cancel 出口」注释矛盾 | state-machine.js:114-115 | D-1 | SUG-08（由 `session-state.js:90` 守卫兜底，不阻断） |
| 9 | 「已过期」死映射残留 | labels.js:42；render.js:609 | 本迭代禁止打印 | SUG-05（零产生路径，不阻断） |
| 10 | `npm test` 脚本在 Node22/Windows 失败 | package.json:13；本轮实测 NPM_TEST_EXIT=1 | 项目脚本 | SUG-03 |

## 6. 回归与架构检查结果

### 6.1 核查问题逐条结论（任务 A~K 的 B~K 共 38 问；A 部分 = §3 的 44 行表）

**B. 状态机与迁移（1~5）**

1. **节点表是否逐条等于 D-1** → **是**。并排（`src/core/state-machine.js:83-94`）：

   | 状态 | 实现 | D-1 要求 |
   |---|---|---|
   | pending | `['running','escalated','cancelled']`（:84） | 含 3 条新边 |
   | running | `['review','failed','escalated','cancelled']`（:85） | 保留 `running→failed` |
   | review | `['done','failed','escalated','cancelled']`（:86） | 新增 |
   | done | `['running','escalated']`（:88） | **无 cancelled** ✓ |
   | failed | `['running','escalated','cancelled']`（:90） | 新增 |
   | escalated | `['cancelled']`（:92） | 唯一出口 ✓ |
   | cancelled | `[]`（:93） | 终态 ✓ |

   10 条新边 + `running→failed` 保留 + `done` 无 `cancelled` + `escalated:['cancelled']` 全部对齐。
2. **suspended 是否在 TERMINAL_INSTANCE 外、五组常量是否等于 D-4** → **是**。`state-machine.js:142-147` TERMINAL_INSTANCE=`completed/failed/cancelled/interrupted`（无 suspended）；`:150` CORE_IMMUTABLE、`:153` RUN_DONE 均为 `[...TERMINAL,'suspended']`；`:155` CANCELABLE_NODE=`pending/running/review/failed/escalated`；`:157` CANCELABLE_HANDOFF=`created/delivered/accepted`。与 D-4 一致。
3. **created→rejected 两张表都加了？** → **否**。`state-machine.js:96` `created:['delivered','rejected']` ✓；`handoff-tracker.js:26` `created:['delivered']` ✗。但 `applyCancel`（`orchestrator.js:2511`）绕过 tracker 直接改 state，AC-11/AC-37 不受影响；`tracker.rejected()`（`orchestrator.js:1326-1327`）在 failRun 分支若遇 created 会返回 illegal。D-8:1635 要求的 wp3 断言未补。详见 SUG-01 / §5-3。
4. **transit 按 id 定位？未知 object 报 UNKNOWN_OBJECT 不回退 instance？** → **是**。`orchestrator.js:351` smFor 返回五张 SM（instance/node/session/handoff/escalation），`:397-398` `if (!sm) return {ok:false, code:'UNKNOWN_OBJECT'}`（不回退）；`:402` `store.load` 取磁盘最新、`:406` `locate(disk.state, object, ids)` 按 nodeId/sessionId/handoffId/escalationId 定位数组元素。
5. **非法迁移留 rejected 事件且不写盘（AC-25）？** → **是**。`orchestrator.js:425-438`：`sm.can` 失败 → emit `result:'rejected' / reason:'illegal_transition'`（`:433-434`）→ `return`（`:438`），**无 saveState**；写盘只在合法分支 `:457`。

**C. 图与推进（6~10）**

6. **src/core 四词是否真没有（注释也算）？** → **否**。本轮 Grep `code-loop|developer|tester|coordinator` 在 `src/core`：`state-machine.js:87` developer、`:89` tester；在 `src/daemon`：No matches found（干净）。另 `orchestrator.js:664` 命中 `dsh`（见 37）。→ BLK-01。
7. **advance 读磁盘最新？completed 只在图终节点写一次？single 仍走 I1.1 单节点收尾？** → **是**。`orchestrator.js:1686` advanceLocked 先 `store.load`；`transit` 每次也 `store.load`（`:402`）；`graph.js:134` isTerminalNode / `:151` maxRoundsOf；`finishSingle` 保留 I1.1 单节点收尾，图路径仅在终节点写 `completed`；code-pass 实测 `state=completed`。
8. **轮次+1 在派发（非完成）？会话没建成也算一次派发（AC-33）？** → **是**。`orchestrator.js:966` dispatchInState：`:976` `node.round += 1`、`:979` `roundStartedAt = at`、`:984` `dispatchCount += 1` 均在拉起 adapter 之前；会话创建失败也保留计数并升级（BR-24）。
9. **回流门控 created\|delivered 且 wakeConsumedAt===null？同一包二次唤醒？ROUNDS_EXCEEDED 派发前拦截？** → **是**。`advance.js:25` PENDING_HANDOFF_STATES=`created/delivered`；`:198-200` 门控含 `wakeConsumedAt !== null → NO_PENDING_BACKFLOW`；`:205` `ROUNDS_EXCEEDED` 在 shouldWake（派发规划阶段）返回；消费后置位见 `orchestrator.js:1766` / `:2814`；新包初值 `advance.js:134` `wakeConsumedAt:null`。
10. **第 2 轮仍不通过交接包仍到 consumed（不得 rejected）？halted 只在升级写入失败为 true？** → **是**。`orchestrator.js:1531,:1590,:1630` `consumeHandoff(ctx,'handoff.consumed')` 在 finishVerdictNode 路径**先于**上限判断；`escalation.js:216-217` `MAESTRO_FAULT=state_write:escalation` 只作用升级那一次写、`:275` markHalted 独立写 `halted:true`。

**D. 判定与产物（11~14）**

11. **readVerdict 六类失败都能产生？VERDICT_STALE 用 roundStartedAt？** → **是**。`verdict.js:136` readVerdict；`:154` VERDICT_MISSING、`:160` VERDICT_STALE（`:158` `startedAtMs(roundStartedAt)`，非 startedAt）、`:192/:198` VERDICT_SCHEMA_INVALID；`:64` parseVerdict（不可解析 / 缺字段 / 非布尔 / 通过带缺陷）、`:109` verifyEvidence（证据打不开）共同构成六类。注：schema 类 `stage:'schema'` 口径见 SUG-06。
12. **判定失败一律升级、不回流（B-04）？有「判定坏还打回开发」路径？** → **是（无打回路径）**。`orchestrator.js:1538` finishVerdictNode 对 readVerdict 失败走 `commitEscalation`（升级）；`graph.js:113` edgeFor 的 `outcome==='verdict-fail'` 仅表示「合法 fail 且带缺陷」→backflow（AC-05 正常回流），与 BR-03 六类坏判定不冲突。
13. **verifyProducts 空文件文案逐字 `产出为空 <路径>`？single 仍走启发式（不出现 PRODUCT_LINE_MISSING）？** → **是**。`verify-artifact.js:330` `产出为空 ${ref}`；single 启发式走 `verifyArtifacts`（`:150`），空文件文案 `声明的产出为空 ${ref}`（`:173`）；`PRODUCT_LINE`（`:204`）仅 code-loop 用；single 实测输出无 `PRODUCT_LINE_MISSING`（`%TEMP%/maestro-rv1/run-output.txt`）。
14. **产物陈旧检查用 nodes[].roundStartedAt？** → **是**。`verify-artifact.js:303-308` `startedAtMsOf(roundStartedAt)`；`orchestrator.js:1364,:1503` 传 `node.roundStartedAt`；`verdict.js:138,:158` 同。

**E. 持久化与 CAS（15~18）**

15. **save expectedState 双形状兼容？rev 无条件基于磁盘递增？** → **是**。`instance-store.js:65` compareExpected（string 分支比较 `actual.state`；object 分支逐字段比较 `state`/`halted`/`rev`）；`:79` createStore；rev 基于磁盘 `prevRev + 1` 无条件递增；`atomic-write.js:42` writeJsonAtomic + `:64` fsync + `:79` renameWithRetry。
16. **所有状态迁移都走 transit + CAS？grep store.save 有无绕过？** → **CAS 无绕过，但 transit 非唯一入口**。`grep 'store.save'` 仅 `orchestrator.js:234`、`:333`（saveState 封装）。单对象迁移走 `transit`（`:389`）；批量取消 `applyCancel`（`:2443`）、派发 `dispatchInState`（`:966`）直接改数组后经 `saveState`（`:329`）+ CAS 落盘。未见绕过 CAS 的直写。见 §5-5。
17. **v1 只读：load 不回写？reconcileOnBoot/interruptAll/cancel/startRun --instance 都拒绝 v1？** → **是**。`orchestrator.js:104` isLegacy；`:1691` advanceLocked、`:2290` startRun、`:2393` cancel、`:2432` cancelLive、`:2448` applyCancel、`:2789`、`:2843` 均 `fail('LEGACY_READ_ONLY')`；`:2657` reconcileOnBoot / `:2676` interruptAll 用 `:63` CORE_IMMUTABLE（含 suspended，跳过 v1 与 suspended）。fixtures `test/fixtures/legacy-v1/{SHA256SUMS,OLD-001/state.json,OLD-002/state.json}` 均 `schemaVersion:1`。
18. **list() 不再有写副作用（不生成 .corrupt）？** → **是**。`list()` 为只读投影；`.corrupt` 仅 `paths.js:56` corruptPath / `atomic-write.js:95` copyToBackup 在 load 遇 STATE_CORRUPT 时产生，与 list 无关。

**F. 取消、恢复与挂起（19~21）**

19. **applyCancel 遍历四个数组？CANCELABLE_NODE 含 failed/escalated？review→failed 特判与 cancelled_in_review 已删除？** → **是**。`orchestrator.js:2443` applyCancel 遍历 nodes/handoffs/escalations/sessions（`:2508-2542` 可见 nodes/handoffs/escalations）；`state-machine.js:155` CANCELABLE_NODE 含 `failed`/`escalated`；Grep `cancelled_in_review` → 无命中、`review→failed` 仅为 D-1 节点表 `state-machine.js:86`（非取消特判）。
20. **取消时 created→rejected(withdrawn)？升级 pending→voided？** → **是**。`orchestrator.js:2509-2522` CANCEL_HANDOFF → `state='rejected'` + `rejectReason='withdrawn'`；`:2527-2539` `pending→voided`。
21. **reconcileOnBoot 跳过 suspended 与 v1？core stop 后 suspended 不变 interrupted？** → **是**。`state-machine.js:150` CORE_IMMUTABLE 含 suspended；`orchestrator.js:63` CORE_IMMUTABLE 集合、`:2657` / `:2676` 跳过；suspended 仅在 `state-machine.js:81` 有 `suspended→cancelled`，不会被写成 interrupted。

**G. 会话（22~24）**

22. **escalated 后迟到帧会翻回 thinking（AC-39）？** → **否（不会）**。`session-state.js:90` `escalated_guard`（`dropped:true`）丢弃迟到帧；`state-machine.js:115` `escalated:['idle']` 虽有出口但被守卫拦截。
23. **waiting_dependency 置位时机满足 AC-44？** → **是**。`orchestrator.js:1207-1217` / `:1397-1405` 提交产出后置 `waiting_dependency`；`:1435` `pauseFor('after_output', nodeId)` 在核对前暂停；`session-state.js:191-195` onOutputSubmitted。核对期间保持 `等待下游`。
24. **snapshotOf().session 取最新一条？sessionStalled 仍 10s？** → **是**。`orchestrator.js:135` latestSession / `:2597` snapshotOf；`:56` `STALL_MS = 10_000` / `:2607` sessionStalled 判定。

**H. CLI 与输出（25~29）**

25. **single run/status 逐字保持 I1.1（AC-21/22）？** → **是（实测）**。`%TEMP%/maestro-rv1/` 下 `orch run ... --host mock` 退出码 0，11 行输出按 A-1 段序：实例行 1 → 会话已创建 1 → 任务已投递 1 → 会话状态行 3 → 节点行 1 → 交接包行 4；首行「实例 INST-001 · 运行中」无「模板」；HO-001 四状态齐全。`render.js:778-781`。
26. **code-loop 节点表/会话单行/带方向交接包/升级块/[#seq] 逐字符合 A-2/A-3？** → **是（实测 code-pass）**。driver summary `{"ok":true,"state":"completed","nodes":[{"T-001",round1,done},{"T-002",round1,done}],"handoffs":1,"escalations":[]}`；`status --events` 产出 23 行 `[#seq]` 事件行，含「节点 T-001 派发 → 执行中 原因 派发 · 第 1 轮」；`render.js:783` seq、`:637` 升级块、`:546` 带方向交接包；`labels.js:77` HANDOFF_DIRECTION。
27. **事件行 single 无 [#seq]？rejected 两模板都无 seq？** → **是**。`render.js:771` `result==='rejected'` 先返回 `renderRejectedTransition`（`:818`，I1.1 版式，两模板同）；`:778-781` single 分支无 seq；`:783` 仅 code-loop 分支拼 `[#seq]`。实测 single `status --events` 中 `grep -c '\[#'` = **0**。
28. **退出码 4/5 真能产生？收尾行数符合 A-4？** → **是**。`main.js:33` EXIT_SUSPENDED=4 / `:35` EXIT_HALTED=5 / `:337-338` `renderRunTail` + 返回对应码；`render.js:678` renderRunTail（三行收尾）。
29. **有任何路径会打印「已过期」？** → **当前产品路径无**。`labels.js:42` `expired:'已过期'` 仍在映射、`render.js:609` `HANDOFF_LABEL[handoff?.state]` 会映射；但 `handoff-tracker.js:6` 明确「禁止任何 TTL / 定时器 / 超时判 expired —— expired 零产生路径」、`:29` pending 无产生路径、`render.js:562` 注释「绝不显示"已过期"」、`render.js:496` HANDOFF_ORDER 不含 expired、主渲染 `renderHandoffWait`（`:564`）只处理 `delivered` → 本迭代不会构造 expired，故不会打印。映射残留见 SUG-05。

**I. 错误与文案（30~31）**

30. **D-5 的 9 条 I1.1 原文一字未改？新增文案逐字？** → **是**。`labels.js:120-123` HOST_ERROR / VERIFY_FAILED / UNKNOWN_ERROR / STATE_CORRUPT 对 D-5:1599；`:126` INSTANCE_TERMINAL、`:128-136` 九条新增逐字对 D-5:1582-1592。**但** `CANCEL_NOT_NEEDED`（`:136`）仅定义未接线 → BLK-02。
31. **新增错误码都走 renderError 且占位符不残留 `{...}`？** → **是**。`render.js:863` renderError / `:842` renderErrorBody / `:831` PLACEHOLDERS=`cause,path,step,raw,reason,state,name,instanceId,i,summary,evidence,text`（覆盖 D-5 全部占位符）；`error-map.js:97` ERROR_TEXT_KEY / `:112` STAGE_TEXT_KEY；`main.js:506` 注释确认终态走 INSTANCE_TERMINAL 文案、退出码 1。

**J. 夹具可信度（32~35）**

32. **code-loop-driver 只写 .mock/ 与 .orch/hosts/，不直接改 state.json？** → **是**。`code-loop-driver.mjs:433` prepareScene 写 `.mock/`（cursor.json / prompts / history）与 `:444` `.orch/hosts/mock.json`；`:514` readLatestState / `:542` assertScenario 只读 `state.json`。
33. **mock-acp-agent --root --scenario 走产品同一条 host-config → stdio-transport → acp-client？有内存桩绕过？** → **是（未发现绕过）**。`factory.js:43` createAdapterFactory → `host-config.js:94` loadHostConfig（`:39` hostConfigPath `.orch/hosts/<hostId>.json`）→ `stdio-transport.js:25` createStdioTransport → `acp-client.js:90` createAcpClient；`dsh-launch.js:136` resolveMockLaunch 生成 spawn 参数（node + mock-acp-agent.js）；`code-loop-driver.mjs:416-444` 写 host config。全程真实进程 + NDJSON，无内存桩。
34. **cursor 原子消费能防重复？测试退避是否掩盖并发缺陷？** → **是**。`mock-acp-agent.js:194` withCursorLock `open('wx')` 独占锁、`:211` 5s 等待超时、`:235` consumeStep 全程持锁 + `tmp → rename` 写 cursor.json（`:233` 注释说明并发不会拿到同一个 n）；测试退避是对锁等待的合理处理，非掩盖。
35. **场景表覆盖 §3.3 的 17 个场景？名称与行为一致？** → **是**。`requirement.md:1328-1345` 列出 17 组；`code-loop-driver.mjs:141` BUILTIN / `:219` SCENARIO_ALIASES / `:234` COMPOSED / `:268` SCENARIOS 覆盖 `code-pass`、`backflow-once`、`backflow-hold`、`retest-hold`、`retest-slow`、`backflow-twice`、`retest-fail`、`hold-forever`、`hold-test`、`verdict-missing`、`verdict-bad-json/no-field/maybe/pass-with-defects`、`verdict-says-fail`、`verdict-stale`、`verdict-stale-retest`、`verdict-no-defects`、`verdict-missing-evidence`、`artifact-missing/empty/stale`、`dispatch-fail-first/backflow/retest`。`requirement.md:1347` 明确 AC-45 不用夹具、等价路径 backflow-once。

**K. 回归与架构（36~38）**

36. **I1.1 216 用例仍全绿（或按 D-8 合法改写）？D-8 改写都做了、没「把断言改松」？** → **基本是，但有一处同步缺口**。本轮实测显式文件列表 `FILE_COUNT=30`、`ALL_TESTS_EXIT=0`、`337/337 pass / 0 fail`；`fake-graph.test.js` 单测 12/12 pass。D-8:1632-1646 大部分改写可见（如 `test/wp2/state-machine.test.js:64` `['created','rejected']`、`test/wp4/orchestrator.test.js:790` 取消用例），**但 D-8:1635 要求的 `test/wp3/handoff-tracker.test.js` `LEGAL created→rejected` 断言未见**（见 SUG-01）。未发现「把断言改松」的证据；`fake-graph.test.js:294-300` 的豁免属于「放宽架构断言」，见 BLK-01。
37. **src/core 禁词 dsh/stdio/transport 干净？** → **否**。Grep 在 `src/core`：`orchestrator.js:664` 注释含 `dsh`；`stdio` / `transport` 零命中。四词 AC-28 命中 `state-machine.js:87/:89`；`src/daemon` 四词零命中。见 SUG-02 / BLK-01。
38. **有新增未捕获异常路径（会杀核心进程）？grep process.on 与所有 catch？** → **未发现**。`server.js:633` installProcessGuards / `:636` `uncaughtException` / `:639` `unhandledRejection` 仅写日志（`.orch/core.log`）不 `process.exit`；`serve-entry.js:61` `SIGTERM` 优雅 `server.close` 后退出；`server.js:43` 方法处理器异常转错误帧；`orchestrator.js:2409` / `:2419` cancel 的 `try/catch` 兜底、`escalation.js` / `atomic-write.js` 写失败均返回 error 对象而非抛出。`process.on` 全库仅上述 3 处，无新增全局崩溃路径。

### 6.2 回归 / 架构 / 实测汇总（本轮命令输出）

| 检查 | 命令 | 结果 |
|---|---|---|
| 全量测试（显式文件列表） | `node --test $(find test -name '*.test.js' -o -name '*.test.mjs' \| sort)` | `FILE_COUNT=30`、`ALL_TESTS_EXIT=0`、`# tests 337 / # pass 337 / # fail 0` |
| 全量测试（项目脚本） | `npm test`（`package.json:13` = `node --test test/`） | `NPM_TEST_EXIT=1`、`# tests 1 / # fail 1`（`Cannot find module`），见 SUG-03 |
| fake-graph 单测 | `node --test test/templates/fake-graph.test.js` | 12/12 pass，但 `:294-300` 豁免 state-machine.js（BLK-01） |
| AC-28 脚本 | `Glob **/purity-check.mjs` / `find . -iname '*purity*'` | **No files found** |
| AC-28 四词 / src/core | `Grep code-loop\|developer\|tester\|coordinator src/core` | `state-machine.js:87`、`:89` 命中；其余 core 文件零命中 |
| AC-28 四词 / src/daemon | 同上 / `src/daemon` | No matches found（干净） |
| K.37 禁词 / src/core | `Grep dsh\|stdio\|transport src/core` | `orchestrator.js:664` 命中 `dsh`；stdio/transport 零命中 |
| store.save | `Grep 'store.save' src` | 仅 `orchestrator.js:234`、`:333`（saveState 封装），无绕过 |
| process.on | `Grep 'process.on' src` | `server.js:636`、`:639`、`serve-entry.js:61`（SIGTERM） |
| 「已过期」 | `Grep 已过期\|expired src` | `labels.js:42` 映射残留；产品路径零产生（H.29） |
| single 回归 | `%TEMP%/maestro-rv1/` 下 `orch run ... --host mock` + `orch status --instance INST-001 --events` | 退出码 0；11 行 A-1 段序；首行无「模板」；HO-001 四状态；`grep -c '\[#'`=**0** |
| code-loop 成功路径 | `code-loop-driver.mjs --scenario code-pass --reset` + `status --events` + `core stop` | `state=completed`、两节点 `done`、handoffs=1、escalations=[]；23 行 `[#seq]` 事件；`core stop` 成功 |
| legacy-v1 fixtures | `Read test/fixtures/legacy-v1/SHA256SUMS`、OLD-001/002 state.json | 两实例均 `schemaVersion:1`（`completed` / `running`），只读基线齐备 |
| 仓库改动 | `git -C /d/WWW/Maestro status --short` | 工作区含主 Agent 的 I1.2 实现改动（多个 `M` 与 `??`，如 `src/core/graph.js`、`src/core/advance.js`、`test/wp4/orchestrator.test.js`、`probe/acc2-*.mjs` 等），均**非本轮评审所改**；本轮仅新增 `docs/iterations/iteration-2/review-round1.md`；未修改任何已有文件；无 `git commit` |

> 隔离声明：`single` 回归在 `%TEMP%/maestro-rv1/` 新建 mock host config 运行，未触碰 `%TEMP%/maestro-acc-f2/`（夹具面验收 Agent）与 `%TEMP%/maestro-acc-p2/`（真实面预留）。本轮未创建任何 `probe/rv-*.mjs`。
