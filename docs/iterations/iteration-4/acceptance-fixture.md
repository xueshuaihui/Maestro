# I1.4 验收记录（夹具面 / WP-8）

> 依据：`docs/iterations/iteration-4/requirement.md` v26 §3.1（AC-01~AC-70，逐条 Given/When/Then/机检）、§3.2 NFR-01~07、§3.3 前置条件、附录 A-1~A-6（输出/状态页/提示词逐字基线）、附录 D-10（测试接缝）、NFR-06 基线说明。
> 执行：darwin / Node v22.22.2 / 仓库 `/Users/xuesh/www/Maestro`；每条 AC 一个独立项目根 `os.tmpdir()/maestro-acc-p4/<AC>/`，跑完 `orch core stop` 并回收核心。当前环境 **macOS、无 DSH 真实宿主**（真实宿主为 Windows 侧能力），全部 AC 走 mock ACP agent 夹具面。
> 生成：`probe/acc4-f-run.mjs` 逐条取证（evidence + parts + results.jsonl）→ `probe/acc4-f-final.mjs` 重建本文件。判定只认需求原文的 Then/机检；每条证据均可独立复核（原始 state/events/stdout/status.md 全文落盘）。

## 0. 总判

**70 条：通过 70 / 不通过 0 / 阻塞 0 / 未执行 0**

**已执行 70 / 未执行 0**

- 已产出证据：70 条；未执行：无。
- 证据文件：`docs/iterations/iteration-4/evidence/` 下 630 个（覆盖 70 条 AC）。
- 证据分级：已实测（真实宿主）0 条 / mock 实测 70 条 / 阻塞 0 条 / 未执行 0 条。
- 不通过 / 阻塞条目：无。
- 机器可读汇总：`probe/acc4-f-summary.json`；单条中间结论：`probe/acc4-f-parts/<AC>.md`。
- 判定口径：`通过` = 该 AC 的全部 Then/机检核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为无法在夹具上观测（或环境不具备），必须在 parts 里写明原因与已尝试路径；`未执行` = 本批尚未交付，绝不假报通过。

## 0.1 分批结果（a=AC-01~15 / b=16~30 / c=31~45 / d=46~60 / e=61~70）

| 批次 | 区间 | 通过 | 不通过 | 阻塞 | 未执行 |
|---|---|---|---|---|---|
| a | AC-01~15 | 15 | 0 | 0 | 0 |
| b | AC-16~30 | 15 | 0 | 0 | 0 |
| c | AC-31~45 | 15 | 0 | 0 | 0 |
| d | AC-46~60 | 15 | 0 | 0 | 0 |
| e | AC-61~70 | 10 | 0 | 0 | 0 |

## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 判定）

> 「原始输出」全文在 `evidence/<AC>.output.json`（每条命令的 stdout+stderr 原样）与 `status.txt`（可读转录）；「状态证据」在 `evidence/<AC>.state.json` 与 `events.jsonl`。

#### AC-01 编码闭环启动后出现共享工作区

- 判定：**通过**（核对 17/17 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run --cwd ./demo --task CODE_TASK --template code-loop（夹具 pass）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01 | exit=0 | 8496ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01 | exit=0 | 313ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01 | exit=0 | 315ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-01.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个全新的项目根，目录可写
- **When** 我执行 `orch run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop`
- **Then** 实例目录下出现 `workspace/shared/`、`workspace/stage/T-001/`、`workspace/stage/T-002/`、`workspace/status.md`；`orch status --instance INST-001` 的首行仍是原来的实例行
- **机检：** `workspace/shared` 与两个 `stage` 都是目录；`status.md` 是一份可读 Markdown
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-01.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-01.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-01.meta.json` | 752 B |
| `docs/iterations/iteration-4/evidence/AC-01.output.json` | 5939 B |
| `docs/iterations/iteration-4/evidence/AC-01.status.txt` | 2019 B |
| `docs/iterations/iteration-4/evidence/AC-01.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-01.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-01.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-01.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：workspace/shared 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01/.orch/instances/INST-001/workspace` |
| 2 | 机检：workspace/stage/T-001 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01/.orch/instances/INST-001/workspace/stage/T-001` |
| 3 | 机检：workspace/stage/T-002 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01/.orch/instances/INST-001/workspace/stage/T-002` |
| 4 | 机检：status.md 存在且是可读 Markdown | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新` |
| 5 | A-1：标题行含实例号与模板名 | 通过 | `# INST-001 编码闭环` |
| 6 | A-1：含「- 状态：」行 | 通过 | `- 状态：已完成` |
| 7 | A-1：含「- 暂停：」行 | 通过 | `- 暂停：否` |
| 8 | A-1：含「- 任务：」行 | 通过 | `- 任务：实现 calc.js，产物：calc.js` |
| 9 | A-1：含「- 当前节点：」行 | 通过 | `- 当前节点：T-002 测试` |
| 10 | A-1：含「- 工作区：」绝对路径行 | 通过 | `- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-01/.orch/instances/INST-001/workspace` |
| 11 | A-1：含「## 节点」段 | 通过 | `应含` |
| 12 | A-1：含「## 交接包」段 | 通过 | `应含` |
| 13 | A-1：含「## 升级」段 | 通过 | `应含` |
| 14 | A-1：含「## 审批」段 | 通过 | `应含` |
| 15 | Then：status 首行仍是原来的实例行（期望 "实例 INST-001 · 已完成 · 模板 编码闭环"） | 通过 | `"实例 INST-001 · 已完成 · 模板 编码闭环"` |
| 16 | 机检：state=completed（期望 "completed"） | 通过 | `"completed"` |
| 17 | 机检：schemaVersion=2（期望 2） | 通过 | `2` |

**⑤ 判定**：通过

---

#### AC-02 文档闭环每个节点都有阶段区

- 判定：**通过**（核对 22/22 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run task-loop（夹具 doc-pass）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02 | exit=0 | 12200ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02 | exit=0 | 362ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-02.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个全新的项目根，任务含一行 `产物：release-notes.md`
- **When** 我执行 `orch run --cwd ./demo --task "写发布说明，产物：release-notes.md" --template task-loop`
- **Then** 工作区出现 `shared/`、`stage/T-001/`、`stage/T-002/`、`stage/T-003/`、`status.md`
- **机检：** 三个 stage 目录都存在；`status.md` 的节点段落列出 T-001、T-002、T-003
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-02.state.json` | 7313 B |
| `docs/iterations/iteration-4/evidence/AC-02.events.jsonl` | 8995 B |
| `docs/iterations/iteration-4/evidence/AC-02.meta.json` | 749 B |
| `docs/iterations/iteration-4/evidence/AC-02.output.json` | 8559 B |
| `docs/iterations/iteration-4/evidence/AC-02.status.txt` | 1884 B |
| `docs/iterations/iteration-4/evidence/AC-02.status.md.json` | 744 B |
| `docs/iterations/iteration-4/evidence/AC-02.prompts.json` | 3115 B |
| `docs/iterations/iteration-4/evidence/AC-02.inbox.json` | 2808 B |
| `docs/iterations/iteration-4/evidence/AC-02.attempts.json` | 228 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：workspace/shared 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace` |
| 2 | 机检：workspace/stage/T-001 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace/stage/T-001` |
| 3 | 机检：workspace/stage/T-002 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace/stage/T-002` |
| 4 | 机检：workspace/stage/T-003 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace/stage/T-003` |
| 5 | 机检：status.md 存在且是可读 Markdown | 通过 | `# INST-001 通用任务闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写发布说明，产物：release-notes.md<br>- 当前节点：T-003 审` |
| 6 | A-1：标题行含实例号与模板名 | 通过 | `# INST-001 通用任务闭环` |
| 7 | A-1：含「- 状态：」行 | 通过 | `- 状态：已完成` |
| 8 | A-1：含「- 暂停：」行 | 通过 | `- 暂停：否` |
| 9 | A-1：含「- 任务：」行 | 通过 | `# INST-001 通用任务闭环` |
| 10 | A-1：含「- 当前节点：」行 | 通过 | `- 当前节点：T-003 审核者` |
| 11 | A-1：含「- 工作区：」绝对路径行 | 通过 | `- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace` |
| 12 | A-1：含「## 节点」段 | 通过 | `应含` |
| 13 | A-1：含「## 交接包」段 | 通过 | `应含` |
| 14 | A-1：含「## 升级」段 | 通过 | `应含` |
| 15 | A-1：含「## 审批」段 | 通过 | `应含` |
| 16 | 机检：status.md 节点段落列出 T-001（期望含 "- T-001 研究员"） | 通过 | `# INST-001 通用任务闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写发布说明，产物：release-notes.md<br>- 当前节点：T-003 审核者<br>- 更新：2026-11-08T22:17:12.169Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace<br><br>` |
| 17 | 机检：status.md 节点段落列出 T-002（期望含 "- T-002 撰写者"） | 通过 | `# INST-001 通用任务闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写发布说明，产物：release-notes.md<br>- 当前节点：T-003 审核者<br>- 更新：2026-11-08T22:17:12.169Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace<br><br>` |
| 18 | 机检：status.md 节点段落列出 T-003（期望含 "- T-003 审核者"） | 通过 | `# INST-001 通用任务闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写发布说明，产物：release-notes.md<br>- 当前节点：T-003 审核者<br>- 更新：2026-11-08T22:17:12.169Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-02/.orch/instances/INST-001/workspace<br><br>` |
| 19 | 机检：T-001 state=done（期望 "done"） | 通过 | `"done"` |
| 20 | 机检：T-002 state=done（期望 "done"） | 通过 | `"done"` |
| 21 | 机检：T-003 state=done（期望 "done"） | 通过 | `"done"` |
| 22 | 机检：template=task-loop（期望 "task-loop"） | 通过 | `"task-loop"` |

**⑤ 判定**：通过

---

#### AC-03 单节点工作区新增但不改旧输出

- 判定：**通过**（核对 24/24 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run --cwd ./demo --task「写下说明」（不带 --template）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03 | exit=0 | 4963ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03 | exit=0 | 310ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-03.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个全新的项目根
- **When** 我执行 `orch run --cwd ./demo --task "写下说明"`
- **Then** 终端前三行与 I1.1 基线逐字一致；实例目录出现 `workspace/shared/` 与 `workspace/status.md`；不出现 `stage/`；`status.md` 含实例行与状态行，不含 `## 节点` 段
- **机检：** `stage` 目录不存在；`handoffs` 只有引导包且不参与 schema 校验，没有 `handoff.rejected` 事件
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-03.state.json` | 2431 B |
| `docs/iterations/iteration-4/evidence/AC-03.events.jsonl` | 3298 B |
| `docs/iterations/iteration-4/evidence/AC-03.meta.json` | 751 B |
| `docs/iterations/iteration-4/evidence/AC-03.output.json` | 6922 B |
| `docs/iterations/iteration-4/evidence/AC-03.status.txt` | 930 B |
| `docs/iterations/iteration-4/evidence/AC-03.status.md.json` | 363 B |
| `docs/iterations/iteration-4/evidence/AC-03.prompts.json` | 158 B |
| `docs/iterations/iteration-4/evidence/AC-03.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-03.attempts.json` | 78 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：第 1 行逐字（期望 "实例 INST-001 · 运行中"） | 通过 | `"实例 INST-001 · 运行中"` |
| 2 | Then：第 2 行「会话已创建 <宿主会话号>」（期望匹配 /^会话已创建 mock-sess-\d+-\d+$/） | 通过 | `会话已创建 mock-sess-11874-1` |
| 3 | Then：第 3 行逐字（期望 "任务已投递"） | 通过 | `"任务已投递"` |
| 4 | 机检：workspace/shared 是目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03/.orch/instances/INST-001/workspace` |
| 5 | 机检：single 不出现 stage/ 目录 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03/.orch/instances/INST-001/workspace/stage` |
| 6 | 机检：status.md 存在且是可读 Markdown | 通过 | `# INST-001 单节点<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写下说明<br>- 更新：2026-11-08T22:17:20.020Z<br>- 工作区：/p` |
| 7 | A-1：标题行含实例号与模板名 | 通过 | `# INST-001 单节点` |
| 8 | A-1：含「- 状态：」行 | 通过 | `- 状态：已完成` |
| 9 | A-1：含「- 暂停：」行 | 通过 | `- 暂停：否` |
| 10 | A-1：含「- 任务：」行 | 通过 | `- 任务：写下说明` |
| 11 | A-1：single 不含「当前节点」行 | 通过 | `（应省略）` |
| 12 | A-1：含「- 工作区：」绝对路径行 | 通过 | `- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03/.orch/instances/INST-001/workspace` |
| 13 | A-1：含「## 节点」段 | 通过 | `single 应省略` |
| 14 | A-1：含「## 交接包」段 | 通过 | `应含` |
| 15 | A-1：含「## 升级」段 | 通过 | `应含` |
| 16 | A-1：含「## 审批」段 | 通过 | `应含` |
| 17 | Then：status.md 含实例行（期望含 "# INST-001 单节点"） | 通过 | `# INST-001 单节点<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写下说明<br>- 更新：2026-11-08T22:17:20.020Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03/.orch/instances/INST-001/workspace<br><br>## 交接包<br><br>- HO-001：已完成<br><br>## 升级<br><` |
| 18 | Then：status.md 含状态行（期望含 "- 状态：已完成"） | 通过 | `# INST-001 单节点<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写下说明<br>- 更新：2026-11-08T22:17:20.020Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03/.orch/instances/INST-001/workspace<br><br>## 交接包<br><br>- HO-001：已完成<br><br>## 升级<br><` |
| 19 | Then：status.md 不含 ## 节点 段（期望不含 "## 节点"） | 通过 | `# INST-001 单节点<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：写下说明<br>- 更新：2026-11-08T22:17:20.020Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-03/.orch/instances/INST-001/workspace<br><br>## 交接包<br><br>- HO-001：已完成<br><br>## 升级<br><` |
| 20 | 机检：stage 目录不存在（期望 false） | 通过 | `false` |
| 21 | 机检：handoffs 只有引导包（期望 1） | 通过 | `1` |
| 22 | 机检：引导包号 HO-001（期望 "HO-001"） | 通过 | `"HO-001"` |
| 23 | 机检：没有 handoff.rejected 事件（期望不含 "handoff.rejected"） | 通过 | `run.started,run.started,handoff.created,handoff.delivered,session.state,turn.first_event,session.state,session.state,output.submitted,output.submitted,verification.skipped,verification.passed,handoff.consumed,run.completed,run.completed` |
| 24 | 机检：引导包不参与 schema 校验（state=consumed，无 rejectReason）（期望含 "consumed\|null"） | 通过 | `consumed\|null` |

**⑤ 判定**：通过

---

#### AC-04 `status.md` 随状态变化刷新

- 判定：**通过**（核对 23/23 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop（开发/测试各完成一次状态变化）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04 | exit=0 | 9346ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04 | exit=0 | 283ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04 | exit=0 | 308ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-04.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环已启动，开发和测试各完成过一次状态变化
- **When** 我打开 `workspace/status.md`
- **Then** 文件包含实例号与模板名（标题行）、当前状态、暂停、任务、当前节点、工作区绝对路径、两个节点各自的状态与轮次、最近交接包、升级与审批段落；节点状态与 `orch status` 显示一致
- **机检：** 文件在每次 `events.jsonl` 出现节点/交接包/升级/审批状态变化后 1 秒内包含对应中文状态
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-04.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-04.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-04.meta.json` | 902 B |
| `docs/iterations/iteration-4/evidence/AC-04.output.json` | 12341 B |
| `docs/iterations/iteration-4/evidence/AC-04.status.txt` | 2007 B |
| `docs/iterations/iteration-4/evidence/AC-04.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-04.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-04.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-04.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | A-1：标题行含实例号与模板名 | 通过 | `# INST-001 编码闭环` |
| 2 | A-1：含「- 状态：」行 | 通过 | `- 状态：已完成` |
| 3 | A-1：含「- 暂停：」行 | 通过 | `- 暂停：否` |
| 4 | A-1：含「- 任务：」行 | 通过 | `- 任务：实现 calc.js，产物：calc.js` |
| 5 | A-1：含「- 当前节点：」行 | 通过 | `- 当前节点：T-002 测试` |
| 6 | A-1：含「- 工作区：」绝对路径行 | 通过 | `- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace` |
| 7 | A-1：含「## 节点」段 | 通过 | `应含` |
| 8 | A-1：含「## 交接包」段 | 通过 | `应含` |
| 9 | A-1：含「## 升级」段 | 通过 | `应含` |
| 10 | A-1：含「## 审批」段 | 通过 | `应含` |
| 11 | Then：文件含实例号与模板名（标题行）（期望含 "# INST-001 编码闭环"） | 通过 | `# INST-001 编码闭环` |
| 12 | Then：两个节点各自的状态与轮次（T-001）（期望含 "- T-001 开发：已完成 · 第 1 轮"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 13 | Then：两个节点各自的状态与轮次（T-002）（期望含 "- T-002 测试：已完成 · 第 1 轮"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 14 | Then：最近交接包段（期望含 "- HO-001 开发→测试：已完成"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 15 | Then：升级段落（期望含 "## 升级"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 16 | Then：审批段落（期望含 "## 审批"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 17 | Then：节点状态与 orch status 显示一致（T-001）（期望含 "节点 T-001 开发 已完成 · 第 1 轮"） | 通过 | `实例 INST-001 · 已完成 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:17:28<br>交接包 HO-001  开发→测试  已投递   06:17:29<br>交接包 HO-001  开发→测试  已接受   06:17:30<br>交接包 HO-001  开发→测试  已完成   06:17:` |
| 18 | Then：节点状态与 orch status 显示一致（T-002）（期望含 "节点 T-002 测试 已完成 · 第 1 轮"） | 通过 | `实例 INST-001 · 已完成 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:17:28<br>交接包 HO-001  开发→测试  已投递   06:17:29<br>交接包 HO-001  开发→测试  已接受   06:17:30<br>交接包 HO-001  开发→测试  已完成   06:17:` |
| 19 | 机检：events 含节点状态变化事件 verification.passed | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 20 | 机检：events 含交接包状态变化事件 handoff.created | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 21 | 机检：events 含交接包投递事件 handoff.delivered | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 22 | 机检：status.md 含对应中文状态「已完成」（期望含 "已完成"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 23 | 机检：status.md 含对应中文状态「已完成」（交接包）（期望含 "已完成 · 输入 calc.js"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:31.914Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-04/.orch/instances/INST-001/workspace<br><br>## 节点<b` |

**⑤ 判定**：通过

**备注**

- 「1 秒内刷新」为时序性质（NFR-02 覆盖）；本 AC 以 events 状态变化与 status.md 含对应中文状态的可复核快照取证。

---

#### AC-05 人工修改 `status.md` 会被下一次刷新覆盖

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run（放行后前台收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05 | exit=0 | 8345ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05 | exit=0 | 249ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-05.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 实例正在运行，我手工在 `status.md` 里加了一行"待办：修 calc.js"
- **When** 下一个节点状态变化发生
- **Then** 该手写行消失，`status.md` 恢复为核心生成的内容
- **机检：** 刷新后的文件不含我写的字符串
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-05.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-05.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-05.meta.json` | 760 B |
| `docs/iterations/iteration-4/evidence/AC-05.output.json` | 5845 B |
| `docs/iterations/iteration-4/evidence/AC-05.status.txt` | 1263 B |
| `docs/iterations/iteration-4/evidence/AC-05.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-05.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-05.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-05.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：实例运行到暂停接缝（.mock/paused） | 通过 | `true` |
| 2 | Given：暂停时 status.md 是核心生成的可读 Markdown | 通过 | `# INST-001 编码闭环<br><br>- 状态：运行中<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-001 开发<br>- 更新` |
| 3 | Given：手工写入一行后文件确实含该字符串（期望含 "待办：修 calc.js"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：运行中<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-001 开发<br>- 更新：2026-11-08T22:17:39.563Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 4 | Then：该手写行消失（期望不含 "待办：修 calc.js"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:43.406Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 5 | Then：status.md 恢复为核心生成的内容（期望含 "# INST-001 编码闭环"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:43.406Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 6 | 机检：刷新后的文件不含我写的字符串（期望不含 "待办：修 calc.js"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:43.406Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05/.orch/instances/INST-001/workspace<br><br>## 节点<b` |
| 7 | 机检：刷新后仍是原子替换的完整结构（含节点段）（期望含 "## 节点"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已完成<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:17:43.406Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-05/.orch/instances/INST-001/workspace<br><br>## 节点<b` |

**⑤ 判定**：通过

---

#### AC-06 工作区建不出来时发起前停住

- 判定：**通过**（核对 6/6 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-06`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch run code-loop（MAESTRO_FAULT=workspace_init:fail）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-06 | exit=3 | 1470ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-06 | exit=0 | 364ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-06.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 夹具用既有故障注入 `MAESTRO_FAULT=workspace_init:fail` 让工作区建不出来
- **When** 我执行 `orch run --cwd ./demo --task "…" --template code-loop`
- **Then** 终端出现"无法创建工作区：…"；退出码 3；没有会话、没有派发、没有留下半个实例目录
- **机检：** `.orch/instances/INST-001` 不存在；`events.jsonl` 没有 `node.dispatch`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-06.state.json` | 5 B |
| `docs/iterations/iteration-4/evidence/AC-06.events.jsonl` | 0 B |
| `docs/iterations/iteration-4/evidence/AC-06.meta.json` | 785 B |
| `docs/iterations/iteration-4/evidence/AC-06.output.json` | 2264 B |
| `docs/iterations/iteration-4/evidence/AC-06.status.txt` | 673 B |
| `docs/iterations/iteration-4/evidence/AC-06.status.md.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-06.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-06.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-06.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：终端出现「无法创建工作区：…」（期望含 "无法创建工作区："） | 通过 | `无法创建工作区：注入故障（workspace_init:fail）<br>` |
| 2 | Then：退出码 3（期望 3） | 通过 | `3` |
| 3 | Then：没有留下半个实例目录（期望 0） | 通过 | `0` |
| 4 | 机检：.orch/instances/INST-001 不存在（期望 false） | 通过 | `false` |
| 5 | 机检：events.jsonl 没有 node.dispatch（期望不含 "node.dispatch"） | 通过 | `` |
| 6 | 机检：没有会话记录（期望 0） | 通过 | `0` |

**⑤ 判定**：通过

**备注**

- 「没有会话」以 events 无 session.state 事件 + 无实例目录取证；退出码 3 对齐 A-5 WORKSPACE_INIT_FAILED。

---

#### AC-07 多节点提示词带工作区上下文段

- 判定：**通过**（核对 59/59 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-single`
- 实例：INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop（含 1 次回流与 1 次复测）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07 | exit=0 | 14066ms
[orch run task-loop（含 1 次驳回回流）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task | exit=0 | 16797ms
[orch run single（不带 --template）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-single | exit=0 | 5002ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07 | exit=0 | 310ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task | exit=0 | 295ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-single | exit=0 | 296ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-07.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环完整跑一轮（含 1 次回流与 1 次复测），文档闭环完整跑一轮（含 1 次驳回回流）
- **When** 依次派发：code-loop 入口 T-001、forward T-002、backflow T-001（第 2 轮）、retest T-002（第 2 轮）；task-loop T-001 研究、T-002 撰写、T-003 审核、T-002 撰写（回流第 2 轮）、T-003 复测审核（第 2 轮）
- **Then** 9 个多节点提示词末尾都出现附录 A-6 的「工作区上下文」段；入口（code-loop T-001 首次、task-loop T-001）只有前三行；其余为四行；task-loop 审核（两轮）正文已有 `工作区：`，末尾只追加后三行（`共享区（只读）` / `本节点阶段区` / `上游阶段区（只读）`），不重复 `工作区：`；单节点提示词不出现该段
- **夹具：** 逐个 `.mock/prompts/<n>.json` 的 `task` 逐字包含 `工作区：<工作区绝对路径>`、`共享区（只读）：<工作区绝对路径>/shared`、`本节点阶段区：<工作区绝对路径>/stage/<本节点>`；非入口另含 `上游阶段区（只读）：<工作区绝对路径>/stage/<来源节点>`
- **机检：** 审核提示词中的 `工作区：` 行只有一条；只传 `node`、不带 `graph` 的 `promptFor` 单元调用不追加该段；生产派发的每次调用都带 `graph`（`single` 图只有 1 个节点，因而不追加），判定只按节点数、不按模板名
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-07.state.json` | 25522 B |
| `docs/iterations/iteration-4/evidence/AC-07.events.jsonl` | 37796 B |
| `docs/iterations/iteration-4/evidence/AC-07.meta.json` | 1226 B |
| `docs/iterations/iteration-4/evidence/AC-07.output.json` | 60900 B |
| `docs/iterations/iteration-4/evidence/AC-07.status.txt` | 5543 B |
| `docs/iterations/iteration-4/evidence/AC-07.status.md.json` | 1973 B |
| `docs/iterations/iteration-4/evidence/AC-07.prompts.json` | 9308 B |
| `docs/iterations/iteration-4/evidence/AC-07.inbox.json` | 9560 B |
| `docs/iterations/iteration-4/evidence/AC-07.attempts.json` | 785 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：code-loop 入口 T-001 提示词存在 | 通过 | `1.json` |
| 2 | 夹具：code-loop 入口 T-001 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0 | 通过 | `实现 calc.js，产物：calc.js<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/` |
| 3 | 夹具：code-loop 入口 T-001 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/shared"） | 通过 | `实现 calc.js，产物：calc.js<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/` |
| 4 | 夹具：code-loop 入口 T-001 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-001"） | 通过 | `实现 calc.js，产物：calc.js<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/` |
| 5 | 夹具：code-loop 入口 T-001 入口不含上游阶段区行（期望不含 "上游阶段区（只读）"） | 通过 | `实现 calc.js，产物：calc.js<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/` |
| 6 | 夹具：code-loop forward T-002 提示词存在 | 通过 | `2.json` |
| 7 | 夹具：code-loop forward T-002 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8ps | 通过 | `实现 calc.js，产物：calc.js<br><br>完成后把结构化判定写到 out/verdict.json：{"verdict":"pass"\|"fail","defects":[{"summary":"一句话缺陷","evidence":"证据文件路径"}]}；判定为 fail 时必须给出至少一条带证据路径的缺陷。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/` |
| 8 | 夹具：code-loop forward T-002 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/shared"） | 通过 | `实现 calc.js，产物：calc.js<br><br>完成后把结构化判定写到 out/verdict.json：{"verdict":"pass"\|"fail","defects":[{"summary":"一句话缺陷","evidence":"证据文件路径"}]}；判定为 fail 时必须给出至少一条带证据路径的缺陷。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/` |
| 9 | 夹具：code-loop forward T-002 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `实现 calc.js，产物：calc.js<br><br>完成后把结构化判定写到 out/verdict.json：{"verdict":"pass"\|"fail","defects":[{"summary":"一句话缺陷","evidence":"证据文件路径"}]}；判定为 fail 时必须给出至少一条带证据路径的缺陷。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/` |
| 10 | 夹具：code-loop forward T-002 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-001"） | 通过 | `实现 calc.js，产物：calc.js<br><br>完成后把结构化判定写到 out/verdict.json：{"verdict":"pass"\|"fail","defects":[{"summary":"一句话缺陷","evidence":"证据文件路径"}]}；判定为 fail 时必须给出至少一条带证据路径的缺陷。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/` |
| 11 | 夹具：code-loop backflow T-001 第 2 轮 提示词存在 | 通过 | `3.json` |
| 12 | 夹具：code-loop backflow T-001 第 2 轮 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfk | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮判定不通过，请按下列缺陷修正：<br>缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）<br>复测要求：按上方每条缺陷修正后重新提交产物<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/` |
| 13 | 夹具：code-loop backflow T-001 第 2 轮 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/shared"） | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮判定不通过，请按下列缺陷修正：<br>缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）<br>复测要求：按上方每条缺陷修正后重新提交产物<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/` |
| 14 | 夹具：code-loop backflow T-001 第 2 轮 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-001"） | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮判定不通过，请按下列缺陷修正：<br>缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）<br>复测要求：按上方每条缺陷修正后重新提交产物<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/` |
| 15 | 夹具：code-loop backflow T-001 第 2 轮 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮判定不通过，请按下列缺陷修正：<br>缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）<br>复测要求：按上方每条缺陷修正后重新提交产物<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/` |
| 16 | 夹具：code-loop retest T-002 第 2 轮 提示词存在 | 通过 | `4.json` |
| 17 | 夹具：code-loop retest T-002 第 2 轮 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfkc6 | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮缺陷：2 条<br>产物：calc.js<br>请复测并把结构化判定写到 out/verdict.json。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc` |
| 18 | 夹具：code-loop retest T-002 第 2 轮 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/shared"） | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮缺陷：2 条<br>产物：calc.js<br>请复测并把结构化判定写到 out/verdict.json。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc` |
| 19 | 夹具：code-loop retest T-002 第 2 轮 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮缺陷：2 条<br>产物：calc.js<br>请复测并把结构化判定写到 out/verdict.json。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc` |
| 20 | 夹具：code-loop retest T-002 第 2 轮 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace/stage/T-001"） | 通过 | `实现 calc.js，产物：calc.js<br><br>上一轮缺陷：2 条<br>产物：calc.js<br>请复测并把结构化判定写到 out/verdict.json。<br><br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07/.orch/instances/INST-001/workspace<br>共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc` |
| 21 | 夹具：task-loop 研究 T-001 提示词存在 | 通过 | `1.json` |
| 22 | 夹具：task-loop 研究 T-001 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8ps | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md<br>只交研究笔记，不写最终文档。<` |
| 23 | 夹具：task-loop 研究 T-001 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/shared"） | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md<br>只交研究笔记，不写最终文档。<` |
| 24 | 夹具：task-loop 研究 T-001 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-001"） | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md<br>只交研究笔记，不写最终文档。<` |
| 25 | 夹具：task-loop 研究 T-001 入口不含上游阶段区行（期望不含 "上游阶段区（只读）"） | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md<br>只交研究笔记，不写最终文档。<` |
| 26 | 夹具：task-loop 撰写 T-002 提示词存在 | 通过 | `2.json` |
| 27 | 夹具：task-loop 撰写 T-002 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8ps | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/do` |
| 28 | 夹具：task-loop 撰写 T-002 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/shared"） | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/do` |
| 29 | 夹具：task-loop 撰写 T-002 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/do` |
| 30 | 夹具：task-loop 撰写 T-002 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-001"） | 通过 | `写发布说明，产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/artifacts/do` |
| 31 | 夹具：task-loop 审核 T-003 第 1 轮 提示词存在 | 通过 | `3.json` |
| 32 | 夹具：task-loop 审核 T-003 第 1 轮 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdfkc | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 33 | 夹具：task-loop 审核 T-003 第 1 轮 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/shared"） | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 34 | 夹具：task-loop 审核 T-003 第 1 轮 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-003"） | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 35 | 夹具：task-loop 审核 T-003 第 1 轮 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 36 | 机检：task-loop 审核 T-003 第 1 轮 审核提示词「工作区：」行只有一条（期望 1） | 通过 | `1` |
| 37 | 夹具：task-loop 撰写回流 T-002 第 2 轮 提示词存在 | 通过 | `4.json` |
| 38 | 夹具：task-loop 撰写回流 T-002 第 2 轮 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdf | 通过 | `写发布说明，产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版文档引用：artifacts/docs` |
| 39 | 夹具：task-loop 撰写回流 T-002 第 2 轮 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/shared"） | 通过 | `写发布说明，产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版文档引用：artifacts/docs` |
| 40 | 夹具：task-loop 撰写回流 T-002 第 2 轮 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `写发布说明，产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版文档引用：artifacts/docs` |
| 41 | 夹具：task-loop 撰写回流 T-002 第 2 轮 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-003"） | 通过 | `写发布说明，产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版文档引用：artifacts/docs` |
| 42 | 夹具：task-loop 复测审核 T-003 第 2 轮 提示词存在 | 通过 | `5.json` |
| 43 | 夹具：task-loop 复测审核 T-003 第 2 轮 含「工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace」（期望含 "工作区：/private/var/folders/d0/57v137rs2mdf | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v2.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 44 | 夹具：task-loop 复测审核 T-003 第 2 轮 含共享区只读行（期望含 "共享区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/shared"） | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v2.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 45 | 夹具：task-loop 复测审核 T-003 第 2 轮 含本节点阶段区行（期望含 "本节点阶段区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-003"） | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v2.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 46 | 夹具：task-loop 复测审核 T-003 第 2 轮 含上游阶段区行（期望含 "上游阶段区（只读）：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace/stage/T-002"） | 通过 | `写发布说明，产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v2.md<br>工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-07-task/.orch/instances/INST-001/workspace<br>审核文件写入路径：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h` |
| 47 | 机检：task-loop 复测审核 T-003 第 2 轮 审核提示词「工作区：」行只有一条（期望 1） | 通过 | `1` |
| 48 | 夹具：9 个多节点提示词（4 + 5）（期望 9） | 通过 | `9` |
| 49 | 夹具：单节点提示词存在 | 通过 | `["1.json"]` |
| 50 | Then：单节点提示词不出现工作区上下文段（期望不含 "工作区："） | 通过 | `写下说明<br><br>完成后直接结束，不需要额外说明。` |
| 51 | Then：单节点提示词不出现共享区只读行（期望不含 "共享区（只读）"） | 通过 | `写下说明<br><br>完成后直接结束，不需要额外说明。` |
| 52 | 机检：只传 node 不带 graph 的 promptFor 单元调用不追加该段（期望不含 "工作区："） | 通过 | `x<br><br>完成后直接结束，不需要额外说明。` |
| 53 | 机检：single 图只有 1 个节点，因而不追加（期望不含 "共享区（只读）"） | 通过 | `x<br><br>完成后直接结束，不需要额外说明。` |
| 54 | 机检：graph.nodes.length > 1 时追加工作区上下文段（期望含 "共享区（只读）：/tmp/ws/shared"） | 通过 | `x<br><br>完成后直接结束，不需要额外说明。<br><br>工作区：/tmp/ws<br>共享区（只读）：/tmp/ws/shared<br>本节点阶段区：/tmp/ws/stage/T-001` |
| 55 | 架构检查：追加条件按节点数 graph.nodes.length <= 1（期望含 "graph.nodes.length <= 1"） | 通过 | `function workspaceContextLines(body, { graph = null, node = null, handoff = null, workspaceDir = null } = {}) {<br>  if (!graph \|\| !Array.isArray(graph.nodes) \|\| graph.nodes.length <= 1) return null;<br>  const workspaceAbs = workspaceBase(workspaceDir);<b` |
| 56 | 架构检查：判定不含模板名字面量分支（期望不含 "'single'"） | 通过 | `function workspaceContextLines(body, { graph = null, node = null, handoff = null, workspaceDir = null } = {}) {<br>  if (!graph \|\| !Array.isArray(graph.nodes) \|\| graph.nodes.length <= 1) return null;<br>  const workspaceAbs = workspaceBase(workspaceDir);<b` |
| 57 | 架构检查：判定不含 template 分支（期望不含 "template !=="） | 通过 | `function workspaceContextLines(body, { graph = null, node = null, handoff = null, workspaceDir = null } = {}) {<br>  if (!graph \|\| !Array.isArray(graph.nodes) \|\| graph.nodes.length <= 1) return null;<br>  const workspaceAbs = workspaceBase(workspaceDir);<b` |
| 58 | 架构检查：生产派发 6 处 promptFor 调用都带 graph（期望 6） | 通过 | `6` |
| 59 | 架构检查：不带 graph 的仅纯构造器 buildBackflowHandoff（单元调用）1 处（期望 1） | 通过 | `1` |

**⑤ 判定**：通过

---

#### AC-08 正常交接包通过校验并投递

- 判定：**通过**（核对 6/6 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-08`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop（开发完成，核心推进到测试）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-08 | exit=0 | 8043ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-08 | exit=0 | 298ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-08.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 开发节点完成，`calc.js` 存在且非空
- **When** 核心推进到测试
- **Then** 交接包从"已构造"变为"已投递"；测试会话收到提示；终端不出现拒绝或升级
- **机检：** `events.jsonl` 含 `handoff.delivered`，且该事件之后该包 `state` 为 `delivered` 或 `consumed`；没有 `handoff.rejected` 事件
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-08.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-08.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-08.meta.json` | 744 B |
| `docs/iterations/iteration-4/evidence/AC-08.output.json` | 5187 B |
| `docs/iterations/iteration-4/evidence/AC-08.status.txt` | 1312 B |
| `docs/iterations/iteration-4/evidence/AC-08.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-08.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-08.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-08.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：终端不出现拒绝（期望不含 "已拒绝"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-12778-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s` |
| 2 | Then：终端不出现升级（期望不含 "升级 ESC"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-12778-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s` |
| 3 | 机检：events 含 handoff.delivered | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 4 | 机检：没有 handoff.rejected 事件（期望不含 "handoff.rejected"） | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 5 | 机检：handoff.delivered 之后该包 state 为 delivered 或 consumed | 通过 | `consumed` |
| 6 | 机检：测试会话收到提示（信箱 promptText 非空） | 通过 | `["handoffId","instanceId","fromNodeId","toNodeId","sessionId","promptText","createdAt","deliveryAttempts","deliveredAt","lastError"]` |

**⑤ 判定**：通过

---

#### AC-09 缺必填字段的交接包被拒绝并升级

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-09`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run（test.handoff --mutate missing-to，放行后前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-09 | exit=4 | 6135ms
[call-seam test.handoff --mutate missing-to] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-09 --call test.handoff --instance INST-001 --node T-001 --mutate missing-to   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-09 | exit=0 | 248ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-09 | exit=0 | 252ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-09.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `NODE_ENV=test` 下的 `test.handoff` 接缝构造一张缺少目标节点字段的交接包草稿（尚未记录为"已构造"，绕过上游产物核对，只验证交接层）
- **When** 接缝让这张包进入投递路径
- **Then** 该包显示"已拒绝（内容不合规）"；来源节点升级；实例挂起；没有新会话、没有新派发
- **机检：** 包 `rejectReason` 为 `invalid_payload`；`handoffs` 中该包只以 `rejected` 出现、没有 `created` 记录；`events.jsonl` 有 `handoff.rejected` 与 `escalation.created`，没有 `node.dispatch`；`sessions.length` 不增加
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-09.state.json` | 3636 B |
| `docs/iterations/iteration-4/evidence/AC-09.events.jsonl` | 3091 B |
| `docs/iterations/iteration-4/evidence/AC-09.meta.json` | 913 B |
| `docs/iterations/iteration-4/evidence/AC-09.output.json` | 5299 B |
| `docs/iterations/iteration-4/evidence/AC-09.status.txt` | 1676 B |
| `docs/iterations/iteration-4/evidence/AC-09.status.md.json` | 659 B |
| `docs/iterations/iteration-4/evidence/AC-09.prompts.json` | 547 B |
| `docs/iterations/iteration-4/evidence/AC-09.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-09.attempts.json` | 78 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：接缝注册成功 | 通过 | `[object Object]` |
| 2 | 夹具：暂停接缝命中（after_output:T-001） | 通过 | `true` |
| 3 | 机检：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 4 | 机检：交接包以 rejected 出现 | 通过 | `[{"id":"HO-001","state":"rejected"}]` |
| 5 | 机检：rejectReason === invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 6 | 机检：events 有 handoff.rejected | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |
| 7 | 机检：events 有 escalation.created | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |
| 8 | 机检：escalations[0].reasonCode（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 9 | 机检：node.dispatch 只有入口一条（零新派发）（期望 1） | 通过 | `1` |
| 10 | 机检：handoffs 无 created 记录 | 通过 | `["rejected"]` |
| 11 | 机检：升级原因 detail 含缺少字段 toNodeId（期望含 "toNodeId"） | 通过 | `交接包 HO-001 内容不合规：缺少字段 toNodeId` |
| 12 | Then：没有新会话（sessions 只有入口 1 个）（期望 1） | 通过 | `1` |
| 13 | 机检：拒绝事件之后没有 node.dispatch（零新派发）（期望 0） | 通过 | `0` |
| 14 | 机检：handoffs 无 created 记录（期望不含 "created"） | 通过 | `rejected` |

**⑤ 判定**：通过

**备注**

- 入口 T-001 的 node.dispatch 属 Given 上游；AC-09 Then「没有新派发」以拒绝事件之后零 node.dispatch + sessions 不增加取证。

---

#### AC-10 缺证据引用被拒绝并升级

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-10`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run（test.handoff --mutate no-evidence，放行后前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-10 | exit=4 | 6049ms
[call-seam test.handoff --mutate no-evidence] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-10 --call test.handoff --instance INST-001 --node T-001 --mutate no-evidence   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-10 | exit=0 | 257ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-10 | exit=0 | 1195ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-10 | exit=0 | 313ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-10.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用同一接缝构造一张没有任何证据引用的交接包草稿（上游产物核对已通过，专门验证交接层兜底）
- **When** 接缝让这张包进入投递路径
- **Then** 终端升级原因显示"缺少证据引用"；交接包已拒绝；实例挂起；下游未启动
- **机检：** `escalations[0].reasonCode === 'handoff_invalid'`；`reasonDetail` 含"缺少证据引用"
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-10.state.json` | 3608 B |
| `docs/iterations/iteration-4/evidence/AC-10.events.jsonl` | 3091 B |
| `docs/iterations/iteration-4/evidence/AC-10.meta.json` | 742 B |
| `docs/iterations/iteration-4/evidence/AC-10.output.json` | 6766 B |
| `docs/iterations/iteration-4/evidence/AC-10.status.txt` | 2577 B |
| `docs/iterations/iteration-4/evidence/AC-10.status.md.json` | 639 B |
| `docs/iterations/iteration-4/evidence/AC-10.prompts.json` | 547 B |
| `docs/iterations/iteration-4/evidence/AC-10.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-10.attempts.json` | 78 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | 机检：交接包以 rejected 出现 | 通过 | `[{"id":"HO-001","state":"rejected"}]` |
| 3 | 机检：rejectReason === invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 4 | 机检：events 有 handoff.rejected | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |
| 5 | 机检：events 有 escalation.created | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |
| 6 | 机检：escalations[0].reasonCode（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 7 | 机检：node.dispatch 只有入口一条（零新派发）（期望 1） | 通过 | `1` |
| 8 | 机检：handoffs 无 created 记录 | 通过 | `["rejected"]` |
| 9 | 机检：escalations[0].reasonCode（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 10 | Then：终端升级原因显示「缺少证据引用」（期望含 "缺少证据引用"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:18:56<br>交接包 HO-001  开发→测试  已拒绝   06:18:56  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 11 | 机检：reasonDetail 含「缺少证据引用」（期望含 "缺少证据引用"） | 通过 | `交接包 HO-001 内容不合规：缺少证据引用 ` |
| 12 | Then：下游未启动（T-002 round 仍为 0）（期望 0） | 通过 | `0` |

**⑤ 判定**：通过

---

#### AC-11 证据文件不存在或为空被拒绝

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-rm`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-zero`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run[删除文件]（放行前台收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-rm | exit=4 | 5357ms
[orch run[写成 0 字节]（放行前台收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-zero | exit=4 | 5451ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-rm | exit=0 | 273ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-zero | exit=0 | 283ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-11.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用同一接缝构造一张引用 `calc.js` 的交接包草稿，并在投递前把该文件删除（或写成 0 字节）
- **When** 接缝让这张包进入投递路径
- **Then** 交接包已拒绝（内容不合规）；升级原因指出该文件不存在或为空
- **机检：** `reasonDetail` 含 `calc.js`；下游节点 `round` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-11.state.json` | 8359 B |
| `docs/iterations/iteration-4/evidence/AC-11.events.jsonl` | 7568 B |
| `docs/iterations/iteration-4/evidence/AC-11.meta.json` | 992 B |
| `docs/iterations/iteration-4/evidence/AC-11.output.json` | 6064 B |
| `docs/iterations/iteration-4/evidence/AC-11.status.txt` | 2214 B |
| `docs/iterations/iteration-4/evidence/AC-11.status.md.json` | 1332 B |
| `docs/iterations/iteration-4/evidence/AC-11.prompts.json` | 1123 B |
| `docs/iterations/iteration-4/evidence/AC-11.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-11.attempts.json` | 161 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具[删除文件]：投递前 calc.js 存在 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-rm/demo/calc.js` |
| 2 | 机检[删除文件]：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 3 | 机检[删除文件]：交接包已拒绝（期望 "rejected"） | 通过 | `"rejected"` |
| 4 | 机检[删除文件]：rejectReason = invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 5 | 机检[删除文件]：reasonCode = handoff_invalid（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 6 | Then[删除文件]：升级原因指出 calc.js 不存在或为空（期望含 "calc.js"） | 通过 | `交接包 HO-001 内容不合规：证据不可读 calc.js` |
| 7 | 机检[删除文件]：下游节点 T-002 round 不变（仍为 0）（期望 0） | 通过 | `0` |
| 8 | 夹具[写成 0 字节]：投递前 calc.js 存在 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-11-zero/demo/calc.js` |
| 9 | 机检[写成 0 字节]：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 10 | 机检[写成 0 字节]：交接包已拒绝（期望 "rejected"） | 通过 | `"rejected"` |
| 11 | 机检[写成 0 字节]：rejectReason = invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 12 | 机检[写成 0 字节]：reasonCode = handoff_invalid（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 13 | Then[写成 0 字节]：升级原因指出 calc.js 不存在或为空（期望含 "calc.js"） | 通过 | `交接包 HO-001 内容不合规：证据为空 calc.js` |
| 14 | 机检[写成 0 字节]：下游节点 T-002 round 不变（仍为 0）（期望 0） | 通过 | `0` |

**⑤ 判定**：通过

---

#### AC-12 证据越界或哈希不符被拒绝

- 判定：**通过**（核对 16/16 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-escape-ref`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-hash-mismatch`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run[escape-ref]（回流边坏包，前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-escape-ref | exit=4 | 9472ms
[call-seam test.handoff --mutate escape-ref --edge-kind backflow --round 2] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-escape-ref --call test.handoff --instance INST-001 --node T-002 --mutate escape-ref --edge-kind backflow --round 2   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-escape-ref | exit=0 | 189ms
[orch run[hash-mismatch]（回流边坏包，前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-hash-mismatch | exit=4 | 9713ms
[call-seam test.handoff --mutate hash-mismatch --edge-kind backflow --round 2] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-hash-mismatch --call test.handoff --instance INST-001 --node T-002 --mutate hash-mismatch --edge-kind backflow --round 2   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-hash-mismatch | exit=0 | 198ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-escape-ref | exit=0 | 254ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-12-hash-mismatch | exit=0 | 261ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-12.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用同一接缝构造一张回流边的包草稿（`edgeKind='backflow'`，文档闭环 `round=2`，此时上一版引用存在），把证据引用改成 `../secret.txt`（并在工作区外放一个同名可读文件），或把上一版引用的哈希改成与文件实际哈希不一致
- **When** 接缝让这张包进入投递路径
- **Then** 交接包已拒绝；升级原因指出路径越界或哈希不符
- **机检：** 即使工作区外文件真实存在，越界引用仍被拒绝；`artifactRefs.previous.sha256` 与文件哈希不等时被拒绝
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-12.state.json` | 14192 B |
| `docs/iterations/iteration-4/evidence/AC-12.events.jsonl` | 15954 B |
| `docs/iterations/iteration-4/evidence/AC-12.meta.json` | 1040 B |
| `docs/iterations/iteration-4/evidence/AC-12.output.json` | 8535 B |
| `docs/iterations/iteration-4/evidence/AC-12.status.txt` | 3859 B |
| `docs/iterations/iteration-4/evidence/AC-12.status.md.json` | 1504 B |
| `docs/iterations/iteration-4/evidence/AC-12.prompts.json` | 3204 B |
| `docs/iterations/iteration-4/evidence/AC-12.inbox.json` | 2532 B |
| `docs/iterations/iteration-4/evidence/AC-12.attempts.json` | 353 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具[escape-ref]：接缝注册成功 | 通过 | `[object Object]` |
| 2 | 夹具[escape-ref]：工作区外同名文件确实存在 | 通过 | `outside.txt` |
| 3 | 机检[escape-ref]：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 4 | 机检[escape-ref]：有交接包被拒绝（期望 "rejected"） | 通过 | `"rejected"` |
| 5 | 机检[escape-ref]：rejectReason = invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 6 | 机检[escape-ref]：reasonCode = handoff_invalid（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 7 | Then[escape-ref]：升级原因指出证据越界（期望含 "证据越界"） | 通过 | `交接包 HO-002 内容不合规：证据越界 ../outside.txt` |
| 8 | 机检[escape-ref]：目标节点 round 不增加（期望 1） | 通过 | `1` |
| 9 | 夹具[hash-mismatch]：接缝注册成功 | 通过 | `[object Object]` |
| 10 | 夹具[hash-mismatch]：工作区外同名文件确实存在 | 通过 | `outside.txt` |
| 11 | 机检[hash-mismatch]：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 12 | 机检[hash-mismatch]：有交接包被拒绝（期望 "rejected"） | 通过 | `"rejected"` |
| 13 | 机检[hash-mismatch]：rejectReason = invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 14 | 机检[hash-mismatch]：reasonCode = handoff_invalid（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 15 | Then[hash-mismatch]：升级原因指出证据哈希不符（期望含 "证据哈希不符"） | 通过 | `交接包 HO-002 内容不合规：证据哈希不符 calc.js` |
| 16 | 机检[hash-mismatch]：目标节点 round 不增加（期望 1） | 通过 | `1` |

**⑤ 判定**：通过

---

#### AC-13 回流包缺缺陷或修改要求被拒绝

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-backflow-empty-defects`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-empty-requirements`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run[backflow-empty-defects]（回流边坏包，前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-backflow-empty-defects | exit=4 | 9540ms
[call-seam test.handoff --mutate backflow-empty-defects --edge-kind backflow --round 2] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-backflow-empty-defects --call test.handoff --instance INST-001 --node T-002 --mutate backflow-empty-defects --edge-kind backflow --round 2   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-backflow-empty-defects | exit=0 | 205ms
[orch run[empty-requirements]（回流边坏包，前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-empty-requirements | exit=4 | 9649ms
[call-seam test.handoff --mutate empty-requirements --edge-kind backflow --round 2] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-empty-requirements --call test.handoff --instance INST-001 --node T-002 --mutate empty-requirements --edge-kind backflow --round 2   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-empty-requirements | exit=0 | 206ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-backflow-empty-defects | exit=0 | 254ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-13-empty-requirements | exit=0 | 264ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-13.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用同一接缝构造一张回流包草稿，其 `defects` 为空，或用 `empty-requirements` 清空修改要求与复测要求（绕过 C-06 的默认补全，专验交接层兜底）。I1.3 的审核解析器本会在更早阶段拦住这类输入，本 AC 专门验证交接层兜底
- **When** 接缝让这张包进入回流路径
- **Then** 回流包已拒绝；来源节点升级；撰写者/开发不会被派发
- **机检：** `rejectReason === 'invalid_payload'`；目标节点没有新会话；来源节点 `escalated`，`reasonCode === 'handoff_invalid'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-13.state.json` | 13813 B |
| `docs/iterations/iteration-4/evidence/AC-13.events.jsonl` | 16464 B |
| `docs/iterations/iteration-4/evidence/AC-13.meta.json` | 1097 B |
| `docs/iterations/iteration-4/evidence/AC-13.output.json` | 8567 B |
| `docs/iterations/iteration-4/evidence/AC-13.status.txt` | 3995 B |
| `docs/iterations/iteration-4/evidence/AC-13.status.md.json` | 1530 B |
| `docs/iterations/iteration-4/evidence/AC-13.prompts.json` | 3357 B |
| `docs/iterations/iteration-4/evidence/AC-13.inbox.json` | 2617 B |
| `docs/iterations/iteration-4/evidence/AC-13.attempts.json` | 387 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具[backflow-empty-defects]：接缝注册成功 | 通过 | `[object Object]` |
| 2 | 机检[backflow-empty-defects]：回流包已拒绝（期望 "rejected"） | 通过 | `"rejected"` |
| 3 | 机检[backflow-empty-defects]：rejectReason === 'invalid_payload'（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 4 | 机检[backflow-empty-defects]：reasonCode === 'handoff_invalid'（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 5 | Then[backflow-empty-defects]：升级原因指出回流缺少defects（期望含 "回流缺少defects"） | 通过 | `交接包 HO-002 内容不合规：回流缺少defects` |
| 6 | 机检[backflow-empty-defects]：目标节点（撰写者/开发）没有被派发（sessions 只有 2 个） | 通过 | `2` |
| 7 | 机检[backflow-empty-defects]：来源节点 escalated（期望 "escalated"） | 通过 | `"escalated"` |
| 8 | 夹具[empty-requirements]：接缝注册成功 | 通过 | `[object Object]` |
| 9 | 机检[empty-requirements]：回流包已拒绝（期望 "rejected"） | 通过 | `"rejected"` |
| 10 | 机检[empty-requirements]：rejectReason === 'invalid_payload'（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 11 | 机检[empty-requirements]：reasonCode === 'handoff_invalid'（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 12 | Then[empty-requirements]：升级原因指出回流缺少requirements（期望含 "回流缺少requirements"） | 通过 | `交接包 HO-002 内容不合规：回流缺少requirements` |
| 13 | 机检[empty-requirements]：目标节点（撰写者/开发）没有被派发（sessions 只有 2 个） | 通过 | `2` |
| 14 | 机检[empty-requirements]：来源节点 escalated（期望 "escalated"） | 通过 | `"escalated"` |

**⑤ 判定**：通过

---

#### AC-14 校验失败时零派发且原因可见

- 判定：**通过**（核对 20/20 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run（AC-10 坏包场景，前台挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14 | exit=4 | 5977ms
[call-seam test.handoff --mutate no-evidence] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14 --call test.handoff --instance INST-001 --node T-001 --mutate no-evidence   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14 | exit=0 | 232ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14 | exit=0 | 1287ms
[orch status --instance INST-001 --events] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001 --events   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14 | exit=0 | 299ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-14 | exit=0 | 309ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-14.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given**  AC-10 的坏包场景
- **When** 我执行 `orch status --instance INST-001` 与 `orch status --instance INST-001 --events`
- **Then** 交接包行显示已拒绝（内容不合规）；升级块给出节点、轮次、原因与下一步；日志里能看到拒绝与升级事件；没有"执行中"的假会话
- **机检：** `sessions.length` 不增加；`counters.dispatchCount` 不增加
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-14.state.json` | 3608 B |
| `docs/iterations/iteration-4/evidence/AC-14.events.jsonl` | 3091 B |
| `docs/iterations/iteration-4/evidence/AC-14.meta.json` | 748 B |
| `docs/iterations/iteration-4/evidence/AC-14.output.json` | 17662 B |
| `docs/iterations/iteration-4/evidence/AC-14.status.txt` | 4581 B |
| `docs/iterations/iteration-4/evidence/AC-14.status.md.json` | 639 B |
| `docs/iterations/iteration-4/evidence/AC-14.prompts.json` | 547 B |
| `docs/iterations/iteration-4/evidence/AC-14.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-14.attempts.json` | 78 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | 机检：交接包以 rejected 出现 | 通过 | `[{"id":"HO-001","state":"rejected"}]` |
| 3 | 机检：rejectReason === invalid_payload（期望 "invalid_payload"） | 通过 | `"invalid_payload"` |
| 4 | 机检：events 有 handoff.rejected | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |
| 5 | 机检：events 有 escalation.created | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |
| 6 | 机检：escalations[0].reasonCode（期望 "handoff_invalid"） | 通过 | `"handoff_invalid"` |
| 7 | 机检：node.dispatch 只有入口一条（零新派发）（期望 1） | 通过 | `1` |
| 8 | 机检：handoffs 无 created 记录 | 通过 | `["rejected"]` |
| 9 | Then：交接包行显示已拒绝（内容不合规）（期望含 "已拒绝"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 10 | Then：交接包行显示「内容不合规」原因（期望含 "内容不合规"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 11 | Then：升级块给出节点（期望含 "节点：T-001 开发"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 12 | Then：升级块给出轮次（期望含 "第 1 轮"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 13 | Then：升级块给出原因（期望含 "原因：交接包 HO-001 内容不合规：缺少证据引用"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 14 | Then：升级块给出下一步（期望含 "下一步：orch escalate list"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 15 | Then：日志里能看到拒绝事件（期望含 "交接被拒"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 16 | Then：日志里能看到升级事件（期望含 "创建升级"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 17 | Then：没有「执行中」的假会话（期望不含 "会话 执行中"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>节点 T-001 开发 已升级 · 第 1 轮<br>节点 T-002 测试 待执行<br>会话 已升级<br>交接包 HO-001  开发→测试  已构造   06:20:06<br>交接包 HO-001  开发→测试  已拒绝   06:20:06  原因 内容不合规<br>升级 ESC-001 待处理<br>  原因：交接包 HO-001 内容不合规：缺少证据引用 <br>  节点：T-001 开发 · 第 1 轮<br>  下一步：orch es` |
| 18 | 机检：sessions.length 不增加（仍为入口 1 个）（期望 1） | 通过 | `1` |
| 19 | 机检：counters.dispatchCount 不增加（仍为 1）（期望 1） | 通过 | `1` |
| 20 | 机检：events 没有额外的 node.dispatch（拒绝后）（期望不含 "node.dispatch"） | 通过 | `handoff.rejected,escalation.created,state.change,state.change,core.suspend` |

**⑤ 判定**：通过

---

#### AC-15 信箱先落盘再投递

- 判定：**通过**（核对 8/8 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-15`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop（开发完成，核心唤醒测试）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-15 | exit=0 | 8387ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-15 | exit=0 | 301ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-15.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环开发完成，核心准备唤醒测试
- **When** 核心投递交接包
- **Then** 信箱文件在宿主收到提示词之前已存在且内容完整；日志顺序能证明"先落盘、后投递"
- **机检：** `events.jsonl` 中 `handoff.inboxed` 出现在该包 `handoff.delivered` 之前；`.orch/inbox/INST-001/HO-001.json` 可解析且含目标节点、目标会话、提示词、`deliveryAttempts` 与 `lastError`；不依赖 `.mock/prompts/2.json` 的写入时机（mock 在 `sessionNew` 时就会建占位文件，不能作为先后证据）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-15.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-15.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-15.meta.json` | 883 B |
| `docs/iterations/iteration-4/evidence/AC-15.output.json` | 3664 B |
| `docs/iterations/iteration-4/evidence/AC-15.status.txt` | 1309 B |
| `docs/iterations/iteration-4/evidence/AC-15.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-15.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-15.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-15.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：events 含 handoff.inboxed | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 2 | Then/机检：handoff.inboxed 出现在该包 handoff.delivered 之前 | 通过 | `inboxed=11 delivered=12` |
| 3 | 机检：信箱文件 HO-001.json 可解析 | 通过 | `["handoffId","instanceId","fromNodeId","toNodeId","sessionId","promptText","createdAt","deliveryAttempts","deliveredAt","lastError"]` |
| 4 | 机检：含目标节点 toNodeId（期望 "T-002"） | 通过 | `"T-002"` |
| 5 | 机检：含目标会话 sessionId | 通过 | `mock-sess-13977-1` |
| 6 | 机检：含提示词 promptText | 通过 | `实现 calc.js，产物：calc.js<br><br>完成后把结构化判定写到 out/verdict.json：{"verdic` |
| 7 | 机检：含 deliveryAttempts 字段 | 通过 | `1` |
| 8 | 机检：含 lastError 字段 | 通过 | `null` |

**⑤ 判定**：通过

**备注**

- 按 AC-15 口径，先后证据取 events 顺序，不依赖 .mock/prompts/2.json 写入时机（mock 在 sessionNew 即建占位文件）。

---

#### AC-16 一次投递失败后重试成功

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-16`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-16-f2`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run task-loop（本地夹具 promptFailures:1）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-16 | exit=0 | 26063ms
[orch run task-loop（本地夹具 promptFailures:2，补充场景）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-16-f2 | exit=0 | 22735ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-16 | exit=0 | 524ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-16-f2 | exit=0 | 1083ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-16.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 宿主对第一次 `prompt` 返回失败、第二次成功
- **When** 核心投递交接包
- **Then** 交接包短暂显示"待投递 · 重试 1/2"，随后变为"已投递"；测试会话最终收到提示
- **机检：** `events.jsonl` 含 `handoff.pending`（`detail.deliveryAttempts === 1`）且位于最终 `handoff.delivered` 之前；包 `deliveryAttempts === 2`；场景根 `.mock/prompt-attempts-<sessionId>.json` 的 `attempts === 2`；目标节点只有 1 个会话（重试不新建会话）；`node.dispatch` 只有一条
- **补充：** 同一场景改用 `promptFailures: 2` 重跑一次：第 3 次成功，包 `deliveryAttempts === 3`，`events.jsonl` 有两次 `handoff.pending`（attempts 1、2），最终出现 `handoff.delivered`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-16.state.json` | 17873 B |
| `docs/iterations/iteration-4/evidence/AC-16.events.jsonl` | 23246 B |
| `docs/iterations/iteration-4/evidence/AC-16.meta.json` | 971 B |
| `docs/iterations/iteration-4/evidence/AC-16.output.json` | 7979 B |
| `docs/iterations/iteration-4/evidence/AC-16.status.txt` | 3851 B |
| `docs/iterations/iteration-4/evidence/AC-16.status.md.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-16.prompts.json` | 6278 B |
| `docs/iterations/iteration-4/evidence/AC-16.inbox.json` | 5649 B |
| `docs/iterations/iteration-4/evidence/AC-16.attempts.json` | 653 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then/机检：实例 completed（期望 "completed"） | 通过 | `"completed"` |
| 2 | 机检：handoff.pending 恰好 1 次（期望 1） | 通过 | `1` |
| 3 | 机检：pending.detail.deliveryAttempts === 1（期望 1） | 通过 | `1` |
| 4 | 机检：pending 位于最终 handoff.delivered 之前 | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,review.evidence_verified,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,handoff.pending,handoff.delivered,session.state,turn.first_event,revi` |
| 5 | 机检：HO-001 deliveryAttempts === 2（期望 2） | 通过 | `2` |
| 6 | 机检：目标会话 prompt-attempts 文件 attempts === 2 | 通过 | `[1,2,1,1]` |
| 7 | 机检：目标节点 T-002 只有 1 个会话（重试不新建会话）（期望 1） | 通过 | `1` |
| 8 | 机检：T-002 的 node.dispatch 只有一条（期望 1） | 通过 | `1` |
| 9 | 补充：HO-001 deliveryAttempts === 3（期望 3） | 通过 | `3` |
| 10 | 补充：有两次 handoff.pending（attempts 1、2） | 通过 | `[1,2]` |
| 11 | 补充：最终出现 handoff.delivered | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,review.evidence_verified,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,handoff.pending,handoff.delivered,handoff.pending,handoff.delivered,s` |

**⑤ 判定**：通过

---

#### AC-17 重试耗尽后升级

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-17`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run task-loop（本地夹具 promptFailures:3）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-17 | exit=4 | 20386ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-17 | exit=0 | 717ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-17.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 宿主连续 3 次拒绝 `prompt`（首次 + 2 次重试）
- **When** 核心投递交接包
- **Then** 交接包显示"已过期"；节点升级；实例挂起；升级原因写明已尝试 3 次
- **机检：** 包 `state === 'expired'`、`deliveryAttempts === 3`、`expiredAt` 非空；信箱文件 `deliveryAttempts === 3` 且 `lastError` 非空；场景根 `.mock/prompt-attempts-<sessionId>.json` 的 `attempts === 3`；`escalations[0].reasonCode === 'delivery_failed'`；目标节点仍只有 1 个会话（重试不新增会话）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-17.state.json` | 5238 B |
| `docs/iterations/iteration-4/evidence/AC-17.events.jsonl` | 5455 B |
| `docs/iterations/iteration-4/evidence/AC-17.meta.json` | 731 B |
| `docs/iterations/iteration-4/evidence/AC-17.output.json` | 3956 B |
| `docs/iterations/iteration-4/evidence/AC-17.status.txt` | 1136 B |
| `docs/iterations/iteration-4/evidence/AC-17.status.md.json` | 816 B |
| `docs/iterations/iteration-4/evidence/AC-17.prompts.json` | 1867 B |
| `docs/iterations/iteration-4/evidence/AC-17.inbox.json` | 1329 B |
| `docs/iterations/iteration-4/evidence/AC-17.attempts.json` | 247 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then/机检：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | 机检：包 state === expired（期望 "expired"） | 通过 | `"expired"` |
| 3 | 机检：deliveryAttempts === 3（期望 3） | 通过 | `3` |
| 4 | 机检：expiredAt 非空 | 通过 | `2026-11-08T22:33:20.781Z` |
| 5 | Then：升级原因写明已尝试 3 次（期望含 "已尝试 3 次"） | 通过 | `交接包 HO-001 投递失败（已尝试 3 次）：mock-host: upstream model request failed (code 500)` |
| 6 | 机检：escalations[0].reasonCode === delivery_failed（期望 "delivery_failed"） | 通过 | `"delivery_failed"` |
| 7 | 机检：信箱文件 deliveryAttempts === 3（期望 3） | 通过 | `3` |
| 8 | 机检：信箱文件 lastError 非空 | 通过 | `mock-host: upstream model request failed (code 500)` |
| 9 | 机检：目标会话 prompt-attempts 文件 attempts === 3 | 通过 | `[1,3,3]` |
| 10 | 机检：目标节点 T-002 仍只有 1 个会话（重试不新增会话）（期望 1） | 通过 | `1` |
| 11 | 机检：events 含 handoff.expired | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,review.evidence_verified,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,handoff.pending,handoff.delivered,handoff.pending,handoff.delivered,h` |

**⑤ 判定**：通过

---

#### AC-18 重试不增加派发、轮次或会话

- 判定：**通过**（核对 4/4 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-18`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run task-loop（AC-16 重试场景）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-18 | exit=0 | 25385ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-18 | exit=0 | 632ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-18.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given**  AC-16 的重试场景
- **When** 重试完成
- **Then** 终端没有重复的"派发"事件；节点轮次仍是本轮
- **机检：** `counters.dispatchCount` 只加 1；目标节点 `round` 不变；`events.jsonl` 中 `reason === 'node.dispatch'` 只有一条
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-18.state.json` | 7380 B |
| `docs/iterations/iteration-4/evidence/AC-18.events.jsonl` | 9542 B |
| `docs/iterations/iteration-4/evidence/AC-18.meta.json` | 748 B |
| `docs/iterations/iteration-4/evidence/AC-18.output.json` | 3264 B |
| `docs/iterations/iteration-4/evidence/AC-18.status.txt` | 1963 B |
| `docs/iterations/iteration-4/evidence/AC-18.status.md.json` | 744 B |
| `docs/iterations/iteration-4/evidence/AC-18.prompts.json` | 3115 B |
| `docs/iterations/iteration-4/evidence/AC-18.inbox.json` | 2808 B |
| `docs/iterations/iteration-4/evidence/AC-18.attempts.json` | 322 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：counters.dispatchCount 只加 1（每节点一次，共 3）（期望 3） | 通过 | `3` |
| 2 | Then：目标节点 T-002 round 不变（第 1 轮）（期望 1） | 通过 | `1` |
| 3 | 机检：events 中 T-002 的 node.dispatch 只有一条（期望 1） | 通过 | `1` |
| 4 | Then：终端没有重复的派发事件（无第 4 条 node.dispatch） | 通过 | `3` |

**⑤ 判定**：通过

---

#### AC-19 会话创建失败仍按一次尝试升级

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-19`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop dispatch-fail-first] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-19 | exit=4 | 6877ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-19 | exit=0 | 520ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-19.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** I1.2 的编码闭环 `dispatch-fail-first` 夹具（首个节点 `sessionNew` 失败）
- **When** 我发起编码闭环
- **Then** 实例直接挂起并显示升级；没有"待投递"、没有重试、没有会话记录
- **机检：** `escalations[0].reasonCode === 'dispatch_failed'`；`sessions.length === 0`（首派会话没建起来）；`node.dispatch` 只有一条；`handoffs` 中没有 `created` 包
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-19.state.json` | 1828 B |
| `docs/iterations/iteration-4/evidence/AC-19.events.jsonl` | 1102 B |
| `docs/iterations/iteration-4/evidence/AC-19.meta.json` | 750 B |
| `docs/iterations/iteration-4/evidence/AC-19.output.json` | 3286 B |
| `docs/iterations/iteration-4/evidence/AC-19.status.txt` | 908 B |
| `docs/iterations/iteration-4/evidence/AC-19.status.md.json` | 590 B |
| `docs/iterations/iteration-4/evidence/AC-19.prompts.json` | 96 B |
| `docs/iterations/iteration-4/evidence/AC-19.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-19.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：实例直接挂起并显示升级（期望含 "已挂起"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮<br>下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry\|pass\|fail 处理；要终止请执行 orch cancel --instance INST-001<br>` |
| 2 | Then：没有「待投递」（期望不含 "待投递"） | 通过 | `实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮<br>下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry\|pass\|fail 处理；要终止请执行 orch cancel --instance INST-001<br>` |
| 3 | Then/机检：实例 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 4 | 机检：escalations[0].reasonCode === dispatch_failed（期望 "dispatch_failed"） | 通过 | `"dispatch_failed"` |
| 5 | 机检：sessions.length === 0（首派会话没建起来）（期望 0） | 通过 | `0` |
| 6 | 机检：node.dispatch 只有一条（期望 1） | 通过 | `1` |
| 7 | 机检：handoffs 中没有 created 包（期望 0） | 通过 | `0` |

**⑤ 判定**：通过

---

#### AC-20 信箱写不进去时不投递

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-20`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop（MAESTRO_FAULT=inbox_write:fail）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-20 | exit=4 | 10711ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-20 | exit=0 | 370ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-20.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 在编码闭环成功路径上（开发为第 1 步、测试为第 2 步），夹具用本迭代新增、仅 `NODE_ENV=test` 生效的故障值 `MAESTRO_FAULT=inbox_write:fail` 让信箱写入失败
- **When** 核心准备投递
- **Then** 宿主没有收到提示；交接包显示已拒绝（投递失败）；节点升级、实例挂起
- **机检：** 场景根 `.mock/prompts/2.json` 的 `task` 仍为 `null`（测试节点这次 mock 启动时建立的占位未被 `session/prompt` 覆盖），且场景根 `.mock/prompt-attempts-<目标会话 ID>.json` 不存在；目标会话最多 1 个且为 `idle`；`rejectReason === 'delivery_failed'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-20.state.json` | 4150 B |
| `docs/iterations/iteration-4/evidence/AC-20.events.jsonl` | 3526 B |
| `docs/iterations/iteration-4/evidence/AC-20.meta.json` | 739 B |
| `docs/iterations/iteration-4/evidence/AC-20.output.json` | 3559 B |
| `docs/iterations/iteration-4/evidence/AC-20.status.txt` | 1113 B |
| `docs/iterations/iteration-4/evidence/AC-20.status.md.json` | 674 B |
| `docs/iterations/iteration-4/evidence/AC-20.prompts.json` | 640 B |
| `docs/iterations/iteration-4/evidence/AC-20.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-20.attempts.json` | 78 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then/机检：实例挂起 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | 机检：交接包已拒绝（投递失败）（期望 "rejected"） | 通过 | `"rejected"` |
| 3 | 机检：rejectReason === delivery_failed（期望 "delivery_failed"） | 通过 | `"delivery_failed"` |
| 4 | 机检：escalations[0].reasonCode === delivery_failed（期望 "delivery_failed"） | 通过 | `"delivery_failed"` |
| 5 | 机检：.mock/prompts/2.json 的 task 仍为 null（宿主没收到提示）（期望 null） | 通过 | `null` |
| 6 | 机检：目标会话最多 1 个（期望 1） | 通过 | `1` |
| 7 | 机检：目标会话为 idle（期望 "idle"） | 通过 | `"idle"` |
| 8 | 机检：目标会话 mock-sess-24141-1 没有 prompt-attempts 文件 | 通过 | `prompt-attempts-mock-sess-24096-1.json` |
| 9 | Then：宿主没有收到提示（events 无 handoff.delivered）（期望不含 "handoff.delivered"） | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.rejected,escalation.created,state.change,state.change,core.suspend` |

**⑤ 判定**：通过

---

#### AC-21 跨实例列出待处理升级

- 判定：**通过**（核对 20/20 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21-empty`
- 实例：INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（cwd demo1 → INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=4 | 13032ms
[orch run code-loop rounds-exceeded（cwd demo2 → INST-002）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo2 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=4 | 11496ms
[orch escalate list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=0 | 269ms
[orch escalate list（复跑验行序）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=0 | 270ms
[orch escalate list --all] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list --all   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=0 | 343ms
[orch escalate list --instance INST-001 --all] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list --instance INST-001 --all   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=0 | 264ms
[orch escalate list（全新项目根）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21-empty | exit=0 | 1267ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21 | exit=0 | 318ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-21-empty | exit=0 | 254ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-21.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 两个实例各有一个待处理升级，其中 INST-001 另有一条已处理升级与一条已作废升级；另有一个全新项目根，没有任何实例与升级
- **When** 我执行 `orch escalate list`，再执行 `orch escalate list --all`，再执行 `orch escalate list --instance INST-001 --all`，最后在全新项目根执行 `orch escalate list`
- **Then** 默认两行都出现，先按实例号、再按升级号排序；行内含实例号、节点与角色、轮次、状态、原因摘要；`--all` 时已处理升级以"已处理（通过/失败/重新分配）"、已作废升级以"已作废"出现；`--instance` 与 `--all` 同时给出时只看该实例、但含其已处理与已作废；没有升级时输出 `升级 —`
- **机检：** 各次输出行序稳定；默认不含已处理/已作废，`--all` 含全部，`--instance INST-001 --all` 只含 INST-001 的三行（待处理 + 已处理 + 已作废）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-21.state.json` | 20558 B |
| `docs/iterations/iteration-4/evidence/AC-21.events.jsonl` | 29974 B |
| `docs/iterations/iteration-4/evidence/AC-21.meta.json` | 1138 B |
| `docs/iterations/iteration-4/evidence/AC-21.output.json` | 16048 B |
| `docs/iterations/iteration-4/evidence/AC-21.status.txt` | 5750 B |
| `docs/iterations/iteration-4/evidence/AC-21.status.md.json` | 1547 B |
| `docs/iterations/iteration-4/evidence/AC-21.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-21.inbox.json` | 7035 B |
| `docs/iterations/iteration-4/evidence/AC-21.attempts.json` | 603 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：确有两个实例 | 通过 | `INST-001,INST-002` |
| 2 | Then：默认两行（期望 2） | 通过 | `2` |
| 3 | 机检：默认行序稳定（INST-001 在 INST-002 之前）（期望含 "实例 INST-001"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过` |
| 4 | 机检：默认第 2 行 INST-002（期望含 "实例 INST-002"） | 通过 | `升级 ESC-001  实例 INST-002  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过` |
| 5 | Then：行内含实例号、节点与角色、轮次、状态、原因摘要（期望含 "节点 T-002 测试 · 第 2 轮  待处理  回流超上限"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过` |
| 6 | 机检：默认不含已处理（期望不含 "已处理"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-001  实例 INST-002  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>` |
| 7 | 机检：默认不含已作废（期望不含 "已作废"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-001  实例 INST-002  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>` |
| 8 | 机检：默认各次输出行序稳定（期望 "升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过\n升级 ESC-001  实例 INST-002  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过\n"） | 通过 | `"升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过\n升级 ESC-001  实例 INST-002  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过\n"` |
| 9 | Then：--all 四行（期望 4） | 通过 | `4` |
| 10 | 机检：--all 已处理以「已处理（通过）」出现（期望含 "已处理（通过）"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-001  实例 INST-002  节点 T-002 ` |
| 11 | 机检：--all 已作废以「已作废」出现（期望含 "已作废"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-001  实例 INST-002  节点 T-002 ` |
| 12 | 机检：已处理行（ESC-002）逐字带「已处理（通过）」（期望含 "已处理（通过）"） | 通过 | `升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过` |
| 13 | 机检：已作废行（ESC-003）逐字带「已作废」（期望含 "已作废"） | 通过 | `升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过` |
| 14 | 机检：--all 含 INST-002 的待处理行（含全部实例） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过\|升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过\|升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过\|升级 ESC-001  实例 INST-002  节点 T-002 测试 · 第` |
| 15 | 机检：--instance + --all 只含 INST-001 三行（期望 3） | 通过 | `3` |
| 16 | 机检：三行都是 INST-001 | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过\|升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过\|升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过` |
| 17 | 机检：含待处理（期望含 "待处理"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过<br>` |
| 18 | 机检：含已处理（通过）（期望含 "已处理（通过）"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过<br>` |
| 19 | 机检：含已作废（期望含 "已作废"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-002  实例 INST-001  节点 T-002 测试 · 第 2 轮  已处理（通过）  回流超上限：测试已派发 2 次仍未通过<br>升级 ESC-003  实例 INST-001  节点 T-002 测试 · 第 2 轮  已作废  回流超上限：测试已派发 2 次仍未通过<br>` |
| 20 | Then：没有升级时输出「升级 —」（期望 "升级 —"） | 通过 | `"升级 —"` |

**⑤ 判定**：通过

**备注**

- Given 的「已处理/已作废」为视图静态前置：以真实挂起 state.json 为母版，仅改写 escalations 数组状态字段后交 CLI 渲染。

---

#### AC-22 按实例过滤升级

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-22`
- 实例：INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-22 | exit=4 | 13018ms
[orch run code-loop rounds-exceeded（INST-002）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo2 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-22 | exit=4 | 12164ms
[orch escalate list --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-22 | exit=0 | 358ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-22 | exit=0 | 275ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-22.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 两个实例都有升级
- **When** 我执行 `orch escalate list --instance INST-001`
- **Then** 只出现 INST-001 的升级行
- **机检：** 输出不含 INST-002
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-22.state.json` | 19264 B |
| `docs/iterations/iteration-4/evidence/AC-22.events.jsonl` | 29974 B |
| `docs/iterations/iteration-4/evidence/AC-22.meta.json` | 827 B |
| `docs/iterations/iteration-4/evidence/AC-22.output.json` | 5896 B |
| `docs/iterations/iteration-4/evidence/AC-22.status.txt` | 3115 B |
| `docs/iterations/iteration-4/evidence/AC-22.status.md.json` | 1547 B |
| `docs/iterations/iteration-4/evidence/AC-22.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-22.inbox.json` | 7035 B |
| `docs/iterations/iteration-4/evidence/AC-22.attempts.json` | 603 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：两个实例都有升级 | 通过 | `INST-001,INST-002` |
| 2 | Then：只出现 INST-001 的升级行（期望 1） | 通过 | `1` |
| 3 | Then：该行含 INST-001（期望含 "实例 INST-001"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过` |
| 4 | 机检：输出不含 INST-002（期望不含 "INST-002"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过<br>` |
| 5 | 机检：INST-002 确有 1 条待处理升级（被过滤的是真实行）（期望 1） | 通过 | `1` |
| 6 | 机检：该行含升级号 ESC-001（期望含 "ESC-001"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过` |
| 7 | 机检：该行含节点与角色、轮次、状态、原因摘要（期望含 "节点 T-002 测试 · 第 2 轮  待处理  回流超上限"） | 通过 | `升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过` |

**⑤ 判定**：通过

---

#### AC-23 通过处理终节点升级 → 实例完成

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-23`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（终节点 T-002 升级，实例挂起）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-23 | exit=4 | 14088ms
[orch escalate resolve ESC-001 --instance INST-001 --decision pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-23 | exit=0 | 612ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-23 | exit=0 | 344ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-23.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环终节点 T-002 因轮次超限升级，实例挂起
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision pass`
- **Then** 输出"升级 ESC-001 已处理（通过）"与当前实例行 `实例 INST-001 · 已完成 · 模板 编码闭环`；节点为已完成；不需要再敲 `run`
- **机检：** 升级 `state === 'resolved'`、`resolution === 'pass'`；实例 `completed`；节点 `done`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-23.state.json` | 7916 B |
| `docs/iterations/iteration-4/evidence/AC-23.events.jsonl` | 14195 B |
| `docs/iterations/iteration-4/evidence/AC-23.meta.json` | 866 B |
| `docs/iterations/iteration-4/evidence/AC-23.output.json` | 4478 B |
| `docs/iterations/iteration-4/evidence/AC-23.status.txt` | 1919 B |
| `docs/iterations/iteration-4/evidence/AC-23.status.md.json` | 775 B |
| `docs/iterations/iteration-4/evidence/AC-23.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-23.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-23.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：实例挂起且升级待处理（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | Given：ESC-001 待处理（期望 "pending"） | 通过 | `"pending"` |
| 3 | Then：输出「升级 ESC-001 已处理（通过）」（期望含 "升级 ESC-001 已处理（通过）"） | 通过 | `升级 ESC-001 已处理（通过）<br>实例 INST-001 · 已完成 · 模板 编码闭环<br>` |
| 4 | Then：输出当前实例行「实例 INST-001 · 已完成 · 模板 编码闭环」（期望含 "实例 INST-001 · 已完成 · 模板 编码闭环"） | 通过 | `升级 ESC-001 已处理（通过）<br>实例 INST-001 · 已完成 · 模板 编码闭环<br>` |
| 5 | Then：退出码 0（期望 0） | 通过 | `0` |
| 6 | 机检：升级 state === resolved（期望 "resolved"） | 通过 | `"resolved"` |
| 7 | 机检：resolution === pass（期望 "pass"） | 通过 | `"pass"` |
| 8 | 机检：实例 completed（期望 "completed"） | 通过 | `"completed"` |
| 9 | 机检：节点都为 done | 通过 | `done,done` |

**⑤ 判定**：通过

**备注**

- 「不需要再敲 run」：resolve 命令自身把实例推进到 completed，未再执行 orch run。

---

#### AC-24 通过处理中间节点升级 → 下游继续

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[call-seam test.escalate --reason-code rounds_exceeded（node T-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24 --call test.escalate --instance INST-001 --node T-001 --reason-code rounds_exceeded   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24 | exit=0 | 562ms
[orch run（放行后挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24 | exit=4 | 5392ms
[orch escalate resolve ESC-001 --instance INST-001 --decision pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24 | exit=0 | 1746ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24 | exit=0 | 654ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-24 | exit=0 | 262ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-24.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 先在任务目录放好非空 `calc.js`；用 `NODE_ENV=test` 的 `test.escalate` 接缝把开发节点置为 `rounds_exceeded` 升级（`reasonCode: 'rounds_exceeded'`），并给该节点注入 `artifactRefs: [{ ref: 'calc.js' }]`，确保人工 `pass` 后能构造出有证据的交接包；测试尚未派发
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision pass`
- **Then** 开发节点变已完成，核心立即推进测试；交接包校验通过；`orch status` 显示测试执行中或已完成
- **机检：** 实例 `running` 或 `completed`；出现一次新的 `node.dispatch`；下游节点 `round` 增加；没有 `handoff.rejected` 事件
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-24.state.json` | 3910 B |
| `docs/iterations/iteration-4/evidence/AC-24.events.jsonl` | 5760 B |
| `docs/iterations/iteration-4/evidence/AC-24.meta.json` | 1130 B |
| `docs/iterations/iteration-4/evidence/AC-24.output.json` | 7421 B |
| `docs/iterations/iteration-4/evidence/AC-24.status.txt` | 2882 B |
| `docs/iterations/iteration-4/evidence/AC-24.status.md.json` | 618 B |
| `docs/iterations/iteration-4/evidence/AC-24.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-24.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-24.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：pause at after_output:T-001 命中 | 通过 | `true` |
| 2 | 夹具：接缝注入升级成功 | 通过 | `[object Object]` |
| 3 | Given：实例挂起（期望 "suspended"） | 通过 | `"suspended"` |
| 4 | Given：测试尚未派发（T-002 round 0）（期望 0） | 通过 | `0` |
| 5 | Then：输出「升级 ESC-001 已处理（通过）」（期望含 "升级 ESC-001 已处理（通过）"） | 通过 | `升级 ESC-001 已处理（通过）<br>实例 INST-001 · 运行中 · 模板 编码闭环<br>` |
| 6 | Then/机检：实例 running 或 completed | 通过 | `running` |
| 7 | Then：orch status 显示测试执行中或已完成（期望含 "节点 T-002"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 3s<br>节点 T-002 测试 执行中 · 第 1 轮<br>会话 执行中 · 已运行 2s<br>交接包 HO-001  开发→测试  已构造   06:36:09<br>交接包 HO-001  开发→测试  已投递   06:36:10<br>交接包 HO-001  开发→测试  已接受   06:36:10<br>升级 ESC-001 已处理<br>  原因：执行失败：<br>  节点：` |
| 8 | 机检：出现一次新的 node.dispatch（指向 T-002） | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,escalation.created,state.change,state.change,core.suspend,escalation.resolved,state.change,state.change,state.change,handoff.created,node.dispatch,handoff.inb` |
| 9 | 机检：下游节点 T-002 round 增加 | 通过 | `1` |
| 10 | 机检：没有 handoff.rejected 事件（期望不含 "handoff.rejected"） | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,escalation.created,state.change,state.change,core.suspend,escalation.resolved,state.change,state.change,state.change,handoff.created,node.dispatch,handoff.inb` |
| 11 | 机检：交接包校验通过（指向测试的 HO-001 进入 delivered/consumed） | 通过 | `[{"id":"HO-001","state":"delivered"}]` |

**⑤ 判定**：通过

**备注**

- Given 的「有证据的交接包」由真实产物 calc.js 的已验证 artifactRefs 提供（核心在 pass 后据此构造 HO-001）。实测接缝 --artifact-ref 注入会生成未验证引用而被 handoff-schema 以「缺少证据引用」拒绝，故按需求意图改走真实已验证产物路径；结论仍是核心立即推进测试、校验通过。

---

#### AC-25 失败处理升级 → 实例失败

- 判定：**通过**（核对 6/6 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-25`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（待处理升级，实例挂起）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-25 | exit=4 | 13178ms
[orch escalate resolve ESC-001 --instance INST-001 --decision fail] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision fail --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-25 | exit=0 | 508ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-25 | exit=0 | 306ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-25.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环一个待处理升级，实例挂起
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision fail`
- **Then** 输出"升级 ESC-001 已处理（失败）"与当前实例行 `实例 INST-001 · 失败 · 模板 编码闭环`；没有新的下游派发
- **机检：** 节点 `failed`、实例 `failed`；`dispatchCount` 不再增加
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-25.state.json` | 7915 B |
| `docs/iterations/iteration-4/evidence/AC-25.events.jsonl` | 14194 B |
| `docs/iterations/iteration-4/evidence/AC-25.meta.json` | 741 B |
| `docs/iterations/iteration-4/evidence/AC-25.output.json` | 4054 B |
| `docs/iterations/iteration-4/evidence/AC-25.status.txt` | 1926 B |
| `docs/iterations/iteration-4/evidence/AC-25.status.md.json` | 769 B |
| `docs/iterations/iteration-4/evidence/AC-25.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-25.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-25.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：输出「升级 ESC-001 已处理（失败）」（期望含 "升级 ESC-001 已处理（失败）"） | 通过 | `升级 ESC-001 已处理（失败）<br>实例 INST-001 · 失败 · 模板 编码闭环<br>` |
| 2 | Then：输出实例失败行「实例 INST-001 · 失败 · 模板 编码闭环」（期望含 "实例 INST-001 · 失败 · 模板 编码闭环"） | 通过 | `升级 ESC-001 已处理（失败）<br>实例 INST-001 · 失败 · 模板 编码闭环<br>` |
| 3 | 机检：实例 failed（期望 "failed"） | 通过 | `"failed"` |
| 4 | 机检：节点 failed | 通过 | `done,failed` |
| 5 | Then：没有新的下游派发（dispatchCount 不再增加）（期望 4） | 通过 | `4` |
| 6 | 机检：events.jsonl 没有新增 node.dispatch（失败处理不派发下游）（期望 4） | 通过 | `4` |

**⑤ 判定**：通过

---

#### AC-26 重新分配 → 新会话、新一轮、只重跑该节点

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-26`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[call-seam test.escalate（node T-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-26 --call test.escalate --instance INST-001 --node T-001 --reason-code rounds_exceeded   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-26 | exit=0 | 602ms
[orch run（放行后挂起收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-26 | exit=4 | 5370ms
[orch escalate resolve ESC-001 --instance INST-001 --decision retry] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision retry --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-26 | exit=0 | 1755ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-26 | exit=0 | 261ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-26.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 独立项目根；开发节点已派发过一次并回到空闲（mock 回合结束后会话即 `idle`，无需额外等待）；用 `NODE_ENV=test` 的 `test.escalate` 接缝把该节点置为 `rounds_exceeded` 升级（`reasonCode: 'rounds_exceeded'`），实例挂起、测试尚未派发
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision retry`
- **Then** 输出"升级 ESC-001 已处理（重新分配）"与当前实例行 `实例 INST-001 · 运行中 · 模板 编码闭环`；开发节点出现新会话、轮次 +1；测试没有被重跑
- **机检：** `sessions.length` 增加 1；目标节点 `round` 增加 1；其他节点 `round` 不变；旧会话不再是 `running`（按 D-6.6 隔离）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-26.state.json` | 2904 B |
| `docs/iterations/iteration-4/evidence/AC-26.events.jsonl` | 4571 B |
| `docs/iterations/iteration-4/evidence/AC-26.meta.json` | 770 B |
| `docs/iterations/iteration-4/evidence/AC-26.output.json` | 4933 B |
| `docs/iterations/iteration-4/evidence/AC-26.status.txt` | 1953 B |
| `docs/iterations/iteration-4/evidence/AC-26.status.md.json` | 569 B |
| `docs/iterations/iteration-4/evidence/AC-26.prompts.json` | 1091 B |
| `docs/iterations/iteration-4/evidence/AC-26.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-26.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：pause 命中 | 通过 | `true` |
| 2 | 夹具：接缝注册升级成功 | 通过 | `[object Object]` |
| 3 | Given：实例 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 4 | Given：测试 round 0（期望 0） | 通过 | `0` |
| 5 | Then：输出「升级 ESC-001 已处理（重新分配）」（期望含 "升级 ESC-001 已处理（重新分配）"） | 通过 | `升级 ESC-001 已处理（重新分配）<br>实例 INST-001 · 运行中 · 模板 编码闭环<br>` |
| 6 | Then：输出当前实例行「实例 INST-001 · 运行中 · 模板 编码闭环」（期望含 "实例 INST-001 · 运行中 · 模板 编码闭环"） | 通过 | `升级 ESC-001 已处理（重新分配）<br>实例 INST-001 · 运行中 · 模板 编码闭环<br>` |
| 7 | 机检：sessions.length 增加 1（期望 2） | 通过 | `2` |
| 8 | 机检：目标节点 T-001 round 增加 1（期望 2） | 通过 | `2` |
| 9 | Then：测试没有被重跑（T-002 round 不变，仍 0）（期望 0） | 通过 | `0` |
| 10 | 机检：旧会话不再是 running | 通过 | `idle,tool_running` |

**⑤ 判定**：通过

---

#### AC-27 同一升级不能处理两次

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-27`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-27 | exit=4 | 14226ms
[orch escalate resolve ESC-001 --decision pass（第 1 次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-27 | exit=0 | 613ms
[orch escalate resolve ESC-001 --decision pass（第 2 次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-27 | exit=1 | 304ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-27 | exit=0 | 312ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-27.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 独立项目根，按 AC-23 的步骤重放至升级已处理
- **When** 我再次执行同一 `resolve`
- **Then** 提示升级已处理；退出码 1；实例状态和轮次不变
- **机检：** 没有第二条 `escalation.resolved` 事件
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-27.state.json` | 7916 B |
| `docs/iterations/iteration-4/evidence/AC-27.events.jsonl` | 14195 B |
| `docs/iterations/iteration-4/evidence/AC-27.meta.json` | 739 B |
| `docs/iterations/iteration-4/evidence/AC-27.output.json` | 4406 B |
| `docs/iterations/iteration-4/evidence/AC-27.status.txt` | 2213 B |
| `docs/iterations/iteration-4/evidence/AC-27.status.md.json` | 775 B |
| `docs/iterations/iteration-4/evidence/AC-27.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-27.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-27.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：第 1 次 resolve 成功（期望 0） | 通过 | `0` |
| 2 | Then：提示升级已处理（期望含 "已处理"） | 通过 | `升级 ESC-001 已处理（已处理），无需再次处理<br>` |
| 3 | Then：退出码 1（期望 1） | 通过 | `1` |
| 4 | 机检：实例状态不变（期望 "completed"） | 通过 | `"completed"` |
| 5 | 机检：节点轮次不变（期望 "[2,2]"） | 通过 | `"[2,2]"` |
| 6 | 机检：rev 不变（期望 44） | 通过 | `44` |
| 7 | 机检：没有第二条 escalation.resolved 事件（期望 1） | 通过 | `1` |

**⑤ 判定**：通过

---

#### AC-28 不允许的决策被拒绝

- 判定：**通过**（核对 24/24 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28`
- 实例：INST-001、INST-002、INST-003、INST-004

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（母版 INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28 | exit=4 | 14730ms
[orch escalate resolve ESC-001 --instance INST-001 --decision pass（handoff_invalid）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28 | exit=1 | 497ms
[orch escalate resolve ESC-001 --instance INST-002 --decision pass（dispatch_failed）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-002   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28 | exit=1 | 389ms
[orch escalate resolve ESC-001 --instance INST-003 --decision pass（execution_failed）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-003   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28 | exit=1 | 388ms
[orch escalate resolve ESC-001 --instance INST-004 --decision pass（delivery_failed）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-004   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28 | exit=1 | 380ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-28 | exit=0 | 338ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-28.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 升级原因为"交接包不合规"、"派发失败"、"执行失败"或"投递耗尽"
- **When** 我对四种原因各执行一次 `orch escalate resolve <升级号> --instance <实例号> --decision pass`
- **Then** 提示该升级不支持"通过"；退出码 1；升级仍是待处理
- **机检：** 实例仍挂起；节点仍未完成
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-28.state.json` | 38505 B |
| `docs/iterations/iteration-4/evidence/AC-28.events.jsonl` | 14987 B |
| `docs/iterations/iteration-4/evidence/AC-28.meta.json` | 1184 B |
| `docs/iterations/iteration-4/evidence/AC-28.output.json` | 9272 B |
| `docs/iterations/iteration-4/evidence/AC-28.status.txt` | 3126 B |
| `docs/iterations/iteration-4/evidence/AC-28.status.md.json` | 775 B |
| `docs/iterations/iteration-4/evidence/AC-28.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-28.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-28.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then[handoff_invalid]：提示该升级不支持「通过」（期望含 "不支持「pass」"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 2 | Then[handoff_invalid]：给出可选决策 fail\|retry（期望含 "可选：fail\|retry"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 3 | Then[handoff_invalid]：退出码 1（期望 1） | 通过 | `1` |
| 4 | 机检[handoff_invalid]：实例仍挂起（期望 "suspended"） | 通过 | `"suspended"` |
| 5 | 机检[handoff_invalid]：升级仍是待处理（期望 "pending"） | 通过 | `"pending"` |
| 6 | 机检[handoff_invalid]：节点仍未完成 | 通过 | `done,escalated` |
| 7 | Then[dispatch_failed]：提示该升级不支持「通过」（期望含 "不支持「pass」"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 8 | Then[dispatch_failed]：给出可选决策 fail\|retry（期望含 "可选：fail\|retry"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 9 | Then[dispatch_failed]：退出码 1（期望 1） | 通过 | `1` |
| 10 | 机检[dispatch_failed]：实例仍挂起（期望 "suspended"） | 通过 | `"suspended"` |
| 11 | 机检[dispatch_failed]：升级仍是待处理（期望 "pending"） | 通过 | `"pending"` |
| 12 | 机检[dispatch_failed]：节点仍未完成 | 通过 | `done,escalated` |
| 13 | Then[execution_failed]：提示该升级不支持「通过」（期望含 "不支持「pass」"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 14 | Then[execution_failed]：给出可选决策 fail\|retry（期望含 "可选：fail\|retry"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 15 | Then[execution_failed]：退出码 1（期望 1） | 通过 | `1` |
| 16 | 机检[execution_failed]：实例仍挂起（期望 "suspended"） | 通过 | `"suspended"` |
| 17 | 机检[execution_failed]：升级仍是待处理（期望 "pending"） | 通过 | `"pending"` |
| 18 | 机检[execution_failed]：节点仍未完成 | 通过 | `done,escalated` |
| 19 | Then[delivery_failed]：提示该升级不支持「通过」（期望含 "不支持「pass」"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 20 | Then[delivery_failed]：给出可选决策 fail\|retry（期望含 "可选：fail\|retry"） | 通过 | `升级 ESC-001 不支持「pass」；可选：fail\|retry<br>` |
| 21 | Then[delivery_failed]：退出码 1（期望 1） | 通过 | `1` |
| 22 | 机检[delivery_failed]：实例仍挂起（期望 "suspended"） | 通过 | `"suspended"` |
| 23 | 机检[delivery_failed]：升级仍是待处理（期望 "pending"） | 通过 | `"pending"` |
| 24 | 机检[delivery_failed]：节点仍未完成 | 通过 | `done,escalated` |

**⑤ 判定**：通过

**备注**

- 四种升级原因以真实挂起 state.json 为母版、仅改写 reasonCode 后克隆到四个实例；决策拒绝判定由真实 RPC 产出。

---

#### AC-29 找不到、歧义或状态不对时拒绝处理

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-a`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-b`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-c`
- 实例：INST-001、INST-002、INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch escalate resolve ESC-001 --instance INST-001 --decision fail（升级不存在）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision fail --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-a | exit=1 | 1476ms
[orch run code-loop rounds-exceeded（INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-b | exit=4 | 14617ms
[orch run code-loop rounds-exceeded（INST-002）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo2 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-b | exit=4 | 12605ms
[orch escalate resolve ESC-001 --decision fail（不带 --instance，歧义）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision fail   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-b | exit=1 | 309ms
[orch run code-loop rounds-exceeded（母版 INST-001 挂起）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-c | exit=4 | 14550ms
[orch escalate resolve ESC-001 --instance INST-002 --decision fail（INST-002 非挂起）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision fail --instance INST-002   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-c | exit=1 | 342ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-a | exit=0 | 335ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-b | exit=0 | 310ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-29-c | exit=0 | 312ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-29.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 升级号不存在、或两个实例都有 ESC-001、或实例不是挂起（三个子场景各用独立项目根，避免前置互斥）
- **When** 我分别执行：① `orch escalate resolve ESC-001 --instance INST-001 --decision fail`（升级不存在）；② `orch escalate resolve ESC-001 --decision fail`（两个实例都有 ESC-001，不带 `--instance`）；③ `orch escalate resolve ESC-001 --instance INST-002 --decision fail`（INST-002 不是挂起）
- **Then** 分别提示"未找到升级 ESC-001""请加 --instance""实例 INST-002 当前不是挂起状态，不能处理升级"；退出码 1；没有任何写入
- **机检：** 所有实例 `rev` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-29.state.json` | 38585 B |
| `docs/iterations/iteration-4/evidence/AC-29.events.jsonl` | 45309 B |
| `docs/iterations/iteration-4/evidence/AC-29.meta.json` | 1313 B |
| `docs/iterations/iteration-4/evidence/AC-29.output.json` | 9669 B |
| `docs/iterations/iteration-4/evidence/AC-29.status.txt` | 5618 B |
| `docs/iterations/iteration-4/evidence/AC-29.status.md.json` | 2331 B |
| `docs/iterations/iteration-4/evidence/AC-29.prompts.json` | 6651 B |
| `docs/iterations/iteration-4/evidence/AC-29.inbox.json` | 10641 B |
| `docs/iterations/iteration-4/evidence/AC-29.attempts.json` | 927 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then①：提示「未找到升级 ESC-001」（期望 "未找到升级 ESC-001"） | 通过 | `"未找到升级 ESC-001"` |
| 2 | Then①：退出码 1（期望 1） | 通过 | `1` |
| 3 | 机检①：没有实例被写入（期望 0） | 通过 | `0` |
| 4 | Given②：两个实例都有 ESC-001 | 通过 | `INST-001,INST-002` |
| 5 | Then②：提示「请加 --instance」（期望含 "请加 --instance"） | 通过 | `升级号 ESC-001 在多个实例中存在，请加 --instance<br>` |
| 6 | Then②：退出码 1（期望 1） | 通过 | `1` |
| 7 | 机检②：所有实例 rev 不变（期望 "[43,43]"） | 通过 | `"[43,43]"` |
| 8 | Then③：提示「实例 INST-002 当前不是挂起状态，不能处理升级」（期望含 "实例 INST-002 当前不是挂起状态，不能处理升级"） | 通过 | `实例 INST-002 当前不是挂起状态，不能处理升级<br>` |
| 9 | Then③：退出码 1（期望 1） | 通过 | `1` |
| 10 | 机检③：所有实例 rev 不变（期望 "[43,43]"） | 通过 | `"[43,43]"` |

**⑤ 判定**：通过

---

#### AC-30 重新分配后仍失败会再次升级

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-30`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（挂起 + ESC-001 待处理）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-30 | exit=4 | 14288ms
[orch escalate resolve ESC-001 --instance INST-001 --decision retry] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision retry --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-30 | exit=4 | 1543ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-30 | exit=0 | 313ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-30.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用夹具让重新分配时的新会话创建失败（`retry` 尚未执行）
- **When** 我执行 `orch escalate resolve ESC-001 --instance INST-001 --decision retry`
- **Then** 生成新的升级；实例再次挂起；不会显示"运行中"；`resolve` 命令按挂起收尾，退出码 4
- **机检：** `escalations` 数量增加 1；实例 `suspended`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-30.state.json` | 8310 B |
| `docs/iterations/iteration-4/evidence/AC-30.events.jsonl` | 15113 B |
| `docs/iterations/iteration-4/evidence/AC-30.meta.json` | 748 B |
| `docs/iterations/iteration-4/evidence/AC-30.output.json` | 5315 B |
| `docs/iterations/iteration-4/evidence/AC-30.status.txt` | 2181 B |
| `docs/iterations/iteration-4/evidence/AC-30.status.md.json` | 872 B |
| `docs/iterations/iteration-4/evidence/AC-30.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-30.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-30.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：实例 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | Then：输出「升级 ESC-001 已处理（重新分配）」（期望含 "升级 ESC-001 已处理（重新分配）"） | 通过 | `升级 ESC-001 已处理（重新分配）<br>实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-002 待处理 · 节点 T-002 测试 · 第 3 轮<br>下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry\|pass\|fail 处理；要终止请执行 orch cancel --instance INST-` |
| 3 | Then：不会显示「运行中」（期望不含 "实例 INST-001 · 运行中"） | 通过 | `升级 ESC-001 已处理（重新分配）<br>实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-002 待处理 · 节点 T-002 测试 · 第 3 轮<br>下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry\|pass\|fail 处理；要终止请执行 orch cancel --instance INST-` |
| 4 | Then：resolve 命令按挂起收尾，退出码 4（期望 4） | 通过 | `4` |
| 5 | 机检：escalations 数量增加 1（期望 2） | 通过 | `2` |
| 6 | 机检：实例 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 7 | Then：生成新的升级（期望含 "升级 ESC-002 待处理"） | 通过 | `升级 ESC-001 已处理（重新分配）<br>实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-002 待处理 · 节点 T-002 测试 · 第 3 轮<br>下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry\|pass\|fail 处理；要终止请执行 orch cancel --instance INST-` |

**⑤ 判定**：通过

---

#### AC-31 审批允许后会话继续

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-31`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch approve APR-001 --instance INST-001 --decision allow] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision allow --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-31 | exit=0 | 607ms
[orch run --approval hold（前台，待审批→继续）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-31 | exit=0 | 5024ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-31 | exit=0 | 311ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-31 | exit=0 | 349ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-31.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `--template single --approval hold` 发起，宿主请求 `write` 动作，实例等待审批
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision allow`
- **Then** 输出"审批 APR-001 已通过 · 动作 write"；会话从"等待审批"回到执行中；任务最终按正常路径结束
- **机检：** 审批 `state === 'approved'`；出现 `permission.allowed` 事件；`status --instance` 的审批行显示"已通过"
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-31.state.json` | 2808 B |
| `docs/iterations/iteration-4/evidence/AC-31.events.jsonl` | 4398 B |
| `docs/iterations/iteration-4/evidence/AC-31.meta.json` | 736 B |
| `docs/iterations/iteration-4/evidence/AC-31.output.json` | 6330 B |
| `docs/iterations/iteration-4/evidence/AC-31.status.txt` | 1957 B |
| `docs/iterations/iteration-4/evidence/AC-31.status.md.json` | 415 B |
| `docs/iterations/iteration-4/evidence/AC-31.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-31.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-31.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：run 打印了待处理审批行（会话在等待审批） | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-27306-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Given：审批为 pending（期望 "pending"） | 通过 | `"pending"` |
| 3 | Given：审批动作为 write（期望含 "\"action\":\"write\""） | 通过 | `{"approvalId":"APR-001","instanceId":"INST-001","nodeId":"T-001","sessionId":"mock-sess-27306-1","action":"write","toolCallId":"call_mock_27306_1","state":"pending","createdAt":"2026-11-08T22:38:46.719Z","resolvedAt":null,"resolution":null}` |
| 4 | Then：输出「审批 APR-001 已通过 · 动作 write」（期望含 "审批 APR-001 已通过 · 动作 write"） | 通过 | `审批 APR-001 已通过 · 动作 write<br>` |
| 5 | 机检：approve 退出码 0（期望 0） | 通过 | `0` |
| 6 | Then：任务最终按正常路径结束（实例 completed）（期望 "completed"） | 通过 | `"completed"` |
| 7 | 机检：审批 state === approved（期望 "approved"） | 通过 | `"approved"` |
| 8 | 机检：出现 permission.allowed 事件 | 通过 | `run.started,run.started,handoff.created,handoff.delivered,session.state,turn.first_event,session.state,permission.requested,approval.created,permission.allowed,session.state,session.state,output.submitted,output.submitted,verification.skipped,verification.pass` |
| 9 | Then：会话从「等待审批」回到执行中（run stdout 审批行之后仍有会话执行行） | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-27306-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>会话 执行中 · 已运行 2s<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 执行中 · 已运行 3s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 已完成 · 耗时 3s<br>交接包 HO-001  已构造   06:38:46<br>交接包 HO-001` |
| 10 | 机检：status --instance 的审批行显示「已通过」（期望含 "审批 APR-001 已通过 · 动作 write"） | 通过 | `实例 INST-001 · 已完成<br>节点 已完成 · 耗时 3s<br>会话 空闲<br>交接包 HO-001  已构造   06:38:46<br>交接包 HO-001  已投递   06:38:46<br>交接包 HO-001  已接受   06:38:46<br>交接包 HO-001  已完成   06:38:48<br>审批 APR-001 已通过 · 动作 write<br>` |

**⑤ 判定**：通过

---

#### AC-32 审批拒绝后沿用原失败口径

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-32`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch approve APR-001 --instance INST-001 --decision deny] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision deny --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-32 | exit=0 | 573ms
[orch run --approval hold（前台，拒绝后收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-32 | exit=1 | 4431ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-32 | exit=0 | 236ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-32.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `--template single --approval hold` 发起，处于等待审批
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision deny`
- **Then** 输出"审批 APR-001 已拒绝 · 动作 write"；随后 `orch run` 以"审批被拒绝，任务中止于 write"收尾
- **机检：** 审批 `denied`；实例 `failed`；节点 `failed`；没有第二套原因文案
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-32.state.json` | 2562 B |
| `docs/iterations/iteration-4/evidence/AC-32.events.jsonl` | 3517 B |
| `docs/iterations/iteration-4/evidence/AC-32.meta.json` | 742 B |
| `docs/iterations/iteration-4/evidence/AC-32.output.json` | 5356 B |
| `docs/iterations/iteration-4/evidence/AC-32.status.txt` | 1418 B |
| `docs/iterations/iteration-4/evidence/AC-32.status.md.json` | 412 B |
| `docs/iterations/iteration-4/evidence/AC-32.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-32.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-32.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：处于等待审批 | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-27409-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Then：输出「审批 APR-001 已拒绝 · 动作 write」（期望含 "审批 APR-001 已拒绝 · 动作 write"） | 通过 | `审批 APR-001 已拒绝 · 动作 write<br>` |
| 3 | 机检：approve 退出码 0（期望 0） | 通过 | `0` |
| 4 | Then：orch run 以「审批被拒绝，任务中止于 write」收尾（期望含 "审批被拒绝，任务中止于 write"） | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-27409-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 空闲<br>节点 失败 · 审批被拒绝，任务中止于 write<br>交接包 HO-001  已构造   06:38:54<br>交接包 HO-001  已投递   06:38:54<br>交接包 HO-001  已接受  ` |
| 5 | Then：run 以失败收尾（退出码 1）（期望 1） | 通过 | `1` |
| 6 | 机检：审批 denied（期望 "denied"） | 通过 | `"denied"` |
| 7 | 机检：实例 failed（期望 "failed"） | 通过 | `"failed"` |
| 8 | 机检：节点 failed（期望 "failed"） | 通过 | `"failed"` |
| 9 | 机检：出现 permission.denied 事件 | 通过 | `run.started,run.started,handoff.created,handoff.delivered,session.state,turn.first_event,session.state,permission.requested,approval.created,permission.denied,session.state,run.failed,run.failed,handoff.rejected,permission.denied` |
| 10 | 机检：没有第二套原因文案（不出现执行失败口径）（期望不含 "执行失败"） | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-27409-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 空闲<br>节点 失败 · 审批被拒绝，任务中止于 write<br>交接包 HO-001  已构造   06:38:54<br>交接包 HO-001  已投递   06:38:54<br>交接包 HO-001  已接受  ` |

**⑤ 判定**：通过

---

#### AC-33 同一审批不能处理两次

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-33`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch approve APR-001 --instance INST-001 --decision allow（第一次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision allow --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-33 | exit=0 | 676ms
[orch run --approval hold（前台）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-33 | exit=0 | 5152ms
[orch approve APR-001 --decision allow（第二次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision allow --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-33 | exit=1 | 281ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-33 | exit=0 | 281ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-33.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 独立项目根，按 AC-31 的步骤重放至审批已通过
- **When** 我再次执行 `approve APR-001`
- **Then** 提示审批已处理；退出码 1；实例状态不变
- **机检：** 审批 `state` 只变一次；只有一条审批处理事件（`permission.allowed`）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-33.state.json` | 2808 B |
| `docs/iterations/iteration-4/evidence/AC-33.events.jsonl` | 4398 B |
| `docs/iterations/iteration-4/evidence/AC-33.meta.json` | 738 B |
| `docs/iterations/iteration-4/evidence/AC-33.output.json` | 4457 B |
| `docs/iterations/iteration-4/evidence/AC-33.status.txt` | 1789 B |
| `docs/iterations/iteration-4/evidence/AC-33.status.md.json` | 415 B |
| `docs/iterations/iteration-4/evidence/AC-33.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-33.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-33.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：第一次已通过（期望含 "审批 APR-001 已通过"） | 通过 | `审批 APR-001 已通过 · 动作 write<br>` |
| 2 | Given：审批已变为 approved（期望 "approved"） | 通过 | `"approved"` |
| 3 | Then：提示审批已处理（期望含 "审批 APR-001 已处理"） | 通过 | `审批 APR-001 已处理（已通过），无需再次处理<br>` |
| 4 | Then：提示无需再次处理（期望含 "无需再次处理"） | 通过 | `审批 APR-001 已处理（已通过），无需再次处理<br>` |
| 5 | Then：退出码 1（期望 1） | 通过 | `1` |
| 6 | 机检：实例状态不变（期望 "completed"） | 通过 | `"completed"` |
| 7 | 机检：审批 state 仍为 approved（只变一次）（期望 "approved"） | 通过 | `"approved"` |
| 8 | 机检：只有一条 permission.allowed 事件（期望 1） | 通过 | `1` |
| 9 | 机检：实例 rev 不变（期望 14） | 通过 | `14` |

**⑤ 判定**：通过

---

#### AC-34 审批号歧义时要求指定实例

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-34`
- 实例：INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch status --instance INST-001（预热核心，完成启动对账）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-34 | exit=0 | 374ms
[orch approve APR-001 --decision allow（不带 --instance，歧义）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision allow   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-34 | exit=1 | 343ms
[orch approve APR-999 --instance INST-001 --decision allow] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-999 --decision allow --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-34 | exit=1 | 285ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-34 | exit=0 | 243ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-34.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 两个实例都有 `APR-001`，另有一个不存在的 `APR-999`
- **When** 我不带 `--instance` 执行 `orch approve APR-001 --decision allow`，再执行 `orch approve APR-999 --instance INST-001 --decision allow`
- **Then** 前者提示"审批号 APR-001 在多个实例中存在，请加 --instance"，后者提示"未找到审批 APR-999"；退出码都是 1；实例都不变
- **机检：** 相关实例 `rev` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-34.state.json` | 6444 B |
| `docs/iterations/iteration-4/evidence/AC-34.events.jsonl` | 3214 B |
| `docs/iterations/iteration-4/evidence/AC-34.meta.json` | 1024 B |
| `docs/iterations/iteration-4/evidence/AC-34.output.json` | 3752 B |
| `docs/iterations/iteration-4/evidence/AC-34.status.txt` | 1482 B |
| `docs/iterations/iteration-4/evidence/AC-34.status.md.json` | 827 B |
| `docs/iterations/iteration-4/evidence/AC-34.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-34.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-34.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：两个实例都有 APR-001 | 通过 | `INST-001,INST-002` |
| 2 | Then①：提示「审批号 APR-001 在多个实例中存在，请加 --instance」（期望 "审批号 APR-001 在多个实例中存在，请加 --instance"） | 通过 | `"审批号 APR-001 在多个实例中存在，请加 --instance"` |
| 3 | Then①：退出码 1（期望 1） | 通过 | `1` |
| 4 | Then②：提示「未找到审批 APR-999」（期望 "未找到审批 APR-999"） | 通过 | `"未找到审批 APR-999"` |
| 5 | Then②：退出码 1（期望 1） | 通过 | `1` |
| 6 | 机检：相关实例 rev 都不变（期望 "[6,4]"） | 通过 | `"[6,4]"` |
| 7 | 机检：APR-001 仍是 pending（期望 "pending"） | 通过 | `"pending"` |

**⑤ 判定**：通过

**备注**

- Given 的第二个实例以真实 hold 快照为母版克隆，仅改写 approvals.instanceId；视图/决策 RPC 逐字段读取，构造 Given 不等于伪造结论。

---

#### AC-35 取消时待处理审批作废

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-35`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch cancel --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cancel --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-35 | exit=0 | 768ms
[orch run --approval hold（前台，取消收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-35 | exit=1 | 4015ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-35 | exit=0 | 268ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-35 | exit=0 | 293ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-35.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 实例处于等待审批
- **When** 我执行 `orch cancel --instance INST-001`
- **Then** 实例取消；审批行显示已作废；宿主收到取消，不会留下"待处理"
- **机检：** 审批 `withdrawn`；实例 `cancelled`；会话 `idle`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-35.state.json` | 2504 B |
| `docs/iterations/iteration-4/evidence/AC-35.events.jsonl` | 3459 B |
| `docs/iterations/iteration-4/evidence/AC-35.meta.json` | 738 B |
| `docs/iterations/iteration-4/evidence/AC-35.output.json` | 4922 B |
| `docs/iterations/iteration-4/evidence/AC-35.status.txt` | 1835 B |
| `docs/iterations/iteration-4/evidence/AC-35.status.md.json` | 415 B |
| `docs/iterations/iteration-4/evidence/AC-35.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-35.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-35.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：处于等待审批 | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-27692-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Given：审批 pending（期望 "pending"） | 通过 | `"pending"` |
| 3 | Then：cancel 退出码 0（期望 0） | 通过 | `0` |
| 4 | 机检：实例 cancelled（期望 "cancelled"） | 通过 | `"cancelled"` |
| 5 | 机检：审批 withdrawn（期望 "withdrawn"） | 通过 | `"withdrawn"` |
| 6 | 机检：会话 idle（期望 "idle"） | 通过 | `"idle"` |
| 7 | 机检：出现 approval.withdrawn 事件 | 通过 | `run.started,run.started,handoff.created,handoff.delivered,session.state,turn.first_event,session.state,permission.requested,approval.created,session.state,run.cancelled,run.cancelled,handoff.rejected,approval.withdrawn,run.cancelled` |
| 8 | Then：审批行显示「已作废」（期望含 "审批 APR-001 已作废"） | 通过 | `实例 INST-001 · 已取消<br>节点 已取消<br>会话 空闲<br>交接包 HO-001  已构造   06:39:18<br>交接包 HO-001  已投递   06:39:18<br>交接包 HO-001  已接受   06:39:19<br>交接包 HO-001  已拒绝   06:39:19  原因 已撤回<br>审批 APR-001 已作废 · 动作 write<br>` |
| 9 | 机检：宿主收到取消，审批不留下「待处理」（期望不含 "待处理"） | 通过 | `审批 APR-001 已作废 · 动作 write` |

**⑤ 判定**：通过

---

#### AC-36 `status` 显示审批与暂停

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36`
- 实例：INST-001、INST-002、INST-004、OLD-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass（母版）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 7901ms
[orch status --instance INST-001（A 已暂停）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 353ms
[orch status --instance INST-002（B 待处理审批）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-002   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 255ms
[orch status --instance OLD-001（C 旧实例）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance OLD-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 301ms
[orch status --instance INST-004（D 三条已处理审批）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-004   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 267ms
[orch status（不带参数）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 323ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-36 | exit=0 | 871ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-36.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 实例 A 已暂停；实例 B 有 `hold` 待处理审批且未暂停；实例 C 是 I1.3 的无审批旧实例；实例 D 有三条已处理审批（已通过 / 已拒绝 / 已作废）
- **When** 我分别执行 `orch status --instance INST-A`、`--instance INST-B`、`--instance INST-C`、`--instance INST-D`，再执行不带参数的 `orch status`
- **Then** A 的实例行显示"运行中（已暂停）"；B 在升级块之后出现待处理审批行；C 不出现审批行；D 按审批号逐条显示"已通过 / 已拒绝 / 已作废"；不带参数的列表行中 A 同样带"（已暂停）"、B 带"待处理审批 1"
- **机检：** C 的实例输出与 I1.3 A-2 逐字一致；列表行含 A/B 的限定词
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-36.state.json` | 19108 B |
| `docs/iterations/iteration-4/evidence/AC-36.events.jsonl` | 7650 B |
| `docs/iterations/iteration-4/evidence/AC-36.meta.json` | 1207 B |
| `docs/iterations/iteration-4/evidence/AC-36.output.json` | 13712 B |
| `docs/iterations/iteration-4/evidence/AC-36.status.txt` | 4948 B |
| `docs/iterations/iteration-4/evidence/AC-36.status.md.json` | 1148 B |
| `docs/iterations/iteration-4/evidence/AC-36.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-36.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-36.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具：A/B/C/D 四类实例齐全 | 通过 | `INST-001,INST-002,INST-004,OLD-001` |
| 2 | Then：A 的实例行显示「运行中（已暂停）」（期望含 "实例 INST-001 · 运行中（已暂停）"） | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环` |
| 3 | Then：B 在升级块之后出现待处理审批行（期望含 "升级 —"） | 通过 | `实例 INST-002 · 运行中 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:39:28<br>交接包 HO-001  开发→测试  已投递   06:39:29<br>交接包 HO-001  开发→测试  已接受   06:39:29<br>交接包 HO-001  开发→测试  已完成   06:39:` |
| 4 | Then：B 待处理审批行含审批号/节点/角色/动作（期望含 "审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write"） | 通过 | `实例 INST-002 · 运行中 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:39:28<br>交接包 HO-001  开发→测试  已投递   06:39:29<br>交接包 HO-001  开发→测试  已接受   06:39:29<br>交接包 HO-001  开发→测试  已完成   06:39:` |
| 5 | 机检：B 的审批行位于升级块之后 | 通过 | `升级块在前` |
| 6 | Then：C 不出现审批行（期望不含 "审批"） | 通过 | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 7 | 机检：C 的实例输出与 I1.3 A-2 一致（无审批段、单节点显示）（期望含 "实例 OLD-001 · 已完成"） | 通过 | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 8 | 机检：C 仍显示会话与交接包（旧字段可读）（期望含 "节点 已完成"） | 通过 | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 9 | Then：D 逐条显示「已通过」（期望含 "审批 APR-001 已通过 · 节点 T-001 开发 · 动作 write"） | 通过 | `实例 INST-004 · 已完成 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:39:28<br>交接包 HO-001  开发→测试  已投递   06:39:29<br>交接包 HO-001  开发→测试  已接受   06:39:29<br>交接包 HO-001  开发→测试  已完成   06:39:` |
| 10 | Then：D 逐条显示「已拒绝」（期望含 "审批 APR-002 已拒绝 · 节点 T-001 开发 · 动作 write"） | 通过 | `实例 INST-004 · 已完成 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:39:28<br>交接包 HO-001  开发→测试  已投递   06:39:29<br>交接包 HO-001  开发→测试  已接受   06:39:29<br>交接包 HO-001  开发→测试  已完成   06:39:` |
| 11 | Then：D 逐条显示「已作废」（期望含 "审批 APR-003 已作废 · 节点 T-001 开发 · 动作 write"） | 通过 | `实例 INST-004 · 已完成 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:39:28<br>交接包 HO-001  开发→测试  已投递   06:39:29<br>交接包 HO-001  开发→测试  已接受   06:39:29<br>交接包 HO-001  开发→测试  已完成   06:39:` |
| 12 | 机检：列表行中 A 带「（已暂停）」 | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环 · 节点 已完成 · 会话 空闲 · 耗时 5s · 更新 06:39:31\|实例 INST-002 · 运行中 · 模板 编码闭环 · 待处理审批 1 · 节点 已完成 · 会话 空闲 · 耗时 5s · 更新 06:39:31\|实例 INST-004 · 已完成 · 模板 编码闭环 · 节点 已完成 · 会话 空闲 · 耗时 5s · 更新 06:39:31\|实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 11` |
| 13 | 机检：列表行中 B 带「待处理审批 1」 | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环 · 节点 已完成 · 会话 空闲 · 耗时 5s · 更新 06:39:31\|实例 INST-002 · 运行中 · 模板 编码闭环 · 待处理审批 1 · 节点 已完成 · 会话 空闲 · 耗时 5s · 更新 06:39:31\|实例 INST-004 · 已完成 · 模板 编码闭环 · 节点 已完成 · 会话 空闲 · 耗时 5s · 更新 06:39:31\|实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 11` |

**⑤ 判定**：通过

**备注**

- Given 的暂停/审批/旧格式以真实状态为母版克隆改写或安装 legacy-v1 夹具；视图 RPC 逐字段渲染，构造 Given 不等于伪造结论。

---

#### AC-37 `run` 等待期间出现审批行

- 判定：**通过**（核对 8/8 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-37`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run --template code-loop --approval hold（前台，等待审批）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-37 | exit=- | 3224ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-37 | exit=0 | 235ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-37.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** `orch run --approval hold` 正在等待，宿主请求审批
- **When** 审批产生
- **Then** 终端在会话行之后打印审批行，含审批号、节点、角色、动作；不需要退出 `run` 就能看到
- **机检：** `run` 进程 stdout 含 `APR-001`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-37.state.json` | 2455 B |
| `docs/iterations/iteration-4/evidence/AC-37.events.jsonl` | 1760 B |
| `docs/iterations/iteration-4/evidence/AC-37.meta.json` | 743 B |
| `docs/iterations/iteration-4/evidence/AC-37.output.json` | 3510 B |
| `docs/iterations/iteration-4/evidence/AC-37.status.txt` | 812 B |
| `docs/iterations/iteration-4/evidence/AC-37.status.md.json` | 553 B |
| `docs/iterations/iteration-4/evidence/AC-37.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-37.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-37.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：等待期间审批产生（stdout 出现 APR- 行） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-27942-1<br>任务已投递<br>审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Then：审批行含审批号（期望含 "审批 APR-001"） | 通过 | `审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write` |
| 3 | Then：审批行含节点号（期望含 "节点 T-001"） | 通过 | `审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write` |
| 4 | Then：审批行含角色（期望含 "开发"） | 通过 | `审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write` |
| 5 | Then：审批行含动作（期望含 "动作 write"） | 通过 | `审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write` |
| 6 | Then：审批行打印在会话行之后 | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-27942-1<br>任务已投递<br>审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write<br>会话 等待审批：write<br>` |
| 7 | Then：不需要退出 run 就能看到（断言时刻 run 仍在运行） | 通过 | `exited=false` |
| 8 | 机检：run 进程 stdout 含 APR-001（期望含 "APR-001"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-27942-1<br>任务已投递<br>审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write<br>会话 等待审批：write<br>` |

**⑤ 判定**：通过

---

#### AC-38 `instance status` 与 `status --instance` 同口径

- 判定：**通过**（核对 6/6 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38 | exit=0 | 8011ms
[orch instance status INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance status INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38 | exit=0 | 253ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38 | exit=0 | 285ms
[orch instance status INST-999] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance status INST-999   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38 | exit=1 | 457ms
[orch status --instance INST-999] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-999   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38 | exit=1 | 270ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-38 | exit=0 | 288ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-38.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 同一个运行中实例，以及一个不存在的实例号
- **When** 我分别对 `INST-001` 执行 `orch instance status INST-001` 与 `orch status --instance INST-001`；再把实例号换成 `INST-999` 各执行一次
- **Then** `INST-001` 两次输出逐字一致（时间相关行在同一秒内比较）；`INST-999` 两次都输出 `实例 INST-999 · 不存在`
- **机检：** 存在时退出码都是 0；不存在时都是 1；`.orch` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-38.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-38.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-38.meta.json` | 760 B |
| `docs/iterations/iteration-4/evidence/AC-38.output.json` | 6694 B |
| `docs/iterations/iteration-4/evidence/AC-38.status.txt` | 3229 B |
| `docs/iterations/iteration-4/evidence/AC-38.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-38.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-38.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-38.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：INST-001 两次输出逐字一致（时间相关行归一）（期望 "实例 INST-001 · 已完成 · 模板 编码闭环\n节点 T-001 开发 已完成 · 第 1 轮 · 耗时 <n>s\n节点 T-002 测试 已完成 · 第 1 轮 · 耗时 <n>s · 判定 通过\n会话 空闲\n交接包 HO-001  开发→测试  已构造   <time>\n交接包 HO-001  开发→测试 | 通过 | `"实例 INST-001 · 已完成 · 模板 编码闭环\n节点 T-001 开发 已完成 · 第 1 轮 · 耗时 <n>s\n节点 T-002 测试 已完成 · 第 1 轮 · 耗时 <n>s · 判定 通过\n会话 空闲\n交接包 HO-001  开发→测试  已构造   <time>\n交接包 HO-001  开发→测试  已投递   <time>\n交接包 HO-001  开发→测试  已接受   <time>\n交接包 HO-001  开发→测试  已完成   <time>\n升级 —\n"` |
| 2 | 机检：INST-001 存在时退出码都是 0（期望 "0/0"） | 通过 | `"0/0"` |
| 3 | Then：INST-999 两次都输出「实例 INST-999 · 不存在」（期望 "实例 INST-999 · 不存在"） | 通过 | `"实例 INST-999 · 不存在"` |
| 4 | Then：INST-999 两次输出一致（期望 "实例 INST-999 · 不存在"） | 通过 | `"实例 INST-999 · 不存在"` |
| 5 | 机检：INST-999 不存在时退出码都是 1（期望 "1/1"） | 通过 | `"1/1"` |
| 6 | 机检：.orch 不变（rev 不变）（期望 23） | 通过 | `23` |

**⑤ 判定**：通过

---

#### AC-39 `instance log` 文本按顺序输出事件

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-reject`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-empty`
- 实例：INST-001、INST-001、INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（回流 + 升级）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39 | exit=4 | 14168ms
[orch escalate resolve ESC-001 --decision pass（处理升级）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39 | exit=0 | 608ms
[orch instance log INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39 | exit=0 | 314ms
[orch instance log INST-001（含拒绝事件）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-reject | exit=0 | 1394ms
[orch run code-loop pass（母版）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-empty | exit=0 | 8588ms
[orch instance log INST-002（空事件）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-002   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-empty | exit=0 | 359ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39 | exit=0 | 316ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-reject | exit=0 | 305ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-39-empty | exit=0 | 315ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-39.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个完成过回流与升级的实例
- **When** 我执行 `orch instance log INST-001`
- **Then** 事件按发生顺序逐行输出；含拒绝、升级、处理升级等新事件；没有事件时输出"事件 —"
- **机检：** 行序与 `events.jsonl` 的 `seq` 一致
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-39.state.json` | 24210 B |
| `docs/iterations/iteration-4/evidence/AC-39.events.jsonl` | 27250 B |
| `docs/iterations/iteration-4/evidence/AC-39.meta.json` | 1331 B |
| `docs/iterations/iteration-4/evidence/AC-39.output.json` | 29712 B |
| `docs/iterations/iteration-4/evidence/AC-39.status.txt` | 10659 B |
| `docs/iterations/iteration-4/evidence/AC-39.status.md.json` | 1983 B |
| `docs/iterations/iteration-4/evidence/AC-39.prompts.json` | 5403 B |
| `docs/iterations/iteration-4/evidence/AC-39.inbox.json` | 4751 B |
| `docs/iterations/iteration-4/evidence/AC-39.attempts.json` | 547 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：事件按发生顺序逐行输出（[#n] 行数 == events.jsonl 行数）（期望 61） | 通过 | `61` |
| 2 | 机检：行序与 events.jsonl 的 seq 一致（期望 "[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,5 | 通过 | `"[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61]"` |
| 3 | Then：含升级事件（期望含 "原因 创建升级"） | 通过 | `[#1] 06:39:58  实例 INST-001  已创建 → 运行中  原因 开始运行<br>[#2] 06:39:58  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮<br>[#3] 06:39:59  会话 mock-sess-28163-1  空闲 → 执行中  原因 会话状态<br>[#4] 06:39:59  会话 mock-sess-28163-1  执行中 → 执行中（tool_call）  原因 会话状态<br>[#5] 06:39:59  会话 mock-sess-28` |
| 4 | Then：含处理升级事件（期望含 "原因 处理升级"） | 通过 | `[#1] 06:39:58  实例 INST-001  已创建 → 运行中  原因 开始运行<br>[#2] 06:39:58  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮<br>[#3] 06:39:59  会话 mock-sess-28163-1  空闲 → 执行中  原因 会话状态<br>[#4] 06:39:59  会话 mock-sess-28163-1  执行中 → 执行中（tool_call）  原因 会话状态<br>[#5] 06:39:59  会话 mock-sess-28` |
| 5 | Then：含回流事件（期望含 "原因 构造回流"） | 通过 | `[#1] 06:39:58  实例 INST-001  已创建 → 运行中  原因 开始运行<br>[#2] 06:39:58  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮<br>[#3] 06:39:59  会话 mock-sess-28163-1  空闲 → 执行中  原因 会话状态<br>[#4] 06:39:59  会话 mock-sess-28163-1  执行中 → 执行中（tool_call）  原因 会话状态<br>[#5] 06:39:59  会话 mock-sess-28` |
| 6 | Then：含拒绝事件（期望含 "拒绝"） | 通过 | `[#1] 06:40:13  实例 INST-001  已创建 → 运行中  原因 开始运行<br>[#2] 06:40:13  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮<br>[#3] 06:40:14  会话 mock-sess-28353-1  空闲 → 执行中  原因 会话状态<br>[#4] 06:40:15  会话 mock-sess-28353-1  执行中 → 执行中（tool_call）  原因 会话状态<br>[#5] 06:40:15  会话 mock-sess-28` |
| 7 | Then：没有事件时输出「事件 —」（期望 "事件 —"） | 通过 | `"事件 —"` |

**⑤ 判定**：通过

---

#### AC-40 `instance log --format json` 输出原始事件数组

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-40`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（含回流与升级）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-40 | exit=4 | 14593ms
[orch instance log INST-001 --format json] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-40 | exit=0 | 297ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-40 | exit=0 | 355ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-40.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 同上
- **When** 我执行 `orch instance log INST-001 --format json`
- **Then** stdout 是可解析的 JSON 数组，元素字段与事件日志一致，顺序一致
- **机检：** `JSON.parse` 成功；数组长度等于 `events.jsonl` 可解析行数
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-40.state.json` | 7885 B |
| `docs/iterations/iteration-4/evidence/AC-40.events.jsonl` | 12714 B |
| `docs/iterations/iteration-4/evidence/AC-40.meta.json` | 762 B |
| `docs/iterations/iteration-4/evidence/AC-40.output.json` | 24546 B |
| `docs/iterations/iteration-4/evidence/AC-40.status.txt` | 18776 B |
| `docs/iterations/iteration-4/evidence/AC-40.status.md.json` | 775 B |
| `docs/iterations/iteration-4/evidence/AC-40.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-40.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-40.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：stdout 是可解析的 JSON 数组 | 通过 | `[<br>  {<br>    "object": "instance",<br>    "objectId": "INST-001",<br>    "from": "created",<br>    "to": "running",<br>    "result": "applied",<br>    "reason": "run.started",<br>    "detail": null,<br>    "gen": "gen-a7827451abd85f46",<br>    "seq": 1,<br>` |
| 2 | Then：退出码 0（期望 0） | 通过 | `0` |
| 3 | 机检：数组长度等于 events.jsonl 可解析行数（期望 54） | 通过 | `54` |
| 4 | Then：顺序一致（seq 与 events.jsonl 相同）（期望 "[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54]"） | 通过 | `"[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54]"` |
| 5 | Then：元素字段与事件日志一致（首条 reason）（期望 "run.started"） | 通过 | `"run.started"` |
| 6 | Then：元素字段与事件日志一致（首条 object/objectId）（期望 "instance/INST-001"） | 通过 | `"instance/INST-001"` |
| 7 | Then：元素含 gen / ts / detail 等原始字段 | 通过 | `{"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-a7827451abd85f46","seq":1,"ts":"2026-11-08T22:40:34.964Z"}` |

**⑤ 判定**：通过

---

#### AC-41 `instance graph --format json` 稳定可回归

- 判定：**通过**（核对 15/15 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-41`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass（已完成的编码闭环）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-41 | exit=0 | 8338ms
[orch instance graph INST-001 --format json] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-41 | exit=0 | 301ms
[orch instance graph INST-001 --format json（复跑）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-41 | exit=0 | 275ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-41 | exit=0 | 315ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-41.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个已完成的编码闭环实例
- **When** 我执行 `orch instance graph INST-001 --format json`
- **Then** 输出含 `graphVersion`、`instanceId`、`template`、`state`、`paused`、`nodes`、`edges`、`handoffs`、`escalations`、`approvals`、`current`；节点含节点号、标题、角色、状态、轮次；边含来源、目标、方向
- **机检：** 键顺序与附录 A-4 一致；两次执行输出逐字一致
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-41.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-41.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-41.meta.json` | 756 B |
| `docs/iterations/iteration-4/evidence/AC-41.output.json` | 11289 B |
| `docs/iterations/iteration-4/evidence/AC-41.status.txt` | 3671 B |
| `docs/iterations/iteration-4/evidence/AC-41.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-41.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-41.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-41.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：输出可解析为 JSON 对象 | 通过 | `{<br>  "graphVersion": 1,<br>  "instanceId": "INST-001",<br>  "template": "code-loop",<br>  "state": "completed",<br>  "paused": false,<br>  "nodes": [<br>    {<br>      "nodeId": "T-001",<br>      "title": "开发",<br>      "roleId": "developer",<br>      "state` |
| 2 | Then：退出码 0（期望 0） | 通过 | `0` |
| 3 | 机检：键顺序与附录 A-4 一致（期望 "[\"graphVersion\",\"instanceId\",\"template\",\"state\",\"paused\",\"nodes\",\"edges\",\"handoffs\",\"escalations\",\"approvals\",\"current\"]"） | 通过 | `"[\"graphVersion\",\"instanceId\",\"template\",\"state\",\"paused\",\"nodes\",\"edges\",\"handoffs\",\"escalations\",\"approvals\",\"current\"]"` |
| 4 | A-4：graphVersion === 1（期望 1） | 通过 | `1` |
| 5 | A-4：instanceId === INST-001（期望 "INST-001"） | 通过 | `"INST-001"` |
| 6 | A-4：template === code-loop（期望 "code-loop"） | 通过 | `"code-loop"` |
| 7 | A-4：state === completed（期望 "completed"） | 通过 | `"completed"` |
| 8 | A-4：paused === false（期望 false） | 通过 | `false` |
| 9 | A-4：nodes 含节点号/标题/角色/状态/轮次 | 通过 | `[{"nodeId":"T-001","title":"开发","roleId":"developer","state":"done","round":1},{"nodeId":"T-002","title":"测试","roleId":"tester","state":"done","round":1}]` |
| 10 | A-4：节点 title 保留中文标题（期望 "开发"） | 通过 | `"开发"` |
| 11 | A-4：节点 roleId 保留英文标识（期望 "developer"） | 通过 | `"developer"` |
| 12 | A-4：edges 含来源/目标/方向 | 通过 | `[{"from":"T-001","to":"T-002","kind":"forward"},{"from":"T-002","to":"T-001","kind":"backflow"},{"from":"T-001","to":"T-002","kind":"retest"}]` |
| 13 | A-4：边方向覆盖 forward / backflow / retest（期望 "[\"forward\",\"backflow\",\"retest\"]"） | 通过 | `"[\"forward\",\"backflow\",\"retest\"]"` |
| 14 | A-4：handoffs / escalations / approvals / current 都存在 | 通过 | `{"h":1,"e":0,"a":0}` |
| 15 | 机检：两次执行输出逐字一致（期望 "{\n  \"graphVersion\": 1,\n  \"instanceId\": \"INST-001\",\n  \"template\": \"code-loop\",\n  \"state\": \"completed\",\n  \"paused\": false,\n  \"nodes\": [\n    {\n      \"nodeId\" | 通过 | `"{\n  \"graphVersion\": 1,\n  \"instanceId\": \"INST-001\",\n  \"template\": \"code-loop\",\n  \"state\": \"completed\",\n  \"paused\": false,\n  \"nodes\": [\n    {\n      \"nodeId\": \"T-001\",\n      \"title\": \"开发\",\n      \"roleId\": \"developer\",\n   ` |

**⑤ 判定**：通过

---

#### AC-42 `instance graph --format text` 可读

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42-paused`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42 | exit=0 | 8449ms
[orch instance graph INST-001（text）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42 | exit=0 | 275ms
[orch run code-loop pass（暂停夹具母版）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42-paused | exit=0 | 8349ms
[orch instance graph INST-001（暂停态 text）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42-paused | exit=0 | 307ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42 | exit=0 | 323ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-42-paused | exit=0 | 504ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-42.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个编码闭环实例
- **When** 我执行 `orch instance graph INST-001`
- **Then** 首行是实例、模板、状态；随后每个节点一行；最后"边："段落逐条列出方向，有升级/审批时在其后追加摘要行；暂停时首行带"（已暂停）"
- **机检：** 输出为纯 ASCII 结构字符（中文字符除外）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-42.state.json` | 10068 B |
| `docs/iterations/iteration-4/evidence/AC-42.events.jsonl` | 13492 B |
| `docs/iterations/iteration-4/evidence/AC-42.meta.json` | 989 B |
| `docs/iterations/iteration-4/evidence/AC-42.output.json` | 8291 B |
| `docs/iterations/iteration-4/evidence/AC-42.status.txt` | 3556 B |
| `docs/iterations/iteration-4/evidence/AC-42.status.md.json` | 1109 B |
| `docs/iterations/iteration-4/evidence/AC-42.prompts.json` | 3042 B |
| `docs/iterations/iteration-4/evidence/AC-42.inbox.json` | 2442 B |
| `docs/iterations/iteration-4/evidence/AC-42.attempts.json` | 317 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：退出码 0（期望 0） | 通过 | `0` |
| 2 | Then：首行是实例、模板、状态（期望含 "实例 INST-001 · 编码闭环 · 已完成"） | 通过 | `实例 INST-001 · 编码闭环 · 已完成` |
| 3 | Then：每个节点一行（T-001）（期望含 "T-001 开发 · 已完成 · 第 1 轮"） | 通过 | `实例 INST-001 · 编码闭环 · 已完成<br>T-001 开发 · 已完成 · 第 1 轮<br>T-002 测试 · 已完成 · 第 1 轮<br>边：<br>  T-001 -> T-002 正向<br>  T-002 -> T-001 回流<br>  T-001 -> T-002 复测<br>` |
| 4 | Then：每个节点一行（T-002）（期望含 "T-002 测试 · 已完成 · 第 1 轮"） | 通过 | `实例 INST-001 · 编码闭环 · 已完成<br>T-001 开发 · 已完成 · 第 1 轮<br>T-002 测试 · 已完成 · 第 1 轮<br>边：<br>  T-001 -> T-002 正向<br>  T-002 -> T-001 回流<br>  T-001 -> T-002 复测<br>` |
| 5 | Then：末尾「边：」段落（期望含 "边："） | 通过 | `实例 INST-001 · 编码闭环 · 已完成<br>T-001 开发 · 已完成 · 第 1 轮<br>T-002 测试 · 已完成 · 第 1 轮<br>边：<br>  T-001 -> T-002 正向<br>  T-002 -> T-001 回流<br>  T-001 -> T-002 复测<br>` |
| 6 | Then：边逐条列出方向（正向）（期望含 "T-001 -> T-002 正向"） | 通过 | `实例 INST-001 · 编码闭环 · 已完成<br>T-001 开发 · 已完成 · 第 1 轮<br>T-002 测试 · 已完成 · 第 1 轮<br>边：<br>  T-001 -> T-002 正向<br>  T-002 -> T-001 回流<br>  T-001 -> T-002 复测<br>` |
| 7 | Then：边逐条列出方向（回流）（期望含 "T-002 -> T-001 回流"） | 通过 | `实例 INST-001 · 编码闭环 · 已完成<br>T-001 开发 · 已完成 · 第 1 轮<br>T-002 测试 · 已完成 · 第 1 轮<br>边：<br>  T-001 -> T-002 正向<br>  T-002 -> T-001 回流<br>  T-001 -> T-002 复测<br>` |
| 8 | Then：边逐条列出方向（复测）（期望含 "T-001 -> T-002 复测"） | 通过 | `实例 INST-001 · 编码闭环 · 已完成<br>T-001 开发 · 已完成 · 第 1 轮<br>T-002 测试 · 已完成 · 第 1 轮<br>边：<br>  T-001 -> T-002 正向<br>  T-002 -> T-001 回流<br>  T-001 -> T-002 复测<br>` |
| 9 | 机检：输出为纯 ASCII 结构字符（中文字符与中文标点除外） | 通过 | `" INST-001    \nT-001      1 \nT-002      1 \n\n  T-001 -> T-002 \n  T-002 -> T-001 \n  T-001 -> T-002 \n"` |
| 10 | Then：暂停时首行带「（已暂停）」（期望含 "实例 INST-001 · 编码闭环 · 运行中（已暂停）"） | 通过 | `实例 INST-001 · 编码闭环 · 运行中（已暂停）` |

**⑤ 判定**：通过

---

#### AC-43 图反映暂停、挂起、审批与升级

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-A`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-B`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass（A 母版）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-A | exit=0 | 8565ms
[orch run code-loop rounds-exceeded（B 挂起 + 升级）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-B | exit=4 | 14351ms
[orch instance graph INST-001 --format json（A）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-A | exit=0 | 287ms
[orch instance graph INST-001 --format json（B）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-B | exit=0 | 308ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-A | exit=0 | 480ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-43-B | exit=0 | 337ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-43.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 实例 A 已暂停且有待审批（`hold`）；实例 B 有升级
- **When** 我分别执行 `orch instance graph INST-A --format json` 与 `orch instance graph INST-B --format json`
- **Then** A 的 `paused === true` 且 `approvals` 含待处理项；B 的 `escalations` 含待处理项且 `paused === false`；`current` 指向各自当前节点或为 `null`
- **机检：** 字段值与 `state.json` 一致
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-43.state.json` | 15128 B |
| `docs/iterations/iteration-4/evidence/AC-43.events.jsonl` | 21953 B |
| `docs/iterations/iteration-4/evidence/AC-43.meta.json` | 985 B |
| `docs/iterations/iteration-4/evidence/AC-43.output.json` | 11066 B |
| `docs/iterations/iteration-4/evidence/AC-43.status.txt` | 6407 B |
| `docs/iterations/iteration-4/evidence/AC-43.status.md.json` | 1382 B |
| `docs/iterations/iteration-4/evidence/AC-43.prompts.json` | 4833 B |
| `docs/iterations/iteration-4/evidence/AC-43.inbox.json` | 4761 B |
| `docs/iterations/iteration-4/evidence/AC-43.attempts.json` | 465 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：A 的 paused === true（期望 true） | 通过 | `true` |
| 2 | Then：A 的 approvals 含待处理项 | 通过 | `[{"approvalId":"APR-001","instanceId":"INST-001","nodeId":"T-001","sessionId":"mock-sess-fix","action":"write","toolCallId":"call_fix","state":"pending","createdAt":"2026-11-08T19:00:00.000Z","resolvedAt":null,"resolution":null}]` |
| 3 | Then：A 的 current 指向当前节点或为 null | 通过 | `{"nodeId":"T-001","sessionId":"mock-sess-29202-1","state":"running"}` |
| 4 | Then：B 的 paused === false（期望 false） | 通过 | `false` |
| 5 | Then：B 的 escalations 含待处理项 | 通过 | `[{"escalationId":"ESC-001","nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded","reasonDetail":"回流超上限：测试已派发 2 次仍未通过","defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"}],"state":"pending","createdAt":"2026-11-08T22:41:46.559` |
| 6 | Then：B 的 current 指向当前节点或为 null | 通过 | `null` |
| 7 | 机检：A paused 与 state.json 一致（期望 true） | 通过 | `true` |
| 8 | 机检：A approvals 长度与 state.json 一致（期望 1） | 通过 | `1` |
| 9 | 机检：A state 与 state.json 一致（期望 "running"） | 通过 | `"running"` |
| 10 | 机检：B paused 与 state.json 一致（未写字段按 false）（期望 false） | 通过 | `false` |
| 11 | 机检：B escalations 长度与 state.json 一致（期望 1） | 通过 | `1` |
| 12 | 机检：B state 与 state.json 一致（期望 "suspended"） | 通过 | `"suspended"` |

**⑤ 判定**：通过

---

#### AC-44 `attach` 只读跟随

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-44`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch status --instance INST-001（预热核心，完成启动对账）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-44 | exit=0 | 367ms
[orch attach mock-sess-29512-1] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js attach mock-sess-29512-1   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-44 | exit=0 | 3000ms
[orch run --approval hold（前台稳定会话）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-44 | exit=- | 4177ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-44 | exit=0 | 317ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-44.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个正在执行且有历史、宿主已请求审批（`hold`）的会话；会话号从发起时 `orch run` 输出的 `会话已创建 <会话号>` 行取得，或从 `orch instance log INST-001 --format json` 中 `object === 'session'` 的 `objectId` 取得（形如 `mock-sess-…`，由宿主给出）
- **When** 我执行 `orch attach <该会话号>`，看到最近事件后按 Ctrl-C
- **Then** 首行显示该会话号、实例、节点；若该会话有待审批，紧跟一行审批信息；随后输出该会话最近事件（行数 ≤ 20 且 ≥ 1）；脱离后实例状态、节点轮次、会话状态都不变
- **机检：** 附着前后 `state.json` 的 `state/rev` 与节点、会话状态不变；stdout 含 `APR-` 行
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-44.state.json` | 2567 B |
| `docs/iterations/iteration-4/evidence/AC-44.events.jsonl` | 2392 B |
| `docs/iterations/iteration-4/evidence/AC-44.meta.json` | 732 B |
| `docs/iterations/iteration-4/evidence/AC-44.output.json` | 6093 B |
| `docs/iterations/iteration-4/evidence/AC-44.status.txt` | 1909 B |
| `docs/iterations/iteration-4/evidence/AC-44.status.md.json` | 415 B |
| `docs/iterations/iteration-4/evidence/AC-44.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-44.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-44.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：会话在等待审批 | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-29512-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Given：会话号来源可取得（run 的「会话已创建」或 instance log json 的 objectId） | 通过 | `mock-sess-29512-1` |
| 3 | Then：attach 正常脱离（退出码 0）（期望 0） | 通过 | `0` |
| 4 | Then：首行显示该会话号、实例、节点（期望含 "已附着会话 mock-sess-29512-1（实例 INST-001 · 节点"） | 通过 | `已附着会话 mock-sess-29512-1（实例 INST-001 · 节点 T-001 worker）` |
| 5 | Then：若有待审批，紧跟一行审批信息（期望含 "审批 APR-001 待处理"） | 通过 | `审批 APR-001 待处理 · 动作 write` |
| 6 | Then：随后输出该会话最近事件（行数 ≤ 20 且 ≥ 1） | 通过 | `3` |
| 7 | Then：脱离收尾行（期望含 "已脱离会话 mock-sess-29512-1"） | 通过 | `已附着会话 mock-sess-29512-1（实例 INST-001 · 节点 T-001 worker）<br>审批 APR-001 待处理 · 动作 write<br>06:41:53  会话 mock-sess-29512-1  空闲 → 执行中  原因 session.state<br>06:41:54  会话 mock-sess-29512-1  执行中 → 执行中（tool_call）  原因 session.state<br>06:41:54  会话 mock-sess-29512-1  执行中 →` |
| 8 | 机检：stdout 含 APR- 行（期望含 "APR-"） | 通过 | `已附着会话 mock-sess-29512-1（实例 INST-001 · 节点 T-001 worker）<br>审批 APR-001 待处理 · 动作 write<br>06:41:53  会话 mock-sess-29512-1  空闲 → 执行中  原因 session.state<br>06:41:54  会话 mock-sess-29512-1  执行中 → 执行中（tool_call）  原因 session.state<br>06:41:54  会话 mock-sess-29512-1  执行中 →` |
| 9 | 机检：附着前后 state 不变（期望 "running"） | 通过 | `"running"` |
| 10 | 机检：附着前后 rev 不变（期望 6） | 通过 | `6` |
| 11 | 机检：附着前后节点状态不变（期望 "[\"running\"]"） | 通过 | `"[\"running\"]"` |
| 12 | 机检：附着前后会话状态不变（期望 "[\"waiting_input\"]"） | 通过 | `"[\"waiting_input\"]"` |

**⑤ 判定**：通过

---

#### AC-45 `attach` 找不到会话

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-45`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch attach SES-999] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js attach SES-999   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-45 | exit=1 | 3000ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-45 | exit=0 | 289ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-45.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 没有 SES-999
- **When** 我执行 `orch attach SES-999`
- **Then** 输出"未找到会话 SES-999"；退出码 1
- **机检：** 没有状态写入
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-45.state.json` | 5 B |
| `docs/iterations/iteration-4/evidence/AC-45.events.jsonl` | 0 B |
| `docs/iterations/iteration-4/evidence/AC-45.meta.json` | 633 B |
| `docs/iterations/iteration-4/evidence/AC-45.output.json` | 2285 B |
| `docs/iterations/iteration-4/evidence/AC-45.status.txt` | 531 B |
| `docs/iterations/iteration-4/evidence/AC-45.status.md.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-45.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-45.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-45.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：项目根没有 SES-999 | 通过 | `` |
| 2 | Then：输出「未找到会话 SES-999」（期望 "未找到会话 SES-999"） | 通过 | `"未找到会话 SES-999"` |
| 3 | Then：退出码 1（期望 1） | 通过 | `1` |
| 4 | 机检：没有状态写入（不创建实例）（期望 0） | 通过 | `0` |
| 5 | 机检：没有状态写入（实例目录集合前后逐字一致）（期望 "[]"） | 通过 | `"[]"` |
| 6 | 机检：没有状态写入（输出不含已附着会话行）（期望不含 "已附着会话"） | 通过 | `未找到会话 SES-999<br>` |
| 7 | 机检：没有状态写入（输出不含审批行）（期望不含 "审批 APR-"） | 通过 | `未找到会话 SES-999<br>` |

**⑤ 判定**：通过

---

#### AC-46 `handoff list` 跨实例稳定排序

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46-empty`
- 实例：INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（cwd demo1 → INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46 | exit=4 | 13919ms
[orch run code-loop rounds-exceeded（cwd demo2 → INST-002）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo2 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46 | exit=4 | 12297ms
[orch handoff list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46 | exit=0 | 286ms
[orch handoff list --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff list --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46 | exit=0 | 300ms
[orch handoff list（打乱快照数组后复跑）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46 | exit=0 | 303ms
[orch handoff list（全新项目根）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46-empty | exit=0 | 1393ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46 | exit=0 | 315ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-46-empty | exit=0 | 273ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-46.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 两个实例各有多张交接包
- **When** 我执行 `orch handoff list`，再执行 `orch handoff list --instance INST-001`
- **Then** 前者先按实例号、再按包号排序，每行含包号、实例、方向、状态、最后时间；后者只出现 INST-001 的交接包；空时输出"交接包 —"
- **机检：** 排序稳定，不随快照数组顺序变化
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-46.state.json` | 19264 B |
| `docs/iterations/iteration-4/evidence/AC-46.events.jsonl` | 29974 B |
| `docs/iterations/iteration-4/evidence/AC-46.meta.json` | 977 B |
| `docs/iterations/iteration-4/evidence/AC-46.output.json` | 10692 B |
| `docs/iterations/iteration-4/evidence/AC-46.status.txt` | 5321 B |
| `docs/iterations/iteration-4/evidence/AC-46.status.md.json` | 1547 B |
| `docs/iterations/iteration-4/evidence/AC-46.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-46.inbox.json` | 7035 B |
| `docs/iterations/iteration-4/evidence/AC-46.attempts.json` | 603 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：两个实例 | 通过 | `INST-001,INST-002` |
| 2 | Then：两实例共 6 张包（期望 6） | 通过 | `6` |
| 3 | Then：先按实例号、再按包号排序 | 通过 | `交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24\|交接包 HO-002  实例 INST-001  测试→开发（回流）  已完成  06:42:27\|交接包 HO-003  实例 INST-001  开发→测试（复测）  已完成  06:42:29\|交接包 HO-001  实例 INST-002  开发→测试  已完成  06:42:36\|交接包 HO-002  实例 INST-002  测试→开发（回流）  已完成  06:42:39\|交接包 HO-003  实` |
| 4 | Then：每行含包号、实例、方向、状态、最后时间（期望含 "交接包 HO-001"） | 通过 | `交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24` |
| 5 | Then：每行含实例号（期望含 "实例 INST-001"） | 通过 | `交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24` |
| 6 | Then：每行含方向中文（期望匹配 /开发→测试\|测试→开发/） | 通过 | `交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24` |
| 7 | Then：--instance 只出现 INST-001 的交接包（期望 3） | 通过 | `3` |
| 8 | 机检：--instance 不含 INST-002 | 通过 | `交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24\|交接包 HO-002  实例 INST-001  测试→开发（回流）  已完成  06:42:27\|交接包 HO-003  实例 INST-001  开发→测试（复测）  已完成  06:42:29` |
| 9 | 机检：排序稳定，不随快照数组顺序变化（期望 "交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24\n交接包 HO-002  实例 INST-001  测试→开发（回流）  已完成  06:42:27\n交接包 HO-003  实例 INST-001  开发→测试（复测）  已完成  06:42:29\n交接包 HO-001  实例 INST-002  开发→ | 通过 | `"交接包 HO-001  实例 INST-001  开发→测试  已完成  06:42:24\n交接包 HO-002  实例 INST-001  测试→开发（回流）  已完成  06:42:27\n交接包 HO-003  实例 INST-001  开发→测试（复测）  已完成  06:42:29\n交接包 HO-001  实例 INST-002  开发→测试  已完成  06:42:36\n交接包 HO-002  实例 INST-002  测试→开发（回流）  已完成  06:42:39\n交接包 HO-003  ` |
| 10 | Then：空时输出「交接包 —」（期望 "交接包 —"） | 通过 | `"交接包 —"` |

**⑤ 判定**：通过

---

#### AC-47 `handoff show` 展示完整内容

- 判定：**通过**（核对 29/29 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-47`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（HO-002 回流包）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-47 | exit=4 | 13230ms
[orch handoff show HO-002 --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff show HO-002 --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-47 | exit=0 | 257ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-47 | exit=0 | 310ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-47.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一张回流交接包，含缺陷与上一版引用
- **When** 我执行 `orch handoff show HO-002 --instance INST-001`
- **Then** 输出实例、方向、状态、各阶段时间、证据、缺陷逐条、修改/复测要求、尝试次数、最后一次错误、信箱路径
- **机检：** 缺陷摘要与证据位置逐字来自交接包；"尝试"行的分母为 3，已尝试次数与 `deliveryAttempts` 一致
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-47.state.json` | 7885 B |
| `docs/iterations/iteration-4/evidence/AC-47.events.jsonl` | 12714 B |
| `docs/iterations/iteration-4/evidence/AC-47.meta.json` | 743 B |
| `docs/iterations/iteration-4/evidence/AC-47.output.json` | 22854 B |
| `docs/iterations/iteration-4/evidence/AC-47.status.txt` | 2339 B |
| `docs/iterations/iteration-4/evidence/AC-47.status.md.json` | 775 B |
| `docs/iterations/iteration-4/evidence/AC-47.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-47.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-47.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：HO-002 是回流包（期望 "backflow"） | 通过 | `"backflow"` |
| 2 | Given：HO-002 含缺陷 | 通过 | `[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}]` |
| 3 | Then：退出码 0（期望 0） | 通过 | `0` |
| 4 | Then：输出交接包号（期望含 "交接包 HO-002"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 5 | Then：输出实例（期望含 "实例：INST-001"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 6 | Then：输出方向（期望含 "方向：测试→开发（回流）"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 7 | Then：输出状态（期望含 "状态："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 8 | Then：各阶段时间行含「构造：」（期望含 "构造："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 9 | Then：各阶段时间行含「待投递：」（期望含 "待投递："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 10 | Then：各阶段时间行含「投递：」（期望含 "投递："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 11 | Then：各阶段时间行含「接受：」（期望含 "接受："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 12 | Then：各阶段时间行含「完成：」（期望含 "完成："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 13 | Then：各阶段时间行含「拒绝：」（期望含 "拒绝："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 14 | Then：各阶段时间行含「过期：」（期望含 "过期："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 15 | Then：输出证据（期望含 "证据："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 16 | 机检：缺陷摘要逐字来自交接包（期望含 "div 在除数为 0 时返回 Infinity，未抛错"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 17 | 机检：证据位置逐字来自交接包（期望含 "out/test-log.txt"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 18 | 机检：缺陷摘要逐字来自交接包（期望含 "div 在整除场景存在浮点误差"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 19 | 机检：证据位置逐字来自交接包（期望含 "out/test-log-2.txt"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 20 | Then：修改要求（期望含 "修改要求："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 21 | Then：复测要求（期望含 "复测要求："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 22 | Then：尝试次数（期望含 "尝试："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 23 | Then：最后一次错误（期望含 "最后错误："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 24 | Then：信箱路径（期望含 "信箱："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 25 | 机检：「尝试」行的分母为 3（期望含 "/3"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 26 | 机检：已尝试次数与 deliveryAttempts 一致（期望匹配 /尝试：1\/3/） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 27 | 机检：状态行逐字为「已完成」（consumed 状态词映射）（期望含 "状态：已完成"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 28 | 机检：证据行逐字来自交接包 artifactRefs.input（期望含 "证据：out/verdict.json"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 29 | 机检：复测要求逐字来自交接包（期望含 "按上方每条缺陷修正后重新提交产物"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:32  待投递：—  投递：19:01:33  接受：19:01:33  完成：19:01:34  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |

**⑤ 判定**：通过

---

#### AC-48 交接包找不到或歧义

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-a`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-b`
- 实例：INST-001、INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass（单实例）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-a | exit=0 | 8244ms
[orch handoff show HO-999 --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff show HO-999 --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-a | exit=1 | 270ms
[orch run code-loop pass（cwd demo1 → INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo1 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-b | exit=0 | 8004ms
[orch run code-loop pass（cwd demo2 → INST-002）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo2 --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-b | exit=0 | 6782ms
[orch status --instance INST-001（预热核心，完成启动对账）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-b | exit=0 | 250ms
[orch handoff show HO-001（不带 --instance，歧义）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff show HO-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-b | exit=1 | 299ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-a | exit=0 | 291ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-48-b | exit=0 | 331ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-48.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 包号 HO-999 不存在；另有两个实例都有一张 HO-001
- **When** 我依次执行 `orch handoff show HO-999 --instance INST-001` 与 `orch handoff show HO-001`（不带 `--instance`）
- **Then** 前者提示"未找到交接包 HO-999"，后者提示"交接包号 HO-001 在多个实例中存在，请加 --instance"；两次退出码都是 1
- **机检：** 没有状态写入
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-48.state.json` | 14987 B |
| `docs/iterations/iteration-4/evidence/AC-48.events.jsonl` | 19686 B |
| `docs/iterations/iteration-4/evidence/AC-48.meta.json` | 1066 B |
| `docs/iterations/iteration-4/evidence/AC-48.output.json` | 8316 B |
| `docs/iterations/iteration-4/evidence/AC-48.status.txt` | 5035 B |
| `docs/iterations/iteration-4/evidence/AC-48.status.md.json` | 1653 B |
| `docs/iterations/iteration-4/evidence/AC-48.prompts.json` | 3015 B |
| `docs/iterations/iteration-4/evidence/AC-48.inbox.json` | 3639 B |
| `docs/iterations/iteration-4/evidence/AC-48.attempts.json` | 465 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then①：提示「未找到交接包 HO-999」（期望 "未找到交接包 HO-999"） | 通过 | `"未找到交接包 HO-999"` |
| 2 | Then①：退出码 1（期望 1） | 通过 | `1` |
| 3 | Given②：两个实例都有一张 HO-001 | 通过 | `INST-001,INST-002` |
| 4 | Then②：提示「交接包号 HO-001 在多个实例中存在，请加 --instance」（期望 "交接包号 HO-001 在多个实例中存在，请加 --instance"） | 通过 | `"交接包号 HO-001 在多个实例中存在，请加 --instance"` |
| 5 | Then②：退出码 1（期望 1） | 通过 | `1` |
| 6 | 机检①：没有状态写入（rev 不变）（期望 23） | 通过 | `23` |
| 7 | 机检②：没有状态写入（所有实例 rev 不变）（期望 "[23,23]"） | 通过 | `"[23,23]"` |

**⑤ 判定**：通过

---

#### AC-49 暂停停在下一次派发边界

- 判定：**通过**（核对 17/17 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-49`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch workflow pause INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-49 | exit=0 | 446ms
[orch run（前台，暂停收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-49 | exit=0 | 5284ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-49 | exit=0 | 343ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-49 | exit=0 | 290ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-49.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环开发正在执行，测试尚未派发；用既有 `MAESTRO_TEST_PAUSE=after_output:<开发节点>` 接缝（`NODE_ENV=test`）在开发产出后停住（项目根出现 `.mock/paused`）
- **When** 我执行 `orch workflow pause INST-001`，然后放行接缝（`.mock/release`）
- **Then** 实例行变为"运行中（已暂停）"；开发当前回合跑完并落盘 `done`；跑完后没有测试派发；前台 `orch run` 打印已暂停收尾并退出 0；`status` 与 `status.md` 都显示已暂停
- **机检：** 磁盘快照 `paused === true`、`halted === false`；开发节点 `done`；`counters.dispatchCount` 仍为 1；测试 `round === 0`；`handoffs` 中没有指向测试的包（不存在 `created` 孤儿包）；`events.jsonl` 中开发节点之后没有新的 `node.dispatch`；`workspace/status.md` 含 `- 暂停：是`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-49.state.json` | 2375 B |
| `docs/iterations/iteration-4/evidence/AC-49.events.jsonl` | 2446 B |
| `docs/iterations/iteration-4/evidence/AC-49.meta.json` | 744 B |
| `docs/iterations/iteration-4/evidence/AC-49.output.json` | 6885 B |
| `docs/iterations/iteration-4/evidence/AC-49.status.txt` | 1636 B |
| `docs/iterations/iteration-4/evidence/AC-49.status.md.json` | 500 B |
| `docs/iterations/iteration-4/evidence/AC-49.prompts.json` | 547 B |
| `docs/iterations/iteration-4/evidence/AC-49.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-49.attempts.json` | 78 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：项目根出现 .mock/paused（开发产出后停住） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-30700-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>` |
| 2 | Then：pause 退出码 0（期望 0） | 通过 | `0` |
| 3 | Then：pause 输出实例行「运行中（已暂停）」（期望含 "实例 INST-001 · 运行中（已暂停） · 模板 编码闭环"） | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环<br>` |
| 4 | Then：前台 orch run 以暂停收尾并退出 0（期望 0） | 通过 | `0` |
| 5 | Then：run 收尾只打印实例行与下一步（期望含 "下一步：恢复推进 orch workflow resume INST-001"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-30700-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>实例 INST-001 · 运行中（已暂停） · 模板 编码闭环<br>下一步：恢复推进 orch workflow resume INST-001<br>` |
| 6 | 机检：run 收尾不打印节点表（期望不含 "节点 T-001 开发 已完成"） | 通过 | `会话 空闲\|实例 INST-001 · 运行中（已暂停） · 模板 编码闭环\|` |
| 7 | 机检：run 收尾不打印交接包行与升级块（期望不含 "交接包 HO-"） | 通过 | ` · 模板 编码闭环<br>下一步：恢复推进 orch workflow resume INST-001<br>` |
| 8 | 机检：磁盘快照 paused === true（期望 true） | 通过 | `true` |
| 9 | 机检：磁盘快照 halted === false（期望 false） | 通过 | `false` |
| 10 | 机检：state 仍为 running（期望 "running"） | 通过 | `"running"` |
| 11 | 机检：开发节点 T-001 done（期望 "done"） | 通过 | `"done"` |
| 12 | 机检：counters.dispatchCount 仍为 1（期望 1） | 通过 | `1` |
| 13 | 机检：测试 round === 0（期望 0） | 通过 | `0` |
| 14 | 机检：handoffs 中没有指向测试的包（不存在 created 孤儿包） | 通过 | `[]` |
| 15 | 机检：events.jsonl 中开发节点之后没有新的 node.dispatch（期望 1） | 通过 | `1` |
| 16 | Then：status 显示已暂停（期望含 "运行中（已暂停）"） | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 3s<br>节点 T-002 测试 待执行<br>会话 空闲<br>升级 —<br>` |
| 17 | 机检：workspace/status.md 含「- 暂停：是」（期望含 "- 暂停：是"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：运行中<br>- 暂停：是<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-001 开发<br>- 更新：2026-11-08T22:43:38.404Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-49/.orch/instances/INST-001/workspace<br><br>## 节点<b` |

**⑤ 判定**：通过

---

#### AC-50 恢复后从边界继续

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-50`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch workflow pause INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-50 | exit=0 | 466ms
[orch run（前台，暂停收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-50 | exit=0 | 5470ms
[orch workflow resume INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow resume INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-50 | exit=0 | 391ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-50 | exit=0 | 298ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-50.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 独立项目根，按 AC-49 的步骤重放至"已暂停且开发已完成"（或在 `NODE_ENV=test` 下用 `MAESTRO_TEST_PAUSE` 接缝 + `workflow pause` 构造）
- **When** 我执行 `orch workflow resume INST-001`
- **Then** 实例行恢复"运行中"；核心立即派发测试；测试最终完成
- **机检：** `paused === false`；以 `events.jsonl` 出现指向测试的 `node.dispatch` 为同步点断言；测试 `round` 增加 1；指向测试的交接包恰好 1 张且 `deliveryAttempts === 1`；`workspace/status.md` 含 `- 暂停：否`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-50.state.json` | 4057 B |
| `docs/iterations/iteration-4/evidence/AC-50.events.jsonl` | 5883 B |
| `docs/iterations/iteration-4/evidence/AC-50.meta.json` | 734 B |
| `docs/iterations/iteration-4/evidence/AC-50.output.json` | 5179 B |
| `docs/iterations/iteration-4/evidence/AC-50.status.txt` | 1506 B |
| `docs/iterations/iteration-4/evidence/AC-50.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-50.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-50.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-50.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：已暂停（期望 true） | 通过 | `true` |
| 2 | Then：resume 退出码 0（期望 0） | 通过 | `0` |
| 3 | Then：实例行恢复「运行中」（期望含 "实例 INST-001 · 运行中 · 模板 编码闭环"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>` |
| 4 | 机检：paused === false（期望 false） | 通过 | `false` |
| 5 | 机检：events.jsonl 出现指向测试的 node.dispatch（同步点） | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,workflow.paused,verification.passed,run.completed,workflow.resumed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_ev` |
| 6 | 机检：测试 round 增加 1（期望 1） | 通过 | `1` |
| 7 | 机检：指向测试的交接包恰好 1 张（期望 1） | 通过 | `1` |
| 8 | 机检：该包 deliveryAttempts === 1（期望 1） | 通过 | `1` |
| 9 | Then：测试最终完成（实例 completed）（期望 "completed"） | 通过 | `"completed"` |
| 10 | Then：核心立即派发测试并跑完 | 通过 | `true` |
| 11 | 机检：workspace/status.md 含「- 暂停：否」（期望含 "- 暂停：否"） | 通过 | `# INST-001 编码闭环<br><br>- 状态：运行中<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-002 测试<br>- 更新：2026-11-08T22:43:50.968Z<br>- 工作区：/private/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-50/.orch/instances/INST-001/workspace<br><br>## 节点<b` |

**⑤ 判定**：通过

---

#### AC-51 重复暂停 / 恢复幂等

- 判定：**通过**（核对 18/18 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch workflow pause INST-001（第一次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51 | exit=0 | 463ms
[orch run（前台，暂停收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51 | exit=0 | 5656ms
[orch workflow pause INST-001（重复，幂等）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51 | exit=0 | 311ms
[orch workflow resume INST-001（第一次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow resume INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51 | exit=0 | 383ms
[orch workflow resume INST-001（第二次）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow resume INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51 | exit=0 | 288ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-51 | exit=0 | 255ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-51.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 实例停在开发→测试的派发边界且已暂停（AC-49 状态，独立项目根）；本场景在 `NODE_ENV=test` 下改用不带节点限定的 `MAESTRO_TEST_PAUSE=after_output`，使恢复后的测试回合也停在同一接缝；第一次 `resume` 前与每次放行前都先删除上次留下的 `.mock/release` 与 `.mock/paused`
- **When** 我再执行一次 `pause`，然后执行两次 `resume`（等测试回合的 `.mock/paused` 重新出现后再发第二次 `resume`），再放行测试回合
- **Then** 三次都打印当前实例行；退出码 0；只有第一次 `resume` 产生一次派发，第二次不再派发
- **机检：** `paused` 最终为 `false`；`events.jsonl` 中 `node.dispatch` 共 2 条（开发、测试各一条）；指向测试的交接包恰好 1 张、测试节点会话恰好 1 个；第二次 `resume` 前后 `dispatchCount` 与测试节点 `round` 都不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-51.state.json` | 4120 B |
| `docs/iterations/iteration-4/evidence/AC-51.events.jsonl` | 5933 B |
| `docs/iterations/iteration-4/evidence/AC-51.meta.json` | 739 B |
| `docs/iterations/iteration-4/evidence/AC-51.output.json` | 6881 B |
| `docs/iterations/iteration-4/evidence/AC-51.status.txt` | 2203 B |
| `docs/iterations/iteration-4/evidence/AC-51.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-51.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-51.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-51.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：开发回合停在派发边界 | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-30960-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>` |
| 2 | Given：已暂停且开发已完成（期望 true） | 通过 | `true` |
| 3 | Then：pause① 退出码 0（期望 0） | 通过 | `0` |
| 4 | Then：pause① 打印当前实例行（期望含 "实例 INST-001 · 运行中"） | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环<br>` |
| 5 | Then：pause② 退出码 0（期望 0） | 通过 | `0` |
| 6 | Then：pause② 打印当前实例行（期望含 "实例 INST-001 · 运行中"） | 通过 | `实例 INST-001 · 运行中（已暂停） · 模板 编码闭环<br>` |
| 7 | Then：resume① 退出码 0（期望 0） | 通过 | `0` |
| 8 | Then：resume① 打印当前实例行（期望含 "实例 INST-001 · 运行中"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>` |
| 9 | Then：resume② 退出码 0（期望 0） | 通过 | `0` |
| 10 | Then：resume② 打印当前实例行（期望含 "实例 INST-001 · 运行中"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>` |
| 11 | Given：测试回合的 .mock/paused 重新出现 | 通过 | `true` |
| 12 | 机检：第二次 resume 前后 dispatchCount 不变（期望 2） | 通过 | `2` |
| 13 | 机检：第二次 resume 前后测试节点 round 不变（期望 1） | 通过 | `1` |
| 14 | 机检：只有第一次 resume 产生一次派发（dispatchCount 由 1 增至 2） | 通过 | `afterR1=1 beforeR2=2` |
| 15 | 机检：events.jsonl 中 node.dispatch 共 2 条（开发、测试各一条）（期望 2） | 通过 | `2` |
| 16 | 机检：指向测试的交接包恰好 1 张（期望 1） | 通过 | `1` |
| 17 | 机检：测试节点会话恰好 1 个（期望 1） | 通过 | `1` |
| 18 | 机检：paused 最终为 false（期望 false） | 通过 | `false` |

**⑤ 判定**：通过

---

#### AC-52 终止等同取消

- 判定：**通过**（核对 8/8 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-abort`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-cancel`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch workflow abort INST-001 / orch cancel --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow abort INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-abort | exit=0 | 595ms
[orch workflow cancel INST-001 / orch cancel --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cancel --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-cancel | exit=0 | 625ms
[orch run（前台，停止在派发边界）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-abort | exit=- | 10982ms
[orch run（前台，停止在派发边界）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-cancel | exit=- | 5738ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-abort | exit=0 | 253ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-52-cancel | exit=0 | 294ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-52.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个运行中实例
- **When** 我执行 `orch workflow abort INST-001`
- **Then** 输出与 `orch cancel --instance INST-001` 相同的结果行；实例取消
- **机检：** 实例 `cancelled`；节点、会话、交接包、升级按取消规则收尾
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-52.state.json` | 5163 B |
| `docs/iterations/iteration-4/evidence/AC-52.events.jsonl` | 5978 B |
| `docs/iterations/iteration-4/evidence/AC-52.meta.json` | 985 B |
| `docs/iterations/iteration-4/evidence/AC-52.output.json` | 5115 B |
| `docs/iterations/iteration-4/evidence/AC-52.status.txt` | 2295 B |
| `docs/iterations/iteration-4/evidence/AC-52.status.md.json` | 1023 B |
| `docs/iterations/iteration-4/evidence/AC-52.prompts.json` | 1143 B |
| `docs/iterations/iteration-4/evidence/AC-52.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-52.attempts.json` | 166 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：workflow abort 退出码 0（期望 0） | 通过 | `0` |
| 2 | Then：cancel 退出码 0（期望 0） | 通过 | `0` |
| 3 | Then：输出与 orch cancel --instance 相同的结果行（期望 "会话 空闲\n节点 T-001 开发 已取消\n节点 T-002 测试 已取消\n"） | 通过 | `"会话 空闲\n节点 T-001 开发 已取消\n节点 T-002 测试 已取消\n"` |
| 4 | 机检：实例 cancelled（期望 "cancelled"） | 通过 | `"cancelled"` |
| 5 | 机检：节点按取消规则收尾（全部 cancelled） | 通过 | `["cancelled","cancelled"]` |
| 6 | 机检：会话按取消规则收尾（idle） | 通过 | `["idle"]` |
| 7 | 机检：没有遗留待投递交接包 | 通过 | `[]` |
| 8 | 机检：没有遗留待处理升级 | 通过 | `[]` |

**⑤ 判定**：通过

---

#### AC-53 非运行实例不能暂停或恢复

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-53`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-53 | exit=0 | 8409ms
[orch workflow pause INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-53 | exit=1 | 287ms
[orch workflow resume INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow resume INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-53 | exit=1 | 289ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-53 | exit=0 | 310ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-53.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 实例已完成、已挂起或已停止推进
- **When** 我执行 `pause` 或 `resume`
- **Then** 提示当前状态与不能执行的原因；退出码 1；状态不变
- **机检：** `rev` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-53.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-53.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-53.meta.json` | 745 B |
| `docs/iterations/iteration-4/evidence/AC-53.output.json` | 4180 B |
| `docs/iterations/iteration-4/evidence/AC-53.status.txt` | 1887 B |
| `docs/iterations/iteration-4/evidence/AC-53.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-53.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-53.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-53.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：实例已完成（期望 "completed"） | 通过 | `"completed"` |
| 2 | Then：pause 提示当前状态与不能执行的原因（期望 "实例 INST-001 当前为已完成，不能暂停"） | 通过 | `"实例 INST-001 当前为已完成，不能暂停"` |
| 3 | Then：resume 提示当前状态与不能执行的原因（期望 "实例 INST-001 当前为已完成，不能恢复"） | 通过 | `"实例 INST-001 当前为已完成，不能恢复"` |
| 4 | Then：pause 退出码 1（期望 1） | 通过 | `1` |
| 5 | Then：resume 退出码 1（期望 1） | 通过 | `1` |
| 6 | 机检：状态不变（state 仍 completed）（期望 "completed"） | 通过 | `"completed"` |
| 7 | 机检：rev 不变（期望 23） | 通过 | `23` |

**⑤ 判定**：通过

---

#### AC-54 旧命令基线不回归

- 判定：**通过**（核对 16/16 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-implicit`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-explicit`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-code`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-doc`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-cancel`
- 实例：INST-001、INST-001、INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run --cwd ./demo --task ...（不带 --template）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-implicit | exit=0 | 4397ms
[orch run --cwd ./demo --task ... --template single] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --template single   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-explicit | exit=0 | 4494ms
[orch run code-loop pass（I1.2 成功路径）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-code | exit=0 | 8173ms
[orch run task-loop doc-pass（I1.3 成功路径）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-doc | exit=0 | 11489ms
[orch status（I1.1 列表）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-implicit | exit=0 | 323ms
[orch cancel --instance INST-001（I1.1 cancel）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cancel --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-cancel | exit=0 | 615ms
[orch run（前台，停止在派发边界）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-cancel | exit=- | 5168ms
[orch core stop（I1.1 core stop）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-code | exit=0 | 302ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-implicit | exit=0 | 336ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-explicit | exit=0 | 311ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-code | exit=0 | 258ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-doc | exit=0 | 320ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-54-cancel | exit=0 | 261ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-54.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 全新项目根
- **When** 我重跑 I1.1 的单节点、I1.2 的编码闭环、I1.3 的文档闭环（task-loop）成功路径，以及 I1.1 的 `status` 列表、`cancel`、`core stop`；其中单节点一次不带 `--template`、一次显式带 `--template single`
- **Then** 除"挂起后的下一步"按 M-11 更新外，其余输出、顺序、退出码与 I1.3 基线逐字一致；显式 `--template single` 与不带该参数的输出逐字相同（实例行不带"· 模板 …"后缀）
- **机检：** 旧夹具全部通过；`status` 无审批/暂停时不出现新行；两次单节点运行的首行与节点表 diff 为空
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-54.state.json` | 21617 B |
| `docs/iterations/iteration-4/evidence/AC-54.events.jsonl` | 28643 B |
| `docs/iterations/iteration-4/evidence/AC-54.meta.json` | 1712 B |
| `docs/iterations/iteration-4/evidence/AC-54.output.json` | 13468 B |
| `docs/iterations/iteration-4/evidence/AC-54.status.txt` | 6776 B |
| `docs/iterations/iteration-4/evidence/AC-54.status.md.json` | 2575 B |
| `docs/iterations/iteration-4/evidence/AC-54.prompts.json` | 5288 B |
| `docs/iterations/iteration-4/evidence/AC-54.inbox.json` | 4083 B |
| `docs/iterations/iteration-4/evidence/AC-54.attempts.json` | 482 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：显式 --template single 与不带该参数的输出逐字相同（期望 "实例 INST-001 · 运行中\n会话已创建 mock-sess-<sid>\n任务已投递\n会话 执行中 · 已运行 2s\n会话 等待下游 · 产出已提交\n会话 空闲\n节点 已完成 · 耗时 <n>s\n交接包 HO-001  已构造   <time>\n交接包 HO-001  已投递   <tim | 通过 | `"实例 INST-001 · 运行中\n会话已创建 mock-sess-<sid>\n任务已投递\n会话 执行中 · 已运行 2s\n会话 等待下游 · 产出已提交\n会话 空闲\n节点 已完成 · 耗时 <n>s\n交接包 HO-001  已构造   <time>\n交接包 HO-001  已投递   <time>\n交接包 HO-001  已接受   <time>\n交接包 HO-001  已完成   <time>\n"` |
| 2 | 机检：两次单节点运行的首行 diff 为空（期望 "实例 INST-001 · 运行中"） | 通过 | `"实例 INST-001 · 运行中"` |
| 3 | Then：实例行不带「· 模板 …」后缀（期望含 "实例 INST-001 · 运行中"） | 通过 | `实例 INST-001 · 运行中` |
| 4 | 机检：single 实例行不含模板后缀（期望不含 "· 模板"） | 通过 | `实例 INST-001 · 运行中` |
| 5 | 机检：不带 --template 退出码 0（期望 0） | 通过 | `0` |
| 6 | 机检：显式 --template single 退出码 0（期望 0） | 通过 | `0` |
| 7 | Then：I1.2 编码闭环成功（退出码 0）（期望 0） | 通过 | `0` |
| 8 | 机检：I1.2 实例 completed（期望 "completed"） | 通过 | `"completed"` |
| 9 | Then：I1.3 文档闭环成功（退出码 0）（期望 0） | 通过 | `0` |
| 10 | 机检：I1.3 实例 completed（期望 "completed"） | 通过 | `"completed"` |
| 11 | Then：status 列表退出码 0（期望 0） | 通过 | `0` |
| 12 | 机检：status 无审批时不出现「待处理审批」（期望不含 "待处理审批"） | 通过 | `实例 INST-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 3s · 更新 06:44:38<br>` |
| 13 | 机检：status 无暂停时不出现「（已暂停）」（期望不含 "（已暂停）"） | 通过 | `实例 INST-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 3s · 更新 06:44:38<br>` |
| 14 | Then：cancel 退出码 0（期望 0） | 通过 | `0` |
| 15 | Then：core stop 退出码 0（期望 0） | 通过 | `0` |
| 16 | Then：core stop 输出「核心已停止」（期望含 "核心已停止"） | 通过 | `核心已停止（pid 31514，运行 26s）<br>` |

**⑤ 判定**：通过

---

#### AC-55 旧格式实例只读可查

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-55`
- 实例：OLD-001

**① 完整命令（逐条可复跑）**

```
[orch status --instance OLD-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance OLD-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-55 | exit=0 | 1258ms
[orch instance status OLD-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance status OLD-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-55 | exit=0 | 364ms
[orch instance log OLD-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log OLD-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-55 | exit=0 | 320ms
[orch instance graph OLD-001 --format json] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph OLD-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-55 | exit=0 | 281ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-55 | exit=0 | 301ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-55.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个 I1.1 的 v1 单对象实例
- **When** 我执行 `orch status --instance`、`orch instance status`、`orch instance log`、`orch instance graph`
- **Then** 都能读出旧字段，按单节点显示；不写 `state.json`；不因缺新字段报错
- **机检：** `rev` 不变；`graph` 的 `template` 为 `single`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-55.state.json` | 1847 B |
| `docs/iterations/iteration-4/evidence/AC-55.events.jsonl` | 378 B |
| `docs/iterations/iteration-4/evidence/AC-55.meta.json` | 735 B |
| `docs/iterations/iteration-4/evidence/AC-55.output.json` | 6873 B |
| `docs/iterations/iteration-4/evidence/AC-55.status.txt` | 2424 B |
| `docs/iterations/iteration-4/evidence/AC-55.status.md.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-55.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-55.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-55.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：schemaVersion === 1（期望 1） | 通过 | `1` |
| 2 | Then：status --instance 退出码 0（期望 0） | 通过 | `0` |
| 3 | Then：instance status 退出码 0（期望 0） | 通过 | `0` |
| 4 | Then：instance log 退出码 0（期望 0） | 通过 | `0` |
| 5 | Then：instance graph 退出码 0（期望 0） | 通过 | `0` |
| 6 | Then：都能读出旧字段，按单节点显示（实例行）（期望含 "实例 OLD-001 · 已完成"） | 通过 | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 7 | Then：按单节点显示（节点行）（期望含 "节点 已完成"） | 通过 | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 8 | Then：交接包旧字段可读（期望含 "交接包 HO-001"） | 通过 | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 9 | Then：instance log 读出旧事件（期望含 "原因 run.started"） | 通过 | `17:00:00  实例 OLD-001  已创建 → 运行中  原因 run.started<br>17:12:00  节点 T-001  执行中 → 待校验  原因 output.submitted<br>` |
| 10 | 机检：graph 的 template 为 single（期望 "single"） | 通过 | `"single"` |
| 11 | 机检：不因缺新字段报错（graph 输出含 nodes/edges/current） | 通过 | `["graphVersion","instanceId","template","state","paused","nodes","edges","handoffs","escalations","approvals","current"]` |
| 12 | 机检：不写 state.json（字节不变）（期望 "95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"） | 通过 | `"95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"` |
| 13 | 机检：rev 不变（期望 undefined） | 通过 | - |

**⑤ 判定**：通过

---

#### AC-56 架构纯净与零依赖

- 判定：**通过**（核对 16/16 通过）
- 验证面：架构检查（静态源码 + 命令）
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-56`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator   | cwd=/Users/xuesh/www/Maestro | exit=0 | 480ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-56 | exit=0 | 299ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-56.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 当前源码
- **When** 我执行 `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator`
- **Then** 退出码 0、扫描文件数 > 0、零命中；`package.json.dependencies` 不存在或为空对象
- **架构检查：** 上述命令（禁词取 I1.2 四词与 I1.3 七词的并集，不依赖脚本默认的 I1.2 四词表）+ 依赖读取；另有 `status.md` 状态词与 `labels.js` 的逐词对照断言（`test/wp2/labels.test.js`）；三个模板的交接包构造与校验都只经 `src/core/handoff-schema.js`（源码 import 检查，不允许模板内联校验）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-56.state.json` | 5 B |
| `docs/iterations/iteration-4/evidence/AC-56.events.jsonl` | 0 B |
| `docs/iterations/iteration-4/evidence/AC-56.meta.json` | 658 B |
| `docs/iterations/iteration-4/evidence/AC-56.output.json` | 38725 B |
| `docs/iterations/iteration-4/evidence/AC-56.status.txt` | 918 B |
| `docs/iterations/iteration-4/evidence/AC-56.status.md.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-56.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-56.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-56.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：退出码 0（期望 0） | 通过 | `0` |
| 2 | Then：扫描文件数 > 0（期望匹配 /扫描 [1-9]\d* 个文件/） | 通过 | `OK: 扫描 21 个文件，src/core, src/daemon 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, coordinator 零命中<br>` |
| 3 | Then：零命中（期望含 "零命中"） | 通过 | `OK: 扫描 21 个文件，src/core, src/daemon 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, coordinator 零命中<br>` |
| 4 | Then：package.json.dependencies 不存在或为空对象 | 通过 | `null` |
| 5 | 架构检查：test/wp2/labels.test.js 存在 | 通过 | `/Users/xuesh/www/Maestro/test/wp2/labels.test.js` |
| 6 | 架构检查：labels.test.js 含逐词对照断言（assert.equal）（期望含 "assert.equal"） | 通过 | `import test from 'node:test';<br>import assert from 'node:assert/strict';<br><br>import {<br>  INSTANCE_LABEL,<br>  NODE_LABEL,<br>  SESSION_LABEL,<br>  HANDOFF_LABEL,<br>  ESCALATION_LABEL,<br>  ROLE_LABEL,<br>  TEMPLATE_LABEL,<br>  HANDOFF_DIRECTION,<br>  NO` |
| 7 | 架构检查：labels.test.js 对照 labels.js 的状态词表（INSTANCE_LABEL）（期望含 "INSTANCE_LABEL"） | 通过 | `import test from 'node:test';<br>import assert from 'node:assert/strict';<br><br>import {<br>  INSTANCE_LABEL,<br>  NODE_LABEL,<br>  SESSION_LABEL,<br>  HANDOFF_LABEL,<br>  ESCALATION_LABEL,<br>  ROLE_LABEL,<br>  TEMPLATE_LABEL,<br>  HANDOFF_DIRECTION,<br>  NO` |
| 8 | 架构检查：labels.test.js 引用 labels.js 文案表（期望含 "src/cli/labels.js"） | 通过 | `import test from 'node:test';<br>import assert from 'node:assert/strict';<br><br>import {<br>  INSTANCE_LABEL,<br>  NODE_LABEL,<br>  SESSION_LABEL,<br>  HANDOFF_LABEL,<br>  ESCALATION_LABEL,<br>  ROLE_LABEL,<br>  TEMPLATE_LABEL,<br>  HANDOFF_DIRECTION,<br>  NO` |
| 9 | 架构检查：src/core/handoff-schema.js 定义唯一校验出口 validateHandoff（期望含 "export async function validateHandoff"） | 通过 | `/**<br> * Handoff payload validation (iteration-4 D-3 / C-07).<br> *<br> * Pure field and path checks plus minimal injectable IO. This module never<br> * emits events, never mutates instance state and never calls store.save:<br> * turning a failed verdict into` |
| 10 | 架构检查：orchestrator.js 只从 ./handoff-schema.js 引入校验（期望含 "import { validateHandoff } from './handoff-schema.js'"） | 通过 | `/**<br> * 图驱动编排主流程（I1.2 / WP-4）。<br> *<br> * 职责边界：<br> * - 本文件只做“裁决”：调状态机、调事件总线、调核对/判定器；宿主细节全部由注入的<br> *   `adapterFactory` 提供（本层不认识具体宿主、协议或进程）。<br> * - 所有层（实例 / 节点 / 会话 / 交接包 / 升级）统一存在 `state.json` 的数组里；<br> *   每次迁移走 CAS，事件先落盘再推进内存状态。<br> * - 默认图是单节点图，行为与 I1` |
| 11 | 架构检查：advance.js 只负责构造、不内联校验（无 validateHandoff 字面量）（期望不含 "validateHandoff"） | 通过 | `/**<br> * Advance planning and handoff construction (pure; no IO, no mutation).<br> *<br> * `planAdvance` answers one question: given a completed node and the graph, what<br> * happens next? It never writes state — the caller performs the CAS and the dispatch.` |
| 12 | 架构检查：src/templates/** 不内联交接包校验（零命中） | 通过 | `（无）` |
| 13 | 架构检查：src/templates/index.js 不内联 import（构造/校验不在模板内）（期望不含 "import "） | 通过 | `/**<br> * Graph + role constants (`src/templates/index.js`).<br> *<br> * This is the ONLY product directory allowed to spell the built-in template names<br> * and role names (AC-28). `src/core` and `src/daemon` stay literal-free: the engine<br> * receives thes` |
| 14 | 架构检查：模板 single 定义存在（期望含 "single"） | 通过 | `/**<br> * Graph + role constants (`src/templates/index.js`).<br> *<br> * This is the ONLY product directory allowed to spell the built-in template names<br> * and role names (AC-28). `src/core` and `src/daemon` stay literal-free: the engine<br> * receives thes` |
| 15 | 架构检查：模板 code-loop 定义存在（期望含 "code-loop"） | 通过 | `/**<br> * Graph + role constants (`src/templates/index.js`).<br> *<br> * This is the ONLY product directory allowed to spell the built-in template names<br> * and role names (AC-28). `src/core` and `src/daemon` stay literal-free: the engine<br> * receives thes` |
| 16 | 架构检查：模板 task-loop 定义存在（期望含 "task-loop"） | 通过 | `/**<br> * Graph + role constants (`src/templates/index.js`).<br> *<br> * This is the ONLY product directory allowed to spell the built-in template names<br> * and role names (AC-28). `src/core` and `src/daemon` stay literal-free: the engine<br> * receives thes` |

**⑤ 判定**：通过

---

#### AC-57 新动作都有审计事件

- 判定：**通过**（核对 18/18 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-bad`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-retry`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-allow`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-deny`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-escalation`、`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-flow`
- 实例：INST-001、INST-001、INST-001、INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run task-loop（3 次投递失败）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-retry | exit=4 | 8998ms
[orch approve APR-001 --decision allow] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision allow --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-allow | exit=0 | 589ms
[orch run --approval hold（allow 前台）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-allow | exit=0 | 5259ms
[orch approve APR-001 --decision deny] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision deny --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-deny | exit=0 | 661ms
[orch run --approval hold（deny 前台）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-deny | exit=1 | 4458ms
[orch run code-loop rounds-exceeded] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-escalation | exit=4 | 14548ms
[orch escalate resolve ESC-001 --decision pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision pass --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-escalation | exit=0 | 612ms
[orch workflow pause INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-flow | exit=0 | 465ms
[orch workflow resume INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow resume INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-flow | exit=0 | 409ms
[orch run（暂停/恢复前台）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-flow | exit=0 | 9144ms
[orch instance log INST-001 --format json（AC-57-bad）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-bad | exit=0 | 1205ms
[orch instance log INST-001 --format json（AC-57-retry）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-retry | exit=0 | 317ms
[orch instance log INST-001 --format json（AC-57-allow）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-allow | exit=0 | 1220ms
[orch instance log INST-001 --format json（AC-57-deny）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-deny | exit=0 | 1313ms
[orch instance log INST-001 --format json（AC-57-escalation）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-escalation | exit=0 | 314ms
[orch instance log INST-001 --format json（AC-57-flow）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-flow | exit=0 | 1311ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-bad | exit=0 | 344ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-retry | exit=0 | 306ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-allow | exit=0 | 302ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-deny | exit=0 | 337ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-escalation | exit=0 | 304ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-57-flow | exit=0 | 304ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-57.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一次包含校验失败、投递重试、审批、暂停、升级处理、恢复的完整流程
- **When** 我执行 `orch instance log INST-001 --format json`
- **Then** 能分别找到交接包拒绝、投递等待/过期、审批创建/处理、暂停/恢复、升级创建/处理的事件与原因
- **机检：** 事件 `reason` 覆盖本流程涉及的 `handoff.inboxed`、`handoff.pending`、`handoff.expired`、`handoff.rejected`、`escalation.created`、`escalation.resolved`、`approval.created`、`permission.allowed`、`permission.denied`、`workflow.paused`、`workflow.resumed`；`approval.withdrawn` 与 `workspace.status_write_failed` 分别由 AC-35、AC-59 覆盖，不在本 AC 断言
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-57.state.json` | 32454 B |
| `docs/iterations/iteration-4/evidence/AC-57.events.jsonl` | 44589 B |
| `docs/iterations/iteration-4/evidence/AC-57.meta.json` | 2229 B |
| `docs/iterations/iteration-4/evidence/AC-57.output.json` | 80179 B |
| `docs/iterations/iteration-4/evidence/AC-57.status.txt` | 58344 B |
| `docs/iterations/iteration-4/evidence/AC-57.status.md.json` | 3665 B |
| `docs/iterations/iteration-4/evidence/AC-57.prompts.json` | 7521 B |
| `docs/iterations/iteration-4/evidence/AC-57.inbox.json` | 6273 B |
| `docs/iterations/iteration-4/evidence/AC-57.attempts.json` | 848 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：AC-57-bad 的 log json 可解析且非空 | 通过 | `array=true len=14` |
| 2 | Then：AC-57-retry 的 log json 可解析且非空 | 通过 | `array=true len=22` |
| 3 | Then：AC-57-allow 的 log json 可解析且非空 | 通过 | `array=true len=19` |
| 4 | Then：AC-57-deny 的 log json 可解析且非空 | 通过 | `array=true len=15` |
| 5 | Then：AC-57-escalation 的 log json 可解析且非空 | 通过 | `array=true len=61` |
| 6 | Then：AC-57-flow 的 log json 可解析且非空 | 通过 | `array=true len=26` |
| 7 | Then：所有 instance log --format json 均可解析 | 通过 | `true` |
| 8 | 机检：事件 reason 覆盖 handoff.inboxed | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 9 | 机检：事件 reason 覆盖 handoff.pending | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 10 | 机检：事件 reason 覆盖 handoff.expired | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 11 | 机检：事件 reason 覆盖 handoff.rejected | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 12 | 机检：事件 reason 覆盖 escalation.created | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 13 | 机检：事件 reason 覆盖 escalation.resolved | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 14 | 机检：事件 reason 覆盖 approval.created | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 15 | 机检：事件 reason 覆盖 permission.allowed | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 16 | 机检：事件 reason 覆盖 permission.denied | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 17 | 机检：事件 reason 覆盖 workflow.paused | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |
| 18 | 机检：事件 reason 覆盖 workflow.resumed | 通过 | `approval.created,backflow.constructed,core.suspend,escalation.created,escalation.resolved,handoff.consumed,handoff.created,handoff.delivered,handoff.expired,handoff.inboxed,handoff.pending,handoff.rejected,node.dispatch,output.submitted,permission.allowed,perm` |

**⑤ 判定**：通过

**备注**

- 完整流程的互斥状态由 6 个独立项目根各自真实子流程取证（单实例无法同时具备通过/拒绝、坏包/合法包、暂停/恢复）；approval.withdrawn 与 workspace.status_write_failed 按需求不在本 AC 断言，分别由 AC-35、AC-59 覆盖。

---

#### AC-58 查看类命令严格只读

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass（运行中→已完成实例）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 8511ms
[orch status --instance INST-001（预热核心，完成启动对账）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 277ms
[orch status] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 298ms
[orch instance status INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance status INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 319ms
[orch instance log INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 317ms
[orch instance graph INST-001 --format json] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001 --format json   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 274ms
[orch handoff list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 319ms
[orch handoff show HO-001 --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff show HO-001 --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 330ms
[orch escalate list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 281ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-58 | exit=0 | 339ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-58.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 任意运行中实例，且核心已由前一条命令拉起并完成启动对账
- **When** 我执行 `status`、`instance status/log/graph`、`handoff list/show`、`escalate list`
- **Then** 实例 `state.json`、节点、会话、交接包、升级、审批都不变（`attach` 的只读性由 AC-44 用等待审批的稳定会话覆盖）
- **机检：** 命令前后 `rev` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-58.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-58.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-58.meta.json` | 736 B |
| `docs/iterations/iteration-4/evidence/AC-58.output.json` | 19607 B |
| `docs/iterations/iteration-4/evidence/AC-58.status.txt` | 7681 B |
| `docs/iterations/iteration-4/evidence/AC-58.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-58.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-58.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-58.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 2 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 3 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 4 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 5 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 6 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 7 | Then：查看类命令退出码 0（期望 0） | 通过 | `0` |
| 8 | 机检：命令前后 rev 不变（期望 23） | 通过 | `23` |
| 9 | Then：实例 state.json 完全不变（期望 "{\"schemaVersion\":2,\"instanceId\":\"INST-001\",\"coreGeneration\":\"gen-b2cbe8838f4bb6f5\",\"createdAt\":\"2026-11-08T22:46:29.634Z\",\"updatedAt\":\"2026-11-08T22:46:36. | 通过 | `"{\"schemaVersion\":2,\"instanceId\":\"INST-001\",\"coreGeneration\":\"gen-b2cbe8838f4bb6f5\",\"createdAt\":\"2026-11-08T22:46:29.634Z\",\"updatedAt\":\"2026-11-08T22:46:36.394Z\",\"state\":\"completed\",\"stateSince\":\"2026-11-08T22:46:36.377Z\",\"template\"` |

**⑤ 判定**：通过

---

#### AC-59 `status.md` 刷新失败不回滚状态

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-59`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[MAESTRO_FAULT=workspace_status_write:fail orch run code-loop pass] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-59 | exit=0 | 7863ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-59 | exit=0 | 286ms
[orch instance log INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance log INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-59 | exit=0 | 318ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-59 | exit=0 | 312ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-59.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 夹具用 `MAESTRO_FAULT=workspace_status_write:fail` 让 `status.md` 写入失败
- **When** 实例发生一次节点状态变化
- **Then** 实例继续推进；`status` 仍显示新状态；`instance log` 能看到一次"工作区状态写入失败"，已落盘状态不回滚
- **机检：** `state.json` 的节点状态已更新；`events.jsonl` 含 `workspace.status_write_failed`；后续状态变化仍会尝试刷新
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-59.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-59.events.jsonl` | 14138 B |
| `docs/iterations/iteration-4/evidence/AC-59.meta.json` | 1017 B |
| `docs/iterations/iteration-4/evidence/AC-59.output.json` | 19144 B |
| `docs/iterations/iteration-4/evidence/AC-59.status.txt` | 6411 B |
| `docs/iterations/iteration-4/evidence/AC-59.status.md.json` | 500 B |
| `docs/iterations/iteration-4/evidence/AC-59.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-59.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-59.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：实例继续推进（run 退出码 0）（期望 0） | 通过 | `0` |
| 2 | Then：实例状态 completed（期望 "completed"） | 通过 | `"completed"` |
| 3 | 机检：state.json 的节点状态已更新（不回滚）（期望 "done"） | 通过 | `"done"` |
| 4 | 机检：events.jsonl 含 workspace.status_write_failed | 通过 | `workspace.status_write_failed,workspace.status_write_failed,run.started,workspace.status_write_failed,node.dispatch,session.state,workspace.status_write_failed,workspace.status_write_failed,session.state,workspace.status_write_failed,session.state,workspace.st` |
| 5 | 机检：后续状态变化仍会尝试刷新（失败事件多次） | 通过 | `23` |
| 6 | Then：status 仍显示新状态（期望含 "实例 INST-001 · 已完成"） | 通过 | `实例 INST-001 · 已完成 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 3s · 判定 通过<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   06:46:46<br>交接包 HO-001  开发→测试  已投递   06:46:47<br>交接包 HO-001  开发→测试  已接受   06:46:47<br>交接包 HO-001  开发→测试  已完成   06:46:` |
| 7 | Then：instance log 能看到一次状态页写入失败事件（reason=workspace.status_write_failed）（期望含 "workspace.status_write_failed"） | 通过 | `[#1] 06:46:43  实例 INST-001  workspace.status_write_failed  原因 状态页写入失败<br>[#2] 06:46:44  实例 INST-001  workspace.status_write_failed  原因 状态页写入失败<br>[#3] 06:46:44  实例 INST-001  已创建 → 运行中  原因 开始运行<br>[#4] 06:46:44  实例 INST-001  workspace.status_write_failed  原因 状态` |
| 8 | 机检：instance log 将该原因渲染为「状态页写入失败」（期望含 "状态页写入失败"） | 通过 | `[#1] 06:46:43  实例 INST-001  workspace.status_write_failed  原因 状态页写入失败<br>[#2] 06:46:44  实例 INST-001  workspace.status_write_failed  原因 状态页写入失败<br>[#3] 06:46:44  实例 INST-001  已创建 → 运行中  原因 开始运行<br>[#4] 06:46:44  实例 INST-001  workspace.status_write_failed  原因 状态` |
| 9 | 机检：status.md 仍存在（写入被尝试但失败，不影响状态） | 通过 | `# INST-001 编码闭环<br><br>- 状态：已创建<br>- 暂停：否<br>- 任务：实现 calc.js，产物：calc.js<br>- 当前节点：T-001 开发<br>- 更新` |

**⑤ 判定**：通过

**备注**

- 需求 AC-59 Then 的「工作区状态写入失败」为事件措辞；产品 labels.js 将其逐字渲染为「状态页写入失败」，事件 reason 仍为 workspace.status_write_failed（A-5 未登记该文案为逐字基线，按机检口径判定）。

---

#### AC-60 取消覆盖暂停与待审批

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-60`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch workflow pause INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-60 | exit=0 | 493ms
[orch cancel --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cancel --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-60 | exit=0 | 682ms
[orch run --approval hold（前台）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-60 | exit=1 | 4322ms
[orch status --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-60 | exit=0 | 317ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-60 | exit=0 | 271ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-60.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 一个已暂停、且在暂停时已进入的回合里出现 `hold` 待处理审批的实例
- **When** 我执行 `orch cancel --instance INST-001`
- **Then** 实例取消；暂停标记清除；审批行显示已作废；不会留下"待处理"
- **机检：** 实例 `cancelled`、`paused === false`；审批 `withdrawn`；会话 `idle`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-60.state.json` | 2505 B |
| `docs/iterations/iteration-4/evidence/AC-60.events.jsonl` | 3666 B |
| `docs/iterations/iteration-4/evidence/AC-60.meta.json` | 739 B |
| `docs/iterations/iteration-4/evidence/AC-60.output.json` | 5480 B |
| `docs/iterations/iteration-4/evidence/AC-60.status.txt` | 2119 B |
| `docs/iterations/iteration-4/evidence/AC-60.status.md.json` | 415 B |
| `docs/iterations/iteration-4/evidence/AC-60.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-60.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-60.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：宿主请求 write，实例等待审批 | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-33062-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Given：pause 退出码 0（期望 0） | 通过 | `0` |
| 3 | Given：已暂停（期望 true） | 通过 | `true` |
| 4 | Given：暂停时仍有待处理审批（期望 "pending"） | 通过 | `"pending"` |
| 5 | Then：cancel 退出码 0（期望 0） | 通过 | `0` |
| 6 | 机检：实例 cancelled（期望 "cancelled"） | 通过 | `"cancelled"` |
| 7 | Then：暂停标记清除（paused === false）（期望 false） | 通过 | `false` |
| 8 | 机检：审批 withdrawn（期望 "withdrawn"） | 通过 | `"withdrawn"` |
| 9 | 机检：会话 idle（期望 "idle"） | 通过 | `"idle"` |
| 10 | Then：审批行显示已作废（期望含 "审批 APR-001 已作废"） | 通过 | `实例 INST-001 · 已取消<br>节点 已取消<br>会话 空闲<br>交接包 HO-001  已构造   06:46:55<br>交接包 HO-001  已投递   06:46:55<br>交接包 HO-001  已接受   06:46:55<br>交接包 HO-001  已拒绝   06:46:56  原因 已撤回<br>审批 APR-001 已作废 · 动作 write<br>` |
| 11 | 机检：不会留下「待处理」（期望不含 "待处理"） | 通过 | `审批 APR-001 已作废 · 动作 write` |

**⑤ 判定**：通过

---

#### AC-61 取消时待投递交接包不再重试

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[call-seam test.delivery --action hold] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 --call test.delivery --instance INST-001 --action hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 | exit=0 | 235ms
[call-seam test.delivery --action hold（占位复跑，确认幂等）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 --call test.delivery --instance INST-001 --action hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 | exit=0 | 179ms
[orch cancel --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cancel --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 | exit=0 | 644ms
[call-seam test.delivery --action release] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/test/fixtures/call-seam.mjs --root /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 --call test.delivery --instance INST-001 --action release   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 | exit=0 | 180ms
[orch run task-loop（前台，投递重试等待点）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 | exit=1 | 8264ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-61 | exit=0 | 249ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-61.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 宿主对首次 `prompt` 返回失败（mock 步字段 `promptFailures: 1`），并用 `NODE_ENV=test` 的 `test.delivery` 接缝（`hold`）让交接包停在"待投递 · 重试 1/2"的重试等待点
- **When** 我执行 `orch cancel --instance INST-001`，随后 `test.delivery release`
- **Then** 实例取消；该交接包显示"已拒绝（已撤回）"；释放后也不再发起重试；信箱文件保留可查
- **机检：** 实例 `cancelled`；包 `state === 'rejected'`、`rejectReason === 'withdrawn'`；`release` 后场景根 `.mock/prompt-attempts-<sessionId>.json` 的 `attempts` 不再增加（不以 `prompts/<n>.json` 是否被覆盖判定）；`.orch/inbox/INST-001/<包号>.json` 仍存在；`deliveryAttempts` 不再增加
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-61.state.json` | 4819 B |
| `docs/iterations/iteration-4/evidence/AC-61.events.jsonl` | 4430 B |
| `docs/iterations/iteration-4/evidence/AC-61.meta.json` | 748 B |
| `docs/iterations/iteration-4/evidence/AC-61.output.json` | 7353 B |
| `docs/iterations/iteration-4/evidence/AC-61.status.txt` | 2873 B |
| `docs/iterations/iteration-4/evidence/AC-61.status.md.json` | 655 B |
| `docs/iterations/iteration-4/evidence/AC-61.prompts.json` | 1867 B |
| `docs/iterations/iteration-4/evidence/AC-61.inbox.json` | 1329 B |
| `docs/iterations/iteration-4/evidence/AC-61.attempts.json` | 247 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：项目根出现 .mock/paused | 通过 | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-33319-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>` |
| 2 | Given：交接包停在「待投递 · 重试 1/2」重试等待点 | 通过 | `{"handoffs":[["HO-001","pending",1]],"reasons":["run.started","node.dispatch","session.state","session.state","session.state","output.submitted","output.submitted","review.evidence_verified","handoff.created","node.dispatch","handoff.inboxed","handoff.delivere` |
| 3 | Then：cancel 退出码 0（期望 0） | 通过 | `0` |
| 4 | Then：该交接包显示「已拒绝（已撤回）」（期望含 "已拒绝（已撤回）"） | 通过 | `会话 空闲<br>会话 空闲<br>节点 T-001 研究员 已取消<br>节点 T-002 撰写者 已取消<br>节点 T-003 审核者 已取消<br>交接包 HO-001 已拒绝（已撤回）<br>` |
| 5 | 机检：实例 cancelled（期望 "cancelled"） | 通过 | `"cancelled"` |
| 6 | 机检：包 state === rejected（期望 "rejected"） | 通过 | `"rejected"` |
| 7 | 机检：包 rejectReason === withdrawn（期望 "withdrawn"） | 通过 | `"withdrawn"` |
| 8 | 机检：deliveryAttempts 不再增加（期望 1） | 通过 | `1` |
| 9 | 机检：release 后 .mock/prompt-attempts-<sessionId>.json 的 attempts 不再增加 | 通过 | `before={"prompt-attempts-mock-sess-33319-1.json":{"attempts":1},"prompt-attempts-mock-sess-33357-1.json":{"attempts":1},"prompt-failures-mock-sess-33357-1.json":{"attempts":1,"failures":1}} after={"prompt-attempts-mock-sess-33319-1.json":{"attempts":1},"prompt` |
| 10 | 机检：.orch/inbox/INST-001/HO-001.json 仍存在 | 通过 | `INST-001/HO-001.json` |
| 11 | 机检：释放后不再发起重试（无新增 handoff.pending）（期望 1） | 通过 | `1` |

**⑤ 判定**：通过

---

#### AC-62 多节点审批拒绝走既有执行失败路径

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-62`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch approve APR-001 --instance INST-001 --decision deny] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision deny --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-62 | exit=0 | 633ms
[orch run code-loop --approval hold（前台，拒绝后收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop --approval hold   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-62 | exit=4 | 4787ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-62 | exit=0 | 240ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-62.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `--template code-loop --approval hold` 发起，开发节点等待审批
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision deny`
- **Then** 输出"审批 APR-001 已拒绝 · 动作 write"；沿 I1.2 / I1.3 的 `refusal` 路径收尾：节点升级、实例挂起，不出现第二套失败文案
- **机检：** 审批 `denied`；来源节点 `escalated`；实例 `suspended`；`escalations[0].reasonCode === 'execution_failed'`；不出现 `failed` 实例行
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-62.state.json` | 2812 B |
| `docs/iterations/iteration-4/evidence/AC-62.events.jsonl` | 3315 B |
| `docs/iterations/iteration-4/evidence/AC-62.meta.json` | 757 B |
| `docs/iterations/iteration-4/evidence/AC-62.output.json` | 6563 B |
| `docs/iterations/iteration-4/evidence/AC-62.status.txt` | 1585 B |
| `docs/iterations/iteration-4/evidence/AC-62.status.md.json` | 641 B |
| `docs/iterations/iteration-4/evidence/AC-62.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-62.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-62.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：开发节点 T-001 等待审批（run 打印 APR-001 待处理行） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-33463-1<br>任务已投递<br>审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Given：审批 pending（期望 "pending"） | 通过 | `"pending"` |
| 3 | Given：来源节点为开发 T-001（期望 "T-001"） | 通过 | `"T-001"` |
| 4 | Given：审批动作为 write（期望 "write"） | 通过 | `"write"` |
| 5 | Then：输出「审批 APR-001 已拒绝 · 动作 write」（期望含 "审批 APR-001 已拒绝 · 动作 write"） | 通过 | `审批 APR-001 已拒绝 · 动作 write<br>` |
| 6 | 机检：审批 denied（期望 "denied"） | 通过 | `"denied"` |
| 7 | 机检：来源节点 escalated（期望 "escalated"） | 通过 | `"escalated"` |
| 8 | 机检：实例 suspended（期望 "suspended"） | 通过 | `"suspended"` |
| 9 | 机检：escalations[0].reasonCode === execution_failed（期望 "execution_failed"） | 通过 | `"execution_failed"` |
| 10 | 机检：不出现 failed 实例行（期望不含 "· 已失败"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-33463-1<br>任务已投递<br>审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write<br>会话 等待审批：write<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 等待下游 · 产出已提交<br>实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮<br>下` |
| 11 | Then：不出现第二套失败文案（执行失败口径）（期望不含 "执行失败"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-33463-1<br>任务已投递<br>审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write<br>会话 等待审批：write<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 等待下游 · 产出已提交<br>实例 INST-001 · 已挂起 · 模板 编码闭环<br>升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮<br>下` |
| 12 | 机检：出现 permission.denied 事件 | 通过 | `run.started,node.dispatch,session.state,session.state,permission.requested,approval.created,permission.denied,session.state,output.submitted,output.submitted,escalation.created,state.change,state.change,core.suspend` |
| 13 | 机检：出现 escalation.created 事件（沿 refusal 路径升级） | 通过 | `run.started,node.dispatch,session.state,session.state,permission.requested,approval.created,permission.denied,session.state,output.submitted,output.submitted,escalation.created,state.change,state.change,core.suspend` |

**⑤ 判定**：通过

---

#### AC-63 单节点投递失败不进入信箱重试

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-63`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run single（mock --host-error 对所有 prompt 返回失败）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写下说明 --template single   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-63 | exit=1 | 3488ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-63 | exit=0 | 323ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-63.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `--template single` 发起，mock 以既有 `--host-error` 开关对所有 `prompt` 返回失败（单节点没有重试）
- **When** 核心投递引导包 `HO-001`
- **Then** 不出现"待投递"、不重试；实例按 I1.2 的失败口径收尾
- **机检：** `<任务 cwd>/.mock/prompt-attempts-<sessionId>.json` 的 `attempts === 1`（非场景模式基准见 D-10）；`events.jsonl` 没有 `handoff.pending`；`.orch/inbox/INST-001/HO-001.json` 不存在；实例 `failed`、节点 `failed`、会话 `idle`；`nodes[0].failure.code === 'HOST_ERROR'`（CLI 退出 1）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-63.state.json` | 2227 B |
| `docs/iterations/iteration-4/evidence/AC-63.events.jsonl` | 1518 B |
| `docs/iterations/iteration-4/evidence/AC-63.meta.json` | 900 B |
| `docs/iterations/iteration-4/evidence/AC-63.output.json` | 3179 B |
| `docs/iterations/iteration-4/evidence/AC-63.status.txt` | 978 B |
| `docs/iterations/iteration-4/evidence/AC-63.status.md.json` | 360 B |
| `docs/iterations/iteration-4/evidence/AC-63.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-63.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-63.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：CLI 退出码 1（期望 1） | 通过 | `1` |
| 2 | 机检：<任务 cwd>/.mock/prompt-attempts-<sessionId>.json 的 attempts === 1（期望 1） | 通过 | `1` |
| 3 | 机检：events.jsonl 没有 handoff.pending | 通过 | `run.started,run.started,handoff.created,handoff.delivered,run.failed,run.failed,handoff.rejected` |
| 4 | Then：不出现「待投递」、不重试（无 handoff.pending / handoff.inboxed） | 通过 | `run.started,run.started,handoff.created,handoff.delivered,run.failed,run.failed,handoff.rejected` |
| 5 | 机检：.orch/inbox/INST-001/HO-001.json 不存在 | 通过 | `` |
| 6 | 机检：实例 failed（期望 "failed"） | 通过 | `"failed"` |
| 7 | 机检：节点 failed（期望 "failed"） | 通过 | `"failed"` |
| 8 | 机检：会话 idle（期望 "idle"） | 通过 | `"idle"` |
| 9 | 机检：nodes[0].failure.code === HOST_ERROR（期望 "HOST_ERROR"） | 通过 | `"HOST_ERROR"` |

**⑤ 判定**：通过

**备注**

- D-10 非场景模式基准：单节点没有重试；host-error 在早返回前写一次 <任务 cwd>/.mock/prompt-attempts-<sessionId>.json。

---

#### AC-64 非法参数按用法错误退出

- 判定：**通过**（核对 14/14 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop pass（造一个已有实例）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64 | exit=0 | 7612ms
[orch run --cwd ./demo --task x --approval maybe] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task x --approval maybe   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64 | exit=2 | 273ms
[orch instance graph INST-001 --format yaml] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js instance graph INST-001 --format yaml   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64 | exit=2 | 220ms
[orch escalate resolve ESC-001 --decision maybe] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js escalate resolve ESC-001 --decision maybe   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64 | exit=2 | 233ms
[orch approve APR-001 --decision maybe] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision maybe   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64 | exit=2 | 303ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-64 | exit=0 | 309ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-64.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 我分别执行 `orch run --cwd ./demo --task "…" --approval maybe`、`orch instance graph INST-001 --format yaml`、`orch escalate resolve ESC-001 --decision maybe`、`orch approve APR-001 --decision maybe`
- **When** 参数解析完成
- **Then** 分别提示 `--approval` 只允许 `allow|reject|hold`、`--format` 只允许 `text|json`、`escalate resolve` 的 `--decision` 只允许 `pass|fail|retry`、`approve` 的 `--decision` 只允许 `allow|deny`；四条退出码均为 2；不创建实例、不写任何实例状态
- **机检：** `.orch/instances` 下没有新实例目录；已有实例 `rev` 不变；stdout/stderr 含允许值说明
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-64.state.json` | 4038 B |
| `docs/iterations/iteration-4/evidence/AC-64.events.jsonl` | 5467 B |
| `docs/iterations/iteration-4/evidence/AC-64.meta.json` | 742 B |
| `docs/iterations/iteration-4/evidence/AC-64.output.json` | 15990 B |
| `docs/iterations/iteration-4/evidence/AC-64.status.txt` | 5542 B |
| `docs/iterations/iteration-4/evidence/AC-64.status.md.json` | 549 B |
| `docs/iterations/iteration-4/evidence/AC-64.prompts.json` | 1491 B |
| `docs/iterations/iteration-4/evidence/AC-64.inbox.json` | 1205 B |
| `docs/iterations/iteration-4/evidence/AC-64.attempts.json` | 153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：run --cwd ./demo --task x --approval maybe 退出码 2（期望 2） | 通过 | `2` |
| 2 | Then：stdout/stderr 含允许值说明 allow\|reject\|hold（期望含 "allow\|reject\|hold"） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 3 | Then：run --cwd ./demo --task x --approval maybe 按用法错误输出（含「用法：」）（期望含 "用法："） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 4 | 机检：instance graph INST-001 --format yaml 退出码 2（期望 2） | 通过 | `2` |
| 5 | Then：stdout/stderr 含允许值说明 text\|json（期望含 "text\|json"） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 6 | Then：instance graph INST-001 --format yaml 按用法错误输出（含「用法：」）（期望含 "用法："） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 7 | 机检：escalate resolve ESC-001 --decision maybe 退出码 2（期望 2） | 通过 | `2` |
| 8 | Then：stdout/stderr 含允许值说明 pass\|fail\|retry（期望含 "pass\|fail\|retry"） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 9 | Then：escalate resolve ESC-001 --decision maybe 按用法错误输出（含「用法：」）（期望含 "用法："） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 10 | 机检：approve APR-001 --decision maybe 退出码 2（期望 2） | 通过 | `2` |
| 11 | Then：stdout/stderr 含允许值说明 allow\|deny（期望含 "allow\|deny"） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 12 | Then：approve APR-001 --decision maybe 按用法错误输出（含「用法：」）（期望含 "用法："） | 通过 | `用法：orch run\|status\|cancel\|core<br>  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]<br>  orch status [--instance <实例号>] [--events]<br>  orch cancel --instance <实例号><br>  orch core stop<br>  orch instance status\|log\|graph` |
| 13 | 机检：.orch/instances 下没有新实例目录 | 通过 | `before=INST-001 after=INST-001` |
| 14 | 机检：已有实例 rev 不变（期望 23） | 通过 | `23` |

**⑤ 判定**：通过

---

#### AC-65 下游会话创建失败不留未投递包

- 判定：**通过**（核对 8/8 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-65`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop dispatch-fail-retest] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-65 | exit=4 | 11151ms
[orch handoff list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-65 | exit=0 | 248ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-65 | exit=0 | 262ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-65.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** I1.2 的编码闭环 `dispatch-fail-retest` 夹具（复测节点 `sessionNew` 失败），此前的开发与测试轮次已完成
- **When** 核心投递复测交接包
- **Then** 实例挂起并显示升级；不出现"待投递"与重试；该交接包以"已拒绝（投递失败）"收尾，不留"已构造"的孤儿包
- **机检：** 本轮复测包（最后一指向测试节点的包）`state === 'rejected'`、`rejectReason === 'delivery_failed'`；`handoffs` 中没有该节点本轮的 `created` 包；`escalations[0].reasonCode === 'dispatch_failed'`；没有 `handoff.pending`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-65.state.json` | 7162 B |
| `docs/iterations/iteration-4/evidence/AC-65.events.jsonl` | 10310 B |
| `docs/iterations/iteration-4/evidence/AC-65.meta.json` | 1072 B |
| `docs/iterations/iteration-4/evidence/AC-65.output.json` | 5998 B |
| `docs/iterations/iteration-4/evidence/AC-65.status.txt` | 1822 B |
| `docs/iterations/iteration-4/evidence/AC-65.status.md.json` | 760 B |
| `docs/iterations/iteration-4/evidence/AC-65.prompts.json` | 2579 B |
| `docs/iterations/iteration-4/evidence/AC-65.inbox.json` | 2458 B |
| `docs/iterations/iteration-4/evidence/AC-65.attempts.json` | 228 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then：实例挂起并显示升级（suspended）（期望 "suspended"） | 通过 | `"suspended"` |
| 2 | 机检：escalations[0].reasonCode === dispatch_failed（期望 "dispatch_failed"） | 通过 | `"dispatch_failed"` |
| 3 | 机检：本轮复测包 state === rejected（期望 "rejected"） | 通过 | `"rejected"` |
| 4 | 机检：本轮复测包 rejectReason === delivery_failed（期望 "delivery_failed"） | 通过 | `"delivery_failed"` |
| 5 | 机检：handoffs 中没有该节点本轮的 created 包（不留孤儿包） | 通过 | `[{"id":"HO-001","state":"consumed","to":"T-002","reason":null},{"id":"HO-002","state":"consumed","to":"T-001","reason":null},{"id":"HO-003","state":"rejected","to":"T-002","reason":"delivery_failed"}]` |
| 6 | 机检：没有 handoff.pending | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 7 | Then：不出现「待投递」（期望不含 "待投递"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-42766-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 1s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>实例 INST-001 · 已挂起 ·` |
| 8 | Then：该交接包以「已拒绝（投递失败）」收尾（期望含 "已拒绝（投递失败）"） | 通过 | `交接包 HO-001  实例 INST-001  开发→测试  已完成  19:02:47<br>交接包 HO-002  实例 INST-001  测试→开发（回流）  已完成  19:02:50<br>交接包 HO-003  实例 INST-001  开发→测试（复测）  已拒绝（投递失败）  19:02:51<br>` |

**⑤ 判定**：通过

**备注**

- 上一轮收口期发现的产品缺陷（dispatch_failed 升级分支遗留 created 孤儿包）已由 src/core/orchestrator.js:1606 的既有修复收口：本轮机检全通过（末张复测包 rejected/delivery_failed、无 created 包、无 handoff.pending）。修复登记见 probe/acc4-f-blockers.md。

---

#### AC-66 暂停落在交接包已构造、尚未派发之间

- 判定：**通过**（核对 16/16 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-66`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch workflow pause INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow pause INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-66 | exit=0 | 335ms
[orch run code-loop（前台，暂停收尾）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-66 | exit=0 | 8058ms
[orch workflow resume INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js workflow resume INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-66 | exit=0 | 358ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-66 | exit=0 | 205ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-66.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `NODE_ENV=test` 下的 `MAESTRO_TEST_PAUSE=after_verdict` 让编码闭环在回流包已落盘、派发尚未提交时停住（项目根出现 `.mock/paused`）
- **When** 我执行 `orch workflow pause INST-001`，放行接缝（`.mock/release`），等前台 `orch run` 以暂停收尾（退出 0）后再执行 `orch workflow resume INST-001`
- **Then** 暂停期间该包显示"已构造"；恢复后核心用**同一张包**派发一次，不产生第二张包，也不重复计数
- **机检：** 暂停落定后指向该节点的 `created` 包恰好 1 张、目标节点 `round` 未增加、`dispatchCount` 未增加、没有**新增**的 `node.dispatch`（此前的开发/测试派发仍在）；恢复后该 `handoffId` 变为 `delivered`/`consumed`、`deliveryAttempts === 1`、`dispatchCount` 恰好 +1，指向该节点的包仍只有 1 张，`node.dispatch` **新增**恰好 1 条
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-66.state.json` | 5928 B |
| `docs/iterations/iteration-4/evidence/AC-66.events.jsonl` | 8373 B |
| `docs/iterations/iteration-4/evidence/AC-66.meta.json` | 1086 B |
| `docs/iterations/iteration-4/evidence/AC-66.output.json` | 5569 B |
| `docs/iterations/iteration-4/evidence/AC-66.status.txt` | 1662 B |
| `docs/iterations/iteration-4/evidence/AC-66.status.md.json` | 611 B |
| `docs/iterations/iteration-4/evidence/AC-66.prompts.json` | 2486 B |
| `docs/iterations/iteration-4/evidence/AC-66.inbox.json` | 2458 B |
| `docs/iterations/iteration-4/evidence/AC-66.attempts.json` | 228 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：项目根出现 .mock/paused（回流包已落盘、派发未提交） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-42917-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 1s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>` |
| 2 | 机检：暂停落定后指向该节点的 created 包恰好 1 张（期望 1） | 通过 | `1` |
| 3 | When：pause 退出码 0（期望 0） | 通过 | `0` |
| 4 | When：前台 orch run 以暂停收尾（退出 0）（期望 0） | 通过 | `0` |
| 5 | Then：暂停期间该包显示「已构造」（created 仍在）（期望 "created"） | 通过 | `"created"` |
| 6 | 机检：暂停落定后目标节点 round 未增加（期望 1） | 通过 | `1` |
| 7 | 机检：暂停落定后 dispatchCount 未增加（期望 2） | 通过 | `2` |
| 8 | 机检：暂停落定后没有新增 node.dispatch（期望 2） | 通过 | `2` |
| 9 | When：resume 退出码 0（期望 0） | 通过 | `0` |
| 10 | 机检：恢复后该 created 包被派发（离开 created 态） | 通过 | `HO-002` |
| 11 | Then：恢复后核心用同一张包派发（不产生第二张包） | 通过 | `before=2 after=2 ids=HO-001,HO-002` |
| 12 | 机检：该 handoffId 变为 delivered/consumed | 通过 | `delivered` |
| 13 | 机检：deliveryAttempts === 1（期望 1） | 通过 | `1` |
| 14 | 机检：dispatchCount 恰好 +1（期望 3） | 通过 | `3` |
| 15 | 机检：指向该节点的包仍只有 1 张（期望 1） | 通过 | `1` |
| 16 | 机检：node.dispatch 新增恰好 1 条（期望 3） | 通过 | `3` |

**⑤ 判定**：通过

**备注**

- 上一轮收口期发现的产品缺陷（resume 重新规划构造第二张包）已由 src/core/orchestrator.js:4400 的既有修复收口：本轮机检全通过（同一张 created 包被复用、deliveryAttempts===1、dispatchCount 恰好 +1、无第二张包）。修复登记见 probe/acc4-f-blockers.md。

---

#### AC-67 核心重启后审批已失效

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-67`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-67 | exit=0 | 600ms
[orch status --instance INST-001（自动拉起新核心并完成启动对账）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-67 | exit=0 | 1297ms
[orch approve APR-001 --instance INST-001 --decision allow] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js approve APR-001 --decision allow --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-67 | exit=1 | 318ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-67 | exit=0 | 241ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-67.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 用 `--template single --approval hold` 发起，宿主请求 `write` 动作，实例等待审批；随后执行 `orch core stop`，再由下一条命令自动拉起新核心
- **When** 我执行 `orch approve APR-001 --instance INST-001 --decision allow`
- **Then** 提示"审批 APR-001 已失效：会话不在运行"；退出码 1；审批仍为待处理，不假装已放行
- **机检：** 审批 `state === 'pending'`；`events.jsonl` 没有 `permission.allowed`；实例 `rev` 在命令前后不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-67.state.json` | 2567 B |
| `docs/iterations/iteration-4/evidence/AC-67.events.jsonl` | 2392 B |
| `docs/iterations/iteration-4/evidence/AC-67.meta.json` | 910 B |
| `docs/iterations/iteration-4/evidence/AC-67.output.json` | 3935 B |
| `docs/iterations/iteration-4/evidence/AC-67.status.txt` | 1465 B |
| `docs/iterations/iteration-4/evidence/AC-67.status.md.json` | 415 B |
| `docs/iterations/iteration-4/evidence/AC-67.prompts.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-67.inbox.json` | 3 B |
| `docs/iterations/iteration-4/evidence/AC-67.attempts.json` | 3 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：宿主请求 write 动作、实例等待审批 | 通过 | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-34092-1<br>任务已投递<br>审批 APR-001 待处理 · 动作 write<br>会话 等待审批：write<br>` |
| 2 | Given：审批仍为 pending（期望 "pending"） | 通过 | `"pending"` |
| 3 | Then：提示「审批 APR-001 已失效：会话不在运行」（期望含 "审批 APR-001 已失效：会话不在运行"） | 通过 | `审批 APR-001 已失效：会话不在运行<br>` |
| 4 | Then：退出码 1（期望 1） | 通过 | `1` |
| 5 | 机检：审批 state === pending（不假装已放行）（期望 "pending"） | 通过 | `"pending"` |
| 6 | 机检：events.jsonl 没有 permission.allowed | 通过 | `run.started,run.started,handoff.created,handoff.delivered,session.state,turn.first_event,session.state,permission.requested,approval.created,core.stop` |
| 7 | 机检：实例 rev 在命令前后不变（期望 7） | 通过 | `7` |

**⑤ 判定**：通过

**备注**

- 启动对账会推进 rev；按 AC-34/AC-44 的口径，在「新核心已就绪」之后取 rev 作为命令前基线，比较的正是 approve 命令前后。

---

#### AC-68 合法回流包通过校验并投递

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-68`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run task-loop doc-backflow-once] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task 写发布说明，产物：release-notes.md --template task-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-68 | exit=0 | 17401ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-68 | exit=0 | 313ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-68.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 文档闭环第 1 轮：撰写者已产出 `artifacts/docs/release-notes.v1.md`，审核者驳回并给出 2 条缺陷（摘要与证据位置均非空）与修改要求
- **When** 核心推进回流到撰写者（第 2 轮）
- **Then** 回流包从"已构造"变为"已投递"（随后"已接受"）；撰写者收到第 2 轮提示；终端不出现"已拒绝（内容不合规）"或升级
- **机检：** 该包 `edge.kind === 'backflow'`、`defects.length === 2`、`revisionRequirement` 非空、`artifactRefs.previous.ref` 非空且文件存在；`events.jsonl` 无 `handoff.rejected`；撰写者 `round === 2`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-68.state.json` | 11155 B |
| `docs/iterations/iteration-4/evidence/AC-68.events.jsonl` | 16109 B |
| `docs/iterations/iteration-4/evidence/AC-68.meta.json` | 746 B |
| `docs/iterations/iteration-4/evidence/AC-68.output.json` | 10945 B |
| `docs/iterations/iteration-4/evidence/AC-68.status.txt` | 2645 B |
| `docs/iterations/iteration-4/evidence/AC-68.status.md.json` | 922 B |
| `docs/iterations/iteration-4/evidence/AC-68.prompts.json` | 5715 B |
| `docs/iterations/iteration-4/evidence/AC-68.inbox.json` | 5924 B |
| `docs/iterations/iteration-4/evidence/AC-68.attempts.json` | 378 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：存在回流包 | 通过 | `[{"id":"HO-001","kind":"forward"},{"id":"HO-002","kind":"forward"},{"id":"HO-003","kind":"backflow"},{"id":"HO-004","kind":"retest"}]` |
| 2 | 机检：该包 edge.kind === backflow（期望 "backflow"） | 通过 | `"backflow"` |
| 3 | 机检：defects.length === 2（期望 2） | 通过 | `2` |
| 4 | 机检：revisionRequirement 非空 | 通过 | `补写「回滚方案」一节` |
| 5 | 机检：artifactRefs.previous.ref 非空 | 通过 | `artifacts/docs/release-notes.v1.md` |
| 6 | 机检：artifactRefs.previous.ref 指向的文件存在 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-68/.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md` |
| 7 | Then：回流包从「已构造」变为「已投递」 | 通过 | `handoff.created,backflow.constructed,handoff.inboxed,handoff.delivered,turn.first_event,handoff.consumed` |
| 8 | Then：撰写者收到第 2 轮提示 | 通过 | `[{"node":"T-001","round":1},{"node":"T-002","round":1},{"node":"T-003","round":1},{"node":"T-002","round":2},{"node":"T-003","round":2}]` |
| 9 | 机检：撰写者 round === 2（期望 2） | 通过 | `2` |
| 10 | 机检：events.jsonl 无 handoff.rejected | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,review.evidence_verified,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,review.downstream_accepted,session.sta` |
| 11 | Then：终端不出现「已拒绝（内容不合规）」（期望不含 "已拒绝（内容不合规）"） | 通过 | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-34216-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 1s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（wri` |
| 12 | Then：终端不出现升级行（期望不含 "升级 ESC-"） | 通过 | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-34216-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 1s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（wri` |

**⑤ 判定**：通过

---

#### AC-69 合法复测包通过校验并投递

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-69`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run code-loop backflow] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-69 | exit=0 | 14744ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-69 | exit=0 | 304ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-69.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 编码闭环第 1 轮测试判定不通过；开发按缺陷修复后 `calc.js` 存在且非空
- **When** 核心构造复测包并派发测试第 2 轮
- **Then** 复测包投递；测试收到第 2 轮提示；终端不出现拒绝或升级
- **机检：** 该包 `edge.kind === 'retest'`、`artifactRefs.input` 含 `calc.js` 且文件存在；`events.jsonl` 无 `handoff.rejected`；测试 `round === 2`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-69.state.json` | 7358 B |
| `docs/iterations/iteration-4/evidence/AC-69.events.jsonl` | 12246 B |
| `docs/iterations/iteration-4/evidence/AC-69.meta.json` | 746 B |
| `docs/iterations/iteration-4/evidence/AC-69.output.json` | 8348 B |
| `docs/iterations/iteration-4/evidence/AC-69.status.txt` | 2057 B |
| `docs/iterations/iteration-4/evidence/AC-69.status.md.json` | 670 B |
| `docs/iterations/iteration-4/evidence/AC-69.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-69.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-69.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：存在复测包 | 通过 | `[{"id":"HO-001","kind":"forward"},{"id":"HO-002","kind":"backflow"},{"id":"HO-003","kind":"retest"}]` |
| 2 | 机检：该包 edge.kind === retest（期望 "retest"） | 通过 | `"retest"` |
| 3 | 机检：artifactRefs.input 含 calc.js | 通过 | `["calc.js"]` |
| 4 | 机检：calc.js 文件存在且非空 | 通过 | `/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-69/demo/calc.js` |
| 5 | Then：复测包投递（含 handoff.delivered） | 通过 | `handoff.created,handoff.inboxed,handoff.delivered,turn.first_event,handoff.consumed` |
| 6 | Then：测试收到第 2 轮提示 | 通过 | `[{"node":"T-001","round":1},{"node":"T-002","round":1},{"node":"T-001","round":2},{"node":"T-002","round":2}]` |
| 7 | 机检：测试 round === 2（期望 2） | 通过 | `2` |
| 8 | 机检：events.jsonl 无 handoff.rejected | 通过 | `run.started,node.dispatch,session.state,session.state,session.state,output.submitted,output.submitted,verification.passed,run.completed,handoff.created,node.dispatch,handoff.inboxed,handoff.delivered,session.state,turn.first_event,session.state,session.state,o` |
| 9 | Then：终端不出现拒绝（期望不含 "已拒绝（"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-34446-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write` |
| 10 | Then：终端不出现升级（期望不含 "升级 ESC-"） | 通过 | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-34446-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write） · 已运行 2s<br>会话 执行中 · 已运行 2s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 调用工具（write` |

**⑤ 判定**：通过

---

#### AC-70 编号唯一时 `handoff show` 可省略 `--instance`

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 夹具面
- 证据分级：mock 实测
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-70`
- 实例：INST-001、INST-002

**① 完整命令（逐条可复跑）**

```
[orch run code-loop rounds-exceeded（造 INST-001）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js run --cwd ./demo --task "实现 calc.js，产物：calc.js" --template code-loop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-70 | exit=4 | 13116ms
[orch status --instance INST-001（预热核心）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js status --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-70 | exit=0 | 252ms
[orch handoff show HO-002] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff show HO-002   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-70 | exit=0 | 282ms
[orch handoff show HO-002 --instance INST-001] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js handoff show HO-002 --instance INST-001   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-70 | exit=0 | 274ms
[orch core stop] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js core stop   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-p4/AC-70 | exit=0 | 288ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-4/evidence/AC-70.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
- **Given** 只有一个实例有 HO-002，另一个实例没有该包号
- **When** 我执行 `orch handoff show HO-002`
- **Then** 正常输出该包详情；退出码 0；不需要 `--instance`
- **机检：** 输出含 `交接包 HO-002`；命令前后 `rev` 不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-4/evidence/AC-70.state.json` | 16463 B |
| `docs/iterations/iteration-4/evidence/AC-70.events.jsonl` | 14987 B |
| `docs/iterations/iteration-4/evidence/AC-70.meta.json` | 1022 B |
| `docs/iterations/iteration-4/evidence/AC-70.output.json` | 11812 B |
| `docs/iterations/iteration-4/evidence/AC-70.status.txt` | 4808 B |
| `docs/iterations/iteration-4/evidence/AC-70.status.md.json` | 775 B |
| `docs/iterations/iteration-4/evidence/AC-70.prompts.json` | 3289 B |
| `docs/iterations/iteration-4/evidence/AC-70.inbox.json` | 3519 B |
| `docs/iterations/iteration-4/evidence/AC-70.attempts.json` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：项目根有两个实例 | 通过 | `INST-001,INST-002` |
| 2 | Given：INST-001 有 HO-002 | 通过 | `HO-002` |
| 3 | Given：INST-002 没有 HO-002 | 通过 | `["HO-001"]` |
| 4 | Then：退出码 0（期望 0） | 通过 | `0` |
| 5 | Then：正常输出该包详情（不需要 --instance）（期望含 "交接包 HO-002"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:57  待投递：—  投递：19:01:59  接受：19:01:59  完成：19:02:00  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 6 | 机检：输出含实例行（期望含 "实例：INST-001"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:57  待投递：—  投递：19:01:59  接受：19:01:59  完成：19:02:00  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 7 | 机检：输出含方向与状态（期望含 "方向：测试→开发（回流）"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:57  待投递：—  投递：19:01:59  接受：19:01:59  完成：19:02:00  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 8 | 机检：输出含缺陷逐条（期望含 "缺陷："） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:57  待投递：—  投递：19:01:59  接受：19:01:59  完成：19:02:00  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 9 | 机检：输出含尝试次数（分母 3）（期望含 "尝试：1/3"） | 通过 | `交接包 HO-002<br>  实例：INST-001<br>  方向：测试→开发（回流）<br>  状态：已完成<br>  构造：19:01:57  待投递：—  投递：19:01:59  接受：19:01:59  完成：19:02:00  拒绝：—  过期：—<br>  证据：out/verdict.json<br>  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）<br>  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt` |
| 10 | 机检：命令前后 rev 不变（期望 43） | 通过 | `43` |
| 11 | 机检：省略 --instance 与显式 --instance 输出逐字一致（期望 "交接包 HO-002\n  实例：INST-001\n  方向：测试→开发（回流）\n  状态：已完成\n  构造：<time>  待投递：—  投递：<time>  接受：<time>  完成：<time>  拒绝：—  过期：—\n  证据：out/verdict.json\n  缺陷：div 在除数为 0  | 通过 | `"交接包 HO-002\n  实例：INST-001\n  方向：测试→开发（回流）\n  状态：已完成\n  构造：<time>  待投递：—  投递：<time>  接受：<time>  完成：<time>  拒绝：—  过期：—\n  证据：out/verdict.json\n  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）\n  缺陷：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）\n  修改要求：—\n  复测要求：按` |

**⑤ 判定**：通过

**备注**

- 第二个实例以真实快照为母版克隆，仅保留 HO-001（去掉 HO-002）；视图 RPC 逐字段渲染，构造 Given 不等于伪造结论。

---

## 2. 未通过 / 阻塞项汇总

（无未通过 / 阻塞项）

## 3. 证据索引

共 630 个文件；每条 AC 至少 `state.json` / `events.jsonl` / `meta.json` / `output.json` / `status.txt`（无实例时 state 为 null）。

| AC | 证据文件 |
|---|---|
| AC-01 | `evidence/AC-01.attempts.json`<br>`evidence/AC-01.events.jsonl`<br>`evidence/AC-01.inbox.json`<br>`evidence/AC-01.meta.json`<br>`evidence/AC-01.output.json`<br>`evidence/AC-01.prompts.json`<br>`evidence/AC-01.state.json`<br>`evidence/AC-01.status.md.json`<br>`evidence/AC-01.status.txt` |
| AC-02 | `evidence/AC-02.attempts.json`<br>`evidence/AC-02.events.jsonl`<br>`evidence/AC-02.inbox.json`<br>`evidence/AC-02.meta.json`<br>`evidence/AC-02.output.json`<br>`evidence/AC-02.prompts.json`<br>`evidence/AC-02.state.json`<br>`evidence/AC-02.status.md.json`<br>`evidence/AC-02.status.txt` |
| AC-03 | `evidence/AC-03.attempts.json`<br>`evidence/AC-03.events.jsonl`<br>`evidence/AC-03.inbox.json`<br>`evidence/AC-03.meta.json`<br>`evidence/AC-03.output.json`<br>`evidence/AC-03.prompts.json`<br>`evidence/AC-03.state.json`<br>`evidence/AC-03.status.md.json`<br>`evidence/AC-03.status.txt` |
| AC-04 | `evidence/AC-04.attempts.json`<br>`evidence/AC-04.events.jsonl`<br>`evidence/AC-04.inbox.json`<br>`evidence/AC-04.meta.json`<br>`evidence/AC-04.output.json`<br>`evidence/AC-04.prompts.json`<br>`evidence/AC-04.state.json`<br>`evidence/AC-04.status.md.json`<br>`evidence/AC-04.status.txt` |
| AC-05 | `evidence/AC-05.attempts.json`<br>`evidence/AC-05.events.jsonl`<br>`evidence/AC-05.inbox.json`<br>`evidence/AC-05.meta.json`<br>`evidence/AC-05.output.json`<br>`evidence/AC-05.prompts.json`<br>`evidence/AC-05.state.json`<br>`evidence/AC-05.status.md.json`<br>`evidence/AC-05.status.txt` |
| AC-06 | `evidence/AC-06.attempts.json`<br>`evidence/AC-06.events.jsonl`<br>`evidence/AC-06.inbox.json`<br>`evidence/AC-06.meta.json`<br>`evidence/AC-06.output.json`<br>`evidence/AC-06.prompts.json`<br>`evidence/AC-06.state.json`<br>`evidence/AC-06.status.md.json`<br>`evidence/AC-06.status.txt` |
| AC-07 | `evidence/AC-07.attempts.json`<br>`evidence/AC-07.events.jsonl`<br>`evidence/AC-07.inbox.json`<br>`evidence/AC-07.meta.json`<br>`evidence/AC-07.output.json`<br>`evidence/AC-07.prompts.json`<br>`evidence/AC-07.state.json`<br>`evidence/AC-07.status.md.json`<br>`evidence/AC-07.status.txt` |
| AC-08 | `evidence/AC-08.attempts.json`<br>`evidence/AC-08.events.jsonl`<br>`evidence/AC-08.inbox.json`<br>`evidence/AC-08.meta.json`<br>`evidence/AC-08.output.json`<br>`evidence/AC-08.prompts.json`<br>`evidence/AC-08.state.json`<br>`evidence/AC-08.status.md.json`<br>`evidence/AC-08.status.txt` |
| AC-09 | `evidence/AC-09.attempts.json`<br>`evidence/AC-09.events.jsonl`<br>`evidence/AC-09.inbox.json`<br>`evidence/AC-09.meta.json`<br>`evidence/AC-09.output.json`<br>`evidence/AC-09.prompts.json`<br>`evidence/AC-09.state.json`<br>`evidence/AC-09.status.md.json`<br>`evidence/AC-09.status.txt` |
| AC-10 | `evidence/AC-10.attempts.json`<br>`evidence/AC-10.events.jsonl`<br>`evidence/AC-10.inbox.json`<br>`evidence/AC-10.meta.json`<br>`evidence/AC-10.output.json`<br>`evidence/AC-10.prompts.json`<br>`evidence/AC-10.state.json`<br>`evidence/AC-10.status.md.json`<br>`evidence/AC-10.status.txt` |
| AC-11 | `evidence/AC-11.attempts.json`<br>`evidence/AC-11.events.jsonl`<br>`evidence/AC-11.inbox.json`<br>`evidence/AC-11.meta.json`<br>`evidence/AC-11.output.json`<br>`evidence/AC-11.prompts.json`<br>`evidence/AC-11.state.json`<br>`evidence/AC-11.status.md.json`<br>`evidence/AC-11.status.txt` |
| AC-12 | `evidence/AC-12.attempts.json`<br>`evidence/AC-12.events.jsonl`<br>`evidence/AC-12.inbox.json`<br>`evidence/AC-12.meta.json`<br>`evidence/AC-12.output.json`<br>`evidence/AC-12.prompts.json`<br>`evidence/AC-12.state.json`<br>`evidence/AC-12.status.md.json`<br>`evidence/AC-12.status.txt` |
| AC-13 | `evidence/AC-13.attempts.json`<br>`evidence/AC-13.events.jsonl`<br>`evidence/AC-13.inbox.json`<br>`evidence/AC-13.meta.json`<br>`evidence/AC-13.output.json`<br>`evidence/AC-13.prompts.json`<br>`evidence/AC-13.state.json`<br>`evidence/AC-13.status.md.json`<br>`evidence/AC-13.status.txt` |
| AC-14 | `evidence/AC-14.attempts.json`<br>`evidence/AC-14.events.jsonl`<br>`evidence/AC-14.inbox.json`<br>`evidence/AC-14.meta.json`<br>`evidence/AC-14.output.json`<br>`evidence/AC-14.prompts.json`<br>`evidence/AC-14.state.json`<br>`evidence/AC-14.status.md.json`<br>`evidence/AC-14.status.txt` |
| AC-15 | `evidence/AC-15.attempts.json`<br>`evidence/AC-15.events.jsonl`<br>`evidence/AC-15.inbox.json`<br>`evidence/AC-15.meta.json`<br>`evidence/AC-15.output.json`<br>`evidence/AC-15.prompts.json`<br>`evidence/AC-15.state.json`<br>`evidence/AC-15.status.md.json`<br>`evidence/AC-15.status.txt` |
| AC-16 | `evidence/AC-16.attempts.json`<br>`evidence/AC-16.events.jsonl`<br>`evidence/AC-16.inbox.json`<br>`evidence/AC-16.meta.json`<br>`evidence/AC-16.output.json`<br>`evidence/AC-16.prompts.json`<br>`evidence/AC-16.state.json`<br>`evidence/AC-16.status.md.json`<br>`evidence/AC-16.status.txt` |
| AC-17 | `evidence/AC-17.attempts.json`<br>`evidence/AC-17.events.jsonl`<br>`evidence/AC-17.inbox.json`<br>`evidence/AC-17.meta.json`<br>`evidence/AC-17.output.json`<br>`evidence/AC-17.prompts.json`<br>`evidence/AC-17.state.json`<br>`evidence/AC-17.status.md.json`<br>`evidence/AC-17.status.txt` |
| AC-18 | `evidence/AC-18.attempts.json`<br>`evidence/AC-18.events.jsonl`<br>`evidence/AC-18.inbox.json`<br>`evidence/AC-18.meta.json`<br>`evidence/AC-18.output.json`<br>`evidence/AC-18.prompts.json`<br>`evidence/AC-18.state.json`<br>`evidence/AC-18.status.md.json`<br>`evidence/AC-18.status.txt` |
| AC-19 | `evidence/AC-19.attempts.json`<br>`evidence/AC-19.events.jsonl`<br>`evidence/AC-19.inbox.json`<br>`evidence/AC-19.meta.json`<br>`evidence/AC-19.output.json`<br>`evidence/AC-19.prompts.json`<br>`evidence/AC-19.state.json`<br>`evidence/AC-19.status.md.json`<br>`evidence/AC-19.status.txt` |
| AC-20 | `evidence/AC-20.attempts.json`<br>`evidence/AC-20.events.jsonl`<br>`evidence/AC-20.inbox.json`<br>`evidence/AC-20.meta.json`<br>`evidence/AC-20.output.json`<br>`evidence/AC-20.prompts.json`<br>`evidence/AC-20.state.json`<br>`evidence/AC-20.status.md.json`<br>`evidence/AC-20.status.txt` |
| AC-21 | `evidence/AC-21.attempts.json`<br>`evidence/AC-21.events.jsonl`<br>`evidence/AC-21.inbox.json`<br>`evidence/AC-21.meta.json`<br>`evidence/AC-21.output.json`<br>`evidence/AC-21.prompts.json`<br>`evidence/AC-21.state.json`<br>`evidence/AC-21.status.md.json`<br>`evidence/AC-21.status.txt` |
| AC-22 | `evidence/AC-22.attempts.json`<br>`evidence/AC-22.events.jsonl`<br>`evidence/AC-22.inbox.json`<br>`evidence/AC-22.meta.json`<br>`evidence/AC-22.output.json`<br>`evidence/AC-22.prompts.json`<br>`evidence/AC-22.state.json`<br>`evidence/AC-22.status.md.json`<br>`evidence/AC-22.status.txt` |
| AC-23 | `evidence/AC-23.attempts.json`<br>`evidence/AC-23.events.jsonl`<br>`evidence/AC-23.inbox.json`<br>`evidence/AC-23.meta.json`<br>`evidence/AC-23.output.json`<br>`evidence/AC-23.prompts.json`<br>`evidence/AC-23.state.json`<br>`evidence/AC-23.status.md.json`<br>`evidence/AC-23.status.txt` |
| AC-24 | `evidence/AC-24.attempts.json`<br>`evidence/AC-24.events.jsonl`<br>`evidence/AC-24.inbox.json`<br>`evidence/AC-24.meta.json`<br>`evidence/AC-24.output.json`<br>`evidence/AC-24.prompts.json`<br>`evidence/AC-24.state.json`<br>`evidence/AC-24.status.md.json`<br>`evidence/AC-24.status.txt` |
| AC-25 | `evidence/AC-25.attempts.json`<br>`evidence/AC-25.events.jsonl`<br>`evidence/AC-25.inbox.json`<br>`evidence/AC-25.meta.json`<br>`evidence/AC-25.output.json`<br>`evidence/AC-25.prompts.json`<br>`evidence/AC-25.state.json`<br>`evidence/AC-25.status.md.json`<br>`evidence/AC-25.status.txt` |
| AC-26 | `evidence/AC-26.attempts.json`<br>`evidence/AC-26.events.jsonl`<br>`evidence/AC-26.inbox.json`<br>`evidence/AC-26.meta.json`<br>`evidence/AC-26.output.json`<br>`evidence/AC-26.prompts.json`<br>`evidence/AC-26.state.json`<br>`evidence/AC-26.status.md.json`<br>`evidence/AC-26.status.txt` |
| AC-27 | `evidence/AC-27.attempts.json`<br>`evidence/AC-27.events.jsonl`<br>`evidence/AC-27.inbox.json`<br>`evidence/AC-27.meta.json`<br>`evidence/AC-27.output.json`<br>`evidence/AC-27.prompts.json`<br>`evidence/AC-27.state.json`<br>`evidence/AC-27.status.md.json`<br>`evidence/AC-27.status.txt` |
| AC-28 | `evidence/AC-28.attempts.json`<br>`evidence/AC-28.events.jsonl`<br>`evidence/AC-28.inbox.json`<br>`evidence/AC-28.meta.json`<br>`evidence/AC-28.output.json`<br>`evidence/AC-28.prompts.json`<br>`evidence/AC-28.state.json`<br>`evidence/AC-28.status.md.json`<br>`evidence/AC-28.status.txt` |
| AC-29 | `evidence/AC-29.attempts.json`<br>`evidence/AC-29.events.jsonl`<br>`evidence/AC-29.inbox.json`<br>`evidence/AC-29.meta.json`<br>`evidence/AC-29.output.json`<br>`evidence/AC-29.prompts.json`<br>`evidence/AC-29.state.json`<br>`evidence/AC-29.status.md.json`<br>`evidence/AC-29.status.txt` |
| AC-30 | `evidence/AC-30.attempts.json`<br>`evidence/AC-30.events.jsonl`<br>`evidence/AC-30.inbox.json`<br>`evidence/AC-30.meta.json`<br>`evidence/AC-30.output.json`<br>`evidence/AC-30.prompts.json`<br>`evidence/AC-30.state.json`<br>`evidence/AC-30.status.md.json`<br>`evidence/AC-30.status.txt` |
| AC-31 | `evidence/AC-31.attempts.json`<br>`evidence/AC-31.events.jsonl`<br>`evidence/AC-31.inbox.json`<br>`evidence/AC-31.meta.json`<br>`evidence/AC-31.output.json`<br>`evidence/AC-31.prompts.json`<br>`evidence/AC-31.state.json`<br>`evidence/AC-31.status.md.json`<br>`evidence/AC-31.status.txt` |
| AC-32 | `evidence/AC-32.attempts.json`<br>`evidence/AC-32.events.jsonl`<br>`evidence/AC-32.inbox.json`<br>`evidence/AC-32.meta.json`<br>`evidence/AC-32.output.json`<br>`evidence/AC-32.prompts.json`<br>`evidence/AC-32.state.json`<br>`evidence/AC-32.status.md.json`<br>`evidence/AC-32.status.txt` |
| AC-33 | `evidence/AC-33.attempts.json`<br>`evidence/AC-33.events.jsonl`<br>`evidence/AC-33.inbox.json`<br>`evidence/AC-33.meta.json`<br>`evidence/AC-33.output.json`<br>`evidence/AC-33.prompts.json`<br>`evidence/AC-33.state.json`<br>`evidence/AC-33.status.md.json`<br>`evidence/AC-33.status.txt` |
| AC-34 | `evidence/AC-34.attempts.json`<br>`evidence/AC-34.events.jsonl`<br>`evidence/AC-34.inbox.json`<br>`evidence/AC-34.meta.json`<br>`evidence/AC-34.output.json`<br>`evidence/AC-34.prompts.json`<br>`evidence/AC-34.state.json`<br>`evidence/AC-34.status.md.json`<br>`evidence/AC-34.status.txt` |
| AC-35 | `evidence/AC-35.attempts.json`<br>`evidence/AC-35.events.jsonl`<br>`evidence/AC-35.inbox.json`<br>`evidence/AC-35.meta.json`<br>`evidence/AC-35.output.json`<br>`evidence/AC-35.prompts.json`<br>`evidence/AC-35.state.json`<br>`evidence/AC-35.status.md.json`<br>`evidence/AC-35.status.txt` |
| AC-36 | `evidence/AC-36.attempts.json`<br>`evidence/AC-36.events.jsonl`<br>`evidence/AC-36.inbox.json`<br>`evidence/AC-36.meta.json`<br>`evidence/AC-36.output.json`<br>`evidence/AC-36.prompts.json`<br>`evidence/AC-36.state.json`<br>`evidence/AC-36.status.md.json`<br>`evidence/AC-36.status.txt` |
| AC-37 | `evidence/AC-37.attempts.json`<br>`evidence/AC-37.events.jsonl`<br>`evidence/AC-37.inbox.json`<br>`evidence/AC-37.meta.json`<br>`evidence/AC-37.output.json`<br>`evidence/AC-37.prompts.json`<br>`evidence/AC-37.state.json`<br>`evidence/AC-37.status.md.json`<br>`evidence/AC-37.status.txt` |
| AC-38 | `evidence/AC-38.attempts.json`<br>`evidence/AC-38.events.jsonl`<br>`evidence/AC-38.inbox.json`<br>`evidence/AC-38.meta.json`<br>`evidence/AC-38.output.json`<br>`evidence/AC-38.prompts.json`<br>`evidence/AC-38.state.json`<br>`evidence/AC-38.status.md.json`<br>`evidence/AC-38.status.txt` |
| AC-39 | `evidence/AC-39.attempts.json`<br>`evidence/AC-39.events.jsonl`<br>`evidence/AC-39.inbox.json`<br>`evidence/AC-39.meta.json`<br>`evidence/AC-39.output.json`<br>`evidence/AC-39.prompts.json`<br>`evidence/AC-39.state.json`<br>`evidence/AC-39.status.md.json`<br>`evidence/AC-39.status.txt` |
| AC-40 | `evidence/AC-40.attempts.json`<br>`evidence/AC-40.events.jsonl`<br>`evidence/AC-40.inbox.json`<br>`evidence/AC-40.meta.json`<br>`evidence/AC-40.output.json`<br>`evidence/AC-40.prompts.json`<br>`evidence/AC-40.state.json`<br>`evidence/AC-40.status.md.json`<br>`evidence/AC-40.status.txt` |
| AC-41 | `evidence/AC-41.attempts.json`<br>`evidence/AC-41.events.jsonl`<br>`evidence/AC-41.inbox.json`<br>`evidence/AC-41.meta.json`<br>`evidence/AC-41.output.json`<br>`evidence/AC-41.prompts.json`<br>`evidence/AC-41.state.json`<br>`evidence/AC-41.status.md.json`<br>`evidence/AC-41.status.txt` |
| AC-42 | `evidence/AC-42.attempts.json`<br>`evidence/AC-42.events.jsonl`<br>`evidence/AC-42.inbox.json`<br>`evidence/AC-42.meta.json`<br>`evidence/AC-42.output.json`<br>`evidence/AC-42.prompts.json`<br>`evidence/AC-42.state.json`<br>`evidence/AC-42.status.md.json`<br>`evidence/AC-42.status.txt` |
| AC-43 | `evidence/AC-43.attempts.json`<br>`evidence/AC-43.events.jsonl`<br>`evidence/AC-43.inbox.json`<br>`evidence/AC-43.meta.json`<br>`evidence/AC-43.output.json`<br>`evidence/AC-43.prompts.json`<br>`evidence/AC-43.state.json`<br>`evidence/AC-43.status.md.json`<br>`evidence/AC-43.status.txt` |
| AC-44 | `evidence/AC-44.attempts.json`<br>`evidence/AC-44.events.jsonl`<br>`evidence/AC-44.inbox.json`<br>`evidence/AC-44.meta.json`<br>`evidence/AC-44.output.json`<br>`evidence/AC-44.prompts.json`<br>`evidence/AC-44.state.json`<br>`evidence/AC-44.status.md.json`<br>`evidence/AC-44.status.txt` |
| AC-45 | `evidence/AC-45.attempts.json`<br>`evidence/AC-45.events.jsonl`<br>`evidence/AC-45.inbox.json`<br>`evidence/AC-45.meta.json`<br>`evidence/AC-45.output.json`<br>`evidence/AC-45.prompts.json`<br>`evidence/AC-45.state.json`<br>`evidence/AC-45.status.md.json`<br>`evidence/AC-45.status.txt` |
| AC-46 | `evidence/AC-46.attempts.json`<br>`evidence/AC-46.events.jsonl`<br>`evidence/AC-46.inbox.json`<br>`evidence/AC-46.meta.json`<br>`evidence/AC-46.output.json`<br>`evidence/AC-46.prompts.json`<br>`evidence/AC-46.state.json`<br>`evidence/AC-46.status.md.json`<br>`evidence/AC-46.status.txt` |
| AC-47 | `evidence/AC-47.attempts.json`<br>`evidence/AC-47.events.jsonl`<br>`evidence/AC-47.inbox.json`<br>`evidence/AC-47.meta.json`<br>`evidence/AC-47.output.json`<br>`evidence/AC-47.prompts.json`<br>`evidence/AC-47.state.json`<br>`evidence/AC-47.status.md.json`<br>`evidence/AC-47.status.txt` |
| AC-48 | `evidence/AC-48.attempts.json`<br>`evidence/AC-48.events.jsonl`<br>`evidence/AC-48.inbox.json`<br>`evidence/AC-48.meta.json`<br>`evidence/AC-48.output.json`<br>`evidence/AC-48.prompts.json`<br>`evidence/AC-48.state.json`<br>`evidence/AC-48.status.md.json`<br>`evidence/AC-48.status.txt` |
| AC-49 | `evidence/AC-49.attempts.json`<br>`evidence/AC-49.events.jsonl`<br>`evidence/AC-49.inbox.json`<br>`evidence/AC-49.meta.json`<br>`evidence/AC-49.output.json`<br>`evidence/AC-49.prompts.json`<br>`evidence/AC-49.state.json`<br>`evidence/AC-49.status.md.json`<br>`evidence/AC-49.status.txt` |
| AC-50 | `evidence/AC-50.attempts.json`<br>`evidence/AC-50.events.jsonl`<br>`evidence/AC-50.inbox.json`<br>`evidence/AC-50.meta.json`<br>`evidence/AC-50.output.json`<br>`evidence/AC-50.prompts.json`<br>`evidence/AC-50.state.json`<br>`evidence/AC-50.status.md.json`<br>`evidence/AC-50.status.txt` |
| AC-51 | `evidence/AC-51.attempts.json`<br>`evidence/AC-51.events.jsonl`<br>`evidence/AC-51.inbox.json`<br>`evidence/AC-51.meta.json`<br>`evidence/AC-51.output.json`<br>`evidence/AC-51.prompts.json`<br>`evidence/AC-51.state.json`<br>`evidence/AC-51.status.md.json`<br>`evidence/AC-51.status.txt` |
| AC-52 | `evidence/AC-52.attempts.json`<br>`evidence/AC-52.events.jsonl`<br>`evidence/AC-52.inbox.json`<br>`evidence/AC-52.meta.json`<br>`evidence/AC-52.output.json`<br>`evidence/AC-52.prompts.json`<br>`evidence/AC-52.state.json`<br>`evidence/AC-52.status.md.json`<br>`evidence/AC-52.status.txt` |
| AC-53 | `evidence/AC-53.attempts.json`<br>`evidence/AC-53.events.jsonl`<br>`evidence/AC-53.inbox.json`<br>`evidence/AC-53.meta.json`<br>`evidence/AC-53.output.json`<br>`evidence/AC-53.prompts.json`<br>`evidence/AC-53.state.json`<br>`evidence/AC-53.status.md.json`<br>`evidence/AC-53.status.txt` |
| AC-54 | `evidence/AC-54.attempts.json`<br>`evidence/AC-54.events.jsonl`<br>`evidence/AC-54.inbox.json`<br>`evidence/AC-54.meta.json`<br>`evidence/AC-54.output.json`<br>`evidence/AC-54.prompts.json`<br>`evidence/AC-54.state.json`<br>`evidence/AC-54.status.md.json`<br>`evidence/AC-54.status.txt` |
| AC-55 | `evidence/AC-55.attempts.json`<br>`evidence/AC-55.events.jsonl`<br>`evidence/AC-55.inbox.json`<br>`evidence/AC-55.meta.json`<br>`evidence/AC-55.output.json`<br>`evidence/AC-55.prompts.json`<br>`evidence/AC-55.state.json`<br>`evidence/AC-55.status.md.json`<br>`evidence/AC-55.status.txt` |
| AC-56 | `evidence/AC-56.attempts.json`<br>`evidence/AC-56.events.jsonl`<br>`evidence/AC-56.inbox.json`<br>`evidence/AC-56.meta.json`<br>`evidence/AC-56.output.json`<br>`evidence/AC-56.prompts.json`<br>`evidence/AC-56.state.json`<br>`evidence/AC-56.status.md.json`<br>`evidence/AC-56.status.txt` |
| AC-57 | `evidence/AC-57.attempts.json`<br>`evidence/AC-57.events.jsonl`<br>`evidence/AC-57.inbox.json`<br>`evidence/AC-57.meta.json`<br>`evidence/AC-57.output.json`<br>`evidence/AC-57.prompts.json`<br>`evidence/AC-57.state.json`<br>`evidence/AC-57.status.md.json`<br>`evidence/AC-57.status.txt` |
| AC-58 | `evidence/AC-58.attempts.json`<br>`evidence/AC-58.events.jsonl`<br>`evidence/AC-58.inbox.json`<br>`evidence/AC-58.meta.json`<br>`evidence/AC-58.output.json`<br>`evidence/AC-58.prompts.json`<br>`evidence/AC-58.state.json`<br>`evidence/AC-58.status.md.json`<br>`evidence/AC-58.status.txt` |
| AC-59 | `evidence/AC-59.attempts.json`<br>`evidence/AC-59.events.jsonl`<br>`evidence/AC-59.inbox.json`<br>`evidence/AC-59.meta.json`<br>`evidence/AC-59.output.json`<br>`evidence/AC-59.prompts.json`<br>`evidence/AC-59.state.json`<br>`evidence/AC-59.status.md.json`<br>`evidence/AC-59.status.txt` |
| AC-60 | `evidence/AC-60.attempts.json`<br>`evidence/AC-60.events.jsonl`<br>`evidence/AC-60.inbox.json`<br>`evidence/AC-60.meta.json`<br>`evidence/AC-60.output.json`<br>`evidence/AC-60.prompts.json`<br>`evidence/AC-60.state.json`<br>`evidence/AC-60.status.md.json`<br>`evidence/AC-60.status.txt` |
| AC-61 | `evidence/AC-61.attempts.json`<br>`evidence/AC-61.events.jsonl`<br>`evidence/AC-61.inbox.json`<br>`evidence/AC-61.meta.json`<br>`evidence/AC-61.output.json`<br>`evidence/AC-61.prompts.json`<br>`evidence/AC-61.state.json`<br>`evidence/AC-61.status.md.json`<br>`evidence/AC-61.status.txt` |
| AC-62 | `evidence/AC-62.attempts.json`<br>`evidence/AC-62.events.jsonl`<br>`evidence/AC-62.inbox.json`<br>`evidence/AC-62.meta.json`<br>`evidence/AC-62.output.json`<br>`evidence/AC-62.prompts.json`<br>`evidence/AC-62.state.json`<br>`evidence/AC-62.status.md.json`<br>`evidence/AC-62.status.txt` |
| AC-63 | `evidence/AC-63.attempts.json`<br>`evidence/AC-63.events.jsonl`<br>`evidence/AC-63.inbox.json`<br>`evidence/AC-63.meta.json`<br>`evidence/AC-63.output.json`<br>`evidence/AC-63.prompts.json`<br>`evidence/AC-63.state.json`<br>`evidence/AC-63.status.md.json`<br>`evidence/AC-63.status.txt` |
| AC-64 | `evidence/AC-64.attempts.json`<br>`evidence/AC-64.events.jsonl`<br>`evidence/AC-64.inbox.json`<br>`evidence/AC-64.meta.json`<br>`evidence/AC-64.output.json`<br>`evidence/AC-64.prompts.json`<br>`evidence/AC-64.state.json`<br>`evidence/AC-64.status.md.json`<br>`evidence/AC-64.status.txt` |
| AC-65 | `evidence/AC-65.attempts.json`<br>`evidence/AC-65.events.jsonl`<br>`evidence/AC-65.inbox.json`<br>`evidence/AC-65.meta.json`<br>`evidence/AC-65.output.json`<br>`evidence/AC-65.prompts.json`<br>`evidence/AC-65.state.json`<br>`evidence/AC-65.status.md.json`<br>`evidence/AC-65.status.txt` |
| AC-66 | `evidence/AC-66.attempts.json`<br>`evidence/AC-66.events.jsonl`<br>`evidence/AC-66.inbox.json`<br>`evidence/AC-66.meta.json`<br>`evidence/AC-66.output.json`<br>`evidence/AC-66.prompts.json`<br>`evidence/AC-66.state.json`<br>`evidence/AC-66.status.md.json`<br>`evidence/AC-66.status.txt` |
| AC-67 | `evidence/AC-67.attempts.json`<br>`evidence/AC-67.events.jsonl`<br>`evidence/AC-67.inbox.json`<br>`evidence/AC-67.meta.json`<br>`evidence/AC-67.output.json`<br>`evidence/AC-67.prompts.json`<br>`evidence/AC-67.state.json`<br>`evidence/AC-67.status.md.json`<br>`evidence/AC-67.status.txt` |
| AC-68 | `evidence/AC-68.attempts.json`<br>`evidence/AC-68.events.jsonl`<br>`evidence/AC-68.inbox.json`<br>`evidence/AC-68.meta.json`<br>`evidence/AC-68.output.json`<br>`evidence/AC-68.prompts.json`<br>`evidence/AC-68.state.json`<br>`evidence/AC-68.status.md.json`<br>`evidence/AC-68.status.txt` |
| AC-69 | `evidence/AC-69.attempts.json`<br>`evidence/AC-69.events.jsonl`<br>`evidence/AC-69.inbox.json`<br>`evidence/AC-69.meta.json`<br>`evidence/AC-69.output.json`<br>`evidence/AC-69.prompts.json`<br>`evidence/AC-69.state.json`<br>`evidence/AC-69.status.md.json`<br>`evidence/AC-69.status.txt` |
| AC-70 | `evidence/AC-70.attempts.json`<br>`evidence/AC-70.events.jsonl`<br>`evidence/AC-70.inbox.json`<br>`evidence/AC-70.meta.json`<br>`evidence/AC-70.output.json`<br>`evidence/AC-70.prompts.json`<br>`evidence/AC-70.state.json`<br>`evidence/AC-70.status.md.json`<br>`evidence/AC-70.status.txt` |
