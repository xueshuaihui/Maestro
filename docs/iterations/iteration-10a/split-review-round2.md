# I1.10a 拆分与契约独立评审 · 第 2 轮（split-review-round2）

- 评审对象：`docs/iterations/iteration-10a.md`（**r2**，624 行，9 WP / 73 文件 / 6 批次）
- 上轮 FAIL 清单：`docs/iterations/iteration-10a/split-review.md` §6（S-01~S-08，阻断 3：S-01 批次时序 / S-02 DAG 缺边 / S-03 harness 跨包 import）
- 判据：`docs/templates/execution-template.md` §1.1~§1.6（附 §2.3 批次并发、§2.5 门禁四件套）、`requirement.md` v2（37 AC）、`requirement-understanding.md`（§5 / §9）、`decisions.md`（裁决 A~D + 核查记录）
- 评审人立场：独立只读评审；除本文件外零写入；所有计数自行脚本点数，不采信文档与 r1 结论

---

## §0 总判

**PASS** — 阻断 **0** 项 / 建议 **1** 项（S-09，见 §4）。

上轮 3 个阻断（S-01/S-02/S-03）全部闭合，5 条建议（S-04~S-08）全部落实；全量回归重扫无新增缺陷。r1 已 PASS 的六个维度（结构、AC 覆盖、文件零交集、授权边界、裁决落地、数据模型）复核未被 r2 修坏。

### 复核方式（实跑脚本清单与关键输出）

机械核验全部为临时 Python heredoc 脚本（未落盘）+ 只读 `grep`/`sed`，命令与关键输出如下。

```
== 脚本 1：结构 / 文件 / AC / DAG 原始解析 ==
节标题 ^## 实扫: 0 定位 / 1 选型 / 2 模块 / 3 数据模型 / 4 工作包 / 5 交付物 / 6 依赖 / 7 风险 / 8 对齐
  （另有「## 附录：拆分质量自检结果」，节号 0~8 顺序与模板 §1.3 一致）✅
requirement.md AC 集合: 37 条 **AC-xx · 连续 01..37 ✅
逐 WP 负责文件（声明,实列）: WP-1(16,16) WP-2(8,8) WP-3(9,9) WP-4(5,5)
  WP-5(12,12) WP-6(12,12) WP-7(3,3) WP-8(5,5) WP-9(3,3)
合计 73 | 去重 73 | 重叠: 无 ✅（S-04 修正后的 73 与脚本实点一致；test/wp13 计 31 件含在内）
触碰不得修改清单(src/core|main.js|render.js|persistence|templates|registry): 无 ✅
AC→WP 映射表: 37 行 | 集合 01..37 | 重号 0 | 主责分布 1:5 2:4 3:5 4:4 5:8 6:7 8:1 9:3（WP-7 无主责合法）

== 脚本 2：DAG / 批次 / import 三方 / 门禁 / 修订锚点 ==
依赖（剔除全角/半角括号注释后解析）:
  1:[] 2:[4] 3:[2,4,7] 4:[] 5:[4,7] 6:[4,5,7] 7:[] 8:[1,2,3,5,6,7] 9:[1..8]
  与各 WP 依赖行逐字口径一致: True | DFS 判环: 无环 | 依赖编号全部存在: True ✅
批次表实扫: 1{7,4}(2并行) 2{1,2}(2并行) 3{3,5}(2并行) 4{6}(单线) 5{8}(单线) 6{9}(单线) —— 6 批全齐 ✅
各 WP 头部批次标注: 1→2 2→2 3→3 4→1 5→3 6→4 7→1 8→5 9→6（与批次表逐项一致）✅
静态依赖边 × 批次: 违反 无 | 批内依赖边: 0 | 每批 ≤2: True ✅
注入/惰性声明计数: registerRoutes×4 registerLabels×4 「惰性动态 import」×10 「注入式」×4
§2.1「静态 import」出现处仅 2 类: ① 同包 stream.js（同批静态 import，合法）② 「非静态 import」否定句 —— 跨包静态 import 残留: 0 ✅
FORBID 词数: 31，与 requirement.md D-7 词表逐词一致（差异仅为正则误吞句尾「` 必须 exit 0`」，逐词比对零差）✅
基线口径在 §0: 1157 / 8 已知失败 / 差集 = 0 三要素齐 ✅

== 代码事实（只读，逐项与 §2.5「代码现状核对结论」/ C-01 比对）==
src/daemon/server.js:44   createServer({root, orchestrator, bus, generation, pipeName, logger, clock, exitOnStop}) → 现无 http 参数 ✅
src/daemon/serve-entry.js :24 parseArgs 调用 / :130-141 「-- 后无值或下一 token 以 -- 开头 → out[key]=true」可承接布尔旗标 --desktop / :51 createServer({root, orchestrator, bus, generation}) ✅
src/cli/labels.js         882 行 | :552 WORKFLOW_NODE_TYPE_INVALID 四类 node_type 合法 | :183 USAGE_LINES | grep DESKTOP_ → 0 ✅
src/cli/workflows.js      :170/:515 node_type 透传（decisions.md 核查记录复核一致）✅
package.json              dependencies/devDependencies 均不存在，scripts 仅 test → D-10「只追加 scripts.desktop:*」口径成立 ✅
```

---

## §1 S-01~S-08 三态复核表

| 编号 | 原严重度 | 三态 | 复核证据（行号 / 脚本输出） |
|---|---|---|---|
| **S-01** 批次时序（WP-8 依赖 WP-6 却同批并行） | 阻断 | **已修** | 批次重排为 6 批：§6 第 4 批 WP-6 单线（L500）、第 5 批 WP-8 单线（L501）、第 6 批 WP-9（L502）；§7 风险 15「分批固定 6 批、每批 ≤2 并行」（L537）；9 个 WP 头部批次标注与批次表逐项一致（脚本实扫）；整合检查点批号同步（第 2 批冒烟 / 第 6 批 `desktop:build`，L515）；WP-8 自述「可否并行：否」（L388）与第 5 批单线一致（L501 括注明示）。全文档残留扫描：无「第 4 批 WP-8」类旧时序表述。批内依赖边 0 |
| **S-02** DAG 缺边（2→3 / 2→7） | 阻断 | **已修（方案 b）** | `http/server.js` 契约（§2.1 L113）：`registerRoutes(table)` / `registerLabels(fn)` 注入式 handler 表 + 惰性动态 `import('./routes.js')` / `import('./labels.js')` 兜底，明写「**非静态 import：不计入 §6 DAG 边、计入批次后置校验**」；同步三处齐备：§2.1 `routes.js`（L115）与 `http/labels.js`（L116）各写明接缝形态、WP-2 交付（L332）、WP-3 交付（L341）、WP-8 验收口径「承担 S-02 接缝的批次后置端到端校验」（L387）、§6「注入依赖说明」段（L492）。批次后置校验时序正确：`labels.js`(WP-7) 批 1 先于 WP-2 批 2；批 3 检查点断言 REST 可用（routes.js 已落地）；批 5 `errors.test.js` 端到端。跨包静态 import 残留 0（脚本实扫） |
| **S-03** harness 跨包 import（graph-dump→legend/highlight） | 阻断 | **已修** | §2.4 `graph-dump.mjs` 分阶段交付（L157）：批 1 只出节点/边，`legend`/`hover` 段容缺 `null`；WP-4 交付同步（L350）；AC-07 图例两行逐字断言移 WP-5 `legend.test.js`（WP-5 验收口径 L360 明写「同时承载 AC-07 的图例两行逐字断言——S-03 自 WP-4 后置移入，AC-07 协作」，与 AC-34 同一 A-8 基线）；AC→WP 表 AC-07 行同步（L410：协作 WP-5、WP-7，注明 S-03 后置批次 3）；§6 注入依赖说明含 4→5/4→6（L492）。**批次 1 可执行性核实**：AC-07 锚点 `graph-projection.test.js` 仍在 WP-4 清单（L348），其批次 1 可判断言（8 节点 9 边、悬空 0、类型状态齐全、未知类型不丢）直接针对 `buildGraph` 纯函数、不消费 graph-dump 图例段——图例断言已整体后置，批次 1 无依赖缺口。**容缺段桩归属写清**：graph-dump.mjs 本身 WP-4 负责（唯一归属）、legend/hover 段容缺为 `null`、批 4 整合检查点断言全量导出非 `null`（§2.4 L157 与 §6 L492 两处一致；legend 批 3 + highlight 批 4 均先于该检查点，时序成立） |
| S-04 计数失真（71/72、src-tauri 10） | 建议 | **已修** | 登记总数 71→**73**（修订记录 L15 + 附录自检第 4 条 L607）；WP-4 括号 4→5（L348，实点 5）；§5 src-tauri 10→**9 文件**（L450，实列 9 件）。脚本实点 73/73 去重 73 零重叠，三处数字全部与实点一致 |
| S-05 index.html 未登记 | 建议 | **已修** | `desktop/ui/index.html` 进 WP-8 负责文件（L384，5 件）、§2.2 契约条目（L136：静态入口页、`GET /ui/` 加载、module 加载同包 app.js、零中文）、§5 交付物表（L462）。73 计数含该件 |
| S-06 build.mjs 豁免未登记 | 建议 | **已修** | §8.5 C-08 行（L596）：登记为「新增文件对 D-10 清单的补充」，豁免理由（`scripts/**` 不进 `src/**` 扫描、不进 package.json 依赖、零依赖口径不受影响）、不改 D-10、留 S3/S4 复核。成立性核实：该文件确为 D-1/D-6/退出标准 6 必然产物，且 31 词两轮扫描的 `--dirs` 为 `src/core,src/daemon` 与 `desktop/ui`，确实不触及 `scripts/**`，豁免论证与门禁命令实际形态自洽 |
| S-07 AC-19 夹具可读性实测缺失 | 建议 | **已修** | WP-6 契约测试例外条款（L369）：`graph-collapse.test.js` 实测阶段——`$TMPDIR` 独立根按 §7 风险 14 铁序直写 `.orch/roles/*.yaml` 13 角色（8 coding + 5 research）、`--host mock` 起会话、断言 `buildRoleInstances` 读出 13 角色 group 计数 8/5；不可读 → 按 §1.2 走需求修订；§8.4 第 3 条登记（L583）。与理解纪要 §5.2 要求一致 |
| S-08 裁决 B 重排依据未注 | 建议 | **已修** | §8.1 裁决 B 行补「**重排依据（S-08）**」（L550）：引 D-14 末段「若打包可行性阻塞拆分，先做一次最短打包验证再回填拆分文档」，WP-1 即验证包、`bundle.test.js` + `wp1-bundle-verdict.md` 为其首个契约测试动作，语义等价不算推迟。与 decisions.md 裁决 B 影响面（「S1 拆分前」）字面差已闭合 |

**三态统计：已修 8 / 未修 0 / 修了但引入新问题 0。**

---

## §2 全量重扫结果（全部脚本实点，非采信文档数字）

| # | 维度 | 结果 | 关键输出 |
|---|---|---|---|
| 1 | **73 文件零交集** | **PASS** | 逐 WP 实点合计 73、去重 73、重叠空集；各 WP 括号声明数与实列数全部相等（含 S-04 修正的 WP-4=5、S-05 新增的 WP-8=5）；31 个 `test/wp13/*.test.js` 全部落在清单内 |
| 2 | **AC 37 满覆盖** | **PASS** | requirement.md AC 集合 = 37 连续（01..37）；拆分映射表 37 行、无缺号无重号、每行恰一个主责 WP；主责分布与 §4 覆盖核对注记一致；AC-07 修订后锚点 `graph-projection.test.js`（WP-4 主责）与 `legend.test.js`（WP-5 协作承载图例断言）均在清单内；WP-7 无主责 AC 属合法（模板 §1.4 规则 4 约束每条 AC 有主责） |
| 3 | **DAG 无环** | **PASS** | 剔除括号注释后解析依赖行：`1:[] 2:[4] 3:[2,4,7] 4:[] 5:[4,7] 6:[4,5,7] 7:[] 8:[1,2,3,5,6,7] 9:[1..8]`；DFS 判环无环；依赖编号全部存在；§6 文本图与依赖行一致（叶子 1/4/7、汇合点 9） |
| 4 | **批次时序无矛盾** | **PASS** | 6 批与 9 个 WP 头部标注逐项一致；批内依赖边 0（第 1 批 {4,7}、第 2 批 {1,2}、第 3 批 {3,5} 互无依赖）；每批 ≤2；全部静态依赖边上游批次严格先于下游；注入依赖的后置校验批次正确（2→7：labels 批 1 先于 WP-2 批 2；2→3：批 3 检查点；4→5/4→6：批 4 检查点在 legend 批 3 与 highlight 批 4 合入之后；2→3 端到端兜底批 5 在批 3 之后） |
| 5 | **import 声称 ↔ DAG/批次 三方一致** | **PASS** | r1 缺边的 4 处跨包依赖（2→3、2→7、4→5、4→6）全部改写为注入式 handler 表 / 惰性动态 import，四处声明均带「非静态 import、不计入 DAG 边、计入批次后置校验」同款口径，且 §2.1（2 处）/ §2.4 / WP-2 / WP-3 / WP-8 / §6 同步齐备；其余跨包静态 import（app.js→WP-3/5/6 模块、routes.js→graph.js）与 DAG 边一一对应；同包 import（server.js→http/server.js、http/labels.js→`src/cli/labels.js` 同 WP-7、layout-dump→layout.js 同 WP-5）无需边；§2.1 无跨包静态 import 残留（脚本实扫 0 处） |

附加重扫（r1 PASS 维度回归）：

- **8 节齐全**：`^##` 实扫 0~8 节 + 附录自检，节号顺序与模板 §1.3 一致（附录不算节，r1 同口径）。
- **门禁四件套每 WP 齐**：§4 统一门禁块（全量测试差集口径 / 两轮 31 词扫描 / 零依赖 / 主链 + 壳冒烟）+ 各 WP「门禁附加」9/9 齐备；机检 F-16 固化模板（`test -f … && node --test …` + `# pass ≥ 1`、`# fail 0`）在 §4/§5 两处一致。
- **31 词全表显式**：`FORBID` 实点 31 词，与 requirement.md D-7 逐词一致。
- **基线口径在 §0**：退出标准 2 写明 1157 / 8 已知失败 / 失败集合差集 = 0、条数只增不减，与 decisions.md 基线记录一致（非绝对全绿）。
- **不得修改清单零触碰 / D-10 边界**：负责文件与六类禁改路径交集为空；被改既有文件恰为 D-10 点名 4 件（server.js / serve-entry.js / labels.js / package.json，各唯一负责 WP）；新增 `src/**` 恰为 D-10 授权 5 件（graph.js + http/{server,routes,stream,labels}.js）；代码现状核对（§0 脚本输出）与 §2.5 / C-01 声称逐项一致。
- **S-06 / C-08 豁免成立**：`scripts/desktop/build.mjs` 不在任何扫描 `--dirs` 与 package.json 依赖面内，登记与论证自洽。
- **接缝降级语义**（REST 503）：§2.1 已声明「REST 返回结构化 503 {"error":"NOT_READY"}（不含实例数据）」，属 S3 验收口径声明，非缺陷。

---

## §3 边界与既定裁决核对（r2 增量复核）

| 项 | 判定 | 依据 |
|---|---|---|
| 裁决 A（serve-entry 入口、main.js 零改动） | PASS | §2.1 契约 + 代码事实（`serve-entry.js:130` parseArgs 可承接 `--desktop`、`server.js:44` 现无 http 参数）与 C-01 一致 |
| 裁决 B（最短打包验证） | PASS（含 S-08 闭合） | §8.1 重排依据引 D-14；WP-1 第一步 = 验证 + `wp1-bundle-verdict.md` |
| 裁决 C（graph.json 不落盘） | PASS | §3 唯一事实来源声明；落盘面仍为三处（desktop.json / views / projects.json） |
| 裁决 D（F-15~F-19 落点） | PASS | §8.2 五条落点未变；F-18（WP-3 阶段四）、F-19（WP-6 节点 E 与边 C→E）、F-17（WP-8 connecting 态）均在对应 WP 验收口径内 |
| D-10 / D-11 / D-13 红线 | PASS | 负责文件零触碰禁改清单；D-11 授权断言修改清单 = 无；registry / paths 冻结、路径常量落点（§2.1 / config.rs）与 C-02 一致 |
| 夹具禁 `open -na`（纪要黄色警示 1） | PASS | §1.3 / WP-1 / §7 风险 2 / §8.4 四处统一直接执行二进制口径未变 |
| r1 → r2 未引入越界 | PASS | 修订记录自述「只改本文档」；新增登记仅 `desktop/ui/index.html`（D-10 `desktop/ui/**` 通配授权内） |

---

## §4 修复清单（本轮新增）

| 编号 | 位置 | 要点 | 建议 | 严重度 |
|---|---|---|---|---|
| S-09 | §6「注入依赖说明」段 vs「整合检查点」段 | 批次 3（REST 可用）/ 批次 4（graph-dump 全量非 null）/ 批次 5（errors.test.js 接缝端到端）三道接缝后置校验写在「注入依赖说明」段落，而「整合检查点」段落（L515）只列统一数字 + 第 2 批冒烟 + 第 6 批 desktop:build，未复述这三道逐批校验 | 把三道接缝后置校验以一行汇总补进「整合检查点」段落（或在其后加「批次 3/4/5 追加接缝校验：…」句），使主控逐批派单时的单一清单自足，避免派单漏跑 | 建议（不阻断；两段同在 §6 且紧邻，信息可达） |

---

## §5 结论与 S2 开工检查单

**结论：PASS。上轮阻断全部闭合 + 回归扫描无新增（建议 1 条 S-09 可随派单顺手补，不构成开工门槛）。**

S2 开工前主控检查单（按 §0 判据逐条确认后派单）：

1. **派单口径固化**：按 §6 六批顺序派单（批 1 {WP-7, WP-4} 并行 → 批 2 {WP-1, WP-2} → 批 3 {WP-3, WP-5} → 批 4 WP-6 单线 → 批 5 WP-8 单线 → 批 6 WP-9 单线）；每份任务书显式写明本 WP 批次号与「注入依赖不计 DAG 边、计批次后置校验」口径（WP-2 任务书必须带 `registerRoutes`/`registerLabels` 契约原文，WP-4 任务书必须带 graph-dump 分阶段交付口径）。
2. **接缝后置校验进检查点**：把 §4 S-09 的三道逐批校验（批 3 REST 可用 / 批 4 graph-dump 全量非 null / 批 5 errors.test.js 端到端）补进 §6 整合检查点清单，逐批合入后照跑。
3. **WP-1 先行门禁**：批 2 派单前确认 WP-1 第一步产物（最短打包验证 + `wp1-bundle-verdict.md`）已回填——若两条打包路径失败，按裁决 B 回需求修订，不带病开工。
4. **门禁基线核对**：派单任务书统一附四件套命令与差集口径（1157 / 8 / 差集 0、31 词全表显式 `--forbid`、`# pass ≥ 1` / `# fail 0` 固化模板），禁止绝对全绿与全量 glob。
