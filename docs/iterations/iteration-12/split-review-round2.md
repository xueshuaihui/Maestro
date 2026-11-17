# I1.12 拆分与契约评审 · 第 2 轮（干净上下文，只读）

> 评审对象：`docs/iterations/iteration-12.md`（拆分修订版，562 行；`git status` = 未跟踪新文件）+ `docs/iterations/iteration-12/requirement.md` **v2.1**（头部 8 行 = 附录 C 末行 620，实跑一致）。
> 唯一可写产物：本文件 `docs/iterations/iteration-12/split-review-round2.md`；**不覆盖** `split-review.md`。
> 效力排序：`decisions.md` 裁决 A + **裁决 B**（效力最高）> 需求 v2.1 正文 > 拆分自述。判据：模板 §1.3 / §1.4 / §1.5；上轮 `split-review.md` SR-01~SR-03（仅逐条复核）。
> 复核方式：只读 + 机械脚本实跑 + 逐文件行号/符号锚点核对，**不采信拆分与需求自述**。分支 `feat/i1.12-governance`，HEAD `5406790`。

---

## §0 总判

**总判：PASS —— 阻断 0 / 建议 1。**

- **判定依据**：SR-01 / SR-02 / SR-03 **全部已修（3/3）**，且全量回归 **无新增问题**，命中主控边界「SR 全闭合 + 回归无新增 = **必须 PASS**」。
- **SR 三态统计**：已修 **3** / 未修 **0** / 修了但引入新问题 **0**。
- **唯一建议（SR2-01，非阻断）**：拆分 §1.3 / §2.3 / §7 风险15 / §8.2 冲突7 四处把真实符号 `HANDOFF_HASH_MISMATCH` 写作 `HAND_OFF_HASH_MISMATCH`（多一下划线）。该写法**上轮 `split-review.md` 行 56/93 已存在且判 PASS**，本轮修订未触碰、非新增回归；行号段（264–275）与逻辑描述（`source==='previous'` 比对、失败码/顺序不动）属实。按主控「文风与行号漂移类一律建议」归建议，S2 实现以真实符号为准即可。
- **阻断判据逐项核验（均为 0）**：违反需求唯一性 0（需求 diff 实证仅 3 处、Then 零改动）；§1.4 四硬规则违背 0；契约签名与 D-13 / 裁决 B 不一致 0（授权补注与裁决 B 第 1/2 条逐字一致）；退出标准不可量化 0；8 节骨架缺失 0；抽查行号/文件不实 0（唯一符号名拼写偏差见上，非行号/文件不实）；SR-01 修法未落实 0。
- **实跑命令清单**（详见 §5）：git 状态/HEAD；需求 + 裁决台账完整 diff；8 节骨架 grep；AC→WP 覆盖脚本；WP 文件零交集脚本；需求 AC/BR/NF 计数脚本；裁决 B 逐字比对脚本；≥16 处符号锚点 grep/sed/实跑。

---

## §1 SR-01 ~ SR-03 三态复核（行号 + 证据）

> 三态定义：`已修` / `未修` / `修了但引入新问题`。涉及裁决 B 的以裁决 B 为准。

| 编号 | 上轮严重度 | 三态 | 修订版行号与证据（实读 / 实跑） |
|---|---|---|---|
| **SR-01** | 阻断 | **已修** | ① 拆分 §8.2 冲突9（行 537）状态已由「请主控确认 / 不在拆分里消化」改为「**裁决 B 已授权**（2026-11-18，效力高于需求正文自声明）」，并写明授权范围 = `src/cli/roles.js` 的 `exportRole`/`importRole`/`roleCommand` 的 export/import 分发子段 + `src/cli/workflows.js` 的 `workflowCommand` 中与工作流包 export/import 相关子段，「只加不改——既有 `role export`/`role import`/`workflow` 命令对外行为、既有文案键、既有失败码逐字保持不变」。② WP-4 两文件路径**维持**：§2.4 行 182-183、§4 行 348、§5 行 428-429、风险13 行 503，措辞全部改为「依裁决 B 授权段 + 以符号锚点定位」，不再有「请主控确认」。③ 需求附录 D-13 新增授权补注（行 712-715），逐字引用裁决 B 第 1、2 条——**实跑逐字比对**：第 1 条 289 字符 `逐字一致=true`，第 2 条 `逐字一致=true`。④ 需求改动范围**实跑 git diff**：仅头部版本 v2→v2.1（行 8）、附录 C 新增 v2.1 行（行 620）、D-13 授权补注（行 712-715），合计 6 插入 / 1 删除；**全部 Then 行零改动**，AC 23 / BR 19 / NF 5 未变。上轮要求的「书面扩授权清单」路径②已由裁决 B 落地，无「嘴上待裁决、手上既定」矛盾。 |
| **SR-02** | 建议 | **已修** | §4 WP-7 验收口径（行 375）已补：「`wiring.test.js` 对四目标分派 / 四门禁调用点采用冻结签名的 stub 注入或静态源码断言，只校验接线形状、不 require 能力包实现产物，**包内契约测试可独立跑通**（`NODE_ENV=test node --test test/wp15/wiring.test.js`），能力包仅冻结签名未落盘时亦可独立跑通、本包验收不依赖它们，满足模板 §1.4 硬规则 2（对齐 I1.10b 拆分行 358 写法）」。与上轮建议修法逐字对齐，硬规则 2 可证性闭合。 |
| **SR-03** | 建议 | **已修** | §8.2 冲突5（行 533）已补注「**裁决 B 第 4 条（SR-03）**：行号以符号锚点为准，新增导出落在 ZERO_HASH 附近若属同一只读校验模块的合理落点即可，**不死守 111-116**」。§2.1（行 155）WP-1 落点「ZERO_HASH 常量（13 行）附近新增导出」保持不变；实跑 event-bus.js ZERO_HASH 确在行 13，落点属合理。上轮「请主控确认是否扩段」已由裁决 B 第 4 条正名闭合。 |

**三态统计：已修 3 / 未修 0 / 修了但引入新问题 0。未闭合编号：无。**

---

## §2 回归扫描

| 维度 | 判定 | 证据（实跑 / 实读） |
|---|---|---|
| 8 节骨架齐全有序 | **PASS** | `grep -n "^## "` → §0(13)/§1(61)/§2(147)/§3(215)/§4(317)/§5(410)/§6(454)/§7(487)/§8(512) + 附录自检(548)，节号与顺序与模板 §1.3 一致。 |
| §0 退出标准可量化 | **PASS** | 8 条（行 50-57）全部含数字或逐字口径：23 AC/0 阻塞、AC→WP 23/23 差集 0、`tests≥1425`+差集 0、purity 31 词双目录 exit 0 + deps 0、`orch --help` 25 行 + 三命令挂载、reason 码与状态词、性能三值分级、I1.11 零交集。无「功能做完」类不可判定表述。 |
| AC→WP 满覆盖 23/23 | **PASS** | 脚本实跑输出见下：`需求AC数: 23，连续: true`；`映射表AC行数: 23，去重 23`；`未覆盖: 无 / 多余: 无 / 重复: 无`；`每AC恰好一个主责WP: 是`；主责分布 WP-1(2)/WP-2(7)/WP-3(4)/WP-4(5)/WP-5(2)/WP-6(2)/WP-7(1) = 23。 |
| WP 文件两两零交集 | **PASS** | 脚本实跑：`WP数: 7，登记文件数: 35，重叠数: 0`；逐 WP 文件分布见下。WP-4 的 roles.js / workflows.js 同属 WP-4（同一负责人），不构成 WP 间交集。 |
| §1 每决策有被否决项 | **PASS** | §1.1~§1.10 每条均带「**被否决**」段：行 67 / 75 / 84 / 92 / 101 / 109 / 117 / 125 / 133 / 141。 |
| §7 风险覆盖 | **PASS** | F2-01~F2-06（行 491-496）；AC-21 取证（行 492 + 风险7 行 497）；I1.11 零交集（风险8 行 498）；flake 差集（F2-05 行 495 + 风险9 行 499，禁 `--no-flake-confirm`）；历史证据恢复（风险10 行 500，`checkout-index -f`）。§7 共 16 条（统计行 508），每条点名文件/函数/命令。 |
| §8 冲突 10 条每条有裁决出处 | **PASS** | 冲突1(行529,裁决A①)、2(530,裁决A③)、3(531,裁决A④)、4(532,基线)、5(533,裁决B④)、6(534,只读基线)、7(535,D-4追加)、8(536,互补不替代)、9(537,裁决B)、10(538,§1.4硬规则3)。10/10 均有出处。 |
| 需求计数 + 版本 | **PASS** | 脚本实跑：`AC数: 23，BR定义: 19，NF数: 5(1,2,3,4,5)`；`头部: v2.1`；`附录C版本: v1,v2,v2.1 末行: v2.1`。头部版本 = 附录 C 末行 = v2.1。 |

**脚本实跑关键输出摘录**

```
AC→WP 覆盖：需求AC数: 23 首个: AC-01 末个: AC-23 连续: true
            映射表AC行数: 23 去重: 23
            未覆盖: 无 / 多余: 无 / 重复: 无 / 每AC恰好一个主责WP: 是
            主责分布: {"WP-1":2,"WP-2":7,"WP-3":4,"WP-4":5,"WP-5":2,"WP-6":2,"WP-7":1}
WP 零交集： WP数: 7 登记文件数: 35 重叠数: 0
需求三处改动核验（git diff）：7 + / 1 - = 头部版本(v2→v2.1) + 附录C v2.1 行 + D-13 授权补注(4 行)；Then 零改动
裁决 B 逐字：第1条 289 字符 逐字一致=true；第2条 逐字一致=true
需求计数：AC 23 / BR 19 / NF 5；版本 v2.1 = 附录C末行
```

**需求 v2.1 三处改动核验（不采信自述，git diff 实证）**：`git -c core.autocrlf=false diff -- docs/iterations/iteration-12/requirement.md` 输出仅 3 个 hunk——① 头部 `- **版本**：v2` → `v2.1`；② 附录 C 表末追加 `| v2.1 | 2026-11-18 | ... |`；③ 附录 D-13 末追加授权补注 4 行。**无任何 `**Then**` 行变更、无 AC/BR/NF 增删**。`decisions.md` diff 仅追加裁决 B 一节（不影响需求计数）。核验通过。

---

## §3 行号与符号锚点抽查表（16 处，均实跑）

| # | 抽查对象（拆分声明） | 命令 / 核法 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | roles.js `exportRole`（约 852） | `grep -n "exportRole" src/cli/roles.js` | 852 `async function exportRole(...)` | ✓ |
| 2 | roles.js `importRole`（874） | `grep -n "importRole" src/cli/roles.js` | 874 `async function importRole(...)` | ✓ |
| 3 | roles.js `roleCommand` 分发（1164-1165） | `grep -nE "roleCommand\|sub === 'export'\|sub === 'import'"` | 1115 定义；1164 `sub === 'export'`、1165 `sub === 'import'` | ✓ |
| 4 | workflows.js `workflowCommand`（792） | `grep -n "workflowCommand" src/cli/workflows.js` | 792 `export async function workflowCommand(...)` | ✓ |
| 5 | main.js `FAMILY_MODULES`（188-192） | `sed -n '188,218p' src/cli/main.js` | 189-192 现有 skill/workflow 两条，无 verify/migrate/export | ✓ |
| 6 | main.js `RUNTIME_COMMANDS`（199-204） | 同上 | 11 顶层命令（含 trace），无三新命令 | ✓ |
| 7 | main.js `RUNTIME_SUBS`/flags（206-218） | 同上 | 6 组子命令映射；VALUE_FLAGS 无新增 | ✓ |
| 8 | labels.js `REASON_LABEL`/`wake.rejected`（354/388） | `grep -nE ...; sed -n '386,390p'` | 354 定义；388 `'wake.rejected': '唤醒被拒'`；无 `wake.not-whitelisted`（S2 加键） | ✓ |
| 9 | labels.js `USAGE_LINES` 25 行（183-209） | `node -e "require('./src/cli/labels.js').USAGE_LINES.length"` | `25` | ✓ |
| 10 | event-bus.js `ZERO_HASH`（13）/record（111）/落盘（114-117）/广播（120） | `grep -n ZERO_HASH; sed -n '105,125p'` | ZERO_HASH=13（`const` 未导出）；record=111；落盘=114-117；broadcast=120 | ✓ |
| 11 | instance-store.js `canonicalize`/`hashRecord` 私有（53-66） | `sed -n '50,68p'; grep -nE ...` | 53 `function canonicalize`、64 `function hashRecord`，均无 export | ✓ |
| 12 | handoff-schema.js `validateHandoff`（305-311）/ `validateHandoffEvidence` | `grep -nE ...` | 306 `validateHandoff`（微漂 1 行）、215 `validateHandoffEvidence` | ✓（漂移内） |
| 13 | escalation.js `emitMany`/`commitEscalation`/`pendingHandoff`（244-348） | `grep -nE ...` | 159 `emitMany`、179 `commitEscalation`、248 `pendingHandoff`、348 `emitMany` 调用 | ✓ |
| 14 | orchestrator.js `transit`（630）/validateHandoff（3099）/wake.rejected（4435） | `grep -nE ...` | 630 定义、3099 调用、4435 `reason: 'wake.rejected'` | ✓ |
| 15 | doc-artifact.js `sha256Of`（237） | `grep -n sha256Of` | 237 `export async function sha256Of` | ✓ |
| 16 | 裁决 B 授权段第 1/2 条逐字 | node 逐字比对脚本 | 第1条 289 字符一致；第2条一致 | ✓ |

**抽查失败项**：无（16/16 锚点实测成立；#12 的 1 行漂移在附录 D 前言「行号漂移以符号为准」允许范围内）。

**额外发现（建议，非阻断）**：拆分四处（§1.3 行 83、§2.3 行 168、§7 风险15 行 505、§8.2 冲突7 行 535）把符号写作 `HAND_OFF_HASH_MISMATCH`，真实代码为 `HANDOFF_HASH_MISMATCH`（`src/core/handoff-schema.js:24` 定义、`:273` 使用，`source==='previous'` 且 `sha256` 不一致时返回）。实跑 `grep -rn "HAND_OFF_HASH_MISMATCH" src/ test/` 零命中。该偏差上轮 `split-review.md` 行 56/93 已沿用且判 PASS，本轮未触碰、非新增；行号段与逻辑描述属实，不影响契约判定，归建议 SR2-01。

---

## §4 修复清单 SR2-01…（若有）

本轮 **无阻断项**，无需强制修复。以下 1 条为**建议**（文风/符号名一致性类，非阻断，按主控边界不得据此判 FAIL）：

| 编号 | 事项 | 位置 | 归属 | 严重度 |
|---|---|---|---|---|
| SR2-01 | 符号名拼写统一：拆分四处 `HAND_OFF_HASH_MISMATCH` 改为与代码一致的 `HANDOFF_HASH_MISMATCH`；S2 实现 `validateEvidenceFreshness` 时以真实码 `HANDOFF_HASH_MISMATCH` 为既有基线，勿按拆分错误拼写新增第二码 | §1.3 行 83、§2.3 行 168、§7 风险15 行 505、§8.2 冲突7 行 535 | 建议（可在 S1 顺手统一 / S2 实现锚点核对） | 建议·非阻断 |

---

## §5 实跑命令与输出摘要

工作目录 `d:/WWW/Maestro`。以下均实际执行（只读，未改任何输入文件）。

1. **git 基线**：`git branch --show-current` → `feat/i1.12-governance`；`git rev-parse --short HEAD` → `5406790`；`git status --short` → ` M decisions.md`、` M requirement.md`、`?? iteration-12.md`、`?? split-review.md`。
2. **需求 diff（三处改动核验）**：`git -c core.autocrlf=false diff -- docs/iterations/iteration-12/requirement.md` → `1 file changed, 6 insertions(+), 1 deletion(-)`；3 个 hunk = 头部版本 v2→v2.1 + 附录C v2.1 行 + D-13 授权补注 4 行；Then 零改动。
3. **裁决 diff**：`git diff -- docs/iterations/iteration-12/decisions.md` → 仅追加裁决 B 一节（背景/事实核查/裁决4条/对需求影响）。
4. **8 节骨架**：`grep -n "^## " docs/iterations/iteration-12.md` → 13/61/147/215/317/410/454/487/512 + 附录 548。
5. **AC→WP 覆盖脚本**（node 读 requirement.md + iteration-12.md）：输出见 §2 摘录——23/23、未覆盖/多余/重复均无、每 AC 恰好一个主责 WP。
6. **WP 零交集脚本**（正则取 `### WP-N` 块内反引号路径建 owner 映射）：`WP数: 7 登记文件数: 35 重叠数: 0`；逐 WP 分布见 §2。
7. **需求计数脚本**：`AC 23 / BR 19 / NF 5`；`版本 v2.1 = 附录C末行 v2.1`。
8. **裁决 B 逐字比对脚本**（去序号/引号后比对）：第1条 289 字符 `逐字一致=true`；第2条 `逐字一致=true`。
9. **符号锚点抽查**：`grep -n` / `sed -n` / `node -e` 逐处实跑 §3 表 16 处，全部成立；`grep -rn "HAND_OFF_HASH_MISMATCH" src/ test/` 零命中（额外发现，见 §3 注）。
10. **行为/数据锚点**：`node -e "require('./src/cli/labels.js').USAGE_LINES.length"` → 25；`wc -c test/fixtures/mock-acp-agent.js` → 45957 B；`wc -c docs/iterations/iteration-10a/baseline-failures-win32.txt` → 2852 B。

> 复核边界声明：本评审只读；未修改拆分文档、需求、`src/**`、`test/**`、I1.11 文件；唯一写入文件为本报告 `docs/iterations/iteration-12/split-review-round2.md`。

---

## 移交摘要（六项）

1. **总判**：PASS；阻断 **0** / 建议 **1**（SR2-01 符号名拼写，非阻断）。
2. **SR 三态统计**：已修 **3** / 未修 **0** / 修了但引入新问题 **0**；SR-01（阻断）、SR-02、SR-03 全部闭合。
3. **零交集与 23 覆盖实测**：`WP数 7 / 登记文件 35 / 重叠 0`（WP-4 两文件同属一个 WP 不计交集）；`需求AC 23 / 映射表 23 / 未覆盖 无 / 多余 无 / 重复 无 / 每AC恰好一个主责WP 是`。
4. **抽查失败项**：无（16/16 成立；HAND_OFF vs HANDOFF 拼写为建议非失败）。
5. **SR2 阻断标题行**：无（本轮无阻断项；唯一 SR2-01 为建议）。
6. **移交 S2 注意事项**：① D-13 授权以裁决 B 为准——仅 `roles.js` 的 `exportRole`/`importRole`/`roleCommand` export/import 分发子段、`workflows.js` 的 `workflowCommand` export/import 子段可改，只加不改既有对外行为/文案键/失败码；② 新增 reason 码 `wake.not-whitelisted` 须在 `labels.js:354` REASON_LABEL 加键、既有 `wake.rejected`（388）逐字不动；③ 证据过期门禁追加在 `validateHandoff` 链末尾，以真实 `HANDOFF_HASH_MISMATCH`（:24/:273）为既有基线码，不要按拆分错误拼写新增第二码（SR2-01）。
