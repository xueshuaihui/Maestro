# Maestro 项目长期记忆

## 项目与工作方式
多会话编排控制台（DSH / Cursor / WorkBuddy 三种 ACP 宿主）。需求基线与迭代规划 `docs/index.md`
（第一部分=基线，第二部分=`#### I1.<N>` 规划）；流程标准 `docs/templates/execution-template.md`，
需求模板 `docs/templates/requirement-template.md`。产物：`docs/iterations/iteration-N/requirement.md`
→ `iteration-N.md`（拆分）→ `iteration-N/{report,acceptance-*,final-verification}.md` + `evidence/`。
- 五阶段 S0~S4，主控只调度/复核/裁决，不写需求正文、不写实现代码、不写验收用例。
- 需求由子 Agent 依三件套撰写 → **每轮新开干净上下文评审** → FAIL 修复重评（不设轮次上限）→ PASS 才进拆分。
- 报告结论带证据分级：已实测（真实宿主）/ mock 实测 / 阻塞，附可复核原始帧。
- spike 代码不进产品工程，删前做保护性提交并在文档写「处置声明」；有价值的方案/契约移到附录，避免路径悬空。
- 三主链逐字回归口径 = `git worktree` 基线树 + 交替 ≥6 对 + A-0 归一化 diff，判「当前不得低于基线」，不能只跑单次。
- 门禁按「失败集合差集 = 0」，禁止硬写 `fail === 0`；新增红先 `--test-concurrency=1` 独占复跑证伪 flake。
- 一次派 3 个大 Agent 会触发平台 429；分批（1~2 个），要求 Agent 分批落盘证据。

## 本机环境硬事实（Windows）
- DSH：`%LOCALAPPDATA%\Programs\DeepSeek Harness`（`0.2.2-rc.1`）。**无 `dsh.cmd`**，入口
  `ELECTRON_RUN_AS_NODE=1 "<dir>/DeepSeek Harness.exe" "<dir>/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"`。
- 工具行平台条件挂载：`tool-bash` 在 win32 `disabled` → **夹具禁止硬编码 `bash`**，落盘用 `write`(`file_path`+`content`)。
- 内置 `acp` profile 自带 ACP server（`@deepseek-ai/dsh-acp-app`，`sessionCapabilities={close,list,resume}`，**无 load**）；
  **不需要**第三方 `dsh-acp-server`。**ACP 分帧是 NDJSON（按 `\n` 切行），不是 LSP `Content-Length`**。
- 模型凭据：`~/.dsh/.credentials.yaml`（`deepseek-account` / `deepseek-flash`）。隔离 DSH_HOME 验会话时复制该文件（用完删），
  patch 里把 `agent-default-model` 与 `acp` 两行 provider 改成 `deepseek-account`；**不要碰用户 `~/.dsh`**。
  无凭据时用隔离 patch 注入 `dsh-acp-server/test/mock-llm`。
- 真实宿主写 cwd 内文件**不触发** `session/request_permission`；「等待审批」只能靠夹具。
- 无 Rust/MSVC/Windows SDK，Tauri 只能 CI 构建；Electron 二进制走 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。
  `ELECTRON_RUN_AS_NODE=1` 可能常驻，跑 Electron 前要删。Cursor 只有 IDE，无 `cursor-agent`。
- GitHub：`github.com` 隧道间歇 502（含 HTTP2 framing / CONNECT 502）；可绕代理
  `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY git -c http.proxy= push`；`api.github.com` 直连
  （`curl --noproxy '*'`）稳定，PAT 走 `git credential fill`，可用 REST `GET/DELETE /repos/<o>/<r>/git/refs/heads/<b>`
  核对/删远端分支（DELETE 204；删后 GET 可能缓存 200，须列全量复核）。
- 测试：`node --test "test/**/*.test.js"`（`npm test` 报 MODULE_NOT_FOUND）。夹具项目根一律放 `%TEMP%`，
  `NODE_ENV=test` 必注入；同进程串行场景 ≤10 个，分批跑（否则资源耗尽 `session/new` 全失败）。
- 残留 `orch core serve` 进程会造成负载型 flake；逐文件/`--test-concurrency=1` 复跑证伪，确认过记 flake。

## 跨迭代必守的核心不变量
1. **状态迁移唯一入口 `orchestrator.transit()`**：以磁盘最新快照为 `from` 重新校验 + `save(expectedState)` 做 CAS；
   CAS 形状 `{state,halted,rev}`，`rev` 无条件基于磁盘现值递增（重启不回 1）。禁止直接 `store.save` 改状态。
2. `halted` 必须**独立一次 `saveState`**；门控 `review(downstream)→done` 与 `handoff accepted` 需**同一次 saveState**（rev 只 +1），且不得走 `transit()`。
3. **事件先落盘再广播**；`emit` 失败不得改内存状态。事件 `ts` 复用状态变更同一时刻（`event-bus.emit()` 支持可选 `ts`）。
4. **purity 扫描**：图/角色字面量只能在 `src/templates/**`；`src/core,src/daemon` 零命中，
   命令 `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator`（**英文注释也命中**）。
5. **忙检查放在写锁之前**（`single` 用 `NODE_BUSY`，`code-loop` 用 `INSTANCE_RUNNING`）；同目录并发要在 `@dir` 锁前做占用快检。
6. 判定体只认 `verdict`（严格 `pass`/`fail`），不认 `result` 别名。`stopReason` 不判成败，成败由产出核对裁决。
7. 提示词真正产出点是 `src/core/advance.js` 的 `planAdvance`（经 `plan.promptText`），不是 orchestrator 兜底分支。
   审核提示词必须给**绝对路径**（相对路径会让真实模型写进实例工作区并挂起）。
8. **健康度只在 `getStatus` 读取时算**，`saveState` 只透传 `state.health`（在 saveState 里算会让真实回归从 91% 掉到 9%）。
9. `trace show` 走只读 `instance.trace`，**不得走 `instance.get`**（会触发受控写，破坏只读哈希）；空态看「跨度非空」；
   追踪号落 `state.traceId`；失败摘要行仅四项至少一非 null 时渲染。
10. 中文唯一来源 `src/cli/labels.js`；`task-loop` 事件行渲染必须与 `code-loop` 分流（逐字红线）。
11. 默认图 `single` 输出必须逐字保持 I1.1；三主链逐字回归口径 = `git worktree` 基线树 + 交替 ≥6 对 + A-0 归一化 diff。
12. 验收脚本禁止硬编码测试条数，用 `fail=0 && pass===tests && tests>=基线`。
13. **核心独立进程 + 命名管道**：管道名 `sha256(realpath(root).toLowerCase()).slice(0,16)`；`--project`/管道按项目根而非 shell cwd 算。
14. `load` 后 drain-quiet（idle 40ms / cap 400ms）；`-32602` 同码双义（会话不存在 / prompt 在飞）；`accepted` 排除
    `usage_update` 等噪声；cancel 非即时（实测 4.3s），容忍迟到 update。
15. 指纹由核心自算；`artifactRef` 只从 `tool_call.rawInput.file_path` 提取；判定只认 `verdict`。
16. 发布面：`makensis` 预装但不在 PATH；Windows 路径剥 `\\?\` 前缀；证据原始帧不得 strip 空白。
17. **跨迭代合入的两个坑**（I1.12 合 I1.11 实证）：① 前序迭代的「冻结锚点」测试（整表 `deepEqual`）会被本迭代
    合法扩项撞红 → 改为「前缀逐字不变 + 尾部精确清单」+ 新增项单列断言，**不放松为子集**；② 差集口径必须
    对照 `git worktree` 出来的 `origin/main` 基线树红名单，**不是**对照本分支合入前的旧帧（main 自身的 25 条红不能
    算到本迭代头上）。③ `git diff HEAD` 型用例（AC-23 #3 之类）在合并未提交时必然报红，提交后才归零，别在合并中途判失败。

32. **差集门禁要比「失败原因」不只比名字**：基线里因 `EBUSY` 而红的冻结用例，被改成「断言失败」后
    名字不变、差集仍 0 —— 同名换 `failureType` 一律当新增红（I1.8 实测抓到 2 条）。
33. **冻结用例的标题是锚点，不得改**：可以按扩项纪律改断言，改标题会让「基线已红」变「新增红」。
34. **`newState` 新字段只能追加在最后**（`traceId` 之后），否则打乱 I1.9 冻结的 18 字段前缀。
35. **测试不得写仓库内其它迭代的证据目录**（`test/wp11/perf.test.js` 曾每次改写 I1.4 的 NFR 证据）：
    默认写 `%TEMP%`，需显式 `NFR_EVID_DIR` 才回写。
36. **手写台账要活过重生成**：整文件重写的生成器先摘出 `## 处置结论` 之后的人工段再接回。
37. **「等迁移落定」再取证**：事件与落盘有毫秒级先后，读早了会造假阴性（AC-45 的 4 条即此）。
38. **`sessionPolicies` 不进 checkpoint**（九字段白名单），也不必改冻结契约即可带策略。

## 迭代状态（全部已收口）
| 迭代 | 结论 | 关键基线 |
|---|---|---|
| I1.1~I1.3 | PASS | 26/44/45 AC；418 测试；命名管道核心 + 3 主链 |
| I1.8 第 1 批 | 合入 main（merge `c1915c3`），批次未完 | checkpoint + ACP 恢复方言；分支已删，从最新 main 续作 |
| I1.9 | PASS（27/27 AC、1157 测试、终验 PASS） | 三层日志 + 健康度 + `orch trace show` |
| I1.10a | PASS（44/44 AC、1425 测试、终验 PASS，远端 `9c30f61`） | 桌面壳 + 实例列表 + 角色流程图 + GitHub CI Release |
| I1.10b | PASS（51/51 AC、1526 测试、425 证据、终验 PASS，merge `d17090f`） | 角色下钻与节点详情下钻；文案键 147→210 |
| I1.11 | PASS（49/49 AC、1606 测试/4 允许失败差集 0、588 证据、三主链 diff 0、终验 PASS） | 通知队列与只读浏览面；文案键并集 312 |
| I1.12 | **BLOCKED（未收口）**：22 通过 / 0 不通过 / 1 阻塞（AC-21）、322/322 核对项、153 证据、终验总判 FAIL → 已合入 main（`85c5a8b`），但 §4.5 Done 未达成 | 四道治理门禁进控制流 + `orch verify/export/migrate` + 性能基线 mock 管线；AC-21 真实宿主 20/50 口径未取证（裁决 F 停在试点） |

- **当前主线 = main**（2026-11-19 合入 I1.12 后），HEAD `8506ad9`；全量 **1841 条 / 1808 pass / 22 fail / 11 skip**，
  差集口径改为「对照 `origin/main` 基线树（`b1fb82c`：1707/1671/25/11）红名单」，新增红 0。
- **阶段一（13 迭代）进度 = 11 PASS + 2 未收口（I1.8 未达成 Done / I1.12 阻塞），未达成退出条件**：台账在
  `docs/index.md`「阶段一实现状态与环境归属」段，机器快照 `probe/phase1-status/status.json`。
  两个卡点：① **I1.8**（2026-11-21：S2/S3 完成、2 条产品缺口已返工；**55 通过 / 10 不通过 / 2 阻塞**、
  核对项 689/715、被引用帧 452、全量 1927/1895/21/11、**独立终验 4 轮均 FAIL、Done 2 PASS/5 FAIL**。
  产品缺陷 = 0；剩余 **8 条需求冲突**（AC-15/23/37/42/43/45/63/67）+ **2 条夹具缺口**（AC-58 双项目根与 kill 窗口、
  AC-62 投递失败接缝）+ 2 条阻塞已书面豁免未改判。**卡在需求文本，不在代码**，需用户逐条裁决才能 Done）；
  ② **I1.12 AC-21**（20 实例/50 会话真实宿主口径未取证）。**别把「已合入 main」当成「已收口」。**
- **I1.12 遗留**：AC-21 阻塞（`blocked=1` 未抹）；裁决 F 记录「本机有真实宿主 0.2.2-rc.3、试点 5/5 最大 1473ms<2s，
  但未达 D-11 的 20 实例/50 会话」→ 解除只能靠补满取证或用户书面豁免。
- **I1.11 边界**：无逐 AC 真实宿主面（全 mock 实测，U-13 降级非阻塞）；壳层真探针需 `npm run desktop:build` 后不再 SKIP；若提供 `cursor-agent` CLI 可补 ACP 真实宿主取证。
- **发布面**：`.github/workflows/release.yml`（tag `v*` + `workflow_dispatch`，`permissions: contents: write` 仅此一项，
  只用 `${{ github.token }}`）；三平台矩阵出 `.dmg`/NSIS `.exe` + `SHA256SUMS.txt`；`v0.*` → prerelease。
  Actions 证据日志行尾带时间戳，`.gitattributes` 已关掉 `docs/iterations/**/evidence/**` 整棵证据树的空白检查——
  **不得 strip，等于篡改证据**。
- **门禁台账**：`gates.json` 的 `head` 是「被验证提交」，产物须在**紧随其后的独立提交**落盘；`--amend` 并入会让 sha 变孤儿。
- **仓库协作**：`origin/main` 会被并行工作树推进；合入前 `git fetch`；分叉时备份 WIP → `reset --hard origin/main` →
  记忆日志按**标题级并集**合并。本地 sha 与远端可能不等（时区），**以 `origin/main` 为权威**。
- `core.autocrlf=true` 下 `git restore` 后 status 假报 M；用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 刷新，不可全量 `-a -f`。
