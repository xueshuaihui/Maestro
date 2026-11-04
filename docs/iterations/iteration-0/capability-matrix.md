# 宿主能力矩阵（草稿 · I0.1 产出）

> 依据：`docs/iterations/iteration-0.md` §3 VP-1/VP-2/VP-5、§4 交付物清单。
> 状态口径：**已实测 = 真实宿主**；**mock 实测 = 自家 mock agent，只证明抽象成立**；**未验证 = 缺环境或未做**。
> 更新规则：每个新宿主接入后必须填「环境指纹」行，否则结论不可复现。

## 0. 环境指纹

| 宿主 | 版本 | 启动方式 | 探测时间 | 证据 |
|---|---|---|---|---|
| **DSH（stdio）** | dsh CLI `0.2.1-rc.5` + `dsh-acp-server` `0.14.4` | `dsh-acp-server`（默认 stdio）；Windows 上需 `spike/dsh-launcher/dsh-acp-launcher.mjs` 绕行 | 2026-11-03 | `runs/env1/dsh/probe.json` |
| **DSH（HTTP+SSE）** | 同上 | `dsh-acp-server serve --port 7801` | 2026-11-03 | `runs/env2/dsh-http/probe.json` |
| **WorkBuddy（HTTP+SSE）** | 未接入 | sidecar 控制管道 | — | 未验证（Phase 3） |
| **Cursor（stdio）** | IDE `3.22.12`，**CLI 缺失** | `cursor-agent acp`（未安装） | 2026-11-03 | `runs/vp5/cursor-probe.json` |
| **mock agent** | 自建 `0.1.0` | `spike/mock-acp-server/*` | 2026-11-03 | `runs/vp1/*`、`runs/vp3/*` |

注：`dsh-acp-server` 的 `agentInfo.version` 报 `0.14.4`（插件自身版本，不是 dsh 内核版本）。DSH 内核版本需另取（`dsh --version` = `0.2.1-rc.5`）。

**关键环境事实（Windows）**

1. `dsh-acp-server@0.14.4` 的 `bin/dsh-acp.mjs` 用 `import(join(...))` 加载本地模块 → Node 22 抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'd:'`。绕行：`spike/dsh-launcher`（改用 `pathToFileURL`）。
2. 其 bootstrap 用 `spawnSync('dsh', ...)`，Windows 无法解析 `.cmd` → 首次启动必然失败。绕行：手动执行一次 `dsh plugin --profile acp add <pkg>`。
3. `dsh` 在 Windows 是 `dsh.cmd`，实际用 Electron 以 node 模式跑 `app.asar` 内的 `cli.js`；纯 Node 既不能 spawn `.cmd` 也不能读 asar 路径。
4. 真实模型凭据缺失（`no API key for provider route "deepseek-official"`）。为让会话层可验证，在**隔离的 DSH_HOME**（`.orch-spike/dsh-home`）里把默认模型切到包内确定性 mock LLM（`dsh-acp-server/test/mock-llm`，官方 e2e 同款），**未触碰用户 `~/.dsh`**。因此本文「已实测」= ACP/DSH 会话层真实，**不代表真实模型推理质量**。

## 1. 能力矩阵

| 能力 | DSH | WorkBuddy | Cursor | 说明 / 证据 |
|---|---|---|---|---|
| `initialize` | ✅ 已实测 | ⚪ 未验证 | ⚪ 未验证 | `runs/env1/dsh/probe.json` |
| `session/new`（多会话） | ✅ 已实测（5 并发） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp3-real/*` |
| `session/prompt`（流式 update） | ✅ 已实测 | ⚪ 未验证 | ⚪ 未验证 | `runs/vp1/dsh-real/result.json` |
| `session/cancel` | ✅ 已实测（非即时，见下） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp3-real/*/report.json` B |
| `session/close` | ✅ 已实测 | ⚪ 未验证 | ⚪ 未验证 | 同上 C |
| `session/list` | ✅ 已实测（返回 `cwd`） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp3-real/*` A |
| `session/resume`（不回放） | ✅ 已实测 | ❓ 预期不支持 | ⚪ 未验证 | `runs/vp2-real/dsh-real` |
| `session/load`（回放） | ✅ 能力已广告（`loadSession:true`），回放语义未单独实测 | ❓ 预期支持（追加） | ⚪ 未验证 | 见报告 §VP-2 |
| `session/request_permission` | ⚪ 未观测到（当前 profile 下未触发；`acp` profile 不发起审批） | ⚪ 未验证 | ⚪ 未验证 | mock 已覆盖完整往返（VP-6） |
| 会话状态归一化（6 状态） | ⚠️ 3/6 可从事件直接得出（`idle`/`thinking`/`tool_running`） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp6/state-mapping.json` |
| `waiting_input`（审批等待） | ❌ 未观测到 `request_permission` | ⚪ 未验证 | ⚪ 未验证 | 同上 |
| `waiting_dependency` / `escalated` | ➖ 非 ACP 语义（核心侧推断/生成） | ➖ | ➖ | 同上 |
| 移交接受信号（`accepted` 可观测性） | ✅ 有 turn 内首帧（实测 63ms） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp7/real-dsh-real/handoff.json` |
| 忙时会话再投递 | ❌ 立即失败 `-32602` + `a prompt is already in flight for this session`（2–3ms） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp7/busy-real-dsh-real/busy-probe.json` |
| 工具调用（`tool_call`/`tool_call_update`） | ✅ 已实测（但 `bash` 工具未挂载 → `UNKNOWN_TOOL`） | ⚪ 未验证 | ⚪ 未验证 | `evidence-samples/real-dsh-tool-call.json` |
| 产物 diff（`type:"diff"`） | ❌ 未观测到 | ⚪ 未验证 | ⚪ 未验证 | 同上 |
| 产物指纹（`rawOutput.sha256` 等） | ❌ 协议无此字段 | ⚪ 未验证 | ⚪ 未验证 | 报告 §VP-4 |
| 单连接多会话复用 | ✅ 已实测（5 会话 0 串台） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp3-real/*` A |
| transport 双形态（stdio / HTTP+SSE） | ✅ 已实测（同一 DSH，两种 transport） | ⚪ 未验证 | ⚪ 未验证 | `runs/vp1/summary.json` |
| Windows 原生可启动 | ⚠️ 需 shim | — | — | 见环境事实 1–3 |

## 2. 方言差异登记

| 项 | mock（stdio） | mock（HTTP/SSE） | DSH（stdio） | DSH（HTTP+SSE） |
|---|---|---|---|---|
| 请求响应通道 | stdio 帧 | POST 响应体 | stdio 帧 | **SSE**（POST 只回 202） |
| 连接亲和 | 不需要 | `x-acp-conn` | 不需要 | **`acp-connection-id`** |
| 会话恢复 | `resume` 不回放 / `load` 回放 | `load` 回放 | `resume` 不回放（实测回放 1 条 `available_commands_update`） | 同 stdio |
| 回放帧时序 | 同通道有序 | **与响应跨通道乱序**（实测） | — | 需实测（能力已广告） |
| cancel 语义 | 立即中断（10ms 级） | 立即中断 | 生效但**非即时**（实测 4.3s，取决于上游流是否可中断） | 未测 |
| 错误码 | `-32002` 未知会话 / `-32601` 方法不支持 / `-32603` 会话忙 | 同 | `-32602` 未知会话（非 ACP 习惯码）**且** `-32602` 会话忙（同码双义） | 同 |
| 会话级噪声帧 | 无（默认） | 无 | 有：`available_commands_update`（建会话后、turn 结束后）、`usage_update` | 有 |
| prompt 时会话忙 | `-32603`（或 `--busy-policy=queue` 排队） | 同 | 立即 `-32602`（不排队） | 未测 |

## 3. 桌面壳能力（VP-8）

| 能力 | Electron（本机实测） | Tauri（本机构建链缺失） | 说明 |
|---|---|---|---|
| 系统托盘（图标/菜单/tooltip/点击） | ✅ | 骨架已写（`tray-icon` feature + config 声明） | Electron 实测 `menuItems=3`、`bounds` 正常 |
| 关闭窗口缩到托盘 | ✅ | 未验（`WindowEvent::CloseRequested` 需在首次 CI 构建确认） | Electron 实测 `closeToTray=true` |
| 多窗口 | ✅ 2 个独立窗口 + 独立渲染进程 | 配置声明 2 窗口 | Electron 实测 5 个进程（Browser/GPU/Utility/2×Tab） |
| webview 内 WebSocket 客户端 | ✅ 直连 daemon，14 条推送 + 快照 | 同一份前端代码，无需插件 | 快照 3 角色 / 3 连接线渲染成功 |
| 构建归属 | 本机 `npm install` 即可 | **必须 CI**（缺 Rust + MSVC + Windows SDK） | `.github/workflows/desktop-build.yml` |
| WebView2 运行时 | — | ✅ `156.0.4314.58` 已装 | Tauri 运行时前提满足 |

启动耗时 1.8s（冷启动到渲染完成），常驻内存 working set 约 415MB / 5 进程 —— 作为 I1.10a 选型基线。

## 4. 对阶段一的直接约束

1. **适配器必须实现 `load` 后的 drain-quiet**，否则 HTTP/SSE 上回放帧会漏进下一个 turn。
2. **核心不得依赖宿主上报产物指纹**；指纹由核心按 `artifactRef` 自行计算（真实 DSH 实测无 diff/rawOutput）。
3. **错误码需归一**：DSH 用 `-32602` 表示未知会话，与 mock/ACP 习惯的 `-32002` 不同，降级链必须同时识别两者。
4. **cancel 不等于即时终止**：节点超时与「cancel 后仍可能收到 update」必须分开设计。
5. **Windows 上 DSH 需内置 shim**，否则阶段一在 Windows 开发机上无法跑通。
6. **acp profile 的工具集需显式确认**：`tool-bash` 已挂载但运行时报 `UNKNOWN_TOOL`，说明「配置里有」≠「会话可见」，需在 I1.1 前定论。
7. **`-32602` 是双义词**：既是「会话不存在/已关闭」，也是「该会话已有 prompt 在飞行」。**禁止只按错误码判定会话失效**——必须结合 `session/list` 回读或错误消息分类，否则会把「目标忙」误判成「会话没了」并新建重复会话。
8. **`accepted` 只能靠事件流观测**：`session/prompt` 阻塞到 turn 结束才返回，投递成功 ≠ 已接受。适配器必须把「首条 turn 内事件」上报为核心可用的接受信号，并显式携带不可观测窗口。
9. **必须排除会话级噪声帧**：`available_commands_update` / `usage_update` 不代表 turn 进展；用「收到任何帧就算接受」会把接受时点提前（实测提前 840ms）。
10. **桌面壳构建走 CI**：本机无 Rust/MSVC/SDK，Tauri 只能在 GitHub Actions 构建；本地开发用 Electron 壳验证交互。
