# 阶段一 I1.2「编码闭环（开发 → 测试 → 缺陷回流 → 升级）」实现报告

> 依据：`docs/iterations/iteration-2/requirement.md` **v16 定稿**（唯一验收依据；46 条 AC，有效 44 + 作废 2）
> 拆分与契约：`docs/iterations/iteration-2.md`（WP-1 ~ WP-7，文件清单互不重叠）
> 验收记录：`acceptance-product.md`（真实 DSH 面 5 条）、`acceptance-fixture.md`（夹具面 39 条）、`evidence/`（233 个文件）
> 评审记录：`review-baseline.md`、`review-contract.md`、`review-v14-consistency.md`、`review-round1.md`、`review-round2.md`
> 环境：Windows 11 / Git Bash / Node v22.22.2 / DSH `0.2.1-rc.5`（`deepseek-account` → `deepseek-flash`）
> 完成时间：2026-11-05

## 0. 总体结论

**I1.2 达成退出标准，可以收口。**

| 判定项 | 结果 |
|---|---|
| 44 条有效 AC | **44 通过 / 0 不通过 / 0 阻塞**（真实宿主 5 + 夹具 39） |
| 非功能标准 | 真实面 3 项 + 夹具可测 6 项，全部达标 |
| BR-01~31 | 独立评审逐条预判无违反；全量用例覆盖 |
| 全量测试 | **337 / 337 通过**（I1.1 的 216 用例按 D-8 合法改写后仍全绿） |
| 阻断级缺陷 | **0**（实现评审 2 个阻断 + 验收首轮 5 条未通过/阻塞，全部修复并复验） |
| 架构约束 | AC-28 扫描 `src/core,src/daemon` **exit 0**，四词零命中 |
| 回归红线 | `single` 输出逐字保持 I1.1（AC-21 真实宿主实测） |

一句话结论：一条 `orch run --template code-loop` 能在**真实 DSH** 上把「开发 → 测试 → 判不通过 → 回流 → 开发修复 → 复测通过」跑完；两节点、三张交接包、轮次上限与升级挂起都由核心驱动；`single` 保持 I1.1 逐字行为；旧格式实例只读可查且"看也不改"。

**最难的一条（AC-45 真实回流）实测**：第 1 次即成功、0 重试，`verdict.read(fail)` 的 seq=87 夹在 T-002 第 1 轮派发（seq=21）与 T-001 第 2 轮派发（seq=93）之间，即 `21 < 87 < 93`；3 张交接包（forward / backflow 含 1 条缺陷 / retest）全 `consumed`，无第 3 轮。端到端耗时约 5m26s。

## 1. 交付物

### 1.1 产品代码（29 个 `.js`，11,081 行，零第三方运行时依赖）

| 层 | 新增/修改 | 职责 |
|---|---|---|
| 图定义 | **新增** `src/templates/index.js` | `GRAPHS = { single, 'code-loop' }`、三角色常量、内置提示词；`coordinator` 只定义不派发 |
| 规则层 | **新增** `src/core/{graph,advance,verdict,escalation}.js` | 图查询（纯函数无 IO）、推进规划与交接包构造、判定读取六类失败、升级事务与幂等键 |
| 编排核心 | 改 `src/core/orchestrator.js` | `startRun` 图驱动、`driveGraph` / `advance`、`transit` 五表按 id 寻址 + CAS、`applyCancel` 四数组化、`snapshotOf` 多会话、测试接缝 |
| 状态机 | 改 `src/core/state-machine.js` | 节点 10 条新增边、`escalated:['cancelled']`、交接包 `created→rejected`、升级表 / 会话 guard 表、实例 `suspended`、五组常量 |
| 产物核对 | 改 `src/core/verify-artifact.js` | `code-loop` 固定 `产物：<路径>`（全角冒号）+ `roundStartedAt` mtime + 空文件文案；`single` 启发式逐字不变 |
| 持久化 | 改 `src/persistence/instance-store.js` | `state.json` v2、`save` 的 `expectedState` 双形状 + `rev` 基于磁盘单调、`list()` 只读投影、v1 只读不回写 |
| 适配 / 守护 | 改 `src/adapter/session-state.js`、`src/daemon/server.js` | 会话 `escalated` 终态守卫 + `quarantined`；`run.start` 透传 `template`/`hostId`、`instance.cancel` 四数组透传、test-only 接缝 |
| CLI | 改 `src/cli/{main,render,labels}.js` | `--template` / `--host`、退出码 4/5、`renderEventLine(event,{template})` 分流、节点表 / 会话单行 / 带方向交接包 / 升级块；`labels.js` 为唯一中文来源 |
| 错误映射 | 改 `src/core/error-map.js` | 补 `CANCEL_NOT_NEEDED`（I1.1 的 9 条原文与 `INSTANCE_TERMINAL` 一字未改） |

### 1.2 测试与夹具（30 个 `.test.js`，337 用例）

- **新增** `test/fixtures/code-loop-driver.mjs`（23 个场景、4 批参数：`--prepare-only` / `--stop-after` / `--keep` / `--reset`）、`call-seam.mjs`、`purity-check.mjs`、`legacy-v1/**`（两份 v1 快照 + 事件 + `SHA256SUMS`）。
- **改** `test/fixtures/mock-acp-agent.js`：从 11 个开关扩到场景化行为，`cursor.json` 原子消费防并发重复。
- **改** `test/fixtures/attempt-transition.mjs`：适配 v2 `nodes[]` / `handoffs[]`，按 `--node` 定位。
- 夹具**走产品同一条链路**：`bin/orch.js run` → `host-config` spawn mock → stdio NDJSON → `acp-client` → `orchestrator`；不 import 核心、不直接改 `state.json` 造态。

### 1.3 文档

| 文件 | 内容 |
|---|---|
| `requirement.md` v16 | 需求定稿（v13→v14 两节点裁剪 + C-01~C-14 → v15 自洽 16 处 + X1~X3 → v16 AC-15 观测点） |
| `iteration-2.md` | 8 项技术选型（含被否决项）、文件级契约、`state.json` v2 样例、WP-1~WP-7 DAG、风险与降级 |
| `review-*.md` × 3 | 基线符合性、契约一致性、v14 自洽性（三轮文档评审） |
| `review-round1.md` / `review-round2.md` | 实现独立评审（44 条 AC 预判 + 31 条 BR 预判 + 2 阻断）、收口复核与处置 |
| `acceptance-product.md` / `acceptance-fixture.md` / `evidence/` | 5 + 39 条 AC 逐条记录、原始输出、state/events 证据（233 个文件） |

## 2. 需求范围对照（§1.3 十条「范围内」）

| # | 需求 | 落地 | 验收 |
|---|---|---|---|
| 1 | 一条命令发起编码闭环 | `orch run --template code-loop`；图是代码常量、无工作流文件 | AC-01 / 03（真实）、AC-02 |
| 2 | 三内置角色（协调者不派发） | `src/templates/index.js`；两节点图 | AC-28 架构检查 |
| 3 | 节点表 + 当前会话另起一行 | `renderNodeLine` / `renderSessionLine` | AC-21 / 22 / A-2 |
| 4 | 结构化判定、核心只认文件 | `readVerdict` 六类失败（缺文件 / 坏 JSON / schema / 无缺陷 / 证据不可读 / 非本轮） | AC-13/14/15/16/18/19 |
| 5 | 交接包带上下文（正向 + 回流） | `buildHandoff` / `buildBackflowHandoff`，缺陷摘要 + 证据位置 + 复测要求 | AC-05 / 24 / 43 |
| 6 | 轮次上限 2 + 升级挂起 | `planAdvance` / `commitEscalation`；挂起重启不推进 | AC-07/08/09/10/12 |
| 7 | 引擎可复用（接受注入图） | `createOrchestrator({graph,graphs})`；假图单测验证顺序/回流/上限/挂起四件事 | AC-28 / `fake-graph.test.js` |
| 8 | v1 只读可查、v2 重启不丢 | `list()` 投影、`rev` CAS、v1 三写入点拒绝 | AC-20 / 40 |
| 9 | 取消收敛到终态 | `applyCancel` 遍历四数组、`created→rejected(withdrawn)`、升级 `pending→voided` | AC-11 / 36 / 42 |
| 10 | `会话 等待下游` 可见 | 回合结束且已提交产出 → `waiting_dependency`，核对完成后才 `idle` | AC-44（真实面 AC-45 亦观测到） |

**范围外**均按 §1.3 表执行：角色注册表（I1.5）、声明式 YAML（I1.6）、人工裁决入口（I1.4）、会话恢复（I1.8）、三层日志（I1.9/10）、Cursor / WorkBuddy 接入（阶段二/三）都未越界。

## 3. 证据分级

> 项目约定：结论一律带分级，**已实测（真实宿主）** / **mock 实测** / **阻塞**，并附可复核原始帧。

| 级别 | 条数 | 内容 | 可复核位置 |
|---|---|---|---|
| **已实测（真实 DSH）** | 5 | AC-01 / 03 / 21 / 22 / 45 | `acceptance-product.md` §1、`evidence/AC-01|03|21|22|45.*` |
| **mock 实测** | 39 | 其余全部夹具面 AC（产品 CLI + mock 宿主同一链路） | `acceptance-fixture.md` §1、`evidence/AC-xx.*` 171 个 |
| **架构检查** | 1（含在 39 内） | AC-28 `purity-check.mjs` exit 0 | `evidence/AC-28.output.json` |
| **阻塞** | **0** | 首轮 1 条（AC-25）已修并复验 | `review-round2.md` §2 |

真实面环境口径：隔离 `DSH_HOME = %TEMP%/maestro-acc-p2/dsh-home`（凭据副本已删，`~/.dsh` 未动）、`agent-default-model` / `acp` patch 到 `deepseek-account` / `deepseek-flash`、项目根一律 `%TEMP%`（不放仓库目录，避免 DSH 权限修复把 turn 拉长）。

**真实耗时**（spawn→三行 / spawn→终态，ms）：AC-01 `2330 / 48780`、AC-03 `2557 / 49769`、AC-21 `2356 / 23831`、AC-22 `2500 / 32774`、AC-45 `2363 / 325710`。NFR-01a 10 次 max `210.86ms`（≤5s）、NFR-02 `239ms`（≤1s）。

## 4. 过程与缺陷收敛

### 4.1 需求与规划（4 轮矫正 + 3 轮文档评审）

v13 → **v14**（两份评审判定「需修订」：两节点裁剪 D-1、真实回流 D-2、补契约 C-01~C-14、三处描述纠错）→ **v15**（自洽性复核 16 处 + 拆分文档 X1~X3 回补 `rev` / `escalations[].defects[]` / `counters.dispatchCount`）→ **v16**（验收阶段 AC-15 观测点可构造性修正，见 §5）。拆分文档 `iteration-2.md` 冻结 8 项技术选型（含「图写 YAML」「图硬编码进 orchestrator」等被否决项）与 13 条接缝 S1~S13 / 契约 C-01~C-14。

### 4.2 实现（7 个工作包，DAG）

| 包 | 名称 | 关键产出 |
|---|---|---|
| WP-1 | 状态机 · 文案 · 标签 | 10 条新边、五组常量、D-5 逐字文案（契约地基） |
| WP-2 | 持久化 v2 · CAS · v1 只读 | `expectedState` 双形状、`rev` 单调、`list()` 投影 |
| WP-3 | 图引擎 · 判定 · 升级 · 产物 | `templates/` + 4 个规则层模块 + `code-loop` 产物分支 |
| WP-4 | 编排核心改造 | `driveGraph` / `advance` / `transit` 五表 / 四数组取消 / 测试接缝（最重） |
| WP-5 | IPC · CLI 渲染 | 参数透传、退出码 4/5、双模板渲染分流 |
| WP-6 | 夹具驱动 · mock | 23 个场景、原子 cursor、接缝客户端 |
| WP-7 | **集成收口** | 修 2 个红灯、`haltCause` 落盘、`VERDICT_TEXT` 收归 `labels.js`、三个端到端场景（pass / backflow / rounds-exceeded）全通 |

WP-7 是 I1.1 教训的落地：5 个包各自全绿但接缝漏了会跑不通，本迭代专门留了收口包。**337/337 全绿 + 三个端到端场景全通**是该包的验收口径。

### 4.3 评审与验收（2 轮实现评审 + 2 轮验收）

1. **独立评审 round1**：44 条 AC 逐条预判 + 31 条 BR 预判 + 11 组架构/回归核查，给出 2 个阻断（BLK-01 AC-28 扫描脚本缺失且 `state-machine.js` 注释命中角色词；BLK-02 AC-42 二次取消文案走 `INSTANCE_TERMINAL`）。→ 修复并实测。
2. **验收首轮**：真实面 **5/5**；夹具面 **34 通过 / 4 不通过 / 1 阻塞**。
3. **根因归类与修复**（不放宽任何断言）：产品字段口径 1 处（`parseVerdict` 的 `result` 别名）、产品锁粒度 2 处（`startRun` / `seamDispatch` 忙检查放在锁之前）、夹具 2 处（`attempt-transition.mjs` v2 适配、driver 拆两个判定样本）、需求观测点 1 处（AC-15 → v16）。
4. **复验**：重跑批 2 / 批 3，夹具面 **39/39**；全量 **337/337**；架构扫描 exit 0。详见 `review-round2.md` 与 `acceptance-fixture.md` §0「复验说明」。

## 5. 与阶段零锁定约束的对齐

| 约束 | I1.2 的处理 |
|---|---|
| `load` 后 drain-quiet | 未改 I1.1 会话加载路径；`driveGraph` 复用同一适配器链路 |
| 核心不依赖宿主上报产物指纹 | `verifyProducts` 用 `nodes[].roundStartedAt` 检查 mtime + 文件存在/非空；`artifactRef` 仍只从 `rawInput.file_path` 提取 |
| `-32602` 同码双义 | `error-map.js` 仍按 message 文本分 `NODE_BUSY` / `SESSION_INVALID`，未改成按 code 判失效 |
| `accepted` 只认 turn 内事件 | 未改；`code-loop` 事件行分流只影响渲染，不影响判定 |
| cancel 非即时、容忍迟到 update | `applyCancel` 四数组化 + `quiescing` / `quarantined` 守卫，AC-39 通过 |
| 只有 3 态由 ACP 直接可得 | `waiting_dependency` / `escalated` 由核心显式置位；`escalated` 除取消外无出边 |

**本迭代新增的实现约束**（供 I1.3+ 遵守）：① 状态迁移唯一入口仍是 `orchestrator.transit()`，CAS 形状 `{state, halted, rev}`；② `rev` 必须**无条件基于磁盘现值**递增（进程重启后不回 1）；③ 图 / 角色字面量只能在 `src/templates/**`，`src/core,src/daemon` 零命中；④ 忙检查必须放在写锁之前，否则 hold 场景会把业务拒绝变成 `IPC_TIMEOUT`；⑤ `halted` 必须是**独立的一次 `saveState`**，不与升级条目合并。

## 6. 遗留项与风险

### 6.1 阻断级：0

### 6.2 非阻断观察（已登记，不影响收口）

1. **`npm test` 在 Node 22 不可用**：`package.json:13` 为 `node --test test/`，报 `MODULE_NOT_FOUND`；统一用 `node --test "test/**/*.test.js"`（I1.1 起即如此）。
2. **AC-22 是「真实面抽查 6 条」**：I1.1 全 26 条的完整结论需与 216 用例 + 夹具面报告合并；本迭代未重复跑 I1.1 全量真实面。
3. **NFR-01b「10 次取最大」**：真实面取到 6 行 / 4 个有效样本（max 14ms），未凑满 10 次，已在 `acceptance-product.md` 如实标注。
4. **AC-45 是单点实测**：真实模型一次跑通、0 重试；需求 §3.3 已登记「模型可能第 1 轮主动补边界」的已知风险，本结论不构成统计性保证。
5. **两份验收报告头部保留 v15**：那是执行时的依据版本（历史事实）；AC-15 按 v16 复验已在 `acceptance-fixture.md` §0 声明，不追溯改写。
6. **AC-03 表述差异**：任务描述简写「3 张交接包」，v16 AC-03 明写「恰好 1 条」（一轮通过）；3 张是 AC-45 回流形态，按唯一依据判通过并已登记。

### 6.3 范围外（需求 §1.3 已界定）

协调者角色只定义不派发（I1.5）、`escalated` 人工裁决入口（I1.4）、YAML 声明式图与校验器（I1.6）、产物隔离与 git 合并（I1.7）、会话恢复（I1.8）、三层日志（I1.9/10）、链式哈希审计与预算（I1.12）、Cursor / WorkBuddy 接入（阶段二/三）。

## 7. 下一步建议

1. **I1.3（审核角色 + `review_reason`）**：直接复用 `GRAPHS` 注入机制加一张图，不改 `src/core`；注意 D-1 的 `escalated→cancelled` 仍是升级唯一出口。
2. **I1.4 人工裁决**：补 `orch escalate list/resolve`、`escalated → done / failed / 重新分配` 三条出边与 `pending` 重投；`halted` 独立写的约束要保留。
3. **补 `package.json` 的 test 脚本**：改为 `node --test "test/**/*.test.js"`，消掉最后一个非阻断观察项。
4. **AC-45 做 3~5 次重复真实跑**：把「单点实测」升级为有统计意义的结论，同时验证模型主动补边界的已知风险发生频率。

## 附录：命令速查

```bash
# 全量测试（Node 22 必须用引号 glob）
node --test "test/**/*.test.js"

# AC-28 架构约束
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator

# 夹具：准备现场 / 跑一个闭环场景（项目根放 %TEMP%，不要放仓库）
node test/fixtures/code-loop-driver.mjs --root <绝对路径> --scenario backflow --prepare-only
node test/fixtures/code-loop-driver.mjs --root <绝对路径> --scenario backflow --keep --stop-after 3

# 产品：真实编码闭环（任务文本必须含全角「产物：」行）
node bin/orch.js run --cwd ./demo-code-pass --template code-loop --task "补 div 函数… 产物：calc.js"
node bin/orch.js status --instance INST-001 --events
node bin/orch.js cancel --instance INST-001
node bin/orch.js core stop

# 复验夹具面报告（4 批 + 汇总）
node probe/acc2-f-b1.mjs && node probe/acc2-f-b2.mjs && node probe/acc2-f-b3.mjs && node probe/acc2-f-b4.mjs && node probe/acc2-f-final.mjs
```
