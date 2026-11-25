# beta.4 发版与验证记录

> 版本：`0.0.1-beta.4` ｜ 基线提交：`b1efef9`（含 A/B/C/D 主体 `3fa18ba`）
> 验证口径：**核心旅程"能否配出来"是唯一发版硬判据**（`docs/index.md` §阶段 A 退出条件）
> 流程口径：`docs/templates/execution-template.md` §0.0 快速通道 + `AD-11`（需求一版评审、只卡阻塞）

## 1. 本次发版回答的问题

`v0.0.1-beta.3` 实测被判定"用不起来"：引擎能力 13 迭代全 PASS，但产品的核心入口（打开即扫描本机 Agent CLI → 基于 CLI 建角色员工 → 组 Team → 建工作流 → 端到端跑通）在迭代顺序里被拆散且排在最后。

beta.4 交付的正是这条主线：**A 形态闭环 / B 引擎接线 / C 桌面搭建台 / D 多项目**。因此本记录不复述"实现了什么模块"，只回答一件事：**这条流程现在能不能被真实地配置出来并跑完**。

## 2. 判定结论

| 判据 | 结果 | 证据 |
|---|---|---|
| 核心旅程可**编程驱动**跑通（域层） | **PASS 11/11** | `npm run verify:core` → `CORE_JOURNEY_OK`，exit 0 |
| 核心旅程可**经桌面通道配置**跑通（页面真实请求序列） | **PASS 16/16** | `npm run verify:ui-flow` → `UI_FLOW_OK`，exit 0 |
| 搭建台页面静态面可取、标签全解析 | PASS | `studio.html` 200 / `studio.js` 200；引用 49 键、缺失 0 |
| 既有测试无新增红 | **PASS 差集 0** | 基线树 26 红 → 当前树 24 红，新增红 0 |
| 三平台发版流水线 | **PASS** | `45235795178`（第 2 次尝试）三平台 success + 汇总发布 success |
| 产物内资源与路由可用 | **PASS** | 下载 arm64 dmg 校验 SHA256 一致；包内 11 个 studio 模块 + 页面齐全；用包内源码树起服务，`/studio/state` `/studio/labels` `/ui/studio.html` 均 200 |
| 真实宿主（本机 Agent CLI）驱动 ACP 会话 | **未取证（非阻塞）** | 本机无目标 CLI 的 ACP 能力，`AD-08` 口径保留 |

**发版结论：已发布。** Release `v0.0.1-beta.4`（prerelease）已上线，产物：
`Maestro_0.0.1-beta.4_arm64.dmg` / `_x64.dmg` / `_win-x64-setup.exe` / `SHA256SUMS.txt`。

阻塞项为 0；未取证的只有"真实宿主执行"，它是环境缺口而不是代码缺口，且从不宣称已发生（`mode: simulate` 产物带显式标注、`engine` 模式的 `no_host_config` 如实上报）。

## 3. 域层核心旅程（`npm run verify:core`）

11 步全部 PASS，节选真实输出：

```
[PASS] A1 CLI 扫描（本机） — 扫描完成，发现 2 个 Agent CLI
[PASS] A2 组织种子（23 角色） — 角色 23 / 员工 46 / CLI copilot
[PASS] A4 12 阶段工作流 — 阶段 12 / 门禁 3
[PASS] A3 团队搭出并校验就绪 — 团队 core-team 就绪：23 个角色 / 46 名员工 / 覆盖阶段角色 23/23
[PASS] A5 运行被门禁拦截（半自动） — 停在首道门禁
[PASS] A6 需求缺失回退产品评审 — 已开启变更评审：C-001（退回产品评审），任务 T-008 已置为 blocked
[PASS] A5 逐级批准三道门禁后完成 — 12/12 阶段完成
[PASS] A5 知识库产物落盘 — 24 个产物文件
[PASS] A6 任务全部完成 — 12/12
[PASS] B 引擎资产编译 + 引擎侧 schema 校验 — 角色 38 个（不合规 0），工作流校验 通过
[PASS] D 多项目登记 — 1 个项目
core journey: 11/11 steps passed
CORE_JOURNEY_OK
```

> 上为发版时的原始输出。CLI 发现条数随机器环境变化（本机 `PATH` 上可用 CLI 增减会改变第 1、2 行），
> 判定条件不依赖具体条数——脚本断言的是"扫描完成且组织种子与之一致"，不是"必须发现 N 个"。

## 4. 桌面通道核心旅程（`npm run verify:ui-flow`）

这一层比上一节更严：它**不手工注册任何路由**，完全依赖产品里真实存在的懒挂接（`server.js` 在冻结 v1 路由表之后追加 Studio 表），所有请求就是搭建台页面点击时发出的那几条。

```
[PASS] 静态面无凭据可取到搭建台页面 — studio.html 200 / studio.js 200
[PASS] 页面引用的标签键全部可解析 — 引用 49 键 / 标签表 261 键 / 缺失 0
[PASS] 步骤① 扫描本机 Agent CLI — 发现 1 个（首个 workbuddy）
[PASS] 步骤② 一键建组织（角色 + 员工） — 角色 23 / 员工 46 / CLI workbuddy
[PASS] 步骤③ 创建工作流（12 阶段模板） — 工作流 rd-12 / 阶段 12 / 门禁 3
[PASS] 步骤④ 组建 Agent Team — 团队 ui-core-team / 成员角色 23
[PASS] 团队就绪判定由服务端给出 — ready=true / 覆盖 23/23 / 员工 46
[PASS] 步骤⑤ 启动运行并被门禁拦停 — 停在 s02（门禁 prd-freeze）
[PASS] 步骤⑥ 提需求缺口 → 退回产品评审 — 变更 C-001（pending-review）/ 任务 T-002 → blocked
[PASS] 逐级批准门禁直至跑完 — 3 次批准 / 12/12 阶段完成 / 状态 completed
[PASS] 知识库产物按阶段落盘 — 12 个阶段目录 / 23 个产物文件（.orch/kb/<runId>）
[PASS] 投影无原始标签键泄漏 — 阶段标题泄漏 0 / 部门名泄漏 0 / 首个阶段标题「阶段1 产品构思与需求分析」
[PASS] 任务板与运行一致 — 任务 12/12 完成
[PASS] 未知操作返回可渲染错误 — code=STUDIO_ACTION_UNKNOWN
[PASS] 失败路径带可解析的 labelKey — STUDIO_RUN_UNKNOWN → ERR_RUN_UNKNOWN → 未找到运行：{id}
[PASS] 通道可重复调用（幂等扫描） — 第二次扫描 1 个
ui flow: 16/16 steps passed
UI_FLOW_OK
```

这一步抓到并修掉了 2 个**只有走 UI 通路才暴露**的缺口（域层验证因为显式传参而掩盖了它们）：

| 缺口 | 现象 | 修复 |
|---|---|---|
| `startRun` 丢弃 `waiting` | `POST /studio/action{run.start}` 永远返回 `waiting: null`，页面只能靠 `run.status` 猜停在哪道门禁 | `src/studio/run.js`：把 `advanceRun` 的 `waiting` 透传到返回值 |
| `raiseRequirementGap` 只给 `runId` 时定位不到阶段 | 变更记下来了，但 `stageId: null` → 找不到任务 → **任务不会被 block**，"退回产品评审"闭环断一半 | `src/studio/tasks.js`：无 `stageId` 时回退到运行中 `awaiting-approval` → `running` → `pending` 的首个阶段 |

> 注：`verify-core.mjs` 用 `--stage s08` 显式传参，所以两条都通过；此类"参数被验证脚本替用户补齐"的假绿，正是必须再走一遍真实通道的理由。

## 5. Windows 门禁：首次运行抓到的两类真缺陷

首次发版流水线（`45226749230`）在 Windows 上被质量门禁拦下，报 6 条"意外失败"（不在判定基线内）。原因是 A1 是本轮新增能力，其用例从未在 Windows 上跑过。逐条核对后，**其中两类是产品缺陷，不是夹具水土不服**：

**缺陷 1：发现层忽略了调用方注入的 `platform` / `env`**

`discover.js` 在 `isExecutable` 与 `resolveOnPath` 里直接读 `process.platform` 和 `process.env.PATHEXT`，把已解析出的 `options.platform` / `options.env` 静默丢弃。后果有两个：显式指定平台的行为不可信；Windows 上会给"要求按原名解析"的文件追加 `.EXE;.CMD;.BAT` 后缀而找不到。

修复：把 `platform` / `env` 一路透传到两个函数。

**缺陷 2：Windows 上无法启动 `.cmd` / `.bat` 形态的 CLI（更严重）**

`probe.js` 用裸 `spawn(command, args)` 启动探测目标。Node 自 CVE-2024-27980 修复后**拒绝直接 spawn `.cmd` / `.bat`**（`EINVAL`），而 Windows 上 npm 安装的 agent CLI 几乎全是 `.cmd` shim（`claude.cmd`、`gemini.cmd` 等）。

后果：**Windows 上版本探测与 ACP 握手永远失败**——A1 的整个能力在该平台形同不存在。这条不是测试问题，是"Windows 用户装上 beta.4 会看到 CLI 都探测不出能力"。

修复：仅当 `win32` 且扩展名为 `.cmd`/`.bat` 时经 `cmd.exe /d /s /c` 启动，参数自行加引号；**不用 `shell: true`**（避免把注入面扩大到所有平台），POSIX 路径逐字不变。

**夹具可移植性（非产品行为变更）**

- `cli-acceptance` 的 mock 在 win32 上生成 `codex-mock.cmd`（内含 `node codex-mock.js %*`），与真实 Windows CLI 形态一致；POSIX 仍是可执行单文件。
- `cli-add` 的 CLI-A3 把"不可执行"样本从 `plain.txt` 换成**目录**：Windows 上 `X_OK` 退化为存在性判断，`.txt` 会通过，那条断言在 Windows 等于没测。

**验证边界（如实登记）**：Windows 分支逻辑用注入 `platform: 'win32'` + `PATHEXT` 在 macOS 上单独跑通（`.CMD` 命中、无扩展名不命中），但**无法在本机做 Windows 实机验证**，最终以 CI 复验为准。

### 5.1 四轮 CI 的实际收敛过程

| 轮次 | Windows | macOS | 处理 |
|---|---|---|---|
| #1 `45226749230` | 6 条意外失败 | x64 ok / arm64 被跳过 | 定位到上述两类产品缺陷 |
| #2 `45230050593` | 4 条 | arm64 出现 `AC-60` 超时 | 夹具按宿主平台建模；放宽 `waitForNode` 等待上界（15s→30s，只改上界不改断言） |
| #3 `45233516559` | 1 条（ACC-10） | 双绿 | `ACC-10` 的 JS 本体放在 PATH 目录里，被 `PATHEXT` 里的 `.JS` 再次命中 → 移到目录外 |
| #4 `45235795178` | 门禁 7/7 通过，冒烟 4/5 | 双绿 | 失败项是"探针 ready 30s 超时"；`ready` 在窗口构建完成后即发射，早于页面 JS，与本次改动无因果关系 → 只重跑失败作业 |
| #4 重跑 | **success** | **success** | 汇总发布 success，Release 上线 |

**教训**：`AC-60` 那条在 arm64 runner 上 `duration 15.16s` 正好命中 15s 上界——CI 冷启动的首次 spawn 比本地慢一个量级，等待上界要按最慢硬件留余量，而不是按本机观察值。

## 6. 回归与差集门禁
| 项 | 结果 |
|---|---|
| 全量用例 | **1999 条 / 1972 pass / 24 fail / 3 skip** |
| 基线树（`git worktree` @ `b1efef9`） | 1999 条 / 1971 pass / 26 fail / 2 skip |
| **新增红（失败名差集）** | **0** |
| 被本次改动消除 | 2（`AC-41` 版本对齐两条 —— 版本号三处同步后转绿） |

当前 24 条红全部是**既有红名单**，集中在三类，均与本次改动无关：

- 桌面壳/单实例/托盘/冒烟（`AC-26`、`AC-44`、`desktop-shell`、`single-instance`、`bundle`）——需要真实构建产物；
- SSE 推送时序（`AC-08/09/10/37`、`sinceRev`、`the pulse seam`）——重负载下时序敏感；
- NFR 性能与历史遗留（`NFR-02`、`copyToBackup`、`core.stop`、`main --cwd`、`task-loop 审核提示词`）。

**重负载下的口径复核（如实登记）**：发版后补跑的一次全量（与本机其它任务并发，`duration 653s`）出现 37 红，比基线多 13 个名字，全部落在上述时序族（`AC-04`/`AC-32`/`AC-34`/`AC-35`/`AC-61`/`F-1`/`buildOccupancy`/`escalate resolve`/产品路径自然升级/审批·允许/连发两次 `POST continue`/三主链两接口）。对 8 个所在文件做 `--test-concurrency=1` 独占复跑：7 个文件全绿，`AC-04` 首轮仍红（断言首帧进度 `0/1`，实测拿到 `1/1`），连跑 3 次后全绿，基线树同样 3/3 绿。

结论：**新增红仍为 0**，但那 13 个名字属于"负载一变就红"的时序断言，不是本次改动的产物；`AC-04` 的断言（首帧必须 `0/1`）依赖 mock 宿主的完成速度，属既有脆弱点，不在本次快速通道口径内修。

## 7. 发版内容清单

| 阶段 | 交付 | 关键文件 |
|---|---|---|
| A1 | CLI 静态发现 + ACP 能力握手 | `src/adapter/cli-discovery/**` |
| A2 | 组织：部门/角色/员工/会话 | `src/studio/org.js`、`src/templates/studio-seed.js` |
| A3 | Agent Team 组建与就绪校验 | `src/studio/team.js` |
| A4 | 工作流（12 阶段内置模板 + 任意 DAG） | `src/studio/flow.js` |
| A5 | 端到端运行：门禁/产物/知识库 | `src/studio/run.js` |
| A6 | 任务/缺陷/变更/需求缺口回流 | `src/studio/tasks.js` |
| B | 编译成 `role/v1` + `workflow/v1` 资产并过引擎 schema | `src/studio/compile.js` |
| C | 桌面搭建台（六步向导）+ HTTP 三路由 | `desktop/ui/studio.*`、`src/daemon/http/studio-routes.js` |
| D | 多项目登记与宿主矩阵 | `src/studio/projects.js` |

命令面：`orch org / team / flow / studio / task / project`（从 `bin/orch.js` 独立分发，不碰 `main.js` 冻结解析器）。

## 8. 未取证与风险（如实登记）

1. **真实宿主执行未取证**（`AD-08`，非阻塞）：本机无法提供目标 Agent CLI 的 ACP 会话能力，A1 的 `AC-12`、A5 的"真实会话驱动"仍判阻塞。发版不含任何"已跑过模型"的宣称——`simulate` 产物前置 `mode: simulate`，`engine` 模式在无宿主配置时如实回 `no_host_config`。
2. **搭建台为单页向导，不是最终视觉**：`desktop/ui/studio.html` 六步线性推进，够用但未做大规模组织（数百员工）下的列表虚拟化与搜索。属 C 阶段后续打磨，不阻塞形态验证。
3. **`engine` 模式只到"资产就绪"**：编译产物已过引擎 schema 校验，但真正拉起宿主进程需要用户配置 `.orch/hosts/*.json`；未配置时状态停在 `prepared`。
4. **三主链逐字回归**不在本次快速通道口径内（属 v1 冻结面），基线红名单里 `三主链：A-0 归一化后逐字命中` 一条在重负载下波动，独占复跑可复现为基线红。

## 9. 复现方式

```bash
npm run verify:core     # 域层核心旅程 11 步
npm run verify:ui-flow  # 桌面通道路核心旅程 16 步
npm run verify:release  # 两条串联，任一失败即 exit 1
```

两个脚本都在临时夹具内运行并隔离 `HOME`，不会写入 `~/.maestro/projects.json`，也不读写仓库内任何证据目录。

## 10. 发版后的状态与下一步

发版事实（可核对）：

| 项 | 值 |
|---|---|
| 版本号 | `0.0.1-beta.4`（`package.json` / `tauri.conf.json` / `Cargo.toml` 三处一致） |
| 标签 | `v0.0.1-beta.4` → `a3d87d6`（含 Windows `.cmd` 修复与夹具平台自适应两个后续提交） |
| Release | prerelease，3 平台产物 + `SHA256SUMS.txt` |
| 分支 | `origin/main` 与本地同点 |

阶段级进度台账（A/B/C/D 各自的已交付、缺口、剩余工作与前置条件）维护在 `docs/index.md` §"实施进度总览"。
一句话：**核心形态已可配通，剩余缺口是"真实宿主执行"（需一台装目标 Agent CLI 的机器）与 C/B/D 旧视图向新概念维度的迁移。**

## 11. 发布后真实浏览器复验（阻断性 hotfix）

**用户实测反馈**：装上 beta.4 后一直处于连接状态、无法使用。此前三条验证（域层、HTTP 通道、包内路由）**都没有驱动浏览器点击**，因此全部漏掉了下面这些缺陷。补上 `npm run verify:desktop`（无头 Chrome + CDP，走 `serve-entry.js --desktop` 的真实启动入口）后，一次抓出三处阻断：

| # | 缺陷 | 现象 | 修复 |
|---|---|---|---|
| 1 | `desktop/ui/app.js` 的 `setView()` 白名单没有 `studio` | 「搭建台」导航项渲染出来了，但点击不切换视图，iframe 根本没挂载——**核心入口仍然点不进去** | 白名单加入 `studio` |
| 2 | 壳把 token 写入 `sessionStorage`，`studio.js` 只读 `localStorage` | 即使 iframe 挂上，也拿不到 loopback token，页面停在未认证态 | 抽出纯函数 `desktop/ui/studio/token.js`：URL → sessionStorage → localStorage 依次回退；iframe 与父页共享 session |
| 3 | `studio.js` 的 `render()` 用 `app.replaceChildren()` 删掉了 `#loading`，后续 `load()` 仍写它 | 点「一键演示」只建出 23 个角色就抛 `Cannot set properties of null`，流程/团队/运行全部没发生——**表现为“按钮点了没反应”** | `setLoading()` 容错节点缺失；`DEMO_DONE` 模板补齐占位符参数 |

> 缺陷 1 是 beta.3 同一类问题（核心入口缺失）的回归：只把页面文件放进包里，不等于用户能点到它。**页面存在 ≠ 入口可用**。

**新增验证**：`scripts/verify-desktop-boot.mjs`（`npm run verify:desktop`）共 16 项，覆盖冷启动绘制、token 落点、无卡死在「正在连接」、导航点击、iframe 内容、无未捕获异常、`/studio/state` 可读、页面按钮一键配出组织/流程/团队/运行、完成提示无占位符、无凭据首启不挂死。判定输出 `DESKTOP_BOOT_OK`。
`verify:release` 已串联三条：core → UI 通道 → 真实浏览器。

**回归护栏**：`test/wp14/ui-views.test.js` 新增两条断言——`setView('studio')` 必须切换视图；token 解析必须 session 优先于 local、URL 优先于两者。

### 11.1 重新发版结果（hotfix）

| 项 | 结果 |
|---|---|
| 代码提交 | `7078c65`（hotfix 三处阻断缺陷 + 浏览器验证脚本 + 护栏断言） |
| 标签 | `v0.0.1-beta.4` 重新指向 `7078c65`（先删远端旧标签，再推新标签） |
| CI | `45401521008`：Windows 第 1 次被 `AC-31`（释放 hold 后重新派发）4s 等待上界命中；重跑失败作业后四作业全 success |
| Release | 因删标签变成 draft，CI 只上传附件不重新发布；已用 API `PATCH draft:false, prerelease:true, target_commitish:<full sha>` 恢复 |
| 产物 | 4 个附件全部重新上传（asset id 更新），`Maestro_0.0.1-beta.4_x64.dmg` 48.1MB / arm64 43.6MB / win 35.3MB + SHA256SUMS |

**`AC-31` 说明**：`test/wp13/role-recovery.test.js:169` 的 `waitFor` 上界是 4s，Windows cold runner 上实测 `duration_ms 4215` 正好命中；本机独占及 CI 重跑均通过。与 `AC-60` 同类（等待上界按本机观察值设，未按最慢 CI 留余量），属既有脆弱点，下一次收口时统一放宽。

**回归**：串行全量 `2001 / 1981 pass / 17 fail / 3 skip`，对照 `b1efef9` 基线树失败名差集 **新增红 0**。

---

## 12. 「环境缺口」口径纠正与真实宿主取证（2026-11-24）

**用户追问**：「环境缺口？在本地搭建环境呢？」——复核后确认原口径过于笼统，必须纠正。

### 12.1 原口径错在哪

§2 / §8 曾把「真实宿主执行未取证」整体归为**环境缺口**（本机无目标 CLI）。实测证明这个归因不成立：`npmmirror` 可达（HTTP 200 / 1.4s）、Node 22 在，装一个带 ACP 的 CLI 只需 15s；装好后握手、会话、真实模型推理**全部可跑**。真正的问题不是环境，而是产品探针有两处缺陷，把能跑的 CLI 判成了「不支持」：

| # | 缺陷 | 实测证据 | 修复 |
|---|---|---|---|
| 1 | `probeAcp` 默认发 `--acp` 开关，但真实 CLI（opencode）用 `acp` 子命令 | `probeAcp(--acp)` → `exitCode:1 / acp:false`；`probeAcp(acp)` → `acp:true / protocolVersion:1` | `acpArgsFor()` 按 `cli_id` 查 known 表；known 表给 opencode 加 `acpArgs:['acp']`；finding / user_config / registry 全链路带 `acp_args` |
| 2 | 能力只认旧格式 `sessionCapabilities:[...]`，不认标准 ACP 的 `agentCapabilities.sessionCapabilities:{close:{},...}` | 真实 initialize 帧把 `close/fork/list/resume` 放在 `agentCapabilities` 下，旧解析取到空数组 | `probeAcp` 兼容两种 ACP wire shape（数组取元素 / 对象取键），`capabilities` 同步从 `agentCapabilities` 取键 |

### 12.2 本地搭建环境与取证结果

| 项 | 结果 | 证据级别 |
|---|---|---|
| 环境搭建 | `npm install opencode-ai@1.19.6`（15s / 3 包），本机原先 PATH、npm 全局、`~/.local/bin` 均无 Agent CLI | **本机实测** |
| A1 握手 | `cli add` → `cli probe opencode` → 「ACP 支持」；registry 落盘 `acp:true / version:1.19.6 / capabilities:[close,fork,list,resume] / connection_status:connected` | **真实 CLI 实测**（经产品命令面，非直调探针） |
| A5 会话 | `initialize → session/new → session/prompt → agent_message_chunk("PONG") → end_turn`，`inputTokens:7637 / outputTokens:4` | **真实模型推理实测**（opencode 自带免费模型 `big-pickle`，无需用户凭据） |
| 回归 | `test/wp16/cli-probe.test.js` 新增 2 条（标准 ACP 对象能力 / acp_args 方言），wp16 全量 51/51、`verify:core` 11/11、purity 零命中；全量 `2003 / 1991 pass / 10 fail / 2 skip`，10 条独占复跑后 9 条转绿（并发负载 flake），剩 1 条 `core.stop` 经 `git worktree` @ HEAD 基线树同口径复现 → **新增红 0** | mock 实测 + 机检 |

> 证据分级与 §8 的关系：§8 第 1 条「真实宿主执行未取证」**作废**——它此前把「没装 CLI」误当成「装了也不能跑」。修正后的口径是：真实宿主握手与真实模型推理由本机实测取证；「需用户自有账号凭据（如 Claude/Codex/Gemini 付费模型）」的场景仍未取证，但产品不依赖它，也不宣称发生过。

### 12.3 复现方式

```bash
# 环境
T=$(mktemp -d); cd "$T"; npm init -y >/dev/null
npm i opencode-ai --registry=https://registry.npmmirror.com/
OC="$T/node_modules/.bin/opencode"

# A1：经产品命令面握手
R=$(mktemp -d); cd "$R"
node <repo>/bin/orch.js cli add --name OpenCode --path "$OC"
node <repo>/bin/orch.js cli probe opencode     # → ACP 支持
node -e "console.log(require('$R/.orch/cli-registry.json').clis.find(c=>c.cli_id==='opencode'))"

# A5：真实会话（NDJSON over stdio）
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientInfo":{"name":"m","version":"1"}}}' | "$OC" acp
```

---

## 13. 重发 beta.4（含 A1 真实握手修复 + 全流程真实验证，2026-11-24）

### 13.1 背景与动机

§12 的 A1 修复（`2493200`）与全流程真实验证（`bd37df9`）此前只在本地/远端 main，**tag
`v0.0.1-beta.4` 仍指向旧 hotfix 提交 `7078c65`**——即访客下载到的 `.4` 产物不含真实 ACP 握手
修复。本次把 tag 迁到 `bd37df9` 并重发。

### 13.2 关键决策：走"删 Release + 删 tag → 重推"的干净路径

前次同版本重发的教训（见长期记忆）：**只删 tag、保留 Release** 会让 Release 变 draft，而 CI
的 publish job 对已存在的 Release 只做 `gh release upload --clobber`，不会重新 publish、也不会
更新 `target_commitish`——结果是产物换了但 Release 元数据仍指向旧提交。本次改为先删 Release
再删 tag，让 CI 全新创建 Release，`target_commitish` 自然指向新提交。

```bash
# 1. 推送含修复的本地提交
git push origin main                       # 2493200..bd37df9

# 2. 删旧 Release + 旧 tag（关键：两者都删，不留 draft）
gh release delete v0.0.1-beta.4 --yes
git push origin :refs/tags/v0.0.1-beta.4
git tag -d v0.0.1-beta.4

# 3. 基于最新提交重建 annotated tag 并推送 → 触发 Release workflow
git tag -a v0.0.1-beta.4 -m "release: v0.0.1-beta.4 — 含 A1 真实 ACP 握手修复 + 全流程真实验证" bd37df9
git push origin v0.0.1-beta.4
```

### 13.3 发版前门禁预检

| 项 | 结果 | 备注 |
|---|---|---|
| 版本三处对齐 | PASS `0.0.1-beta.4` | package.json / tauri.conf.json / Cargo.toml |
| 31 词 purity（src/core+daemon、desktop/ui） | PASS 两轮 exit 0 | 新增 verify 脚本不在扫描范围 |
| 测试条数 | PASS 2003 ≥ 1157 | — |
| 失败集合差集 | 本机 FAIL 2 条 | `copyToBackup`(EIO≠ENOENT)、`AC-43 会话重建`(running≠escalated) |
| 差集归因 | **本机沙箱固有红** | `git worktree` 拉旧 tag 提交 `7078c65`（CI 上次全绿的同提交）复跑同样红 → 与本次改动无关；CI Windows job 门禁已 PASS 佐证 |

### 13.4 CI 与产物核验（证据：真实 API 查询）

| 核验项 | 实测 | 结论 |
|---|---|---|
| Release workflow run `45421794691` | 三平台构建 + 汇总发布 **全 success** | tag push 正确触发 |
| 三平台 job | macOS arm64 / macOS x64 / Windows x64 均 success（含质量门禁、打包、冒烟） | 通过 |
| `isDraft` / `isPrerelease` | `false` / `true` | 访客可见 + 预发布，符合 `v0.*` 口径 |
| `target_commitish` | `bd37df9c0de19df08c029c26e1f4d3417c18ae03` | 精确指向含修复的最新提交 |
| `publishedAt` | `2026-11-24T15:22:44Z` | 已正式发布（非草稿） |
| 资产 4 个 | arm64.dmg(45.7MB) / win-x64-setup.exe(37.0MB) / x64.dmg(48.1MB) / SHA256SUMS.txt(297B)，均 `state=uploaded` | 齐全 |
| 匿名 API 按 tag 查询 | **HTTP 200**，未带凭据 | 访客可见 |
| SHA256SUMS 匿名下载 | 297B，含三平台哈希 | 可获取 |
| 资产下载端点 | HTTP 200 | 可下载 |

> 注：本地下载 48MB dmg 做哈希逐字比对被沙箱 SIGTERM 中断，未纳入证据。三平台产物的
> `产物冒烟` job 在 CI 已通过，Release 元数据与匿名访问均已核实。

### 13.5 结论

`v0.0.1-beta.4` 已重发完成，tag 与 Release 均指向 `bd37df9`，包含 §12 的 A1 真实 ACP 握手
修复（探针方言 `acp_args` + 标准 `agentCapabilities.sessionCapabilities` 对象解析）与全流程
真实验证产物。此前"tag 停在旧 hotfix、访客下载不含修复"的问题已消除。

---

## 14. 补齐角色/技能自定义（UI + HTTP action，2026-11-24）

### 14.1 问题

用户问「如何自定义角色和技能？不支持吗？」——核对后确认：域层 `addRole/updateRole`
完整支持 `duty / summary / skills / inputs / outputs / requires`，CLI `org role add --skills`
也能用，但 **桌面 UI 只有 3 个字段**（name/code/dept）、**HTTP `role.add` 只传 4 个字段**、
**技能资产创建只有 CLI**（`orch skill create`），资产页 `/assets/*` 只读（AC-25）。
准确结论是「底层支持、CLI 支持、UI/HTTP 不支持」。本次把 UI 与 HTTP 入口补齐。

### 14.2 改动

| 层 | 改动 | 位置 |
|---|---|---|
| HTTP | `role.add` 补齐 `summary/inputs/outputs/skills/requires`；新增 `role.update`（patch name/summary/duty/dept/contract/skills/requires）；新增 `skill.create` | `src/daemon/http/studio-routes.js` |
| 技能写入 | 复用 registry 同源 `checkSkillMeta` / `serializeSkill` / `atomicWrite`，写 `.orch/skills/<id>/SKILL.md`；builtin 只读 / 重复 / 非法分组均返回可渲染 code+labelKey；**不碰只读 `/assets/*`** | 同上 |
| 错误映射 | 新增 `STUDIO_SKILL_*` / `SKILL_*` → `ERR_SKILL_*` labelKey | `src/studio/messages.js` |
| 文案 | `STUDIO_TEXT` 追加 27 键（UI 字段 + 技能错误）；零 CJK 落在 UI/daemon，中文唯一来源仍在 labels.js | `src/cli/labels.js` |
| UI | 搭建台组织卡：角色表格加「技能」列 +「编辑角色」按钮；表单加 duty/skills/requires.acp（新增/编辑共用）；新增「新建技能」表单 | `desktop/ui/studio/studio.js` |
| 验证 | 新增 `test/wp17/studio-authoring.test.js`（3 条 HTTP action）+ `scripts/verify-authoring-ui.mjs`（真实浏览器点按钮/填表单/落盘，7 步）；`verify:release` 串入 authoring | 测试与脚本 |

### 14.3 约束守住

- **AC-25** 只约束 `/assets/*` 只读浏览（目录哈希不变、无写按钮）；技能写入走 `/studio/action` 创作面，不违反。
- **CJK 唯一来源**：`studio.js` / `studio-routes.js` 零中文字面量（机检 0 命中），全部走 `t()`。
- **purity**：src/core+daemon 角色字面量零命中。
- **STUDIO_TEXT** 无计数冻结（冻结的是 `UI_LABEL_KEYS` / `DESKTOP_V2_LABEL`），追加键不破坏 `labels-desktop` 27/27。

### 14.4 验证结果

| 验证 | 结果 |
|---|---|
| `test/wp17/studio-authoring.test.js` | 3/3（全字段落盘 / role.update 部分更新 / skill.create + 错误路径） |
| wp17 全域 | 19/19 |
| `labels-desktop` 冻结 | 27/27 |
| purity + CJK | 零命中 |
| `verify:core` | 11/11 |
| `verify:ui-flow` | 16/16（标签表 288 键、页面引用 64 键全解析） |
| `verify:desktop` | 14/14（冷启动、iframe、token、按钮操作无异常） |
| **真实浏览器表单交互** `verify-authoring-ui.mjs` | **7/7**（编辑按钮 23 个、表单回填、保存后 state 更新、新建技能写盘、无未捕获异常） |
| `verify-journey` 无 CLI / opencode | 22/22 + 22/22（六步向导未被表单改动破坏） |
| `npm run verify:release`（串入 authoring） | **全绿**（core + ui-flow + authoring + desktop + shell） |
| 全量回归（提交前） | `2006 / 1995 pass / 9 fail / 2 skip`；提交后 `AC-23 #3`（`git diff HEAD` 型）复跑归零 → 8 条：7 条已知基线红 + `desktop-shell` 沙箱超时（单跑亦 SIGTERM）→ 无新增断言红 |

> shell 验证一度误报：`com.maestro.desktop` 的 single-instance 锁被早前手动启动的旧 shell
> 持有，新启动只触发 `activated`、不写 desktop.json。已在 `verify-shell-boot.mjs` 启动前
> 清理同名进程（`killall`/`taskkill`），并对 `activated` 给出明确诊断，避免误判为产品缺陷。

---

## 15. 工作流画布从只读架子补成可用编辑面（2026-11-25）

### 15.1 问题与根因

用户反馈「画布啥都看不到也不能编辑」。逐文件核对后是三处渲染缺陷 + 两处能力缺口叠加，不是单一故障：

| # | 现象 | 根因（代码位置） |
|---|---|---|
| 1 | 连线完全不可见 | `pages.js` 把 `computeLayout` 返回的 `{kind:'arc',ctrl}` 对象直接写进 SVG `d` 属性，序列化成 `"[object Object]"`（`desktop/ui/shell/pages.js` 旧 580–586；`desktop/ui/graph/layout.js:137-145`）。实例流程图早有正确的 `edgeGeometry()`，画布页没用。 |
| 2 | 节点只显示裸 id | 渲染读 `placed.id`，而 `composeCanvas` 已算好中文 `text` 却没被消费（旧 `pages.js:603`）。 |
| 3 | 自定义/Studio 工作流看不到 | 选择器只列 `GET /workflows` 的三个内置模板（`routes.js:417-422`），Studio 编译产物与 `.orch/studio.json` 里的 flow 都不在列表。 |
| 4 | 看不到进度 | 定义态投影按 AC-30 故意不含运行时状态（`src/daemon/canvas.js:6-7`），Studio 的 `runs[].stages[].status` 没有接到画布。 |
| 5 | 不能编辑 | 画布节点/边没有 `data-action`，HTTP 也没有工作流编辑 action；需求文档把编辑划在范围外。 |

### 15.2 改动

| 层 | 改动 | 位置 |
|---|---|---|
| 投影 | 新增 `studioCanvas()`：id 命中 `.orch/studio.json` 的 flow 时，投影阶段为节点并附带最新 run 的 `status/statusKey/progress`，顶层带 `source/editable/progress`；**冻结的 YAML/内置投影形状逐字不变**（AC-30 只约束那一路），id 未命中仍回落到原逻辑 | `src/daemon/canvas.js` |
| 纯几何 | 新增 `canvasEdgePath()`，把布局的 `{kind,ctrl}` 转成真实 `M/L/Q` 路径；回两端缺失时返回空串 | `desktop/ui/canvas/canvas.js` |
| 域层 | 新增 `updateFlow / addStage / updateStage / removeStage / addFlowEdge / removeFlowEdge`，全部经同一个 `editFlow` 草案 + `validateFlow` 门禁；非法边、自环、重复、成环在写盘前被拒 | `src/studio/flow.js`、`src/studio/index.js` |
| HTTP | 新增 `flow.update / flow.stage.add / flow.stage.update / flow.stage.remove / flow.edge.add / flow.edge.remove` 六个 `/studio/action`，与 UI 共用域函数 | `src/daemon/http/studio-routes.js` |
| 错误与文案 | 新增 7 个 `STUDIO_FLOW_*` 错误码映射与 `ERR_FLOW_*` 文案；新增 12 个 `UI_CANVAS_*`/`UI_SAVE`/`UI_CLOSE` 到 `STUDIO_TEXT`（不碰冻结的 `UI_LABEL_KEYS`） | `src/studio/messages.js`、`src/cli/labels.js` |
| UI | 画布重画：合法路径 + 箭头、中文阶段名、状态色、进度条、动态 viewBox；节点点选改名/删除、连线模式表单增删依赖、新增阶段、重置布局；节点拖拽落 localStorage 并在重绘后复用 | `desktop/ui/shell/pages.js`、`desktop/ui/canvas/drag.js`、`desktop/ui/app.js`、`desktop/ui/theme.css` |
| 防竞态 | `loadCanvas` 加单调 `canvasLoadSeq`：连续两次编辑时，较慢的旧请求不得把刚保存的 DAG 覆盖回旧帧（真实浏览器实测抓到过这个回退） | `desktop/ui/app.js` |
| 验证 | 新增 `test/wp18/canvas-authoring.test.js` 与 `scripts/verify-canvas.mjs`（真实 daemon + Chrome/CDP 驱动真实 DOM） | 测试与脚本 |

### 15.3 验证结果

| 验证 | 结果 |
|---|---|
| `test/wp18/canvas-authoring.test.js` | **5/5**（路径字符串、Studio 进度投影、内置回落、编辑落盘、拒绝后文档逐字不变） |
| wp14 画布/契约/文案冻结 + wp13 纯净扫描 | 41/41（1 skip），冻结键集合与 CJK/purity 零命中均保持 |
| **真实浏览器** `npm run verify:canvas` | **15/15**：节点中文名、合法 `d` 路径、进度 1/2、选择器列出 Studio flow、改名落盘、新增阶段立即出现、增/删依赖落盘、拖拽留存、重载后保留 |
| 全量回归（工作区未提交） | `2011 / 1992 pass / 17 fail / 2 skip` |
| HEAD 基线工作树（`7e9df51`） | `2006 / 1986 pass / 15 fail / 5 skip` |
| 差集复核 | 唯一确定新增是 `AC-23 #3`（`git diff HEAD` 型，提交后归零）；`NFR-02` 与 `cursor.json 并发消费` 在全量下互有红、独占 `--test-concurrency=1` 复跑 **6/6 全绿**，判定为既有负载型 flake；基线另有 `detached 自动拉起` 红而本轮未红，同属资源波动 |

### 15.4 边界

- 本次只修本地工作区，**没有重发 tag / Release**；要进安装包需另起发版流程。
- 拖拽坐标属于视图偏好，存浏览器 localStorage，不跨设备同步，也不写进 Studio 文档。
- CLI 侧新增了域函数但没有加对应的 `orch flow stage/edge` 子命令；当前编辑入口是画布与 `/studio/action`，CLI 仍用既有 `flow create --stages`。
- 画布编辑改的是 Studio 源（`.orch/studio.json`）；下次 `run start --mode engine` 重新编译时，`.orch/workflows/*.yaml` 会按新 DAG 覆盖。

---

## 16. 按用户场景重新验收（2026-11-25）

### 16.1 为什么上一轮验收不成立

上一轮（§12~§15）的结论建立在两类证据上：域层单测 + 单向导的接口断言。两者都**不检查页面本身**——不打开侧边栏的每一项，不点按钮看结果，不读用户实际看到的文字。所以下面这些缺陷全都能在"全绿"下存活：

| 存活下来的缺陷 | 为什么旧验收抓不到 |
|---|---|
| 画布连线渲染成 `[object Object]` | 单测只断言 `computeLayout` 返回对象，不断言 SVG 的 `d` 属性 |
| 画布节点只显示裸 id | 投影测试断言 `text` 字段存在，但没人断言它被画出来 |
| 跑了工作流，实例列表仍然空白 | `/studio/state` 断言 run 状态正确，从没从"实例"这个用户入口回看 |
| 失败提示显示 `{cause}` 原文 | 契约测试断言 `message` 前缀匹配，占位符残留在前缀之后 |
| 无 CLI 时的报错不可操作 | 断言只要求"有错误文案"，不要求文案能指导下一步 |

**结论：验收口径必须改成"用户看得见、点得动、落得盘"，接口断言不能替代。**

### 16.2 场景矩阵与结果

新增 `scripts/verify-scenarios.mjs`：真实 loopback daemon + 真实 Chrome/CDP，逐场景驱动真实 DOM。已并入 `npm run verify:release`。

| 场景 | 用户动作 | 判据 | 结果 |
|---|---|---|---|
| S0 冷启动 | 打开应用 | 首屏有内容、不卡「正在连接」、十个侧边栏入口齐全 | PASS |
| S1 逐页可达 | 点每一个侧边栏项 | 每页有内容；无 `undefined`、`[object Object]`、未替换 `{token}` | **10/10 PASS** |
| S2 重复切换 | 同一入口连点两次 | 仍能切换、无异常 | PASS |
| S3 画布可见 | 打开工作流画布 | 中文阶段名、合法 SVG 路径、项目工作流出现在选择器 | PASS |
| S3b 画布编辑 | 改名 / 增阶段 / 增删依赖 / 拖拽 | 落盘且重载后保留 | **15/15 PASS**（`verify:canvas`） |
| S4 实例页 | 打开实例 | 有可操作条目（筛选、新建） | PASS |
| S5 设置 | 打开设置 | 显示真实项目路径 | PASS |
| S6 跑一次工作流 | 启动 → 推进 → 回看 | 运行推进到完成、画布显示「进度 2/2」、**实例页能看到这次运行** | PASS（修复后） |
| S7 新建实例 | 选模板 → 填任务 → 提交 | 要么创建成功，要么给出已填充参数的中文错误 + 下一步引导 | PASS（修复后） |
| S8 搭建台六步 | 扫描→组织→流程→团队→运行→门禁 | 22 条断言 | **22/22 PASS**（`verify:journey`） |
| S9 真实壳 | 启动 `.app` | shell→bundled node→daemon→ready/tray | **6/6 PASS** |
| S10 角色与技能 | 编辑角色 / 新建技能 | 表单回填、保存落盘、`SKILL.md` 写出 | **7/7 PASS** |

汇总：`verify:core` 11/11、`verify:ui-flow` 16/16、`verify:scenarios` 41/41、`verify:canvas` 15/15、`verify:authoring` 7/7、`verify:journey(none)` 22/22、`verify:shell` 6/6。

### 16.3 本轮修掉的缺陷

| # | 缺陷（用户可见） | 根因 | 修复 |
|---|---|---|---|
| 1 | 跑完工作流，实例列表什么都没有 | Studio `run` 与 orchestration `instance` 是两套模型，列表只读后者 | 实例页新增「工作流运行」区块，列出 Studio 运行、状态、模式与阶段进度；点一条跳到画布定位该工作流（`desktop/ui/shell/pages.js`、`app.js`） |
| 2 | 启动失败显示 `无法启动 DSH：{cause}` | `POST /instances` 422 只回 `message`，不带 `params`，而面板按 `ERROR_TEMPLATE + params` 渲染 | 422 响应补 `params`，占位符正确替换为真实原因（`src/daemon/http/routes.js`） |
| 3 | 没有 CLI 时报底层路径错误，用户不知道怎么办 | 失败文案只有机器原因，没有产品动作 | 失败且 `errorCode` 为宿主类错误时，追加「先在搭建台扫描并绑定 CLI」引导（`DESKTOP_NEW_HOST_HINT`） |
| 4 | 画布连线不可见 / 节点裸 id / 不能编辑 | 见 §15 | 见 §15 |

### 16.4 回归与差集

| 项 | 结果 |
|---|---|
| 桌面相关单测（wp13+wp14+wp18） | 639 pass / 10 fail / 1 skip |
| HEAD 基线树（`a5e0f0a`）同组 | 638 pass / 8 fail |
| 差集 | 基线同样红的 8 条（AC-37/AC-08×3/AC-09/AC-10/AC-43/AC-27）**不是本迭代引入**；本条多出的 `desktop-shell` 与 `shell-notify 真实探针` 两条，**独占 `--test-concurrency=1` 复跑均全绿**，判定为并行负载型 flake，新增红 **0** |

### 16.5 仍然存在的边界（不掩盖）

- **Studio 运行不创建 orchestration 实例**。`simulate` 不打开 ACP 会话，`engine` 模式只编译资产（`launched:false` 写死）。因此实例下钻、图/看板、证据浏览对这些运行仍是空的——它们属于 v1 的会话执行面。本轮的做法是让用户在实例页**看得到这次运行并跳到画布看进度**，不是把两套模型合并。合并需要在 core 增加「项目 workflow → graph」的适配，属 B 阶段工作。
- `S7` 在无宿主机器上的正确结果是「可读失败 + 引导」，不是「创建成功」；真实创建需要 `.orch/hosts/*.json` 指向可用 CLI。
- 验收脚本本身有两条曾被误判的规则（空态页长度阈值、iframe 内容不在父文档 `innerText` 里），已在脚本内修正——这也说明「脚本红了」不等于「产品坏了」，需要逐条回看。

### 16.6 打包产物验收（本轮新增，之前完全缺失）

核对构建时间发现：`Maestro.app` 构建于 11-24 22:17，而画布修复（`a5e0f0a`）与本次修复（`49601fb`）都在之后。**上一轮的 `verify:shell` 实际验的是旧包**——它能证明"壳能启动"，但不能证明"装上的包里有新代码"。这正是"发布之后才发现问题"的机制。

补强：

- `npm run verify:app`（`verify-scenarios.mjs --app`）走**真实 `.app` 二进制** → 内置 node daemon → 同一套 41 条场景断言，打开的是包内的 `desktop/ui`。
- 记录：新构建的 `.app` 上 **41/41 PASS**，含画布中文节点、`M/L` 连线、运行区块显示两条运行（`RUN-1` 1/2、`R-...` 2/2）、失败提示带真实原因与引导。
- 发版前置顺序固定为：`desktop:build` → `verify:app` → `verify:release`（源码树）→ 推 tag。

### 16.7 实例下钻链路（此前从未走过）

上一轮只验到"实例出现在列表"，没验"点进去能看到什么"。补 `scripts/verify-drilldown.mjs`：用仓库自带的 mock ACP 宿主（走与生产 CLI 完全相同的 `hosts/dsh.json` launch seam）真的创建一个实例，再从 UI 点进去走完工作区全部页签。

| 断言 | 结果 |
|---|---|
| 通过新建表单创建真实实例（表单 → 实例列表出现 `INST-001`） | PASS |
| 打开实例进入工作区（页签可点） | PASS |
| 概览 / 流程图 / 看板 / 证据 四页均有内容、无脏文本 | 4/4 PASS |
| 流程图真的画出节点（SVG 元素 3 个） | PASS |
| 全程无未捕获异常 | PASS |

源码树 **14/14**、打包产物 **14/14**。已并入 `verify:release`；`verify:app` 现在一次跑三套（scenarios / canvas / drilldown）全部针对 `.app`。

### 16.8 第三次重发：Windows 门禁超时（非代码缺陷）

tag `v0.0.1-beta.4` → `00cb281` 的流水线（run `45450622449`）macOS x64 / arm64 均成功，Windows 在「质量门禁」判红：

```
[gate] FAIL 全量单测可运行并产出 TAP 摘要 — tests=null pass=0 fail=0
[gate] PASS 失败集合与判定基线差集为 0 — 17 条失败全部落在判定基线 25 条内
```

时间戳给出结论：门禁 `17:39:26` 起跑、`18:09:33` 报错 = **30 分 07 秒**，正好撞上 `gate.mjs` 的 `timeout: 30 * 60 * 1000`。测试被 SIGTERM 杀掉后没有 TAP 摘要，于是"跑了多少条"判空。**功能面无新增失败（差集 0），这是超时不是缺陷。**

修复：上限提到 45 分钟（套件已过 2000 条，Windows runner 单跑就要约 30 分钟），并重发 tag。

### 16.9 发版结果（run `45457208196`）

| 项 | 结果 |
|---|---|
| 流水线 | macOS x64 / macOS arm64 / Windows x64 / 汇总发布 **四 job 全绿** |
| tag | `v0.0.1-beta.4` → `4de9ad8`（含 §16 全部修复与验证脚本） |
| Release | `isDraft=false` / `isPrerelease=true` / `target_commitish=4de9ad8`，4 个资产时间戳 `18:19` |
| 匿名 API | `GET /releases/tags/v0.0.1-beta.4` → **200**（未登录可见） |
| 资产 | 两个 dmg + 一个 exe + `SHA256SUMS.txt`，下载 200，校验文件内容与三个包一一对应 |
| 本地打包产物 | `npm run verify:app` = scenarios 41 + canvas 15 + drilldown 14，**全绿** |

处理细节：删 tag 会让关联 Release 变 `draft`，且 `target_commitish` 停在旧 sha；改写时 `gh release edit --target` 只接受**完整 40 位 sha**，短 sha 返回 `422 target_commitish is invalid`。

---

## 17. 实例页从「点了没反应」补成可配置可操作（2026-11-25）

### 17.1 用户判据

「实例也用不起来，交互不完整，从用户操作角度验证完整场景能不能配置出来。」按这个口径逐项点下去，结论是**当时的实例页根本不可能跑起来**：新建实例只问「模板 + 任务」，而 `POST /instances` 需要 `.orch/hosts/<id>.json` 才可能拉起宿主，界面上没有任何地方能生成这个文件。扫描到的 CLI 只被用来建员工，从未落成宿主配置。

### 17.2 补上的配置面

| 缺口（用户可见） | 之前 | 现在 |
|---|---|---|
| 不知道实例靠什么运行 | 新建页只有工作流与任务 | 新增「运行宿主」区：已绑定宿主卡片 + 「扫描本机 CLI」 |
| 扫到 CLI 也没法用 | `cli.scan` 只写 CLI 注册表，没有任何后续动作 | 扫描结果每行「绑定为宿主」，写入 `.orch/hosts/<id>.json`（`transport:stdio` + `launch.command/args`，参数取自发现的 `acp_args`） |
| 绑定后不知道选哪个 | 无选择面 | 宿主卡片可点选，可用/不可用分别标注；`POST /instances` 带 `hostId` |
| 没有宿主时静默失败 | 只有提交后的机器错误 | 实例页顶部直接说明「还没有绑定宿主」，扫描为空时给出可操作提示 |

新增：`src/studio/host.js`（`listHosts / bindHost / removeHost / hostIdForCli`）、`host.list|host.bind|host.remove` 三个 `/studio/action`、`GET /studio/state` 的 `hosts` 字段、8 个 `STUDIO_HOST_*` 错误码。

### 17.3 修掉的四个真缺陷

| # | 缺陷 | 根因 | 验证 |
|---|---|---|---|
| 1 | 暂停点了没反应 | `GET /instances` 的桌面投影（`routes.js: projectItem`）不带 `paused`；而 `orchestrator.pause` 只把 `paused` 置 true、`state` 仍是 `running`。界面拿不到这个标志，行与页头都停在「运行中」 | 投影补 `paused`，行与页头按标志渲染「已挂起」，控制按钮翻成「继续」 |
| 2 | 暂停会暂停所有实例 | `handleControl` 完全忽略请求体里的 `instanceId`，逐条扫全部实例 | 带 `instanceId` 时只处理该实例；不带时保持原来的汇总语义（托盘路径逐字不变） |
| 3 | 终态实例还挂「暂停」 | 按钮不看状态 | `completed/failed/cancelled` 不再提供暂停/继续；控制被拒时给出中文原因 |
| 4 | 节点看板七个空列 | `boardPage` 把 `columns`（字符串键）当对象读 `column.title`/`column.cards`，且没用 `columnNames`/`cards` | 按 `{columns, columnNames, cards[].column}` 渲染，七列有名字有卡片 |
| 5 | 证据页整块抛异常 | `evidence.js` 直接调 `Buffer.byteLength`，浏览器里 `Buffer` 不存在 → `ReferenceError` | 先试 `Buffer`，再退 `TextEncoder`；Node 侧字节数不变 |
| 6 | 宿主区/画布动作显示英文 | `studioLabels` 只在打开画布时加载，其余页面 `st()` 全部回落英文默认值 | 启动时加载一次 `/studio/labels` |

### 17.4 验收（`scripts/verify-instance-flow.mjs`）

全程真实点击 + 真实输入，不直接调接口：真实 daemon + 真实 Chrome/CDP + **真实 opencode 1.19.6 作为宿主**（`MAESTRO_CLI_BIN` 指向安装目录）。

| 场景 | 断言 | 结果 |
|---|---|---|
| S1 | 实例页明说没有宿主 | PASS |
| S2 | 新建页有宿主区与扫描按钮 → 扫描列出 CLI → 绑定按钮带绝对路径 → 落盘 `{transport:'stdio', launch:{command,args}}` | PASS ×5 |
| S3 | 选模板 + 写任务 + 开始 → 实例真的出现、有 id、目录落盘 | PASS ×4 |
| S4 | 打开实例 → 概览/流程图/看板/证据 四页签都有内容、无脏文本 | PASS ×5 |
| S5 | 暂停 → 显示「已挂起」→ 出现「继续」→ 继续后恢复 | PASS ×4 |

`MAESTRO_CLI_BIN=/tmp/oc-npm/node_modules/.bin` → **25/25 PASS**；不设该变量（本机无 CLI）→ 扫描为空时仍断言「可操作提示」，其余 SKIP，**6 passed / 0 failed**（CI 用 `MAESTRO_REQUIRE_CLI=1` 可强制要求）。

回归：`verify:scenarios` 41/41、`verify:canvas` 15/15、`verify:drilldown` 14/14、`verify:core` 11/11、`verify:ui-flow` 16/16；`test/wp19/host-binding.test.js` 5/5（新增）；桌面四组单测 646 pass / 8 fail，与 HEAD 基线（637/9）红名单**同集**，新增红 0。

### 17.5 仍然不能「配置出来」的部分（不掩盖）

1. **画布/搭建台配好的流程不能直接当实例跑**。新建页的模板仍来自 `GET /workflows`（三条内置图）；`.orch/workflows/*.yaml` 与 Studio 编译产物没有 yaml → 执行图（`nodes[].roleId/order/prompt`）的适配，`resolveTemplate` 找不到就报 `TEMPLATE_UNKNOWN`。要补的是 `src/core` 里一个 `workflowYamlToGraph()` 加 daemon 启动时把项目工作流并入 `graphs`。
2. **Studio 的 `engine` 模式仍只编译不启动**（`engineRun` 写死 `launched:false`），所以「团队 + 角色 + 技能」这套配置目前只影响编译产物，不影响真实实例的派发。
3. **证据页只有产物指针与「完整日志留在宿主」**，没有把宿主会话内容取回渲染；人工干预队列的端到端仍只在 mock 宿主上验证过。
4. 本轮只改本地，**未重发 tag/Release**；要让安装包带上这些修复，需 `desktop:build → verify:app → 推 tag`。

---

## 18. 打包产物验收又抓出三个真缺陷（2026-11-25 晚）

§17 的修复是在**开发态 daemon**上验的。把 `.app` 重新打出来后重跑同一套脚本，又掉出三个只在真实产物上才暴露的问题 —— 都是「用户点了看不到任何反应」这一类。

### 18.1 `row.state` 里装的是中文词，不是状态值

`desktop/ui/list/list.js` 的 `describeListRow` 把 `state` 填成 `wordFor(labels,'INSTANCE_LABEL', phase)` 的结果，也就是**已经翻译好的「已完成」**。而所有按状态分支的地方都在拿它跟英文比：

| 位置 | 症状 |
|---|---|
| `pages.js` 概览页控制区 | `['completed','failed','cancelled'].includes('已完成')` 恒为 false → 跑完的实例上永远挂着一个「暂停」，点了只会回「该实例当前状态不允许这个操作」 |
| `pages.js` 列表筛选 chip | `row.state.toLowerCase() === 'completed'` 恒为 false → 「运行中/已完成」这些筛选永远筛不出东西 |
| `pages.js` 列表行徽章 | `STATE_TONE['已完成']` 恒为 undefined → 所有行的色调都是同一个灰 |

修法：投影补 `stateRaw`（原始快照值），`state` 仍保留中文词给模板渲染；**凡是分支判断一律读 `stateRaw`**，显示仍读 `state`。改在 `list.js`（`describeListRow`）、`pages.js`（筛选、行徽章、概览控制区）、`app.js`（`buildShellContext` 的兜底投影）三处。

### 18.2 「终止」点了什么都不会发生

`beginCancel()` 只把 `{id, texts}` 写进 `state.queueConfirm`，而 v2 壳里**没有任何地方渲染它**：

- `pages.js` 的 `queuePage` 从来没读过 `view.confirm`（旧 painter 有，迁移时丢了）；
- 更根本的是 `app.js:1852` 只在 `view === 'queue'` 时才 `composeQueue`，而「终止」按钮长在**概览页**的控制卡里 —— 就算队列页渲染了，用户在概览页也看不见。

修法：把确认条抽成 `confirmStrip(texts)`，队列页与概览页共用；待确认的取消由 `buildShellContext` 通过 `pendingConfirm` 直接投影给壳，不再依赖只在队列视图才构建的 `model.queue`。

### 18.3 终态实例仍提供「终止」

上一轮只把「暂停/继续」按终态隐藏，`cancel-instance` 是无条件追加的。已完成/已取消的实例点「终止」同样只能得到拒绝。现在三个控制按钮统一按 `stateRaw` 在终态一起隐藏。

### 18.4 验收脚本自己也被修了三处

| 问题 | 症状 | 修法 |
|---|---|---|
| `MAESTRO_CLI_BIN` 指到**文件** | 扫描器按 `目录/bin` 拼路径，传可执行文件路径时永远扫不到 → 误判「本机没有 CLI」 | 文档与用法按**目录**；本轮实测 25/25 → 28/28 |
| `click()` 全文档取第一个同名按钮 | 壳的抽屉里留着一份旧页面副本，点到不可见的那一份，动作静默失败、用例却记在功能头上 | 只点 `getClientRects().length > 0` 的可见节点 |
| 终态断言是「碰巧」才执行 | 原写法等实例自己跑完，跑得快就断言、跑得慢就跳过（实测同一提交时过时跳） | 用「终止」自己造终态（cancel 是本地裁决，毫秒级），终态取值读接口 `phase` 而不是从页面文字里猜（概览页时间线也会出现「已完成」） |

### 18.5 本轮的验收数字

| 套件 | 结果 |
|---|---|
| `verify:instance --app`（真实 opencode 宿主） | **28/28 PASS**，连跑三次稳定 |
| `verify:app`（scenarios / canvas / drilldown / instance-flow） | **41 + 15 + 14 + 28，全绿** |
| `test/wp19` | 5/5 |
| 全量单测 | 2016 条 / 1996 pass / 18 fail |
| 基线树 `origin/main`（`19556e8`） | 2011 条 / 1987 pass / 20 fail |
| **新增红** | **0**（唯一差异 AC-23 #3 是 `git diff HEAD` 型用例，未提交时必红，提交后归零） |

### 18.6 边界（未变）

§17.5 的四条依旧成立：画布产出的流程不能直接当实例模板、Studio `engine` 只编译不启动、证据页不取回宿主会话内容。本轮没有新增能力面，只把「已有按钮点了没反应」补成真的会动。

### 18.7 本轮发布

| 项 | 值 |
|---|---|
| 提交 | `40028e7`（`fix(desktop): stop offering dead controls…`） |
| 发布流水线 | run `45626050188`，7 分 57 秒，三平台全成功 |
| 资产 | `Maestro_0.0.1-beta.4_arm64.dmg` / `_x64.dmg` / `_win-x64-setup.exe` / `SHA256SUMS.txt`（13:49Z 覆盖式补传） |
| Release | prerelease，`draft=false`，`target_commitish = 40028e7`；匿名 `GET /releases/tags/v0.0.1-beta.4` 返回 200、4 个资产 |

同上一版一样，重发走的是「删远端 tag → 重推」。删 tag 会把 Release 打回 draft，而流水线只做 `upload --clobber`（它见 Release 已存在就不 republish、也不改 target/body），所以事后必须手工 `gh release edit --draft=false --prerelease --target <sha> --notes-file`，再用匿名接口核验 —— 否则页面上看到的仍是被删 tag 时那份草稿。
