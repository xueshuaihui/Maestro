# I1.6 最终结果校验（终验）

> **迭代**：I1.6 — 自定义角色 + 工作流完整原语 + 校验器 + CLI 资产命令集
> **校验对象**：S3 收口 HEAD `6215df2`（`0cd113b..6215df2` 全区间）
> **校验依据**：`docs/templates/execution-template.md` §3.6 六项 + §4.5 Done 对照
> **需求基线**：`docs/iterations/iteration-6/requirement.md` v7（65 AC）
> **校验时间**：2026-11-09
> **独立性声明**：本终验由独立子 Agent 在干净上下文执行，未参与本迭代的需求撰写、拆分、实现与验收；未修改 `src/**`、`test/**`、`assets/**`、`probe/**` 与 `docs/iterations/iteration-6/` 下任何既有文件（本文件为唯一新增）；全部结论来自本人实跑命令与原始文件读取，不采信 report/acceptance 的自述。

**总判定：PASS**（六项全 PASS；两处非阻断不符点见各节「发现的问题」与文末）。

---

## 1. 结果完整性 — PASS

**实跑**：

```
node -e "…（读取 probe/acc6-f-summary.json 统计）…"
```

关键输出：

```
perAc.length: 65
missing: 无              （AC-01~AC-65 无缺号）
verdicts: {"通过":65}    （不通过 0、阻塞 0）
noVerdict: 无
emptyChecks: 无          （每条 AC checks 非空）
checksTotal: 871 | allOk: true   （871 项核对全部 ok 且无 blocked）
evidenceFiles: 547 evidenceCovered: 65 thinEvidence: []
```

范围与 WP 对照（读文件核对，非采信自述）：

- 需求 §1.3「范围内」10 项（三条路径 / 写命令 / 校验器五项 / 技能六条 / 工作流资产 / node_type / 11 原语 / 校验器六项 / 命令六条 / 兼容纯净）经 §1.3.1 映射表全部落到 AC，且 report §2 逐条表机械计数 **65 行全部「通过」**；
- 拆分文档 `docs/iterations/iteration-6.md` §4「AC → WP 满覆盖映射」机械计数 **65 行、未覆盖 AC：无**；8 个 WP（WP-1~WP-8）各自验收口径引用的 AC 全部在 report §2 通过行内，即 8 个 WP 交付项均有通过结论。

## 2. 证据支撑性 — PASS

**抽查 8 条 AC**（AC-11 / AC-40 / AC-48 / AC-49 / AC-59 / AC-61 / AC-63 / AC-65），逐文件核字节数与内容：

| AC | 证据份数 | 抽读内容（原始帧） |
|---|---|---|
| AC-11 | 6 | `validate-text.txt` 为完整 `role validate` 文本输出（5 条专属码逐行）；`payload.json` 为完整 JSON（counts 31/16/10/invalid 5 + errors 六键） |
| AC-40 | 13 | `create.txt` / `dup-no-force.txt` / `force-ok.txt` / `force-invalid.txt` 命令原始输出、`fork.yaml.txt` / `fork-after-force.yaml.txt` 落盘文件帧、`list-payload.json` |
| AC-48 | 26 | `show-researcher.txt` / `show-writer.txt` 与对应 `-baseline` 逐字节对照（可唤醒行 `writer` / `editor, reviewer`，基线为 `—` / `editor`）、六命令 diff 结果（`（无差异）`）、`assets-diff.json`、`output.json` 37KB 原始命令矩阵 |
| AC-49 | 20 | 三链 `*-current.txt` / `*-baseline-tree.txt` 完整终端输出 + `*-diff-*.txt` 归一化 diff 帧（16 字节 = `（无差异）\n`）+ `events.jsonl` / `state.json` |
| AC-59 | 10 | `create-quote.txt`（成功三行）、`create-badgroup.txt` / `create-nosummary.txt` / `create-emptybody.txt` 三种错误原始输出、`show-quote.txt`、`validate-payload.json` |
| AC-61 | 9 | `validate-ok.txt` / `validate-broken.txt`（含逐字变红行 `- 内置 task-loop：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）`）、两份 payload JSON、`git-status-assets.txt` 还原自证 |
| AC-63 | 11 | `dry-run.txt` 完整预演文本（首行 + 11 项原语逐项行 + `结论：编排可执行，未启动任何会话`）、`payload-dry-run.json` / `payload-show-code-loop.json`、`show-code-loop.txt` |
| AC-65 | 8 | `json-run-1-sha256.txt` / `json-run-2-sha256.txt`（两次 JSON 的 sha256，逐字节相同）、`validate-text.txt` 逐行两错误、`payload.json` |

**全量扫描 0 字节**：

```
ls docs/iterations/iteration-6/evidence/ | wc -l  → 547
find docs/iterations/iteration-6/evidence/ -type f -size 0 | wc -l  → 0
```

全部证据为命令输出 / JSON payload / 文件快照等原始帧，无「只有结论」的空壳。

## 3. 判定未被放宽 — PASS

**抽查 6 条 AC 用例源码**（`probe/acc6-cases/`），断言期望值与需求 Then/机检 逐字比对：

- **AC-11**（`ac11.mjs`）：五个专属码集合、`counts.assets===31 / roles===16 / skills===10 / invalid===5`、`errors[]` 六键、退出码 1 —— 与需求 AC-11 机检逐字一致；文件头与 `c.note` 明确披露裁-16a（单字符 id → 2 字符 id `m1/s1/c1/p1/d1`，Then 语义不变）。
- **AC-40**（`ac40.mjs`）：三段 Then（两行输出逐字 / `校验工作流 4 个：全部通过` / `已存在同名…（加 --force 覆盖）` / 创建被拒句式）+ 机检 `grep -c '另一个名字'` 0 → 1 → 文件 sha256 不变 —— 与需求逐字一致（D-3 修复后实测为 1）。
- **AC-59**（`ac59.mjs`）：成功三行、`  命令：node --test`、适用行含两个分组、② 取值原因行逐字 `  （适用分组取值非法：nope；合法取值：coordinator / research / writing / coding / ops）`、③ `  （skill create 需要 --summary）`、④ `创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）`、四个不建文件机检 —— 与需求逐字一致；文件头与 `c.note` 明确披露裁-17（样例值 `writing,review` → 勘误值 `writing,coding`，闭集互斥，Then「含两个分组」语义不变）。
- **AC-61**（`ac61.mjs`）：对齐后 `校验工作流 3 个：全部通过`、改坏后逐字变红行 `  可唤醒` 系出口径、`errors[0]` 四项机检、`finally` 逐字节还原 + `git status --porcelain assets` 为空 —— 与需求逐字一致。
- **AC-63**（`ac63.mjs`）：预演全文逐字（A-10）、11 项原语逐项 lineEq、`nodeCount===6 / edgeCount===7`、四段齐全、`edges[1].kind==='backflow'`、`maxRounds===2`、`汇合：all`（F-19）—— 与需求逐字一致。
- **AC-65**（`ac65.mjs`）：首行 `校验工作流 5 个：2 个不合法`、两条错误逐字、`file:code` 数组逐字、两次 JSON sha256 相同、`counts.assets===5 / invalid===2` —— 与需求逐字一致。

**授权勘误点核查**：AC-06 / AC-11 的 2 字符 id（裁-16a）与 AC-59 的 `writing,coding`（裁-17）均为 decisions.md 正式裁决，用例按裁决值取证且语义未收窄；AC-11 的 `c.note` 有披露（AC-06 用例文件本身未内联裁-16a 注记，披露在 blockers.md D-1 / decisions.md 裁-16a，审计链完整 —— 记为观察项，见文末）。

**未把阻塞写成通过**：`results.jsonl` 193 行逐行 JSON 解析、按 AC 取最新 verdict：

```
总记录行数: 193 | 覆盖 AC: 65 | {"通过":65,"不通过":0,"阻塞":0}
非通过: 无
```

历史记录中的「不通过 / 阻塞」（如 AC-11 五连不通过、AC-59 两连阻塞、AC-44/51/52/57 阻塞）均对应 blockers.md D-1~D-3 与裁-17 登记的真实缺陷/矛盾，修复/裁决后复跑转通过，过程留痕完整；最终一次运行全部为「通过」，无任何阻塞被改写为通过（AC-59 的通过来自裁-17 勘误后按新值复跑，非改写登记）。

## 4. 门禁与回归（实跑）— PASS

**1) 全量测试**（实跑）：

```
node --test --test-concurrency=4 "test/**/*.test.js"
1..769
# tests 769  # pass 769  # fail 0  # cancelled 0  # skipped 0   （duration 15.8s）
```

= report §0 的 769/769，无 perf 越线，未触发模板 §5 约束 22 降噪口径。

**2) D-9 四条纯净扫描**（需求 AC-51 架构检查段命令逐字复制执行）：

```
1) 引擎 31 词（src/core,src/daemon）   → OK: 扫描 16 个文件…零命中   exit=0
2) 注册表 30 词（src/registry）        → OK: 扫描 11 个文件…零命中   exit=0
3) 三族命令逐文件                      → OK: 扫描 3 个文件…零命中    exit=0
4) 零 CJK                              → OK: no CJK                  exit=0
```

**3) 零依赖**（实跑）：`node -e "console.log(Object.keys(require('./package.json').dependencies ?? {}).length)"` → `0`。

**4) 三主链实跑**（root 用 `%TEMP%/maestro-acc-p6/FV-49/<链名>` 新目录，逐次 `rm -rf` 后新建）：

| 链 | 实跑命令 | exit | 终态 |
|---|---|---|---|
| code-loop | `NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root …/FV-49/code-loop --scenario pass` | 0 | 驱动收尾 JSON `state=completed`、两节点 done、handoffs=1 |
| task-loop | `NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root …/FV-49/task-loop2 --scenario doc-pass` | 0 | HO-001/HO-002 交接完成、升级 — |
| single | mock host（`test/fixtures/mock-acp-agent.js --write-ref out/intro.md`）+ `NODE_ENV=test node bin/orch.js run --cwd ./work --task … --host dsh` | 0 | HO-001 已完成、节点已完成 |

实跑数字与 report §0 / §4 对照：769/769 ✓、四扫描 exit 0 ✓、零依赖 0 ✓、三链 exit 0 ✓。

**发现的问题（非阻断）**：report §4 第 5 条 single 复现命令写作 `node bin/orch.js run --cwd … --task "写下说明" --scenario single`，实测 `orch run` 报 `（未知参数：--scenario）`（用法错误退出 2）——该命令按字面**不可执行**。产品与 AC-49 证据本身无问题（AC-49 用例/证据用的是 mock host + `--host dsh` 形态，本终验按该形态实跑 exit 0）；属 report §4 复现命令的文档笔误，建议后续勘误（不影响结论）。

## 5. 缺陷与遗留 — PASS

- `probe/acc6-f-blockers.md`：D-1 / D-2 / D-3 各有现象 + 最小复现命令 + 原始输出 + 修复建议，文末「处置注记（批次 c 追加）」明确三条已分别由 **裁-16a / 裁-16b / 裁-16c** 处置闭合（decisions.md 第十四节逐一对应：D-1 用例改 2 字符 id / D-2 产品修复 commit `7a46149` / D-3 产品修复 commit `7a46149`）；AC-59 三项阻塞由 **裁-17** 收口（勘误值复跑 22/22），原阻塞登记作废、以最新一次运行为准 —— 与 `results.jsonl` 最终态互证一致。
- `report.md` §5 七项（R-8~R-14 需求侧披露、O-1~O-4、R-3）逐项标注「为何不阻断」，均为需求文本层矛盾或无 AC 依赖的实现边界，**不含任何未完成 AC**（65/65 已通过）。
- 全仓 `src/**` 扫描：`grep -rn "TODO\|FIXME\|XXX\|HACK" src/ --include="*.js"` → **0 命中**，无新增悬挂。

## 6. 提交范围与数字一致性 — PASS

`git log --oneline 0cd113b..HEAD` 共 **13** 个 commit，逐个 `git show --name-only` 检查：

```
6215df2 test(I1.6): S3 验收…            evidence/probe 文件数=680  ← S3 专项收验收产物，预期内
7a46149 fix(I1.6): S3 缺陷修复…          =0
baf975e docs(I1.6): S2 进度台账收口      =0
3efe0fa fix(I1.6): S2 实现评审处置…      =0
c5c6340 fix(I1.6): cli-assets AC-45…     =0
9ef28f3 feat(I1.6): WP-8 工作流命令族    =0
92247e3 feat(I1.6): WP-6+WP-7 …          =0
62ecb7b feat(I1.6): WP-3+WP-4 …          =0
ff4dd7d feat(I1.6): WP-1+WP-2 …          =0
b224377 feat(I1.6): WP-5 CLI 三族骨架    =0
1bc86a7 docs(I1.6): S1 拆分定稿          =0
118dde4 docs(I1.6): S0 需求 v7 定稿      =0
8ff9a65 docs(index): 标注阶段一…         =0
```

除预期的 S3 `test(I1.6)` commit 外，**全部 feat / fix / docs commit 均未卷入 `evidence/**` 或 `probe/**`**；HEAD 实测 `git rev-parse --short HEAD` = `6215df2`。

**四处数字一致性核对表**（report.md ↔ summary.json ↔ results.jsonl ↔ 实盘/实跑）：

| 数字 | report.md | summary.json | results.jsonl（最新态） | 实盘/实跑 | 一致 |
|---|---|---|---|---|---|
| AC 通过 65 / 不通过 0 / 阻塞 0 | §0 / §2（65 行全「通过」） | 通过 65 / 0 / 0 | 65 AC 最新 verdict 全「通过」 | — | ✓ |
| 核对项 871 | §0 / §2 注 | checksTotal = 871（perAc checks 逐项求和） | — | — | ✓ |
| 证据 547 | §0 / §1 | evidenceFiles = 547 | — | `ls evidence/ \| wc -l` = 547，0 字节 0 个 | ✓ |
| 全量测试 769/769 | §0 / §4 | — | — | 本人实跑 `# tests 769 # pass 769 # fail 0` | ✓ |

---

## 总判定

**PASS** — 六项校验全过，模板 §4.5 Done 七项中归终验核对的第 1/2/3/4/6 项满足（第 5 项主控复跑、第 7 项 S0 闭环由既有 `review-round1~3.md` / `split-review-round1~2.md` / `impl-review.md` 留痕支撑，不在本次重审范围）。无阻断项。

**非阻断不符点（2 项，留痕不修复）**：

1. `report.md` §4 single 链复现命令 `--scenario single` 按字面不可执行（`orch run` 无该标志，实测报 `未知参数：--scenario`）；有效形态见 AC-49 夹具（mock host + `--host dsh`），本终验已按有效形态实跑 exit 0。属报告文档笔误。
2. `probe/acc6-cases/ac06.mjs` 用例文件内未内联裁-16a 勘误注记（同受影响的 `ac11.mjs` 有 `c.note` 披露）；勘误本身在 blockers.md D-1 与 decisions.md 裁-16a 已完整登记，审计链不断。

## 附：本次终验实跑命令清单

```
node -e "…summary.json 结构统计…"
ls docs/iterations/iteration-6/evidence/ | wc -l
find docs/iterations/iteration-6/evidence/ -type f -size 0 | wc -l
node --test --test-concurrency=4 "test/**/*.test.js"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"          # D-9 #1
node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"                # D-9 #2
node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"   # D-9 #3
node -e "…零 CJK 扫描…"                                                                    # D-9 #4
node -e "console.log(Object.keys(require('./package.json').dependencies ?? {}).length)"
node -e "…results.jsonl 按 AC 取最新 verdict 统计…"
node test/fixtures/code-loop-driver.mjs --root "$TEMP/maestro-acc-p6/FV-49/code-loop" --scenario pass
node test/fixtures/task-loop-driver.mjs --root "$TEMP/maestro-acc-p6/FV-49/task-loop2" --scenario doc-pass
bin/orch.js run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md" --host dsh   # mock host
git log --oneline 0cd113b..HEAD / git show --name-only / git rev-parse --short HEAD
grep -rn "TODO\|FIXME\|XXX\|HACK" src/ --include="*.js"
```

临时目录 `%TEMP%/maestro-acc-p6/FV-49/{code-loop,task-loop2,single}` 按任务纪律不清理。
