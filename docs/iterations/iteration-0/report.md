# 阶段零（I0.1）ACP 适配器兼容性 + 桌面壳可行性验证报告

> 依据：`docs/iterations/iteration-0.md`（任务拆分，8 个验证项）、`docs/index.md`（需求基线 §2.5 / I0.1）。
> 结论口径：可用 / 受限 / 不可用；每条结论标注**证据来源（真实宿主 / mock）**。
> 状态：**已收口（VR-1 ~ VR-4，覆盖 8 个验证项）**；VR-5 评审与复盘待人工排期；Tauri CI 构建待首次运行验证。

---

## 0. 总体结论（VR-4）

**结论：带约束启动。**

理由：

1. **8 个接缝中无「不可用」**，因此不触发「先补设计」。分布：**3 可用 / 4 受限 / 1 阻塞**。
2. 4 项「受限」都必须转化为阶段一的设计约束（已在 §5 逐条落地）：
   - **证据提取**：真实 DSH 的 `tool_call_update` **不含 diff / 不含产物指纹**，证据三要素无法只靠事件流构造 → 指纹必须由核心自行计算。
   - **恢复方言**：DSH 与 mock 双形态已验，**WorkBuddy 的 `load` 追加语义仍未验证**（无 sidecar 环境）。
   - **会话状态映射**：6 个会话状态里只有 3 个（`idle` / `thinking` / `tool_running`）能从真实 ACP 事件直接得出；`waiting_input` 依赖客户端侧 `request_permission`（真实 DSH 当前 profile 不发起审批）；`waiting_dependency` / `escalated` 本质是核心侧语义。
   - **交接包状态推导**：`session/prompt` 阻塞到 turn 结束才返回，投递成功 ≠ 已接受；`delivered → accepted` 之间存在**不可观测窗口**，且 `-32602` 在 DSH 上同码双义（会话不存在 / 会话忙）。
3. **Cursor 稳定性不可判定**（无 `cursor-agent` CLI），VP-5 记阻塞，不阻塞阶段一。
4. VP-1 拿到了**真实宿主上的跨 transport 证据**：同一个 DSH、同一份编排循环，仅换 `hosts/*.json`，stdio 与 HTTP+SSE 均跑通且原语序列一致、核心哈希不变。
5. **桌面壳可用，但构建归属 CI**：本机缺 Rust + MSVC + Windows SDK（Tauri 编译链），WebView2 运行时齐备；Electron 路径在本机实测通过托盘 / 多窗口 / WebSocket / 关闭缩托盘，Tauri 走 GitHub Actions 构建。

---

## 1. 交付物与复现

| 路径 | 内容 |
|---|---|
| `spike/acp-harness/` | 5 原语 harness：`ACPTransport` 接口 + 3 个 transport（stdio / mock-HTTP / 真实 ACP-HTTP）+ 原始帧落盘 |
| `spike/acp-harness/core/` | 编排循环与证据构造（**零宿主感知**，纯度检查守护） |
| `spike/mock-acp-server/` | mock agent：stdio + HTTP/SSE，单连接多会话、resume/load 双方言、cancel/close/permission、状态持久化；可调 `--accept-delay-ms` / `--busy-policy` / `--noise-*` 复刻方言差异 |
| `spike/isolation-test/` | VP-3 隔离测试（mock 版含文件级串台检测；real 版含路由归属检测） |
| `spike/dsh-launcher/` | Windows 下启动真实 DSH ACP 的绕行器 |
| `spike/acp-harness/src/normalize/` | 会话状态归一化 + 交接包状态推导（适配器层） |
| `spike/desktop-shell/` | 桌面壳运行时冒烟（Electron：托盘 / 多窗口 / WebSocket / 关闭缩托盘） |
| `spike/tauri-shell/` | Tauri 桌面壳骨架（构建走 CI） |
| `.github/workflows/desktop-build.yml` | 桌面壳 CI 构建（Tauri）+ 启动冒烟 + Electron 冒烟 |
| `docs/iterations/iteration-0/capability-matrix.md` | 宿主能力矩阵 + 环境指纹 + 方言登记 |
| `docs/iterations/iteration-0/evidence-samples/` | 原始帧样本：真实 DSH 工具调用 / resume / **忙时 `-32602` 双义** / **会话级噪声帧**；mock permission 往返；桌面壳冒烟证据 |

**复现命令**（在仓库根目录）：

```bash
# VP-1：四个宿主（2 真实 + 2 mock），同一份编排循环
node spike/acp-harness/scripts/measure-vp1.mjs --hosts=dsh-real,dsh-http,mock-stdio,mock-http

# VP-2：mock 三方言 + 真实 DSH 两种 transport
node spike/acp-harness/bin/resume-experiment.mjs
node spike/acp-harness/bin/resume-real.mjs --host=dsh-real
node spike/acp-harness/bin/resume-real.mjs --host=dsh-http

# VP-3：真实 DSH 5 并发隔离 / mock 五维隔离
node spike/isolation-test/run-real.mjs --host=dsh-real --sessions=5
node spike/isolation-test/run-isolation.mjs --host=mock-stdio --sessions=5

# VP-4：真实 DSH 证据可得性 / mock 证据构造完整性
node spike/acp-harness/bin/evidence-real.mjs --host=dsh-real
node spike/acp-harness/bin/evidence-experiment.mjs --host=mock-stdio

# VP-6：会话状态映射（离线回放真实帧 + mock permission 往返）
node spike/acp-harness/bin/state-mapping-experiment.mjs
node spike/acp-harness/bin/state-mapping-experiment.mjs --real=dsh-real

# VP-7：交接包状态推导（mock 场景矩阵 + 真实 DSH）
node spike/acp-harness/bin/handoff-experiment.mjs
node spike/acp-harness/bin/handoff-experiment.mjs --real=dsh-real
node spike/acp-harness/bin/busy-probe-real.mjs --host=dsh-real --rounds=4

# VP-8：桌面壳（构建链探测 + Electron 运行时冒烟）
node spike/tauri-shell/scripts/probe-build-chain.mjs
cd spike/desktop-shell && npm install && node smoke.mjs

# 核心纯度（阶段一每次改动都应跑）
node spike/acp-harness/scripts/check-core-purity.mjs
```

产物默认落在 `.orch-spike/runs/`（不进版本库；下文出现的 `runs/...` 均指该目录，可用上面的命令复现）。真实宿主依赖见 `capability-matrix.md` §0 环境指纹。

---

## 2. 环境准备结果（ENV-1 ~ ENV-4）

| ID | 结果 | 证据 |
|---|---|---|
| **ENV-1** DSH 本地可启动 | ✅ **已打通**（dsh `0.2.1-rc.5` + `dsh-acp-server` `0.14.4`），但需三处绕行 | `runs/env1/dsh/probe.json`、`runs/env1/dsh-mockllm/probe.json` |
| **ENV-2** HTTP/SSE 环境 | ✅ 双层：① 自建 mock server；② **真实** `dsh-acp-server serve` | `runs/env2/dsh-http/probe.json` |
| **ENV-2a** mock 合规（5 原语 + 3 类错误） | ✅ 5 原语齐备；3 类可区分错误：未知会话 `-32002` / cancel 中途 → `stopReason:cancelled` / 权限拒绝 → `stopReason:refusal` | `spike/isolation-test/run-isolation.mjs` B/D |
| **ENV-3** Cursor `agent acp` | ❌ **阻塞**：IDE `3.22.12` 已装，未检测到 `cursor-agent` CLI | `runs/vp5/cursor-probe.json` |
| **ENV-4** 探活 harness + 原始帧落盘 | ✅ `spike/acp-harness`，所有 run 输出 `<transport>.jsonl`（out/in/err 三向） | `runs/**/*.jsonl` |
| **ENV-5** 桌面壳构建链 | ⚠️ **运行时可用、本机不可编译**：WebView2 `156.0.4314.58` 已装；Rust / MSVC / Windows SDK 全缺 → Tauri 构建归属 CI | `runs/vp8/build-chain.json` |

### ENV-1 打通过程中发现的 4 个真实阻塞（阶段一必须内置处理）

1. `dsh-acp-server@0.14.4` 的 `bin/dsh-acp.mjs` 用 `import(join(...))` 传绝对路径 → Windows + Node 22 抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME`（`Received protocol 'd:'`）。**包级缺陷**，已用 `spike/dsh-launcher` 以 `pathToFileURL` 绕行。
2. 其 bootstrap 用 `spawnSync('dsh', ...)`，Windows 无法解析 `.cmd` → 首次启动必失败。绕行：手动建 `acp` profile。
3. Windows 的 `dsh` 是 `dsh.cmd`，内部以 `ELECTRON_RUN_AS_NODE=1` 跑 `app.asar/cli.js`；纯 Node 既不能 spawn `.cmd`（EINVAL），也不能读 asar 路径。
4. 无真实模型凭据（`no API key for provider route "deepseek-official"`）。为验证**会话层**，在隔离 `DSH_HOME`（`.orch-spike/dsh-home`）内把默认模型切到包内确定性 mock LLM（官方 e2e 做法，`cordis.patch.yml` 可查）。**未修改用户 `~/.dsh`。**
   → 因此本报告中的「真实」= ACP / DSH 会话与工具链真实；**模型推理质量不在验证范围**。

---

## 3. 逐接缝结论（VR-1）

| 接缝 | 结论 | 关键证据（路径 / 帧） | 度量 | 对阶段一的影响 | 缓解措施 | 未决风险 |
|---|---|---|---|---|---|---|
| **transport** | **可用**（真实 + mock 双证） | `runs/vp1/summary.json`；`runs/vp1/dsh-real/result.json`、`runs/vp1/dsh-http/result.json` | 核心哈希 `8ba2bdf0…` 四宿主一致；纯度违规 **0**；原语序列四方一致 `initialize→session/new→session/prompt`；全 `done`；耗时 2008 / 15134 / 217 / 143 ms（真实 stdio / 真实 HTTP / mock stdio / mock HTTP，HTTP 含冷启动） | 阶段一可直接采用「一份适配器 + 每宿主一份配置」 | 差异收敛在 `src/transport/*` 与 `hosts/*.json`；配置差异仅 `{args,command,cwd}` vs `{spawn,tokenEnv}` | 真实 HTTP 形状（响应走 SSE、`acp-connection-id` 亲和）与 WorkBuddy 未必一致，Phase 3 需重测 |
| **恢复方言** | **受限**（DSH/mock 已统一，WorkBuddy 未验） | `runs/vp2-real/dsh-real/observation.json`、`runs/vp2/dsh-http/…`、`runs/vp2/summary.json`、`evidence-samples/real-dsh-resume.json` | 真实 DSH resume：`restored=true`，回放仅 1 条 `available_commands_update`（不含历史），62 ms / 74 ms（stdio / HTTP）；mock 三方言：resume 回放 0 条、load 回放 6 条（drain 97 ms）、无能力时回退 `new`；核心返回键恒为 `{id,cwd,restored}` | `resumeOrCreate` 抽象成立，核心零感知 | ① 回退链 `resume → load → new`，错误码同时认 `-32601`/`-32002`/`-32602`（**`-32602` 需按 message 细分**，见发现 D3）；② **load 后必须 drain-quiet**（见发现 D1） | WorkBuddy `load`「追加式」语义未验证；`replayMode` 若进核心即属泄露 |
| **并发隔离** | **可用** | `runs/vp3-real/*/report.json`；`runs/vp3/mock-*` | 真实 DSH：5 会话并发 149 ms，串台 **0**，每会话恰好 5 条 update，5 个 `cwd` 全不同且 `session/list` 回读一致；cancel 目标 `cancelled`、其余 `end_turn`；close 后该会话报 `-32602`、存活会话正常。mock：3/5 并发 stdio+HTTP 串台 0，cancel 生效 16–17 ms，close 隔离，permission 三例正确（allow→落盘、reject→refusal 无落盘、越界 `optionId`→refusal） | 单连接多会话可直接作为阶段一默认形态 | 每会话独立 `cwd` + 独立事件归属校验纳入回归套件 | 真实 DSH 的 **文件级**串台未验证（`bash` 工具未挂载，无法落盘取证）；permission 在真实 DSH 未触发 |
| **证据提取** | **受限** | `evidence-samples/real-dsh-tool-call.json`；`runs/vp4/dsh-real-real/evidence.json`；`runs/vp4/mock-stdio/evidence.json` | 真实 DSH：`tool_call` 仅 `rawInput/locations`，`tool_call_update` 仅 `status/content`，**无 diff、无 rawOutput、无指纹** → 三要素 5 项全 `missing`。mock（宿主愿意上报 diff 的假设形态）：5 项全可得，且核心本地重算 sha256 与声明值**一致** | 证据模型需**下沉指纹计算**到核心，不能依赖宿主上报 | ① 核心按 `artifactRef` 自行 hash + 存在性 + `producedAt`；② `confirmedBy/confirmedAt` 走角色约定（final message 机器可读清单） | 「审核确认」的真实性仍只能靠独立审核角色；角色若不遵守约定则字段缺失 → 必须触发升级而非放行 |
| **会话状态映射** | **受限**（3/6 直接可得） | `runs/vp6/state-mapping.json`；`runs/vp6/mock-permission/permission-turn.json`；`runs/vp6/real-dsh-real/state-mapping.json` | 真实帧回放：`idle` / `thinking` / `tool_running` 可达；mock permission 往返闭合（`thinking → tool_running → waiting_input → thinking → tool_running → thinking → idle`）；真实 DSH `permissionSeen=false`；未知 `sessionUpdate` 0 种；噪声帧占比 3/6、4/8、3/6（三份录制） | 适配器实现归一化器；6 状态中 3 个由核心侧推断/生成 | 归一化器只依赖 `sessionUpdate` 判别值 + 客户端侧 permission 回调，接口与宿主无关 | `waiting_input` 在真实宿主上尚无证据（需 DSH 开启审批或换宿主） |
| **交接包状态推导** | **受限**（存在不可观测窗口） | `runs/vp7/handoff-summary.json`；`runs/vp7/real-dsh-real/handoff.json`；`runs/vp7/busy-real-dsh-real/busy-probe.json` | 真实 DSH：`delivered → accepted` **63ms**、`consumed` 72ms；mock：正常 4ms、慢接受 **1855ms**、TTL 500ms 时在第 701ms **误判 expired**（turn 实际仍在跑）；噪声口径 **64ms vs 1400ms**（提前 1336ms 误判接受）；忙时投递真实 DSH 2–3ms 内 `-32602` 失败，mock `-32603`，mock 排队 11.2s | `accepted` 必须由适配器从事件流推导并上报，核心不能等 RPC 返回 | 只认 turn 内事件（排除噪声）；TTL 只用于「重投」不用于「判失败」；忙时投递走退避重试而非判定会话失效 | 真实宿主首帧延迟受模型冷启动影响，长尾未知（mock LLM 掩盖了该分布） |
| **Cursor 稳定性** | **不可判定（阻塞）** | `runs/vp5/cursor-probe.json` | IDE `3.22.12` 已装；`cursor-agent` / `agent` 均未找到；无并发数据 | 不影响阶段一（DSH 单宿主） | 按预案记录阻塞，阶段二首迭代优先回答 | 若 Cursor CLI 的 ACP 稳定性差，阶段二 4 个迭代的排期需重估 |
| **桌面壳可行性** | **可用**（构建归属 CI） | `runs/vp8/build-chain.json`；`runs/vp8/desktop/evidence.json` | Electron 实测：托盘（3 菜单项 + tooltip + bounds）、2 个独立窗口、关闭缩托盘、webview 内 WebSocket 收到 14 条推送并渲染 3 角色/3 连接线；冷启动到渲染 **1.8s**；5 进程 working set **415MB**。Tauri：WebView2 `156.0.4314.58` 已装，但本机缺 Rust + MSVC + Windows SDK → 不能本地编译 | I1.10a 可按「Tauri 主路径 + CI 构建 + Electron 本地开发壳」推进 | `.github/workflows/desktop-build.yml` 提供 Tauri 安装包构建与启动冒烟；Electron 冒烟已可本地/CI 复跑 | Tauri 骨架未经过首次真实编译（API 版本漂移风险）；CI 首次运行前无法声称「已构建成功」 |

### 发现 D1（适配器必须修的真问题）

**HTTP/SSE 上 `session/load` 的回放帧与响应跨通道乱序。**

`session/load` 的响应走 HTTP，回放帧走 SSE。mock 实测：**响应先到、回放帧晚 1–5 ms 到达**。修复前表现为「回放 0 条，且回放帧漏进下一个 turn」，会直接污染证据归属（把上一轮产物记到本轮节点上）。

修复：`AcpClient.resumeOrCreate` 在 `load` 返回后 drain 到事件通道静默（idle 40 ms，上限 400 ms）。修复后 mock `load-only` 场景回放计数 0 → **6**，恢复耗时 97 ms。真实 DSH 的 `resume` 不涉及回放，故不受影响；但阶段三接 WorkBuddy（`load` 追加语义）时这是**必踩点**。

### 发现 D2（交接包状态机必须按「turn 内事件」判定接受）

ACP 的 `session/prompt` 阻塞到 turn 结束才返回，**投递成功 ≠ 目标已接受**。实测三种误判：

| 误判方式 | 场景 | 结果 |
|---|---|---|
| 收到任何帧即算接受 | 会话建好即发噪声帧 `available_commands_update`（真实 DSH 行为） | 噪声在 **65ms** 就被判为接受，而 turn 实际 900ms 后才开始 → **提前 1336ms** |
| 用 TTL 判失败 | 宿主接受延迟 1200ms，TTL 设 500ms | 第 715ms 判 `expired`，但 turn 仍在执行并成功 `end_turn` → **误判** |
| 用 RPC 返回判接受 | 目标忙 | 真实 DSH 立即 `-32602`；mock 排队到 11.2s → 若按 RPC 返回，会认为「投递失败」而不是「已排队」 |

结论：`accepted` 只认 **turn 内事件**（`user_message_chunk` / `agent_thought_chunk` / `agent_message_chunk` / `tool_call` / `tool_call_update` / `plan`），并排除 `usage_update` / `available_commands_update`；TTL 只用于触发**重投**，不能直接判失败。

### 发现 D3（`-32602` 在真实 DSH 上同码双义，直接威胁降级链）

真实 DSH 上同一个错误码 `-32602` 承载两种完全不同的语义：

| 触发 | 响应 |
|---|---|
| 对已 `close` 的会话发请求 | `-32602`（此前已记录，被当作「会话不存在」） |
| 对**正在跑 turn** 的会话再次 `session/prompt` | `-32602` + `a prompt is already in flight for this session`（4 轮复现，2–3ms） |

风险：按既有降级链（`-32602 → 会话失效 → load/new 回退`），**目标忙会被误判成会话没了**，进而新建重复会话、重复执行交接。修正：错误分类必须看 message/语义（或 `session/list` 回读），不能只看 code。

### 发现 D4（桌面壳：运行时可用，但编译链不在本机）

| 项 | 结果 |
|---|---|
| WebView2 运行时 | ✅ `156.0.4314.58`（`C://Program Files (x86)\Microsoft\EdgeWebView\Application`） |
| Rust / cargo | ❌ 均不存在（`~/.cargo` 也没有） |
| MSVC 构建工具 / Windows SDK | ❌ `vswhere.exe` 缺失、`Windows Kits\10\bin` 为空（PATH 里的 `link.exe` 是 Git 自带 POSIX `link`，不是 MSVC 链接器） |
| Electron 运行时 | ✅ 本机实测通过（见 §4.7） |

因此 **Tauri 的构建必须外置到 GitHub Actions**（windows-latest 自带 MSVC 与 Windows SDK），本机只做交互与运行时验证。**注意：CI 首次运行前不能声称「已构建成功」**，本报告的桌面壳结论只覆盖 Electron 实测 + Tauri 骨架静态整理。

---

## 4. 度量明细

### 4.1 VP-1（跨 transport）

| 宿主 | transport | 证据 | 节点状态 | updates | 耗时 |
|---|---|---|---|---|---|
| dsh-real | stdio | 真实 | done | 5 | 2008 ms |
| dsh-http | acp-http-stream | 真实 | done | 5 | 15134 ms（含服务冷启动） |
| mock-stdio | stdio | mock | done | 6 | 217 ms |
| mock-http | http-sse | mock | done | 6 | 143 ms |

- 编排循环 diff = **0**（同一文件，未产生第二份副本）
- 核心哈希跨宿主一致 = **是**（`8ba2bdf0351add00…`）
- 核心纯度违规 = **0**（禁用词：host / transport / stdio / http / sse / 宿主名 / replay / dialect；注释不算违规）
- 5 原语序列 = **四方一致**

### 4.2 VP-2（恢复方言）

| 场景 | 恢复方法 | restored | 回放条数 | 恢复耗时 | 恢复后继续 |
|---|---|---|---|---|---|
| 真实 DSH / stdio | `session/resume` | true | 1（`available_commands_update`，非历史） | 62 ms | ✅ `end_turn` |
| 真实 DSH / HTTP+SSE | `session/resume` | true | 1（同上） | 74 ms | ✅ `end_turn` |
| mock / resume-no-replay | `session/resume` | true | 0 | 0 ms | ✅ |
| mock / load-only | `session/load` + drain | true | **6** | 97 ms | ✅ |
| mock / none | 回退 `session/new` | false | 0 | 2 ms | ✅（新会话，产物 2 份属预期） |

### 4.3 VP-3（隔离）

| 维度 | 真实 DSH | mock |
|---|---|---|
| cwd | 5 会话 5 个不同 cwd，`session/list` 回读一致 | 文件级扫描：0 串台 |
| 工具调用 / 事件归属 | 5 会话各 5 条 update，0 条错投 | 0 串台 |
| permission | 未触发（当前 profile 未走审批） | allow / reject / 越界 optionId 三例全部符合预期 |
| cancel | 目标 `cancelled`，其余 `end_turn`；**延迟 4303 ms（非即时）** | 16–17 ms |
| close | 目标 `-32602`，存活会话正常 | 目标 `-32002`，存活会话正常 |

> cancel 的 4.3 s 来自 mock LLM 的 5 s 阻塞流不可被中断，属**上游流可中断性**问题，不是 ACP 层问题；但它证明「取消 ≠ 立即停止」，阶段一的节点超时必须容忍取消后的迟到 update。

### 4.4 VP-4（证据）

| 字段 | 真实 DSH 来源 | mock 来源 | 判定 |
|---|---|---|---|
| `artifactRef` | missing（无 diff、无 rawOutput） | event-stream（`tool_call_update.content[].type === "diff"`） | 真实宿主不可得 |
| `fingerprint` | missing（协议无此字段） | agent-declared（`rawOutput.sha256`），核心重算一致 ✅ | 需核心自算 |
| `producedAt` | missing（无产物事件） | event-stream（适配器打点 `receivedAt`） | mock 可得 |
| `confirmedBy` | missing | role-convention（final message 机器可读清单） | 需角色约定 |
| `confirmedAt` | missing | role-convention | 需角色约定 |

---

### 4.5 VP-6（会话状态映射）

**离线回放真实帧**（`runs/vp6/state-mapping.json` 的 `A_offlineReal`）：

| 录制 | updates | 噪声帧 | 可达状态 | 出现的 `sessionUpdate` |
|---|---|---|---|---|
| `vp1/dsh-real` | 6 | 3 | idle, thinking | `available_commands_update`×2、`agent_thought_chunk`、`agent_message_chunk`×2、`usage_update` |
| `vp4/dsh-real-real` | 8 | 4 | idle, thinking, tool_running | 再加 `tool_call`×1、`tool_call_update`×2 |
| `vp2-real/dsh-real` | 6 | 3 | idle, thinking | 同第一行 |

> 噪声帧占真实流量的 **50%（3/6）到 50%（4/8）**：`available_commands_update` 在建会话后与 turn 结束后各出现一次，`usage_update` 在 turn 中周期性出现。朴素实现若把它们当进展，会同时污染状态指示器与 `accepted` 判定。

**mock permission 往返**（`runs/vp6/mock-permission/permission-turn.json`，`--permission=ask`）：

```
thinking(prompt-echo) → tool_running(tool-call) → waiting_input(permission-request:edit)
→ thinking(permission-allow-once) → tool_running(tool-in_progress)
→ thinking(tool-completed) → idle(stop-end_turn)
```

7 跳全部闭合，`waiting_input` 的进入与离开都可观测。**真实 DSH**：`permissionSeen=false`，同一路径只到 `thinking`。

| 状态 | 真实 ACP 可得 | mock 可得 | 归属 |
|---|---|---|---|
| `idle` | ✅（会话创建 / turn 结束） | ✅ | 适配器 |
| `thinking` | ✅（`agent_thought_chunk` / `agent_message_chunk`） | ✅ | 适配器 |
| `tool_running` | ✅（`tool_call` / `tool_call_update`） | ✅ | 适配器 |
| `waiting_input` | ❌（未观测到 `request_permission`） | ✅ | 适配器（客户端侧请求） |
| `waiting_dependency` | ❌ 非 ACP 语义 | ❌ | **核心推断**（产物提交后） |
| `escalated` | ❌ 非 ACP 语义 | ❌ | **核心生成** |

### 4.6 VP-7（交接包状态推导）

**mock 场景矩阵**（`runs/vp7/handoff-summary.json`）：

| 场景 | 终态 | 接受窗口 | 总耗时 | 备注 |
|---|---|---|---|---|
| baseline | consumed | 4ms | 112ms | 正常 |
| slow-accept（宿主延迟 1.2s 发首帧） | consumed | **1855ms** | 1964ms | 窗口随宿主延迟线性放大 |
| ttl-false-expire（TTL 500ms） | **expired** | — | 701ms | **误判**：turn 实际仍在执行并最终成功 |
| busy-error（目标忙，报错方言） | consumed | 2ms | 5647ms | 第二个交接 `-32603` 立即失败 |
| busy-queue（目标忙，排队方言） | consumed | 2ms | **11195ms** | 第二个交接「已投递」但 11s 内无任何事件 |
| refusal（permission=deny） | rejected | 2ms | 41ms | `stopReason: refusal` |
| cancelled（中途 cancel） | rejected | 2ms | 169ms | `stopReason: cancelled`（语义上不是「目标拒绝」，见风险 R10） |
| noise-any-event（收到任何帧即接受） | consumed | **64ms** | 1509ms | 被 `available_commands_update` 提前触发 |
| noise-turn-event（只认 turn 内事件） | consumed | **1400ms** | 1493ms | 正确的接受时点 |

**真实 DSH**（`runs/vp7/real-dsh-real/handoff.json` + `runs/vp7/busy-real-dsh-real/busy-probe.json`）：

- `delivered → accepted`（首个 `agent_thought_chunk`）**63ms**，`consumed` 72ms，`stopReason: end_turn`。
- 背靠背双 prompt 4 轮全部复现：第二个 **2–3ms 内失败**，`-32602` / `a prompt is already in flight for this session` —— **不排队**（与 mock 的 `queue` 方言相反）。

### 4.7 VP-8（桌面壳）

**构建链**（`runs/vp8/build-chain.json`）：

| 项 | 结果 |
|---|---|
| WebView2 运行时 | ✅ `156.0.4314.58` |
| Rust / cargo | ❌ not found（无 `~/.cargo`） |
| MSVC / Windows SDK | ❌ `vswhere.exe` 缺失、`Windows Kits\10\bin` 为空 |
| 结论 | `canBuildTauriLocally=false`、`canRunWebviewShellLocally=true` → **构建归属 CI** |

**Electron 运行时冒烟**（`runs/vp8/desktop/evidence.json`，`node spike/desktop-shell/smoke.mjs`）：

| 检查 | 结果 |
|---|---|
| 托盘创建（菜单 3 项 / tooltip / bounds） | ✅ `{created:true, destroyed:false, width:33, height:48}` |
| 多窗口 | ✅ 2 个窗口 id 1/2，均 `alive` |
| 关闭主窗口缩到托盘 | ✅ `closeToTray=true`（窗口未销毁、不可见、应用未退出） |
| webview 内 WebSocket | ✅ 14 条推送 + `graph.snapshot`（3 角色 / 3 连接线，健康度 slow） |
| 渲染结果 | ✅ DOM 6 个节点（3 角色 + 3 连接线） |
| 冷启动到渲染完成 | **1.8s** |
| 常驻内存 | working set **415MB / 5 进程**（Browser 97 / GPU 118 / Utility 51 / 2×Tab 74+75） |

Tauri 侧：骨架（`spike/tauri-shell/`）+ CI（`.github/workflows/desktop-build.yml`）已就位，**尚未经过首次真实编译**。

---

## 5. 阶段一实现路径锁定建议（VR-2）

| 决策点 | 建议 | 依据 |
|---|---|---|
| **transport 实现** | 一份 `ACPTransport` 接口 + 3 个实现（stdio / 同步响应型 HTTP / streamed-response HTTP）。DSH 两种形态都必须支持，因为真实 HTTP 形状与 mock 差异很大（响应走 SSE） | §4.1 |
| **方言处理** | `resumeOrCreate(sessionId?) → {id, cwd, restored}`；回退链 `resume → load → new`；错误码归一表同时认 `-32601 / -32002 / -32602`；`replayMode` 只进日志 | §4.2 |
| **load 时序** | 强制 drain-quiet（idle 40 ms / cap 400 ms）后再返回 | 发现 D1 |
| **mock 去留** | **保留**，定位为「回归套件的确定性夹具」：真实宿主需要凭据/外部进程，CI 里跑不动；mock 负责协议面与错误路径回归，真实宿主负责方言确认 | §2 |
| **证据补充策略** | 证据模型改为：核心按 `artifactRef` 自算 sha256 + 校验存在性/时效；`confirmedBy/At` 由审核角色按角色契约附机器可读清单，缺失即拒绝交接并升级 | §4.4 |
| **会话复用** | 阶段一默认 `fresh`（每节点新会话），`reuse` 待 `resume` 在真实宿主上更充分验证后再开 | §4.2 |
| **Windows 支持** | 内置 `dsh-launcher` 等价逻辑（或推动上游修 `bin` 与 bootstrap），否则开发机跑不通 | §2 |
| **回归套件** | `measure-vp1` + `run-isolation` + `resume-*` + `state-mapping` + `handoff` 五件套参数化到 host 名，作为阶段二/三的准入测试 | 全部脚本已 host 参数化 |
| **会话状态归一化** | 适配器内实现 `SessionStateNormalizer`：只吃 `sessionUpdate` 判别值 + 客户端侧 permission 回调；**噪声帧显式白名单排除**；`waiting_dependency` / `escalated` 由核心调用 `outputSubmitted()` / `escalated()` 显式置位，不从事件猜 | §4.5 |
| **交接接受判定** | `accepted` 只认 turn 内事件（排除 `usage_update` / `available_commands_update`）；适配器向上报 `handoff.accepted` 时附 `ambiguityWindowMs` | §4.6、发现 D2 |
| **交接 TTL 语义** | TTL 到期只触发**重投**（`delivered → pending`），不得直接判 `expired`/失败；连续 N 次重投失败才升级 | §4.6 `ttl-false-expire` |
| **错误分类** | 禁止按 `-32602` 单码判会话失效；DSH 需按 message 区分 `already in flight` 与会话不存在，或 `session/list` 回读确认 | 发现 D3 |
| **桌面壳选型** | 主路径 Tauri（CI 构建 Windows 安装包），本地开发用 Electron 壳验证交互；I1.10a 首次提交必须先跑通 CI 构建再锁定 | §4.7、发现 D4 |

---

## 6. 风险与未决项（VR-3）

| # | 风险 / 未决项 | 触发条件 | 影响 | 处置 |
|---|---|---|---|---|
| R1 | WorkBuddy `load` 追加语义未验证 | 无 sidecar 环境 | 阶段三接 WorkBuddy 时可能出现「回放重复注入」 | Phase 3 首项验证；drain-quiet + 去重按 `messageId` |
| R2 | Cursor ACP 稳定性未知 | 无 `cursor-agent` CLI | 阶段二排期风险 | 阶段二 I2.1 前置补齐；不可用则降级为「仅 DSH 单宿主交付」 |
| R3 | 真实 DSH 的 `bash` 工具 `UNKNOWN_TOOL` | `tool-bash` 已挂载但会话不可见 | 真实文件级隔离与工具类证据无法取证 | I1.1 前定论工具可见性；否则隔离回归退回 mock + 文件系统直读 |
| R4 | cancel 非即时 | 上游流不可中断 | 节点超时误判、回流计数错乱 | 超时与取消分离计时；取消后设 quarantine 窗口 |
| R5 | 模型凭据缺失 | 无 `DEEPSEEK_API_KEY` | 真实推理/长任务/证据节点无法验证 | 阶段一开工前提供凭据；在此之前用 mock LLM 做链路回归 |
| R6 | 上游包 Windows 缺陷 | `dsh-acp-server` 升级 | 升级可能再次打断启动 | 向上游提 issue；shim 保留并加版本断言 |
| R7 | 证据真实性 | 角色不遵守约定 | 假交付 | 审核角色独立 + 证据缺失即升级（不可放行） |
| R8 | `-32602` 同码双义 | 对忙会话投递交接 | 把「目标忙」误判成「会话失效」→ 新建重复会话、交接重复执行 | 错误分类按 message + `session/list` 回读；忙时走退避重试 |
| R9 | `accepted` 不可观测窗口 | 宿主首帧延迟大（模型冷启动） | 交接长时间停在 `delivered`；若用 TTL 判失败会误杀正在执行的节点 | 只认 turn 内事件；TTL 仅触发重投；上报 `ambiguityWindowMs` 供面板显示 |
| R10 | `cancelled` 被归为 `rejected` | 上游主动撤销 vs 目标拒绝 | 连接线显示「拒绝」，但语义其实是「撤回」 | 交接增加 `cancelled` 子原因（不改 7 状态），聚合时与 `rejected` 区分文案 |
| R11 | 噪声帧误判 | 宿主发 `available_commands_update` / `usage_update` | 接受时点提前（实测 1.3s）、状态指示器抖动 | 归一化器白名单排除噪声；回归用例固定覆盖 |
| R12 | Tauri 骨架未经真实编译 | 首次 CI 运行 | API 版本漂移导致构建失败 | I1.10a 第一件事是跑通 CI；失败则回退 Electron（已实测可用） |

---

## 7. 未做项（明确不在本迭代）

- 产品级桌面 UI：角色流程图、看板、下钻、通知、人工干预队列（I1.10a / I1.10b / I1.11）
- 工作流引擎、角色与技能注册表（I1.2 / I1.5 / I1.6）
- 事件日志链式哈希、健康度计算、预算配额（I1.9 / I1.12）
- WorkBuddy sidecar 真实接入（阶段三）、Codex（阶段三）
- 多宿主混跑（I2.3）

VR-5 迭代评审（~1d）与复盘（~0.5d）待人工排期；复盘需回答：单人执行下 VP-5 是否继续排队、真实凭据何时到位。
