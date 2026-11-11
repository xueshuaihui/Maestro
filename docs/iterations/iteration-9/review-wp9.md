# I1.9 S2 批次 6（WP-9）独立评审报告

> 评审 Agent：干净上下文独立评审（与实现者、历批评审者分离），**只评审、不改产品代码 / 测试代码、不 commit / add / stash**。
> 评审对象 HEAD：`e5a7e2f`（批次 4/5 已提交），WP-9 改动在工作区未提交。
> 评审时刻：`2026-11-12 03:32 CST`。
> 唯一写入：本报告 `docs/iterations/iteration-9/review-wp9.md`。

---

## 1. 评审范围与判据来源

### 1.1 评审对象

| 项 | 内容 |
|---|---|
| 新增文件 | `test/wp9/i19-regression.test.js`（761 行 / 8 用例，`git status` 显示为 `??` 未跟踪） |
| 归属裁决 | **D-18**（WP-9 负责文件收缩为单个文件）+ **D-21**（`test/wp9/cli-e2e.test.js` 零改动）→ 本批应只新增这一个文件 |
| WP-9 交付面 | `docs/iterations/iteration-9.md:497-501`：三主链逐字、`status` 删健康度行后逐字、`graph` 文本 / JSON 比对、31 词 purity `exit 0`、deps=0、`USAGE_LINES` 25、`grep -c "object: 'session'"` ≤ 13 |
| 判据来源（均已自读） | `requirement.md` AC-01/02/03/05/19/20/24 原文；`iteration-9.md` WP-9 段与 §2 文件清单；`decisions.md` D-2 / D-17（含 ⑥）/ D-18 / D-21 / D-24；`docs/iterations/iteration-7/baseline-failures.txt`（8 行） |

### 1.2 本轮不做的事

- 不跑全量 `node --test "test/**/*.test.js"`（按任务书，会改写 `iteration-4/evidence/nfr-perf-*.json`；全量由主控在 S3/S4 统一跑）。
- 不判「失败集合差集 = 0 / 条数只增不减」的最终结论：该口径（D-2）依赖全量运行，属 S3/S4；本报告只记录 `wp9/**` 与指定子集的实跑数字。
- 已裁决项不重升阻断：D-2（差集口径）、D-17 ⑥（`会话 已升级` 基线 flaky，判「不得低于基线」）、D-24（`object: 'session'` 计数以 `orchestrator.js` 单文件为准）。

---

## 2. 断言强度逐条判定（本文最高优先级）

### 2.1 总判定表

| # | 用例 | 是否逐字 / 深比较 | 是否可证伪（我判） | 我的压力测试结果 |
|---|---|---|---|---|
| 1 | 三主链无新增词 + 归一化逐字（AC-03） | 是（整份归一化 + 分组 deepEqual + 位置断言） | **可** | 副本注入 4 种变异：控制组绿、`add-word` 红、`session-text` 红、`swap-first-two` 红 |
| 2 | `instance status` 删健康度行后逐字（AC-19） | 是（12 行 deepEqual，非 includes） | **可** | 与 I1.7 树（`70277df`）实跑逐字一致；健康度断言绑定 `lines[1]` |
| 3 | `instance graph` 文本 + JSON（AC-19） | 是（文本 `assert.equal`、JSON `deepEqual`） | **可** | I1.7 树实跑文本字节相等、JSON 深比较相等、均不含 `健康度`/`health` |
| 4 | 零依赖 + `USAGE_LINES`（AC-20） | 是（deps 键数 0、25 行、前 8 行 + 末行逐字） | **可** | 实跑 0 / 25；中间行由 `cli-assets` 整表 deepEqual 补齐 |
| 5 | 31 词纯净扫描（AC-20） | 是（真跑 `purity-check.mjs`，判 `exit 0`） | **可** | 实跑 `exit 0`，24 文件零命中；词表与 `test/wp11/purity.test.js` 的 D-6 31 词逐字同表 |
| 6 | 无宿主分支（AC-20） | 是（逐行正则） | **可**（对字面形态） | 当前 `src/daemon` 仅 5 处 `host` 字样，全为注释 / `typeof` 守卫 |
| 7 | 会话级只有 `execution.summary`（AC-24） | 是（计数 + reason 白名单 + daemon 0 + 其余 core 仅 `escalation.js` 1） | **可** | 实跑 orchestrator 13 / core 合计 14 / daemon 0，与 D-24 一致 |
| 8 | 事件链 + 摘要 + traces 7 字段（AC-01/02/05/24） | 是（独立 `canonicalize` 逐条复算哈希，非只查长度） | **可** | 8/8 通过；`canonicalize` 与 `instance-store.js:53-66` 逐字同实现 |

### 2.2 逐条细读

**① 三主链（`:266-357`）——不强，但足够**

- 基线字面量**不是**把当前输出抄下来：见第 3 节的独立复核（与 `322fb5e` 与 `70277df` 两棵独立树归一化后**逐字相等**）。
- 逐字比较是**整份**：`normalized.length === baseline.length && every(...)`（`:295-298`），不是「包含」。
- 除整份命中外还有**每次运行**的结构断言，且都是 `deepEqual` 而非子集：
  - `groups.other` 必须恰为 `['任务已投递']`（`:305`）→ **任何无前缀新增行必红**；
  - `实例 / 节点 / 交接包 / 升级 / 下一步` 五组**整组逐字 + 顺序**相等（`:308-314`）→ 组内加行、删行、换序必红；
  - 会话组：白名单标签（未知文案即红，`:318-319`）、首条必须 `会话已创建`、终态必须出现 `会话 空闲`、不得重复、条数不超过基线、**顺序必须是基线序的子序列**（`:317-329`）。
- `会话 已升级` 的位置断言确实包在 `if (labels.includes(...))` 里（`:332-341`）——但**不会**因此变成无断言：`exact.length >= 1`（`:344-348`）要求至少一次整份命中，而基线含该行，故位置必被校验至少一次。
- 退出码 `0/4/4` 与 `stderr === ''` 逐链断言（`:274-275`）。

**压力测试（在 `/tmp/r9-mut` 副本上做，未触碰工作区）**

副本 `bin/orch.js` 注入仅对 `run` 生效的 `process.stdout.write` 钩子（`R9_MUT` 环境变量控制），夹具、测试、断言一律不改；只跑 `--test-name-pattern="三主链"`：

```
##### MUT=none
ok 1 - 三主链：无新增可见词，且归一化后与 I1.7 收口基线逐字一致（AC-03）
# pass 1  # fail 0

##### MUT=add-word          （在「会话 空闲」后追加一行「进度 已同步」）
not ok 1 - 三主链…
    single 出现未归类输出行：
# pass 0  # fail 1

##### MUT=session-text      （把「会话 空闲」改成「会话 空闲 · 已同步」，标签前缀不变）
not ok 1 - 三主链…
  error: |-
    single 连续 2 次均未命中归一化基线（D-17 ⑥「不得低于基线」）：
# pass 0  # fail 1

##### MUT=swap-first-two    （交换第 1、2 行：实例行与「会话已创建」）
not ok 1 - 三主链…
  error: |-
    single 连续 2 次均未命中归一化基线（D-17 ⑥「不得低于基线」）：
# pass 0  # fail 1
```

结论：**「把新词加进 run 输出」与「行顺序被打乱」都会变红**，控制组证明变异装置本身不会制造假红。其中 `session-text` 与 `swap-first-two` 是被整份 `exact` 断言抓住的（分组断言对「会话行尾追加文字」与「跨组换序」不敏感），说明 `exact` 是这套口径的必要支柱，不可删。

**② `instance status`（`:471-486`）——逐字，且覆盖四类行**

- 健康度行两条硬断言：恰 1 行（`:481`）+ **位置严格为 `res.lines[1]`** 且文案逐字 `健康度 需关注 · 有待处理升级`（`:482`）。
- 删掉 index 1 后用 `assert.deepEqual` 与 12 行 `STATUS_BASELINE` 比较（`:484-485`），覆盖「实例 / 节点 ×2 / 交接包 ×4 / 升级 / 原因 / 节点 / 下一步」全类，且是**逐字 + 相对顺序**，不是包含。
- 我在 `70277df`（I1.7 收口树）上用同一份冻结快照实跑，输出与 `STATUS_BASELINE` **deepEqual = true**（11 行，见 §3.3），证明基线不是自证。

**③ `instance graph`（`:488-504`）——文本与 JSON 都严**

- 文本：`assert.equal(text.stdout, GRAPH_TEXT_BASELINE)`（字节级，含结尾换行）+ 不含 `健康度` / `health`。
- JSON：先 `!includes('health')` 再用 `assert.deepEqual(JSON.parse(...), GRAPH_JSON_BASELINE)`，且基线对象无 `health` 字段 → 加字段必红；`JSON.parse` 失败会直接抛错，不会被吞。
- 我在 `70277df` 树实跑：文本 **字节相等**、JSON **深比较相等**、两者都不含 `health`。

**④ 静态门禁（`:523-583`）**

- `dependencies` 键数 0（读 `package.json`，不是读 `package-lock`）；`USAGE_LINES.length === 25`、前 8 行 `deepEqual`、末行逐字（`:527-542`）。
- 31 词用例**真跑** `test/fixtures/purity-check.mjs`（`--dirs src/core,src/daemon --forbid <31 词>`）并判 `status === 0`（`:556-559`），不是自写弱正则；词表 31 项与 `test/wp11/purity.test.js` 的 D-6 全表**逐项同序**（我逐项比对）。
- 宿主分支：`switch\s*\(\s*host` 与「含 `if (` + `hostXxx ===/!==` + 非 `typeof`」两条正则（`:572-580`），能覆盖 `if(host===`（无空格）与 `switch (hostId)`。**可漏**：`switch (cfg.host)`、三元 `host === 'x' ? a : b`、`if (hostId)` 真值分支（见 S-3）。

**⑤ 事件链（`:686-761`）——独立实现、真复算**

- 测试侧自带 `canonicalize`（`:665-676`），与 `src/persistence/instance-store.js:53-66` 逐行同构（键排序 + 无空白 + 递归）；`chainHash` 用 SHA-256 逐条复算 `records[index-1]` 并与当前条 `prev_event_hash` 相等（`:703-708`），不是只校验长度；首条断言 64 个 `0`（`:700-701`），并校验 `seq === index + 1` 连续（`:699`）。
- 摘要：每会话恰 1 条（`:713-719`）+ 摘要总数 === 会话数（`:720-724`）+ 会话级 reason 只允许 9 类白名单（`:727-736`）。
- traces：`Object.keys(span).sort()` 与 7 字段排序后 `deepEqual`（`:743-746`），**多一个字段即红**；另断言无 `handoff_ids`（`:746`），文件位置必须是 `state/traces.jsonl`（`:740`）。
- AC-05：实例目录递归找 `*.log` 必须为空 + 不得存在 `host-logs/`（`:749-760`）。

**⑥ 本节结论**：8 个用例**全部不可被「抄当前输出」或「包含式断言」满足**；基线取自两棵独立树（见 §3）。未发现「假绿」断言。

---

## 3. 基线来源独立复核（原始证据）

### 3.1 对照资源有效性

```
$ git -C /tmp/i19-wp7-baseline rev-parse --short HEAD
322fb5e
$ ls -l /tmp/i19-wp7-chains.mjs /tmp/r2-normalize.mjs        # 脚本仍在，可直接复用
```

另取**更早的独立树**：`git archive 70277df`（I1.7 收口最后一个提交，`src/cli/main.js` 与 `src/cli/render.js` 的 `健康度` 命中数均为 **0**）解到 `/tmp/r9-i17`，作为「I1.7 收口基线」的**真源**复核。

### 3.2 三主链：交替 2 对（`322fb5e` vs 当前），A-0 归一化

```
$ node /tmp/i19-wp7-chains.mjs /tmp/i19-wp7-baseline /tmp/r9-p1-base
single: exit=0 lines=12
code-loop: exit=4 lines=11
task-loop: exit=4 lines=10
$ node /tmp/i19-wp7-chains.mjs /Users/xuesh/www/Maestro /tmp/r9-p1-cur
（同上）
$ node /tmp/i19-wp7-chains.mjs /tmp/i19-wp7-baseline /tmp/r9-p2-base ; … /tmp/r9-p2-cur
（同上）
$ for c in single code-loop task-loop; do diff /tmp/r9-p{1,2}-base-$c.stdout.norm /tmp/r9-p{1,2}-cur-$c.stdout.norm; done
（6 次 diff 全部无输出 → diff=0）
```

当前树 `task-loop` 原始 stdout（第 1 对，用于核对 `会话 已升级` 未被丢失）：

```
实例 INST-001 · 运行中 · 模板 通用任务闭环
会话已创建 mock-sess-76500-1
任务已投递
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 通用任务闭环
升级 ESC-001 待处理 · 节点 T-001 研究员 · 第 1 轮
下一步：orch escalate list --instance INST-001 查看升级；… 要终止请执行 orch cancel --instance INST-001
```

### 3.3 测试内字面量 ≠ 当前输出（关键：排除自证）

把测试文件 `:170-233` 的 `CHAINS` 原样抽取，与四份归一化输出逐行比对：

```
baseline322fb5e p1 single: literalEqual=true lines=11/11
baseline322fb5e p1 code-loop: literalEqual=true lines=10/10
baseline322fb5e p1 task-loop: literalEqual=true lines=9/9
current p1 single: literalEqual=true lines=11/11
current p1 code-loop: literalEqual=true lines=10/10
current p1 task-loop: literalEqual=true lines=9/9
baseline322fb5e p2 / current p2：同上 6 行全为 true
```

再用 **I1.7 收口树 `70277df`**（不含任何 I1.9 代码）实跑三链：

```
$ node /tmp/i19-wp7-chains.mjs /tmp/r9-i17 /tmp/r9-i17chains
single: exit=0 lines=12 / code-loop: exit=4 lines=11 / task-loop: exit=4 lines=10
I1.7(70277df) single: literalEqual=true lines=11/11
I1.7(70277df) code-loop: literalEqual=true lines=10/10
I1.7(70277df) task-loop: literalEqual=true lines=9/9
$ diff /tmp/r9-i17chains-*.norm /tmp/r9-p1-base-*.norm   # 三链全部无输出
```

→ 测试里的三份基线**与 I1.7 收口树的真实输出逐字相同**，且 `task-loop` 的 `会话 已升级` 在 I1.7 树上是**存在**的（基线本身如此）。基线来源判定：**非自证、可复现**。
`single` 的 11 行也与 `docs/iterations/iteration-1/evidence/NFR-03.output.json` 的 `第 1 次 orch run` stdout 归一化后逐字相同（仅 `已运行/耗时 1s`→`Ns`、时刻→`TIME`、会话号替换）。

### 3.4 `instance status` / `instance graph`：用 I1.7 树实跑

`/tmp/r9-status17` 写入与测试 `frozenSuspendedSnapshot()` **完全同构**的快照后，在 `70277df` 树上执行：

```
$ node /tmp/r9-i17/bin/orch.js instance status INST-001
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2m
节点 T-002 测试 已升级 · 第 2 轮
交接包 HO-001  开发→测试  已构造   10:02:01
交接包 HO-001  开发→测试  已投递   10:02:02
交接包 HO-001  开发→测试  已接受   10:02:02
交接包 HO-001  开发→测试  已完成   10:04:00
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  节点：T-001 开发 · 第 1 轮
  下一步：orch escalate list --instance INST-001 查看升级；… 要终止请执行 orch cancel --instance INST-001
（exit=0，共 11 行）

$ node /tmp/r9-i17/bin/orch.js instance graph INST-001            # 8 行文本
$ node /tmp/r9-i17/bin/orch.js instance graph INST-001 --format json
```

程序化比对：

```
I1.7 status lines = 11 | deepEqual(STATUS_BASELINE) = true
graph text byteEqual = true | includes 健康度 = false | includes health = false
graph json deepEqual = true | includes health = false
```

→ AC-19 的两份基线同样**来自 I1.7 真实输出**，不是把 I1.9 当前输出抄成期望；健康度行是唯一新增，位置 `index 1` 由用例硬编码校验。

---

## 4. 测试工程性检查

| 检查点 | 结果 | 证据 |
|---|---|---|
| 仓库外固定路径依赖 | **无** | `grep "/tmp/"` 仅命中注释 `:158`；`grep "322fb5e"` 仅命中注释 `:17`、`:179`；`REPO` 由 `import.meta.url` 推导 |
| `sleep` 凑时序 | **无** | 唯一的 `Atomics.wait` 在 `removeProject` 的删除重试里（`:62-65`、`:97-108`），进程退出后才走，不参与时序断言；`grep sleep/setTimeout` 零命中 |
| 夹具根隔离 | **是** | 每用例 `fs.mkdtempSync(os.tmpdir()/maestro-i19-reg-*)`（`:68`），`NODE_ENV=test`，`t.after` 里 `core stop` + 带重试的 `rm -rf`（`:70-73`） |
| 进程泄漏 | **无** | 测试后 `pgrep -f maestro-i19-reg` = **0**、残留目录 = **0** |
| 目录泄漏 | **无** | 同上 |
| 用例间共享状态 | **无** | 每个 `makeProject` 独立项目根；无模块级可变状态；不依赖执行顺序（`node --test` 单文件串行） |
| 运行时长 | **合理** | 单文件 3 轮：`47.8s` / `8/8`（另一轮 67s，当时机器上有 233 个历史遗留孤儿 `core serve` 进程，属环境负载）。三主链 35.8s（8 次真实 CLI 运行）、graph 3.4s、status 3.0s、纯静态 0.5s。`single×2 + code-loop×2 + task-loop×3` 是 D-17 ⑥「不得只跑单次」的最低成本实现，未发现可避免的重复 run |
| 超时兜底 | **合理** | `spawnSync` 单次 90s、`core stop` 20s，均远高于实测（单链 3–6s） |
| 轮询 / 等待 | **不需要** | 全程同步 `spawnSync`，无「等文件出现」类时序，因此不需要轮询 |

---

## 5. 门禁独立复跑（真实数字）

| 命令 | 结果 | 备注 |
|---|---|---|
| `node --test test/wp9/i19-regression.test.js` | **8/8 pass**，`47.8s`（另两轮 8/8，`67.1s`/`55s` 量级） | 3 轮全绿，无失败用例 |
| `node --test "test/wp9/**/*.test.js"` | **116/116 pass** ×4 轮；**115/116** ×1 轮（首轮） | 首轮失败用例名未留档（当时只保留尾部 25 行日志），随后 4 轮均 116/116；见 **S-2** |
| `node --test test/wp11/status-doc.test.js test/wp11/labels-sync.test.js test/wp12/cli-assets.test.js` | **44/44 pass**，`3.3s` | 与批次 5 记录一致 |
| `node -p "Object.keys(require('./package.json').dependencies||{}).length"` | **0** | 零依赖红线成立 |
| `node -e "import('./src/cli/labels.js').then(...USAGE_LINES.length)"` | **25** | 前 8 行 + 末行逐字由本文件校验，中间行由 `cli-assets` 整表 deepEqual 校验 |
| `grep -c "object: 'session'" src/core/orchestrator.js` | **13** | 符合 AC-24 / D-24 单文件口径 |
| 同上，`src/core` 合计 / `src/daemon` | **14**（`orchestrator.js` 13 + `escalation.js` 1 存量）/ **0** | 与 D-24 完全一致，用例断言 `otherSites` 恰为 `[{escalation.js,1}]` |
| `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | **exit 0**，`OK: 扫描 24 个文件 … 零命中` | 词表 31 项与 D-6 全表逐项同序 |

> 全量 `test/**` 未跑（任务书明确不在本批评审范围，且会改写 `iteration-4/evidence/nfr-perf-*.json`）。

---

## 6. 越界检查

```
$ git status --short
 M .workbuddy/memory/2026-11-09.md          （历史遗留）
 M docs/iterations/iteration-9/decisions.md  （+9 行 = D-24，见 S-7）
?? .workbuddy/memory/2026-11-10.md          （历史遗留）
?? docs/iterations/regression-2026-11-09.md （历史遗留）
?? docs/iterations/regression-2026-11-09/   （历史遗留）
?? test/wp9/i19-regression.test.js          （本批新增，唯一代码产物）
```

- `src/**` 零改、`package.json` 零改、`test/wp9/cli-e2e.test.js` 零改、夹具零改 → **未越界**。
- `docs/iterations/iteration-9/decisions.md` 的 +9 行是本评审自己也引用的 **D-24 裁决记录**（文件 mtime `03:02`，晚于测试文件 `02:57`），从内容与形态判断是裁决层写入、非实现越界；按 **S-7** 提示主控在批次提交里单列。

---

## 7. 阻断项 / 建议项

### 7.1 阻断（0）

无。逐条对照任务书「阻断 = 不能变红的断言 / 基线自证 / 逐字换包含 / 计数口径不符 / 弱化静态门禁 / 仓库外固定路径 / 进程目录泄漏 / 越界改文件」八类：全部**不成立**（证据见 §2–§6）。

### 7.2 建议（7，非阻断）

| 编号 | 位置 | 内容 | 为什么不阻断 |
|---|---|---|---|
| **S-1** | `:295-298`、`:344-348` | `exact` 判定是「N 次中**至少 1 次**整份命中」。对 `single` / `code-loop`（基线在我 2/2 对 + `review-wp7-r2` 的 21 次比对中 100% 稳定）宽了一档：**间歇性**的会话行尾追加文字（`sessionLabel` 前缀仍匹配）、或 `会话 已升级` 只丢一半（1/2 仍绿）都漏得过。建议 `single`/`code-loop` 改 `exact.length === spec.runs`，仅 `task-loop` 保留 `>= 1`（D-17 ⑥ 只豁免 `task-loop`） | 确定性回归（增词 / 换序 / 丢行）全部会红（§2.2 压力测试），漏的只是「间歇性文案变化」这一低概率形态 |
| **S-2** | `wp9/**` 目录门禁 | 5 轮中 1 轮出现 115/116，失败用例名未留档（首轮只保留了尾部 25 行）。疑并发 / 负载下的既有时序用例，不可归因于本文件（新文件单独 3 轮 8/8、在目录运行中 4 轮全绿）。建议 S3 复跑时落完整 reporter 日志并在未全绿时保留用例名 | 本文件可复现性已由 3 次单独运行 + 4 次目录运行证实；1 次未留档失败无法覆盖「本文件必红/必不稳」 |
| **S-3** | `:563-583` | 宿主分支扫描是启发式，**漏** `switch (cfg.host)`、三元 `host === 'x' ? a : b`、`if (hostId)` 真值分支。当前 `src/daemon` 仅 5 处 `host` 字样（4 条注释 + 1 处 `typeof params?.hostId === 'string'`），未实际失守 | AC-20 的机检原文即「不出现 `if host ==` / `switch (host)`」，用例对该字面形态是强的；缺口属加固建议 |
| **S-4** | `:749-760` | AC-05「实例目录无完整日志副本」只认 `.log` 后缀与 `host-logs/` 目录；改名为 `.txt` / `.jsonl` 的整份副本不会被抓 | 真实宿主日志形态为 `.log`（需求 AC-04 写明 `host-logs/T-001.log`）；同 AC 的「摘要只存四项」由 WP-7 用例覆盖 |
| **S-5** | `:527-542` | `USAGE_LINES` 只冻结「25 行 + 前 8 行 + 末行」，中间 9–23 行未在本文件断言 | 已由 `test/wp12/cli-assets.test.js:121` 的整表 `deepEqual` 覆盖，无覆盖空档；建议注释标明互补来源 |
| **S-6** | `:686-709` | 事件链用例只读 `events.jsonl` 磁盘真源，未覆盖 AC-02 的「两实例链互不串接」与 AC-01 的「中途追加后旧行字节不变」 | 这两条由 WP-2 的 `test/wp9/i19-chain.test.js` 承担；本文件定位是跨批次回归守护，建议在头注释的覆盖表显式标注分工 |
| **S-7** | `git status` | `docs/iterations/iteration-9/decisions.md` 有 +9 行（D-24）未提交，不属 WP-9 负责文件 | 内容是裁决记录且被本报告当作判据引用（时间戳晚于实现），判断为裁决层写入；建议批次提交时与其他 docs 一起单列 |

### 7.3 与实现者自述的差异（以我实跑为准）

| 自述 | 我的实测 |
|---|---|
| 8 用例约 48–55s | 空闲机器 **47.8s**；负载下 67.1s（当时 233 个历史孤儿 core 进程），属环境差异，认可 |
| 基线取自 `review-wp7-r2` + `NFR-03.output.json` | **成立**，且我用更早的 `70277df` 树独立复核为逐字相等（§3.3/§3.4） |
| 31 词表「D-6 登记表」 | **成立**，与 `test/wp11/purity.test.js` 的 `WORDS_31` 逐项同序 |
| `object: 'session'` ≤13 | **成立**（orchestrator 13 / core 14 / daemon 0），与 D-24 口径一致 |

---

## 8. 结论

**PASS（阻断 0 / 建议 7）**

- 8 个用例全部可证伪：三主链在「新增行 / 文案变化 / 行序打乱」三种变异下**均变红**（控制组绿）；
- 三主链、`status`、`graph` 三套基线均由**两棵独立树**（`322fb5e`、`70277df`）实跑复核为逐字相等，**排除自证**；
- 静态门禁是真跑工具（purity exit 0）、真计数（deps 0 / USAGE 25 / session 13），无弱化实现；
- 事件链独立实现 `canonicalize` 并逐条复算哈希，首条 64 个 `0`、seq 连续、每会话恰 1 条摘要、traces 恰 7 字段；
- 无仓库外固定路径、无 `sleep` 凑时序、无进程 / 目录泄漏、未越界改文件。

---

## 9. 声明

本评审**未修改任何产品代码与测试代码**，**未执行 `git commit` / `git add` / `git stash`**；工作区内唯一写入为 `docs/iterations/iteration-9/review-wp9.md`。所有变异实验在 `/tmp/r9-mut` 的仓库副本内完成（副本不含 `.git`），所有对照运行使用 `/tmp/i19-wp7-baseline`（`322fb5e`）与 `git archive 70277df` 导出的 `/tmp/r9-i17` 只读树；评审期间由我启动的夹具核心均已 `core stop` / 结束，工作区 `git status` 与本报告开始前一致。
