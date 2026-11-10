# I1.9 S2 批次 1 · 实现评审（WP-1 / WP-3）

> 评审角色：独立实现评审工程师（S2 批次 1），未参与 WP-1 / WP-3 实现，只给路径与判定标准。
> 方式：只读评审 + 唯一写入本文件。不采信实现方回执与测试自述，逐条自己读源码 / `git diff` / `node --input-type=module -e` 独立注入复算 / 门禁实跑。
> 判据来源：`requirement.md` v7（§2.5 / §2.6 / 附录 A-3、A-6、A-6 附、A-10、A-11、附录 B-2/B-3/B-4、附录 D-2/D-3/D-6/D-7/D-8）、`iteration-9.md` r2（§2.1/§2.2/§2.5/§3/§4/§6/§7）、`decisions.md` D-4/D-5、`execution-template.md` §2.5/§5/§7。

---

## §0 总判

| 项 | 内容 |
|---|---|
| **总判** | **PASS** |
| **阻断** | **0 条** |
| **建议** | **2 条**（F-01 / F-02，均不判 FAIL） |
| **评审对象 commit** | WP-1 `8beb6ca`；WP-3 `42fffd1`（HEAD `7aae1a2` 为 decisions D-4/D-5 文档提交，不在实现评审对象内） |
| **复核方式** | ① 逐行读 `src/persistence/paths.js` / `src/core/trace.js` / `src/core/health.js` / 两个新增测试；② `git show --stat` + `git diff <commit>^ <commit>` 核对「只追加 / 既有函数体零改动 / 只动授权文件」；③ 读 `src/core/advance.js` / `handoff-schema.js` 核对交接包真实字段；④ `node --input-type=module -e` 注入固定 `now` 独立复算三组等值边界、用真实 `buildHandoff` 构造 `--stop-after 3` 冻结窗口 state 实跑 `deriveHandoffIds`、独立实跑 `appendSpan`/`readTraces`/`overlayRunningSpans`；⑤ 门禁四件套 + 回归目录实跑；⑥ `grep` 查中文 / `if host ==` / import、`purity-check` 查 31 禁词、查 `dependencies`。 |
| **只读合规** | 评审前后 `git status --short` 完全一致（仅 4 项预存的 `.workbuddy/memory` 与 `regression-2026-11-09*` 未跟踪/修改项，均非本评审产生）；所有临时文件落 `os.tmpdir()` 并在 finally 中 `fs.rm`，仓库内零副作用。 |

**判定口径执行**：只有阻断构成 FAIL；D-4 / D-5 已裁决口径不重新升格为阻断；「签名与冻结契约不符 / 等值边界被放宽 / `handoff_ids` 漏 `HO-002` / 既有函数体被改 / 新增第三方依赖 / 中文 / 禁词」逐项核查，均未观测到。

---

## §1 WP-1 逐条判定（`8beb6ca`：paths.js / trace.js / i19-trace.test.js）

### 1.1 `src/persistence/paths.js` —— 只追加、落点、既有函数体零改动、路径形状

| # | 判据 | 判定 | 文件:行 + 证据片段 |
|---|---|---|---|
| W1-P1 | **只追加两个函数**，无既有行改动 | **PASS** | `git diff 8beb6ca^ 8beb6ca -- src/persistence/paths.js` 单 hunk `@@ -57,6 +57,16 @@`：10 行 `+`、**0 行 `-`**；新增仅 `instanceStateDir`（`:61-63`）、`instanceTracesPath`（`:66-68`）。`git show --stat` 亦为 `10 ++`（纯新增）。 |
| W1-P2 | 落点在 `corruptPath` 之后 / `instanceWorkspaceDir` 之前 | **PASS** | `corruptPath` `:55-58`（`return path.join(instanceDir(root, id), 'state.json.corrupt');`）；新增 `:60-68`；`instanceWorkspaceDir` 注释自 `:70` 起、函数 `:74-76`。按函数名定位（§2.5 要求）成立。 |
| W1-P3 | 既有函数体（含 `statePath` / `eventsPath`）零改动 | **PASS** | diff 无 `-` 行；`statePath` `:47-49` = `path.join(instanceDir(root, id), 'state.json')`、`eventsPath` `:51-53` = `... 'events.jsonl'` 逐字未动。`i19-trace.test.js:66-70` 仅做形状断言，未改源码。 |
| W1-P4 | 路径形状 `instanceDir/state/traces.jsonl` | **PASS** | `paths.js:62` `return path.join(instanceDir(root, id), 'state');`；`paths.js:67` `return path.join(instanceStateDir(root, id), 'traces.jsonl');`。独立实跑 `appendSpan` 写出的实际文件路径为 `.../.orch/instances/INST-001/state/traces.jsonl`（§4 实跑 stdout）。 |

> 附：`paths.js:60` 注释措辞与既有布局略有出入（见 F-02，建议级，不判 FAIL）。U-9 登记的既有布局偏差按 §2.5「不改不迁移」执行，未触碰。

### 1.2 `src/core/trace.js` —— 5 导出 / 签名 / appendSpan / readTraces

| # | 判据 | 判定 | 文件:行 + 证据片段 |
|---|---|---|---|
| W1-T1 | 5 个导出齐全 | **PASS** | `newTraceId :22`、`appendSpan :33`、`readTraces :60`、`deriveHandoffIds :123`、`overlayRunningSpans :156`。 |
| W1-T2 | 签名与 §2.2 / §6 冻结契约点 3 一致 | **PASS** | `newTraceId()`；`appendSpan(root, instanceId, span)`；`readTraces(root, instanceId)`；`deriveHandoffIds(state, nodeId, round)`；`overlayRunningSpans(state, spans)`。§2.2 写 `appendSpan(root, instanceId, span)`、§6:619 写 `appendSpan(root, id, span)`——`instanceId`/`id` 仅形参命名差异，位置参数语义一致，不构成签名不符。 |
| W1-T3 | `appendSpan` 整行一次追加 | **PASS** | `trace.js:44` ``const line = `${JSON.stringify(record)}\n`;``；`:47` `await fs.appendFile(filePath, line, 'utf8');` 单次追加、无重写 / 无批量缓冲。独立实跑落盘文件恰 1 行。 |
| W1-T4 | 只落 7 字段，多余键含 `handoff_ids` 丢弃 | **PASS** | `trace.js:35-43` `record` 显式列 `trace_id / instance_id / node_id / round / start_time / end_time / status` 七键。独立实跑传入 `handoff_ids:["HO-001","HO-002"]` 与 `extra:"DROP"`，落盘 `Object.keys(obj).sort()` 恰为 7 键、`handoff_ids`/`extra` 均不存在。 |
| W1-T5 | 父目录 `mkdir -p` | **PASS** | `trace.js:46` `await fs.mkdir(path.dirname(filePath), { recursive: true });`。独立实跑在空临时根直接 `appendSpan` 成功建出 `state/` 并写入。 |
| W1-T6 | 返回形状 `{ok:true}` / `{ok:false,code}` | **PASS（按 D-4）** | `:48` `return { ok: true };`；`:50` `return { ok: false, code: APPEND_FAILED };`（`APPEND_FAILED='TRACE_APPEND_FAILED'`，`:19`）。**D-4 已裁决**：成功不含 `seq`、`seq?` 可选、WP-7 只判 `.ok`，属口径澄清非缺陷，不升格阻断。 |
| W1-T7 | `readTraces` 缺失 / 单行坏 / 全坏分别返回 `{spans,badLines}` 且不抛错 | **PASS** | `:63-67` 读失败 catch → `{ spans: [], badLines: 0 }`；`:70-83` 逐行 `JSON.parse`，坏行 `badLines += 1`、跳过；`:84` `return { spans, badLines };`。独立实跑：`missing => {"spans":[],"badLines":0}`、`1 bad => {"spans":[...1 条...],"badLines":1}`、`all bad => {"spans":[],"badLines":3}`，无异常抛出。 |

### 1.3 `deriveHandoffIds` —— 冻结窗口实跑（重点）

**判据口径**：§2.2 / §6 冻结契约点 3 / 附录 D-2（`:951-955`）——接收包 `toNodeId === node && round === r`；产出包 `fromNodeId === node` 且正向 `round === r`、回流 `round === r+1`；按 `createdAt` 升序去重；**不得只按 `round === 本轮` 过滤**，冻结窗口 3 条 `handoff_ids` 依次为 `[HO-001]` / `[HO-001, HO-002]` / `[HO-002]`（A-3 / AC-08 / §3.3）。

**字段名一致性（自己读真实结构）**：`advance.js:127-185` `buildHandoff` 返回 `handoffId`（`:158`）、`edge:{from,to,kind}`（`:152-156,159`）、`createdAt`（`:161`）、`round`（`:177`）、`fromNodeId`/`toNodeId`（`:178-179`）；`handoff-schema.js:168/173/176/183/189` 校验 `handoffId`/`fromNodeId`/`toNodeId`/`round`/`createdAt`、`EDGE_KINDS`（`:28` 含 `backflow`）、`edge.kind` 与 `edge.from/to` 相等。`trace.js` 的 `idOf :87-89`（`handoffId`）、`fromOf :91-93`（`fromNodeId ?? edge.from`）、`toOf :95-97`（`toNodeId ?? edge.to`）、`isBackflow :99-102`（`edge.kind === 'backflow'`）、`createdAtKey :104-107`（`createdAt`）与真实结构一致。**PASS**

**独立实跑**（`node --input-type=module -e`，用真实 `buildHandoff` 造 `--stop-after 3` 冻结窗口 state，不采信测试自述）：

```
HO-001 real: {"handoffId":"HO-001","fromNodeId":"T-001","toNodeId":"T-002","round":1,"createdAt":"2026-11-10T10:00:40.000Z","edgeKind":"forward"}
HO-002 real: {"handoffId":"HO-002","fromNodeId":"T-002","toNodeId":"T-001","round":2,"createdAt":"2026-11-10T10:01:30.000Z","edgeKind":"backflow"}   // state=consumed
deriveHandoffIds(state,"T-001",1) => ["HO-001"]
deriveHandoffIds(state,"T-002",1) => ["HO-001","HO-002"]
deriveHandoffIds(state,"T-001",2) => ["HO-002"]
FROZEN_WINDOW_3_SPANS_OK
```

| # | 判据 | 判定 | 证据 |
|---|---|---|---|
| W1-D1 | `deriveHandoffIds(state,'T-002',1)` 同时含 `HO-001` 与 `HO-002` | **PASS** | 实测 `["HO-001","HO-002"]`。`HO-002` 是 `round=2` 的回流包（接收方 T-001 的 r2），由 `trace.js:133-134` `produced = fromNodeId === nodeId && (isBackflow ? hr === r+1 : hr === r)` 命中；若只按 `round===r` 过滤会漏掉，实测未漏。 |
| W1-D2 | `deriveHandoffIds(state,'T-001',2)` 含 `HO-002` | **PASS** | 实测 `["HO-002"]`（接收包 `toNodeId==='T-001' && hr===2`）。 |
| W1-D3 | `deriveHandoffIds(state,'T-001',1)` 含 `HO-001` | **PASS** | 实测 `["HO-001"]`（正向产出包 `hr===r`）。 |
| W1-D4 | 三条跨度序列与 A-3 / §3.3 / D-2 冻结窗口基线一致 | **PASS** | `[HO-001]` / `[HO-001,HO-002]` / `[HO-002]`，逐字对齐。 |

> §3「示意值与逐字口径」说明（`iteration-9.md:261`）：`HO-001`/`HO-002`/`T-001`/`T-002`/时间戳均为示意值、只说明字段形状与相对顺序、不作为断言期望。本评审按**字段名、结构与相对顺序**核对，不按示意取值断言；A-0「逐字固定」项（编号递增规则、字段名与顺序）不随样例取值改变——实测序列与规则一致。

### 1.4 `overlayRunningSpans` —— 不写盘 / 不计入已完成跨度数 / running 才叠加

| # | 判据 | 判定 | 文件:行 + 证据片段 |
|---|---|---|---|
| W1-O1 | 不写盘（纯内存投影） | **PASS** | `trace.js:156-185` 全函数无 `fs.*` 调用；独立实跑 `fs.stat(instanceTracesPath(root,"INST-001"))` 仍 `reject {code:'ENOENT'}`，打印 `OVERLAY_NO_DISK_WRITE_OK`。 |
| W1-O2 | 仅 running 节点叠加 | **PASS** | `trace.js:164` `if (!node \|\| typeof node !== 'object' \|\| node.state !== 'running') continue;`；独立实跑「1 running + 1 done」→ overlay 仅 1 条；「全 done」→ 空数组。 |
| W1-O3 | 不计入已完成跨度数 | **PASS** | `trace.js:150-152` 注释明确 "not counted as landed spans"；返回独立 `result` 数组、不修改 `spans` 入参；`:167-171` `alreadyDone` 排除已有同 node+round 落地跨度的节点（实跑验证）。 |

### 1.5 零中文 / 零第三方依赖 / 零 `if host ==` / 零 31 禁词

| # | 判据 | 判定 | 证据 |
|---|---|---|---|
| W1-C1 | 零中文（注释英文） | **PASS** | `grep -P '[\x{4e00}-\x{9fff}]' src/core/trace.js src/core/health.js` → `No matches found`；`paths.js:60,65` 新增注释为英文（`/** Directory holding the per-instance state files ... */`）。`paths.js` 既有中文注释属 U-9 既有布局、非本 commit 新增。 |
| W1-C2 | 零第三方依赖 | **PASS** | `trace.js:13-17` import 仅 `node:fs/promises` / `node:path` / `node:crypto` + 本地 `../persistence/paths.js`；`package.json` 无 `dependencies`（§4 实测长度 `0`）。 |
| W1-C3 | 零 `if host ==` / `switch(host)` | **PASS** | `grep -nE 'if host ==\|host\s*==\|switch\s*\(\s*host'` 三个源码文件 → `No matches found`。 |
| W1-C4 | 零 31 禁词 | **PASS** | §4 `purity-check.mjs --dirs src/core,src/daemon --forbid <D-6 31 词全表>` → `OK: 扫描 24 个文件 … 零命中` / exit 0。 |

---

## §2 WP-3 逐条判定（`42fffd1`：health.js / health.test.js）

### 2.1 签名 / 纯函数 / 四档 / 8 原因码固定顺序

| # | 判据 | 判定 | 文件:行 + 证据片段 |
|---|---|---|---|
| W3-S1 | `computeHealth({state,graph,traces,now})` 逐字符合 §2.1 / 附录 D-3 / §6 冻结契约点 2 | **PASS** | `health.js:111` `export function computeHealth({ state, graph = null, traces = [], now = Date.now() } = {})`，返回 `{ level, reasons }`（`:109`）。与 §2.1:144、D-3:963「纯函数、不读盘、不取系统时间、`now` 可注入缺省 `Date.now()`」、§6:618 冻结签名逐字一致。 |
| W3-S2 | 纯函数：不读盘 / 函数体不取系统时间 / 不改入参 | **PASS** | `health.js` 全文 **零 `import`**；函数体 `:112-201` 无 `fs`、无 `Date.now()`（`Date.now()` 仅出现在默认参数表达式，属冻结签名本身）、无任何对 `state`/`graph`/`traces` 的赋值，`:112` `void graph;` 显式声明本迭代不读。**独立注入复算反证**：固定 `now=1700000000000` 得到精确边界结果（见 §2.4），若函数体读真实系统时间则所有 `startedAt`（相对 NOW 构造）会全部命中红档，实测未发生。 |
| W3-S3 | 四档 `normal/slow/attention/ended` | **PASS** | `health.js:15-18` 四个具名导出 + `:31` `HEALTH_LEVELS = Object.freeze([normal, slow, attention, ended])`（`Object.freeze` 额外导出，不违反契约）。 |
| W3-S4 | 8 原因码**固定顺序**导出 | **PASS** | `:21-28` 八码；`:32-41` `HEALTH_REASONS = Object.freeze([pending_escalation, node_timeout, session_crash, role_unavailable, connection_rejected, connection_expired, p90_exceeded, handoff_ttl_half])`，顺序与 D-3:968 / A-6 附:676 一致。独立实跑 6 红条件同命中，`reasons` 恰按此顺序输出。 |

### 2.2 终态优先 / 红档 6 条件（B-4 口径）/ 严格大于

| # | 判据 | 判定 | 文件:行 + 证据片段 |
|---|---|---|---|
| W3-R0 | 终态优先直接 `ended` | **PASS** | `:51` `TERMINAL_INSTANCE = new Set(['completed','failed','cancelled','interrupted'])`；`:115-117` `if (TERMINAL_INSTANCE.has(state?.state)) return { level: ended, reasons: [] };` 置于红黄之前。独立实跑 `completed` + 超时节点 + 升级 → `ended []`。 |
| W3-R1~R6 | 红档 6 条件与 B-4 一致 | **PASS** | `:129-131` `escalations[].state==='pending'` → `pending_escalation`；`:133-139` running 节点超时 → `node_timeout`；`:145-152` `session_crash`；`:157-159` `role_unavailable`；`:161-163` `connection_rejected`；`:164-166` `connection_expired`。 |
| W3-R3a | 「会话崩溃」按 `quarantined` + 绑定节点 `failed`/`escalated` 近似 | **PASS** | `:52` `CRASH_BOUND_NODE = new Set(['failed','escalated'])`；`:145-150` `if (!s \|\| s.quarantined !== true) return false; const node = ... byId.get(s.nodeId); if (node === undefined) return true; return CRASH_BOUND_NODE.has(node.state);`。与 B-4:840「会话被隔离且其节点未成功」一致。 |
| W3-R3b | 隔离会话不双计「角色不可用」 | **PASS** | `:157` `sessions.some((s) => s?.state === 'escalated' && s.quarantined !== true)`。独立实跑 quarantined+escalated 会话仅产出 `session_crash`。 |
| W3-R3c | 不调用 `buildRoleInstances` | **PASS** | `health.js` 零 import、无 registry 引用；角色由 `state.nodes`/`state.sessions` 直接投影（D-3:963 / v7 F-10）。 |
| W3-R3d | 脏数据兜底 / 红档不并列黄码 | **PASS（按 D-5）** | 绑定节点不可解析时 `return true`（`:148`）为脏数据兜底；`:170-172` `if (red.length > 0) return { level: attention, reasons: red };` 红档短路不并列黄码。**D-5 已裁决**为已登记口径（B-4「近似」自定、AC-13/AC-23 不构造该形态），不升格阻断、不要求放宽。 |
| W3-R7 | 🔴 严格大于 `nodeTimeoutMs`（缺省 30000，可覆盖） | **PASS** | `:48` `DEFAULT_NODE_TIMEOUT_MS = 30000`；`:69-74` `nodeTimeoutMsOf` 读 `state.health.nodeTimeoutMs`（`typeof number && finite && >= 0` 才用，否则回退 30000）；`:136` `return start !== null && now - start > nodeTimeoutMs; // strictly greater`。独立实跑 300000 覆盖使 70s 节点不抢红档。 |

### 2.3 黄档 🟡 仅在无红档时评估 / P90 / TTL

| # | 判据 | 判定 | 文件:行 + 证据片段 |
|---|---|---|---|
| W3-Y0 | 🟡 仅在无红档时评估 | **PASS** | `:168-172` 红档先 `return`，`:174` 起才是 yellow。独立实跑「升级 + P70 + TTL 均满足」→ `reasons` 仅 `["pending_escalation"]`，无 `p90_exceeded`/`handoff_ttl_half`。 |
| W3-Y1 | P90 样本来自 `traces` 已完成跨度 | **PASS** | `:77-83` `spanDuration` 跳过 `status==='running'`、缺 `start_time`/`end_time`、`end < start`；`:86-91` 逐跨度取时长。 |
| W3-Y2 | 升序第 `⌈0.9×N⌉`、`N<5` 不触发、严格大于 | **PASS** | `:49` `MIN_P90_SAMPLES = 5`；`:92` `if (durations.length < MIN_P90_SAMPLES) return null;`；`:93-95` `durations.sort((a,b)=>a-b)`、`const rank = Math.ceil(0.9 * durations.length); return durations[rank - 1];`；`:180` `now - start > p90; // strictly greater`。 |
| W3-Y3 | TTL `pending` 严格大于 900000ms、无起算时间不参与 | **PASS** | `:50` `TTL_HALF_MS = 900000`；`:187-195` `h?.state !== 'pending'` 跳过、`pendingAt` 优先 `createdAt`（`:189-191`）、`base === null` 不参与、`:192` `now - base > TTL_HALF_MS`。符合 B-3:828-830 / BR-20。 |

### 2.4 三组等值边界的**独立注入复算**结论（不采信测试自述）

> 方法：`node --input-type=module -e` 直接 `import { computeHealth } from './src/core/health.js'`，固定 `NOW = 1700000000000`，自造 state/traces，逐点打印 `{level, reasons}` 并 `assert`。**未调用 `health.test.js` 的任何辅助函数，未采信其断言**。输出末行 `ALL_INDEPENDENT_ASSERTIONS_PASS`。

| 组 | 注入点 | 独立复算实测 | 期望（AC-13/14/15、D-8、BR-11/12/20） | 判定 |
|---|---|---|---|---|
| A 节点超时 | `now - startedAt = 30000` | `normal []` | 不命中 | **PASS** |
| A 节点超时 | `now - startedAt = 30001` | `attention ["node_timeout"]` | 命中 | **PASS** |
| B P90 | 5 样本 `[10,20,30,40,50]s`（P90=50000），时长 `50000` | `normal []` | 不命中 | **PASS** |
| B P90 | 时长 `50001` | `slow ["p90_exceeded"]` | 命中 | **PASS** |
| B P90 | 4 样本（`<5`），时长 `70000` | `normal []` | 不触发 | **PASS** |
| C TTL | `now - pendingAt = 900000` | `normal []` | 不命中 | **PASS** |
| C TTL | `now - pendingAt = 900001` | `slow ["handoff_ttl_half"]` | 命中 | **PASS** |
| C TTL | `now - pendingAt = 899999` | `normal []` | 不命中 | **PASS** |
| 附加 | 终态 + 超时节点 + 升级 | `ended []` | 终态优先 | **PASS** |
| 附加 | 红 + 两黄同满足 | `attention ["pending_escalation"]` | 红短路、无并列黄码 | **PASS** |
| 附加 | 6 红条件同命中 | `attention` 且 `reasons` 为 8 码前 6 个固定顺序 | 固定顺序 | **PASS** |

**结论**：三组边界均为「严格大于」，等值点不命中、`+1ms` 命中、样本 `<5` 不触发，**判据无任何放宽**；`now` 注入有效反证函数体不取系统时间。

### 2.5 零中文 / 零第三方依赖 / 零 31 禁词

| # | 判据 | 判定 | 证据 |
|---|---|---|---|
| W3-C1 | 零中文 | **PASS** | `grep -P '[\x{4e00}-\x{9fff}]' src/core/health.js` → `No matches found`；全文件英文注释（`:1-12` 明确 "All comments are English by contract"）。 |
| W3-C2 | 零 `import` 之外的第三方依赖 | **PASS** | `health.js` **零 `import` 语句**，纯常量与纯函数；`package.json` 依赖数 `0`。 |
| W3-C3 | 零 31 禁词 | **PASS** | §4 purity-check 扫 `src/core,src/daemon`（含 `health.js`）→ exit 0 零命中。 |

---

## §3 契约一致性 / 跨 WP 影响（D-4 / D-5 是否生效、下游 WP-6/7/8 能否按冻结签名调用）

| 项 | 判定 | 说明 |
|---|---|---|
| D-4 已生效 | **PASS** | `appendSpan` 返回 `{ok:true}`（成功不含 `seq`）/ `{ok:false, code:'TRACE_APPEND_FAILED'}`，`seq?` 可选。按裁决「以实现为准、不改文档不改代码、WP-7 只判 `.ok`」执行；评审不把它重新判为阻断。 |
| D-5 已生效 | **PASS** | `session_crash` 脏数据兜底（绑定节点不可解析按 `quarantined` 命中）、红档短路只返回红码不并列黄码，均保持实现。按裁决「已登记口径而非缺陷、不采纳放宽建议」执行；评审不把它重新判为阻断。D-5 登记的「真实运行 `quarantined` 多为 `idle` 导致漏报」边界按裁决留待 `report.md` §5 登记，本评审不要求放宽。 |
| 冻结签名一致性（§6 契约点 2/3/5） | **PASS** | `computeHealth({state,graph,traces,now}) → {level,reasons}`（点 2）；`newTraceId`/`appendSpan(root,id,span)` 7 字段/`readTraces(root,id) → {spans,badLines}`/`deriveHandoffIds(state,nodeId,round)`/`overlayRunningSpans`（点 3）；`instanceStateDir`/`instanceTracesPath` 与 `instanceDir/state/traces.jsonl`（点 5 / §2.5）。逐字/逐位置核对无偏差。 |
| 下游 WP-6（render.js / status-text.js）可调用 | **PASS** | 消费 7 字段跨度、`deriveHandoffIds(state,nodeId,round)` 输出编号数组、`overlayRunningSpans(state,spans)` 内存进行中条目、`computeHealth` 四档 + 8 原因码 `HEALTH_REASONS` 固定顺序 + `HEALTH_LEVELS`；中文只经 `labels.js`（WP-4）。签名与返回结构已冻结。 |
| 下游 WP-7（orchestrator.js）可调用 | **PASS** | 调 `trace.appendSpan(root,id,span)`（只判 `.ok`，D-4）、`computeHealth({state,graph,traces,now})` 后写回 `state.health`（保留 `nodeTimeoutMs`）。本批不含 orchestrator 改动，符合「签名先冻结 → WP-7 才可开发」的顺序约束。 |
| 下游 WP-8（daemon/server.js）可调用 | **PASS** | `trace.readTraces(root,id)` 返回 `{spans,badLines}` 供 A-11 跳过行提示，`overlayRunningSpans` 供进行中叠加；只读、不写盘。 |

> 跨 WP 注意（非阻断，见 §6 批次 2 提示）：`deriveHandoffIds` 是**读取时**从 `state.handoffs` 推导，冻结窗口 `HO-002` 由 `advance()` 在 T-002 收尾之后创建（D-2:950/955）。WP-7 的跨度写入时机、WP-8 读取时拿到的快照是否含 `HO-002`，属批次 2 集成检查点，不在本批实现范围内。

---

## §4 门禁实跑记录（命令 + 真实数字 / exit）

| # | 命令 | 真实数字 / exit |
|---|---|---|
| G1 | `node --test test/wp9/i19-trace.test.js` | `# tests 6 / # pass 6 / # fail 0 / # skipped 0` — **exit 0** |
| G2 | `node --test test/wp12/health.test.js` | `# tests 32 / # pass 32 / # fail 0 / # skipped 0` — **exit 0** |
| G3 | `node --test "test/wp9/**/*.test.js"`（防既有回归） | `# tests 28 / # pass 28 / # fail 0 / # skipped 0` — **exit 0** |
| G4 | `node --test "test/wp12/**/*.test.js"`（防既有回归） | `# tests 190 / # pass 190 / # fail 0 / # skipped 0` — **exit 0** |
| G5 | `FORBID="<D-6 31 词全表>"; node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | `OK: 扫描 24 个文件，src/core, src/daemon 内 <31 词> 零命中` — **exit 0**（`purity_exit=0`） |
| G6 | `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies\|\|{}).length)"` | `0` |
| G7 | `git show --stat 8beb6ca 42fffd1` | `8beb6ca`：`src/core/trace.js 185+`、`src/persistence/paths.js 10+`、`test/wp9/i19-trace.test.js 221+`（416 insertions，全 `+` 无 `-`）；`42fffd1`：`src/core/health.js 202+`、`test/wp12/health.test.js 438+`（640 insertions，全 `+` 无 `-`）。**只动授权文件，无越界文件** |
| G8 | `git diff 8beb6ca^ 8beb6ca -- src/persistence/paths.js` | 单 hunk `@@ -57,6 +57,16 @@`，10 `+` / 0 `-`，既有函数体零改动 |
| G9 | 独立注入复算（`node --input-type=module -e`） | 三组边界 8 点 + 终态优先 / 红短路 / 6 码顺序共 11 条断言，末行 `ALL_INDEPENDENT_ASSERTIONS_PASS` — **exit 0** |
| G10 | 冻结窗口实跑（真实 `buildHandoff`） | `FROZEN_WINDOW_3_SPANS_OK`；`appendSpan`/`readTraces`/`overlay` 独立实跑 `ALL_TRACE_TOLERANCE_ASSERTIONS_PASS` — **exit 0** |
| G11 | `git status --short`（副作用核查） | 评审前后一致，仅 4 项预存未跟踪/修改（`.workbuddy/memory/2026-11-09.md`、`2026-11-10.md`、`regression-2026-11-09.md`、`regression-2026-11-09/`），**本评审零仓库内副作用** |

> G5 的 `FORBID` 逐字取自 `requirement.md` 附录 D-6:995-999（与 `iteration-9.md:636` 一致）：`task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check`（31 词）。

---

## §5 本轮修复清单

**阻断 0 条** —— 按判定口径，只有阻断构成 FAIL，故本批不判 FAIL。以下 2 条为建议，逐条列出但不判 FAIL。

| 编号 | 位置 | 原文 / 观察 | 违反依据 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| **F-01** | `src/core/trace.js:173-182` | `overlayRunningSpans` 返回条目除 7 字段外附加 `running: true`（`:181`）；独立实跑输出 `[{"trace_id":...,"instance_id":...,"node_id":"T-001","round":1,"start_time":...,"end_time":null,"status":"running","running":true}]` | §2.2 / 附录 D-2 的 7 字段契约针对**落盘跨度**，overlay 为内存投影，附加键**不违反**契约；仅提示下游别按「7 字段硬编码」取键 | WP-6 渲染按 `end_time === null` / `status === 'running'` 判进行中，不依赖 `running` 键；WP-1 侧可不改（改动会触碰新增函数、无必要） | **建议** |
| **F-02** | `src/persistence/paths.js:60` | 新函数注释 `/** Directory holding the per-instance state files (\`<instanceDir>/state\`). */`，但既有 `state.json` / `events.jsonl` 由 `statePath`(`:47-49`) / `eventsPath`(`:51-53`) 落在 `instanceDir` **根**；`state/` 子目录本迭代只承载 `traces.jsonl` | 措辞与 U-9 登记的既有布局（§2.5「不改不迁移」）略有出入，属**注释可读性**，非契约违反 | WP-9 收口时在文档澄清「`state/` 子目录承载 `traces.jsonl`，`state.json`/`events.jsonl` 保持原位」；**不改代码**（避免触碰「既有函数体一行不动」红线） | **建议** |

> 已由 D-4 / D-5 裁决的口径（成功不含 `seq`、`session_crash` 脏数据兜底、红档不并列黄码）按裁决**不列入修复清单、不升格为阻断**。

---

## §6 结论

**批次 1（WP-1 + WP-3）可视为 PASS，准出批次 2。**

四项成立性逐条确认：

1. **签名冻结一致 —— 成立**。`computeHealth` 与 §2.1 / D-3 / §6 契约点 2 逐字一致；`trace.js` 5 签名、`paths.js` 2 路径工厂与 §2.2 / §2.5 / §6 契约点 3、5 一致；`handoff_ids` 不落盘、按 `fromNodeId`/`toNodeId` + `round`/`round+1` 读取时推导。
2. **判据无放宽 —— 成立**。三组等值边界（30000/30001、50000/50001/样本<5、900000/900001/899999）独立注入复算全部「严格大于、等值不命中」；`deriveHandoffIds` 冻结窗口实测 `[HO-001]` / `[HO-001,HO-002]` / `[HO-002]`，`HO-002` 未漏；终态优先、红档短路不并列黄码、8 码固定顺序均实测成立。
3. **门禁全绿 —— 成立**。4 组 `node --test` 全 `fail 0 / exit 0`（6 / 32 / 28 / 190 全通过）；31 词 purity-check 扫 24 文件 exit 0；`dependencies` = 0；两组 commit 纯新增、只动授权文件；`paths.js` 既有函数体零改动。
4. **只动授权文件 —— 成立**。`8beb6ca` 仅 `trace.js` / `paths.js` / `i19-trace.test.js`；`42fffd1` 仅 `health.js` / `health.test.js`；与 §4 WP-1（3 文件）/ WP-3（2 文件）负责文件清单逐一对齐，零文件交集、零越界。

**批次 2 最可能踩到的 2 个点**（提示，非本批缺陷）：
1. **WP-7 跨度写入时机与冻结窗口**：必须在节点本轮收尾、**早于** `maybeStopAfter`(`:3141`) 与 `advance()`(`:3157`) 调 `trace.appendSpan`，否则 `--stop-after 3` 冻结窗口只剩 2 条而非 3 条（A-3 / AC-08 逐字基线不成立，风险表 #1、D-2:950 明令禁止「先 `advance()` 再写跨度」）；且 `HO-002` 由 `advance()` 在 T-002 收尾之后创建，WP-7/WP-8 集成须确认 `deriveHandoffIds` 读取的是含 `HO-002` 的收尾后快照。
2. **WP-6 渲染层对齐 7 字段 / 8 原因码 / 进行中不计入 N**：`overlayRunningSpans` 返回条目带 `running:true` / `end_time:null`（F-01），「跨度 N 条」只统计已落地跨度、进行中行叠加在末尾且不计入 N（A-10 / D-2:959）；健康度多原因必须按 D-3:968 固定顺序用 ` · ` 并列，中文文案只来自 `labels.js`（WP-4），核心/渲染侧不得硬编码中文或 31 禁词。
