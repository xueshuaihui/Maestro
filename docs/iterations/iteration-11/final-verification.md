# I1.11 最终结果校验（终验 · S4 收口把关）

> **角色**：独立终验 Agent（非实现、非逐 AC 验收 Agent）。职责是回答「整个迭代能不能算结束」。
> **判据**：`docs/templates/execution-template.md` §3.6 六项校验 + §4（S4 收口）。
> **环境**：macOS / Node v22.22.2；仓库根 `/Users/xuesh/www/Maestro`；分支 `feat/i1.11-notify-queue-assets`；HEAD `0b0b9ff`。
> **纪律**：不采信任何 Agent 自述数字，每条自己跑 / 自己算；零产品代码改动，只新建本文件。
> **校验时间**：2026-11-18。

---

## 0. 六项校验总表

| # | 校验项 | 结论 | 关键数字 / 一句话依据 |
|---|---|---|---|
| 1 | 结果完整性 | **PASS** | 重算 `results.jsonl`（取每 AC 最后一条）覆盖 **49** AC，**通过 49 / 不通过 0 / 阻塞 0**（与 summary 自述无关，脚本重算）；704 核对项全 ok；§1.3 范围条目 + 10 WP 交付项 100% 有结论 |
| 2 | 证据支撑性 | **PASS** | 抽查 12 条 AC：每条 **9–22 个**证据文件（均 ≥4）、**0 空文件**、帧内容为真原始帧（TAP/state/arch log/逐字文案），非「已确认」；裁决后复跑新证据已落盘 |
| 3 | 判定未被放宽 | **PASS** | 12 条 AC 的 Then 指纹 **12/12** 逐字命中需求 v14 原文；D-54~D-58 全为锚点归位/假阳性排除（明文「不放宽/行为判定不变」）；v10→v14 AC 49 / BR 37 / NF 8 数量未变；U-13 真探针为显式 SKIP（证据降级），非伪通过 |
| 4 | 门禁与回归 | **PASS** | 全量 **1606 tests / 1600 pass / 4 fail / 2 skip**，4 条失败全落判定基线（**差集 0**，tests ≥1425）；purity 双扫 exit 0（31 词）；deps 0；cargo check exit 0；三主链 13/13（含 A-0 归一化逐字） |
| 5 | 缺陷与遗留 | **PASS** | blockers.md 四条初判不通过全部有 D-54~D-58 闭环结论 + 复跑数字；无未决裁决；S0 评审 round4 总判 PASS（0 阻断/6 建议） |
| 6 | 提交范围 | **PASS** | 功能 commit（feat/fix）**零卷入** evidence/**、probe/**；仅 4 个 test 类 commit 含证据；四处数字一致；工作区干净（nfr-perf 已还原） |

**总判定：PASS —— 六项校验全部通过，可以进入 S4 收口。**

---

## 1. 校验 1 · 结果完整性（PASS）

### 实跑命令与输出

```bash
$ wc -l probe/acc11-f-results.jsonl
181 probe/acc11-f-results.jsonl

$ node -e '...取每个 AC 最后一条重算...'
覆盖AC数: 49
判定分布: {"通过":49,"不通过":0,"阻塞":0,"OTHER":0}
非通过(最后一条): 无
（AC-01~49 均有记录；12/13/15/18/27/30/39 等含多条裁决前/后记录，取最后一条）
```

```bash
$ node -e '...summary perAc 汇总...'
perAc条数: 49  evidenceCount合计: 252  # 注：perAc.evidenceCount 为各 AC parts 登记数，非全盘证据数
summary声明evidenceFileCount: 588  head: e598e43
```

### 判定

- **覆盖全部 49 AC**：results.jsonl 重算得 49 个唯一 AC，无缺号、无OTHER。
- **通过=49 / 不通过=0 / 阻塞=0**：脚本重算分布与 summary.json 自述一致，但以重算为准。
- **704 核对项全 ok**：summary perAc checks 合计 = results 最后一条 total 合计 = ok 合计 = **704**。
- **§1.3 范围条目 + 10 WP 交付项**：iteration-11.md §4 的 AC→WP 满覆盖映射覆盖 AC-01~49（无 WP-10）；49 条 AC 逐条有 `详情` 段落与核对表（acceptance-fixture.md），7 个 daemon 模块 + HTTP/UI/壳层/WP-11 交付项均有对应 AC 判定。无「无结论」条目。
- **§3.5 取最后一条**：已用脚本按 `ac` 分组覆盖，历史「不通过」记录（AC-12/13/15/18/27/39）不参与最终判定，正确取末条「通过」。

**结论：PASS。**

---

## 2. 校验 2 · 证据支撑性（PASS）

### 抽查的 12 条 AC 与证据实盘

```bash
$ node -e '...遍历 evidence/AC-* 统计...'
AC目录数: 49  证据文件总数: 588
空文件数: 0
证据<4的AC: 无
各AC证据数(抽查): AC-12:10 AC-13:9 AC-15:13 AC-18:17 AC-27:13 AC-30:12
                    AC-39:22 AC-04:12 AC-06:10 AC-38:17 AC-43:10 AC-49:15
```

| AC | 证据数 | 关键原始帧（支撑判定的实证） | 裁决后复跑证据落盘 |
|---|---|---|---|
| AC-12 | 10 | `AC-12.arch-1.log`（核心 `approvals.js:14 APPROVAL_SESSION_GONE` 命中）、`AC-12.queue.tap.json`（# pass 16/# fail 0）、`AC-12.output.json` 语义复核 | D-54 归位核心后 `arch-1/2.log` 已落盘 |
| AC-13 | 9 | `AC-13.check.json`(10/10 ok)、`AC-13.queue.tap.json`、`AC-13.state.json`，数字序列 `[[2,1,1,1],[1,0,0,1],[0,0,0,0]]` 逐字 | D-54 fixture 按 Given 角色对调后落盘 |
| AC-15 | 13 | `AC-15.arch-1/2.log`（错误码锚核心 + queue.js 结论表）、`AC-15.queue.tap.json`、`AC-15.output.json` | D-55 复跑 16/16 证据落盘 |
| AC-18 | 17 | `AC-18.arch-5/6.log`（探针字段/注释排除后零命中）、`AC-18.check.json`(21/21 ok)、三处数字序列 | D-55 复跑 21/21 证据落盘 |
| AC-27 | 13 | `AC-27.arch-1.log`（排除词表键后零命中）、`AC-27.arch-2.log`（`FALLBACK_WORD = ...inactive`）、`AC-27.occupancy.tap.json` | D-56 归位后两锚点均落盘 |
| AC-30 | 12 | `AC-30.canvas-interaction.tap.json`（4/4，四交互断言逐条列出）、`AC-30.canvas.tap.json` | **D-57 补缝**：`canvas-interaction.test.js` 新建并复跑 4/4，帧已落盘 |
| AC-39 | 22 | `AC-39.arch-4.log`(`POST=10 violations=0 bad=[]`)、`AC-39.arch-6.log`(`writePatterns=10 violations=0`)、`AC-39.http-contract.tap.json` | **D-58**：`/ui/prefs` 纳入名单后复跑 28/28，arch log 归零落盘 |
| AC-04 | 12 | `AC-04.notify.tap.json`、`AC-04.ui-views.tap.json`、`AC-04.check.json`(15/15 ok，逐字 `open-queue`/`followNotification` 锚点) | mock 实测（真窗口不可用，证据分级降级已注明） |
| AC-06 | 10 | `AC-06.notify.tap.json`、`AC-06.frame.json`（去重窗口 9999/10001ms）、`AC-06.check.json`(13/13) | — |
| AC-38 | 17 | `AC-38.e2e.tap.json`、`AC-38.http-contract.tap.json`、`AC-38.shell-notify.tap.json`、`AC-38.check.json`(21/21) | 三段端到端逐字证据齐全 |
| AC-43 | 10 | `AC-43.contract.tap.json`、`AC-43.arch-2.log`、`AC-43.check.json`(11/11，scope 零下钻) | — |
| AC-49 | 15 | `AC-49.notify.tap.json`、`AC-49.ui-views.tap.json`、`AC-49.check.json`(18/18，逐字「已处理」) | — |

### 关键抽查输出摘录

```bash
$ cat AC-30/AC-30.canvas-interaction.tap.json
"tests":4, "pass":4, "fail":0
subtests:
  AC-30 交互①：拖拽不改变节点位置、两次布局坐标一致、views/ 无新增文件
  AC-30 交互②：交互事件流无 node-detail / jump-host 事件
  AC-30 交互③：单击选中恰 1 个、再点另一个替换为 1 个、点空白清空为 0
  AC-30 交互④：双击不聚焦、不下钻、不跳转，视图仍为 canvas

$ cat AC-39/AC-39.arch-4.log   →  POST=10 violations=0 bad=[]
$ cat AC-39/AC-39.arch-6.log   →  writePatterns=10 violations=0 bad=[]
$ cat AC-12/AC-12.arch-1.log   →  src/core/approvals.js:14:export const APPROVAL_SESSION_GONE = 'APPROVAL_SESSION_GONE';
$ cat AC-27/AC-27.arch-2.log   →  58:const FALLBACK_WORD = ROLE_INSTANCE_STATUS_LABEL.inactive;
```

### 判定

- 12 条 AC 每条 **≥9 个**证据文件（远超 §3.3 的 ≥4 要求），**0 空文件**。
- 帧内容为真实 TAP / state / arch log / 逐字文案，能支撑判定（如 AC-30 四条交互断言逐条列出、AC-39 `violations=0`），非「已确认」空话。
- 1 字节 `arch-N.log` 经 hex 核对为单个换行符 `0a`，是 grep「零命中（exit 1）」命令的正常空输出证据，与 check.json 的 `expected: exit 1` 配套，非无效空文件。
- 裁决后复跑的新证据（AC-30 canvas-interaction、AC-39 新 arch log）确已落盘并与末条判定对应。

**结论：PASS。**

---

## 3. 校验 3 · 判定未被放宽（PASS）

### 3.1 Then 逐字核对（12/12 命中）

```bash
$ node -e '...从 check.json 取 Then 指纹，在 requirement.md v14 对应段落逐字匹配...'
AC-12: 命中=true   AC-13: 命中=true   AC-15: 命中=true   AC-18: 命中=true
AC-27: 命中=true   AC-30: 命中=true   AC-39: 命中=true   AC-04: 命中=true
AC-06: 命中=true   AC-38: 命中=true   AC-43: 命中=true   AC-49: 命中=true
```

12 条 AC 的 `check.json.requirement.then` 指纹（去格式符后前 35 字）全部逐字命中需求 v14 对应 AC 段落。例如 AC-15 期望仍为逐字「已处理（重新分配），无需再次处理」、AC-39 仍为「写操作数=2 / 状态写入=3 / 其余=0」三独立数字。

### 3.2 D-54~D-58 裁决性质：锚点归位 / 假阳性排除，非放宽

| 裁决 | 原判 | 裁决性质 | 行为判据是否变化 |
|---|---|---|---|
| D-54 | AC-12/13 架构锚点 0/误命中 | 锚点归位核心 + 排除 `(no batch)` 否定注释；fixture 按 Given 角色对调 | **不变**：会话校验必经既有路径、批量零命中、数字序列期望值不变 |
| D-55 | AC-15 错误码 0 命中；AC-18 探针字段 2 命中 | 错误码锚归核心 + queue.js 结论表；探针字段改「零自算」（排除注释/下发字段） | **不变**：逐字提示 + 裁决次数 1 + 三处数字同源 |
| D-56 | AC-27 `unavailable` 1 命中 | 排除词表键引用（五档排序必需）+ 断言 FALLBACK_WORD 落 inactive | **不变**：「不冒充不可用」 |
| D-57 | AC-30 交互断言未实现 | 判为可补测试接缝，补 `canvas-interaction.test.js` 后重判 | **加强**：补 4 条交互断言，非放宽 |
| D-58 | AC-39 `/ui/prefs` 命中写名单 | D-1 名单字面漏同步，补 `/ui/prefs` 为第六类授权写 | **不变**：名单外任何写仍判失败 |

裁决均有「不放宽 / 行为判定不变 / 语义不放宽」明文（decisions.md:405–444），符合 §3.4 红线。

### 3.3 AC/BR/NF 数量未漂移（v10→v14）

```bash
$ grep -nE '^## 附录 C|^- v1[0-4]' docs/iterations/iteration-11/requirement.md
v10/v11/v12/v13/v14 五条版本记录均含「AC/BR/NF 数量与判定强度未变」
头部版本 v14；AC 49 条、BR 37 条（v6 由 36→37，新增 BR-37）、NF 8 条
```

v10~v14 五次修订全部只改架构检查锚点字面/授权名单/口径注记，没有删减 AC、合并、放宽 Then。AC 数量自 v4（48→49）后稳定在 49。

### 3.4 阻塞未被写成通过（U-13）

```bash
$ grep -nE 'skip|SKIP|gated' test/wp14/shell-notify.test.js
11: Real probe layer (gated): ... the test is skipped with an explicit reason;
234: '真实探针层：ctl 四动作触发事件并改名 .done（需当前源码构建产物）',
235: { skip: realProbeSkipReason() },
```

全量测试第 1110 条 `# SKIP release 壳层二进制早于 main.rs（本轮改动未构建）；静态契约层已覆盖接缝` —— 属**显式 gated SKIP + 证据分级降级**（mock 实测：静态契约 11 条已落），非伪通过；人眼确认（通知外观/点击手感）登记人工核验项，不计入 AC 通过数。符合 §3.4「阻塞/不可观测不许写通过」。

**结论：PASS。**

---

## 4. 校验 4 · 门禁与回归（PASS，全部自跑）

### ① 全量测试

```bash
$ env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
# tests 1606
# pass 1600
# fail 4
# cancelled 0
# skipped 2
# duration_ms 307073.675145   （约 5 分 7 秒）
```

退出码 1（因含 4 条预期失败），**不采用 `fail===0` 判据**（D-21）。4 条失败逐条核对判定基线：

| # | 失败用例 | 判定基线归属 |
|---|---|---|
| 1 | `AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新` | R-08 的 AC-04（ALLOWED） |
| 2 | `task-loop 审核提示词给绝对路径：基址与 readReview 同源…` | 基线第 6 条 |
| 3 | `core.stop：先回包再断连，5s 内收敛，core.json 仍可读` | 基线第 3 条 |
| 4 | `main：--cwd 相对当前 shell 目录解析，不作为项目根` | 基线第 5 条 |

**差集 = 0；tests 1606 ≥ 1425 ✓。** 2 条 SKIP 均为已登记的环境 gated（Windows pipeName / U-13 真探针）。

### ② purity 双扫（31 词）

```bash
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>   → OK: 扫描 37 个文件，零命中；exit 0
$ node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid <31词>            → OK: 扫描 22 个文件，零命中；exit 0
```

31 词数经脚本确认（含研究员/撰写者/审核者 + code-loop/developer/… + 新增词表），双扫均 exit 0。

### ③ 零依赖

```bash
$ node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"
dependencies count= 0
$ grep -REn '"vite"|"webpack"|"rollup"|"esbuild"|"parcel"' package.json   → exit 1（零命中）
```

### ④ Rust 编译

```bash
$ cargo check --manifest-path desktop/src-tauri/Cargo.toml
   Compiling maestro v0.1.0
   Finished `dev` profile ... in 4.04s
CARGO_EXIT=0
```

### ⑤ 三主链（复核 regression.test.js 锚点 + 实跑）

复核 `test/wp14/regression.test.js:374–480`：`runChain` 在独立 tmp 根按 `--template single|code-loop|task-loop --host mock` 实跑，`normalizeLine` 做 A-0 归一化（会话号/实例号/时间/耗时），逐字比对冻结基线；`task-loop` 允许 flaky（N 次≥1 次命中）；禁词表 4 词。锚点方式为「归一化逐字 + 退出码 + stderr 空 + 禁词」，非 `fail===0`。

```bash
$ env -u NODE_OPTIONS NODE_ENV=test node --test test/wp14/regression.test.js
# Subtest: 三主链：A-0 归一化后逐字命中 I1.1/I1.3 冻结基线（single/code-loop/task-loop）
ok 13 - 三主链：A-0 归一化后逐字命中 ...
# tests 13 / # pass 13 / # fail 0
```

三条链各跑 2 次，全部逐字命中冻结基线，退出码符合（single 0 / code-loop 4 / task-loop 4），stderr 空。**注**：手动 shell 直跑 `bin/orch.js run --host mock` 在未配置 LOCALAPPDATA 的临时根会触发 DSH 路径查找错误（与本测试用 `envFor()` 继承测试进程环境不同），故以 regression.test.js 内实跑为准——它内部真实 spawn 三条链并逐字断言，已覆盖「实跑至少 1 条链」要求。

### 副作用还原

```bash
$ git status --short    # 全量测试改写 3 个性能证据：
 M docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json
$ git checkout -- docs/iterations/iteration-4/evidence/nfr-perf-*.json
$ git status --short    # 空（工作区干净）
```

**结论：PASS。**

---

## 5. 校验 5 · 缺陷与遗留（PASS）

### blockers.md 每项处置结论

```bash
$ grep -nE '裁决闭环|复跑.*通过' probe/acc11-f-blockers.md
批次 A → D-54：AC-12/13 锚点归位（复跑通过）
批次 B 裁决闭环（D-55）：AC-15 复跑 16/16；AC-18 复跑 21/21
批次 C 裁决闭环（D-57）：AC-30 补缝复跑 14/14；AC-27 归 D-56
批次 D 裁决闭环（D-58）：AC-39 复跑 28/28
```

台账中 4 条初判「不通过」（AC-12/13/15/18/27/39）全部有对应裁决编号、根因分析、原始帧、复跑数字；「环境假阴性」（长 TMPDIR socket 路径超 104 字节）与「机检文件名口径差异」均登记为「非缺陷、不放宽」。无「不通过/阻塞」遗留。

### report.md §5 遗留项

`docs/iterations/iteration-11/report.md` **当前不存在**（见校验 6 交付物清单）。按本次终验任务书，「report.md 若存在」才核其 §5——故不因缺失判 FAIL，但作为**收口前建议补齐项**列入第 6 节清单核对。

### 未决裁决搜索

```bash
$ grep -rniE '交主控裁决|需裁决|待裁决|未裁决|裁决请求' docs/iterations/iteration-11/ probe/acc11-f-blockers.md
命中项全部为「裁决请求（...）」原始描述，其后均紧跟「批次 X 裁决闭环（D-5x）」小节；review-round1.md 的「批量处置待裁决」由 D-01 裁决（移出范围外）。无悬空未决裁决。
```

S0 评审闭环：`review-round4.md` 总判 **PASS**，阻断 0 / 建议 6（I-01~I-06，均为措辞/授权明确性，建议级）；规划逐句覆盖表 10/10「覆盖」，反向扫描无夹带无缺漏；需求头部 v14 = 附录 C 末行 v14。

**结论：PASS。**

---

## 6. 校验 6 · 提交范围（PASS）

### 功能 commit 未卷入验收产物

```bash
$ for c in $(git log --format=%H main..HEAD); do
    if 提交主题匹配 ^(feat|fix)(I1.11); then 列出路径中含 evidence/|probe/ 的文件; fi
  done
（无任何输出 —— 功能 commit 零卷入）

$ git log --oneline main..HEAD -- 'probe/**' 'docs/iterations/iteration-11/evidence/**'
0b0b9ff test(I1.11): S3 批次 D 取证（AC-39~49）→ 全量 49/49 通过
9cec1e3 test(I1.11): S3 批次 C 取证（AC-27~38…）
a0004c4 test(I1.11): S3 批次 B 取证（AC-14~26…）
bb60fb9 test(I1.11): S3 脚手架 acc11-f-* + 批次 A 取证
```

仅 4 个 **test 类** commit 含 evidence/probe，符合 §2.7「精确 git add，验收产物由主控单独提交」。

### 四处数字一致

| 来源 | AC 判定 | 核对项 | 证据 | 一致性 |
|---|---|---|---|---|
| `results.jsonl`（重算末条） | 49/0/0 | 704 | — | 基准 |
| `summary.json` | 49/0/0 | 704（perAc checks 合计） | 588 | ✓ |
| `acceptance-fixture.md` | 49/0/0（抬头明写） | 逐 AC 核对表 | 588 | ✓ |
| `report.md` | 不存在 | — | — | 见下 |

- summary.head = `e598e43`（批次 C 收口时生成），当前 HEAD = `0b0b9ff`（其后两个 commit 为需求 v14 + 批次 D 取证，数字未变）。**该 head 字段为生成时快照，不影响数字本身**——脚本重算末条仍为 49/0/0、704 核对项、588 证据，与当前 results.jsonl 完全一致。建议主控在收口时刷新 summary.head 以消除歧义（不影响结论）。
- `perAc.evidenceCount` 合计 252 是各 AC parts 登记数口径，与全盘 `evidenceFileCount=588`（实盘 588）是不同口径，非矛盾。

### 工作区

全量测试改写的 3 个 nfr-perf 文件已 `git checkout --` 还原，`git status --short` 为空，工作区干净。

**结论：PASS。**

---

## 7. 交付物清单核对（对照模板 §4.4）

| 交付物 | 状态 | 备注 |
|---|---|---|
| `docs/iterations/iteration-11/requirement.md` | ✓ | v14，头部 = 附录 C 末行 |
| `requirement-understanding.md` | ✓ | 39669 bytes |
| `review-round*.md` | ✓ | round1~4，最终 round4 PASS（0 阻断/6 建议） |
| `progress.md` | ✓ | 13336 bytes |
| `final-verification.md` | ✓（本文件） | 终验结论 |
| `acceptance-fixture.md` | ✓ | 389901 bytes，49 AC 逐条核对表 |
| `acceptance-product.md` | **缺失** | 本迭代全为 mock 实测、无真实宿主面；模板注「若无真实面则注明」——建议在 fixture 或 report 中补一句「无真实宿主面」的显式声明 |
| `evidence/` | ✓ | 49 目录 / 588 文件 |
| `report.md` | **缺失** | 模板 §4.1 收口产物。本次任务书按「若存在」处理，不阻断终验；**强烈建议收口前补齐**，以满足 §4.2 必须数字入报告 + §4.5 Done 第 6 项「四处数字一致」的完整性 |
| `decisions.md` | ✓ | D-01~D-58，末条 D-58 |
| `docs/iterations/iteration-11.md` | ✓ | 拆分 8 节 + AC→WP 满覆盖映射 |
| `probe/acc11-f-{lib,common,run,final}.mjs` | ✓ | 脚手架四件套齐全 |
| `probe/acc11-cases/` | ✓ | 逐 AC 用例（不带 -f） |
| `probe/acc11-f-parts/` | ✓ | 逐 AC 核对表 |
| `probe/acc11-f-{results.jsonl,summary.json,blockers.md}` | ✓ | 三件套齐全 |

**交付物核对：12 项齐备 / 2 项 S4 收口文档缺失（report.md、acceptance-product.md）。** 两项均不影响六项校验结论，但建议主控在宣布收口前补齐（终验 Agent 不改产品代码、不代写报告）。

---

## 8. 总判定与建议动作

### 总判定：**PASS**

六项校验全部通过；Done 第 1~5、7 项满足，第 6 项因 `report.md` 不存在仅有三处数字可核（三处一致）。按本次终验任务书口径（report.md「若存在」），**整个迭代可判定结束，可以收口**。

### 无 FAIL 项

本次终验无 FAIL，故无「现象/证据/建议动作」的阻断清单。以下为**不阻断结论**的收口建议（交主控处理，终验不改产品代码）：

1. **补 `report.md`**：按 §4.1 骨架写入抬头/0~6 节，落实 §4.2 必须数字（49 通过 / 0 / 0、704 核对项、588 证据、1606/1600/4/2skip、扫描 exit 0、三主链 exit 0/4/4、S0 评审 4 轮最终 round4 PASS），使 §4.5 第 6 项「四处数字一致」完整闭环。
2. **补 `acceptance-product.md` 或无真实面声明**：本迭代证据全为 mock 实测（U-13 真探针 gated SKIP），建议在 fixture 抬头或 report 中显式写明「无真实宿主面」，避免口径悬空。
3. **刷新 summary.head**：由 `e598e43` 更新到收口 HEAD（当前 `0b0b9ff`），消除「summary 落后两 commit」的表面歧义（数字本身无需改）。

### 终验纪律声明

- 本文件为独立终验产物，未由实现/验收 Agent 兼任；全部数字自己跑/自己算（结果重算、证据遍历、门禁实跑、逐字指纹比对）。
- 零产品代码改动；全量测试改写的 `nfr-perf-*.json` 已还原，工作区干净。
- 仅新建本文件 `docs/iterations/iteration-11/final-verification.md`。
