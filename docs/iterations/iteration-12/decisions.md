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
