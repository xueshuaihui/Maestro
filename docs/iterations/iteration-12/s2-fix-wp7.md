# I1.12 WP-7 修复回执（S2 单线）

> 基线 HEAD=`fc384ef87109b10b6a0495e75dda835b8c3ab8e8`；不提交、不 `git add`。
> 依据：`docs/iterations/iteration-12/decisions.md` **裁决 D**（本次最高补充裁决）与 `s2-review-wp7.md` F-01~F-09。

## ① F-01~F-09 逐条闭合状态

| FAIL | 状态 | 依据 / 改动位置 |
|---|---|---|
| **F-01** 四处 `void <decision>` advisory no-op | **已修** | 裁决 D 第 1、2 条。`src/core/orchestrator.js`：① 新增可注入的顶层门禁判定辅助 `wakeGate` / `parallelismGate` / `budgetGate` / `reviewGate` / `classifyGovernanceEvent`；② `createOrchestrator` 增 `deps` 注入口与 `loadCapability()`（注入优先、否则 lazy import）；③ 四处门禁全部改为「判定 → verdict → 进入控制流」：唤醒拒绝走 `buildGovernanceRejection` + `escalateState` + 恰 1 条 `wake.not-whitelisted` 事件并返回 stop；证据过期从 `check.decision` 挂到 `handoff.freshnessDecision`（**删除第二次 freshness 调用**）；高风险 `blocked` / 未裁决均停住交接并记录 `handoff.reviewDecision`；并行超限保持 ready/queued 返回 stop、预算不足走 `escalateState` + `budget_exhausted` + `resumeRound` → `suspended`；④ `isPrimaryAuditEvent` 经 `classifyGovernanceEvent` 对新治理事件真实分类。写路径仍只经 `transit()` / `escalateState`，事件先落盘；无第三状态、无 failed 节点。 |
| **F-02** 测试把 `void` 哨兵写成通过条件（假绿） | **已修** | 裁决 D 第 1 条。`test/wp15/wiring.test.js`：删除 `void` 哨兵断言，改为「源码事实锚点 + 可注入 stub 的行为断言」，覆盖唤醒拒绝无投递/恰 1 事件、预算不足 suspended 无 failed、高风险 blocked 不推进、并行上限不超 2。 |
| **F-03** 拒绝构造与治理判定无消费出口 | **已修** | 裁决 D 第 2 条。`src/core/escalation.js::buildGovernanceRejection` 新增可选只读字段 `decision` / `resumeRound`（既有 D-6 形状不变量：未提供时不出现）；`orchestrator.js` 唤醒拒绝路径真实调用它，事件 detail 含来源/目标/原因/时间，升级记录携带 `governanceDecision`；过期判定挂 `handoff.freshnessDecision`、终审判定挂 `handoff.reviewDecision`，均不含 UI 字段。 |
| **F-04** 越界改动冻结的 `RUNTIME_SUBS.workflow` | **已修** | 裁决 D 第 4 条。`src/cli/main.js` 恢复 `workflow: ['pause', 'resume', 'abort']`；`test/wp15/wiring.test.js` 删除固化越界的断言，改为断言冻结映射。 |
| **F-05** `REASON_LABEL` 新键 non-enumerable | **已修** | 裁决 D 第 3 条。`src/cli/labels.js` 恢复单一 `export const REASON_LABEL = Object.freeze({...})`，`wake.not-whitelisted` 作为普通可枚举属性加入；`test/wp2/labels.test.js` 仅两处同步（枚举对象新增键值、length 48→49），其余 48 个既有键值逐字未动。 |
| **F-06** `USAGE_LINES_I112` 无消费方 | **已修** | 裁决 D 第 4 条。`src/cli/main.js` 只在 `!parsed.ok` 的 help/usage 输出路径加 `isHelpRequest()` 最小分支：`--help` 输出 `[...USAGE_LINES, ...USAGE_LINES_I112]`；`render.js` 未改，既有 25 行未改。 |
| **F-07** 回归测试暗示自己实跑全量/三主链 | **已修** | 裁决 D 第 5 条。`test/wp15/regression.test.js` 仅修正注释与定位：明确为结构性门禁，全量与三主链由 S3 取证 / S4 复核，`judgeRun` 供 S3 消费真实 summary；AC-22 断言与 1425 下限不放宽，未硬编码新增测试总数。 |
| **F-08** AC-19 无 CLI 查看载体 | **不修（非本包阻塞）** | 裁决 D 第 6 条：AC-19 由 `detectAntipatterns` 只读模块直调取证（S3 用例），冻结命令名不扩张、不新增 CLI 子命令。疑似位置见「④未闭合项」。 |
| **F-09** `package`/`yes` 重复登记 + `version` 死配置 | **已修** | 裁决 D 第 4 条。`src/cli/main.js::RUNTIME_VALUE_FLAGS` 删除 `package` / `yes` / `version`，仅保留 BOOLEAN；`verify.js` 未改。

## ② 新增 / 修改测试断言要点

- `test/wp15/wiring.test.js`
  - 命令表：三挂载逐字、`verify: ['import','review']`、`workflow` 冻结三子命令、BOOLEAN 仅含 `package`/`yes`、VALUE 不含 `package`/`yes`/`version`。
  - `--help` 实跑子进程：exit 2、输出恰 31 行；前 25 行 `deepEqual(labels.USAGE_LINES)`、后 6 行 `deepEqual(labels.USAGE_LINES_I112)`；verify/migrate/export 可见。
  - 门禁源码锚点：无 `void <decision>;` 哨兵；`validateEvidenceFreshness(` 调用数 0；`handoff.freshnessDecision` / `handoff.reviewDecision` 落点；`buildGovernanceRejection` 被唤醒路径调用；`classifyGovernanceEvent` + `governance.isPrimaryAuditEvent` 真实接线；`deps[key]` 注入与 `CAPABILITY_SPECIFIERS` 映射。
  - 可注入 stub 行为断言（不 require 能力包实现）：唤醒拒绝 → verdict 含 reasonCode/from/to/at 且恰 1 条可见拒绝事件；预算不足 → `budget_exhausted` + `resumeRound=4`、无 `failed` 字段、未显式配置不阻断；高风险 blocked → 停下游 + 节点定位 `T-004`，未裁决等待、有裁决放行；并行上限 2 → 3 个排队、无 `failed`、显式配置才生效。
  - `transit(` 命中仍为 6，`async function transit(` 仍为 1。
- `test/wp2/labels.test.js`：仅新增 `'wake.not-whitelisted': '越权唤醒被拒绝'` 一项、`Object.keys(REASON_LABEL).length` 48→49；其它断言未改。
- `test/wp15/regression.test.js`：仅注释表述修正，结构门禁 / purity 实跑 / deps 实跑 / `judgeRun` 语义断言保持。

## ③ 门禁实跑数字与输出摘要

| # | 命令 | 结果 |
|---|---|---|
| 1 | `NODE_ENV=test node --test test/wp15/wiring.test.js test/wp15/regression.test.js test/wp2/labels.test.js test/wp15/chain-verify.test.js test/wp15/governance-wake.test.js test/wp15/budget.test.js` | `tests 82 / pass 82 / fail 0 / skipped 0`，duration ≈ 372ms |
| 2 | `git diff --check` | exit 0，无空白错误 |
| 3 | purity `src/core,src/daemon`（31 词取自 `requirement.md` AC-22） | `OK: 扫描 38 个文件 … 零命中`，exit 0 |
| 4 | purity `desktop/ui,desktop/harness`（同 31 词） | `OK: 扫描 31 个文件 … 零命中`，exit 0 |
| 5 | `node -e "…dependencies…"` | 输出 `0` |
| 6 | `node bin/orch.js --help` | 共 **31 行**：前 25 行与 `USAGE_LINES` 逐字一致，后 6 行为 `USAGE_LINES_I112`；`orch verify <实例>/<包>`、`orch verify import/review`、`orch migrate`、`orch export` 全部可见 |
| 7 | `grep -REn "transit\(" src/core \| wc -l` | `6`（与冻结基线一致） |
| 8 | 额外冒烟（非全量）：`evidence-stale` + `governance-review` + `governance-granularity` + `boundary-i111` | `tests 33 / pass 33 / fail 0` |
| 9 | 额外冒烟（非全量）：`test/wp4/orchestrator.test.js` | `tests 37 / pass 37 / fail 0` |

> 按要求未跑全量测试，避免覆盖历史性能证据；全量由主控统一跑并恢复证据。

## ④ 未闭合项与疑似位置

1. **AC-19 / F-08（不修，裁决 D-6）**：无 CLI 查看载体，由 `detectAntipatterns` 模块直调取证。疑似位置：`src/core/antipattern.js`（只读信号）、S3 用例。影响 AC-19「可查看」证据形态，非本包阻塞。
2. **AC-21 真实宿主性能面（非 WP-7 范围）**：未取证，按 U-01 / 裁决 A-3 判 `阻塞`；疑似位置 `probe/acc12-perf.mjs`，S3 取证。
3. **AC-22 全量与三主链逐字比对**：本轮按裁决 D-5 未实跑，由 S3 取证、S4 复核；`regression.test.js` 只做结构门禁。疑似位置 `test/wp14/regression-drill.test.js`、`test/templates/**`。
4. **AC-08 人工裁决识别口径**：`hasHumanRuling()`（`src/core/orchestrator.js`）以 `nodeId` 匹配 `escalations[].resolution` / `approvals[].resolution` 判定是否已裁决；若人工裁决记录未带同一 `nodeId`，会被判为「未裁决」而继续等待（从严）。属保守口径，不影响「未裁决不推进」，但可能影响裁决后的放行时机；需 S3 用真实裁决夹具核对接缝。
5. **AC-09/AC-10 主审计分类**：`isPrimaryAuditEvent` 已真实接线，但只对**新增治理事件**写 `detail.primaryAudit`（node/handoff/health 类为 true，connection/role/session 不新增独立主审计事件）；I1.9 既有事件逐字基线未动。需 S3 在真实事件流上复核分类结果。

## ⑤ 改动文件清单

- 修改：`src/cli/main.js`、`src/cli/labels.js`、`src/core/orchestrator.js`、`src/core/escalation.js`、`test/wp15/wiring.test.js`、`test/wp15/regression.test.js`、`test/wp2/labels.test.js`
- 新增：`docs/iterations/iteration-12/s2-fix-wp7.md`（本文件）
- 未改：`src/cli/verify.js`（沿用既有未提交改动）、`docs/iterations/iteration-12/s2-review-wp7.md`（只读）、`requirement.md` / `iteration-12.md` / `decisions.md`（本次未写入）、`probe/**`、`evidence/**`、`test/templates/**`、`docs/iterations/iteration-4/**`、其它 `src/**` / `test/**`
- 未执行 `git add` / `git commit`
