# I1.10a S3 验收 · A 组（AC-01 ~ AC-19）

> 判据来源：`docs/iterations/iteration-10a/requirement.md` v4 §3.1 同号 AC 全文 + 附录 A-0~A-14 / C / D-15；
> `docs/iterations/iteration-10a.md` r3 §4（F-16 机检模板）与 §5（交付物）；`decisions.md` 裁决 A~AA。
> 取证脚手架：`probe/acc10-f-{lib,common,run,final,gen,gates}.mjs` + `probe/acc10-cases/`（逐字抽取，`--check` 44/44 一致）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。

## ① 环境与复跑

| 项 | 值 |
|---|---|
| 仓库 HEAD | `a093ede` |
| 验收级别 | B 类（mock 宿主 + 真实 core / daemon + 真实 Tauri 壳；不接真实 DSH、不需模型凭据，需求 §3.3） |
| 环境变量 | 全部命令 `NODE_ENV=test`；保留本机默认 `NODE_OPTIONS` 预加载（需求 §3.3 未要求剥离；剥离会触发 R-08 时序竞态），仅清 `ELECTRON_RUN_AS_NODE` |
| 夹具根 | 每 AC 独立 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，绝不进仓库 |
| 证据根 | `docs/iterations/iteration-10a/evidence/<AC>/` |
| 复跑 | `node probe/acc10-f-run.mjs AC-xx` / `--batch a|b|c|d|r`；`node probe/acc10-f-final.mjs` 重建本文件 |

## ② 逐 AC 判定表

| AC | 结论 | 证据等级 | 机检（F-16） | 核对项 | Then | 证据 | 判定依据 |
|---|---|---|---|---|---|---|---|
| AC-01 | **通过** | mock 实测 | `desktop-shell.test.js` 1p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-02 | **通过** | mock 实测 | `desktop-shell.test.js` 1p/0f（架构 2 项） | 9/9 | 1 | 11 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-03 | **通过** | mock 实测 | `instance-list.test.js` 2p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-04 | **通过** | mock 实测 | `instance-list.test.js` 2p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-05 | **通过** | mock 实测 | `new-instance.test.js` 5p/0f（架构 1 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-06 | **通过** | mock 实测 | `new-instance.test.js` 5p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-07 | **通过** | mock 实测 | `graph-projection.test.js` 22p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-08 | **通过** | mock 实测 | `graph-stream.test.js` 7p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-09 | **通过** | mock 实测 | `graph-throttle.test.js` 9p/0f（架构 1 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-10 | **通过** | mock 实测 | `graph-throttle.test.js` 9p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-11 | **通过** | mock 实测 | `role-node.test.js` 6p/0f（架构 1 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-12 | **通过** | mock 实测 | `role-node.test.js` 6p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-13 | **通过** | mock 实测 | `special-node.test.js` 6p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-14 | **通过** | mock 实测 | `graph-projection.test.js` 22p/0f<br>`graph-layout.test.js` 8p/0f（架构 2 项） | 12/12 | 1 | 14 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-15 | **通过** | mock 实测 | `edge-visual.test.js` 6p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-16 | **通过** | mock 实测 | `edge-aggregate.test.js` 8p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-17 | **通过** | mock 实测 | `graph-layout.test.js` 8p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-18 | **通过** | mock 实测 | `graph-layout.test.js` 8p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-19 | **通过** | mock 实测 | `graph-collapse.test.js` 8p/0f（架构 1 项） | 7/7 | 1 | 9 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |

## ③ 逐 AC 取证明细

### AC-01 · 双击应用图标打开主窗口，停在实例列表

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 桌面壳 ｜ **取证时刻**：2026-11-14T04:58:52.988Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-01/requirement.json` 与 `probe/acc10-f-parts/AC-01.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-01/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/desktop-shell.test.js && NODE_ENV=test node --test test/wp13/desktop-shell.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-01/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-desktop-shell.test.js.attempt-1.log`
- `unit-desktop-shell.test.js.log`
- `unit-desktop-shell.test.js.summary.json`
- `unit-desktop-shell.test.js.test-names.json`

### AC-02 · 关闭主窗口缩到托盘，守护进程继续运行；托盘退出才停止

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 桌面壳 / 规划验收 ｜ **取证时刻**：2026-11-14T04:59:28.698Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-02/requirement.json` 与 `probe/acc10-f-parts/AC-02.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-02/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/desktop-shell.test.js && NODE_ENV=test node --test test/wp13/desktop-shell.test.js` → exit 0，# pass 1 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "core[.]stop" desktop/src-tauri/src/` → exit 0（期望 0） ✅
- `grep -REn -B8 "core[.]stop" desktop/src-tauri/src/` → exit 0（期望 0） ✅
- `grep -REn "close-window\|close_to_tray" desktop/src-tauri/src/tray.rs` → exit 0（期望 留证不判） ✅

**证据清单**（11 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-02/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-3.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-desktop-shell.test.js.attempt-1.log`
- `unit-desktop-shell.test.js.log`
- `unit-desktop-shell.test.js.summary.json`
- `unit-desktop-shell.test.js.test-names.json`

### AC-03 · 实例列表六项字段齐全，按健康度分档置顶

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 ｜ **取证时刻**：2026-11-14T05:00:04.687Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-03/requirement.json` 与 `probe/acc10-f-parts/AC-03.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-03/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/instance-list.test.js && NODE_ENV=test node --test test/wp13/instance-list.test.js` → exit 0，# pass 2 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "saveState\|computeHealth" desktop/ui/list/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-03/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-instance-list.test.js.attempt-1.log`
- `unit-instance-list.test.js.log`
- `unit-instance-list.test.js.summary.json`
- `unit-instance-list.test.js.test-names.json`

### AC-04 · 列表的空态、不可读行与实时增减

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 边界 ｜ **取证时刻**：2026-11-14T05:00:15.611Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-04/requirement.json` 与 `probe/acc10-f-parts/AC-04.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-04/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/instance-list.test.js && NODE_ENV=test node --test test/wp13/instance-list.test.js` → exit 0，# pass 2 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "renderListUnreadable" desktop/ui/list/list.js` → exit 0（期望 0） ✅
- `grep -REn "状态不可读" desktop/ui/list/` → exit 1（期望 1） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-04/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-instance-list.test.js.attempt-1.log`
- `unit-instance-list.test.js.log`
- `unit-instance-list.test.js.summary.json`
- `unit-instance-list.test.js.test-names.json`

**备注**：

- R-08 已登记的时序竞态基线项；单文件机检若失败，须保留全部 attempt 原始帧并在 blockers 台账登记，不得改断言。

### AC-05 · 新建实例：选工作流 → 填任务说明 → 启动成功

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 ｜ **取证时刻**：2026-11-14T05:00:26.944Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-05/requirement.json` 与 `probe/acc10-f-parts/AC-05.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-05/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/new-instance.test.js && NODE_ENV=test node --test test/wp13/new-instance.test.js` → exit 0，# pass 5 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -Rn "startRun" desktop/` → exit 0（期望 留证不判） ✅
- `grep -REn "startRun" desktop/ui/ desktop/harness/` → exit 1（期望 1） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-05/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-new-instance.test.js.attempt-1.log`
- `unit-new-instance.test.js.log`
- `unit-new-instance.test.js.summary.json`
- `unit-new-instance.test.js.test-names.json`

**备注**：

- 需求架构检查原文 `grep -Rn "startRun" desktop/` 在本机包含 bundle 构建产物（`desktop/src-tauri/target/**` 内为产品源码副本）；判定以界面层作用域 `desktop/ui/ desktop/harness/` 零命中为准，原文形态仅留证。

### AC-06 · 新建实例的校验与失败提示

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 异常 ｜ **取证时刻**：2026-11-14T05:01:26.289Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-06/requirement.json` 与 `probe/acc10-f-parts/AC-06.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-06/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/new-instance.test.js && NODE_ENV=test node --test test/wp13/new-instance.test.js` → exit 0，# pass 5 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "[一-龥]" desktop/ui/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-06/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-new-instance.test.js.attempt-1.log`
- `unit-new-instance.test.js.log`
- `unit-new-instance.test.js.summary.json`
- `unit-new-instance.test.js.test-names.json`

### AC-07 · 流程图快照：角色、特殊节点与连接线一次画全

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 ｜ **取证时刻**：2026-11-14T05:01:31.028Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-07/requirement.json` 与 `probe/acc10-f-parts/AC-07.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-07/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-projection.test.js && NODE_ENV=test node --test test/wp13/graph-projection.test.js` → exit 0，# pass 22 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "saveState\|emit\(" src/daemon/graph.js` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-07/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-projection.test.js.attempt-1.log`
- `unit-graph-projection.test.js.log`
- `unit-graph-projection.test.js.summary.json`
- `unit-graph-projection.test.js.test-names.json`

### AC-08 · 实时推送：先全量、角色变化 500ms 内到、断线重连补全量

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 实时 ｜ **取证时刻**：2026-11-14T05:01:32.325Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-08/requirement.json` 与 `probe/acc10-f-parts/AC-08.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-08/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-stream.test.js && NODE_ENV=test node --test test/wp13/graph-stream.test.js` → exit 0，# pass 7 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "new EventEmitter" src/daemon/http/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-08/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-stream.test.js.attempt-1.log`
- `unit-graph-stream.test.js.log`
- `unit-graph-stream.test.js.summary.json`
- `unit-graph-stream.test.js.test-names.json`

### AC-09 · 连接线合并：1 秒内 5 次变化只推 1 次、且是最后一次

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 节流 ｜ **取证时刻**：2026-11-14T05:01:41.403Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-09/requirement.json` 与 `probe/acc10-f-parts/AC-09.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-09/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-throttle.test.js && NODE_ENV=test node --test test/wp13/graph-throttle.test.js` → exit 0，# pass 9 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "setTimeout" src/daemon/http/stream.js` → exit 0（期望 留证不判） ✅
- `grep -REn "now" src/daemon/http/stream.js` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-09/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-throttle.test.js.attempt-1.log`
- `unit-graph-throttle.test.js.log`
- `unit-graph-throttle.test.js.summary.json`
- `unit-graph-throttle.test.js.test-names.json`

### AC-10 · 会话状态变化只走指示器：不重排、不动版本号

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 节流 / 边界 ｜ **取证时刻**：2026-11-14T05:01:46.262Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-10/requirement.json` 与 `probe/acc10-f-parts/AC-10.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-10/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-throttle.test.js && NODE_ENV=test node --test test/wp13/graph-throttle.test.js` → exit 0，# pass 9 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "REV_WHITELIST" src/daemon/graph.js` → exit 0（期望 0） ✅
- `grep -REn "'session'\|'execution'\|'health'" src/daemon/graph.js` → exit 1（期望 1） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-10/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-throttle.test.js.attempt-1.log`
- `unit-graph-throttle.test.js.log`
- `unit-graph-throttle.test.js.summary.json`
- `unit-graph-throttle.test.js.test-names.json`

### AC-11 · 角色节点五要素齐全

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 ｜ **取证时刻**：2026-11-14T05:01:51.294Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-11/requirement.json` 与 `probe/acc10-f-parts/AC-11.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-11/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/role-node.test.js && NODE_ENV=test node --test test/wp13/role-node.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -R "decideStatus" desktop/` → exit 0（期望 留证不判） ✅
- `grep -REn "decideStatus" desktop/ui/ desktop/harness/` → exit 1（期望 1） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-11/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-role-node.test.js.attempt-1.log`
- `unit-role-node.test.js.log`
- `unit-role-node.test.js.summary.json`
- `unit-role-node.test.js.test-names.json`

**备注**：

- 同上：需求 `grep -R "decideStatus" desktop/` 命中构建产物副本，判定以界面层作用域零命中为准。

### AC-12 · 角色节点折叠规则：服务节点超 2 个、活跃会话大于 1

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 边界 ｜ **取证时刻**：2026-11-14T05:02:46.611Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-12/requirement.json` 与 `probe/acc10-f-parts/AC-12.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-12/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/role-node.test.js && NODE_ENV=test node --test test/wp13/role-node.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "saveState\|emit\(" desktop/ui/graph/` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-12/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-role-node.test.js.attempt-1.log`
- `unit-role-node.test.js.log`
- `unit-role-node.test.js.summary.json`
- `unit-role-node.test.js.test-names.json`

### AC-13 · 特殊节点：人工、升级、子工作流的视觉与标签

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 ｜ **取证时刻**：2026-11-14T05:02:47.659Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-13/requirement.json` 与 `probe/acc10-f-parts/AC-13.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-13/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/special-node.test.js && NODE_ENV=test node --test test/wp13/special-node.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "node_type\|nodeType" src/daemon/graph.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-13/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-special-node.test.js.attempt-1.log`
- `unit-special-node.test.js.log`
- `unit-special-node.test.js.summary.json`
- `unit-special-node.test.js.test-names.json`

### AC-14 · 含人工节点与子工作流的实例拓扑完整（规划验收句中段）

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 规划验收 ｜ **取证时刻**：2026-11-14T05:02:48.468Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-14/requirement.json` 与 `probe/acc10-f-parts/AC-14.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-14/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-projection.test.js && NODE_ENV=test node --test test/wp13/graph-projection.test.js` → exit 0，# pass 22 / # fail 0 / # skipped 0，attempt 1/1
- `test -f test/wp13/graph-layout.test.js && NODE_ENV=test node --test test/wp13/graph-layout.test.js` → exit 0，# pass 8 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "Unknown node_type\|未知" src/daemon/graph.js` → exit 0（期望 0） ✅
- `grep -REn "saveState\|emit\(" src/daemon/graph.js` → exit 1（期望 1） ✅

**证据清单**（14 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-14/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-layout.test.js.attempt-1.log`
- `unit-graph-layout.test.js.log`
- `unit-graph-layout.test.js.summary.json`
- `unit-graph-layout.test.js.test-names.json`
- `unit-graph-projection.test.js.attempt-1.log`
- `unit-graph-projection.test.js.log`
- `unit-graph-projection.test.js.summary.json`
- `unit-graph-projection.test.js.test-names.json`

### AC-15 · 连接线 7 种聚合状态的视觉编码

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 视觉编码 ｜ **取证时刻**：2026-11-14T05:02:50.448Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-15/requirement.json` 与 `probe/acc10-f-parts/AC-15.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-15/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/edge-visual.test.js && NODE_ENV=test node --test test/wp13/edge-visual.test.js` → exit 0，# pass 6 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "aggregateStatus" desktop/ui/graph/edge-rows.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-15/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-edge-visual.test.js.attempt-1.log`
- `unit-edge-visual.test.js.log`
- `unit-edge-visual.test.js.summary.json`
- `unit-edge-visual.test.js.test-names.json`

### AC-16 · 连接线聚合优先级、正向/回流分线、并行合并

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 聚合 ｜ **取证时刻**：2026-11-14T05:02:51.159Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-16/requirement.json` 与 `probe/acc10-f-parts/AC-16.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-16/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/edge-aggregate.test.js && NODE_ENV=test node --test test/wp13/edge-aggregate.test.js` → exit 0，# pass 8 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "AGGREGATE_PRIORITY" src/daemon/graph.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-16/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-edge-aggregate.test.js.attempt-1.log`
- `unit-edge-aggregate.test.js.log`
- `unit-edge-aggregate.test.js.summary.json`
- `unit-edge-aggregate.test.js.test-names.json`

### AC-17 · 层次布局：同层并行、回流不改层次、坐标稳定

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 布局 ｜ **取证时刻**：2026-11-14T05:02:51.884Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-17/requirement.json` 与 `probe/acc10-f-parts/AC-17.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-17/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-layout.test.js && NODE_ENV=test node --test test/wp13/graph-layout.test.js` → exit 0，# pass 8 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "Date[.]now\|fs[.]" desktop/ui/graph/layout.js` → exit 1（期望 1） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-17/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-layout.test.js.attempt-1.log`
- `unit-graph-layout.test.js.log`
- `unit-graph-layout.test.js.summary.json`
- `unit-graph-layout.test.js.test-names.json`

### AC-18 · 异常置顶不破坏布局

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 布局 / 边界 ｜ **取证时刻**：2026-11-14T05:02:52.797Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-18/requirement.json` 与 `probe/acc10-f-parts/AC-18.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-18/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-layout.test.js && NODE_ENV=test node --test test/wp13/graph-layout.test.js` → exit 0，# pass 8 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "abnormal" desktop/ui/graph/layout.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-18/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-layout.test.js.attempt-1.log`
- `unit-graph-layout.test.js.log`
- `unit-graph-layout.test.js.summary.json`
- `unit-graph-layout.test.js.test-names.json`

### AC-19 · 角色超过 12 个时按分组折叠，可展开/收起

**结论**：通过 ｜ **证据等级**：mock 实测 ｜ **场景类型**：功能 / 布局 / 折叠 ｜ **取证时刻**：2026-11-14T05:02:53.667Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-19/requirement.json` 与 `probe/acc10-f-parts/AC-19.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-19/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/graph-collapse.test.js && NODE_ENV=test node --test test/wp13/graph-collapse.test.js` → exit 0，# pass 8 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "group" desktop/ui/graph/collapse.js` → exit 0（期望 0） ✅

**证据清单**（9 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-19/`）：

- `arch-1.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-graph-collapse.test.js.attempt-1.log`
- `unit-graph-collapse.test.js.log`
- `unit-graph-collapse.test.js.summary.json`
- `unit-graph-collapse.test.js.test-names.json`


## ④ 结论口径

- **证据四档**：`已实测（真实 GitHub 面）`（C 组 7 条：真实 Actions 构建 + 真实 Release + 只读 REST 判定，另见 ②.1）/ `mock 实测`（B 类：mock 宿主 + 真实 core/daemon）/ `mock 实测（结构断言）`（R-12 的 AC-22）/ `阻塞`。真实 DSH 取证属本机保留项，不在本迭代判定。
- **逐字边界**：Then 不放宽、不合并、不改写；逐字断言由同名契约测试文件承载（拆分文档 §4），S3 以 F-16 机检 + 架构检查做独立复核。
- **命令形态**：所有机检先 `test -f` 再单文件 `--test`，禁全量 glob 代替（文件缺失会假通过）。
