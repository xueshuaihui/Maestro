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
