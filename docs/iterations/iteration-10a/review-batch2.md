# I1.10a 批次 2 实现评审记录（WP-1 + WP-2）

> 评审人：实现评审工程师（独立、只读）。评审对象：`b8a9bc3`（WP-1 桌面壳，16 文件）+ `f0fee5c`（WP-2 daemon 桌面通道，8 文件）。
> 判据：`docs/iterations/iteration-10a.md`（r2）、`requirement.md`（v2）AC-01/02/29/31/36 与 AC-08/09/10/27/37 锚点 + 附录 D-1/D-2/D-10/D-13/D-14、`decisions.md`（裁决 A~G + 更正）、`wp1-bundle-verdict.md`、批次 1 契约（`git show e4f22d0` / `5c9ffac`）。
> 既定口径（不作为缺陷）：routes.js 归 WP-3（批次 2 REST 走 503 降级）；`createHttpServer` 追加可选参 `generation/startedAt/staticRoot`（WP-2 已声明）；layout 坐标断言降级为投影对象 deepEqual（WP-5 批次 3 后增强）；verdict 选路径 ①。

## §0 总判

**PASS**（阻断 0 / 建议 6：B-05~B-10）。

- 两提交文件集合与拆分文档 WP-1（16 文件）/ WP-2（8 文件）清单精确一致，禁改清单零触碰，`server.js` +68 行恰为 D-10 授权的「http 参数 + 启动/关闭挂钩 + 私有接线段」，`serve-entry.js` 恰 1 行，`package.json` 恰 `scripts.desktop:*`，零 npm 依赖。
- 批次 2 新测试 33/33 全绿；全量串行复跑 **1247 tests / 5 fail，失败集合 ⊆ 基线 8 条，差集 = 0**，条数 1247 ≥ 1157。
- verdict 可复现性抽验全过（产物存在、包内 node v22.22.2 可执行、`{bin,src}` 结构一致、121M、CSP null、ad-hoc 签名）。

**复核方式（实跑命令清单）**：

```bash
git show b8a9bc3 / git show f0fee5c          # 逐文件 diff 审读
git status --porcelain                        # 未跟踪面（Cargo.lock / gen/）
grep -REn "env::var\(\"PATH\"\)|Command::new\(\"node\"\)" desktop/src-tauri/src/   # exit 1 零命中
grep -REcn "core[.]stop" desktop/src-tauri/src/                                    # 恰 1 条，tray.rs:145，-B8 见 fn quit
grep -Rn "open -na\|open -a" test/wp13/ desktop/harness/ scripts/                  # exit 1 零命中
grep -REn "new EventEmitter|saveState|instance-store|appendSpan" src/daemon/http/  # exit 1 零命中
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>    # exit 0（28 文件）
node -p "Object.keys(require('./package.json').dependencies||{}).length"           # 0
"$APP/Contents/Resources/runtime/node" -e "console.log('ok')"                      # bundled-node-ok v22.22.2
NODE_ENV=test node --test --test-concurrency=1 <批次2 的 8 个 test/wp13 文件>       # 33 pass / 0 fail（1m56s）
NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"                 # 1247 / 5 fail / 差集 0（13m18s）
serve-entry.js --desktop 起服冒烟：desktop.json 出现 → lsof 仅 127.0.0.1 → Bearer GET /ui/labels 200（144 键）
  → 无凭据 401 → /instances 503 NOT_READY → kill 后 desktop.json 删除
```

## §1 边界合规

| 项 | 结果 | 证据 |
|---|---|---|
| ① 文件集合 | **PASS** | `b8a9bc3` 16 文件 = WP-1 清单（src-tauri 9 + build.mjs + package.json + verdict + 4 测试）；`f0fee5c` 8 文件 = WP-2 清单（server.js/serve-entry.js 改 + http/{server,stream}.js 新 + 4 测试）。零多、零少 |
| ② 禁改清单 | **PASS** | 两提交 diff 中 `src/core/**`、`src/cli/{main,render}.js`、`src/persistence/**`、`src/templates/**`、`src/registry/**`、既有 `test/**` 零触碰 |
| ③ server.js +68 行逐行核 | **PASS** | 4 个 hunk：`http = false` 形参（+1）；listen 挂钩（http:true 时 `startDesktopChannel()`，+11）；close 挂钩（`await stopDesktopChannel()`，+4）；私有段 `startDesktopChannel`/`stopDesktopChannel`（+52）。`methods` 表、错误映射、`shapeSnapshot`、事件订阅逻辑零改动。私有段语义 = 惰性动态 import + 组装注入对象 + 生命周期与失败降级日志，未超出「挂钩」接线语义；注入 readers（`traceStore.load` / `activeBus.replay` / `traceLog.readTraces`，server.js:582-584）与该文件自身 `instance.trace` 处理器（:234/:247/:259）用同一批只读 API，**只读成立**。写失败降级为 `DESKTOP_START_FAILED` warn，IPC 主通道不受影响（D-1） |
| ④ serve-entry.js | **PASS** | 恰 1 行：`createServer({ ..., http: args.desktop === true })`；`loadOrchestrator` 与降级桩未动 |
| ⑤ package.json | **PASS** | 恰追加 `"desktop:build": "node scripts/desktop/build.mjs"`；dependencies/devDependencies 不存在 |
| ⑥ 零 npm 依赖 | **PASS** | deps 计数 0；Cargo 依赖仅在 `Cargo.toml`（tauri / single-instance / dialog / serde，D-10 允许 Cargo 侧） |
| ⑦ 未跟踪卫生 | **PASS**（附建议 B-10） | `desktop/src-tauri/Cargo.lock` 与 `gen/` 未跟踪、未随提交——与 16 文件清单一致；处置建议见 §6 B-10 |

## §2 WP-1 桌面壳契约核对表（AC-01/02/29/31/36）

| 项 | 结果 | 证据 |
|---|---|---|
| ① 打包产物抽验 | **PASS** | `Maestro.app` 存在（121M）；`Contents/MacOS/maestro` 可执行；`Resources/runtime/node` 可执行且实跑输出 v22.22.2；`Resources/{bin/orch.js, src/daemon/serve-entry.js,...}` 与 verdict 记载结构一致；`Resources/desktop/ui` 缺省符合 verdict「存在时复制」口径 |
| ② 收窄环境直执行 | **PASS** | `bundle.test.js:130-142` 以 `env: {PATH:'/usr/bin:/bin', HOME, TMPDIR}` spawn 壳二进制（等价 `env -i`），先断言该 PATH 下 `which node` 非零；测试/harness/scripts 全域 `open -na`/`open -a` 零命中（黄色警示 1） |
| ③ AC-01 探针链 | **PASS** | ready（visible/title/view）+ `ready.t - launch.t ≤ 3000` + tray-created；desktop-shell.test.js / bundle.test.js 双覆盖。`probe.rows`（A-1 两行）数据面属 WP-3/WP-8，verdict 已登记后置，不判缺 |
| ④ AC-02 关窗/退出链 | **PASS** | 事件序列 `close-window(visible=false) → tray-still-present(created=true) → quit-confirm-shown（文案逐字 A-6，:255）→ quit(daemonStopped=true)`；`daemon.pid` 关窗前后相等；`updatedAt` 推进断言（U2≠U1）；退出后管道不可连；`core.stop` 恰 1 条且 `-B8` 可见 `pub fn quit`（tray.rs:141-149） |
| ⑤ AC-29 用户视角 | **PASS** | 收窄环境 + ready ≤3000 + tray-created + `which node` 非零前置证明 + ctl `open-instance` → `probe.view === 'graph'`（bundle.test.js:178-184）；AC-29 架构 grep 零命中 |
| ⑥ AC-31 项目根接缝 | **PASS**（附建议 B-07） | `config.rs:69-88` 实现顺序 `--project` > `MAESTRO_PROJECT_ROOT` env > projects.json 首项 > 提示页；三现场探针 `project-missing` / `project-invalid`（A-3 逐字）/ `instances` 全过 |
| ⑦ AC-36 单实例 | **PASS** | 第二次启动无第二个 `ready`、`activated` 出现（探针写入第二实例 argv 指定的 probe 文件，single-instance.rs 修正与 verdict 途记 4 一致）、pid 相等、close-window 后 tray-open → `visible:true` 且视图仍 `instances` |
| ⑧ build.mjs | **PASS** | 纯复制 + `cargo build` + 手写组装 + ad-hoc 签名；占位 UI/图标生成到 `target/`（gitignore 覆盖），`src-tauri/` 下无清单外仓库文件 |

## §3 WP-2 桌面通道契约核对表（AC-08/09/10/27/37 + S-02 接缝）

| 项 | 结果 | 证据 |
|---|---|---|
| ① 接口表 vs D-2 | **PASS** | `GET /instances`、`POST /instances`、`GET /workflows`（三者 503 NOT_READY，known-caliber）；`GET /instances/stream`（500ms 合并）、`GET /instances/:id/graph`、`GET /instances/:id/graph/stream`、`GET /ui/labels`、`GET /ui/*` 全部就位；SSE 帧名六种齐全、`data` 含 `{rev, instanceId, type, key, payload}`、重连首帧恒 `graph.snapshot`（graph-stream.test.js:383-419） |
| ② 节流 | **PASS** | `createConnectionThrottle` 注入 `now/setTimer/clearTimer` 纯调度器；虚时钟断言 999ms 不推 / 1000ms 推最后一次 / 1001ms 开新窗至 2001ms / 单次变更窗口末仍推 / 键间独立（graph-throttle.test.js:77-151）；role 帧即时、`session.indicator` 透传 rev 不变；AC-37 双车道结构隔离断言 + 实测 role ≤500ms 不被连接线窗口阻塞（graph-parallel.test.js:217-231） |
| ③ rev 白名单 | **PASS** | `stream.js:32` `import { isRevEvent } from '../graph.js'`（批次 1 冻结契约复用，未自造 seq 全量比）；`session.state`/`execution.summary`/`health` 不推进 rev 且有专门断言（graph-throttle.test.js:411-462） |
| ④ POST /instances 与 pulse | **PASS** | POST /instances 批次 2 走 503 且断言 `startRunCalls === 0` 无旁路（known-caliber：透传 `run.start`/`cwd`/`earlyReturn` 属 WP-3）；`POST /__test__/graph/pulse` 请求时闸 `NODE_ENV !== 'test' → 404` + 源码结构断言双保险；pulse 只改内存投影，state.json/events.jsonl 哈希不变断言在场（graph-stream.test.js:456-490） |
| ⑤ desktop.json 生命周期 | **PASS** | 先 `listen` 后 `writeJsonAtomic`；token 32 字节 hex（64 位 hex 断言）；401 body 仅 `{"error":"UNAUTHORIZED"}`；close（含 core.stop/SIGTERM 路径）删除；写失败（路径被目录占位）时 IPC 仍 `ok:true`、desktop.json 不被破坏（http-channel.test.js:290-316）；复用 `atomic-write.js` 只 import 不改 |
| ⑥ 回归红线 | **PASS** | 专项测试「without the http switch nothing listens」：`server.isListening === true`（IPC 活）、`desktop.json` 不出现、`address().httpPort ?? null === null`；http:true 侧 lsof 逐行断言 `127.0.0.1:<port> (LISTEN)` 且 `0.0.0.0`/`*:` 零命中；评审冒烟同证 |
| ⑦ 三组只读 ERE 检查 | **PASS** | `new EventEmitter`、`saveState|instance-store|appendSpan` 于 `src/daemon/http/` 零命中（本人实跑）；`startRun` 零命中（该标识符只在 WP-3 契约中出现，本批 http 层无） |
| ⑧ S-02 接缝 | **PASS** | `registerRoutes(table)` / `registerLabels(fn)` 注入优先（两条专项测试）；未注入时惰性动态 `import('./labels.js')` 兜底（消费批次 1 `createLabelsRoute`）、`import('./routes.js')` 容缺；REST 未落地路径结构化 `503 {"error":"NOT_READY"}` 不含实例数据；`GET /ui/labels` 真通 **144 键**（测试 + 冒烟双证，键集合与 `labelKeysPayload()` 精确相等） |
| ⑨ 零中文与 31 词 | **PASS** | WP-2 自有文件（http/server.js、http/stream.js）CJK 零命中（`src/daemon/http/labels.js` 的中文属批次 1 冻结文案源，D-2/D-7 明确设计）；31 词 `src/core,src/daemon` 扫描 exit 0 |

## §4 测试质量与门禁复跑输出（差集结论）

- **新测试归属**：8 个文件全部在 `test/wp13/`，既有测试文件零改动（两提交 diff 核对）。
- **AC 锚点对照**：AC-01/02/29/31/36 → bundle/desktop-shell/project-guard/single-instance 四件；AC-08/09/10/37 → graph-stream/graph-throttle/graph-parallel 三件；AC-27 通道面 → http-channel。机检形态 `test -f + # pass ≥1 / # fail 0` 全部满足。
- **批次 2 新测试串行复跑**：`--test-concurrency=1`，**33 tests / 33 pass / 0 fail**（1m56s，含 4 个真进程壳测试）。
- **全量串行复跑（裁决 F 口径）**：`NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"` → **1247 tests / 1241 pass / 5 fail / 1 skipped**（13m18s）。5 条失败逐字比对基线：`core.stop：先回包再断连…`、`cursor.json 并发消费 20 次不重复`、`main：--cwd 相对当前 shell 目录解析…`、`task-loop 审核提示词给绝对路径…`、`早返回：turn-delay 3000ms 下 startRun 1s 内 resolve…`——**全部 ∈ 基线 8 条，超基线差集 = 0**（基线中另 3 条本轮未复现，属负载型 flake，差集口径不受影响）。条数 1247 ≥ 1157 只增 ✓，与 verdict 记载的 1247 一致。
- **31 词两轮**：`src/core,src/daemon` exit 0（28 文件）；`desktop/ui` 目录批次 3 才落地，本轮扫描对象尚不存在（预期，非缺陷；`desktop/harness` 单文件扫描 exit 0）。
- **零依赖**：0 ✓。

## §5 verdict 可复现性

- **产物抽验**：按文档路径 `desktop/src-tauri/target/release/bundle/macos/Maestro.app` 存在；`Contents/MacOS/maestro`、`Contents/Resources/runtime/node`（实跑 v22.22.2）、`Contents/Resources/{bin,src}` 与 verdict bundle 结构图逐项一致；总体积 121M 与记载一致；`Resources/desktop/ui` 缺省与「存在时复制」记载一致。
- **构建幂等性**：`scripts/desktop/build.mjs` 审读——占位 UI 与图标每次确定性再生成、cargo 增量构建、bundle 先 `rmSync` 后从零组装、ad-hoc 签名 `--force`；**无非确定性步骤**，`npm run desktop:build` 幂等成立（未重跑 42min 全量构建，符合评审口径）。
- **记载一致性**：`tauri.conf.json` `"csp": null` ✓；`Cargo.toml` 未配镜像（crates.io 直连）✓；签名 ad-hoc（`codesign --sign -`，bundle 实测 `Format=app bundle ... x86_64`）✓；未要求 notarization ✓；途中修复 7 条（含 `/bin/kill` 绝对路径、`try_wait` 8s 窗口）与代码现状逐一对应（spawn.rs:146-153、tray.rs:202-226）。
- **边界登记**：verdict 主动登记的 4 条边界（`--desktop` 参数当时被忽略属 WP-2、壳内兜底文案、`probe.rows`/`graph-shown` 数据面后置、Cargo.lock/gen/ 不随批提交）与实际相符。

## §6 修复清单（建议级，编号承接批次 1 的 B-01~B-04）

| # | 位置 | 原文/现状 | 违反/风险 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| B-05 | `desktop/src-tauri/src/spawn.rs:176-179` ↔ `src/daemon/http/server.js:319-330` | 壳经 `win.navigate("http://127.0.0.1:<port>/ui/")` 加载主窗口，而 WP-2 按.D-1 对**所有**请求强制 Bearer（无凭据 401）；WebView 导航无法携带 Authorization 头，D-1 与拆分 §1.1「WebView 首页 URL 即 `http://127.0.0.1:<port>/ui/`」两契约**并立不可满足**，实机主窗口将渲染 401 JSON | 双方各自忠实于自身契约，均不违规；但 WP-8 装配与 AC-26 e2e 会被此接缝卡死，且需求/拆分均未定义 token 送达机制 | 提请主控裁决（建议进 decisions.md）：如「仅 `GET /ui/`（首次导航）接受 `?token=` 查询参数且不落日志」，或壳经初始化脚本注入凭据；裁决后 WP-1/WP-2 各改一处 | 建议（**WP-8 开工前必须先决**） |
| B-06 | `src/daemon/http/server.js:369-381、215-315` | WP-2 把 `GET /instances/:id/graph` 实现为内置路由，且 `resolveWorkflowDef`/`resolveSubWorkflows` 工作流定义解析逻辑落在 WP-2 层；拆分 §2.1 该 REST 路由归 WP-3 `routes.js`（批次 2 形态应 503） | 批次 3 `routes.js` 经 `fallbackDispatcher` 惰性承接时排在内置路由**之后**，其图路由将被遮蔽成死代码，形成双实现；数据面复用 `buildGraph`、测试覆盖良好，故不判越权阻断 | 批次 3 合入 `routes.js` 时由主控裁决：删除内置图路由交 WP-3，或明确内置优先并在 WP-3 契约中登记；定义解析建议下沉为共享注入（接缝已按 `loadWorkflowDef` 形状预留） | 建议（**批次 3 合入时必须处置**） |
| B-07 | `test/wp13/project-guard.test.js:177-187` | AC-31 第三现场用 `--project valid` 直传进列表；需求 Then（requirement.md:680-681）是「写入 projects.json 后**不带 --project** 再次启动」 | `resolve_project` 的 env 与 projects.json 两级解析（config.rs:72-78）零机检，记住项目根的用户语义未被测试钉住 | 补强：第三现场改为夹具直写 `MAESTRO_CONFIG_DIR/projects.json` 后无参启动断言 `view === 'instances'`；可加一条 env 变量级用例 | 建议 |
| B-08 | `desktop/src-tauri/src/config.rs:30-36` | `Labels::default()` 壳内兜底 7 键中文文案（与 A-3/A-6 逐字一致） | 与 D-7「新增中文只追加到 labels 末尾」存在口径张力；verdict 已登记（AC-31 架构检查只扫 `desktop/ui`+`desktop/harness`，且 project-missing 现场无 daemon 通道、兜底结构上必要） | 在 `decisions.md` 显式登记为对 D-7 的有限豁免（值域仍以 labels 模块为唯一来源、通道就绪后被 `/ui/labels` 覆盖），避免 S3/S4 评审重复争议 | 建议 |
| B-09 | `desktop/src-tauri/src/spawn.rs:166-184` | `wait_desktop_channel` 轮询 100 次 × 100ms = 上限 10s；拆分 §1.1 规定 100ms / 上限 30s | 常数偏差；daemon 冷启实测 ~1.1s，实际无影响 | 轮询上限改 300 次与拆分对齐，或在拆分文档登记实测口径 | 建议（微） |
| B-10 | `desktop/src-tauri/Cargo.lock`、`desktop/src-tauri/gen/`（未跟踪） | 两者均未随批提交（与 16 文件清单一致，不算违规）；verdict 仅登记「留在本地」 | Cargo.lock 不入库则评审/CI 重新解析依赖存在 crates.io 快照漂移风险（42min 构建、461 crates 的可复现性打折）；`gen/` 每次 `cargo build` 自动再生，入库制造噪音 | **Cargo.lock 建议入库**（应用仓库常规做法，锁定依赖树；verdict 的「评审侧会重新解析」恰是入库理由）；**`gen/` 建议加入 `.gitignore`**。不判阻断，留批次 3 前处置 | 建议 |

## §7 批次 3（WP-3/WP-5）开工前必须先决的点

1. **B-06**：`GET /instances/:id/graph` 内置路由与 `routes.js` 惰性承接的遮蔽关系必须在 WP-3 合入前裁决（删内置 or 明确优先级），否则接缝静默失效。
2. **B-05**：WebView 鉴权 token 送达机制需主控裁决——WP-3 的 `collect.mjs`/`render-list.mjs` 走带 Bearer 的直连不受影响，但 WP-8 装配被卡；最迟 WP-8 开工前落定，建议随批次 3 一并裁决。
3. **B-10**：`Cargo.lock` 入库 / `gen/` 忽略的处置随批次 3 顺手落地，避免后续批次反复重解析。

> 其余建议项（B-07~B-09）不卡批次，登记给 S3 验收与收口前消化。
