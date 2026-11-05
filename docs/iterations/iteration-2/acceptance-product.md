# I1.2 验收记录（真实 DSH 面）

> 独立验收工程师（真实 DSH 面）｜唯一验收依据：`docs/iterations/iteration-2/requirement.md` **v15 定稿（第八轮矫正）**｜执行日期 2026-11-05
> 范围：AC-01 / AC-03 / AC-21 / AC-22 / AC-45，以及 §3.2 中需要真实宿主的 NFR 项。
> 夹具面（`AC-02..AC-46` 的其余编号、I1.1 的 AC-15~25 / AC-26）由主 Agent 并行负责，本报告不覆盖、不修改其产物；`acceptance-fixture.md` 全程未改动。
> 本报告只新增本文件、`evidence/` 下上述 5 个 AC 编号与 `NFR-0xx-real` 前缀的文件、`probe/acc2-p-final.mjs`；未改 `src/**`、`test/**`、`bin/**`、`package.json`、`requirement.md`、`docs/index.md`、`review-round1.md`；未 `git commit`。

---

## 0. 总判（5 条：通过 5 / 不通过 0 / 阻塞 0 ｜ NFR-01a / 01b / 02 通过）

| AC | 判定 | 一句话结论 |
|---|---|---|
| AC-01 | **通过** | 一条 `code-loop` 命令跑通闭环，两节点 T-001→T-002 顺序正确，输出段序与 state/events 全吻合 |
| AC-03 | **通过** | 第 1 次测试判定"通过"，`已完成`、2 节点、handoffs 恰好 1 条 forward、末行"升级 —" |
| AC-21 | **通过** | 不带 `--template` 的 `single` 输出逐字保持 I1.1 形态（动态值除外），全文不含"模板" |
| AC-22 | **通过**（真实面抽查口径） | 抽查 I1.1 的 6 条关键 AC，真实面全通过；夹具面由主 Agent 覆盖，本次不重复 |
| AC-45 | **通过** | 真实回流闭环一次跑通：`verdict.read(fail)` seq=87 夹在 T-002 第 1 轮派发(21) 与 T-001 第 2 轮派发(93) 之间 |

- **冒烟门**：最小 `orch run --template code-loop` 真实面一次跑通（`exitCode 0`、`state=completed`），未触发"立即停止"条件，全程未使用 mock。
- **NFR**：NFR-01a 10 次取最大 210.86ms（≤5s）；NFR-01b 冷启动口径 max 14ms（≤30s）、用户可感知冷启动 spawn→三行 2329.96–2556.93ms；NFR-02 239ms（≤1s）。均通过。NFR-03~09 属夹具面/状态机口径，由主 Agent 夹具验收覆盖（见 §2）。
- **AC-45 重试次数：0**（第 1 次即成功），其余 AC 各 0 次，冒烟 1 次。

---

## 1. AC 逐条记录（含真实耗时）

### 公共约定
- 所有命令在 **Git Bash**、仓库根 `d:/WWW/Maestro` 下执行。采集器 `probe/acc2-p-run.mjs` 已先通读再传参：它内部设 `DSH_HOME=<隔离 home>`、`ELECTRON_RUN_AS_NODE=1`，并 `delete` 掉 `MAESTRO_DSH_EXE/MAESTRO_DSH_BIN/MAESTRO_DSH_ARGS/MAESTRO_TEST_PAUSE/MAESTRO_TEST_STOP_AFTER/MAESTRO_FAULT/MAESTRO_PERMISSION_POLICY`；以 `node bin/orch.js`（绝对路径）发起，落盘 `.output.txt/.stderr.txt/.lines.json/.state.json/.events.jsonl/.status.txt/.status-events.txt/.meta.json`。
- 场景目录由 `node probe/acc2-p-setup.mjs` 幂等生成（只覆盖样例文件，不清 `.orch`）。执行前发现 `proj-smoke` 留有上一轮被打断的 `INST-001`（`state=running`、T-002 执行中）脏数据，已删除该根 `.orch`，保证"全新项目根 + 独立实例号"。
- `--stop-core` 使每条采集结束即 `orch core stop`；每批后 `tasklist | grep -i node` 自查。
- `产物：` 的冒号为中文全角 `：`；AC-01/03/45 任务话术按 §3.3（必含 `产物：calc.js` 行）。

### 冒烟门（前置，SMOKE / `proj-smoke` / INST-300）

完整命令（可复制）：
```bash
node probe/acc2-p-run.mjs --label SMOKE --root "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/proj-smoke" --cwd demo-code-pass --template code-loop --instance INST-300 --task "给 calc.js 补 div 函数，让 node --test 全绿；产物：calc.js" --out "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/smoke" --stop-core
```
原始输出摘要（`%TEMP%/maestro-acc-p2/smoke/SMOKE.output.txt`，40 行）：第 1–3 行 `实例 INST-300 · 运行中 · 模板 编码闭环` / `会话已创建 c8763c71-…` / `任务已投递`；第 34–35 行两节点 `已完成`；第 36–39 行交接包四状态；第 40 行 `升级 —`。
`state.json`：`state=completed`、`nodes=[T-001 developer r1 done, T-002 tester r1 done verdict pass]`、`handoffs=[HO-001 forward consumed]`。
判定：**通过**（真实 DSH + 真实模型跑通，未用 mock，不阻塞）。`spawnToThreeLinesMs=3595.707`、`spawnToTerminalMs=82741.6928`。

---

### AC-01 发起闭环，两节点建好且首个执行的是开发

完整命令（可复制）：
```bash
node probe/acc2-p-run.mjs --label AC-01 --root "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/proj-ac01" --cwd demo-code-pass --template code-loop --instance INST-301 --task "给 calc.js 补 div 函数，让 node --test 全绿；产物：calc.js" --stop-core
```
原始输出（`evidence/AC-01.output.txt`，37 行，判定相关行原文）：
```
1  实例 INST-301 · 运行中 · 模板 编码闭环
2  会话已创建 2045d3c7-143c-4d66-9abf-40be1fa499cc
3  任务已投递
4-30  全部为 "会话 …" 状态行（含 "会话 等待审批：pwsh"，真实宿主自然行为），无 "节点 T-" 行
31 节点 T-001 开发 已完成 · 第 1 轮 · 耗时 15s
32 节点 T-002 测试 已完成 · 第 1 轮 · 耗时 33s · 判定 通过
33-36 交接包 HO-001  开发→测试  已构造/已投递/已接受/已完成（各 1 行，带时间戳）
37 升级 —
```
`state.json` 关键字段（`evidence/AC-01.state.json`）：`template='code-loop'`、`state='completed'`、`nodes.length=2`、`nodeId` 依次 `T-001/T-002`、`halted=false`、`escalations=[]`。
`events.jsonl` 相关行（`evidence/AC-01.events.jsonl`）：
```
1  {"object":"instance","objectId":"INST-301","from":"created","to":"running","reason":"run.started","seq":1,"ts":"2026-11-05T13:32:42.498Z"}
2  {"object":"node","objectId":"T-001","from":"pending","to":"running","reason":"node.dispatch","detail":{"round":1,...},"seq":2,"ts":"2026-11-05T13:32:42.508Z"}
15 {"object":"node","objectId":"T-002","from":"pending","to":"running","reason":"node.dispatch","seq":15,...}
40 {"object":"node","objectId":"T-002","reason":"verdict.read","detail":{"verdict":"pass"},"seq":40,...}
```
逐条核对：第 1 行匹配 `实例 INST-\d+ · 运行中 · 模板 编码闭环`（v15 写死 `INST-001`，本次按"独立实例号"要求用 `INST-301`，按语义/正则判定）；第 2/3 行匹配 `^会话已创建 \S+$` / `^任务已投递$`；结束段"两行节点 → 至少一行交接包 → `升级 —`"一致；首条 `object='node' to='running'` 是 seq2 的 T-001，不存在更小 seq 的 T-002 running（T-002 在 seq15）；`.orch/workflows` 执行前后均不存在（Bash 核实）。
判定：**通过**。`spawnToThreeLinesMs=2329.9558`、`spawnToTerminalMs=48780.2792`。

---

### AC-03 测试通过后闭环完成

完整命令（可复制）：
```bash
node probe/acc2-p-run.mjs --label AC-03 --root "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/proj-ac03" --cwd demo-code-pass --template code-loop --instance INST-302 --task "给 calc.js 补 div 函数，让 node --test 全绿；产物：calc.js" --stop-core
```
原始输出（`orch status --instance INST-302`，由采集器落 `evidence/AC-03.status.txt`，9 行）：
```
1 实例 INST-302 · 已完成 · 模板 编码闭环
2 节点 T-001 开发 已完成 · 第 1 轮 · 耗时 30s
3 节点 T-002 测试 已完成 · 第 1 轮 · 耗时 19s · 判定 通过
4 会话 空闲
5-8 交接包 HO-001  开发→测试  已构造/已投递/已接受/已完成
9 升级 —
```
`state.json` 关键字段（`evidence/AC-03.state.json`）：`state='completed'`、`nodes.length=2`、`nodes[1].state='done'`、`verdict.value='pass'`、`handoffs` 恰好 1 条 `HO-001 edge.kind='forward' state='consumed'`、`escalations=[]`。
`events.jsonl` 相关行：`run.started` seq1 → `node.dispatch`(T-001) seq2 → `node.dispatch`(T-002) seq15 → `verdict.read(pass)` → `run.completed`。
判定：**通过**（第 1 行"已完成"、`^节点 T-002 测试 已完成 · 第 1 轮 · 耗时 \S+ · 判定 通过$` 命中、1 张 forward 交接包、末行"升级 —"）。`spawnToThreeLinesMs=2556.9338`、`spawnToTerminalMs=49769.0212`。

> **口径待澄清（登记，不改判）**：任务描述把 AC-03 简写为"两节点、3 张交接包"，但 v15 AC-03 第 592 行明写 `机检：handoffs 恰好 1 条（HO-001 开发→测试）`。实测成功闭环（第 1 次测试即通过、无回流）确实只有 1 张交接包；3 张（forward/backflow/retest）是 **AC-45 回流场景**的形态。按唯一验收依据 v15 判定通过，此处登记差异，不判不通过。

---

### AC-21 不带模板时，run 的输出与 I1.1 一致

完整命令（可复制；**不带 `--template`、不带"产物："行**）：
```bash
node probe/acc2-p-run.mjs --label AC-21 --root "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/proj-ac21" --cwd demo --instance INST-303 --task "写一段 200 字的产品说明，保存到 out/intro.md" --stop-core
```
原始输出（`evidence/AC-21.output.txt`，17 行，全文）：
```
1  实例 INST-303 · 运行中
2  会话已创建 5378212d-d370-4696-b0a8-cee2480534b0
3  任务已投递
4  会话 空闲
5-10 会话 执行中 · 调用工具（pwsh/write/read）· 已运行 Ns
11 会话 等待下游 · 产出已提交
12 会话 空闲
13 节点 已完成 · 耗时 24s
14 交接包 HO-001  已构造   21:34:39
15 交接包 HO-001  已投递   21:34:39
16 交接包 HO-001  已接受   21:34:41
17 交接包 HO-001  已完成   21:35:00
```
**逐字对照 I1.1 §2.2 的六行基线**（`docs/iterations/iteration-1/requirement.md` 第 102–108 行）：

| # | I1.1 基线 | AC-21 实际 | 结论 |
|---|---|---|---|
| 1 | `实例 INST-001 · 运行中` | `实例 INST-303 · 运行中` | 一致（不带"模板"；实例号/动态值） |
| 2 | `会话已创建 sess-xxxx` | `会话已创建 5378212d-…` | 一致（sessionId 动态值） |
| 3 | `任务已投递` | `任务已投递` | **逐字一致** |
| 4 | `会话 执行中 · 已运行 3s` | `会话 执行中 · 调用工具（pwsh） · 已运行 4s` 等 6 行 + `会话 空闲` | 形态一致（会话状态行，带已运行时长；多帧刷新） |
| 5 | `会话 等待下游 · 产出已提交` | `会话 等待下游 · 产出已提交` | **逐字一致** |
| 6 | `节点 已完成 · 耗时 1m12s` | `节点 已完成 · 耗时 24s` | 一致（耗时动态值） |

补充：全文**不含"模板"**二字；第 1 行严格等于 `实例 INST-303 · 运行中`（不带"· 模板 …"）；段序符合附录 A-1（实例 1 → 会话已创建 1 → 任务已投递 1 → 会话状态行 N → 会话收尾 → 节点行 1 → 交接包行 4）；交接包 HO-001 的"已构造/已投递/已接受/已完成"各 1 行。无 `节点 T-00x`、无"升级 —"。
`state.json`（`evidence/AC-21.state.json`）：`state='completed'`、`nodes.length=1`（`T-001 worker r1 done`）、`handoffs` 1 条（`HO-001`，single 模式 `edge=null`，`state='consumed'`）。
判定：**通过 —— single 输出逐字保持 I1.1 形态（仅动态值变化）**。`spawnToThreeLinesMs=2355.633`、`spawnToTerminalMs=23831.198`。

---

### AC-22 I1.1 的既有验收仍通过（混合：真实面抽查 + 夹具面由别人做）

**抽取方式**：v15 AC-22 把 I1.1 的 26 条 AC 分成"产品面 AC-02~14 / 夹具面 AC-15~25 / AC-26 改用例"。本次真实面从**产品面能在真实 DSH 上不依赖夹具时序稳定复现**的条目里，按"主流程 + 高价值异常"抽取 6 条：I1.1 **AC-01**（单节点成功）、**AC-02**（status 查四类状态）、**AC-07**（重复发起被拒 / NODE_BUSY）、**AC-13**（损坏不清空）、**AC-14**（事件时间线）、**AC-12**（core stop 后不偷偷重跑）。夹具面（AC-15~25、AC-26）由主 Agent 的夹具验收覆盖，本报告不重复、不碰 `maestro-acc-f2/` 与 `probe/acc2-f-*.mjs`。

底稿完整命令（可复制）：
```bash
node probe/acc2-p-run.mjs --label AC-22 --root "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/proj-ac22" --cwd demo --instance INST-304 --task "写一段 200 字的产品说明，保存到 out/intro.md" --stop-core
node probe/acc2-p-final.mjs      # 补充验证：AC-13 / AC-12 / AC-07 + NFR 计量
```
底稿原始输出（`evidence/AC-22.status.txt`、`AC-22.status-events.txt`）：
```
实例 INST-304 · 已完成
节点 已完成 · 耗时 32s
会话 空闲
交接包 HO-001  已构造/已投递/已接受/已完成
（--events 追加 23 行时间线，每条含对象/时间/从→到/原因，如
 21:35:34  节点 T-001  待校验 → 已完成  原因 verification.passed）
```
`state.json`（`evidence/AC-22.state.json`）：`state='completed'`、单节点 `T-001 worker r1 done`、单交接包 `consumed`。

补充验证逐条（`probe/acc2-p-final.mjs`，均为真实面产品命令，证据落在 `evidence/AC-22.*`）：

| I1.1 AC | 手法 | 实际输出（原文） | 判定 |
|---|---|---|---|
| AC-01 单节点成功 | AC-22 底稿 single 闭环 | `实例 INST-304 · 已完成` + `节点 已完成 · 耗时 32s` + 交接包四状态 | 通过 |
| AC-02 查四类状态 | `orch status --instance INST-304` | 实例 / 节点 / 会话 / 交接包四类齐全（`AC-22.status.txt`） | 通过 |
| AC-07 重复发起被拒 | 同实例 `INST-306` 真实 single 长任务执行中（延迟 3s）再发第二次 `run --instance INST-306` | P2 输出 `该节点正在执行，本次未发起`，退出码 **1**；P1 正常跑完（`AC-22.AC-07.*`） | 通过（与 I1.1 期望逐字一致） |
| AC-13 损坏不清空 | 把 `INST-304/state.json` 写成 `{"broken": ` 后 `orch status --instance INST-304` | `状态不可读，已备份为 state.json.corrupt（…\state.json.corrupt）`；`.corrupt` 存在且内容=`{"broken": `（原损坏内容未被清空/覆盖）；退出码 1（`AC-22.AC-13.*`） | 通过 |
| AC-12 不偷偷重跑 | `orch core stop` 后重查 | `events.jsonl` 前后逐字节相同（行数不变、无新 `node.dispatch`），首行仍 `实例 INST-304 · 已完成`（`AC-22.AC-12.*`） | 通过 |
| AC-14 时间线可追溯 | `orch status --instance INST-304 --events` | 23 行按时间戳可读，含对象/时间/迁移/原因（`AC-22.status-events.txt`） | 通过 |

判定：**通过（真实面抽查口径）**。`spawnToThreeLinesMs=2499.976`、`spawnToTerminalMs=32774.0693`。
> 范围声明：v15 AC-22 的"夹具面通过"与"AC-26 改用例"不在本次真实面抽查内，故本结论是"真实面抽查通过"，不是 v15 全量 AC-22 的完整结论；完整结论需与夹具面报告合并。

---

### AC-45 真实宿主上的"第 1 轮不通过 → 回流 → 第 2 轮通过"闭环

完整命令（可复制；话术逐字取 v15 AC-45 的 `When` 行，含 `产物：calc.js` 全角行）：
```bash
node probe/acc2-p-run.mjs --label AC-45 --root "C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/proj-ac45" --cwd demo-code-fail --template code-loop --instance INST-305 --task "给 calc.js 补一个 div 函数：返回 a 除以 b 的商，只覆盖 calc.test.js 里的基础断言。不要修改 calc.test.js；第 1 轮按「只处理正常输入」实现，不写除数为 0 的边界；若收到回流缺陷（要求补除零边界），以回流交接包中的缺陷与复测要求为准。产物：calc.js" --stop-core
```
原始输出（`evidence/AC-45.output.txt` 共 116 行；`evidence/AC-45.status.txt` 17 行，节点/交接包段原文）：
```
1   实例 INST-305 · 运行中 · 模板 编码闭环
102 节点 T-001 开发 已完成 · 第 2 轮 · 耗时 3m58s
103 节点 T-002 测试 已完成 · 第 2 轮 · 耗时 5m2s · 判定 通过
104-107 交接包 HO-001  开发→测试  已构造/已投递/已接受/已完成（21:37:16~21:40:19）
108-111 交接包 HO-002  测试→开发（回流）  已构造/已投递/已接受/已完成（21:40:20~21:40:51）
112-115 交接包 HO-003  开发→测试（复测）  已构造/已投递/已接受/已完成（21:40:51~21:42:18）
116 升级 —
```
`state.json` 关键字段（`evidence/AC-45.state.json`、`AC-45.assertions.json`）：`state='completed'`、`exitCode=0`、`nodes.length=2`、`nodes[0].round=2 / done`、`nodes[1].round=2 / done / verdict.value='pass'`、`noRound3=true`、`handoffs` 恰好 3 条且 `edge.kind` 依次 `forward / backflow / retest`、`state` 全 `consumed`（HO-002 带 `defects=1`）、`escalations=[]`、`sessions` 中 `nodeId='T-001'` 两条 `sessionId` 不同（`5536c3db-…` / `0c91b0e5-…`）。

`events.jsonl` 相关行（**实测序列**，来自 `AC-45.assertions.json`）：
```
seq 2   node.dispatch  T-001 round1  13:36:53.120Z   （开发第 1 轮派发）
seq 21  node.dispatch  T-002 round1  13:37:16.175Z   （测试第 1 轮派发）
seq 87  verdict.read   verdict=fail, path=out/verdict.json  13:40:19.875Z  ← 真实判定失败
seq 93  node.dispatch  T-001 round2  13:40:20.114Z   （回流后开发第 2 轮派发）
seq 117 node.dispatch  T-002 round2  13:40:51.190Z   （复测派发）
seq 157 verdict.read   verdict=pass  13:42:18.490Z
```
**用户指定的 seq 断言**：`verdict.read(fail)` 的 seq=**87**，大于 T-002 第 1 轮派发 seq=**21**、小于 T-001 第 2 轮（回流后，整轮第 3 次派发）seq=**93** → `21 < 87 < 93` 成立，证明回流出自真实测试判定失败，不是夹具造假。
其余断言：`status.txt` 第 3 行 `节点 T-002 测试 已完成 · 第 2 轮 · 耗时 5m2s · 判定 通过` 命中正则、末行 `升级 —`、无 `round=3`、T-001 两轮会话不同。
判定：**通过（第 1 次尝试即成功，0 次重试）**。`spawnToThreeLinesMs=2362.7335`、`spawnToTerminalMs=325709.9948`（≈5m26s，4 个真实 turn）。
> 未改实现、未改 mock；真实模型按话术第 1 轮只做基本 `div` → `div(1,0)` 断言真实失败 → 测试如实写 `fail` + 缺陷 → 核心回流 → 第 2 轮补齐边界 → 复测通过。

---

### 真实耗时汇总（严格计时，单位 ms）

| 运行 | 实例 | 项目根 | spawn → 三行 | spawn → 终态 | 终态 |
|---|---|---|---:|---:|---|
| SMOKE | INST-300 | `proj-smoke` | 3595.707 | 82741.6928 | completed |
| AC-01 | INST-301 | `proj-ac01` | 2329.9558 | 48780.2792 | completed |
| AC-03 | INST-302 | `proj-ac03` | 2556.9338 | 49769.0212 | completed |
| AC-21 | INST-303 | `proj-ac21` | 2355.633 | 23831.198 | completed |
| AC-22 | INST-304 | `proj-ac22` | 2499.976 | 32774.0693 | completed |
| AC-45 | INST-305 | `proj-ac45` | 2362.7335 | 325709.9948 | completed |

---

## 2. 非功能项

按 §3.2 表格判断"需要真实宿主"的项：**NFR-01b**（首次派发，冷启动=DSH 未拉起，必须真实 DSH）、**NFR-02**（`verdict.read` 到回流派发，只有 AC-45 真实回流才产生该事件）；**NFR-01a**（核心冷启动）为真实面产品命令可测，一并给出。NFR-03~09 的"怎么测"直接引用 AC-09/10/11/12 或 5 个夹具场景，属夹具面/状态机口径，由主 Agent 夹具验收覆盖，本次不重复、不伪造。

| 编号 | 口径 | 实测 | 目标 | 判定 |
|---|---|---|---|---|
| **NFR-01a** | `orch core stop` 后 `time orch status > /dev/null`，**10 次取最大** | 10 次：202.64 / 196.57 / 199.02 / 190.44 / 188.34 / 186.81 / 210.86 / 193.69 / 200.82 / 205.83 ms，**max 210.86 ms**（`NFR-01a-real.json`） | ≤5 s | **通过** |
| **NFR-01b** | `events.jsonl` 中 `run.started` → 首个 `node.dispatch` 的 ts 差，冷启动 30 s | 4 个有效 code-loop 样本：SMOKE 8ms、AC-01 10ms、AC-03 14ms、AC-45 10ms，**max 14 ms**；用户可感知冷启动 spawn→三行 2329.96–2556.93ms（`NFR-01b-real.json`） | 冷 ≤30 s / 热 ≤5 s | **通过（冷启动口径）** |
| **NFR-02** | `verdict.read` → 紧随 `node.dispatch` 的 ts 差 | AC-45：`verdict.read(fail)` seq87 13:40:19.875Z → 回流派发 seq93 13:40:20.114Z，**239 ms**（`NFR-02-real.json`） | ≤1 s | **通过** |

**NFR-01b 口径诚实声明**：
1. v15 的事件差口径测的是核心内部 `run.started`→`node.dispatch`（8–14ms），**不含 DSH 进程从零拉起**；真正"敲下命令到看见执行中"的用户可感知冷启动是 `spawnToThreeLinesMs`（2.33–2.56s，含 DSH 冷拉起），两者都给出、均为实测，未混充。
2. 每条采集前均 `orch core stop`（DSH 子进程关闭），故 6 行样本全部为"冷启动"口径；**热启动**（DSH 已拉起后的首次派发）因每条 AC 必须用独立项目根、必须重新拉起 DSH，本次未单独隔离构造，**不给热启动数字**（不伪造）。
3. 需求写"10 次取最大"，本次真实面只跑出 6 行（其中 AC-21/22 为 single 模式，节点派发合并进 `reason='run.started'`、无独立 `node.dispatch`，故那两行 `deltaMs=null`，非失败/非缺失记录；有效样本 4 条）。真实闭环单条 49–326s，为控制平台限流未凑满 10 次，**如实标注、未补造**。

**NFR-03~09 归属**：连跑 5 闭环 / 挂起不自动动 / 重启查全 / 取消 5s / 100 次查询不多跑 / 关窗口不带走 / 挂起不卡（退出码 4）——均为夹具面或核心状态机口径（§3.2 明确引用 AC-09/10/11/12），由主 Agent 夹具验收覆盖；本次真实面未改这些断言，也未把夹具结果写成真实结果。

---

## 3. 未通过项汇总

**无。5 条 AC 全部通过，0 不通过、0 阻塞；负责的 NFR 全部通过。** 以下为如实登记的**口径/范围待澄清项**（不构成不通过）：

1. **AC-03「3 张交接包」表述差异**：任务描述简写为 3 张，v15 AC-03 明写"恰好 1 条"，实测成功闭环 1 张；3 张是 AC-45 回流场景。按唯一依据 v15 判定通过（详见 §1 AC-03 注）。
2. **NFR-01b 采样次数与冷热分离**：未凑满 10 次、热启动未单独隔离构造，已在 §2 如实标注；冷启动 30s 目标有 4 个有效样本 + 用户可感知耗时佐证。
3. **AC-22 为混合验证面**：本次仅做真实面抽查 6 条（另含夹具面未做的声明），不是 v15 全量 AC-22 结论；完整结论需与 `acceptance-fixture.md` 合并。
4. **真实宿主出现 `会话 等待审批：pwsh`**：AC-01/AC-03 输出中真实 DSH 对 `pwsh` 工具发起了审批态并自行恢复（v15 §3.3 只说"写 cwd 内文件不触发审批"，未覆盖 shell 工具）。这是真实面自然行为，不影响任何 AC 断言，如实记录、未据此改判。

---

## 4. 环境与口径声明

| 项 | 值 |
|---|---|
| 唯一依据 | `docs/iterations/iteration-2/requirement.md` **v15 定稿（第八轮矫正）**（第 4 行确认） |
| 执行日期 / 主机 | 2026-11-05，Windows 11 / Git Bash，系统 Node **v22.22.2** |
| DSH 版本 | `0.2.1-rc.5`（`docs/iterations/iteration-1/dsh-probe.md` 实测记录），可执行文件 `C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe`；Electron 内置 Node v24.21.0 |
| **模型路由** | **真实账号路由 `deepseek-account` / `deepseek-flash`**（非 mock）。`dsh-home/profiles/acp/cordis.patch.yml` 两行 `agent-default-model` 与 `acp` 均改为该值；`logs/dump-config.patched.txt` 第 57–61 行、第 380–386 行证实生效，与 `dsh-probe.md` §1.2 对照一致 |
| **DSH_HOME 隔离** | `C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/dsh-home`（采集器内设，未读/未写 `~/.dsh`）；`~/.dsh/.credentials.yaml` mtime 全程保持 **Nov 3 22:41**，未被修改 |
| 凭据副本 | 开工前存在 `.credentials.yaml` / `.anonymous-user-id`（自 `~/.dsh` 复制）；**收尾已删除**，保留 `profiles/acp/` 复现模板与 `sessions/`、`storages/` |
| **项目根（全在 `%TEMP%`，不在仓库目录）** | `C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p2/` 下 `proj-smoke`、`proj-ac01`、`proj-ac03`、`proj-ac21`、`proj-ac22`、`proj-ac45`；避免 `D:\WWW\Maestro` 触发 DSH 沙箱 ACL 修复把 turn 拉到 24.8s（`dsh-probe.md` §6 第 6 条） |
| 场景目录 | `node probe/acc2-p-setup.mjs` 幂等生成；`demo-code-pass`（AC-01/03）、`demo-code-fail`（AC-45，含 `div(1,0)` 额外断言）、`demo`（AC-21/22 single） |
| 实例号 | 每条独立：`INST-300`(SMOKE) / `301` / `302` / `303` / `304` / `305`；AC-22 补充验证另用 `INST-306`（重复发起用） |
| 采集器 | `probe/acc2-p-run.mjs`（先通读再用，未改实现）；补充验证/计量脚本 `probe/acc2-p-final.mjs`（本次新增） |
| **重试次数** | **AC-45：0 次**（第 1 次即成功，未触发"最多 3 次重试"）；AC-01/03/21/22 各 0 次；冒烟 1 次通过。无改实现、无改 mock 凑过 |
| 核心清理 | 每条采集带 `--stop-core`；补充脚本收尾再次 `orch core stop`；每批 `tasklist \| grep -i node` 自查。最终仅剩 3 个 WorkBuddy 平台常驻 `node.exe`（PID 24660 edge-sync / 26480 sheetagent MCP / 9936 weixinpay MCP，**非 Maestro 核心**，附命令行证据），无 Maestro 孤儿 |
| evidence 落盘 | 只写 `AC-01.*` / `AC-03.*` / `AC-21.*` / `AC-22.*` / `AC-45.*` / `NFR-01a-real.json` / `NFR-01b-real.json` / `NFR-02-real.json`。夹具面已写的 `NFR-01b.{events.jsonl,meta.json,output.json,state.json}`（mtime 21:17）**未被覆盖**；`acceptance-fixture.md`、`review-round1.md` 未动 |
| 未触碰 | `src/**`、`test/**`、`bin/**`、`package.json`、`requirement.md`、`docs/index.md`、`acceptance-fixture.md`、`review-round1.md`、`maestro-acc-f2/`、`probe/acc2-f-*.mjs`；未 `git commit`。注：`git status` 中 `src/**`/`test/**` 等文件的 `M` 是主 Agent 并行修复夹具面缺陷所致，**非本次验收操作**；本次验收全程只用 `Write`/`Edit` 写上述新增文件 |
