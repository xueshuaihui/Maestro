# I1.3 验收记录（真实 DSH 面）

> 依据：`docs/iterations/iteration-3/requirement.md` §3.1 **AC-40**（真实面 / 主流程 / 风险高，规则 BR-06、BR-07、BR-17、BR-18）。
> 范围：I1.3 的 45 条 AC 中，**只有 AC-40 属真实宿主面**；其余 44 条由 `acceptance-fixture.md` 的夹具 / 架构面覆盖，本报告不重复、不改写。
> 执行：2026-11-06，Windows 11 Home China / Git Bash / Node **v22.22.2** / DSH **0.2.2-rc.1**（provider `deepseek-account` → model `deepseek-flash`），真实模型、非 mock。
> 结论来源：真机证据**机检**，不重跑宿主（一次闭环 5 分钟以上，重跑不产生新信息）。机检入口 `node probe/acc3-f-run.mjs AC-40`，逐项核对表同步进 `acceptance-fixture.md` §AC-40。
> 本报告只新增 `docs/iterations/iteration-3/acceptance-product.md`、`probe/acc3-cases/ac40.mjs`；未改 `src/**`、`test/**`、`bin/**`，未改 `evidence/AC-40*` 任何字节，未 `git commit`。

---

## 0. 总判（1 条：通过 1 / 不通过 0 / 阻塞 0）

| AC | 判定 | 一句话结论 |
|---|---|---|
| AC-40 | **通过** | 修复 `150c7c6` 后**首次**真机复验即跑通：第 1 轮 T-003 写 `reject` → HO-003 回流 → T-002 第 2 轮改稿 → T-003 第 2 轮写 `pass` → 实例 `completed`，exit 0、313.586s，零 `review_missing`、零升级 |

- **重试次数：0**（1 次即通过，未触发 AC-40 的「最多重试 3 次」条款）。修复前对照为 3 次尝试、2 次失败。
- **人工干预：无**。未改写 / 未搬运任何 `review.json`，未改仓库源码；修复前第 3 次尝试预先部署的「工作区→任务目录」搬运看护脚本（400ms 轮询）全程未触发一次（日志只有启动行），修复后一次跑通且**没有**部署该脚本。
- **机检结果**：`node probe/acc3-f-run.mjs AC-40` → `通过 40/40`，`probe/acc3-f-parts/AC-40.md` 逐项有实测值。

---

## 1. AC-40 逐条记录

### 1.1 环境与复现命令

| 项 | 值 |
|---|---|
| 操作系统 / Shell | Windows 11 Home China (win32) / Git Bash |
| Node | v22.22.2（仓库根运行 `node bin/orch.js`） |
| DSH 版本 | `0.2.2-rc.1`（`C:\Users\xuesh\AppData\Local\Programs\DeepSeek Harness`；无 `dsh.cmd`，经 Electron 的 node 模式调 asar 内 `bin.js --profile acp`） |
| 模型路由 | 真实账号 `deepseek-account` → `deepseek-flash`（非 mock） |
| DSH_HOME | 隔离目录 `%TEMP%/maestro-acc-p3-ac40b/dsh-home`：`.credentials.yaml` 为 `~/.dsh` 的临时副本，`profiles/acp/cordis.patch.yml` 把 `agent-default-model` 与 acp 路由到 `deepseek-account`；跑完删除，`~/.dsh` 全程只读 |
| 项目根 | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3-ac40b\proj`（`%TEMP%` 下，不在仓库目录，避开 DSH 对仓库路径的 ACL 修复把 turn 拉长） |
| 任务目录 | `<项目根>/demo-doc-real`（全新，只有 `out/` 一个子目录） |
| 实例 / 工作区 | `INST-001` / `<项目根>/.orch/instances/INST-001/workspace` |
| 宿主配置 | `<项目根>/.orch/hosts/dsh.json`（transport `stdio`，`launch.env.DSH_HOME` 指隔离目录；随证据存为 `AC-40b.host.json`） |
| 超时上限 | `limits.promptTimeoutMs=660000`（11 分钟，覆盖 AC-40 的「10 分钟内结束」） |

完整命令（可复制；`--task` 逐字取 AC-40 的 Given 任务文本，含三行）：

```bash
cd "<项目根>"
node D:/WWW/Maestro/bin/orch.js run --cwd ./demo-doc-real --template task-loop \
  --task "写一篇发布说明，面向使用 v1.2 的开发者，必须包含「新功能」「升级步骤」「回滚方案」三节。
第 1 轮先只写「新功能」与「升级步骤」，故意不要写「回滚方案」；审核会驳回，第 2 轮再补上「回滚方案」。
产物：release-notes.md"
```

> 任务书里简写的「写一篇发布说明，覆盖背景、变更与回滚方案。」不含分段写作指令，第 1 轮不会被驳回，构不成 AC-40 要求的「驳回 → 改稿 → 通过」链路；故按需求 Given 原文执行（已在 `AC-40b.meta.json.taskTextNote` 登记）。

### 1.2 逐条核对表（需求 AC-40 的 Given / When / Then / And）

| # | 需求原文 | 实测 | 判定 |
|---|---|---|---|
| 1 | Given 真实 DSH 可用，全新项目根 demo-doc-real | DSH `0.2.2-rc.1`，stdio 拉起；项目根与任务目录均为 `%TEMP%` 下全新目录 | 通过 |
| 2 | And 任务文本为 Given 原文 | `state.task` 与 `AC-40b.meta.json.taskText` 逐字相同，含三节 + 「故意不要写『回滚方案』」+ `产物：release-notes.md` | 通过 |
| 3 | When `orch run --cwd ./demo-doc-real --template task-loop --task …` | 命令原文见 §1.1，`exit=0` | 通过 |
| 4 | Then 命令在 10 分钟内结束，退出码 0 | `DURATION 313.586s (5m14s)`；`EXIT=0` | 通过 |
| 5 | And 输出含「节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 \<d\> · 审核 通过」 | 逐字命中：`节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 2m38s · 审核 通过` | 通过 |
| 6 | And 机检：v1 与 v2 同时存在，v1 的 sha256 与第 1 轮记录一致 | `AC-40b.v1.md` 168 行 / `AC-40b.v2.md` 242 行；v1 sha256 `dbedc0b1…` = `nodes[T-002].artifactHistory[round=1].sha256` | 通过 |
| 7 | And 机检：存在 1 条 `edge.kind='backflow'` 的交接包 | 恰好 1 条：`HO-003  T-003→T-002  kind=backflow  state=consumed` | 通过 |
| 8 | And 机检：该交接包 defects 至少 1 条 | 1 条：「缺少任务要求的『回滚方案』章节，未说明回滚触发条件、操作步骤与验证方式。」 | 通过 |
| 9 | And 机检：缺陷证据可解析 | `artifacts/docs/release-notes.v1.md#L166`：ref 指向 v1，行号 166 落在 v1 的 168 行内 | 通过 |
| 10 | And 机检：没有升级 | `escalations=[]`；`run.output.txt` 末行 `升级 —`，全文无 `升级 ESC-` | 通过 |
| 11 | And 若第 1 轮未驳回，允许最多重试 3 次 | 本次第 1 轮即驳回（`review.read` decision=reject），重试 0 次，条款未触发 | 通过（条款未触发） |

补充机检（本次修复的两个验证点，属缺陷 `D-AC40-1` 的复验项，不是新增断言）：

| # | 核对项 | 实测 | 判定 |
|---|---|---|---|
| 12 | 第 1 轮 `review.read` 为 `reject` | seq 68：`{source:"file", path:"out/review.json", decision:"reject", results:1}` | 通过 |
| 13 | 第 2 轮 `review.read` 为 `pass` | seq 127：`{source:"file", path:"out/review.json", decision:"pass", results:0}` | 通过 |
| 14 | seq 先后：`review.rejected` → 第 2 轮 `node.dispatch(T-002 round=2)` → `review.passed` | `70 < 75 < 128` | 通过 |
| 15 | 零 `review.invalid` / 零 `review_missing` | events 132 条中 `review.invalid` = 0，`detail` 含 `review_missing` = 0（修复前两次尝试均为 `review.invalid + review_missing`） | 通过 |
| 16 | 审核提示词两轮均为**绝对路径** | 两轮均为 `<任务目录>\out\review.json`，`path.win32.isAbsolute` 为真 | 通过 |
| 17 | 该绝对路径解析后 == `<任务目录>/out/review.json` | 两轮归一化后都等于 `…\proj\demo-doc-real\out\review.json` | 通过 |
| 18 | 任务目录有 `out/review.json`，实例工作区**没有** `out/` | 探针终态：任务目录 `PRESENT`，`<工作区>\out\review.json` `ABSENT`；工作区顶层唯一子目录是 `artifacts/` | 通过 |
| 19 | 终态字段 | `state=completed`；`T-001 done r1`、`T-002 done r2`、`T-003 done r2`；`T-002.artifactHistory` 两条（r1/r2）；`T-003.review={decision:"pass",defectCount:0,reviewPath:"out/review.json"}`；`counters.dispatchCount=5` 与 events 的 `node.dispatch` 条数一致 | 通过 |

### 1.3 关键事件序列（`AC-40b.final.events.jsonl`，132 条）

```
seq 2    node.dispatch            T-001 研究员 第 1 轮
seq 25   node.dispatch            T-002 撰写者 第 1 轮
seq 46   review.evidence_verified artifacts/docs/release-notes.v1.md
seq 49   node.dispatch            T-003 审核者 第 1 轮
seq 68   review.read              decision=reject, path=out/review.json, results=1
seq 70   review.rejected          defectCount=1
seq 74   handoff/backflow.constructed   defects=[回滚方案缺失], revisionRequirement=…
seq 75   node.dispatch            T-002 撰写者 第 2 轮（回流后改稿）
seq 95   review.evidence_verified artifacts/docs/release-notes.v2.md
seq 98   node.dispatch            T-003 审核者 第 2 轮（复测）
seq 127  review.read              decision=pass, path=out/review.json, results=0
seq 128  review.passed            defectCount=0
seq 132  instance                 running → completed
```

### 1.4 端到端耗时与逐轮耗时

`AC-40b.run.timing.txt`：`START 13:30:49.991Z` / `END 13:36:03.577Z` / `DURATION 313.586s (5m14s)` / `EXIT=0`。

| 轮次 | 起 | 止 | 秒 | CLI 显示 |
|---|---|---|---:|---|
| T-001 研究员 第 1 轮 | 13:30:50.269 | 13:32:16.273 | 86.0 | 耗时 1m26s |
| T-002 撰写者 第 1 轮 | 13:32:16.335 | 13:33:25.003 | 68.7 | 节点合计 2m29s |
| T-003 审核者 第 1 轮（驳回） | 13:33:25.099 | 13:34:02.563 | 37.5 | 节点合计 2m38s |
| T-002 撰写者 第 2 轮（改稿） | 13:34:02.681 | 13:34:44.892 | 42.2 | 同上 |
| T-003 审核者 第 2 轮（通过） | 13:34:44.959 | 13:36:03.325 | 78.4 | 同上 |

- 五个 turn 净耗时合计 312.8s，与端到端 313.6s 相差 0.8s（交接包投递 / 接受的排队间隙）。**5 个真实模型 turn，0 次重试，0 次人工干预。**
- 全链最慢的一轮是 T-001（86.0s，含 `pwsh`/`glob`/`read` 多次工具调用）；T-002 第 2 轮的改稿只用了 42.2s。
- 第 1 轮撰写者会话出现过一次「会话 等待审批：write」并自动恢复（`AC-40b.run.output.txt:17`），与修复前第 3 次尝试的宿主行为一致，不影响任何断言。

---

## 2. 两次运行对照（修复前 vs 修复后）

| 项 | 修复前（`evidence/AC-40.*`，提交 `150c7c6` 之前） | 修复后（`evidence/AC-40b.*`，`150c7c6` 之后） |
|---|---|---|
| 尝试次数 | **3 次**（同一命令、同一任务原文，各自全新项目根） | **1 次**（首跑即通过） |
| 结果 | attempt1 `suspended` / exit 4，attempt2 `suspended` / exit 4，attempt3 `completed` / exit 0 | `completed` / exit 0 |
| 失败形态 | 前 2 次 `review.invalid`（`reasonCode=review_missing`）→ `escalation` 挂起 | 0 条 `review.invalid`、0 条 `review_missing` |
| 审核文件落点 | 前 2 次模型写给 `workspace/out/review.json`，核心到 `<任务目录>/out/review.json` 读不到；第 3 次模型自发写对 | 两轮都写 `<任务目录>/out/review.json`；实例工作区**从未**出现 `out/` |
| 提示词里的审核路径 | 裸相对路径 `out/review.json`（与上一行「工作区：<绝对路径>」并列，基址歧义） | 绝对路径 `<任务目录>\out\review.json`（两轮一致） |
| 端到端耗时 | 304.4s / 348.5s / 404.2s（合计 1057.1s，其中 652.9s 是两次失败的挂起） | **313.6s** |
| 人工干预 | 无（第 3 次尝试部署的搬运看护脚本全程未触发） | 无（本次未部署任何看护脚本） |
| review 判定链 | attempt3 同样 `reject(seq103) → 回流(seq108) → 改稿(seq110) → pass(seq163)`，但建立在前两次挂起之上 | `reject(seq68) → 回流(seq74) → 改稿(seq75) → pass(seq127)` 一次成型 |

**失败原因（P1，已修）**：缺陷 `D-AC40-1`——审核提示词只给相对路径 `out/review.json`，同一段里又给了「工作区：<绝对路径>」，真实模型按最近的上文拼路径，把 `review.json` 写进实例工作区；而核心按 C-03 / BR-33 只读**任务目录**下的 `out/review.json`（`src/core/review.js:248-249` 的读取根是对的），于是 `review_missing` → 升级挂起 → exit 4。修复前 3 次中 2 次命中，且模型当轮思考原文自己就卡在「相对谁」（见 `evidence/AC-40.blockers.md`）。

**修复（`150c7c6`，`fix(I1.3): 审核提示词给绝对路径，真实宿主不再写错位置`）**：改动 `src/core/advance.js`（+15/−3）、`src/core/orchestrator.js`（+21/−2）、`test/wp4/orchestrator.test.js`（+28）。组装审核提示词时把「审核文件写入路径」改成 `<任务目录>/out/review.json` 绝对路径；**读取根不动**，`review.read` 的 `detail.path` 仍是 `out/review.json`（AC-39 的断言照旧成立）。

**修复后验收口径**：零 `review_missing`、零 `review.invalid`、零升级、零人工搬运，且「任务目录有 / 工作区无」由 1000ms 轮询探针 + 运行结束后的独立终态复核双向确认。

---

## 3. 证据文件清单

主证据 `docs/iterations/iteration-3/evidence/AC-40b.*`（15 个，修复后真机复验）：

| 文件 | 内容 |
|---|---|
| `AC-40b.meta.json` | 环境、命令、任务原文、逐条判定、`pathChecks`、时间线、逐轮耗时、三份 sha256 |
| `AC-40b.final.state.json` | 终态 `state.json` 原文（`completed`，三节点、四张交接包、`review.decision=pass`） |
| `AC-40b.final.events.jsonl` | 132 条事件原文（`review.read`/`review.rejected`/`backflow.constructed`/`review.passed`） |
| `AC-40b.run.output.txt` | `orch run` stdout 全文（含「节点 T-003 … 审核 通过」与末行「升级 —」） |
| `AC-40b.run.timing.txt` | `START` / `END` / `DURATION 313.586s` / `EXIT=0` |
| `AC-40b.status-events.txt` | `orch status --instance INST-001 --events` 可读转录 |
| `AC-40b.prompt.review.txt` | 两轮审核提示词原文（绝对路径的验证点） |
| `AC-40b.workspace-probe.txt` | 1000ms 轮询日志 + 终态复核（任务目录 `PRESENT` / 工作区 `ABSENT`） |
| `AC-40b.review.round1.json` | 第 1 轮审核文件原文（`reject`，1 条 defect） |
| `AC-40b.review.round2.json` | 第 2 轮审核文件原文（`pass`，0 条 defect） |
| `AC-40b.reviewer.round1.excerpt.jsonl` | 第 1 轮审核者会话摘录（含模型写文件调用与思考） |
| `AC-40b.reviewer.round2.excerpt.jsonl` | 第 2 轮审核者会话摘录 |
| `AC-40b.v1.md` | 第 1 轮产物（168 行，sha256 `dbedc0b1…`） |
| `AC-40b.v2.md` | 第 2 轮产物（242 行，含「回滚方案」，sha256 `b9a37fac…`） |
| `AC-40b.host.json` | 宿主配置原文（stdio / `--profile acp` / 隔离 `DSH_HOME`） |

对照证据 `evidence/AC-40.*`（30 个，修复前）：`AC-40.blockers.md`（缺陷 P1 记录与定位）、`AC-40.attempt1.*`（6）、`AC-40.attempt2.*`（6）、`AC-40.{final.state.json,final.events.jsonl,run.output.txt,status.txt,status-events.txt,prompt.review.txt,host.json,meta.json,relocate.log,core.log,research-notes.md,review.round1.json,review.round2.json,reviewer.round1.excerpt.jsonl,reviewer.round2.excerpt.jsonl,v1.md,v2.md}`。只作对照，未参与本次判定，字节未被机检改写。

> `evidence/AC-40.state.json` / `AC-40.events.jsonl` / `AC-40.output.json` 是机检用例自动落盘的占位（用例本身无项目根、无实例，故 state 为 `null`、events 为空）；`AC-40.meta.json` / `AC-40.status.txt` 与修复前对照证据同名，机检时按字节暂存后还原，sha256 不变（`94a6eb7d…` / `b22de512…`）。

---

## 4. 未通过项 / 需登记事项

**无未通过、无阻塞。** 以下为如实登记的口径差异，不构成不通过：

1. **模型路由字段写法不一致**：`AC-40b.meta.json.env.model` 写 `deepseek-flash`，修复前的 `AC-40.meta.json.env.model` 写 `deepseek-v4-flash`（同一 provider `deepseek-account`）。两份 meta 是不同时间手写的环境记录，命名随宿主版本/配置变化；`AC-40b.meta.json` 另在 `notes` 里注明 DSH 实测为 `0.2.2-rc.1`（任务书写的 `0.2.1-rc.5` 已过时）。本报告以修复后的一份为准。
2. **任务书的简写任务文本与需求 Given 不一致**：任务书写「写一篇发布说明，覆盖背景、变更与回滚方案。」，不含分段写作指令，第 1 轮不会被驳回。验收按需求 Given 原文执行，差异登记在 `AC-40b.meta.json.taskTextNote`。
3. **真实宿主出现过一次「等待审批：write」**：第 1 轮撰写者会话触发审批态后自动恢复，宿主侧自然行为，不影响断言；与 I1.2 记录的「写 cwd 内文件不触发审批」不完全一致，记录备查。
4. **`AC-40b.final.state.json` 里有绝对路径**（`cwd`、`sessions[].artifactRef`）：这是真实宿主会话的落盘形状，属既有事实；NFR-08 只约束 `task-loop` 状态文件不保存文档正文与绝对路径（`cwd` 除外），本项属 I1.1/I1.2 既有形态，不在本迭代改动，按 M-3 / D-6 口径登记。

---

## 5. 验收方式与边界

| 项 | 说明 |
|---|---|
| 本次做了什么 | 把已有的真机证据变成**可机检、可重复**的验收用例：`probe/acc3-cases/ac40.mjs`（40 条核对项），只读 `evidence/AC-40b.*`，不启进程、不跑夹具 |
| 复跑方式 | `node probe/acc3-f-run.mjs AC-40` → `通过 40/40`（0.2s）；`node probe/acc3-f-final.mjs` 重建 `acceptance-fixture.md` |
| 证据缺失时 | 该核对项记「阻塞」并写明缺哪个文件（已用临时副本删掉 `AC-40b.final.state.json` 实测：40 项里 18 项转阻塞、22 项仍通过、整体判阻塞），不会编造通过 |
| 未重跑的原因 | 真实宿主单次闭环 5 分钟以上，且修复后已一次通过；重跑不增加信息量，只增加成本与不稳定风险 |
| 未触碰 | `src/**`、`test/**`、`bin/**`、`requirement.md`、`evidence/AC-40*`（含 `AC-40.meta.json` / `AC-40.status.txt`——机检用例与它们同名，已按字节暂存后还原，sha256 不变）、其余 44 条用例文件；未 `git commit` |
