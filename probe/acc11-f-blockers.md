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
