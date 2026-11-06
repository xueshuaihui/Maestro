# I1.3 验收记录（夹具面）

> 依据：`docs/iterations/iteration-3/requirement.md` §3.1（AC-01~AC-45，逐条 Given/When/Then）、附录 A-1/A-2/A-3（输出逐字版式）、附录 D-4~D-10（常量、文案、状态结构、夹具契约）。
> 执行：win32 / Node v22.22.2 / 仓库 `D:\WWW\Maestro`；每条 AC 一个独立项目根 `%TEMP%/maestro-acc-p3/<AC>/`，跑完 `orch core stop` 并回收核心。
> 生成：`probe/acc3-f-run.mjs` 逐条取证（evidence + parts + results.jsonl）→ `probe/acc3-f-final.mjs` 重建本文件。判定只认需求原文的 Then/And；每条证据均可独立复核（原始 state/events/output 全文落盘）。

## 0. 总判

**45 条：通过 45 / 不通过 0 / 阻塞 0**

- 已产出证据：45 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-3/evidence/` 下 274 个（覆盖 45 条 AC）。
- 不通过 / 阻塞条目：无。
- 机器可读汇总：`probe/acc3-f-summary.json`；单条中间结论：`probe/acc3-f-parts/<AC>.md`；缺陷记录：`probe/acc3-f-blockers.md`。
- 判定口径：`通过` = 该 AC 的全部 Then/And 核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为无法在夹具上观测（或超时），必须在 parts 里写明原因与已尝试路径。

## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 判定）

> 「原始输出」全文在 `evidence/<AC>.output.json`（每条命令的 stdout+stderr 原样）与 `status.txt`（可读转录）；「状态证据」在 `evidence/<AC>.state.json` 与 `events.jsonl`。

#### AC-01 发起通用任务闭环，三节点按序建好

- 判定：**通过**（核对 15/15 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-hold-research --prepare-only（备现场）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01 --scenario doc-hold-research --prepare-only   | cwd=D:\WWW\Maestro | exit=0 | 85ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01 | exit=0 | 98ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01 | exit=0 | 113ms
[driver --scenario doc-hold-research --keep 最终输出（长驻进程由脚手架终止，exit 不作产品退出码）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01 --scenario doc-hold-research --keep   | cwd=D:\WWW\Maestro | exit=13 | 1571ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-01.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根，我先执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario doc-hold-research --prepare-only
When 我执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario doc-hold-research --keep
Then 10 秒内输出含"实例 INST-001 · 运行中 · 模板 通用任务闭环"
And 第 2 行匹配 ^会话已创建 \S+$（会话号由宿主给出，不逐字断言）
And 第 3 行是"任务已投递"
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-001 研究员 执行中 · 第 1 轮"
And 输出含"节点 T-002 撰写者 待执行"
And 输出含"节点 T-003 审核者 待执行"
And 机检：nodes 依次为 T-001/T-002/T-003，roleId 依次为 researcher/writer/reviewer
And 机检：只有 T-001 的 state='running' 且 round=1；其余 round=0、state='pending'
And 机检：`.orch/instances/INST-001/workspace/artifacts/docs` 与 `.../artifacts/reports` 都存在
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-01.state.live.json` | 2552 B |
| `docs/iterations/iteration-3/evidence/AC-01.state.json` | 2751 B |
| `docs/iterations/iteration-3/evidence/AC-01.events.jsonl` | 2152 B |
| `docs/iterations/iteration-3/evidence/AC-01.meta.json` | 928 B |
| `docs/iterations/iteration-3/evidence/AC-01.output.json` | 7637 B |
| `docs/iterations/iteration-3/evidence/AC-01.status.txt` | 2653 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 10 秒内输出含「实例 INST-001 · 运行中 · 模板 通用任务闭环」（前三行已到齐） | ✅ | `650ms；实际字节 66` |
| 2 | 第 1 行是「实例 INST-001 · 运行中 · 模板 通用任务闭环」（期望 "实例 INST-001 · 运行中 · 模板 通用任务闭环"） | ✅ | `"实例 INST-001 · 运行中 · 模板 通用任务闭环"` |
| 3 | 第 2 行匹配 ^会话已创建 \S+$（期望匹配 /^会话已创建 \S+$/） | ✅ | `会话已创建 mock-sess-22272-1` |
| 4 | 第 3 行是「任务已投递」（期望 "任务已投递"） | ✅ | `"任务已投递"` |
| 5 | 输出含「节点 T-001 研究员 执行中 · 第 1 轮」（期望含 "节点 T-001 研究员 执行中 · 第 1 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 执行中 · 第 1 轮<br>节点 T-002 撰写者 待执行<br>节点 T-003 审核者 待执行<br>会话 空闲<br>升级 —<br>` |
| 6 | 输出含「节点 T-002 撰写者 待执行」（期望含 "节点 T-002 撰写者 待执行"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 执行中 · 第 1 轮<br>节点 T-002 撰写者 待执行<br>节点 T-003 审核者 待执行<br>会话 空闲<br>升级 —<br>` |
| 7 | 输出含「节点 T-003 审核者 待执行」（期望含 "节点 T-003 审核者 待执行"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 执行中 · 第 1 轮<br>节点 T-002 撰写者 待执行<br>节点 T-003 审核者 待执行<br>会话 空闲<br>升级 —<br>` |
| 8 | 机检：实例号是 INST-001（期望 "INST-001"） | ✅ | `"INST-001"` |
| 9 | 机检：nodes 依次为 T-001/T-002/T-003（期望 "T-001,T-002,T-003"） | ✅ | `"T-001,T-002,T-003"` |
| 10 | 机检：roleId 依次为 researcher/writer/reviewer（期望 "researcher,writer,reviewer"） | ✅ | `"researcher,writer,reviewer"` |
| 11 | 机检：T-001 是 running 且 round=1（期望 "running/1"） | ✅ | `"running/1"` |
| 12 | 机检：T-002/T-003 是 pending 且 round=0（期望 "T-002=pending/0,T-003=pending/0"） | ✅ | `"T-002=pending/0,T-003=pending/0"` |
| 13 | 机检：workspace/artifacts/docs 存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01\.orch\instances\INST-001\workspace/artifacts/docs` |
| 14 | 机检：workspace/artifacts/reports 存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-01\.orch\instances\INST-001\workspace/artifacts/reports` |
| 15 | 机检：.orch/instances 下只有 INST-001 | ✅ | `INST-001` |

**⑤ 判定**：通过

**备注**

- `state.live.json` 是 status 断言时刻的原始快照（T-001 running）；收尾 `state.json` 是 orch core stop 之后的产品快照（非终态实例按既有口径记 interrupted），两者不是同一时刻。

---

#### AC-02 研究完成后，撰写者收到研究笔记与写作路径

- 判定：**通过**（核对 13/13 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-02`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-02 | exit=0 | 110ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-02 | exit=0 | 117ms
[driver --scenario doc-pass --stop-after 2 --keep 最终输出（长驻进程由脚手架终止，exit 不作产品退出码）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-02 --scenario doc-pass --keep --stop-after 2   | cwd=D:\WWW\Maestro | exit=13 | 2119ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-02.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-pass 已用 --stop-after 2 --keep 停在"研究员与撰写者第 1 轮均已核对通过，审核者尚未派发"
And 机检：`.mock/stopped-after-2` 存在
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-001 研究员 已完成 · 第 1 轮"
And 输出含"产物 artifacts/reports/research-notes.v1.md"
And 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"
And 输出含"交接包 HO-001  研究员→撰写者  已完成"
And 机检：`.mock/prompts/2.json` 的 `task` 字段（完整提示词原文）同时含"研究笔记：artifacts/reports/research-notes.v1.md"与"本轮文档引用：artifacts/docs/release-notes.v1.md"
And 机检：prompt 含写入路径".orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md"
And 机检：`.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md` 存在且非空
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-02.state.live.json` | 5177 B |
| `docs/iterations/iteration-3/evidence/AC-02.state.json` | 5972 B |
| `docs/iterations/iteration-3/evidence/AC-02.events.jsonl` | 5439 B |
| `docs/iterations/iteration-3/evidence/AC-02.meta.json` | 911 B |
| `docs/iterations/iteration-3/evidence/AC-02.output.json` | 8961 B |
| `docs/iterations/iteration-3/evidence/AC-02.status.txt` | 1953 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：`.mock/stopped-after-2` 存在（Given 定格点） | ✅ | `true` |
| 2 | 输出含「节点 T-001 研究员 已完成 · 第 1 轮」（期望含 "节点 T-001 研究员 已完成 · 第 1 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:47<br>交接包 HO-001  研究员→撰写者  已投递   21:25:47` |
| 3 | 输出含「产物 artifacts/reports/research-notes.v1.md」（期望含 "产物 artifacts/reports/research-notes.v1.md"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:47<br>交接包 HO-001  研究员→撰写者  已投递   21:25:47` |
| 4 | 输出含「节点 T-002 撰写者 待校验（等待下游） · 第 1 轮」（期望含 "节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:47<br>交接包 HO-001  研究员→撰写者  已投递   21:25:47` |
| 5 | 输出含「交接包 HO-001  研究员→撰写者  已完成」（期望含 "交接包 HO-001  研究员→撰写者  已完成"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:47<br>交接包 HO-001  研究员→撰写者  已投递   21:25:47` |
| 6 | 机检：`.mock/prompts/2.json` 存在且是 T-002 第 1 轮 | ✅ | `nodeId=T-002 round=1` |
| 7 | 提示词含「研究笔记：artifacts/reports/research-notes.v1.md」（期望含 "研究笔记：artifacts/reports/research-notes.v1.md"） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p3/AC-02/.orch/instances/INST-001/workspace/artifacts/docs/releas` |
| 8 | 提示词含「本轮文档引用：artifacts/docs/release-notes.v1.md」（期望含 "本轮文档引用：artifacts/docs/release-notes.v1.md"） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p3/AC-02/.orch/instances/INST-001/workspace/artifacts/docs/releas` |
| 9 | 提示词含写入路径「.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md」（期望含 ".orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md"） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>研究笔记：artifacts/reports/research-notes.v1.md<br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>写入路径：C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p3/AC-02/.orch/instances/INST-001/workspace/artifacts/docs/releas` |
| 10 | 机检：研究笔记存在且非空 | ✅ | `true / 299 B` |
| 11 | 机检：T-002 state/reviewReason/round = review/downstream/1（期望 "review/downstream/1"） | ✅ | `"review/downstream/1"` |
| 12 | 机检：T-001 state = done（期望 "done"） | ✅ | `"done"` |
| 13 | 机检：HO-001 state = consumed（期望 "consumed"） | ✅ | `"consumed"` |

**⑤ 判定**：通过

**备注**

- `state.live.json` 是 --stop-after 2 定格时刻的快照（T-001 done / T-002 review(downstream) / T-003 pending、dispatchCount=2）；收尾 `state.json` 是 core stop 之后的快照。

---

#### AC-03 撰写完成后，审核者收到本轮文档引用

- 判定：**通过**（核对 11/11 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-pass（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03 --scenario doc-pass   | cwd=D:\WWW\Maestro | exit=0 | 1717ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03 | exit=0 | 207ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03 | exit=0 | 199ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-03.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-pass 已完整跑完
Then 机检：`.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md` 存在且 bytes > 0
And 机检：`.mock/prompts/3.json` 的 `task` 字段含"本轮文档引用：artifacts/docs/release-notes.v1.md"
And 机检：prompt 含审核文件路径"out/review.json"
And 机检：handoffs 中 HO-002 的 edge 为 {from:'T-002', to:'T-003', kind:'forward'}，state='consumed'
And 机检：handoffs 中 HO-002 的 artifactRefs.input 含 "artifacts/docs/release-notes.v1.md"
And 节点 T-002 的最终行含"产物 artifacts/docs/release-notes.v1.md"
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-03.state.json` | 6807 B |
| `docs/iterations/iteration-3/evidence/AC-03.events.jsonl` | 8353 B |
| `docs/iterations/iteration-3/evidence/AC-03.meta.json` | 954 B |
| `docs/iterations/iteration-3/evidence/AC-03.output.json` | 6797 B |
| `docs/iterations/iteration-3/evidence/AC-03.status.txt` | 2774 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：release-notes.v1.md 存在且 bytes > 0 | ✅ | `true / 229 B` |
| 2 | 机检：`.mock/prompts/3.json` 存在且是 T-003 第 1 轮 | ✅ | `nodeId=T-003 round=1` |
| 3 | prompt 的 task 含「本轮文档引用：artifacts/docs/release-notes.v1.md」（期望含 "本轮文档引用：artifacts/docs/release-notes.v1.md"） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>本轮文档引用：artifacts/docs/release-notes.v1.md<br>工作区：C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03\.orch\instances\INST-001\workspace<br>审核文件写入路径：C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03\de` |
| 4 | prompt 含审核文件路径 out/review.json（绝对路径、解析到 <任务目录>/out/review.json） | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03\demo-doc\out\review.json → C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03\demo-doc\out\review.json` |
| 5 | 机检：审核文件的相对引用（T-003 review.reviewPath）仍是 out/review.json（期望 "out/review.json"） | ✅ | `"out/review.json"` |
| 6 | 机检：HO-002 edge = T-002→T-003 forward（期望 "T-002→T-003/forward"） | ✅ | `"T-002→T-003/forward"` |
| 7 | 机检：HO-002 state = consumed（期望 "consumed"） | ✅ | `"consumed"` |
| 8 | 机检：HO-002 artifactRefs.input 含 artifacts/docs/release-notes.v1.md（期望含 "artifacts/docs/release-notes.v1.md"） | ✅ | `["artifacts/docs/release-notes.v1.md"]` |
| 9 | 节点 T-002 的最终行含「产物 artifacts/docs/release-notes.v1.md」（期望含 "产物 artifacts/docs/release-notes.v1.md"） | ✅ | `节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v1.md` |
| 10 | 机检：T-002 state/round = done/1（期望 "done/1"） | ✅ | `"done/1"` |
| 11 | 夹具完整跑完（退出码 0） | ✅ | `exit=0` |

**⑤ 判定**：通过

**备注**

- 「out/review.json」在 prompt 里是宿主绝对路径（150c7c6 修法）：实测 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-03\demo-doc\out\review.json`；逐字前斜杠形态只出现在 state 的 review.reviewPath。

---

#### AC-04 待校验的两种限定词与会话等待行

- 判定：**通过**（核对 12/12 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-a`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[根 A：orch status --instance INST-001（停在 after_output:T-002）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-a | exit=0 | 116ms
[根 A：orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-a | exit=0 | 88ms
[根 A：driver --scenario doc-pass --keep（MAESTRO_TEST_PAUSE=after_output:T-002）最终输出] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-a --scenario doc-pass --keep   | cwd=D:\WWW\Maestro | exit=13 | 2087ms
[根 B：orch status --instance INST-001（停在 --stop-after 2）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-b | exit=0 | 95ms
[根 B：orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-b | exit=0 | 90ms
[根 B：driver --scenario doc-pass --stop-after 2 --keep 最终输出] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-04-b --scenario doc-pass --keep --stop-after 2   | cwd=D:\WWW\Maestro | exit=13 | 2008ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-04.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新根 A，场景 doc-pass 以 MAESTRO_TEST_PAUSE=after_output:T-002 --keep 启动
When 我等到 `.mock/paused` 出现，执行 orch status --instance INST-001
Then 输出含"节点 T-002 撰写者 待校验（核对证据） · 第 1 轮"
And 输出不含"待校验（等待下游）"
And 输出含"会话 等待下游"，且**不带**"· 产出已提交"（该后缀只在 `orch run` 的流式会话行出现，见 A-1）
Given 另起全新根 B，场景 doc-pass 以 --stop-after 2 --keep 启动
When 我读到该次 `orch run` 的流式输出（驱动透传，见 §3.3 第 3 条）
Then 输出含"会话 等待下游 · 产出已提交"
When 我等到 `.mock/stopped-after-2` 出现，执行 orch status --instance INST-001
Then 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"
And 输出含"会话 等待下游"（`status` 的第 4 段不加后缀）
And 机检：T-002 的 state='review'，reviewReason='downstream'
And 机检：T-001 的 state='done'
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-04.state.a-evidence.json` | 4625 B |
| `docs/iterations/iteration-3/evidence/AC-04.state.b-downstream.json` | 5181 B |
| `docs/iterations/iteration-3/evidence/AC-04.state.json` | 14564 B |
| `docs/iterations/iteration-3/evidence/AC-04.events.jsonl` | 12974 B |
| `docs/iterations/iteration-3/evidence/AC-04.meta.json` | 1107 B |
| `docs/iterations/iteration-3/evidence/AC-04.output.json` | 10480 B |
| `docs/iterations/iteration-3/evidence/AC-04.status.txt` | 3831 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 根 A：`.mock/paused` 出现（Given 定格点） | ✅ | `存在` |
| 2 | 根 A：输出含「节点 T-002 撰写者 待校验（核对证据） · 第 1 轮」（期望含 "节点 T-002 撰写者 待校验（核对证据） · 第 1 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（核对证据） · 第 1 轮<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:52<br>交接包 HO-001  研究员→撰写者  已投递   21:25:53<br>交接包 ` |
| 3 | 根 A：输出不含「待校验（等待下游）」（期望不含 "待校验（等待下游）"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（核对证据） · 第 1 轮<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:52<br>交接包 HO-001  研究员→撰写者  已投递   21:25:53<br>交接包 ` |
| 4 | 根 A：输出含「会话 等待下游」（期望含 "会话 等待下游"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（核对证据） · 第 1 轮<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:52<br>交接包 HO-001  研究员→撰写者  已投递   21:25:53<br>交接包 ` |
| 5 | 根 A：status 的会话行不带「· 产出已提交」（期望不含 "· 产出已提交"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（核对证据） · 第 1 轮<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:52<br>交接包 HO-001  研究员→撰写者  已投递   21:25:53<br>交接包 ` |
| 6 | 根 A 机检：T-002 state/reviewReason = review/evidence（期望 "review/evidence"） | ✅ | `"review/evidence"` |
| 7 | 根 B：`.mock/stopped-after-2` 出现（Given 定格点） | ✅ | `存在` |
| 8 | 根 B：`orch run` 流式输出含「会话 等待下游 · 产出已提交」 | ✅ | `会话已创建 mock-sess-21368-1 / 会话 执行中 · 已运行 1s / 会话 等待下游 · 产出已提交 / 会话 执行中 · 已运行 1s / 会话 等待下游 · 产出已提交` |
| 9 | 根 B：输出含「节点 T-002 撰写者 待校验（等待下游） · 第 1 轮」（期望含 "节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:25:55<br>交接包 HO-001  研究员→撰写者  已投递   21:25:55` |
| 10 | 根 B：status 的会话行是「会话 等待下游」（第 4 段不加后缀）（期望 "会话 等待下游"） | ✅ | `"会话 等待下游"` |
| 11 | 根 B 机检：T-002 state/reviewReason = review/downstream（期望 "review/downstream"） | ✅ | `"review/downstream"` |
| 12 | 根 B 机检：T-001 state = done（期望 "done"） | ✅ | `"done"` |

**⑤ 判定**：通过

**备注**

- 根 A 的 `state.a-evidence.json` 与根 B 的 `state.b-downstream.json` 分别是两个定格时刻的原始快照；收尾 `state.json` 是 core stop 之后的多根快照。

---

#### AC-05 下游接受之后，上游才变已完成

- 判定：**通过**（核对 13/13 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-05`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-backflow-once（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-05 --scenario doc-backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 2350ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-05 | exit=0 | 89ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-05.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：按 `(节点, 触发它的那张交接包)` 配对断言，四对分别是 `(T-001, HO-001)`、`(T-002 第 1 轮, HO-002)`、`(T-002 第 2 轮, HO-004)`、`(T-003, 无上游门控)`：
And 机检：存在 object='node'、objectId='T-001'、to='done'、reason='review.downstream_accepted' 的事件，其 seq **大于** HO-001 的 `accepted` 事件 seq
And 机检：objectId='T-002'、to='done'、reason='review.downstream_accepted' 的事件**有 2 条**，**按 `detail.round` 配对**（`round=1` 对 HO-002、`round=2` 对 HO-004；seq 仅作交叉验证，也必须分别大于对应 `accepted` 的 seq）
And 机检：不存在 T-001 / T-002 的任何 `to='done'` 事件早于**它自己那一张**交接包的 `accepted`（逐对比较，不跨对）
And 机检：T-003 的迁移事件是 object='node'、to='done'、result='applied'、reason='verification.passed'（terminal 节点 `downstreamGate:false`，走 I1.2 既有路径）；它的审核结论是**同节点上另一条** result='note'、reason='review.passed' 的事件，两条不是同一条记录
And 机检：T-001/T-002 最终 reviewReason 为空，state='done'
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-05.state.json` | 10126 B |
| `docs/iterations/iteration-3/evidence/AC-05.events.jsonl` | 14817 B |
| `docs/iterations/iteration-3/evidence/AC-05.meta.json` | 837 B |
| `docs/iterations/iteration-3/evidence/AC-05.output.json` | 5879 B |
| `docs/iterations/iteration-3/evidence/AC-05.status.txt` | 2412 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：四张交接包的方向/种类（HO-001/HO-002 正向，HO-003 回流，HO-004 复测）（期望 "HO-001=T-001→T-002/forward,HO-002=T-002→T-003/forward,HO-003=T-003→T-002/backflow,HO-004=T-002→T-003/retest"） | ✅ | `"HO-001=T-001→T-002/forward,HO-002=T-002→T-003/forward,HO-003=T-003→T-002/backflow,HO-004=T-002→T-003/retest"` |
| 2 | 机检：(T-001, HO-001) 存在 T-001 的 review.downstream_accepted done 事件 | ✅ | `#14 round=1` |
| 3 | 机检：T-001 done 的 seq 大于 HO-001 accepted 的 seq | ✅ | `done=14 accepted=13` |
| 4 | 机检：objectId=T-002、to=done、reason=review.downstream_accepted 的事件恰好 2 条（期望 2） | ✅ | `2` |
| 5 | 机检：两条 T-002 done 事件按 detail.round 配对（1/2）（期望 "1,2"） | ✅ | `"1,2"` |
| 6 | 机检：(T-002 第 1 轮, HO-002) 的 done seq 大于 HO-002 accepted seq | ✅ | `done=26 handoff=HO-002 accepted=25` |
| 7 | 机检：(T-002 第 2 轮, HO-004) 的 done seq 大于 HO-004 accepted seq | ✅ | `done=53 handoff=HO-004 accepted=52` |
| 8 | 机检：T-003 的迁移事件是 applied / done / verification.passed | ✅ | `#60 applied/done/verification.passed` |
| 9 | 机检：T-003 的审核结论是同节点另一条 note / review.passed 事件（不是同一条记录） | ✅ | `#59 note/review.passed vs #60` |
| 10 | 机检：T-003 没有 review.downstream_accepted 的 done 事件（terminal 节点 downstreamGate:false） | ✅ | `检查全部 T-003 done 事件` |
| 11 | 机检：不存在 T-001 / T-002 的任何 to=done 事件早于它自己那一张交接包的 accepted（逐对比较） | ✅ | `三对全部满足 done.seq > 对应 accepted.seq` |
| 12 | 机检：T-001 最终 state/reviewReason = done/空（期望 "done/"） | ✅ | `"done/"` |
| 13 | 机检：T-002 最终 state/reviewReason = done/空（期望 "done/"） | ✅ | `"done/"` |

**⑤ 判定**：通过

**备注**

- 事件按 seq 全序；`detail.round` 用于区分 T-002 的两轮配哪一张交接包（HO-002 / HO-004），seq 只作交叉验证。

---

#### AC-06 审核通过后闭环完成

- 判定：**通过**（核对 12/12 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-06`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-pass（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-06 --scenario doc-pass   | cwd=D:\WWW\Maestro | exit=0 | 1689ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-06 | exit=0 | 214ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-06 | exit=0 | 179ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-06.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-pass 已完整跑完
Then 命令退出码是 0
And 输出含"节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/reports/research-notes.v1.md"
And 输出含"节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/docs/release-notes.v1.md"
And 输出含"节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 <d> · 审核 通过"
And 输出含"升级 —"
When 我执行 orch status --instance INST-001
Then 输出含"实例 INST-001 · 已完成 · 模板 通用任务闭环"
And 机检：实例 state='completed'，三个节点 state 都是 'done'
And 机检：sessions 中每一轮派发的会话 state 最终都是 'idle'
And 机检：handoffs 全部 state='consumed'，且 consumedAt 非空
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-06.state.json` | 6805 B |
| `docs/iterations/iteration-3/evidence/AC-06.events.jsonl` | 8348 B |
| `docs/iterations/iteration-3/evidence/AC-06.meta.json` | 676 B |
| `docs/iterations/iteration-3/evidence/AC-06.output.json` | 11845 B |
| `docs/iterations/iteration-3/evidence/AC-06.status.txt` | 2774 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 命令退出码是 0（期望 0） | ✅ | `0` |
| 2 | 输出含「节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/reports/research-notes.v1.md」（期望匹配 /节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 (?:\d+(?:\.\d+)?(?:ms\|s\|m\|h))+ · 产物 artifacts\/reports\/research-notes\.v1\.md | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-31684-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-not` |
| 3 | 输出含「节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/docs/release-notes.v1.md」（期望匹配 /节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 (?:\d+(?:\.\d+)?(?:ms\|s\|m\|h))+ · 产物 artifacts\/docs\/release-notes\.v1\.md/） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-31684-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-not` |
| 4 | 输出含「节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 <d> · 审核 通过」（期望匹配 /节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 (?:\d+(?:\.\d+)?(?:ms\|s\|m\|h))+ · 审核 通过/） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-31684-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-not` |
| 5 | 输出含「升级 —」（期望含 "升级 —"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-31684-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-not` |
| 6 | A-1：成功路径全文不出现「核对失败」/「执行失败」/「未知错误」 | ✅ | `三种词都不出现` |
| 7 | 输出含「实例 INST-001 · 已完成 · 模板 通用任务闭环」（期望含 "实例 INST-001 · 已完成 · 模板 通用任务闭环"） | ✅ | `实例 INST-001 · 已完成 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v1.md<br>节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 1s · 审核 通过<br>会话 空闲<br>交接包 HO-001  研究员→撰写` |
| 8 | 机检：实例 state = completed（期望 "completed"） | ✅ | `"completed"` |
| 9 | 机检：三个节点 state 都是 done（期望 "T-001=done,T-002=done,T-003=done"） | ✅ | `"T-001=done,T-002=done,T-003=done"` |
| 10 | 机检：sessions 中每一轮派发的会话 state 最终都是 idle | ✅ | `3 个会话：T-001#1=idle,T-002#1=idle,T-003#1=idle` |
| 11 | 机检：handoffs 全部 state=consumed 且 consumedAt 非空 | ✅ | `HO-001=consumed/2026-11-06T13:26:00.817Z,HO-002=consumed/2026-11-06T13:26:01.142Z` |
| 12 | 机检：终态无升级 | ✅ | `[]` |

**⑤ 判定**：通过

---

#### AC-07 审核第 1 轮驳回 → 自动回流，撰写者交出新版本

- 判定：**通过**（核对 11/11 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-07`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-07 | exit=0 | 99ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-07 | exit=0 | 96ms
[driver --scenario doc-backflow-once --stop-after 4 --keep 最终输出（长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-07 --scenario doc-backflow-once --keep --stop-after 4   | cwd=D:\WWW\Maestro | exit=13 | 2656ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-07.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已用 --stop-after 4 --keep 停在"撰写者第 2 轮已核对通过，审核者第 2 次尚未派发"
And 机检：`.mock/stopped-after-4` 存在
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-003 审核者 失败（等待复审） · 第 1 轮"
And 三行节点行里都不出现"等待复测"（那是编码闭环的限定词，通用任务闭环走不到兜底分支，见 A-2 第 3 段）
And 输出含"审核 驳回 · 缺陷 2 条"
And 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 2 轮"
And 输出含"交接包 HO-003  审核者→撰写者（回流）"
And 机检：`.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v2.md` 存在且非空
And 机检：v1 的 sha256 与第 1 轮 artifactHistory 中记录的一致
And 机检：T-002 的 round=2；T-003 的 round=1、state='failed'、note='等待复审'
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-07.state.live.json` | 9166 B |
| `docs/iterations/iteration-3/evidence/AC-07.state.json` | 9885 B |
| `docs/iterations/iteration-3/evidence/AC-07.events.jsonl` | 11911 B |
| `docs/iterations/iteration-3/evidence/AC-07.meta.json` | 867 B |
| `docs/iterations/iteration-3/evidence/AC-07.output.json` | 10852 B |
| `docs/iterations/iteration-3/evidence/AC-07.status.txt` | 2716 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：`.mock/stopped-after-4` 存在（Given 定格点） | ✅ | `存在` |
| 2 | 输出含「节点 T-003 审核者 失败（等待复审） · 第 1 轮」（期望含 "节点 T-003 审核者 失败（等待复审） · 第 1 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 1s<br>节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 1s · 审核 驳回 · 缺陷 2 条<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:26:03<` |
| 3 | 三行节点行里都不出现「等待复测」 | ✅ | `节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md \| 节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 1s \| 节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 1s · 审核 驳回 · 缺陷 2 条` |
| 4 | 输出含「审核 驳回 · 缺陷 2 条」（期望含 "审核 驳回 · 缺陷 2 条"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 1s<br>节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 1s · 审核 驳回 · 缺陷 2 条<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:26:03<` |
| 5 | 输出含「节点 T-002 撰写者 待校验（等待下游） · 第 2 轮」（期望含 "节点 T-002 撰写者 待校验（等待下游） · 第 2 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 1s<br>节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 1s · 审核 驳回 · 缺陷 2 条<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:26:03<` |
| 6 | 输出含「交接包 HO-003  审核者→撰写者（回流）」（期望含 "交接包 HO-003  审核者→撰写者（回流）"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 1s<br>节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 1s · 审核 驳回 · 缺陷 2 条<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   21:26:03<` |
| 7 | 机检：release-notes.v2.md 存在且非空 | ✅ | `true / 302 B` |
| 8 | 机检：v1 的 sha256 与第 1 轮 artifactHistory 记录一致 | ✅ | `now=2cc51bd424dde5b1fa59e11508deb7a09840d9382b074be4ceee6c7a3a92e727 recorded=2cc51bd424dde5b1fa59e11508deb7a09840d9382b074be4ceee6c7a3a92e727` |
| 9 | 机检：T-002 round = 2（期望 2） | ✅ | `2` |
| 10 | 机检：T-003 round/state/note = 1/failed/等待复审（期望 "1/failed/等待复审"） | ✅ | `"1/failed/等待复审"` |
| 11 | 机检：HO-003 edge.kind = backflow（期望 "backflow"） | ✅ | `"backflow"` |

**⑤ 判定**：通过

**备注**

- `state.live.json` 是 --stop-after 4 定格时刻的快照（T-003 failed 第 1 轮、T-002 review(downstream) 第 2 轮、v1/v2 并存）。

---

#### AC-08 回流内容带齐缺陷、证据、修改要求与上一版引用

- 判定：**通过**（核对 15/15 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-08`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-08 | exit=0 | 95ms
[driver --scenario doc-backflow-once --stop-after 4 --keep 最终输出（长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-08 --scenario doc-backflow-once --keep --stop-after 4   | cwd=D:\WWW\Maestro | exit=13 | 2445ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-08.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已用 --stop-after 4 --keep 停在"撰写者第 2 轮已核对通过，审核者第 2 次尚未派发"
And 机检：`.mock/stopped-after-4` 存在
Then 机检：HO-003 的 edge.kind='backflow'，defects 恰好 2 条
And 机检：每条 defect 的 summary 与 evidence 都非空，evidence 指向 v1
And 机检：HO-003 的 revisionRequirement 非空
And 机检：HO-003 的 artifactRefs.previous = {ref:'artifacts/docs/release-notes.v1.md', sha256:<非空>}
And 机检：HO-003 的 artifactRefs.output = 'artifacts/docs/release-notes.v2.md'
And 机检：`.mock/prompts/4.json` 的 `task` 字段含逐字前缀"缺陷 1："与"缺陷 2："（各一次），两条都以"（证据 "起、"）"止，中间分别是 HO-003 对应 defect 的 `summary` 与 `evidence`
And 机检：该 `task` 含"修改要求："与"上一版文档引用：artifacts/docs/release-notes.v1.md"
And 机检：该 `task` 含"本轮文档引用：artifacts/docs/release-notes.v2.md"
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-08.state.live.json` | 9164 B |
| `docs/iterations/iteration-3/evidence/AC-08.state.json` | 9883 B |
| `docs/iterations/iteration-3/evidence/AC-08.events.jsonl` | 11907 B |
| `docs/iterations/iteration-3/evidence/AC-08.meta.json` | 827 B |
| `docs/iterations/iteration-3/evidence/AC-08.output.json` | 7381 B |
| `docs/iterations/iteration-3/evidence/AC-08.status.txt` | 1306 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：`.mock/stopped-after-4` 存在（Given 定格点） | ✅ | `存在` |
| 2 | 机检：HO-003 edge.kind = backflow（期望 "backflow"） | ✅ | `"backflow"` |
| 3 | 机检：HO-003 defects 恰好 2 条（期望 2） | ✅ | `2` |
| 4 | 机检：每条 defect 的 summary 与 evidence 都非空 | ✅ | `[{"summary":"缺少回滚方案","evidence":"artifacts/docs/release-notes.v1.md#L1"},{"summary":"升级步骤缺少验证","evidence":"artifacts/docs/release-notes.v1.md#L18"}]` |
| 5 | 机检：每条 defect 的 evidence 指向 v1 | ✅ | `artifacts/docs/release-notes.v1.md#L1 / artifacts/docs/release-notes.v1.md#L18` |
| 6 | 机检：HO-003 revisionRequirement 非空 | ✅ | `"补写「回滚方案」一节"` |
| 7 | 机检：artifactRefs.previous = {ref:v1, sha256:非空} | ✅ | `{"ref":"artifacts/docs/release-notes.v1.md","sha256":"2cc51bd424dde5b1fa59e11508deb7a09840d9382b074be4ceee6c7a3a92e727"}` |
| 8 | 机检：artifactRefs.output = artifacts/docs/release-notes.v2.md（期望 "artifacts/docs/release-notes.v2.md"） | ✅ | `"artifacts/docs/release-notes.v2.md"` |
| 9 | 机检：`.mock/prompts/4.json` 存在且是 T-002 第 2 轮 | ✅ | `nodeId=T-002 round=2` |
| 10 | 机检：task 含逐字「缺陷 1：…（证据 …）」（summary/evidence 取 HO-003 第 1 条） | ✅ | `缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）` |
| 11 | 机检：task 含逐字「缺陷 2：…（证据 …）」（summary/evidence 取 HO-003 第 2 条） | ✅ | `缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）` |
| 12 | 机检：「缺陷 1：」「缺陷 2：」各只出现一次 | ✅ | `缺陷 1：x1 缺陷 2：x1` |
| 13 | 机检：task 含「修改要求：」（期望含 "修改要求："） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版` |
| 14 | 机检：task 含「上一版文档引用：artifacts/docs/release-notes.v1.md」（期望含 "上一版文档引用：artifacts/docs/release-notes.v1.md"） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版` |
| 15 | 机检：task 含「本轮文档引用：artifacts/docs/release-notes.v2.md」（期望含 "本轮文档引用：artifacts/docs/release-notes.v2.md"） | ✅ | `写一篇发布说明，覆盖背景、变更与回滚方案。<br>产物：release-notes.md<br><br>上一轮审核不通过，请按下列缺陷修改：<br>缺陷 1：缺少回滚方案（证据 artifacts/docs/release-notes.v1.md#L1）<br>缺陷 2：升级步骤缺少验证（证据 artifacts/docs/release-notes.v1.md#L18）<br>修改要求：补写「回滚方案」一节<br>研究笔记：artifacts/reports/research-notes.v1.md<br>上一版` |

**⑤ 判定**：通过

**备注**

- `state.live.json` 是 --stop-after 4 定格时刻的快照；提示词原文见检查项实测值。

---

#### AC-09 第 2 轮通过 → 闭环完成，两版共存

- 判定：**通过**（核对 13/13 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-09`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-backflow-once（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-09 --scenario doc-backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 2354ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-09 | exit=0 | 212ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-09 | exit=0 | 201ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-09.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 命令退出码是 0
And 输出含"节点 T-002 撰写者 已完成 · 第 2 轮"
And 输出含"节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过"
When 我执行 orch status --instance INST-001
Then 输出含"实例 INST-001 · 已完成 · 模板 通用任务闭环"
And 机检：v1 与 v2 同时存在，且 v1 的 sha256 与第 1 轮记录一致
And 机检：T-003 的 review.decision='pass'、review.artifact='artifacts/docs/release-notes.v2.md'
And 机检：实例 state='completed'，无 pending 升级
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-09.state.json` | 10126 B |
| `docs/iterations/iteration-3/evidence/AC-09.events.jsonl` | 14816 B |
| `docs/iterations/iteration-3/evidence/AC-09.meta.json` | 696 B |
| `docs/iterations/iteration-3/evidence/AC-09.output.json` | 13334 B |
| `docs/iterations/iteration-3/evidence/AC-09.status.txt` | 4134 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 命令退出码是 0（期望 0） | ✅ | `0` |
| 2 | 输出含「节点 T-002 撰写者 已完成 · 第 2 轮」（期望含 "节点 T-002 撰写者 已完成 · 第 2 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-31208-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产` |
| 3 | 输出含「节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过」（期望匹配 /节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 (?:\d+(?:\.\d+)?(?:ms\|s\|m\|h))+ · 审核 通过/） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-31208-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产` |
| 4 | 输出含「实例 INST-001 · 已完成 · 模板 通用任务闭环」（期望含 "实例 INST-001 · 已完成 · 模板 通用任务闭环"） | ✅ | `实例 INST-001 · 已完成 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 1s · 审核 通过<br>会话 空闲<br>交接包 HO-001  研究员→撰写` |
| 5 | status 的 T-002 行是「节点 T-002 撰写者 已完成 · 第 2 轮」（期望含 "节点 T-002 撰写者 已完成 · 第 2 轮"） | ✅ | `节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md` |
| 6 | status 的 T-002 行产物仍是 v2（本轮引用）（期望含 "产物 artifacts/docs/release-notes.v2.md"） | ✅ | `节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md` |
| 7 | 机检：v1 与 v2 同时存在 | ✅ | `v1=true/229B v2=true/302B` |
| 8 | 机检：v1 的 sha256 与第 1 轮记录一致 | ✅ | `now=2cc51bd424dde5b1fa59e11508deb7a09840d9382b074be4ceee6c7a3a92e727 recorded=2cc51bd424dde5b1fa59e11508deb7a09840d9382b074be4ceee6c7a3a92e727` |
| 9 | 机检：artifactHistory 恰好两条（v1 第 1 轮 + v2 第 2 轮）（期望 "1:artifacts/docs/release-notes.v1.md,2:artifacts/docs/release-notes.v2.md"） | ✅ | `"1:artifacts/docs/release-notes.v1.md,2:artifacts/docs/release-notes.v2.md"` |
| 10 | 机检：T-003 review.decision = pass（期望 "pass"） | ✅ | `"pass"` |
| 11 | 机检：T-003 review.artifact = artifacts/docs/release-notes.v2.md（期望 "artifacts/docs/release-notes.v2.md"） | ✅ | `"artifacts/docs/release-notes.v2.md"` |
| 12 | 机检：实例 state = completed（期望 "completed"） | ✅ | `"completed"` |
| 13 | 机检：无 pending 升级（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-10 审核第 2 轮驳回 → 停止回流、升级挂起

- 判定：**通过**（核对 18/18 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-10`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-reject-twice（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-10 --scenario doc-reject-twice   | cwd=D:\WWW\Maestro | exit=4 | 2239ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-10 | exit=0 | 242ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-10 | exit=0 | 207ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-10.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-reject-twice 已完整跑完
Then 命令在 60 秒内结束，退出码是 4
And 输出含"实例 INST-001 · 已挂起 · 模板 通用任务闭环"
And 输出含"升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮"
When 我执行 orch status --instance INST-001
Then 输出含"原因：回流超上限：审核者已派发 2 次仍未通过"
And 输出含"节点：T-003 审核者 · 第 2 轮"
And 输出含两条"缺陷："行
And 机检：实例 state='suspended'
And 机检：T-003 state='escalated'、round=2；T-002 state='done'、round=2
And 机检：counters.dispatchCount=5；handoffs 恰好 4 条，没有 HO-005
And 机检：escalations 恰好 1 条，state='pending'，defects 2 条
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-10.state.live.json` | 10995 B |
| `docs/iterations/iteration-3/evidence/AC-10.state.json` | 10995 B |
| `docs/iterations/iteration-3/evidence/AC-10.events.jsonl` | 15293 B |
| `docs/iterations/iteration-3/evidence/AC-10.meta.json` | 896 B |
| `docs/iterations/iteration-3/evidence/AC-10.output.json` | 12789 B |
| `docs/iterations/iteration-3/evidence/AC-10.status.txt` | 3362 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 命令在 60 秒内结束且退出码是 4 | ✅ | `exit=4 2239ms` |
| 2 | 输出含「实例 INST-001 · 已挂起 · 模板 通用任务闭环」（期望含 "实例 INST-001 · 已挂起 · 模板 通用任务闭环"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-25016-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产` |
| 3 | 输出含「升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮」（期望含 "升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-25016-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产` |
| 4 | 输出含「原因：回流超上限：审核者已派发 2 次仍未通过」（期望含 "原因：回流超上限：审核者已派发 2 次仍未通过"） | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已升级 · 第 2 轮<br>会话 已升级<br>交接包 HO-001  研究员→撰写者  已构造   21:26:` |
| 5 | 输出含「节点：T-003 审核者 · 第 2 轮」（期望含 "节点：T-003 审核者 · 第 2 轮"） | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已升级 · 第 2 轮<br>会话 已升级<br>交接包 HO-001  研究员→撰写者  已构造   21:26:` |
| 6 | 输出含两条「缺陷：」行（期望 2） | ✅ | `2` |
| 7 | 两条缺陷行分别带证据（v2） | ✅ | `  缺陷：缺少回滚方案（证据 artifacts/docs/release-notes.v2.md#L1） \|   缺陷：升级步骤缺少验证（证据 artifacts/docs/release-notes.v2.md#L18）` |
| 8 | 机检：实例 state = suspended（期望 "suspended"） | ✅ | `"suspended"` |
| 9 | 机检：T-003 state/round = escalated/2（期望 "escalated/2"） | ✅ | `"escalated/2"` |
| 10 | 机检：T-002 state/round = done/2（期望 "done/2"） | ✅ | `"done/2"` |
| 11 | 机检：counters.dispatchCount = 5（期望 5） | ✅ | `5` |
| 12 | 机检：handoffs 恰好 4 条，没有 HO-005 | ✅ | `HO-001,HO-002,HO-003,HO-004` |
| 13 | 机检：escalations 恰好 1 条（期望 1） | ✅ | `1` |
| 14 | 机检：升级 state = pending（期望 "pending"） | ✅ | `"pending"` |
| 15 | 机检：升级 defects 恰好 2 条（期望 2） | ✅ | `2` |
| 16 | 机检：升级 nodeId/round = T-003/2（期望 "T-003/2"） | ✅ | `"T-003/2"` |
| 17 | 机检：升级 reasonCode = rounds_exceeded（期望 "rounds_exceeded"） | ✅ | `"rounds_exceeded"` |
| 18 | 机检：HO-004 是最后一张交接包且已 consumed（期望 "consumed"） | ✅ | `"consumed"` |

**⑤ 判定**：通过

**备注**

- `state.live.json` 是挂起时刻（run 结束后、core stop 之前）的快照；收尾 `state.json` 是 core stop 之后的快照（suspended 不在对账范围，字段不变）。

---

#### AC-11 挂起后不再自动推进

- 判定：**通过**（核对 9/9 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-11`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-reject-twice（跑到挂起）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-11 --scenario doc-reject-twice   | cwd=D:\WWW\Maestro | exit=4 | 2249ms
[orch status --instance INST-001（拉起核心）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-11 | exit=0 | 241ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-11 | exit=0 | 194ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-11.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given AC-10 的实例已挂起，核心仍在运行
When 我等待 60 秒
Then 机检：dispatchCount 仍为 5
And 机检：events.jsonl 行数与等待前相同
And 机检：sessions 数量不再增加
And 机检：T-003 仍为 'escalated'，实例仍为 'suspended'
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-11.state.before-wait.json` | 10993 B |
| `docs/iterations/iteration-3/evidence/AC-11.state.after-wait.json` | 10993 B |
| `docs/iterations/iteration-3/evidence/AC-11.state.json` | 10993 B |
| `docs/iterations/iteration-3/evidence/AC-11.events.jsonl` | 15288 B |
| `docs/iterations/iteration-3/evidence/AC-11.meta.json` | 798 B |
| `docs/iterations/iteration-3/evidence/AC-11.output.json` | 7585 B |
| `docs/iterations/iteration-3/evidence/AC-11.status.txt` | 3379 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 前置：实例已挂起（run 退出码 4） | ✅ | `exit=4` |
| 2 | 前置：核心已拉起且实例显示「已挂起」（期望含 "实例 INST-001 · 已挂起"） | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已升级 · 第 2 轮<br>会话 已升级<br>交接包 HO-001  研究员→撰写者  已构造   21:26:` |
| 3 | 前置：核心进程活着（.orch/core.json 的 pid 非空） | ✅ | `pid=32656` |
| 4 | 机检：dispatchCount 仍为 5（等待 60 秒后） | ✅ | `等待前 5 → 等待后 5` |
| 5 | 机检：events.jsonl 行数与等待前相同 | ✅ | `等待前 65 行 → 等待后 65 行` |
| 6 | 机检：sessions 数量不再增加 | ✅ | `等待前 5 → 等待后 5` |
| 7 | 机检：T-003 仍为 escalated、实例仍为 suspended | ✅ | `T-003=escalated/2 实例=suspended` |
| 8 | 机检：handoffs 数量也不增加（4 条，无 HO-005） | ✅ | `4 → 4` |
| 9 | 备注：等待期间核心 pid 未变（未重启、未换核） | ✅ | `pid 32656 → 32656` |

**⑤ 判定**：通过

**备注**

- 等待时长 60000ms（需求原文 60 秒）；等待前后各落一份 state 快照，便于逐字段对照。

---

#### AC-12 重启后仍挂起，轮次与升级都在

- 判定：**通过**（核对 13/13 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-12`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-reject-twice（跑到挂起）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-12 --scenario doc-reject-twice   | cwd=D:\WWW\Maestro | exit=4 | 2201ms
[orch status --instance INST-001（重启前，拉起核心）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-12 | exit=0 | 225ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-12 | exit=0 | 199ms
[orch status --instance INST-001（重启后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-12 | exit=0 | 211ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-12 | exit=0 | 209ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-12.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given AC-10 的实例已挂起
When 我执行 orch core stop
And 我重新执行一次 orch status --instance INST-001（必要时自动拉起核心）
Then 第一行含"已挂起"，不含"已中断"
And 输出仍含"升级 ESC-001 待处理"与"回流超上限"
And 机检：T-002 round=2、T-003 round=2，与重启前一致
And 机检：没有新增 node.dispatch 事件
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-12.state.before-restart.json` | 10993 B |
| `docs/iterations/iteration-3/evidence/AC-12.state.after-restart.json` | 10993 B |
| `docs/iterations/iteration-3/evidence/AC-12.state.json` | 10993 B |
| `docs/iterations/iteration-3/evidence/AC-12.events.jsonl` | 15283 B |
| `docs/iterations/iteration-3/evidence/AC-12.meta.json` | 916 B |
| `docs/iterations/iteration-3/evidence/AC-12.output.json` | 12891 B |
| `docs/iterations/iteration-3/evidence/AC-12.status.txt` | 5700 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 前置：实例已挂起（run 退出码 4） | ✅ | `exit=4` |
| 2 | 前置：挂起时核心活着（pid 非空且进程存在） | ✅ | `pid=25248` |
| 3 | orch core stop 执行后核心进程已退出 | ✅ | `exit=0 pid=25248 alive=false` |
| 4 | status 之后是**新**核心进程（pid 变了） | ✅ | `pid 25248 → 28724` |
| 5 | 第一行含「已挂起」且不含「已中断」 | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环` |
| 6 | 输出仍含「升级 ESC-001 待处理」（期望含 "升级 ESC-001 待处理"） | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已升级 · 第 2 轮<br>会话 已升级<br>交接包 HO-001  研究员→撰写者  已构造   21:27:` |
| 7 | 输出仍含「回流超上限」（期望含 "回流超上限"） | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已升级 · 第 2 轮<br>会话 已升级<br>交接包 HO-001  研究员→撰写者  已构造   21:27:` |
| 8 | 机检：T-002 round 与重启前一致（2）（期望 2） | ✅ | `2` |
| 9 | 机检：T-003 round 与重启前一致（2）（期望 2） | ✅ | `2` |
| 10 | 机检：重启后 T-002/T-003 round 都是 2 | ✅ | `T-002=2 T-003=2` |
| 11 | 机检：没有新增 node.dispatch 事件 | ✅ | `重启前 5 条 → 重启后 5 条` |
| 12 | 机检：升级 ESC-001 仍是 pending、reasonDetail 未变 | ✅ | `ESC-001/pending 回流超上限：审核者已派发 2 次仍未通过` |
| 13 | 机检：实例仍是 suspended、T-003 仍是 escalated | ✅ | `suspended/escalated` |

**⑤ 判定**：通过

**备注**

- 重启手法：`orch run` 挂起后先用 `orch status` 拉起核心（拿到 pid A）→ `orch core stop` → 再 `orch status` 由 CLI 的 `connect({ensure:true})` 自动拉起新核心（pid B≠A）→ 读盘。

---

#### AC-13 审核文件缺失 → 升级，不回流

- 判定：**通过**（核对 15/15 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-13`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario review-missing（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-13 --scenario review-missing   | cwd=D:\WWW\Maestro | exit=4 | 1437ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-13 | exit=0 | 200ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-13 | exit=0 | 197ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-13.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-missing 已完整跑完
Then 退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：未找到审核文件 out/review.json"
And 输出含"节点 T-003 审核者 已升级"
And 输出含"节点 T-002 撰写者 已完成"
And 机检：T-003 state='escalated'；T-002 state='done'
And 机检：counters.dispatchCount=3；handoffs 恰好 2 条，没有 HO-003
And 机检：events 中没有 backflow.constructed
And 机检：读取根是**任务目录**而不是实例工作区——`review-missing` 场景本身就配了 `reviewDecoy:'workspace'`（D-9 的 `reviewDecoy` 项），夹具在 `.orch/instances/INST-001/workspace/out/review.json` 放一份**合法 pass** 的干扰文件，核心仍报"未找到审核文件 out/review.json"，且 `demo-doc/out/` 下没有该文件
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-13.state.json` | 6809 B |
| `docs/iterations/iteration-3/evidence/AC-13.events.jsonl` | 8206 B |
| `docs/iterations/iteration-3/evidence/AC-13.meta.json` | 690 B |
| `docs/iterations/iteration-3/evidence/AC-13.output.json` | 6184 B |
| `docs/iterations/iteration-3/evidence/AC-13.status.txt` | 2352 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码是 4（期望 4） | ✅ | `4` |
| 2 | 输出含「原因：核对失败：未找到审核文件 out/review.json」（期望含 "原因：核对失败：未找到审核文件 out/review.json"） | ✅ | `  原因：核对失败：未找到审核文件 out/review.json` |
| 3 | 输出含「节点 T-003 审核者 已升级」（期望含 "节点 T-003 审核者 已升级"） | ✅ | `节点 T-003 审核者 已升级 · 第 1 轮` |
| 4 | 输出含「节点 T-002 撰写者 已完成」（期望含 "节点 T-002 撰写者 已完成"） | ✅ | `节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v1.md` |
| 5 | 机检：T-003 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 6 | 机检：T-002 state='done'（期望 "done"） | ✅ | `"done"` |
| 7 | 机检：counters.dispatchCount=3（期望 3） | ✅ | `3` |
| 8 | 机检：handoffs 恰好 2 条（期望 2） | ✅ | `2` |
| 9 | 机检：handoffs 依次是 HO-001、HO-002（期望 "HO-001,HO-002"） | ✅ | `"HO-001,HO-002"` |
| 10 | 机检：没有 HO-003 | ✅ | `HO-001,HO-002` |
| 11 | 机检：events 中没有 backflow.constructed（期望 0） | ✅ | `0` |
| 12 | 机检：夹具在工作区放了一份合法 pass 干扰文件（decision）（期望 "pass"） | ✅ | `"pass"` |
| 13 | 机检：核心仍报「未找到审核文件 out/review.json」（未被工作区同名文件带偏）（期望含 "未找到审核文件 out/review.json"） | ✅ | `  原因：核对失败：未找到审核文件 out/review.json` |
| 14 | 机检：任务目录 demo-doc/out/review.json 不存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-13\demo-doc/out/review.json` |
| 15 | 机检：任务目录 demo-doc/out 目录不存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-13\demo-doc/out` |

**⑤ 判定**：通过

---

#### AC-14 审核文件不是本轮新写 → 单独原因

- 判定：**通过**（核对 6/6 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-14`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario review-stale（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-14 --scenario review-stale   | cwd=D:\WWW\Maestro | exit=4 | 1588ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-14 | exit=0 | 206ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-14 | exit=0 | 198ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-14.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-stale 已完整跑完
Then 退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核文件不是本轮新写 out/review.json"
And 输出不含"未找到审核文件"
And 机检：T-003 state='escalated'；counters.dispatchCount=3
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-14.state.json` | 6816 B |
| `docs/iterations/iteration-3/evidence/AC-14.events.jsonl` | 8209 B |
| `docs/iterations/iteration-3/evidence/AC-14.meta.json` | 695 B |
| `docs/iterations/iteration-3/evidence/AC-14.output.json` | 5343 B |
| `docs/iterations/iteration-3/evidence/AC-14.status.txt` | 2357 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码是 4（期望 4） | ✅ | `4` |
| 2 | 输出含「原因：核对失败：审核文件不是本轮新写 out/review.json」（期望含 "原因：核对失败：审核文件不是本轮新写 out/review.json"） | ✅ | `  原因：核对失败：审核文件不是本轮新写 out/review.json` |
| 3 | 输出不含「未找到审核文件」（陈旧文件不能报成缺失）（期望不含 "未找到审核文件"） | ✅ | `实例 INST-001 · 已挂起 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v1.md<br>节点 T-003 审核者 已升级 · 第 1 轮<br>会话 已升级<br>交接包 HO-001  研究员→撰写者  已构造   21:06:` |
| 4 | 机检：T-003 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 5 | 机检：counters.dispatchCount=3（期望 3） | ✅ | `3` |
| 6 | 机检：没有 HO-003（未回流） | ✅ | `HO-001,HO-002` |

**⑤ 判定**：通过

---

#### AC-15 审核文件不可解析或结论非法

- 判定：**通过**（核对 6/6 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario review-bad-json（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15 --scenario review-bad-json   | cwd=D:\WWW\Maestro | exit=4 | 1466ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15 | exit=0 | 214ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15 | exit=0 | 200ms
[[分支二（另起全新根）] driver --scenario review-decision-invalid（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15-b --scenario review-decision-invalid   | cwd=D:\WWW\Maestro | exit=4 | 1551ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15-b | exit=0 | 208ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-15-b | exit=0 | 183ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-15.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-bad-json 已完整跑完
Then 退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核文件不可解析"
Given 另起全新根，夹具场景 review-decision-invalid 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核结论只能是 pass 或 reject"
And 机检：两次的 T-003 state 都是 'escalated'，dispatchCount 都是 3
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-15.state.json` | 16541 B |
| `docs/iterations/iteration-3/evidence/AC-15.events.jsonl` | 19454 B |
| `docs/iterations/iteration-3/evidence/AC-15.meta.json` | 1136 B |
| `docs/iterations/iteration-3/evidence/AC-15.output.json` | 7714 B |
| `docs/iterations/iteration-3/evidence/AC-15.status.txt` | 4852 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then [分支一] 退出码是 4（期望 4） | ✅ | `4` |
| 2 | 输出含「原因：核对失败：审核文件不可解析」（期望含 "原因：核对失败：审核文件不可解析"） | ✅ | `  原因：核对失败：审核文件不可解析` |
| 3 | Then [分支二（另起全新根）] 退出码是 4（期望 4） | ✅ | `4` |
| 4 | 输出含「原因：核对失败：审核结论只能是 pass 或 reject」（期望含 "原因：核对失败：审核结论只能是 pass 或 reject"） | ✅ | `  原因：核对失败：审核结论只能是 pass 或 reject` |
| 5 | 机检：两次的 T-003 state 都是 'escalated' | ✅ | `分支一:T-003=escalated；分支二（另起全新根）:T-003=escalated` |
| 6 | 机检：两次的 dispatchCount 都是 3 | ✅ | `分支一:dispatchCount=3；分支二（另起全新根）:dispatchCount=3` |

**⑤ 判定**：通过

**备注**

- 分支二（review-decision-invalid）的需求正文只对「结论非法」给了 Then 文案，未单列退出码；此处按同一异常路径一并核对退出码 4（实测 4），属加严观测，不构成放宽。

---

#### AC-16 审核未引用或引用了别的文档

- 判定：**通过**（核对 5/5 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario review-artifact-missing（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16 --scenario review-artifact-missing   | cwd=D:\WWW\Maestro | exit=4 | 1559ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16 | exit=0 | 216ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16 | exit=0 | 233ms
[[分支二（另起全新根）] driver --scenario review-artifact-mismatch（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16-b --scenario review-artifact-mismatch   | cwd=D:\WWW\Maestro | exit=4 | 1581ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16-b | exit=0 | 206ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-16-b | exit=0 | 185ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-16.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-artifact-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核未引用本轮文档"
Given 另起全新根，夹具场景 review-artifact-mismatch 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md"
And 机检：两次的 T-003 state 都是 'escalated'
And 机检：都没有 backflow.constructed，也没有 HO-003
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-16.state.json` | 16584 B |
| `docs/iterations/iteration-3/evidence/AC-16.events.jsonl` | 19531 B |
| `docs/iterations/iteration-3/evidence/AC-16.meta.json` | 904 B |
| `docs/iterations/iteration-3/evidence/AC-16.output.json` | 7761 B |
| `docs/iterations/iteration-3/evidence/AC-16.status.txt` | 4895 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 输出含「原因：核对失败：审核未引用本轮文档」（期望含 "原因：核对失败：审核未引用本轮文档"） | ✅ | `  原因：核对失败：审核未引用本轮文档` |
| 2 | 输出含「原因：核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md」（期望含 "原因：核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md"） | ✅ | `  原因：核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md` |
| 3 | 机检：两次的 T-003 state 都是 'escalated' | ✅ | `分支一:T-003=escalated；分支二（另起全新根）:T-003=escalated` |
| 4 | 机检：两次都没有 backflow.constructed | ✅ | `分支一:backflow.constructed=0；分支二（另起全新根）:backflow.constructed=0` |
| 5 | 机检：两次都没有 HO-003 | ✅ | `分支一:handoffs=HO-001\|HO-002；分支二（另起全新根）:handoffs=HO-001\|HO-002` |

**⑤ 判定**：通过

---

#### AC-17 审核结论与缺陷清单自相矛盾

- 判定：**通过**（核对 5/5 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-b`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-c`
- 实例：INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario review-pass-with-defects（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17 --scenario review-pass-with-defects   | cwd=D:\WWW\Maestro | exit=4 | 1605ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17 | exit=0 | 244ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17 | exit=0 | 187ms
[[分支二（另起全新根）] driver --scenario review-reject-no-defects（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-b --scenario review-reject-no-defects   | cwd=D:\WWW\Maestro | exit=4 | 1559ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-b | exit=0 | 217ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-b | exit=0 | 195ms
[[分支三（另起全新根）] driver --scenario review-defect-shape（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-c --scenario review-defect-shape   | cwd=D:\WWW\Maestro | exit=4 | 1597ms
[[分支三（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-c | exit=0 | 215ms
[[分支三（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-17-c | exit=0 | 182ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-17.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-pass-with-defects 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核为通过，但缺陷清单非空"
Given 另起全新根，夹具场景 review-reject-no-defects 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核为驳回，但没有缺陷清单"
Given 另起全新根，夹具场景 review-defect-shape 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核缺陷缺少摘要或证据"
And 机检：三次的 T-003 state 都是 'escalated'，dispatchCount 都是 3
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-17.state.json` | 24845 B |
| `docs/iterations/iteration-3/evidence/AC-17.events.jsonl` | 29297 B |
| `docs/iterations/iteration-3/evidence/AC-17.meta.json` | 1121 B |
| `docs/iterations/iteration-3/evidence/AC-17.output.json` | 11077 B |
| `docs/iterations/iteration-3/evidence/AC-17.status.txt` | 7352 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 输出含「原因：核对失败：审核为通过，但缺陷清单非空」（期望含 "原因：核对失败：审核为通过，但缺陷清单非空"） | ✅ | `  原因：核对失败：审核为通过，但缺陷清单非空` |
| 2 | 输出含「原因：核对失败：审核为驳回，但没有缺陷清单」（期望含 "原因：核对失败：审核为驳回，但没有缺陷清单"） | ✅ | `  原因：核对失败：审核为驳回，但没有缺陷清单` |
| 3 | 输出含「原因：核对失败：审核缺陷缺少摘要或证据」（期望含 "原因：核对失败：审核缺陷缺少摘要或证据"） | ✅ | `  原因：核对失败：审核缺陷缺少摘要或证据` |
| 4 | 机检：三次的 T-003 state 都是 'escalated' | ✅ | `分支一:T-003=escalated；分支二（另起全新根）:T-003=escalated；分支三（另起全新根）:T-003=escalated` |
| 5 | 机检：三次的 dispatchCount 都是 3 | ✅ | `分支一:dispatchCount=3；分支二（另起全新根）:dispatchCount=3；分支三（另起全新根）:dispatchCount=3` |

**⑤ 判定**：通过

---

#### AC-18 缺陷证据不可解析

- 判定：**通过**（核对 4/4 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario review-evidence-unreadable（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18 --scenario review-evidence-unreadable   | cwd=D:\WWW\Maestro | exit=4 | 1560ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18 | exit=0 | 216ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18 | exit=0 | 182ms
[[分支二（另起全新根）] driver --scenario review-evidence-outside（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18-b --scenario review-evidence-outside   | cwd=D:\WWW\Maestro | exit=4 | 1558ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18-b | exit=0 | 211ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-18-b | exit=0 | 182ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-18.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-evidence-unreadable 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：缺陷证据不可解析 artifacts/docs/missing.md#L3"
Given 另起全新根，夹具场景 review-evidence-outside 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：缺陷证据不可解析 ../outside.md#L1"
And 机检：两次的 T-003 state 都是 'escalated'
And 机检：escalations[0].defects 为空（未校验通过的缺陷不进入升级块）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-18.state.json` | 16598 B |
| `docs/iterations/iteration-3/evidence/AC-18.events.jsonl` | 19556 B |
| `docs/iterations/iteration-3/evidence/AC-18.meta.json` | 889 B |
| `docs/iterations/iteration-3/evidence/AC-18.output.json` | 7555 B |
| `docs/iterations/iteration-3/evidence/AC-18.status.txt` | 4907 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 输出含「原因：核对失败：缺陷证据不可解析 artifacts/docs/missing.md#L3」（期望含 "原因：核对失败：缺陷证据不可解析 artifacts/docs/missing.md#L3"） | ✅ | `  原因：核对失败：缺陷证据不可解析 artifacts/docs/missing.md#L3` |
| 2 | 输出含「原因：核对失败：缺陷证据不可解析 ../outside.md#L1」（期望含 "原因：核对失败：缺陷证据不可解析 ../outside.md#L1"） | ✅ | `  原因：核对失败：缺陷证据不可解析 ../outside.md#L1` |
| 3 | 机检：两次的 T-003 state 都是 'escalated' | ✅ | `分支一:T-003=escalated；分支二（另起全新根）:T-003=escalated` |
| 4 | 机检：escalations[0].defects 为空（两次） | ✅ | `分支一:defects=[]；分支二（另起全新根）:defects=[]` |

**⑤ 判定**：通过

---

#### AC-19 撰写产物缺失、为空或不是本轮新写

- 判定：**通过**（核对 7/7 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-b`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-c`
- 实例：INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario doc-missing（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19 --scenario doc-missing   | cwd=D:\WWW\Maestro | exit=4 | 1297ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19 | exit=0 | 204ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19 | exit=0 | 199ms
[[分支二（另起全新根）] driver --scenario doc-empty（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-b --scenario doc-empty   | cwd=D:\WWW\Maestro | exit=4 | 1219ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-b | exit=0 | 201ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-b | exit=0 | 183ms
[[分支三（另起全新根）] driver --scenario doc-stale（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-c --scenario doc-stale   | cwd=D:\WWW\Maestro | exit=4 | 1223ms
[[分支三（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-c | exit=0 | 196ms
[[分支三（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-19-c | exit=0 | 186ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-19.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：未找到声明的产出 artifacts/docs/release-notes.v1.md"
Given 另起全新根，夹具场景 doc-empty 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出为空 artifacts/docs/release-notes.v1.md"
Given 另起全新根，夹具场景 doc-stale 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出不是本轮新写 artifacts/docs/release-notes.v1.md"
And 机检：三次都是 T-002 state='escalated'、T-003 state='pending'
And 机检：三次的 counters.dispatchCount 都是 2
And 机检：三次都没有名为 HO-002 的交接包
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-19.state.json` | 18149 B |
| `docs/iterations/iteration-3/evidence/AC-19.events.jsonl` | 18155 B |
| `docs/iterations/iteration-3/evidence/AC-19.meta.json` | 1130 B |
| `docs/iterations/iteration-3/evidence/AC-19.output.json` | 10559 B |
| `docs/iterations/iteration-3/evidence/AC-19.status.txt` | 6159 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 输出含「原因：核对失败：未找到声明的产出 artifacts/docs/release-notes.v1.md」（期望含 "原因：核对失败：未找到声明的产出 artifacts/docs/release-notes.v1.md"） | ✅ | `  原因：核对失败：未找到声明的产出 artifacts/docs/release-notes.v1.md` |
| 2 | 输出含「原因：核对失败：产出为空 artifacts/docs/release-notes.v1.md」（期望含 "原因：核对失败：产出为空 artifacts/docs/release-notes.v1.md"） | ✅ | `  原因：核对失败：产出为空 artifacts/docs/release-notes.v1.md` |
| 3 | 输出含「原因：核对失败：产出不是本轮新写 artifacts/docs/release-notes.v1.md」（期望含 "原因：核对失败：产出不是本轮新写 artifacts/docs/release-notes.v1.md"） | ✅ | `  原因：核对失败：产出不是本轮新写 artifacts/docs/release-notes.v1.md` |
| 4 | 机检：三次都是 T-002 state='escalated' | ✅ | `分支一:T-002=escalated；分支二（另起全新根）:T-002=escalated；分支三（另起全新根）:T-002=escalated` |
| 5 | 机检：三次都是 T-003 state='pending' | ✅ | `分支一:T-003=pending；分支二（另起全新根）:T-003=pending；分支三（另起全新根）:T-003=pending` |
| 6 | 机检：三次的 counters.dispatchCount 都是 2 | ✅ | `分支一:dispatchCount=2；分支二（另起全新根）:dispatchCount=2；分支三（另起全新根）:dispatchCount=2` |
| 7 | 机检：三次都没有名为 HO-002 的交接包 | ✅ | `分支一:handoffs=HO-001；分支二（另起全新根）:handoffs=HO-001；分支三（另起全新根）:handoffs=HO-001` |

**⑤ 判定**：通过

---

#### AC-20 上一版被改写或删除

- 判定：**通过**（核对 9/9 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario doc-previous-modified（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20 --scenario doc-previous-modified   | cwd=D:\WWW\Maestro | exit=4 | 1813ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20 | exit=0 | 214ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20 | exit=0 | 193ms
[[分支二（另起全新根）] driver --scenario doc-previous-missing（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20-b --scenario doc-previous-missing   | cwd=D:\WWW\Maestro | exit=4 | 1778ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20-b | exit=0 | 207ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-20-b | exit=0 | 192ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-20.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-previous-modified 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：上一版文档被改写 artifacts/docs/release-notes.v1.md"
Given 另起全新根，夹具场景 doc-previous-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：上一版文档缺失 artifacts/docs/release-notes.v1.md"
And 机检：两次都是 T-002 state='escalated'、round=2
And 机检：两次的 T-003 state='failed'、round=1（保持等待复审）
And 机检：两次的 counters.dispatchCount 都是 4
And 机检：两次都是 handoffs 恰好 3 条（HO-001~HO-003），其中 edge.kind='backflow' 恰好 1 条；不存在 HO-004
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-20.state.json` | 22256 B |
| `docs/iterations/iteration-3/evidence/AC-20.events.jsonl` | 27385 B |
| `docs/iterations/iteration-3/evidence/AC-20.meta.json` | 892 B |
| `docs/iterations/iteration-3/evidence/AC-20.output.json` | 9539 B |
| `docs/iterations/iteration-3/evidence/AC-20.status.txt` | 5708 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 输出含「原因：核对失败：上一版文档被改写 artifacts/docs/release-notes.v1.md」（期望含 "原因：核对失败：上一版文档被改写 artifacts/docs/release-notes.v1.md"） | ✅ | `  原因：核对失败：上一版文档被改写 artifacts/docs/release-notes.v1.md` |
| 2 | 输出含「原因：核对失败：上一版文档缺失 artifacts/docs/release-notes.v1.md」（期望含 "原因：核对失败：上一版文档缺失 artifacts/docs/release-notes.v1.md"） | ✅ | `  原因：核对失败：上一版文档缺失 artifacts/docs/release-notes.v1.md` |
| 3 | 机检：两次都是 T-002 state='escalated'、round=2 | ✅ | `分支一:T-002=escalated/2；分支二（另起全新根）:T-002=escalated/2` |
| 4 | 机检：两次的 T-003 state='failed'、round=1 | ✅ | `分支一:T-003=failed/1；分支二（另起全新根）:T-003=failed/1` |
| 5 | 机检：两次的 counters.dispatchCount 都是 4 | ✅ | `分支一:dispatchCount=4；分支二（另起全新根）:dispatchCount=4` |
| 6 | 机检：两次都是 handoffs 恰好 3 条 | ✅ | `分支一:count=3；分支二（另起全新根）:count=3` |
| 7 | 机检：两次的 handoffs 依次是 HO-001、HO-002、HO-003 | ✅ | `分支一:HO-001,HO-002,HO-003；分支二（另起全新根）:HO-001,HO-002,HO-003` |
| 8 | 机检：两次都是 edge.kind='backflow' 恰好 1 条 | ✅ | `分支一:backflow=1；分支二（另起全新根）:backflow=1` |
| 9 | 机检：两次都不存在 HO-004 | ✅ | `分支一:handoffs=HO-001\|HO-002\|HO-003；分支二（另起全新根）:handoffs=HO-001\|HO-002\|HO-003` |

**⑤ 判定**：通过

---

#### AC-21 研究笔记缺失、为空或不是本轮新写

- 判定：**通过**（核对 6/6 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-b`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-c`
- 实例：INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[[分支一] driver --scenario research-missing（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21 --scenario research-missing   | cwd=D:\WWW\Maestro | exit=4 | 1019ms
[[分支一] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21 | exit=0 | 227ms
[[分支一] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21 | exit=0 | 202ms
[[分支二（另起全新根）] driver --scenario research-empty（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-b --scenario research-empty   | cwd=D:\WWW\Maestro | exit=4 | 893ms
[[分支二（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-b | exit=0 | 231ms
[[分支二（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-b | exit=0 | 185ms
[[分支三（另起全新根）] driver --scenario research-stale（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-c --scenario research-stale   | cwd=D:\WWW\Maestro | exit=4 | 911ms
[[分支三（另起全新根）] orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-c | exit=0 | 227ms
[[分支三（另起全新根）] orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-21-c | exit=0 | 190ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-21.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 research-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：未找到声明的产出 artifacts/reports/research-notes.v1.md"
Given 另起全新根，夹具场景 research-empty 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出为空 artifacts/reports/research-notes.v1.md"
Given 另起全新根，夹具场景 research-stale 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出不是本轮新写 artifacts/reports/research-notes.v1.md"
And 机检：三次都是 T-001 state='escalated'、T-002 state='pending'
And 机检：三次的 counters.dispatchCount 都是 1
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-21.state.json` | 11328 B |
| `docs/iterations/iteration-3/evidence/AC-21.events.jsonl` | 8874 B |
| `docs/iterations/iteration-3/evidence/AC-21.meta.json` | 1130 B |
| `docs/iterations/iteration-3/evidence/AC-21.output.json` | 9355 B |
| `docs/iterations/iteration-3/evidence/AC-21.status.txt` | 5199 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 输出含「原因：核对失败：未找到声明的产出 artifacts/reports/research-notes.v1.md」（期望含 "原因：核对失败：未找到声明的产出 artifacts/reports/research-notes.v1.md"） | ✅ | `  原因：核对失败：未找到声明的产出 artifacts/reports/research-notes.v1.md` |
| 2 | 输出含「原因：核对失败：产出为空 artifacts/reports/research-notes.v1.md」（期望含 "原因：核对失败：产出为空 artifacts/reports/research-notes.v1.md"） | ✅ | `  原因：核对失败：产出为空 artifacts/reports/research-notes.v1.md` |
| 3 | 输出含「原因：核对失败：产出不是本轮新写 artifacts/reports/research-notes.v1.md」（期望含 "原因：核对失败：产出不是本轮新写 artifacts/reports/research-notes.v1.md"） | ✅ | `  原因：核对失败：产出不是本轮新写 artifacts/reports/research-notes.v1.md` |
| 4 | 机检：三次都是 T-001 state='escalated' | ✅ | `分支一:T-001=escalated；分支二（另起全新根）:T-001=escalated；分支三（另起全新根）:T-001=escalated` |
| 5 | 机检：三次都是 T-002 state='pending' | ✅ | `分支一:T-002=pending；分支二（另起全新根）:T-002=pending；分支三（另起全新根）:T-002=pending` |
| 6 | 机检：三次的 counters.dispatchCount 都是 1 | ✅ | `分支一:dispatchCount=1；分支二（另起全新根）:dispatchCount=1；分支三（另起全新根）:dispatchCount=1` |

**⑤ 判定**：通过

---

#### AC-22 发起前拦截空任务与缺产物行

- 判定：**通过**（核对 11/11 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch run --template task-loop --cwd ./demo-doc --task "   "] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task "   " --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22 | exit=1 | 240ms
[orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明，但没有产物行"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写一篇发布说明，但没有产物行 --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22 | exit=1 | 153ms
[orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明。产物: release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task "写一篇发布说明。产物: release-notes.md" --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22 | exit=1 | 126ms
[orch run --template task-loop --cwd ./demo-doc --task ""] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task  --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22 | exit=2 | 97ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22 | exit=0 | 234ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-22.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根 <根绝对路径>
When 我执行 orch run --template task-loop --cwd ./demo-doc --task "   "
Then 输出含"任务描述不能为空"，退出码 1
When 我执行 orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明，但没有产物行"
Then 输出含"通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）"，退出码 1
When 我执行 orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明。产物: release-notes.md"
Then 同样输出上面的提示，退出码 1
And 机检：三次之后 `.orch/instances` 仍为空，没有创建工作区目录
And 单独用 --task "" 发起时，输出含"--task 需要一个值"，退出码 2，同样不建实例
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-22.state.json` | 5 B |
| `docs/iterations/iteration-3/evidence/AC-22.events.jsonl` | 0 B |
| `docs/iterations/iteration-3/evidence/AC-22.meta.json` | 595 B |
| `docs/iterations/iteration-3/evidence/AC-22.output.json` | 6135 B |
| `docs/iterations/iteration-3/evidence/AC-22.status.txt` | 2182 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 输出含「任务描述不能为空」（期望含 "任务描述不能为空"） | ✅ | `任务描述不能为空` |
| 2 | Then 退出码 1（空任务）（期望 1） | ✅ | `1` |
| 3 | Then 输出含「通用任务闭环需要在任务里写…」（期望含 "通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）"） | ✅ | `通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）` |
| 4 | Then 退出码 1（缺产物行）（期望 1） | ✅ | `1` |
| 5 | Then 半角冒号同样输出上面的提示（期望含 "通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）"） | ✅ | `通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）` |
| 6 | Then 退出码 1（半角冒号）（期望 1） | ✅ | `1` |
| 7 | And 机检：三次之后 .orch/instances 仍为空（期望 "（空）"） | ✅ | `"（空）"` |
| 8 | And 机检：没有创建工作区目录 .orch/instances/INST-001 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-22/.orch/instances/INST-001` |
| 9 | And 输出含「--task 需要一个值」（期望含 "--task 需要一个值"） | ✅ | `  （--task 需要一个值）` |
| 10 | And 退出码 2（用法错误）（期望 2） | ✅ | `2` |
| 11 | And 机检：--task "" 之后 .orch/instances 仍为空（期望 "（空）"） | ✅ | `"（空）"` |

**⑤ 判定**：通过

---

#### AC-23 发起前拦截非法产物名

- 判定：**通过**（核对 16/16 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：docs/release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写发布说明。产物：docs/release-notes.md --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23 | exit=1 | 225ms
[orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：../release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写发布说明。产物：../release-notes.md --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23 | exit=1 | 102ms
[orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：C:\release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写发布说明。产物：C:\release-notes.md --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23 | exit=1 | 99ms
[orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：release-notes.txt"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写发布说明。产物：release-notes.txt --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23 | exit=1 | 105ms
[orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：release-notes.v1.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写发布说明。产物：release-notes.v1.md --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23 | exit=1 | 107ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-23 | exit=0 | 207ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-23.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根 <根绝对路径>
When 我依次用产物名 docs/release-notes.md、../release-notes.md、C:\release-notes.md、release-notes.txt、release-notes.v1.md 执行 orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：<上面的产物名>"
Then 每次都输出"通用任务闭环的产物名不合法："开头、"（只写文件名，.md 结尾，不带目录与版本号）"结尾的一行，且冒号与"（"之间的内容**逐字等于**该次写入的产物名；五次分别是：
And `通用任务闭环的产物名不合法：docs/release-notes.md（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：../release-notes.md（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：C:\release-notes.md（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：release-notes.txt（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：release-notes.v1.md（只写文件名，.md 结尾，不带目录与版本号）`
And 五次退出码均为 1
And 机检：五次之后 `.orch/instances` 仍为空
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-23.state.json` | 5 B |
| `docs/iterations/iteration-3/evidence/AC-23.events.jsonl` | 0 B |
| `docs/iterations/iteration-3/evidence/AC-23.meta.json` | 586 B |
| `docs/iterations/iteration-3/evidence/AC-23.output.json` | 9230 B |
| `docs/iterations/iteration-3/evidence/AC-23.status.txt` | 2805 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 整行逐字等于「通用任务闭环的产物名不合法：docs/release-notes.md（只写文件名，.md 结尾，不带目录与版本号）」（期望 "通用任务闭环的产物名不合法：docs/release-notes.md（只写文件名，.md 结尾，不带目录与版本号）"） | ✅ | `"通用任务闭环的产物名不合法：docs/release-notes.md（只写文件名，.md 结尾，不带目录与版本号）"` |
| 2 | Then 冒号与「（」之间的内容逐字等于 "docs/release-notes.md"（期望 "docs/release-notes.md"） | ✅ | `"docs/release-notes.md"` |
| 3 | Then 退出码 1（docs/release-notes.md）（期望 1） | ✅ | `1` |
| 4 | Then 整行逐字等于「通用任务闭环的产物名不合法：../release-notes.md（只写文件名，.md 结尾，不带目录与版本号）」（期望 "通用任务闭环的产物名不合法：../release-notes.md（只写文件名，.md 结尾，不带目录与版本号）"） | ✅ | `"通用任务闭环的产物名不合法：../release-notes.md（只写文件名，.md 结尾，不带目录与版本号）"` |
| 5 | Then 冒号与「（」之间的内容逐字等于 "../release-notes.md"（期望 "../release-notes.md"） | ✅ | `"../release-notes.md"` |
| 6 | Then 退出码 1（../release-notes.md）（期望 1） | ✅ | `1` |
| 7 | Then 整行逐字等于「通用任务闭环的产物名不合法：C:\release-notes.md（只写文件名，.md 结尾，不带目录与版本号）」（期望 "通用任务闭环的产物名不合法：C:\\release-notes.md（只写文件名，.md 结尾，不带目录与版本号）"） | ✅ | `"通用任务闭环的产物名不合法：C:\\release-notes.md（只写文件名，.md 结尾，不带目录与版本号）"` |
| 8 | Then 冒号与「（」之间的内容逐字等于 "C:\\release-notes.md"（期望 "C:\\release-notes.md"） | ✅ | `"C:\\release-notes.md"` |
| 9 | Then 退出码 1（C:\release-notes.md）（期望 1） | ✅ | `1` |
| 10 | Then 整行逐字等于「通用任务闭环的产物名不合法：release-notes.txt（只写文件名，.md 结尾，不带目录与版本号）」（期望 "通用任务闭环的产物名不合法：release-notes.txt（只写文件名，.md 结尾，不带目录与版本号）"） | ✅ | `"通用任务闭环的产物名不合法：release-notes.txt（只写文件名，.md 结尾，不带目录与版本号）"` |
| 11 | Then 冒号与「（」之间的内容逐字等于 "release-notes.txt"（期望 "release-notes.txt"） | ✅ | `"release-notes.txt"` |
| 12 | Then 退出码 1（release-notes.txt）（期望 1） | ✅ | `1` |
| 13 | Then 整行逐字等于「通用任务闭环的产物名不合法：release-notes.v1.md（只写文件名，.md 结尾，不带目录与版本号）」（期望 "通用任务闭环的产物名不合法：release-notes.v1.md（只写文件名，.md 结尾，不带目录与版本号）"） | ✅ | `"通用任务闭环的产物名不合法：release-notes.v1.md（只写文件名，.md 结尾，不带目录与版本号）"` |
| 14 | Then 冒号与「（」之间的内容逐字等于 "release-notes.v1.md"（期望 "release-notes.v1.md"） | ✅ | `"release-notes.v1.md"` |
| 15 | Then 退出码 1（release-notes.v1.md）（期望 1） | ✅ | `1` |
| 16 | And 机检：五次之后 .orch/instances 仍为空（期望 "（空）"） | ✅ | `"（空）"` |

**⑤ 判定**：通过

---

#### AC-24 未知模板仍被拒绝

- 判定：**通过**（核对 3/3 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-24`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch run --template taskloop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写发布说明。产物：release-notes.md --template taskloop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-24 | exit=1 | 226ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-24 | exit=0 | 216ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-24.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根 <根绝对路径>
When 我执行 orch run --template taskloop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"
Then 输出含"未知模板：taskloop"，退出码 1
And 机检：`.orch/instances` 为空
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-24.state.json` | 5 B |
| `docs/iterations/iteration-3/evidence/AC-24.events.jsonl` | 0 B |
| `docs/iterations/iteration-3/evidence/AC-24.meta.json` | 578 B |
| `docs/iterations/iteration-3/evidence/AC-24.output.json` | 1773 B |
| `docs/iterations/iteration-3/evidence/AC-24.status.txt` | 651 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 输出含「未知模板：taskloop」（期望含 "未知模板：taskloop"） | ✅ | `未知模板：taskloop` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | And 机检：.orch/instances 为空（期望 "（空）"） | ✅ | `"（空）"` |

**⑤ 判定**：通过

---

#### AC-25 同一目录不能同时跑两个通用任务闭环

- 判定：**通过**（核对 7/7 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-25`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run --template task-loop --cwd ./demo-doc --task "…产物：second.md"（同目录第二次发起）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写第二篇发布说明。产物：second.md --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-25 | exit=1 | 98ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-25 | exit=0 | 95ms
[driver --scenario doc-hold-research --keep 输出（长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-25 --scenario doc-hold-research --keep   | cwd=D:\WWW\Maestro | exit=13 | 1418ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-25 | exit=0 | 98ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-25.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-hold-research --keep 让 INST-001 在 demo-doc 目录运行
When 我在项目根发起第二个 task-loop（--task "…产物：second.md"），--cwd 仍指向 demo-doc
Then 输出含"该目录已有未结束的实例 INST-001，本次未发起"，退出码 1
And 机检：`.orch/instances` 仍只有 INST-001
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-25.state.json` | 3301 B |
| `docs/iterations/iteration-3/evidence/AC-25.events.jsonl` | 2152 B |
| `docs/iterations/iteration-3/evidence/AC-25.meta.json` | 701 B |
| `docs/iterations/iteration-3/evidence/AC-25.output.json` | 4431 B |
| `docs/iterations/iteration-3/evidence/AC-25.status.txt` | 1941 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：INST-001 已停在 T-001 的 prompt 前（.mock/paused 出现） | ✅ | `760ms` |
| 2 | Given 机检：实例 state=running（期望 "running"） | ✅ | `"running"` |
| 3 | Given 机检：T-001 state=running（期望 "running"） | ✅ | `"running"` |
| 4 | Then 输出含「该目录已有未结束的实例 INST-001，本次未发起」（期望含 "该目录已有未结束的实例 INST-001，本次未发起"） | ✅ | `该目录已有未结束的实例 INST-001，本次未发起` |
| 5 | Then 退出码 1（期望 1） | ✅ | `1` |
| 6 | And 机检：.orch/instances 仍只有 INST-001（期望 "INST-001"） | ✅ | `"INST-001"` |
| 7 | 佐证：第一个实例仍在运行（期望含 "实例 INST-001 · 运行中"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环` |

**⑤ 判定**：通过

---

#### AC-26 编码闭环与通用任务闭环同目录互斥

- 判定：**通过**（核对 9/9 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch run --template code-loop --cwd ./demo-doc --task "…产物：calc.js"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写一个计算器。产物：calc.js --template code-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26 | exit=1 | 98ms
[driver --scenario doc-hold-research --keep（方向一，长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26 --scenario doc-hold-research --keep   | cwd=D:\WWW\Maestro | exit=13 | 1188ms
[orch core stop（方向一）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26 | exit=0 | 91ms
[orch run --template task-loop --cwd ./demo-doc --task "…产物：release-notes.md"（code-loop 占目录时）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-doc --task 写一篇发布说明。产物：release-notes.md --template task-loop --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26-b | exit=1 | 102ms
[orch core stop（方向二）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26-b | exit=0 | 177ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-26.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-hold-research --keep 让 INST-001 在 demo-doc 目录运行
When 我用同一目录发起 code-loop（--cwd ./demo-doc --task "…产物：calc.js"）
Then 输出含"该目录已有未结束的实例 INST-001，本次未发起"，退出码 1
And 机检：没有生成第二个实例
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-26.state.json` | 6723 B |
| `docs/iterations/iteration-3/evidence/AC-26.events.jsonl` | 4952 B |
| `docs/iterations/iteration-3/evidence/AC-26.meta.json` | 1250 B |
| `docs/iterations/iteration-3/evidence/AC-26.output.json` | 5582 B |
| `docs/iterations/iteration-3/evidence/AC-26.status.txt` | 2178 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given（方向一）：task-loop 的 INST-001 已停在 T-001 prompt 前 | ✅ | `646ms` |
| 2 | Then（方向一）输出含「该目录已有未结束的实例 INST-001，本次未发起」（期望含 "该目录已有未结束的实例 INST-001，本次未发起"） | ✅ | `该目录已有未结束的实例 INST-001，本次未发起` |
| 3 | Then（方向一）退出码 1（期望 1） | ✅ | `1` |
| 4 | And（方向一）机检：没有生成第二个实例（期望 "INST-001"） | ✅ | `"INST-001"` |
| 5 | Given（方向二）：code-loop 的 INST-001 在 demo-doc 目录运行 | ✅ | `state=running cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26-b\demo-doc 期望 C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-26-b\demo-doc` |
| 6 | Given（方向二）机检：实例号是 INST-001（期望 "INST-001"） | ✅ | `"INST-001"` |
| 7 | Then（方向二）输出含「该目录已有未结束的实例 INST-001，本次未发起」（期望含 "该目录已有未结束的实例 INST-001，本次未发起"） | ✅ | `该目录已有未结束的实例 INST-001，本次未发起` |
| 8 | Then（方向二）退出码 1（期望 1） | ✅ | `1` |
| 9 | And（方向二）机检：没有生成第二个实例（期望 "INST-001"） | ✅ | `"INST-001"` |

**⑤ 判定**：通过

**备注**

- 补充观测（不计入本 AC 判据）：若占用方停在**第 1 次派发**（code-loop `hold-forever` 在 session/new 内暂停），同目录的第二次 `orch run` 会排在 `@dir` 锁上直到 60s 握手超时，输出「未知错误：IPC_TIMEOUT」而不是 DIR_BUSY。复现已写入 probe/acc3-f-blockers.md。

---

#### AC-27 已挂起实例不能再次发起

- 判定：**通过**（核对 7/7 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-27`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-reject-twice（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-27 --scenario doc-reject-twice   | cwd=D:\WWW\Maestro | exit=4 | 2240ms
[orch run --instance INST-001 --template task-loop --cwd <该实例的项目根> --task "重写发布说明。产物：release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-27\demo-doc --task 重写发布说明。产物：release-notes.md --template task-loop --host dsh --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-27 | exit=1 | 224ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-27 | exit=0 | 185ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-27.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-reject-twice 已跑完，INST-001 已挂起
When 我执行 orch run --instance INST-001 --template task-loop --cwd <该实例的项目根> --task "重写发布说明。产物：release-notes.md"
Then 输出含"该实例已挂起，不能再次发起；如要重来请新建实例"，退出码 1
And 机检：INST-001 仍是 suspended，escalations 数量不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-27.state.json` | 10995 B |
| `docs/iterations/iteration-3/evidence/AC-27.events.jsonl` | 15293 B |
| `docs/iterations/iteration-3/evidence/AC-27.meta.json` | 681 B |
| `docs/iterations/iteration-3/evidence/AC-27.output.json` | 4048 B |
| `docs/iterations/iteration-3/evidence/AC-27.status.txt` | 1880 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：夹具跑完退出码 4（挂起）（期望 4） | ✅ | `4` |
| 2 | Given 机检：INST-001 已挂起（期望 "suspended"） | ✅ | `"suspended"` |
| 3 | Given 机检：T-003 已升级（前置） | ✅ | `escalated` |
| 4 | Then 输出含「该实例已挂起，不能再次发起；如要重来请新建实例」（期望含 "该实例已挂起，不能再次发起；如要重来请新建实例"） | ✅ | `该实例已挂起，不能再次发起；如要重来请新建实例` |
| 5 | Then 退出码 1（期望 1） | ✅ | `1` |
| 6 | And 机检：INST-001 仍是 suspended（期望 "suspended"） | ✅ | `"suspended"` |
| 7 | And 机检：escalations 数量不变（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-28 运行中取消 5 秒内收敛

- 判定：**通过**（核对 15/15 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-28`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-28 | exit=0 | 123ms
[orch status --instance INST-001（取消后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-28 | exit=0 | 97ms
[driver --scenario doc-slow-reviewer --keep（长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-28 --scenario doc-slow-reviewer --keep   | cwd=D:\WWW\Maestro | exit=1 | 1915ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-28 | exit=0 | 103ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-28.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-slow-reviewer --keep 让撰写者完成、审核者正在执行
And 机检：HO-002 的 state='accepted'（审核者已接手）
When 我执行 orch cancel --instance INST-001
Then 命令在 5 秒内结束，退出码 0
And 机检：实例 state='cancelled'
And 机检：T-001/T-002 state='done'，T-003 state='cancelled'
And 机检：所有 state 为 created/delivered/accepted 的 handoff 都变 'rejected'，rejectReason='withdrawn'
And 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-28.state.before-cancel.json` | 6466 B |
| `docs/iterations/iteration-3/evidence/AC-28.state.json` | 6509 B |
| `docs/iterations/iteration-3/evidence/AC-28.events.jsonl` | 7229 B |
| `docs/iterations/iteration-3/evidence/AC-28.meta.json` | 824 B |
| `docs/iterations/iteration-3/evidence/AC-28.output.json` | 6942 B |
| `docs/iterations/iteration-3/evidence/AC-28.status.txt` | 3252 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 机检：HO-002 的 state='accepted'（审核者已接手） | ✅ | `accepted` |
| 2 | Given 机检：T-001/T-002 已完成 | ✅ | `done/done` |
| 3 | Given 机检：T-003 正在执行 | ✅ | `running` |
| 4 | Given：现场已就位（等待到 HO-002 accepted） | ✅ | `1291ms` |
| 5 | Then 命令在 5 秒内结束（实测 123ms） | ✅ | `123ms` |
| 6 | Then 退出码 0（期望 0） | ✅ | `0` |
| 7 | Then 输出含「节点 T-003 审核者 已取消」（期望含 "节点 T-003 审核者 已取消"） | ✅ | `节点 T-003 审核者 已取消` |
| 8 | 机检：实例 state='cancelled'（期望 "cancelled"） | ✅ | `"cancelled"` |
| 9 | 机检：T-001/T-002 state='done'（期望 "done/done"） | ✅ | `"done/done"` |
| 10 | 机检：T-003 state='cancelled'（期望 "cancelled"） | ✅ | `"cancelled"` |
| 11 | 机检：取消后没有 handoff 停在 created/delivered/accepted（期望 "（无）"） | ✅ | `"（无）"` |
| 12 | 机检：取消前未结束的 handoff 都变 rejected 且 rejectReason=withdrawn | ✅ | `HO-002:rejected/withdrawn` |
| 13 | 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency（期望 "（无）"） | ✅ | `"（无）"` |
| 14 | 佐证：events 里有 run.cancelled 迁移 | ✅ | `sessionmock-sess-13248-1,nodeT-003,instanceINST-001` |
| 15 | 佐证：status 显示实例已取消（期望含 "实例 INST-001 · 已取消"） | ✅ | `实例 INST-001 · 已取消 · 模板 通用任务闭环` |

**⑤ 判定**：通过

**备注**

- 取消前处于 created/delivered/accepted 的交接包：HO-002:accepted
- orch cancel 实测耗时：123ms（硬指标 5000ms）

---

#### AC-29 已升级节点也能被取消

- 判定：**通过**（核对 10/10 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-29`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-reject-twice（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-29 --scenario doc-reject-twice   | cwd=D:\WWW\Maestro | exit=4 | 2223ms
[orch cancel --instance INST-001（已升级实例）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-29 | exit=0 | 236ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-29 | exit=0 | 204ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-29.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-reject-twice 已跑完，T-003 已升级、实例已挂起
When 我执行 orch cancel --instance INST-001
Then 退出码是 0
And 机检：实例 state='cancelled'
And 机检：T-003 state='cancelled'（不是 'escalated'）
And 机检：escalations[0].state='voided'
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-29.state.json` | 11008 B |
| `docs/iterations/iteration-3/evidence/AC-29.events.jsonl` | 16133 B |
| `docs/iterations/iteration-3/evidence/AC-29.meta.json` | 679 B |
| `docs/iterations/iteration-3/evidence/AC-29.output.json` | 4392 B |
| `docs/iterations/iteration-3/evidence/AC-29.status.txt` | 1877 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：夹具跑完退出码 4（期望 4） | ✅ | `4` |
| 2 | Given 机检：实例已挂起（期望 "suspended"） | ✅ | `"suspended"` |
| 3 | Given 机检：T-003 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 4 | Given 机检：escalations[0].state=pending（期望 "pending"） | ✅ | `"pending"` |
| 5 | Then 退出码 0（期望 0） | ✅ | `0` |
| 6 | 佐证：取消输出含「节点 T-003 审核者 已取消」（期望含 "节点 T-003 审核者 已取消"） | ✅ | `节点 T-003 审核者 已取消` |
| 7 | 机检：实例 state='cancelled'（期望 "cancelled"） | ✅ | `"cancelled"` |
| 8 | 机检：T-003 state='cancelled'（不是 'escalated'）（期望 "cancelled"） | ✅ | `"cancelled"` |
| 9 | 机检：escalations[0].state='voided'（期望 "voided"） | ✅ | `"voided"` |
| 10 | 机检：escalations[0].voidedAt 非空 | ✅ | `2026-11-06T13:24:59.311Z` |

**⑤ 判定**：通过

---

#### AC-30 升级写不进去时不假装挂起

- 判定：**通过**（核对 15/15 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-30`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario review-missing --prepare-only（备现场）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-30 --scenario review-missing --prepare-only   | cwd=D:\WWW\Maestro | exit=0 | 127ms
[orch core stop（确认核心已停）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-30 | exit=0 | 94ms
[driver --scenario review-missing --keep（MAESTRO_FAULT=state_write:escalation）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-30 --scenario review-missing --keep   | cwd=D:\WWW\Maestro | exit=5 | 1946ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-30 | exit=0 | 91ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-30.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根 <根绝对路径>，我先执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario review-missing --prepare-only（已写好 `.mock` 与 host 配置），且核心已停
When 我在 Git Bash 下执行 MAESTRO_FAULT=state_write:escalation node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario review-missing --keep
Then 命令在 10 秒内结束，退出码是 5
And 输出含"无法记录升级："与"；已停止推进"
And 输出含"运行中 · 已停止推进"，不含"已挂起"
And 输出含"节点 T-003 审核者 待校验（升级未记录） · 第 1 轮"
And 输出不含以"交接包 HO-"开头的行
And 机检：state='running'，halted=true，escalations 为空
And 机检：T-003 state='review'（不是 'failed'，也不是 'escalated'）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-30.state.halted.json` | 6492 B |
| `docs/iterations/iteration-3/evidence/AC-30.state.after-stop.json` | 6556 B |
| `docs/iterations/iteration-3/evidence/AC-30.state.json` | 6556 B |
| `docs/iterations/iteration-3/evidence/AC-30.events.jsonl` | 7842 B |
| `docs/iterations/iteration-3/evidence/AC-30.meta.json` | 1349 B |
| `docs/iterations/iteration-3/evidence/AC-30.output.json` | 7285 B |
| `docs/iterations/iteration-3/evidence/AC-30.status.txt` | 2528 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：--prepare-only 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 命令在 10 秒内结束（实测 1606ms） | ✅ | `1606ms` |
| 3 | Then 退出码 5（期望 5） | ✅ | `5` |
| 4 | Then 输出含「无法记录升级：」（期望含 "无法记录升级："） | ✅ | `无法记录升级：state_write:escalation；已停止推进` |
| 5 | Then 输出含「；已停止推进」（期望含 "；已停止推进"） | ✅ | `无法记录升级：state_write:escalation；已停止推进` |
| 6 | Then 输出含「运行中 · 已停止推进」（期望含 "运行中 · 已停止推进"） | ✅ | `实例 INST-001 · 运行中 · 已停止推进 · 模板 通用任务闭环` |
| 7 | Then 输出不含「已挂起」（期望不含 "已挂起"） | ✅ | `实例 INST-001 · 运行中 · 模板 通用任务闭环<br>会话已创建 mock-sess-2400-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 执行中 · 已运行 1s<br>会话 空闲<br>无法记录升级：state_write:escalation；已停止推进<br>实例 INST-001 · 运行中 · 已停止推进 · 模板 通用任务闭环<br>节点 T-003` |
| 8 | Then 输出含「节点 T-003 审核者 待校验（升级未记录） · 第 1 轮」（期望含 "节点 T-003 审核者 待校验（升级未记录） · 第 1 轮"） | ✅ | `节点 T-003 审核者 待校验（升级未记录） · 第 1 轮` |
| 9 | Then 输出不含以「交接包 HO-」开头的行（期望 "（无）"） | ✅ | `"（无）"` |
| 10 | And 机检：halt 瞬间 state='running'（期望 "running"） | ✅ | `"running"` |
| 11 | And 机检：halted=true（期望 true） | ✅ | `true` |
| 12 | And 机检：escalations 为空（期望 0） | ✅ | `0` |
| 13 | And 机检：T-003 state='review'（不是 failed，也不是 escalated）（期望 "review"） | ✅ | `"review"` |
| 14 | And 机检：haltCause=state_write:escalation（期望 "state_write:escalation"） | ✅ | `"state_write:escalation"` |
| 15 | 佐证：工作区存在（场景确实推进过） | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-30/.orch/instances/INST-001` |

**⑤ 判定**：通过

**备注**

- halt 落盘距启动 1335ms；driver 进程总耗时 1606ms
- 终态 state.json 的实例状态是 `interrupted`：driver 退出前会执行 `orch core stop`，核心停止会把非终态实例对账成 interrupted（src/daemon/server.js:369 → orchestrator.interruptAll），因此 requirement 要求的 running+halted 只能从 halt 落盘瞬间取证（见 evidence 的 state.halted.json）。
- halt 时 state.handoffs=HO-001:consumed,HO-002:accepted；审核节点在 consume 之前就升级失败，故 HO-002 停在 accepted；`renderRunTail` 的停止推进分支不打印交接包行，所以输出里没有「交接包 HO-」行。

---

#### AC-31 审核无效时不留下回流包、不再派发

- 判定：**通过**（核对 10/10 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-31`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario review-missing（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-31 --scenario review-missing   | cwd=D:\WWW\Maestro | exit=4 | 1577ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-31 | exit=0 | 86ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-31.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-missing 已完整跑完
Then 机检：counters.dispatchCount=3
And 机检：events 中没有 reason='backflow.constructed'
And 机检：handoffs 中没有 edge.kind='backflow'
And 机检：T-002 state='done'，T-003 state='escalated'
And 机检：T-003 对应的会话 state='escalated'
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-31.state.json` | 6809 B |
| `docs/iterations/iteration-3/evidence/AC-31.events.jsonl` | 8206 B |
| `docs/iterations/iteration-3/evidence/AC-31.meta.json` | 697 B |
| `docs/iterations/iteration-3/evidence/AC-31.output.json` | 3350 B |
| `docs/iterations/iteration-3/evidence/AC-31.status.txt` | 1104 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：夹具跑完退出码 4（升级挂起）（期望 4） | ✅ | `4` |
| 2 | 机检：counters.dispatchCount=3（期望 3） | ✅ | `3` |
| 3 | 机检：events 中没有 reason='backflow.constructed'（期望 0） | ✅ | `0` |
| 4 | 机检：handoffs 中没有 edge.kind='backflow'（期望 0） | ✅ | `0` |
| 5 | 机检：handoffs 恰好 2 条（HO-001、HO-002）（期望 "HO-001,HO-002"） | ✅ | `"HO-001,HO-002"` |
| 6 | 机检：T-002 state='done'（期望 "done"） | ✅ | `"done"` |
| 7 | 机检：T-003 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 8 | 机检：T-003 对应的会话 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 9 | 机检：T-003 升级后没有被再次派发（round 仍为 1） | ✅ | `1` |
| 10 | 机检：实例已挂起（不是 failed）（期望 "suspended"） | ✅ | `"suspended"` |

**⑤ 判定**：通过

---

#### AC-32 审核以文件为准，不以对话为准

- 判定：**通过**（核对 11/11 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-32`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-32-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario review-says-pass --keep --stop-after 4] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-32 --scenario review-says-pass --keep --stop-after 4   | cwd=D:\WWW\Maestro | exit=13 | 2220ms
[orch core stop（A）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-32 | exit=0 | 98ms
[driver --scenario review-says-reject（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-32-b --scenario review-says-reject   | cwd=D:\WWW\Maestro | exit=0 | 1587ms
[orch core stop（B）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-32-b | exit=0 | 85ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-32.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 review-says-pass 已用 --stop-after 4 --keep 停在"回流已投递、T-002 第 2 轮已核对通过"（审核者的消息说"全部通过"，但 out/review.json 写的是 reject）
And 机检：`.mock/stopped-after-4` 存在
When 我查状态
Then 机检：T-003 第 1 轮留下 review.decision='reject'，并发生回流（存在 edge.kind='backflow'）
Given 另起全新根，夹具场景 review-says-reject 的消息说"不通过"，但文件写的是 pass
Then 机检：T-003 review.decision='pass'，实例 state='completed'
And 机检：没有 edge.kind='backflow' 的交接包
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-32.state.stopped-after-4.json` | 9163 B |
| `docs/iterations/iteration-3/evidence/AC-32.state.json` | 20173 B |
| `docs/iterations/iteration-3/evidence/AC-32.events.jsonl` | 23970 B |
| `docs/iterations/iteration-3/evidence/AC-32.meta.json` | 1057 B |
| `docs/iterations/iteration-3/evidence/AC-32.output.json` | 5857 B |
| `docs/iterations/iteration-3/evidence/AC-32.status.txt` | 2936 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 机检：`.mock/stopped-after-4` 存在 | ✅ | `1736ms` |
| 2 | Given 机检：停在 4 次派发之后（期望 4） | ✅ | `4` |
| 3 | Given 机检：T-002 已进入第 2 轮（回流已投递）（期望 2） | ✅ | `2` |
| 4 | Then 机检：T-003 第 1 轮 review.decision='reject'（期望 "reject"） | ✅ | `"reject"` |
| 5 | Then 机检：存在 edge.kind='backflow' 的交接包 | ✅ | `HO-003:consumed` |
| 6 | Then 机检：events 里有 backflow.constructed（文件 reject 生效）（期望 1） | ✅ | `1` |
| 7 | Given（B）前置：夹具跑完退出码 0（期望 0） | ✅ | `0` |
| 8 | Then（B）机检：T-003 review.decision='pass'（期望 "pass"） | ✅ | `"pass"` |
| 9 | Then（B）机检：实例 state='completed'（期望 "completed"） | ✅ | `"completed"` |
| 10 | And（B）机检：没有 edge.kind='backflow' 的交接包（期望 0） | ✅ | `0` |
| 11 | 佐证（B）：handoffs 只有 2 条（无回流）（期望 2） | ✅ | `2` |

**⑤ 判定**：通过

**备注**

- 对话消息是「全部通过」但核心按 out/review.json 的 reject 走；不放行到底（步骤耗尽会变 dispatch_failed）。

---

#### AC-33 每次派发对应一张交接包，编号连续

- 判定：**通过**（核对 11/11 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-33`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-backflow-once（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-33 --scenario doc-backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 2234ms
[orch status --instance INST-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-33 | exit=0 | 236ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-33 | exit=0 | 185ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-33.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：handoffs 恰好 4 条，handoffId 依次是 HO-001、HO-002、HO-003、HO-004
And 机检：edge.kind 依次是 forward、forward、backflow、retest
And 机检：四条 state 都是 'consumed'，createdAt/consumedAt 都非空
And 机检：counters.dispatchCount=5（首派没有前置交接包）
And orch status --instance INST-001 --events 里的 [#序号] 严格递增、不跳号
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-33.state.json` | 10129 B |
| `docs/iterations/iteration-3/evidence/AC-33.events.jsonl` | 14825 B |
| `docs/iterations/iteration-3/evidence/AC-33.meta.json` | 697 B |
| `docs/iterations/iteration-3/evidence/AC-33.output.json` | 12379 B |
| `docs/iterations/iteration-3/evidence/AC-33.status.txt` | 9308 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：夹具跑完退出码 0（期望 0） | ✅ | `0` |
| 2 | 机检：handoffs 恰好 4 条（期望 4） | ✅ | `4` |
| 3 | 机检：handoffId 依次是 HO-001、HO-002、HO-003、HO-004（期望 "HO-001,HO-002,HO-003,HO-004"） | ✅ | `"HO-001,HO-002,HO-003,HO-004"` |
| 4 | 机检：edge.kind 依次是 forward、forward、backflow、retest（期望 "forward,forward,backflow,retest"） | ✅ | `"forward,forward,backflow,retest"` |
| 5 | 机检：四条 state 都是 'consumed'（期望 "consumed,consumed,consumed,consumed"） | ✅ | `"consumed,consumed,consumed,consumed"` |
| 6 | 机检：四条 createdAt 都非空 | ✅ | `2026-11-06T14:05:15.813Z,2026-11-06T14:05:16.103Z,2026-11-06T14:05:16.426Z,2026-11-06T14:05:16.728Z` |
| 7 | 机检：四条 consumedAt 都非空 | ✅ | `2026-11-06T14:05:16.086Z,2026-11-06T14:05:16.390Z,2026-11-06T14:05:16.706Z,2026-11-06T14:05:17.019Z` |
| 8 | 机检：counters.dispatchCount=5（首派没有前置交接包）（期望 5） | ✅ | `5` |
| 9 | And 机检：[#序号] 严格递增（共 63 条） | ✅ | `1,2,3,4,5,6,7,8…61,62,63` |
| 10 | And 机检：[#序号] 不跳号（从 #1 连续递增） | ✅ | `首 1 / 尾 63 / 条数 63` |
| 11 | 佐证：events.jsonl 的事件条数与 [#] 行数一致（期望 63） | ✅ | `63` |

**⑤ 判定**：通过

---

#### AC-34 交接包 accepted 与 consumed 的时机

- 判定：**通过**（核对 8/8 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-34`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-backflow-once（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-34 --scenario doc-backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 2387ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-34 | exit=0 | 82ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-34.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：每张 handoff 的 acceptedAt 都晚于或等于 deliveredAt（同一毫秒允许；不允许早于）
And 机检：acceptedSignal 是 turn 内事件名，不是 usage/available_commands 噪声
And 机检：每张 handoff 的 consumedAt 都晚于或等于**消费它的那一轮**的 `node.dispatch` 事件 ts（逐轮配对，不从终态 `state.json` 取 `roundStartedAt`——它会被后续轮次的派发重置，见下方说明）
And 机检：没有 handoff 停在 created/delivered/accepted
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-34.state.json` | 10129 B |
| `docs/iterations/iteration-3/evidence/AC-34.events.jsonl` | 14825 B |
| `docs/iterations/iteration-3/evidence/AC-34.meta.json` | 689 B |
| `docs/iterations/iteration-3/evidence/AC-34.output.json` | 4777 B |
| `docs/iterations/iteration-3/evidence/AC-34.status.txt` | 2412 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：夹具跑完退出码 0（期望 0） | ✅ | `0` |
| 2 | 前置：4 张交接包（期望 4） | ✅ | `4` |
| 3 | 前置：5 次派发（首派无前置交接包）（期望 5） | ✅ | `5` |
| 4 | 机检：每张 handoff 的 acceptedAt 都晚于或等于 deliveredAt（同一毫秒允许，不允许早于） | ✅ | `HO-001:6ms HO-002:7ms HO-003:5ms HO-004:7ms` |
| 5 | 机检：acceptedSignal 都是 turn 内事件名（不是 usage/available_commands 噪声） | ✅ | `agent_thought_chunk,agent_thought_chunk,agent_thought_chunk,agent_thought_chunk` |
| 6 | 机检：acceptedSignal 具体取值逐一核对 | ✅ | `HO-001=agent_thought_chunk HO-002=agent_thought_chunk HO-003=agent_thought_chunk HO-004=agent_thought_chunk` |
| 7 | 机检：每张 handoff 的 consumedAt 都不早于消费它那一轮的 node.dispatch ts（逐轮配对） | ✅ | `HO-001↔#10 T-002r1 consumed-ts:288ms \| HO-002↔#22 T-003r1 consumed-ts:300ms \| HO-003↔#38 T-002r2 consumed-ts:271ms \| HO-004↔#49 T-003r2 consumed-ts:291ms` |
| 8 | 机检：没有 handoff 停在 created/delivered/accepted（期望 "（无）"） | ✅ | `"（无）"` |

**⑤ 判定**：通过

---

#### AC-35 阶段耗时区间不重叠，等待下游不计入上游耗时

- 判定：**通过**（核对 20/20 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-35`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-backflow-once（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-35 --scenario doc-backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 2158ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-35 | exit=0 | 208ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-35 | exit=0 | 202ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-35.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：T-001 的 `review.evidence_verified` 事件 ts ≤ T-002 第 1 轮 `node.dispatch` 事件 ts
And 机检：T-002 第 1 轮 `review.evidence_verified` 事件 ts ≤ T-003 第 1 轮 `node.dispatch` 事件 ts
And 机检：T-003 第 1 轮的 `review.read` 事件 ts ≤ T-002 第 2 轮 `node.dispatch` 事件 ts
And 机检：T-002 第 2 轮 `review.evidence_verified` 事件 ts ≤ T-003 第 2 轮 `node.dispatch` 事件 ts
And 机检：T-001 第 1 轮的 `roundStartedAt` ≥ `run.started` 事件 ts（它由 `run.started` 直接派发，上游没有产物核对事件）；T-002 第 1 轮的 `roundStartedAt` ≥ T-001 的 `review.evidence_verified` 事件 ts（同一时刻允许）
And 机检：T-002 第 2 轮的上游是 T-003（`downstreamGate:false`，**不产生** `review.evidence_verified`），改为 `roundStartedAt` ≥ T-003 第 1 轮 `review.rejected`（`result='note'`）事件 ts（同一时刻允许）
And 机检：T-002 的 `startedAt` = 第 1 轮 `node.dispatch` 事件 ts、`endedAt` = 第 2 轮完成时刻（**跨轮累计**，第 2 轮派发不重置 `startedAt`，`src/core/orchestrator.js:980`）
And 机检：终态 `orch status` 的 T-001 行耗时 ≈ `T-001.endedAt - T-001.startedAt`，且 T-001 的 `endedAt` ≤ HO-001 的 `accepted` 事件 ts（**核对通过即定格，等下游的那段不计入**）
And 机检：`node`→`done`、reason=`review.downstream_accepted` 的事件共 3 条（T-001 一次、T-002 两轮各一次）；T-003 的 `done` 事件 reason 是 `verification.passed`，不在这 3 条里
And 节点行不含"耗时 0s"
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-35.state.json` | 10127 B |
| `docs/iterations/iteration-3/evidence/AC-35.events.jsonl` | 14821 B |
| `docs/iterations/iteration-3/evidence/AC-35.meta.json` | 1404 B |
| `docs/iterations/iteration-3/evidence/AC-35.output.json` | 10013 B |
| `docs/iterations/iteration-3/evidence/AC-35.status.txt` | 4133 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：夹具跑完退出码 0（期望 0） | ✅ | `0` |
| 2 | 前置：5 次 node.dispatch（T-001/T-002r1/T-003r1/T-002r2/T-003r2）（期望 "T-001r1,T-002r1,T-003r1,T-002r2,T-003r2"） | ✅ | `"T-001r1,T-002r1,T-003r1,T-002r2,T-003r2"` |
| 3 | 机检：T-001 的 review.evidence_verified ts ≤ T-002 第 1 轮 node.dispatch ts | ✅ | `#8 2026-11-06T14:04:30.634Z ≤ #10 2026-11-06T14:04:30.661Z` |
| 4 | 机检：T-002 第 1 轮 review.evidence_verified ts ≤ T-003 第 1 轮 node.dispatch ts | ✅ | `#19 2026-11-06T14:04:30.926Z ≤ #22 2026-11-06T14:04:30.959Z` |
| 5 | 机检：T-003 第 1 轮 review.read ts ≤ T-002 第 2 轮 node.dispatch ts | ✅ | `#31 2026-11-06T14:04:31.227Z ≤ #38 2026-11-06T14:04:31.277Z` |
| 6 | 机检：T-002 第 2 轮 review.evidence_verified ts ≤ T-003 第 2 轮 node.dispatch ts | ✅ | `#46 2026-11-06T14:04:31.539Z ≤ #49 2026-11-06T14:04:31.567Z` |
| 7 | 机检：T-001 第 1 轮 roundStartedAt ≥ run.started 事件 ts | ✅ | `2026-11-06T14:04:30.357Z ≥ 2026-11-06T14:04:30.354Z` |
| 8 | 机检：T-002 第 1 轮起点（= startedAt，第 2 轮不重置）≥ T-001 的 review.evidence_verified 事件 ts（同一时刻允许） | ✅ | `2026-11-06T14:04:30.661Z ≥ 2026-11-06T14:04:30.634Z` |
| 9 | 机检：T-002 第 2 轮 node.dispatch ts ≥ T-003 第 1 轮 review.rejected（result=note）事件 ts（同轮起点，同一时刻允许） | ✅ | `2026-11-06T14:04:31.277Z ≥ 2026-11-06T14:04:31.235Z（result=note）` |
| 10 | 机检：T-002 的 startedAt = 第 1 轮 node.dispatch 事件 ts（逐字等式） | ✅ | `startedAt=2026-11-06T14:04:30.661Z vs dispatch=2026-11-06T14:04:30.661Z（差 0ms）` |
| 11 | 机检：T-002 的 startedAt 指向第 1 轮、没有被第 2 轮重置（语义） | ✅ | `2026-11-06T14:04:30.661Z < 2026-11-06T14:04:31.277Z` |
| 12 | 机检：T-002 的 endedAt = 第 2 轮完成时刻（= 第 2 轮 review.evidence_verified 事件 ts） | ✅ | `endedAt=2026-11-06T14:04:31.539Z vs evidence=2026-11-06T14:04:31.539Z` |
| 13 | 机检：终态 orch status 的 T-001 行耗时 ≈ T-001.endedAt - T-001.startedAt（277ms → 1s） | ✅ | `行=节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md / 解析=1s` |
| 14 | 机检：T-001 的 endedAt ≤ HO-001 的 accepted 事件 ts（核对通过即定格，等下游那段不计入） | ✅ | `endedAt=2026-11-06T14:04:30.634Z ≤ accepted=2026-11-06T14:04:30.881Z` |
| 15 | 机检：node→done、reason=review.downstream_accepted 的事件共 3 条（T-001 一次、T-002 两轮各一次）（期望 3） | ✅ | `3` |
| 16 | 机检：这 3 条分别是 T-001×1 / T-002×2（期望 "T-001r1,T-002r1,T-002r2"） | ✅ | `"T-001r1,T-002r1,T-002r2"` |
| 17 | 机检：T-003 的 done 事件 reason 是 verification.passed（不在这 3 条里） | ✅ | `#60 applied/verification.passed` |
| 18 | 机检：节点行不含「耗时 0s」 | ✅ | `节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md \| 节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md \| 节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 1s · 审核 通过` |
| 19 | 佐证：handoffs 4 条（forward/forward/backflow/retest）（期望 "HO-001:forward,HO-002:forward,HO-003:backflow,HO-004:retest"） | ✅ | `"HO-001:forward,HO-002:forward,HO-003:backflow,HO-004:retest"` |
| 20 | 佐证：HO-001 存在且已 accepted | ✅ | `consumed` |

**⑤ 判定**：通过

**备注**

- 第 2 轮与第 3 条的「本轮起点」用 events.jsonl 的 node.dispatch ts（终态 roundStartedAt 已被第 2 轮重置，见 AC-35 需求原文说明）。
- 关于「T-002 的 startedAt = 第 1 轮 node.dispatch 事件 ts」：逐字等式不成立，稳定差 4~8ms（startedAt 在 dispatchInState 开头由 iso() 写死，事件 ts 由 bus 在 saveState 落盘之后生成，src/core/orchestrator.js:1121、:1134-1145）。语义口径（startedAt 取第 1 轮、第 2 轮不重置）成立。该等式是与实现因果顺序冲突的亚 10ms 判据，建议需求改为「startedAt ≤ 第 1 轮 node.dispatch ts」或让 node.dispatch 直接带 startedAt 的 ts。

---

#### AC-36 编码闭环与单节点输出不回归

- 判定：**通过**（核对 66/66 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-a`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-b`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-c`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-d`
- 实例：INST-001、INST-001、INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[node --test "test/**/*.test.js"（I1.2 完整测试集）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test test/**/*.test.js   | cwd=D:\WWW\Maestro | exit=0 | 12955ms
[orch status --instance INST-001（code-loop 定格）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-a | exit=0 | 121ms
[orch run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md"（single）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-b | exit=0 | 620ms
[orch status --instance INST-001（single）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-b | exit=0 | 91ms
[code-loop driver --scenario backflow-once --stop-after 3 --keep（长驻，已停核心回收）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-a --scenario backflow-once --stop-after 3 --keep   | cwd=D:\WWW\Maestro | exit=- | 0ms
[code-loop-driver --scenario code-pass（A-3 成功路径）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-c --scenario code-pass   | cwd=D:\WWW\Maestro | exit=0 | 1364ms
[code-loop-driver --scenario backflow-twice（A-4 挂起收尾）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-d --scenario backflow-twice   | cwd=D:\WWW\Maestro | exit=0 | 1915ms
[orch core stop（AC-36-a）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-a | exit=0 | 90ms
[orch core stop（AC-36-b）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-b | exit=0 | 189ms
[orch core stop（AC-36-c）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-c | exit=0 | 90ms
[orch core stop（AC-36-d）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-36-d | exit=0 | 85ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-36.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 我执行 I1.2 的完整测试集（含 code-loop 夹具与 I1.1 单节点测试）
Then 全部通过
Given 用 code-loop-driver 以 --scenario backflow-once --stop-after 3 --keep 停在"开发第 2 轮完成、复测未派发"
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-002 测试 失败（等待复测） · 第 1 轮"
And 输出不含"待校验（等待下游）"
And `single` 的 `orch run` 与 `orch status` 输出与 I1.1 验收样例逐字一致
And `code-loop` 的 I1.2 附录 A-1 / A-2 / A-3 / A-4 输出样例除 D-9 登记的两处断言（`buildHandoff` 键集合、`REASON_LABEL` 条数）外逐字不变（指 `docs/iterations/iteration-2/requirement.md` 的附录，不是本迭代的同名附录）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-36.state.json` | 21716 B |
| `docs/iterations/iteration-3/evidence/AC-36.events.jsonl` | 33904 B |
| `docs/iterations/iteration-3/evidence/AC-36.meta.json` | 1885 B |
| `docs/iterations/iteration-3/evidence/AC-36.output.json` | 117934 B |
| `docs/iterations/iteration-3/evidence/AC-36.status.txt` | 92080 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 全部通过（退出码 0）（期望 0） | ✅ | `0` |
| 2 | Then 全部通过（fail=0）（期望 0） | ✅ | `0` |
| 3 | Then 全部通过（fail=0，条数不低于 416 基线） | ✅ | `tests=417 pass=417 fail=0` |
| 4 | Given 机检：.mock/stopped-after-3 存在（停在开发第 2 轮完成、复测未派发） | ✅ | `1539ms` |
| 5 | Then 输出含「节点 T-002 测试 失败（等待复测） · 第 1 轮」（期望含 "节点 T-002 测试 失败（等待复测） · 第 1 轮"） | ✅ | `节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条` |
| 6 | Then 输出不含「待校验（等待下游）」（期望不含 "待校验（等待下游）"） | ✅ | `实例 INST-001 · 运行中 · 模板 编码闭环<br>节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s<br>节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条<br>会话 空闲<br>交接包 HO-001  开发→测试  已构造   22:04:50<br>交接包 HO-001  开发→测试  已投递   22:04:50<br>交接包 HO-001  开发→测试  已接受   22:04:50<br>交接包 HO-001  开发→测试  已完成  ` |
| 7 | And code-loop 中间态段序与行数 = I1.2 A-2 样例（13 行） | ✅ | `13 行：实例 INST-001 · 运行中 · 模板 编码闭环 / 节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s / 节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条 …` |
| 8 | And code-loop 第 1 行逐字（实例行）（期望匹配 /^实例 INST-001 · 运行中 · 模板 编码闭环$/） | ✅ | `实例 INST-001 · 运行中 · 模板 编码闭环` |
| 9 | And code-loop 第 2 行逐字（T-001 节点行）（期望匹配 /^节点 T-001 开发 已完成 · 第 2 轮 · 耗时 \S+$/） | ✅ | `节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s` |
| 10 | And code-loop 第 3 行逐字（T-002 节点行）（期望匹配 /^节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条$/） | ✅ | `节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条` |
| 11 | And code-loop 第 4 行逐字（会话行）（期望匹配 /^会话 空闲$/） | ✅ | `会话 空闲` |
| 12 | And code-loop 第 5 行逐字（HO-001 已构造）（期望匹配 /^交接包 HO-001 {2}开发→测试 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  开发→测试  已构造   22:04:50` |
| 13 | And code-loop 第 6 行逐字（HO-001 已投递）（期望匹配 /^交接包 HO-001 {2}开发→测试 {2}已投递 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  开发→测试  已投递   22:04:50` |
| 14 | And code-loop 第 7 行逐字（HO-001 已接受）（期望匹配 /^交接包 HO-001 {2}开发→测试 {2}已接受 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  开发→测试  已接受   22:04:50` |
| 15 | And code-loop 第 8 行逐字（HO-001 已完成）（期望匹配 /^交接包 HO-001 {2}开发→测试 {2}已完成 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  开发→测试  已完成   22:04:50` |
| 16 | And code-loop 第 9 行逐字（HO-002 已构造）（期望匹配 /^交接包 HO-002 {2}测试→开发（回流） {2}已构造 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-002  测试→开发（回流）  已构造   22:04:50` |
| 17 | And code-loop 第 10 行逐字（HO-002 已投递）（期望匹配 /^交接包 HO-002 {2}测试→开发（回流） {2}已投递 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-002  测试→开发（回流）  已投递   22:04:50` |
| 18 | And code-loop 第 11 行逐字（HO-002 已接受）（期望匹配 /^交接包 HO-002 {2}测试→开发（回流） {2}已接受 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-002  测试→开发（回流）  已接受   22:04:50` |
| 19 | And code-loop 第 12 行逐字（HO-002 已完成）（期望匹配 /^交接包 HO-002 {2}测试→开发（回流） {2}已完成 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-002  测试→开发（回流）  已完成   22:04:51` |
| 20 | And code-loop 第 13 行逐字（升级块）（期望匹配 /^升级 —$/） | ✅ | `升级 —` |
| 21 | Then single 的 orch run 退出码 0（期望 0） | ✅ | `0` |
| 22 | And single run 第 1 行「实例 INST-001 · 运行中」（仅开头一次，无模板）（期望匹配 /^实例 INST-001 · 运行中$/） | ✅ | `实例 INST-001 · 运行中` |
| 23 | And single run 第 2 行「会话已创建 <id>」（期望匹配 /^会话已创建 \S+$/） | ✅ | `会话已创建 mock-sess-31084-1` |
| 24 | And single run 第 3 行「任务已投递」（期望 "任务已投递"） | ✅ | `"任务已投递"` |
| 25 | And single run 有节点行（A-1 第 6 段） | ✅ | `节点行在第 7 行` |
| 26 | And single run 中段全是会话行（A-1 第 4 段，1..N 行） | ✅ | `3 行：会话 执行中 · 已运行 1s / 会话 等待下游 · 产出已提交 / 会话 空闲` |
| 27 | And single run 含「会话 等待下游 · 产出已提交」（A-1 第 5 段） | ✅ | `会话 执行中 · 已运行 1s / 会话 等待下游 · 产出已提交 / 会话 空闲` |
| 28 | And single run 节点行逐字（A-1 第 6 段）（期望匹配 /^节点 已完成 · 耗时 \S+$/） | ✅ | `节点 已完成 · 耗时 1s` |
| 29 | And single run 交接包 4 行（A-1 第 7 段，无方向） | ✅ | `4 行：交接包 HO-001  已构造   22:04:51 / 交接包 HO-001  已投递   22:04:51 / 交接包 HO-001  已接受   22:04:51 / 交接包 HO-001  已完成   22:04:51` |
| 30 | And single run 交接包第 1 行逐字（交接包已构造）（期望匹配 /^交接包 HO-001 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已构造   22:04:51` |
| 31 | And single run 交接包第 2 行逐字（交接包已投递）（期望匹配 /^交接包 HO-001 {2}已投递 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已投递   22:04:51` |
| 32 | And single run 交接包第 3 行逐字（交接包已接受）（期望匹配 /^交接包 HO-001 {2}已接受 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已接受   22:04:51` |
| 33 | And single run 交接包第 4 行逐字（交接包已完成）（期望匹配 /^交接包 HO-001 {2}已完成 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已完成   22:04:51` |
| 34 | And single run 全文不出现「模板」（期望不含 "模板"） | ✅ | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-31084-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 已完成 · 耗时 1s<br>交接包 HO-001  已构造   22:04:51<br>交接包 HO-001  已投递   22:04:51<br>交接包 HO-001  已接受   22:04:51<br>交接包 HO-001  已完成   22:04:51<br>` |
| 35 | And single run 节点行不带轮次（期望不含 " · 第 "） | ✅ | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-31084-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 已完成 · 耗时 1s<br>交接包 HO-001  已构造   22:04:51<br>交接包 HO-001  已投递   22:04:51<br>交接包 HO-001  已接受   22:04:51<br>交接包 HO-001  已完成   22:04:51<br>` |
| 36 | And single run 不带事件序号（期望不含 "[#"） | ✅ | `实例 INST-001 · 运行中<br>会话已创建 mock-sess-31084-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 已完成 · 耗时 1s<br>交接包 HO-001  已构造   22:04:51<br>交接包 HO-001  已投递   22:04:51<br>交接包 HO-001  已接受   22:04:51<br>交接包 HO-001  已完成   22:04:51<br>` |
| 37 | And single status 段序与行数 = I1.2 A-2 的 single 列（7 行） | ✅ | `7 行：实例 INST-001 · 已完成 / 节点 已完成 · 耗时 1s / 会话 空闲 / 交接包 HO-001  已构造   22:04:51 / 交接包 HO-001  已投递   22:04:51 / 交接包 HO-001  已接受   22:04:51 / 交接包 HO-001  已完成   22:04:51` |
| 38 | And single status 第 1 行逐字（实例行）（期望匹配 /^实例 INST-001 · 已完成$/） | ✅ | `实例 INST-001 · 已完成` |
| 39 | And single status 第 2 行逐字（节点行）（期望匹配 /^节点 已完成 · 耗时 \S+$/） | ✅ | `节点 已完成 · 耗时 1s` |
| 40 | And single status 第 3 行逐字（会话行）（期望匹配 /^会话 空闲$/） | ✅ | `会话 空闲` |
| 41 | And single status 第 4 行逐字（交接包已构造）（期望匹配 /^交接包 HO-001 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已构造   22:04:51` |
| 42 | And single status 第 5 行逐字（交接包已投递）（期望匹配 /^交接包 HO-001 {2}已投递 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已投递   22:04:51` |
| 43 | And single status 第 6 行逐字（交接包已接受）（期望匹配 /^交接包 HO-001 {2}已接受 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已接受   22:04:51` |
| 44 | And single status 第 7 行逐字（交接包已完成）（期望匹配 /^交接包 HO-001 {2}已完成 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已完成   22:04:51` |
| 45 | And single status 全文不出现「模板」（期望不含 "模板"） | ✅ | `实例 INST-001 · 已完成<br>节点 已完成 · 耗时 1s<br>会话 空闲<br>交接包 HO-001  已构造   22:04:51<br>交接包 HO-001  已投递   22:04:51<br>交接包 HO-001  已接受   22:04:51<br>交接包 HO-001  已完成   22:04:51<br>` |
| 46 | And single status 不出现方向箭头（期望不含 "→"） | ✅ | `实例 INST-001 · 已完成<br>节点 已完成 · 耗时 1s<br>会话 空闲<br>交接包 HO-001  已构造   22:04:51<br>交接包 HO-001  已投递   22:04:51<br>交接包 HO-001  已接受   22:04:51<br>交接包 HO-001  已完成   22:04:51<br>` |
| 47 | And single status 不出现「升级」块（期望不含 "升级"） | ✅ | `实例 INST-001 · 已完成<br>节点 已完成 · 耗时 1s<br>会话 空闲<br>交接包 HO-001  已构造   22:04:51<br>交接包 HO-001  已投递   22:04:51<br>交接包 HO-001  已接受   22:04:51<br>交接包 HO-001  已完成   22:04:51<br>` |
| 48 | 机检：code-loop 定格时实例 state='running'（期望 "running"） | ✅ | `"running"` |
| 49 | 机检：T-002 state='failed'、round=1（期望 "failed/1"） | ✅ | `"failed/1"` |
| 50 | 机检：只有 HO-001、HO-002（期望 "HO-001,HO-002"） | ✅ | `"HO-001,HO-002"` |
| 51 | 机检：HO-001 终态 'consumed'（期望 "consumed"） | ✅ | `"consumed"` |
| 52 | And code-loop A-3 的 orch run 退出码 0（期望 0） | ✅ | `0` |
| 53 | And A-3 第 1 行「实例 … · 运行中 · 模板 编码闭环」（期望匹配 /^实例 INST-001 · 运行中 · 模板 编码闭环$/） | ✅ | `实例 INST-001 · 运行中 · 模板 编码闭环` |
| 54 | And A-3 第 2 行「会话已创建 <id>」（期望匹配 /^会话已创建 \S+$/） | ✅ | `会话已创建 mock-sess-15896-1` |
| 55 | And A-3 第 3 行「任务已投递」（期望 "任务已投递"） | ✅ | `"任务已投递"` |
| 56 | And A-3 结束段从两行节点开始 | ✅ | `节点段起始行 10` |
| 57 | And A-3 两行节点逐字（A-2 第 3 段）（期望匹配 /^节点 T-001 开发 已完成 · 第 1 轮 · 耗时 \S+\n节点 T-002 测试 已完成 · 第 1 轮 · 耗时 \S+ · 判定 通过$/） | ✅ | `节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过` |
| 58 | And A-3 最后一行「升级 —」（期望 "升级 —"） | ✅ | `"升级 —"` |
| 59 | And A-3 全文不出现「未知错误」（期望不含 "未知错误"） | ✅ | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-15896-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过<br>交接包 HO-001  开发→测试  已构` |
| 60 | And A-3 全文不出现「核对失败」（期望不含 "核对失败"） | ✅ | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-15896-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s<br>节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过<br>交接包 HO-001  开发→测试  已构` |
| 61 | And code-loop A-4 的 orch run 退出码 4（期望 4） | ✅ | `4` |
| 62 | And A-4 收尾正好三行（不含流式会话行） | ✅ | `共 18 行，末三行：实例 INST-001 · 已挂起 · 模板 编码闭环 / 升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮 / 下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001` |
| 63 | And A-4 第 1 行「实例 … · 已挂起 · 模板 编码闭环」（期望匹配 /^实例 INST-001 · 已挂起 · 模板 编码闭环$/） | ✅ | `实例 INST-001 · 已挂起 · 模板 编码闭环` |
| 64 | And A-4 第 2 行「升级 … 待处理 · 节点 T-002 测试 · 第 2 轮」（期望匹配 /^升级 ESC-\d+ 待处理 · 节点 T-002 测试 · 第 2 轮$/） | ✅ | `升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮` |
| 65 | And A-4 第 3 行「下一步：…」（期望 "下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001"） | ✅ | `"下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001"` |
| 66 | And A-4 不打印节点表其余行/交接包行（期望不含 "交接包 HO-"） | ✅ | `实例 INST-001 · 运行中 · 模板 编码闭环<br>会话已创建 mock-sess-27960-1<br>任务已投递<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 空闲<br>会话 执行中 · 已运行 1s<br>会话 等待下游 · 产出已提交<br>会话 已升级<br>实例 I` |

**⑤ 判定**：通过

**备注**

- 回归对照口径：code-loop 定格用 I1.2 验收 AC-05 的实测样例（同一命令 backflow-once --stop-after 3 --keep）；single 用 I1.2 附录 A-1 / A-2 的 single 列（= I1.1 版式）；code-loop 成功/挂起用 A-3 / A-4。只允许 实例号/会话号/耗时/时间戳 变化（I1.2 附录对这些字段本身就是变量）。
- 条数下限断言：要求 pass = tests 且 tests ≥ 416（HEAD 基线），只禁止条数减少，不禁止后续迭代新增用例——新增测试全绿仍算通过。

---

#### AC-37 I1.1 旧格式实例只读可查

- 判定：**通过**（核对 24/24 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-37`
- 实例：OLD-001

**① 完整命令（逐条可复跑）**

```
[orch status --instance OLD-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance OLD-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-37 | exit=0 | 216ms
[orch status（列表，旧格式投影）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-37 | exit=0 | 90ms
[orch cancel --instance OLD-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance OLD-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-37 | exit=1 | 88ms
[orch run --cwd ./work --instance OLD-001 --task "写一段说明，保存到 out/intro.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./work --instance OLD-001 --task "写一段说明，保存到 out/intro.md"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-37 | exit=1 | 91ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-37 | exit=0 | 184ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-37.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 项目根里放入 I1.1 的 v1 实例（schemaVersion=1）
When 我执行 orch status --instance <旧实例号>
Then 能正常显示实例行与节点行
And 我执行 orch cancel --instance <旧实例号> 或 orch run --instance <旧实例号> …
Then 输出含"该实例为旧格式，本版本只支持查看"，退出码 1
And 机检：旧实例的 state.json 字节未改变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-37.state.json` | 1847 B |
| `docs/iterations/iteration-3/evidence/AC-37.events.jsonl` | 378 B |
| `docs/iterations/iteration-3/evidence/AC-37.meta.json` | 679 B |
| `docs/iterations/iteration-3/evidence/AC-37.output.json` | 9552 B |
| `docs/iterations/iteration-3/evidence/AC-37.status.txt` | 1730 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 机检：样本 schemaVersion=1（期望 1） | ✅ | `1` |
| 2 | Given 机检：装入的 state.json 与 SHA256SUMS 基线一致（期望 "95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"） | ✅ | `"95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"` |
| 3 | Given 机检：装入的 events.jsonl 与 SHA256SUMS 基线一致（期望 "3ef710cc9a4f2f28601af66f43ee68907e4a3538467e94062056a58c38e5b2d9"） | ✅ | `"3ef710cc9a4f2f28601af66f43ee68907e4a3538467e94062056a58c38e5b2d9"` |
| 4 | Then status 退出码 0（期望 0） | ✅ | `0` |
| 5 | Then 第 1 行「实例 OLD-001 · 已完成」（期望 "实例 OLD-001 · 已完成"） | ✅ | `"实例 OLD-001 · 已完成"` |
| 6 | Then 节点行正常显示（旧格式无节点号/角色/轮次）（期望匹配 /^节点 已完成 · 耗时 \S+$/） | ✅ | `节点 已完成 · 耗时 11m55s` |
| 7 | Then 会话行正常显示（期望 "会话 空闲"） | ✅ | `"会话 空闲"` |
| 8 | Then 交接包行正常显示（期望匹配 /^交接包 HO-001 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/） | ✅ | `交接包 HO-001  已构造   17:00:04` |
| 9 | Then 实例行 + 节点行 + 会话行 + 4 行交接包（共 7 行） | ✅ | `7 行：实例 OLD-001 · 已完成 / 节点 已完成 · 耗时 11m55s / 会话 空闲 / 交接包 HO-001  已构造   17:00:04 / 交接包 HO-001  已投递   17:00:04 / 交接包 HO-001  已接受   17:00:05 / 交接包 HO-001  已完成   17:00:05` |
| 10 | Then 旧格式不显示模板（期望不含 "模板"） | ✅ | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 11 | Then 旧格式不显示轮次（期望不含 " · 第 "） | ✅ | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 12 | Then 旧格式不显示升级块（期望不含 "升级"） | ✅ | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 13 | Then 旧格式交接包不带方向（期望不含 "→"） | ✅ | `实例 OLD-001 · 已完成<br>节点 已完成 · 耗时 11m55s<br>会话 空闲<br>交接包 HO-001  已构造   17:00:04<br>交接包 HO-001  已投递   17:00:04<br>交接包 HO-001  已接受   17:00:05<br>交接包 HO-001  已完成   17:00:05<br>` |
| 14 | Then 列表行正常显示（实例 · 状态 · 节点 · 会话 · 耗时 · 更新）（期望匹配 /^实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 \S+ · 更新 \d{2}:\d{2}:\d{2}$/m） | ✅ | `实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 11m55s · 更新 17:12:00<br>` |
| 15 | Then 列表行不显示模板（期望不含 "模板"） | ✅ | `实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 11m55s · 更新 17:12:00<br>` |
| 16 | Then 列表行不显示「待处理升级」（期望不含 "待处理升级"） | ✅ | `实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 11m55s · 更新 17:12:00<br>` |
| 17 | Then cancel 输出含「该实例为旧格式，本版本只支持查看」（期望含 "该实例为旧格式，本版本只支持查看"） | ✅ | `该实例为旧格式，本版本只支持查看` |
| 18 | Then cancel 退出码 1（期望 1） | ✅ | `1` |
| 19 | Then run --instance 输出含「该实例为旧格式，本版本只支持查看」（期望含 "该实例为旧格式，本版本只支持查看"） | ✅ | `该实例为旧格式，本版本只支持查看` |
| 20 | Then run --instance 退出码 1（期望 1） | ✅ | `1` |
| 21 | And 机检：state.json sha256 未改变（期望 "95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"） | ✅ | `"95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"` |
| 22 | And 机检：events.jsonl sha256 未改变（期望 "3ef710cc9a4f2f28601af66f43ee68907e4a3538467e94062056a58c38e5b2d9"） | ✅ | `"3ef710cc9a4f2f28601af66f43ee68907e4a3538467e94062056a58c38e5b2d9"` |
| 23 | And 机检：state.json 仍逐字等于 SHA256SUMS 基线（期望 "95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"） | ✅ | `"95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"` |
| 24 | And 机检：没有出现新实例（旧实例目录仍是唯一目录） | ✅ | `OLD-001` |

**⑤ 判定**：通过

---

#### AC-38 通用任务闭环与编码闭环共用同一引擎

- 判定：**通过**（核对 20/20 通过）
- 验证面：架构检查
- 项目根：（无）
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[purity-check --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者   | cwd=D:\WWW\Maestro | exit=0 | 91ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-38.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 源码工作区
Then `src/core` 与 `src/daemon` **全目录**（含子目录）的所有文件中不出现字符串 'task-loop'、'researcher'、'writer'、'reviewer'、'研究员'、'撰写者'、'审核者'（用 `test/fixtures/purity-check.mjs --forbid` 传 7 词全表扫描，含注释）
And `src/core/orchestrator.js` 的推进入口仍是 `driveGraph` → `finishGraphNode` → `advance` → `planAdvance`
And `task-loop` 与 `code-loop` 的节点状态词取自 `src/core/state-machine.js` 的 `NODE_STATES`，迁移合法性由该表定义（既有直写点保持不变）
And 新图只通过 `src/templates/index.js` 注入
And `src/core/review.js` 不出现任何模板名或角色名
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-38.state.json` | 5 B |
| `docs/iterations/iteration-3/evidence/AC-38.events.jsonl` | 0 B |
| `docs/iterations/iteration-3/evidence/AC-38.meta.json` | 489 B |
| `docs/iterations/iteration-3/evidence/AC-38.output.json` | 5265 B |
| `docs/iterations/iteration-3/evidence/AC-38.status.txt` | 509 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 7 词扫描退出码 0（零命中）（期望 0） | ✅ | `0` |
| 2 | Then 扫描覆盖 src/core 与 src/daemon 全目录（期望含 "src/core, src/daemon"） | ✅ | `OK: 扫描 16 个文件，src/core, src/daemon 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者 零命中<br>` |
| 3 | And orchestrator.js 有 driveGraph 定义 | ✅ | `2369 字符` |
| 4 | And driveGraph 内调用 finishGraphNode( | ✅ | `driveGraph 函数体` |
| 5 | And driveGraph 内调用 advance( | ✅ | `driveGraph 函数体` |
| 6 | And advance 定义存在且委托 advanceLocked（同一把锁） | ✅ | `  async function advance(instanceId, options = {}) {<br>    const { onProgress = null, hostId = null, verdict = null } = options;<br>    return withLock(instanceId, () => advanceLocked(instanceId, { onPro` |
| 7 | And advanceLocked 内调用 planAdvance( | ✅ | `advanceLocked 函数体` |
| 8 | And planAdvance 由 src/core/advance.js 提供并被 orchestrator 导入 | ✅ | `import { checkWakeGate, classifyNodeOutcome, planAdvance }` |
| 9 | And core/daemon 全目录不含 task-loop / code-loop 字面量（期望 "（零命中）"） | ✅ | `"（零命中）"` |
| 10 | And 只有一处 advance 定义（两图共用同一推进入口） | ✅ | `advance 定义 1 处` |
| 11 | And 只有一处 driveGraph 定义 | ✅ | `driveGraph 定义 1 处` |
| 12 | And NODE_STATES 恰为 7 个节点状态（期望 "pending,running,review,done,failed,cancelled,escalated"） | ✅ | `"pending,running,review,done,failed,cancelled,escalated"` |
| 13 | And createNodeSM().states 与 NODE_STATES 逐字一致（期望 "pending,running,review,done,failed,cancelled,escalated"） | ✅ | `"pending,running,review,done,failed,cancelled,escalated"` |
| 14 | And 迁移合法性由该表定义（回流唤醒 done→running、复测 failed→running、取消 escalated→cancelled 均合法） | ✅ | `全部合法` |
| 15 | And 表外迁移被拒（done→cancelled 非法） | ✅ | `{"ok":false,"code":"ILLEGAL_TRANSITION","message":"node: done -> cancelled is not in the transition table"}` |
| 16 | And 两图节点初始态取自 NODE_STATES（initialNodes 写 state='pending'，pending ∈ NODE_STATES） | ✅ | `initialNodes: state: 'pending'` |
| 17 | And GRAPHS 在 src/templates/index.js 中登记 single / code-loop / task-loop | ✅ | `GRAPHS = { single, code-loop, task-loop }` |
| 18 | And core/daemon 只从 ../templates/index.js 取图（不直接 import 单图文件） | ✅ | `src/core/advance.js -> ../templates/index.js、src/core/orchestrator.js -> ../templates/index.js` |
| 19 | And 引擎按实例的 template 名解析图（graphForState → resolveTemplate），不按图写分支 | ✅ | `graphForState: resolveTemplate(state?.template)` |
| 20 | And src/core/review.js 不出现任何模板名或角色名（期望 "（零命中）"） | ✅ | `"（零命中）"` |

**⑤ 判定**：通过

---

#### AC-39 事件记录覆盖审核与下游门控

- 判定：**通过**（核对 26/26 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-a`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario doc-backflow-once（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-a --scenario doc-backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 2260ms
[orch status --instance INST-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-a | exit=0 | 225ms
[driver --scenario review-bad-json（完整跑完并挂起）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-b --scenario review-bad-json   | cwd=D:\WWW\Maestro | exit=4 | 1582ms
[orch status --instance INST-001 --events（review-bad-json）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-b | exit=0 | 227ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-a | exit=0 | 195ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-39-b | exit=0 | 179ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-39.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
When 我执行 orch status --instance INST-001 --events
Then 输出含"派发"、"读取审核"、"审核驳回"、"审核通过"、"证据核对通过"、"下游已接受"、"构造回流"、"交接已投递"、"已完成"
And 输出不含任何未翻译的英文 reason（如 'review.passed'、'node.dispatch'）
And 机检：events 中 object 覆盖 node / session / handoff
And 机检：review.read 的 detail 含 path='out/review.json' 与 results 计数
Given 另起全新根，夹具场景 review-bad-json 已完整跑完并挂起
When 我执行 orch status --instance INST-001 --events
Then 机检：review.invalid 的 detail 含 reasonCode 与 message
And 机检：events 中 object 覆盖 escalation，且含 escalation.created
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-39.state.json` | 20483 B |
| `docs/iterations/iteration-3/evidence/AC-39.events.jsonl` | 27352 B |
| `docs/iterations/iteration-3/evidence/AC-39.meta.json` | 1175 B |
| `docs/iterations/iteration-3/evidence/AC-39.output.json` | 30684 B |
| `docs/iterations/iteration-3/evidence/AC-39.status.txt` | 14474 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 前置：doc-backflow-once 跑完退出码 0（期望 0） | ✅ | `0` |
| 2 | When status --events 退出码 0（期望 0） | ✅ | `0` |
| 3 | Then 输出含「派发」（期望含 "派发"） | ✅ | `[#2] 22:05:22  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮` |
| 4 | Then 输出含「读取审核」（期望含 "读取审核"） | ✅ | `[#31] 22:05:23  节点 T-003  读取审核` |
| 5 | Then 输出含「审核驳回」（期望含 "审核驳回"） | ✅ | `[#33] 22:05:23  节点 T-003  审核驳回` |
| 6 | Then 输出含「审核通过」（期望含 "审核通过"） | ✅ | `[#59] 22:05:24  节点 T-003  审核通过` |
| 7 | Then 输出含「证据核对通过」（期望含 "证据核对通过"） | ✅ | `[#8] 22:05:23  节点 T-001  证据核对通过` |
| 8 | Then 输出含「下游已接受」（期望含 "下游已接受"） | ✅ | `[#14] 22:05:23  节点 T-001  下游已接受` |
| 9 | Then 输出含「构造回流」（期望含 "构造回流"） | ✅ | `[#37] 22:05:23  交接包 HO-003  构造回流` |
| 10 | Then 输出含「交接已投递」（期望含 "交接已投递"） | ✅ | `[#11] 22:05:23  交接包 HO-001  已构造 → 已投递  原因 交接已投递` |
| 11 | Then 输出含「已完成」（期望含 "已完成"） | ✅ | `实例 INST-001 · 已完成 · 模板 通用任务闭环` |
| 12 | And 输出不含任何未翻译的英文 reason（枚举 events 的全部 reason）（期望 "（零命中）"） | ✅ | `"（零命中）"` |
| 13 | And 输出不含「review.passed」（期望不含 "review.passed"） | ✅ | `实例 INST-001 · 已完成 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 1s · 审核 通过<br>会话 空闲<br>交接包 HO-001  研究员→撰写` |
| 14 | And 输出不含「node.dispatch」（期望不含 "node.dispatch"） | ✅ | `实例 INST-001 · 已完成 · 模板 通用任务闭环<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 1s · 产物 artifacts/docs/release-notes.v2.md<br>节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 1s · 审核 通过<br>会话 空闲<br>交接包 HO-001  研究员→撰写` |
| 15 | And 机检：events 的 object 覆盖 node / session / handoff | ✅ | `instance,node,session,handoff` |
| 16 | And 机检：有 review.read 事件（两轮审核） | ✅ | `2 条` |
| 17 | And 机检：review.read.detail.path='out/review.json' | ✅ | `out/review.json,out/review.json` |
| 18 | And 机检：review.read.detail.results 是计数（reject 轮为 2） | ✅ | `reject:2,pass:0` |
| 19 | Given 前置：review-bad-json 退出码 4（已挂起）（期望 4） | ✅ | `4` |
| 20 | When status --events 退出码 0（第二个根）（期望 0） | ✅ | `0` |
| 21 | Then 机检：有 review.invalid 事件 | ✅ | `seq=31` |
| 22 | Then 机检：review.invalid.detail 含 reasonCode | ✅ | `review_invalid` |
| 23 | Then 机检：review.invalid.detail 含 message | ✅ | `核对失败：审核文件不可解析` |
| 24 | Then 机检：events 的 object 覆盖 escalation | ✅ | `instance,node,session,handoff,escalation` |
| 25 | Then 机检：含 escalation.created | ✅ | `ESC-001:pending` |
| 26 | Then 机检：status 事件段把升级行翻成中文（含「创建升级」） | ✅ | `升级 ESC-001 待处理` |

**⑤ 判定**：通过

**备注**

- 失败项同源于 probe/acc3-f-blockers.md 的 BLK-D1：task-loop 的 result='note' 事件行仍把英文 reason 当中段、并重复追加「原因 <中文>」；A-2 第 7 段 / D-5 要求中段直接用中文原因词且不再追加「原因」段。

---

#### AC-40 真实宿主上的"审核驳回 → 改稿 → 通过"（真实面）

- 判定：**通过**（核对 40/40 通过）
- 验证面：真实面
- 项目根：（无）
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[真实宿主复验（证据来源，本次未重跑）] "cd <projectRoot> && node D:/WWW/Maestro/bin/orch.js run --cwd ./demo-doc-real --template task-loop --task \"<AC-40 Given 原文>\""   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3-ac40b\proj | exit=0 | 313586ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-40.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 真实 DSH 可用，全新项目根 demo-doc-real
And 任务文本为：
When 我执行 orch run --cwd ./demo-doc-real --template task-loop --task "<上面的任务>"
Then 命令在 10 分钟内结束，退出码 0
And 输出含"节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过"
And 机检：v1 与 v2 同时存在，v1 的 sha256 与第 1 轮记录一致
And 机检：存在 1 条 edge.kind='backflow' 的交接包，且其 defects 至少 1 条、证据可解析
And 机检：没有升级
And 若因模型未按话术写作导致第 1 轮未驳回，允许最多重试 3 次；3 次仍不稳定则记录为"真实面不稳定"，不阻塞本迭代
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-40b.final.events.jsonl` | 33411 B |
| `docs/iterations/iteration-3/evidence/AC-40b.final.state.json` | 10849 B |
| `docs/iterations/iteration-3/evidence/AC-40b.meta.json` | 10047 B |
| `docs/iterations/iteration-3/evidence/AC-40b.host.json` | 576 B |
| `docs/iterations/iteration-3/evidence/AC-40b.prompt.review.txt` | 2021 B |
| `docs/iterations/iteration-3/evidence/AC-40b.workspace-probe.txt` | 1616 B |
| `docs/iterations/iteration-3/evidence/AC-40b.run.output.txt` | 6181 B |
| `docs/iterations/iteration-3/evidence/AC-40b.run.timing.txt` | 93 B |
| `docs/iterations/iteration-3/evidence/AC-40b.review.round1.json` | 558 B |
| `docs/iterations/iteration-3/evidence/AC-40b.review.round2.json` | 123 B |
| `docs/iterations/iteration-3/evidence/AC-40b.v1.md` | 6167 B |
| `docs/iterations/iteration-3/evidence/AC-40b.v2.md` | 9852 B |
| `docs/iterations/iteration-3/evidence/AC-40.state.json` | 5 B |
| `docs/iterations/iteration-3/evidence/AC-40.events.jsonl` | 0 B |
| `docs/iterations/iteration-3/evidence/AC-40.meta.json` | 2022 B |
| `docs/iterations/iteration-3/evidence/AC-40.output.json` | 10467 B |
| `docs/iterations/iteration-3/evidence/AC-40.status.txt` | 419 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 真实 DSH 版本为 0.2.2-rc.1（期望 "0.2.2-rc.1"） | ✅ | `"0.2.2-rc.1"` |
| 2 | Given 模型路由为 deepseek-account → deepseek-flash（期望 "deepseek-account/deepseek-flash"） | ✅ | `"deepseek-account/deepseek-flash"` |
| 3 | Given 真实宿主经 stdio 拉起（非 mock） | ✅ | `stdio C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js --profile acp` |
| 4 | Given 任务文本逐字取需求 Given（三节 + 故意不写回滚方案 + 产物行） | ✅ | `写一篇发布说明，面向使用 v1.2 的开发者，必须包含「新功能」「升级步骤」「回滚方案」三节。⏎第 1 轮先只写「新功能」与「升级步骤」，故意不要写「回滚方案」；审核会驳回，第 2 轮再补上「回滚方案」。⏎产物：release-notes.md` |
| 5 | Then 命令在 10 分钟内结束（DURATION ≤ 600s） | ✅ | `313.586s（上限 600s）` |
| 6 | Then 退出码 0（期望 "0"） | ✅ | `"0"` |
| 7 | Then 输出含「节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过」 | ✅ | `节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 2m38s · 审核 通过` |
| 8 | And 机检：v1 与 v2 同时存在且都非空 | ✅ | `v1 168 行 / v2 242 行` |
| 9 | And 机检：v1 的 sha256 与第 1 轮记录一致（期望 "dbedc0b14322a395f33396d5a7845ffdd436a9999fdee4a15f80558f1bd9a163"） | ✅ | `"dbedc0b14322a395f33396d5a7845ffdd436a9999fdee4a15f80558f1bd9a163"` |
| 10 | And 机检：v2 的 sha256 与第 2 轮记录一致（期望 "b9a37fac48b0f504d3c2b3204a469293fe285dbd8001a9f329e5587c3d0070fd"） | ✅ | `"b9a37fac48b0f504d3c2b3204a469293fe285dbd8001a9f329e5587c3d0070fd"` |
| 11 | And 机检：T-002 的 artifactHistory 恰好两条（第 1/2 轮）（期望 "1,2"） | ✅ | `"1,2"` |
| 12 | And 机检：v1 与 v2 内容不同，且第 2 轮确实补上了「回滚方案」 | ✅ | `sha 不同=true；v1 含回滚方案=false；v2 含回滚方案=true` |
| 13 | And 机检：edge.kind='backflow' 的交接包恰好 1 条（期望 "HO-003:T-003→T-002"） | ✅ | `"HO-003:T-003→T-002"` |
| 14 | And 机检：该回流交接包的 defects 至少 1 条 | ✅ | `1 条：缺少任务要求的「回滚方案」章节，未说明回滚触发条件、操作步骤与验证方式。` |
| 15 | And 机检：缺陷证据可解析（<ref>#L<n>，ref 指向 v1、行号在 v1 范围内） | ✅ | `evidence=artifacts/docs/release-notes.v1.md#L166；ref 指向 v1=true；1 ≤ 166 ≤ 168=true` |
| 16 | And 机检：回流携带的 previous.sha256 等于 v1 的 sha256（期望 "dbedc0b14322a395f33396d5a7845ffdd436a9999fdee4a15f80558f1bd9a163"） | ✅ | `"dbedc0b14322a395f33396d5a7845ffdd436a9999fdee4a15f80558f1bd9a163"` |
| 17 | And 机检：回流携带非空 revisionRequirement（改稿要求可追溯） | ✅ | `补充完整的「回滚方案」章节，至少包含回滚触发条件、具体操作步骤（含版本与命令）、回滚后的数据/服务验证及注意事项，同时保留现有「新功能」「升级步骤」内容。` |
| 18 | And 机检：没有升级（escalations 为空）（期望 "0"） | ✅ | `"0"` |
| 19 | Then 输出末段含「升级 —」且不含「升级 ESC-」 | ✅ | `升级 —` |
| 20 | 机检：review.read 恰好 2 条（第 1/2 轮各一次）（期望 "2"） | ✅ | `"2"` |
| 21 | 机检：第 1 轮 review.read 为 reject / results=1（期望 "reject:1"） | ✅ | `"reject:1"` |
| 22 | 机检：第 2 轮 review.read 为 pass / results=0（期望 "pass:0"） | ✅ | `"pass:0"` |
| 23 | 机检：两轮 review.read 的 detail.path 均为 out/review.json（期望 "out/review.json,out/review.json"） | ✅ | `"out/review.json,out/review.json"` |
| 24 | 机检：seq 先后 review.rejected → 第 2 轮 node.dispatch(T-002 round=2) → review.passed | ✅ | `70 < 75 < 128` |
| 25 | 机检：review.passed 恰好 1 条（期望 "1"） | ✅ | `"1"` |
| 26 | 机检：零 review.invalid / 零 review_missing（本次修复的验证点）（期望 "0/0"） | ✅ | `"0/0"` |
| 27 | 机检：review.round1.json 为 reject 且 defects=1（期望 "reject:1"） | ✅ | `"reject:1"` |
| 28 | 机检：review.round2.json 为 pass 且 defects=0（期望 "pass:0"） | ✅ | `"pass:0"` |
| 29 | 机检：实例 state=completed（期望 "completed"） | ✅ | `"completed"` |
| 30 | 机检：三节点全部 done（期望 "T-001:done,T-002:done,T-003:done"） | ✅ | `"T-001:done,T-002:done,T-003:done"` |
| 31 | 机检：T-002 / T-003 的 round=2（T-001 仍第 1 轮）（期望 "T-001:1,T-002:2,T-003:2"） | ✅ | `"T-001:1,T-002:2,T-003:2"` |
| 32 | 机检：T-003 review.decision=pass / defectCount=0 / reviewPath=out/review.json（期望 "pass:0:out/review.json"） | ✅ | `"pass:0:out/review.json"` |
| 33 | 机检：state.counters.dispatchCount 与 events 的 node.dispatch 条数一致 | ✅ | `state=5 / events=5` |
| 34 | 机检：末条事件为 instance run.completed → completed（期望 "instance:run.completed:completed"） | ✅ | `"instance:run.completed:completed"` |
| 35 | 机检：审核提示词共 2 轮（每轮一条「审核文件写入路径」）（期望 "2"） | ✅ | `"2"` |
| 36 | 机检：两轮审核文件路径均为绝对路径 | ✅ | `#1 C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3-ac40b\proj\demo-doc-real\out\review.json（绝对=true） / #2 C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3-ac40b\proj\demo-doc-real\out\review.json（绝对=true）` |
| 37 | 机检：两轮路径解析后等于 <任务目录>/out/review.json（期望 "c:\\users\\xuesh\\appdata\\local\\temp\\maestro-acc-p3-ac40b\\proj\\demo-doc-real\\out\\review.json,c:\\users\\xuesh\\appdata\\local\\temp\\maestro-acc-p3-ac40b | ✅ | `"c:\\users\\xuesh\\appdata\\local\\temp\\maestro-acc-p3-ac40b\\proj\\demo-doc-real\\out\\review.json,c:\\users\\xuesh\\appdata\\local\\temp\\maestro-acc-p3-ac40b\\proj\\demo-doc-real\\out\\review.json"` |
| 38 | 机检：workspace-probe 终态——任务目录 out/review.json 存在（PRESENT） | ✅ | `PRESENT  C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3-ac40b\proj\demo-doc-real\out\review.json` |
| 39 | 机检：workspace-probe 终态——实例工作区 out/review.json 不存在（工作区没有 out/） | ✅ | `ABSENT 命中 1 条 / 工作区 PRESENT 误命中 0 条 / 顶层目录声明 true` |
| 40 | And 重试条款：本次 0 次重试（1 次即通过，条款未触发） | ✅ | `attempts=1，exitCode=0（上限 3 次）` |

**⑤ 判定**：通过

**备注**

- 本用例是「证据机检型」：不启进程、不跑夹具，只读 evidence/AC-40b.*（修复 150c7c6 后的真机复验，5m14s / exit 0 / 313.586s）。逐项核对覆盖需求 AC-40 的 Given/When/Then/And，并额外机检本次修复的两个验证点：审核提示词两轮均为绝对路径且等于 <任务目录>/out/review.json；任务目录有 review.json、实例工作区没有 out/。
- 修复前对照证据 evidence/AC-40.*（3 次尝试：2 次 review_missing 挂起 exit 4、第 3 次通过）未参与判定，亦未被改动；与本用例自动落盘同名、已按字节还原的是：AC-40.meta.json（8908 B / 94a6eb7db88fd85db3ac910706215ee9d9e56808917ba6491e3b3cede22f0236）、AC-40.status.txt（1466 B / b22de512c2a91ec71ccaa623b1d806e95168e3153e8377ee035b4d1b48f7bdd3）。
- 证据表末尾的 AC-40.{state.json,events.jsonl,meta.json,output.json,status.txt} 是本用例自动落盘的占位（无项目根、无实例，state.json 为 null）；其中 meta.json / status.txt 落盘后立即被还原成修复前对照证据，故表里显示的是落盘瞬间的字节数，磁盘上的实际大小以上面 kept 列表为准。核对明细同时落在本文件与 probe/acc3-f-results.jsonl。
- 证据只读校验：v1 sha256=dbedc0b14322a395f33396d5a7845ffdd436a9999fdee4a15f80558f1bd9a163，v2 sha256=b9a37fac48b0f504d3c2b3204a469293fe285dbd8001a9f329e5587c3d0070fd，与 state.nodes[T-002].artifactHistory 记录一致；v1 168 行、v2 242 行。

---

#### AC-41 同一节点被重复投递时被拒

- 判定：**通过**（核对 13/13 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-41`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[node test/fixtures/call-seam.mjs --root <根> --instance INST-001 --call dispatch --node T-002] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\call-seam.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-41 --instance INST-001 --call dispatch --node T-002   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-41 | exit=1 | 118ms
[driver --scenario doc-pass --stop-after 2 --keep（长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-41 --scenario doc-pass --keep --stop-after 2   | cwd=D:\WWW\Maestro | exit=13 | 1626ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-41 | exit=0 | 110ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-41.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 doc-pass 已用 --stop-after 2 --keep 停在"撰写者 review(downstream)"
When 我执行 node test/fixtures/call-seam.mjs --root <根> --instance INST-001 --call dispatch --node T-002
Then 输出是单行 JSON，含 "ok":false 与 "code":"NODE_BUSY"
And 机检：T-002 仍是 'review'，round 仍为 1
And 机检：counters.dispatchCount 仍为 2
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-41.state.json` | 5972 B |
| `docs/iterations/iteration-3/evidence/AC-41.events.jsonl` | 5439 B |
| `docs/iterations/iteration-3/evidence/AC-41.meta.json` | 687 B |
| `docs/iterations/iteration-3/evidence/AC-41.output.json` | 4519 B |
| `docs/iterations/iteration-3/evidence/AC-41.status.txt` | 1563 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 机检：.mock/stopped-after-2 存在（停在撰写者待校验） | ✅ | `1073ms` |
| 2 | Given 机检：T-002 state='review'（期望 "review"） | ✅ | `"review"` |
| 3 | Given 机检：T-002 reviewReason='downstream'（期望 "downstream"） | ✅ | `"downstream"` |
| 4 | Given 机检：T-002 round=1（期望 1） | ✅ | `1` |
| 5 | Given 机检：counters.dispatchCount=2（期望 2） | ✅ | `2` |
| 6 | Then 输出是单行 JSON（期望 1） | ✅ | `1` |
| 7 | Then 输出是合法 JSON | ✅ | `{"ok":false,"code":"NODE_BUSY","detail":{}}` |
| 8 | Then 含 "ok":false（期望 false） | ✅ | `false` |
| 9 | Then 含 "code":"NODE_BUSY"（期望 "NODE_BUSY"） | ✅ | `"NODE_BUSY"` |
| 10 | And 机检：T-002 仍是 'review'（期望 "review"） | ✅ | `"review"` |
| 11 | And 机检：T-002 round 仍为 1（期望 1） | ✅ | `1` |
| 12 | And 机检：T-002 reviewReason 仍为 'downstream'（期望 "downstream"） | ✅ | `"downstream"` |
| 13 | And 机检：counters.dispatchCount 仍为 2（期望 2） | ✅ | `2` |

**⑤ 判定**：通过

---

#### AC-42 派发失败 → 升级挂起，不假装执行中

- 判定：**通过**（核对 15/15 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-42`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario dispatch-fail-first（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-42 --scenario dispatch-fail-first   | cwd=D:\WWW\Maestro | exit=4 | 801ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-42 | exit=0 | 209ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-42 | exit=0 | 187ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-42.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 dispatch-fail-first 已完整跑完
Then 命令在 30 秒内结束，退出码是 4
And 输出的最后三行依次是挂起收尾三行，第一行含"实例 INST-001 · 已挂起 · 模板 通用任务闭环"
When 我执行 orch status --instance INST-001
Then 输出含"原因：派遣失败：目标会话不可用"与"节点 T-001 研究员 已升级"
And 机检：实例 state='suspended'；T-001 state='escalated'；escalations[0].reasonCode='dispatch_failed'
And 机检：counters.dispatchCount=1；sessions 为空（首派会话没建起来）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-42.state.json` | 2447 B |
| `docs/iterations/iteration-3/evidence/AC-42.events.jsonl` | 1103 B |
| `docs/iterations/iteration-3/evidence/AC-42.meta.json` | 699 B |
| `docs/iterations/iteration-3/evidence/AC-42.output.json` | 5742 B |
| `docs/iterations/iteration-3/evidence/AC-42.status.txt` | 1431 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 命令在 30 秒内结束（实测 801ms） | ✅ | `801ms` |
| 2 | Then 退出码是 4（期望 4） | ✅ | `4` |
| 3 | And 输出末尾是三行挂起收尾（不打印节点表其余行） | ✅ | `3 行：实例 INST-001 · 已挂起 · 模板 通用任务闭环 / 升级 ESC-001 待处理 · 节点 T-001 研究员 · 第 1 轮 / 下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001` |
| 4 | And 第 1 行「实例 INST-001 · 已挂起 · 模板 通用任务闭环」（期望 "实例 INST-001 · 已挂起 · 模板 通用任务闭环"） | ✅ | `"实例 INST-001 · 已挂起 · 模板 通用任务闭环"` |
| 5 | And 第 2 行「升级 … 待处理 · 节点 T-001 研究员 · 第 1 轮」（期望匹配 /^升级 ESC-\d+ 待处理 · 节点 T-001 研究员 · 第 1 轮$/） | ✅ | `升级 ESC-001 待处理 · 节点 T-001 研究员 · 第 1 轮` |
| 6 | And 第 3 行「下一步：…」（期望 "下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001"） | ✅ | `"下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001"` |
| 7 | Then 输出含「原因：派遣失败：目标会话不可用」（期望含 "原因：派遣失败：目标会话不可用"） | ✅ | `  原因：派遣失败：目标会话不可用` |
| 8 | Then 输出含「节点 T-001 研究员 已升级」（期望含 "节点 T-001 研究员 已升级"） | ✅ | `节点 T-001 研究员 已升级 · 第 1 轮` |
| 9 | And 机检：实例 state='suspended'（期望 "suspended"） | ✅ | `"suspended"` |
| 10 | And 机检：T-001 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 11 | And 机检：escalations[0].reasonCode='dispatch_failed'（期望 "dispatch_failed"） | ✅ | `"dispatch_failed"` |
| 12 | And 机检：counters.dispatchCount=1（期望 1） | ✅ | `1` |
| 13 | And 机检：sessions 为空（首派会话没建起来）（期望 0） | ✅ | `0` |
| 14 | 佐证：events 中没有 handoff.created（首派失败不建交接包）（期望 0） | ✅ | `0` |
| 15 | 佐证：events 中 node.dispatch 只有 1 条（第 1 轮首派）（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-43 回合执行失败 → 升级挂起，不回流

- 判定：**通过**（核对 17/17 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-43`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[driver --scenario execution-fail（完整跑完）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-43 --scenario execution-fail   | cwd=D:\WWW\Maestro | exit=4 | 1287ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-43 | exit=0 | 213ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-43 | exit=0 | 180ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-43.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 夹具场景 execution-fail 已完整跑完
Then 命令在 30 秒内结束，退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：执行失败："与"节点 T-002 撰写者 已升级"
And 机检：实例 state='suspended'；T-001 state='review'、reviewReason='downstream'；T-002 state='escalated'；escalations[0].reasonCode='execution_failed'
And 机检：HO-001 state='delivered'（T-002 未发出任何回合事件，上游尚未转 done）
And 机检：counters.dispatchCount=2；没有 HO-002，也没有第 3 次派发
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-43.state.json` | 4837 B |
| `docs/iterations/iteration-3/evidence/AC-43.events.jsonl` | 3628 B |
| `docs/iterations/iteration-3/evidence/AC-43.meta.json` | 696 B |
| `docs/iterations/iteration-3/evidence/AC-43.output.json` | 5899 B |
| `docs/iterations/iteration-3/evidence/AC-43.status.txt` | 1937 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 命令在 30 秒内结束（实测 1287ms） | ✅ | `1287ms` |
| 2 | Then 退出码是 4（期望 4） | ✅ | `4` |
| 3 | Then 输出含「原因：执行失败：」（期望含 "原因：执行失败："） | ✅ | `  原因：执行失败：mock-host: upstream model request failed (code 500)` |
| 4 | Then 输出含「节点 T-002 撰写者 已升级」（期望含 "节点 T-002 撰写者 已升级"） | ✅ | `节点 T-002 撰写者 已升级 · 第 1 轮` |
| 5 | Then 原因行带宿主原文（mock-host: upstream model request failed）（期望含 "upstream model request failed"） | ✅ | `  原因：执行失败：mock-host: upstream model request failed (code 500)` |
| 6 | And 机检：实例 state='suspended'（期望 "suspended"） | ✅ | `"suspended"` |
| 7 | And 机检：T-001 state='review'（期望 "review"） | ✅ | `"review"` |
| 8 | And 机检：T-001 reviewReason='downstream'（期望 "downstream"） | ✅ | `"downstream"` |
| 9 | And 机检：T-002 state='escalated'（期望 "escalated"） | ✅ | `"escalated"` |
| 10 | And 机检：escalations[0].reasonCode='execution_failed'（期望 "execution_failed"） | ✅ | `"execution_failed"` |
| 11 | And 机检：HO-001 state='delivered'（期望 "delivered"） | ✅ | `"delivered"` |
| 12 | And 机检：T-001 未转 done（没有 review.evidence_verified 之外的 done 事件） | ✅ | `review` |
| 13 | And 机检：counters.dispatchCount=2（期望 2） | ✅ | `2` |
| 14 | And 机检：没有 HO-002 | ✅ | `HO-001` |
| 15 | And 机检：events 中 node.dispatch 恰好 2 条（没有第 3 次派发）（期望 2） | ✅ | `2` |
| 16 | And 机检：events 中没有 backflow.constructed（执行失败不回流）（期望 0） | ✅ | `0` |
| 17 | And 机检：events 中没有 handoff.created 的第 2 张（不构造 HO-002）（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-44 任务目录不可写 / 工作区建不出来 → 发起前停住，退出码 3

- 判定：**通过**（核对 15/15 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-a`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch run --template task-loop --cwd ./no-such-dir --task "写发布说明。产物：release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --template task-loop --cwd ./no-such-dir --task 写发布说明。产物：release-notes.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-a | exit=3 | 205ms
[orch core stop（根 B 冷启动前置：确认没有正在运行的核心）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b | exit=0 | 98ms
[MAESTRO_FAULT=workspace_init:fail orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --template task-loop --cwd ./demo-doc --task 写发布说明。产物：release-notes.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b | exit=3 | 213ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-a | exit=0 | 188ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b | exit=0 | 199ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-44.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根 A，其中不存在名为 no-such-dir 的目录
When 我执行 orch run --template task-loop --cwd ./no-such-dir --task "写发布说明。产物：release-notes.md"
Then 那一行以"工作目录不可写："开头、以"no-such-dir"结尾（冒号后是 CLI 解析过的**绝对路径**，不是原样的 `./no-such-dir`，见 D-5）；退出码 3
And 机检：`.orch/instances` 不存在或为空目录；`.orch/instances/INST-001` 不存在
Given 另起全新项目根 B，我先 mkdir -p demo-doc 建好任务目录，并确认**根 B 下没有正在运行的核心**（管道按项目根隔离，全新根天然是冷启动；只有在同一根里紧跟着别的场景跑过时，才需要先在该根执行 `orch core stop`）
When 我在 Git Bash 下执行 MAESTRO_FAULT=workspace_init:fail orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"
Then 输出含"无法创建工作区：注入故障（workspace_init:fail）"，退出码 3
And 机检：`.orch/instances` 为空——本次新建的 `.orch/instances/INST-001` 已被删除，不留 `workspace/` 空壳、不写 state.json
And 机检：`.mock/prompts` 不存在或为空（没有发起任何会话）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-44.state.json` | 5 B |
| `docs/iterations/iteration-3/evidence/AC-44.events.jsonl` | 0 B |
| `docs/iterations/iteration-3/evidence/AC-44.meta.json` | 972 B |
| `docs/iterations/iteration-3/evidence/AC-44.output.json` | 6088 B |
| `docs/iterations/iteration-3/evidence/AC-44.status.txt` | 1726 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 3（期望 3） | ✅ | `3` |
| 2 | Then 输出单行（期望 1） | ✅ | `1` |
| 3 | Then 那一行以「工作目录不可写：」开头 | ✅ | `工作目录不可写：C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-a\no-such-dir` |
| 4 | Then 那一行以「no-such-dir」结尾（冒号后是绝对路径） | ✅ | `工作目录不可写：C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-a\no-such-dir` |
| 5 | And 机检：.orch/instances 不存在或为空目录 | ✅ | `存在，0 项` |
| 6 | And 机检：.orch/instances/INST-001 不存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-a\.orch\instances\INST-001` |
| 7 | Given 前置：根 B 下没有正在运行的核心（期望含 "核心未在运行"） | ✅ | `核心未在运行<br>` |
| 8 | Then 输出含「无法创建工作区：注入故障（workspace_init:fail）」（期望含 "无法创建工作区：注入故障（workspace_init:fail）"） | ✅ | `无法创建工作区：注入故障（workspace_init:fail）` |
| 9 | Then 退出码 3（期望 3） | ✅ | `3` |
| 10 | And 机检：.orch/instances 为空（本次新建的 INST-001 已删除） | ✅ | `存在，0 项` |
| 11 | And 机检：没有 INST-001 目录 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b\.orch\instances\INST-001` |
| 12 | And 机检：不留 workspace/ 空壳 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b\.orch\instances\INST-001\workspace` |
| 13 | And 机检：没有写 state.json | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-44-b\.orch\instances\INST-001\state.json` |
| 14 | And 机检：.mock/prompts 不存在或为空（没有发起任何会话） | ✅ | `不存在` |
| 15 | And 机检：根 B 实例列表为空（期望 "（空）"） | ✅ | `"（空）"` |

**⑤ 判定**：通过

**备注**

- 分支 B 的 MAESTRO_FAULT 只在核心冷启动时读一次：根 B 为全新根，core stop 明确回「核心未在运行」（无热核心），因此注入必然生效；跑前没有旧核心残留。

---

#### AC-45 停在"待校验（等待下游）"：核心活着能取消，重启后记成已中断且不重复派发

- 判定：**通过**（核对 44/44 通过）
- 验证面：夹具
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-a`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-b`
- 实例：INST-001、INST-001

**① 完整命令（逐条可复跑）**

```
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-a | exit=0 | 199ms
[orch status --instance INST-001（重启后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-a | exit=0 | 215ms
[orch cancel --instance INST-001（已中断后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-a | exit=1 | 85ms
[driver --scenario doc-pass --stop-after 2 --keep（根 A；已停核心回收）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-a --scenario doc-pass --keep --stop-after 2   | cwd=D:\WWW\Maestro | exit=13 | 1912ms
[orch cancel --instance INST-001（核心活着）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-b | exit=0 | 103ms
[orch status --instance INST-001（取消后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-b | exit=0 | 87ms
[driver --scenario doc-pass --stop-after 2 --keep（根 B；长驻进程由脚手架终止）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-b --scenario doc-pass --keep --stop-after 2   | cwd=D:\WWW\Maestro | exit=13 | 1975ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-a | exit=0 | 94ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p3\AC-45-b | exit=0 | 81ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-3/evidence/AC-45.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then，逐字）**

```gherkin
Given 全新项目根 A，夹具场景 doc-pass 已用 --stop-after 2 --keep 停在"T-002 核对通过、下游尚未派发"
And 机检：`.mock/stopped-after-2` 存在
And 机检：T-001 state='done'；T-002 state='review'、reviewReason='downstream'；handoffs 只有 HO-001 且 state='consumed'
When 我执行 orch core stop
And 我重新执行一次 orch status --instance INST-001（必要时自动拉起核心）
Then 输出含"实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游"（停点是真正卡住的 T-002，不是节点表第一条 T-001）
And "实例 INST-001 · 已中断"这一行只出现 1 次（已中断时不再单独重复实例行，编码闭环 C-7 的既有版式）
And 输出含"节点 T-001 研究员 已完成 · 第 1 轮"
And 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"，不含"节点 T-002 撰写者 已完成"
And 输出含"会话 等待下游"与"交接包 HO-001  研究员→撰写者  已完成"
And 机检：实例 state='interrupted'；T-002 仍是 'review' 且 reviewReason='downstream'；T-001 仍是 'done'；HO-001 仍是 'consumed'
And 机检：相对停核心之前只多出 1 条 instance 层迁到 'interrupted' 的事件；没有新增 node.dispatch、handoff.created 或 review.evidence_verified
When 我执行 orch cancel --instance INST-001
Then 输出含"实例已结束（已中断），无需取消"，退出码 1
And 机检：这次取消没有改写任何节点、交接包或会话状态
Given 另起全新项目根 B，夹具场景 doc-pass 同样以 --stop-after 2 --keep 停在同一刻（核心**不停**）
When 我执行 orch cancel --instance INST-001
Then 命令在 5 秒内结束，退出码 0
And 机检：实例 state='cancelled'；T-001 state='done'（已完成节点保持）；T-002 state='cancelled'
And 机检：T-002 的 reviewReason 在取消落盘后为 null；HO-001 仍为 'consumed'（已消费的交接包不撤回）
And 机检：T-002 的 endedAt 非空（被派发过的节点取消后一定有耗时，`src/core/orchestrator.js:2502`）
And 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency
When 我执行 orch status --instance INST-001
Then 输出含"实例 INST-001 · 已取消"与"节点 T-002 撰写者 已取消"，且不再出现交接包等待行
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-3/evidence/AC-45.state.live.json` | 5183 B |
| `docs/iterations/iteration-3/evidence/AC-45.state.json` | 12677 B |
| `docs/iterations/iteration-3/evidence/AC-45.events.jsonl` | 12622 B |
| `docs/iterations/iteration-3/evidence/AC-45.meta.json` | 1324 B |
| `docs/iterations/iteration-3/evidence/AC-45.output.json` | 16792 B |
| `docs/iterations/iteration-3/evidence/AC-45.status.txt` | 5249 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 机检：.mock/stopped-after-2 存在 | ✅ | `989ms` |
| 2 | Given 机检：T-001 state='done'（期望 "done"） | ✅ | `"done"` |
| 3 | Given 机检：T-002 state='review'（期望 "review"） | ✅ | `"review"` |
| 4 | Given 机检：T-002 reviewReason='downstream'（期望 "downstream"） | ✅ | `"downstream"` |
| 5 | Given 机检：handoffs 只有 HO-001 且 state='consumed'（期望 "HO-001:consumed"） | ✅ | `"HO-001:consumed"` |
| 6 | When core stop 退出码 0（期望 0） | ✅ | `0` |
| 7 | When 输出含「核心已停止」（期望含 "核心已停止"） | ✅ | `核心已停止（pid 2312，运行 1s）<br>` |
| 8 | Then status 退出码 0（期望 0） | ✅ | `0` |
| 9 | Then 输出含「实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游」（期望含 "实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游"） | ✅ | `实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游` |
| 10 | Then「实例 INST-001 · 已中断」只出现 1 次（期望 1） | ✅ | `1` |
| 11 | Then 输出含「节点 T-001 研究员 已完成 · 第 1 轮」（期望含 "节点 T-001 研究员 已完成 · 第 1 轮"） | ✅ | `节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md` |
| 12 | Then 输出含「节点 T-002 撰写者 待校验（等待下游） · 第 1 轮」（期望含 "节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"） | ✅ | `节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s` |
| 13 | Then 不含「节点 T-002 撰写者 已完成」（期望不含 "节点 T-002 撰写者 已完成"） | ✅ | `实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游<br>节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 1s · 产物 artifacts/reports/research-notes.v1.md<br>节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 1s<br>节点 T-003 审核者 待执行<br>会话 等待下游<br>交接包 HO-001  研究员→撰写者  已构造   22:08:56<br>交接包 HO-001  研究员→撰写者  已投递  ` |
| 14 | Then 输出含「会话 等待下游」（期望含 "会话 等待下游"） | ✅ | `实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游` |
| 15 | Then 输出含「交接包 HO-001  研究员→撰写者  已完成」（期望含 "交接包 HO-001  研究员→撰写者  已完成"） | ✅ | `交接包 HO-001  研究员→撰写者  已完成   22:08:57` |
| 16 | And 机检：实例 state='interrupted'（期望 "interrupted"） | ✅ | `"interrupted"` |
| 17 | And 机检：T-002 仍是 'review'（期望 "review"） | ✅ | `"review"` |
| 18 | And 机检：T-002 reviewReason 仍为 'downstream'（期望 "downstream"） | ✅ | `"downstream"` |
| 19 | And 机检：T-001 仍是 'done'（期望 "done"） | ✅ | `"done"` |
| 20 | And 机检：HO-001 仍是 'consumed'（期望 "consumed"） | ✅ | `"consumed"` |
| 21 | And 机检：重启只多出 1 条事件（期望 1） | ✅ | `1` |
| 22 | And 机检：新增事件是 instance → interrupted（期望 "instance:interrupted"） | ✅ | `"instance:interrupted"` |
| 23 | And 机检：没有新增 node.dispatch（期望 0） | ✅ | `0` |
| 24 | And 机检：没有新增 handoff.created（期望 0） | ✅ | `0` |
| 25 | And 机检：没有新增 review.evidence_verified（期望 0） | ✅ | `0` |
| 26 | Then 输出含「实例已结束（已中断），无需取消」（期望含 "实例已结束（已中断），无需取消"） | ✅ | `实例已结束（已中断），无需取消` |
| 27 | Then 退出码 1（期望 1） | ✅ | `1` |
| 28 | And 机检：这次取消没有改写 state.json（字节不变）（期望 "f3fdd7919e031e6665eca81c06fe7a00c3f6a47a8d9a6001df1e1eda1f5bef3a"） | ✅ | `"f3fdd7919e031e6665eca81c06fe7a00c3f6a47a8d9a6001df1e1eda1f5bef3a"` |
| 29 | And 机检：节点/交接包未变（期望 "T-001:done,T-002:review,T-003:pending\|HO-001:consumed"） | ✅ | `"T-001:done,T-002:review,T-003:pending\|HO-001:consumed"` |
| 30 | And 机检：会话状态未变（期望 "idle,waiting_dependency"） | ✅ | `"idle,waiting_dependency"` |
| 31 | Given 机检（根 B）：.mock/stopped-after-2 存在（核心不停） | ✅ | `1087ms` |
| 32 | Given 机检（根 B）：T-002 state='review' / reviewReason='downstream'（期望 "review/downstream"） | ✅ | `"review/downstream"` |
| 33 | Then 命令在 5 秒内结束（实测 103ms） | ✅ | `103ms` |
| 34 | Then 退出码 0（期望 0） | ✅ | `0` |
| 35 | And 机检：实例 state='cancelled'（期望 "cancelled"） | ✅ | `"cancelled"` |
| 36 | And 机检：T-001 state='done'（已完成节点保持）（期望 "done"） | ✅ | `"done"` |
| 37 | And 机检：T-002 state='cancelled'（期望 "cancelled"） | ✅ | `"cancelled"` |
| 38 | And 机检：T-002 reviewReason 取消落盘后为 null（期望 null） | ✅ | `null` |
| 39 | And 机检：HO-001 仍为 'consumed'（已消费的交接包不撤回）（期望 "consumed"） | ✅ | `"consumed"` |
| 40 | And 机检：T-002 endedAt 非空（派发过的节点取消后有耗时） | ✅ | `2026-11-06T14:08:59.310Z` |
| 41 | And 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency（期望 "（无）"） | ✅ | `"（无）"` |
| 42 | Then 输出含「实例 INST-001 · 已取消」（期望含 "实例 INST-001 · 已取消"） | ✅ | `实例 INST-001 · 已取消 · 模板 通用任务闭环` |
| 43 | Then 输出含「节点 T-002 撰写者 已取消」（期望含 "节点 T-002 撰写者 已取消"） | ✅ | `节点 T-002 撰写者 已取消 · 第 1 轮 · 耗时 1s` |
| 44 | Then 不再出现交接包等待行（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

**备注**

- 根 B 的 orch cancel 实测耗时：103ms（硬指标 5000ms）
- 两支顺序固定：A 先在核心活着时 core stop（对账成终态 interrupted）→ status 看停点 → cancel 被拒；B 核心不停直接 cancel。停点提示点名的是真正卡住的 T-002（interruptedNodeId），不是节点表第一条 T-001。

---

## 2. 未通过 / 阻塞项汇总

（无未通过 / 阻塞项）

## 3. 证据索引

共 274 个文件；每条 AC 至少 `state.json` / `events.jsonl` / `meta.json` / `output.json` / `status.txt`（无实例时 state 为 null）。

| AC | 证据文件 |
|---|---|
| AC-01 | `evidence/AC-01.events.jsonl`<br>`evidence/AC-01.meta.json`<br>`evidence/AC-01.output.json`<br>`evidence/AC-01.state.json`<br>`evidence/AC-01.state.live.json`<br>`evidence/AC-01.status.txt` |
| AC-02 | `evidence/AC-02.events.jsonl`<br>`evidence/AC-02.meta.json`<br>`evidence/AC-02.output.json`<br>`evidence/AC-02.state.json`<br>`evidence/AC-02.state.live.json`<br>`evidence/AC-02.status.txt` |
| AC-03 | `evidence/AC-03.events.jsonl`<br>`evidence/AC-03.meta.json`<br>`evidence/AC-03.output.json`<br>`evidence/AC-03.state.json`<br>`evidence/AC-03.status.txt` |
| AC-04 | `evidence/AC-04.events.jsonl`<br>`evidence/AC-04.meta.json`<br>`evidence/AC-04.output.json`<br>`evidence/AC-04.state.a-evidence.json`<br>`evidence/AC-04.state.b-downstream.json`<br>`evidence/AC-04.state.json`<br>`evidence/AC-04.status.txt` |
| AC-05 | `evidence/AC-05.events.jsonl`<br>`evidence/AC-05.meta.json`<br>`evidence/AC-05.output.json`<br>`evidence/AC-05.state.json`<br>`evidence/AC-05.status.txt` |
| AC-06 | `evidence/AC-06.events.jsonl`<br>`evidence/AC-06.meta.json`<br>`evidence/AC-06.output.json`<br>`evidence/AC-06.state.json`<br>`evidence/AC-06.status.txt` |
| AC-07 | `evidence/AC-07.events.jsonl`<br>`evidence/AC-07.meta.json`<br>`evidence/AC-07.output.json`<br>`evidence/AC-07.state.json`<br>`evidence/AC-07.state.live.json`<br>`evidence/AC-07.status.txt` |
| AC-08 | `evidence/AC-08.events.jsonl`<br>`evidence/AC-08.meta.json`<br>`evidence/AC-08.output.json`<br>`evidence/AC-08.state.json`<br>`evidence/AC-08.state.live.json`<br>`evidence/AC-08.status.txt` |
| AC-09 | `evidence/AC-09.events.jsonl`<br>`evidence/AC-09.meta.json`<br>`evidence/AC-09.output.json`<br>`evidence/AC-09.state.json`<br>`evidence/AC-09.status.txt` |
| AC-10 | `evidence/AC-10.events.jsonl`<br>`evidence/AC-10.meta.json`<br>`evidence/AC-10.output.json`<br>`evidence/AC-10.state.json`<br>`evidence/AC-10.state.live.json`<br>`evidence/AC-10.status.txt` |
| AC-11 | `evidence/AC-11.events.jsonl`<br>`evidence/AC-11.meta.json`<br>`evidence/AC-11.output.json`<br>`evidence/AC-11.state.after-wait.json`<br>`evidence/AC-11.state.before-wait.json`<br>`evidence/AC-11.state.json`<br>`evidence/AC-11.status.txt` |
| AC-12 | `evidence/AC-12.events.jsonl`<br>`evidence/AC-12.meta.json`<br>`evidence/AC-12.output.json`<br>`evidence/AC-12.state.after-restart.json`<br>`evidence/AC-12.state.before-restart.json`<br>`evidence/AC-12.state.json`<br>`evidence/AC-12.status.txt` |
| AC-13 | `evidence/AC-13.events.jsonl`<br>`evidence/AC-13.meta.json`<br>`evidence/AC-13.output.json`<br>`evidence/AC-13.state.json`<br>`evidence/AC-13.status.txt` |
| AC-14 | `evidence/AC-14.events.jsonl`<br>`evidence/AC-14.meta.json`<br>`evidence/AC-14.output.json`<br>`evidence/AC-14.state.json`<br>`evidence/AC-14.status.txt` |
| AC-15 | `evidence/AC-15.events.jsonl`<br>`evidence/AC-15.meta.json`<br>`evidence/AC-15.output.json`<br>`evidence/AC-15.state.json`<br>`evidence/AC-15.status.txt` |
| AC-16 | `evidence/AC-16.events.jsonl`<br>`evidence/AC-16.meta.json`<br>`evidence/AC-16.output.json`<br>`evidence/AC-16.state.json`<br>`evidence/AC-16.status.txt` |
| AC-17 | `evidence/AC-17.events.jsonl`<br>`evidence/AC-17.meta.json`<br>`evidence/AC-17.output.json`<br>`evidence/AC-17.state.json`<br>`evidence/AC-17.status.txt` |
| AC-18 | `evidence/AC-18.events.jsonl`<br>`evidence/AC-18.meta.json`<br>`evidence/AC-18.output.json`<br>`evidence/AC-18.state.json`<br>`evidence/AC-18.status.txt` |
| AC-19 | `evidence/AC-19.events.jsonl`<br>`evidence/AC-19.meta.json`<br>`evidence/AC-19.output.json`<br>`evidence/AC-19.state.json`<br>`evidence/AC-19.status.txt` |
| AC-20 | `evidence/AC-20.events.jsonl`<br>`evidence/AC-20.meta.json`<br>`evidence/AC-20.output.json`<br>`evidence/AC-20.state.json`<br>`evidence/AC-20.status.txt` |
| AC-21 | `evidence/AC-21.events.jsonl`<br>`evidence/AC-21.meta.json`<br>`evidence/AC-21.output.json`<br>`evidence/AC-21.state.json`<br>`evidence/AC-21.status.txt` |
| AC-22 | `evidence/AC-22.events.jsonl`<br>`evidence/AC-22.meta.json`<br>`evidence/AC-22.output.json`<br>`evidence/AC-22.state.json`<br>`evidence/AC-22.status.txt` |
| AC-23 | `evidence/AC-23.events.jsonl`<br>`evidence/AC-23.meta.json`<br>`evidence/AC-23.output.json`<br>`evidence/AC-23.state.json`<br>`evidence/AC-23.status.txt` |
| AC-24 | `evidence/AC-24.events.jsonl`<br>`evidence/AC-24.meta.json`<br>`evidence/AC-24.output.json`<br>`evidence/AC-24.state.json`<br>`evidence/AC-24.status.txt` |
| AC-25 | `evidence/AC-25.events.jsonl`<br>`evidence/AC-25.meta.json`<br>`evidence/AC-25.output.json`<br>`evidence/AC-25.state.json`<br>`evidence/AC-25.status.txt` |
| AC-26 | `evidence/AC-26.events.jsonl`<br>`evidence/AC-26.meta.json`<br>`evidence/AC-26.output.json`<br>`evidence/AC-26.state.json`<br>`evidence/AC-26.status.txt` |
| AC-27 | `evidence/AC-27.events.jsonl`<br>`evidence/AC-27.meta.json`<br>`evidence/AC-27.output.json`<br>`evidence/AC-27.state.json`<br>`evidence/AC-27.status.txt` |
| AC-28 | `evidence/AC-28.events.jsonl`<br>`evidence/AC-28.meta.json`<br>`evidence/AC-28.output.json`<br>`evidence/AC-28.state.before-cancel.json`<br>`evidence/AC-28.state.json`<br>`evidence/AC-28.status.txt` |
| AC-29 | `evidence/AC-29.events.jsonl`<br>`evidence/AC-29.meta.json`<br>`evidence/AC-29.output.json`<br>`evidence/AC-29.state.json`<br>`evidence/AC-29.status.txt` |
| AC-30 | `evidence/AC-30.events.jsonl`<br>`evidence/AC-30.meta.json`<br>`evidence/AC-30.output.json`<br>`evidence/AC-30.state.after-stop.json`<br>`evidence/AC-30.state.halted.json`<br>`evidence/AC-30.state.json`<br>`evidence/AC-30.status.txt` |
| AC-31 | `evidence/AC-31.events.jsonl`<br>`evidence/AC-31.meta.json`<br>`evidence/AC-31.output.json`<br>`evidence/AC-31.state.json`<br>`evidence/AC-31.status.txt` |
| AC-32 | `evidence/AC-32.events.jsonl`<br>`evidence/AC-32.meta.json`<br>`evidence/AC-32.output.json`<br>`evidence/AC-32.state.json`<br>`evidence/AC-32.state.stopped-after-4.json`<br>`evidence/AC-32.status.txt` |
| AC-33 | `evidence/AC-33.events.jsonl`<br>`evidence/AC-33.meta.json`<br>`evidence/AC-33.output.json`<br>`evidence/AC-33.state.json`<br>`evidence/AC-33.status.txt` |
| AC-34 | `evidence/AC-34.events.jsonl`<br>`evidence/AC-34.meta.json`<br>`evidence/AC-34.output.json`<br>`evidence/AC-34.state.json`<br>`evidence/AC-34.status.txt` |
| AC-35 | `evidence/AC-35.events.jsonl`<br>`evidence/AC-35.meta.json`<br>`evidence/AC-35.output.json`<br>`evidence/AC-35.state.json`<br>`evidence/AC-35.status.txt` |
| AC-36 | `evidence/AC-36.events.jsonl`<br>`evidence/AC-36.meta.json`<br>`evidence/AC-36.output.json`<br>`evidence/AC-36.state.json`<br>`evidence/AC-36.status.txt` |
| AC-37 | `evidence/AC-37.events.jsonl`<br>`evidence/AC-37.meta.json`<br>`evidence/AC-37.output.json`<br>`evidence/AC-37.state.json`<br>`evidence/AC-37.status.txt` |
| AC-38 | `evidence/AC-38.events.jsonl`<br>`evidence/AC-38.meta.json`<br>`evidence/AC-38.output.json`<br>`evidence/AC-38.state.json`<br>`evidence/AC-38.status.txt` |
| AC-39 | `evidence/AC-39.events.jsonl`<br>`evidence/AC-39.meta.json`<br>`evidence/AC-39.output.json`<br>`evidence/AC-39.state.json`<br>`evidence/AC-39.status.txt` |
| AC-40 | `evidence/AC-40.attempt1.events.jsonl`<br>`evidence/AC-40.attempt1.review.json`<br>`evidence/AC-40.attempt1.reviewer.excerpt.jsonl`<br>`evidence/AC-40.attempt1.state.json`<br>`evidence/AC-40.attempt1.status-events.txt`<br>`evidence/AC-40.attempt2.events.jsonl`<br>`evidence/AC-40.attempt2.output.txt`<br>`evidence/AC-40.attempt2.review.json`<br>`evidence/AC-40.attempt2.state.json`<br>`evidence/AC-40.attempt2.status-events.txt`<br>`evidence/AC-40.events.jsonl`<br>`evidence/AC-40.final.events.jsonl`<br>`evidence/AC-40.final.state.json`<br>`evidence/AC-40.host.json`<br>`evidence/AC-40.meta.json`<br>`evidence/AC-40.output.json`<br>`evidence/AC-40.prompt.review.txt`<br>`evidence/AC-40.review.round1.json`<br>`evidence/AC-40.review.round2.json`<br>`evidence/AC-40.reviewer.round1.excerpt.jsonl`<br>`evidence/AC-40.reviewer.round2.excerpt.jsonl`<br>`evidence/AC-40.run.output.txt`<br>`evidence/AC-40.state.json`<br>`evidence/AC-40.status-events.txt`<br>`evidence/AC-40.status.txt`<br>`evidence/AC-40b.final.events.jsonl`<br>`evidence/AC-40b.final.state.json`<br>`evidence/AC-40b.host.json`<br>`evidence/AC-40b.meta.json`<br>`evidence/AC-40b.prompt.review.txt`<br>`evidence/AC-40b.review.round1.json`<br>`evidence/AC-40b.review.round2.json`<br>`evidence/AC-40b.reviewer.round1.excerpt.jsonl`<br>`evidence/AC-40b.reviewer.round2.excerpt.jsonl`<br>`evidence/AC-40b.run.output.txt`<br>`evidence/AC-40b.run.timing.txt`<br>`evidence/AC-40b.status-events.txt`<br>`evidence/AC-40b.workspace-probe.txt` |
| AC-41 | `evidence/AC-41.events.jsonl`<br>`evidence/AC-41.meta.json`<br>`evidence/AC-41.output.json`<br>`evidence/AC-41.state.json`<br>`evidence/AC-41.status.txt` |
| AC-42 | `evidence/AC-42.events.jsonl`<br>`evidence/AC-42.meta.json`<br>`evidence/AC-42.output.json`<br>`evidence/AC-42.state.json`<br>`evidence/AC-42.status.txt` |
| AC-43 | `evidence/AC-43.events.jsonl`<br>`evidence/AC-43.meta.json`<br>`evidence/AC-43.output.json`<br>`evidence/AC-43.state.json`<br>`evidence/AC-43.status.txt` |
| AC-44 | `evidence/AC-44.events.jsonl`<br>`evidence/AC-44.meta.json`<br>`evidence/AC-44.output.json`<br>`evidence/AC-44.state.json`<br>`evidence/AC-44.status.txt` |
| AC-45 | `evidence/AC-45.events.jsonl`<br>`evidence/AC-45.meta.json`<br>`evidence/AC-45.output.json`<br>`evidence/AC-45.state.json`<br>`evidence/AC-45.state.live.json`<br>`evidence/AC-45.status.txt` |
