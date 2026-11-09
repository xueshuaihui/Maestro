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
- DSH：`%LOCALAPPDATA%\Programs\DeepSeek Harness`（`0.2.1-rc.5`；**2026-11-06 实测已升到 `0.2.2-rc.1`**）。**没有 `dsh.cmd`**；CLI 入口是
  `ELECTRON_RUN_AS_NODE=1 "<安装目录>/DeepSeek Harness.exe" "<安装目录>/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"`，
  支持 `--profile acp --dump-config` / `headless "<task>"`。
- **工具行是平台条件挂载**：`tool-bash` 带 `disabled: process.platform === 'win32'`（Windows 上不存在 `bash`，由另一个 shell 工具顶替）；
  `tool-fs` 无条件挂载，注册 `read` / `write` / `edit` / `read_image`。**任何夹具/脚本禁止硬编码 `bash`**，落盘用 `write`（参数 `file_path` + `content`）。
- `acp` profile 模板自带 ACP server（`@deepseek-ai/dsh-acp-app`）；第三方 `dsh-acp-server` 需用其 patch 把内置行 `disabled` 才独占 stdio。
  内置 server 广告 `sessionCapabilities={close,list,resume}`（**没有 load**）；第三方 `0.14.4` 有 `loadSession:true`。
- **模型凭据可用**：`~/.dsh/.credentials.yaml` 里是账号令牌（`deepseek-account` 路由，`deepseek-flash`）。隔离 DSH_HOME 验会话时复制该文件（用完删），并在 profile patch 里把 `agent-default-model` 与 `acp` 两行 provider 改成 `deepseek-account`。
- 真实宿主写 cwd 内文件**不触发** `session/request_permission`；「等待审批」只能靠夹具。
- **不需要**装第三方 `dsh-acp-server`：内置 acp app 直连即可（I1.1 已实证，省掉 shim）。该包两个缺陷（`ERR_UNSUPPORTED_ESM_URL_SCHEME`、`spawnSync('dsh')`）仅作历史记录。
- **ACP 分帧是 NDJSON（按 `\n` 切行），不是 LSP 的 `Content-Length` 头**。按后者写解析器会一行都读不到（I1.1 探针实测纠正）。
- 无模型凭据时：在**隔离 DSH_HOME** 的 `profiles/acp/cordis.patch.yml` 注入 `dsh-acp-server/test/mock-llm` 并把 `agent-default-model` 指到 mock。**不要碰用户 `~/.dsh`**。
- Cursor 只装了 IDE，**没有 `cursor-agent` CLI**（`agent acp` 不可用）。
- 无 Rust / MSVC / Windows SDK → Tauri 只能 CI 构建；WebView2 运行时可用。Electron 二进制必须走 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。
- 环境变量 `ELECTRON_RUN_AS_NODE=1` 可能常驻，跑 Electron 前要删。
- **GitHub 网络备用通道**：`https_proxy=http://127.0.0.1:<port>` 对 `github.com` 的 CONNECT 隧道会间歇 502，且端口随 WorkBuddy 重启变化、环境变量可能指向已失效端口；`api.github.com` 直连（`curl --noproxy '*'`）稳定 HTTP 200。用 `git credential fill`（helper=`manager`）取 PAT，走 REST `GET/DELETE /repos/<owner>/<repo>/git/refs/heads/<branch>` 可核对/删除远端 ref（DELETE 返回 204），无需等隧道恢复；纯 git 操作仍需 `github.com` 隧道恢复后补 `git fetch --all --prune`。

## 阶段零已锁定的实现约束（阶段一必守）
1. `load` 后必须 drain-quiet（idle 40ms / cap 400ms），否则 HTTP/SSE 回放帧漏进下一 turn。
2. 核心**不得**依赖宿主上报产物指纹；`tool_call_update` 无 diff/指纹，指纹由核心自算。
   `artifactRef` 只能从 `tool_call.rawInput.file_path`（write/edit 类工具）按工具类型提取。
3. 错误码 `-32602` 在 DSH 上**同码双义**（会话不存在 / prompt 在飞行），禁止只按 code 判会话失效。
4. `accepted` 只认 turn 内事件，排除 `usage_update` / `available_commands_update` 噪声帧；TTL 只触发重投，不判失败。
5. cancel 非即时（实测 4.3s），节点超时必须容忍取消后的迟到 update。
6. 6 个会话状态里只有 3 个（idle/thinking/tool_running）由 ACP 直接可得；`waiting_dependency`/`escalated` 由核心显式置位。

## 阶段一 I1.1 已落地（产品代码 `src/**` + `bin/orch.js`，216 用例，26/26 AC 通过）
- **架构**：核心是独立进程，CLI 经 Windows 命名管道通信；管道名 = `sha256(realpath(root).toLowerCase()).slice(0,16)`
  → **同一项目根才共用一个核心**（AC-07 并发用例必须同 cwd 执行，只用 `--cwd` 改任务目录）。
- **`--project` / 管道按项目根算，不按 shell cwd 算**；`orch run` 的 `--cwd` 只决定任务工作目录。
- **验收项目根绝不要放仓库目录**：DSH 会触发 pwsh 权限修复，turn 从 5s 膨胀到 24.8s。一律用 `%TEMP%` 下目录。
- **`stopReason` 不判成败**：`blocked`/`error` 都被宿主映射成 `end_turn`，成败只由产出核对裁决。
- **状态迁移唯一入口是 `orchestrator.transit()`**：以磁盘最新快照为 `from` 重新校验 + `save(expectedState)` 做 CAS，
  禁止任何地方直接 `store.save` 改状态（否则终态可被内存副本静默覆盖）。
- **事件先落盘再广播**；`emit` 失败不得改内存状态（S-4/S-11 仍未完全闭合，多节点前必修）。
- **审批策略 `permissionPolicy: allow|reject|hold`（env `MAESTRO_PERMISSION_POLICY`）**，是 I1.11 人工队列的占位；
  真实 DSH 写 cwd 内文件不触发审批，AC-17/18 只能走夹具。
- **夹具与产品同一条链路**：`.orch/hosts/dsh.json` 的 `launch.command/args` 指向 `mock-acp-agent.js` 即接管宿主。
- `npm test` 不可用（Node 22 `node --test test/` 报 MODULE_NOT_FOUND）；用 `node --test "test/**/*.test.js"`。

## 阶段一 I1.2 已收口（2026-11-05：44/44 AC、337/337 用例）
- 需求 `docs/iterations/iteration-2/requirement.md` **v16**；成果在 `iteration-2/{report,acceptance-product,acceptance-fixture,review-round2}.md` + `evidence/`（233 个文件）。7 个工作包见 `iteration-2.md` §4。
- **I1.3+ 必守的新增约束**：
  1. CAS 形状 `{state,halted,rev}`；**`rev` 无条件基于磁盘现值递增**（进程重启不回 1），否则 CAS 误判。
  2. 图/角色字面量只能在 `src/templates/**`；`src/core,src/daemon` 四词零命中（AC-28，用 `test/fixtures/purity-check.mjs` 扫，注释也算）。
  3. `halted` 必须**独立一次 `saveState`**，不与升级条目合并。
  4. **忙检查放在写锁之前**：mock 在 `session/new` 前 hold 会让 `advance`/`startRun` 长期持锁 → 写类 IPC 排队超时、读类 `status` 正常。`single` 保持 I1.1 `NODE_BUSY`，`code-loop` 用 `INSTANCE_RUNNING`。
  5. 判定体只认 `verdict` 字段（严格 `pass`/`fail`），**不认 `result` 别名**；六类失败见 `src/core/verdict.js`。
- **默认图 `single` 是红线**：任何改动后输出必须逐字保持 I1.1（AC-21 真实面实测）。
- 验收可重跑：`probe/acc2-f-{b1..b4,final}.mjs` 分 4 批落 `evidence/`，`final` 从 `results.jsonl`+`parts/` 重建报告；修完只重跑受影响批次。
- 真实 DSH 面 AC-45 一次跑通（`21<87<93`，5m26s）；隔离环境 `%TEMP%/maestro-acc-p2/`。
- **一次派 3 个大 Agent 会触发平台 429**；分批（1~2 个）更稳，且要求 Agent 分批落盘证据防中断丢成果。

## 阶段一 I1.3 已收口（2026-11-06：45/45 AC、651 条核对项、418/418 用例）
需求 v5 / 拆分 `iteration-3.md`；提交 `fbc7e62` WP-1 → `05d14b0` WP-5 → `2e2f506` WP-2 →
`9e9482c` WP-3 → `f4d4a76` WP-4 → `baba11f` WP-6。验收已完成，见下节。
- **I1.4+ 必守**：
  1. `reviewReason='evidence'` 必须在 `transit()` **之前**赋值，否则首帧看不到「核对证据」。
  2. 门控 `review(downstream)→done` 必须与 `handoff accepted` **同一次 `saveState`**（rev 只 +1），
     且**不得走 `transit()`**，手工 emit `result='applied'`。
  3. `delivered` 是短暂态、不保证单独落盘；断言不能要求它出现在中间态。
  4. 首派失败时 `run.start` 早返回须带 `instanceId` + 终局快照，CLI 才能按 A-3 收尾（退出码 4）。
  5. `src/core`/`src/daemon` 的 7 词扫描（`task-loop,researcher,writer,reviewer,研究员,撰写者,审核者`）
     用 `purity-check.mjs --forbid` 传全表；**英文注释也会命中**。
  6. 串行连跑夹具场景 >10 个会累计资源耗尽（`session/new` 全失败），分批跑。
  7. 脚本化测试工厂禁止在 `prompt()` 里同步触发首个 update 帧。


## 阶段一 I1.3 验收结论（2026-11-06 收口）
- **45 条 AC 全通过 / 651 条核对项 / 284 份证据**；真实面 1 条（AC-40）+ 夹具面 44 条。
  产物 `iteration-3/{report,acceptance-fixture,acceptance-product}.md` + `probe/acc3-*`。
- **验收脚手架（I1.4 直接复用）**：`node probe/acc3-f-run.mjs AC-xx | --batch a~e`（e=AC-40 证据机检），
  `node probe/acc3-f-final.mjs` 重建报告。新增用例 `cp probe/acc3-cases/_template.mjs acNN.mjs`。
- **验收期 6 个缺陷（I1.4 别重犯）**：
  1. **提示词真正产出点是 `advance.js` 的 `planAdvance`**（经 `plan.promptText`），不是 orchestrator 兜底分支。
  2. **事件 `ts` 必须复用状态变更同一时刻**（`startedAt`/`endedAt` 各自 `iso()` 会差 4~8ms）；
     `event-bus.emit()` 已支持可选 `ts`。
  3. **`task-loop` 事件行渲染必须与 `code-loop` 分流**（note 行用中文原因词、不追加「原因」段），
     改公共分支会踩 AC-36 逐字红线。
  4. **同目录并发要在 `@dir` 锁之前做占用快检**（复用 `findDirBusy` 口径），否则等 60s 报「未知错误：IPC_TIMEOUT」。
  5. 验收脚本禁止硬编码测试条数（用 `fail=0 && pass===tests && tests>=基线`）。
  6. `driver --keep` 被强杀进程码可能是 13（非产品码）；`core stop` 会把非终态实例对账成 `interrupted`，
     中间态要 `state.live` 抢落盘。
- **真实面关键前提**：审核提示词必须给**绝对路径**（相对 `out/review.json` + 「工作区」绝对路径会让
  真实模型写进实例工作区，3 次里 2 次挂起）。修复后 313.6s 一次跑通、零人工干预。

## I1.8 实例恢复（进行中，2026-11-10）
- 分支 `feat/i1.8-instance-recovery`，基线 `3f35bfa`（集成版 main，**不含 I1.7**）。S0 `760b8a1` / S1 `ae89f27` /
  S2 第 1 批 `41829e0`（WP-1 checkpoint + WP-2 ACP 恢复方言，25/25 用例）。需求 v3：67 AC / 54 BR / 7 WP。
- **禁止用 I1.5 存量 `0cd113b` 基线判集成版三主链回归**：AC-49 必红（4 条差异来自 I1.4 共享工作区提示词
  与 task-loop 状态行顺序，即 O-I2），非回归。门禁 ④ 必须挂 `d4b0f94` 重建逐字基线，S2 收口前补证。
- **已 PASS 的验收证据不得被门禁重跑覆盖**：若 `iteration-6/evidence/AC-49.*` 与
  `probe/acc6-f-results.jsonl` 被改成「不通过」，恢复 HEAD，原始帧另存本迭代 `evidence/gate-batch1/`。
- `core.autocrlf=true` 下 `git restore` 后 status 会假报 M（内容 diff 已空）；用
  `git -c core.autocrlf=false checkout-index -f -- <具体路径>` 刷新，**不可全量 `-a -f`**（会覆盖未提交改动）。
