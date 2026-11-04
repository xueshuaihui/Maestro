# I1.1 验收记录（夹具面）

> 执行人：独立验收子 Agent ｜ 依据：`requirement.md` v5 §3 ｜ 执行时间：2026-11-04 23:54–23:57（本地）
> 工作目录：`D:/WWW/Maestro`（Windows 11 / Git Bash / Node v22.22.2）｜ 全部项目根：`%TEMP%/maestro-acc-f/proj/<case>/`
> 证据目录：`docs/iterations/iteration-1/evidence/`（每条 AC 四份：`*.meta.json` / `*.output.json` / `*.state.json` / `*.events.jsonl`，均由脚本落盘）
> 执行脚本：`probe/acc-f-lib.mjs`、`probe/acc-f-run.mjs`、`probe/acc-f-summary.mjs`

## 0. 总判

**AC-15~AC-26：通过 12 / 不通过 0 / 阻塞 0 ｜ NFR：达标 3 / 未达标 0 / 未测 0**

一句话结论：夹具面 12 条 AC 全部在本机实跑通过；状态输出、`state.json`、`events.jsonl` 三层证据相互一致，未发现需求 v5 在夹具面的不达标项。

| 项 | 结论 | 证据 |
|---|---|---|
| AC-15 | 通过 | `evidence/AC-15.*` |
| AC-16 | 通过 | `evidence/AC-16.*` |
| AC-17 | 通过 | `evidence/AC-17.*` |
| AC-18 | 通过 | `evidence/AC-18.*` |
| AC-19 | 通过 | `evidence/AC-19.*` |
| AC-20 | 通过 | `evidence/AC-20.*` |
| AC-21 | 通过 | `evidence/AC-21.*` |
| AC-22 | 通过 | `evidence/AC-22.*` |
| AC-23 | 通过 | `evidence/AC-23.*` |
| AC-24 | 通过 | `evidence/AC-24.*` |
| AC-25 | 通过 | `evidence/AC-25.*` |
| AC-26 | 通过 | `evidence/AC-26.*` |
| NFR-03 | 达标（10/10） | `evidence/NFR-03.*` |
| NFR-04 | 达标 | `evidence/NFR-04.*` |
| NFR-06 | 达标 | `evidence/NFR-06.*` |

> 命令中的 `node` 实际为 `process.execPath`：`C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`（证据里保存了完整路径）。下文为可读性写成 `node bin/orch.js …`。
> 夹具接管方式：每个项目根写 `.orch/hosts/dsh.json`，`launch.command = process.execPath`、`launch.args = [test/fixtures/mock-acp-agent.js, ...开关]`（字段名以 `src/adapter/host-config.js` + `src/adapter/dsh-launch.js:100-116` 为准）。未设置 `DSH_HOME`，未使用真实模型凭据。

---

## 1. AC 逐条记录

### AC-15 会话建好但没接任务是空闲

- **验证面**：夹具
- **夹具开关**：`--hold-session`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段 200 字的产品说明，保存到 out/intro.md"   # 后台
  node bin/orch.js status --instance INST-001
  node test/fixtures/probe-adapter.mjs --mock test/fixtures/mock-acp-agent.js --switches "--hold-session" --observe session-state
  ```
- **实际输出**（`AC-15.output.json`）：
  ```
  实例 INST-001 · 运行中
  节点 执行中
  会话 空闲
  交接包 HO-001  已构造   23:54:16
  交接包 HO-001  已投递   23:54:16
  交接包 HO-001  已投递   等待目标响应 · 已等待 1s
  ```
  探针（单行 JSON）：
  ```
  {"ok":true,"mode":"session-state","session":{"sessionId":"mock-sess-…","state":"idle","toolName":null,"turnId":null,"quarantined":false},"observedState":null,"handoff":null,"noiseCount":0,"turnEventCount":0,"stopReason":null}
  ```
- **状态证据**：`state.json` → `state="running"`、`session.state="idle"`、`session.toolName=null`、`handoff.state="delivered"`。
  `events.jsonl` 共 7 行，全程**没有** `object:"session"` 的迁移；seq 1–4 为 `instance→running` / `node→running` / `handoff→created` / `handoff→delivered`，seq 5–7 是收尾 cancel。原文（seq 4）：
  ```json
  {"object":"handoff","objectId":"HO-001","from":"created","to":"delivered","result":"applied","reason":"handoff.delivered","detail":{"atMs":1793807656771},"gen":"gen-6b87b8e1e0a2e8eb","seq":4,"ts":"2026-11-04T15:54:16.772Z"}
  ```
- **判定**：**通过**
  - `Then 显示"空闲"`：status 逐字出现 `会话 空闲` ✅
  - `And 没有出现"执行中"`：status 无 `会话 执行中` ✅
  - 加验：`session→thinking` 事件 0 条 ✅；探针真实观察值为 `idle` 且 `observedState:null`（不是探针写死）✅
  - 口径说明：产品路径的 `--hold-session` 是“prompt 已发、宿主不回应”；探针 `session-state` 才是“建会话后完全不投递”。两条都得到 `空闲`，结论一致。

### AC-16 调工具时看得见工具名

- **验证面**：夹具
- **夹具开关**：`--slow-tool write --turn-delay-ms 5000`（探针另用 800ms）
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"   # 后台
  node bin/orch.js status --instance INST-001
  node test/fixtures/probe-adapter.mjs --mock test/fixtures/mock-acp-agent.js --switches "--slow-tool write --turn-delay-ms 800" --observe tool-name
  ```
- **实际输出**：
  ```
  实例 INST-001 · 运行中
  节点 执行中
  会话 执行中 · 调用工具（write） · 已运行 1s
  交接包 HO-001  已构造   23:54:18
  交接包 HO-001  已投递   23:54:18
  交接包 HO-001  已接受   23:54:18
  ```
  探针：`{"ok":true,"mode":"tool-name","session":{"state":"tool_running","toolName":"write",...},"turnEventCount":5,"stopReason":"end_turn"}`
- **状态证据**：`state.json` → `session.state="tool_running"`、`session.toolName="write"`；`events.jsonl` seq 7 原文：
  ```json
  {"object":"session","objectId":"mock-sess-9316-1","from":"thinking","to":"tool_running","result":"applied","reason":"session.state","detail":{"event":"tool_call"},"gen":"gen-40872156afdc55b2","seq":7,"ts":"2026-11-04T15:54:18.515Z"}
  ```
- **判定**：**通过**
  - `Then 会话行显示"执行中 · 调用工具（<工具名>）"`：逐字匹配 `会话 执行中 · 调用工具（write）` ✅
  - `And 工具名不是空白`：`toolName="write"` ✅；探针独立复现同一工具名 ✅

### AC-17 等待审批时节点仍在执行中

- **验证面**：夹具（真实 DSH 写 cwd 内文件不触发审批，v5 §3.3 已注明）
- **夹具开关**：`--permission=ask` + 环境变量 `MAESTRO_PERMISSION_POLICY=hold`（变量名见 `src/adapter/host-config.js:63-66`）
- **实际命令**：
  ```
  MAESTRO_PERMISSION_POLICY=hold node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"   # 后台
  MAESTRO_PERMISSION_POLICY=hold node bin/orch.js status --instance INST-001
  MAESTRO_PERMISSION_POLICY=hold node bin/orch.js cancel --instance INST-001
  ```
- **实际输出**：
  ```
  实例 INST-001 · 运行中
  节点 执行中
  会话 等待审批：write
  交接包 HO-001  已构造   23:54:24
  交接包 HO-001  已投递   23:54:24
  交接包 HO-001  已接受   23:54:24
  ```
  （`orch run` 的流式输出同样出现 `会话 等待审批：write` 与 `节点 执行中`）
- **状态证据**：`state.json` → `node.state="running"`、`session.state="waiting_input"`、`session.toolName="write"`、`session.pendingPermission={"toolCallId":"call_mock_30332_1","action":"write"}`。
  `events.jsonl` seq 8 原文（此后无 node 迁移）：
  ```json
  {"object":"session","objectId":"mock-sess-30332-1","from":"tool_running","to":"waiting_input","result":"applied","reason":"permission.requested","detail":{"action":"write","toolCallId":"call_mock_30332_1"},"gen":"gen-6e6870b0378fc86d","seq":8,"ts":"2026-11-04T15:54:24.269Z"}
  ```
- **判定**：**通过**
  - `Then 会话行显示"等待审批："+ 动作名`：`会话 等待审批：write` ✅
  - `And 节点行仍显示"执行中"`：`节点 执行中`，且 `state.node.state="running"` ✅
  - `And 节点没有跳到"已完成"`：status 无 `节点 已完成`，事件里无 node→done ✅（BR-03）

### AC-18 审批被拒时交接包是已拒绝

- **验证面**：夹具
- **夹具开关**：`--permission=ask` + `MAESTRO_PERMISSION_POLICY=reject`
- **实际命令**：
  ```
  MAESTRO_PERMISSION_POLICY=reject node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"
  ```
- **实际输出**（exit 1）：
  ```
  实例 INST-001 · 运行中
  会话已创建 mock-sess-32024-1
  任务已投递
  会话 等待审批：write
  会话 空闲
  节点 失败 · 审批被拒绝，任务中止于 write
  交接包 HO-001  已构造   23:54:25
  交接包 HO-001  已投递   23:54:25
  交接包 HO-001  已接受   23:54:25
  交接包 HO-001  已拒绝   23:54:25  原因 审批被拒
  审批被拒绝，任务中止于 write
  ```
- **状态证据**：`state.json` → `state="failed"`、`node.state="failed"`、`node.failure={"code":"PERMISSION_DENIED","message":"write"}`、`handoff.state="rejected"`、`handoff.rejectReason="permission_denied"`、`session.state="idle"`（quarantined）。
  `events.jsonl` seq 8 `waiting_input` → seq 9 `waiting_input→idle`（`permission.denied`）→ seq 10 `node running→failed` → seq 12 `handoff accepted→rejected`。原文（seq 10 + seq 12）：
  ```json
  {"object":"node","objectId":"T-001","from":"running","to":"failed","result":"applied","reason":"run.failed","detail":{"code":"PERMISSION_DENIED","message":"write"},"gen":"gen-655ef83d29c6da21","seq":10,"ts":"2026-11-04T15:54:25.557Z"}
  {"object":"handoff","objectId":"HO-001","from":"accepted","to":"rejected","result":"applied","reason":"handoff.rejected","detail":{"reason":"permission_denied"},"gen":"gen-655ef83d29c6da21","seq":12,"ts":"2026-11-04T15:54:25.566Z"}
  ```
- **判定**：**通过**
  - `Then 我看到"审批被拒绝"以及停在哪一步`：逐字 `审批被拒绝，任务中止于 write`；`step` 非 `null` ✅
  - `And 交接包显示"已拒绝"，原因写明"审批被拒"`：`handoff.state="rejected"`、`rejectReason="permission_denied"`，CLI 打 `原因 审批被拒` ✅
  - `And 节点显示"失败"`：`节点 失败 · …` ✅

### AC-19 只有对方真开始干活才算已接受

- **验证面**：夹具
- **夹具开关**：产品面 `--noise-on-session-new --accept-delay-ms 3000`；探针面 `--noise-on-session-new --noise-on-prompt --accept-delay-ms 1500`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"   # 后台
  node bin/orch.js status --instance INST-001
  node test/fixtures/probe-adapter.mjs --mock test/fixtures/mock-acp-agent.js --switches "--noise-on-session-new --noise-on-prompt --accept-delay-ms 1500" --observe handoff
  ```
- **实际输出**（噪声已到、目标尚未开始处理）：
  ```
  实例 INST-001 · 运行中
  节点 执行中
  会话 空闲
  交接包 HO-001  已构造   23:54:26
  交接包 HO-001  已投递   23:54:26
  交接包 HO-001  已投递   等待目标响应 · 已等待 1s
  ```
  探针：
  ```json
  {"mode":"handoff","handoff":{"state":"delivered","timestamps":{"deliveredAt":"…26.287Z","acceptedAt":null},
   "acceptedSignal":null},"turnEventSeen":true,"noiseCount":2,"turnEventCount":5,
   "handoff":{"stateAfterTurn":"accepted"}}
  ```
- **状态证据**：采样时 `state.json` → `session.state="idle"`、`handoff.state="delivered"`、`acceptedAt=null`。
  事件时间线证明“接受”发生在噪声之后：seq 4 `handoff→delivered`（26.287）→ seq 5 `session idle→thinking`（**29.298**，`detail.event="agent_thought_chunk"`）→ seq 6 `handoff delivered→accepted`（29.301），`ambiguityWindowMs=3011`。噪声期间 3s 内无任何 accepted。原文（seq 6）：
  ```json
  {"object":"handoff","objectId":"HO-001","from":"delivered","to":"accepted","result":"applied","reason":"turn.first_event","detail":{"event":"agent_thought_chunk","ambiguityWindowMs":3011},"gen":"gen-5afdae9c2119c31f","seq":6,"ts":"2026-11-04T15:54:29.301Z"}
  ```
- **判定**：**通过**
  - `Then 交接包仍显示"已投递"`：status 与 `state.handoff.state` 都是 `delivered` ✅
  - `And 没有跳到"已接受"`：status 全文无 `已接受`；探针“交付后首条噪声到达时”仍为 `delivered`，`noiseCount=2` ✅
  - 加验：accepted 的触发事件是 `agent_thought_chunk`（turn 事件），不是 `usage_update` / `available_commands_update` ✅（BR-15）

### AC-20 会话失效与“正在执行”是两条不同提示

- **验证面**：夹具
- **夹具开关**：`--session-missing`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"
  ```
- **实际输出**（exit 1）：
  ```
  实例 INST-001 · 运行中
  会话已创建 mock-sess-18548-1
  任务已投递
  会话 空闲
  节点 失败 · 会话已失效，需要重新创建
  交接包 HO-001  已构造   23:54:27
  交接包 HO-001  已投递   23:54:27
  交接包 HO-001  已拒绝   23:54:27  原因 目标拒绝
  会话已失效，需要重新创建
  ```
- **状态证据**：`state.json` → `node.failure={"code":"SESSION_INVALID","message":"unknown session"}`、`node.state="failed"`、`session.state="idle"`、`handoff.state="rejected"`。
  `events.jsonl` 原文（seq 5 / seq 7）：
  ```json
  {"object":"node","objectId":"T-001","from":"running","to":"failed","result":"applied","reason":"run.failed","detail":{"code":"SESSION_INVALID","message":"unknown session"},"gen":"gen-12c15aafb2053b69","seq":5,"ts":"2026-11-04T15:54:30.076Z"}
  {"object":"handoff","objectId":"HO-001","from":"delivered","to":"rejected","result":"applied","reason":"handoff.rejected","detail":{"reason":"target_rejected"},"gen":"gen-12c15aafb2053b69","seq":7,"ts":"2026-11-04T15:54:30.085Z"}
  ```
  全部事件中**无任何** `NODE_BUSY` 记录。
- **判定**：**通过**
  - `Then 我看到"会话已失效，需要重新创建"`：逐字出现 ✅
  - `And 与"该节点正在执行，本次未发起"不是同一条`：输出不含该串；两条文案逐字不同（`SESSION_INVALID` vs `NODE_BUSY`，`src/cli/labels.js:58-59`）✅

### AC-21 执行失败保留宿主原文与出错步骤

- **验证面**：夹具
- **夹具开关**：`--host-error`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"
  ```
- **实际输出**（exit 1）：
  ```
  实例 INST-001 · 运行中
  会话已创建 mock-sess-25180-1
  任务已投递
  会话 空闲
  节点 失败 · 执行失败：mock-host: upstream model request failed (code 500)
  交接包 HO-001  已构造   23:54:30
  交接包 HO-001  已投递   23:54:30
  交接包 HO-001  已拒绝   23:54:30  原因 目标拒绝
  执行失败：mock-host: upstream model request failed (code 500)
  ```
- **状态证据**：`state.json` → `node.failure={"code":"HOST_ERROR","message":"mock-host: upstream model request failed (code 500)"}`、`hostRaw.lastError={"code":-32603,"message":"mock-host: upstream model request failed (code 500)"}`、`handoff.state="rejected"`（`consumedAt=null`）。
  `events.jsonl` 原文（seq 5）：
  ```json
  {"object":"node","objectId":"T-001","from":"running","to":"failed","result":"applied","reason":"run.failed","detail":{"code":"HOST_ERROR","message":"mock-host: upstream model request failed (code 500)"},"gen":"gen-fc16ed4360750de1","seq":5,"ts":"2026-11-04T15:54:30.794Z"}
  ```
  交接包无 `→consumed`。
- **判定**：**通过**
  - `Then 我看到"执行失败："+ 宿主原文`：逐字、原文与 `state.hostRaw.lastError.message` 完全一致（未截断/改写）✅
  - `And 我能看到停在哪一步`：本迭代只有单节点；`节点 失败` 行 + 事件 `节点 T-001 running→failed` 表明停在节点执行阶段（无独立 step 字段，属表达方式而非缺失）✅
  - `And 节点显示"失败"，交接包不显示"已完成"`：`node.state="failed"`；输出无 `交接包 HO-001  已完成`，`handoff.state="rejected"` ✅

### AC-22 没见过的错误原样透出

- **验证面**：夹具
- **夹具开关**：`--unknown-error`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"
  ```
- **实际输出**（exit 1）：
  ```
  实例 INST-001 · 运行中
  会话已创建 mock-sess-17312-1
  任务已投递
  会话 空闲
  节点 失败 · 未知错误：mock-host: E_QUASAR_7719 unrecognized failure token
  交接包 HO-001  已构造   23:54:31
  交接包 HO-001  已投递   23:54:31
  交接包 HO-001  已拒绝   23:54:31  原因 目标拒绝
  未知错误：mock-host: E_QUASAR_7719 unrecognized failure token
  ```
- **状态证据**：`state.json` → `node.failure.code="UNKNOWN_ERROR"`、`hostRaw.lastError={"code":-32099,"message":"mock-host: E_QUASAR_7719 unrecognized failure token"}`。`events.jsonl` 原文（seq 5）：
  ```json
  {"object":"node","objectId":"T-001","from":"running","to":"failed","result":"applied","reason":"run.failed","detail":{"code":"UNKNOWN_ERROR","message":"mock-host: E_QUASAR_7719 unrecognized failure token"},"gen":"gen-f5a93598336040e1","seq":5,"ts":"2026-11-04T15:54:31.510Z"}
  ```
- **判定**：**通过**
  - `Then 我看到"未知错误："+ 宿主原文`：逐字 ✅
  - `And 原文没有被改写、截断或吞掉`：存储原文与 mock 固定串逐字相同，长度相同 ✅

### AC-23 长时间没动静不判失败

- **验证面**：夹具
- **夹具开关**：`--turn-delay-ms 12000`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"   # 后台
  # 等到会话已静默 11s（> 10s 阈值）后：
  node bin/orch.js status --instance INST-001
  ```
- **实际输出**：
  ```
  实例 INST-001 · 运行中
  节点 执行中
  会话 执行中 · 已运行 11s · 无新事件
  交接包 HO-001  已构造   23:54:32
  交接包 HO-001  已投递   23:54:32
  交接包 HO-001  已接受   23:54:32
  ```
- **状态证据**：采样时 `state.json` → `session.state="tool_running"`、`session.lastEventAt` 距采样 10.8s（meta 记录实测 `idleMs=10809ms`，阈值 10s）。
  `events.jsonl` 在 `tool_call` 之后到采样点没有任何新行（12s 延迟结束后才出现 `agent_message_chunk` / `等待下游`）。静默前最后一条原文（seq 7）：
  ```json
  {"object":"session","objectId":"mock-sess-2132-1","from":"thinking","to":"tool_running","result":"applied","reason":"session.state","detail":{"event":"tool_call"},"gen":"gen-b78407c142464923","seq":7,"ts":"2026-11-04T15:54:32.274Z"}
  ```
- **判定**：**通过**
  - `Then 会话仍显示"执行中"` ✅
  - `And 附带"无新事件"与已等待时长`：`会话 执行中 · 已运行 11s · 无新事件` ✅
  - `And 没有出现"失败"或"已失效"`：全文无这两个词 ✅
  - 加验：`orch status --instance` 也走了 stall 行（评审判定 C-4 已修）✅

### AC-24 目标迟迟不开始，也不判过期

- **验证面**：夹具
- **夹具开关**：`--accept-delay-ms 3000`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"   # 后台
  node bin/orch.js status --instance INST-001   # 交接包 delivered 后立即采样
  ```
- **实际输出**：
  ```
  实例 INST-001 · 运行中
  节点 执行中
  会话 空闲
  交接包 HO-001  已构造   23:54:45
  交接包 HO-001  已投递   23:54:45
  交接包 HO-001  已投递   等待目标响应 · 已等待 1s
  ```
- **状态证据**：`state.json` → `state="running"`、`node.state="running"`、`handoff.state="delivered"`、`acceptedAt=null`；`handoff.deliveredAt` 距采样 116ms（`formatDuration` 对亚秒正值夹到 `1s`，故显示 `已等待 1s`）。`events.jsonl` 原文（seq 4）：
  ```json
  {"object":"handoff","objectId":"HO-001","from":"created","to":"delivered","result":"applied","reason":"handoff.delivered","detail":{"atMs":1793807685066},"gen":"gen-f04e41f0dd8a5d4a","seq":4,"ts":"2026-11-04T15:54:45.066Z"}
  ```
- **判定**：**通过**
  - `Then 交接包仍显示"已投递"，并显示等待了多久`：`交接包 HO-001  已投递` + `等待目标响应 · 已等待 1s` ✅
  - `And 没有出现"已过期"`：全文无 `已过期`；`handoff.state` 非 `expired` ✅
  - `And 节点没有因此变成"失败"`：`节点 执行中`，`node.state="running"` ✅（BR-08）

### AC-25 上一个任务的收尾不影响下一个

- **验证面**：夹具
- **夹具开关**：
  - INST-001：`--noise-at-turn-end --turn-delay-ms 1500`（turn 结束后推 `usage_update` / `available_commands_update`）
  - INST-002：`--noise-at-turn-end --turn-delay-ms 200 --accept-delay-ms 6000`（撑出“自己还没开始处理”的窗口）
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段说明，完成后直接结束。"   # 后台
  # INST-001 会话建立后立刻改宿主配置，紧接着发起：
  node bin/orch.js run --cwd ./demo --instance INST-002 --task "写一段说明，完成后直接结束。"   # 后台
  # INST-001 结束后 0.5s（发起 INST-002 后 1790ms）：
  node bin/orch.js status --instance INST-002
  ```
- **实际输出**（采样点，INST-002 发起后 1790ms）：
  ```
  实例 INST-002 · 运行中
  节点 执行中
  会话 空闲
  交接包 HO-001  已构造   23:56:11
  交接包 HO-001  已投递   23:56:11
  交接包 HO-001  已投递   等待目标响应 · 已等待 2s
  ```
  对照：INST-001 已跑完并打完 `节点 已完成 · 耗时 2s` / `交接包 HO-001 已完成`。
- **状态证据**（`AC-25.meta.json` 的 `sample.state`，采样时刻）：
  `INST-002`: `state="running"`、`node.state="running"`、`session.state="idle"`、`session.lastEventAt==createdAt`、`handoff.state="delivered"`、采样时 INST-002 只有 4 条事件（instance/node/handoff×2），**没有** `session→thinking/tool_running`。
  结束态事件：INST-002 的 session 事件全部属于 `mock-sess-21116-1`，首个 turn 事件是 `agent_thought_chunk`；无 `usage_update`/`available_commands_update` 触发的状态迁移。原文（INST-002 第一条 session 事件，seq 5）：
  ```json
  {"object":"session","objectId":"mock-sess-21116-1","from":"idle","to":"thinking","result":"applied","reason":"session.state","detail":{"event":"agent_thought_chunk"},"gen":"gen-6a954af2f73868aa","seq":5,"ts":"2026-11-04T15:56:17.608Z"}
  ```
- **判定**：**通过**
  - `Then 第二个会话在自己开始处理之前一直显示"空闲"`：采样点 `会话 空闲` + `session.state="idle"` + 无 turn 事件 ✅
  - `And 第一个任务的收尾消息没有让它显示"执行中"`：status 无 `会话 执行中`；INST-002 事件无噪声驱动、无 INST-001 的 sessionId 串入 ✅

**补充观察（不是 requirement 的 AC-25 原文，来自任务书“关键口径提示”）**：`--slow-tool write --turn-delay-ms 8000` 跑到 `tool_running` 后执行 `orch cancel`，等 1.5s 让迟到帧到达，`status` 仍为 `会话 空闲 / 节点 已取消 / 交接包 已拒绝（已撤回）`，取消后无新的 `session→tool_running` 事件。判为通过，证据 `evidence/AC-25.supplement.*`。该场景对应 BR-06/AC-11 的邻域，**不能**替代 AC-25 原文判定。

### AC-26 非法状态迁移被拒绝

- **验证面**：夹具
- **夹具开关**：`--write-ref out/intro.md`（先造出节点 `done`）+ `test/fixtures/attempt-transition.mjs`
- **实际命令**：
  ```
  node bin/orch.js run --cwd ./demo --instance INST-001 --task "写一段 200 字的产品说明，保存到 out/intro.md"
  node test/fixtures/attempt-transition.mjs --root <项目根> --instance INST-001 --object node --from done --to running
  ```
- **实际输出**（夹具 exit 0）：
  ```json
  {"ok":false,"code":"ILLEGAL_TRANSITION","from":"done","to":"running",
   "message":"node: done -> running is not in the transition table"}
  已拒绝：node done -> running（ILLEGAL_TRANSITION）
  ```
- **状态证据**：迁移前后 `state.json` 的 `node.state` 均为 `"done"`（未被改写）。
  `events.jsonl` seq 15：
  ```json
  {"object":"node","objectId":"T-001","from":"done","to":"running","result":"rejected",
   "reason":"illegal_transition","detail":{"source":"fixture/attempt-transition",
   "message":"node: done -> running is not in the transition table"},"seq":15,"ts":"..."}
  ```
- **判定**：**通过**
  - `Then 核心拒绝这次迁移，状态保持"已完成"`：`ok:false / ILLEGAL_TRANSITION`，`node.state` 仍为 `done` ✅
  - `And 事件记录里有一条"拒绝的迁移"`：`result:"rejected"` + `reason:"illegal_transition"` ✅
  - 注：requirement §3.3 列出的 `--illegal-transition` 开关在 `mock-acp-agent.js` 中**不存在**；按任务书使用 `attempt-transition.mjs`（真实 `state-machine` + `event-bus` + `instance-store`）。

---

## 2. 非功能项记录

### NFR-03 连续 10 个任务：0 次错乱、0 条缺失 — **达标（10/10）**

- **夹具开关**：`--turn-delay-ms 0`
- **做法**：同一项目根下依次执行 10 次 `orch run --cwd ./demo --instance INST-001…INST-010`（脚本串行，非并发），再执行 `orch status` 与 `orch status --instance INST-005 --events`。
- **结果**：

  | 实例 | 退出码 | 节点 | 交接包 | events.jsonl |
  |---|---|---|---|---|
  | INST-001…INST-010 | 全 0 | 全 `done` | 全 `consumed` | 每份 15 行 |

  `orch status` 恰好列出 10 行，全部 `实例 INST-xxx · 已完成 · 节点 已完成 · 会话 空闲`；10 次总耗时 **4.4s**（最后一次 `status` 与事件查询另计）。
  `status --instance INST-005 --events` 打出 4 类状态 + 15 条带时间戳的事件，可完整重放（已创建→运行中→…→已完成）。
- **判定**：**达标**。五项（实例/节点/会话/交接包/事件）逐实例齐全，无错乱、无缺失。

### NFR-04 强杀核心后重启，5 项仍可查 — **达标**

- **夹具开关**：INST-001 用默认（快速完成）；INST-002 换成 `--turn-delay-ms 8000 --slow-tool write`
- **做法**：INST-001 正常跑完 → INST-002 进入 `tool_running` 后 `taskkill /F /PID <core.pid>`（pid 取自 `.orch/core.json`，taskkill exit 0）→ 600ms 后 `orch status`（自动拉起新核心并做启动对账）。
- **实际输出**：
  ```
  实例 INST-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 1s · 更新 23:55:04
  实例 INST-002 · 已中断 · 节点 执行中 · 会话 执行中 · 耗时 1s · 更新 23:55:06
  ```
  `status --instance INST-002 --events` 打出：
  ```
  实例 INST-002 · 已中断 ｜ 停在节点 执行中 / 会话 执行中
  节点 执行中
  会话 执行中 · 调用工具（write） · 已运行 1s
  交接包 HO-001  已构造 / 已投递 / 已接受
  23:55:06  实例 INST-002  运行中 → 已中断  原因 core.gone
  ```
- **状态证据**：INST-001 `state="completed"`、`node="done"`、`handoff="consumed"`；INST-002 `state="interrupted"`、`node.note="stopped at node running / session tool_running"`、`handoff.state="accepted"`；强杀前 `events.jsonl` 的 7 行原样保留，重启对账后追加 1 条 `running→interrupted`。
- **判定**：**达标**。实例/节点/会话/交接包/事件 5 项都能查到；未覆盖任何原状态。

### NFR-06 中断后重开不偷偷重跑 — **达标（在本面范围内）**

- **做法**：与 NFR-04 同一现场；重启后再观察 2s。
- **证据**：
  - 强杀前 7 行 → 重启对账追加 1 条 `interrupted` 后为 8 行；再观察 2s 仍为 8 行（8 → 8，未增长）；
  - 节点 `run.started` 仅 1 次；`handoff → delivered` 仅 1 次；
  - 重启后新增事件只有 `instance running→interrupted`（`reason="core.gone"`，`gen` 为新核心代际）；
  - 实例保持 `interrupted`，无 `node→running` 复跑事件。
- **判定**：**达标**。§3.2 中属于夹具面的“不自动重跑”成立；未发现偷偷重跑。

---

## 3. 未通过项汇总

**无。** AC-15~AC-26 全通过，NFR-03/04/06 全达标。

以下为**非阻断观察项**（如实记录，不计入不通过）：

| # | 观察 | 说明 / 线索 |
|---|---|---|
| O-1 | `orch run` 在失败收尾会把同一条失败文案打印两次（节点行 + 独立的失败摘要行） | AC-20/21/22 输出可见，例如 `节点 失败 · 执行失败：…` 之后又有一行 `执行失败：…`。需求未禁止重复，不影响 9 条文案的逐字正确性；若要收紧，可只在 `renderNodeLine` 已含 failure 时跳过 `renderNodeFailure` 摘要行（`src/cli/main.js:335-336`）。 |
| O-2 | AC-21 的“停在哪一步”没有独立 `step` 字段 | 本迭代单节点，节点行 + `node running→failed` 事件即停点。`renderNodeFailure` 的 `HOST_ERROR` 分支只拼 `{raw}`（`src/cli/render.js:265-267`），未拼 `step`。如需逐字“停在哪一步”，建议节点失败行加 `@节点 T-001` 或独立 step。 |
| O-3 | requirement §3.3 的 `--illegal-transition` 开关在 `mock-acp-agent.js` 中不存在 | AC-26 按任务书改用 `attempt-transition.mjs`，仍走真实 `state-machine` + `event-bus` + `instance-store`，事件落在同一 `events.jsonl`。属需求/夹具文档口径不一致，不影响 AC-26 结论。 |
| O-4 | 任务书的“AC-25 关键口径提示”（`--slow-tool` + `cancel` 迟到帧）与 requirement AC-25 原文（上一个任务的收尾不影响下一个）不是同一条 | 两条都跑：AC-25 原文判通过（`evidence/AC-25.*`），提示口径另存 `evidence/AC-25.supplement.*` 也通过。判定以 requirement 原文为准。 |

---

## 4. 夹具可信度声明

1. **走的是产品同一条路径**：`orch` CLI → 命名管道 IPC → 常驻核心 → `createAdapterFactory` → `loadHostConfig`（读 `.orch/hosts/dsh.json`）→ `createStdioTransport`（`spawn` 真实子进程）→ `createAcpClient`（NDJSON over stdio）→ `session/new` / `session/prompt`。mock 是**真正的独立 Node 进程**，不是内存桩；适配器完全不知道它是 mock（`src/adapter/factory.js:56-107`、`src/adapter/dsh-launch.js:100-116`）。
2. **夹具只替换宿主与时钟，不替换裁决**：会话归并（`session-state.js`）、交接包状态机（`handoff-tracker.js`）、三层状态机（`state-machine.js`）、事件总线与持久化（`event-bus.js` / `instance-store.js`）全部是产品实现。
3. **三种夹具的边界，逐项说明**：
   - `mock-acp-agent.js`：产品路径，**无绕过**。AC-15~AC-25 的主判定都建立在 `orch` 命令输出 + 产品 `state.json` / `events.jsonl` 上。
   - `probe-adapter.mjs`：适配器层探针，绕过 CLI/核心/编排层，但使用**真实的** `createStdioTransport` + `createAcpClient` + `createNormalizer` + `createHandoffTracker`。只用于 AC-15/16/19 的补充观察（观察窗口过窄的采样），**不单独作为判定依据**；三条 AC 同时有产品路径证据。
   - `attempt-transition.mjs`：绕过常驻核心的 IPC 路由，直接调用**真实的** `createStore` + `createEventBus` + 三台状态机，把拒绝事件写进同一 `events.jsonl`。这是任务书为 AC-26 指定的夹具；它证明的是核心裁决与事件落盘，不是 IPC 路由。
4. **没有用“夹具绕过后看起来对”当通过**：AC-17/18 的审批策略由环境变量 `MAESTRO_PERMISSION_POLICY` 驱动核心真实应答（allow/reject/hold 三条分支都在 `orchestrator.js:670-681`）；AC-19 的 accepted 判定读的是产品事件里的 `detail.event`，不是探针自报；AC-23 的“无新事件”要求 `sessionIdleMs > 10s`（实测 10.8s），不是只改文案；AC-24 的等待时长来自 `handoff.deliveredAt` 与当前时间差。
5. **验收期间只修了“测量口径”，没改产品**：未修改 `src/**`、`test/**`、`bin/**`、`package.json`、`requirement.md`。三处夹具脚本修正均已披露并重跑：
   - AC-19：探针只给 `--noise-on-session-new` 时，噪声在 `delivered` 之前到达，探针的“交付后首条噪声”永远采样不到；补 `--noise-on-prompt` 让噪声落在 `delivered` 之后（产品面断言未动）。
   - AC-25：最初两个任务共用同一配置（都吃 4s 接受延迟），采样时 INST-002 已跑完，等于没在“开始处理之前”观察；改为每次 run 前重写宿主配置（INST-001 1.5s / INST-002 6s 接受延迟），并用“实例仍为运行中 + created 后 1790ms”证明窗口真实。
   - NFR-06：最初按“强杀时刻”切分新增事件，撞上 `tool_running` 落盘与采样的毫秒级竞态；改用产品自带的核心代际 `gen` 区分旧核心/新核心写入的事件。
6. **环境隔离**：全部项目根在 `%TEMP%/maestro-acc-f/proj/`；未设置 `DSH_HOME`，未访问真实家目录，未使用真实模型凭据（全部 mock）。并行产品面 Agent 的 `%TEMP%/maestro-acc-p/` 未被触碰。
7. **进程清理**：每例结束执行 `orch core stop`；NFR-04 的强杀场景在重启取证后同样 `core stop`。批次结束后 `tasklist` 仅剩 WorkBuddy 自身与并行产品面 Agent 的 node 进程，**没有** `maestro-acc-f` 的核心或 mock 孤儿进程。

---

## 附：证据文件索引

| 文件 | 内容 |
|---|---|
| `evidence/AC-xx.meta.json` | 场景、开关、环境变量、逐条断言（`checks[].ok/actual`）、判定、备注 |
| `evidence/AC-xx.output.json` | 每条命令的完整命令行、cwd、env、退出码、原始 stdout/stderr |
| `evidence/AC-xx.state.json` | `state.json` 的验收摘要（实例/节点/会话/交接包/hostRaw/artifactRefs） |
| `evidence/AC-xx.events.jsonl` | 相关实例的 `events.jsonl` 原文（逐行原样，按实例分段注释） |
| `evidence/_fixture-run-summary.json` | 本批次 16 项（12 AC + 1 补充 + 3 NFR）的汇总 |
