# I1.1 任务拆分 — 编排核心骨架 + ACP 适配器 + 会话状态归一化 + 交接包状态机

> 迭代：阶段一 · I1.1 ｜ 需求依据：`docs/iterations/iteration-1/requirement.md` **v5（待评审）**，本文件不增删其范围
> 上游依据：`docs/iterations/iteration-0/report.md` §5「阶段一实现路径锁定建议」+ 附录 C.6；`docs/iterations/iteration-0/capability-matrix.md` §2 / §4；`docs/index.md` §3.1~3.5、I1.1 / I1.4 条目；`.workbuddy/memory/MEMORY.md`
> 本文性质：**拆分 + 选型 + 文件级接口契约**。不含任何实现代码，伪签名只固定参数与返回结构。
> 版本：v1 ｜ 2026-11-04 ｜ 下一步：评审后按 §4 派发工作包

---

## 0. 迭代定位、范围与退出标准

### 0.1 一句话目标

把「一件事交给 DSH 做」从**手工开终端 + 人眼盯屏幕**，变成**一条命令 + 一个能持久记录并裁决三层状态的核心进程**，且每一跳状态变化都有带时间戳的落盘证据可复核。

### 0.2 In scope（对应需求 1.3「范围内」8 条，逐条对齐）

| # | 需求原条文 | 本迭代落地形态 |
|---|---|---|
| 1 | 最小命令集（4 个命令） | `orch run` / `orch status` / `orch cancel` / `orch core stop`，输出格式见 §2.12 |
| 2 | 常驻核心进程 + 本地通信 | 核心为独立进程，命名管道 IPC，见 §1.3 / §1.4 |
| 3 | ACP 适配器（stdio，只接 DSH） | `initialize` / `session/new` / `session/prompt` / 订阅 update + `session/cancel` / `closeSession`，见 §2.5 |
| 4 | 会话状态归一化 | 6 状态全定义，本迭代可观测 5 个（`waiting_input` 仅夹具），见 §2.7 |
| 5 | 实例状态机（最小）+ 节点状态最小集 | 三张迁移表全部实现并拒绝表外迁移，见 §2.3 |
| 6 | 交接包状态机 | 7 状态全定义，5 个可观测，见表外迁移拒绝 |
| 7 | 持久化基础 | `state.json`（原子写）+ `events.jsonl`（追加），见 §3 |
| 8 | 核心事件总线 + 确定性测试夹具 | 事件必落盘；mock ACP agent 走产品同一代码路径，见 §1.9 |

### 0.3 Out of scope（逐条照抄需求 1.3「范围外」表，不做任何"顺手实现"）

| 不做的事 | 留给谁 | 本迭代的物理约束（怎么保证没做） |
|---|---|---|
| 多角色、多节点、编码闭环模板 | I1.2 | `orchestrator.startRun` 只接受单节点；`ROLE_ID` 硬编码常量 `'worker'` |
| 缺陷回流、轮次计数、升级生成 | I1.2 | `escalated` 只有定义态，无入边无出边，无调用点（§2.3） |
| 工作流声明式定义与完整原语 | I1.6 | 无 `workflows/` 目录，无解析器 |
| 证据模型泛化、`review_reason`、审核角色 | I1.3 | `verify-artifact.js` 只做存在性 + 非空，`sha256` 字段恒为 `null` |
| 证据门禁、交接包 schema 校验、持久化信箱与重投 | I1.4 | 不产生 `pending`；无重投循环；`expired` 无产生路径 |
| 完整 CLI 命令集 | I1.4 | 只认 4 个命令；未知命令直接 `exit 2` |
| 角色注册表、角色实例模型 | I1.5 | 无 `roles/`，无角色状态字段 |
| 产物类型隔离 | I1.7 | 不做 worktree / 版本化文件区 |
| 会话恢复、崩溃恢复、会话复用 | I1.8 | 每节点新会话（`fresh`）；重启只判定 `已中断`，不接回会话 |
| 三层日志、执行日志摘要、追踪 span、健康度 | I1.9 | 只有 `events.jsonl` 一层 |
| 桌面应用、托盘、看板、角色流程图 | I1.10a / I1.10b | 无 GUI 代码，无 WebSocket |
| 通知、人工干预队列、审批图形化 | I1.11 | 「等待审批」只保证**可见**，无放行入口 |
| 链式哈希审计、预算配额、产物指纹校验 | I1.12 | `events.jsonl` 无 prev-hash 字段（格式留白不写值） |
| Cursor、WorkBuddy 接入 | 阶段二 / 三 | 适配器只有 stdio transport 一个实现 |

### 0.4 退出标准

1. **26 条 AC 全部通过**，且按需求标注的**验证面**分别计：
   - **产品命令面（14 条）**：AC-01 ~ AC-14，必须在真实 DSH 上跑，附 ACP 原始帧；
   - **夹具面（12 条）**：AC-15 ~ AC-26，验收记录必须逐条注明「夹具」与所用开关。
2. **证据可复核**：每条 AC 附 ① 命令原文或夹具命令 ② `state.json` 快照 ③ 相关 `events.jsonl` 行 ④ 真实验收附 ACP 原始帧文件路径。
3. **冷热启动分开记录**（NFR-01）：热启动 ≤ 5s、冷启动 ≤ 30s，各 10 次取最大值。
4. **三层状态一致率**：抽查 20 次，状态变化 1s 内反映，错标 0 次（NFR-02 / 指标 3）。
5. **连续 10 次 + 1 次强杀重开**：实例 / 节点 / 会话 / 交接包 / 事件记录 5 项 100% 可查，重复执行 0 次（NFR-03 / NFR-04 / NFR-06）。

---

## 1. 技术选型

> 每条决策给出**结论 / 理由 / 被否决的选项与否决理由**。否决项必须写清"为什么不选"，否则不算决策。

### 1.0 先核实：ACP 在 stdio 上的真实分帧（**禁止按 LSP 猜**）

需求未规定分帧，实现前必须看真实帧。核实结果如下（**与"ACP 沿用 LSP Content-Length 头"的通说相反**）：

| 项 | 实测结论 | 可复核证据 |
|---|---|---|
| 分帧方式 | **换行分隔 JSON（NDJSON）**：一帧 = 一个 JSON 对象 + `\n`（LF, 0x0a），**无任何头部** | `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-acp\lib\index.js`：`const stream = config.stream ?? ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));` |
| 实现来源 | `@agentclientprotocol/sdk` **1.4.0**，`dist/stream.js` 的 `ndJsonStream`，逐行切分由 `dist/line-buffer.js` 的 `LineBuffer` 完成（只认 `0x0a`，解码后 `trim()`，空行跳过） | 同目录 `@agentclientprotocol\sdk\dist\stream.js`、`dist\line-buffer.js` |
| 写入格式 | `JSON.stringify(message) + "\n"`，写入串行化（`outputWrite` 链式等待），不并发写 | `stream.js` 的 `writeJson` |
| 解析失败处理 | 无法 `JSON.parse` 的行 → 回一个 `protocolErrorResponse(parseError)`，连接不断 | `stream.js` 的 `enqueueLine` |
| 结论 | 本迭代必须实现 **NDJSON 收发器**；若按 `Content-Length` 实现，与真实 DSH **完全无法握手** | — |

**同时核实的三条配套事实（直接进契约）**

| # | 事实 | 证据 |
|---|---|---|
| F1 | `session/cancel` 是**通知**（无 `id`、无响应），不是请求 | `dsh-acp/lib/index.js`：`methods.agent.session.cancel` 注册在 `.onNotification(...)` |
| F2 | `session/request_permission` 由**宿主发起、客户端应答**，参数 `{sessionId, toolCall:{toolCallId}, options:[{optionId:"allow-once"\|"reject-once", name, kind}]}`，应答 `{outcome:{outcome:"selected", optionId}}` 或 `{outcome:{outcome:"cancelled"}}` | 同上，`approval/request` 分支 |
| F3 | 宿主把 turn 结束原因映射为 `stopReason` 时，**`blocked` 与 `error` 都映射成 `end_turn`**（不是 `refusal`/错误） | 同上，`turnEndToStopReason`：`case "blocked": case "error": return "end_turn"` |

> **F3 是本次核实新增的硬约束**：`stopReason` **不能**用来判"执行失败"。失败判定只允许两条路——① `session/prompt` 返回 JSON-RPC `error`；② 产物核对不通过。见 §2.9 / §7 R3。

### 1.1 决策一：语言与运行时 —— Node 22 ESM，**零第三方运行时依赖**

- **结论**：`package.json` 只声明 `"type": "module"` + `"engines": {"node": ">=22"}` + `"bin": {"orch": "bin/orch.js"}`；`dependencies` 与 `devDependencies` **均为空**。只用 `node:fs` / `node:path` / `node:net` / `node:child_process` / `node:crypto` / `node:os` / `node:readline`（如果用到）/ `node:test`（测试）。
- **理由**：
  1. 全部所需能力都是 OS 原语：命名管道（`net.listen(path)`）、子进程（`spawn`）、原子写（`rename`）、哈希（`sha256`）、NDJSON（`split('\n')`）。没有一样需要三方库。
  2. ACP SDK 是 TypeScript 包（`@agentclientprotocol/sdk` 1.4.0，需 `dist/*.js` + 可选 `.d.ts`），引入它等于引入一条 TS 编译链与 `zod` 系依赖，只为拿到"按行切分"的 40 行逻辑。
  3. 零依赖让"冷启动 ≤ 30s"与"核心被随时拉起"不受 `npm install` 状态影响。
- **被否决**：
  - **引 `@agentclientprotocol/sdk`**：否决。它只提供分帧 + 类型；类型在用 JS 时无收益，分帧 40 行可自写；且 SDK 版本与 DSH 内置版本强耦合（1.4.0），锁版本会把我们的升级节奏绑到宿主侧。
  - **TypeScript + 编译产物**：否决。多一层构建，`spawn` 核心时要先保证已编译，直接破坏"CLI 发现 core 不存在就拉起来"的简化前提；类型收益在 24 个文件规模上不抵成本。
  - **Deno / Bun**：否决。Windows 命名管道行为与 `child_process` 细节需重新验证，而本机硬事实（DSH shim 用 Electron node 模式）只对 Node 验证过。
  - **引 `execa` / `pino` / `zod` 等便利库**：否决。每个都能用 10~30 行内置代码覆盖，代价是安装体积与供应链面。

### 1.2 决策二：仓库结构 —— 单包（非 workspace），`src/` 按层分目录

```
D:/WWW/Maestro
├─ package.json                      # type=module, bin.orch, engines>=22, 无依赖
├─ bin/
│  └─ orch.js                        # 3 行入口：import('../src/cli/main.js') 并跑 main(process.argv)
├─ src/
│  ├─ core/                          # 宿主无关的编排裁决层（禁词见下）
│  │  ├─ state-machine.js            # 三张状态机表 + can/assert/apply
│  │  ├─ event-bus.js                # emit → 落盘 → 广播
│  │  ├─ orchestrator.js             # 单节点任务主流程
│  │  ├─ verify-artifact.js          # 最小产出核对
│  │  └─ error-map.js                # 宿主错误 → 结构化错误码（不含中文）
│  ├─ adapter/                       # 唯一允许出现宿主/协议细节的层
│  │  ├─ stdio-transport.js          # NDJSON over child_process stdio
│  │  ├─ acp-client.js               # ACP 原语封装
│  │  ├─ session-state.js            # session/update → 6 会话状态
│  │  ├─ handoff-tracker.js          # 交接包 7 状态推导
│  │  ├─ dsh-launch.js               # Windows 启动 shim
│  │  └─ host-config.js              # 启动配置解析（env > 文件 > 内置默认）
│  ├─ daemon/
│  │  ├─ server.js                   # 管道监听 + 方法路由
│  │  ├─ client.js                   # CLI 侧连接/请求/订阅 + 自动拉起
│  │  ├─ lifecycle.js                # 起停核心、探活、优雅退出
│  │  └─ ipc-frames.js               # req/res/evt 三类帧的编解码与校验
│  ├─ persistence/
│  │  ├─ atomic-write.js             # tmp + fsync + rename（Windows 重试）
│  │  ├─ paths.js                    # .orch 布局与管道名
│  │  └─ instance-store.js           # load/save/appendEvent/readEvents + 损坏处理
│  └─ cli/
│     ├─ main.js                     # 4 命令解析与调度
│     ├─ render.js                   # 行渲染（带层名前缀）
│     └─ labels.js                   # 英文枚举 → 中文文案（唯一中文来源）
└─ test/
   └─ fixtures/
      ├─ mock-acp-agent.js           # 同协议 mock 宿主（被适配器当"另一个 host 命令"拉起）
      └─ attempt-transition.mjs      # AC-26：直接 import 状态机提交非法迁移
```

- **`src/core/` 禁词（沿用阶段零 `check-core-purity` 口径）**：`host` / `transport` / `stdio` / `http` / `sse` / `dsh` / `cursor` / `workbuddy` / `replay` / `dialect`，注释豁免。核心只依赖注入进来的接口。
- **被否决**：
  - **npm workspaces / pnpm monorepo**（`packages/core`、`packages/adapter`…）：否决。本迭代 24 个文件、单一交付物，拆包只增加跨包解析成本；且 `packages/*` 的 `exports` 字段会让"零依赖"表述变复杂。阶段二接 Cursor 时若需要独立发布再拆，向后不冲突。
  - **按宿主分目录 `hosts/dsh/`**：否决。I1.1 只有 DSH，目录会诱导写 `if (host === 'dsh')`；方言差异收敛在 `adapter/` 内部以配置表达（`host-config.js`）。
  - **`src/normalize/`（阶段零命名）**：否决。归一化属于适配器职责（`adapter/session-state.js`），单独目录会让核心误以为可以直接引用归一化结果而不经过适配器边界。

### 1.3 决策三：进程模型 —— 常驻核心 + Windows 命名管道（`net.listen(path)`）

- **结论**：核心是独立进程；CLI 是短命进程，通过本地 socket 下发指令、取状态、订阅事件。关掉 CLI 窗口不影响核心。

**管道名生成（必须防冲突 + 必须可复现）**

```
pipeName(root) =
  win32 : "\\.\pipe\maestro-" + sha256(realpath(root)).slice(0, 16)
  其他  : join(realpath(root), ".orch", "core.sock")        # 仅为开发/CI 兜底，不作验收面
```

- **用项目路径哈希，不用固定名**：固定名（如 `\\.\pipe\maestro-core`）会让"两个项目各自跑一个核心"变成互相抢占；用项目根路径哈希则**同项目必同管道、不同项目必不同管道**（`realpath` 先归一化，避免 `./demo` 与 `demo` 生成两个管道）。
- **不放 `%TEMP%`、不放在 `.orch/` 下的管道文件**：Windows 命名管道只存在于 `\\.\pipe\` 命名空间，不落盘；`paths.js` 里以 `isWindows` 分支表达，改动只在一处。
- **元信息文件**：核心启动后写 `.orch/core.json` = `{version, pipeName, pid, generation, startedAt}`，**只用于诊断与 `core stop` 超时提示**，连接路径永远由 `pipeName(root)` 现算，不读 `core.json`（避免读到上一次残留的陈旧 pid）。

**协议帧：NDJSON over socket，三类帧**

| 帧 | 方向 | 形状 |
|---|---|---|
| request | CLI → core | `{"v":1,"kind":"req","id":"c-1","method":"run.start","params":{…}}` |
| response | core → CLI | `{"v":1,"kind":"res","id":"c-1","ok":true,"result":{…}}` 或 `{"v":1,"kind":"res","id":"c-1","ok":false,"error":{"code":"NODE_BUSY","params":{…},"message":"…"}}` |
| event | core → CLI | `{"v":1,"kind":"evt","stream":"instance:INST-001","seq":42,"event":{…}}`（`event` 与 `events.jsonl` 单行**同构**） |

- 每帧一行 JSON，`\n` 结尾；单帧上限 8 MiB，超限断开并记 `IPC_FRAME_TOO_LARGE`。
- `error.code` 用 §2.9 的 9 个结构化码 + 4 个基础设施码（`IPC_*` / `STORE_*`），**中文只在 CLI 渲染**。

**自动拉起（冷启动路径）**

```
client.connect()
  → net.connect(pipeName)
  → ENOENT / ECONNREFUSED ?
       → spawn(process.execPath, [bin/orch.js, 'core', 'serve', '--project', root],
               { detached:true, stdio:'ignore', windowsHide:true, cwd: root })
       → child.unref()
       → 每 100ms 重试 connect，直到 30s（冷启动上限）或成功
       → 失败：(code=CORE_START_FAILED, params:{cause})
  → 成功后：core.ping 取 generation，记录 elapsedMs（区分 cold / hot）
```

- **必须 `detached: true` + `unref()`**：否则 CLI 退出时核心被一起带走，直接违反 NFR-07 / AC-12。
- **`stdio: 'ignore'`**：核心日志只进 `.orch/core.log`（由核心自己 `fs.appendFile`），不继承 CLI 的终端；否则用户关窗口时核心可能收到写 EPIPE。

**`core stop` 优雅退出**

```
core.stop → 回 res(ok) → 停止 accept → 对每个非终态实例执行 interrupt：
    实例 running → interrupted（写事件 reason="core.stop"）
    节点保持最后状态，附 note="停在节点 执行中 / 会话 执行中"
    会话 best-effort session/close（1s 超时，失败不阻塞）
    交接包保持 delivered/accepted，附 note="停在交接包 已投递/已接受"
  → flush events 文件句柄 → 退出码 0
CLI 等管道断开 ≤ 5s；超时打印「核心未在 5s 内退出（pid …），可再次执行 orch core stop」
```

> **为什么 `core stop` 要把 `运行中` 判成 `已中断` 而不是 `失败`/`已取消`**：AC-12 原文要求"实例显示已中断"。`失败` 语义是"执行失败"，`已取消` 语义是"我主动终止"，两者都会污染后续的失败归因。

- **被否决**：
  - **单进程一次性命令（CLI 里直接跑核心）**：否决。NFR-07 与 AC-12 直接不成立——关窗口任务就死，也就没有"重启后查上次状态"。
  - **本地 HTTP + 端口**：否决。端口占用 / 防火墙弹窗 / 端口探测竞态；且 `token` 鉴权要另做。命名管道由 ACL 隐式隔离到当前用户，无端口冲突。
  - **TCP localhost + 固定端口偏移**：否决。同上，且多项目并发时偏移冲突要另行协调。
  - **stdio 管道（CLI spawn 核心后用 stdin/stdout 通信）**：否决。核心生命周期被绑到 CLI 进程，与 `detached` 目标矛盾。
  - **用 `\\.\pipe` 之外的 `.sock` 文件（Windows af_unix）**：可行但否决。Node 22 的 `net.listen(path)` 在 Windows 上支持 af_unix，但 `core.json` 残留 + 文件锁清理会多一类故障；命名管道无残留文件。

### 1.4 决策四：持久化 —— `state.json`（快照、原子写）+ `events.jsonl`（追加）

- **布局**：`.orch/instances/<id>/state.json`、`.orch/instances/<id>/events.jsonl`，损坏备份 `.orch/instances/<id>/state.json.corrupt`。
- **原子写**：`<file>.tmp-<pid>-<rand>` → `write` → `fsync`（文件句柄）→ `rename` 覆盖。Windows 上 `rename` 可能 `EPERM/EBUSY`（杀毒/索引占用），**重试 3 次、间隔 20/50/120ms**，仍失败返回 `STORE_WRITE_FAILED`，**不降级为直接覆盖写**。
- **事件**：`fs.appendFile` 单次写整行（`JSON.stringify(event) + "\n"`），不缓冲多行；追加失败即 `STORE_WRITE_FAILED`，事件总线不得"只在内存里发"（BR-10）。
- **损坏处理（**这里有一条需求内部张力，按"复制"解**）**：
  - 需求 2.7 要求提示「状态不可读，已备份为 state.json.corrupt」；AC-13 又要求「原来的文件仍在，没有被清空或覆盖」。**重命名会把原文件移走**，无法同时满足。
  - **决策**：`copy → state.json.corrupt`（保留 `state.json` 原文件原字节），返回 `{ok:false, code:'STATE_CORRUPT', backupPath}`；该实例在本次核心生命周期内进入 `writeBlocked`，`save()` 返回 `STORE_WRITE_BLOCKED_CORRUPT`，**绝不静默清空**（BR-16）。
- **被否决**：
  - **SQLite（`node:sqlite` 或 `better-sqlite3`）**：否决。`node:sqlite` 在 22 上是实验特性，`better-sqlite3` 是原生模块（要编译）。而且 AC-13 要求"用户能一眼看到坏掉的那个文件"，JSON 明文更利于人工复核。
  - **单个 `.orch/state.json` 存全部实例**：否决。任一实例异常会损坏全量；且 AC-13 的"只坏一个实例"无法构造。
  - **每状态一次全量重写 events 数组**：否决。写入放大 + 崩溃时易截断。
  - **`events.jsonl` 用 `writeStream` 长连接**：否决。`core stop` 与强杀场景下缓冲未 flush 会丢事件（NFR-03 要求 0 条缺失）；`appendFile` 每行一 syscall 换确定性。
  - **链式哈希**：明确不做（I1.12）。格式中**不预留** `prevHash` 字段，避免"写了空值被误认为已启用"。

### 1.5 决策五：显示层 —— 内部英文枚举，中文只在 `cli/labels.js`

- **内部枚举（与基线一致，禁止中文进入任何状态机常量）**：

| 层 | 内部值（英文） | 显示文案（中文，仅渲染层） |
|---|---|---|
| 实例 | `created` / `running` / `completed` / `failed` / `cancelled` / `interrupted` | 已创建 / 运行中 / 已完成 / 失败 / 已取消 / **已中断** |
| 节点 | `pending` / `running` / `review` / `done` / `failed` / `cancelled` / （`escalated` 只定义） | 待执行 / 执行中 / 待校验 / 已完成 / 失败 / 已取消 /（不显示） |
| 会话 | `idle` / `thinking` / `tool_running` / `waiting_input` / `waiting_dependency` / `escalated` | 空闲 / 执行中 / 执行中 · 调用工具（`<工具名>`） / 等待审批：`<动作>` / 等待下游 / 已升级（不显示） |
| 交接包 | `created` / `delivered` / `pending` / `accepted` / `consumed` / `rejected` / `expired` | 已构造 / 已投递 / 待投递 / 已接受 / 已完成 / 已拒绝 / 已过期 |

- **节点 6 态（不是基线 9 态）的口径说明**：需求 2.4 明确「`待执行` = 基线 `blocked` + `ready`（合并显示）」「`执行中` = `assigned` + `running`（合并显示）」，且该表是**唯一迁移口径**（"不在表内的一律拒绝"）。若直接用 9 态，就会产生 `blocked→ready`、`ready→assigned`、`assigned→running` 三条**表外迁移**，与本条要求冲突。因此 I1.1 的 `NodeSM` 用 6 态 + 定义态 `escalated`，并把 6→9 的映射写进 §2.3（供 I1.2 扩展）。
- **层名前缀强制**：所有用户可见行以 `实例 ` / `节点 ` / `会话 ` / `交接包 ` 开头（需求附录 A 的"避免混读"要求）。`render.js` 是唯一拼接点，`main.js` 不拼字符串。
- **被否决**：
  - **状态机里直接存中文**：否决。i18n 与测试断言都会变脆；且需求要求"状态名逐字一致"，中文散落多处必然漂移。
  - **引 `i18n` 框架（如 `i18next`）**：否决。单语言、37 条字符串，一张 `MAP` 表足够；框架会引入异步加载与 key 解析层。
  - **用中文拼音/英文混排做内部值**（如 `yizhongduan`）：否决。与基线 `interrupted` 不一致，阶段二接面板时还要再映射一次。

### 1.6 决策六：ACP 适配器 —— 手写 NDJSON stdio transport，只实现 DSH，接口留扩展位

- **结论**：`stdio-transport.js` 负责"字节流 ↔ JSON 对象"，`acp-client.js` 负责协议语义。transport 接口固定为 `{spawn, send, onMessage, onExit, dispose}`（阶段零 `ACPTransport` 口径），本迭代只有 stdio 实现；`host-config.js` 预留 `transport: "stdio" | "http-sse"` 字段但只接受 `stdio`（其他值启动前报 `HOST_UNSUPPORTED`）。
- **分帧实现要点（按 §1.0 实测）**：入向维护 `Uint8Array` 缓冲，按 `0x0a` 切行；行解码后 `trim()`；空行丢弃；`JSON.parse` 失败记 `PROTOCOL_PARSE_ERROR` 事件并**继续**（与 SDK 行为一致，不炸连接）。出向 `JSON.stringify + "\n"`，串行化写入（不并发写同一 stdin）。
- **恢复链**：`resumeOrCreate(sessionId?)` 的签名保留，I1.1 **只实现 `new` 分支**（阶段一默认 `fresh`，每节点新会话）；`resume` 分支留给 I1.8，且 `replayMode` 只进适配器日志、**不进返回类型**。
- **drain-quiet**：`newSession` / `resume` 之后进入静默窗口（idle 40ms / cap 400ms）再返回。真实 DSH 建会话后必发 `available_commands_update`（`real-dsh-noise-frames.json`），不静默就会把噪声当成 turn 进展。
- **被否决**：
  - **按 `Content-Length` 分帧**：否决。与实测实现相悖（§1.0），直接握手失败。
  - **`readline.createInterface` 读 stdout**：可行但否决。`readline` 会对行做额外处理且不便于设 8 MiB 上限；自管缓冲更可控，且能精确记录"半行"状态用于协议错误上报。
  - **先实现 HTTP+SSE 再统一**：否决。I1.1 只接 DSH 且只走 stdio；双实现会把无法验收的代码写进产品（阶段零已证 SSE 响应跨通道乱序，复杂度不该前置）。
  - **`session/prompt` 用短轮询等 `stopReason`**：否决。`session/prompt` 是阻塞到 turn 结束的请求，直接 await 响应即可；轮询会引入额外状态。

### 1.7 决策七：DSH 启动 shim —— 配置驱动，不硬编码安装路径

- **本机事实**（MEMORY + 实测）：Windows 上**没有 `dsh.cmd`**；CLI 入口在 asar 内；纯 Node 读不了 asar，必须借 Electron 的 node 模式。

```
默认推导：
  exe  = join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", "DeepSeek Harness.exe")
  bin  = join(dirname(exe), "resources", "app.asar", "dsh", "node_modules",
              "@deepseek-ai", "dsh", "lib", "bin.js")
  args = [bin, "--profile", "acp"]
  env  = { ...process.env, ELECTRON_RUN_AS_NODE: "1" }

覆盖优先级（高 → 低）：
  1) 环境变量：MAESTRO_DSH_EXE / MAESTRO_DSH_BIN / MAESTRO_DSH_ARGS（空格分隔）
  2) 项目配置：<root>/.orch/hosts/dsh.json = { launch:{command,args,env}, dialect:{recovery}, limits:{...} }
  3) 内置默认（上面的推导）
启动前校验：exe 与 bin 都存在，否则 code=DSH_SPAWN_FAILED，params.cause = "未找到 <path>"
```

- **不碰用户 `~/.dsh`**：shim 不写 profile、不复制凭据（凭据已就位，直接用默认 home）。若验收需要隔离 home，由验收脚本**外部**通过 `DSH_HOME` 环境变量注入，产品不感知。
- **`ELECTRON_RUN_AS_NODE` 处理**：MEMORY 记录该变量可能常驻父环境；shim **显式设置**它（而不是"如果有就保留"），并在 `core.info` 中回显实际使用的 command/args 供复核。
- **被否决**：
  - **硬编码 `C:\Users\<me>\AppData\Local\Programs\...`**：否决。换机即坏；且 MEMORY 明确要求配置化。
  - **`where dsh` / `PATHEXT` 探测**：否决。本机就是没有 `dsh.cmd`（已证），探测只会返回失败并掩盖真实原因。
  - **`npm i -g @deepseek-ai/dsh` 走 PATH**：否决。会引入第二份 DSH 与第二套版本，验收证据无法对齐 `0.2.1-rc.5`。
  - **用 `dsh-acp-server` 第三方包**：否决。它带两个 Windows 包级缺陷（`import(join())`、`spawnSync('dsh')`），且 I1.1 不需要 `load`（report §5「ACP server 选型」）。

### 1.8 决策八：错误处理约定 —— 结构化返回跨边界，`assert` 只在进程内抛

- **结论**：
  - **跨进程 / 跨模块边界**（IPC、store、SM 的 `apply`）：**返回** `{ok:false, code, params?}`，**不抛异常**。理由：异常穿过 `JSON.stringify` 会丢结构，只剩字符串，无法给 CLI 分类渲染。
  - **进程内不变量**（`assert`、参数校验）：抛 `IllegalTransitionError` / `TypeError`，只在同进程调用链内使用，且必须在边界前被 `try/catch` 转为结构化结果。
  - 一致性规则写进 §2.3 的契约注释：`can()` 永不抛；`assert()` 只抛；`apply()` 永不抛。
- **被否决**：
  - **统一抛异常 + 错误码挂在 `err.code`**：否决。跨 IPC 边界必须手工序列化，容易漏字段（尤其 `params` 里的路径与原文）。
  - **统一返回 `{ok}`，不区分致命/可恢复**：否决。`CORE_START_FAILED` 与 `NODE_BUSY` 的处置完全不同（前者退出码 3，后者退出码 1 且不改变任何状态），需要码位区分。

### 1.9 决策九：夹具形态 —— 走产品同一条代码路径

- **结论**：两件夹具，都不另造一条链路。

| 夹具 | 形态 | 为什么这样设计 |
|---|---|---|
| `test/fixtures/mock-acp-agent.js` | **一个真正的 ACP agent 进程**：NDJSON over stdio，实现 `initialize` / `session/new` / `session/prompt` / `session/cancel`(通知) / `session/close`，可用开关改变行为 | 由 `host-config` 指向 `node test/fixtures/mock-acp-agent.js --permission=ask …`，**适配器不认识它是 mock**；它走的是与 DSH 完全相同的 `spawn → NDJSON → acp-client` 路径。若另写"内存桩"，AC-15~AC-25 证明的是桩，不是产品 |
| `test/fixtures/attempt-transition.mjs` | **直接 `import` 核心状态机**的脚本：提交一次非法迁移，并把拒绝结果写进同一个 `events.jsonl` | AC-26 要求"这次迁移被提交给核心"，但产品无任何入口能构造非法迁移；走状态机模块 + 同一 `instance-store.appendEvent` 才能保证事件格式与真实一致 |

- **夹具开关 ↔ AC 映射**（严格照需求 3.3 表，11 个）：

| 开关 | 支撑 AC | 行为 |
|---|---|---|
| `--permission=ask` | AC-17 | turn 内发 `session/request_permission`，等客户端应答后继续 |
| `--permission=deny` | AC-18 | 客户端回 `reject-once` / 宿主直接回 `stopReason: refusal` |
| `--noise-on-session-new` | AC-19 | `session/new` 返回后立刻发 `available_commands_update` |
| `--session-missing` | AC-20 | 对未知 sessionId 的 prompt 返回 `-32602` + `unknown session` 文案 |
| `--host-error` | AC-21 | turn 中返回 JSON-RPC `error`（-32603 + 固定原文） |
| `--unknown-error` | AC-22 | 返回未登记 code（如 `-32099`）+ 生僻原文 |
| `--accept-delay-ms` | AC-24 | 收到 prompt 后延迟 N ms 才发首个 turn 内事件 |
| `--turn-delay-ms` | AC-23 | 单轮耗时（期间不发任何帧） |
| `--hold-session` | AC-15 / AC-16 | 建会话后不投递；`--slow-tool <name>` 让工具调用可观测 |
| `--illegal-transition` | AC-26 | **不在此脚本**，由 `attempt-transition.mjs` 承担（见上表第二行） |
| `--slow-tool <工具名>` | AC-16 / AC-25 | 工具调用保持 `in_progress` 一段时间 |

- **禁止事项**（MEMORY / capability-matrix §4.6）：夹具与任何验收脚本**禁止硬编码 `bash`**；落盘一律 `write`（参数 `file_path` + `content`）；工具名按平台取。
- **被否决**：
  - **进程内 stub（直接 new 一个假 client）**：否决。绕开 transport，AC-19/AC-23 这类"帧到达时序"的用例会失去意义。
  - **录制回放真实帧（replay 已录 stdio）**：否决。回放无法响应 `initialize`/`prompt` 请求，也无法构造 `--accept-delay-ms` 这类时序；录制件只用于回归基线，不作夹具。
  - **用真实 DSH + 假模型**（隔离 DSH_HOME 注入 mock-llm）：否决为主路径。它慢（每 turn 秒级）、依赖包内私有路径、且无法造 `--permission`。保留为**可选的高保真回归**，不进 AC 主流程。

### 1.10 决策十：测试与断言方式 —— `node:test`，零依赖

- **结论**：`node --test test/` 跑契约测试（状态机表、错误分类表、NDJSON 切帧、原子写损坏恢复）。AC 验收另用手工命令 + `events.jsonl` 复核，不做 UI 断言。
- **被否决**：`vitest` / `jest`（体积 + 配置 + ESM 兼容问题）、`tap`（额外依赖）、纯 shell 断言（Windows 上不可移植、且要引 `bash`，违反 §1.9 禁令）。

### 1.11 已锁定约束 → 落点（逐条闭环，13 条）

> 来源：`iteration-0/report.md` §5 共 14 行建议；其中「桌面壳选型」不在 I1.1 范围（无 GUI），其余 13 条全部落到本拆分。

| # | 锁定约束（原文要点） | 落到本文哪里 | 落到哪个文件 |
|---|---|---|---|
| 1 | 一份 `ACPTransport` 接口 + 多实现，I1.1 只需 stdio | §1.6、§2.4 | `adapter/stdio-transport.js` |
| 2 | `resumeOrCreate` 统一方言，`replayMode` 只进日志 | §1.6、§2.5 | `adapter/acp-client.js` |
| 3 | `load`/创建会话后必须 drain-quiet（idle 40ms / cap 400ms） | §1.6、§2.5 | `adapter/acp-client.js`（`quietWindow`） |
| 4 | mock 能力必须保留，重建为正式测试资产 | §1.9 | `test/fixtures/mock-acp-agent.js` |
| 5 | 证据：核心自算，`artifactRef` 只从 `tool_call.rawInput.file_path` 取 | §2.9 | `core/verify-artifact.js` + `adapter/session-state.js` |
| 6 | 会话复用默认 `fresh`，每节点新会话 | §2.8 | `core/orchestrator.js` |
| 7 | Windows 需内置启动 shim（Electron node 模式跑 asar 内 bin.js） | §1.7 | `adapter/dsh-launch.js` |
| 8 | ACP server 选内置 `@deepseek-ai/dsh-acp`（无 `load`） | §1.7、§7 | `adapter/host-config.js`（`dialect.recovery='resume'`） |
| 9 | 回归套件五件套作为阶段二/三准入测试重建 | §5（本迭代只交付种子：契约测试 + 夹具） | `test/fixtures/*` |
| 10 | 归一化只吃 `sessionUpdate` + 客户端 permission；噪声白名单排除；`waiting_dependency`/`escalated` 由核心显式置位 | §2.7 | `adapter/session-state.js` |
| 11 | `accepted` 只认 turn 内事件，附 `ambiguityWindowMs` | §2.8 | `adapter/handoff-tracker.js` |
| 12 | TTL 只触发重投、不判失败；本迭代**不实现过期判定** | §2.8、§7 R4 | `adapter/handoff-tracker.js`（无 TTL 代码） |
| 13 | 禁止按 `-32602` 单码判会话失效 | §2.9 | `core/error-map.js` |

---

## 2. 模块划分与接口契约（文件级）

> 约定：`Promise` 一律显式；返回值统一 `{ok:true, …}` / `{ok:false, code, params?}`；时间戳一律 ISO-8601 字符串（UTC，毫秒）；`code` 一律大写下划线，语义表见 §2.9。

### 2.1 `src/persistence/paths.js`

**职责**：`.orch` 目录布局与管道名的唯一计算点（禁止在别处拼路径）。

```js
projectRoot(cwdOrRoot) -> string                       // realpath 归一化后的项目根
orchDir(root)          -> string                       // <root>/.orch
instanceDir(root, id)  -> string                       // <root>/.orch/instances/<id>
statePath(root, id)    -> string
eventsPath(root, id)   -> string
corruptPath(root, id)  -> string                       // state.json.corrupt
coreMetaPath(root)     -> string                       // .orch/core.json
coreLogPath(root)      -> string                       // .orch/core.log
pipeName(root)         -> string                       // win32: \\.\pipe\maestro-<sha256(root).slice(0,16)>
ensureLayout(root)     -> Promise<void>                // mkdir -p instances/
```

### 2.2 `src/persistence/atomic-write.js`

```js
writeJsonAtomic(filePath, value) -> Promise<{ok:true, bytes, updatedAt} | {ok:false, code:'STORE_WRITE_FAILED', params:{errno,path}}>
copyToBackup(srcPath, dstPath)   -> Promise<{ok:true, copiedBytes} | {ok:false, code}>
```

- 内部顺序固定：`open(tmp,'wx')` → `write` → `fsync` → `close` → `rename(tmp, dst)`。
- `rename` 遇 `EPERM` / `EBUSY` / `EACCES` 重试 3 次（20 / 50 / 120 ms），仍失败则删除 tmp 并返回失败。
- **不做**"失败后直接覆盖目标文件"的降级。

### 2.3 `src/core/state-machine.js`（三张表 + 三个 SM）

```js
export const INSTANCE_STATES = ['created','running','completed','failed','cancelled','interrupted'];
export const NODE_STATES     = ['pending','running','review','done','failed','cancelled','escalated'];
export const HANDOFF_STATES  = ['created','delivered','pending','accepted','consumed','rejected','expired'];

createInstanceSM({emit}) -> SM
createNodeSM({emit})     -> SM
createHandoffSM({emit})  -> SM

// SM 统一接口（三个 SM 完全同形）
sm.can(from, to)            -> {ok:true} | {ok:false, code:'ILLEGAL_TRANSITION'|'UNKNOWN_STATE'|'DEFINED_ONLY', message}
sm.assert(from, to)         -> void            // 非法时 throw new IllegalTransitionError(from,to,code)
sm.apply(from, to, meta)    -> {ok:true, from, to}
                             | {ok:false, code, from, to, message}
sm.isTerminal(state)        -> boolean
sm.definedOnly()            -> string[]        // 本迭代只有定义、不产生实例的状态名
```

- **`emit` 是唯一副作用**：`apply` 成功 → `emit({object, objectId, from, to, result:'applied', reason, detail})`；失败 → `emit({…, result:'rejected', reason:'illegal_transition'})` 后返回拒绝。`from === to` 视为非法（重复置位不写事件，直接 `{ok:false, code:'ILLEGAL_TRANSITION'}` 且**不 emit**，避免事件噪音）。
- **实例迁移表**（`created` 之外一律终态）：

| from | to |
|---|---|
| `created` | `running`, `cancelled` |
| `running` | `completed`, `failed`, `cancelled`, `interrupted` |
| `completed` / `failed` / `cancelled` / `interrupted` | —（终态） |

- **节点迁移表**（I1.1，对应需求 2.4 逐行）：

| from | to | 触发 |
|---|---|---|
| `pending`（显示「待执行」） | `running`, `cancelled` | 会话开始执行 / 我取消 |
| `running`（显示「执行中」） | `review`, `failed`, `cancelled` | 会话提交产出 / 宿主报错 / 我取消 |
| `review`（显示「待校验」） | `done`, `failed` | 核对通过 / 核对未通过 |
| `done` / `failed` / `cancelled` | —（终态） |
| `escalated` | —（**定义态**：无入边、无出边，`apply` 一律 `DEFINED_ONLY`） | I1.2 产生 |

  **6 态 ↔ 基线 9 态映射**（写进注释，供 I1.2 扩展）：`pending ↔ blocked + ready`；`running ↔ assigned + running`；其余同名。

- **交接包迁移表**（7 态，对应需求 2.5）：

| from | to |
|---|---|
| `created` | `delivered` |
| `delivered` | `accepted`, `rejected` |
| `accepted` | `consumed`, `rejected` |
| `pending` | `delivered`, `expired`（**本迭代无产生 `pending` 的代码路径**，故不可达但合法） |
| `consumed` / `rejected` / `expired` | —（终态） |

- **一致性规则**：`can` 永不抛；`assert` 只抛 `IllegalTransitionError`；`apply` 永不抛。

### 2.4 `src/adapter/stdio-transport.js`

```js
createStdioTransport({command, args, env, cwd, maxFrameBytes = 8*1024*1024, clock}) -> transport

transport.spawn()                 -> Promise<{ok:true, pid} | {ok:false, code:'DSH_SPAWN_FAILED', params:{cause}}>
transport.send(obj)               -> Promise<void>          // JSON.stringify + '\n'，串行化
transport.onMessage(cb)           -> () => void             // cb(parsedObject)
transport.onParseError(cb)        -> () => void             // cb({line, error})
transport.onExit(cb)              -> () => void             // cb({code, signal})
transport.stderrTail(n = 20)      -> string[]               // 最多 20 行，供 DSH_SPAWN_FAILED 的 cause
transport.dispose({timeoutMs = 1000}) -> Promise<void>      // 关 stdin → 等 exit → SIGTERM → kill
```

- **帧规则**（§1.0 实测）：按 `0x0a` 切；`trim()` 后空行跳过；`JSON.parse` 失败 → `onParseError`，**不断连接**；单行超 `maxFrameBytes` → 记一次 `IPC_FRAME_TOO_LARGE` 并 `dispose()`。

### 2.5 `src/adapter/acp-client.js`

```js
createAcpClient({transport, limits}) -> client

client.initialize()                      -> Promise<{ok:true, result:{protocolVersion, agentInfo:{name,version}, sessionCapabilities:{close,list,resume,load?}}}>
client.newSession({cwd, mcpServers = []})-> Promise<{ok:true, result:{sessionId, configOptions}}>
client.resumeOrCreate({cwd, sessionId?}) -> Promise<{ok:true, result:{id, cwd, restored}}>   // I1.1 只走 new 分支
client.prompt(sessionId, blocks)         -> Promise<{ok:true, result:{stopReason}} | {ok:false, error:{code, message}}>
client.cancel(sessionId)                 -> Promise<{ok:true}>                               // 通知帧，无 id，无响应
client.closeSession(sessionId)           -> Promise<{ok:true} | {ok:false, error}>
client.listSessions()                    -> Promise<{ok:true, result:{sessions:[{sessionId, cwd}]}}>
client.onUpdate(cb)                      -> () => void        // cb({sessionId, update})
client.onPermission(cb)                  -> () => void        // cb({sessionId, toolCallId, options, respond(outcome)})
client.quietWindow({idleMs = 40, capMs = 400}) -> Promise<{waitedMs}>   // drain-quiet
client.dispose()                         -> Promise<void>
```

- 方法名与参数形状（实测）：`initialize` / `session/new` `{cwd, mcpServers}` / `session/prompt` `{sessionId, prompt:[{type:'text',text}]}` / `session/cancel`（**通知**）/ `session/close` `{sessionId}` / `session/list` / `session/request_permission`（宿主→客户端，见 §1.0 F2）。
- `blocks` 结构：`[{type:'text', text}]`，本迭代只发文本。

### 2.6 `src/adapter/host-config.js` + `src/adapter/dsh-launch.js`

```js
loadHostConfig({root, hostId = 'dsh', env = process.env}) -> Promise<{
  id, transport:'stdio',
  launch:{command, args, env},
  dialect:{recovery:'resume'|'load'|'none'},
  limits:{initializeTimeoutMs, promptIdleWarnMs, quietIdleMs, quietCapMs}
}>
// 优先级：env > <root>/.orch/hosts/<id>.json > 内置默认；非法时 {ok:false, code:'HOST_UNSUPPORTED'|'HOST_CONFIG_INVALID'}

resolveDshLaunch({env, config}) -> {ok:true, launch:{command,args,env,source}}
resolveMockLaunch({switches, mockPath}) -> {ok:true, launch:{command:process.execPath, args:[mockPath, ...switches]}}
probeDshInstalled({env}) -> Promise<{ok:true, exe, bin, version?} | {ok:false, code:'DSH_SPAWN_FAILED', params:{cause}}>
```

- 默认推导与覆盖规则见 §1.7。`source ∈ {'env','config','default'}`，`core.info` 回显。

### 2.7 `src/adapter/session-state.js`

```js
export const SESSION_STATES = ['idle','thinking','tool_running','waiting_input','waiting_dependency','escalated'];
export const NOISE_UPDATES  = new Set(['usage_update','available_commands_update']);
export const TURN_UPDATES   = new Set([
  'agent_thought_chunk', 'agent_message_chunk', 'tool_call', 'tool_call_update', 'plan', 'user_message_chunk'
]);

createNormalizer({clock}) -> normalizer

normalizer.reduce(prev, sessionUpdate, ctx) -> {
  state,            // 6 状态之一
  toolName?,        // 仅 tool_running 时有值，取 tool_call.title（缺省时用 toolCallId）
  progress,         // 是否算"turn 内进展"
  noise             // 是否噪声帧
}
normalizer.isTurnEvent(sessionUpdate) -> boolean     // 严格按 TURN_UPDATES 白名单
normalizer.onPromptSent(sessionId, turnId) -> void
normalizer.onPromptSettled(sessionId, {stopReason}) -> {state}   // 结束 → idle
normalizer.onOutputSubmitted(sessionId) -> void      // 核心显式置位 waiting_dependency
normalizer.onCancelled(sessionId) -> void            // → idle，并启用迟到帧隔离
normalizer.onEscalated(sessionId) -> void            // 定义态，I1.1 无调用点
```

**映射表（逐判别值，禁止猜）**

| `sessionUpdate` | 归一化结果 | 说明 |
|---|---|---|
| `agent_thought_chunk` | `thinking` | 实测出现（`real-dsh-write-tool.json` 同批 turn） |
| `agent_message_chunk` | `thinking` | 实测出现 |
| `tool_call` | `tool_running` + `toolName = update.title` | 实测：`title:"write"`、`rawInput.file_path` |
| `tool_call_update` | `tool_running`（`status:"completed"` 时仍为 `tool_running` 直到下一条非工具帧） | 实测只有 `status` + text 渲染，无指纹 |
| `plan` / `user_message_chunk` | `thinking` | ACP 词汇表内；本迭代未观测，不影响语义 |
| `usage_update` / `available_commands_update` | **不变更状态**，`noise:true` | 真实流里占 50%，必须白名单排除 |
| 未知判别值 | 不变更状态，`noise:true`，计数 `unknownUpdate` | 不能当进展（否则接受时点被提前） |
| `session/request_permission`（客户端侧） | `waiting_input` + `permissionAction` | 仅夹具可产生 |
| 核心 `onOutputSubmitted` | `waiting_dependency` | 非 ACP 语义，由核心显式置位 |
| `stopReason` 返回 / `session/cancel` | `idle` | BR-06 |

- **迟到帧隔离**：`onCancelled` 后该 session 进入 `quarantined`，`turnId` 不匹配的 update 一律丢弃（cancel 实测 4.3s 才生效，迟到帧不可避免）。

### 2.8 `src/adapter/handoff-tracker.js`

```js
createHandoffTracker({handoffId, startedAt, emit}) -> tracker

tracker.created(meta)                  -> {ok:true, state:'created'}
tracker.delivered({atMs})              -> {ok:true, state:'delivered'}
tracker.observeTurnEvent({name, atMs}) -> {ok:true, state:'accepted'|'delivered', ambiguityWindowMs?}
tracker.consumed({atMs})               -> {ok:true, state:'consumed'}
tracker.rejected({reason, atMs})       -> {ok:true, state:'rejected', reason}   // 'target_rejected'|'permission_denied'|'withdrawn'
tracker.state()                        -> 'created'|'delivered'|'accepted'|'consumed'|'rejected'
tracker.snapshot()                     -> {handoffId, state, timestamps:{…}, acceptedSignal, ambiguityWindowMs}
```

- **`accepted` 判定唯一入口是 `observeTurnEvent`**，且 `name ∈ TURN_UPDATES`（6 类：`agent_thought_chunk` / `agent_message_chunk` / `tool_call` / `tool_call_update` / `plan` / `user_message_chunk`）。噪声帧（`usage_update` / `available_commands_update`）即便先到也**不改变状态**（AC-19 / BR-15）。
- `ambiguityWindowMs = accepted.atMs - delivered.atMs`，随事件一起落盘（report §5 要求"附不可观测窗口"）。
- **禁止**：任何 TTL / 定时器 / 超时判定（`expired` 本迭代不产生，B-2、AC-24）。
- `rejected` 的三种原因**必须分开记**（AC-11 要求"已撤回"不能与"目标拒绝"混作一条）。

### 2.9 `src/core/verify-artifact.js` + `src/core/error-map.js`

```js
// verify-artifact.js —— 最小核对，不做证据模型
verifyArtifacts({cwd, declared = [], observedRefs = []}) -> Promise<{
  ok: boolean,
  refs: [{ref, absPath, declared, exists, bytes, sha256: null}],   // sha256 恒 null（I1.12）
  note?: 'NO_DECLARATION',
  failure?: {code:'MISSING'|'EMPTY', ref, message}
}>
```

- 规则：**声明了路径** → 必须存在且 `bytes > 0`；**未声明** → `ok:true` + `note:'NO_DECLARATION'`，并写事件 `{reason:'verification.skipped', detail:{note:'未声明产出，跳过存在性检查'}}`（需求 2.4 边界说明原文口径）。
- `observedRefs` 只接受**从 `tool_call.rawInput.file_path` 提取**的路径（工具类型为 `write` / `edit`；`tool_call_update` 里没有，实测 G-3）。本迭代只用于日志，不参与判定。

```js
// error-map.js —— 分类，不含中文
export const CODES = {
  DSH_SPAWN_FAILED:'DSH_SPAWN_FAILED',
  CWD_NOT_WRITABLE:'CWD_NOT_WRITABLE',
  CORE_START_FAILED:'CORE_START_FAILED',
  NODE_BUSY:'NODE_BUSY',
  SESSION_INVALID:'SESSION_INVALID',
  PERMISSION_DENIED:'PERMISSION_DENIED',
  HOST_ERROR:'HOST_ERROR',
  VERIFY_FAILED:'VERIFY_FAILED',
  UNKNOWN_ERROR:'UNKNOWN_ERROR'
};

classifyPromptError({code, message, sessionKnown}) -> {code, params}      // 开始后
classifyPreflightError({stage, cause})            -> {code, params}      // 开始前
isSessionInvalid({code, message})                 -> boolean
```

**映射规则（逐条可判定，禁止只按 code）**

| 输入 | 输出 code | 备注 |
|---|---|---|
| `-32602` **且** message 匹配 `/already in flight/i` | `NODE_BUSY` | 双义之一（实测原文 `a prompt is already in flight for this session`） |
| `-32602` / `-32002` 其余情况，或 `session/list` 回读不含该 id | `SESSION_INVALID` | 双义之二；**必须看 message 或回读**，禁止只按 code |
| permission 应答为 `reject-once`，或宿主回 `stopReason: refusal` | `PERMISSION_DENIED` | `params` 带 `step`（工具名/动作名） |
| 其他 JSON-RPC `error`（如 `-32603`） | `HOST_ERROR` | `params.raw` 保留完整原文，不改写不截断 |
| 未登记 code | `UNKNOWN_ERROR` | 同上 |
| 我方 `cancel` 导致的 `stopReason: cancelled` | **不是错误**，走 `WITHDRAWN` 分支（交接包 `rejected` + `reason:'withdrawn'`） | AC-11 |
| 产物核对 `MISSING` / `EMPTY` | `VERIFY_FAILED` | `params.reason` 形如 `未找到声明的产出 out/intro.md` |
| `spawn` 失败 / 退出无响应 | `DSH_SPAWN_FAILED` | `params.cause` 取 stderr 尾部 |
| `fs.access(cwd, W_OK)` 失败 | `CWD_NOT_WRITABLE` | `params.path` |
| 管道拉起超时 | `CORE_START_FAILED` | `params.cause` |
| **`stopReason` 为 `end_turn` 时不得据此判失败** | — | §1.0 F3：宿主把 `blocked`/`error` 也映射成 `end_turn` |

**9 条用户文案的键（中文在 `cli/labels.js`）**

| 键 | 中文文案（逐字） | 分组 |
|---|---|---|
| `DSH_SPAWN_FAILED` | `无法启动 DSH：<原因>` | 开始前 |
| `CWD_NOT_WRITABLE` | `工作目录不可写：<路径>` | 开始前 |
| `CORE_START_FAILED` | `核心进程启动失败：<原因>` | 开始前 |
| `NODE_BUSY` | `该节点正在执行，本次未发起` | 开始前 |
| `SESSION_INVALID` | `会话已失效，需要重新创建` | 开始后 |
| `PERMISSION_DENIED` | `审批被拒绝，任务中止于 <步骤>` | 开始后 |
| `HOST_ERROR` | `执行失败：<宿主原文>` | 开始后 |
| `VERIFY_FAILED` | `核对失败：<具体原因>` | 开始后 |
| `UNKNOWN_ERROR` | `未知错误：<宿主原文>` | 开始后 |
| `STATE_CORRUPT`（附加，非 2.6 九条） | `状态不可读，已备份为 state.json.corrupt` | 读状态 |

### 2.10 `src/core/event-bus.js`

```js
createEventBus({store, clock}) -> bus

bus.emit(event)                 -> Promise<{ok:true, seq, ts} | {ok:false, code:'STORE_WRITE_FAILED'}>
bus.subscribe(handler, {instanceId?}) -> () => void          // handler(event)
bus.replay(instanceId)          -> Promise<event[]>
bus.nextSeq(instanceId)         -> number                     // 启动时从 events.jsonl 末行恢复
```

- **顺序固定**：补 `ts` / `seq` → `store.appendEvent` → 成功后广播。落盘失败**不广播**并返回失败（"事件必落盘"）。
- 单实例事件串行（内部按 `instanceId` 排队），避免两处并发写同一文件导致行交错。

### 2.11 `src/persistence/instance-store.js`

```js
createStore({root}) -> store

store.load(id)            -> Promise<{ok:true, state} | {ok:false, code:'NOT_FOUND'|'STATE_CORRUPT', backupPath?, params}>
store.save(id, state)     -> Promise<{ok:true, updatedAt} | {ok:false, code:'STORE_WRITE_FAILED'|'STORE_WRITE_BLOCKED_CORRUPT'}>
store.appendEvent(id, ev) -> Promise<{ok:true, seq} | {ok:false, code:'STORE_WRITE_FAILED'}>
store.readEvents(id)      -> Promise<{ok:true, events} | {ok:false, code:'STORE_READ_FAILED', params}>
store.list()              -> Promise<{ok:true, items:[{instanceId, state, nodeState, sessionState, handoffState, updatedAt, readable:boolean}]}>
store.markCorrupt(id)     -> Promise<{ok:true, backupPath}>   // copy → state.json.corrupt，保留原文件
```

- `load` 的 JSON 解析失败 / 缺 `schemaVersion` / 缺 `instanceId` → 视为损坏：`copyToBackup` → 该 id 进 `writeBlocked` → 返回 `STATE_CORRUPT`。
- 损坏**不清空、不重建**；`save` 对该 id 恒失败，直到人工处理。

### 2.12 `src/core/orchestrator.js`

```js
createOrchestrator({store, bus, adapterFactory, verify, clock, generation}) -> orch

orch.startRun({cwd, task, instanceId?, hostId='dsh'}) -> Promise<
  {ok:true, instanceId, nodeId, sessionId, stream:AsyncIterable<event>} |
  {ok:false, code:'NODE_BUSY'|'CWD_NOT_WRITABLE'|'DSH_SPAWN_FAILED'|'SESSION_INVALID', params}
>
orch.cancel({instanceId})           -> Promise<{ok:true, session, node, handoff}>
orch.getStatus({instanceId})        -> Promise<{ok:true, snapshot} | {ok:false, code}>
orch.listInstances()                -> Promise<{ok:true, items}>
orch.reconcileOnBoot({generation})  -> Promise<{ok:true, interrupted:string[]}>     // 见下
orch.interruptAll({reason:'core.stop'}) -> Promise<{ok:true, interrupted:string[]}>
orch.dispose()                      -> Promise<void>
```

**`startRun` 主流程（顺序固定，每步都落事件）**

| # | 步骤 | 失败 → |
|---|---|---|
| 1 | 解析 `cwd`（`realpath`）→ 校验可写 | `CWD_NOT_WRITABLE`，**不创建实例**（AC-10） |
| 2 | 分配/校验 `instanceId`；`已存在` 则检查节点是否 `running`/`review` | 有并发执行 → `NODE_BUSY`，**不建会话**（AC-07 / BR-01） |
| 3 | 建实例（`created`）→ 立刻 `running`（**先只在内存构造，暂不落盘**，见下"半截实例"规则） | 存储失败 → 直接失败退出，不残留半截 |
| 4 | `adapters.dsh.probe()` → `initialize()` → `newSession({cwd})` | `DSH_SPAWN_FAILED`（AC-09）；**实例回滚**为不落盘（见下"半截实例"规则） |
| 5 | 节点 `pending → running`；会话置 `thinking`（`onPromptSent`） | — |
| 6 | 构造交接包 `HO-001`（`created`）→ `prompt` 投递 → `delivered` | 投递报错 → `SESSION_INVALID` / `HOST_ERROR` |
| 7 | 归一化事件流：首条 turn 内事件 → `accepted`（附 `ambiguityWindowMs`） | — |
| 8 | `stopReason` 返回 → 会话 `waiting_dependency`（`onOutputSubmitted`）；节点 `running → review` | — |
| 9 | `verifyArtifacts` → 通过：节点 `review → done`、交接包 `accepted → consumed`、实例 `running → completed`；不通过：节点 `review → failed`、实例 `→ failed`、`VERIFY_FAILED` | — |

**"半截实例"规则（AC-09 的可复核口径）**：第 4 步失败时，实例已在第 3 步落盘。处理为：**第 3 步不落盘**，实例与节点的 `created`/`running` 先在内存构造，**第 4 步成功后才首次 `save`**。这样 `orch status` 不会看到一个没有会话的实例。事件仍逐条落盘（用于复盘），但 `instanceDir` 内只有 `events.jsonl`、没有 `state.json` 时，`list()` 标 `readable:false` 并**不计入实例列表**。

**`reconcileOnBoot`**：启动时扫描所有实例，满足「状态 ∈ {`created`,`running`} 且 `coreGeneration !== 当前 generation`」→ `running → interrupted`（`reason:'core.gone'`，节点附 `note:'停在节点 <显示名> / 会话 <显示名>'`）。**只判状态，不重跑、不接回会话**（BR-11 / AC-12）。

- **`fresh` 强制**：每次 `startRun` 必 `newSession`，无会话复用代码路径（约束 6）。

### 2.13 `src/daemon/ipc-frames.js` / `server.js` / `client.js` / `lifecycle.js`

```js
// ipc-frames.js
encodeFrame(frame)              -> Buffer            // JSON.stringify + '\n'
createFrameDecoder({maxBytes})  -> {push(buf) -> frame[], reset()}
validateFrame(frame)            -> {ok:true} | {ok:false, code:'IPC_BAD_FRAME'}
```

```js
// server.js
createServer({root, orchestrator, bus, generation}) -> server
server.listen()          -> Promise<{ok:true, pipeName, generation}>
server.close({mode:'graceful', timeoutMs = 5000}) -> Promise<{ok:true, interrupted:string[]}>
```

| 方法 | params | result |
|---|---|---|
| `core.ping` | `{}` | `{generation, pid, startedAt, version}` |
| `core.info` | `{}` | `{pipeName, dsh:{command,args,source}, limits}` |
| `core.stop` | `{}` | `{ok:true}`（回包后才开始优雅退出，见 §1.3） |
| `run.start` | `{cwd, task, instanceId?}` | `{instanceId, nodeId, sessionId}` |
| `instance.get` | `{instanceId}` | `snapshot`（§3.1） |
| `instance.list` | `{}` | `{items:[…]}` |
| `instance.events` | `{instanceId, sinceSeq?}` | `{events:[…]}` |
| `instance.cancel` | `{instanceId}` | `{session, node, handoff}` |
| `instance.subscribe` | `{instanceId}` | `{ok:true}` 后转为 `evt` 流 |

```js
// client.js
createClient({root, clock}) -> client
client.connect({ensure = true, coldStartTimeoutMs = 30000, hotRetryMs = 5000})
      -> Promise<{ok:true, coldStart:boolean, elapsedMs} | {ok:false, code:'CORE_START_FAILED', params}>
client.request(method, params, {timeoutMs = 30000}) -> Promise<result>
client.subscribe(instanceId, handler) -> Promise<() => void>
client.close()                        -> Promise<void>
```

```js
// lifecycle.js
ensureCore({root})                     -> Promise<{ok:true, pid, coldStart, elapsedMs} | {ok:false, code:'CORE_START_FAILED'}>
stopCore({root, timeoutMs = 5000})     -> Promise<{ok:true, exit:'graceful'} | {ok:false, code:'CORE_STOP_TIMEOUT', params:{pid}}>
isAlive({root})                        -> Promise<boolean>
```

- **热/冷启动计时口径**（NFR-01）：`isAlive` 为真 → 仅测试连接耗时（热）；为假 → 含 spawn + 轮询（冷）。两者都写 `core.info` 与验收记录。

### 2.14 `src/cli/labels.js` / `render.js` / `main.js` / `bin/orch.js`

```js
// labels.js —— 唯一中文来源
INSTANCE_LABEL = {created:'已创建', running:'运行中', completed:'已完成', failed:'失败', cancelled:'已取消', interrupted:'已中断'};
NODE_LABEL     = {pending:'待执行', running:'执行中', review:'待校验', done:'已完成', failed:'失败', cancelled:'已取消'};
SESSION_LABEL  = {idle:'空闲', thinking:'执行中', tool_running:'执行中', waiting_input:'等待审批', waiting_dependency:'等待下游', escalated:'已升级'};
HANDOFF_LABEL  = {created:'已构造', delivered:'已投递', pending:'待投递', accepted:'已接受', consumed:'已完成', rejected:'已拒绝', expired:'已过期'};
ERROR_TEMPLATE = {DSH_SPAWN_FAILED:'无法启动 DSH：{cause}', …};   // 9 条 + STATE_CORRUPT
formatDuration(ms) -> '3s' | '1m12s' | '2m'
```

```js
// render.js
renderInstanceLine(snapshot) -> '实例 INST-001 · 运行中'
renderSessionLine(snapshot, nowMs) -> '会话 执行中 · 已运行 3s' | '会话 执行中 · 调用工具（写文件）'
                                   | '会话 等待审批：git_push' | '会话 等待下游' | '会话 空闲'
renderSessionStall(snapshot, nowMs) -> '会话 执行中 · 已运行 8m · 无新事件'
renderNodeLine(snapshot)  -> '节点 已完成 · 耗时 1m12s' | '节点 待校验'
renderHandoffLines(snapshot)-> ['交接包 HO-001  已构造   10:30:02', …]
renderHandoffWait(snapshot, nowMs) -> '交接包 HO-001  已投递   等待目标响应 · 已等待 2m'
renderEventLine(event)    -> '10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event'
renderRejectedTransition(event) -> '10:31:20  节点 T-001  拒绝的迁移：已完成 → 执行中'
renderError({code, params}) -> ERROR_TEMPLATE 填充结果
```

```js
// main.js
main(argv) -> Promise<number>      // 退出码：0 成功 / 1 失败 / 2 用法错误 / 3 预检失败
```

| 命令 | 参数 | 输出（成功路径） | 退出码 |
|---|---|---|---|
| `orch run` | `--cwd <dir>`（必需）、`--task <text>`（必需）、`--instance <id>`（可选） | 6 行流式：`实例 … · 运行中` → `会话已创建 <sessionId>` → `任务已投递` → `会话 执行中 · 已运行 Ns`（持续刷新）→ `会话 等待下游 · 产出已提交` → `节点 已完成 · 耗时 …` | 0 / 1 / 2 / 3 |
| `orch status` | `[--instance <id>] [--events]` | 无 `--instance`：多行实例清单（每实例 1 行摘要）；有：实例行 + 节点行 + 会话行 + 交接包行（+ `--events` 追加事件时间线） | 0 / 1 |
| `orch cancel` | `--instance <id>`（必需） | `会话 空闲` + `节点 已取消` + `交接包 HO-001 已拒绝（已撤回）` | 0 / 1 |
| `orch core stop` | 无 | `核心已停止（pid …，运行 …）` | 0 / 1 |

- `main.js` **不拼中文**，只调用 `render.*`；`main.js` 不直接读 `state.json`，一切经 `client`（唯一写者原则 → 读也走 core，保证 `已中断` 判定一致）。
- `bin/orch.js` 只有三行职责：拿 `argv` → `main` → `process.exit(code)`。

---

## 3. 数据模型（JSON 形状）

### 3.1 `state.json`（完整字段）

```json
{
  "schemaVersion": 1,
  "instanceId": "INST-001",
  "coreGeneration": "gen-1f3c9a2b",
  "createdAt": "2026-11-04T10:30:02.113Z",
  "updatedAt": "2026-11-04T10:31:14.902Z",
  "state": "running",
  "cwd": "D:\\WWW\\Maestro\\demo",
  "task": "写一段 200 字的产品说明，保存到 out/intro.md",
  "roleId": "worker",
  "node": {
    "nodeId": "T-001",
    "state": "review",
    "stateSince": "2026-11-04T10:31:14.902Z",
    "startedAt": "2026-11-04T10:30:02.400Z",
    "endedAt": null,
    "failure": null,
    "note": null
  },
  "session": {
    "sessionId": "97ceac7e-57a1-458d-8069-5e5ab412ca45",
    "hostId": "dsh",
    "state": "waiting_dependency",
    "stateSince": "2026-11-04T10:31:14.880Z",
    "createdAt": "2026-11-04T10:30:02.610Z",
    "lastEventAt": "2026-11-04T10:31:14.870Z",
    "toolName": null,
    "turnId": "turn-1",
    "pendingPermission": null,
    "quarantined": false
  },
  "handoff": {
    "handoffId": "HO-001",
    "state": "accepted",
    "createdAt": "2026-11-04T10:30:02.700Z",
    "deliveredAt": "2026-11-04T10:30:02.742Z",
    "acceptedAt": "2026-11-04T10:30:02.805Z",
    "consumedAt": null,
    "rejectedAt": null,
    "rejectReason": null,
    "acceptedSignal": "agent_thought_chunk",
    "ambiguityWindowMs": 63
  },
  "artifactRefs": [
    {
      "ref": "out/intro.md",
      "absPath": "D:\\WWW\\Maestro\\demo\\out\\intro.md",
      "declared": true,
      "exists": true,
      "bytes": 118,
      "sha256": null,
      "verifiedAt": "2026-11-04T10:31:14.900Z"
    }
  ],
  "hostRaw": {
    "stopReason": "end_turn",
    "lastError": {
      "code": -32602,
      "message": "a prompt is already in flight for this session",
      "at": "2026-11-04T10:29:58.001Z"
    },
    "agentInfo": { "name": "deepseek-harness-acp", "version": "0.0.1" }
  },
  "counters": { "eventSeq": 41, "runCount": 1 }
}
```

字段约束：
- `state` / `node.state` / `session.state` / `handoff.state` 只允许 §1.5 表内的英文值；中文**不得**出现。
- `sha256` 恒为 `null`（I1.12 才计算）；不写空串。
- `hostRaw.lastError.message` 必须保留宿主原文（不改写、不截断，BR-12）。

### 3.2 `events.jsonl`（单行 = 一帧事件）

```json
{"seq":18,"ts":"2026-11-04T10:30:02.805Z","object":"handoff","objectId":"HO-001","from":"delivered","to":"accepted","result":"applied","reason":"turn.first_event","detail":{"event":"agent_thought_chunk","ambiguityWindowMs":63},"gen":"gen-1f3c9a2b"}
```

| 字段 | 必填 | 含义 |
|---|---|---|
| `seq` | 是 | 实例内单调递增，启动时从末行恢复 |
| `ts` | 是 | ISO-8601 UTC 毫秒 |
| `object` | 是 | `instance` / `node` / `session` / `handoff` |
| `objectId` | 是 | `INST-001` / `T-001` / `<sessionId>` / `HO-001` |
| `from` | 是 | 迁移前状态（英文枚举；非迁移事件用 `null`） |
| `to` | 是 | 迁移后状态（拒绝的迁移填**尝试目标**） |
| `reason` | 是 | 机器可读原因，如 `turn.first_event` / `core.stop` / `core.gone` / `illegal_transition` / `verification.skipped` |
| `detail` | 否 | 附加结构（宿主原文、`ambiguityWindowMs`、`note`） |
| `result` | 是 | `applied` / `rejected` / `note` |
| `gen` | 是 | 写入时的 `coreGeneration`，供 `reconcileOnBoot` 判定 |

**"拒绝的迁移"怎么记（AC-26）**

```json
{"seq":27,"ts":"2026-11-04T10:40:11.020Z","object":"node","objectId":"T-001",
 "from":"done","to":"running","result":"rejected","reason":"illegal_transition",
 "detail":{"message":"node: done → running 不在迁移表内","source":"fixture/attempt-transition"},
 "gen":"gen-1f3c9a2b"}
```

- 显示层渲染为 `节点 T-001  拒绝的迁移：已完成 → 执行中`。
- `from === to` 的重复置位**不写事件**（避免噪音），也不算"拒绝的迁移"。

---

## 4. 工作包拆分（WP-1 ~ WP-6）

> 粒度原则：**文件清单互不重叠**（并行实现不会互相覆盖），依赖是 DAG，每个包都能独立跑通自己的契约测试。

### WP-1 持久化与事件底座

- **负责文件（5）**：`package.json`、`src/persistence/paths.js`、`src/persistence/atomic-write.js`、`src/persistence/instance-store.js`、`src/core/event-bus.js`
- **依赖**：无
- **交付**：`.orch` 布局可创建；`state.json` 原子写（含 Windows `EPERM` 重试）；损坏时**复制**为 `state.json.corrupt` 且 `save` 被阻断；`events.jsonl` 追加、`seq` 从末行恢复；事件总线"先落盘后广播"。
- **验收口径**：AC-13（损坏不清空）、AC-14 / BR-10（每条事件四要素齐全）、AC-12（重启后数据可读）的数据层部分。
- **可否并行**：可（与其他 5 包无文件重叠，无前置）

### WP-2 状态机 · 错误分类 · 文案

- **负责文件（4）**：`src/core/state-machine.js`、`src/core/error-map.js`、`src/cli/labels.js`、`test/fixtures/attempt-transition.mjs`
- **依赖**：无（只依赖 WP-1 的 `appendEvent` **接口契约**，不 import 其实现；`attempt-transition.mjs` 在联调期接 WP-1）
- **交付**：三张迁移表 + `can/assert/apply`；表外迁移返回结构化拒绝并 emit `result:'rejected'`；`escalated` 为定义态；9 条文案键与 2.6 逐字一致；`-32602` 双义按 message 分类。
- **验收口径**：AC-26（非法迁移被拒 + 事件留痕）、AC-18/AC-20/AC-21/AC-22 的**文案与分类**部分、AC-05/AC-06 的迁移合法性部分。
- **可否并行**：可（纯逻辑，无 IO）

### WP-3 ACP 适配器 · DSH 启动 shim · mock 宿主夹具

- **负责文件（7）**：`src/adapter/stdio-transport.js`、`src/adapter/acp-client.js`、`src/adapter/session-state.js`、`src/adapter/handoff-tracker.js`、`src/adapter/dsh-launch.js`、`src/adapter/host-config.js`、`test/fixtures/mock-acp-agent.js`
- **依赖**：无（不 import core；错误以 `{code,message}` 原样上抛）
- **交付**：NDJSON 收发（§1.0 口径，含 8MiB 上限、解析失败不断连）；6 个 ACP 原语（`cancel` 为通知）；`quietWindow`；`reduce()` 逐判别值映射 + 噪声白名单；`accepted` 只认 6 类 turn 内事件；`interrupted` 之外的 TTL **零实现**；DSH shim 配置化；mock agent 支持 11 个开关中的 10 个（`--illegal-transition` 归 WP-2）。
- **验收口径**：AC-15、AC-16、AC-17、AC-18、AC-19、AC-20、AC-21、AC-22、AC-23、AC-24、AC-25（共 11 条，全部夹具面）。
- **可否并行**：可（唯一允许出现协议与宿主细节的包）

### WP-4 编排主流程 · 产出核对

- **负责文件（2）**：`src/core/orchestrator.js`、`src/core/verify-artifact.js`
- **依赖**：WP-1（store / bus）、WP-2（SM / error-map）、WP-3（adapter 接口）
- **交付**：`startRun` 9 步流程（含"半截实例不落盘"规则）；`cancel` 三对象收敛到终态；`reconcileOnBoot`（`core.gone` → `已中断`）；`interruptAll`；产出核对（声明则存在且非空，未声明则跳过并写事件）。
- **验收口径**：AC-01、AC-03、AC-04、AC-05、AC-06、AC-10、AC-11、AC-12（状态侧）；AC-09（半截实例规则）。
- **可否并行**：契约冻结后可**与 WP-5 同时开工**（§6 说明），联调需 WP-1/2/3 合入。

### WP-5 守护进程与 IPC

- **负责文件（4）**：`src/daemon/ipc-frames.js`、`src/daemon/server.js`、`src/daemon/client.js`、`src/daemon/lifecycle.js`
- **依赖**：WP-1（paths / store）、WP-4（orchestrator 接口）
- **交付**：命名管道监听（`\\.\pipe\maestro-<hash16>`）；三类帧编解码与 8MiB 上限；9 个方法；`detached` 自动拉起 + 100ms 轮询 + 30s 冷启动上限；`core stop` 回包后优雅退出（≤5s）；热/冷启动耗时回传。
- **验收口径**：AC-02、AC-07、AC-08、AC-09（`CORE_START_FAILED` 路径）、AC-12（`core stop` 路径）、AC-13（`STATE_CORRUPT` 透出）、NFR-07。
- **可否并行**：需 WP-4 接口先行；与 WP-4 并行开工、串行联调。

### WP-6 CLI 与输出

- **负责文件（3）**：`bin/orch.js`、`src/cli/main.js`、`src/cli/render.js`
- **依赖**：WP-5（client）、WP-2（labels）
- **交付**：4 命令参数解析（含 `--instance` / `--events`）；流式输出 6 行序列；退出码 0/1/2/3；所有行带层名前缀；`--events` 时间线渲染；`已中断` 与"停在节点/会话哪一步"的呈现。
- **验收口径**：AC-01、AC-02、AC-03、AC-04、AC-05 的**可见性**部分、AC-14、AC-11 的显示部分、AC-12 的显示部分。
- **可否并行**：不可（链尾），但可在 WP-5 完成前用假 client 打通渲染。

### 4.1 文件 → 工作包归属（互不重叠校验）

| 文件 | WP |
|---|---|
| `package.json` | 1 |
| `src/persistence/paths.js` `atomic-write.js` `instance-store.js` | 1 |
| `src/core/event-bus.js` | 1 |
| `src/core/state-machine.js` `error-map.js` | 2 |
| `src/cli/labels.js` | 2 |
| `test/fixtures/attempt-transition.mjs` | 2 |
| `src/adapter/*.js`（6 个） | 3 |
| `test/fixtures/mock-acp-agent.js` | 3 |
| `src/core/orchestrator.js` `verify-artifact.js` | 4 |
| `src/daemon/*.js`（4 个） | 5 |
| `bin/orch.js` `src/cli/main.js` `render.js` | 6 |

> 校验方式：24 个文件，每个恰属 1 个包，无跨包共享文件。共享**契约**不共享文件。

---

## 5. 交付物清单

| 路径 | 内容 | 工作包 |
|---|---|---|
| `package.json` | ESM 单包，`bin.orch`，零依赖 | WP-1 |
| `src/persistence/paths.js` | `.orch` 布局 + 管道名 | WP-1 |
| `src/persistence/atomic-write.js` | 原子写 + 备份复制 | WP-1 |
| `src/persistence/instance-store.js` | 快照/事件读写 + 损坏处理 | WP-1 |
| `src/core/event-bus.js` | 事件必落盘 + 订阅 | WP-1 |
| `src/core/state-machine.js` | 三张状态机 | WP-2 |
| `src/core/error-map.js` | 9 码分类（含 `-32602` 双义） | WP-2 |
| `src/cli/labels.js` | 唯一中文文案表 | WP-2 |
| `test/fixtures/attempt-transition.mjs` | AC-26 非法迁移夹具 | WP-2 |
| `src/adapter/stdio-transport.js` | NDJSON stdio 传输 | WP-3 |
| `src/adapter/acp-client.js` | ACP 原语 + quiet window | WP-3 |
| `src/adapter/session-state.js` | 会话状态归一化 | WP-3 |
| `src/adapter/handoff-tracker.js` | 交接包状态推导 | WP-3 |
| `src/adapter/dsh-launch.js` | Windows 启动 shim | WP-3 |
| `src/adapter/host-config.js` | 启动配置解析 | WP-3 |
| `test/fixtures/mock-acp-agent.js` | 同协议 mock 宿主（10 个开关） | WP-3 |
| `src/core/orchestrator.js` | 单节点主流程 + 启动对账 | WP-4 |
| `src/core/verify-artifact.js` | 最小产出核对 | WP-4 |
| `src/daemon/ipc-frames.js` | 帧编解码 | WP-5 |
| `src/daemon/server.js` | 管道服务端 | WP-5 |
| `src/daemon/client.js` | CLI 侧客户端 + 自动拉起 | WP-5 |
| `src/daemon/lifecycle.js` | 起停与探活 | WP-5 |
| `bin/orch.js` | 入口 | WP-6 |
| `src/cli/main.js` | 4 命令 | WP-6 |
| `src/cli/render.js` | 行渲染 | WP-6 |

> 本迭代**不交付**：`docs/iterations/iteration-1/report.md`（执行期产出，属收口工作，不属拆分范围）。

---

## 6. 依赖与并行策略

```
WP-1 持久化与事件底座 ──┬────────────────► WP-4 编排主流程 ──► WP-5 守护进程 ──► WP-6 CLI
WP-2 状态机/错误/文案 ──┤                      ▲                  ▲                ▲
WP-3 适配器 + 夹具    ──┴──────────────────────┘                  │                │
                                                                  └── 契约先行可并行 ┘
箭头 = "上游合入后才能联调"，不是"不能先写"
```

- **可同时开工（零前置）**：**WP-1 / WP-2 / WP-3** 三包并行，彼此无文件重叠、无 import 依赖（WP-2 只依赖 WP-1 的 `appendEvent` 契约签名，联调期才接实现）。
- **第二波**：WP-4（等 1/2/3 的模块可 import）。
- **第三波**：WP-5（等 WP-4 的 orchestrator 可实例化）。**WP-5 可在 WP-4 合入前开工**——`server.js` 只依赖 §2.12 冻结的方法签名，可先接一个返回固定快照的假 orchestrator，联调时替换。
- **第四波**：WP-6（等 WP-5 的 client；渲染层可先用假快照开发）。
- **关键路径**：WP-1/WP-3 → WP-4 → WP-5 → WP-6（4 跳）。
- **整合检查点（3 个）**：① WP-1+2+3 合入后跑「状态机 + 归一化 + 存储」契约测试；② WP-4 合入后手工跑一次真实 DSH 单节点（AC-01 首个证据）；③ WP-5+6 合入后跑 26 条 AC 全量。

---

## 7. 风险与降级

| # | 风险 | 触发条件 | 影响 | 降级动作 |
|---|---|---|---|---|
| R1 | **分帧认知错误**（若按 `Content-Length` 实现） | 照抄"ACP 沿用 LSP 头"的常见说法 | 与真实 DSH **完全无法握手**，全部 AC 阻塞 | 已按 §1.0 实测锁定 NDJSON；`stdio-transport` 的契约测试固定用 `real-dsh-noise-frames.json` 的序列化作输入 |
| R2 | `-32602` 同码双义 | 对忙会话投递 | 把"目标忙"误判为"会话失效"→ 新建重复会话（违反 AC-07 / BR-01） | 强制按 `message` 分类（`/already in flight/i`）+ 可选 `session/list` 回读；两条路径各有单测 |
| R3 | **`stopReason` 掩盖失败**（`blocked`/`error` → `end_turn`，§1.0 F3） | 宿主 turn 内出错但正常结束 | 节点被推成"已完成"，假交付 | 失败判定只认 ① JSON-RPC `error` ② 产出核对不通过；`stopReason` 仅用于结束判定，**禁止**用于成功判定 |
| R4 | cancel 非即时（实测 4.3s） | 用户执行 `orch cancel` | 迟到 update 把会话翻回"执行中"（违反 AC-11） | 会话 `quarantined` + `turnId` 过滤；节点/交接包**立即**落终态；5s 内不确认也照样落终态并写 `note` |
| R5 | 真实 DSH 不发起审批 | 写 cwd 内文件不触发 `request_permission` | AC-17 / AC-18 无法在真实面验收 | 两 AC 只走夹具（需求 3.3 已定），验收记录必须注明"夹具" |
| R6 | 命名管道权限/清理异常 | 多用户同机、杀软拦截 | `core.ping` 超时，被误判为"核心未启动" | `connect` 失败区分 `ENOENT`（不存在 → 拉起）与 `EACCES`（权限 → 直接 `CORE_START_FAILED`，不反复拉起） |
| R7 | `detached` 子进程被父 shell 带走 | 用户在终端 Ctrl-C / 关窗口 | NFR-07 / AC-12 失败 | `detached:true` + `unref()` + `stdio:'ignore'`；验收含"关窗口后 `orch status` 仍可查"一条用例 |
| R8 | 多写者并发写同一实例 | CLI 与 core 同时写 `state.json` | 快照撕裂 | **单一写者原则**：只有 core 写；CLI 一切操作（含 `status`）走 IPC；`core.json` 只读 |
| R9 | 损坏文件被后续写入覆盖 | 损坏后仍有 `save` | 违反 AC-13 / BR-16 | 损坏即 `writeBlocked`，`save` 返回 `STORE_WRITE_BLOCKED_CORRUPT`；备份用**复制**保留原文件 |
| R10 | 实例卡在 `执行中` 无进展被误判 | 用户心急 / 长任务 | 误杀仍在跑的会话（AC-23 失败） | 不实现"静默即失败"，只显示 `已运行 Nm · 无新事件`；不实现 TTL（B-2） |
| R11 | 冷启动 > 30s（首帧模型冷启动） | 首次拉起 + 模型侧排队 | NFR-01 不达标 | 分开记录热/冷；冷启动超时只报 `CORE_START_FAILED` 并保留 `elapsedMs` 证据，不静默重试 |
| R12 | 阶段零约束遗漏（13 条） | 子包实现时各自发明 | 返工 | §1.11 逐条映射到文件；每个 WP 的验收清单里回指该表 |
| R13 | 需求内部张力：`--instance` 复用 vs 终态 | 对 `已中断` 实例再次 `orch run --instance` | 语义二义 | 本迭代**只允许**在节点处于 `pending`（未投递）时复用；终态实例复用返回明确拒绝（恢复执行归 I1.8），并把该二义列入 §8 待确认 |

---

## 8. 需求与阶段零约束之间的冲突（拆分前必须澄清）

| # | 冲突 | 两侧原文 | 本文处置 | 状态 |
|---|---|---|---|---|
| X1 | **分帧方式与通说相反** | 任务口径「ACP 沿用 LSP 风格 `Content-Length` 分帧」 vs 实测 `ndJsonStream`（`\n` 分隔、无头） | 按实测实现 NDJSON；证据 §1.0（`dsh-acp/lib/index.js` + sdk 1.4.0 `stream.js` / `line-buffer.js`） | **已核实，按实测执行** |
| X2 | **AC-13 与 2.7 互相排斥** | 2.7「已备份为 state.json.corrupt」（重命名会移走原文件） vs AC-13「原来的文件仍在，没有被清空或覆盖」 | 备份改为**复制**：原 `state.json` 保留原字节，副本为 `state.json.corrupt` | 已决定（§1.4） |
| X3 | **交接包 `已完成` 的判据不同** | 需求 2.5「已完成 = 目标节点产出提交并**被核心核对通过**」 vs `index.md` §3.4「`consumed` = 目标节点产出提交」（不含核对） | I1.1 取需求口径（核对通过才算），并在 `events.jsonl` 里保留"核对前"的快照；基线差异记入 I1.4 复核项 | 已决定，需在 I1.4 复核 |
| X4 | **`--instance` 复用的边界** | 2.2 使用说明「用同一个实例号再发一次（例如上次中断了）」 vs 2.2 状态表「`已中断` 终态（恢复执行是 I1.8）」+ 1.3 范围外「崩溃恢复归 I1.8」 | 本迭代：`pending` 节点可复用；终态实例一律拒绝（不新增表外迁移 `interrupted → running`） | **待使用者确认** |
| X5 | **节点状态集：6 态 vs 基线 9 态** | 需求 2.4 六态（合并显示）+「不在表内的一律拒绝」 vs `index.md` §3.1 九态迁移图 | 用 6 态 + 定义态 `escalated`；6↔9 映射写进 `state-machine.js` 注释，I1.2 扩展 | 已决定（§1.5 / §2.3） |
| X6 | **`subscribeEvents` 在 stdio 下不存在** | 需求 1.3 范围内第 3 条把 `subscribeEvents` 列为原语（HTTP/SSE 语义） vs 本迭代只实现 stdio | 不改范围：stdio 下等价物是 `session/update` 通知流，`acp-client.onUpdate()` 即其入口；术语在实现注释里对齐，不新增原语 | 已决定（§2.5） |
| X7 | **AC-26 的夹具开关位置不对** | 需求 3.3 把 `--illegal-transition` 列为 mock ACP agent 的开关键 vs AC-26 要求"这次迁移被提交给核心" | mock agent 是宿主侧，无法提交节点迁移；改用 `test/fixtures/attempt-transition.mjs` 直接调用核心状态机 + 同一 `appendEvent` 写事件（§1.9） | 已决定（夹具职责重划） |
| X8 | **AC-07 的可复现前提** | AC-07 用产品命令复现"重复发起"，但两次 `orch run` 必须连到**同一个核心**才会撞上同一节点 | 验收步骤必须固定同一个 `--cwd`（管道名由项目根哈希决定，换目录就是另一个核心）；此约束写进 AC-07 验收记录模板 | 已决定（§1.3） |
