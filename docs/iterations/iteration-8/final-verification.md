# I1.8 终验报告（独立终验 Agent · 第 5 轮，窄口径）

- 终验时间：**2026-11-21T04:35+08:00**
- 被验证提交：**`298a835`**（`docs(I1.8): 同名掩蔽的发现与修正全量留痕（AC-53 5/5、715 核对项）`，父提交 `54f7ee0`（`fix(I1.8): 修同名掩蔽的 2 条真实回归 + AC-53 增「同名换失败类型」判据`），再上为上一轮被验证的 `6a71150`）
- 被验证状态：**干净 HEAD**。开工 `git status --porcelain` **0 行**；本轮实跑：全量 1 次、`test/wp9/i19-orchestrator.test.js` 单文件 1 次、`node probe/acc8-f-run.mjs AC-53` 1 次、`AC-49` 1 次、`AC-60` 1 次、四条静态门禁各 1 次。三处探针复跑会覆盖仓库内证据帧，**复跑帧先 `cp` 到 `%TEMP%\i18-final5\rerun-frames\` 留档，跑完用 `git -c core.autocrlf=false checkout-index -f --` 逐文件还原**；收尾 `git status --porcelain --untracked-files=all` **0 行**，HEAD 仍 `298a835`。除本文件外未改动任何文件，未 `git commit`。
- 依据：`docs/templates/execution-template.md` §3.6（六项校验）/ §4.5（Done 七项）；`docs/iterations/iteration-8/requirement.md` v3 的 67 条 AC（唯一验收依据）；**本轮实跑输出**（不引用主控/验收 Agent 的输出）。
- 本轮复跑帧留档：`C:\Users\xuesh\AppData\Local\Temp\i18-final5\`（`full-suite.log`＝我的全量原始 TAP、`i19-orch-isolated.log`＝冻结测试单文件、`AC-53.rerun.out`、`rerun-frames\`＝三条探针复跑时写回仓库的帧原件、`cmp.js`＝失败集合差集脚本、`purity.log`）。索引见附录 A。
- 口径声明：本轮为**窄口径**——第 5 轮只回答「第 4 轮指出的同名掩蔽是否真被堵住 + 工程指标与记账是否收口」，不重开已认定的 10 条需求冲突/夹具缺口；所有数字自己重算，4 条声称逐条独立核实。

## 0. 总判定

**FAIL。** 67 条 AC 实为 **55 通过 / 10 不通过 / 2 阻塞**（我自行从 `evidence/acc8/_acc8-f-results.jsonl` 重算，67 行、67 个 AC、0 重复），核对项 **715（通过 689 / 失败 26）**，被引用帧 **452 份**（452 个路径逐个 `fs.existsSync` = 0 缺失）。Done 七项 **2 PASS / 5 FAIL**（PASS：第 3、7 项；FAIL：第 1、2、4、5、6 项）。

主控本轮 4 条声称：**证实 4 条**（其中第 2、4 条各带 1 处附注），**不成立 0 条**。「同名掩蔽」这条方法学缺陷**确已被堵住**：我用两份独立的「用例名 → failureType」表比对，基线 22 条同名红里本次仍红的 21 条**没有一条换失败类型**（`masked = 0`、类型取不到 = 0），且 `newState` / `≤13` 两条冻结测试的红因已从 `testCodeFailure / ERR_ASSERTION` 回到 `hookFailed / EBUSY`（与基线同因）。

但工程指标的改善**没有改变 AC 面的结论**：10 条不通过与 2 条阻塞的数量一条未变（AC-15/23/37/42/43/45/58/62/63/67 不通过；AC-26/27 阻塞），Done#1/#2 仍 FAIL。另新查出 **3 处记账不一致**（`report.md` 的「542 个文件」实盘 539；`acceptance-fixture.md:13` 与 `_acc8-f-blockers.md` 末行仍写 AC-53 `4/4`），**Done#6 仍 FAIL**；`report.md` §5.1 仍含 10 条未完成 AC，**Done#4 连续第三轮卡在同一处**。

**按 §4.5 与 §7 红线 11，不得宣布 I1.8 需求结束。**

## 1. 六项校验

| # | 校验项 | 判定 | 实跑命令与输出摘要 |
|---|---|---|---|
| 1 | 结果完整性 | **FAIL** | 67 行 / 67 个 AC / 0 重复；重算 `{通过 55, 不通过 10, 阻塞 2}`、`checksTotal 715`、`checksPassed 689`、`checksFailed 26`、`evidenceFiles` 去重 **452**。覆盖齐全成立，**「全部通过」不成立**（10 不通过 + 2 阻塞，与第 4 轮数量完全相同）。 |
| 2 | 证据支撑性 | **PASS** | 抽查 8 条（§2）：AC-53 / AC-49 / AC-60 **本轮实跑复现**（5/5、7/7、10/10）；AC-15 / AC-62 / AC-67 / AC-45 的 `failedChecks.expected` 与需求原文逐字对照一致；AC-26 的阻塞帧与理由可复核。证据目录实盘 **539 文件、0 空文件**（`find -type f -empty` = 0）。 |
| 3 | 判定未被放宽 | **PASS（附 2 处口径注记）** | `AC-53.mjs` 无预置名单（`grep -Ein 'whitelist\|KNOWN\|FLAKE\|allowlist'` 只命中否定性注释与变量名 `kindUnknown`），新增红只在**运行时**独占复跑后剔除；第 5 条核对项（裁-20z）是**加严**。两处注记：① 沿用「基线 = 开工点 `014fa6a`」而非需求字面的 `origin/main`（更严，非放宽，属既有口径）；② `kindUnknown`（取不到基线失败类型）不参与判据，本轮实测 0 条，**未命中**，但仍是残留的口子。 |
| 4 | 门禁与回归 | **PASS（按 AC-53 需求口径，附 3 处保留）** | 我前台全量：**1927 tests / 1895 pass / 21 fail / 11 skip**（295.6s，exit 1）；对基线 `014fa6a`（1841/1808/22/11）**EXTRA = 0**、**MISSING = 1**（`live 取消…` 转绿，允许）、**同名换类型 = 0**，tests 1841→1927（只增不减）。跑完立刻 `git status --porcelain` **0 行**、`-- docs/iterations/iteration-4` **0 行**。purity `exit 0`（45 文件零命中）、`dependencies = 0`、`--help` **31** 行、`NODE_STATES = 7`。**保留**：① §4.5 字面「全量测试全通过」不成立（21 红仍在），此处采信 AC-53 明写的「不要求零失败」；② AC-52（三主链本体）本轮**未实跑**；③ 21 红全在基线名单内，但其中 8 条仍是 `hookFailed`（`EBUSY` 清理失败，环境噪声，非产品回归）。 |
| 5 | 缺陷与遗留 | **FAIL** | `_acc8-f-blockers.md` 侧达标（2 条阻塞 + 10 条逐项处置表 + 谁来做/不做会怎样，台账未被重生成抹掉）；但 `report.md` 的 `### 5.1 10 条不通过（逐条归口，阻断 Done）` **仍在 §5 之内**（`:200`），违反 Done#4「§5 只列不影响结论的观察项，不含未完成的 AC」。 |
| 6 | 提交范围 | **PASS（附 1 处登记）** | `git log --oneline 6a71150..HEAD` 恰两个提交。`54f7ee0`：**3 文件**（`src/core/orchestrator.js`、`test/wp9/i19-orchestrator.test.js`、`probe/acc8-cases/AC-53.mjs`），**`evidence/**` 0 个**；`298a835`：**13 文件全部在 `docs/` 下**（含 6 个 evidence 帧）。`git show --stat 6a71150..HEAD -- docs/iterations/iteration-4` **为空**。**登记**：功能提交里夹带了 1 个 `probe/` 文件，按 §3.6 字面「功能 commit 没卷进 `probe/**`」不合规；但该文件就是本条门禁的判据本体、与被修缺陷同因，可接受，需留痕。 |

## 2. 抽查明细

| AC | 判定 | 证据文件 | 证据是否支撑 | 说明 |
|---|---|---|---|---|
| AC-53 | 通过（5/5） | `AC-53.part.md`、`AC-53.machine.full-suite.log`（436034 B，sha256 `ed0db0a8…`）、`AC-53.diffset.txt` | **是（本轮实跑复现）** | 我复跑 `node probe/acc8-f-run.mjs AC-53` → **通过，5/5**；C05 实测 `{tests:1927,pass:1895,fail:21,skipped:11,parsedNames:21,gap:0}`；`diffset.txt` 四段判据全 `(空)`、`masked=(空)`、`kindUnknown=(空)`、基线未复现 1 条。 |
| AC-49 | 通过（7/7） | `AC-49.part.md` + 6 个 then/given 帧 | **是（本轮实跑复现）** | 复跑 → **7/7**；`role show` 仍输出「会话复用：复用（reuse）」，两轮同一 `session id`。 |
| AC-60 | 通过（10/10） | `AC-60.part.md` + 9 个 then/given 帧 | **是（本轮实跑复现）** | 复跑 → **10/10**；hold 点两节点仍 `ready`/`blocked`，释放后 `node.dispatch` 恰 1 条。 |
| AC-15 | 不通过（9/10） | jsonl `failedChecks` C09、`AC-15.*` | **是** | C09 期望 `sha256 不变`（`d7e9054d…`），实测 `f15790c0…`。断言与需求机检逐字一致，未放宽。 |
| AC-62 | 不通过（2/9） | jsonl C03~C09、`AC-62.then.*` | **是（打印仍不可读）** | 期望 `expired / deliveryAttempts=3 / escalations=1`，实测 `accepted / 1 / 0`；C08/C09 仍以 `false ([...])` 形态打印。 |
| AC-67 | 不通过（7/9） | jsonl C03/C05、`AC-67.then.role-show.json.txt` | **是** | 逐字期望「可用 · 活跃会话 0/1 · 服务节点 —」，实测「冷却中 · …」；`roleToSessions` 仍留 `developer` 键。 |
| AC-45 | 不通过（14/15） | jsonl C05、`AC-45.then.settle.txt` | **是（未复跑，只读帧）** | 唯一 ✗ 仍是逐字「（节点 T-003 · 轮次 2/3）」，实测「T-001 · 轮次 1/2」。 |
| AC-26 | 阻塞（5/5） | `AC-26.before/after.workspace.artifacts.json`、`AC-26.part.md` | **是** | 锚点 `workspace/artifacts/**` 客观不存在，5/5 只含可取证项、`blocked=1` 如实保留，未用空集/替代目录冒充。 |

> 覆盖：通过 3 条（AC-53/49/60，均本轮实跑）、不通过 4 条（AC-15/62/67/45）、阻塞 1 条（AC-26），共 8 条。
> 本轮实跑面：全量 1 次（1927 条）、冻结测试单文件 1 次（10 条）、AC-53/49/60 探针各 1 次、四条静态门禁各 1 次。**未实跑**：AC-52、AC-03/58/15/62/67/45/26 的单条复跑，以及其余 59 条 AC。

## 3. 判定是否被放宽（独立结论）

| 处 | 需求 / 冻结原文 | 实际判据 | 独立结论 | 理由 |
|---|---|---|---|---|
| **AC-53 差集门禁** | 「与基线失败集合差集为 0；既有噪声（EPERM / 盘符 / EBUSY）不计为新增失败」 | 先算 `extra`（按用例名），再对本次实际出现的每条新增红独占复跑；**新增第 5 条**：基线同名红比 `failureType` | **未放宽，且已补上同名掩蔽** | 我独立复算：EXTRA=0、同名换类型=0、`kindUnknown`=0；脚本 `cmp.js` 用与 `AC-53.mjs` 同一正则从两侧 TAP 各抽一张「名字 → 类型」表，基线 22 条里 21 条仍红、0 条换型。 |
| **`newState` 顶层字段** | I1.9 冻结：18 字段前缀逐字 + `health` + `traceId` | `keys.slice(0,18)` 逐字比对 + `[18]=health` + `[19]=traceId` + **`[20]=sessionPolicies`** + `length===21` + `sessionPolicies===null` | **合法扩项（更严）** | 我读 `orchestrator.js:1250-1282`：18 项相对顺序与 `014fa6a` **逐字相同**（`hostRaw` 后紧接 `nodes`，`sessionPolicies` 已移到 `traceId` 之后）；新增项**单列断言**并钉死默认 `null`，不是「任意新增都允许」的子集放宽。单文件跑该条红因是 `hookFailed/EBUSY`（after 钩子 `rmdir`），**断言本身通过**。 |
| **会话发射点上限 13 → 14** | I1.9 冻结：`object: 'session'` ≤ 13 | `i19-orchestrator` 改 `≤14`；`i19-regression` 同步 `≤14` + reason 白名单含 `session.reuse` + **`reason: 'session.reuse'` 恰 1 处** | **本文件是放宽（+1），但契约整体未放宽** | 我实测：基线 13 处正文逐行**一字未动**（`diff` 只多一行 `object: 'session'`），第 14 处确为 `session.reuse`（`orchestrator.js:2344`，`reason: 'session.reuse'`）；`i19-regression.test.js:646-649` 用「恰 1 处」把它钉死，若再加一处则总数 15 越界。**附注**：`i19-orchestrator.test.js:424` 注释称「第 14 处由下面的会话级事件类型断言钉住」**不成立**——该文件 `:429-441` 只断言 note 的 reason 全为 `execution.summary`，且该次运行不含 reuse 场景，从未断言 `session.reuse`；真正的钉子在 `i19-regression`。 |
| **两条冻结测试标题** | 原文标题含「只追加 health 与 traceId 两个字段」「≤ 13」 | 标题不动，断言改 21 字段 / ≤14 | **标题与断言已不一致（方法学欠账）** | 这是为保住「名字差集」与 win32 基线表逐字查找而**故意**保留的，理由成立；但代价是两条冻结测试名字现在**描述了错误的契约**。应在下一迭代连同基线红名单与平台表一起改名，不能长期留置。 |
| **10 条不通过**（AC-15/23/37/42/43/45/58/62/63/67） | 各条 Then/机检逐字 | 逐条读 `failedChecks.expected` 与需求原文对照 | **无放宽** | AC-15（sha256 不变）、AC-62（`expired/3/1`）、AC-67（「可用 · 活跃会话 0/1 · 服务节点 —」）、AC-45（「（节点 T-003 · 轮次 2/3）」）四条期望值与 `requirement.md` **一字未改**（`:42`、`:251`、`:290-291`、`:900`），全按原文判红。 |
| **AC-53 基线选择** | 需求：「与 `origin/main` 的失败集合差集为 0」 | 用 I1.8 开工点 `014fa6a` 的全量帧与红名单 | **非放宽（更严），但口径需登记** | `origin/main` 不含 I1.8 新增用例，用开工点比 `origin/main` 更严；该口径自前几轮沿用，本轮未变。建议在需求侧确认一次，避免与字面冲突。 |

## 4. Done 七项

| # | 条件 | 判定 | 依据 |
|---|---|---|---|
| 1 | 需求里的任务全部通过（67 条 100% 通过） | **FAIL** | 55 通过 / **10 不通过** / **2 阻塞**（我自行重算）。未通过：AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-58、AC-62、AC-63、AC-67；阻塞：AC-26、AC-27。**与第 4 轮数量完全相同，一条都未转绿**。 |
| 2 | 零失败、零阻塞 | **FAIL** | 不通过 10 ≠ 0；阻塞 2 ≠ 0（书面豁免只覆盖「可不再补环境」，不改计数）。 |
| 3 | 门禁全绿 | **PASS（按 AC-53 口径，附 3 处保留）** | 全量 1927/1895/21/11（exit 1）、EXTRA=0、同名换类型=0；purity exit 0（45 文件）；deps 0；`--help` 31；`NODE_STATES` 7。**保留**：字面「全量全通过」不成立；AC-52 未实跑；21 红里 8 条为 `hookFailed/EBUSY` 环境噪声。 |
| 4 | 缺陷与遗留收口 | **FAIL** | `blockers.md` 有逐项处置；但 `report.md` §5 仍含 `### 5.1 10 条不通过`（`:200`），违反「§5 只列不影响结论的观察项」。**连续第三轮同一卡点**。 |
| 5 | 终验与复核 | **FAIL** | 本轮总判 FAIL，故本项不成立。独立复核本身已完成：全量 1 次、冻结测试单跑 1 次、AC-53/49/60 各 1 次、四条门禁、四处数字重算、两提交范围核对。 |
| 6 | 数字一致（report / acceptance-* / summary / results 四处 + 证据文件数与实盘） | **FAIL（3 处不一致）** | 四处主数字**一致**：67 条 / 55-10-2 / 715（689 通过 26 失败）/ 452 帧，逐行 67 条 0 处不符；但 ① `report.md:7`、`:45` 写「`evidence/acc8/` 542 个文件」，实盘 **539**（`git ls-files` 与 `ls` 同为 539）——且上一版 `539` 本来是**对的**，本次被改错；② `acceptance-fixture.md:13` 仍写「AC-53 2/3 → **4/4**」，同文件 `:72`/`:173` 已是 5/5；③ `_acc8-f-blockers.md` 末行「AC-53（4/4）」同样过期。 |
| 7 | 需求评审闭环已 PASS | **PASS** | `review-round1.md` FAIL → `r2` FAIL → `r3` **PASS**；`requirement.md` 头部仍「定稿（第 3 轮独立评审 PASS）」，v3；两个提交均未碰 `requirement.md`。 |

**七项结论：2 PASS（第 3 按项目口径、第 7）/ 5 FAIL（第 1、2、4、5、6）→ 总判定 FAIL。**

## 5. 阻断项与必须处置

| # | 项 | 谁来做 | 做什么 | 不做会怎样 |
|---|---|---|---|---|
| 1 | **8 条需求冲突**（AC-15、23、37、42、43、45 的 C05、63、67） | **用户** | 逐条书面裁决：改 Then/机检，或明确接受以「不通过」收口 | Done#1/#2 永不达成，下一轮终验继续 FAIL |
| 2 | **AC-58 双项目根** | **用户**（授权）→ 验收 Agent | 用**一个**项目根同时含回流崩溃与 human 节点；kill 点移到「已有 done + 有 in-flight」窗口 | AC-58 恒为 9/16 |
| 3 | **AC-62 投递失败接缝** | **用户**（授权）→ 验收 Agent | 给 mock 增「重投前 N 次确定性失败」接缝 | AC-62 恒为 2/9 |
| 4 | **AC-26 / AC-27 阻塞豁免的书面确认** | **用户** | 确认 `_acc8-f-blockers.md` 的豁免结论（不改判通过、不计 0） | Done#2「阻塞=0」永远不成立 |
| 5 | **`report.md` §5.1 的 10 条未完成 AC** | 主控 | 把 5.1 移出 §5（改为 §2 判定表引用 + `blockers.md` 链接），§5 只留 5.3/5.4 | Done#4 不过（连续三轮） |
| 6 | **【本轮新】「542 个文件」与实盘 539 不符** | 主控 | 改回 **539**（或写清取数口径）；同时把 `acceptance-fixture.md:13`、`_acc8-f-blockers.md` 末行的 AC-53 `4/4` 改成 **5/5** | Done#6 不过；`acceptance-fixture.md:8`「与 jsonl 同源」与实盘不符 |
| 7 | **【本轮新】`i19-orchestrator.test.js:424` 注释归因错误** | 主控（低优先） | 注明「`session.reuse` 恰 1 处」的钉子在本仓 `i19-regression.test.js:646-649`；或在本文件也补一条 `session.reuse` 恰 1 处断言 | 读者会以为本文件已护住第 14 处，实际只护了总数 ≤14 |
| 8 | **【本轮新】两条冻结测试标题与断言内容不一致**（「只追加两个字段」实为三个、「≤13」实为 ≤14） | 主控（需与终验口径同步） | 下一迭代改名时**同时**重建基线红名单、win32 平台基线表与差集口径，避免「改名即新增红」的自伤 | 冻结测试名长期说谎，后来者按名字读会得到错误契约 |
| 9 | **【沿用】孤儿帧未被引用**：`AC-53.machine.AC-53.isolated.host-error-32603-attempts-1AC-63.log`（03:28）不在 452 份被引用帧内 | 主控 | 保留并在报告注明「历史帧，不计入当前引用数」，或删除 | 目录文件数与引用帧数的差额需每次手工解释 |
| 10 | **【沿用】AC-62 C08/C09 打印 `false ([...])` 不可读** | 主控（低优先） | 把 expected/actual 分行打印 | 第三方无法逐字复核（连续五轮提出） |
| 11 | **【沿用】AC-53 基线口径为开工点 `014fa6a` 而非 `origin/main`** | **用户/主控** | 在需求侧确认该口径，或在 requirement 里写明「基线=迭代开工点」 | 每一轮终验都要重复解释一次 |

## 6. 与上一轮终验的差异

| 维度 | 上一轮（`6a71150`） | 本轮（`298a835`） |
|---|---|---|
| AC 面 | 55 通过 / 10 不通过 / 2 阻塞 | **55 / 10 / 2（未变）** |
| 核对项 | 714（688 / 26） | **715（689 / 26）** —— 增的第 5 条核对项（裁-20z）计入 AC-53 |
| 被引用帧 | jsonl 452 / 文档 453（不一致） | **452 / 452 / summary 452（一致）** |
| 证据目录文件数 | 文档 539（实盘 539，一致） | **文档 542 / 实盘 539（新不一致）** |
| AC-53 | 4/4，探针未实跑 | **5/5，探针本轮实跑复现**；diffset 四段全空、`masked=(空)` |
| 同名掩蔽 | 命中 2 条（`newState` 字段清单、`≤13` 实为 14），`testCodeFailure` | **0 条**；两条红因回到 `hookFailed/EBUSY`（与基线同因） |
| 全量 | 1927/1895/21/11，EXTRA=0、MISSING=1 | **同一组数字**（我独立实跑 295.6s 复现），EXTRA=0、MISSING=1、同名换类型=0 |
| 冻结测试单跑 | 2 条 `ERR_ASSERTION`（稳定失败） | **6 条 `EBUSY`（`hookFailed`），0 条断言失败** |
| Done | 2 PASS / 5 FAIL | **2 PASS / 5 FAIL**（第 6 项仍 FAIL，原因由「453/452」换成「542/539 + 两处 4/4」） |

**4 条声称的逐条核实结论：**

1. **`sessionPolicies` 从 `hostRaw`/`nodes` 之间移到 `traceId` 之后，并新增第 19 个顶层字段的单列断言：证实。** `orchestrator.js:1250-1282` 现为「18 项（`schemaVersion`…`escalations`）→ `health` → `traceId` → `sessionPolicies`」，与 `git show 014fa6a:src/core/orchestrator.js` 的 18 项相对顺序逐字相同；`i19-orchestrator.test.js:150-157` 是「前缀逐字 `deepEqual` + `[18]/[19]` 位置 + `[20]==='sessionPolicies'` + `length===21` + 默认 `null`」四段式，属**合法扩项且更严**，不是子集放宽。
2. **`≤13` 上限扩到 14、标题一律不改：证实（附注 1）。** 现 `i19-orchestrator.test.js:425` 为 `count <= 14`，标题仍是「≤ 13」；`i19-regression.test.js:600` 同为 `≤14`，并在 `:646-649` 用「`reason: 'session.reuse'` 恰 1 处」把新增点钉死。我实测：基线 13 处正文逐行未动（`diff` 仅多一行 `object: 'session'`），第 14 处即 `session.reuse`。**附注**：`i19-orchestrator.test.js:424` 的「由下面的会话级事件类型断言钉住」归因不成立——该文件正文未断言 `session.reuse`。
3. **AC-53 增第 5 条核对项，基线同名红必须连 `failureType` 一起比：证实。** `AC-53.mjs:70` 从 `probe/i18-s2/baseline-014fa6a-full.log` 抽基线类型、从本次 TAP 抽现类型，`:133-144` 把同名换型收进 `masked`，`:219` 作为一条硬判据；无预置名单。我用独立脚本（同一正则）两侧各抽一张表复算：基线 22 红、本次 21 红、**换型 0 条**、取不到类型 0 条。
4. **修完后工程指标：6 红全回 `hookFailed`、AC-53 5/5、diffset 四段空、全量 1927/1895/21/11、EXTRA=0、核对项 689/715、帧 452：证实（附注 2）。** 我逐项实跑复现：单文件 `test/wp9/i19-orchestrator.test.js` **10 条 6 红，全部 `failureType: 'hookFailed'` + `code: 'EBUSY'`**（after 钩子 `rmdir` 于测试体之后，断言已过）；`AC-53` 复跑 **5/5**；全量 **1927/1895/21/11**；jsonl 重算 **689/715、452**。**附注**：文档侧尚有 3 处记账未同步（§4 Done#6），不影响上面这些数字本身。

**本轮新发现（上一轮未提）：**

1. **`report.md` 的「542 个文件」把原本正确的 539 改错了**（`298a835` 的 diff 可见 `539 → 542`），实盘 `git ls-files | wc -l` = **539**。Done#6 的「证据文件数与实盘一致」因此失守。
2. **AC-53 `4/4` 残留两处**：`acceptance-fixture.md:13`（同文件 `:72`/`:173` 已 5/5）与 `_acc8-f-blockers.md` 末行「已消除…AC-53（4/4）」。
3. **`i19-orchestrator.test.js:424` 的补偿断言归因错误**（详见 §3 与 §5 第 7 项）：该文件不钉 `session.reuse`，钉子在 `i19-regression`。
4. **两条冻结测试的标题现在与断言内容矛盾**（「只追加两个字段」实为三个、「≤13」实为 ≤14），是刻意保留名字的代价；建议下一迭代连同基线红名单与平台表一起改名。
5. **`54f7ee0` 功能提交夹带 `probe/acc8-cases/AC-53.mjs`**，按 §3.6 字面「功能 commit 不卷 `probe/**`」不合规（但属门禁判据本体，可接受）。
6. **基线红 `live 取消…` 转绿**：基线 22 红 → 本次 21 红，`fail` 由 22 降到 21；我单文件跑该条**通过**（6 红里没有它），说明它是 `EBUSY` 清理时序相关的环境噪声，转绿不构成放宽；AC-53 的「条数只增不减」指 `tests`（1841→1927），已满足。

## 附录 A 复跑原始帧索引

**留档位置**：`C:\Users\xuesh\AppData\Local\Temp\i18-final5\`

| AC / 项 | 我实跑结果 | 复跑帧（留档处） | 恢复动作 |
|---|---|---|---|
| 全量（前台） | **1927 / 1895 pass / 21 fail / 11 skip**（295.6s，exit 1），EXTRA=0、MISSING=1、同名换类型=0 | `full-suite.log`（原始 TAP）、`cmp.js`（差集 + 类型比对脚本） | 无仓库写入（跑完 `git status` 0 行、iter-4 0 行） |
| 冻结测试单文件 | 10 条 / 4 pass / **6 fail，全 `hookFailed`+`EBUSY`** | `i19-orch-isolated.log` | 无仓库写入 |
| AC-53 探针 | **通过 5/5**；`{1927,1895,21,11,parsedNames:21,gap:0}`；diffset 四段空 | `AC-53.rerun.out`、`rerun-frames/docs/.../AC-53.*`（含 436091 B 的 `full-suite.log`，sha256 `fd559746…`） | 已 `checkout-index -f --` 还原到 HEAD 版（436034 B，sha256 `ed0db0a8…`） |
| AC-49 探针 | **通过 7/7** | `rerun-frames/docs/.../AC-49.*`（part.md + 4 帧 + 账本） | 同上还原 |
| AC-60 探针 | **通过 10/10** | `rerun-frames/docs/.../AC-60.*`（part.md + 9 帧 + 账本） | 同上还原 |
| 门禁四条 | purity exit 0（45 文件零命中）、deps 0、`--help` 31、`NODE_STATES` 7 | `purity.log` + 终端输出 | 无文件改动 |
| 汇总重算 | 67 行 / 55-10-2 / 689-715 / 452 帧 / 0 缺失 / 目录 539 文件 / 0 空文件 | 终端输出（node 一行脚本） | 无文件改动 |

**复跑口径**：全量用任务书给定命令（`NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"`）；冻结测试用同参数单文件跑；探针用 `node probe/acc8-f-run.mjs AC-XX`。三条探针会改写仓库内证据帧与 `_acc8-f-results.jsonl`，均先在 `%TEMP%` 留档、跑完 `git -c core.autocrlf=false checkout-index -f -- <git ls-files -m>` 还原；终验期间 `git status` 最多同时出现 18 项改动，已全部还原。收尾 `git status --porcelain --untracked-files=all` = **0 行**，HEAD 仍 `298a835`，未提交。**未实跑**：AC-52，以及其余 59 条 AC 的逐条复跑。

---

## 主控回执（**非终验结论**，2026-11-21 终验之后补记）

> 本节由主控补写，**不改变上面第 5 轮终验的 FAIL 判定**。作用是交代「终验指出的主控侧待办，之后做了什么」，
> 让下一位读者不必翻提交历史。凡涉及判定的事项，仍以上面的终验正文为准。

| 终验 §5 待办 | 处置 | 落点 |
|---|---|---|
| `report.md` 写「542 个文件」而实盘 539（Done#6） | 已改回 **539**（三处） | 本回执对应的提交 |
| `acceptance-fixture.md:13`、`_acc8-f-blockers.md` 末行残留 AC-53 `4/4` | 均已改 **5/5** | 同上 |
| §5.1 未达 AC 仍在 §5 内（Done#4） | **结构改了**：10 条不通过 + 2 条阻塞移到 `report.md §0.1`（结论节），§5 只剩观察项与边界 | 同上 |

**未处置（需用户裁决，与终验 §5 一致）**：8 条需求冲突的逐条裁决、AC-58 / AC-62 的夹具返工授权、
AC-26 / AC-27 阻塞豁免的书面确认、AC-53「基线 = 开工点 `014fa6a`」而非 `origin/main` 的口径确认。
