# I1.8 终验报告（独立终验 Agent · 第 4 轮，窄口径）

- 终验时间：**2026-11-21T04:00+08:00**
- 被验证提交：**`6a711505b755cdf39a8301cefe9c8b864dc5a822`**（`docs(I1.8): 终验第 3 轮的 5 条可修项收口 + 第 2/3 轮终验存档`，父提交 `e5d8f18`，其上为上一轮被验证的 `9e7ef7e`）
- 被验证状态：**干净 HEAD**。开工 `git status --porcelain` **0 行**；本轮实跑全量 1 次、重生成 `probe/acc8-f-final.mjs` 1 次、单独复跑 `test/wp9/i19-orchestrator.test.js` 2 条用例 1 次；重生成前的 `_acc8-f-summary.json` / `_acc8-f-blockers.md` 已备份到 `%TEMP%\acc8-r4\`，比对后用 `git -c core.autocrlf=false checkout-index -f --` 还原；收尾 `git status --porcelain --untracked-files=all` **0 行**，HEAD 仍 `6a71150`。除本文件外未改动任何文件，未 `git commit`。
- 依据：`docs/templates/execution-template.md` §3.6（六项校验）/ §4.5（Done 七项）；`docs/iterations/iteration-8/requirement.md` v3 的 67 条 AC（唯一验收依据）；本轮实跑输出（不引用主控/验收 Agent 的输出）。
- 本轮复跑帧留档：`C:\Users\xuesh\AppData\Local\Temp\i18-full-suite.log`（全量原始 TAP）、`...\i19-orch-isolated.log`（2 条冻结断言单跑）、`...\acc8-r4\`（重生成前备份 `_acc8-f-summary.json` / `_acc8-f-blockers.md`、`regen.out`、`purity.log`）。索引见附录 A。
- 口径声明：本轮为**窄口径**——不重开第 3 轮已确认的结论，但所有数字**自己重算**，5 条声称逐条独立核实。

## 0. 总判定

**FAIL。** 67 条 AC 实为 **55 通过 / 10 不通过 / 2 阻塞**（我自行从 `evidence/acc8/_acc8-f-results.jsonl` 按 last-per-ac 重算，67 行、67 个 AC、0 重复），核对项 **714（通过 688 / 失败 26）**，被引用帧 **452 份**（**与文档写的 453 不符，见 §1 第 1 项**）。Done 七项 **2 PASS / 5 FAIL**（PASS：第 3、7 项；FAIL：第 1、2、4、5、6 项）。

主控声称收口的 5 条：**证实 2 条（#1、#5）、部分证实 3 条（#2、#3、#4）、不成立 0 条**。但 **#3 的收口动作本身制造了一处新的同源破坏**：为刷 AC-53 证据帧而重跑 AC-53 后，没有再次重生成 summary，`_acc8-f-summary.json` 的 AC-53 `evidenceCount` 停在 2、被引用帧合计停在 453，而 jsonl 已是 1 / 452——正是第 3 轮刚修好的那类「summary 与 jsonl 不同源」，只是换了个字段。**Done#6 因此从上一轮的 PASS 掉成 FAIL。**

另发现两处**此前的门禁看不见的真实失败**：`test/wp9/i19-orchestrator.test.js` 的两条 I1.9 冻结断言被 I1.8 改红（`newState` 顶层多出 `sessionPolicies`；会话发射点 13→14），但它们在基线红名单里，AC-53 的「失败集合差集」按**用例名**比对，因此 `EXTRA=0` 判绿——「同名不同因」被既有噪声豁免吃掉了（详见 §3、§5 第 7 项）。这两条是**我在全量日志里逐条比对失败原因**才发现的，不是文档自述。

**按 §4.5 与 §7 红线 11，不得宣布 I1.8 需求结束。**

## 1. 六项校验

| # | 校验项 | 判定 | 实跑命令与输出摘要 |
|---|---|---|---|
| 1 | 结果完整性 | **FAIL** | `_acc8-f-results.jsonl` 67 行 / 67 个 AC / 0 重复；我按 last-per-ac 重算 `{通过 55, 不通过 10, 阻塞 2}`；逐条累加 `checksTotal = 714`、`checksPassed = 688`、`checksFailed = 26`、`evidenceFiles` 合计 **452**（**不是文档里的 453**）。覆盖齐全成立，「全部通过」不成立。452 个被引用帧逐个 `fs.existsSync` = **0 缺失**。 |
| 2 | 证据支撑性 | **PASS（含 3 处已登记边界）** | 抽查 8 条（§2）：5 条完全支撑（AC-53/15/67/03/26）、2 条支撑但带已登记边界（AC-62 打印仍不可读、AC-58 双项目根）、1 条支撑但文案仍红（AC-45）。证据目录实盘 **539 文件、0 空文件**（`find -type f -empty` = 0）。 |
| 3 | 判定未被放宽 | **PASS（附 1 处机制盲区）** | `AC-53.mjs` 内无任何白名单/预置常量（`grep -Ei 'whitelist\|KNOWN\|FLAKE'` 只命中 4 处**否定性注释**，无名单字面量）；剔除只按运行时 `surviving` 走（`:103-121`），定位不到文件按 `stillRed:true` 保守计入。AC-15/62/67 的期望值与需求 Then 逐字一致（§3）。**盲区**：差集按用例名比对，同名不同因的真实失败会被「既有噪声」豁免吃掉（本轮实测命中 2 条）。 |
| 4 | 门禁与回归 | **PASS（按 AC-53 需求口径，附 2 处新发现）** | 我前台全量：**1927 / 1895 pass / 21 fail / 11 skip**（283s，exit 1）→ 与基线 `014fa6a`（1841/1808/22/11）**EXTRA = 0**、**MISSING = 1**（`live 取消…` 转绿）。跑完立刻 `git status --porcelain` = **0 行**、`-- docs/iterations/iteration-4` = **0 行**（污染未复现）。purity `exit 0`（45 文件零命中）、`dependencies = 0`、`--help` **31** 行、`NODE_STATES = 7`。**注**：21 条红里有 2 条是 I1.8 自己改红的（非基线噪声），见 §5 第 7 项；3 条「三主链」相关红均为 `EBUSY` 清理失败（`hookFailed`），AC-52 本体本轮**未实跑**。 |
| 5 | 缺陷与遗留 | **FAIL** | `_acc8-f-blockers.md` 每项都有处置结论（2 条阻塞 + 10 条逐项处置表 + 谁来做/不做会怎样），台账经我重生成验证**仍在**（diff 只差生成时间）；但 `report.md` 的 `### 5.1 10 条不通过（逐条归口，阻断 Done）` **仍在 §5 之内**，直接违反 §4.5 Done#4「§5 只列不影响结论的观察项，不含未完成的 AC」。本轮另查出 4 处记账/同源问题（§5 第 6~9 项）。 |
| 6 | 提交范围 | **PASS** | `git log --oneline 9e7ef7e..HEAD` 两个提交。`e5d8f18` **1 文件**（`probe/acc8-cases/AC-53.mjs`，+3/-1），**evidence 0 个**；`6a71150` **12 文件**（`docs/index.md`、`report.md`、`progress.md`、`final-verification*.md`、`probe/i18-s2/acc53-isolated.txt` + 6 个 evidence），无 `src/**` / `test/**` 改动。`git show --stat 9e7ef7e..HEAD -- docs/iterations/iteration-4` **为空**。 |

## 2. 抽查明细

| AC | 判定 | 证据文件 | 证据是否支撑 | 说明 |
|---|---|---|---|---|
| AC-53 | 通过（4/4） | `AC-53.part.md`、`AC-53.machine.full-suite.log`（436294 B，sha256 `9b521545…`）、`AC-53.diffset.txt` | **是** | **探针本体本轮未实跑**；但 C04 的输入我独立复跑得同一组数字：`{tests:1927, pass:1895, fail:21, skipped:11, parsedNames:21, gap:0}`。`diffset.txt`：新增失败「(空)」、剔除后「(空)」、基线红未复现 1 条。`skipped` 已实测 **11**（非 null）。 |
| AC-15 | 不通过（9/10） | jsonl `failedChecks` C09 + `AC-15.*` | **是** | 期望 `sha256 不变`，实测 `f15790c0…`（原 `d7e9054d…`）。断言源码 `afterHash === beforeHash` 与需求机检逐字一致，**未放宽**。 |
| AC-62 | 不通过（2/9） | jsonl 7 条（C03~C09）+ `AC-62.then.*` | **是（表述仍未修）** | 期望 `expired / deliveryAttempts=3 / escalations=1`，实测 `accepted / 1 / 0`。C08/C09 仍以 `false ([...])` 形态打印（连续四轮提出，未修）。 |
| AC-67 | 不通过（7/9） | jsonl C03/C05 + `AC-67.then.role-show.json.txt` | **是** | 断言逐字 `可用 · 活跃会话 0/1 · 服务节点 —`，实测「冷却中 · 活跃会话 0/1 · 服务节点 —」；`roleToSessions` 仍留 `developer` 键。期望值未改。 |
| AC-45 | 不通过（14/15） | jsonl C05 + `AC-45.then.settle.txt` / `.events.jsonl` | **是** | 唯一 ✗ 仍是 C05 逐字「（节点 T-003 · 轮次 2/3）」，实测「T-001 · 轮次 1/2」。取证时序修正后 14/15 保持不变（未实跑，仅读帧与 jsonl）。 |
| AC-58 | 不通过（9/16） | jsonl 7 条 + `AC-58.part.md` | **部分** | 失败可复核（`skipped` 缺、`node.dispatch=0`、收尾 `state=running`），但代码仍 `freshRoot('AC-58')` + `freshRoot('AC-58-human')` **两个项目根**，未满足 Given「一个独立项目根」。**未修**，与「需授权」声明一致。 |
| AC-26 | 阻塞（5/5） | `AC-26.before/after.workspace.artifacts.json`、`AC-26.part.md` | **是** | 锚点目录客观不存在，5/5 只含可取证项，`blocked=1` 如实保留，未用空集/替代目录冒充。 |
| AC-03 | 通过（33/33） | `AC-03.then.checkpoint.json` / `.instance-log.txt` | **是（未复跑）** | 检查点三要素与恢复日志一致；本轮两个提交未碰 `AC-03.*`。 |

> 覆盖：通过 2 条（AC-53、AC-03）、不通过 5 条（AC-15/62/67/45/58）、阻塞 1 条（AC-26），共 8 条。要求包含的 AC-15 / AC-62 / AC-67 / AC-53 全部在内。
> 本轮实跑面：全量 1 次（1927 条）、`acc8-f-final.mjs` 1 次、`i19-orchestrator` 2 条用例 1 次。**未实跑**：AC-53 探针本体、AC-52、AC-45/15/62/67/58/03/26 的单条复跑，以及其余 59 条 AC。

## 3. 判定是否被放宽（独立结论）

| 处 | 需求原文 | 实际判据 | 独立结论 | 理由 |
|---|---|---|---|---|
| **10 条不通过**（AC-15/23/37/42/43/45/58/62/63/67） | 各条 Then/机检逐字 | 逐条读 `failedChecks` 的 `expected`，与需求原文对照 | **无放宽** | 我抽查 AC-15（`sha256` 不变）、AC-62（`expired/3/1`）、AC-67（「可用 · 活跃会话 0/1 · 服务节点 —」）三条，源码期望值与需求 Then **一字未改**，全按原文判红。 |
| **AC-53 差集门禁** | 「与 `origin/main` 的失败集合差集为 0；既有噪声（EPERM / 盘符 / EBUSY）不计为新增失败」 | 先算 `extra`，对本次实际出现的每条新增红独占复跑；单跑通过才剔除 | **未放宽，但存在同名掩蔽** | 代码无预置名单（`grep` 只命中否定性注释）；剔除由运行时结果决定。**盲区**：比对单位是**用例名**，一个基线时因 `EBUSY` 变红、现在因断言不成立变红的同名用例，会被当成「既有噪声」放过。本轮实测命中 2 条（§5 第 7 项），其中 `≤13` 那条单跑**稳定复现**「实际 14 处，超过上限 13」。属**机制盲区**，不是作者篡改判据。 |
| **AC-53 C04** | 「失败条数与 TAP 解析一致」 | `failGap === 0` | **未放宽** | `AC-53.mjs:167-169` 仍是严格差额 0；我用同一正则解析我自己的全量日志得 `{fail:21, parsedNames:21, gap:0}`。 |
| **AC-45 落定等待** | 「节点已升级；实例挂起；escalations +1；reasonCode=timeout」 | 轮询 `suspended && escalations>=1`，上限 20s，超时照旧断言 | **不是放宽** | 期望值未改，落不下来仍判红；14/15 的 ✗ 仍是逐字文案。 |
| **wp9 会话发射点扩项（裁-20m）** | I1.9 冻结：`object: 'session'` ≤13、reason 白名单 | `i19-regression.test.js:600` 改 ≤14 + `session.reuse` 恰 1 处单列断言；**但 `i19-orchestrator.test.js:410` 仍是 ≤13** | **扩项本身合法，但同一契约的第二份断言未同步** | 基线 `014fa6a` 该计数 = **13**，`HEAD` = **14**。`i19-regression` 已按裁-20m 放宽，`i19-orchestrator` 未改 → 后者现在**真实失败**。两份断言对同一冻结契约给出不同上限，属未收口的内部矛盾。 |
| **`newState` 顶层字段** | I1.9 冻结：「只追加 health 与 traceId」 | `i19-orchestrator.test.js:143` 仍按 18 字段逐字比对 | **产品侧合法、冻结断言未同步** | `HEAD` 的 `newState` 多出 `sessionPolicies`（`orchestrator.js:1270`），该断言**真实失败**（单跑稳定复现）。`report.md` §3.2 U-9 只登记了 `i19-regression` 的放宽，未登记这一条。 |
| **AC-56** | `grep -R worktree src/` 输出 `0` | 改为「等于基线值 2」+ 只扫 `orchestrator.js` diff | **仍是既有遗留** | 本轮两个提交未碰 AC-56，`decisions.md` 裁-12 有留痕；本轮**未见到**新的用户书面授权，沿用上一轮「实质成立、口径待认」的结论，不改判。 |
| **AC-58 Given / AC-62 接缝** | 一个独立项目根 / 连续 3 次失败 | 两套根拼表 / mock 无失败接缝 | **证据不同源（非放宽）** | 代码仍未修、未转绿，均如实记「不通过」。 |

## 4. Done 七项

| # | 条件 | 判定 | 依据 |
|---|---|---|---|
| 1 | 需求里的任务全部通过（67 条 100% 通过） | **FAIL** | 55 通过 / **10 不通过** / **2 阻塞**（我自行重算）。未通过：AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-58、AC-62、AC-63、AC-67；阻塞：AC-26、AC-27。**数量与上一轮完全相同**，没有一条从红转绿。 |
| 2 | 零失败、零阻塞 | **FAIL** | 不通过 = 10 ≠ 0；阻塞 = 2 ≠ 0（书面豁免只覆盖「可不再补环境」，不改计数）。 |
| 3 | 门禁全绿 | **PASS（按 AC-53 需求口径，附 2 条保留）** | 我的全量 **1927 / 1895 / 21 / 11**、EXTRA = 0、MISSING = 1；purity exit 0；deps 0；`--help` 31；`NODE_STATES` 7。**保留**：① §4.5 字面「全量测试全通过」不成立（21 条红仍在），此处采信 AC-53 明写的「不要求零失败」——该豁免本身需用户认可；② 21 条红中 2 条是 I1.8 自己改红的（同名掩蔽），按名字口径绿、按因果口径不绿；③ 三主链本体（AC-52）本轮未实跑，全量里 3 条三主链相关红均为 `EBUSY` 清理失败。 |
| 4 | 缺陷与遗留收口 | **FAIL** | `blockers.md` 侧达标（2 条阻塞 + 10 条不通过均有处置/归属/后果，且台账活过重生成）；但 `report.md` §5 **仍包含** 10 条未完成 AC（`### 5.1`），违反「§5 只列不影响结论的观察项」。改名 + 分工声明让语义不再误导，但结构仍未合规。 |
| 5 | 终验与复核 | **FAIL** | 本轮总判 FAIL（第 1、2、4、5、6 项不过），故第 5 项不成立。独立复核部分已完成：全量 1 次、`acc8-f-final.mjs` 重生成 1 次、冻结断言单跑 1 次、四条门禁、四处数字重算、两提交范围核对。 |
| 6 | 数字一致（report / acceptance-* / summary / results 四处） | **FAIL（1 处不一致）** | 我自行重算：**67 条 / 55-10-2 / 714（688 通过 26 失败）** —— `report.md` 67 行、`acceptance-fixture.md` 67 行的判定与核对项**逐行 0 处不符**，`summary.json` 逐条累加同为 714/688/26。**但被引用帧总数**：`report.md`（`:7`/`:24`/`:45`）、`acceptance-fixture.md`（`:8`）、`docs/index.md`（`:682`/`:703`）、`progress.md`（`:157`）、`_acc8-f-summary.json` 全写 **453**，而 `_acc8-f-results.jsonl` 重算为 **452**。根因：summary 生成于 `2026-11-20T19:46:41Z`，而 jsonl 的 AC-53 行在 `19:51:51Z` 被重跑改写（`evidenceFiles` 由 2 条降为 1 条），summary 未再重生成。 |
| 7 | 需求评审闭环已 PASS | **PASS** | `review-round1.md` FAIL → `r2` FAIL → `r3` **PASS**（`review-round3.md:5`）；`requirement.md` 头部仍「**定稿**（第 3 轮独立评审 PASS…）」，版本 v3；两个提交均未改 `requirement.md`，67 条 AC 未被改写。 |

**七项结论：2 PASS（第 3 按项目口径、第 7）/ 5 FAIL（第 1、2、4、5、6）→ 总判定 FAIL。**

## 5. 阻断项与必须处置

| # | 项 | 谁来做 | 做什么 | 不做会怎样 |
|---|---|---|---|---|
| 1 | **8 条需求冲突**（AC-15、23、37、42、43、45 的 C05、63、67） | **用户** | 逐条书面裁决：改 Then/机检，或明确接受以「不通过」收口 | Done#1/#2 永不达成，下一轮终验继续判 FAIL |
| 2 | **AC-58 双项目根** | **用户**（授权）→ 验收 Agent | 用**一个**项目根同时含回流崩溃与 human 节点；kill 点移到「已有 done + 有 in-flight」窗口 | 「崩溃→恢复→人工作业→完成」仍未由同一实例证明，AC-58 恒为 9/16 |
| 3 | **AC-62 投递失败接缝** | **用户**（授权）→ 验收 Agent/实现 | 给 mock 增「重投前 N 次确定性失败」接缝 | AC-62 恒为 2/9 |
| 4 | **AC-26 / AC-27 阻塞豁免的书面确认** | **用户** | 确认 `_acc8-f-blockers.md` 的豁免结论（不改判通过、不计 0） | Done#2「阻塞=0」永远不成立 |
| 5 | **`report.md` §5.1 的 10 条未完成 AC** | 主控 | 把 5.1 移出 §5（改为 §2 判定表引用 + `blockers.md` 链接），§5 只留 5.3/5.4 | Done#4 不过（连续两轮的同一卡点） |
| 6 | **【本轮新】453 与 452 不一致（summary 未随 AC-53 重跑重生成）** | 主控 | 用 `node probe/acc8-f-final.mjs` 重生成 summary/blockers 后再提交，把被引用帧统一为 **452**（或说明 453 的取数口径）；同时处理 `AC-53.machine.AC-53.isolated.host-error-32603-attempts-1AC-63.log` 这个已不被 jsonl 引用的孤儿帧（保留并在报告注明「历史帧，不计入当前引用数」，或删除） | Done#6 不过；`acceptance-fixture.md:8` 明写「与 jsonl 同源」，现在是假的同源 |
| 7 | **【本轮新】两条 I1.9 冻结断言被 I1.8 改红，并被门禁同名掩蔽** | **用户**（授权改冻结断言）→ 主控 | ① `test/wp9/i19-orchestrator.test.js:410` 的 `≤13` 与裁-20m 的 `≤14` 统一（同一契约两份断言，必须同口径）；② `:143` 的 `newState` 18 字段清单补 `sessionPolicies`（或把它移出顶层）。两条单跑均**稳定失败**，不是 flake | 「三主链 / 既有冻结断言一字未动」的说法不成立；AC-53 的 `EXTRA=0` 会持续把这类真实回归当噪声放行 |
| 8 | **【本轮新】`report.md` §4 的门禁叙述与帧不符** | 主控 | §4 写「**末次** AC-53 实跑里确实出现过 1 条新增红（host-error 32603）」——那实际是 `03:28:56` 那次；末次（`03:47~03:51`）`EXTRA=0`、`diffset.txt` 明写「(无新增红)」。改成「前一次实跑出现过 1 条，已独占复跑剔除；末次无新增红」 | 读者会以为末次仍走了剔除分支，与 `AC-53.diffset.txt` 自相矛盾 |
| 9 | **【本轮新】`report.md` 抬头 Done 数字过期** | 主控 | `:31` 仍写「**2 PASS / 5 FAIL**（独立终验第 2 轮判定）」，与第 3 轮的 3 PASS/4 FAIL、`docs/index.md`/`progress.md` 的表述三方不一致 | 引用报告的人会拿错结论 |
| 10 | **【沿用】`docs/index.md:678` 的 HEAD 引用过期** | 主控 | 仍写「HEAD `639ace7` + 本轮返工未提交」；`docs/index.md:703` 写「HEAD `9e7ef7e`」。第 3 轮 §5 第 6 项③已提，本轮未改 | 台账指向一个不存在的提交 |
| 11 | **AC-62 C08/C09 打印 `false ([...])` 不可读** | 主控（低优先） | 改成把 expected/actual 分行打印 | 第三方无法逐字复核（连续四轮提出） |

## 6. 与上一轮终验的差异

| 维度 | 上一轮（`9e7ef7e`） | 本轮（`6a71150`） |
|---|---|---|
| 被验证对象 | 55 通过 / 10 不通过 / 2 阻塞 | **55 / 10 / 2（数量未变）** |
| 核对项 | 714（688 通过 / 26 失败） | **714（688 / 26）一致** |
| 被引用帧 | 453（summary 与 jsonl 同为 453） | **jsonl 452 / 文档 453（新不一致）** |
| AC-53 探针 | `skipped` 恒 `null` | **`skipped = 11`**（解析 `# skipped`），C04 `gap=0` |
| 全量 | 1927 / 1894 / 22（另一次 1895/21） | **1927 / 1895 / 21 / 11，EXTRA=0、MISSING=1**（我又一次独立命中 1895/21） |
| 全量抖动登记 | 无 | **report 抬头已登记 ±1 与两次样本**，且我这次复现了 1895/21 那一侧 |
| 陈旧数字 | `index.md:682/703`、`progress.md:157` 写 684/451 | **已改为 688/26、453**（688/26 对，453 错） |
| report §5 | 标题「遗留问题与边界」、5.1 列 10 条 | **标题「未达项、阻塞与边界」+ 分工声明**，5.1 仍含 10 条 |
| summary 明细 | `failedChecks` 为 11 条字符串标签 | **26 条结构化对象 `{id,label,expected,actual}`**，与 jsonl 逐条一致（仅 AC-53 `evidenceCount` 差 1） |
| blockers 生成时间 | 早于 jsonl 末条 | **AC-45 实测已刷新到 `03:23:59`**，但生成时间（`03:46:41`）仍早于 jsonl 末条（`03:51:51`） |
| 门禁掩蔽 | 未发现 | **新发现 2 条同名不同因的真实失败**（I1.9 冻结断言） |
| Done | 3 PASS / 4 FAIL | **2 PASS / 5 FAIL**（第 6 项由 PASS 转 FAIL） |

**5 条声称的逐条核实结论：**

1. **AC-53 TAP 解析 `# skip` → `# skipped`：证实。** `AC-53.mjs:39` 现为 `num('skipped') ?? num('skip')`；用同一正则解析 `AC-53.machine.full-suite.log` 得 `{"tests":1927,"pass":1895,"fail":21,"skipped":11}`（不再是 null）；我自己的全量日志同样有 `# skipped 11`，解析结果一致。`e5d8f18` 只改这一处（+3/-1），evidence 0 个。
2. **三处陈旧数字改成 688 通过/26 失败/453 帧：部分证实。** 684 → **688 通过 / 26 失败**正确；`docs/index.md:682`、`:703`、`progress.md:157` 确已改写（`progress.md:183` 保留「684 → 688、451 → 453」的变更叙述，属正常）。但 **451 → 453 这一半现在是错的**：jsonl 重算 **452**，因为 AC-53 在 summary 生成之后又重跑了一次、少引用了 1 帧。另：第 3 轮同项③（`index.md:678` 的 HEAD `639ace7` 过期）未处理。
3. **summary / blockers 由 `acc8-f-final.mjs` 重生成、`failedChecks` 恢复结构化、生成时间对齐 jsonl 末条：部分证实。** 我备份后实跑 `node probe/acc8-f-final.mjs`，diff 只有 3 行：`generatedAt` 与 AC-53 `evidenceCount 2→1`。可证 `failedChecks` 已是结构化对象（26 条，0 条字符串）且与 jsonl 逐条相同、`## 处置结论` 台账未被抹掉（只差时间戳）。**「生成时间对齐 jsonl 末条」不成立**：summary/blockers 为 `19:46:41Z`，jsonl 的 AC-53 行在 `19:51:51Z` 才落盘，summary 比末条早 **5 分 10 秒**，因此 AC-53 的 `evidenceCount` 停在 2。
4. **`report.md` §5 结构：部分证实。** 标题确已改为「未达项、阻塞与边界」，5.1 前也确加了「5.1 是 10 条未达 AC，不算不影响结论；只有 5.3/5.4 才是不影响结论」的分工声明——声称的动作属实。但 §4.5 Done#4 要求「§5 **不含**未完成的 AC」，5.1 仍在 §5 内，**Done#4 仍未闭合**；这是连续第二轮的同一卡点。
5. **全量 ±1 抖动如实登记：证实。** `report.md:25` 新增「全量数字的抖动」行，写明两次独立实跑 1895/21 与 1894/22、差 1 条 `--host-error 早返回（-32603）…（AC-63）`、独占复跑单文件通过后剔除、EXTRA=0 两次都成立、引用须带此说明。帧侧可交叉印证：`AC-53.machine.AC-53.isolated.host-error-32603-attempts-1AC-63.log`（`03:28:56`，`exit=0 stillRed=false`）仍在库里；我本轮独立实跑落在 **1895/21** 一侧，EXTRA=0。**附注**：`1894/22` 那一次的 `AC-53.diffset.txt` 已被后续重跑覆盖，无法二次复核，只能靠该孤立帧与上一轮记录佐证；同时 `report.md` §4 把这次旧跑写成「末次」，措辞需修正（§5 第 8 项）。

**本轮新发现（上一轮未提）：**

1. **summary 与 jsonl 再次不同源**（换了个字段）：AC-53 `evidenceCount` 2 vs 1，总量 453 vs 452；`acceptance-fixture.md:8` 仍宣称「与 `_acc8-f-results.jsonl` 同源」。
2. **门禁同名掩蔽 2 条真实失败**：`i19-orchestrator` 的 `newState` 字段清单（多了 `sessionPolicies`）与会话发射点 `≤13`（实为 14）。基线时这两条因 `EBUSY` 变红，AC-53 按名字比对 → `EXTRA=0` 判绿。我单独跑这两条：**2 条都稳定失败**（`# fail 2`）。
3. **`report.md` §4 门禁叙述与帧不符**：把 `03:28:56` 那次「出现过 1 条新增红」说成「末次」，而末次 `diffset.txt` 是「(无新增红)」。
4. **`report.md` 抬头 Done 数字过期**：写 2 PASS/5 FAIL（第 2 轮），与第 3 轮 3/4 及 `index.md`/`progress.md` 不一致。
5. **`docs/index.md:678` 的 HEAD `639ace7` 仍未更新**（第 3 轮已提）。
6. **21 条红里有 1 条是「同一断言、行号漂移」**：`escalations.filter|reduce … 唯一计数点必须在 shapeSnapshot 内：server.js:1023 → :1053`，基线因行号变化而不成立；属既有问题被本轮代码推动行号，仍红。

## 附录 A 复跑原始帧索引

**留档位置**：`C:\Users\xuesh\AppData\Local\Temp\`
（`i18-full-suite.log`＝本轮全量原始 TAP；`i19-orch-isolated.log`＝2 条冻结断言单跑；`acc8-r4\`＝重生成前备份 `_acc8-f-summary.json` / `_acc8-f-blockers.md`、`regen.out`、`purity.log`）

| AC / 项 | 我实跑结果 | 复跑帧（留档处） | 恢复动作 |
|---|---|---|---|
| 全量（前台） | **1927 / 1895 pass / 21 fail / 11 skip**（283s，exit 1），EXTRA=0、MISSING=1（`live 取消…`） | `i18-full-suite.log`；差集由我在内存中比对 `probe/i18-s2/baseline-014fa6a-reds.txt`（22 条） | 无仓库写入（跑完 `git status` 0 行、iter-4 0 行） |
| 门禁四条 | purity exit 0（45 文件）、deps 0、`--help` 31、`NODE_STATES` 7 | `acc8-r4\purity.log` + 终端输出 | 无文件改动 |
| 汇总重生成 | `acc8-f-final.mjs` → diff 仅 `generatedAt` + AC-53 `evidenceCount 2→1`；`## 处置结论` 与 10 条逐项表存活 | `acc8-r4\regen.out`、备份原件 | 已 `git checkout-index -f --` 还原，`git status --untracked-files=all` 0 行 |
| I1.9 冻结断言单跑 | `test/wp9/i19-orchestrator.test.js` 两条：**2 条 fail**（`newState` 字段清单、`≤13` 实为 14） | `i19-orch-isolated.log` | 无仓库写入（只写系统临时目录） |
| AC-53 | 探针本体**未实跑**；用我的全量日志独立复现 C04 输入 `{1927,1895,21,11,parsedNames:21,gap:0}` | `i18-full-suite.log` + 已提交 `AC-53.machine.full-suite.log` | — |
| AC-15/62/67/45/58/03/26 | 只做源码断言与 `failedChecks` 逐字复核，**未复跑** | jsonl 的 `failedChecks`（expected/actual 原样可查）、`AC-XX.part.md` | — |

**复跑口径**：全量用任务书给定命令（`--test-concurrency=1 --test-timeout=120000 --test-force-exit`，`NODE_ENV=test`）；冻结断言用 `--test-name-pattern` 单文件跑；汇总重生成前先备份、比对后还原。终验期间 `git status` 最多出现 2 项改动（summary/blockers），全部还原。收尾 `git status --porcelain --untracked-files=all` = **0 行**，HEAD 仍 `6a71150`，未提交。**未实跑**：AC-53 探针、AC-52，以及其余 59 条 AC 的逐条复跑。
