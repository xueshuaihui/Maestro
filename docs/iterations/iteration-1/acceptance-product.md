# I1.1 验收记录（产品命令面）

> 执行人：独立验收子 Agent（产品命令面）｜ 依据：`requirement.md` **v5** §3.1 / §3.2 / §3.3
> 环境：DSH `0.2.1-rc.5`（`%LOCALAPPDATA%\Programs\DeepSeek Harness`，与 `dsh-probe.md` 同一二进制）｜ 模型路由 `deepseek-account / deepseek-flash`（真实账号令牌，**未使用任何 mock**）
> DSH_HOME：**已隔离** `%TEMP%\maestro-acc-p\dsh-home`（`profiles/acp/cordis.patch.yml` 已改两行 provider/model，`--dump-config` 复核生效）；全程未写 `~/.dsh`
> 项目根：`%TEMP%\maestro-acc-p\proj`（**不在** `D:\WWW\Maestro`，规避 ACL 沙箱膨胀）；任务 cwd：`proj\demo`
> 验收时间：2026-11-04 23:45 ~ 2026-11-05 00:05（本地）
> 采集方式：`probe/acc-p-ac.mjs` / `probe/acc-p-nfr.mjs` 脚本落盘（未手抄），证据见 `evidence/AC-xx.{output.txt,state.json,events.jsonl,meta.json}`

## 0. 总判

**AC-01~AC-14：通过 14 / 不通过 0 / 阻塞 0 ｜ NFR（本人负责 4 条）：达标 4 / 未达标 0 / 未测 0**

一句话结论：在真实 DSH + 真实模型、隔离 home、`%TEMP%` 项目根下，14 条产品命令面验收标准**逐条实跑全部成立**；需求 v5 的每个 `Then` 都能在 `orch` 输出与 `.orch/instances/<id>/` 的 `state.json`、`events.jsonl` 里找到对应证据。仅有 2 处**字面口径的边界**（AC-05 的 2ms 边界、AC-14 的创建事件无 from），均在下方逐字标注，不构成不通过。

---

## 1. AC 逐条记录

> 统一前置：项目根 = `C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p/proj`；每条 AC 用全新实例号（INST-101 ~ INST-114），互不共用实例。核心的处置：需要"冷环境"或换了环境变量的 AC（07/08/09/10/11/12/13/14）在开始前 `orch core stop`；需要"热启动"的 AC（01/02/03/04/05/06）先预热同一核心。每批跑完做 `tasklist` 自查，收尾时确认该项目根没有孤儿核心（详见 §4）。
> 统一环境变量：`DSH_HOME=C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p/dsh-home`

### AC-01 一条命令跑通单节点任务
- **验证面**：产品命令（真实 DSH + 真实模型）
- **怎么做的**（采集脚本同口径，先 `orch status` 拉起核心=热启动口径，再跑主命令）：
```bash
cd C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p/proj
DSH_HOME=C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p/dsh-home node D:/WWW/Maestro/bin/orch.js status
DSH_HOME=... node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-101 \
  --task "写一段 200 字的产品说明，保存到 out/intro.md"
```
- **看到什么**（原始输出，行首为相对 CLI spawn 的毫秒）：
```text
+   2337ms  实例 INST-101 · 运行中
+   2338ms  会话已创建 4ae7e126-c1bf-4bed-98eb-8742da0418af
+   2338ms  任务已投递
+   2339ms  会话 空闲
+   4091ms  会话 执行中 · 调用工具（pwsh） · 已运行 4s
...
+  47541ms  会话 等待下游 · 产出已提交
+  47580ms  会话 空闲
+  47646ms  节点 已完成 · 耗时 47s
+  47648ms  交接包 HO-001  已构造   23:47:19
+  47648ms  交接包 HO-001  已投递   23:47:19
+  47648ms  交接包 HO-001  已接受   23:47:21
+  47648ms  交接包 HO-001  已完成   23:48:04
[exit 0]
```
- **状态证据**：
  - `state.json`：`"state":"completed"`、`node.state="done"`、`node.endedAt=2026-11-04T15:48:04.8…Z`、`handoff.state="consumed"`、`artifactRefs[0]={ref:"out/intro.md", declared:true, exists:true, bytes:632}`
  - `events.jsonl`（关键行原文）：
    ```json
    {"object":"instance","objectId":"INST-101","from":"created","to":"running","result":"applied","reason":"run.started",...,"seq":1,"ts":"2026-11-04T15:47:19.572Z"}
    {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed",...,"seq":27,"ts":"2026-11-04T15:48:04.819Z"}
    {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed",...,"seq":28,"ts":"2026-11-04T15:48:04.822Z"}
    ```
  - 产物：`proj\demo\out\intro.md` 存在，632 B
- **判定**：**通过** —— 三行在 **2338ms** 内出现（热启动 ≤5s）；会话行出现 `执行中 · 已运行 4s`；节点 `已完成 · 耗时 47s`；交接包 `已完成`；exit 0；声明产出真实落盘非空。

### AC-02 任务结束后能查到这次的全部状态
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-102 --task "写一段 200 字的产品说明，保存到 out/intro.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-102
node D:/WWW/Maestro/bin/orch.js status
node D:/WWW/Maestro/bin/orch.js core stop
node D:/WWW/Maestro/bin/orch.js status --instance INST-102     # 核心已停，应自动拉起
node probe/acc-p-ping.mjs                                       # ensure:false 的 core.ping 探针
```
- **看到什么**：
```text
# status --instance INST-102
+    101ms  实例 INST-102 · 已完成
+    101ms  节点 已完成 · 耗时 23s
+    101ms  会话 空闲
+    102ms  交接包 HO-001  已构造   23:48:07
+    102ms  交接包 HO-001  已投递   23:48:07
+    102ms  交接包 HO-001  已接受   23:48:09
+    102ms  交接包 HO-001  已完成   23:48:28
[exit 0]

# status（无参列表）
实例 INST-102 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 23s · 更新 23:48:28
```
- **状态证据**：`state.json` = `completed / done / idle / handoff consumed`；IPC 探针（`core.ping`，ensure:false）：
  ```text
  core stop 前:  {"connected":true,"pid":32316}
  core stop 后:  {"connected":false,"code":"CORE_NOT_RUNNING"}
  status 之后:   {"connected":true,"pid":31480}      ← 新核心被 status 拉起
  ```
- **走 IPC 而非直接读文件（依据）**：
  1. 代码路径唯一：`src/cli/main.js:406` 走 `client.request('instance.get')`，`src/cli/main.js` 全文无读取 `instance/` 目录的 `fs` 调用；
  2. 行为证据：核心被 `core stop` 停掉后 `status` 仍给出完整四类状态，而探针显示**这是另一个 pid 的新核心**（32316 → 31480），说明 CLI 是向核心取数、由核心读盘并归一化，不是 CLI 自己解析 `state.json`；
  3. 反证：`state.json` 损坏时 `status` 报 `状态不可读`（AC-13），即输出由核心判定，不是 CLI 直读 JSON。
- **判定**：**通过** —— 实例/节点/会话/交接包四类当前状态齐全；无参列表能按实例号认出 `INST-102`。

### AC-03 执行中显示已运行时长
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-103 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md" &
node D:/WWW/Maestro/bin/orch.js status --instance INST-103   # T
sleep 4
node D:/WWW/Maestro/bin/orch.js status --instance INST-103   # T+4s
```
- **看到什么**：
```text
# 第 1 次（15:48:54.259）
实例 INST-103 · 运行中
节点 执行中
会话 执行中 · 调用工具（pwsh） · 已运行 5s
交接包 HO-001  已投递   23:48:51 / 已接受   23:48:54
[exit 0]

# 第 2 次（15:48:58.370，隔 4.1s）
实例 INST-103 · 运行中
节点 执行中
会话 执行中 · 调用工具（pwsh） · 已运行 9s
[exit 0]
```
- **状态证据**：`state.json` 落的是**终态快照**（`state=completed`、`session.state=idle`、`session.stateSince=2026-11-04T15:49:14.382Z`）；执行中的时长由核心 `instance.get` 快照计算（`src/core/orchestrator.js` 的 `elapsedMs`，缺失时按 `session.stateSince` 回算，见 `src/cli/render.js:91-96`），**不是 CLI 自计时**——两次 `status` 是两次独立进程，数值仍从 5s 走到 9s 即为证。
- **判定**：**通过** —— 会话行含 `执行中`；含 `已运行 5s`；第二次 `9s` > 第一次 `5s`（严格更大）。

### AC-04 交接包依次走完四步
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-104 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-104 --events
```
- **看到什么**：
```text
交接包 HO-001  已构造   23:49:16
交接包 HO-001  已投递   23:49:16
交接包 HO-001  已接受   23:49:18
交接包 HO-001  已完成   23:49:51

23:49:16  交接包 HO-001  已构造  原因 handoff.created
23:49:16  交接包 HO-001  已构造 → 已投递  原因 handoff.delivered
23:49:18  交接包 HO-001  已投递 → 已接受  原因 turn.first_event
23:49:51  交接包 HO-001  已接受 → 已完成  原因 handoff.consumed
```
- **状态证据**：`state.json handoff` = `createdAt 15:49:16.885Z → deliveredAt .891Z → acceptedAt 15:49:18.567Z → consumedAt 15:49:51.102Z`（ISO 单调不减）；`events.jsonl` 中 handoff 的 `to` 序列（按 seq）= `created, delivered, accepted, consumed`。
- **判定**：**通过** —— 四步顺序正确（显示与事件一致）；每条都有时间戳；时间戳单调不减（显示到秒，底层 ISO 毫秒级单调）。

### AC-05 已接受与已完成是两个不同时刻
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-105 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-105 --events
```
- **看到什么**：
```text
交接包 HO-001  已构造   00:03:44
交接包 HO-001  已投递   00:03:44
交接包 HO-001  已接受   00:03:51
交接包 HO-001  已完成   00:04:31
```
- **状态证据**（events.jsonl 原文，seq 单调）：
```json
{"object":"handoff","objectId":"HO-001","from":"delivered","to":"accepted","result":"applied","reason":"turn.first_event",...,"seq":6,"ts":"2026-11-04T16:03:51.757Z"}
{"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted",...,"seq":24,"ts":"2026-11-04T16:04:31.422Z"}
{"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed",...,"seq":25,"ts":"2026-11-04T16:04:31.434Z"}
{"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed",...,"seq":26,"ts":"2026-11-04T16:04:31.436Z"}
```
- **判定**：**通过**，附口径说明 —— 已接受 `16:03:51.757` 早于已完成 `16:04:31.436`（相差 39.7s），非同刻；两者之间节点经 `running→review`（seq 24），在整整 40s 窗口内节点是"待校验"。**边界**：节点 `review→done`（seq 25，`.434`）比交接包 `consumed`（seq 26，`.436`）早 **2ms**，因此"已完成那条之前"的最后 2ms 内节点已是"已完成"——这是"核对通过→节点完成→交接包完成"同一动作内的正常顺序（`done` 的 reason 是 `verification.passed`，不是提前跳转）。按 BR-02 的实质要求（已接受 ≠ 已完成、核对通过才算完成）判定通过。

### AC-06 节点经"待校验"才到"已完成"
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-106 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-106 --events
```
- **看到什么**：
```text
+  27171ms  会话 等待下游 · 产出已提交
+  27290ms  节点 已完成 · 耗时 27s
+  27292ms  交接包 HO-001  已投递   23:50:30
+  27292ms  交接包 HO-001  已接受   23:50:39
+  27292ms  交接包 HO-001  已完成   23:50:55

23:50:55  节点 T-001  执行中 → 待校验  原因 output.submitted
23:50:55  节点 T-001  待校验 → 已完成  原因 verification.passed
```
- **状态证据**：
```json
{"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted",...,"seq":18,"ts":"2026-11-04T15:50:55.441Z"}
{"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed",...,"seq":19,"ts":"2026-11-04T15:50:55.455Z"}
{"object":"session","objectId":"cb472d24-…","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted",...,"seq":17}
```
- **判定**：**通过** —— 有 `执行中→待校验`（seq18）与 `待校验→已完成`（seq19）；会话在提交产出后是 `等待下游 · 产出已提交`，输出里**不存在**"会话 已完成"。

### AC-07 重复发起同一实例的同一节点被拒
- **验证面**：产品命令（两次命令在**同一项目根**执行，只有 `--cwd` 指向任务目录，因此连同一个核心/同一管道）
- **怎么做的**：
```bash
# T1: 长任务，保持执行中
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-107 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md" &
sleep 4
# T2: 同实例再发一次（同一 cwd）
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-107 --task "写一段 200 字的产品说明，保存到 out/intro.md"
```
- **看到什么**：
```text
# T1（15:51:52.093 起）
+   2315ms  实例 INST-107 · 运行中
+   2315ms  会话已创建 1ba66cc6-2b7a-4c7a-a615-f74b0d720398
+   2315ms  任务已投递
+   4823ms  会话 执行中 · 调用工具（pwsh） · 已运行 5s
...
+  17505ms  节点 已完成 · 耗时 17s
[exit 0]

# T2（15:51:56.940，T1 仍在跑）
+    108ms  该节点正在执行，本次未发起
[exit 1]
```
- **状态证据**：`events.jsonl` 中 `object="session"` 的 `objectId` 去重后**只有 1 个**：`['1ba66cc6-2b7a-4c7a-a615-f74b0d720398']`；`state.json session.sessionId` 与之相同；T2 的输出里没有 `实例`/`会话已创建`/`任务已投递` 三行。
- **判定**：**通过** —— 出现 `该节点正在执行，本次未发起`；未出现 `会话已失效`；未新建第二个会话（会话 ID 唯一）。

### AC-08 被拒之后原来那次照常跑完
- **验证面**：产品命令
- **怎么做的**：同 AC-07 的两条命令（实例 `INST-108`），第二次被拒后**不干预**，等第一次自然结束。
- **看到什么**：
```text
# 第一次（16:02:10.834 起，长任务）
+   2286ms  实例 INST-108 · 运行中
+   2286ms  会话已创建 b42c8ed4-c2cf-4693-a0f8-5048b0189247
+   2286ms  任务已投递
...
+  17961ms  节点 已完成 · 耗时 18s
+  17963ms  交接包 HO-001  已接受   00:02:20
+  17963ms  交接包 HO-001  已完成   00:02:28
[exit 0]

# 第二次（16:02:20.750，被拒）
+    102ms  该节点正在执行，本次未发起
[exit 1]
```
- **状态证据**：`state.json` = `completed / done / idle / consumed`；`events.jsonl` 中 `reason="run.started"` 且 `object="instance"` 的只有 **1 条**；`node→done` 只有 **1 条**；第二次发起**未产生任何** session/实例行。
- **判定**：**通过** —— 原执行正常到 `节点 已完成`、exit 0；无第二次 `run.started`，节点只推进了一次。

### AC-09 DSH 起不来时不留半截
- **验证面**：产品命令（真实 DSH 被环境变量指到不存在的路径）
- **怎么做的**（env 名先读 `src/adapter/dsh-launch.js:70-71` 确认为 `MAESTRO_DSH_EXE` / `MAESTRO_DSH_BIN`）：
```bash
node D:/WWW/Maestro/bin/orch.js core stop
MAESTRO_DSH_EXE="C:/maestro-acc-p-does-not-exist/NoSuchDSH.exe" \
MAESTRO_DSH_BIN="C:/maestro-acc-p-does-not-exist/bin.js" \
  node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-109 --task "写一段 200 字的产品说明，保存到 out/intro.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-109
node D:/WWW/Maestro/bin/orch.js status
```
- **看到什么**：
```text
+    203ms  无法启动 DSH：启动失败：spawn C:/maestro-acc-p-does-not-exist/NoSuchDSH.exe ENOENT
[exit 3]

# status --instance INST-109
+     83ms  实例 INST-109 · 不存在
[exit 1]

# status（列表）：INST-001…INST-108，无 INST-109
```
- **状态证据**：`.orch/instances/INST-109` **不存在**（`fs.existsSync=false`）；`evidence/AC-09.state.json` 落的是 `{"_absent":true,...}`。
- **判定**：**通过** —— 有 `无法启动 DSH：<原因>`；无 `会话已创建`；`status` 里没有这次实例（无半截）。

### AC-10 工作目录不可写时直接失败
- **验证面**：产品命令（真实不可写目录）
- **怎么做的**（Windows 坑：`icacls <dir> /deny xuesh:(W)` 在本机会把 `xuesh` 解析成**机器 SID**，deny 不生效；必须 `域\用户名`）：
```bash
mkdir demo/readonly
icacls "…\proj\demo\readonly" /deny "XUESH\xuesh:(OI)(CI)(W)"     # 写探针验证：EPERM
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo/readonly --instance INST-110 --task "写一段 200 字的产品说明，保存到 out/intro.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-110
icacls "…\proj\demo\readonly" /remove:d "XUESH\xuesh"
```
- **看到什么**：
```text
+    217ms  工作目录不可写：C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p\proj\demo\readonly
[exit 3]

# status --instance INST-110
+     85ms  实例 INST-110 · 不存在
[exit 1]
```
- **状态证据**：写探针 `fs.writeFileSync` → **EPERM**（目录确实不可写）；`.orch/instances/INST-110` 不存在；无 `会话已创建`。
- **判定**：**通过** —— 提示含 `工作目录不可写` 与完整路径；exit 3（失败退出）；未创建任何会话。

### AC-11 取消后不残留
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-111 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md" &
# 等到「会话 执行中」后：
node D:/WWW/Maestro/bin/orch.js cancel --instance INST-111
# 之后每 ~200ms 跑一次 status，最多 5s
node D:/WWW/Maestro/bin/orch.js status --instance INST-111 --events
```
- **看到什么**：
```text
# cancel
+    117ms  会话 空闲
+    117ms  节点 已取消
+    117ms  交接包 HO-001 已拒绝（已撤回）
[exit 0]

# cancel 后第一次 status（+226ms）
实例 INST-111 · 已取消
节点 已取消
会话 空闲
交接包 HO-001  已拒绝   23:55:10  原因 已撤回
[exit 0]
```
- **状态证据**：`state.json` = `instance:"cancelled"`、`node.state:"cancelled"`、`session.state:"idle"`、`handoff.state:"rejected"`、`handoff.rejectReason:"withdrawn"`、`consumedAt:null`；events 末三条：
```json
{"object":"session","from":"tool_running","to":"idle","result":"applied","reason":"run.cancelled","seq":8,"ts":"2026-11-04T15:55:10.255Z"}
{"object":"node","objectId":"T-001","from":"running","to":"cancelled","result":"applied","reason":"run.cancelled","seq":9,"ts":"2026-11-04T15:55:10.258Z"}
{"object":"handoff","objectId":"HO-001","from":"accepted","to":"rejected","result":"applied","reason":"handoff.rejected","detail":{"reason":"withdrawn"},"seq":10,"ts":"2026-11-04T15:55:10.261Z"}
{"object":"instance","objectId":"INST-111","from":"running","to":"cancelled","result":"applied","reason":"run.cancelled","seq":11,"ts":"2026-11-04T15:55:10.269Z"}
```
- **判定**：**通过** —— 会话 **226ms** 内不再显示 `执行中`（回到 `空闲`）；节点 `已取消`；交接包 `已拒绝` 且原因是 `已撤回`（不是"目标拒绝"）；三对象均未停在 `执行中`/`已投递`。

### AC-12 重启后能查，但不偷偷重跑
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-112 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md" &
sleep 10
node D:/WWW/Maestro/bin/orch.js core stop
node D:/WWW/Maestro/bin/orch.js status --instance INST-112 --events
sleep 1.5
node D:/WWW/Maestro/bin/orch.js status --instance INST-112 --events
```
- **看到什么**：
```text
# core stop
+    214ms  核心已停止（pid 8940，运行 12s）

# run 自身收尾（exit 1）
+  11696ms  实例 INST-112 · 已中断 ｜ 核心已停止

# 第 1 次 status --events（核心已重启）
+    209ms  实例 INST-112 · 已中断 ｜ 停在节点 执行中 / 会话 执行中
+    209ms  节点 执行中
+    209ms  会话 执行中 · 调用工具（pwsh） · 已运行 1s
+    210ms  交接包 HO-001  已构造   23:55:13
+    210ms  交接包 HO-001  已投递   23:55:13
+    210ms  交接包 HO-001  已接受   23:55:20
+    212ms  23:55:13  实例 INST-112  已创建 → 运行中  原因 run.started
+    212ms  23:55:13  节点 T-001  待执行 → 执行中  原因 run.started
+    212ms  23:55:13  交接包 HO-001  已构造  原因 handoff.created
+    212ms  23:55:13  交接包 HO-001  已构造 → 已投递  原因 handoff.delivered
+    212ms  23:55:20  会话 0ebca9ec-…  空闲 → 执行中  原因 session.state
+    212ms  23:55:20  交接包 HO-001  已投递 → 已接受  原因 turn.first_event
+    212ms  23:55:20  会话 0ebca9ec-…  执行中 → 执行中（tool_call）  原因 session.state
+    212ms  23:55:22  实例 INST-112  运行中 → 已中断  原因 core.stop
[exit 0]
```
- **状态证据**：`state.json` `"state":"interrupted"`、`node.state="running"`、`node.note="stopped at node running / session tool_running"`、`handoff.state="accepted"`；事件数 **8 → 8**（间隔 1.5s 的两次 status 完全一致），无新增 `run.started`。
- **判定**：**通过** —— 能看到上次的节点/会话/交接包与事件；实例 `已中断` 并注明停点；事件数不变、无新 `run.started`，**没有自动重跑**。

### AC-13 状态记录损坏时不静默清空
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-113 --task "写一段 200 字的产品说明，保存到 out/intro.md"
node D:/WWW/Maestro/bin/orch.js core stop
printf '{"broken' > .orch/instances/INST-113/state.json     # 8 字节非法 JSON
node D:/WWW/Maestro/bin/orch.js status --instance INST-113
cat .orch/instances/INST-113/state.json
```
- **看到什么**：
```text
+    199ms  状态不可读，已备份为 state.json.corrupt（C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p\proj\.orch\instances\INST-113\state.json.corrupt）
[exit 1]

# status（列表）：实例 INST-113 · 状态不可读
```
- **状态证据**：损坏前后 `state.json` 字节完全相同，均为 `{"broken`（`evidence/AC-13.state.json` 就是这 8 字节原文）；`.orch/instances/INST-113/state.json.corrupt` 存在。
- **判定**：**通过** —— 输出 `状态不可读` 且给出真实备份路径（`state.json.corrupt`）；原文件未被清空或覆盖（逐字节相同）。

### AC-14 状态变化可顺着时间线追溯
- **验证面**：产品命令
- **怎么做的**：
```bash
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo --instance INST-114 --task "写一段 200 字的产品说明，保存到 out/intro.md"
node D:/WWW/Maestro/bin/orch.js status --instance INST-114 --events
```
- **看到什么**（`status --events` 输出的摘录，换行与文案原样，长 sessionId 用 `…` 省略）：
```text
00:02:31  实例 INST-114  已创建 → 运行中  原因 run.started
00:02:31  节点 T-001  待执行 → 执行中  原因 run.started
00:02:31  交接包 HO-001  已构造  原因 handoff.created
00:02:31  交接包 HO-001  已构造 → 已投递  原因 handoff.delivered
00:02:33  会话 380c6dcc-…  空闲 → 执行中  原因 session.state
00:02:33  交接包 HO-001  已投递 → 已接受  原因 turn.first_event
00:02:33  会话 380c6dcc-…  执行中 → 执行中（tool_call）  原因 session.state
…
00:03:34  节点 T-001  执行中 → 待校验  原因 output.submitted
00:03:34  节点 T-001  待校验 → 已完成  原因 verification.passed
00:03:34  交接包 HO-001  已接受 → 已完成  原因 handoff.consumed
00:03:34  实例 INST-114  运行中 → 已完成  原因 run.completed
00:03:34  会话 380c6dcc-…  等待下游 → 空闲  原因 run.completed
```
- **状态证据**：32 条事件行 = `events.jsonl` 32 行（不丢行）；显示时钟单调不减；每条都带层名（实例/节点/会话/交接包）+ 对象 ID。
- **判定**：**通过**，附口径说明 —— 31/32 条是 `from → to`；唯一没有 `→` 的是**对象创建**那条（`handoff from:null → created`，显示为 `交接包 HO-001 已构造 原因 handoff.created`），创建事件不存在"前一个状态"。一次 `status --events` 即可从 `已创建` 读到 `已完成`，不需要打开别的文件。

---

## 2. 非功能项记录

### NFR-01 发出任务后多久看到"执行中"（热 ≤5s / 冷 ≤30s）
- **口径**：`spawn(node bin/orch.js)` → 输出中第一次出现 `会话 执行中` / `会话已创建`（采集侧 `Date.now` 差值，不用 CLI 自报）。
- **热启动 10 次**（核心已在跑，任务"只回复 ok，不要写任何文件"）：

| # | 实例 | 会话已创建 | 看到执行中 | exit |
|---|---|---:|---:|---:|
| 1 | INST-301 | 2374ms | 3598ms | 0 |
| 2 | INST-302 | 2466ms | 3320ms | 0 |
| 3 | INST-303 | 2412ms | 3429ms | 0 |
| 4 | INST-304 | 2425ms | 3471ms | 0 |
| 5 | INST-305 | 2301ms | 3212ms | 0 |
| 6 | INST-306 | 2319ms | 3160ms | 0 |
| 7 | INST-307 | 2404ms | 3259ms | 0 |
| 8 | INST-308 | 2173ms | 2980ms | 0 |
| 9 | INST-309 | 2532ms | 3386ms | 0 |
| 10 | INST-310 | 2433ms | 3363ms | 0 |
- **热启动最大值：3598ms（< 5000ms）达标**；"会话已创建"最大 2532ms。
- **冷启动 3 次**（每次先 `orch core stop`，核心与 DSH 全部重新拉起；**只测 3 次**，未凑满 10 次，如实记录）：

| # | 实例 | 会话已创建 | 看到执行中 | exit |
|---|---|---:|---:|---:|
| 1 | INST-401 | 2521ms | 3303ms | 0 |
| 2 | INST-402 | 2418ms | 3310ms | 0 |
| 3 | INST-403 | 2445ms | 3387ms | 0 |
- **冷启动最大值：3387ms（< 30000ms）达标**。冷启动与热启动几乎同量级，因为瓶颈在 DSH 进程启动（~2.4s），核心自身启动约 0.1s。
- **未测**：真正意义的"重启后第一次"（OS 页缓存清空）无法在本机可靠构造，与 `dsh-probe.md` §5.1 的结论一致；本表冷启动是"核心进程冷"，不是"机器冷"。

### NFR-02 状态变化到"我能看到"的延迟（≤1s）
- **抽样方式**：跑 2 轮真实任务，把 `orch run` 流式输出的每行时间戳（相对 CLI spawn）与 `events.jsonl` 中对应迁移的 ISO 时间戳（换算成同一基准）相减；每轮取 3 个可稳定观测的迁移（会话开始执行、会话等待下游、节点已完成），共 **6 个样本**（"节点待校验"是瞬态，不单独成行，故为 6 而非 8）。
- **样本**：

| 迁移 | 输出时刻 | 事件时刻 | 延迟 |
|---|---:|---:|---:|
| session→思考/工具 | +9343ms | +9327ms | **16ms** |
| session→等待下游 | +29608ms | +29605ms | **3ms** |
| node→已完成 | +29709ms | +29626ms | **83ms** |
| session→思考/工具 | +10915ms | +10912ms | **3ms** |
| session→等待下游 | +93306ms | +93302ms | **4ms** |
| node→已完成 | +93384ms | +93322ms | **62ms** |
- **最大 83ms（< 1000ms）达标**。注：这是 `orch run` 实时面；`orch status` 另加一次 CLI 进程启动（实测 87-108ms），合计仍远小于 1s。

### NFR-07 关掉命令行窗口，正在跑的任务不被带走
- **口径**：`orch run` 在后台跑长任务 → `taskkill /PID <pid> /F`（**只杀 CLI，不带 `/T`**；带 `/T` 会连 detached 的核心一起杀，那是另一回事）→ 再 `core.ping` + 两次 `orch status`。
- **做法与结果**（命令为避免重复省略了 `node D:/WWW/Maestro/bin/orch.js` 前缀；完整原文见 `evidence/NFR-07.output.txt`）：
```text
run --cwd ./demo --instance INST-601 --task "写一篇 400 字左右的产品介绍，分三段，保存到 out/long.md"
tasklist /FI "PID eq 30756" /NH            → node.exe 30756 存在
taskkill /PID 30756 /F                     → exit 0「成功: 已终止 PID 为 30756 的进程」
tasklist /FI "PID eq 30756" /NH            → 「没有运行的任务匹配指定标准」
node probe/acc-p-ping.mjs                  → {"connected":true,"pid":30684}   ← 核心 pid 未变
status --instance INST-601                 → 节点 执行中 / 会话 执行中 · 调用工具（read） · 已运行 11s
status --instance INST-601（再查）           → 会话 执行中 · 调用工具（read） · 已运行 11s
```
- **结论**：**达标** —— CLI 确实被 `taskkill /F` 杀掉（PID 消失、run 以 code=1 结束），核心 pid 前后一致（30684），任务继续，`status` 两次都能查到在执行。
- **附带事实**（不属本项判定）：若用 `taskkill /T`（杀进程树），detached 的核心会一起被杀，任务被判 `已中断`——这与"关掉窗口"不是同一动作，已在本记录中区分。

### NFR-08 取消之后多久看不到"执行中"（≤5s）
- **口径**：`orch cancel` 返回时刻起，轮询 `orch status`（每次约 100-250ms），记录第一次会话行不含"执行中"的时刻。
- **结果**：`cancel` 自身耗时 **269ms**（exit 0）；此后第一次 `status` 在 **+359ms** 已显示 `会话 空闲`。**达标（359ms < 5000ms）**。
- AC-11 的独立复测同口径为 **226ms**，两次一致。

---

## 3. 未通过项汇总

**无。** AC-01~AC-14 的每一条 `Then` 都有对应的实跑输出与磁盘证据，未发现不通过项；也未出现"无法构造的场景"（AC-09/AC-10 的异常前置均为真实构造：不存在路径的 DSH、`icacls /deny` 后写探针 EPERM）。

---

## 4. 环境与口径声明

**真实 vs 夹具**
- 本记录全部为**产品命令面、真实 DSH + 真实模型**（`deepseek-account / deepseek-flash`），**未使用 mock LLM、未使用 mock ACP agent**。
- 夹具面（AC-15~26）由另一 Agent 在 `%TEMP%/maestro-acc-f/` 与另一个 DSH_HOME 下执行，本记录未触碰其目录与证据。
- "等待审批"（AC-17/18）与"会话已失效"（AC-20）等真实宿主无法稳定构造的场景不在本人范围。

**环境隔离与副作用**
- `DSH_HOME` = `%TEMP%\maestro-acc-p\dsh-home`，只复制了 `~/.dsh/.credentials.yaml` 与 `.anonymous-user-id`；`cordis.patch.yml` 两处改为 `deepseek-account / deepseek-flash`，`--dump-config` 已复核（`agent-default-model` 与 `acp` 两段均为该组合）。
- **未修改 `~/.dsh` 下任何文件**（只读取凭据用于复制）。验收结束后已删除该 home（含凭据副本）。
- 项目根 `%TEMP%\maestro-acc-p\proj`，任务 cwd 在其 `demo\` 下；**未在 `D:\WWW\Maestro` 内跑过任何任务**（该路径会触发 pwsh 沙箱 `grantWrite` 失败并使 turn 膨胀，见 `dsh-probe.md` §6）。
- 未修改 `src/**`、`test/**`、`bin/**`、`package.json`、`requirement.md`；临时脚本只有 `probe/acc-p-lib.mjs`、`probe/acc-p-ac.mjs`、`probe/acc-p-nfr.mjs`、`probe/acc-p-ping.mjs`。

**被测代码快照**
- `src/cli/render.js` 23:41:07、`src/cli/main.js` 23:41:26、`bin/orch.js` 23:41:30、`test/wp9/cli-e2e.test.js` 23:43:05（均早于本次验收开始 23:45）。即：本轮验的是 `review-round2.md`（22:44 快照）**之后**的一版，其中 C-1（`SESSION_INVALID` 落成"未知错误"）与 C-2（`tool_running` 行不含"已运行"）已能在 `src/cli/render.js:167-175,253-255` 看到修复；本轮 AC-03 / AC-20（后者由夹具面 Agent 负责）不再受这两条影响。本人未改这些文件。

**测了几次 / 哪些没测**
- AC 每条独立实例、独立执行一次；AC-05/AC-08/AC-10/AC-14 因断言口径修正或前置构造失败重跑过一次（重跑前清掉同号实例目录，`meta.json` 记录的是最终这轮）。
- NFR-01：热启动 10 次、冷启动 3 次（未凑 10 次）；NFR-02：6 个样本；NFR-07：1 次真实 kill（外加 1 次误用 `/T` 的对照，已说明）；NFR-08：2 次（NFR-08 自身 1 次 + AC-11 同口径 1 次）。
- **没测**：机器级冷启动（无法清页缓存）；`orch status` 在 10 分钟内高频轮询的长期稳定性（不在本人 4 项 NFR 内）。

**已知的次要观察（不影响任何 AC 判定，仅备查）**
1. 每次 `orch run` 在 `任务已投递` 之后都会先打一行 `会话 空闲`（会话刚建好、turn 未开始），与 BR-05 一致，但会让人误以为"没跑起来"。
2. 核心重启后（AC-12），会话行的"已运行 Ns"按 `session.stateSince`（最后一次状态变化）重算，显示 `1s` 而不是中断前的 `10s`；AC-03 的"时长递增"在核心存活期间成立。需求未对"重启后的已运行时长"提要求，记为展示口径问题。
3. `events.jsonl` 的创建事件（`from:null`）在 `--events` 里没有 `→`，见 AC-14 的口径说明。
4. `.orch/instances/` 目录里保留了本次全部实例（INST-001 冒烟 + 101~114 + 301~310 + 401~403 + 601/602），供复核；如需清理可直接删 `%TEMP%\maestro-acc-p\proj`。
