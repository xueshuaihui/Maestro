# 构建环境搭建与全流程真实验证报告

> 日期：2026-11-24 ｜ 构建版本：`0.0.1-beta.4` ｜ 构建产物：本机 x64 `Maestro.app`
> 触发：用户要求「搭建构建环境 → 构建 → 真实验证每一步是否符合预期 → 含无 CLI 环境 → 再装 CLI 验证」

## 1. 结论

| 验证层 | 结果 | 证据 |
|---|---|---|
| 构建环境 + 真实构建 | **PASS** | cargo/rustc 1.98.1、codesign、Chrome 齐备；`npm run desktop:build` exit 0，产出签名有效的 x64 `.app` |
| 无 CLI 环境完整流程 | **PASS 22/22** | `EXPECT_CLI=none node scripts/verify-journey.mjs` → `JOURNEY_OK (none)` |
| 安装 CLI 后完整流程 | **PASS 22/22** | `EXPECT_CLI=opencode ...` → `JOURNEY_OK (opencode)` |
| 真实 .app 启动链路 | **PASS 6/6** | `npm run verify:shell` → `SHELL_BOOT_OK` |
| 构建产物内代码真实握手 | **PASS** | 用包内 node + orch.js → `acp:true / 1.19.6 / [close,fork,list,resume]` |
| 既有验证链 | **PASS** | `npm run verify:release` → core 11/11 + ui-flow 16/16 + `DESKTOP_BOOT_OK` + `SHELL_BOOT_OK` |

**关键结论**：应用的核心旅程在「无 CLI」和「有 CLI」两种环境下，每一步都符合预期；构建产物本身可启动、可运行、含最新修复。

## 2. 构建环境

| 工具 | 版本 / 状态 | 用途 |
|---|---|---|
| Node / npm | v22.22.2 / 10.9.7 | 构建编排（零 npm 依赖）+ 运行时 |
| cargo / rustc | 1.98.1 | 编译 Tauri shell（Rust） |
| codesign | macOS 系统 | ad-hoc 签名 `.app` |
| Google Chrome | 已安装 | 无头浏览器 + CDP 真实驱动 |
| npm registry | npmmirror（HTTP 200 / 1.4s） | 安装测试用 Agent CLI |

构建命令 `npm run desktop:build` 实际执行：
1. 复制首启 shell UI 到 `frontendDist`，生成图标（PNG/ICO/SVG，纯 Node 零依赖）；
2. `cargo build --release`；
3. 手工组装 `.app`（Rust 二进制 + 内置 node + `bin/`、`src/`、`desktop/ui/` 源码树）；
4. `codesign --force --deep --sign -`。

产物：`desktop/src-tauri/target/release/bundle/macos/Maestro.app`（x86_64），`codesign -v` 通过，版本 `0.0.1-beta.4`。

## 3. 验证方法

三个新/强化的验证层，均通过**真实入口**驱动（不是直调 domain 函数）：

| 脚本 | 驱动的入口 | 覆盖 |
|---|---|---|
| `scripts/verify-journey.mjs` | `serve-entry.js --desktop` + 无头 Chrome/CDP（与 Rust shell 拉起的 daemon 同一入口）；通过 PATH 注入控制 CLI 可见性 | 六步向导每一步：扫描 → 握手 → 组织 → 流程 → 团队 → 运行/门禁 → 知识库/任务 |
| `scripts/verify-shell-boot.mjs` | **真实构建产物** `Maestro.app/Contents/MacOS/maestro --project <root> --probe <file>` | Rust shell → bundled node → daemon → desktop.json → probe 启动序列 |
| 包内源码握手 | 用 `.app/Contents/Resources/runtime/node` + `bin/orch.js` | 构建产物里的代码（含当日 A1 修复）能真实握手 |

`verify-journey.mjs` 每步都读 `/studio/state` 断言实际落盘状态，避免"按钮点了没反应"被漏掉（这是 beta.4 hotfix 的教训）。

## 4. 场景 A：无 CLI 环境的完整流程（22/22）

**环境口径**：本机 PATH 无任何 Agent CLI，但装有 `WorkBuddy.app`（app marker）。按 PRD，扫描应如实列出"已安装但不可达"的条目，而非隐藏。

| 步骤 | 预期 | 实测 | 结论 |
|---|---|---|---|
| S0 冷启动 | 首屏绘制、不卡「正在连接」 | 绘制成功；首屏 `Maestro \| ▦` | ✓ |
| S1 搭建台 | iframe 挂载、扫描按钮可用 | 挂载成功 | ✓ |
| S1 扫描 | 只列 app marker，均不可执行、不误报 acp | `clis=1`（workbuddy），executables=0，`acp:null` | ✓ |
| S1 页面态 | 不停在 TOKEN / 加载中 | 正常 | ✓ |
| S2 握手 | 无可执行 CLI → 跳过 | 跳过（符合预期） | ✓ |
| S3 组织种子 | 23 角色 / 23 员工（perRole=1），绑定到发现的 cliId | `23/23`，cliId=workbuddy | ✓ |
| S4 流程 | rd-12：12 阶段 / 3 门禁 | `flows=1`，gates=[prd-freeze,arch-confirm,release-approve] | ✓ |
| S5 团队 | 创建成功、就绪 | `teams=1`，readiness.ok=true；23 条 `CLI_UNREACHABLE` warning（如实告警，不阻塞） | ✓ |
| S6 运行 | 半自动停在首道门禁 | `status=awaiting-approval`，waiting=`{stage:s02, gate:prd-freeze}` | ✓ |
| S7 批准 | 逐级批准 3 道门禁后完成 | `status=completed`，approvals=3 | ✓ |
| S8 产物/任务 | 知识库落盘、任务生成 | 37 产物文件 / 12 任务 | ✓ |
| S9 稳定性 | 全程无未捕获异常 | 0 异常 | ✓ |

**无 CLI 表现符合预期**：不崩溃、不卡死、不谎报能力；能完整配置并跑通流程；不可达 CLI 以 warning 如实呈现。

## 5. 场景 B：安装 CLI 后的完整流程（22/22）

**环境**：`npm i opencode-ai@1.19.6`（15s / 3 包，npmmirror），其 bin 目录注入 PATH。

| 步骤 | 预期 | 实测 | 结论 |
|---|---|---|---|
| S1 扫描 | 发现 opencode（可执行）+ workbuddy（marker） | `clis=2`，ids=`opencode,workbuddy` | ✓ |
| S2 握手 | 产品 CLI `cli probe` 真实握手成功 | `exit=0, acp=true, version=1.19.6` | ✓ |
| S2 能力 | 提取标准 ACP 能力（本次修复点） | `capabilities=[close,fork,list,resume]` | ✓ |
| S2 页面可见 | 握手结果经 `/studio/state` 对页面可见 | `acp=true, status=connected` | ✓ |
| S3 组织 | 员工绑定到 opencode | `23/23`，cliId=opencode | ✓ |
| S5 就绪 | 无不可达告警（员工都绑到真 CLI） | `readiness.ok=true, warnings=0` | ✓ |
| S6/S7/S8 | 门禁拦停 → 3 次批准 → 完成 → 产物 | 同场景 A，全部通过 | ✓ |

**关键差异**：与无 CLI 场景相比，唯一实质变化是 S2 多了真实握手、S5 的 23 条 `CLI_UNREACHABLE` warning 归零——证明"装了 CLI 后，能力探测与员工绑定真的生效"，而不只是流程空转。

## 6. 真实 .app 启动链路（6/6）

启动 `Maestro.app/Contents/MacOS/maestro --project <root> --probe <file>`（真实构建产物，非源码树）：

| 检查 | 实测 |
|---|---|
| 二进制启动 | pid 记录成功 |
| daemon 拉起 + desktop.json | `port/token/generation/pid` 齐全（daemonPid 真实） |
| probe `launch` / `ready` / `tray-created` | 三条事件齐全，ready 含 daemon pid + 可见窗口 |
| stderr | 无错误输出 |

**构建产物内代码验证**：用包内 `runtime/node` + `bin/orch.js` 执行 `cli add` / `cli probe`，得到 `acp:true / 1.19.6 / capabilities[close,fork,list,resume]` —— 当日 A1 方言/能力修复确已进入产物并生效。

## 7. 验证中修复的问题

验证脚本开发中暴露并修正的问题（均为验证脚本自身，非产品缺陷）：

1. `/studio/action` 请求体是**扁平** `{action, ...fields}`，不是 `{action, payload:{...}}`——修正后 org/flow/team 各步才真正收到参数。
2. `withProbeResults` 把会话能力合并进 `capabilities` 字段，无独立 `sessionCapabilities`——修正断言字段。
3. `rd-12` 内置模板是 semi 模式，门禁拦停由 `team.runMode` 决定——建团队改用 semi 才验证到"门禁拦停 → 逐级批准"这条关键路径。
4. 无 CLI 场景的正确预期是"无**可执行** CLI"（WorkBuddy.app 作为 marker 如实列出），不是"列表为空"。

产品代码本次无需再改（A1 两处修复已在上一提交 `2493200` 完成并进入构建产物）。

## 8. 复现命令

```bash
npm run desktop:build

# 场景 A：无 CLI
EXPECT_CLI=none node scripts/verify-journey.mjs

# 场景 B：装 CLI 后（用一个隔离目录安装，避免污染全局）
T=$(mktemp -d); cd "$T"; npm init -y >/dev/null
npm i opencode-ai --registry=https://registry.npmmirror.com/
cd - >/dev/null
EXPECT_CLI=opencode EXTRA_PATH="$T/node_modules/.bin" node scripts/verify-journey.mjs

# 真实产物启动 + 既有验证链
npm run verify:shell
npm run verify:release
```
