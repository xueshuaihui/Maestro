# I1.10b 终验（S4）— §3.6 最终结果校验

> 终验 Agent：独立子 Agent（不兼 S2 实现 / S3 验收）。仓库根 `D:/WWW/Maestro`，分支 `feat/i1.10b-drilldown`，被验 HEAD `818576f`（S3 验收产物未提交）。
> 判据：`docs/templates/execution-template.md` §3.6 / §4.5；`requirement.md` **v6.1**（51 AC / 43 BR / 7 NF）、`decisions.md` 裁决 A~L；`probe/acc10b-f-results.jsonl` + 五份 summary + `blockers.md` + `acceptance-{a,b,c,d,e}.md` + `evidence/**`。
> Method：本 Agent 全部**自己实跑核**，不采信任何 Agent 自述；每条结论带命令输出或文件行号。

---

## 0. 总判

**FAIL（六项校验：5 PASS / 1 FAIL）**

| # | 校验项 | 结论 | 一句话依据 |
|---|---|---|---|
| 1 | 结果完整性 | **PASS** | results.jsonl 末条 51 unique = 1..51，通过 51 / 不通过 0 / 阻塞 0；需求 51 AC 定义 / 51 Then 齐全 |
| 2 | 证据支撑性 | **PASS** | 抽查 12/12 条（指定集全覆盖）证据非空、有原始帧、Then 逐字值在帧内；全量 425 引用 0 缺失 0 空文件 |
| 3 | 判定未被放宽 | **PASS** | 四个复判 AC（34/37/46/51）+ 两个人工核验 AC（25/33）断言期望与需求逐字一致、分级正确 |
| 4 | 门禁与回归 | **PASS** | 实跑 1526/1500/17/9，tests≥1425，差集 0（15 允许集 + 2 隔离确认 flake）；purity 双目录 31 词 exit 0；deps 0；三主链 8/8 |
| 5 | 缺陷与遗留 | **PASS** | blockers 四项（C-1.1/1.2/D-1.1/1.2）均有裁决处置结论；人工核验项单列；无未完成 AC 混入遗留 |
| 6 | 提交范围 | **FAIL** | 两个历史功能 commit 卷入验收产物：`18438d6` 含 `probe/acc10b-jump-verify.mjs`，`818576f` 含 3 份 `evidence/flake-frames/`。精确整改位置见 §6 |

> **判定说明**：第 6 项是提交卫生问题（历史功能 commit 混入 `evidence/**`、`probe/**`，违反 §3.6 第 6 项与 §7 红线 3），按「不许为了 PASS 放宽判据」如实判 FAIL 并给出精确修改位置。它**不影响任何 AC 判定、门禁数字或证据有效性**；AC 判定与门禁均 PASS。主控按 §6 分组整改后可整迭代收口。

---

## 1. 校验一 · 结果完整性（PASS）

**方法**：脚本读 `probe/acc10b-f-results.jsonl`，同 AC 取最后一条；用正则从 `requirement.md` 提 `**AC-NN ·` 定义与 `**Then**`；核对集合与计数。

```
results 总行数 57 / unique AC 51 / 多记录 AC 6（34/37/46/51/25/33 复判取末条）
末条判定分布：{"通过":51,"不通过":0,"阻塞":0}
AC 号集合 min=1 max=51，missing 1..51 = 无，越界 = 无
需求正文 AC 定义 51 个（unique 51，无重复），Then 计数 51，BR 43 / NF 7
核对项 total=766 / ok=766（a 209 + b 231 + c 187 + d 107 + e 32）
```

| 数据点 | 值 | 一致性 |
|---|---|---|
| results.jsonl 末条 AC 数 | 51 | = summary.json `acTotal`=51 |
| 通过 / 不通过 / 阻塞 | 51 / 0 / 0 | = requirement 51 AC 全通过 |
| 需求 §1.3 范围 / WP 交付项 | 51 AC 均有结论 | 五批 a/b/c/d/e 全覆盖（15+14+14+6+2=51） |
| 核对项 | 766 / 766 | = summary.json `checksTotal`=766 |

**结论**：summary.json 覆盖全部 51 AC，通过=51、不通过=0、阻塞=0；需求范围内条目与 WP 交付项 100% 有结论。**PASS**。

---

## 2. 校验二 · 证据支撑性（PASS）

**方法 A（指定 12 条逐字核）**：对 `AC-01/02/08/22/23/25/29/33/34/37/46/51`，从 results.jsonl 每条 check 提取「期望含 "..."」字面量，在对应 `evidence/AC-NN.*`（含 AC-25/33 共用 `AC-25-33.*`）全帧中字符串命中：

| AC | Then 字面量数 | 命中 | AC | Then 字面量数 | 命中 |
|---|---|---|---|---|---|
| AC-01 | 14 | 14 | AC-29 | 23 | 23 |
| AC-02 | 11 | 11 | AC-33 | 0（C 类进程面，见下） | — |
| AC-08 | 5 | 5 | AC-34 | 3 | 3 |
| AC-22 | 7 | 7 | AC-37 | 10 | 10 |
| AC-23 | 12 | 12 | AC-46 | 10 | 8+2* |
| AC-25 | 0（C 类进程面，见下） | — | AC-51 | 8 | 8 |

\* AC-46 两条未命中为**产品源码期望**（`src/adapter/host-open.js:63` 的 `` `跳转失败 · ${cause}` `` 与 `:60` 的 `err?.code === 'ENOENT'`），不在 evidence 帧而在产品源码——已实读确认逐字存在（见 §3）。
AC-25/33 的判定由**真实进程帧**（`AC-25.live-*.process.json`：PID 11508；`AC-33.stay10s.jsonl`）承载，非 Then 字面量机检，故该脚本口径为 0，证据另见 §3。

**方法 B（全量完整性）**：遍历 results.jsonl 全部 425 条 evidence 引用（423 unique）：

```
AC 数 51 / evidence refs 425 / unique 423
missing files 0 / empty files 0 / AC below 4 nonempty files 0
物理 AC 前缀证据文件 415 + 共用帧 2 + 归档目录 3 + flake-frames 子目录
```

**代表原始帧抽样**：
- `AC-01.tests.stdout.txt`：TAP `# tests 6 / # pass 6 / # fail 0`，含 A-1 第 7 行逐字断言；`AC-01.state.json` 记 `NODE_ENV=test`、`host=mock`、`root=%TEMP%` 独立根。
- `AC-25.live-t0ms.process.json` / `AC-25.live-log.json`：真实 `openHost()` 触发返回 `ok=true, host=dsh`，进程 PID 11508；`AC-33.stay10s.jsonl` 11 点进程全 0（autoSpawn）。
- `AC-34.fullrun.tap.txt`：331978 字节全量 TAP，`1..1524 / #fail 15`；`AC-34.diffset.txt` 差集成员逐条登记。

**结论**：抽查 12 条证据真实支撑判定（非空、有原始帧、Then 逐字在帧或产品源码），全量无空文件/缺文件。**PASS**。

---

## 3. 校验三 · 判定未被放宽（PASS）

**方法**：对四个曾复判 AC 与两个人工核验 AC，实读原始帧 + 产品源码，确认断言期望与需求 Then 逐字一致，未放宽。

### 3.1 AC-34（裁决 K 基线帧）— 复判通过成立
- `evidence/flake-frames/baseline-HEAD-handoff-schema-20261117-013949.log`（干净 HEAD `18438d6`）：`not ok 12 - HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`，`#tests 37 / #pass 34 / #fail 3`。
- `baseline-HEAD-instance-list-20261117-013949.log`：`not ok 2 - AC-04：空态…F-18 脉冲后 2 秒内更新`（期望 `running` 实得 `completed`），`#tests 2 / #fail 1`。
- 两条在干净 HEAD 同样红 ⇒ 属 S0 既有红，非本迭代新增红；`tests 1524 ≥ 1425`、`observedFail 15 ∖ allowed 18 = 0` 成立。未改任何断言 / Then。

### 3.2 AC-37（stateSince 5 字段）— 补齐后复判通过成立
- `evidence/AC-37.test.source.txt:87` 夹具与 `:114` `assert.deepEqual` 均为 5 字段对象，含逐字 `stateSince: '2026-11-15T10:04:00.000Z'`。需求 `requirement.md:843` 机检原文被逐字承载，未放宽。

### 3.3 AC-46（真实失败映射）— 复验通过成立
- `src/adapter/host-open.js:60` `if (err?.code === 'ENOENT')` → `:61` `未找到 DeepSeek Harness`；`:63` `` message: `跳转失败 · ${cause}` ``。
- `test/wp14/host-jump.test.js:293-328` 真实形状用例：`code:'DSH_SPAWN_FAILED'` + `message:'跳转失败 · 权限被拒'` → toast 逐字 `跳转失败 · 权限被拒`、`jumpCalls===0`。AC-26 三降级未退化。

### 3.4 AC-51（裁决 L 语义代理）— 复判通过成立
- `test/wp14/connection-panel.test.js:188` `assert.ok(st.view === 'connection-panel')`、`:189` `assert.ok(st.view !== 'escalation-panel')`、`:190` `assert.ok(st.view !== 'drill')`、`:200` `assert.ok(stateHashBefore === stateHashAfter)`。
- 裁决 L 仅把验收机检代理改为接受语义等价 `assert.ok(x !== y)`，**未删核对项、未放宽 Then**；即 `assert.notEqual` 字面代理过严的修正，不是降低判定强度。

### 3.5 AC-25 / AC-33（人工核验分级）
- `acceptance-e.md:13-14` / `:45-50` / `:85-89`：窗口唤到前台、剪贴板实际内容、窗口内提示可见性 → 证据分级 `人工核验`，**单列、不计入自动通过数、不计阻塞**（裁决 B）。
- results.jsonl `face` 字段 = `真实宿主实测（进程）+ mock 实测（机检），C 类；人工核验项单列`，`verdict=通过` 仅覆盖自动面 18/18 与 14/14。分级正确，未把人工项计为自动通过。

**结论**：四个复判 AC 与两个人工核验 AC 判定未被放宽。**PASS**。

---

## 4. 校验四 · 门禁与回归（PASS）

### 4.1 全量测试（实跑）
先按任务字面跑裸命令 `node --test "test/**/*.test.js"`：**卡死在 1354 条**（日志 14 分钟不推进、无汇总），与 `requirement.md:1032` 记载「裸跑不带头 timeout 会在约 157 条处挂起 >7 分钟」同类现象一致，故终止并改用需求唯一取数口径：

```
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"
# tests 1526 / # pass 1500 / # fail 17 / # skipped 9 / # todo 0 / duration 299228ms / EXIT=1
```
验收期全量帧 `evidence/AC-34.fullrun.tap.txt` = `1..1524 / 1500 / 15 / 9`；两次均 `tests ≥ 1425`。

**17 条失败集合归类**（差集口径：裁决 G + K）：

| 类别 | 条数 | 明细 |
|---|---|---|
| win32 16 条登记项内 | 13 | promptFailures / --host-error / resolveEvidenceRef / 可注入 fs / S-07 / lsof loopback / AC-27 / newState / execution.summary / --fail-tool / --stop-after / object:'session' / 三主链不出现健康度 |
| S0 基线既有红（有 baseline-HEAD 帧，裁决 K） | 2 | HANDOFF_EVIDENCE_ESCAPE、AC-04 |
| 负载型 flake（隔离复跑通过，见 4.4） | 2 | live 取消（EBUSY 清理）、三主链无新增可见词（AC-03） |

**差集 = 17 ∖ (13+2+2) = 0**；`tests 1526 ≥ 1425` ⇒ 门禁通过。

### 4.2 purity 双目录 31 词（exit 0）
```
FORBID = task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,
 developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,
 fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,
 research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,
 test-run,code-review,coordination,compliance-check   （=31 词）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"
  → OK: 扫描 31 个文件 … 零命中，exit=0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid "$FORBID"
  → OK: 扫描 31 个文件 … 零命中，exit=0
```

### 4.3 零依赖
```
node -e "console.log(Object.keys(require('./package.json').dependencies||{}).length)"  → 0
```
`test/wp14/regression-drill.test.js:4` AC-30 `dependencies === {}` 通过。

### 4.4 三条主链冒烟（隔离复跑 8/8）
`test/wp14/regression-drill.test.js` 内 `single / code-loop / task-loop` 基线：`# tests 8 / # pass 8 / # fail 0 / exit 0`。含 USAGE_LINES 25、instance status/graph 两种格式逐字、dependencies 空、31 词双目录、允许集合结构、judgeRun 语义、新红复核语义。
（并发负载下该测试 #2 偶发漂移，独占 `--test-concurrency=1` 复跑 8/8 全绿，证明为负载型 flake，非回归。）

### 4.5 历史证据恢复（不得覆盖写）
全量测试运行会改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`。跑完后按指定命令恢复：

```
git -c core.autocrlf=false checkout-index -f -- \
  docs/iterations/iteration-4/evidence/nfr-perf-atomic.json \
  docs/iterations/iteration-4/evidence/nfr-perf-batch.json \
  docs/iterations/iteration-4/evidence/nfr-perf-render.json
```
校验：三文件 `git hash-object` 与 `HEAD:<path>` blob 逐一相等（`31868c38…` / `9ded321b…` / `9480c477…`），`git -c core.autocrlf=false diff --exit-code` 返回 0。残留 `git status` 的 `M` 仅是 CRLF 显示差异（内容逐字节等于 HEAD），与 `progress.md:61` 记载一致，历史证据内容未被改写。

**结论**：门禁全绿（差集 0、tests≥1425、purity 双目录、零依赖、三主链、历史证据已恢复）。**PASS**。

---

## 5. 校验五 · 缺陷与遗留（PASS）

**方法**：实读 `probe/acc10b-f-blockers.md` 全部四段台账 + 五份 acceptance 的遗留项，确认每项有处置结论、无未完成 AC 混入遗留。

| 台账项 | 现象 | 处置结论 | 记录 |
|---|---|---|---|
| C-1.1 AC-34 | 原判差集 2（不通过） | 裁决 K 补两类原始帧（干净 HEAD + 隔离复跑），复判**通过** 14/14 | blockers.md:46-65 |
| C-1.2 AC-37 | 原判 lastAction 缺 stateSince（不通过） | 裁决 J F4-05 三处夹具补 5 字段，复验**通过** 17/17 | blockers.md:67-75 |
| D-1.1 AC-51 | 历史 17/18（不通过） | 裁决 L 改机检代理为语义等价，复判**通过** 18/18 | blockers.md:101-113 |
| D-1.2 AC-46 | 真实失败映射口径风险 | 实现修复区分 ENOENT / 非 ENOENT，复验维持**通过** 17/17 | blockers.md:115-118 |

脚手架自身修订（ac01 字面量 / ac04 字面量 / grepCheck 多目标）均登记为「非产品缺陷、不放宽断言」，重跑全绿（blockers.md §3）。

**遗留项核对**：`acceptance-{a,e}.md` 的「非阻塞观察项」仅含真实进程短命（ACP detached，如实留帧）、C1 目录同名 8/8（裁决 I/J-3 仅作事实补注不回填判据）、人工核验面（窗口前置 / 剪贴板 / toast 可见性）——均为不影响结论的观察项，**不含未完成 AC**。批次 e §6 给出人工核验建议（需 Tauri 窗口环境），属报告建议、非结项阻塞。

**结论**：缺陷台账每项有裁决处置、遗留项不影响结论且不含未完成 AC、人工核验项单列。**PASS**。

---

## 6. 校验六 · 提交范围（FAIL）

**方法**：`git log` + `git show --name-status` 逐个核 I1.10b 的 4 个功能 commit 是否卷入 `evidence/**`、`probe/**`；核当前工作树可分组性；核报告数字与 results.jsonl 一致。

### 6.1 当前工作树可分组性 — 满足
工作树现有 S2 修复（裁决 J/K/L 引起的 app.js / host-jump.js / 3 个 test 文件）、S3 验收产物（acceptance-*.md、evidence/**、probe/acc10b-*、results/summary/blockers）、S4 文档（本终验三件），可按 §6.4 清单分组提交。

### 6.2 功能 commit 卷入验收产物 — **违规（FAIL 根因）**

| 功能 commit | 卷入的验收产物 | 违反 |
|---|---|---|
| `18438d6` feat(I1.10b) 批次3 WP-4/WP-5 | `probe/acc10b-jump-verify.mjs`（验收只读校验器，acceptance-e.md:5/124 明列「验收产物，probe/」） | §3.6 第 6 项「功能 commit 没卷进 probe/**」、§7 红线 3 |
| `818576f` feat(I1.10b) 批次4 WP-6 | `docs/iterations/iteration-10b/evidence/flake-frames/AC-04-timing-instance-list-20261117T000000.log`、`HANDOFF_EVIDENCE_ESCAPE-symlink-handoff-schema-20261117T000000.log`、`_index.md` | 同上「没卷进 evidence/**」 |

`b92270b`、`ab4f010` 两个功能 commit 干净（evidence/probe 命中 0）。

**精确整改位置**（不改判据、只调提交边界）：
1. 将 `probe/acc10b-jump-verify.mjs` 从 `18438d6` 移出，并入 S3 验收产物提交（与 `acc10b-e-*` 脚手架同批）。
2. 将 `818576f` 中 3 份 `docs/iterations/iteration-10b/evidence/flake-frames/*` 移出，并入 S3 evidence 提交。
3. 二者为**已提交历史**，移动需主控用交互式 rebase / 重建提交（属破坏性历史操作，本终验 Agent 不执行）；若选择保留历史，则须在主控裁决台账显式登记「验收产物随功能提交」的例外并说明不影响判定，但按 §3.6 字面该项仍计 FAIL。

### 6.3 报告数字一致性 — 满足
results.jsonl 末条（51 / 766 核对项 / AC-25 18、AC-33 14）与 summary.json、report.md 三处数字一致；全量 1526/1500/17/9 与 §4 及 report.md 一致。

### 6.4 建议的分组提交清单（供主控）(S3/S4 尚未提交)

| 组 | commit 建议 | 内容 |
|---|---|---|
| A（S2 修复） | `fix(I1.10b): 复判修复 — J-1 sessionTag / J-2 stateLabel / F4-05 stateSince / L 语义代理 / K 允许集合` | `desktop/ui/app.js`、`desktop/ui/drill/host-jump.js`、`test/wp14/{connection-panel,drill-errors,host-jump}.test.js` |
| B（S0/S2 文档） | `docs(I1.10b): 裁决 K/L/J 与证据索引补注` | `decisions.md`、`evidence/flake-frames/_index.md` |
| C（S3 验收产物） | `docs(I1.10b): 51 条 AC 验收收口 — 证据/脚手架/判定` | `acceptance-{a,b,c,d,e}.md`、`evidence/**`（含归档）、`probe/acc10b-{f-*,e-*,jump-verify,cases/}`、`probe/acc10b-f-results.jsonl`/`summary*.json`/`blockers.md` |
| D（S4 终验） | `docs(I1.10b): S4 终验与全局汇总` | `final-verification.md`、`report.md`、`summary.json` |
| E（会话材料，另仓/另提） | `chore(memory): I1.10b 会话记忆` | `.workbuddy/memory/**`（不混入功能/验收提交） |

> 历史 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 已恢复，**不入任何提交**。

**结论**：当前工作树可分组、报告数字一致；但两个历史功能 commit 卷入验收产物 ⇒ **FAIL**（§6.2 给精确整改位置）。

---

## 7. 原始帧索引

| 校验 | 关键原始帧 / 命令输出 |
|---|---|
| 结果完整性 | `probe/acc10b-f-results.jsonl`（57 行，末条统计脚本）；`requirement.md` v6.1（51 定义 / 51 Then / 43 BR / 7 NF）；`probe/acc10b-f-summary{,b,c,d,e}.json` |
| 证据支撑性 | `evidence/AC-{01,02,08,22,23,29,34,37,46,51}.{state.json,events.jsonl,tests.stdout.txt,test.source.txt,status.txt,meta.json}`；`evidence/AC-{25,33}.live-*.process.json` / `AC-33.stay10s.jsonl` / `AC-25-33.host-jump.*` |
| 判定未放宽 | `evidence/flake-frames/baseline-HEAD-*.log`；`evidence/AC-37.test.source.txt:87,114`；`src/adapter/host-open.js:60,63` + `test/wp14/host-jump.test.js:293-328`；`test/wp14/connection-panel.test.js:188-190,200`；`acceptance-e.md:13-14,45-50,85-89` |
| 门禁与回归 | 命令输出 `/tmp/i10b-final-gate.log`（1526/1500/17/9）、`/tmp/i10b-iso-reg.log`（8/8）、`/tmp/i10b-iso-orch.log`、`/tmp/i10b-iso-regdrill.log`（8/8）；`evidence/AC-34.fullrun.tap.txt`（1524/1500/15/9）、`evidence/AC-34.diffset.txt`、`evidence/flake-frames/_index.md`；purity 两命令输出；`git hash-object` 三文件比对 |
| 缺陷与遗留 | `probe/acc10b-f-blockers.md`（C-1.1/C-1.2/D-1.1/D-1.2 + §3 脚手架修订）；`acceptance-{a,b,c,d,e}.md` §遗留/建议 |
| 提交范围 | `git log --oneline -25`、`git show --name-status 18438d6 / 818576f`；本报告 §6.2 / §6.4 |
