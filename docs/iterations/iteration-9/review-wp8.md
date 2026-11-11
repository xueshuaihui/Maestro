# I1.9 S2 批次 5（WP-8）独立评审报告

- 评审对象：`src/cli/main.js`、`src/daemon/server.js`、`test/wp9/i19-cli.test.js`
- 评审基线：`HEAD = 322fb5e`（`main`）
- 评审方式：干净上下文独立评审，全部结论以本人实跑原始输出为准，不采信实现者自述
- 评审日期：2026-11-12

---

## 1. 评审范围与判据来源

### 1.1 范围

| 文件 | 状态 | 实际变更 |
|---|---|---|
| `src/cli/main.js` | 改 | `git diff --stat`：183 行变更 |
| `src/daemon/server.js` | 改 | `git diff --stat`：52 行变更 |
| `test/wp9/i19-cli.test.js` | 新增 | 562 行、12 个用例 |

两文件合计 `233 insertions(+), 2 deletions(-)`。`src/core/orchestrator.js`（WP-7）、`test/wp9/i19-orchestrator.test.js`（WP-7）、`docs/iterations/iteration-9/decisions.md`（主控 D-19~D-22 裁决）**不计入 WP-8**，仅作为依赖与对照。

### 1.2 判据来源（均已逐段阅读）

- `docs/iterations/iteration-9/requirement.md`
  - 附录 A-0 ~ A-14（L540-795）逐字基线
  - AC-09（L299-308）、AC-10（L310-319）、AC-19（L415-424）、AC-21（L437-446）、AC-22（L448-457）、AC-23（L459-468）、AC-24（L470-479）、AC-25（L481-490）、AC-26（L492-501）
  - §3.3 命令口径（L522-537）
  - 附录 D-6（L991-1001）、D-7（L1003-1032）、D-8（L1034-1041）
- `docs/iterations/iteration-9.md`：WP-8 段（L489-495）、§2.10~§2.13（L208-227）、§8 风险/冲突表（C-10/C-14、风险 #10/#14/#16/#17）
- `docs/iterations/iteration-9/decisions.md`：D-6 / D-7 / D-8 / D-9 / D-11 / D-12 / D-14 / D-18 / D-19 / D-20 / D-21 / D-22
- `src/cli/render.js`（WP-6 五个纯函数与 `renderEventLines` 分派）、`src/core/trace.js`、`src/core/event-bus.js`（`replay.badLines` 非枚举）、`src/core/health.js`、`src/persistence/instance-store.js`（`load`）
- `docs/iterations/iteration-7/baseline-failures.txt`（8 行基线，未改）

### 1.3 基线对照方式

- 基线树：复用已存在的 `git worktree` `/tmp/i19-wp7-baseline`，`git -C /tmp/i19-wp7-baseline rev-parse HEAD = 322fb5e43a96739e89a571341495c84bfba4a159`，工作区干净（`grep -c traceCommand` = 0）。
- 逐字对照：同一夹具分别用当前 `bin/orch.js` 与基线 `bin/orch.js` 实跑后 `diff`。
- 代码对照：`git show 322fb5e:src/cli/main.js`、`git show 322fb5e:src/daemon/server.js`、`git show 322fb5e:src/cli/render.js`。
- 所有夹具均在 `os.tmpdir()`（macOS 为 `/var/folders/...`）下独立根，`NODE_ENV=test`，`.orch/hosts/mock.json` 指向 `test/fixtures/mock-acp-agent.js`；快照夹具按 §3.3 先起核心、再写 `state.json` / `traces.jsonl`。

---

## 2. 逐项独立验证记录

### A. `trace show`（AC-09 / AC-10 / AC-22 / AC-23）

#### A-1 空实例（A-1）

夹具：先 `instance status INST-001` 拉起核心（输出 `实例 INST-001 · 不存在`），再写 `state:'created'` 快照，无 `traces.jsonl`。

```
$ NODE_ENV=test node bin/orch.js trace show INST-001
实例 INST-001 · 暂无追踪记录
exit=0
stderr: (空)
```

`od -c` 确认行尾仅一个 `\n`、无多余空格。**PASS**。

#### A-2 单节点（A-2）

真实 `run --cwd . --template single --host mock --task "写一份说明"`（run exit=0）后：

```
$ NODE_ENV=test node bin/orch.js trace show INST-001
实例 INST-001 · 追踪 TRC-be3114f8
跨度 1 条 · 回流 0 次

02:09:21 → 02:09:26  T-001  已完成  交接 HO-001

回流链
无
exit=0
stderr: (空)
```

- 头行匹配 `TRC-[0-9a-f]{8}`；`state.json` 的 `traceId` 与头行一致；
- `traces.jsonl` 实落 1 条跨度，`trace_id` 同号；
- 共 7 行，末尾「回流链」「无」两行。**PASS**。

#### A-5 实例不存在（A-5）

```
$ NODE_ENV=test node bin/orch.js trace show INST-999
实例 INST-999 · 不存在
exit=1
stderr: (空)
堆栈正则 at .+:\d+:\d+ : (no stack)
```

**PASS**。

#### A-10 进行中（A-10，D-19 新语义）

夹具：`mock-acp-agent.js --hold-session` 后台 `run`，轮询到 `nodes[0].state === 'running'`、`traces.jsonl` 不存在时，第二进程执行 `trace show`：

```
$ NODE_ENV=test node bin/orch.js trace show INST-001
实例 INST-001 · 追踪 TRC-fad13799
跨度 0 条 · 回流 0 次

02:10:02 → —  T-001  进行中  交接 HO-001

回流链
无
exit=0
stderr: (空)
```

- `state.json` 实测 `{"state":"running","traceId":"TRC-fad13799", ...}`，首行追踪号与之相等；
- 不出现「暂无追踪记录」；结束位 `—`、结果位 `进行中`。**PASS**。

#### A-11 追踪文件坏行（A-11）

夹具：2 条正常跨度 + 末尾半行 `{"trace_id":`。

```
$ NODE_ENV=test node bin/orch.js trace show INST-001
实例 INST-001 · 追踪 TRC-aaaaaaaa
追踪记录有 1 行不可读，已跳过
跨度 2 条 · 回流 0 次

18:00:00 → 18:01:00  T-001  已完成  交接 无
18:01:00 → 18:02:20  T-002  已完成  交接 无

回流链
无
exit=0
```

提示行位于汇总行之前（第 2 行 vs 第 3 行），2 条正常跨度全部列出。**PASS**。

#### A-13 事件日志坏行（A-13）

见 C 段实测：末尾单独一行 `已跳过 1 行不可读记录`，无时刻前缀。**PASS**。

#### AC-10 只读（三次字节一致 + 哈希不变）

诱饵夹具：`state:'created'`、`health` 只有 `nodeTimeoutMs`、**无 `health.level`**；若 `trace show` 走 `instance.get` 的首次健康度受控写，`state.json` 必被改写。

```
run1 exit=0
run2 exit=0
run3 exit=0
state sha before=6c46efe558662cfa856f9d94e779666a658d1c3b13bbf78c3ed9622644bab90e
state sha after =6c46efe558662cfa856f9d94e779666a658d1c3b13bbf78c3ed9622644bab90e
events.jsonl: 运行前后均不存在
cmp o1 o2 && cmp o1 o3 => BYTE-IDENTICAL
health.level = undefined（未被写回）
stderr 三个文件均 0 字节
```

补充失败实例夹具（存在 failed 跨度、会走 `loadExecutionSummaries` → `instance.events`）：

```
state  before=b04bfe43...a77fa after=b04bfe43...a77fa（相同）
events before=3ea3030a...80826 after=3ea3030a...80826（相同）
```

`trace show` 调用链实测只走 `instance.trace` 与（失败跨度时）`instance.events` 两个只读 RPC。**PASS**。

#### 退出码与参数路径

```
$ trace show INST-001 --format json
exit=2
输出末行：（未知参数：--format）
.orchestrator/core.json 未生成（未连核心）

$ trace
exit=2
输出末行：（trace 需要子命令：show）

$ trace show            # 缺实例号
exit=2
走既有 usage 块

$ trace show A B
exit=2
（多余的参数：B）

$ trace show --instance INST-001
exit=0
实例 INST-001 · 暂无追踪记录

USAGE_LINES = 25，contains trace = false
```

**PASS**。

#### 补充：A-4 失败摘要附着（D-22 附加只读 `view` 的落点）

手工夹具：1 条 `status:'failed'` 跨度 + 1 条 `execution.summary`：

```
实例 INST-001 · 追踪 TRC-deadbeef
跨度 1 条 · 回流 0 次

18:00:40 → 18:01:30  T-001  失败  交接 无
  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log

回流链
无
```

摘要仅在失败跨度下附着，成功/进行中跨度不附着；该次调用前后 `state.json` / `events.jsonl` 哈希均不变。**PASS**。

#### 补充：A-3 回流链组装（WP-8 `backflowPayload` 集成）

手工 code-loop 夹具（3 条跨度、HO-002 `edge.kind='backflow'`、round=2）：

```
实例 INST-001 · 追踪 TRC-aabbccdd
跨度 3 条 · 回流 1 次

18:00:00 → 18:00:40  T-001 开发  已完成  交接 HO-001
18:00:40 → 18:01:30  T-002 测试  失败  交接 HO-001 HO-002
18:01:30 → 18:02:20  T-001 开发  已完成  交接 HO-002

回流链
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

与 A-3 基线结构逐字一致（时刻随夹具）。**PASS**。

---

### B. `instance status` / `graph`（AC-19）

同一份 `single` 运行中快照（T-001 done 2s、HO-001 created），分别用当前树与基线树实跑：

```
=== 当前 instance status ===
1  实例 INST-001 · 运行中
2  健康度 正常
3  节点 已完成 · 耗时 2s
4  交接包 HO-001  已构造   18:00:03

=== 删除健康度行后 vs 基线 ===
$ diff base.status cur.status.nohealth
STATUS-IDENTICAL-AFTER-REMOVAL

=== graph 文本 ===
$ diff base.graph cur.graph
GRAPH-TEXT-IDENTICAL

=== graph JSON ===
$ diff base.graph.json cur.graph.json
GRAPH-JSON-IDENTICAL

=== graph 健康度字段 ===
grep -i health => (none)
```

- 健康度行恰在第 2 行（实例状态行之后）；
- `orch status` 列表行不含健康度（`grep '健康度'` = none）；
- 列表行骨架 `实例 INST-001 · 运行中 · 节点 已完成 · 会话 - · 耗时 2s · 更新 HH:MM:SS` 不变。

说明：列表行的 `更新` 字段在首次 `instance status` 触发 WP-7 健康度受控写后会变为写入时刻（基线为快照 `updatedAt`），属 WP-7 行为，非 WP-8 回归，见建议 S-5。**PASS**。

---

### C. `instance log`（AC-24 / AC-26 / A-8 / A-12 / A-13 / A-14）

#### C.1 A-12 / A-8 / A-13 行

夹具：3 条合法事件（run.started / execution.summary / health.changed）+ 末尾半行。

当前树：

```
1  18:00:00  实例 INST-001  已创建 → 运行中  原因 run.started
2  18:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log
3  18:03:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级
4  已跳过 1 行不可读记录
exit=0, stderr 空
```

- A-12 行四项齐全、` · ` 分隔；
- A-8 行为中文档位 + 中文原因；
- A-13 行无时刻前缀、单独成行、位于末尾。**PASS**。

#### C.2 既有事件行格式与相对顺序

基线树（`322fb5e`）的 `render.js` 已含 WP-6 的 `reason` 分派，因此基线也能渲染 A-12/A-8 行。两树同一夹具 `instance log` 的完整 diff：

```
$ diff base.log cur.log
3a4
> 已跳过 1 行不可读记录
```

即：既有 `run.started` 行逐字相同、A-12/A-8 行逐字相同、相对顺序相同；**唯一差异是 WP-8 新增的 A-13 跳过行**（预期新增）。**PASS**。

#### C.3 `--format json` 与 `result.badLines`

```
$ instance log INST-001 --format json
cur  seq = [1, 2, 3]
base seq = [1, 2, 3]
（两树 JSON 完全一致）

直连 RPC instance.events:
ok=true
result.badLines = 1 (number)
result.events.length = 3
Object.keys(result.events) 不含 'badLines'（非枚举属性未泄漏）
```

文本跳过行 `已跳过 1 行不可读记录` 与 RPC `badLines=1` 同源；`main.js` 代码读取的是 `eventsRes.result?.badLines`，**未**对 `replay` 结果按 `{ events, badLines }` 解构。**PASS**。

#### C.4 A-14 取消收尾（真实 live 取消，非夹具替代）

夹具：`mock-acp-agent.js --turn-delay-ms 30000`，后台 `run --template single`；轮询 `events.jsonl` 出现该会话 `to:"tool_running"`（实测 seq=7）后，第二进程 `cancel`：

```
cancel exit=0
会话 空闲
节点 T-001 worker 已取消
交接包 HO-001 已拒绝（已撤回）

instance log（末两行）:
02:14:19  会话 mock-sess-22709-1  执行中 → 空闲  原因 run.cancelled
02:14:19  会话 mock-sess-22709-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供

instance status:
实例 INST-001 · 已取消
健康度 已结束
```

事件原文：`{"reason":"execution.summary",...,"summary":{"command":null,"exitCode":null,"keyOutputLines":null,"logRef":null}}`，该会话恰 1 条摘要。**PASS**（取证等级：真实 CLI 全链路）。

---

### D. `src/daemon/server.js`（D-6 / D-22）

1. **只读性**：`instance.trace` 新增块内无 `emit` / `computeHealth` / `saveState` / 写文件调用（`sed -n '241,282p' | grep` 仅命中英文注释）；实测正常路径 `trace show` 前后 `state.json` / `events.jsonl` 哈希不变（A 段 AC-10）。
2. **`traceId` 取值顺序**：
   - `state.traceId` 优先：A-2 / A-10 / 手工 `TRC-11112222` 夹具均命中；
   - 首条已落地跨度回落：历史实例（删 `traceId`）+ `TRC-aaaaaaaa` 跨度 → 头行 `TRC-aaaaaaaa`；
   - `null`：`created` 且无跨度 → A-1「暂无追踪记录」。
   历史实例回落正常。**PASS**（「运行中 + 无 traceId + 无跨度」边界见 S-1）。
3. **其它 RPC 零改**：方法名集合 diff 仅一行新增：

```
$ diff base-methods.txt cur-methods.txt
8a9
> 'instance.trace': async
```

`instance.events` 仅新增 `badLines` 字段（D-7 L1031 授权），既有方法表、错误映射、`instance.get` 返回结构未改。**PASS**。

---

### E. 冻结红线与越界

#### E.1 文件边界

```
$ git status --short -- src test package.json
 M src/cli/main.js
 M src/core/orchestrator.js          # WP-7，不计 WP-8
 M src/daemon/server.js
?? test/wp9/i19-cli.test.js
?? test/wp9/i19-orchestrator.test.js # WP-7
```

- WP-8 恰 3 个文件；
- `test/wp9/cli-e2e.test.js`：`git status` / `git diff --stat` 均为空（零改动，符合 D-21）；
- `src/cli/render.js`、`src/cli/labels.js`、`src/persistence/**`、`src/adapter/**`、`package.json` 零改动；
- `docs/**` 仅 `decisions.md`（主控 D-19~D-22）与既有 WP-7 评审文档，非 WP-8；
- `src/core` 仅 `orchestrator.js`（WP-7），`health.js` / `trace.js` 零改动。**PASS**。

#### E.2 三主链逐字（交替 6 对）

脚本：`/tmp/i19-wp7-chains.mjs`；基线树 `/tmp/i19-wp7-baseline`。归一化：会话号 / `HH:MM:SS` / `已运行 Ns` / `耗时 Ns` / `第 N 轮`。

| 链 | 归一化逐字 diff |
|---|---|
| `single` | 6/6 对 IDENTICAL |
| `code-loop` | 6/6 对 IDENTICAL |
| `task-loop` | 2/6 对仅差基线固有 flaky 行 `会话 已升级`；剔除该行后 6/6 IDENTICAL |

`会话 已升级` 出现率：基线 5/6（pair6 缺）、当前 5/6（pair1 缺）→ **当前不低于基线**，未见系统性劣化。**PASS**。

#### E.3 纯净、依赖与中文

```
$ node -p "Object.keys(require('./package.json').dependencies||{}).length"
0
$ node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))"
25
$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "<31 词全表>"
OK: 扫描 24 个文件，... 零命中
exit=0
```

新增段中文扫描（`git diff` 解析）：
- `src/daemon/server.js` 新增段无中文；
- `src/cli/main.js` 新增段：22 行中文注释；**1 处中文字面量** `未知参数：--${key}`（第 532 行），与基线既有 3 处同字面量完全一致（`grep -F` 基线命中 290/299/488 行），属既有解析层错误文案复用，非新措辞。见建议 S-3。
- 所有 `trace` / 健康度 / 摘要用户可见文案均来自 `render.js` + `labels.js`，`main.js` 不拼中文。**PASS**。

---

## 3. 门禁实跑数字表

在 `/Users/xuesh/www/Maestro`、`NODE_ENV=test` 下独立复跑：

| 门禁命令 | tests | pass | fail | skip | 耗时 |
|---|---:|---:|---:|---:|---:|
| `node --test test/wp9/i19-cli.test.js` | 12 | 12 | 0 | 0 | 84.3s |
| `node --test test/wp9/cli-e2e.test.js` | 4 | 4 | 0 | 0 | 29.1s |
| `node --test "test/wp9/**/*.test.js"` | 107 | 107 | 0 | 0 | 88.5s |
| `node --test test/wp11/status-doc.test.js test/wp11/labels-sync.test.js test/wp12/cli-assets.test.js` | 44 | 44 | 0 | 0 | 2.9s |
| `dependencies` 键数 | — | 0 | — | — | — |
| `USAGE_LINES.length` | — | 25 | — | — | — |
| `purity-check`（31 词，`src/core,src/daemon`） | 24 文件 | exit 0 | — | — | — |

全部门禁为绿。未跑全量 `node --test "test/**/*.test.js"`（按任务要求，避免改写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`）。

---

## 4. 阻断项清单

**无。**

逐条对照阻断口径：

| 阻断口径 | 结果 |
|---|---|
| 附录 A 任一逐字行不成立 | 未发现（A-1/2/3/4/5/8/10/11/12/13/14 实测命中） |
| 退出码不符 | 未发现（A-1/2/10/11/13 = 0；A-5 = 1；参数错误 = 2） |
| AC-10 只读被破坏 | 未发现（三次字节一致、state/events sha256 不变、health.level 未写回） |
| `status` 删健康度行后不逐字 | 未发现（与基线 diff 为空） |
| `graph` 出现健康度字段 | 未发现（文本/JSON 与基线字节一致） |
| 既有事件行顺序被改 | 未发现（与基线唯一差异为新增 A-13 行） |
| `badLines` 未透出 | 未发现（RPC `result.badLines = 1`，number，与文本同源） |
| 三主链出现「比基线差」的差异 | 未发现（single/code-loop 6/6；task-loop 剔除固有 flaky 行后 6/6，出现率不低于基线） |
| 越界改文件 | 未发现（WP-8 恰 3 文件；`cli-e2e` 零改动） |
| `USAGE_LINES` 变化 | 未发现（仍 25 行、不含 trace） |

---

## 5. 建议项清单

> 以下均**不阻断**，且不改变任何 AC 判据；D-19 / D-20 / D-21 / D-22 已裁决项不在此重升。

- **S-1（低，升级边界）** 历史实例「`state='running'` + 无 `state.traceId` + 无任何已落地跨度」时，`trace show` 首行为 `实例 INST-001 · 追踪 `（追踪号为空、行尾一个空格），既非 A-10（首行带号）也非 A-1（暂无追踪记录）。证据：手工快照删 `traceId`、无 `traces.jsonl`，输出 `od -c` 为 `... 追踪 \n`；补 `traceId: 'TRC-11112222'` 后即为完整 A-10。影响面仅为「升级前创建、升级后仍未落跨度」的实例；AC-22 夹具由当前代码创建必带 `state.traceId`，不影响 AC。建议在 `report.md` §5 登记；若需严格符合 D-19「空跨度旧实例按 A-1」的字面，可在渲染层对「空 traceId 且仅有进行中叠加跨度」降级为 A-1 或占位（不伪造编号）。
- **S-2（低，异常路径写盘）** `instance.trace` 复用 `store.load`，状态损坏时会走 `markCorrupt` 写出 `state.json.corrupt` 备份。实测：损坏 `state.json` 后 `trace show` 退出 1 并新增 `state.json.corrupt`。正常路径零写盘已复核。D-22「不得写盘」若按字面覆盖异常路径，可改用纯读的 `readDiskState` 类接口；不影响 AC-10（正常实例）取证。
- **S-3（低，中文硬编码口径）** `src/cli/main.js:532` 新增 `usage(\`未知参数：--${key}\`)`，是基线既有同字面量的第 4 处（基线 290/299/488 行）。严格按 D-6「新增中文只落 `labels.js`」属重复硬编码；但该错误文案基线中本就不在 `labels.js`，且与既有解析层约定一致，改动反而会扩大 WP-8 范围。建议维持现状并在 `report.md` §5 注明。
- **S-4（信息，BR-24 极端组合）** 追踪文件存在但**全部行不可读**、且实例无有效 `traceId` 时，输出 A-1「暂无追踪记录」而不显示 A-11 降级提示（实测 2 行坏行 → 仅 A-1）。AC-23 的坏行夹具（1 坏 + 2 正常）不受影响，A-11 逐字成立；该组合属 `renderTraceShow` 在 `hasTrace=false` 时提前返回的边界，非 WP-8 组装层缺陷，建议 S3 取证时登记。
- **S-5（信息，转 WP-7/WP-9）** 首次 `instance status` 触发 WP-7 健康度受控写后，`orch status` 列表行的 `更新` 会变为写入时刻（基线为快照 `updatedAt`）；重复 `orch status` 稳定。属 WP-7 / D-7 行为，非 WP-8 回归；建议 WP-9 在 AC-19 取证时明确「逐字比对只覆盖 `instance status` 与 `graph`，列表行只校验无健康度」。

---

## 6. 结论

**PASS（阻断 0 / 建议 5）**

WP-8 的三个交付文件在附录 A 逐字基线、退出码、AC-10 只读、AC-19 状态/图回归、A-12/A-8/A-14 日志渲染、A-13/`badLines` 透出、daemon 只读接口、三主链逐字与全部门禁上均通过独立实跑验证。5 条建议均为低风险边界或口径澄清，不构成合入阻断。

---

## 7. 声明

- 未修改任何产品代码或测试代码；
- 未执行 `git commit` / `git add` / `git stash`，未改动暂存区与工作区受控文件；
- 仓库内唯一写入为 **本报告** `docs/iterations/iteration-9/review-wp8.md`；
- 所有夹具、临时输出与归一化文件均位于 `os.tmpdir()`（`/var/folders/...`）与 `/tmp`，未进入仓库。
