# I1.9 实现报告 — 三层日志 + 健康度计算

> **依据**：`docs/index.md` 第二部分 `#### I1.9`（行 828-836）+ 第一部分基线（§3 四层状态模型 / §5.2 数据布局 / §6 边界声明）。
> **需求**：`docs/iterations/iteration-9/requirement.md` **v7**（1060 行 / **27 AC** / 25 BR / 附录 A0~A14 + B1~B5 + C + D1~D11）。
> **拆分与契约**：`docs/iterations/iteration-9.md` **r2**（751 行 / **9 个 WP** / 23 个负责文件零交集 / AC→WP 27/27）。
> **验收记录**：`acceptance-a.md`（AC-01~14）、`acceptance-b.md`（AC-15~27）、`evidence/acc9/`（**27 个 AC 目录 / 255 份文件 / 34 份 `result*.json`**）。
> **评审记录**：S0 `review-round1..7.md`（round7 PASS）；S1 `split-review.md`（PASS）；S2 `review-wp1-wp3.md` / `review-wp2-wp4.md` / `review-wp5.md` / `review-wp6.md` / `review-wp7.md`（FAIL 1）→ `review-wp7-r2.md`（PASS + D-19 增量 PASS）/ `review-wp8.md` / `review-wp9.md`；S4 `final-verification.md`（PASS）。
> **环境**：macOS（darwin）/ Node 22 / 零第三方依赖；夹具统一 `--host mock` + `NODE_ENV=test` + `os.tmpdir()` 隔离根。
> **完成时间**：2026-11-12。

---

## 0. 总体结论

**达成退出标准。** 三层日志（事件链 / 执行摘要 / 追踪跨度）与健康度计算全部落地，`orch trace show` 可展开一次回流的跨角色因果链，健康度在实例读取时按真实时钟重算并写回元数据与 `status.md`，执行摘要能回答「这个节点为什么失败」；三条主链运行期输出逐字未变。

| 项 | 数值 |
|---|---|
| AC 判定 | **27 通过 / 0 不通过 / 0 阻塞** |
| 测试 | **1157 tests**（基线 1028，+129）；失败集合与基线 8 条**差集 = 0**（负载下额外时序失败逐文件复跑全绿，见 §5） |
| 架构扫描 | `purity-check.mjs` **exit 0**（24 文件，31 词零命中）；`dependencies` **0** |
| 回归红线 | `single` / `code-loop` / `task-loop` **实跑与 `322fb5e` 交替对照 A-0 归一化 diff = 0**；`USAGE_LINES` **25**；`grep -c "object: 'session'"` **13** |
| 阻断级缺陷 | **5 项**（D-12 / D-17 / D-25 / D-26 / D-27），全部修复并复验 |
| 终验 | `final-verification.md` **PASS** |

**最难的一条实测证据**：AC-08（规划验收①）——`--stop-after 3` 冻结窗口的 `orch trace show INST-001` 输出与附录 A-3 **逐字全等**（10 行、无多余行）：

```text
实例 INST-001 · 追踪 TRC-1fb42941
跨度 3 条 · 回流 1 次

04:43:02 → 04:43:04  T-001 开发  已完成  交接 HO-001
04:43:04 → 04:43:06  T-002 测试  失败  交接 HO-001 HO-002
04:43:07 → 04:43:08  T-001 开发  已完成  交接 HO-002

回流链
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

---

## 1. 交付物

### 1.1 产品代码（9 个文件，零第三方依赖）

| 文件 | 角色 | 关键内容 |
|---|---|---|
| `src/persistence/paths.js` | 路径唯一计算点 | 新增 `instanceStateDir` / `instanceTracesPath`（既有函数体零改） |
| `src/core/trace.js` | 追踪落盘基座（185 行） | `newTraceId` / `appendSpan`（严格 7 字段、不落 `handoff_ids`）/ `readTraces`（坏行跳过计数）/ `deriveHandoffIds`（读取时推导、冻结窗口不漏 `HO-002`）/ `overlayRunningSpans` |
| `src/core/health.js` | 健康度纯函数（202 行） | `computeHealth({state, graph, traces, now})`；四档 `normal/slow/attention/ended`；8 原因码固定顺序；严格大于边界；P90 样本 <5 不触发；不读盘、不迁状态 |
| `src/core/event-bus.js` | 链式哈希 | `emit` 从同一次尾读取 `seq` + `prevHash`；`replay` 恒返回数组并附非枚举 `badLines` |
| `src/persistence/instance-store.js` | 规范化哈希 + 尾读 | `canonicalize` / `hashRecord` / `readTailForChain`（末行坏则前溯、整份损坏重起链） |
| `src/cli/labels.js` | 中文唯一来源 | 末尾 +90 行 / 23 个导出（健康度、追踪、摘要、跳过行）；`USAGE_LINES` 25 行零改 |
| `src/cli/render.js` | 渲染纯函数 | 新增 `renderHealthLine` / `renderTraceShow` / `renderSummaryLogLine` / `renderHealthEventLine` / `renderEventsSkippedLine`；`renderEventLines` 仅加一个 `reason` 分派分支 |
| `src/core/status-text.js` | `status.md` | `- 状态：…` 后插一行 `- 健康度：…`；`CORE_TEXT.doc.health` 镜像 `labels.js` |
| `src/core/orchestrator.js` | 核心集成（+224） | `newState` 追加 `health` / `traceId`；`saveState` 只透传健康度（不读盘、不自算）；`handleUpdate` 摘要四要素提取；三收尾共享 `writeExecutionSummary`（每会话恰 1 条）；节点收尾 `appendNodeSpan`；`getStatus` 读取时重算 + 首次补写不发事件 + 档位变化一次窄 CAS + `health.changed` |
| `src/cli/main.js` | CLI 命令面 | `trace show`（D-11 payload 组装）、`instance status` 健康度行、`instance log` 两类 reason 分派 + A-13 跳过行 |
| `src/daemon/server.js` | 只读接口 | `instance.trace`（`{traceId, spans, badLines, view}`）、`instance.events` 透出 `badLines` |

> 表内 12 行含 `src/persistence/paths.js` 等；`src/**` 本迭代实际改动/新增共 **11 个文件**（含 WP 之外的 0 个）。

### 1.2 测试与夹具

| 类型 | 数量 |
|---|---|
| 新增契约测试 | `i19-trace` 6 / `i19-chain` 7 / `i19-health` 32 / `i19-labels` 14 / `i19-fixture` 8 / `i19-render` 31 / `i19-orchestrator` 10 / `i19-cli` 13 / `i19-regression` 8 |
| 修改既有测试 | `status-doc.test.js`（按 D-8 两处整份文本 +1 行）、`rpc.test.js`（AC-57 期望 8→9 条，D-27）、`cli-e2e.test.js`（**零改动**，D-21） |
| 夹具 | `test/fixtures/mock-acp-agent.js` 新增默认关闭的 `--fail-tool` / `--fail-tool-no-refs`（全在 `failToolMode` 守卫内） |

### 1.3 验收产物

`evidence/acc9/AC-01 … AC-27/`（255 份文件，每条 AC 均有 `result.json` 与原始 stdout / state / events / traces 帧）、`probe/acc9-a-*.mjs`（9 个）、`probe/acc9-b-*.mjs`（7 个），均可复跑。

---

## 2. AC 逐条判定

| AC | 标题 | 判定 | 证据 |
|---|---|---|---|
| AC-01 | 事件日志只追加：旧行不变、序号不复用 | PASS | `AC-01/` |
| AC-02 | 链式哈希：每条记录接上前一条的指纹 | PASS | `AC-02/` |
| AC-03 | 回归红线：三条主链运行输出逐字不变 | PASS | `AC-03/`（`full-suite-r2.log` + 交替对照 diff） |
| AC-04 | 执行摘要四要素：失败节点当场回答「为什么失败」 | PASS | `AC-04/` |
| AC-05 | 摘要边界：只存摘要与引用，缺项显示「未提供」 | PASS | `AC-05/` |
| AC-06 | 追踪跨度：追踪号、起止、结果、交接包齐全 | PASS | `AC-06/` |
| AC-07 | 回流链按轮次展开：同一节点多轮不合并、不覆盖 | PASS | `AC-07/` |
| AC-08 | 规划验收①：`trace show` 展开一次回流的跨角色因果链 | PASS | `AC-08/`（`trace-after-fix.txt`） |
| AC-09 | 追踪的三种空形态 | PASS | `AC-09/` |
| AC-10 | 追踪只读：重复执行不改状态、不追加事件 | PASS | `AC-10/` |
| AC-11 | 健康度 🟢 正常 | PASS | `AC-11/` |
| AC-12 | 健康度 ⚪ 已结束：终态优先 | PASS | `AC-12/` |
| AC-13 | 健康度 🔴 五类条件（六夹具）矩阵 | PASS | `AC-13/` |
| AC-14 | 健康度 🟡 超过 P90：样本、阈值与边界 | PASS | `AC-14/` |
| AC-15 | 健康度 🟡 连接线待投递超过 TTL 50% | PASS | `AC-15/` |
| AC-16 | 规划验收②：健康度在状态变化后更新并进事件日志 | PASS | `AC-16/`（机制用受控快照取证，见 §5） |
| AC-17 | 健康度写入实例元数据，两个用户面可见 | PASS | `AC-17/` |
| AC-18 | 健康度只读：不改节点/会话/交接包、不触发升级 | PASS | `AC-18/` |
| AC-19 | 既有状态输出不回归：只允许新增一行健康度 | PASS | `AC-19/` |
| AC-20 | 非功能：零依赖、中文唯一来源、纯净扫描、无宿主分支 | PASS | `AC-20/` |
| AC-21 | 事件链历史兼容：旧记录无标记、末行截断仍可续链 | PASS | `AC-21/` |
| AC-22 | 进行中的跨度：`进行中` + 结束位 `—` | PASS | `AC-22/` |
| AC-23 | 追踪异常：文件缺失 / 单行损坏 / 缺时间字段 | PASS | `AC-23/`（`*-after-d26-r2.*`） |
| AC-24 | 会话审计粒度：逐条状态不进主审计，摘要回答「为什么结束」 | PASS | `AC-24/` |
| AC-25 | 事件链整份不可解析：重起链、序号从 1、旧行保留 | PASS | `AC-25/` |
| AC-26 | 取消收尾的执行摘要 | PASS | `AC-26/` |
| AC-27 | 同一节点多轮：每轮各一条摘要 | PASS | `AC-27/` |

**证据分级**：27 条均为「真实核心 + 真实 CLI 进程级」；AC-13/14/15 的等值边界按需求下沉到 `test/wp12/health.test.js` 单元级（32/32）；无「阻塞」。

---

## 3. 验收中发现并修复的缺陷

| # | 现象 | 根因 | 修法 | commit | 复验 |
|---|---|---|---|---|---|
| **D-12** | A-6 附 8 行原因句渲染成 `节点  执行超时`（双空格） | `computeHealth` 返回**纯码值** `reasons: string[]`，而 `HEALTH_REASON` 模板带 `{nodeId}` 等占位符，`replaceAll` 缺参填空串；首版测试**全靠传对象夹具**通过（取证失真） | 纯码值数组不变；渲染层从快照既有字段推导占位符实参（`renderHealthLine` 与 `healthDocLine` 同一套规则）；补「真实 `computeHealth` 输出 + 真实快照」逐字用例 | `efbc658` | A-6 附 8 行逐字全命中，CLI 与 `status.md` 一致 |
| **D-17** | `task-loop` 主链稳定少一行 `会话 已升级`（基线 4/5 → 当前 0/5；交替 6 对基线 6/6 → 当前 1/6） | `saveState` 每次保存新增一次 `await trace.readTraces + computeHealth`，异步时序把短命会话态挤出 CLI 轮询窗口 | `saveState` 降级为只透传已有 `state.health`（不读盘、不自算），`computeHealth` 集中到 `getStatus` 读取时执行 | `83833fa` | 交替 10 对 + 9 对：`single`/`code-loop` diff 0；`task-loop` 基线 6/9、当前 9/9（每对不低于基线） |
| **D-19 / OP-2** | AC-22 的 A-10 首行为 `实例 INST-001 · 追踪 `（号为空） | 追踪号只在首条跨度落地时生成，`state.json` 无号 | `newState` 追加 `traceId`，`appendNodeSpan` 与 `instance.trace` 优先取它；历史实例回落首条跨度 | `83833fa` / `f956580` | A-10 首行 `追踪 TRC-8f496e5c` 与 `state.traceId` 一致 |
| **D-25** | AC-08 输出比 A-3 多一行 `  失败摘要 命令 未提供 · …` | A-3 的失败跨度摘要四项**全 `null`**，而实现无条件渲染 | 四项至少一项非 `null` 才渲染；`instance log` 的 A-14 不受影响 | `0af69d8` | A-3 逐字 10 行全等；A-4 / A-14 仍逐字命中 |
| **D-26** | AC-23 `missing`（删追踪文件）输出 `TRC-xxx / 跨度 0 条`，非 A-1 | `hasTrace = traceId 存在 \|\| 跨度非空`，D-19 后永真 | `hasTrace` 改为只看跨度数组（含进行中叠加）非空 | `0af69d8` | `missing` → A-1；AC-22 的 A-10 未误伤 |
| **D-27** | 全量出现确定性失败：AC-57 期望 8 条实际 9 条 | 取消路径新增 `execution.summary`（AC-26 要求），旧断言写于摘要功能之前 | 期望更新为 9 条并按真实 `detail` 断言；不改成过滤或 `>=` | `0af69d8` | `rpc.test.js` 8/8，全量差集回归 0 |

**独立评审发现的阻断**：D-17（`review-wp7.md` FAIL 1）。**主控复核发现的阻断**：D-12（WP-6 首版）。**实现者上报的缺口**：D-19（WP-8 OP-2）。**验收发现的缺陷**：D-25 / D-26 / D-27。

---

## 4. 门禁与复现

```bash
# 1) 全量测试（预期：1157 tests；失败集合与基线差集 = 0，见 §5）
cd /Users/xuesh/www/Maestro && NODE_ENV=test node --test "test/**/*.test.js"

# 2) I1.9 契约测试（预期全绿）
node --test "test/wp9/**/*.test.js"        # 119
node --test test/wp11/status-doc.test.js test/wp11/rpc.test.js
node --test test/wp12/health.test.js       # 32

# 3) 冻结门禁（预期：0 / 25 / 13 / exit 0）
node -p "Object.keys(require('./package.json').dependencies||{}).length"
node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))"
grep -c "object: 'session'" src/core/orchestrator.js
FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"

# 4) 三条主链（隔离根 + mock 宿主；预期 single exit 0 / code-loop exit 4 suspended / task-loop exit 4 suspended）
ROOT=$(mktemp -d); mkdir -p "$ROOT/.orch/hosts"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1]+"/.orch/hosts/mock.json",JSON.stringify({transport:"stdio",launch:{command:process.execPath,args:[process.argv[2]]},limits:{initializeTimeoutMs:8000,requestTimeoutMs:8000,promptTimeoutMs:8000,quietIdleMs:30,quietCapMs:200}},null,2))' "$ROOT" "$PWD/test/fixtures/mock-acp-agent.js"
cd "$ROOT" && NODE_ENV=test node /Users/xuesh/www/Maestro/bin/orch.js run --cwd . --template single --host mock --task "写一份说明"

# 5) 追踪与健康度（预期 A-2 / A-10 / A-1 三种形态）
node bin/orch.js trace show INST-001
node bin/orch.js instance status INST-001
```

**验收脚手架复跑**：`NODE_ENV=test node probe/acc9-a-reverify.mjs`（A 组复验）、`probe/acc9-b-*.mjs` 逐条。

---

## 5. 遗留问题与边界

| # | 项 | 影响范围 | 为何不阻断 |
|---|---|---|---|
| L-1 | **全量非字面全绿**：本机两次全量分别 `13 fail` / `17 fail`，除基线 8 条外的失败逐文件复跑全绿且两次集合不同 | 环境 | 本机累积大量 `orch core serve` 残留进程（S3 观测到 723 个，其中 411 个项目目录已删除）造成负载型时序 flake；D-2 口径为「失败集合差集 = 0」，且 A-0 三链对照独立证明产品无回归。建议后续迭代给夹具加 `finally { core stop }` 卫生改造 |
| L-2 | **AC-16 真实场景 `health.changed` = 0 条** | 事件可见性 | `orch run` 收尾的 `getStatus` 已完成首次补写（`firstWrite` 按 D-7 不发事件），此后档位恒定；机制由受控快照证明「normal → attention 恰一次 CAS + 一条事件」。AC-16 的 Then 不要求事件条数 |
| L-3 | **追踪号生成时机**：字面「实例创建时」由 D-19 落地为「`newState` 生成并随快照持久化」；历史实例回落「首条已落地跨度」 | 老实例升级 | 空跨度且无进行中节点的旧实例按 A-1（D-23/D-26）；有跨度则号一致 |
| L-4 | **取消摘要不传 `ts`**（D-15） | 事件链 | 取消无单一状态变更时刻；传提前时刻会造成链 `ts` 倒退（曾致 2 条真实回归）。链单调由 `seq` / `prev_event_hash` 保证 |
| L-5 | **`instance.trace` 异常路径会写 `state.json.corrupt` 备份**（WP-8 评审 S-2） | 损坏快照 | 正常路径零写盘已复核；AC-10 只针对正常实例 |
| L-6 | **`main.js` 未知参数文案沿用基线既有中文硬编码**（S-3） | 代码风格 | 该文案在基线中本就不在 `labels.js`，改动会扩大范围且改变错误输出 |
| L-7 | **`trace show` 的失败摘要只在有数据时渲染**（D-25） | 输出形态 | A-3 无该行、A-4 有该行，只能按数据区分；`instance log` 的 A-14 仍强制显示四项「未提供」 |
| L-8 | **`single` 无 `edge` 交接包在组装层按轮次归属**（D-20） | 追踪展示 | 只归属已存在的交接包编号，不虚构；有 `edge` 的图仍走 `deriveHandledIds` |
| L-9 | **`object: 'session'` 计数**：`orchestrator.js` 13、`src/core` 合计 14（含 `escalation.js` 存量 1）（D-24） | 审计粒度 | AC-24 冻结命令是单文件计数；`escalation.js` 那处为既有升级事件 |
| L-10 | **`PROGRESS` 遗留文件**：`.workbuddy/memory/*`、`docs/iterations/regression-2026-11-09*` 未纳入 I1.9 提交 | 仓库卫生 | 均为本迭代开始前的历史遗留（D-16 ④），与本迭代无关 |

---

## 6. 与前序迭代的关系

- **复用**：I1.7 的 `transit()` + CAS（`{state, halted, rev}`、`rev` 基于磁盘现值递增）、事件先落盘再广播、`includeBranch` 三视图隔离、mock 宿主同一装配链（`.orch/hosts/mock.json`）。
- **改动的契约**：
  - `newState` 新增 `health: { nodeTimeoutMs: 30000 }` 与 `traceId`（前者仅新增字段，后者由 D-19 落地）；
  - 事件记录新增 `prev_event_hash` 字段（旧记录不回填，读取时按「末行坏则前溯」续链）；
  - `replay` 返回值从「纯数组」变为「数组 + 非枚举 `badLines`」（D-6，保持既有解构兼容）；
  - `instance status` 新增一行健康度；`instance log` 新增两类行的分派（行格式与相对顺序零改）。
- **回归保证**：三条主链以 `322fb5e` 为基线的**交替对照 + A-0 归一化逐字 diff** 判定（D-17 ⑥），而非单次运行；`instance graph` 文本与 JSON 字节比对不变；`USAGE_LINES` 25 行、`grep -c "object: 'session'"` 13 全程守住；31 词纯净扫描 exit 0。
- **对下游的接口**：I1.10a 的实例列表与流程图可直接消费 `state.health`（`level` / `reasons` / `computedAt` / `nodeTimeoutMs`）与 `instance.trace`（`{traceId, spans, badLines, view}`）；健康度**不参与路由**（D-1），下游不得据此改状态机。

---

## 附录：命令速查

```bash
node --test "test/wp9/**/*.test.js"                       # I1.9 契约测试
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "<31 词>"
node bin/orch.js trace show INST-001                      # A-1/A-2/A-3/A-10/A-11
node bin/orch.js instance status INST-001                 # 多一行健康度
node bin/orch.js instance log INST-001 [--format json]    # 摘要 / 健康度 / 跳过行
node test/fixtures/code-loop-driver.mjs --root <tmp> --scenario backflow-once --stop-after 3 --keep
node test/fixtures/task-loop-driver.mjs --root <tmp> --scenario dispatch-fail-first
```
