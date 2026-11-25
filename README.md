# Maestro · 多会话编排控制台

> Maestro 是一个桌面形态的**多客户端会话控制平面**：常驻系统托盘，后台运行编排守护进程（daemon），通过**统一的 ACP 适配器**在 DeepSeek Harness、Cursor、GPT/Codex、WorkBuddy 等宿主中创建并驱动多个原生会话，每个会话承载一个角色。工具负责角色定义、通用任务工作流编排、会话间唤醒与交接、实例状态管理、治理与审计；Agent 的推理、工具调用和鉴权完全由宿主自己处理。

完整需求基线与迭代规划见 [`docs/index.md`](docs/index.md)。本 README 只描述**已落地**的使用方式、目录结构与开发入口。

---

## 1. 定位与边界

### 1.1 Maestro 是什么

- 桌面应用 + 后台 daemon + 系统托盘 + 可选 Web 入口（Web 入口属于阶段二规划，阶段一不交付）。
- 通过 ACP 原语（`initialize` / `session/new` / `session/prompt` / `session/update` / `session/cancel`）驱动会话，不为每个宿主重写适配器。
- 支持编码与非编码任务：研究分析、内容创作、编码工程、业务运营、通用协调。
- 产物隔离由角色的 `artifact_type` 决定：`code` 走 git worktree，`document` 走版本化文件区，`dataset` 走快照，`report` 走只追加区；**不对非编码任务强制 git 隔离**。

### 1.2 Maestro 不是什么

- 不是 Agent 运行时：不调用模型、不实现推理、不替代宿主。
- 不是新的 IDE：DSH / Cursor 等仍是执行层，Maestro 是并列的控制层。
- 不是编码专用工具：编码只是支持的任务类型之一。
- 核心不实现宿主内核级拦截：单次文件写入、工具权限、鉴权由宿主原生机制负责。

---

## 2. 快速开始

### 2.1 环境要求

| 项 | 要求 | 说明 |
|---|---|---|
| Node.js | `>= 22` | 本机实测 `v22.22.2`；项目**零第三方 npm 依赖** |
| Rust / cargo | 构建桌面壳时需要 | 本机实测 `cargo 1.98.1`；仅用 CLI 不需要 |
| Git | worktree 隔离场景需要 | 代码类角色产物隔离依赖本地 git |
| ACP 宿主 | 至少一种，或使用 mock | 快速验证可直接传 `--host mock` |

### 2.2 CLI 入口

CLI 可执行入口为 `bin/orch.js`，包名 `orch`。不带参数运行会打印当前命令面用法：

```bash
cd Maestro
node bin/orch.js
```

当前已实现的命令族（以实测 `--help` 输出为准）：

```bash
# 运行与查询
node bin/orch.js run --cwd <任务目录> --task <说明> [--instance <实例号>] [--template <single|code-loop|task-loop>] [--host <宿主>]
node bin/orch.js status [--instance <实例号>] [--events]
node bin/orch.js cancel --instance <实例号>
node bin/orch.js core stop

# 角色 / 技能 / 工作流资产
node bin/orch.js role list [--group <组>] [--instance <实例号>] [--format text|json]
node bin/orch.js role show <角色> [--instance <实例号>] [--format text|json]
node bin/orch.js role validate [<角色>] [--format json]
node bin/orch.js role create <角色> [--from <角色>] --name <中文名|继承> --group <组|继承> --artifact-type <类型|继承> --side-effect <等级|继承> [...]
node bin/orch.js role edit <角色> [--set <键=值>]... [--unset <键>]...
node bin/orch.js role export <角色> [--out <文件>]
node bin/orch.js role import <文件> [--force]
node bin/orch.js role diff <角色> [--against <内置角色|文件>] [--format text|json]

node bin/orch.js skill list|show|create|validate|export|import ...
node bin/orch.js workflow list|show|create|validate|diff|dry-run ...
```

**项目根口径**：以当前 shell 目录（`process.cwd()`）为准；`--cwd` 只是任务工作目录，**不参与管道名计算**。因此执行 `orch run --cwd ./demo` 后，直接 `orch status` 就能查到该实例。

> 需求基线中规划的部分命令（如 `orch attach`、`orch escalate`、`orch approve`、`orch trace show` 等）尚未进入当前 CLI 命令面，落地状态以对应迭代 `report.md` 为准。

### 2.3 桌面应用

```bash
npm run desktop:build
```

构建脚本 `scripts/desktop/build.mjs` 纯 Node 实现、零依赖，流程为：生成编译期占位 UI 与图标 → `cargo build --release` → 组装产物 → macOS ad-hoc 签名。

品牌标识（logo）的几何唯一定义在 `scripts/desktop/brand.mjs`：窗口图标 PNG、Windows 多尺寸资源 `icon.ico`、macOS `icon.icns`、界面 favicon、首次启动页与矢量母版 `desktop/ui/brand/mark.svg`（另有 `mark-mono.svg` 单色版、`mark-mono-invert.svg` 深底反白版）全部由它派生，改标识只需改这一处。系统托盘图在 `desktop/src-tauri/src/tray.rs` 内按同一份 64 格几何与抗锯齿规则绘制（Rust 侧无法 import ESM，注释已标注需与 `brand.mjs` 同步）。

| 平台 | 产物 |
|---|---|
| macOS | `desktop/src-tauri/target/release/bundle/macos/Maestro.app` |
| Windows / Linux | `desktop/src-tauri/target/release/maestro`（Windows 为 `maestro.exe`） |

安装包脚本：`node scripts/desktop/package-mac.mjs`、`node scripts/desktop/package-win.mjs`。发布流水线见 [`.github/workflows/release.yml`](.github/workflows/release.yml)：推 `v*` tag 触发三平台矩阵构建、门禁、冒烟、SHA256 汇总与 Release；Actions 手动触发则发布草稿用于试跑。

---

## 3. 架构与目录

```
DSH / Cursor / GPT-Codex / WorkBuddy   ← 执行层：Agent 推理、工具调用、鉴权
                │ ACP 原语
                ▼
Maestro 控制层  ← 角色 / 工作流 / 唤醒 / 交接 / 实例 / 治理
```

| 目录 | 职责 |
|---|---|
| `src/cli/` | `orch` 命令解析、参数白名单与输出渲染；不直接读写 `state.json` |
| `src/core/` | 状态机、编排推进、交接包、升级/审批、证据校验、健康度、追踪；状态迁移唯一入口为 `orchestrator.transit()` |
| `src/daemon/` | IPC/HTTP/SSE 服务、客户端、通知与偏好、队列/资产/占用/画布/证据投影 |
| `src/adapter/` | 通用 ACP 客户端、stdio transport、宿主配置、会话状态归一化、宿主跳转 |
| `src/registry/` | 角色/技能/工作流资产加载、schema 校验、角色实例模型 |
| `src/templates/` | 内置工作流与图定义；**图与角色字面量只允许出现在此目录** |
| `src/persistence/` | 原子写、实例存储、路径计算 |
| `desktop/ui/` | 桌面 UI：实例列表、角色流程图、下钻、队列、资产、占用、画布、证据等纯函数视图模型 + `app.js` 接线 |
| `desktop/src-tauri/` | Tauri 壳：托盘、通知投递、单实例、spawn、ctl 探针 |
| `desktop/harness/` | 无头 dump，供 UI 逐字比对与验收取证 |
| `test/` | 按工作包组织的测试（`wp1` ~ `wp14`）与夹具 |
| `probe/` | S3 逐 AC 用例、验收脚手架与证据聚合 |
| `docs/` | 需求基线、执行模板、各迭代需求/报告/裁决/证据 |
| `assets/` | 内置角色 YAML 定义 |
| `scripts/desktop/` | 构建、门禁、打包、冒烟、版本校验脚本 |

**架构红线**：核心编排逻辑对 ACP 无感知，宿主方言收敛在适配器层；`src/core` / `src/daemon` 与 `desktop/ui` 禁止出现角色、节点类型的硬编码字面量，由 `test/fixtures/purity-check.mjs --forbid` 扫描把关。

---

## 4. 状态模型与运行时布局

### 4.1 四层状态

| 层 | 数量 | 归属 | 用途 |
|---|---|---|---|
| 节点状态 | 9 态（看板 7 列） | 核心裁决 | `blocked / ready / assigned / running / review / done / failed / escalated / cancelled` |
| 会话状态 | 6 态 | 适配器从 ACP 事件归一化 | `idle / thinking / tool_running / waiting_input / waiting_dependency / escalated` |
| 角色状态 | 6 态 | 运行时角色实例 | `inactive / available / busy / cooldown / unavailable / retired` |
| 交接包状态 | 7 态 | 持久化信箱 | `created / delivered / pending / accepted / consumed / rejected / expired` |

主视图是**角色流程图**：角色节点 + 交接连接线 + `human` / `escalate` / `subworkflow` 特殊节点；角色下钻为**局部 DAG + 任务卡片**；节点看板是可选切换。节点级与会话级细节按下钻展开，避免主视图信息过载。

### 4.2 数据布局

```
.orch/
├── roles/  skills/  workflows/        # 宿主无关的定义资产
├── hosts/                             # 宿主 transport 配置（stdio / HTTP+SSE）
├── instances/<id>/
│   ├── workspace/
│   │   ├── shared/  stage/  status.md
│   │   └── artifacts/{code,docs,data,reports}/
│   ├── state/                         # 节点状态、轮次、检查点、角色实例、连接线、traces.jsonl
│   └── graph.json                     # 角色流程图数据快照
├── inbox/                             # 持久化信箱
└── events.jsonl                       # 事件日志（链式哈希）
```

状态以磁盘最新快照为基准做 CAS 迁移；事件先落盘再广播；健康度只在读取状态时计算，不作为独立写入字段。

---

## 5. 开发与验证

### 5.1 测试

```bash
# 推荐命令（Node 22 下 npm test 的 `node --test test/` 会报 MODULE_NOT_FOUND）
NODE_ENV=test TMPDIR=/tmp/maestro-test node --test "test/**/*.test.js"

# 桌面门禁与壳层编译
node scripts/desktop/gate.mjs
cargo check --manifest-path desktop/src-tauri/Cargo.toml
```

> macOS 的 Unix socket `sun_path` 有 104 字节上限，测试与验收夹具应使用短 `TMPDIR`（如 `/tmp/m11-AC`），避免长临时路径导致 `EADDRINUSE` 假阴性。

### 5.2 执行流程

项目按 [`docs/templates/execution-template.md`](docs/templates/execution-template.md) 推进：

| 阶段 | 内容 |
|---|---|
| S0 | 需求文档撰写与评审（模板：`docs/templates/requirement-template.md`） |
| S1 | 任务拆分与模块契约冻结 |
| S2 | 工作包实现、合入与主控核验 |
| S3 | 逐 AC 取证，证据分「通过 / 不通过 / 阻塞」，并标注「真实宿主 / mock 实测 / 阻塞」分级 |
| S4 | 独立终验与报告收口 |

回归红线：`single` / `code-loop` / `task-loop` 三条主链输出逐字不变（交替对照基线做 A-0 归一化 diff）；既有 HTTP 路径与 `shapeSnapshot` 函数体逐字保留；purity 双扫零命中、依赖数 0。

---

## 6. 文档索引

| 文档 | 内容 |
|---|---|
| [`docs/index.md`](docs/index.md) | 完整需求基线、四层状态模型、能力域、边界声明与阶段路线图 |
| [`docs/templates/requirement-template.md`](docs/templates/requirement-template.md) | 迭代需求文档模板 |
| [`docs/templates/execution-template.md`](docs/templates/execution-template.md) | S0~S4 执行与收口模板 |
| `docs/iterations/iteration-N.md` | 第 N 迭代任务拆分与工作包契约 |
| `docs/iterations/iteration-N/requirement.md` | 第 N 迭代定稿需求（AC / BR / NF） |
| `docs/iterations/iteration-N/report.md` | 第 N 迭代实现与验收报告 |
| `docs/iterations/iteration-N/decisions.md` | 实现期与验收期裁决台账 |
| `docs/iterations/iteration-N/{final-verification,acceptance-*}.md` | 独立终验与逐 AC 取证记录 |
| `docs/iterations/integration-*.md` / `regression-*.md` | 多分支集成与三主链逐字回归记录 |

> `docs/index.md` 中的「阶段一实现状态」表是历史快照；某迭代是否收口，以该迭代 `report.md` 与 `final-verification.md` 为准。

---

## 7. 进度与路线图

| 阶段 | 目标 | 状态 |
|---|---|---|
| 阶段零 | ACP 适配器跨 transport + Tauri 桌面壳可行性 | I0.1 报告通过（结论「带约束启动」），补验 I0.2 关闭真实宿主落盘项 |
| 阶段一 | DSH 单宿主完整产品链路 + 桌面应用完整化 | 已推进至 **I1.11**：通知、人工干预队列、资产库、角色占用、工作流画布、证据浏览合入 main，49/49 AC 通过；**I1.12** 治理加固与性能基线待推进 |
| 阶段二 | Cursor 扩展 + Web 入口 | 规划中 |
| 阶段三 | 第三宿主扩展与能力验证 | 规划中 |

最近一次合入（I1.11）的关键数字：**49/49 AC、0 不通过、0 阻塞**；1606 条测试（4 条既有允许失败，差集 0）；588 份证据；三主链逐字 diff 0；独立终验六项 PASS。该迭代无逐 AC 真实宿主面，按 `mock 实测` 分级取证，已在 `docs/iterations/iteration-11/acceptance-product.md` 明示。

---

## 8. 贡献约定

1. 先写需求、再拆包、后实现；验收判据以定稿需求的 AC 为准，不用「变绿」替代真实取证。
2. 真实宿主证据不可伪造；无法取得时按模板判 `阻塞` 并写清尝试路径。
3. 核心状态变更只走 `orchestrator.transit()`；事件先落盘再广播。
4. 图与角色字面量只在 `src/templates/**`；核心与 UI 保持宿主无关。
5. 证据原始帧不得裁剪；门禁 HEAD 必须可达，产物放在紧随其后的提交。
