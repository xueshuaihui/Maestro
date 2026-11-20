# I1.8 终验报告（独立终验 Agent）

- 终验时间：2026-11-21T01:20:00+08:00（UTC 2026-11-20T17:20Z）
- 被验证提交：`d054ca2b7de7198373079ecbe93bd8c0916078f0`（`fix(I1.8): 恢复失败可见原因（AC-17）+ 终验全跑 67 条取证`）
- 被验证状态：**HEAD + 未提交工作区**（见 §1#6：当前结论由工作区产出，HEAD 自带证据是另一组数字）
- 依据：`docs/templates/execution-template.md` §3.6（六项校验）/ §4.5（Done 七项）

## 0. 总判定

**FAIL。** 67 条 AC 实际为 **53 通过 / 12 不通过 / 2 阻塞**，Done 七项中 **5 项 FAIL**（第 1、2、4、5、6 项），阻断 14 条 AC 未收口；另有 1 项过程性阻断（产品代码与用例未提交、`report.md`/全量 `summary.json`/全量 `blockers.md` 三件产物缺失、四处数字互相矛盾）。**不得宣布 I1.8 需求结束。**

## 1. 六项校验

| # | 校验项 | 判定 | 实跑命令与输出摘要 |
|---|---|---|---|
| 1 | 结果完整性 | **FAIL** | `wc -l docs/iterations/iteration-8/evidence/acc8/_acc8-f-results.jsonl` → **67** 行、67 个 AC 均有结论，但 `last-per-ac` = `{通过:53, 不通过:12, 阻塞:2}`，与「通过=67 / 不通过=0 / 阻塞=0」不符。全量 `_acc8-f-summary.json` / `_acc8-f-blockers.md` **不存在**（`ls` 报 No such file）；仓内唯一 `summary.json` 是 `evidence/wp7/_acc8-f-summary.json`，只覆盖 9 条，且其中 AC-53/AC-56 仍写「不通过」（已过期） |
| 2 | 证据支撑性 | **FAIL** | 抽查 12 条（§2）。**8 条支撑成立**；**4 条不成立/不可采**：AC-26 C04 在空集上判 ✓（`artifactsDirExists:false`、`files:[]`）、AC-57 仅 1 份证据帧且备注自述「未找到 AC-57 独立探针帧」（该探针实际存在）、AC-03 备注仍写「示例不可兼得、按原文如实判定」与 33/33 通过矛盾、AC-62 C08/C09 期望值以 `false([...])` 形态呈现、不可复核 |
| 3 | 判定未被放宽 | **FAIL** | 5 条不通过项断言与需求 Then 逐字一致（AC-15/AC-37/AC-42/AC-45/AC-62 原文未改）。但 **AC-53 判据被放宽**（新增 `KNOWN_FLAKES` 白名单，见 §3）；AC-56 属纠正但授权链不足；AC-08 C07 属纠正。详见 §3 |
| 4 | 门禁与回归 | **PASS** | 全量：`tests 1922 / pass 1890 / fail 21 / skipped 11`，EXIT=1；失败集合对基线 22 条 **EXTRA=0、MISSING=1**（`live 取消` 转绿）。`purity-check` → `OK: 扫描 45 个文件…零命中`，exit **0**。`dependencies` 键数 **0**。`node bin/orch.js --help \| wc -l` → **31**。`NODE_STATES.length` → **7**。数字与 AC-53 证据帧（1890/21、差集 0）**一致**，与主控报告（1889/22、剔除 3 条 flake）**不一致** |
| 5 | 缺陷与遗留 | **FAIL** | 67 条口径的 `blockers.md` **不存在**，只有 WP-7 末批 9 条版且含 2 条过期结论；`report.md` **不存在**，无法核 §5「不影响结论」清单。12 条不通过在 `decisions.md` 裁-20d/e/f 与各 `AC-XX.part.md` 有归口，但**其中 2 条是未完成的产品缺口**（AC-49 reuse 未接线、AC-60 缺 D-5 第 5 步 pending-ready 派发），被归为「返工项」而非「不影响结论」——这一点是对的，但同时说明收口未完成 |
| 6 | 提交范围 | **FAIL** | `git log --oneline d054ca2~3..HEAD` 三个 commit。`d054ca2` 同时改 `src/core/orchestrator.js`（AC-17 修复，13+/5-）与 **435 份 `evidence/acc8/**`** → 产品修复 commit 夹带证据帧。`b1662c4`/`f2b9007` 另提交了 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`（跨迭代证据污染）。`git status --porcelain` → **436 M + 2 ??**，其中 **`src/core/orchestrator.js` 与 7 个 `probe/acc8-cases/*.mjs` 未提交**（§1#6 关键） |

### 1.1 关键补充：被验证提交 ≠ 产出结论的代码

`git status` 显示工作区有未提交改动的**产品代码**与**验收用例**：

```
 M src/core/orchestrator.js        # 裁-20g CAS 冲突重试 + 显式中断（30 行）
 M probe/acc8-cases/AC-01.mjs      # retest-slow 精确窗口
 M probe/acc8-cases/AC-08.mjs      # C07 断言改写
 M probe/acc8-cases/AC-03/09/24.mjs
 M probe/acc8-cases/AC-53.mjs      # 新增 KNOWN_FLAKES 白名单
 M probe/acc8-cases/AC-56.mjs      # 裁-12 重判口径
```

对 `HEAD` 取出的证据统计：`git show HEAD:…/_acc8-f-results.jsonl` → **46 通过 / 19 不通过 / 2 阻塞**。即：**HEAD 自带的证据结论是 46/19/2，工作区才是 53/12/2**。任何按 `HEAD` 复核的人会得到不同答案；AC-03 的 `HEAD` 版 `part.md` 至今写「不通过 29/33」。这是终验无法签字的首要原因。

## 2. 抽查明细

| AC | 判定 | 证据文件 | 证据是否支撑 | 说明 |
|---|---|---|---|---|
| AC-03 | 通过 | `AC-03.then.checkpoint.json`（18 键）、`AC-03.part.md` 33/33 | **部分** | 检查点原始帧真实、字段齐全；但 `task`（用户任务全文 3 行）落在检查点内，用例以「提示词全文 = 实际派发提示词」自解释判通过，C-04 原文列举的可存项不含 `task` → 口径需用户确认。`## 备注` 仍是旧的「示例不可兼得、未放宽」文案，与 33/33 通过自相矛盾 |
| AC-08 | 通过 | `AC-08.part.md` 9/9、C07 崩溃前/后节点对象 | **是** | 崩溃前 `T-002 running round=2`，恢复后同值；C03=`node.dispatch 0`、C05=`提示次数未增`，共同支撑「未重放」。窗口改为 `retest-slow` 后与需求 Given 对齐，断言从「绑死 round 1→2」改为「running + round 不回退」，是纠正错误现场（见 §3） |
| AC-17 | 通过 | 我复跑后新帧 `AC-17.then.instance-log.txt` | **是** | 独立复跑 `node probe/acc8-f-run.mjs AC-17` → **通过 9/9**；日志末行 `恢复失败：host_unreachable；实例已中断（可执行 orch instance log 查看详情）`，与 Then 逐字同构，修复真实生效 |
| AC-52 | 通过 | `AC-52.machine.i19-regression.log`、12/12 核对项 | **是** | 真在 `%TEMP%` detach `014fa6a` 建基线 worktree 做三链归一化 diff，C01/C12 覆盖基线创建与清理，支撑「非恢复路径逐字不变」 |
| AC-57 | 通过 | `AC-57.given.isolation.json`（53 KB，唯一一帧） | **部分** | 帧内 `~/.dsh` 前后 `mtimeSec` 相同、`entries` 相同、`isolatedRemoved:true`、git 前后一致，实质可复核；但仅 1 份证据、且 `## 备注` 写「未找到 AC-57 独立探针帧（可先跑 node probe/acc8-realhost.mjs）」，而该探针文件确实存在 → 备注过期、证据链单薄 |
| AC-53 | 通过 | `AC-53.machine.full-suite.log`（435 KB）、`AC-53.diffset.txt` | **是（但判据被改宽）** | 帧内 `1922/1890/21/11`，与我实跑逐字一致；`diffset` 显示新增 0、未知新增 0。C02 名称已从「新增失败集合（差集）为空」改为「新增失败 ∖ 已证伪 flake = 空」并植入 3 条白名单（§3） |
| AC-56 | 通过 | `AC-56.machine.gates.txt`（6 条 grep 输出） | **部分** | C04 期望值 `2` 与需求原文「无命中（0）」相反；我独立核验：`014fa6a` 处已有 2 处命中（`code-isolation.js:6`、`orchestrator.js:2258`），且本迭代 10 个改动文件 **新增行 worktree 命中 0**。实质结论成立，但记录的证据只扫 `orchestrator.js` 的 diff，范围窄于需求，且改判据未获用户书面授权 |
| AC-26 | 阻塞 | `AC-26.before/after.workspace.artifacts.json`、`AC-26.part.md` 6/6 | **否（C04 不成立）** | 总判定「阻塞」方向正确；但 C04「产物 mtime/sha 不变」在 `artifactsDirExists:false`、`files:[]` 上判 **✓**，与备注「不用空集冒充通过」直接冲突；`6/6 通过` 的表头会误导读者以为该条只剩半条未验 |
| AC-27 | 阻塞 | `AC-27.probe.third-party-boot.txt`、安装记录 | **是** | 真实 `npm install dsh-acp-server@0.14.4`（95 包）→ bin 启动抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME`，原始 stderr 留存；C03 的期望/实测写成 `exit 1` / `false (exit 1)` 表述混乱，但结论可复核 |
| AC-37 | 不通过 | `AC-37.then.graph.txt`、`AC-37.then.status.txt` | **是** | 我独立复跑 `AC-37` → **不通过 9/10**（与记录一致）。graph 只渲染 T-001/T-002，status 有 `节点 T-004 执行中 · 第 1 轮` 但无「等待人工」后缀，与 Then 逐字要求不符，证据直接支撑判定 |
| AC-15 | 不通过 | `AC-15.then.sha256-before-after.txt`、`AC-15.then.instance-log.txt` | **是** | 日志逐字含 `旧实例无检查点：已中断（如需继续请新建实例）`；sha 前后 `d7e905…` → `c40649…` 变化，机检「sha256 不变」客观不成立。证据支撑「9/10、1 条不通过」 |
| AC-62 | 不通过 | `AC-62.part.md` 2/9、`handoff-list.txt`（`已接受`）、`events.jsonl` | **是（表述不可读）** | 交接包实测 `accepted`、`deliveryAttempts=1`、`escalations=0`，与 Then 的 `expired/3/1` 全面冲突，结论可信；但 C08/C09 的期望/实测值以 `false([...])` 形态打印（`expected` 与 `actual` 视觉相同而结果 ✗），第三方无法独立判断断言内容 |
| AC-49 | 不通过 | `AC-49.part.md` 4/7、两轮会话 id | **是** | 两轮开发会话 id 不同（`mock-sess-9600-1` / `mock-sess-23068-1`）、`session/new=2`、无复用行，支撑「reuse 未接线」 |
| AC-67 | 不通过 | `AC-67.part.md` 7/9、`role show` 文本 | **是** | 实测 `冷却中 · 活跃会话 0/1 · 服务节点 —`，与 Then「可用」冲突；`roleToSessions.developer` 仍留 idle 会话，两条均支撑 |

> 抽查覆盖：通过 4 条（AC-03/08/17/52/57/53/56 共 7 条）、不通过 4 条（AC-37/15/62/49/67）、阻塞 2 条（AC-26/27）、门禁类 AC-53、真实宿主 AC-26/57、修复后转绿 AC-03/AC-17 —— 满足要求并超出。

## 3. 判定是否被放宽（独立结论）

| 处 | 需求原文 | 实际判据 | 独立结论 | 理由 |
|---|---|---|---|---|
| **AC-56**「全仓命中 = 基线值 2」 | `grep -R "artifact_type.*dir\|merge.*order" src/core src/daemon` **无命中**（=0） | 改为「恰好等于基线值 2」，另加 `orchestrator.js` diff 零命中 | **纠正错误现场，但授权不足** | `git grep 014fa6a` 证明基线本就有这 2 处（I1.7 自身代码），需求原文的「0」在立项时即不成立，Given「origin/main 不含 I1.7」也已被推翻；我独立核验本迭代 10 个改动文件**新增行 worktree 命中 0**，实质结论（恢复不依赖 worktree）成立。**但 AC-56 的 Then 末句只授权「合入后按同一套 AC 重跑」，未授权改判据**——改判据属需求修订，需用户书面确认。另：C02/C03 只扫 `orchestrator.js`，范围窄于需求，属隐含收紧面；记录应补「10 个改动文件全扫」的帧 |
| **AC-53**「差集 ∖ 已知 flake」 | 与 `origin/main` 的失败集合**差集为 0**；不要求零失败 | 改为「差集 ∖ `KNOWN_FLAKES` = 空」，白名单 3 条：`--host-error 早返回…`、`三主链：A-0 归一化后多次运行不得低于 I1.7 收口基线（每条链 ≥2 次）`、`三主链：无新增可见词，且归一化后与 I1.7 收口基线逐字一致（AC-03）` | **放宽** | 三条白名单里有 2 条是 **`test/wp13` / `test/wp9` 的三主链回归断言**，它们既不在基线红名单里（基线红是另外两条同名不同文的「三主链…」），也在本次实跑中全绿。也就是说：**只要这三条（含两条三主链）变红，AC-53 仍然通过**。这恰好放掉了 Done#3 最核心的门禁。本轮 `diffset.txt` 记 `flakes:（空）`、`unknown:（空）`，**本次没用上该豁免**，所以「本次差集 0」仍按原文成立；但判据本身已被改宽，且主控回执「剔除 3 条已证伪 flake 后差集 0」与证据（0 条剔除）矛盾 |
| **AC-08 C07** | 「上一轮『失败』的测试节点没有被当成『已完成』重跑」 | 由「崩溃前 round===1 且恢复后 round===2」改为「崩溃时 `running` 且 `round>=2`，恢复后 `round` 不回退」 | **纠正** | 旧断言绑死的是「固定 `killAfter=2500` 只抓到 T-002 第 1 轮」这一**错误现场**的产物，与需求 Then 无对应关系；新断言仍能排除两种错误（被当 done 会 `state=done`；从头重跑会 `round=1`），并配合 C03/C05 的「零新增派发 / 零新增提示」闭环。判据强度未降 |
| **AC-20/AC-23 三方言降级** | AC-23：三方言全失败 → 节点「已分配」、角色可用、交接「待投递」、**实例不进入「运行中」** | 产品改 `all_dialects_failed` 的 `unavailable:true → false`，实例保持 `running` 继续调度；AC-23 判 8/10 不通过 | **不是放宽（是对需求的单边取舍）** | 该改动让 Then 前三个分句由不成立变成立（3 项由 ✗ 转 ✓），第 4 分句（不进入运行中）则由「被中断」变成「运行中」，仍判不通过——判定没被放宽，但产品选择与 Then 第 4 分句结构性冲突，须用户裁决「改 Then」或「改产品」。`session/new` 预开会话导致的第 2 条失败同属结构性冲突 |

> 结论：**放宽 1 处（AC-53）、纠正 2 处（AC-56 / AC-08 C07，其中 AC-56 需补授权）、取舍 1 处（AC-23 三方言降级，需裁决）**。放宽的那处本轮未被使用，可作为「撤销白名单」的低成本修复。

## 4. Done 七项

| # | 条件 | 判定 | 依据 |
|---|---|---|---|
| 1 | 需求里的任务全部通过（67 条 100% 通过） | **FAIL** | 53 通过 / 12 不通过 / 2 阻塞（`_acc8-f-results.jsonl` 67 行，last-per-ac 统计）。未通过：AC-15、AC-23、AC-37、AC-42、AC-43、AC-45、AC-49、AC-58、AC-60、AC-62、AC-63、AC-67；阻塞：AC-26、AC-27 |
| 2 | 零失败、零阻塞 | **FAIL** | 不通过 = 12 ≠ 0，阻塞 = 2 ≠ 0 |
| 3 | 门禁全绿（全量测试全通过、扫描 exit 0、零依赖、三主链符合预期） | **PASS（按 AC-53 已评审口径）** | 实跑 1922/1890/21/11，失败集合 **EXTRA=0**（21 条全部 ⊆ 基线 22 条，`live 取消` 转绿），条数 1922 ≥ 基线 1841；purity exit 0（45 文件零命中）；deps 0；`--help` 31 行；`NODE_STATES` 7；AC-52 三主链 12/12。**注**：按 §4.5 字面「全量测试全通过」不成立（21 条既有噪声红仍在），此处采信需求 AC-53 明写的「不要求零失败」——该豁免本身需用户认可 |
| 4 | 缺陷与遗留收口 | **FAIL** | 67 条口径 `blockers.md` 缺失；`report.md` 缺失（无法核 §5）；2 条产品缺口未返工（AC-49 reuse 派发未接线、AC-60 缺 D-5 第 5 步 pending-ready 派发）；AC-53 白名单、AC-56 改判据两处未经用户书面确认 |
| 5 | 终验与复核 | **FAIL** | 本终验总判 FAIL（第 1、2、4、5、6 项不过），故第 5 项不成立；主控侧「独立复跑 3~5 条关键 AC」未见独立留帧（`decisions.md` 记的复跑发生在批一~批五期间，非终验前最后一次全跑之后） |
| 6 | 数字一致（report / acceptance / summary / results 四处） | **FAIL** | 四处只有一处存在且本身有三个版本：`results.jsonl` 工作区 **53/12/2**、`HEAD` 版 **46/19/2**、`evidence/wp7/_acc8-f-summary.json` **5/2/2（9 条）**；`report.md`、`acceptance-fixture.md`、`acceptance-product.md` **均不存在**；`progress.md` 仍写「17 条不通过」并声称四件产物已产出（实际只有本文件） |
| 7 | 需求评审闭环已 PASS | **PASS** | `review-round1.md` FAIL → `review-round2.md` FAIL → `review-round3.md` **PASS**（阻断 0 / 建议 0、DoR 13/13、覆盖表 15/15、反向扫描无夹带），`review-round1..3` 齐全、F/N 项清零、头部版本 v3 与附录 C 一致。**注**：评审 PASS 的需求里仍含 6 条自身矛盾的 AC（AC-15 sha 与转 interrupted 互斥、AC-42/43/45 的 T-003/2/3 示例、AC-37 图外节点、AC-60 分句互斥、AC-67 与角色六态冲突、AC-53 的 992 条旧基线）——这是评审质量问题，另记 |

**七项结论：3 PASS（第 3 按项目口径、第 7）/ 4 FAIL（第 1、2、4、5、6）→ 总判定 FAIL。**

## 5. 阻断项与处置建议

### 5.1 未通过的 14 条 AC

| # | AC | 现象 | 归口 | 建议动作 | 需用户书面裁决 |
|---|---|---|---|---|---|
| 1 | AC-49 | 两轮开发各建会话（`session/new=2`），无「会话 复用」行；`src/core` 零处读 `session_policy`，`buildSession` 不写 `roleId/instanceId` | **产品缺口** | S2 级返工：CLI 创建实例时快照 `session_policy` → 派发路径 `selectReusableSession` 命中即 `resumeOrCreate({policy:'reuse'})` → 写复用行；补单测 + 全量回归 | 是（返工 or 记为已知缺口收口） |
| 2 | AC-60 | 恢复后 `pending+phase='ready'` 节点未派发（`T-001 dispatch 0→应为 1`）；同时机检「phase 逐项相同」与 Then「可调度的被派发」互斥 | **产品缺口 + 需求冲突（双因）** | ① `recoverInstance` 收集 `nodePosition==='ready'` 加入 plan；② 修订机检为「依赖未满足节点 phase 不变、可调度节点允许 ready→running」 | 是（机检必须改，否则产品改了也过不了） |
| 3 | AC-15 | `state.json` sha256 前后不同（`d7e905…`→`c40649…`），因 `markInterrupted` 必重写 | **需求冲突** | 修订机检为「除 `state/recovery` 字段外内容不变」或「sha 变化但语义等值」，保留「不重写旧快照主体」的实质 | 是 |
| 4 | AC-23 | 实例 `running`（Then 要求不进入运行中）；`session/new` 预开会话导致「失败后无新会话」不成立 | **需求冲突** | 改 Then 第 4 分句为「不假装恢复成功（节点 assigned / 角色 available / 交接待投递）」，去掉「实例不进入运行中」；第 2 分句改为「三方言全部失败时不留活动会话」 | 是 |
| 5 | AC-37 | graph 只渲染图声明节点，夹具 `T-004` 不在内建 `code-loop` 图内；status 行缺「等待人工」后缀 | **夹具缺口（图声明）** | 夹具改为「图声明内含 human 类型的 T-004」，或把 Then 的观测通道改为 `instance status` 并在 `status` 节点行补后缀 | 是（二选一，会动三主链基线） |
| 6-8 | AC-42 / AC-43 / AC-45 | 文案示例逐字要求「节点 T-003 · 轮次 2/3」，内建图无 T-003、`maxRounds=2` | **需求冲突（示例数字）** | 把示例改为实际现场（`T-001 · 轮次 1/2`），保留「重建会话 / 重建失败升级 / 超时升级」的文案结构断言；或提供 T-003+maxRounds=3 专用测试图 | 是 |
| 9 | AC-58 | e2e 恢复后只等 5 s，实例仍 `running` 未到终态；另有 `recovery.handoff created→delivered` 事件与 handoff 视图「已构造」不一致 | **夹具缺口 + 可观测性观察项** | 延长观察窗至终态（或按事件轮询代替固定 5 s）；事件/视图不一致单列观察项 | 是（观察窗属夹具口径） |
| 10 | AC-62 | 重投首条 prompt 即 `accepted`，取不到「连续 3 次失败 → expired」；缺投递失败接缝 | **夹具缺口**（产品侧 `expired`+`delivery_failed` 已实现） | 给 mock 增「重投前 N 次确定性失败」接缝，或允许 `MAESTRO_MOCK_PROMPT_FAILURES` 作用于重投路径 | 是（补接缝 or 判阻塞） |
| 11 | AC-63 | 示例「T-003 · 轮次 2/3」不可得（同 AC-42 类）；`session/new` 次数差 1 已满足 | **需求冲突（示例数字）** | 同 AC-42/43/45，改示例为实际节点与轮次 | 是 |
| 12 | AC-67 | 实测「冷却中」，Then 要求「可用」；命中 `role-instances.js` 的 `doneCount>0 → cooldown`（I1.5 契约） | **需求冲突** | 修订 Given（改为「节点均为 `cancelled`/`failed`，或角色无服务历史」）或修订 Then（允许「冷却中」） | 是 |
| 13 | AC-26 | `workspace/artifacts/**` 锚点空转：`artifactsDirExists:false`、`files:[]`；产物在 I1.7 `worktrees/`+`stage/` | **需求冲突（机检锚点失效）** | 锚点改为「`worktrees/<role>/**` 与 `stage/**` 的 mtime/sha 不变」并重跑；C04 在空集上不得判 ✓ | 是（改锚点） |
| 14 | AC-27 | 第三方 ACP 服务端在本机无法启动（`ERR_UNSUPPORTED_ESM_URL_SCHEME`，无 `dsh` CLI） | **环境缺口（阻塞）** | 保留阻塞；若要关闭，需提供可用的 `dsh` CLI 或书面豁免（load 语义已由 AC-20 夹具覆盖） | 是（豁免） |

### 5.2 过程性阻断（与 AC 判定无关，但同样阻断收口）

| # | 项 | 现状 | 建议 |
|---|---|---|---|
| P1 | 结论所依赖的代码/用例未提交 | `src/core/orchestrator.js`（裁-20g CAS 重试）与 7 个 `probe/acc8-cases/*.mjs` 全在工作区未提交；`HEAD` 证据是 46/19/2 | 拆两个 commit：`fix(I1.8)` 只含 `src/**`；`test+evidence(I1.8)` 只含 `probe/**` 与 `evidence/**`。提交后按 HEAD 重跑全量 |
| P2 | 全量汇总三件套缺失 | `evidence/acc8/_acc8-f-summary.json`、`_acc8-f-blockers.md`、`report.md`、`acceptance-fixture.md`、`acceptance-product.md` 全无 | 跑 `node probe/acc8-f-final.mjs`（默认输出到 `evidence/acc8/`）生成 67 条 summary/blockers；按模板 §4.1/§4.3 补报告与两份验收文档 |
| P3 | 数字四处不一致 | 46/19/2（HEAD）/ 53/12/2（工作区）/ 5-2-2（wp7 summary）/ 17 条（progress.md S4） | 以最后一次全跑工作区版为准，统一回填 progress → report → summary → results，并删除 wp7 过期版或标注「历史批次日」 |
| P4 | AC-53 白名单 | 3 条白名单含 2 条三主链回归断言 | 建议撤销白名单恢复「差集=0」；确需保留则仅允许「该条独占复跑全绿」时生效，并在 `diffset.txt` 强制打印每一条被剔除项及对应隔离帧路径 |
| P5 | AC-26 C04 空集判 ✓ | `files:[]` 却记 ✓ | 改为 `inconclusive`，`part.md` 表头不要写「6/6 通过」，避免与「不用空集冒充」自相矛盾 |
| P6 | 提交范围治理 | `d054ca2` 产品修复夹带 435 证据帧；`b1662c4`/`f2b9007` 提交了 iter-4 的 `nfr-perf-*.json` | 后续迭代把 `evidence/**` 与 `src/**` 强制分 commit；测试写死写到仓内历史证据的 `test/wp10/perf.test.js` 应改为写 `%TEMP%` |

## 6. 终验结论

**未达成 Done。** 七项中第 1、2、4、5、6 项 FAIL：67 条 AC 只有 53 条通过，12 条不通过、2 条阻塞；缺陷台账与报告产物缺失；四处数字不一致；产品代码与验收用例尚未提交。**按模板 §4.5 与 §7 红线 11，现在不许宣布 I1.8 需求结束，也不许用「基本达成 / 实质通过」表述收口。**

关闭路径（按代价从低到高）：

1. **先把事实固化**（P1+P2+P3）：提交代码与用例、生成 67 条 summary/blockers、补 report 与两份 acceptance，四处数字统一到 `53/12/2`。
2. **取得 6 条需求冲突的书面裁决**（AC-15、AC-23、AC-37、AC-42/43/45/63、AC-60 机检、AC-67、AC-26 锚点）——这是 12 条不通过里占比最大的一类，改需求比改产品便宜且不损伤基线。
3. **返工 2 条产品缺口**（AC-49 reuse 派发接线、AC-60 pending-ready 继续调度）+ 补 3 类夹具（AC-58 观察窗、AC-62 投递失败接缝、AC-42 系列专用图）。
4. **AC-27 要么给 `dsh` CLI，要么书面豁免**；AC-53 白名单撤销。
5. 上述完成后由主控独立复跑 3~5 条关键 AC（AC-49、AC-60、AC-53、AC-26、AC-17），再开新一轮终验。
