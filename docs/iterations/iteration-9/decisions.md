# I1.9 决策留痕（主控维护）

> 依据：`docs/templates/execution-template.md` §2.8「所有自主裁决写进 `decisions.md`，一行一条：触发点 / 依据 / 决定 / 影响面」。
> 裁决优先级固定：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > 规划文档 > 代码现状`。代码现状排最后，只说明「以前怎么做」，不是标准。
> 本文件只记录**主控裁决**；需求撰写/修复/评审/理解的产物分见 `requirement.md`、`review-round*.md`、`requirement-understanding.md`。

---

## D-0 · 跳过 I1.8 直接开工 I1.9（沿用 `progress.md` §决策留痕）

| 项 | 内容 |
|---|---|
| 触发点 | 用户要求「开始 I1.9」，而 `docs/index.md` 迭代顺序为 …→I1.7→I1.8→I1.9，I1.8 状态「未开始」 |
| 依据 | `docs/index.md` 行 696-697（I1.8 预判 C 类、真实面必须本机；I1.9 预判 B 类、纯核心侧）；I1.9 规划条目与基线要求不引用 I1.8 的崩溃恢复/检查点/session resume |
| 决定 | 按用户指定直接做 I1.9；若需求或拆分阶段发现 I1.9 条目实际依赖 I1.8 能力，立即书面升级给用户裁决，不自行扩范围 |
| 影响面 | 需求范围、拆分 DAG、验收前置条件 |

## D-1 · U-4 / U-7 两条基线偏差的书面豁免确认

| 项 | 内容 |
|---|---|
| 触发点 | 需求理解 Agent 回报：`requirement.md` §1.3 L56/L57、附录 B-5 L851/L854 自述两条基线偏差「需评审/主控确认豁免」，理解纪要按职责分工未替主控拍板 |
| 依据 | `review-round7.md` §5.2 已裁决「接受，已如实登记且标不阻塞，判 PASS」；两条偏差分别是 U-4（健康度暂不参与路由决策）与 U-7（12 处存量会话发射点清退延后 I1.12）；`docs/index.md` L898 明确审计粒度规则落地归 I1.12 |
| 决定 | **确认豁免，不阻断开工**。本迭代按需求正文的登记口径执行：健康度只计算/写入元数据/进事件日志/在用户面可见，**不改路由决策**；存量 12 处会话发射点保持既有发射（不新增同类发射点），清退按 L898 归 I1.12。二者均需在 `report.md` §5 列为「已知偏差」 |
| 影响面 | 健康度作用域（不触碰 `orchestrator.js` 的派发/路由分支）、事件链存量兼容、`acceptance.md` 对 AC-24 的取证口径 |

## D-2 · DoR 第 9 条「且为全绿」与基线实况的口径裁决

| 项 | 内容 |
|---|---|
| 触发点 | 模板 §1.1 DoR 第 9 条字面要求「全量测试当前基线数字已记录，且为全绿」；基线 HEAD `70277df` 实为 **1028 tests / 1019 pass / 8 fail / 1 skipped**，8 条均为预存在、环境敏感（性能 p95 / 真进程 / 并发 / 时序 / macOS `/private/var` 符号链接） |
| 依据 | I1.7 已确立并实跑验证的口径（`docs/iterations/iteration-7/progress.md` §S3 回归门禁、`baseline-failures.txt`）：以**失败集合差集 = 0** 判定，测试条数只增不减；I1.9 `requirement.md` §3.3「回归基线」段与 AC-11/20 亦采用该口径。第 9 条保留「全绿」字面是模板的历史表述，不是本迭代可满足的实况 |
| 决定 | **沿用 I1.7 的「失败集合差集 = 0」口径**，并在 `progress.md` §基线如实登记这 1 条 DoR 偏离（12 绿 / 1 口径偏离，非放宽判定、非删减 AC）。收口时必须在最终 HEAD 重跑全量并逐条比对 `baseline-failures.txt`，数字与失败集合均不得落后于 HEAD |
| 影响面 | S3 回归门禁、S4 `final-verification.md` 的判定项、`report.md` §4 门禁数字 |

## D-3 · 夹具命令行 `--host mock` 的统一口径

| 项 | 内容 |
|---|---|
| 触发点 | 需求理解 Agent 回报：AC-04 / AC-05 / AC-24（及 AC-22）的「夹具：」示例命令行未显式带 `--host mock`，而 §3.3 L525 总口径写明「运行时加 `--host mock`」、AC-26 与两个 driver 均带；代码侧 `src/adapter/factory.js:43` 默认 `hostId='dsh'`、`src/cli/main.js:806` 仅在传 `--host` 时透传，省略会解析 `dsh.json` 而非夹具预置的 `mock.json` |
| 依据 | 优先级 `AC 的 Then/And > 附录 A > 附录 D > 规划 > 代码现状`；本节争议仅涉及**夹具示例文字的命令行参数**，不涉及任何 `Given/When/Then` 判据与期望值；`requirement.md` §3.3「宿主夹具」段是全局强制口径；`test/fixtures/code-loop-driver.mjs:494` 实测固定注入 `'--host','mock'` |
| 决定 | **以 §3.3 总口径为准**：S3 验收脚手架（`probe/acc9-*`）与所有夹具命令行一律显式带 `--host mock`（或由 driver 内部注入），夹具预置 `.orch/hosts/mock.json`。AC 的判定锚点、Then、附录 A 基线**一字不改**；此裁决只统一「怎么把现场造出来」，不改「判什么」。S1 拆分文档 §2/§5 与验收任务书需写明该统一口径，避免实现/验收阶段各自省略 |
| 影响面 | `probe/acc9-*` 脚手架命令构造、夹具目录预置文件、S3 取证可构造性；不改产品代码与需求正文 |

---

## 留痕状态

| 编号 | 状态 | 首次登记 |
|---|---|---|
| D-0 | 已生效 | 2026-11-10（`progress.md`） |
| D-1 | 已裁决 | 2026-11-11 |
| D-2 | 已裁决 | 2026-11-11 |
| D-3 | 已裁决 | 2026-11-11 |

## D-4 · `appendSpan` 返回形状口径（WP-1 开放点）

| 项 | 内容 |
|---|---|
| 触发点 | WP-1 回报：拆分 §2.2 写 `appendSpan` 返回「`{ ok, seq? }` 形状」，任务书要求 `{ ok:true }` / `{ ok:false, code }`，实现按任务书落地（成功不含 `seq`） |
| 依据 | 契约先冻结点第 3 条与 §2.2 的 `seq?` 是**可选字段**；下游 WP-7 只判 `.ok`；需求附录 D-2 只要求「整行一次追加」，未要求返回序号；`traces.jsonl` 无 `seq` 字段（跨度 7 字段固定） |
| 决定 | **以实现为准，不改文档、不改代码**：成功 `{ ok:true }`、失败 `{ ok:false, code:'TRACE_APPEND_FAILED' }`；`seq?` 视作可选、不强制。WP-7 集成时只判 `.ok`，不得依赖 `seq`。登记为口径澄清，非缺陷 |
| 影响面 | WP-7 `orchestrator.js` 的跨度追加调用；不影响任何 AC 判据与输出基线 |

## D-5 · `session_crash` 的脏数据兜底口径（WP-3 开放点）

| 项 | 内容 |
|---|---|
| 触发点 | WP-3 回报：`computeHealth` 对 `sessions[].quarantined===true` 的判定，在「绑定节点可解析」时要求节点为 `failed`/`escalated`（B-4 忠实口径），在「绑定节点不可解析」时按 `quarantined` 单独命中兜底；另登记真实 orchestrator 置 `quarantined` 时会话多为 `idle`、绑定节点态不保证 `failed`/`escalated` |
| 依据 | 需求附录 B-4 明确「以『会话被隔离且其节点未成功』近似」，且「被隔离会话不再重复计入角色不可用」；AC-13 六个红条件夹具**全部用只含该条件的实例快照构造**（崩溃夹具为 `quarantined=true` + 绑定节点 `failed`/`escalated`）；BR-24 的降级口径针对追踪记录缺失/单行不可读/缺起止时刻，不针对会话绑定节点不可解析 |
| 决定 | **保持实现，判为已登记口径而非缺陷**：①B-4 的「近似」本身就是需求自定的口径，真实运行里 `quarantined` 会话多为 `idle` 导致的漏报属该口径的已知边界，记入 `report.md` §5 遗留；②「绑定节点不可解析 → 按 quarantined 命中」是脏数据兜底，AC-13/AC-23 均不构造该形态，不影响取证；③红档短路只返回红码、不并列黄码，与任务书「🟡 无红档时才判」及 BR-10「同一时刻只显示一档」一致。**不采纳**「放宽为仅凭 quarantined 即命中」与「红档并列黄码」两个可选建议——它们会改变 B-4 与四档语义，属放宽判据，违反 §1.2 |
| 影响面 | `src/core/health.js` 不动；S3 取证按 AC-13 快照夹具；`report.md` §5 需登记该口径边界 |

## D-6 · `replay` 返回形状（WP-2 开放点）

| 项 | 内容 |
|---|---|
| 触发点 | WP-2 回报：拆分 §6① 字面冻结 `replay → { events, badLines }`，但 `src/daemon/server.js:229-230` 与 `test/wp1/event-bus.test.js:149-153` 强制数组形状，改结构会让既有调用者与 `instance.events` JSON 序列化回归；实现采用「仍返回数组 + 非枚举 `badLines` 属性」 |
| 依据 | 需求 **D-7 L1006** 原文允许「返回值改为 `{ events, badLines }` **或等价的附带字段**」；D-9「`instance log` 既有事件行格式不动」、AC-03/AC-19 逐字红线；`Object.defineProperty` 非枚举属性对 `length`/`JSON.stringify`/`Object.keys`/`deepEqual`/展开透明（WP-2 已实跑验证，主控复跑 `test/wp1/event-bus.test.js` 7/7 绿） |
| 决定 | **接受实现，判为契约等价形态**：`replay()` 恒返回事件数组，`badLines` 为数组上的非枚举属性。**转达 WP-8**：`src/daemon/server.js` 的 `instance.events`（D-7 L1031 已授权）必须从 `events.badLines` 取值并显式置入 `result.badLines`；`src/cli/main.js` 的 `instance log` 从 RPC `result.badLines` 读取渲染 `EVENTS_SKIPPED`，**不许**按 `{ events, badLines }` 解构 `replay` 结果，也不许直接透传数组属性（IPC JSON 序列化会丢非枚举字段）。S3 验收 AC-23/25 的取证必须覆盖这条链路 |
| 影响面 | WP-8 两个文件；AC-23/25 的跳过行提示；不改需求与拆分文档 |

## D-7 · `LAYER.health` 落地为 `LAYER_HEALTH.health`（WP-4 开放点）

| 项 | 内容 |
|---|---|
| 触发点 | WP-4 回报：需求 D-5 L988 写「`labels.js` 增加 `LAYER.health = '健康度'`」，但既有 `LAYER` 表（`:219-226`）位于文件前半部分且 `Object.freeze`，而本 WP 硬约束「只在文件末尾追加、既有键零改动、前半部分一行不动」；实现另立 `LAYER_HEALTH = Object.freeze({health:'健康度'})` |
| 依据 | 优先级 `AC Then > 附录 A 输出基线 > 附录 D 实现约束 > 代码现状`：**附录 A-9 表格**把层名「健康度」的归属写作 `CORE_TEXT.doc.health`（`status-text.js` 镜像 `labels.js`），**并未要求 `LAYER.health` 这个字面键名**；A-8 的用户可见判据是文本行 `健康度 INST-001  正常 → 需关注  原因 有待处理升级`，只要渲染逐字命中即可；D 附录抬头明确「仅供编码参考，不进入需求判定」。改冻结表会违反 `USAGE_LINES` 与「既有键零改动」回归红线 |
| 决定 | **接受 `LAYER_HEALTH.health` 为冻结契约名**，不改既有 `LAYER` 表。**转达 WP-6 / WP-8**：健康度事件行的 `{layer}` 一律从 `LAYER_HEALTH.health` 取；`CORE_TEXT.doc.health` 在 `status-text.js` 侧镜像该值。A-8 逐字输出是唯一判据，键名不是 |
| 影响面 | WP-6（`render.js` / `status-text.js`）、WP-8 的事件行渲染；不改附录 A 任何基线 |

## D-8 · `HEALTH_REASON_*` 落地为单表 `HEALTH_REASON[code]`（WP-4 开放点）

| 项 | 内容 |
|---|---|
| 触发点 | WP-4 回报：A-9 / §2.8 用通配族 `HEALTH_REASON_*`，实现按 A-8「码值 → 中文原因、同一张映射表」落地为**单表** `HEALTH_REASON`（8 键，键即 D-3 L968 的 8 个原因码） |
| 依据 | A-8 明确要求「码值 → 中文原因」映射；D-3 L968 给出 8 码固定顺序；A-6 附 8 条逐字原因句已由 WP-4 测试逐条断言通过（主控复跑 `i19-labels.test.js` 14/14）。通配族是「一组键」的写法，单表属等价形态，且能让固定顺序由 `computeHealth` 的 `reasons` 数组直接驱动渲染 |
| 决定 | **接受单表，不追加 8 个别名导出**：`HEALTH_REASON[code]` 是唯一入口；**转达 WP-6**：`renderHealthLine` / `renderHealthEventLine` 遍历 `health.reasons`（已按固定顺序），逐码查表后用 ` · ` 拼接，不得自行硬编码中文或改顺序。A-6 附 8 句逐字基线不变 |
| 影响面 | WP-6 渲染实现；A-6 附 / A-8 判据不变 |

## D-10 · 摘要四要素的上报载体（WP-5 → WP-7 契约冻结）

| 项 | 内容 |
| 触发点 | 需求 D-4 L979 / 拆分 §2.14 只钉死开关名 `--fail-tool` / `--fail-tool-no-refs` 与「能上报命令、退出码、输出行数、日志引用」，**未钉死四项挂在 ACP 帧的哪个字段**；`orchestrator.handleUpdate`（`:1183-1230`）当前只从 `tool_call` 读 `title` 与 `rawInput.file_path`，WP-7 需要稳定取值点；批次 3 开工前必须冻结，否则 WP-5 与 WP-7 各自猜形状 |
| 依据 | `requirement.md` D-4 L975 摘要四项字段名固定为 `command` / `exitCode` / `keyOutputLines` / `logRef`；L978 要求「四项由 `handleUpdate` 读取**原始帧**后缓存」「帧名取 `tool_call` / `tool_call_update` 两个取值」、且 `src/adapter/session-state.js` 本迭代不改；L977 明确 `toolName`（来自 `tool_call.title`，mock 实测 `write`）**不得**冒充 `command`；附录 D 抬头「仅供编码参考，不进入需求判定」，载体字段属实现自由。裁决优先级 `AC Then/And > 附录 A > 附录 D` 在本条无冲突 |
| 决定 | 冻结载体如下：**`tool_call` 帧新增 `execution: { command }`；`tool_call_update` 完成帧新增 `execution: { exitCode, keyOutputLines?, logRef? }`**。`--fail-tool` 报全四项（`command='node out/run.js'`、`exitCode=1`、`keyOutputLines=3`、`logRef='host-logs/T-001.log'`）；`--fail-tool-no-refs` 只报 `command` + `exitCode`，其余两项**不得出现在帧里**（由 WP-7 存 `null`、WP-6 渲染「未提供」）。`tool_call.title` 恒为既有 `write`（或 `--slow-tool` 值），**不得**塞命令行；`tool_call_update.status` 为 `failed`（非零退出语义），但 `stopReason` 仍按既有『成败只由产出核对裁决』口径保持 `end_turn`，不新增失败码。**转达 WP-7**：在 `handleUpdate` 内按帧名把 `execution` 合并进会话级待写摘要缓存，缺项为 `null`，不得依赖适配器归一化结果；`--fail-tool-no-refs` 的缺失字段不得用工具名/默认值补齐 |
| 影响面 | WP-5 夹具帧结构与 `test/wp9/i19-fixture.test.js`、WP-7 `handleUpdate` 提取段、AC-04/05/24/26 取证口径；不改需求正文、拆分文档与附录 A 任何逐字基线 |

## D-9 · `SUMMARY_LOG_LINE` 占位符切分与通配族展开名（WP-4 开放点）

| 项 | 内容 |
|---|---|
| 触发点 | WP-4 按 A-1~A-14 逐字基线自行展开 `TRACE_*` / `SUMMARY_*` 通配族为具名导出（`TRACE_HEADER` / `TRACE_SPAN` / `TRACE_BACKFLOW_ROW` / `SUMMARY_LABEL` / `SUMMARY_FAIL_LINE` 等 23 个），`SUMMARY_LOG_LINE` 含 `{ts} {layer} {sessionId}` 前缀占位 |
| 依据 | A-9 只给通配族、未点名成员，归属只要求 `labels.js`；A-12/A-14/A-8 锁定的是**渲染结果逐字**，占位符切分与内部键名属实现自由（附录 D 不进入需求判定）；WP-4 已逐字断言 A-12/A-14/A-13 填充结果 |
| 决定 | **以 WP-4 实际导出名为冻结契约**（清单见 `review-wp2-wp4.md` 与 `src/cli/labels.js:793-882`），不追加别名、不改键名。**转达 WP-6**：按实际导出名引用，渲染结果必须与 A-1~A-14 逐字一致；若发现缺键，书面报主控裁决，不许在 `render.js` 里补中文硬编码。`SUMMARY_FAIL_LINE` 行首两个半角空格以 A-4 原文为准，WP-6 渲染时逐字核 |
| 影响面 | WP-6 全部渲染函数；S3 验收的逐字比对；不改附录 A 基线 |

## D-11 · `renderTraceShow` payload 冻结契约（WP-6 → WP-8）

| 项 | 内容 |
| 触发点 | 拆分 §2.9 只冻结 `renderTraceShow(payload)` 的签名，未冻结 `payload` 形状；WP-8 需从 `instance.trace` RPC 与 `instance.get` 快照组装，形状不冻结会两端各自猜 |
| 依据 | WP-6 实现回执 §3（逐字段契约）；设计目标是「WP-8 组装成本最低」——payload 必须能由 `instance.trace` 的 `{ traceId, spans, badLines }` 加 `instance.get` 的 state / graph 直接组装，不要求 WP-8 做复杂推导；附录 D 不进入需求判定，payload 属实现自由 |
| 决定 | **以 WP-6 回报的形状为冻结契约**：`{ instanceId, exists, traceId, spans, backflows, badLines }`。`spans[] = { start_time, end_time\|null, node_id, title\|null, result, handoff_ids[], summary\|null }`；`backflows[] = { round, from, to, handoff, state }`；`spans[].result` / `backflows[].{from,to,state}` 与 `summary` 四项的中文/数据显示值**由 WP-8 组装时从 `labels.js` 既有表与图 title 传入**（`render.js` 零中文硬编码）。语义固定：`exists===false` → A-5；`traceId` 空且 `spans` 空 → A-1；`end_time===null` 为进行中（`—` / `进行中`、**不计入**汇总跨度数）；`badLines>0` 提示行在汇总行**之前**；输出结构恒为「头 → [降级提示] → 汇总 → 空行 → 跨度行（+可选失败摘要）→ 空行 → 回流链标题 → 无 / N 行回流」。**转达 WP-8**：按此形状组装，不得让 `renderTraceShow` 去读盘或写状态 |
| 影响面 | WP-8 `instance.trace` 的组装与 `trace show` 命令；AC-06/07/08/09/10/22/23 取证；不改附录 A 任何逐字基线 |

## D-12 · 健康度原因句占位符实参来源（WP-6 阻断缺陷，打回修复）

| 项 | 内容 |
| 触发点 | 主控独立复核发现**实质缺口**：`src/core/health.js` 按需求 D-3 L964 / L969 返回**纯码值数组** `reasons: string[]`（A-8 JSON 示例亦为 `["pending_escalation"]`，WP-3 的 32 个用例已冻结该形状）；但 `labels.js` 的 `HEALTH_REASON` 模板带 `{nodeId}` / `{sessionId}` / `{role}` / `{connection}` / `{handoffId}` 占位符，而 `src/cli/render.js:140-145` 的 `replaceAll` 对缺失变量填**空串**。WP-6 首版 `healthReasonSentences` 只在 `reasons` 元素是 `{code,...实参}` **对象**时才填得进实参，用真实 `computeHealth` 输出时会把 A-6 附的 `节点 T-001 执行超时` 渲染成 `节点  执行超时`。WP-6 的 A-6 附 8 行测试**全部靠测试夹具传对象**通过，未覆盖真实形态，属取证失真；AC-13/14/15 逐字判据会全挂 |
| 依据 | 优先级 `AC 的 Then/And > 附录 A 输出基线 > 附录 D`：**A-6 附 8 行是用户可见逐字判据**，必须命中；D-3 L964「`reasons` 为固定顺序的原因码数组」与 A-8 JSON「`detail.reasons` 码值数组」都是冻结契约，**不得**把 `reasons` 改成对象数组（会破坏 WP-3 已收口签名、32 个用例与 A-8 JSON）。核心侧不得产出中文（D-6 中文唯一来源 `labels.js`）。因此桥只能由**渲染层从快照既有字段推导实参**完成 |
| 决定 | ①**纯码值数组不变**：`state.health.reasons` 与 `health.changed.detail.reasons` 恒为 `string[]`，WP-7 不得改成对象数组，WP-3 不改。②**打回 WP-6 修复**：`renderHealthLine(snapshot, now)` 与 `status-text.js` 的 `healthDocLine(state)` 必须实现「按码从快照推导占位符实参」的纯函数，两处规则一致、零中文硬编码（角色中文取 `labels.js` 既有 `ROLE_LABEL`，节点 / 会话 / 交接标识取快照既有字段）。推导表：`node_timeout` / `p90_exceeded` → 首个 `state==='running'` 节点的 `nodeId`；`session_crash` → 首个 `quarantined===true` 会话的 `sessionId`；`role_unavailable` → 首个 `state==='escalated'` 且未隔离会话绑定节点的角色中文；`connection_rejected` / `connection_expired` → 对应状态交接包的 `来源角色→去处角色`（A-6 附形如 `测试→开发`）；`handoff_ttl_half` → 待投递交接包的 `handoffId`；`pending_escalation` 无占位符。**允许**优先读可选的 `health.reasonVars?.[code]`（若 WP-7 提供），缺失时走上述推导。③**必须补真实快照测试**：用「`reasons` 为纯码值数组」的快照逐字覆盖 A-6 附 8 行与多原因并列，不得只靠传对象夹具。④ `renderHealthEventLine(event)` 只有事件对象、无快照：A-8 / AC-16 判据只用 `pending_escalation`（无占位符），保持逐字；带占位符码在事件文本行允许从 `event.detail.reasonVars?.[code]` 取值，缺失时降级，登记为 `report.md` §5 已知边界，不改 A-8 基线 |
| 影响面 | WP-6 两处渲染函数 + `test/wp9/i19-render.test.js`；WP-7 只需保持纯码值数组（**不增加**必做工作量）；AC-13/14/15/16 与 A-6 附取证；不改需求、拆分、附录 A 任何文字 |

## D-13 · WP-5 三个开放点裁决（批次 3 收口）

| 项 | 内容 |
| 触发点 | WP-5 回报 OP-2（`host-logs/T-001.log` 归属）、OP-3（新开关与既有分支的组合边界）、OP-4（`test/wp6/loop-fixture.test.js` 1 条失败） |
| 依据 | OP-2：AC-04 夹具原文「`host-logs/T-001.log` 由夹具预置在项目根、不在实例目录内」；AC-05「`host-logs/` 位于项目根之外」。OP-3：AC-04/05/26 的夹具命令行都不与 `--permission` / `--host-error` / `--hold-session` / `--session-missing` / `--turn-delay-ms` 取消组合，D-4 L979 只要求两个新开关；扩范围会改既有分支，违反「既有 12 开关逐字不变」红线。OP-4：`docs/iterations/iteration-7/baseline-failures.txt` **第 4 行**即 `cursor.json 并发消费 20 次不重复`，D-2 已裁决以「失败集合差集 = 0」判定 |
| 决定 | ①**OP-2 确认**：日志文件由 S3 验收脚手架在项目根预置，夹具只上报引用字符串、不创建文件、不复制正文，符合 AC-05「实例目录无完整日志副本」。②**OP-3 接受现有组合边界，不扩范围**：新开关只在主 prompt 路径正常完成阶段注入失败帧；既有提前 `return` 分支逐字保留。**转达 S3**：验收脚手架不得把 `--fail-tool*` 与上述开关组合；该边界登记进 `report.md` §5 已知边界。③**OP-4 判非缺陷**：属基线第 4 行既有失败（`cursor.lock` 5s 超时，两次复现稳定），按 D-2 差集口径处理，不放宽断言、不改测试。④ OP-1（转达 WP-7 按 D-10 合并 `execution`）已由 D-10 覆盖，不重复裁决 |
| 影响面 | S3 验收脚手架构造、`report.md` §5 遗留清单；不改任何代码与需求判据 |
