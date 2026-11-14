# I1.10a S3 验收 · B 组（AC-20 ~ AC-37）

> 判据来源：`docs/iterations/iteration-10a/requirement.md` v2 §3.1 同号 AC 全文 + 附录 A-0~A-14 / D-1~D-14；
> `docs/iterations/iteration-10a.md` r2 §4（F-16 机检模板）与 §5（交付物）；`decisions.md` 裁决 A~Y。
> 取证脚手架：`probe/acc10-f-{lib,common,run,final,gen,gates}.mjs` + `probe/acc10-cases/`（逐字抽取，`--check` 37/37 一致）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。

## ① 环境与复跑

| 项 | 值 |
|---|---|
| 仓库 HEAD | `7949e8a` |
| 验收级别 | B 类（mock 宿主 + 真实 core / daemon + 真实 Tauri 壳；不接真实 DSH、不需模型凭据，需求 §3.3） |
| 环境变量 | 全部命令 `NODE_ENV=test`；保留本机默认 `NODE_OPTIONS` 预加载（需求 §3.3 未要求剥离；剥离会触发 R-08 时序竞态），仅清 `ELECTRON_RUN_AS_NODE` |
| 夹具根 | 每 AC 独立 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，绝不进仓库 |
| 证据根 | `docs/iterations/iteration-10a/evidence/<AC>/` |
| 复跑 | `node probe/acc10-f-run.mjs AC-xx` / `--batch a|b|c|d`；`node probe/acc10-f-final.mjs` 重建本文件 |

## ② 逐 AC 判定表

| AC | 结论 | 证据等级 | 机检（F-16） | 核对项 | Then | 证据 | 判定依据 |
|---|---|---|---|---|---|---|---|
| AC-20 | **通过** | mock 实测 | `view-state.test.js` 6p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-21 | **通过** | mock 实测 | `focus-mode.test.js` 5p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-22 | **通过** | mock 实测（结构断言） | `view-state.test.js` 6p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-23 | **通过** | mock 实测 | `abnormal-style.test.js` 6p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-24 | **通过** | mock 实测 | `board.test.js` 7p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-25 | **通过** | mock 实测 | `labels-policy.test.js` 6p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-26 | **通过** | mock 实测 | `acceptance-e2e.test.js` 2p/0f（架构 2 项） | 11/11 | 4 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-27 | **通过** | mock 实测 | `readonly-local.test.js` 1p/0f（架构 1 项） | 9/9 | 1 | 11 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-28 | **通过** | mock 实测 | `labels-desktop.test.js` 25p/0f（架构 4 项） | 10/10 | 1 | 12 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-29 | **通过** | mock 实测 | `bundle.test.js` 1p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-30 | **通过** | mock 实测 | `errors.test.js` 24p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-31 | **通过** | mock 实测 | `project-guard.test.js` 1p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-32 | **通过** | mock 实测 | `health-hover.test.js` 4p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-33 | **通过** | mock 实测 | `hover-highlight.test.js` 5p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-34 | **通过** | mock 实测 | `legend.test.js` 4p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-35 | **通过** | mock 实测 | `board-unknown.test.js` 3p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-36 | **通过** | mock 实测 | `single-instance.test.js` 1p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-37 | **通过** | mock 实测 | `graph-parallel.test.js` 1p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |

## ③ 逐 AC 取证明细

### AC-20 · 缩放平移与一键复位

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 交互 ｜ **取证时刻**：2026-11-14T05:02:58.422Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-20/requirement.json` 与 `probe/acc10-f-parts/AC-20.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-20/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/view-state.test.js && NODE_ENV=test node --test test/wp13/view-state.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "saveState\|writeFile" desktop/ui/graph/view.js` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-20/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-view-state.test.js.attempt-1.log`
- `unit-view-state.test.js.log`
- `unit-view-state.test.js.summary.json`
- `unit-view-state.test.js.test-names.json`

### AC-21 · 双击聚焦 2 跳，Esc 退出

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 交互 ｜ **取证时刻**：2026-11-14T05:02:59.434Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-21/requirement.json` 与 `probe/acc10-f-parts/AC-21.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-21/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/focus-mode.test.js && NODE_ENV=test node --test test/wp13/focus-mode.test.js` → exit 0，# pass 5 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "focus\|visible" desktop/ui/graph/view.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-21/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-focus-mode.test.js.attempt-1.log`
- `unit-focus-mode.test.js.log`
- `unit-focus-mode.test.js.summary.json`
- `unit-focus-mode.test.js.test-names.json`

### AC-22 · 手动拖拽按实例保存，且不写实例状态

**结论**：通过 ｜ **证据等级**：mock 实测（结构断言） ｜ **场景类型**：功能 / 持久化 / 只读 ｜ **取证时刻**：2026-11-14T05:03:00.175Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-22/requirement.json` 与 `probe/acc10-f-parts/AC-22.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-22/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/view-state.test.js && NODE_ENV=test node --test test/wp13/view-state.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "instanceDir\|statePath" desktop/ui/` → exit 1（期望 1） ✅
- `grep -REn "views" desktop/src-tauri/src/config.rs` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-22/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-view-state.test.js.attempt-1.log`
- `unit-view-state.test.js.log`
- `unit-view-state.test.js.summary.json`
- `unit-view-state.test.js.test-names.json`

**备注**：

- R-12：B-36 真实壳内拖拽仍为结构断言（写入端 config.rs 零窗口级自动化用例）。本条按「mock 实测（结构断言）」判定，不冒充真实宿主实测；S3 以 view-state.test.js + config.rs 路径常量补结构证据。

### AC-23 · 异常高亮：角标 + 红色脉冲，尺寸与坐标不变

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 视觉 / 边界 ｜ **取证时刻**：2026-11-14T05:03:01.348Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-23/requirement.json` 与 `probe/acc10-f-parts/AC-23.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-23/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/abnormal-style.test.js && NODE_ENV=test node --test test/wp13/abnormal-style.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "pulse" desktop/ui/graph/style.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-23/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-abnormal-style.test.js.attempt-1.log`
- `unit-abnormal-style.test.js.log`
- `unit-abnormal-style.test.js.summary.json`
- `unit-abnormal-style.test.js.test-names.json`

### AC-24 · 节点看板作为可选切换，7 列只读

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 视图切换 ｜ **取证时刻**：2026-11-14T05:03:02.160Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-24/requirement.json` 与 `probe/acc10-f-parts/AC-24.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-24/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/board.test.js && NODE_ENV=test node --test test/wp13/board.test.js` → exit 0，# pass 7 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "column\|blocked" desktop/ui/board/board.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-24/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-board.test.js.attempt-1.log`
- `unit-board.test.js.log`
- `unit-board.test.js.summary.json`
- `unit-board.test.js.test-names.json`

### AC-25 · 标签策略：默认只显异常，正常悬停显示

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 交互 ｜ **取证时刻**：2026-11-14T05:03:02.936Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-25/requirement.json` 与 `probe/acc10-f-parts/AC-25.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-25/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/labels-policy.test.js && NODE_ENV=test node --test test/wp13/labels-policy.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "visibleLabels\|hover" desktop/ui/labels/labels.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-25/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-labels-policy.test.js.attempt-1.log`
- `unit-labels-policy.test.js.log`
- `unit-labels-policy.test.js.summary.json`
- `unit-labels-policy.test.js.test-names.json`

### AC-26 · 规划验收句端到端（逐字）

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：规划验收（核心） ｜ **取证时刻**：2026-11-14T05:03:03.674Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-26/requirement.json` 与 `probe/acc10-f-parts/AC-26.md` ① 节；本 AC 共 4 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-26/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/acceptance-e2e.test.js && NODE_ENV=test node --test test/wp13/acceptance-e2e.test.js` → exit 0，# pass 2 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "process[.]env[.]NODE_ENV\|__TEST__[ ]*=\|isTest[ ]*=" desktop/ui/` → exit 1（期望 1） ✅
- `grep -REn "probe_emit\|window-probe" desktop/ui/app.js` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-26/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-acceptance-e2e.test.js.attempt-1.log`
- `unit-acceptance-e2e.test.js.log`
- `unit-acceptance-e2e.test.js.summary.json`
- `unit-acceptance-e2e.test.js.test-names.json`

**备注**：

- 规划逐字验收句（857 行）由 acceptance-e2e.test.js 在真实 Tauri 壳 + mock 宿主 + 真实 core/daemon 下跑完三段；不接真实 DSH。

### AC-27 · 只读与本地性：不写实例、只绑回环、无凭据拒绝

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 安全 / 边界 ｜ **取证时刻**：2026-11-14T05:03:10.049Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-27/requirement.json` 与 `probe/acc10-f-parts/AC-27.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-27/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/readonly-local.test.js && NODE_ENV=test node --test test/wp13/readonly-local.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "saveState\|instance-store\|appendSpan" src/daemon/http/` → exit 1（期望 1） ✅
- `grep -REn "startRun" src/daemon/http/` → exit 0（期望 留证不判） ✅
- `grep -REn "0[.]0[.]0[.]0" src/daemon/http/` → exit 1（期望 留证不判） ✅

**证据清单**（11 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-27/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-3.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-readonly-local.test.js.attempt-1.log`
- `unit-readonly-local.test.js.log`
- `unit-readonly-local.test.js.summary.json`
- `unit-readonly-local.test.js.test-names.json`

### AC-28 · 非功能：零依赖、中文唯一来源、纯净扫描、无宿主分支

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：非功能 / 架构 ｜ **取证时刻**：2026-11-14T05:03:13.656Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-28/requirement.json` 与 `probe/acc10-f-parts/AC-28.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-28/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/labels-desktop.test.js && NODE_ENV=test node --test test/wp13/labels-desktop.test.js` → exit 0，# pass 25 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"` → exit 0（期望 0） ✅
- `node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid "task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"` → exit 0（期望 0） ✅
- `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` → exit 0（期望 0） ✅
- `grep -REn "[一-龥]" desktop/ui/ desktop/harness/` → exit 1（期望 1） ✅

**证据清单**（12 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-28/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-3.log`
- `arch-4.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-labels-desktop.test.js.attempt-1.log`
- `unit-labels-desktop.test.js.log`
- `unit-labels-desktop.test.js.summary.json`
- `unit-labels-desktop.test.js.test-names.json`

### AC-29 · 开箱即用：没有预装运行时的机器上双击就能用

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：非功能 / 开箱即用 ｜ **取证时刻**：2026-11-14T05:03:15.320Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-29/requirement.json` 与 `probe/acc10-f-parts/AC-29.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-29/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/bundle.test.js && NODE_ENV=test node --test test/wp13/bundle.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn 'env::var\("PATH"\)\|Command::new\("node"\)' desktop/src-tauri/src/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-29/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-bundle.test.js.attempt-1.log`
- `unit-bundle.test.js.log`
- `unit-bundle.test.js.summary.json`
- `unit-bundle.test.js.test-names.json`

**备注**：

- env -i PATH=/usr/bin:/bin 等价夹具；判定不检查包内目录结构（附录 D-14）。

### AC-30 · 六种异常提示：实例不存在、定义不可读、角色数未知、守护进程未启动、重连中、状态不可读

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 异常 ｜ **取证时刻**：2026-11-14T05:03:46.828Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-30/requirement.json` 与 `probe/acc10-f-parts/AC-30.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-30/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/errors.test.js && NODE_ENV=test node --test test/wp13/errors.test.js` → exit 0，# pass 24 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "[一-龥]" desktop/ui/` → exit 1（期望 1） ✅
- `grep -REn "fallback\|内置模板" src/daemon/graph.js` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-30/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-errors.test.js.attempt-1.log`
- `unit-errors.test.js.log`
- `unit-errors.test.js.summary.json`
- `unit-errors.test.js.test-names.json`

### AC-31 · 项目未指定 / 项目不可用：停在提示页，填入可用目录后进入列表

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 异常 / 首次体验 ｜ **取证时刻**：2026-11-14T05:03:49.485Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-31/requirement.json` 与 `probe/acc10-f-parts/AC-31.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-31/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/project-guard.test.js && NODE_ENV=test node --test test/wp13/project-guard.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "项目 未指定\|项目 不可用" desktop/ui desktop/harness` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-31/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-project-guard.test.js.attempt-1.log`
- `unit-project-guard.test.js.log`
- `unit-project-guard.test.js.summary.json`
- `unit-project-guard.test.js.test-names.json`

### AC-32 · 健康度悬停原因逐字复用 I1.9 八类，无原因只显「健康度 正常」

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 文案基线 ｜ **取证时刻**：2026-11-14T05:04:00.148Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-32/requirement.json` 与 `probe/acc10-f-parts/AC-32.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-32/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/health-hover.test.js && NODE_ENV=test node --test test/wp13/health-hover.test.js` → exit 0，# pass 4 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "P90\|TTL\|崩溃" desktop/ui/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-32/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-health-hover.test.js.attempt-1.log`
- `unit-health-hover.test.js.log`
- `unit-health-hover.test.js.summary.json`
- `unit-health-hover.test.js.test-names.json`

### AC-33 · 悬停高亮：角色节点上下游与连接线两端

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 交互 ｜ **取证时刻**：2026-11-14T05:04:00.996Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-33/requirement.json` 与 `probe/acc10-f-parts/AC-33.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-33/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/hover-highlight.test.js && NODE_ENV=test node --test test/wp13/hover-highlight.test.js` → exit 0，# pass 5 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "Math[.]" desktop/ui/graph/highlight.js` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-33/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-hover-highlight.test.js.attempt-1.log`
- `unit-hover-highlight.test.js.log`
- `unit-hover-highlight.test.js.summary.json`
- `unit-hover-highlight.test.js.test-names.json`

### AC-34 · 图例固定在画布左下角，缩放平移不改锚点

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 视觉 ｜ **取证时刻**：2026-11-14T05:04:01.707Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-34/requirement.json` 与 `probe/acc10-f-parts/AC-34.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-34/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/legend.test.js && NODE_ENV=test node --test test/wp13/legend.test.js` → exit 0，# pass 4 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "Date[.]now\|fs[.]" desktop/ui/graph/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-34/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-legend.test.js.attempt-1.log`
- `unit-legend.test.js.log`
- `unit-legend.test.js.summary.json`
- `unit-legend.test.js.test-names.json`

### AC-35 · 看板未知状态落「被阻塞」并标注「状态未知」

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 边界 ｜ **取证时刻**：2026-11-14T05:04:02.471Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-35/requirement.json` 与 `probe/acc10-f-parts/AC-35.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-35/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/board-unknown.test.js && NODE_ENV=test node --test test/wp13/board-unknown.test.js` → exit 0，# pass 3 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "default\|未知" desktop/ui/board/board.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-35/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-board-unknown.test.js.attempt-1.log`
- `unit-board-unknown.test.js.log`
- `unit-board-unknown.test.js.summary.json`
- `unit-board-unknown.test.js.test-names.json`

### AC-36 · 重复双击单实例，托盘「打开主窗口」激活已有窗口

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 桌面壳 ｜ **取证时刻**：2026-11-14T05:04:03.383Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-36/requirement.json` 与 `probe/acc10-f-parts/AC-36.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-36/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/single-instance.test.js && NODE_ENV=test node --test test/wp13/single-instance.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "SingleInstance\|single_instance\|activate" desktop/src-tauri/src/` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-36/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-single-instance.test.js.attempt-1.log`
- `unit-single-instance.test.js.log`
- `unit-single-instance.test.js.summary.json`
- `unit-single-instance.test.js.test-names.json`

### AC-37 · 角色与连接线同时变化互不阻塞、都不丢

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 节流 / 实时 ｜ **取证时刻**：2026-11-14T05:04:09.724Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-37/requirement.json` 与 `probe/acc10-f-parts/AC-37.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-37/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-parallel.test.js && NODE_ENV=test node --test test/wp13/graph-parallel.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "now" src/daemon/http/stream.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-37/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-parallel.test.js.attempt-1.log`
- `unit-graph-parallel.test.js.log`
- `unit-graph-parallel.test.js.summary.json`
- `unit-graph-parallel.test.js.test-names.json`


## ④ 结论口径

- **证据三档**：`mock 实测`（B 类：mock 宿主 + 真实 core/daemon）/ `mock 实测（结构断言）`（R-12 的 AC-22）/ `阻塞`。真实 DSH 取证属本机保留项，不在本迭代判定。
- **逐字边界**：Then 不放宽、不合并、不改写；逐字断言由同名契约测试文件承载（拆分文档 §4），S3 以 F-16 机检 + 架构检查做独立复核。
- **命令形态**：所有机检先 `test -f` 再单文件 `--test`，禁全量 glob 代替（文件缺失会假通过）。
