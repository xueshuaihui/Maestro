# Maestro V3.2 实现任务拆分规划（双机并行版）

> 生成时间：2026-11-28
> 版本：v2（同日按真实代码审核修订；修订记录见 §0.8）
> 版本：v3（纠正需求权威层级：规格正文为准，原型仅为交互与演示参考；见 §0.9）
> 版本：v4（补充双机运行时认领台账与主 Agent / 干净开发子 Agent / 干净审核 Agent 质量闭环；见 §0.11）
> 原型提交：`0551b9e`（已合入本地 `main`）
> 任务基线：**本规划合入后的 `main` HEAD**（由 T00 在开工前公布并推送到 `origin/main`）
> **需求权威（唯一）**：`docs/index.md`（V3.2 正文，L80–L744）与 `docs/maestro_v3_2_page_spec.md`（§1–§17）。业务对象、状态机、异常边界、验收标准一律以这两份规格正文为准。
> **辅助参考（非需求来源）**：`docs/maestro_v3_2_prototype.html`（1167 行）——只用于理解页面布局、交互形态与演示流程；原型中的字段、状态、按钮、错误码**不构成需求**，与规格冲突时以规格为准（见 §0.9）。
> 代码现状：引擎底座完整；V3.2 的 Work Item / Assignment / 两层 Session / Delivery 在 `src/` 中**完全没有**；`src/studio/` 的 Team / Employee 语义与 V3.2 冲突（见 §1.1）。

---

## 0. 使用前必读：执行协议（所有任务、两台机器统一遵守）

### 0.1 本次需求范围与非目标

**目标**：把规格正文（`docs/index.md` 与 `docs/maestro_v3_2_page_spec.md` §1–§17）定义的需求实现为真实产品能力——真实 CLI 扫描、真实 Daemon API、真实 Task Assignment、真实 ACP 会话、真实恢复与审计，覆盖 P00–P16、§3–§9、§13 状态机、§14 异常边界、V32-01～V32-17 全部验收用例。原型仅作交互形态参考，**不定义需求**（见 §0.9）。

**非目标**（不要自作主张扩大范围）：

1. 不重写既有引擎（`src/core/**`、`src/daemon/server.js`、`src/persistence/**`、`src/adapter/**` 主体、`test/wp1`～`test/wp16`）。**仅两处狭窄例外**：T15 在 `test/wp14/e2e.test.js` 的 AC-39 写路径白名单按 `/v32/` 前缀放行；T16 把三个 CDP 脚本的「恰好 5 段」断言改为「原 5 段 + 新增 4 段」。除此之外不得改动 `test/wp1`～`test/wp16` 的断言。
2. 不改动 `docs/index.md`、`docs/maestro_v3_2_page_spec.md`、`docs/maestro_v3_2_prototype.html`——前两者是冻结的需求权威，原型是冻结的交互参考（非需求来源）。
3. 不在本次把 `src/studio/**` v2 语义就地改造成 V3.2；采用 §1.1 的隔离新域方案。
4. 不引入第三方 npm 依赖（`package.json` 必须保持 `dependencies: {}`）。
5. 不做 Windows 签名、Release 发布、多语言；只交付功能实现与验证证据。

### 0.2 开工前置条件（主线负责人执行，一次即可）

本地 `main` 与 `origin/main` 在并行工作中可能不一致（原型提交 `0551b9e` 曾领先 2 个提交）。**不要依据「领先几个提交」判断基线**，两台机器只认 T00 公布的那一个 sha：

```bash
cd /Users/xuesh/www/Maestro
mkdir -p /tmp/v32t                      # 两台机器各自执行：TMPDIR 目录不在 git 内，不存在会让 mkdtempSync ENOENT
git fetch origin
git push origin main                    # 由 T00 在恢复门禁基线并提交后执行（见 T00-R3）
git rev-parse HEAD                      # T00 公布它作为唯一 baseSha
```

> **每台机器开工前都要先 `mkdir -p /tmp/v32t`**。实测该目录默认不存在，`TMPDIR=/tmp/v32t` 会让 `fs.mkdtempSync` 抛 `ENOENT`，验证命令在任何用例开始前就崩。

> 未完成这一步前，**禁止**任何任务开始实现。每个任务的报告必须记录两个 sha：`baseSha`（T00 公布，永不改变，用于差集基线）与 `branchPointSha`（实际建分支点）；当 `origin/main` 已被对方推进时，先在功能分支上 `git rebase origin/main` 并复跑验证，再继续实现，禁止各自修改 `baseSha` 的定义。

### 0.3 每个任务的固定实现流程（不得跳步）

| 步骤 | 动作 | 硬性要求 |
|---|---|---|
| 1 | **认领** + 建分支 | **先按 §0.11 读共享台账、判定任务状态并原子认领；未认领禁止开工**；认领成功后才 `git fetch origin` → `git switch main` → `git pull --ff-only origin main` → `git switch -c feature/v32-TXX-<slug> origin/main`；确认 `git rev-parse HEAD` 等于 §0.2 公布的基线（或已合入的前序任务 sha） |
| 2 | 读规格 | 由主 Agent 把本任务 REQ 标注的规格章节（`index.md` / `page_spec.md` 的 §/P/V32 编号）封进**干净子 Agent** 的 prompt，逐条转成实现清单；**再**看原型对应交互（附录 A）理解页面形态。REQ 与原型演示不一致时以规格为准，并在报告记录差异 |
| 3 | 实现 | **只由新创建的干净开发子 Agent 执行**（§0.11.5），主 Agent 不直接写产品代码；只改「文件所有权」列出的路径；共享文件按 §1.2 归唯一任务所有 |
| 4 | 自测 | 开发子 Agent 写任务专属单测（文件名见任务详情），运行「验证清单」的命令；**不得删断言/降阈值** |
| 5 | 失败循环 | 按 §0.5 分类、修复、复跑，直到本任务全部验证项通过 |
| 5b | **独立审核循环** | 开发子 Agent 报完成后，主 Agent **另建一个干净审核 Agent**（不继承开发上下文），按 §0.11.5–§0.11.6 审核；有阻塞性问题就派修复、再审核，循环到审核结论为「无阻塞项 / PASS」，否则不得提交 |
| 6 | 报告 + 提交 | 审核 PASS 后才写 `docs/v32/reports/TXX.md`（模板见 §0.6），再 `git add <仅本任务文件 + 报告 + 自己的认领台账文件>` → `git commit -m "feat(v32): TXX <标题>"`；不 `--amend` 已合入提交 |
| 7 | 合入 main | `git fetch origin` → `git rebase origin/main` → **更新报告 `headSha` 并 fixup/ Amend 到本任务提交（仅限未合入的 feature 提交）** → 复跑验证 → `git switch main && git merge --ff-only feature/v32-TXX-<slug>` → `git push origin main` |
| 8 | push 竞争恢复 | 若 push 被对方抢先导致非 ff：`git fetch origin && git switch main && git reset --hard origin/main && git merge --ff-only feature/v32-TXX-<slug> && git push origin main`；`reset --hard` 仅限本地 main 且已确认功能提交保存在 feature 分支；禁止 force |
| 9 | 合入后核验 | 在 main 上 `git log --oneline -1` 确认是自己的合入；报告中的 `headSha` 应与该提交一致，只读核验即可，不再改报告 |

**禁止**：在 `main` 上直接改代码；跨任务改别人的文件；把未验证的代码合入；用 `git push --force`；把验证失败当 flake 上报而不做独占复跑。

### 0.4 双机并行与冲突避免

- 机器 A、机器 B 的**运行时认领状态以 §0.11 的共享台账为唯一真相**，§3.1 排程表只是静态建议；同一波次内两机文件集合**互斥**（见 §1.2）。
- 每个任务有**独占文件所有权**；若实现中发现必须改他人文件，停下来在报告中写 `BLOCKED`，由主线负责人裁决，不自行越界。
- 两台机器都必须走同一套「读台账 → 认领 → 干净开发子 Agent → 干净审核 Agent → 循环到无阻塞项 → 提交合入 → 更新台账」流程（§0.11）；**不允许任一机器跳过认领或审核**。
- 同步点（§3.2）：每完成一个波次，两机都 `git fetch`，确认 main 已包含对方任务；跨模块的集成断言在同步点补，不提前写死对方尚未实现的行为。
- 所有任务以 §1.3 契约为准并行开发；**任何任务不得自行追加** `src/v32/contracts.js`（T01 独占）。契约字段不够用时统一按 §5.3 写 `BLOCKED`，由主线负责人裁决；禁止各自加私有字段。

### 0.5 失败循环与差集纪律（验证不通过时照此执行）

1. **先分类**：① 契约不符（本任务 bug）；② 断言写法问题；③ 负载型 flake；④ 前序任务未合入导致的环境缺失。
2. **flake 证伪**：使用 `NODE_ENV=test TMPDIR=/tmp/v32t node --test --test-concurrency=1 <文件>` 独占复跑 2 次；两次都绿才登记 flake，并在报告写清原始失败帧。
3. **差集判定（唯一机器口径）**：`scripts/desktop/gate.mjs:206` 按**用例标题**做差集（`tap.notOk.filter(name => !baseline.list.includes(name))`），全量回归照此判定「新增红 = 0」，不是硬写 `fail === 0`。基线对照 `git worktree add /tmp/v32base origin/main` 出来的树，**不是**本分支合入前的旧帧；该 worktree 基线也用标题集合。当前 TAP 输出无结构化 `failureType`，**不得**按 `failureType` 变化判定；同名失败原因变化只做人工复核项，须保存原始 TAP 到 `docs/v32/reports/raw/TXX/` 并在报告写明，不能作为机器判定条件。flake 复跑与门禁 `confirmFlakes` 的参数差异（是否带 `--test-concurrency=1`）在报告中说明，以独占复跑结果为裁决依据。
4. **不得**：改冻结用例标题；把 `deepEqual` 放宽为子集；删除失败用例；新增测试时硬编码测试条数（用 `tests >= 基线 && pass === tests`）。
5. 修复后从步骤 4 重跑；循环直到本任务「验证清单」全绿，才进入提交与合入。

### 0.6 证据与报告规范

每任务写 `docs/v32/reports/TXX.md`，模板：

```markdown
# TXX <标题> 完成报告
- baseSha: <T00 公布的唯一 sha，永不改变>
- branchPointSha: <实际建分支点；落后 origin/main 时先 rebase 并记录新的 branchPointSha>
- headSha: <rebase 后、合入前的本任务提交 sha>
- 机器 / 任务窗口: A | B
- 认领记录: claimedAt=<ISO 时间> / branch=<分支名> / 台账=<claims/machine-X.json>（§0.11）
- 需求逐条结论: TXX-R1 PASS / TXX-R2 PASS / ...（FAIL 需写原因与修复轮次）
- 审核循环: 共 N 轮；每轮 verdict=<PASS|FAIL> + 阻塞项数；FAIL 项逐条写修复方式
- 验证命令与结果: 命令原文 + 关键摘要行 + 失败集合差集结论
- 证据分级: 已实测（真实宿主） / mock 实测 / 阻塞（三选一，附可复核原始帧路径）
- 已知偏差 / 未覆盖: 无则写「无」
- 合入后 main sha: <sha>
```

**证据落盘红线**：测试默认写 `%TEMP%` / `TMPDIR=/tmp/v32t`；**不得**写 `docs/iterations/**/evidence/**`（历史教训：会改写其它迭代证据）。原始帧放 `docs/v32/reports/raw/TXX/`，且 `.gitattributes` 不对其做空白 strip。

### 0.7 全局技术红线（每条任务都要遵守）

0. **需求权威**：业务对象、状态枚举、迁移、异常边界、验收标准只认 `docs/index.md` 与 `docs/maestro_v3_2_page_spec.md` 的正文字面；原型是演示用本地模拟数据（`index.md` §15 L707 / `page_spec.md` §15 L780），**不得**从原型反推字段或状态。任何 REQ 若声称「与规格一致」，必须能在规格正文找到对应条文；找不到就是实现约定，须显式标注。
1. V3.2 领域状态写入**唯一入口**是 `store.transit()`；引擎实例状态仍只走 `orchestrator.transit()`（`src/core/orchestrator.js:947`），严禁直接 `store.save` 改引擎状态。
2. 事件**先落盘再广播**；事件 `ts` 与状态变更同一时刻；事件带 `prevHash/hash` 哈希链。
3. `Prepared` 不建任何 Session；`Locked` 才开始创建/唤醒会话；人工节点永不建 Session、不选 CLI。
4. 恢复策略 A 失败时保持 `interrupted` 并写审计，**禁止静默降级**为策略 B。
5. `src/core/**`、`src/daemon/**`、`desktop/ui/**` 零 CJK 字面量（含注释、全角标点）；文案走 `ctx.t('V32_...')` / `ctx.st(...)`，且键必须真的被 `GET /ui/labels` 下发。macOS 上 `grep -P` 不可用，自查用 `python3 -c` 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]`。
6. 图/角色字面量只能出现在 `src/templates/**`；V3.2 的角色/节点数据来自 `src/v32/contracts.js` 的枚举与 API，**不得**在 core/daemon 写死岗位名。
7. 测试环境变量：`NODE_ENV=test`（`/__test__/*` 接缝按它注册），`TMPDIR` 用短路径（POSIX `sun_path` 104 字节上限）。
8. 全量命令：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"`（引号必须保留；`npm test` 会 MODULE_NOT_FOUND）。
9. 门禁：`node scripts/desktop/gate.mjs`；基线 1157 条、9 条允许失败、测试数只增不减、`dependencies={}`、31 词纯净双扫、版本三处对齐。

### 0.8 本次审核修订记录（先看这里，再执行任务）

审核方式：对照真实源码逐项验证，而不是只看文档结构。以下问题已在本文修订；执行时以修订后的要求为准。

| # | 严重度 | 审核发现（grounded） | 本文修订 |
|---|---|---|---|
| 1 | 阻塞 | `docs/iterations` 已被删除；`scripts/desktop/gate.mjs:24,90` 全量模式会 `readFileSync` 缺失的 `iteration-7/baseline-failures.txt` 直接抛错。实测 `gate.mjs --skip-tests` 通过，但全量门禁不可用。 | T00-R4 从 `7b71cd4` 恢复两份基线文件；T18 先验证门禁可跑 |
| 2 | 阻塞 | `createRoutes` 要求 `orchestrator.startRun`（`src/daemon/http/routes.js:368`）；`http/server.js:263-284` 对路由工厂异常是静默 catch，V32 路由构造期读盘/抛错会让整个 REST 退化 503。 | T15 改为请求期懒初始化 store；构造期零 IO；明确挂载点 |
| 3 | 阻塞 | `src/adapter/factory.js` 只导出 `createAdapterFactory`，`create()` 内部总是 `newSession`，**不能恢复原 Host Session**；`buildAdapter` 是未导出内部函数。 | T10 改为 `createAdapterFactory` 建新会话；唤醒走 `createStdioTransport + createAcpClient + loadSession`；新增 host profile |
| 4 | 阻塞 | 现有桌面页面 `render(ctx)` 返回 DOM 节点（`desktop/ui/shell/pages.js` 文件头），不是 HTML 字符串；`buildShellContext`（`app.js:2950`）没有 `api/nav/toast/modal/refresh`。 | 重写 §1.3.3 页面契约；T16 增加 `ctx.v32` 与集中 loader |
| 5 | 高 | `test/wp13/labels-desktop.test.js:68,495,776` 是**精确键集合**断言；新增 `V32_*` 键必须同时改该测试的清单与值表，否则必红。 | 把该测试加入 T16 独占所有权 |
| 6 | 高 | 现有 `SECTIONS` 只有 5 组（`desktop/ui/shell/nav.js:22`），规格要求 9 组；直接扩展会撞冻结文案/壳测试。 | T16 明确 9 组扩展、同步测试、保留历史 view ID |
| 7 | 高 | 并发创建资产/需求时若用「数组长度 + 1」会重号（原型已踩过 ID 跳号/重复）。T01 未定义分配器。 | T01 增加 `nextId(kind)`，只在 `transit` 内原子分配 |
| 8 | 高 | 只列了状态枚举，没有迁移表；各任务会各写一套迁移判断。 | T01 增加 `TRANSITIONS` + `canTransition/assertTransition` |
| 9 | 高 | `workflowSnapshot/teamSnapshot` 形状未定义；若存引用，资产改版会污染旧 Work Item。 | T01 定义 `snapshotOf` 深拷贝结构与 ephemeral ID |
| 10 | 中 | `ready_for_acceptance` 在 T11/T13 重复赋值；`POST /work-items/:id/deliver` 同时出现在 T07/T14 路由表。 | 统一归 T11 / T14，删除重复入口 |
| 11 | 中 | CLI 的认证状态/健康在现有探测层不一定可得；`fingerprint` 未定义，Assignment 无法固定执行环境。 | T02 增加 `unknown` 语义与 fingerprint 计算规则 |
| 12 | 中 | 原流程 step 7 合入 main 后 step 8 才写报告，等于在 main 直接提交。 | 报告随功能分支提交，再合入 |
| 13 | 中 | 部分任务验证命令缺 `NODE_ENV=test`/短 `TMPDIR`，会假红或 socket 失败。 | 统一 §1.4 命令模板 |
| 14 | 中 | 预检若把「没有可用 CLI」当成创建失败，会与 V32-08「创建时不分配 CLI」混淆。 | T07 明确：预检只查能力覆盖并给错误码，不创建 Assignment |

### 0.9 需求权威层级（v3 纠正，先看这条再执行任务）

**起因**：v2 版把 HTML 原型当作需求基准，导致从原型演示反推出规格正文没有的状态、字段与接口。原型定位见 `index.md` §15 L683–L707 与 `page_spec.md` §15 L756–L780：它用本地模拟数据演示状态变化，**不真实扫描 CLI、不连 Daemon、不启动 Agent、不调用 ACP**。规格正文没有任何「原型冲突时以谁为准」的条款，因为原型本就不是规则来源。

**权威顺序**（自上而下，下层不得覆盖上层）：

| 层级 | 来源 | 用途 |
|---|---|---|
| 1（权威） | `docs/index.md` V3.2 正文 + `docs/maestro_v3_2_page_spec.md` §1–§17 | 对象与隔离规则、状态枚举与迁移、异常边界、页面职责、17 条验收用例——逐字实现 |
| 2（设计约束） | 本规划 §1 架构决策、§0.7 全局红线、既有引擎底座事实 | 在层级 1 之下细化实现方式（新增 `src/v32/` 域、复用 adapter、CAS 存储等） |
| 3（参考） | `docs/maestro_v3_2_prototype.html` | 页面布局、交互形态、演示流程；**不产生 REQ、不定义状态/字段/错误码** |

**冲突裁决**：层级 1 与层级 3 不一致时，一律以层级 1 为准；实现者不得为「和原型一致」而增加规格没有的状态或字段。确需在报告中说明的，写「原型演示 X，规格 §Y 规定 Z，按规格实现 Z」。

**v3 已从原型纠正回规格的项**（执行时按纠正后的口径，不要再按原型）：

| 项 | 原型演示 | 规格正文 | 本规划改为 |
|---|---|---|---|
| Node Task 状态 | `waiting_queue`、`human_waiting` | §13.4 仅 12 态：`waiting_dependency/ready/assignment_prepared/preflight/creating_session/running/succeeded` + `interrupted/blocked/failed/cancelled/skipped` | `TASK_STATUS` 与迁移表删除这两态；排队用调度标记（§6.3），人工等待用 Work Item `waiting_human`（§13.1） |
| Assignment 状态 | `cancelled` 迁移 | §13.5 `draft→prepared→preflight→locked→released` 或 `failed`，无 `cancelled` | 迁移表删除 `cancelled` 边 |
| 人工审批方式 | 会签/默认动作/升级 | §4.3 只要求审批人/条件，不建会话不分 CLI；§14 无「升级」异常 | T13 删除会签/默认动作/升级，驳回按 §14-3 |
| 交付记录字段 | 固定 7 字段模板 + 缺项报错 | §16 V32-17 只要求产物/测试/风险/验收可追溯 | `deliveryRecord` 标为实现载体，断言可追溯链而非固定模板 |
| 队列 API | `POST .../queue` | §6.3 只要求 Scheduler 排队，未定义公开 API | 标为实现约定，不作为规格验收项 |
| CLI 探测细节 | 健康四态、fingerprint 算法 | §7.1 只列 8 项信息与「健康/认证/恢复能力」语义 | 标为实现约定，不作为规格符合性断言 |

**仍属实现约定（规格未规定、规划需要、可自由调整）**：错误码全集、事件类型全集、审计类型全集、哈希链格式、`nextId` 算法、路由具体路径、零 CJK/深链兼容/门禁基线数字。这些写在 §1 是为了双机并行不冲突，**不是规格符合性断言**；T18 汇总时不得把它们写成「规格要求」。

---

### 0.10 第二轮审核修订记录（规格覆盖 + 双机可执行性）

第一轮（§0.8）修的是「能不能开工」，本轮修的是「开工后会不会走偏或卡死」。两路只读审核分别以规格正文、真实源码为依据，发现均经手工复核后落为下列要求：

| 类别 | grounded 发现 | 本文修订 |
|---|---|---|
| 阻塞 | `/tmp/v32t` 默认不存在，`TMPDIR=/tmp/v32t` 使 `mkdtempSync` 抛 `ENOENT`，全部验证命令在任何用例前崩 | §0.2 前置 `mkdir -p /tmp/v32t`（两台机器各自执行） |
| 阻塞 | T00 原顺序先公布 baseSha、后提交门禁基线，公布的 sha 不含修复 | T00-R1～R4 重排：先恢复并提交基线 → 推送 → 再公布 baseSha |
| 阻塞 | `test/wp14/e2e.test.js:275-291` AC-39 写路径白名单不含 `/v32/`，T15 挂载后全量必新增红 | T15 独占该测试文件一处白名单扩展；§0.1 非目标列明此狭窄例外 |
| 阻塞 | `verify-nav.mjs:152` / `verify-scenarios.mjs:147` / `verify-desktop-boot.mjs:155` 写死「恰好 5 段」，9 组导航后必失败 | T16 独占这三个脚本，断言改为「原 5 段不变 + 新增 4 段可进入」 |
| 重要 | `gate.mjs:206` 按用例标题差集，仓库无 `failureType` 产出；§0.5 却要求按 failureType 判定 | §0.5 统一为标题差集唯一机器口径，failureType 降为人工复核并保存原始 TAP |
| 重要 | `node --test "test/wp21/v32-*.test.js"` 空匹配时 0 测试 exit 0，同步点会假绿 | 所有 glob 命令强制 `tests >= 下限 && fail === 0` |
| 重要 | `contracts.js` 同时写着「自行追加」与「BLOCKED」，两台机器会各自改同一文件 | 删除自助追加，统一走 §5.3 BLOCKED |
| 重要 | `src/v32/index.js` 若预留指向未创建模块的 `export *`，W0 即 `ERR_MODULE_NOT_FOUND` | T01-R8 写死：只导出已存在模块，跨任务一律相对路径 import |
| 重要 | `advanceRun` 无签名、T09→T10 无事件契约，T09 无法独立验证 | T11-R10 固定签名与返回；T09 只写 `assignment.locked` 事件，会话创建移到 W3 联调 |
| 重要 | T12 标题写 W4、排程表写 W3b；T07 对 Run 创建时机前后矛盾 | 统一 T12=W3b；T07-R6 改为激活 R1 已建的 Run |
| 重要 | 文案键另建 `V32_LABEL` 会撞 `labels-desktop:776` 与 `labels-drill:367-372` 的精确计数 | T16-R3 明确只向 `DESKTOP_V2_LABEL` 追加；修正总数公式口径 |
| 重要 | `desktop/ui/index.html` 无 owner，`v32.css` 写了也不加载 | T16 独占 index.html 并加 `<link>` |
| 重要 | `shell/index.js:62-72` 吞掉 render 异常回退空态，「渲染非空」会假绿 | T16-R8 改断言 `[data-view]` 正面标记 + 空态节点不存在；CDP 脚本捕获 console error |
| 重要 | 大量 UI 任务的 CDP 检查无可执行命令/证据路径 | 新增 T16-R11 独占 `scripts/verify-v32-ui.mjs`，截图落 `docs/v32/reports/raw/T16/` |
| 重要 | T01「夹具被 ≥2 个后续任务引用」在 W0 不可能满足；`--skip-tests` 不能证明全量门禁可跑 | T01 完成定义改为夹具自校验；T00 加只读探针，全量门禁在 W0 同步点复验 |
| 口径 | `index.md` §4 是 10 项（输入/输出合一），规划写 11 项；§5 子编号整体后移 | 统一按 `index.md`：10 项字段、§5 正文 14 字段 / §5.1 四组合 / §5.2 五步向导 |
| 口径 | Task Assignment 未进 §1.3.1 对象表，隔离规则无 validate 落点 | 补契约行；T09 验证加「Employee/Team 快照逐字不变」反向断言 |
| 口径 | 人工节点残留 `mode`/`timeout`，审批人允许具体员工，违反 §1.2 / V32-16 | 统一 `human:{approver,condition}`；approver 仅限 Role ID / 审批岗位 |
| 口径 | Work Item 缺 `waiting_human/blocked→ready_for_acceptance` 边、Assignment 缺/多规格外边 | 补齐规格链上的边，删 `draft→deprecated`、`prepared→draft` 等规格外边 |
| 口径 | 附录 A 保留原型 `pauseRun`/`continueRun`；T08-R4 要求显式选继承 | 标注「不实现」，按 §9 中断恢复表达；改默认沿用检查点与产物引用 |
| 口径 | §2.1 三处交叉引用错位、`preferred` 笔误、`index.md` 行数写成 L745 | 逐项修正 |

---

### 0.11 双机任务认领与质量关卡（两台机器必须同时遵守）

**起因**：§3.1 的波次表是静态建议，不是运行时真相。两台机器可能一快一慢、抢同一个任务、误判对方已完成，或者自己写代码自己审核而放过大问题。因此把「认领 + 分层 Agent 审核」升级为每台机器每个新任务的**强制入口**，两边完全一致，不允许一边做一边不做。

#### 0.11.1 任务状态（运行时唯一口径）

| 状态 | 含义 | 判定依据（按优先级） |
|---|---|---|
| `available` | 可认领 | 两台机器的台账都无该任务的活跃条目 **且** `origin/main` 上不存在 `docs/v32/reports/TXX.md` **且** 前置依赖任务已是 `done` |
| `claimed` | 已认领、开发中 | 某台机器台账里 `phase: developing`，且该机器条目未释放 |
| `reviewing` | 开发完成、审核中 | 台账 `phase: reviewing`，审核 Agent 尚未给出「无阻塞项 / PASS」 |
| `done` | 已完成 | 台账 `phase: done` **且** `origin/main` 含该任务报告 **且** 报告 `headSha` 是 `origin/main` 的祖先；三者缺一不可 |
| `blocked` | 阻塞 | 台账 `phase: blocked`，必须写明 `note`（原因 + 待谁裁决），由主线负责人处理 |

> `done` 不能只看报告文件存在：报告可能已在 feature 分支而未合入。**必须**用 `git merge-base --is-ancestor <报告headSha> origin/main` 验证。

#### 0.11.2 共享认领台账（每机只写自己的文件）

路径：`docs/v32/claims/machine-A.json`、`docs/v32/claims/machine-B.json`。由 T00-R0-2b 初始化为两个空文件，各自只由对应机器写入，**禁止修改对方的台账文件**（这正是避免两台机器并发写同一文件产生 merge conflict 的关键）。

```json
{
  "machine": "A",
  "updatedAt": "2026-11-28T15:00:00.000Z",
  "claims": [
    {
      "task": "T02",
      "phase": "developing",
      "branch": "feature/v32-T02-cli-pool",
      "claimedAt": "2026-11-28T14:55:00.000Z",
      "reviewRounds": 0,
      "lastReview": null,
      "note": ""
    }
  ]
}
```

字段约束：`phase` 只能取 `developing | reviewing | done | blocked`；`reviewRounds` 每完成一次审核 +1；`lastReview` 记 `{verdict, blockingCount, at}`；`note` 在 `blocked` 时必填。**同一台机器同一时刻最多 1 条 `developing`/`reviewing` 记录**——避免主 Agent 同时派多个子 Agent 触发平台限流，也保证审核 Agent 不与开发 Agent 抢资源；做完一个并合入后，再认领下一个。

#### 0.11.3 认领协议（每个新任务开始前逐条执行）

1. `git fetch origin` → `git switch main` → `git pull --ff-only origin main`，确保看到对方最新提交。
2. **读全量状态**：合并读取两份台账 + `git ls-tree -r --name-only origin/main docs/v32/reports/`（已合入报告）+ `git merge-base --is-ancestor` 复核每个报告的 headSha，得到 §0.11.1 的全局状态表。速查命令：

   ```bash
   # 两台机器的认领视图（合并看 phase）
   node -e 'const fs=require("fs");for(const m of ["A","B"]){const j=JSON.parse(fs.readFileSync(`docs/v32/claims/machine-${m}.json`,"utf8"));console.log(m,JSON.stringify(j.claims))}'
   # origin/main 上已存在的报告（才可能是 done）
   git ls-tree -r --name-only origin/main docs/v32/reports/
   # 逐个复核报告的 headSha 是否真的合入（TXX 换成任务号）
   node -e 'const fs=require("fs"),cp=require("child_process");const md=fs.readFileSync(process.argv[1],"utf8");const m=md.match(/headSha:\s*([0-9a-f]{7,40})/);if(!m)throw Error("headSha missing");const ok=cp.spawnSync("git",["merge-base","--is-ancestor",m[1],"origin/main"]).status===0;console.log(process.argv[1],m[1],ok?"MERGED":"NOT-MERGED")' docs/v32/reports/T02.md
   ```
3. **选任务**：优先选 §3.1 分配给本机且状态为 `available` 的任务；若自己排程里的任务已被对方认领/完成，**不得重做**，顺延到下一个 `available` 任务并在自己的 `note` 写明「按台账顺延」。若本机已有活跃任务，先完成它再认领。
4. **原子认领**：只在自己的 `claims/machine-X.json` 追加/更新条目，`phase: developing`，`claimedAt` 取当前 ISO 时间；`git add docs/v32/claims/machine-X.json` → `git commit -m "chore(v32): claim TXX on machine X"` → `git push origin main`。**这是唯一允许直接在 `main` 上提交的例外**：只提交自己的台账文件，绝不夹带产品代码或测试（§0.3 的「禁止在 main 上直接改代码」对其余文件仍然有效）。认领提交会随后续 `git switch -c feature/v32-TXX-<slug> origin/main` 一起进入功能分支。
5. **push 冲突恢复**：若 push 被拒（非 ff），`git fetch origin` 后回到步骤 2 重新判定；发现该任务已被对方认领则立即放弃并换任务，禁止强行覆盖或直接开工。
6. 认领成功后才执行 §0.3 step 1 中的建分支命令；报告提交时把认领台账的 `phase` 更新为 `done` 一并提交（见 §0.11.7）。

**禁止**：不读台账直接开工；修改对方台账文件；同一任务两台机器同时开发；认领后跨波次无进展却不释放（写 `note` 并改回 `available` 后由对方或本机重新认领）。

#### 0.11.4 主 Agent 的职责边界

每台机器的主 Agent 是**质量把控与进度把控者**，不是实现者：

- **做**：读台账认领、读规格拆 REQ、创建并派发干净子 Agent、跟踪进度、运行审核循环、裁决阻塞、执行提交与合入、更新台账。
- **不做**：直接写/改产品代码或测试；跳过审核自己给 PASS；在审核 PASS 之前把台账写成 `done`（PASS 之后的写入与读取复核规则见 §0.11.7）。
- **上下文纪律**：每个任务**新开一个干净的开发子 Agent**，其 prompt 必须自包含——任务 REQ 清单、规格章节引用、§1.2 文件所有权、验证清单命令、§0.7 红线、§0.9 权威层级；不得依赖主 Agent 的隐含上下文。审核 Agent 也必须是新的干净上下文，不继承开发过程。
- **限流**：同一时刻主 Agent 只维持「1 个开发子 Agent 或 1 个审核子 Agent」活跃，不同时派多个大 Agent（平台限流历史教训）。

#### 0.11.5 开发 → 审核 → 修复循环

```
认领成功
  → 主 Agent 创建干净【开发子 Agent】，按 §0.3 step 2–5 实现并自测
  → 开发子 Agent 报完成（附 REQ 逐条结论 + 验证输出）
  → 主 Agent 创建新的干净【审核子 Agent】（不继承开发上下文）
  → 审核 Agent 按 §0.11.6 输出 PASS / FAIL + 阻塞项清单
       ├─ PASS（无阻塞项）→ 进入 §0.3 step 6–7 报告、提交、合入
       └─ FAIL → 主 Agent 把阻塞项作为修复任务派回（优先复用开发子 Agent 保留实现上下文；
                  连续两轮同类 FAIL 则重建干净子 Agent 重做该项），
                  修完再新建审核 Agent → 循环直到无阻塞项
```

- 非阻塞建议（命名、注释、可选优化）记入报告「已知偏差」，**不阻塞**合入；阻塞项必须逐条修复并复验。
- 审核轮次写进台账 `reviewRounds`，报告里写每轮 FAIL 原因与修复方式；**任务只有在审核结论为无阻塞项后才算结束**。

#### 0.11.6 审核 Agent 必查清单（逐条给结论）

| # | 检查项 | 阻塞判定 |
|---|---|---|
| 1 | REQ 覆盖：每个 `TXX-Rn` 都有实现落点与验证断言 | 任一 REQ 无落点 → 阻塞 |
| 2 | 规格权威：状态枚举、字段、异常边界与 `index.md` / `page_spec.md` 正文逐字一致，无原型污染（§0.9） | 不一致 → 阻塞 |
| 3 | 文件所有权：`git diff --name-only` 只含 §1.2 分配给本任务的路径（含报告与自己的台账） | 越界改他人文件 → 阻塞 |
| 4 | 验证命令：§0.5 差集口径、测试条数下限、原始帧落盘 `docs/v32/reports/raw/TXX/` | 缺命令/缺证据/新增红 → 阻塞 |
| 5 | 报告完整性：baseSha / branchPointSha / headSha / 逐条结论 / 证据分级齐全 | 缺项 → 阻塞 |
| 6 | 红线合规：§0.7 全项（唯一写入口、事件先落盘、零 CJK、测试环境变量等） | 违反 → 阻塞 |
| 7 | 合入前置：审核 PASS 后才允许提交与合入；报告随功能分支提交 | 顺序错 → 阻塞 |

#### 0.11.7 台账更新时机

| 时机 | 动作 |
|---|---|
| 认领成功（§0.11.3 step 4） | 写 `phase: developing`、`claimedAt`、`branch` |
| 开发子 Agent 报完成、送审 | 写 `phase: reviewing`，`reviewRounds +1` |
| 每轮审核出结论 | 写 `lastReview: {verdict, blockingCount, at}`；FAIL 则继续循环 |
| 审核 PASS 且报告/功能提交已推送 | 随功能提交把 `phase` 更新为 `done`、`lastReview.verdict` 写 `PASS`（§0.3 step 7 是 ff-only 合入，提交 sha 会成为 main 上的 `headSha`） |
| 合入 main 后 | 主 Agent 只读复核 `git merge-base --is-ancestor <headSha> origin/main`；若失败，在自己的台账写 `phase: blocked` 并说明 |
| 其它机器读取时 | **不信任台账里的 `done` 字面值**，按 §0.11.1 复核三条件；`headSha` 不是 `origin/main` 祖先时按 `reviewing` 对待，在自己台账 `note` 记录提醒（禁止改对方文件），必要时报主线负责人 |
| 遇阻塞/放弃 | 写 `phase: blocked` 或释放为 `available`，`note` 必填 |

§3.2 同步点时两台机器都重新执行 §0.11.3 step 2 的全量状态读取，用台账交叉核对「对方任务是否真的合入」，不能只看本地分支或对方台账里的 `done` 字面值。

---

## 1. 架构决策与模块边界

### 1.1 为什么新增 `src/v32/` 而不是就地改 `src/studio/`

现状事实（已核对）：

- `src/studio/schema.js:129` 的 `emptyStudio()` 只有 `{departments, roles, employees, sessions, teams, flows, tasks, defects, changes, runs}`，**无 workItems / assignments / deliveries**。
- `src/studio/team.js:59,71` 的 Team 带 `flowId`（V3.2 §3.1 明确禁止）；`src/studio/org.js:138-148` 的 Employee 强制 `cliId` 且单 `roleId`（V3.2 §1.2 / §3.2 禁止与限制）。
- `src/studio/org.js:189 openSession` 只是 `mode:'record'` 的语义记录，无两层会话。
- `test/wp17`、`test/wp18` 与 `scripts/verify-authoring-ui.mjs` 大量冻结 v2 Studio 行为；就地改会同时撞红几十条冻结用例。

因此：**V3.2 作为独立领域模块实现**，自持 CAS 存储与 HTTP 路由；桌面壳新增 V3.2 页面并让其成为业务主入口；v2 Studio 保留但不再是 V3.2 链路的一部分。引擎底座通过 `src/v32/bridge.js` 单向复用，不改引擎源码。

### 1.2 目录与文件所有权总表（并行防冲突的关键）

| 所有者 | 独占路径（其它任务禁止修改） |
|---|---|
| T00 | `docs/iterations/iteration-7/baseline-failures.txt`、`docs/iterations/iteration-10a/baseline-failures-win32.txt`（仅从 `7b71cd4` 恢复，不得改写内容）、`docs/v32/reports/` 占位、`docs/v32/claims/machine-A.json`、`docs/v32/claims/machine-B.json`（仅初始化为空台账；运行期各机只写自己的文件，见 §0.11.2） |
| T01 | `src/v32/contracts.js`、`ids.js`、`errors.js`、`store.js`、`events.js`、`audit.js`、`index.js`（骨架）、`test/wp21/v32-contracts.test.js`、`v32-store.test.js`、`v32-events.test.js`、`test/wp21/fixtures/v32-*.json` |
| T02 | `src/v32/cli-pool.js`、`src/daemon/http/v32/cli-routes.js`、`desktop/ui/v32/cli-page.js`、`test/wp21/v32-cli-pool.test.js` |
| T03 | `src/v32/roles.js`、`src/daemon/http/v32/roles-routes.js`、`desktop/ui/v32/roles-page.js`、`test/wp21/v32-roles.test.js` |
| T04 | `src/v32/employees.js`、`src/daemon/http/v32/employees-routes.js`、`desktop/ui/v32/employees-page.js`、`test/wp21/v32-employees.test.js` |
| T05 | `src/v32/teams.js`、`src/daemon/http/v32/teams-routes.js`、`desktop/ui/v32/teams-page.js`、`test/wp21/v32-teams.test.js` |
| T06 | `src/v32/workflows.js`、`src/v32/graph.js`、`src/daemon/http/v32/workflows-routes.js`、`desktop/ui/v32/workflows-page.js`、`desktop/ui/v32/graph.js`、`test/wp21/v32-workflows.test.js`、`test/wp21/v32-dag.test.js` |
| T07 | `src/v32/work-items.js`、`src/v32/preflight.js`、`src/daemon/http/v32/work-items-routes.js`、`desktop/ui/v32/work-items-page.js`、`desktop/ui/v32/wizard.js`、`test/wp21/v32-work-items.test.js`、`v32-preflight.test.js` |
| T08 | `src/v32/mapping.js`、`src/daemon/http/v32/mapping-routes.js`、`desktop/ui/v32/mapping-panel.js`、`test/wp21/v32-mapping.test.js` |
| T09 | `src/v32/assignments.js`、`src/daemon/http/v32/assignments-routes.js`、`desktop/ui/v32/assignment-panel.js`、`test/wp21/v32-assignments.test.js` |
| T10 | `src/v32/sessions.js`、`src/v32/bridge.js`、`src/v32/host-profile.js`、`src/daemon/http/v32/sessions-routes.js`、`desktop/ui/v32/session-panel.js`、`test/wp21/v32-sessions.test.js`、`v32-bridge.test.js` |
| T11 | `src/v32/runs.js`、`src/daemon/http/v32/runs-routes.js`、`desktop/ui/v32/run-page.js`、`desktop/ui/v32/activity-panel.js`、`test/wp21/v32-runs.test.js` |
| T12 | `src/v32/recovery.js`、`src/daemon/http/v32/recovery-routes.js`、`desktop/ui/v32/recovery-panel.js`、`test/wp21/v32-recovery.test.js` |
| T13 | `src/v32/human-gates.js`、`src/daemon/http/v32/human-routes.js`、`desktop/ui/v32/human-gate-dialog.js`、`test/wp21/v32-human.test.js` |
| T14 | `src/v32/delivery.js`、`src/v32/records.js`、`src/daemon/http/v32/records-routes.js`、`desktop/ui/v32/records-page.js`、`desktop/ui/v32/delivery-dialog.js`、`test/wp21/v32-delivery.test.js`、`v32-audit.test.js` |
| T15 | `src/daemon/http/v32-routes.js`、`src/daemon/http/routes.js`（仅加 import、`v32Routes` 构造、`routes.push` 三处）、`test/wp21/v32-api-contract.test.js`、`test/wp14/e2e.test.js`（仅 AC-39 写路径白名单按 `/v32/` 前缀放行；不做其它改动） |
| T16 | `desktop/ui/shell/nav.js`、`shell/index.js`、`shell/chrome.js`、`shell/pages.js`、`desktop/ui/app.js`、`desktop/ui/v32/index.js`、`desktop/ui/v32/v32.css`、`desktop/ui/index.html`（加 `<link>`）、`src/daemon/http/labels.js`、`src/cli/labels.js`、`scripts/verify-v32-ui.mjs`、`test/wp21/v32-labels.test.js`、`test/wp13/v32-shell.test.js`、`test/wp13/labels-desktop.test.js`（仅 append 键与值）、`scripts/verify-nav.mjs`、`scripts/verify-scenarios.mjs`、`scripts/verify-desktop-boot.mjs`（仅把「恰好 5 段」改为「原有 5 段仍可进入 + 新增 4 段可进入」） |
| T17 | `scripts/verify-v32.mjs`、`test/wp21/v32-acceptance.test.js`、`package.json`（只加 `verify:v32` script）、`docs/v32/reports/acceptance.md` |
| T18 | `docs/v32/reports/final-verification.md`（不新增源码；只做全量回归与门禁复跑） |
| 主线负责人 | `docs/maestro_v3_2_implementation_plan.md`（本文档，只读）、`.workbuddy/memory/**`、分支合并裁决、阻塞升级裁决（§5.3） |
| 机器 A 主 Agent | `docs/v32/claims/machine-A.json`（独占写）；其认领任务的 `docs/v32/reports/raw/TXX/`（取证，随任务报告提交） |
| 机器 B 主 Agent | `docs/v32/claims/machine-B.json`（独占写）；其认领任务的 `docs/v32/reports/raw/TXX/`（取证，随任务报告提交） |

**共享但只读的既有模块**（任何任务都不得修改）：`src/core/**`、`src/persistence/**`、`src/adapter/cli-discovery/**`、`src/daemon/server.js`、`src/templates/**`、`scripts/desktop/gate.mjs`。若确需改动，写入报告 `BLOCKED` 交给主线负责人。

### 1.3 统一契约（所有任务按此实现，T01 负责落成代码）

#### 1.3.1 存储与事件

```js
// src/v32/contracts.js（T01 导出，其他任务 import，不要自行复制常量）
export const V32_SCHEMA_VERSION = 1;
export const V32_STATE_FILE = '.orch/v32/state.json';
export const V32_EVENTS_FILE = '.orch/v32/events.jsonl';
export const V32_AUDIT_FILE = '.orch/v32/audit.jsonl';

export const ID_PREFIX = Object.freeze({
  role:'ROLE', employee:'EMP', team:'TEAM', workflow:'WF', workItem:'WI',
  run:'RUN', task:'TASK', assignment:'ASSIGN', employeeSession:'ES',
  hostBinding:'HB', attempt:'ATT', artifact:'ART', event:'EVT', audit:'AUD'
});

export const WORK_ITEM_STATUS = Object.freeze([
  'draft','configured','ready_to_run','running','waiting_human','blocked',
  'ready_for_acceptance','accepted','delivered','cancelled'
]);
// 严格逐字对齐规格 §13.4（index.md L654-656 / page_spec.md L723-725）：7 个正常态 + 5 个异常态，共 12 态。
// 原型中的 waiting_queue / human_waiting 不在规格内，禁止加入此枚举。
export const TASK_STATUS = Object.freeze([
  'waiting_dependency','ready','assignment_prepared','preflight','creating_session','running','succeeded',
  'interrupted','blocked','failed','cancelled','skipped'
]);
export const ASSIGNMENT_STATUS = Object.freeze([
  'draft','prepared','preflight','locked','released','failed'
]);
export const ASSET_STATUS = Object.freeze(['draft','published','deprecated']);
export const NODE_TYPES = Object.freeze(['agent','human']);
/** 审计类型全集（实现约定；§12 P16 只要求三类操作留审计事件，未规定枚举字面）。 */
export const AUDIT_TYPES = Object.freeze([
  'role.published','employee.updated','team.published','team.deprecated',
  'workflow.published','workflow.deprecated','work_item.created','plan.revised',
  'mapping.changed','assignment.locked','session.created','recovery.succeeded',
  'recovery.failed','human.approved','delivery.accepted','delivery.delivered'
]);

/** 事件类型全集（实现约定，规格未定义枚举）：所有任务只能从这里取值，禁止各写各的字符串。 */
export const EVENT_TYPES = Object.freeze([
  'cli.scan.started','cli.scan.finished','cli.health.checked',
  'role.created','role.updated','role.published','role.deprecated',
  'employee.created','employee.updated','employee.toggled',
  'team.created','team.updated','team.published','team.deprecated','team.copied',
  'workflow.created','workflow.updated','workflow.published','workflow.deprecated','workflow.copied',
  'work_item.created','work_item.started','work_item.cancelled',
  'plan.revised','mapping.changed',
  'assignment.prepared','assignment.preflight_failed','assignment.locked','assignment.released',
  'session.created','host.bound','host.woken',
  'attempt.started','attempt.finished',
  'task.ready','task.started','task.succeeded','task.interrupted','task.failed','task.queued',
  'human.approved','human.rejected',
  'recovery.succeeded','recovery.failed',
  'delivery.accepted','delivery.delivered','artifact.created'
]);

/** 错误码全集（实现约定，规格未定义枚举）：HTTP 层与领域层共用，测试只认这些码。 */
export const ERROR_CODES = Object.freeze([
  'V32_INVALID_INPUT','V32_NOT_FOUND','V32_REV_CONFLICT','V32_ILLEGAL_TRANSITION',
  'V32_FORBIDDEN_FIELD','V32_DUPLICATE_ID','V32_DUPLICATE_VERSION','V32_ROLE_NOT_QUALIFIED','V32_ROLE_GAP',
  'V32_NO_CANDIDATE','V32_SERIAL_QUEUE','V32_ASSIGNMENT_LOCKED','V32_CLI_UNAVAILABLE',
  'V32_CLI_CAPABILITY_GAP','V32_SESSION_CONFLICT','V32_RECOVERY_UNAVAILABLE',
  'V32_APPROVER_INVALID','V32_DELIVERY_INCOMPLETE','V32_SNAPSHOT_MISMATCH'
]);

/** 合法迁移表；`assertTransition` 是唯一判定入口。 */
export const TRANSITIONS = Object.freeze({
  workItem: {
    draft: ['configured', 'cancelled'],
    configured: ['ready_to_run', 'cancelled'],
    ready_to_run: ['running', 'cancelled'],
    running: ['waiting_human', 'blocked', 'ready_for_acceptance', 'cancelled'],
    waiting_human: ['running', 'ready_for_acceptance', 'cancelled'],
    blocked: ['running', 'ready_for_acceptance', 'cancelled'],
    ready_for_acceptance: ['accepted', 'cancelled'],
    accepted: ['delivered'],
    delivered: [],
    cancelled: []
  },
  task: {
    waiting_dependency: ['ready', 'skipped', 'cancelled'],
    ready: ['assignment_prepared', 'blocked', 'cancelled'],  // 人工节点停在 ready，由 WorkItem.waiting_human 表达等待
    assignment_prepared: ['preflight', 'blocked', 'cancelled'], // 排队用 run.queue 标记，不改 Task 状态（§6.3）
    preflight: ['creating_session', 'failed', 'assignment_prepared'],
    creating_session: ['running', 'failed', 'interrupted'],
    running: ['succeeded', 'interrupted', 'blocked', 'failed', 'cancelled'],
    interrupted: ['preflight', 'running', 'cancelled'],
    blocked: ['ready', 'failed', 'cancelled'],
    failed: ['ready', 'cancelled'],
    succeeded: [],
    cancelled: [],
    skipped: []
  },
  // §13.5 只定义 6 态，无 cancelled；assignment 取消走 failed / released
  assignment: {
    draft: ['prepared'],
    prepared: ['preflight'],
    preflight: ['locked', 'failed', 'prepared'],
    locked: ['released', 'failed'],
    released: [],
    failed: ['draft', 'prepared']
  },
  // §13.2/§13.3 链为 draft→published→deprecated；草稿不可直接停用
  team: { draft: ['published'], published: ['deprecated'], deprecated: [] },
  workflow: { draft: ['published'], published: ['deprecated'], deprecated: [] }
});

/** ID 格式：前缀 + 至少三位序号；快照 ID 形如 `WF-SNAPSHOT-WI-001`。 */
export const ID_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{3,}$/;
```

状态文件结构（顶层数组固定，新字段只能追加在末尾）：

```js
{
  schemaVersion: 1,
  rev: <number>,                 // 每次 transit +1，重启不回退
  updatedAt: <ISO string>,
  roles: [], employees: [], teams: [], workflows: [],
  workItems: [], nodeExecutorPlans: [],   // §1.1 / §2：Node Executor Plan 是 10 个核心对象之一，独立建模
  assignments: [], sessions: {employees:[], hostBindings:[], attempts:[]},
  runs: [], deliveries: [], cliPool: {installs:[], scan:{mode,startedAt,finishedAt,status}},
  artifacts: []
}
```

Store API（唯一写入口）：

```js
const store = createV32Store({ root, now: () => new Date().toISOString() });
store.read();                                   // 返回深拷贝快照
store.get(kind, id); store.list(kind);
store.transit(mutator, { expectedRev, reason, actor });
//  mutator(draft) 内只能改 draft；返回 { ok:true, value, events?:[] } 或 { ok:false, code, params }
//  成功：原子写 state.json（rev+1）→ 追加 events.jsonl / audit.jsonl → 再广播
store.nextId(kind);                    // 只能在 transit mutator 内调用，按现有最大序号 +1
store.snapshot(kind, id, version);     // 深拷贝 + {snapshotOf:{kind,id,version}, capturedAt}
store.assertTransition(kind, from, to); // 走 TRANSITIONS，失败返回 V32_ILLEGAL_TRANSITION
store.appendEvent(event); store.appendAudit(event);  // 仅供 transit 内部调用
store.events({ workItemId, runId, type, limit }); store.audit({ type, limit });
```

**快照结构**（Work Item 的 `workflowSnapshot` / `teamSnapshot` 必须按此存，不能只存 ID）：

```js
{
  snapshotOf: { kind: 'workflow' | 'team', id, version },
  capturedAt: '<ISO>',
  definition: { /* 选定版本当时的完整深拷贝：nodes/edges/members 等 */ }
}
```

「仅用于本次需求」的资产：生成 `WF-SNAPSHOT-<workItemId>` / `TEAM-SNAPSHOT-<workItemId>` 作为 `snapshotOf.id`，不写入 `workflows[]` / `teams[]`；「保存到库」则先分配正式 ID 与版本，再快照引用。

对象形状（最小字段，允许追加；**禁止**出现「不该保存的字段」列）：

| 实体 | 必需字段 | 禁止字段 |
|---|---|---|
| CLIInstall | `id,name,path,version,adapter,capabilities,health,auth,resumable,fingerprint,source` | 员工 / 团队 / Session 归属 |
| Role | `id,name,description,duties,skills[],inputs[],outputs[],requires{},acceptance[],version,status,versions[]` | 员工 / 团队 / CLI ID |
| Employee | `id,name,description,qualifications:[roleId],enabled,createdAt,updatedAt` | `cliId`, `teamId`, `sessionId`, 单一 `roleId` |
| Team | `id,name,description,version,status,versions[],members:[{employeeId,roles[],primary,priority,participate,capacity}],createdAt` | `workflowId`, CLI / Session 字段 |
| Workflow | `id,name,description,version,status,kind,nodes[],edges[],versions[],createdAt` | `employeeId`, `teamId`, `cliId` |
| Node(agent) | `id,type:'agent',name,roleId,instruction,inputs[],outputs[],deps[],capabilities{},acceptance[],timeout,failurePolicy,retry,fallback,escalation,handoff,condition`（§4.1 四项并行：Retry / Fallback / Escalation / Failure Policy） | 员工 ID / CLI ID |
| Node(human) | `id,type:'human',name,human:{approver,condition},inputs[],outputs[],deps[],acceptance[]`（§4.3 审批人/条件；会签/默认动作/升级为规格外，不建） | `employeeId`、`roleId` 之外的执行人/CLI/Session；`approver` 只放 Role ID 或审批岗位，不放具体员工（§1.2 / V32-16） |
| WorkItem | `id,title,description,background,goal,projectDir,workspace,attachments[],referenceRefs[],priority,creator,createdAt,status,workflowSnapshot,teamSnapshot,nodeExecutorPlanId,runId,historyRuns[],planRevisions[],deliveryRecord`（§5.1 含「项目/工作空间」「输入附件和参考资料」） | 宿主会话细节 |
| NodeExecutorPlan | `id,workItemId,workflowSnapshotId,teamSnapshotId,mapping:{[nodeId]:employeeId|null},createdAt,updatedAt`（§1.1 独立核心对象；属于 WorkItem 执行方案，不写回 Workflow/Team） | 宿主会话/CLI 绑定 |
| Task Assignment | `id,runId,taskId,nodeId,employeeId,cliInstallationId,cliFingerprint,adapterVersion,workingDir,inputArtifactRefs,permissions,status`（§7.2 11 项） | 员工档案或团队定义的修改（§1.2 隔离规则） |
| EmployeeSession | `id,employeeId,status,contextRefs[],checkpointRef,createdAt,updatedAt` | 员工档案属性 |
| HostBinding | `id,employeeSessionId,cliInstallationId,adapter,hostSessionId,resumable,compatible,capabilities,status,lastActivity` | 员工身份本身 |
| Attempt | `id,taskId,assignmentId,employeeSessionId,hostBindingId,resumedFrom,status,startedAt,endedAt,checkpointRef,artifactRefs[],activity[],error` | — |
| Run | `id,workItemId,workflowVersion,teamVersion,tasks[],queue:[{taskId,reason,queuedAt}],status,createdAt,finishedAt,stats`（§6.3 排队是 Scheduler 行为，用队列标记，不设 Task 状态） | — |
| Artifact | `id,name,kind,workItemId,runId,taskId,employeeId,cliInstallationId,attemptId,handoffId,path,createdAt` | — |

错误与事件格式：

```js
// 所有领域函数统一返回
{ ok:true, value } | { ok:false, code:'V32_<CODE>', params:{...} }

// 事件（events.jsonl 与 audit.jsonl 同行格式）
{
  id, seq, ts, type, actor,
  refs: { workItemId, runId, taskId, assignmentId, employeeId,
          cliInstallationId, employeeSessionId, hostBindingId, attemptId },
  payload: {},
  prevHash, hash   // sha256(canonicalize({...无 hash 字段}))
}
```

#### 1.3.2 HTTP API 契约

- 全部挂在 `/v32/` 下，`Content-Type: application/json`；错误响应沿用 `{ok:false,code,params}`，HTTP 400（校验）/ 404（不存在）/ 409（状态冲突）。
- 每个域任务导出**路由片段**：`export function createV32XRoutes(deps) { return [{method, pattern, handler}] }`。T15 提供 `createV32Routes(deps)` 汇总并在 `src/daemon/http/routes.js` 挂载。
- 路由清单（各任务负责自己的段）：

| 前缀 | 方法/路径 | 所属任务 |
|---|---|---|
| `/v32/cli` | `GET /`、`POST /`、`POST /scan`（body `{mode:'quick'\|'full'}`）、`POST /:id/health`、`GET /:id/capabilities` | T02 |
| `/v32/roles` | `GET /`、`POST /`、`GET /:id`、`GET /:id/refs`、`PUT /:id`、`POST /:id/publish`、`POST /:id/deprecate` | T03 |
| `/v32/employees` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/toggle` | T04 |
| `/v32/teams` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/publish`、`POST /:id/deprecate`、`POST /:id/copy` | T05 |
| `/v32/workflows` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`GET /:id/graph`、`POST /:id/publish`、`POST /:id/deprecate`、`POST /:id/copy` | T06 |
| `/v32/work-items` | `GET /`、`POST /`、`GET /:id`、`POST /:id/preflight`、`POST /:id/start`、`POST /:id/cancel`、`POST /:id/revise` | T07 |
| `/v32/mapping` | `GET /:workItemId/candidates`、`PUT /:workItemId`、`GET /:workItemId/conflicts` | T08 |
| `/v32/assignments` | `POST /prepare`、`GET /:id`、`PUT /:id`、`POST /:id/start`、`POST /:id/release` | T09 |
| `/v32/sessions` | `GET /:employeeId`、`GET /:employeeId/bindings`、`POST /:employeeId/ensure`、`POST /:bindingId/wake` | T10 |
| `/v32/runs` | `GET /`、`GET /:id`、`POST /:id/tasks/:taskId/queue`（实现约定，规格 §6.3 只要求 Scheduler 排队）、`POST /:id/tasks/:taskId/complete`、`POST /:id/tasks/:taskId/interrupt`、`GET /:id/events` | T11 |
| `/v32/recovery` | `GET /:taskId/options`、`POST /:taskId/recover-original`、`POST /:taskId/recover-checkpoint` | T12 |
| `/v32/human` | `POST /:taskId/approve`、`POST /:taskId/reject`、`GET /:taskId/policy` | T13 |
| `/v32/records` | `GET /artifacts`、`GET /artifacts/:id/trace`、`GET /events`、`GET /audit`、`GET /:workItemId/delivery`、`POST /:workItemId/deliver` | T14 |

**T15 的精确挂载点**（必须按此实现，避免动到冻结 seam）：

- `src/daemon/http/routes.js` 顶部增加 `import { createV32Routes } from './v32-routes.js';`。
- 在 `createRoutes` 内、`const routes = [` 之前增加 `const v32Routes = createV32Routes({ root: projectRoot });`；在 `return routes;` 之前增加 `routes.push(...v32Routes);`。
- `createV32Routes` **不得**在构造期读 `.orch/v32/**`、不得建目录、不得抛异常；store 在首次请求时懒创建并缓存（`http/server.js:263-284` 会静默吞掉构造异常，构造期抛错会让整个 REST 退化 503）。
- 保持 `route` 描述形状 `{method, pattern, handler}`；`handler(req,res,url,params)` 与现有路由一致。不得改 `shapeSnapshot`、既有路由顺序或 `attachLazySeams`。

#### 1.3.3 桌面 UI 契约（对齐现有壳，不另起一套）

**现状**：`desktop/ui/shell/pages.js` 的页面函数签名是 `render(ctx)`，返回 `DocumentFragment`/DOM 节点；`ctx` 由 `buildShellContext`（`desktop/ui/app.js:2950`）构造，现有字段为 `{state, model, labels, t, st, actions, view, instanceId, instanceRow, graph, viewTitle, crumbs, ...}`，**没有** `api/nav/toast/modal/refresh`。`PAGE_BY_VIEW` 是 `desktop/ui/shell/index.js:25` 的冻结映射。

**V3.2 页面模块契约**（与现有壳一致）：

```js
// desktop/ui/v32/<domain>-page.js
export const viewId = 'v32-work-items';     // 唯一，加入 PAGE_BY_VIEW
export const section = 'work_items';        // 对应 nav.js 分组 id
export function render(ctx) {               // 返回 DocumentFragment；纯渲染，不 fetch
  const frag = document.createDocumentFragment();
  // 只用 ctx.v32.data / ctx.t / ctx.st；事件只写 data-action / data-arg
  return frag;
}
export const actions = {                    // 由 T16 注册进 handleAction 的 v32-* 分派
  'v32-wi-open': async (arg, ctx) => {}
};
```

**数据装载**（T16 统一实现，页面不各自 fetch）：

- `app.state()` 增加 `v32: { view, data, loading, error, selected }`；`app.loadV32(view, params)` 调 `/v32/*`，成功后 `state.v32 = {...}` 再 `paint()`。
- `buildShellContext` 增加 `v32: state.v32` 与 `v32Api: { get, post, put }`（薄封装，错误按 `{ok:false,code,params}` 抛出）。
- `handleAction` 在 `nav`/`v32-*` 分支里先 `await app.loadV32(...)` 再 `paint()`；页面 `render` 只消费已装载的 `ctx.v32`。
- 输入控件必须带 `data-field`；`pointerdown` 与 `click` 同时派发（600ms 去重）；导航锚点唯一化（`.sidebar [data-section=…]`、`.secbar .sec-tab[data-tab=…]`）。

**文案**：所有用户可见字符串走 `ctx.t('V32_...')`；新增键必须同时加入 `src/daemon/http/labels.js` 的 `UI_LABEL_KEYS` 与值表，以及 `test/wp13/labels-desktop.test.js` 的 `EXPECTED_V2_KEYS`/`EXPECTED_V2_VALUES`（**append-only，既有行逐字不变**）；CLI 可见的再镜像到 `src/cli/labels.js`。键必须真被 `GET /ui/labels` 下发。

**导航**：规格 §11 的 9 组（启动与资源 / 需求工作台 / 执行中心 / 团队库 / 工作流库 / 员工档案 / 角色库 / 产物与事件 / 系统设置）由 T16 在 `desktop/ui/shell/nav.js` 扩展；保留现有 5 组与全部历史 view ID 的深链兼容。页面模块不得直接改导航。

**流程图**：`desktop/ui/v32/graph.js`（T06 独占）导出 `layoutDag(nodes,edges)`、`validateDag(nodes,edges)`、`renderGraph({nodes,edges,mode,stateMap,selected,onSelect,onEdit})`；`mode` 取 `definition | runtime | edit`，交互含缩放、适应画布、拖动平移、点选、上下游高亮（实现约定，形态参考原型 `showWorkflowDag` / `graphHTML` / `graphRefresh`；规格 P07/P11 只要求 DAG 画布与多视图）。`renderGraph` 返回 SVG/DOM 节点，不返回字符串。

#### 1.3.4 与引擎的桥接（T10 独占，按真实导出实现）

**已核对的现状**：

- `src/adapter/factory.js` 只导出 `createAdapterFactory({root,hostId,env,clock})`，返回 `{create({hostId,cwd})}`；内部 `buildAdapter` 是**未导出**函数。
- `factory.create()` 内部固定 `initialize → newSession`，因此它只能用于**首次创建** Host Session，**不能**用于恢复原 Host Session。
- `src/adapter/acp-client.js` 导出 `createAcpClient({transport,limits,clock})`，返回的客户端含 `initialize`、`newSession`、`resumeSession`、`loadSession`、`prompt`、`cancel`、`closeSession` 等；`normalizeCapabilities` 可判断 `canResume/canLoad`。
- `createAdapterFactory` 读 `<root>/.orch/hosts/<hostId>.json`（`host-config.js:39`）；不会读 V3.2 的 CLI 安装记录。

**桥接实现要求**：

```js
// src/v32/bridge.js
export function createBridge({ root, store, now }) {
  return {
    // 首次启动 / 策略 B：写 host profile（不覆盖已有文件）后走 factory.create
    async createHost({ assignment, employeeSession }),
    // 策略 A / 复用：直接 createStdioTransport + createAcpClient
    // → initialize → resumeSession(hostSessionId) 或 loadSession(hostSessionId)
    async wakeHost({ binding, attempt }),
    async pollActivity({ bindingId, since }),
    async stopHost({ bindingId, reason })
  };
}
```

- `src/v32/host-profile.js`（T10 独占）：为每个 CLI 安装生成 `.orch/hosts/v32-<installId>.json`，内容 `{id, launch:{command,args,env}, limits:{...}}`；只创建/更新 `v32-` 前缀文件，**绝不覆盖**用户已有宿主配置。`hostId` 用 `v32-` + 安装 ID 的安全 slug。
- `wakeHost` 必须先 `initialize` 读能力，再按 `canResume → resumeSession`、`canLoad → loadSession` 的顺序尝试；两者都不可用返回 `V32_RECOVERY_UNAVAILABLE`，**不得**回落到 `newSession`（那是策略 B，必须由 T12 显式选择）。
- 复用点：`createAdapterFactory`（新会话）、`createStdioTransport`、`createAcpClient`、`normalizeCapabilities`、`createNormalizer`、`resolveDshLaunch`。T10 不得修改 `src/adapter/**`。

### 1.4 测试组织约定

- 新测试统一放 `test/wp21/`，文件名 `v32-*.test.js`，夹具放 `test/wp21/fixtures/v32-*.json`。
- 单文件跑法：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-<域>.test.js"`。
- 本域全跑：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-*.test.js"`；**必须带条数下界**：`tests >= 本任务新增测试数` 且 `fail === 0`，否则 glob 空匹配会「0 测试、exit 0」假绿。
- 全量：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"`。
- 所有测试使用临时目录（`fs.mkdtempSync(path.join(os.tmpdir(),'v32-'))`），结束清理；禁止读写真实 `~/.maestro`、`~/.orch` 或仓库内其它迭代证据目录。
- 任务详情里若只写了 `test/wp21/xxx.test.js` 简写，执行时必须补全为 `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/xxx.test.js"`；漏 `NODE_ENV=test` 会让 `/__test__/*` 接缝不注册而假红。

---

## 2. 覆盖矩阵（确保任务并集 = 全部需求）

### 2.1 规格章节 → 任务

| 规格章节 | 内容 | 主责任务 | 协同 |
|---|---|---|---|
| §1 核心对象/隔离规则/关系约束 | 10 对象、8 条隔离、10 条关系 | T01 | 全部 |
| §3 团队模型 | 3.1 定义、3.2 成员与角色、3.3 复用、3.4 新建来源 | T05 | T04, T07 |
| §4 工作流模型 | 4.1 定义、4.2 Agent 节点 10 项（以 `index.md` 为准；`page_spec.md` 拆为 11 项）、4.3 人工节点、4.4 复用 | T06 | T03, T13 |
| §5 Work Item | §5 正文 14 字段、§5.1 四种组合、§5.2 五步向导（`index.md` 无 §5.3） | T07 | T05, T06, T08 |
| §6 执行人映射 | 6.1 独立映射、6.2 自动匹配、6.3 并行冲突、6.4 替换 | T08 | T07, T09 |
| §7 CLI 与分配 | 7.1 扫描 8 项、7.2 Assignment 11 项、7.3 6 态 | T02, T09 | T10 |
| §8 会话生命周期 | 8.1 不建会话的 6 种操作、8.2 两层身份、8.3 启动 8 步、8.4 串行 | T10 | T09, T11 |
| §9 中断与恢复 | 11 项保留信息、策略 A / B、失败保持中断 | T12 | T10, T11, T14 |
| §10 链路 A/B/C/D | 四链路全部步骤与分支 | T07, T11, T12 | T05–T10 |
| §11 信息架构 | 一级导航 9 组 | T16 | 全部 |
| §12 P00–P16 | 见 §2.2 | 见 §2.2 | — |
| §13 状态机 | 见 §2.3 | 见 §2.3 | — |
| §14 异常边界 | 10 条，见 §2.5 | T05–T14 | — |
| §15 原型覆盖范围 | 原型是演示参考（非需求来源），17 条验收用例以 §16 为准；交互形态见附录 A | T16 | — |
| §16 验收用例 | V32-01～17，见 §2.4 | T17 | 全部 |

### 2.2 P00–P16 → 任务

| 页面 | 主责 | 页面 | 主责 |
|---|---|---|---|
| P00 本机 Agent CLI 扫描 | T02 | P09 角色库 | T03 |
| P01 需求/任务工作台 | T07 | P10 执行中心 | T11 |
| P02 五步向导 | T07 + T08 | P11 工作流执行视图 | T11 |
| P03 需求详情 | T07 + T14 | P12 节点分配面板 | T09 |
| P04 团队库 | T05 | P13 员工活动面板 | T11 |
| P05 团队编辑器 | T05 | P14 任务与会话详情 | T10 + T11 |
| P06 工作流库 | T06 | P15 中断恢复 | T12 |
| P07 工作流编辑器（DAG） | T06 | P16 产物与事件 | T14 |
| P08 员工档案 | T04 | 系统设置 / 验收自检 | T16 + T17 |

### 2.3 状态机 → 任务

| 状态机 | 合法迁移 | 实现任务 | 关键断言 |
|---|---|---|---|
| Work Item §13.1 | `draft→configured→ready_to_run→running→waiting_human/blocked→ready_for_acceptance→accepted→delivered`，另 `cancelled` | T07 + T11 + T14 | 非法迁移返回 `V32_ILLEGAL_TRANSITION` 且不落盘；`waiting_human`/`blocked` 可直接进 `ready_for_acceptance`（规格链式写法），解除后也可先回 `running` |
| Team §13.2 | `draft→published→deprecated` | T05 | publish 生成新版本；deprecated 不可选为新需求 |
| Workflow §13.3 | `draft→published→deprecated` | T06 | 发布后修改生成新版本；旧 Work Item 快照不变 |
| Node Task §13.4 | `waiting_dependency→ready→assignment_prepared→preflight→creating_session→running→succeeded`，异常 `interrupted/blocked/failed/cancelled/skipped`（严格 12 态，无 `waiting_queue`/`human_waiting`） | T11 | 依赖未完成时不可 `ready`；完成后下游解锁；排队用 Run.queue 标记，人工等待用 WorkItem `waiting_human` |
| Assignment §13.5 | `draft→prepared→preflight→locked→released`，分支 `failed`（无 `cancelled`） | T09 | `prepared` 无 Session；`locked` 后员工/CLI 不可改 |
| 会话 §13.6 | Employee Session 长期稳定；Host Binding 按 CLI/Adapter，不跨 CLI 复用 | T10 | 跨 CLI 必然新 Binding；Employee Session ID 不变 |

### 2.4 V32-01～17 → 任务与验证落点

| 用例 | 场景 | 实现任务 | 自动化脚本断言（T17） |
|---|---|---|---|
| V32-01 | 已有工作流 + 已有团队 | T07 | WorkItem 同时持有两快照，两快照内无对方 ID 字段 |
| V32-02 | 新建工作流 + 新建团队 | T07 + T05 + T06 | 两种「仅本次 / 保存到库」都成功；仅本次不进公共库 |
| V32-03 | 团队被多工作流复用 | T05 | team 对象无 `workflowId`；两个 WorkItem 引用同 team 版本 |
| V32-04 | 工作流被多团队复用 | T06 | workflow 对象无 `teamId/employeeId`；DAG 图模式可渲染 |
| V32-05 | 节点匹配团队成员 | T08 | 每个 agent 节点映射成员具备对应 roleId 资格 |
| V32-06 | 缺少角色覆盖 | T07 `preflight` | 返回 `V32_ROLE_GAP`，列出缺失角色，无法创建 |
| V32-07 | 同员工并行节点 | T08 + T09 | 提示串行；占用时可选改派或排队；无并发写同一 Session |
| V32-08 | 创建 Work Item | T07 | 创建后 `status=configured`，无 Assignment / Session / CLI |
| V32-09 | 节点 Ready | T09 | 候选员工来自本次团队快照；CLI 来自本机资源池且能力匹配 |
| V32-10 | 保存 Prepared | T09 | `prepared` 有员工+CLI，Session 数为 0，可修改 |
| V32-11 | 启动节点 | T09 + T10 | Assignment `locked`；按需建 Employee/Host Session；Attempt 存在 |
| V32-12 | 员工更换 CLI | T09 + T04 | Employee Profile / Team 无变化；仅新 Assignment 选新 CLI |
| V32-13 | 恢复原宿主 | T12 | 存在且兼容可恢复 → 继续原 Attempt；不可用 → 保持 interrupted + 审计 |
| V32-14 | 跨 CLI 检查点恢复 | T12 | 新 Binding + 新 Attempt，`resumedFrom` 指向旧 Attempt，Employee Session ID 不变 |
| V32-15 | 修改团队/工作流资产 | T05 + T06 + T07 | 发布新版本后旧 WorkItem 快照逐字不变 |
| V32-16 | 人工节点 | T06 + T11 + T13 | 无 employeeId / cliId / sessionId；批准写审计 |
| V32-17 | 交付验收 | T14 | `accepted→delivered`，`deliveryRecord` 含测试/风险/验收人，事件可追溯 |

### 2.5 异常边界与链路 → 任务

| 异常边界（§14 编号） | 处理任务 |
|---|---|
| 1 角色未覆盖 → 阻止确认并列出缺失角色 | T07 |
| 2 同员工并行 → 提示 + 改派/排队 | T08、T09 |
| 3 团队成员停用 → 未启动重映射、运行中走中断恢复 | T04、T08、T12 |
| 4 团队修改 → 快照不变 | T05、T07 |
| 5 工作流修改 → 旧 Run 用旧版本 | T06、T11 |
| 6 CLI 启动前失效 → Assignment 保持可编辑、不建 Session | T02、T09 |
| 7 CLI 运行中断连 → 保留引用进入恢复 | T12 |
| 8 员工在别的 WorkItem 执行 → 排队/改派/等待 | T10、T11 |
| 9 仅用于本次 → WorkItem Snapshot，不进资产库 | T05、T06、T07 |
| 10 保存到库 → 先建资产版本再引用 | T05、T06、T07 |

链路 A（已有+已有）→ T07；链路 B（新建+新建）→ T05+T06+T07；链路 C（节点执行）→ T09+T10+T11；链路 D（异常恢复）→ T12+T14。四链路的完整端到端脚本由 T17 串起来。

---

## 3. 波次与排程

### 3.1 波次表（A/B 两台机器）

| 波次 | 机器 A | 机器 B | 同步点（必须都合入 main 才进下一波） |
|---|---|---|---|
| W0（阻塞） | T01 契约与存储 | 等待 / 只做文档阅读 | `origin/main` 含 `src/v32/contracts.js`、store 测试全绿、T00-R1 门禁基线已恢复且只读探针通过（全量门禁在此同步点首次复跑） |
| W1 资产 | T02 CLI 池、T03 角色库、T05 团队库 | T04 员工档案、T06 工作流与 DAG | 四类资产 API + 页面可独立打开，资产域测试全绿 |
| W2 需求 | T07 Work Item 与五步向导 | T08 映射与并行冲突 | 能创建含快照+映射的 WorkItem；预检拒绝角色缺口 |
| W3 分配 | T09 Assignment 生命周期 | T10 两层会话与桥接 | `prepared` 无会话、`locked` 有会话；跨 CLI 不复用 Binding |
| W3b 执行 | T11 Run 编排与执行视图 | T12 恢复 A/B（按 T01 契约并行开发，W3b 同步点联调） | Task DAG 可跑到 succeeded；两种恢复都可验证 |
| W4 治理 | T13 人工门禁 | T14 产物/事件/审计/交付 | 人工节点无会话；交付可追溯 |
| W5 接入 | T15 路由聚合 | T16 桌面壳与文案 | `/v32/*` 全通；桌面可从导航进入全部 V3.2 页面 |
| W6 收口 | T17 17 条验收自动化 | T18 全量回归与门禁 | 17/17 通过；差集 0；门禁 exit 0 |

> **本表是静态建议，不是认领结果**：每次开工前必须按 §0.11.3 读共享台账判定实际状态（已认领 / 已完成 / 可认领）；若分配给自己机器的任务已被对方认领或完成，顺延到下一个 `available` 任务，禁止重复实现。两台机器执行同一套认领与审核流程。
>
> W3b 的 T12 与 T11 并行开发时，只能依赖 T01 契约 + `test/wp21/fixtures/v32-run.json` 假数据；不得提前引用 T11 未合入的函数签名。

### 3.2 同步点检查（每个波次结束执行）

```bash
git fetch origin && git switch main && git pull --ff-only origin main
NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-*.test.js"   # 必须检查 tests >= 当前已合入域的测试数
node scripts/desktop/gate.mjs --skip-tests
```

两机都在报告里写「同步点已过 + main sha」；若对方任务尚未合入，等待而不是自行实现对方能力。

---

## 4. 任务详单

---

### T00（前置，主线负责人）冻结基线并推送

- **分支**：不建功能分支，直接在 `main` 操作。
- **需求**（**严格按编号顺序执行**；R0-4 必须在 R0-1 的基线恢复提交之后，否则公布的 sha 不含门禁修复）：
  - **R0-1** 恢复门禁基线文件（`docs/iterations` 已在 `806d17c` 被删，`gate.mjs:24,89-93` 全量模式依赖它们）：
    ```bash
    mkdir -p docs/iterations/iteration-7 docs/iterations/iteration-10a
    git show 7b71cd4:docs/iterations/iteration-7/baseline-failures.txt \
      > docs/iterations/iteration-7/baseline-failures.txt
    git show 7b71cd4:docs/iterations/iteration-10a/baseline-failures-win32.txt \
      > docs/iterations/iteration-10a/baseline-failures-win32.txt
    git add docs/iterations/iteration-7/baseline-failures.txt \
      docs/iterations/iteration-10a/baseline-failures-win32.txt
    git commit -m "chore(v32): 恢复门禁基线文件"
    ```
  - **R0-2** 建 `docs/v32/reports/` 目录占位。
  - **R0-2b** 初始化 §0.11 的双机共享认领台账（**必须在 R0-4 公布 baseSha 之前**，否则两台机器开工时读不到台账）：
    ```bash
    mkdir -p docs/v32/claims
    printf '{"machine":"A","updatedAt":"","claims":[]}\n' > docs/v32/claims/machine-A.json
    printf '{"machine":"B","updatedAt":"","claims":[]}\n' > docs/v32/claims/machine-B.json
    git add docs/v32/claims/
    git commit -m "chore(v32): 初始化双机认领台账"
    ```
  - **R0-3** 确认本地 `main` 已含本规划、R0-1 与 R0-2b 提交，推送 `main` 到 `origin/main`。
  - **R0-4** `git rev-parse HEAD`，公布此时的 HEAD 作为**唯一 `baseSha`**（必须已包含 R0-1 的基线恢复提交）。
- **验证**：
  - `git rev-parse origin/main` 与公布的 `baseSha` 一致。
  - `node scripts/desktop/gate.mjs --skip-tests` exit 0（**注意**：`--skip-tests` 分支不读基线文件，通过不代表全量门禁可跑）。
  - 只读探针（必须执行）：`node -e "const fs=require('fs');['docs/iterations/iteration-7/baseline-failures.txt','docs/iterations/iteration-10a/baseline-failures-win32.txt'].forEach(f=>{if(!fs.readFileSync(f,'utf8').trim())throw Error(f+' empty')});console.log('baselines readable')"`。
  - `test -s docs/iterations/iteration-7/baseline-failures.txt` 且行数与 `git show 7b71cd4:docs/iterations/iteration-7/baseline-failures.txt | wc -l` 一致。
  - 台账只读探针（必须执行）：`node -e "const fs=require('fs');['A','B'].forEach(m=>{const p='docs/v32/claims/machine-'+m+'.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.machine!==m||j.claims.length!==0)throw Error(p+' invalid')});console.log('claims ready')"`。
- **完成**：两台机器都能从该 sha 建分支；两份基线文件已在 `origin/main` 上且只读探针通过；两份空台账已推送，可供 §0.11.3 读取。全量门禁首次可跑在 T01 合入后的同步点复验。

---

### T01（W0，阻塞全局）领域契约与 CAS 存储内核

- **分支**：`feature/v32-T01-contracts`
- **依赖**：无（必须最先合入）
- **需求描述**：
  - **T01-R1** 按 §1.3.1 导出全部常量：ID 前缀、四类状态枚举、资产状态、节点类型、审计类型；状态枚举必须与规格 §13 **逐字一致且不多不少**——Node Task 恰为 §13.4 的 12 态，**不得**出现原型里的 `waiting_queue` / `human_waiting`；Assignment 恰为 §13.5 的 6 态，无 `cancelled`。单测断言枚举数组与规格 §13 逐项相等。
  - **T01-R2** 实现 `validate(kind,obj)`：按 §1.3.1 对象表逐字段校验；额外强制「不该保存的字段」不存在（如 Employee 有 `cliId`、Team 有 `workflowId`、Workflow 节点有 `employeeId`、人工节点有 `cliId`）→ 返回 `V32_FORBIDDEN_FIELD`。
  - **T01-R3** 实现 `createV32Store()`：读 `.orch/v32/state.json`；不存在时按顶层结构初始化；`read()` 返回深拷贝；`get/list` 只读。
  - **T01-R4** `transit(mutator,{expectedRev,reason,actor})` 是唯一写入口：基于磁盘最新快照校验 `expectedRev`，不等则 `V32_REV_CONFLICT`；mutator 内改 draft；成功后 `rev+1`、原子写、再追加事件/审计，**最后**返回新快照；任何失败不得改内存状态。
  - **T01-R5** 事件/审计哈希链：`id` 分别为 `EVT-###` / `AUD-###`，`seq` 单调、`prevHash` 指向上一条、字段顺序规范化后 sha256；`verifyChain()` 可校验全链；`events()/audit()` 支持按 workItemId/runId/type 过滤与 limit。
  - **T01-R6** 每次 `transit` 若 `events` 中含 §1.3.1 `AUDIT_TYPES`，自动写入 `audit.jsonl`；人工审批 / 恢复 / 交付三类缺一不可。
  - **T01-R7** 提供 `test/wp21/fixtures/v32-*.json` 假数据：role、employee、team、workflow（含 agent+human 节点）、workItem、run、assignment；供后续并行任务使用，字段必须完全符合契约。
  - **T01-R8** `src/v32/index.js` **只导出 W0 已存在的模块，禁止 `export * from` 指向尚未创建的模块**（否则 W0/W1 任何 import 会 `ERR_MODULE_NOT_FOUND`）。强制规则：所有跨任务引用一律直接相对路径 import 具体文件，禁止 import `src/v32/index.js`；T15 从各 `*-routes.js` 直接汇总。index.js 的聚合导出由 T01 在 W5 统一补一次，其他任务不得编辑。
  - **T01-R9** ID 分配：`nextId(kind)` 只在 `transit` mutator 内可用，按该前缀现有最大序号 +1（不是数组长度），同一次事务内多次调用连续递增；生成后必须匹配 `ID_PATTERN`，重复返回 `V32_DUPLICATE_ID`。快照 ID 用 `snapshotId(kind, workItemId)`（`WF-SNAPSHOT-WI-001` / `TEAM-SNAPSHOT-WI-001`）。
  - **T01-R10** 状态迁移：导出 `TRANSITIONS` 与 `canTransition/assertTransition`；所有领域模块的状态写入必须调用 `assertTransition`，非法迁移返回 `V32_ILLEGAL_TRANSITION` 且**不落盘**。错误码只能取 `ERROR_CODES`。
  - **T01-R11** 快照：`snapshot(kind,id,version)` 返回 `{snapshotOf:{kind,id,version},capturedAt,definition}`，`definition` 是深拷贝；`transit` 保存后外部修改原对象不得影响快照；读取快照返回深拷贝。
  - **T01-R12** 事件类型只能取 `EVENT_TYPES`；`transit` 对未知事件类型返回 `V32_INVALID_INPUT`。事件 `refs` 只放相关 ID，缺失用 `null`，不得省略字段。
  - **T01-R13** `root` 必须是绝对路径；`read()` 在文件不存在时返回空结构且**不创建目录**；首次 `transit` 才创建 `.orch/v32/`。所有测试用临时 root，不得读写真实项目。
  - **T01-R14** 资产版本：`version` 用 `major.minor` 字符串，首次发布 `1.0`；之后每次 publish 递增 minor（`1.0→1.1`），`versions` append-only；同一版本不得重复发布，重复返回 `V32_DUPLICATE_VERSION`。
- **实现步骤**：① 常量与校验 → ② 原子写与 CAS → ③ 事件链 → ④ 夹具 → ⑤ 单测。
- **验证清单**：
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-contracts.test.js"`：断言禁止字段全部被拒、四类状态枚举与规格 §13 逐项相等（含「无 waiting_queue / human_waiting / assignment.cancelled」的反向断言）、非法迁移被拒、未知错误码/事件类型被拒。
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-store.test.js"`：断言并发 `transit` 只有一个成功、rev 递增、`expectedRev` 过期返回冲突、失败不改文件、并发 `nextId` 不重号、快照深拷贝隔离。
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-events.test.js"`：断言哈希链、顺序、过滤、审计自动写入。
  - 全量差集 0（对照 `origin/main` 基线树）。
- **完成定义**：三套单测全绿 + 夹具存在、经 `validate()` 校验通过、被 T01 自己的测试加载 + 报告落盘。「被 ≥2 个后续任务实际引用」移到 W2 同步点与 T18-R4 复核，不作为 W0 提交前置。

---

### T02（W1）CLI 资源池：真实扫描、能力与健康检查

- **分支**：`feature/v32-T02-cli-pool`
- **依赖**：T01
- **需求描述**：
  - **T02-R1**（P00 / §7.1）快扫与完整扫描两阶段：快扫发现路径与名称；完整扫描补齐版本、Adapter/协议、能力声明、健康状态、认证状态、会话恢复能力；扫描过程写 `cliPool.scan` 进度，界面可显示阶段。**探测不到的字段写 `unknown` 并注明原因，不得伪造为可用/已认证**。
  - **T02-R2** 复用 `src/adapter/cli-discovery/discover.js` 与 `probe.js`，**只读引用**；不把 `npx geiger-scan` 作运行时依赖。
  - **T02-R3** 扫描只更新 CLI 资源池；断言不创建 Employee / Team / Session / WorkItem。
  - **T02-R4**（§7.1 八项信息）手动添加路径：落库 `installs[]`，字段至少覆盖规格列出的名称/路径/版本/Adapter·协议/能力声明/健康状态/认证状态/会话恢复能力；`fingerprint` 算法、`source`、`stale` 为**实现约定**（规格未规定），用于去重与 Assignment 固定执行环境。
  - **T02-R5** 健康检查回写 `health`（§7.1 要求信息可见；四态枚举为实现约定）：失效 CLI 可被 Assignment 选中但启动预检必须拒绝（由 T09 消费）；探测不到的字段写 `unknown`，不伪造为可用。
  - **T02-R6** `GET /v32/cli/:id/capabilities` 输出能力矩阵，供节点能力预检（T07/T09）使用。
  - **T02-R7**（P00 页面）`desktop/ui/v32/cli-page.js` 展示扫描进度、发现/可用/异常数量、CLI 明细与「重新扫描 / 完整扫描 / 手动添加 / 健康检查」入口；文案键 `V32_CLI_*` 列表写入报告交 T16。
- **实现步骤**：① 包装发现层 → ② 扫描状态机 → ③ 路由片段 → ④ 页面 → ⑤ 单测（mock probe）。
- **验证清单**：
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-cli-pool.test.js"`：mock 4 个 CLI（2 可用、1 失效、1 unknown），断言 8 项信息齐全、快扫/完整扫描阶段事件、手动添加落库、fingerprint 去重、扫描不产生其它实体。
  - API 冒烟：起测试 daemon，`POST /v32/cli/scan` body `{mode:'quick'}` → 200 且 `scan.status` 从 `running` 到 `done`；`GET /v32/cli` 返回数组。
  - CDP 页面检查：`cli-page` 渲染后存在进度条与 3 行 CLI，无 CJK 字面量（跑 §0.7 正则自查）。
- **证据分级**：mock 实测（真实 CLI 探测依赖宿主，报告如实标注）。

---

### T03（W1）角色库（P09）

- **分支**：`feature/v32-T03-roles`
- **依赖**：T01
- **需求描述**：
  - **T03-R1** Role CRUD：字段按 §1.3.1；`duties/skills/inputs/outputs/acceptance` 均为数组，`requires` 用 `src/studio/schema.js:74 CAPABILITY_DIMENSIONS` 同款五维（只读引用，不改它）。
  - **T03-R2** 版本与状态：`draft→published→deprecated`；publish 生成新版本并写 `role.published` 审计；deprecated 不可被工作流节点引用。
  - **T03-R3**（实现约定，规格 P09 未要求）可选只读汇总 `GET /v32/roles/:id/refs`：返回被哪些工作流节点引用 / 哪些员工声明资格 / 哪些团队声明承担；不作为 P09 交付验收项。
  - **T03-R4**（P09）页面展示职责、技能、输入输出、能力要求、验收规则，支持新建/编辑/发布/停用；文案键交 T16。
- **验证清单**：
  - `test/wp21/v32-roles.test.js`：字段校验、非法迁移、发布新版本、停用后节点引用被拒、`refs` 汇总正确。
  - `GET /v32/roles` 与 `/:id/refs` 返回结构与契约一致。
  - 页面 CDP 打开无运行时错误；`ctx.t` 键无空值。

---

### T04（W1）员工档案（P08）

- **分支**：`feature/v32-T04-employees`
- **依赖**：T01（与 T03 可并行）
- **需求描述**：
  - **T04-R1** Employee 只保存身份、名称、说明、角色资格数组、启用状态；`validate` 已禁止 `cliId/teamId/sessionId`；本任务保证所有写路径都过 validate。
  - **T04-R2** 多角色资格：一名员工可声明多个 Role ID；`toggle` 只改 `enabled`，不改资格。
  - **T04-R3** 停用联动：返回 `affected` 列表（哪些团队含该成员、哪些 WorkItem 的未启动节点映射到此员工、哪些运行中任务在用），供 T08/T12 消费；**不自动改快照**。
  - **T04-R4**（P08）页面展示名称、Employee ID、说明、资格、启用状态；「加入的团队」只读；「当前任务 / 会话是否已创建」只在有运行态数据时展示；页面**不提供** CLI 或团队绑定入口。
- **验证清单**：
  - `test/wp21/v32-employees.test.js`：多资格写入成功、禁止字段被拒、停用返回 affected 且快照逐字不变。
  - API `POST /:id/toggle` 后断言 WorkItem 快照哈希不变。
  - 页面检查：不存在 `cliId` 输入控件。

---

### T05（W1）团队库与团队编辑器（P04 / P05）

- **分支**：`feature/v32-T05-teams`
- **依赖**：T01、T04（可先按契约并行，联调在 W1 同步点）
- **需求描述**：
  - **T05-R1**（§3.1）Team 定义含 ID/名称/描述/版本、成员列表、成员 Employee ID、团队内角色资格、主备与优先级、是否参与新分配、可选容量；**禁止** `workflowId` 与任何 CLI/Session 字段。规格 §3 并列提到「并发配置」但未给字段名/取值，第一阶段由 §8.4 全局串行策略承担，团队不保存并发字段；此为口径说明，不作规格符合性断言。
  - **T05-R2**（§3.2）成员可承担一个或多个角色；团队角色必须是员工全局资格的子集，超集返回 `V32_ROLE_NOT_QUALIFIED`。
  - **T05-R3**（§3.3）支持创建、编辑成员、增删成员、调整角色、主备/优先级、复制、发布新版本、停用；每次 publish 按 T01-R14 生成新版本并写审计。
  - **T05-R4**（P04）团队库展示名称/版本/说明/成员数/角色覆盖/成员明细/最近使用 WorkItem；**不显示**「适用工作流」，**不提供** CLI 配置。
  - **T05-R5**（P05）编辑器从员工档案勾选成员、逐人选择团队内角色、设置主备与优先级；保存产生新版本。
  - **T05-R6**（V32-03）同一团队可被多个不同工作流引用，团队对象不变。
  - **T05-R7**（§14-4）团队修改后既有 WorkItem 的 `teamSnapshot` 逐字不变。
  - **T05-R8**（§3.4 / V32-02）支持「保存到库」与「仅用于本次需求」；后者只进 WorkItem snapshot，不进入 teams[]。
- **验证清单**：
  - `test/wp21/v32-teams.test.js`：禁止字段、资格子集、主备优先级、publish 版本递增、deprecated 不可新用、copy 不共享引用、快照隔离。
  - API：`POST /:id/copy` 后原团队无变化；`GET /` 列表无 `workflowId` 字段。
  - 页面 CDP：团队库表格无「工作流」列；编辑器无 CLI 控件。
  - V32-03 断言：两个不同 workflow 的 WorkItem 引用同 team 版本。

---

### T06（W1）工作流库与 DAG 流程图编辑器（P06 / P07）

- **分支**：`feature/v32-T06-workflows`
- **依赖**：T01、T03（角色 ID 来源）
- **需求描述**：
  - **T06-R1**（§4.1）Workflow 定义含 ID/名称/描述/版本、节点 DAG、Agent 节点 Role ID、输入输出契约、验收条件、依赖、并行/汇合、条件分支、Human Task / Approval Gate、Handoff，以及 **Retry / Fallback / Escalation / Failure Policy 四项并列策略**（四项缺一不可，§4.1 L173–L175）；**禁止** Employee ID / Team ID / CLI。
  - **T06-R2**（§4.2）Agent 节点按 `index.md` §4 的 **10 项**字段齐全（输入/输出契约合并计一项，物理字段 `inputs`、`outputs` 均实现；`page_spec.md` 拆成 11 项，验收按 `index.md`）；含 `escalation` 承载的升级策略；缺任一字段 validate 拒绝。
  - **T06-R3**（§4.3 / V32-16）Human 节点只有 `human:{approver,condition}` 与契约字段；`approver` 只放 Role ID 或审批岗位，**不得放具体 Employee ID**；禁止节点级 `roleId/employeeId/cliId/sessionId`、禁止 `mode`/`timeout`（规格未给人工节点审批方式与超时）；人工节点不参与员工映射。
  - **T06-R4**（P06）库列表展示名称/版本/用途/节点数/Agent 与人工节点数/主要阶段与并行关系/内置·草稿·已发布；支持编辑、复制、发布新版本、用于新需求。
  - **T06-R5**（P07）编辑器支持：画布定义 DAG；Agent 节点选 Role ID；Human 节点定义审批人/条件；配置依赖、并行、汇合、条件、输入输出、验收、失败策略；**不出现**员工/团队/CLI 选择。
  - **T06-R6** 后端 `src/v32/graph.js` 只做纯计算：`layoutDag` 按依赖层级布局、`validateDag` 检测未知依赖与环；前端 `desktop/ui/v32/graph.js` 做 `renderGraph`，支持 definition/runtime/edit 三模式、缩放 50%–200%、适应画布、拖动平移、点选、上下游高亮。规格 P07/P11 只要求「画布定义 DAG / 提供视图」，**交互细节（三模式、缩放比例、高亮）是实现约定，参考原型 `showWorkflowDag / graphHTML / graphRefresh / graphAutoLayout` 的形态，不作为规格符合性断言**。两者共享同一份 `{level,order}` 布局数据，不各自发明排序。
  - **T06-R7**（§4.4 / V32-04）工作流可被多个团队复用；对象内无 Team/Employee 字段；DAG 图模式可渲染。
  - **T06-R8**（V32-15 / §14-5）修改按 T01-R14 发布新版本；既有 WorkItem 快照与运行中 Run 继续用旧版本。
  - **T06-R9**（V32-02）支持「保存到库」与「仅用于本次需求」。
- **验证清单**：
  - `test/wp21/v32-workflows.test.js`：按 `index.md` §4 的 10 项字段校验、禁止字段、human 节点约束、publish 版本、快照隔离、四种复用来源。
  - `test/wp21/v32-dag.test.js`：环检测、未知依赖、并行分支标注、三种模式渲染函数存在。
  - API `GET /v32/workflows/:id/graph` 返回布局后的 nodes/edges；CDP 打开编辑器，图有箭头与并行标签。
  - `python3 -c` 零 CJK 自查：`src/v32/workflows.js`、`src/v32/graph.js`、`desktop/ui/v32/workflows-page.js`。

---

### T07（W2）Work Item 与五步创建向导（P01 / P02 / P03）

- **分支**：`feature/v32-T07-work-items`
- **依赖**：T02–T06（W1 全部合入）
- **需求描述**：
  - **T07-R1**（§5 正文）Work Item 字段齐全：Work Item ID、标题、需求描述、背景与目标、项目/工作空间、输入附件和参考资料、优先级、创建人和创建时间、Workflow Snapshot 及版本、Team Snapshot 及版本、Node Executor Plan、当前 Workflow Run；创建后 `status='configured'`；两快照固化所选版本，`nodeExecutorPlanId` 指向独立建模的执行方案对象（§1.1 十个核心对象之一）；`runId` 指向新建 Run，`historyRuns=[]`，`deliveryRecord=null`。
  - **T07-R2**（§5.2 / 链路 A/B）四种组合全部可用：已有+已有、已有+新建、新建+已有、新建+新建；新建资产可选「仅本次」（进 snapshot 不进资产库）或「保存到库」（先建资产版本再引用）。
  - **T07-R3**（§5.2 / P02）五步向导严格为：①需求信息（标题/描述/背景/目标/项目目录/附件）②工作流③团队④节点执行人映射（调用 T08 面板）⑤预检确认（覆盖、员工有效性、并行冲突、CLI 能力、输入资料）。
  - **T07-R4**（§6.2 / V32-06）`preflight` 返回逐项结果；角色未覆盖返回 `V32_ROLE_GAP` 并列出缺失角色，阻止创建；员工失效返回 `V32_INVALID_INPUT`；CLI 资源池无法覆盖节点能力时返回 `V32_CLI_CAPABILITY_GAP` 并提示先扫描/添加 CLI，阻止创建。**预检只检查能力覆盖，不创建 Assignment，也不要求此刻选定具体 CLI**（与 V32-08 一致）。
  - **T07-R5**（V32-08）创建时只建 Task DAG，**不创建** Assignment / Employee Session / Host Binding；断言三者数量为 0。`workflowSnapshot/teamSnapshot` 按 §1.3.1 深拷贝结构保存，禁止只存 ID 或引用。
  - **T07-R6**（§13.1）状态机：创建过程 `draft→configured` 原子完成；用户点「启动」`configured→ready_to_run`（激活 R1 创建时已建的 Run，不再新建，也不直接建会话）；`ready_to_run→running` 由 T11 的首个任务启动触发；`waiting_human/blocked` 由 T11 触发；`ready_for_acceptance` 只由 T11 在所有 Task `succeeded` 后设置；`accepted→delivered` 由 T14 触发；`cancelled` 可从非终态进入；非法迁移拒绝。
  - **T07-R7**（P01）工作台展示需求数量、执行中、待人工、待验收；列表含标题/关联工作流/团队/状态/创建时间。
  - **T07-R8**（P03）详情页展示需求内容、Workflow Snapshot、Team Snapshot、Node Executor Plan、当前与历史 Run、产物与事件入口；提供流程视图 / 节点列表 / 执行历史；显示「执行方案快照」与「修订」入口（修订逻辑 T11 提供）。
  - **T07-R9**（§14-9/10）仅本次的资产不进入公共库；保存到库的资产先有版本号再被引用。
- **验证清单**：
  - `test/wp21/v32-work-items.test.js`：14 字段、四组合、快照隔离、创建后零 CLI/零 Session、状态机非法迁移。
  - `test/wp21/v32-preflight.test.js`：五类检查逐项通过/失败；角色缺口文案含缺失角色名（来自 mock 夹具）。
  - CDP：五步向导可从第 1 步走到第 5 步并返回；预检失败时「创建」按钮 disabled。
  - V32-01/02/06/08 断言在 T17 中可复用。

---

### T08（W2）节点执行人映射与并行冲突（§6）

- **分支**：`feature/v32-T08-mapping`
- **依赖**：T01（与 T07 并行；W2 同步点与向导第 4 步联调）
- **需求描述**：
  - **T08-R1**（§6.1 / §1.1）映射写入独立 `NodeExecutorPlan` 对象（由 WorkItem `nodeExecutorPlanId` 引用），属于本次 Work Item 执行方案，**不写回** Workflow / Team；结构 `{[nodeId]: employeeId|null}`；human 节点固定 `null`（§6.2）。
  - **T08-R2**（§6.2）候选只来自本次团队快照的成员；成员必须具备节点 Role ID 资格；唯一候选自动预选；多候选按 `priority` 预选且可改；无候选返回 `V32_NO_CANDIDATE` 并提示补成员/调资格。
  - **T08-R3**（§6.3 / V32-07）并行判定使用**可达闭包**：两节点互不可达才算并行，传递依赖不得误报；同一员工被映射给并行节点时返回警告 `V32_SERIAL_QUEUE`，提示「同一员工将串行处理这两个节点」，可改派或接受排队。
  - **T08-R4**（§6.4）节点未启动可改映射并写 `plan.revised` 审计；已启动节点不可覆盖当前 Attempt 执行者，须先中断/结束再新建 Assignment，新分配默认沿用原检查点与 Artifact References（§9 策略 B），不新增「是否继承」的必填交互；已完成节点历史执行者不可变。
  - **T08-R5**（§14-3）团队成员停用时：未启动节点映射标记为需重映射，运行中节点不自动改，交给 T12。
  - **T08-R6**（P02 第 4 步）`desktop/ui/v32/mapping-panel.js` 展示节点 → 候选成员下拉、并行冲突提示、改派/排队选择；Human 节点显示「不分配员工」。
- **验证清单**：
  - `test/wp21/v32-mapping.test.js`：候选资格、优先级预选、无候选拒绝、可达闭包并行判定（含 A→B→C 时 A/C 不算并行）、改派与排队、启动后改映射被拒、审计写入。
  - `GET /v32/mapping/:workItemId/conflicts` 返回冲突清单与建议。
  - CDP：向导第 4 步两个并行节点映射同一员工时出现串行提示。

---

### T09（W3）Task Assignment 生命周期与 CLI 选择（P12 / §7）

- **分支**：`feature/v32-T09-assignments`
- **依赖**：T07、T08、T02
- **需求描述**：
  - **T09-R1**（§7.2）节点进入 Ready 后创建 Assignment，规格 11 项齐全（Task ID 与 Node ID 合并计一项，对应 12 个字段）；员工默认取 Node Executor Plan，可在本次团队内改选符合角色的成员；CLI 从本机资源池选且必须满足节点 `capabilities`；设置工作目录与权限快照；输入产物引用来自上游 Artifact。
  - **T09-R2**（§7.3 / §13.5）状态机 `draft→prepared→preflight→locked→released`，失败进 `failed`；`prepared` 可改员工与 CLI；`locked` 后禁止修改（返回 `V32_ASSIGNMENT_LOCKED`）；`released` 在任务结束/取消时写。
  - **T09-R3**（V32-10）保存 Prepared **不创建** Employee Session / Host Session；断言 `sessions.employees` 与 `hostBindings` 数量不变。
  - **T09-R4**（V32-09 / V32-12）CLI 选择按能力匹配；更换 CLI 只影响本次 Assignment，Employee Profile 与 Team 定义逐字不变；失效 CLI 在 preflight 阶段拒绝，Assignment 保持 `prepared` 可编辑。
  - **T09-R5**（§6.3 / §14-2 / V32-07）占用冲突：目标员工正执行其它任务时提供「改派」与「保留并排队」；选择排队后在 `Run.queue` 追加 `{taskId,reason,queuedAt}` 标记（规格 §6.3 只要求 Scheduler 排队，**未定义 Task 状态**，禁止用原型的 `waiting_queue`），Task 保持 `assignment_prepared`、Assignment 保持 `prepared`（不 `locked`、不建 Session），员工释放后出队重新走 `preflight→locked`；**禁止**并发写同一 Employee Session。
  - **T09-R6**（P12）面板展示节点角色要求、合格成员（默认选中映射成员）、本机 CLI 候选及能力、会话计划（创建/复用/唤醒/恢复）、「保存 Prepared」「保存并启动」；启动按钮走 `preflight→locked` 并写 `assignment.locked` 事件；会话创建由 T10/T11 消费事件完成，**T09 不直接调用 T10 函数**。
  - **T09-R7** Assignment 每次状态变化写事件，`locked` 写审计。
- **验证清单**：
  - `test/wp21/v32-assignments.test.js`：11 字段、能力过滤、prepared 可改、locked 拒改、prepared 零会话、失效 CLI 拒绝、排队不并发；**反向断言** Assignment 写入前后 Employee Profile 与 Team 快照逐字不变，且 Assignment 对象不含员工档案/团队定义字段（§1.2 / V32-12）。
  - API：`POST /prepare` → 200 且 status=prepared；`POST /start` → locked 且写出 `assignment.locked` 事件（T09 单独可验证）；「事件被消费并创建会话」移到 W3 同步点联调项，不作为 T09 单独提交的前置。
  - CDP：面板默认选中映射成员；CLI 下拉只出现能力匹配项。

---

### T10（W3）两层会话与 ACP 桥接（§8）

- **分支**：`feature/v32-T10-sessions`
- **依赖**：T01、T09（与 T09 并行开发，W3 同步点联调）
- **需求描述**：
  - **T10-R1**（§8.1）以下操作**都不创建会话**：创建 Employee Profile、加入团队、创建 Work Item、选工作流/团队、保存映射、保存 Prepared；每条都有单测断言。
  - **T10-R2**（§8.2）Employee Session 是员工长期逻辑身份；Host Binding 按 CLI/Adapter 维护；跨 CLI **不得**复用 Host Session ID；同一 Employee Session ID 在不同 CLI 下可有多个 Binding。
  - **T10-R3**（§8.3）节点启动 8 步：读执行员工 → 查 Employee Session → 无则创建 → 按 CLI 查 Binding → 兼容可恢复则唤醒 → **正常启动路径**下无可用 Binding 才新建 Binding → 记录 Host Session ID → 创建 Attempt 并写事件。恢复路径（T12）必须走 T10-R9：原宿主不可恢复就报错，不得在这里回落到新建。
  - **T10-R4**（§8.4 / §14-8）员工在别的 WorkItem 执行时：排队 / 选备选成员 / 用户改派；同一员工同一时刻只允许一个前台 Attempt；不引入子会话。
  - **T10-R5** `src/v32/bridge.js` 按 §1.3.4 封装既有 adapter，**不改** `src/adapter/**` / `src/core/**`；ACP 方言差异收敛在 bridge 内；公开活动只取宿主状态/工具/文件/命令/产物事件，不取私有推理。
  - **T10-R6**（P14 部分）`session-panel.js` 展示 Employee Session ID、Host Binding 历史（CLI/Adapter/Host Session ID/恢复能力/状态）、Attempt 列表；无会话时显示「节点启动后创建」。
  - **T10-R7** 会话创建/唤醒写事件，创建写审计。
  - **T10-R8** `src/v32/host-profile.js`：按 `Assignment.cliInstallationId` 生成 `.orch/hosts/v32-<installId>.json`（`launch.command/args/env` 来自 CLI 资源池），只写 `v32-` 前缀，绝不覆盖用户配置；`createHost` 用 `createAdapterFactory({root,hostId}).create({cwd})` 建**新**会话。
  - **T10-R9** `wakeHost` **不得**用 `factory.create`（它总是 `newSession`）：必须 `createStdioTransport + createAcpClient → initialize → canResume?resumeSession:canLoad?loadSession`；两者都不可用返回 `V32_RECOVERY_UNAVAILABLE`，不得回落 `newSession`（回落是策略 B，由 T12 显式触发）。
  - **T10-R10** 同一员工并发：store 中维护/派生 `activeAttemptId`；同一员工已有 `running` Attempt 时，新启动返回 `V32_SESSION_CONFLICT`，由 T09/T11 转为排队或改派；不得靠 UI 禁用冒充约束。
- **验证清单**：
  - `test/wp21/v32-sessions.test.js`：6 种不建会话操作、8 步启动顺序、跨 CLI 新 Binding、同员工并发被排队、Attempt 关联正确。
  - `test/wp21/v32-bridge.test.js`：mock transport/adapter 下 `createHost` 走 factory/create，`wakeHost` 走 `initialize→resume/load` 且两者不可用时报 `V32_RECOVERY_UNAVAILABLE`（不回落到 newSession），host profile 只写 `v32-` 前缀且不覆盖既有文件。
  - API `GET /v32/sessions/:employeeId` 与 `/bindings` 结构正确。
  - 运行时错误 0；纯 CJK 自查通过。

---

### T11（W3b）Workflow Run 编排、执行视图与活动流（P10 / P11 / P13）

- **分支**：`feature/v32-T11-runs`
- **依赖**：T09、T10（与 T12 并行开发）
- **需求描述**：
  - **T11-R1**（§13.4，严格 12 态）Task 状态机完整实现；上游依赖未完成不可 `ready`；`succeeded` 后解锁下游；人工节点停在 `ready`、WorkItem 进入 `waiting_human`（§13.1）等 T13 审批；异常进 `interrupted/blocked/failed/cancelled/skipped`；排队由 T09 写 `Run.queue` 标记，**不引入规格外 Task 状态**。
  - **T11-R2**（链路 C）执行步骤：Ready → 读映射 → 成员有效性/空闲检查 → 确认员工 → 选 CLI → Prepared → 启动 → Locked → 建会话 → Attempt → 活动展示 → 完成验收与下游推进。
  - **T11-R3**（§14-4/5）团队/工作流资产修改后，Run 继续使用创建时版本快照；成员停用时未启动节点标记需重映射。
  - **T11-R4**（P10）执行中心列表：Run ID、Work Item、Workflow 版本、Team 版本、状态、完成率、Ready/执行中/中断/人工待处理数量；实时计算完成率（不能用硬编码）。
  - **T11-R5**（P11）执行视图：按节点展示名称/Role/计划与实际执行人/状态/CLI（Assignment 完成后才显示）/员工会话状态（创建后才显示）/最近活动；提供任务表格与事件时间线（规格明列的三类视图）；默认进入流程图模式（复用 T06 `renderGraph` 的 `runtime` 模式，属实现约定），线性视图保留。
  - **T11-R6**（P13）活动面板：员工身份、所属团队/角色、当前 WorkItem/节点/CLI、Employee/Host Session ID（存在才显示）、Attempt、开始时间、运行时长、最近活动；只展示公开事件；由事件/Attempt/产物动态生成，不用静态文案。
  - **T11-R7**（P03 修订入口）执行方案修订：未启动节点可改映射，旧 Run 归档到 `historyRuns`、`planRevisions` 追加、新建 Run 并更新 `workItem.runId`；已完成节点历史不变。
  - **T11-R8**（P14）任务详情：Task ID、Node ID、Role、计划/实际执行人、Assignment 历史、Attempt 历史、Employee Session、Host Binding 历史、产物/Handoff/错误证据。
  - **T11-R9** 所有状态迁移写事件，关键迁移（启动/完成/人工等待）写审计。
  - **T11-R10** `advanceRun(runId: string) → {ok:true,value:{run,advanced:number}} | {ok:false,code,params}` 是**幂等**的推进入口（跨任务唯一签名，T09/T12/T13 均按此调用）：读当前 Run/Task/事件，只推进满足条件的节点；重复调用不得重复建 Assignment、不得重复写同一事件；并发调用以 `store.transit(expectedRev)` 串行化，冲突时重读重试一次。T09 发 `assignment.locked` 事件（T01 `EVENT_TYPES` 已定义），T10/T11 消费该事件推进；**不定义额外的「通知」回调接口**。
  - **T11-R11** `ready_for_acceptance` **只由 T11** 在所有 Task 均为 `succeeded` 后设置；T13 的人工批准只调用 `advanceRun`，不得自行改 WorkItem 状态。WorkItem 进入该状态时写 `work_item` 事件与审计。
- **验证清单**：
  - `test/wp21/v32-runs.test.js`：依赖解锁、非法迁移、完成率计算、快照隔离、修订归档与 runId 更新、活动面板由事件生成。
  - API：`GET /v32/runs` 列表字段；`POST /:id/tasks/:taskId/complete` 后下游变 `ready`。
  - CDP：执行中心默认显示流程图；节点状态着色；点击节点打开任务详情与会话信息。
  - V32-15 断言：发布新版本后旧 Run 快照哈希不变。

---

### T12（W3b，可与 T11 并行开发）中断恢复 A/B（P15 / §9）

- **分支**：`feature/v32-T12-recovery`
- **依赖**：T01 契约 + `test/wp21/fixtures/v32-run.json` 假数据；T11 的 `advanceRun` 只在 W3b 同步点联调（不提前引用未合入实现）
- **需求描述**：
  - **T12-R1**（§9）中断保留 **逐字照抄规格的 11 项**：① Work Item ID ② Workflow Run ID ③ Task ID ④ Assignment ID ⑤ Employee ID ⑥ CLI Installation ID 和 Fingerprint（算一项）⑦ Employee Session ID ⑧ Host Session ID ⑨ Attempt ID ⑩ 最后活动事件 ⑪ 检查点和已生成产物（算一项）；缺一项即失败。
  - **T12-R2**（策略 A）恢复原宿主：必须选原 CLI；检查原 Host Session 存在、兼容、支持恢复；成功则**继续原 Attempt**并回写 Binding 状态；任一项不满足保持 `interrupted`，写 `recovery.failed` 审计，**禁止静默降级**为策略 B。
  - **T12-R3**（策略 B）检查点恢复：允许选另一 CLI；沿用 Employee Session ID；新建 Host Binding；新建 Attempt 并写 `resumedFrom` 指向原 Attempt；把检查点与 Artifact References 作为恢复上下文；写 `recovery.succeeded` 审计。
  - **T12-R4**（§14-7）CLI 运行中断连：保留 Attempt 与 Host Session 引用，进入恢复流程，不得清空。
  - **T12-R5**（P15）面板展示原 CLI、Host Session ID、恢复能力、最后活动、检查点，以及两种恢复策略的明确入口与失败后的诊断信息。
  - **T12-R6** 恢复完成后重新触发依赖检查（通知 T11）。
- **验证清单**：
  - `test/wp21/v32-recovery.test.js`：11 项保留；策略 A 成功/失败两路；策略 B 新 Binding 新 Attempt 且 Employee Session ID 不变；跨 CLI 不复用 Host Session ID；失败保持 interrupted 且有审计。
  - API：`GET /:taskId/options` 返回两种策略及可用性；`POST /recover-original` 在不可恢复时返回 `V32_RECOVERY_UNAVAILABLE` 且状态不变。
  - CDP：恢复面板显示原 CLI 与检查点；失败时提示保持中断。
  - V32-13/14 断言交给 T17。

---

### T13（W4）人工节点与审批门禁（§4.3 / P07 / P16）

- **分支**：`feature/v32-T13-human-gates`
- **依赖**：T06、T11
- **需求描述**：
  - **T13-R1**（§4.3 / P07）Human Task / Approval Gate 定义：`node.human` 只含 `approver`（Role ID 或审批岗位，**禁止具体员工 ID**）与 `condition`（人工补充输入条件）；规格未定义审批方式（会签/或签）、超时默认动作与「升级」异常分支，不实现为需求也不落为字段。
  - **T13-R2**（V32-16）人工节点**不分配员工、不分配 CLI、不创建 Employee Session / Host Binding / Attempt**；批准动作只改 Task 状态并写审计。
  - **T13-R3** 审批校验：审批人身份/角色必须符合 `node.human` 定义；不符合返回 `V32_APPROVER_INVALID`；驳回按 §14-3（未启动节点重映射、运行中节点走中断恢复）处理，不自造「升级」分支。
  - **T13-R4** 批准后：Task 从 `ready` 迁到 `succeeded`（规格 §13.4 无 `human_waiting` 态），调用 T11 的 `advanceRun` 解锁下游，WorkItem 退出 `waiting_human`；**不得**自行把 WorkItem 置为 `ready_for_acceptance`（该状态唯一 owner 是 T11）。
  - **T13-R5**（P07 编辑器）Human 节点属性区只可配置审批人（Role ID / 审批岗位）与人工条件，且不出现员工 Agent 分配、具体员工 ID 或 CLI 控件；不出现审批方式与超时控件。
  - **T13-R6** 审批/驳回均写 `human.approved` 类审计事件，可追溯审批人与时间。
- **验证清单**：
  - `test/wp21/v32-human.test.js`：零 Session/零 CLI、审批人校验、批准解锁、驳回分支、审计写入。
  - API：`POST /:taskId/approve` 无效审批人返回 409/400 且不改状态。
  - CDP：人工节点详情无 CLI/Session 字段；批准后流程图节点变绿。

---

### T14（W4）产物、事件、审计与交付验收（P16 / §13.1）

- **分支**：`feature/v32-T14-delivery`
- **依赖**：T11、T12、T13
- **需求描述**：
  - **T14-R1**（P16）Artifact 可追踪七维：WorkItem、Workflow Run、Task、Employee、CLI、Attempt、Handoff；`GET /artifacts/:id/trace` 返回完整链路与事件引用。
  - **T14-R2**（P16）事件记录覆盖：团队/工作流版本选择、节点映射、Task Assignment、会话创建与恢复；人工审批、异常恢复、交付验收**必须**写审计（与 T01 审计类型对齐）。
  - **T14-R3**（§13.1 / V32-17）交付验收：T14 独占 `POST /v32/records/:workItemId/deliver`；`ready_for_acceptance→accepted→delivered`（先 accepted 再 delivered，逐次写事件）；V32-17 只要求「产物、测试、风险和人工验收记录可追溯」，因此 `deliveryRecord` 是**实现载体**（建议含 artifacts/tests/risks/acceptedBy/acceptedAt），断言落在可追溯链与审计事件上，**不把固定字段模板或 `V32_DELIVERY_INCOMPLETE` 当规格要求**。
  - **T14-R4** 需求详情产物卡片：展示本 WorkItem 全部 Artifact（名称/ID/类型/节点/Task/Employee/CLI/Attempt/Handoff）与「溯源」入口。
  - **T14-R5**（P16）记录页：产物表、事件时间线（结构化表格：时间/类型/对象/操作者/载荷摘要）、审计链校验状态；支持按 WorkItem 过滤。
  - **T14-R6** 事件/审计只读；不得提供删除入口；哈希链校验失败时页面显示明确告警。
- **验证清单**：
  - `test/wp21/v32-delivery.test.js`：状态迁移、deliveryRecord 字段、审计写入、非法迁移拒绝。
  - `test/wp21/v32-audit.test.js`：七维溯源、事件过滤、哈希链校验、三类必须审计事件存在。
  - API：`GET /v32/records/artifacts/:id/trace` 返回七维非空（人工节点产物允许 Employee 为空）；`POST /v32/records/:workItemId/deliver` 缺产物/测试时返回 `V32_DELIVERY_INCOMPLETE` 且状态不变。
  - CDP：记录页表格可读、无横向溢出；交付弹窗字段齐全。

---

### T15（W5）HTTP 路由聚合与 API 契约测试

- **分支**：`feature/v32-T15-api`
- **依赖**：T02–T14 全部路由片段
- **需求描述**：
  - **T15-R1** 新建 `src/daemon/http/v32-routes.js`：`createV32Routes({root})` 汇总所有片段，统一错误响应与 JSON 头，统一 404/405；**构造期零 IO**，store 在首次请求时懒创建并缓存，并把同一个 `{store, root}` 注入各片段（片段不得各自 new store）。
  - **T15-R2** 按 §1.3.2 的「精确挂载点」改 `src/daemon/http/routes.js`（import + `const v32Routes` + `routes.push(...v32Routes)`）；**不得改动** `shapeSnapshot`、既有路由顺序或 `attachLazySeams`。构造异常会让 `http/server.js:263-284` 静默退化为 503，必须避免。
  - **T15-R3** 统一请求校验：所有 POST/PUT body 走契约 validate；错误码与 HTTP 状态映射固定（400 校验 / 404 不存在 / 409 状态冲突）；响应体统一 `{ok:false,code,params}`。
  - **T15-R4** `test/wp21/v32-api-contract.test.js` 逐条打 §1.3.2 路由表，断言状态码与响应形状；已有片段缺失时只报告缺哪条，不替别人实现。
- **验证清单**：
  - `test/wp21/v32-api-contract.test.js` 全绿（路由表条数 = 表中条数）。
  - `GET /ui/labels` 仍 200；既有 `/instances`、`/workflows` 契约逐字回归。
  - `node scripts/desktop/gate.mjs --skip-tests` exit 0。

---

### T16（W5）桌面壳集成、导航与零 CJK 文案

- **分支**：`feature/v32-T16-shell`
- **依赖**：T15 + 全部页面模块（可依 §1.3.3 契约并行开发页面，联调在 W5 同步点）
- **需求描述**：
  - **T16-R1**（§11）导航按「启动与资源 / 需求工作台 / 执行中心 / 团队库 / 工作流库 / 员工档案 / 角色库 / 产物与事件 / 系统设置」分组；在 `desktop/ui/shell/nav.js` 注册 V3.2 view，保留历史 view ID 兼容既有深链。
  - **T16-R2** `desktop/ui/v32/index.js` 汇总页面模块；`desktop/ui/shell/index.js` 的 `PAGE_BY_VIEW` 增加 V3.2 view；`desktop/ui/app.js` 增加 `state.v32`、`loadV32(view,params)`，并在 `handleAction` 增加 `v32-*` 分派。页面 `render(ctx)` 返回 DOM 节点（与现有 `pages.js` 一致），只消费 `ctx.v32.data`，不在 render 内 fetch；`loadV32` 负责取数后 `paint()`。
  - **T16-R3** V32 文案键**必须作为 `src/cli/labels.js` 的 `DESKTOP_V2_LABEL` 成员追加**（`src/daemon/http/labels.js:347` 已展开该表，自动经 `GET /ui/labels` 下发），**不得**在 `src/daemon/http/labels.js` 另建 `V32_LABEL` 并 spread（会撞 `test/wp13/labels-desktop.test.js:776` 与 `test/wp14/labels-drill.test.js:367-372` 的精确计数冻结断言）。同步追加到 `EXPECTED_V2_KEYS` / `EXPECTED_V2_VALUES`（append-only，既有行逐字不变）。**键必须真被下发**，否则空表头/空按钮。
  - **T16-R4** 零 CJK：V3.2 新增源码（含注释）用 `python3 -c` 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]` 扫描为 0；变量不得叫 `editor`（31 词禁表，按整词扫）；分隔符用空格或 `·`。
  - **T16-R5** 输入控件带 `data-field`；动作在 `pointerdown` 响应且同时派发 `click`（600ms 去重窗口）；导航锚点唯一化（`.sidebar [data-section=…]` / `.secbar .sec-tab[data-tab=…]`）。
  - **T16-R6** V3.2 若调用任何 mutator（现有 `updateStudio` / `atomicWrite` 位于 `src/studio/**` 与 `src/registry/**`，**不在** `desktop/ui/app.js`），只消费返回的 `.value`，所有写操作必须 await；**不得修改** `src/studio/**` 与 `src/registry/**`（只读共享模块）。
  - **T16-R7** 页面视觉统一：V3.2 页面直接使用主壳标签栏与样式；规格 §11 要求 9 组一级导航在同一信息架构下，不得出现 iframe 内另一套视觉。在 `desktop/ui/index.html` 增加 `<link rel="stylesheet" href="./v32/v32.css">`（该文件当前只有 `./theme.css`，不加载则样式不生效；index.html 归 T16 独占）。
  - **T16-R8** `test/wp13/v32-shell.test.js`：从导航进入 9 个分组，断言**唯一正面标记** `[data-view="v32-*"]` 存在且 `DESKTOP_V2_EMPTY` 空态节点不存在（现有 `shell/index.js:62-72` 会吞掉 render 异常并回退空态，仅检查「非空」会假绿），动作可触发、`data-field` 存在；旧 5 组与历史 view 深链仍可进入。
  - **T16-R9** 9 组导航扩展必须同步更新所有冻结断言（尤其 `test/wp13/labels-desktop.test.js` 的键总数与值表）；新增键只追加，既有键值逐字不变；若某旧测试无法在不放松断言的前提下兼容，报告 `BLOCKED` 由主线裁决。
  - **T16-R10** `PAGE_BY_VIEW` 新增 view 后，`fallbackPage` 不得被误用；未装载数据时页面显示明确的 loading/empty 状态，不能白屏。
  - **T16-R11** `scripts/verify-v32-ui.mjs`：起真实桌面壳（沿用 `scripts/verify-nav.mjs` 的 CDP 起法与 `MAESTRO_CONFIG_DIR` 隔离），逐页点击 9 组导航，断言 `[data-view="v32-*"]` 唯一锚点、无 `DESKTOP_V2_EMPTY` 空态、无 console error / runtime exception，输出逐页 PASS/FAIL 与截图路径到 `docs/v32/reports/raw/T16/`。同时把 `verify-nav.mjs:152-164`、`verify-scenarios.mjs:147-153,219-226`、`verify-desktop-boot.mjs:155,161` 的「恰好 5 段 / extra 为空」改为「原 5 段标签与顺序不变 + 新增 4 段可进入」；不得放宽旧断言为任意数量。
- **验证清单**：
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-labels.test.js" "test/wp13/v32-shell.test.js" "test/wp13/labels-desktop.test.js"` 全绿。
  - `python3 -c` 零 CJK 自查（对 `desktop/ui/v32/**`、`src/v32/**` 新增文件）。
  - `node scripts/verify-v32-ui.mjs` 逐一打开 9 个导航入口（T16 独占脚本，输出各页唯一 `[data-view]` 锚点、console error/runtime exception 硬失败）；截图落 `docs/v32/reports/raw/T16/`，核对浅色布局无溢出；`npm run verify:nav` 无新增红。
  - `GET /ui/labels` 返回所有 `V32_*` 键且值非空；键总数按 `test/wp13/labels-desktop.test.js:776` 的实际断言：`312 + EXPECTED_V2_KEYS.length + ROLE_LABEL`（V32 键已含在 `EXPECTED_V2_KEYS.length` 内，不重复加）。

---

### T17（W6）V32-01～17 验收自动化

- **分支**：`feature/v32-T17-acceptance`
- **依赖**：T16
- **需求描述**：
  - **T17-R1** `scripts/verify-v32.mjs`：用 `fs.mkdtempSync(os.tmpdir(),'v32-accept-')` 建隔离项目，`spawn(process.execPath, [src/daemon/serve-entry.js, '--project', root, '--desktop'])` 起真实 daemon，`HOME`/`USERPROFILE`/`MAESTRO_CONFIG_DIR` 全部指向临时目录（禁止污染真实 `~/.maestro/projects.json`）；从 `<root>/.orch/desktop.json` 读 port/token，通过 HTTP API 依序执行 17 条用例，每条输出 `PASS/FAIL` 与关键状态片段；结束 kill daemon 并清理临时目录。
  - **T17-R2** 17 条用例严格按 §2.4 的场景与通过标准断言；**不得只检查文字存在**，要检查对象字段、状态与事件。
  - **T17-R3** 覆盖四链路 A/B/C/D 的端到端脚本：A（已有+已有）、B（新建+新建）、C（Ready→Assignment→Session→完成）、D（中断→恢复 A 失败→恢复 B 成功）。
  - **T17-R4** 断言禁止硬编码测试条数；用 `fail=0 && pass===tests && tests>=17`。
  - **T17-R5** `package.json` 只加一条 `"verify:v32": "node scripts/verify-v32.mjs"`；不改其它 script。
  - **T17-R6** `test/wp21/v32-acceptance.test.js` 以单元测试形式覆盖同一组断言（不依赖 GUI），供门禁使用。
- **验证清单**：
  - `npm run verify:v32` → 17/17 PASS，退出码 0。
  - `NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-acceptance.test.js"` 全绿。
  - 报告 `docs/v32/reports/acceptance.md` 含逐条结果与实际命令输出摘要。
  - 失败时按 §0.5 循环，不得跳过任一用例。

---

### T18（W6）全量回归、门禁与交付收口

- **分支**：`feature/v32-T18-final`（只写报告，不新增源码）
- **依赖**：T17
- **需求描述**：
  - **T18-R1** 用 `git worktree add /tmp/v32base origin/main` 建立基线树，在基线与当前树分别跑全量测试，比较失败集合与失败原因；新增红必须为 0。
  - **T18-R2** 全量命令：`NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"`；记录 tests/pass/fail/skip。
  - **T18-R3** 门禁 `node scripts/desktop/gate.mjs` exit 0；若失败按 §0.5 判定，不得以「历史基线也有」掩盖新增红。
  - **T18-R4** 复核覆盖矩阵 §2：每个章节、页面、状态、异常、用例都有已合入任务与证据链接。
  - **T18-R5** `docs/v32/reports/final-verification.md` 汇总：基线 sha、最终 sha、逐任务结论、17/17、差集结论、门禁结论、已知偏差。
  - **T18-R6** 门禁前置：确认 T00-R4 恢复的两份基线文件存在且内容与 `7b71cd4` 逐字一致；否则全量 `gate.mjs` 会在 `readFileSync` 处崩溃（`--skip-tests` 不会暴露此问题）。若文件缺失，先按 T00-R4 恢复，不得绕过门禁。
- **验证清单**：全量测试 + 门禁 + `npm run verify:v32` 三项全绿；报告落盘后合入 main。
- **完成定义**：两机确认所有任务已合入，main 上从零复跑三项验证仍全绿。

---

## 5. 总体验收与完成定义

### 5.1 最终必须全部通过的检查

```bash
cd /Users/xuesh/www/Maestro
git fetch origin && git switch main && git pull --ff-only origin main

# 1) 领域测试（必须附 tests >= 已合入域下限断言，防止 glob 空匹配假绿）
NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/wp21/v32-*.test.js"

# 2) 全量回归（约 12 分钟，macOS）
NODE_ENV=test TMPDIR=/tmp/v32t node --test "test/**/*.test.js"

# 3) 17 条验收
npm run verify:v32

# 4) 发布门禁
node scripts/desktop/gate.mjs

# 5) 零 CJK 与文案键
python3 -c 'import re,pathlib,sys; roots=[pathlib.Path("src/v32"),pathlib.Path("desktop/ui/v32")]; bad=[(str(p),n) for r in roots for p in r.rglob("*.js") for n,l in enumerate(p.read_text().splitlines(),1) if re.search(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]",l)]; print(bad); sys.exit(1 if bad else 0)'
```

### 5.2 完成定义（缺一不可）

1. §2 覆盖矩阵中每一行都有已合入任务，且报告中对应 REQ 全部 PASS。
2. 17 条验收用例全部由真实 API / 状态驱动通过，不是页面文案检查。
3. P00–P16 在桌面壳内可从导航进入并操作，无 iframe 内第二套视觉。
4. 全量失败集合差集 = 0；新增红 = 0；门禁 exit 0；T00-R4 的两份基线文件存在且未被改写。
5. `docs/v32/reports/T01.md` ～ `T18.md` 全部存在且含 baseSha / headSha / 验证结果 / 认领记录 / 审核轮次。
6. 每个任务都按 §0.11 完成认领，并经干净审核 Agent 审核 PASS（无阻塞项）后才提交；台账中所有任务 `phase: done` 且 `headSha` 均为 `origin/main` 祖先。
7. 每台机器确认自己分支已合入且无遗留 WIP，两份认领台账无活跃 `developing` / `reviewing` 条目。

### 5.3 阻塞升级规则

出现以下情况，任务保持 `in_progress`，写 `BLOCKED` 报告并交主线负责人，**不得自行降标准合入**：

- 契约字段不够用，需要改 `src/v32/contracts.js`（T01 独占）。
- 必须修改 `src/core/**`、`src/persistence/**`、`src/adapter/**`、`src/daemon/server.js`。
- 新增 npm 依赖才能完成。
- 前序任务未合入导致无法验证，且等待超过一个同步点。
- 全量回归出现新增红且独占复跑仍红。
- 审核 Agent 连续两轮给出同类阻塞项，且按 §0.11.5 重建干净子 Agent 后仍 FAIL。
- 认领台账与 main 实际状态冲突（两机都声称同一任务 `done`，或报告的 `headSha` 不是 `origin/main` 祖先）。

---

## 附录 A：原型交互参考 → 实现落点（非需求来源）

> 本表只帮助实现者找到「原型里某个交互对应哪个任务」，**不构成需求**。行为规则以规格正文（§/P/V32 编号）为准，冲突时以规格为准（§0.9）。

| 原型交互（docs/maestro_v3_2_prototype.html） | 实现任务 | 规则依据（规格正文） |
|---|---|---|
| `scanPage` / `scanCli` / `checkCli` / `addCliPath` / `confirmAddCli` | T02 | §7.1 / P00 |
| `workItemsPage` / `openWorkItem` / `workItemDetail` / `startRun` / `cancelWorkItem` | T07 | §5.1 / §13.1 / P01 / P03 |
| `startWorkItemWizard` / `wizardWorkflow` / `wizardTeam` / `wizardNext` / `wizardBack` / `createWorkItem` / `preflightWizard` / `changeWizardMode` / `changeWizardAsset` / `readWizardTeam` | T07 | §5 / §5.1 / §5.2 / §14-1 / P02 |
| `showExecutionPlan` / `reviseExecutionPlan` / `saveExecRevision` / `showRunHistory` | T11 | §2.1-10 / §14-4 / P03 |
| `showWizardNodeDesigner` / `saveWizardNodes` / `parallelPairs` / `parallelConflicts` / `eligibleMembers` | T08 + T06 | §6.1–§6.3 / §14-2 / P02-4 |
| `teamsPage` / `editTeam` / `toggleTeamRoleBox` / `saveTeam` / `copyTeam` / `deprecateTeam` / `showTeamVersions` | T05 | §3.1–§3.3 / §13.2 / P04 / P05 |
| `workflowsPage` / `editWorkflow` / `wfGraphEditor` / `graphAddNode` / `graphAddEdge` / `graphAutoLayout` / `checkWorkflowDag` / `saveWorkflow` / `publishWorkflow` / `showWorkflowDag` | T06 | §4.1–§4.4 / §13.3 / P06 / P07 |
| `employeesPage` / `newEmployee` / `saveEmployee` / `editEmployeeProfile` / `saveEmployeeProfile` / `employeeDetail` | T04 | §1.1 / §8.1 / P08 |
| `rolesPage` / `roleDetail` / `editRole` / `createRole` / `saveRole` | T03 | §1.1 / P09 |
| `runsPage` / `openRun` / `runRuntimeCards` / `runDetail` / `setRunTab` | T11 | §10 链路 C / §13.4 / P10 |
| `taskActionBtn` / `assignTask` / `cliCapsHtml` / `saveTaskAssignment` / `reassignTask` / `confirmQueue` / `drainQueue` / `startTask` | T09 | §7.2 / §7.3 / §13.5 / §14-2 / P12 |
| `sessionExplain` / `activityPanel` / `taskDetail` | T10 + T11 | §8.1–§8.4 / P13 / P14 |
| `completeTask` / `unlockDownstream` / `interruptTask` / `resumeTask` / `failResume` / `confirmResume` | T11 + T12 | §9 / §13.4 / P15 |
| `pauseRun` / `continueRun`（原型演示，规格无暂停态） | 不实现；按 §9 中断/恢复与 §13.4 `interrupted→running` 迁移表达，禁止新增 pause 状态或 API | §9 / §13.4 |
| `approveHumanTask` | T13 | §4.3 / P07 / P16 |
| `openDelivery` / `confirmDelivery` / `artifactTrace` / `showEvents` / `setRecordsTab` / `recordsPage` / `runAcceptanceCheck` | T14 | §12 P16 / §16 V32-17 |
| `settingsPage` / `saveSettings` / `nav` / `render` | T16 | §11 / P00 设置项 |

> 对照方法：先看右列规格条文确认需求，再回看左列原型交互确定页面形态；两者冲突时按 §0.9 以规格为准。原型函数名称来自 `docs/maestro_v3_2_prototype.html`，未纳入本规划文件所有权，任何任务都不得为了「对齐原型」而修改它。

## 附录 B：已知坑位速查（来自本仓库历史）

1. `npm test` 报 MODULE_NOT_FOUND；用 `node --test "test/**/*.test.js"`（带引号）。
2. macOS `grep -P` 静默返回空；零 CJK 自查用 `python3 -c` 正则。
3. POSIX socket `sun_path` 104 字节，`TMPDIR` 必须短（`/tmp/v32t`），否则长路径导致连接假死。
4. `core.autocrlf=true` 下 `git restore` 后 status 假报 M：用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 刷新。
5. `NODE_ENV=test` 必须带，否则 `/__test__/graph/pulse` 等接缝不注册，测试假红。
6. 桌面动作在 `pointerdown` 响应，`click` 有 600ms 去重；自动化要同时派发。
7. 输入控件无 `data-field` 会在实时帧重绘时丢光标。
8. Tauri 同步 command 跑主线程；带超时往返的命令必须 `#[tauri::command(async)]`（本轮一般不涉及 Rust，但接线时勿踩）。
9. 事件与落盘有毫秒级先后，取证要「等迁移落定」再读，避免假阴性。
10. 手写台账要活过重生成：整文件重写的生成器先摘出人工段再接回（本轮报告由各任务独占文件，不适用全局生成器）。
