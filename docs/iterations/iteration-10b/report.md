# I1.10b 实现与验收报告 — 角色下钻 + 联动 + 特殊节点交互 + 一键跳转

> **需求**：`docs/iterations/iteration-10b/requirement.md` **v6.1**（51 条 AC / 43 条 BR / 7 条 NF / 附录 A~D）。
> **拆分**：`docs/iterations/iteration-10b.md` r?（6 WP：WP-1~WP-6，文件零交集，AC→WP 满覆盖 51/51；拆分评审 round2 PASS）。
> **裁决**：`docs/iterations/iteration-10b/decisions.md` 裁决 A~L（12 条：一键跳转三段口径、窗口级取舍、回归差集、判据落真实投影、复判口径等）。
> **S0**：需求五轮独立评审（round1~4 FAIL → **round5 PASS**，F 项清零、覆盖 13/13、锚点 30 组全符合）；`review-v6.md` PASS。
> **S2**：4 个功能批次 + 逐批独立评审，批次 1 复评 PASS、批次 2/3/4 PASS。原提交 `b92270b`/`ab4f010`/`18438d6`/`818576f` 因终验第 6 项提交卫生整改，已重建为 `9a7a38f`/`a147553`/`163322c`/`725eb72`（树内容与原提交一致，仅剔除混入的验收产物）。
> **S3 验收记录**：`acceptance-a.md`（AC-01~15）、`acceptance-b.md`（AC-16~30 除 25）、`acceptance-c.md`（AC-31~45 除 33）、`acceptance-d.md`（AC-46~51）、`acceptance-e.md`（AC-25/33 真实宿主面）；`evidence/`（含 `_archive_*` 复判留痕、`flake-frames/`）；`probe/acc10b-f-results.jsonl`、`summary*.json`、`blockers.md`。
> **S4 终验**：`final-verification.md`（六项初判 5 PASS / 1 FAIL → 提交卫生整改后 **6 PASS**）、`summary.json`（全局汇总）。
> **HEAD**：`4f232e3`（S0~S4 全部产物已提交；整改前的原分支保留在 `backup/i1.10b-pre-hygiene`）。**生成时刻**：见 `summary.json.generatedAt`。

---

## 0. 总体结论

**S3 验收判定：PASS；S4 终验判定：PASS（初判第 6 项「提交范围」FAIL 已按 `final-verification.md` §6.2 重建提交历史整改，树内容不变、六项全绿）。**

51 条 AC 逐条取证完成，**51 通过 / 0 不通过 / 0 阻塞**；766/766 条核对项通过；每条 AC ≥4 份非空原始帧（425 引用 / 423 unique）；门禁全绿（差集 0、tests≥1425、purity 双目录 31 词、零依赖、三主链 8/8）；缺陷台账四项均有裁决处置。终验初判唯一 FAIL 为提交卫生（历史功能 commit 混入验收产物），已重建提交历史整改，不影响任何 AC 判定、门禁数字或证据有效性。

| 项 | 数值 | 来源 |
|---|---|---|
| AC 判定 | **51 通过 / 0 不通过 / 0 阻塞** | results.jsonl 末条 / summary.json |
| 核对项 | 766 / 766（100%） | results.jsonl `total`/`ok` 求和 |
| 证据 | 425 引用 / 423 unique 帧，每 AC ≥4，0 空文件 | results.jsonl evidence / 实盘 |
| 全量回归（S4 实跑） | `1526 tests / 1500 pass / 17 fail / 9 skipped`，差集 **0**，≥1425 | 本报告 §4 / final-verification §4 |
| 全量回归（验收期帧） | `1524 / 1500 / 15 / 9`，差集 0 | `AC-34.fullrun.tap.txt` |
| 静态门禁 | purity 双目录 31 词 exit 0；deps 0；三主链 8/8 | 本报告 §4 |
| S0 需求评审 | 5 轮，最终 round5 PASS（F 清零、覆盖 13/13） | review-round5.md |
| S4 终验 | 六项初判 5 PASS / 1 FAIL → 整改后 6 PASS（提交范围） | final-verification.md §0 / §6.2 |

**能力结论**：点角色进下钻、看卡片/证据、点连线看交接包、特殊节点处置、子工作流逐层下钻、一键唤起宿主并给出可核对会话标识——全链路在应用内闭环；I1.10a 44 条 AC 判据与逐字文案基线无回归。最难一条 **AC-34 回归门禁**：在 17 条全量失败中逐条归类（13 允许集 + 2 S0 基线既有红 + 2 隔离确认 flake），差集 0，干净 HEAD 基线帧与隔离复跑帧双证据支撑复判通过。

---

## 1. 验收范围与判定口径

- **验收面**：B 类（纯投影机检面 + 回环接口面）+ C 类真实宿主面（AC-25 / AC-33，DSH 0.2.2-rc.1）。不接真实 DSH 模型推理、不需模型凭据（裁决 A/B）。
- **证据三档**：`mock 实测`（48）/ `mock 实测（静态机检面）`（1）/ `真实宿主实测（进程）+ mock 实测（机检），C 类`（2）。人工核验面（窗口前置、剪贴板内容、窗口内 toast 可见性）单列，不计入自动通过、不计阻塞（裁决 B）。
- **F-16 机检口径**：先 `test -f test/wp14/<file>.test.js` 再 `NODE_ENV=test node --test`，断言 exit 0 / `# pass ≥ 1` / `# fail 0` / 无 `not ok`；Then 逐字期望由需求逐字抽取进用例并由同名契约测试承载。
- **夹具隔离**：独立项目根 `%TEMP%/maestro-i10b-acc10b-f/<AC>`，注入 `NODE_ENV=test`；同 AC 多次记录取末条（复判留痕）。
- **文本扫描**：`grep -E` / `grep -RE`（ERE），禁 BRE `\|`（本机 toybox shim 假通过）。
- **回归判定（裁决 G + K）**：三段式 —— ① `tests ≥ 1425`；② 允许集合 = win32 16 条登记项 ∪ S0 开工基线既有红（须有 baseline-HEAD 帧）∪ 文件级隔离复跑通过并留帧的 flake；③ 差集（集合外新增红）= 0。不以单次失败条数作判据。

---

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `probe/acc10b-f-{lib,common,run,final}.mjs` + `-b/-c/-d.mjs`、`acc10b-e-*.mjs`、`acc10b-jump-verify.mjs` | S3 验收脚手架（可复跑）与受控真实面探针 |
| `probe/acc10b-cases/ac01..ac51.mjs` + `README.md` | 逐 AC 用例（判据原文逐字） |
| `probe/acc10b-f-parts/AC-01.md`~`AC-51.md` | 51 份逐 AC 核对表 |
| `probe/acc10b-f-results.jsonl` / `summary*.json` / `blockers.md` | 结果流水 / 分批汇总 / 缺陷台账 |
| `docs/iterations/iteration-10b/evidence/AC-NN.*` | 逐 AC 原始帧（tests.stdout / test.source / arch.stdout / state / events / corestop / meta / status） |
| `evidence/_archive_*` / `evidence/flake-frames/` / `flake-frames/` | 复判历史留痕 / 干净 HEAD 基线帧 / 隔离复跑帧 |
| `acceptance-{a,b,c,d,e}.md` | 分批验收报告 |
| `final-verification.md` / `summary.json` / `report.md` | S4 终验与全局汇总 |

产品代码：`src/daemon/drill.js`、`src/registry/role-instances.js`、`src/adapter/host-open.js`、`desktop/ui/app.js`、`desktop/ui/drill/*` 等；测试：`test/wp14/*`。零第三方运行时依赖。

---

## 3. AC 逐条判定汇总（51/51）

| 批次 | 范围 | AC 数 | 通过 / 不通过 / 阻塞 | 核对项 | 证据引用 |
|---|---|---|---|---|---|
| a | AC-01~15 | 15 | 15 / 0 / 0 | 209 | 120 |
| b | AC-16~30 除 25 | 14 | 14 / 0 / 0 | 231 | 114 |
| c | AC-31~45 除 33 | 14 | 14 / 0 / 0 | 187 | 121 |
| d | AC-46~51 | 6 | 6 / 0 / 0 | 107 | 48 |
| e | AC-25 / AC-33（真实宿主面） | 2 | 2 / 0 / 0 | 32 | 22 |
| **合计** | **AC-01~51** | **51** | **51 / 0 / 0** | **766** | **425（423 unique）** |

逐条明细见 `probe/acc10b-f-summary{,b,c,d,e}.json` 的 `perAc` 与 `docs/iterations/iteration-10b/summary.json` 的 `perAc`（51 项，含 face / checks / evidence / verdict / 人工核验标记）。

**复判 AC（4）**：AC-34（裁决 K 补基线帧，14/14 通过）、AC-37（stateSince 5 字段补齐，17/17）、AC-46（真实失败映射修复，17/17）、AC-51（裁决 L 语义代理，18/18）。原判帧保留在 `_archive_*`，当前帧覆盖。

**人工核验项（3，不计自动通过）**：AC-25 窗口前置、AC-25 剪贴板实际内容、AC-33 窗口内提示可见性。

---

## 4. 门禁与复现（数字与终验一致）

```text
# 全量测试（需求唯一取数口径；裸跑会挂起，见 requirement.md:1032）
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"
# S4 实跑: tests 1526 / pass 1500 / fail 17 / skipped 9
# 验收期帧 AC-34.fullrun.tap.txt: tests 1524 / pass 1500 / fail 15 / skipped 9
# 差集 0 ; tests >= 1425 ✓

# purity 双目录（31 词全表，顺序见 requirement 附录 D-8）
FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"        # exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid "$FORBID"  # exit 0

# 零依赖
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"  # 0

# 三条主链（AC-34 锚点，独占复跑）
NODE_ENV=test node --test --test-concurrency=1 test/wp14/regression-drill.test.js  # 8/8, exit 0
# single / code-loop / task-loop 三主链 + USAGE_LINES 25 + status/graph 两格式 + 31 词 + deps

# 单批验收（重建）
node probe/acc10b-f-run.mjs --batch a    # b/c/d 同理；e 为真实宿主面
node probe/acc10b-f-final.mjs            # 由 results + parts 重建 summary

# 历史证据恢复（全量跑后必做）
git -c core.autocrlf=false checkout-index -f -- \
  docs/iterations/iteration-4/evidence/nfr-perf-atomic.json \
  docs/iterations/iteration-4/evidence/nfr-perf-batch.json \
  docs/iterations/iteration-4/evidence/nfr-perf-render.json
```

**17 条失败归类**（差集 0）：win32 16 登记项内 13 条 + S0 基线既有红 2 条（`HANDOFF_EVIDENCE_ESCAPE`、AC-04，有 `baseline-HEAD-*.log` 帧）+ 负载型 flake 2 条（`live 取消` EBUSY、`三主链无新增可见词`，独占复跑通过）。前者属 `baseline-failures-win32.txt` 已登记平台噪声，历史 `iteration-7/baseline-failures.txt` 不改，不以「零失败」判定。

---

## 5. 缺陷与处置（裁决 A~L 摘要）

| 裁决 | 要点 | 影响 |
|---|---|---|
| A | 一键跳转「打开对应会话」本机不可达 → 三段交付（唤起宿主 / 显示并可复制标识 / 标识==state.sessions[].sessionId） | AC-25/33 不承诺「自动选中会话」 |
| B | 本机无 Rust/MSVC → 不设窗口级自动判据；窗口动作列人工核验 | AC-25/33 部分证据分级人工核验 |
| C | 「跳转」限单实例现场；升级面板只暴露「继续 + 取消」 | AC-23 面板无越界处置项 |
| D | 未知节点状态统一落「被阻塞」并标「状态未知」 | AC-10/31 与 I1.10a AC-35 一致 |
| E | 修复只补不减，新增 AC 接续编号 | v2→v5 只增不删 |
| F | 架构检查命令须当前仓库真跑为真，31 词写全 | AC-30 双目录扫描 |
| G | 回归三段式（条数下限 + 差集 + 隔离留帧），不比绝对失败数 | AC-34 判定 |
| H | 判据落真实投影与接缝（hostIcons 来源、overlay 共用、滚动指标列内部断言） | 多处 AC Given/判定锚点 |
| I | 会话标识==sessionId；目录同名为待验事实，不进判据 | AC-25/33 判据② |
| J | 批次 3 两处逐字偏差修法（J-1 button.label / J-2 stateLabel 结构化字段 / J-3 C1 补注） | AC-25/23 逐字断言 |
| K | AC-34 允许集合扩为 16 ∪ S0 既有红 ∪ flake；补两类帧后复判通过 | AC-34 由不通过→通过 |
| L | AC-51 机检断言语义等价（`assert.ok(x !== y)` 等价 `assert.notEqual`），不删项不放宽 | AC-51 由 17/18→18/18 |

**验收期缺陷（均已修复/复判）**：
1. **AC-34 差集 2**（不通过）→ 裁决 K 补干净 HEAD 基线帧 + 隔离复跑帧 → 通过（C-1.1）。
2. **AC-37 缺 stateSince**（不通过）→ 裁决 J F4-05 三处夹具补 5 字段 → 通过（C-1.2）。
3. **AC-51 机检代理过严**（17/18）→ 裁决 L 语义等价检测 → 18/18（D-1.1）。
4. **AC-46 失败映射风险** → 实现区分 ENOENT / 非 ENOENT → 维持通过（D-1.2）。
5. **脚手架自身修订**（ac01/ac04 字面量、grepCheck 多目标）→ 非产品缺陷、不放宽断言，重跑全绿（blockers §3）。

---

## 6. 遗留问题与边界

- **O-1（非阻塞观察）**：真实宿主进程短命（点击 +0/+250ms=1，+1000ms 归零），系 `host-open.js` 的 `detached + stdio:ignore + unref`（D-4 不等待不轮询）下 ACP 短命进程行为，如实留帧、不夸大；满足 Then「3 秒内进程存在」（AC-25/33）。
- **O-2（事实补注）**：C1「目录同名=sessionId」本机 8/8 一致（`AC-25.session-dir.txt`），按裁决 I/J-3 仅作附录 D-14 表 C1 补注，不回填判据、不改强度，报告不据此声称「打开对应会话」。
- **O-3（人工核验面）**：窗口前置、剪贴板实际内容、窗口内 toast 可见性按裁决 B 属人工核验；需 Tauri 窗口环境人工点击确认，见 `acceptance-e.md` §6 建议。不影响自动面判定。
- **O-4（提交卫生，初判 FAIL → 已整改 PASS）**：原功能 commit 混入 `probe/acc10b-jump-verify.mjs` 与 3 份 `evidence/flake-frames/*`，已按 `final-verification.md` §6.2 重建提交历史剔除，验收产物归 S3 验收 commit；最终树与原分支备份逐字节一致，未 push 远端。
- **无未完成 AC 混入遗留**；遗留项均为不影响结论的观察项。

---

## 附录 · 建议提交分组（S3/S4 待提交）

| 组 | commit 建议 | 内容 |
|---|---|---|
| A | `fix(I1.10b): 复判修复 — sessionTag/stateLabel/stateSince/语义代理/允许集合` | `desktop/ui/app.js`、`desktop/ui/drill/host-jump.js`、`test/wp14/{connection-panel,drill-errors,host-jump}.test.js` |
| B | `docs(I1.10b): 裁决 K/L/J 与证据索引补注` | `decisions.md`、`evidence/flake-frames/_index.md` |
| C | `docs(I1.10b): 51 条 AC 验收收口 — 证据/脚手架/判定` | `acceptance-{a,b,c,d,e}.md`、`evidence/**`、`probe/acc10b-*`、results/summary*/blockers |
| D | `docs(I1.10b): S4 终验与全局汇总` | `final-verification.md`、`summary.json`、`report.md` |
| E | `chore(memory): I1.10b 会话记忆` | `.workbuddy/memory/**`（不混入功能/验收提交） |

> `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 已恢复，不入提交。功能 commit 严禁 `git add -A` 卷入 `evidence/**`、`probe/**`（§7 红线 3）。
