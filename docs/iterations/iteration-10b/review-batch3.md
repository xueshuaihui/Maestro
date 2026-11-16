# I1.10b 实现评审 · 批次 3（WP-4 / WP-5 + 裁决 J 修复）

> 评审对象：WP-4 `desktop/ui/app.js` + 7 测试；WP-5 `test/wp14/host-jump.test.js` + `probe/acc10b-jump-verify.mjs`；J 修复 `desktop/ui/drill/host-jump.js` + `src/daemon/http/server.js`。
> 上下文：干净只读评审；分支 `feat/i1.10b-drilldown`，HEAD `ab4f010`，WP-4/WP-5/J 修复均未提交。唯一可写文件为本报告。
> 判据来源：`iteration-10b.md` §2.5/§4/检查点 3、`requirement.md` v6、`decisions.md`（裁决 J/H/A/I）、`review-batch1-round2.md` §6、`review-batch2.md` §5。

---

## ① 总判

**PASS（阻断 0 / 建议 4）。**

WP-4 8 文件、WP-5 2 文件、J 修复 2 文件全部落在授权边界内，无其它产品代码改动；契约 A3/A5/A4、七测试覆盖、裁决 J-1/J-2 闭合、AC-25/33/28/49 关键断言、门禁与回归均通过。四条建议均为文档自洽 / 留证 / 真实面取证补强，不改任何 AC 判定强度。

---

## ② 七维逐维一行

| 维度 | 结论 | 证据（行号 / 实跑输出） |
|---|---|---|
| **A 文件边界** | **PASS** | `git diff --numstat` 产品代码仅 `app.js`(+427/-4)、`host-jump.js`(+4/-1)、`server.js`(+6)；新增 8 测试 + probe 均在 D-9 名单；额外改动仅 `decisions.md`(+16，裁决 J 记录，非产品代码)、iteration-4 evidence 3 份（逐字节 hash 与 HEAD 一致，仅 CRLF 显示 M）、`.workbuddy/memory`（非产物） |
| **B 契约 A3/A5/A4** | **PASS** | `backToGraph()` `app.js:558-570` 只清 drill 字段、保留 viewState 五组，无 `backToList`/`createViewState`；`ensureStreams` `app.js:1878` `view==='graph'||'drill'` + `graphStreamId` 去重，全文件仅 1 处 `/graph/stream`；`continueEscalation` `app.js:343`；`createViewState(` 恰好 2 处 `app.js:496/695`；原始码 `ESCALATION_NOT_PENDING\|INSTANCE_NOT_SUSPENDED` 在 `desktop/ui/` 零命中 |
| **C 七测试覆盖** | **PASS** | 8 文件 40/40 全绿（`# tests 40 / pass 40 / fail 0 / skipped 0 / todo 0`）；逐文件核：`drill-entry` A-1 第 7 行逐字+`view==='drill'`(:84/95)+时钟≤1000ms(:107)+state.json 哈希(:109)、AC-02 五组(:142-159)；`drill-live` AC-27/47/48/50(:67-199)；`drill-readonly` AC-28 内部指标 40/30/1(:94-116)；`special-node-jump` AC-49 `view==='escalation-panel'` 且 `!=='drill'`(:137-138)；弱点扫描（skip/todo/ok(true)）零命中 |
| **D 裁决 J 闭合** | **PASS** | J-1：`host-jump.js:36` `text.slice(sep+3)` 修法通用产生 `button.label` 含 id，测试 `host-jump.test.js:123-124` 断言 label 逐字含 `expected.id`（非测试注入），toast 逐字不变(:115)；J-2：`server.js:496` stateLabel=`ESCALATION_LABEL.resolved`、`app.js:372` 用 `result.stateLabel` 填模板，界面提示逐字 `升级 ESC-001 已处理 · 状态 已处理`(`escalation-continue.test.js:110/152`)；`app.js`+测试 `ESCALATION_LABEL_RESOLVED` 零命中；63 键与 210 键计数(`labels-desktop.test.js:505`)不变量保持 |
| **E WP-5 与真实面** | **PASS** | `expectedFrom` 用 `maxBy(lastChangedAt)` 派生(`host-jump.test.js:62-65`)、same-source(:112/119)、无目录同名断言(:130)；三态翻转(:133-178)；AC-33 `autoSpawn=0/jumpCalls=1/toastPairs=1`(:232/252/253)；probe 无写盘/起进程（`grep writeFile\|spawn(` 零命中，`execFile` 仅 `tasklist.exe` 只读）；C1 自跑 `--check session-dir` = `total 8, compared 8, dirEqualsInternalIdCount 8, c1 一致`，与 `decisions.md` 裁决 J-3 一致；DSH 已安装（`DeepSeek Harness.exe` 存在），非阻塞 |
| **F 门禁** | **PASS** | 七+跳转 40/40、fixtures+labels 43/43；purity 双目录 `exit 0`（31 词零命中）；CJK 零命中、零依赖 0、`UI_LABEL_KEYS=210`；全量 `tests 1508 ≥ 1425`；唯一表面新红 `实例创建即有 state.traceId…` 独占复跑 2/2 PASS（flake） |
| **G 回归** | **PASS** | 探针函数体 `buildGraphShownProbe`/`buildClosedProbe` 与 HEAD 逐字节一致（`diff exit 0`，仅新增文档注释）；干净 HEAD(17 fail) vs 当前(15 fail) 差集 = 既有 CRLF/时序红；`clean−cur` 仅 `{developer.yaml, SKILL.md, legacy sha256}` 3 条 CRLF flake 翻绿；新红经 flake 确认后差集 = 0；iteration-4 evidence 3 份 SHA256 与 HEAD 完全相同、历史证据未被覆盖 |

---

## ③ 四重点独立结论

1. **真实 HTTP 双 continue（message / stateLabel 分离）——PASS。** `server.js:496` stateLabel 仅在 `code==='ESCALATION_NOT_PENDING'` 分支以条件展开加入，`server.js:497` `message: escalationErrorText(code, result?.params ?? {})` 独立计算、不读 stateLabel；`escalationErrorText`(`server.js:75-102`) 仍从 `COMMAND_ERROR` 原文模板填充。真 HTTP 夹具 `drill-fixtures.test.js:591-615` 连发两次、第二次 409 + `message` 逐字等于 COMMAND_ERROR 原文（运行 43/43 绿）。stateLabel 在 daemon 仅此一处响应字段、在 UI 仅 `app.js:372` 消费，未污染 `message`。

2. **app.js 只按 messageKey 分支、无硬编码中文——PASS。** `app.js:356/362/376/382` 仅以 `result.ok` / `result.messageKey`('DRILL_ESC_ALREADY'/'DRILL_ESC_NOT_SUSPENDED') 选文案分支，原始码零命中；CJK 扫描 `desktop/ui`、`desktop/harness` 零命中；`app.js` 内 CJK 计数 0。

3. **probe 只读性与 C1 结论——PASS。** `probe/acc10b-jump-verify.mjs` 无 `writeFile/appendFile/mkdir/rm/unlink/spawn`（`grep` 零命中），仅 `execFile('tasklist.exe')` 只读查进程 + zstd 内存解压读会话记录，CLI 入口 `if (…import.meta.url…)` 守卫。自跑 `--check session-dir` 得 `total 8 / compared 8 / dirEqualsInternalIdCount 8 / c1 一致`，与裁决 J-3 记录一致；`--check process` 得 `processCount 0, readOnly true`（未点击，符合只读语义）。

4. **sessionTag 修法通用性——PASS。** `host-jump.js:30-37`：`at=text.indexOf('{id}')`、`sep=text.lastIndexOf(' · ', at)`，修法 `part = sep===-1 ? text.slice(0) : text.slice(sep+3)` 把 `{id}` 占位符保留在切片内再交 `fillTemplate(part,{id})` 替换，不含任何夹具 id 字面量；`sep===-1` 分支取全文亦保留占位符。`button.label` 由模块自身产生（测试 `host-jump.test.js:124` 按 `DRILL_HOST_OPEN + 会话 + expected.id` 校验），非测试注入，属通用修法而非夹具特化。

---

## ④ B3 阻断标题行

**无。**（无越界改动、无契约 A3/A5/A4 违背、无 AC Then/机检放宽、裁决 J-1/J-2 实质闭合、无测试弱化、无门禁真红、无回归退化、C1 实测与自跑一致。）

---

## 建议清单（文风一律建议）

- **S-B3-01（C1 附录补注未落地文档）**：裁决 J-3 要求「按裁决 I 在附录 D-14 表 C1 补注『已实测一致』」，但 `requirement.md:1680` 的 C1 表项仍为「尚未实测」。实测结论权威记录已在 `decisions.md` 裁决 J-3（8/8 一致）。因 `requirement.md` 不在 B3 写入边界，实现方未改是正确的；建议主控在批次 4 收口时把附录 D-14 表 C1 行同步为「已实测一致（见 decisions.md 裁决 J-3）」，保持文档自洽，不改 AC 强度。
- **S-B3-02（AC-25/33 真实面取证）**：本批次 AC-25/33 为模块面断言 + 只读 probe（`host-jump.test.js:4` 明示不启动真实进程、`autoSpawn===0`），未见「点击 → 进程 0→1 / 连点单进程」的真实面原始帧。DSH 已安装（`DeepSeek Harness.exe` 存在，故非「不可用→阻塞」情形）。建议在检查点 3/4 验收记录中补一次 `--check process` 点击前后计数（0→≥1 / =1）取证，或按裁决 B 明确登记为人工核验项，勿以夹具顶替。
- **S-B3-03（flake 留帧缺失）**：全量唯一表面新红 `实例创建即有 state.traceId…`（`test/wp9/i19-orchestrator.test.js`）独占复跑 2/2 PASS，属并发/时序 flake；连同 `review-batch2.md` S-B2-02 移交的 AC-04 时序、symlink EPERM 两条，均需按裁决 G 补「文件级隔离复跑」原始帧。`docs/iterations/iteration-10b/flake-frames/` 目录当前尚不存在，建议批次 4 建档留帧，使严格字面差集归零（禁用 `--no-flake-confirm` 一类开关）。
- **S-B3-04（ESCALATION_LABEL_RESOLVED 残留引用）**：J-2 闭合后 `app.js` 与 `escalation-continue.test.js` 均已零命中，但 `desktop/ui/drill/escalation-panel.js:16` 仍有 `resolved: 'ESCALATION_LABEL_RESOLVED'`（STATE_WORD_KEY 的优雅回退：查不到键则落占位符 `—`）。该行为 WP-3 批次 2 既有代码、不在 B3 的 J 修复范围（J 修复仅 host-jump.js + server.js），亦非 app.js 的 noticeText 硬依赖。若主控意图为「全代码库零命中」，建议批次 4 一并复核该回退分支的状态词取值，避免升级面板已处理行显示占位符。

---

## ⑤ 移交批次 4 注意事项（2 条）

1. **文档自洽 + 真实面取证收口**：落实 S-B3-01（把 `requirement.md:1680` D-14 表 C1 补注为「已实测一致」，引用 `decisions.md` 裁决 J-3）与 S-B3-02（补 `--check process` 点击前后 0→1 原始帧，或登记人工核验）；二者均不改 AC 强度、不动需求 AC/BR/Then、不增删文案键。

2. **回归差集与 flake 留帧纪律**：批次 4 跑全量时，除 16 条 win32 登记项外，本批新观测到 `实例创建即有 state.traceId…`（独占复跑 2/2 PASS）需按 S-B3-03 在 `flake-frames/` 建档留帧；`AC-04 时序` 与 `HANDOFF_EVIDENCE_ESCAPE symlink` 两条承 S-B2-02 同样补帧。严格按裁决 G 三段式（tests≥1425 + 差集 0 + 隔离复跑），勿因单次红数（15/17）或 flake 成员翻转放宽断言；iteration-4 evidence 的 CRLF 显示 M 与 memory 非产物改动本批未新增，收口时确认来源即可，不计入回归。
