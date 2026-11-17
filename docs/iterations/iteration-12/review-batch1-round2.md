# I1.12 批次 1 实现评审报告 · Round 2（复核 B1-01 + S-01~S-04）

> 评审角色：实现评审 Agent（批次 1，round 2，干净上下文，只读）。
> 评审对象：批次 1 的 13 产品/测试文件当前工作树 + `iteration-12.md` / `requirement.md` 序号口径补注 + `decisions.md` 裁决 C。
> 唯一可写文件：本报告。全部结论基于本人自跑与实读，不采信 Agent 自述。
> 判据来源：`decisions.md` 裁决 C（签名冻结 + 序号口径 + 文案键）、`requirement.md` v2.1、`iteration-12.md` §2.1（冻结点① :154）、上轮 `review-batch1.md`。

---

## §0 总判

**总判：PASS。阻断 0 / 建议 3。**

- **B1-01 已闭合**：`verifyChain` 恢复冻结签名 `verifyChain({root, instanceId, fs})`（`audit-verify.js:139`），内部走注入 `fs.readFile`（等价 `createStore.readEvents` 只读路径，:140-149），纯核心 `verifyChainCore` 保留（:70-130），返回双口径（seq/firstMismatch/badIndex + count/total/badLines/gaps/historical，:97-129）。本人按冻结签名实跑，GOOD/TAMPER/MISSING/TEXT 全部正常，**不再抛 TypeError**（详见 §3）。
- **序号口径补注到位**：`requirement.md:261`、`iteration-12.md:236` 均补 D-2 限定语，`git diff` 确认仅 When 句/篡改句内加注，**Given/Then 零改**（详见 §3.2）。
- **六维回归无新增退化**：文件边界、只读、签名、AC 强度、测试、门禁全部 PASS；62→63 测试为 B1-01 正向测试增强（`chain-verify.test.js:112`），非弱化；全量 1589 tests / fail 14，差集 0（12 条 win32 基线 + 2 条 flake 留帧）；purity 双目录 exit 0；三条 grep + CJK/skip 零命中；CODES 8 键 / `wake.rejected` / 写路径逐字未改。
- **建议 3**：S-01（文案键 WP-7 加键）、S-02（sha256Of 形态提示）、S-03（AC-04/06 审计落库）均为跨 WP 依赖/契约提示类，非本批次责任，转批次 2。S-04（历史证据恢复）本轮已实跑恢复并复核闭合。
- **门禁实跑**：8 契约 63/63 绿；全量 1589/1566/14 fail/9 skipped（差集 0）；purity 31 词双目录 exit 0；`deps 0`；I1.11 差集零命中。

**实跑命令清单**（详见 §5）：`git status/diff/show` 组、4 条静态 grep、冻结签名 node 复现、8 契约 `node --test`、purity×2、deps、全量 `node --test`、差集比对、历史证据 `checkout-index` 恢复与复核、CODES/wake.rejected/行号核验。

---

## §1 B1-01 + S-01~S-04 三态复核

三态定义：**闭合**=本轮证据显示已落实/已验证；**建议延续**=属跨 WP 依赖或契约提示类、非本批次责任、转批次 2；**阻断**=本轮退化为阻断判据。

### 1.1 B1-01 — 闭合（原阻断项）

| 复核点 | 修前（上轮） | 修后（本轮，行号） | 判定 |
|---|---|---|---|
| 导出签名 | `verifyChain(input)`（旧 :81），按冻结签名调用抛 TypeError | `verifyChain({root, instanceId, fs: injectedFs} = {})`（`audit-verify.js:139`） | 闭合 |
| 内部只读 I/O | 自持 I/O、`toLines` 吃文本/行数组 | 注入 `fs.readFile`（:140-144），ENOENT 视空链（:146-148），零写 | 闭合 |
| 纯核心保留 | parseLines/遍历/失配定位内联 | `parseLines`(:28)/`verifyChainCore`(:70-130) 原口径保留，外层适配冻结签名 | 闭合 |
| 返回双口径 | — | seq/firstMismatch/badIndex + count/total/badLines/gaps/historical（:97-129） | 闭合 |
| 实跑不抛 TypeError | `TypeError` | GOOD ok:true count:3；TAMPER prev→seq2 / content→seq3；MISSING ok:true total:0；TEXT 正常（§3.1） | 闭合 |

> 注：上轮建议修法二选一中的「注入 fs 等价只读读路径」被采纳（`decisions.md` 裁决 C §54 允许），无需主控变更冻结签名，符合「不改冻结点①」。

### 1.2 S-01 — A-1/A-2 文案键 WP-7 加键：**建议延续**（非阻断）

- 实现侧冻结键：`audit-verify.js:23-26` `CHAIN_LABEL_KEYS={ok:'CHAIN_COMPLETE',broken:'CHAIN_BROKEN'}`；`:152-157` `templateOf` 缺键抛 `TypeError`，不回落硬编码中文；`chain-verify.test.js:89-101` 断言缺键抛错。CJK grep 零命中。
- 接线侧现状：`src/cli/labels.js` 仅有 `'wake.rejected'`（:388），**无** `CHAIN_COMPLETE`/`CHAIN_BROKEN`；本批次 1 不改 labels.js 属正确边界（越界反而违反「既有基线零改」）。
- 裁决 C §56 明确「WP-7 必须在 `labels.js` 加键；缺键抛错设计保留」。三态=建议延续，转批次 2。

### 1.3 S-02 — sha256Of 形态提示：**建议延续**（非阻断）

- 新函数 `validateEvidenceFreshness`（`handoff-schema.js:383`）兼容字符串 / `{ok:false}` / `{ok:true,sha256}` 三态；`evidence-stale.test.js:163-175` 断言 `hash_unavailable`。
- 潜在串扰仍在：legacy `validateHandoffEvidence`（`handoff-schema.js:272`）用 `String(digest).toLowerCase()` 只吃字符串；接线层若把 `doc-artifact.sha256Of` 对象形态经同一 `opts` 注入，会把一致指纹误判 `HANDOFF_HASH_MISMATCH`（上轮已实跑复现）。本轮未新增接线说明或该场景契约测试。
- 属「契约提示类」，裁决 C 未将其列为阻断。三态=建议延续，转批次 2 接线说明。

### 1.4 S-03 — AC-04/06 审计落库：**建议延续**（非阻断）

- AC-04：`governance-wake.test.js:97-110` 在纯判定层断言「恰 1 条 `wake.not-whitelisted`」（实现常量 `governance.js:20/:131-132`）；`:183-195` 断言 `wake.rejected` 逐字不动、无 `wake.denied`。
- AC-06：`evidence-stale.test.js:93-101`（caller-side stand-in）、`:127-160` 断言「每次拒绝恰 1 次升级」，为纯判定 + 桩验证。
- 落库由 WP-7 `escalation.js`（§2.7）承担；本批次不越界实现写路径（写路径 grep 零命中）。三态=建议延续，检查点 3 确认。

### 1.5 S-04 — 历史证据恢复：**闭合**

- 上轮 §7 风险 10 现象本轮复现：全量 `node --test` 覆盖写 `docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json`。
- 已用 `git -c core.autocrlf=false checkout-index -f -- <3 文件>` 恢复，`git status` 复核零污染，工作树回到授权范围（§2）。三态=闭合。

---

## §2 六维回归扫描

| 维度 | 结果 | 证据 |
|---|---|---|
| ① 文件边界 | PASS | 13 产品/测试文件（2 改 src + 3 新 src + test/wp15 8 测试）与上轮一致；本轮文档 diff 仅裁决 C 补注；恢复历史证据后 `git status` 无越界文件 |
| ② 只读 | PASS | `grep -REn "writeFile\|appendFile\|unlink\|saveState\|transit\("` 三模块零命中；`Date.now` 零命中；verifyChain 仅注入 fs.readFile（:144） |
| ③ 签名 | PASS | 冻结签名实跑 arity 0、无 TypeError（§3.1）；其余 8 导出与上轮逐字一致 |
| ④ AC 强度 | PASS | 62→63 测试，新增 `chain-verify.test.js:112` 正向测试；`skip/todo/assert.ok(true)/equal(true,true)` 零命中；Then 零改 |
| ⑤ 测试 | PASS | 8 契约 63/63；全量 1589/1566/14 fail/9 skipped，差集 0 |
| ⑥ 门禁 | PASS | purity 31 词双目录 exit 0（34+31 文件）；CJK 零命中；`deps 0`；I1.11 特征 grep 零命中（命中均在断言正则内） |

**既有基线零改复核**：`CODES` 8 键（`handoff-schema.js:17-25`，含 `HANDOFF_HASH_MISMATCH`）逐字未改；`labels.js:388` `wake.rejected:'唤醒被拒'` 逐字未改；`event-bus.js` 写路径段（:38-181）零改（`git diff` 仅 `@@ -9,8 +9,31 @@`，:12-36）；`handoff-schema.js` 授权段仅 `@@ -302,7 +302,149 @@` + `@@ -310,5 +452,7 @@`。

**全量失败差集**（14 条逐条比对，差集 0）：
- 12 条命中 `docs/iterations/iteration-10a/baseline-failures-win32.txt` 登记项：`--host-error`、`resolveEvidenceRef 纯路径判定`、`可注入 fs：stat 结果`、`desktop port loopback (lsof)`、`AC-27`、`newState health/traceId`、`execution.summary`、`--fail-tool`、`--stop-after 3`、`grep -c object:session ≤13`、`三主链输出`、`S-07 role files`。
- 2 条 flake 留帧 `docs/iterations/iteration-10b/evidence/flake-frames/`：`HANDOFF_EVIDENCE_ESCAPE 符号链接绕过`、`AC-04 空态/2秒 timing`。

---

## §3 冻结签名实跑表 + 序号口径限定语核验

### 3.1 冻结签名实跑（命令见 §5 #5）

| 场景 | 调用 | 输出 | 判定 |
|---|---|---|---|
| 正常链 | `verifyChain({root:'/x',instanceId:'I-1',fs:mkFs(good)})` | `{"ok":true,"count":3,"total":3}` | 无 TypeError |
| 直改第2条 prev 字段 | 同上，bad2.prev=ZERO | `{"ok":false,"code":"CHAIN_BROKEN","seq":2,"firstMismatch":2}` | 双口径=2 |
| 改第2条内容 to→frozen | 同上，bad2.to='frozen' | `{"ok":false,"code":"CHAIN_BROKEN","seq":3,"firstMismatch":3}` | 双口径=3 |
| 缺失日志（ENOENT） | fs.readFile 抛 ENOENT | `{"ok":true,"total":0}` | 空链不抛 |
| 文案渲染 | `verifyChainText(result, labels)` | `链完整，共 3 条` / `第 2 条失配` | 正常 |
| 键名常量 | `CHAIN_LABEL_KEYS` | `{"ok":"CHAIN_COMPLETE","broken":"CHAIN_BROKEN"}` | 冻结一致 |
| 签名 arity | `verifyChain.length` | `0`（解构默认参数 `={}`，冻结签名形态） | 无 TypeError |

**结论**：修前 `verifyChain(input)`（旧 :81）按冻结签名调用直接 `TypeError`；修后 `verifyChain({root,instanceId,fs})`（:139）全部路径正常，B1-01 闭合。

### 3.2 序号口径限定语核验（D-2）

| 文件/行 | 补注内容 | Given/Then 是否改动 |
|---|---|---|
| `requirement.md:261`（AC-01 When 句） | 补「此处按 D-2 口径：直改第 2 条 `prev_event_hash` 字段得 `seq:2`；若改动第 2 条其它内容使其指纹变化，则首个失配出现在第 3 条的 `prev` 校验，见 D-2」 | `git diff` 仅该 When 行 1 增 1 删；Given(:260)/Then(:262) 不在 diff 中 → **零改** |
| `iteration-12.md:236`（异常态篡改句） | 补同类限定语「`seq:2` 指直接改动第 2 条 `prev_event_hash` 字段；若改动第 2 条其它内容……首个失配出现在第 3 条」 | `git diff` 仅该篡改行 1 增 1 删；D-2 算法与其余样例零改 |

两处均为补注（非改判据），与裁决 C §55/§58「示例歧义补一句限定语、不改 D-2 算法」一致。

---

## §4 修复清单 B1R-01…

**无阻断项。** 本轮无 B1R 阻断清单。

保留建议（转批次 2）：
- S-01：`src/cli/labels.js` 为 `CHAIN_COMPLETE`/`CHAIN_BROKEN` 加键（WP-7 责任，`wake.rejected` 逐字不动）。
- S-02：接线说明明确 legacy `validateHandoffEvidence`（`handoff-schema.js:272`）只吃字符串型 hash，勿注入对象形态 `sha256Of`。
- S-03：检查点 3 补齐 AC-04「恰 1 条审计事件」/ AC-06「升级恰 1 次」的真实落库断言（WP-7 `escalation.js`）。

---

## §5 实跑命令与输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `git status --short` / `--porcelain` | 授权范围内：3 文档改（裁决 C 补注）+ `event-bus.js`/`handoff-schema.js` 改 + 3 新 src（audit-verify/budget/governance）+ `test/wp15/` 8 测试 + 上轮报告；历史证据恢复后无越界 |
| 2 | `git diff --stat` | `iteration-12.md +1/-1`、`decisions.md +18`、`requirement.md +1/-1`、`event-bus.js +25/-1`、`handoff-schema.js +146/-2` |
| 3 | `git diff -- requirement.md` / `-- iteration-12.md` | 各仅 1 hunk（:261 / :236），纯补注，Given/Then 零改 |
| 4 | `git diff -- event-bus.js` / `-- handoff-schema.js` | hunk 头与上轮一致：`@@ -9,8 +9,31 @@`、`@@ -302,7 +302,149 @@`、`@@ -310,5 +452,7 @@`；CODES 8 键零改 |
| 5 | `node --input-type=module <<'EOF' … verifyChain({root,instanceId,fs}) … EOF` | GOOD ok:true count:3；TAMPER-prev seq:2；TAMPER-content seq:3；MISSING ok:true total:0；TEXT 正常；`arity=0`；**无 TypeError** |
| 6 | `NODE_ENV=test node --test`（8 契约文件） | `# tests 63 / pass 63 / fail 0 / skipped 0 / todo 0` |
| 7 | 每文件测试数 `grep -cE "^test\("` | boundary 5 / budget 9 / chain-compat 4 / chain-verify 7 / evidence-stale 9 / granularity 8 / review 11 / wake 10 = 63 |
| 8 | `grep -REn "writeFile\|appendFile\|unlink\|saveState\|transit\("` 三模块 | 零命中 |
| 9 | `grep -REn "Date\.now"` 三模块 | 零命中 |
| 10 | `grep -RPn "[\x{4e00}-\x{9fff}]"` 三模块 | 零命中 |
| 11 | `grep -REn "test\.skip\|test\.todo\|assert\.ok(true)\|equal(true,true)" test/wp15/` | 零命中 |
| 12 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>` | `OK 扫描 34 文件 零命中 exit 0` |
| 13 | `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31词>` | `OK 扫描 31 文件 零命中 exit 0` |
| 14 | `node -e "Object.keys(require('./package.json').dependencies\|\|{}).length"` | `deps 0` |
| 15 | 全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` | `tests 1589 / pass 1566 / fail 14 / skipped 9`；14 条逐条比对：12 条 win32 基线 + 2 条 flake 留帧 → **差集 0** |
| 16 | I1.11 特征 `grep -iE "i1[._-]11\|notify\|interven\|evidence-view\|canvas\|tray"` 产品+测试 | 命中均在 `boundary-i111.test.js` 断言正则/注释内，产品代码零命中 |
| 17 | `grep -n "CHAIN_COMPLETE\|CHAIN_BROKEN" src/cli/labels.js` | 无命中（仅 `wake.rejected` :388）→ S-01 建议延续 |
| 18 | `grep -n "String(digest)" src/core/handoff-schema.js` | `:272` 仍在 → S-02 契约提示延续 |
| 19 | `grep -n "EVIDENCE_STALE\|validateEvidenceFreshness" src/core/handoff-schema.js` | `:314` / `:383`；CODES 8 键逐字未改 |
| 20 | `git -c core.autocrlf=false checkout-index -f -- <3 个 nfr-perf 证据>` + `git status --porcelain \| grep iteration-4` | 历史证据复原，零污染（S-04 闭合） |

---

## 移交批次 2 注意事项（2 条）

1. **文案键落点**：WP-7 接线必须在 `src/cli/labels.js` 为 `CHAIN_COMPLETE`/`CHAIN_BROKEN` 加中文键（冻结点①授权 WP-1 冻结键名，缺键 `verifyChainText` 抛错且不回落硬编码中文）；同时逐字保留 `wake.rejected:'唤醒被拒'`（:388），新拒绝码只用 `wake.not-whitelisted`，不得引入 `wake.denied`。
2. **审计落库与 hash 形态**：检查点 3 需补齐 AC-04「恰 1 条新码审计事件」/ AC-06「升级恰 1 次」在 `escalation.js` 的真实落库断言（当前仅纯判定 + caller 桩）；接线时勿把 `doc-artifact.sha256Of` 对象形态经 `opts` 注入 legacy `validateHandoffEvidence`（`handoff-schema.js:272` 只吃字符串），否则会把一致指纹误判 `HANDOFF_HASH_MISMATCH`。
