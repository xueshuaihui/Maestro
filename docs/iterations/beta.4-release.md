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
| 真实宿主（本机 Agent CLI）驱动 ACP 会话 | **未取证（非阻塞）** | 本机无目标 CLI 的 ACP 能力，`AD-08` 口径保留 |

**发版结论：可以发。** 阻塞项为 0；未取证的只有"真实宿主执行"，它是环境缺口而不是代码缺口，且从不宣称已发生（`mode: simulate` 产物带显式标注、`engine` 模式的 `no_host_config` 如实上报）。

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
