# Maestro 项目长期记忆

## 项目与工作方式
- 多会话编排控制台（DSH / Cursor / WorkBuddy 三种 ACP 宿主）。需求基线 `docs/index.md`；任务拆分 `docs/iterations/iteration-N.md`；执行结果 `docs/iterations/iteration-N/report.md`。
- 按 `docs/templates/execution-template.md` 走 S0~S4：拆包实现 → 逐 AC 取证 → 独立终验 → 报告收口。结论必须带证据分级（真实宿主 / mock 实测 / 阻塞）和原始帧。
- spike 验证代码不进产品：收口前做保护性提交，删码时给文档加「处置声明」，有价值方案移到附录避免路径悬空。
- 一次派 3 个大 Agent 会触发平台 429；分批 1~2 个，要求 Agent 分批落盘防中断丢成果。
- 三主链逐字回归口径：`git worktree` 基线 + 交替 ≥6 对 + A-0 归一化 diff，判「当前不得低于基线」。门禁按失败集合差集 = 0；新增红先 `--test-concurrency=1` 独占复跑证伪 flake。

## 本机硬事实（Windows）
- DSH 在 `%LOCALAPPDATA%\Programs\DeepSeek Harness`（实测 0.2.2-rc.1），没有 `dsh.cmd`；CLI 入口 `ELECTRON_RUN_AS_NODE=1 "<dir>/DeepSeek Harness.exe" "<dir>/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"`。
- ACP 分帧是 NDJSON（按 `\n` 切行），不是 LSP `Content-Length`。内置 acp app 直连即可，无需第三方 `dsh-acp-server`；内置广告 `sessionCapabilities={close,list,resume}`，无 `load`。
- `tool-bash` 在 Windows 条件禁用（无 bash），`tool-fs` 挂 read/write/edit/read_image；夹具禁硬编码 `bash`，落盘用 `write(file_path, content)`。
- `~/.dsh/.credentials.yaml` 含可用账号令牌（`deepseek-account` / `deepseek-flash`）：隔离 DSH_HOME 复制它并把 `agent-default-model`、`acp` 两行 provider 改成 account，用完删；不要碰用户 `~/.dsh`。无凭据时用隔离 patch 注入 `dsh-acp-server/test/mock-llm`。
- 真实宿主写 cwd 内文件不触发 `session/request_permission`，审批等待只能夹具造；Cursor 只有 IDE，没有 `cursor-agent` CLI。
- 无 Rust/MSVC/Windows SDK → Tauri 只能 CI 构建；Electron 走 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`；跑 Electron 前删除常驻的 `ELECTRON_RUN_AS_NODE=1`。
- GitHub：`https_proxy` 隧道对 github.com 间歇 502；可绕过代理 `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY git -c http.proxy= push`，或用 `git credential fill` 取 PAT 走直连 `api.github.com` REST 核对/删 ref（删后 GET 可能缓存 200，须列全量复核）。
- `core.autocrlf=true` 下 `git restore` 会假报 M：按具体路径 `git -c core.autocrlf=false checkout-index -f -- <path>`，禁全量 `-a -f`。合入前重新 fetch，`origin/main` 为权威；分叉时备份 WIP 再 reset，记忆日志按标题级并集合并。

## 跨迭代必守实现约束
- 核心独立进程 + 命名管道，管道名 `sha256(realpath(root).toLowerCase()).slice(0,16)`；`--project`/管道按项目根而非 shell cwd 算。验收根放 `%TEMP%`，勿放仓库（DSH 权限修复会让 turn 从 5s 膨胀到 24.8s）。
- 状态迁移唯一入口 `orchestrator.transit()`：以磁盘最新快照为 from 做 CAS `{state,halted,rev}`，rev 基于磁盘现值无条件递增；`halted` 独立一次 save；事件先落盘再广播。
- `load` 后 drain-quiet（idle 40ms / cap 400ms）；`-32602` 同码双义（会话不存在 / prompt 在飞）；`accepted` 排除 `usage_update` 等噪声；cancel 非即时（4.3s），容忍迟到 update；`stopReason` 不判成败。
- 指纹由核心自算，`artifactRef` 只从 `tool_call.rawInput.file_path` 提取；判定只认 `verdict`（严格 pass/fail）。忙检查放在写锁之前：`single` 用 `NODE_BUSY`，`code-loop` 用 `INSTANCE_RUNNING`。
- 图/角色字面量只在 `src/templates/**`；`src/core,src/daemon` 用 `purity-check.mjs --forbid` 传全词表扫，注释也算。
- 提示词真正产出点是 `advance.js` 的 `planAdvance`（`plan.promptText`）；事件 `ts` 复用状态变更同一时刻；`task-loop` 与 `code-loop` 事件行分流（AC-36 逐字红线）；同目录并发要在 `@dir` 锁之前做占用快检。
- 健康度只在 `getStatus` 读取时算，`saveState` 只透传；追踪号落 `state.traceId`；`trace show` 走只读 `instance.trace`，空态看跨度非空，失败摘要行仅四项至少一非 null 时渲染。
- 发布走 GitHub Actions（tag `v*` + dispatch，三平台矩阵 + SHA256SUMS，仅 `contents: write`、只用 github.token）；证据原始帧不得 strip；门禁 HEAD 必须可达（产物放紧随其后的提交，禁 amend）；`makensis` 预装但不在 PATH；Windows 路径剥 `\\?\` 前缀。

## 迭代状态
- I1.1 / I1.2 / I1.3 / I1.9 / I1.10a 与 I1.8 S2 第 1 批均已收口，逐项数字见各自 `docs/iterations/iteration-N/report.md`。I1.8 功能分支已按用户指令删除，后续批次从最新 main 重开。
- **I1.11 已 Done**：49/49 AC 通过、0 不通过/0 阻塞、1606 测试（4 条允许失败，差集 0）、588 证据、三主链 diff 0、终验 PASS。分支 `feat/i1.11-notify-queue-assets`，末提交 `d766aa9` 已推送，工作区干净。
- I1.11 无逐 AC 真实宿主面（全 mock 实测，U-13 降级非阻塞）；壳层真探针需 `npm run desktop:build` 后不再 SKIP；若提供 `cursor-agent` CLI 可补 ACP 真实宿主取证。
- `npm test` 不可用（Node 22 `node --test test/` 报 MODULE_NOT_FOUND）；用 `node --test "test/**/*.test.js"`。
