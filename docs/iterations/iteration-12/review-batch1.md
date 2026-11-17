# I1.12 批次 1 实现评审报告（WP-1 / WP-2 / WP-3）

> 评审角色：实现评审 Agent（批次 1，干净上下文，只读）
> 评审对象：HEAD `5d9fa26` 工作树 WP-1/WP-2/WP-3 共 13 文件 diff；唯一可写文件为本报告。
> 判据来源：`requirement.md` v2.1、`iteration-12.md` §2/§3/§4/§6/检查点 1、`decisions.md` 裁决 A/B；上游只读基线实读 `git show 5d9fa26`。**全部结论基于自跑与实读，不采信 Agent 自述。**

---

## §0 总判

**总判：FAIL。** 阻断 **1** / 建议 **4**。

- **阻断 B1-01（维度 C，签名不符）**：`audit-verify.js:81` 导出 `verifyChain(input)`，与 §2.1 / §6 冻结点①逐字冻结的 `verifyChain({root, instanceId, fs})` 不符；且 §2.1 明定「实现只 import `createStore` 的 `readEvents`」，实现改为调用方自持 I/O。实测按冻结签名调用抛 `TypeError`。**这是冻结签名破坏，属阻断判据「签名不符」。**
- 其余五维 A/B/D/E/F 全部 PASS；三处待裁决/提示项（篡改序号口径、文案键、sha256Of 形态）经独立核查均**不构成阻断**，按建议处理。
- **门禁实跑**：8 契约测试 62/62 绿；全量 1588 tests / pass 1564 / fail 15 / skipped 9，**失败差集 = 0**（13 条 win32 登记项 + 2 条 flake 留帧）；三条 grep 零命中；purity 31 词双目录 `exit 0`；CJK 零命中；`deps 0`；I1.11 差集零命中。

**实跑命令清单**（详见 §7）：`git status/diff/show` 组、3 组静态 grep、CJK grep、`node --test` 契约组、purity×2、deps、全量 `node --test`、签名/串扰两个 node 复现脚本、历史证据恢复。

---

## §1 文件边界与授权段核查

**PASS。**

工作树改动共 13 文件，与 WP 定义逐文件吻合，零越界：

| WP | 文件数 | 文件（`git status --porcelain`） | 判定 |
|---|---|---|---|
| WP-1 | 4 | `src/core/audit-verify.js`(新)、`src/core/event-bus.js`(改)、`test/wp15/chain-verify.test.js`、`test/wp15/chain-compat.test.js` | PASS |
| WP-2 | 5 | `src/core/governance.js`(新)、`test/wp15/{governance-wake,governance-review,governance-granularity,boundary-i111}.test.js` | PASS |
| WP-3 | 4 | `src/core/handoff-schema.js`(改)、`src/core/budget.js`(新)、`test/wp15/{evidence-stale,budget}.test.js` | PASS |

**`event-bus.js` 授权段**（`git diff`，仅 1 个 hunk `@@ -9,8 +9,31 @@`）：
- 新增 `import { createHash }`（:12）、`export const ZERO_HASH`（:15，由 const 提为导出）、`canonicalizeEvent`（:22-31）、`eventFingerprint`（:34-36）。
- 落点与 `ZERO_HASH` 同段，属裁决 B 第 4 条 / §8.2 冲突 5 允许的符号锚点合理落点。
- `emit`/`replay`/`enqueue`/落盘失败不广播/单实例串行化段落（:38-181）**逐字未改**。`git diff -- event-bus.js` 的增删行全部落在 :12-36。写路径零改 PASS。

**`handoff-schema.js` 授权段**（`git diff`，仅 2 个 hunk）：
- hunk1 `@@ -302,7 +302,149 @@`：在 `validateBackflow` 之后追加只增块（`:305-452`），含 `EVIDENCE_STALE`(`:314`)、`validateEvidenceFreshness`(`:383-449`)。
- hunk2 `@@ -310,5 +452,7 @@`：`validateHandoff` 链末尾追加两行（`:455-456`）。
- `CODES`（`:17-25`，8 键）、既有失败码与顺序、`HANDOFF_HASH_MISMATCH`（`:24` 定义 / `:273` 使用）**零改**。与 `git diff 5d9fa26` 对拍一致。授权段外零改 PASS。

---

## §2 只读与纯判定核查

**PASS。**

| 检查 | 命令 | 结果 |
|---|---|---|
| 写/迁移 | `grep -REn "writeFile|appendFile|unlink|saveState|transit\(" audit-verify.js governance.js budget.js` | 零命中 |
| 时钟判定 | `grep -REn "Date\.now" 三模块` | 零命中（governance 仅用注入 `now`，`isoAt` :50-70） |
| 中文硬编码 | `grep -RPn "[\x{4e00}-\x{9fff}]" 三模块` | 零命中 |
| 状态枚举 | budget.js 源码 | 仅 `const SUSPENDED_STATE='suspended'`(:17) 复用既有词；reason 为 `budget_exhausted`/`invalid_limit` 码(:20-21)，无新枚举 |

说明：`governance.js:614-627` 的 `isoAt` 对注入数字/字符串调用 `new Date()`，但时间源是入参 `now`（`decideWake` 签名含 `now`，§2.2 一致），非 `Date.now()` 环境时钟，符合「无 Date.now 参与判定」。

---

## §3 导出签名与判定结构核查

**FAIL（1 项签名不符，其余 8 项 PASS）。**

| 导出 | §2.1/2.2/2.3 契约签名 | 实现签名（行号） | 判定 |
|---|---|---|---|
| `verifyChain` | `verifyChain({root, instanceId, fs})` | `verifyChain(input)`（audit-verify.js:81） | **FAIL** |
| `verifyChainText` | `verifyChainText(result, labels)` | `verifyChainText(result, labels)`（:161） | PASS |
| `decideWake` | `({sourceRole,targetRole,roles,now})` | 同名（`governance.js:114`） | PASS |
| `validateHighRiskReview` | `({workflow,roles,graph})` | 同名（:266） | PASS |
| `reviewDecision` | `({instanceId,nodeId,needsHumanReview,blocked,reason})` | 同名（:315） | PASS |
| `isPrimaryAuditEvent` | `(event)` | `(event)`（:356） | PASS |
| `validateEvidenceFreshness` | `(handoff, {workspaceDir,cwd,sourceNode,graph,fs,sha256Of})` | 同名（`handoff-schema.js:383`） | PASS |
| `decideParallelism` | `({readyNodes,runningNodes,maxConcurrent,instanceBudget})` | 同名（`budget.js:113`） | PASS |
| `decideBudget` | `({remainingBudget,nextCost,state})` | 同名（:146） | PASS |

**判定结构字段核对**（齐全、无 UI 字段）：
- `verifyChain` 失败返回含 `code:'CHAIN_BROKEN', seq, detail, expected, actual, total`（:109-123），成功返回含 `total, firstMismatch:null, badLines`（:131-140）——字段齐全；额外带 `count/badIndex/gaps/historical` 为内部计数，非 UI 字段。结构本身不弱化，问题仅在**入参签名与 I/O 归属**。
- governance 四函数返回 `detail{from,to,reason,at}` / `{ok,needsHumanReview,blocked,reason,nodeIds}` / 冻结副本 / `boolean`，均为 §3.2/D-5 最小字段，无 UI 键（`boundary-i111.test.js:168-184` 断言）。
- budget 两函数返回 `{allowed,queued,limit,reason}` / `{suspend,reason,resumeRound}`（:130/:157-168），无 UI 字段，无 `state` 枚举外的派生产物。
- `validateEvidenceFreshness.decision` = `{instanceId,handoffId,nodeId,stale,reason}`（`handoff-schema.js:400`），恰为 D-4 五字段，无 UI 键。

---

## §4 AC 判定强度核查（批次 1 主责 13 条）

| AC | 判定 | 行号证据 |
|---|---|---|
| **AC-01** 篡改100%命中+首处序号+原件不变 | PASS | `chain-verify.test.js:118-142`（改 prev→seq2、A-2 逐字 :139、退出码非0 :138、原件哈希 :140）、`:144-164`（改内容→seq3、100%命中）；实现 `audit-verify.js:100-124`。详见 §5.1 口径矛盾。 |
| **AC-02** 旧链 N+1/prev=末条指纹/历史不校验 | PASS | `chain-compat.test.js:86-122`（旧行字节不变 :104-105、seq N+1 :108-111、断点0 :118-119）、`:152-167`（不可读行+空洞跳过计数）、`audit-verify.js:100-106`（无 prev 视为历史）；原件哈希/写路径零改见 §1。 |
| **AC-03** 白名单内正常投递、拒绝0 | PASS | `governance-wake.test.js:61-78`（allowed、detail 形状）、`:80-95`（投递/建会话、拒绝0）；`governance.js:114-147`。 |
| **AC-04** 白名单外恰1条新码、wake.rejected 不动 | PASS | `governance-wake.test.js:97-110`（恰1条 `wake.not-whitelisted`）、`:112-126`（不投递/不建会话）、`:183-195`（`labels.js` 既有 `wake.rejected:'唤醒被拒'` 逐字不动、无 `wake.denied`）；实现固定单 reason 常量 `governance.js:20`。 |
| **AC-05** 指纹一致照常投递 | PASS | `evidence-stale.test.js:103-114`（一致放行、拒绝0、升级0）、`:116-125`（全链通过）。 |
| **AC-06** 过期拒绝+升级恰1次+关联节点+零UI | PASS | `evidence-stale.test.js:127-143`（不一致→恰1升级、nodeId=T-002）、`:145-161`（缺失→恰1升级）、`:177-190`（5字段无UI、冻结）；纯判定产数据，升级由接线侧执行（纯模块纪律）。 |
| **AC-07** 缺终审不通过+节点定位/补齐通过 | PASS | `governance-review.test.js:121-129`（`missing_human_gate`+nodeIds）、`:131-147`（补 human/escalate 后通过）、`:181-188`（数据不足 blocked+定位）；`governance.js:229-303`。 |
| **AC-08** 未裁决不推进+裁决记录 | PASS | `governance-review.test.js:190-204`（未裁决不推进）、`:206-231`（冻结证据副本、无 UI）、`:233-246`（裁决后推进）；`governance.js:315-323`。 |
| **AC-09** node/handoff/health 进主审计 | PASS | `governance-granularity.test.js:80-102`；白名单 `governance.js:30-36`（`node.state.change`/`handoff.*`/`health.changed`/`core.suspend`/`run.halted`），与 D-5 一致。 |
| **AC-10** connection/role/session 不独立审计 | PASS | `governance-granularity.test.js:104-117`（三类均 false）、`:138-147`（聚合可由 handoff 重算）、`:149-156`（每 handoff 状态只记一次）；`governance.js:356-361`。 |
| **AC-11** 5就绪上限2排队补位无failed | PASS | `budget.test.js:110-125`（≤2运行/≥3等待/无failed）、`:127-141`（补位）、`:143-153`（取较小上限）、`:155-165`（非法值保守）；`budget.js:68-131`。 |
| **AC-12** 耗尽 suspended 非 failed、原轮次恢复 | PASS | `budget.test.js:167-183`（suspended、budget_exhausted、无failed、无失败事件）、`:185-207`（resumeRound=4 原轮次恢复）；`budget.js:146-169` 复用 `suspended`。 |
| **AC-23** I1.11 零交集 | PASS | `boundary-i111.test.js:136-166`（判定含 reason+节点）、`:168-184`（无 UI/无 CJK）、`:186-209`（改动清单与 I1.11 特征零交集）；本人独立复核 `git status` + I111 特征 grep 零命中。 |

**测试覆盖（E）**：8 文件 62 用例全绿，`skip/todo/assert.ok(true)/equal(true,true)` 零命中；断言锚点按同号 Then（如 `AC-04 #1`）；8 文件可独立运行（检查点 1 要求）。PASS。

---

## §5 四重点独立核查

### 5.1 篡改定位序号口径（WP-1 披露）— 实现忠实 D-2，需求内部有矛盾，需主控裁决；不阻断

- **D-2 口径**（requirement.md:635）：「对每条记录…与前一条记录自身的规范化指纹比对；…遇第一条失配即报 A-2 文案并停」。按此，改第 2 条**内容**（`to`）后，第 2 条自身的 `prev` 仍等于第 1 条指纹，首个 `prev` 校验失败落在**第 3 条**；直改某条 `prev` 字段则该条即失配。
- **实现**：`audit-verify.js:108-124` 以 `record.prev_event_hash !== expected` 为失配点、`seq` 为失配序号；测试 `chain-verify.test.js:118-142`（直改 prev→seq2）/`:144-164`（改内容→seq3）如实固化两种口径。
- **判定**：实现**忠实 D-2、不弱化 AC-01 Then**——Then（:262）只要求「指出第一条对不上的记录序号」，实现确实给出首个 `prev` 校验失败序号，篡改 100% 命中、原件哈希不变均成立。
- **需求内部矛盾**：§3.1 示例（requirement.md:236）写「改第 2 条 `to` → 返回 `seq:2`」，与 D-2 算法对同一操作应得 `seq:3` 冲突。**主控需裁决**：AC-01「第一条对不上的记录序号」究竟指「被篡改的那条」(示例口径=2) 还是「首个 prev 校验失败记录」(D-2 口径=3)。本评审不改需求；若主控采示例口径，需同步修 D-2/测试锚点，但这是**需求侧裁决，不构成批次 1 实现阻断**。

### 5.2 A-1/A-2 文案键名 `CHAIN_COMPLETE`/`CHAIN_BROKEN`（WP-1 披露）— 合理跨 WP 契约，非越界；不阻断

- 实现 `audit-verify.js:20-23` 冻结键名常量 `CHAIN_LABEL_KEYS={ok:'CHAIN_COMPLETE',broken:'CHAIN_BROKEN'}`；`verifyChainText`（:161-171）仅用键取模板，缺键抛错（:143-148 `templateOf`），**不回落硬编码中文**；CJK 零命中。
- 判据：§6 冻结点①明确把「A-1/A-2 文案键」列为 **WP-1 产出**；§2.1 要求 `verifyChainText(result, labels)`「按 A-1/A-2 键拼文案，自身无中文字面」；D-13 / A-0 要求中文只在 `labels.js`。键名（英文常量）冻结 ≠ 文案值冻结。
- **判定**：属冻结点①授权内的合理跨 WP 契约，不违反 D-13，非越界。转 **建议 S-02**：WP-7 接线时必须在 `labels.js` 为 `CHAIN_COMPLETE`/`CHAIN_BROKEN` 加键（同 `wake.not-whitelisted` 加键纪律），否则 `verifyChainText` 抛错。

### 5.3 EVIDENCE_STALE 不入 CODES（WP-3 披露）— 与 D-4/AC-05 一致，既有基线零改；不阻断

- `git diff 5d9fa26 -- src/core/handoff-schema.js` 实核：`CODES` 8 键（:17-25）、`HANDOFF_HASH_MISMATCH`（:24/:273）零改；`EVIDENCE_STALE`（:314）为独立 export，`Object.values(CODES).includes(EVIDENCE_STALE)===false`（`evidence-stale.test.js:204-219` 断言）。
- 判定结构 `decision` 五字段（:400）与 D-4（requirement.md:647）逐字一致，reason 三值 `fingerprint_mismatch`/`evidence_missing`/`hash_unavailable` 齐备；追加步骤在链末尾（:455-456），`validateHandoffEvidence` 既有路径不删不改。
- **判定**：PASS，与 D-4/AC-05 判定结构一致，既有 `HANDOFF_HASH_MISMATCH` 与 CODES 8 键零改。无问题。

### 5.4 sha256Of 对象/字符串形态（WP-3 披露）— 新函数健壮，但接线提示不足、有潜在串扰；不阻断（建议）

- 新函数 `validateEvidenceFreshness`（`handoff-schema.js:423-438`）兼容字符串、`{ok:false}`、`{ok:true,sha256}` 三态，`doc-artifact.js::sha256Of` 对象形态可被正确消费（`evidence-stale.test.js:163-175` 断言 `hash_unavailable` 分类）。
- **潜在串扰**：遗留 `validateHandoffEvidence` 在 `:272` 用 `String(digest).toLowerCase()` 只接受字符串。实测：若调用方把对象形态的 `doc-artifact.sha256Of` 经 `opts.sha256Of` 同时注入 `validateHandoff`（:451 legacy 步骤），一致指纹会被 `String(digest)` 变成 `[object Object]`，**误判 `HANDOFF_HASH_MISMATCH`**（本人实跑复现：`ok:false, code:'HANDOFF_HASH_MISMATCH'`，而指纹实为一致）。
- 当前契约测试未触发：`evidence-stale.test.js:116-125/:192-202` 经 `validateHandoff` 时不注入 `sha256Of`（走默认字符串实现），所以测试全绿；串扰只在接线层注入对象形态时出现。
- **判定**：WP-7 接线提示**不够清晰**，存在跨 WP 串扰风险。属「契约提示类」= **建议 S-03**，交批次 2/3 处理：明确 `validateHandoff` 继续传默认字符串型 hash，或对 legacy 步骤注入字符串适配，避免与 D-4 对象形态混用。非批次 1 阻断。

---

## §6 修复清单

### 阻断项

**B1-01 — `verifyChain` 入参签名与冻结签名不符（严重度：高，阻断）**
- **位置**：`src/core/audit-verify.js:81` `export function verifyChain(input) {`
- **原文**：入参为 JSONL 文本 / 行数组 / `{text}` / `{lines}`（`:25-33 toLines`），模块自述「caller owns all I/O, no store is consulted」（文件头 :9-10）。
- **违反条款**：§2.1 逐字冻结 `verifyChain({root, instanceId, fs})` 且「实现只 import `createStore` 的 `readEvents`（只读）」；§6 冻结点①；阻断判据「签名不符」。
- **后果实证**：`node --input-type=module -e "..."` 按冻结签名调用 `verifyChain({root,instanceId,fs})` → `TypeError: verifyChain: expected JSONL text or an array of lines`。WP-7 `verifyCommand`（§2.7，按冻结签名接线）将直接崩溃。
- **建议修法**（二选一，不改冻结签名）：① 保留内部纯函数，新增/改为导出 `verifyChain({root, instanceId, fs})`，内部用注入 `fs` 或 `createStore.readEvents` 读 `events.jsonl` 后转文本再交给纯核（读路径、零写）；② 主控书面裁决变更冻结点①签名——如裁决则须同步 §2.1 与 WP-7 接线契约，不得默认放行。当前代码**不满足**冻结签名，判阻断。

### 建议项

- **S-01（需求内部矛盾，主控裁决）**：§3.1 示例（requirement.md:236，改第2条 `to`→`seq:2`）与 D-2（:635，同一操作→`seq:3`）冲突。实现按 D-2、忠实且不弱化 Then。请主控明确 AC-01「第一条对不上」口径；若采示例口径，须同步修 D-2/测试锚点。建议级（需求侧，非实现阻断）。
- **S-02（文案键接线）**：WP-7 必须在 `src/cli/labels.js` 为 `CHAIN_COMPLETE`/`CHAIN_BROKEN` 加键（冻结点①授权 WP-1 冻结的键名），否则 `verifyChainText` 缺键抛错。
- **S-03（sha256Of 串扰提示）**：在 WP-7 接线说明中明确——`validateHandoff` 步骤链中 legacy `validateHandoffEvidence`（:272）只吃字符串型 hash，不得把 `doc-artifact.sha256Of` 对象形态经同一 `opts` 注入；建议补一条「经 `validateHandoff` 注入对象形态 hash 仍正常放行」的契约测试。
- **S-04（审计事件层计数的归属确认）**：AC-04「恰 1 条拒绝审计事件」/ AC-06「升级恰 1 次」在批次 1 仅于**纯判定 + 调用侧桩**验证（`governance-wake.test.js:55-59`、`evidence-stale.test.js:94-101`）。审计事件/升级落库由 WP-7 `escalation.js` 接线承担（§2.7）；请检查点 3 确认该层断言补齐，避免纯模块绿而接线层漏拦。

---

## §7 实跑命令与输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `git status --short` / `--porcelain` | 13 文件：2 改（event-bus/handoff-schema）+ 3 新 src + test/wp15/ 8 测试；无越界 |
| 2 | `git diff --stat` | `event-bus.js +25-1`、`handoff-schema.js +146-2` |
| 3 | `git diff -- event-bus.js` | 仅 `@@ -9,8 +9,31 @@`，改动落在 :12-36；写路径零改 |
| 4 | `git diff -- handoff-schema.js` | 仅 `@@ -302,7 +302,149 @@`、`@@ -310,5 +452,7 @@`；CODES/顺序零改 |
| 5 | `git show 5d9fa26:src/core/event-bus.js \| head -60` | 原版 `const ZERO_HASH`（非 export）、无 createHash import → 授权段增量确认 |
| 6 | `git show 5d9fa26:src/cli/labels.js \| sed -n '354,390p'` | 既有 `'wake.rejected': '唤醒被拒'` 逐字在基线；当前 labels.js 未被改 |
| 7 | `sed -n '45,75p' src/persistence/instance-store.js` | 私有 `canonicalize`/`hashRecord` 口径，与 `canonicalizeEvent`/`eventFingerprint` 字节级镜像（`chain-compat.test.js:124-150` 对拍） |
| 8 | `grep -REn "writeFile\|appendFile\|unlink\|saveState\|transit\(" 三模块` | 零命中 |
| 9 | `grep -REn "Date\.now" 三模块` | 零命中 |
| 10 | `grep -RPn "[\x{4e00}-\x{9fff}]" 三模块` | 零命中 |
| 11 | `grep -REn "test\.skip\|test\.todo\|assert\.ok(true)\|equal(true,true)" test/wp15/` | 零命中 |
| 12 | `NODE_ENV=test node --test`（8 契约文件） | `# tests 62 / pass 62 / fail 0 / skipped 0 / todo 0` |
| 13 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>` | `OK 扫描34文件 零命中 exit 0` |
| 14 | `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31词>` | `OK 扫描31文件 零命中 exit 0` |
| 15 | `node -e "...deps.length"` | `0` |
| 16 | 全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` | `tests 1588 / pass 1564 / fail 15 / skipped 9`；15 条逐条比对：13 条在 `baseline-failures-win32.txt`，2 条（HANDOFF_EVIDENCE_ESCAPE 符号链接、AC-04 空态/2秒 timing）在 `iteration-10b/evidence/flake-frames/` 留帧 → **差集 0** |
| 17 | I1.11 差集（tracked+untracked）`grep -iE "i1[._-]11\|notify\|interven\|evidence-view\|canvas\|tray"` | 零命中 |
| 18 | `node --input-type=module -e "... verifyChain({root,instanceId,fs})"` | `TypeError: verifyChain: expected JSONL text or an array of lines` → B1-01 实证 |
| 19 | `node --input-type=module -e "... validateHandoff + doc-artifact.sha256Of"` | 一致指纹被误判 `HANDOFF_HASH_MISMATCH` → S-03 串扰实证 |
| 20 | `git -c core.autocrlf=false checkout-index -f -- <3 个 iteration-4 证据>` | 复原全量测试覆盖写的历史证据；复核后工作树回到 13 授权文件（§7 风险 10 纪律） |

> 注：命令 #16 全量测试触发了 §7 风险 10 已知现象——覆盖写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 三个历史证据文件；已按需求给定方法（#20）复原，`git status` 复核干净，未污染本迭代产物。
