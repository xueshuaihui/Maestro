# I1.12 实现报告（治理加固 + 预算配额 + 生态能力 + 性能基线）

| 项 | 内容 |
|---|---|
| **依据** | `docs/index.md` 第一部分（需求基线）+ 第二部分 `#### I1.12` 规划条目 + `docs/templates/requirement-template.md`；定稿 `requirement.md` **v2.1**（**23 AC / 19 BR / 5 NF**），版本头部与附录 C 末行一致；裁决台账 `decisions.md` 裁决 **A~E** |
| **拆分与契约** | `docs/iterations/iteration-12.md`（**7 WP / 35 文件零交集 / AC 23→23 满覆盖**）；评审 `split-review.md`（round1 FAIL，SR-01）→ 裁决 B 扩 D-13 授权 → `split-review-round2.md` PASS（0 阻断 / 1 建议） |
| **需求评审** | `review-round1.md` 评 v1 **PASS**（0 阻断 / 6 建议，规划逐句覆盖 18/18、夹带 0、缺漏 0）→ 吸收建议出 v2 + 裁决 A → `review-round2.md` 评 v2 **PASS**（0 阻断 / 6 建议移交 S1 §7）；**S0 需求评审 2 轮，最终 PASS 轮号 = round2**；`requirement-understanding.md` DoR 13 条 **12 绿 / 1 黄（DoR-7 = AC-21）/ 0 红** |
| **验收记录** | `acceptance-fixture.md`（夹具面，A 段 + B 段）、`acceptance-product.md`（真实宿主面，仅 AC-21 取证尝试）、`acceptance-merge.md`（合并与审计）、`probe/acc12-f-{results.jsonl,results-b.jsonl,summary.json,blockers.md}`、`evidence/`（**153 份**） |
| **终验记录** | `final-verification.md`（S4 独立终验：六项校验 + 第 7 项需求评审闭环**全部 PASS**，但 §4.5 总判定 **FAIL**，唯一原因是 AC-21 阻塞） |
| **环境** | Windows（Git Bash）、Node **v22.22.2**、零第三方运行时依赖（`dependencies` = `{}`）；本机真实宿主 DSH **`0.2.2-rc.3`**（需求文档写 rc.1，属版本漂移，见 §5.2）；分支 `feat/i1.12-governance`，基线 HEAD `0b12bd8` |
| **完成时间** | 2026-11-19（S0 2026-11-17~18 → S1 11-18 → S2 11-18~19 → S3 11-19 → S4 11-19） |

---

## 0. 总体结论

**一句话：I1.12 的 7 个 WP 全部实现并逐批评审 PASS，23 条 AC 中 22 条通过、0 条不通过、1 条阻塞（AC-21 真实宿主性能面本机未取证），四道治理门禁与全量回归可复现——但因 AC-21 阻塞，`execution-template.md` §4.5 的 Done 条件 1（AC 100% 通过）/ 2（阻塞 = 0）/ 5（终验总判 PASS）不满足，本迭代**尚未收口**，需用户就 AC-21 作出裁决（补真实宿主取证 或 书面豁免）。**

### 判定表

| 判据 | 结果 | 口径 |
|---|---|---|
| AC 条数 | **23 通过 22 / 不通过 0 / 阻塞 1** | `summary.json`、两份 `results.jsonl`、`acceptance-fixture.md` 三处一致 |
| 核对项 | **322 / 322** | A 批 194（AC-01 按裁决 E 修复后 22/22）+ B 批 128；AC-21 的 5/5 为「阻塞出口」核对项，不计失败 |
| 全量测试 | **1660 / pass 1637 / fail 14 / skipped 9**（`tests ≥ 1425` 基线） | 14 条全部落在允许集合（win32 登记 **12** + 裁决 K 的 S0 既有红 **2**，逐行对账见 `evidence/AC-22.diffset.txt`），**集合外新增红 = 0，差集 0**；最终帧**不含** flake（过程帧的一次「三主链」负载 flake 已隔离复跑证伪并留帧，未复现） |
| 架构扫描 | 双目录 31 词 **exit 0** | `src/core,src/daemon`（38 文件）+ `desktop/ui,desktop/harness`（31 文件），零命中 |
| 回归红线 | **三主链 8/8、I1.10b 51 AC + I1.9 27 AC 判据文件零改动、`USAGE_LINES` 25 行逐字不变** | `test/wp14/regression-drill.test.js` exit 0；`git diff 0b12bd8..HEAD -- .../requirement.md` 为空 |
| 零依赖 | **0** | `Object.keys(package.json.dependencies).length` |
| 阻断级缺陷 | **0**（AC-01 缺陷已修复并复验、不计缺陷；AC-21 是阻塞不是缺陷） | `probe/acc12-f-blockers.md` 仅 AC-21，「不通过 / 缺陷项」为空 |
| **§4.5 Done** | **不满足**（条件 1、2、5 不满足；条件 3、7 满足；条件 4、6 于本报告补齐后满足） | 见 §5.1 |

**能力结论**：I1.12 把「治理」从文档约定变成了控制流里的硬判定——越权唤醒、证据过期、高风险缺终审、并行度超限、预算耗尽五类事件都在真实路径上被拦截并留痕（`wake.not-whitelisted` 等 reason 码进主审计），同时补齐了事件链哈希校验（`orch verify`）、角色包/工作流包的导出-签名-导入-迁移（`orch export` / `orch verify <包>` / `orch migrate`）、OTel 导出与反模式监控、以及性能基线的 mock 采样-统计-分级管线。中文文案仍只由 `src/cli/labels.js` 提供，图/角色字面量仍只在 `src/templates/**`。

**最难一条的实测证据（AC-04 越权唤醒被拦截并留痕）**：`evidence/AC-04.decision.deny.json` 给出 `allowed=false`、`reason=wake.not-whitelisted`、`detail` 含来源 `role-a` / 目标 `role-c` / 时间戳；同一组证据里目标会话消息队列为 `[]`、未投递列表为 `[]`、拒绝审计恰好 1 条——「拒绝 + 不投递 + 留痕」三件事同时成立，16/16 核对项通过。该判定走的是 `orchestrator.js` 唤醒路径上的真实 `wakeGate` 判定（不是 advisory `void`），S2 第三轮评审专门核过这一点。

---

## 1. 交付物

### 1.1 产品代码（`src/**`，对比基线 `0b12bd8`）

**18 个文件变更，+3442 / −14 行**，其中 **10 个新增模块**：

| 新增模块 | 职责 |
|---|---|
| `src/core/audit-verify.js` | 链式哈希校验（`verifyChain`，冻结签名）、首处失配定位 |
| `src/core/governance.js` | 四类治理判定的纯数据底座（唤醒白名单 / 证据新鲜度 / 高风险终审 / 并行度） |
| `src/core/budget.js` | 预算配额、耗尽挂起与补预算续跑 |
| `src/core/pack.js` | 角色包/工作流包导出（依赖闭包）、签名与版本兼容校验、导入落库 |
| `src/core/otel-export.js` | OpenTelemetry 格式映射与导出 |
| `src/core/antipattern.js` | 三类反模式信号检测（只读模块） |
| `src/core/perf-baseline.js` | 性能采样、统计（median/p95/max）、三档证据分级 |
| `src/cli/verify.js` | `orch verify` 四目标分派（CHAIN / PACKAGE / IMPORT / REVIEW） |
| `src/cli/migrate.js` | `orch migrate` 派生角色/工作流引用升级 |
| `src/cli/otel.js` | `orch export otel` 入口 |

改造：`src/core/orchestrator.js`（+399，含四个可注入判定函数 `wakeGate`/`parallelismGate`/`budgetGate`/`reviewGate` 与四处真实控制流接线）、`src/core/handoff-schema.js`（+146，新鲜度判定结果落包）、`src/core/escalation.js`（+41，`buildGovernanceRejection`）、`src/core/event-bus.js`（+25，`emit` 支持复用状态变更时刻的 `ts`）、`src/cli/{labels,main,roles,workflows}.js`。

### 1.2 测试与夹具（`test/**`）

**17 个文件、+3758 / −1 行**，其中 **16 个新增**：`test/wp15/` 下 `chain-verify`、`chain-compat`、`governance-wake`、`governance-review`、`governance-granularity`、`evidence-stale`、`budget`、`pack-closure`、`pack-sign`、`migrate`、`otel-export`、`antipattern`、`perf-mock`、`boundary-i111`、`wiring`、`regression`；另 `test/wp2/labels.test.js` 按裁决 D 同步两处精确断言（新增 `REASON_LABEL` 键、`Object.keys` 48→49）。

### 1.3 验收产物

`probe/acc12-{f-lib,f-common,f-run,f-final}.mjs` + `probe/acc12-cases/AC-01..23` + `probe/acc12-f-parts/AC-01..23.md` + `probe/acc12-perf.mjs` + 两份 `results.jsonl` + `summary.json` + `blockers.md`；`docs/iterations/iteration-12/{acceptance-fixture,acceptance-fixture-b,acceptance-product,acceptance-merge}.md`；`evidence/` **153 份原始帧**（A 批 79 + B 批 74，0 空文件、0 缺件、路径无重复无串号）。

---

## 2. AC 逐条判定（23 条，逐条）

| AC | 标题 | 判定 | 证据分级 | 核对项 | 证据数 |
|---|---|---|---|---|---|
| AC-01 | 篡改一条记录，链式哈希校验失败 | 通过 | mock 实测 | 22/22 | 9 |
| AC-02 | 链式哈希加固与 I1.9 基线衔接 | 通过 | mock 实测 | 21/21 | 5 |
| AC-03 | 白名单内唤醒正常发生 | 通过 | mock 实测 | 10/10 | 4 |
| AC-04 | 越权唤醒被拦截并留痕 | 通过 | mock 实测 | 16/16 | 4 |
| AC-05 | 证据指纹一致时正常交接 | 通过 | mock 实测 | 7/7 | 6 |
| AC-06 | 证据过期后交接被拒绝 | 通过 | mock 实测 | 23/23 | 8 |
| AC-07 | 高风险缺人工终审被挡下 | 通过 | mock 实测 | 16/16 | 8 |
| AC-08 | 有终审路径的高风险节点需等人裁决 | 通过 | mock 实测 | 15/15 | 7 |
| AC-09 | 节点与交接包状态变更进主审计 | 通过 | mock 实测 | 16/16 | 5 |
| AC-10 | 派生与会话状态不单独审计 | 通过 | mock 实测 | 15/15 | 7 |
| AC-11 | 并行度上限排队 | 通过 | mock 实测 | 15/15 | 8 |
| AC-12 | 预算耗尽时暂停而非失败 | 通过 | mock 实测 | 18/18 | 8 |
| AC-13 | 角色包/工作流包导出含依赖闭包 | 通过 | mock 实测 | 15/15 | 6 |
| AC-14 | 导入第三方包：签名有效、版本兼容 | 通过 | mock 实测 | 8/8 | 6 |
| AC-15 | 签名无效/版本不兼容被拒绝且不污染资产 | 通过 | mock 实测 | 10/10 | 6 |
| AC-16 | `orch migrate` 升级派生角色/工作流引用 | 通过 | mock 实测 | 14/14 | 9 |
| AC-17 | `orch migrate` 无迁移项/坏引用/幂等 | 通过 | mock 实测 | 12/12 | 6 |
| AC-18 | 可观测性导出为 OpenTelemetry 格式 | 通过 | mock 实测 | 13/13 | 9 |
| AC-19 | 反模式监控给出三类信号 | 通过 | mock 实测 | 15/15 | 4 |
| AC-20 | 性能基线 mock 压测达标（mock 实测） | 通过 | mock 实测 | 12/12 | 6 |
| **AC-21** | **真实宿主性能证据分级（留本机）** | **阻塞** | **阻塞** | 5/5 | 4 |
| AC-22 | 回归红线：上游 AC 与不变量只增不改（证据索引） | 通过 | mock 实测 | 13/13 | 13 |
| AC-23 | 与 I1.11 的边界：治理侧只产出判定结果 | 通过 | mock 实测 | 11/11 | 5 |
| — | **合计** | **22 通过 / 0 不通过 / 1 阻塞** | mock 22 / 阻塞 1 | **322/322** | **153** |

**AC-21 逐字事实（未放宽，不改写）**：`evidence/AC-21.perf-check.stdout.json` 与 `AC-21.meta.result.json` 均为 `level=PERF_LEVEL_PENDING`（`待本机实测`）、`blocked=true`、`ok=false`、`realHostCollected=false`，`triedPaths` 5 条（`MAESTRO_DSH_EXE`/`MAESTRO_DSH_BIN` 未设置；`C:/Program Files/DSH/dsh.exe`、`%LOCALAPPDATA%/DSH/dsh.exe`、`~/.dsh/bin/dsh` 均不存在；20 实例/50 会话采集 `not_collected`）。4 份证据**未**引用 AC-20 的任何 mock 数值，也**未**出现任何真实宿主达标声称。判定依据：裁决 A 第 3 条 + 需求 483/484 行 + §3.3「阻塞不算失败，伪通过才是」。

---

## 3. 验收中发现并修复的缺陷 / 证据分级

### 3.1 缺陷台账（全部已修复并复验，故不计入阻断级缺陷）

| # | 现象 | 根因 | 修法 | commit | 复验 |
|---|---|---|---|---|---|
| **AC-01** | `orch verify <实例>` 报「链已断：**第 1 条**记录与本条指纹不匹配」，而核心 `verifyChain` 返回 `firstMismatch=2`（篡改的是第 2 条） | `src/cli/verify.js` 渲染 N 时取 `result.count` 早于 `result.seq`，把「总条数」当成了「失配序号」 | **裁决 E** 定口径：N 必须是失配记录的 `seq`，渲染优先级 `seq → firstMismatch → badIndex → count/total`；不改核心算法、不改文案模板 | `d1fce53` | AC-01 复跑 **22/22**、`verify.bad.stdout` 输出「第 2 条」与 `module-result.json` 的 `seq/firstMismatch/badIndex` 三个字段全为 2 一致 |
| **N-01**（S2 第三轮评审） | `orch verify review` 对**已配终审路径**的高风险节点也退出 1，违反 AC-07/AC-08「补齐路径后校验通过」 | 通过条件写成 `ok === true && needsHumanReview !== true`，把「已配终审路径的正常态」当成失败 | 通过条件改为 `result.ok === true && result.blocked !== true`（`needsHumanReview:true` 是正常态，只有 `blocked` 才是挡下） | `d20fccc` | 补真实行为断言（stub 分别注 `needsHumanReview:true` / `blocked:true`），第三轮评审 PASS |
| **N-02**（S2 第三轮评审） | 四道门禁外层 `try { … } catch {}` 把落盘也包住 → 判定/落盘异常被静默吞掉，fail-open | 异常边界划得太宽 | `try` 收窄到只包 `loadCapability`；verdict 判定、事件 `emit`、`escalateState`、`return {action:'stop'}` 全部在 `try` 外 | `d20fccc` | `wiring.test.js` 改为注入 stub 校验 verdict 的真实行为（不再用 `void` 哨兵），第三轮 PASS |
| **F-01~F-09**（S2 第一轮评审） | 四门禁实现为 `void <decision>` 的 advisory no-op；测试反向锁死 void 哨兵；`buildGovernanceRejection` 死代码；`RUNTIME_SUBS.workflow` 被错误冻结；`REASON_LABEL` 用 non-enumerable 规避旧断言；`USAGE_LINES_I112` 无消费方；回归测试仅静态；AC-19 无 CLI 载体；`package/yes` 双登记 | 接线包把「有判定」当成了「有拦截」 | **裁决 D** 扩 D-13 授权（`test/wp2/labels.test.js` 仅两处精确断言、恢复 `workflow` 子命令、`package/yes` 仅 BOOLEAN、`--help` 25+6 行、回归测试只做结构门禁、AC-19 模块直调）；门禁全部进控制流，`verdict` 非空时拦截并落盘；F-08 按裁决 D-6 不修（AC-19 走模块直调，不加 CLI） | `d20fccc` | `s2-review-wp7-round3.md` PASS（阻断 0 / 建议 0） |

**S2 逐批评审轨迹**：批次 1 `review-batch1.md` FAIL（B1-01，`verifyChain` 冻结签名被改）→ 裁决 C → `review-batch1-round2.md` PASS；批次 2 `review-batch2.md` FAIL（B2-01，WP-6 三值用中文当机器键）→ `review-batch2-round2.md` PASS；批次 3 三轮（FAIL → FAIL N-01 → PASS）。

### 3.2 证据分级分布

| 分级 | 条数 | 说明 |
|---|---|---|
| `已实测（真实宿主面）` | **0** | 本迭代无任何 AC 声称真实宿主面取证 |
| `mock 实测` | **22** | AC-01~AC-20、AC-22、AC-23：全部在夹具 / 模块直调 / 事件构造面取证，产物带原始帧 |
| `阻塞` | **1** | AC-21：真实宿主性能面**未按 20/50 口径取证**，如实判阻塞（根因复核见 §5.1.1：本机真实宿主可用，版本 `0.2.2-rc.3`，是取证脚手架路径不全） |

`PERF_LEVEL_MOCK` / `PERF_LEVEL_REAL` / `PERF_LEVEL_PENDING` 是 ASCII 机器键（机器判定用），对应中文只在 `src/cli/labels.js`（`mock 实测` / `真实宿主实测` / `待本机实测`），符合「中文唯一来源」不变量。

---

## 4. 门禁与复现（可直接复制执行）

```bash
# 1) 全量测试（唯一正确入口；npm test 会 MODULE_NOT_FOUND）
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 \
  --test-force-exit "test/**/*.test.js"
# 预期：tests 1660 / pass 1637 / fail 14 / skipped 9，EXIT:1
# 14 条 = win32 登记 12 + 裁决 K 的 S0 既有红 2；集合外新增红 0，差集 0
# （过程帧曾出现一次「三主链」负载 flake，单文件隔离 8/8 全绿留帧，最终帧未复现）

# 2) 三主链回归红线（不变量逐字）
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 \
  test/wp14/regression-drill.test.js
# 预期：tests 8 / pass 8 / fail 0，EXIT:0

# 3) 架构 purity（31 词并集，两个目录都要跑）
FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"      # 38 文件，exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid "$FORBID" # 31 文件，exit 0

# 4) 零依赖 / 补丁卫生
node -p "Object.keys(require('./package.json').dependencies||{}).length"   # 预期 0
git diff --check                                                          # 预期 exit 0

# 5) 中文文案行数不变量
node --input-type=module -e "import {USAGE_LINES,USAGE_LINES_I112} from './src/cli/labels.js'; console.log(USAGE_LINES.length, USAGE_LINES_I112.length)"  # 预期 25 6
NODE_ENV=test node bin/orch.js --help | wc -l                             # 预期 31 = 25 行既有逐字 + 6 行追加

# 6) 验收批次（A / B 可分别重跑；结果落 probe/acc12-f-results*.jsonl）
node probe/acc12-f-run.mjs --batch a
node probe/acc12-f-run.mjs --batch b

# 7) 由 results 重建 acceptance-fixture / summary
node probe/acc12-f-final.mjs
# 预期：acTotal 23 / pass 22 / fail 0 / blocked 1 / checks 322/322 / evidenceFileCount 153
```

**主控独立复跑（§3.5）**：AC-01 链校验 22/22（裁决 E 修复后）、AC-04 越权唤醒 16/16、AC-12 预算挂起 18/18、AC-21 阻塞判定 5/5，四条证据逐份核对能支撑 Then；`summary.json` 22/0/1、322/322、153 与 `acceptance-fixture.md`、实盘 `evidence/` 三处一致。

**已知环境副作用（必须知悉）**：全量测试会覆盖写 `docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json`。跑完后用 `git -c core.autocrlf=false checkout-index -f -- <三路径>` 恢复，**不要**用 `git checkout -- .` / `git restore -a`（`core.autocrlf=true` 下会假报全量 M）。

---

## 5. 遗留问题与边界

### 5.1 导致 Done 不满足的阻断项（**不是**观察项，必须用户裁决）

| # | 项 | 事实 | 为何阻断 | 两条出口 |
|---|---|---|---|---|
| **B-1** | **AC-21 真实宿主性能证据** | 20 实例 / 50 会话的真实宿主取证**未做**，`level=PERF_LEVEL_PENDING`、`blocked=true`、`realHostCollected=false` | §4.5 Done 条件 1（AC 100% 通过）与条件 2（阻塞 = 0）不满足，连带条件 5（终验总判 PASS）不满足；§4.5 明写「不许带着阻塞宣布需求结束」 | ① 安排本机真实宿主取证窗口，按附录 **D-11** 采集 20 实例 / 50 会话 handoff，产出 `PERF_LEVEL_REAL` 后按 `<2s / ≥20 并发` 复判；② 就 AC-21 书面升级给用户裁决豁免，并在本文件 §5.1 保留登记。**在任一出完成前：不宣布 I1.12 结束、不把阻塞改写成通过、不把 `blocked=1` 从 summary 抹去。** |

#### 5.1.1 阻塞根因的复核结论（S4 补充诊断，不改变 AC-21 判定）

复核 AC-21 的取证链路后确认：**「本机没有真实宿主面」这个表述不成立**，阻塞的真实原因是**取证脚手架自身的方法学缺陷**。

| 事实 | 依据 |
|---|---|
| `probe/acc12-cases/AC-21.mjs` 未调用 `probe/acc12-perf.mjs`，直接硬编码 `samples: []` + `PERF_LEVEL_PENDING` 拼报告 | 用例源码（`perfCheck` 对象由常量构造） |
| 它的探测路径 `C:/Program Files/DSH/dsh.exe`、`%LOCALAPPDATA%/DSH/dsh.exe`、`~/.dsh/bin/dsh` **三条都不是本机布局** | 本机实际入口见下行 |
| 产品自身 `src/adapter/dsh-launch.js::resolveDshLaunch()` 能正确定位宿主（`source: default`），`--version` → **`0.2.2-rc.3`** | `probe/acc12-perf-pilot.json` 的 `hostDiscovery` / `hostVersion` |
| 隔离 `DSH_HOME` + 复制凭据后，真实 ACP 面可握手并跑完 turn：**1 会话 743.8ms**；**5 会话 / 2 并发 5/5，547 / 665 / 726 / 1008 / 1473 ms，全部 < 2s** | `probe/acc12-perf-pilot.json`、`probe/acc12-perf-pilot-5.json` |
| 首次失败 `-32603 no API key for provider route "deepseek-official"` 的解除条件：隔离 profile 的 patch 层要**同时**覆盖 `agent-default-model` 与 `acp` 两处到本机账号路由，只改一处无效 | 同上（`--dump-config` 两处 provider 均为 `deepseek-official`） |

**为什么仍然判阻塞、不做降级**：

1. 试点规模（1 / 5 会话）**未达 D-11 的 20 实例 / 50 会话口径**，按 AC-21 的机检锚点只能停在 `PERF_LEVEL_PENDING`，不得升 `PERF_LEVEL_REAL`；
2. 试点帧是 **S4 收口期补充诊断**，**不计入 S3 的 153 份验收证据**（S3 证据集已随 `3470241` 冻结，不回溯编辑），也不得替代 AC-21 的取证；
3. 用户于 2026-11-19 明确选择「停在试点，不再跑全量」（见 `decisions.md` 裁决 F），因此 20/50 口径的取证与书面豁免两条出口均未完成。

**结论**：阻塞从「本机无真实宿主」修正为「取证脚手架未使用产品宿主发现逻辑，导致未取证」；**AC-21 判定与 §4.5 Done 结论均不变**。若要解除，仍需按 D-11 跑满 20/50 产出 `PERF_LEVEL_REAL`，或由用户出具书面豁免。

### 5.2 不影响结论的观察项（终验 §4 登记，逐条写明影响范围）

1. **AC-20 的「mock 实测」是方法学构造值，不是墙钟压测（重要）**：`probe/acc12-cases/AC-20.mjs` 的延迟为确定性构造 `400 + (i % 17) * 20`（400~720 ms），单测 `test/wp15/perf-mock.test.js` 用 `120 + (s*137) % 1400`。它验证的是「采样 → 统计（median/p95/max）→ 三档分级」管线正确、20 实例 50 会话形状成立、报告分级正确，**不是**真实承压。影响范围：不得对外表述为「实测 20 实例并发仍 <2s」，也不得被后续迭代引用为经验性能基线。
2. **AC-20 夹具未使用 `test/fixtures/mock-acp-agent.js`**：验收用例直接构造事件，仅单测读取该 fixture 的会话 ID 形状。与 AC 夹具字面有偏差，不影响机检与判定。
3. **AC-01 的夹具 run 未「跑完」**：`evidence/AC-01.run.stdout.txt` 显示 `single` 模板因缺 `DEEPSEEK_API_KEY` 触发 `HOST_ERROR`，节点/实例转 failed，但事件日志仍有 8 条且链完整。Then 的链校验全部成立，仅 Given 的「跑完一个实例」措辞偏弱。影响范围：AC-01 结论仍成立（22/22），但该帧不能当作「完整模型调用」证据复用。
4. **附录 A-6 的中文文案未由 CLI 实际渲染**：`src/cli/migrate.js` 的 `textOf()` 优先取 `MIGRATE_TEXT`（ASCII `MIGRATION DONE …` / `NO MIGRATION NEEDED`），A-6 的中文（`迁移完成  共 [N] 处引用已升级` / `无需迁移，资产已是最新`）只存在于 `MIGRATE_NONE` / `MIGRATE_DONE` 常量。AC-16/17 的 Then 未约束逐字文案，故不判失败；`test/wp15/migrate.test.js` 冻结了 ASCII 输出（改中文会破 3 处断言）。影响范围：用户可见文案与附录 A-6 有偏差，建议后续迭代统一渲染时一并处理。
5. **证据计数两口径已统一为 153**：`summary` / `acceptance-fixture.md` / 实盘均为 **153**（A 79 + B 74）；`acceptance-merge.md` 与 `progress.md` 原写 150（S3 小修新增 3 份 `AC-22.index.*` 后未回填），本报告落盘前已全部改为 153（commit `3ea10ba`）。Done 条件 6 由此满足。
6. **`requirement-understanding.md` 元信息仍写 v2**：该纪要产出于裁决 B / 需求 v2.1 之前；需求正文 v2.1 与附录 C 一致，DoR 结论不受影响，属记录时点差异。
7. **AC-22 证据内过程帧与最终帧并存**：`AC-22.index.counts.json` 为 1659/1636/14/9（AC-01 修复前过程帧），最终帧为 1660/1637/14/9；`AC-22.diffset.txt` 已注明两者，不冲突。另 `AC-22.check.purity.txt` 只落了 `src/core,src/daemon` 一段输出，`desktop/ui,desktop/harness` 段由终验独立实跑补强（exit 0）。
8. **`.workbuddy/memory/2026-11-17.md`** 属基线 `0b12bd8` 自身提交，不计入 I1.12 提交卫生问题。
9. **`migrate` 与 `otel` 的两个 CLI 入口只做参数透传**：业务判定全在 `src/core/**`，CLI 侧不重复实现校验逻辑（避免双份真值），故 CLI 单测覆盖集中在参数解析与文案，行为覆盖由 `test/wp15/{migrate,otel-export}.test.js` 的模块级用例承担。影响范围：未来改 CLI 参数表时需同步跑这两组模块用例。
10. **AC-21 取证脚手架的宿主发现缺陷（方法学，已定性、不改判定）**：`probe/acc12-cases/AC-21.mjs` 未复用产品 `resolveDshLaunch()`，只探了三个本机不存在的 `dsh.exe` 路径，且直接硬编码 `PERF_LEVEL_PENDING` 而不调用 `acc12-perf.mjs`。影响范围：阻塞结论「依据」偏弱（结论本身仍成立，因为 20/50 口径确实没做）；后续迭代若要补真实面取证，应先修脚手架再跑，否则会重复误判。详见 `decisions.md` 裁决 F。
11. **宿主版本漂移**：需求与裁决 A 记的是 `DSH 0.2.2-rc.1`，本机实测 `--version` 为 **`0.2.2-rc.3`**。影响范围：不影响任何 AC 判据（AC-21 只约束「本机真实宿主」而非具体补丁号），但报告与后续取证记录应写实际观测值，不要照抄文档版本。

---

## 6. 与前序迭代的关系

| 前序 | 复用什么 | 改了什么契约 | 回归如何保证 |
|---|---|---|---|
| **I1.9**（三层日志 + 健康度 + `orch trace show`） | 事件落盘结构、`reason` 码表、`trace show` 只读通道、审计粒度基线 | 事件链新增**哈希指纹**与 `prev` 链接（`audit-verify.js`）；`REASON_LABEL` 新增 1 键（`wake.not-whitelisted`），既有键不动 | 27 条 AC 判据文件零改动（`git diff` 空）；`verifyChain` 冻结签名不变（裁决 C）；`test/wp15/chain-compat.test.js` 双跑新旧链 |
| **I1.10b**（桌面壳 + 实例列表 + 角色流程图 + CI Release） | 实例/角色/工作流的数据布局与 CLI 命令族注册表（`FAMILY_MODULES` / `RUNTIME_COMMANDS` / `RUNTIME_SUBS`） | 命令族**只增**三条（`verify` / `migrate` / `export`）；`USAGE_LINES` **25 行逐字不变**，追加走独立的 `USAGE_LINES_I112`（6 行） | 51 条 AC 判据文件零改动；`--help` 31 行 = 25 + 6；`RUNTIME_SUBS.workflow` 保持 `pause/resume/abort` |
| **I1.11**（通知 / 干预队列 / 资产库 / 画布 / 证据浏览，并行实现） | 无代码复用（刻意零交集） | **只定义治理侧判定结果的数据形状**（`handoff.freshnessDecision` / `handoff.reviewDecision`），不定义 UI / 按钮 / 文案 | AC-23 机检：实现文件零交集、证据文件名不含 I1.11 特征词（`queue` 等）、`test/wp15/boundary-i111.test.js` |
| **I1.7**（代码隔离 worktree） | 夹具项目根一律 `%TEMP%`、`NODE_ENV=test` 必注入 | 无 | 全量 1660 条跑通、允许集合差集 0 |

**不变量守持（跨迭代 12 条，本迭代新增/触碰的 4 条）**：① 状态迁移唯一入口 `orchestrator.transit()` 未绕开（治理拦截走 `escalateState` + `return {action:'stop'}`，不直接改状态）；② `halted` 仍独立一次 `saveState`；③ 事件先落盘再广播，`emit` 失败不改内存状态（`event-bus.emit()` 新增可选 `ts`，复用状态变更同一时刻）；④ purity 31 词双目录 exit 0、中文唯一来源 `labels.js`、`USAGE_LINES` 25 行不变。

---

## 附录：命令速查

```bash
# 分支与基线
git checkout feat/i1.12-governance            # 基线 0b12bd8
git log --oneline 0b12bd8..HEAD               # a0d1be4 → fc384ef → d20fccc → d1fce53 → 3470241

# 全量 / 主链 / 架构 / 依赖
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 test/wp14/regression-drill.test.js
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid "$FORBID"
node -p "Object.keys(require('./package.json').dependencies||{}).length"

# 验收
node probe/acc12-f-run.mjs --batch a && node probe/acc12-f-run.mjs --batch b
node probe/acc12-f-final.mjs                  # 重建 acceptance-fixture.md + summary.json
node probe/acc12-perf.mjs                     # AC-20 mock 采样 / AC-21 真实面探针

# 单条 AC 隔离复跑（flake 证伪）
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 test/wp9/i19-orchestrator.test.js

# 历史证据恢复（全量测试副作用）
git -c core.autocrlf=false checkout-index -f -- \
  docs/iterations/iteration-4/evidence/nfr-perf-atomic.json \
  docs/iterations/iteration-4/evidence/nfr-perf-batch.json \
  docs/iterations/iteration-4/evidence/nfr-perf-render.json

# 产物一致性核对
node -e "const s=require('./probe/acc12-f-summary.json');console.log(s.acTotal,s.pass,s.fail,s.blocked,s.checksTotal,s.checksPassed,s.evidenceFileCount)"
ls docs/iterations/iteration-12/evidence | wc -l    # 预期 153
```
