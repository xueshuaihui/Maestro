# I1.8 终验报告（独立终验 Agent · 第 3 轮，存档）

> 第 3 轮原文存档（被验证提交 `9e7ef7e`）。主控随后修了它 §5 里 5 条可修项（三处陈旧数字、summary 与 jsonl 不同源、blockers 生成时间、report §5 结构、门禁抖动登记），
> 因此文中部分数字/待办已被第 4 轮覆盖——**以 `final-verification.md` 为准**。

- 终验时间：**2026-11-21T03:45+08:00**
- 被验证提交：**`9e7ef7e5825ea02e6b146d7ff6ede0b61c7af65a`**（`docs(I1.8): 终验第 2 轮指出的记账错误与归口漏项全部修正`，父提交 `a10cbdf`）
- 被验证状态：**干净 HEAD**。开工 `git status --porcelain` **0 行**；终验期间独立复跑覆盖过 `AC-45.*` / `AC-53.*` / `AC-52.*` 三组帧与 `_acc8-f-results.jsonl`，并实跑 `probe/acc8-f-final.mjs` 改写 `_acc8-f-blockers.md` / `_acc8-f-summary.json`；全部用 `git -c core.autocrlf=false checkout-index -f -- <路径>`（台账测试那一轮用同法）恢复，收尾 `git status --porcelain` 仍为 **0 行**（含 `--untracked-files=all`）。除本文件外未改动任何文件，未 `git commit`。
- 依据：`docs/templates/execution-template.md` §3.6（六项校验）/ §4.5（Done 七项）；`docs/iterations/iteration-8/requirement.md` v3 的 67 条 AC（唯一验收依据）；本轮实跑输出（不引用主控/验收 Agent 的输出）。
- 本轮复跑帧留档：`C:\Users\xuesh\AppData\Local\Temp\acc8-r3\`（另存整目录备份 `...\orig-acc8\`、`...\blockers-before.md`、`...\AC-52.part.attempt1.md`），索引见附录 A。

## 0. 总判定

**FAIL。** 67 条 AC 实为 **55 通过 / 10 不通过 / 2 阻塞**（本轮自行从 `_acc8-f-results.jsonl` 按 last-per-ac 重算，非引用他方），Done 七项 **3 PASS / 4 FAIL**（PASS：第 3、6、7 项；FAIL：第 1、2、4、5 项）。

被验证提交确实把上一轮 8 条必须处置项里的 6 条**实质修好**（弱断言收紧、AC-45 取证时序、跨迭代污染、归口算术、台账存活、需求头部状态），本轮逐条实跑证实；但 **Done#1 / #2 的两个分子（10 条不通过、2 条阻塞）一条没动**，`report.md` §5.1 仍把 10 条未完成 AC 当遗留项列着（Done#4 明文禁止），另发现 4 处新的记账/同源问题（见 §5 第 6~9 项）。**按 §4.5 与 §7 红线 11，不得宣布 I1.8 需求结束。**

## 1. 六项校验

| # | 校验项 | 判定 | 实跑命令与输出摘要 |
|---|---|---|---|
| 1 | 结果完整性 | **FAIL** | `_acc8-f-results.jsonl` 67 行 / 67 个 AC 均有结论；last-per-ac 重算 `{通过 55, 不通过 10, 阻塞 2}`，非「67/0/0」。`_acc8-f-summary.json` 67 条、`byVerdict` 同上，逐条 `checks` 累加 = **714（通过 688 / 失败 26）**、`evidenceCount` 累加 = **453**。覆盖齐全成立，「全部通过」不成立。 |
| 2 | 证据支撑性 | **PASS（含 2 处已登记边界）** | 抽查 13 条（§2）：10 条完全支撑（AC-45/53/52/15/37/67/03/26/49/60）、3 条支撑但带已登记边界（AC-58 双项目根、AC-62 `false ([...])` 打印、AC-27 阻塞）。空文件 0 个（`find … -empty` = 0），无「只留结论不留原始帧」。**AC-45 的 4 条假阴性经我复跑已消失**（14/15，只剩 C05）。 |
| 3 | 判定未被放宽 | **PASS** | `AC-53.mjs:165-167` 已是严格 `failGap === 0`，无 `KNOWN/FLAKE/WHITELIST`（`grep` exit 1）；剔除逻辑仍是**运行时**逐条独占复跑（`:101-119`），不核不剔。`AC-45.mjs` 的 `git diff 956cbdc..HEAD` **只有新增等待/落帧，期望值 0 改动**（C05 仍逐字断言「（节点 T-003 · 轮次 2/3）」）。wp9 扩项为「≤13→≤14 + `session.reuse` 恰 1 处单列断言」，实测 `grep -c "object: 'session'"` = **14**、`session.reuse` 写入点 1 处，既有 13 处无 `-` 行。 |
| 4 | 门禁与回归 | **PASS（按 AC-53 需求口径，附抖动说明）** | 我前台全量：**1927 / 1894 pass / 22 fail / 11 skip**（272s），对基线 `014fa6a`（1841/1808/22/11）**EXTRA=1**（`--host-error 早返回（-32603）…（AC-63）`）、**MISSING=1**（`live 取消…` 转绿）；随后 AC-53 内部再跑一次全量得 **1927 / 1895 / 21 / 11、EXTRA=0**——同一 HEAD 两次结果不同（详见 §5 第 10 项）。跑完立刻 `git status --porcelain -- docs/iterations/iteration-4` = **0 行**，全仓 `git status` 也 = **0 行**（污染已止，见 §6 第 3 条）。purity `exit 0`（45 文件零命中）、`dependencies=0`、`--help` **31** 行、`NODE_STATES=7`；AC-52 我复跑第二次 **12/12**（第一次 11/12，见 §2）。 |
| 5 | 缺陷与遗留 | **FAIL** | `_acc8-f-blockers.md` 现在**每项都有处置结论**（2 条阻塞 + 「10 条不通过的逐项处置」表，含归口/处置/谁来做/不做会怎样）——这一半已修好；但 `report.md` 的 `### 5.1 10 条不通过（逐条归口）` 仍把 10 条未完成 AC 列在 §5，直接违反 §4.5 Done#4「§5 只列不影响结论的观察项，不含未完成的 AC」。另有 4 处记账/同源缺陷（§5 第 6~9 项）。 |
| 6 | 提交范围 | **PASS** | `git log --oneline 956cbdc..HEAD` 两个提交。`a10cbdf` 5 文件（`AC-03/45/53.mjs`、`acc8-f-final.mjs`、`test/wp11/perf.test.js`），**evidence 0 个**；`9e7ef7e` 含 20 个 evidence 变更 + 收口文档，另有 `docs/index.md`、`probe/i18-s2/acc53-isolated.txt`（台账）2 个非迭代目录文件（范围噪声，非证据）。`git show --stat 956cbdc..HEAD -- docs/iterations/iteration-4` **为空**（无跨迭代证据进提交）。 |

## 2. 抽查明细

| AC | 判定 | 证据文件 | 证据是否支撑 | 说明 |
|---|---|---|---|---|
| AC-45 | 不通过（**我复跑 14/15**） | 我这次生成的 `AC-45.then.state.json` / `.events.jsonl` / `.then.settle.txt` / `.part.md` | **是** | `settle.txt`：`settled=true`、`events 末条 seq=34`、`state=suspended escalations=1`；C07~C10 全 ✓。唯一 ✗ 是 C05 逐字「（节点 T-003 · 轮次 2/3）」，实测「节点 T-003 · 轮次 1/2」。与主控声称一致。 |
| AC-53 | 通过（**我复跑 4/4**） | 我这次生成的 `AC-53.machine.full-suite.log`（1927/1895/21/11）、`AC-53.diffset.txt`（新增失败「(空)」、无新增红） | **是** | C04 实测 `{tests:1927, pass:1895, fail:21, parsedNames:21, gap:0}` → ✓，判据已非弱断言。本轮该次跑 `extra` 为空，独占复跑分支未被走到（帧内「(无新增红)」）。 |
| AC-52 | 通过（**我复跑 12/12（第二次）**；第一次 11/12） | `AC-52.part.md`、两次尝试的 `AC-52.machine.i19-regression.log` | **是（有抖动）** | 第一次 C02 红：`test/wp9/i19-regression.test.js` 的「三主链…（AC-03）」报「code-loop 会话行多于基线」，实际出现「会话 已升级 / 实例 已挂起」；我随后单跑该文件 **8/8 绿、exit 0**，再整条重跑 AC-52 得 **12/12**。三方退出码与基线一致（0/4/4），三链归一化 diff 0。属负载抖动，但「12/12」不是每次都能复现。 |
| AC-15 | 不通过（9/10） | jsonl `failedChecks` C09 + `AC-15.*` | **是** | 期望「sha256 不变」，实测 `f15790c0…`（原 `d7e905…`）——机检客观不成立，判定与需求原文一致。 |
| AC-58 | 不通过（9/16） | jsonl 7 条 failedChecks（C03/C05/C06/C07/C09/C10/C13）+ `AC-58.part.md` | **部分** | 7 条失败均可复核（`skipped` 缺、`node.dispatch=0`、收尾 `state=running`）；但代码仍是 `freshRoot('AC-58')` + `freshRoot('AC-58-human')` **两个项目根**（`AC-58.mjs:38-39,145-152`），未满足 Given「一个独立项目根」。本轮**未修**，与主控声明一致。 |
| AC-62 | 不通过（2/9） | jsonl 7 条 + `AC-62.then.*` | **是（表述仍不可读）** | 实测 `accepted` / `deliveryAttempts=1` / `escalations=0`，与 Then `expired/3/1` 全面冲突，判定成立。C08/C09 仍以 `false ([])` / `false ({...})` 形态打印，第三方无法逐字复核（上一轮已指出，**未修**）。 |
| AC-37 | 不通过（9/10） | `AC-37.then.graph.txt` + jsonl C05 | **是** | graph 输出只渲染图声明的 T-001/T-002，T-004 不在文本内。 |
| AC-67 | 不通过（7/9） | jsonl C03/C05 + `AC-67.then.role-show.json.txt` | **是** | 实测「冷却中 · 活跃会话 0/1 · 服务节点 —」，Then 要「可用」；`roleToSessions` 仍留 `developer` 键。 |
| AC-03 | 通过（33/33） | `AC-03.then.checkpoint.json` / `.instance-log.txt` / `.part.md` | **是（备注已改）** | `## 备注` 已改为「裁-20g/20i 之后三项断言可同时满足」，与 33/33 不再自相矛盾（上一轮遗留项，本轮**已修**）。 |
| AC-26 | 阻塞（5/5） | `AC-26.before/after.workspace.artifacts.json`、`AC-26.part.md` | **是** | 锚点目录客观不存在，5/5 只含可取证项，无空集冒充；`blocked=1` 如实保留。 |
| AC-49 | 通过（7/7） | jsonl + `AC-49.part.md` | **是（未复跑）** | 本条本轮未改（`956cbdc..HEAD` 无 `AC-49.mjs`），沿用证据审查：日志含「会话 复用 …」且 `session/new` 1 次。**未实跑**。 |
| AC-60 | 通过（10/10） | jsonl + `AC-60.part.md` | **是（未复跑）** | 同上，本轮未改。**未实跑**。 |
| AC-27 | 阻塞（2/3） | `AC-27.probe.third-party-boot.txt`、`AC-27.part.md` | **是（无法复核真实性）** | 本机无 `dsh` CLI，第三方 ACP 入口 `exit 1`；阻塞成立。**未实跑**（需第三方可执行）。 |

> 覆盖：通过 4 条（AC-53、AC-52、AC-03、AC-49/60 中的 2 条）、不通过 6 条（AC-45/58/62/37/15/67）、阻塞 2 条（AC-26/27），共 13 条。要求包含的 AC-45 / AC-53 / AC-58 / AC-62 全部在内。

## 3. 判定是否被放宽（独立结论）

| 处 | 需求原文 | 实际判据 | 独立结论 | 理由 |
|---|---|---|---|---|
| **10 条不通过**（AC-15/23/37/42/43/45/58/62/63/67） | 各条 Then/机检逐字 | 逐条读 `failedChecks` 的 `expected`，与需求原文对照 | **无放宽** | AC-15 sha 不变、AC-37「T-004 … 等待人工」、AC-45 C05「（节点 T-003 · 轮次 2/3）」、AC-58「完成或升级」、AC-62 `expired/3`、AC-67「可用」——期望值一字未改，全按原文判红。 |
| **AC-53 差集门禁** | 「与 `origin/main` 的失败集合差集为 0」 | 先算 `extra`，对**本次实际出现**的每条新增红独占复跑，单跑通过才剔除 | **未放宽** | 代码无预置名单；剔除集合由运行时 `surviving` 决定，无法定位所属文件时按 `stillRed:true` 保守计入。本轮我两次实跑分别走到「无新增红」与「1 条新增红被剔除」两种路径，机制可用。方法学边界（单次隔离通过即剔除，可能放走间歇 flake）仍在，但属已裁决口径（裁-20r）。 |
| **AC-53 C04** | 「失败条数与 TAP 解析一致」 | 旧：`counts.fail === failures.length \|\| failures.length > 0`；新：`failGap === 0` | **已收紧，非放宽** | `AC-53.mjs:165-167` 实测 `gap=0` 才 ✓；本轮复跑 `parsedNames=21`、`fail=21`、`gap=0`。**顺带发现**：`parseCounts` 匹配 `# skip (\d+)`，而 TAP 实际打 `# skipped 11`，故 `skipped` 恒为 `null`（不影响现有断言，属探针缺陷）。 |
| **AC-45 落定等待** | 「节点已升级；实例挂起；`escalations` +1；`reasonCode=timeout」 | `AC-45.mjs:72-82` 轮询 `state=suspended && escalations>=1`，上限 20s；超时后**照旧断言** | **不是放宽，是取证缺陷修正** | diff 只有新增等待与 `settle.txt`，`C07~C10` 的 `eq` 期望值原样（`escalated` / `suspended` / `1` / `timeout`）；落不下来时 `settled=false` 但仍按原断言判红。我复跑得 14/15。 |
| **wp9 i19-regression 扩项** | I1.9 冻结：`object: 'session'` ≤13、reason 白名单 9 项 | 上限 13→14；白名单 +`session.reuse`；新增「`session.reuse` 写入点恰 1 处」单列断言 | **合法扩项** | `grep -c "object: 'session'"` = 14；`session.reuse` 写入点 1 处；既有 13 处无 `-` 行（`git show 425e2f3`）。 |
| **AC-56** | `grep -R worktree src/` 输出 `0`；两目录无命中 | 改为「等于基线值 2」+ 只扫 `orchestrator.js` diff | **改判据（实质成立，授权仍未见到）** | 与上一轮结论一致：实质结论（本轮恢复代码不新增 worktree 依赖）成立且在 `decisions.md` 裁-12/20u 留痕，但把原文「0」改写成「等于基线值 2」并收窄扫描面这件事，**仍未见到本轮的用户书面授权**。AC-56 记「通过」依赖这个口径，属既有遗留而非本轮放宽。 |
| **AC-58 Given** | 「**一个独立项目根**」 | 两个 root 拼一张表 | **证据不同源（非放宽）** | 代码仍在，未修、未转绿。 |
| **`.gitattributes` 证据树豁免** | 红线未涉及 | `docs/iterations/**/evidence/** -whitespace` | **非判据放宽，留痕已补** | 只关 `git diff --check` 告警、不改字节；现已在 `decisions.md` 有 **裁-20u** 正式记录（上一轮要求项已闭合）。 |

## 4. Done 七项

| # | 条件 | 判定 | 依据 |
|---|---|---|---|
| 1 | 需求里的任务全部通过（67 条 100% 通过） | **FAIL** | 55 通过 / **10 不通过** / **2 阻塞**（我自行重算）。未通过：AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-58、AC-62、AC-63、AC-67；阻塞：AC-26、AC-27。**数量与上一轮完全相同**——只修了记账与取证，没有一条从红转绿。 |
| 2 | 零失败、零阻塞 | **FAIL** | 不通过 = 10 ≠ 0；阻塞 = 2 ≠ 0（书面豁免只覆盖「可不再补环境」，不改计数）。 |
| 3 | 门禁全绿（全量全通过、条数 ≥ 基线、扫描 exit 0、零依赖、三主链符合预期） | **PASS（按 AC-53 需求口径）** | 1927 条 ≥ 1841；两次全量分别为 1894/22（EXTRA=1，经独占复跑剔除）与 1895/21（EXTRA=0）；purity exit 0；deps 0；`--help` 31；`NODE_STATES` 7；AC-52 复跑 12/12（第二次）。**注**：§4.5 字面「全量测试全通过」不成立（21~22 条基线噪声红仍在），此处采信 AC-53 明写的「不要求零失败」——该豁免本身需用户认可。 |
| 4 | 缺陷与遗留收口 | **FAIL** | `blockers.md` 侧已达标（2 条阻塞 + 10 条不通过均有处置/归属）；但 `report.md` `### 5.1 10 条不通过（逐条归口）` 仍列 10 条未完成 AC，违反「§5 只列不影响结论的观察项」。 |
| 5 | 终验与复核 | **FAIL** | 本终验总判 FAIL（第 1、2、4 项不过），故第 5 项不成立。独立复跑部分已完成：AC-45 14/15、AC-53 4/4、AC-52 12/12（第二次）、全量两次、purity/依赖/help/状态机四条门禁。 |
| 6 | 数字一致（report / acceptance-* / summary / results 四处） | **PASS（附 3 处同源性缺陷）** | 我自行重算并与四处对照：**67 条 / 55-10-2 / 714（688 通过 26 失败）/ 453 份被引用帧**，`report.md` 67 行、`acceptance-fixture.md` 67 行的判定与核对项**逐行 0 处不符**；`summary.json` 逐条累加同为 714/688/26/453；证据目录实盘 **539 文件、0 空文件**，与 report 抬头一致。`report.md` 的 AC-53 已统一 **4/4**（全文件无 `3/3`）、AC-45 **14/15**；`acceptance-fixture.md` §二汇总 **8 + 2 = 10** 且 AC-67 在列。**但**：① `summary.json` 的 `failedChecks` 仍是旧字符串格式，与 jsonl 的对象格式**不同源**（重生成会改写 11 条明细）；② `docs/index.md:682/703` 与 `progress.md:157` 仍写 `684 通过 / 451 帧`；③ report 的门禁数字 1895/21 与它自己的证据帧 1894/22 不一致。详见 §5。 |
| 7 | 需求评审闭环已 PASS | **PASS** | `review-round1.md` FAIL → `r2` FAIL → `r3` **PASS**；`requirement.md` 头部已改为「**定稿**（…第 3 轮独立评审 PASS…）」，版本 v3 = 附录 C 末行；67 条 AC 本轮未被改动。 |

**七项结论：3 PASS（第 3 按项目口径、第 6 附注、第 7）/ 4 FAIL（第 1、2、4、5）→ 总判定 FAIL。**

## 5. 阻断项与必须处置

| # | 项 | 谁来做 | 做什么 | 不做会怎样 |
|---|---|---|---|---|
| 1 | **8 条需求冲突**（AC-15、23、37、42、43、45 的 C05、63、67） | **用户** | 逐条书面裁决：改 Then/机检，或明确接受以「不通过」收口 | Done#1/#2 永不达成，下一轮终验继续判 FAIL |
| 2 | **AC-58 双项目根** | **用户**（授权）→ 验收 Agent | 用**一个**项目根同时含回流崩溃与 human 节点；kill 点移到「已有 done + 有 in-flight」窗口 | 「崩溃→恢复→人工作业→完成」仍未由同一实例证明 |
| 3 | **AC-62 投递失败接缝** | **用户**（授权）→ 验收 Agent/实现 | 给 mock 增「重投前 N 次确定性失败」接缝 | AC-62 恒为 2/9 |
| 4 | **AC-26 / AC-27 阻塞豁免的书面确认** | **用户** | 确认 `_acc8-f-blockers.md` 的豁免结论（不改判通过、不计 0） | Done#2「阻塞=0」永远不成立；若只是文档自称「用户裁决」，等于用未核实的话掩盖阻塞 |
| 5 | **`report.md` §5.1 的 10 条未完成 AC** | 主控 | 把 §5.1 移出 §5（改为 §2 判定表引用 + `blockers.md` 链接），§5 只留观察项与边界 | Done#4 不过（当前唯一卡点就在这条） |
| 6 | **陈旧数字 3 处** | 主控 | ① `docs/index.md:682` 与 `:703` 的「714 核对项（684 通过）、451 份被引用帧」→ `688 通过 / 26 失败`、`453`；② `progress.md:157` 同上；③ `index.md:703` 的 HEAD 引用 `639ace7` 已过期 | 跨文档数字互相矛盾，评审与后续迭代会引用错数 |
| 7 | **report 门禁数字与自己的证据帧不一致** | 主控 | `report.md:25` / `:164` 写 `1927/1895/21/11、EXTRA=0`，但 `AC-53.machine.full-suite.log` 实测 `1894/22`、`AC-53.diffset.txt` 明写「新增失败 1 条 → 独占复跑剔除 → 空」。应改成「本次实跑 1927/1894/22/11，新增 1 条经独占复跑剔除」并把两种结果都留档 | 读者会以为差集原生为 0、剔除分支从未走过；也与 `acceptance-fixture.md:175` 同一数字互相支撑成「假一致」 |
| 8 | **`_acc8-f-summary.json` 与 jsonl 不同源** | 主控 | 重跑 `node probe/acc8-f-final.mjs` 后提交（我实跑对比：11 条 `failedChecks` 由 `["…"]` 变 `[{id,label,expected,actual}]`） | summary 的失败明细与 jsonl 不一致，Any 审计按 summary 复核会拿不到 expected/actual |
| 9 | **`_acc8-f-blockers.md` 生成时间早于 jsonl 末条** | 主控 | 同上，随第 8 项一起重生成（现文件 19:00:47 生成，jsonl 里 AC-45 是 19:24:03，文中 AC-45 实测还是更早一轮的 `02:59:47`） | blockers 的「实测」列是过期快照 |
| 10 | **门禁抖动未如实登记** | 主控 | 记录「同一 HEAD 两次全量可分别在 1894/22 与 1895/21」，并统计抖动来源（`--host-error … AC-63`、wp9 三主链 code-loop 会话行）；AC-52 我两次跑出 11/12 与 12/12 | 「全绿」结论依赖单次采样，换人换机器可能复现不了 |
| 11 | **AC-53 探针 `skipped` 恒 null** | 主控（低优先） | `parseCounts` 的 `# skip (\d+)` 改为 `# skipped? (\d+)` | 若以后有人断言 skip，会拿 null 判错 |
| 12 | **AC-62 C08/C09 打印 `false ([...])` 不可读** | 主控（低优先） | 改成把 expected/actual 分行打印 | 第三方无法逐字复核（连续三轮提出） |

## 6. 与上一轮终验的差异

| 维度 | 上一轮（`956cbdc`） | 本轮（`9e7ef7e`） |
|---|---|---|
| 被验证对象 | `956cbdc`：55 通过 / 10 不通过 / 2 阻塞 | `9e7ef7e`：**55 / 10 / 2（数量未变）** |
| AC-53 判据 | `counts.fail === failures.length \|\| failures.length > 0`（近乎恒真） | **严格 `failGap === 0`**，复跑 `gap=0` |
| AC-45 | 10/15（C07~C10 假阴性） | **14/15**（我复跑证实，只剩 C05 逐字） |
| 跨迭代污染 | 每次全量必脏 `iteration-4/evidence/nfr-perf-*.json` | **已止住**：全量跑完 `git status` 0 行、iter-4 0 行（实跑两次验证） |
| 归口算术 | `7 + 3 − 1`、漏 AC-67 | **8 + 2 = 10**，AC-67 在列，AC-45 只计一次 |
| 台账 | 10 条不通过无逐项处置；重生成会抹掉台账 | **10 条逐项处置表在**，且**活过重生成**（我实跑 `acc8-f-final.mjs` 验证） |
| 需求头部 | 「修订稿…待第 3 轮评审」 | **「定稿（r3 PASS）」** |
| 其余遗留 | AC-03 备注自相矛盾 | **已改**（本轮额外确认，非 7 条清单内） |
| 未修 | AC-58 双根、AC-62 接缝 | **仍未修**（与「需授权」声明一致） |
| Done | 2 PASS / 5 FAIL | **3 PASS（3、6、7）/ 4 FAIL（1、2、4、5）** |

**上一轮 8 条必须处置项 + 主控声称的 7 条，逐条核实结果：**

1. **AC-53 弱断言 → `failGap === 0`：证实。** `git diff 956cbdc..HEAD -- probe/acc8-cases/AC-53.mjs` 只改这一处；我复跑 AC-53 得 4/4，C04 实测 `{fail:21, parsedNames:21, gap:0}`；文件内 `KNOWN/FLAKE/WHITELIST` 无匹配。
2. **AC-45 假阴性 → 14/15：证实。** 我独立 `node probe/acc8-f-run.mjs AC-45` → **14/15**；`settle.txt` 记 `settled=true / seq=34 / suspended / escalations=1`；唯一 ✗ 为 C05，期望值逐字「（节点 T-003 · 轮次 2/3）」未改；diff 证明只加了等待，无期望值改动，等待上限 20s 且超时仍判红。
3. **perf.test.js 默认写临时目录：证实。** `EVID = process.env.NFR_EVID_DIR ? … : path.join(os.tmpdir(), 'maestro-nfr-evidence')`（`test/wp11/perf.test.js:39-41`），`os` 已导入；我跑完全量后 `git status --porcelain -- docs/iterations/iteration-4` **0 行**、全仓 **0 行**——上一轮「必脏」的现象未复现。
4. **记账修正：部分证实。** 真修好的：`report.md` AC-53 统一 **4/4**（全文件已无 `3/3`）、`acceptance-fixture.md` §二 **8 + 2 = 10** 且含 AC-67、`requirement.md` 头部定稿。**未落地**：`docs/index.md:682` 与 `:703` 仍写「714 核对项（684 通过）、451 份被引用帧」，`progress.md:157` 同；声称的「684/30 → 688/26、451 → 453」只改了 `report.md` / `acceptance-fixture.md` 两处。
5. **台账活过重生成：证实。** 我备份后实跑 `node probe/acc8-f-final.mjs`：重生成文件仍有 `## 处置结论`（142 行）与 `### 10 条不通过的逐项处置`（153~169 行，含 AC-62/AC-58 行）；diff 仅 `生成时间` 与 AC-45 的实测文本（被 jsonl 的新值刷新）变化。恢复后工作区 0 行。
6. **requirement.md 头部：证实。** 现为「**定稿**（第 3 轮独立评审 PASS：阻断 0 / 建议 0、DoR 13/13、覆盖表 15/15）」，与 `review-round3.md` §0「总判：PASS」一致，版本 v3 = 附录 C 末行。
7. **AC-58 / AC-62 未修（需授权）：证实。** `AC-58.mjs:38-39` 仍是 `freshRoot('AC-58')` + `freshRoot('AC-58-human')`；`AC-62.mjs` 的 Given 仍直接给 `delivered / deliveryAttempts:1`，无失败接缝。两条仍为 9/16 与 2/9。

**本轮新发现（上一轮未提）：**

1. **`docs/index.md` / `progress.md` 的汇总数字没跟着改**：`684 通过 / 451 帧` 与 `report.md` 的 `688 / 453` 并存（声称已改，实际未改）。
2. **`_acc8-f-summary.json` 的 `failedChecks` 与 jsonl 不同源**：11 条仍是旧字符串格式，重生成会全部改写（数字不受影响，明细会变）。
3. **`_acc8-f-blockers.md` 生成时间早于 jsonl 最后一条**：AC-45 的「实测」列还是上一轮 `02:59:47` 的文本，而 jsonl 已是 `03:23:59`。
4. **report 的门禁数字与自己的证据帧矛盾**：`1895/21、EXTRA=0` vs 帧内 `1894/22、新增失败 1 条（后剔除）`；我两次实跑各命中一种。
5. **门禁不稳定**：AC-52 第一次 11/12（wp9 的 code-loop 链出现「已升级/已挂起」，单跑该文件 8/8 绿、整条重跑 12/12），说明「三主链符合预期」这条结论是概率性的。
6. **AC-53 探针 `skipped` 恒 null**（TAP 打 `# skipped`，正则找 `# skip`）。

**上一轮已提、本轮仍未修**：AC-56 判据改写无本轮授权；AC-62 的 `false ([...])` 打印不可读；AC-58 双项目根。**上一轮已提、本轮已修**：AC-03 备注自相矛盾。

## 附录 A 复跑原始帧索引

**留档位置**：`C:\Users\xuesh\AppData\Local\Temp\acc8-r3\`
（整目录备份 `...\orig-acc8\`＝覆盖前 HEAD 的 539 个文件；`...\blockers-before.md`；`...\AC-52.part.attempt1.md`；日志 `...\full-test.log`、`...\now-reds.txt`、`...\ac53-rerun.log`、`...\ac52.log`、`...\final-regen.log`）

| AC / 项 | 我实跑结果 | 复跑帧（留档处） | 恢复动作 |
|---|---|---|---|
| 全量（前台） | **1927 / 1894 pass / 22 fail / 11 skip**（272s），EXTRA=1（AC-63 host-error）、MISSING=1（live 取消转绿） | `full-test.log`、`now-reds.txt` | 无仓库写入（`git status` 0 行，含 iter-4） |
| AC-45 | **不通过 14/15**，唯一 ✗ C05 逐字「（节点 T-003 · 轮次 2/3）」 | `AC-45.part.md`、`.then.settle.txt`、`.then.state.json`、`.then.events.jsonl`、`.then.instance-log.txt`、`.then.status.txt`、`.then.graph.txt`、`.given.run-output.txt`（`...\orig-acc8\` 内有覆盖前原件） | 已 `checkout-index` 恢复 |
| AC-53 | **通过 4/4**（内部全量 1927/1895/21/11、`gap=0`、新增红 0） | `AC-53.part.md`、`AC-53.machine.full-suite.log`、`AC-53.diffset.txt`、`probe/i18-s2/acc53-isolated.txt`（空） | 已恢复 |
| AC-52 | **通过 12/12**（第二次）；第一次 **11/12**（C02 wp9 三主链红） | `AC-52.part.md`、`AC-52.machine.i19-regression.log`、`AC-52.given.worktree-add.txt`；第一次的 part.md 另存 `AC-52.part.attempt1.md` | 已恢复 |
| 门禁四条 | purity exit 0（45 文件）、deps 0、`--help` 31、`NODE_STATES` 7 | 终端输出（本报告 §1 第 4 行） | 无文件改动 |
| 台账重生成 | `acc8-f-final.mjs` → `## 处置结论` + 10 条逐项表存活 | `blockers-before.md`、`final-regen.log` | `_acc8-f-blockers.md` / `_acc8-f-summary.json` 已恢复 |
| AC-15/37/58/62/67/03/26/27/49/60 | 只做证据与 jsonl 逐条复核，**未复跑** | jsonl 的 `failedChecks`（expected/actual 原样可查） | — |

**复跑口径**：每条都是 `node probe/acc8-f-run.mjs AC-XX` 单条独立跑（AC-53 内部再跑一次全量），不引用既有日志。终验期间 `git status` 最多出现 12 项改动，全部 `checkout-index` 还原；收尾 `git status --porcelain --untracked-files=all` = **0 行**，HEAD 仍 `9e7ef7e`，未提交。**未实跑**：AC-49、AC-60（本轮未改，只做证据审查）、AC-27 的真实第三方面（本机无 `dsh` CLI）、以及其余 54 条 AC 的逐条复跑。
