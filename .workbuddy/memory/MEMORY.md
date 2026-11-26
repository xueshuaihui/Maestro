# Maestro 项目长期记忆

> 本文件是**当前口径**的浓缩。v1 迭代全过程细节见 `docs/index.v1-baseline-20261123.md` 与
> `docs/iterations/iteration-*/`；日常工作流水见同目录 `YYYY-MM-DD.md`。

## 一、产品形态（v2，最高优先级）

- **用户对 beta.3 的裁决**：v1 形态"用不起来"（核心入口缺失、迭代顺序拆乱）→ 全面重写 PRD 与迭代规划
  （`docs/index.md` v2，commit `1c5a8ca`）。
- **Maestro = 多 Agent 软件研发组织 / 团队搭建与运行平台**。核心旅程：打开应用**自动扫描本机 Agent CLI 并罗列**
  → 基于 CLI 建角色/员工 → 搭 Agent Team → 建工作流 → 端到端跑通。
- **概念模型**：组织→部门→角色→员工(Agent)→会话。**角色≠Agent**（一角色多员工）：角色声明所需 CLI 能力，员工绑定具体 CLI。
- **D-1 已裁决**：12 阶段研发组织只是**一种使用场景**，不是唯一形态；工作流 = 任意 DAG，
  12 阶段 = 官方内置模板之一 + 阶段一验收样例（commit `b3abbcc`）。
- **迭代编号 A/B/C/D**（v1 的 I1.x 冻结为历史引用）：A=核心形态闭环（A1 发现 / A2 建角色员工 / A3 Team /
  A4 工作流 / A5 端到端 / A6 横向机制），B=引擎底座接入（复用 v1 不重写），C=桌面治理，D=多宿主多项目。
  **A5 是阶段一唯一硬判据**。
- **引擎是底座不是卖点**：v1 13 迭代 PASS 只证明引擎成立、不证明形态成立（beta.3 反证）。ACP 适配器 / 工作流引擎 /
  调度 / Session / Handoff / Policy / Artifact / 四层状态 / 三层日志 / 治理**全部保留**。
- **D-2 技术结论（实测）**：静态发现层有开源可用 `geiger-scan`（`Atomburstofficial/geiger`，MIT，零依赖，
  Node≥18，`data/known-agents.json` 识别表 + 11 detector），**但无 ACP 握手**；Trove 只转 OTEL。
  → 识别表移植到 `src/adapter/cli-discovery/` 自研，**能力握手与员工调度必须自研**；
  不把 `npx geiger-scan` 作运行时硬依赖（桌面端不能要求用户有 Node/联网）。
- 待裁决 D-3~6（beta 处置 / 取证机器 / 编号确认 / 模板口径 + 首版支持的 CLI 清单），未拍板不写需求正文。

## 二、工作方式（流程规范，跨迭代适用）

- 五阶段 S0~S4；主控只调度/复核/裁决，**不写需求正文、不写实现代码、不写验收用例**。
- 需求由子 Agent 依三件套撰写 → **每轮新开干净上下文评审** → FAIL 修重评（不设轮次上限）→ PASS 才拆分。
- 产物链：`docs/iterations/iteration-N/requirement.md` → `iteration-N.md` → `{report,acceptance-*,final-verification}.md` + `evidence/`。
- 报告结论带证据分级：**已实测（真实宿主）/ mock 实测 / 阻塞**，附可复核原始帧。
- spike 不进产品工程，删前保护性提交 + 写「处置声明」，有价值的契约移到附录避免路径悬空。
- 一次派 3 个大 Agent 会触发平台 429；分批 1~2 个。
- **判断"是否收口"看 §4.5 Done，不看"已合入 main"**。v1 遗留：I1.8（卡 8 条需求冲突 + 2 条夹具缺口，需用户裁决）、
  I1.12 AC-21（20 实例/50 会话真实宿主未取证）—— 均已在 v2 重写后退出关键路径。

## 三、跨迭代核心不变量

1. **状态迁移唯一入口 `orchestrator.transit()`**：以磁盘最新快照为 `from` 重新校验 + `save(expectedState)` 做 CAS；
   CAS 形状 `{state,halted,rev}`，`rev` 无条件基于磁盘现值递增（重启不回 1）。**禁止直接 `store.save` 改状态**。
2. `halted` 必须**独立一次 `saveState`**；门控 `review(downstream)→done` 与 `handoff accepted` 需**同一次 saveState**
   （rev 只 +1），且不得走 `transit()`。
3. **事件先落盘再广播**；`emit` 失败不得改内存状态。事件 `ts` 复用状态变更同一时刻。
4. **purity 扫描**：图/角色字面量只能在 `src/templates/**`；`src/core,src/daemon` 零命中。命令
   `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator`（**英文注释也命中**）。
5. **忙检查放在写锁之前**（`single` 用 `NODE_BUSY`，`code-loop` 用 `INSTANCE_RUNNING`）；同目录并发要在 `@dir` 锁前做占用快检。
6. **判定只认 `verdict`**（严格 `pass`/`fail`），不认 `result` 别名；指纹由核心自算；`artifactRef` 只从
   `tool_call.rawInput.file_path` 提取。`stopReason` 不判成败，成败由产出核对裁决。
7. 提示词真正产出点是 `src/core/advance.js` 的 `planAdvance`（经 `plan.promptText`），不是 orchestrator 兜底分支。
   审核提示词必须给**绝对路径**（相对路径会让真实模型写进实例工作区并挂起）。
8. **健康度只在 `getStatus` 读取时算**，`saveState` 只透传 `state.health`（否则真实回归从 91% 掉到 9%）。
9. `trace show` 走只读 `instance.trace`，**不得走 `instance.get`**（会触发受控写、破坏只读哈希）；空态看「跨度非空」；
   追踪号落 `state.traceId`；失败摘要行仅四项至少一非 null 时渲染。
10. 中文唯一来源 `src/cli/labels.js`；`task-loop` 事件行渲染必须与 `code-loop` 分流（逐字红线）。
11. 默认图 `single` 输出必须逐字保持 I1.1；三主链逐字回归口径 = `git worktree` 基线树 + 交替 ≥6 对 + A-0 归一化 diff。
12. 验收脚本禁止硬编码测试条数，用 `fail=0 && pass===tests && tests>=基线`。
13. **核心独立进程 + 命名管道**：管道名 `sha256(realpath(root).toLowerCase()).slice(0,16)`；`--project`/管道按项目根非 shell cwd 算。
14. `load` 后 drain-quiet（idle 40ms / cap 400ms）；`-32602` 同码双义（会话不存在 / prompt 在飞）；`accepted` 排除
    `usage_update` 等噪声；cancel 非即时（实测 4.3s），容忍迟到 update。
15. **`newState` 新字段只能追加在最后**（`traceId` 之后）；`sessionPolicies` 不进 checkpoint（九字段白名单），
    带策略不必改冻结契约。
16. **测试不得写仓库内其它迭代的证据目录**（曾每次改写 I1.4 的 NFR 证据）：默认写 `%TEMP%`，`NFR_EVID_DIR` 才回写。
17. **手写台账要活过重生成**：整文件重写的生成器先摘出 `## 处置结论` 之后的人工段再接回。
18. **「等迁移落定」再取证**：事件与落盘有毫秒级先后，读早了造假阴性。

## 四、门禁与差集纪律

- 差集按「**失败集合差集 = 0**」，禁止硬写 `fail === 0`；新增红先 `--test-concurrency=1` 独占复跑证伪 flake。
- **差集要比「失败原因」不只比名字**：同名换 `failureType`（`EBUSY` → 断言失败）一律算新增红。
- **冻结用例的标题是锚点不得改**：可按扩项纪律改断言，改标题会让「基线已红」变「新增红」。
- 差集基线必须对照 `git worktree` 出来的 `origin/main` 红名单，**不是**本分支合入前的旧帧。
- 合入冲突两个坑：① 前序的「整表 `deepEqual`」冻结锚点被合法扩项撞红 → 改「前缀逐字不变 + 尾部精确清单」，
  **不放松为子集**；② `git diff HEAD` 型用例在合并未提交时必红，提交后才归零。
- `gates.json` 的 `head` 是「被验证提交」，产物须在**紧随其后的独立提交**落盘；`--amend` 会让 sha 变孤儿。

## 五、桌面端红线（desktop/ui、desktop/harness）

- **零 CJK**：字面量（含注释、全角标点 `：`、`，`）与 31 词禁表（含 `editor`）都会被 wp14 三条扫描抓红。
  文案必须 `ctx.t('KEY')`（桌面表）/ `ctx.st('KEY')`（`STUDIO_TEXT`）下发；`st(key, fallback)` 的 fallback 必须 ASCII；
  分隔符用空格或 `·`；局部变量别叫 `editor`（`roleEditor` 合法，按整词扫）。
  **macOS 的 `grep -P` 不可用且静默返回空**，自查用 `python3 -c` 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]`。
- **文案键必须真被 `GET /ui/labels` 下发**：否则空表头/空按钮/空 toast。门禁 `test/wp13/ui-label-keys.test.js`。
  新增键要**同时**进 `test/wp13/labels-desktop.test.js` 的键清单**和**值表（**append-only**，冻结断言逐字比）。
- `PRESS_ACTIONS` 里的动作在 `pointerdown` 即响应（避免 live frame 重绘吃掉 click），`click` 有 600ms 去重窗口
  → 验收脚本必须**同时派发 `pointerdown` + `click`**。
- 输入控件要带 `data-field`，否则实时帧重绘时 `captureFocus/restoreFocus` 认不出，用户打字丢光标。
- 导航锚点唯一化：`.sidebar [data-section=…]`、`.secbar .sec-tab[data-tab=…]`；`[data-action="nav"][data-arg=…]` 会命中页内按钮。
- `updateStudio` 的 mutator 必须返回 `{ok:true, value:{...}}`，只透传 `.value`；`atomicWrite` 是异步的。
- `node --test` **必须带 `NODE_ENV=test`**：`/__test__/graph/pulse`、`/__test__/window-probe` 等接缝按该变量注册，
  漏了会让 wp13/wp14 假红 4~7 条。全量 `node --test "test/**/*.test.js"`（`npm test` 报 MODULE_NOT_FOUND），
  本机 macOS `--test-concurrency=1` 约 12 分钟、2044 条。
- **Tauri 同步 command 跑在主线程**：任何带超时往返（`core.ping`、`/ui/labels`）必须 `#[tauri::command(async)]`，
  否则核心不健康时窗口一起冻住（「一直显示正在连接」的观感来源）。
- 测试替身要跟着产品长：壳层用了 `window.addEventListener('message')`，假 `window` 没补就会让 `mountApp` 5 条在断言前全死。

## 六、发布面

- `.github/workflows/release.yml`：tag `v*` + `workflow_dispatch`，`permissions: contents: write` 仅此一项，只用
  `${{ github.token }}`；三平台矩阵出 `.dmg` / NSIS `.exe` + `SHA256SUMS.txt`；`v0.*` → prerelease。
- `.gitattributes` 已关掉 `docs/iterations/**/evidence/**` 的空白检查——**证据原始帧不得 strip，等于篡改**。
- **同版本重发**：删远端 tag 重推可触发 `push.tags`（`workflow_dispatch` 只出 dryrun 草稿），但**删 tag 会把关联
  Release 变 draft**；CI 只 `upload --clobber`，不会重 publish、不改 target/body。事后必须
  `PATCH /releases/{id}` 设 `draft:false` + `target_commitish` + body，再匿名按 tag 查 API 应 200。
- **`gh release edit --target` 只收完整 40 位 sha**，短 sha 报 `Release.target_commitish is invalid`（422）。
- `scripts/desktop/build.mjs` 复制 `bin/ src/ desktop/ui/ assets/`；**漏 `assets/` 会让装好的应用内置角色为 0 个**
  （源码树 16 个）——这是只有 `--app` 才暴露的一类缺陷，`verify:assets` 源码绿、打包红。
- `npm run desktop:build` 会撞沙箱批量删除保护（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，旧 `.app` > 50 文件）：
  把 `Maestro.app` 改名成 `Maestro.app.pre-<用途>-<ts>` 让位再跑，这解释了目录里那堆 `pre-*`。
- 验收三层：`verify:release`（源码）/ `verify:app`（打包产物 + Chrome CDP headless）/ `MAESTRO_CLI_BIN` 指**目录**。
  菜单回归 `verify:nav` 已挂进两者。

## 七、本机环境（macOS，当前）

- 无 dsh / cursor-agent / codex / claude / gemini CLI；有 WorkBuddy.app、VS Code、Xcode、agent-browser。
  `chatgpt.com`、`r.jina.ai` 不可达（HTTP 000）；百度 / GitHub 通。
- **推送走 SSH**：`git push ssh://git@github.com/xueshuaihui/Maestro.git main`。HTTPS + 代理隧道间歇 502
  （HTTP2 framing / CONNECT 502），必要时 `env -u https_proxy -u HTTPS_PROXY -u http_proxy -u HTTP_PROXY git -c http.proxy= push`。
  `api.github.com` 直连稳定（`curl --noproxy '*'`）。SSH 推送不会更新 `refs/remotes/origin/main`，
  需 `git update-ref refs/remotes/origin/main <sha>` 或单独 fetch 修正状态显示。
- 无 Rust/MSVC/Windows SDK 时 Tauri 只能 CI 构建；本机 Rust 1.98 已可本地 `desktop:build`。
- 残留 `orch core serve` 进程会造成负载型 flake；逐文件/独占复跑证伪后记 flake。
- 旧 Windows 宿主记录（v1 时期，仅历史参考）：DSH `%LOCALAPPDATA%\Programs\DeepSeek Harness` 无 `dsh.cmd`，
  入口 `ELECTRON_RUN_AS_NODE=1 …/dsh/lib/bin.js`；内置 `acp` profile 自带 ACP server（`close/list/resume`，**无 load**），
  **ACP 分帧是 NDJSON 按 `\n` 切行，不是 LSP `Content-Length`**；`tool-bash` 在 win32 `disabled` → 夹具禁止硬编码 `bash`。

## 八、当前状态（2026-11-26）

- **主线 = main，HEAD `6eadf04`（已推远端）**。`v0.0.1-beta.4` 已正式发布：run `45678224448` 三平台成功，
  `draft=false / prerelease`，target `0218759`，4 资产齐全，匿名 API 200。发布记录 `docs/iterations/beta.4-release.md` §20–§21。
- beta.4 内容：统一资源平台（`b8de23f`）→ 菜单按任务重组（5 段 `run/team/flow/govern/setup` + 常驻二级标签栏，
  唯一真相源 `desktop/ui/shell/nav.js`）→ 新增工作流列表页 → 十项缺陷修复（含打包漏 `assets/`、`tray.rs` `E0689`）。
- 全量 2044 条 / 2026 pass / 16 fail / 2 skip：9 条在 `origin/main` 基线树同样红（逐条比对失败原因），
  7 条独占复跑转绿（负载型 flake），**新增红 0**。
- 尚未解决：①「组织」仍是 iframe 内 Studio 自己的 UI，与主壳标签栏两套视觉；② 流程「运行」仍需人工填任务，
  无「按上次参数重跑」。
- **`core.autocrlf=true` 下 `git restore` 后 status 假报 M**：用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 刷新，
  不可全量 `-a -f`。
- **仓库协作**：`origin/main` 会被并行工作树推进；合入前 `git fetch`，分叉时备份 WIP → `reset --hard origin/main` →
  记忆日志按**标题级并集**合并。**以 `origin/main` 为权威**。
