# I1.11 需求评审记录 · 第 4 轮（独立评审）

## §0 总判

- **总判：PASS**
- **阻断 0 项 / 建议 6 项（I-01 ~ I-06）**。
- **评审对象**：`docs/iterations/iteration-11/requirement.md` **v6**，实测 **1421 行**；头部第 7 行 `版本：v6`，附录 C 末行（第 1284 行）`v6（2026-11-16）`，一致。
- **复核方式（全部实跑，不采信自述与裁决结论性措辞）**：
  - 机械计数与结构审计（Node 脚本 `/tmp/audit-i11-r4.mjs`）：`grep -cE '^\*\*AC-'` → **49**；`grep -c '^- \*\*BR-'` → **37**；`grep -c '^- \*\*NF-'` → **8**；AC/BR/NF 编号连续、无重复、无缺号；49 条 AC 三件套 / `**Then**` / ≥1 锚点齐全；37 条 BR 全被引用、无悬空引用；括号填写指引 0 命中。
  - 第三轮 5 项阻断的锚点逐条在基线 `66e5a6b` 上实跑（§2），包括 AC-18 内嵌的 Node 函数体切块脚本（逐字运行，输出与需求声称一致）。
  - 语义冲突回到代码现状核对：`src/cli/render.js`（CLI 行分隔符）、`src/core/orchestrator.js:5072–5076`（`pass && terminal → completed`）、`src/templates/index.js:158–207`（`single` 只有 `T-001`/`worker`；`code-loop` 的 `T-001 developer` 非终态、`T-002 tester` 下游、`coordinator` 声明未派发）、`src/daemon/server.js:900–912`（`shapeSnapshot` 回退计数）、`src/daemon/http/stream.js:255`（`applyTestOverlay` 只贴图投影）、`src/registry/workflow-schema.js:124–132`（未知 `node_type` 校验失败）。
  - 全量测试实跑：`env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"` → **`# tests 1425` / `# pass 1420` / `# fail 4` / `# skipped 1`**，与 §3.3 第 879 行记录一致（`git diff --name-only 66e5a6b..HEAD` 确认基线以来仅 docs/memory 变更，src/ 与 test/ 与第三轮实跑时逐字节相同）。
- **总体结论**：v6 对第三轮 5 项阻断（H-01~H-05）的修法与裁决 D-36~D-40 一致，且全部锚点在基线上实测成立；14 条建议（H-06~H-19）除 H-16 留 1 处否定句位置残留外全部落地。本轮独立重扫未发现新的阻断：覆盖表 10/10「覆盖」、反向扫描无夹带无缺漏、前两轮已 PASS 条目无回归、37 条 BR 与 49 条 AC 的引用语义核对仅 1 处弱引（建议级）。剩余 6 项均为措辞 / 授权明确性 / 可读性问题，按判定规则降为建议，不构成阻断。

---

## §1 第三轮 H-01~H-19 逐条三态复核表

> 三态：**已修** = 改到位且关联处无矛盾；**未修** = 要求未落地；**又引入新问题** = 该处改了但留下新的互斥断言。行号均为 v6。

### 1.1 五项阻断（H-01 ~ H-05）

| 编号 | 三态 | v6 行号 | 依据（含实测） |
|---|---|---|---|
| **H-01** AC-18 计数口径 | **已修** | 头部 `8`；AC-18 `486–505` | 正文改为「`src/daemon` 5 行、全仓 3 处计数（core / persistence / daemon 的 `shapeSnapshot` 回退）」；断言锁「`desktop/ui` 与 `desktop/src-tauri/src` 零计算 + `src/daemon` 的计数只许出现在 `shapeSnapshot` 内」（`495`）；单行 grep 已删并明写「**不得再作为判据**」（`497`）；多行感知检查（`-A3`）与 Node 函数体切块脚本均已写入（`498–501`），脚本逐字运行输出 `occurrences=5 countExpr=2 outsideShapeSnapshot=0`、exit 0，与需求声称**逐字一致**；第 4~6 条 grep（`502–504`）实测全部符合；第 7 条明写不改 `shapeSnapshot` 与 core/persistence（`505`，D-36④）。实测细节见 §2.1。唯一瑕疵：`502` 行括注「`src/daemon/server.js:901–912`」实际函数体为 **900–912**（差 1 行），主锚点数字（897 / 903 / 904 / 905 / 910 / routes.js:156）全部逐行准确 → 记 I-06（建议）。 |
| **H-02** AC-17 分隔符 | **已修** | AC-17 `475–484` | 机检 `482` 改为「**两侧行各按本侧分隔符拆**（D-37）：CLI 升级行按**两个空格**（`\s{2,}`）拆成 5 段、桌面行按 ` · ` 拆 7 段，归一化后逐项相等；CLI 审批行按 ` · ` 拆、只比 `{编号, 状态词, 动作}`」；并写明「**不出现「审批行字符串相等」这类断言**」。基线事实核实：`sed -n '1256,1280p' src/cli/render.js \| grep -Ec "join\('  '\)"` → **1**；`grep -REn "parts.join\(' · '\)" src/cli/render.js` → **4 处**、`1155` 是 `renderApprovalLine`——与机检括注逐项一致（§2.2）。CLI 升级行第 3 段内部确实含 ` · `（`renderEscalationListRow` 的 nodePart），与机检的 5 段描述吻合。 |
| **H-03** AC-01 single 现场 | **已修** | AC-01 `299–308`；AC-02 `310–319`；AC-03 `321–330`；AC-38 `716–726`；A-0 `924` | AC-01 Given（`303`）统一为 `single` 可构造现场（唯一节点 `T-001`、角色 `worker`/中文名「执行者」、第 1 轮）；Then（`305`）与机检（`306`）逐字断言第 3 段 `节点 T-001 执行者`、第 4 段 `第 1 轮`，不再出现 `T-003` / 第 2 轮；A-0 新增「样例值声明（D-38）」（`924`），明写 A-1 样例行的 `T-003 开发`、`第 2 轮` 是示例值、按可变值替换；AC-02（`316`）/ AC-03（`327`）的 Then 同步改 `T-001 执行者`；AC-38（`723`）只断言第 1/2 段，不涉节点与轮次样例。实测 `sed -n '145,180p' src/templates/index.js`：`single` = `T-001` / `roles:['worker']` / `terminals:['T-001']` / `maxRounds:{'T-001':1}`；`node bin/orch.js role show worker` → `worker 执行者`。Given 可构造。 |
| **H-04** AC-09 终态/非终态 | **已修** | AC-09 `387–396`；BR-08 `251`；§2.4 `138` | AC-09 拆两种现场：`INST-001`（`single`，`T-001` 终态）判通过 → 实例「**已完成**」；`INST-003`（`code-loop`，入口 `T-001`「开发」非终态）判通过 → 实例保持「**运行中**」且下游 `T-002`「测试」被唤醒（`393`）；BR-08（`251`）与 §2.4（`138`）同步为「终态节点 → 已完成；非终态节点 → 运行中且下游被唤醒，不得一律写成运行中」。代码实测 `src/core/orchestrator.js:5072–5076`：`const instanceTo = decision === 'fail' ? 'failed' : decision === 'pass' && terminal ? 'completed' : 'running'` —— 需求与基线行为一致。夹具（`395`）`code-loop` 模板实测：`T-001 roleId:developer`（标题「开发」，非终态）、`T-002 roleId:tester`、`terminal:'T-002'`，与 Given 吻合；Given 补 `INST-002` 对照实例（H-18①）。 |
| **H-05** AC-28 占用夹具 | **已修** | AC-28 `606–615`；AC-26 `592`；AC-27 `603` | When（`611`）改经既有 `test.dispatch` 接缝真实派发；夹具（`614`）改「手写 `state.json`（按 §3.3 快照顺序）+ `test.dispatch` 真实派发」，并明写「**不许**用 `POST /__test__/graph/pulse` 造占用数据（D-40：pulse 只写 `overlayByInstance` 并贴到图投影，不写 `state.json`，占用投影读不到）」。代码实测：`src/daemon/http/server.js:451` 的 pulse 端点 → `src/daemon/http/stream.js:255` `applyTestOverlay` 只 patch `graph.nodes[].status`，不触 `state.json` —— 需求的禁止理由与代码事实一致。AC-26 夹具（`592`）、AC-27 夹具（`603`）均为「先起核再写盘」，无 pulse 残留。 |

### 1.2 十四条建议（H-06 ~ H-19）

| 编号 | 三态 | v6 行号 | 依据 |
|---|---|---|---|
| **H-06** A-10 补 AC-47 | **已修** | A-10 `1209`、`1215` | A-3 行覆盖 AC 列含 `AC-47`；A-9 行亦含 `AC-47`（托盘 `—` 参与断线断言）。 |
| **H-07** A-2 分项开关序号 | **已修** | A-2 `967` | 改为「第 1 项 `通知` 是总开关；第 **2~4** 项…是分项开关名，与总开关同组」，与 A-2 代码块 5 行一致。 |
| **H-08** BR 引用校正 | **已修** | AC-17 `478`；AC-38 `719`；AC-40 `745`；AC-16 `470`；AC-28 `609` | AC-17 → `BR-06, BR-27, BR-31`（D-41①）；AC-38 补 `BR-33`（其机检断言五段正文模板）；AC-40 删 `BR-27`（现为 `BR-26, BR-28`，其 Then/机检无状态词断言）；AC-16 补「**状态词逐字不变**——`INST-001` 仍为「运行中」、`ESC-002` 仍为「待处理」、`APR-003` 仍为「待处理」（BR-27）」（`470`，机检 `471` 同步），保留 BR-27 成立；AC-28 → `BR-16, BR-37`（D-41⑤ 取「只留 BR-16」并补时效引）。 |
| **H-09** 数值上限 | **已修** | AC-21 `536`；AC-34 `678`；A-5 `1102` | AC-21 明写「正文摘要行数 **≤ 20 行**（`BODY_PREVIEW_LINES = 20`，常量落在 `src/daemon` 侧）」并配两条恰 N 命中的 grep；AC-34 明写「单次渲染文本长度 **≤ 64 KB（65536 字节）**」；A-5 明写「`n` = min(正文总行数, **20**)」。 |
| **H-10** `readable` 三态 | **已修** | B-1 `1247`；D-6 `1357`；AC-29 `623–624`；AC-45 `807`、`809` | B-1 新增 `readable`/`valid` 正交三态定义；D-6 同口径；AC-29 的 `partial-flow` 断言引用 B-1 口径并**补「校验不通过」标签逐字断言**（`624`）；AC-45 架构检查改「显示分支由 `{readable, nodes.length}` 两者共同选择，见附录 B-1」。残留：三态表未定义「定义取不到」（文件不存在 / 无读权限）时 `readable` 的取值 → I-01（建议）。 |
| **H-11** 「内容为空」入 AC | **已修** | AC-45 `804`；BR-19 `262`；§2.7 `190` | AC-45 增现场二「定义文件**存在但内容为空**（0 字节）」并断言 `定义 空`；BR-19 与 §2.7 的四类枚举补「内容为空」，六处分工一致。 |
| **H-12** A-5 角色详情示例 | **已修** | A-5 `1076`、`1101` | 示例改「技能 引用 2 个 · doc-draft, missing-skill」，并明写「被引用的两个技能中 `missing-skill` 就是缺失的那个，故校验原因为它（H-12）」，示例可原样构造。 |
| **H-13** A-6 宿主统一 | **已修** | A-6 `1109–1112`、`1125`；A-0 `922` | 四行示例统一 `宿主 mock`（未参与行 `宿主 —`），`1125` 行说明取 `hostId`、§3.3 夹具一律 `--host mock`；A-0 可变值表补「宿主」一行。 |
| **H-14** AC-08 / AC-15 现场 | **已修** | AC-08 `380`；AC-15 `457` | AC-08 明写 `APR-009` 在「**另一个独立项目根** `/tmp/maestro-i11-queue-nonode`」、不入 3 行队列也不参与排序断言；AC-15 固定 `reasonCode: "rounds_exceeded"`（使「继续」可点，与 AC-44 共用同一组约定）。 |
| **H-15** prefs 写入授权 | **已修** | BR-25 `268`；§1.3 `55–56`；AC-39 `734`；D-11 `1400` | BR-25 把「本机通知开关偏好」列为写操作并限定「只写 `.orch/desktop/prefs.json`，不碰实例状态、资产与事件日志」；§1.3 与 NF-7（`863`）同步；AC-39 明写「通知开关偏好对 `prefs.json` 的写入不计入这三个数字…写其它键即判失败」；D-11 新增文件清单列 `src/daemon/prefs.js` 并限定「只读写四个开关键、原子写入」（D-42）。残留：「六类」计数与列举不符 → I-02（建议）。 |
| **H-16** 「批量」字样收敛 | **部分修** | 命中行 `67`、`1007`、`1275`、`1276`、`1280`、`1282`、`1286`、`1320`、`1412` | 命中由 12 处降为 9 处；`67`（§1.3 范围外）、`1275/1276/1280/1282/1286`（附录 C）、`1320`（附录 D-1 否定）、`1412`（附录 D-13 否定）共 8 处落在允许语境；残留 `1007`（A-4「只有单条终止，没有批量确认句——批量已按 D-01 移出范围」）是**否定句**，但按 D-43 的字面允许清单（§1.3 / 附录 C / BR·AC 否定表述）与任务口径（§1.3 范围外 / 附录 C / D 附录否定）都在附录 A 之外 → I-05（建议，不阻断）。**能力级残留：0**（无任何正面批量表述）。 |
| **H-17** AC-22 / AC-26 夹具锚定 | **已修** | AC-22 `548`；AC-26 `592` | AC-22 夹具补「同一项目根写**两份**定义」（`release-flow.yaml` + `sub-flow.yaml`）、5 个角色节点取**注册表已存在的内置角色 id**（`developer`/`tester`/`reviewer`/`code-reviewer`/`writer`），并明写 `WORKFLOW_ROLE_UNKNOWN` / `WORKFLOW_SUB_UNKNOWN` 的失败机理；AC-26 夹具写明 `nodes[].roleId` 直接写内置角色 id、`sessions[].hostId` 写 `mock`、`buildRoleInstances` 取「定义声明的角色 ∪ 节点绑定的角色」、`coordinator` 作「未参与」行属预期（实测 `code-loop` 确实声明 `roles:['developer','tester','coordinator']`，吻合）。 |
| **H-18** 三处残留 | **已修** | AC-09 `391`；AC-02 `316`；AC-03 `327`；AC-07 `374` | ① AC-09 Given 补 `INST-002` 对照实例（Then/机检的 `deepEqual` 有对象）；② AC-02/03 的 Then 改 `T-001 执行者`；③ AC-07 架构检查改「锚点打在投递路径 `src/daemon/notify.js`（S2 新建，基线 exit 2 属预期）+ 行为断言（3 条 `delivered=false` 且实例继续推进、处置 2 秒内生效）兜底」。 |
| **H-19** 四处收口 | **已修** | BR-17 `260`；AC-27 `601`；AC-01 `305–306`；BR-37 `280`；NF-3 `859` | ① BR-17 改「**全部实例状态都不可读、或没有任何实例**时显示『角色占用 无』」；② AC-27 补「导出的动作清单不含 `release` / `kick`，也不存在对应按钮」（机检 `602` 同步）；③ AC-01 补「触发通知前后五组状态逐值不变」+ 机检 `deepEqual`；④ **新增 BR-37**（队列新行 / 占用刷新 2 秒时效，与 BR-36 断线口径衔接），NF-3 交叉引用，AC-08（`379`）与 AC-28（`609`）引用。 |

### 1.3 三态统计

- **H-01 ~ H-05（阻断）**：**已修 5 / 未修 0 / 又引入新问题 0**。
- **H-06 ~ H-19（建议）**：**已修 13、部分修 1（H-16）**；未修 0；又引入新问题 0。

---

## §2 五项阻断的实测验证

### 2.1 H-01（AC-18 计数口径）

```text
$ grep -REn "pendingEscalations" src/daemon/
src/daemon/server.js:897: * `instance.get` 的只读投影：补齐渲染层需要的 `template` / `pendingEscalations`，
src/daemon/server.js:903:  const pendingEscalations = Number.isInteger(snapshot.pendingEscalations)
src/daemon/server.js:904:    ? snapshot.pendingEscalations
src/daemon/server.js:910:    pendingEscalations,
src/daemon/http/routes.js:156:      escalations: Number.isInteger(snapshot?.pendingEscalations) ? snapshot.pendingEscalations : 0,
→ 5 行。与 AC-18 第 496 行所写（897 注释 / 903 / 904 / 910 / routes.js:156）逐行一致。

$ grep -REn "pendingEscalations[^;]*(filter|reduce|length|push)" src/daemon/
（0 行，exit 1 —— 单行假阴性复现，AC-18 第 497 行「不得再作为判据」的依据成立）

$ grep -REn -A3 "pendingEscalations" src/daemon/ | grep -c "filter((entry)"
1   （≥ 1，多行感知检查可检出 server.js:905 的跨行回退计数）

$ sed -n '895,915p' src/daemon/server.js
function shapeSnapshot(snapshot) {            ← 900 行
  const escalations = ...                     ← 902
  const pendingEscalations = Number.isInteger(...)   ← 903
    ? snapshot.pendingEscalations                    ← 904
    : escalations.filter((entry) => entry?.state === 'pending').length;  ← 905
  ...
}                                             ← 912
（需求括注「901–912」实际为 900–912，差 1 行 → I-06）

$ node --input-type=module -e '<AC-18 第 500 行的切块脚本，逐字>'
occurrences=5 countExpr=2 outsideShapeSnapshot=0
exit=0   （与 AC-18 第 498 行声称的输出逐字一致）

$ grep -REn "escalations[.]filter|escalations[.]reduce" src/daemon/
src/daemon/server.js:905: ... → 恰好 1 条（与第 502 行一致）

$ grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src   → 0（exit 1）
$ grep -REn "escalations[.]filter" desktop/ui/                     → 0（exit 1）
```

**结论：已修。** AC-18 的 7 条子断言全部与基线实测一致，脚本可执行且输出可复现；断言口径（界面零计算 + daemon 计数只许在 `shapeSnapshot` 内）与 D-36 一致，且不会把既有正确实现判失败（`outsideShapeSnapshot=0` 在基线即成立）。

### 2.2 H-02（AC-17 分隔符）

```text
$ sed -n '1256,1280p' src/cli/render.js | grep -Ec "join\('  '\)"
1                                  ← renderEscalationListRow（1276 行），AC-17 括注「→ 1」一致
$ grep -REn "parts.join\(' · '\)" src/cli/render.js
231 / 291 / 565 / 1155   ← 4 处，1155 是 renderApprovalLine，AC-17 括注一致
$ sed -n '1143,1157p' src/cli/render.js
renderApprovalLine：parts = [`审批 {id} {state}`, (节点…，非 single 才有), `动作 {action}`].join(' · ')
$ sed -n '1272,1277p' src/cli/render.js（renderEscalationListRow 尾部）
return [ `${LAYER.escalation} ${id}`, `${LAYER.instance} ${instanceId}`, nodePart, state, reasonDetail ].join('  ');
nodePart = `节点 ${nodeId} ${role} · 第 ${round} 轮`
```

**结论：已修。** 机检的「CLI 升级行按 `\s{2,}` 拆 5 段（第 3 段 `节点 {节点号} {角色} · 第 {n} 轮`）/ CLI 审批行按 ` · ` 拆只比 `{编号, 状态词, 动作}` / 桌面行按 ` · ` 拆 7 段」与两侧行的真实结构一致，正确实现可通过；「审批行字符串相等」断言已不存在（全文 `renderApprovalLine` 仅 4 处命中且全为禁止性表述）。

### 2.3 H-03（AC-01 single 现场）

```text
$ sed -n '158,178p' src/templates/index.js
single: { id:'single', title:'单节点', entry:'T-001', terminal:'T-001',
          terminals:['T-001'], maxRounds:{'T-001':1}, roles:['worker'],
          nodes:[{ id:'T-001', roleId:'worker', ... }] }
$ node bin/orch.js role show worker
- worker 执行者 · 通用协调 · document · write · 技能 0 · 并发 1
```

**结论：已修。** AC-01/02/03/38 的 Given/Then/机检全部落在 `single` 可构造现场（`T-001` / 「执行者」 / 第 1 轮），A-0 第 924 行声明 A-1 样例值为示例；`test.escalate` 要求节点存在的约束（`orchestrator.js:4478`）不再被违反。

### 2.4 H-04（AC-09 终态/非终态）

```text
$ sed -n '5065,5076p' src/core/orchestrator.js
const nodeTo = decision === 'fail' ? 'failed' : decision === 'pass' ? 'done' : 'running';
...
const instanceTo = decision === 'fail'
  ? 'failed'
  : decision === 'pass' && terminal
    ? 'completed'
    : 'running';
$ sed -n '179,207p' src/templates/index.js
code-loop: { entry:'T-001', terminal:'T-002', roles:['developer','tester','coordinator'],
             nodes:[{T-001 roleId:'developer' title:'开发'}, {T-002 roleId:'tester' title:'测试'}],
             edges:[T-001→T-002 forward, T-002→T-001 backflow, T-001→T-002 retest] }
```

**结论：已修。** AC-09 的两种现场与 `pass && terminal → completed` 的基线行为一致；`code-loop` 的 `T-001`（developer，非终态）与下游 `T-002`（tester）真实存在，`INST-003 保持运行中 + T-002 被唤醒`可构造；BR-08 / §2.4 同步无残留旧措辞。

### 2.5 H-05（AC-28 占用夹具）

```text
$ grep -n "pulse" src/daemon/http/server.js
24: *   `POST /__test__/graph/pulse`;
351: if (method === 'POST' && pathname === '/__test__/graph/pulse') return true;
451: if (req.method === 'POST' && pathname === '/__test__/graph/pulse') {
$ grep -n "function applyTestOverlay" -A 8 src/daemon/http/stream.js
255: function applyTestOverlay(graph, instanceId) {
256:   const overlay = overlayByInstance.get(instanceId);
257:   if (!overlay) return graph;
258:   for (const node of graph.nodes) { ... node.status = patch.status; ... }
（pulse 只写 overlayByInstance 并 patch 图投影，全程不触 state.json）
```

**结论：已修。** AC-28 夹具改 `test.dispatch`（经 `orchestrator.dispatchToNode` → 既有 `dispatchInState`，真实写 `state.json`）+ 手写 state，明写禁用 pulse；AC-26 / AC-27 夹具同步为「先起核再写盘」，占用投影（读 `state.json` 角色实例）可达。

---

## §3 规划原文逐句覆盖表（重做）+ 反向扫描 + 回归检查

### 3.1 规划原文逐句覆盖表

> 来源：`docs/index.md` 878–889 行（880–886 七条 + 888 验收句按 `；` 拆三句）。判定只取「覆盖」为 PASS。

| # | 规划原文（逐字 + `index.md` 行号） | §2 落点 | §3 落点（AC） | 符合性 | 覆盖判定 |
|---|---|---|---|---|---|
| 1 | `- 通知机制：托盘通知（升级待处理、实例完成、实例异常）`（880） | §2.2 `104–116` | AC-01 / 02 / 03 / 38（+ 04 / 05 / 06 / 07 为 D-02 授权的可用性细化） | 一致（开关/去重/点击定位不新增能力域，§1.3 `46` 有来源说明） | **覆盖** |
| 2 | `- 人工干预队列界面：升级和审批统一队列，一键继续/重派/终止/允许/拒绝`（881） | §2.3 `118–130` + §2.4 `132–151` | AC-08 ~ AC-17、AC-44 | 一致（同一子项拆「看得见 / 点得动」两面，D-06；多选与批量按 D-01 移出，§1.3 `67`） | **覆盖** |
| 3 | `- 角色库/技能库/工作流库浏览`（882） | §2.5 `153–165` | AC-19 ~ AC-25、AC-46 | 一致（来源 / 分组 / 计数 / 单文件降级均已补） | **覆盖** |
| 4 | `- 角色库运行时子视图：全局角色资源占用`（883） | §2.6 `167–178` | AC-26 / 27 / 28 | 一致（「全局」按 D-07 收窄为本机 + 本项目根，§1.3 `68`、U-3 已声明） | **覆盖** |
| 5 | `- 工作流画布（只读）：复用角色流程图布局算法，展示定义态角色图`（884） | §2.7 `180–191` | AC-29 / 30 / 31 / 45 | 一致（复用 `computeLayout`，无运行时字段；降级分工六处一致） | **覆盖** |
| 6 | `- 证据浏览独立视图：按节点查看产出证据（命令、退出码、产物引用）`（885） | §2.8 `193–204` | AC-32 / 33 / 34 | 一致（补「关键输出行数 / 日志引用」，基线 506 行有据） | **覆盖** |
| 7 | `- 托盘交互：实例数/待处理升级数、暂停/退出`（886） | §2.9 `206–217` | AC-35 / 36 / 37 / 48 | 一致（「继续」为暂停同项逆操作，U-4；退出语义沿用 I1.10a） | **覆盖** |
| 8 | 验收句第 1 句：`升级请求触发托盘通知`（888） | §2.2 | AC-01、AC-38 | 一致 | **覆盖** |
| 9 | 验收句第 2 句：`人在面板上完整走"发现问题→查看证据→处理升级→实例继续"`（888） | §2.10 `219–240`、§2.4 | AC-38（「实例继续」由 AC-14 单立判） | 一致 | **覆盖** |
| 10 | 验收句第 3 句：`角色库运行时子视图显示全局角色占用`（888） | §2.6 | AC-26、AC-27 | 一致 | **覆盖** |

**表级结论：10/10「覆盖」，无「部分 / 缺漏 / 越界 / 收窄」。** 覆盖成立且本轮五项锚点均已可判定（第三轮表级结论中挂着的 AC-01 / AC-28 不可判定问题已闭合）。

### 3.2 反向扫描 ①：§2 / §3 反查规划来源（无来源 = 夹带）

| 需求条目 | 来源 | 判定 |
|---|---|---|
| §2.2 通知开关 / 10s·60s 去重 / 点击定位 | 880「托盘通知」 | 细化（D-02 已在 §1.3 `46` 逐条注明），不判夹带 |
| §2.3 八字段行 / 排序 / 空态 / 断线降级 / 新行 2 秒 | 881「统一队列」+ 基线 511「可查询队列」 | 有来源（新行 2 秒已立 BR-37） |
| §2.4 五种动作 / 处理后续跑 | 881 五种动作 + 888 第 2 句 | 有来源 |
| §2.5 三类库列表 / 详情 / 校验 / 计数 | 882 + 基线 307–325 / 329–344 | 细化，不判夹带 |
| §2.6 聚合 / 宿主 / 折叠 / 排序 / 刷新 2 秒 | 883 + 基线 208–222 | 有来源（刷新时效已立 BR-37） |
| §2.7 缩放 / 平移 / 复位 / 降级 | 884「只读」+ 基线 462–469 | 细化，不判夹带 |
| §2.8 五项（含行数 / 日志引用） | 885 三项 + 基线 506 | 有基线来源 |
| §2.9 暂停 / 继续 / 退出 | 886 + U-4 逆操作 | 有来源 |
| §1.3 `prefs.json`（只存通知开关） | BR-03 的本机持久化落点 | 机制落点；写入方 `src/daemon/prefs.js` 已入 D-11（D-42） |
| AC-39 / 40 / 41 / 43 | 基线 626–629 / 913、阶段一退出条件、回归红线 | 跨切面约束，不判夹带 |
| AC-42 七种异常提示 | §2.2/2.3/2.5/2.7/2.8 的异常段 + BR-32 | 有来源 |
| AC-47 断线保留 / 补全 | 881 队列失败路径 + BR-36 | 有来源 |
| AC-49 点击通知时已处理 | §2.2 `112` + BR-02/BR-09 | 有来源 |
| BR-37（本轮新增） | §2.3 `126`、§2.6 `176` 的时效规则（881 / 883 的可用性） | 有来源，非夹带 |

**结论：无「夹带」项。**

### 3.3 反向扫描 ②：基线状态词 / 能力域反查 §2 落点（无落点 = 缺漏）

| 基线项 | §2 落点 | 结论 |
|---|---|---|
| §3.1 节点 9 态 / 看板 7 列（129–168） | §2.4、§2.8；A-0 `900` 的 7 个显示词 | 无缺漏 |
| §3.2 会话 6 态（170–193） | §2.6「活跃会话数」；不展开会话状态 | 不相关（属 I1.10a/b） |
| §3.3 角色 6 态与实例数据模型（195–222） | §2.6 五态 +「未参与」；A-0 同；`max_concurrent_sessions` → 角色详情 | 无缺漏（`retired` 按基线不显示） |
| §3.4 交接包 7 态（224–246） | 不展示；§2.7 `188` 明写不显示连接线聚合状态 | 不相关（属 I1.10b） |
| 能力域 1（307–325） | §2.5、§2.6 | 有落点 |
| 能力域 2（329–344） | §2.7 | 有落点 |
| 能力域 4（365–412） | §2.7 明确不画连接线聚合 | 有落点（收窄已声明） |
| 能力域 5 视图层次（416–439） | §2.5–§2.9 | 有落点 |
| 5.4 产物存储（498–501） | §2.8 产物引用 | 有落点 |
| 5.5 三层日志（503–507） | §2.8 五项证据 | 有落点 |
| 5.6 队列与通知（509–512） | §2.2、§2.3、§2.4 | 有落点 |
| 5.8 健康度（532–541） | §2.2 异常通知取「需关注」 | 有落点 |
| 5.2 数据布局（600–614） | §1.3 `56` `prefs.json`（仅通知开关）；既有目录语义不变 | 有落点 |
| §6 第 7 / 9 / 10 条（626–629） | §2.7、§1.3、BR-29 | 有落点 |

**结论：无「缺漏」项。**

### 3.4 回归检查（前两/三轮已 PASS 条目在 v6 是否被改坏）

| 检查项 | 结果 |
|---|---|
| 覆盖表第 1–10 行（round1/2/3 均判「覆盖」） | v6 仍全部覆盖；888 三句的承接 AC 未变 |
| F-01 审批行八字段 / A-3 七段模板 | A-3 `988–990` 完好；AC-08 降级断言（`APR-009`，`383`）完好 |
| F-02 `computeLayout` 锚点 | AC-29 `626` 完好；实测 `desktop/ui/graph/layout.js:45` 恰 1 条 |
| F-03 画布三现场 | AC-31 `639–648` 与 A-7 `1139` / BR-19 `262` / §2.7 `190` 六处分工一致 |
| F-04 来源/分组/计数 | A-5 `1053–1070`、AC-19/21/22 的来源与计数断言完好 |
| F-11 通知正文五段 | BR-33 `276` / A-1 `951` / AC-01 `305` / AC-38 `724` 一致 |
| F-12「已处理」新键 | A-2 `963–969` / A-11 `1225` / AC-15 `459` / AC-49 `853` 一致 |
| G-03/G-04 全量口径 | AC-41 `763` 与 §3.3 `879–884` 仍为「差集 0 + 条数下限」，无 `fail === 0`（grep 0 命中） |
| G-06 AC-36 三实例 | `698` Given「三个运行中实例（其中两个可读、一个损坏）」与 Then「2 暂停 1 跳过」仍一致 |
| G-12 A-3「第 — 轮」 | `990` 完好 |
| G-13 同一份 `release-flow` | A-5 `1094–1100`、A-7 `1130`、AC-22 `544`、AC-29 `621` 仍为 7 节点 / 8 条边 / 回流 2 |
| G-16 引用精度 | AC-04→BR-02（`335`）、AC-30→BR-18（`631`）、AC-34→BR-21（`664`）、AC-47→BR-36（`825`）均未回退 |
| G-17 AC-07 三个不同条目 | `370–372` 完好，同条目去重仍由注入时钟单测覆盖 |
| v5→v6 的 AC 编号 | AC-01~AC-49 主题与编号未重排（D-14），新增仅 BR-37 |

**结论：无回归。**

---

## §4 BR 语义完整性核对（37 BR × 49 AC，只列有问题的）

> 方法：读每条 AC 的 Then + 机检，再读它引用的 BR 原文，判断是否同一条规则（不按编号存在性）。机械核：37/37 被引用、悬空引用 0（脚本）。

| AC | 现引用（v6 行号） | 问题 | 处置建议 |
|---|---|---|---|
| **AC-08**（`379`） | BR-06, BR-07, **BR-12**, BR-27, BR-37 | BR-12 是「同一时点三处数字口径一致（队列 / 托盘 / 列表）」，AC-08 的 Then/机检只断言队列行数、排序、空态与 2 秒新行，不断言三处数字（该口径由 AC-13 / AC-18 覆盖）。属**弱引**（多余的过引用，不导致悬空或误判）。 | 删 BR-12；或在 AC-08 机检补一处「队列总条数 = 各实例待处理数之和」。建议级，不改不阻断。 |

**第三轮 5 处错引 / 缺引均已改对**：AC-17 → BR-06+BR-27+BR-31 ✓（`478`）；AC-38 补 BR-33 ✓（`719`）；AC-40 删 BR-27 ✓（`745`）；AC-16 补状态词逐字断言后保留 BR-27 ✓（`470`）；AC-28 → BR-16+BR-37 ✓（`609`）。

**BR-37（本轮新增）核对**：语义（新升级 / 新审批 2 秒内入队、占用变化 2 秒内反映、推送或 ≤2 秒轮询、不需要手动刷新、与 BR-36 断线口径衔接）与 §2.3 `126`、§2.6 `176` 的时效规则一致；被 AC-08（队列 2 秒）与 AC-28（占用 2 秒）引用，语义匹配；编号 BR-36（`279`）→ BR-37（`280`) 连续；D-13 计数已同步为 37（`1412`）。

---

## §5 第二部分 / 第三部分逐条 PASS | FAIL（判据 A~E）

### 5.1 第二部分 · 符合规划（A）

| 判据 | 判定 | 依据 |
|---|---|---|
| A① 规划条目逐字 → §2，语义不降级 / 不换名 / 不合并 | **PASS** | 880→§2.2；881→§2.3+§2.4（D-06 两面）；882→§2.5；883→§2.6；884→§2.7；885→§2.8；886→§2.9；§2.1 `102` 逐项映射 |
| A② 用户操作 / 预期 / 异常 / 边界与规划语义一致 | **PASS** | §2.2–§2.9 六段齐全；异常段各有固定文案或降级路径 |
| A③ 规划范围外未被写成范围内 | **PASS** | §1.3 `58–73` 逐项注明去向（I1.10b / I1.12 / Web / IM / 资产写 / 历史视图 / 批量 / 跨项目 / 节点级终止 / 通知历史 / 证据导出 / 画布编辑 / 真实宿主） |
| A④ 旧行为不变有落点 | **PASS** | 回归红线 `77–83`；§2.9 `215` 退出语义与 I1.10a 完全一致 |
| A⑤ 无夹带 | **PASS** | §3.2 反查；BR-37 有来源；prefs 写入方已授权（D-42） |

### 5.2 第二部分 · 罗列全面（B）

| 判据 | 判定 | 依据 |
|---|---|---|
| B① 规划条目数 vs §2.1 功能点数（含 888 三句）零缺漏 | **PASS** | 7 子项 + 888 三句 → §2.1 八行；`102` 逐项映射 |
| B② 基线状态词 / 能力域 / 数据布局 / 边界在 §2 有落点 | **PASS** | §3.3 反向扫描，无缺漏 |
| B③ §2.10 衔接覆盖完整流程（含失败路径） | **PASS** | `221–231` 九步 + `233–240` 四条降级分支并点名 AC |
| B④ §2.11 BR 覆盖每条用户可见规则 | **PASS**（第三轮建议级 FAIL 已闭合） | BR-37（`280`）补上「队列新行 2 秒 / 占用刷新 2 秒」两条时效规则；断线规则 BR-36 已在 |

### 5.3 第三部分 · 符合规划（C）

| 判据 | 判定 | 依据 |
|---|---|---|
| C① 888 行验收句逐句 → 至少一条 AC，语义不弱化 | **PASS** | 第 1 句→AC-01/38；第 2 句→AC-38（AC-14 单判「实例继续」）；第 3 句→AC-26/27 |
| C② 每条 AC 的 G/W/T 是用户可见状态与操作 | **PASS** | 49 条均为界面 / 托盘 / 通知 / 队列可见状态；技术细节集中在机检 / 夹具 / 架构检查 |
| C③ 失败 / 异常 / 超限路径有对应 AC | **PASS** | AC-03/07/15/16/23/24/27/31/33/36/42/45/46/47/48/49；§2 的 8 处边界 8/8 有落点 |
| C④ 每条 AC 有三件套与**可执行**锚点 | **PASS**（第三轮 FAIL 已闭合） | 三件套 49/49、`**Then**` 49/49、锚点 49/49（脚本）；第三轮不可执行的 AC-01/09/17/18/28 五条已逐条实测闭合（§2） |

### 5.4 第三部分 · 罗列全面（D）

| 判据 | 判定 | 依据 |
|---|---|---|
| D① §2 每个功能点（含异常 / 边界）→ 至少一条 AC | **PASS** | 8 处边界 8/8；「释放占用 / 踢会话」已由 AC-27 `601` 断言；「通知不改五组状态」已由 AC-01 `305` 断言 |
| D② 规划每个条目 → 至少一条 AC | **PASS** | 880→AC-01/02/03；881→AC-08~17/44；882→AC-19~25/46；883→AC-26~28；884→AC-29~31/45；885→AC-32~34；886→AC-35~37/48；888→AC-38/14/26 |
| D③ BR 双向覆盖 | **PASS**（第三轮建议级 FAIL 已闭合） | 机械 37/37 + 0 悬空（脚本）；语义仅剩 AC-08→BR-12 弱引 1 处（§4，建议级）；5 处旧错引全部改对 |
| D④ §3.2 非功能、§3.3 前置条件齐全且用户视角 | **PASS** | NF-1~NF-8 齐全（NF-3 已交叉引用 BR-37）；§3.3 环境 / B 类 / 快照顺序 / 接缝 / 等待口径 / 回归基线 / 人工核验齐全；基线数字实跑一致 |
| D⑤ AC 编号连续无重复 | **PASS** | 49 条连续无重复无缺号（脚本） |

### 5.5 基线与需求模板合规（E）+ DoR 13

| 判据 | 判定 | 依据 |
|---|---|---|
| E① 第二部分不写接口 / 字段 / 内部状态机 | **PASS** | §2.4 用用户语言；`pass`/`retry`/`allow`/`deny` 只在夹具与附录 D-3 |
| E② 状态词 / 术语与基线 §3 一致 | **PASS** | A-0 `900` 七组状态词与基线一致；无「已终止」生产者；`（已暂停）`为既有后缀 |
| E③ 括号指引删净、C 与头部版本一致、D 可指导编码 | **PASS（附 3 建议）** | 括号指引 0 命中；头部 v6 = 附录 C 末行 v6；D-11 已含 `prefs.js`（D-42）。残留：`readable` 取不到输入未定义（I-01）、`--no-notify` 未点名授权（I-03）、901–912 差 1 行（I-06） |
| E④ 未决问题若影响开工须标阻塞 | **PASS** | U-1~U-13 均给「不阻塞」或「已裁决」 |

**DoR 13 条**

| # | 判定 | 依据 |
|---|---|---|
| 1 版本定稿 / C 一致 | **PASS** | 头部 v6、附录 C 末行 v6（`7` / `1284`） |
| 2 AC 连续 / 三件套 / Then | **PASS** | 49/49；脚本核 |
| 3 每条 AC 至少一个可执行锚点 | **PASS**（第三轮 FAIL 已闭合） | AC-01/09/17/18/28 五条锚点逐条实跑通过（§2） |
| 4 BR 双向覆盖 | **PASS** | 37/37 被引用、0 悬空；语义仅 1 处弱引（建议级） |
| 5 附录 A 覆盖所有带文案 AC | **PASS** | A-10 逐行回查（含 AC-47 已补）；A-11 文案键齐全 |
| 6 授权断言修改清单 | **PASS** | D-12「无」成立：本轮实跑确认既有测试不锁 `createRoutes` 表（路由表实跑 3 行，与 AC-39 括注一致） |
| 7 前置条件命令与夹具真实存在 | **PASS（附 1 建议）** | CLI / 接缝 / 测试命令均存在；`--project` 参数实测存在（`main.rs:49`）。残留：`--no-notify` 基线 0 命中、D-11 未点名（I-03） |
| 8 范围外清单明确 | **PASS** | §1.3 `58–73` |
| 9 全量测试基线数字已记录 | **PASS** | 1425 / 1420 / 4 / 1 实跑复现；差集 0 口径见 D-21 |
| 10 每条 AC 的 Given 可构造 | **PASS**（第三轮 FAIL 已闭合） | AC-01/09/28 的现场已逐一在基线代码上核实可构造（§2.3/2.4/2.5） |
| 11 同一编号跨 AC 语义不漂移 | **PASS** | `INST-001/002/003`、`ESC-001/002`、`APR-001/002/003/009` 用法一致；`retry`/`deny` 未混用 |
| 12 架构检查给可执行命令 | **PASS** | 每条都有完整命令与期望 exit；AC-18 的脚本实跑输出与声称一致 |
| 13 S0 评审闭环已 PASS | **PASS** | 本轮总判 PASS；前四轮记录齐全且不覆盖；本轮含覆盖表、反向扫描无夹带 |

---

## §6 基线与模板合规（机械扫描结果）

```text
$ wc -l docs/iterations/iteration-11/requirement.md
1421
$ grep -cE '^\*\*AC-' …      → 49    （AC-01..AC-49 连续，missing [] dup []）
$ grep -c '^- \*\*BR-' …     → 37    （BR-01..BR-37 连续，missing [] dup []）
$ grep -c '^- \*\*NF-' …     → 8     （NF-1..NF-8）
Node 审计脚本：
  AC structural problems: none        （场景类型/风险/引用/Then/锚点 49/49）
  BR not cited: []                    （37/37 被引用）
  AC refs beyond 37: []               （无悬空 BR 引用）
  placeholder hits: 0                 （无括号填写指引/TODO/TBD/待补）
  头部 v6 == 附录 C 末行 v6
$ grep -nE "fail === 0|fail===0" …    → 0 命中（exit 1，D-21 合规）
$ grep -n "批量" …  → 9 处：67(§1.3 范围外) / 1275,1276,1280,1282,1286(附录 C) /
  1320(D-1 否定) / 1412(D-13 否定) 全部合规；1007(A-4 否定句) 位置超出允许清单 → I-05（建议）
  能力级残留：0（无任何正面批量表述）
```

其余既有文件锚点（本轮实跑，全部与需求所写一致）：`computeLayout` 1 条（layout.js:45）；`/assets/` 合计 0；`'POST' && pathname` 4 条；`rev-list --count` 0；`buildRoleInstances` 1 文件（graph.js）；CJK：ui+harness 0 文件、壳层仅 config.rs（7 条）；`dependencies` 0；`USAGE_LINES` 25；purity 两份 exit 0；`if host ==|switch (host)` 0；打包器 0；裸 import 0；`core.stop` 1 条且 `-B8` 见 `fn quit`（tray.rs:159/163）；`继续`/`paused = true`/`console.error`/`pendingEscalations`（ui+壳层）/`escalations[.]filter`（ui）/`不能处理|已失效`（ui）/`无需再次处理`（ui）全部 0 命中；AC-39 路由表实跑 3 行。

---

## §7 修复清单（I-01 ~ I-06，全部建议级）

| 编号 | 位置 | 原文 / 事实 | 违反哪条 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| **I-01** | B-1 `1247`；D-6 `1357` | `readable` 三态只定义了「解析成功（含零节点）→ true」「部分可解析 → false 且 nodes>0」「整体不可解析 → false 且 nodes=0」。但 BR-19（`262`）/ A-7（`1139`）/ §2.7（`190`）要求「文件不存在 / 无读权限」也显示「定义 空」，这两种输入没有任何解析发生，三态表未定义其 `readable` 取值；若实现按「取不到 → false && nodes=0」套用第 ③ 态，将显示「定义不可读」，与 BR-19 冲突。AC-31 现场二（`645`）与 AC-45 现场二（`804`）只断言显示文案、不断言该现场的 `readable` 值，故各 AC 同时可满足，**不构成互斥阻断**；但 AC-45 架构检查（`809`）写「显示分支由 `{readable, nodes.length}` 两者共同选择」，实现者需要知道取不到时该置 true。 | 判据 E③「D 可指导编码」的明确性 | 在 B-1 ①（及 D-6）补一句：「没有可解析输入（文件不存在 / 无读权限 / 内容为空）按 `readable === true`、零节点处理（等价『解析成功但零节点』）」，或声明三态表只约束「有文件输入」的情形、取不到输入的显示由文件存在性先行判定。 | 建议 |
| **I-02** | BR-25 `268` | 「面板的写操作只有**六类**：五种处置动作（一次一条）、托盘暂停/继续，以及本机通知开关偏好」——按列举计为 5+1+1=7 处（或 3 组），「六类」与列举不符（NF-7 `863` 与 §1.3 `55` 无计数、无此问题）。 | 措辞准确性 | 改为「只有三类：五种处置动作（一次一条）、托盘暂停/继续，以及本机通知开关偏好」，或「七处写操作」。 | 建议 |
| **I-03** | §3.3 `874`；AC-07 `373`；AC-42 `775`；D-11 `1398` | `--no-notify`（强制投递失败）在基线全仓 grep `no.notify` 零命中（desktop/ bin/ src/ test/ 均无），属新增测试参数；D-11 的 `main.rs` 授权段只写「接通知事件与导航（唤前 + 切视图）；单实例、关窗隐藏逻辑不改」，未点名该参数。AC-07 夹具写「`--no-notify` **等价开关**」留有等价实现余地，且无头 CI 投递天然失败可兜底，**Given 仍可构造**，不构成阻断；但实现方可能因授权不明而犹豫。 | 判据 E③（授权清单明确性） | D-11 的 `main.rs` 段补一句「可新增 `--no-notify` 测试参数（只让投递失败，不改变通知意图的产生与记录）」。 | 建议 |
| **I-04** | AC-08 `379` | AC-08 引 BR-12，但其 Then/机检不断言「三处数字口径一致」（该口径由 AC-13 `434`、AC-18 `489` 覆盖），属弱引。 | D③ 引用精度 | 删 BR-12，或在 AC-08 机检补「队列总条数 = 各实例待处理数之和」一处断言。 | 建议 |
| **I-05** | A-4 `1007` | 「终止确认（只有单条终止，没有批量确认句——批量已按 D-01 移出范围）」是否定句、无能力夹带，但按 D-43 的允许位置清单（§1.3 范围外 / 附录 C / BR·AC 否定表述）与本轮任务口径，附录 A 不在允许列表内（第三轮 H-16 的 12 处中此条未清）。 | D-43 字面口径 | 把该括注改为「终止确认（单条）」或把说明移入附录 C / D-1 的既有否定段。 | 建议 |
| **I-06** | AC-18 `495` | 括注「daemon 的 `shapeSnapshot`（`src/daemon/server.js:901–912`）」——实测函数体为 **900–912**（`function shapeSnapshot` 在 900 行），差 1 行。主锚点数字（897 / 903 / 904 / 905 / 910 / routes.js:156）全部逐行准确，不影响任何断言。 | 行号精确性 | 括注改「`src/daemon/server.js:900–912`」。 | 建议 |

---

## §8 实跑命令与输出摘要

> 全部在 `/Users/xuesh/www/Maestro`、分支 `feat/i1.11-notify-queue-assets`、HEAD `b23303a`（基线 `66e5a6b` + docs/memory 提交，`git diff --name-only 66e5a6b..HEAD` 确认 src/ 与 test/ 无变更）上执行。

### 8.1 文档规模与编号

```text
$ wc -l docs/iterations/iteration-11/requirement.md
1421
$ grep -cE '^\*\*AC-' …   → 49
$ grep -c '^- \*\*BR-' …  → 37
$ grep -c '^- \*\*NF-' …  → 8
Node 审计（/tmp/audit-i11-r4.mjs）：
AC: count=49 min=1 max=49 missing=[] dup=[]
BR: count=37 min=1 max=37 missing=[] dup=[]
NF: count=8 min=1 max=8 missing=[]
AC structural problems: none
BR not cited: []
placeholder hits: 0
头部 v6 == 附录 C 末行 v6
```

### 8.2 五项阻断锚点（详见 §2）

```text
$ grep -REn "pendingEscalations" src/daemon/                                   → 5 行（897/903/904/910/routes.js:156）
$ grep -REn "pendingEscalations[^;]*(filter|reduce|length|push)" src/daemon/   → 0 行（exit 1，行级假阴性复现）
$ grep -REn -A3 "pendingEscalations" src/daemon/ | grep -c "filter((entry)"    → 1
$ node --input-type=module -e '<AC-18 切块脚本>'                                → occurrences=5 countExpr=2 outsideShapeSnapshot=0（exit 0）
$ grep -REn "escalations[.]filter|escalations[.]reduce" src/daemon/            → 恰 1 条（server.js:905）
$ sed -n '1256,1280p' src/cli/render.js | grep -Ec "join\('  '\)"              → 1
$ grep -REn "parts.join\(' · '\)" src/cli/render.js                            → 4 处（1155 = renderApprovalLine）
$ sed -n '158,178p' src/templates/index.js                                     → single = T-001 / worker / terminals [T-001] / maxRounds 1
$ node bin/orch.js role show worker                                            → worker 执行者
$ sed -n '5065,5076p' src/core/orchestrator.js                                 → pass && terminal ? 'completed' : 'running'
$ grep -n "pulse" src/daemon/http/server.js                                    → 24/351/451（端点）
$ grep -n "function applyTestOverlay" -A 8 src/daemon/http/stream.js           → 只 patch 图投影，不写 state.json
```

### 8.3 其余既有文件锚点

```text
$ grep -REn "export function computeLayout" desktop/ui/graph/layout.js          → 45 行，1 条
$ cat src/daemon/http/server.js src/daemon/http/routes.js | grep -Ec "/assets/" → 0
$ grep -REc "'POST' && pathname === '[^']+'" src/daemon/http/server.js          → 4
$ git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown                    → 0
$ grep -REl "buildRoleInstances" src/daemon/                                    → src/daemon/graph.js（1 个）
$ grep -REl '[一-龥]' desktop/ui desktop/harness                                → 0 文件（exit 1）
$ grep -REn '"[^"]*[一-龥][^"]*"' desktop/src-tauri/src | cut -d: -f1 | sort -u  → 仅 config.rs（7 条）
$ node -p "Object.keys(require('./package.json').dependencies||{}).length"      → 0
$ node --input-type=module -e "import('./src/cli/labels.js')…" USAGE_LINES      → 25
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <30 词> → exit 0
$ 同上 --dirs desktop/ui                                                        → exit 0
$ grep -REn "if host ==|switch [(]host[)]" src/                                 → 0（exit 1）
$ grep -REn "core[.]stop" desktop/src-tauri/src/                                → tray.rs:163（1 条），-B8 见 pub fn quit（159）
$ grep -REn "继续" desktop/src-tauri/src/tray.rs                                → 0（exit 1）
$ grep -REn "paused = true" desktop/src-tauri/src/                              → 0（exit 1）
$ grep -REn "console[.]error" desktop/ui                                        → 0（exit 1）
$ grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src               → 0（exit 1）
$ grep -REn "escalations[.]filter" desktop/ui/                                  → 0（exit 1）
$ grep -REn "不能处理|已失效" desktop/ui                                        → 0（exit 1）
$ grep -REn "无需再次处理" desktop/ui                                           → 0（exit 1）
$ node --input-type=module -e "…createRoutes(…)"                                → GET /instances / POST /instances / GET /workflows（3 行）
$ grep -nE "fail === 0|fail===0" requirement.md                                 → 0 命中
$ grep -n "no.notify" desktop/ bin/ src/ test/                                  → 0 命中（--no-notify 属新增接缝 → I-03）
$ grep -n '"--project"|--probe|--ctl' desktop/src-tauri/src/main.rs             → 49/55/61（--project 存在，AC-05 重启夹具可执行）
$ grep -n "node_type" src/registry/workflow-schema.js                           → 124–132：未知 node_type 校验失败（AC-29 valid=false 成立）
```

### 8.4 全量测试

```text
$ env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
# tests 1425
# pass 1420
# fail 4
# cancelled 0
# skipped 1
# todo 0
# duration_ms 281742
```

与 §3.3 第 879 行记录的基线数字逐项一致；4 条失败名与判定基线（历史 8 条 + R-08 的 AC-04）的对应关系沿用第三轮在同一代码树上的逐条核对（`git diff --name-only 66e5a6b..HEAD` 证实 src/ 与 test/ 与第三轮实跑时逐字节相同）。

### 8.5 未能观测到的项（试过的路径）

- **真实桌面的通知外观 / 点击手感、托盘菜单排版**：无头环境不可观测；§3.3 `886` 已登记为人工核验项，本轮不判。
- **S2 才创建的产物**（`src/daemon/{queue,notify,occupancy,assets-view,evidence,canvas,prefs}.js`、`desktop/ui/{queue,assets,occupancy,canvas,evidence,notify}/**`、`desktop/harness/*.mjs`、`test/wp14/**`）：基线上不存在；本轮只核「既有文件上的锚点」与「S2 锚点写法是否可执行」，不把缺失判为缺陷（§3.1 判定口径第 4 条已声明预期）。
- **`partial-flow` 的 `readable` 实测值**：S2 模块尚未存在，无法实测；本轮按 B-1 / D-6 / AC-29 / AC-45 的文本判定为「自洽但『取不到输入』未定义」（I-01）。
- **`--no-notify` 的运行时行为**：基线不存在该参数，无法实测；本轮只判定其授权明确性（I-03）。
