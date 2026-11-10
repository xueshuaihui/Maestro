# I1.9 三层日志 + 健康度计算 · 任务拆分与文件级契约

> 拆分文档版本：r2
> 需求依据：`docs/iterations/iteration-9/requirement.md` **v7**（1060 行，27 条 AC / 25 条 BR / 附录 A~D；用户给定 S0 评审闭环已 PASS，本文档不自行宣布评审通过）
> 上游实现：I1.7 收口 `main@70277df`（全量基线 `1028 tests / 1019 pass / 8 fail / 1 skipped`，失败集合登记于 `docs/iterations/iteration-7/baseline-failures.txt`）
> 评审依据：`docs/iterations/iteration-9/review-round1.md` ~ `review-round7.md`（最终轮 round7 总判 PASS）、`requirement-understanding.md`（R-1~R-14、Given 可构造性）、`decisions.md`（D-0~D-3）
> 拆分自检口径：模板 `docs/templates/execution-template.md` §1.3（0~8 骨架）/ §1.4（WP 四硬规则 + 五字段 + §4 末尾满覆盖表）/ §1.5（10 条自检）/ §1.6（可复制骨架）；样板 `docs/iterations/iteration-7.md`、`iteration-2.md`
> 契约优先级（模板 §2.8）：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > 规划文档 > 代码现状`。代码现状只用于核对行号与调用形态，不作需求来源。

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：把实例运行过程沉淀为三层可复盘记录——只追加且首尾相接的事件日志、回答"这个节点为什么失败"的执行日志摘要、可按回流轮次展开的追踪跨度；并按四档规则计算实例健康度、写入实例元数据、变化进事件日志，用户用 `orch trace show` 与 `orch instance status` 即可看到全部结论；三条主链逐字不破、零新依赖。

**In scope**（逐条对应需求 §1.3「范围内」7 条，逐字落位）：

- **In-1 事件日志的链式哈希基础**：每条新事件携带前一条记录的指纹，首条使用固定起点指纹；只追加、不改写、序号不复用；同一实例一条链，不同实例各自独立（AC-01/02/21/25；BR-01/02/22/25；附录 D-1）。只做链、不做校验命令与篡改报告。
- **In-2 执行日志摘要**：会话完成或失败时，把命令、退出码、关键输出行数、日志文件引用作为摘要附加到事件日志；完整日志仍留在宿主，核心只保存摘要与引用。BR-04 把收尾扩为「完成 / 失败 / 取消」，摘要挂在**会话**上、一条会话一条，同一节点多轮各一条、按轮次分开、不合并也不覆盖；失败轮在追踪里显示，成功与取消只在日志可查；缺项显示"未提供"（AC-04/05/24/26/27；BR-04/05/21；附录 D-4）。
- **In-3 追踪跨度**：每个实例一个追踪号；节点每轮一条跨度，记录开始、结束、状态、关联交接包；追踪数据落到 `instances/INST-001/state/traces.jsonl`；回流链按轮次可展开（AC-06/07/08/10/22/23；BR-06/07/08/09；附录 D-2）。
- **In-4 `orch trace show` 加一个实例号位置参数**：以时间线展示跨度，并单独展开回流链；空追踪、单节点、实例不存在都有明确提示；只读、重复执行输出一致、不追加事件、不新增 `--format`、不提供 JSON 输出（AC-08/09/10；BR-08/09；附录 D-5）。
- **In-5 健康度四档**：需关注 / 慢 / 正常 / 已结束的规则落地；健康度写入实例元数据，`orch instance status` 与 `status.md` 可见；档位变化进事件日志（AC-11~18；BR-10~16；附录 D-3）。
- **In-6 两个口径的明确定义**：「慢」的 P90 样本来源与判定方法、「慢」的 TTL 起算点与 50% 阈值，均在需求内给出可复现定义（AC-14/15；BR-19/20；附录 B-2/B-3）。
- **In-7 会话留痕的审计粒度**：会话的逐条状态迁移不作为新的审计事件；用户要知道"这个会话为什么结束 / 失败 / 被取消"，看的是执行日志摘要那一条；节点、交接包、升级的状态变更照常审计；审批与取消一类治理动作照常留痕（AC-24/26；BR-23；基线 564 行；附录 D-4/D-7）。

**Out of scope**（摘要，全表见需求 §1.3 L49-59 与 `requirement-understanding.md` §1.2）：

| # | 范围外项 | 去向 | 是否阻塞 |
|---|---|---|---|
| O-1 | OpenTelemetry 导出（不实现导出格式、不新增导出命令、仅数据布局预留） | I1.12 | 不阻塞 |
| O-2 | 崩溃恢复、检查点、`session/resume` / `session/load` 恢复方言 | I1.8 | 不阻塞 |
| O-3 | 桌面壳、面板健康度徽标、追踪可视化界面、WebSocket 推送 | I1.10a / I1.10b | 不阻塞 |
| O-4 | 链式哈希的篡改检测报告 / 校验命令 | I1.12 | 不阻塞 |
| O-5 | `pending → expired` 自动过期与随之而来的升级 | 后续治理迭代 | 不阻塞 |
| O-6 | 健康度参与路由决策的具体策略 | 基线偏差 U-4，`decisions.md` D-1 裁决豁免：本迭代不改路由 | 不阻塞 |
| O-7 | 既有 12 处逐条会话状态事件的清退 | 基线偏差 U-7，`decisions.md` D-1 裁决：仍在发射、不新增不删除，清退归 I1.12 | 不阻塞 |
| O-8 | 真实宿主的执行日志格式适配 | 后续真机迭代，B 类零 DSH 验收，缺项"未提供" | 不阻塞 |
| O-9 | 追踪数据的保留期与轮转 | 后续迭代 | 不阻塞 |
| O-10 | worktree 生命周期清理策略（实例终止时保留 / 清理） | 承自 I1.7 §1.3，属 U 项，I1.9 继承不改 | 不阻塞 |
| O-11 | `orch trace show` 的 JSON 输出 / 图形化时间线 | 后续或 I1.12（U-6） | 不阻塞 |

> **不夹带规划外能力的显式声明**：OTel 导出、健康度参与路由、worktree 生命周期、`trace show` JSON 输出、事件链校验命令、`pending → expired` 自动过期均**不在任何 WP 交付项内**；实现侧若发现需求未覆盖的细节，按模板 §6 记台账并升级，不自行扩范围。

**退出标准**（逐条可判定，含数字或逐字口径）：

1. **27 条 AC 100% 通过 / 0 不通过 / 0 阻塞**：AC-01~AC-27 每条的 `**Then**` 均有对应机检 / 夹具 / 架构检查断言通过；规划三段验收句分别由 AC-08 / AC-16 / AC-04 在夹具现场实跑通过；证据按「AC 号 + 阶段 + 类型」三段命名（如 `AC-07.state.json` / `AC-07.events.jsonl` / `AC-07.status.txt`）落 `docs/iterations/iteration-9/evidence/`，每条至少 4 份原始帧；结论三档取「通过」（`mock 实测`），收口不带阻塞。
2. **回归基线不破**：全量测试 `node --test "test/**/*.test.js"` 的**失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 差集 = 0**，测试条数只增不减（基线 `1028 / 1019 / 8 / 1`，`decisions.md` D-2 裁决沿用差集口径，**非绝对全绿**）；既有断言仅允许 D-8 登记的期望文本变化，不放宽 `Then`、不删既有用例。
3. **三条主链逐字不变**：`single` / `code-loop` / `task-loop` 运行期终端输出与 I1.7 收口基线字节相等，不多一行健康度、不多一行追踪、无任何文字或顺序变化；`orch instance status` 删除健康度行后与基线逐字相等；`orch instance graph` 文本与 JSON 与基线字节相等、不出现健康度字段；健康度只以「新增一行」出现。
4. **架构门禁**：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon` 以 D-6 登记的 31 词全表作 `--forbid` 参数逐词扫描，必 `exit 0`（新增 `src/core/health.js` / `src/core/trace.js` 纳入同一扫描）；`node -p "Object.keys(require('./package.json').dependencies||{}).length"` 输出 `0`（deps=0 / 零第三方运行时依赖）。
5. **两条冻结基线**：`src/cli/labels.js` 的 `USAGE_LINES` **25 行不变**（`:183-208`，`test/wp12/cli-assets.test.js:119-132` 不改、前 8 行逐字不变）；`grep -c "object: 'session'" src/core/orchestrator.js` **≤ 13**（实测基线 12 = 保留 4 / 冻结 7 / 复用 1，+1 处 `execution.summary` 写入点）。
6. **NFR 全部满足**：NF-1 可读（status 10s 内、20 节点 50 跨度 1s 内）、NF-2 可靠（链断点 0 / 序号重复 0 / 旧行改写 0，追踪坏行只跳过并计数）、NF-3 无回归（见 2/3）、NF-4 边界（完整日志不进实例目录、健康度不改编排状态）、NF-5 依赖（`dependencies` 恒为 `{}`）。

---

## 1. 技术选型（结论 + 被否决项）

> 每条给出「结论 + 理由 + 被否决的方案及否决原因」，供实现侧与后人复盘，避免重复踩坑。

### 1.1 事件链哈希算法与尾读方式

**结论**：对「前一条完整事件记录」做规范化 JSON 序列化（递归按键名排序、UTF-8、无多余空白）后用 Node 内置 `node:crypto` 计算 SHA-256，取 64 位小写十六进制写入新字段 `prev_event_hash`；首条用 64 个 `0` 作固定起点。序号（`seq`）与上一条指纹来自**同一次文件尾读取**——`src/persistence/instance-store.js` 新增 `readTailForChain(id)` 返回 `{ seq, prevHash, corruptAll }`；`src/core/event-bus.js:90-105` 的 `emit` 在串行队列内调用它并附加 `prev_event_hash`，仍保持「先 `appendEvent` 落盘、成功后才 `broadcast`」顺序。整份不可解析时 `seq=1`、`prevHash` 为 64 个 `0`，原文件一行不删 / 不改写 / 不改名。

**理由**：规范化序列化避免字段顺序变化断链（D-1 L941）；同一次尾读避免两次读之间并发写入让 `seq` 与指纹错配；Node 内置模块守住零依赖；旧记录不回填、末行截断前溯与既有 `nextSeq` 容错口径一致（BR-22/25、AC-21/25）。

**被否决的方案 + 原因**：
- **对原始行字节直接哈希** —— 字段顺序一变就断链，D-1 明令禁止。
- **先取 `seq` 再取指纹分两次读文件** —— 两次读之间可能有并发追加，序号与指纹错配、链首尾对不上；D-1 L942 要求同一次尾读。
- **引入第三方哈希 / 日志库** —— 违反 D-6 / NF-5 零第三方运行时依赖，全部用 Node 内置模块即可。
- **本迭代就做篡改检测报告 / 校验命令 / 签名** —— 属 I1.12（BR-03、O-4），夹带规划外能力。
- **新增第二条序号来源** —— 破坏 `nextSeq`「末行坏则前溯」的唯一容错口径（R-12、AC-25）。

### 1.2 `traces.jsonl` 位置与 `handoff_ids` 读取时推导

**结论**：追踪数据落 `instances/INST-001/state/traces.jsonl`，由 `src/persistence/paths.js` 新增 `instanceStateDir(root, id)` / `instanceTracesPath(root, id)` 两导出（既有 `statePath` / `eventsPath` 不动）；`src/core/trace.js` 负责 `TRC-` + 8 位小写十六进制追踪号、节点每轮收尾整行一次追加 7 字段跨度、只读读取（坏行跳过并计数）。写入时机在**节点本轮收尾**、早于 `maybeStopAfter`（`orchestrator.js:3141`）与 `advance()`（`:3157`）。`handoff_ids` **不落盘**，由 `trace.deriveHandoffIds(state, nodeId, round)` 在 `orch trace show` 读取时按 `fromNodeId` / `toNodeId` + `round` 推导：接收包 `round === r`；产出包正向 `round === r`、回流 `round === r + 1`；按 `createdAt` 升序去重。进行中的跨度由读取时按当前实例状态叠加、不写文件。

**理由**：落 `state/` 子目录满足 §2.3.1「随实例状态存放、不散落在实例根目录」；收尾时写跨度使 `--stop-after 3` 冻结窗口恰有 3 条已完成跨度（A-3 / AC-08）；读取时推导才能让 T-002 第 1 轮跨度拿到 `advance()` 之后才创建的回流包 `HO-002`（`round=2`），冻结窗口 3 条 `handoff_ids` 依次为 `[HO-001]`、`[HO-001, HO-002]`、`[HO-002]`（D-2、v7 F-03、AC-08）。

**被否决的方案 + 原因**：
- **把 `handoff_ids` 写盘冻结值** —— `HO-002` 由 `advance()` 在 T-002 收尾之后创建，晚于该轮跨度 `end_time`，冻结会让 T-002 r1 跨度永远少一个 `HO-002`，A-3 的 `HO-001 HO-002` 对不上。
- **只按「`round` 等于本轮」过滤** —— 会漏掉 `round=2` 的 `HO-002`，D-2 明令删除该规则。
- **先 `advance()` 再写跨度** —— 冻结窗口只剩 2 条，与 A-3 的 3 行基线不符（D-2 明令"不得采用"）。
- **把 `traces.jsonl` 放实例根目录或 `workspace/`** —— 违反 §1.3 / §2.3.1「状态子目录」可见性与 U-9「不迁移既有布局」。
- **写入时把进行中跨度也落盘** —— 未完成节点无 `end_time`，伪造结束时刻违反 BR-06 / A-10。

### 1.3 健康度纯函数与 `now` 注入

**结论**：新增 `src/core/health.js`，导出纯函数 `computeHealth({ state, graph, traces, now })` → `{ level, reasons }`；不读盘、不取系统时间，`now` 为可注入毫秒时间戳（缺省 `Date.now()`）；`level ∈ { normal, slow, attention, ended }`，`reasons` 为 D-3 固定 8 码顺序的原因码数组。角色不可用的判定**直接由 `state.nodes[].roleId` + `state.sessions` 投影**（某角色有一条绑定会话 `state === 'escalated'` 即判不可用；`quarantined` 只计会话崩溃），不接收角色注册表、不调用 `buildRoleInstances`（`src/registry/role-instances.js:123` 需注册表，核心无注册表、传空表会把全部角色误判 `unavailable`）。精确等值边界（节点超时 30000ms、P90 50000ms、TTL 900000ms 恰好等于不命中 / 超出 1ms 命中）**只在 `test/wp12/health.test.js` 对纯函数注入固定 `now` 断言**；CLI 级一律用远离边界的安全余量（31s vs 30s、70s/30s vs P90 50s、15:05/14:55 vs 15:00）。

**理由**：纯函数 + 可注入 `now` 是 v7 F-01/F-02 把等值边界下沉单元级的前提；真实时钟 δ>0 会把"恰好等于"推成"严格大于"，CLI 级不可构造；终态优先与 8 码固定顺序保证 A-6 附逐字可命中（D-3、AC-13/14/15）。

**被否决的方案 + 原因**：
- **把 `computeHealth` 做成读盘 / 内部取 `Date.now()` 的非纯函数** —— 等值边界不可构造、CLI 级结论随查看时长漂移（v7 F-01/F-02/F-07）。
- **在 CLI 级断言「恰好等于阈值」** —— δ 不可能为 0，会把不命中判成命中，v7 已删除该做法。
- **调用 `buildRoleInstances` / 传入角色注册表** —— 核心无注册表，空表把全部角色判 `unavailable`，破坏 AC-13 角色夹具单行逐字命中（v7 F-10、D-3）。
- **健康度参与路由 / 调度 / 状态迁移** —— U-4 基线偏差，`decisions.md` D-1 裁决豁免，本迭代不改路由（BR-16、D-3「禁止」）。
- **把健康度写进 `graph.json`** —— D-3 明令禁止，且破坏 AC-19 `graph` 逐字基线。

### 1.4 摘要提取落点（核心，非适配器）

**结论**：四项摘要（`command` / `exitCode` / `keyOutputLines` / `logRef`）由 `src/core/orchestrator.js` 的 `handleUpdate`（D-7 授权段 `:1183-1230`）读取原始帧后缓存到会话级待写摘要缓存；会话收尾的**三个既有函数** `quiesceSession`（`:1282`）/ `idleSession`（`:1311`）/ `applyCancel`（`:3807`）调用同一个共享辅助函数落 `execution.summary`，`object: 'session'` 字面量因此只新增 1 处。`src/adapter/session-state.js:146-160` **本迭代不改**（只做状态与工具名归一化，`tool_call_update` 分类分支在 `:153`）；取消路径 `applyCancel` 落盘前把 `session.toolName` 置空（`:3843`），且 `ctx` 缓存里只有 `tool_call.title`（mock 为 `write`，是工具名不是命令），故 AC-26 四项一律存 `null` 渲染"未提供"，不猜值、不省略。

**理由**：D-4 明确「提取落点在核心，不在适配器」；集中一处写入使 `grep -c "object: 'session'"` 上限仍是 13（12 处既有 + 1 处摘要）；三个收尾函数覆盖完成 / 失败 / 取消三种收尾，不新增第四个入口（D-7、AC-26/27）。

**被否决的方案 + 原因**：
- **在 `src/adapter/session-state.js` 里提取或新增摘要字段** —— 该文件本迭代不改（D-4/D-7），适配器只做归一化；若需读 `update` 原始帧，改在 `orchestrator.js` 侧做（v3 F-04）。
- **在三个收尾函数里各写一份 `object:'session'` 字面量** —— 会新增 3 处，突破 `grep ≤ 13` 上限，且重复收尾会重复写；D-7 要求共享辅助、集中一处。
- **用 `session.toolName` 冒充 `command`** —— `toolName` 来自 `tool_call.title`，不是命令行，且 `applyCancel` 会置空；D-4 明令禁止（v5 F-06、A-14）。
- **新增第四个摘要入口 / 独立触发点** —— D-7 明令禁止；`:3852` 的 `run.cancelled` 只是已有发射点，不是第二个摘要入口。
- **把完整日志正文复制进实例目录** —— 违反 BR-05 / NF-4 / AC-05，核心只存摘要与引用。

### 1.5 CLI 新增命令面与五个渲染纯函数

**结论**：运行时命令表加 `trace`，子命令只有 `show`，位置参数一个实例号（也接受 `--instance`），**不新增 `--format`**；`USAGE_LINES` 25 行不动，`trace` 用法走参数错误路径提示、不进主用法块；退出码成功（含空追踪 / 单节点）`0`、实例不存在 `1`、参数错误 `2`。`src/cli/render.js` 只新增 `renderHealthLine` / `renderTraceShow` / `renderSummaryLogLine` / `renderHealthEventLine` / `renderEventsSkippedLine` **五个纯函数**，中文全部来自 `src/cli/labels.js`；`renderEventLines`（`:988`）只允许在函数开头加一个按 `event.reason` 的分派分支（`execution.summary` / `health.changed` 委托新函数），其余事件仍走原逻辑。`instance status` 只在实例状态行之后插入一行健康度；`instance graph` 不插入任何健康度内容；`instance log` 对两种 reason 分派、列表末尾按需输出「已跳过 N 行不可读记录」；`renderTraceShow` 节点列按 `graphNode.title ?? nodeId`，无 `title` 时只输出节点号（`single` 的 `T-001`，不输出 `roleId` / `worker`）。

**理由**：五个纯函数让中文只经 `labels.js`、既有事件行格式与相对顺序不动（D-5、BR-18、AC-19）；命令面最小增量守住 I1.7 三视图与 `USAGE_LINES` 逐字红线（v7 F-04/F-05、D-11）。

**被否决的方案 + 原因**：
- **改 `USAGE_LINES` 25 行基线、把 `trace` 用法塞进主用法块** —— I1.6 逐字锁定，D-5 / D-8 / `test/wp12/cli-assets.test.js:119-132` 明令不改。
- **给 `trace show` 加 `--format` / JSON 输出 / 图形化时间线** —— U-6 / §2.3.2 范围外，属后续或 I1.12（AC-09 边界）。
- **把健康度渲染进 `renderGraphJson` / `renderGraphText` / `orch run` 收尾** —— 破坏 BR-18 / AC-19 与 I1.7 `includeBranch` 三视图红线；健康度只属 `instance status` 与 `status.md`。
- **在 `render.js` 既有事件行里硬编码中文或改既有行格式** —— 违反「中文唯一来源 `labels.js`」与「既有事件行格式不动」（D-6、D-11）。
- **改造既有 `renderEventLines` 的全部事件分支** —— 扩大回归面，D-7 只允许开头加一个分派分支。

### 1.6 `--host mock` 统一口径

**结论**：以需求 §3.3 L525 宿主夹具总口径为准——S3 验收脚手架（`probe/acc9-*`）与所有直接 `orch run` 夹具命令行一律**显式带 `--host mock`**，夹具在自身根目录下预置 `.orch/hosts/mock.json`（`launch.command` / `launch.args` 指向 `test/fixtures/mock-acp-agent.js`）；两个 driver 已由内部注入 host（`code-loop-driver.mjs:494` 注入 `'--host','mock'` 且写 `mock.json`；`task-loop-driver.mjs:253` 注入 `'--host',HOST_ID`），属 `decisions.md` D-3 允许的「由 driver 内部注入」豁免。**AC 的判定锚点、Then、附录 A 基线一字不改**；此裁决只统一「怎么把现场造出来」，不改「判什么」，也不改产品代码与需求正文。

**理由**：`decisions.md` D-3 已裁决（触发点：AC-04/05/24/22 的「夹具：」示例未带 `--host`）；代码侧 `src/adapter/factory.js:43` 默认 `hostId='dsh'`、`src/cli/main.js:806` 仅当 `flags.host` 为字符串才透传 `hostId`、`src/adapter/host-config.js:39-40` 配置路径为 `.orch/hosts/${hostId}.json`（`root` 为实例根）——省略参数会解析 `dsh.json` 而非夹具预置的 `mock.json`。

**被否决的方案 + 原因**：
- **省略 `--host` 靠默认解析** —— 会解析 `dsh.json`，`--fail-tool` / `--fail-tool-no-refs` / `--hold-session` 等开关可能不被拉起，AC-04/05/22/24/26 现场不可构造（D-3 触发点）。
- **为对齐而改 AC 的 Given/When/Then 或附录 A 期望值** —— D-3 明确「只统一怎么把现场造出来，不改判什么」，改判据即违反需求唯一验收依据。
- **改产品代码（`factory.js` / `main.js` 的默认 host）去迁就夹具** —— 属改产品代码、扩大回归面；D-3 影响面明确「不改产品代码与需求正文」。
- **每个夹具各预置一套 `dsh.json` 分散处理** —— 口径不统一，与 §3.3 总口径及 `code-loop-driver.mjs:494` 的 `mock` 注入不一致；`decisions.md` D-3 要求统一。

---

## 2. 模块划分与文件级接口契约

> 逐文件给出「新增 / 改 / 不改、导出签名、入参出参、由哪个 WP 负责」。共享大文件 `orchestrator.js` / `main.js` / `render.js` / `labels.js` / `instance-store.js` / `event-bus.js` 各指定**唯一负责 WP**，其它包只能通过本节签名契约调用、不许各自去改同一文件。标注「不改」的文件显式为**只读基线、不算任何 WP 的负责文件**（满足硬约束「文件零交集」自检）。所有新增 / 改文件不得出现 31 禁词与 `if host ==` / `switch (host)` 分支，新增中文只落 `src/cli/labels.js`。

### 2.1 `src/core/health.js`（新增，WP-3）

- **导出签名**：`export function computeHealth({ state, graph = null, traces = [], now = Date.now() } = {})` → `{ level, reasons }`。另导出 8 个原因码常量 `pending_escalation` / `node_timeout` / `session_crash` / `role_unavailable` / `connection_rejected` / `connection_expired` / `p90_exceeded` / `handoff_ttl_half`（固定顺序）与四档 `level` 取值 `normal` / `slow` / `attention` / `ended`。
- **入参 / 出参**：`state` 为实例快照（读 `nodes[]` / `sessions[]` / `handoffs[]` / `escalations[]` / `state` / `health.nodeTimeoutMs`）；`graph` 运行期图（本迭代可为 `null`，不读节点级 `timeout`）；`traces` 已结束跨度数组（P90 样本：升序第 `⌈0.9×N⌉` 条，N < 5 不触发）；`now` 可注入毫秒时间戳（缺省 `Date.now()`）。`reasons` 为按固定顺序的原因码数组。终态（`completed` / `failed` / `cancelled` / `interrupted`）优先直接返回 `ended`。
- **约束**：纯函数、不读盘、不取系统时间、不改任何入参；不接收 `roles`、不调用 `buildRoleInstances`；不写 `graph.json`、不触发状态迁移 / 升级 / 调度；零中文、零禁词；`health.nodeTimeoutMs` 缺省 30000 且回写时保留。`now` 注入的三组等值边界单测在 `test/wp12/health.test.js`。归 **WP-3 唯一所有**。

### 2.2 `src/core/trace.js`（新增，WP-1）

- **导出签名**：
  - `export function newTraceId()` → `TRC-` + 8 位小写十六进制（`node:crypto.randomBytes(4).toString('hex')`）。
  - `export function appendSpan(root, instanceId, span)` → 整行一次追加 `traces.jsonl`，返回 `{ ok, seq? }` 形状；`span` 为 7 字段对象。
  - `export function readTraces(root, instanceId)` → `{ spans, badLines }`（文件缺失按空、单行损坏跳过并计数、不因一行坏拒绝整份）。
  - `export function deriveHandoffIds(state, nodeId, round)` → 交接包编号数组（读取时按 `fromNodeId` / `toNodeId` + `round` 与 `round+1` 推导，按 `createdAt` 升序去重）。
  - `export function overlayRunningSpans(state, spans)` → 进行中跨度列表（按当前实例状态叠加，结束位 `—`、结果位「进行中」，不写盘）。
- **入参 / 出参**：`root` / `instanceId` 字符串；`span` 落 `trace_id` / `instance_id` / `node_id` / `round` / `start_time` / `end_time` / `status`（节点状态英文原值）7 字段；`handoff_ids` 是呈现字段、**不落盘**。追踪号同一实例不变、不同实例不同。路径经 `instanceTracesPath`（2.5 契约）。
- **约束**：只读 + 整行追加、不重写不批缓冲；未结束节点不写跨度；`handoff_ids` 不落盘为冻结值；零中文、零禁词、零 `if host ==`；不读完整日志正文。归 **WP-1 唯一所有**。

### 2.3 `src/core/event-bus.js`（改，WP-2）

- **改动段**：`:90-105` `emit` 内计算并附加 `prev_event_hash`（调 `store.readTailForChain` 同一次尾读，规范化 JSON 序列化后 SHA-256，首条 64 个 `0`）；`:110-122` `replay` 把 `store.readEvents` 已返回的 `badLines` 一并透出（返回值改 `{ events, badLines }` 或等价附带字段）。
- **入参 / 出参**：`emit(event)` 返回结构不变（仍 `{ ok:true, seq, ts }` / `{ ok:false, code:'STORE_WRITE_FAILED' }`）；`event.ts` 可选沿用（同刻复用）；`instanceId` 只作路由键、不落盘不广播。
- **约束**：**不改**「先落盘再广播」顺序（`:97-104`）、不改 `instanceId` 路由语义、不改 `subscribe`、不改 `emit` 返回结构（除附带字段）、不改单实例串行队列；`replay` 的坏行数与 `readEvents` 同源。归 **WP-2 唯一所有**。

### 2.4 `src/persistence/instance-store.js`（改，WP-2）

- **导出签名（新增）**：`readTailForChain(id)` → `{ seq, prevHash, corruptAll }`；`seq` 为下一条可用序号，整份不可解析时 `seq=1`、`prevHash` 为 64 个 `0`、`corruptAll=true`；末行截断则前溯最近一条可解析记录。`prevHash` 为该记录规范化序列化后的 SHA-256。
- **入参 / 出参**：`id` 实例号；单次文件尾读取同时得到序号与上一条指纹。
- **约束**：`:260-291` `appendEvent` / `doAppend` 的整行追加语义不动；`:380-399` `nextSeq`「末行坏则前溯」容错口径不动；`:293-315` `readEvents` 的 `{ ok, events, badLines }` 返回与坏行计数不动；不新增第二条序号来源。归 **WP-2 唯一所有**。

### 2.5 `src/persistence/paths.js`（改，WP-1）

- **导出签名（只追加）**：`export function instanceStateDir(root, id)` → 实例目录下 `state` 子目录的绝对路径（由 `instanceDir(root, id)` 拼 `state`）；`export function instanceTracesPath(root, id)` → 该 `state` 子目录下 `traces.jsonl` 的绝对路径。
- **入参 / 出参**：`root` / `id` 字符串，经既有 `instanceDir` + `node:path` 拼接；零 IO。
- **约束**：落点在 `corruptPath`（`:55-58`）之后、`instanceWorkspaceDir`（`:60-66`）之前，按函数名定位、不按固定行号；`statePath` / `eventsPath`（`:47-53`）**不改**；既有函数体一行不动；零中文、零禁词。U-9 既有布局偏差不改不迁移。归 **WP-1 唯一所有**。

### 2.6 `src/core/orchestrator.js`（改，WP-7）—— 唯一负责人，多个授权行段

- **授权行段与改动**：
  - `:444-454`（`saveState`）：保存前调 `computeHealth({ state, graph, traces, now })` 并写回 `state.health`（保留 `nodeTimeoutMs`）。
  - `:735`（`newState`）：只追加 `health: { nodeTimeoutMs: 30000 }` 一个字段，其余初始字段与顺序不动；已存在实例读取时缺该字段按缺省 30000 处理（不批量回填）。
  - `:1183-1230`（`handleUpdate`）：**本迭代唯一被授权做摘要提取的段落**，只把四项读入会话级待写摘要缓存；不改 `pendingEvents` 会话状态迁移判定 / `session.state` / `stateSince` / `applyHandoff` / `enqueue` 时序、不在此新增 `emit`；帧名按 `tool_call` / `tool_call_update` 取原始帧（`tool_call_update` 分类分支在 `session-state.js:153`，不改）。
  - `:1595-1615`（节点开始）、`:2120-2230` / `:2530-2575` / `:2660-2810` / `:3240-3250`（节点收尾）：只追加「结束本轮跨度」的调用（`trace.appendSpan`），**不在节点收尾段写摘要**；不改既有迁移、时间戳与事件顺序；跨度写入早于 `maybeStopAfter`（`:3141`）与 `advance()`（`:3157`）。
  - 摘要写入固定 `quiesceSession`（`:1282` 起，含 `:1294`）/ `idleSession`（`:1311` 起，含 `:1323`）/ `applyCancel`（`:3807` 起，含 `:3846-3854` 的 `run.cancelled`、`:3843` 置空 `toolName`、`:3852` 的 `reason`）三函数，调用**同一个共享辅助函数**落 `execution.summary`，不新增第四个入口、不额外开事件通道、每会话只写一次。
  - `:4036`（`getStatus`）：读取时按真实 `now` 重算健康度；`state.health` 缺 `level`（首次）则补写并刷新 `status.md`、不追加事件；档位变化走一次窄 CAS 写入（与 `saveState` 同路径）并追加 `health.changed`；档位未变不写。只允许在返回快照前做这一步，不改 `getStatus` 既有返回结构与只读语义（除健康度字段与上述一次受控写入）。
- **入参 / 出参**：`computeHealth` 的 `now` 由 `getStatus` / `saveState` 传入真实 `Date.now()`；`health.changed` 事件形状见 §3.4；`execution.summary` 事件形状见 §3.4。
- **约束**：状态迁移唯一入口 `transit()` + `save(expectedState)` CAS，不直接 `store.save`；健康度读取时重算只允许上述一次窄 CAS；事件 `ts` 复用状态变更同一时刻；`emit` 先落盘再广播。**12 处会话状态事件发射点不改写 / 不删除 / 不新增**（保留 4 `:1004`/`:1046`/`:1102`/`:1133`；冻结 7 `:1203`/`:1294`/`:1323`/`:2085`/`:2306`/`:2325`/`:4889`；复用 1 `:3847` `run.cancelled`），仍在发射；`grep -c "object: 'session'"` ≤ **13**；会话级新增事件类型只允许 `execution.summary` 一种。归 **WP-7 唯一所有**。

### 2.7 `src/core/status-text.js`（改，WP-6）

- **改动段**：`:310-342` `renderStatusDoc` 只在 `- 状态：…`（`:319`）之后插入一行健康度（A-7：`- 健康度：需关注 · 有待处理升级`）；`CORE_TEXT.doc` 只追加 `health` 字段名，镜像 `labels.js` 的键。
- **入参 / 出参**：`renderStatusDoc(state, graph, options)` 签名不变；健康度行读 `state.health.level` / `state.health.reasons`，经 `CORE_TEXT.doc.health` 与 `HEALTH_REASON_*` 渲染。
- **约束**：既有段名、字段顺序、空值处理不动；`single` 不输出 `## 节点` 段（`:310-320` 仅 `multi` 输出）不变；零中文硬编码、零禁词。归 **WP-6 唯一所有**（与 `status-doc.test.js` 同包）。

### 2.8 `src/cli/labels.js`（改，WP-4）

- **导出签名（只追加键）**：`HEALTH_LABEL` / `HEALTH_LINE` / `HEALTH_REASON_*`（8 码 → 中文原因映射）/ `TRACE_*`（追踪头、跨度行、回流链、`TRACE_EMPTY` / `TRACE_NO_BACKFLOW` / `INSTANCE_MISSING` / `TRACE_RUNNING` / `TRACE_NO_END` / `TRACE_DEGRADED`）/ `SUMMARY_*` / `SUMMARY_LOG_LINE` / `EVENTS_SKIPPED` / `LAYER.health = '健康度'`；`STATE_LABEL.health` 指向同一张表（在 `render.js` 侧引用）。
- **入参 / 出参**：均为 `Object.freeze` 常量 / 模板字符串，由 `render.js` / `status-text.js` 经占位替换读取。
- **约束**：**只在文件末尾追加**；`USAGE_LINES`（`:183-208`）25 行与既有键零改动；所有新增中文只在此文件（D-6、A-9）。归 **WP-4 唯一所有**。

### 2.9 `src/cli/render.js`（改，WP-6）

- **导出签名（只新增 5 个纯函数）**：`renderHealthLine(snapshot, now)` / `renderTraceShow(payload)` / `renderSummaryLogLine(event)` / `renderHealthEventLine(event)` / `renderEventsSkippedLine(badLines)`。
- **改动段**：`renderEventLines`（`:988`）**只允许在函数开头**加一个按 `event.reason` 的分派分支（`execution.summary` → `renderSummaryLogLine`，`health.changed` → `renderHealthEventLine`）；`STATE_LABEL`（`:61`）追加 `health` 指向 `labels.js` 表。其余事件仍走原逻辑。
- **入参 / 出参**：`renderTraceShow` 消费 `trace.readTraces` + `deriveHandoffIds` + `overlayRunningSpans` 的结果（§2.2 契约），节点列按 `graphNode.title ?? nodeId`、回流链「第 N 轮」取回流交接包的 `round`；不写状态、不追加事件。`renderSummaryLogLine` 覆盖 A-12（四项取值与 A-4 一致、缺项"未提供"）与 A-14（取消复用同一行模板）；`renderHealthEventLine` 覆盖 A-8 文本行（中文档位 + 中文原因）；`renderEventsSkippedLine` 覆盖 A-13。
- **约束**：`renderGraphJson` / `renderGraphText` / `renderNodeLines` / `renderEventLines` 既有行格式与相对顺序不动；零中文硬编码；逐字基线 A-1~A-14 由 `test/wp9/i19-render.test.js` 锁定。归 **WP-6 唯一所有**。

### 2.10 `src/cli/main.js`（改，WP-8）—— 唯一负责人

- **改动段**：`:194-206`（命令表：`RUNTIME_COMMANDS` 加 `trace`、`RUNTIME_SUBS` 加 `trace: ['show']`）、`:543-561`（`runtimePositionalRule` 加 `case 'trace'`）、`:571`（`RUNTIME_COMMAND_WORDS` 加 `trace`）、`:628-634`（分发加 `trace` 分支）、`:1167-1230`（实例命令区追加 `trace show` handler，只读、调 `instance.trace`）。
- **`statusCommand`（`:999-1070`，约 `:1062-1065`）**：只在 `renderInstanceLine` / `renderInterruptedNote` 之后**插入一行** `renderHealthLine(snapshot, ctx.now())`；既有节点行 / 会话行 / 交接行 / 等待行文字与相对顺序不变（BR-18）。
- **`instance log` 分支（`:1191-1211`）**：在 `for (const event of list)` 循环内只对 `reason === 'execution.summary'` / `reason === 'health.changed'` 委托 `renderSummaryLogLine` / `renderHealthEventLine`，其余事件仍调 `renderEventLines`；循环结束后若 `eventsRes.result.badLines > 0` 追加 `renderEventsSkippedLine(badLines)`；不改其他事件渲染与顺序，不改按 `seq` 升序排序。
- **约束**：除上述三处外不改任何分支；`run` / `cancel` / `graph` 路径不动；`USAGE_LINES` 25 行不动（`trace` 用法走参数错误路径）。归 **WP-8 唯一所有**。

### 2.11 `src/daemon/server.js`（改，WP-8）

- **改动段**：`:201-233` 只追加只读 `instance.trace` 方法（调 `trace.readTraces` + `overlayRunningSpans`，返回 `{ traceId, spans, badLines }`，不写状态）；`instance.events`（`:225-232`）的返回里带上 `badLines`（与 `events` 同源，来自 `replay` 透出）。
- **入参 / 出参**：`instance.trace` 位置参数实例号；`instance.events` 既有返回结构附加 `badLines`。
- **约束**：既有方法表、错误映射、`instance.get` 返回结构不动；`instance.trace` 只读。归 **WP-8 唯一所有**。

### 2.12 `src/adapter/session-state.js`（不改 · 只读基线，不算负责文件）

- **明确标注：本迭代不改**。`:146-160` 只做状态与工具名归一化，`tool_call_update` 分类分支在 `:153`；摘要提取不在此处。若实现侧为取值方便需要读 `update` 原始帧，改在 `src/core/orchestrator.js` 侧做（D-4 L978、D-7 L1023、v3 F-04）。**不列入任何 WP 的负责文件清单**。

### 2.13 `src/registry/role-instances.js`（不改 · 只读基线，不算负责文件）

- **明确标注：本迭代不改**。`buildRoleInstances`（`:123`）的投影需要注册表才能区分 `unknown-role`；核心侧无注册表，`computeHealth` 不调用它（D-3 L963、v7 F-10）。**不列入任何 WP 的负责文件清单**。

### 2.14 测试文件契约（新增 / 改 / 不改，逐文件标归属）

| 文件 | 状态 | 内容 | 归属 WP |
|---|---|---|---|
| `test/wp12/health.test.js` | 新增（D-8） | `computeHealth({ state, now })` 三组等值边界：节点超时 30000/30001、P90 50000/50001、TTL 900000/900001/899999 注入固定 `now` | WP-3 |
| `test/wp9/i19-trace.test.js` | 新增 | `instanceTracesPath` 形状、`newTraceId` 形态、`readTraces` 坏行跳过计数、`deriveHandoffIds` 含 `HO-002`（`round=2` 回流）不漏 | WP-1 |
| `test/wp9/i19-chain.test.js` | 新增 | 规范化哈希逐条比对、64 个 `0` 固定起点、旧记录不回填、末行截断前溯、整份损坏重起链、`badLines` 透出 | WP-2 |
| `test/wp9/i19-labels.test.js` | 新增 | 新增键存在且文案非空、既有键不变、`USAGE_LINES` 仍 25 行、前 8 行逐字不变 | WP-4 |
| `test/wp9/i19-fixture.test.js` | 新增 | `--fail-tool` / `--fail-tool-no-refs` 两个默认关闭开关、既有 12 开关与三条场景套件行为逐字不变 | WP-5 |
| `test/wp9/i19-render.test.js` | 新增 | 5 个纯函数逐字覆盖附录 A-1~A-14 全部输出基线（含缺项"未提供"、取消四项全"未提供"、A-8 中文档位原因） | WP-6 |
| `test/wp11/status-doc.test.js` | 改（D-8 `:68-130`） | 两处整份期望文本在 `- 状态：运行中` 后插 `- 健康度：正常`；`:179-251` 用例不动 | WP-6 |
| `test/wp9/i19-orchestrator.test.js` | 新增 | `saveState` 写回 `health`、`getStatus` 重算 + 一次窄 CAS + `health.changed`、摘要每会话一条、冻结窗口 3 条跨度、`grep -c ≤ 13` | WP-7 |
| `test/wp9/i19-cli.test.js` | 新增 | `trace show` 三空形态 / 只读 / 退出码 0/0/1、`instance status` 健康度行、`instance log` 两种 reason 分派 + 跳过行 | WP-8 |
| `test/wp9/cli-e2e.test.js` | 改（D-8 `:135-180`） | 若存在 `instance status` 整份输出断言，只插健康度行；超时 / 状态词 / 会话行断言不动 | WP-8 |
| `test/wp9/i19-regression.test.js` | 新增 | 三主链逐字、`status` 删健康度行后逐字、`graph` 字节比对、失败集合差集 = 0、条数只增不减、purity 31 词、deps = 0 | WP-9 |
| `test/wp11/labels-sync.test.js` | **不改**（只读基线） | `:22-29` 映射表不动；新增健康度文案不并入六张状态表 | 不算负责文件 |
| `test/wp12/cli-assets.test.js` | **不改**（只读基线） | `:119-132` 不动；`USAGE_LINES` 仍 25 行且前 8 行逐字不变 | 不算负责文件 |
| `test/wp11/purity.test.js` | **不改**（只读基线） | 31 词表不动；新增 `src/core/health.js` / `trace.js` 必须被同一扫描覆盖 | 不算负责文件 |
| `test/fixtures/mock-acp-agent.js` | 改（D-4） | 增加默认关闭的 `--fail-tool`（上报四项）与独立变体 `--fail-tool-no-refs`（只报命令 / 退出码）；既有 12 开关与三条场景套件行为逐字不变 | WP-5 |
| `test/fixtures/code-loop-driver.mjs` | **不改**（只读基线） | 已由 `:494` 内部注入 `--host mock`、`:450-451` 写 `mock.json`；`--stop-after 3` / `--keep` 既有接缝不动 | 不算负责文件 |
| `test/fixtures/task-loop-driver.mjs` | **不改**（只读基线） | 已由 `:253` 内部注入 `--host HOST_ID`（`HOST_ID='dsh'`、写 `dsh.json`），属 D-3「driver 内部注入」豁免；`dispatch-fail-first` 场景不动 | 不算负责文件 |
| `test/fixtures/purity-check.mjs` | **不改**（只读工具） | 31 词 `--forbid` 扫描工具，逐字传 D-6 全表 | 不算负责文件 |
| `docs/iterations/iteration-7/baseline-failures.txt` | **不改**（只读基线） | 8 行既有失败集合，差集判定基准 | 不算负责文件 |

> 通则（D-8）：新增用例一律放本迭代新增测试文件，覆盖附录 A 全部输出基线与附录 B 两个口径；**不得删除既有断言或放宽 `Then` 让覆盖表变绿**。`test/wp12/health.test.js` 专覆盖等值边界。

---

## 3. 数据模型

> **唯一事实来源**：① 事件链 `instances/INST-001/events.jsonl`（只追加，新增 `prev_event_hash`）；② 实例快照 `instances/INST-001/state.json`（顶层 `health`）；③ 追踪跨度 `instances/INST-001/state/traces.jsonl`（7 字段，`handoff_ids` 是 `orch trace show` 读取时推导的呈现字段、**不落盘**）；④ `workspace/status.md`（健康度行）。完整执行日志留宿主，核心只存摘要与引用、不复制正文、不读取正文。以下均给完整样例，含异常态。字段名统一：跨度用 `start_time` / `end_time`，实例快照同一时刻用 `startedAt` / `endedAt`（B-1，全文不出现第三种写法）。

> **示意值与逐字口径（统一说明，适用 §3.1~§3.4 全部 JSON / 文本样例）**：本节为**数据模型形状**说明，样例中下列字段的具体取值均为**示意值**——哈希值（`prev_event_hash` 的具体 64 位十六进制串，事件总线写入时按 D-1 链计算生成）、追踪号（`trace_id`，实例创建时随机生成的 `TRC-` + 8 位小写十六进制）、各类时间戳与时刻（`ts` / `createdAt` / `updatedAt` / `computedAt` / `start_time` / `end_time` / `startedAt` / `endedAt` / `pendingAt`，夹具按真实时刻回填）、`seq`（事件序号）、实例号 / 会话号（`mock-sess-` 前缀加进程号与序号，由 mock 实时生成）/ 节点号与标题（`T-001` / `T-002` 等）、交接包编号（`HO-001` 等）、`coreGeneration` / `schemaVersion`、摘要四项取值、跨度时长 / P90 / TTL 数值、跳过行数 `N`、`detail.reasons` 原因码数组。**示意值只说明字段形状、取值类型与相对顺序，不作为断言期望**；实际值由 D-1 链计算与夹具按附录 A-0「可变值约定」替换。用户可见的**逐字输出**以需求附录 A-1~A-14 为准，按 A-0 界定：断言前先把「随夹具变」项替换为夹具实际值，再与附录 A 逐字比较；A-0「逐字固定」项（全部中文文案与层名、四档词、结果位、结束位 `—`、分隔符 ` · `、单位 `条` / `次` / `行`、字段名与顺序，以及 A-1~A-14 中固定为 `INST-001` / `INST-999` 的实例号、节点列规则与交接编号递增规则）不随样例取值改变。本说明只统一 §3 样例读法，不新增、不改写、不放宽任何附录 A 逐字基线，也不改变数据模型字段名与结构。

### 3.1 `events.jsonl`（正常链 + 固定起点 + 坏行 / 整份损坏样例）

正常链（首条 `prev_event_hash` 为 64 个 `0`；后续每条等于上一条记录的规范化 SHA-256）：

```json
{"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"state.change","seq":1,"ts":"2026-11-10T10:00:00.000Z","prev_event_hash":"0000000000000000000000000000000000000000000000000000000000000000"}
{"object":"session","objectId":"mock-sess-12345-1","from":"idle","to":"tool_running","result":"applied","reason":"session.state","detail":{"event":"tool_call"},"seq":2,"ts":"2026-11-10T10:00:01.000Z","prev_event_hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
{"object":"node","objectId":"T-001","from":"running","to":"done","result":"applied","reason":"state.change","seq":3,"ts":"2026-11-10T10:02:10.000Z","prev_event_hash":"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"}
```

> `prev_event_hash` 是对**前一条完整记录**做规范化序列化（递归键排序 / UTF-8 / 无空白）后的 SHA-256；`seq` 与上一条指纹来自同一次文件尾读（D-1 L942）。

**坏行样例（末行被强杀截断，AC-21）**：前两条可读，末行是半行；`readEvents` 返回 `badLines=1`，`readTailForChain` 前溯到第 2 条可解析记录续链（新记录 `seq` 从 3 继续、不回 1），文本视图末尾单独成行 `已跳过 1 行不可读记录`（A-13），退出码 0。

```text
{"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"state.change","seq":1,"ts":"2026-11-10T10:00:00.000Z","prev_event_hash":"0000000000000000000000000000000000000000000000000000000000000000"}
{"object":"node","objectId":"T-001","from":"running","to":"done","result":"applied","reason":"state.change","seq":2,"ts":"2026-11-10T10:02:10.000Z","prev_event_hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
{"object":"node","objectId":"T-002","to":
```

**整份损坏样例（AC-25，3 行不含任何 JSON 结构的乱码文本）**：原 3 行一行不删 / 不改写 / 不改名、原样保留在原位；`badLines=3`；新记录仍追加在文件末尾，从 `seq=1` 重新起链、首条 `prev_event_hash` 为 64 个 `0`、逐条递增不重号（不可读行不贡献任何可读序号）；文本视图末尾 `已跳过 3 行不可读记录`；两条命令均以成功退出码结束、不弹堆栈、不报「校验失败 / 链已断」。

```text
不是一个 JSON 记录
%%%% 乱码 %%%%
坏行三
```

### 3.2 `state.json`（顶层 `health`，含正常 / 初始 / 异常态）

正常态（运行中、命中一条待处理升级；`health` 四字段齐全）：

```json
{
  "schemaVersion": 2,
  "instanceId": "INST-001",
  "coreGeneration": 7,
  "createdAt": "2026-11-10T10:00:00.000Z",
  "updatedAt": "2026-11-10T10:05:00.000Z",
  "state": "running",
  "template": "code-loop",
  "nodes": [
    { "nodeId": "T-001", "roleId": "developer", "round": 1, "state": "done", "startedAt": "2026-11-10T10:00:00.000Z", "endedAt": "2026-11-10T10:02:10.000Z" },
    { "nodeId": "T-002", "roleId": "tester", "round": 0, "state": "pending" }
  ],
  "sessions": [],
  "handoffs": [],
  "escalations": [ { "escalationId": "ESC-001", "nodeId": "T-002", "state": "pending" } ],
  "health": {
    "level": "attention",
    "reasons": ["pending_escalation"],
    "computedAt": "2026-11-10T10:05:00.000Z",
    "nodeTimeoutMs": 30000
  }
}
```

**`newState` 初始态（D-7 `:735`）**：只追加 `health: { nodeTimeoutMs: 30000 }`，**无 `level` / `reasons` / `computedAt`**；首次读取（`getStatus`）补写 `health` 并刷新 `status.md`，按 BR-15 **不追加** `health.changed`。

```json
"health": { "nodeTimeoutMs": 30000 }
```

**异常态（逐条给降级口径）**：
- `health` 缺 `nodeTimeoutMs`（历史快照）：按缺省 `30000` 处理，不批量回填历史快照；回写 `health` 时保留该字段、不得被计算结果覆盖。
- `health` 缺 `level`（首次计算前）：补写 `level` / `reasons` / `computedAt`，不追加事件。
- 追踪文件缺失 / 单行损坏 / 跨度缺 `start_time` / `end_time`：健康度按「该条件不成立」处理，不崩溃、不误报；`notime` 跨度不计入 P90 样本（AC-23）。
- 终态（`completed` / `failed` / `cancelled` / `interrupted`）：`computeHealth` 直接返回 `level: "ended"`，`reasons: []`，历史红条件不再覆盖终态（AC-12 / BR-13）。
- `AC-14` / `AC-15` / `AC-16` 的快照显式写 `health.nodeTimeoutMs = 300000`，使 70s / 50s 运行时长不先命中 30s 红档；`AC-13` 超时夹具写 `30000` + `startedAt = now - 31000`。

### 3.3 `traces.jsonl`（7 字段 + `trace_id` 形如 `TRC-` + 8 位小写十六进制）

`--scenario backflow-once --stop-after 3` 冻结窗口的 3 条已落地跨度（`handoff_ids` 不落盘，由 `deriveHandoffIds` 读取时推导为 `[HO-001]` / `[HO-001, HO-002]` / `[HO-002]`）：

```json
{"trace_id":"TRC-1a2b3c4d","instance_id":"INST-001","node_id":"T-001","round":1,"start_time":"2026-11-10T10:00:00.000Z","end_time":"2026-11-10T10:00:40.000Z","status":"done"}
{"trace_id":"TRC-1a2b3c4d","instance_id":"INST-001","node_id":"T-002","round":1,"start_time":"2026-11-10T10:00:40.000Z","end_time":"2026-11-10T10:01:30.000Z","status":"failed"}
{"trace_id":"TRC-1a2b3c4d","instance_id":"INST-001","node_id":"T-001","round":2,"start_time":"2026-11-10T10:01:30.000Z","end_time":"2026-11-10T10:02:20.000Z","status":"done"}
```

> 7 字段固定：`trace_id` / `instance_id` / `node_id` / `round` / `start_time` / `end_time` / `status`（节点状态英文原值）。同一实例共用同一 `trace_id`、不同实例不同。进行中的节点不写跨度，由 `orch trace show` 叠加显示「进行中」、结束位 `—`（A-10）。整行一次追加、不重写、不批量缓冲；读取时坏行跳过并计数。

### 3.4 两类新增事件的完整 JSON 样例

**`execution.summary`（AC-04 失败摘要，四项齐全）**：

```json
{
  "object": "session",
  "objectId": "mock-sess-12345-1",
  "result": "note",
  "reason": "execution.summary",
  "detail": {
    "nodeId": "T-001",
    "round": 1,
    "summary": { "command": "node out/run.js", "exitCode": 1, "keyOutputLines": 3, "logRef": "host-logs/T-001.log" }
  },
  "seq": 8,
  "ts": "2026-11-10T10:02:10.000Z",
  "prev_event_hash": "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881"
}
```

**`execution.summary`（AC-05 缺项：宿主只给命令与退出码，缺项存 `null` 渲染"未提供"）**：

```json
{
  "object": "session",
  "objectId": "mock-sess-12345-1",
  "result": "note",
  "reason": "execution.summary",
  "detail": {
    "nodeId": "T-001",
    "round": 1,
    "summary": { "command": "node out/run.js", "exitCode": 1, "keyOutputLines": null, "logRef": null }
  },
  "seq": 8,
  "ts": "2026-11-10T10:02:10.000Z",
  "prev_event_hash": "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881"
}
```

对应 A-4 / A-12 渲染：`失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 未提供 · 日志 未提供`（缺项位置替换为"未提供"，其余项不省略）。

**`execution.summary`（AC-26 取消收尾，四项全 `null`、一律"未提供"）**：

```json
{
  "object": "session",
  "objectId": "mock-sess-12345-1",
  "result": "note",
  "reason": "execution.summary",
  "detail": {
    "nodeId": "T-001",
    "round": 1,
    "summary": { "command": null, "exitCode": null, "keyOutputLines": null, "logRef": null }
  },
  "seq": 9,
  "ts": "2026-11-10T10:03:00.000Z",
  "prev_event_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

对应 A-14 渲染：`10:03:00  会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供`。取消走 `cancelLive` live 分支，不把 `tool_call.title`（mock 为 `write`）当命令、不猜值、不省略；`applyCancel` 落盘前把 `session.toolName` 置空。

**`health.changed`（AC-16 / A-8，正常 → 需关注）**：

```json
{
  "object": "health",
  "objectId": "INST-001",
  "from": "normal",
  "to": "attention",
  "result": "applied",
  "reason": "health.changed",
  "detail": { "reasons": ["pending_escalation"] },
  "seq": 12,
  "ts": "2026-11-10T10:00:00.000Z",
  "prev_event_hash": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
}
```

同一事件在 `orch instance log` 文本视图的基行（用户可见判据）：`10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级`。**中文原因是用户可见判据，码值只在 JSON 机读层**，两层由 `HEALTH_REASON_*` 同一张映射表一一对应、互不替代；档位未变不追加同类事件、首次写入不算变化（BR-15）。

---

## 4. 工作包拆分

> 9 个 WP 按**能力**切（不按目录切）；每个 WP 固定五字段（负责文件含件数 / 依赖 / 交付 / 验收口径 / 可否并行）。同一文件只属一个 WP；共享大文件 `orchestrator.js`（WP-7）/ `main.js`（WP-8）/ `render.js`（WP-6）/ `labels.js`（WP-4）/ `instance-store.js`（WP-2）/ `event-bus.js`（WP-2）各指定**唯一负责 WP**，其它包通过 §2 签名契约调用、不许各自去改。依赖成 DAG；每包自带契约测试，缺字段按契约兼容缺省。**所有 AC 的「验收口径」= 需求 v7 §3.1 同号 Then 逐字口径，本文档只登记 AC 编号、测试文件与逐字断言锚点，不复制、不改写、不合并、不放宽任何 Then。**

### WP-1 路径与追踪落盘基座（依赖：无）

- **负责文件（3）**：`src/persistence/paths.js`、`src/core/trace.js`、`test/wp9/i19-trace.test.js`
- **依赖**：无（纯路径函数 + 追踪模块，契约先冻结后最先开工，DAG 叶子）
- **交付**：`instanceStateDir` / `instanceTracesPath` 两导出（既有函数体零改动）；`newTraceId`（`TRC-` + 8 位小写十六进制）/ `appendSpan`（7 字段整行一次追加，节点收尾时写、早于停点与 `advance()`）/ `readTraces`（坏行跳过并计数）/ `deriveHandoffIds`（读取时按 `fromNodeId` / `toNodeId` + `round` 与 `round+1` 推导，接收包 `round === r`、产出包正向 `round === r` / 回流 `round === r+1`，按 `createdAt` 升序去重）/ `overlayRunningSpans`（进行中叠加、不写盘）；`handoff_ids` 不落盘。
- **验收口径**：主责 **AC-06**（追踪号 / 起止 / 结果 / 交接包齐全、`traces.jsonl` 落 `state/`）、**AC-07**（回流链按轮次、`HO-002 round=2` 不漏、`HO-003` 的 `retest` 不计入回流）、**AC-22**（进行中跨度叠加、结束位 `—`、不显示"暂无追踪记录"）、**AC-23**（文件缺失 / 单行损坏 / 缺时间字段降级且可见、跳过行数提示）；协作 AC-08（跨度数据 + `handoff_ids` 推导）、AC-09（空形态数据）、AC-10（只读 `readTraces` 不写盘）、AC-14（P90 样本来源）、AC-27（跨度按轮追加不覆盖）。契约测试 `i19-trace.test.js`：断言 `instanceTracesPath` 恰为 `instances/INST-001/state/traces.jsonl`、`newTraceId` 匹配 `TRC-[0-9a-f]{8}`、坏行计数、`deriveHandoffIds` 冻结窗口 3 条依次为 `[HO-001]` / `[HO-001, HO-002]` / `[HO-002]`、既有 `statePath` / `eventsPath` 输出逐字不变。逐条按需求同号 Then 判定
- **可否并行**：可 —— 零中文、零禁词、零宿主依赖，只消费冻结的 7 字段跨度契约，是 DAG 叶子

### WP-2 存储尾读与审计链（依赖：无，须先冻结哈希规范化与尾读返回形状）

- **负责文件（3）**：`src/persistence/instance-store.js`、`src/core/event-bus.js`、`test/wp9/i19-chain.test.js`
- **依赖**：无（叶子；但须先冻结「规范化序列化 + 同一次尾读返回 `{ seq, prevHash, corruptAll }`」契约，见 §6 契约先冻结点 ①）
- **交付**：`readTailForChain(id)` → `{ seq, prevHash, corruptAll }`（同一次尾读；整份不可解析 `seq=1` / 64 个 `0`；末行截断前溯）；`emit` 内附加 `prev_event_hash`（规范化 JSON SHA-256、首条 64 个 `0`）；`replay` 透出 `readEvents` 已返回的 `badLines`；`doAppend` 整行追加 / `nextSeq` 容错 / `readEvents` 坏行计数 / 「先落盘再广播」顺序 / `subscribe` 全部不动。
- **验收口径**：主责 **AC-01**（只追加、旧行字节哈希不变、`seq` 严格递增无空洞、条数只增不减）、**AC-02**（断点 0、两实例链起点相同后续不同）、**AC-21**（旧记录无标记不回填、末行截断前溯、`seq` 从 4、`badLines=1`、退出码 0）、**AC-25**（整份损坏从 `seq=1` 重起链、首条 64 个 `0`、旧 3 行原样保留、跳过 3 行、退出码 0）；协作 AC-03（链不破坏三主链输出）、AC-16（`health.changed` 接链尾、档位未变不追加）、AC-24（摘要事件接链）。契约测试 `i19-chain.test.js`：规范化序列化 SHA-256 逐条比对、固定起点、旧记录字节运行前后一致、`corruptAll` 分支、`badLines` 透出与读取层同源。逐条按需求同号 Then 判定
- **可否并行**：可 —— 与 WP-1 无共享文件，用内存 / 临时文件独立跑；不改任何既有函数体

### WP-3 健康度纯函数（依赖：无，签名须最先冻结）

- **负责文件（2）**：`src/core/health.js`、`test/wp12/health.test.js`
- **依赖**：无（叶子；`computeHealth({ state, graph, traces, now })` 签名是 §6 契约先冻结点 ②，冻住后 WP-6 / WP-7 才可开发）
- **交付**：纯函数 `computeHealth` → `{ level, reasons }`（不读盘、不取系统时间、`now` 可注入）；四档 `normal` / `slow` / `attention` / `ended`；8 个原因码固定顺序；终态优先；P90 最近秩法（升序第 `⌈0.9×N⌉` 条、N 小于 5 不触发）；TTL 30 分钟、`pendingAt` 优先 / `createdAt` 兜底 / 两者都无不参与、严格大于 900000ms；节点超时判定为 `now − startedAt` 严格大于 `health.nodeTimeoutMs`（缺省 30000）；角色由 `state.nodes[].roleId` + `state.sessions` 投影、不调 `buildRoleInstances`。
- **验收口径**：主责 **AC-11**（无异常 → 正常）、**AC-12**（终态优先、不回升）、**AC-13**（五类红条件矩阵 + `health.test.js` 节点超时等值 30000/30001）、**AC-14**（P90 样本 / 阈值 / 最小样本 + 等值 50000/50001，快照 `nodeTimeoutMs=300000`）、**AC-15**（TTL 50% + 等值 900000/900001/899999）；协作 AC-16（档位变化判定）、AC-17（档位与原因写回）、AC-18（纯函数只读、不调状态迁移 / 升级，主责 WP-7）、AC-23（`notime` 跨度不计入 P90 样本、档位不为"慢"）。契约测试 `health.test.js`：注入固定 `now` 断言「恰好等于不命中 / 超出 1ms 命中」三组等值边界，覆盖四档与 8 码固定顺序。逐条按需求同号 Then 判定
- **可否并行**：可 —— 纯内存函数，零 IO、零中文、零禁词，是 DAG 叶子

### WP-4 文案键底座（依赖：无，键名须先冻结）

- **负责文件（2）**：`src/cli/labels.js`、`test/wp9/i19-labels.test.js`
- **依赖**：无（叶子；新增键名与中文文案是 §6 契约先冻结点 ④，冻住后 WP-6 / WP-8 才可开发）
- **交付**：文件末尾追加 `HEALTH_LABEL` / `HEALTH_LINE` / `HEALTH_REASON_*`（8 码 → 中文原因）/ `TRACE_*`（含 `TRACE_EMPTY` / `TRACE_NO_BACKFLOW` / `INSTANCE_MISSING` / `TRACE_RUNNING` / `TRACE_NO_END` / `TRACE_DEGRADED`）/ `SUMMARY_*` / `SUMMARY_LOG_LINE` / `EVENTS_SKIPPED` / `LAYER.health = '健康度'`；`USAGE_LINES`（`:183-208`）25 行与既有键零改动。
- **验收口径**：协作 **AC-09**（三种空形态文案）、**AC-11~AC-17**（四档词与原因句 A-6 / A-6 附 / A-7 / A-8）、**AC-20**（中文唯一来源 `labels.js`、`labels-sync` 用例如期通过）、**AC-21/25**（`EVENTS_SKIPPED` 措辞与追踪侧 A-11 不混用）、**AC-26**（A-14 四项全"未提供"同一行模板）。契约测试 `i19-labels.test.js`：新增键存在且文案非空、既有键计数与内容逐字不变、`USAGE_LINES.length === 25` 且前 8 行逐字不变。逐条按需求同号 Then 判定
- **可否并行**：可 —— 纯常量表，与 WP-1/2/3 无共享文件

### WP-5 宿主夹具与失败摘要开关（依赖：无）

- **负责文件（2）**：`test/fixtures/mock-acp-agent.js`、`test/wp9/i19-fixture.test.js`
- **依赖**：无（叶子；开关名 `--fail-tool` / `--fail-tool-no-refs` 由 D-4 L979 钉死）
- **交付**：`mock-acp-agent.js` 增加默认关闭的失败工具步骤 `--fail-tool`（上报命令 `node out/run.js` / 退出码 1 / 输出 3 行 / 日志引用 `host-logs/T-001.log`）；独立缺项变体 `--fail-tool-no-refs`（只上报命令与退出码）；既有 12 个开关与三条场景套件（`single` / `code-loop` / `task-loop`）行为逐字不变；夹具命令行 / `probe/acc9-*` 一律带 `--host mock` 并预置 `mock.json`（§1.6、D-3）。
- **验收口径**：协作 **AC-04**（`--fail-tool` 四项齐全）、**AC-05**（`--fail-tool-no-refs` 缺项降级、实例目录无完整日志副本）、**AC-24**（失败节点 + 遗留逐条会话记录夹具）、**AC-26**（`--turn-delay-ms 30000` 构造 `tool_running` 运行中窗口供第二进程取消）。契约测试 `i19-fixture.test.js`：两开关默认关闭、上报字段形状、既有 12 开关与三条场景套件输出逐字不变。逐条按需求同号 Then 判定
- **可否并行**：可 —— 只改夹具文件，不碰 `src/**`，是 DAG 叶子

### WP-6 健康度与追踪渲染纯函数（依赖：WP-1 + WP-3 + WP-4）

- **负责文件（4）**：`src/cli/render.js`、`src/core/status-text.js`、`test/wp9/i19-render.test.js`、`test/wp11/status-doc.test.js`
- **依赖**：WP-1（7 字段跨度 / `deriveHandoffIds` / 进行中叠加契约）、WP-3（冻结的 `health` 形状）、WP-4（冻结的文案键名）
- **交付**：`render.js` 新增 5 个纯函数（`renderHealthLine` / `renderTraceShow` / `renderSummaryLogLine` / `renderHealthEventLine` / `renderEventsSkippedLine`）+ `renderEventLines` 开头一个按 `event.reason` 分派分支 + `STATE_LABEL.health`；`status-text.js` 只在 `- 状态：…` 后插一行健康度、`CORE_TEXT.doc.health` 镜像 `labels.js`；`status-doc.test.js` 按 D-8 只在两处整份期望文本插 `- 健康度：正常`（`:179-251` 用例不动）。既有事件行格式 / 相对顺序 / `renderGraphJson` / `renderGraphText` / `renderNodeLines` 全部不动。
- **验收口径**：主责 **AC-08**（`renderTraceShow` 与 A-3 逐字一致：`跨度 3 条 · 回流 1 次`、3 条跨角色跨度、无进行中行、`第 2 轮 T-002 测试 → T-001 开发 HO-002 已完成`）；协作 AC-04（A-4 失败摘要行 + A-12 日志摘要行）、AC-05（缺项"未提供"渲染）、AC-06/07/22（跨度行 / 回流链 / 进行中 A-10）、AC-09（A-1 / A-2 / A-5 三种空形态文案逐字，主责 WP-8）、AC-11~17（A-6 四档 / A-6 附 8 行原因句 / A-7 `status.md` / A-8 文本行）、AC-19（既有状态输出不回归、健康度只新增一行、`graph` 不含健康度字段，主责 WP-9）、AC-21/25（A-13 跳过行提示）、AC-23（A-11 追踪坏行提示）、AC-24（A-12 摘要行）、AC-26（A-14 四项全"未提供"）、AC-27（A-12 行数判据）。契约测试 `test/wp9/i19-render.test.js`：逐字覆盖附录 A-1~A-14 全部 15 节用户可见基线（含缺项替换、取消四项全"未提供"、A-8 中文档位 + 中文原因）。逐条按需求同号 Then 判定
- **可否并行**：可 —— 只消费冻结的字段 / 键名契约，不依赖 orchestrator 是否已写完（缺 `health` 按契约兼容缺省降级渲染）

### WP-7 核心集成钩子 · orchestrator 唯一负责人（依赖：WP-1 + WP-2 + WP-3 + WP-5）

- **负责文件（2）**：`src/core/orchestrator.js`、`test/wp9/i19-orchestrator.test.js`
- **依赖**：WP-1（`trace.appendSpan` / 跨度契约）、WP-2（`emit` 链 + 尾读契约）、WP-3（冻结的 `computeHealth` 签名）、WP-5（失败摘要开关供集成测试）；**必须在 `computeHealth` / `trace` 模块签名冻结并实现之后才可开发**（§6 顺序约束）
- **交付**：`saveState`（`:444-454`）写回 `state.health`（保留 `nodeTimeoutMs`）；`newState`（`:735`）追加 `health: { nodeTimeoutMs: 30000 }`；`handleUpdate`（`:1183-1230`）四项摘要提取（唯一授权段）；节点收尾段（`:1595-1615` / `:2120-2230` / `:2530-2575` / `:2660-2810` / `:3240-3250`）追加「结束本轮跨度」调用（早于 `maybeStopAfter:3141` / `advance:3157`）；三收尾函数（`:1282` / `:1311` / `:3807`）共享辅助落 `execution.summary`、不新增第四入口；`getStatus`（`:4036`）读取时重算 + 首次补写不追加事件 + 档位变化一次窄 CAS + `health.changed`；12 处会话发射点不改写 / 不删除 / 不新增；`grep -c "object: 'session'"` ≤ 13。
- **验收口径**：主责 **AC-04**（四项摘要 + 成功节点也有摘要 + `instance log --format json` 可检索同一条）、**AC-05**（缺项存 `null`、实例目录无日志副本）、**AC-16**（正常 → 需关注、一次窄 CAS + 一条 `health.changed`、档位未变不重复）、**AC-17**（`state.health` 写回、两用户面可见）、**AC-18**（健康度只读、四组状态深比较相等、收尾无健康度行）、**AC-24**（`execution.summary` 每会话恰 1 条、除摘要外无新增会话级事件类型、遗留实例字节不变、`grep ≤ 13`）、**AC-26**（live 取消四项全 `null` / "未提供"、`cancelled` / `ended`）、**AC-27**（`T-001` 2 条摘要 `round=1/2`、`T-002` 1 条、每会话恰 1 条、全文摘要数 = 会话数）；协作 AC-01/02（emit 接链）、AC-03（三主链输出不回灌）、AC-06/07/08/22（跨度写入时机使冻结窗口 3 条）、AC-11/12/13/14/15（重算时机 + `nodeTimeoutMs`）、AC-19（不改既有状态输出）。契约测试 `i19-orchestrator.test.js`：断言 `saveState` 写回 `health`、`getStatus` 仅一次窄 CAS、`health.changed` 不重复、摘要每会话一条、`--stop-after 3` 冻结窗口恰 3 条跨度、`grep -c ≤ 13`。逐条按需求同号 Then 判定
- **可否并行**：否 —— 强依赖 WP-1/2/3/5 契约，且 `orchestrator.js` 是 I1.7 逐字回归（R-1/R-2）与新增三层日志 / 健康度的共用大文件，须在下游契约冻结后单线改动

### WP-8 CLI 命令面与 daemon 只读接口（依赖：WP-1 + WP-2 + WP-6 + WP-7）

- **负责文件（3）**：`src/cli/main.js`、`src/daemon/server.js`、`test/wp9/i19-cli.test.js`
- **依赖**：WP-1（`trace.readTraces` / 进行中叠加）、WP-2（`replay` 透出的 `badLines`）、WP-6（5 个渲染纯函数 + 健康度行）、WP-7（`getStatus` 写回的 `health` 字段供 e2e 全链路验证）
- **交付**：`main.js` 命令表 / 位置参数规则 / 运行时命令词 / 分发 / 实例命令区追加 `trace show`（只读、不新增 `--format`）；`statusCommand`（约 `:1062-1065`）只插一行 `renderHealthLine`；`instance log`（`:1191-1211`）只对两种 reason 分派 + 循环后按 `badLines > 0` 追加跳过行；`server.js` 追加只读 `instance.trace` + `instance.events` 返回带 `badLines`；`run` / `cancel` / `graph` 路径不动；`USAGE_LINES` 25 行不动；`cli-e2e.test.js` 按 D-8 只插健康度行、不放宽其它断言。
- **验收口径**：主责 **AC-09**（三种空形态退出码 0/0/1、不打印堆栈）、**AC-10**（`trace show` 只读、三次输出字节一致、`state.json` / `events.jsonl` 字节哈希不变）；协作 AC-03/19（三主链与 `status` / `graph` 既有输出逐字不回灌）、AC-04/05/21/24/25/26（`instance log` 两种 reason 分派 + A-13 跳过行）、AC-06/07/08/22/23（`trace show` 呈现 + 退出码 0 / 降级可见）、AC-11~17（健康度行插入）、AC-20（不改产品代码默认 host、零依赖）。契约测试 `i19-cli.test.js`：`trace show` 三形态 / 只读 / 退出码、`instance status` 恰多 1 行健康度、删健康度行后与基线逐字相等、`instance log` 分派与跳过行。逐条按需求同号 Then 判定
- **可否并行**：否 —— 依赖 WP-6 渲染函数与 WP-7 健康度写回，须在两者合入后单线改动 `main.js` / `server.js`

### WP-9 回归守护与验收取证（依赖：WP-1 ~ WP-8 全部合入）

- **负责文件（2）**：`test/wp9/i19-regression.test.js`、`test/wp9/cli-e2e.test.js`
- **依赖**：WP-1 + WP-2 + WP-3 + WP-4 + WP-5 + WP-6 + WP-7 + WP-8 全部合入（DAG 汇合点）
- **交付**：重跑 `single` / `code-loop` / `task-loop` 三主链并断言输出逐字不变；`instance status` 删健康度行后逐字比对、`instance graph` 文本 / JSON 字节比对；复跑 31 词纯净扫描（新增 `src/core` 文件纳入）与零依赖门禁；全量测试以失败集合与 `baseline-failures.txt` **差集 = 0** 判定、条数只增不减（不以绝对全绿判定，D-2）；`USAGE_LINES` 25 行 / `grep -c "object: 'session'"` ≤ 13 两条冻结基线复验；登记 `probe/acc9-*` 验收脚手架与 `evidence/` 证据目录（S3 产物，主控单独提交，不计入功能 commit）。
- **验收口径**：主责 **AC-03**（三主链逐字 + 失败集合差集 0 + 条数只增不减 + deps=0 + 31 词 `exit 0`）、**AC-19**（既有状态输出不回归、只允许新增一行健康度）、**AC-20**（零依赖 / 中文唯一来源 / 纯净扫描 / 无宿主分支、`labels-sync` 与纯净扫描用例通过）；协作 AC-01/02/21/25（链基线不回归）、AC-24/26（`grep ≤ 13` 与摘要类型唯一）、AC-04/05（缺项降级与日志副本检查）。契约测试 `i19-regression.test.js`：三主链归一化 diff 为空、与基线失败集合差集为 0、`dependencies` 键数 0、`purity-check` 以 D-6 登记的 31 词全表作 `--forbid` 参数时 exit 0。逐条按需求同号 Then 判定
- **可否并行**：否 —— DAG 汇合点，依赖全部就绪后末批单线合入并跑全量门禁

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-2 | WP-7、WP-9 | 事件日志只追加、旧行字节不变、seq 严格递增无空洞、条数只增不减（BR-01） |
| AC-02 | WP-2 | WP-7、WP-9 | 链式哈希逐条比对断点 0、两实例起点相同后续不同、31 词纯净扫描（BR-02/03） |
| AC-03 | WP-9 | WP-6、WP-7、WP-8 | 三主链逐字、失败集合差集 0、条数只增不减、deps=0、31 词 exit 0（BR-17） |
| AC-04 | WP-7 | WP-5、WP-6、WP-8、WP-9 | 失败摘要四要素、trace show / instance log 文本 / json 三视图、成功节点也有摘要（BR-04/21、A-4/A-12） |
| AC-05 | WP-7 | WP-5、WP-6、WP-9 | 缺项存 null 渲染"未提供"、实例目录无完整日志副本、不崩溃（BR-05/21） |
| AC-06 | WP-1 | WP-6、WP-7、WP-8 | 追踪号 / 起止 / 结果 / 交接包齐全、`traces.jsonl` 在 `state/`（BR-06） |
| AC-07 | WP-1 | WP-6、WP-7、WP-9 | 回流链按轮次、`HO-002 round=2 consumed`、`HO-003 retest` 不计回流、同节点两轮不合并（BR-07） |
| AC-08 | WP-6 | WP-1、WP-5、WP-7、WP-8、WP-9 | 规划验收①、`--stop-after 3 --keep` 后台冻结、A-3 逐字 `跨度 3 条 · 回流 1 次`、无进行中行（BR-06/07） |
| AC-09 | WP-8 | WP-1、WP-6 | 三种空形态 A-1/A-2/A-5 逐字、退出码 0/0/1、不打印堆栈（BR-09） |
| AC-10 | WP-8 | WP-1、WP-9 | 只读、三次输出字节一致、state/events 字节哈希不变（BR-08） |
| AC-11 | WP-3 | WP-4、WP-6、WP-7、WP-9 | 无异常 → 正常、status 行与 status.md 均为"正常"、无 running 节点、`nodeTimeoutMs=300000`（BR-10/13） |
| AC-12 | WP-3 | WP-6、WP-7 | 四终态 → 已结束、终态优先、历史红条件不回升（BR-10/13） |
| AC-13 | WP-3 | WP-4、WP-6、WP-9 | 五类红条件六夹具、A-6 附 8 行逐字、等值边界仅 `health.test.js` 注入 now（BR-11） |
| AC-14 | WP-3 | WP-1、WP-9 | P90 最近秩法 / N<5 不触发 / 严格大于、三实例 `nodeTimeoutMs=300000`、等值 50000/50001 单元级（BR-12/19） |
| AC-15 | WP-3 | WP-9 | TTL 50% 严格大于 15 分钟、`pendingAt`/`createdAt` 兜底、等值 900000 单元级、不实现自动过期（BR-12/20） |
| AC-16 | WP-7 | WP-2、WP-3、WP-4、WP-6、WP-8 | 规划验收②、正常 → 需关注、一次窄 CAS + 一条 `health.changed`、A-8 中文原因 / JSON 码值（BR-14/15） |
| AC-17 | WP-7 | WP-3、WP-6、WP-9 | 写入实例元数据、status 行与 status.md 与 A-7 一致、`dispatch-fail-first` 终态仅一条升级（BR-14） |
| AC-18 | WP-7 | WP-3、WP-9 | 只读、四组状态深比较相等、升级条数不变、收尾输出无健康度行（BR-16） |
| AC-19 | WP-9 | WP-6、WP-8 | 既有输出逐字、健康度只新增一行、graph 不出现健康度字段（BR-18） |
| AC-20 | WP-9 | WP-3、WP-4、WP-7 | deps=0 / 中文唯一来源 labels.js / 31 词纯净 / 无宿主分支、`labels-sync` 与纯净扫描用例（NF-5/D-6） |
| AC-21 | WP-2 | WP-6、WP-7、WP-9 | 旧记录无标记不回填、末行截断前溯、seq 从 4、`badLines=1`、A-13 提示、退出码 0（BR-01/02/22） |
| AC-22 | WP-1 | WP-6、WP-8、WP-9 | 进行中跨度叠加、`跨度 0 条`、结束位 `—`、不显示"暂无追踪记录"、放行后 `跨度 1 条`（BR-06/09、A-10） |
| AC-23 | WP-1 | WP-3、WP-6、WP-8 | 文件缺失 / 坏行 / 缺时间字段降级且可见、跳过行数 1、notime 的 P90 样本数 0 且不为"慢"（BR-24/19、A-11） |
| AC-24 | WP-7 | WP-2、WP-5、WP-6、WP-9 | 会话审计粒度、`execution.summary` 每会话 1 条、遗留实例字节不变、`grep ≤ 13`（BR-04/23） |
| AC-25 | WP-2 | WP-6、WP-7、WP-9 | 整份不可解析从 seq=1 重起链、首条 64 个 0、旧 3 行原样保留、跳过 3 行、退出码 0（BR-01/02/22/25） |
| AC-26 | WP-7 | WP-3、WP-5、WP-6、WP-9 | 取消走 `cancelLive` live 分支（非 `:3762`）、四项全"未提供"、cancelled/ended、A-14（BR-04/05/23） |
| AC-27 | WP-7 | WP-1、WP-6、WP-9 | 同一节点多轮每轮各一条摘要、`T-001` 2 条 `round=1/2`、`T-002` 1 条、全文摘要数 = 会话数（BR-04、A-12） |

> 覆盖核对：AC-01~AC-27 连续编号、一行一条、无缺号、无重号、无合并；每行恰好一个主责 WP（均真实存在且交付含该 AC 判据），跨包标协作 WP；合计 **27/27**。主责 WP 分布：WP-1（AC-06/07/22/23）、WP-2（AC-01/02/21/25）、WP-3（AC-11/12/13/14/15）、WP-6（AC-08）、WP-7（AC-04/05/16/17/18/24/26/27）、WP-8（AC-09/10）、WP-9（AC-03/19/20）；WP-4 / WP-5 无主责 AC、只承担协作。AC-09 主责 WP-8（退出码 / 只读分支），WP-6 只承担 A-1/A-2/A-5 文案逐字（协作）；AC-08 主责 WP-6（renderTraceShow 逐字 A-3），WP-1/7/8 协作；AC-18 主责 WP-7（健康度只读不改编排状态），WP-3 以纯函数承担协作。

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/core/health.js` | 新增：纯函数 `computeHealth({ state, graph, traces, now })` → `{ level, reasons }`、四档 / 8 原因码常量、终态优先、P90 / TTL / 节点超时判定 | WP-3 |
| `src/core/trace.js` | 新增：`newTraceId` / `appendSpan` / `readTraces` / `deriveHandoffIds` / `overlayRunningSpans`；7 字段跨度、`handoff_ids` 读取时推导 | WP-1 |
| `src/core/event-bus.js` | 改：`:90-105` 附加 `prev_event_hash`；`:110-122` `replay` 透出 `badLines` | WP-2 |
| `src/persistence/instance-store.js` | 改：新增 `readTailForChain`（同一次尾读）；`doAppend` / `nextSeq` / `readEvents` 不动 | WP-2 |
| `src/persistence/paths.js` | 改：只追加 `instanceStateDir` / `instanceTracesPath`；既有函数体不动 | WP-1 |
| `src/core/orchestrator.js` | 改：`saveState` 写回 health、`newState` 加 `health.nodeTimeoutMs=30000`、`handleUpdate` 摘要提取、节点收尾写跨度、三收尾函数写 `execution.summary`、`getStatus` 重算 + 窄 CAS + `health.changed`；12 处发射点不动 | WP-7 |
| `src/core/status-text.js` | 改：`:310-342` 在 `- 状态：…` 后插健康度行、`CORE_TEXT.doc.health` 镜像 | WP-6 |
| `src/cli/labels.js` | 改：文件末尾追加健康度 / 追踪文案键；`USAGE_LINES` 25 行与既有键不动 | WP-4 |
| `src/cli/render.js` | 改：新增 5 个纯函数 + `renderEventLines` 开头一个 reason 分派分支 + `STATE_LABEL.health` | WP-6 |
| `src/cli/main.js` | 改：命令表 / 位置参数 / 命令词 / 分发 / 实例区追加 `trace show`；`statusCommand` 插一行健康度；`instance log` 两种 reason 分派 + 跳过行 | WP-8 |
| `src/daemon/server.js` | 改：追加只读 `instance.trace`；`instance.events` 返回带 `badLines` | WP-8 |
| `src/adapter/session-state.js` | **不改**（只读基线，`tool_call_update` 分类在 `:153`）；不算负责文件 | — |
| `src/registry/role-instances.js` | **不改**（只读基线，`buildRoleInstances` 不被 `computeHealth` 调用）；不算负责文件 | — |
| `test/wp12/health.test.js` | 新增（D-8）：`computeHealth({ state, now })` 三组等值边界 | WP-3 |
| `test/wp9/i19-trace.test.js` | 新增：路径 / 追踪号 / 坏行 / `deriveHandoffIds` 契约 | WP-1 |
| `test/wp9/i19-chain.test.js` | 新增：规范化哈希 / 固定起点 / 旧记录不回填 / 截断前溯 / 整份重起 / `badLines` | WP-2 |
| `test/wp9/i19-labels.test.js` | 新增：新键 / 既有键 / `USAGE_LINES` 25 行 | WP-4 |
| `test/wp9/i19-fixture.test.js` | 新增：两个 `--fail-tool*` 开关、既有 12 开关与三条场景套件逐字不变 | WP-5 |
| `test/wp9/i19-render.test.js` | 新增：附录 A-1~A-14 全部 15 节逐字基线 | WP-6 |
| `test/wp11/status-doc.test.js` | 改（D-8 `:68-130`）：两处整份期望文本插 `- 健康度：正常`；`:179-251` 不动 | WP-6 |
| `test/wp9/i19-orchestrator.test.js` | 新增：health 写回 / 一次窄 CAS / `health.changed` 不重复 / 摘要每会话一条 / 冻结窗口 3 条跨度 / `grep ≤ 13` | WP-7 |
| `test/wp9/i19-cli.test.js` | 新增：`trace show` 三形态 / 只读 / 退出码 / status 健康度行 / log 分派 | WP-8 |
| `test/wp9/cli-e2e.test.js` | 改（D-8 `:135-180`）：若存在整份输出断言只插健康度行 | WP-8 |
| `test/wp9/i19-regression.test.js` | 新增：三主链逐字 / status·graph 逐字 / 失败集合差集 0 / purity 31 词 / deps=0 | WP-9 |
| `test/wp11/labels-sync.test.js` | **不改**（只读基线）；不算负责文件 | — |
| `test/wp12/cli-assets.test.js` | **不改**（只读基线，`USAGE_LINES` 25 行）；不算负责文件 | — |
| `test/wp11/purity.test.js` | **不改**（只读基线，新增 `src/core` 文件纳入扫描）；不算负责文件 | — |
| `test/fixtures/mock-acp-agent.js` | 改（D-4）：`--fail-tool` / `--fail-tool-no-refs` 两个默认关闭开关 | WP-5 |
| `test/fixtures/code-loop-driver.mjs` | **不改**（只读基线，`:494` 内部注入 `--host mock`） | — |
| `test/fixtures/task-loop-driver.mjs` | **不改**（只读基线，`:253` 内部注入 host，D-3 豁免） | — |
| `test/fixtures/purity-check.mjs` | **不改**（只读工具，31 词全表 `--forbid`） | — |
| `probe/acc9-f-lib.mjs` / `probe/acc9-f-common.mjs` / `probe/acc9-f-run.mjs` / `probe/acc9-f-final.mjs` | S3 验收脚手架四件套（常量 / 动作与断言 / 单 AC 与批次入口 / 由 results 重建），命令一律带 `--host mock` | WP-9（S3，主控单独提交） |
| `probe/acc9-cases/` / `probe/acc9-f-parts/` / `probe/acc9-f-results.jsonl` / `probe/acc9-f-summary.json` / `probe/acc9-f-blockers.md` | 逐 AC 用例 / 核对表 / 结果 / 汇总 / 缺陷台账（用例目录不带 `-f`） | WP-9（S3，主控单独提交） |
| `docs/iterations/iteration-9/evidence/` | 逐 AC 原始帧，按「AC 号 + 阶段 + 类型」三段命名（如 `AC-07.state.json` / `AC-07.events.jsonl` / `AC-07.status.txt`，覆盖 state / events / stdout / status / 中间态快照），每条至少 4 份 | WP-9（S3，主控单独提交） |

> `probe/acc9-*` 与 `evidence/` 是 S3 验收并行产物、由主控按模板 §2.7 单独提交，不进功能 commit；§1.5 文件零交集脚本只扫 `src/` / `test/` / `bin/` 反引号路径，二者不参与该扫描。

---

## 6. 依赖与并行策略

**DAG（文本图，依赖编号全部存在且无环）**

```
WP-1 (路径+追踪基座，叶子) ──┬──> WP-6 (渲染纯函数) ──────────┐
                            ├──> WP-7 (orchestrator 集成) ───┤
                            └──> WP-8 (CLI+daemon) ──────────┤
WP-2 (尾读+审计链，叶子) ───┬──> WP-7 ──────────────────────┤
                            └──> WP-8 ──────────────────────┤
WP-3 (health 纯函数，叶子) ─┬──> WP-6 ──────────────────────┤
                            └──> WP-7 ──────────────────────┤
WP-4 (文案键，叶子) ─────────────> WP-6 ──────────────────────┤
WP-5 (夹具开关，叶子) ─────────────> WP-7 ──────────────────────┤
WP-6 ────────────────────────────> WP-8 ──────────────────────┤
WP-7 ────────────────────────────> WP-8 ──────────────────────┤
WP-1..WP-8 ──────────────────────> WP-9 (回归守护汇合点) ──────┘
```

叶子：WP-1 / WP-2 / WP-3 / WP-4 / WP-5；汇合点：WP-9。依赖编号 WP-1~WP-9 全部存在，所有箭头由小编号指向大编号或同层已就绪包，无环。

**分批顺序（一次最多 2 个大 Agent，依据模板 §2.3；相互独立才并行、修复类永远单线）**

- **契约先冻结点（批次 0，由本文档定死，不占 Agent 名额）**：见下方清单；冻住后其余包才可并行。
- **第 1 批（2 并行）**：WP-1（路径 + 追踪基座）+ WP-3（健康度纯函数）—— 两个最关键签名先落地。
- **第 2 批（2 并行）**：WP-2（尾读 + 审计链）+ WP-4（文案键）。
- **第 3 批（2 并行）**：WP-5（夹具开关）+ WP-6（渲染纯函数，依赖 WP-1/3/4 已就绪）。
- **第 4 批（1）**：WP-7（orchestrator 核心集成钩子，强依赖 WP-1/2/3/5 契约，单线改动大文件）。
- **第 5 批（1）**：WP-8（CLI + daemon，依赖 WP-6 渲染函数与 WP-7 健康度写回，单线）。
- **第 6 批（1）**：WP-9（回归守护，依赖全部合入，末批单线跑全量门禁）。

**契约先冻结点**（必须先定死字段 / 函数签名 / 返回结构，冻住后其余包才可并行）：

1. **事件链**：`readTailForChain(id)` → `{ seq, prevHash, corruptAll }`（同一次尾读）；`prev_event_hash` = 前一条完整记录规范化 JSON 序列化后 SHA-256，首条 64 个 `0`；`replay` → `{ events, badLines }`（§2.3/2.4）。冻住后 WP-2 可独立开发、WP-7 可接链。
2. **`computeHealth` 签名**：`computeHealth({ state, graph, traces, now }) → { level, reasons }`，纯函数、`now` 可注入、`level` 四档、8 原因码固定顺序（§2.1）。**此签名先冻结 → WP-3 先实现 → 核心集成钩子 WP-7（`orchestrator`）才可开发**（连 `trace` 模块签名一并冻结，见第 3 条）。
3. **`trace` 模块签名**：`newTraceId` / `appendSpan(root, id, span)`（7 字段）/ `readTraces(root, id) → { spans, badLines }` / `deriveHandoffIds(state, nodeId, round)` / `overlayRunningSpans`；`handoff_ids` 不落盘、按 `fromNodeId`/`toNodeId` + `round`/`round+1` 推导（§2.2）。**`computeHealth` / `trace` 模块签名先冻结 → 核心集成钩子（`orchestrator`, WP-7）才可开发**；WP-6 渲染消费同一 7 字段契约。
4. **文案键名**：`HEALTH_LABEL` / `HEALTH_LINE` / `HEALTH_REASON_*` / `TRACE_*` / `SUMMARY_*` / `SUMMARY_LOG_LINE` / `EVENTS_SKIPPED` / `LAYER.health` / `CORE_TEXT.doc.health`（§2.8、A-9）。冻住后 WP-6 / WP-8 据此渲染，不依赖 `labels.js` 是否已写完。
5. **`state.health` 形状**：`{ level, reasons, computedAt, nodeTimeoutMs }`，`nodeTimeoutMs` 缺省 30000、回写保留；`newState` 初始只写 `{ nodeTimeoutMs: 30000 }`（§3.2）。冻住后 WP-6 可渲染降级、WP-7 可写回。
6. **两类事件形状**：`execution.summary`（`object:'session'` / `reason:'execution.summary'` / `detail.{nodeId,round,summary{command,exitCode,keyOutputLines,logRef}}`，缺项 `null`）、`health.changed`（`object:'health'` / `reason:'health.changed'` / `from`/`to` / `detail.reasons`），均带 `seq` / `ts` / `prev_event_hash`（§3.4）。冻住后 WP-6 / WP-7 / WP-8 分派一致。
7. **冻结基线**：`USAGE_LINES` 25 行不变、`grep -c "object: 'session'"` ≤ 13、`dependencies = {}`、31 词纯净扫描 `exit 0`、三主链逐字、`--host mock` 统一口径（§1.6 / `decisions.md` D-3）。

**整合检查点（每批合入后跑，给完整命令与预期数字）**

```bash
cd /Users/xuesh/www/Maestro

# 1) 全量测试（差集口径，不写死条数；D-2 裁决非绝对全绿）
node --test "test/**/*.test.js"
#   预期：失败集合与 docs/iterations/iteration-7/baseline-failures.txt 差集 = 0；
#        测试条数只增不减（基线 1028/1019/8/1）；不新增超出基线 8 条的失败

# 2) 架构纯净（31 词逐字，新增 src/core 文件纳入同一扫描）
FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"   # exit 0

# 3) 零依赖 / 两条冻结基线
node -p "Object.keys(require('./package.json').dependencies||{}).length"   # 输出 0
node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))"   # 输出 25
grep -c "object: 'session'" src/core/orchestrator.js   # ≤ 13

# 4) 三主链冒烟（$TEMP 独立根、NODE_ENV=test、--host mock 统一口径）
SMOKE="$TEMP/i19-smoke"; mkdir -p "$SMOKE"
NODE_ENV=test node bin/orch.js run --cwd "$SMOKE/single" --template single --host mock --task "写一份说明"
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$SMOKE/code" --scenario backflow-once
NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root "$SMOKE/task" --scenario dispatch-fail-first
#   归一化后与 I1.7 收口基线逐字 diff 为空（不多健康度行/追踪行）

# 5) 逐批契约测试（按当批 WP 选跑）
node --test test/wp9/i19-trace.test.js test/wp12/health.test.js                       # 第 1 批 WP-1/WP-3
node --test test/wp9/i19-chain.test.js test/wp9/i19-labels.test.js                    # 第 2 批 WP-2/WP-4
node --test test/wp9/i19-fixture.test.js test/wp9/i19-render.test.js                  # 第 3 批 WP-5/WP-6
node --test test/wp9/i19-orchestrator.test.js                                         # 第 4 批 WP-7
node --test test/wp9/i19-cli.test.js test/wp11/status-doc.test.js                     # 第 5 批 WP-8/WP-6 D-8
node --test test/wp9/i19-regression.test.js                                           # 第 6 批 WP-9
```

每批合入后预期数字汇总：**27/27 AC 有判定归属**、**失败集合差集 = 0 且条数只增不减**、**0 运行时依赖**、**31 词纯净 `exit 0`**、**三主链输出逐字不变**、**`USAGE_LINES` 25 行**、**`grep -c "object: 'session'"` ≤ 13**、**既有断言仅按 D-8 改期望文本（不弱化）**。第 4 批（WP-7 合入）须额外跑 `--stop-after 3 --keep` 冻结窗口，确认 A-3 的 3 条已完成跨度、无进行中行、`handoff_ids` 含 `HO-002`。

**第 4 批（WP-7 合入）额外复验 · AC-08 冻结窗口（`--stop-after 3 --keep`，可直接复制执行）**：夹具项目根一律放 `$TMPDIR` 下、绝不写进仓库（需求 §3.3 L524）；全序列注入 `NODE_ENV=test`；`--host mock` 统一口径（`decisions.md` D-3）由 `code-loop-driver.mjs:494` 内部注入并预置 `.orch/hosts/mock.json`（D-3「由 driver 内部注入」豁免），故后台启动行不另带 `--host`（`parseDriverArgv` 拒绝未知参数），只读 `trace show` 不解析 host；命令用仓库内相对路径（承接上方整合检查点块首 `cd`）。操作序列对齐需求 §3.3「中间态冻结」与 AC-08 夹具：后台启动 → 轮询标记 → 断言 → 写 `.mock/release` → `kill -INT`。

```bash
ROOT="$TMPDIR/i19-freeze"; mkdir -p "$ROOT"
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$ROOT" --scenario backflow-once --stop-after 3 --keep &
DRV=$!
#   轮询 .mock/stopped-after-3：文件出现即继续，不写「等待片刻」类固定 sleep（需求 §3.3 L527 / L530）
until [ -f "$ROOT/.mock/stopped-after-3" ]; do :; done
#   断言：orch trace show 与附录 A-3 逐字对齐（示意值按附录 A-0 替换后再逐字比较）
NODE_ENV=test node bin/orch.js trace show INST-001
#   预期逐字输出（附录 A-3，追踪号 / 时刻为示意值，按 A-0 替换）：
#     实例 INST-001 · 追踪 TRC-1a2b3c4d
#     跨度 3 条 · 回流 1 次
#     10:00:00 → 10:00:40  T-001 开发  已完成  交接 HO-001
#     10:00:40 → 10:01:30  T-002 测试  失败  交接 HO-001 HO-002
#     10:01:30 → 10:02:20  T-001 开发  已完成  交接 HO-002
#     回流链
#     第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
#   预期数字 / 结构：跨度 3 条、回流 1 次、时间线末尾无「进行中」行；
#     三条跨度 handoff_ids 依次为 [HO-001]、[HO-001, HO-002]、[HO-002]（对齐附录 A-3 与 D-2 L954）；
#     HO-002 round=2 / state=consumed，回流链行为「第 2 轮 / 已完成」。
#   放行并结束 driver（写 .mock/release → kill -INT，需求 §3.3「中间态冻结」/ v6 F-07）
touch "$ROOT/.mock/release"
kill -INT "$DRV"
```

> 冻结窗口复验预期数字（与上方 §6 汇总口径一致、不新增判据）：**跨度 3 条 · 回流 1 次**、3 条已完成跨度、**无进行中行**；三条跨度 `handoff_ids` 依次 `[HO-001]` / `[HO-001, HO-002]` / `[HO-002]`；`HO-002 round=2 consumed`；逐字输出以附录 A-3 为准、`handoff_ids` 来源以 D-2 L954 为准。

---

## 7. 风险与降级

> 逐条 `风险 | 影响 | 处置（点名文件 / 函数 / AC）`。

| # | 风险 | 影响 | 处置（点名文件 / 函数 / AC） |
|---|---|---|---|
| 1 | 跨度写入时机晚于 `maybeStopAfter` / `advance()`，冻结窗口只剩 2 条而非 3 条 | A-3 / AC-08 逐字基线对不上，回流因果链不可展开 | WP-7 `orchestrator.js` 节点收尾段（`:2120-2230` / `:2530-2575` / `:2660-2810` / `:3240-3250`）在**本轮收尾、早于 `:3141` `maybeStopAfter` 与 `:3157` `advance()`** 调 WP-1 `trace.appendSpan`；整合检查点第 4 批复验冻结窗口恰 3 条已完成跨度。D-2 明令禁止「先 `advance()` 再写跨度」 |
| 2 | `handoff_ids` 落盘为冻结值或只按「`round === 本轮`」过滤，漏掉 `HO-002` | T-002 r1 跨度少一个 `HO-002`，A-3 的 `HO-001 HO-002` 与「回流 1 次」不成立 | WP-1 `trace.js` `deriveHandoffIds` **读取时**按 `fromNodeId` / `toNodeId` + `round`（接收包 `round===r`、产出包正向 `round===r` / 回流 `round===r+1`）推导、按 `createdAt` 升序去重；`handoff_ids` **不落盘**；冻结窗口 3 条依次为 `[HO-001]` / `[HO-001, HO-002]` / `[HO-002]`（v7 F-03、AC-07/08） |
| 3 | 等值边界在 CLI 级用真实 `Date.now()` 断言，δ>0 把「恰好等于」推成「严格大于」 | AC-13/14/15 结论反转、不可复现 | WP-3 `health.js` `computeHealth({ state, now })` 纯函数 + 可注入 `now`；等值边界（30000/50000/900000 与 +1ms）**只在 `test/wp12/health.test.js` 注入固定 `now`**；CLI 级只用 31s vs 30s、70s/30s vs 50s、15:05/14:55 vs 15:00 安全余量，不拨钟不 `sleep`（v7 F-01/F-02、§3.3 L531） |
| 4 | 70s 运行时长先命中 30s 节点超时红档，抢在 P90「慢」之前 | AC-14 三实例档位判错（应为 慢/正常/正常） | WP-9 三个快照夹具显式写 `health.nodeTimeoutMs = 300000`；WP-3 `computeHealth` 读该字段（严格大于才命中）；WP-7 `getStatus` 重算时透传真实 `now`。AC-16 同样写 300000 使单调变化可构造（v7 F-01/F-07） |
| 5 | AC-26 取消走错分支（`:3762` 无 `ctx`）或用 `toolName` 冒充 `command`，四项出现非"未提供"值 | A-14 四项全"未提供"判据不成立 | WP-7 `orchestrator.js` `cancelLive`（`:3746-3747`）→ `applyCancel(..., ctx, handle)`（`:3801` live 分支，非 `:3762`）；`applyCancel`（`:3843`）置空 `session.toolName`、四项一律存 `null`；WP-5 夹具用既有 `--turn-delay-ms 30000` 构造 `tool_running`、第二进程取消、监听 `to:'tool_running'`；WP-6 `renderSummaryLogLine` 用 A-14 同一行模板渲染四项"未提供"（v5 F-06、v6 F-05） |
| 6 | 事件 `ts` 与状态变更不同刻（`startedAt`/`endedAt` 各自 `iso()` 差 4~8ms） | 破坏 I1.3 AC-35 逐字等式 / `seq` 单调与 `ts` 不早于上一条 | WP-2 `event-bus.js` `emit` 支持可选 `event.ts`（既有能力）并只做格式归一；WP-7 在节点收尾 / 状态迁移处传 `tsHint` 复用同一时刻；`seq` 与上一条 `prev_event_hash` 必须来自 `readTailForChain` **同一次尾读**，禁止两次读（模板 §5 硬约束 #5/#6、R-9） |
| 7 | 健康度读取时重算绕过 `transit()` / CAS，直接 `store.save` 改状态 | 污染编排状态、破坏 BR-16 / AC-18 | WP-7 `getStatus`（`:4036`）只允许「返回快照前」做一次受控窄 CAS 写入（与 `saveState` 同路径）并追加 `health.changed`；档位未变不写；状态迁移仍唯一入口 `transit()` + `save(expectedState)`，任何地方不直接 `store.save`（模板 §5 硬约束 #1、D-3、R-8） |
| 8 | `emit` 改成先广播后落盘，或落盘失败仍广播 / 改内存状态 | 事后复盘缺行、审计链断点 | WP-2 `event-bus.js:97-104` 「先 `appendEvent` 成功、才 `broadcast`」顺序**不改**；`emit` 失败返回 `STORE_WRITE_FAILED` 且不广播、不改内存状态；`instanceId` 只作路由键、不落盘不广播；单实例串行队列不动（模板 §5 #4、D-1、R-7） |
| 9 | 三个收尾函数各写一份 `object:'session'` 字面量或新增第四个摘要入口 | `grep -c "object: 'session'"` 突破 13，AC-24/26 审计粒度不成立 | WP-7 `quiesceSession`（`:1282`）/ `idleSession`（`:1311`）/ `applyCancel`（`:3807`）调用**同一个共享辅助函数**落 `execution.summary`，`object:'session'` 只新增 1 处；不新增第四入口、不额外开事件通道、每会话只写一次；WP-9 整合检查点 `grep -c ≤ 13`（D-7 L1017、AC-24/26） |
| 10 | `USAGE_LINES` 25 行被改（`trace` 用法塞进主用法块）或前 8 行文字变形 | I1.6 逐字锁定、`test/wp12/cli-assets.test.js` 回归 | WP-4 `labels.js:183-208` **不动**；WP-8 `main.js` 的 `trace` 用法走参数错误路径提示、不进主用法块；`test/wp12/cli-assets.test.js:119-132` **不改**（D-5/D-8/D-11、AC-19/20） |
| 11 | `--host mock` 缺省，核心解析 `dsh.json` 而非 `mock.json`，失败工具开关不生效 | AC-04/05/22/24/26 现场不可构造、`--fail-tool*` 不拉起 | WP-5 夹具 / WP-9 `probe/acc9-*` 所有直接 `orch run` 命令行**显式 `--host mock`** 并预置 `.orch/hosts/mock.json`；两个 driver 已由 `code-loop-driver.mjs:494` / `task-loop-driver.mjs:253` 内部注入 host，属 D-3「driver 内部注入」豁免；根因：`factory.js:43` 默认 `hostId='dsh'`、`main.js:806` 仅当 `flags.host` 字符串才透传、`host-config.js:39-40` 路径 `.orch/hosts/${hostId}.json`（`root` 为实例根）；**不改 Then / 附录 A / 产品代码**（`decisions.md` D-3） |
| 12 | 健康度被写进 `graph.json` 或触发路由 / 升级 / 调度 | BR-16 / AC-18 / U-4 基线偏差失控 | WP-3 `computeHealth` 纯函数不写盘、不调状态迁移；WP-7 `saveState` 只写 `state.health`、不碰 `graph.json`、不触碰派发 / 路由分支；`decisions.md` D-1 裁决「健康度不改路由」落入 §8 C-19，收口在 `report.md` §5 列已知偏差 |
| 13 | 12 处存量会话发射点被误改 / 删除 / 新增同类发射点 | U-7 基线偏差失控、AC-24「仍在发射」不成立 | WP-7 `orchestrator.js` 保留 4（`:1004`/`:1046`/`:1102`/`:1133`）、冻结 7（`:1203`/`:1294`/`:1323`/`:2085`/`:2306`/`:2325`/`:4889`）、复用 1（`:3847` `run.cancelled`），一律不改写 / 不删除 / 不新增、仍在发射；会话级新增类型只允许 `execution.summary`；清退归 I1.12（`decisions.md` D-1、D-7 L1018-1022、§8 C-22） |
| 14 | 新增中文散落到 `src/core` / `src/daemon`，或新模块出现 31 禁词 / `if host ==` | AC-20 / R-5 / R-6 门禁变红 | WP-4 新增中文只落 `labels.js`；`status-text.js` 只镜像键名；WP-3 `health.js` / WP-1 `trace.js` 零中文、零禁词、零宿主分支；WP-9 整合检查点逐字传 31 词全表 `--forbid`、新增 `src/core` 文件纳入同一扫描 |
| 15 | `status.md` 健康度行插入位置错、破坏既有逐字 | A-7 / AC-17 / AC-19 回归 | WP-6 `status-text.js:310-342` 只在 `- 状态：…`（`:319`）之后插一行、`CORE_TEXT.doc` 只追加 `health`；`test/wp11/status-doc.test.js:68-130` 按 D-8 只改两处整份期望文本（插 `- 健康度：正常`）、`:179-251` 不动；不放宽断言 |
| 16 | 快照夹具启动顺序错，`reconcileOnBoot` 把 `running` 判成 `interrupted` | AC-11/13/14/15/16/23 健康度误判"已结束" | WP-9 夹具一律按 §3.3 L533「先在空目录拉起核心（执行一次 `instance status INST-001` 返回不存在）→ 再写 `state.json`（带 `schemaVersion: 2`）/ `traces.jsonl` → 最后才执行 `instance status`」；`orchestrator.js:4059-4078` `reconcileOnBoot` 既有行为不改 |
| 17 | `orch run` 夹具缺 `--cwd .` 或断言 `/tmp` 与 `/private/tmp` 差异 | 参数错误退出 / macOS 环境漂移 | WP-5 / WP-9 所有 `orch run` 命令行带 `--cwd .`；路径断言只用相对路径或结尾匹配；`NODE_ENV=test` 必注入（§3.3 L535、v6 附加可构造性） |

---

## 8. 与需求的对齐声明 / 冲突清单

本文档不新增需求条目；所有逐字文案、状态名、错误码、AC 编号均以 `requirement.md` v7 为准；冲突时以需求为准。AC 一条不增、一条不减、一条不合并，`Then` 判定强度不放宽，范围内条目不挪到范围外，不夹带规划外能力（OTel 导出 / 健康度改路由 / worktree 生命周期 / `trace show` JSON / 链校验命令 / 自动过期均不在交付内）。本文档不自行宣布「评审通过」，产出交独立拆分评审 Agent。

**需求 / 附录 D 与代码现状的冲突及裁决**（表格列：编号 / 冲突点 / 依据 / 裁决 / 归属 WP）：

| 编号 | 冲突点 | 依据（需求节号或评审轮次） | 裁决 | 归属 WP |
|---|---|---|---|---|
| C-01 | `src/core/event-bus.js:90-105` 的 `emit` 现状无 `prev_event_hash`；`:110-122` 的 `replay` 只返回 `read.events`、不透出 `readEvents` 已返回的 `badLines` | D-1 L940-943、D-7 L1005-1006、BR-02、AC-02/21/25 | 只在 `emit` 内计算并附加 `prev_event_hash`（规范化 JSON 序列化 SHA-256、同一次尾读）；`replay` 透出 `badLines`。**不改**「先落盘再广播」顺序（`:97-104`）、`instanceId` 路由语义、`subscribe`、`emit` 返回结构 | WP-2 |
| C-02 | `src/persistence/instance-store.js:260-291` / `:380-399` 现状无「同一次尾读返回序号与上一条指纹」方法；`readEvents`（`:293-315`）已返回 `{ ok, events, badLines }`（既有能力，非本迭代新增） | D-1 L942、D-7 L1007、round7 §2.2「既有能力透出，非夹带」 | 只新增 `readTailForChain(id)` → `{ seq, prevHash, corruptAll }`；`doAppend` 整行追加、`nextSeq` 容错、`readEvents` 的 `badLines` 计数**不动**；不新增第二条序号来源 | WP-2 |
| C-03 | `src/persistence/paths.js` 现状无 `instanceStateDir` / `instanceTracesPath`；且事件日志落在各实例目录下的 `events.jsonl`（`:51-53`）与基线 §5.2 的 `.orch/events.jsonl` 不同 | D-2 L948、D-7 L1008、U-9（v7 F-09）、AC-06 | 只在 `corruptPath`（`:55-58`）之后、`instanceWorkspaceDir`（`:60-66`）之前追加两导出（按函数名定位，不按固定行号）；`statePath` / `eventsPath`（`:47-53`）**不改**；U-9 既有布局偏差**不改布局、不迁移文件** | WP-1 |
| C-04 | `src/core/orchestrator.js` 现状 `saveState`（`:444-454`）不写 `health`、`newState`（`:735`）无 `health.nodeTimeoutMs`、`handleUpdate`（`:1183-1230`）不提取摘要、节点收尾不写跨度、`getStatus`（`:4036`）读取不重算、三收尾函数不写 `execution.summary` | D-2/D-3/D-4、D-7 L1009-1022、v7 F-03/F-04、BR-04/14/15、AC-04/06/08/16/26/27 | 逐授权行段最小改动（见 §2.6）：`saveState` 写回 `health`（保留 `nodeTimeoutMs`）、`newState` 只加 `health:{nodeTimeoutMs:30000}`、`handleUpdate` 只做四项摘要缓存、节点收尾只追加跨度调用且早于 `:3141`/`:3157`、三收尾函数共享辅助落 `execution.summary`、`getStatus` 一次窄 CAS + `health.changed`；**不改**既有迁移 / 时间戳 / 事件顺序 / 12 处发射点；`grep -c ≤ 13` | WP-7 |
| C-05 | `src/adapter/session-state.js:146-160` 现状只做状态与工具名归一化，`tool_call_update` 分类分支在 `:153`；需求要求摘要提取落点在核心 | D-4 L978、D-7 L1023、v3 F-04 | **本迭代不改**（只读基线）。摘要提取改在 `orchestrator.js` 的 `handleUpdate` 读原始帧；若需读 `update` 原始帧，改在 `orchestrator.js` 侧做，不在适配器加摘要字段。不算负责文件 | — |
| C-06 | `src/core/status-text.js:310-342` 现状 `renderStatusDoc` 无健康度行，`:319` 是 `- 状态：…` | D-5 L986、D-7 L1024、v7 F-05、A-7、AC-11/17/19 | 只在 `:319` 之后插入一行 `- 健康度：…`；`CORE_TEXT.doc` 只追加 `health` 字段名镜像 `labels.js`；既有段名 / 字段顺序 / 空值处理、`single` 不输出 `## 节点` 段**不动** | WP-6 |
| C-07 | `src/cli/labels.js` 现状无健康度 / 追踪文案键；`USAGE_LINES`（`:183-208`）为 25 行逐字基线 | A-9、D-5 L988-989、D-7 L1025、D-8/D-11 | 只在文件末尾追加键（`HEALTH_LABEL` / `HEALTH_LINE` / `HEALTH_REASON_*` / `TRACE_*` / `SUMMARY_*` / `SUMMARY_LOG_LINE` / `EVENTS_SKIPPED` / `LAYER.health`）；`USAGE_LINES` 25 行与既有键**不动** | WP-4 |
| C-08 | `src/cli/render.js` 现状无 5 个纯函数；`renderEventLines`（`:988`）无 reason 分派；`STATE_LABEL`（`:61`）无 `health` | D-5 L986-988、D-7 L1026、v7 F-04、A-1~A-14 | 只新增 5 个纯函数 + `renderEventLines` **函数开头一个**按 `event.reason` 分派分支（`execution.summary` / `health.changed`）+ `STATE_LABEL.health` 指向 `labels.js`；其余事件行格式 / 相对顺序 / 既有渲染函数（`renderGraphJson` / `renderGraphText` / `renderNodeLines`）**不动** | WP-6 |
| C-09 | `src/cli/main.js` 现状 `RUNTIME_COMMANDS`（`:195-198`）无 `trace`、`RUNTIME_SUBS`（`:200-206`）无 `trace:['show']`、`statusCommand`（`:999-1070`）无健康度行、`instance log`（`:1196-1211`）无 reason 分派 / 跳过行 | D-5、D-7 L1027-1030、v7 F-04、BR-18 | 只改 `:194-206` / `:543-561` / `:571` / `:628-634` / `:1167-1230` 追加 `trace show`；`statusCommand`（约 `:1062-1065`）只插**一行** `renderHealthLine`；`instance log`（`:1191-1211`）循环内只对两种 reason 分派、循环后 `badLines>0` 追加 `renderEventsSkippedLine`；`run` / `cancel` / `graph` 路径**不动** | WP-8 |
| C-10 | `src/daemon/server.js:201-233` 现状无只读 `instance.trace`；`instance.events`（`:225-232`）返回不带 `badLines` | D-7 L1031、AC-06/10/21/25 | 只追加只读 `instance.trace`（调 `trace.readTraces` + `overlayRunningSpans`）；`instance.events` 返回带 `badLines`（与 `events` 同源）；既有方法表 / 错误映射 / `instance.get` 返回结构**不动** | WP-8 |
| C-11 | 新增 `src/core/health.js` 现状不存在；`src/registry/role-instances.js:123` 的 `buildRoleInstances` 需注册表，核心无注册表 | D-3 L963-970、v7 F-01/F-10、AC-11~16/18 | 新增纯函数 `computeHealth({ state, graph, traces, now })`（不读盘、不取系统时间、`now` 可注入、不调 `buildRoleInstances`、角色由状态投影）；`src/registry/role-instances.js` **不改**（只读基线、不算负责文件） | WP-3 |
| C-12 | 新增 `src/core/trace.js` 现状不存在，核心无追踪模块 | D-2 L946-959、v7 F-03、AC-06~10/22/23 | 新增 `newTraceId` / `appendSpan` / `readTraces` / `deriveHandoffIds`（读取时按 `fromNodeId`/`toNodeId` + `round`/`round+1` 推导）/ `overlayRunningSpans`；`handoff_ids` 不落盘；零禁词零中文 | WP-1 |
| C-13 | `test/wp11/status-doc.test.js:68-130` 现状两处整份期望文本无健康度行 | D-8 L1036、A-7、AC-11/17/19 | 只在 `- 状态：运行中` 后插 `- 健康度：正常`；其余行逐字不动；`:179-251`「人工改写 / 无新状态不覆盖」用例**不动**；只改期望文本、不放宽断言 | WP-6 |
| C-14 | `test/wp9/cli-e2e.test.js:135-180` 现状若有 `instance status` 整份输出断言则无健康度行 | D-8 L1037、BR-18 | 若存在整份输出断言，只插健康度行；超时 / 状态词 / 会话行断言**不动** | WP-8 |
| C-15 | `test/wp11/labels-sync.test.js:22-29` 映射表不含新键 | D-8 L1038、D-6 | **不改**映射表；新增健康度文案不并入六张状态表即可（只读基线、不算负责文件） | — |
| C-16 | `test/wp12/cli-assets.test.js:119-132` 锁定 `USAGE_LINES` 25 行 | D-8 L1039、D-5、D-11、AC-19/20 | **不改**；`USAGE_LINES` 仍 25 行且前 8 行逐字不变（只读基线、不算负责文件） | — |
| C-17 | `test/wp11/purity.test.js` 31 词表现状不含新增 `src/core` 文件的覆盖声明 | D-8 L1040、R-6、AC-20 | 31 词表**不动**；新增 `src/core/health.js` / `trace.js` 必须被同一扫描覆盖（只读基线、不算负责文件；扫描覆盖由 WP-9 整合检查点执行） | WP-9 |
| C-18 | `test/wp12/health.test.js` 现状不存在，等值边界无单测落点 | D-8 L1041、AC-13/14/15 机检、v7 F-01/F-02 | **新增**，专覆盖 `computeHealth({ state, now })` 三组等值边界（30000/50000/900000ms 恰好等于不命中 / 超出 1ms 命中），注入固定 `now` | WP-3 |
| C-19 | 基线 541 行要求健康度「影响路由决策」，U-4 登记为基线偏差；U-7 要求 12 处存量会话发射点清退 | `decisions.md` **D-1**、review-round7 §5.2、需求 §1.3 L56/L57、B-5 L851/L854、`docs/index.md` L898 | **确认豁免，不阻断开工**：健康度只计算 / 写元数据 / 进事件日志 / 在用户面可见，**不改路由决策**（不触碰 `orchestrator.js` 派发 / 路由分支）；存量 12 处会话发射点保持既有发射、不新增同类发射点，清退按 L898 归 **I1.12**；二者在 `report.md` §5 列为「已知偏差」 | WP-7 / WP-9（取证） |
| C-20 | 模板 §1.1 DoR 第 9 条字面「全量测试基线且为全绿」与 HEAD `70277df` 实况 `1028/1019/8/1` 不符 | `decisions.md` **D-2**、I1.7 `baseline-failures.txt`、需求 §3.3 L536、AC-03/20 | **沿用 I1.7「失败集合差集 = 0」口径**，测试条数只增不减，**非绝对全绿**；`progress.md` §基线如实登记这 1 条 DoR 偏离（12 绿 / 1 口径偏离，非放宽判定、非删减 AC）；收口在最终 HEAD 重跑全量并逐条比对 `baseline-failures.txt` | WP-9 |
| C-21 | AC-04/05/24（及 AC-22）的「夹具：」示例命令行未显式带 `--host mock`，而 §3.3 L525 总口径「运行时加 `--host mock`」、AC-26 与两个 driver 均带；代码侧 `factory.js:43` 默认 `hostId='dsh'`、`main.js:806` 仅传 `--host` 时透传、省略会解析 `dsh.json` | `decisions.md` **D-3**、需求 §3.3 L525、`code-loop-driver.mjs:494`、`task-loop-driver.mjs:253`、review-round7 §7.2 | **以 §3.3 总口径为准**：`probe/acc9-*` 与所有夹具命令行一律显式带 `--host mock`（或由 driver 内部注入），夹具预置 `.orch/hosts/mock.json`；AC 的判定锚点、Then、附录 A 基线**一字不改**；此裁决只统一「怎么把现场造出来」，不改「判什么」，**不改产品代码与需求正文**。S1 拆分 §1.6 / §5 与验收任务书写明该统一口径 | WP-5 / WP-9（S3） |
| C-22 | `main@70277df` 的 `orchestrator.js` 已有 **12 处**逐条会话状态事件发射点（`grep -c "object: 'session'"` 实测 = 12），与基线 564 行「会话状态变更进执行日志摘要、不进主审计」不符；本迭代既要「仍在发射」又要「不新增同类发射点」 | U-7、D-4 L974、D-7 L1018-1022、BR-23、AC-24/26、round6 §6.3 实测 | **保留 4 / 冻结 7 / 复用 1**：保留（审批留痕）`:1004` / `:1046` / `:1102` / `:1133`；冻结（逐条运行态迁移，按 U-7 由 I1.12 清退）`:1203` / `:1294` / `:1323` / `:2085` / `:2306` / `:2325` / `:4889`；复用（取消收尾路径已有发射点）`:3847` `run.cancelled`。本迭代一律**不改写、不删除、不新增、仍在发射**；除此之外只新增 `execution.summary` 一条会话级记录，`object:'session'` 字面量只新增 1 处，`grep -c ≤ 13`；会话级新增事件类型只允许 `execution.summary` 一种，禁止第三类逐条会话事件 | WP-7 |
| C-23 | 规划外能力（OTel 导出 / 健康度改路由 / worktree 生命周期 / `trace show` JSON / 链校验命令 / `pending→expired` 自动过期）易被夹带 | 需求 §1.3 L49-59、U-4/U-6/U-9、`decisions.md` D-1、I1.7 §1.3 L51 | **明确不夹带**：OTel 导出 / 校验命令 / `trace show` JSON 输出归 I1.12 或后续；健康度不改路由；worktree 生命周期属 U 项（O-10）本迭代不涉及、不改动；自动过期留后续治理迭代。均**不在任何 WP 交付项内**，实现侧发现细节按模板 §6 记台账并升级、不自行扩范围 | 所有 WP（约束） |

> D-7 授权文件覆盖：C-01~C-12 共 **12/12** 个（10 个既有改文件 + 2 个新增文件，含 C-05「`session-state.js` 不改」、C-11 附「`role-instances.js` 不改」）。D-8 断言文件覆盖：C-13~C-18 共 **6/6** 个（5 个点名既有 + 1 个新增 `health.test.js`，其中 C-15/C-16/C-17 显式标「不改」）。主控裁决覆盖：C-19（D-1）/ C-20（D-2）/ C-21（D-3）共 **3/3** 条。另 C-22 单独裁决「存量 12 处保留 4 冻结 7 复用 1」，C-23 声明不夹带规划外能力。
> 修订记录：R1 / 闭合 split-review F-01~F-03 / 变更位置：文档头部版本号（拆分文档版本 r2）、§3 开头「示意值与逐字口径」统一说明、§6 整合检查点新增冻结窗口复验命令与预期数字、§2.9 与 WP-6 验收口径的 `test/wp9/i19-render.test.js` 全路径统一。
