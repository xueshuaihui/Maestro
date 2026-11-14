# I1.10a 批次 6 实现评审记录（WP-9 回归守护与端到端整合）

> 评审对象：`310e6d8`（`test/wp13/{regression,acceptance-e2e,readonly-local}.test.js` 3 新增 + `desktop/harness/graph-dump.mjs` R-01 修复；4 文件 / +1506−2）
> 评审依据：`docs/iterations/iteration-10a.md` r2 §4 WP-9 / §6 冻结点 6 / §7 风险 14 / §8.4；`requirement.md` v2 AC-26/27/28、§3.1 五条、§3.3、附录 D-1/D-2/D-5/D-8/D-9/D-11；`decisions.md` A~R；`review-batch5-round3.md` §5。
> 方式：只读 + 本记录；所有命令均在本机实跑；`NODE_OPTIONS` 注入 shim 会拒绝测试夹具的 `mkdir`，故测试统一 `env -u NODE_OPTIONS`；全量测试串行 `--test-concurrency=1`。

## §0 总判

**FAIL。阻断 2（B-33 / B-34）；建议 6（B-35~B-40）。**

总判理由：AC-26 的壳面探针链没有按冻结契约闭合——`rows` 探针事件根本不存在，`graph-shown` 是 ctl 合成事件且不携带 `nodes/edges/dangling`，列表与图数据来自测试预起的另一份 daemon，而不是壳窗口；更关键的是**用现有旧 bundle 实跑该用例仍 2/2 全绿**，而旧包既无 `Resources/desktop/ui`，包内 `server.js` 又只认 Bearer，窗口不可能渲染列表/图。也就是说，当前用例对「用户是否真的看到列表与流程图」不敏感，AC-26 只到「数据面 + 纯模块」层，未到真实窗口链路。

### 复核方式（实跑命令与结果）

| 命令 | 结果 |
|---|---|
| `git show --stat 310e6d8` / `git show --check 310e6d8` | 恰 4 文件（3 新增 + `graph-dump.mjs`）；`--check` rc 0 |
| `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 test/wp13/regression.test.js` | `# tests 8 / # pass 8 / # fail 0`，15.7s |
| `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 test/wp13/acceptance-e2e.test.js` | `# tests 2 / # pass 2 / # fail 0`，3.6s（**但壳面有效性见 B-33/B-34**） |
| `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 test/wp13/readonly-local.test.js` | `# tests 1 / # pass 1 / # fail 0`，1.2s |
| `env -u NODE_OPTIONS -u FORCE_COLOR NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"` | `# tests 1368 / # pass 1362 / # fail 5 / # skipped 1`，9m56s；失败 = `NFR-02 verifyProducts`、`AC-04`、`task-loop 审核提示词`、`core.stop`、`main --cwd`，全部 ⊂ 基线 8 条 + R-08 允许的 AC-04，**差集 = 0** |
| 31 词两轮 / CJK / 宿主分支 / deps / USAGE | 由 `regression.test.js` 第 4~8 用例执行，8/8 pass |
| `graph-dump.mjs --instance` 与 `--payload --project` 两分支 | 均 `status 0`；图例 2 行逐字、hover `opaqueIds=3 / dimIds=2`；显式 `legend:null/hover:null` 被补齐；`nodes/edges` 与首次导出逐字相等 |
| 旧 bundle 检查 | `Contents/Resources/` 仅 `bin / runtime / src`，**无 `desktop/`（无 `desktop/ui`）**；包内 `src/daemon/http/server.js:318-330` 只认 `Authorization: Bearer`；`Maestro.app` mtime = **2026-11-13 02:15** |

> 环境说明：第一次全量运行出现 `AC-41`（`test/wp11/purity.test.js:147`，`node -e` 输出被 ANSI 包裹成 `\x1b[33m0\x1b[39m`），单跑该用例通过；第二次全量 1368/1363/4/1，第三次 1368/1362/5/1。该条属环境着色偶发，不计入差集。直接手跑 prompt 给的 `purity-check.mjs --dirs src/core,src/daemon,desktop/ui` 两次被本机 sandbox 以 SIGTERM(137) 中断（`/dev/null`/日志资源瞬态错误），改由 `regression.test.js` 内同一 `purity-check.mjs` 调用覆盖：两轮 × 两目录均 exit 0，未降低扫描口径。

---

## §1 边界合规

**结论：PASS。**

| 检查 | 结果 |
|---|---|
| 恰 4 文件 | `git show --numstat`：`acceptance-e2e.test.js +522`、`readonly-local.test.js +386`、`regression.test.js +576`、`graph-dump.mjs +22/−2`；无第 5 文件 |
| `graph-dump.mjs` 只修 R-01 | 新增 `mergeSegments()`，两处调用点由 `emit({...segments, ...source})` 改为 `emit(mergeSegments(source, segments))`，另加 JSDoc；无 legend/hover 段生成逻辑、无 CLI 参数、无其它行为改动 |
| `src/**` / `desktop/ui/**` / 其它 harness / 既有测试 / `package.json` / `desktop/src-tauri/**` | 零 diff（`git show --stat` 逐项核对） |
| 零 npm 依赖 | `package.json` 未改；`dependencies` 长度 0（`regression.test.js` 断言） |
| D-10/D-11 | 未改任何既有测试断言；`graph-dump.mjs` 属 WP-4 文件，但裁决 L 明令 R-01 必须在批 6 修，属授权改动，不计越权 |

`graph-dump.mjs` 的 `mergeSegments` 对既有 `nodes/edges` 导出无影响：`...base` 保留原字段，只覆盖 `legend/hover` 两个键；`--instance` 分支的 `buildGraph` 不产出这两个键，行为与修复前一致。

---

## §2 AC-26 核对表（端到端探针链）

**结论：FAIL（部分闭合）。**

| 项 | 需求锚点 | 实测 | 判定 |
|---|---|---|---|
| `ready` | `ready.t - launch.t ≤ 3000`、`visible=true`、`title=Maestro`、`view=instances` | 壳面用例真跑；本评审手动启动旧包得 `launch 1794613998021 → ready 1794613998813 = 792ms`；用例断言通过 | **PASS** |
| `rows` | AC-26 机检 `探针 ready → rows → ...`（`requirement.md:627`）；§6 冻结点 6 / §2.3 的探针事件全集含 `rows`（`iteration-10a.md:147,511`） | **壳层无 `rows` 事件**：`probe.rs` 只发 `ctl-fired` 等；`tray.rs/main.rs` 无 `rows`；`desktop/ui` 也无 `rows` 探针。用例第 465-474 行改为「从测试预起的 daemon 取 `/instances` + `renderListRow`」 | **FAIL（未实现冻结事件）** |
| `graph-shown` | `graph-shown(nodes=..., edges=..., dangling=0)` | ctl `open-instance/<id>` 只调 `tray.rs:114-124`：设置 `view="graph"` 并发 `{instanceId, view}`，**无 nodes/edges/dangling**；`app.js:126-142` 虽构造了带三字段的 `graph-shown`，但 `transport.probe` 只写 `window.__MAESTRO_PROBE__`（`app.js:1776-1779`），全仓无任何 Rust 侧写入该全局 → 该探针是死代码。用例第 476-488 行的 `nodes/edges/dangling` 来自另一条 `/instances/:id/graph` 请求，不是壳事件 | **FAIL（合成事件 + 数据面替代）** |
| `closed` | `window.visible === false` + `tray-still-present` | ctl `close-window` → `tray.rs:131-137` 发 `close-window` 与 `tray-still-present`；用例断言通过 | **PASS** |
| `daemon.pid` 前后相等 | 守护进程 pid 不变 | 用例比较 `core.json` 关闭前后 pid；但该 daemon 是**测试自己预起**的（`acceptance-e2e.test.js:426`），不是壳 spawn 的那一份（`spawn.rs:25-52`）；`ready.daemon.pid` 从未被断言 | **部分 PASS（对象错位，见 B-35）** |
| 关窗后 `instance status` | 仍可读 | 真跑 `bin/orch.js instance status INST-001`，exit 0 且首行匹配「运行中」 | **PASS** |
| 禁 `open -na` | 直接执行 `Contents/MacOS/maestro` | 用例 `spawn(SHELL, ...)`，无 `open -na` | **PASS** |
| 壳产物不存在时 skip | 显式、理由诚实 | `if (!fs.existsSync(SHELL)) t.skip(...)`，理由写明「bundle 不存在」；但**只判存在、不判时效**，旧包存在即当真跑（B-34） | **部分 PASS** |

### `rows` 来源判定

AC-26 的 **Then** 写的是「列表两行逐字为 A-1，行内有健康度，排序把需关注放第一行」——这是用户可见列表行，不是某个事件名。但同一 AC 的**机检**明确点名 `探针 ready → rows → graph-shown(nodes=..., edges=..., dangling=0) → closed`，且拆分文档 §6 冻结点 6 把 `rows` 列入壳 ↔ daemon 协议的事件全集。按「AC 的 Then/And > 附录 > 规划 > 代码现状」的优先级，Then 本身允许「同一渲染模块」的 harness 判定（§3.1 口径 1），但机检与冻结点 6 要求的 `rows` 事件是**协议层契约**，不能由数据面替代。故本项判 **部分闭合**：列表文本与图拓扑的数据面证据成立，壳窗口可见内容的证据不成立；S3 必须补 `rows` 探针（或由主控显式裁决「接受数据面 + 同模块」并改写机检口径），否则 AC-26 只能判「部分通过」。

### 旧包取证有效性

无效。`Maestro.app` 构建于 **2026-11-13 02:15**，早于 WP-8（`46af77a`，11-14 02:49）、裁决 M（`9c9a50a`，03:31）、Q（`dd178e1`，03:56）、R（`3886927`，05:31）、R-09/R-10（`799b792`，06:32）。包内：
- `Contents/Resources/desktop/ui/` 不存在（`ls` 只有 `bin/runtime/src`）；
- `Contents/Resources/src/daemon/http/server.js:318-330` 仅认 Bearer，无裁决 R 的静态免鉴权；
- 壳导航即使带 `?token=`，旧 server 也会 401；窗口无法加载 `index.html`/`app.js`。

在该旧包上跑 `acceptance-e2e.test.js` 仍 2/2 pass，证明该用例的壳面断言对「窗口是否真的画出列表/图」不敏感。**S3 的 AC-01/26/29/31/36 壳面证据必须先重建 bundle 后才有效。**

---

## §3 AC-27 核对表（只读与本地性）

**结论：PASS（附 2 条建议）。**

| 项 | 需求锚点 | 实测 | 判定 |
|---|---|---|---|
| 两份文件哈希 | `state.json` / `events.jsonl` 前后 `sha256` 相等 | `sha256File()` 对文件字节求 sha256（非 mtime）；前后相等断言通过 | **PASS** |
| 四组状态 deepEqual | 节点/会话/交接包/升级 | `fourGroups()` 取 `nodes/sessions/handoffs/escalations`，前后 `deepEqual`；并额外断言整份 `state.json` 不变 | **PASS** |
| `.orch` 文件面 | 只新增 `.orch/desktop/views/<id>.json` | `snapshotTree()` 对 `.orch` 全部 regular file 求哈希；`added` 恰 `desktop/views/INST-001.json`，`removed=[]`，`changed=[]` | **PASS（但 views 文件由测试手写，见 B-36）** |
| 数据面 401 | 无凭据 401、不含实例数据 | 真 HTTP：`/ui/labels`、`/ui/labels?token=`、`/instances`、`/instances/stream`、`/instances/INST-001/graph`、`/workflows` 全部 401，正文逐字 `{"error":"UNAUTHORIZED"}`，不含 `INST-001`；`POST /instances` 无凭据 401 | **PASS** |
| 静态面匿名 200 | 裁决 R：静态资源免鉴权 | 真 HTTP：`/ui/` 200 `text/html`，`/ui/app.js` 匿名 200 且与 Bearer 正文逐字相同 | **PASS** |
| 仅回环监听 | `lsof` 每行 `127.0.0.1:<port>`；无 `0.0.0.0` / `*` / `[::]` | `lsof -nP -iTCP:<port> -sTCP:LISTEN` 每行断言含 `127.0.0.1:<port>`，并显式否定 `0.0.0.0`、`*:<port>`、`[::]`；`lines.length > 0` | **PASS** |
| 读序列 | 列表/图/缩放/拖拽/聚焦/看板/未开始开关/刷新三次 | 列表与图走真 HTTP；缩放/平移/拖拽/聚焦/看板/悬停走 `desktop/ui` 纯模块；重复刷新三次走真 HTTP | **PASS（无真实 DOM/SSE，AC-27 只判状态不变）** |
| 壳层写路径 | 拖拽只写 `.orch/desktop/views/` | 测试手写 `views/INST-001.json`，再用 `config.rs` 正则 + `desktop/ui` 无 `writeFile` 做结构兜底；注释已诚实说明「壳层写路径」 | **PASS（结构断言，见 B-36）** |

建议：数据面 401 列表未包含 `/instances/:id/graph/stream`（图 SSE），见 B-37；拖拽真实写路径仍未在壳内实测，见 B-36。

---

## §4 AC-28 核对表（零依赖 / 中文 / 纯净 / 基线差集）

**结论：PASS（附 2 条建议）。**

| 项 | 实测 | 判定 |
|---|---|---|
| `dependencies === 0` | `package.json` 读取 `Object.keys(dependencies ?? {}).length === 0` | **PASS** |
| `USAGE_LINES === 25` | 断言 25 行，且第 25 行逐字 `  orch workflow dry-run ...` | **PASS** |
| 31 词两轮 | `WORDS_31.length === 31`；两轮 × `src/core,src/daemon` 与 `desktop/ui` 调 `purity-check.mjs --forbid <31 词>`，四组均 exit 0 | **PASS** |
| CJK 零命中 | `desktop/ui` + `desktop/harness` 全部文本文件按 CJK 正则扫描，命中数组为空 | **PASS** |
| 无宿主分支 | `src/core` + `src/daemon` 的 `.js` 扫描 `switch(host)` / `if (host ==/!=`，零命中 | **PASS** |
| 基线清单来源 | 需求 §3.3 登记的是 `docs/iterations/iteration-7/baseline-failures.txt`；`test/fixtures/` 无该文件（只有 `purity-check.mjs` / mock 宿主等工具）。测试改读 docs 路径，**合理**；无需在 `test/fixtures` 复制副本（复制会造成双事实源，且需求已定点） | **PASS** |
| 基线清单格式 | 恰 8 行、无重复、含 `NFR-02:` / `core.stop` / `task-loop 审核提示词`；`test/fixtures/purity-check.mjs` 与 `mock-acp-agent.js` 存在 | **PASS** |
| 不自递归跑全量 | 明确注释「不在本文件内跑全量，避免自递归」，只校验清单存在与格式 | **PASS** |

建议：基线清单固定 8 条，而裁决 R 已把 AC-04 登记为「失败集合扩为 9 条」；测试 `lines.length === 8` 是硬断言，S3 若把 AC-04 写进清单会红（B-39）。另外本文件不校验全量条数 ≥1157（B-38），需主控回执承担。

---

## §5 R-01 闭合与 `graph-dump` 回归

**结论：PASS。**

修复内容（`desktop/harness/graph-dump.mjs:237-255`）：

```js
function mergeSegments(source, segments) {
  const base = source !== null && typeof source === 'object' ? source : {};
  return {
    ...base,
    legend: segments.legend ?? base.legend ?? null,
    hover: segments.hover ?? base.hover ?? null,
  };
}
```

两处调用点：

- `--instance` 分支：`emit(mergeSegments(graph, segments), opts.payload ?? opts.out)`（原 `{...segments, ...graph}`）；
- `--payload` 分支：`emit(mergeSegments(source, segments), opts.out)`（原 `{...segments, ...source}`）。

本评审独立实跑（`/tmp` 独立根、真实 `serve-entry --desktop`、真实 `GET /ui/labels` 标签源）：

| 场景 | 结果 |
|---|---|
| `--project <root> --instance INST-001 --payload out1.json` | exit 0；`legend.lines` 为 A-8 两行逐字；`hover.opaqueIds=3`、`dimIds=2` |
| `out1` 显式置 `legend:null` / `hover:null` 后 `--payload in.json --project <root> --out out2.json` | exit 0；`legend.lines` 仍为 A-8 两行；`hover.opaqueIds > 0`；`hover.dimIds` 与首次一致；`nodes/edges` 与首次逐字相等 |
| 输入带非空旧 `legend`、无标签源（不传 `--project`/`labels`） | 保留旧 `legend`（`??` 语义），不抛错、不静默置 null |
| 输入 `legend:null`、无标签源 | 保持 `null`（与 B-19 注释一致） |

`mergeSegments` 不影响既有 `nodes/edges`：`...base` 先铺原字段，只覆盖 `legend/hover`；`buildGraph` 不产出这两个键，故 `--instance` 分支与修复前等价。R-01 的「输入显式 null 时二次导出仍被补齐」已闭合。

---

## §6 测试质量与门禁复跑输出

### 6.1 测试质量

| 项 | 结论 |
|---|---|
| `test -f` 先行 | 三个文件均存在；本评审以 `test -f ... &&` 形态执行（见 §0） |
| `# pass ≥ 1` / `# fail 0` | regression 8/8；acceptance 2/2；readonly 1/1 |
| 自造键 / 自证 | 未发现。列表/图例文案全部经真实 `GET /ui/labels`；期望串取附录 A-1/A-8；图数据经真实 `src/daemon/graph.js` 与真实 HTTP；harness 用真实 `graph-dump.mjs`。`readonly-local` 的 views 文件由测试手写，但注释诚实说明是壳层写路径的替身，不是「自己写自己断言」的产品写路径 |
| 绕过真实链路 | daemon 面真实（真 serve-entry、真 HTTP、真 graph-dump）；壳面的 `rows`/`graph-shown` 未走真实窗口（B-33） |
| skip 显式且理由真实 | `if (!SHELL) t.skip('Maestro.app bundle 不存在...')` 理由真实；但旧包存在时不 skip，形成假绿（B-34） |
| 墙钟脆断言 | 只有需求硬指标 `ready ≤ 3000ms`；其余用 `waitFor` 条件轮询；`syncSleep` 只用于清理重试，不参与时序断言 |
| 全量不自递归 | 明确不跑全量；只校验基线清单（B-38 为建议） |

### 6.2 全量复跑

| 轮次 | 命令 | 结果 |
|---|---|---|
| 第 1 次（dot） | `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 --test-reporter=dot "test/**/*.test.js"` | 5 个 X；含 `AC-41` ANSI 偶发（单跑通过） |
| 第 2 次（tap + tail） | 同上 + `-u FORCE_COLOR` + `--test-reporter=tap` | `# tests 1368 / # pass 1363 / # fail 4 / # skipped 1` |
| 第 3 次（tap + grep） | 同上，仅保留失败与汇总 | `# tests 1368 / # pass 1362 / # fail 5 / # skipped 1`；失败 = `NFR-02 verifyProducts`、`AC-04`、`task-loop 审核提示词`、`core.stop`、`main --cwd` |

**差集结论 = 0**：
- `NFR-02 verifyProducts`、`task-loop 审核提示词`、`core.stop`、`main --cwd` 均在 `baseline-failures.txt` 8 条内；
- `AC-04` 是 `review-batch5-round3.md` §5 R-08 / 裁决 R 已登记的「环境敏感、允许双向」，本机在批次前快照 `aca57d6` 与 `dd178e1` 上同样失败；
- 主控基线中的 `cursor.json 并发`、`早返回`、`NFR-02 readReview` 本轮通过，属负载型摆动；
- 本轮新增失败 **0** 条，测试条数 1368 ≥ 1157（基线 1157）。

### 6.3 门禁附加：`npm run desktop:build` 与产物时效

- **产物存在性**：`test/wp13/bundle.test.js:101-127` 断言 `Maestro.app`、`Contents/MacOS/maestro`、`Resources/runtime/node`、`Resources/src/daemon/serve-entry.js`、`Resources/bin/orch.js` 存在；`acceptance-e2e.test.js:418` 以 `SHELL` 存在作为壳面前置。**字面成立**。
- **产物时效**：**不成立**。现有 `Maestro.app` 构建于 **11-13 02:15**，早于 WP-8 / M / Q / R / R-09；`Resources/` 无 `desktop/ui`，包内 `server.js` 只认 Bearer。`bundle.test.js:60-65` 的 `ensureBundle()` 只在 `SHELL` 缺失时才 `npm run desktop:build`，旧包存在就永不重建；`acceptance-e2e` 也不检查包内 UI 资源或 `/ui/` 可达性。**结论：S3 必须先 `npm run desktop:build`，并断言 `Contents/Resources/desktop/ui/index.html` 存在、真实 `/ui/` 匿名 200；否则 AC-01/26/29/31/36 的壳面证据全部无效。**

---

## §7 修复清单 / S3 前置条件

### 7.1 修复清单

| 编号 | 级别 | 位置 | 现象 | 建议 |
|---|---|---|---|---|
| **B-33** | **阻断（AC-26 未闭合）** | `desktop/src-tauri/src/{probe,main,tray}.rs`、`desktop/ui/app.js:126-142,1776-1779`、`test/wp13/acceptance-e2e.test.js:417-521` | 冻结协议要求的 `rows` 探针事件不存在；`graph-shown` 由 ctl 合成、只带 `instanceId/view`，不带 `nodes/edges/dangling`；UI 侧的 `buildGraphShownProbe` 通过 `window.__MAESTRO_PROBE__` 发送，但全仓无 Rust 写入该全局，属死代码；用例的 rows/graph 数据来自测试预起的 daemon 的另一条 HTTP 请求。旧包（无 UI、只认 Bearer）仍 2/2 全绿 | 二选一：① 按冻结点 6 在壳层实现 `rows` 事件（列表渲染后发 `{rows:[...]}` 或至少 `{count, rows}`），并让真实 UI 的 `graph-shown`（带 `nodes/edges/dangling`）落到同一探针文件；用例等待并断言这些字段。② 若主控决定接受「数据面 + 同模块」为 AC-26 Then 的等价证据，须显式裁决并改写 `requirement.md:627` 的机检口径，同时在评审记录中登记「`rows` 探针延期」。当前不能默认视为闭合 |
| **B-34** | **阻断（产物时效 / 取证有效性）** | `desktop/src-tauri/target/release/bundle/macos/Maestro.app`、`test/wp13/acceptance-e2e.test.js:417-421`、`test/wp13/bundle.test.js:60-65` | bundle 11-13 02:15，早于 WP-8/M/Q/R；`Resources/desktop/ui` 缺失；包内 `server.js` 无静态面免鉴权；`ensureBundle()` 只在缺失时重建，`acceptance-e2e` 只判 `SHELL` 存在 | S3 第一步重建：`npm run desktop:build`；在 `bundle.test.js` / `acceptance-e2e.test.js` 增加「`Resources/desktop/ui/index.html` 存在」「`/ui/` 匿名 200」「包内 `server.js` 含静态面免鉴权」断言；必要时以 `Info.plist`/资源哈希做时效校验，禁止用旧包取证 |
| **B-35** | 建议 | `test/wp13/acceptance-e2e.test.js:426`、`desktop/src-tauri/src/spawn.rs:25-52` | 壳面用例先 `startDaemon(root)` 再启动壳；壳又会 spawn 第二份 daemon。用例的 `core.json` pid 断言与 `/instances`、`/graph` 数据都来自测试自己那份 daemon，不是壳的那份；`ready.daemon.pid` 从未校验 | 壳面改为「只启动壳」；断言 `ready.daemon.pid > 0` 且等于 `core.json.pid`；关窗前后比较同一 pid；不预起 daemon |
| **B-36** | 建议 | `test/wp13/readonly-local.test.js:288-320` | 拖拽写路径由测试手写 `views/INST-001.json`，再用 `config.rs` 正则与 `desktop/ui` 无 `writeFile` 做结构兜底；没有真实壳内拖拽 | 保留结构兜底，但 S3 AC-22 必须用真实壳 `write_view_command` 写入并读回；测试注释已诚实，不算自证 |
| **B-37** | 建议 | `test/wp13/readonly-local.test.js:352-366` | 数据面 401 列表缺 `/instances/:id/graph/stream`（图 SSE） | 把图流加入无名凭据 401 列表；同时断言 401 正文不含实例数据 |
| **B-38** | 建议 | `test/wp13/regression.test.js:559-576` | 未断言全量条数 ≥1157 / 失败集合差集 0，只校验基线清单 8 条；按「不自递归」原则可接受 | 在回执/主控记录中固定本次 1368 条与差集 0；若要在测试内表达，可增加一个「读取主控留下的 `docs/.../full-run-summary.json`」的只读断言，禁止在测试内跑全量 |
| **B-39** | 建议 | `test/wp13/regression.test.js:565`、`decisions.md` 裁决 R（`R-08`） | 测试硬断言基线清单恰 8 条；裁决 R 已写「失败集合扩为 9 条（含 AC-04）」，基线文件仍是 8 条 | 明确口径：若 AC-04 作为环境敏感项允许双向，更新基线文件为 9 条并同步测试；或把测试改为「8 或 9 且包含必需项」，避免 S3 因口径不一致报红 |
| **B-40** | 建议 | `test/wp13/acceptance-e2e.test.js:418-421` | 壳面跳过条件只判 `SHELL` 存在；旧包/缺 UI 的包不会被识别 | 与 B-34 合并：跳过条件改为「`SHELL` 与 `Resources/desktop/ui/index.html` 均存在且 `/ui/` 200」，否则显式 fail 或 skip 并写明「产物过期，需重建」 |

### 7.2 S3 前置条件（按顺序）

1. **重建 bundle 并锁定时效**：`npm run desktop:build`；断言包内 `Contents/Resources/desktop/ui/index.html`、`Contents/Resources/runtime/node`、`Contents/Resources/src/daemon/serve-entry.js` 存在；真实 `/ui/` 匿名 200；包内 `server.js` 含裁决 R 的静态面免鉴权。未完成前，AC-01/26/29/31/36 的壳面证据一律不采信。
2. **闭合 AC-26 探针链**：实现 `rows` 探针（或由主控显式裁决接受数据面等价证据并改写机检）；让真实 UI 的 `graph-shown` 携带 `nodes/edges/dangling` 并写入 `--probe` 文件；壳面用例改为只启动壳、断言 `ready.daemon.pid` 与 `core.json.pid` 一致，再跑 `ready → rows → graph-shown → closed`。
3. **统一基线口径**：把 AC-04（R-08）的「允许双向」写进 S3 基线表（8 或 9 条），并确保 `regression.test.js` 的硬断言与之相符；否则 S3 每轮都会在 `AC-04` 上重复归因。

> 附：AC-27 的真实拖拽（B-36）与图流 401（B-37）可在 S3 逐 AC 验收时补；不阻断本批的静态面判定，但会作为 AC-22/27 的取证缺口登记。
