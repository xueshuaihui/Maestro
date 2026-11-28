# Maestro V3.2 实现任务拆分规划（双机并行版 · 最终版）

> 版本：v5（最终整理版；需求权威层级见 §0.8，认领与质量闭环见 §0.10）
> 任务基线：本规划合入后的 `main` HEAD（由 T00 公布并推送到 `origin/main`；两台机器只认这一个 `baseSha`）
> **需求权威（唯一）**：`docs/index.md`（V3.2 正文，L80–L744）与 `docs/maestro_v3_2_page_spec.md`（§1–§17）。对象、状态机、异常边界、验收标准一律以规格正文为准。
> **辅助参考（非需求来源）**：`docs/maestro_v3_2_prototype.html`（1167 行）——只用于页面布局、交互形态与演示流程；其中字段/状态/按钮/错误码不构成需求，冲突时以规格为准（§0.8）。
> 代码现状：引擎底座完整；V3.2 的 Work Item / Assignment / 两层 Session / Delivery 在 `src/` 中完全没有；`src/studio/` 的 Team / Employee 语义与 V3.2 冲突（§1.1）。

---

## 0. 执行协议（所有任务、两台机器统一遵守）

### 0.1 范围与非目标

**目标**：把规格正文定义的需求实现为真实产品能力——真实 CLI 扫描、真实 Daemon API、真实 Task Assignment、真实 ACP 会话、真实恢复与审计，覆盖 P00–P16、§3–§9、§13 状态机、§14 异常边界、V32-01～V32-17 全部用例。原型仅作交互参考，不定义需求（§0.8）。

**非目标**：

1. 不重写既有引擎（`src/core/**`、`src/daemon/server.js`、`src/persistence/**`、`src/adapter/**` 主体、`test/wp1`～`test/wp16`）。**两处狭窄例外**：T15 在 `test/wp14/e2e.test.js` 的 AC-39 写路径白名单按 `/org/` 前缀放行；T16 把三个 CDP 脚本的「恰好 5 段」断言改为「原 5 段 + 新增 4 段」。
2. 不改动两份规格正文与原型；不在本次把 `src/studio/**` v2 语义就地改造成 V3.2（采用 §1.1 隔离新域）；不引入第三方 npm 依赖（`dependencies: {}`）；不做 Windows 签名、Release 发布、多语言。

### 0.2 开工前置（主线负责人执行一次）与固定命令

本地 `main` 与 `origin/main` 可能不一致（原型提交 `0551b9e` 曾领先 2 个提交）。**不要按「领先几个提交」判断基线**——两台机器只认 T00 公布的 `baseSha`：

```bash
cd /Users/xuesh/www/Maestro
mkdir -p /tmp/orgt            # 两台机器各自执行：目录不存在会让 mkdtempSync ENOENT，全部验证在任何用例前崩
git fetch origin
git push origin main          # 由 T00 恢复基线并提交后执行（T00-R3）
git rev-parse HEAD            # T00 公布它作为唯一 baseSha
```

未完成前禁止开工。每份报告记两个 sha：`baseSha`（T00 公布，永不改变，用于差集基线）与 `branchPointSha`（实际建分支点）；`origin/main` 被对方推进时先在功能分支 `git rebase origin/main` 并复跑验证，禁止各自修改 `baseSha` 定义。`NODE_ENV=test` 与短 `TMPDIR` 是全部命令的强制前缀（§1.4）。

### 0.3 每个任务的固定实现流程（不得跳步）

| 步骤 | 动作 | 硬性要求 |
|---|---|---|
| 1 | **建分支 + 认领 + 立即广播认领状态** | `git fetch origin` → `git switch main` → `git pull --ff-only origin main` → `git switch -c feature/org-TXX-<slug> origin/main` → 按 §0.10 读台账判定并认领（在**功能分支**上把自己台账写成 `phase: developing`）→ commit → `git switch main` → `git merge --ff-only <feature>` → `git push origin main` → `git switch <feature>` 切回继续开发。完整命令与冲突恢复见 §0.10.3 |
| 2 | 读规格 | 主 Agent 把 REQ 标注的规格章节封进**干净子 Agent** 的 prompt，逐条转成实现清单；再看原型交互（附录 A）理解页面形态；冲突以规格为准并记录差异 |
| 3 | 实现 | **只由干净开发子 Agent、在 step 1 创建的功能分支上执行**（§0.10.4 / §0.7 分支纪律）；主 Agent 不写产品代码；只改 §1.2 分配的路径 |
| 4 | 自测 | 写任务专属单测（§1.4 命令），不得删断言/降阈值 |
| 5 | 失败循环 | 按 §0.5 分类、修复、复跑至全绿 |
| 5b | **独立审核循环** | 开发子 Agent 报完成后，主 Agent **另建干净审核 Agent**（不继承开发上下文），按 §0.10.5–§0.10.6 审核；有阻塞项就派修复再审核，循环到 PASS 才可提交 |
| 6 | 报告 + 提交 | 审核 PASS 后才写 `docs/org/reports/TXX.md`（§0.7），`git add <本任务文件 + 报告 + 自己的台账>` → `git commit -m "feat(org): TXX <标题>"`；不 `--amend` 已合入提交 |
| 7 | **全部完成后合入 main** | 认领/开发/报告提交都在同一功能分支；`git fetch origin` → `git rebase origin/main` → 更新报告 `headSha` 并 fixup/amend → 复跑验证 → `git switch main && git merge --ff-only <feature>`（**全部**提交一次性合入）→ `git push origin main`；不得只挑部分提交 |
| 8 | push 竞争恢复 | 非 ff 时 `git fetch origin && git switch main && git reset --hard origin/main && git merge --ff-only <feature> && git push origin main`；`reset --hard` 仅限本地 main 且功能提交已在 feature；禁止 force |
| 9 | 合入后核验 | main 上确认自己的合入 sha 与报告 `headSha` 一致，只读核验不再改报告 |

**禁止**：在 main 上直接改代码；跨任务改别人文件；合入未验证代码；`git push --force`；把验证失败当 flake 而不独占复跑。

### 0.4 双机并行与冲突避免

- 运行时认领状态以 §0.10 共享台账为唯一真相，§3.1 排程表只是静态建议；同波次两机文件集合互斥（§1.2）。
- 每个任务独占文件所有权；需改他人文件时写 `BLOCKED` 交主线裁决，不越界。
- 两机都走同一套「读台账 → 认领 → 干净开发子 Agent → 干净审核 Agent → 循环到无阻塞项 → 提交合入 → 更新台账」流程，不允许跳过认领或审核。
- 同步点（§3.2）：每波次结束两机 `git fetch`，确认 main 含对方任务；集成断言在同步点补，不提前写死对方未实现的行为。
- 所有任务以 §1.3 契约为准；任何任务不得自行追加 `src/org/contracts.js`（T01 独占）；契约字段不够按 §5.3 写 `BLOCKED`。

### 0.5 失败循环与差集纪律

1. **分类**：① 契约不符（本任务 bug）；② 断言写法问题；③ 负载型 flake；④ 前序未合入导致环境缺失。
2. **flake 证伪**：`NODE_ENV=test TMPDIR=/tmp/orgt node --test --test-concurrency=1 <文件>` 独占复跑 2 次，两次都绿才登记 flake 并写原始失败帧。flake 复跑与门禁 `confirmFlakes` 的参数差异（是否带 `--test-concurrency=1`）在报告中说明，以独占复跑结果为裁决依据。
3. **差集判定（唯一机器口径）**：`scripts/desktop/gate.mjs:206` 按**用例标题**差集（`tap.notOk.filter(name => !baseline.list.includes(name))`），不是硬写 `fail === 0`。基线对照 `git worktree add /tmp/orgbase origin/main` 的树（也用标题集合），不是本分支合入前的旧帧。TAP 无结构化 `failureType`，不得按其变化判定；同名失败原因变化只做人工复核，保存原始 TAP 到 `docs/org/reports/raw/TXX/`。
4. **不得**：改冻结用例标题；把 `deepEqual` 放宽为子集；删除失败用例；硬编码测试条数（用 `tests >= 基线 && pass === tests`）。
5. 修复后重跑，直到本任务验证清单全绿才提交合入。

### 0.6 证据与报告规范

每任务写 `docs/org/reports/TXX.md`，模板：

```markdown
# TXX <标题> 完成报告
- baseSha: <T00 公布的唯一 sha>
- branchPointSha: <实际建分支点；落后时先 rebase 并记录新值>
- headSha: <rebase 后、合入前的本任务提交 sha>
- 机器 / 任务窗口: A | B
- 认领记录: claimedAt=<ISO> / branch=<分支名> / 台账=<claims/machine-X.json>
- 需求逐条结论: TXX-R1 PASS / ...（FAIL 写原因与修复轮次）
- 审核循环: 共 N 轮；每轮 verdict=<PASS|FAIL> + 阻塞项数；FAIL 逐条写修复方式
- 验证命令与结果: 命令原文 + 摘要行 + 失败集合差集结论
- 证据分级: 已实测（真实宿主） / mock 实测 / 阻塞（三选一，附原始帧路径）
- 已知偏差 / 未覆盖: 无则写「无」
- 合入后 main sha: <sha>
```

**证据落盘红线**：测试默认写 `%TEMP%` / `TMPDIR=/tmp/orgt`；不得写 `docs/iterations/**/evidence/**`。原始帧放 `docs/org/reports/raw/TXX/`，`.gitattributes` 不对其做空白 strip。

### 0.7 全局技术红线（含最高优先分支纪律）

**分支纪律（最高优先）**：每个任务的**全部功能开发必须在 `feature/org-TXX-<slug>` 功能分支上**——从建分支到合入 main 之前，产品代码、测试、报告只写在这条分支。`main` 只接收审核通过的 ff-only 合并，禁止在 main 上直接写产品代码/测试/报告。唯一例外是 §0.10.3 step 4c 的认领广播（只含自己台账）。派工前主 Agent 必须用 `git branch --show-current` 确认当前是功能分支。

0. **需求权威**：对象/状态枚举/迁移/异常边界/验收标准只认两份规格正文字面；原型是本地模拟演示（原型定位：`index.md` §15 L683–L707 / `page_spec.md` §15 L756–L780），不得反推字段或状态。凡标「实现约定」的均非规格符合性断言。
1. V3.2 状态写入唯一入口 `store.transit()`；引擎状态仍只走 `orchestrator.transit()`（`src/core/orchestrator.js:947`）；严禁直接 `store.save` 改引擎状态。
2. 事件先落盘再广播；事件 `ts` 与状态变更同一时刻；事件带 `prevHash/hash` 哈希链。
3. `Prepared` 不建任何 Session；`Locked` 才开始创建/唤醒会话；人工节点永不建 Session、不选 CLI。
4. 恢复策略 A 失败时保持 `interrupted` 并写审计，禁止静默降级为策略 B。
5. `src/core/**`、`src/daemon/**`、`desktop/ui/**` 零 CJK 字面量（含注释、全角标点）；文案走 `ctx.t('ORG_...')` / `ctx.st(...)` 且键必须真被 `GET /ui/labels` 下发；macOS `grep -P` 不可用，用 `python3 -c` 正则 `[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]`。
6. 图/角色字面量只能在 `src/templates/**`；V3.2 角色/节点数据来自 `src/org/contracts.js`，不得在 core/daemon 写死岗位名。
7. 测试环境变量 `NODE_ENV=test`（`/__test__/*` 接缝按它注册）；`TMPDIR` 用短路径（POSIX `sun_path` 104 字节上限）。
8. 全量命令 `NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/**/*.test.js"`（引号必须保留；`npm test` 会 MODULE_NOT_FOUND）。
9. 门禁 `node scripts/desktop/gate.mjs`；基线 1157 条、9 条允许失败、测试数只增不减、`dependencies={}`、31 词纯净双扫、版本三处对齐。

### 0.8 需求权威层级（先看这条）

**起因**：早期版本把 HTML 原型当需求基准，从原型反推出规格没有的状态/字段/接口。原型用本地模拟数据演示，不真实扫描 CLI、不连 Daemon、不启动 Agent、不调用 ACP。规格正文没有「原型冲突时以谁为准」条款，因为原型本就不是规则来源。

| 层级 | 来源 | 用途 |
|---|---|---|
| 1（权威） | `docs/index.md` V3.2 正文 + `docs/maestro_v3_2_page_spec.md` §1–§17 | 对象与隔离规则、状态枚举与迁移、异常边界、页面职责、17 条验收用例——逐字实现 |
| 2（设计约束） | 本规划 §1 架构决策、§0.7 红线、既有引擎事实 | 在层级 1 下细化实现（新增 `src/org/`、复用 adapter、CAS 存储） |
| 3（参考） | `docs/maestro_v3_2_prototype.html` | 页面布局、交互形态、演示流程；不产生 REQ、不定义状态/字段/错误码 |

**冲突裁决**：层级 1 与 3 不一致时以层级 1 为准；不得为「和原型一致」增加规格没有的状态或字段。报告写「原型演示 X，规格 §Y 规定 Z，按规格实现 Z」。

**已从原型纠正回规格的项**（按纠正后口径，不要再按原型）：

| 项 | 原型演示 | 规格正文 | 本规划改为 |
|---|---|---|---|
| Node Task 状态 | `waiting_queue`、`human_waiting` | §13.4 严格 12 态 | `TASK_STATUS` 与迁移表删两态；排队用调度标记（§6.3），人工等待用 WorkItem `waiting_human` |
| Assignment 状态 | `cancelled` 迁移 | §13.5 六态无 `cancelled` | 迁移表删 `cancelled` 边 |
| 人工审批 | 会签/默认动作/升级 | §4.3 只要求审批人/条件；§14 无「升级」 | T13 删会签/默认动作/升级，驳回按 §14-3 |
| 交付记录字段 | 固定 7 字段 + 缺项报错 | §16 V32-17 只要求可追溯 | `deliveryRecord` 标为实现载体，断言可追溯链 |
| 队列 API | `POST .../queue` | §6.3 只要求 Scheduler 排队 | 标为实现约定，不作规格验收项 |
| CLI 探测细节 | 健康四态、fingerprint 算法 | §7.1 只列 8 项信息与语义 | 标为实现约定，不作规格符合性断言 |

**实现约定（非规格符合性断言，T18 汇总不得写成「规格要求」）**：错误码/事件/审计全集、哈希链格式、`nextId` 算法、路由具体路径、零 CJK/深链兼容/门禁基线数字。

### 0.9 历次审核修订要点（结论已融入正文，此表为溯源）

**第一轮**（对照真实源码，修「能不能开工」）：① `docs/iterations` 已删 → T00-R4 从 `7b71cd4` 恢复门禁基线；② `createRoutes` 要求 `orchestrator.startRun` 且路由异常被静默 catch → T15 请求期懒初始化、构造期零 IO；③ `factory.create()` 只能 `newSession` → T10 唤醒走 `createStdioTransport + createAcpClient + resume/load`；④ 桌面 `render(ctx)` 返回 DOM 而非 HTML → 重写 §1.3.3；⑤ `labels-desktop.test.js` 精确键集合 → 加入 T16 独占；⑥ `SECTIONS` 5 组扩到 9 组 → T16 保历史 view ID；⑦ ID 用「数组长度+1」重号 → T01 `nextId(kind)` 原子分配；⑧ 无迁移表 → T01 `TRANSITIONS/assertTransition`；⑨ 快照形状未定义 → T01 `snapshotOf` 深拷贝；⑩ `ready_for_acceptance`/交付路由重复 owner → 统一归 T11/T14；⑪ CLI fingerprint 未定义 → T02 `unknown` 语义与算法；⑫ 报告在合入后才写 → 报告随功能分支提交；⑬ 验证命令缺环境变量 → 统一 §1.4；⑭ 预检把无 CLI 当创建失败 → T07 预检只查能力覆盖。

**第二轮**（修「开工后会不会走偏或卡死」）：① `/tmp/orgt` 不存在 → §0.2 前置 mkdir；② T00 先公布 sha 后提交基线 → R0-1～R0-4 重排；③ AC-39 白名单无 `/org/` → T15 独占扩展；④ 三个 CDP 脚本写死 5 段 → T16 独占改为「原 5 段 + 新增 4 段」；⑤ 差集按标题不按 `failureType` → §0.5 统一口径；⑥ glob 空匹配假绿 → `tests >= 下限 && fail === 0`；⑦ `contracts.js` 自助追加 → 统一走 §5.3 BLOCKED；⑧ `index.js` 预留 `export *` 会 ERR → T01-R8 只导出已存在模块；⑨ `advanceRun` 无签名 → T11-R10 固定签名；⑩ T12 波次矛盾 → 统一 W3b；⑪ 另建 `ORG_LABEL` 撞精确计数 → T16 只向 `DESKTOP_V2_LABEL` 追加；⑫ `index.html` 无 owner → T16 独占加 `<link>`；⑬ render 异常被吞回空态假绿 → T16-R8 正面标记 + 空态不存在；⑭ UI 任务无证据路径 → T16-R11 脚本；⑮ T01 夹具「≥2 引用」不可能 → 改自校验；⑯ §4 字段数统一按 `index.md` 10 项；⑰ Task Assignment 补进对象表；⑱ 人工节点统一 `human:{approver,condition}`；⑲ WorkItem 补规格链上的边；⑳ `pauseRun/continueRun` 标不实现；㉑ 交叉引用与行数笔误修正。

### 0.10 双机任务认领与质量关卡（两台机器必须同时遵守）

§3.1 波次表是静态建议，不是运行时真相。两台机器可能一快一慢、抢同一任务、误判对方已完成，或自己写自己审而放过大问题。因此把「认领 + 分层 Agent 审核」升级为每任务的强制入口，两边完全一致。

#### 0.10.1 任务状态（运行时唯一口径）

| 状态 | 含义 | 判定依据 |
|---|---|---|
| `available` | 可认领 | 两机台账都无活跃条目 且 `origin/main` 无该任务报告 且 前置依赖已 `done` |
| `claimed` | 开发中 | 某机台账 `phase: developing` 且未释放 |
| `reviewing` | 审核中 | 台账 `phase: reviewing`，审核 Agent 尚未 PASS |
| `done` | 已完成 | 台账 `phase: done` 且 `origin/main` 含报告 且 报告 `headSha` 是 `origin/main` 祖先；三者缺一不可 |
| `blocked` | 阻塞 | 台账 `phase: blocked`，`note` 必填（原因 + 待谁裁决） |

`done` 必须用 `git merge-base --is-ancestor <headSha> origin/main` 验证，不能只看报告文件存在。

#### 0.10.2 共享认领台账（每机只写自己文件）

路径 `docs/org/claims/machine-A.json`、`machine-B.json`，由 T00-R0-2b 初始化为空；**禁止修改对方文件**（避免并发写同一文件产生 merge conflict）。字段：`{machine, updatedAt, claims:[{task, phase, branch, claimedAt, reviewRounds, lastReview, note}]}`；`phase ∈ developing|reviewing|done|blocked`；`lastReview={verdict, blockingCount, at}`；`note` 在 `blocked` 时必填。**每机同一时刻最多 1 条 `developing`/`reviewing`**（避免平台限流与 Agent 抢资源），做完合入后再认领下一个。

#### 0.10.3 认领协议（每个新任务开始前逐条执行）

1. `git fetch origin` → `git switch main` → `git pull --ff-only origin main`。
2. **读全量状态**：合并读两份台账 + `git ls-tree -r --name-only origin/main docs/org/reports/` + 逐报告 `git merge-base --is-ancestor` 复核 `headSha`，得 §0.10.1 全局状态表。速查：
   ```bash
   node -e 'const fs=require("fs");for(const m of ["A","B"]){const j=JSON.parse(fs.readFileSync(`docs/org/claims/machine-${m}.json`,"utf8"));console.log(m,JSON.stringify(j.claims))}'
   git ls-tree -r --name-only origin/main docs/org/reports/
   node -e 'const fs=require("fs"),cp=require("child_process");const md=fs.readFileSync(process.argv[1],"utf8");const m=md.match(/headSha:\s*([0-9a-f]{7,40})/);if(!m)throw Error("headSha missing");const ok=cp.spawnSync("git",["merge-base","--is-ancestor",m[1],"origin/main"]).status===0;console.log(process.argv[1],m[1],ok?"MERGED":"NOT-MERGED")' docs/org/reports/TXX.md
   ```
3. **选任务**：优先选 §3.1 分配本机且 `available` 的；自己排程的被对方认领/完成则不得重做，顺延到下一个 `available` 并在 `note` 写「按台账顺延」；本机已有活跃任务先完成它。
4. **建功能分支 + 原子认领 + 立即广播**（一条龙不可拆散）：
   ```bash
   git switch -c feature/org-TXX-<slug> origin/main          # 4a 从已同步的 origin/main 建分支
   # 4b 在功能分支上只改自己台账：phase=developing, claimedAt, branch
   git add docs/org/claims/machine-X.json
   git commit -m "chore(org): claim TXX on machine X"
   git switch main && git pull --ff-only origin main          # 4c 合并认领提交并推送，对方此刻可见
   git merge --ff-only feature/org-TXX-<slug>
   git push origin main
   git switch feature/org-TXX-<slug>                          # 4d 立刻切回功能分支继续开发（全程不删）
   ```
   台账写在**功能分支**，靠合并到 main 广播，不是在 main 直接改（§0.7 分支纪律）；4c 合并只含台账提交，绝不夹带产品代码/测试。
5. **冲突恢复**：4c 的 `merge --ff-only` 因对方先推失败 → `git switch <feature> && git rebase origin/main` → 回 4c 重试，rebase 后重读台账，若任务已被对方认领则放弃换任务；`git push` 非 ff → `git fetch origin` → 回步骤 2。全程禁止 force。
6. 切回功能分支后按 §0.3 step 2–6 继续；**所有实现/单测/报告都在这条分支，禁止在 main 写产品代码**（§0.7）。全部提交（认领 + 开发 + 报告 + 台账 `done`）在 §0.3 step 7 一次性 ff-only 合入，不允许挑部分提交。

**禁止**：不读台账直接开工；改对方台账；同一任务两机同时开发；认领后跨波次无进展却不释放（写 `note` 改回 `available`）。

#### 0.10.4 主 Agent 职责边界

主 Agent 是**质量与进度把控者**，不是实现者：

- **做**：读台账认领、读规格拆 REQ、创建派发干净子 Agent、跟踪进度、运行审核循环、裁决阻塞、提交合入、更新台账。
- **不做**：写/改产品代码或测试；跳过审核自己给 PASS；审核 PASS 前把台账写成 `done`。
- **上下文纪律**：每任务**新开干净开发子 Agent**，prompt 自包含——REQ 清单、规格章节、§1.2 文件所有权、验证命令、§0.7 红线、§0.8 权威层级、**当前分支名 + 「只在该分支写文件、禁止在 main 改任何文件」显式指令**；派工前 `git branch --show-current` 校验。审核 Agent 也必须是新干净上下文，不继承开发过程。
- **限流**：同一时刻只维持 1 个开发或 1 个审核子 Agent 活跃（平台限流教训）。

#### 0.10.5 开发 → 审核 → 修复循环

认领成功 → 主 Agent 建干净【开发子 Agent】按 §0.3 step 2–5 实现并自测 → 报完成（附 REQ 逐条结论 + 验证输出）→ 主 Agent **新建干净【审核 Agent】**（不继承开发上下文）按 §0.10.6 输出 PASS/FAIL + 阻塞项 → **PASS（无阻塞项）**才进 §0.3 step 6–7；**FAIL** 则把阻塞项派回修复（优先复用开发子 Agent 保留实现上下文，连续两轮同类 FAIL 则重建干净子 Agent 重做该项），修完再新建审核 Agent，**循环到无阻塞项**。非阻塞建议记入报告不阻塞；审核轮次写台账 `reviewRounds`，报告写每轮 FAIL 原因与修复方式；**任务只有审核结论无阻塞项才算结束**。

#### 0.10.6 审核 Agent 必查清单（逐条给结论）

| # | 检查项 | 阻塞判定 |
|---|---|---|
| 1 | REQ 覆盖：每个 `TXX-Rn` 有实现落点与验证断言 | 任一 REQ 无落点 → 阻塞 |
| 2 | 规格权威：状态枚举/字段/异常边界与规格正文逐字一致，无原型污染（§0.8） | 不一致 → 阻塞 |
| 3 | 文件所有权：`git diff --name-only` 只含 §1.2 分配路径（含报告与自己的台账） | 越界 → 阻塞 |
| 4 | 验证命令：§0.5 差集口径、测试条数下限、原始帧落 `docs/org/reports/raw/TXX/` | 缺命令/证据/新增红 → 阻塞 |
| 5 | 报告完整性：baseSha / branchPointSha / headSha / 逐条结论 / 证据分级齐全 | 缺项 → 阻塞 |
| 6 | 红线合规：§0.7 全项 | 违反 → 阻塞 |
| 7 | 合入前置：审核 PASS 后才提交合入；报告随功能分支提交 | 顺序错 → 阻塞 |
| 8 | **分支纪律**：`git branch --show-current` 为功能分支；改动都来自该分支，main 无未审核产品代码（认领广播除外） | 不在功能分支或 main 有未审核改动 → 阻塞 |

#### 0.10.7 台账更新时机

| 时机 | 动作 |
|---|---|
| 认领成功（step 4） | `phase: developing`、`claimedAt`、`branch` |
| 开发报完成送审 | `phase: reviewing`，`reviewRounds +1` |
| 每轮审核结论 | `lastReview={verdict,blockingCount,at}`；FAIL 继续循环 |
| 审核 PASS 且提交已推送 | 随功能提交写 `phase: done`、`lastReview.verdict: PASS` |
| 合入 main 后 | 只读复核 `merge-base --is-ancestor <headSha> origin/main`；失败写 `blocked` |
| 其它机器读取时 | **不信任 `done` 字面值**，按 §0.10.1 复核三条件；非祖先按 `reviewing` 对待，在自己 `note` 记提醒（禁止改对方文件），必要时报主线 |
| 阻塞/放弃 | `phase: blocked` 或释放 `available`，`note` 必填 |

**同一功能分支两次合入 main**：第一次认领后（step 4c）只带 `developing` 台账提交，让对方立刻看到；第二次全部完成后（§0.3 step 7）带剩余开发/报告/`done` 提交。两次均 `--ff-only`，第二次时功能分支已含第一次提交，仍是纯快进；分支从创建到第二次合入一直保留，不删不重建。§3.2 同步点时两机都重跑 §0.10.3 step 2 全量读取，用台账交叉核对对方是否真合入。

---

## 1. 架构决策与模块边界

### 1.1 为什么新增 `src/org/` 而不改 `src/studio/`

现状（已核对）：`src/studio/schema.js:129` 的 `emptyStudio()` 无 workItems/assignments/deliveries；`src/studio/team.js:59,71` 的 Team 带 `flowId`（V3.2 §3.1 禁止）；`src/studio/org.js:138-148` 的 Employee 强制 `cliId` 且单 `roleId`（§1.2/§3.2 禁止）；`org.js:189 openSession` 只是 `mode:'record'` 语义记录，无两层会话；`test/wp17`/`wp18` 与 `scripts/verify-authoring-ui.mjs` 大量冻结 v2 行为，就地改会撞红几十条。

因此 **V3.2 作为独立领域模块实现**，自持 CAS 存储与 HTTP 路由；桌面壳新增 V3.2 页面并成为业务主入口；v2 Studio 保留但不在 V3.2 链路；引擎底座经 `src/org/bridge.js` 单向复用，不改引擎源码。

**命名决策（T19 裁决，用户拍板）**：目录名曾用 `src/v32/`（版本号编码进架构命名，版本演进后成为历史噪音），已于 T19 全局重命名为 **`src/org/`**（对应概念模型「组织→部门→角色→员工→会话」），同步改名：路由前缀 `/org/*`、路由目录 `src/daemon/http/org/`、页面 `desktop/ui/org/`、测试前缀 `test/wp21/org-*.test.js`、夹具 `org-*.json`、台账/报告目录 `docs/org/{claims,reports}/`、存储目录 `.orch/org/`、宿主档案 `.orch/hosts/org-<installId>.json`、错误码前缀 `ORG_*`、标签键前缀 `ORG_CLI_*`、视图 ID `org-*`、分支前缀 `feature/org-TXX-*`。**唯一例外**：验收用例登记号 `V32-01~17` 保留原名（属权威规格 `index.md` / `page_spec.md` 的用例编号体系，改名会破坏规格可追溯性）；历史提交信息与 T01/T02 证据原始帧文件名不改写。

### 1.2 目录与文件所有权总表（并行防冲突关键）

| 所有者 | 独占路径（其它任务禁止修改） |
|---|---|
| T00 | `docs/iterations/iteration-7/baseline-failures.txt`、`iteration-10a/baseline-failures-win32.txt`（仅从 `7b71cd4` 恢复不得改写）、`docs/org/reports/` 占位、`docs/org/claims/machine-{A,B}.json`（仅初始化空台账，运行期各机写自己文件，§0.10.2） |
| T01 | `src/org/contracts.js`、`ids.js`、`errors.js`、`store.js`、`events.js`、`audit.js`、`index.js`（骨架）、`test/wp21/org-{contracts,store,events}.test.js`、`test/wp21/fixtures/org-*.json` |
| T02 | `src/org/cli-pool.js`、`src/daemon/http/org/cli-routes.js`、`desktop/ui/org/cli-page.js`、`test/wp21/org-cli-pool.test.js` |
| T03 | `src/org/roles.js`、`src/daemon/http/org/roles-routes.js`、`desktop/ui/org/roles-page.js`、`test/wp21/org-roles.test.js` |
| T04 | `src/org/employees.js`、`src/daemon/http/org/employees-routes.js`、`desktop/ui/org/employees-page.js`、`test/wp21/org-employees.test.js` |
| T05 | `src/org/teams.js`、`src/daemon/http/org/teams-routes.js`、`desktop/ui/org/teams-page.js`、`test/wp21/org-teams.test.js` |
| T06 | `src/org/workflows.js`、`src/org/graph.js`、`src/daemon/http/org/workflows-routes.js`、`desktop/ui/org/workflows-page.js`、`desktop/ui/org/graph.js`、`test/wp21/org-{workflows,dag}.test.js` |
| T07 | `src/org/work-items.js`、`src/org/preflight.js`、`src/daemon/http/org/work-items-routes.js`、`desktop/ui/org/work-items-page.js`、`desktop/ui/org/wizard.js`、`test/wp21/org-{work-items,preflight}.test.js` |
| T08 | `src/org/mapping.js`、`src/daemon/http/org/mapping-routes.js`、`desktop/ui/org/mapping-panel.js`、`test/wp21/org-mapping.test.js` |
| T09 | `src/org/assignments.js`、`src/daemon/http/org/assignments-routes.js`、`desktop/ui/org/assignment-panel.js`、`test/wp21/org-assignments.test.js` |
| T10 | `src/org/sessions.js`、`src/org/bridge.js`、`src/org/host-profile.js`、`src/daemon/http/org/sessions-routes.js`、`desktop/ui/org/session-panel.js`、`test/wp21/org-{sessions,bridge}.test.js` |
| T11 | `src/org/runs.js`、`src/daemon/http/org/runs-routes.js`、`desktop/ui/org/run-page.js`、`desktop/ui/org/activity-panel.js`、`test/wp21/org-runs.test.js` |
| T12 | `src/org/recovery.js`、`src/daemon/http/org/recovery-routes.js`、`desktop/ui/org/recovery-panel.js`、`test/wp21/org-recovery.test.js` |
| T13 | `src/org/human-gates.js`、`src/daemon/http/org/human-routes.js`、`desktop/ui/org/human-gate-dialog.js`、`test/wp21/org-human.test.js` |
| T14 | `src/org/delivery.js`、`src/org/records.js`、`src/daemon/http/org/records-routes.js`、`desktop/ui/org/records-page.js`、`desktop/ui/org/delivery-dialog.js`、`test/wp21/org-{delivery,audit}.test.js` |
| T15 | `src/daemon/http/org-routes.js`、`src/daemon/http/routes.js`（仅 import + `orgRoutes` 构造 + `routes.push` 三处）、`test/wp21/org-api-contract.test.js`、`test/wp14/e2e.test.js`（仅 AC-39 白名单按 `/org/` 放行） |
| T16 | `desktop/ui/shell/{nav.js,index.js,chrome.js,pages.js}`、`desktop/ui/app.js`、`desktop/ui/org/{index.js,org.css}`、`desktop/ui/index.html`（加 `<link>`）、`src/daemon/http/labels.js`、`src/cli/labels.js`、`scripts/verify-org-ui.mjs`、`test/wp21/org-labels.test.js`、`test/wp13/{org-shell,labels-desktop}.test.js`（后者仅 append）、`scripts/verify-{nav,scenarios,desktop-boot}.mjs`（仅「恰好 5 段」改「原 5 段 + 新增 4 段」） |
| T17 | `scripts/verify-org.mjs`、`test/wp21/org-acceptance.test.js`、`package.json`（只加 `verify:org`）、`docs/org/reports/acceptance.md` |
| T18 | `docs/org/reports/final-verification.md`（不新增源码，只全量回归与门禁复跑） |
| T19 | 全局重命名 v32→org：`src/org/**`、`src/daemon/http/org/**`、`desktop/ui/org/**`、`test/wp21/org-*.test.js`、`test/wp21/fixtures/org-*.json`、`docs/org/{claims,reports}/`（已完成，见任务详单 T19） |
| 主线负责人 | 本规划（只读）、`.workbuddy/memory/**`、合并与阻塞升级裁决（§5.3） |
| 机器 A / B 主 Agent | `docs/org/claims/machine-{A,B}.json`（各独占写）；各自认领任务的 `docs/org/reports/raw/TXX/`（随报告提交） |

**共享只读**（任何任务不得改）：`src/core/**`、`src/persistence/**`、`src/adapter/cli-discovery/**`、`src/daemon/server.js`、`src/templates/**`、`scripts/desktop/gate.mjs`。确需改则写 `BLOCKED` 交主线。

### 1.3 统一契约（T01 落成代码，其他任务 import，不自行复制常量）

#### 1.3.1 存储与事件

```js
// src/org/contracts.js
export const ORG_SCHEMA_VERSION = 1;
export const ORG_STATE_FILE = '.orch/org/state.json';
export const ORG_EVENTS_FILE = '.orch/org/events.jsonl';
export const ORG_AUDIT_FILE = '.orch/org/audit.jsonl';

export const ID_PREFIX = Object.freeze({
  role:'ROLE', employee:'EMP', team:'TEAM', workflow:'WF', workItem:'WI',
  run:'RUN', task:'TASK', assignment:'ASSIGN', employeeSession:'ES',
  hostBinding:'HB', attempt:'ATT', artifact:'ART', event:'EVT', audit:'AUD'
});

// 严格逐字对齐规格 §13，不多不少；原型 waiting_queue / human_waiting 禁止加入
export const WORK_ITEM_STATUS = Object.freeze([
  'draft','configured','ready_to_run','running','waiting_human','blocked',
  'ready_for_acceptance','accepted','delivered','cancelled'
]);
export const TASK_STATUS = Object.freeze([
  'waiting_dependency','ready','assignment_prepared','preflight','creating_session','running','succeeded',
  'interrupted','blocked','failed','cancelled','skipped'
]);
export const ASSIGNMENT_STATUS = Object.freeze([
  'draft','prepared','preflight','locked','released','failed'
]);
export const ASSET_STATUS = Object.freeze(['draft','published','deprecated']);
export const NODE_TYPES = Object.freeze(['agent','human']);
export const AUDIT_TYPES = Object.freeze([  // 实现约定
  'role.published','employee.updated','team.published','team.deprecated',
  'workflow.published','workflow.deprecated','work_item.created','plan.revised',
  'mapping.changed','assignment.locked','session.created','recovery.succeeded',
  'recovery.failed','human.approved','delivery.accepted','delivery.delivered'
]);
export const EVENT_TYPES = Object.freeze([  // 实现约定；所有任务只能从这里取值
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
export const ERROR_CODES = Object.freeze([  // 实现约定；领域层与 HTTP 层共用
  'ORG_INVALID_INPUT','ORG_NOT_FOUND','ORG_REV_CONFLICT','ORG_ILLEGAL_TRANSITION',
  'ORG_FORBIDDEN_FIELD','ORG_DUPLICATE_ID','ORG_DUPLICATE_VERSION','ORG_ROLE_NOT_QUALIFIED','ORG_ROLE_GAP',
  'ORG_NO_CANDIDATE','ORG_SERIAL_QUEUE','ORG_ASSIGNMENT_LOCKED','ORG_CLI_UNAVAILABLE',
  'ORG_CLI_CAPABILITY_GAP','ORG_SESSION_CONFLICT','ORG_RECOVERY_UNAVAILABLE',
  'ORG_APPROVER_INVALID','ORG_DELIVERY_INCOMPLETE','ORG_SNAPSHOT_MISMATCH'
]);
export const TRANSITIONS = Object.freeze({  // assertTransition 是唯一判定入口
  workItem: {
    draft:['configured','cancelled'], configured:['ready_to_run','cancelled'],
    ready_to_run:['running','cancelled'],
    running:['waiting_human','blocked','ready_for_acceptance','cancelled'],
    waiting_human:['running','ready_for_acceptance','cancelled'],
    blocked:['running','ready_for_acceptance','cancelled'],
    ready_for_acceptance:['accepted','cancelled'], accepted:['delivered'],
    delivered:[], cancelled:[]
  },
  task: {
    waiting_dependency:['ready','skipped','cancelled'],
    ready:['assignment_prepared','blocked','cancelled'],       // 人工节点停 ready，由 WorkItem.waiting_human 表达
    assignment_prepared:['preflight','blocked','cancelled'],   // 排队用 run.queue，不改 Task 状态（§6.3）
    preflight:['creating_session','failed','assignment_prepared'],
    creating_session:['running','failed','interrupted'],
    running:['succeeded','interrupted','blocked','failed','cancelled'],
    interrupted:['preflight','running','cancelled'], blocked:['ready','failed','cancelled'],
    failed:['ready','cancelled'], succeeded:[], cancelled:[], skipped:[]
  },
  // §13.5 六态无 cancelled，取消走 failed / released
  assignment: {
    draft:['prepared'], prepared:['preflight'], preflight:['locked','failed','prepared'],
    locked:['released','failed'], released:[], failed:['draft','prepared']
  },
  // §13.2/§13.3 链为 draft→published→deprecated；草稿不可直接停用
  team: { draft:['published'], published:['deprecated'], deprecated:[] },
  workflow: { draft:['published'], published:['deprecated'], deprecated:[] }
});
export const ID_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{3,}$/;
```

状态文件顶层结构（数组固定，新字段只追加末尾）：

```js
{
  schemaVersion: 1, rev: <number>, updatedAt: <ISO>,
  roles: [], employees: [], teams: [], workflows: [],
  workItems: [], nodeExecutorPlans: [],   // §1.1 十核心对象之一，独立建模
  assignments: [], sessions: {employees:[], hostBindings:[], attempts:[]},
  runs: [], deliveries: [], cliPool: {installs:[], scan:{mode,startedAt,finishedAt,status}},
  artifacts: []
}
```

Store API（唯一写入口）：

```js
const store = createOrgStore({ root, now: () => new Date().toISOString() });
store.read();                                   // 深拷贝快照
store.get(kind, id); store.list(kind);
store.transit(mutator, { expectedRev, reason, actor });
//  mutator(draft) 只改 draft；返回 {ok:true,value,events?:[]} 或 {ok:false,code,params}
//  成功：原子写 state.json(rev+1) → 追加 events/audit → 最后广播；失败不改内存
store.nextId(kind);                    // 仅 transit mutator 内，按最大序号 +1
store.snapshot(kind, id, version);     // 深拷贝 + {snapshotOf:{kind,id,version},capturedAt}
store.assertTransition(kind, from, to); // 走 TRANSITIONS，失败 ORG_ILLEGAL_TRANSITION
store.appendEvent(event); store.appendAudit(event);  // 仅 transit 内部
store.events({ workItemId, runId, type, limit }); store.audit({ type, limit });
```

**快照结构**（`workflowSnapshot`/`teamSnapshot` 必须按此存，不能只存 ID）：`{snapshotOf:{kind:'workflow'|'team',id,version}, capturedAt:'<ISO>', definition:{完整深拷贝}}`。「仅用于本次」的资产用 `WF-SNAPSHOT-<workItemId>` / `TEAM-SNAPSHOT-<workItemId>` 作 `snapshotOf.id`，不写入 `workflows[]`/`teams[]`；「保存到库」先分配正式 ID 与版本再快照引用。

对象形状（最小字段，允许追加；禁止「禁止字段」列）：

| 实体 | 必需字段 | 禁止字段 |
|---|---|---|
| CLIInstall | `id,name,path,version,adapter,capabilities,health,auth,resumable,fingerprint,source` | 员工/团队/Session 归属 |
| Role | `id,name,description,duties,skills[],inputs[],outputs[],requires{},acceptance[],version,status,versions[]` | 员工/团队/CLI ID |
| Employee | `id,name,description,qualifications:[roleId],enabled,createdAt,updatedAt` | `cliId`,`teamId`,`sessionId`,单一 `roleId` |
| Team | `id,name,description,version,status,versions[],members:[{employeeId,roles[],primary,priority,participate,capacity}],createdAt` | `workflowId`,CLI/Session 字段 |
| Workflow | `id,name,description,version,status,kind,nodes[],edges[],versions[],createdAt` | `employeeId`,`teamId`,`cliId` |
| Node(agent) | `id,type:'agent',name,roleId,instruction,inputs[],outputs[],deps[],capabilities{},acceptance[],timeout,failurePolicy,retry,fallback,escalation,handoff,condition`（§4.1 四项并列策略） | 员工 ID/CLI ID |
| Node(human) | `id,type:'human',name,human:{approver,condition},inputs[],outputs[],deps[],acceptance[]` | 节点级 `roleId/employeeId/cliId/sessionId`、`mode`/`timeout`；`approver` 只放 Role ID 或审批岗位 |
| WorkItem | `id,title,description,background,goal,projectDir,workspace,attachments[],referenceRefs[],priority,creator,createdAt,status,workflowSnapshot,teamSnapshot,nodeExecutorPlanId,runId,historyRuns[],planRevisions[],deliveryRecord` | 宿主会话细节 |
| NodeExecutorPlan | `id,workItemId,workflowSnapshotId,teamSnapshotId,mapping:{[nodeId]:employeeId\|null},createdAt,updatedAt` | 宿主会话/CLI 绑定 |
| Task Assignment | `id,runId,taskId,nodeId,employeeId,cliInstallationId,cliFingerprint,adapterVersion,workingDir,inputArtifactRefs,permissions,status`（§7.2 11 项） | 员工档案或团队定义的修改（§1.2） |
| EmployeeSession | `id,employeeId,status,contextRefs[],checkpointRef,createdAt,updatedAt` | 员工档案属性 |
| HostBinding | `id,employeeSessionId,cliInstallationId,adapter,hostSessionId,resumable,compatible,capabilities,status,lastActivity` | 员工身份本身 |
| Attempt | `id,taskId,assignmentId,employeeSessionId,hostBindingId,resumedFrom,status,startedAt,endedAt,checkpointRef,artifactRefs[],activity[],error` | — |
| Run | `id,workItemId,workflowVersion,teamVersion,tasks[],queue:[{taskId,reason,queuedAt}],status,createdAt,finishedAt,stats` | — |
| Artifact | `id,name,kind,workItemId,runId,taskId,employeeId,cliInstallationId,attemptId,handoffId,path,createdAt` | — |

错误与事件格式：领域函数统一 `{ok:true,value}` / `{ok:false,code:'ORG_<CODE>',params:{}}`；事件（events.jsonl 与 audit.jsonl 同行）`{id,seq,ts,type,actor,refs:{workItemId,runId,taskId,assignmentId,employeeId,cliInstallationId,employeeSessionId,hostBindingId,attemptId},payload:{},prevHash,hash}`，`hash=sha256(canonicalize({无 hash 字段}))`。

#### 1.3.2 HTTP API 契约

全部挂 `/org/`，`Content-Type: application/json`；错误沿用 `{ok:false,code,params}`，HTTP 400（校验）/404（不存在）/409（状态冲突）。各域导出路由片段 `export function createorgXRoutes(deps){return [{method,pattern,handler}]}`；T15 汇总挂载。

| 前缀 | 方法/路径 | 任务 |
|---|---|---|
| `/org/cli` | `GET /`、`POST /`、`POST /scan`(body `{mode:'quick'|'full'}`)、`POST /:id/health`、`GET /:id/capabilities` | T02 |
| `/org/roles` | `GET /`、`POST /`、`GET /:id`、`GET /:id/refs`、`PUT /:id`、`POST /:id/publish`、`POST /:id/deprecate` | T03 |
| `/org/employees` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/toggle` | T04 |
| `/org/teams` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`POST /:id/publish`、`POST /:id/deprecate`、`POST /:id/copy` | T05 |
| `/org/workflows` | `GET /`、`POST /`、`GET /:id`、`PUT /:id`、`GET /:id/graph`、`POST /:id/publish`、`POST /:id/deprecate`、`POST /:id/copy` | T06 |
| `/org/work-items` | `GET /`、`POST /`、`GET /:id`、`POST /:id/preflight`、`POST /:id/start`、`POST /:id/cancel`、`POST /:id/revise` | T07 |
| `/org/mapping` | `GET /:workItemId/candidates`、`PUT /:workItemId`、`GET /:workItemId/conflicts` | T08 |
| `/org/assignments` | `POST /prepare`、`GET /:id`、`PUT /:id`、`POST /:id/start`、`POST /:id/release` | T09 |
| `/org/sessions` | `GET /:employeeId`、`GET /:employeeId/bindings`、`POST /:employeeId/ensure`、`POST /:bindingId/wake` | T10 |
| `/org/runs` | `GET /`、`GET /:id`、`POST /:id/tasks/:taskId/queue`(实现约定)、`POST /:id/tasks/:taskId/complete`、`POST /:id/tasks/:taskId/interrupt`、`GET /:id/events` | T11 |
| `/org/recovery` | `GET /:taskId/options`、`POST /:taskId/recover-original`、`POST /:taskId/recover-checkpoint` | T12 |
| `/org/human` | `POST /:taskId/approve`、`POST /:taskId/reject`、`GET /:taskId/policy` | T13 |
| `/org/records` | `GET /artifacts`、`GET /artifacts/:id/trace`、`GET /events`、`GET /audit`、`GET /:workItemId/delivery`、`POST /:workItemId/deliver` | T14 |

**T15 精确挂载点**：`routes.js` 顶部加 `import { createOrgRoutes } from './org-routes.js';`；`createRoutes` 内 `const routes = [` 之前加 `const orgRoutes = createOrgRoutes({root:projectRoot});`；`return routes;` 之前加 `routes.push(...orgRoutes);`。`createOrgRoutes` **构造期零 IO**（不读 `.orch/org/**`、不建目录、不抛异常），store 首次请求懒创建并缓存——`http/server.js:263-284` 静默吞构造异常，构造期抛错会让整个 REST 退化 503。保持 `{method,pattern,handler}` 形状与既有路由顺序，不改 `shapeSnapshot`/`attachLazySeams`。

#### 1.3.3 桌面 UI 契约（对齐现有壳）

现状：`desktop/ui/shell/pages.js` 页面函数 `render(ctx)` 返回 DocumentFragment/DOM 节点（非 HTML 字符串）；`ctx` 由 `buildShellContext`（`app.js:2950`）构造，字段 `{state,model,labels,t,st,actions,view,instanceId,instanceRow,graph,viewTitle,crumbs,...}`，**无** `api/nav/toast/modal/refresh`；`PAGE_BY_VIEW` 是 `shell/index.js:25` 的冻结映射。

```js
// desktop/ui/org/<domain>-page.js
export const viewId = 'org-work-items';     // 唯一，加入 PAGE_BY_VIEW
export const section = 'work_items';        // nav.js 分组 id
export function render(ctx) {               // 返回 DocumentFragment；纯渲染不 fetch
  const frag = document.createDocumentFragment();
  // 只用 ctx.org.data / ctx.t / ctx.st；事件只写 data-action / data-arg
  return frag;
}
export const actions = { 'org-wi-open': async (arg, ctx) => {} };  // T16 注册进 handleAction
```

**数据装载**（T16 统一，页面不各自 fetch）：`app.state()` 加 `org:{view,data,loading,error,selected}`；`app.loadOrg(view,params)` 调 `/org/*` 成功后更新 `state.org` 再 `paint()`；`buildShellContext` 加 `org:state.org` 与 `orgApi:{get,post,put}`（错误按 `{ok:false,code,params}` 抛）；`handleAction` 在 `nav`/`org-*` 分支先 `await app.loadOrg(...)` 再 `paint()`；输入控件带 `data-field`；`pointerdown` 与 `click` 同时派发（600ms 去重）；导航锚点唯一化（`.sidebar [data-section=…]`、`.secbar .sec-tab[data-tab=…]`）。

**文案**：所有用户可见串走 `ctx.t('ORG_...')`；新增键必须作为 `src/cli/labels.js` 的 `DESKTOP_V2_LABEL` 成员追加（`src/daemon/http/labels.js:347` 已展开该表，经 `GET /ui/labels` 下发），不得另建 `ORG_LABEL` spread（会撞 `labels-desktop.test.js:776` 与 `labels-drill.test.js:367-372` 精确计数）；同步追加 `EXPECTED_V2_KEYS`/`EXPECTED_V2_VALUES`（append-only，既有行逐字不变）；键必须真被下发。

**导航**：规格 §11 的 9 组（启动与资源 / 需求工作台 / 执行中心 / 团队库 / 工作流库 / 员工档案 / 角色库 / 产物与事件 / 系统设置）由 T16 在 `nav.js` 扩展，保留现有 5 组与历史 view ID 深链兼容；页面模块不得直接改导航。

**流程图**：`desktop/ui/org/graph.js`（T06 独占）导出 `layoutDag(nodes,edges)`、`validateDag(nodes,edges)`、`renderGraph({nodes,edges,mode,stateMap,selected,onSelect,onEdit})`；`mode ∈ definition|runtime|edit`，交互含缩放、适应画布、拖动平移、点选、上下游高亮（实现约定，形态参考原型 `showWorkflowDag`/`graphHTML`/`graphRefresh`；规格 P07/P11 只要求 DAG 画布与多视图）；返回 SVG/DOM 节点不返回字符串；前后端共享 `{level,order}` 布局数据。

#### 1.3.4 与引擎的桥接（T10 独占，按真实导出）

现状：`src/adapter/factory.js` 只导出 `createAdapterFactory({root,hostId,env,clock})` 返回 `{create({hostId,cwd})}`；内部 `buildAdapter` 未导出；`factory.create()` 固定 `initialize→newSession`，**只能首次创建不能恢复**。`acp-client.js` 导出 `createAcpClient({transport,limits,clock})`，客户端含 `initialize/newSession/resumeSession/loadSession/prompt/cancel/closeSession`；`normalizeCapabilities` 判断 `canResume/canLoad`。factory 读 `<root>/.orch/hosts/<hostId>.json`（`host-config.js:39`），不读 V3.2 CLI 安装记录。

```js
// src/org/bridge.js
export function createBridge({ root, store, now }) {
  return {
    async createHost({ assignment, employeeSession }),  // 首次/策略B：写 host profile（不覆盖）后走 factory.create
    async wakeHost({ binding, attempt }),               // 策略A：createStdioTransport + createAcpClient → initialize → resume/load
    async pollActivity({ bindingId, since }),
    async stopHost({ bindingId, reason })
  };
}
```

`src/org/host-profile.js`：为每 CLI 安装生成 `.orch/hosts/org-<installId>.json` = `{id,launch:{command,args,env},limits:{...}}`；只写 `org-` 前缀，绝不覆盖用户配置；`hostId` 用 `org-` + 安装 ID 安全 slug。`wakeHost` 必须 `initialize` 读能力，按 `canResume → resumeSession`、`canLoad → loadSession` 顺序尝试；两者都不可用返回 `ORG_RECOVERY_UNAVAILABLE`，**不得回落 newSession**（那是策略 B，须 T12 显式选择）。复用 `createAdapterFactory`/`createStdioTransport`/`createAcpClient`/`normalizeCapabilities`/`createNormalizer`/`resolveDshLaunch`；T10 不改 `src/adapter/**`。

### 1.4 测试组织约定

- 新测试统一 `test/wp21/org-*.test.js`，夹具 `test/wp21/fixtures/org-*.json`。
- 单文件 `NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/wp21/org-<域>.test.js"`；本域全跑同前缀 + `"test/wp21/org-*.test.js"`，**必须带条数下界** `tests >= 本任务新增数 && fail === 0`（glob 空匹配会「0 测试 exit 0」假绿）；全量 `NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/**/*.test.js"`（引号必须保留）。
- 任务详情里写 `test/wp21/xxx.test.js` 简写时，执行必须补全为上述完整命令；漏 `NODE_ENV=test` 会让 `/__test__/*` 接缝不注册而假红。
- 所有测试用临时目录（`fs.mkdtempSync(path.join(os.tmpdir(),'org-'))`），结束清理；禁止读写真实 `~/.maestro`、`~/.orch` 或仓库内其它迭代证据目录。

---

## 2. 覆盖矩阵（任务并集 = 全部需求）

### 2.1 规格章节 → 任务

| 规格章节 | 内容 | 主责 | 协同 |
|---|---|---|---|
| §1 核心对象/隔离/关系 | 10 对象、8 隔离、10 关系 | T01 | 全部 |
| §3 团队模型 | 定义/成员角色/复用/新建来源 | T05 | T04,T07 |
| §4 工作流模型 | Agent 10 项（`index.md` 为准，`page_spec.md` 拆 11 项）/人工节点/复用 | T06 | T03,T13 |
| §5 Work Item | 正文 14 字段/四种组合/五步向导（无 §5.3） | T07 | T05,T06,T08 |
| §6 执行人映射 | 独立映射/自动匹配/并行冲突/替换 | T08 | T07,T09 |
| §7 CLI 与分配 | 扫描 8 项/Assignment 11 项/6 态 | T02,T09 | T10 |
| §8 会话生命周期 | 不建会话 6 操作/两层身份/启动 8 步/串行 | T10 | T09,T11 |
| §9 中断与恢复 | 11 项保留/策略 A·B/失败保持中断 | T12 | T10,T11,T14 |
| §10 链路 A/B/C/D | 四链路全部步骤与分支 | T07,T11,T12 | T05–T10 |
| §11 信息架构 | 一级导航 9 组 | T16 | 全部 |
| §12 P00–P16 | 见 §2.2 | 见 §2.2 | — |
| §13 状态机 | 见 §2.3 | 见 §2.3 | — |
| §14 异常边界 | 10 条，见 §2.5 | T05–T14 | — |
| §15 原型覆盖范围 | 演示参考非需求源，用例以 §16 为准 | T16 | — |
| §16 验收用例 | V32-01～17，见 §2.4 | T17 | 全部 |

### 2.2 P00–P16 → 任务

| 页面 | 主责 | 页面 | 主责 |
|---|---|---|---|
| P00 本机 CLI 扫描 | T02 | P09 角色库 | T03 |
| P01 需求工作台 | T07 | P10 执行中心 | T11 |
| P02 五步向导 | T07+T08 | P11 工作流执行视图 | T11 |
| P03 需求详情 | T07+T14 | P12 节点分配面板 | T09 |
| P04 团队库 | T05 | P13 员工活动面板 | T11 |
| P05 团队编辑器 | T05 | P14 任务与会话详情 | T10+T11 |
| P06 工作流库 | T06 | P15 中断恢复 | T12 |
| P07 工作流编辑器(DAG) | T06 | P16 产物与事件 | T14 |
| P08 员工档案 | T04 | 系统设置/验收自检 | T16+T17 |

### 2.3 状态机 → 任务

| 状态机 | 合法迁移 | 任务 | 关键断言 |
|---|---|---|---|
| WorkItem §13.1 | `draft→configured→ready_to_run→running→waiting_human/blocked→ready_for_acceptance→accepted→delivered`，另 `cancelled` | T07+T11+T14 | 非法迁移 `ORG_ILLEGAL_TRANSITION` 且不落盘；`waiting_human`/`blocked` 可直接进 `ready_for_acceptance`（规格链式写法），也可先回 `running` |
| Team §13.2 | `draft→published→deprecated` | T05 | publish 生成新版本；deprecated 不可选为新需求 |
| Workflow §13.3 | `draft→published→deprecated` | T06 | 发布后修改生成新版本；旧快照不变 |
| Task §13.4 | `waiting_dependency→ready→assignment_prepared→preflight→creating_session→running→succeeded`，异常 `interrupted/blocked/failed/cancelled/skipped`（严格 12 态，无 `waiting_queue`/`human_waiting`） | T11 | 依赖未完成不可 ready；完成后解锁下游；排队用 `Run.queue`，人工等待用 `waiting_human` |
| Assignment §13.5 | `draft→prepared→preflight→locked→released`，分支 `failed`（无 `cancelled`） | T09 | `prepared` 无 Session；`locked` 后员工/CLI 不可改 |
| 会话 §13.6 | Employee Session 长期稳定；Host Binding 按 CLI/Adapter，不跨 CLI 复用 | T10 | 跨 CLI 必然新 Binding；Employee Session ID 不变 |

### 2.4 V32-01～17 → 任务与验证落点

| 用例 | 场景 | 任务 | 自动化断言（T17） |
|---|---|---|---|
| V32-01 | 已有工作流+已有团队 | T07 | WorkItem 持两快照，无对方 ID 字段 |
| V32-02 | 新建工作流+新建团队 | T07+T05+T06 | 两种「仅本次/保存到库」成功；仅本次不进公共库 |
| V32-03 | 团队被多工作流复用 | T05 | team 无 `workflowId`；两 WorkItem 引用同 team 版本 |
| V32-04 | 工作流被多团队复用 | T06 | workflow 无 `teamId/employeeId`；DAG 可渲染 |
| V32-05 | 节点匹配团队成员 | T08 | 每个 agent 节点映射成员具备 roleId 资格 |
| V32-06 | 缺少角色覆盖 | T07 preflight | `ORG_ROLE_GAP` 列缺失角色，无法创建 |
| V32-07 | 同员工并行节点 | T08+T09 | 提示串行；可改派或排队；无并发写同一 Session |
| V32-08 | 创建 Work Item | T07 | `status=configured`，无 Assignment/Session/CLI |
| V32-09 | 节点 Ready | T09 | 候选来自本次团队快照；CLI 来自资源池且能力匹配 |
| V32-10 | 保存 Prepared | T09 | 有员工+CLI，Session 数为 0，可修改 |
| V32-11 | 启动节点 | T09+T10 | `locked`；按需建 Employee/Host Session；Attempt 存在 |
| V32-12 | 员工更换 CLI | T09+T04 | Employee Profile/Team 无变化；仅新 Assignment 选新 CLI |
| V32-13 | 恢复原宿主 | T12 | 兼容可恢复→继续原 Attempt；不可用→保持 interrupted+审计 |
| V32-14 | 跨 CLI 检查点恢复 | T12 | 新 Binding+新 Attempt，`resumedFrom` 指旧 Attempt，Employee Session ID 不变 |
| V32-15 | 修改团队/工作流资产 | T05+T06+T07 | 发布新版本后旧 WorkItem 快照逐字不变 |
| V32-16 | 人工节点 | T06+T11+T13 | 无 `employeeId/cliId/sessionId`；批准写审计 |
| V32-17 | 交付验收 | T14 | `accepted→delivered`，`deliveryRecord` 含测试/风险/验收人，事件可追溯 |

### 2.5 异常边界与链路 → 任务

| §14 异常边界 | 任务 |
|---|---|
| 1 角色未覆盖→阻止确认并列缺失角色 | T07 |
| 2 同员工并行→提示+改派/排队 | T08,T09 |
| 3 团队成员停用→未启动重映射、运行中走中断恢复 | T04,T08,T12 |
| 4 团队修改→快照不变 | T05,T07 |
| 5 工作流修改→旧 Run 用旧版本 | T06,T11 |
| 6 CLI 启动前失效→Assignment 保持可编辑、不建 Session | T02,T09 |
| 7 CLI 运行中断连→保留引用进入恢复 | T12 |
| 8 员工在别的 WorkItem 执行→排队/改派/等待 | T10,T11 |
| 9 仅用于本次→WorkItem Snapshot，不进资产库 | T05,T06,T07 |
| 10 保存到库→先建资产版本再引用 | T05,T06,T07 |

链路 A（已有+已有）→T07；B（新建+新建）→T05+T06+T07；C（节点执行）→T09+T10+T11；D（异常恢复）→T12+T14。四链路端到端脚本由 T17 串起来。

---

## 3. 波次与排程

### 3.1 波次表（A/B 两台机器）

| 波次 | 机器 A | 机器 B | 同步点（都合入 main 才进下一波） |
|---|---|---|---|
| W0 阻塞 | T01 契约与存储 | 等待/只做文档阅读 | main 含 `contracts.js`、store 测试全绿、`T00-R0-1` 门禁基线恢复且探针通过（此处首次复跑全量门禁） |
| W1 资产 | T02 CLI 池、T03 角色库、T05 团队库 | T04 员工档案、T06 工作流与 DAG | 四类资产 API+页面可独立打开，资产域测试全绿 |
| W2 需求 | T07 WorkItem 与五步向导 | T08 映射与并行冲突 | 能创建含快照+映射的 WorkItem；预检拒绝角色缺口 |
| W3 分配 | T09 Assignment 生命周期 | T10 两层会话与桥接 | `prepared` 无会话、`locked` 有会话；跨 CLI 不复用 Binding |
| W3b 执行 | T11 Run 编排与执行视图 | T12 恢复 A/B | Task DAG 可跑到 succeeded；两种恢复可验证 |
| W4 治理 | T13 人工门禁 | T14 产物/事件/审计/交付 | 人工节点无会话；交付可追溯 |
| W5 接入 | T15 路由聚合 | T16 桌面壳与文案 | `/org/*` 全通；桌面可从导航进入全部页面 |
| W6 收口 | T17 17 条验收自动化 | T18 全量回归与门禁 | 17/17 通过；差集 0；门禁 exit 0 |

**本表是静态建议不是认领结果**：每次开工前按 §0.10.3 读台账判定实际状态；自己排程的任务被对方认领/完成则顺延，禁止重复实现。W3b 的 T12 与 T11 并行开发时只能依赖 T01 契约 + `test/wp21/fixtures/org-run.json` 假数据，不得提前引用 T11 未合入的函数签名。

### 3.2 同步点检查（每波次结束）

```bash
git fetch origin && git switch main && git pull --ff-only origin main
NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/wp21/org-*.test.js"   # 检查 tests >= 已合入域测试数
node scripts/desktop/gate.mjs --skip-tests
```

两机报告写「同步点已过 + main sha」；对方任务未合入则等待，不自行实现对方能力。

---

## 4. 任务详单

### T00（前置，主线负责人）冻结基线并推送

- **分支**：不建功能分支，直接在 main（唯一例外，仅基线/台账初始化提交）。
- **R0-1** 恢复门禁基线（`docs/iterations` 已在 `806d17c` 被删，`gate.mjs:24,89-93` 依赖）：
  ```bash
  mkdir -p docs/iterations/iteration-7 docs/iterations/iteration-10a
  git show 7b71cd4:docs/iterations/iteration-7/baseline-failures.txt > docs/iterations/iteration-7/baseline-failures.txt
  git show 7b71cd4:docs/iterations/iteration-10a/baseline-failures-win32.txt > docs/iterations/iteration-10a/baseline-failures-win32.txt
  git add docs/iterations/iteration-7/baseline-failures.txt docs/iterations/iteration-10a/baseline-failures-win32.txt
  git commit -m "chore(org): 恢复门禁基线文件"
  ```
- **R0-2** 建 `docs/org/reports/` 占位。
- **R0-2b** 初始化双机认领台账（**必须在 R0-4 公布 sha 之前**）：
  ```bash
  mkdir -p docs/org/claims
  printf '{"machine":"A","updatedAt":"","claims":[]}\n' > docs/org/claims/machine-A.json
  printf '{"machine":"B","updatedAt":"","claims":[]}\n' > docs/org/claims/machine-B.json
  git add docs/org/claims/ && git commit -m "chore(org): 初始化双机认领台账"
  ```
- **R0-3** 确认 main 含本规划、R0-1、R0-2b，推送 `origin/main`。
- **R0-4** `git rev-parse HEAD`，公布为唯一 `baseSha`（须含 R0-1 基线恢复提交）。
- **验证**：`git rev-parse origin/main` 等于公布的 `baseSha`；`node scripts/desktop/gate.mjs --skip-tests` exit 0（**注意**：此分支不读基线文件，通过不代表全量门禁可跑）；
  ```bash
  node -e "const fs=require('fs');['docs/iterations/iteration-7/baseline-failures.txt','docs/iterations/iteration-10a/baseline-failures-win32.txt'].forEach(f=>{if(!fs.readFileSync(f,'utf8').trim())throw Error(f+' empty')});console.log('baselines readable')"
  node -e "const fs=require('fs');['A','B'].forEach(m=>{const p='docs/org/claims/machine-'+m+'.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.machine!==m||j.claims.length!==0)throw Error(p+' invalid')});console.log('claims ready')"
  ```
  `test -s docs/iterations/iteration-7/baseline-failures.txt` 且行数与 `git show 7b71cd4:... | wc -l` 一致。
- **完成**：两机都能从该 sha 建分支；基线文件在 origin/main 且探针通过；空台账已推送可供 §0.10.3 读取。全量门禁首次可跑在 T01 合入后同步点复验。

### T01（W0，阻塞全局）领域契约与 CAS 存储内核

- **分支** `feature/org-T01-contracts`；**依赖**：无（必须最先合入）。
- **T01-R1** 按 §1.3.1 导出全部常量；状态枚举与规格 §13 逐字一致且不多不少——Task 恰 12 态无 `waiting_queue`/`human_waiting`，Assignment 恰 6 态无 `cancelled`；单测断言逐项相等。
- **T01-R2** `validate(kind,obj)` 按对象表逐字段校验，禁止字段存在（Employee 有 `cliId`、Team 有 `workflowId`、Workflow 节点有 `employeeId`、人工节点有 `cliId`）返回 `ORG_FORBIDDEN_FIELD`。
- **T01-R3** `createOrgStore()` 读 `.orch/org/state.json`，不存在按顶层结构初始化；`read()` 深拷贝，`get/list` 只读。
- **T01-R4** `transit(mutator,{expectedRev,reason,actor})` 唯一写入口：基于磁盘最新快照校验 `expectedRev`，不等返回 `ORG_REV_CONFLICT`；成功后 `rev+1`、原子写、再追加事件/审计，最后返回新快照；失败不改内存。
- **T01-R5** 事件/审计哈希链：`EVT-###`/`AUD-###`，`seq` 单调、`prevHash` 指向上一条、规范化后 sha256；`verifyChain()`；`events()/audit()` 按 workItemId/runId/type 过滤与 limit。
- **T01-R6** 每次 `transit` 若 events 含 `AUDIT_TYPES` 自动写 `audit.jsonl`；人工审批/恢复/交付三类缺一不可。
- **T01-R7** 提供 `test/wp21/fixtures/org-*.json`：role、employee、team、workflow（含 agent+human 节点）、workItem、run、assignment；字段完全符合契约。
- **T01-R8** `src/org/index.js` 只导出 W0 已存在模块，禁止 `export * from` 指向未创建模块（否则 `ERR_MODULE_NOT_FOUND`）；跨任务一律相对路径 import 具体文件，禁止 import `index.js`；T15 从各 `*-routes.js` 直接汇总；index.js 聚合导出由 T01 在 W5 统一补一次。
- **T01-R9** `nextId(kind)` 仅在 transit mutator 内，按前缀现有最大序号 +1（非数组长度），同事务连续递增；匹配 `ID_PATTERN`，重复返回 `ORG_DUPLICATE_ID`；快照 ID 用 `snapshotId(kind,workItemId)`（`WF-SNAPSHOT-WI-001`/`TEAM-SNAPSHOT-WI-001`）。
- **T01-R10** 导出 `TRANSITIONS` 与 `canTransition/assertTransition`；所有状态写入必须调 `assertTransition`，非法返回 `ORG_ILLEGAL_TRANSITION` 且不落盘；错误码只能取 `ERROR_CODES`。
- **T01-R11** `snapshot(kind,id,version)` 返回 `{snapshotOf:{kind,id,version},capturedAt,definition}`，`definition` 深拷贝；保存后外部改原对象不影响快照；读取返回深拷贝。
- **T01-R12** 事件类型只能取 `EVENT_TYPES`，未知返回 `ORG_INVALID_INPUT`；`refs` 只放相关 ID，缺失用 `null` 不省略字段。
- **T01-R13** `root` 必须绝对路径；`read()` 文件不存在返回空结构且不创建目录；首次 `transit` 才创建 `.orch/org/`；测试用临时 root。
- **T01-R14** 版本用 `major.minor`，首次 `1.0`，每次 publish 递增 minor（`1.0→1.1`），`versions` append-only；重复版本返回 `ORG_DUPLICATE_VERSION`。
- **验证**：`node --test "test/wp21/org-contracts.test.js"`（禁止字段全拒、枚举逐项相等含反向断言、非法迁移拒、未知码/事件拒）；`org-store.test.js`（并发 transit 一个成功、rev 递增、过期 expectedRev 冲突、失败不改文件、并发 nextId 不重号、快照深拷贝隔离）；`org-events.test.js`（哈希链、顺序、过滤、审计自动写）；全量差集 0（对照 origin/main 基线树）。完整命令按 §1.4 补全。
- **完成**：三套单测全绿 + 夹具存在且经 `validate()` 校验并被自己测试加载 + 报告落盘。「被 ≥2 后续任务引用」移到 W2 同步点与 T18-R4 复核，不作 W0 提交前置。

### T02（W1）CLI 资源池：真实扫描、能力与健康检查

- **分支** `feature/org-T02-cli-pool`；**依赖** T01。
- **T02-R1**（P00/§7.1）快扫发现路径与名称；完整扫补版本、Adapter/协议、能力、健康、认证、恢复能力；扫描写 `cliPool.scan` 进度，界面显示阶段；探测不到写 `unknown` 并注明原因，不得伪造可用/已认证。
- **T02-R2** 复用 `src/adapter/cli-discovery/{discover,probe}.js`，只读引用；不把 `npx geiger-scan` 作运行时依赖。
- **T02-R3** 扫描只更新资源池；断言不创建 Employee/Team/Session/WorkItem。
- **T02-R4**（§7.1 八项）手动加路径落 `installs[]`，字段覆盖规格八项；`fingerprint` 算法、`source`、`stale` 为实现约定（规格未规定），用于去重与 Assignment 固定执行环境。
- **T02-R5** 健康检查回写 `health`（四态枚举为实现约定）；失效 CLI 可被 Assignment 选中但启动预检必拒（T09 消费）；探测不到写 `unknown` 不伪造。
- **T02-R6** `GET /org/cli/:id/capabilities` 输出能力矩阵供 T07/T09 预检。
- **T02-R7**（P00）`cli-page.js` 展示进度、发现/可用/异常数量、CLI 明细与「重新扫描/完整扫描/手动添加/健康检查」入口；`ORG_CLI_*` 文案键写报告交 T16。
- **验证**：`org-cli-pool.test.js` mock 4 个 CLI（2 可用/1 失效/1 unknown），断言八项齐全、两阶段事件、手动添加落库、fingerprint 去重、扫描不产生其它实体；API 冒烟 `POST /org/cli/scan` body `{mode:'quick'}` → 200 且 `scan.status` running→done，`GET /org/cli` 返回数组；CDP 页面有进度条与 3 行 CLI，零 CJK。
- **证据分级**：mock 实测（真实 CLI 探测依赖宿主，报告如实标注）。

### T03（W1）角色库（P09）

- **分支** `feature/org-T03-roles`；**依赖** T01。
- **T03-R1** Role CRUD 按 §1.3.1；`duties/skills/inputs/outputs/acceptance` 为数组，`requires` 用 `src/studio/schema.js:74 CAPABILITY_DIMENSIONS` 同款五维（只读引用不改）。
- **T03-R2** 版本与状态 `draft→published→deprecated`；publish 生成新版本写 `role.published` 审计；deprecated 不可被节点引用。
- **T03-R3**（实现约定，非 P09 验收项）只读 `GET /:id/refs`：返回被哪些工作流节点引用/哪些员工声明资格/哪些团队声明承担。
- **T03-R4**（P09）页面展示职责、技能、输入输出、能力要求、验收规则，支持新建/编辑/发布/停用；文案键交 T16。
- **验证**：`org-roles.test.js` 字段校验、非法迁移、发布新版本、停用后引用拒、`refs` 汇总；`GET /org/roles` 与 `/:id/refs` 结构一致；CDP 打开无运行时错误，`ctx.t` 键无空值。

### T04（W1）员工档案（P08）

- **分支** `feature/org-T04-employees`；**依赖** T01（与 T03 可并行）。
- **T04-R1** Employee 只存身份/名称/说明/角色资格数组/启用状态；所有写路径过 validate（`cliId/teamId/sessionId` 被拒）。
- **T04-R2** 多角色资格：一名员工可声明多个 Role ID；`toggle` 只改 `enabled` 不改资格。
- **T04-R3** 停用联动返回 `affected`（含该成员的团队、未启动映射到该员工的 WorkItem、运行中任务），供 T08/T12 消费；不自动改快照。
- **T04-R4**（P08）页面展示名称、Employee ID、说明、资格、启用状态；「加入的团队」只读；「当前任务/会话是否已创建」只在有运行态数据时展示；不提供 CLI/团队绑定入口。
- **验证**：`org-employees.test.js` 多资格写入、禁止字段拒、停用返回 affected 且快照逐字不变；`POST /:id/toggle` 后断言快照哈希不变；页面无 `cliId` 输入控件。

### T05（W1）团队库与团队编辑器（P04/P05）

- **分支** `feature/org-T05-teams`；**依赖** T01、T04（可按契约并行，W1 同步点联调）。
- **T05-R1**（§3.1）Team 含 ID/名称/描述/版本/成员列表/成员 Employee ID/团队内角色资格/主备与优先级/是否参与新分配/可选容量；禁止 `workflowId` 与 CLI/Session 字段。规格 §3 提到「并发配置」但未给字段名/取值，第一阶段由 §8.4 全局串行承担，团队不存并发字段（口径说明非规格断言）。
- **T05-R2**（§3.2）成员可承担一个或多个角色；团队角色须是员工全局资格子集，超集返回 `ORG_ROLE_NOT_QUALIFIED`。
- **T05-R3**（§3.3）创建/编辑成员/增删/调整角色/主备优先级/复制/发布新版本/停用；每次 publish 按 T01-R14 生成新版本并写审计。
- **T05-R4**（P04）库展示名称/版本/说明/成员数/角色覆盖/成员明细/最近使用 WorkItem；不显示「适用工作流」、不提供 CLI 配置。
- **T05-R5**（P05）编辑器从员工档案勾选成员、逐人选择团队内角色、设主备优先级；保存产生新版本。
- **T05-R6**（V32-03）同一团队可被多工作流引用，团队对象不变。
- **T05-R7**（§14-4）团队修改后既有 WorkItem 的 `teamSnapshot` 逐字不变。
- **T05-R8**（§3.4/V32-02）支持「保存到库」与「仅用于本次需求」；后者只进 WorkItem snapshot 不进 `teams[]`。
- **验证**：`org-teams.test.js` 禁止字段、资格子集、主备优先级、publish 递增、deprecated 不可新用、copy 不共享引用、快照隔离；`POST /:id/copy` 后原团队无变化，`GET /` 无 `workflowId`；CDP 库表格无「工作流」列、编辑器无 CLI 控件；V32-03 断言两 workflow 的 WorkItem 引用同 team 版本。

### T06（W1）工作流库与 DAG 流程图编辑器（P06/P07）

- **分支** `feature/org-T06-workflows`；**依赖** T01、T03（角色 ID 来源）。
- **T06-R1**（§4.1）Workflow 含 ID/名称/描述/版本/节点 DAG/Agent 节点 Role ID/输入输出契约/验收条件/依赖/并行汇合/条件分支/Human Task·Approval Gate/Handoff，以及 **Retry/Fallback/Escalation/Failure Policy 四项并列策略**（缺一不可，§4.1 L173–L175）；禁止 Employee ID/Team ID/CLI。
- **T06-R2**（§4.2）Agent 节点按 `index.md` §4 的 **10 项**字段齐全（输入输出合一计一项，物理字段 `inputs`、`outputs` 均实现；`page_spec.md` 拆 11 项，按 `index.md` 验收）；含 `escalation` 升级策略；缺任一字段 validate 拒。
- **T06-R3**（§4.3/V32-16）Human 节点只含 `human:{approver,condition}` 与契约字段；`approver` 只放 Role ID 或审批岗位，不得放具体 Employee ID；禁止节点级 `roleId/employeeId/cliId/sessionId`、`mode`/`timeout`；不参与员工映射。
- **T06-R4**（P06）库列表展示名称/版本/用途/节点数/Agent 与人工节点数/主要阶段与并行关系/内置·草稿·已发布；支持编辑/复制/发布新版本/用于新需求。
- **T06-R5**（P07）编辑器支持画布定义 DAG、Agent 选 Role ID、Human 定义审批人/条件、配置依赖/并行/汇合/条件/输入输出/验收/失败策略；不出现员工/团队/CLI 选择。
- **T06-R6** 后端 `src/org/graph.js` 纯计算：`layoutDag` 按层级布局、`validateDag` 检未知依赖与环；前端 `desktop/ui/org/graph.js` 做 `renderGraph`，支持 definition/runtime/edit 三模式、缩放 50%–200%、适应画布、拖动平移、点选、上下游高亮（交互细节是实现约定，形态参考原型 `showWorkflowDag`/`graphHTML`/`graphRefresh`/`graphAutoLayout`，非规格断言）；共享 `{level,order}` 布局数据。
- **T06-R7**（§4.4/V32-04）工作流可被多团队复用；对象内无 Team/Employee 字段；DAG 可渲染。
- **T06-R8**（V32-15/§14-5）修改按 T01-R14 发新版本；旧 WorkItem 快照与运行中 Run 继续用旧版本。
- **T06-R9**（V32-02）支持「保存到库」与「仅用于本次」。
- **验证**：`org-workflows.test.js` 按 10 项字段校验、禁止字段、human 约束、publish 版本、快照隔离、四复用来源；`org-dag.test.js` 环检测/未知依赖/并行标注/三模式渲染函数存在；`GET /org/workflows/:id/graph` 返回布局后 nodes/edges；CDP 编辑器图有箭头与并行标签；`python3 -c` 零 CJK 自查。

### T07（W2）Work Item 与五步创建向导（P01/P02/P03）

- **分支** `feature/org-T07-work-items`；**依赖** T02–T06（W1 全合入）。
- **T07-R1**（§5 正文）Work Item 字段齐全（ID/标题/描述/背景/目标/项目目录·工作空间/附件与参考资料/优先级/创建人时间/Workflow Snapshot 及版本/Team Snapshot 及版本/Node Executor Plan/当前 Run）；创建后 `status='configured'`；两快照固化所选版本；`nodeExecutorPlanId` 指向独立执行方案对象（§1.1 十对象之一）；`runId` 指向新建 Run，`historyRuns=[]`，`deliveryRecord=null`。
- **T07-R2**（§5.2/链路 A·B）四种组合可用；新建资产可选「仅本次」（进 snapshot 不进库）或「保存到库」（先建版本再引用）。
- **T07-R3**（§5.2/P02）五步向导严格为：①需求信息（标题/描述/背景/目标/项目目录/附件）②工作流③团队④节点执行人映射（调 T08 面板）⑤预检确认（覆盖/员工有效性/并行冲突/CLI 能力/输入资料）。
- **T07-R4**（§6.2/V32-06）`preflight` 返回逐项结果；角色未覆盖 `ORG_ROLE_GAP` 列缺失角色阻止创建；员工失效 `ORG_INVALID_INPUT`；CLI 能力无法覆盖 `ORG_CLI_CAPABILITY_GAP` 提示先扫描/添加并阻止创建。**预检只查能力覆盖，不创建 Assignment，也不要求此刻选定具体 CLI**（与 V32-08 一致）。
- **T07-R5**（V32-08）创建时只建 Task DAG，不创建 Assignment/Employee Session/Host Binding（断言三者为 0）；两快照按 §1.3.1 深拷贝，禁止只存 ID 或引用。
- **T07-R6**（§13.1）状态机：`draft→configured` 原子完成；点「启动」`configured→ready_to_run`（激活 R1 已建的 Run，不再新建也不建会话）；`ready_to_run→running` 由 T11 首任务启动触发；`waiting_human/blocked` 由 T11 触发；`ready_for_acceptance` 只由 T11 在所有 Task `succeeded` 后设置；`accepted→delivered` 由 T14；`cancelled` 可从非终态进入；非法迁移拒。
- **T07-R7**（P01）工作台展示需求数/执行中/待人工/待验收；列表含标题/关联工作流/团队/状态/创建时间。
- **T07-R8**（P03）详情展示需求内容、两快照、执行方案、当前与历史 Run、产物与事件入口；提供流程视图/节点列表/执行历史；显示「执行方案快照」与「修订」入口（逻辑 T11 提供）。
- **T07-R9**（§14-9/10）仅本次资产不进公共库；保存到库先有版本号再被引用。
- **验证**：`org-work-items.test.js` 14 字段、四组合、快照隔离、创建后零 CLI/零 Session、非法迁移；`org-preflight.test.js` 五类检查逐项、角色缺口文案含缺失角色名；CDP 五步向导可走通并返回、预检失败时「创建」disabled；V32-01/02/06/08 断言在 T17 可复用。

### T08（W2）节点执行人映射与并行冲突（§6）

- **分支** `feature/org-T08-mapping`；**依赖** T01（与 T07 并行，W2 同步点联调第 4 步）。
- **T08-R1**（§6.1/§1.1）映射写独立 `NodeExecutorPlan`（WorkItem `nodeExecutorPlanId` 引用），属本次执行方案，不写回 Workflow/Team；结构 `{[nodeId]:employeeId|null}`；human 节点固定 `null`（§6.2）。
- **T08-R2**（§6.2）候选只来自本次团队快照成员且具备节点 Role ID 资格；唯一候选自动预选；多候选按 `priority` 预选可改；无候选 `ORG_NO_CANDIDATE` 提示补成员/调资格。
- **T08-R3**（§6.3/V32-07）并行判定用**可达闭包**：两节点互不可达才算并行，传递依赖不误报；同一员工映射给并行节点返回 `ORG_SERIAL_QUEUE`，提示「同一员工将串行处理这两个节点」，可改派或接受排队。
- **T08-R4**（§6.4）节点未启动可改映射并写 `plan.revised` 审计；已启动不可覆盖当前 Attempt 执行者，须先中断/结束再新建 Assignment，默认沿用原检查点与 Artifact References（§9 策略 B），不新增「是否继承」必填交互；已完成节点历史执行者不可变。
- **T08-R5**（§14-3）团队成员停用：未启动节点映射标记需重映射，运行中节点不自动改交 T12。
- **T08-R6**（P02 第 4 步）`mapping-panel.js` 展示节点→候选成员下拉、并行冲突提示、改派/排队选择；Human 显示「不分配员工」。
- **验证**：`org-mapping.test.js` 候选资格、优先级预选、无候选拒、可达闭包（含 A→B→C 时 A/C 不算并行）、改派排队、启动后改映射拒、审计写入；`GET /org/mapping/:workItemId/conflicts` 返回冲突清单与建议；CDP 向导第 4 步并行节点映射同一员工时出现串行提示。

### T09（W3）Task Assignment 生命周期与 CLI 选择（P12/§7）

- **分支** `feature/org-T09-assignments`；**依赖** T07、T08、T02。
- **T09-R1**（§7.2）节点 Ready 后创建 Assignment，规格 11 项齐全（Task ID 与 Node ID 合并计一项，对应 12 字段）；员工默认取执行方案，可在本次团队内改选符合角色成员；CLI 从本机资源池选且满足节点 `capabilities`；设置工作目录与权限快照；输入产物引用来自上游 Artifact。
- **T09-R2**（§7.3/§13.5）`draft→prepared→preflight→locked→released`，失败进 `failed`；`prepared` 可改员工与 CLI；`locked` 后禁改（`ORG_ASSIGNMENT_LOCKED`）；`released` 在任务结束/取消时写。
- **T09-R3**（V32-10）保存 Prepared 不创建 Employee/Host Session；断言 `sessions.employees` 与 `hostBindings` 数量不变。
- **T09-R4**（V32-09/12）CLI 按能力匹配；更换 CLI 只影响本次 Assignment，Employee Profile/Team 逐字不变；失效 CLI 在 preflight 拒，Assignment 保持 `prepared` 可编辑。
- **T09-R5**（§6.3/§14-2/V32-07）占用冲突：提供「改派」与「保留并排队」；排队在 `Run.queue` 追加 `{taskId,reason,queuedAt}`（规格 §6.3 只要求 Scheduler 排队，未定义 Task 状态，禁止原型 `waiting_queue`），Task 保持 `assignment_prepared`、Assignment 保持 `prepared`（不 locked、不建 Session），员工释放后出队重走 `preflight→locked`；禁止并发写同一 Employee Session。
- **T09-R6**（P12）面板展示节点角色要求、合格成员（默认选中映射成员）、本机 CLI 候选及能力、会话计划（创建/复用/唤醒/恢复）、「保存 Prepared」「保存并启动」；启动走 `preflight→locked` 并写 `assignment.locked` 事件；会话创建由 T10/T11 消费事件完成，**T09 不直接调 T10 函数**。
- **T09-R7** Assignment 每次状态变化写事件，`locked` 写审计。
- **验证**：`org-assignments.test.js` 11 字段、能力过滤、prepared 可改、locked 拒改、prepared 零会话、失效 CLI 拒、排队不并发；**反向断言**写入前后 Employee Profile 与 Team 快照逐字不变且对象不含其字段（§1.2/V32-12）；API `POST /prepare` → prepared、`POST /start` → locked 且写出 `assignment.locked`（「事件被消费并创建会话」移到 W3 同步点，不作 T09 提交前置）；CDP 面板默认选中映射成员、CLI 下拉只出现能力匹配项。

### T10（W3）两层会话与 ACP 桥接（§8）

- **分支** `feature/org-T10-sessions`；**依赖** T01、T09（与 T09 并行开发，W3 同步点联调）。
- **T10-R1**（§8.1）以下操作都不创建会话（每条有单测）：创建 Employee Profile、加入团队、创建 Work Item、选工作流/团队、保存映射、保存 Prepared。
- **T10-R2**（§8.2）Employee Session 是员工长期逻辑身份；Host Binding 按 CLI/Adapter 维护；跨 CLI 不得复用 Host Session ID；同一 Employee Session 在不同 CLI 下可有多个 Binding。
- **T10-R3**（§8.3）节点启动 8 步：读执行员工→查 Employee Session→无则创建→按 CLI 查 Binding→兼容可恢复则唤醒→正常路径下无可用 Binding 才新建→记录 Host Session ID→创建 Attempt 并写事件。恢复路径（T12）必须走 R9：原宿主不可恢复就报错，不得在此回落新建。
- **T10-R4**（§8.4/§14-8）员工在别的 WorkItem 执行：排队/选备选/用户改派；同一员工同一时刻只允许一个前台 Attempt；不引入子会话。
- **T10-R5** `bridge.js` 按 §1.3.4 封装既有 adapter，不改 `src/adapter/**`/`src/core/**`；ACP 方言差异收敛在 bridge；公开活动只取宿主状态/工具/文件/命令/产物事件，不取私有推理。
- **T10-R6**（P14 部分）`session-panel.js` 展示 Employee Session ID、Host Binding 历史（CLI/Adapter/Host Session ID/恢复能力/状态）、Attempt 列表；无会话显示「节点启动后创建」。
- **T10-R7** 会话创建/唤醒写事件，创建写审计。
- **T10-R8** `host-profile.js` 按 `Assignment.cliInstallationId` 生成 `.orch/hosts/org-<installId>.json`（`launch.command/args/env` 来自资源池），只写 `org-` 前缀绝不覆盖用户配置；`createHost` 用 `createAdapterFactory({root,hostId}).create({cwd})` 建**新**会话。
- **T10-R9** `wakeHost` 不得用 `factory.create`（总是 newSession）：必须 `createStdioTransport + createAcpClient → initialize → canResume?resumeSession:canLoad?loadSession`；两者不可用返回 `ORG_RECOVERY_UNAVAILABLE`，不得回落 newSession（回落是策略 B，由 T12 显式触发）。
- **T10-R10** 同员工并发：store 维护/派生 `activeAttemptId`；已有 `running` Attempt 时新启动返回 `ORG_SESSION_CONFLICT`，由 T09/T11 转排队或改派；不得靠 UI 禁用冒充约束。
- **验证**：`org-sessions.test.js` 6 种不建会话、8 步顺序、跨 CLI 新 Binding、并发被排队、Attempt 关联；`org-bridge.test.js` mock 下 createHost 走 factory/create、wakeHost 走 initialize→resume/load 且不可用报 `ORG_RECOVERY_UNAVAILABLE`（不回落）、host profile 只写 `org-` 前缀不覆盖；API `GET /org/sessions/:employeeId` 与 `/bindings` 结构正确；运行时错误 0、零 CJK 通过。

### T11（W3b）Workflow Run 编排、执行视图与活动流（P10/P11/P13）

- **分支** `feature/org-T11-runs`；**依赖** T09、T10（与 T12 并行开发）。
- **T11-R1**（§13.4 严格 12 态）Task 状态机完整；上游未完成不可 ready、succeeded 解锁下游；人工节点停 ready、WorkItem 进 `waiting_human`（§13.1）等 T13 审批；异常进 `interrupted/blocked/failed/cancelled/skipped`；排队由 T09 写 `Run.queue`，不引入规格外状态。
- **T11-R2**（链路 C）执行步骤：Ready→读映射→成员有效性/空闲检查→确认员工→选 CLI→Prepared→启动→Locked→建会话→Attempt→活动展示→完成验收与下游推进。
- **T11-R3**（§14-4/5）资产修改后 Run 继续用创建时快照；成员停用时未启动节点标记需重映射。
- **T11-R4**（P10）执行中心列表：Run ID/Work Item/Workflow 版本/Team 版本/状态/完成率/Ready·执行中·中断·人工待处理数；完成率实时计算不硬编码。
- **T11-R5**（P11）执行视图：按节点展示名称/Role/计划与实际执行人/状态/CLI（Assignment 完成后才显示）/员工会话状态（创建后才显示）/最近活动；提供任务表格与事件时间线（规格明列三类视图）；默认进流程图模式（复用 T06 `renderGraph` 的 runtime 模式，实现约定），线性视图保留。
- **T11-R6**（P13）活动面板：员工身份、所属团队/角色、当前 WorkItem/节点/CLI、Employee/Host Session ID（存在才显示）、Attempt、开始时间、运行时长、最近活动；只展示公开事件；由事件/Attempt/产物动态生成不用静态文案。
- **T11-R7**（P03 修订入口）未启动节点可改映射，旧 Run 归档 `historyRuns`、`planRevisions` 追加、新建 Run 并更新 `workItem.runId`；已完成节点历史不变。
- **T11-R8**（P14）任务详情：Task ID/Node ID/Role/计划与实际执行人/Assignment 历史/Attempt 历史/Employee Session/Host Binding 历史/产物·Handoff·错误证据。
- **T11-R9** 所有状态迁移写事件，关键迁移（启动/完成/人工等待）写审计。
- **T11-R10** `advanceRun(runId: string) → {ok:true,value:{run,advanced:number}} | {ok:false,code,params}` 是**幂等**推进入口（跨任务唯一签名，T09/T12/T13 均按此调用）：读当前 Run/Task/事件，只推进满足条件节点；重复调用不得重复建 Assignment、不得重复写同一事件；并发以 `store.transit(expectedRev)` 串行化，冲突重读重试一次。T09 发 `assignment.locked` 事件（T01 `EVENT_TYPES` 已定义），T10/T11 消费该事件推进；不定义额外「通知」回调接口。
- **T11-R11** `ready_for_acceptance` **只由 T11** 在所有 Task `succeeded` 后设置；T13 人工批准只调 `advanceRun`，不得自行改 WorkItem 状态；进入该状态写事件与审计。
- **验证**：`org-runs.test.js` 依赖解锁、非法迁移、完成率、快照隔离、修订归档与 runId 更新、活动面板由事件生成；API `GET /org/runs` 字段、`POST /:id/tasks/:taskId/complete` 后下游变 ready；CDP 执行中心默认流程图、节点状态着色、点击打开任务详情与会话信息；V32-15 断言发布新版本后旧 Run 快照哈希不变。

### T12（W3b，可与 T11 并行）中断恢复 A/B（P15/§9）

- **分支** `feature/org-T12-recovery`；**依赖** T01 契约 + `test/wp21/fixtures/org-run.json` 假数据；`advanceRun` 只在 W3b 同步点联调（不提前引用未合入实现）。
- **T12-R1**（§9）中断保留**逐字照抄规格的 11 项**：① Work Item ID ② Workflow Run ID ③ Task ID ④ Assignment ID ⑤ Employee ID ⑥ CLI Installation ID 和 Fingerprint（算一项）⑦ Employee Session ID ⑧ Host Session ID ⑨ Attempt ID ⑩ 最后活动事件 ⑪ 检查点和已生成产物（算一项）；缺一项即失败。
- **T12-R2**（策略 A）恢复原宿主：必须选原 CLI；检查原 Host Session 存在、兼容、支持恢复；成功则**继续原 Attempt** 并回写 Binding 状态；任一项不满足保持 `interrupted`，写 `recovery.failed` 审计，禁止静默降级为策略 B。
- **T12-R3**（策略 B）检查点恢复：允许另一 CLI；沿用 Employee Session ID；新建 Host Binding；新建 Attempt 写 `resumedFrom` 指原 Attempt；检查点与 Artifact References 作恢复上下文；写 `recovery.succeeded` 审计。
- **T12-R4**（§14-7）CLI 运行中断连：保留 Attempt 与 Host Session 引用进入恢复，不清空。
- **T12-R5**（P15）面板展示原 CLI、Host Session ID、恢复能力、最后活动、检查点，及两种策略明确入口与失败诊断信息。
- **T12-R6** 恢复完成后重新触发依赖检查（通知 T11）。
- **验证**：`org-recovery.test.js` 11 项保留、策略 A 成功/失败两路、策略 B 新 Binding 新 Attempt 且 Employee Session ID 不变、跨 CLI 不复用 Host Session ID、失败保持 interrupted 且有审计；API `GET /:taskId/options` 返回两策略及可用性、`POST /recover-original` 不可恢复时返回 `ORG_RECOVERY_UNAVAILABLE` 且状态不变；CDP 面板显示原 CLI 与检查点、失败提示保持中断；V32-13/14 交 T17。

### T13（W4）人工节点与审批门禁（§4.3/P07/P16）

- **分支** `feature/org-T13-human-gates`；**依赖** T06、T11。
- **T13-R1**（§4.3/P07）`node.human` 只含 `approver`（Role ID 或审批岗位，禁具体员工 ID）与 `condition`（人工补充输入条件）；规格未定义审批方式（会签/或签）、超时默认动作与「升级」异常分支，不实现为需求也不落字段。
- **T13-R2**（V32-16）人工节点不分配员工/CLI、不创建 Employee Session/Host Binding/Attempt；批准只改 Task 状态并写审计。
- **T13-R3** 审批校验：审批人身份/角色须符合 `node.human`；不符合返回 `ORG_APPROVER_INVALID`；驳回按 §14-3（未启动重映射、运行中走中断恢复）处理，不自造「升级」分支。
- **T13-R4** 批准后 Task 从 ready 迁到 succeeded（§13.4 无 `human_waiting` 态），调 T11 `advanceRun` 解锁下游，WorkItem 退出 `waiting_human`；不得自行置 `ready_for_acceptance`（唯一 owner 是 T11）。
- **T13-R5**（P07 编辑器）Human 属性区只可配审批人（Role ID/审批岗位）与人工条件，不出现员工 Agent 分配/具体员工 ID/CLI 控件，不出现审批方式与超时控件。
- **T13-R6** 审批/驳回均写 `human.approved` 类审计事件，可追溯审批人与时间。
- **验证**：`org-human.test.js` 零 Session/零 CLI、审批人校验、批准解锁、驳回分支、审计写入；API `POST /:taskId/approve` 无效审批人返回 409/400 且不改状态；CDP 人工节点详情无 CLI/Session 字段、批准后流程图节点变绿。

### T14（W4）产物、事件、审计与交付验收（P16/§13.1）

- **分支** `feature/org-T14-delivery`；**依赖** T11、T12、T13。
- **T14-R1**（P16）Artifact 可追踪七维：WorkItem/Workflow Run/Task/Employee/CLI/Attempt/Handoff；`GET /artifacts/:id/trace` 返回完整链路与事件引用。
- **T14-R2**（P16）事件记录覆盖：团队/工作流版本选择、节点映射、Assignment、会话创建与恢复；人工审批、异常恢复、交付验收**必须**写审计（与 T01 审计类型对齐）。
- **T14-R3**（§13.1/V32-17）交付验收：T14 独占 `POST /org/records/:workItemId/deliver`；`ready_for_acceptance→accepted→delivered`（先 accepted 再 delivered，逐次写事件）；V32-17 只要求「产物、测试、风险和人工验收记录可追溯」，`deliveryRecord` 是**实现载体**（建议含 artifacts/tests/risks/acceptedBy/acceptedAt），断言落可追溯链与审计事件，不把固定字段模板或 `ORG_DELIVERY_INCOMPLETE` 当规格要求。
- **T14-R4** 需求详情产物卡片：展示本 WorkItem 全部 Artifact（名称/ID/类型/节点/Task/Employee/CLI/Attempt/Handoff）与「溯源」入口。
- **T14-R5**（P16）记录页：产物表、事件时间线（结构化表格：时间/类型/对象/操作者/载荷摘要）、审计链校验状态；支持按 WorkItem 过滤。
- **T14-R6** 事件/审计只读，不提供删除入口；哈希链校验失败页面显示明确告警。
- **验证**：`org-delivery.test.js` 状态迁移、deliveryRecord 字段、审计写入、非法迁移拒；`org-audit.test.js` 七维溯源、事件过滤、哈希链校验、三类必须审计事件；API `GET /org/records/artifacts/:id/trace` 七维非空（人工节点产物允许 Employee 空）、`POST /org/records/:workItemId/deliver` 缺产物/测试时返回 `ORG_DELIVERY_INCOMPLETE` 且状态不变；CDP 记录页表格可读无横向溢出、交付弹窗字段齐全。

### T15（W5）HTTP 路由聚合与 API 契约测试

- **分支** `feature/org-T15-api`；**依赖** T02–T14 全部路由片段。
- **T15-R1** 新建 `src/daemon/http/org-routes.js`：`createOrgRoutes({root})` 汇总所有片段，统一错误响应与 JSON 头、统一 404/405；**构造期零 IO**，store 首次请求懒创建并缓存，同一 `{store,root}` 注入各片段（片段不得各自 new store）。
- **T15-R2** 按 §1.3.2 精确挂载点改 `routes.js`（import + `orgRoutes` 构造 + `routes.push`）；不得改 `shapeSnapshot`、既有路由顺序或 `attachLazySeams`；构造异常会让 `http/server.js:263-284` 静默退化 503，必须避免。
- **T15-R3** 统一请求校验：所有 POST/PUT body 走契约 validate；错误码与 HTTP 映射固定（400 校验/404 不存在/409 冲突）；响应体统一 `{ok:false,code,params}`。
- **T15-R4** `org-api-contract.test.js` 逐条打 §1.3.2 路由表，断言状态码与响应形状；片段缺失只报告缺哪条，不替别人实现。
- **验证**：`org-api-contract.test.js` 全绿（路由条数 = 表中条数）；`GET /ui/labels` 仍 200；既有 `/instances`、`/workflows` 契约逐字回归；`node scripts/desktop/gate.mjs --skip-tests` exit 0。

### T16（W5）桌面壳集成、导航与零 CJK 文案

- **分支** `feature/org-T16-shell`；**依赖** T15 + 全部页面模块（页面可按 §1.3.3 契约并行开发，W5 同步点联调）。
- **T16-R1**（§11）导航按 9 组（启动与资源/需求工作台/执行中心/团队库/工作流库/员工档案/角色库/产物与事件/系统设置）在 `nav.js` 注册，保留历史 view ID 兼容深链。
- **T16-R2** `desktop/ui/org/index.js` 汇总页面模块；`shell/index.js` 的 `PAGE_BY_VIEW` 加 V3.2 view；`app.js` 加 `state.org`、`loadOrg(view,params)`，`handleAction` 加 `org-*` 分派；`render(ctx)` 返回 DOM 节点只消费 `ctx.org.data` 不在 render 内 fetch。
- **T16-R3** org 文案键必须作为 `src/cli/labels.js` 的 `DESKTOP_V2_LABEL` 成员追加（`src/daemon/http/labels.js:347` 已展开该表经 `GET /ui/labels` 下发），不得另建 `ORG_LABEL` spread（撞 `labels-desktop.test.js:776` 与 `labels-drill.test.js:367-372` 精确计数）；同步追加 `EXPECTED_V2_KEYS`/`EXPECTED_V2_VALUES`（append-only，既有行逐字不变）；键必须真被下发否则空表头/空按钮。
- **T16-R4** 零 CJK：V3.2 新增源码（含注释）用 `python3 -c` 正则扫描为 0；变量不得叫 `editor`（31 词禁表按整词扫）；分隔符用空格或 `·`。
- **T16-R5** 输入控件带 `data-field`；动作在 `pointerdown` 响应且同时派发 `click`（600ms 去重）；导航锚点唯一化（`.sidebar [data-section=…]`/`.secbar .sec-tab[data-tab=…]`）。
- **T16-R6** V3.2 若调 mutator（现有 `updateStudio`/`atomicWrite` 在 `src/studio/**`、`src/registry/**`，不在 `app.js`），只消费返回 `.value`，写操作均 await；不得修改 `src/studio/**`、`src/registry/**`（只读共享）。
- **T16-R7** 页面视觉统一：直接用主壳标签栏与样式，9 组在同一信息架构下，不得出现 iframe 内另一套视觉；`desktop/ui/index.html` 加 `<link rel="stylesheet" href="./org/org.css">`（当前只有 `./theme.css`，不加载则样式不生效；index.html 归 T16 独占）。
- **T16-R8** `test/wp13/org-shell.test.js`：从导航进入 9 组，断言唯一正面标记 `[data-view="org-*"]` 存在且 `DESKTOP_V2_EMPTY` 空态节点不存在（`shell/index.js:62-72` 吞 render 异常回退空态，仅检查「非空」会假绿），动作可触发、`data-field` 存在；旧 5 组与历史 view 深链仍可进入。
- **T16-R9** 9 组扩展必须同步更新所有冻结断言（尤其 `labels-desktop.test.js` 键总数与值表）；新增键只追加、既有键值逐字不变；旧测试无法在不放松断言前提下兼容则写 `BLOCKED` 由主线裁决。
- **T16-R10** `PAGE_BY_VIEW` 新增 view 后 `fallbackPage` 不得误用；未装载数据显示明确 loading/empty 状态不白屏。
- **T16-R11** `scripts/verify-org-ui.mjs`：起真实桌面壳（沿用 `verify-nav.mjs` 的 CDP 起法与 `MAESTRO_CONFIG_DIR` 隔离），逐页点击 9 组导航，断言唯一 `[data-view="org-*"]`、无 `DESKTOP_V2_EMPTY`、无 console error/runtime exception，输出逐页 PASS/FAIL 与截图路径到 `docs/org/reports/raw/T16/`；同时把 `verify-nav.mjs:152-164`、`verify-scenarios.mjs:147-153,219-226`、`verify-desktop-boot.mjs:155,161` 的「恰好 5 段/extra 为空」改为「原 5 段标签与顺序不变 + 新增 4 段可进入」，不放宽为任意数量。
- **验证**：`node --test "test/wp21/org-labels.test.js" "test/wp13/org-shell.test.js" "test/wp13/labels-desktop.test.js"` 全绿（带 §1.4 前缀）；零 CJK 自查；`node scripts/verify-org-ui.mjs` 逐页打开 9 入口、console error/runtime exception 硬失败、截图落 raw/T16/ 核对浅色布局无溢出、`npm run verify:nav` 无新增红；`GET /ui/labels` 返回所有 `ORG_*` 键且值非空，键总数按 `labels-desktop.test.js:776` 实际断言 `312 + EXPECTED_V2_KEYS.length + ROLE_LABEL`（org 键已含在 `EXPECTED_V2_KEYS.length` 内不重复加）。

### T17（W6）V32-01～17 验收自动化

- **分支** `feature/org-T17-acceptance`；**依赖** T16。
- **T17-R1** `scripts/verify-org.mjs`：用 `fs.mkdtempSync(os.tmpdir(),'org-accept-')` 建隔离项目，`spawn(process.execPath,[src/daemon/serve-entry.js,'--project',root,'--desktop'])` 起真实 daemon，`HOME`/`USERPROFILE`/`MAESTRO_CONFIG_DIR` 全指临时目录（禁止污染真实 `~/.maestro/projects.json`）；从 `<root>/.orch/desktop.json` 读 port/token，经 HTTP API 依序执行 17 条用例，每条输出 PASS/FAIL 与关键状态片段；结束 kill daemon 并清理。
- **T17-R2** 17 条严格按 §2.4 场景与通过标准断言，不得只检查文字存在，要检查对象字段、状态与事件。
- **T17-R3** 覆盖四链路端到端：A（已有+已有）、B（新建+新建）、C（Ready→Assignment→Session→完成）、D（中断→恢复 A 失败→恢复 B 成功）。
- **T17-R4** 断言禁止硬编码测试条数，用 `fail=0 && pass===tests && tests>=17`。
- **T17-R5** `package.json` 只加 `"verify:org": "node scripts/verify-org.mjs"`，不改其它 script。
- **T17-R6** `test/wp21/org-acceptance.test.js` 以单测覆盖同一组断言（不依赖 GUI）供门禁使用。
- **验证**：`npm run verify:org` → 17/17 PASS exit 0；`org-acceptance.test.js` 全绿（带 §1.4 前缀）；报告 `acceptance.md` 含逐条结果与命令输出摘要；失败按 §0.5 循环不得跳过任一用例。

### T18（W6）全量回归、门禁与交付收口

- **分支** `feature/org-T18-final`（只写报告不新增源码）；**依赖** T17。
- **T18-R1** `git worktree add /tmp/orgbase origin/main` 建基线树，基线与当前树分别跑全量测试，比较失败集合与失败原因；新增红必须为 0。
- **T18-R2** 全量命令 `NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/**/*.test.js"`，记录 tests/pass/fail/skip。
- **T18-R3** 门禁 `node scripts/desktop/gate.mjs` exit 0；失败按 §0.5 判定，不得以「历史基线也有」掩盖新增红。
- **T18-R4** 复核覆盖矩阵 §2：每章节/页面/状态/异常/用例都有已合入任务与证据链接。
- **T18-R5** `docs/org/reports/final-verification.md` 汇总：基线 sha、最终 sha、逐任务结论、17/17、差集结论、门禁结论、已知偏差。
- **T18-R6** 门禁前置：确认 T00-R4 两份基线文件存在且内容与 `7b71cd4` 逐字一致，否则全量 `gate.mjs` 在 `readFileSync` 处崩溃（`--skip-tests` 不暴露）；缺失先按 T00-R4 恢复不得绕过。
- **验证**：全量测试 + 门禁 + `npm run verify:org` 三项全绿，报告落盘后合入 main。
- **完成定义**：两机确认所有任务已合入，main 上从零复跑三项验证仍全绿。

### T19（插队，机器 B 已完成）全局重命名 v32 → org

- **背景**：用户裁决目录名 `src/v32/` 不合适（版本号编码进架构命名），重命名为 `src/org/`；T02 合入后、T03 认领前的窗口执行，改名面最小（v32 代码尚无外部引用方、标签键未进 labels 冻结断言）。
- **T19-R1** 目录与文件改名：`src/v32/`→`src/org/`、`src/daemon/http/v32/`→`src/daemon/http/org/`、`desktop/ui/v32/`→`desktop/ui/org/`、`test/wp21/org-*.test.js`（原 v32-*）、`test/wp21/fixtures/org-*.json`、`docs/v32/{claims,reports}/`→`docs/org/{claims,reports}/`；T01/T02 证据原始帧文件名不改写（历史记录）。
- **T19-R2** 内容标识符改名：错误码 `V32_*`→`ORG_*`（21 个）、工厂/导出 `createV32Store`→`createOrgStore`、`createV32CliRoutes`→`createOrgCliRoutes`、标签键 `V32_CLI_*`→`ORG_CLI_*`、`ctx.v32`→`ctx.org`、`state.v32`→`state.org`、`loadV32`→`loadOrg`、视图/路由 `v32-*`→`org-*`、`.orch/v32/**`→`.orch/org/**`、宿主档案 `org-<installId>.json` 前缀；**保留规格用例编号 `V32-01~17` 与 `maestro_v3_2_*` 文件名**。
- **T19-R3** 规划文档全量引用同步（含 §0.3–§0.10 命令、§1.2 所有权、§1.3 契约、§2 覆盖矩阵、T00–T18 任务详单、附录），命名决策记入 §1.1。
- **T19-R4** 临时目录约定改为 `/tmp/orgt`，验证命令前必须 `mkdir -p /tmp/orgt`（mkdtemp 不自建父目录；T19 实测缺目录导致 35 条假红）。
- **验证**：`mkdir -p /tmp/orgt && NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/wp21/org-*.test.js"` → 63/63 PASS fail=0；全仓库 tracked 文件 grep `[vV]32` 仅剩 `V32-` 用例编号、`maestro_v3_2_*` 规格文件名与 T01/T02 证据原始帧路径。
- **完成定义**：测试全绿 + 残留核查通过 + 独立审核 Agent 复核改名一致性 PASS，ff-only 合入 main 并推送。

---

## 5. 总体验收与完成定义

### 5.1 最终必须全部通过的检查

```bash
cd /Users/xuesh/www/Maestro
git fetch origin && git switch main && git pull --ff-only origin main
NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/wp21/org-*.test.js"   # 必须附 tests >= 已合入域下限，防 glob 空匹配假绿
NODE_ENV=test TMPDIR=/tmp/orgt node --test "test/**/*.test.js"          # 全量约 12 分钟（macOS）
npm run verify:org
node scripts/desktop/gate.mjs
python3 -c 'import re,pathlib,sys; roots=[pathlib.Path("src/org"),pathlib.Path("desktop/ui/org")]; bad=[(str(p),n) for r in roots for p in r.rglob("*.js") for n,l in enumerate(p.read_text().splitlines(),1) if re.search(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]",l)]; print(bad); sys.exit(1 if bad else 0)'
```

### 5.2 完成定义（缺一不可）

1. §2 覆盖矩阵每行都有已合入任务，报告对应 REQ 全部 PASS。
2. 17 条验收用例全部由真实 API/状态驱动通过，不是页面文案检查。
3. P00–P16 在桌面壳内可从导航进入并操作，无 iframe 内第二套视觉。
4. 全量失败集合差集 = 0、新增红 = 0、门禁 exit 0、T00-R4 两份基线文件存在且未改写。
5. `docs/org/reports/T01.md`～`T18.md` 全部存在且含 baseSha/headSha/验证结果/认领记录/审核轮次。
6. 每任务按 §0.10 完成认领并经干净审核 Agent 审核 PASS（无阻塞项）后才提交；台账全任务 `phase: done` 且 `headSha` 均为 `origin/main` 祖先。
7. 两机确认自己分支已合入且无遗留 WIP，两份台账无活跃 `developing`/`reviewing` 条目。

### 5.3 阻塞升级规则

以下情况任务保持 `in_progress`，写 `BLOCKED` 报告交主线负责人，不得自行降标准合入：

- 契约字段不够用需改 `src/org/contracts.js`（T01 独占）。
- 必须修改 `src/core/**`、`src/persistence/**`、`src/adapter/**`、`src/daemon/server.js`。
- 新增 npm 依赖才能完成。
- 前序未合入导致无法验证且等待超一个同步点。
- 全量回归新增红且独占复跑仍红。
- 审核 Agent 连续两轮同类阻塞项，按 §0.10.5 重建干净子 Agent 后仍 FAIL。
- 认领台账与 main 实际状态冲突（两机都声称同一任务 `done`，或报告 `headSha` 不是 `origin/main` 祖先）。

---

## 附录 A：原型交互参考 → 实现落点（非需求来源）

> 只帮助找到「原型交互对应哪个任务」，不构成需求。行为以规格正文（§/P/org 编号）为准，冲突以规格为准（§0.8）。

| 原型交互（`docs/maestro_v3_2_prototype.html`） | 任务 | 规则依据 |
|---|---|---|
| `scanPage`/`scanCli`/`checkCli`/`addCliPath`/`confirmAddCli` | T02 | §7.1/P00 |
| `workItemsPage`/`openWorkItem`/`workItemDetail`/`startRun`/`cancelWorkItem` | T07 | §5.1/§13.1/P01/P03 |
| `startWorkItemWizard`/`wizardWorkflow`/`wizardTeam`/`wizardNext`/`wizardBack`/`createWorkItem`/`preflightWizard`/`changeWizardMode`/`changeWizardAsset`/`readWizardTeam` | T07 | §5/§5.1/§5.2/§14-1/P02 |
| `showExecutionPlan`/`reviseExecutionPlan`/`saveExecRevision`/`showRunHistory` | T11 | §2.1-10/§14-4/P03 |
| `showWizardNodeDesigner`/`saveWizardNodes`/`parallelPairs`/`parallelConflicts`/`eligibleMembers` | T08+T06 | §6.1–6.3/§14-2/P02-4 |
| `teamsPage`/`editTeam`/`toggleTeamRoleBox`/`saveTeam`/`copyTeam`/`deprecateTeam`/`showTeamVersions` | T05 | §3.1–3.3/§13.2/P04/P05 |
| `workflowsPage`/`editWorkflow`/`wfGraphEditor`/`graphAddNode`/`graphAddEdge`/`graphAutoLayout`/`checkWorkflowDag`/`saveWorkflow`/`publishWorkflow`/`showWorkflowDag` | T06 | §4.1–4.4/§13.3/P06/P07 |
| `employeesPage`/`newEmployee`/`saveEmployee`/`editEmployeeProfile`/`saveEmployeeProfile`/`employeeDetail` | T04 | §1.1/§8.1/P08 |
| `rolesPage`/`roleDetail`/`editRole`/`createRole`/`saveRole` | T03 | §1.1/P09 |
| `runsPage`/`openRun`/`runRuntimeCards`/`runDetail`/`setRunTab` | T11 | §10 链路 C/§13.4/P10 |
| `taskActionBtn`/`assignTask`/`cliCapsHtml`/`saveTaskAssignment`/`reassignTask`/`confirmQueue`/`drainQueue`/`startTask` | T09 | §7.2/§7.3/§13.5/§14-2/P12 |
| `sessionExplain`/`activityPanel`/`taskDetail` | T10+T11 | §8.1–8.4/P13/P14 |
| `completeTask`/`unlockDownstream`/`interruptTask`/`resumeTask`/`failResume`/`confirmResume` | T11+T12 | §9/§13.4/P15 |
| `pauseRun`/`continueRun`（原型演示，规格无暂停态） | 不实现；按 §9 中断/恢复与 §13.4 `interrupted→running` 表达，禁止新增 pause 状态或 API | §9/§13.4 |
| `approveHumanTask` | T13 | §4.3/P07/P16 |
| `openDelivery`/`confirmDelivery`/`artifactTrace`/`showEvents`/`setRecordsTab`/`recordsPage`/`runAcceptanceCheck` | T14 | §12 P16/§16 V32-17 |
| `settingsPage`/`saveSettings`/`nav`/`render` | T16 | §11/P00 设置项 |

> 对照方法：先看右列规格条文确认需求，再回看左列原型交互确定页面形态；冲突按 §0.8 以规格为准。原型未纳入本规划文件所有权，任何任务不得为「对齐原型」而修改它。

## 附录 B：已知坑位速查（来自本仓库历史）

1. `npm test` 报 MODULE_NOT_FOUND；用 `node --test "test/**/*.test.js"`（带引号）。
2. macOS `grep -P` 静默返回空；零 CJK 自查用 `python3 -c` 正则。
3. POSIX socket `sun_path` 104 字节，`TMPDIR` 必须短（`/tmp/orgt`），否则长路径导致连接假死。
4. `core.autocrlf=true` 下 `git restore` 后 status 假报 M：用 `git -c core.autocrlf=false checkout-index -f -- <路径>` 刷新。
5. `NODE_ENV=test` 必须带，否则 `/__test__/graph/pulse` 等接缝不注册，测试假红。
6. 桌面动作在 `pointerdown` 响应，`click` 有 600ms 去重；自动化要同时派发。
7. 输入控件无 `data-field` 会在实时帧重绘时丢光标。
8. Tauri 同步 command 跑主线程；带超时往返的命令必须 `#[tauri::command(async)]`（本轮一般不涉及 Rust）。
9. 事件与落盘有毫秒级先后，取证要「等迁移落定」再读，避免假阴性。
10. 手写台账要活过重生成：整文件重写的生成器先摘出人工段再接回（本轮报告由各任务独占文件，不适用全局生成器）。
