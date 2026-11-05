# I1.2 实现评审（第 2 轮：阻断项处置与验收复核）

> 评审人：主 Agent（集成收口） ｜ 基准：`docs/iterations/iteration-2/requirement.md` **v16** ｜ 上一轮：`review-round1.md`（独立评审子 Agent，v15，2 个阻断项） ｜ 时间：2026-11-05
> 本轮不重新逐条审 44 条 AC，只核「第 1 轮阻断项 + 验收阶段暴露的缺陷」是否真被修掉，并给最终可收口判定。

## 0. 总判

**阻断 0，可进入收口。** 第 1 轮 2 个阻断项全部修复并实测；验收首轮暴露的 5 条未通过/阻塞项全部定位到根因并复验通过；需求为修正 AC-15 观测点升到 v16（4 条 Then 逐字保留）。

| 判定项 | 结果 | 证据 |
|---|---|---|
| 有效 AC | **44 通过 / 0 不通过 / 0 阻塞** | `acceptance-product.md` 5/5（真实 DSH）＋ `acceptance-fixture.md` 39/39（mock） |
| NFR | 夹具可测 6 项 + 真实面 3 项全通过 | 两份验收报告 §2 |
| 全量测试 | **337 / 337** | `node --test "test/**/*.test.js"` |
| AC-28 架构扫描 | **exit 0**（14 文件、四词零命中） | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator` |
| `single` 回归 | 逐字保持 I1.1 | AC-21 真实面 + `review-round1.md` §H25 独立实测 |

## 1. 第 1 轮 2 个阻断项的处置

### BLK-01（AC-28 架构检查）

- **现象**：`test/fixtures/purity-check.mjs` 不存在；`src/core/state-machine.js:87/:89` 注释含 `developer` / `tester`；`fake-graph.test.js` 对 `state-machine.js` 设了豁免，故 12/12 绿是假绿。
- **处置**：
  1. 新增 `test/fixtures/purity-check.mjs`：按 AC-28 的 `--dirs` / `--forbid` 扫描两个目录下所有文本文件（注释算命中），命中打印 `文件:行 命中 词 — 原文` 并 exit 1，零命中 exit 0；支持 `--json`；扫描范围外（`src/templates/**`、`test/**`、`docs/**`）天然不计。
  2. `src/core/state-machine.js:87/:89` 两条注释去掉角色名，改为 `Reopened by a backflow wake-up` / `Reopened by a retest dispatch`。
  3. `test/templates/fake-graph.test.js` 删除 `state-machine.js` 豁免，改为 `assert.deepEqual(hits, [])`。
  4. `src/cli/main.js:506` 注释同步（仅注释）。
- **实测**：`OK: 扫描 14 个文件，src/core, src/daemon 内 code-loop, developer, tester, coordinator 零命中`，`EXIT=0`；全量 337/337 仍绿。

### BLK-02（AC-42 二次取消文案）

- **现象**：第二次 `orch cancel` 走 `CODES.INSTANCE_TERMINAL`，输出 `实例已结束（已取消），本迭代不支持重跑`；`CANCEL_NOT_NEEDED` 在 `labels.js` 里已定义但全 `src` 无业务引用。
- **处置**：
  1. `src/core/error-map.js` 的 `CODES` 与 `ERROR_TEXT_KEY` 各补 `CANCEL_NOT_NEEDED`（I1.1 的 9 条原文与 `INSTANCE_TERMINAL` 一字未改）。
  2. `src/core/orchestrator.js` 的 `cancel()` / `cancelLive()` 两处终态分支改用 `CODES.CANCEL_NOT_NEEDED`；**`startRun --instance` 的 `INSTANCE_TERMINAL` 分支保持不动**。
  3. `test/wp4/orchestrator.test.js:389` 断言同步为 `CANCEL_NOT_NEEDED`（D-8 合法改写）。
- **实测**：`renderError({code:'CANCEL_NOT_NEEDED',params:{state:'已取消'}})` → `实例已结束（已取消），无需取消`；`exitCodeFor('CANCEL_NOT_NEEDED')` → `1`；`{state}` 在 `PLACEHOLDERS` 白名单内，无 `{...}` 残留。AC-42 复验通过。

## 2. 验收阶段暴露的 5 项（首轮夹具面 34/39）

| AC | 首轮 | 根因归属 | 修复 | 复验 |
|---|---|---|---|---|
| AC-14 | 不通过 | **产品 + 夹具** | `src/core/verdict.js` 的 `parseVerdict` 去掉 `?? document.result`（§3.3 要求 `verdict` 严格 `pass`/`fail`）；`code-loop-driver.mjs` 把 `verdict-no-field`（`{"defects":[]}`）与 `verdict-maybe`（`{"verdict":"maybe","defects":[]}`）拆成两个独立样本 | 24/24 |
| AC-15 | 不通过 | **需求观测点不可构造** | 需求升 v16，见 §3 | 8/8 |
| AC-25 | 阻塞 | **夹具** | `attempt-transition.mjs` 的 `readObjectState` 支持 v2 `nodes[]` / `handoffs[]`，按 `--node` / `--handoff` 定位；usage 同步 | 3/3 |
| AC-31 | 不通过 | **产品锁粒度** | `startRun` 在取 `@dir:` 锁前，对活 `code-loop` 实例无锁快拒 `INSTANCE_RUNNING`；`single` 保持 I1.1 `NODE_BUSY`（`test/wp4/orchestrator.test.js:290` 未受影响） | 14/14 |
| AC-32 | 不通过 | **产品锁粒度** | `seamDispatch` 在取实例锁前读磁盘判 `isNodeBusyState`，无锁快拒 `NODE_BUSY` | 5/5 |

**锁问题的根因（AC-31/32 共用）**：`dispatchInState` 先把 `node.state='running'` 落盘再 `createAdapter()`；mock 在 `session/new` 前 hold 时，`advance` / `startRun` 的写锁被长期持有，后到的 `run.start` / `test.dispatch` 排队到 IPC 超时（诊断探针 `probe/acc2-f-probe.mjs` 证实同窗口 `orch status` 读类 99ms 正常）。修复采用「**忙检查放在锁之前**」，不缩小写锁的临界区，因此不触碰 CAS 与落盘顺序。

**AC-14 的口径核实**：真实面 AC-45 的 `out/verdict.json` 是 `{"verdict":"pass","defects":[]}`，用的是 `verdict` 字段；去掉 `result` 别名不影响真实宿主，也不影响其余 38 条夹具 AC（全量重跑 39/39）。

## 3. 需求 v16 修订说明（AC-15）

- **问题**：v15 的 AC-15 写 `When 场景跑完`，但 `Then orch status 输出含"判定 不通过"`。场景跑完是 `completed`，T-002 第 2 轮通过，节点行只显示当前判定 `判定 通过`，第 1 轮的 `判定 不通过` 已被覆盖 —— 两者互斥，不可构造。
- **实测（修复前）**：终态 status 全文无「判定 不通过」，其余 3 条 Then（backflow 包、`verdict.read` detail、`原因 读取判定`）全部成立 → 产品行为正确，缺陷在观测点。
- **修订**：`When` 改为 `--scenario verdict-says-fail --stop-after 3 --keep` 停在「开发第 2 轮核对完成、复测派发前」。该时刻实测：`节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条`、HO-002 `edge.kind='backflow'`、`verdict.read` detail `{source:'file',path:'out/verdict.json',verdict:'fail'}`、`原因 读取判定` —— 4 条 Then 全部可观测。
- **边界**：**4 条 Then 一条未删、一条未放宽**；只改 Given/When 与新增口径说明；其余 AC/BR/M/C/D/附录 A 文案逐字未动；AC 仍 46 条（有效 44 + 作废 2）。头部补 v16 摘要，附录 C 追加 v16 行。

## 4. 最终核对

| 项 | 命令 / 文件 | 结果 |
|---|---|---|
| 全量用例 | `node --test "test/**/*.test.js"` | `337 tests / 337 pass / 0 fail` |
| 架构扫描 | `purity-check.mjs --dirs src/core,src/daemon --forbid ...` | `EXIT=0`，14 文件零命中 |
| 夹具面 39 条 | `node probe/acc2-f-b2.mjs` + `-b3.mjs` + `-final.mjs` | `39 通过 / 0 不通过 / 0 阻塞`；171 个 `AC-xx.*` + NFR 证据 |
| 真实面 5 条 | `acceptance-product.md` | `5 通过 / 0 阻塞`；AC-45 序列 `21 < 87 < 93`，0 重试 |
| `single` 红线 | AC-21（真实 DSH） | 六行段序逐字一致，全文无「模板」 |
| 孤儿进程 | `tasklist /FI "IMAGENAME eq node.exe"` | 仅 WorkBuddy 平台进程，无 Maestro 核心残留 |

## 5. 遗留项（不阻断，转后续）

1. **`npm test` 在 Node 22 不可用**：`package.json:13` 是 `node --test test/`，会报 `MODULE_NOT_FOUND`；统一用 `node --test "test/**/*.test.js"`（I1.1 起即如此，`review-round1.md` SUG-03）。
2. **AC-22 是「真实面抽查 6 条」**：I1.1 全 26 条的完整结论需与 216 个用例 + 夹具面报告合并；本迭代未重复跑 I1.1 全量真实面。
3. **NFR-01b「10 次取最大」**：真实面取到 6 行 / 4 个有效样本（max 14ms），未凑满 10 次，已在 `acceptance-product.md` 如实标注，未伪造。
4. **AC-45 是单点实测**：真实模型一次跑通、0 重试；需求 §3.3 已登记「模型可能第 1 轮主动补边界」的已知风险，本结论不构成统计性保证。
5. **两份验收报告头部保留 v15**：那是各自执行时的依据版本，属历史事实；AC-15 按 v16 复验已在 `acceptance-fixture.md` §0「复验说明」与「版本口径」中声明，不追溯改写。
6. **范围外**：协调者角色只定义不派发（I1.5）、`escalated` 人工裁决（I1.4）、图的 YAML 声明式定义与校验器（I1.6）——均由需求 §1.3 明确界定。
