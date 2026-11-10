# I1.9 S2 批次 3 · WP-5 独立评审报告

> 评审角色：WP-5 独立评审 Agent（干净上下文，与实现者分离）。
> 本评审**不采信作者任何自述**，全部结论来自独立实跑复核：`git show HEAD:` 逐行 diff、真实 `spawn` 宿主进程按 `\n` 切行读原始帧、门禁命令实跑、`git status` 越界扫描。
> 评审日期：2026-11-11。仓库 HEAD：`0cf6b49`（`docs(I1.9): S2 batch-2 independent review PASS + progress ledger`）。

---

## 1. 评审范围与判据来源

### 1.1 评审对象（作者交付的两个文件）

| 文件 | 状态 | 本评审动作 |
|---|---|---|
| `test/fixtures/mock-acp-agent.js` | 改（` M`） | 逐行 diff + 真实 spawn 复核三种 argv + HEAD 逐字回归对比 |
| `test/wp9/i19-fixture.test.js` | 新建（`??`） | 全文审读测试质量 + 门禁实跑 |

### 1.2 判据来源（均已独立读取）

| 来源 | 段落 | 关键判定点 |
|---|---|---|
| `docs/iterations/iteration-9/requirement.md` | AC-04 L241-251 | 失败摘要四要素：`node out/run.js` / 退出码 1 / 输出 3 行 / `host-logs/T-001.log`；`--fail-tool`；日志由夹具预置在项目根、不在实例目录内 |
| 同上 | AC-05 L253-262 | `--fail-tool-no-refs` 只给命令+退出码；实例目录内不存在完整日志副本；`src/core` 不读取正文 |
| 同上 | AC-26 L492-501 | 取消收尾用既有 `--turn-delay-ms 30000` 构造 `tool_running`，四项全「未提供」；**依赖既有分支逐字不变** |
| 同上 | 附录 A-4 L610-619 | `失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log` |
| 同上 | 附录 A-12 L762-772 / A-14 L783-795 | 执行摘要行模板、缺项「未提供」、取消摘要同一行模板 |
| 同上 | D-4 L972-979 | 摘要四项字段名 `command`/`exitCode`/`keyOutputLines`/`logRef`；`toolName`（`tool_call.title`，mock 为 `write`）不得冒充 `command`；帧名取 `tool_call`/`tool_call_update`；**既有 12 个开关与三条场景套件行为逐字不变** |
| `docs/iterations/iteration-9.md` | WP-5 段 L465-471 | 负责文件仅 2 个；两开关默认关闭；既有 12 开关与三条场景套件逐字不变 |
| 同上 | §2.14 表 L247 | 负责文件表同上；两个 driver / purity / baseline 属「不改（只读基线）」 |
| `docs/iterations/iteration-9/decisions.md` | **D-10** L101-107 | **主控冻结载体**：`tool_call` 帧加 `execution:{command}`；`tool_call_update` 完成帧加 `execution:{exitCode,keyOutputLines?,logRef?}`；`--fail-tool` 报全四项、`--fail-tool-no-refs` 只报 `command`+`exitCode` 且两缺项键不得出现在帧里；`title` 恒为工具名不得塞命令行；`status='failed'`；`stopReason` 仍 `end_turn`、不新增失败码 |
| 同上 | D-3 L36-43 | 夹具命令行统一 `--host mock`（只统一「怎么造现场」，不改判据；本评审直接 spawn 夹具进程，不经 CLI，故不受影响） |
| 同上 | **D-13** L134-140 | WP-5 三个开放点裁决：OP-2 日志归属（确认）、OP-3 组合边界（接受现有边界、不扩范围）、OP-4 `loop-fixture` 1 条失败（判非缺陷，按 D-2 处理） |
| 同上 | D-2 L27-34 | DoR 口径：以**失败集合差集 = 0** 判定，8 条基线失败逐条比对，测试条数只增不减 |
| `docs/iterations/iteration-7/baseline-failures.txt` | 8 行 | 第 4 行 = `cursor.json 并发消费 20 次不重复`（已独立读取确认） |

### 1.3 `git show HEAD:` 对照说明

- 取改动前版本：`git show HEAD:test/fixtures/mock-acp-agent.js > /tmp/wp5-head-mock.js`，HEAD 版本 **1268 行**；工作区版本 **1310 行**；`git diff --numstat` = **+55 / -13**（`git diff --stat` 显示 68 处变更）。完整 `git diff` 见 §2.2。
- 为做「改动前 vs 改动后」**真实进程逐字对比**，把 HEAD 副本另存为 `/tmp/wp5-head-mock.mjs`：因 `/tmp` 不在仓库内、无 `package.json type:module`，且原文件两行相对 `import './code-loop-driver.mjs'` / `'./task-loop-driver.mjs'` 无法解析，故**仅**把这两行 driver import 重定向为仓库绝对路径。自检 `diff /tmp/wp5-head-mock.js /tmp/wp5-head-mock.mjs` 只有这 2 行差异，**逻辑零改动**，冒烟能正常回 `initialize` 应答。该副本只用于取证 spawn，不在仓库内，不属产品/测试代码改动。

---

## 2. 逐项独立验证记录（原始证据）

所有帧均由独立探针 `spawn(process.execPath, [MOCK, ...argv])` 得到，走 `initialize → session/new → session/prompt`，stdout 按 `\n` 切行读**原始 NDJSON 帧**；临时根用 `os.tmpdir()` 独立目录、`NODE_ENV=test`。探针共 43 项字段核对，**FAILED 0**。

### 2.1 验证 1 · D-10 载体逐字段（三种 argv 的原始帧）

**A · 无开关 `argv=[]`**（帧名序列 `agent_thought_chunk / tool_call / tool_call_update(in_progress) / tool_call_update(completed) / agent_message_chunk`）：

```json
tool_call      {"sessionUpdate":"tool_call","toolCallId":"call_mock_72429_1","title":"write","kind":"other","status":"in_progress"}
tool_call_upd  {"sessionUpdate":"tool_call_update","toolCallId":"call_mock_72429_1","status":"completed","content":[{"type":"content","content":{"type":"text","text":"Tool completed"}}]}
promptReply    {"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn"}}
stopReason=end_turn  exitCode=0  stderr=""
files={".mock/prompt-attempts-mock-sess-72429-1.json":"{\"attempts\":1}\n"}
```

- 两帧均**无** `execution` 键（实测 `A.updates.every(u=>!Object.hasOwn(u,'execution')) === true`）；`status='completed'`；`title='write'`；completed 文案逐字 `Tool completed`。

**B · `--fail-tool`**：

```json
tool_call      {"sessionUpdate":"tool_call","toolCallId":"call_mock_72430_1","title":"write","kind":"other","status":"in_progress","execution":{"command":"node out/run.js"}}
tool_call_upd  {"sessionUpdate":"tool_call_update","toolCallId":"call_mock_72430_1","status":"failed","content":[{"type":"content","content":{"type":"text","text":"Error: command exited with code 1"}}],"execution":{"exitCode":1,"keyOutputLines":3,"logRef":"host-logs/T-001.log"}}
promptReply    {"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn"}}
stopReason=end_turn  exitCode=0  stderr=""
files={".mock/prompt-attempts-mock-sess-72430-1.json":"{\"attempts\":1}\n"}
```

- `tool_call.execution.command === 'node out/run.js'`；`title` 仍 `'write'`（命令行未冒充工具名）；完成帧 `status='failed'`；完成帧 `execution` 恰为 `{exitCode:1, keyOutputLines:3, logRef:'host-logs/T-001.log'}`（值 `1` / `3` / `'host-logs/T-001.log'`）。
- D-10「四要素」合并 `tool_call.execution ∪ tool_call_update.execution` 后键恰为 `['command','exitCode','keyOutputLines','logRef']`，4 项齐全、取值与 AC-04 / 附录 A-4 逐项相等。**符合 D-10 冻结载体**（`command` 在 `tool_call`、其余三项在 `tool_call_update`）。

**C · `--fail-tool-no-refs`**：

```json
tool_call      {"sessionUpdate":"tool_call","toolCallId":"call_mock_72431_1","title":"write","kind":"other","status":"in_progress","execution":{"command":"node out/run.js"}}
tool_call_upd  {"sessionUpdate":"tool_call_update","toolCallId":"call_mock_72431_1","status":"failed","content":[{"type":"content","content":{"type":"text","text":"Error: command exited with code 1"}}],"execution":{"exitCode":1}}
```

- 完成帧 `execution` 仅 `{exitCode:1}`；`Object.hasOwn(execution,'keyOutputLines') === false`、`Object.hasOwn(execution,'logRef') === false`；两帧合并 `command`+`exitCode` 齐全且仅 `['command','exitCode']`。缺项**不得用工具名/默认值补齐**（D-10 转达 WP-7 条款），实测确未补齐。

**三者收尾**（实跑）：`stopReason` 均 `end_turn`、进程 `exitCode=0` 正常退出、`stderr` 均为空（无堆栈、未新增失败码）。

**双开关 `--fail-tool --fail-tool-no-refs`**（优先级）：完成帧 `execution` 实测为 `{exitCode:1}`，不含两缺项键 —— `--fail-tool-no-refs` 优先，符合 D-10 / D-13。

探针 43 项核对汇总（节选，全 `[OK]`）：

```
[OK] A: 所有帧无 execution 键 / completed / Tool completed
[OK] B: command=node out/run.js / title=write / status=failed / execution 恰三项 / 合并四要素
[OK] C: execution={exitCode:1} / hasOwn(keyOutputLines)=false / hasOwn(logRef)=false / command+exitCode 齐全
[OK] A/B/C: stopReason=end_turn、exitCode=0、stderr=""
[OK] E/F: --fail-tool(+-no-refs)+--write-ref 不落盘；未创建 host-logs/T-001.log
[OK] G1/G2/G3: --slow-tool / --permission=deny / --turn-delay-ms 无 execution 混入
TOTAL 43  FAILED 0
```

### 2.2 验证 2 · 回归红线（`git diff` + HEAD 逐字对比）

**（a）`git diff -- test/fixtures/mock-acp-agent.js` 完整片段**（改动前 `---` / 改动后 `+++`）：

```diff
@@ parseArgv 默认值 @@
     slowTool: null,
     writeRef: null,
+    failTool: false,
+    failToolNoRefs: false,
     promptFailures: 0,

@@ parseArgv switch @@
       case '--hold-session':
         opts.holdSession = true;
         break;
+      // I1.9/WP-5：两个默认关闭的失败工具开关（无值 flag）。
+      case '--fail-tool':        opts.failTool = true;        break;
+      case '--fail-tool-no-refs': opts.failToolNoRefs = true; break;
       default: break;

@@ MOCK_USAGE @@
   '用法（WP-7 计数）：--prompt-failures=<n> ...',
+  '用法（I1.9/WP-5 失败摘要）：--fail-tool 上报四项；--fail-tool-no-refs 只报命令与退出码（同时给出时后者优先）',

@@ handlePrompt 主 prompt 路径（非场景） @@
+  const failToolMode = opts.failTool || opts.failToolNoRefs;
   const toolName = opts.slowTool || 'write';
   ...
+  // D-10：失败工具步骤在 tool_call 帧上报 command
+  if (failToolMode) { toolCall.execution = { command: 'node out/run.js' }; }
   notifyUpdate(sessionId, toolCall);
   ...
-  // 真正落盘（若指定 write-ref）；权限被拒或取消时不会走到这里
-  writeArtifact(session);
+  if (!failToolMode) { writeArtifact(session); }

-  notifyUpdate(sessionId, { sessionUpdate:'tool_call_update', ..., status:'completed',
-      content:[{type:'content',content:{type:'text',text: opts.writeRef?'Created file':'Tool completed'}}] });
+  if (failToolMode) {
+    notifyUpdate(sessionId, { sessionUpdate:'tool_call_update', ..., status:'failed',
+        content:[{type:'content',content:{type:'text',text:'Error: command exited with code 1'}}],
+        execution: opts.failToolNoRefs ? { exitCode: 1 }
+                 : { exitCode: 1, keyOutputLines: 3, logRef: 'host-logs/T-001.log' } });
+  } else {
+    notifyUpdate(sessionId, { sessionUpdate:'tool_call_update', ..., status:'completed',
+        content:[{type:'content',content:{type:'text',text: opts.writeRef?'Created file':'Tool completed'}}] });
+  }
```

- **定性**：所有行为性新增都由 `const failToolMode = opts.failTool || opts.failToolNoRefs` 条件守卫——`toolCall.execution` 在 `if (failToolMode)` 内、`writeArtifact` 在 `if (!failToolMode)` 内、完成帧在 `if (failToolMode)/else` 内。不带开关时 `failToolMode===false`：不加 `execution`、照常 `writeArtifact`、走 `else` 发**逐字不变**的原 `completed` 帧。新增并非字面「全在一个 if 块内」，而是「条件守卫 + 原分支逐字保留」形态；这符合 D-13 OP-3「既有提前 return 分支逐字保留」与 WP-5「既有行为逐字不变」。评审以**输出逐字**为判据，不采信源码排版自述，见（b）实跑。
- `else` 分支中的 `completed` 帧对象字面量与 HEAD 版逐字相同（`status:'completed'`、`opts.writeRef ? 'Created file' : 'Tool completed'`）。

**（b）HEAD 版本 vs 工作区版本 · 真实进程逐字对比**（归一化 `pid` 与临时根路径后，对比**完整帧 JSON** + 帧名序列 + stderr + exit；14 组 argv，差异 0）：

```
[逐字一致] 默认 无开关            | 帧数 H=8 W=8  | 完整帧JSON相等=true 帧名序列相等=true stderr相等=true exit相等=true
[逐字一致] --slow-tool            | 帧数 H=8 W=8  | true true true true
[逐字一致] --write-ref            | 帧数 H=8 W=8  | true true true true
[逐字一致] --permission=deny      | 帧数 H=7 W=7  | true true true true
[逐字一致] --permission=ask       | 帧数 H=9 W=9  | true true true true
[逐字一致] --turn-delay-ms=30     | 帧数 H=8 W=8  | true true true true
[逐字一致] --noise-on-prompt      | 帧数 H=9 W=9  | true true true true
[逐字一致] --noise-at-turn-end    | 帧数 H=10 W=10| true true true true
[逐字一致] --noise-on-session-new | 帧数 H=9 W=9  | true true true true
[逐字一致] --session-missing      | 帧数 H=3 W=3  | true true true true
[逐字一致] --host-error           | 帧数 H=3 W=3  | true true true true
[逐字一致] --unknown-error        | 帧数 H=3 W=3  | true true true true
[逐字一致] --accept-delay-ms=20   | 帧数 H=8 W=8  | true true true true
[逐字一致] --prompt-failures=1    | 帧数 H=3 W=3  | true true true true
对比用例 14  差异 0
```

HEAD 默认路径逐字基线（帧名 / 键集合 / completed 文案）实测：

```
HEAD update[0] frame=agent_thought_chunk keys=["content","sessionUpdate"]                       text=-
HEAD update[1] frame=tool_call          keys=["kind","sessionUpdate","status","title","toolCallId"]  status=in_progress
HEAD update[2] frame=tool_call_update   keys=["sessionUpdate","status","toolCallId"]               status=in_progress
HEAD update[3] frame=tool_call_update   keys=["content","sessionUpdate","status","toolCallId"]      status=completed text=Tool completed
HEAD update[4] frame=agent_message_chunk keys=["content","sessionUpdate"]                        text=-
```

工作区默认路径（§2.1 A）与之上表**逐字相同**：帧名顺序、键集合、`completed` 帧文案 `Tool completed` 均一致。`--turn-delay-ms`（AC-26 依赖的 `tool_running` 窗口）分支逐字一致，AC-26 取证可构造。

**（c）场景套件路径零改动**：
- `git diff` 中 `handlePrompt` 的 `if (scenarioMode) { ...; return; }` 分支（L983-988）位于所有改动点**之前**；`runScenarioStep` / `runTaskLoopStep` / `consumeStep` / `withCursorLock` / 两个 driver 均**未出现在 diff 中**。
- 实跑 smoke `--root <tmp> --scenario product-missing`：HEAD 与工作区帧名序列均 `["agent_thought_chunk","tool_call","tool_call_update","agent_message_chunk"]`，**完整帧 JSON 归一化逐字相等=true**，exit 均 0、stderr 均空。
- D-13 OP-3 组合边界实跑：`--fail-tool --root <tmp> --scenario product-missing` 的场景路径 `execution` 键 = `false`（新开关不注入场景分支），符合 D-13「S3 验收脚手架不得把 `--fail-tool*` 与场景组合」的裁决。

**（d）两个 driver 未改**：`{ git diff --name-only; git ls-files --others --exclude-standard; } | grep -E "code-loop-driver|task-loop-driver"` 输出为空 —— 两文件均未改动、未新增。

### 2.3 验证 3 · 不落盘 / 日志引用边界（AC-05）

真实 spawn 后的临时根文件清单实测：

```
D 默认 + --write-ref out/probe.txt      files={".mock/prompt-attempts-*.json":"...","out/probe.txt":"mock write: ok\n"}   → 落盘照常，文案 Created file
E --fail-tool + --write-ref             files={".mock/prompt-attempts-*.json":"..."}                                    → 无 out/probe.txt
F --fail-tool-no-refs + --write-ref     files={".mock/prompt-attempts-*.json":"..."}                                    → 无 out/probe.txt
B --fail-tool                           files={".mock/prompt-attempts-*.json":"..."}                                    → 无 host-logs/、无 T-001.log
C --fail-tool-no-refs                   files={".mock/prompt-attempts-*.json":"..."}                                    → 无 host-logs/、无 T-001.log
```

- failTool 模式跳过 `writeArtifact`（即使带 `--write-ref` 也不写，对应 `if (!failToolMode)` 守卫）；实例目录内**无完整日志副本**、无日志正文文件（唯一落盘是 WP-7 既有的 `prompt-attempts` 计数，HEAD 版同样有，与日志正文无关）。
- `host-logs/T-001.log` 仅作为 `execution.logRef` 的**引用字符串**出现（B 帧中实测 `logRef='host-logs/T-001.log'`），夹具未创建该日志文件、未把正文写进实例目录。**符合 AC-05 / D-13 OP-2 裁决**（日志文件由 S3 脚手架在项目根预置）。

### 2.4 验证 4 · 测试质量（`test/wp9/i19-fixture.test.js`）

全文 309 行、8 个 `test()`：

| # | 用例 | 覆盖判据项 |
|---|---|---|
| 1 L161 | 默认零变化：帧序列、`execution` 全无、`completed`/`Tool completed`/`end_turn`/exit0/stderr 空 | 默认零变化、逐字回归 |
| 2 L188 | `--fail-tool`：command/title/failed/execution 四项 + 合并四要素键 | 两开关、D-10 |
| 3 L212 | `--fail-tool-no-refs`：`execution` 恰 command+exitCode、两缺项键 `hasOwn=false` | 两开关、缺项 |
| 4 L233 | 回归 `--slow-tool` | 既有开关回归 |
| 5 L245 | 回归 `--write-ref`：rawInput + 真实落盘 + `Created file` | 既有开关回归、落盘 |
| 6 L266 | 回归 `--permission=deny`：拒绝帧形状、`refusal`、无 `agent_message_chunk` | 既有开关回归 |
| 7 L282 | 失败步骤：两开关各跑一次，exit0、无堆栈、`end_turn`、`agent_message_chunk` 保留 | 正常退出 |
| 8 L295 | 双开关 `--fail-tool-no-refs` 优先 | 双开关优先级 |

- **真实 spawn + NDJSON**：`runSession` 用 `spawn(process.execPath, [MOCK, ...switches])`，`child.stdout.on('data')` 累积后按 `indexOf('\n')` 切行、`JSON.parse` 收帧（L52-92）；**不是内存桩、不经 acp-client/normalizer**，直接断言原始帧上的 `execution`（与 D-10「读取原始帧后缓存」一致）。
- **断言强度**：`assert.deepEqual` / `assert.equal` / `Object.hasOwn` / `Object.keys(...).sort()` 精确比对；未发现放宽断言（如 `includes`/`ok` 模糊匹配字段值）。
- **硬编码条数**：用例 1 硬编码的是**期望帧名序列数组**（`['agent_thought_chunk','tool_call','tool_call_update','tool_call_update','agent_message_chunk']`），属逐字回归的期望值，非「按条数放宽判定」；其余用例用 `find` / `filter(...).at(-1)` / `every` 动态取帧，未依赖固定条数。
- **固定 sleep**：`sleep()` 仅用于 `waitFor` 的 15ms 轮询间隔（8s 上限）与进程退出的 `Promise.race([done, sleep(5000)...])` 挂死兜底；断言全部基于**条件等待 + 精确比对**，无「`await sleep(N)` 后才断言」的时序脆弱写法。自动应答 `session/request_permission` 避免 `--permission=deny` 挂 60s，属合理。
- **取证真实性**：测试断言的是真实宿主进程吐出的帧字段，不是「夹具自造数据」；本评审另用独立探针 spawn 复核，帧值一致（§2.1）。**不构成取证失真**。

### 2.5 验证 5 · 门禁独立复跑（真实数字）

见 §3 数字表。此处补 `loop-fixture` 失败详情（`/tmp/wp5-gate3.log` L8-25 实读）：

```
not ok 2 - cursor.json 并发消费 20 次不重复
  location: '/Users/xuesh/www/Maestro/test/wp6/loop-fixture.test.js:148:1'
  error: |-
    file:///Users/xuesh/www/Maestro/test/fixtures/mock-acp-agent.js:258
          if (Date.now() - started > 5_000) throw new Error('cursor.lock 等待超时');
    Error: cursor.lock 等待超时
    1 !== 0
```

- 失败用例名 `cursor.json 并发消费 20 次不重复` **与 `baseline-failures.txt` 第 4 行逐字相同**；错误为 `cursor.lock 等待超时`（5s），与 D-13 OP-4「属基线第 4 行既有失败（cursor.lock 5s 超时，两次复现稳定）」一致；`withCursorLock` 函数在 HEAD 与工作区均逐字未变（不在 diff 中）。
- 按 **D-2「失败集合差集 = 0」** 判定：本批失败集合 = 基线第 4 行，差集 = 0，**非回归、不误报**。

### 2.6 验证 6 · 越界扫描（`git status --short`）

```
 M .workbuddy/memory/2026-11-09.md
 M docs/iterations/iteration-9/decisions.md
 M src/cli/render.js
 M src/core/status-text.js
 M test/fixtures/mock-acp-agent.js          ← WP-5
 M test/wp11/status-doc.test.js
?? .workbuddy/memory/2026-11-10.md
?? docs/iterations/regression-2026-11-09.md
?? docs/iterations/regression-2026-11-09/
?? test/wp9/i19-fixture.test.js             ← WP-5（新建）
?? test/wp9/i19-render.test.js
```

- **WP-5 文件集合恰为 2 个**：`test/fixtures/mock-acp-agent.js`（` M`，+55/-13）、`test/wp9/i19-fixture.test.js`（`??`）。`{ git diff --name-only; git ls-files --others --exclude-standard; } | grep -Ei "mock-acp|i19-fixture|fail-tool|fixture"` 仅命中这两个文件，**评审对象之外无 WP-5 改动混入**。
- 其余未提交改动均属题目明示的**并行 WP-6 / 主控**，非 WP-5，**不误报**：`src/cli/render.js`、`src/core/status-text.js`、`test/wp9/i19-render.test.js`、`test/wp11/status-doc.test.js`（WP-6）；`docs/iterations/iteration-9/decisions.md`（主控裁决 D-10/D-13 等）、`.workbuddy/**`、`docs/iterations/regression-2026-11-09*`（主控/环境）。

---

## 3. 门禁实跑数字表

| # | 命令 | tests | pass | fail | 其它 |
|---|---|---:|---:|---:|---|
| 1 | `node --test test/wp9/i19-fixture.test.js` | 8 | 8 | 0 | `duration_ms 7596.562`；skipped 0 |
| 2 | `node --test "test/wp9/**/*.test.js"` | 85 | 85 | 0 | `duration_ms 32319.789`；skipped 0 |
| 3 | `node --test test/wp6/loop-fixture.test.js` | 4 | 3 | **1** | `duration_ms 8436.075`；唯一失败 `cursor.json 并发消费 20 次不重复` |
| 4 | `node -p "Object.keys(require('./package.json').dependencies||{}).length"` | — | — | — | 输出 **`0`**（AC 架构检查 deps=0 成立） |

判定：门禁 1/2/4 全绿；门禁 3 的 1 条失败 = 基线第 4 行既有失败，按 **D-2 差集 = 0** 处理，不计为本批回归、不放宽断言、不改测试。门禁 2 的 85/85 说明并行 WP-6 的已落地改动亦未使 wp9 套件失败（不影响本 WP-5 结论）。

---

## 4. 阻断项清单

**本批无阻断项（F 清单为空），阻断 0 条。**

按「阻断 = 会让 AC 的 Then 无法成立 / 违反 D-10 载体 / 破坏既有逐字回归 / 取证失真」逐条排除：

| 判据 | 排除理由（证据） |
|---|---|
| AC-04 Then（四项齐全） | §2.1 B 实测四要素逐项相等，合并键恰 4 项，与 A-4 逐字一致 |
| AC-05 Then（缺项 + 无日志副本） | §2.1 C `hasOwn=false`；§2.3 实例目录无 `out/probe.txt`、无 `host-logs/`、无日志正文 |
| AC-26 / 附录 A-14（取消全未提供，依赖 `--turn-delay-ms` 既有分支） | §2.2(b) `--turn-delay-ms=30` HEAD 逐字一致；AC-26 取证路径未被改动 |
| D-10 载体冻结（分两帧、title 不冒充、failed、end_turn 不新增失败码） | §2.1 A/B/C 逐字段命中；`command` 在 `tool_call`、其余在 `tool_call_update`；`title='write'`；`stopReason=end_turn`、`exit=0`、`stderr=""` |
| 既有逐字回归（12+ 开关 / 帧序列 / 键集合 / completed 文案） | §2.2(b) 14 组 HEAD 逐字对比差异 0；§2.2(c) 场景套件逐字一致；§2.2(d) 两 driver 未改 |
| 取证失真（测试只测夹具自造数据） | §2.4 真实 spawn + NDJSON 原始帧；本评审另独立 spawn 复核，帧值一致 |
| D-2 / D-13 口径 | §2.5 差集=0；OP-2/3/4 均按裁决确认，未升格 |

---

## 5. 建议项清单（不影响判据，均不阻断）

> 依题目口径：**D-13 已裁决的 OP-2 / OP-3 / OP-4 不作为问题列出、不得升格为阻断**；本节仅为不影响任何 AC/判据的改进提示。

- **S-01（`--help` 帮助文本增量）**：`MOCK_USAGE` 新增第 6 行 WP-5 用法说明，使 `--help` 输出比 HEAD 多 1 行。实跑 `diff <(HEAD --help) <(WS --help)`：
  ```
  5a6
  > 用法（I1.9/WP-5 失败摘要）：--fail-tool 上报四项；--fail-tool-no-refs 只报命令与退出码（同时给出时后者优先）
  ```
  该增量只改帮助文本，不改任何帧 / 协议 / 退出码 / AC 判据；若后续存在 `--help` 逐字基线，需同步该行。不影响结论。
- **S-02（测试取完成帧的健壮性）**：`pickFrames` 用 `toolCallUpdates.at(-1)` 取「完成帧」，隐含「末个 `tool_call_update` 即收尾帧」假设；当前帧序列固定成立。若后续同 turn 内追加更多 `tool_call_update`（如二次权限确认），建议改为按 `status ∈ {completed, failed}` 显式过滤。不影响当前 8 用例与判据。
- **S-03（测试的时序兜底）**：`runSession` 的 `waitFor(8000)` 与 `Promise.race([done, sleep(5000)])` 为超时兜底，在极慢 CI 上可能偶发超时；断言本身基于条件轮询 + 精确比对，并非「固定 sleep 后断言」，取证有效。属环境鲁棒性改进，不影响判据。
- **S-04（可维护性）**：两开关在 `parseArgv` 为两个独立布尔，优先级靠 `opts.failToolNoRefs` 在 `handlePrompt` 判定；若未来再增变体，建议收敛为单一 `failToolMode` 枚举，避免布尔组合扩散。不影响当前行为与判据。

---

## 6. 结论

**PASS（阻断 0 / 建议 4）**

- D-10 冻结载体逐字段命中；AC-04 / AC-05 的 Given-Then 所需夹具要素齐全且缺项降级正确；AC-26 依赖的既有 `--turn-delay-ms` 分支逐字未变。
- 回归红线成立：14 组既有开关 / 默认路径 HEAD 逐字对比差异 0，场景套件逐字一致，两个 driver 未改，所有行为性新增均由 `failToolMode` 条件守卫。
- 门禁 1/2/4 全绿；门禁 3 的 1 条失败为基线第 4 行，按 D-2 差集 = 0 判定非回归。
- 越界扫描确认评审对象外无 WP-5 改动；并行 WP-6 / 主控改动按题目明示不误报。
- 未发现会让 AC 的 Then 无法成立、违反 D-10、破坏逐字回归或取证失真的阻断项；D-13 已裁决的 OP-2/3/4 未重新升格。

> 说明：本评审未取得、也未采信任何「作者自述数字」，全部数字与帧均来自独立实跑；故不存在「作者自述数字与实跑数字不一致」需特别指出之处。若作者另附自述，以本报告 §2/§3 的实跑证据为准。

---

## 7. 声明

- **未改任何产品代码 / 测试代码**：未编辑 `src/**`、`test/**` 中任何既有或新增文件；未对评审对象做任何修改。
- **未 `git commit`**：全程只读 git（`log` / `status` / `show` / `diff` / `ls-files`）与运行命令，无任何写 git 操作。
- **唯一写入为评审报告**：`docs/iterations/iteration-9/review-wp5.md`（本文件）。
- 取证用临时文件（`git show HEAD:` 导出的 HEAD 副本 `/tmp/wp5-head-mock.js` / `.mjs`、门禁日志 `/tmp/wp5-gate*.log`）均位于 `/tmp`、不在仓库内，不属产品/测试代码改动；`spawn` 临时根用 `os.tmpdir()` 且测毕即清理。
