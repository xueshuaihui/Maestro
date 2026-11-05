# I1.3 需求评审（第 1 路：基线与契约）

> 基准快照：**以 Git 实测为准**。任务书声明「工作区 1836 行 / HEAD 1773 行（+123/-60 未提交）」；本路评审开始时实测 `1837` 行 / `129 65`、收口前复测为 **`1843` 行 / HEAD `1773` 行 / `git diff --numstat = 148 78`（+148/-78）**。`git status --short` 仅 `M docs/iterations/iteration-3/requirement.md`（另有两个本路只读探针 `probe/rv3b-*.mjs` 为 untracked），HEAD = `ba16687`。即**快照在评审期间持续漂移**，与任务书声明及评审中途值均不符；本报告全部结论以收口时工作区快照（1843 行）为准。时间：2026-11-05 22:56 +0800。证据：`[代码实测]`（`git status` / `wc -l` / `git diff --numstat` / `git show HEAD:... | wc -l`）。
>
> 评审口径：只读；只新增本文件。结论一律标注证据分级 —— **`[代码实测]`**（读 `src/**` 真实函数体/导出 + 本路探针脚本实跑）、**`[文档核对]`**（逐字读需求/模板/基线/上游）、**`[待实测]`**（需求声明但本路未运行实例，需拆分后由夹具证明）。遵循「若需求描述与代码现状不符，**以代码为准**并明确指出」。
>
> 本路探针（只读、`probe/rv3b-*.mjs`，可不留）：`probe/rv3b-br-check.mjs`（BR/AC/M/C 编号、AC 规则字段、BR 表覆盖、悬空引用核验）、`probe/rv3b-symbols.mjs`（关键函数/常量 `文件:行号` + 原文定位）。二者均已 `node` 实跑通过。

---

## 0. 总判（可进入拆分 / 需修复后评审，阻断 N）

**需修复后评审，阻断 4 项：M-8、M-6、C-09、AC-38。** `[文档核对 + 代码实测]`

| 维度 | 结论 |
|---|---|
| 模板符合性 | 第二部分（§2.1~§2.10）**符合**「只写用户视角」硬约束；第三部分偏离（机检/夹具/架构检查）已被 §3 前置说明 `requirement.md:591` 合理声明，对照 I1.2 三轮评审已接受口径不判违规；BR/AC 编号与引用**脚本实测全绿**；**§1.2 有 5 个量化指标，超出模板 2~4 个上限** `[文档核对 requirement-template.md:24 / requirement.md:27-33]` |
| 基线一致性 | D-2 迁移表与 `src/core/state-machine.js` node 表**逐行一致、不新增边**；`review(downstream)` 是**子状态**（`review` + `reviewReason`），不打穿状态机；会话 6 态 / 交接包 7 态 / `suspended` / §5.2 数据布局整体一致 `[代码实测]` |
| 与代码冲突 / 会破坏回归的 M/C | **与代码冲突**：M-8。**会破坏回归**：M-1、M-6、M-8。C-09 为「需补契约（阻断）」 |
| AC-28 禁词表结论 | I1.3 的 `AC-28` 是「运行中取消 5 秒内收敛」`[文档核对 requirement.md:951]`，**不是禁词扫描**；禁词扫描实为 **AC-38**。`test/fixtures/purity-check.mjs` 默认目录 `['src/core','src/daemon']`、默认禁词仅 `['code-loop','developer','tester','coordinator']` `[代码实测 purity-check.mjs:21-22]`：新增 `src/core/review.js` / `doc-artifact.js` **会被目录扫到**，但 D-1 红线 1 要禁的 7 个新词、以及 `dsh`/`stdio`/`transport` **都不在默认禁词表**，AC-38 未给可执行扫描命令、D-9 同步清单漏了 `purity-check.mjs` → **架构检查会假通过**（阻断项 4） |
| 最容易被忽略的一条风险 | `orchestrator.js:872` 的 `applyHandoff(ctx.handoff, { ...tracker.snapshot(), edge, defects })` 与 `orchestrator.js:1652-1658` 的 `consumeHandoff()` 是**两处彼此独立的快照重组**；M-4（`requirement.md:96`）与 D-3（`requirement.md:1452`）**只点名了后者**。而 C-09 恰恰要求在「交接包 `accepted` 那一刻」保留新字段并迁移源节点 —— 只改 `consumeHandoff()` 会让 `artifactRefs` / `revisionRequirement` 在 `accepted` 帧（:872）就被抹掉，且该帧目前**根本没有**源节点/会话迁移的落盘通道 `[代码实测 orchestrator.js:868-877]` |

---

## 1. 阻断项（ID | 类别 | 需求:行 | 代码:行 | 现象 | 为什么阻断 | 建议 before→after）

| ID | 类别 | 需求:行 | 代码:行 | 现象 | 为什么阻断 | 建议 before→after |
|---|---|---|---|---|---|---|
| **M-8** | 与代码冲突 | `requirement.md:100`（「`latestEndedNodeId()`（`orchestrator.js` 与 `advance.js` 两处同名逻辑）」）、`requirement.md:1442-1448` | `src/core/orchestrator.js:148`（`latestEndedNodeId(state)`）、`src/core/advance.js:58`（`latestNodeId(nodes)`） | `advance.js` **不存在** `latestEndedNodeId`，只有 `latestNodeId(nodes)`；二者不同名、签名不同（一个吃 `state`，一个吃 `nodes` 数组）。D-3 的「两个同名逻辑必须同步」表（:1446-1447）反而写对了两个不同名函数，M-8 与 D-3 自相矛盾 | 实现者按 M-8「找两处 `latestEndedNodeId`」会**漏改 `advance.js:58`**；而 `advance.js:58` 只认 `done/failed/escalated`（`:62`），`review(downstream)` 永远不被推进层选中 → 下游门控闭环卡死、AC-04/05/07/09 全灭 | before: 「`latestEndedNodeId()`（`orchestrator.js` 与 `advance.js` 两处同名逻辑）」→ after: 「`orchestrator.js:latestEndedNodeId(state)` 与 `advance.js:latestNodeId(nodes)` 两处**不同名**逻辑，均须纳入 `state==='review' && reviewReason==='downstream'`」；以 D-3（:1446-1447）为准 |
| **M-6** | 会破坏回归 + 现状描述与代码不符 | `requirement.md:98`（「`hasSubmittedOutput()` 不再回退到任务里的 `产物：` 行」）、`requirement.md:1628`、`:1631`、`:1724`、`:1157`、`:1562` | `src/core/orchestrator.js:1352-1368`（回退在 `:1359`）、`:1497`（真实签名 `finishArtifactNode(ctx, def)` 两参数）、`:1528`；`src/core/verify-artifact.js:300-343` | ① M-6 把「不回退」写成**全局**，D-8（:1628/:1631）却限定「`declared`（I1.2 缺省）仍走 `productsOfTask`」「仅 `judge:'review'` 节点不回退」，两处口径冲突；按 M-6 字面去掉 `:1359` 的 `productsOfTask(state)` 回退，`single`（I1.1 启发式）与 `code-loop` 的产物判定会变（`products=[]` 时 `:1360` 直接 `return true`），破坏逐字回归。② `verifyProducts()` 返回 6 字段 `{ref, absPath, exists, bytes, mtime, verifiedAt}`（`:336-343`），`finishArtifactNode()`（`:1528`）`{...ref, verifiedAt}` **把 `absPath`/`mtime`/`exists` 全落盘** —— 即 I1.2 现状下 `state.json` **已含绝对路径**，与 NFR-08（:1157）/D-6（:1562）/D-8（:1724）「不得保存绝对路径」**现状即不符**，M-6 现状列（:98）只说「`sha256` 不计算」，未点破 | ① 是回归红线：I1.2 已收口 337/337 用例、`single` 六行逐字，全局去掉回退会打穿。② 若只「追加 `sha256`」而不改 `:1528` 的投影，I1.3 继续违反自己写的 NFR-08，且 AC-37（I1.1 旧格式只读）与新增机检（:1157）无法同时成立 | before: 「`hasSubmittedOutput()` 不再回退到任务里的 `产物：` 行」→ after: 「按 `def.artifactPolicy` 分流：`fixed-workspace`/`versioned-doc` → `doc-artifact.resolveNodeProducts()`；`review` → `readReview()`；**`declared`（I1.1/I1.2 缺省）保持 `productsOfTask(state)` 回退，语义不变**」。并补一句「`finishArtifactNode()` 落盘前显式投影为 `[{ref, bytes, sha256}]`，去掉现存的 `absPath`/`mtime`/`exists`/`verifiedAt`」 |
| **C-09** | 需补契约（帧结构无落盘通道） | `requirement.md:116`、`:1419-1424`、`:1808`、`:1152` | `src/core/orchestrator.js:389-457`（`transit()`）、`:868-877`（`handleUpdate` 的 `accepted` 帧）、`:1647-1658`（`consumeHandoff()`） | `transit()` 是**逐对象、每次一 CAS**（`:402` 读盘、`:410` `expectedOf(disk.state)`、`:457` 一次 `saveState(..., {expectedState})`）；`handleUpdate()` 在 `accepted` 帧（`:868-877`）**只** `applyHandoff()`（`:872`）改交接包 + push 一个 pause（`:877`），**没有**源节点 `review→done`、也没有会话 `waiting_dependency→idle` 的迁移。C-09 要的「两条迁移写进同一个 live 状态、一次 CAS 落盘」在当前帧里**无实现通道**；若用 `transit()` 分别迁移两次，就是两次 CAS、rev 冲突丢状态（正是 C-09 禁止的）。且 `:872` 的 `applyHandoff` 快照重组只透传 `edge`/`defects`，会抹掉 M-4 新增字段（需求只点名 `:1652` 的 `consumeHandoff`） | 下游门控是 I1.3 主链；`accepted` 帧若不合并写，源节点永远停在 `review(downstream)`、会话永远停在 `waiting_dependency`，AC-04/05/07/09/34/35 全灭；字段在 `accepted` 帧被抹掉会让回流包丢 `previous`/`revisionRequirement` | before: 复用 `transit()` 逐对象迁移 / 只改 `consumeHandoff()` → after: 在 `sessionUpdate` 的 `accepted` 帧内**直接改 live 状态**（源节点 + 源会话 + handoff + 下游节点），由该帧**唯一一次 `saveLive` 合并落盘**（不得再调 `transit()`）；同步把「显式重组快照」点名补到 **两处**：`orchestrator.js:872` 与 `orchestrator.js:1652-1658`。并把 C-09「一次 CAS」与 NFR-03（:1152）「一次状态变化最多两次落盘（迁移+收尾）」统一措辞为「两条迁移合并为**一次**，收尾另**一次**」 |
| **AC-38** | 验收口径（架构检查假通过） | `requirement.md:1069-1078`（AC-38）、`:1356-1363`（D-1 红线 1）、`:1803-1815`（D-9 同步清单）、`:33`（§1.2 指标 5） | `test/fixtures/purity-check.mjs:21-22`（`DEFAULT_DIRS=['src/core','src/daemon']`、`DEFAULT_FORBID=['code-loop','developer','tester','coordinator']`） | D-1 红线 1 要求 `src/core/**`/`src/daemon/**` 不出现 `task-loop`/`researcher`/`writer`/`reviewer`/`研究员`/`撰写者`/`审核者` 共 7 个新词；AC-38 也逐字列了这 7 个词。但 `purity-check.mjs` 默认禁词表**只有 4 个 I1.2 旧词**，新词一个都不扫；AC-38 **没有**像 I1.2 AC-28 那样给出可执行扫描命令（`--forbid ...` / 文件数 / 零命中计数），D-9「必须同步的测试」清单**没有** `purity-check.mjs` 或 AC-38 扫描项。新增 `src/core/review.js`/`doc-artifact.js` 会被默认目录扫到，但因禁词表无新词，默认扫描必然 `exit 0` | 「共用同一引擎、核心不出现模板名/角色名」是 I1.3 最高风险架构约束（AC-38 标「风险：高」）；验收命令缺失 + 禁词表未同步 = **假通过**，等于没验。且 AC-38 只扫 3 个文件（:1073），D-1 红线 1 扫 `src/core/**`+`src/daemon/**`，范围也不一致 | before: 「Then ... 中不出现字符串 ...」无命令 → after: 补「`node test/fixtures/purity-check.mjs --dir src/core --dir src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者` 返回 `exit 0`，N 文件零命中」；D-9 同步清单补 `test/fixtures/purity-check.mjs`（或新增 `test/wp*/purity.test.js`）；统一 AC-38 扫描范围与 D-1 红线 1 |

---

## 2. 模板符合性（必答 A）

基准：`docs/templates/requirement-template.md:7-10`（三条硬约束）、`:24`（§1.2「2~4 个可量化指标」）。

**A.1 第二部分（§2.1~§2.10 = `requirement.md:125-588`）是否只写用户视角？**
**符合** `[文档核对 + 代码实测（探针 Grep）]`。用内部实现词表（`expectedState` / `saveState` / `saveLive` / `CAS` / `schemaVersion` / `state.json` / `reviewReason` / `artifactRefs` / `instanceWorkspaceDir` / `productPolicy` / `downstreamGate` / `classifyNodeOutcome` / `planAdvance` / `hasSubmittedOutput` / `consumeHandoff` / `latestEndedNodeId` / `transit(` / `TURN_UPDATES` / `CANCELABLE_NODE` / `halted` / `rev` / `session/`）全文扫描，**§2.1~§2.9（`125-543`）零命中**；§2.10 BR 表（`544-585`）亦零命中。第二部分出现的 `HO-001`/`T-001`（`:210-220`、`:455-517`）、`.orch/instances/.../workspace/` 目录树（`:366`）、`退出码 4/5`（`:313`、`:345`、`:356`）均为 **CLI 输出样例 / 用户可见文件区 / 用户可见退出码**，不是内部字段名、迁移表、接口签名或状态机常量泄漏。

- 需注意但不判违规：附录 A 的 A-2 渲染说明（`:1215-1219`）含 `reviewReason` / `artifactRefs[0].ref` / `halted` 等内部字段名；§3 的「机检」断言（如 `:650` `reviewReason='downstream'`、`:635` `HO-002 的 artifactRefs.input`）也含内部字段。二者**不属于模板「第二部分」的约束对象**，且被 §3 前置说明（`:591`）与 I1.2 已接受口径覆盖（见 A.2）。

**A.2 第三部分 AC 的 Given/When/Then 是否用户可见？偏离是否被合理声明？**
**合理声明，不拿模板硬约束一刀切** `[文档核对]`。`requirement.md:591` 逐字声明：「"机检"表示读取 `.orch/instances/<id>/state.json`、`events.jsonl` 或 `.mock/prompts/<n>.json`；"夹具"表示按 §3.3 的场景名运行；"架构检查"不依赖运行实例」，并声明 `--cwd`/`--root` 执行根规则（与 I1.2 执行根规则一致）。I1.2 三轮评审已接受同类断言：`review-round2.md:15`（「AC-28 架构扫描：exit 0（14 文件、四词零命中）」）、`review-contract.md:217-229`（C-01~C-14 机检口径）、I1.2 `review-baseline.md:24`（D-6/AC-44 机检断言）。因此 AC 里 `And 机检：T-002 的 state='review'`（`:650`）、`Given 项目根里放入 I1.1 的 v1 实例（schemaVersion=1）`（`:1061`）属**已接受的机检类断言**，不是模板违规。每条 AC 的 Given/When/Then 主干（`orch run` / `orch status` / `orch cancel` 命令与可见输出）均为用户可见。

**A.3 每条 AC 是否引用 BR-XX？BR 编号连续、悬空引用？写脚本核。**
`probe/rv3b-br-check.mjs` 实跑结果 `[代码实测]`：

```
BR 定义 38 条（1~38 连续，gaps=[]），defLines=548~585，danglingRefs=[]
AC 43 条（1~43 连续，gaps=[]）
  missingRuleField=[]   ruleWithNone=[]   noBRRef=[]   badRuleRefs=[]
BR 表「覆盖 AC」列覆盖 AC-1~43 全部：danglingAC=[]、uncoveredAC=[]
M 1~10（gaps=[]）  C 1~14（gaps=[]）
```

即：**每条 AC 都有 `**规则**` 字段且都引用了已定义的 BR；无「无」、无悬空引用、无未覆盖 AC；BR/M/C 编号连续**。脚本判定逻辑已逐行复核（`probe/rv3b-br-check.mjs:14` 定义行、` :33` AC 头、`:48` 规则字段、`:64-80` BR 表覆盖列）。模板硬约束 3「每条 AC 必须引用它覆盖的 BR，无对应写『无』」—— 由于 43/43 均引用 BR，本项**符合**。

**A.4 §1.2 指标数 / §1.3 范围外覆盖。**
- §1.2 `requirement.md:27-33` 共 **5 个**量化指标（人工介入 0 次、手工搬运 0 次、旧版覆盖 0 次、审核无效仍回流 0 次、共用 1 套推进逻辑）；模板 `requirement-template.md:24` 要求「**2~4 个**可量化指标」→ **不符合，超 1 个** `[文档核对]`。建议合并「人工介入 0 次」与「手工搬运 0 次」为一项，或把「共用 1 套推进逻辑」移入 §1.3 范围条目（见 §7）。
- §1.3「范围外」`requirement.md:50-64` 共 11 行，每行都有「留给谁」列；其中 `:54-59`、`:60`（后续迭代 R-1）、`:62`（I1.4+）注明了迭代/责任方；**`:61`（部分改写/diff 合并/自动润色 → 「不做」）、`:63`（审核者直接改文件 → 「不做」）、`:64`（非 Markdown → 「后续迭代」）3 项未给具体迭代号或责任方** `[文档核对]`。结论：基本注明，3 项不完整（不阻断，见 §7）。

---

## 3. 基线一致性（必答 B）

**B.5 D-2 不新增边、与 `docs/index.md` §3.1 一致？`review(downstream)` 是子状态还是新状态？会不会打穿 I1.2 状态机？**
`[代码实测 + 文档核对]` **一致，是子状态，不打穿**。

- `src/core/state-machine.js:83-94` node 表逐行：
  ```
  pending: ['running','escalated','cancelled']
  running: ['review','failed','escalated','cancelled']
  review:  ['done','failed','escalated','cancelled']
  done:    ['running','escalated']
  failed:  ['running','escalated','cancelled']
  escalated: ['cancelled']
  cancelled: []
  ```
  与 D-2 迁移表 `requirement.md:1393-1399` **逐行完全一致**；`review` 行与 `state-machine.js:86` 一致；D-2 `:1406`「本迭代不新增任何迁移边，`state-machine.js` 与 `state-machine.test.js` 的迁移表不需要改」**代码实测成立**。
- `requirement.md:1403` 逐字：「下游门控的 `review(evidence) → review(downstream)` **不是迁移**：状态仍是 `review`，只改 `reviewReason`」；`:1404`「`review(downstream) → done` 由下游交接包 `accepted` 触发」。与 `docs/index.md:160-162`「`review` 的两个子原因（不新增看板列，卡片标签区分）」口径一致。
- 因此若**误按新状态**落（新增 `'review(downstream)'` 到 `NODE_STATES`），才会打穿 `state-machine.js:86` 的 `review` 行、`CANCELABLE_NODE`（`:155`，现含 `review`）、`TERMINAL_INSTANCE`（`:142-147`）、以及 `render.js`/`advance.js` 的 `node.state` 判断。**需求 D-2/D-3/D-6（`:1535`）明确为子状态，无此风险**；C-12（`:119`、`:1823`）「取消覆盖含 `review(downstream)`」也自动由 `CANCELABLE_NODE` 覆盖。
- 唯一冲突在 **M-8 措辞**（「两处同名逻辑」），见 §1 / §4 M-8 —— 它不是状态设计问题，是函数定位错误。

**B.6 会话 6 态：C-11 与 I1.2 `session-state.js` / AC-44 `after_output` 口径冲突？守卫被绕过？**
`[代码实测]` **不冲突，守卫未被绕过**。
- `src/adapter/session-state.js:191-195` `onOutputSubmitted()` 置 `rec.state = 'waiting_dependency'`（与 I1.2 v16 `iteration-2/requirement.md:18` D-6「回合结束且**无产出提交**才 `idle`；已提交产出保持 `waiting_dependency` 到核对完成」、AC-44 `after_output` 口径一致）。
- `src/core/state-machine.js:113` `waiting_dependency: ['idle','escalated']` —— C-11「下游接受后 `idle`」有合法出边；审核节点「合法通过/驳回后直接 `idle`」是核对完成后的正常迁移，不新增边。
- `escalated` / `quarantined` 守卫：`session-state.js:88-96`（`if (rec?.state === 'escalated')` / `if (rec?.quarantined)` → `counters.dropped += 1` 丢弃迟到帧）、`:174`、`:185`、`:193`、`:200`、`:212`、`:228` 共 8 处 `if (rec.state === 'escalated') return {... guarded:true}`。C-11/C-12 未新增任何绕过路径。

**B.7 交接包 7 态：D-3 幂等键与 `handoff-tracker.js` 一致？`consumeHandoff()` 显式重组快照是否真实存在？**
`[代码实测]` **一致；该处真实存在**。
- `src/adapter/handoff-tracker.js:135-146`：`observeTurnEvent()` 只认 `TURN_UPDATES.has(name)`（`:136`），未知/噪声帧 `return {ignored:true, noise:true}`（`:139`），且必须 `state === 'delivered'`（`:144`）才迁移；`accepted` 只由 `delivered → accepted` 这一次触发。D-3 `:1408`「幂等键 = 交接包 `accepted` 那一刻」、`:1426-1428`「重复帧 `ignored`、未 `delivered` 不 `accepted`、不接受噪声帧」与代码逐条一致；C-10（`:117`）同源。
- `consumeHandoff()` 定义 `orchestrator.js:1647`；其内「显式重组快照」真实存在于 `orchestrator.js:1652-1658`：
  ```js
  applyHandoff(ctx.handoff, {
    ...ctx.tracker.snapshot(),
    edge: ctx.handoff.edge,
    defects: ctx.handoff.defects,
    note: ctx.handoff.note,
    wakeConsumedAt: ctx.handoff.wakeConsumedAt,
  });
  ```
  M-4（`:96`）点名正确。**但** `orchestrator.js:872` 是另一处独立重组（见 §0「最容易被忽略的风险」、§1 C-09、§4 M-4），需求漏点名。

**B.8 §3.5 一次回流时序 / §3.6 崩溃恢复：AC-11/12 与 C-14 一致？`suspended` 不在 `TERMINAL_INSTANCE` 是否被保持？**
`[代码实测]` **一致，被保持**。
- `src/core/state-machine.js:142-147` `TERMINAL_INSTANCE = ['completed','failed','cancelled','interrupted']` —— **不含 `suspended`**；`:150` `CORE_IMMUTABLE_INSTANCE = [...TERMINAL_INSTANCE, 'suspended']`；`:81` `suspended: ['cancelled']`（唯一出口取消）。`reconcileOnBoot` 不重写挂起实例（D-10 `:1827`）。C-14（`:121`）「`suspended` 保持挂起、`escalated` 节点保持、`failed` 保持等待复审、`review` 不自动重新核对」、AC-11（`:742`）/AC-12（`:753`）与之吻合。
- `src/persistence/instance-store.js:169-174` 注释明确「`schemaVersion:1` 仍只读 / 会把 `rev` 打回 1 导致 `expectedState:{rev}` 全误判」的兼容口径，C-14「`schemaVersion` 不升 3、新增字段可缺省读取」不破坏 v1 只读（AC-37 `:1058`）。

**B.9 能力域与 §5.2：C-01 `instanceWorkspaceDir()` 与 `paths.js` 现状？`WORKSPACE_INIT_FAILED` 落盘顺序与 I1.2 一致？**
`[代码实测 + 文档核对]` **不冲突；与基线 §5.2 一致**。
- `src/persistence/paths.js` 现状**无** `instanceWorkspaceDir()` / `instanceDocsDir()` / `instanceReportsDir()`（探针 `rv3b-symbols.mjs` `[NO HIT]`），只有 `:43 instanceDir(root,id) = <root>/.orch/instances/<id>`、`:90 ensureLayout()`。C-01（`:108`）要求新增 `instanceWorkspaceDir(root,id) = <root>/.orch/instances/<id>/workspace` —— 与 `docs/index.md:606-609`（`.orch/instances/<id>/workspace/{shared,stage,status.md,artifacts/{code,docs,data,reports}}`）**结构一致**，只是本迭代按 R-2（`:81`）只建 `artifacts/docs/`、`artifacts/reports/`，不建 `shared/stage/status.md`。能力域 6「治理与审计」（`docs/index.md:551-571`）要求「产物 scope 隔离」「证据引用校验」「审计事件」，与 D-1 红线、D-7 证据校验方向一致。
- 「先建工作区（失败 → `WORKSPACE_INIT_FAILED`）再建实例」（D-10 `:1839`、`:1841`）与 I1.2「先落盘实例再 `running`」**不矛盾**：I1.2 约束的是「实例落盘必须先于 `running` 状态」，并未要求实例落盘先于工作区创建；I1.3 把 mkdir 插在 `claimGraph` 之前，仍满足「实例落盘先于 running」，且「失败不落实例」避免了半实例，比 I1.2 更严格。当前 `claimGraph`（`orchestrator.js:2160-2186`）先 `saveState`（`:2177`）再带 `expectedState` CAS（`:2186`），顺序可容纳该插入。**需补契约**：步骤 4 `CWD_NOT_WRITABLE`（`:1836`）与步骤 7 `WORKSPACE_INIT_FAILED` 的 mkdir 失败边界、以及 mkdir 与 `claimGraph` CAS 之间不留中间态（见 §7）。
- 参考 `docs/index.md:696-704` I1.3 条目（三内置角色、通用任务闭环、`review_reason` 子状态、与 I1.2 共享同一引擎）与 `requirement.md:66-76` §1.3.1 逐项对应表逐行吻合。

---

## 4. M-1~M-10 逐条（必答 C.10）

判定图例：`可实现` / `需补契约` / **与代码冲突** / **会破坏回归**。

| 编号 | 判定 | 依据（代码:行 或 需求:行） | 一句话理由 |
|---|---|---|---|
| **M-1** | **会破坏回归**（需补契约） | `src/templates/index.js:211-243`；`requirement.md:93`、`:1351` | `promptFor()` 现以 `handoff.edge.kind`（`:221`、`:224`、`:231`）+ `target.prompt==='single'`（`:238`）+ `target.judge==='verdict'` 追加 `VERDICT_REQUIREMENT`（`:242`）分派；D-1（`:1351`）要改成「以 `node.prompt` 为唯一分派键」并新增 `artifactStem/round/defects/revisionRequirement` 参数。若不给 `code-loop` 测试节点保留 `VERDICT_REQUIREMENT`、不给 `single` 保留 `prompt==='single'` 分支，`code-loop`/`single` 提示词逐字变化 → 破坏夹具与输出回归。`[代码实测]` |
| **M-2** | 可实现（措辞须与 M-9/C-02 统一） | `src/core/orchestrator.js:2260`；`requirement.md:94`、`:1359`、`:1619` | `startRun` 当前按 `multi`（`:2260 if (multi && !extractProductLines(task).ok)`）而非模板名分支，M-2「`startRun` 不得按模板名分支」与现状一致；`productPolicy` 图级分流可行，D-8（`:1619`）明确 `declared` 图仍走 I1.2 `extractProductLines` 与 `PRODUCT_LINE_MISSING`。但 M-9/C-02 的「`task-loop` 产物行」措辞需改为按 `productPolicy==='doc-single'`，见 §5 专门问题。`[代码实测 + 文档核对]` |
| **M-3** | 可实现 | `src/persistence/instance-store.js:48-54`；`requirement.md:95`、`:1529-1563` | 全部为追加字段（`reviewReason`/`review`/`artifactRefs[].sha256`/`artifactHistory`），`schemaVersion` 仍 2；I1.2 状态文件读取不受影响。但 `artifactRefs` 落盘投影依赖 M-6 改 `orchestrator.js:1528`（现状含 `absPath`）。`[代码实测]` |
| **M-4** | 需补契约（漏点名一处） | `src/core/orchestrator.js:872`、`:1647-1658`；`requirement.md:96`、`:1451-1452` | `consumeHandoff()` 显式重组快照真实存在（`:1647`、`:1652-1658`）；但 `handleUpdate()` 的 `:872 applyHandoff(ctx.handoff, {...tracker.snapshot(), edge:..., defects:...})` 是**第二处**重组，只透传 `edge`/`defects`（连 `note`/`wakeConsumedAt` 都没有），新字段会在 `accepted` 帧被抹掉；需求只点名 `consumeHandoff()`。`[代码实测]` |
| **M-5** | 可实现 | `src/core/verdict.js:73-76`；`requirement.md:97`、`:1342`、`:1571` | 新增 `review.js`、`verdict.js` 不改；`parseVerdict(document)`（只认 `document.verdict`，`:75`）与 `parseReview(rawText)`（`:1571`）形状不同、模块不同、文件名不同（`out/verdict.json` vs `out/review.json`），**无共用解析串味**（详见 §5 专门问题）。`[代码实测 + 文档核对]` |
| **M-6** | **会破坏回归** + 与代码现状描述不符 | `src/core/orchestrator.js:1352-1368`（回退 `:1359`）、`:1497`、`:1528`；`src/core/verify-artifact.js:300-343`；`requirement.md:98`、`:1628`、`:1631`、`:1724`、`:1157` | 详见 §1 阻断项 M-6。要点：①「不再回退」全局措辞与 D-8 的 `declared` 分流冲突，按字面改破坏 `single`/`code-loop`；② `finishArtifactNode()` 真实签名是 `(ctx, def)` **两参数**（`:1497`）；③ `:1528` 现状把 `absPath` 等落盘，与 NFR-08 现状即不符，必须显式投影。`[代码实测]` |
| **M-7** | 可实现（改已实测推进链，需同步字段名） | `src/core/advance.js:80-89`、`:308-309`；`requirement.md:99`、`:1434-1439`、`:1448-1449` | `classifyNodeOutcome()` 现对 `failed` 用 `verdictValue(verdict,node)`（`:86-88`）、对 `review` 落 `return 'error'`（`:89`）；`planAdvance()` 的 `verdict-fail` 分支当前只取 `verdict?.defects`（`:308`）与 `verdict?.retestRequirement`（`:309`）。M-7/D-3（`:1439`）要求「保持原签名、`verdict` 可空、优先 `verdict.defects`、为空取 `node.review.defects`（修改要求同理）」—— 可实现，但 **I1.2 字段名 `retestRequirement` 与 I1.3 `revisionRequirement` 不一致**，需补映射契约（见 §7）。`[代码实测]` |
| **M-8** | **与代码冲突** | `src/core/orchestrator.js:148`、`:152`；`src/core/advance.js:58`、`:62`、`:80-89`；`requirement.md:100`、`:1442-1448` | 详见 §1 阻断项 M-8。补充：`classifyNodeOutcome()` 对 `review` 返回 **`error`**（`advance.js:89` fallback），与 M-8 现状列一致；`latestEndedNodeId()` 只认 `done/failed/escalated`（`orchestrator.js:152`），需纳入 `review(downstream)`；`planAdvance()` defects 来源见 M-7。`[代码实测]` |
| **M-9** | 可实现（回归风险可控） | `src/core/orchestrator.js:2260`；`src/cli/labels.js:51-93`；`requirement.md:101`、`:1359`、`:1619`、`:1484-1528` | 新增错误码 / 节点限定词 / 后缀 / 事件词条只在 `task-loop` 出现（D-1 `:1359`、D-8 `:1619`），`single`/`code-loop` 文案不变。两处回归注意：① `startRun` 校验若写成 `if (template === 'task-loop')` 直接违背 M-2 与 AC-38；② `render.js`/`main.js` 的节点限定词与「会话 等待下游 · 产出已提交」（D-1 `:1353-1354`）必须**按节点条件分流**，不得改全局 `SESSION_LABEL`（否则 `code-loop` 的 `waiting_dependency` 显示词变化）。`[代码实测 + 文档核对]` |
| **M-10** | 可实现 | `test/fixtures/code-loop-driver.mjs:504-508`；`requirement.md:102`、`:1733`、`:1165`、`:1735` | 新增 `task-loop-driver.mjs` 要求「透传 `orch run` 的 stdout 并以同一退出码退出」（`:1733`、`:1165`）；旧 `code-loop-driver.mjs:504-508` 把 child stdout 写到 **`process.stderr`** —— 两者口径不同，实现时**不可照抄旧驱动**。`--suite` 缺省保持 code-loop（`:1735`），I1.2 场景逐字不变。`[代码实测 + 文档核对]` |

---

## 5. C-01~C-14 逐条（必答 C.10）

| 编号 | 判定 | 依据（代码:行 或 需求:行） | 一句话理由 |
|---|---|---|---|
| **C-01** | 可实现 | `src/persistence/paths.js:43`、`:90`（无该函数，探针 `[NO HIT]`）；`requirement.md:108`、`:1638`、`:1839` | 新增 `instanceWorkspaceDir()` 是纯追加，与基线 §5.2（`docs/index.md:606-609`）一致；`WORKSPACE_INIT_FAILED` 不落实例与 I1.2「先落盘实例再 running」不冲突（见 B.9）。需补 `CWD_NOT_WRITABLE` 边界（§7）。`[代码实测]` |
| **C-02** | 需补契约 | `src/core/orchestrator.js:2260`；`requirement.md:109`、`:1616-1619` | 「`task-loop` 的任务必须含……」与 M-2「不得按模板名分支」有措辞冲突风险；D-8（`:1614`、`:1619`）已给正解 `productPolicy==='doc-single'`。错误码名带 `TASK_LOOP` 只是文案标识，不构成分支依据。`[文档核对]` |
| **C-03** | 可实现 | `requirement.md:110`、`:1643`、`:1570` | `out/review.json` 固定为 `<cwd>` 任务目录相对；状态与事件只写相对路径，与 D-8「审核文件不是工作区」一致。`[文档核对]` |
| **C-04** | 需补契约（验收唯一化） | `requirement.md:111`、`:1577-1589`、`:790-801` | D-7 步 3/4/5 共用 `reasonCode=review_invalid` 与**同一逐字原因**「核对失败：审核文件不可解析」（`:1581-1583`），步 6 同为 `review_invalid` 但文案不同；AC-15（`:790-801`）只断言逐字串 + `state='escalated'`，**未机检 `stage`/`code`** → `review-bad-json` 无法证明命中步 4 而非步 3/5。详见专门问题。`[文档核对]` |
| **C-05** | 可实现 | `requirement.md:112`、`:1606`、`:1706-1719` | 只认 `decision/artifact/defects/revisionRequirement` 四字段、未知忽略；`decision` 与 `verdict.js` 的 `verdict` 字段隔离。`[文档核对]` |
| **C-06** | 可实现 | `requirement.md:113`、`:1589`、`:1608` | `#L<n>` 剥离、绝对路径/盘符/`..` 拒绝、证据 `bytes>0`；D-7 步 11（`:1589`）与「只 `stat` 不读内容」（`:1608`）一致。`[文档核对]` |
| **C-07** | 可实现 | `requirement.md:114`、`:1626`、`:1630`、`:1641` | 版本引用 `<stem>.v<round>.md`、`round` 派发即 +1（`:1630` 沿用 I1.2 口径）；研究笔记固定 `artifacts/reports/research-notes.v1.md`。`[文档核对]` |
| **C-08** | 可实现（依赖 M-6 同步） | `requirement.md:115`、`:1648-1650`、`:1721-1725` | 每轮 `sha256` 入 `artifactRefs`/`artifactHistory`、第 n>1 轮先核上一版；依赖 `verifyProducts()` 增 `sha256` 与 `orchestrator.js:1528` 投影（M-6），须同批改。`[文档核对 + 代码实测]` |
| **C-09** | 需补契约（**阻断**） | `src/core/orchestrator.js:389-457`、`:868-877`、`:1647-1658`；`requirement.md:116`、`:1419-1424`、`:1808`、`:1152` | 详见 §1 阻断项 C-09。要点：`transit()` 逐对象一 CAS；`accepted` 帧当前无源节点/会话迁移；必须新增合并写路径且同步 `:872` 与 `:1652` 两处重组；与 NFR-03「最多两次落盘」措辞需统一。`[代码实测]` |
| **C-10** | 可实现（与代码一致） | `src/adapter/handoff-tracker.js:135-146`；`requirement.md:117`、`:1426-1428` | 只认 `TURN_UPDATES`（`:136`）、必须 `delivered`（`:144`）、噪声帧 `ignored`（`:139`）—— 幂等键与噪声帧口径逐条一致。见 B.7。`[代码实测]` |
| **C-11** | 可实现（与代码一致） | `src/adapter/session-state.js:191-195`、`:88-96`、`:174/185/193/200/212/228`；`src/core/state-machine.js:113`；`requirement.md:118` | `onOutputSubmitted()→waiting_dependency`、`waiting_dependency→idle` 合法（`:113`）、`escalated`/`quarantined` 守卫 8 处未被绕过；与 I1.2 v16 D-6/AC-44 一致。见 B.6。`[代码实测]` |
| **C-12** | 可实现（与代码一致） | `src/core/state-machine.js:155`、`:157`；`src/core/orchestrator.js:2462-2465`、`:2567`；`requirement.md:119`、`:1823-1826` | `CANCELABLE_NODE` 已含 `review`（子状态自动覆盖）、`CANCELABLE_HANDOFF` = `created/delivered/accepted`；`applyCancel` 四数组一次 CAS 后再 emit（I1.2 长期约束）。`[代码实测]` |
| **C-13** | 可实现（`findDirBusy` 内部待实测） | `src/core/orchestrator.js:2260`；`requirement.md:120`、`:1821` | 复用 `findDirBusy({multiOnly:true})`（D-10 `:1821`）、`single` 不参与。**`[待实测]`**：本路未运行实例验证 `findDirBusy` 是否确实遍历全部多节点图（code-loop 与 task-loop 互斥），需拆分后由 AC-25/26 夹具证明。`[文档核对 + 待实测]` |
| **C-14** | 可实现（与代码一致） | `src/core/state-machine.js:142-150`、`:81`；`src/persistence/instance-store.js:169-174`；`requirement.md:121`、`:1827-1829` | `suspended` 不在 `TERMINAL_INSTANCE`、在 `CORE_IMMUTABLE_INSTANCE`；`schemaVersion` 不升 3、新增字段可缺省读取；v1 只读兼容。见 B.8。`[代码实测]` |

### 5.x 专门问题（必答 C.11 ~ C.16）

**C.11（M-2 / M-9 / C-02 是否自相矛盾？）** `[文档核对]` **不必然矛盾，但措辞必须统一**。
- M-2（`:94`、D-1 `:1359`）「`startRun` 不得按模板名分支；一切差异来自图数据」；M-9（`:101`）「`startRun` 按图数据校验 `task-loop` 产物行」；C-02（`:109`）「`task-loop` 的任务必须含且只含一个 `产物：<文件名>.md`」+ 专用错误码 `PRODUCT_*_TASK_LOOP`。
- 化解依据：D-8（`:1614` `productPolicy:'doc-single'`、`:1619`「`declared` 图（`code-loop`）仍走 I1.2 的 `extractProductLines` 与 `PRODUCT_LINE_MISSING`，文案不变」）与 D-10（`:1835`「`productPolicy==='doc-single'` 的产物声明校验」）已给出**按图数据分流**的正解；D-1 调用图（`:1369` `validateTaskProducts(graph.productPolicy)`）同样不按模板名。
- 结论：**只要分支依据是 `graph.productPolicy === 'doc-single'` 而非 `graphId === 'task-loop'`，三者一致**；错误码名带 `TASK_LOOP` 仅为文案标识。当前 `startRun`（`orchestrator.js:2260`）本就按 `multi` 而非模板名分支，M-2 与代码现状一致。**建议口径**：把 M-9「校验 `task-loop` 产物行」、C-02「`task-loop` 的任务」统一改写为「`productPolicy==='doc-single'` 的实例」，并显式加一句「禁止 `graphId`/`template` 字符串比较」。否则实现者最省事的写法 `if (template === 'task-loop')` 会同时违背 M-2 与 AC-38 红线 2。

**C.12（M-8 的 `latestEndedNodeId()` 是否两处都有？`classifyNodeOutcome()` 对 `review` 返回什么？`planAdvance()` 的 defects 来源？）** `[代码实测，探针 rv3b-symbols.mjs]`
- **否，不是两处同名**。`orchestrator.js:148` 是 `function latestEndedNodeId(state)`；`advance.js:58` 是 `function latestNodeId(nodes)`（不同名、不同签名：`state` vs `nodes` 数组）。`advance.js:62` 只认 `['done','failed','escalated']`。D-3（`:1446-1447`）写对了两个不同名函数，M-8（`:100`）写「两处同名逻辑」**与代码冲突**。
- `classifyNodeOutcome()`（`advance.js:80-89`）：`escalated→'escalated'`、`done→'passed'`、`failed` 且 `verdictValue(...)==='fail'→'verdict-fail'` 否则 `'error'`，**其余（含 `review`）落到 `return 'error'`（`:89`）**。M-8/D-2 现状列「对 `review` 返回 `error`」与代码一致。
- `planAdvance()` 的 `verdict-fail` 分支（`advance.js:308-309`）：`const defects = normalizeDefects(verdict?.defects ?? [])`；`const retestRequirement = verdict?.retestRequirement ?? null` —— **只从 `verdict` 取**，当前**没有** `node.review.defects` / `node.review.revisionRequirement`。D-3（`:1439`）要求「`verdict` 为空时取 `node.review.*`」是新增契约。

**C.13（M-6 回退在哪行？改掉会不会破坏 `single`/`code-loop`？`finishArtifactNode()` 真实签名？）** `[代码实测]`
- 回退在 `orchestrator.js:1359`：`Array.isArray(def?.products) && def.products.length > 0 ? def.products : productsOfTask(state)`；`hasSubmittedOutput()` 定义 `:1352-1368`，`:1360` `if (products.length === 0) return true`。
- **会破坏**：全局去掉该回退后，`single`（I1.1 启发式依赖任务 `产物：` 行）与 `code-loop`（`declared`）的 `products` 变空 → `:1360` 直接判「已交产出」，会话/输出语义改变 → 逐字回归破裂。D-8（`:1628`、` :1631`）明确 `declared` 保持 `productsOfTask`、仅 `judge:'review'` 节点不回退，是正确口径；M-6 措辞过宽（见 §1）。
- `finishArtifactNode()` 真实签名：`orchestrator.js:1497 async function finishArtifactNode(ctx, def)` —— **两个参数**（`ctx`、`def`），不是需求 D-1/D-8 里暗示的带 `baseDir` 之类新参；M-6/D-1（`:1345`）要改的是函数体（`:1499`、`:1528`），不是追加形参。
- 附带：`:1528` 当前把 `verifyProducts()` 返回的 6 字段（`verify-artifact.js:336-343`，含 `absPath`）全量落盘，与 NFR-08 现状即不符 —— 属「需求描述与代码现状不符，以代码为准」需明确指出的一条。

**C.14（C-09 与 `transit()` 冲突？`halted` 独立 `saveState` 红线 D-10 有没有漏？）** `[代码实测 + 文档核对]`
- **不冲突，但需新增合并写路径**。`transit()`（`orchestrator.js:389-457`）每次只迁移**一个对象**、一次 `saveState(..., {expectedState: expected})`（`:457`），`expected` 来自磁盘最新快照（`:402`、`:410`）—— 这本身是正确的 CAS 口径。C-09 要的是「源节点 + 源会话两条迁移合进同一个 live 状态、随这一帧一次 `saveLive` 落盘」，**不能**用 `transit()` 调两次（两次 CAS → rev 冲突丢状态，正是 `:116` / `:1424` 禁止的）。当前 `handleUpdate()` 的 `accepted` 帧（`:868-877`）连这两条迁移都还没有，需新增；并须保留 `transit()` 的 `:447-456`「实例级状态被外部改写时先 `adoptState` 再重放」校正逻辑。
- **`halted` 独立 `saveState` 红线在 D-10 漏了**。`src/core/escalation.js:275-324` `markHalted()` 是「整体丢弃内存改动（重新 load）后，用**一次独立 CAS 只写 `halted:true`**」（`:299` `state.halted = true`、`:304-308` `callSave(..., {state: state.state, halted:false, rev:...})`），对应 I1.2 `review-contract.md:229` C-13「`MAESTRO_FAULT=state_write:escalation` 只作用于 `commitEscalation()` 的唯一一次 `saveState`」与 `iteration-2.md:253`。I1.3 D-10（`:1817-1841`）只写「AC-30 升级写不进去时不假装挂起」（`:1830` 表内无此项，AC-30 在 `:975`），**未复述「失败路径必须独立一次 CAS 只写 `halted:true`，不得与迁移同帧合并」**。C-09 的「一次 CAS 合并两条迁移」若被误套到升级失败路径，会打穿 `markHalted()` 的独立写 → 建议 D-10 补一行（§7）。

**C.15（禁词表：新增 `src/core/review.js`/`doc-artifact.js` 会不会扫到？新角色/模板名要不要进禁词表？需求写清了吗？）** `[代码实测 + 文档核对]`
- **会扫到**：`test/fixtures/purity-check.mjs:21` `DEFAULT_DIRS = ['src/core','src/daemon']`，`src/core/review.js`（D-1 `:1342`）与 `src/core/doc-artifact.js`（`:1343`）都在 `src/core` 下，会被默认目录收集（`:85` `collectFiles(abs)`）。
- **但扫不出违规**：`:22` `DEFAULT_FORBID = ['code-loop','developer','tester','coordinator']` —— 不含 `task-loop`、`researcher`/`writer`/`reviewer`、中文角色名，也不含任务书提到的 `dsh`/`stdio`/`transport`。即新增文件里即便写了这些词，默认扫描也 `exit 0`。
- **需求没写清**：D-1 红线 1（`:1358`）与 AC-38（`:1073`）列了 7 个新词要禁，但 (a) 未给出可执行扫描命令（`--forbid` 注入或改 `DEFAULT_FORBID`）；(b) D-9「必须同步的测试」（`:1803-1815`）**没有** `purity-check.mjs` / AC-38 扫描项；(c) AC-38 只扫 3 个文件（`:1073`），D-1 红线 1 扫 `src/core/**`+`src/daemon/**`（`:1358`），范围不一致。→ **架构检查假通过（阻断项 4）**。另：I1.3 里「AC-28」是取消收敛（`:951`），任务书把「I1.2 的 AC-28 架构扫描口径」套到 I1.3 属**编号错位**，本迭代对应的是 AC-38 / §1.2 指标 5（`:33`）/ D-1 红线 1。

**C.16（verdict/review 两套「只认文件」判定串味？C-04 与 AC-15 无法唯一化？）** `[代码实测 + 文档核对]`
- **串味风险可控（隔离）**：`src/core/verdict.js:73-76` 逐字「`verdict` must be strictly "pass" or "fail". No alias (e.g. `result`) is accepted」，`const value = document.verdict ?? null`（`:75`）；M-5（`:97`）「`verdict.js` 不改」，D-7（`:1571`）`parseReview(rawText)` 接收**字符串**、`readReview({cwd, workspaceDir, expectedArtifact, roundStartedAt, fs, now})`（`:1572`）与 `verdict.js` 的 `readVerdict` 签名不同；C-05（`:112`）用 `decision` 字段，文件 `out/review.json`（`:1570`）与 `out/verdict.json` 不同。模块、文件、字段、纯函数形状四重隔离 → **无共用解析串味**。建议仍加一句「不得抽公共 `readDocument()` 把两个字段口径合并」，防未来重构串味（§7）。
- **C-04 与 AC-15 确实无法唯一化（需补契约）**：C-04（`:111`）「同一原因码可对应多步，如不可读与不可解析都记 `review_invalid`」；D-7 步 3（`REVIEW_UNPARSABLE`/`unreadable`）、步 4（`unparsable`）、步 5（`REVIEW_SCHEMA_INVALID`/`schema`）三档共用 `reasonCode=review_invalid` 且逐字原因都写「同上」=「核对失败：审核文件不可解析」（`:1581-1583`）；步 6 也是 `review_invalid` 但逐字原因是「核对失败：审核结论只能是 pass 或 reject」（`:1584`）。AC-15（`:790-801`）两个场景 `review-bad-json` / `review-decision-invalid` 靠两句不同逐字串区分，但 `review-bad-json` 场景**只断言逐字串 + `state='escalated'`/`dispatchCount=3`（`:800`），未机检 `stage`/`code`/`reasonCode`** → 步 3/4/5 任意一步命中都能通过，「审核文件不可解析」的逐字断言**丧失步骤级唯一性**，验收可被更弱实现蒙混。D-9 场景表（`:1780-1781`）也把两个场景都标 `review_invalid`。**建议**：AC-15 补 `And 机检：reasonDetail.stage === 'unparsable' && code === 'REVIEW_UNPARSABLE'`（或把三档逐字原因拆开），使 C-04 的「同码多步」仍可由 `stage`/`code` 唯一化。

---

## 6. 回归红线检查表（必答 D）

### 6.1 可能破坏 `single` / `code-loop` 输出逐字回归的改动点（D.17）

| 改动点 | 判定 | 依据 | 说明 |
|---|---|---|---|
| **M-1**（新角色/图/标签 + `promptFor` 改造） | **会破坏回归** | `src/templates/index.js:211-243`、`:147`（`GRAPHS`）、`:19-36`（`ROLES`）；`src/cli/labels.js:51-93` | 纯新增 `GRAPHS`/`ROLES`/`LABEL` 不改旧值（`single`/`code-loop` 逐字不变）；但 D-1（`:1351`）「`promptFor` 以 `node.prompt` 为唯一分派键」会重写 `:221-242` 的分派与参数（`retestRequirement`→`revisionRequirement` 等），若丢 `VERDICT_REQUIREMENT`（`:242`）或 `prompt==='single'`（`:238`），`code-loop`/`single` 提示词与 `.mock/prompts` 逐字变 → 夹具回归破。`[代码实测]` |
| **M-2**（图级 `productPolicy` + 节点新字段） | 不破坏（缺省保持） | `requirement.md:94`、`:1619`；`src/core/orchestrator.js:2260` | 「字段缺省时行为与 I1.2 完全一致」「`declared` 图仍走 `extractProductLines`」；旧图不填新字段即保持原语义。`[文档核对 + 代码实测]` |
| **M-6**（`hasSubmittedOutput` / `verifyProducts` / `finishArtifactNode`） | **会破坏回归** | `src/core/orchestrator.js:1359`、`:1499`、`:1528`；`src/core/verify-artifact.js:300-343` | 见 §1 M-6。全局去回退 → `single`/`code-loop` 判「已交产出」；`:1528` 投影变更会改 `state.json` 的 `artifactRefs` 形状（I1.2 既有断言 `verify-artifact.test.js` 若按 `absPath` 断言会失败，D-9 `:1809` 说「I1.2 既有断言不改」—— 这两者需对齐：若 I1.2 测试断言了 `absPath`，改投影就会破；**`[待实测]`** 本路未跑 `node --test`，需拆分后核）。`[代码实测 + 待实测]` |
| **M-8**（推进层纳入 `review(downstream)`） | **会破坏回归**（若不分流） | `src/core/advance.js:58-62`、`:80-89`；`requirement.md:100`、`:1446-1449` | `latestNodeId()`/`classifyNodeOutcome()`/`planAdvance()` 是 `code-loop` 共用的推进链；M-8/D-3 说「仅 `downstreamGate:true` 图节点走新路径、`code-loop` 不受影响（R-1）」，但 `classifyNodeOutcome()` 的 `failed` 分支若改成读 `node.review.decision`，对**没有 `node.review` 的 code-loop `failed` 节点**必须回退到原 `verdictValue()` 逻辑，否则 code-loop 回流破。需求 D-3（`:1448`）写「`failed` 的审核节点按 `node.review.decision` 映射」，未明说「非审核 `failed` 节点保持原逻辑」→ 需补契约。`[代码实测 + 文档核对]` |
| **M-9**（新错误码 / 限定词 / 后缀） | 不破坏（按条件分流） | `requirement.md:101`、`:1353-1354`、`:1619` | 新文案只在 `task-loop` 出现；风险在「改全局 `SESSION_LABEL` / `NODE_QUALIFIER` 默认值」—— `labels.js:51-93` 的 `waiting_dependency` 显示词、`failed→等待复测`（`render.js:374`）若被改成按 `reviewReason` 全局分流，`code-loop` 的 `失败（等待复测）`（AC-36 `:1052`）会变。`[代码实测 + 文档核对]` |
| **M-10**（新 driver / mock `--suite`） | 不破坏（缺省保持） | `requirement.md:1735`、`:1815`；`test/fixtures/code-loop-driver.mjs:504-508` | `--suite` 缺省 code-loop、I1.2 场景逐字不变；新 driver 独立文件不碰旧 driver。但新 driver「透传 stdout」与旧 driver「stdout→stderr」不同，不可照抄（见 M-10）。`[代码实测 + 文档核对]` |
| **AC-36 回归口径够不够** | **基本够，但有 3 处缺口（不阻断）** | `requirement.md:1045-1056`、`:1177-1285`、`:1173` | 覆盖：I1.2 完整测试集全通过（`:1048-1049`）、code-loop 停在「开发第 2 轮完成」的 `orch status` 逐字（`:1050-1053`）、`single` run/status 与 I1.1 逐字一致（`:1054`）、不含「待校验（等待下游）」（`:1053`）、`node --test test/` 全量入口（`:1173`）。缺口：① `:1055`「`code-loop` 的 `A-1 / A-2 / A-3 / A-4` 输出样例不变」—— **本文档附录 A 的 A-1~A-4 是 `task-loop` 基线**（`:1181` A-1 = `orch run --template task-loop`），code-loop 的基线在 I1.2 文档，此处未指明文档、且同名易误读；② 未覆盖 `orch run --template code-loop` **成功路径**逐字（只覆盖一个中间 `status`）；③ 未声明退出码 4/5、事件行、会话行/耗时/节点后缀等非功能输出逐字。建议补 2~3 条（§7）。`[文档核对]` |

### 6.2 I1.2 长期约束逐条打勾（D.18）

| # | 长期约束 | I1.2 代码依据 | I1.3 M/C/D 是否违背或遗漏 | 判定 |
|---|---|---|---|---|
| 1 | CAS 形状 `{state,halted,rev}`，`rev` 基于磁盘单调 | `src/persistence/instance-store.js:48-54`（`casSnapshot`）、`:208-231`（`prevRev+1`、`state.rev=rev`） | D-6（`:1561`）逐字复述「`expectedState` 比较 `{state,halted,rev}`」；C-09 的合并写仍走 `saveLive` 的 CAS，未改形状 | ✅ 保持 `[代码实测]` |
| 2 | 事件先落盘再广播 | `src/core/event-bus.js:82-89`（`appendEvent` 成功才 `broadcast`） | D-3（`:1419`）、D-5、C-12 均未改事件落盘顺序；`:872` `applyHandoff` 后 `enqueue`/`emit` 沿用 | ✅ 保持 `[代码实测]` |
| 3 | `emit` 失败不得改内存状态 | `src/core/event-bus.js:83-87`（append 失败返回 `STORE_WRITE_FAILED` 不广播） | I1.3 未新增「先改内存后 emit 失败回滚」路径；C-09 合并写在 emit 之前落盘 | ✅ 保持（C-09 需确认合并写发生在 emit 前，见 §1）`[代码实测 + 待实测]` |
| 4 | 忙检查在写锁之前 | `orchestrator.js:2283-2285`、`:2795-2799`；`review-round2.md:49`「忙检查放在锁之前」 | D-10（`:1821-1822`）复用 `findDirBusy` / `isNodeBusyState()`，未改顺序 | ✅ 保持 `[文档核对]` |
| 5 | `applyCancel` 四数组一次 CAS 后再 emit | `orchestrator.js:2462-2465`（`cancelledNodes/Sessions/Handoffs/Escalations`）、`:2567`（一次 `saveState(expectedState)`）、`:2573`（逐条 emit） | C-12（`:119`、`:1823-1826`）「与 I1.2 的 `CANCELABLE_HANDOFF` 一致」「沿用 I1.2 的 CAS 优先口径」；D-10（`:1825`）「`applyCancel` 的升级循环」 | ✅ 保持 `[代码实测]` |
| 6 | `stopReason` 不判成败 | I1.2 v16 口径（`iteration-2/requirement.md` / `review-contract.md`） | D-9/§3.3（`:1170`）沿用 `MAESTRO_FAULT` / `MAESTRO_TEST_PAUSE` 接缝，未把 `stopReason` 当成败 | ✅ 保持 `[文档核对]` |
| 7 | `load` 后 drain-quiet | `orchestrator.js` 启动/对账路径（I1.2 已实测） | C-14 / D-10（`:1827-1829`）「`reconcileOnBoot` 不写挂起实例」「`review` 节点不自动重新核对」 | ✅ 保持 `[文档核对 + 待实测]` |
| 8 | `accepted` 排除噪声帧 | `src/adapter/handoff-tracker.js:135-146` | C-10（`:117`）、D-3（`:1428`）逐字复述 | ✅ 保持 `[代码实测]` |
| 9 | `halted` 失败路径独立一次 CAS 只写 `halted:true` | `src/core/escalation.js:275-324`（`markHalted()`）；`review-contract.md:229` C-13；`iteration-2.md:253` | **D-10（`:1817-1841`）未复述该红线**；C-09「两条迁移一次 CAS」若被误套到升级失败路径会打穿 | ⚠️ **遗漏，需补**（见 §5 C.14 / §7）`[代码实测 + 文档核对]` |
| 10 | NFR-03「一次状态变化最多两次落盘」 vs C-09「一次 CAS」 | `requirement.md:1152` vs `:116`、`:1424` | 两者措辞未统一：C-09 禁的是「两条迁移分两次落盘」，NFR-03 允许「迁移 + 收尾」两次 | ⚠️ **需澄清**（见 §1 C-09）`[文档核对]` |

---

## 7. 建议项（不阻断）

1. **§1.2 指标 5→4**：`requirement.md:27-33` 超出 `requirement-template.md:24` 的 2~4 个上限。建议合并指标 1/2 为「人工介入与手工搬运 0 次」，或把指标 5「共用 1 套推进逻辑」移入 §1.3 范围内第 9 条（`:47` 已有）。`[文档核对]`
2. **§1.3 范围外 3 项补「何时/由谁」**：`:61`、`:63`「不做」、`:64`「后续迭代」未给迭代号或责任方，建议补 `I1.7 / 不做（本迭代范围内永久）` 之类。`[文档核对]`
3. **M-6 现状列补一句事实**：`requirement.md:98` 现状列只说「`sha256` 不计算」，应补「且 `orchestrator.js:1528` 当前把 `verifyProducts()` 返回的 `absPath`/`mtime`/`exists` 全量写入 `node.artifactRefs`」—— 否则「NFR-08 不得保存绝对路径」在 I1.2 现状下不成立这一事实被掩盖。`[代码实测]`
4. **M-7 / D-3 字段名映射**：I1.2 `planAdvance()` 用 `verdict.retestRequirement`（`advance.js:309`），I1.3 用 `review.revisionRequirement`（C-05、D-3 `:1439`、D-7 `:1597`）。补一句「`revisionRequirement` 映射到 `planAdvance` 的 `retestRequirement` 入参 / `buildHandoff` 的 `revisionRequirement` 字段」，避免回流提示词（`:1686`）取到空值。`[代码实测]`
5. **C-04 / AC-15 唯一化**：AC-15（`:790-801`）补 `stage`/`code` 机检断言，或把 D-7 步 3/4/5 的逐字原因拆开；使「同一原因码多步」仍可唯一验收。`[文档核对]`
6. **AC-36 回归口径补 3 条**：① `:1055` 的 `A-1~A-4` 明确写成「I1.2 需求文档附录 A」以免与本文档附录 A（task-loop，`:1177`）混淆；② 补 `orch run --template code-loop` 成功路径逐字；③ 补退出码 4/5、事件行、会话行/耗时/节点后缀的逐字不变。`[文档核对]`
7. **D-10 补 `halted` 独立写红线**：在 `:1831-1841` 加一行「升级事务写失败 → 丢弃内存改动、重新 load，用**一次独立 CAS 只写 `halted:true`**（`escalation.js:275-324`），不得与迁移合并落盘」。`[代码实测]`
8. **C-09 与 NFR-03 措辞统一**：把 C-09「一次 CAS 落盘」改为「两条迁移合并为**同一次** CAS；本次状态变化最多两次落盘（迁移 + 收尾）」，与 `:1152` 对齐。`[文档核对]`
9. **M-8 / D-3 函数定位统一**：以 D-3（`:1446-1447`）为准，全文把「两处同名 `latestEndedNodeId()`」改为「`orchestrator.js:latestEndedNodeId(state)` 与 `advance.js:latestNodeId(nodes)`」。`[代码实测]`
10. **`orch status` 的 waiting 分支措辞**：`src/cli/main.js:266-272` 的 `printSnapshot`（`orch run` 进度）已有 `renderSessionSubmitted()`；`orch status` 的会话行在 `main.js:460-461` 当前**没有**该分支。D-1（`:1354`）写「`orch status` 第 4 段……**改用** `renderSessionSubmitted()`」，实为**新增**，且需明确是新增条件变体 `renderSessionSubmitted({qualifier:'等待下游'})` 而非改全局 `SESSION_LABEL`（否则 `code-loop` 的 `waiting_dependency` 显示词变化）。`[代码实测]`
11. **`promptFor` 签名变更的调用点**：D-1（`:1351`）新增 `artifactStem/round/defects/revisionRequirement` 参数后，`orchestrator.js` 中所有 `promptFor({...})` 调用点须同步，且 `code-loop` 路径保持 `retestRequirement`/`VERDICT_REQUIREMENT` 逐字。`[待实测：调用点全量未逐处列，拆分时核]`
12. **附录 A-2 内部字段名**：`requirement.md:1215-1219` 的渲染说明含 `reviewReason`/`artifactRefs[0].ref`/`halted`，虽不属模板「第二部分」，但既然 §2 强调用户视角，建议加一句「附录 A/D 为实现基线，允许出现内部字段名」以免后续评审反复。`[文档核对]`
13. **快照漂移留痕**：本报告记录 1836/+123/-60（任务书）→ 1837/+129/-65（评审中）→ 1843/+148/-78（收口）三次不一致；建议需求侧在附录 C（`:1326`，当前仅一行 v1）补齐本轮未提交改动清单，避免两位评审基于不同快照。`[代码实测 + 文档核对]`
14. **C-13 待实测项**：`findDirBusy({multiOnly:true})` 是否确实遍历全部多节点图，本路未运行实例，需由 AC-25/26 夹具证明（标 `[待实测]`）。`[待实测]`

---

> 本路结论仅覆盖「基线与契约」；`review-consistency.md`（第 2 路）不在本文件范围内，未读取、未修改。全部 `src/**` / `test/**` / `bin/**` / 其它 `docs/**` / `requirement.md` 均未改动；未 `git commit`；未触碰 `%TEMP%/maestro-acc-*`。
