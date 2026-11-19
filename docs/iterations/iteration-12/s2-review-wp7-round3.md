# I1.12 WP-7 S2 独立评审（第 3 轮）

> 评审角色：S2 实现独立评审工程师（第 3 轮；未参与实现；未读 `s2-fix-wp7.md` / `s2-fix-wp7-round2.md`，不采信任何"已修复"字样，全部结论基于实读源码 + 实跑）
> 评审对象：HEAD `fc384ef` 之上工作区 WP-7 产物 7 个（`src/cli/main.js`、`src/cli/labels.js`、`src/cli/verify.js`、`src/core/orchestrator.js`、`src/core/escalation.js`、`test/wp15/wiring.test.js`、`test/wp15/regression.test.js`）＋裁决 D 授权同步的 `test/wp2/labels.test.js`
> 判据：`requirement.md` v2.1（AC-07 / AC-08 / AC-22）、`iteration-12.md` §2.7 / §4 WP-7、`decisions.md` 裁决 D、`execution-template.md` §3.4
> 唯一写入：本文件。未改 `src/**` / `test/**` / 需求 / 拆分 / 裁决文档；未执行 `git add` / `commit`；未跑全量测试（裁决 D-5 明确 S3 取证）。

## ① 总判

**PASS**；**阻断 0**／**建议 0**；上轮 N-01（P2 阻断）、N-02（P3 建议）**均闭合**，全量六维回归未发现被改坏或新增问题。

- N-01：`verify.js:177-180` 通过条件去掉 `needsHumanReview !== true`，并新增真实行为断言 `wiring.test.js:351-386`；真实模块抽查证明"已配终审"退出 0 且输出 `VERIFY_REVIEW_PASSED`（"校验通过"）、"缺终审"退出 1 且输出 `HIGH_RISK_MISSING_REVIEW`。
- N-02：四处门禁的 `try` 由"包住整段判定 + 落盘"收窄为"仅包 `loadCapability`"，verdict 消费与 `escalateState`/`emit` 路径移出 try，异常不再被静默吞掉后 fall-through。
- 全量重扫：六维全部 PASS；无新 advisory `void`、无新中文硬编码、无新越权文件、无新断言放宽。
- 不写 S3 未取证为 WP-7 FAIL：AC-22 全量 `tests ≥1425 + 差集 0` 与三主链逐字比对按裁决 D-5 属 S3 取证、S4 复核；本轮 `regression.test.js` 结构性门禁口径未变。

## ② N-01 / N-02 逐条复核表

| 编号 | 上轮问题 | 三态 | 文件行号与实跑/实读证据 |
|---|---|---|---|
| N-01（P2 阻断） | `verify review` 把 `needsHumanReview===true` 误判为校验失败，已配终审仍退出 1 | **已闭合** | 代码：`src/cli/verify.js:177-180` 条件改为 `result?.ok === true && result?.blocked !== true`，`:177` 注释"needsHumanReview marks an existing human gate, not a validation failure"；`:42` 增 `reviewPassed:'VERIFY_REVIEW_PASSED'`、`:179` 成功分支输出该键。补测：`test/wp15/wiring.test.js:351-386` 新增"configured human path passes; missing human gate still fails"，`:357` 注入 `{ok:true,needsHumanReview:true,blocked:false}` → `:360-367` 断言 exit 0 + `lines[0]===labels.VERIFY_REVIEW_PASSED`；`:374-385` 缺终审 stub → exit≠0 + `HIGH_RISK_MISSING_REVIEW`（真实行为断言，非软断言）。实跑真实模块（未注入 stub，加载 `governance.js:302`）：`withHumanPath` raw `{"ok":true,"needsHumanReview":true,"blocked":false}` → **exit 0 / ["校验通过"]**；`missingHumanPath` raw `{"ok":false,"blocked":true,"reason":"missing_human_gate"}` → **exit 1 / [HIGH_RISK_MISSING_REVIEW 文案]**。原文依据 `requirement.md:328` AC-07 Then「补上 human 节点或升级路径后，校验通过」。 |
| N-02（P3 建议） | 四门禁空 `catch {}` 包住"load + 判定 + 落盘"整段，拒绝落盘抛错被吞后 fail-open | **已闭合** | 四处 `try` 均收窄到仅 `loadCapability`：`orchestrator.js:1882-1887`（并行度）、`:3357-3362`（终审）、`:3465-3470`（预算）、`:4779-4784`（唤醒）；catch 后 `if (budget/governance)` 内 verdict 消费、`:1906-1913` `return{stop}`、`:3375-3387` emit+reviewDecision+stop、`:3481-3502` buildGovernanceRejection+escalateState+stop、`:4791-4833` buildGovernanceRejection+escalateState+emit+stop 均在 try 之外，异常向外传播。注释显式标注 N-02 意图（`:1879/:3354/:3462/:4775`）。全仓 grep 确认四门禁无包裹整段的空 catch；能力模块真实存在（`loadCapability` 可导入），正常路径不受影响。未引入新问题。 |

## ③ 六维全量回归重扫表

| 维度 | 判定 | 证据（本轮实跑/实读） |
|---|---|---|
| ① 提交范围与授权 | **PASS** | `git status --short`：4 M（labels/main/escalation/orchestrator）＋3 ??（verify/regression/wiring）＝7 个 WP-7 产物；`M decisions.md` 为裁决 D 授权同步；`M test/wp2/labels.test.js` diff 仅 2 处（加 `wake.not-whitelisted` 可枚举键、48→49），与裁决 D 第 3 条逐字吻合。无其它 WP / `evidence/**` / `probe/**` / `test/templates/**` / I1.11 文件卷入。`git diff --check HEAD` exit 0（仅 LF→CRLF 的 autocrlf 提示，非空白错误）。 |
| ② D-13 命令表 / help / flags | **PASS** | `main.js:194-201` FAMILY_MODULES 逐字追加 verify/migrate/export；`:208-215` RUNTIME_COMMANDS 追加三顶层命令；`:217-226` RUNTIME_SUBS 中 `workflow:['pause','resume','abort']` 冻结、`verify:['import','review']`；`:227-235` `package`/`yes` 仅 BOOLEAN、VALUE 表无 `version`。`--help` 实跑 31 行、exit 2：前 25 行与 `USAGE_LINES` 逐字一致，后 6 行为 verify/migrate/export 独立块（`wiring.test.js:118/131/134-147` deepEqual 全绿）。 |
| ③ AC Then 强度 / 四门禁 / 逐字基线 | **PASS** | 四门禁 verdict→控制流真实生效、无 `void`（见 N-02 行号）；`transit(`=6 且 `async function transit(` 唯一（`orchestrator.js:809`）；`buildGovernanceRejection` 在 `:3484/:4804` 被真实调用、`escalation.js:367` 有定义。逐字基线：`USAGE_LINES` 25 行、`wake.rejected` 值、既有 REASON_LABEL 键、三主链登记（`regression.test.js:141-158`）均未变。上轮唯一 FAIL 点 N-01 已闭合（见 ②）。 |
| ④ 中文唯一来源与 A-0~A-7 逐字 | **PASS** | 新增中文全部集中在 `labels.js`（`I112_VOCAB:896`、`CHAIN/A-3~A-7:923-979`、`VERIFY_REVIEW_PASSED:982`、`USAGE_LINES_I112:996`）。`wiring.test.js:166-225` 运行时从 `requirement.md` 解析 A-0 24 词 + A-1~A-7 逐行 deepEqual，实跑全绿；`:573` 与 `regression` 断言 `verify.js`/两测试零 CJK、零 `\u`。本轮实测 `grep -cP`：`verify.js` 0 CJK、`wiring.test.js` 0、`regression.test.js` 0，`verify.js` 无 `\u` 转义。purity 双目录 31 词 exit 0。 |
| ⑤ 测试软断言 / 假绿 | **PASS（本轮无新增放宽）** | 上轮 advisory 假绿已清除；四门禁为行为+结构断言（`wiring.test.js:392-424`）；verify 四目标用冻结签名 stub 注入（拆分 §4 WP-7 允许只校接线形状），N-01 补测为真实 exit/输出断言。`labels.test.js` 两处改动是裁决 D 授权的精确同步（加键、48→49），非功能断言放宽；USAGE 断言未放宽（仍 25 行 + 逐行 deepEqual）；`regression.test.js` 保持 1425 下限与 `judgeRun` 差集口径（D-5），未放宽 AC-22。 |
| ⑥ purity 双目录 / 零依赖 / diff-check | **PASS** | 31 词 `--forbid` 原文取自 `requirement.md:495` AC-22（本轮实测 `WORD_COUNT=31`，与 D-12 完全一致）；`purity-check.mjs --dirs src/core,src/daemon` 扫 38 文件 exit 0、`--dirs desktop/ui,desktop/harness` 扫 31 文件 exit 0；`node -p deps.length` = 0；`git diff --check HEAD` exit 0。 |

## ④ 新发现清单

无。上轮 N-01 / N-02 均已闭合，六维重扫未发现新的 advisory `void`、新中文硬编码、新越权文件或新断言放宽。

## ⑤ 实跑命令输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `NODE_ENV=test node --test <6 文件>` | `tests 83 / pass 83 / fail 0 / skipped 0`，exit 0（上轮 82，新增 N-01 补测 1 条）。 |
| 2 | `node bin/orch.js --help` | 31 行、exit 2；前 25 行冻结 USAGE 逐字，后 6 行新块。 |
| 3 | `node purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | `OK: 扫描 38 个文件 … 零命中`，exit 0。 |
| 4 | `node purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>` | `OK: 扫描 31 个文件 … 零命中`，exit 0。 |
| 5 | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` | `0`。 |
| 6 | `git diff --check HEAD` | exit 0（仅 autocrlf 提示，无空白错误）。 |
| 7 | `grep -REn "transit\(" src/core \| wc -l` | `6`。 |
| 8 | advisory void 扫描 / CJK 扫描 | `NO_ADVISORY_VOID`；`verify.js`/两测试 0 CJK、`verify.js` 0 `\u`。 |
| 9 | 真实模块抽查 `verifyCommand({sub:'review'})` + `validateHighRiskReview`（未注入 stub） | 已配终审：raw `{ok:true,needsHumanReview:true,blocked:false}` → exit 0 / `校验通过`（=VERIFY_REVIEW_PASSED）；缺终审：raw `{ok:false,blocked:true}` → exit 1 / `校验未通过`（=HIGH_RISK_MISSING_REVIEW）。 |

> 未跑全量测试（`node --test "test/**/*.test.js"`）；AC-22 全量与三主链逐字比对按裁决 D-5 属 S3 取证、S4 复核，不在本轮 WP-7 评审范围，不计为 WP-7 FAIL。
