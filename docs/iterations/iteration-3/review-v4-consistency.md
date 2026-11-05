# I1.3 需求 v4 自洽性复核

> 复核对象：`docs/iterations/iteration-3/requirement.md`（v4，1964 行）
> 对照基线：`docs/iterations/iteration-2/requirement.md`（v16）、`src/**`、`test/**`、`docs/index.md`
> 环境：Windows / Git Bash / Node v22.22.2；基线实测 `node --test "test/**/*.test.js"` = **337/337 通过**
> 只读：本文件是本次唯一新增产物。临时脚本：`probe/rv3-stats.mjs`、`probe/rv3-forbidden.mjs`、`probe/rv3-stats.json`

## 0. 总判（**需先改 v5，阻断 5 处**）

需求 v4 的**数字面**基本自洽：29 个场景的派发/交接包数在 AC 里几乎全部对得上，45 条 AC / BR-01~40 / M-1~10 / C-1~14 / D-1~10 / A-1~4 / NFR-1~10 编号无缺，场景名两处逐字一致（脚本核对，见 §4）。AC-04、AC-45、AC-30 的时序与现实现核对后**都可以构造**。

但这 5 处不改会在并行开工后必然返工：

1. **AC-35 有一条断言在 fixture 上不存在被比较对象**（T-002 第 2 轮没有上游 `review.evidence_verified`），机检写不出来；
2. **M-4 一落地就必红一条 I1.2 测试**（`test/templates/fake-graph.test.js:214` 精确断言 `buildHandoff` 的 14 个键），而 AC-36 / §3.3#10 又说 I1.2 测试必须原样通过；D-9 的同步清单里没有这个文件；
3. **D-6 的 `artifactRefs` 按边表用同一个 `<round>` 表达三个不同轮次**，且没写 `input` 的取值来源；现 `advance.js` 的 `productsOf()` 对 T-002/T-003 会回退出**裸文件名** `release-notes.md`；
4. **D-1 说 `promptFor` 以 `node.prompt` 为"唯一分派键"**，与现实现按 `handoff.edge.kind` 选 `backflow`/`retest` 模板直接冲突，照做会让 `code-loop` 的回流/复测提示词退化（AC-36 红）；
5. **AC-13 的 `reviewDecoy:'workspace'` 无法按 D-9 的规则反推路径**（审核提示词里没有绝对工作区路径），干扰文件写不出来。

其余为"重要/次要"（会拖慢 1 轮，但不至于让契约对不上）。

---

## 1. 阻断项

### B-1 ｜ 断言不可构造 ｜ `requirement.md:1073`（AC-35 第 5 个 `And`）

**原文**

> 带下游门控的节点（T-001、T-002）每一轮的 `roundStartedAt` 都晚于或等于**上游节点同轮**的 `review.evidence_verified` 事件 ts（同一时刻允许）；T-001 第 1 轮与 T-003 没有这条比较——前者由 `run.started` 直接派发，后者无下游门控、不产生该事件

**为什么返工**
`doc-backflow-once` 里 T-002 有 2 轮，但**第 2 轮的上游是 T-003**（`T-003→T-002 backflow`，`requirement.md:1582`）。T-003 是 `judge:'review'`、`downstreamGate:false`（`:1580`），按 D-3 它**不产生** `review.evidence_verified`（`:1523` 只在 `def.downstreamGate === true` 时发；AC-35 自己的括注也承认"后者无下游门控、不产生该事件"）。于是"T-002 每一轮都要和上游的 `review.evidence_verified` 比"在第 2 轮**没有可比的 ts**：写成硬断言必找不到事件，写成"存在才比"就变成自欺的永真式。这一条落在最核心的时序 AC 上，评审/实现会来回改。

**建议改法**：把比较限定为"上游是门控节点的那几轮"，并为第 2 轮换一个可比锚点：

```
- And 机检：T-002 第 1 轮、T-001 第 1 轮的 roundStartedAt ≥ 各自上游的 review.evidence_verified 事件 ts
- And 机检：T-002 第 2 轮（上游 T-003 无门控、不产生该事件）改为 roundStartedAt ≥ T-003 第 1 轮
  `review.rejected`（result='note'）事件 ts
```

---

### B-2 ｜ 与既有测试契约冲突 + 同步清单缺项 ｜ `requirement.md:96`（M-4）、`:1092`（AC-36）、`:1265`（§3.3 第 10 条）、`test/templates/fake-graph.test.js:214-229`

**原文**
M-4：交接包"追加 `artifactRefs` 与 `revisionRequirement`"。
AC-36：`code-loop` 的 I1.2 附录输出逐字不变；§3.3#10"**I1.2 既有测试必须全部保留并通过（AC-36）**"。
D-9「必须同步的测试」（`:1923-1935`）**没有** `test/templates/fake-graph.test.js`。

**为什么返工**
该文件第 214-229 行是：

```js
assert.deepEqual(Object.keys(handoff).sort(), [
  'acceptedAt','acceptedSignal','ambiguityWindowMs','consumedAt','createdAt','defects',
  'deliveredAt','edge','handoffId','note','rejectReason','rejectedAt','state','wakeConsumedAt'
]);
```

M-4 一旦实现（`buildHandoff` 返回 `artifactRefs` / `revisionRequirement`），这条 `deepEqual` **必然红**。要么改这条断言（则"既有测试原样通过"不成立，且 D-9 清单与实际改动不一致，违反 NFR-10），要么不实现 M-4（AC-03/AC-08 全挂）。这是**开工第一天就会撞上的死结**，且两个工作包（M-4 的引擎包 / 测试包）会各改一遍。

**建议改法**：D-9 的"必须同步的测试"表补一行，并把 AC-36 的措辞从"原样保留"改成"语义不变的断言可随授权契约变更同步（列于 D-9）"：

```
| test/templates/fake-graph.test.js | 第 214-229 行 `buildHandoff` 的键集合追加
  'artifactRefs' / 'revisionRequirement'（M-4 授权变更；其余 14 键与顺序不变）
```

---

### B-3 ｜ 契约二义（同一个 `<round>` = 三个轮次）+ 取值来源缺失 ｜ `requirement.md:1661-1668`（D-6 按边表）、`:1450`（D-1 buildHandoff）、`:1521`（D-3 落盘）、`:1744`（D-8）

**原文（按边表）**

```
| T-002→T-003（forward） | [artifacts/docs/<stem>.v<round>.md] | null | null |
| T-003→T-002（backflow） | [artifacts/docs/<stem>.v<round>.md]（被驳回版） | artifacts/docs/<stem>.v<round+1>.md | {ref: 被驳回版, sha256} |
| T-002→T-003（retest） | [artifacts/docs/<stem>.v<round>.md]（新版） | null | null |
```

**为什么返工**
三行里的 `<round>` 不是同一个量：

| 包 | 目标节点派发后 round | 期望 `input` | 若按"目标轮次"算 | 若按"源轮次"算 |
|---|---|---|---|---|
| HO-002 forward | T-003 = 1 | v1 | v1 ✓ | T-002=1 → v1 ✓ |
| HO-004 retest | T-003 = 2 | v2 | v2 ✓ | T-002=2 → v2 ✓ |
| **HO-003 backflow** | **T-002 = 2** | **v1（被驳回版）** | **v2 ✗（=output）** | T-003=1 → v1 ✓ |

也就是说 backflow 行的 `input` 必须用"目标轮次 − 1"（或源节点被驳回的那一版），而 `output` 用"目标轮次"——**同一行里一个符号两种含义**。更麻烦的是**取值来源没写**：

- `buildHandoff()` 现在根本收不到 `artifactRefs`（`src/core/advance.js:106-140` 只接收 `products`，且返回值里没有该字段）；
- `planAdvance()` 的 `productsOf(target)` 对 T-002/T-003 会回退到 `extractProductLines(snap.task)`（`advance.js:294-299`），得到的是**裸文件名 `release-notes.md`**（`verify-artifact.js:252-279`）——不是版本引用；
- 而 T-003（审核节点）**没有** `artifactRefs`（D-4 `:1580` 只有 `reviewPath`），所以 backflow 的"被驳回版"既不能取源节点 refs，也不能取 `products`。

任何一处取错，AC-03（`HO-002.artifactRefs.input 含 artifacts/docs/release-notes.v1.md`，`:653`）和 AC-08（`HO-003.previous = {...v1.md}`、`output = ...v2.md`，`:727-728`）都会红，且是 6~7 个并行包里最容易被两个人各自实现一遍的地方。

**建议改法**：把表改成逐列写明"取哪个量、从哪取"：

```
| 边 | input | output | previous |
| T-001→T-002 | 源节点 artifactRefs[0].ref（fixed-workspace 产物） | 目标轮次 n → <stem>.v<n>.md | null |
| T-002→T-003 | 源节点 artifactRefs[0].ref（= 本轮 v<n>），**不要用 productsOf()** | null | null |
| T-003→T-002 | **目标轮次 n − 1** → v<n-1>（被驳回版；不取 T-003.artifactRefs，它为空） | 目标轮次 n → v<n>.md | {ref: v<n-1>, sha256: 从 artifactHistory[n-1] 取} |
| T-002→T-003（retest） | 源节点 artifactRefs[0].ref（= v<n>） | null | null |
```
并补一句：`advance.js` 的 `productsOf()` 在 `productPolicy==='doc-single'` 时**不得**回退到任务 `产物：` 行（与 M-6 对 `hasSubmittedOutput()` 的要求同口径）。

---

### B-4 ｜ 与既有实现直接冲突 ｜ `requirement.md:1455`（D-1 `promptFor` 行）vs `src/core/advance.js:221-237`、`src/templates/index.js:211-243`

**原文**
> `promptFor({node, task, artifactStem, round, defects, revisionRequirement})` 以 `node.prompt` 为**唯一分派键**（不按模板名/角色名分支）

**为什么返工**
现实现的**分派键是 `handoff.edge.kind`**，不是 `node.prompt`：

```js
// src/templates/index.js:221-242
const kind = handoff?.edge?.kind ?? null;
if (kind === 'backflow') return fill(PROMPT_TEMPLATES.backflow, {...});
if (kind === 'retest')  return fill(PROMPT_TEMPLATES.retest,  {...});
...
const base = fill(PROMPT_TEMPLATES.forward, { task });
return target.judge === 'verdict' ? `${base}${VERDICT_REQUIREMENT}` : base;
```

`code-loop` 的 T-001 与 T-002 首派都是 `forward`/`verify`，正是靠 `kind` 才能切到带回缺陷与复测要求的 `backflow`/`retest` 文本。照 D-1 改成"只看 `node.prompt`"，`code-loop` 的回流提示词会退化成裸任务文本（缺陷与证据全丢）——这是行为回归，AC-36 的"两模板共用同一引擎、code-loop 输出/行为不变"直接破。测试面不一定立刻红（现有测试不断言提示词文本，已核：`grep PROMPT_TEMPLATES test` 为空），所以**会静默上线**，更难发现。

**建议改法**：改为"新增 `research`/`write`/`review` 三个键走 `node.prompt`；既有的 `single`/`forward`/`verify` 与按 `edge.kind` 选 `backflow`/`retest` 的分支逐字保留"：

```
- `promptFor()` 以 `node.prompt` 为**新键的**分派入口；`edge.kind` 的 backflow/retest 分支保持现状
  （`templates/index.js:221-237`），`write` 再按 `round === 1` / `round > 1` 细分。
- AC-38 的架构检查不覆盖 `templates/**`，本条改动不会触发禁词。
```

---

### B-5 ｜ 夹具不可构造 ｜ `requirement.md:1882`（D-9 `reviewDecoy`）、`:1811-1821`（D-8 审核提示词）、`:800`（AC-13 最后一条）

**原文**
> `reviewDecoy:'workspace'`：…（路径由 mock 从提示词的 `写入路径：` 反推：取到 `workspace/` 为止再拼 `out/review.json`；反推不出来就写 `.mock/bad-decoy-path` 并不写，**让 AC 直接失败**）

**为什么返工**
审核提示词（D-8，`:1813-1821`）是：

```
本轮文档引用：artifacts/docs/<stem>.v<n>.md
审核文件写入路径：out/review.json
```

第 2 行里 `写入路径：` 是 `审核文件写入路径：` 的子串，所以 mock 能"匹配到"，但取到的是 **`out/review.json`（相对路径）**——里面没有 `workspace/`，按 D-9 的字面规则就是"反推不出来"→ 写 `.mock/bad-decoy-path`、不写干扰文件。于是 AC-13（`:800`）最后那条"夹具在 `.orch/instances/INST-001/workspace/out/review.json` 放一份合法 pass 的干扰文件"**永远不成立**，AC 必挂；而这条干扰文件正是"证明读取根是任务目录而不是工作区"的唯一证据。

**建议改法**（二选一，推荐 1）：

1. 审核提示词补一行绝对路径（同时让 mock 有稳定锚点）：
```
工作区：<workspace 绝对路径>          # 与 artifact 提示词的"写入路径："同款 toPosix 归一化
审核文件写入路径：out/review.json
```
并把 D-9 的规则改成：`取提示词里"工作区："的绝对路径 + /out/review.json`。
2. 保留现提示词，把 D-9 改成：mock 从 `.mock/prompts/<n-1>.json`（撰写步的 `写入路径：`）取到 `workspace/` 为止，再拼 `out/review.json`（跨步读，需在 D-9 写明"第 3 步读第 2 步的 prompt 记录"）。

---

## 2. 重要项（不阻断，但会拖慢一轮）

| ID | 位置 | 问题 | 建议 |
|---|---|---|---|
| **I-1** | `requirement.md:1520-1525`（D-3 核对之后的有序清单） | 清单里**没有 `consumeHandoff()`**。I1.2 是在 `finishArtifactNode` 里紧跟 `done` 调用的（`orchestrator.js:1531`）；AC-02（`:639` HO-001 已完成）、AC-03（`:652` HO-002 consumed）、AC-06（`:700` 全部 consumed）都依赖"核对通过即消费"。照 D-3 的有序清单实现会漏掉它，三条 AC 同时红 | 在 D-3 第 1 步的"核对之后"列表补一句：`调 consumeHandoff(ctx,'handoff.consumed')（与 I1.2 同位置，先于 saveLive）` |
| **I-2** | `requirement.md:897`（AC-20） | "两次都没有**第三次** backflow 交接包"措辞错：该场景只有 **1 张** backflow（HO-003），第 2 张回流若出现会是 HO-005，"第三次"无从谈起；且 AC-20 没有断言 handoffs 总数。实数：**4 次派发 / 3 张包（HO-001~003）** | 改成：`And 机检：handoffs 恰好 3 条（HO-001~HO-003），其中 edge.kind='backflow' 恰好 1 条；不存在 HO-004` |
| **I-3** | `test/wp2/labels.test.js:208` | `assert.equal(Object.keys(REASON_LABEL).length, 33)` 是硬编码条数；D-5 新增 6 条 review.* 后为 **39**，必红。D-9 虽列了该文件，但只写"新增…断言"，没写"改这个 33" | D-9 该行补：`把 REASON_LABEL 的条数断言 33 → 39（新增 6 条 review.*），其余键逐字不动` |
| **I-4** | `requirement.md:1256-1262`（§3.3 第 3/7 条）、`test/fixtures/code-loop-driver.mjs:466` | `MAESTRO_TEST_PAUSE` / `MAESTRO_TEST_STOP_AFTER` 只在 `isTest` 为真时生效（`orchestrator.js:254,2756,2771`），而 `isTest` 要求 `NODE_ENV==='test'`。AC 只写了 `MAESTRO_TEST_PAUSE=…`，没写新 driver 必须注入 `NODE_ENV=test`。若 `task-loop-driver.mjs` 漏掉，AC-02/04/07/32/41/45 的暂停/定点全部**静默空转**，表现为"驱动 60s 超时"而不是断言失败，极难定位 | §3.3 第 3 条补一句：`task-loop-driver.mjs 必须沿用 code-loop-driver.mjs:466 的 cleanEnv：NODE_ENV='test'` |
| **I-5** | `requirement.md:1318-1323`（A-2 耗时/后缀规则）vs `:101`（M-9） | A-2 的后缀规则写成全局（"`done` 且本轮有 `artifactRefs[0].ref` → `· 产物 <ref>`"）。`code-loop` 的 T-001 也是 `done` + 有 `artifactRefs`（`orchestrator.js:1528`），照 A-2 全局实现会给 I1.2 节点行**新增 `· 产物 calc.js`**，AC-36 直接红。门控只在 M-9 的"新文案只在 task-loop 出现"一句里，A-2 的规则句没写 | A-2 第 3 段的"后缀"开头补：`以下后缀只在 task-loop（productPolicy==='doc-single'）渲染；single / code-loop 逐字不变（M-9 / AC-36）`；耗时新增的 `review(downstream)` / `failed+等待复审` 两支同样按模板门控 |
| **I-6** | `requirement.md:1648`（D-6 不变式）、`:119`（C-12）、`:1943`（D-10） | D-6 要求"`reviewReason` 仅 `state==='review'` 时有值、**终态节点上不得残留**"，但只在 `applyCancel` 加了清空。升级路径 `applyInMemory` 直接把 `node.state='escalated'`（`escalation.js:107-112`）不动 `reviewReason` → doc-missing/empty/stale、doc-previous-* 的 T-002 升级后仍带 `reviewReason='evidence'`，违反自家不变式（AC 都不查，所以不会被测试拦下，但后续迭代/机检会踩） | 在 D-3 的升级分支或 `escalation.js:applyInMemory` 补一句 `node.reviewReason = null`（与 `applyCancel` 同处） |
| **I-7** | `requirement.md:1840`（D-8 sha256）、`:95`（M-3） | M-3 要求 `declared` 图的投影"**不加 `sha256`**、逐字沿用 I1.2 的 spread"。若 `verifyProducts()` 无条件返回 `sha256: null`（`verify-artifacts` 的 I1.1 分支就是这样：`verify-artifact.js:168`），`{...ref, verifiedAt}` 会把 `sha256:null` 带进 `code-loop` 的 `state.json`，与 M-3 字面冲突（且 `test/wp4/orchestrator.test.js:283` 已把 `single` 的 `sha256:null` 钉住，容易误以为"都该有"） | D-8 补一句：`sha256 开关关闭时**不产生该键**（不是置 null）`；`declared` 调用方不传 `sha256:true` |
| **I-8** | `requirement.md:1734-1735`（D-8 产物名校验）、`:934-940`（AC-23） | AC-23 的 `../release-notes.md`、`C:\release-notes.md`、`release-notes.txt` 三行，若复用 `extractProductLines()` 校验，会先被 `normalizeProductRef()` 判为 `null`（`verify-artifact.js:228/232`）→ 返回 `PRODUCT_LINE_MISSING` 而不是 `PRODUCT_INVALID_TASK_LOOP`，且**回显不出用户写的原文**（`{name}` 为空）。AC-23 要的是"逐字回显 + 无效" | D-8 第 3 步补：`doc-single 的产物行校验**不得**复用 extractProductLines；按"整行唯一 产物： 之后到行尾"取原文 token 再做 5 条规则校验并原样回显` |
| **I-9** | `requirement.md:434`（§2.8）、`:121`（C-14）、`:589`（BR-29） | 三处都承诺重启对账"**节点与交接包现场不被改写**"，但 `markInterrupted()` 会覆盖现场节点的 `note`（英文 `stopped at node …`，`orchestrator.js:2712-2714`）与所有未终态交接包的 `note`（`:2715-2719`）。AC-45 的注（`:1235`）已承认这件事，正文却写反 | 把三处改成"**状态字段**（state/round/reviewReason/交接包 state）不被改写；`note` 会被写成停点说明（见 AC-45 注）" |
| **I-10** | `requirement.md:1532`（C-09） | C-09 要求"随这一帧保存**一次** CAS 落盘"。但现成的 `transit()` 自带一次 CAS（`orchestrator.js:457`），若把源节点 `review→done` 写成 `makeTransitioner(...)('node','done',…)`，就变成两次落盘（且第一次落盘时下游状态也已改，语义混乱），与 C-09 与 NFR-03 都冲突 | C-09 补一句：`源节点的迁移**不得**走 transit()（它会自带一次 CAS）；直接在 handleUpdate 里改 live 状态 + 手工 emit 一条 result='applied' 的事件，由该帧排队的 saveLive（orchestrator.js:881-895）落盘` |

---

## 3. 次要项

| 位置 | 问题 |
|---|---|
| `:1650` vs `:1521` vs `:1841` | `doc-single` 的 `artifactRefs` 落盘形状三处不一致：D-6 写 `{ref, bytes, sha256}`，D-3/D-8 写 `{ref, bytes, sha256, verifiedAt}`。建议以 D-3 为准，D-6 补 `verifiedAt` |
| `:1615` vs `orchestrator.js:75` | D-5 登记 `ESCALATION_TEXT.roundsPrefix`，代码里的常量叫 `ESC_TEXT`（`:75-79`）且已存在该键。建议 D-5 改成"沿用现有 `ESC_TEXT.roundsPrefix`"，避免实现者去新建一个重名常量 |
| `:1288` | A-1 约束引用 `（B-19）`，但 I1.3 的附录 B 只有 B-01~B-10；B-19 是 I1.2 的条目（`iteration-2/requirement.md:1485`）。建议写 `（I1.2 附录 B-19）` |
| `:800` | AC-13 写"（D-9 第 3 步）"，但 D-9 的 `reviewDecoy` 是"step 形状"下的圆点项，没有"第 3 步"。建议改成"（D-9 的 `reviewDecoy` 项）" |
| `:1110` vs `:1462` | AC-38 只扫 `orchestrator.js`/`advance.js`/`graph.js` 三个文件 + `review.js`，D-1 的红线是 `src/core/**` + `src/daemon/**`。建议 AC-38 改成"对 `src/core`、`src/daemon` 全目录扫描（`test/fixtures/purity-check.mjs` 已参数化，`--forbid` 传全表）"；否则 `escalation.js`/`verify-artifact.js` 里混入字面量不会被发现 |
| `:1112` | "`task-loop` 与 `code-loop` 的节点状态迁移都使用 `state-machine.js` 的同一张 node 表"——现在**已经**是部分直写：`dispatchInState` 直接 `node.state='running'`（`orchestrator.js:977`），`escalation.js:108` 直接 `'escalated'`，`applyCancel` 直接 `'cancelled'`（`:2500`）。这条不可机检，且字面不成立。建议改成"节点状态词取自 `state-machine.js` 的 `NODE_STATES`，迁移合法性由该表定义（既有直写点保持不变）" |
| `:1635` | `review.downstream_accepted` 的 detail 只有 `{handoffId, fromNodeId}`，没有 `round`；AC-05 要断言"T-002 有 2 条 done 事件、分别对应第 1/2 轮"，只能靠 seq 与 HO-002/HO-004 的 accepted 先后推断。建议 detail 补 `round`，AC-05 直接按 round 配对 |
| `:1639` vs `:1395` | `review.read` 可能在**同一轮发两次**：`hasSubmittedOutput()`（判是否交卷）会调 `readReview()`，`finishReviewNode()` 再调一次。AC-39 只断言"输出含 读取审核"，不查次数，但 detail.results 会重复、事件审计变噪。建议 `hasSubmittedOutput` 复用第一次读结果，或明确"两次 read 均可" |
| `:1265` | `node --test test/` 在本机（Node v22.22.2 / Windows）**直接报 `Cannot find module 'D:\WWW\Maestro\test'`**；实测 `node --test "test/**/*.test.js"` 才得到 337/337。建议 §3.3#10 与 NFR-10 改成 glob 形态（I1.2 也是同款写法，属继承问题） |
| `:1370` | A-3 停止推进的节点行固定为 `节点 T-00n <角色> <升级前的状态>（升级未记录） · 第 <n> 轮`（不带耗时）。但 `renderNodeRow` 仍会拼 `verdictSuffix`，I1.3 再加"审核 驳回 · 缺陷 N 条"后，若 `halting` 发生在 `failed+reject` 分支，A-3 的行会多出后缀（AC-30 走 review 分支，碰不到）。建议 A-3 补"也不带产物/审核后缀"，或在 `renderRunTail` 里显式抑制 |
| `:1271` | 附录 A 导语说"`<d>` 是 `3s`/`1m12s` 这类时长（**亚秒正值至少显示 `1s`**）"，但 `formatDuration(0)` 返回 `0s`（`labels.js:233`），而 A-2 又禁止"耗时 0s"。两句口径要统一：要么允许 `0s`（那就删掉 AC-35 的"不含耗时 0s"），要么规定 `startedAt===endedAt` 时也钳到 `1s` |

---

## 4. 逐项核对结果（对应任务书的 23 项）

1. **派发/交接包数** —— 只有一处不平。逐个实数（派发 = 首派 + 每次下游/回流/复测）：
   - `doc-pass` 3 派发 / 2 包（AC-06 不查数，D-9 写 2 ✓）
   - `doc-backflow-once` 5 派发（T-001/1、T-002/1、T-003/1、T-002/2、T-003/2）/ 4 包（HO-001~004，kind 依次 forward/forward/backflow/retest）→ AC-33 `:1046-1049` ✓；AC-05 的 2 条 T-002 `done` ✓
   - `doc-reject-twice` 5 派发 / 4 包 + 1 升级（defects 2）→ AC-10 `:761-762` ✓
   - `review-missing` 3 派发 / 2 包（无 HO-003）、T-002 `done` → AC-13 `:798`、AC-31 `:1023-1026` ✓
   - `doc-missing|empty|stale` 2 派发 / 1 包（无 HO-002）、T-002 escalated、T-003 pending → AC-19 `:880-882` ✓
   - `research-*` 1 派发 / 0 包 → AC-21 `:912-913` ✓
   - `doc-previous-modified|missing` **4 派发 / 3 包**、T-003 仍 `failed` round=1 → `dispatchCount=4` 对（`:896`），但"没有**第三次** backflow"（`:897`）措辞错，且未断言包数（见 I-2）
   - `execution-fail` 2 派发 / 1 包 → AC-43 `:1179-1180` ✓
   → **结论：唯一不平的是 AC-20 的措辞，数字本身对。**
2. **`dispatchCount` 语义**：`dispatchInState` 的顺序是"round+1、dispatchCount+1 → saveState → 发 node.dispatch → createAdapter → 建 session"（`orchestrator.js:976-1028`），所以建会话失败时"计数已 +1、sessions 仍为空"是现成事实 → **AC-42 可成立**（`:1168`）。
3. **首派无前置包 / HO 编号顺序**：`nextHandoffId()` 按现有 `state.handoffs` 取 max+1（`advance.js:93-100`），`advanceLocked` 里 backflow 包先 push（`:1768`），retest 后 push，因此 HO-003（backflow）< HO-004（retest）与 `advance` 构造顺序一致 → **AC-33 成立**。
4. **AC-04 根 A**：`pauseFor('after_output')` 在 `running→review` 的迁移与 `saveLive` **之后**（`orchestrator.js:1430-1435`），会话在更早处已切 `waiting_dependency`（`:1395-1410`）→ 只要把 `reviewReason='evidence'` 写进那次迁移的落盘，暂停点就能看到 `待校验（核对证据）` + `会话 等待下游` → **可构造**。
5. **AC-04 根 B（`--stop-after 2`）**：`maybeStopAfter` 在 `finishGraphNode` 之后、`advance` 之前（`orchestrator.js:1897`；判定与落点 `:2770-2790`），此时 T-002 已 `review(downstream)`、T-003 未派发；T-001 的 `done` 由 T-002 的首个 turn 事件触发（早于 T-002 收尾）→ `T-001 state='done'` **成立**。
6. **AC-45 第 1 支**：`reconcileOnBoot` 只跳过 `CORE_IMMUTABLE`（含 `interrupted`）且只在 `created/running` 上动手（`:2665-2682`），不会改 T-002 的 `review`；`interruptAll` 只调 `markInterrupted`（`:2684-2698`），后者只写 `note`、不做节点迁移（`:2700-2735`），且实例 `running` → 只发 **1 条** instance 层事件（`:2721-2734`，`created` 才会多一条）；daemon 的 `CORE_*` 日志走 `core.log` 不进 `events.jsonl` → **断言成立**；`renderInterruptedNote` 现取 `nodes[0]`（`render.js:141,258-263`），必须靠 `interruptedNodeId` 才能点名 T-002 → 需求给的修法正确。**唯一风险是 B-1 之外的 I-9（note 被改写）与 C-14 的措辞矛盾。**
7. **AC-30**：`markHalted` 只写 `halted` + `haltCause`、不改 `node.state`（`escalation.js:299-302`），`commitEscalation` 的内存改动随失败丢弃（`:207-226`）；`snapshotOf` 已透出 `haltCause`（`orchestrator.js:2636`），`renderRunTail` 用它拼 `ESCALATION_WRITE_FAILED`（`render.js:700-721`）→ **可构造**。
8. **第 2 步 `mtime >= roundStartedAt` 与 `-120000`**：`roundStartedAt` 取审核节点本次派发时刻（`orchestrator.js:979`），夹具把 mtime 设为"现在−120s"；只有审核回合**超过 120 秒**才会误判。`review-stale` 的 step 不设 `delayMs`，稳定 → **不是问题**（但建议 §D-9 注明"该场景不得加 delayMs"）。
9. **`expectedArtifact` 取值链路**：`finishArtifactNode(T-002)` 写 `node.artifactRefs=[v1]`（`:1528`）→ `planAdvance(passed)` 选 forward/retest 边（`advance.js:287`、`graph.js:113-131`）→ `buildHandoff` 必须从**源节点** `artifactRefs[0].ref` 取 `input` → `HO-002.input=[v1]` → T-003 的 `ctx.handoff` → `finishReviewNode` 取 `artifactRefs.input[0]`。forward/retest 的目标轮次恰等于版本号（T-003 round 1→v1、round 2→v2），所以"用目标轮次"也不出错；**但 backflow 不行**（目标 T-002 round=2 → 会取到 v2/v3）→ 见 B-3。
10. **AC-18 `escalations[0].defects 为空`**：`buildEscalation` 的 `defects` 是**可选、默认 `[]`**（`escalation.js:59-79`），`rounds_exceeded` 时传 2 条（`orchestrator.js:1621`）。同一字段承载 0..N，**两者可共存**，无需改契约。
11. **A-1 的 `升级 —`**：`orch run` 成功路径本来就会打（`main.js:349-350` → `renderEscalationBlock`，`single` 返回 `[]`、`code-loop` 无升级时返回 `['升级 —']`，`render.js:637-641`）；I1.2 附录也写着"最后一行等于 升级 —"（`iteration-2/requirement.md:570,596`）。→ **AC-06 成立，且不动 code-loop**。
12. **A-2 耗时出现条件**：六种都能用现有字段实现——`startedAt`/`endedAt`/`state`/`reviewReason`/`note` 全在 `artifactHistory` 之外，无需新字段；但新增的 `review(downstream)` 与 `failed+等待复审` 两支必须与模板门控一起加（见 I-5）。现判断只在 `done|cancelled`（`render.js:416-419`）。
13. **A-2 第 5 段版式**：现 `handoffStateLines` 就是 `号 ␠␠ 方向 ␠␠ 状态 ␠␠␠ 时间[␠␠ 原因 x]`（`render.js:520-537`），`task-loop` 只要 `template!=='single'` 就自动带方向（`roleLabel` 从 `nodes[].roleId` 取），**不需要新分支**；`single`（无方向）/`code-loop`（有方向）逐字不变。
14. **`roundsDetail`**：`ESC_TEXT.roundsPrefix + title + 已派发 N 次仍未通过`（`orchestrator.js:81-84`），title 来自 `def.title`（`templates/index.js` 图数据），`round` 是 T-003 的 `node.round=2`（`:1620`）→ 整句正确；`src/core/**` 现有禁词命中 **0**（脚本实测）→ **AC-38 的这条成立**。
15. **A-3 停止推进的节点行**：`renderRunTail` 已用 `renderNodeRow(..., {forceQualifier, noDuration:true})`（`render.js:713-718`），因此**不打耗时**；但 `verdictSuffix` 与新增后缀未被抑制（见 §3 的 `:1370` 一行）。
16. **AC-38 禁词**：`probe/rv3-forbidden.mjs` 扫 `src/core/**` + `src/daemon/**` 的 7 个词（含注释），当前命中 **0**（文件清单：`orchestrator.js`/`advance.js`/`graph.js`/`escalation.js`/`verify-artifact.js`/`verdict.js`/`state-machine.js`/`event-bus.js`/`error-map.js` + `src/daemon/**`）。注意现有 `test/templates/fake-graph.test.js:281-282` 只扫 `code-loop/developer/tester/coordinator`，`test/fixtures/purity-check.mjs:22` 的默认禁词表也还是旧四项 → 新 AC 必须用 `--forbid` 显式传新表（覆盖范围问题见 §3）。
17. **`reviewReason` 取消清空**：`applyCancel` 遍历**全部** `work.nodes`，只在 `CANCEL_NODE` 命中时改状态（`:2497-2514`），把新句放这个 if 内即可覆盖 pending/running/review/failed/escalated；`done` 被跳过但 `done` 本就不该有值。**遗漏在升级路径**（见 I-6）。
18. **C-09 一次 CAS**：`handleUpdate` 已有"同一帧排队一次 `saveLive`"的机制（`enqueue` + `saveLive`，`:881-895`），但**不要走 `transit()`**（它自带一次 CAS，`:457`）→ 见 I-10。
19. **`artifactRefs` 清空与轮次可辨**：`dispatchInState` **并没有**清空 `artifactRefs`（只有 `:2029` 的首次建实例与两处核对后的赋值）；M-3 现状列的"每次派发被清空"与代码不符 → 必须**新增**清空（`node.artifactRefs = []` 放进 `:976-983` 那段）。终态 `state.json` 里 T-002 只有一个 `artifactRefs`（=v2）与 `artifactHistory`（两轮），**无法分辨"第 1 轮那次 done"**；AC-05 已明确用 `events.jsonl` 配对（`:679-682`），口径正确，但建议 D-5 的 done 事件 detail 补 `round`（见 §3）。
20. **编号连续性**：脚本实测 AC 01~45 连续无缺无重；BR 01~40、M 1~10、C 1~14、D 1~10、A 1~4、NFR 1~10、R 1~6 均无断号。B 只到 10（`B-19` 是跨迭代引用，见 §3）。
21. **引用完整性**：全文 `AC-/BR-/M-/C-/D-/R-/A-/NFR-` 引用全部落在已定义区间内（脚本统计）；唯一悬空的是 `B-19`（属 I1.2）。
22. **29 个场景名**：§3.3 第 6 条 与 D-9 场景表**逐字一致、顺序一致**（脚本逐串比对，`only33=[]`、`onlyD9=[]`、`sameOrder=true`）；AC 中引用的场景名全部在表内。
23. **文案键对应**：`REVIEW_TEXT` **11** 条（prefix/missing/stale/unparsable/decisionInvalid/artifactMissing/artifactMismatch/passWithDefects/rejectNoDefects/defectShape/evidenceUnreadable）、`ARTIFACT_TEXT` **5** 条（missing/empty/stale/previousMissing/previousModified——任务书说的"6 个"在文中不存在，`previous*` 两条对应 D-8 的第 2 步）。D-7 的 11 步 reasonCode 与 D-5 的 `REVIEW_TEXT` 一一覆盖（第 3/4/5 步共用 `unparsable`，与 D-7 的"同上"一致）。`REASON_LABEL` 新增 6 条；D-4 列的 14 个事件里剩余 8 个（`handoff.created/delivered/consumed`、`backflow.constructed`、`rounds.exceeded`、`escalation.created`、`node.dispatch`、`run.started`）在 `labels.js:143-179` **已存在**；doc-backflow-once 还会用到 `output.submitted`/`verification.passed`/`run.completed`/`session.state`/`turn.first_event`，也都已登记 → **AC-39 的"无未翻译英文 reason"可满足**（唯一提醒：`test/wp2/labels.test.js:208` 的条数断言要同步，见 I-3）。

---

## 5. 必须改的清单（按严重度，精确 before → after）

**P0（不改则 AC 必挂 / 必红）**

1. `:1073`（AC-35）
   - before：`带下游门控的节点（T-001、T-002）每一轮的 roundStartedAt 都晚于或等于上游节点同轮的 review.evidence_verified 事件 ts`
   - after：`T-001 第 1 轮与 T-002 第 1 轮的 roundStartedAt ≥ 各自上游（run.started / T-001）的 review.evidence_verified ts；T-002 第 2 轮的上游 T-003 无门控、不产生该事件，改为 roundStartedAt ≥ T-003 第 1 轮 review.rejected（result='note'）事件 ts`

2. `:1923-1935`（D-9 必须同步的测试表）
   - before：（无 `test/templates/fake-graph.test.js` 一行）
   - after：`| test/templates/fake-graph.test.js | :214-229 的 buildHandoff 键集合追加 'artifactRefs' / 'revisionRequirement'（M-4 授权变更，其余 14 键不变） |`
   - 同时 `:1092`（AC-36）与 `:1265`（§3.3#10）把"逐字不变/全部保留"改成"除 D-9 登记的两处断言（键集合、REASON_LABEL 条数）外逐字不变"

3. `:1661-1668`（D-6 按边表）+ `:1450`（D-1）
   - before：三行都用 `<round>`，`input` 未写来源
   - after：按 §1-B-3 的四行表逐列写明 `forward/retest 的 input = 源节点 artifactRefs[0].ref`；`backflow 的 input = previous = 目标轮次 n−1`、`output = n`；并补一句"`advance.js` 的 `productsOf()` 在 `doc-single` 下不得回退到任务 `产物：` 行"

4. `:1455`（D-1 `promptFor`）
   - before：`以 node.prompt 为唯一分派键（不按模板名/角色名分支）`
   - after：`新增 research/write/review 三个键由 node.prompt 分派；既有 single/forward/verify 与按 handoff.edge.kind 选 backflow/retest 的分支逐字保留（templates/index.js:221-237）`

5. `:1882`（D-9 `reviewDecoy`）+ `:1813-1821`（D-8 审核提示词）
   - before：`路径由 mock 从提示词的 写入路径： 反推：取到 workspace/ 为止`
   - after（推荐）：审核提示词增一行 `工作区：<workspace 绝对路径>`，D-9 改为 `从提示词「工作区：」取绝对路径再拼 out/review.json`

**P1（会拖慢一轮）**

6. `:1520-1525`（D-3）：补 `调 consumeHandoff(ctx,'handoff.consumed')`（先于 saveLive）。
7. `:897`（AC-20）：`没有第三次 backflow 交接包` → `handoffs 恰好 3 条（HO-001~HO-003），backflow 恰好 1 条（HO-003），没有 HO-004`。
8. `:1923`（D-9）：`test/wp2/labels.test.js` 行补"REASON_LABEL 条数 33 → 39"。
9. `:1256-1262`（§3.3 3/7 条）：补"`task-loop-driver.mjs` 必须像 `code-loop-driver.mjs:466` 一样注入 `NODE_ENV='test'`"。
10. `:1318-1323`（A-2）：后缀与新增耗时分支加"仅 `productPolicy==='doc-single'` 渲染"。
11. `:1648`（D-6）/ `:1520`（D-3）：升级分支补 `node.reviewReason = null`（与 `applyCancel` 同处）。
12. `:1840`（D-8）：`sha256` 开关关闭时**不生成该键**（不是 null）。
13. `:1734-1735`（D-8）：`doc-single` 产物名校验不得复用 `extractProductLines`（否则 `../x.md` 会得到"缺产物行"且无法回显原文）。
14. `:434`/`:121`/`:589`：把"节点与交接包现场不被改写"改为"状态字段不被改写；`note` 会写成停点说明"。
15. `:1532`（C-09）：补"源节点迁移不得走 `transit()`（自带 CAS）"。

**P2（一次改完即可）**

16. `:1650` 的 `artifactRefs` 形状补 `verifiedAt`；`:1615` 的 `ESCALATION_TEXT` 改成沿用 `ESC_TEXT`；`:1288` 的 `B-19` 写成"（I1.2 附录 B-19）"；`:800` 的"D-9 第 3 步"改成"D-9 的 reviewDecoy 项"。
17. `:1110`（AC-38）改成对 `src/core` + `src/daemon` 全目录扫描（`purity-check.mjs --forbid` 传 7 词全表）；`:1112` 的"同一张 node 表"改成"状态词取自 NODE_STATES、迁移合法性由该表定义"。
18. `:1635`（D-5）：`review.downstream_accepted` 的 detail 补 `round`。
19. `:1265`/NFR-10：测试命令改成 `node --test "test/**/*.test.js"`（本机实测 `node --test test/` 直接 `MODULE_NOT_FOUND`）。
20. `:1271`/A-2：统一"`0s` 是否允许"的口径（现 `formatDuration(0)='0s'` 与 AC-35 的"不含耗时 0s"互相拉扯）。
