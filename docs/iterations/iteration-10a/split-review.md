# I1.10a 拆分与契约独立评审（split-review）

- 评审对象：`docs/iterations/iteration-10a.md`（r1，606 行，9 WP / 5 批次）
- 判据：`docs/templates/execution-template.md` §1.1~§1.6、`requirement.md` v2（37 AC / 32 BR，附录 A~D）、`requirement-understanding.md`（§5 / §9）、`decisions.md`（裁决 A~D + 核查记录）、`review-round2.md`（F-15~F-19）
- 评审人立场：独立只读评审；不采信拆分文档自述数字，全部机械复跑；不重做选型，只核选型论证与既定裁决的一致性

---

## §0 总判

**FAIL** — 阻断 **3** 项 / 建议 **5** 项（见 §6）。

3 个阻断全部集中在「依赖 DAG / import 图 / 批次时序」的一致性上（模板 §1.4 规则 2「依赖成 DAG、每个包可独立验收」+ 评审任务书 C⑤「import 图与 WP 依赖 DAG 不矛盾」）：结构、AC 覆盖、文件零交集、授权边界、裁决落地、数据模型六个维度全部 PASS，阻断修完即可转 PASS，无需重拆。

### 复核方式（自己实跑的脚本与输出）

机械核验用 Python 正则解析 + DFS，未采信文档附录自检的任何数字。关键输出摘要（完整命令为临时 heredoc 脚本，未落盘）：

```
== 负责文件计数（按 §4 各 WP「负责文件」行反引号路径）==
WP-1:16 WP-2:8 WP-3:9 WP-4:声称4 实列5 <<<  WP-5:12 WP-6:12 WP-7:3 WP-8:4 WP-9:3
合计 72 | 去重 72 | 重叠: 无
触碰不得修改清单(src/core|main.js|render.js|persistence|templates|registry): 无
既有被改文件恰为 D-10 点名 4 件: server.js / serve-entry.js / labels.js / package.json ✅
新增 src/ 文件恰为 D-10 授权 5 件: graph.js + http/{server,routes,stream,labels}.js ✅

== AC 覆盖 ==
需求 AC 37 (01..37 连续) | 拆分映射表 37 行 | 缺号: 无 | 多号: 无
机检测试文件未落「主责∪协作」WP 清单: 无
（AC-14 的 graph-layout.test.js 落协作 WP-5、AC-28 的 labels-desktop.test.js 落协作 WP-7，均合法）

== 依赖 DAG（剔除行内括号注释后解析「依赖」行）==
WP-1:[] WP-2:[4] WP-3:[2,4,7] WP-4:[] WP-5:[4,7] WP-6:[4,5,7] WP-7:[] WP-8:[1,2,3,5,6,7] WP-9:[1..8]
依赖编号全部存在: true | 环: 无
批次: 1{7,4} 2{1,2} 3{3,5} 4{6,8} 5{9} | 每批 ≤2 ✅
批次时序违反: WP-8(批4) 依赖 WP-6(批4 同批)  <<<

== import 图 vs DAG（拆分文档 §2 白纸黑字的「被谁 import」）==
http/server.js(WP-2) --import--> routes.js(WP-3): DAG 缺 2→3 边 <<<
http/server.js(WP-2) --import--> src/daemon/http/labels.js(WP-7): DAG 缺 2→7 边 <<<
graph-dump.mjs(WP-4) --import--> legend.js(WP-5) / highlight.js(WP-6): DAG 缺 4→5、4→6 边 <<<
```

F-15 复核（requirement.md 未提交、目录整体 untracked，无法 `git diff`，按评审任务书改用登记 + 逐行抽查）：

```
sed -n '331p' requirement.md → 「> **判定口径（五条，所有 AC 适用）**：」 ✅
grep -n "判定口径（三条" → 零命中（无残留） ✅
抽查 round2 引用的 v2 行号锚点（817-820 A-1 四行 / 1100-1101 附录 C / 1228 D-11「无」/ 1233-1235 D-12 / 1249 D-14）全部与现文一致 → v2 正文除 331 行计数外未观测到其它改动
```

代码事实核对（只读，逐项与拆分文档 §2.5「代码现状核对结论」比对）：

```
src/daemon/server.js   createServer({root, orchestrator, bus, generation, pipeName, logger, clock, exitOnStop})  → 现无 http 参数，与 D-10「只新增可选参数」相符 ✅
src/daemon/serve-entry.js  parseArgs 对「-- 后无值」置 true → 可承接布尔旗标 --desktop；:51 createServer({root, orchestrator, bus, generation}) ✅
src/persistence/paths.js   grep desktop → 零命中（无 desktop.json/views 路径函数，冻结不改成立） ✅
src/cli/labels.js          882 行；:552 WORKFLOW_NODE_TYPE_INVALID 四类 node_type 合法；:183 USAGE_LINES；grep DESKTOP_ → 0（待 WP-7 末尾追加） ✅
src/cli/main.js            :68 COMMANDS(7 命令) / :206-207 RUNTIME_SUBS core:['stop'] / :333 coreCommand 只认 stop ✅
package.json               无 dependencies/devDependencies，scripts 仅 test → D-10「只追加 scripts.desktop:*」口径成立 ✅
```

---

## §1 结构合规

| 判据 | 判定 | 依据 |
|---|---|---|
| A① 8 节（0~8）齐全、顺序正确 | **PASS** | 实扫 `^##` 标题：0 定位 / 1 选型 / 2 模块 / 3 数据模型 / 4 工作包 / 5 交付物 / 6 依赖 / 7 风险 / 8 对齐，节号顺序与模板 §1.3 一致 |
| A① WP 五字段齐备 | **PASS** | WP-1~WP-9 每段均含 负责文件（k）/ 依赖 / 交付 / 验收口径 / 可否并行 五条 |
| A① §4 末尾 AC → WP 满覆盖映射表 | **PASS** | 存在且 37 行（见 §2） |
| A② §1.5 自检逐条勾、结论真实（抽 3 条复跑） | **PASS（含 1 处数字失真，见 S-04）** | 自检 2（AC 覆盖）：复跑 37/37 属实；自检 4（零交集）：重叠 0 属实，但「71 个登记文件」与实点 72 不符（见 S-04）；自检 5（DAG 无环）：复跑无环属实 |

---

## §2 AC → WP 覆盖核对表（37 行）

逐条核对口径：需求 v2 同号 AC 存在、Then 可由该 WP 契约测试判定、机检点名的测试文件落在该 AC 的主责∪协作 WP 负责文件清单内。

| AC | 主责 WP | 契约测试文件（需求机检点名） | 文件在 WP 清单 | 判定 |
|---|---|---|---|---|
| AC-01 | WP-1 | desktop-shell.test.js | WP-1 | PASS |
| AC-02 | WP-1 | desktop-shell.test.js | WP-1 | PASS |
| AC-03 | WP-3 | instance-list.test.js | WP-3 | PASS |
| AC-04 | WP-3 | instance-list.test.js | WP-3 | PASS |
| AC-05 | WP-3 | new-instance.test.js | WP-3 | PASS |
| AC-06 | WP-3 | new-instance.test.js | WP-3 | PASS |
| AC-07 | WP-4 | graph-projection.test.js | WP-4 | PASS |
| AC-08 | WP-2 | graph-stream.test.js | WP-2 | PASS |
| AC-09 | WP-2 | graph-throttle.test.js | WP-2 | PASS |
| AC-10 | WP-2 | graph-throttle.test.js | WP-2 | PASS |
| AC-11 | WP-6 | role-node.test.js | WP-6 | PASS |
| AC-12 | WP-6 | role-node.test.js | WP-6 | PASS |
| AC-13 | WP-6 | special-node.test.js | WP-6 | PASS |
| AC-14 | WP-4 | graph-projection.test.js（WP-4）+ graph-layout.test.js（协作 WP-5） | 两处均在 | PASS |
| AC-15 | WP-4 | edge-visual.test.js | WP-4 | PASS |
| AC-16 | WP-4 | edge-aggregate.test.js | WP-4 | PASS |
| AC-17 | WP-5 | graph-layout.test.js | WP-5 | PASS |
| AC-18 | WP-5 | graph-layout.test.js | WP-5 | PASS |
| AC-19 | WP-6 | graph-collapse.test.js | WP-6 | PASS |
| AC-20 | WP-5 | view-state.test.js | WP-5 | PASS |
| AC-21 | WP-5 | focus-mode.test.js | WP-5 | PASS |
| AC-22 | WP-5 | view-state.test.js | WP-5 | PASS |
| AC-23 | WP-6 | abnormal-style.test.js | WP-6 | PASS |
| AC-24 | WP-5 | board.test.js | WP-5 | PASS |
| AC-25 | WP-6 | labels-policy.test.js | WP-6 | PASS |
| AC-26 | WP-9 | acceptance-e2e.test.js | WP-9 | PASS |
| AC-27 | WP-9 | readonly-local.test.js | WP-9 | PASS |
| AC-28 | WP-9 | labels-desktop.test.js（协作 WP-7）+ 静态检查 | 两处均在 | PASS |
| AC-29 | WP-1 | bundle.test.js | WP-1 | PASS |
| AC-30 | WP-8 | errors.test.js | WP-8 | PASS |
| AC-31 | WP-1 | project-guard.test.js | WP-1 | PASS |
| AC-32 | WP-3 | health-hover.test.js | WP-3 | PASS |
| AC-33 | WP-6 | hover-highlight.test.js | WP-6 | PASS |
| AC-34 | WP-5 | legend.test.js | WP-5 | PASS |
| AC-35 | WP-5 | board-unknown.test.js | WP-5 | PASS |
| AC-36 | WP-1 | single-instance.test.js | WP-1 | PASS |
| AC-37 | WP-2 | graph-parallel.test.js | WP-2 | PASS |

**结论：37/37 全 PASS，无缺号、无重号、无「顺手塞」**（映射表每行恰一个主责 WP；WP-7 无主责 AC 属合法——模板 §1.4 规则 4 约束的是每条 AC 有主责，不是每个 WP 有主责；WP-7 承担文案协作面，与 I1.9 WP-4 先例一致）。反向抽查：37 条 AC 的机检文件全部真实存在于某 WP 负责清单（去重后 30 个测试文件 + regression/http-channel 补齐为 31 个，与文档声称一致）。

---

## §3 文件契约核对

| 判据 | 判定 | 依据 |
|---|---|---|
| C① 71 文件零交集 | **PASS（计数有瑕疵，见 S-04）** | 自跑脚本：逐包实点合计 **72**（声称 71）、去重 72、重叠 0。零交集结论成立；总数与 WP-4 括号计数失真 |
| C② 新文件与 D-10 授权清单一致、无清单外 `src/**` 修改 | **PASS（1 处待登记，见 S-06）** | 既有被改 4 文件恰为 D-10 点名；新增 `src/**` 恰为 D-10 授权 5 件（graph.js + http/4 件）；`scripts/desktop/build.mjs` 是 D-1/D-6 要求的必然产物但不在 D-10「新增文件」清单，建议在 §8.5 登记一句 |
| C③「不得修改」清单零触碰 | **PASS** | 负责文件与 src/core/**、main.js、render.js、persistence/**、templates/**、registry/** 交集为空；§2.5 只读基线重申一致 |
| C④ 测试目录 `test/wp13/` 与 D-9 一致、既有测试零改动 | **PASS** | 31 个测试文件全部位于 `test/wp13/`；负责清单无任何既有 `test/**` 文件 |
| C⑤ import 图与 DAG 一致 | **FAIL → 阻断 S-02 / S-03** | 拆分文档 §2 白纸黑字声称 4 处跨包 import，DAG 均无对应边：①`http/server.js`(WP-2) import `routes.js`(WP-3)；②`http/server.js`(WP-2) import `src/daemon/http/labels.js`(WP-7)；③`graph-dump.mjs`(WP-4) import `legend.js`(WP-5) 与 `highlight.js`(WP-6)。其余跨包 import（app.js→WP-3/5/6、routes.js→graph.js、harness→同包模块）与 DAG 一致 |

---

## §4 选型与既定裁决核对

| 判据 | 判定 | 依据 |
|---|---|---|
| D① Tauri 2.x + 可选项 B（bundle 内 node 二进制）与裁决 B 一致、WP-1 先行验证包 | **PASS（口径差见 S-08）** | §1.1 否决可选项 A 的理由与 AC-29 行为判据、架构检查逐字对得上；WP-1 内部第一步 = 最短打包验证 + `wp1-bundle-verdict.md` 一页结论；两条路径都失败 → 回需求修订（§7 风险 1），「不许实现里悄悄消化」字面落实。decisions.md 写「S1 拆分前」做验证，拆分文档重排为「WP-1 第一步」——D-14「若打包可行性阻塞拆分，先做一次最短打包验证再回填拆分文档」支持该弹性，建议 §8.1 注明（S-08） |
| D② 裁决 A（`serve-entry.js --desktop` 入口）字面落实 | **PASS** | §1.1 启动协议、§2.1 `serve-entry.js`/`server.js` 契约（只加 `--desktop` 透传与 `http` 可选参数）、§2.3 `spawn.rs`（包内 node 绝对路径 + `--desktop`）、§8.1 裁决 A 行、C-01 五方一致；`main.js` 零改动、不新增 CLI 子命令；源码核实 `createServer` 现无 `http` 参数、「只新增可选参数」口径成立 |
| D③ 裁决 C（不落盘 `graph.json`）在 §3 成立 | **PASS** | §3 开头「唯一事实来源」声明 + §1.2 被否决项；§3 新增落盘面恰为 desktop.json / views / projects.json 三处，与需求 §1.3、U-9、裁决 C 一致 |
| D④ F-15 已修且仅此一处 | **PASS** | 331 行已是「五条」；全文无「判定口径（三条」残留；因文件 untracked 不可 `git diff`，按逐行抽查 round2 引用的 v2 锚点（817-820 / 1100-1101 / 1228 / 1233-1235 / 1249）全部与现文一致；§8.2 已登记变更记录 |
| D⑤ F-16 在 §8 有落点且落到具体 WP/测试文件 | **PASS** | §4 机检模板 + §5 `probe/acc10-*` 脚手架规格均为 `test -f test/wp13/<file>.test.js && NODE_ENV=test node --test ...` + `# pass ≥ 1`、`# fail 0`、禁全量 glob；§8.2 逐条登记 |
| D⑥ F-17 落点 | **PASS** | WP-8 `connection.js` 显式 `connecting` 态（A-4 第一态文案键）+ `errors.test.js` 守护进程分支中间断言（未就绪期出现「正在连接守护进程…」、超 10 秒转失败句）；§8.2 登记 |
| D⑦ F-18 落点 | **PASS** | WP-3 `instance-list.test.js` 阶段四：pulse（kind: role）推进既有实例状态 → 断言 2 秒内该行更新、`instances.changed` 触发（`refetch ≥ 1`）、无周期轮询 |
| D⑧ F-19 落点 | **PASS** | WP-6 `hover-highlight.test.js` 夹具加与 B 不相邻的节点 E 与边 C→E，断言悬停 B 时 E 与 C→E 降不透明度（可裁决）；§7 风险 9 同步 |
| D⑨ 夹具禁 `open -na`（纪要黄色警示 1） | **PASS** | §1.3 末条 / WP-1 夹具规范 / §7 风险 2 / §8.4 四处统一为直接执行 `Contents/MacOS/maestro`；AC-01/26/29/31/36 全部归属 WP-1，验收口径按直接执行口径写；与需求夹具行的 `open -na` 字样差异按理解纪要 §5.1-1「不缺接缝、不改判定强度」处置正确 |
| D⑩ bundle 内二进制直启写进 AC-01/26/29/31/36 相关 WP | **PASS** | WP-1 验收口径逐条含这五条 AC 的直接执行判定（AC-29 `env -i` 下直接执行二进制） |

---

## §5 数据模型与回归口径

| 判据 | 判定 | 依据 |
|---|---|---|
| E① §3 样例与需求 D-1/D-9 字段一致 | **PASS** | `desktop.json` 五字段 `{port,token,pid,generation,startedAt}` = D-1；views `{offsets,updatedAt}` = D-4 拖拽段；`projects.json` = §1.3 登记口径；pulse 请求体 `{instanceId,kind,key,count,intervalMs,statuses[]}` = D-9；夹具 yaml 四类 `node_type` + `kind: backflow` 边 = D-9/AC-07/14；节点/边字段全表 = D-2；registry 四类 `node_type` 合法性有 decisions.md 核查记录背书（labels.js:552 实核一致） |
| E② `<基线>` = 1157 / 8 已知失败 / 差集 0 写进 §0 | **PASS** | 退出标准 2 + 门禁块注释，口径为「失败集合差集 = 0、条数只增不减」，与 decisions.md 基线记录一致（非绝对全绿） |
| E③ 门禁四件套每 WP 齐全、31 词全表显式 `--forbid` | **PASS** | §4 统一门禁块（全量测试/两轮扫描/零依赖/主链+壳冒烟）+ 各 WP「门禁附加」；`FORBID` 词表实数 31 词，与 requirement.md D-7 逐词一致 |
| E④ 批次 DAG 无环、批次内并行 ≤2 | **PASS（批次时序另有阻断 S-01）** | DFS 判环：无环；5 批各 ≤2；批次 0 契约冻结不占 Agent 名额 |
| E⑤ WP-1 失败降级路径明确 | **PASS** | §7 风险 1 + §1.1：两条打包路径都失败 → 按裁决 B 回需求修订，不在实现里消化 |

---

## §6 修复清单

| 编号 | 位置 | 原文要点 | 违反哪条 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| **S-01** | §6 批次表第 4 批 vs WP-8 条目 | 第 4 批「WP-6 + WP-8（2 并行）」，但 WP-8 依赖 WP-6 且自述「可否并行：否 —— 汇集六个上游包的模块做装配，须在其契约合入后单线开发」 | 模板 §2.3「相互独立才并行」+ §1.4 规则 2；批次表与 DAG 边 6→8、与 WP-8 自述三方矛盾，按批派单时 WP-8 无法开工 | 二选一：① 批次改 5 批为 6 批——第 4 批 WP-6 单线、第 5 批 WP-8 单线、WP-9 顺延第 6 批；② 保留并行但在 §6 增补冻结点「§2.2 六个装配消费模块的导出签名即冻结契约」并把 WP-8「可否并行」改为「可（仅依赖冻结签名）」——不得两处自相矛盾 | **阻断** |
| **S-02** | §2.1 `http/server.js` 契约 vs §6 DAG | `http/server.js`(WP-2)「路由分派给 routes.js（REST）」「注册 GET /ui/labels（转发 labels.js）」即 import WP-3 与 WP-7 的文件；DAG 只有 3→2，无 2→3 / 2→7 | 评审任务书 C⑤「WP-x 的文件 import WP-y 的文件，DAG 必须有 x→y」+ 模板 §1.4 规则 2；批次 2 合入 WP-2 时 routes.js（批次 3）不存在，普通静态 import 会使第 2 批整合检查点的桌面壳冒烟无法通过 | 在 §2.1 `http/server.js` 契约显式声明容缺接缝（routes 缺失时静态资源 / `/ui/labels` / desktop.json 生命周期仍可用，REST 路由惰性注册或经注入式分派），并在 §6 把 2→7 补进依赖边（WP-2 依赖 WP-4 + WP-7）；或把 routes.js 划归 WP-2 | **阻断** |
| **S-03** | §2.4 `graph-dump.mjs`（WP-4）vs §6 DAG / WP-4 叶子声称 | `graph-dump.mjs` 交付描述「import 界面同批模块对图 payload 出节点/边/**图例/不透明度集合**」——图例 = `legend.js`(WP-5)、不透明度集合 = `highlight.js`(WP-6)；AC-07 的 Then 含「图例两行逐字 A-8」 | 同 C⑤ + 规则 2：WP-4 声称「DAG 叶子、批次 1 可独立验收」，但其机检通道依赖批次 3/4 才存在的模块，AC-07 图例断言在批次 1 不可判 | 把 graph-dump.mjs 的图例/悬停导出声明为「分阶段交付：批次 1 只出节点/边导出（图例段容缺为 null），批次 4 补齐」；或把 graph-dump.mjs 移归 WP-5（与 layout-dump/board-dump 同批）并同步 §5 交付物清单与 WP-4/WP-5 文件计数 | **阻断** |
| S-04 | §4 WP-4 负责文件括号、§5 交付物表、附录自检第 4 条 | WP-4「负责文件（4）」实列 5（含 graph-dump.mjs）；§5「desktop/src-tauri/**（10 文件）」实列 9 个文件名；附录自检「71 个登记文件」与逐包实点 72 不符 | §1.5 自检第 4 条结论真实性（计数口径） | 三处计数改为实数（72；src-tauri 9 文件）；如「71」另有意口径（如不计 verdict.md）请注明口径 | 建议 |
| S-05 | §2.2 `app.js` | 「被 `index.html`（bundle 资源）加载」，但 `desktop/ui/index.html` 未出现在任何 WP 负责文件清单（§1.5 自检第 7 条） | 模板 §1.5 检查 7「§2 每个文件都标注了归属 WP」 | 把 index.html 登记进 WP-8 负责文件（或 WP-1 的 tauri.conf.json 资源段）并计入 §5 清单 | 建议 |
| S-06 | §2.3 `scripts/desktop/build.mjs` | 该文件是 D-1/D-6/退出标准 6 的必然产物，但不在 requirement.md 附录 D-10「新增文件」授权清单 | D-10 清单穷尽性（需求侧缺口，非拆分越界——不在 `src/**` 下） | 在 §8.5 冲突表增一行：C-08「D-10 新增清单未列 scripts/desktop/build.mjs」，注明依据 D-1/D-6 并视为授权 | 建议 |
| S-07 | AC-19 夹具（§3.7 / WP-6） | 夹具 `.orch/roles/*.yaml` 直写 13 角色（8+5）供折叠 AC；理解纪要 §5.2 AC-19 要求「拆分需实测一次注册表读盘对角色文件的可读性」，拆分文档未登记该实测或风险条目 | 纪要 §5.1-2 同类黄色警示的处置先例 | 在 §7 风险表或 §8.4 补一条：WP-6 开工前实测 `.orch/roles/*.yaml` 直写能否被 `buildRoleInstances` 读出，不可读则按 §1.2 走需求修订 | 建议 |
| S-08 | §8.1 裁决 B 行 | decisions.md 裁决 B 影响面写「S1 拆分前必须先做最短打包验证」，拆分文档落为「WP-1 第一步（实现期先行）」 | 与 decisions.md 字面口径有差（D-14「若打包可行性阻塞拆分，先做…再回填」支持现做法） | 在 §8.1 裁决 B 行补一句重排依据（引 D-14 末段），避免后续审计误判为未执行裁决 | 建议 |

---

## §7 结论

- 37 条 AC 覆盖、文件零交集、授权边界、D-10/D-11 红线、裁决 A~D 落地、F-15~F-19 落点、夹具禁令、数据模型与回归口径全部 PASS；代码现状核对（server.js / serve-entry.js / paths.js / labels.js / main.js / package.json / registry）与拆分文档 §2.5 声称逐项一致。
- 3 个阻断均为「文档内部一致性」问题，修法明确且不动需求正文、不重拆结构：S-01 改批次或补冻结声明；S-02 补容缺接缝 + 依赖边；S-03 拆分 graph-dump 交付阶段或移动归属。
- **S2 开工前还差的一件事**：拆分文档按 §6 S-01~S-03 修订出 r2 并复核通过——特别是批次 4 的 WP-6/WP-8 时序矛盾必须先消除，否则第 4 批派单即卡死；同时 S-02 的容缺接缝决定第 2 批整合检查点（桌面壳冒烟）能否跑通，必须在 WP-2 任务书定稿前写进契约。
