# 阶段一 I1.1「单节点任务可驱动」实现报告

> 依据：`docs/iterations/iteration-1/requirement.md` **v5**（唯一验收依据）
> 拆分与契约：`docs/iterations/iteration-1.md`
> 验收记录：`docs/iterations/iteration-1/acceptance.md`（+ `acceptance-product.md` / `acceptance-fixture.md` / `evidence/`）
> 评审记录：`docs/iterations/iteration-1/review-round1.md`、`review-round2.md`
> 环境：Windows 11 / Node v22.22.2 / DSH `0.2.1-rc.5`
> 完成时间：2026-11-05 00:15（本地）

## 0. 总体结论

**I1.1 达成退出标准，可以收口。**

| 判定项 | 结果 |
|---|---|
| 26 条 AC | **26 通过 / 0 不通过 / 0 阻塞**（真实宿主 14 + 夹具 12） |
| 7 项非功能标准 | **7 达标 / 0 未达标** |
| 16 条 BR | 全量测试 216 用例覆盖，评审逐条核对无违反 |
| 阻断级缺陷 | **0**（3 轮评审共提出 9 个阻断项，全部修复并验证） |
| 证据 | `evidence/` 137 个文件，脚本落盘，可复核 |

一句话结论：一条 `orch run` 能在真实 DSH 上把单角色单节点任务跑完并落盘产物；实例 / 节点 / 会话 / 交接包四层状态都能从命令与事件里查到；关掉命令行任务不被带走，重启后标「已中断」而不偷偷重跑；失败时分「开始前 4 条 / 开始后 5 条」可区分提示，宿主原文不吞不改。

## 1. 交付物

### 1.1 产品代码（7,116 行，零第三方运行时依赖）

| 层 | 文件 | 行数 | 职责 |
|---|---|---|---|
| 入口 | `bin/orch.js` | 26 | CLI 入口 + `core serve` 内部通道转调 |
| 持久化 | `src/persistence/paths.js` | 105 | 项目根 / 管道名（路径哈希）/ 布局 |
| | `src/persistence/atomic-write.js` | 125 | tmp+rename 原子写、EPERM 重试、备份复制 |
| | `src/persistence/instance-store.js` | 321 | `state.json` 快照 + `events.jsonl` 追加、CAS 保存、损坏备份 |
| 核心 | `src/core/orchestrator.js` | 1449 | 9 步主流程、`transit()` 统一迁移、失败收尾、早返回、`waitForRun` |
| | `src/core/state-machine.js` | 204 | 实例 / 节点 / 交接包三张迁移表 + 拒绝留痕 |
| | `src/core/event-bus.js` | 115 | 事件必落盘后广播、单实例串行 |
| | `src/core/error-map.js` | 117 | 9 条失败码分类（`-32602` 按 message 双义拆解） |
| | `src/core/verify-artifact.js` | 195 | 产出路径提取 + 存在性/非空核对 |
| 适配器 | `src/adapter/stdio-transport.js` | 403 | NDJSON 分帧、串行写、spawn 失败归因 |
| | `src/adapter/acp-client.js` | 450 | JSON-RPC 关联、6 原语、permission 应答、drain-quiet |
| | `src/adapter/session-state.js` | 267 | 6 态归一化、噪声帧白名单、cancel 隔离 |
| | `src/adapter/handoff-tracker.js` | 219 | `delivered→accepted` 只认 turn 内事件 |
| | `src/adapter/host-config.js` | 145 | 宿主配置（夹具入口）、审批策略 |
| | `src/adapter/dsh-launch.js` | 171 | Windows 启动 shim（`ELECTRON_RUN_AS_NODE` + asar bin） |
| | `src/adapter/factory.js` | 177 | 装配 acp-client / normalizer / tracker |
| 常驻 | `src/daemon/server.js` | 724 | 本地命名管道、9 个 IPC 方法、优雅退出 |
| | `src/daemon/client.js` | 419 | 自动拉起（detached+unref）、请求/订阅 |
| | `src/daemon/lifecycle.js` | 120 | `ensureCore` / `stopCore` / `isAlive` |
| | `src/daemon/ipc-frames.js` | 133 | NDJSON 帧编解码与校验 |
| | `src/daemon/serve-entry.js` | 159 | 核心启动入口（真实 orchestrator，失败才降级） |
| CLI | `src/cli/main.js` | 531 | 4 命令、退出码 0/1/2/3、流式输出 |
| | `src/cli/render.js` | 455 | 全部行渲染（层名前缀、`HH:mm:ss`、时长） |
| | `src/cli/labels.js` | 86 | **唯一中文来源**（9 条 + `STATE_CORRUPT` + `INSTANCE_TERMINAL`） |

### 1.2 测试与夹具

| 包 | 用例 | 覆盖 |
|---|---|---|
| `test/wp1` | 29 | 原子写、损坏不清空、100 并发事件、半截实例不入列表 |
| `test/wp2` | 39 | 三张表逐边、非法迁移留痕、`-32602` 双义、9 条文案逐字 |
| `test/wp3` | 35 | NDJSON 半帧/多帧/坏行、6 态映射、噪声不改状态、mock 全链 |
| `test/wp4` | 16 | happy path 事件序、NODE_BUSY、无半截、核对失败、cancel、reconcile |
| `test/wp5` | 24 | 帧编解码、真实管道、订阅、`core stop`、自动拉起、EACCES |
| `test/wp6` | 35 | 全部渲染函数逐字、退出码、`params.raw` 不截断 |
| `test/wp7` | 5 | factory 连 mock、早返回 <1s、后台失败不崩、`run.wait` 两分支 |
| `test/wp8` | 14 | 三 policy 闭环、双核心零副作用、CAS 冲突、失败收敛 idle |
| `test/wp9` | 19 | `SESSION_INVALID` 渲染、`tool_running` 带时长、断连恢复、S-2 六样例 |
| **合计** | **216** | `node --test "test/**/*.test.js"` → **216 pass / 0 fail** |

夹具：`test/fixtures/mock-acp-agent.js`（真 ACP 进程，11 个开关）、`probe-adapter.mjs`（适配器层探针，机读 JSON）、`attempt-transition.mjs`（AC-26）。

### 1.3 文档

`iteration-1.md`（拆分与契约）、`dsh-probe.md`（真机探针）、`review-round1.md`、`review-round2.md`、`acceptance.md` + 两份分面记录、`evidence/`（137 文件）、本报告。

## 2. 六个功能点对照

| 功能点 | 交付程度 | 验证 |
|---|---|---|
| **A 发起单节点任务** | `orch run --cwd --task [--instance]` 一条命令跑通单角色单节点，实例/节点/会话由核心自动建 | AC-01（真实：2338ms 出三行，632B 落盘） |
| **B 看会话在做什么** | 6 态有定义：`thinking` / `tool_running` / `waiting_input` / `waiting_dependency` / `idle` 可观测，`escalated` 仅定义；5 种行文案 + 「无新事件」 | AC-03/15/16/17/23/25 |
| **C 看节点走到哪** | 节点 6 态由核心裁决，`running→review→done` 必经待校验，与会话状态分开显示 | AC-05/06 |
| **D 看交接包走到哪** | 7 态有定义、5 态可观测（`pending`/`expired` 零产生路径），四行带时间戳，非法迁移拒绝留痕 | AC-04/19/24/26 |
| **E 出错时看得懂** | 开始前 4 条 + 开始后 5 条，逐字可区分；`params.raw` 原文不吞不改；`SESSION_INVALID` 与 `NODE_BUSY` 是两条 | AC-07/09/10/11/18/20/21/22 |
| **F 关掉再打开还在** | `state.json` + `events.jsonl` 落盘；`core stop` 后标「已中断 ｜ 停在节点/会话」，不重跑不重连；损坏复制为 `.corrupt` 不清空 | AC-02/08/12/13/14 |

## 3. 证据分级

| 级别 | 覆盖 | 说明 |
|---|---|---|
| **已实测（真实宿主）** | AC-01~AC-14、NFR-01/02/07/08 | 真实 DSH `0.2.1-rc.5` + 真实账号模型，隔离 `DSH_HOME`，项目根在 `%TEMP%`；证据为命令原始输出 + 磁盘快照 |
| **夹具实测（产品同一条代码路径）** | AC-15~AC-26、NFR-03/04/06 | mock 经 `host-config → stdio-transport(spawn) → acp-client(NDJSON)` 进入产品链路，状态机/事件总线/存储全为产品实现 |
| **未覆盖** | 机器级冷启动（无 OS 页缓存清空手段）、`escalated` 触发、`pending`/`expired` 真实发生 | 前两项是环境/范围限制；`pending`/`expired` 需求明文「本迭代零产生路径」 |

## 4. 过程与缺陷收敛

| 轮次 | 介入 | 结果 |
|---|---|---|
| 拆分 | 架构子 Agent 产出 `iteration-1.md`，主 Agent 裁决 D1~D4（终态不复用、加适配器层探针、10s 卡死阈值、cwd 选址） | 5 个工作包 DAG，文件清单互不重叠 |
| 探针 | 真机打通 DSH ACP，纠正两个认知错误 | **分帧是 NDJSON 而非 `Content-Length`**；cwd 放仓库目录会触发 pwsh 权限修复，turn 从 5s 膨胀到 24.8s |
| 实现 1 | WP-1/2/3 并行（持久化、状态机、适配器+夹具） | 103 用例 |
| 实现 2 | WP-4/5 并行（编排、守护进程） | 40 用例；暴露两个接缝缺陷 |
| 集成 | WP-7 收口：补 `adapter/factory.js`、`startRun` 早返回、`run.wait` | 端到端首次跑通；真机验证 |
| 评审 1 | 独立评审 → **7 个阻断**（状态机只校验内存副本、`waiting_input` 无产生路径、`reconcileOnBoot` 在 listen 前、失败不收敛会话、`--hold-session` 未生效、`--session-missing` 不可构造、`step` 恒 null） | WP-8 全部修复，148→197 用例 |
| 实现 3 | WP-6 CLI 4 命令 + 渲染 | 真实端到端首次由 CLI 完成 |
| 评审 2 | 复审 → 6 项确认修复，**新发现 2 阻断**（`SESSION_INVALID` 渲染成「未知错误」、`tool_running` 无时长） | WP-9 修复 + S-1/S-2，197→216 用例 |
| 验收 | 双路独立验收（产品面 / 夹具面，各自独立环境） | **26/26 通过** |

三个最有价值的实测纠正（都已落进实现）：

1. **分帧**：ACP 走 NDJSON，不是 LSP 的 `Content-Length` 头。按错写解析器会一行都读不到。
2. **`stopReason` 不判失败**：`blocked` / `error` 都被宿主映射成 `end_turn`，判定必须以「产出核对」为准。
3. **`-32602` 同码双义**：会话不存在 / prompt 在飞行用同一个码，必须按 message 分流，否则 `NODE_BUSY` 会被误报成「会话已失效」（AC-07 与 AC-20 会互相污染）。

## 5. 与阶段零 13 条锁定约束的对齐

| 约束 | 落地位置 | 状态 |
|---|---|---|
| 1 `load` 后 drain-quiet（idle 40ms / cap 400ms） | `acp-client.quietWindow()`，`newSession` 返回前调用 | 已实现 |
| 2 核心自算指纹、`artifactRef` 只从 `rawInput.file_path` 提取 | `orchestrator` 从 `tool_call`（非 `tool_call_update`）取 `file_path` | 已实现 |
| 3 `-32602` 双义禁止只按 code 判会话失效 | `error-map.classifyPromptError` 按 `/already in flight/i` 分流 | 已实现（有 39 用例覆盖） |
| 4 `accepted` 只认 turn 内事件、排除噪声帧 | `session-state.TURN_UPDATES` 白名单 + `handoff-tracker` | 已实现 |
| 5 cancel 非即时，节点超时容忍迟到 update | `onCancelled` 进 quarantine，`turnId` 不匹配即丢弃 | 已实现 |
| 6 三态直接可得、两态显式置位 | `waiting_dependency` 由 `onOutputSubmitted`、`escalated` 仅定义 | 已实现 |

其余 7 条（工具行平台条件挂载、`write` 落盘语义、无 `bash` 硬编码、凭据隔离等）在夹具与启动 shim 中遵守：mock 默认工具名 `write`、参数 `{file_path, content}`，全仓 `grep` 无硬编码 `bash`。

## 6. 遗留项与风险

### 6.1 阻断级：0

### 6.2 非阻断观察（已登记进 `acceptance.md` §3）

| # | 现象 | 影响 | 处置 |
|---|---|---|---|
| O-1 | 失败收尾时失败文案打印两次（节点行 + 收尾行） | 观感冗余 | I1.4 统一输出层收敛 |
| O-2 | `store.save` 的「读检查→rename」跨进程 TOCTOU | 单写者架构下不可达 | 多写者出现时引入文件锁 |
| O-3 | 需求 §3.3 的 `--illegal-transition` 开关未在 mock 实现，AC-26 改用 `attempt-transition.mjs` | 语义已覆盖 | 需求 v6 修订夹具表 |
| O-4 | `INSTANCE_TERMINAL` 是九条之外的第 10 条文案 | BR-13 要求不同原因不得合并 | 保留并登记 |
| O-5 | 探针无记录时以 `idle` 兜底（同时输出 `observedState:null`） | 不自证，但需读字段 | 产品级证据已由 wp8 承担 |
| O-6 | 节点→`done` 比交接包→`consumed` 早 2ms | 不违反 AC-05 | 如需严格串行，核对后显式落事件 |

### 6.3 二轮评审遗留的建议项（不阻断，转后续）

| ID | 现状 | 建议去处 |
|---|---|---|
| S-3 | 核对失败时交接包停 `accepted` + `note='verification_failed'`，非终态 | I1.4 定义「核对失败后交接包最终态」 |
| S-4 | `transit` 不看 `emit` 返回值（事件落盘失败时状态已 save） | I1.4 补「事件失败即回滚」策略 |
| S-5 | `markInterrupted` 先补 `created→running` 再判 `interrupted`，事件多一步「运行过」 | I1.8 恢复流程时一并修 |
| S-7 | `factory` 未调 `probeDshInstalled`（靠 spawn stderr 兜底） | I1.2 补前置探测，文案统一为「未找到 `<path>`」 |
| S-9 | `list()` 内 `markCorrupt`，读路径带写副作用 | I1.9 存储层重构 |
| S-11 | `handoff-tracker` 先改状态后 emit 且吞异常 | I1.4 与 S-4 一并处理 |
| S-12 | `startRun` 不返回 `stream`，`server.drainStream` 为死代码 | I1.2 清理或接线 |

### 6.4 范围外（本迭代明确不做，已由需求界定）

多角色 / 多节点 / 编码闭环模板（I1.2）、缺陷回流与升级生成（I1.2）、指纹校验（I1.12）、真正的人工审批队列（I1.11，本迭代用 `permissionPolicy=hold` 占位）、恢复中断任务（I1.8）、自动重投与 `expired` 产生路径（I1.4）。

## 7. 下一步建议

1. **I1.2 起点**：`orchestrator.startRun` 目前是硬编码单节点单角色，扩展点已经留好 —— `buildPrompt(task)` 与 `roleId='worker'` 是唯一两处角色假设，替换为角色包注入即可。
2. **先修 S-11 / S-4**：事件丢失在 I1.2 多节点并发下会被放大，建议在加第二个节点之前补上「emit 失败即回滚状态」。
3. **把 `permissionPolicy=hold` 换成真队列（I1.11）**：现在 hold 只能靠 `orch cancel` 收尾，一旦有第二个人用就会卡住。
4. **`npm test` 仍不可用**（Node 22 下 `node --test test/` 报 `MODULE_NOT_FOUND`）。当前用 `node --test "test/**/*.test.js"`，建议 `package.json` 改为该 glob。

## 附录：命令速查

```bash
# 发起任务（热启动 5s 内看到三行）
node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段 200 字的产品说明，保存到 out/intro.md"

# 查状态 / 时间线
node bin/orch.js status
node bin/orch.js status --instance INST-001 --events

# 取消（不残留中间态）
node bin/orch.js cancel --instance INST-001

# 停核心（实例标「已中断」，不重跑）
node bin/orch.js core stop

# 全量测试
node --test "test/**/*.test.js"    # 216 pass
```
