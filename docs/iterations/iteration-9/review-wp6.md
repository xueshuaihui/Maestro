# I1.9 S2 批次 3 · WP-6 独立实现评审

> **独立评审声明**：本评审未参与 WP-6 实现，干净上下文、与实现者分离；不采信作者自述 / 回执 / 自带测试脚本，全部关键行为自己写 `/tmp/wp6-review/*.mjs` 独立复算与跑门禁。唯一写入文件为本报告；未改任何产品代码 / 测试代码、未 `git commit`。
> **判据不放宽**：`decisions.md` 的 D-7 / D-8 / D-9 / D-11 / D-12④ / D-13 为主控已裁决事项，按裁决接受，不重新升格为阻断；附录 A-0~A-14 逐字基线、回归红线、门禁数字一律按原口径执行，未删断言、未改期望值、未改判据。
> **临时脚本**：全部落在 `/tmp/wp6-review/`（`d12.mjs`、`a-coverage.mjs`、`d789.mjs` / `d789b.mjs`、`d11.mjs` / `d11b.mjs`、`regression.mjs`、`openpoints.mjs`），不在仓库内。

---

## §1 评审范围与判据来源

### 1.1 评审对象（作者首版 + D-12 修复版，一律独立实跑复核）

| 文件 | 状态 | 实得行数 |
|---|---|---|
| `src/cli/render.js` | 改 | 2226（HEAD 1983） |
| `src/core/status-text.js` | 改 | 427（HEAD 342） |
| `test/wp9/i19-render.test.js` | 新建（untracked） | 722 |
| `test/wp11/status-doc.test.js` | 改（D-8 两处） | — |

**基线对照方式**：`git show HEAD:src/cli/render.js` / `git show HEAD:src/core/status-text.js` / `git show HEAD:test/wp11/status-doc.test.js` 落到 `/tmp/wp6-review/head-render.mjs`、`/tmp/wp6-review/headpkg/src/core/head-status-text.mjs`、`/tmp/wp6-review/status-doc.diff.txt`；HEAD 模块副本（`head-render.mjs` 配 `/tmp/wp6-review/labels.js`、`head-status-text.mjs` 配 `headpkg/src/cli/labels.js`）可直接 `import` 实跑，用于 §2.5 的逐字 diff。所有 `git diff HEAD -- <file>` 输出已逐行核。注：`git diff` 输出中的 `[m` 为终端 ANSI 伪影，脚本实测 `status-text.js` 控制字符字节数 = **0**。

### 1.2 判据来源（先自己读）

1. `docs/iterations/iteration-9/requirement.md`：附录 A-0~A-14 全文（L540-795，逐字基线）、D-3（L961-970）、D-5（L981-989）、D-6（L991-1001）。
2. `docs/iterations/iteration-9.md`：§2.7（L189-193）、§2.9（L201-206）、WP-6 段（L473-479）、§2.14（L238-239）、§8 C-06（L731）/ C-13（L738）。
3. `docs/iterations/iteration-9/decisions.md`：D-7（L83-90）、D-8（L92-99）、D-9（L109-116）、D-11（L118-124）、D-12（L126-132）、D-13（L134-140）；`review-wp2-wp4.md` 的 F-01（L245-247）。
4. `src/cli/labels.js:794-882`（WP-4 冻结的 23 个实际导出名）、`src/core/health.js`（已收口的 `computeHealth`，`reasons: string[]`）、`src/cli/labels.js:77-85`（`ROLE_LABEL`）。
5. `docs/iterations/iteration-9/review-wp5.md`（并行 WP-5 评审，仅了解批次上下文，**不作本 WP 判据**）。

### 1.3 基线 / 环境

`package.json` `type=module`；`Object.keys(dependencies||{}).length = 0`。以下 8 个文件 `git diff HEAD -- <file>` 行数均为 **0**（零改）：`src/cli/labels.js`、`src/core/health.js`、`src/core/trace.js`、`src/core/event-bus.js`、`src/core/orchestrator.js`、`src/cli/main.js`、`src/daemon/server.js`。

---

## §2 逐项独立验证记录（原始证据）

### 2.1 【最高优先级】D-12 阻断缺陷是否真正闭合（脚本 `/tmp/wp6-review/d12.mjs`）

**方法**：不复用作者任何 helper / 测试。自构造真实 `nodes` / `sessions` / `handoffs` 快照（每个 case 只让一条目标码命中，其余红黄条件全部避开）→ 调 `computeHealth({ state, graph:null, traces, now })`（注入固定 `now=1_760_000_000_000`）→ 得到 `reasons`（逐条断言为纯码值 `string[]`，**未改成对象数组**）→ 写回 `state.health = { ...state.health, level, reasons }` → 分别喂 `renderHealthLine(state, now)` 与 `renderStatusDoc(state, null, {})`。8 行逐字基线**从 `requirement.md` 的 A-6 附代码围栏按标题解析**（不手抄），并逐行校验 `md.includes(基线)`。

**独立脚本打印的 8 行实得（原文）**：

```
健康度 需关注 · 有待处理升级
健康度 需关注 · 节点 T-001 执行超时
健康度 需关注 · 会话 mock-sess-12345-1 崩溃
健康度 需关注 · 角色 开发 不可用
健康度 需关注 · 连接线 测试→开发 已拒绝
健康度 需关注 · 连接线 测试→开发 已过期
健康度 慢 · 节点 T-006 执行超过本实例 P90
健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半
```

**逐行原始证据（节选 8 行完整输出）**：

```
--- [1/8] pending_escalation ---
computeHealth -> level=attention reasons=["pending_escalation"]
  [ ok ] reasons 是 string[]（未被改成对象数组）
  [ ok ] 本 case 恰好命中 pending_escalation
renderHealthLine     -> "健康度 需关注 · 有待处理升级"
renderStatusDoc 行   -> "- 健康度：需关注 · 有待处理升级"
A-6 附基线          -> "健康度 需关注 · 有待处理升级"
  [ ok ] CLI 行逐字命中 A-6 附第 1 行
  [ ok ] status.md 行 = '- 健康度：' + CLI 行体（两处逐字一致）
  [ ok ] requirement.md 含该逐字基线
  [ ok ] 无中文双空格降级
--- [2/8] node_timeout ---    computeHealth -> ["node_timeout"]
  renderHealthLine -> "健康度 需关注 · 节点 T-001 执行超时" / doc "- 健康度：需关注 · 节点 T-001 执行超时"
--- [3/8] session_crash ---  computeHealth -> ["session_crash"]
  renderHealthLine -> "健康度 需关注 · 会话 mock-sess-12345-1 崩溃"
--- [4/8] role_unavailable --- computeHealth -> ["role_unavailable"]
  renderHealthLine -> "健康度 需关注 · 角色 开发 不可用"
--- [5/8] connection_rejected --- computeHealth -> ["connection_rejected"]
  renderHealthLine -> "健康度 需关注 · 连接线 测试→开发 已拒绝"
--- [6/8] connection_expired --- computeHealth -> ["connection_expired"]
  renderHealthLine -> "健康度 需关注 · 连接线 测试→开发 已过期"
--- [7/8] p90_exceeded ---   computeHealth -> level=slow reasons=["p90_exceeded"]
  renderHealthLine -> "健康度 慢 · 节点 T-006 执行超过本实例 P90"
--- [8/8] handoff_ttl_half --- computeHealth -> level=slow reasons=["handoff_ttl_half"]
  renderHealthLine -> "健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半"
```

（8 个 case 的 `computeHealth` 均返回 `level=attention`（前 6）/ `level=slow`（后 2），`reasons` 均为单元素纯字符串数组；两处渲染逐行一致；每行均通过「无 `/节点  |会话  |角色  |连接线  |交接包  /` 双空格降级」检查。脚本 `D-12 结论：FAIL=0`。）

**多原因并列（真实 `computeHealth` 输出，非自造对象）**：

```
A-6 示例 2 码 computeHealth -> ["pending_escalation","node_timeout"]
renderHealthLine -> "健康度 需关注 · 有待处理升级 · 节点 T-001 执行超时"   [ ok ] 命中 A-6 示例
6 红码 computeHealth -> ["pending_escalation","node_timeout","session_crash","role_unavailable","connection_rejected","connection_expired"]
renderHealthLine -> "健康度 需关注 · 有待处理升级 · 节点 T-001 执行超时 · 会话 mock-sess-12345-1 崩溃 · 角色 开发 不可用 · 连接线 测试→开发 已拒绝 · 连接线 测试→开发 已过期"
  [ ok ] = HEALTH_REASONS 前 6 项（固定顺序）  [ ok ] 逐字命中  [ ok ] 两处逐字一致
2 黄码 computeHealth -> ["p90_exceeded","handoff_ttl_half"]
renderHealthLine -> "健康度 慢 · 节点 T-006 执行超过本实例 P90 · 交接包 HO-006 待投递超过 TTL 一半"
```

`health.js` 的 `HEALTH_REASONS` 实跑顺序 = `pending_escalation / node_timeout / session_crash / role_unavailable / connection_rejected / connection_expired / p90_exceeded / handoff_ttl_half`，与 D-3 L968 一致（8 码不重排）。

**结论**：D-12 阻断缺陷**真正闭合**。8 行逐字全命中，`reasons` 保持纯码值 `string[]`，无 `节点  执行超时` 双空格降级，两处输出逐字一致，多原因按 8 码固定顺序用 ` · ` 连接。作者 `i19-render.test.js:577-584` 亦含真实 `computeHealth` 纯码值快照用例（本评审独立复算通过），「只测自造对象数据」的取证失真已修复。

### 2.2 A-1 ~ A-14 逐字覆盖（脚本 `/tmp/wp6-review/a-coverage.mjs`）

自构造 payload 调 `renderTraceShow` / `renderSummaryLogLine` / `renderHealthEventLine` / `renderEventsSkippedLine` / `renderHealthLine` / `renderStatusDoc`；每条期望文本再用 `md.includes(expected)` 反查 `requirement.md`，避免手抄误差。时刻按 A-0 用本地时区 `new Date(2026,10,10,h,m,s).getTime()` 回填，`formatClock` 恒为 `HH:MM:SS`。脚本 `A-1~A-14 结论：FAIL=0`。逐条实得：

| 项 | 实得（关键行） | 逐字命中 |
|---|---|---|
| A-1 | `"实例 INST-001 · 暂无追踪记录"`（traceId 空 / null 两形态） | ✅ |
| A-2 | 整份 `"实例 INST-001 · 追踪 TRC-1a2b3c4d\n跨度 1 条 · 回流 0 次\n\n10:00:00 → 10:02:10  T-001  已完成  交接 HO-001\n\n回流链\n无"` | ✅ 末尾「回流链」+「无」两行 |
| A-3 | 整份 3 跨度 + `"跨度 3 条 · 回流 1 次"` + `"第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成"` | ✅ 无进行中行、跨度行=3 |
| A-4 | `"  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log"` | ✅ 行首 2 个半角空格（`/^ {2}\S/` true、非 3 空格）；缺项 `"  失败摘要 命令 未提供 · 退出码 1 · 关键输出 未提供 · 日志 未提供"` |
| A-5 | `"实例 INST-999 · 不存在"` | ✅ |
| A-6 四组 | `"健康度 正常"` / `"健康度 慢 · 节点 T-002 执行超过本实例 P90"` / `"健康度 需关注 · 有待处理升级"` / `"健康度 已结束"` | ✅ |
| A-6 附 8 行 | 见 §2.1 | ✅ |
| A-7 | `"- 状态：运行中\n- 健康度：需关注 · 有待处理升级\n- 暂停：否"`，`single` 不含 `## 节点` | ✅ |
| A-8 | `"10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级"` | ✅ 行首时刻 + 2 半角空格由渲染层补（`HEALTH_EVENT_LINE` 不含 `{ts}`，F-01 已闭合） |
| A-10 | 整份 `"跨度 0 条 · 回流 0 次"` / `"10:00:00 → —  T-001  进行中  交接 HO-001"` / 「回流链」+「无」，不含「暂无追踪记录」 | ✅ |
| A-11 | 前 3 行 `"实例 INST-001 · 追踪 TRC-1a2b3c4d"` / `"追踪记录有 1 行不可读，已跳过"` / `"跨度 2 条 · 回流 0 次"` | ✅ 提示行在汇总行之前；`badLines=3` 且无追踪时按 A-1 不出现提示（补测） |
| A-12 | `"10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log"` | ✅ 与 `SUMMARY_LOG_LINE` 模板填充逐字一致 |
| A-13 | `"已跳过 1 行不可读记录"` / `"已跳过 3 行不可读记录"` | ✅ 单独成行、无时刻前缀、与 A-11 措辞不混用 |
| A-14 | `"10:03:00  会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供"` | ✅ 与 A-12 同一 `SUMMARY_LOG_LINE` 模板、四项全「未提供」 |

重点项逐条核：A-2/A-10 末尾「回流链」+「无」两行（整份输出断言）✅；A-3 第 2 轮行 / 3 条跨度无进行中行 ✅；A-4 行首 2 半角空格 / 缺项「未提供」 ✅；A-8 时刻 + 2 半角空格 ✅；A-11 提示行在汇总行之前 ✅；A-13 单独成行无时刻 ✅；A-12/A-14 同一行模板、A-14 四项全「未提供」 ✅。

### 2.3 D-7 / D-8 / D-9 落实（脚本 `/tmp/wp6-review/d789.mjs` + `d789b.mjs`）

```
===== D-9：WP-4 冻结的 23 个实际导出名逐一存在 =====
[ ok ] 23 个冻结名全部在 labels.js 导出 缺失=[]
[ ok ] 无 HEALTH_REASON_* 通配别名导出 实得=[]
[ ok ] src/cli/render.js 新增 import 名均为 labels.js 实际导出 缺失=[]
      新增=[HEALTH_LABEL,HEALTH_LINE,HEALTH_REASON,HEALTH_EVENT_LINE,LAYER_HEALTH,TRACE_HEADER,
            TRACE_EMPTY_LINE,TRACE_MISSING_LINE,TRACE_SUMMARY,TRACE_SPAN,TRACE_BACKFLOW_HEADER,
            TRACE_BACKFLOW_ROW,TRACE_NO_BACKFLOW,TRACE_RUNNING,TRACE_NO_END,TRACE_DEGRADED,
            SUMMARY_LABEL,SUMMARY_OUTPUT_LINES,SUMMARY_FAIL_LINE,SUMMARY_LOG_LINE,EVENTS_SKIPPED]
[ ok ] src/core/status-text.js 新增 import 名均为 labels.js 实际导出 缺失=[]
      新增=[ROLE_LABEL,LAYER_HEALTH,HEALTH_LABEL,HEALTH_LINE,HEALTH_REASON]
===== D-7：{layer} 取自 LAYER_HEALTH.health =====
[ ok ] render.js 用 LAYER_HEALTH.health（非 LAYER.health）
[ ok ] status-text.js CORE_TEXT.doc.health = LAYER_HEALTH.health
[ ok ] LAYER_HEALTH.health === 健康度
[ ok ] 既有 LAYER 表无 health 键（D-7 裁决，不改冻结表）
[ ok ] STATE_LABEL.health 指向 HEALTH_LABEL（同一张表）
===== D-8：HEALTH_REASON[code] 单表、8 码固定顺序 =====
[ ok ] HEALTH_REASON 恰 8 键 实得=[pending_escalation,node_timeout,session_crash,role_unavailable,
       connection_rejected,connection_expired,p90_exceeded,handoff_ttl_half]
[ ok ] 8 键顺序 = D-3:968 固定顺序（不重排）
[ ok ] 单表唯一入口：render.js 只查 HEALTH_REASON[code]（无 HEALTH_REASON_* 别名）
[ ok ] 单表唯一入口：status-text.js 只查 HEALTH_REASON[code]
[ ok ] HEALTH_LINE.sep 为 ` · `（拼接唯一分隔符）
```

**零中文硬编码扫描**（`d789b.mjs`，扫 `git diff -U0 HEAD` 的 `+` 新增行，先用状态机剥离 `//` 行注释与 `/* … */`/JSDoc 块注释，再查代码 / 字符串字面量残留 CJK；注释散文行数如实统计）：

```
--- src/cli/render.js ---
    diff '+' 新增行            = 243
    含中文的注释/JSDoc 行数      = 32  （散文，非用户可见输出）
    剥离注释后代码残留 CJK 行数  = 0
[ ok ] src/cli/render.js 新增代码/字符串字面量零中文硬编码
    HEAD 基线含中文注释行数      = 172  （既有风格对照）
--- src/core/status-text.js ---
    diff '+' 新增行            = 85
    含中文的注释/JSDoc 行数      = 8   （散文，非用户可见输出）
    剥离注释后代码残留 CJK 行数  = 0
[ ok ] src/core/status-text.js 新增代码/字符串字面量零中文硬编码
    HEAD 基线含中文注释行数      = 33  （既有风格对照）
===== 更严格：新增段字符串字面量内 CJK =====
src/cli/render.js: 代码中的字符串字面量 = 57 个，含 CJK = 0
src/core/status-text.js: 代码中的字符串字面量 = 34 个，含 CJK = 0
===== 结论：FAIL=0 =====
```

说明（对应指令「注意注释也算」）：新增段的**注释 / JSDoc 散文本身含中文**（render.js 32 行、status-text.js 8 行），本评审未隐瞒、未从扫描中剔除，已如实打印。但剥离注释后代码与全部字符串字面量 CJK = **0**，所有用户可见中文均经 `labels.js` 实际导出名引用（`[ ok ] 中文唯一来源`）。注释散文不是用户可见文案、不是硬编码值，且 HEAD 基线两文件本来就是中文注释风格（172 / 33 行）；按 D-6 / D-9「中文唯一来源 = labels.js 文案」口径判符合，**不升格为阻断**，仅登记为 §5 建议-03 供主控按最严字面口径复核。

**已裁决项复核（不重新升格）**：D-7 `LAYER_HEALTH` ✅、D-8 单表 ✅、D-9 实际导出名 / `HEALTH_EVENT_LINE` 不含 `{ts}` ✅（A-8 已由渲染层补时刻前缀，F-01 闭合）。

### 2.4 D-11 payload 契约（脚本 `/tmp/wp6-review/d11b.mjs`）

```
===== D-11：renderTraceShow 只读 payload（限定新增段/函数体、已剥离注释）=====
[ ok ] WP-6 新增段无 node:fs / 文件读写 / emit / process / Date.now
[ ok ] renderTraceShow 函数体（代码）无文件/状态/事件副作用
[ ok ] 函数体（代码）只引用 payload 与纯 helper
[ ok ] 深冻结 payload 不抛错（只读）
[ ok ] 调用后 payload 逐字未变（不写状态）
  renderTraceShow(frozen) -> "实例 INST-001 · 追踪 TRC-1a2b3c4d\n跨度 1 条 · 回流 0 次\n\n10:00:00 → 10:00:40  T-001  已完成  交接 HO-001\n\n回流链\n无"
===== D-11：函数体（代码）不硬编码中文数据串 =====
  renderTraceShow 函数体代码行数 = 38，含 CJK 的代码行 = 0
[ ok ] 函数体代码零中文（中文数据串全由 payload 上层传入）
===== D-11：上层组装中文数据串 -> render 原样透出 =====
  实得:
    实例 INST-001 · 追踪 TRC-1a2b3c4d
    跨度 2 条 · 回流 1 次
    10:00:00 → 10:00:40  T-001 开发  已完成  交接 HO-001
    10:00:40 → 10:01:30  T-002 测试  失败  交接 HO-001 HO-002
    回流链
    第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
[ ok ] span.result 原样透出（已完成 / 失败）
[ ok ] backflows[].from/to/state 原样透出
[ ok ] 汇总 回流次数 = backflows.length
===== D-11 四分支 =====
[ ok ] ① exists===false -> A-5
[ ok ] ② traceId 空且 spans 空 -> A-1
[ ok ] ③ end_time===null -> `—` / 进行中 / 不计入汇总
[ ok ] ④ badLines>0 -> 提示在汇总行之前
===== D-11 结论：FAIL=0 =====
```

四分支另逐字实得：`end_time===null` 输出含 `"跨度 1 条 · 回流 0 次"` 与 `"10:00:00 → —  T-001  进行中  交接 HO-001"`（2 条 spans 只算 1 条）；`badLines=2` 前 3 行 = `["实例 INST-001 · 追踪 TRC-1a2b3c4d","追踪记录有 2 行不可读，已跳过","跨度 1 条 · 回流 0 次"]`。`result` / `backflows[].{from,to,state}` 中文数据串由上层组装、render 零改写，与 D-11 冻结口径自洽；输出结构恒为「头 → [降级提示] → 汇总 → 空行 → 跨度行(+可选失败摘要) → 空行 → 回流链标题 → 无 / N 行回流」。D-11（payload 形状 / 中文由上层组装）为已裁决项，按裁决接受。

### 2.5 回归红线逐字 diff（脚本 `/tmp/wp6-review/regression.mjs`，HEAD 模块实跑）

**① `renderEventLines` 既有事件样本 HEAD vs 当前逐字 diff**：13 个样本覆盖 `single` / `code-loop` / `task-loop` 三模板、`result=applied/rejected/note`、`object=session/node/handoff/escalation/instance`、有/无 `seq`、`backflow.constructed` 多缺陷明细。

```
样本数 = 13，逐字不一致样本数 = 0
样本首例实得（当前）: ["10:00:05  会话 sess-1  空闲 → 执行中  原因 turn.first_event"]
[ ok ] 既有事件样本 renderEventLines/renderEventLine 输出逐字一致（既有行格式/相对顺序零改）
新 reason 分派差异（预期，非回归）：
  HEAD=["10:00:05  会话 mock-sess-12345-1  execution.summary  原因 execution.summary"]
  CUR =["10:00:05  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log"]
[ ok ] execution.summary 走新分派分支（非既有事件）
```

**② 函数体零改（文本抽取逐字比对）**：`renderGraphJson` / `renderGraphText` / `renderNodeLines` / `renderEventLine` / `renderRejectedTransition` / `renderBackflowDetail` 六函数 HEAD 与当前 `full` 字符串逐字相等（全部 `[ ok ]`）。

**③ `renderEventLines` 仅函数开头插 3 行分派分支**（HEAD 函数体被完整消费）：

```
  HEAD 函数体:
      const line = renderEventLine(event, { template });
      if (!line) return [];
      const tpl = typeof template === 'string' && template.length > 0 ? template : 'single';
      if (tpl === 'single') return [line]; // I1.1 版式不追加任何行（AC-21/22）
      return [line, ...renderBackflowDetail(event)];
  当前多出的行: ["  // I1.9 WP-6：…","  const reason = event?.reason;","  if (reason === 'execution.summary') return [renderSummaryLogLine(event)];","  if (reason === 'health.changed') return [renderHealthEventLine(event)];",""]
  新增语句行数（不含注释/空行）= 3
[ ok ] 当前函数体 = HEAD 函数体 + 开头分派分支（其余逐字不变、HEAD 体被完整消费）
```

**④ `instance graph` 不含健康度字段**：故意给 state 带 `health:{level:'attention',reasons:['pending_escalation']}`，三个函数输出与 HEAD 逐字一致且均不含 `健康度` / `"health"`（6 项 `[ ok ]`）。

**⑤ `status-text.js` 改动范围**：

```
  renderStatusDoc 新增代码行 = ["lines.push(`- ${CORE_TEXT.doc.health}：${healthDocLine(state)}`);"]
[ ok ] renderStatusDoc 函数体只新增 1 行（且为健康度行）
[ ok ] renderStatusDoc 签名零改
[ ok ] CORE_TEXT.doc 只追加 health 键、其余键与顺序零改
  multi=false: HEAD 行数=20 当前行数=21 健康度行=1
[ ok ] multi=false：删去健康度行后整份输出与 HEAD 逐字一致
[ ok ] multi=false：健康度行紧跟 - 状态 行
[ ok ] single 不输出 ## 节点 段（字段顺序/空值处理零改）
  multi=true: HEAD 行数=26 当前行数=27 健康度行=1
[ ok ] multi=true：删去健康度行后整份输出与 HEAD 逐字一致
[ ok ] multi=true：健康度行紧跟 - 状态 行
[ ok ] multi 仍输出 ## 节点 段
```

**⑥ `test/wp11/status-doc.test.js` 只改两处**（`git diff HEAD` 原始 `+/-` 行）：

```
  '+' 行 = 2: ["+      '- 健康度：正常\n' +","+      '- 健康度：正常\n' +"]
  '-' 行 = 0: []
[ ok ] 只新增 2 行、零删除
[ ok ] 2 行均为 - 健康度：正常
[ ok ] 无断言改动（不含 assert/expect/test(）
[ ok ] 改动落在 :74 与 :108 两处期望文本（diff hunk 头）
```

diff 仅 `@@ -74` / `@@ -108` 两个 hunk → `:179-251` 用例零改；未放宽任何断言（`status-doc.test.js` 定向门禁 40/40 绿，见 §3）。

`src/cli/labels.js` / `health.js` / `trace.js` / `event-bus.js` / `orchestrator.js` / `main.js` / `server.js` 零改（§1.3，8 个文件 `git diff` 行数均 0）。

`回归红线结论：FAIL=0`。

### 2.6 越界扫描（`git status --short`，门禁前后完全一致）

```
 M .workbuddy/memory/2026-11-09.md
 M docs/iterations/iteration-9/decisions.md
 M src/cli/render.js                      ← WP-6
 M src/core/status-text.js                 ← WP-6
 M test/fixtures/mock-acp-agent.js         ← 并行 WP-5
 M test/wp11/status-doc.test.js            ← WP-6
?? .workbuddy/memory/2026-11-10.md          ← 主控
?? docs/iterations/iteration-9/review-wp5.md   ← 主控 / WP-5 评审
?? docs/iterations/regression-2026-11-09.md    ← 主控
?? docs/iterations/regression-2026-11-09/      ← 主控
?? test/wp9/i19-fixture.test.js             ← 并行 WP-5
?? test/wp9/i19-render.test.js              ← WP-6（新建）
```

WP-6 文件集合恰为 4 个（`src/cli/render.js`、`src/core/status-text.js`、`test/wp9/i19-render.test.js`、`test/wp11/status-doc.test.js`）；其余 8 项均为并行 WP-5 / 主控的未提交改动，**不是 WP-6 改动，不误报**。门禁跑前 / 跑后 `git status --short` 逐行一致，无仓库内新副作用。按硬约束**未跑全量** `node --test "test/**/*.test.js"`。

---

## §3 门禁实跑数字表（真实数字，逐条实跑，未采信作者表格）

| # | 命令 | exit | 真实数字 |
|---|---|---|---|
| 1 | `node --test test/wp9/i19-render.test.js test/wp11/status-doc.test.js` | **0** | `tests 40 / pass 40 / fail 0 / skipped 0 / duration_ms 1714.4` |
| 2 | `node --test "test/wp9/**/*.test.js"` | **0** | `tests 85 / pass 85 / fail 0 / skipped 0 / duration_ms 29473.5` |
| 3 | `node --test test/wp11/labels-sync.test.js test/wp12/cli-assets.test.js test/wp11/purity.test.js test/wp9/cli-e2e.test.js` | **0** | `tests 45 / pass 45 / fail 0 / skipped 0 / duration_ms 28428.5`（与 D-13 的 `cli-e2e` 45/45 口径一致） |
| 4 | `node -p "Object.keys(require('./package.json').dependencies||{}).length"` | **0** | 输出 **`0`** |
| 5 | `node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))"` | **0** | 输出 **`25`** |
| 6 | `FORBID="<31 词全表>"; node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | **0** | `OK: 扫描 24 个文件 … 零命中` |
| 附 | `node --test test/wp9/cli-e2e.test.js`（单独核对 D-13 上下文） | 0 | `tests 4 / pass 4 / fail 0`（组合门禁 45/45） |
| — | `node --test "test/**/*.test.js"`（全量） | — | **按硬约束未跑**（已知会改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`） |

补充静态数字：`type=module`；8 个零改文件 `git diff HEAD` 行数均 `0`；`src/core/status-text.js` 控制字符字节数 `0`；HEAD/current 行数 `render.js 1983→2226`、`status-text.js 342→427`；WP-6 4 文件 diff `+` 行统计 `render.js 244`、`status-text.js 86`、`status-doc.test.js 3`（含 `+++` 头，实际 2 行新增）、`i19-render.test.js` 为 untracked。

---

## §4 阻断项清单（F-xx）

**阻断 0 条，无 F-xx 项。**

逐项确认以下「已裁决项」按裁决接受、**未重新升格为阻断**：D-7（`LAYER_HEALTH`）、D-8（单表 `HEALTH_REASON[code]`）、D-9（实际导出名 / `HEALTH_EVENT_LINE` 不含 `{ts}`）、D-11（payload 形状 / 中文数据串由上层组装）、D-12 ④（事件文本行无快照的已知边界）、D-13（A-11 节选按完整输出、`cli-e2e` 45/45）。

逐项确认以下阻断条件均未命中：A-1~A-14 逐字基线全命中（§2.2）；D-12 8 行真实 `computeHealth` 纯码值形态全命中、无双空格降级、两处一致（§2.1）；D-7/D-8/D-9 单表 / 无别名 / 8 码顺序 / 零中文硬编码（§2.3）；D-11 四分支与只读契约（§2.4）；既有逐字回归 13 样本 diff=0、零改函数体、graph 不含健康度、`status-doc.test.js` 只改 2 行（§2.5）；取证真实（独立复算 + 作者真实快照用例），无「只测自造对象」；越界扫描无 WP-6 越界文件（§2.6）；门禁 6 条全 `exit 0`（§3）。

---

## §5 建议项清单（均不判 FAIL、不改判据、不放宽断言）

| 编号 | 现象（原始证据） | 依据 / 影响 | 建议方向 | 严重度 |
|---|---|---|---|---|
| **S-01**（作者开放点 1 / D-12 ④ 已裁决边界） | `renderHealthEventLine` 只有事件、无快照：带占位符码（`node_timeout`）若无 `event.detail.reasonVars` 则渲染 `"10:00:00  健康度 INST-001  正常 → 需关注  原因 节点  执行超时"`（双空格降级）；有 `reasonVars:{node_timeout:{nodeId:'T-001'}}` 时为 `"… 原因 节点 T-001 执行超时"`。A-8 用 `pending_escalation`（无占位符）逐字基线不受影响（`/tmp/wp6-review/openpoints.mjs`） | D-12 ④ 已裁决「带占位符码在事件文本行允许从 `event.detail.reasonVars?.[code]` 取值，缺失时降级，登记为已知边界」；AC-16 判据只用 `pending_escalation`，**不升格为阻断** | 转达 WP-7 / emit 侧：当 `health.changed` 的 `detail.reasons` 含带占位符码时填充 `detail.reasonVars[code]`；在 `report.md` §5 遗留清单登记该边界（A-8 基线不动） | 建议 |
| **S-02**（作者开放点 2 / 首个匹配口径） | `deriveHealthReasonVars`（`render.js:2030` / `status-text.js:168`）用 `Array.find` 取**首个匹配**：多 running 节点时 `node_timeout` 取首个（`T-001` 而非 `T-006`）、多 quarantined 会话时 `session_crash` 取首个（`sess-A`）。两处规则逐字一致；`health.reasonVars[code]` 优先级实测生效（`T-999`）（`/tmp/wp6-review/openpoints.mjs`） | A-6 附 8 行夹具均为单命中，逐字基线成立；`computeHealth` 只返回码值、不携带触发对象标识，真实快照多命中时实参可能与触发对象不一致，属未钉死口径，**不影响本 WP 判据** | 建议 WP-7 优先提供 `health.reasonVars[code]`（两处已实现优先级），或在 `report.md` §5 登记「首个匹配」口径边界；不改 A 基线、不改断言 | 建议 |
| **S-03**（「注意注释也算」的如实登记） | 新增段剥离注释后代码 / 字符串字面量 CJK = 0；但 JSDoc/注释散文本身含中文（render.js 32 行、status-text.js 8 行），HEAD 基线两文件本就有中文注释 172 / 33 行（`/tmp/wp6-review/d789b.mjs`） | D-6 / D-9 的「中文唯一来源」指用户可见文案；注释散文非文案、非硬编码值、不影响 A 逐字输出；按用户「阻断」定义不属任何一类，**不升格为阻断**。若按最严字面口径复核，这是唯一观察点 | 由主控裁决是否要求后续新增注释改英文（参照 `src/core/health.js` 全英文注释）；本评审如实登记，未改判据、未从扫描剔除 | 建议 |
| **S-04**（测试形态收敛，非缺陷） | `i19-render.test.js:240-256`「A-6 附 8 行」一组仍用对象形态 `{code, …实参}` 自造夹具（D-12 ③ 兼容保留、非主契约）；主契约已由 `:577-584` 的真实 `computeHealth` 纯码值快照用例覆盖，且本评审 `/tmp/wp6-review/d12.mjs` 独立复算通过 | 不存在「只测自造对象数据」的取证失真（真实形态用例齐备），40/40 定向门禁绿；仅为消除观感 | 后续迭代可把该组收敛为纯码值形态，与 `:577` 合并；**不改判据、不放宽断言、不动 A 基线** | 建议 |

---

## §6 结论

**PASS（阻断 0 / 建议 4）**

- D-12 阻断缺陷**真正闭合**：真实 `computeHealth` 纯码值 `reasons: string[]` 写回 `state.health` 后，A-6 附 8 行在 `renderHealthLine` 与 `renderStatusDoc` 两处逐字全命中、两处一致、无双空格降级，多原因按 8 码固定顺序拼接（§2.1）。
- 附录 A-1~A-14 逐字基线全部命中，重点项（A-2/A-10 回流链「无」、A-3 第 2 轮行、A-4 两空格+缺项、A-8 时刻前缀、A-11 提示在前、A-13 单独成行、A-12/A-14 同模板四项全「未提供」）逐条核过（§2.2）。
- D-7 / D-8 / D-9 / D-11 全部落实：单表唯一入口、无别名、8 码不重排、零中文硬编码（代码/字面量）、中文唯一来源 = `labels.js` 实际导出名、payload 只读且四分支合 D-11（§2.3 / §2.4）。
- 回归红线全部守住：13 个既有事件样本 HEAD diff = 0；`renderEventLines` 仅开头 3 行分派；6 个零改函数体逐字相等；`instance graph` 不含健康度；`status-text.js` 只在 `- 状态：…` 后插 1 行、`CORE_TEXT.doc` 只加 `health`、`single` 无 `## 节点`、签名/字段顺序/空值处理零改；`status-doc.test.js` 只改 2 行且 `:179-251` 零改、未放宽断言（§2.5）。
- 越界扫描：WP-6 恰 4 文件，其余并行 WP-5 / 主控改动已识别、未误报；8 个零改文件确认零改（§2.6 / §1.3）。
- 门禁 6 条全部 `exit 0`（40/40、85/85、45/45、deps 0、USAGE_LINES 25、purity 24 文件零命中），未跑全量，门禁前后 `git status` 一致（§3）。

---

## §7 声明

**本评审未改任何产品代码 / 测试代码、未 `git commit`；唯一写入为评审报告 `docs/iterations/iteration-9/review-wp6.md`。** 所有独立复算脚本落在 `/tmp/wp6-review/`（仓库外），未引入仓库内临时文件；门禁前后 `git status --short` 逐行一致，无仓库内新副作用。未跑全量测试（按硬约束）。判据按 `requirement.md` 附录 A-0~A-14 / D-3 / D-5 / D-6、`iteration-9.md` §2.7 / §2.9 / §2.14 / §8 C-06 / C-13、`decisions.md` D-7~D-13、`review-wp2-wp4.md` F-01 原样执行；已裁决项按裁决接受、未重新升格为阻断；未改任何判据、未放宽任何断言。

*评审人：I1.9 S2 批次 3 WP-6 独立评审 Agent（干净上下文，与实现者分离） | 结论文件：本文件（唯一写入）*
