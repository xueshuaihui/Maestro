# I1.12 主控裁决台账

> 本文件记录 S0~S4 过程中主控作出的裁决，效力高于需求正文的自我声明。每条裁决须写清「事实 / 裁决 / 依据 / 对需求的影响」，避免实现期以「需求内声明」冒充裁决凭据。

## 裁决 A：新增命令名冻结与 AC-21 版本指代口径（2026-11-17）

**背景**：需求 v2 按 review-round1 建议 F1-02 以「主控裁决」名义在附录 D-13 冻结三个新增命令名，但当时无独立裁决凭据；修复 Agent 在回执 R1 主动披露这一点。另 R2 指出 AC-21 的 Then 正文残留「v1 阶段本 AC 明确标注为待本机实测」的版本指代，与头部 v2 不一致，但因「Then 零改动」约束未动，靠 v2 新增契约行（483 行）统一口径。

**事实核查**（主控实跑）：
- `src/cli/main.js:199-204` 顶层命令为 `run/status/cancel/core/instance/attach/escalate/approve/handoff/workflow/trace`；`USAGE_LINES` 仅有两级 `role export` / `skill export` 子命令——无顶层 `verify` / `migrate` / `export`，三名字面与既有命令无冲突。
- `docs/index.md:902` 规划明列 `orch migrate`；901 行「签名校验 + 版本兼容检查」与 903 行「可观测性导出」是规划内能力，需 CLI 载体，非夹带。
- AC-21 Then 目标值 `handoff <2s` / `≥20 并发` 在 v1→v2 逐字未改；新增契约行已写明「真实宿主面未取证 → 判阻塞、不得 mock 顶替、不得伪通过」。

**裁决**：
1. **正式冻结**三个新增命令名字面：`orch migrate`（版本迁移，规划明列，必用）、`orch verify <包>`（签名 / 版本兼容校验）、`orch export <类型>`（可观测性 OpenTelemetry 导出）；链校验沿用同一 `verify` 按目标分派为 `orch verify <实例>`。此为本迭代正式裁决，D-13 / U-06 / BR-14~16 / AC-01/14/16/18 夹具的冻结写法有效，不再标「待裁决」。
2. 命令表回归口径：`USAGE_LINES` 既有 25 行逐字不变，三个新命令以**独立用法块追加**，不改既有行；AC-22 的 25 行断言不放宽。
3. **AC-21 版本指代**：Then 正文中「v1 阶段…」系 v1 原文，因「Then 零改动」铁律保留；其法律效力由 v2 新增契约行（483 行）与 §3.3 第 3 条承担，统一为「真实宿主面未取证 → 判阻塞、不得 mock 顶替、不得伪通过」。**不视为降级、不视为 Then 被放宽**；后续评审不得因该历史措辞要求改动 Then（改动反而违反只补不减）。
4. reason 码 `wake.not-whitelisted`（替代与 `labels.js:388` 既有 `wake.rejected` 冲突的 `wake.denied`）维持冻结，既有 `wake.rejected` 语义不动。

**对需求的影响**：无 AC / BR / NF 条目增删，无 Then 改动；仅把 D-13 已有的「主控裁决」声明补上真实凭据，并锁定 AC-21 版本指代的争议出口。

---

## 裁决 B：扩 D-13 授权清单 — roles.js / workflows.js 的导出导入 handler（2026-11-18）

**背景**：拆分评审 `split-review.md` SR-01（阻断）指出：WP-4 把 `src/cli/roles.js` / `src/cli/workflows.js` 的 export/import 改动写进既定交付，但这两文件不在需求附录 D-13 授权清单，构成「在拆分里消化需求授权缺口」。与 I1.10b 的 v6 补授权同类——需求漏登记，不能靠删 WP 交付回避。

**事实核查**（主控实跑）：
- 真实路径是 `src/cli/roles.js`（40314 字节）与 `src/cli/workflows.js`（28566 字节），**不是** `src/registry/roles.js`（不存在）。拆分文档写的路径正确，评审已澄清。
- `roles.js` 已有 export/import handler：`exportRole`（约 852~870 行，写 `exports/` 目录）、`importRole`（874 行起，含多处 `REASON/importRejected` 分支）、`roleCommand` 分发段（1164~1165 行 `sub === 'export' / 'import'`）。`workflows.js` 有 `workflowCommand`（792 行起）。
- 规划 `docs/index.md:900`「角色包/工作流包导出：含依赖闭包」、901 行「签名校验 + 版本兼容检查」明确要求包导出/导入能力，AC-13~17 承接；需求 D-13 只授权了 `main.js` / `labels.js` / `handoff-schema.js` / `event-bus.js`，**漏点名** roles.js/workflows.js 的 export/import 段。
- 模板 §2.8 优先级含「AC Then > 附录 D」，但授权清单是「只改授权段」纪律的尺子，越权需主控书面扩清单，不能仅凭优先级默认放行。

**裁决**：
1. **正式扩 D-13 授权清单**：追加 `src/cli/roles.js` 的 `exportRole` / `importRole` / `roleCommand` 的 export/import 分发子段（约 852~945、1164~1165，以符号锚点定位、行号漂移以符号为准），以及 `src/cli/workflows.js` 的 `workflowCommand` 中与工作流包 export/import 相关的子段——仅这些 handler 段可改，用于承接 AC-13~17 的依赖闭包导出、签名校验、版本兼容与 `orch migrate` 引用升级。
2. **只加不改**：既有 `role export` / `role import` / `workflow` 命令的对外行为、既有文案键（`ROLE_WRITE_TEXT` 等）、既有失败码逐字保持不变；新增校验以链末尾追加方式接入（与 D-4/D-13 既有授权段风格一致），不放宽任何既有断言。
3. WP-4 对这两文件的改动**维持既定交付**（拆分写法正确），SR-01 阻断据此闭合；拆分 §8.2 冲突 9 的状态从「请主控确认」改为「裁决 B 已授权」。
4. `event-bus.js:111-116` 授权段漂移（SR-03 建议）：行号以符号锚点为准，新增导出落在 ZERO_HASH 附近若属同一只读校验模块的合理落点即可，不要求死守 111-116 行号。

**对需求的影响**：仅扩 D-13 授权清单的授权文件段；无 AC / BR / NF 条目增删，无 Then 改动。修订由拆分修复 Agent 落到拆分文档 §8.2 与（如必要）需求附录 D-13 的授权补注，主控复核。

---

## 裁决 C：verifyChain 冻结签名与篡改序号对外口径（2026-11-18）

**背景**：批次 1 实现评审 `review-batch1.md` B1-01（阻断）：WP-1 把 `verifyChain` 实现为 `verifyChain(input)` 自持 I/O，与 §2.1/冻结点①逐字冻结的 `verifyChain({root, instanceId, fs})` + 「只 import createStore.readEvents」不符，实测按冻结签名调用抛 `TypeError`，WP-7 接线将崩溃。另评审独立发现需求内部矛盾：需求 §3.1 与拆分文档 236 行示例「改第 2 条 `to` → seq:2」，但 D-2 算法「与前一条记录自身规范化指纹比对」下，改第 2 条内容时首个 `prev` 校验失败在第 3 条。

**事实核查**（主控实跑）：
- `docs/iterations/iteration-12.md:154` 逐字冻结 `verifyChain({root, instanceId, fs})`，`fs` 可注入、只 import `createStore.readEvents`、对事件日志零写。
- 当前 `src/core/audit-verify.js:81` 为 `verifyChain(input)`，内部 `toLines(input)` 自持 I/O 抽象；纯校验核心与 I/O 可分离。
- D-2：`prev_event_hash` 取「前一条落盘记录的规范化指纹」，校验「与前一条记录自身的规范化指纹比对」。改第 2 条内容 → 第 2 条自身指纹变 → 第 3 条的 `prev` 失配，首个失配序号为 3；直改第 2 条 `prev` 字段 → 失配在第 2 条。两种操作都能被检出，仅「首处失配序号」指向不同。

**裁决**：
1. **签名以冻结为准，不改冻结点①**：`verifyChain` 恢复 `verifyChain({root, instanceId, fs})` 签名，内部只通过 `createStore.readEvents`（或注入 `fs` 的等价只读读路径）取事件，对事件日志零写；保留现有纯校验核心（parseLines/遍历/失配定位）作为内部函数，外层 const 入口适配冻结签名。B1-01 据此闭合。
2. **篡改序号对外口径以 D-2 算法为准**：AC-01 Then「指出第一条对不上的记录序号」= 「首个 `prev` 校验失败的记录序号」（D-2 口径）。需求 §3.1 与拆分 236 行「改第 2 条 → seq:2」的示例，应理解为「**直改第 2 条 `prev` 字段**」才得 seq:2；若改第 2 条**内容**则首个失配在 seq:3。此解释不弱化任何 Then、不改 AC；由 S2 修复时把示例场景补一句限定（改的是 `prev` 字段还是内容），消除歧义，不改 D-2 算法。
3. `CHAIN_COMPLETE` / `CHAIN_BROKEN` 两文案键名维持 WP-1 冻结（冻结点①授权），WP-7 必须在 `labels.js` 加键；缺键抛错、不回落硬编码中文的设计保留，不视为越界。

**对需求的影响**：无 AC / BR / NF 增删、无 Then 改动；示例歧义由 S2 在需求 §3.1 / 拆分 236 行补一句限定语（补注，非改判据）。B1-01 由实现方按第 1 条修签名闭合。

---

## 裁决 D：WP-7 评审 FAIL 的授权扩项与门禁生效口径（2026-11-19）

**背景**：独立评审 `s2-review-wp7.md` 判 FAIL（阻断 3 / 建议 6），核心事实是 `src/core/orchestrator.js` 的四处门禁均为 `void <decision>` + `catch {}` advisory no-op，`wiring.test.js` 又反向把 `void` 哨兵写成通过条件；同时存在冻结 `RUNTIME_SUBS.workflow` 越界改动、`REASON_LABEL` 新键用 non-enumerable 规避旧精确断言、新用法块无消费方、`--package/--yes` 重复登记等偏差。

**事实核查**（主控实跑与实读）：
- `requirement.md` AC-03/04/07/08/11/12 Then 明确要求「投递/拒绝/不推进/挂起/恢复」等运行时效果；advisory 判定无法让这些 Then 成立。
- `handoff-schema.js:447-457::validateHandoff` 已把 `validateEvidenceFreshness` 放在 blocking 链末尾；重复 `void` 调用不是必需，但 `check.decision` 未向 I1.11 消费方暴露。
- `main.js` 当前把 `workflow: ['pause','resume','abort']` 改为含 `export/import`，违反 D-13「既有映射不动」；`--package/--yes` 同时进 BOOLEAN 与 VALUE 表，VALUE 项为死配置。
- `labels.js:354` 将 `REASON_LABEL` 改为可变 base 后用 `Object.defineProperty(...,{enumerable:false})` 追加新键；`test/wp2/labels.test.js:217,269` 的精确枚举断言因此未变——这是为保回归数字而规避功能变更，违反模板 DoR-6。
- `USAGE_LINES_I112` 仅被测试引用，`node bin/orch.js --help` 仍只输出既有 25 行，三命令不可发现。

**裁决**：
1. **门禁必须生效**：唤醒白名单、高风险终审、并行度上限、预算耗尽四处决策必须进入编排控制流，按 AC Then 产生拒绝/停等/排队/挂起；写路径仍只走 `orchestrator.transit()` / 既有 `escalateState`，事件先落盘，不新增实例状态枚举，不新增失败节点。对**未显式配置**治理参数的既有实例保持契约兼容默认（不突然拒绝历史工作流），但一旦参数/风险标记/预算字段显式存在，判定必须 blocking。
2. 证据过期无需第二套 blocking 调用：保留 `validateHandoff` 链末尾的既有 blocking 路径，WP-7 把 `check.decision`（含原因与关联节点）挂到交接/升级记录供 I1.11 消费；`escalation.buildGovernanceRejection` 必须被唤醒拒绝路径真实调用，不留死代码。
3. **扩 D-13 授权清单**：正式授权 `test/wp2/labels.test.js` 仅两处精确断言同步（`REASON_LABEL` 枚举对象新增 `wake.not-whitelisted` 一项、`Object.keys().length` 48→49）；`wake.rejected` 及既有 47 个键值逐字不动。新 reason 键改为普通可枚举属性，以消除「查得到但枚举不到」的伪兼容。
4. 恢复 `RUNTIME_SUBS.workflow` 为冻结的 `['pause','resume','abort']`；`package`/`yes` 仅保留 BOOLEAN flag；`--help` 在既有 25 行逐字不变之后追加 `USAGE_LINES_I112` 独立块，使三命令可发现。
5. `test/wp15/regression.test.js` 保留为结构性门禁（下限与差集判定函数、冻结文件/命令/主链登记、purity/deps 实跑），**不冒充全量实跑**；AC-22 的全量 `tests ≥1425 + 差集 0` 与三主链逐字比对由 S3 验收取证、S4 复核落证据。该口径不放宽 AC-22。
6. AC-19「查看反模式信号」在冻结命令名不扩张的前提下，由 `detectAntipatterns` 只读模块直调取证（S3 用例），不新增 CLI 子命令；不构成 WP-7 的阻塞项。

**对需求的影响**：无 AC / BR / NF 增删、无 Then 改动；仅把被 advisory 架空的门禁恢复为需求原文已有判定强度，扩一处冻结断言的同步授权，并明确全量回归取证与 AC-19 查看口径。
