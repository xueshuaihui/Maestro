# I1.12 WP-7 第 2 轮评审二次小修复回执

> 角色：WP-7 二次小修复工程师（只修 `s2-review-wp7-round2.md` 新发现 N-01 / N-02）
> 基线：HEAD `fc384ef`；本轮仅改 `src/cli/verify.js`、`test/wp15/wiring.test.js`、`src/core/orchestrator.js` 与本回执。
> 未执行 `git add` / `commit`；未改 `main.js` / `labels.js` / `escalation.js` / `test/wp2/labels.test.js` / 能力模块 / 需求 / 拆分 / 裁决 / 上一轮评审与回执。

## 1. N-01（P2，阻断）—— 已闭合

- 修法：`src/cli/verify.js:177-178` 把 `verify review` 的通过条件从
  `result?.ok === true && result?.blocked !== true && result?.needsHumanReview !== true`
  改为 `result?.ok === true && result?.blocked !== true`，并以 ASCII 注释说明
  `needsHumanReview` 只是“下游已有人工终审路径”的正常标记、不是校验失败。
  依据 AC-07（`requirement.md:328-329`）：已配终审 `{ok:true,needsHumanReview:true,blocked:false}`
  应判通过并输出 `VERIFY_REVIEW_PASSED`、退出码 0。
- 断言：`test/wp15/wiring.test.js:351` 新增真实契约断言
  `verify review: a configured human path passes; missing human gate still fails`：
  - 已配终审 stub `{ok:true,needsHumanReview:true,blocked:false}` → 退出码 `0`、输出
    `labels.VERIFY_REVIEW_PASSED`；
  - 缺终审 stub `blocked:true` → 退出码非 `0`、输出 `labels.HIGH_RISK_MISSING_REVIEW`。
- 真实模块抽查（`validateHighRiskReview` 注入，非 stub）：
  - 已配终审（T-004 highRisk → T-005 human）原始返回 `{"ok":true,"needsHumanReview":true,"blocked":false}`
    → `verify review` 退出码 `0`、输出 `校验通过`；
  - 缺终审（T-004 → T-006 task）原始返回 `{"ok":false,"needsHumanReview":true,"blocked":true}`
    → 退出码 `1`、输出 `校验未通过`。

## 2. N-02（P3，建议）—— 已闭合

- 修法：`src/core/orchestrator.js` 四处治理门禁的 `try/catch` 收窄为**只包住 `loadCapability`**；
  模块缺失时按裁决 D（D-1，`decisions.md:74`）保持契约兼容默认放行（`if (budget)` / `if (governance)`
  守卫内不执行任何新判定），但模块一旦加载，gate 判定、事件发射、`escalateState` 与
  `return {action:'stop'}` 等拒绝路径全部移到守卫内、不再被空 `catch {}` 吞掉，异常向外抛出。
  每处加 ASCII 英文注释说明收窄原因（`N-02: guard only the module load ...`）。
  - 并行度门禁（gate 3a）：N-02 注释 `orchestrator.js:1879`，`try` 仅 `loadCapability('budget')` 于 `:1883-1885`，
    `catch {}` `:1886-1887`，`if (budget)` 守卫 `:1888`；`return {ok:false,action:'stop'}` 在守卫内。
  - 终审门禁（gate 4）：注释 `:3354`，`try` 仅 `loadCapability('governance')` 于 `:3358-3360`，
    `catch {}` `:3361-3362`，`if (governance)` 守卫 `:3363`；`emit`+`reviewDecision`+`return {action:'stop'}` 在守卫内。
  - 预算门禁（gate 3b）：注释 `:3462`，`try` 仅 `loadCapability('budget')` 于 `:3466-3468`，
    `catch {}` `:3469-3470`，`if (budget)` 守卫 `:3471`；`buildGovernanceRejection`+`escalateState`+`return {action:'stop'}` 在守卫内。
  - 唤醒门禁（gate 1）：注释 `:4775`，`try` 仅 `loadCapability('governance')` 于 `:4780-4782`，
    `catch {}` `:4783-4784`，`if (governance)` 守卫 `:4785`；`escalateState`+`emit`+`return {ok:false}` 在守卫内。
- 不变量：显式配置场景的判定语义、事件形状、reason 码未改；写路径仍只走 `transit()` / 既有 `escalateState`；
  `transit(` 命中仍为 `6`（`async function transit(` 唯一）；四处 `catch` 注释保留原有逐字文本。
  收窄后 `loadCapability('escalation')`（预算/唤醒拒绝路径内）不再被兜底吞掉——模块缺失时异常向外抛出、
  不 fall-through 到派发，符合“拒绝路径异常必须向外抛出”的要求（比 D-1 的默认放行更严格，但仅发生在已判定需拒绝之后）。

## 3. 实跑命令与数字（全部 exit 0）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `NODE_ENV=test node --test test/wp15/wiring.test.js test/wp15/regression.test.js test/wp2/labels.test.js` | `tests 57 / pass 57 / fail 0 / skipped 0`，duration ~327ms；新增用例为第 20 条 `verify review: a configured human path passes; missing human gate still fails`。 |
| 2 | `git diff --check` | exit `0`，无空白错误。 |
| 3 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | `OK: 扫描 38 个文件 … 零命中`，exit `0`。 |
| 4 | `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>` | `OK: 扫描 31 个文件 … 零命中`，exit `0`。 |
| 5 | `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies\|\|{}).length)"` | `0`。 |
| 6 | `grep -REn "transit\(" src/core \| wc -l` | `6`。 |
| 7 | CJK / `\u` 扫描 `src/cli/verify.js`、`test/wp15/wiring.test.js` | `cjk=false uesc=false`（两文件均零 CJK 字面、零 `\u` 码点；由测试第 28 条断言守护）。 |
| 8 | 真实模块 `verifyCommand` 抽查（已配终审 / 缺终审两路） | 已配 → exit `0` + `校验通过`；缺终审 → exit `1` + `校验未通过`。 |

> 31 词 `--forbid` 原文取自 `requirement.md:495`（AC-22 机检），与 D-12 / `requirement.md:697` 完全一致、顺序未改。
> 未跑全量测试（`node --test "test/**/*.test.js"`），避免覆盖历史性能证据；AC-22 全量与三主链逐字比对按裁决 D-5 属 S3 取证 / S4 复核范围。

## 4. 未闭合项

无。N-01、N-02 均闭合，本轮未发现新越权、中文硬编码、断言放宽或 `transit(` 基线漂移。
若后续 S3/S4 复核要求对 N-02 的“拒绝路径异常外抛”补一条可注入的负向测试（module loaded 但 escalate/emit 抛错须外抛），
可按裁决 D-1 另开用例；本轮按最小修复范围未新增该负向测试，不影响两项的闭合判定。
