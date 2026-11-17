# I1.10b 实现评审报告 · 批次 1 round 2（WP-1 / WP-2 修复复核）

> 评审对象：`feat/i1.10b-drilldown` 分支、批次 1 的 8 个文件（WP-1 3 + WP-2 5）的当前工作树
> 评审 Agent：实现评审 Agent（批次 1 round 2，干净上下文，只读；本报告为唯一可写产物）
> 评审日期：2026-11-16
> 判据：`requirement.md` v6（附录 D-11 授权扩至 `errors.test.js` / `http-channel.test.js`，判据强度未变）、`iteration-10b.md`、`decisions.md`、`review-batch1.md`（上轮，B1-01 + S-01~S-05）、`review-v6.md`（PASS，仅扩 D-11）
> 原则：自己实跑、不采信自述；每条结论带行号 / 命令输出；阻断只判「上轮阻断未闭合 / 新红未闭合 / 回归退化 / 越界改文件 / 判定强度下降」，其余一律建议。

---

## §0 总判（返回格式①）

**总判：PASS。阻断 0 / 建议 5（S-01~S-05 全部维持建议，无新增）。**

- 上轮唯一阻断 **B1-01 已闭合**：`POST .../continue` 的错误 `message` 改为优先查 `COMMAND_ERROR`（`server.js:51/75-102/491`），实测文案由 `未知错误：ESCALATION_NOT_PENDING` 变为 `升级 ESC-001 已处理（已处理），无需再次处理`（= `COMMAND_ERROR.ESCALATION_NOT_PENDING` 原文）；`messageKey` 仍为 `DRILL_ESC_ALREADY` / `DRILL_ESC_NOT_SUSPENDED`（`server.js:60-63`）；测试断言从「非空」升格为从 `COMMAND_ERROR` 派生的逐字断言（`drill-fixtures.test.js:611-614/617-640`），测试内零手写中文。详见 §1。
- 新红闭合：v6 新增 D-11 授权两文件按 `147 + 63` 修（`errors.test.js:965`、`http-channel.test.js:131/142`），实跑失败集合差集 **∅**（唯一失败为已登记 lsof 平台红）。详见 §2。
- 8 维回归：全部 PASS，无一退化。详见 §3。
- 文件边界：本轮修复只触及 WP-2 的 `server.js` 与其包内测试 `test/wp14/drill-fixtures.test.js`，均在授权清单内；无新增越界文件。

---

## §1 B1-01 逐条复核（返回格式②）

### 1.1 修前 / 修后实测对照

| 项 | 修前（上轮 review-batch1.md:15/133-147） | 修后（本轮实测） |
|---|---|---|
| 查表来源 | `ERROR_TEMPLATE` 查表（`server.js` 旧 `:424-433`），两码不在表内 → 落 `UNKNOWN_ERROR` 兜底 | 优先 `COMMAND_ERROR`（`server.js:75-82`），`COMMAND_ERROR` → `ERROR_TEMPLATE` → `UNKNOWN_ERROR` 三级；`import` 于 `:51` 加入 `COMMAND_ERROR, ESCALATION_LABEL` |
| HTTP `message` | `未知错误：ESCALATION_NOT_PENDING` | `升级 ESC-001 已处理（已处理），无需再次处理` |
| `messageKey` | `DRILL_ESC_ALREADY`（已正确） | `DRILL_ESC_ALREADY` / `DRILL_ESC_NOT_SUSPENDED` 不变（`ESC_MESSAGE_KEYS`，`server.js:60-63`；响应装配 `:484-491`） |
| 测试断言 | 仅 `assert.ok(message)` 非空（`review-batch1.md:147`） | 逐字 `assert.equal(message, expectedAlready)`（`drill-fixtures.test.js:614`），期望值从 `COMMAND_ERROR` 派生（`:611-613`） |

**实跑命令与输出**（函数级，`node --input-type=module`，导入现行 `escalationErrorText`）：
```
修前 message = "未知错误：ESCALATION_NOT_PENDING"
修后 message = "升级 ESC-001 已处理（已处理），无需再次处理"
修后第二码 = "实例 INST-1 当前不是挂起状态，不能处理升级"
COMMAND_ERROR 原文 = "升级 {id} 已处理（{state}），无需再次处理"
ESCALATION_LABEL.resolved = "已处理"
```
- 修后值与任务书要求逐字一致；第二码 `INSTANCE_NOT_SUSPENDED` 亦从 `COMMAND_ERROR` 原文（`src/cli/labels.js:339`）产出，`{state}` 经 `ESCALATION_LABEL`（`labels.js:45-49`）本地化、`{id}` 由 `filled.escalationId ?? filled.instanceId` 填充（`server.js:83-95`）。

### 1.2 三条子项逐条判定

1. **`message` == `COMMAND_ERROR` 既有原文**：**闭合**。实测 `升级 ESC-001 已处理（已处理），无需再次处理` = `COMMAND_ERROR.ESCALATION_NOT_PENDING`（`labels.js:336`）以 `{id}=ESC-001` / `{state}=ESCALATION_LABEL.resolved='已处理'` 填充。daemon 层零中文文案字面（`server.js:71-73` 注释 + `:93` 走 `ESCALATION_LABEL` 表）。
2. **不再出现 `未知错误：ESCALATION_NOT_PENDING`**：**闭合**。修前/修后对照见 §1.1；未知码兜底仅对非 `COMMAND_ERROR` 码保留，测试 `drill-fixtures.test.js:635-639` 用 `B1_UNKNOWN_CODE` 验证兜底语义未变（仍为 `ERROR_TEMPLATE.UNKNOWN_ERROR` 形态，非本次两码）。
3. **`messageKey` 仍为 `DRILL_ESC_ALREADY` / `DRILL_ESC_NOT_SUSPENDED`**：**闭合**。`ESC_MESSAGE_KEYS`（`server.js:60-63`）字面未动；HTTP 实测断言 `second.body.messageKey === 'DRILL_ESC_ALREADY'`（`drill-fixtures.test.js:608`）通过。
4. **测试断言从「非空」升格为逐字（从 `COMMAND_ERROR` 派生，不手写中文）**：**闭合**。`drill-fixtures.test.js:72-73` 新增 `import { COMMAND_ERROR, ESCALATION_LABEL, ERROR_TEMPLATE }` 与 `escalationErrorText`；`:611-614` 真实 HTTP 逐字断言；`:617-640` 两码纯查表逐字断言 + 未知码兜底断言，注释 `:621` 明示「期望值全部来自 src/cli/labels.js，测试内不手写任何中文文案」。全仓搜 `assert.ok(.*\.message)` 等弱断言 **exit 1（零命中）**，`:608/614` 仅存两条逐字断言。

### 1.3 B1-01 结论

**B1-01 闭合（PASS）。** 修法与上轮建议一致（对这两个码改用 `COMMAND_ERROR` 查表并填 `id`/`state` 参数），未触碰只读性、文件边界、冻结逻辑或判定强度；`code` 仍只留 daemon、`messageKey` 给界面分层不变。

---

## §2 新红闭合与差集（返回格式③）

### 2.1 v6 D-11 授权两文件实改核对

`git diff` 实测（`git diff -- test/wp13/errors.test.js` / `http-channel.test.js`）：

| 文件 | 行号 | 改动 | 形态 |
|---|---|---|---|
| `errors.test.js` | 965（hunk `@@ -962`） | `assert.equal(..., 147)` → `assert.equal(..., 147 + 63)` | 精确值 210，未放宽 |
| `errors.test.js` | 16（注释） | `147 键` → `147 + 63 键` | 注释同步 |
| `http-channel.test.js` | 131（hunk `@@ -128`） | 标题 `frozen 147-key` → `frozen 147 + 63 key` | 标题同步 |
| `http-channel.test.js` | 142（hunk `@@ -139`） | `assert.equal(..., 147)` → `assert.equal(..., 147 + 63)` | 精确值 210，未放宽 |
| `http-channel.test.js` | 10（注释） | `frozen 147-key` → `frozen 147 + 63 key` | 注释同步 |

与 `review-v6.md` 判据 4 点名的 `errors.test.js:965` / `http-channel.test.js:131,142` 完全一致；断言仍为 `assert.equal` 精确相等（非 `notEqual` / 区间），判定强度未下降。N=63 与 `UI_LABEL_KEYS=210`、`210-147=63` 自洽（`review-v6.md:96-101`）。

### 2.2 实跑结果（逐文件独占，`--test-concurrency=1`）

| 文件 | tests | pass | fail | 失败成员 |
|---|---|---|---|---|
| `test/wp13/errors.test.js` | 24 | 24 | 0 | — |
| `test/wp13/http-channel.test.js` | 13 | 12 | 1 | `the desktop port listens on loopback only (lsof shows 127.0.0.1)` |
| `test/wp14/labels-drill.test.js` | 8 | 8 | 0 | — |
| `test/wp13/labels-desktop.test.js` | 25 | 25 | 0 | — |

### 2.3 差集判定

- 本轮观测失败集合 = `{ the desktop port listens on loopback only (lsof shows 127.0.0.1) }`（`http-channel.test.js:454`，失败于 `:462` `strictEqual null !== 0`）。
- 允许集合 = `docs/iterations/iteration-10a/baseline-failures-win32.txt` 登记项（`[LSOF]` 行逐字命中该标题）。
- **差集（新增失败）= ∅**。lsof 为已登记平台红（Windows 无 `lsof`），非本轮新增、非回归。另三文件 fail 0。
- **新红闭合：PASS。**

---

## §3 8 维回归扫描（返回格式④，逐维一行）

| 维度 | 结论 | 一句证据（实跑 / 行号） |
|---|---|---|
| A 文件边界 | **PASS** | 本轮仅改 `server.js`（WP-2）与 `test/wp14/drill-fixtures.test.js`（WP-2 包内），均授权清单内；`git diff --stat` 无新增越界文件，非产物改动（`.workbuddy/memory`、iteration-4 evidence）本轮未新增 |
| B 文案逐字 | **PASS** | `labels.js` DRILL_* 63 键齐全、既有 147 键零改；`labels-drill` 8/8、`labels-desktop` 25/25 全绿；CJK 零命中、purity 双目录 exit 0 |
| C 五投影 | **PASS** | 五导出签名对齐（`drill.js:249/449/561/610/652`），9 字段取数、8 档排序、异常态齐；A2 第二调用点 `routes.js:456` 在、既有唯一调用 `server.js:380` 未改 |
| D 7 端点 | **PASS** | 5 GET（`routes.js:471/487/509/529/538`）+ 2 POST（`server.js:416/417/649/655`）；continue `message` 已按 B1-01 修、messageKey 映射 `server.js:60-63` 不变 |
| E 宿主适配器 | **PASS** | `host-open.js` 配置驱动 + 500ms 去重 + 三错误形状 + `hosts/` 命中 3；G4 `dsh` 字面零命中（exit 1） |
| F 夹具与实验 | **PASS** | `drill-fixtures.test.js` 10/10（上轮 9 → 本轮 10，新增即 B1-01 逐字防回归 test `:617`）；先起核再写盘纪律、F5-01 实证、test.escalate 等价判定维持 |
| G 静态门禁 | **PASS** | G1/G2/G4 grep exit 1（零命中）、G5 `hosts/`=3；purity 31 词双目录 exit 0、零依赖 0；5 文件实跑见 §2.2 |
| H 不弱化 | **PASS** | 147+63 精确断言未放宽；B1-01 断言由「非空」升格为逐字（更强）；skip/todo 全 0；`:686` 恒真属清理脚手架（S-04） |

8 维全 PASS，`review-v6.md` PASS「仅扩 D-11、不放松判据」本轮遵守：未因 v6 放宽任何 B1 判据。

### 3.1 门禁命令输出摘要

```
$ grep -REn "saveState|appendSpan|emit\(|Date[.]now|new EventEmitter" src/daemon/drill.js  → exit 1（零命中）
$ grep -REn "state = 'running'|node\.state = " src/daemon/http/                              → exit 1（零命中）
$ grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js                               → exit 1（零命中）
$ grep -REn "hosts/" src/adapter/host-open.js | wc -l                                        → 3
$ node purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>                           → OK 31 文件零命中 exit 0
$ node purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>                    → OK 21 文件零命中 exit 0
$ node -p "Object.keys(require('./package.json').dependencies||{}).length"                    → 0
$ grep -rlP '[\x{4e00}-\x{9fff}]' desktop/ui desktop/harness                                 → 零命中
$ git diff --numstat → labels.js +88/-1; routes.js +289/-3; server.js +177/-1; labels-desktop +199/-4; errors.test +2/-2; http-channel +3/-3; requirement +10/-1(v6) + 非产物文件（上一轮既有，本轮未动）
```

### 3.2 上轮 5 条建议三态（逐条附行号）

| # | 上轮位置 | 三态 | 本轮核对（行号 / 说明） |
|---|---|---|---|
| S-01 | `server.js` / `routes.js` 新增 import/helper 落授权段外 | **维持建议** | 本轮修复续用同机制：`server.js:51` 增 `COMMAND_ERROR/ESCALATION_LABEL` import、`:54-102` 增 `escalationErrorText` 导出 helper、`:484-491` 响应装配；`routes.js` hunk `@@ -26/43/202/304/326`。均属新端点装配、未改冻结函数；待主控裁定 D-10 口径，非阻断 |
| S-02 | `buildDrill`/`buildSubflowGraph` 多入参 | **维持建议** | 未变：`drill.js:249` `buildDrill({state,workflowDef,roleId,roles,graph,now})`、`:652` `buildSubflowGraph({workflowDef,ref,visited,state})`；移交下游按实际签名消费 |
| S-03 | `breadcrumb` 样例字符串 vs 实现对象 | **维持建议** | 未变：`drill.js:277-282` 返回 `{key:'DRILL_CRUMB_ROLE',instanceId,roleId,roleTitle}`；拼行在渲染层，移交 WP-3 |
| S-04 | 收尾 test 仅 `assert.ok(true)` | **维持建议** | 未变：`drill-fixtures.test.js:686`（清理脚手架 `:680`）；非判定测试、不记测试弱化 |
| S-05 | `.workbuddy/memory` / iteration-4 evidence 非产物改动 | **维持建议** | 本轮 `git status` 仍在（非 WP-1/WP-2 产物、本轮未新增），待主控确认来源；不计入批次 1 文件边界 |

---

## §4 B1R 阻断标题行（返回格式⑤）

**无。**（B1-01 已闭合；新红差集 ∅；8 维无退化；无越界改文件；判定强度未下降。）

---

## §5 移交批次 2 注意事项（返回格式⑥，2 条）

1. **B1-01 回归防线**：WP-4 `escalation-continue.test.js`（批次 3）应对 `message` 加逐字断言，期望值从 `COMMAND_ERROR` 派生（照 `drill-fixtures.test.js:611-614` 写法，测试内不手写中文）；第二码 `INSTANCE_NOT_SUSPENDED` 真 HTTP 夹具不可构造，按 `:631-634` 纯查表覆盖即可。批次 2/3 不得把 `message` 断言退回「非空」。
2. **消费实际契约**：`buildDrill`/`buildSubflowGraph` 按实际签名取数（多 `roleId`/`state`，S-02）；`breadcrumb` 为 `{key,instanceId,roleId,roleTitle}`（S-03），`DRILL_CRUMB_*` 拼行在 `role-bar.js`/index 渲染层；63 键已冻结，批次 2 不得增删键，发现缺键回改 A-10（风险 10 / 检查点 1 纪律）。
