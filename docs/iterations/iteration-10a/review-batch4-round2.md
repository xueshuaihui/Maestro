# I1.10a 批次 4 实现评审记录 · round 2（复评 `aca57d6`）

> 评审角色：实现评审工程师（只读；本文件为本轮唯一写入产物）
> 复评对象：修复提交 `aca57d6`（9 文件，+208 / −104），主体对象仍为 `07bda21`（WP-6 13 文件）
> 评审依据：`docs/iterations/iteration-10a/review-batch4.md`（round 1，FAIL：阻断 B-16 / 建议 B-17~B-21）；`decisions.md` 裁决 K（含文末「补充授权」144→147 连带追认）+ 裁决 I/J；`requirement.md` AC-19 Then（L545 逐字）、A-10 第 4 行、A-14 键归属表、拆分 §4 WP-6 验收口径与门禁附加
> 运行环境：macOS 25.6.0（darwin）/ Node v22.22.2 / zsh；全部结论由本机实跑得出，未采信实现自述或测试自证

## §0 复评总判

**PASS**（残留阻断 0 / 建议 2）。

| 项 | round 1 判定 | round 2 三态 | 依据 |
|---|---|---|---|
| B-16（阻断）组名键缺失、测试自造键自证 | 阻断 | **已闭合** | 144→147 只追加 3 键、既有 144 键零改动；`graph-collapse.test.js` 自造键机制整体删除、改走 `labelKeysPayload()`；真实链路（真实 `GET /ui/labels` + 真实投影组节点）逐字命中 AC-19 Then |
| B-17（建议）未分组显示 `—` | 建议 | **已闭合** | `groupNameOf` 缺失 group 时查 `GROUP_LABEL_UNGROUPED`；测试逐字 `分组 未分组 · 3 角色` |
| B-18（建议）三行渲染只吃平铺表、缺键静默 null | 建议 | **已闭合** | 三函数均经 `resolveLabels` 归一两种形状；缺行模板键抛 `TypeError` 且消息含键名（实跑见 §1.4） |
| B-19（建议）`--payload` 分支 legend/hover 恒 null | 建议 | **部分闭合** | 标签源已能取到（payload 无 `legend`/`hover` 键时 `--project` 可填充、无源时仍 null 且 exit 0）；但 payload 显式带 `legend:null`（一代 dump 的常态）时被 `{...segments, ...source}` 覆盖回 null（见 §2、R-01） |
| B-20（建议）AC-23 缺 `badge` 断言 | 建议 | **已闭合** | `abnormal-style.test.js:101` 补 `visual.badge === 'escalated'`，四项锚点齐 |
| B-21（建议）子工作流折叠靠上游透传 | 建议 | **已闭合** | `buildView` 对 `type==='subworkflow'` 归一 `collapsed:true`（不改输入、返回新对象）；反向断言 `collapsed:false` 实存实跑 |

残留：R-01（建议，B-19 合并顺序）、R-02（建议，低，两处 `requireLabelTable` 重复）。两轮之间无新增阻断；批次 4 的 AC-19 主责锚点在真实链路上已可判。

## §1 阻断项闭合判定

### 1.1 B-16 逐条核对（按裁决 K 原文，不按实现自述）

| 裁定原文 | 结论 | 实测证据 |
|---|---|---|
| `src/daemon/http/labels.js` **只追加** 3 键 `GROUP_LABEL_CODING/RESEARCH/UNGROUPED`，既有 144 键零改动 | **成立** | `git show --numstat aca57d6`：该文件 `6 0`（纯增，零删）。载入 `07bda21` 版本与当前版本对比：`old 144 / new 147`，`added=["GROUP_LABEL_CODING","GROUP_LABEL_RESEARCH","GROUP_LABEL_UNGROUPED"]`，`removed=[]`，`changed=[]`，旧键相对顺序作为子序列保持不变（新增键插在 `DESKTOP_GROUP_ROW` 之后，未重排任何旧键） |
| 键数确为 147 | **成立** | `Object.keys(UI_LABEL_KEYS).length === 147`；`Object.keys(labelKeysPayload().keys).length === 147`；真实 `GET /ui/labels` 返回 `200` + `keys` 147 项（§1.2 实跑） |
| 键值逐字 | **成立** | `GROUP_LABEL_CODING='编码工程'`、`GROUP_LABEL_RESEARCH='研究分析'`、`GROUP_LABEL_UNGROUPED='未分组'`（同时被 `labels-desktop.test.js` 的 `EXPECTED_DESKTOP_VALUES` 冻结） |
| `labels-desktop.test.js` 精确集合与计数同步 147 | **成立** | 期望清单 `EXPECTED_DESKTOP_KEYS` 64 项（61+3）、无重复、含 3 个新键；计数断言 `144 → 147`、注释 `新增键 64 + 复用键 83 = 147`；该文件实跑通过 |
| `graph-collapse.test.js` **彻底删除**自造键（`GROUP_KEYS` / `UI_LABEL_KEYS` 拼接）改走 `labelKeysPayload()` | **成立** | 测试 diff 删除行恰为 `import { GROUP_LABEL } from '../../src/cli/labels.js'`、`GROUP_KEYS` 构造、`LABELS = {...UI_LABEL_KEYS, ...GROUP_KEYS}` 及那段注释；`grep -n "GROUP_KEYS\|GROUP_LABEL" test/wp13/graph-collapse.test.js` → 零命中；`const LABELS = labelKeysPayload().keys`，逐字用例内直接用 `labelKeysPayload()`（`{keys}` 体） |
| 组行断言逐字 `分组 编码工程 · 8 角色` / `分组 研究分析 · 5 角色` | **成立** | `graph-collapse.test.js:139-140` 两条逐字断言；round 1 那条把原始 id 回退写成期望（`'分组 coding · 8 角色'`）的断言已删除 |

补充：`http-channel.test.js` 的 144→147 属裁决 K 文末「补充授权」的连带改动，diff 恰为 **1 个断言 + 2 处注释/用例名**（`assert.equal(...,147)` 与两处 `144-key` 改 `147-key`），未越权（§3②）。

### 1.2 关键复核：真实键表 + 真实投影组节点跑 `renderSpecialRow`（自建端到端，不用测试夹具）

脚本 `/tmp/rev4b/check_group_row.mjs`，链路全部为生产代码，无替身：

```
临时根写入 13 个 role yaml（8×coding c1..c8 / 5×research r1..r5）+ .orch/hosts/mock.json
  → bin/orch.js run --cwd . --template single --host mock --task 'write a note'      # status 0, INST-001
  → 写入 .orch/workflows/registry-flow.yaml（13 个 role 节点 + 12 条链式边），state.json 加 workflowRef
  → orch core stop
  → node src/daemon/serve-entry.js --project <root> --desktop                         # 生产入口，落 .orch/desktop.json
  → GET http://127.0.0.1:<port>/ui/labels (Bearer)  -> 200, keys 147
  → node desktop/harness/graph-dump.mjs --project <root> --instance INST-001 --payload /tmp/rev4b/graph13.json
     dump exit 0；nodes 17（role 14 + group 3），
     projected group nodes = [group:coding(8) / group:coordinator(1) / group:research(5)]
  → renderSpecialRow(真实组节点, 真实 GET body 的 {keys})
```

实跑输出（真实投影 + 真实下发标签，`{keys}` 与平铺表两形状同值）：

```
ROW[coding]      body={keys} -> "分组 编码工程 · 8 角色"   | flat -> "分组 编码工程 · 8 角色"
ROW[research]    body={keys} -> "分组 研究分析 · 5 角色"   | flat -> "分组 研究分析 · 5 角色"
ROW[coordinator] body={keys} -> "分组 coordinator · 1 角色" | flat -> "分组 coordinator · 1 角色"   # 裁决 K 已知限制
```

按字节与 AC-19 Then 原文（`requirement.md` L545）比对：两条均 `Buffer.equals` **true**，码点数 14/14。

> 说明：`coding`/`research` 两组各 8/5 与 AC-19 Given 一致；多出的 `group:coordinator(1)` 来自 `single` 模板绑定的内置角色，属真实数据（也顺带验证了 K 的「未登记组名回退原始 id」）。`coordinator` 若建中文键会撞 31 词禁词表，故回退 id 是 K 的既定选择，不是缺陷。

### 1.3 与 round 1 的差别

round 1 的 `分组 coding · 8 角色` 只能靠测试自造 `GROUP_LABEL_*` 掩盖；本轮真实链路第一次具备「可判」条件：键在 `GET /ui/labels` 里真实下发、组节点由 `buildGraph` 真实产出（`src/daemon/graph.js:447-463`），行文本由 `desktop/ui` 纯模块生成（判定口径 1）。**B-16 闭合成立。**

## §2 建议项闭合判定

**B-17（已闭合）**：`node-rows.js:209-214` `groupNameOf` 顺序为 `GROUP_LABEL_<UPPER(group)>` → 缺失 group 时 `GROUP_LABEL_UNGROUPED` → 原始 id（不再回退 `node.title`，也不再落到占位符）。`graph-collapse.test.js:201` 断言逐字 `分组 未分组 · 3 角色`，实跑通过。
　观察（不影响判定）：`role-schema.js` 把 `group` 列为必填，故「缺失 group」在注册表路径下不可达，只可能来自旧状态/未注册角色；真实链路无法复现 3 成员未分组桶，该条以模块级 + 真实键表验证为准。

**B-18（已闭合）**：`renderRoleRow` / `renderSpecialRow` / `renderEdgeRow` 入口统一 `resolveLabels(labels).keys`（`node-rows.js:88-101`、`edge-rows.js:49-63`），**没有第二套形状判断**；JSDoc 声明两种形状；缺行模板键抛错。实跑（`/tmp/rev4b/check_b19.mjs`、`check_group_row.mjs`）：

```
renderRoleRow(roleNode, {})   -> TypeError: renderRoleRow: label table (flat keys or { keys } payload) is missing DESKTOP_ROLE_ROW
renderEdgeRow(edge, {})       -> TypeError: renderEdgeRow: label table (flat keys or { keys } payload) is missing DESKTOP_EDGE_ROW
renderSpecialRow(groupNode,{})-> TypeError: renderSpecialRow: label table (flat keys or { keys } payload) is missing DESKTOP_GROUP_ROW
role row body/flat equal: true  "角色 执行者 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 异常 0"
edge row body/flat equal: true  "连接线 c1→c2 · 正向 · 未开始"
```

`{keys:{DESKTOP_GROUP_ROW:…}}` 不抛（只缺可选组名键时按 K 回退原始 id / 未分组 / 占位符），与「缺**必需**键才抛」的裁定意图一致。

**B-19（部分闭合）**：`graph-dump.mjs:247-250` 在 re-export 分支加了 `--project` 标签源，`USAGE_ERROR` 与头部用法注释同步写明「无标签源时 `legend`/`hover` 保持 `null`」。实跑三分支（临时根 + 生产 `serve-entry --desktop`）：

```
A payload 不含 legend/hover 键 + 无 --project   -> exit 0, legend=null, hover=null            ✅ 符合注释
B payload 不含 legend/hover 键 + --project      -> exit 0, legend.lines=2, hover=[opaqueIds,dimIds]  ✅ 标签源可达
C payload 含 legend:null / hover:null + --project -> exit 0, legend=null, hover=null          ❌ 修复未生效
```

C 的成因：`emit({ ...segments, ...source })`（`graph-dump.mjs:251`）把输入 payload 放在后面，源里的显式 `null` 覆盖了新算出的段。而批次 1~3 的 dump 恰好就是 `legend:null` 形状，所以「S-03 批 4 起全量导出」在**既有一代 dump 再导出**这一最常见路径上仍是 null。属建议级残留（检查点走的 `--instance` 分支不受影响），列入 R-01。

**B-20（已闭合）**：`abnormal-style.test.js:100-101` 新增 `assert.equal(renderRoleRow(node, LABELS).visual.badge, 'escalated')`。AC-23 四项在同名测试内齐备：`width/height/x/y`（L90-93）、`animation==='pulse'`+`z===1`（L97-98）、`badge==='escalated'`（L101）、连线 `color='red'/dash='solid'/arrow='back'`（L108-110）。

**B-21（已闭合）**：`collapse.js:78-83` 新增 `viewNode`，`buildView` 三处出边（全员不活跃分支 L179、无分组节点 L202、展开成员 L206）全部经它归一；返回 `{...node, collapsed:true}` 不写输入。测试 `graph-collapse.test.js:219-231` 有反向断言（`collapsed:false` → 输出 `true`，且 `source` 里仍为 `false`）。独立实跑：

```
out.collapsed true | same ref? false | input mutated? false
threshold0（走 active 分支）out.collapsed true | input still false
```

## §3 回归检查与边界

### ① 文件集合与授权（9 文件，精确、无多无少）

| 文件 | 授权依据 |
|---|---|
| `src/daemon/http/labels.js` | 裁决 K 点名 |
| `test/wp13/labels-desktop.test.js` | 裁决 K 点名（D-10 清单内） |
| `desktop/ui/graph/node-rows.js` / `edge-rows.js` / `collapse.js` | 裁决 K「WP-6 文件」 |
| `desktop/harness/graph-dump.mjs` | 裁决 K（B-19） |
| `test/wp13/graph-collapse.test.js` / `abnormal-style.test.js` | 裁决 K「相关 wp13 测试」 |
| `test/wp13/http-channel.test.js` | K 文末**补充授权**追认（144→147 派生） |

无第 10 个文件、无新增文件、无删除文件。

### ② 禁改路径零改动（`git diff --name-only 07bda21 aca57d6 -- <path>` 逐项）

`src/core` 0、`src/cli` 0、`src/persistence` 0、`src/registry` 0、`src/templates` 0、`package.json` 0、`desktop/ui/list` 0、`desktop/ui/board` 0、`desktop/ui/app.js` 0、`desktop/ui/index.html` 0、`desktop/ui/graph/layout.js` 0、`view.js` 0、`legend.js` 0、`style.js` 0、`highlight.js` 0、`desktop/ui/labels/labels.js` 0。

### ③ 零 CJK（自己扫）

Python 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]`：`desktop/ui` 13 文件 **0 命中**、`desktop/harness` 5 文件 **0 命中**（含注释）。新增中文只出现在 `src/daemon/http/labels.js`（标签源本体）与测试，符合 D-7。

### ④ 零依赖

`dependencies` 0、`devDependencies` 0；改动文件只 import `node:*` 与仓库相对模块。

### ⑤ 原有 AC 断言是否被削弱（逐条看删除行）

`git diff 07bda21 aca57d6 -- test/` 的全部删除行 = 自造键机制 5 行（`GROUP_LABEL` import / `GROUP_KEYS` / `LABELS` 拼接 / 注释）+ 两条错误期望（`分组 coding · 8 角色`、`分组 — · 3 角色`）+ 144 计数与注释。**没有任何 AC-11/12/13/19/23/25/33 断言被删除或放宽**：

- `role-node.test.js` / `special-node.test.js` / `labels-policy.test.js` / `hover-highlight.test.js` 本轮**零改动**；
- `graph-collapse.test.js`：三条旧断言 → 三条新断言（两条逐字 + 一条 `ops` 回退），净持平且覆盖更真；另加 3 行 B-21 反向断言；
- `abnormal-style.test.js`：纯增 1 条（B-20）；
- `labels-desktop.test.js` / `http-channel.test.js`：只有 144→147 的期望值/注释同步，无断言语义放宽。

### ⑥ 键值/键名消费纪律

六个模块内无 `'code-loop'`/`'single'`/`task-loop'` 等资产字面量；组名只经 `GROUP_LABEL_*` 取值，模块内无中文硬编码；`GROUP_LABEL_COORDINATOR` 未创建（避免 31 词禁词表报红），符合 K。

## §4 门禁复跑输出

### ① 8 文件串行（`--test-concurrency=1`）

```
NODE_ENV=test node --test --test-concurrency=1 \
  test/wp13/labels-desktop.test.js test/wp13/graph-collapse.test.js test/wp13/abnormal-style.test.js \
  test/wp13/role-node.test.js test/wp13/special-node.test.js test/wp13/labels-policy.test.js \
  test/wp13/hover-highlight.test.js test/wp13/http-channel.test.js
1..74  # tests 74  # pass 74  # fail 0  # skipped 0   (11.8s)
```

（round 1 六文件为 37 条；本轮补齐 `labels-desktop` / `http-channel` 后 74 条全绿。）

### ② 全量串行（约 16m14s）

```
NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
1..1328  # tests 1328  # pass 1321  # fail 6  # skipped 1
not ok 101  - NFR-02: verifyProducts({sha256:true}) p95 <= 50ms（1MB / 5MB 文档）
not ok 1022 - task-loop 审核提示词给绝对路径…
not ok 1073 - core.stop：先回包再断连，5s 内收敛…
not ok 1081 - cursor.json 并发消费 20 次不重复
not ok 1091 - main：--cwd 相对当前 shell 目录解析…
not ok 1190 - 早返回：turn-delay 3000ms…
```

归因：6 条 **全部**在 `docs/iterations/iteration-7/baseline-failures.txt` 的 8 条基线内（含两条 NFR-02）。单跑 `test/wp10/perf.test.js` → `2 tests / 2 pass / 0 fail`，故第 6 条为负载型 flake（与裁决 F 口径一致）。
**差集 = 0**；测试条数 1328 与基线一致（本轮无新增用例文件，只有断言增补）。

### ③ purity（两轮）

```
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>
  -> OK: 扫描 29 个文件 … 零命中, exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness
  -> OK: 扫描 18 个文件 … 零命中, exit 0
```

### ④ 批 4 检查点（裁决 J，临时根 `--host mock`）

```
orch run --template code-loop --host mock  -> INST-001（exit 4 = 升级待处理，模板固有终态）
orch core stop -> node src/daemon/serve-entry.js --project <root> --desktop -> desktop.json 就绪
node desktop/harness/graph-dump.mjs --project <root> --instance INST-001 --payload /tmp/rev4b/graph.json
  dump exit 0；nodes 3 / edges 2
  legend.lines 长度 2，两条与 A-8 逐字相等（比对结果 true / true）
  hover = { opaqueIds:[…](1), dimIds:[…](4) }，键恰 [opaqueIds, dimIds]，均非空
```

另用 13 角色真实工程（§1.2）复核同两段：`legend.lines=2` 逐字、`hover` 1 / 28 非空，说明组节点场景下 harness 同样可用。

## §5 残留项清单

| 编号 | 内容 | 严重度 | 建议修法 |
|---|---|---|---|
| R-01 | `graph-dump.mjs` re-export 分支 `emit({ ...segments, ...source })` 让输入里显式的 `legend:null`/`hover:null` 覆盖刚算出的段；批次 1~3 的 dump 正是该形状，B-19 在最常见路径上仍输出 null（`--instance` 分支不受影响） | **建议** | 改为「源在前、非空段在后」：`emit({ ...source, ...(segments.legend===null?{}:{legend:segments.legend}), ...(segments.hover===null?{}:{hover:segments.hover}) })`，或先删除 `source.legend`/`source.hover` 再合并；补一条「`legend:null` 输入 + `--project` → 非 null」的回归断言 |
| R-02 | `node-rows.js` 与 `edge-rows.js` 各有一份 `requireLabelTable` + `textOf`；形状判断已统一走 `resolveLabels`（符合 B-18），但「必需键校验 + 取值」仍是两份实现 | **建议（低）** | 下沉到 `labels/labels.js`（如 `requireKeys(table, keys, owner)`），供 WP-8 第三处消费直接复用，避免再抄第三份 |
| — | （观察，不列残留）`coordinator/writing/ops` 组在真实图显示英文 id（`分组 coordinator · 1 角色`）；`GROUP_LABEL_*` 三键未在 `requirement.md` A-14 表内登记，仅登记于 `decisions.md` 裁决 K 与代码注释 | — | 均属裁决 K 明示的已知限制与 B-04 先例（「不回改需求正文」），零动作；后续补名时是纯数据改动 |

**进入批次 5 的结论：可进（WP-8 可开工）。** R-01/R-02 均不影响 WP-8 装配：WP-8 用的是 `GET /ui/labels` 的 `{keys}` 通道 + `renderLegend` / 行渲染函数，不经过 `graph-dump` 的 re-export 分支；R-01 建议在主控做 S-03 全量导出留档前顺手修掉（一行合并顺序 + 一条断言）。

**WP-8 仍需遵守的消费前提**（round 1 §6.3 清单仍然有效，本轮补充两条）：

1. 行渲染函数现在**缺必需键即抛错**，装配时必须传 `resolveLabels(payload).keys` 或直接传 `{keys}` 体；不要用局部表调用（`{}` 会 `TypeError`）。
2. 组行只对 `coding/research/未分组` 有中文名；其余组显示原始 id，这是 K 的既定行为，不要在图里另造映射。
3. 折叠模型与布局的衔接、`toggleGroup` 入参是模型、`hoverSet` 要在折叠之后调用、边行需注入 `fromTitle/toTitle`、`z` 双源择一 —— 同 round 1 §6.3 第 2~8 条。

> 环境卫生：全量跑会重写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`（平台字段 win32→darwin + 本机耗时），复评后已 `git checkout --` 还原，工作区仅余评审前就存在的 `.workbuddy/memory` 改动；`/tmp/rev4b/*` 为本次复核脚本与中间产物，未进仓库。
