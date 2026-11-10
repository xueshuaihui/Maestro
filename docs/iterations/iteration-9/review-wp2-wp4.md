# I1.9 S2 批次 2 独立实现评审（WP-2 / WP-4）

> **独立评审声明**：本评审未参与 WP-2 / WP-4 实现，只给路径与判定标准，不提供实现方回执与自述；不采信测试自述，关键行为全部自己实跑。
> **唯一写入文件**：本文件。评审期间未修改任何仓库文件（跑测试前后 `git status --porcelain` 完全一致，见 §4）。临时实跑脚本均落在 `os.tmpdir()`，不在仓库内。
> **判据不放宽**：`decisions.md` 的 D-6 / D-7 / D-8 / D-9 为主控已裁决事项，本评审按其结论执行，不重新升格为阻断。

---

## §0 总判

| 项 | 结论 |
|---|---|
| **总判** | **PASS** |
| **阻断** | **0** |
| **建议** | **3**（F-01 / F-02 / F-03，均不判 FAIL） |
| 评审对象 commit | WP-2 `36f3be3`（`src/core/event-bus.js`、`src/persistence/instance-store.js`、新增 `test/wp9/i19-chain.test.js`）；WP-4 `cdb8fc6`（`src/cli/labels.js` 末尾追加 90 行、新增 `test/wp9/i19-labels.test.js`） |
| 判据来源 | `requirement.md` v7：§2.2.1、BR-01/02/03/22/25、AC-01/02/03/19/21/23/24/25、附录 A-0~A-14（重点 A-4 / A-6 / A-6 附 8 句 / A-8 / A-11 / A-12 / A-13 / A-14）、A-9 文案键与归属、D-1（规范化序列化 / 同一次尾读 / 旧记录兼容 / 末行截断 / 整份不可解析）、D-5、D-7 授权行段、D-8、D-9、D-11；`iteration-9.md` r2：§2.3 / §2.4 / §2.8、§4 WP-2 / WP-4、§6 契约先冻结点 ①④；`decisions.md` D-6~D-9；`execution-template.md` §2.5 门禁四件套 / §5 全流程硬约束 / §7 红线 |
| 复核方式 | ① `git show` 逐行看 diff + `-` 行统计 + 既有行逐字对比（`cdb8fc6^` 前 793 行 vs 当前）；② 自写 canonicalize（`JSON.stringify` replacer 递归按键名排序）独立复算 SHA-256，真实 `createStore` + `os.tmpdir()` 临时根连发 3 条；③ 从 `requirement.md` 按行号取 A 基线原文，脚本填充 WP-4 模板逐字比对（含行首空格数、` · ` / `→` / `—` 码点）；④ 定向门禁实跑；⑤ **未跑全量测试**（§4 说明） |

**观测不到的路径声明**：未做真机宿主 / 全量 e2e（AC-04/08/26 的 driver 全链路），按硬约束不跑全量；WP-2/WP-4 均为叶子包（纯持久化 + 纯常量表），其判据可由单元级实跑与静态 diff 完整覆盖。D-6~D-9 已裁决的命名 / 形态差异按裁决接受，未再作阻断判定。

---

## §1 WP-2 逐条判定（`36f3be3`）

### 1.1 `src/persistence/instance-store.js`

| # | 判据 | 判定 | 证据（文件:行 / 实跑） |
|---|---|---|---|
| 1 | **只新增** `readTailForChain` + `canonicalize` / `hashRecord` / `ZERO_HASH` | PASS | diff 3 个 hunk：`instance-store.js:11` 新增 `import { createHash } from 'node:crypto'`（Node 内置模块，零第三方依赖）、`:45-66` 新增 `ZERO_HASH`/`canonicalize`/`hashRecord`、`:425-462` 新增 `readTailForChain` 与导出列表。§4 统计：本文件 `-` 行**仅 1 行**（`:462` 的 `return { … }` 导出列表，追加 `readTailForChain`），无其它既有行被删改 |
| 2 | `appendEvent` / `doAppend` / `nextSeq` / `readEvents` **函数体零改动** | PASS | `instance-store.js:284-303`（appendEvent）、`:305-315`（doAppend）、`:317-340`（readEvents）、`:404-423`（nextSeq）在 diff 中零出现；`git show` 的 `-` 行统计仅导出列表 1 行。整行追加 `fs.appendFile(file, JSON.stringify(ev)+'\n')`、`nextSeq` 末行坏则前溯、`readEvents` 的 `{ ok, events, badLines }` 计数口径均原样 |
| 3 | `readTailForChain` **同一次 `readFileSync`** 同时算 `seq` 与 `prevHash`（禁止两次读） | PASS | `instance-store.js:433-460`：仅 `:436` 一次 `fsSync.readFileSync`，`seq`（`:456` 的 `ev.seq + 1`）与 `prevHash`（`:456` 的 `hashRecord(ev)`）同出 `lines` 数组。**独立实跑**：monkey-patch `node:fs.readFileSync` 计数，单次 `readTailForChain` 触发 **1 次**、单次 `emit` 触发 **1 次**（见 §1.4 ⑥） |
| 4 | 规范化序列化递归按键名排序、对**解析后的完整记录**哈希（不是原始行字节） | PASS | `instance-store.js:53-62`：`Object.keys(value).sort()` 递归、数组 `map` 递归；`:64-65` `createHash('sha256').update(canonicalize(record),'utf8').digest('hex')`。**独立实跑 ②**：预置字段顺序打乱的记录，原始行字节 SHA-256 = `875a9ab8…`、规范化 SHA-256 = `0f0b653e…`（两者不同，算法可区分）；`readTailForChain.prevHash` 与新记录 `prev_event_hash` 均等于规范化哈希、均不等于原始字节哈希 |
| 5 | 整份不可解析 `corruptAll=true, seq=1, prevHash=64 个 0` | PASS | `instance-store.js:459` `corruptAll: sawLine`（有非空行但无可解析记录时为 true）。**独立实跑 ④**：3 行全乱码 → `{ seq:1, prevHash:"0000…0000"(64), corruptAll:true }`；`emit` 首条 `seq=1`、`prev_event_hash=64 个 0`；旧 3 行字节原样、新行追加在末尾；`readEvents.badLines=3` |
| 6 | 末行截断前溯 | PASS | `instance-store.js:444-457` 从末行倒序遍历，跳过空行 / `JSON.parse` 失败行 / 无整数 `seq` 行，命中即返回 `seq+1` 与该行规范化哈希。**独立实跑 ③**：2 合法 + 1 截断半行 → `seq=3`（接续第 2 条，不回 1）、`prevHash` = 第 2 条完整 record 规范化哈希、`corruptAll=false`；`emit` 返回 `seq=3`，新记录 `prev_event_hash` 指向第 2 条 |
| 7 | 旧行不回填 / 不改写 / 不改名 | PASS | `readTailForChain` 纯读；**独立实跑 ②③**：旧行字节逐字不变，`after.startsWith(original)` 为 true；`emit` 只经既有 `appendEvent` 追加到文件末尾 |
| 8 | 不新增第二条序号来源 | PASS | `emit` 在有 `readTailForChain` 时**只**调它，不再调 `nextSeq`；`readTailForChain` 沿用 `nextSeq` 的「末行坏则前溯」口径（`ev.seq+1`）；降级路径才调 `nextSeq`。同一时刻只有一个序号来源生效 |

补充说明（观测到的语义，非缺陷）：文件缺失 / 读失败 / 空文件时 `readTailForChain` 返回 `{ seq:1, prevHash:ZERO_HASH, corruptAll:false }`（`:439`）——因为没有坏行，`corruptAll=false` 合理；`seq`/`prevHash` 仍满足重起链。判据要求的「整份不可解析」形态（有行、全不可解析）已由 ④ 验证为 `true`。

### 1.2 `src/core/event-bus.js`

| # | 判据 | 判定 | 证据（文件:行 / 实跑） |
|---|---|---|---|
| 9 | `emit` 把 `prev_event_hash` 加进 `record`、首条 64 个 `0` | PASS | `event-bus.js:111` `const record = { ...rest, seq, ts, prev_event_hash: prevHash }`；首条由 `readTailForChain` 空文件返回 `ZERO_HASH`（`:13` `'0'.repeat(64)`）。**独立实跑 ①**：首条 `prev_event_hash` = 64 个 `0` |
| 10 | **「先落盘再广播」顺序未变** | PASS | `event-bus.js:113-120`：`// 3) 先落盘` → `store.appendEvent` → 失败返回 `STORE_WRITE_FAILED` 不广播 → `// 4) 只有落盘成功才广播` → `broadcast`。diff 中这两行未动 |
| 11 | `instanceId` 路由语义未变 | PASS | `event-bus.js:88` 解构 `instanceId` 只作路由键（不落盘、不广播）；`:51` `broadcast` 按 `entry.instanceId` 过滤。diff 零改动 |
| 12 | `subscribe` 未变 | PASS | `event-bus.js:38-47` diff 零改动 |
| 13 | 单实例串行队列未变 | PASS | `event-bus.js:60-69` `enqueue` + `:93` `return enqueue(instanceId, async () => …)` diff 零改动；`readTailForChain` 在队列内执行（D-1「单实例仍在事件总线的串行队列内」） |
| 14 | `emit` 返回 `{ok:true,seq,ts}` 未变 | PASS | `event-bus.js:121` `return { ok: true, seq, ts }`，未附带 `prevHash` 等字段。**独立实跑 ①**：3 次 emit 均返回 `{"ok":true,"seq":N,"ts":"…"}` |
| 15 | mock store 缺 `readTailForChain` 时降级不抛错 | PASS | `event-bus.js:101-108`：`typeof store.readTailForChain === 'function'` 判断，否则 `nextSeq` + `ZERO_HASH`。**独立实跑 ⑤**：无该方法的 mock store 下 `emit` 未抛错，返回结构正常，首条 `prev_event_hash` = 64 个 `0` |
| 16 | `replay` 按 **D-6** 返回数组 + **非枚举** `badLines` | PASS | `event-bus.js:142-149`：`const events = read.events; Object.defineProperty(events,'badLines',{value:read.badLines, enumerable:false, …}); return events;`。**独立实跑 ①**：`Array.isArray(replay)===true`、`length=3`、`badLines` 不在 `Object.keys`、`JSON.stringify(replay)` 不含 `badLines`。既有回归 `test/wp1/event-bus.test.js` **7/7** 绿（§4），数组形状未破坏 |
| 17 | 坏行数与 `readEvents` 同源 | PASS | `value: read.badLines` 直接取 `readEvents` 返回值，不另算。**独立实跑 ③④**：`replay.badLines === readEvents.badLines`（1 / 3 两种形态均成立） |

### 1.3 只动授权文件 / 授权行段

- `git show --stat 36f3be3`：`src/core/event-bus.js`(36 ++++-)、`src/persistence/instance-store.js`(63 +++++++-)、`test/wp9/i19-chain.test.js`(300 +)；3 files / 394 insertions / 5 deletions。三个文件均在 D-7 授权清单与 §2.14 测试归属内。
- `36f3be3` 的 `-` 行共 5 行：`event-bus.js` 4 行（emit 内序号获取注释+调用、record 构造、replay 的 `return read.events`）、`instance-store.js` 1 行（导出列表）。前 4 行全部落在 D-7 授权的 `event-bus.js:90-105`（emit 内附加 `prev_event_hash`）与 `:110-122`（replay 透出 `badLines`）段内，属「只改哪一段」的授权改动；未触碰「先落盘再广播」/ 路由 / `subscribe` / 串行队列 / 返回结构。

### 1.4 独立实跑记录（自己实现 canonicalize，不调用产品函数）

复算实现：自写 `myCanonical(v)`（用 `JSON.stringify` 的 replacer 对每层对象 `Object.keys().sort()` 重排）+ `crypto.createHash('sha256')`，与产品 `canonicalize`/`hashRecord` 逻辑独立。

```
① 真实 createStore（os.tmpdir() 临时根）连发 3 条 —— 3 条链复算：
   emit#1 {"ok":true,"seq":1,"ts":"2026-11-10T19:16:09.435Z"}
   emit#2 {"ok":true,"seq":2,"ts":"2026-11-10T19:16:09.485Z"}
   emit#3 {"ok":true,"seq":3,"ts":"2026-11-10T19:16:09.528Z"}
   首条 prev_event_hash == 64 个 0 : PASS
   第2条 prev_event_hash == 第1条完整 record 规范化 SHA-256 : PASS (6a9fa79840607939…)
   第3条 prev_event_hash == 第2条完整 record 规范化 SHA-256 : PASS (8c0fcbf1ad3ba03c…)
   replay 是数组 / length=3 / badLines 非枚举 / JSON 序列化不含 badLines : 全 PASS

② 原始行字节 vs 解析后规范化哈希：
   原始行字节 SHA-256=875a9ab8… / 规范化 SHA-256=0f0b653e…（不同）: PASS
   prevHash == 规范化哈希、!= 原始字节哈希；新记录同；旧行字节未变 : 全 PASS

③ 预置「2 合法 + 1 截断」（坏行单独占一行、带尾随换行）：
   readTailForChain → seq=3、prevHash=第2条规范化哈希、corruptAll=false : 全 PASS
   emit 返回 seq=3；新记录 prev_event_hash 指向第2条；旧 3 行字节原样 : 全 PASS
   readEvents.badLines=1；replay.badLines=1（同源）: 全 PASS

④ 预置「3 行全乱码」：
   readTailForChain → {seq:1, prevHash:64 个 0, corruptAll:true} : 全 PASS
   emit 返回 seq=1；新链首条 prev_event_hash=64 个 0；旧 3 行原样且新行追加末尾 : 全 PASS
   readEvents.badLines=3；replay.badLines=3（同源）: 全 PASS

⑤ mock store 缺 readTailForChain：emit 未抛错 : PASS
⑥ monkey-patch readFileSync 计数：单次 readTailForChain=1 次、单次 emit=1 次 : PASS（同一次尾读）
⑦ 观察（非 WP-2 缺陷，见 F-02）：末行半行「无尾随换行」时，既有 doAppend 整行追加不补前置换行，
   新记录与半行拼成同一行 → readEvents events=0 / badLines=1。i19-chain.test.js 的 seedLines
   用 join('\n')+'\n' 已规避该坑。
```

**WP-2 小结**：判据清单 17 条全部 PASS，阻断 0。

---

## §2 WP-4 逐条判定（`cdb8fc6`）

### 2.1 结构判据

| # | 判据 | 判定 | 证据 |
|---|---|---|---|
| 1 | **只在文件末尾追加**（单 hunk） | PASS | `git show cdb8fc6 -- src/cli/labels.js | grep -c '^@@'` = **1**；hunk 头 `@@ -790,3 +790,93 @@`。`cdb8fc6^` 版本 793 行与当前文件前 793 行**逐字一致**（脚本逐行比对 `same=true`），新增 **90** 行 |
| 2 | `USAGE_LINES` 25 行、前 8 行逐字不变 | PASS | `labels.js:183-209` 数组 25 项；脚本 `USAGE_LINES.length===25`，前 8 行逐字打印与 I1.6 基线一致；`cdb8fc6` diff `-` 行 **0**（纯追加），既有 793 行逐字一致已覆盖 |
| 3 | 既有键零改动 | PASS | 同上：`cdb8fc6` 对本文件 0 行删除/修改；`LAYER`（`:219-226`，6 键无 `health`）原样 |
| 4 | 新增键 `Object.freeze` | PASS | 23 个新增导出全部 `Object.freeze(...)`；脚本 `Object.isFrozen` 检查 23/23 通过，无缺失/未冻结 |
| 5 | `LAYER_HEALTH.health === '健康度'` 且既有 `LAYER` 表未改 | PASS | `labels.js:836` `export const LAYER_HEALTH = Object.freeze({ health: '健康度' })`；逐字核对 `LAYER_HEALTH.health` 与 `LAYER.session` 均一致。符合 D-7 裁决（不改冻结的既有 `LAYER` 表） |
| 6 | `HEALTH_REASON[code]` 单表（D-8） | PASS | `labels.js:819-828` 单表 8 键，键名与 D-3 L968 固定顺序一致：`pending_escalation / node_timeout / session_crash / role_unavailable / connection_rejected / connection_expired / p90_exceeded / handoff_ttl_half`；无 8 个别名导出。符合 D-8 裁决 |
| 7 | 零第三方依赖 | PASS | `deps = {}`（§4）；本 WP 未 import 任何模块，纯常量表 |
| 8 | `src/cli/labels.js` 是中文唯一来源，本 WP 未把中文写进别的产品文件 | PASS | `cdb8fc6` 只改 `src/cli/labels.js` + 新增 `test/wp9/i19-labels.test.js`（测试断言文本，非产品输出源）；无其它 `src/**` 文件被改。符合 D-6 / A-9 / 模板 §7 红线 10 |
| 9 | 新增导出名 = D-9 冻结契约（23 个） | PASS | 见 §3 清单；`decisions.md` D-9 明确「以 WP-4 实际导出名为冻结契约」 |

### 2.2 A-1~A-14 文案逐字核对表

方法：脚本从 `requirement.md` **按行号**取基线原文（不手抄，避免空格误差），把 WP-4 模板按 A-0 可变值约定填充夹具实际值后逐字比对；另核对行首空格数、` · ` / `→` / `—` 码点。共 **42** 项：**41 一致 / 1 不一致**。

| 文案（A 基线） | 键 | 一致 / 不一致 |
|---|---|---|
| A-1 `实例 INST-001 · 暂无追踪记录` | `TRACE_EMPTY_LINE` | 一致 |
| A-1 短语 `暂无追踪记录` | `TRACE_EMPTY` | 一致 |
| A-2 `实例 INST-001 · 追踪 TRC-1a2b3c4d` | `TRACE_HEADER` | 一致 |
| A-2 `跨度 1 条 · 回流 0 次` | `TRACE_SUMMARY` | 一致 |
| A-2 `10:00:00 → 10:02:10  T-001  已完成  交接 HO-001` | `TRACE_SPAN` | 一致 |
| A-2 `回流链` | `TRACE_BACKFLOW_HEADER` | 一致 |
| A-2 `无` | `TRACE_NO_BACKFLOW` | 一致 |
| A-3 `第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成` | `TRACE_BACKFLOW_ROW` | 一致 |
| A-4 `  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log` | `SUMMARY_FAIL_LINE` | 一致 |
| A-4 标签 `命令` / `退出码` / `关键输出` / `日志` | `SUMMARY_LABEL.{command,exitCode,keyOutput,log}` | 一致（4 项） |
| A-5 `实例 INST-999 · 不存在` | `TRACE_MISSING_LINE` | 一致 |
| A-5 短语 `不存在` | `INSTANCE_MISSING` | 一致 |
| A-6 `健康度 正常` | `HEALTH_LINE.base` + `HEALTH_LABEL.normal` | 一致 |
| A-6 `健康度 慢 · 节点 T-002 执行超过本实例 P90` | `HEALTH_LINE.withReasons` + `HEALTH_LABEL.slow` | 一致 |
| A-6 `健康度 需关注 · 有待处理升级` | `HEALTH_LINE.withReasons` + `HEALTH_LABEL.attention` | 一致 |
| A-6 `健康度 已结束` | `HEALTH_LINE.base` + `HEALTH_LABEL.ended` | 一致 |
| A-6 档位词 `正常 / 慢 / 需关注 / 已结束` | `HEALTH_LABEL`（4 项） | 一致 |
| A-6 附第 1 句 `有待处理升级` | `HEALTH_REASON[pending_escalation]` | 一致 |
| A-6 附第 2 句 `节点 T-001 执行超时` | `HEALTH_REASON[node_timeout]` | 一致 |
| A-6 附第 3 句 `会话 mock-sess-12345-1 崩溃` | `HEALTH_REASON[session_crash]` | 一致 |
| A-6 附第 4 句 `角色 开发 不可用` | `HEALTH_REASON[role_unavailable]` | 一致 |
| A-6 附第 5 句 `连接线 测试→开发 已拒绝` | `HEALTH_REASON[connection_rejected]` | 一致 |
| A-6 附第 6 句 `连接线 测试→开发 已过期` | `HEALTH_REASON[connection_expired]` | 一致 |
| A-6 附第 7 句 `节点 T-006 执行超过本实例 P90` | `HEALTH_REASON[p90_exceeded]` | 一致 |
| A-6 附第 8 句 `交接包 HO-006 待投递超过 TTL 一半` | `HEALTH_REASON[handoff_ttl_half]` | 一致 |
| **A-8 `10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级`** | **`HEALTH_EVENT_LINE`** | **不一致（见下）** |
| A-10 `10:00:00 → —  T-001  进行中  交接 HO-001` | `TRACE_SPAN` + `TRACE_NO_END` / `TRACE_RUNNING` | 一致 |
| A-10 `进行中` / `—` | `TRACE_RUNNING` / `TRACE_NO_END` | 一致（2 项） |
| A-11 `追踪记录有 1 行不可读，已跳过` | `TRACE_DEGRADED` | 一致 |
| A-12 `10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log` | `SUMMARY_LOG_LINE` | 一致 |
| A-13 `已跳过 1 行不可读记录` | `EVENTS_SKIPPED` | 一致 |
| A-14 `10:03:00  会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供` | `SUMMARY_LOG_LINE` + `SUMMARY_LABEL.unavailable` | 一致 |
| A-0 缺项 `未提供` | `SUMMARY_LABEL.unavailable` | 一致 |
| A-9 / D-7 层名 `健康度` | `LAYER_HEALTH.health` | 一致 |
| A-12 层名 `会话` | `LAYER.session`（既有键） | 一致 |

**唯一不一致项（判为建议 F-01，不升格为阻断）**：

```
实得（模板填充后）: "健康度 INST-001  正常 → 需关注  原因 有待处理升级"
基线（requirement.md:711）: "10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级"
```

- 差异仅为行首 `10:00:00  `（时刻 + 两个半角空格），中文骨架（层名、档位、`→`、两个空格、`原因`、原因句）**逐字一致**。
- `HEALTH_EVENT_LINE`（`labels.js:831-833`）不含 `{ts}` 占位，而 `SUMMARY_LOG_LINE`（`:876-878`）含 `{ts}`；两者切分不对称。
- 判定依据：A-0 明确「时刻」属**可变值**（断言时替换、不作为逐字比较对象）；`decisions.md` **D-9 已裁决**「占位符切分与内部键名属实现自由」「A-12/A-14/**A-8 锁定的是渲染结果逐字**」「以 WP-4 实际导出名为冻结契约」；`i19-labels.test.js:151-162` 自身即以 `` `10:00:00  ${segment}` `` 拼成 A-8 完整行。按用户指令「D-6~D-9 已裁决事项不得重新升格为阻断」，**不判阻断**；转达 WP-6 的接入要求见 §3 / F-01。

### 2.3 字符级核对（不凭视觉判断）

| 项 | 实跑结果 | 判定 |
|---|---|---|
| `SUMMARY_FAIL_LINE` 行首空格数 | 模板 = **2**，A-4 原文（`requirement.md:616`）= **2**，`/^ {2}\S/` 为 true（两个**半角** U+0020 空格） | 一致 |
| 分隔符 ` · ` | 码点 `[20, b7, 20]`（半角空格 + U+00B7 间隔号 + 半角空格） | 一致 |
| 箭头 `→` | U+2192 | 一致 |
| 结束位 `—` | `TRACE_NO_END` 码点 `[2014]`（U+2014 EM DASH，非全角/连字符） | 一致 |
| 缺项 `未提供` / 层名 `会话` `健康度` | 逐字一致 | 一致 |
| `Object.isFrozen` 新增 23 键 | 23/23，未冻结/缺失 = `[]` | PASS |
| `USAGE_LINES.length` | 25 | PASS |
| 控制字符（ESC/ANSI） | labels.js 全文控制字符数 = 0（`git show` 输出里的 `[m` 为终端显示伪影，文件内无） | PASS |

**WP-4 小结**：结构判据 9 条 + 逐字核对 41/42（1 项按 D-9 判建议）+ 字符级 8 项，阻断 0。

---

## §3 契约一致性与跨 WP 影响

### 3.1 D-6~D-9 裁决是否已生效

| 裁决 | 实现落地 | 生效 | 对下游的约束 |
|---|---|---|---|
| **D-6** `replay` 恒返回数组 + 非枚举 `badLines` | `event-bus.js:142-149` `Object.defineProperty(..., {enumerable:false})`，值取 `readEvents.badLines` | ✅ | **WP-8**：`src/daemon/server.js` 的 `instance.events` 必须 `const events = replay(id); result.badLines = events.badLines` **显式置入**；IPC JSON 序列化会丢非枚举字段，`src/cli/main.js` 的 `instance log` 从 RPC `result.badLines` 读，不许按 `{events, badLines}` 解构，也不许直接透传数组 |
| **D-7** `LAYER_HEALTH.health` | `labels.js:836`，既有 `LAYER` 表零改动 | ✅ | **WP-6 / WP-8**：健康度事件行的 `{layer}` 一律取 `LAYER_HEALTH.health`；`CORE_TEXT.doc.health` 在 `status-text.js` 侧镜像该值 |
| **D-8** `HEALTH_REASON[code]` 单表 | `labels.js:819-828` 8 键单表、固定顺序 | ✅ | **WP-6**：遍历 `health.reasons`（已按 D-3 固定顺序），逐码查表后用 ` · ` 拼接，不得硬编码中文或改顺序 |
| **D-9** 以 WP-4 实际导出名为冻结契约、渲染结果逐字为准 | 23 个具名导出（清单见 3.2），`HEALTH_EVENT_LINE` 为「行体模板」、`SUMMARY_FAIL_LINE` 行首 2 半角空格 | ✅ | **WP-6**：按实际导出名引用；缺键书面报主控，不许在 `render.js` 补中文硬编码；渲染结果必须与 A-1~A-14 逐字一致 |

以上四条均按裁决接受，未重新升格为阻断；判据中的逐字 / 回归红线也未因裁决而放宽（A 基线 41/42 逐字、USAGE_LINES 25 行、既有键零改、`replay` 数组形状 7/7 回归绿）。

### 3.2 WP-4 实际导出名冻结契约清单（23 个，供 WP-6 / WP-8 引用）

```
HEALTH_LABEL, HEALTH_LINE, HEALTH_REASON, HEALTH_EVENT_LINE, LAYER_HEALTH,
TRACE_HEADER, TRACE_EMPTY_LINE, TRACE_MISSING_LINE, TRACE_SUMMARY, TRACE_SPAN,
TRACE_BACKFLOW_HEADER, TRACE_BACKFLOW_ROW, TRACE_EMPTY, TRACE_NO_BACKFLOW,
INSTANCE_MISSING, TRACE_RUNNING, TRACE_NO_END, TRACE_DEGRADED,
SUMMARY_LABEL, SUMMARY_OUTPUT_LINES, SUMMARY_FAIL_LINE, SUMMARY_LOG_LINE,
EVENTS_SKIPPED
```

WP-2 侧冻结契约：`instance-store.readTailForChain(id) → { seq, prevHash, corruptAll }`；`emit` 返回 `{ok:true,seq,ts}` 不变、record 新增 `prev_event_hash`；`replay()` 返回事件数组 + 非枚举 `badLines`（D-6）。

### 3.3 WP-6 / WP-7 / WP-8 能否按实际导出名与 replay 形状接入

- **WP-6（渲染纯函数，批次 3）**：可按 23 个实际名接入。两个必须注意的落点：① `HEALTH_EVENT_LINE` 不含 `{ts}`，`renderHealthEventLine` 必须在行首补 `HH:MM:SS` + 两个半角空格，否则 A-8 逐字缺时刻（F-01）；② `SUMMARY_FAIL_LINE` 行首两个半角空格、` · `（U+00B7 两侧各一 U+0020）、`SUMMARY_LOG_LINE` 的 `{ts}  {layer} {sessionId}  执行摘要` 三段空格数必须逐字保留。
- **WP-7（orchestrator 集成）**：`emit` 返回结构与「先落盘再广播」未变，链由 store 侧 `readTailForChain` 自动接续；只要使用真实 `createStore`（已实现该方法）即可，无需改调用点。
- **WP-8（CLI + daemon）**：`replay` 数组形状保持，但 `badLines` 非枚举——必须按 D-6 显式从数组属性取出并置入 RPC 结果，否则 `EVENTS_SKIPPED`（A-13）拿不到计数。这是跨 WP 最易漏的一处。

---

## §4 门禁实跑记录（命令 + 真实数字 / exit）

> **按硬约束不跑全量测试**：避免 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 等仓库内副作用被重写（模板 §5 第 22 条 / D-2 的 flaky 口径）。改跑下列定向测试 + 静态门禁；**跑测试前后 `git status --porcelain` 完全一致**（均为评审前既有 4 项：`M .workbuddy/memory/2026-11-09.md`、`?? .workbuddy/memory/2026-11-10.md`、`?? docs/iterations/regression-2026-11-09.md`、`?? docs/iterations/regression-2026-11-09/`），**无任何仓库内新副作用**，无需还原。

| 命令 | exit | 真实数字 |
|---|---|---|
| `node --test test/wp9/i19-chain.test.js` | **0** | `7 tests / 7 pass / 0 fail` |
| `node --test test/wp9/i19-labels.test.js` | **0** | `14 tests / 14 pass / 0 fail` |
| `node --test "test/wp9/**/*.test.js"` | **0** | `49 tests / 49 pass / 0 fail` |
| `node --test test/wp11/labels-sync.test.js test/wp12/cli-assets.test.js` | **0** | `32 tests / 32 pass / 0 fail`（`labels-sync` 与 `USAGE_LINES` 25 行断言均绿） |
| `node --test test/wp1/event-bus.test.js`（既有回归） | **0** | `7 tests / 7 pass / 0 fail` → **replay 数组形状未被破坏** |
| `node --test test/wp1/instance-store.test.js`（既有回归） | **0** | `30 tests / 30 pass / 0 fail` |
| `FORBID="<31 词全表>"; node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | **0** | `OK: 扫描 24 个文件 … 零命中` |
| `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"` | 0 | 输出 **`0`** |
| `git show --stat 36f3be3 cdb8fc6` | — | `36f3be3`：`event-bus.js`(36)、`instance-store.js`(63)、`i19-chain.test.js`(300)，3 files / 394+ / 5-；`cdb8fc6`：`labels.js`(90)、`i19-labels.test.js`(351)，2 files / 441+ / 0- → **只动授权文件**（D-7 / §2.14） |
| 逐字核对脚本（`os.tmpdir()`，从 requirement.md 按行号取基线） | — | **41 一致 / 1 不一致**（A-8 时刻占位，按 D-9 判建议）；`SUMMARY_FAIL_LINE` 行首 = A-4 原文 = 2 半角空格 |
| 既有行逐字对比 `cdb8fc6^` vs 当前 | — | 前 **793** 行逐字一致，新增 **90** 行 |

补充：`node -e` 检查 `package.json` `type=module`、零控制字符；`labels.js` 前 8 行 `USAGE_LINES` 逐字打印与基线一致。31 词禁词表按 `requirement.md:998` 原样复制全 31 词。

---

## §5 修复清单（阻断 0 / 建议 3）

> 判定口径：只有阻断构成 FAIL；以下 3 条均为建议，逐条列出但不判 FAIL。F-01 涉及的 A-8 差异属 `decisions.md` D-9 已裁决事项，明确不升格为阻断。

| 编号 | 位置 | 原文 / 现象 | 违反依据（或风险依据） | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| **F-01** | `src/cli/labels.js:831-833` `HEALTH_EVENT_LINE` | 模板 `'{layer} {instanceId}  {from} → {to}  原因 {reasons}'` 不含 `{ts}`；填充后为 `健康度 INST-001  正常 → 需关注  原因 有待处理升级`，与 A-8 完整行相差行首 `10:00:00  `；而 `SUMMARY_LOG_LINE:876-878` 含 `{ts}`，两者切分不对称 | `requirement.md:711`（A-8 文本行逐字）、A-0（时刻为可变值）；但 `decisions.md` **D-9 已裁决**「占位符切分属实现自由、渲染结果逐字为准」，故**不构成违反判据**，仅登记为下游接入风险 | 保持 WP-4 现状（不改键、不补别名，遵 D-9）；**转达 WP-6**：`renderHealthEventLine` 必须在 `HEALTH_EVENT_LINE` 前拼 `HH:MM:SS` + 两个半角空格（与 `i19-labels.test.js:160` 同法），并在 `report.md` 契约矩阵登记「health 行 = 时刻前缀 + 行体模板」 | **建议** |
| **F-02** | 既有 `src/persistence/instance-store.js:305-315` `doAppend`（本 WP 未改、判据要求零改动）；AC-21 夹具构造 | 末行半行**无尾随换行**时，`fs.appendFile` 直接把新记录拼到半行后，该行不可解析（独立实跑 ⑦：`events=0 / badLines=1`）；AC-21 夹具文字「`head -c` 去掉最后一个字符」若只去掉末尾 `\n`，第 3 行仍是合法 JSON（badLines=0，与 AC-21 期望 `badLines=1` 冲突） | 既有 `doAppend` 行为（D-7 / D-11 明确「整行追加语义不动」「先落盘再广播顺序不动」），**非 WP-2 缺陷**；风险落在 WP-5 夹具 / WP-9 验收取证 | 不动 `doAppend`；**转达 WP-5 / WP-9**：预置截断行须是**不可解析的半行且单独占一行**（带尾随 `\n`，与 `i19-chain.test.js:53-60` 的 `seedLines` 一致），不要只去掉尾随换行；AC-21 的「`head -c` 去掉最后一个字符」口径书面澄清为「去掉末行 JSON 的收尾字符、保留坏行独立成行」 | **建议** |
| **F-03** | `src/core/event-bus.js:105-108` 降级分支 | mock store 缺 `readTailForChain` 时 `prevHash = ZERO_HASH` 恒定，故每条降级记录 `prev_event_hash` 均为 64 个 `0`，链不成立 | 判据只要求「降级不抛错」（已 PASS）；风险是下游若用「有真实 `appendEvent`、无 `readTailForChain`」的 mock 做链式断言会误判 | 保持现状（降级仅用于不落盘的测试 mock）；**转达 WP-7 / WP-8**：集成 / 取证中的链式断言一律用真实 `createStore({root})`，缺 `readTailForChain` 的 mock 只用于验证「不抛错」 | **建议** |

未发现任何阻断项：既有函数体被改 / 两次读 / 对原始字节哈希 / 整份损坏不重起链 / `replay` 数组形状被破坏 / A 基线中文骨架不逐字 / `USAGE_LINES` 被改 / 既有键被改 / 新增第三方依赖 —— 逐项实跑与 diff 核对均未命中。

---

## §6 结论

**批次 2（WP-2 `36f3be3` + WP-4 `cdb8fc6`）判定 PASS，准出批次 3（WP-5 夹具 / WP-6 渲染）。**

按用户要求逐项确认：

- **只动授权文件**：成立。两个 commit 共动 5 个文件，全部在 D-7 授权清单与 §2.14 测试归属内（`git show --stat` 已核）；未触碰 `paths.js` / `orchestrator.js` / `render.js` / `main.js` / `server.js`。
- **既有函数体零改**：成立。`instance-store.js` 的 `appendEvent` / `doAppend` / `nextSeq` / `readEvents` 函数体 diff 零改动（`-` 行仅导出列表 1 行）；`event-bus.js` 的 4 行替换全部落在 D-7 授权的 emit / replay 段内，且「先落盘再广播」、`instanceId` 路由、`subscribe`、单实例串行队列、`emit` 返回 `{ok:true,seq,ts}` 全部未变；`labels.js` 前 793 行逐字一致、纯末尾追加。
- **判据无放宽**：成立。判据按 `requirement.md` v7 / `iteration-9.md` r2 / 执行模板 §2.5/§5/§7 原样执行；D-6~D-9 按主控裁决接受、未重新升格为阻断，也未反向放宽（未删断言、未改期望值、未改 AC / 附录 A 基线）；`replay` 数组形状、`USAGE_LINES` 25 行、31 词纯净、零依赖、逐字文案均按原口径判定。
- **文案逐字**：成立（按 D-9 口径）。A-1~A-14 逐字核对 **41/42 一致**；唯一不一致项是 A-8 行首「时刻」这一 A-0 可变值的占位符切分（中文骨架、层名、档位、`→`、` · `、两个半角空格、原因句、行首 2 半角空格全部逐字一致），D-9 已裁决「占位符切分自由、渲染结果逐字为准」，判为建议 F-01 而非阻断。
- **门禁全绿**：成立。6 条定向测试命令全部 `exit 0`（7/7、14/14、49/49、32/32、7/7、30/30），purity `exit 0`（24 文件零命中），deps `0`，`git show --stat` 只动授权文件；未跑全量测试已按硬约束说明，跑测试前后 `git status` 一致、无仓库内副作用。

**准出批次 3 的交接要点**：WP-6 按 §3.2 的 23 个实际导出名引用，补 health 行时刻前缀、保留各模板空格与 ` · `；WP-5 构造 AC-21 截断夹具时按 F-02 让坏行独立成行；WP-8 后续按 D-6 显式透出 `badLines`。

---

*评审人：S2 批次 2 独立实现评审工程师（干净上下文，未参与实现） | 结论文件：本文件（唯一写入）*
