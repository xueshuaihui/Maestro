# I1.12 拆分与契约评审（干净上下文，只读）

> 评审对象：`docs/iterations/iteration-12.md`（拆分文档，§0~§8 + 自检，562 行；`git status` 显示为未跟踪新文件）。
> 唯一验收依据：`docs/iterations/iteration-12/requirement.md` **v2**（23 AC / 19 BR / 5 NF）；裁决 `decisions.md` **裁决 A** 效力高于需求正文自声明。
> 判据：`docs/templates/execution-template.md` §1.3 / §1.4 / §1.5 / §2.8 / §6；核事实代码 `src/**`、`test/wp13/**`、`test/wp14/**`、`bin/orch.js`；上游样例 `iteration-10b.md`。
> 复核方式：只读 + 机械脚本实跑 + 逐文件行号核对，**不采信拆分自述**。分支 `feat/i1.12-governance`，HEAD `5406790`（实跑一致）。

---

## §0 总判

**总判：FAIL —— 阻断 1 / 建议 2。**

- **阻断 SR-01（疑点1 / 冲突9 授权边界）**：拆分把 D-13 未授权的 `src/cli/roles.js`、`src/cli/workflows.js` 写死进 WP-4 的「负责文件(7)」与「交付物清单」，交付内容确定（§2.4 行182-183、§4 行348、§5 行428-429），却在 §8.2 冲突9（行537）声称「不在拆分里消化、请主控确认」。嘴上待裁决、手上已既定，违反「需求是唯一验收依据 / 不自行扩大改动范围」（模板 §0.1 铁律1、§6、§7 红线14），命中任务书「把越界改动当成既定交付 = FAIL」。须移到 §8 待裁决或由主控书面扩授权清单后才能保留现分工。
- **建议 SR-02（疑点2 / WP-7 独立验收可证性）**：不构成 §1.4 硬规则2 实质违背，但 §4 WP-7（行373-375）未写明 wiring.test.js 用 mock/stub 冻结签名解除对能力包实现产物的耦合，文本上无法证明「包可独立验收」，需补强措辞以对齐 I1.10b 样例（iteration-10b.md 行358）。
- **建议 SR-03（event-bus.js 授权段落点）**：D-13 行708 点名 `event-bus.js:111-116`，拆分 §2.1（行155）把新增导出落到 `ZERO_HASH`（13 行）附近；虽已在 §8.2 冲突5（行533）登记，但落点超出授权段，建议 S1 一并请主控确认是否扩段。

**八维度结论**：A 需求唯一性 **PASS**（AC 层面）、B 8节骨架 **PASS**、C 文件级契约 **PASS**、D 四条硬规则 **PASS**、E WP五字段 **PASS**、F 数据模型与交付物 **PASS**、G 依赖并行与冻结 **PASS**、H 风险覆盖 **PASS**、I 行号与命令真实性 **PASS**。唯一阻断来自疑点1 的授权处理，不属于机械维度缺陷。

**实跑命令清单**（详见 §8）：git 状态/HEAD；8 节标题 grep；AC→WP 机械比对脚本；WP 文件零交集脚本；8 改文件 + 只读基线 + 新增文件存在性；`USAGE_LINES.length`；禁词表 31 词计数；D-13 命令/reason 现状 grep；逐文件行号核对（24 处）。

---

## §1 八节骨架与退出标准核查

| 维度 | 判定 | 证据 |
|---|---|---|
| §0~§8 节号顺序齐全 | **PASS** | `grep -n "^## "` 输出 9 个节标题：§0(13)/§1(61)/§2(147)/§3(215)/§4(317)/§5(410)/§6(454)/§7(487)/§8(512)，另有附录自检(548)，顺序与模板 §1.3 一致。 |
| §0 退出标准可量化 | **PASS** | 8 条标准全部含数字或逐字口径：①23 AC/0 阻塞、AC-21 未取证判阻塞（行50）；②AC→WP 23/23 差集 0（行51）；③`tests ≥ 1425` + 差集 0（行52）；④purity 31 词双目录 exit 0 + deps 0（行53）；⑤`orch --help` 25 行 + 三命令挂载（行54）；⑥reason 码与状态词口径（行55）；⑦性能三值分级（行56）；⑧I1.11 零交集（行57）。无「功能做完」类不可判定表述。 |
| §1 每决策含被否决项 | **PASS** | §1.1~§1.10 每条均带「**被否决**」段：行67/75/84/92/101/109/117/125/133/141。例：§1.2 否决「复用 wake.rejected 表达白名单」（行77）、§1.9 否决「新增顶层 chain/sign/import」（行134）。 |
| §2 逐文件归属/签名 | **PASS** | 见 §3。 |
| §4 五字段 | **PASS** | 见 §4。 |
| §6 冻结+检查点 | **PASS** | 见维度 G。 |

---

## §2 需求符合性（A）+ 冲突清单完整性

**A 需求唯一性（AC 层面）：PASS**

- 不增删/合并 AC：需求 §3.1 实读 23 AC（AC-01~AC-23 连续），拆分 §4 映射表 23 行、映射表内 AC 23 个，脚本比对「未覆盖：无 / 多余：无」（§8 命令3）。
- 不放宽 Then：抽查 A-2 逐字「链已断：第 [N] 条记录与前一条指纹不匹配」（拆分行327 = 需求行548）；AC-21「未取证→阻塞、不算失败、mock 不得顶替」（拆分行367/313 = 需求行483-484）；AC-04「恰 1 条 `wake.not-whitelisted`、既有 `wake.rejected` 不动」（拆分行385 = 需求行296）——均未放宽。
- 范围条目不挪出：§0 In scope 12 条（行19-32）逐条对应需求 §1.3 第47-60 行；AC-22/23 按映射表落位且声明「不新增范围条目」（行34）。
- 唯一「顺手消化」命中：冲突9 授权问题（见 §5 疑点1），判阻断。

**§8.2 冲突清单 10 条逐条核（全部 PASS，每条有现状实点 + 裁决出处）**

| # | 冲突 | 拆分声明的实点 | 本轮实跑复核 | 裁决出处 | 判定 |
|---|---|---|---|---|---|
| 1 | 命令名冻结无独立凭据（行529） | decisions.md 裁决A第1条冻结；main.js:199-204 无三命令 | 裁决A 行15；main.js:199-204 实测 11 命令无 verify/migrate/export | 裁决A第1条 | PASS |
| 2 | AC-21 残留 v1 措辞（行530） | 需求482/483/484/522 | 需求行482-484 实读一致 | 裁决A第3条（行17） | PASS |
| 3 | wake.denied 与 wake.rejected 冲突（行531） | labels.js:388 既有键 | 实测 388 `wake.rejected:'唤醒被拒'`，无新码 | 裁决A第4条（行18） | PASS |
| 4 | progress HEAD 0b12bd8 vs 5406790（行532） | 本轮 HEAD 5406790 | `git rev-parse` = 5406790…；progress.md 行3/33 写 0b12bd8 | 以任务书基线为准 | PASS |
| 5 | event-bus.js:111-116 行号漂移（行533） | 111=record、114-117 落盘 | 实测 111 / 114-117 / 120 广播一致 | 附录D前言「漂移只改授权段」 | PASS（落点见 SR-03） |
| 6 | canonicalize 私有未导出（行534） | instance-store.js:53-66 私有 | 实测 53 canonicalize / 64 hashRecord 无 export | 不改只读基线 | PASS |
| 7 | HAND_OFF_HASH_MISMATCH 与新判定并存（行535） | handoff-schema.js:265-275 | 实测 273 命中；validateHandoff 链 306-311 | D-4 追加链末尾 | PASS |
| 8 | workflows step13 静态校验（行536） | registry/workflows.js:594-604 | 实测 594-604 checkWakePermissions（forward 边权限），不产事件 | 互补不替代 | PASS |
| 9 | roles.js/workflows.js 未在 D-13 授权（行537） | cli/roles.js:852/874、workflows.js 导出段 | 实测路径/行号真实 | 见 §5 疑点1 | **FAIL（SR-01）** |
| 10 | D-1 单一 governance.js 张力（行538） | D-1「文件划分由拆分定」 | 需求行627 实读一致 | §1.4 硬规则3 | PASS |

> 路径澄清：任务书疑点1 写作 `src/registry/roles.js`/`workflows.js`，但 `src/registry/` 下只有 `workflows.js`（786 行，工作流定义校验），**无 `roles.js`**。真实 export/import handler 在 `src/cli/roles.js`（852/874）。拆分全文使用的是正确路径 `src/cli/roles.js`/`src/cli/workflows.js`，因此不构成「抽查文件不实」。

---

## §3 文件级契约与 D-13 落地核查（含抽查实点表）

**判定：PASS。** §2 逐文件标新增/改、导出签名、入参出参、归属 WP；D-13 六项全部落到具体文件与函数：

| D-13 要素 | 拆分落点 | 判定 |
|---|---|---|
| 三命令名冻结 | §2.7 main.js（行200）| PASS |
| handler 挂载（FAMILY_MODULES） | §2.7 行200 + §2.5 otel.js / §2.4 migrate.js / §2.7 verify.js | PASS |
| reason 码 `wake.not-whitelisted` | §2.7 labels.js REASON_LABEL（行203） | PASS |
| REASON_LABEL 加键 / 独立用法块 | §2.7 行203；§7 F2-04 行494 | PASS |
| handoff-schema 追加段 | §2.3 行168 | PASS |
| event-bus 只读接入 | §2.1 行155（落点见 SR-03） | PASS·建议 |
| escalation 复用 | §2.7 行206 | PASS |
| orchestrator 门禁 | §2.7 行205 | PASS |

**抽查实点表（24 处，逐条实跑）**

| # | 拆分声明（行） | 实测结果 | 判定 |
|---|---|---|---|
| 1 | main.js FAMILY_MODULES 188-192（200） | 189-192 skill/workflow 两条 | ✓ |
| 2 | RUNTIME_COMMANDS 199-204（201） | 11 顶层命令，无三新命令 | ✓ |
| 3 | RUNTIME_SUBS 206-213（201） | 6 组映射一致 | ✓ |
| 4 | flags 215-218（201） | 一致 | ✓ |
| 5 | labels.js USAGE_LINES 183-209（203） | 数组 25 条，`USAGE_LINES.length`=25 | ✓ |
| 6 | labels.js REASON_LABEL 354 / wake.rejected 388（203） | 354 定义、388 `唤醒被拒` | ✓ |
| 7 | event-bus ZERO_HASH 13 行（155） | `const`（未导出） | ✓ |
| 8 | event-bus record 111 / 落盘 114-117 / 广播 120（533） | 一致 | ✓ |
| 9 | handoff-schema validateHandoff 305-311（168） | 实测 306-311（微漂 1 行，链体一致） | ✓ |
| 10 | HAND_OFF_HASH_MISMATCH 265-275（535） | 实测 273 | ✓ |
| 11 | escalation emitMany/commitEscalation 244-348（206） | 159 定义/348 调用、179 commitEscalation、248 pendingHandoff | ✓ |
| 12 | orchestrator transit 唯一入口（502） | 实测定义 630 | ✓ |
| 13 | orchestrator wake.rejected 约4435（73） | 实测 4435 | ✓ |
| 14 | orchestrator validateHandoff 3099（205） | 实测 3099 | ✓ |
| 15 | instance-store canonicalize/hashRecord 53-66 私有（534） | 53/64 无 export | ✓ |
| 16 | registry/workflows.js step13 594-604（536） | 594-604 checkWakePermissions | ✓ |
| 17 | cli/roles.js exportRole/importRole 852/874（182） | 852/874 实测一致（cli 非 registry） | ✓ |
| 18 | mock-acp-agent.js 45957 字节（107/366） | 实测 45957 B | ✓ |
| 19 | USAGE_LINES 25 行（多处） | 实测 25 | ✓ |
| 20 | 禁词表全 31 词（506 等） | 实测 31 | ✓ |
| 21 | baseline-failures-win32.txt（需求524） | 实测 2852 B | ✓ |
| 22 | 35 登记文件 / 8 改文件存在 | 8 改文件全存在；新增文件全不存在（符合"新增"声明） | ✓ |
| 23 | advance.js checkWakeGate（73 引用） | 实测 advance.js:281 存在 | ✓ |
| 24 | doc-artifact.js sha256Of 237（82） | 实测 237 | ✓ |

---

## §4 WP 硬规则核查

**规则1 文件清单互不重叠 —— PASS（脚本实测）**

```
WP 数: 7 | 登记文件数: 35 | 重叠数: 0
WP-1(4) audit-verify.js, event-bus.js, chain-verify.test.js, chain-compat.test.js
WP-2(5) governance.js, governance-wake/review/granularity.test.js, boundary-i111.test.js
WP-3(4) handoff-schema.js, budget.js, evidence-stale.test.js, budget.test.js
WP-4(7) pack.js, roles.js, workflows.js, migrate.js, pack-closure/pack-sign/migrate.test.js
WP-5(5) otel-export.js, antipattern.js, otel.js, otel-export/antipattern.test.js
WP-6(3) perf-baseline.js, perf-mock.test.js, probe/acc12-perf.mjs
WP-7(7) main.js, labels.js, verify.js, orchestrator.js, escalation.js, wiring/regression.test.js
```
> 注：计数「重叠 0」成立，但 WP-4 的 roles.js/workflows.js 本身是**授权越界文件**（见 SR-01），零交集不等于零越权。

**规则2 依赖成 DAG + 每包可独立验收 —— PASS（含建议 SR-02）**：WP-7 → {WP-1..6}，WP-1~6 之间无边，无环；能力包各自带契约测试、验收口径独立（§4 行322-368）。WP-7 独立验收措辞缺口见 §5 疑点2。

**规则3 按能力切不按目录切 —— PASS**：WP-1 事件链校验 / WP-2 治理判定 / WP-3 证据+预算 / WP-4 包生态 / WP-5 OTEL+反模式 / WP-6 性能 / WP-7 接线，每 WP 对应一组可独立验证的 AC，非按 src/core 目录堆切。

**规则4 AC→WP 满覆盖 —— PASS（脚本实测）**

```
需求AC数: 23 | 首个: AC-01 | 末个: AC-23 | 连续: true
§4映射表存在: true
映射表AC行数: 23 | 未覆盖: 无 | 多余: 无
```
主责分布：WP-1(01/02)、WP-2(03/04/07/08/09/10/23)、WP-3(05/06/11/12)、WP-4(13~17)、WP-5(18/19)、WP-6(20/21)、WP-7(22)，合计 23/23。

**WP 五字段抽查 —— PASS**：WP-1(行324-328)、WP-4(行348-352)、WP-7(行372-376) 均含「负责文件(k)/依赖/交付/验收口径/可否并行」五行；7 个 WP 全数齐全。

---

## §5 重点核查三疑点的独立判定

### 疑点1 · 冲突9 授权边界 —— **FAIL（阻断 SR-01）**

- **事实**：D-13 授权修改清单（需求行699-710）点名 `main.js`/`labels.js`/`handoff-schema.js`/`event-bus.js`/`escalation.js`/`orchestrator.js`，**未点名** `src/cli/roles.js`、`src/cli/workflows.js`。而 AC-13/14 的 Then 要求导出闭包与导入验签门禁，既有入口实测在 `src/cli/roles.js:852/874` 与 `src/cli/workflows.js:792`。
- **拆分处理**：给出「契约优先级 AC Then > 附录 D」裁决理由，并在 §2.4 行183、§7 风险13 行503、§8.2 行537 三处标注「请主控在 S1 评审确认授权段」——**这是加分项**。
- **判定理由**：但拆分同时把这两个文件写死进 WP-4 的**负责文件(7)**（行348）与**交付物清单**（行428-429），并在 §2.4（行182-183）给出确定交付内容「在导出/导入 handler 调 pack.buildPackage/importPackage 前加门禁」。这已构成任务书所述「把越界改动当成既定交付」——列进负责文件=既定分工，列进交付清单=既定交付，S2 实现 Agent 会据此直接改未授权文件。§8.2「不在拆分里消化」的自述与 §4/§5 的既成事实**自相矛盾**。模板 §6 明确「必须改契约清单之外的既有契约 → 标待评审，**不自行扩大改动范围**」；拆分扩大了范围，仅以注记代替裁决。
- **修正方向（二选一）**：① 把两文件从 §4 WP-4 负责文件与 §5 交付清单移出，降为 §8.2 冲突9 下的「条件交付项」，注明「待主控书面授权 D-13 扩清单后方可纳入 WP-4」；② 由主控在 S1 Gate 前书面扩 D-13 授权清单（追加 `cli/roles.js:852/874`、`cli/workflows.js` 导出段），拆分再保留现分工。在授权落地前不得按既定交付执行。

### 疑点2 · WP-7 独立可验收性 —— **建议（SR-02，非阻断）**

- **事实**：拆分 DAG 为批次1(WP-1/2/3)→批次2(WP-4/5/6)→批次3(WP-7 单线)。WP-7 开工时 WP-1~6 已落盘，「下游未落地」在其执行顺序下不成立；能力包 WP-1~6 各自带独立契约测试，满足硬规则2。
- **判定**：wiring.test.js 的断言（三条挂载/25 行/新 reason/四目标分派/四门禁调用点，行374）绝大多数是对 WP-7 **自有负责文件**（main.js/labels.js/verify.js/orchestrator.js）的静态结构校验，可在能力包未落盘时用 stub/静态断言完成。因此**不构成 §1.4 硬规则2 实质违背**，不判 FAIL。
- **缺口**：拆分 §4 WP-7（行373-375）未写明「四目标分派/四门禁调用点」采用 mock/stub 注入或源码静态断言来解除对 WP-1/2/4 实现产物的 import 依赖，导致「包可独立验收」在文本上不可证；I1.10b 样例（行358）明确写了接线包「包内契约测试可独立跑通、验收不依赖下游」。
- **修正方向**：在 §4 WP-7「交付/验收口径」补一句「wiring.test.js 对分派与门禁调用点采用冻结签名的 stub 注入或静态源码断言，仅校验接线形状，不 require 能力包实现产物；能力包仅冻结签名未落盘时亦可独立跑通」。

### 疑点3 · AC-21 阻塞出口机检 + AC-20 mock 面独立收口 —— **PASS**

- **机检落点齐备**：`buildPerfReport` 的 `blocked` 仅当真实面 `level === '待本机实测'` 为真（§2.6 行194）；`probe/acc12-perf.mjs` 未取证输出 `待本机实测` + `blocked:true` + 试过路径（行195）；§3.7 异常态「判阻塞而非失败」（行313）；WP-6 验收口径「未取证判阻塞、不算失败、mock 不得顶替/伪通过」（行367）；检查点2「probe 取证或明确登记阻塞」（行482）；§0 退出标准1/7（行50/56）。三值分级中 mock 结果不进入真实宿主判据（行194/313），落点完整。
- **AC-20 mock 面独立收口**：WP-6「探针独立文件、mock 测试独立；真实宿主面取证由主控排期，不阻塞本包交付」（行366/368），`perf-mock.test.js` 用只读基线夹具 `mock-acp-agent.js`（45957 B 实测存在），不碰 `~/.dsh`。
- **判定**：PASS，无需修复。

---

## §6 风险覆盖核查（§7 对指定 7 类）

| 必覆盖项 | §7 落点 | 判定 |
|---|---|---|
| F2-01 契约锚点运行时取证 | 行491（风险1）+ 检查点3 行483 | PASS |
| F2-02 AC-21 真实宿主取证 | 行492（F2-02）+ 行497（风险7） | PASS |
| F2-03 性能数值分级 | 行493（F2-03） | PASS |
| F2-04 reason 码加键 | 行494（F2-04） | PASS |
| F2-05 失败差集随回归重算 | 行495（F2-05）+ 行499（风险9） | PASS |
| F2-06 独立用法块 25 行不变 | 行496（F2-06） | PASS |
| AC-21 真实宿主依赖（U-01/DoR-7 黄） | 行497（风险7） | PASS |
| I1.11 并行零交集 | 行498（风险8）+ AC-23 行404 | PASS |
| flake 差集 | 行499（风险9，禁 `--no-flake-confirm`） | PASS |
| 历史证据恢复 | 行500（风险10，`checkout-index -f` 恢复迭代4证据） | PASS |

§7 共 16 条风险（F2 六条 + 风险7~16），每条「影响/处置」均点名文件/函数/命令（如 `perf-baseline.js::buildPerfReport`、`boundary-i111.test.js`、`git diff … | grep -i`），符合模板「点名文件/函数」。**PASS**。

---

## §7 修复清单

### SR-01（阻断）· 冲突9 越界改动写进 WP 既定交付

- **位置**：§2.4 行182-183；§4 WP-4 行348「负责文件(7)」；§5 行428-429；与 §8.2 冲突9 行537「不在拆分里消化」自相矛盾。
- **原文**：「`src/cli/roles.js`（改，WP-4，授权 export/import 段）… `src/cli/workflows.js`（改，WP-4，授权导出段）」；冲突9「请主控在 S1 评审确认授权段，不在拆分里消化」。
- **违反条款**：模板 §0.1 铁律1「需求是唯一验收依据」、§6「改契约清单外既有契约须标待评审、不自行扩大改动范围」、§7 红线14；任务书疑点1 判据「越界改动当成既定交付 = FAIL」。
- **建议修法**：把两文件从 WP-4 负责文件与交付清单移出，降为 §8.2 的「条件交付项（待主控书面扩 D-13 授权后方可纳入）」；或主控在 S1 Gate 前书面扩授权清单后再保留现分工。两种路径均需在 §8 留裁决凭据。
- **严重度**：**阻断**。

### SR-02（建议）· WP-7 独立验收措辞补强

- **位置**：§4 WP-7 行373-375。
- **原文**：「依赖 WP-1~6 全部契约冻结…四目标分派 / 四门禁调用点」。
- **违反条款**：模板 §1.4 硬规则2「每包可独立验收」的可证性（非实质违背）。
- **建议修法**：补「wiring.test.js 用冻结签名的 stub 注入 / 静态源码断言校验分派与门禁调用点，能力包未落盘亦可独立跑通」，对齐 I1.10b 行358。
- **严重度**：建议。

### SR-03（建议）· event-bus.js 新增导出落点超出 D-13 授权段

- **位置**：§2.1 行155；§8.2 冲突5 行533。
- **原文**：「在 ZERO_HASH 常量（13 行）附近新增导出 canonicalizeEvent / eventFingerprint」。
- **违反条款**：D-13 行708 点名 `event-bus.js:111-116`（授权段外新增导出）。已登记冲突5 并引附录D前言，故非阻断。
- **建议修法**：S1 请主控确认是否将 13 行附近的新增导出纳入 D-13 授权段，并在 §8.2 冲突5 补一句裁决结论。
- **严重度**：建议。

---

## §8 实跑命令与输出摘要

工作目录 `d:/WWW/Maestro`。以下均实际执行（只读）。

1. **git 基线**：`git branch --show-current` → `feat/i1.12-governance`；`git rev-parse HEAD` → `540679071f5a976422b736071769e7656e4b600f`；`git status --short` → `?? docs/iterations/iteration-12.md`（拆分未跟踪）。
2. **8 节标题**：`grep -n "^## " docs/iterations/iteration-12.md` → 13/61/147/215/317/410/454/487/512（§0~§8）+ 548 附录，顺序齐全。
3. **AC→WP 覆盖脚本**（node 读 requirement.md + iteration-12.md）：`需求AC数: 23 | 连续: true`；`§4映射表存在: true`；`映射表AC行数: 23 | 未覆盖: 无 | 多余: 无`。
4. **WP 零交集脚本**（正则取 `### WP-N` 块内反引号路径建 owner 映射）：`WP数: 7 | 登记文件数: 35 | 重叠数: 0`；逐 WP 文件分布见 §4。
5. **文件存在性**：`wc -l` 8 改文件 → event-bus 158 / escalation 454 / handoff-schema 314 / main 1698 / labels 882 / orchestrator 5247 / cli.roles 1168 / cli.workflows 824；只读基线 → purity-check.mjs 4812B、mock-acp-agent.js 45957B、bin/orch.js 26行、baseline-failures-win32.txt 2852B、iteration-10b.md 87026B；新增文件 probe/acc12-perf.mjs、test/wp15、audit-verify.js、pack.js、verify.js 均 ABSENT（符合新增声明）；`src/registry/roles.js` No such file（实为 `src/cli/roles.js`）。
6. **`USAGE_LINES.length`**：`node -e "require('./src/cli/labels.js').USAGE_LINES.length"` → `25`。
7. **禁词表计数**：node 按需求 495 行 31 词字面 `split(',')` → `31`。
8. **D-13 现状 grep**：`grep -REn "verifyCommand|migrateCommand|exportCommand" src/cli bin` → 无命中；`grep "wake.not-whitelisted" src/cli/labels.js` → 无命中（均 S2 待落地，符合拆分声明）。
9. **行号核对**：`grep -n` / `sed -n` 逐处核对 §3 抽查实点表 24 处，结果全部一致（含 main.js 188-218、labels.js 183-209/354-394、event-bus.js 1-125、handoff-schema.js、escalation.js、instance-store.js、registry/workflows.js、advance.js、orchestrator.js）。
10. **上游样例**：`grep -n "^## " iteration-10b.md` → §0~§8 + 附录，确认拆分骨架与样例同构；行358 接线包「包内契约测试可独立跑通」为 SR-02 佐证。

> 复核边界：本评审只读；未修改拆分、需求、`src/**`、`test/**`、I1.11 文件；唯一写入文件为本文档 `docs/iterations/iteration-12/split-review.md`。
