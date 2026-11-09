# I1.8 进度台账（主控维护）

> 分支 `feat/i1.8-instance-recovery`，基线 `3f35bfa`（集成版 main，含 I1.4/I1.5/I1.6；**不含 I1.7**）。
> 依据 `docs/templates/execution-template.md` 五阶段 Gate。裁决优先级：AC Then > 附录 A > 附录 D > M/C > 规划 > 代码现状。

## 阶段状态

| 阶段 | 状态 | 结论与产物 |
|---|---|---|
| **S0 需求** | **PASS**（提交 `760b8a1`） | 需求 v3（1419 行 / 67 AC / 54 BR / 8 NFR / M-8 / C-18 / 附录 A~D）；**3 轮干净评审**：r1 FAIL（F-01~F-24）、r2 FAIL（N-01~N-05）、**r3 PASS**（阻断 0 / 建议 0，DoR 13/13、覆盖表 15/15、反向扫描无夹带缺漏）；`requirement-understanding.md` 596 行（8 节 + 67 条 Given 可构造性核查） |
| **S1 拆分** | **PASS**（提交 `ae89f27`） | `docs/iterations/iteration-8.md` 812 行 / 8 节 / 7 WP / AC 67/67 满覆盖 / 文件零交集 / DAG 无环 / 10 个契约冻结点；**2 轮独立评审**：r1 FAIL（A⑤ 唯一判据 FAIL + S-01~S-07 建议）、**r2 PASS**（23/23 判据、阻断 0 / 建议 0） |
| **S2 实现** | 进行中（第 1 批 WP-1/WP-2 已随本提交落地） | 5 批：① WP-1+WP-2 ✅ → ② WP-5+WP-6 → ③ WP-4（单线）→ ④ WP-3 → ⑤ WP-7（末批单线）。每批主控复跑门禁后提交。**遗留**：门禁 ④「三主链与集成版 `d4b0f94` 归一化 diff 为空」需按集成版重建逐字基线后补证（见下方补记），S2 收口前必须闭合 |
| **S3 验收** | 未开始 | `probe/acc8-f-*` 四件套 + `acc8-cases/` 67 用例 + `evidence/`；主控独立复跑全部批次 |
| **S4 收口** | 未开始 | 终验 Agent + `report.md` / `final-verification.md` / `acceptance-*.md`，Done 七项判定 |

### S2 第 1 批（WP-1 / WP-2）门禁实跑（主控，2026-11-09）

| 门禁 | 结果 |
|---|---|
| `test/wp13/checkpoint.test.js` + `dialect.test.js` | **25/25**（10 + 15），`node --check` 三文件 OK |
| D-11 五条纯净扫描 | 22 / 11 / 3 文件零命中；`deps=0`；`OK: no CJK` |
| 全量 `node --test --test-concurrency=4 "test/**/*.test.js"` | **1017 / 1012 / 5**（基线 992/987/5，条数 +25）；5 条失败名 `promptFailures:2`、`--host-error 早返回`、`HANDOFF_EVIDENCE_ESCAPE`、`resolveEvidenceRef`、`可注入 fs stat` 与集成版既有噪声**差集 = 0** |
| 三主链逐字回归 | `probe/acc6-f-run.mjs AC-49` 探索性复跑：**21 项 / 17 通过 / 4 不通过（verdict 不通过）**。4 条差异全部来自「集成版当前树 vs I1.5 存量 `0cd113b` 基线」的口径差，非本批回归；详见下方补记与门禁 ④ 遗留 |
| 行尾 | 交付文件 CR=0；`paths.js` 仅追加 5 行、既有导出零改动 |

实现口径裁决 **裁-8a~8f**（`decisions.md` 第五节）：`checkpointPath` re-export、`checkpointId` 单调保护、ENOENT 归 `CHECKPOINT_UNREADABLE`、D-3 字段名 `nodeId`/`handoffId`、**WP-4 接线须显式传 `currentPrompt` 且不得重复发 prompt**、`canResume`/`canLoad` 双形态并存。

### S2 第 1 批三主链门禁补记（AC-49 探索性复跑，2026-11-09 19:00Z）

**证据分级：mock 实测（夹具机检面）**；真实宿主面 AC-25/26/27/57 仍为「阻塞」（本机无 DSH CLI，留 WP-7）。原始帧见
`docs/iterations/iteration-8/evidence/gate-batch1/`（`AC-49.output.json` 21 项 checks、`AC-49.report.md`、当前树三链 `-current.txt`）。

- **结论**：以 I1.6 存量用例 `AC-49`（基线树固定挂 `0cd113b`）复跑当前集成版工作树，`21 项 / 17 通过 / 4 不通过 / verdict 不通过`。
- **4 条差异根因**：① `code-loop`、③ `task-loop` 的 `.mock/prompts` task 文本多出「工作区 / 共享区（只读）/ 本节点阶段区 / 上游阶段区」四行（I1.4 共享工作区特性）；②④ `task-loop` 归一化输出 19 行差异集中在会话状态行顺序（`会话 空闲` / `会话 执行中 ·` / `会话 等待下游 · 产出已提交` 位移）。`single` 与 `code-loop` 的逐字输出主体仍 0 行差异，`0cd113b` 基线树自证断言全绿。
- **与本批改动无关**：WP-1 的 `checkpoint.js` / `checkpointPath` 与 WP-2 的 `normalizeCapabilities` / `resumeOrCreate` 等均为新增、尚未接入 `orchestrator` / CLI，三主链执行路径不经过；差异对应已披露的遗留 **O-I2**（三主链逐字基线须以集成版重建），不是回归。
- **处置声明**：本批复跑覆盖的 `docs/iterations/iteration-6/evidence/AC-49.*`、`probe/acc6-f-parts/AC-49.md`、`probe/acc6-f-results.jsonl` 已**恢复为 HEAD**，I1.6 已 PASS 的 65/65 证据链不被「不通过」结果污染；重跑原始帧另存本迭代 `evidence/gate-batch1/` 供复核。
- **门禁 ④ 尚未闭合**：§2.5 要求「与集成版 `d4b0f94` 归一化 diff 为空」，本批用 `0cd113b` 存量基线的探索性复跑不能替代该判据；S2 收口前须以 `d4b0f94` 重建三链逐字基线并补证，S4 报告需列 O-I2。

## 裁决台账（`decisions.md`）

裁-1（状态机 7 项 + 9 态投影）/ 裁-2（D-11 三文件口径）/ 裁-3（会话 `escalated` 沿用既有指示器）/ 裁-4（AC-54 内嵌 D-11 逐字副本）/ 裁-5（D-9 行号 `:588~592`）/ 裁-6（`session_policy` 命名）/ 裁-7（§8 措辞同步「已裁决」）。

## S2 批次与门禁口径

- **契约先冻结（批次 0）**：拆分文档 §6 的 10 个冻结点已定死，各 WP 按冻结签名实现，不改接口。
- **文件边界**：`src/core/orchestrator.js` 唯一负责人 WP-4；`labels.js`/`render.js` 唯一负责人 WP-5；`roles.js` 唯一负责人 WP-3；`main.js` 唯一负责人 WP-4；`acp-client.js` 唯一负责人 WP-2；测试夹具唯一负责人 WP-6；D-9 两行授权断言唯一负责人 WP-7。
- **每批门禁（§2.5 四件套，主控亲自复跑）**：① 全量 `node --test --test-concurrency=4 "test/**/*.test.js"`（与 `origin/main` **失败集合差集 = 0**、条数 `>= 992`、既有噪声不计）；② D-11 五条纯净扫描（31 词 / 30 词 / 三文件口径 / `dependencies`=0 / 零 CJK）；③ 该批新增 `test/wp13/*.test.js` 全绿；④ 三主链与**集成版 `d4b0f94`** 归一化 diff 为空（非 `0cd113b`）。
- **既有断言**：仅 D-9 两行授权改动（`:57` 与 `:480/575/578/580/584~586`），`:588~592` 一字不改；其余 `test/**` 零改动，新增断言一律 `test/wp13/**`。
- **行尾**：本机 `core.autocrlf=true`，提交前统一 LF（历史坑：CRLF 让逐字节资产断言与 SHA256 假红）。
- **真实宿主面**：AC-25/26/27/57 无 DSH CLI 时判「阻塞」，**不得用夹具冒充**；隔离 `DSH_HOME`，不动用户 `~/.dsh`。
- **I1.7 边界**：当前 main 不含 I1.7；不依赖 worktree / 产物隔离；I1.7 合入后 67 条 AC 全部重跑。

## 需求侧披露与遗留（S4 报告需列）

- R-1~R-9（需求 §1.3.2 规划解释登记）、B-01/04/10（阻塞后续迭代联合验收）、B-07/08/09/12/13（需评审裁决 / 已裁决）、O-I1/O-I2（I1.6 与集成版遗留：用法块未列 I1.4 命令、三主链逐字基线须以集成版重建、`workflow` 双语义建议 I1.7+ 统一）。
- 全量测试基线：需求记 `992/988/4`，集成版对照 `992/987/5`，差 1 条为 Windows 并发 `EBUSY` 噪声；门禁按「失败集合差集 = 0 + 条数只增不减」。
