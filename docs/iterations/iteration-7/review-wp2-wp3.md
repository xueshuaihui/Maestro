# I1.7 · WP-2（code-isolation）与 WP-3（doc-artifact + templates）独立评审

> 评审对象：WP-2 `e138230`（`src/core/code-isolation.js` + `test/wp7/i17-code-isolation.test.js`）、WP-3 `03bd672`（`src/core/doc-artifact.js` + `src/templates/index.js` + `test/wp7/i17-code-strategy.test.js`）
> 评审基线：HEAD `96806a2`（两 WP 均已合入）
> 契约权威：`docs/iterations/iteration-7.md` §2.2/§2.3/§2.4/§3.1/§6/§7 + `requirement.md` v2（AC-01/05/06/07/08/10/13/14）
> 评审方式：逐个 hunk 读 `git show e138230` / `git show 03bd672`，逐条对照签名与行为，全部结论附 `文件:行` 与实际代码片段；门禁均实跑
> 评审约束：只读评审，未修改任何源码/测试

---

## 0. 总判

**PASS** —— **阻断 0 条，建议 10 条**。

两 WP 均守住本迭代的硬红线：合并编排主责确实落在 `code-isolation.js`、`resolveNodeProducts` 既有 5 分支语义未被改动、队列严格串行、冲突必 `abortMerge`、`branch/mergeStatus` 全部经注入 `applyStateChange` 写回、31 禁词 0 命中、`dependencies` 键数 0、`src/core` 中文 0 命中。建议项集中在「升级写失败被掩蔽」「reprocess 跨进程失效」「路径单一来源被旁路」等健壮性与契约细节，不构成合并阻断，建议在 I1.8 前修复 F-01/F-02。

---

## 1. 逐条契约核对（判定）

| 契约条款 | 判定 | 依据（文件:行 / 实跑） |
|---|---|---|
| §2.2 导出签名齐全（7 个函数） | 通过（2 处参数偏差见 F-03） | `src/core/code-isolation.js:48,99,170,142,218,238,273` |
| §2.2 `createMergeQueue` 严格串行、禁止并发 | 通过 | `code-isolation.js:281,360-370`；单测 `maxActive===1`（`i17-code-isolation.test.js:196`） |
| §2.2 冲突 → `abortMerge` 回滚 + `merge_conflict` 升级 | 通过 | `code-isolation.js:204-207,325,328-347`；e2e `test/wp4/orchestrator.test.js:1731-1747`（回滚后 integration 仍为 `integration-side`，双 worktree/分支保留） |
| §2.2 合并异常 → `merge_aborted` 升级 | 通过 | `code-isolation.js:316-317,325`；单测 `i17-code-isolation.test.js:240-292` |
| §2.2 `branch/mergeStatus` 生命周期 `pending→merging→merged/conflict` 且经 `applyStateChange` | 通过 | `code-isolation.js:305,321,333,375-379`；单测 `deepEqual` 三段序（`i17-code-isolation.test.js:198-205`） |
| §2.2 `reprocess` 正确重投 | 部分通过（同进程通过；跨进程见 F-02） | `code-isolation.js:382-389`；`orch escalate resolve` 走新进程时 `processed` 为空 |
| §2.2 `buildMergeEscalation` 与 `buildEscalation` 同形状、`reasonCode` 限三值 | 通过 | `code-isolation.js:238-258`；实测 key 序列完全一致（见 §3 门禁记录 7），非法值回落 `merge_conflict`（见 F-06） |
| §2.3 `code` 分支返回 `<workspace>/worktrees/<roleId>` | 通过 | `doc-artifact.js:156-179`；单测 `i17-code-strategy.test.js:20-58` |
| §2.3 既有 5 分支语义不变（R-6） | 通过 | `git show 03bd672` 仅 2 个 hunk（import + 新分支）；单测 `i17-code-strategy.test.js:69-113`；`test/wp10/doc-artifact.test.js` 14/14 |
| §2.3 角色级覆盖只影响 code 角色、不误伤 worker/其它角色 | 通过（旁路风险见 F-09） | `doc-artifact.js:147-154`；`ROLES` 仅 developer 带字段（`templates/index.js:33`），单测 `i17-code-strategy.test.js:60-67,104-112` |
| §2.4 `ROLES.developer.artifact_type==='code'` 且仅改该角色 | 通过 | `templates/index.js:32-33`（diff 仅 +2 行）；`templates` 28/28 |
| §7-13 零依赖 / 31 禁词 / 零中文 | 通过 | 见 §3 门禁 5/6/7 |

---

## 2. 逐条发现表

> 级别：**阻断** = 违反 §0 硬红线；**建议** = 健壮性/契约细节/测试强度。本次 0 阻断。

| 编号 | 级别 | 文件:行 | 问题 | 证据片段 | 修复建议 |
|---|---|---|---|---|---|
| F-01 | 建议 | `src/core/code-isolation.js:342-347` | 升级提交失败被二次兜底掩蔽：`commitEscalation` 返回 `{ok:false, code:'ESCALATION_WRITE_FAILED'}` 时不带 `escalationId`，`?? escalation?.escalationId` 会退回**建单时预生成**的 id，于是未落盘的升级被当作已提交，并被写入 `processed` 供 `reprocess` 使用 | `const committed = await commitEscalation({ instanceId: ref.instanceId, escalation });`<br>`escalationId = committed?.escalationId ?? escalation?.escalationId ?? null;`<br>`if (escalationId) processed.set(escalationId, { ...ref });` | 改为 `escalationId = committed?.ok === true ? committed.escalationId : null;`；`committed.ok !== true` 时把失败向上抛（或返回 `code:'ESCALATION_WRITE_FAILED'`），让调用方按既有 `markHalted` 路径处理，绝不伪造 id |
| F-02 | 建议 | `src/core/code-isolation.js:280,347,382-389` | `reprocess` 只依赖内存 `processed`，契约注入的 `getState` 被显式丢弃（`void getState;`）。真实 CLI `orch escalate resolve` 是**新进程**，`mergeQueues`/`processed` 均为空 → `reprocess` 必返 `ESCALATION_NOT_FOUND`（`orchestrator.js:4936` 随后静默走派发分支），AC-09 的「重投合并」只在同进程内成立 | `const processed = new Map();`<br>`void getState;`<br>`const ref = processed.get(escalationId); if (!ref) return Promise.resolve({ ok: false, code: 'ESCALATION_NOT_FOUND' });` | 用 `getState()` 从 `state.escalations`+`state.nodes` 反查 `{nodeId, roleId, round, instanceId}` 重建 ref（`workspaceDir` 由调用方或 `state` 派生），`processed` 仅作同进程加速；补一条「新队列实例 + 已有 pending 升级」的重投单测 |
| F-03 | 建议 | `src/core/code-isolation.js:142-159,218-227` | §2.2 规定 `detectConflict({workspaceDir, fs})`、`abortMerge({workspaceDir, fs})`；实现改为只收 `{workspaceDir, execa}`，`detectConflict` 还硬编码 `execFileSync`（不可注入、同步阻塞事件循环），与模块其余部分的 `execa` 注入风格不一致 | `export function detectConflict({ workspaceDir } = {}) {`<br>`const stdout = execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], {...});`<br>`export async function abortMerge({ workspaceDir, execa = defaultExec } = {}) {` | 补齐 `fs` 形参（即便仅用于兼容签名），并让 `detectConflict` 接受 `execa`；或在 §2.2 明确「detectConflict 为同步实现」并把签名收敛一致 |
| F-04 | 建议 | `src/core/code-isolation.js:293,373-381` | `enqueue` 不做入参校验：`instanceId/roleId` 缺失时 `branchOf` 产出 `maestro/null/null`，并立即经 `applyStateChange` 写回调用方状态（会把脏分支名落到 `state.nodes[]`） | `const branchOf = (ref) => \`maestro/${ref.instanceId}/${ref.roleId}\`;`<br>`enqueue(ref) { const normalized = normalize(ref); applyChange({ ... mergeStatus: 'pending' });` | `normalize` 后校验 `instanceId/roleId/workspaceDir` 均非空，非法直接返回 `{ok:false, code:'MERGE_INPUT_INVALID'}` 且不投影状态 |
| F-05 | 建议 | `src/core/code-isolation.js:327-332` | 回滚失败被静默：`abortMerge` 以返回值表达失败（不抛异常），`try/catch` 捕获不到，注释「Nothing to roll back…」与实际语义不符（死防御）；且 `abortMerge` 失败时仍继续以 `conflict` 落状态并升级 | `try { await abortMerge({ workspaceDir: ref.workspaceDir, execa }); } catch { // Nothing to roll back (the merge never started) — still escalate below. }` | 改为读取返回值：`const rolled = await abortMerge(...); if (rolled.ok !== true && result.code === 'MERGE_CONFLICT')` 把回滚失败并入 `reasonDetail`（或升级 reason 仍 `merge_conflict`，detail 标注 abort 失败），让用户知道半成品合并可能残留 |
| F-06 | 建议 | `src/core/code-isolation.js:247-248` | 非法 `reasonCode` 静默降级成 `merge_conflict`，调用方拼错枚举时被掩盖（例如传 `'worktree_init_failure'` 会变成冲突） | `const allowed = ['merge_conflict','worktree_init_failed','merge_aborted'];`<br>`const code = allowed.includes(reasonCode) ? reasonCode : 'merge_conflict';` | 非法值直接抛 `TypeError`/返回 `{ok:false, code:'REASON_CODE_INVALID'}`；三值常量导出为冻结数组供 WP-4/WP-5 复用 |
| F-07 | 建议 | `src/core/code-isolation.js:69-79` | `ensureGitRepo` 在「目录里有 `.gitignore` 但无 `.git`」时用 `writeFile` 覆盖，只写 `worktrees/`，会抹掉用户既有忽略规则；`git config` 两行的退出码也未校验 | `await execa('git', ['config', 'user.email', 'maestro@local'], { cwd: workspaceDir });`<br>`await io.writeFile(ignorePath, 'worktrees/\n', 'utf8');` | 改为读-追加语义（不存在才写；存在且无 `worktrees/` 则追加），或干脆不写 `.gitignore`（worktree 目录本就不会被主工作树 add）；校验 `config` 退出码并归入 `GIT_INIT_FAILED` |
| F-08 | 建议 | `src/core/doc-artifact.js:174-175`（配合 `orchestrator.js:1698,2254,2441`） | `code` 分支在无 `context.root` 时自行 `path.join(workspaceDir,'worktrees',role)`，复制了 WP-1 的路径拼接；而 orchestrator 三处调用**都不传 `root`**，生产路径恒走这条复制分支，§2.3「经 WP-1 的 `instanceCodeWorktreeDir`」实际未生效（当前两者取值一致，故未表现为 bug） | `} else if (typeof workspaceDir === 'string' && workspaceDir.length > 0 && role !== null) {`<br>`baseDir = path.join(workspaceDir, 'worktrees', role);` | 在 orchestrator 调用处补 `root: store.root`（WP-4 负责），或让 `code` 分支只接受 `root+instanceId` 并在缺失时 `fail('WORKSPACE_MISSING')`，消除第二处路径拼接 |
| F-09 | 建议 | `src/core/doc-artifact.js:148-154` | 契约外旁路：`def.artifactType ?? context.artifactType` 允许任意调用方把非 code 角色（如 `worker`）标成 `code` 从而进 worktree，与 AC-10「非 code 角色不做 git 隔离」相悖；同时 `artifactType==='code'` 会覆盖 `review` 等节点级策略（当前无图命中，属潜在语义扩张） | `const artifactType = def?.artifactType ?? context?.artifactType ?? (roleId !== null && ROLES[roleId] ? ROLES[roleId].artifact_type : null) ?? null;`<br>`const policy = artifactType === 'code' ? 'code' : declaredPolicy;` | 只保留 `ROLES[roleId]?.artifact_type`（角色表单一事实源）；若确需节点级覆盖，限定为 `def.artifactPolicy === 'code'` 且仅在 `declared/heuristic` 下生效，不覆盖 `review` |
| F-10 | 建议 | `test/wp7/i17-code-isolation.test.js:109-152,154-206` | AC-08 单测**绕过队列**直接调 `mergeIntoIntegration`+`abortMerge`，串行单测只覆盖「两次成功合并」，缺「前一次**升级**后下一次仍等待」与「经队列的冲突→abort→`merge_conflict` 升级」两条用例（现仅由 `test/wp4/orchestrator.test.js:1713-1751` 集成层兜底） | `const mergedB = await mergeIntoIntegration({...});`<br>`const aborted = await abortMerge({ workspaceDir: ws });` | 增补：① `createMergeQueue` 先冲突升级、再入队第二条，断言第二条在前者升级完成后才 `merging` 且 `maxActive===1`；② 队列级冲突用例断言 `commitEscalation` 收到 `reasonCode==='merge_conflict'` 且回滚后双分支仍在 |

---

## 3. 门禁实跑记录（真实输出）

| # | 命令 | 真实结果 |
|---|---|---|
| 1 | `node --test test/wp7/i17-code-isolation.test.js` | `tests 8 / pass 8 / fail 0`，exit **0**（8 条：ensureGitRepo、createWorktree、AC-07、AC-08、串行、AC-13、AC-14、reprocess 未命中） |
| 2 | `node --test test/wp7/i17-code-strategy.test.js` | `tests 6 / pass 6 / fail 0`，exit **0** |
| 3 | `node --test test/wp10/doc-artifact.test.js` | `tests 14 / pass 14 / fail 0`，exit **0** |
| 4 | `node --test "test/templates/**/*.test.js"` | `tests 28 / pass 28 / fail 0`，exit **0** |
| 5 | `node --test test/wp4/orchestrator.test.js` | `tests 37 / pass 36 / fail 1`，exit **1**；唯一失败 `not ok 33 - task-loop 审核提示词给绝对路径：基址与 readReview 同源…`（`/private/var/...` vs `/var/...`，`test/wp4/orchestrator.test.js:1513`），与 `docs/iterations/iteration-7/baseline-failures.txt` 第 6 项逐字一致 → **预存在环境敏感失败，非本迭代引入**。注：首次执行因工具默认 120s 超时被杀（exit 137），加长超时重跑得上述结果；I1.7 新增 4 条 worktree 用例（#34~#37）全部 `ok` |
| 6 | `FORBID="…31 词…"; node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | `OK: 扫描 22 个文件，src/core, src/daemon 内 … 零命中`，exit **0** |
| 7 | `node -e "…Object.keys(p.dependencies).length"` | **0** |
| 8 | `buildMergeEscalation` vs `buildEscalation` 形状比对（node -e 实测） | key 序列双向一致：`escalationId,nodeId,round,reasonCode,reasonDetail,defects,state,createdAt,resolvedAt,resolution,voidedAt` → `same keys: true`；非法 `reasonCode:'bogus'` 回落 `merge_conflict` |
| 9 | `grep CJK src/core/code-isolation.js` | CJK 字符 **0** |
| 10 | `grep "if host ==" src/core/code-isolation.js src/core/doc-artifact.js` | 0 命中 |

**AC-08 回滚语义（以实跑为准）**：`i17-code-isolation::AC-08` 通过，断言 `git diff --name-only --diff-filter=U` 命中 `f.txt`、`git merge --abort` 后主工作树仍是 `AAA`、`git worktree list` 同时含 alpha/beta、`maestro/INST-002/{alpha,beta}` 两分支俱在、两侧 worktree 各自保留 `AAA`/`BBB`。e2e 侧 `orchestrator.test.js:1739-1747` 进一步断言冲突后 `maestro/INST-001/integration:calc.js` 仍为 `integration-side`（半成品合并未污染集成线）、开发侧 `mine` 未丢失。两 worktree/分支保留成立。

---

## 4. 结论

- **WP-2（`src/core/code-isolation.js`）**：通过独立评审。合并队列确为本模块独占实现（串行链 `code-isolation.js:360-370`、冲突回滚 `:327-333`、两类升级 `:325-347`、状态回写 `:305/321/333/375`），orchestrator 侧仅剩契约钩子。阻断项 0；建议 F-01~F-07（10 条中 7 条属本模块）。
- **WP-3（`src/core/doc-artifact.js` + `src/templates/index.js`）**：通过独立评审。`code` 分支为纯增量，既有 5 分支逐字未动（diff 仅 2 hunk，`doc-artifact.test.js` 14/14），角色级覆盖只命中 `developer`（`templates` 28/28，`ROLES.tester/coordinator/researcher/writer/reviewer` 均 `undefined`）。阻断项 0；建议 F-08~F-10。
- **可视为通过**：WP-2 / WP-3 均满足 §0 退出标准中与本两包相关的硬红线。建议 **F-01（升级写失败掩蔽）与 F-02（`reprocess` 跨进程失效）在 I1.8 开工前修复并补测**；F-04/F-09 建议同批收敛，其余可随代码自然演进处理。

> 说明：本次评审未对 WP-4/WP-5/WP-6 的实现质量下结论；引用的 `test/wp4/orchestrator.test.js` 用例仅作为 AC-08/AC-09 的补偿证据。
