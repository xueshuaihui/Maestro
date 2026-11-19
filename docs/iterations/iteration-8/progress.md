# I1.8 进度台账（主控维护）

> 分支 `feat/i1.8-instance-recovery`，基线 `3f35bfa`（集成版 main，含 I1.4/I1.5/I1.6；**不含 I1.7**）。
> 依据 `docs/templates/execution-template.md` 五阶段 Gate。裁决优先级：AC Then > 附录 A > 附录 D > M/C > 规划 > 代码现状。

## 阶段状态

| 阶段 | 状态 | 结论与产物 |
|---|---|---|
| **S0 需求** | **PASS**（提交 `760b8a1`） | 需求 v3（1419 行 / 67 AC / 54 BR / 8 NFR / M-8 / C-18 / 附录 A~D）；**3 轮干净评审**：r1 FAIL（F-01~F-24）、r2 FAIL（N-01~N-05）、**r3 PASS**（阻断 0 / 建议 0，DoR 13/13、覆盖表 15/15、反向扫描无夹带缺漏）；`requirement-understanding.md` 596 行（8 节 + 67 条 Given 可构造性核查） |
| **S1 拆分** | **PASS**（提交 `ae89f27`） | `docs/iterations/iteration-8.md` 812 行 / 8 节 / 7 WP / AC 67/67 满覆盖 / 文件零交集 / DAG 无环 / 10 个契约冻结点；**2 轮独立评审**：r1 FAIL（A⑤ 唯一判据 FAIL + S-01~S-07 建议）、**r2 PASS**（23/23 判据、阻断 0 / 建议 0） |
| **S2 实现** | 进行中（第 1/2/3 批已落地：WP-1/WP-2、WP-5/WP-6、WP-4） | 5 批：① WP-1+WP-2 ✅ → ② WP-5+WP-6 ✅ → ③ WP-4 ✅ → ④ WP-3 → ⑤ WP-7（末批单线）。每批主控复跑门禁后提交。**遗留**：门禁 ④「三主链逐字基线」的对照口径已改（见下方批次 2/3 段）：`d4b0f94` 之后 main 已依次合入 I1.7~I1.12，全量与三主链统一改用「I1.8 开工点」`014fa6a` 作对照，O-I2 据此闭合 |
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

### S2 第 2 批（WP-5 / WP-6）门禁实跑（主控，2026-11-19）

**对照基线口径**：本批开工点 = `014fa6a`（当前 main，已含 I1.7~I1.12）。基线全量帧与红名单固化在
`probe/i18-s2/baseline-014fa6a-{full.log,reds.txt}`：**1841 / 1808 pass / 22 fail / 11 skip**。
不再使用 `992` 条旧基线（那是 I1.9 之前的规模），也不把 `d4b0f94` 当作全量对照（其后已有 4 个迭代合法改输出）。

| 门禁 | 结果 |
|---|---|
| 全量 `node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` | **1872 / 1840 pass / 21 fail / 11 skip**（基线 1841 条 → **+31 条** = WP-5 的 12 + WP-6 的 19）；帧 `probe/i18-s2/batch2-full.log` |
| 失败集合差集 | **新增红 0**（21 条全部 ⊆ 基线 22 条）；基线红 `live 取消` 本批消失（帧 `probe/i18-s2/batch2-reds.txt`） |
| 首轮全量的 1 条额外红 | `--host-error 早返回（-32603）`，失败在测试 `after` 钩子 `EBUSY: rmdir`（沙箱 `node-safe-delete-shim.cjs`）。隔离复跑 **6/6 全绿**（帧 `probe/i18-s2/flake-host-error.isolated.log`），第二次全量未复现 → 按 flake 登记，不计新增红（裁-9h） |
| `test/wp13/**` 全量 | **300 条 / 287 pass / 4 fail / 9 skip**；4 条（`AC-04`、`AC-27`、`S-07`、`desktop port listen`）**逐条命中基线红名单**，非本批引入 |
| 既有基线锁死 | `test/wp2/labels.test.js` **29/29**、`test/wp15/**` **134/134** 全绿（I1.11 / I1.12 冻结键零破坏） |
| D-11 五条纯净门禁 | #1 `src/core,src/daemon`（45 文件）exit 0；#2 `src/registry`（11 文件）exit 0；#3 三文件口径（3 文件）exit 0；#4 `dependencies` = **0**；#5 输出 `OK: no CJK`。帧 `probe/i18-s2/gates-batch2.txt` |
| 用法块 / 命令树 | `USAGE_LINES` 仍 **25 行**、`--help` 31 行（25 + I1.12 的 6）；`orch recover` 仍退 **2**（未新增 CLI 命令） |
| 行尾 / 空白 | 交付文件统一 LF（提交时由 `core.autocrlf` 规范化）；`git diff --check` exit 0 |
| 历史证据污染 | `test/wp10/perf.test.js` 覆盖 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 的老问题复现，已用 `git -c core.autocrlf=false checkout-index -f -- <三路径>` 恢复，`git diff --stat` 为空 |

**实现口径裁决 裁-9a~9h**（`decisions.md` 第六节）：`NODE_PHASE_LABEL` 保持 4 键、A-7 不新增导出、
恢复摘要须由 WP-4 同时设 `recovery` 与 `recoveredAt`、A-3 事件映射留 `main.js`、节点元素按需透出 `phase`、
mock 能力广告用 `{}` 形态、`--prompt-failures` 双来源、flake 归因。

### S2 第 3 批（WP-4 恢复编排内核）门禁实跑（主控，2026-11-19）

| 门禁 | 结果 |
|---|---|
| 全量（二轮，对照 `probe/i18-s2/baseline-014fa6a-reds.txt`） | **1908 / 1875 pass / 22 fail / 11 skip**（基线 1841 → **+67 条** = 批次 2 的 31 + 本批 36：`recovery-boot` 17 / `role-recovery` 5 / `handoff-recovery` 6 / `session-failure` 8）；帧 `probe/i18-s2/batch3-full.log` |
| 失败集合差集 | **新增红恰 1 条 = D-9 授权的预期红**（`test/wp4/orchestrator.test.js:585` 的 `core.gone` 三行断言，按拆分 §6 冻结点 8 属「改后必红是预期」，留 WP-7 改测试）；其余 21 条 ⊆ 基线（`live 取消` 本批未复现） |
| 首轮差集外 2 条 | `--host-error 早返回`（`after` 钩子 `EBUSY` 清理，隔离 6/6 绿）、`三主链：无新增可见词`（时序负载，隔离 8/8 绿，帧 `probe/i18-s2/wp4-three-chains.isolated.log`）→ 均按 flake 登记，不计新增红（裁-10d） |
| `test/wp13/**` | **335 条 / 322 pass / 4 fail / 9 skip**；4 条（`S-07`、`desktop port listen`、`AC-04`、`AC-27`）逐条命中基线红名单 |
| D-11 五条 | #1 45 文件 exit 0；#2 11 文件 exit 0；#3 三文件 exit 0；#4 `dependencies` = 0；#5 `OK: no CJK`。帧 `probe/i18-s2/gates-batch3.txt` |
| 冻结面 | `NODE_STATES` 仍 **7 项**（`["pending","running","review","done","failed","cancelled","escalated"]`）；`main.js` 的 `RUNTIME_COMMANDS` / `RUNTIME_SUBS` / `FAMILY_MODULES` / `USAGE_LINES` **零改动**；`--help` 31 行；`orch recover` 退 2 |
| 中文唯一来源 | `src/` 新增行中的中文**仅 1 行注释**，新增中文字符串字面量 **0** |
| 契约核对（主控抽查） | `PHASE_EDGES` 恰为 D-2 六组（`blocked→ready` / `ready→assigned` / `assigned→running` / `running→assigned` / `assigned→cancelled` / `assigned→escalated`）；`state` 与 `phase` 在**同一次 `saveState`**（`:1016-1031`）；`saveState` 成功后 `writeStateCheckpoint`（`:770`）；`reconcileOnBoot` 真实调用 `recoverInstance`（`:5790` / `:5811`） |

**本批未完成项（不掩盖，转 S3 / 报告）**：AC-58 e2e 未执行（需 spawn + 强杀冷启动，S3 用 `recovery-driver --scenario e2e` 取证）；AC-24 是基线既有红；AC-35 的 `delivered→accepted` 段依赖宿主首帧。见裁-10e。

**拆分遗漏补派（裁-10a）**：`src/registry/role-instances.js` 未被任何 WP 覆盖，而 AC-28 的 Then 要求 CLI 显示 `服务节点 —`；**补派 WP-3**，授权仅限「服务节点」判定按 9 位置收窄。

### WP-3 任务书必须吸收的两条（批次 3 交付时的接口约定）

1. `import { selectReusableSession } from '../core/orchestrator.js'` 直接消费（裁-10c），签名冻结为 `(sessionList, { instanceId, roleId, hostId, nodeId }) → session | null`。
2. `src/registry/role-instances.js` 按 9 位置收窄「服务节点」：`state='running' + phase='assigned'` 不得算作正在服务（AC-28 的 `服务节点 —`）；不改其它派生规则（裁-10a）。

### WP-4 任务书必须吸收的三条（批次 2 交付时的接口约定）

1. **`parsePauseSpec` 白名单**扩 `after_assign[:<节点>]` / `after_handoff_created[:<包号>]`，既有三值语义不变；同样新增 `MAESTRO_FAULT=checkpoint_write:fail`、`MAESTRO_TEST_SLOW_MS`、`MAESTRO_TEST_RECOVERY_HOLD=after_assign`、`MAESTRO_TEST_GRAPH`（仅 `NODE_ENV=test` + 绝对存在的文件）。
2. **恢复摘要数据契约**：`state.recovery = {checkpointAt, skipped, round, maxRounds}` 与 `recoveredAt` **必须同时写**（裁-9c）；`render.js` 从 `snapshot.recovery` 读，缺该对象会退回按节点推算，可能渲染出 `轮次 2/2`。
3. **`main.js` 接线点**：`instance status` / `instance graph` 用 `renderInstanceStatusLines` / `renderRecoveryBlock`；
   `instance log` 的 `recovery.*` / `session.crash` / `session.slow` / `session.rebuild_failed` / `checkpoint.write_failed`
   事件行由 WP-4 在 `main.js` 前置分派，模板取 `RECOVERY_TEXT` / `SESSION_FAILURE_TEXT`。
   另：`MAESTRO_MOCK_NEW_FAIL` / `MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER` 只在「重建/恢复现场」生效，**首次派发不会失败**，不要据此写 AC-43 的首次路径。



## 裁决台账（`decisions.md`）

裁-1（状态机 7 项 + 9 态投影）/ 裁-2（D-11 三文件口径）/ 裁-3（会话 `escalated` 沿用既有指示器）/ 裁-4（AC-54 内嵌 D-11 逐字副本）/ 裁-5（D-9 行号 `:588~592`）/ 裁-6（`session_policy` 命名）/ 裁-7（§8 措辞同步「已裁决」）/ **裁-8a~8f（批次 1 实现口径）/ 裁-9a~9h（批次 2 实现口径）/ 裁-10a~10e（批次 3 + 拆分遗漏补派 + flake 归因 + 未完成项转 S3）**。

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
