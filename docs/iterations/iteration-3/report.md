# 阶段一 I1.3「非编码闭环（研究 → 撰写 → 审核 → 回流 → 升级）」实现报告

> 依据：`docs/iterations/iteration-3/requirement.md` **v5**（唯一验收依据；45 条 AC）
> 拆分与契约：`docs/iterations/iteration-3.md`（WP-1 ~ WP-6，文件清单互不重叠）
> 验收记录：`acceptance-product.md`（真实 DSH 面 1 条）、`acceptance-fixture.md`（夹具面 44 条）、`evidence/`（284 个文件）
> 评审记录：`review-baseline.md`、`review-v4-consistency.md`
> 环境：Windows 11 / Git Bash / Node v22.22.2 / DSH `0.2.2-rc.1`（`deepseek-account` → `deepseek-flash`）
> 完成时间：2026-11-06

## 0. 总体结论

**I1.3 达成退出标准，可以收口。**

| 判定项 | 结果 |
|---|---|
| 45 条 AC | **45 通过 / 0 不通过 / 0 阻塞**（真实宿主 1 + 夹具 44），共 **651 条核对项**全绿 |
| 全量测试 | **418 / 418 通过**（I1.1 的 216 与 I1.2 的 337 条一条未删，仅按 D-9 授权扩表） |
| 架构约束 | AC-38 七词扫描 `src/core,src/daemon` **exit 0**，16 个文件零命中（含注释） |
| 回归红线 | `single` 与 `code-loop` 的输出逐字保持 I1.1 / I1.2（AC-36 的 66 项含逐行比对） |
| 阻断级缺陷 | **0**（验收首轮 1 条 P1 + 1 条 P2 未通过，全部修复并复验） |

一句话结论：一条 `orch run --template task-loop` 能在**真实 DSH** 上把「研究 → 撰写 → 审核驳回 → 自动回流改稿 → 复审通过」跑完；三节点、四张交接包、跨轮版本化产物（`v1`/`v2` 共存）、轮次上限与升级挂起全部由核心驱动；`single` 与 `code-loop` 保持原样。

**最难的一条（AC-40 真实宿主驳回闭环）实测**：修复后**一次跑通、零重试、零人工干预**，313.6s。事件序列 `review.read(reject) seq=68 → review.rejected seq=70 → T-002 第 2 轮派发 seq=75 → review.read(pass) seq=127 → review.passed seq=128`，两版文档 sha256 不同（`dbedc0b1…` / `2131fa10…`），`escalations=[]`。

## 1. 交付物

### 1.1 产品代码（`src/` 30 个 `.js`，零第三方运行时依赖）

| 层 | 新增/修改 | 职责 |
|---|---|---|
| 图定义 | 改 `src/templates/index.js` | `GRAPHS` 增 `'task-loop'`：T-001 研究员（`fixed-workspace`）→ T-002 撰写者（`versioned-doc`）→ T-003 审核者（`review`, `judge:'review'`）；四条边（2 forward / 1 backflow `review-reject` / 1 retest）；`maxRounds {T-001:1, T-002:2, T-003:2}`；图级 `productPolicy:'doc-single'`；三角色与四段提示词 |
| 规则层 | **新增** `src/core/doc-artifact.js` | 产物名域（恰好一行 `产物：`、5 条名字规则）、`docRef()` 唯一拼接点、`writePathOf()`、`resolveNodeProducts()` 按 `artifactPolicy` 分派、`sha256Of()` 流式、`verifyPrevious()` 上一版完整性 |
| 规则层 | **新增** `src/core/review.js` | 审核校验器 11 步（missing → stale → unreadable → unparsable → schema → decision → artifact present → artifact match → 决策/缺陷一致 → 缺陷形状 → 证据可读），命中即返回，纯函数 + 注入 `fs` |
| 规则层 | 改 `src/core/verify-artifact.js` | `verifyProducts({baseDir, sha256})`：基目录可指定、`sha256` 开启时才生成该键（关闭时**不生成**，保住 I1.2 六字段形状）；I1.1 的 `extractDeclaredArtifacts` / `verifyArtifacts` 一行未动 |
| 推进层 | 改 `src/core/advance.js` | `hasEnded()` 纳入 `review(downstream)`；`classifyNodeOutcome` 读 `review.decision` 把驳回当业务失败；`buildHandoff` 携带 `artifactRefs` / `revisionRequirement`；`planAdvance` 按边取引用（§3.3 唯一事实）与提示词变量 |
| 编排核心 | 改 `src/core/orchestrator.js` | `finishArtifactNode` 分流投影（`doc-single` 只留 `ref/bytes/sha256/verifiedAt`）+ 轮次 >1 先 `verifyPrevious`；新增 `finishReviewNode`（pass→done / reject 未超限→`failed`+等待复审 / 越限或无效→`escalated` 挂起）；`openDownstreamGate` 在首帧内 `review→done` 且只落一次盘（C-09）；`claimGraph` 先建工作区再首次 `saveState`，失败 `WORKSPACE_INIT_FAILED` 且不留残骸；`snapshotOf` 新增只读 `interruptedNodeId` / `productPolicy` |
| 状态机 | 改 `src/core/escalation.js` | 升级事务在同一 CAS 内清 `reviewReason` |
| 事件总线 | 改 `src/core/event-bus.js` | `emit()` 支持可选 `ts`（`normalizeTs()`），缺省行为不变——供派发与证据核对事件复用状态时刻 |
| 持久化 | 改 `src/persistence/paths.js` | 实例工作区三路径（workspace / docs / reports） |
| 守护 | 改 `src/daemon/server.js` | `run.start` 透传终局快照（仅首派失败时存在） |
| CLI | 改 `src/cli/{render,main,labels}.js` | 限定词判定顺序、三种后缀（产物 / 审核通过 / 审核驳回·缺陷 N 条）、耗时六支（含同毫秒钳 `1s`）、`renderInterruptedNote` 优先 `interruptedNodeId`、退出码 3/4/5、`PREFLIGHT_CODES` 加 `WORKSPACE_INIT_FAILED`；`labels.js` 仍为唯一中文来源（`REASON_LABEL` 33→39，新增 `REVIEW_TEXT` 11 条 / `ARTIFACT_TEXT` 5 条） |

### 1.2 测试与夹具

| 项 | 内容 |
|---|---|
| 用例 | **418 条**（新增 81 条：`test/templates/task-loop.test.js` 15、`test/wp10/{doc-artifact,review,perf,loop-fixture}.test.js` 35+、`test/wp4` task-loop 段 9、`test/wp6/render.test.js` 9、`test/wp6/main.test.js` 3） |
| 夹具驱动 | **新增** `test/fixtures/task-loop-driver.mjs`（444 行）：只写 `.mock/` 与 `.orch/hosts/dsh.json`，**绝不改 `state.json` 造中间态**；支持 `--stop-after N --keep` 定格与 `.mock/release` 放行 |
| 场景 | **新增** 29 个（`test/fixtures/scenarios/task-loop/*.json`），覆盖主链 / 回流 / 超限 / 9 类审核无效 / 3 类产物异常 / 派发与执行失败 / 慢节点 |
| mock 扩展 | `test/fixtures/mock-acp-agent.js` 增 `--suite task-loop`（`review` 步骤可写对象或字符串） |

### 1.3 验收产物

| 文件 | 内容 |
|---|---|
| `probe/acc3-f-lib.mjs` / `acc3-f-common.mjs` / `acc3-f-run.mjs` / `acc3-f-final.mjs` | 验收脚手架：单 AC 执行、批次运行（a~e）、证据落盘、由 `results.jsonl` + `parts/` 重建报告 |
| `probe/acc3-cases/ac01~ac45.mjs` | 45 条 AC 用例（AC-40 为**证据机检型**：只读真机证据、不启进程） |
| `probe/acc3-f-results.jsonl` / `acc3-f-summary.json` | 机器可读判定（45 条 + 651 条核对项） |
| `docs/iterations/iteration-3/evidence/` | **284 个文件**：每条 AC 的 `state.json` / `events.jsonl` / `meta.json` / `output.json` / `status.txt`，中间态另存 `state.live.json`；AC-40 另有 45 个真机证据 |
| `acceptance-fixture.md` / `acceptance-product.md` | 44 条夹具面 + 1 条真实面逐条核对表 |

## 2. 45 条 AC 逐条判定

| AC | 主题 | 核对项 | 判定 |
|---|---|---|---|
| AC-01 | 发起后三节点按序建好 | 15 | 通过 |
| AC-02 | 撰写者收到研究笔记与写作路径 | 13 | 通过 |
| AC-03 | 审核者收到本轮文档引用 | 11 | 通过 |
| AC-04 | 两种限定词与会话等待行 | 12 | 通过 |
| AC-05 | 下游接受后上游才变已完成 | 13 | 通过 |
| AC-06 | 审核通过后闭环完成 | 12 | 通过 |
| AC-07 | 第 1 轮驳回 → 自动回流 | 11 | 通过 |
| AC-08 | 回流带齐缺陷/证据/修改要求/上一版引用 | 15 | 通过 |
| AC-09 | 第 2 轮通过 → 完成，两版共存 | 13 | 通过 |
| AC-10 | 第 2 轮驳回 → 停止回流、升级挂起 | 18 | 通过 |
| AC-11 | 挂起后不再自动推进 | 9 | 通过 |
| AC-12 | 重启后仍挂起，轮次与升级都在 | 13 | 通过 |
| AC-13 | 审核文件缺失 → 升级，不回流 | 15 | 通过 |
| AC-14 | 审核文件不是本轮新写 | 6 | 通过 |
| AC-15 | 审核文件不可解析 / 结论非法 | 6 | 通过 |
| AC-16 | 审核未引用或引用了别的文档 | 5 | 通过 |
| AC-17 | 结论与缺陷清单自相矛盾 | 5 | 通过 |
| AC-18 | 缺陷证据不可解析 | 4 | 通过 |
| AC-19 | 撰写产物缺失 / 为空 / 非本轮 | 7 | 通过 |
| AC-20 | 上一版被改写或删除 | 9 | 通过 |
| AC-21 | 研究笔记缺失 / 为空 / 非本轮 | 6 | 通过 |
| AC-22 | 发起前拦截空任务与缺产物行 | 11 | 通过 |
| AC-23 | 发起前拦截非法产物名 | 16 | 通过 |
| AC-24 | 未知模板仍被拒绝 | 3 | 通过 |
| AC-25 | 同目录不能同时跑两个通用闭环 | 7 | 通过 |
| AC-26 | 编码闭环与通用闭环同目录互斥 | 9 | 通过 |
| AC-27 | 已挂起实例不能再次发起 | 7 | 通过 |
| AC-28 | 运行中取消 5 秒内收敛 | 15 | 通过（实测 **103ms**） |
| AC-29 | 已升级节点也能被取消 | 10 | 通过 |
| AC-30 | 升级写不进去时不假装挂起 | 15 | 通过（`MAESTRO_FAULT=state_write:escalation`，exit 5） |
| AC-31 | 审核无效时不留下回流包、不再派发 | 10 | 通过 |
| AC-32 | 审核以文件为准，不以对话为准 | 11 | 通过 |
| AC-33 | 每次派发对应一张交接包，编号连续 | 11 | 通过 |
| AC-34 | accepted 与 consumed 的时机 | 8 | 通过 |
| AC-35 | 阶段耗时区间不重叠 | 20 | 通过（连跑 3 次稳定 20/20） |
| AC-36 | 编码闭环与单节点输出不回归 | 66 | 通过 |
| AC-37 | I1.1 旧格式实例只读可查 | 24 | 通过 |
| AC-38 | 两条闭环共用同一引擎 | 20 | 通过（7 词扫描 exit 0） |
| AC-39 | 事件记录覆盖审核与下游门控 | 26 | 通过 |
| AC-40 | 真实宿主「驳回 → 改稿 → 通过」 | 40 | 通过（313.6s，零重试） |
| AC-41 | 同一节点被重复投递时被拒 | 13 | 通过 |
| AC-42 | 派发失败 → 升级挂起 | 15 | 通过 |
| AC-43 | 回合执行失败 → 升级挂起，不回流 | 17 | 通过 |
| AC-44 | 目录不可写 / 工作区建不出来 → 退出码 3 | 15 | 通过 |
| AC-45 | 停「待校验（等待下游）」：可取消、重启记中断 | 44 | 通过 |

## 3. 验收中发现并修复的缺陷

验收阶段共定位 **6 个缺陷**（1 条让 AC-39 判不通过、1 条让 AC-35 判不通过、其余为验收中顺带暴露）。

| # | 级别 | 现象 | 根因 | 修复 |
|---|---|---|---|---|
| D-1 | **P1** | 真实宿主上审核者把 `out/review.json` 写进**实例工作区**，3 次里 2 次 `review_missing` 挂起 exit 4 | 提示词给相对路径 `out/review.json`，同一提示词里又给了「工作区：<绝对路径>」，模型按工作区解析；核心按任务目录读。**提示词的真正产出点在 `advance.js` 的 `planAdvance`**（不在 orchestrator 的兜底分支） | `150c7c6`：组装时传 `path.join(state.cwd, REVIEW_PATH)`；模板字符串未改（保住逐字断言）；`readReview` 返回值仍是相对值（事件 detail 不落绝对路径） |
| D-2 | P2 | `T-002.startedAt` 比第 1 轮 `node.dispatch` 的 `ts` 早 4~8ms，AC-35 的严格等式不成立 | `at = iso()` 先写 `startedAt`，`saveState` 落盘后才 `emit`，总线再取一次时间 | `27c6094`：`event-bus.emit()` 支持可选 `ts`，派发事件复用 `at`（只改这一处，其它事件保留真实间隔以免破坏 AC-34） |
| D-3 | **P1** | AC-39 输出里 5 个 `task-loop` 事件泄漏英文 reason，且重复追加「原因」段（`[#68] … review.rejected  原因 review.rejected`） | `legacyMiddle()` 拿不到 from/to 中文标签时回落 `event.reason`；`renderEventLine` 对非 `single` 无条件追加原因段 | `2ec56f4`：新增 `noteMiddle()` 取 `REASON_LABEL`，`task-loop` 的 `result='note'` 行不再追加原因段；**仅对 `task-loop` 分流**，`code-loop`/`single` 逐字不变 |
| D-4 | P3 | `review.evidence_verified` 的 `ts` 与 `node.endedAt` 偶发差 1ms（AC-35 第 12 项 5 连跑偶发 19/20） | 与 D-2 同源 | `9e02c2d`：该事件复用 `node.endedAt`；AC-35 连跑 3 次稳定 20/20 |
| D-5 | P2 | 同目录并发时，若占用方停在**首派尚未返回**，第二次 `orch run` 等 **63.3s** 后输出「未知错误：IPC_TIMEOUT」而非 AC-25 要求的文案 | `claimRun` 前的检查只覆盖「显式 instanceId 且 `activeRuns` 命中」；`withLock(dirKey)` 把首派一起罩在锁内，第二次是在**等锁**而非读状态 | `6ed3a1f`：锁前加「目录占用快检」（复用 `findDirBusy` 口径，锁内检查保留做双检）；实测 **101ms** 返回 `该目录已有未结束的实例 INST-001，本次未发起` |
| D-6 | P3 | AC-36 把测试条数硬编码成 `416`，新增一条测试即判红（过拟合，非需求要求） | 验收脚本断言写法 | `9e02c2d`：改为 `fail=0 && pass=tests && tests>=416`（仍禁止减少，不再禁止新增） |

**实现阶段另修 2 个**（`baba11f`）：首派失败时 `run.start` 早返回丢 `instanceId`，CLI 打成「实例 ? · 运行中」并退出码 1（AC-42 要求挂起三行 + 退出码 4）；性能用例无预热导致全量并发下 p95 抖动（加 3 轮预热，50ms 预算未放宽）。

## 4. 门禁与复现

```bash
# 全量测试（Node 22 下必须用 glob；node --test test/ 会 MODULE_NOT_FOUND）
node --test "test/**/*.test.js"                       # 418 / 418

# 架构约束（AC-38）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon \
  --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者   # exit 0

# 45 条 AC 验收（批次 a~e；e 为 AC-40 证据机检，不启进程）
node probe/acc3-f-run.mjs --batch a
node probe/acc3-f-run.mjs --batch b
node probe/acc3-f-run.mjs --batch c
node probe/acc3-f-run.mjs --batch d
node probe/acc3-f-run.mjs --batch e
node probe/acc3-f-final.mjs                            # 重建 acceptance-fixture.md
```

三条主链端到端（`%TEMP%` 下独立目录，**绝不要放仓库内**——DSH 会触发 pwsh 权限修复，单 turn 从 5s 膨胀到 24.8s）：

```bash
node test/fixtures/task-loop-driver.mjs --root <tmp>/dp --scenario doc-pass \
  --cwd <tmp>/dp/demo --task "写一篇发布说明。产物：release-notes.md"        # exit 0
node test/fixtures/task-loop-driver.mjs --root <tmp>/bf --scenario doc-backflow-once ...  # exit 0
node test/fixtures/task-loop-driver.mjs --root <tmp>/rt --scenario doc-reject-twice ...   # exit 4
```

## 5. 遗留问题与边界（不影响验收结论）

1. **AC-40 的「两版共存」是证据副本层机检**：真机运行的临时目录已按纪律删除，现以 `AC-40b.v1.md` / `v2.md` 的字节 + `state.nodes[T-002].artifactHistory` 两条记录 + 三方 sha256 一致互证。
2. **模型名两份 meta 不一致**：修复后记 `deepseek-flash`，修复前记 `deepseek-v4-flash`（provider 同为 `deepseek-account`）。属记录口径差异，未追溯。
3. **`AC-40b.final.state.json` 内仍含绝对路径**（`cwd`、`sessions[].artifactRef`）：这是 I1.2 既有落盘形状（M-3 / D-6 已登记），NFR-08 的约束对象是**产物投影**（`artifactRefs` 已无绝对路径），本迭代不改。
4. **`review.read.detail.path` 仍是相对值 `out/review.json`**（提示词给的是绝对路径）：两者不冲突——读的是任务目录下的固定相对位置，D-1 只改了「告诉模型写哪里」，没改「核心从哪里读」。
5. **AC-36 的 66 项含「全量测试全绿」**：这是回归触发门，不是需求 Then；条数断言已改为下限口径。并发跑全量时 NFR-02 的 p95 曾抖动（415/416），独占运行稳定 418/418——属测量噪声，已记入 AC-36 备注。
6. **串行连跑夹具的已知限制**：同进程跑 20+ 个场景后 mock 的 `session/new` 会全部失败（累计资源耗尽）。验收脚手架已每 10 个回收核心；人工复跑请分批。

## 6. 与 I1.1 / I1.2 的关系

| 红线 | 结论 |
|---|---|
| `single` 输出逐字不变 | 通过（AC-36 用 `single` 的 run/status 全段与附录 A-1/A-2 的 single 列逐行比对，另断言无「模板」/无轮次/无方向/无 seq/无升级块） |
| `code-loop` 输出逐字不变 | 通过（AC-36 的 13 行状态块逐字比对 A-3/A-4，含 `失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条` 与 `升级 —`） |
| I1.1 旧格式实例只读可查 | 通过（AC-37：status 7 行、`cancel` / `run --instance` 均回「该实例为旧格式，本版本只支持查看」，`state.json` 与 `events.jsonl` 字节不变） |
| 共用引擎 | 通过（AC-38：`driveGraph → finishGraphNode → advance → advanceLocked → planAdvance` 链唯一；图只从 `src/templates/index.js` 注入；`review.js` 零角色/模板名） |
