# Maestro 项目长期记忆

## 项目
多会话编排控制台（DSH / Cursor / WorkBuddy 三种 ACP 宿主）。需求基线与迭代规划在 `docs/index.md`；
每个迭代的**任务拆分**写 `docs/iterations/iteration-N.md`，**执行结果**写 `docs/iterations/iteration-N/report.md`。

## 工作方式约定
- **spike 验证代码不进产品工程**：迭代收口时删除验证代码，只保留 report / capability-matrix / evidence-samples。
  删除前先做保护性提交（快照可 `git show <commit>:<path>` 取回）。
- 删代码时必须同步：给文档加「处置声明」，把仍有价值的方案/契约移到附录，避免正文路径指针悬空。
- 报告结论一律带**证据分级**：已实测（真实宿主）/ mock 实测 / 阻塞，并附可复核的原始帧。
- 迭代开始前先确认需求模板（用户会提供统一模板），不要自行发明结构。

## 本机环境硬事实（Windows）
- DSH：`%LOCALAPPDATA%\Programs\DeepSeek Harness`，CLI `dsh.cmd` 实为 Electron 跑 `app.asar/cli.js`；**PATH 里没有 dsh**。
- ACP 需装 `dsh-acp-server`（`0.14.4`）。两个包级缺陷：bin 用 `import(join(...))` 触发 `ERR_UNSUPPORTED_ESM_URL_SCHEME`（需 `pathToFileURL`）；bootstrap 用 `spawnSync('dsh')` 解析不了 `.cmd`。
- 无模型凭据时：在**隔离 DSH_HOME** 的 `profiles/acp/cordis.patch.yml` 注入 `dsh-acp-server/test/mock-llm` 并把 `agent-default-model` 指到 mock。**不要碰用户 `~/.dsh`**。
- Cursor 只装了 IDE，**没有 `cursor-agent` CLI**（`agent acp` 不可用）。
- 无 Rust / MSVC / Windows SDK → Tauri 只能 CI 构建；WebView2 运行时可用。Electron 二进制必须走 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。
- 环境变量 `ELECTRON_RUN_AS_NODE=1` 可能常驻，跑 Electron 前要删。

## 阶段零已锁定的实现约束（阶段一必守）
1. `load` 后必须 drain-quiet（idle 40ms / cap 400ms），否则 HTTP/SSE 回放帧漏进下一 turn。
2. 核心**不得**依赖宿主上报产物指纹；`tool_call_update` 无 diff/指纹，指纹由核心自算。
3. 错误码 `-32602` 在 DSH 上**同码双义**（会话不存在 / prompt 在飞行），禁止只按 code 判会话失效。
4. `accepted` 只认 turn 内事件，排除 `usage_update` / `available_commands_update` 噪声帧；TTL 只触发重投，不判失败。
5. cancel 非即时（实测 4.3s），节点超时必须容忍取消后的迟到 update。
6. 6 个会话状态里只有 3 个（idle/thinking/tool_running）由 ACP 直接可得；`waiting_dependency`/`escalated` 由核心显式置位。
