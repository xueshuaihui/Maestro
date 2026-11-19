# I1.11 批次 A 缺陷台账（S3 取证发现）

> 由 `probe/acc11-f-run.mjs --batch a` 取证；判定只认需求 v10 原文，发现冲突判「不通过」并写证据，不改实现、不放宽断言。
> 仓库 HEAD `2732f86`；以下 2 条为「不通过」，其余 11 条通过，0 阻塞。

## AC-12 · 不通过（架构检查锚点与实现冲突）

- **需求原文（架构检查）**：`grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js` 恰好 **1 条命中（exit 0）**（不得绕过会话失效判定）。
- **实测**：`exit 1` / **0 命中**（`docs/iterations/iteration-11/evidence/AC-12/AC-12.arch-1.log`）。
- **根因**：实现把会话失效判定放在核心 `src/core/approvals.js:104` 与 `src/core/orchestrator.js:4961`，`src/daemon/queue.js:332` 仅 `forward(root, 'approval.resolve', ...)` 转发，未在 queue.js 直接引用 `APPROVAL_SESSION_GONE` 常量。语义复核（`AC-12.check.json` 的「语义复核」核对项）显示核心确实做了校验，未绕过。
- **机检行为**：`test/wp14/queue.test.js` 的「审批·允许」「审批·拒绝」用例 `# pass ≥ 1` / `# fail 0`（见 `AC-12.test-stdout.txt`），行为侧逐字断言通过。
- **裁决请求（主控/终验）**：属「架构检查锚点过时（常量在核心而非 queue.js）」还是「产品缺陷（queue.js 应引用该码）」？S3 按纪律判不通过，不改实现、不放宽断言。
- **原始帧**：
  - `docs/iterations/iteration-11/evidence/AC-12/AC-12.arch-1.log`（0 命中原始输出）
  - `docs/iterations/iteration-11/evidence/AC-12/AC-12.check.json`（核对项 + 逐字期望）
  - `docs/iterations/iteration-11/evidence/AC-12/AC-12.test-stdout.txt`（queue.test.js 原始 TAP）
  - `docs/iterations/iteration-11/evidence/AC-12/AC-12.output.json`（含 `grep -REn APPROVAL_SESSION_GONE src/core/...` 语义复核命令输出）

## AC-13 · 不通过（架构检查注释命中 + 数字序列夹具角色对调，两项均登记）

### ① 架构检查注释命中

- **需求原文（架构检查）**：`grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/` 必须**零命中（exit 1）**。
- **实测**：`exit 0` / **1 行命中**（`docs/iterations/iteration-11/evidence/AC-13/AC-13.arch-1.log`）。
- **根因**：命中位于 `src/daemon/http/routes.js:20` 的文档注释 `* (no batch), reach the orchestrator only through the existing decision /`，是「否定语境」注释，并非批量能力实现。
- **裁决请求**：属「扫描应排除注释 / 锚点过严」还是「注释需改写」？S3 按纪律判不通过。
- **原始帧**：`docs/iterations/iteration-11/evidence/AC-13/AC-13.arch-1.log`、`AC-13.check.json`。

### ② 三处数字序列夹具角色对调（不单独改判，登记备查）

- **需求 v10 机检原文序列**：`[[2,1,1,1],[1,0,0,1],[0,0,0,0]]`（Given：`INST-001` 升级 / `INST-002` 审批）。
- **WP-2 测试实际序列**：`[[2,1,1,1],[1,0,1,0],[0,0,0,0]]`（`test/wp14/queue.test.js` AC-13 用例把实例角色对调：`INST-001` 审批 / `INST-002` 升级）。
- **分析**：第 3、4 位互换源于夹具角色对调，语义「互不影响 + 三处各自同步」在两序列下均成立；`changeGuest` 行为侧（resolution=retry / approved / 互不影响）机检通过。是否要求测试夹具与需求 Given 对齐，交主控/终验裁决。
- **原始帧**：`docs/iterations/iteration-11/evidence/AC-13/AC-13.test-stdout.txt`、`AC-13.check.json`；需求原文见 parts `probe/acc11-f-parts/AC-13.md`。

## 口径差异（已按实际文件机检，非缺陷）

- AC-09~13 的需求机检原文点名 `test/wp14/queue-actions.test.js` / `queue-cross.test.js`，本分支（HEAD `2732f86`）不存在这两个文件，相关逐字断言已合并进 `test/wp14/queue.test.js`。S3 按实际存在的文件机检并保留原始 TAP，不放宽断言；机检文件名差异已在各 parts 备注登记。
- AC-04 的 `open-queue` 真 Tauri 窗口在无头验收环境不可用，按任务书用 `app.js` 源码锚点 + `followNotification` 行为断言取证，证据分级为「mock 实测」，非「已实测（真实宿主）」。

---

## 批次 B（AC-14~AC-26）取证台账 · S3 验收工程师批次 B

> 由 `probe/acc11-f-run.mjs --batch b` 取证（HEAD `bb60fb9`，macOS / Node ≥22）；判定只认需求 v11 原文，发现冲突判「不通过」并写证据，不改实现、不放宽断言。
> 结果：**通过 11 / 不通过 2 / 阻塞 0**；不通过条目：AC-15、AC-18（均为架构检查锚点与实现冲突，行为侧机检全部 # fail 0）。

### AC-15 · 不通过（架构检查锚点过时：错误码不在 queue.js）

- **需求原文（架构检查，v11 §3.1 AC-15）**：`grep -REn "ESCALATION_NOT_PENDING" src/daemon/queue.js` 恰好 1 条命中（exit 0），意图是「判重由核心错误码兜底，队列只把核心返回映射为固定文案」。
- **实测**：`exit 1` / **0 命中**（`docs/iterations/iteration-11/evidence/AC-15/AC-15.arch-1.log` 为空）。
- **根因**：错误码在核心产生（`src/core/escalation.js:89`、`src/core/orchestrator.js:5049`），结论词在 `src/cli/labels.js:949`（`ESCALATION_NOT_PENDING: '已处理'`）与 `:336` 映射，`src/daemon/queue.js:50` 以 `QUEUE_ERROR_CONCLUSIONS = DESKTOP_QUEUE_CONCLUSIONS` 同源引用透传——语义「二次处置返回固定结论、不写第二条判定」成立（机检 `queue.test.js`「已处理不重复写」用例 # pass ≥1 / # fail 0），但字面量不在 queue.js。语义复核原始帧见 `AC-15.output.json` 的「语义复核」命令。
- **裁决请求（主控/终验）**：属「架构锚点过时（应改锚到 labels.js/核心，比照 D-54 对 AC-12 的归位处理）」还是「产品缺陷（queue.js 应直接引用该码）」？S3 按纪律判不通过，不改实现、不放宽行为判定。
- **原始帧**：`AC-15.arch-1.log`、`AC-15.check.json`、`AC-15.output.json`、`AC-15.test-stdout.txt`、`AC-15.meta.json`。

### AC-18 · 不通过（架构检查⑤与需求内部张力：桌面壳层探针命中）

- **需求原文（架构检查⑤，v11 §3.1 AC-18）**：`grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src` 必须**零命中（exit 1，基线 0 条）**——界面与桌面壳层都不自行计数、只渲染下发投影。
- **实测**：`exit 0` / **2 命中**（`docs/iterations/iteration-11/evidence/AC-18/AC-18.arch-5.log`）：
  - `desktop/src-tauri/src/tray.rs:103`（文档注释 `/// ... pendingEscalations / ...`）；
  - `desktop/src-tauri/src/tray.rs:113`（`tray-status` 探针字段 `"pendingEscalations": tray.pending`）。
- **根因/分析**：该探针字段是需求自身 §3.3 探针事件表与 AC-14/AC-18/AC-47 明确要求的下发字段（托盘"待处理升级"数从 `tray-status` 读）；`desktop/src-tauri/src/main.rs:300` 取值为 `item.get("pending")?.get("escalations")`，即 daemon 投影下发，壳层**未自行计数**。命中属「探针字段名 + 注释」，与 D-36「界面零计算」的语义不冲突，但与 v11 字面零命中要求冲突——需求内部存在张力（既要求下发该字段，又要求壳层源码零命中该字符串）。
- **其余判据全部成立**：函数体切块脚本 `occurrences=9 / countExpr=2 / outsideShapeSnapshot=0`（D-36；基线 occurrences=5，新增 4 行均为同类透传，D-53 `shapeSnapshot` 行号漂移 900→1018 按函数体锚点判定），`escalations.filter/reduce` 恰好 1 条，`desktop/ui/escalations.filter` 零命中；机检 `queue.test.js` + `e2e.test.js` 全 # fail 0，三处数字逐字断言成立（`AC-18.check.json`）。
- **裁决请求（主控/终验）**：属「探针字段名/注释应比照 D-54 排除后重判零命中（细化 arch⑤ grep）」还是「产品缺陷（壳层字段应改名避开）」或「需求自相矛盾需修订 v11」？S3 按纪律判不通过，不放宽断言。
- **原始帧**：`AC-18.arch-5.log`、`AC-18.check.json`、`AC-18.output.json`（含语义复核命令）、`AC-18.test-stdout.txt`、`AC-18.meta.json`。

### 环境假阴性说明（非缺陷、非阻塞，已修复取证）

- AC-14 / AC-18 机检 `test/wp14/e2e.test.js` 首轮在 harness 默认 TMPDIR 下 2 条用例 `CORE_START_FAILED / EADDRINUSE`：本机 `os.tmpdir()` 为长 `/var/folders/.../T/`，经 `caseTmp` 叠加成 119 字节 socket 路径，超 macOS `sun_path` 104 字节上限被截断，两个 `server.listen()` 现场撞同一截断路径。对照实验：短 TMPDIR（`/tmp`）6/6 通过、长 TMPDIR 复现 4/2 失败。属环境假阴性，非产品缺陷；AC-14/AC-18 用例改用短 TMPDIR（`/tmp/m11b-<AC>`）后复跑，断言一条未改。

### 机检文件名口径差异（登记，非缺陷）

- 需求 §3.1 点名的 `queue-follow.test.js` / `queue-conflict.test.js` / `queue-consistency.test.js` / `queue-count.test.js` / `assets-readonly.test.js` 在本分支均不存在；逐字断言已合并进 `queue.test.js`（AC-15/16/17/18）、`e2e.test.js`（AC-14/18 真链路）、`assets.test.js`（AC-25）。S3 按实际存在文件机检并保留原始 TAP，登记说明但不放宽容断。


## 批次 B 裁决闭环（D-55，2026-11-17）

- **AC-15**：初判「不通过」（架构锚点 `grep ESCALATION_NOT_PENDING src/daemon/queue.js` 0 命中）。主控裁决 D-55：锚点过时——错误码事实在核心 `escalation.js:89`/`orchestrator.js:5049`（D-11 禁改核心），`queue.js:50` 以 `QUEUE_ERROR_CONCLUSIONS = DESKTOP_QUEUE_CONCLUSIONS` 同源引用结论词（:260 按 code 取「已处理」）；需求 v12 锚点归位核心 + queue.js 结论表，行为判定不变。复跑 **16/16 通过**。
- **AC-18**：初判「不通过」（架构⑤ `grep pendingEscalations desktop/ui desktop/src-tauri/src` 2 命中）。主控裁决 D-55：需求 D-9/§3.3 自身要求 `tray-status` 探针携带该字段，`main.rs:300` 从 daemon 投影透传（零自算）；需求 v12 改为排除 `//` / `///` / `*` 注释行与探针字段名后零命中，①~④ 多行感知函数体切块断言保留。复跑 **21/21 通过**。
- **环境假阴性**：AC-14/18 首轮 `EADDRINUSE` 系 macOS socket 路径 104 字节上限（长 TMPDIR 叠加 119 字节），改短 TMPDIR（`/tmp/m11b-<AC>`）后通过，断言一条未改——非产品缺陷。
- **results.jsonl 说明**：历史不通过记录保留作裁决前原始帧；按 §3.5「同一 AC 多条记录取最后一条为准」，最终判定见 `summary.json`（通过 26 / 不通过 0 / 阻塞 0）与 `acceptance-fixture.md`。

---

## 批次 C（AC-27~AC-38）取证台账 · S3 验收工程师批次 C

> 由 `probe/acc11-f-run.mjs --batch c` 取证（当前 HEAD `cdfa9e4`，macOS / Node 22.22.2）；判定只认需求 v12 原文，发现锚点矛盾判「不通过」并写证据 + 裁决请求，不改实现、不放宽断言。
> 结果：**通过 11 / 不通过 1 / 阻塞 0**；唯一不通过条目：AC-27（架构检查锚点与实现冲突，行为侧机检全 #fail 0）。

### AC-27 · 不通过（架构检查锚点矛盾：unavailable 词表键引用）

- **需求原文（架构检查，v12 §3.1 AC-27）**：`grep -REn "unavailable" src/daemon/occupancy.js` 必须**零命中（exit 1）**——意图「注册表缺失不得被判 `unavailable`，占用层只透传投影状态、不产生新状态」。
- **实测**：`exit 0` / **1 条命中**——`src/daemon/occupancy.js:54: ROLE_INSTANCE_STATUS_LABEL.unavailable,`。原始帧 `AC-27.arch-1.log`。
- **根因/分析**：该命中是 `OCCUPANCY_STATUS_ORDER`（最忙状态排序基线）引用**既有词表** `ROLE_INSTANCE_STATUS_LABEL.unavailable` 的键，不是占用层自造 `unavailable` 状态；`statusWordOf` 对未知态 / `retired` 落 `FALLBACK_WORD = inactive`（未参与），注册表缺失沿用既有投影口径不判不可用。语义复核核对项成立（`AC-27.check.json` + `AC-27.output.json` 的 `sed -n '45,72p'` 原始输出）。与 D-55 中 AC-18「探针字段名是需求自身要求下发」同构：**字面命中与需求意图分离**。
- **其余判据全部成立**：机检 `occupancy.test.js`（4/4）+ `ui-views.test.js`（31/31）#fail 0；空态「角色占用 无」、未参与不冒充不可用、现场三跳过提示逐字、`actions` 不含 `release`/`kick` 全部通过。
- **裁决请求（主控/终验）**：属「锚点过时——应比照 D-54/D-55 把锚点归位为『排除词表键引用后零命中』或改锚 `statusWordOf` 不产生新状态的语义」还是「产品缺陷——占用层不应引用 `unavailable` 键、需改实现」？S3 按纪律判不通过，不改实现、不放宽断言。
- **原始帧**：`AC-27.arch-1.log`（0→1 命中原始输出）、`AC-27.check.json`（核对项 + 语义复核 + 逐字期望）、`AC-27.output.json`、`AC-27.test-stdout.txt`、`AC-27.occupancy.tap.json`、`AC-27.ui-views.tap.json`、`AC-27.meta.json`。

### 环境假阴性与机检范围登记（非缺陷、非阻塞，已修复取证）

- **AC-35 / AC-38 `EADDRINUSE` 假阴性**：`e2e.test.js` 走真实 `server.listen()`，长 TMPDIR 叠加致 `core.sock` 路径超 macOS `sun_path` 104 字节上限被截断 → 首轮 `#fail 2`；改短 TMPDIR（`/tmp/m11c-AC-35`、`/tmp/m11c-AC-38`）后复跑通过，**断言一条未改**（D-55 口径）。
- **AC-37 机检范围**：`regression.test.js` 的「三主链：A-0 冻结基线」是与 AC-37 无关的的真实 `orch run` 用例，本环境受 ACP broker 争用偶发「execution attempt 不存在或已关闭」假阴性（`#fail 1`）。AC-37 相关的 D-9 事实已由 `shell-notify.test.js` 静态用例（`tray-quit-confirm 通道不动` + `core.stop` 唯一 + pause/resume 走 `/control`）+ 3 条架构检查覆盖，故不以整文件机检承载 AC-37；**AC-37 判据一条未放宽**，改后连跑 3 次稳定 11/11。
- **shell 真实探针层 SKIP**：`shell-notify.test.js` 真实探针层 1 条按 U-13 gated SKIP（本机 release 二进制早于 `main.rs`）——属**证据分级降级**（mock 实测：静态契约 11 条已落），**非阻塞**；人眼确认（通知外观、点击手感）登记人工核验项，不计入 AC 通过数。

### 机检文件名口径差异（登记，非缺陷）

- 需求 §3.1 点名 `test/wp14/tray.test.js`（AC-35/36/37，本分支不存在）——断言落 `shell-notify.test.js`（WP-9 shell 契约）；`test/wp14/acceptance-e2e.test.js`（AC-38，不存在）——三段逐字断言合并进 `e2e.test.js` + `http-contract.test.js`。按实际存在文件机检并保留原始 TAP，登记说明不放宽。
- `cache` 清理：runner 每条 AC 独立 root + 结束 `killAllDrivers`；`nfr-perf-*.json` 位于 `docs/iterations/iteration-4/evidence/`，本批次未触及。

---

## 批次 C 裁决闭环（D-57 · AC-30 交互机检接缝，2026-11-17）

- **触发点**：AC-30 批次 C 初判通过（9/9），但回执自报 `test/wp14/canvas.test.js` 仅 2 条数据侧用例（只读哈希 / 无运行时字段），需求机检原文四条交互断言（拖拽前后坐标相同 / `views/` 无新增文件 / 探针无 `node-detail`·`jump-host` / 选中态有且仅有 1 个）**未实现**，源码锚点不能替代（D-57）。
- **裁决**：D-57 判定为**可补的测试接缝、非产品缺陷**——必须补断言后重判，不放宽、不伪通过。定义画布（`desktop/ui/canvas/`）本就只读、无写盘/下钻接线（架构检查零命中 + 源码锚点零下钻/拖拽写法双证）；`app.js` 的 `dragEnd → persistOffsets` / `dblclick → focusNode` 属 I1.10a 运行态实例图，非本 AC 定义画布。
- **补缝**：新建 `test/wp14/canvas-interaction.test.js`——纯函数交互模型（`buildCanvas` 投影 + `graphEdges`/`computeLayout` + `nodeRow`，经 `canvas-dump.mjs` harness 驱动，与界面同一批模块、无 DOM/无第三方依赖、`$TMPDIR` 短前缀、中文经 labels/模型零 CJK），逐条落四件事，`node --test` **4/4 `# fail 0`**。
- **机检改造**：`probe/acc11-cases/ac30.mjs` 的 `machineChecks.files` 增加 `canvas-interaction.test.js`，增一条核对项断言四用例齐全且 `# fail 0`；机检说明按需求 AC-30 原文（`req('AC-30').jijian`）。
- **复跑留证**：`node probe/acc11-f-run.mjs AC-30` → **通过 14/14**（旧 9/9 记录保留，按 §3.5 取最后一条为准）；`node probe/acc11-f-final.mjs` → **38/38 通过 / 0 不通过 / 0 阻塞**，证据 439 个。
- **不通过/阻塞条目**：无。此节为 D-57 闭环登记，非新增缺陷。`nfr-perf-*.json` 未触及（git 工作树该路径 clean）。

---

## 批次 D（AC-39~AC-49）取证台账 · S3 验收工程师批次 D

> 由 `probe/acc11-f-run.mjs --batch d` 取证（HEAD `e598e43`，macOS / Node 22.22.2）；判定只认需求 v13 原文，发现锚点矛盾判「不通过」并写证据 + 裁决请求，不改实现、不放宽断言。
> 结果：**通过 10 / 不通过 1 / 阻塞 0**；唯一不通过条目：AC-39（架构检查 D-1 写名单锚点与 D-51 授权的 /ui/prefs 冲突；机检行为侧全 #fail 0）。

### AC-39 · 不通过（架构检查锚点矛盾：D-1 六项名单字面不含 D-51 授权的 /ui/prefs）

- **需求原文（架构检查④/⑥，v13 §3.1 AC-39）**：提取路由表后，POST 行必须全部落在 D-1 六项名单 `{/instances, /queue/escalations/:id/decision, /queue/approvals/:id/decision, /instances/:id/cancel, /control/pause, /control/resume}` 之内；routes.js 写方法 pattern 每行都必须在该名单找到对应 pattern。
- **实测**：架构④ `POST=10 violations=1 bad=[/ui/prefs]`、架构⑥ `writePatterns=10 violations=1 bad=[/ui/prefs]`（`AC-39.arch-4.log` / `AC-39.arch-6.log`）；`/ui/prefs` 的 GET/POST 两行在 `src/daemon/http/routes.js:931,938`。
- **根因/分析**：`/ui/prefs` 是需求自身授权链写入的第六类写——`decisions.md` D-42 授权 `prefs.json` 为通知开关唯一写入方，**D-51 决定第 3 条明写「`GET/POST /ui/prefs`（WP-8 已新增，写仍由 `src/daemon/prefs.js` 独占）一并写入 D-11 授权补项」**；AC-39 自己的 Then 也明写「通知开关偏好对 prefs.json 的写入不计入这三个数字，但必须只写四个开关字段」。实现（`routes.js` + `test/wp14/e2e.test.js` 静态面 allowed 含 `/ui/prefs` 并注 `// D-51：通知开关四键，独立第三类写`）与 AC-39 Then、D-42/D-51 一致，属**架构检查名单过时（字面未随 D-51 补 /ui/prefs）**，非产品缺陷。与 D-54/D-55/D-56 中「字面命中与需求意图分离」同构。
- **其余判据全部成立**：机检 e2e.test.js（6/6）+ http-contract.test.js（18/18）+ prefs.test.js #fail 0；浏览零写哈希相等、actionCount=2 / stateWrites=3 / unexpected=0、prefs 只写四键多余键拒绝、错误形状 400/422/503/404、回环 127.0.0.1、HTTP/UI 零直写盘、无 PATCH、shapeSnapshot 函数体锚点（D-53）全部通过（`AC-39.check.json`）。
- **裁决请求（主控/终验）**：属「锚点过时——把 /ui/prefs 纳入 D-1 写名单，或按 D-51 把 prefs 明确为独立第六类写、不进该名单（比照 D-54/55/56 归位，需求补一句口径不放宽语义）」还是「产品缺陷——/ui/prefs 写接口应删除」？S3 按纪律严格执行字面名单 → 判不通过，不改实现、不放宽断言。
- **原始帧**：`AC-39.arch-4.log`、`AC-39.arch-6.log`、`AC-39.check.json`（含语义复核）、`AC-39.output.json`、`AC-39.test-stdout.txt`、`AC-39.meta.json`。

### 环境口径与机检范围登记（非缺陷、非阻塞）

- **全量测试 >90s**：AC-41 全量命令 `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"` 实测 306s（`# tests 1606` / `# pass 1600` / `# fail 4` / `# skipped 2`），超单 AC 90s 限时；按 regression.test.js 自身「读摘要不递归跑全量」口径，案外跑完整 TAP 生成摘要（`tests >= 1425` + 失败集合与判定基线差集 0），用例读取断言。4 条失败全部落在判定基线（R-08 的 AC-04 + 历史 core.stop / main：--cwd / task-loop 审核提示词），差集 0。
- **AC-43 rev-list 远程引用缺失**：本机 clone 仅 `origin/main` + `origin/feat/i1.11-*`，`origin/feat/i1.10b-drilldown` 不存在 → 原文 `git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown` exit 128；按 D-15「不依赖本地分支是否存在」用本地 `git show-ref --verify --quiet refs/remotes/origin/feat/i1.10b-drilldown`（exit 非 0 = 无该远程跟踪 ref）做等价零分叉核验，不触网以避免网络抖动；UI/harness 源码零下钻引用 + 行为级 open-queue 只展开本条为正判据。
- **AC-40 架构②注释假阳性**：需求原文注「注释不算、spawn.rs 19 行中文注释属既有事实」，但字面 grep 把 `main.rs:196` 注释行中文带出；按 blockers.md 已裁决的注释假阳性排除口径用 `grep -vE ':\s*[0-9]+:\s*(//|\*)'` 排除后，shell 中文字符串文件集合恰为 `{config.rs}`，对真实字面量的零命中不放宽。
- **AC-41 架构人工核对**：`git diff --name-only 66e5a6b -- test/` 含 `test/wp14/**` + 4 个 `test/wp13/**` 文案契约文件（errors/graph-collapse/http-channel/labels-desktop），均为 D-51 授权的 147→249 文案键数冻结更新（I1.9 D-27 先例，精确断言改期望不过滤），删除行只涉及键数/期望清单，未放宽既有断言；其余路径即判失败。
- **U-13 shell 真实探针 SKIP**：全量第 1110 条 `真实探针层：ctl 四动作触发事件并改名 .done` 按 gated SKIP（本机 release 二进制早于 main.rs），属证据分级降级（静态契约层已覆盖接缝），非阻塞；人眼确认登记人工核验项。
- **机检文件名口径差异（登记非缺陷）**：需求点名 `readonly-local.test.js`（AC-39）/`errors.test.js`（AC-42）/`scope-i10b.test.js`（AC-43）/`queue-actions.test.js`（AC-44）/`queue-reconnect.test.js`（AC-47）/`tray.test.js`（AC-48）本分支不存在，逐字断言合并进 e2e/http-contract/prefs、ui-views、contract、queue、shell-notify 等实际存在文件；`labels-desktop.test.js` 冻结测试在 test/wp13 而非 test/wp14。按实际文件机检并保留原始 TAP，登记说明不放宽。

## 批次 D 裁决闭环（D-58，2026-11-17）

- **AC-39**：初判「不通过」（架构④/⑥ D-1 写名单 `POST=10 violations=1 bad=[/ui/prefs]`）。主控裁决 D-58：`/ui/prefs` 是 D-42/D-51 明确授权的本地偏好写（仅四键、仅 prefs.json、不计入 AC-39 三个数字），D-1 名单字面漏同步——需求 v14 把名单扩为六条含 `/ui/prefs`，名单外任何写仍零命中。复跑 **28/28 通过**。
- results.jsonl 历史不通过记录保留作裁决前原始帧；按 §3.5 取最后一条为准，最终判定见 summary.json（49 通过 / 0 不通过 / 0 阻塞）与 acceptance-fixture.md。
- 批次 D 全量 1606/1600/4（差集 0）、purity ×2 exit 0、deps 0（验收 Agent 实测数字）。
