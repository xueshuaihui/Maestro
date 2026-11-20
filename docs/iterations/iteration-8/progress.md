# I1.8 进度台账（主控维护）

> 分支 `feat/i1.8-instance-recovery`，基线 `3f35bfa`（集成版 main，含 I1.4/I1.5/I1.6；**不含 I1.7**）。
> 依据 `docs/templates/execution-template.md` 五阶段 Gate。裁决优先级：AC Then > 附录 A > 附录 D > M/C > 规划 > 代码现状。

## 阶段状态

| 阶段 | 状态 | 结论与产物 |
|---|---|---|
| **S0 需求** | **PASS**（提交 `760b8a1`） | 需求 v3（1419 行 / 67 AC / 54 BR / 8 NFR / M-8 / C-18 / 附录 A~D）；**3 轮干净评审**：r1 FAIL（F-01~F-24）、r2 FAIL（N-01~N-05）、**r3 PASS**（阻断 0 / 建议 0，DoR 13/13、覆盖表 15/15、反向扫描无夹带缺漏）；`requirement-understanding.md` 596 行（8 节 + 67 条 Given 可构造性核查） |
| **S1 拆分** | **PASS**（提交 `ae89f27`） | `docs/iterations/iteration-8.md` 812 行 / 8 节 / 7 WP / AC 67/67 满覆盖 / 文件零交集 / DAG 无环 / 10 个契约冻结点；**2 轮独立评审**：r1 FAIL（A⑤ 唯一判据 FAIL + S-01~S-07 建议）、**r2 PASS**（23/23 判据、阻断 0 / 建议 0） |
| **S2 实现** | **PASS**（5/5 批全部落地） | 5 批：① WP-1+WP-2 ✅ → ② WP-5+WP-6 ✅ → ③ WP-4 ✅ → ④ WP-3 ✅ → ⑤ WP-7 ✅（末批单线，含 D-9 两行授权断言 + 真实宿主面）。每批主控复跑门禁后提交。**遗留**：门禁 ④「三主链逐字基线」的对照口径已改（见下方批次 2/3 段）：`d4b0f94` 之后 main 已依次合入 I1.7~I1.12，全量与三主链统一改用「I1.8 开工点」`014fa6a` 作对照，O-I2 据此闭合。**转 S3/S4 的未完成项**见批次 5 段末清单（AC-26 第二条、AC-27 判阻塞；AC-53/AC-56 已闭合） |
| **S3 验收** | **执行中**（67/67 用例就绪，5 批已落地） | `probe/acc8-f-*` 四件套扩展为全量入口（证据根 `evidence/acc8/`，`ACC8_EVID=wp7` 可复现旧帧）；`acc8-cases/` **67 条用例全部就绪**，分 5 批交付：批一 AC-01~12（`07675c0`）、批二 AC-13~24（`a55d143`）、批三 AC-28~40（`1058741`）、批四 AC-41~51（`f2b9007`）、批五 AC-58~67（`b1662c4`）。**主控逐条核对原始帧 + 不通过项串行隔离复跑**，修 4 处产品缺陷（load 方言透传、三方言降级、连接线角色中文名、恢复失败原因码），纠正 2 处用例口径（`detail.fallback`、`maxRounds` 放宽）。终验全跑与分类见下方 S3/S4 段 |
| **S4 收口** | **未达成 Done（返工后 55 通过 / 10 不通过 / 2 阻塞）** | 按裁-20f 如实判定：模板 §4.5 第 1/2 项（不通过=0 / 阻塞=0）未满足。产物：`report.md`（§0~§6）、`final-verification.md`（**旧轮独立终验，总判 FAIL，已被本轮返工触发重开**）、`acceptance-fixture.md`（67 条索引 + 10 条不通过逐条记录 + 3 条已消除）、`acceptance-product.md`（真实宿主面）、`_acc8-f-summary.json` / `_acc8-f-blockers.md`。**本轮（返工后）归口**：产品缺陷 **0**（AC-49 / AC-60 已返工消除）、需求与冻结基线硬冲突 7（AC-15、AC-23、AC-37、AC-42/43/63 的 `T-003·2/3`、AC-45 逐字文案）、夹具缺口 3（AC-58 kill 窗口、AC-62 投递失败接缝、AC-45 取证时序）；AC-53 已按裁-20r 落地为「逐条独占复跑证伪」的硬门禁并通过。阻塞 2（AC-26/AC-27）按用户裁决**书面豁免但未改判**。**待用户裁决需求修订与夹具授权**，裁决前不宣布结束 |

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

### S2 第 4 批（WP-3 会话复用）门禁实跑（主控，2026-11-19）

| 门禁 | 结果 |
|---|---|
| 全量（对照 `baseline-014fa6a-reds.txt`） | **1921 / 1885 pass / 25 fail / 11 skip**（基线 1841 → **+80 条** = 批次 2 的 31 + 批次 3 的 36 + 本批 13）；帧 `probe/i18-s2/batch4-full.log` |
| 失败集合差集 | 新增红 4 条 = **2 条 D-9 授权预期红**（`test/wp11/role-schema.test.js:57` 的 `ROLE_OPTIONAL_KEYS` 元素数、`test/wp4/orchestrator.test.js:585` 的 `core.gone`）+ **2 条已知 flake**（`--host-error` 6/6、`三主链` 8/8，本批隔离复跑全绿）。**剔除后差集 = 0**（裁-11d） |
| `test/wp13/**` | 本批新增 `session-reuse.test.js` **13/13**（含冻结键序、枚举、D-13 红线、AC-28 补派） |
| 键序 / 可选键（主控实读） | `ROLE_KEY_ORDER` 末位为 `session_policy`（在 `max_concurrent_sessions` 之后）；`ROLE_OPTIONAL_KEYS` 末尾追加；`ROLE_ALIASES.session_policy = 'sessionPolicy'`；新增 `SESSION_POLICIES = ['reuse','fresh']` |
| D-11 五条 | #1 45 文件 exit 0；#2 `src/registry` 11 文件 exit 0；#3 三文件 exit 0；#4 `dependencies` = 0；#5 `OK: no CJK`。帧 `probe/i18-s2/gates-batch4.txt` |
| 资产 / 命令冻结面 | `role validate` 仍 `校验资产 26 个：全部通过（角色 16 · 技能 10）`；`--help` 31 行；`orch recover` 退 2 |
| 拆分遗漏补派落地 | `role-instances.js` 按裁-10a 收窄「服务节点」：`running + phase=assigned` 不计入，AC-28 的 `服务节点 —` 可达成；既有 67 条实例用例全绿 |

**实现口径裁决 裁-11a~11f**：`ROLE_DIFF_KEYS` 不纳入（不扩范围）、`role show --format json` 不加键、AC-49 用角色 **id** 填充（AC Then 优先，模板占位名不符登记为观察项）、flake 构成、`SESSION_POLICIES` 导出、`role-instances` 收窄边界。

### S2 第 5 批（WP-7 授权断言 / 门禁 / 真实宿主）门禁实跑（主控，2026-11-19）

| 门禁 | 结果 |
|---|---|
| 全量（对照 `baseline-014fa6a-reds.txt`） | **1921 / 1888 pass / 22 fail / 11 skip**（基线 1841 → **+80 条**，本批未新增用例，仅转绿 2 条 + 修 1 处产品缺陷）；帧 `probe/i18-s2/batch5-full.log` |
| 失败集合差集 | **新增 1 条 = 已知 flake**：`--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）`，失败点在 `after` 钩子 `EBUSY: rmdir %TEMP%/maestro-wp7-hosterr-*`（沙箱 `node-safe-delete-shim.cjs`），隔离复跑 **6/6 全绿**；**消失 1 条**：`live 取消：四项全 null、终态 cancelled/ended、不阻断取消`（基线红→转绿，属改善）。**剔除 flake 后差集 = 0**（裁-13d）；帧 `probe/i18-s2/batch5-reds.txt` |
| D-9 两条授权预期红 | **全部消除**：`test/wp4/orchestrator.test.js` **37/37 全绿**、`test/wp11/role-schema.test.js` **36/36 全绿**；`:588~592` 的 v1 一字不改断言未动 |
| **产品缺陷（主控亲修）** | `recoverSessionEntry` 在 `initializeAdapterOnly` 已成功（宿主可达）后仍返 `host_unreachable / unavailable:true` → 实例被 `markInterrupted`，与 D-5「只有宿主不可达才致命」不符。修为 `{ok:false, reason:'no_dialect', unavailable:false}` 走会话级降级（节点 `running→assigned`、角色 `available`、写恢复事件后继续调度）。位置 `src/core/orchestrator.js:5210-5216`（裁-13a） |
| `test/wp13/**` | 本批无新增用例文件，全量内 `test/wp13/**` 无回归；新增夹具侧用例并入 `fixtures.test.js`（批次 2 已计） |
| D-11 五条 | #1 45 文件 exit 0；#2 `src/registry` 11 文件 exit 0；#3 三文件 exit 0；#4 `dependencies` = 0；#5 `OK: no CJK`。帧 `probe/i18-s2/gates-batch5.txt` |
| 资产 / 命令冻结面 | `role validate` 仍 `校验资产 26 个：全部通过（角色 16 · 技能 10）`；`NODE_STATES` 仍 **7 项**；`--help` 31 行；`orch recover` 退 **2** |
| 中文唯一来源 | `src/` 本批新增行中文字面量 **0** 处（仅注释） |
| AC-56 重判机检 | `git diff 014fa6a..HEAD -- src/core/orchestrator.js \| grep -c worktree` = **0**；`… \| grep -cE 'artifact_type.*dir\|merge.*order'` = **0** → 裁-12 第 1 条**通过**。全仓口径仍有 2 处（`code-isolation.js:6`、`orchestrator.js:2496`），核实**均在 `014fa6a` 基线已存在**（基线同文 `:2258`），I1.8 新增行零命中，按裁-13c 不改 I1.7 代码 |
| 历史证据污染 | `test/wp10/perf.test.js` 覆盖 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 复现，已用 `git -c core.autocrlf=false checkout-index -f -- <三路径>` 恢复 |

**批次 5 未完成项（不掩盖，转 S3 / S4 报告）**：

1. **AC-26 第二条机检判「阻塞」**：编码闭环实例无 `workspace/artifacts/**`（产物落在 I1.7 的 `worktrees/` 与 `stage/`，强杀窗口内 `stage/` 为空），**不用空集冒充**。
2. **AC-27 判「阻塞」**：`dsh-acp-server@0.14.4` 真实安装成功（`added 95 packages`），bin 启动即抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME … Received protocol 'c:'`（本机只有 Electron + `app.asar/bin.js`，无 `dsh` CLI），留原始 stderr 帧。
3. **AC-53 已闭合**（差集剔 flake 后 = 0）；**AC-56 已闭合**（裁-12 + 裁-13c）。
4. **真实宿主版本实测 `0.2.2-rc.5`**，需求写 `rc.1`；按实测取证、不改需求，S4 报告 §5 登记（裁-13f）。

**实现口径裁决 裁-13a~13f**（`decisions.md` 第十节）：会话恢复降级缺陷修复、D-9 授权额度用尽、AC-56 全仓 2 处 vs diff 0 处的口径差、批次 5 差集构成、未完成项去向、宿主版本实测优先。

### WP-7 任务书必须吸收的三条（批次 4 交付时的接口约定）

1. **D-9 两行授权改动**现在是**两条预期红**：`test/wp11/role-schema.test.js:57`（`ROLE_OPTIONAL_KEYS` 末尾追加 `'session_policy'`）与 `test/wp4/orchestrator.test.js:480/575/578/580/584~586`（改为「按实例记录恢复」）；`:588~592` 的 v1 一字不改断言保持原样。
2. **真实宿主面可真验**：I1.8 需求按「本机无 DSH CLI」写的阻塞口径，已被 I1.12 证伪——本机真实宿主导 `0.2.2-rc.3`，配方见 `probe/acc12-perf-pilot.mjs`（隔离 `DSH_HOME` + 复制 `~/.dsh/.credentials.yaml` 用完即删 + patch 层同时覆盖 `agent-default-model` 与 `acp` 两个 provider 到 `deepseek-account`）。AC-25/26/27/57 应**优先取证**，取不到才判阻塞并留帧。
3. **AC-52 三主链基线口径**：`d4b0f94` 之后已合入 I1.7~I1.12，逐字基线改以 **I1.8 开工点 `014fa6a`** 的工作树对照；同时保留 `test/wp9/i19-regression.test.js` 的 8 条三主链断言全绿作为机检锚点。

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



## S4 返工轮（2026-11-21，用户裁决「先返工 2 条产品缺口」+「AC-26/AC-27 书面豁免」）

**改动面**（S2 级，非 S3 顺手改）：`src/core/orchestrator.js`（`buildSession` 补 `roleId`/`instanceId`/`servingNodeId`；
`newState` 增 `sessionPolicies` 快照 + `policySnapshot`/`sessionPolicyOf`；派发路径改「先试复用（`resume`/`load` 两站）再新建」
+ 命中写 `session.reuse` 事件；`sessionOf` 改倒序取最新；`recoverInstance` 收集 `plan.ready`；`continueRecovery` 末尾续派且**派前重读磁盘**）、
`src/cli/roles.js`（新增 `roleSessionPolicies`）、`src/cli/main.js`（`run.start` 下发快照 + `instance log` 渲染复用行）、
`src/daemon/server.js`（`run.start` 边界校验与透传、`test.dispatch` 透传 `hostId`）。

**测试改动**：新增 `test/wp13/session-reuse-dispatch.test.js`（5 例：AC-65 / AC-66×2 / AC-49 正控 / AC-48）；
`test/wp13/recovery-boot.test.js` 的 AC-60 用例改写（hold 点分离取证 + `orchestrator.cancel` 收尾避免 Windows `ENOTEMPTY`）；
`test/wp9/i19-regression.test.js` 按裁-20m 合法扩项（会话发射点 ≤13 → ≤14，且 `session.reuse` 写入点单列断言恰 1 处，
既有 13 处一字未动，**不放松为子集**）。

| 门禁 | 结果 |
|---|---|
| 全量 `node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` | **1927 / 1895 pass / 21 fail / 11 skip**（基线 `014fa6a` 1841/1808/22/11 → **+86 条**）；帧 `probe/i18-s2/batch6-full.log` |
| 失败集合差集 | **EXTRA = 0**（21 条 ⊆ 基线 22 条），并修好 1 条基线红（`live 取消…`）；帧 `probe/i18-s2/batch6-reds.txt` |
| 首轮 4 条新增红 | AC-32 / AC-60 / AC-62 / 三主链 A-0 —— 根因是 `continueRecovery` 把已被 `redeliver` 派发的节点又派一次（双 prompt）。修法：`plan.ready` 派前重读磁盘确认仍 `pending`；三条恢复用例（`handoff-recovery` 6/6、`recovery-boot` 17/17）复绿 |
| `session-reuse-dispatch` | **5/5**；`recovery-boot` **17/17**；`handoff-recovery` **6/6** |
| 全量 67 条验收（`--batch all`） | 批次内 53/12/2 → 按裁-20r 逐条独占复跑后 **55 通过 / 10 不通过 / 2 阻塞**；714 核对项（684 通过）；451 份被引用帧；分级 mock 58 / 真实宿主 4 / 架构门禁 5 |
| 独占复跑台账 | `probe/i18-s2/batch7-isolated-rerun.txt`：AC-08 / AC-31 单跑全绿 → 负载 flake 剔除；其余 10 条稳定红；AC-53 复跑后 `EXTRA=0` |
| 纯净门禁 / 用法块 / 命令树 | purity exit 0、deps 0、`USAGE_LINES` 25 行、`--help` 31 行、`NODE_STATES` 7 项、三主链 diff 0 |

**关键口径**：① `state.sessions` 是「每次派发一条记录」，复用后同一 `sessionId` 会有两条（r1 历史 + r2 绑定），
故按 id 查找必须取**最新**；② checkpoint 九字段是显式白名单，`sessionPolicies` 不会泄漏进检查点，因此**不改冻结契约**即可带策略；
③ `plan.ready` 续派必须在 `redeliver` / `createdContinue` 之后且落盘重读，否则同一节点双派（实测撞红 AC-32/AC-62）。
裁决 **裁-20k / 20k-补 / 20l / 20m / 20n / 20o / 20p / 20q / 20r**（`decisions.md` 第十七节）。

## 裁决台账（`decisions.md`）

裁-1（状态机 7 项 + 9 态投影）/ 裁-2（D-11 三文件口径）/ 裁-3（会话 `escalated` 沿用既有指示器）/ 裁-4（AC-54 内嵌 D-11 逐字副本）/ 裁-5（D-9 行号 `:588~592`）/ 裁-6（`session_policy` 命名）/ 裁-7（§8 措辞同步「已裁决」）/ **裁-8a~8f（批次 1）/ 裁-9a~9h（批次 2）/ 裁-10a~10e（批次 3 + 补派 + flake）/ 裁-11a~11f（批次 4）/ 裁-12（AC-56 合入后重判）/ 裁-13a~13f（批次 5 + 会话恢复降级缺陷修复）/ 裁-14~19（S4 终验口径与受阻归口）/ 裁-20a~20r（AC-17 亲修、AC-60 定性自纠、reuse 缺口、需求硬冲突、夹具缺口、Done 判定、AC-03/08 断言纠正、驱动补窗、门禁口径代码化、返工落地、冷冻测试合法扩项、AC-26/27 书面豁免、白名单撤销、i19 flake 归因、逐条独占复跑）**。

## S2 批次与门禁口径

- **契约先冻结（批次 0）**：拆分文档 §6 的 10 个冻结点已定死，各 WP 按冻结签名实现，不改接口。
- **文件边界**：`src/core/orchestrator.js` 唯一负责人 WP-4；`labels.js`/`render.js` 唯一负责人 WP-5；`roles.js` 唯一负责人 WP-3；`main.js` 唯一负责人 WP-4；`acp-client.js` 唯一负责人 WP-2；测试夹具唯一负责人 WP-6；D-9 两行授权断言唯一负责人 WP-7。
- **每批门禁（§2.5 四件套，主控亲自复跑）**：① 全量 `node --test --test-concurrency=4 "test/**/*.test.js"`（与 `origin/main` **失败集合差集 = 0**、条数 `>= 992`、既有噪声不计）；② D-11 五条纯净扫描（31 词 / 30 词 / 三文件口径 / `dependencies`=0 / 零 CJK）；③ 该批新增 `test/wp13/*.test.js` 全绿；④ 三主链与**集成版 `d4b0f94`** 归一化 diff 为空（非 `0cd113b`）。
- **既有断言**：仅 D-9 两行授权改动（`:57` 与 `:480/575/578/580/584~586`），`:588~592` 一字不改；其余 `test/**` 零改动，新增断言一律 `test/wp13/**`。
- **行尾**：本机 `core.autocrlf=true`，提交前统一 LF（历史坑：CRLF 让逐字节资产断言与 SHA256 假红）。
- **真实宿主面**：AC-25/26/27/57 无 DSH CLI 时判「阻塞」，**不得用夹具冒充**；隔离 `DSH_HOME`，不动用户 `~/.dsh`。
- **I1.7 边界（口径已更新，裁-12）**：需求 Given 写「main 不含 I1.7」，但 I1.7 已收口合入 main（`docs/iterations/iteration-7/requirement.md` 与 `src/core/code-isolation.js` 均存在）。按 AC-56 的 Then 末句「合入后重跑」执行重判：**判据改为「I1.8 是否依赖 I1.7 能力」**——`git diff 014fa6a..HEAD -- src/core/orchestrator.js` 内 `worktree` / `artifact_type.*dir` / `merge.*order` 必须零命中（实测 `0 / 0`）。**不得**为凑旧数字去改 I1.7 代码或删 I1.7 文档。
- **对照基线（口径已更新）**：全量与三主链统一对照 **I1.8 开工点 `014fa6a`**（`1841/1808/22/11`），红名单固化在 `probe/i18-s2/baseline-014fa6a-reds.txt`；`d4b0f94` 与 `992` 条旧基线均不再作对照。

## 需求侧披露与遗留（S4 报告需列）

- R-1~R-9（需求 §1.3.2 规划解释登记）、B-01/04/10（阻塞后续迭代联合验收）、B-07/08/09/12/13（需评审裁决 / 已裁决）、O-I1/O-I2（I1.6 与集成版遗留：用法块未列 I1.4 命令、三主链逐字基线须以集成版重建、`workflow` 双语义建议 I1.7+ 统一）。
- 全量测试基线：需求记 `992/988/4`，集成版对照 `992/987/5`，差 1 条为 Windows 并发 `EBUSY` 噪声；门禁按「失败集合差集 = 0 + 条数只增不减」。
