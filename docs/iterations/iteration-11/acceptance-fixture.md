# I1.11 验收记录 · 批次 A+B（AC-01~AC-26）

> 依据：`docs/iterations/iteration-11/requirement.md` v10 §3.1（AC-01~13 逐字 Given/When/Then/机检/夹具/架构检查）、附录 A-1~A-4（输出逐字基线）、`decisions.md`（D-39 / D-45 / D-46 / D-52 / D-53）。
> 执行：darwin / Node v22.22.2 / 仓库 `/Users/xuesh/www/Maestro` / HEAD `2a829da`；每条 AC 一个独立根，机检「先 test -f 再 node --test」，一律 `NODE_ENV=test`。
> 生成：`probe/acc11-f-run.mjs --batch a` 逐条取证（evidence + parts + results.jsonl）→ 本脚本重建。判定只认需求 Then/And；证据分级：已实测（真实宿主）/ mock 实测 / 阻塞。

## 0. 总判

**批次 A+B 26 条：通过 26 / 不通过 0 / 阻塞 0**

- 已产出证据：26 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-11/evidence/` 下 291 个（覆盖 26 条 AC）。
- 不通过 / 阻塞条目：无。
- 机器可读汇总：`probe/acc11-f-summary.json`；单条中间结论：`probe/acc11-f-parts/<AC>.md`；缺陷台账：`probe/acc11-f-blockers.md`。

## 1. AC 逐条记录


#### AC-01 升级待处理时托盘通知（规划验收句第 1 句）

- 判定：**通过**（核对 18/18 通过）
- 证据分级：**mock 实测**
- 验证面：通知 / 机检 + 原始帧
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify` 项目根，mock 宿主，应用已启动并缩到托盘（主窗口不可见），探针文件已就绪；一个运行中的实例 `INST-001`（`single` 模板，唯一节点 `T-001` 已派发，角色 `worker` / 中文名「执行者」，第 1 轮）；`NODE_ENV=test`。
- When 经测试接缝让 `T-001` 升级（`reasonCode: "execution_failed"`，等价于真实"执行失败"触发的升级创建）。
- Then 2 秒内系统托盘出现一条通知，标题为附录 A-1 的升级标题，正文为 A-1 的**五段固定段序**且逐字匹配：`实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · {原因摘要}`（第 5 段取夹具 `reasonDetail` 的实际值，按 A-0 可变值替换）；探针追加一条通知意图事件与一条投递结果事件；正文里没有任何会话内容、日志正文或产物内容；**触发通知前后，该实例的节点 / 会话 / 交接包 / 升级 / 审批五组状态逐值不变**（通知只触达、不改状态）。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言探针出现 `{"event":"notify","kind":"escalation","instanceId":"INST-001","escalationId":"ESC-001"}` 且 `notify.t - trigger.t ≤ 2000`；紧随其后出现 `{"event":"notify-delivered","kind":"escalation"}`；通知标题与正文逐字匹配附录 A-1（可变值按 A-0 替换），并断言正文按 ` · ` 切分**恰为 5 段**、第 1 段 `实例 INST-001`、第 2 段 `升级 ESC-001`、第 3 段逐字 `节点 T-001 执行者`、第 4 段 `第 1 轮`；五组状态在触发前后的导出 `deepEqual`；`# pass ≥ 1`、`# fail 0`。,
**架构检查原文**：通知只能由守护进程的既有事件总线派生；`grep -REn "new EventEmitter|setInterval" src/daemon/notify.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1124ms
[frame-dump notify ac01] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac01 | exit=0 | 125ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1124ms
[架构#1] grep -REn "new EventEmitter|setInterval" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.frame.json` | 591 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.test-stdout.txt` | 4939 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.state.json` | 591 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.meta.json` | 1539 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.check.json` | 8259 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.output.json` | 14171 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=时不发过期意图<br>  ---<br>  duration_ms: 32.444031<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 39.19095<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-01 架构检查：notify.js 无定时器/事件总线直调，零命中（exit 1） | ✅ | ``grep -REn "new EventEmitter\|setInterval" src/daemon/notify.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 意图 kind=escalation（逐字）（期望逐字 "escalation"） | ✅ | `"escalation"` | `"escalation"` |
| 7 | 意图 instanceId=INST-001（逐字）（期望逐字 "INST-001"） | ✅ | `"INST-001"` | `"INST-001"` |
| 8 | 标题逐字 A-1 升级标题（期望逐字 "通知 升级待处理 · INST-001"） | ✅ | `"通知 升级待处理 · INST-001"` | `"通知 升级待处理 · INST-001"` |
| 9 | 正文逐字 A-1 五段（single：T-001 执行者 / 第 1 轮 / reasonDetail）（期望逐字 "实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · 执行失败：测试未通过"） | ✅ | `"实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · 执行失败：测试未通过"` | `"实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · 执行失败：测试未通过"` |
| 10 | 正文按 " · " 切分恰为 5 段（期望逐字 5） | ✅ | `5` | `5` |
| 11 | 第 1 段逐字 实例 INST-001（期望逐字 "实例 INST-001"） | ✅ | `"实例 INST-001"` | `"实例 INST-001"` |
| 12 | 第 2 段逐字 升级 ESC-001（期望逐字 "升级 ESC-001"） | ✅ | `"升级 ESC-001"` | `"升级 ESC-001"` |
| 13 | 第 3 段逐字 节点 T-001 执行者（期望逐字 "节点 T-001 执行者"） | ✅ | `"节点 T-001 执行者"` | `"节点 T-001 执行者"` |
| 14 | 第 4 段逐字 第 1 轮（期望逐字 "第 1 轮"） | ✅ | `"第 1 轮"` | `"第 1 轮"` |
| 15 | 意图计数 1（单条升级）（期望逐字 1） | ✅ | `1` | `1` |
| 16 | 去重组计数 1（期望逐字 1） | ✅ | `1` | `1` |
| 17 | mergedCount=1（期望逐字 1） | ✅ | `1` | `1` |
| 18 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `2 秒内系统托盘出现一条通知，标题为附录 A-1 的升级标题，正文为 A-1 的**五段固定段序**且逐字匹配：`实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · {原因摘要}`（第 5 段取夹具 `reasonDetail` 的实际值，按 A-0 可变值替换）；探针追加一条通知意图事件与一条投递结果事件；正文里没有任何会话内容、日志正文或产物内容；**触发通知前后，该实例的节点 / 会` | `2 秒内系统托盘出现一条通知，标题为附录 A-1 的升级标题，正文为 A-1 的**五段固定段序**且逐字匹配：`实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · {原因摘要}`（第 5 段取夹具 `reasonDetail` 的实际值，按 A-0 可变值替换）；探针追加一条通知意图事件与一条投递结果事件；正文里没有任何会话内容、日志正文或产物内容；**触发通知前后，该实例的节点 / 会` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 逐字断言由 test/wp14/notify.test.js 的 AC-01 / AC-01 变体用例承载（五段段序、缺段渲染 —）；本用例复跑取原始意图帧。

**⑤ 判定**：通过

---

#### AC-02 实例完成时托盘通知

- 判定：**通过**（核对 14/14 通过）
- 证据分级：**mock 实测**
- 验证面：通知 / 机检 + 原始帧
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify-done` 项目根，mock 宿主，应用在托盘；一个 `single` 模板实例尚在运行；`NODE_ENV=test`。
- When 该实例自然跑完（mock 宿主返回成功，实例进入"已完成"）。
- Then 2 秒内出现完成通知，标题为附录 A-1 的完成标题，正文为 A-1 的五段固定段序：`实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1`（取不到的升级编号段渲染 `—`，不省略；节点与角色取 `single` 的唯一节点 `T-001` 与角色「执行者」）；同一实例后续再没有任何"完成"通知重复出现。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言探针出现 `{"event":"notify","kind":"completed","instanceId":"INST-001"}`、`notify.t - completed.t ≤ 2000`、`grep -c '"kind":"completed"'` 计数恰好 1；正文按 ` · ` 切分恰为 5 段、第 1 段 `实例 INST-001`、第 2 段 `升级 —`、第 5 段含 `已完成` 与工作流名 `单节点`；`# fail 0`。,
**架构检查原文**：完成通知的检测点只读实例状态变化，不改写状态；`grep -REn "saveState" src/daemon/notify.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1131ms
[frame-dump notify ac02] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac02 | exit=0 | 121ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1131ms
[架构#1] grep -REn "saveState" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.frame.json` | 552 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.test-stdout.txt` | 4940 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.state.json` | 552 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.meta.json` | 1507 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.check.json` | 6124 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.output.json` | 14112 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 31.543171<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 36.048386<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-02 架构检查：完成通知检测点只读状态不写盘，零命中（exit 1） | ✅ | ``grep -REn "saveState" src/daemon/notify.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 意图 kind=completed（逐字）（期望逐字 "completed"） | ✅ | `"completed"` | `"completed"` |
| 7 | 标题逐字 A-1 完成标题（期望逐字 "通知 实例完成 · INST-001"） | ✅ | `"通知 实例完成 · INST-001"` | `"通知 实例完成 · INST-001"` |
| 8 | 正文逐字 A-1 完成五段（single：升级 — / T-001 执行者 / 第 1 轮 / 已完成，单节点 1/1）（期望逐字 "实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1"） | ✅ | `"实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1"` | `"实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1"` |
| 9 | 正文按 " · " 切分恰为 5 段（期望逐字 5） | ✅ | `5` | `5` |
| 10 | 第 2 段逐字 升级 —（缺段不省略）（期望逐字 "升级 —"） | ✅ | `"升级 —"` | `"升级 —"` |
| 11 | 第 5 段含 已完成 与工作流名 单节点（期望含 "已完成"） | ✅ | `已完成，单节点 1/1` | `已完成` |
| 12 | 第 5 段含 1/1（期望含 "1/1"） | ✅ | `已完成，单节点 1/1` | `1/1` |
| 13 | 同一实例完成通知只 1 条（生命周期一次）（期望逐字 1） | ✅ | `1` | `1` |
| 14 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `2 秒内出现完成通知，标题为附录 A-1 的完成标题，正文为 A-1 的五段固定段序：`实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1`（取不到的升级编号段渲染 `—`，不省略；节点与角色取 `single` 的唯一节点 `T-001` 与角色「执行者」）；同一实例后续再没有任何"完成"通知重复出现。` | `2 秒内出现完成通知，标题为附录 A-1 的完成标题，正文为 A-1 的五段固定段序：`实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1`（取不到的升级编号段渲染 `—`，不省略；节点与角色取 `single` 的唯一节点 `T-001` 与角色「执行者」）；同一实例后续再没有任何"完成"通知重复出现。` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 逐字断言由 test/wp14/notify.test.js 的 AC-02 / AC-02 变体用例承载（完成意图只一次、缺段 —）；本用例复跑取原始意图帧。

**⑤ 判定**：通过

---

#### AC-03 实例异常时托盘通知

- 判定：**通过**（核对 16/16 通过）
- 证据分级：**mock 实测**
- 验证面：通知 / 异常 / 机检 + 原始帧
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify-abnormal` 项目根；一个运行中的实例；应用在托盘；`NODE_ENV=test`；核心进程可被停止与重启。
- When 在实例运行中停止守护进程，随后重新启动守护进程（实例按既有规则被判为"已中断"，健康度转"需关注"）。
- Then 2 秒内出现异常通知，标题为附录 A-1 的异常标题，正文为 A-1 的五段固定段序：`实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注`（原因摘要取实例状态词"已中断"与健康度"需关注"；节点与角色取 `single` 的唯一节点 `T-001` 与角色「执行者」）；通知只出现一次，不因重启后的多次健康度刷新而重复。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言出现 `{"event":"notify","kind":"abnormal","instanceId":"INST-001"}`、正文按 ` · ` 切分恰为 5 段、第 2 段 `升级 —`、第 5 段以 `已中断` 开头并含 `需关注`、同类通知计数为 1；`# fail 0`。,
**架构检查原文**：异常判定复用既有 `state.health` 与实例状态，不在通知层重算；`grep -REn "P90|TTL" src/daemon/notify.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1131ms
[frame-dump notify ac03] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac03 | exit=0 | 131ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1131ms
[架构#1] grep -REn "P90|TTL" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.frame.json` | 544 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.test-stdout.txt` | 4939 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.state.json` | 544 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.meta.json` | 1626 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.check.json` | 6519 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.output.json` | 14113 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 30.562682<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 38.513536<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-03 架构检查：异常判定复用既有 health，不在通知层重算，零命中（exit 1） | ✅ | ``grep -REn "P90\|TTL" src/daemon/notify.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 意图 kind=anomaly（逐字）（期望逐字 "anomaly"） | ✅ | `"anomaly"` | `"anomaly"` |
| 7 | 标题逐字 A-1 异常标题（期望逐字 "通知 实例异常 · INST-001"） | ✅ | `"通知 实例异常 · INST-001"` | `"通知 实例异常 · INST-001"` |
| 8 | 正文逐字 A-1 异常五段（single：升级 — / T-001 执行者 / 第 1 轮 / 已中断，需关注）（期望逐字 "实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注"） | ✅ | `"实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注"` | `"实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注"` |
| 9 | 正文按 " · " 切分恰为 5 段（期望逐字 5） | ✅ | `5` | `5` |
| 10 | 第 2 段逐字 升级 —（期望逐字 "升级 —"） | ✅ | `"升级 —"` | `"升级 —"` |
| 11 | 第 5 段以 已中断 开头且含 需关注 | ✅ | `已中断，需关注` | `已中断，需关注` |
| 12 | 同类通知计数为 1（D-46 首条即发、单异常天然 1 条）（期望逐字 1） | ✅ | `1` | `1` |
| 13 | 去重组计数 1（期望逐字 1） | ✅ | `1` | `1` |
| 14 | mergedCount=1（首条即发满足 2 秒时效）（期望逐字 1） | ✅ | `1` | `1` |
| 15 | 首条意图 at < 2000ms（2 秒时效，注入时钟下延迟 0） | ✅ | `0` | `< 2000` |
| 16 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `2 秒内出现异常通知，标题为附录 A-1 的异常标题，正文为 A-1 的五段固定段序：`实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注`（原因摘要取实例状态词"已中断"与健康度"需关注"；节点与角色取 `single` 的唯一节点 `T-001` 与角色「执行者」）；通知只出现一次，不因重启后的多次健康度刷新而重复。` | `2 秒内出现异常通知，标题为附录 A-1 的异常标题，正文为 A-1 的五段固定段序：`实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注`（原因摘要取实例状态词"已中断"与健康度"需关注"；节点与角色取 `single` 的唯一节点 `T-001` 与角色「执行者」）；通知只出现一次，不因重启后的多次健康度刷新而重复。` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 3 条。
- 逐字断言由 test/wp14/notify.test.js 的 AC-03 主用例 + 3 个变体承载；D-46 口径：异常首条即发、窗口内更新意图去重后仍算一条。

**⑤ 判定**：通过

---

#### AC-04 点击通知定位到队列条目

- 判定：**通过**（核对 15/15 通过）
- 证据分级：**mock 实测（app.js 源码锚点 + followNotification 行为断言；真窗口/CI 不可用）**
- 验证面：通知 / 交互 / 源码锚点 + 行为断言
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify-click` 项目根，队列已有一条待处理升级 `ESC-001`；应用在托盘（窗口隐藏）；探针已记录该通知。
- When 用户点击该通知（通过 `ctl/notify-open` 触发与真实点击相同的处理函数）。
- Then 主窗口被唤到前台，停在人工干预队列，`ESC-001` 条目处于选中态并滚动到可见位置；界面不跳到别的视图、不打开节点详情。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言探针序列含 `{"event":"notify-open","escalationId":"ESC-001"}` 与 `{"event":"nav","view":"queue","selected":"ESC-001"}`、窗口 `visible === true`、视图中不存在 `node-detail` 事件；`# fail 0`。,
**架构检查原文**：点击处理只做"唤前 + 切视图 + 选中"，不读资产、不改状态；`grep -REn "saveState|instanceDir" desktop/ui/queue/` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1145ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 714ms
[读取 desktop/ui/app.js 源码（D-52 锚点）] cat desktop/ui/app.js | exit=0 | 156ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1145ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 714ms
[架构#1] grep -REn "saveState|instanceDir" desktop/ui/queue/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.test-stdout.txt` | 11391 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.state.json` | 5162 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.meta.json` | 2074 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.check.json` | 14468 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.output.json` | 130935 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 31.781468<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 38.720611<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.262934<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-04 架构检查：点击处理只唤前+切视图+选中，不读资产不改状态，零命中（exit 1） | ✅ | ``grep -REn "saveState\|instanceDir" desktop/ui/queue/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 10 | D-52 锚点：app.js 的 __MAESTRO_CTL__ 分发器含 open-queue 分支（期望匹配 /action === ['"]open-queue['"]/） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure ` | `/action === ['"]open-queue['"]/` |
| 11 | D-52：open-queue 复用 followNotification（无第二条导航逻辑）（期望匹配 /app\.followNotification\(\{ kind: ['"]escalation['"], ids: selected \}\)/） | ✅ | `/**<br> * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /<br> * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).<br> *<br> * This module owns the seam between the pure ` | `/app\.followNotification\(\{ kind: ['"]escalation['"], ids: selected \}\)/` |
| 12 | D-52：open-queue 未联动打开图/节点详情 | ✅ | `openGraph(selected) 命中数` | `0` |
| 13 | 行为断言用例存在：AC-04 / followNotification navigates to queue and selects the row | ✅ | `D-46 / AC-04: notify replace by (kind,instanceId) + queue target routing \| AC-04 / AC-49: followNotification navigates to queue and selects the row` | `含 AC-04 用例名` |
| 14 | Then 机检序列逐字（探针 notify-open + nav.queue.selected，无 node-detail） | ✅ | `{"event":"notify-open","escalationId":"ESC-001"} 与 {"event":"nav","view":"queue","selected":"ESC-001"}；window.visible===true；无 node-detail` | ``test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言探针序列含 `{"event":"notify-open","escalationId":"ESC-001"}` 与 `{"event":"nav","view":"queue","selected":"ESC-001"}`、窗口 `visible === ` |
| 15 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `主窗口被唤到前台，停在人工干预队列，`ESC-001` 条目处于选中态并滚动到可见位置；界面不跳到别的视图、不打开节点详情。` | `主窗口被唤到前台，停在人工干预队列，`ESC-001` 条目处于选中态并滚动到可见位置；界面不跳到别的视图、不打开节点详情。` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 证据分级说明：D-52 open-queue 的真实 Tauri 窗口在无头验收环境不可用；按任务书用 app.js 源码锚点（open-queue 分支 + followNotification 复用）+ followNotification 行为断言（ui-views.test.js）取证，属 mock 实测，非真实宿主点击。

**⑤ 判定**：通过

---

#### AC-05 通知开关：总开关与三类分项，按本机记住

- 判定：**通过**（核对 17/17 通过）
- 证据分级：**mock 实测**
- 验证面：设置 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify-toggle` 项目根；应用已启动并停在人工干预队列页；页顶部设置区的三项分项默认全开、总开关默认开；`NODE_ENV=test`。
- When 依次：关掉"实例完成"分项 → 触发一次完成事件；重新打开该分项 → 再触发一次；关掉总开关 → 触发一次升级事件；重启应用后查看设置。
- Then 第一次不产生完成通知（探针无 `kind=completed` 的 `notify`）；第二次产生；第三次不产生升级通知；重启后总开关仍为关闭、三个分项保持各自状态；四次操作期间队列与托盘数字照常更新。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言三次触发的 `notify` 计数分别为 0 / 1 / 0；`.orch/desktop/prefs.json` 的开关字段与界面一致；`tray-status` 数字在三次触发后都更新；`# fail 0`。,
**架构检查原文**：开关只影响"是否显示通知"，不得影响事件产生与队列投影；`grep -REn "notify" src/daemon/queue.js` 必须**零命中（exit 1）**（队列不得依赖通知状态）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1135ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 718ms
[机检 prefs.test.js] test -f test/wp14/prefs.test.js && NODE_ENV=test node --test test/wp14/prefs.test.js | exit=0 | 517ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1135ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 718ms
[机检] test -f test/wp14/prefs.test.js && NODE_ENV=test node --test test/wp14/prefs.test.js | exit=0 | # pass 10 / # fail 0 | 517ms
[架构#1] grep -REn "notify" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.test-stdout.txt` | 13546 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.state.json` | 6256 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.meta.json` | 2354 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.check.json` | 6871 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.output.json` | 35577 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=目时不发过期意图<br>  ---<br>  duration_ms: 32.44606<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 38.830794<br>  type:` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.257074<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 机检 prefs.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=它文件、不改实例状态目录<br>  ---<br>  duration_ms: 79.070615<br>  type: 'test'<br>  ...<br># Subtest: prefsPath 与 PREFS_KEYS 的形状契约<br>ok 10 - prefsPath 与 PREFS_KEYS 的形状契约<br>  ---<br>  duration_ms: 0.488713<br>  type:` | `` |
| 10 | 机检 prefs.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 11 | 机检 prefs.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 12 | 机检 prefs.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 13 | 架构检查 #1：AC-05 架构检查：开关只影响是否显示通知，队列不依赖通知状态，零命中（exit 1） | ✅ | ``grep -REn "notify" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 14 | AC-05 意图用例存在（关分项/重开/总开关三次触发 → 0/1/0） | ✅ | `AC-05: 关掉分项后该类不产生意图，重开后恢复；总开关关掉全静默 \| AC-05 变体: 关掉升级分项不影响完成与异常两类` | `notify 计数 0 / 1 / 0` |
| 15 | A-2 开关固定顺序用例存在（通知/升级待处理/实例完成/实例异常 默认全开） | ✅ | `A-2 / AC-05: notification toggles render in fixed order, default all on \| A-2 / AC-49: already-resolved notice is verbatim from the daemon conclusion \| AC-05: prefs toggles write through the HTTP seam` | `A-2 固定顺序` |
| 16 | prefs.json 只写四键、合并写不触碰其它文件（按本机记住） | ✅ | `# pass 10 / # fail 0` | `# fail 0` |
| 17 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `第一次不产生完成通知（探针无 `kind=completed` 的 `notify`）；第二次产生；第三次不产生升级通知；重启后总开关仍为关闭、三个分项保持各自状态；四次操作期间队列与托盘数字照常更新。` | `第一次不产生完成通知（探针无 `kind=completed` 的 `notify`）；第二次产生；第三次不产生升级通知；重启后总开关仍为关闭、三个分项保持各自状态；四次操作期间队列与托盘数字照常更新。` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 机检 prefs.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 逐字断言由 notify.test.js 的 AC-05 两用例（意图计数 0/1/0）+ ui-views.test.js 的 A-2 开关顺序用例 + prefs.test.js（四键原子写）承载；本用例机检复核。

**⑤ 判定**：通过

---

#### AC-06 去重与合并：10 秒同一升级一次，60 秒同类异常合并

- 判定：**通过**（核对 13/13 通过）
- 证据分级：**mock 实测**
- 验证面：通知 / 节流 / 机检 + 原始帧
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify-dedupe` 项目根；应用在托盘；`NODE_ENV=test`。
- When ① 对同一升级在 10 秒内连续触发 3 次通知意图；② 等待 11 秒后再触发 1 次；③ 对同一实例在 60 秒内触发 4 次同类异常（第 2～4 次间隔 5 秒）。
- Then ①只出现 1 条升级通知；②再出现 1 条（共 2 条）；③异常通知只出现 1 条，正文含"共 4 次"；期间不出现"每条一条"的刷屏。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言升级通知计数 2、异常类按 `(kind, instanceId)` 意图组**去重**后计数 1（首条即发，窗口内并入以更新意图呈现，各更新意图的 `mergedCount` 单调递增）、末条 `mergedCount === 4` 且正文匹配附录 A-1 的合并形态（含"共 4 次"）；`# fail 0`。呈现替换语义的裁决见 `decisions.md` D-46。,
**架构检查原文**：合并窗口必须可注入时钟（`now` 参数），单测注入固定时钟覆盖 9999ms / 10001ms 边界；`grep -REn "setTimeout" src/daemon/notify.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1132ms
[frame-dump notify ac06] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac06 | exit=0 | 137ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1132ms
[架构#1] grep -REn "setTimeout" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.frame.json` | 1533 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.test-stdout.txt` | 4939 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.state.json` | 1533 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.meta.json` | 1840 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.check.json` | 5438 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.output.json` | 15215 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=目时不发过期意图<br>  ---<br>  duration_ms: 31.487051<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 37.4883<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-06 架构检查：合并窗口可注入时钟（now/schedule），无 setTimeout 直调，零命中（exit 1） | ✅ | ``grep -REn "setTimeout" src/daemon/notify.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 升级通知计数 2（10s 内 1 条 + 11s 后 1 条，由注入时钟单测 AC-06 覆盖） | ✅ | `AC-06: 同一升级 9999ms 抑制、10001ms 放行（注入时钟边界） \| AC-06: 不同升级编号互不影响去重窗口 \| AC-06: 同一实例同类异常 60s 窗口内合并，mergedCount [1,2,3,4] 单调递增 \| AC-06: 异常窗口 59999ms 内并入、60001ms 起按新组即发` | `升级 9999ms 抑制 / 10001ms 放行 → 共 2 条` |
| 7 | 异常意图组（kind,instanceId）去重后计数 1（D-46）（期望逐字 1） | ✅ | `1` | `1` |
| 8 | mergedCount 单调递增 [1,2,3,4]（逐字）（期望逐字 "[1,2,3,4]"） | ✅ | `"[1,2,3,4]"` | `"[1,2,3,4]"` |
| 9 | 末条 mergedCount === 4（期望逐字 4） | ✅ | `4` | `4` |
| 10 | 末条正文含 "共 4 次"（A-1 合并形态）（期望含 "共 4 次"） | ✅ | `实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 已中断，共 4 次，最近：会话 mock-sess-12345-1 崩溃` | `共 4 次` |
| 11 | 合并形态正文按 " · " 切分仍为 5 段（期望逐字 5） | ✅ | `5` | `5` |
| 12 | 首条异常即发（at < 2000ms，对齐 AC-03/BR-01 的 2 秒时效） | ✅ | `0` | `< 2000` |
| 13 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `①只出现 1 条升级通知；②再出现 1 条（共 2 条）；③异常通知只出现 1 条，正文含"共 4 次"；期间不出现"每条一条"的刷屏。` | `①只出现 1 条升级通知；②再出现 1 条（共 2 条）；③异常通知只出现 1 条，正文含"共 4 次"；期间不出现"每条一条"的刷屏。` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 4 条。
- D-46 判读：异常首条立即发（mergedCount 1），窗口内后续同类按 (kind,instanceId) 并入并重发更新意图（mergedCount 递增、正文合并形态），壳层替换呈现 → 用户视角只 1 条。升级 10s 边界（9999/10001ms）由注入时钟单测覆盖。

**⑤ 判定**：通过

---

#### AC-07 通知不可用：只提示一次，不阻断任何流程

- 判定：**通过**（核对 15/15 通过）
- 证据分级：**mock 实测**
- 验证面：通知 / 异常 / 机检 + 原始帧
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-notify-down` 项目根；应用在托盘；系统通知通道被构造为不可用（投递必然失败）；`NODE_ENV=test`。
- When 对 **3 个不同条目**（3 个不同升级编号，分属 2 个实例）各触发 1 次升级通知意图，并观察实例是否继续推进；随后在队列里处置其中一条。
- Then 界面只出现 1 次"通知不可用 · 队列仍可用"的中文提示；探针记录 3 条 `notify` 与 3 条 `delivered=false`；队列条目、托盘数字照常更新；实例推进不受影响；处置动作 2 秒内生效。

```
,**机检原文**：`test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js`，断言提示出现次数为 1、`notify` 计数 3（3 个不同 `escalationId`）、`delivered=false` 计数 3、处置后队列条目消失、实例状态推进；同一条目 10 秒内重复触发只产生 1 条意图属 BR-04 的去重口径，由注入固定时钟的单元测试覆盖（见 AC-06），**不在本 AC 混合计数**；`# fail 0`。,
**架构检查原文**：投递失败不得重试、不得抛异常到主流程；投递失败发生在通知产生与投递路径上，锚点必须打在这条路径而不是界面渲染模块：`grep -REn "throw new Error" src/daemon/notify.js` 必须**零命中（exit 1；该文件属 S2 新建，基线扫描为 `No such file or directory`、exit 2，属预期）**，并由本 AC 的行为断言（3 条 `delivered=false` 且实例继续推进、处置 2 秒内生效）兜底。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1140ms
[机检 shell-notify.test.js] test -f test/wp14/shell-notify.test.js && NODE_ENV=test node --test test/wp14/shell-notify.test.js | exit=0 | 198ms
[frame-dump notify ac07] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac07 | exit=0 | 124ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1140ms
[机检] test -f test/wp14/shell-notify.test.js && NODE_ENV=test node --test test/wp14/shell-notify.test.js | exit=0 | # pass 11 / # fail 0 | 198ms
[架构#1] grep -REn "throw new Error" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.frame.json` | 1315 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.test-stdout.txt` | 7947 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.state.json` | 1315 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.meta.json` | 2122 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.check.json` | 7054 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.output.json` | 23243 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 32.503252<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 37.461282<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 shell-notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=btest: 真实探针层：ctl 四动作触发事件并改名 .done（需当前源码构建产物）<br>ok 12 - 真实探针层：ctl 四动作触发事件并改名 .done（需当前源码构建产物） # SKIP release 壳层二进制早于 main.rs（本轮改动未构建）；静态契约层已覆盖接缝<br>  ---<br>  duration_ms: 0.065355<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 shell-notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 shell-notify.test.js：# pass ≥ 1 | ✅ | `# pass 11 / # tests 12` | `` |
| 8 | 机检 shell-notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-07 架构检查：投递失败不重试/不抛到主流程，零命中（exit 1；S2 新建文件） | ✅ | ``grep -REn "throw new Error" src/daemon/notify.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 10 | 3 个不同 escalationId → 3 条 notify 意图（去重组 3）（期望逐字 3） | ✅ | `3` | `3` |
| 11 | raw 意图计数 3（3 个不同编号，非同条目去重）（期望逐字 3） | ✅ | `3` | `3` |
| 12 | 3 个编号互不相同 ESC-001/002/003（期望逐字 "[\"ESC-001\",\"ESC-002\",\"ESC-003\"]"） | ✅ | `"[\"ESC-001\",\"ESC-002\",\"ESC-003\"]"` | `"[\"ESC-001\",\"ESC-002\",\"ESC-003\"]"` |
| 13 | 壳层提示锚点存在：config.rs 通知不可用提示 + --no-notify 只关投递层 | ✅ | `--no-notify 只关投递层：开关置 false 但 SSE 订阅仍无条件启动 \| config.rs：托盘六字段 + 通知不可用提示，均经 pick 覆盖且有中文默认值` | `提示「通知不可用 · 队列仍可用」逐字、首次投递失败只提示一次` |
| 14 | 行为兜底：状态读失败/偏好读失败不阻断后续意图、3 条逐条产生 | ✅ | `AC-07: 状态投影读失败不阻断后续意图（3 条不同升级逐条产生） \| AC-07: 偏好读取抛错按全开缺省处理，不阻断意图 \| AC-07: 由新升级引起的异常信号被抑制，避免与升级意图重复` | `3 条 delivered=false 且实例继续推进` |
| 15 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `界面只出现 1 次"通知不可用 · 队列仍可用"的中文提示；探针记录 3 条 `notify` 与 3 条 `delivered=false`；队列条目、托盘数字照常更新；实例推进不受影响；处置动作 2 秒内生效。` | `界面只出现 1 次"通知不可用 · 队列仍可用"的中文提示；探针记录 3 条 `notify` 与 3 条 `delivered=false`；队列条目、托盘数字照常更新；实例推进不受影响；处置动作 2 秒内生效。` |

**备注**

- 机检 notify.test.js：# tests 22 / # pass 22 / # fail 0 / # skipped 0；带本 AC 编号用例 3 条。
- 机检 shell-notify.test.js：# tests 12 / # pass 11 / # fail 0 / # skipped 1；带本 AC 编号用例 0 条。
- A-2 提示「通知不可用 · 队列仍可用」逐字见 config.rs（shell-notify.test.js 锚点）；无头环境系统通知投递失败属预期，判定只看意图已产生且流程未受阻。同条目 10s 内重复去重属 BR-04，由 AC-06 注入时钟单测覆盖，不在本 AC 混计。

**⑤ 判定**：通过

---

#### AC-08 队列合并、排序与空态

- 判定：**通过**（核对 16/16 通过）
- 证据分级：**mock 实测**
- 验证面：队列 / 投影 / 机检 + 原始帧
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue` 项目根，三个实例：`INST-001` 有 1 条待处理升级，`INST-002` 有 1 条待审批与 1 条待处理升级，`INST-003` 干净；**另一个独立项目根** `/tmp/maestro-i11-queue-nonode` 只放一份**无 `nodeId`** 的审批（`APR-009`，用于降级断言，其条目**不进入**上面三个实例的队列，也不参与 3 行与排序断言）；`NODE_ENV=test`。
- When 打开人工干预队列；**在队列保持打开、不点任何刷新的情况下**让 `INST-003` 产生 1 条待处理升级；再处置完所有条目后重新查看。
- Then 第一次看到 3 行，顺序为：`INST-001` 的升级 → `INST-002` 的升级 → `INST-002` 的审批；**三行都逐字匹配附录 A-3 的同一套八字段模板**（类型、编号、实例、节点与角色、轮次/次数、状态词、原因摘要、产生时间）——审批行不因是审批条目而少字段（不再复用 CLI 行）；新增的那条升级**在 2 秒内自行出现**（无需刷新，也没有"刷新"按钮），插入位置符合固定排序；最后一次显示"待处理 无"并保留"查看实例列表"入口。队列页上**不存在**筛选器、搜索框、自定义列控件。

```
,**机检原文**：`test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js`，用 `desktop/harness/queue-dump.mjs` 导出三行与空态行，逐字比对附录 A-3；断言排序序列为 `['ESC-001','ESC-002','APR-001']`；断言**每一行按 ` · ` 切分后都是 7 段**（八字段里的「类型」与「编号」合在第 1 段），且审批行第 2 段为 `实例 INST-002`、第 4 段以 `第 ` 开头、第 6 段以 `动作 ` 开头、第 7 段为 ISO 时间；断言新条目 `t_row - t_event ≤ 2000`；**降级断言**（`APR-009` 无 `nodeId`）：该行仍为 7 段、第 3 段逐字 `节点 —`、第 4 段逐字 `第 — 轮`，段未被省略；队列视图控件的 `controls` 导出只含处置动作，不含 `filter` / `search` / `columns` 键；`# pass ≥ 1`、`# fail 0`。,
**架构检查原文**：队列是只读投影，不得写状态；`grep -REn "saveState|appendEvent" src/daemon/queue.js` 必须**零命中（exit 1）**；审批行必须由**桌面自有模板** `DESKTOP_QUEUE_ROW_APR` 渲染，**不得复用** CLI 的审批行渲染器：`grep -REn "renderApprovalLine" desktop/ui/ src/daemon/queue.js` 必须**零命中（exit 1）**；**不提供筛选 / 搜索 / 自定义列**：`grep -REn "searchBox|filterBar|columnPicker|columnToggle" desktop/ui/queue/` 必须**零命中（exit 1）**（该目录在基线上不存在，S2 建成后必须保持零命中）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6795ms
[frame-dump queue ac08] NODE_ENV=test node probe/acc11-frame-dump.mjs queue ac08 | exit=0 | 89ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6795ms
[架构#1] grep -REn "saveState|appendEvent" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
[架构#2] grep -REn "renderApprovalLine" desktop/ui/ src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
[架构#3] grep -REn "searchBox|filterBar|columnPicker|columnToggle" desktop/ui/queue/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.frame.json` | 1778 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.test-stdout.txt` | 4204 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.state.json` | 1778 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.meta.json` | 1977 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.check.json` | 10125 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.output.json` | 14560 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=1578.28508<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 378.572251<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-08 架构：队列只读投影，不写状态，零命中（exit 1） | ✅ | ``grep -REn "saveState\|appendEvent" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 架构检查 #2：AC-08 架构：审批行由桌面自有模板，不复用 CLI renderApprovalLine，零命中（exit 1） | ✅ | ``grep -REn "renderApprovalLine" desktop/ui/ src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 7 | 架构检查 #3：AC-08 架构：不提供筛选/搜索/自定义列，零命中（exit 1） | ✅ | ``grep -REn "searchBox\|filterBar\|columnPicker\|columnToggle" desktop/ui/queue/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 8 | 排序逐字 [ESC-001, ESC-002, APR-001]（升级在审批前，同类按编号）（期望逐字 "[\"ESC-001\",\"ESC-002\",\"APR-001\"]"） | ✅ | `"[\"ESC-001\",\"ESC-002\",\"APR-001\"]"` | `"[\"ESC-001\",\"ESC-002\",\"APR-001\"]"` |
| 9 | totals 逐字 {pendingEscalations:2, pendingApprovals:1}（期望逐字 "{\"pendingEscalations\":2,\"pendingApprovals\":1}"） | ✅ | `"{\"pendingEscalations\":2,\"pendingApprovals\":1}"` | `"{\"pendingEscalations\":2,\"pendingApprovals\":1}"` |
| 10 | 每行为同一套八字段模板（九字段含 type）（期望逐字 "[\"type\",\"id\",\"instanceId\",\"nodeId\",\"role\",\"round\",\"stateWord\",\"reasonSummary\",\"createdAt\"]"） | ✅ | `"[\"type\",\"id\",\"instanceId\",\"nodeId\",\"role\",\"round\",\"stateWord\",\"reasonSummary\",\"createdAt\"]"` | `"[\"type\",\"id\",\"instanceId\",\"nodeId\",\"role\",\"round\",\"stateWord\",\"reasonSummary\",\"createdAt\"]"` |
| 11 | 审批行与升级行同模板（字段集合一致）（期望逐字 "[\"type\",\"id\",\"instanceId\",\"nodeId\",\"role\",\"round\",\"stateWord\",\"reasonSummary\",\"createdAt\"]"） | ✅ | `"[\"type\",\"id\",\"instanceId\",\"nodeId\",\"role\",\"round\",\"stateWord\",\"reasonSummary\",\"createdAt\"]"` | `"[\"type\",\"id\",\"instanceId\",\"nodeId\",\"role\",\"round\",\"stateWord\",\"reasonSummary\",\"createdAt\"]"` |
| 12 | A-3 三行逐字八字段（含审批行实例/轮次/动作/时间）由 queue.test.js 承载 | ✅ | `buildQueue：跨实例合并、排序与统一八字段模板（AC-08 / BR-06 / BR-07） \| buildQueue：无节点审批行轮次为 null、降级行标注状态不可读、断线位与空态（AC-08 / D-19 / BR-36 数据位） \| buildQueue：totals 只读既有快照计数字段，不按数组重算（D-36 / AC-18 数据侧）` | `八字段模板逐字、排序 ESC-001/ESC-002/APR-001` |
| 13 | 降级断言：APR-009 无 nodeId 仍 7 段、节点 — / 第 — 轮、空态「待处理 无」 | ✅ | `buildQueue：无节点审批行轮次为 null、降级行标注状态不可读、断线位与空态（AC-08 / D-19 / BR-36 数据位）` | `节点 — / 第 — 轮 / 待处理 无` |
| 14 | 空态 items 空、totals 归零（期望逐字 "[]"） | ✅ | `"[]"` | `"[]"` |
| 15 | 空态文案逐字 A-3（期望逐字 "待处理 无"） | ✅ | `"待处理 无"` | `"待处理 无"` |
| 16 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `第一次看到 3 行，顺序为：`INST-001` 的升级 → `INST-002` 的升级 → `INST-002` 的审批；**三行都逐字匹配附录 A-3 的同一套八字段模板**（类型、编号、实例、节点与角色、轮次/次数、状态词、原因摘要、产生时间）——审批行不因是审批条目而少字段（不再复用 CLI 行）；新增的那条升级**在 2 秒内自行出现**（无需刷新，也没有"刷新"按钮），插入位置符合固定排序；最后一次显示"待处理 无"并保留` | `第一次看到 3 行，顺序为：`INST-001` 的升级 → `INST-002` 的升级 → `INST-002` 的审批；**三行都逐字匹配附录 A-3 的同一套八字段模板**（类型、编号、实例、节点与角色、轮次/次数、状态词、原因摘要、产生时间）——审批行不因是审批条目而少字段（不再复用 CLI 行）；新增的那条升级**在 2 秒内自行出现**（无需刷新，也没有"刷新"按钮），插入位置符合固定排序；最后一次显示"待处理 无"并保留` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 八字段逐字与降级/断线位由 test/wp14/queue.test.js 纯投影用例承载；本用例复跑取 buildQueue 原始投影帧，并用 desktop/harness/queue-dump.mjs 同模块渲染。

**⑤ 判定**：通过

---

#### AC-09 升级「继续」：终态节点让实例完成、非终态节点让实例续跑

- 判定：**通过**（核对 10/10 通过）
- 证据分级：**mock 实测**
- 验证面：处置 / 机检（D-39 两现场）
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-pass` 项目根，三个实例：`INST-001`（`single` 模板，唯一节点 `T-001` 就是**终态节点**，因"轮次超限"挂起，待处理升级 `ESC-001`）、`INST-002`（`single` 模板，运行中、无待处理项，用于对照）、`INST-003`（`code-loop` 模板，入口节点 `T-001`「开发」是**非终态节点**，因"轮次超限"挂起，待处理升级 `ESC-002`）；队列已打开（2 行）；`NODE_ENV=test`。
- When 先点 `ESC-001` 行的"继续"；看到结果后再点 `ESC-002` 行的"继续"。
- Then 第一次：2 秒内 `ESC-001` 显示"已处理（通过）"并从队列消失；`INST-001` 从"已挂起"进入**"已完成"**、`T-001` 节点进入已完成（终态节点判通过 → 实例完成，D-39）；`INST-002` 的实例状态、节点轮次与队列行数（除 `ESC-001` 外）**完全不变**。第二次：2 秒内 `ESC-002` 同样"已处理（通过）"并消失；`INST-003` **保持"运行中"**、下游 `T-002`「测试」被唤醒并进入执行（非终态节点判通过 → 实例续跑，D-39）；队列清空为"待处理 无"。

```
,**机检原文**：`test -f test/wp14/queue-actions.test.js`（或合并后的 `test/wp14/queue.test.js`）&& NODE_ENV=test node --test test/wp14/queue-actions.test.js`，断言两条结果行逐字匹配附录 A-4、两次 `escalation.resolution === 'pass'`；`INST-001` 状态为"已完成"且 `T-001` 节点为"已完成"；`INST-002` 在两次操作前后的状态与节点轮次 `deepEqual`；`INST-003` 状态仍为"运行中"且 `T-002` 有新的派发 / 会话事件；队列剩余条数依次减少 2；`# fail 0`。,
**架构检查原文**：处置必须走既有裁决入口并经 CAS；`grep -REn "orchestrator.resolveEscalation" src/daemon/queue.js` **恰好 1 条命中（exit 0）**，且同文件 `grep -REn "escalations[.]push|resolution ="` **零命中（exit 1）**（不得直接改状态数组或自写决议）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6817ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6817ms
[架构#1] grep -REn "orchestrator.resolveEscalation" src/daemon/queue.js | 期望 exit 0 / 实测 exit 0
[架构#2] grep -REn "escalations[.]push|resolution =" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.test-stdout.txt` | 4206 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.meta.json` | 1901 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.check.json` | 6827 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.output.json` | 11895 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=603.543546<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 319.816035<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-09 架构：处置走既有裁决入口，恰好 1 条命中（exit 0） | ✅ | ``grep -REn "orchestrator.resolveEscalation" src/daemon/queue.js` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 6 | 架构检查 #2：AC-09 架构：不得直接改状态数组/自写决议，零命中（exit 1） | ✅ | ``grep -REn "escalations[.]push\|resolution =" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 7 | D-39 现场一：终态节点 pass → 实例 completed（逐字断言由用例承载） | ✅ | `升级·继续：终态节点判通过 → 实例已完成（AC-09 现场一 / D-39） \| 升级·继续：非终态节点判通过 → 保持运行中且下游被唤醒（AC-09 现场二 / D-39）` | `INST-001 已完成 / T-001 已完成` |
| 8 | D-39 现场二：非终态节点 pass → 保持 running + 下游 T-002 被唤醒 | ✅ | `升级·继续：非终态节点判通过 → 保持运行中且下游被唤醒（AC-09 现场二 / D-39）` | `INST-003 运行中 / T-002 新派发` |
| 9 | 两条 resolution === pass、结果行逐字 A-4、INST-002 对照不变、队列依次减 2 | ✅ | `# pass 16 / # fail 0` | `两次 escalation.resolution === pass；# fail 0` |
| 10 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `第一次：2 秒内 `ESC-001` 显示"已处理（通过）"并从队列消失；`INST-001` 从"已挂起"进入**"已完成"**、`T-001` 节点进入已完成（终态节点判通过 → 实例完成，D-39）；`INST-002` 的实例状态、节点轮次与队列行数（除 `ESC-001` 外）**完全不变**。第二次：2 秒内 `ESC-002` 同样"已处理（通过）"并消失；`INST-003` **保持"运行中"**、下游 `T-002`` | `第一次：2 秒内 `ESC-001` 显示"已处理（通过）"并从队列消失；`INST-001` 从"已挂起"进入**"已完成"**、`T-001` 节点进入已完成（终态节点判通过 → 实例完成，D-39）；`INST-002` 的实例状态、节点轮次与队列行数（除 `ESC-001` 外）**完全不变**。第二次：2 秒内 `ESC-002` 同样"已处理（通过）"并消失；`INST-003` **保持"运行中"**、下游 `T-002`` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 机检文件名口径：需求 §3.1 写 test/wp14/queue-actions.test.js，本分支（HEAD 2732f86）该文件不存在，AC-09~12 的逐字断言合并进 test/wp14/queue.test.js；本用例按实际存在的文件机检并保留原始 TAP，不放宽断言。

**⑤ 判定**：通过

---

#### AC-10 升级「重派」：重新分配、轮次 +1

- 判定：**通过**（核对 8/8 通过）
- 证据分级：**mock 实测**
- 验证面：处置 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-retry` 项目根，`INST-001` 挂起、待处理升级 `ESC-001`（当前第 1 轮）；`NODE_ENV=test`。
- When 点"重派"。
- Then 2 秒内显示"已处理（重新分配）"；实例回到"运行中"，该节点轮次变为 2，绑定到一个会话；队列中该条消失。

```
,**机检原文**：`test -f test/wp14/queue-actions.test.js && NODE_ENV=test node --test test/wp14/queue-actions.test.js`，断言 `resolution === 'retry'`、节点 `round === 2`、`sessionId` 非空、实例状态"运行中"；`# fail 0`。,
**架构检查原文**：重派必须复用既有派发路径，不得在队列层直接建会话；`grep -REn "session/new|sessionNew" src/daemon/queue.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6871ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6871ms
[架构#1] grep -REn "session/new|sessionNew" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-10/AC-10.test-stdout.txt` | 4205 B |
| `docs/iterations/iteration-11/evidence/AC-10/AC-10.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-10/AC-10.meta.json` | 1449 B |
| `docs/iterations/iteration-11/evidence/AC-10/AC-10.check.json` | 3554 B |
| `docs/iterations/iteration-11/evidence/AC-10/AC-10.output.json` | 11438 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=576.172966<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 374.684003<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-10 架构：重派复用既有派发路径，队列层不直接建会话，零命中（exit 1） | ✅ | ``grep -REn "session/new\|sessionNew" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 重派断言存在（resolution=retry / round=2 / sessionId 非空 / 实例运行中 / 队列消失） | ✅ | `升级·重派：轮次 +1、绑定新会话、实例回到运行中（AC-10）` | `resolution retry / round 2 / session 非空` |
| 7 | 重派用例通过（# fail 0） | ✅ | `# pass 16 / # fail 0` | `# fail 0` |
| 8 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `2 秒内显示"已处理（重新分配）"；实例回到"运行中"，该节点轮次变为 2，绑定到一个会话；队列中该条消失。` | `2 秒内显示"已处理（重新分配）"；实例回到"运行中"，该节点轮次变为 2，绑定到一个会话；队列中该条消失。` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 逐字节流由 test/wp14/queue.test.js 的 AC-10「升级·重派」用例承载；需求机检原文点名 queue-actions.test.js，本分支合并进 queue.test.js。

**⑤ 判定**：通过

---

#### AC-11 升级「终止」：二次确认后取消实例

- 判定：**通过**（核对 13/13 通过）
- 证据分级：**mock 实测**
- 验证面：处置 / 确认 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-cancel` 项目根，`INST-001` 挂起、待处理升级 `ESC-001`；`NODE_ENV=test`。
- When 点"终止"；在确认框里先点"取消"，再点"终止"并确认。
- Then 第一次不改变任何状态（实例仍"已挂起"、条目仍在、该升级仍为"待处理"）；第二次 2 秒内实例变为"已取消"，该升级条目消失，队列不再显示它；确认句逐字见附录 A-4。

```
,**机检原文**：`test -f test/wp14/queue-actions.test.js && NODE_ENV=test node --test test/wp14/queue-actions.test.js`，断言取消后实例状态与升级状态均不变、确认后实例状态为"已取消"、队列条数减 1、确认句逐字匹配；`# fail 0`。,
**架构检查原文**：终止必须走既有取消入口；`grep -REn "halted = true|state = 'cancelled'" src/daemon/queue.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6930ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 728ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6930ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 728ms
[架构#1] grep -REn "halted = true|state = 'cancelled'" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.test-stdout.txt` | 10658 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.state.json` | 4921 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.meta.json` | 1992 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.check.json` | 5181 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.output.json` | 27899 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=627.817693<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 371.682624<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.233401<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-11 架构：终止走既有取消入口，不自写状态字面量，零命中（exit 1） | ✅ | ``grep -REn "halted = true\|state = 'cancelled'" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 10 | 终止数据侧断言存在（实例级取消、升级作废、条目消失） | ✅ | `升级·终止：实例级取消，待处理升级作废、条目消失（AC-11 数据侧 / D-08）` | `实例已取消 / 队列减 1` |
| 11 | 二次确认行为断言存在（先取消不改状态、再确认才取消，A-4 确认句逐字） | ✅ | `AC-11: cancel confirm is two-step; dismiss leaves no pending confirm` | `确认句「终止实例 INST-001？终止后该实例不再继续」逐字` |
| 12 | 两文件机检均通过（# fail 0） | ✅ | `queue fail=0 / ui fail=0` | `# fail 0` |
| 13 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `第一次不改变任何状态（实例仍"已挂起"、条目仍在、该升级仍为"待处理"）；第二次 2 秒内实例变为"已取消"，该升级条目消失，队列不再显示它；确认句逐字见附录 A-4。` | `第一次不改变任何状态（实例仍"已挂起"、条目仍在、该升级仍为"待处理"）；第二次 2 秒内实例变为"已取消"，该升级条目消失，队列不再显示它；确认句逐字见附录 A-4。` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 数据侧由 queue.test.js「升级·终止」承载，二次确认交互由 ui-views.test.js「cancel confirm is two-step」承载；A-4 确认句逐字见该用例与附录 A-4。

**⑤ 判定**：通过

---

#### AC-12 审批「允许」与「拒绝」

- 判定：**通过**（核对 11/11 通过）
- 证据分级：**mock 实测**
- 验证面：审批 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-approval` 项目根；`INST-001` 有一条待审批 `APR-001`（动作 `write`），`INST-002` 有一条待审批 `APR-002`（动作 `write`）；`NODE_ENV=test`。
- When 对 `APR-001` 点"允许"，对 `APR-002` 点"拒绝"。
- Then 两条分别在 2 秒内显示"审批 APR-001 已通过 · 动作 write"与"审批 APR-002 已拒绝 · 动作 write"（逐字见附录 A-4）；两条从队列消失；对应会话继续或被拒，实例状态按既有规则推进。

```
,**机检原文**：`test -f test/wp14/queue-actions.test.js && NODE_ENV=test node --test test/wp14/queue-actions.test.js`，断言两条结果行逐字、审批状态分别为 `approved` / `denied`、队列条数减 2；`# fail 0`。,
**架构检查原文**：审批处置必须经既有 `approval.resolve` 路径且做会话校验（D-11 禁改核心，判定事实在核心）；`grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js` **≥1 命中（exit 0）** 且 `grep -REn "resolveApproval|approval\\.resolve" src/daemon/queue.js` **恰好 1 命中（exit 0）**——合起来等价「经既有入口 + 不绕过会话校验」，字面量不在 queue.js 不算绕过（D-54）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6876ms
[语义复核：APPROVAL_SESSION_GONE 实际落点] grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js | exit=0 | 164ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6876ms
[架构#1] grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js | head -1 | 期望 exit 0 / 实测 exit 0
[架构#2] grep -REn "resolveApproval|approval\.resolve" src/daemon/queue.js | head -1 | 期望 exit 0 / 实测 exit 0
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.test-stdout.txt` | 4207 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.meta.json` | 2214 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.check.json` | 5730 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.output.json` | 12765 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=599.564137<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 304.554981<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-12 架构①（v11/D-54）：会话失效判定事实在核心（≥1 命中，exit 0） | ✅ | ``grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js \| head -1` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 6 | 架构检查 #2：AC-12 架构②（v11/D-54）：queue.js 只转发既有裁决入口（恰好 1 命中，exit 0） | ✅ | ``grep -REn "resolveApproval\|approval\.resolve" src/daemon/queue.js \| head -1` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 7 | 审批两用例存在（allow → approved / deny → denied，真实等待会话） | ✅ | `审批·允许：真实等待会话被放行并继续（AC-12 allow） \| 审批·拒绝：真实等待会话被拒绝（AC-12 deny）` | `allow/deny 两条用例` |
| 8 | allow/deny 用例数 2（期望逐字 2） | ✅ | `2` | `2` |
| 9 | A-4 审批结果行逐字 + 状态 approved/denied + 队列减 2（由用例承载） | ✅ | `# pass 16 / # fail 0` | `逐字「审批 APR-001 已通过 · 动作 write」/「已拒绝 · 动作 write」` |
| 10 | 语义复核：会话失效判定在核心 approvals/orchestrator（未绕过），queue.decideApproval 转发 approval.resolve | ✅ | `src/core/approvals.js:14:export const APPROVAL_SESSION_GONE = 'APPROVAL_SESSION_GONE'; \| src/core/approvals.js:99: * stay pending and the caller returns APPROVAL_SESSION_GONE. \| src/core/approvals.js:104:    return { o` | `orchestrator.js 调 approvals.APPROVAL_SESSION_GONE；queue.js:332 forward approval.resolve` |
| 11 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `两条分别在 2 秒内显示"审批 APR-001 已通过 · 动作 write"与"审批 APR-002 已拒绝 · 动作 write"（逐字见附录 A-4）；两条从队列消失；对应会话继续或被拒，实例状态按既有规则推进。` | `两条分别在 2 秒内显示"审批 APR-001 已通过 · 动作 write"与"审批 APR-002 已拒绝 · 动作 write"（逐字见附录 A-4）；两条从队列消失；对应会话继续或被拒，实例状态按既有规则推进。` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- D-54 裁决已落实：需求 v11 把 AC-12 架构锚点从 queue.js 归位核心（D-11 禁改核心，APPROVAL_SESSION_GONE 事实在 approvals.js:104 / orchestrator.js:4961），queue.js:332 只转发 approval.resolve。本用例按 v11 两条锚点判定：核心有会话校验 + queue.js 经既有入口——等价原语义「经 approval.resolve 且做会话校验」，不放宽行为判定（allow/deny 逐字 + 状态 + 队列减 2）。
- 逐字断言由 test/wp14/queue.test.js 的「审批·允许」「审批·拒绝」用例承载（走真实等待会话）；需求机检原文点名 queue-actions.test.js，本分支合并进 queue.test.js。

**⑤ 判定**：通过

---

#### AC-13 跨实例两条目分别处置：互不影响，三处数字各自同步

- 判定：**通过**（核对 10/10 通过）
- 证据分级：**mock 实测**
- 验证面：处置 / 一致性 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-cross` 项目根，两个实例：`INST-001` 有 1 条待处理升级 `ESC-001`（执行失败，当前第 1 轮），`INST-002` 有 1 条待审批 `APR-001`（动作 `write`）；队列显示 2 行；托盘显示"待处理升级 1"；列表 `INST-001` 行"待处理 1"、`INST-002` 行"待处理 1"；`NODE_ENV=test`。
- When 先在队列里对 `ESC-001` 点"重派"；看到结果后再对 `APR-001` 点"允许"。
- Then 第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` 0 / `INST-002` 1」，处置审批后为「队列 0 · 托盘 0 · `INST-002` 0」；两次都在 2 秒内看到结果，不出现"点一次改了两条"。

```
,**机检原文**：`test -f test/wp14/queue-cross.test.js`（或合并后的 `test/wp14/queue.test.js`）&& NODE_ENV=test node --test test/wp14/queue-cross.test.js`，断言三处数字序列为 `[[2,1,1,1],[1,0,0,1],[0,0,0,0]]`（依次＝队列总数 / 托盘待处理升级 / `INST-001` 待处理 / `INST-002` 待处理）、第一次后 `INST-002` 的节点轮次与审批状态未变、`resolution === 'retry'` 且审批状态为 `approved`；`# fail 0`。,
**架构检查原文**：每次处置必须按条目所属实例路由，不得一次调用改多个实例；多选与成组处置已在 D-01 移出范围：`grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/ | grep -vE ":\s*[0-9]+:\s*\*"` 必须**零命中（exit 1）**（排除否定语境的英文注释行，如 `(no batch)`；真实代码仍零命中，D-54）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6961ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6961ms
[架构#1] grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/ | grep -vE ":\s*[0-9]+:\s*\*" | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.test-stdout.txt` | 4205 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.meta.json` | 2214 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.check.json` | 6570 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.output.json` | 11530 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=606.245997<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 367.857565<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-13 架构（v11/D-54）：多选/成组处置零命中（排除否定语境注释行，exit 1） | ✅ | ``grep -REn "batch\|bulk\|multiSelect\|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/ \| grep -vE ":\s*[0-9]+:\s*\*"` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 需求 v10 机检逐字三处数字序列（Given：INST-001 升级 / INST-002 审批）（期望逐字 "[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"） | ✅ | `"[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"` | `"[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"` |
| 7 | 测试夹具序列与需求 Given 逐字一致（D-54：INST-001 升级 / INST-002 审批）（期望逐字 "[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"） | ✅ | `"[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"` | `"[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"` |
| 8 | AC-13 用例存在：跨实例分别处置互不影响、三处数字各自同步 | ✅ | `跨实例分别处置互不影响，三处数字各自同步（AC-13 / BR-12）` | `数字序列（夹具口径见备注）；resolution=retry 且审批 approved` |
| 9 | AC-13 机检通过（# fail 0）：resolution=retry / 审批 approved / 两实例互不影响 | ✅ | `# pass 16 / # fail 0` | `# fail 0` |
| 10 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` 0 / `INST-002` 1」，处置` | `第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` 0 / `INST-002` 1」，处置` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- D-54 裁决已落实：queue.test.js 的 AC-13 现场改为 INST-001 持升级、INST-002 持真实等待审批（startRun 分配 INST-002），三处数字序列 [[2,1,1,1],[1,0,0,1],[0,0,0,0]] 与需求 Given 逐字一致。
- D-54 裁决已落实：需求 v11 的架构检查排除否定语境注释行（`* (no batch)` 是「无批量」声明，非批量能力实现），真实代码零命中要求不放宽——按新锚点判定。原始命中帧仍留证于 arch-1.log。
- 需求机检原文点名 queue-cross.test.js，本分支（HEAD 2732f86）不存在该文件，AC-13 用例合并进 queue.test.js；本用例按实际存在文件机检并保留原始 TAP。三处数字「角色对调」差异请主控/终验按需求 Then Given 裁决；本验收不放宽任何断言。

**⑤ 判定**：通过

---

#### AC-14 处理后续跑与计数同步（规划验收句第 2 句的收尾条件）

- 判定：**通过**（核对 19/19 通过）
- 证据分级：**mock 实测**
- 验证面：处置 / 续跑 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-follow` 项目根，`INST-001` 因一次执行失败挂起、只有 1 条待处理升级；托盘显示待处理升级 1；列表该行"待处理 1"；`NODE_ENV=test`。
- When 点"重派"。
- Then 2 秒内条目消失；5 秒内实例自动继续推进（状态"运行中"、有新的会话事件），**不需要**再点任何"恢复"；托盘待处理升级数变为 0；列表该行"待处理 0"。

```
,**机检原文**：`test -f test/wp14/queue-follow.test.js && NODE_ENV=test node --test test/wp14/queue-follow.test.js`，断言 `t_resume - t_action ≤ 5000`、实例状态"运行中"、`tray-status.pendingEscalations === 0`、列表行"待处理 0"；三处数字相等；`# fail 0`。,
**架构检查原文**：续跑只能由既有裁决路径触发，队列层不得再调一次"恢复"；`grep -REn "workflow.resume" src/daemon/queue.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 e2e.test.js] test -f test/wp14/e2e.test.js && NODE_ENV=test node --test test/wp14/e2e.test.js | exit=0 | 2477ms
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6443ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 819ms
[机检] test -f test/wp14/e2e.test.js && NODE_ENV=test node --test test/wp14/e2e.test.js | exit=0 | # pass 6 / # fail 0 | 2477ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6443ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 819ms
[架构#1] grep -REn "workflow.resume" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-14/AC-14.test-stdout.txt` | 12144 B |
| `docs/iterations/iteration-11/evidence/AC-14/AC-14.state.json` | 5766 B |
| `docs/iterations/iteration-11/evidence/AC-14/AC-14.meta.json` | 2754 B |
| `docs/iterations/iteration-11/evidence/AC-14/AC-14.check.json` | 7163 B |
| `docs/iterations/iteration-11/evidence/AC-14/AC-14.output.json` | 32164 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 e2e.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=文唯一来源<br>  ---<br>  duration_ms: 26.493235<br>  type: 'test'<br>  ...<br># Subtest: NF-5 轻量版：20 次处置 + 30 次视图切换不崩、计数一致<br>ok 6 - NF-5 轻量版：20 次处置 + 30 次视图切换不崩、计数一致<br>  ---<br>  duration_ms: 1.899262<br>  typ` | `` |
| 2 | 机检 e2e.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 e2e.test.js：# pass ≥ 1 | ✅ | `# pass 6 / # tests 6` | `` |
| 4 | 机检 e2e.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=615.071721<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 333.698715<br>  type: 'test'` | `` |
| 6 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 8 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.908791<br>  type: 'test'<br>  ..` | `` |
| 10 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 11 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 12 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 13 | 架构检查 #1：AC-14 架构：续跑只由既有裁决路径触发，队列层不再调一次恢复，零命中（exit 1） | ✅ | ``grep -REn "workflow.resume" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 14 | 续跑真链路存在：AC-38 通知→队列处置→后续跑+三处数字同步 | ✅ | `AC-38：通知 → 队列处置 → 后续跑 + 三处数字同步（fixture 面真实链路）` | `含 AC-38 真链路用例` |
| 15 | 重派后实例自动继续推进（disk.state=running / resolution=retry / 无需点恢复） | ✅ | `# pass 6 / # fail 0` | `disk.state === running；resolution === retry；无额外恢复动作` |
| 16 | 三处数字同源：处置后队列计数 0 / 列表待处理 0 / 托盘「实例 1 · 待处理升级 0」 | ✅ | `# pass 6 / # fail 0` | `队列 pendingEscalations=0；item.pending.escalations=0；托盘「实例 1 · 待处理升级 0」` |
| 17 | D-39 重派数据侧：AC-10 retry 轮次+1 / 新会话 / 回运行中 / 队列条目消失 | ✅ | `升级·重派：轮次 +1、绑定新会话、实例回到运行中（AC-10）` | `resolution retry / round 2 / sessionId 非空 / state running / items 空` |
| 18 | A-4 结果行逐字由 daemon 结论词（ui-views A-4/AC-14 用例承载） | ✅ | `A-4 / AC-14: result lines use the daemon conclusion vocabulary` | `「升级 E-1 已处理（通过）」逐字，复用 RESOLUTION_LABEL` |
| 19 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `2 秒内条目消失；5 秒内实例自动继续推进（状态"运行中"、有新的会话事件），**不需要**再点任何"恢复"；托盘待处理升级数变为 0；列表该行"待处理 0"。` | `2 秒内条目消失；5 秒内实例自动继续推进（状态"运行中"、有新的会话事件），**不需要**再点任何"恢复"；托盘待处理升级数变为 0；列表该行"待处理 0"。` |

**备注**

- 机检 e2e.test.js：# tests 6 / # pass 6 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检文件名口径：需求点名 test/wp14/queue-follow.test.js（本分支不存在）；续跑真链路逐字断言合并进 test/wp14/e2e.test.js 的「AC-38：通知 → 队列处置 → 后续跑 + 三处数字同步」，重派数据侧在 test/wp14/queue.test.js 的「升级·重派」用例，A-4 结果行在 ui-views.test.js。按实际存在文件机检并保留原始 TAP，登记说明但不放宽。
- D-36 数字口径：三处数字按投影字段读取（tray.pending / item.pending.escalations / queue.totals.pendingEscalations），不在界面重算；本用例逐字登记三处相等，机检由 AC-38 与 AC-13 两用例承载。t_resume - t_action ≤ 5000 时效由 AC-38 真链路（≤5s SSE + 重派后立即回运行）承载，未另设独立秒表断言，如实登记。

**⑤ 判定**：通过

---

#### AC-15 重复 / 冲突处理：已处理就不重复写

- 判定：**通过**（核对 16/16 通过）
- 证据分级：**mock 实测**
- 验证面：异常 / 重复处置 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-conflict` 项目根，`INST-001`（`single`）有 1 条待处理升级 `ESC-001`，固定 `reasonCode: "rounds_exceeded"`（使"继续"可点，避免与 AC-44 的置灰规则冲突）；队列已打开；`NODE_ENV=test`。
- When 先在终端处置该条（`--decision retry`），再在面板上对仍显示的同一条点"继续"。
- Then 面板提示"已处理（重新分配），无需再次处理"（逐字见附录 **A-2**）；不产生第二次裁决；队列在 2 秒内自动刷新（该行消失）；实例状态与轮次只按终端那次变化。

```
,**机检原文**：`test -f test/wp14/queue-conflict.test.js && NODE_ENV=test node --test test/wp14/queue-conflict.test.js`，断言提示逐字、`counters` 中裁决次数为 1、节点轮次只 +1、队列刷新后条数为 0；`# fail 0`。,
**架构检查原文**：面板必须把核心返回的"已处理"状态映射为固定文案，不得自行判重（D-11 禁改核心，错误码事实在核心）；`grep -REn "ESCALATION_NOT_PENDING" src/core/escalation.js src/core/orchestrator.js | head -1` **≥1 命中（exit 0）** 且 `grep -REn "QUEUE_ERROR_CONCLUSIONS|DESKTOP_QUEUE_CONCLUSIONS" src/daemon/queue.js | head -1` **≥1 命中（exit 0）**——合起来等价「核心判重兜底 + 面板映射固定文案」，字面量不在 queue.js 不算绕过（D-55）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 5979ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 812ms
[语义复核：错误码与结论词实际落点] grep -REn "ESCALATION_NOT_PENDING" src/core/escalation.js src/core/orchestrator.js src/cli/labels.js | exit=0 | 189ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 5979ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 812ms
[架构#1] grep -REn "ESCALATION_NOT_PENDING" src/core/escalation.js src/core/orchestrator.js | head -1 | 期望 exit 0 / 实测 exit 0
[架构#2] grep -REn "QUEUE_ERROR_CONCLUSIONS|DESKTOP_QUEUE_CONCLUSIONS" src/daemon/queue.js | head -1 | 期望 exit 0 / 实测 exit 0
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-15/AC-15.test-stdout.txt` | 10661 B |
| `docs/iterations/iteration-11/evidence/AC-15/AC-15.state.json` | 4921 B |
| `docs/iterations/iteration-11/evidence/AC-15/AC-15.meta.json` | 2621 B |
| `docs/iterations/iteration-11/evidence/AC-15/AC-15.check.json` | 7284 B |
| `docs/iterations/iteration-11/evidence/AC-15/AC-15.output.json` | 29334 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=1481.159504<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 257.60199<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.422994<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-15 架构①（v12/D-55）：错误码事实在核心（≥1 命中，exit 0） | ✅ | ``grep -REn "ESCALATION_NOT_PENDING" src/core/escalation.js src/core/orchestrator.js \| head -1` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 10 | 架构检查 #2：AC-15 架构②（v12/D-55）：queue.js 按 code 映射固定结论词（≥1 命中，exit 0） | ✅ | ``grep -REn "QUEUE_ERROR_CONCLUSIONS\|DESKTOP_QUEUE_CONCLUSIONS" src/daemon/queue.js \| head -1` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 11 | AC-15 已处理不重复写用例存在：二次处置返回 ESCALATION_NOT_PENDING / conclusion 已处理 | ✅ | `已处理不重复写：二次处置返回固定结论且不再落盘（AC-15 / D-13 / BR-09）` | `second.code === ESCALATION_NOT_PENDING；second.conclusion === 已处理` |
| 12 | 只按终端首次处置变化：轮次只 +1 / resolution 仍 retry / 无第二次裁决 | ✅ | `# pass 16 / # fail 0` | `round===2；escalations[0].resolution===retry；状态不变` |
| 13 | A-2 提示逐字「已处理（重新分配），无需再次处理」由 ui-views A-2/AC-49 用例承载 | ✅ | `A-2 / AC-49: already-resolved notice is verbatim from the daemon conclusion` | `outcome.text === 已处理（重新分配），无需再次处理` |
| 14 | 队列 2 秒内自动刷新该行消失 | ✅ | `# pass 16 / # fail 0` | `处置后队列条数为 0` |
| 15 | 语义复核：错误码在核心产生、结论词由 labels.js 映射（queue.js 经 QUEUE_ERROR_CONCLUSIONS 透传） | ✅ | `src/core/escalation.js:89:  if (!entry \|\| entry.state !== 'pending') return { ok: false, code: 'ESCALATION_NOT_PENDING' }; \| src/core/orchestrator.js:5049:      return fail('ESCALATION_NOT_PENDING', { escalationId, st` | `core 产生错误码；labels.js:949 ESCALATION_NOT_PENDING: 已处理；queue.js:50 QUEUE_ERROR_CONCLUSIONS 同源引用` |
| 16 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `面板提示"已处理（重新分配），无需再次处理"（逐字见附录 **A-2**）；不产生第二次裁决；队列在 2 秒内自动刷新（该行消失）；实例状态与轮次只按终端那次变化。` | `面板提示"已处理（重新分配），无需再次处理"（逐字见附录 **A-2**）；不产生第二次裁决；队列在 2 秒内自动刷新（该行消失）；实例状态与轮次只按终端那次变化。` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 机检文件名口径：需求点名 test/wp14/queue-conflict.test.js（本分支不存在），AC-15 逐字断言合并进 test/wp14/queue.test.js「已处理不重复写」用例；提示文案逐字由 ui-views.test.js「A-2 / AC-49: already-resolved notice is verbatim」承载。按实际文件机检并登记说明，不放宽。
- D-55 裁决已落实：需求 v12 把 AC-15 架构锚点从 queue.js 归位核心（D-11 禁改核心：错误码在 escalation.js:89 / orchestrator.js:5049），queue.js:50 以 QUEUE_ERROR_CONCLUSIONS = DESKTOP_QUEUE_CONCLUSIONS 同源引用、:260 按 code 取「已处理」——两条新锚点合起来等价原语义「核心判重兜底 + 面板映射固定文案」，行为判定不放宽。

**⑤ 判定**：通过

---

#### AC-16 动作与类型错配、实例未挂起、审批会话失效三条异常

- 判定：**通过**（核对 19/19 通过）
- 证据分级：**mock 实测**
- 验证面：异常 / 边界 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-invalid` 项目根，三个现场：① 一条审批行被刷新成升级行（模拟数据错配）；② 升级条目存在但实例已被别处恢复为"运行中"；③ 审批条目存在但对应会话已结束。
- When 依次点动作；随后清点队列行上提供的动作，并检查是否存在"判失败""改轮次上限""改超时""调并发"一类入口。
- Then 依次显示"升级 ESC-002 不支持该动作"、`实例 INST-001 当前不是挂起状态，不能处理升级`、`审批 APR-003 已失效：会话不在运行`（逐字见附录 A-5）；三次都不改变实例状态、不关闭队列、不清空已展开的那一条（一次只处置一条，不存在多选状态），且**状态词逐字不变**——`INST-001` 仍为「运行中」、`ESC-002` 仍为「待处理」、`APR-003` 仍为「待处理」（BR-27）；队列提供的动作恰为继续 / 重派 / 终止 / 允许 / 拒绝五种，界面上不存在判失败、轮次上限、超时、并发等编辑入口。

```
,**机检原文**：`test -f test/wp14/queue-conflict.test.js && NODE_ENV=test node --test test/wp14/queue-conflict.test.js`，断言三条文案逐字、三次操作后实例状态与审批状态不变、**三条状态词逐字不变（`运行中` / `待处理` / `待处理`）**、已展开条目的详情仍在、动作集合恰为 5 个且不含 `fail` / `round` / `timeout` / `concurrency` 键；`# fail 0`。,
**架构检查原文**：三条错误文案必须来自既有 `ERROR_TEMPLATE` / `COMMAND_ERROR` 或 `labels.js` 新增键，不得在界面层拼接中文；`grep -REn "不能处理|已失效" desktop/ui` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6026ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 803ms
[语义复核：APPROVAL_SESSION_GONE 实际落点在核心] grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js | exit=0 | 184ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6026ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 803ms
[架构#1] grep -REn "不能处理|已失效" desktop/ui | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-16/AC-16.test-stdout.txt` | 10661 B |
| `docs/iterations/iteration-11/evidence/AC-16/AC-16.state.json` | 4921 B |
| `docs/iterations/iteration-11/evidence/AC-16/AC-16.meta.json` | 2452 B |
| `docs/iterations/iteration-11/evidence/AC-16/AC-16.check.json` | 9549 B |
| `docs/iterations/iteration-11/evidence/AC-16/AC-16.output.json` | 28623 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=531.004115<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 283.341213<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.430783<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-16 架构：错误文案来自既有 ERROR_TEMPLATE/labels.js，不在界面层拼接中文，零命中（exit 1） | ✅ | ``grep -REn "不能处理\|已失效" desktop/ui` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 10 | AC-16① 动作错配：返回 ACTION_NOT_SUPPORTED 且状态不变 | ✅ | `动作错配：审批行点升级动作 / 升级行点审批动作 → ACTION_NOT_SUPPORTED（AC-16①）` | `wrongType.code === ACTION_NOT_SUPPORTED；state suspended 不变` |
| 11 | AC-16② 未挂起：返回 INSTANCE_NOT_SUSPENDED、结论「不是挂起状态」、原状态不变 | ✅ | `实例未挂起：固定结论且原状态不变（AC-16②）` | `code === INSTANCE_NOT_SUSPENDED；conclusion === 不是挂起状态；state running 不变` |
| 12 | AC-16③ 会话失效：返回 APPROVAL_SESSION_GONE、结论已失效、行仍待处理（D-54 锚点在核心） | ✅ | `审批会话失效：返回已失效且行仍待处理（AC-16③）` | `code === APPROVAL_SESSION_GONE；conclusion === 已失效；approvals[0].state === pending` |
| 13 | A-5 三条文案①逐字「升级 ESC-002 不支持该动作」（期望逐字 "升级 ESC-002 不支持该动作"） | ✅ | `"升级 ESC-002 不支持该动作"` | `"升级 ESC-002 不支持该动作"` |
| 14 | A-5 三条文案②逐字「实例 INST-001 当前不是挂起状态，不能处理升级」（期望逐字 "实例 INST-001 当前不是挂起状态，不能处理升级"） | ✅ | `"实例 INST-001 当前不是挂起状态，不能处理升级"` | `"实例 INST-001 当前不是挂起状态，不能处理升级"` |
| 15 | A-5 三条文案③逐字「审批 APR-003 已失效：会话不在运行」（期望逐字 "审批 APR-003 已失效：会话不在运行"） | ✅ | `"审批 APR-003 已失效：会话不在运行"` | `"审批 APR-003 已失效：会话不在运行"` |
| 16 | 三条状态词逐字不变（BR-27）：INST-001 运行中 / ESC-002 待处理 / APR-003 待处理 | ✅ | `# pass 16 / # fail 0` | `三次操作后 state/approvals/escalations 均不变、状态词逐字不变` |
| 17 | 动作集合恰为 5 个（继续/重派/终止/允许/拒绝），不含 fail/round/timeout/concurrency | ✅ | `A-4 / AC-08: CONTROLS is the closed action list; per-type actions fixed` | `CONTROLS 闭合动作表恰 5，界面无判失败/轮次上限/超时/并发入口` |
| 18 | D-54：会话失效判定事实在核心 approvals/orchestrator（不在界面层拼接） | ✅ | `src/core/approvals.js:14:export const APPROVAL_SESSION_GONE = 'APPROVAL_SESSION_GONE'; \| src/core/approvals.js:99: * stay pending and the caller returns APPROVAL_SESSION_GONE. \| src/core/approvals.js:104:    return { o` | `core/approvals.js 与 core/orchestrator.js 引用 APPROVAL_SESSION_GONE` |
| 19 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `依次显示"升级 ESC-002 不支持该动作"、`实例 INST-001 当前不是挂起状态，不能处理升级`、`审批 APR-003 已失效：会话不在运行`（逐字见附录 A-5）；三次都不改变实例状态、不关闭队列、不清空已展开的那一条（一次只处置一条，不存在多选状态），且**状态词逐字不变**——`INST-001` 仍为「运行中」、`ESC-002` 仍为「待处理」、`APR-003` 仍为「待处理」（BR-27）；队列提供的动作恰为继` | `依次显示"升级 ESC-002 不支持该动作"、`实例 INST-001 当前不是挂起状态，不能处理升级`、`审批 APR-003 已失效：会话不在运行`（逐字见附录 A-5）；三次都不改变实例状态、不关闭队列、不清空已展开的那一条（一次只处置一条，不存在多选状态），且**状态词逐字不变**——`INST-001` 仍为「运行中」、`ESC-002` 仍为「待处理」、`APR-003` 仍为「待处理」（BR-27）；队列提供的动作恰为继` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 3 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 机检文件名口径：需求点名 test/wp14/queue-conflict.test.js（本分支不存在），AC-16 三异常逐字断言合并进 test/wp14/queue.test.js 三条「AC-16①/②/③」用例；动作集合与状态词由 ui-views.test.js「A-4 / AC-08: CONTROLS」承载。按实际文件机检并登记说明，不放宽。
- D-54 裁决已落实：会话失效码 APPROVAL_SESSION_GONE 的判定事实在核心（approvals.js / orchestrator.js），queue.js 只经既有裁决入口；本用例按 v11 口径核对「核心有会话校验 + 界面不拼接中文」，不放宽三条异常的逐字结论与状态词断言。

**⑤ 判定**：通过

---

#### AC-17 队列与 CLI 同源：同一时点结论一致

- 判定：**通过**（核对 12/12 通过）
- 证据分级：**mock 实测**
- 验证面：一致性 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-consistency` 项目根，两个实例各有待处理升级与审批；`NODE_ENV=test`。
- When 同一时点分别导出队列行与执行 `orch escalate list` / `orch status --instance`。
- Then **条目集合与字段值**完全一致：编号集合、实例号、节点号、轮次、状态词、结论逐项相等；**审批行只比字段值、不比字符串**——桌面审批行按 A-3 的自有模板渲染，段序与分隔符按桌面约定（` · `），比 CLI 多出实例号 / 轮次 / 产生时间三个字段，**不与 CLI 逐字相同**（CLI 输出本身不改，见 BR-31）；升级行同样只比字段值（分隔符按桌面约定，CLI 保留既有两空格）。不存在"某条目只在面板出现、CLI 查不到"或反之。

```
,**机检原文**：`test -f test/wp14/queue-consistency.test.js && NODE_ENV=test node --test test/wp14/queue-consistency.test.js`，断言两侧条目编号集合相等；**两侧行各按本侧分隔符拆**（D-37）：CLI 升级行按**两个空格**（`\s{2,}`）拆成 5 段（`升级 {编号}` / `实例 {实例号}` / `节点 {节点号} {角色} · 第 {n} 轮` / `状态词` / `原因摘要`），桌面升级行按 ` · ` 拆成 7 段；两侧先归一化为 `{编号, 实例号, 节点号, 轮次, 状态词, 原因摘要}` 再**逐项相等**。CLI 审批行按 ` · ` 拆、只比 `{编号, 状态词, 动作}`；桌面审批行按 ` · ` 拆 7 段，多出的实例号 / 轮次 / 时间三字段**不参与**与 CLI 的相等比较，但必须存在且非空；**不出现「审批行字符串相等」这类断言**；`# fail 0`。CLI 侧分隔符的基线事实（实跑）：`sed -n '1256,1280p' src/cli/render.js | grep -Ec "join\('  '\)"` → **1**（`renderEscalationListRow` 的两个空格拼接）；`grep -REn "parts.join\(' · '\)" src/cli/render.js` 命中 4 处，其中 `1155` 是 `renderApprovalLine`。,
**架构检查原文**：队列与 CLI 必须消费同一份核心快照字段，不得各算一套；`grep -REn "ESC-|APR-" src/daemon/queue.js` 必须**零命中（exit 1）**（不得用编号格式推断状态）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6142ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6142ms
[架构#1] grep -REn "ESC-|APR-" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
[架构#2] sed -n '1256,1280p' src/cli/render.js | grep -Ec "join\('  '\)" | 期望 exit 0 / 实测 exit 0
[架构#3] grep -REn "parts.join\(' · '\)" src/cli/render.js | 期望 exit 0 / 实测 exit 0
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-17/AC-17.test-stdout.txt` | 4204 B |
| `docs/iterations/iteration-11/evidence/AC-17/AC-17.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-17/AC-17.meta.json` | 2397 B |
| `docs/iterations/iteration-11/evidence/AC-17/AC-17.check.json` | 7281 B |
| `docs/iterations/iteration-11/evidence/AC-17/AC-17.output.json` | 12306 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=546.385656<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 292.755603<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-17 架构：不得用编号格式推断状态，零命中（exit 1） | ✅ | ``grep -REn "ESC-\|APR-" src/daemon/queue.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 架构检查 #2：AC-17 CLI 基线①：renderEscalationListRow 两个空格拼接恰好 1 处（exit 0） | ✅ | ``sed -n '1256,1280p' src/cli/render.js \| grep -Ec "join\('  '\)"` → exit 0 / 恰好 1 行 / 含「1」；实测 exit 0 / 1 行` | `exit 0` |
| 7 | 架构检查 #3：AC-17 CLI 基线②：parts.join( · ) 命中 4 处，含 1155 renderApprovalLine（exit 0） | ✅ | ``grep -REn "parts.join\(' · '\)" src/cli/render.js` → exit 0 / 恰好 4 行；实测 exit 0 / 4 行` | `exit 0` |
| 8 | AC-17 同源用例存在：条目编号集合相等、字段值逐项相等 | ✅ | `队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）` | `两侧编号集合 [ESC-001, APR-001] 相等；六字段逐项相等` |
| 9 | D-37 两侧按本侧分隔符拆：CLI 升级行两空格 5 段 / 桌面 · 7 段，归一化为六元组逐项相等 | ✅ | `# pass 16 / # fail 0` | `CLI escParts.length===5；queue 条目逐项 deepEqual` |
| 10 | 审批行只比字段值不比字符串：CLI 审批 3 段只比 {编号,状态词,动作}；桌面多出实例/轮次/时间三字段但不参与相等 | ✅ | `# pass 16 / # fail 0` | `aprParts.length===3；assert.notEqual(cliApproval, queueReasonSummary)；桌面三字段非空` |
| 11 | 不存在「某条目只在面板出现、CLI 查不到」或反之 | ✅ | `# pass 16 / # fail 0` | `编号集合相等；# fail 0` |
| 12 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `**条目集合与字段值**完全一致：编号集合、实例号、节点号、轮次、状态词、结论逐项相等；**审批行只比字段值、不比字符串**——桌面审批行按 A-3 的自有模板渲染，段序与分隔符按桌面约定（` · `），比 CLI 多出实例号 / 轮次 / 产生时间三个字段，**不与 CLI 逐字相同**（CLI 输出本身不改，见 BR-31）；升级行同样只比字段值（分隔符按桌面约定，CLI 保留既有两空格）。不存在"某条目只在面板出现、CLI 查不到` | `**条目集合与字段值**完全一致：编号集合、实例号、节点号、轮次、状态词、结论逐项相等；**审批行只比字段值、不比字符串**——桌面审批行按 A-3 的自有模板渲染，段序与分隔符按桌面约定（` · `），比 CLI 多出实例号 / 轮次 / 产生时间三个字段，**不与 CLI 逐字相同**（CLI 输出本身不改，见 BR-31）；升级行同样只比字段值（分隔符按桌面约定，CLI 保留既有两空格）。不存在"某条目只在面板出现、CLI 查不到` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检文件名口径：需求点名 test/wp14/queue-consistency.test.js（本分支不存在），AC-17 逐字断言合并进 test/wp14/queue.test.js「队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）」用例。按实际文件机检并登记说明，不放宽。
- D-22/D-37 口径：不比整行字符串——CLI 升级行按两个空格（\s{2,}）拆 5 段，桌面升级行按 · 拆 7 段，先归一化为 {编号,实例号,节点号,轮次,状态词,原因摘要} 再逐项相等；CLI 审批行按 · 拆只比 {编号,状态词,动作}，桌面审批行多出的实例/轮次/时间三字段须存在非空但不参与相等。CLI 分隔符基线由本用例两条 arch 锚点复核，未出现字符串相等断言。

**⑤ 判定**：通过

---

#### AC-18 三处数字一致：队列、托盘、列表

- 判定：**通过**（核对 21/21 通过）
- 证据分级：**mock 实测**
- 验证面：一致性 / 计数 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-count` 项目根，`INST-001` 有 2 条待处理升级 + 1 条待审批，`INST-002` 有 1 条待审批；`NODE_ENV=test`。
- When 同一时点读取队列总条数、托盘信息行、列表两行的"待处理数"；然后处置一条升级，再处置一条审批。
- Then 初始队列 = 4，且**队列总条数恰等于各实例「待处理数」之和**（3 + 1 = 4）；托盘"待处理升级 M"中的 M = 2（只数升级）；列表 `INST-001` 为 3、`INST-002` 为 1；处置一条升级后 2 秒内队列 3、托盘 1、`INST-001` 行 2；再处置一条审批后队列 2、托盘仍为 1（审批不计入托盘升级数）、`INST-001` 行 1。

```
,**机检原文**：`test -f test/wp14/queue-count.test.js && NODE_ENV=test node --test test/wp14/queue-count.test.js`，断言三处数字集合与处置前后的差值，并断言同一时点 `queue.total === instances.map(i => i.pendingCount).reduce((a, b) => a + b, 0)`；`# fail 0`。,
**架构检查原文**：三处数字必须来自同一份投影，不得各自计数。`pendingEscalations` 的基线事实是 **`src/daemon` 5 行、全仓 3 处计数**：核心 `src/core/orchestrator.js:4180`（内存快照）与持久化 `src/persistence/instance-store.js:482–485`（磁盘回退）各算一次，**daemon 的 `shapeSnapshot`（`src/daemon/server.js:900–912`）还有一处 `: escalations.filter(...).length` 回退计数**。因此断言锁定的是「界面零计算 + daemon 的计数只许留在 `shapeSnapshot` 内」，不是「daemon 一律只透传」：,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6745ms
[机检 e2e.test.js] test -f test/wp14/e2e.test.js && NODE_ENV=test node --test test/wp14/e2e.test.js | exit=0 | 2526ms
[语义复核：arch⑤ 桌面壳层命中原文] grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src | exit=0 | 197ms
[语义复核：tray.pending 取值来源（daemon 投影 vs 壳层自算）] sed -n '296,306p' desktop/src-tauri/src/main.rs | exit=0 | 183ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6745ms
[机检] test -f test/wp14/e2e.test.js && NODE_ENV=test node --test test/wp14/e2e.test.js | exit=0 | # pass 6 / # fail 0 | 2526ms
[架构#1] grep -REn "pendingEscalations" src/daemon/ | 期望 exit 0 / 实测 exit 0
[架构#2] grep -REn -A3 "pendingEscalations" src/daemon/ | 期望 exit 0 / 实测 exit 0
[架构#3] node --input-type=module -e 'import fs from "node:fs";import path from "node:path";const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap((e)=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);const COUNT=/(\.filter\(|\.reduce\(|\.length|\+= *1|\.push\()/;const hits=[];for(const f of walk("src/daemon").filter((x)=>x.endsWith(".js"))){const lines=fs.readFileSync(f,"utf8").split("\n");let fn="<top>";for(let i=0;i<lines.length;i++){const m=lines[i].match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);if(m)fn=m[1];if(!lines[i].includes("pendingEscalations"))continue;hits.push({f,line:i+1,fn,count:COUNT.test(lines.slice(i,i+4).join("\n"))});}}const bad=hits.filter((h)=>h.count&&h.fn!=="shapeSnapshot");console.log("occurrences="+hits.length+" countExpr="+hits.filter((h)=>h.count).length+" outsideShapeSnapshot="+bad.length);process.exit(bad.length===0?0:1)' | 期望 exit 0 / 实测 exit 0
[架构#4] grep -REn "escalations[.]filter|escalations[.]reduce" src/daemon/ | 期望 exit 0 / 实测 exit 0
[架构#5] grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src | grep -vE ":\s*[0-9]+:\s*(//|\*)" | grep -vE "\"pendingEscalations\"\s*:" | 期望 exit 1 / 实测 exit 1
[架构#6] grep -REn "escalations[.]filter" desktop/ui/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-18/AC-18.test-stdout.txt` | 5691 B |
| `docs/iterations/iteration-11/evidence/AC-18/AC-18.state.json` | 2981 B |
| `docs/iterations/iteration-11/evidence/AC-18/AC-18.meta.json` | 4693 B |
| `docs/iterations/iteration-11/evidence/AC-18/AC-18.check.json` | 11031 B |
| `docs/iterations/iteration-11/evidence/AC-18/AC-18.output.json` | 23331 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=666.098726<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 215.537691<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 e2e.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=文唯一来源<br>  ---<br>  duration_ms: 24.905719<br>  type: 'test'<br>  ...<br># Subtest: NF-5 轻量版：20 次处置 + 30 次视图切换不崩、计数一致<br>ok 6 - NF-5 轻量版：20 次处置 + 30 次视图切换不崩、计数一致<br>  ---<br>  duration_ms: 1.845495<br>  typ` | `` |
| 6 | 机检 e2e.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 e2e.test.js：# pass ≥ 1 | ✅ | `# pass 6 / # tests 6` | `` |
| 8 | 机检 e2e.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-18 架构①：daemon 透传行存在（基线 5 行；D-53 行号漂移后实测 9 行，允许新增同类透传，不得新增计数表达式），有命中 exit 0 | ✅ | ``grep -REn "pendingEscalations" src/daemon/` → exit 0 / 恰好 9 行；实测 exit 0 / 9 行` | `exit 0` |
| 10 | 架构检查 #2：AC-18 架构②：多行感知检出跨行计数表达式（server.js shapeSnapshot 回退，基线 905→现 1023 行按 D-53 漂移） | ✅ | ``grep -REn -A3 "pendingEscalations" src/daemon/` → exit 0 / 恰好 34 行 / 含「escalations.filter((entry) => entry?.state === 'pending').length」；实测 exit 0 / 34 行` | `exit 0` |
| 11 | 架构检查 #3：AC-18 架构③：函数体切块——daemon 计数表达式只许在 shapeSnapshot 内（D-36，单行 grep 假阴性已弃用） | ✅ | ``node --input-type=module -e 'import fs from "node:fs";import path from "node:path";const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap((e)=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);con` | `exit 0` |
| 12 | 架构检查 #4：AC-18 架构④：escalations.filter/reduce 恰好 1 条（server.js:1023 回退计数），不得新增第二条 | ✅ | ``grep -REn "escalations[.]filter\|escalations[.]reduce" src/daemon/` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 13 | 架构检查 #5：AC-18 架构⑤（v12/D-55）：界面与壳层零自算——排除 //、///、* 注释行与 D-9 要求下发的 tray-status 探针字段名（真实计数表达式仍零命中，exit 1） | ✅ | ``grep -REn "pendingEscalations" desktop/ui desktop/src-tauri/src \| grep -vE ":\s*[0-9]+:\s*(//\|\*)" \| grep -vE "\"pendingEscalations\"\s*:"` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 14 | 架构检查 #6：AC-18 架构⑥：界面不按条目数组自行过滤计数，零命中（exit 1） | ✅ | ``grep -REn "escalations[.]filter" desktop/ui/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 15 | 三处数字逐字（需求 Then）：初始 队列4 / 托盘2 / INST-001=3 / INST-002=1（3+1=4） | ✅ | `queue # pass 16 / e2e # pass 6` | `queue.total === Σ instances.pendingCount = 3+1 = 4；tray 待处理升级 M=2（只数升级）` |
| 16 | 处置一条升级后：队列 3 / 托盘 1 / INST-001 行 2（2 秒内同步） | ✅ | `# pass queue 16 / e2e 6` | `处置升级后 队列3 / 托盘1 / INST-001 行2` |
| 17 | 再处置一条审批后：队列 2 / 托盘仍 1（审批不计入托盘升级数）/ INST-001 行 1 | ✅ | `# pass queue 16 / e2e 6` | `处置审批后 队列2 / 托盘1 / INST-001 行1` |
| 18 | D-36 数据侧：queue.test.js totals 只读快照字段不重算（pendingEscalations=5 直接透传） | ✅ | `buildQueue：totals 只读既有快照计数字段，不按数组重算（D-36 / AC-18 数据侧）` | `queue.totals.pendingEscalations === 5（快照字段，非 filter 计数）` |
| 19 | AC-13 三处数字各自同步用例存在（机检序列由该用例 + AC-38 承载） | ✅ | `跨实例分别处置互不影响，三处数字各自同步（AC-13 / BR-12）` | `countsOf 三处数字序列；机检由 queue.test.js 承载` |
| 20 | 语义复核：arch⑤ 命中为探针字段名/注释，pending 来自 daemon 投影 item.pending.escalations（非壳层自算） | ✅ | `desktop/src-tauri/src/tray.rs:103:/// Emit the `tray-status` probe line (D-9: instances / pendingEscalations / \| desktop/src-tauri/src/tray.rs:113:            "pendingEscalations": tray.pending, \|\| let token = meta.ge` | `tray.rs:103 注释 + tray.rs:113 探针字段名（§3.3 要求）；main.rs 读 item.pending.escalations 下发` |
| 21 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `初始队列 = 4，且**队列总条数恰等于各实例「待处理数」之和**（3 + 1 = 4）；托盘"待处理升级 M"中的 M = 2（只数升级）；列表 `INST-001` 为 3、`INST-002` 为 1；处置一条升级后 2 秒内队列 3、托盘 1、`INST-001` 行 2；再处置一条审批后队列 2、托盘仍为 1（审批不计入托盘升级数）、`INST-001` 行 1。` | `初始队列 = 4，且**队列总条数恰等于各实例「待处理数」之和**（3 + 1 = 4）；托盘"待处理升级 M"中的 M = 2（只数升级）；列表 `INST-001` 为 3、`INST-002` 为 1；处置一条升级后 2 秒内队列 3、托盘 1、`INST-001` 行 2；再处置一条审批后队列 2、托盘仍为 1（审批不计入托盘升级数）、`INST-001` 行 1。` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检 e2e.test.js：# tests 6 / # pass 6 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 机检文件名口径：需求点名 test/wp14/queue-count.test.js（本分支不存在），三处数字断言合并进 test/wp14/queue.test.js「跨实例分别处置互不影响，三处数字各自同步（AC-13）」+「buildQueue totals 只读快照字段（D-36 / AC-18 数据侧）」+ test/wp14/e2e.test.js「AC-38 三处数字同步」真链路。按实际文件机检并登记说明，不放宽。
- D-36/D-53 口径：单行 grep 判零计数是假阴性（server.js:905 跨行表达式漏检），已改用函数体切块脚本（arch③）；shapeSnapshot 行号随迭代漂移（基线 900→当前 1018），按函数体锚点而非行号判定。arch③ 实测 occurrences=9 / countExpr=2 / outsideShapeSnapshot=0（基线 occurrences=5，新增 4 行均为同类透传，D-36 允许）；core/persistence 既有计数与 shapeSnapshot 未改（D-36/D-11 未授权改）。
- D-55 裁决已落实：需求 v12 把架构⑤从「pendingEscalations 字面零命中」改为「零自算」——排除注释行与 D-9/§3.3 明确要求下发的 tray-status 探针字段名（main.rs:300 从 daemon 投影 item.pending.escalations 读取，壳层不计数）。①~④ 多行感知 + 函数体切块 + 真实计数表达式零命中断言全部保留，界面/壳层零自算语义不放宽。

**⑤ 判定**：通过

---

#### AC-19 角色库列表：来源、分组与校验状态

- 判定：**通过**（核对 14/14 通过）
- 证据分级：**mock 实测**
- 验证面：资产库 / 列表 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets` 项目根，内置角色若干 + 2 个项目角色（1 个校验通过、1 个技能引用缺失）；另有内置技能若干 + 1 个项目技能、内置工作流若干 + 1 个项目工作流；`NODE_ENV=test`。
- When 依次打开角色库分页、技能库分页、工作流库分页。
- Then **三个分页各自的计数行**都显示出来并自洽：`角色 {total} 个（内置 {builtin} · 项目 {project}）`、`技能 {total} 个（内置 {builtin} · 项目 {project}）`、`工作流 {total} 个（内置 {builtin} · 项目 {project}）`；角色行给出名称、分组、来源、校验状态（通过 / 不通过），逐字匹配附录 A-5；两个项目角色都在列表里，缺失技能的那个标"不通过"。

```
,**机检原文**：`test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js`，用 `desktop/harness/assets-dump.mjs` 导出**三个分页**的计数行与列表，逐字比对附录 A-5；断言三处计数行的 `total === builtin + project` 且与各自行数自洽；`# fail 0`。,
**架构检查原文**：列表投影复用既有注册表读取与校验结果，不在界面层重跑 schema 校验；`grep -REn "yaml|readFile" desktop/ui/assets/` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 1040ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 836ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 1040ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 836ms
[架构#1] grep -REn "yaml|readFile" desktop/ui/assets/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-19/AC-19.test-stdout.txt` | 8781 B |
| `docs/iterations/iteration-11/evidence/AC-19/AC-19.state.json` | 4119 B |
| `docs/iterations/iteration-11/evidence/AC-19/AC-19.meta.json` | 1941 B |
| `docs/iterations/iteration-11/evidence/AC-19/AC-19.check.json` | 6509 B |
| `docs/iterations/iteration-11/evidence/AC-19/AC-19.output.json` | 23291 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 41.147353<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 12.767729<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.464133<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-19 架构：列表投影复用既有注册表读取与校验结果，不在界面层重跑 schema 校验，零命中（exit 1） | ✅ | ``grep -REn "yaml\|readFile" desktop/ui/assets/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 10 | AC-19 三类列表用例存在：来源/分组/校验状态与计数自洽 | ✅ | `AC-19 三类列表：来源、分组、校验状态与计数自洽` | `三处分页 total === builtin + project 且与行数自洽` |
| 11 | 三个分页计数行自洽：角色/技能/工作流各自 total = builtin + project | ✅ | `# pass 10 / # fail 0` | `roles/skills/workflows 三处 counts.total === builtin + project` |
| 12 | 角色行给名称/分组/来源/校验状态，缺失技能那个标不通过 | ✅ | `# pass 10 / # fail 0` | `proj-coder 通过 / proj-gap（skills:[not-exist]）不通过` |
| 13 | A-5 计数行逐字「角色 {total} 个（内置 {builtin} · 项目 {project}）」等三处（ui-views 逐字用例承载） | ✅ | `A-5: three tabs, count line, rows and unreadable banners are verbatim` | `「角色 12 个（内置 9 · 项目 3）」逐字；资产行「角色 开发 · 编码工程 · 项目 · 通过」` |
| 14 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `**三个分页各自的计数行**都显示出来并自洽：`角色 {total} 个（内置 {builtin} · 项目 {project}）`、`技能 {total} 个（内置 {builtin} · 项目 {project}）`、`工作流 {total} 个（内置 {builtin} · 项目 {project}）`；角色行给出名称、分组、来源、校验状态（通过 / 不通过），逐字匹配附录 A-5；两个项目角色都在列表里，缺失技能的那个标"不通过` | `**三个分页各自的计数行**都显示出来并自洽：`角色 {total} 个（内置 {builtin} · 项目 {project}）`、`技能 {total} 个（内置 {builtin} · 项目 {project}）`、`工作流 {total} 个（内置 {builtin} · 项目 {project}）`；角色行给出名称、分组、来源、校验状态（通过 / 不通过），逐字匹配附录 A-5；两个项目角色都在列表里，缺失技能的那个标"不通过` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 0 条。
- 逐字断言由 test/wp14/assets.test.js 的 AC-19 用例（计数自洽、来源/分组/校验状态）与 ui-views.test.js 的「A-5: three tabs, count line, rows and unreadable banners are verbatim」承载；harness assets-dump 同模块导出计数行（ui-views「harness: assets-dump exports tabs + count verbatim」复核）。

**⑤ 判定**：通过

---

#### AC-20 角色详情：契约要点与技能引用

- 判定：**通过**（核对 10/10 通过）
- 证据分级：**mock 实测**
- 验证面：资产库 / 详情 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets-role` 项目根，一个角色声明：分组编码工程、产物类型 `code`、副作用 `high`、最大并发 2、技能两个（其中一个缺失）、工具集 3 项、唤醒白名单 2 项；`NODE_ENV=test`。
- When 打开该角色详情。
- Then 逐项显示上述字段；缺失技能标"缺失"并给出该技能名；校验状态为"不通过"且给出原因（复用既有校验文案原文）。

```
,**机检原文**：`test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js`，断言详情字段逐字匹配附录 A-5 的详情块、缺失标记存在、校验原因与 `orch role validate` 原文相同；`# fail 0`。,
**架构检查原文**：详情字段只读注册表与校验输出，不新增派生结论；`grep -REn "worktree|versioned|snapshot" desktop/ui/assets/` 必须**零命中（exit 1）**（不得在界面层推断产物隔离方式）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 928ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 928ms
[架构#1] grep -REn "worktree|versioned|snapshot" desktop/ui/assets/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-20/AC-20.test-stdout.txt` | 2324 B |
| `docs/iterations/iteration-11/evidence/AC-20/AC-20.state.json` | 1334 B |
| `docs/iterations/iteration-11/evidence/AC-20/AC-20.meta.json` | 1643 B |
| `docs/iterations/iteration-11/evidence/AC-20/AC-20.check.json` | 4624 B |
| `docs/iterations/iteration-11/evidence/AC-20/AC-20.output.json` | 6832 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 38.364735<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 11.958591<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-20 架构：详情字段只读注册表与校验输出，不在界面层推断产物隔离方式，零命中（exit 1） | ✅ | ``grep -REn "worktree\|versioned\|snapshot" desktop/ui/assets/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | AC-20 角色详情用例存在：契约要点逐项显示（分组/产物/副作用/并发/技能/工具/唤醒） | ✅ | `AC-20 角色详情：契约要点透传、缺失技能标注、原因与 CLI 原文一致` | `artifactType=code / sideEffect=write / maxConcurrentSessions=2 / tools 3 项 / wakeAllow 2 项` |
| 7 | A-5 详情块逐字：产物 code · 副作用 write · 并发 2 / 技能引用 2 个 / 工具 / 唤醒 | ✅ | `# pass 10 / # fail 0` | `「角色 开发 · 编码工程 · 产物 code · 副作用 write · 并发 2」等 A-5 详情块逐字` |
| 8 | 缺失技能标「缺失」并给出技能名（A-5 状态词） | ✅ | `# pass 10 / # fail 0` | `skills[1] === { id: missing-skill, missing: true }；界面渲染「s2 · 缺失」` |
| 9 | 校验状态「不通过」且原因与 CLI `orch role validate` 原文逐字相同 | ✅ | `# pass 10 / # fail 0` | `reason === 引用的技能不存在：missing-skill（与 detailOf 同一组装函数）` |
| 10 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `逐项显示上述字段；缺失技能标"缺失"并给出该技能名；校验状态为"不通过"且给出原因（复用既有校验文案原文）。` | `逐项显示上述字段；缺失技能标"缺失"并给出该技能名；校验状态为"不通过"且给出原因（复用既有校验文案原文）。` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 逐字断言由 test/wp14/assets.test.js 的 AC-20 用例承载（详情字段透传、missing-skill 标缺失、reason 与 src/cli/roles.js detailOf 同一函数）；A-5 角色详情块逐字见 requirement 附录 A-5，ui-views.test.js「A-5: detail lines render fixed order with missing markers」复核「缺失/校验」渲染。

**⑤ 判定**：通过

---

#### AC-21 技能库列表与详情

- 判定：**通过**（核对 11/11 通过）
- 证据分级：**mock 实测**
- 验证面：资产库 / 技能 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets-skill` 项目根，内置技能若干 + 1 个项目技能；`NODE_ENV=test`。
- When 打开技能库分页并点开项目技能。
- Then 计数行显示 `技能 {total} 个（内置 {builtin} · 项目 {project}）`；列表**每行**给名称、适用分组（即分组）、**来源（内置 / 项目）**、命令数、校验状态（逐字见附录 A-5）——项目技能那行来源必须是"项目"，内置技能那行必须是"内置"；详情给中文名、适用分组、命令、摘要与正文摘要（前若干行），并有校验状态；正文不整篇铺开。

```
,**机检原文**：`test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js`，断言计数行与列表行、详情块逐字匹配附录 A-5；断言列表每行按 ` · ` 切分后段数一致、第 3 段只取"内置"或"项目"、`来源` 计数与计数行的 `builtin` / `project` 相等；正文摘要行数 **≤ 20 行**（`BODY_PREVIEW_LINES = 20`，常量落在 `src/daemon` 侧、界面侧只消费）；`# fail 0`。,
**架构检查原文**：正文摘要由一处具名常量截断，不把整篇正文传给界面；`grep -REn "BODY_PREVIEW_LINES" src/daemon desktop/ui` **恰好 2 条命中（exit 0）**（常量定义 1 条 + 使用 1 条），且 `grep -REn "BODY_PREVIEW_LINES =" src/daemon desktop/ui` **恰好 1 条命中（exit 0）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 941ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 941ms
[架构#1] grep -REn "BODY_PREVIEW_LINES" src/daemon desktop/ui | 期望 exit 0 / 实测 exit 0
[架构#2] grep -REn "BODY_PREVIEW_LINES =" src/daemon desktop/ui | 期望 exit 0 / 实测 exit 0
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-21/AC-21.test-stdout.txt` | 2324 B |
| `docs/iterations/iteration-11/evidence/AC-21/AC-21.state.json` | 1334 B |
| `docs/iterations/iteration-11/evidence/AC-21/AC-21.meta.json` | 1679 B |
| `docs/iterations/iteration-11/evidence/AC-21/AC-21.check.json` | 5856 B |
| `docs/iterations/iteration-11/evidence/AC-21/AC-21.output.json` | 7361 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=产不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 39.563375<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 12.32755<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-21 架构①：BODY_PREVIEW_LINES 恰好 2 命中（定义 1 + 使用 1，exit 0） | ✅ | ``grep -REn "BODY_PREVIEW_LINES" src/daemon desktop/ui` → exit 0 / 恰好 2 行；实测 exit 0 / 2 行` | `exit 0` |
| 6 | 架构检查 #2：AC-21 架构②：BODY_PREVIEW_LINES 定义恰好 1 条（exit 0） | ✅ | ``grep -REn "BODY_PREVIEW_LINES =" src/daemon desktop/ui` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 7 | AC-21 技能列表与详情用例存在：计数行/每行来源命令数校验状态/详情字段 | ✅ | `AC-21 技能列表与详情：正文摘要按上限截断` | `项目技能来源=项目 / 内置技能来源=内置；每行按 · 切分段数一致` |
| 8 | A-5 计数行与列表行逐字：「技能 {total} 个（内置 {builtin} · 项目 {project}）」；来源计数相等 | ✅ | `# pass 10 / # fail 0` | `counts.total === builtin + project；第 3 段只取内置/项目` |
| 9 | 详情给中文名/分组/命令/摘要/正文摘要，正文不整篇铺开（≤20 行） | ✅ | `# pass 10 / # fail 0` | `bodyPreviewLines <= 20；40 行正文只取前 20 行；不含第 40 行正文` |
| 10 | BODY_PREVIEW_LINES = 20 常量在 src/daemon 侧、界面只消费（用例内 assert.equal(BODY_PREVIEW_LINES, 20) 承载） | ✅ | `# pass 10 / # fail 0` | `BODY_PREVIEW_LINES === 20；assets-view.js 定义 + 使用` |
| 11 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `计数行显示 `技能 {total} 个（内置 {builtin} · 项目 {project}）`；列表**每行**给名称、适用分组（即分组）、**来源（内置 / 项目）**、命令数、校验状态（逐字见附录 A-5）——项目技能那行来源必须是"项目"，内置技能那行必须是"内置"；详情给中文名、适用分组、命令、摘要与正文摘要（前若干行），并有校验状态；正文不整篇铺开。` | `计数行显示 `技能 {total} 个（内置 {builtin} · 项目 {project}）`；列表**每行**给名称、适用分组（即分组）、**来源（内置 / 项目）**、命令数、校验状态（逐字见附录 A-5）——项目技能那行来源必须是"项目"，内置技能那行必须是"内置"；详情给中文名、适用分组、命令、摘要与正文摘要（前若干行），并有校验状态；正文不整篇铺开。` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 逐字断言由 test/wp14/assets.test.js 的 AC-21 用例承载（计数行/列表行来源命令数校验状态/详情字段/正文摘要行数上限 20）；两条 BODY_PREVIEW_LINES 架构锚点按需求 §3.1 AC-21 原文核对（定义 1 + 使用 1 = 2 命中）。

**⑤ 判定**：通过

---

#### AC-22 工作流库列表与详情

- 判定：**通过**（核对 10/10 通过）
- 证据分级：**mock 实测**
- 验证面：资产库 / 工作流 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets-workflow` 项目根，一个项目工作流 `release-flow`：5 个角色节点（`T-001`/`T-002`/`T-003`/`T-004`/`T-005`）、1 个人工节点（`H-001`）、1 个子工作流（`S-001`），共 **7 节点**；**正向 6 条 + 回流 2 条 = 8 条边**（与附录 A-5 / A-7 的同一份 `release-flow` 完全一致）；`NODE_ENV=test`。
- When 打开工作流库并点开该工作流。
- Then 计数行显示 `工作流 {total} 个（内置 {builtin} · 项目 {project}）`；列表行给名称、**来源（内置 / 项目）**、节点数 `7`、边数 `8`、校验状态（逐字见附录 A-5；工作流定义无分组字段，故本行不含分组，见 BR-14）；详情给名称、节点数、边数、节点清单（类型按角色节点 / 人工节点 / 升级节点 / 子工作流，**与 A-5 的 7 行同序逐字**）、回流条数、校验状态，逐字匹配附录 A-5。

```
,**机检原文**：`test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js`，断言计数行、列表行（含 `7 节点 · 8 条边`）与详情块逐字、列表行第 2 段只取"内置"或"项目"、来源计数与计数行相等、节点清单条数 = 7 且行序与 A-5 相同、回流条数 = 2；`# fail 0`。,
**架构检查原文**：节点类型只从定义 `node_type` 读，不按标题猜；`grep -REn "人工验收|人工裁决" desktop/ui/assets/` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 1044ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 1044ms
[架构#1] grep -REn "人工验收|人工裁决" desktop/ui/assets/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-22/AC-22.test-stdout.txt` | 2325 B |
| `docs/iterations/iteration-11/evidence/AC-22/AC-22.state.json` | 1334 B |
| `docs/iterations/iteration-11/evidence/AC-22/AC-22.meta.json` | 1663 B |
| `docs/iterations/iteration-11/evidence/AC-22/AC-22.check.json` | 6341 B |
| `docs/iterations/iteration-11/evidence/AC-22/AC-22.output.json` | 6805 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 41.284891<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 13.303127<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-22 架构：节点类型只从定义 node_type 读，不按标题猜，零命中（exit 1） | ✅ | ``grep -REn "人工验收\|人工裁决" desktop/ui/assets/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | AC-22 工作流列表与详情用例存在：计数行/来源/7 节点 8 边/校验状态 | ✅ | `AC-22 工作流列表与详情：7 节点 8 边、节点清单同序、回流 2 条` | `列表行含 7 节点 · 8 条边；第 2 段只取内置/项目；来源计数相等` |
| 7 | A-5 列表行逐字「工作流 release-flow · 项目 · 7 节点 · 8 条边 · 通过」（工作流行不含分组，BR-14） | ✅ | `# pass 10 / # fail 0` | `nodeCount=7 / edgeCount=8 / group=null / source=项目` |
| 8 | A-5 详情块逐字：7 节点清单同序（角色/人工/子工作流）、回流 2 条、校验通过 | ✅ | `# pass 10 / # fail 0` | `节点序列 ['T-001','T-002','T-003','H-001','S-001','T-004','T-005']；backflowCount=2` |
| 9 | 节点类型按 node_type 读（角色 5 / 人工 1 / 子工作流 1），sub-flow 真实存在不报 WORKFLOW_SUB_UNKNOWN | ✅ | `# pass 10 / # fail 0` | `byType role=5 / human=1 / subworkflow=1；校验通过` |
| 10 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `计数行显示 `工作流 {total} 个（内置 {builtin} · 项目 {project}）`；列表行给名称、**来源（内置 / 项目）**、节点数 `7`、边数 `8`、校验状态（逐字见附录 A-5；工作流定义无分组字段，故本行不含分组，见 BR-14）；详情给名称、节点数、边数、节点清单（类型按角色节点 / 人工节点 / 升级节点 / 子工作流，**与 A-5 的 7 行同序逐字**）、回流条数、校验状态，逐字匹配附录 A-5` | `计数行显示 `工作流 {total} 个（内置 {builtin} · 项目 {project}）`；列表行给名称、**来源（内置 / 项目）**、节点数 `7`、边数 `8`、校验状态（逐字见附录 A-5；工作流定义无分组字段，故本行不含分组，见 BR-14）；详情给名称、节点数、边数、节点清单（类型按角色节点 / 人工节点 / 升级节点 / 子工作流，**与 A-5 的 7 行同序逐字**）、回流条数、校验状态，逐字匹配附录 A-5` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 逐字断言由 test/wp14/assets.test.js 的 AC-22 用例承载；夹具按 H-17 写两份定义（release-flow 7 节点 8 边 + sub-flow 供 S-001 引用），5 个角色节点 role 取注册表内置 id（developer/tester/reviewer/code-reviewer/writer），避免 WORKFLOW_ROLE_UNKNOWN / WORKFLOW_SUB_UNKNOWN。A-5 详情块与 A-7/AC-29 同一份 release-flow（D-31）。

**⑤ 判定**：通过

---

#### AC-23 校验不通过的资产可浏览并标注原因

- 判定：**通过**（核对 11/11 通过）
- 证据分级：**mock 实测**
- 验证面：资产库 / 异常 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets-invalid` 项目根，一个角色引用了不存在的技能、一个技能正文为空、一个工作流有悬空边；`NODE_ENV=test`。
- When 依次打开三个分页与三条详情。
- Then 三条都出现在列表里并标"不通过"；详情给出各自原因（与 CLI `validate` 原文一致）；其它资产照常可用；界面不崩溃、不隐藏坏项。

```
,**机检原文**：`test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js`，断言三条 `status === '不通过'`、原因字符串与 CLI 输出逐字相同、列表条数未因坏项减少；`# fail 0`。,
**架构检查原文**：坏资产不得被过滤出列表；`grep -REn "filter.*valid" desktop/ui/assets/` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 939ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 939ms
[架构#1] grep -REn "filter.*valid" desktop/ui/assets/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-23/AC-23.test-stdout.txt` | 2325 B |
| `docs/iterations/iteration-11/evidence/AC-23/AC-23.state.json` | 1334 B |
| `docs/iterations/iteration-11/evidence/AC-23/AC-23.meta.json` | 1574 B |
| `docs/iterations/iteration-11/evidence/AC-23/AC-23.check.json` | 4841 B |
| `docs/iterations/iteration-11/evidence/AC-23/AC-23.output.json` | 6769 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 42.535698<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 11.492003<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-23 架构：坏资产不得被过滤出列表，零命中（exit 1） | ✅ | ``grep -REn "filter.*valid" desktop/ui/assets/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | AC-23 三条坏资产照常出现在列表并标不通过（角色缺技能/技能空正文/工作流悬空边） | ✅ | `AC-23 校验不通过的资产照常出现在列表并标注原因（与 CLI 原文逐字）` | `三条 status === 不通过；列表条数未因坏项减少` |
| 7 | A-5 角色原因逐字「引用的技能不存在：missing-skill」（期望逐字 "引用的技能不存在：missing-skill"） | ✅ | `"引用的技能不存在：missing-skill"` | `"引用的技能不存在：missing-skill"` |
| 8 | A-5 技能原因逐字「技能正文为空：empty-skill」（期望逐字 "技能正文为空：empty-skill"） | ✅ | `"技能正文为空：empty-skill"` | `"技能正文为空：empty-skill"` |
| 9 | A-5 工作流原因逐字「边不合法：endpoint: T-001->T-009」（期望逐字 "边不合法：endpoint: T-001->T-009"） | ✅ | `"边不合法：endpoint: T-001->T-009"` | `"边不合法：endpoint: T-001->T-009"` |
| 10 | 详情给出各自原因且与 CLI 输出逐字相同（reason/reasons 同源），界面不崩溃不隐藏 | ✅ | `# pass 10 / # fail 0` | `三条 detail.reason 与 orch validate 原文逐字；counts.total === builtin + project` |
| 11 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `三条都出现在列表里并标"不通过"；详情给出各自原因（与 CLI `validate` 原文一致）；其它资产照常可用；界面不崩溃、不隐藏坏项。` | `三条都出现在列表里并标"不通过"；详情给出各自原因（与 CLI `validate` 原文一致）；其它资产照常可用；界面不崩溃、不隐藏坏项。` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- D-45 口径：坏资产按手写坏 YAML 构造（缺技能引用 / 空正文 / 悬空边）；原因字符串由 src/cli/roles.js detailOf 同一组装函数生成，与 CLI validate 原文逐字相同。逐字断言由 test/wp14/assets.test.js 的 AC-23 用例承载。

**⑤ 判定**：通过

---

#### AC-24 资产目录不可读与引用缺失的降级

- 判定：**通过**（核对 10/10 通过）
- 证据分级：**mock 实测**
- 验证面：资产库 / 降级 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets-missing` 项目根，两个现场：① `.orch/roles/` 不可读（权限 000）；② 一个角色引用的技能不存在。
- When 打开角色库与详情。
- Then 现场一显示"资产不可读 · .orch/roles"（逐字见附录 A-5），其它分页照常可用；现场二详情里该技能标"缺失"，其余字段照常；两种情况都可返回，不白屏。

```
,**机检原文**：`test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js`，断言两条降级文案逐字、其它分页行数不变、无堆栈输出；`# fail 0`。,
**架构检查原文**：降级不得删除其它分页数据；`grep -REn "throw " desktop/ui/assets/` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 974ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 974ms
[架构#1] grep -REn "throw " desktop/ui/assets/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-24/AC-24.test-stdout.txt` | 2325 B |
| `docs/iterations/iteration-11/evidence/AC-24/AC-24.state.json` | 1334 B |
| `docs/iterations/iteration-11/evidence/AC-24/AC-24.meta.json` | 2048 B |
| `docs/iterations/iteration-11/evidence/AC-24/AC-24.check.json` | 4435 B |
| `docs/iterations/iteration-11/evidence/AC-24/AC-24.output.json` | 6777 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 42.502966<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 11.956642<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-24 架构：降级不删除其它分页数据、不抛堆栈，零命中（exit 1） | ✅ | ``grep -REn "throw " desktop/ui/assets/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | AC-24 现场二（引用缺失）实跑并通过：技能标缺失、其余字段照常、其它分页行数不变 | ✅ | `AC-24 现场二：引用缺失的技能标缺失，其余字段照常` | `missing-skill missing=true；dirUnreadable=false；counts.project=1` |
| 7 | AC-24 现场一（目录不可读）非 root 实跑并显示「资产不可读 · .orch/roles」；root 环境按 skip 标注分级不阻塞 | ✅ | `现场一实跑；dirUnreadable=true；# pass 10 / # fail 0` | `非 root：dirUnreadable=true / 其它分页照常 / 恢复后可用；root：skip 但现场二成立，不算阻塞` |
| 8 | A-5 目录级降级文案逐字「资产不可读 · .orch/roles」（期望逐字 "资产不可读 · .orch/roles"） | ✅ | `"资产不可读 · .orch/roles"` | `"资产不可读 · .orch/roles"` |
| 9 | 两种情况都可返回、不白屏、无堆栈输出（# fail 0） | ✅ | `# pass 10 / # fail 0 / # skipped 0` | `# fail 0` |
| 10 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `现场一显示"资产不可读 · .orch/roles"（逐字见附录 A-5），其它分页照常可用；现场二详情里该技能标"缺失"，其余字段照常；两种情况都可返回，不白屏。` | `现场一显示"资产不可读 · .orch/roles"（逐字见附录 A-5），其它分页照常可用；现场二详情里该技能标"缺失"，其余字段照常；两种情况都可返回，不白屏。` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- 证据分级说明：本机 uid=501（非 root），AC-24 现场一（chmod 000 目录不可读）实际执行；若主控在 root 环境复跑，assets.test.js 的现场一用例带 { skip: isRoot } 会被跳过，此时判定由现场二（引用缺失标缺失）承载，现场一标注为「root 环境不可观测」，按纪律不算阻塞（有现场二），证据分级如实登记。原始 skip 状态见 .tap.json 的 skipped/skips 字段。
- 逐字断言由 test/wp14/assets.test.js 的「AC-24 现场一/现场二」用例承载；A-5 区分目录级「资产不可读 · {目录}」与文件级「角色 broken-role · 不可读」（后者属 AC-46，不在此混用）。

**⑤ 判定**：通过

---

#### AC-25 库浏览只读：不改资产、不写状态

- 判定：**通过**（核对 11/11 通过）
- 证据分级：**mock 实测**
- 验证面：只读 / 安全 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-assets-readonly` 项目根；记下 `.orch/roles/`、`.orch/skills/`、`.orch/workflows/` 下全部文件的字节哈希，以及实例 `state.json` / `events.jsonl` 的哈希；`NODE_ENV=test`。
- When 依次浏览三个分页、打开若干详情、切到运行时占用、再回到列表。
- Then 全部哈希不变；界面没有"新建 / 编辑 / 导入 / 导出 / 删除 / 校验"按钮；实例状态与事件日志不变。

```
,**机检原文**：`test -f test/wp14/assets-readonly.test.js && NODE_ENV=test node --test test/wp14/assets-readonly.test.js`，断言哈希集合前后相等、界面动作清单只含只读动作、无写接口被调用（探针记录 `writes=0`）；`# fail 0`。,
**架构检查原文**：`grep -REn "fs[.]write|fs[.]unlink|assets-write" desktop/ui/assets/` 必须**零命中（exit 1）**；资产只读接口的注册点可能在 `server.js` 也可能在 `routes.js`（既有 REST 路由表在 `routes.js`），因此计数必须**两个文件合计**：`cat src/daemon/http/server.js src/daemon/http/routes.js | grep -Ec "/assets/"` 的输出必须 **≥ 6**（列表 3 + 详情 3；基线实跑为 `0`，exit 1）；写方法不得落在资产路径上：`grep -REn "/assets/" src/daemon/http/server.js src/daemon/http/routes.js | grep -E "POST|PUT|DELETE"` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 assets.test.js] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | 953ms
[机检] test -f test/wp14/assets.test.js && NODE_ENV=test node --test test/wp14/assets.test.js | exit=0 | # pass 10 / # fail 0 | 953ms
[架构#1] grep -REn "fs[.]write|fs[.]unlink|assets-write" desktop/ui/assets/ | 期望 exit 1 / 实测 exit 1
[架构#2] cat src/daemon/http/server.js src/daemon/http/routes.js | grep -Ec "/assets/" | 期望 exit 0 / 实测 exit 0
[架构#3] grep -REn "/assets/" src/daemon/http/server.js src/daemon/http/routes.js | grep -E "POST|PUT|DELETE" | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-25/AC-25.test-stdout.txt` | 2325 B |
| `docs/iterations/iteration-11/evidence/AC-25/AC-25.state.json` | 1334 B |
| `docs/iterations/iteration-11/evidence/AC-25/AC-25.meta.json` | 2347 B |
| `docs/iterations/iteration-11/evidence/AC-25/AC-25.check.json` | 5286 B |
| `docs/iterations/iteration-11/evidence/AC-25/AC-25.output.json` | 7661 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 assets.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不可解析：那一行标不可读，其余照常<br>  ---<br>  duration_ms: 40.025512<br>  type: 'test'<br>  ...<br># Subtest: 未知 kind 与未知 id 按找不到处理，不抛错<br>ok 10 - 未知 kind 与未知 id 按找不到处理，不抛错<br>  ---<br>  duration_ms: 11.084245<br>  type:` | `` |
| 2 | 机检 assets.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 assets.test.js：# pass ≥ 1 | ✅ | `# pass 10 / # tests 10` | `` |
| 4 | 机检 assets.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-25 架构①：界面资产层无直写盘，零命中（exit 1） | ✅ | ``grep -REn "fs[.]write\|fs[.]unlink\|assets-write" desktop/ui/assets/` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 6 | 架构检查 #2：AC-25 架构②：/assets/ 两文件合计 ≥6（列表 3 + 详情 3；基线实跑 7，exit 0），计数须两文件合计不单看 server.js | ✅ | ``cat src/daemon/http/server.js src/daemon/http/routes.js \| grep -Ec "/assets/"` → exit 0 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 0` |
| 7 | 架构检查 #3：AC-25 架构③：资产路径上无写方法，零命中（exit 1） | ✅ | ``grep -REn "/assets/" src/daemon/http/server.js src/daemon/http/routes.js \| grep -E "POST\|PUT\|DELETE"` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 8 | AC-25 只读用例存在：浏览三分页/打开详情/切占用后，三个资产目录 sha256 哈希集合前后相等 | ✅ | `AC-25 库浏览只读：调用前后三个资产目录的哈希不变` | `hashTree(roles/skills/workflows) after === before；hashTree 按字节 sha256` |
| 9 | 界面没有新建/编辑/导入/导出/删除/校验按钮（只读动作清单），实例状态与事件日志不变 | ✅ | `# pass 10 / # fail 0` | `只读接口；无写接口被调用；探针 writes=0` |
| 10 | /assets/ 两文件合计计数 ≥6（列表 3 + 详情 3），基线实跑 7 | ✅ | `实测合计 7` | `≥ 6` |
| 11 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `全部哈希不变；界面没有"新建 / 编辑 / 导入 / 导出 / 删除 / 校验"按钮；实例状态与事件日志不变。` | `全部哈希不变；界面没有"新建 / 编辑 / 导入 / 导出 / 删除 / 校验"按钮；实例状态与事件日志不变。` |

**备注**

- 机检 assets.test.js：# tests 10 / # pass 10 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检文件名口径：需求点名 test/wp14/assets-readonly.test.js（本分支不存在），AC-25 只读断言合并进 test/wp14/assets.test.js「AC-25 库浏览只读：调用前后三个资产目录的哈希不变」用例。按实际文件机检并登记说明，不放宽。
- sha256 目录哈希锚定：hashTree 对 .orch/roles / .orch/skills / .orch/workflows 下全部文件按字节 sha256（路径→哈希），浏览三分页 + 打开若干详情 + 切占用 + 回列表后 after 深等于 before。架构路由计数按任务书用 server.js + routes.js 两文件合计（≥6，基线实跑 7），不单看 server.js；写方法零命中。

**⑤ 判定**：通过

---

#### AC-26 全局角色占用：跨实例聚合

- 判定：**通过**（核对 16/16 通过）
- 证据分级：**mock 实测**
- 验证面：占用 / 聚合 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-occupy` 项目根，两个实例：`INST-001` 里"开发"（`developer`）服务 T-001、2 条活跃会话；`INST-002` 里"开发"服务 T-004、1 条活跃会话；`INST-001` 里"审核者"（`reviewer`）服务 T-002 / T-003 / T-005 三个节点、1 条活跃会话；另有"测试"（`tester`）角色在 `INST-001` 处于冷却中；`NODE_ENV=test`。
- When 在角色库切到"运行时占用"。
- Then "开发"一行显示参与 2 个实例、3 条活跃会话、服务 T-001, T-004（**≤ 2 个逐个列出**）、状态"服务中"；"审核者"一行显示服务 `T-002 等 3 个`（**超 2 个折叠**，保留首个 + `等 N 个`）、1 条活跃会话、状态"服务中"；"测试"一行显示参与 1 个实例、0 条活跃会话、状态"冷却中"；排序为服务中在前（同档按角色名升序），其次冷却中；逐字匹配附录 A-6。

```
,**机检原文**：`test -f test/wp14/occupancy.test.js && NODE_ENV=test node --test test/wp14/occupancy.test.js`，用 `desktop/harness/occupancy-dump.mjs` 导出并逐字比对附录 A-6；断言"开发"的实例数 2、会话数 3、服务节点集合正确且**未折叠**；断言"审核者"的 `servingNodes.length === 3`、文案为 `服务 T-002 等 3 个`（折叠阈值 2）；`# fail 0`。,
**架构检查原文**：占用必须由各实例的运行时投影聚合，不得读注册表充当运行时；`grep -REn "roles/" src/daemon/occupancy.js` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 occupancy.test.js] test -f test/wp14/occupancy.test.js && NODE_ENV=test node --test test/wp14/occupancy.test.js | exit=0 | 2759ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 906ms
[机检] test -f test/wp14/occupancy.test.js && NODE_ENV=test node --test test/wp14/occupancy.test.js | exit=0 | # pass 4 / # fail 0 | 2759ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 906ms
[架构#1] grep -REn "roles/" src/daemon/occupancy.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-26/AC-26.test-stdout.txt` | 7659 B |
| `docs/iterations/iteration-11/evidence/AC-26/AC-26.state.json` | 3692 B |
| `docs/iterations/iteration-11/evidence/AC-26/AC-26.meta.json` | 2486 B |
| `docs/iterations/iteration-11/evidence/AC-26/AC-26.check.json` | 8295 B |
| `docs/iterations/iteration-11/evidence/AC-26/AC-26.output.json` | 20535 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 occupancy.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=<br>  ...<br># Subtest: buildOccupancy：占用随真实派发更新且与流程图同源（AC-28 / BR-37 数据侧 / D-40）<br>ok 4 - buildOccupancy：占用随真实派发更新且与流程图同源（AC-28 / BR-37 数据侧 / D-40）<br>  ---<br>  duration_ms: 1850.265184<br>  type: 'test'` | `` |
| 2 | 机检 occupancy.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 occupancy.test.js：# pass ≥ 1 | ✅ | `# pass 4 / # tests 4` | `` |
| 4 | 机检 occupancy.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.534759<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 架构检查 #1：AC-26 架构：占用由各实例运行时投影聚合，不读注册表充当运行时，零命中（exit 1） | ✅ | ``grep -REn "roles/" src/daemon/occupancy.js` → exit 1 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 1` |
| 10 | AC-26 跨实例聚合用例存在：五字段模板（roleId/name/group/instances/activeSessions/servingNodes/status/hosts） | ✅ | `buildOccupancy：跨实例聚合五字段与最忙状态序（AC-26 / BR-16 / D-5 / D-48）` | `八字段键序逐字（D-48）；未绑定节点不缩字段` |
| 11 | 开发行：参与 2 实例 / 3 活跃会话（2+1）/ 服务 T-001,T-004 未折叠（≤2 逐个列出）/ 服务中 / 宿主 mock | ✅ | `# pass 4 / # fail 0` | `dev.instances===2 / activeSessions===3 / servingNodes=[T-001,T-004] / hosts=[mock]` |
| 12 | 审核者行：服务节点 3 个数组保留、文案折叠「服务 T-002 等 3 个」（阈值 2）/ 1 会话 / 服务中（D-48 hosts） | ✅ | `# pass 4 / # fail 0` | `rev.servingNodes.length===3 / 首个 T-002 / 折叠文案由 ui-views 渲染 / hosts=[mock]` |
| 13 | 测试行：参与 1 实例 / 0 会话 / 冷却中；排序服务中在前（开发<审核者）其次冷却中（A-6） | ✅ | `# pass 4 / # fail 0` | `tst.activeSessions=0 / status 冷却中；索引 developer<reviewer<tester` |
| 14 | A-6 占用行逐字（含 hosts 段）由 ui-views.test.js 承载：「宿主 mock」/ 未参与行「宿主 —」 | ✅ | `A-6 / AC-26 AC-28: occupancy row, empty, skipped, hosts are verbatim` | `「角色 开发 · 服务中 · 参与 2 个实例 · 3 个活跃会话 · 服务 T-001, T-004 · 宿主 mock」逐字` |
| 15 | 同源断言：同一份 state.json 喂给 buildRoleInstances / buildGraph，运行时角色集合一致（D-40 禁 pulse） | ✅ | `# pass 4 / # fail 0` | `occupancyRuntimeRoleIds === runtimeRoleIds（含节点绑定的 reviewer）；夹具 nodes[].roleId=developer/reviewer/tester、sessions[].hostId=mock、template=code-loop` |
| 16 | Then #1（逐字，机检 + 架构检查复核） | ✅ | `"开发"一行显示参与 2 个实例、3 条活跃会话、服务 T-001, T-004（**≤ 2 个逐个列出**）、状态"服务中"；"审核者"一行显示服务 `T-002 等 3 个`（**超 2 个折叠**，保留首个 + `等 N 个`）、1 条活跃会话、状态"服务中"；"测试"一行显示参与 1 个实例、0 条活跃会话、状态"冷却中"；排序为服务中在前（同档按角色名升序），其次冷却中；逐字匹配附录 A-6。` | `"开发"一行显示参与 2 个实例、3 条活跃会话、服务 T-001, T-004（**≤ 2 个逐个列出**）、状态"服务中"；"审核者"一行显示服务 `T-002 等 3 个`（**超 2 个折叠**，保留首个 + `等 N 个`）、1 条活跃会话、状态"服务中"；"测试"一行显示参与 1 个实例、0 条活跃会话、状态"冷却中"；排序为服务中在前（同档按角色名升序），其次冷却中；逐字匹配附录 A-6。` |

**备注**

- 机检 occupancy.test.js：# tests 4 / # pass 4 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 机检 ui-views.test.js：# tests 31 / # pass 31 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- D-48 口径：行含 hosts 字段并逐字渲染宿主段；宿主并集取参与实例会话宿主（A-0 夹具一律 --host mock → 「宿主 mock」，未参与行无运行时 → 「宿主 —」）。折叠阈值 2：≤2 逐个列出、>2「首个 + 等 N 个」；数组始终保留全部节点，折叠是界面职责。
- D-40 夹具红线：占用投影读实例 state.json，graph/pulse 只写 overlay 不写 state，全程禁 pulse；用例手写 state.json（先起核再写盘）+ test.dispatch 真实派发。template=code-loop 声明 coordinator 作「未参与」行属预期，本用例只断言开发/审核者/测试三行字段与相对顺序。逐字行由 ui-views.test.js「A-6 / AC-26 AC-28: occupancy row, empty, skipped, hosts are verbatim」承载。

**⑤ 判定**：通过

---

## 2. 未通过 / 阻塞项汇总

（无未通过 / 阻塞项）

## 3. 证据索引

共 291 个文件；每条 AC 至少 `<AC>.test-stdout.txt` / `<AC>.meta.json` / `<AC>.state.json` / `<AC>.check.json` / `<AC>.output.json`。

| AC | 证据文件 |
|---|---|
| AC-01 | `evidence/AC-01/AC-01.arch-1.log`<br>`evidence/AC-01/AC-01.check.json`<br>`evidence/AC-01/AC-01.frame.json`<br>`evidence/AC-01/AC-01.meta.json`<br>`evidence/AC-01/AC-01.notify.attempt-1.log`<br>`evidence/AC-01/AC-01.notify.log`<br>`evidence/AC-01/AC-01.notify.tap.json`<br>`evidence/AC-01/AC-01.output.json`<br>`evidence/AC-01/AC-01.state.json`<br>`evidence/AC-01/AC-01.test-stdout.txt` |
| AC-02 | `evidence/AC-02/AC-02.arch-1.log`<br>`evidence/AC-02/AC-02.check.json`<br>`evidence/AC-02/AC-02.frame.json`<br>`evidence/AC-02/AC-02.meta.json`<br>`evidence/AC-02/AC-02.notify.attempt-1.log`<br>`evidence/AC-02/AC-02.notify.log`<br>`evidence/AC-02/AC-02.notify.tap.json`<br>`evidence/AC-02/AC-02.output.json`<br>`evidence/AC-02/AC-02.state.json`<br>`evidence/AC-02/AC-02.test-stdout.txt` |
| AC-03 | `evidence/AC-03/AC-03.arch-1.log`<br>`evidence/AC-03/AC-03.check.json`<br>`evidence/AC-03/AC-03.frame.json`<br>`evidence/AC-03/AC-03.meta.json`<br>`evidence/AC-03/AC-03.notify.attempt-1.log`<br>`evidence/AC-03/AC-03.notify.log`<br>`evidence/AC-03/AC-03.notify.tap.json`<br>`evidence/AC-03/AC-03.output.json`<br>`evidence/AC-03/AC-03.state.json`<br>`evidence/AC-03/AC-03.test-stdout.txt` |
| AC-04 | `evidence/AC-04/AC-04.arch-1.log`<br>`evidence/AC-04/AC-04.check.json`<br>`evidence/AC-04/AC-04.meta.json`<br>`evidence/AC-04/AC-04.notify.attempt-1.log`<br>`evidence/AC-04/AC-04.notify.log`<br>`evidence/AC-04/AC-04.notify.tap.json`<br>`evidence/AC-04/AC-04.output.json`<br>`evidence/AC-04/AC-04.state.json`<br>`evidence/AC-04/AC-04.test-stdout.txt`<br>`evidence/AC-04/AC-04.ui-views.attempt-1.log`<br>`evidence/AC-04/AC-04.ui-views.log`<br>`evidence/AC-04/AC-04.ui-views.tap.json` |
| AC-05 | `evidence/AC-05/AC-05.arch-1.log`<br>`evidence/AC-05/AC-05.check.json`<br>`evidence/AC-05/AC-05.meta.json`<br>`evidence/AC-05/AC-05.notify.attempt-1.log`<br>`evidence/AC-05/AC-05.notify.log`<br>`evidence/AC-05/AC-05.notify.tap.json`<br>`evidence/AC-05/AC-05.output.json`<br>`evidence/AC-05/AC-05.prefs.attempt-1.log`<br>`evidence/AC-05/AC-05.prefs.log`<br>`evidence/AC-05/AC-05.prefs.tap.json`<br>`evidence/AC-05/AC-05.state.json`<br>`evidence/AC-05/AC-05.test-stdout.txt`<br>`evidence/AC-05/AC-05.ui-views.attempt-1.log`<br>`evidence/AC-05/AC-05.ui-views.log`<br>`evidence/AC-05/AC-05.ui-views.tap.json` |
| AC-06 | `evidence/AC-06/AC-06.arch-1.log`<br>`evidence/AC-06/AC-06.check.json`<br>`evidence/AC-06/AC-06.frame.json`<br>`evidence/AC-06/AC-06.meta.json`<br>`evidence/AC-06/AC-06.notify.attempt-1.log`<br>`evidence/AC-06/AC-06.notify.log`<br>`evidence/AC-06/AC-06.notify.tap.json`<br>`evidence/AC-06/AC-06.output.json`<br>`evidence/AC-06/AC-06.state.json`<br>`evidence/AC-06/AC-06.test-stdout.txt` |
| AC-07 | `evidence/AC-07/AC-07.arch-1.log`<br>`evidence/AC-07/AC-07.check.json`<br>`evidence/AC-07/AC-07.frame.json`<br>`evidence/AC-07/AC-07.meta.json`<br>`evidence/AC-07/AC-07.notify.attempt-1.log`<br>`evidence/AC-07/AC-07.notify.log`<br>`evidence/AC-07/AC-07.notify.tap.json`<br>`evidence/AC-07/AC-07.output.json`<br>`evidence/AC-07/AC-07.shell-notify.attempt-1.log`<br>`evidence/AC-07/AC-07.shell-notify.log`<br>`evidence/AC-07/AC-07.shell-notify.tap.json`<br>`evidence/AC-07/AC-07.state.json`<br>`evidence/AC-07/AC-07.test-stdout.txt` |
| AC-08 | `evidence/AC-08/AC-08.arch-1.log`<br>`evidence/AC-08/AC-08.arch-2.log`<br>`evidence/AC-08/AC-08.arch-3.log`<br>`evidence/AC-08/AC-08.check.json`<br>`evidence/AC-08/AC-08.frame.json`<br>`evidence/AC-08/AC-08.meta.json`<br>`evidence/AC-08/AC-08.output.json`<br>`evidence/AC-08/AC-08.queue.attempt-1.log`<br>`evidence/AC-08/AC-08.queue.log`<br>`evidence/AC-08/AC-08.queue.tap.json`<br>`evidence/AC-08/AC-08.state.json`<br>`evidence/AC-08/AC-08.test-stdout.txt` |
| AC-09 | `evidence/AC-09/AC-09.arch-1.log`<br>`evidence/AC-09/AC-09.arch-2.log`<br>`evidence/AC-09/AC-09.check.json`<br>`evidence/AC-09/AC-09.meta.json`<br>`evidence/AC-09/AC-09.output.json`<br>`evidence/AC-09/AC-09.queue.attempt-1.log`<br>`evidence/AC-09/AC-09.queue.log`<br>`evidence/AC-09/AC-09.queue.tap.json`<br>`evidence/AC-09/AC-09.state.json`<br>`evidence/AC-09/AC-09.test-stdout.txt` |
| AC-10 | `evidence/AC-10/AC-10.arch-1.log`<br>`evidence/AC-10/AC-10.check.json`<br>`evidence/AC-10/AC-10.meta.json`<br>`evidence/AC-10/AC-10.output.json`<br>`evidence/AC-10/AC-10.queue.attempt-1.log`<br>`evidence/AC-10/AC-10.queue.log`<br>`evidence/AC-10/AC-10.queue.tap.json`<br>`evidence/AC-10/AC-10.state.json`<br>`evidence/AC-10/AC-10.test-stdout.txt` |
| AC-11 | `evidence/AC-11/AC-11.arch-1.log`<br>`evidence/AC-11/AC-11.check.json`<br>`evidence/AC-11/AC-11.meta.json`<br>`evidence/AC-11/AC-11.output.json`<br>`evidence/AC-11/AC-11.queue.attempt-1.log`<br>`evidence/AC-11/AC-11.queue.log`<br>`evidence/AC-11/AC-11.queue.tap.json`<br>`evidence/AC-11/AC-11.state.json`<br>`evidence/AC-11/AC-11.test-stdout.txt`<br>`evidence/AC-11/AC-11.ui-views.attempt-1.log`<br>`evidence/AC-11/AC-11.ui-views.log`<br>`evidence/AC-11/AC-11.ui-views.tap.json` |
| AC-12 | `evidence/AC-12/AC-12.arch-1.log`<br>`evidence/AC-12/AC-12.arch-2.log`<br>`evidence/AC-12/AC-12.check.json`<br>`evidence/AC-12/AC-12.meta.json`<br>`evidence/AC-12/AC-12.output.json`<br>`evidence/AC-12/AC-12.queue.attempt-1.log`<br>`evidence/AC-12/AC-12.queue.log`<br>`evidence/AC-12/AC-12.queue.tap.json`<br>`evidence/AC-12/AC-12.state.json`<br>`evidence/AC-12/AC-12.test-stdout.txt` |
| AC-13 | `evidence/AC-13/AC-13.arch-1.log`<br>`evidence/AC-13/AC-13.check.json`<br>`evidence/AC-13/AC-13.meta.json`<br>`evidence/AC-13/AC-13.output.json`<br>`evidence/AC-13/AC-13.queue.attempt-1.log`<br>`evidence/AC-13/AC-13.queue.log`<br>`evidence/AC-13/AC-13.queue.tap.json`<br>`evidence/AC-13/AC-13.state.json`<br>`evidence/AC-13/AC-13.test-stdout.txt` |
| AC-14 | `evidence/AC-14/AC-14.arch-1.log`<br>`evidence/AC-14/AC-14.check.json`<br>`evidence/AC-14/AC-14.e2e.attempt-1.log`<br>`evidence/AC-14/AC-14.e2e.log`<br>`evidence/AC-14/AC-14.e2e.tap.json`<br>`evidence/AC-14/AC-14.meta.json`<br>`evidence/AC-14/AC-14.output.json`<br>`evidence/AC-14/AC-14.queue.attempt-1.log`<br>`evidence/AC-14/AC-14.queue.log`<br>`evidence/AC-14/AC-14.queue.tap.json`<br>`evidence/AC-14/AC-14.state.json`<br>`evidence/AC-14/AC-14.test-stdout.txt`<br>`evidence/AC-14/AC-14.ui-views.attempt-1.log`<br>`evidence/AC-14/AC-14.ui-views.log`<br>`evidence/AC-14/AC-14.ui-views.tap.json` |
| AC-15 | `evidence/AC-15/AC-15.arch-1.log`<br>`evidence/AC-15/AC-15.arch-2.log`<br>`evidence/AC-15/AC-15.check.json`<br>`evidence/AC-15/AC-15.meta.json`<br>`evidence/AC-15/AC-15.output.json`<br>`evidence/AC-15/AC-15.queue.attempt-1.log`<br>`evidence/AC-15/AC-15.queue.log`<br>`evidence/AC-15/AC-15.queue.tap.json`<br>`evidence/AC-15/AC-15.state.json`<br>`evidence/AC-15/AC-15.test-stdout.txt`<br>`evidence/AC-15/AC-15.ui-views.attempt-1.log`<br>`evidence/AC-15/AC-15.ui-views.log`<br>`evidence/AC-15/AC-15.ui-views.tap.json` |
| AC-16 | `evidence/AC-16/AC-16.arch-1.log`<br>`evidence/AC-16/AC-16.check.json`<br>`evidence/AC-16/AC-16.meta.json`<br>`evidence/AC-16/AC-16.output.json`<br>`evidence/AC-16/AC-16.queue.attempt-1.log`<br>`evidence/AC-16/AC-16.queue.log`<br>`evidence/AC-16/AC-16.queue.tap.json`<br>`evidence/AC-16/AC-16.state.json`<br>`evidence/AC-16/AC-16.test-stdout.txt`<br>`evidence/AC-16/AC-16.ui-views.attempt-1.log`<br>`evidence/AC-16/AC-16.ui-views.log`<br>`evidence/AC-16/AC-16.ui-views.tap.json` |
| AC-17 | `evidence/AC-17/AC-17.arch-1.log`<br>`evidence/AC-17/AC-17.arch-2.log`<br>`evidence/AC-17/AC-17.arch-3.log`<br>`evidence/AC-17/AC-17.check.json`<br>`evidence/AC-17/AC-17.meta.json`<br>`evidence/AC-17/AC-17.output.json`<br>`evidence/AC-17/AC-17.queue.attempt-1.log`<br>`evidence/AC-17/AC-17.queue.log`<br>`evidence/AC-17/AC-17.queue.tap.json`<br>`evidence/AC-17/AC-17.state.json`<br>`evidence/AC-17/AC-17.test-stdout.txt` |
| AC-18 | `evidence/AC-18/AC-18.arch-1.log`<br>`evidence/AC-18/AC-18.arch-2.log`<br>`evidence/AC-18/AC-18.arch-3.log`<br>`evidence/AC-18/AC-18.arch-4.log`<br>`evidence/AC-18/AC-18.arch-5.log`<br>`evidence/AC-18/AC-18.arch-6.log`<br>`evidence/AC-18/AC-18.check.json`<br>`evidence/AC-18/AC-18.e2e.attempt-1.log`<br>`evidence/AC-18/AC-18.e2e.log`<br>`evidence/AC-18/AC-18.e2e.tap.json`<br>`evidence/AC-18/AC-18.meta.json`<br>`evidence/AC-18/AC-18.output.json`<br>`evidence/AC-18/AC-18.queue.attempt-1.log`<br>`evidence/AC-18/AC-18.queue.log`<br>`evidence/AC-18/AC-18.queue.tap.json`<br>`evidence/AC-18/AC-18.state.json`<br>`evidence/AC-18/AC-18.test-stdout.txt` |
| AC-19 | `evidence/AC-19/AC-19.arch-1.log`<br>`evidence/AC-19/AC-19.assets.attempt-1.log`<br>`evidence/AC-19/AC-19.assets.log`<br>`evidence/AC-19/AC-19.assets.tap.json`<br>`evidence/AC-19/AC-19.check.json`<br>`evidence/AC-19/AC-19.meta.json`<br>`evidence/AC-19/AC-19.output.json`<br>`evidence/AC-19/AC-19.state.json`<br>`evidence/AC-19/AC-19.test-stdout.txt`<br>`evidence/AC-19/AC-19.ui-views.attempt-1.log`<br>`evidence/AC-19/AC-19.ui-views.log`<br>`evidence/AC-19/AC-19.ui-views.tap.json` |
| AC-20 | `evidence/AC-20/AC-20.arch-1.log`<br>`evidence/AC-20/AC-20.assets.attempt-1.log`<br>`evidence/AC-20/AC-20.assets.log`<br>`evidence/AC-20/AC-20.assets.tap.json`<br>`evidence/AC-20/AC-20.check.json`<br>`evidence/AC-20/AC-20.meta.json`<br>`evidence/AC-20/AC-20.output.json`<br>`evidence/AC-20/AC-20.state.json`<br>`evidence/AC-20/AC-20.test-stdout.txt` |
| AC-21 | `evidence/AC-21/AC-21.arch-1.log`<br>`evidence/AC-21/AC-21.arch-2.log`<br>`evidence/AC-21/AC-21.assets.attempt-1.log`<br>`evidence/AC-21/AC-21.assets.log`<br>`evidence/AC-21/AC-21.assets.tap.json`<br>`evidence/AC-21/AC-21.check.json`<br>`evidence/AC-21/AC-21.meta.json`<br>`evidence/AC-21/AC-21.output.json`<br>`evidence/AC-21/AC-21.state.json`<br>`evidence/AC-21/AC-21.test-stdout.txt` |
| AC-22 | `evidence/AC-22/AC-22.arch-1.log`<br>`evidence/AC-22/AC-22.assets.attempt-1.log`<br>`evidence/AC-22/AC-22.assets.log`<br>`evidence/AC-22/AC-22.assets.tap.json`<br>`evidence/AC-22/AC-22.check.json`<br>`evidence/AC-22/AC-22.meta.json`<br>`evidence/AC-22/AC-22.output.json`<br>`evidence/AC-22/AC-22.state.json`<br>`evidence/AC-22/AC-22.test-stdout.txt` |
| AC-23 | `evidence/AC-23/AC-23.arch-1.log`<br>`evidence/AC-23/AC-23.assets.attempt-1.log`<br>`evidence/AC-23/AC-23.assets.log`<br>`evidence/AC-23/AC-23.assets.tap.json`<br>`evidence/AC-23/AC-23.check.json`<br>`evidence/AC-23/AC-23.meta.json`<br>`evidence/AC-23/AC-23.output.json`<br>`evidence/AC-23/AC-23.state.json`<br>`evidence/AC-23/AC-23.test-stdout.txt` |
| AC-24 | `evidence/AC-24/AC-24.arch-1.log`<br>`evidence/AC-24/AC-24.assets.attempt-1.log`<br>`evidence/AC-24/AC-24.assets.log`<br>`evidence/AC-24/AC-24.assets.tap.json`<br>`evidence/AC-24/AC-24.check.json`<br>`evidence/AC-24/AC-24.meta.json`<br>`evidence/AC-24/AC-24.output.json`<br>`evidence/AC-24/AC-24.state.json`<br>`evidence/AC-24/AC-24.test-stdout.txt` |
| AC-25 | `evidence/AC-25/AC-25.arch-1.log`<br>`evidence/AC-25/AC-25.arch-2.log`<br>`evidence/AC-25/AC-25.arch-3.log`<br>`evidence/AC-25/AC-25.assets.attempt-1.log`<br>`evidence/AC-25/AC-25.assets.log`<br>`evidence/AC-25/AC-25.assets.tap.json`<br>`evidence/AC-25/AC-25.check.json`<br>`evidence/AC-25/AC-25.meta.json`<br>`evidence/AC-25/AC-25.output.json`<br>`evidence/AC-25/AC-25.state.json`<br>`evidence/AC-25/AC-25.test-stdout.txt` |
| AC-26 | `evidence/AC-26/AC-26.arch-1.log`<br>`evidence/AC-26/AC-26.check.json`<br>`evidence/AC-26/AC-26.meta.json`<br>`evidence/AC-26/AC-26.occupancy.attempt-1.log`<br>`evidence/AC-26/AC-26.occupancy.log`<br>`evidence/AC-26/AC-26.occupancy.tap.json`<br>`evidence/AC-26/AC-26.output.json`<br>`evidence/AC-26/AC-26.state.json`<br>`evidence/AC-26/AC-26.test-stdout.txt`<br>`evidence/AC-26/AC-26.ui-views.attempt-1.log`<br>`evidence/AC-26/AC-26.ui-views.log`<br>`evidence/AC-26/AC-26.ui-views.tap.json` |
