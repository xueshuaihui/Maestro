# I1.10a 批次 4 实现评审记录（WP-6 交互样式与行渲染纯模块 + 裁决 J 检查点）

> 评审角色：实现评审工程师（只读；本文件为唯一写入产物）
> 评审依据：`docs/iterations/iteration-10a.md`（拆分 r2）§2.2 / §4 WP-6 / §6 / §7 风险 14；`requirement.md`（v2）AC-11/12/13/19/23/25/33 与附录 A-8/A-9/A-10/A-11/A-14、D-3/D-4/D-7/D-9/D-11、§3.1 判定口径五条；`decisions.md` 裁决 A~J（重点 G 更正段、H、I 的 B-07/B-11、J）
> 上游冻结契约核对：`5c9ffac`（graph.js）、`baf23f8` / `e76f111`（layout/view/legend/board）、`e4f22d0` / `15fce0c`（144 键）、`5b5640c`（`desktop/ui/list/*` 消费范式）
> 评审对象：`07bda21` I1.10a WP-6：collapse / abnormal style / hover highlight / node-edge rows / label policy，13 文件（WP-6 交付 12 + 裁决 J 授权的 `graph-dump.mjs`），+2254 / −9

## §0 总判

**FAIL**（阻断 1 / 建议 5）。

13 文件边界、六个纯模块的签名与语义、AC-11/12/13/23/25/33、测试与门禁复跑、批 4 检查点全部成立；唯一阻断在 **AC-19 的组节点标签逐字**：`分组 编码工程 · 8 角色` 在当前下发的 144 键表里没有组名键，走真实 `GET /ui/labels` 只能产出 `分组 coding · 8 角色`，而 `graph-collapse.test.js` 用**自造的 `GROUP_LABEL_*` 键**补齐后再断言逐字，等于用不存在的键自证基线（该测试第 148 行甚至把原始 id 回退固化为期望）。

复核方式（全部本机实跑，macOS / Node v22.22.2）：

```bash
# 1) 本批六个测试文件（裁决 F：串行）
NODE_ENV=test node --test --test-concurrency=1 \
  test/wp13/graph-collapse.test.js test/wp13/abnormal-style.test.js test/wp13/labels-policy.test.js \
  test/wp13/hover-highlight.test.js test/wp13/role-node.test.js test/wp13/special-node.test.js
#    -> 1..37 / # pass 37 / # fail 0

# 2) 全量（串行单跑，约 12m42s）
NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js" > /tmp/rev4-full.log 2>&1
#    -> 1..1328 / # pass 1321 / # fail 6 / # skip 1

# 3) 超基线单条归因
NODE_ENV=test node --test --test-concurrency=1 test/wp10/perf.test.js
#    -> 2 tests / 2 pass / 0 fail（NFR-02 在单跑下通过 = 负载型 flake）

# 4) 批 4 检查点（裁决 J）：临时根 --host mock 起实例 → serve-entry --desktop → graph-dump
node /tmp/rev4/checkpoint2.mjs

# 5) 机械扫描：文件集合 / 逐路径 git diff / Python CJK 正则 / purity 31 词两轮 / deps=0 / decideStatus
```

## §1 边界合规（PASS）

| 项 | 结论 | 证据 |
|---|---|---|
| ① 文件集合 | **精确 13 个** | `git show --name-only 07bda21`：6 个 `desktop/ui/**` 模块 + 6 个 `test/wp13/*` + `desktop/harness/graph-dump.mjs`，与拆分 §4 WP-6 的 12 文件清单逐名一致，外加裁决 J 授权文件；无第 14 个文件，无删除（`graph-dump.mjs` 9 行删除均为本文件内替换） |
| ② 禁改清单 | **零触碰** | `git diff --name-only e76f111 07bda21 -- <path>` 逐路径：`src/core` 0、`src/cli` 0、`src/persistence` 0、`src/templates` 0、`src/registry` 0、`desktop/ui/index.html` 0、`desktop/ui/app.js` 0、`package.json` 0、`test/fixtures` 0；`test/` 下非 `test/wp13/` 改动 0 个 → 批次 1/2/3 文件与既有测试全部零触碰 |
| ③ 零 npm 依赖 | **成立** | `node -p "Object.keys(require('./package.json').dependencies\|\|{}).length"` → `0`，`devDependencies` 亦 0；13 文件只 import `node:*` 与仓库相对模块（含 `./layout.js`、`../labels/labels.js`） |
| ④ `graph-dump.mjs` 改动范围（裁决 J） | **限于 legend/hover 两段，未越界** | diff 只有三段新增：`loadLabelTable`（L168）、`hoverKeyOf`（L194）、`fillSegments`（L209），以及 L239-240 / L244-245 两处 emit 调用点；`parseArgs`（L42-64）、`readJson`/`readEvents`/`loadWorkflowDef`/`loadRoles`/`buildFromProject`（L66-149）、`emit`（L151-160）逐字未动，节点/边导出逻辑零改动，错误处理只在新增段内部 `try/catch` 后返回 `null`（不改既有退出码路径） |
| ⑤ 新增 `/ui/labels` 拉取 vs D-9 | **不破坏边界** | 取键走 `fetch http://127.0.0.1:<port>/ui/labels` + Bearer（与 `collect.mjs` 同口径），**没有** `import` 任何 `src/daemon/**` 模块（对照裁决 I B-12 已把 `board-dump.mjs` 直连 `src/daemon/http/labels.js` 判为违规）；harness 自身允许文件 IO（读 `.orch/desktop.json`）与纯模块动态 import，D-9「只 import `desktop/ui` 纯模块」仍成立 |

> 备注（不判缺陷）：J 的授权文本只点名两条 `await import(...)`，实现额外需要「标签从哪来」这一前置（无标签表则 `renderLegend` 只能抛 `TypeError` 或被静默吞成 `null`）。`loadLabelTable` 属补齐两段所必需，且路线符合 D-9，按「最小改动」认可以下；若主控要求严格字面，可要求把取键上移到调用方以 `--labels` 传入，但不改变本批判定。

## §2 六模块签名/语义核对（PASS，1 项标注）

| 模块 | 签名（拆分 §2.2 逐字） | 实现 | 语义核对 |
|---|---|---|---|
| `collapse.js` | `autoCollapse(nodes, { threshold = 12 })` / `toggleGroup(view, groupId)` | `autoCollapse(nodes, options = {})` 内取 `options.threshold`，默认常量 `COLLAPSE_THRESHOLD = 12`；`toggleGroup(view, groupId)` | **PASS**：分组键只读 `node.group`（`deriveGroups` L76-106），缺失入单一 `group:ungrouped` 桶；组节点模板 `分组 {group} · {n} 角色`；`>threshold` 严格大于（L245，12 不折叠、13 折叠）；子工作流节点始终透传 `collapsed:true` 且不进可展开集合；展开只重排「可见列表」（成员替换到首个成员位置）后交给 `layout.js` 重新分层，**本模块不重算层号**（测试用 `computeLayout` 对拍全量布局层号） |
| `style.js` | `elementStyle(element, { hoveredKey })` → `{opacity,z,animation}` | 同签名（额外接受可选 `opaqueIds`） | **PASS**：返回对象键恰 `animation/opacity/z`（测试 `Object.keys` 断言）；脉冲只是 token，几何不进该函数；异常解除 `z=0 / animation='none'` 立即生效；边动画沿用 A-11 `visual.animation`（`rejected` 为 `none`），与 A-11 表一致（BR-13 的「红色脉冲」对线以 A-11 token 为准） |
| `highlight.js` | `hoverSet(graph, key)` → `{opaqueIds, dimIds}` | 同签名 | **PASS**：悬停节点 = 全部入/出线 + 这些线两端节点；悬停线 = 该线 + 两端；key 不存在 / `null` / `undefined` → 全集不透明、`dimIds: []`（等价移开）；自环（`from===to`）退化为节点+该线，无重复；重复边按 id 去重（`Set`）；`opaqueIds`/`dimIds` 保持「节点序 + 边序」确定性 |
| `node-rows.js` | `renderRoleRow(node, labels)` / `renderSpecialRow(node, labels)` | 同签名 | **PASS**：五要素齐（状态色 / `N 个活跃会话` / `服务 T-001, T-002` / 宿主空格并列 / `异常 N`），>2 折叠 `{first} 等 {n} 个`，`×N` 堆叠走 `visual.sessionStack` 与 `visual.stackBadge`，宽度硬取 `NODE_WIDTH=180`；类型只读 `node.type`（`SPECIAL_TYPES` 白名单，非白名单返回 `null`），标题不参与判型；三类特殊节点形态/颜色/全角冒号齐全。**注意**：`labels` 只接受平铺键表（见 B-18） |
| `edge-rows.js` | `renderEdgeRow(edge, labels)` | 同签名 | **PASS**：A-11 逐字复现（`连接线 开发→测试 · 正向 · 已投递`）；`parallelCount>1` 拼 ` · {n} 并行交接`；`accepted` 的行文本保持 `已接受`，`hoverText` 为合并文案 `已接受 · 处理中`（模板 `DESKTOP_EDGE_ROW_ACCEPTED_HOVER` 逐字一致）；`visual` 原样透传不重算颜色 |
| `labels/labels.js` | `resolveLabels(payload)` / `visibleLabels(edges, hoveredKey)` | 同签名 | **PASS**：`payload` 两种形状（`{keys}` 与平铺表）都接受且返回共享引用（不复制）；`text()` 只做字面替换，缺参保留 `{xx}`（`fillTemplate('{x}',{x:'{y}'})` → `{y}`，不做二次插值）；缺键返回 `null` 不造文案；默认可见集恰 `{rejected, expired, pending}`，悬停把该线并入且不改其余，返回按边声明序 |

## §3 AC 锚点逐条核对（6 PASS / 1 FAIL）

| AC | 结论 | 证据 |
|---|---|---|
| AC-11 | **PASS** | `role-node.test.js` 从真实 `buildGraph` 投影取节点：A-9 服务中行逐字 `角色 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 异常 1`；`statusColor==='blue'`、`badge==='escalated'`、`badgeCount===1`、`hostIcons` 深比较 `['dsh','cursor']`；另测五 token→颜色/词映射与 `--` 占位行 |
| AC-12 | **PASS** | 折叠示例逐字 `角色 开发 · 服务中 · 3 个活跃会话 · 服务 T-001 等 3 个 · 宿主 mock · 异常 0`；`sessionStack===3`、`stackBadge==='×3'`、`width===180===NODE_WIDTH`（与单服务节点同宽） |
| AC-13 | **PASS** | 三行逐字（含全角冒号 `子工作流：发布子流程 · 3 角色`）；`shape`=`shield/alert/group`、`color`=`gray/red/green`；子工作流内升级→红+脉冲；`node_type` 判型有正反例（标题写「角色 开发」的 human 仍是 human，标题写「人工验收」的 role 返回 `null`） |
| AC-19 | **FAIL（标签逐字）** | 三态可见数 2/10/2、折叠态边数 1、展开回原层原序（逐成员与全量布局对拍）、阈值 12/13 边界、子工作流恒折叠、`group:ungrouped` 单桶、切换未知组不变、输入零改写——**全部 PASS**。但组标签逐字只在测试自造的键表下成立：见 §6 B-16 |
| AC-23 | **PASS** | 两份图 `width/height/x/y` 四项相等、`animation==='pulse'`、`z===1`；连接线 `visual.color==='red'`、`dash==='solid'`、`arrow==='back'`；其它节点坐标逐项不变（`role:qa` z 仍 0）；`elementStyle` 键集恰三项，异常解除立即归零 |
| AC-25 | **PASS** | 三次 `visibleLabels` 长度 3/4/3 且集合为 `['L-04','L-05','L-06'] → ['L-01',…] → 原三`；新增键恰被悬停的那条（`hovered.filter(k=>k!=='L-01')` 深等于首次）；角色行内容（`服务 T-001, T-002` / `2 个活跃会话` / `宿主 dsh cursor`）三次都在 |
| AC-33 | **PASS（F-19 断言实存）** | 夹具含 `E` 与边 `C→E`（不与 B 相邻）：悬停 B 的 `opaqueIds` 恰 7 项 `A,B,C,D,E-01,E-02,E-04`，`dimIds` 恰 `['E','E-03','E-05']` → **E 与 C→E 被 dim**；悬停 `B→C` 得 `['B','C','E-02']`、`dimIds` 7；`null`/`undefined`/未知键两次移开恢复 10 项全集；前后 `computeLayout` 字节相等且逐节点 x/y/宽/高相等；另有「移动坐标不改变集合」证明派生自邻接 |

**S-07 实测阶段真实性：真跑。** `graph-collapse.test.js:289-349` 在 `os.tmpdir()` 独立根直写 13 个 `.orch/roles/*.yaml`（8 coding / 5 research）与 `.orch/hosts/mock.json`（`command=process.execPath`、`args=[mock-acp-agent.js]`），`spawnSync` 起真实 `bin/orch.js run --cwd . --template single --host mock`（`timeout 120s`，断言 `status===0`），随后从落盘的 `.orch/instances/*/state.json` 读回、`loadRegistry` 读出 13 个 project 角色、group 计数 8/5、`buildRoleInstances` 对 13 个声明角色全部非 `unknown-role`，再用 `buildGraph` + `autoCollapse` 断言 8/5。**不是模块级自证**；测试用 `t.after` 清理临时根，不写仓库。

## §4 文案与纪律（PASS）

| 项 | 结论 | 证据 |
|---|---|---|
| ① 零 CJK | **PASS** | Python 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]` 逐文件：`collapse.js` 0、`style.js` 0、`highlight.js` 0、`node-rows.js` 0、`edge-rows.js` 0、`labels/labels.js` 0、`graph-dump.mjs` 0（含注释）。6 个测试文件有中文，属正常基线（D-7 只约束 `desktop/ui/**`、`desktop/harness/**`） |
| ② 键名消费 | **PASS** | 六个模块内无 `'code-loop'` / `'single'` / `'task-loop'` 字面量（`rc=1`）；状态词、方向词、行模板全部经键取值；`serving`/`forward`/`backflow` 只作投影 token 参与映射，不直接出现在输出文本 |
| ③ 占位符纪律 | **PASS** | 只 `fillTemplate` 字面替换；缺参保留 `{group}`/`{title}` 原样；值内 `{y}` 不被二次展开；缺键 `null` 而非空串 |
| ④ 共享引用 | **PASS** | 全仓无 `labels[X] = …` / `labels.XXX = …`（`rc=1`）；`resolveLabels().keys` 与 `payload.keys` 同一引用（`Object.is` 断言），`UI_LABEL_KEYS` 冻结且测试前后 `JSON.stringify` 相等 |
| ⑤ `decideStatus` | **PASS** | `grep -R "decideStatus" desktop/ --exclude-dir=target` → 零命中（`rc=1`）；测试内以 `['decide','Status'].join('')` 复检 `desktop/ui`、`desktop/harness`、`desktop/src-tauri/src` 三处 |

## §5 测试质量与门禁复跑

**① 位置与既有测试**：六个测试全在 `test/wp13/`，`git diff e76f111 07bda21 -- test` 不含任何非 `test/wp13/` 路径 → 既有测试零改动（D-11）。

**② 六文件串行复跑**：`1..37 / # pass 37 / # fail 0`（graph-collapse 7 + abnormal-style 6 + labels-policy 6 + hover-highlight 5 + role-node 6 + special-node 7）。每个文件均可用 `test -f … && NODE_ENV=test node --test …` 形态直接运行，`# pass ≥ 1`、`# fail 0` 满足。

**③ 断言形态**：无 BRE `\|` 假通过（全部 `assert` 直判）；无跨文件共享可变状态（每测试各自 `projectedGraph()` / `fixture()` 重建，标签表冻结）；无执行顺序依赖（S-07 只在本测试内建根并 `t.after` 清理）；S-07 用真实进程但用 `spawnSync` + 超时，不靠固定 `sleep` 判定。

**④ 全量复跑差集**：

```
1..1328  # tests 1328  # pass 1321  # fail 6  # skipped 1  (12m42s, --test-concurrency=1)
not ok 100  - NFR-02: readReview p95 <= 50ms（1MB / 5MB 文档）           <- 超主控记录的一条
not ok 1022 - task-loop 审核提示词给绝对路径…
not ok 1073 - core.stop：先回包再断连，5s 内收敛…
not ok 1081 - cursor.json 并发消费 20 次不重复
not ok 1091 - main：--cwd 相对当前 shell 目录解析…
not ok 1190 - 早返回：turn-delay 3000ms…
```

- 主控记录基线为 1328 / 1322 / 5；本次 6 条 = 基线 5 条 + `NFR-02 readReview p95`（`error: 'readReview p95=62.10ms 超过 50ms（5MB）'`）。
- 该条属 `docs/iterations/iteration-7/baseline-failures.txt` 已列 8 条之一；**逐文件单跑 `test/wp10/perf.test.js` 得 2/2 pass** → 负载型 flake，与裁决 F 描述一致。
- 结论：**失败集合 ⊆ 基线 8 条，差集 = 0**；测试条数 1328 与基线一致（本批 +37 已并入），无新增失败面。

**⑤ purity 与依赖**：`purity-check.mjs --dirs desktop/ui` → `OK: 扫描 13 个文件 … 零命中`，`exit 0`；`--dirs desktop/harness` → `OK: 扫描 5 个文件 … 零命中`，`exit 0`（31 词表按 D-7 代码块逐字复制，含 `data-analysis`）；`dependencies` = 0。

**⑥ 批 4 检查点（裁决 J）实跑：PASS**

```
orch run --cwd . --template code-loop --host mock --task 'build calc.js\n产物：calc.js'  -> INST-001
orch core stop; serve-entry.js --project <tmp-root> --desktop  -> .orch/desktop.json 就绪
node desktop/harness/graph-dump.mjs --project <tmp-root> --instance INST-001 --payload /tmp/rev4/graph.json
  dump exit 0（无 chunk/import 报错）
  legend = {"anchor":"bottom-left","layer":"top","offset":{"x":16,"y":16},
            "lines":["图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与",
                     "图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流"]}
  hover  = { opaqueIds:["role:coordinator"]（1）, dimIds:[…]（4） }   // 键恰 [opaqueIds, dimIds]
  nodes 3 / edges 2
```

- `legend.lines` 为长度 2 的字符串数组，两行与 A-8 基线逐字相等；
- `hover` 段由 `hoverSet` 产出、两键齐备且两数组均非空（3 节点 2 边图上 `dimIds` 4 项），非 `null`；
- 另用 `single` 模板（1 节点 0 边）验证退化为 `opaqueIds:['role:worker'] / dimIds:[]` 也不抛错，说明「缺 hover 主体不崩」。

## §6 修复清单

### §6.1 阻断

**B-16（阻断）｜AC-19 组节点标签在真实下发的键表下无法逐字成立，测试用自造键自证**

- 位置：`desktop/ui/graph/node-rows.js:177-182`（`groupNameOf`）、`:263-266`（`DESKTOP_GROUP_ROW` 渲染）；`test/wp13/graph-collapse.test.js:42-51`、`:148`；上游 `src/daemon/graph.js:453`（组节点 `title = key`）、`src/daemon/http/labels.js:127-138`（平铺表未含 `GROUP_LABEL`）。
- 原文/事实：
  - `node-rows.js:180` 查 `GROUP_LABEL_<GROUP>`，未命中回退 `node.title`（`graph.js:453` 写入的是原始 `group` 值），再回退原始 id；
  - 实测 `Object.keys(UI_LABEL_KEYS).length === 144`、`filter(k => k.startsWith('GROUP_LABEL_')) === []` → `renderSpecialRow(真实投影组节点, GET /ui/labels payload).text === '分组 coding · 8 角色'`；
  - 测试为此在 L48-51 拼 `GROUP_KEYS` 扩展 `LABELS`，并在 L148 **把该回退写成期望值** `'分组 coding · 8 角色'`。
- 违反：requirement AC-19 Then「逐字为“分组 编码工程 · 8 角色”“分组 研究分析 · 5 角色”」；A-10 第 4 行；拆分 §4 WP-6 验收口径「组节点标签逐字」；判定口径 1（界面文本由 `desktop/ui` 纯模块生成，harness 直判同一模块）。
- 严重度：**阻断**（主责 AC 的逐字断言在集成路径下不可达，且现测试以不存在的键掩盖；批次 4 是 WP-8 装配前最后一站，此口子必须在本批清掉）。
- 建议修法（二选一，需主控裁决，因都会触及冻结键集）：
  1. **推荐**：`src/daemon/http/labels.js` 的 `UI_LABEL_KEYS` 追加 `...flattenTable('GROUP_LABEL', GROUP_LABEL)`（5 键：`GROUP_LABEL_COORDINATOR/RESEARCH/WRITING/CODING/OPS`，值即 `通用协调/研究分析/内容创作/编码工程/业务运营`），同步 `test/wp13/labels-desktop.test.js:299-301` 的 144 精确集合与 A-14 登记（键总数 144 → 149）；随后删除 `graph-collapse.test.js` 的 `GROUP_KEYS` 拼接，改为直接用 `labelKeysPayload()`，并把 L148 从「断言原始 id」改为「缺键时 `text === null` 或明确降级」。
  2. 若主控认定组显示名属夹具值（A-0「随夹具变」），则须在 A-14 写明组名的数据来源并让图投影产出可显示名；当前 `group` 枚举为 `coding/research/...`（`src/registry/role-schema.js:114` 只允许英文枚举），夹具无法自行写中文，故该路径仍需一处映射，成本不低于方案 1。
- 判定降级条件：主控若明确「组名不属逐字范围、允许渲染原始 group id」，本条降为建议，本批可改判 PASS。

### §6.2 建议

**B-17（建议）｜未分组桶显示 `分组 — · 3 角色`，与「缺失落未分组」口径不一致**

- 位置：`desktop/ui/graph/node-rows.js:179`（`raw === null → placeholder`）；`test/wp13/graph-collapse.test.js:206`。
- 原文：拆分 §4 WP-6 门禁附加「分组键只取角色 `group` 缺失落「未分组」」；需求 U-10 / D-4「缺失时落“未分组”」。
- 事实：桶划分正确（单一 `group:ungrouped`、成员 3），但显示为 `分组 — · 3 角色`——占位符承担了「组名」语义，用户看到的是空白而非「未分组」。
- 建议：补 `GROUP_LABEL_UNGROUPED: '未分组'`（随 B-16 一起下发）或 `DESKTOP_GROUP_ROW_UNGROUPED`，渲染走该键；测试把 `'分组 — · 3 角色'` 改为逐字 `'分组 未分组 · 3 角色'`。

**B-18（建议）｜行渲染三函数只吃平铺键表，与 `renderLegend`（两种形状）不一致，WP-8 有静默全 `null` 风险**

- 位置：`desktop/ui/graph/node-rows.js:68-72`、`desktop/ui/graph/edge-rows.js:39-43`（`textOf` 直接 `labels[key]`）。
- 事实：`renderLegend` 按裁决 I B-07 接受 `{keys}` 与平铺表；三个行渲染函数传到 `{keys:{...}}` 时取不到值 → `text === null`（不抛错、不告警）。
- 建议：在三个入口统一调用一次 `labelTable()`（`labels/labels.js` 已有等价私有实现，可导出），或 JSDoc 硬声明「必须传 `resolveLabels(payload).keys`」并在 WP-8 消费清单里点名。

**B-19（建议）｜`graph-dump.mjs --payload`（无 `--instance`、payload 无 `labels`）分支 legend 仍为 `null`**

- 位置：`desktop/harness/graph-dump.mjs:244`（`fillSegments(source, { root: null, payload: source })`）。
- 事实：该分支 `root=null` 且 payload 不含 `labels` 时 `loadLabelTable` 直接返回 `null` → `legend/hover` 均 `null`；而 S-03 口径是「批 4 起全量导出」。检查点走的是 `--instance` 分支，故未暴露。
- 建议：该分支允许 `--project` 作为可选标签源，或在段代码注释里注明「仅 `--instance` 分支保证全量」。

**B-20（建议）｜AC-23 机检列的 `visual.badge === 'escalated'` 在本批未断言**

- 位置：`test/wp13/abnormal-style.test.js:81-99`（只断言 `node.abnormalCount === 1` 与 `style` token）；该断言实际落在 `test/wp13/role-node.test.js:101`（AC-11）。
- 事实：实现正确（`node-rows.js:163`），但 AC-23 的锚点四项（`width/height/x/y`、`animation`、`badge`、`color/arrow`）没有在同名测试里凑齐。
- 建议：在 abnormal-style 的首个用例补一行 `assert.equal(renderRoleRow(node, LABELS).visual.badge, 'escalated')`。

**B-21（建议，低）｜「子工作流恒折叠」靠上游 `collapsed:true` 透传，本模块不强制**

- 位置：`desktop/ui/graph/collapse.js:184-195`（非 role 节点原样 push）。
- 事实：`toggleGroup` 只作用于已知 group id，子工作流无法被展开，行为上正确；但若投影字段漂移（`collapsed:false`），本批会静默画出未折叠组。
- 建议：`buildView` 对 `node.type === 'subworkflow'` 归一为 `{...node, collapsed: true}`，并在测试里用 `collapsed:false` 的输入反向断言。

### §6.3 批次 5（WP-8）开工前必须先修 / 消费接口风险

**必须先修**：B-16（否则 WP-8 装上真实 labels 通道后，13 角色实例的图会显示 `分组 coding · 8 角色`，AC-19 直接红）；B-17 与 B-16 同源，建议一并处理。B-18 建议在 WP-8 写第一行装配代码前定稿，避免「六模块传参形状不一致」在装配层被一次性放大。

**WP-8 消费这六个模块的接口风险清单**：

1. **标签入参形状**（B-18）：`renderLegend(payload)` 可用，`renderRoleRow/renderSpecialRow/renderEdgeRow(payload)` 会得到 `text:null`；统一传 `resolveLabels(payload).keys`，或先修 B-18。
2. **折叠模型与布局的衔接**：`autoCollapse(graph)` 返回 `{nodes, edges, visibleIds, groups, members, source}`，**不是**布局结果；必须 `computeLayout({nodes, edges})` 二次派生。展开态保留容器节点（AC-19 的 10 = 8 成员 + 2 容器），而展开后的容器自身无边 → `computeLayout` 会把它排在层 0，可能与 `c1` 同层同序位重叠；WP-8 渲染时需自行决定容器是否画（不画更符合直觉，但 AC-19 的 10 计数要求它留在可见集合里）。
3. **`toggleGroup` 的入参是「模型」不是「图」**：必须传 `autoCollapse` 的返回值（依赖 `source` 重建），传原始图会得到 `view`（原样返回）。
4. **高亮与样式的调用顺序**：`hoverSet(graph, key)` 用**投影/布局前的节点与边 id**；折叠态下边 id 已改连组节点（`from/to` 换成了 `group:*`），必须先折叠再 `hoverSet`，否则高亮集合对不上。`elementStyle` 的 `opaqueIds` 直接吃 `hoverSet().opaqueIds`，两者 Key 命名空间一致（节点+边 id 混用一个 `Set`）。
5. **边行渲染需要显示名**：`renderEdgeRow` 优先读 `edge.fromTitle/toTitle`（投影不提供），否则回退「剥掉 `role:` 前缀的 id」（会显示 `dev`/`qa`）；WP-8 需在本地把角色中文名注入 `fromTitle/toTitle`，否则 A-11 的 `开发→测试` 退化为 id。
6. **组行渲染需要组名**（B-16/B-17）：修好前 `renderSpecialRow` 对 group 节点只能给原始 id 或 `—`。
7. **样式与布局 z 的双源**：`layout.js` 输出 `z = abnormal ? 1 : 0`，`elementStyle` 也返回 `z`；装配时只能取一处（建议取样式层，布局 z 仅作边提升依据），否则累加会出现 z=2。
8. **`session.indicator` 不重绘**：本批没有任何节流/订阅逻辑，WP-8 必须自己保证「会话变化只动指示器」；`elementStyle` 不含任何时间/动画状态，脉冲是稳定的 token，不会因重复渲染抖动。
