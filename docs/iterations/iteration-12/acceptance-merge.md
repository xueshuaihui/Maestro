# I1.12 S3 验收结果合并回执

- 合并角色：S3 验收结果合并工程师
- 仓库根：`D:/WWW/Maestro`
- 合并时 HEAD：`d1fce53`（`git rev-parse --short HEAD` 实取）
- 输入：`probe/acc12-f-results.jsonl`（A，12 条）、`probe/acc12-f-results-b.jsonl`（B，11 条）、
  `probe/acc12-f-parts/AC-01.md~AC-23.md`、`docs/iterations/iteration-12/evidence/`、
  `docs/iterations/iteration-12/acceptance-fixture-b.md`、裁决 A / D / E
- 输出：`docs/iterations/iteration-12/acceptance-fixture.md`、`probe/acc12-f-summary.json`、
  `probe/acc12-f-blockers.md`、本回执
- 纪律：未改 `src/**`、`test/**`、`probe/acc12-cases/**`、`probe/acc12-f-parts/**`、
  `probe/acc12-f-results*.jsonl`、`evidence/**` 及需求/拆分/裁决/进度/报告/终验文件；未 git add / commit。

## 1. 合并数字

**总判：22 通过 / 0 不通过 / 1 阻塞（AC-21 真实宿主未取证）**

| 批次 | 范围 | 通过 | 不通过 | 阻塞 | 核对项 | 唯一证据 |
|---|---|---|---|---|---|---|
| A | AC-01~AC-12 | 12 | 0 | 0 | 194/194 | 79 |
| B | AC-13~AC-23 | 10 | 0 | 1 | 128/128 | 74 |
| 总计 | AC-01~AC-23 | 22 | 0 | 1 | 322/322 | 153 |

- 核对项 322 = A 194 + B 128，与预期一致（未出现以 results 修正预期的情况）。
- `checksFailed=0`；AC-21 的 5/5 是「阻塞出口」核对项（级别 `PERF_LEVEL_PENDING`、`blocked=true`、
  文案逐字、`realHostCollected=false`、triedPaths 非空），按契约成立，计为通过核对，但 AC 判定仍为阻塞。
- 唯一证据 153 份：按文件名去重、排除 0 字节；A 79 + B 74（S3 小修新增 AC-22 过程/最终帧与 flake 帧）。

## 2. 每 AC 判定与证据数

| AC | 批次 | 判定 | 分级 | 核对项 | 证据数 |
|---|---|---|---|---|---|
| AC-01 | A | 通过 | mock 实测 | 22/22 | 9 |
| AC-02 | A | 通过 | mock 实测 | 21/21 | 5 |
| AC-03 | A | 通过 | mock 实测 | 10/10 | 4 |
| AC-04 | A | 通过 | mock 实测 | 16/16 | 4 |
| AC-05 | A | 通过 | mock 实测 | 7/7 | 6 |
| AC-06 | A | 通过 | mock 实测 | 23/23 | 8 |
| AC-07 | A | 通过 | mock 实测 | 16/16 | 8 |
| AC-08 | A | 通过 | mock 实测 | 15/15 | 7 |
| AC-09 | A | 通过 | mock 实测 | 16/16 | 5 |
| AC-10 | A | 通过 | mock 实测 | 15/15 | 7 |
| AC-11 | A | 通过 | mock 实测 | 15/15 | 8 |
| AC-12 | A | 通过 | mock 实测 | 18/18 | 8 |
| AC-13 | B | 通过 | mock 实测 | 15/15 | 6 |
| AC-14 | B | 通过 | mock 实测 | 8/8 | 6 |
| AC-15 | B | 通过 | mock 实测 | 10/10 | 6 |
| AC-16 | B | 通过 | mock 实测 | 14/14 | 9 |
| AC-17 | B | 通过 | mock 实测 | 12/12 | 6 |
| AC-18 | B | 通过 | mock 实测 | 13/13 | 9 |
| AC-19 | B | 通过 | mock 实测 | 15/15 | 4 |
| AC-20 | B | 通过 | mock 实测 | 12/12 | 6 |
| AC-21 | B | **阻塞** | 阻塞 | 5/5 | 4 |
| AC-22 | B | 通过 | mock 实测 | 13/13 | 11 |
| AC-23 | B | 通过 | mock 实测 | 11/11 | 4 |

- AC-21 判定为阻塞，未写成通过，未用 AC-20 的 mock 结果顶替：其 4 份证据仅证明
  「真实宿主未取证」（`PERF_LEVEL_PENDING` / `blocked=true` / `realHostCollected=false`）。
  阻塞原因、试过路径、观测不到的原因与解除条件见 `probe/acc12-f-blockers.md`。

## 3. 证据审计

- 规则：每个 AC ≥4 份非空 `AC-XX.*`；按文件名去重；0 字节不计。
- 结果：23/23 条 AC 全部 ≥4 份（最小 4：AC-03/04/19/21/23），0 字节 0 个，重名 0 个，
  跨 AC 串号 0 个（每份文件前缀与所属 AC 一致），总 153 份（含 S3 小修新增的 AC-22 最终/过程/flake 帧）。
- AC-01 核对：`AC-01.verify.bad.stdout.txt` = 「链已断：第 2 条记录与前一条指纹不匹配」，
  `AC-01.verify.module-result.json` 的 `seq/firstMismatch/badIndex` 均为 2，与裁决 E 及 22/22 通过一致。

### 审计异常（如实登记，未伪补、未改证据）

1. **AC-21 核对项 C04/C05 的「期望值 / 实测值」列语义不一致（展示层，不影响判定）**：
   `probe/acc12-f-parts/AC-21.md` 与 `evidence/AC-21.meta.result.json` 中
   C04 记 `expected=false / actual=true / ok=true`，C05 记 `expected=count=5 / actual=true / ok=true`。
   核对点为布尔断言（「mock 结果未进入真实宿主判据」「triedPaths 非空」），`ok` 与证据
   `realHostCollected=false`、`triedPaths.length=5` 一致，故判定不受影响；但两列字面不对应，
   属核对表展示瑕疵。上述文件在禁改清单内，本次未改动，仅登记。
2. **B 段 AC-22 证据数存在两个口径**：`acceptance-fixture-b.md` 表格计 8（本批新采），
   其索引与目录实有 11 份（另 3 份 `AC-22.index.*` 复用主控历史帧，B 段标题已注明「68 份 + 复用 3 份」）。
   合并时按唯一文件名计 11；S3 小修后又新增 AC-22 最终帧/过程 flake 帧等 3 份，B 批合计 74；
   B 段内文字按原文保留，未改写其数字，口径差异在本回执与合并说明中标注。
3. **HEAD 时点差异（非异常，说明性）**：B 段记录其取证时点 HEAD=`d20fccc`；A 批 AC-01 在
   `d1fce53`（裁决 E 修复提交）复跑为 22/22。合并件顶层统一标注合并时 HEAD=`d1fce53`，
   B 段内保留其原始时点记录，未追溯改写。
4. **AC-01 历史失败已消除**：A 旧结果（19/22 不通过）已被 20:36 的复跑记录覆盖，
   `results.jsonl` 中 AC-01 现为 22/22 通过，旧失败核对项不再出现在合并件中；此为裁决 E 的预期修复，
   不计为缺陷。

## 4. 合并动作

- `probe/acc12-f-final.mjs`：改为同时读取 A/B 两份 results，每 AC 取最后一条，按 AC 编号排序；
  缺任一 AC（或判定非法、证据为空、同批矛盾判定）即非零退出且不落盘。
- `probe/acc12-f-summary.json`：`generatedAt` / `head`（实取）/ `acTotal=23` / `pass=22` /
  `fail=0` / `blocked=1` / `checksTotal=322` / `checksPassed=322` / `checksFailed=0` /
  `evidenceFileCount=153` / `evidenceFiles` / `batches.a|b` / `perAc`（ac、verdict、grading、checks、
  evidence、blocker）。
- `docs/iterations/iteration-12/acceptance-fixture.md`：顶层写总判与 A/B/总计合计表；
  `BATCH-A` 段按 A results 重建（AC-01 22/22 通过）；`BATCH-B` 段嵌入 `acceptance-fixture-b.md` 原文
  （逐字一致，脚本校验）；末尾附合并口径说明。
- `probe/acc12-f-blockers.md`：只登记 AC-21，写明要求 / 试过 / 为何观测不到 / 判定 / 解除条件；
  其余 AC 无阻塞、无缺陷（AC-01 已修复，不计缺陷）。

## 5. 复跑与门禁

```
$ cd D:/WWW/Maestro && node probe/acc12-f-final.mjs
I1.12 A+B 结果合并完成
  HEAD d1fce53
  AC 23（A 12 / B 11）
  通过 22 / 不通过 0 / 阻塞 1
  核对项 322/322（A 194/194 + B 128/128）
  唯一证据 153 份（A 79 + B 74），空文件 0 个
  阻塞：AC-21
  报告：docs/iterations/iteration-12/acceptance-fixture.md
  摘要：probe/acc12-f-summary.json
exit 0
```

- 连续两次运行：除 `generatedAt` / A 段「生成时间」外，summary 与报告的归一化内容哈希完全一致
  （`cce4b2986d3129d3` / `ddbbf80e1ac3360a`）；23 条 AC 无重复、无空证据、顺序稳定（AC-01→AC-23）。
- summary 校验：`acTotal=23`、`perAc.length=23`、`unique=23`、`pass+fail+blocked=22+0+1=23`、
  `checksPassed=checksTotal=322`、`checksFailed=0`、`evidenceFiles` 153 条且互不重复。
- 合并件校验：AC 表格行 23 条且排序唯一；`BATCH-B` 嵌入内容与 `acceptance-fixture-b.md` 正文逐字相等；
  唯一「阻塞」行是 AC-21。
- `git diff --check` exit 0；`src/**`、`test/**` 无改动（`git status` 仅有本任务白名单内的新增/修改）。

## 6. 小修记录（AC-21 核对表 C04/C05 展示语义）

- 问题：`probe/acc12-cases/AC-21.mjs` 的 C04/C05 误用 `check`（第三参为布尔结论而非实测值），
  生成表出现 `expected=false / actual=true` 与 `expected=count=5 / actual=true` 的列语义错位。
- 修法：C04 改用 `eq(c, label, perfCheck.realHostCollected, false)`；C05 改用
  `verify(c, label, triedPaths.length, (n) => n > 0, '> 0')`；导入由 `check` 换成 `verify`。仅改展示语义，
  判定链（`gradeCase` / `finish` / `block`）与产品代码未改。
- 修后 AC-21 核对表：
  - C04 `mock 结果未进入真实宿主判据（realHostCollected=false）`：期望 `false` / 实测 `false` / ✓
  - C05 `附试过路径（triedPaths 非空）`：期望 `> 0` / 实测 `5` / ✓
- 重跑 `NODE_ENV=test node probe/acc12-cases/AC-21.mjs`：判定仍 **阻塞**、5/5 核对项、
  `realHostCollected=false`、`triedPaths` 非空（5 条），非通过/非不通过。
- 重跑 `node probe/acc12-f-final.mjs`：总判仍 **22 / 0 / 1**，核对项 **322/322**
  （A 194/194 + B 128/128），唯一证据 **153**（A 79 + B 74），与修前一致。
- 门禁：`git diff --check` exit 0；`src/**`、`test/**` 无改动；本小修仅触及 AC-21 自有的
  case 脚本、part、results-b 行、summary/fixture 重生成件与本记录。

## 7. 小修记录（AC-11 证据文件名触发 AC-23 #3 误报）

- 问题：`test/wp15/boundary-i111.test.js::AC-23 #3` 失败，offender 为
  `docs/iterations/iteration-12/evidence/AC-11.verify.gate-queued.json`。AC-23 的 I1.11 特征正则含
  `/interven|queue/i`，把未跟踪证据文件名中的 `queued` 误判为干预队列特征；产品代码与 AC-23 断言本身无误。
- 修法：只改证据文件名。`probe/acc12-cases/AC-11.mjs` 中 `evidence(c, 'verify', 'gate-queued.json', …)`
  改为 `gate-waiting.json`；核对项、期望值与判定逻辑一律不变。旧证据文件重命名为
  `docs/iterations/iteration-12/evidence/AC-11.verify.gate-waiting.json`（内容与 sha256 不变）。
- 重跑 `NODE_ENV=test node probe/acc12-f-run.mjs AC-11`：判定仍 **通过**、核对 **15/15**、证据 **8**，
  证据名已为 `AC-11.verify.gate-waiting.json`。
- 门禁前后对比（`NODE_ENV=test node --test --test-concurrency=1 test/wp15/boundary-i111.test.js`）：
  - 修前：5 项中 AC-23 #3 失败（offender `…gate-queued.json`）。
  - 修后：**5/5 通过**、0 失败；改动清单中已无任何命中 I1.11 特征的路径。
- 重跑 `node probe/acc12-f-final.mjs`：总判仍 **22 / 0 / 1**，核对项 **322/322**
  （A 194/194 + B 128/128），唯一证据 **153**（A 79 + B 74），空文件 0，阻塞仅 AC-21。
- 影响面：`src/**`、`test/**` 无改动；仅触及 AC-11 自有 case 脚本、part、`acc12-f-results.jsonl` 追加重跑行、
  summary/fixture 重生成件、被重命名的单个证据文件与本记录。
