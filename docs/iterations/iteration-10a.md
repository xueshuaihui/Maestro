# I1.10a 任务拆分与文件级契约（桌面应用壳 + 全局实例列表 + 角色流程图基础）

> 拆分文档版本：**r2**（依据 `docs/iterations/iteration-10a/split-review.md` §6 修复清单 S-01~S-08 修订；r1 → r2 变更行见下方「修订记录」，只改本文档，不动需求 / 评审记录 / decisions.md / 代码）
> 需求依据：`docs/iterations/iteration-10a/requirement.md` **v2**（1249 行，37 条 AC / 32 条 BR / 附录 A~D；S0 评审闭环已 PASS（round2 总判 PASS、阻断 0 / 建议 F-15~F-19），本文档不自行宣布评审通过）
> 上游实现：I1.9 收口 `main@70277df`（全量基线 **1157 tests / 8 条已知失败 / 失败集合差集 = 0**，失败集合登记于 `docs/iterations/iteration-7/baseline-failures.txt`）
> 评审依据：`docs/iterations/iteration-10a/review-round2.md`、`requirement-understanding.md`（§5 Given 可构造性、§9 S1 输入清单）、`decisions.md`（裁决 A~D + 环境事实更正 + 核查记录）
> 拆分自检口径：模板 `docs/templates/execution-template.md` §1.3（0~8 骨架）/ §1.4（WP 四硬规则 + 五字段 + §4 末尾满覆盖表）/ §1.5（10 条自检）/ §1.6（可复制骨架）；形态样板 `docs/iterations/iteration-9.md`（r2，9 WP / 23 文件零交集）
> 契约优先级（模板 §2.8）：`AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > 规划文档 > 代码现状`。代码现状只用于核对签名与调用形态，不作需求来源。

**修订记录（r1 → r2，逐条对应 split-review §6 S-01~S-08）**：

- **S-01（阻断）**：批次由 5 批重排为 6 批——第 4 批 WP-6 单线、第 5 批 WP-8 单线、第 6 批 WP-9；消除「WP-8 依赖 WP-6 却同批并行」的时序矛盾。同步位置：§6 批次表、§7 风险 15、整合检查点批号、各 WP 头部新增批次标注。
- **S-02（阻断，方案 b）**：`src/daemon/http/server.js` 对 `routes.js`（WP-3）/ `http/labels.js`（WP-7）改为**容缺接缝**——注入式 handler 表（`registerRoutes(table)` / `registerLabels(fn)`）+ 惰性动态 import 兜底，**非静态 import，不计入 §6 DAG 边、计入批次后置校验**。同步声明位置：§2.1 `http/server.js` / `routes.js` / `labels.js` 三处契约、§4 WP-2 / WP-3 / WP-8、§6 DAG 说明。
- **S-03（阻断）**：`desktop/harness/graph-dump.mjs` 改为**分阶段交付**——批次 1 只出节点/边（`legend`/`hover` 段容缺 `null`），`legend.js`（WP-5）/ `highlight.js`（WP-6）落地后经惰性动态 import 补齐全量导出（非静态 import，不计入 DAG 边）；AC-07 的图例两行逐字断言自 WP-4 后置移由 WP-5 `legend.test.js` 承担（AC-34 同一 A-8 逐字基线）。同步位置：§2.4、§4 WP-4 / WP-5、AC→WP 表 AC-07 行、§6 DAG 说明。
- **S-04（建议）**：三处计数改为脚本实点：登记文件总数 71 → **73**（S-05 新登记 `index.html` +1、WP-4 括号 4 → 实列 5）、§5 src-tauri 10 文件 → **9 文件**。
- **S-05（建议）**：`desktop/ui/index.html` 登记进 WP-8 负责文件与 §2.2 / §5 契约（静态入口页，被壳 WebView 经 `GET /ui/` 加载，页面加载同包 `app.js`）。
- **S-06（建议）**：§8.5 增 C-08——`scripts/desktop/build.mjs` 登记「新增文件对 D-10 清单的补充」豁免理由（桌面构建脚本，不进 `src/**` 扫描范围、不影响零依赖口径）；需求已定稿，不改 D-10，留 S3/S4 评审复核。
- **S-07（建议）**：WP-6 `graph-collapse.test.js` 增加可读性实测阶段（`$TMPDIR` 独立根直写 `.orch/roles/*.yaml` 13 角色后以 `--host mock` 起一次会话，断言 `buildRoleInstances` 读出 13 角色、group 计数 8/5）；§8.4 增第 3 条登记。
- **S-08（建议）**：§8.1 裁决 B 行补重排依据（引 D-14 末段；WP-1 即验证包，最短打包验证为其首个契约测试动作，语义等价不算推迟）。

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：把已存在于 CLI 的实例、健康度与角色级协作数据第一次搬进一个可双击启动的桌面应用——Tauri 壳常驻托盘、关窗不停守护进程，主窗口给出按健康度分档的全局实例列表，点进任一实例看到角色流程图（五要素角色节点、三类特殊节点、7 态连接线与回流弧线、层次布局与交互、7 列只读看板），数据经本机回环 HTTP/SSE 只读通道实时推送；CLI 与核心逐字零回归、Node 侧零 npm 依赖。

**In scope**（逐条对应需求 §1.3，逐字落位）：

- **In-1 桌面应用壳**：Tauri 可双击启动应用（产物 `desktop/src-tauri/target/release/bundle/macos/Maestro.app`，二进制 `Contents/MacOS/maestro`）；主窗口；系统托盘常驻（菜单固定「打开主窗口 / 退出」两项）；关窗缩托盘、守护进程继续运行；托盘退出前对运行中实例确认一次；重复双击单实例激活已有窗口（AC-01/02/29/31/36；BR-01/02/25/31；附录 D-6/D-14；裁决 B 最短打包验证先行）。
- **In-2 全局实例列表**：六项字段一屏并列、四档分档置顶、空态/不可读行/2 秒实时增减、健康度悬停八类原因句（AC-03/04/32；BR-03~06/23/26；附录 A-1/A-2/A-7）。
- **In-3 新建实例入口**：选工作流 → 填任务说明 → 启动；成功/校验失败/启动失败三路中文反馈（AC-05/06；BR-07；附录 A-5）。
- **In-4 本机数据通道与实时推送**：回环 HTTP 只读接口 + `POST /instances`（唯一写路径）+ 两条 SSE 推送；`desktop.json` 凭据原子写/退出删；rev 白名单与三类推送节流（AC-07~10/27/37；BR-08/19/20/32；附录 D-1/D-2/D-5）。
- **In-5 角色流程图（基础）**：五要素角色节点、三类特殊节点、7 态视觉编码与聚合优先级、层次布局与异常置顶、缩放/平移/聚焦/折叠/拖拽、异常角标+红色脉冲、7 列只读看板、标签策略、图例（AC-11~19/20~25/33~35；BR-09~18/23/27~30；附录 D-3/D-4）。
- **In-6 只读与本地性**：除「新建实例」与界面自身视图偏好外不改任何实例状态、不追加审计事件；通道只绑 `127.0.0.1`（AC-22/27；BR-16/20；附录 D-8）。
- **In-7 本机偏好与配置落点**：`.orch/desktop/views/<instanceId>.json`、`.orch/desktop.json`、`MAESTRO_CONFIG_DIR/projects.json` 三处新增布局（已在需求 §1.3 登记）；**不落盘 `instances/<id>/graph.json`**（裁决 C 豁免成立）。

**Out of scope**（摘要，全表见需求 §1.3 与 `requirement-understanding.md` §1.2）：角色下钻/局部 DAG/任务卡片/节点详情/连接线点击展开（I1.10b）；会话指示器卡片渲染（I1.10b，本迭代只交付节流 + `session.indicator` 事件分类）；通知/人工干预队列/托盘计数与暂停（I1.11）；点击升级跳转（I1.11）；Web 入口/多宿主/远程查看（I2.4）；运行时推进 `human`/`escalate`/`subworkflow` 节点与 `orch run --workflow` 绑定（后续迭代，U-4 已裁决：夹具构造实例满足「拓扑完整」）；真实 DSH 取证（本机保留项，验收 B 类）；多项目窗口/文件夹选择器（U-1）；`graph.json` 落盘（裁决 C）。

> **不夹带规划外能力的显式声明**：桌面通道不新增任何 CLI 子命令；不给 `labels.js` 既有键做任何改动；不做通知、不做多窗口、不做看板写操作、不做 `graph.json` 落盘。实现侧若发现需求未覆盖的细节，按模板 §6 记台账升级，不自行扩范围。

**退出标准**（逐条可判定，含数字或逐字口径）：

1. **37 条 AC 100% 通过 / 0 不通过 / 0 阻塞**：AC-01~AC-37 每条 `**Then**` 均有对应机检 / 夹具 / 架构检查断言通过；规划逐字验收句（857 行）由 AC-26 在夹具现场实跑通过；证据按「AC 号 + 阶段 + 类型」落 `docs/iterations/iteration-10a/evidence/`，每条至少 4 份原始帧；结论三档取「通过」（`mock 实测`），收口不带阻塞。
2. **回归基线不破**：全量测试 `node --test "test/**/*.test.js"` 的**失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 差集 = 0**，测试条数只增不减（基线 **1157 / 8 / 差集 0**，`decisions.md` 核查记录裁决沿用差集口径，**非绝对全绿**）；既有测试文件一律不修改（需求 D-9/D-11）；授权断言修改清单为「无」（D-11）。
3. **既有面逐字不变**：三条主链（`single` / `code-loop` / `task-loop`）终端输出、`orch instance status` / `instance graph` 两种格式、CLI 命令表（`main.js` `COMMANDS`）、两层子命令表（`RUNTIME_SUBS`）、`USAGE_LINES` 25 行、核心 RPC 方法表、`src/cli/labels.js` 既有键全部不动；桌面列表行**不得反向修改 CLI 行**（A-1 明示两行不是同一条行）。
4. **架构门禁**：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词全表>` `exit 0`（新增 `src/daemon/graph.js` / `http/*.js` 自动纳入同一扫描，属覆盖扩大非断言修改）；`--dirs desktop/ui` 同表扫描 `exit 0`；`desktop/ui/**` 与 `desktop/harness/**` CJK 字符零命中；`node -p "Object.keys(require('./package.json').dependencies||{}).length"` 输出 `0`。
5. **D-10 文件边界**：`src/core/**`、`src/cli/main.js`、`src/cli/render.js`、`src/persistence/**`、`src/templates/**`、`src/registry/**` 一行不改（`git show --stat` 逐 WP 核对）；`src/daemon/server.js` / `serve-entry.js` / `labels.js` / `package.json` 只做 D-10 点名的最小改动。
6. **桌面壳冒烟与最短打包验证**：`npm run desktop:build` 产出 `Maestro.app`；WP-1 一页验证结论落 `docs/iterations/iteration-10a/wp1-bundle-verdict.md`（解释器进 bundle 方式定案）；`serve-entry.js --desktop` 起服 → HTTP 探针（带 Bearer 凭据 `GET /ui/labels` 返回 200）→ 关停且 `desktop.json` 被删除。
7. **NFR 全部满足**：NF-1 开屏 ≤3s / 进图 ≤1s、NF-2 角色 ≤500ms / 连接线 1s 合并、NF-3 重连 ≤5s、NF-4 稳定性（10 开关 / 20 切换）、NF-6 无回归、NF-7 零依赖（NF-5 资源占用仅记录实测值不卡点）。

---

## 1. 技术选型（结论 + 被否决项）

> 已核环境事实（`decisions.md` 环境事实更正）：本机 macOS 26.6.2（x86_64）、`rustc/cargo 1.98.1` + Xcode 就位、Node v22.22.2（位于 `~/.workbuddy/binaries/...`，不在 `/usr/bin:/bin`，故 AC-29 的 `which node` 在 `env -i PATH=/usr/bin:/bin` 下非零成立）、npm registry npmmirror。Tauri 本机可构建，不受 `docs/index.md` 698 行 Windows 旧结论约束。

### 1.1 桌面壳选型

**结论**：**Tauri 2.x**（基线 §1.3「Tauri 优先」、阶段零已验证托盘/WebSocket/多窗口）。壳进程只做四件事：① 拉起 daemon 子进程；② 读 `.orch/desktop.json` 完成发现与鉴权；③ 建主窗口（WebView 加载 `GET /ui/`）与托盘；④ 处理关窗/退出/单实例。全部壳依赖只在 Cargo 侧（`tauri`、`tauri-plugin-single-instance`），**Node 侧零 npm 依赖，`package.json` 只追加 `scripts.desktop:*`**，天然满足需求 D-10/BR-22。

- **启动/发现协议**（对齐裁决 A 与 D-1）：壳 spawn `node <bundle 内绝对路径>/src/daemon/serve-entry.js --project <root> --desktop`（裁决 A：桌面入口不经 CLI 命令表，`main.js` 零改动）；轮询读取 `<root>/.orch/desktop.json`（每 100ms，上限 30s）取得 `{port, token, pid, generation, startedAt}`；WebView 首页 URL 即 `http://127.0.0.1:<port>/ui/`；UI 与壳层经 `GET /ui/labels` 取中文文案（含托盘菜单文案 `DESKTOP_TRAY_*`，保证中文唯一来源仍为 `labels.js`）。
- **托盘**：`tray.rs` 只建两项菜单（「打开主窗口 / 退出」）；「退出」先 `GET /instances` 过滤 `running`/`suspended` 计数，>0 时弹确认（A-6 三行逐字），确认后经**既有 IPC 管道发送 `core.stop` 帧**（与 `orch core stop` 同协议，`desktop/src-tauri/src/` 中 `core.stop` 字面量恰 1 处、位于 quit 函数内——AC-02 架构检查），再 SIGTERM 兜底、删 `desktop.json`、结束进程。
- **关窗缩托盘**：拦截窗口 close 事件改为 `hide`（不退出进程）；托盘仍在；daemon 不受影响（AC-02：`daemon.pid` 关窗前后相等）。
- **单实例锁**：`tauri-plugin-single-instance`（Cargo 依赖）；第二次启动激活已有窗口、发出 `activated` 探针事件后自行退出，不初始化第二份 daemon 连接（AC-36）。
- **bundle 内 Node 的获取方式（WP-1 先行验证定案，裁决 B 硬动作）**：**推荐可选项 B——随 bundle 带独立 node 二进制**。构建脚本 `scripts/desktop/build.mjs` 在构建期把本机 Node 22（darwin-x64）二进制复制为 `Contents/Resources/runtime/node`，连同 `bin/`、`src/`、`desktop/ui/` 一起进 bundle；壳 spawn 时用**包内绝对路径**，不读用户 `PATH`。**否决可选项 A（直接依赖系统 `/usr/bin/env node` 并在 D-14 允许用户预装）**：AC-29 的行为判据明确要求「没有预装 Node 的机器（等价夹具 `env -i PATH=/usr/bin:/bin` 且 `which node` 非零）双击可用」，A 在该现场直接失败，且 AC-29 架构检查明令 `grep -REn "env::var\(\"PATH\"\)|Command::new\(\"node\"\)" desktop/src-tauri/src/` 零命中——读 PATH 当启动路径被需求禁止。
- **最短打包验证（裁决 B）**：设为 **WP-1 第一步**（先行验证包）：在动任何其余 WP 前，先验证「解释器 + `bin/` + `src/` 进 bundle、双击可用」可行，产出一页验证结论 `docs/iterations/iteration-10a/wp1-bundle-verdict.md`（含体积与构建时长实测、上述 A/B 取舍依据）；后续 WP（尤其壳行为与 AC-29 判定）依赖该结论。两条实现路径都进不了 bundle → 按裁决 B 回需求修订，不许实现里悄悄消化。

**被否决的方案 + 原因**：

- **Electron**：必然引入 npm `devDependencies`（electron / electron-builder），违反需求 D-10「`dependencies` 与 `devDependencies` 保持为空/不存在」与 BR-22「界面层不引入任何 npm 包」；除非设计出完全不进 `package.json` 的归置方式（如手工下载二进制 + 手写打包），但那等于重造 electron-builder，收益为负；且本机 Electron 反而需要走 npmmirror 镜像拉大包。Tauri 零 npm 依赖天然合规。
- **壳内嵌 Node 运行时（D-14 路径②：守护进程编译进壳）**：daemon 是 ESM 多文件工程，编译进壳需引入打包器（esbuild/ncc 等 npm 依赖）或重写加载协议，违反 D-7「禁构建打包器」与「构建脚本只做复制与 `cargo build`」（D-6）；路径①（bundle 带解释器 + 源码目录）用纯复制即可达成。
- **纯 Web 入口（浏览器访问 `localhost:<port>`）**：属阶段二 I2.4；本迭代必须是「双击图标」的桌面形态（基线 43/47 行）。
- **系统托盘用 WebView 自绘**：关窗后窗口进程隐藏则自绘托盘消失，无法满足「窗口消失、托盘仍在」；必须用原生托盘（Tauri tray API）。

### 1.2 图渲染技术

**结论**：**SVG + 原生 DOM，零框架、零 npm 图库**。布局/视图/看板/标签四个纯模块（`desktop/ui/graph/layout.js`、`view.js`、`legend.js`、`desktop/ui/board/board.js`、`desktop/ui/labels/labels.js`）**不访问 DOM、`fs`、`Date.now`、`window`**（需求 D-4 冻结；AC-17/18 的架构检查 `grep -REn "Date[.]now|fs[.]" desktop/ui/graph/` 零命中是硬门禁）；窗口只是这些纯模块的宿主，验收用 `desktop/harness/*.mjs` 直接 import 同一批模块做逐字断言（需求判定口径 1），不存在第二套渲染逻辑。布局是纯函数：层次只按 `forward` 边最长路径分层，`backflow` 不参与分层、画成反向弧线（弧控制点相对中点向上偏移 40）；同一数据两次布局输出逐字节相同（AC-17）。异常置顶 = `z = abnormal ? 1 : 0`，坐标与尺寸不参与异常计算（AC-18）。

**节点 / 边 / 弧线的数据形状**（对齐需求附录 D-2 的 SSE 帧与 §3 数据模型，字段全表见 §3.4）：

- 节点 `nodes[]`：`{id, type: role|human|escalate|subworkflow|group, title, roleId?, status, statusReason?, activeSessions, servingNodes[], hostIcons[], abnormal, abnormalCount, nodeIds[], memberCount, collapsed, lastActivity}`——角色节点五要素（状态色 / 活跃会话数 / 服务节点 / 宿主图标 / 异常角标）全部由投影字段承载，界面只渲染不重算（AC-11 架构检查：`grep -R "decideStatus" desktop/` 零命中）。
- 边 `edges[]`：`{id, from, to, direction: forward|backflow, aggregateStatus, handoffIds[], parallelCount, latestRound, visual:{color,dash,arrow,animation,badge}, labelVisible}`——7 态视觉 token 由聚合状态映射（服务端 `graph.js` 产出，AC-15）；回流 `direction: 'backflow'` 渲染为 `path.kind === 'arc'` 反向弧线；同向并行合并为一条、`parallelCount > 1` 时标签「N 并行交接」。
- 弧线几何：回流弧 = 二次贝塞尔，控制点取两端节点连线中点向上偏移 40px（D-4 常量）；正向线为直线；异常连接线 token（红实线 + 回流箭头 / 橙虚线 + 感叹号）随 `visual` 字段呈现，脉冲只是 CSS/变换层效果、不改几何尺寸（AC-23）。

**被否决的方案 + 原因**：

- **React / Vue / Svelte 等框架**：引入构建链与 npm 依赖，违反 BR-22 / D-7「禁 UI 框架、禁构建打包器」；纯 DOM + SVG 在本迭代节点规模（≤13 角色 + 组节点）下足够。
- **Canvas 绘图**：文本无法逐字断言（判定口径 1 要求 harness 对文本/结构逐字断言），且无障碍与悬停命中检测都要手写，成本高于 SVG。
- **npm 图库（d3 / dagre / cytoscape）**：零第三方运行时依赖红线（BR-22/NF-7）直接禁止；且 dagre 的布局不可控「同层并行按定义顺序、回流不改层次、两次逐字节一致」（AC-17 的确定性要求）。
- **布局读系统时间 / 文件保证稳定**：AC-17/18 架构检查明令 `layout.js` 零 `Date.now` / 零 `fs`——确定性来自纯函数对同一输入的确定性输出，不来自缓存或时间。
- **`graph.json` 落盘缓存布局**：裁决 C 豁免成立——图是 `state.json` + 事件链的只读内存投影，落盘引入与 `rev` 的双事实源（见 §8）。

### 1.3 其它关键选型（HTTP/SSE 实现、打包与启动方式等）

- **HTTP 服务**：Node 内置 `node:http` + 手写路由（新增 `src/daemon/http/server.js`）；监听 `127.0.0.1:0` 临时端口；token 为 32 字节随机十六进制，`Authorization: Bearer <token>`，缺失/错误一律 `401`（响应体只含错误码，不含实例数据）；先 `listen` 成功再原子写 `<root>/.orch/desktop.json`（复用 `src/persistence/atomic-write.js` 的 `writeJsonAtomic`——只 import 不改该文件），退出（含 `core.stop`）时删除。**被否决**：Express/Koa/Polka 等 —— npm 依赖红线；复用 IPC 管道承载 HTTP —— 管道帧协议（NDJSON）与 HTTP 语义不匹配，且 `server.js` 的 `methods` 表 D-10 冻结不动。
- **SSE 推送**：手写 SSE 帧 `event: <type>\ndata: <json>\n\n`（对照 I1.9 NDJSON 分帧经验，同为按行切分的零依赖文本协议）；两条流（`GET /instances/stream` 500ms 合并、`GET /instances/:id/graph/stream` 首帧全量 + 增量）；重连（新连接）一律先发 `graph.snapshot`。**被否决**：WebSocket —— 需引 ws 库或手写升级握手，SSE 的断线重连语义与全量快照恢复天然对齐（U-5 已裁决取 SSE），用户可见效果等价。
- **推送触发源与节流**：唯一触发源是既有事件总线（`bus.subscribe`，禁 `new EventEmitter` 于 `src/daemon/http/`——AC-08 架构检查）；连接线合并用**可注入时钟的纯调度器**（`now` 参数，单测注入固定时钟断言窗口 1000ms 自首变起算、不后延），禁 `setTimeout` 硬等（AC-09 架构检查）；rev 白名单 = 节点/交接包/升级/实例状态/特殊节点事件，`session.state` / `execution.summary` / `health.changed` 不推进 `rev`（AC-10）。
- **YAML 解析**：复用 `src/registry/yaml-lite.js` 的 `parseYaml` 与 `src/registry/workflows.js` 的加载/投影（`src/registry/**` 不改，只 import）。**被否决**：js-yaml 等新 YAML 库 —— D-7 明令禁止。
- **打包与启动方式**：`npm run desktop:build` = `scripts/desktop/build.mjs`（纯 Node 脚本：复制 `bin/` `src/` `desktop/ui/` 与 node 二进制进 `desktop/src-tauri/resources/` + `cargo build --release`），产物固定 `desktop/src-tauri/target/release/bundle/macos/Maestro.app`；不引入任何 npm devDependency。**被否决**：tauri CLI（npm 包）—— 会把 `@tauri-apps/cli` 写进 package.json，违反零依赖；用 cargo 直接构建 + 手写资源复制等价达成。
- **测试接缝**：`--probe <文件>`（追加式 JSONL 事件）与 `--ctl <目录>`（文件出现即触发、触发后改名 `.done`）只在显式传参时启用（D-6）；`POST /__test__/graph/pulse` 仅 `NODE_ENV=test` 注册、只改内存测试投影（D-9）。
- **夹具启动方式（纪要黄色警示 1）**：凡涉及 AC-01/26/29/31/36 的壳夹具，**一律直接执行 bundle 内二进制 `Maestro.app/Contents/MacOS/maestro --project ... --probe ... --ctl ...`**，禁用 `open -na`——LaunchServices 不继承 shell 环境变量，`NODE_ENV=test` / `MAESTRO_CONFIG_DIR` 注不进去；AC-29 本就要求 `env -i` 启动，只有直接执行才能控制环境。该口径写进 WP-1/WP-8 夹具规范（见 §8）。

---

## 2. 模块划分与文件级接口契约

> 逐文件给出「新增 / 改、导出签名、被谁 import、由哪个 WP 负责」。标注「改」的 4 个既有文件（`server.js` / `serve-entry.js` / `labels.js` / `package.json`）是 D-10 点名的最小改动面，各自唯一负责 WP；标注「不改」的目录是**只读基线、不算任何 WP 的负责文件**（满足零交集自检）。所有新增 / 改文件：零中文（`desktop/ui/**`、`desktop/harness/**`、`src/daemon/**` 禁 CJK，中文经 `GET /ui/labels` 下发）、零 31 禁词、零 `if host ==` / `switch (host)` 分支。

### 2.1 daemon 侧（WP-2 / WP-3 / WP-4 / WP-7）

- `src/daemon/server.js`（**改**，WP-2）—— D-10 授权段：只新增可选参数 `http`（默认 `false`）与「启动/关闭 HTTP 监听」的挂钩（`http: true` 时调用 `src/daemon/http/server.js` 的 `createHttpServer` 并挂到生命周期：`close()` 时一并关 HTTP、删 `desktop.json`）；`methods` 表、错误映射、`shapeSnapshot`、`instance.trace`、事件订阅逻辑一行不改。
- `src/daemon/serve-entry.js`（**改**，WP-2）—— 只新增 `--desktop` 参数解析（现 `parseArgs` 已可承接布尔旗标）并把它传给 `createServer({ ..., http: args.desktop === true })`；`loadOrchestrator` 与降级桩不改。
- `src/daemon/http/server.js`（新增，WP-2）—— `export function createHttpServer({ root, orchestrator, bus, graph, logger, clock })` → `{ listen(): Promise<{ok:true, port, token}>, close(): Promise }`。职责：绑定 `127.0.0.1:0`；生成 token（`node:crypto.randomBytes(32).toString('hex')`）；Bearer 鉴权中间件；原子写/删 `desktop.json`（desktop.json 路径常量在此文件定义——`src/persistence/paths.js` D-10 冻结不改，不得新增路径函数）；静态服务 `GET /ui/*`（bundle 内取 `resources/desktop/ui`，开发态回退仓库 `desktop/ui`，只读）；SSE 分派给同包 `stream.js`（同批静态 import）；**REST 与 `/ui/labels` 为容缺接缝（S-02）**：导出 `registerRoutes(table)` / `registerLabels(fn)`（注入式 handler 表，table 形状 `{ method, pattern, handler }[]`），并内置惰性动态 `import('./routes.js')` / `import('./labels.js')` 兜底——批次 2 阶段 `routes.js`（WP-3，批次 3）尚未落地时，静态资源、`desktop.json` 生命周期仍可用，REST 返回结构化 `503 {"error":"NOT_READY"}`（不含实例数据）；`routes.js` / `labels.js`（WP-7，批次 1，先于本包落地）就位后由惰性 import 自动承接，无需任何跨包改文件。该依赖为**注入依赖，非静态 import：不计入 §6 DAG 边、计入批次后置校验**（§6 说明）。约束：不出现中文；`grep -REn "saveState|instance-store|appendSpan" src/daemon/http/` 零命中；被 `server.js`（WP-2）import。
- `src/daemon/http/stream.js`（新增，WP-2）—— `export function createStreamHub({ bus, buildGraphSnapshot, clock })` → `{ handleListStream(res), handleGraphStream(res, {instanceId, sinceRev}), handlePulse(req, res) }`；另导出纯调度器 `export function createConnectionThrottle({ windowMs = 1000, now })` → `{ push(key, payload), flush() }`（窗口自该键第一次变更起算、不后延、推最后一次；注入时钟可单测）。职责：两条 SSE 流、首帧 `graph.snapshot`、增量事件、`rev` 白名单推进、`session.indicator` 原样透传不推进 rev、`POST /__test__/graph/pulse`（仅 `NODE_ENV=test` 注册，只改内存测试投影）。约束：`grep -REn "new EventEmitter" src/daemon/http/` 零命中；被 `http/server.js` import。
- `src/daemon/http/routes.js`（新增，WP-3）—— `export function createRoutes({ orchestrator, loadWorkflowDef })` → `async handle(req, res, url)`。实现 `GET /instances`（只消费 `instance.list` + `instance.get`，不重算健康度）、`POST /instances`（透传 `orchestrator.startRun`，`cwd` = 项目根、`earlyReturn: true`，请求体上限 32KB）、`GET /instances/:id/graph`（读盘解析工作流定义：`workflowRef` → `<root>/.orch/workflows/<ref>.yaml`（经 `yaml-lite`）→ 内置模板 → 空图标 `workflow.readable=false`；再调 `graph.js` 纯投影）、`GET /workflows`（只列三个内置模板）。约束：`startRun` 命中必须全部落在本文件（POST /instances 处理器）；与 `http/server.js` 的接缝为 **S-02 容缺接缝**——本包（批次 3）落地后由 `http/server.js` 惰性动态 import 自动注册进 handler 表（测试可经 `registerRoutes(table)` 直接注入假路由），**非静态 import、不计入 DAG 边、计入批次后置校验**（批次 3 整合检查点断言 REST 路由可用）。
- `src/daemon/http/labels.js`（新增，WP-7）—— `export function labelKeysPayload()` → `{ keys: { "<KEY>": "<文案模板>" } }`（键集合 = 需求 A-14 全表，经 import `src/cli/labels.js` 读取——daemon 读 CLI 文案模块属需求 D-2/D-7 明确设计：中文唯一来源不变，只是新增「下发」通道）；与 `http/server.js` 的接缝同 **S-02 容缺接缝**（`registerLabels(fn)` 注入 / 惰性动态 import 承接，**非静态 import、不计入 DAG 边**）；本包为批次 1、先于 WP-2 落地，批次 2 起 `GET /ui/labels` 即全量可用。
- `src/daemon/graph.js`（新增，WP-4）—— **纯投影**：`export function buildGraph({ state, workflowDef, roles, traces, now })` → `{ rev, nodes, edges, workflow }`；另导出常量 `AGGREGATE_PRIORITY`（`rejected > expired > pending > delivered > accepted > consumed > not_started`）与 `EDGE_VISUAL`（A-11 token 表）、`REV_WHITELIST`（rev 白名单事件 reason 集）。规则照 D-3：不读盘、不写盘、不取系统时间（`now` 由调用方传入）；`role` 以角色实例为单位（消费 `buildRoleInstances` 形状，缺注册表按「图声明即已知」）；`human`/`escalate` 读定义 `node_type` + `state.nodes` 缺失按 `pending`；`subworkflow` 折叠组（`memberCount` 为子定义 role 去重数，子定义缺失 `memberCount: null` 灰色）；`group` 仅可见角色 > 12 时生成；未知 `node_type` 按 `role` 渲染不丢节点；边端点为角色按角色实例聚合、同 `(from,to,direction)` 合并、无交接包按 `not_started`；健康度直读 `state.health` 不重算；`lastActivity` 取 traces 该角色最新 `end_time` 回落 `state.updatedAt`。被 `routes.js` / `stream.js`（经注入的 `buildGraphSnapshot`）import。

### 2.2 界面纯模块（WP-5 / WP-6 / WP-3 / WP-8）

- `desktop/ui/graph/layout.js`（新增，WP-5）—— `export function computeLayout(graph, { canvas })` → `{ nodes:[{id,x,y,width,height,layer,z}], edges:[{id, path:{kind:'straight'|'arc', ctrl?}}] }`。常量：宽 180 / 高 80 / 层间距 240 / 行距 140 / 弧高 40；`forward` 最长路径分层、同层按 `order` → 节点 ID 稳定排序；`z = abnormal ? 1 : 0`；确定性纯函数（禁 DOM/fs/`Date.now`/`window`）。被 `app.js` / `layout-dump.mjs` / 各图测试 import。
- `desktop/ui/graph/view.js`（新增，WP-5）—— `export function createViewState(initial)` → `{ setZoom(v)（夹取 0.5~2.0）, setPan(x,y), reset()（100%/(0,0)/清拖拽）, screen(node)（变换矩阵）, focus(nodeId, hops=2)（无向 BFS，只过滤可见集合不改坐标）, applyOffsets(offsets), clearOffsets() }`。纯状态机，文件 IO 不在此（views 落盘走壳层 `config.rs` 命令或夹具直写）。被 `app.js` / `layout-dump.mjs` import。
- `desktop/ui/graph/legend.js`（新增，WP-5）—— `export function renderLegend(labels)` → `{ anchor:'bottom-left', lines:[A-8 两行] }`；锚点只由画布尺寸决定。被 `app.js` / `legend.test.js` import。
- `desktop/ui/board/board.js`（新增，WP-5）—— `export function projectBoard({ state, graph, labels })` → `{ columns:['blocked','ready','running','review','done','failed','escalated'], cards, cancelledFold:'已取消 N', unknownTag:'状态未知' }`；`pending` 按「全部 forward 前驱 done（或无前驱）→ ready 否则 blocked」派生；`cancelled` 折入 done 列折叠计数；未知状态落 blocked 标「状态未知」（显式默认分支不抛异常）。被 `app.js` / `board-dump.mjs` import。
- `desktop/ui/graph/collapse.js`（新增，WP-6）—— `export function autoCollapse(nodes, { threshold = 12 })` → 组节点集合（键只取角色 `group`，缺失落「未分组」）；`export function toggleGroup(view, groupId)`；展开后成员回原层原序、组间边改连组节点。被 `app.js` import。
- `desktop/ui/graph/style.js`（新增，WP-6）—— `export function elementStyle(element, { hoveredKey })` → `{ opacity, z, animation }`；脉冲只是动画 token，不改几何；异常解除立即消失。被 `app.js` / `abnormal-style.test.js` import。
- `desktop/ui/graph/highlight.js`（新增，WP-6）—— `export function hoverSet(graph, key)` → `{ opaqueIds, dimIds }`（邻接派生：悬停节点取全部上下游线+两端节点，悬停线取两端；其余降不透明度）。被 `app.js` / `hover-highlight.test.js` import。
- `desktop/ui/graph/node-rows.js`（新增，WP-6）—— `export function renderRoleRow(node, labels)` → A-9 行（`N 个活跃会话`、`服务 T-001, T-002`、>2 折叠「服务 T-001 等 N 个」、`×N` 堆叠、宿主空格并列、`异常 N`）；`export function renderSpecialRow(node, labels)` → A-10 行（人工/升级/子工作流全角冒号/分组/角色数未知）。类型只读定义层 `node_type` 不按标题猜。被 `app.js` / `role-node.test.js` / `special-node.test.js` import。
- `desktop/ui/graph/edge-rows.js`（新增，WP-6）—— `export function renderEdgeRow(edge, labels)` → A-11 文本投影行（`连接线 开发→测试 · 正向 · 已投递`、并行「N 并行交接」、`accepted` 悬停「已接受 · 处理中」）。被 `app.js` / `edge-visual.test.js` import。
- `desktop/ui/labels/labels.js`（新增，WP-6）—— `export function resolveLabels(payload)`（键查找与模板占位替换）；`export function visibleLabels(edges, hoveredKey)` → 默认可见集 = `{rejected, expired, pending}`，悬停把该线加入。被 `app.js` / `labels-policy.test.js` / 各行渲染模块 import。
- `desktop/ui/list/list.js`（新增，WP-3）—— `export function sortInstances(items)`（需关注→慢→正常→已结束，同档 `updatedAt` 倒序）；`export function renderListRow(instance, labels)` → A-1 行（六项固定顺序，`待处理 0` 也显示）；`export function renderListEmpty()` → `实例 无`；`export function renderListUnreadable(id)` → `实例 {id} · 状态不可读`（复用既有文案键，不新造）。被 `app.js` / `render-list.mjs` import。
- `desktop/ui/list/new-instance.js`（新增，WP-3）—— `export function validateNewInstance({ template, task }, labels)` → `{ ok, message? }`（「请选择工作流」「请填写任务说明」，工作流规则错误透传既有 `ERROR_TEMPLATE` 原文）；`export function buildStartRequest({ template, task })` → POST body。被 `app.js` / `new-instance.test.js` import。
- `desktop/ui/list/health-hover.js`（新增，WP-3）—— `export function renderHealthHover(health, labels)` → A-7 原因句（经 `HEALTH_LINE`/`HEALTH_REASON` 模板 + `health.reasons` 参数渲染，只透传不重算）或无原因时 `健康度 正常`。被 `app.js` / `health-hover.test.js` import。
- `desktop/ui/app.js`（新增，WP-8）—— 视图装配与路由：`export function mountApp({ root, labels, modules })` → 实例列表页 / 流程图页（SVG 画布 + 工具栏）/ 节点看板页 / 项目提示页之间的切换；承载键盘（Esc 退出聚焦）、工具栏（复位视图/显示未开始连接线/展开收起分组）、推送帧消费（按事件类型分流：role/edge/special → 局部重绘，session.indicator → 不重绘）、悬停与拖拽事件绑定、拖拽结束把偏移交给壳层落盘。被 `index.html`（bundle 资源）加载；与 AC-07/14 同批模块（禁测试专用渲染分支）。
- `desktop/ui/connection.js`（新增，WP-8）—— `export function createConnectionState({ connect, now, timeoutMs = 10000 })` → 状态机 `connecting → ready / reconnecting / failed`；文案键 `DESKTOP_CONN_*`（A-4 三态，含 F-17 瞬态「正在连接守护进程…」）；断线保留最后一次内容 + 重连后取全量快照。被 `app.js` / `errors.test.js` import。
- `desktop/ui/index.html`（新增，WP-8，S-05 登记）—— 静态入口页（bundle 资源），无 JS 导出；由壳 WebView 经 `GET /ui/` 加载（WP-1 静态服务），页面内以 `<script type="module">` 加载同包 `app.js`（经 HTTP 静态服务而非 file://，保证 labels 下发通道一致）；零中文（文案全部经 `/ui/labels` 下发）。
- `desktop/ui/project.js`（新增，WP-8）—— `export function resolveProject({ argRoot, envRoot, remembered })` → `{ view:'instances'|'project-missing'|'project-invalid', message }`（优先级 `--project` > 环境变量 > 已记住项目 > 首次填写，U-1）；文案键 `DESKTOP_PROJECT_*`（A-3 逐字）。被 `app.js` / `project-guard.test.js` import。

### 2.3 壳层 Rust 与打包（WP-1）

- `desktop/src-tauri/Cargo.toml`（新增）—— tauri 2.x + `tauri-plugin-single-instance`；依赖只在 Cargo 侧。
- `desktop/src-tauri/tauri.conf.json`（新增）—— 窗口/托盘/资源目录配置；bundle 资源含 `resources/{runtime/node, bin/, src/, desktop/ui/}`。
- `desktop/src-tauri/build.rs`（新增）—— tauri-build 标准构建脚本。
- `desktop/src-tauri/src/main.rs`（新增）—— 启动序列：解析 `--project` / `--probe` / `--ctl` → `single_instance::init` → `spawn::spawnDaemon` → 轮询 `desktop.json` → `probe::event("ready", {window, view, t})` → 建窗加载 `http://127.0.0.1:<port>/ui/` → `tray::init`；close 事件拦截为 hide；quit 流程经 `tray.rs`。约束：不含 `env::var("PATH")` / `Command::new("node")`（AC-29 架构检查零命中）。
- `desktop/src-tauri/src/spawn.rs`（新增）—— `pub fn spawnDaemon(project: &Path) -> DaemonChild`：用 `resource_dir/runtime/node` 包内绝对路径 spawn `src/daemon/serve-entry.js --project <root> --desktop`；不读 PATH；退出时经 IPC 管道发 `core.stop` + SIGTERM 兜底（`core.stop` 字面量全 crate 恰 1 处，位于 quit 函数内——AC-02 架构检查）。
- `desktop/src-tauri/src/tray.rs`（新增）—— 两项菜单（文案经 `GET /ui/labels` 取 `DESKTOP_TRAY_OPEN` / `DESKTOP_TRAY_QUIT`）；「打开主窗口」show+focus；「退出」查运行中实例 → 确认框（A-6 逐字）→ 走 quit 流程。
- `desktop/src-tauri/src/probe.rs`（新增）—— `--probe` 追加式 JSONL 事件（`ready` / `close-window` / `tray-still-present` / `quit-confirm-shown` / `quit` / `tray-open` / `activated` / `tray-created` / `rows` / `graph-shown` 等，均带毫秒 `t`）；`--ctl` 目录监视：`close-window` / `tray-open` / `tray-quit` / `tray-quit-confirm` / `open-instance/<id>` 文件出现即触发同函数、触发后改名 `.done`。仅显式传参时启用，生产启动不写探针。
- `desktop/src-tauri/src/single-instance.rs`（新增）—— `tauri-plugin-single-instance` 接线：第二进程激活已有窗口、探针记 `activated` 后自行退出。
- `desktop/src-tauri/src/config.rs`（新增）—— `MAESTRO_CONFIG_DIR` 下 `projects.json` 读写；`.orch/desktop/views/<instanceId>.json` 读写（Tauri command 供 UI invoke，实例删除/重建后按实例号失效忽略——AC-22 异常态）。
- `scripts/desktop/build.mjs`（新增）—— 纯 Node 构建脚本：复制 `bin/` `src/` `desktop/ui/` 与本机 node 二进制 → `desktop/src-tauri/resources/` → `cargo build --release`；零 npm 依赖。
- `package.json`（**改**，WP-1）—— 只追加 `scripts["desktop:build"]`（及可选 `desktop:dev`）；`dependencies` / `devDependencies` 保持为空/不存在（D-10）。

### 2.4 文案与测试（WP-7 / 各 WP）

- `src/cli/labels.js`（**改**，WP-7）—— 只在文件末尾追加 A-14 全表键：`DESKTOP_LIST_ROW` / `DESKTOP_LIST_FIELD_*` / `DESKTOP_PROJECT_MISSING` / `_INVALID` / `DESKTOP_CONN_CONNECTING` / `_RECONNECTING` / `_FAILED` / `DESKTOP_NEW_*` / `DESKTOP_TRAY_*` / `DESKTOP_QUIT_CONFIRM` / `DESKTOP_LEGEND_ROLE` / `_SPECIAL` / `DESKTOP_ROLE_ROW` / `_SERVING_MORE` / `_SESSION_STACK` / `DESKTOP_HUMAN_ROW` / `_ESCALATE_ROW` / `_SUBFLOW_ROW` / `_GROUP_ROW` / `DESKTOP_EDGE_ROW` / `_PARALLEL` / `DESKTOP_VIEW_*` / `DESKTOP_BOARD_COLUMNS` / `_CANCELLED_FOLD` / `_UNKNOWN_STATE` / `DESKTOP_GRAPH_MISSING` / `_DEF_UNREADABLE` / `_SUBFLOW_UNKNOWN`；既有键、`USAGE_LINES`、健康度/追踪文案零改动。
- 测试文件 31 个（新增，全部 `test/wp13/`，归属见 §4 各 WP 负责文件清单；既有测试文件一律不改，D-9/D-11）。
- harness 5 个（新增，`desktop/harness/`）：`collect.mjs`（WP-3，读 `.orch/desktop.json` 凭据取 `GET /instances` 落 JSON）、`render-list.mjs`（WP-3，import `desktop/ui/list` 纯模块输出列表行）、`layout-dump.mjs`（WP-5，import `layout.js`/`view.js` 对 payload 出布局 JSON）、`board-dump.mjs`（WP-5，import `board.js` 出看板 JSON）、`graph-dump.mjs`（WP-4，**分阶段交付（S-03）**：批次 1 只对图 payload 出节点/边导出，`legend` / `hover` 段容缺为 `null`；`legend.js`（WP-5，批次 3）与 `highlight.js`（WP-6，批次 4）落地后经**惰性动态 import** 自动补齐全量导出——非静态 import、不计入 DAG 边、计入批次后置校验，批次 4 整合检查点断言全量导出非 `null`）。均只 import `desktop/ui` 纯模块、自身可做文件 IO。

### 2.5 只读基线（不改，不算负责文件 —— D-10 硬边界重申）

`src/core/**`（含 `orchestrator.js` / `health.js` / `trace.js` / `event-bus.js`）、`src/cli/main.js`、`src/cli/render.js`、`src/persistence/**`（含 `paths.js` / `instance-store.js` / `atomic-write.js`——只 import 不改）、`src/templates/**`、`src/registry/**`（`yaml-lite.js` / `workflows.js` / `role-instances.js` 只 import）、`test/**` 既有文件、`test/fixtures/**`、`bin/orch.js`、`docs/index.md`。本迭代没有任何「必须改核心」的理由；实现中发现必须改 → 先回来改需求（D-10）。

> 代码现状核对结论（写入契约的依据）：`server.js:44` `createServer({root, orchestrator, bus, generation, pipeName, logger, clock, exitOnStop})` 现无 `http` 参数——与 D-10「只新增可选参数」相符；`serve-entry.js:24` `parseArgs` 已能承接布尔旗标 `--desktop`；`paths.js` 无 desktop.json / views 路径函数且**不得新增**（D-10 冻结），两处路径常量落 `src/daemon/http/server.js`（desktop.json）与 `desktop/src-tauri/src/config.rs`（views / projects.json）；`health.js` 导出 `computeHealth({state, graph, traces, now})` 与八类原因码冻结表（A-7 一一对应）；`trace.js` 导出 `readTraces` 等（lastActivity 只读投影的数据源）；`orchestrator.js:4194` `getStatus` 读取时重算健康度路径不动，`startRun` / `listInstances` 经既有方法表消费。

---

## 3. 数据模型

> **唯一事实来源**（裁决 C 落实）：图投影**不落盘**——`instances/<id>/graph.json` 不存在（U-9 豁免成立），图是 `state.json` + 事件链的内存只读投影，随时可重建。本迭代新增落盘面仅三处：① `<root>/.orch/desktop.json`（凭据，启动原子写、退出删）；② `<root>/.orch/desktop/views/<instanceId>.json`（视图偏好）；③ `MAESTRO_CONFIG_DIR/projects.json`（记住的项目根）。以下样例为**形状说明**，时间戳 / token / 端口 / 实例号为示意值；用户可见逐字文案以附录 A-0~A-14 为准。

### 3.1 `.orch/desktop.json`（凭据，异常态：文件缺失 = 通道未就绪）

```json
{ "port": 53417, "token": "9f2c7a1e4b8d4c0fa3e6d5b2c1f0a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2", "pid": 48211, "generation": "gen-7c1f2a9b", "startedAt": "2026-11-12T09:00:00.000Z" }
```

- 写入顺序：先 `listen` 成功、再原子写；写失败视为桌面通道启动失败、不影响 IPC 主通道（D-1）。退出（含 `core.stop`）时删除。无凭据请求一律 `401`，响应体只含 `{"error":"UNAUTHORIZED"}` 类英文错误码。

### 3.2 `.orch/desktop/views/INST-001.json`（视图偏好，含异常态）

```json
{ "offsets": { "T-002": { "dx": 40, "dy": 60 } }, "updatedAt": "2026-11-12T09:05:00.000Z" }
```

- 读取时叠加到基础坐标；复位视图清除偏移；实例删除/重建后按实例号失效即忽略、不报错（AC-22）；不同实例互不影响；**不写实例状态、不追加审计事件**（BR-16，AC-22 以 `state.json` / `events.jsonl` 字节哈希不变兜底）。

### 3.3 `MAESTRO_CONFIG_DIR/projects.json`（记住的项目根）

```json
{ "projects": ["/tmp/maestro-i10a-acceptance"], "updatedAt": "2026-11-12T09:00:00.000Z" }
```

- 由夹具直接写入或经壳层 `config.rs` 写入；`--project` 参数优先于它；无此文件且无 `--project` → 界面走「项目 未指定」提示页（AC-31）。

### 3.4 图快照响应体 `GET /instances/:id/graph`（内存投影，节选：含特殊节点 + 回流并行边）

```json
{
  "rev": 42,
  "instanceId": "INST-001",
  "template": "code-loop",
  "state": "running",
  "workflow": { "ref": "release-flow", "readable": true },
  "nodes": [
    { "id": "role:dev", "type": "role", "title": "开发", "roleId": "dev", "status": "serving", "activeSessions": 2, "servingNodes": ["T-001", "T-002"], "hostIcons": ["dsh", "cursor"], "abnormal": true, "abnormalCount": 1, "collapsed": false, "lastActivity": "2026-11-12T09:04:10.000Z" },
    { "id": "H-001", "type": "human", "title": "人工验收", "status": "pending", "abnormal": false },
    { "id": "S-001", "type": "subworkflow", "title": "发布子流程", "nodeIds": ["role:a", "role:b", "role:c"], "memberCount": 3, "abnormal": false, "collapsed": true }
  ],
  "edges": [
    { "id": "E-01", "from": "role:dev", "to": "role:qa", "direction": "backflow", "aggregateStatus": "rejected", "handoffIds": ["HO-004"], "parallelCount": 1, "latestRound": 2, "visual": { "color": "red", "dash": "solid", "arrow": "back", "animation": "none", "badge": null }, "labelVisible": true },
    { "id": "E-02", "from": "role:dev", "to": "role:qa", "direction": "forward", "aggregateStatus": "delivered", "handoffIds": ["HO-001", "HO-003"], "parallelCount": 2, "visual": { "color": "blue", "dash": "solid", "arrow": "forward", "animation": "flow", "badge": null }, "labelVisible": false }
  ]
}
```

- `rev` 取白名单事件（节点状态/交接包/升级/实例状态/特殊节点）最大事件序号；`session.state` / `execution.summary` / `health.changed` 不推进；无白名单事件为 0（D-2）。

### 3.5 SSE 帧样例（`GET /instances/:id/graph/stream`）

```
event: graph.snapshot
data: {"rev":42,"instanceId":"INST-001","type":"snapshot","key":null,"payload":{ "...同 3.4 全量..." }}

event: connection.updated
data: {"rev":43,"instanceId":"INST-001","type":"connection","key":"E-02","payload":{"aggregateStatus":"expired","visual":{"color":"orange","dash":"dashed","arrow":"forward","animation":"none","badge":"!"}}}

event: session.indicator
data: {"rev":42,"instanceId":"INST-001","type":"session.indicator","key":"mock-sess-12345-1","payload":{"state":"tool_running"}}
```

- 连接线帧经 `createConnectionThrottle` 合并：同 key 1 秒窗口只出一帧、值为最后状态；角色帧即时透传（≤500ms）；`session.indicator` 原样透传且 `rev` 不变。断线重连首帧恒为 `graph.snapshot` 全量。

### 3.6 测试投影（pulse 接缝，仅内存）

`POST /__test__/graph/pulse`（仅 `NODE_ENV=test` 注册）：

```json
{ "instanceId": "INST-001", "kind": "connection", "key": "E-02", "count": 5, "intervalMs": 40, "statuses": ["accepted", "pending", "rejected", "consumed", "expired"] }
```

- `kind: role|connection|session` 三分支；只改内存测试投影并合成对应事件、不写盘——与 AC-27 的文件哈希断言天然兼容（不同 AC 仍用独立项目根，纪要 §5.1-4）。

### 3.7 夹具工作流 `.orch/workflows/release-flow.yaml`（节选：四类 node_type + 回流边）

```yaml
workflow: release-flow
title: 发布流程
nodes:
  - id: T-001
    node_type: role
    role: dev
    order: 0
  - id: H-001
    node_type: human
    title: 人工验收
    order: 1
  - id: S-001
    node_type: subworkflow
    title: 发布子流程
    workflow: publish-child
    order: 2
  - id: T-002
    node_type: role
    role: qa
    order: 3
edges:
  - { from: T-001, to: H-001 }
  - { from: H-001, to: S-001 }
  - { from: S-001, to: T-002 }
  - { from: T-002, to: T-001, kind: backflow }
```

- registry 四类 `node_type`（role/human/escalate/subworkflow）合法已由主控核查（`src/cli/labels.js:552` `WORKFLOW_NODE_TYPE_INVALID`），夹具 yaml 直接写盘不经校验器、无需改 registry（`decisions.md` 核查记录，§8 登记）。折叠 AC 夹具另备 `.orch/roles/*.yaml` 13 角色（8 `group: coding` + 5 `group: research`）。

### 3.8 `state.json` 健康度节选（列表与图直读，不重算）

```json
"health": { "level": "attention", "reasons": ["pending_escalation"], "computedAt": "2026-11-12T09:05:00.000Z", "nodeTimeoutMs": 30000 }
```

- AC-32 的 9 份夹具 `health.level` / `health.reasons` 直接取 I1.9 既有判定结果，夹具不重算（D-8）；快照统一带 `schemaVersion: 2`，夹具按「先空根拉起核心 → 再写盘 → 最后开界面」铁序构造（§3.3 769 行）。

---

## 4. 工作包拆分（WP-1 ~ WP-9，文件互不重叠）

> 9 个 WP 按**能力**切（不按目录切）；每个 WP 固定五字段。同一文件只属一个 WP；4 个被改既有文件各指定唯一负责 WP（`server.js`+`serve-entry.js`→WP-2、`labels.js`→WP-7、`package.json`→WP-1），其它包通过 §2 签名契约调用、不许各自去改。依赖成 DAG（§6）；每包自带契约测试，缺字段按契约兼容缺省。**所有 AC 的「验收口径」= 需求 v2 §3.1 同号 Then 逐字口径，本文档只登记 AC 编号、测试文件与逐字断言锚点，不复制、不改写、不放宽任何 Then。**

**门禁四件套（每 WP 合入前全跑，模板 §2.5；差集口径不用绝对全绿）**：

```bash
cd /Users/xuesh/www/Maestro

# 1) 全量测试：失败集合差集 = 0、条数只增不减（基线 1157 / 8 / 差集 0）
node --test "test/**/*.test.js"
#   断言：# fail 集合与 docs/iterations/iteration-7/baseline-failures.txt 差集 = 0；# tests ≥ 1157

# 2) 架构扫描：31 词全表显式 --forbid（词表照 D-7 原样复制），两轮均 exit 0
FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"   # exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid "$FORBID"            # exit 0

# 3) 零依赖
node -p "Object.keys(require('./package.json').dependencies||{}).length"            # 输出 0

# 4) 主链冒烟（$TMPDIR 独立根，绝不进仓库）+ 桌面壳冒烟（本迭代新增）
NODE_ENV=test node bin/orch.js run --cwd "$TMPDIR/i10a-smoke/single" --template single --host mock --task "写一份说明"
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$TMPDIR/i10a-smoke/code" --scenario backflow-once
# 桌面壳冒烟（涉及 daemon / 壳的 WP 必跑；纯 UI WP 用 harness 冒烟等价）：
ROOT="$TMPDIR/i10a-smoke/dsk"; mkdir -p "$ROOT"
NODE_ENV=test node src/daemon/serve-entry.js --project "$ROOT" --desktop &           # 起服
# 轮询 $ROOT/.orch/desktop.json 出现 → TOKEN=$(node -p "require('$ROOT/.orch/desktop.json').token")
# curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$(node -p "require('$ROOT/.orch/desktop.json').port")/ui/labels   # HTTP 200 且含 DESKTOP_LIST_ROW 键
# kill %1 后 $ROOT/.orch/desktop.json 已删除
```

所有机检命令形态一律为（F-16 固化模板）：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`，并断言 `# pass ≥ 1`、`# fail 0`；禁全量 glob 代替。所有文本扫描一律 `grep -E` / `grep -RE`（ERE）或 `rg`，禁 BRE `\|` 交替（toybox shim 假通过），每条写明期望结果与退出码。

### WP-1 桌面壳与打包先行验证（批次 2；依赖：无；裁决 B 硬动作为本包第一步）

- **负责文件（16）**：`desktop/src-tauri/Cargo.toml`、`desktop/src-tauri/tauri.conf.json`、`desktop/src-tauri/build.rs`、`desktop/src-tauri/src/main.rs`、`desktop/src-tauri/src/spawn.rs`、`desktop/src-tauri/src/tray.rs`、`desktop/src-tauri/src/probe.rs`、`desktop/src-tauri/src/single-instance.rs`、`desktop/src-tauri/src/config.rs`、`scripts/desktop/build.mjs`、`package.json`（改）、`docs/iterations/iteration-10a/wp1-bundle-verdict.md`、`test/wp13/bundle.test.js`、`test/wp13/desktop-shell.test.js`、`test/wp13/single-instance.test.js`、`test/wp13/project-guard.test.js`
- **依赖**：无（DAG 叶子；**内部第一步 = 最短打包验证**：先以最小壳骨架完成「解释器 + `bin/` + `src/` 进 bundle、双击可用」验证并落一页结论，再完整化托盘/关窗/单实例/项目守卫——后续 WP 依赖其结论而非其代码）
- **交付**：Tauri 壳全套（§2.3 十文件契约）：spawn bundle 内 node 绝对路径跑 `serve-entry.js --project <root> --desktop`（裁决 A 入口）、`desktop.json` 发现、托盘两项 + 退出确认（A-6 逐字）、关窗 hide、单实例锁 + `activated` 探针、`--probe`/`--ctl` 接缝（JSONL 事件 + ctl 文件触发改名 `.done`）、`projects.json` / views 读写命令；`npm run desktop:build` 纯复制 + cargo build；`package.json` 只追加 `scripts.desktop:*`。
- **验收口径**：主责 **AC-01**（探针 `ready`、`ready.t - launch.t ≤ 3000`、`view:"instances"`、窗口真显、A-1 两行逐字）、**AC-02**（事件序列 `ready → close-window → tray-still-present → quit-confirm-shown → quit(daemonStopped=true)`、`daemon.pid` 不变、两次 `instance status` 的 `updatedAt` 不同、退出后 `daemon.alive === false`）、**AC-29**（`env -i PATH=/usr/bin:/bin` 下直接执行二进制、`ready ≤ 3000ms` + `tray-created`、同 PATH `which node` 非零、点进实例 `probe.view === 'graph'`）、**AC-31**（三次启动探针 `view` = `project-missing` / `project-invalid` / `instances`、A-3 逐字）、**AC-36**（第二次启动无第二个 `ready`、出现 `activated`、`pid` 相等、`tray-open` 后 `visible:true` 视图仍 instances）；协作 AC-26（e2e 三段壳面）、AC-22（views 落盘命令）。契约测试三件：`desktop-shell.test.js`（AC-01/02 探针序列 + pid + updatedAt 推进断言）、`single-instance.test.js`（AC-36）、`project-guard.test.js`（AC-31）；`bundle.test.js` 断言 bundle 存在、`Resources/runtime/node` 可执行、`bin/`、`src/` 在包内、bundle 内 node 可跑通 `serve-entry.js --desktop` 起服 → `desktop.json` 出现。逐条按需求同号 Then 判定
- **可否并行**：可 —— 与 WP-2~WP-7 无共享文件；夹具启动方式统一为**直接执行 `Maestro.app/Contents/MacOS/maestro`**（禁 `open -na`，见 §8 黄色警示 1）
- **门禁附加**：AC-29 架构检查 `grep -REn "env::var\(\"PATH\"\)|Command::new\(\"node\"\)" desktop/src-tauri/src/` **零命中（exit 1）**；AC-02 架构检查 `grep -REn "core[.]stop" desktop/src-tauri/src/` **恰好 1 条命中（exit 0）**且位于 quit 函数内（`-B8` 上下文见 `fn quit`）；桌面壳冒烟（四件套第 4 条）

### WP-2 daemon 桌面通道：HTTP/SSE 传输与推送节流（批次 2；依赖：WP-4 数据形状契约冻结）

- **负责文件（8）**：`src/daemon/server.js`（改）、`src/daemon/serve-entry.js`（改）、`src/daemon/http/server.js`、`src/daemon/http/stream.js`、`test/wp13/http-channel.test.js`、`test/wp13/graph-stream.test.js`、`test/wp13/graph-throttle.test.js`、`test/wp13/graph-parallel.test.js`
- **依赖**：WP-4（`nodes[]`/`edges[]`/`rev` 形状与 `buildGraph` 签名——契约先冻结点 ①，冻住后可并行开发）
- **交付**：`server.js` 只加 `http` 可选参数与生命周期挂钩（D-10 授权段）；`serve-entry.js` 只加 `--desktop` 解析透传；`http/server.js` 回环绑定 + Bearer 鉴权 + `desktop.json` 原子写/删 + 静态 `/ui/*` + 路由分派（**S-02 容缺接缝**：对 `routes.js`（WP-3）/ `labels.js`（WP-7）为注入式 handler 表（`registerRoutes` / `registerLabels`）+ 惰性动态 import，非静态 import，未落地时结构化降级，见 §2.1）；`stream.js` 两条 SSE（`instances.changed` 500ms 合并、`graph.snapshot` 首帧 + 增量）+ `createConnectionThrottle`（注入时钟、窗口自首变起算不后延）+ `session.indicator` 透传不推进 rev + `POST /__test__/graph/pulse`（仅 `NODE_ENV=test`）。
- **验收口径**：主责 **AC-08**（首帧 `graph.snapshot` 全量、`t_role - t_pulse ≤ 500ms`、重连首帧仍 snapshot 且节点数一致）、**AC-09**（5 次变化恰 1 帧 `connection.updated`、`aggregateStatus === 'expired'`、窗口 1000ms 自首变起算）、**AC-10**（`rev_before === rev_after`、`roleFrames === 0`、`connectionFrames === 0`、`indicatorFrames ≤ 5`、坐标尺寸逐项不变）、**AC-37**（`roleFrames === 1` 且 ≤500ms、`connectionFrames === 1` 且为最后态 ≤1200ms、都不丢）；协作 AC-27（401 / 仅回环 / 无凭据拒绝）、AC-30（连接失败与重连态数据面）、AC-04（`instances.changed` 触发 refetch）。契约测试：`http-channel.test.js`（鉴权 401、`desktop.json` 形状与删除时机、不传 `--desktop` 完全不监听 HTTP、`lsof` 仅 `127.0.0.1`）、`graph-stream.test.js` / `graph-throttle.test.js` / `graph-parallel.test.js`（帧序、节流边界注入时钟 1000ms 不推 / 1001ms 推、rev 白名单排除 session）。逐条按需求同号 Then 判定
- **可否并行**：可 —— 与 WP-1/WP-3/WP-5 无共享文件；对 WP-4 只依赖冻结契约
- **门禁附加**：`grep -REn "new EventEmitter" src/daemon/http/` **零命中（exit 1）**（AC-08）；`grep -REn "saveState|instance-store|appendSpan" src/daemon/http/` **零命中（exit 1）**（AC-27）；桌面壳冒烟必跑

### WP-3 列表与新建实例（批次 3；依赖：WP-2 + WP-4 + WP-7）

- **负责文件（9）**：`src/daemon/http/routes.js`、`desktop/ui/list/list.js`、`desktop/ui/list/new-instance.js`、`desktop/ui/list/health-hover.js`、`desktop/harness/collect.mjs`、`desktop/harness/render-list.mjs`、`test/wp13/instance-list.test.js`、`test/wp13/new-instance.test.js`、`test/wp13/health-hover.test.js`
- **依赖**：WP-2（HTTP 通道与 SSE）、WP-4（图路由消费 `buildGraph`）、WP-7（冻结的 `DESKTOP_*` / `HEALTH_*` / `ERROR_TEMPLATE` 键名）
- **交付**：`routes.js` 四组路由（列表只消费 `instance.list`+`instance.get`；`POST /instances` 透传 `orchestrator.startRun`；图路由按「workflowRef → 内置模板 → 空图」解析定义后调纯投影；`GET /workflows` 三模板；与 WP-2 的接缝为 **S-02 容缺接缝**——落地后由 `http/server.js` 惰性动态 import 自动承接，无需改 WP-2 文件）；列表渲染三模块（六项 A-1 行、排序、空态/不可读、健康悬停 A-7）；harness `collect.mjs` / `render-list.mjs`。
- **验收口径**：主责 **AC-03**（四行逐字 A-1、排序序列 `attention, slow, normal, ended`、六项齐全）、**AC-04**（空态 `实例 无` / 不可读行不阻断 / 新实例 2 秒内出现且由 `instances.changed` 触发 `refetch ≥ 1` 无周期轮询；含 **F-18 落点**：阶段四断言既有实例状态变化后 2 秒内该行更新且由推送触发）、**AC-05**（`已启动 {id}`、2 秒入列表、与 CLI 同参启动逐词同构、只新增一例）、**AC-06**（四条提示逐字 A-5、面板 `open === true`、实例数不变、无堆栈）、**AC-32**（八类原因句逐字 A-7、第 9 例 `健康度 正常`、经 `HEALTH_LINE`/`HEALTH_REASON` 模板渲染）；协作 AC-26（列表两行）、AC-30（不可读行）、AC-01（列表行数据）。契约测试：`instance-list.test.js`（三阶段 + F-18 阶段四）、`new-instance.test.js`（成功/三校验/坏现场四路径）、`health-hover.test.js`（9 行导出逐字）。逐条按需求同号 Then 判定
- **可否并行**：可 —— 与 WP-5 无共享文件
- **门禁附加**：`grep -Rn "startRun" desktop/` **零命中（exit 1）**（AC-05）；`grep -REn "P90|TTL|崩溃" desktop/ui/` **零命中（exit 1）**（AC-32）；列表不重算健康度（架构检查）；桌面壳冒烟

### WP-4 图投影引擎（批次 1；依赖：无，数据形状须最先冻结）

- **负责文件（5）**：`src/daemon/graph.js`、`test/wp13/graph-projection.test.js`、`test/wp13/edge-aggregate.test.js`、`test/wp13/edge-visual.test.js`、harness `desktop/harness/graph-dump.mjs`（S-04：括号计数已改实数 5）
- **依赖**：无（叶子；`buildGraph` 签名与 `nodes[]`/`edges[]`/`rev` 全字段形状是 **§6 契约先冻结点 ①**，冻住后 WP-2/3/5/6 才可并行）
- **交付**：纯投影 `buildGraph({ state, workflowDef, roles, traces, now })`（五类节点、边聚合与优先级常量、7 态 `EDGE_VISUAL` token 表、`REV_WHITELIST`、健康度直读、`lastActivity` 只读投影）；`graph-dump.mjs` **分阶段交付（S-03）**：批次 1 输出节点/边（`legend`/`hover` 段容缺 `null`），批次 4 起经惰性动态 import 补齐图例/悬停集合全量导出（AC-33 等测试共用）。
- **验收口径**：主责 **AC-07**（批次 1 可判部分：8 节点 9 边、悬空 0、每节点带类型状态、每线带方向与聚合状态；**图例两行逐字断言后置（S-03）**——由 WP-5 `legend.test.js` 按 AC-34 同一 A-8 逐字基线判定（批次 3）、批次 4 起 `graph-dump.mjs` 全量导出复核、WP-9 e2e 收口，AC-07 锚点测试文件 `graph-projection.test.js` 仍在本包清单且批次 1 可执行）、**AC-14**（拓扑完整：四类节点齐、4 边全画、`dangling === 0`）、**AC-15**（7 条 token 表逐项相等、`not_started` 默认 `hidden === true` 开关后 `false`）、**AC-16**（回流对恰 2 条边、`backflow.aggregateStatus === 'rejected'`、`forward.parallelCount === 2` 标注「2 并行交接」、7 态两两组合表驱动优先级）；协作 AC-08（snapshot 数据）、AC-10（rev 白名单）、AC-13/14（special/group 字段，行渲染主责 WP-6）、AC-26（graph-shown 探针数据）、AC-30（定义不可读回退数据面）。契约测试：`graph-projection.test.js`（AC-07/14 断言集合相等 + 悬空 0 + 未知 `node_type` 不丢节点）、`edge-aggregate.test.js`（优先级表驱动）、`edge-visual.test.js`（A-11 token 逐项 + hidden 开关）。逐条按需求同号 Then 判定
- **可否并行**：可 —— 纯内存函数，零 IO、零中文、零禁词，是 DAG 叶子
- **门禁附加**：`grep -REn "saveState|emit\(" src/daemon/graph.js` **零命中（exit 1）**（AC-07，ERE 形态）；未知 `node_type` 按 role 渲染保留 ID

### WP-5 布局·视图·看板纯模块（批次 3；依赖：WP-4 + WP-7）

- **负责文件（12）**：`desktop/ui/graph/layout.js`、`desktop/ui/graph/view.js`、`desktop/ui/graph/legend.js`、`desktop/ui/board/board.js`、`desktop/harness/layout-dump.mjs`、`desktop/harness/board-dump.mjs`、`test/wp13/graph-layout.test.js`、`test/wp13/view-state.test.js`、`test/wp13/focus-mode.test.js`、`test/wp13/legend.test.js`、`test/wp13/board.test.js`、`test/wp13/board-unknown.test.js`
- **依赖**：WP-4（`nodes[]`/`edges[]` 形状）、WP-7（图例/看板列名/视图控件文案键）
- **交付**：`layout.js`（180/80/240/140/弧高 40 常量、forward 最长路径分层、同层稳定排序、`z = abnormal ? 1 : 0`、两次布局逐字节一致）；`view.js`（zoom 夹取 0.5~2.0、平移、复位、2 跳聚焦 BFS、拖拽偏移叠加、偏移不写实例文件）；`legend.js`（A-8 两行、锚点 bottom-left）；`board.js`（7 列派生、`pending`→blocked/ready、已取消折叠、未知态落 blocked 标「状态未知」）；两个 harness dump。
- **验收口径**：主责 **AC-17**（层号 A=0/B=1/C=1/D=2、x=0/240/240/480、同层 y 不等、回流 `path.kind === 'arc'` 不推层、两次 `JSON.stringify(layout)` 字节相等）、**AC-18**（两份图逐节点 diff：坐标尺寸差集空、`z` 差集 `{B:1}`、相连边 z 提升、解除还原）、**AC-20**（150% 屏宽 270、复位归零、夹取 0.5/2.0）、**AC-21**（可见 `[B,C,D]`、边两端可见、标题「聚焦 C（2 跳）」、Esc 恢复全集）、**AC-22**（偏移文件内容、重开坐标 = 基础+(40,60)、跨实例隔离、`state.json`/`events.jsonl` 字节哈希不变）、**AC-24**（7 列名顺序逐字、列-卡片集合、「已取消 2」、切回视图状态逐字段相等）、**AC-34**（三视图态 `legend.anchor === 'bottom-left'`、A-8 两行逐字、画布最上层）、**AC-35**（未知节点 `column === 'blocked'`、标注含「状态未知」、卡片总数 3、切回视图状态不变）；协作 AC-14（层号断言）、AC-19（折叠前后层号不漂，折叠逻辑主责 WP-6）、AC-10（坐标尺寸逐项不变断言）、AC-33（坐标不变）。契约测试：`graph-layout.test.js`（AC-17/18/14 协作断言）、`view-state.test.js`（AC-20/22）、`focus-mode.test.js`（AC-21）、`legend.test.js`（AC-34 逐字；**同时承载 AC-07 的图例两行逐字断言——S-03 自 WP-4 后置移入，AC-07 协作**）、`board.test.js`（AC-24）、`board-unknown.test.js`（AC-35）。逐条按需求同号 Then 判定
- **可否并行**：可 —— 纯模块禁 DOM/fs/`Date.now`/`window`，与 WP-3 无共享文件
- **门禁附加**：`grep -REn "Date[.]now|fs[.]" desktop/ui/graph/` **零命中（exit 1）**（AC-17/34）；`grep -REn "instanceDir|statePath" desktop/ui/` **零命中（exit 1）**（AC-22）

### WP-6 交互样式与行渲染纯模块（批次 4，单线；依赖：WP-4 + WP-5 + WP-7）

- **负责文件（12）**：`desktop/ui/graph/collapse.js`、`desktop/ui/graph/style.js`、`desktop/ui/graph/highlight.js`、`desktop/ui/graph/node-rows.js`、`desktop/ui/graph/edge-rows.js`、`desktop/ui/labels/labels.js`、`test/wp13/graph-collapse.test.js`、`test/wp13/abnormal-style.test.js`、`test/wp13/labels-policy.test.js`、`test/wp13/hover-highlight.test.js`、`test/wp13/role-node.test.js`、`test/wp13/special-node.test.js`
- **依赖**：WP-4（节点/边投影字段）、WP-5（层号/z/视图状态）、WP-7（A-9/A-10/A-11/A-12 文案键）
- **交付**：`collapse.js`（>12 角色按 `group` 自动折叠、组节点「分组 {group} · N 角色」、展开/收起、子工作流恒折叠）；`style.js`（异常角标 + `pulse` 动画 token、几何不变）；`highlight.js`（悬停高亮集合邻接派生）；`node-rows.js`（A-9 五要素行 + 折叠堆叠形态、A-10 三类特殊节点行）；`edge-rows.js`（A-11 文本投影 + 并行标注 + `accepted` 悬停「已接受 · 处理中」）；`labels/labels.js`（标签可见性策略）。
- **验收口径**：主责 **AC-11**（A-9 服务中示例逐字、`statusColor === 'blue'`、`badge === 'escalated'`、`badgeCount === 1`、`hostIcons` 顺序 `['dsh','cursor']`）、**AC-12**（折叠示例逐字、`sessionStack === 3`、`width === 180`）、**AC-13**（A-10 三行逐字含全角冒号、`shape` = shield/alert/group、`color` = gray/red/green）、**AC-19**（三态可见 2/10/2、组节点标签逐字、折叠态边数 1、展开后成员回原层）、**AC-23**（`width/height/x/y` 四项相等、`animation === 'pulse'`、连接线 `color === 'red'` 且 `arrow === 'back'`、其它节点坐标不变）、**AC-25**（三次 `visibleLabels` 集合 3/4/3、新增键正确、角色节点内容三次均在）、**AC-33**（**F-19 落点**：夹具图加与 B 不相邻的节点 E 与边 C→E，悬停 B 时「全不透明集合」= 三线 + 四点且 **E 与 C→E 降不透明度**成为可裁决断言、悬停 B→C 集合、两次移开恢复全集、坐标尺寸不变）；协作 AC-14（子工作流行）、AC-15（token 呈现）、AC-30（「角色数未知」降级行）。契约测试：六文件逐字/token 断言（夹具数据内联，不经守护进程）；**例外（S-07 可读性实测）**：`graph-collapse.test.js` 含一个实测阶段——在 `$TMPDIR` 独立根按 §7 风险 14 铁序直写 `.orch/roles/*.yaml` 13 角色（8 coding + 5 research）后以 `--host mock` 起一次会话，断言注册表读盘可读（`buildRoleInstances` 读出 13 角色、group 计数 8/5，AC-19 折叠断言字段可判）；不可读 → 按 §1.2 走需求修订（纪要 §5.2）。逐条按需求同号 Then 判定
- **可否并行**：可 —— 纯模块，只消费冻结契约
- **门禁附加**：`grep -R "decideStatus" desktop/` **零命中（exit 1）**（AC-11）；分组键只取角色 `group` 缺失落「未分组」（AC-19）；类型只读 `node_type` 不按标题猜（AC-13）

### WP-7 中文文案键底座（批次 1；依赖：无，键名须先冻结）

- **负责文件（3）**：`src/cli/labels.js`（改）、`src/daemon/http/labels.js`、`test/wp13/labels-desktop.test.js`
- **依赖**：无（叶子；A-14 全表键名与中文文案是 **§6 契约先冻结点 ③**，冻住后 WP-3/5/6/8 才可开发）
- **交付**：`labels.js` 文件末尾追加 A-14 全部 `DESKTOP_*` 键（既有键、`USAGE_LINES`、健康度/追踪文案零改动）；`http/labels.js` 经 `GET /ui/labels` 返回 `{ keys: {...} }`（界面与壳层托盘文案都从这里取）。
- **验收口径**：无主责 AC（协作 AC-01/03/05/06/11/12/13/14/16/19/24/25/26/30/31/32/34 的全部文案逐字基线）；契约测试 `labels-desktop.test.js` 主责 **AC-28 的文案面**：断言 `desktop/ui` 与 `desktop/harness` CJK 命中数为 0、`GET /ui/labels` 覆盖界面引用到的键集合、新增键存在且非空、既有键计数与内容逐字不变、`USAGE_LINES` 仍 25 行。逐条按需求同号 Then 判定
- **可否并行**：可 —— 纯常量表 + 一个只读路由
- **门禁附加**：`grep -REn "项目 未指定|项目 不可用" desktop/ui desktop/harness` **零命中（exit 1）**（AC-31，含中文扫描走 ERE）；CJK 零命中

### WP-8 界面装配与连接态/降级（批次 5，单线；依赖：WP-1 + WP-2 + WP-3 + WP-5 + WP-6 + WP-7）

- **负责文件（5）**：`desktop/ui/app.js`、`desktop/ui/connection.js`、`desktop/ui/project.js`、`desktop/ui/index.html`（S-05 登记：静态入口页，契约见 §2.2）、`test/wp13/errors.test.js`
- **依赖**：WP-1（壳接缝与 `open-instance`/`close-window` 触发）、WP-2（连接/断线/重连数据面）、WP-3（列表/新建模块）、WP-5（布局/视图/看板模块）、WP-6（行渲染/样式/标签模块）、WP-7（文案键）
- **交付**：`app.js` 视图装配与路由（列表页/流程图页/看板页/项目提示页）、推送帧按类型分流消费（role/edge/special 局部重绘、`session.indicator` 不重绘）、工具栏与键盘（复位/未开始开关/分组展开收起/Esc）、悬停与拖拽事件绑定、**与 AC-07/14 同批模块（禁测试专用渲染分支）**；`connection.js` 三态状态机（A-4 全部三态）；`project.js` 项目解析优先级与提示页；`errors.test.js` 六态 + F-17 瞬态断言。
- **验收口径**：主责 **AC-30**（六种异常提示逐字：`实例 INST-999 · 不存在` / `流程图定义不可读 · 已按内置模板显示` / `子工作流 child-x · 角色数未知` / `连接守护进程失败 · 请确认项目目录后重试` / `已断开 · 正在重连…` / `实例 {id} · 状态不可读`，全部不白屏不打堆栈、可返回列表或重试；**含 F-17 落点**：守护进程分支增加中间断言——核心未就绪期间出现「正在连接守护进程…」，超 10 秒转失败句）；协作 AC-31（提示页装配）、AC-01（`view:"instances"` 装配）、AC-26（graph-shown/closed 探针）、AC-08/30（重连态文案）。契约测试 `errors.test.js`：六份现场逐条构造 + F-17 瞬态 + 每条断言「界面仍可继续操作」；**并承担 S-02 接缝的批次后置端到端校验**（起服断言 `GET /ui/labels` 与 REST 路由全量可用，见 §6 注入依赖说明）。逐条按需求同号 Then 判定
- **可否并行**：否 —— 汇集六个上游包的模块做装配，须在其契约合入后单线开发
- **门禁附加**：装配层不新增渲染逻辑（复用纯模块）；桌面壳冒烟 + harness 冒烟

### WP-9 回归守护与端到端整合（批次 6，单线；依赖：WP-1 ~ WP-8 全部合入）

- **负责文件（3）**：`test/wp13/regression.test.js`、`test/wp13/acceptance-e2e.test.js`、`test/wp13/readonly-local.test.js`
- **依赖**：WP-1 + WP-2 + WP-3 + WP-4 + WP-5 + WP-6 + WP-7 + WP-8 全部合入（DAG 汇合点）
- **交付**：`regression.test.js`（三条主链逐字、`instance status`/`instance graph` 格式逐字、失败集合差集 0、条数 ≥1157、deps=0、31 词两轮扫描、`USAGE_LINES` 25 行、`desktop/ui`+`desktop/harness` CJK 零命中）；`acceptance-e2e.test.js`（AC-26 一次跑完三段：探针 `ready → rows → graph-shown(nodes, edges, dangling=0) → closed(visible=false)`、pid 前后相等、`instance status` 成功）；`readonly-local.test.js`（AC-27：两组文件哈希不变、四组状态深比较相等、无凭据 401、`lsof` 全部 `127.0.0.1:<port>`、`0.0.0.0` 通配零命中）。
- **验收口径**：主责 **AC-26**（规划逐字验收句端到端）、**AC-27**（只读与本地性）、**AC-28**（零依赖 / 中文唯一来源 / 31 词纯净两轮 / 无宿主分支 / 全量基线差集 0）；协作全部 AC（回归兜底）。契约测试即上述三文件；AC-26 夹具 `INST-001` 由夹具构造（U-4 已裁决）、渲染与 AC-07/14 同批模块。逐条按需求同号 Then 判定
- **可否并行**：否 —— DAG 汇合点，末批单线合入并跑全量门禁
- **门禁附加**：四件套全量复跑；`npm run desktop:build` 产物存在性断言

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注 |
|---|---|---|---|
| AC-01 | WP-1 | WP-3、WP-8 | 双击 3s 开窗停列表、A-1 两行逐字（BR-01/02/03） |
| AC-02 | WP-1 | WP-9 | 关窗缩托盘 daemon 不停、托盘退出确认（BR-01/20；core.stop 恰 1 处） |
| AC-03 | WP-3 | WP-7、WP-9 | 六项齐全 + 分档置顶（BR-03/04/23） |
| AC-04 | WP-3 | WP-2、WP-7 | 空态/不可读/2 秒增减；含 F-18 阶段四（BR-05/06/24） |
| AC-05 | WP-3 | WP-2、WP-7 | 新建成功路径与 CLI 逐词同构（BR-07/06） |
| AC-06 | WP-3 | WP-7 | 校验与失败四条提示逐字（BR-07/24） |
| AC-07 | WP-4 | WP-5、WP-7 | 快照 8 节点 9 边悬空 0；图例两行断言落 WP-5 `legend.test.js`（S-03 后置，批次 3）（BR-09/10/11） |
| AC-08 | WP-2 | WP-4、WP-9 | 先全量 / 500ms / 重连补全量（BR-08/19） |
| AC-09 | WP-2 | WP-4 | 1 秒合并最后一帧（BR-19；注入时钟） |
| AC-10 | WP-2 | WP-5 | 会话不重排 rev 不变（BR-19/20） |
| AC-11 | WP-6 | WP-4、WP-7 | 角色节点五要素逐字（BR-09） |
| AC-12 | WP-6 | WP-5 | 折叠/堆叠/宽度 180（BR-09） |
| AC-13 | WP-6 | WP-4、WP-7 | 三类特殊节点逐字（BR-10） |
| AC-14 | WP-4 | WP-5、WP-6 | 拓扑完整 + 层号（规划验收中段，BR-10/12） |
| AC-15 | WP-4 | WP-5、WP-6 | 7 态 token 表 + not_started 开关（BR-11） |
| AC-16 | WP-4 | WP-6 | 聚合优先级 / 分线 / 并行合并（BR-11） |
| AC-17 | WP-5 | WP-4 | 层次布局确定性（BR-12；layout 纯函数门禁） |
| AC-18 | WP-5 | WP-6 | 异常置顶不破坏布局（BR-13/12） |
| AC-19 | WP-6 | WP-5 | 13 角色折叠三态（BR-15） |
| AC-20 | WP-5 | — | 缩放平移复位夹取（BR-14） |
| AC-21 | WP-5 | — | 2 跳聚焦 Esc 退出（BR-14） |
| AC-22 | WP-5 | WP-1 | 拖拽按实例保存、文件哈希不变（BR-16/20） |
| AC-23 | WP-6 | WP-4、WP-5 | 角标脉冲几何不变（BR-13/11） |
| AC-24 | WP-5 | WP-6、WP-7 | 看板 7 列只读切换（BR-17/23） |
| AC-25 | WP-6 | WP-7 | 标签策略 3/4/3（BR-18） |
| AC-26 | WP-9 | WP-1、WP-3、WP-4、WP-5、WP-6、WP-8 | 规划验收句端到端（BR-01/03/10/19） |
| AC-27 | WP-9 | WP-2、WP-3、WP-5、WP-6 | 只读 / 401 / 仅回环（BR-20/02） |
| AC-28 | WP-9 | WP-7 | 零依赖 / 中文 / 31 词两轮（BR-21/22） |
| AC-29 | WP-1 | WP-8 | 清空环境双击可用（BR-02/22；裁决 B） |
| AC-30 | WP-8 | WP-2、WP-4、WP-7 | 六种异常提示 + F-17 瞬态（BR-24/08） |
| AC-31 | WP-1 | WP-8 | 项目未指定/不可用提示页（BR-25/24） |
| AC-32 | WP-3 | WP-7 | 健康度悬停八类逐字（BR-26/23） |
| AC-33 | WP-6 | WP-5 | 悬停高亮集合；含 F-19 不相邻元素（BR-27/28） |
| AC-34 | WP-5 | WP-7 | 图例左下角锚点不变（BR-29） |
| AC-35 | WP-5 | WP-6、WP-7 | 看板未知态落被阻塞（BR-30/17） |
| AC-36 | WP-1 | WP-8 | 重复双击单实例（BR-31/01） |
| AC-37 | WP-2 | WP-4 | 角色与连接线齐变互不阻塞（BR-32/19） |

> 覆盖核对：AC-01~AC-37 连续编号、一行一条、无缺号、无重号、无合并；每行恰好一个主责 WP；合计 **37/37**。主责 WP 分布：WP-1（AC-01/02/29/31/36）、WP-2（AC-08/09/10/37）、WP-3（AC-03/04/05/06/32）、WP-4（AC-07/14/15/16）、WP-5（AC-17/18/20/21/22/24/34/35）、WP-6（AC-11/12/13/19/23/25/33）、WP-8（AC-30）、WP-9（AC-26/27/28）；WP-7 无主责 AC、只承担文案协作（同 I1.9 的 WP-4 先例）。

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `desktop/src-tauri/**`（9 文件） | Tauri 壳：Cargo.toml / tauri.conf.json / build.rs / main.rs / spawn.rs / tray.rs / probe.rs / single-instance.rs / config.rs（S-04：计数改实数 9） | WP-1 |
| `scripts/desktop/build.mjs` | 纯 Node 构建脚本（复制资源 + cargo build，零 npm 依赖） | WP-1 |
| `package.json`（改） | 只追加 `scripts.desktop:*`；dependencies/devDependencies 保持为空 | WP-1 |
| `docs/iterations/iteration-10a/wp1-bundle-verdict.md` | 裁决 B 一页验证结论（解释器进 bundle 方式、体积与构建时长实测、A/B 取舍） | WP-1 |
| `src/daemon/server.js`（改） | 只新增可选 `http` 参数与生命周期挂钩 | WP-2 |
| `src/daemon/serve-entry.js`（改） | 只新增 `--desktop` 解析透传 | WP-2 |
| `src/daemon/http/server.js` / `stream.js` | HTTP 传输层（鉴权/desktop.json/静态资源）+ SSE 推送与节流调度器 + pulse 接缝 | WP-2 |
| `src/daemon/http/routes.js` | 列表 / 新建 / 图快照 / workflows 路由 | WP-3 |
| `src/daemon/graph.js` | 图纯投影：五类节点、边聚合与 7 态 token、rev 白名单 | WP-4 |
| `desktop/ui/list/**`（3 文件） | 列表行/排序/空态、新建面板校验、健康悬停纯模块 | WP-3 |
| `desktop/ui/graph/layout.js` / `view.js` / `legend.js` + `desktop/ui/board/board.js` | 布局 / 视图状态 / 图例 / 看板纯模块（禁 DOM/fs/Date.now/window） | WP-5 |
| `desktop/ui/graph/{collapse,style,highlight,node-rows,edge-rows}.js` + `desktop/ui/labels/labels.js` | 折叠 / 异常样式 / 悬停高亮 / 节点行 / 边行 / 标签策略纯模块 | WP-6 |
| `desktop/ui/{app,connection,project}.js` + `desktop/ui/index.html` | 视图装配、连接态状态机、项目解析、静态入口页（bundle 资源，S-05 登记） | WP-8 |
| `src/cli/labels.js`（改） | 末尾追加 A-14 全表 `DESKTOP_*` 键；既有键零改动 | WP-7 |
| `src/daemon/http/labels.js` | `GET /ui/labels` 键值下发 | WP-7 |
| `desktop/harness/{collect,render-list,layout-dump,board-dump,graph-dump}.mjs` | 验收 harness 五件（只 import `desktop/ui` 纯模块） | WP-3（2）/ WP-5（2）/ WP-4（1） |
| `test/wp13/**`（31 文件） | 全部契约测试与回归测试（归属见 §4；既有测试文件零改动） | 各 WP |
| `probe/acc10-f-lib.mjs` / `-common.mjs` / `-run.mjs` / `-final.mjs` | S3 验收脚手架四件套（**机检命令一律按 F-16 固化模板生成**：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js` + 断言 `# pass ≥ 1`、`# fail 0`；禁全量 glob） | WP-9（S3，主控单独提交） |
| `probe/acc10-cases/` / `acc10-f-parts/` / `acc10-f-results.jsonl` / `acc10-f-summary.json` / `acc10-f-blockers.md` | 逐 AC 用例（不带 `-f`）/ 核对表 / 结果 / 汇总 / 缺陷台账 | WP-9（S3，主控单独提交） |
| `docs/iterations/iteration-10a/evidence/` | 逐 AC 原始帧（探针 JSONL、SSE 帧序、渲染导出、lsof/哈希输出等），每条至少 4 份 | WP-9（S3，主控单独提交） |
| **只读基线（不改）** | `src/core/**`、`src/cli/{main,render}.js`、`src/persistence/**`、`src/templates/**`、`src/registry/**`、既有 `test/**`、`test/fixtures/**`、`bin/orch.js` | — |

---

## 6. 依赖与并行策略

**DAG（文本图，依赖编号全部存在且无环）**

```
WP-7 (文案键底座，叶子) ────┬──> WP-3 (列表/新建) ──────┐
                            ├──> WP-5 (布局/视图/看板) ──┼──> WP-6 (交互样式/行渲染) ──┐
                            │                           │                             │
WP-4 (图投影引擎，叶子) ────┼──> WP-2 (HTTP/SSE 通道) ───┤                             ├──> WP-8 (界面装配) ──┐
                            ├──> WP-3                   │                             │                     │
                            ├──> WP-5                   ├─────────────────────────────┘                     │
                            └──> WP-6                   │                                                   │
WP-1 (桌面壳与打包，叶子) ───────────────────────────────┼───────────────────────────────────────────────────┤
WP-1..WP-8 ─────────────────────────────────────────────┴────────────────────────────────> WP-9 (回归端到端汇合点)
```

叶子：WP-7 / WP-4 / WP-1；汇合点：WP-9。依赖编号 WP-1~WP-9 全部存在，箭头由小编号/叶子指向下游，无环。

**注入依赖说明（S-02 / S-03，import 声称 ↔ DAG/批次三方一致的关键）**：`http/server.js`（WP-2）→ `routes.js`（WP-3）与 `http/labels.js`（WP-7）、`graph-dump.mjs`（WP-4）→ `legend.js`（WP-5）与 `highlight.js`（WP-6）均为**注入式 handler 表 / 惰性动态 import 依赖，非静态 import，不计入上述 DAG 边**；但计入**批次后置校验**——批次 3 整合检查点断言 REST 路由可用（routes.js 已落地）、批次 4 整合检查点断言 `graph-dump.mjs` 全量导出非 `null`（legend/highlight 已落地）、批次 5 WP-8 `errors.test.js` 端到端断言接缝可用。

**分批顺序（一次最多 2 个大 Agent，模板 §2.3；相互独立才并行、修复类永远单线；共 6 批——S-01 修订：WP-8 依赖 WP-6 且自述「可否并行：否」，不得同批并行，改为单线后置）**

- **契约先冻结点（批次 0，由本文档定死，不占 Agent 名额）**：见下方清单；冻住后其余包才可并行。
- **第 1 批（2 并行）**：WP-7（文案键）+ WP-4（图投影引擎）—— 两个最关键契约（键名全集 / nodes·edges·rev 形状）先落地。
- **第 2 批（2 并行）**：WP-1（桌面壳，内部第一步先做裁决 B 最短打包验证并落一页结论）+ WP-2（HTTP/SSE 通道）。
- **第 3 批（2 并行）**：WP-3（列表/新建）+ WP-5（布局/视图/看板）。
- **第 4 批（1，单线）**：WP-6（交互样式/行渲染）。
- **第 5 批（1，单线）**：WP-8（界面装配与连接态；其依赖 WP-6 已于第 4 批合入，与 WP-8 自述「可否并行：否」一致）。
- **第 6 批（1，单线）**：WP-9（回归守护与端到端，汇合点跑全量门禁）。

**契约先冻结点**（必须先定死字段 / 签名 / 返回结构，冻住后其余包才可并行）：

1. **图数据形状（最关键）**：`buildGraph({ state, workflowDef, roles, traces, now }) → { rev, nodes, edges, workflow }`；`nodes[]` / `edges[]` 全字段（§2.1 / §3.4，含 `visual` token 与 `labelVisible`）；`AGGREGATE_PRIORITY` 七态顺序；`REV_WHITELIST`。冻住后 WP-2（snapshot 帧）、WP-3（图路由）、WP-5（布局消费）、WP-6（行渲染消费）并行开发。
2. **SSE 帧契约**：帧格式 `event: <type>\ndata: <json>\n\n`；事件类型 `instances.changed` / `graph.snapshot` / `role_instance.updated` / `connection.updated` / `special_node.updated` / `session.indicator`；`data` 至少含 `{rev, instanceId, type, key, payload}`；重连首帧恒为 `graph.snapshot`。冻住后 WP-2 与 WP-8（帧消费）一致。
3. **文案键名全集**：A-14 全表（`DESKTOP_*` 28 组键 + 复用键 `INSTANCE_EMPTY` / `HEALTH_*` / `ERROR_TEMPLATE` / `COMMAND_ERROR`）。冻住后 WP-3/5/6/8 据此渲染。
4. **`/ui/labels` 返回形状**：`{ keys: { "<KEY>": "<文案模板>" } }`；模板占位替换规则与 A-0 可变值一致。
5. **三个新落盘文件形状**：`desktop.json` / `views/<id>.json` / `projects.json`（§3.1~3.3）；路径常量归属（desktop.json → `src/daemon/http/server.js`；views / projects.json → `desktop/src-tauri/src/config.rs`）。
6. **壳 ↔ daemon 协议**：spawn 参数（`serve-entry.js --project <root> --desktop`）、`desktop.json` 轮询发现（100ms / 上限 30s）、探针事件名全集（`ready` / `close-window` / `tray-still-present` / `quit-confirm-shown` / `quit` / `tray-open` / `activated` / `tray-created` / `rows` / `graph-shown`）、ctl 文件名全集（`close-window` / `tray-open` / `tray-quit` / `tray-quit-confirm` / `open-instance/<id>`）、quit 经 IPC 管道发 `core.stop`。
7. **布局常量与纯函数约束**：180 / 80 / 240 / 140 / 弧高 40；zoom ∈ [0.5, 2.0]；折叠阈值 > 12；`desktop/ui/graph/**` 与 `desktop/ui/board/**`、`desktop/ui/labels/**` 禁 DOM/fs/`Date.now`/`window`。
8. **冻结基线**：`USAGE_LINES` 25 行、`dependencies = {}`、31 词纯净两轮、三主链逐字、D-10 不得修改清单、D-11 授权断言修改清单 = 无、`--host mock` 统一口径、夹具根一律 `$TMPDIR`。

**整合检查点（每批合入后跑，命令见 §4 门禁四件套；预期数字汇总）**：37/37 AC 有判定归属、失败集合差集 = 0 且条数 ≥1157、0 运行时依赖、31 词两轮 `exit 0`、`USAGE_LINES` 25 行、`desktop/ui`+`desktop/harness` CJK 零命中、三主链输出逐字不变。第 2 批合入后追加桌面壳冒烟（`serve-entry.js --desktop` 起服 → Bearer 探针 → 关停删 `desktop.json`）；第 6 批合入后追加 `npm run desktop:build` 与 AC-26/29 的真机夹具实跑。

---

## 7. 风险与降级

| # | 风险 | 影响 | 处置（点名文件 / 函数 / AC） |
|---|---|---|---|
| 1 | 打包验证失败：node 二进制或 `src/` 进不了 bundle，双击不可用 | AC-29 判「不通过」，裁决 B 触发需求修订 | WP-1 第一步做最短打包验证并落 `wp1-bundle-verdict.md`；构建脚本 `scripts/desktop/build.mjs` 只做复制 + `cargo build`；两条路径（① bundle 解释器 / ② 编译进壳）都失败 → 按 `decisions.md` 裁决 B 回需求修订，不许实现里悄悄消化 |
| 2 | `open -na` 不继承环境变量，`NODE_ENV=test` / `MAESTRO_CONFIG_DIR` 注不进去 | AC-01/26/29/31/36 走生产路径，判定全部失真 | 全部壳夹具统一**直接执行** `Maestro.app/Contents/MacOS/maestro --project ... --probe ... --ctl ...`（WP-1 夹具规范 + §8 黄色警示 1）；AC-29 本就要求 `env -i`，只有直接执行可控环境 |
| 3 | 图投影在 HTTP 层被写成读盘/取时间/重算健康度 | AC-07/17 架构检查失败、健康度双源 | WP-4 `graph.js` 纯函数（`now` 注入、定义解析由 `routes.js` 读盘后传入）；健康度直读 `state.health`（D-3/D-8）；门禁 `grep -REn "saveState|emit\(" src/daemon/graph.js` 零命中 |
| 4 | 连接线合并用 `setTimeout` 硬等或窗口被后续变更后延 | AC-09/37 边界不可构造、显示旧状态 | WP-2 `stream.js` `createConnectionThrottle({ windowMs, now })` 注入时钟纯调度器；`graph-throttle.test.js` 注入固定时钟断言 1000ms 不推 / 1001ms 推；禁真实时间赛跑（§3.3 774 行） |
| 5 | 会话事件混入 rev 白名单或触发重绘 | AC-10 `rev` 漂移、流程图抖动 | WP-2 `stream.js` `REV_WHITELIST` 排除 `session.state` / `execution.summary` / `health.changed`；`session.indicator` 原样透传；WP-8 `app.js` 按事件类型分流消费 |
| 6 | HTTP 层调用写状态方法或 `startRun` 散落到多处 | AC-27 只读边界失守、污染编排状态 | WP-2 `http/server.js` 鉴权与静态路由不触 store；WP-3 `routes.js` 中 `startRun` 命中全部落在 POST /instances 处理器；门禁 `grep -REn "saveState|instance-store|appendSpan" src/daemon/http/` 零命中 |
| 7 | 托盘退出直接 kill 进程或关窗路径误调 `core.stop` | AC-02 `daemon.pid` 断言失败、关窗即停 | WP-1 `tray.rs` quit 流程唯一包含 `core.stop`（grep 恰 1 条在 quit 函数内）；关窗路径只 `hide`；行为断言（pid 不变 + `updatedAt` 推进）兜底 |
| 8 | 布局非纯函数（取时间/读文件）或两次布局结果漂移 | AC-17 架构检查失败、坐标不稳定 | WP-5 `layout.js` 禁 DOM/fs/`Date.now`/`window`（门禁 grep 零命中）；同层按 `order` → 节点 ID 稳定排序；两次 `JSON.stringify` 字节相等断言 |
| 9 | AC-33 悬停夹具覆盖全图造成断言真空（F-19） | 「其余元素降透明度」前半段恒真、判定强度为空 | WP-6 `hover-highlight.test.js` 夹具加与 B 不相邻的节点 E 与边 C→E，断言悬停 B 时 E 降不透明度（§4 WP-6 / §8 落点） |
| 10 | 未知 `node_type` 被丢弃或按标题猜类型 | AC-07/13/14 拓扑缺角 | WP-4 `graph.js` 未知类型按 role 渲染保留 ID；WP-6 `node-rows.js` 类型只读定义层 `node_type`；registry 四类合法性已由主控核查（`decisions.md`），夹具 yaml 直接写盘 |
| 11 | 界面层散落中文字面量或自造文案 | AC-28/31 门禁变红、BR-21 违反 | WP-7 唯一中文落点 `labels.js` 末尾追加；`desktop/ui/**`+`desktop/harness/**` CJK 零命中门禁；托盘文案经 `GET /ui/labels` 取 `DESKTOP_TRAY_*` |
| 12 | 既有测试/核心文件被顺手修改 | D-9/D-10/D-11 红线破、回归面失控 | 逐 WP `git show --stat` 核对只动授权文件；`src/core/**` 等六目录零 diff 作为 WP-9 门禁；发现必须改核心 → 先回需求修订 |
| 13 | 探针/ctl 接缝在生产启动生效或 `.done` 残留误触发 | 生产进程写探针文件、二次运行误触发 | WP-1 `probe.rs` 仅显式传参启用；ctl 文件触发后改名 `.done`；夹具清理逻辑处理 `.done` 残留（纪要 §5.1-3） |
| 14 | 夹具快照启动顺序错，核心对账把 `running` 判成 `interrupted` | AC-03/04/26 等实例状态失真 | 一律按 §3.3 769 行铁序：先空根拉起核心（`instance status INST-001` 返回不存在）→ 再写 `state.json`（`schemaVersion: 2`）→ 最后开界面；每 AC 独立项目根 |
| 15 | 一次并发超 2 个 Agent 触发平台 429 | 批次失控 | 分批固定 6 批、每批 ≤2 并行（§6）；修复类永远单线 |

---

## 8. 与需求的对齐声明 / 冲突清单

本文档不新增需求条目；所有逐字文案、状态名、错误码、AC 编号均以 `requirement.md` v2 为准；两者冲突时**以需求为准**并在实现结论中指出。AC 一条不增、一条不减、一条不合并，`Then` 判定强度不放宽，范围内条目不挪到范围外，不夹带规划外能力。本文档不自行宣布「评审通过」，产出交独立拆分评审 Agent。

### 8.1 主控裁决 A~D 逐条落地

| 裁决 | 内容 | 本文档落点 |
|---|---|---|
| **A** | 桌面入口 `node src/daemon/serve-entry.js --project <root> --desktop`（等价 `createServer({http:true})`），不触碰 `main.js` 命令表 / 两层子命令表 / `USAGE_LINES`；D-11 保持「无」 | §1.1 启动/发现协议、§2.1 `serve-entry.js` / `server.js` 契约（WP-2）、§2.5 硬边界重申；CLI 零改动、零新增子命令 |
| **B** | AC-29 保持用户视角；实现细节收 D-14 不进验收判定；拆分前必须先做最短打包验证 | §1.1「bundle 内 Node 获取方式」（推荐 B：随 bundle 带独立 node 二进制，否决 A 及理由）；WP-1 第一步 = 最短打包验证 + 一页结论 `wp1-bundle-verdict.md`；WP-9 整合期才跑 AC-29 全量真机判定。**重排依据（S-08）**：decisions.md 写「S1 拆分前」验证，本文档重排为「WP-1 第一步（实现期先行）」——依据 D-14 末段「若打包可行性阻塞拆分，先做一次最短打包验证（能否把解释器 + `bin/` + `src/` 塞进 bundle）再回填拆分文档」；WP-1 本身即验证包，最短打包验证就是它的首个契约测试动作（`bundle.test.js` + `wp1-bundle-verdict.md`），与「拆分前验证」语义等价，不算推迟 |
| **C** | U-9 豁免成立：不落盘 `instances/<id>/graph.json`，图只在内存/响应体 | §3 开头「唯一事实来源」声明 + §1.2 被否决项「graph.json 落盘」；§3 数据模型只含三个新落盘文件 |
| **D** | F-15~F-19 随 S1 消化（见 8.2 逐条） | F-15 已修并登记（8.2 第 1 条）；F-16 固化进 §5 验收脚手架规格 + §4 门禁模板；F-17/18/19 落点见 8.2 |

### 8.2 F-15~F-19 逐条落点

| 编号 | 内容 | 落点 |
|---|---|---|
| **F-15** | 需求 331 行口径标题「三条」实列五条 | **已修**：`docs/iterations/iteration-10a/requirement.md:331` 「判定口径（三条，所有 AC 适用）」→「判定口径（五条，所有 AC 适用）」；仅此一处笔误，其余需求正文零改动（模板 §1.2 允许的笔误修正）；本登记即变更记录 |
| **F-16** | 5 条 AC 机检未内联 `test -f`（AC-03/10/26/27/28） | **固化进验收脚手架设计**：§5 交付物 `probe/acc10-*` 规格明确「全部机检命令一律按固化模板生成：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js` + 断言 `# pass ≥ 1`、`# fail 0`，禁全量 glob」；§4 门禁块写入同一模板；S3 验收 Agent 照此执行 |
| **F-17** | 「正在连接守护进程…」瞬态无 BR/AC 断言 | **落点 WP-8**：`desktop/ui/connection.js` 状态机显式含 `connecting` 态；`test/wp13/errors.test.js` 守护进程分支增加中间断言——核心未就绪期间出现 A-4 第一态「正在连接守护进程…」、超 10 秒转失败句 `连接守护进程失败 · 请确认项目目录后重试`。属测试断言增强（补覆盖），不删不改任何既有 AC 判据；若拆分评审认为必须补 AC，按模板 §1.2「只能补」走需求修订 |
| **F-18** | BR-06 中段「实例状态或健康度变化后 2 秒内该行更新」无直接 AC | **落点 WP-3**：`test/wp13/instance-list.test.js` 增加阶段四——对既有运行中实例经 `POST /__test__/graph/pulse`（kind: role）推进一次状态，断言该行 2 秒内更新且由 `instances.changed` 推送触发（`refetch ≥ 1`、无周期轮询） |
| **F-19** | AC-33 夹具悬停 B 覆盖全图、断言真空 | **落点 WP-6**：`test/wp13/hover-highlight.test.js` 夹具图增加与 B 不相邻的节点 E 与边 C→E；断言悬停 B 时「全不透明集合」= 三线 + 四点、且 E 与 C→E 降不透明度成为可裁决断言；移开恢复全集 |

### 8.3 纪要 §9 S1 输入清单逐条对照

| # | 输入 | 落点 |
|---|---|---|
| 1 | 最短打包验证先行（裁决 B） | §1.1 / WP-1 第一步 / §6 第 2 批前置 |
| 2 | U-9 豁免（裁决 C） | §3 数据模型 |
| 3 | 机检模板固化（F-16） | §4 门禁块 / §5 脚手架规格 |
| 4 | toybox BRE 禁令 | §4 门禁块（ERE/rg + 期望结果与退出码）；各 WP 门禁附加项全部 ERE 形态 |
| 5 | 壳夹具直接执行二进制 | §1.3 末条 + WP-1 夹具规范 + §7 风险 2 |
| 6 | 31 词扫描新文件自动覆盖 | §0 退出标准 4 / §4 门禁四件套第 2 条（两轮） |
| 7 | 既有面零改动清单 | §2.5 只读基线 / §0 退出标准 3、5 |
| 8 | F-17/18/19 落点 + F-15 修正 | §8.2 |
| 9 | SSE/节流实现约束 | §1.3 / §2.1 stream.js 契约 / §7 风险 4、5 |
| 10 | AC-26 禁测试专用渲染分支 | §2.2 app.js 约束 + WP-9 验收口径（与 AC-07/14 同批模块） |

### 8.4 纪要 §5 黄色警示处置

1. **黄色警示 1（`open -na` 不继承环境变量）**：已定案——涉及 AC-01/26/29/31/36 的夹具统一为直接执行 bundle 内二进制 `Contents/MacOS/maestro`（继承 shell 环境），禁用 `open -na`；写入 WP-1 夹具规范（§4）与 §7 风险 2。AC-29 的 `env -i` 启动本就要求直接执行，口径自洽。
2. **黄色警示 2（registry 对 human/escalate/subworkflow 的识别）**：**已由主控核实解除**——`src/cli/labels.js:552` `WORKFLOW_NODE_TYPE_INVALID` 明示四类 `node_type` 合法，`src/cli/workflows.js` 已有透传与引用校验（`decisions.md` 核查记录）；AC-07/13/14/26 的夹具 yaml 可直接构造，**无需改 registry/校验器**（与 D-13 冻结一致）。此为既定事实，不是本拆分的新裁决。
3. **AC-19 夹具可读性实测（纪要 §5.2，S-07）**：`.orch/roles/*.yaml` 直写 13 角色的「直写可读性」安排了实测——WP-6 `graph-collapse.test.js` 实测阶段以 `--host mock` 起一次会话并断言 `buildRoleInstances` 读出全部 13 角色、group 计数 8/5（见 §4 WP-6 契约测试）；实测不可读 → 按 §1.2 走需求修订。

### 8.5 需求与代码现状的冲突及裁决

| 编号 | 冲突点 | 依据 | 裁决 | 归属 WP |
|---|---|---|---|---|
| C-01 | `src/daemon/server.js:44` `createServer` 现无 `http` 参数；`serve-entry.js:51` 不传 http | D-10「只新增可选参数」、裁决 A | `server.js` 只加 `http` 可选参数与生命周期挂钩；`serve-entry.js` 只加 `--desktop` 解析透传（现 `parseArgs:130` 已能承接）；其余一行不改 | WP-2 |
| C-02 | `src/persistence/paths.js` 无 `desktop.json` / `views` 路径函数，且该目录 D-10 冻结不得修改 | D-1/D-10 | desktop.json 路径常量落 `src/daemon/http/server.js`；views / projects.json 路径落 `desktop/src-tauri/src/config.rs`；`paths.js` 零改动（只 import 既有函数） | WP-2 / WP-1 |
| C-03 | 「核心不 import CLI」（I1.2 起硬约束）与「`GET /ui/labels` 返回 `labels.js` 文案」并存 | D-2/D-7 明确设计 | 约束的本意是核心不依赖 CLI **渲染**；`src/daemon/http/labels.js` 只读 import `src/cli/labels.js` 的键值做**下发**，中文唯一来源不变、核心编排零 CLI 依赖，不构成违反 | WP-7 |
| C-04 | 桌面列表行（A-1 始终打印工作流中文名 + 健康度）与 CLI `orch status` 行（不打印 `single` 模板名、不显健康度）是两条不同的行 | A-1 明示 | 桌面行由 `desktop/ui/list/list.js` 独立渲染（消费 `DESKTOP_LIST_ROW`）；**不得反向修改 CLI 行**（`render.js` / `main.js` 不动） | WP-3 |
| C-05 | 托盘「退出」需停 daemon，但 D-2 未定义 HTTP core-stop 路由，且 `methods` 表冻结 | AC-02 架构检查（`core.stop` 恰 1 条在 quit 内） | 壳层 quit 经**既有 IPC 管道**发送 `core.stop` 帧（与 `orch core stop` 同协议），随后 SIGTERM 兜底；`desktop/src-tauri/src/` 中该字面量恰 1 处 | WP-1 |
| C-06 | bundle 内 node 二进制来源未在需求指定（U-2 留 S1） | D-14、裁决 B | 构建期从本机 Node 22 复制二进制进 `Resources/runtime/`（构建机需要 node，用户机器不需要）；`package.json` 零新增依赖；WP-1 一页结论登记实测体积与时长 | WP-1 |
| C-07 | AC-29 要求 `which node` 非零的环境可用，本机 node 在 `~/.workbuddy/binaries/...`（不在 `/usr/bin:/bin`） | 环境实测 | 断言成立无需收窄 PATH；WP-1 夹具落定时实测一次并记录 | WP-1 |
| C-08 | `scripts/desktop/build.mjs` 是 D-1/D-6/退出标准 6 的必然产物，但不在 requirement.md 附录 D-10「新增文件」授权清单（S-06） | D-10 清单穷尽性（需求侧缺口，非拆分越权——该文件不在 `src/**` 下） | 登记为「**新增文件对 D-10 清单的补充**」：属桌面构建脚本（`scripts/**`），不进 `src/**` 扫描范围（31 词两轮扫描不涉及）、不进 `package.json` 依赖（零依赖口径不受影响）；需求已定稿，本文档不改 D-10，仅在此登记豁免理由，留 S3/S4 评审复核 | WP-1 |

---

## 附录：拆分质量自检结果（模板 §1.5，交付前逐条勾）

| # | 检查 | 结果 |
|---|---|---|
| 1 | 8 节齐全、标题与顺序一致 | ✅ `grep -n "^## " docs/iterations/iteration-10a.md` → 0~8 节齐、顺序一致（机械验证见下） |
| 2 | 每条 AC 都出现在某个 WP 的「验收口径」里 | ✅ 37/37（§4 映射表 + 机械脚本核对，见下） |
| 3 | 每条 AC 都能在需求里找到同号 Then | ✅ AC-01~AC-37 与 requirement.md v2 连续编号一一对应，零改写 |
| 4 | 所有 WP 的负责文件两两无交集 | ✅ 73 个登记文件（含 4 个被改既有文件 + S-05 新登记的 `desktop/ui/index.html`；S-04 计数为脚本实点，r1 的 71 为漏计 WP-4 harness 与 index.html 所致）逐包唯一；机械脚本核对输出「重叠数：0」（见下；`desktop/ui` / `desktop/harness` 两个**目录名**在 WP-7/WP-9 的门禁命令中出现，属扫描口径引用而非文件归属，按「含扩展名真实文件」口径核验为零交集） |
| 5 | 依赖图无环，且每个 WP 的依赖编号都存在 | ✅ DAG 见 §6：叶子 WP-1/4/7、汇合点 WP-9，箭头单向无环；依赖编号均存在 |
| 6 | §0 退出标准逐条可判定 | ✅ 7 条全部含数字或逐字口径（37/0/0、差集 0、1157、31 词 exit 0、deps=0、25 行、3s/500ms/1s/5s） |
| 7 | §2 每个文件都标注了归属 WP | ✅ 逐文件标注（§2.1~2.4） |
| 8 | §6 有「契约先冻结点」与「整合检查点」 | ✅ 8 个冻结点 + 整合检查点命令与预期数字 |
| 9 | §7 每条风险都有具体处置 | ✅ 15 条全部点名文件/函数/AC |
| 10 | §8 声明「不新增需求条目，冲突以需求为准」 | ✅ §8 开头声明 + 裁决/建议/输入/冲突四表 |

机械自检输出（模板 §1.5 脚本，实跑，**r2 复跑**）：

```
拆分文档未覆盖的 AC: 无（AC-01..37 连续满覆盖 37 行，每行恰一个主责 WP）
真实文件登记数: 73 | 去重后: 73 | 重叠数: 0 | 触碰不得修改清单: 无
DAG 无环: true | 所有依赖编号存在: true | 注入依赖 2→3/2→7/4→5/4→6 未计入 DAG 边: true
批次: 1{7,4} 2{1,2} 3{3,5} 4{6} 5{8} 6{9}（共 6 批）| 批内依赖边: 0 | 上游批次均在前: true
import 声称 ↔ DAG/批次 三方一致: true（S-02/S-03 四处跨包依赖均为注入/惰性动态 import，
  声明批次号与批次表一致，WP-2/WP-3/WP-8 三处同步齐备；残留静态 import 声称: 无）
```
