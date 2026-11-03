# 阶段零（I0.1）任务拆分 — ACP 适配器兼容性验证

> 依据：`docs/index.md` 第二部分「迭代规划 · 阶段零」、第一部分「剩余待验证项」。
> 范围：本迭代只产出**验证结论**，不写产品代码；实验代码为可丢弃 spike，但必须留痕、可复现。
> 编号：阶段零在迭代依赖图中为 I0.1。

---

## 0. 迭代定位、范围与退出标准

### 目标

回答 5 个剩余待验证项，对每个「接缝」给出 可用 / 受限 / 不可用 结论，并锁定阶段一 ACP 适配器的实现路径。

### In scope

- ACP 5 原语的跨 transport 驱动验证（stdio / HTTP+SSE）
- 会话恢复方言统一验证（`resume → load → new` 回退链）
- 并发会话隔离验证（cwd / 工具调用 / 权限请求 / cancel / close）
- 非编码证据提取验证（`session/update` 能否支撑证据引用三要素）
- Cursor ACP 并发稳定性基线（轻量探活，非产品化接入）
- 产出：验证报告 + 阶段一实现路径锁定建议 + 宿主能力矩阵草稿 + 风险清单

### Out of scope（明确不做，防范围蔓延）

- 不做 daemon 持久化 / 事件日志链式哈希
- 不做桌面 UI / 托盘 / 通知
- 不做工作流引擎、角色与技能注册表
- 不做多宿主混跑、治理、预算配额
- **不接入 Codex**：阶段零 stdio 代表性宿主仅 DSH，Codex 归阶段三
- **不做 Cursor 产品化接入**：仅稳定性探活

### 退出标准

1. 验证报告完成，5 个接缝均有结论 **且附原始证据**。
2. 阶段一 ACP 适配器实现路径锁定（transport 选择、方言处理方案、是否需要 mock、证据补充策略）。
3. **总体结论**明确给出阶段一「可直接启动 / 带约束启动 / 需先补设计」三档之一。
4. 风险与未决项清单可读。

---

## 1. 判定口径（先定义，后使用）

### 「接缝」定义

核心抽象可能泄露宿主差异的边界：transport、会话恢复、并发隔离、证据提取、并发稳定性。

### 三档结论

| 结论 | 判定标准 | 对阶段一的含义 |
|---|---|---|
| **可用** | 核心抽象零修改即可跨该接缝工作；无 `if host` / `if transport`；该接缝的度量项全部通过 | 路径可直接采用 |
| **受限** | 核心需增加显式能力声明或适配层（但仍收敛在适配器内，daemon 无 host 分支）；或某项指标未达标但可用配置 / 约束规避 | 路径可用，但必须把约束与缓解措施写进设计 |
| **不可用** | 必须修改核心抽象（引入 host 分支或改变 5 原语契约），或关键能力缺失导致场景不成立 | 阶段一须调整设计或降级 |

### 证据要求

每个结论必须附：可复现的实验命令 / 脚本 + 原始交互帧或日志 + 度量数据。**禁止只给结论。**

---

## 2. 前置环境准备（公共基础）

| 任务 ID | 任务 | 验证 / 判定 | 产出 |
|---|---|---|---|
| ENV-1 | 确认 DSH ACP server 本地可启动，记录启动参数、`--session <id>` 跨调用保持方式、连接方式 | 能复现「单连接多会话」与「跨调用会话保持」 | DSH 接入速查 |
| ENV-2 | 建立 HTTP/SSE 验证环境：优先 WorkBuddy sidecar 动态端口 + 临时密码；不可达则搭最小 mock server。临时密码只从环境变量读取，**不落盘、不进日志** | 能发 `initialize` / `session/new` / `session/prompt` / `subscribeEvents` / `session/cancel` | transport 环境说明 |
| ENV-2a | mock 合规要求：必须实现 5 原语 + 至少 3 类错误（未知 session、cancel 中途、权限拒绝） | mock 能产生可区分的成功 / 失败帧 | mock server |
| ENV-3 | 确认 Cursor CLI `agent acp` 本地可用，记录 stdio 启动方式与生命周期方法 | 能创建 Cursor 会话并完成一次 prompt | Cursor 接入速查 |
| ENV-4 | 搭建最小探活 harness（复用 `@yitom/acp-client` 或自写），仅依赖 5 原语，并支持**原始帧落盘**（供 VP-4） | harness 能驱动任一已接入宿主完成单节点任务并留存原始帧 | 可复用 harness |

> **环境指纹**：ENV-1 / 3 必须记录宿主版本号（DSH ACP server / Cursor CLI / WorkBuddy），写入 `capability-matrix.md` 的「环境指纹」行，保证结论可复现。
> **效力边界**：mock 只能证明「transport 抽象成立」，不能证明「真实 WorkBuddy 方言成立」；报告中必须标注结论来源（真实 / mock）。

---

## 3. 验证工作包（5 个接缝）

### VP-1 跨 transport 驱动

**要回答**：同一份核心编排代码（只依赖 5 原语、零 `if host` / `if transport`）能否用 stdio（DSH）与 HTTP/SSE（WorkBuddy/mock）驱动。

**具体任务**

1. 定义 `ACPTransport` 接口（`connect` / `request(method, params)` / `onNotification(cb)` / `close`）与 5 原语调用序列：`initialize → session/new → session/prompt → 订阅 update → session/cancel`。
2. 实现 stdio transport（DSH），跑通单会话。
3. 实现 HTTP/SSE transport（WorkBuddy 或 mock），跑通同一序列。
4. 用 `git diff` 对比两路下**编排循环**的改动，记录 transport 配置字段差异。

**实验协议**：同一份编排循环代码，仅切换 `hosts/<host>.json` 配置即可切换 transport。

**度量**：**编排循环** diff 行数（transport 实现属可替换模块，不计入）；配置字段集合；5 原语调用序列是否一致。

**判定**：编排循环 diff = 0 且新增仅限配置 → **可用**；需在编排循环读取 capability flag → **受限**；需在编排循环 `if transport` → **不可用**。

**产出**：`spike/acp-harness/`、`reports/vp1.md`

---

### VP-2 会话恢复方言统一

**要回答**：DSH `session/resume`（不回放）与 WorkBuddy `session/load`（追加）能否在适配器层统一为 `resumeOrCreate`。

**契约**：`resumeOrCreate(sessionId?) → Session`（`sessionId` 为 null 时等价 `new`）。**核心只见 `Session`，不得见 `replay` 字段**；`replayMode: none | append | full` 仅作为适配器内部日志与调试信息，不进入核心返回类型。

**具体任务**

1. 记录恢复语义：DSH `session/resume`（不回放）、WorkBuddy `session/load`（追加）；Codex `replayFrom` 仅记录，不验证。
2. 设计回退链 `resume → load → new` 与降级条件（如 resume 返回 not-supported 则往下降）。
3. 实验 A（DSH）：建会话 → prompt → 断连 → resume → prompt，检查上下文连续、无重复产物。
4. 实验 B（WorkBuddy/mock）：同上，检查 load 追加语义是否重复注入历史。
5. 检查核心代码是否出现任何 `replay` 引用（属泄露信号）。

**判定**：核心仅依赖 `Session`、无 `replay` 引用 → **可用**；核心必须感知 `replayMode` 才能正确工作 → **受限**（说明语义未在适配器收干）；无法恢复 → **不可用**。

**产出**：`reports/vp2.md` + 方言决策树（文字版）

---

### VP-3 并发隔离强度

**要回答**：3–5 个并发 DSH 会话，**五维**（cwd / 工具调用 / 权限请求 / cancel / close）是否严格隔离。

**具体任务**

1. 以**单连接内**并发 3 个 session 为主场景（基线声称已实现单连接多会话复用），扩到 5；另做一组多连接对照，记录两者差异。
2. 每 session 绑定独立 cwd，写 `marker-<sid>.txt`（内容 = sid），并执行一次工具调用。
3. 交叉污染检测：扫描所有 cwd，任一文件出现非本 session 标识即判串台。
4. cancel 隔离：cancel A 进行中的 turn，观察 B/C 是否受影响。
5. close 隔离：close A，观察 B/C 存活与资源释放。
6. 权限请求隔离：并发触发 permission request，验证 response 只能作用于对应 session（构造「用 A 的 response 应答 B 的 request」负面用例）。

**度量**：并发数、串台次数、cancel / close 影响面、权限错配次数。

**判定**：五维全部严格隔离 → **可用**；某一维偶发异常但有稳定规避 → **受限**（注明规避方式）；稳定串台 → **不可用**。

**产出**：`reports/vp3.md`、`spike/isolation-test/`

---

### VP-4 非编码证据提取

**要回答**：`session/update` 事件流能否支撑结构化证据引用三要素，还是需要适配器补充。

**三要素 ↔ 字段映射**：产物指纹（`artifactRef` + `fingerprint`）、审核确认（`confirmedBy` / `confirmedAt`）、时效依据（`producedAt`，用于过期判定）。

**具体任务**

1. 用非编码场景（研究 → 撰写 → 审核）**真实**跑一轮，用 ENV-4 harness 录制 raw `session/update` 帧（含时间戳、sessionId、事件类型）。
2. 尝试构造 `Evidence { artifactRef, fingerprint, producedAt, confirmedBy, confirmedAt }`。
3. 逐字段标注来源：事件流可得 / 需推断 / 缺失。
4. 若缺失，评估适配器补充方式（如要求角色 final message 附机器可读清单 + 适配器解析）。
5. 明确边界：本项只验证「引用可否构造」，**不验证真实性**（真实性归宿主验证 / 独立审核角色）。

**判定**：三要素全部满足（`artifactRef` + `fingerprint` + `producedAt` + `confirmedBy` + `confirmedAt` 均可构造）→ **可用**；需适配器或角色约定补充 → **受限**；完全不可得 → **不可用（证据模型需改）**。

**产出**：`reports/vp4.md`、`evidence-samples/`

---

### VP-5 Cursor ACP 并发稳定性

**要回答**：3–5 个并发 Cursor ACP 会话的失败率、延迟与崩溃恢复行为。

**具体任务**

1. 确认 Cursor `agent acp` 版本与启动方式，记录支持的生命周期方法（`session/new` / `list` / `close` / `resume`）→ 填入能力矩阵草稿。
2. 记录**进程模型**：每个会话是独立 `agent acp` 进程，还是共享一个进程（决定阶段二的进程管理方式）。
3. 单会话基线：跑通一次 prompt，记录延迟。
4. 3 并发 → 5 并发，各跑 **M ≥ 10 轮**，记录成功率、P50 / P95 turn 延迟、崩溃次数、崩溃后恢复行为。

**判定**：**不预设通过线**。仅当出现系统性无法建立会话或崩溃不可恢复 → **不可用**；其余给 **可用 / 受限** 并记录数值，供阶段二定阈值。

**降级**：环境不可得 → 记录阻塞，阶段二首迭代优先回答，不阻塞阶段一。

**产出**：`reports/vp5.md`、`capability-matrix.md`（草稿）

---

## 4. 交付物清单

| 路径 | 内容 | 工作包 |
|---|---|---|
| `docs/iterations/iteration-0/report.md` | 验证报告（主，含总体结论） | VR-1 ~ VR-4 |
| `docs/iterations/iteration-0/capability-matrix.md` | 宿主能力矩阵 + 环境指纹 | VP-5 + 全部 |
| `docs/iterations/iteration-0/evidence-samples/` | 原始帧样本 | VP-4 |
| `spike/acp-harness/` | 5 原语探活 harness（含原始帧落盘） | ENV-4 |
| `spike/mock-acp-server/` | mock HTTP/SSE server | ENV-2 |
| `spike/isolation-test/` | 并发隔离测试 | VP-3 |
| `spike/cursor-concurrency/` | Cursor 并发压测 | VP-5 |

---

## 5. 收口任务（VR）

| 任务 ID | 任务 | 验收 |
|---|---|---|
| VR-1 | 按 §6 模板汇总 5 个接缝结论，附原始证据与度量 | 每行结论 + 证据路径 + 数据齐全 |
| VR-2 | 输出阶段一实现路径锁定建议：transport 选择、方言处理方案、mock 去留、证据补充策略 | 每条建议可落地、有依据 |
| VR-3 | 风险与未决项清单（含「待阶段二/三回答」项） | 每项有触发条件与影响 |
| VR-4 | **总体结论**：按「全可用 → 可直接启动；含受限 → 带约束启动（列约束）；含不可用 → 先补设计再启动」给出结论 | 三档之一 + 理由 |
| VR-5 | 迭代评审（约 1d）+ 复盘（约 0.5d），对齐基线固定节奏 | 评审记录 + 复盘结论 |

> 合成规则：只要任一接缝判为「不可用」，VR-4 不得给出「可直接启动」；「受限」必须在 VR-2 中转化为具体设计约束，否则视为未收口。

---

## 6. 验证报告模板（固定结构，逐接缝填写）

| 接缝 | 结论 | 关键证据（路径 / 帧） | 度量 | 对阶段一的影响 | 缓解措施 | 未决风险 |
|---|---|---|---|---|---|---|
| transport | | | | | | |
| 恢复方言 | | | | | | |
| 并发隔离 | | | | | | |
| 证据提取 | | | | | | |
| Cursor 稳定性 | | | | | | |

**总体结论**：`可直接启动 / 带约束启动 / 需先补设计`（三选一，附理由）

---

## 7. 依赖与排期

```
Day 0–2   ENV-1 / ENV-2 / ENV-4 并行；ENV-3 并行
Day 2–4   VP-1 跨 transport（关键路径，先锁抽象）
Day 4–6   VP-2 恢复方言（关键路径）
          VP-3 并发隔离（并行，依赖 ENV-1）
          VP-4 证据提取（并行，依赖 ENV-1 + VP-1）
          VP-5 Cursor（并行，依赖 ENV-3）
Day 6–7   收口 VR-1 ~ VR-4
Day 7.5   VR-5 评审 + 复盘
```

- **关键路径**：ENV（2d）→ VP-1（2d）→ VP-2（2d）→ 收口（1d）≈ **7 个工作日（约 1.5 周）**。
- **上述估算假设 ≥2 人力**（VP-2 / VP-3 / VP-4 / VP-5 并行）。若单人执行，全部串行约 13 个工作日（≈2.6 周），超出基线「1–2 周」，须二选一：砍 VP-5，或延长本迭代。
- 时间盒为建议值，非承诺。

---

## 8. 风险与降级

| 风险 | 触发条件 | 影响 | 降级动作 |
|---|---|---|---|
| WorkBuddy sidecar 不可达 | 动态端口 / 临时密码获取失败 | HTTP/SSE 只能验 mock，方言效力受限 | 用 mock 验 transport 抽象，方言标「待阶段三验证」 |
| Cursor ACP 不可用 / 版本不匹配 | `agent acp` 启动失败 | VP-5 无法完成 | 记录阻塞，阶段二首迭代优先回答 |
| DSH 并发上限未知 | 5 并发出现不稳定 | VP-3 结论不稳 | 先定 3，逐步加，记录拐点 |
| 单人力执行 | 只有 1 人 | 串行 13d，超出迭代窗口 | 砍 VP-5 或拆迭代 |
| 时间盒超限 | 1.5 周内未收口 | 影响阶段一启动 | VP-5 降级 / 延后，保 VP-1~4 |

---

## 9. 关键判断点映射（对齐基线）

| 基线判断点 | 本阶段任务 | 意义 |
|---|---|---|
| 统一 ACP 适配器能否跨 transport 驱动 | VP-1 | 核心抽象是否真正宿主无关 |
| 会话恢复方言能否在适配器层统一 | VP-2 | daemon 是否零感知宿主差异 |
| 并发会话隔离强度 | VP-3 | 多会话安全性的前提 |
| 非编码证据能否从事件流提取 | VP-4 | 非编码闭环是否可行 |
| Cursor 并发稳定性 | VP-5 | 阶段二接入风险的提前暴露 |
