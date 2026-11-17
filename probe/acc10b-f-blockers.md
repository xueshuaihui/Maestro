# I1.10b S3 批次 a 验收 · 缺陷与阻塞台账

> 范围：AC-01~AC-15；判据来源 `docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC + 附录 A-0~A-4。
> 三档：`通过` / `不通过`（附冲突原始帧）/ `阻塞`（写明要求/试过路径/为何观测不到）。本批观测级均为 `mock 实测`。

## 1. 产品缺陷（不通过）

**无。** 15 条 AC 的机检 F-16（先 `test -f` 再 `node --test`，`# pass ≥ 1`、`# fail 0`）与需求原文架构检查（`grep -REn` / ERE）全部成立；Then/附录 A 逐字字面量全部由机检源码承载并经机检通过验证。

## 2. 阻塞项（观测不到）

**无。** 本批 AC-01~AC-15 均为纯投影 + mock 面（无真实宿主；真实宿主面 AC-25/33 不在本批），Given 现场可由 `createApp` / `createDrillView` / `buildCards` / `buildNodeDetail` / `buildDag` 等真实模块在 `NODE_ENV=test` 下构造，未出现「需求要求的行为无法在夹具上观测」的情形，也未触发 90s 超时。

## 3. 验收脚手架自身的修订（非产品缺陷，不计入判定）

取证过程中发现并修正了 3 处**用例脚本**逐字字面量/命令写法问题，均与产品代码无关，修正后重跑全绿：

| # | 位置 | 现象 | 根因 | 处置 |
|---|---|---|---|---|
| 1 | `acc10b-cases/ac01.mjs` | AC-01 初跑 20/21 | 逐字字面量 `'最近 T-002 · 轮次 2/3'` 与源码实际片段 `'最近 T-002 · 轮次 2/3 · '`（后接文案键）不匹配 | 按源码真实片段改写字面量（保留 ` · ` 尾随分隔符），重跑 21/21 |
| 2 | `acc10b-cases/ac04.mjs` | AC-04 初跑 18/19 | 同上，`'最近 T-010'` 与源码 `'最近 T-010 · 轮次 1/1 · '` 不匹配 | 同上改写，重跑 19/19 |
| 3 | `acc10b-f-lib.mjs::grepCheck` | AC-03 架构检查初跑 `exit=2 hits=0` | 多目标 `desktop/ui desktop/harness` 被 `JSON.stringify` 当作单一路径参数 | 按空白切分目标为多个 `grep` 参数；重跑 AC-03 架构检查 `exit=1 hits=0`（零命中，符合期望）11/11 |

> 处置纪律：以上均为「为了让断言真正对齐需求 Then/原文命令」的修正，不是放宽断言；产品代码、`test/**`、需求、拆分均未改动。

## 4. 判定数字一致性

| 项 | 值 |
|---|---|
| AC 总数 | 15 |
| 通过 / 不通过 / 阻塞 | 15 / 0 / 0 |
| 核对项总数 | 209（21+20+11+19+14+10+12+11+15+14+16+13+9+11+13，209/209 通过） |
| 证据文件数 | 120（每 AC 8 份：tests.stdout / test.source / arch.stdout / state / events / corestop / meta / status） |
| results.jsonl | 每条 AC 一行，取最后一条；summary.json 由 final 从 results + parts 重建 |
| 报告 | `docs/iterations/iteration-10b/acceptance-a.md` |

---

# 批次 c（AC-31~AC-45，除 AC-33）追加台账

> 范围：AC-31~AC-45 除 AC-33；判据来源 `requirement.md` v6.1 §3.1 同号 AC + 附录 A-0~A-10 + 裁决 G/H/J。
> 14 条：通过 14 / 不通过 0 / 阻塞 0（AC-34 经裁决 K 补帧、AC-37 经裁决 J F4-05 补齐 `lastAction.stateSince` 后复验，分别由「不通过」改判为「通过」，原判痕迹见 C-1.1 / C-1.2）。观测级均为 `mock 实测`；AC-33 真实宿主面留批 e。

## C-1. 产品缺陷 / 判定冲突（不通过）

### C-1.1 AC-34 — 原判差集 ≠ 0（裁决 G）；裁决 K 补帧复判为**通过**

> **复判结论（2026-11-17，裁决 K）**：AC-34 由「不通过」改判为**通过**。允许集合按裁决 G 的目的性口径 = win32 16 条登记项 ∪ S0 开工基线已观测到的既有红（须有本次基线帧）∪ 文件级隔离复跑通过并留帧的 flake；`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过` 与 `AC-04：空态…` 在干净 HEAD `818576f^`（`18438d6`，S0/S1 基线，无 I1.10b 实现）上**同样红**，属既有红、不算新增红 ⇒ `observedFail 15 ∖ allowed 18 = 0`。未放宽任何断言、未改 AC Then；`tests 1524 ≥ 1425` 仍成立。
>
> **两类原始帧（缺一不可，均已补齐）**：
> ① 干净 HEAD 基线帧（`git worktree add --detach` 于 `%TEMP%/maestro-ac34-baseline-818576f-parent` 只读隔离复跑）：`evidence/flake-frames/baseline-HEAD-handoff-schema-20261117-013949.log`（exit 1，`not ok 12 HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`，`#tests 37/#pass 34/#fail 3`，EPERM symlink）；`evidence/flake-frames/baseline-HEAD-instance-list-20261117-013949.log`（exit 1，`not ok 2 AC-04：空态…`，`#tests 2/#pass 1/#fail 1`，期望 `running` 实得 `completed`）。
> ② 本工作树文件级隔离复跑帧（4 帧，均仍红）：`flake-frames/handoff-schema-20261117-013251.log`、`handoff-schema-confirm-20261117-013259.log`、`instance-list-20261117-013251.log`、`instance-list-confirm-20261117-013259.log`。
> ③ 全量 TAP 帧 `evidence/AC-34.fullrun.tap.txt` 复核：`#tests 1524 / #pass 1500 / #fail 15 / #skipped 9`（≥ 1425 ✓）；差集成员复核见 `evidence/AC-34.diffset.txt`，确为上述两条。
>
> 下列「实测原始帧 / 判定 / 口径冲突」为原裁决 G 口径下的历史判定记录，已被本复判取代，保留以供主控独立复核干净 HEAD TAP。


- **需求要求**（requirement.md:805-810）：`tests ≥ 1425`（只增不减）+ 失败集合与允许集合**差集 = 0**；允许集合 = win32 16 条登记项 ∪ 本迭代实跑观测到且**文件级隔离复跑通过并留帧**的 flake；新红一律独占复跑，通过记 flake、仍失败判红。逐文件按点名清单 36 个（仅核清单完整）逐个记录 `# fail`，集合外必须 `# fail 0`。
- **实测原始帧**：
  - 全量 TAP：`evidence/AC-34.fullrun.tap.txt`（`tests 1524 / pass 1500 / fail 15 / skipped 9`，`--test-concurrency=1 --test-timeout=120000 --test-force-exit`，2026-11-17）——取数项 ✓（≥1425）。
  - `evidence/AC-34.diffset.txt`：observedFail 15 条，∖ allowed 16 条 = **差集 2**：`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`、`AC-04：空态、不可读行不阻断、新实例 2 秒内…F-18 脉冲后 2 秒内更新`。
  - 独占复核帧（各 2 次，共 4 帧，均**仍失败**）：`flake-frames/handoff-schema-20261117-013251.log`、`handoff-schema-confirm-20261117-013259.log`（`not ok 12 HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`）；`flake-frames/instance-list-20261117-013251.log`、`instance-list-confirm-20261117-013259.log`（`not ok 2 AC-04：空态…`）。
- **判定**：差集 = 2 ≠ 0；两条新红不在 win32 16 条登记项内、也不在历史基线内，两次独占复跑均仍红（非 flake）→ 按裁决 G 第 3 条「确认失败照旧判红」，AC-34 不通过。机检静态面（regression-drill.test.js 8/8）、三主链/两种格式/USAGE_LINES=25/命令表/零依赖/31 词表均通过，唯一失败点是全量差集。
- **需注意的口径冲突**：`test/wp14/regression-drill.test.js:6-7` 注释把 `AC-04 / HANDOFF_EVIDENCE_ESCAPE` 列为允许集合成员，但需求 Then（805 行）与裁决 G 定义的允许集合仅含 win32 16 条 ∪ 隔离复跑通过的 flake。按铁律 1「需求是唯一验收依据」，以需求为准——两条既非 16 条成员、又未通过隔离复跑，故判红。此项需主控裁决：是否属「需求允许集合定义与实现侧注释不一致」的待评审项，或确为回归缺陷需修复 `HANDOFF_EVIDENCE_ESCAPE` 符号链接判定与 `instance-list` 的 AC-04 推送时序。
- **程序化留痕**：独占复核首跑 `/tmp` 帧因 Node 原生进程读不到 Git-Bash `/tmp` 路径导致首版用例误读 `tests=0`（差集假通过），已将全量 TAP 落盘仓库内 `evidence/AC-34.fullrun.tap.txt` 并把用例路径改指仓库内后重跑，修正后 11/14（三条失败项如实判红）。此为取证脚本路径修正，非放宽断言。

### C-1.2 AC-37 — 原判 lastAction 机检字段缺 stateSince（裁决 J F4-05 补齐后复验为**通过**）

> **复判结论（2026-11-16，裁决 J F4-05 补齐后）**：AC-37 由「不通过」改判为**通过**（17/17）。测试侧按裁决 J F4-05 把 `test/wp14/drill-errors.test.js` 的 `lastAction` 夹具（`:87`）与 `assert.deepEqual` 断言（`:114`）均补齐为 5 字段对象、含逐字 `stateSince='2026-11-15T10:04:00.000Z'`（5 字段夹具 + 逐字段断言，未放宽断言、未改 AC Then）。重跑 `node probe/acc10b-f-run.mjs AC-37` 得 17/17 全过，机检逐字第 17 条逐字成立，`requirement.md:843` 的 5 字段 `lastAction` 机检原文被测试源码逐字承载；用户可见 Then（状态栏逐字行、卡片两张、`statusReason=unknown-role` 透传）未放宽，`mock 实测` 证据分级与三档判据照旧。
>
> 原判原始帧（8 份，含 4 字段 `lastAction` 的 `AC-37.test.source.txt` 与 `AC-37.tests.stdout.txt`）留痕于 `evidence/_archive_AC-37_pre-reverify_20261116T175504Z/`；复验后新帧覆盖 `evidence/AC-37.*`。本 Agent 只写验收产物，未改产品代码/测试/需求/拆分（夹具补齐由主控执行）。下列「需求要求 / 实测原始帧 / 判定」为原判历史记录，已被本复判取代。

- **需求要求**（原判留痕；requirement.md:843 机检 + 裁决 J / 变更记录 F4-05）：`roleBar.lastAction` 为五字段对象 `{nodeId:'T-021', round:1, maxRounds:1, state:'running', stateSince:'2026-11-15T10:04:00.000Z'}`；F4-05 明确「AC-37 lastAction 期望对象补齐 stateSince，三处夹具同步按 ISO 写入」。
- **实测原始帧**（原判留痕）：`test/wp14/drill-errors.test.js:87` 夹具 lastAction 与 `:114` `assert.deepEqual` 对象均只有 4 字段（无 `stateSince`）；`2026-11-15T10:04:00.000Z` 在 `test/wp14/` 全域零命中。机检 F-16（drill-errors.test.js 5/5）通过、用户可见 Then（状态栏逐字行、卡片两张、`statusReason==='unknown-role'`）全部成立，共 16/17。
- **判定**（原判留痕，已被上方复判取代）：机检逐字段断言与需求冲突（缺 `stateSince`），按「只认需求 Then/机检逐字、不放宽断言」判该核对项不通过 → AC-37 不通过。原始帧见 `evidence/_archive_AC-37_pre-reverify_20261116T175504Z/AC-37.test.source.txt`、`AC-37.tests.stdout.txt`。原判确认为测试夹具/断言遗漏（应补 stateSince）而非产品行为缺陷——产品投影 `src/registry/role-instances.js` 的 lastAction 含 `stateSince`，是测试用例未覆盖该字段；补齐后复验通过。

## C-2. 阻塞项（观测不到）

**无。** 本批 14 条均为纯投影机检面 / mock 面 + 仓库静态全量面，Given 现场可由 `createApp` / `createDrillView` / `buildCards` / `buildDag` / `buildSubflow` / `buildHandoffPanel` / `buildEscalationPanel` 等真实模块在 `NODE_ENV=test` 下构造，未触发 90s 超时（单条最长 AC-34 全量约 17s）。AC-33 真实宿主面按任务留批 e，未纳入本批、不计阻塞。

## C-3. 判定数字一致性（批次 c）

| 项 | 值 |
|---|---|
| AC 总数 | 14（AC-31~45 除 AC-33） |
| 通过 / 不通过 / 阻塞 | 14 / 0 / 0 |
| 核对项总数 | 187（ok 187 / 不通过 0；AC-37 补齐 `lastAction.stateSince` 后第 17 条复验成立、16→17；AC-34 三条经裁决 K 复判成立，见 summary-c.json perAc） |
| 证据文件数 | 本批相关 117（含 AC-34 全量 TAP、4 帧独占复核帧与 2 帧干净 HEAD 基线帧；AC-37 复验原判 8 帧另存 `_archive_AC-37_pre-reverify_20261116T175504Z/` 子目录，不计入 117） |
| results.jsonl | AC-31~45（除33）各一条，取最后一条；AC-34 因路径修正重跑过、又经裁决 K 复判取最后一条 14/14；AC-37 补齐 stateSince 后重跑取最后一条 17/17 通过 |
| 报告 | `docs/iterations/iteration-10b/acceptance-c.md`；汇总 `probe/acc10b-f-summary-c.json` |

---

# 批次 d（AC-46~AC-51）追加台账

> 范围：AC-46~AC-51；判据来源 `requirement.md` v6.1 §3.1 同号 AC + 附录 A-0~A-10 + 裁决 A/I/J/K/L。
> 6 条：通过 6 / 不通过 0 / 阻塞 0（AC-51 经裁决 L 复判为通过 18/18）。观测级均为 `mock 实测`；独立 `%TEMP%` 根 + `NODE_ENV=test` + mock 宿主；90s 超时记阻塞（本批无超时，单条最长 0.7s）。

## D-1. 产品缺陷 / 判定冲突（不通过）

### D-1.1 AC-51 — 裁决 L 复判 18/18 通过（原机检 API 字面代理过严已修正）

> **复判结论（2026-11-16，裁决 L）**：AC-51 由历史 **17/18 不通过**改判为 **18/18 通过**。按 `decisions.md` 裁决 L，机检要求的是「断言语义」（三次 view 落点 + 不等于升级面板 / 下钻），不是某个 `node:assert` API 的字面拼写；验收脚本的 API 字面代理不得优先于需求 Then。已将 `probe/acc10b-cases/ac51.mjs` 该项代理由 `src.includes("assert.notEqual") && src.includes("'escalation-panel'")` 改为 `assertsViewNot()` **语义等价检测**：接受 `assert.notEqual(x, 'LIT')` 或 `assert.ok(x !== 'LIT')`，要求断言右侧字面量确为 `'escalation-panel'` / `'drill'`，核完整断言结构、不恒真、不删项、不放宽 Then。重跑 `node probe/acc10b-f-run.mjs AC-51` 得 **18/18 通过**；第 15 项命中 `connection-panel.test.js:189` `assert.ok(st.view !== 'escalation-panel')`，第 16 项命中 `:190` `assert.ok(st.view !== 'drill')`。只改验收用例代理，未改产品代码 / `test/**` / 需求 / 拆分。17/18 旧 8 帧留痕 `evidence/_archive_AC-51_pre-L-reverify_20261116T225104Z/`，当前帧覆盖 `evidence/AC-51.*`。下列「需求要求 / 复验实测原始帧 / 判定」为历史 17/18 认定记录，已被本复判取代，保留供核对。

- **需求要求**（requirement.md:996-998）：Then「三次都打开同一个交接包面板……任何一次都不进入升级处理面板、也不进入角色下钻；三次点击都不改变任何编排状态」；机检明文「断言三次 `view === 'connection-panel'`、`view !== 'escalation-panel'`、`view !== 'drill'`、聚合词依次已拒绝/已过期/已投递、红/橙两次行内含拒绝/过期原因词」，夹具 `stateHashBefore === stateHashAfter`。
- **复验实测原始帧**：
  - 机检 F-16 通过：`connection-panel.test.js` `# tests 6 / # pass 6 / # fail 0`（`evidence/AC-51.tests.stdout.txt`）。
  - view 级三点击用例（`evidence/AC-51.test.source.txt`，`connection-panel.test.js:143-202`）：逐字断言 `st.view === 'connection-panel'`（:188）、`st.view !== 'escalation-panel'`（:189）、`st.view !== 'drill'`（:190）（红/橙/delivered 三次循环内各执行一遍）、`stateHashBefore === stateHashAfter`（:200）、`appSource.includes("action === 'open-connection'")`（:167）。
  - 产品路由（`app.js:1949`）：`action === 'open-connection'` → `app.openConnectionPanel(arg)`（`openConnectionPanel` 定义于 :628，置 `state.view='connection-panel'`）。
  - 历史唯一失败项（已被裁决 L 修正）：验收用例 `ac51.mjs:30-32` 以 `src.includes("assert.notEqual") && src.includes("'escalation-panel'")` 检测「view !== 'escalation-panel'」；产品用语义等价 `assert.ok(st.view !== 'escalation-panel')`（:189），`'escalation-panel'` 出现 2 次但无 `assert.notEqual` 字面 → 该项曾 ❌（17/18）。
- **裁决 L 复跑原始帧（当前）**：`node probe/acc10b-f-run.mjs AC-51` → **18/18 通过**；机检第 15 项经 `assertsViewNot()` 命中 `connection-panel.test.js:189` `assert.ok(st.view !== 'escalation-panel')`，第 16 项命中 `:190` `assert.ok(st.view !== 'drill')`，第 17 项 stateHash、第 18 项 open-connection 路由等其余 16 项维持通过。当前帧 `evidence/AC-51.test.source.txt`、`evidence/AC-51.tests.stdout.txt`、`probe/acc10b-f-parts/AC-51.md`。
- **判定**：18/18 通过（裁决 L 复判，取代历史 17/18 不通过）。产品 Then（落点三态 + 不改状态 + 路由）全部满足；历史唯一未成立项系机检把 `assert.notEqual` 当作唯一合法 API 的字面代理过严，已按裁决 L 改为语义等价检测（不恒真、不删项、不放宽 Then），未改产品代码 / `test/**` / 需求 / 拆分。
- **归属**：验收机检写法问题（非产品缺陷，已修正）——`buildHandoffPanel` 无 escalation 引用、target 恒为 connection-panel，BR-43 模块侧改道与 app 视图层落点均已成立。

### D-1.2 AC-46 — 复验 17/17 通过（原风险项已消除，非缺陷）

> **复验结论（2026-11-16）**：AC-46 维持 **17/17 通过**。原批次 d 记录的口径风险——「host-jump.js 把 `code:'DSH_SPAWN_FAILED'` 一律映射为 DRILL_HOST_MISSING（'未找到 DeepSeek Harness'），真实非 ENOENT 失败的 Then『跳转失败 · <原因>』在真实路径上无依据」——已由实现修复消除。
- **复验实测**：`desktop/ui/drill/host-jump.js:73-97` 对 `code==='DSH_SPAWN_FAILED'` 按 `DRILL_HOST_FAILED` 模板前缀区分：`message:'未找到 DeepSeek Harness'` → `DRILL_HOST_MISSING`（AC-26 第三降级）、`message` 以 `跳转失败 · ` 前缀开头 → `DRILL_HOST_FAILED` 并剥离原因（`src/adapter/host-open.js:60-63` 产出该前缀）。`test/wp14/host-jump.test.js:293-328` 新增真实形状用例：`code:'DSH_SPAWN_FAILED'` + `message:'跳转失败 · 权限被拒'` → toast 逐字 `跳转失败 · 权限被拒`、`button.enabled===true`、`jumpCalls===0`、`missingLabels` 为空；AC-26 三降级（:180-219）未退化。机检 F-16 6/6，核对项 17/17。原始帧 `evidence/AC-46.test.source.txt`、`evidence/AC-46.tests.stdout.txt`；旧帧留痕 `evidence/_archive_AC-46_AC-51_pre-reverify_20261116T180507Z/`。

## D-2. 阻塞项（观测不到）

**无。** AC-46~AC-50 的 Given 现场均可由 `buildHostJump` / `createApp` / `createDrillView` 等真实模块在 `NODE_ENV=test` 下构造；真实宿主进程、真实断开重连时序属裁决 B 的人工核验面（不计阻塞、不计自动通过）。本批无 90s 超时。

## D-3. 判定数字一致性（批次 d）

| 项 | 值 |
|---|---|
| AC 总数 | 6（AC-46~AC-51） |
| 通过 / 不通过 / 阻塞 | 6 / 0 / 0 |
| 核对项总数 | 107（17+15+17+17+23+18；ok 107 / 不通过 0）。历史：2026-11-16 两处实现修复后 AC-51 由 13/18 → 17/18，AC-46 维持 17/17；按裁决 L 仅修验收机检代理后 AC-51 复跑 18/18（+1 项成立），本批全绿。 |
| 证据文件数 | 48（每 AC 8 份：tests.stdout / test.source / arch.stdout / corestop / state / events / meta / status，无空文件）。AC-46/51 复验新帧覆盖旧帧；历史 17/18 旧帧 8 份留痕 `evidence/_archive_AC-51_pre-L-reverify_20261116T225104Z/`，更早 16 份留痕 `evidence/_archive_AC-46_AC-51_pre-reverify_20261116T180507Z/`。 |
| results.jsonl | AC-46~51 各一条，同 AC 取最后一条；AC-51 取最后一条 18/18 通过（`2026-11-16T22:51:05Z`），AC-46 取最后一条 17/17 通过。 |
| 报告 / 汇总 | `docs/iterations/iteration-10b/acceptance-d.md`；`probe/acc10b-f-summary-d.json` |
| 复验结论 | AC-46、AC-51 已于 2026-11-16 独立复跑并更新产物（详见 acceptance-d.md §5）：AC-46 通过 17/17、AC-51 经裁决 L 复判通过 18/18；批次 d 最终 6/6 全通过。 |

---

# 批次 e（AC-25 / AC-33，真实宿主面 C 类）追加台账

> 范围：AC-25 / AC-33；判据来源 `requirement.md` v6.1 §3.1 同号 AC + 裁决 A / I / J-3 / B。
> 2 条：通过 2 / 不通过 0 / 阻塞 0。自动面证据分级＝`真实宿主实测（进程）+ mock 实测（机检）`；窗口前置 / 剪贴板内容 / 窗口内提示可见性＝`人工核验`（按裁决 B，不计入自动通过数、不计阻塞）。

## E-1. 产品缺陷 / 判定冲突（不通过）

**无。** AC-25 自动面 18/18、AC-33 自动面 14/14 全部成立：DSH 真实进程 0→1（AC-25 PID 11508，AC-33 PID 35104）、停留 10s 进程恒 0、两次点击去重 `sameObjectReused=true`、机检 `test/wp14/host-jump.test.js` 6/6、架构检查三条全符合期望。机检 F-16 逐字断言（同源 id / J-1 `button.label` / 三态翻转 / `autoSpawn=0` / `jumpCalls=1` / `toasts=1`）全部由机检源码承载并通过。

## E-2. 阻塞项（观测不到）

**无。** DSH 本体在本机真实存在（`0.2.2-rc.1`，`%LOCALAPPDATA%\Programs\DeepSeek Harness\DeepSeek Harness.exe`，246,341,104 B），真实进程被成功拉起；未触发 90s 超时。不存在「需求要求行为在真实面观测不到」的情形。窗口前置 / 剪贴板实际内容 / 窗口内提示可见性按裁决 B 与需求归为人工核验项（非阻塞），已在 acceptance-e.md §1.2 / §2.2 单列。

## E-3. 需注意的取证事实（非阻塞、非缺陷）

| 事实 | 取证 | 处置 |
|---|---|---|
| 进程短命：点击后 +0/+250ms 进程=1，`+1000ms` 归零 | `AC-25.live-t{0,250,1000,3000}ms.process.json`、`AC-33.live-t{0,250,1000}ms.process.json` | Then「3 秒内进程存在」由 +0/+250ms 帧满足；归零系 `host-open.js::launchOpen` 的 `detached + stdio:ignore + unref`（D-4「不等待、不轮询」）下的 ACP 短命进程行为，非唤起失败。如实留帧、不夸大 |
| 需求指定夹具路径 `%TEMP%/maestro-i10b-jump/.orch/instances/INST-001/state.json` 本机不存在；真实实例 `sessions[]` 为 mock-sess-* 或空 | 本机 `%TEMP%` 扫描 + `probe/acc10b-cases/` 无 ac25/ac33 用例（按规则留批 e） | 判据②同源断言由机检夹具（SESS-A/B/C 真实 UUID 形态、maxBy 派生）承担；真实面入参从 `~/.dsh/sessions` 真实目录派生，校验器不硬编码。符合裁决 I「标识 == state.sessions[].sessionId」 |
| C1「目录同名 = sessionId」本机 8/8 一致 | `AC-25.session-dir.txt`；裁决 J-3 | 按裁决 I 仅作 D-14 表 C1 事实补注，不回填 AC-25/33 判据、不改判定强度；报告不据此声称「打开对应会话」 |

## E-4. 判定数字一致性（批次 e）

| 项 | 值 |
|---|---|
| AC 总数 | 2（AC-25 / AC-33） |
| 通过 / 不通过 / 阻塞 | 2 / 0 / 0 |
| 核对项总数 | 32（AC-25 18 + AC-33 14；ok 32 / 不通过 0 / 阻塞 0） |
| 证据文件数 | 20 份唯一帧（AC-25 10 + AC-33 8 + 共用机检 2，无空文件）；每 AC ≥4（25=12 引用、33=10 引用） |
| results.jsonl | AC-25 / AC-33 各追加一条、置于末尾；原无此二条（b/c 按规则跳过），同 AC 取最后一条 |
| 报告 / 汇总 | `docs/iterations/iteration-10b/acceptance-e.md`；`probe/acc10b-f-summary-e.json`；分节 `probe/acc10b-f-parts/AC-25.md`、`AC-33.md` |
| 人工核验项 | AC-25：窗口前置、剪贴板内容；AC-33：窗口内提示可见性（均不计入自动通过数，见 acceptance-e.md §6 建议） |
| 受控脚手架 | `probe/acc10b-e-live-probe.mjs`（真实 openHost 触发 + 只读观测 + 仅清理新增进程）、`probe/acc10b-e-final.mjs`（由帧构造判定产物）；均为验收产物，未改产品/测试/需求/拆分 |
