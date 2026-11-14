# I1.10a 批次 6 实现评审记录 · round 2 独立复评（WP-9 回归守护与端到端整合）

> 复评对象（按时间序）：`310e6d8`（WP-9 主体，上轮 FAIL）→ `d4a23f6`（裁决 S/T）→ `0b8f480`（裁决 U，文档入库）→ `3ef8923`（裁决 V/W）→ `58569d1`（裁决 X）
> 上轮记录：`review-batch6.md`（FAIL：阻断 B-33 / B-34，建议 B-35~B-40）
> 判据：`requirement.md` v2 的 AC-26 / AC-27 / AC-28 锚点逐字、§3.1 判定口径五条、§3.3 探针接缝、附录 D-1/D-2/D-7/D-8/D-9/D-10/D-11/D-13；`iteration-10a.md` r2 §4 WP-9 门禁附加；`decisions.md` 裁决 A~X（本轮合法改动面 = S/T/U/V/W/X）。
> 方式：**只读**（唯一写入本记录）。判据文档、五笔提交完整 diff、`git diff 310e6d8~1 58569d1 --stat/--name-only`、主控实跑日志、代码现状均本轮亲自读取。按裁决 F **未重跑全量**（不执行 `node --test "test/**/*.test.js"`）；仅跑轻量机械复核（purity / Python 扫描 / `git show --check` / `git grep`）。机械结论一律以 Python / Grep 工具为准，不以 Bash 内的 `grep` 下结论。
> 既定口径不挑：裁决 R 静态面免鉴权（只核数据面是否放松）、裁决 H 的 AC-21、K 的组名回退、L 的 R-02、裁决 W 的「外部 origin 无 IPC 已由诊断证据坐实」、裁决 X 的断言演进授权。

## §0 复评总判

**PASS。残留阻断 0 / 建议 2（R-12、R-13，均非阻断）。**

上轮两条阻断（B-33 AC-26 探针链、B-34 bundle 时效）本轮均按真实链路取证闭合；B-35~B-40 六条建议全部处置，裁决 X 的断言演进严格落在授权面内。判定基线 9 条口径已统一，最终全量差集 = 0。

### 三态表（已闭合 / 未闭合 / 部分闭合）

| 编号 | 上轮级别 | 项目 | 本轮三态 | 一句话依据 |
|---|---|---|---|---|
| **B-33** | 阻断 | AC-26 真实探针链 | **已闭合** | `probe_emit` 注册 + 窗口 `rows`/`graph-shown` 由渲染层产出 + 裁决 W HTTP 镜像把窗口事件搬进 `--probe`；`/tmp/i10a-w-e2e.log` 壳面 `2/2 pass / 0 skip` |
| **B-34** | 阻断 | bundle 时效 / 取证有效性 | **已闭合** | 产物重建于 `2026-11-14 11:59:30`（>11:48），包内含 `desktop/ui/index.html`、`decision R` 标记、`probe_emit`/`window-probe`，二进制含 `probe_emit` |
| B-35 | 建议 | 壳面只启动壳、pid 同源 | **已闭合** | `acceptance-e2e.test.js` 删 `startDaemon`、只 `spawn(SHELL)`，断言 `ready.daemon.pid>0` 且 `== desktop.json.pid == core.json.pid` |
| B-36 | 建议 | 真实拖拽登记为已知限制 | **已闭合（登记口径）** | 裁决 S 明令「登记，S3 用窗口级自动化或接受结构断言并注明」；`readonly-local.test.js:288-320` 注释诚实、结构兜底保留。S3 取证缺口见 R-12 |
| B-37 | 建议 | `/instances/:id/graph/stream` 401 | **已闭合** | `readonly-local.test.js:358` 已加入 401 列表，且断言 401 正文不含实例数据 |
| B-38 | 建议 | 规模统计不递归跑全量 | **已闭合** | `regression.test.js:586-604` 纯结构 `match(/^test\(/gm)` 统计，`>=1157`，注释写明不跑全量 |
| B-39 | 建议 | 判定口径 9 条 / 历史清单未改 | **已闭合** | `regression.test.js:566-569` 物理 8 条 + `R08_ALLOWED=['AC-04']` = 判定口径 9 条；`baseline-failures.txt` 不在累计 diff 内 |
| B-40 | 建议 | skip 判定含产物时效 | **已闭合** | `bundleFreshness()` 与 `regression.test.js:606-626` 双重时效门槛，skip 消息写明「需重建」 |
| 裁决 X | — | `bundle.test.js` 断言演进 | **已闭合** | 仅 1 处断言段 + 注释改动，注释指到 `acceptance-e2e.test.js`，401/收窄环境/pid/quit 断言零放宽 |

---

## §1 AC-26 真实链路闭合判定

**结论：已闭合（B-33）。** 逐项核 `requirement.md:627` 机检逐字「探针 `ready → rows → graph-shown(nodes=..., edges=..., dangling=0) → closed(visible=false)`」+ §6 冻结点 6 的事件契约 + §3.1 口径 1/2。

### 1.1 七个子项逐条

| 子项 | 证据 | 判定 |
|---|---|---|
| ① `probe_emit` 注册进 `invoke_handler` | `desktop/src-tauri/src/main.rs:111-116` 的 `generate_handler![... probe::probe_emit]`；`d4a23f6` diff 新增该行 | 已闭合 |
| ② 窗口 `rows` 事件由 `model.rows`（`desktop/ui/list` 纯模块）经去重后发出 | `app.js:39` import `./list/list.js` 的 `renderListRow/sortInstances`；`:674-686` `model.rows = sortInstances().map(renderListRow)`；`:1039` `lastRowsSignature`、`:1093-1099` `paint()` 里 `signature !== lastRowsSignature` 去重后 `emitProbe({event:'rows', rows: texts})` | 已闭合 |
| ③ `graph-shown` 复用 `buildGraphShownProbe` 带 `nodes/edges/dangling` | `app.js:126-142` `buildGraphShownProbe`：nodes/edges 取数组长度、dangling 由边端点缺席计算；`:756-766` `emitGraphProbe()` 调它并 `transport.probe(probe)` | 已闭合 |
| ④ 裁决 T 合成 `graph-shown` 彻底删除（tray 只留 `graph-open-request`） | `tray.rs:126-141` `handle_open_instance` 发 `graph-open-request({instanceId, view:'graph'})` 并 `win.eval` 请求窗口打开；`:94-111` `tray-open` 分支 eval `refresh-list`；`:148-155` `close_to_tray` 补 `closed`。全仓 `git grep '"graph-shown"'` 在 Rust 侧零命中 | 已闭合 |
| ⑤ 裁决 W HTTP 镜像链路 | `src/daemon/http/server.js:459-482` `POST /__test__/window-probe`：`NODE_ENV!=='test'` → 404；`claimedByHandler`（`:351/:354`）列入 → `authorized()`（`:379-388`, `:390-396`）仍强制 `Bearer ${meta.token}`；只 `fs.appendFile(<root>/.orch/window-probe.jsonl, JSON.stringify(event)+'\n')`。壳 `probe.rs:84-115` `start_window_probe_watcher`（`main.rs:150` 挂载）：100ms 轮询，`rposition('\n')` 取完整行，`append_line(probe_path, line)` **原样搬运、不解析不重算**；`--probe` 未传则不启动 | 已闭合 |
| ⑥ 断言真覆盖 `ready→rows(A-1 逐字)→graph-shown(计数)→closed(visible=false)` + pid + `instance status` | `acceptance-e2e.test.js:435-565`：`:467-481` ready（visible/title/view + `ready.daemon.pid>0`）；`:491-506` rows `deepEqual` A-1 两行逐字；`:508-531` graph-shown 带 `nodes/edges/dangling` 且等于真 HTTP 图快照 `sig`（4/4/0）；`:539-546` `closed.window.visible===false`；`:548-550` 关窗前后 pid 相等；`:552-561` `instance status` 成功。`/tmp/i10a-w-e2e.log` = `2/2 pass / 0 skip`；`/tmp/i10a-b6-final2.log:4197` = `ok 700 - AC-26 壳面` | 已闭合 |
| ⑦ B-35 只启动壳、无测试自起 daemon 顶替 | `:459-464` 仅 `spawn(SHELL, ['--project'...])`，已删除上轮的 `startDaemon(root)`；`:479` `ready.daemon.pid>0`；`:485` `meta.pid === readyEvent.daemon.pid`；`:536` `coreBefore.pid === readyEvent.daemon.pid`；`:450-456` `t.after` 用 `desktop.json.pid` 清理，不再 `stopDaemon(daemon)`。裁决 T 的「先起壳、ready 后写夹具」铁序在 `:487-489` 落实 | 已闭合 |

### 1.2 窗口事件来源与「壳只搬运」的独立证据

- **来源**：`rows` 文本来自 `desktop/ui/list/list.js` 的 `renderListRow`（经 `app.compose()` → `model.rows` → `paint()`），`graph-shown` 计数来自 `app.js` 的 `buildGraphShownProbe`。两者都由**窗口渲染层**在 `paint()` 后经 `transport.probe` 发出，壳侧 `probe.rs`/`tray.rs`/`main.rs` 没有任何 `renderListRow` / `nodes` / `dangling` 的构造或重算（`git grep` 核）。符合 §3.1 口径 1 与裁决 S②/S③「壳不重算、不渲染」。
- **双通道**：`app.js:1813-1830` 的 `probe` 先 `window.__MAESTRO_PROBE__`（能力探测），再 `tauriInvoke()('probe_emit')`（app origin），同一 `payload` 再 `POST /__test__/window-probe`（外部 http origin）。`tauriInvoke()`（`:1758-1766`）兼容 `__TAURI__?.core?.invoke` / `bridge.invoke` / `__TAURI_INTERNALS__?.invoke`（裁决 V）。
- **壳只搬运**：`server.js` 端点 `appendFile` 写的是窗口 `JSON.stringify(event)` 原文；`probe.rs:96-109` 只按 `\n` 切完整行并 `append_line`，不解析、不改字段、不合成。探针文件内容 = 窗口所建 JSON 行。
- **真实链路可判**：`/tmp/i10a-diag-e2e.log` 证明诊断期 WebView 在 `/ui/` 但 `rows` 探针缺失（外部 origin 无 IPC，裁决 W 既定口径已坐实）；`/tmp/i10a-ac26-shell3.log` 证明仅加 `withGlobalTauri`（裁决 V）后仍只有壳侧事件；`/tmp/i10a-w-e2e.log` 的 `2/2 pass / 0 skip` 是裁决 W 镜像接通后**真实窗口链路**转绿。旧包（无 UI、只认 Bearer）不再能假绿：`bundleFreshness()` 会直接 skip。

> 判定纪律核对：本轮 B-33 的闭合依据是「窗口渲染 → HTTP 镜像 → 壳搬运 → 探针文件 → 用例断言」的完整链路 + 重建包真跑日志，不是测试自证，也不是模块级直喂。上轮「旧包 2/2 全绿」的假绿路径已被 B-34 的时效门槛切断。

---

## §2 bundle 时效与产物一致性

**结论：已闭合（B-34）。**

| 子项 | 实测 | 判定 |
|---|---|---|
| ① 产物时间 > 2026-11-14 11:48 | `Maestro.app` mtime = **2026-11-14 11:59:30**（`Contents/MacOS/maestro` 11:59:31、`Resources` 11:59:30）。`/tmp/i10a-b6-rebuild.log` 记录首次构建被 `NODE_OPTIONS` safe-delete shim 拦截（`BUILD_EXIT`），`/tmp/i10a-b6-rebuild2.log`(11:48) 与 `/tmp/i10a-w-build.log`(11:59) 成功；最后一次重建在裁决 W 落地后 | 已闭合 |
| ② 包内资源/标记/代码 | `Resources/` = `['bin','desktop','runtime','src']`（含 `desktop`，旧包无）；`desktop/ui/index.html` 存在且含 `app.js`；包内 `server.js` 含 `decision R`(2)、`the static face is public`(1)、`__test__/window-probe`(2)、`NODE_ENV`(2)；包内 `app.js` 含 `probe_emit`(1)、`window-probe`(1)、`buildGraphShownProbe`(3) | 已闭合 |
| ③ `bundleFreshness()` 与 `regression.test.js` 产物时效断言 / shape 一致 | 两者判据面**相同**：`SHELL` 存在 + 包内 `src/daemon/http/server.js` 含 `/decision R\|the static face is public/` + 包内 `desktop/ui/index.html` 存在。分化仅在处置方式：`acceptance-e2e.test.js:136-155` 把三者作为 **skip** 条件（壳面不取证、消息写明需重建），`regression.test.js:606-626` 把前两者作 skip、把 UI 资源作 **assert**（门禁必须过，另加 `mountApp` 装配断言）。判据同源、不矛盾，shape 差异见 R-13 | 已闭合（一致） |
| ④ shell 二进制含 `probe_emit` | `Contents/MacOS/maestro` 字节扫描：`probe_emit`=2、`window-probe`=1、`graph-open-request`=1；源码 `main.rs:115` 已注册、`probe.rs:69-77` 已实现，`cargo build --release` 成功（重建日志）。`start_window_probe_watcher` 作为 Rust 符号被 mangle 未在字符串表中出现，属正常，功能由 `window-probe`/`probe_emit` 串与实跑日志佐证 | 已闭合 |

`ensureBundle()`（`bundle.test.js:60-65`）仍只在 `SHELL` 缺失时重建，但本批产物已重建且 B-40 双重时效门槛会在旧包/缺 UI 包的场景显式 skip 并写明需重建——上轮「旧包存在即当真跑」的假绿路径已封死。

---

## §3 建议项与裁决 X 核对

**结论：B-35~B-40 全部处置；裁决 X 严格落在授权面内。**

| 项 | 落点 | 判定 |
|---|---|---|
| B-36 真实拖拽登记 | 裁决 S 明令「登记，S3 用窗口级自动化或接受结构断言并注明」；`readonly-local.test.js:288-320` 注释写明「壳层写路径；纯模块零 fs」「结构性兜底」，并断言 `config.rs` 的 `.orch/desktop/views/` 路径 + `desktop/ui` 无 `writeFile`。登记成立、不要求修 | 已闭合（登记口径） |
| B-37 图流 401 | `readonly-local.test.js:352-367` 的 `dataPlane` 含 `/instances/INST-001/graph/stream`，逐条断言 `401` + 正文 `{error:'UNAUTHORIZED'}` + 不含 `INST-001` | 已闭合 |
| B-38 规模统计 | `regression.test.js:586-604` 遍历 `test/**/*.test.js` 统计 `^test\(`，`count>=1157`、`files.length>=100`；注释写明「纯结构统计，不递归跑全量」「串行全量失败集合 ⊆ 9 条判定基线、差集 = 0、默认并发不作依据」（裁决 F/I/R-08） | 已闭合 |
| B-39 判定口径 9 条 | `regression.test.js:565` 仍硬断言物理清单 `lines.length===8`，`:566-569` 新增 `R08_ALLOWED=['AC-04']` + `lines.length + 1 === 9`，说明「物理 8 + R-08 允许项 1 = 判定口径 9」。`docs/iterations/iteration-7/baseline-failures.txt` 仍为 8 行、不在 `git diff 310e6d8~1 58569d1 --name-only` 内（D-13 冻结未动） | 已闭合 |
| B-40 skip 含产物时效 | `acceptance-e2e.test.js:436-440` 用 `bundleFreshness()` skip + 「需先执行 npm run desktop:build 重建」；`regression.test.js:606-626` 独立时效用例 | 已闭合 |
| **裁决 X** | `git show 58569d1`：`test/wp13/bundle.test.js` 只改 `@@ -174,14 +174,18 @@` 一处——注释改写（指到 `acceptance-e2e.test.js`、裁决 T/W）、`waitFor` 查 `graph-shown` 改查 `graph-open-request`、`assert.ok` 消息改、新增 `assert.equal(graph.instanceId,'INST-999')`；保留 `assert.equal(graph.view,'graph')`。`bundle.test.js` 全文核：产物存在/可执行(103-127)、收窄环境 `which node`(129-132)、`ready≤3000`(150-160)、`tray-created`(162-164)、`core.json pid`(166-175)、`quit(daemonStopped=true)`(190-199) **零放宽、零删除**。`decisions.md` 追加裁决 X 文本属主控留痕 | 已闭合 |

---

## §4 回归与边界（含裁决 W 的 AC-27 只读边界判定）

**结论：九项全绿。**

| 项 | 实测 | 判定 |
|---|---|---|
| ① 累计文件集合 ⊆ 授权面 | `git diff 310e6d8~1 58569d1 --name-only` = **30 文件**：`.gitignore`(U③)、`Cargo.lock`(U②)、17 个 `docs/iterations/iteration-10a/*.md` + `iteration-10a.md`(U①)、`graph-dump.mjs`(310e6d8，裁决 L 明令 R-01 批 6 必修)、`main.rs`/`probe.rs`(S/T/W)、`tray.rs`(T 授权扩展/W)、`tauri.conf.json`(V 授权扩展)、`app.js`(S/T/V/W)、`server.js`(W，D-10 清单内)、`acceptance-e2e.test.js`(S/T/W)、`readonly-local.test.js`(S/B-37)、`regression.test.js`(S/B-38/39/40)、`bundle.test.js`(X)。**无** `src/core/**`、`src/cli/**`、`src/persistence/**`、`src/templates/**`、`src/registry/**`、`package.json`、`config.rs`、`spawn.rs`（后两者在授权面内但未改，授权面是上限非下限） | 已闭合 |
| ② 裁决 W daemon 写边界 | `server.js` 全文：`appendFile`=1（即 window-probe 端点）、`window-probe.jsonl`=1、`NODE_ENV`=2（graph/pulse 与 window-probe 的 test 守卫）；`writeFile`/`writeFileSync`/`saveState`/`emit(`/`appendSpan` **全 0**。端点 `NODE_ENV!=='test'` → 404（生产零注册），经 `authorized()` 强制 Bearer，只写验收探针产物 `.orch/window-probe.jsonl`，不触碰 `state.json`/`events.jsonl`/`traces.jsonl`/事件链/追踪。`readonly-local.test.js:204` 只 `spawn(process.execPath,[SERVE_ENTRY,'--desktop'])` 起 daemon、**不启动 Tauri 壳窗口**，故不触发该端点；`/tmp/i10a-b6-final2.log` 中该文件用例 `ok 876 - AC-27：读操作不写实例…` 全绿，两组哈希/四组状态/`.orch` 文件面（只新增 `desktop/views/INST-001.json`）断言未被新写路径污染 | 已闭合 |
| ③ `desktop/ui/**` + `desktop/harness/**` CJK 零命中 | Python 全文本扫描（含中文标点/全角区）= **0 命中** | 已闭合 |
| ④ 31 词 purity 两轮 exit 0 | `env -u NODE_OPTIONS node test/fixtures/purity-check.mjs --forbid <D-7 逐字 31 词>`：题目指定 `src/core,src/daemon,desktop/ui` → `OK 扫描 45 文件 rc=0`；AC-28 轮 1 `src/core,src/daemon` → `OK 29 文件 rc=0`；轮 2 `desktop/ui` → `OK 16 文件 rc=0`；`--json` 校 `forbidden=31 / hits=0` | 已闭合 |
| ⑤ `src/daemon/graph.js` `saveState\|emit(` 零命中 | `git grep -nE "saveState\|emit\(" HEAD -- src/daemon/graph.js` → ZERO-HIT；Python 复核 0 | 已闭合 |
| ⑥ 零 npm 依赖 | `package.json` 不在累计 diff 内；`Object.keys(dependencies||{}).length === 0` | 已闭合 |
| ⑦ `decideStatus` 零命中 | `git grep -n "decideStatus" HEAD -- desktop` → ZERO-HIT；Python（排除 `target/`）复核 0（符合 B-13 的 `--exclude-dir=target` 口径） | 已闭合 |
| ⑧ `desktop/ui` 无 `NODE_ENV`/`isTest` 渲染分支 | `git grep -nE "NODE_ENV\|isTest" HEAD -- desktop/ui` → ZERO-HIT；Python 全目录仅 `app.js:1519` 注释命中 "never a test-only branch"（措辞本身在**否定**测试分支，非渲染分支）。裁决 S②/T 的 `__MAESTRO_CTL__` 与 `tauriInvoke()` 均为能力探测（`app.js:1517-1528`、`:1758-1766`），非 `NODE_ENV` 分支 | 已闭合 |
| ⑨ 诊断期临时代码删除 | `git grep -nE "ui-navigate\|ui-current-url\|ctl-eval-reached" HEAD` 仅 2 处命中，均在 `decisions.md:223/226` 裁决 W 的**历史叙述**（说明已删除）；Python 扫 `desktop/ src/ test/ scripts/ bin/` 源码层 = **0 命中** | 已闭合 |

**裁决 W 的 AC-27 只读边界判定：成立。** 新端点仅 `NODE_ENV=test` 存在、生产零注册；只写验收探针产物；不触碰实例状态/事件链/追踪；`readonly-local` 用例不触发该端点且哈希与文件面断言在最终全量中仍绿。数据面未被放松：`authorized()` 仍「数据面只认 `Authorization: Bearer`」，新增端点被 `claimedByHandler` 列入，裁决 R 的静态面免鉴权例外（仅 `GET && !claimed && isStaticFile`）未扩大到任何数据路径，`?token=` 仍不被接受（`:387` 只比 `header`）。

---

## §5 门禁复核（差集结论 + 机械扫描输出）

### 5.1 主控两次全量（只读核对，未重跑）

| 日志 | 汇总 | 失败集合 |
|---|---|---|
| `/tmp/i10a-b6-final.log`（裁决 X 前） | `# tests 1370 / # pass 1364 / # fail 5 / # skipped 1` | `bundle: artifacts…`（`graph-shown missing`，裁决 T 删除合成事件所致）+ `AC-04` + `task-loop 审核提示词` + `core.stop` + `main --cwd` |
| `/tmp/i10a-b6-final2.log`（裁决 X 后最终） | **`# tests 1370 / # pass 1365 / # fail 4 / # skipped 1`** | `AC-04`、`task-loop 审核提示词`、`core.stop`、`main --cwd` |

**差集结论 = 0**：
- 判定基线 9 条 = 物理 `docs/iterations/iteration-7/baseline-failures.txt` 8 条（`NFR-02 readReview`、`NFR-02 verifyProducts`、`core.stop`、`cursor.json 并发`、`main --cwd`、`task-loop 审核提示词`、`早返回`、`自动拉起`）+ 裁决 R/R-08 允许的 `AC-04` 一项。
- 4 条逐一落位：`task-loop 审核提示词` ⊂ 物理第 6 条；`core.stop` ⊂ 物理第 3 条；`main --cwd` ⊂ 物理第 5 条；`AC-04` ⊂ R-08 允许项（第 9 条）。**4 条 ⊆ 9 条，新增失败 0 条，差集 = 0。**
- 单跑佐证：`/tmp/i10a-bundle-single2.log` = `1/1`（裁决 X 后 bundle 用例转绿，正是 final 5→4 的差）；`/tmp/i10a-w-e2e.log` = `2/2 pass / 0 skip`；final2 中 `ok 699`(AC-26 daemon 面)、`ok 700`(AC-26 壳面)、`ok 711`(bundle)、`ok 736`(AC-26 graph-shown 计数)、`ok 876`(AC-27 readonly-local) 全绿。
- 测试总数 `1370 ≥ 1157`（I1.9 基线），条数只增不减；`1 skip` 为既有跳过项。

### 5.2 本轮轻量复核输出（自跑，不含全量）

| 命令 | 输出 |
|---|---|
| `git show --check 310e6d8 d4a23f6 0b8f480 3ef8923 58569d1` | 五笔 `rc=0`（无空白/尾随空格错误） |
| `purity-check.mjs --dirs src/core,src/daemon,desktop/ui --forbid <31 词>` | `OK 扫描 45 个文件 … 零命中`，`rc=0` |
| `purity-check.mjs --dirs src/core,src/daemon` / `--dirs desktop/ui` | `OK 29 文件` / `OK 16 文件`，两轮 `rc=0`；`--json`：`forbidden=31, hits=0` |
| Python CJK 扫描 `desktop/ui` + `desktop/harness` | `hits = 0` |
| Python `NODE_ENV/isTest` 扫描 `desktop/ui` | 仅 `app.js:1519` 否定式注释 1 处，渲染分支 0；`git grep` ZERO-HIT |
| Python 诊断代码扫描（源码层，排除 docs） | `ui-navigate/ui-current-url/ctl-eval-reached` = `0` |
| Python 宿主分支扫描 `src/core`+`src/daemon` | `switch(host)` / `if (host ==/!=` = `0` |
| `git grep -nE "saveState\|emit\(" HEAD -- src/daemon/graph.js` | ZERO-HIT |
| `git grep -n "decideStatus" HEAD -- desktop` | ZERO-HIT |
| `node -p "Object.keys(require('./package.json').dependencies||{}).length"` | `0` |
| `git diff 310e6d8~1 58569d1 -- package.json` | 空（未改） |
| Python 产物内容/二进制扫描 | 见 §2；包内 `decision R`/`window-probe`/`probe_emit` 全命中，二进制 `probe_emit`=2 |

> 按裁决 F：默认并发全量必假 flake，判定一律以主控串行 `--test-concurrency=1` 两次实跑为准；本复评未启动任何全量测试，避免并发负载 flake。

---

## §6 残留项与 S3 结论

### 6.1 残留项

| 编号 | 级别 | 内容 | 处置 |
|---|---|---|---|
| **R-12** | 建议（S3 取证缺口，非实现缺陷） | B-36 / AC-22 真实壳内拖拽写路径仍是**结构断言**：`readonly-local.test.js:288-320` 由测试手写 `views/INST-001.json` + `config.rs` 正则 + `desktop/ui` 无 `writeFile` 兜底，未在真实窗口内用 `write_view_command` 写入并读回 | 裁决 S 已明确「登记，S3 用窗口级自动化或接受结构断言并注明」。S3 逐 AC 验收 AC-22 时补窗口级取证；不阻断本批 PASS，也不阻断进入 S3 |
| **R-13** | 建议（观察项） | `bundleFreshness()`（壳面用例以 UI 资源缺失作 **skip**）与 `regression.test.js:606-626`（以同条件作 **assert fail**）对「产物过期」的处置方式分化；判据面一致、结论不矛盾 | S3 脚手架若统一时效门槛，可把两者对齐为同一 helper；当前分工（壳面不取证 vs 回归门禁必须过）合理，不影响判定 |

**残留阻断：0。** B-33 / B-34 均已按「真实链路可判」闭合；上轮 §7.2 的三条 S3 前置条件（重建 bundle 并锁时效、闭合 AC-26 探针链、统一基线口径）本轮逐条落地。

### 6.2 能否进入 S3 逐 AC 验收

**可进。**

理由：① 两条阻断（B-33 / B-34）闭合且经重建包真跑取证；② 判定基线 9 条口径统一、历史清单未改，最终全量 `1370 / 1365 / 4 / 1` 差集 = 0；③ 五笔提交累计 30 文件全部落在裁决 S/T/U/V/W/X 授权面内，`src/core`/CLI/冻结测试零越权；④ 裁决 W 的 daemon 写未放松 AC-27 只读边界（数据面仍 Bearer-only，`readonly-local` 哈希与文件面断言在 final2 全绿）；⑤ CJK / 31 词两轮 / `decideStatus` / `graph.js` 只读 / 零依赖 / 无测试渲染分支 / 诊断代码清理全部机械复核通过；⑥ 产物时效有效（11:59:30 > 11:48），AC-01/26/29/31/36 的壳面证据现在可采信。

R-12（AC-22 真实拖拽窗口级取证）与 R-13（时效门槛 shape 对齐）是 S3 **逐 AC 验收阶段**的补证/一致性项，按裁决 S「B-36 登记、S3 补」的既定口径处理，不构成进入 S3 的前置修复。
