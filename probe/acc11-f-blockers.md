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
