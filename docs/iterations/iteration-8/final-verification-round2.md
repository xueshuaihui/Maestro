# I1.8 终验报告（独立终验 Agent · 第 2 轮，存档）

> 本文件是第 2 轮终验的原文存档（被验证提交 `956cbdc`）。之后主控按它的 §5 修了 7 处记账与取证缺陷，
> 因此文中若干数字（核对项 684/30、帧 451、AC-45 10/15）已被第 3 轮终验覆盖——**以 `final-verification.md` 为准**，
> 本文件只作「上一轮说了什么」的审计留痕。

- 终验时间：**2026-11-21T03:21:02+08:00**
- 被验证提交：**`956cbdc15dc1eae05d1150099ffa4685e2309845`**（`docs(I1.8): 返工后重生成 67 条验收口径与收口文档`）
- 被验证状态：**HEAD 干净工作区**。开工时 `git status --porcelain` **0 行**；终验期间为独立复跑覆盖过 6 组 `AC-XX.*` 帧，跑完全部用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 恢复，收尾时 `git status --porcelain` 仍为 **0 行**。除本文件外未改动任何文件，未提交。
- 依据：`docs/templates/execution-template.md` §3.6（六项校验）/ §4.5（Done 七项）；`docs/iterations/iteration-8/requirement.md` v3 的 67 条 AC（唯一验收依据）；本次实跑输出（不引用他方结论）。
- 本轮复跑帧留档：`C:\Users\xuesh\AppData\Local\Temp\acc8-rerun\`（原始帧备份 `...\acc8-orig\`），索引见附录 A。

## 0. 总判定

**FAIL。** 67 条 AC 实为 **55 通过 / 10 不通过 / 2 阻塞**，Done 七项 **2 PASS / 5 FAIL**（PASS：第 3、7 项；FAIL：第 1、2、4、5、6 项）。产品侧两条返工缺口（AC-49 / AC-60）确已落地并通过独立复跑，AC-53 的预赦白名单确已撤销；但「不通过 = 0、阻塞 = 0」仍未满足，且本轮新发现 1 类取证时序假阴性、1 处归口漏计、1 处逐项数字不一致与 1 处可复现的跨迭代证据污染副作用。**按 §4.5 与 §7 红线 11，不得宣布 I1.8 需求结束。**

## 1. 六项校验

| # | 校验项 | 判定 | 实跑命令与输出摘要 |
|---|---|---|---|
| 1 | 结果完整性 | **FAIL** | `_acc8-f-results.jsonl` 67 行 / 67 个 AC 均有结论，但 last-per-ac 重算为 `{通过:55, 不通过:10, 阻塞:2}`，非「67/0/0」。`_acc8-f-summary.json` 67 条、`byVerdict` 同上；`_acc8-f-blockers.md` 67 条口径存在（12 条明细）。AC 级的「覆盖齐全」成立，「全部通过」不成立。 |
| 2 | 证据支撑性 | **FAIL** | 抽查 14 条（§2）：**9 条完全支撑**（AC-49/60/17/26/37/15/67/03/52），**2 条支撑但表述有缺陷**（AC-53 判据内部弱断言、AC-62 期望/实测打印不可读），**3 条不完整**：AC-45 的 C07~C10 四项不支撑（`state.json`/`events.jsonl` 在 `session.timeout` 落盘后 5ms 读取，升级与挂起事件 #32~#35 尚未落盘，而同一用例后面的 `status` 已显示「已挂起 / 已升级」）、AC-58 的 C14~C16 与 C01~C13 不同源（人工节点组另起项目根）、AC-56 扫描面窄于需求。空文件 0 个、只有结论无原始帧 0 条。 |
| 3 | 判定未被放宽 | **PASS（限 10 条不通过 + AC-53 + wp9）** | 10 条不通过的期望值逐条与需求 Then/机检一致，无一条被改宽（§3）。`AC-53.mjs` 已无 `KNOWN_FLAKES`/预置常量（`grep -n "KNOWN\|FLAKE" probe/acc8-cases/AC-53.mjs` → 无匹配，exit 1），剔除逻辑是**运行时**逐条独占复跑。`wp9/i19-regression.test.js` 为上限 13→14 + 新项单列断言，既有 13 处 diff 一字未动（`git show 425e2f3 -- src/core/orchestrator.js \| grep "object: 'session'"` 仅 1 行 `+`，无 `-`）。另 2 处「改判据 / 弱断言」单列在 §3，不计入本项。 |
| 4 | 门禁与回归 | **PASS** | 全量 **tests 1927 / pass 1895 / fail 21 / skip 11**（268.8s），对基线 `014fa6a`（1841/1808/22/11）**EXTRA=0、MISSING=1**（`live 取消…` 转绿），条数 +86。同日两次独立全量（前台一次 + AC-53 内部一次）失败集合**逐条相同**（`diff` 无输出）。purity 五条全 exit 0（45 文件 / registry 11 文件 30 词 / 三 CLI 文件 31 词 / `OK: no CJK`）；`dependencies=0`；`--help` **31** 行；`USAGE_LINES=25`；`NODE_STATES=7`；AC-52 我独立复跑 **12/12**（detach `014fa6a` 三主链归一化 diff 0）。 |
| 5 | 缺陷与遗留 | **FAIL** | 产品缺陷归 0（AC-49/AC-60 返工经复跑确认）；但 `_acc8-f-blockers.md` 只对 **2 条阻塞**给了「处置结论」，**10 条不通过没有逐项处置行**；`report.md` §5.1 本身就是「10 条不通过」清单，直接违反 Done#4「§5 只列不影响结论的观察项，不含未完成的 AC」。 |
| 6 | 提交范围 | **PASS（含 3 处夹带说明）** | `639ace7..HEAD` 三提交：`425e2f3 fix` 6 文件、**evidence 0 个**；`5bd0d91 test` 只含 `probe/acc8-cases/*` + `test/wp13/session-reuse-dispatch.test.js`、evidence 0 个；`956cbdc docs` 含 431 个 evidence 变更 + 收口文档。`git show --stat 639ace7..HEAD -- docs/iterations/iteration-4` **为空**（无跨迭代提交污染）。夹带：`.gitattributes`、`.workbuddy/memory/*.md`、`probe/i18-s2/*.log` 也进了 docs 提交（非交付物，属范围噪声）。 |

## 2. 抽查明细

| AC | 判定 | 证据文件 | 证据是否支撑 | 说明 |
|---|---|---|---|---|
| AC-49 | 通过（我复跑 7/7） | `AC-49.part.md`、`AC-49.then.instance-log.txt`、`AC-49.then.state.json` | **是** | 日志在第二轮回流派发处逐字出现 `会话 复用 mock-sess-26832-1（角色 developer）`；两轮开发同 id；`session/new` 1 次。独立复跑仍是 7/7，D-7 真实生效。 |
| AC-60 | 通过（我复跑 10/10） | `AC-60.then.graph-hold.*`、`.then.dispatch.json`、`.then.state-after.json` | **是** | hold 点（派发前）两节点 `ready`/`blocked` 逐项不变；释放后 `node.dispatch` 恰 1 条且属 T-001，T-002 为 0，edges 三条逐项相同。D-8 真实生效，且两条机检不再互斥。 |
| AC-53 | 通过（我复跑 4/4） | `AC-53.machine.full-suite.log`（436 KB）、`AC-53.diffset.txt` | **是（判据内部有弱断言）** | 我复跑得 `1927/1895/21/11`，与帧逐字一致；`diffset` 新增失败 `(空)`、基线未复现 1 条。**但 C04 `counts.fail===failures.length \|\| failures.length>0` 近乎恒真**，见 §3。 |
| AC-17 | 通过（我复跑 9/9） | `AC-17.then.instance-log.txt`、`AC-17.part.md` | **是** | 日志含 `恢复失败：host_unreachable；实例已中断（可执行 orch instance log 查看详情）`，状态 `interrupted`。上一轮亲修项仍成立。 |
| AC-26 | 阻塞（我复跑 阻塞 5/5） | `AC-26.before/after.workspace.artifacts.json`、`AC-26.part.md` | **是** | `after` 帧 37 bytes，锚点目录不存在；上一轮指出的「空集判 ✓」已移除（U-5 已修），5/5 只含真实可取证项，阻塞成立、无替代物冒充。 |
| AC-45 | 不通过（10/15） | `AC-45.then.state.json`、`.then.events.jsonl`、`.then.instance-log.txt`、`.then.status.txt` | **否（4/5 条失败不成立）** | `events` 止于 seq 31 `session.timeout`（ts `…18:59:50.745Z`），`state.updatedAt=…50.750Z`（+5ms）；#32~#35 升级/挂起在快照之后才落盘，而 `status` 已显示「已挂起 / 节点 T-003 已升级 / ESC-001」。C07~C10 是**读早了**，只有 C05（逐字「T-003 · 轮次 2/3」实为 1/2）是真失败。 |
| AC-58 | 不通过（9/16） | `AC-58.given.driver-attempts.json`、`AC-58.part.md`、`AC-58.then.human-*.txt` | **部分** | `attempt 0` 崩溃前为 `T-001 running r2 / T-002 failed r1 / HO-002 created`，**确无 done 节点**，故 `skipped=0`、无「已完成后 dispatch=1」是窗口必然，夹具缺口归因成立；但 C14~C16 的人工节点来自**另一个项目根**，与 C01~C13 不同源，Given 的「一个独立项目根」未满足。 |
| AC-62 | 不通过（2/9） | `AC-62.part.md`、`AC-62.then.state.json`、handoff/events 帧 | **是（表述不可读）** | 实测 `accepted` / `deliveryAttempts=1` / `escalations=0`，与 Then `expired/3/1` 全面冲突；C08/C09 仍以 `false ([...])` 形态打印，第三方无法逐字复核（上一轮已指出，未修）。 |
| AC-37 | 不通过（9/10） | `AC-37.then.graph.txt` | **是** | graph 只渲染图声明的 T-001/T-002，T-004 不在文本内；C05 不成立，与记录一致。 |
| AC-15 | 不通过（9/10） | jsonl failedChecks + `AC-15.*` | **是** | sha256 `d7e905…`→`f15790…`，机检「不变」客观不成立；日志有「已中断并提示新建」。 |
| AC-67 | 不通过（7/9） | jsonl failedChecks + `AC-67.then.role-show.json.txt` | **是** | `role show` 实测「冷却中 · 活跃会话 0/1 · 服务节点 —」，与 Then「可用」冲突；`roleToSessions` 仍留 developer 条目。 |
| AC-03 | 通过（33/33） | `AC-03.then.checkpoint.json`、`.then.instance-log.txt` | **是（备注过期）** | 帧内 `恢复：检查点 … 跳过 1 个已完成节点 · 轮次 2/2`，33/33 可复核；但 `## 备注` 仍写「示例不可兼得…按原文如实判定」，与 33/33 自相矛盾（上一轮已指出，未修）。 |
| AC-52 | 通过（我复跑 12/12） | `AC-52.given.worktree-add.txt`、`AC-52.machine.i19-regression.log` | **是** | 真实 detach `014fa6a` 建基线树，三条主链归一化 diff 0、退出码一致、无恢复类新行、基线树已清理。 |
| AC-56 | 通过（6/6） | `AC-56.machine.gates.txt`、`AC-56.part.md` | **部分** | 恢复实现新增行 `worktree` 命中 0、`src/core/code-isolation.js` 存在，实质成立；但判据已由「`grep -R worktree src/` 输出 0」改为「基线值 2」，扫描范围由 `src/core src/daemon` 收窄到 `orchestrator.js` diff，见 §3。 |

> 覆盖：通过 7 条（AC-49/60/53/17/03/52/56）、不通过 6 条（AC-45/58/62/37/15/67）、阻塞 1 条（AC-26）。要求包含的 AC-49 / AC-60 / AC-58 / AC-45 / AC-62 全部在内。

## 3. 判定是否被放宽（独立结论）

| 处 | 需求原文 | 实际判据 | 独立结论 | 理由 |
|---|---|---|---|---|
| **10 条不通过**（AC-15/23/37/42/43/45/58/62/63/67） | 各条 Then/机检逐字 | 逐条读 `failedChecks` 的 `expected`，与需求原文对照 | **无放宽** | AC-15 sha 不变、AC-23「不进入运行中」、AC-37「T-004 … 等待人工」、AC-42 `round===2` + 「T-003 · 2/3」、AC-43/63 同文案、AC-45 C05 同文案、AC-58「完成或升级」、AC-62 `expired/3`、AC-67「可用」——期望值一字未改，全按原文判红。 |
| **AC-53 差集门禁** | 「与 `origin/main` 的失败集合差集为 0」 | 先算 `extra`，对**本次实际出现**的每条新增红独占复跑；单跑通过才剔除，仍红计入 | **未放宽** | 代码内无预置名单（无 `KNOWN_FLAKES`），剔除集合由运行时 `surviving` 决定；无法定位所属文件时按 `stillRed:true` 保守计入。本次 `extra=(空)`，该分支未被使用。方法学边界：单次隔离复跑通过即剔除，理论上可放走间歇 flake——本轮未发生。 |
| **AC-53 C04** | 「失败条数与 TAP 解析一致」（隐含 `counts.fail === failures.length`） | `counts.fail === failures.length \|\| failures.length > 0` | **弱断言（内部放宽）** | `\|\| failures.length > 0` 让该检查在「有任何失败」时近乎恒真，TAP 计数与失败名解析错位无法被发现。本轮数值恰好一致（21=21），但判据本身排错能力不足。 |
| **wp9 i19-regression 扩项** | I1.9 冻结：`object: 'session'` ≤13、reason 白名单 9 项 | 上限 13→14；白名单 +`session.reuse`；新增「`session.reuse` 写入点恰 1 处」单列断言 | **合法扩项，非子集放宽** | `git show 425e2f3` 证明 orchestrator 只新增 1 处会话发射点、既有 13 处无 `-` 行；`execution.summary` 恰 1 处与既有 9 项断言原样保留；新项被两处独立断言钉死，未改成「任意新增都允许」。现测 `grep -c` = 14、`session.reuse` = 1。 |
| **AC-56** | `grep -R "worktree" src/ \| wc -l` 输出 `0`；`artifact_type.*dir\|merge.*order` 在 `src/core src/daemon` 无命中 | 改为「全仓命中 = 基线值 2」，且只扫 `orchestrator.js` 的 diff | **改判据 / 收窄（实质成立，授权不足）** | 我实跑：需求原句 `grep -RE "artifact_type.*dir\|merge.*order" src/core src/daemon` 在 HEAD 有 **2 处命中**（不等于 0）；`grep -R worktree src/` 有 **42 处**（I1.7 自带）。实质结论「本轮恢复代码不新增 worktree 依赖」成立（`git diff 014fa6a..HEAD -- src/ \| grep "^+" \| grep -c worktree` = **0**），但这是把原文的「0/无命中」改写成「等于基线值」，且扫描面从两目录收窄到单文件 diff。裁-12 有记录，**未取得本轮书面授权**。 |
| **AC-45 C07~C10** | 「节点显示已升级；实例挂起；`escalations` +1；`reasonCode=timeout`」 | 在 `session.timeout` 事件出现后立即读 `state.json`/`events` | **不是放宽，是假阴性** | 快照 `updatedAt=18:59:50.750Z`，升级事件 #32~#35 尚未落盘；同一用例随后读的 `status` 已显示全部达成。若改为等迁移落定再读，AC-45 应为 **14/15**（仅 C05 红）。这是取证时序缺陷，不是产品缺陷，也不是判据放宽。 |
| **AC-58 Given** | 「**一个独立项目根**，编码闭环回流复测现场 + 一个由夹具预置的人工节点」 | e2e 根（无 human）+ 另起 human 根，两套证据拼在一张表 | **证据不同源（非放宽）** | C14~C16 与 C01~C13 不在同一实例/同一根，无法证明「同一次崩溃恢复里人工节点保持等待」。判定仍为不通过，未据此转绿。 |
| **`.gitattributes`** | 模板 §7 红线未涉及；验收判据在 AC 与 Done | `docs/iterations/**/evidence/** -whitespace`（原仅 `*.log`） | **不是验收判据放宽** | `-whitespace` 只影响 `git diff --check` 的空白告警，**不改变工作树/提交里的字节**，不影响任何 AC 结论；证据帧尾空格确为产品真实输出，剥掉即篡改。独立结论：可接受，但**属仓库卫生门禁的例外扩大**，且同一规则也覆盖了 `.part.md` / `_acc8-f-blockers.md` 这类手写核对表；应在 `decisions.md` 正式留痕，而不是只写在 commit message 与 `.gitattributes` 注释里。 |

## 4. Done 七项

| # | 条件 | 判定 | 依据 |
|---|---|---|---|
| 1 | 需求里的任务全部通过（67 条 100% 通过） | **FAIL** | 55 通过 / **10 不通过** / **2 阻塞**（67 行 jsonl，last-per-ac 重算）。未通过：AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-58、AC-62、AC-63、AC-67；阻塞：AC-26、AC-27。 |
| 2 | 零失败、零阻塞 | **FAIL** | 不通过 = 10 ≠ 0；阻塞 = 2 ≠ 0（书面豁免只覆盖「可不再补环境」，**不改变计数**）。 |
| 3 | 门禁全绿（全量测试全通过、条数 ≥ 基线、扫描 exit 0、零依赖、三主链符合预期） | **PASS（按 AC-53 需求口径）** | 全量 1927/1895/21/11，条数 ≥ 1841，失败集合 **EXTRA=0**（两次独立跑逐条相同）；purity 五条 exit 0；deps 0；`--help` 31；`NODE_STATES` 7；AC-52 我复跑 12/12。**注**：按 §4.5 字面「全量测试全通过」不成立（21 条基线噪声红仍在），此处采信需求 AC-53 明写的「不要求零失败」——该豁免本身需用户认可。 |
| 4 | 缺陷与遗留收口 | **FAIL** | `blockers.md` 的 10 条不通过**无逐项处置结论**（只有 2 条阻塞有）；`report.md` §5.1 列的就是 10 条未完成 AC，违反「§5 不含未完成的 AC」；另有 3 类夹具缺口与 1 处取证件时序未收口。 |
| 5 | 终验与复核 | **FAIL** | 本终验总判 FAIL（第 1、2、4、5、6 项不过），故第 5 项不成立。独立复跑部分已完成：AC-49 7/7、AC-60 10/10、AC-53 4/4、AC-17 9/9、AC-26 阻塞 5/5、AC-52 12/12，全部与记录一致。 |
| 6 | 数字一致（report / acceptance-* / summary / results 四处） | **FAIL（2 处）** | 总量同源且一致：67 / 55/10/2 / 714（684/30）/ 451 / 537 文件 / 分级 58+4+5，四处逐一复算全中。但 ① `report.md:203` 写 AC-53 `3/3`，同文件 §2 与 fixture/summary/jsonl 均为 `4/4`；② `acceptance-fixture.md` §二汇总 `7 + 3 − 1 = 9` 却写「仍是 10 条 AC」，且 **AC-67 未进任何一类**。 |
| 7 | 需求评审闭环已 PASS | **PASS（有 1 处陈旧状态字样）** | `review-round1.md` FAIL → `r2` FAIL → `r3` **PASS**（阻断 0 / 建议 0 / 覆盖表 15/15 / 反向扫描无夹带 / DoR 13/13）；`requirement.md` 67 条 AC、v3 与附录 C 末行一致、本轮未被改动。**但头部 `状态：修订稿…待第 3 轮评审` 未更新**，与 r3 PASS 矛盾（DoR#1 的「已定稿」字样不满足）。 |

**七项结论：2 PASS（第 3 按项目口径、第 7）/ 5 FAIL（第 1、2、4、5、6）→ 总判定 FAIL。**

## 5. 阻断项与必须处置

| # | 项 | 谁来做 | 做什么 | 不做会怎样 |
|---|---|---|---|---|
| 1 | **8 条需求冲突**（AC-15、23、37、42、43、45 的 C05、63、67） | **用户** | 逐条书面裁决：改 Then/机检，或明确接受该 AC 以「不通过」收口（即放弃 Done#1）。改法：AC-15 改「除 `state/recovery` 外内容不变」；AC-23 去掉「不进入运行中」；AC-37 改观测通道或允许图外节点；AC-42/43/45/63 改「按实际节点与轮次」；AC-67 改 Given 或允许「冷却中」。 | Done#1、#2 永远不达成，I1.8 无法收口；下一轮终验会重复判 FAIL。 |
| 2 | **AC-45 的 4 条时序假阴性** | 验收 Agent | 把 C07~C10 的读点从「timeout 事件出现即读」改为「等 `escalations` / 实例 `suspended` 落盘（或轮询状态到终态）」再读，重取证。 | AC-45 继续带着 4 条**不成立**的失败记录进入统计，30 条失败里 4 条失真，归因与后续裁决都会被误导。 |
| 3 | **AC-58 双项目根** | 验收 Agent | 按 Given 用**一个**项目根同时含回流崩溃与 human 节点；把 kill 点移到「已有 done 节点 + 有 in-flight」窗口，观察窗延长到「完成/升级」。 | 「回流崩溃→恢复→人工作业→完成」的端到端始终未被同一实例证明，只能永久记为夹具缺口。 |
| 4 | **AC-62 投递失败接缝** | 验收 Agent / 实现 Agent | 给 mock 增「重投前 N 次确定性 prompt 失败」接缝（产品侧 expired/升级已实现且有单测）。 | AC-62 的 Then 无法在端到端取证，继续 2/9。 |
| 5 | **AC-26 / AC-27 阻塞豁免** | **用户** | 确认 `_acc8-f-blockers.md` 的书面豁免（不改判通过、不计 0）；或在有 `dsh` CLI 的机器补验。 | Done#2 的「阻塞 = 0」永远不成立；若口头默认，等于用「豁免」掩盖阻塞，违反 §4.5。 |
| 6 | **记账不一致** | 主控 | ① `report.md:203` 改 `4/4`；② `acceptance-fixture.md` §二汇总改为「需求冲突 8（含 AC-67）+ 夹具缺口 3 − AC-45 重复 1 = 10」；③ `docs/index.md` 同步并补 AC-67；④ `requirement.md` 头部状态改为「定稿，r3 PASS」。 | Done#6 不过；且归口表少一条 AC，后续裁决会漏项。 |
| 7 | **跨迭代证据污染（可复现）** | 实现 / 主控 | `test/wp11/perf.test.js:30-40` 的 `putEvidence()` 每次全量跑都会改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`（我两次实跑都触发，已用 `checkout-index` 恢复）。改为写 `%TEMP%`，或把该目录标为生成物。 | 任何人跑一次全量/AC-53 门禁，工作区必脏；「被验证提交 = 干净工作区」无法自然成立，只能靠手工恢复。 |
| 8 | **AC-56 判据授权 + `.gitattributes` 留痕** | **用户 / 主控** | 用户确认 AC-56 的「基线值 2 / 单文件 diff」口径；主控在 `decisions.md` 补一条 `.gitattributes` 证据树空白豁免的裁决（写明「不改变字节、只关告警」与覆盖范围含手写 `.part.md`）。 | AC-56 的通过依赖未授权的判据改写；卫生门禁的例外扩大没有可追溯依据。 |

## 6. 与上一轮终验的差异

| 维度 | 上一轮（`d054ca2` + 未提交工作区） | 本轮（`956cbdc` 干净 HEAD） |
|---|---|---|
| 被验证对象 | HEAD 结论 46/19/2，工作区 53/12/2，**代码与用例未提交** | **HEAD 即结论 55/10/2**，`git status` 0 行，代码/用例/证据全部入库 |
| AC 结论 | 53 通过 / 12 不通过 / 2 阻塞 | **55 通过 / 10 不通过 / 2 阻塞**（AC-49 4/7→7/7、AC-60 6/8→10/10、AC-53 2/3→4/4；AC-08/AC-31 按 `batch7-isolated-rerun.txt` 的独占复跑定为 flake 后转绿——这两条我**未实跑**，只核了台账与 jsonl 终值） |
| 产品缺陷 | 2 条未返工（reuse 未接线、pending-ready 缺派发） | **0 条**（我独立复跑 AC-49/AC-60 确认） |
| AC-53 白名单 | 有 `KNOWN_FLAKES` 3 条（含 2 条三主链），属预赦 | **已撤销**，改为运行时逐条独占复跑；本次 `extra=(空)` |
| AC-26 空集 ✓ | C04 在 `files:[]` 上判 ✓，自相矛盾 | **已移除**，5/5 只含可取证项，阻塞如实保留 |
| 提交范围 | 产品修复 commit 夹带 435 份 evidence；另有 iter-4 证据被提交 | fix/test 两提交 **evidence 均为 0**；`639ace7..HEAD` 对 iter-4 **无提交** |
| 收口文档 | report / summary / blockers / acceptance 全缺 | **全部存在**，总量数字四处同源 |
| 门禁数字 | 1922/1890/21/11 | **1927/1895/21/11**，两次独立跑失败集合逐条相同，EXTRA=0，MISSING=1 |
| 仍 FAIL 的原因 | 12 不通过 + 2 阻塞 + 过程性阻断 | **10 不通过 + 2 阻塞**；Done 第 1/2/4/5/6 项不过 |

**本轮新发现（上一轮未提）**：

1. **AC-45 的 4 条失败是取证时序假阴性**：`events` 止于 seq 31、`state.updatedAt` 仅比 timeout 晚 5ms，升级事件 #32~#35 在其后落盘；AC-45 实质只剩 1 条（C05 文案）不成立。文档把 AC-45 同时计入「需求冲突」与「夹具缺口」，但 `report.md` §5.1 只写「需求文案」，未写这 4 条。
2. **归口算术错误且漏 AC-67**：`acceptance-fixture.md` §二 `7 + 3 − 1 = 9`，却声称「仍是 10 条」；AC-67（需求冲突）没进汇总表。正确为 **8 + 3 − 1 = 10**。`docs/index.md` 同样漏 AC-67、把 AC-45 记两次。
3. **`report.md:203` AC-53 `3/3` 与同文件 §2 `4/4` 自相矛盾**（fixture/summary/jsonl 均为 4/4）。
4. **跨迭代证据污染是可复现的测试副作用**：根因是 `test/wp11/perf.test.js:30-40` 写 `docs/iterations/iteration-4/evidence/`，不是一次性提交失误；`progress.md` 记的 `wp10` 文件名也不对。任何全量/AC-53 跑都会弄脏工作区。
5. **AC-58 的 Given 被拆成两个项目根**：C14~C16（人工节点）与 C01~C13 不同源，未满足「一个独立项目根」。
6. **`requirement.md` 头部状态陈旧**：「修订稿…待第 3 轮评审」与 r3 PASS 矛盾，DoR#1 的「已定稿」字样未落实。
7. **AC-53 C04 是弱断言**：`|| failures.length > 0` 使其恒真，失去「TAP 计数与失败名一致」的排错能力。

**上一轮已提、本轮仍未修**：AC-03 备注与 33/33 自相矛盾；AC-62/AC-58 的 `false ([...])` / `false ()` 打印形态不可读；AC-56 判据改写未获授权。

## 附录 A 复跑原始帧索引

**留档位置**：`C:\Users\xuesh\AppData\Local\Temp\acc8-rerun\docs\iterations\iteration-8\evidence\acc8\`（覆盖前原始帧备份：`C:\Users\xuesh\AppData\Local\Temp\acc8-orig\acc8\`）。全量前台日志：`C:\Users\xuesh\AppData\Local\Temp\full-test.log`；失败集合：`...\now-reds.txt`；AC-53 内部跑的失败集合：`...\ac53-reds.txt`。

| AC | 我实跑结果 | 复跑帧（留档处） | 恢复动作 |
|---|---|---|---|
| AC-49 | **通过 7/7** | `AC-49.part.md`、`AC-49.then.instance-log.txt`、`AC-49.then.state.json`、`AC-49.given.driver-*.txt` | 已 `checkout-index` 恢复回 HEAD |
| AC-60 | **通过 10/10** | `AC-60.part.md`、`AC-60.then.graph-hold.*`、`.then.graph-after.*`、`.then.state-hold/after.json`、`.then.dispatch.json`、`.then.events.jsonl`、`.given.state.json` | 已恢复 |
| AC-53 | **通过 4/4** | `AC-53.part.md`、`AC-53.machine.full-suite.log`（我这次跑出 1927/1895/21/11）；`AC-53.diffset.txt` 与 HEAD 逐字相同故未复制 | 已恢复 |
| AC-17 | **通过 9/9** | `AC-17.part.md` 及 7 份 `AC-17.*` 帧 | 已恢复 |
| AC-26 | **阻塞 5/5** | `AC-26.part.md`、`AC-26.before.workspace.artifacts.json`、`.then.events.recovery.json`、`.then.recover.log` | 已恢复 |
| AC-52 | **通过 12/12**（额外复跑，覆盖 Done#3 的三主链） | `AC-52.part.md`、`AC-52.given.worktree-add.txt`、`AC-52.machine.i19-regression.log` | 已恢复 |

**复跑口径**：每条都是 `node probe/acc8-f-run.mjs AC-XX` 单条独立跑（AC-53 内部再跑一次全量），不是引用既有日志；跑完 `git status --porcelain` 一度出现 33 项改动（含 `test/wp11/perf.test.js` 触发的 3 份 iter-4 证据），全部用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 还原，收尾 0 行。**未实跑**：AC-27 的真实第三方面（本机无 `dsh` CLI，沿用原始 stderr 帧）、其余 61 条 AC（只做证据抽查，未逐条复跑）。
