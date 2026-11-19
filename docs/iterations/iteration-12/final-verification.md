# I1.12 S4 独立终验

- 仓库根：`D:/WWW/Maestro`
- 终验时 HEAD：`3470241`（`test(I1.12): S3 验收取证 23 AC（22 通过 / 0 不通过 / 1 阻塞）`）
- 终验角色：S4 独立终验工程师（未参与 I1.12 实现与验收，仅读判据、读产物、独立实跑）
- 写入范围：仅本文件；未改需求 / 拆分 / 裁决 / 验收 / 证据 / `src/**` / `test/**` / `probe/**`，未 `git add` / `commit`
- 判据：`execution-template.md` §3.6 / §4.2 / §4.4 / §4.5；`requirement.md` v2.1（23 AC / 19 BR / 5 NF）；`decisions.md` 裁决 A~E

## 0. 总判定

**总判定：FAIL（仅因 AC-21 阻塞导致 §4.5 Done 条件 1、2 不满足；六项校验本身全部 PASS，未发现伪造或放宽）**

### 六项（含第 7 项需求评审闭环）逐项结论

| # | 校验项 | 结论 | 一句话依据 |
|---|---|---|---|
| 1 | 结果完整性 | **PASS** | 23 条 AC 全部有结论；`summary` 覆盖 AC-01~23，22 通过 / 0 不通过 / 1 阻塞与两份 `results.jsonl` 逐条一致，`pass+fail+blocked=23` |
| 2 | 证据支撑性 | **PASS** | 23/23 条 AC 均 ≥4 份非空 `AC-XX.*`（最小 4：AC-03/04/19/21），实盘 153 份、0 空文件、0 缺件；抽查 AC-01/04/06/12/14/16/20/21 证据均可支撑 Then（AC-20 方法学观察见 §4） |
| 3 | 判定未被放宽 | **PASS** | 抽查断言期望值与 Then 逐字一致；AC-21 明写 `PERF_LEVEL_PENDING` / `blocked=true` / `realHostCollected=false`，未用 mock 顶替；AC-19 按裁决 D-6 模块直调 `detectAntipatterns`，未新增 CLI |
| 4 | 门禁与回归 | **PASS** | 实跑 `tests 1660 / pass 1637 / fail 14 / skipped 9`（与预期完全一致）；三主链 8/8；purity 双目录 31 词 exit 0；deps 0；`git diff --check` 0；差集 0；性能证据三文件已恢复、工作区干净 |
| 5 | 缺陷与遗留 | **PASS** | `acc12-f-blockers.md` 的 AC-21 有判定、试过路径、解除条件；无「不通过」AC；`report.md` 尚未生成（S4 主控产物），终验只核 `acceptance-*` 与 `summary` |
| 6 | 提交范围 / 卫生 | **PASS** | `d20fccc` / `d1fce53` 未卷入 `probe/**`、`evidence/**`；`3470241` 只含验收产物与 `progress.md`；工作区干净 |
| 7 | 需求评审闭环 | **PASS** | `review-round1.md` / `review-round2.md` 齐全、最终轮 PASS（0 阻断）；需求头部 v2.1 = 附录 C 末行 v2.1；DoR 13 条 12 绿 / 1 黄 / 0 红 |

### §4.5 Done 条件对照

| # | Done 条件 | 是否满足 | 依据 |
|---|---|---|---|
| 1 | AC 100% 通过 | **不满足** | 22/23 通过，AC-21 为**阻塞**（真实宿主面未取证） |
| 2 | 不通过 = 0 且阻塞 = 0 | **不满足** | 不通过 0，但**阻塞 1**（AC-21）——按 §4.5「不许带着阻塞宣布需求结束」 |
| 3 | 门禁全绿 | 满足（按既定允许集合口径） | 1660/1637/14/9 ≥1425、差集 0、三主链 8/8、purity 双目录 exit 0、deps 0 |
| 4 | 缺陷与遗留收口 | 部分 | `blockers.md` AC-21 有处置与解除条件；`report.md` 尚未生成，无法核对 §5 观察项 |
| 5 | 终验总判定 PASS | **不满足** | 本终验总判 FAIL（AC-21 阻塞） |
| 6 | 四处数字一致 | 待办 | `summary` / `acceptance-fixture` / 实盘证据均为 **153**，但 `acceptance-merge.md` 与 `progress.md` 仍写 **150**（见 §4-5） |
| 7 | 需求评审闭环 PASS | 满足 | 两轮评审记录齐全、最终 PASS；v2.1 与附录 C 一致；DoR 无红 |

**结论**：I1.12 的实现与取证过程**可信**（六项无伪造、无放宽、门禁与回归可复现），但**不具备收口条件**。唯一出口是主控安排本机真实宿主取证后按 AC-21 判据复判，或就 AC-21 书面升级给用户裁决豁免；在此之前不得把 AC-21 写成通过，也不得宣布 Done。

## 1. 六项校验

### 1.1 结果完整性

- `probe/acc12-f-summary.json`：`acTotal=23`、`pass=22`、`fail=0`、`blocked=1`、`checksTotal=322`、`checksPassed=322`、`checksFailed=0`；`perAc.length=23` 且 AC 编号唯一（AC-01→AC-23 全覆盖）。
- 两份 `results.jsonl` 合计 23 行，`verdict` 分布：`通过 22 / 阻塞 1 / 不通过 0`，与 summary 一致；AC-21 记录 `verdict=阻塞`、`grading=阻塞`、5/5 核对项。
- 与 `acceptance-fixture.md` 顶层表（A 12/0/0 + B 10/0/1 = 22/0/1、322/322、153 份）一致；`acceptance-merge.md` 的 150 份为 S3 小修前的旧口径（见 §4-5），不影响 AC 判定一致性。
- **结论**：结果完整性 PASS；但按 §4.5，AC-21 的阻塞直接使 **Done 条件 1、2 不满足**，此处如实记录，未改写为通过。

### 1.2 证据支撑性

- 实盘 `evidence/` 153 份文件：按 AC 前缀分布 AC-01 9、AC-02 5、AC-03 4、AC-04 4、AC-05 6、AC-06 8、AC-07 8、AC-08 7、AC-09 5、AC-10 7、AC-11 8、AC-12 8、AC-13 6、AC-14 6、AC-15 6、AC-16 9、AC-17 6、AC-18 9、AC-19 4、AC-20 6、AC-21 4、AC-22 13、AC-23 5；0 字节 0 份；summary 内 153 条路径**全部存在、无重复、无跨 AC 串号**。
- 抽查 8 条（证据 → Then）：
  - **AC-01**：`verify.good.stdout` = 「链完整，共 8 条」，`verify.bad.stdout` = 「链已断：第 2 条记录与前一条指纹不匹配」，`module-result.json` 的 `seq/firstMismatch/badIndex` 均为 2，原件前后 sha256 相同——支撑「退出码非 0 + 首处失配序号 + 校验只读」。
  - **AC-04**：`decision.deny.json` 给 `allowed=false`、`reason=wake.not-whitelisted`、`detail` 含来源 role-a / 目标 role-c / 时间；核对项含目标会话 `[]`、未投递 `[]`、拒绝审计恰 1 条——支撑「拒绝 + 不投递 + 留痕」。
  - **AC-06**：两份判定分别 `fingerprint_mismatch` / `evidence_missing`，`stale=true` 且含 `instanceId/handoffId/nodeId`，升级 2 次、未投递 `[]`——支撑「两包均拒、原因分别对应、生成升级」。
  - **AC-12**：`state-suspended.json` 为 `state=suspended`、`pauseReason=budget_exhausted`、`resumeRound=4`、无 failed 节点；resume 后 `running`、轮次仍 4——支撑「挂起而非失败、补预算可续」。
  - **AC-14**：`confirm.txt` = 「导入成功  [签名有效 · 版本兼容]」，`import.json` `ok=true` 且落库字节与包内一致——支撑「导入成功 + 用户可见确认」。
  - **AC-16**：plan 列出 2 处（parent 1→2、sub 1→3），应用后引用为 `parent@2` / `sub@3`，正文 `name` 未变，摘要 `MIGRATION DONE 2 REFERENCES UPGRADED` 与清单 2 条对应——支撑「清单/改写/摘要一致」。
  - **AC-20**：样本 50 条、实例 20 个、会话 50 个，统计 median 560 / p95 700 / max 720 ms，报告 `level=PERF_LEVEL_MOCK`、`blocked=false`——字面支撑 Then；方法学观察见 §4-1。
  - **AC-21**：`perf-check.stdout.json` 明写 `level=PERF_LEVEL_PENDING`、`levelLabel=待本机实测`、`blocked=true`、`ok=false`、`realHostCollected=false`、`triedPaths` 5 条；4 份证据只证明「真实宿主未取证」，**未**出现任何真实宿主达标声称，也**未**把 AC-20 的 mock 结果计入本 AC。
- **结论**：证据支撑性 PASS（AC-20 的方法学限制另记 §4-1，不改 AC-20 判定）。

### 1.3 判定未被放宽

- 抽查期望值：AC-01「第 2 条」与裁决 C / D-2 的 `prev` 失配口径一致；AC-04 `wake.not-whitelisted` 为冻结新码且既有 `wake.rejected` 保留；AC-06 reason 双值、升级 2 次与 Then 逐字对应；AC-12 `suspended` + `budget_exhausted` 未替换为失败；AC-14「签名有效 / 版本兼容」逐字；AC-16 清单条数 = 摘要条数 = 实际改写数；AC-20 `<2000` 判据取 P95，级别键 `PERF_LEVEL_MOCK`。
- AC-21 未放宽：`blocked=true`、`ok=false`、`realHostCollected=false`、`level=PERF_LEVEL_PENDING`，且 `probe/acc12-f-blockers.md` 与 `acceptance-product.md` 均写「阻塞、不算失败、不得 mock 顶替、不得伪通过」，与裁决 A 第 3 条及需求 483/484 行契约一致。
- AC-19 未越界：`probe/acc12-cases/AC-19.mjs` 直接 `import { detectAntipatterns }` 调只读模块，未新增 CLI 子命令，符合裁决 D-6；架构扫描 `emit/transit/escalat hits=0`。
- **结论**：判定未被放宽，PASS。

### 1.4 门禁与回归（全部独立实跑，非采信自述）

- 全量：`NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` → `tests 1660 / pass 1637 / fail 14 / skipped 9`，`EXIT:1`，与预期数字完全一致。
- `^not ok` 14 条与允许集合做差：
  - **win32 登记 12 条**：`--host-error 早返回（-32603）`、`resolveEvidenceRef`、`可注入 fs`、`S-07`、`the desktop port listens on loopback only`、`AC-27`、`newState`、`execution.summary`、`--fail-tool`、`--stop-after`、`grep session`（`object: 'session'`）、`三主链`；
  - **S0 既有红 2 条**（裁决 K）：`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`、`AC-04：空态、不可读行不阻断…`；
  - **集合外新增红 = 0，差集 0**（12 + 2 = 14）。
  - **主控复核补正（2026-11-19）**：本节初稿把 win32 登记写成「11 条」并额外列出 flaky「`live 取消`」，凑成 11+2+1=14。复核 `evidence/AC-22.full-suite.final.log` 的 `^not ok` 逐行清单后确认：**最终帧 14 条 = win32 登记 12 + S0 既有红 2，不含任何 flake**；`test/wp9/i19-orchestrator.test.js` 的隔离复跑是过程帧出现一次「三主链」负载 flake 后的**证伪性诊断**（该帧见 `AC-22.flake.three-main-chains.isolated.log`，最终全量未复现），不计入最终帧失败集合。计数口径不变：`observedFail=14`、`集合外新增红=0`、`差集 0`。
- 三主链：`NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 test/wp14/regression-drill.test.js` → `tests 8 / pass 8 / fail 0`，`EXIT:0`。
- 架构：purity 双目录 31 词 —— `src/core,src/daemon`（38 文件）exit 0；`desktop/ui,desktop/harness`（31 文件）exit 0；`dependencies` 键数 = 0；`git diff --check` exit 0；`USAGE_LINES` = 25、`USAGE_LINES_I112` = 6、`orch --help` = 31 行（25 行既有逐字 + 6 行追加）。
- 恢复：全量测试覆盖写了 `docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json`，已用 `git -c core.autocrlf=false checkout-index -f -- <三路径>` 恢复，随后 `git status --short` 为空。
- **结论**：门禁与回归 PASS。

### 1.5 缺陷与遗留

- `probe/acc12-f-blockers.md` 仅登记 AC-21：写明「要求什么 / 试过什么（环境变量 + 三处路径 + `not_collected`，共 5 条）/ 为什么观测不到 / 判定 / 解除条件（采集 `PERF_LEVEL_REAL` 后复核 `<2s / ≥20 并发`）」；「不通过 / 缺陷项」为空，AC-01 已按裁决 E 修复且不计缺陷。
- `report.md` 尚未生成（进度台账 S4 行为「进行中」），终验按要求只核对 `acceptance-*` 与 `summary`；因此 Done 条件 4 的「`report.md` §5 观察项」无法核对，只能判「部分」。
- **结论**：缺陷与遗留 PASS（过程层面），但收口层面未完成。

### 1.6 提交范围 / 卫生

| commit | 内容 | `probe/**` | `evidence/**` | 结论 |
|---|---|---|---|---|
| `d20fccc` | 批次 3：`src/cli/{main,labels,verify}.js`、`src/core/{orchestrator,escalation}.js`、`test/wp15/{wiring,regression}.test.js`、`test/wp2/labels.test.js`、评审/修复文档 | 无 | 无 | 合规 |
| `d1fce53` | 裁决 E 修复：`src/cli/verify.js`(+7/-1)、`test/wp15/wiring.test.js`(+20)、`decisions.md`、`s2-fix-ac01.md` | 无 | 无 | 合规 |
| `3470241`（S3） | 214 个文件：`probe/acc12-*`（脚手架/用例/核对表/results/summary/blockers）、`docs/iterations/iteration-12/{acceptance-*,progress}.md`、`evidence/**` | 仅验收脚手架 | 仅验收证据 | 合规（无 `src/**` / `test/**`） |

- 工作区：`git status --short` 为空（本终验文件为唯一新增，见文末）；`git diff --check` exit 0。
- `.workbuddy/memory/2026-11-17.md` 出现在 `0b12bd8..HEAD` 文件清单，但该文件由基线 `0b12bd8` 自身提交（`git log -- .workbuddy/...` 指向基线），非 I1.12 夹带。
- **结论**：提交范围 / 卫生 PASS。

### 1.7 需求评审闭环

- `review-round1.md`：评 v1，总判 **PASS**（0 阻断 / 6 建议），规划逐句覆盖 18/18、夹带 0、缺漏 0。
- `review-round2.md`：评 v2，总判 **PASS**（0 阻断 / 6 建议移交 S1），F1-01~F1-06 三态全「已修」、F 项清零。
- 版本一致性：`requirement.md` 头部 `**版本**：v2.1`，附录 C 末行为 `| v2.1 | 2026-11-18 |`（裁决 B 扩授权段），两者一致；v2.1 只扩 D-13 授权，AC 23 / BR 19 / NF 5 与 Then 零改动。
- DoR（`requirement-understanding.md` §8）：13 条 12 绿 / 1 黄（DoR-7 = AC-21 真实宿主未取证，契约允许「阻塞≠失败」）/ 0 红；S0 Gate 满足。
- **结论**：需求评审闭环 PASS。唯一陈旧点：`requirement-understanding.md` 元信息仍写 v2（产出于 v2.1 裁决之前），属记录时点问题，不影响 v2.1 与附录 C 的一致性（见 §4-6）。

## 2. 实跑命令与输出

```text
$ cd D:/WWW/Maestro && NODE_ENV=test node --test --test-concurrency=1 \
    --test-timeout=120000 --test-force-exit "test/**/*.test.js" \
    > /tmp/i112-final-verify.log 2>&1; echo EXIT:$?; tail -20 /tmp/i112-final-verify.log
EXIT:1
# tests 1660
# pass 1637
# fail 14
# cancelled 0
# skipped 9
# duration_ms 215483.1918

$ grep -c '^not ok' /tmp/i112-final-verify.log
14
（逐条与 win32 16 项登记 / S0 既有红 2 条对账：命中 12 + 2 = 14，集合外新增红 0，差集 0；最终帧不含 flake，
 过程帧的一次「三主链」负载 flake 另见 `AC-22.flake.three-main-chains.isolated.log`）

$ NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 \
    test/wp14/regression-drill.test.js
EXIT:0
# tests 8 / # pass 8 / # fail 0

$ NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 \
    --test-force-exit test/wp9/i19-orchestrator.test.js
EXIT:1
# tests 10 / # pass 4 / # fail 6
ok 7 - live 取消：四项全 null、终态 cancelled/ended、不阻断取消   ← flake 隔离通过
（其余 6 条均为 EBUSY hookFailed，与 win32 登记项同名同因）

$ FORBID="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,\
coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,\
compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,\
doc-review,code-change,test-run,code-review,coordination,compliance-check"
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"
OK: 扫描 38 个文件…零命中        EXIT:0
$ node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid "$FORBID"
OK: 扫描 31 个文件…零命中        EXIT:0
$ node -p "Object.keys(require('./package.json').dependencies||{}).length"
0
$ git diff --check
EXIT:0
$ node --input-type=module -e "import {USAGE_LINES,USAGE_LINES_I112} from './src/cli/labels.js'; ..."
USAGE_LINES 25 / USAGE_LINES_I112 6
$ NODE_ENV=test node bin/orch.js --help | wc -l
31

$ git -c core.autocrlf=false checkout-index -f -- \
    docs/iterations/iteration-4/evidence/nfr-perf-atomic.json \
    docs/iterations/iteration-4/evidence/nfr-perf-batch.json \
    docs/iterations/iteration-4/evidence/nfr-perf-render.json
（恢复后 git status --short 为空）

$ node -e "…核对 summary 与 evidence…"
files listed 153 / unique 153 / missing 0 / empty 0 / on disk 153 / perAc unique 23
```

## 3. AC-21 阻塞与用户裁决事项

- **事实**：真实宿主（本机 DSH 0.2.2-rc.1）性能面未取证；`AC-21.perf-check.stdout.json` 与 `AC-21.meta.result.json` 均 `level=PERF_LEVEL_PENDING`（`待本机实测`）、`blocked=true`、`ok=false`、`realHostCollected=false`，`triedPaths` 5 条（`MAESTRO_DSH_EXE/MAESTRO_DSH_BIN` 未设置、`C:/Program Files/DSH/dsh.exe` / `%LOCALAPPDATA%/DSH/dsh.exe` / `~/.dsh/bin/dsh` 不存在、20 实例/50 会话取证 `not_collected`）。
- **判定**：**阻塞**，不是通过、也不是不通过；符合裁决 A 第 3 条、需求 483/484 行契约、§3.3 第 3 条「阻塞不算失败、伪通过才是」。
- **未放宽证据**：AC-21 的 4 份证据未引用 AC-20 的任何 mock 数值；AC-20 的结论只标注 `mock 实测`，未出现在真实宿主判据中；`acceptance-product.md` 明确「不得将 AC-20 的 mock 实测写成真实宿主达标」。
- **对 Done 的影响**：直接导致 §4.5 Done 条件 1（AC 100% 通过）与条件 2（阻塞 = 0）不满足，并连带条件 5（终验总判 PASS）不满足。
- **需要的用户 / 主控裁决**（二选一，均需书面留痕）：
  1. 安排本机真实宿主取证窗口，按附录 D-11 采集 20 实例 / 50 会话 handoff，产出 `PERF_LEVEL_REAL` 后复判 `<2s / ≥20 并发`；
  2. 就 AC-21 明确升级给用户裁决并取得书面豁免（§4.5 允许的唯一另一条出口），同时在 `report.md` §5 登记为不影响其余 22 条结论的边界项。
- 在任一出口完成前：**不得宣布 I1.12 结束**，不得把 AC-21 改写成通过，不得把 `阻塞=1` 从 summary 中抹去。

## 4. 观察项 / 遗留（均不影响六项结论，但需在 `report.md` §5 如实登记）

1. **AC-20「mock 实测」的方法学限制（重要，不改判定）**：`probe/acc12-cases/AC-20.mjs` 的延迟为确定性构造 `latency = 400 + (i % 17) * 20`（400~720 ms）；单测 `test/wp15/perf-mock.test.js` 用 `120 + (s*137) % 1400`。两者验证的是「采集/统计/分级管线正确、20 实例 50 会话形状成立、报告分级正确」，**不是**墙钟并发压测采样。故 AC-20 可支撑其机检与 Then 字面，但不应对外表述为「实测承压 20 实例仍 <2s」；建议 report §5 明写该口径，避免被后续迭代引用为经验性能基线。
2. **AC-20 夹具未使用 `mock-acp-agent.js`**：AC-20 的 `夹具` 指定仓库内 `test/fixtures/mock-acp-agent.js`；验收用例直接构造事件（仅单测读取该 fixture 的会话 ID 形状）。不影响机检，但与夹具字面有偏差。
3. **AC-01 夹具 run 未「跑完」**：`AC-01.run.stdout.txt` 显示 `single` 模板因缺 `DEEPSEEK_API_KEY` 触发 `HOST_ERROR`，节点/实例转为 failed，但事件日志仍有 8 条且链完整。Then 的链校验全部成立；仅 Given 的「跑完一个实例」措辞偏弱，建议 report 备注。
4. **A-6 中文输出基线未由 CLI 实际渲染**：`src/cli/migrate.js` 的 `textOf()` 优先取 `MIGRATE_TEXT`（ASCII：`MIGRATION DONE …` / `NO MIGRATION NEEDED`），A-6 的中文（`迁移完成  共 [N] 处引用已升级` / `无需迁移，资产已是最新`）只存在于 `MIGRATE_NONE` / `MIGRATE_DONE` 常量。AC-16/17 的 Then 未约束逐字文案，故不判失败；但用户可见文案与附录 A-6 存在偏差，建议在 report 登记或后续迭代统一渲染。
5. **证据计数两口径（影响 Done 6）**：`summary` / `acceptance-fixture.md` / 实盘均为 **153**（A 79 + B 74）；`acceptance-merge.md`（§1、§2、§4）与 `progress.md` S3 行仍写 **150**（S3 小修新增 3 份 `AC-22.index.*` 后未回填）。`report.md` 若沿用 150 将破坏 §4.5 条件 6，需在写报告前统一为 153。
6. **`requirement-understanding.md` 仍写 v2**：该纪要产出于裁决 B / v2.1 之前；需求正文 v2.1 与附录 C 一致，DoR 结论不受影响，仅记录时点差异。
7. **AC-22 证据内的过程帧/最终帧并存**：`AC-22.index.counts.json` 为 1659/1636/14/9（AC-01 修复前），最终帧为 1660/1637/14/9；`AC-22.diffset.txt` 已注明过程帧与最终帧，故不冲突。另 `AC-22.check.purity.txt` 只落了 `src/core,src/daemon` 一段输出；`desktop/ui,desktop/harness` 段本次由终验独立实跑补强（exit 0）。
8. **AC-21 核对表 C04/C05 展示语义**已在 S3 小修中修正（`realHostCollected=false`、`triedPaths=5`）；本次复核重跑结果为 5/5 且判定仍为阻塞，修复有效。
9. **`.workbuddy/memory/2026-11-17.md`** 属基线 `0b12bd8` 既有提交，不计入 I1.12 提交卫生问题。

## 5. 提交卫生明细

```text
$ git log --oneline -6
3470241 test(I1.12): S3 验收取证 23 AC（22 通过 / 0 不通过 / 1 阻塞）
d1fce53 fix(I1.12): AC-01 链校验 CLI 失配序号取 firstMismatch（裁决 E）
d20fccc feat(I1.12): 批次3 WP-7 命令表与治理门禁接线（三轮评审 PASS）
fc384ef feat(I1.12): 批次2 WP-4/5/6 包生态可观测与性能基线（评审 PASS）
a0d1be4 feat(I1.12): 批次1 WP-1/2/3 事件链加固与治理判定底座（评审 PASS）
5d9fa26 docs(I1.12): S1 拆分评审 PASS（7 WP / 裁决 B 扩授权 / 需求 v2.1）
```

- `git show --name-only d20fccc | grep -E '^(probe|docs/iterations/iteration-12/evidence)/'` → 无命中（exit 1）。
- `git show --name-only d1fce53 | grep -E '^(probe|docs/iterations/iteration-12/evidence)/'` → 无命中（exit 1）。
- `3470241`：214 个文件，全部落在 `probe/acc12-*`、`docs/iterations/iteration-12/{acceptance-*,progress.md}`、`docs/iterations/iteration-12/evidence/**`；`grep -E '^(src|test)/'` → 无命中。
- `git diff --stat 0b12bd8..HEAD -- docs/iterations/iteration-10b/requirement.md docs/iterations/iteration-9/requirement.md` → 空（上游 78 条 AC 判据文件零改动）。
- `git status --short` → 空；`git diff --check` → exit 0。
- 被全量测试覆盖写的 `docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json` 已恢复，恢复后状态为空（无这三项）。

**唯一新增文件**：本文件 `docs/iterations/iteration-12/final-verification.md`（终验产物，未被 git 跟踪）。
