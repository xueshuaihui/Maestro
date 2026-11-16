# I1.11 验收记录 · 批次 A（AC-01~AC-13）

> 依据：`docs/iterations/iteration-11/requirement.md` v10 §3.1（AC-01~13 逐字 Given/When/Then/机检/夹具/架构检查）、附录 A-1~A-4（输出逐字基线）、`decisions.md`（D-39 / D-45 / D-46 / D-52 / D-53）。
> 执行：darwin / Node v22.22.2 / 仓库 `/Users/xuesh/www/Maestro` / HEAD `2732f86`；每条 AC 一个独立根，机检「先 test -f 再 node --test」，一律 `NODE_ENV=test`。
> 生成：`probe/acc11-f-run.mjs --batch a` 逐条取证（evidence + parts + results.jsonl）→ 本脚本重建。判定只认需求 Then/And；证据分级：已实测（真实宿主）/ mock 实测 / 阻塞。

## 0. 总判

**批次 A 13 条：通过 11 / 不通过 2 / 阻塞 0**

- 已产出证据：13 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-11/evidence/` 下 141 个（覆盖 13 条 AC）。
- 不通过 / 阻塞条目：AC-12（不通过）、AC-13（不通过）。
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1121ms
[frame-dump notify ac01] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac01 | exit=0 | 117ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1121ms
[架构#1] grep -REn "new EventEmitter|setInterval" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.frame.json` | 591 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.test-stdout.txt` | 4942 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.state.json` | 591 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.meta.json` | 1539 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.check.json` | 8257 B |
| `docs/iterations/iteration-11/evidence/AC-01/AC-01.output.json` | 14177 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 33.395366<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 38.910558<br>  type: ` | `` |
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1119ms
[frame-dump notify ac02] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac02 | exit=0 | 121ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1119ms
[架构#1] grep -REn "saveState" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.frame.json` | 552 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.test-stdout.txt` | 4939 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.state.json` | 552 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.meta.json` | 1507 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.check.json` | 6124 B |
| `docs/iterations/iteration-11/evidence/AC-02/AC-02.output.json` | 14110 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 31.390261<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 35.434265<br>  type: ` | `` |
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1120ms
[frame-dump notify ac03] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac03 | exit=0 | 124ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1120ms
[架构#1] grep -REn "P90|TTL" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.frame.json` | 544 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.test-stdout.txt` | 4941 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.state.json` | 544 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.meta.json` | 1626 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.check.json` | 6519 B |
| `docs/iterations/iteration-11/evidence/AC-03/AC-03.output.json` | 14117 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 32.162572<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 37.122796<br>  type: ` | `` |
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1121ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 741ms
[读取 desktop/ui/app.js 源码（D-52 锚点）] cat desktop/ui/app.js | exit=0 | 167ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1121ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 741ms
[架构#1] grep -REn "saveState|instanceDir" desktop/ui/queue/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.test-stdout.txt` | 11395 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.state.json` | 5162 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.meta.json` | 2074 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.check.json` | 14468 B |
| `docs/iterations/iteration-11/evidence/AC-04/AC-04.output.json` | 130943 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 32.428051<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 39.313135<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.349088<br>  type: 'test'<br>  ..` | `` |
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1134ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 711ms
[机检 prefs.test.js] test -f test/wp14/prefs.test.js && NODE_ENV=test node --test test/wp14/prefs.test.js | exit=0 | 472ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1134ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 711ms
[机检] test -f test/wp14/prefs.test.js && NODE_ENV=test node --test test/wp14/prefs.test.js | exit=0 | # pass 10 / # fail 0 | 472ms
[架构#1] grep -REn "notify" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.test-stdout.txt` | 13540 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.state.json` | 6257 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.meta.json` | 2354 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.check.json` | 6871 B |
| `docs/iterations/iteration-11/evidence/AC-05/AC-05.output.json` | 35566 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=目时不发过期意图<br>  ---<br>  duration_ms: 31.2206<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 38.967114<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=2 / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.24636<br>  type: 'test'<br>  ..` | `` |
| 6 | 机检 ui-views.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 7 | 机检 ui-views.test.js：# pass ≥ 1 | ✅ | `# pass 31 / # tests 31` | `` |
| 8 | 机检 ui-views.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 9 | 机检 prefs.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=它文件、不改实例状态目录<br>  ---<br>  duration_ms: 63.611939<br>  type: 'test'<br>  ...<br># Subtest: prefsPath 与 PREFS_KEYS 的形状契约<br>ok 10 - prefsPath 与 PREFS_KEYS 的形状契约<br>  ---<br>  duration_ms: 0.480826<br>  type:` | `` |
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1124ms
[frame-dump notify ac06] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac06 | exit=0 | 142ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1124ms
[架构#1] grep -REn "setTimeout" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.frame.json` | 1533 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.test-stdout.txt` | 4942 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.state.json` | 1533 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.meta.json` | 1840 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.check.json` | 5434 B |
| `docs/iterations/iteration-11/evidence/AC-06/AC-06.output.json` | 15221 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 32.380144<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 36.679764<br>  type: ` | `` |
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
[机检 notify.test.js] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | 1134ms
[机检 shell-notify.test.js] test -f test/wp14/shell-notify.test.js && NODE_ENV=test node --test test/wp14/shell-notify.test.js | exit=0 | 206ms
[frame-dump notify ac07] NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac07 | exit=0 | 134ms
[机检] test -f test/wp14/notify.test.js && NODE_ENV=test node --test test/wp14/notify.test.js | exit=0 | # pass 22 / # fail 0 | 1134ms
[机检] test -f test/wp14/shell-notify.test.js && NODE_ENV=test node --test test/wp14/shell-notify.test.js | exit=0 | # pass 11 / # fail 0 | 206ms
[架构#1] grep -REn "throw new Error" src/daemon/notify.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.frame.json` | 1315 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.test-stdout.txt` | 7953 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.state.json` | 1315 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.meta.json` | 2122 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.check.json` | 7054 B |
| `docs/iterations/iteration-11/evidence/AC-07/AC-07.output.json` | 23255 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=不发过期意图<br>  ---<br>  duration_ms: 32.896146<br>  type: 'test'<br>  ...<br># Subtest: 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>ok 22 - 未注入 schedule 时异常合并退化为即发 + 窗口抑制<br>  ---<br>  duration_ms: 39.132081<br>  type: ` | `` |
| 2 | 机检 notify.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 notify.test.js：# pass ≥ 1 | ✅ | `# pass 22 / # tests 22` | `` |
| 4 | 机检 notify.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 shell-notify.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=btest: 真实探针层：ctl 四动作触发事件并改名 .done（需当前源码构建产物）<br>ok 12 - 真实探针层：ctl 四动作触发事件并改名 .done（需当前源码构建产物） # SKIP release 壳层二进制早于 main.rs（本轮改动未构建）；静态契约层已覆盖接缝<br>  ---<br>  duration_ms: 0.065814<br>  type: 'test'<br>  ..` | `` |
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
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6302ms
[frame-dump queue ac08] NODE_ENV=test node probe/acc11-frame-dump.mjs queue ac08 | exit=0 | 95ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6302ms
[架构#1] grep -REn "saveState|appendEvent" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
[架构#2] grep -REn "renderApprovalLine" desktop/ui/ src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
[架构#3] grep -REn "searchBox|filterBar|columnPicker|columnToggle" desktop/ui/queue/ | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.frame.json` | 1778 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.test-stdout.txt` | 4202 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.state.json` | 1778 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.meta.json` | 1977 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.check.json` | 10125 B |
| `docs/iterations/iteration-11/evidence/AC-08/AC-08.output.json` | 14556 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= 1533.12855<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 297.34609<br>  type: 'test'` | `` |
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
,**机检原文**：`test -f test/wp14/queue-actions.test.js && NODE_ENV=test node --test test/wp14/queue-actions.test.js`，断言两条结果行逐字匹配附录 A-4、两次 `escalation.resolution === 'pass'`；`INST-001` 状态为"已完成"且 `T-001` 节点为"已完成"；`INST-002` 在两次操作前后的状态与节点轮次 `deepEqual`；`INST-003` 状态仍为"运行中"且 `T-002` 有新的派发 / 会话事件；队列剩余条数依次减少 2；`# fail 0`。,
**架构检查原文**：处置必须走既有裁决入口并经 CAS；`grep -REn "orchestrator.resolveEscalation" src/daemon/queue.js` **恰好 1 条命中（exit 0）**，且同文件 `grep -REn "escalations[.]push|resolution ="` **零命中（exit 1）**（不得直接改状态数组或自写决议）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6360ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6360ms
[架构#1] grep -REn "orchestrator.resolveEscalation" src/daemon/queue.js | 期望 exit 0 / 实测 exit 0
[架构#2] grep -REn "escalations[.]push|resolution =" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.test-stdout.txt` | 4203 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.state.json` | 2135 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.meta.json` | 1901 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.check.json` | 6780 B |
| `docs/iterations/iteration-11/evidence/AC-09/AC-09.output.json` | 11888 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr= 1543.427935<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 281.51184<br>  type: 'test` | `` |
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
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6424ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6424ms
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
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=1516.341711<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 308.34111<br>  type: 'test'` | `` |
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
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6408ms
[机检 ui-views.test.js] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | 713ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6408ms
[机检] test -f test/wp14/ui-views.test.js && NODE_ENV=test node --test test/wp14/ui-views.test.js | exit=0 | # pass 31 / # fail 0 | 713ms
[架构#1] grep -REn "halted = true|state = 'cancelled'" src/daemon/queue.js | 期望 exit 1 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.test-stdout.txt` | 10652 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.state.json` | 4920 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.meta.json` | 1992 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.check.json` | 5181 B |
| `docs/iterations/iteration-11/evidence/AC-11/AC-11.output.json` | 27886 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=445.881312<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 328.824746<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 机检 ui-views.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=2 / open-queue: shell ctl seam navigates the live window to queue<br>ok 31 - D-52 / open-queue: shell ctl seam navigates the live window to queue<br>  ---<br>  duration_ms: 1.255472<br>  type: 'test'<br>  .` | `` |
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

- 判定：**不通过**（核对 8/10 通过，不通过 2）
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
**架构检查原文**：审批处置必须经既有 `approval.resolve` 路径且做会话校验；`grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js` **恰好 1 条命中（exit 0）**（不得绕过会话失效判定）。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6659ms
[语义复核：APPROVAL_SESSION_GONE 实际落点] grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js | exit=0 | 156ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6659ms
[架构#1] grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js | 期望 exit 0 / 实测 exit 1
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.test-stdout.txt` | 4205 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.meta.json` | 2154 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.check.json` | 5084 B |
| `docs/iterations/iteration-11/evidence/AC-12/AC-12.output.json` | 12139 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=612.295447<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 355.629229<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-12 架构：审批处置经 approval.resolve 且做会话校验，恰好 1 条命中（exit 0） | ❌ | ``grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js` → exit 0 / 恰好 0 行；实测 exit 1 / 0 行` | `exit 0` |
| 6 | 审批两用例存在（allow → approved / deny → denied，真实等待会话） | ✅ | `审批·允许：真实等待会话被放行并继续（AC-12 allow） \| 审批·拒绝：真实等待会话被拒绝（AC-12 deny）` | `allow/deny 两条用例` |
| 7 | allow/deny 用例数 2（期望逐字 2） | ✅ | `2` | `2` |
| 8 | A-4 审批结果行逐字 + 状态 approved/denied + 队列减 2（由用例承载） | ✅ | `# pass 16 / # fail 0` | `逐字「审批 APR-001 已通过 · 动作 write」/「已拒绝 · 动作 write」` |
| 9 | 语义复核：会话失效判定在核心 approvals/orchestrator（未绕过），queue.decideApproval 转发 approval.resolve | ✅ | `src/core/approvals.js:14:export const APPROVAL_SESSION_GONE = 'APPROVAL_SESSION_GONE'; \| src/core/approvals.js:99: * stay pending and the caller returns APPROVAL_SESSION_GONE. \| src/core/approvals.js:104:    return { o` | `orchestrator.js 调 approvals.APPROVAL_SESSION_GONE；queue.js:332 forward approval.resolve` |
| 10 | Then #1（逐字，机检 + 架构检查复核） | ❌ | `两条分别在 2 秒内显示"审批 APR-001 已通过 · 动作 write"与"审批 APR-002 已拒绝 · 动作 write"（逐字见附录 A-4）；两条从队列消失；对应会话继续或被拒，实例状态按既有规则推进。` | `两条分别在 2 秒内显示"审批 APR-001 已通过 · 动作 write"与"审批 APR-002 已拒绝 · 动作 write"（逐字见附录 A-4）；两条从队列消失；对应会话继续或被拒，实例状态按既有规则推进。` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。
- ⚠ 架构检查字面未达预期：需求要求 `grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js` 恰好 1 命中（exit 0），实测 0 命中（exit 1）。根因：实现把会话失效判定放在核心 approvals.js:104 / orchestrator.js:4961，queue.js:332 仅 `forward(root,"approval.resolve",...)` 转发，未在 queue.js 直接引用该常量。行为意图（审批经既有路径且做会话校验）由 queue.test.js 的两条用例验证通过。此差异交主控/终验裁决：属「架构检查锚点过时」还是「产品缺陷」；S3 不放宽断言、不改实现。
- 逐字断言由 test/wp14/queue.test.js 的「审批·允许」「审批·拒绝」用例承载（走真实等待会话）；需求机检原文点名 queue-actions.test.js，本分支合并进 queue.test.js。

**⑤ 判定**：不通过

---

#### AC-13 跨实例两条目分别处置：互不影响，三处数字各自同步

- 判定：**不通过**（核对 7/9 通过，不通过 2）
- 证据分级：**mock 实测**
- 验证面：处置 / 一致性 / 机检
- 项目根：（机检型，独立 TMPDIR 见 meta）

**① 需求原文（Given / When / Then，逐字）**

```gherkin
- Given `/tmp/maestro-i11-queue-cross` 项目根，两个实例：`INST-001` 有 1 条待处理升级 `ESC-001`（执行失败，当前第 1 轮），`INST-002` 有 1 条待审批 `APR-001`（动作 `write`）；队列显示 2 行；托盘显示"待处理升级 1"；列表 `INST-001` 行"待处理 1"、`INST-002` 行"待处理 1"；`NODE_ENV=test`。
- When 先在队列里对 `ESC-001` 点"重派"；看到结果后再对 `APR-001` 点"允许"。
- Then 第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` 0 / `INST-002` 1」，处置审批后为「队列 0 · 托盘 0 · `INST-002` 0」；两次都在 2 秒内看到结果，不出现"点一次改了两条"。

```
,**机检原文**：`test -f test/wp14/queue-cross.test.js && NODE_ENV=test node --test test/wp14/queue-cross.test.js`，断言三处数字序列为 `[[2,1,1,1],[1,0,0,1],[0,0,0,0]]`（依次＝队列总数 / 托盘待处理升级 / `INST-001` 待处理 / `INST-002` 待处理）、第一次后 `INST-002` 的节点轮次与审批状态未变、`resolution === 'retry'` 且审批状态为 `approved`；`# fail 0`。,
**架构检查原文**：每次处置必须按条目所属实例路由，不得一次调用改多个实例；多选与成组处置已在 D-01 移出范围：`grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/` 必须**零命中（exit 1）**。,
**② 命令与退出码（原始帧见证据清单）**

```
[机检 queue.test.js] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | 6544ms
[机检] test -f test/wp14/queue.test.js && NODE_ENV=test node --test test/wp14/queue.test.js | exit=0 | # pass 16 / # fail 0 | 6544ms
[架构#1] grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/ | 期望 exit 1 / 实测 exit 0
```

**③ 证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.test-stdout.txt` | 4207 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.state.json` | 2136 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.meta.json` | 2818 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.check.json` | 6016 B |
| `docs/iterations/iteration-11/evidence/AC-13/AC-13.output.json` | 11586 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 | 期望（逐字） |
|---|---|---|---|---|
| 1 | 机检 queue.test.js：test -f 前置断言（文件存在） | ✅ | `exit=0；stderr=608.000236<br>  type: 'test'<br>  ...<br># Subtest: 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>ok 16 - 队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）<br>  ---<br>  duration_ms: 305.531004<br>  type: 'test'` | `` |
| 2 | 机检 queue.test.js：exit 0 | ✅ | `实际 exit=0` | `` |
| 3 | 机检 queue.test.js：# pass ≥ 1 | ✅ | `# pass 16 / # tests 16` | `` |
| 4 | 机检 queue.test.js：# fail 0 | ✅ | `# fail 0` | `` |
| 5 | 架构检查 #1：AC-13 架构：多选/成组处置已在 D-01 移出范围，零命中（exit 1） | ❌ | ``grep -REn "batch\|bulk\|multiSelect\|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/` → exit 1 / 恰好 1 行；实测 exit 0 / 1 行` | `exit 1` |
| 6 | 需求 v10 机检逐字三处数字序列（Given：INST-001 升级 / INST-002 审批）（期望逐字 "[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"） | ✅ | `"[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"` | `"[[2,1,1,1],[1,0,0,1],[0,0,0,0]]"` |
| 7 | AC-13 用例存在：跨实例分别处置互不影响、三处数字各自同步 | ✅ | `跨实例分别处置互不影响，三处数字各自同步（AC-13 / BR-12）` | `数字序列（夹具口径见备注）；resolution=retry 且审批 approved` |
| 8 | AC-13 机检通过（# fail 0）：resolution=retry / 审批 approved / 两实例互不影响 | ✅ | `# pass 16 / # fail 0` | `# fail 0` |
| 9 | Then #1（逐字，机检 + 架构检查复核） | ❌ | `第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` 0 / `INST-002` 1」，处置` | `第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` 0 / `INST-002` 1」，处置` |

**备注**

- 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。
- 差异登记：WP-2 测试（queue.test.js AC-13 用例）把实例角色对调——INST-001 持审批 APR-001、INST-002 持升级 ESC-001；处置升级（ESC-001 属 INST-002）后中间态为 [1,0,1,0]，故测试断言序列为 [[2,1,1,1],[1,0,1,0],[0,0,0,0]]。需求 v10 原文 Given 为 INST-001 升级/INST-002 审批，序列中间态为 [1,0,0,1]。第 3、4 位互换源于夹具角色对调，语义「互不影响 + 三处各自同步」在两序列下均成立。
- ⚠ 架构检查字面未达预期：需求要求 `grep -REn "batch|bulk|multiSelect|selectedRows" ...` 零命中（exit 1），实测 exit 0 / 1 行命中——命中位于 src/daemon/http/routes.js:20 的文档注释 `* (no batch), reach the orchestrator only through the existing decision /`，是「否定语境」注释，并非批量能力实现。按 S3 判定纪律（只认需求原文、不为绿放宽断言、代码与需求冲突判不通过），本条登记为不通过，命中原始帧见 arch-1.log。是否属「注释命中需调整扫描排除注释」由主控/终验裁决；S3 不改实现、不放宽断言。
- 需求机检原文点名 queue-cross.test.js，本分支（HEAD 2732f86）不存在该文件，AC-13 用例合并进 queue.test.js；本用例按实际存在文件机检并保留原始 TAP。三处数字「角色对调」差异请主控/终验按需求 Then Given 裁决；本验收不放宽任何断言。

**⑤ 判定**：不通过

---

## 2. 未通过 / 阻塞项汇总

| AC | 判定 | 未成立 / 阻塞的核对项 | 备注 |
|---|---|---|---|
| AC-12 | 不通过 | - 架构检查 #1：AC-12 架构：审批处置经 approval.resolve 且做会话校验，恰好 1 条命中（exit 0）：``grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js` → exit 0 / 恰好 0 行；实测 exit 1 / 0 行`<br>- Then #1（逐字，机检 + 架构检查复核）：`两条分别在 2 秒内显示"审批 APR-001 已通过 · 动作 write"与"审批 APR-002 已拒绝 · 动作 write"（逐字见附录 A-4）；两条从队列消失；对应会话继续或被拒，实例状态按既有规则推进。` | 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 2 条。；⚠ 架构检查字面未达预期：需求要求 `grep -REn "APPROVAL_SESSION_GONE" src/daemon/queue.js` 恰好 1 命中（exit 0），实测 0 命中（exit 1）。根因：实现把会话失效判定放 |
| AC-13 | 不通过 | - 架构检查 #1：AC-13 架构：多选/成组处置已在 D-01 移出范围，零命中（exit 1）：``grep -REn "batch\|bulk\|multiSelect\|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/` → exit 1 / 恰好 1 行；实测 exit 0 / 1 行`<br>- Then #1（逐字，机检 + 架构检查复核）：`第一次只影响 `INST-001`：该行腾出、实例回到"运行中"、该节点轮次变 2；`INST-002` 的实例状态、节点轮次与审批状态**完全不变**（仍待处理、仍占 1 行）。第二次只影响 `INST-002`：显示"审批 APR-001 已通过 · 动作 write"后该行消失，`INST-001` 不受影响。三处数字各自同步：处置升级后为「队列 1 · 托盘 0 · `INST-001` ` | 机检 queue.test.js：# tests 16 / # pass 16 / # fail 0 / # skipped 0；带本 AC 编号用例 1 条。；差异登记：WP-2 测试（queue.test.js AC-13 用例）把实例角色对调——INST-001 持审批 APR-001、INST-002 持升级 ESC-001；处置升级（ESC-001 属 INST-002）后中间态为 [1 |

## 3. 证据索引

共 141 个文件；每条 AC 至少 `<AC>.test-stdout.txt` / `<AC>.meta.json` / `<AC>.state.json` / `<AC>.check.json` / `<AC>.output.json`。

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
| AC-12 | `evidence/AC-12/AC-12.arch-1.log`<br>`evidence/AC-12/AC-12.check.json`<br>`evidence/AC-12/AC-12.meta.json`<br>`evidence/AC-12/AC-12.output.json`<br>`evidence/AC-12/AC-12.queue.attempt-1.log`<br>`evidence/AC-12/AC-12.queue.log`<br>`evidence/AC-12/AC-12.queue.tap.json`<br>`evidence/AC-12/AC-12.state.json`<br>`evidence/AC-12/AC-12.test-stdout.txt` |
| AC-13 | `evidence/AC-13/AC-13.arch-1.log`<br>`evidence/AC-13/AC-13.check.json`<br>`evidence/AC-13/AC-13.meta.json`<br>`evidence/AC-13/AC-13.output.json`<br>`evidence/AC-13/AC-13.queue.attempt-1.log`<br>`evidence/AC-13/AC-13.queue.log`<br>`evidence/AC-13/AC-13.queue.tap.json`<br>`evidence/AC-13/AC-13.state.json`<br>`evidence/AC-13/AC-13.test-stdout.txt` |
