# I1.1 前置探针：DSH 内置 ACP server（stdio）实跑记录

- 结论：**打通**（真实宿主 + 真实账号模型，`write` 真实落盘，断言全绿）。
- 实测日期：2026-11-04
- DSH：`0.2.1-rc.5`，`%LOCALAPPDATA%\Programs\DeepSeek Harness`
- 模型：`deepseek-account / deepseek-flash`（账号令牌，非 mock）
- 探针代码：`probe/acp-probe.mjs`（最小 ACP 客户端）、`probe/summarize.mjs`（汇总/重建总帧日志）
- 原始记录：`probe/runs/frames.jsonl`（117 帧，双向原文 + 时间戳）、`probe/runs/<runId>/{frames.jsonl,result.json,stderr.log,artifact-probe.md}`、`probe/runs/summary.json`
- 每组数字均来自 `result.json` / `frames.jsonl`，无估算。

---

## 1. 可复现启动命令

### 1.1 目录约定

| 名称 | 值 |
|---|---|
| 安装目录 | `C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness` |
| CLI 入口（asar 内） | `<安装目录>/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js` |
| 隔离 DSH_HOME | `D:/WWW/Maestro/probe/dsh-home`（**不是** `~/.dsh`） |

### 1.2 从零准备隔离 home（Git Bash，照抄可跑）

```bash
# 0) 项目根
cd /d/WWW/Maestro

# 1) 建隔离 home，复制账号凭据（测试完成后必须删除这一份）
mkdir -p probe/dsh-home
cp ~/.dsh/.credentials.yaml probe/dsh-home/.credentials.yaml
cp ~/.dsh/.anonymous-user-id probe/dsh-home/.anonymous-user-id

# 2) 先跑一次 dump-config，materialize profiles/acp/*
DSH="C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness"
DSH_HOME="D:/WWW/Maestro/probe/dsh-home" ELECTRON_RUN_AS_NODE=1 \
  "$DSH/DeepSeek Harness.exe" \
  "$DSH/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  --profile acp --dump-config
```

此时生成 `probe/dsh-home/profiles/acp/`（`cordis.yml` 为 `[]`，`package.json` 的 bundles 是 `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-acp-app`）。把 `cordis.patch.yml` 换成：

```yaml
# 本机只有账号令牌，acp bundle 默认的 deepseek-official + API key 不可用
- id: agent-default-model
  config:
    provider: deepseek-account
    model: deepseek-flash
- id: acp
  config:
    provider: deepseek-account
    model: deepseek-flash
```

复核（应看到两处都变成 `deepseek-account` / `deepseek-flash`）：

```bash
DSH_HOME="D:/WWW/Maestro/probe/dsh-home" ELECTRON_RUN_AS_NODE=1 \
  "$DSH/DeepSeek Harness.exe" \
  "$DSH/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  --profile acp --dump-config | grep -A3 'id: agent-default-model\|^- id: acp$'
```

`--dump-config` 里相关行（原样摘录，`probe/runs/dump-config.txt`）：

```yaml
- id: acp-app-startup
  name: '@deepseek-ai/dsh-acp-app'
- id: acp
  name: '@deepseek-ai/dsh-acp'
  inject:
    - acpAppStartup
  config:
    provider: deepseek-official   # 默认值；本机改为 deepseek-account
    model: deepseek-v4-flash      # 默认值；本机改为 deepseek-flash
```

### 1.3 一行启动命令（ACP server 本身）

```bash
DSH_HOME="D:/WWW/Maestro/probe/dsh-home" ELECTRON_RUN_AS_NODE=1 "C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe" "C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js" --profile acp
```

它不打印任何欢迎语，stdout 全部属于 ACP；**stdin EOF 即退出**（`dsh-acp-app` 用 `exitOnStdinEnd` 绑定生命周期）。

### 1.4 三个 Windows 细节（都实际踩过）

1. **路径不能写 MSYS 形式**。`/c/Users/...` 传给 Electron 会被解析成 `D:\c\Users\...`（当前盘符拼接），报 `Cannot find module`。必须用 `C:/...` 或 `C:\...`。
2. **本机 shell 里 `ELECTRON_RUN_AS_NODE=1` 是常驻的**（`echo $ELECTRON_RUN_AS_NODE` → `1`）。对 CLI 正好需要；但它会让**桌面 Electron 应用**退化成纯 Node，启动 GUI 时必须显式 `unset`/`delete`。
3. 实际跑 ACP 的 Node 是 Electron 自带 **v24.21.0**，不是系统的 v22.22.2（`--version` 之外可由报错栈看出）。

---

## 2. 分帧格式结论

**结论：NDJSON（一行一个 JSON，`\n` 分隔），没有 `Content-Length` 头，没有 `\r\n\r\n`。**

三条独立证据：

1. **实测首块字节**（`write-01` 的 `framingSniff`）：

```json
{
  "firstBytesHex": "7b226a736f6e727063223a22322e30222c226964223a312c22726573756c74223a7b2270726f746f636f6c5665727369",
  "firstBytesUtf8": "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":1,\"agentInfo",
  "startsWithContentLength": false,
  "startsWithJson": true,
  "hasCrLfCrLf": false
}
```

`7b` = `{`，且首块内不存在 `\r\n\r\n`；整轮 18 行、最长一行 1381 字节，全部以 `\n` 结尾。

2. **真实帧原文**（`probe/runs/write-01/frames.jsonl`，行首即 `{`，行尾即 `\n`；为可读性此处折行，实际是**一行**）：

```
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"1ea7ef7a-82d5-4123-9a69-83cfa523d2d3","update":{"sessionUpdate":"tool_call","toolCallId":"call_00_C1T17yWzBqfSVfh9lb3U6484","title":"write","kind":"other","status":"in_progress","rawInput":{"file_path":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-i11-probe\\write-01\\workspace\\out\\probe.md","content":"# DSH ACP 探针\n探针写入成功：你好，Maestro。"}}}}
```

3. **宿主源码**：`dsh-acp/lib/index.js:1361` 直接使用 `ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin))`；`@agentclientprotocol/sdk@1.4.0` 的 `PROTOCOL_VERSION = 1`。

> 与阶段零的 evidence 样本不冲突：样本只保存了解析后的 `frames`，没有保存原始分帧；`session-update-sample.json` 的 `source` 是 `stdio.jsonl`，也说明是行式日志。

---

## 3. `initialize` 能力原文（关键字段）

请求（`probe/acp-probe.mjs`）：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":false,"writeTextFile":false},"terminal":false},"clientInfo":{"name":"maestro-probe","version":"0.1.0"}}}
```

响应（原文）：

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentInfo":{"name":"deepseek-harness-acp","version":"0.0.1"},"agentCapabilities":{"mcpCapabilities":{"http":true},"promptCapabilities":{"image":true,"audio":false,"embeddedContext":false},"sessionCapabilities":{"close":{},"list":{},"resume":{}}},"authMethods":[]}}
```

- `sessionCapabilities = {close, list, resume}`，**没有 `load`**（与阶段零一致）。
- `promptCapabilities.image = true`（本版本新增/此前未记录）。
- `session/new` 响应里的 `configOptions` 证明 patch 生效：`currentValue` 为 `["deepseek-account","deepseek-flash"]`，另有 `reasoning_effort = high`。
- `session/new` 的 `cwd` **必须是绝对路径**（宿主 `validateWorkspaceParams` 会对相对路径直接 `invalidParams`）。

---

## 4. 一轮真实任务的完整时间线

运行：`write-01`，cwd = `C:\Users\xuesh\AppData\Local\Temp\maestro-i11-probe\write-01\workspace`。
任务：用 `write` 工具写 `out/probe.md`，内容固定为 `# DSH ACP 探针\n探针写入成功：你好，Maestro。`。

### 4.1 时间线（t=0 为 `spawn()` 调用时刻，单位 ms）

| 事件 | t（累计） | 与上一阶段之差 |
|---|---:|---:|
| `spawn()` | 0 | — |
| 写出 `initialize` | 24.794 | 24.794（进程冷启 + 写管道） |
| 收到 `initialize` 响应 | **2000.688** | 1975.894 |
| 写出 `session/new` | 2000.832 | 0.144 |
| 收到 `session/new` 响应 | **2209.191** | 208.359 |
| 写出 `session/prompt` | 2209.230 | 0.039 |
| 第一条 `session/update` | **4321.125** | 2111.895 |
| `tool_call` (write, in_progress) | 4321.598 | 0.473 |
| `tool_call_update` (completed) | 4342.519 | 20.921 |
| 最后一条 update（`usage_update`） | 6537.152 | — |
| 收到 `session/prompt` 响应 `end_turn` | **6537.343** | 4328.113（整个 turn） |
| 子进程退出（stdin EOF 后） | 6916.399 | 379.056 |

关键点：**`session/prompt` 是阻塞请求**，响应直到 turn 结束才返回，且只带 `{"stopReason":"end_turn"}`。所有过程信息都在 `session/update` 通知里。

### 4.2 update 序列（`sessionUpdate` 判别值，按出现顺序）

| # | t (ms) | sessionUpdate | 载荷要点 | 分类 |
|---:|---:|---|---|---|
| 1 | 4320.983 | `agent_thought_chunk` | 模型思考文本 | 进展（turn 已开始） |
| 2 | 4321.377 | `usage_update` | `used=6660 size=1048576` | **噪声** |
| 3 | 4321.598 | `tool_call` | `title=write, kind=other, status=in_progress, rawInput{file_path,content}` | **关键** |
| 4 | 4342.519 | `tool_call_update` | `status=completed`，**无 content/diff/rawOutput** | **关键** |
| 5 | 5476.305 | `agent_thought_chunk` | 思考 | 进展 |
| 6 | 5476.701 | `usage_update` | `used=6880` | **噪声** |
| 7 | 5476.832 | `tool_call` | `title=read, status=in_progress` | 进展 |
| 8 | 5483.983 | `tool_call_update` | `status=completed` | 进展 |
| 9 | 6536.660 | `agent_message_chunk` | 最终答复文本 | **关键（可判完成）** |
| 10 | 6537.152 | `usage_update` | `used=7062` | **噪声** |

- 本轮 11 条入站 `session/update` 中 4 条是 `usage_update`（36.4%）。
- **本批 7 次运行中 `available_commands_update` 出现 0 次**（阶段零记录为建会话后/turn 结束后必发，见 §6）。
- `tool_call_update` 只有 `status` 与文本，没有 diff / rawOutput / 指纹；产物指纹必须由客户端自己算。

### 4.3 断言（脚本自动判定，`result.json.assertions`）

```json
{"toolCompleted": true, "fileExists": true, "contentExact": true, "contentTrimmedEqual": true, "stopReasonEndTurn": true, "allPassed": true}
```

落盘结果：57 字节，`sha256 = 42ab47684c815782e997b5edad987736266a75e82ae536459062bf09a10bcc48`，三次运行（write-01/02/03）**字节级一致**。`permissionsRequested = 0`（写 cwd 内文件不触发审批，与阶段零一致）。

---

## 5. 三个时延结论

### 5.1 热启动 / 冷启动

三次热运行（同一台机器、同一会话内连续跑）：

| 阶段 | write-01 | write-02 | write-03 | 区间 |
|---|---:|---:|---:|---:|
| spawn → `initialize` 响应 | 2000.688 | 1715.408 | 1780.415 | 1.715–2.001 s |
| spawn → `session/new` 响应 | 2209.191 | 1974.851 | 1938.410 | 1.938–2.209 s |
| spawn → prompt 第一帧 | 4321.125 | 3752.358 | 4757.809 | 3.752–4.758 s |
| spawn → turn 结束 | 6537.343 | 5966.863 | 6638.984 | 5.967–6.639 s |
| turn 时长（prompt 发出→响应） | 4328.1 | 3992.0 | 4700.6 | 3.99–4.70 s |

以 NFR-01 的口径「敲下命令到看见执行中」= `spawn → session/new 响应`（此时已有 sessionId，可显示“会话已创建/任务已投递”）：**1.94–2.21 s，热启动 5 s 目标达标**；即使算到「第一帧可观测进展」也只要 3.75–4.76 s。

**冷启动：本次无法给出可信数字，标记为未实测。** 原因：本机没有可用的文件缓存清理手段（不允许装 Sysinternals/EmptyStandbyList，也不允许重启），所有运行都命中了 OS 页缓存；把首轮 2.00 s 当冷启动会是伪造。已知的上界证据是：在系统负载波动时 `initialize` 曾达 3754 ms（`busy-01`，同二进制、同路径），仍未接近 30 s。**建议在 I1.1 验收前用「重启后第一次 spawn」补一条冷启动记录**，不要用本表的数字充数。

### 5.2 同一会话背靠背两次 prompt（忙时）

两次独立运行，结果一致（`busy-01` / `acl-repro-01`）：

- 第二个 `session/prompt` 在 **2.549 / 2.769 ms** 内返回错误；
- `code = -32602`，`message = "Invalid params: a prompt is already in flight for this session"`；
- 不排队、不合并，第一个 turn 不受影响（最终仍 `end_turn`）。

⚠️ 与阶段零的差异：message **带了 `Invalid params: ` 前缀**。判定必须用 `message.includes('already in flight')`，不能按 code，也不能按全等字符串。

### 5.3 `session/cancel` 生效延迟

`session/cancel` 是**通知**（无 id、无响应），只能从随后 `session/prompt` 响应里的 `stopReason` 判断是否生效。

| 场景 | 发出 cancel 时 turn 的状态 | 到 `stopReason: cancelled` 的延迟 | 停止时工具状态 |
|---|---|---:|---|
| `cancel-01` | 模型思考中（prompt 后 1203 ms） | **13.148 ms** | 无工具 |
| `cancel-02` | `pwsh` 执行中（tool_call 后 1541 ms，命令是 `Start-Sleep -Seconds 20`） | **56.173 ms** | `tool_call_update.status = failed`，文本 `Error: tool call aborted` |

结论：cancel 有效，且能真正中断正在跑的 shell 子进程（不是等命令自然结束）；两个场景都在 60 ms 内收敛，实现里 1 s 级的取消超时足够。

---

## 6. 与阶段零记录的差异清单

| # | 阶段零记录 | 本次实测 | 影响 |
|---|---|---|---|
| 1 | `-32602` 的 message 是 `a prompt is already in flight for this session` | 实际是 `Invalid params: a prompt is already in flight for this session` | 字符串全等匹配会漏判，必须用 `includes` |
| 2 | 噪声帧 = `available_commands_update`（建会话后/turn 结束后）+ `usage_update`，占流量 50% | 7 次运行 **0 次** `available_commands_update`；`usage_update` 仍在（write-01 占 36.4%） | 不能假设一定有 `available_commands_update`；过滤要按白名单，而不是“见到就跳过某个固定序列” |
| 3 | initialize 只记了 `sessionCapabilities={close,list,resume}` | 同左；另测得 `promptCapabilities.image=true`、`agentInfo={deepseek-harness-acp,0.0.1}` | 状态归一化可继续依赖 `sessionCapabilities` |
| 4 | acp 行默认 provider/model 只写“默认走 deepseek-official + API key” | 默认值是 `deepseek-official` / **`deepseek-v4-flash`**（agent-default-model 是 `deepseek-flash`） | patch 两行都要改，且模型名不同名 |
| 5 | 未记录逐阶段启动耗时，只知单轮 1845 ms（G-1） | spawn→init 1.69–2.00 s；spawn→new 1.94–2.21 s；turn 4.0–4.7 s | 热启动 5 s 目标有据可依；冷启动仍缺 |
| 6 | 未遇到 shell 沙箱 ACL 问题（阶段零用 `%TEMP%` cwd） | **cwd 在 `D:\WWW\Maestro` 下时 `pwsh` 直接失败**：`Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\WWW\Maestro\probe\runs\acl-repro-01\workspace)`；模型自动加载 `diagnose-windows-sandbox-acl` 技能并以 `danger-full-access` 修复，turn 从 ~5 s 膨胀到 24.8 s | 探针/验收 cwd 必须放 `%TEMP%`，否则数字全被 ACL 修复污染 |
| 7 | 写 cwd 内文件不触发 `session/request_permission` | 一致；但 `danger-full-access` 的沙箱升级**会**触发（acl-repro-01 在 10026.878 ms 收到，`id=0`，选项 `allow-once`/`reject-once`） | 客户端必须实现审批自动应答，且 `id` 可能是 0 |
| 8 | 未记录 `write` 的前置条件 | 有一次（write-03 早期）`write` 新文件返回 `Error: cannot modify "...": file has not been read — read the file, then retry`，模型 read 一次后重写成功 | 目标文件不存在时可能多一轮 read+write；断言不要绑定“恰好一次 write 调用” |

未发现差异的项：`sessionCapabilities` 无 `load`；`session/new` 需 `cwd` + `mcpServers`；`tool_call` 携带 `rawInput`、`tool_call_update` 无 diff/rawOutput；Windows shell 工具名是 `pwsh`。

---

## 7. 给实现方的硬提示

1. **分帧按 NDJSON 实现**：`\n` 切行、容忍行尾 `\r`、一行一个完整 JSON；不要实现 Content-Length，也不要用 `readline` 之外的花活（`JSON.stringify` 会转义换行，行内不会出现裸 `\n`）。同时保留“首块嗅探”以便将来换宿主时快速定位。
2. **`session/prompt` 是阻塞的，且只回 `stopReason`**：turn 期间所有信息走 `session/update`；请求超时必须按“长任务”设置（本轮 4–25 s，长任务可能更久），不能用 5 s 之类的短超时。turn 的正常结束信号是 prompt 响应，不是最后一条 update。
3. **`-32602` 同码双义，且 message 带前缀**：会话不存在 / prompt 在飞行都可能是 `-32602`，必须 `message.includes('already in flight')` 细分；忙时表现为 2–3 ms 立即失败、不排队，不能自动重投（会变成重复执行）。
4. **噪声帧按白名单过滤**：`usage_update` 必滤；`available_commands_update` 在本版本 0 次，但阶段零出现过，仍要滤。判断“turn 已开始/已接受”只认 `agent_thought_chunk` / `tool_call` / `agent_message_chunk`，不要用 `usage_update`（它会在 turn 中和结束时反复出现，按 any-event 判接受会提前 1 s 以上）。
5. **`session/cancel` 是通知，没有响应**：发完只能等 prompt 响应的 `stopReason: cancelled`；实测 13–56 ms 生效，中断中的工具会以 `failed` + `Error: tool call aborted` 收尾。实现里给它留 1 s 超时即可，超时后按“取消失败”上报。
6. **Windows 上 cwd 放 `%TEMP%`，并预创建目标文件**：仓库存放路径（`D:\...`）会让 shell 沙箱 `grantWrite` 失败（Win32 5）并触发 `danger-full-access` 审批；`write` 对新文件可能先要求 read。两者都会让一轮“简单任务”变成多轮修复/重试，直接污染时延与状态判定。
7. **保持 stdin 打开**：stdin EOF 等于关服务（`exitOnStdinEnd`）。不要在 turn 结束前 `end()`；`closeSession`/`core stop` 时再关。

---

## 附录 A：本次运行清单

| runId | 模式 | cwd | 结果 |
|---|---|---|---|
| `write-01` | 真实 write | `%TEMP%\maestro-i11-probe\write-01\workspace` | `end_turn`，断言全绿，57 B |
| `write-02` | 真实 write | 同上（write-02） | `end_turn`，断言全绿，同 sha256 |
| `write-03` | 真实 write | 同上（write-03） | `end_turn`，断言全绿，同 sha256 |
| `busy-01` | 双 prompt | 同上（busy-01） | 第二个 `-32602`（2.769 ms） |
| `cancel-01` | 思考中 cancel | 同上（cancel-01） | `cancelled`（13.148 ms） |
| `cancel-02` | 工具执行中 cancel | 同上（cancel-02） | `cancelled`（56.173 ms） |
| `acl-repro-01` | 复现 ACL 失败 | `D:\WWW\Maestro\probe\runs\acl-repro-01\workspace` | 首个 `pwsh` 失败 → 技能修复 → `end_turn`（24.8 s） |

## 附录 B：复跑命令

```bash
cd /d/WWW/Maestro
node probe/acp-probe.mjs --mode=write  --run-id=write-01
node probe/acp-probe.mjs --mode=busy   --run-id=busy-01
node probe/acp-probe.mjs --mode=cancel --run-id=cancel-01 --cancel-after-ms=1200
node probe/acp-probe.mjs --mode=cancel --run-id=cancel-02 --cancel-after-ms=30000 --cancel-after-tool-ms=1500
node probe/summarize.mjs   # 重建 probe/runs/frames.jsonl 并输出 summary.json
```

`--cwd=<绝对路径>` 可覆盖工作目录（`acl-repro-01` 就是这样复现的）。脚本只依赖 Node 内置模块，**未安装任何 npm 包**。

## 附录 C：凭据处置

- 测试用的 `probe/dsh-home/.credentials.yaml` 与 `.anonymous-user-id` 在探针跑完后已删除；`probe/dsh-home/profiles/acp/` 保留为可复现模板。
- 全程未写入、未修改 `~/.dsh` 下任何文件（只读取了 `.credentials.yaml` 做复制）。
