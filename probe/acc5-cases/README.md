# I1.5 验收用例目录（probe/acc5-cases/）

一条 AC 一个文件，`acNN.mjs` ↔ `AC-NN`。runner 自动加载本目录所有 `*.mjs`，
**以 `_` 开头的文件不加载**（`_baselines.mjs` / `_template.mjs` / `_fixtures.mjs` 是共享库）。

```
acc5-f-lib.mjs      底层常量与工具（路径、spawn、抽帧、证据落盘）
acc5-f-common.mjs   动作与断言辅助（makeCase / 项目夹具 / 产品封装 / finish）
acc5-f-run.mjs      单 AC 与批次入口        ← 只从这里跑
acc5-f-final.mjs    重建 acceptance-fixture.md + acc5-f-summary.json
acc5-cases/         本目录：45 个用例 + 3 个 _ 共享库 + 本说明
```

## 1. 运行

```bash
node probe/acc5-f-run.mjs --list            # 登记情况 / 批次 / 限时覆盖
node probe/acc5-f-run.mjs AC-27             # 单条（改完用例先这样跑）
node probe/acc5-f-run.mjs --batch a         # a=AC-01~15  b=AC-16~30  c=AC-31~45
node probe/acc5-f-run.mjs --all             # 45 条
node probe/acc5-f-final.mjs                 # 收口：重建 acceptance-fixture.md + summary.json
```

产物：分节核对表 `probe/acc5-f-parts/AC-NN.md`、机读结果 `probe/acc5-f-results.jsonl`（同一 AC 取最后一条）、
证据 `docs/iterations/iteration-5/evidence/AC-NN.<阶段>.<类型>`。

## 2. 批次与限时（模板 §3.2）

| 批次 | 范围 | 条数 | 说明 |
|---|---|---|---|
| a | AC-01~15 | 15 | 注册表加载与 `role list` 视图面 |
| b | AC-16~30 | 15 | `role show` / 实例模型 / 主链中间态 |
| c | AC-31~45 | 15 | 并发槽、不可用原因、纯度扫描、全量套件 |

- 单条默认限时 **90s**（`ACC5_CASE_TIMEOUT_MS` 可改）。显式覆盖：**AC-19 = 240s**（worktree 基线跑三条主链）、**AC-42 = 900s**（全量 599 条 × 最多 3 次）。
- 每条 AC 独立项目根 `%TEMP%/maestro-acc-p5/<AC>`；跑前 `forceKillCore`，跑后 `cleanRoot` + `killAllDrivers`。
- **场景计数满 10 回收一次核心**（`SCENARIO_RECYCLE_AT`）。同进程连跑 20+ 场景会让 mock 的 `session/new` 全部失败——不要关掉这个回收。
- 超时与用例异常都记**阻塞**（附超时瞬间快照），不是产品判定；修完用例重跑即可。

## 3. 确定性中间态配方

需要「停在某一刻」的 AC 一律用运行时抽帧接缝，**不用 sleep 猜时序**。

| 想要的状态 | 配方 | 用到的 AC |
|---|---|---|
| T-001 review、T-002 pending | `MAESTRO_TEST_PAUSE=after_output:T-001` + `--scenario backflow` | AC-21/23 |
| T-002 running 且会话已落盘 | `MAESTRO_TEST_PAUSE=after_accepted:T-002` | AC-22/28/31 |
| T-001 done、T-002 running 第 2 轮 | `--scenario retest-slow --keep`（第 4 步有 30s 延迟） | AC-24/25/29 |
| T-002 escalated、实例 suspended | `--scenario rounds-exceeded` | AC-26/30 |
| single 主链 completed | `writeSingleHost` + `runSingleChain` | AC-27 |
| 只跑到第 N 个 turn | `MAESTRO_TEST_STOP_AFTER=N` | 按需 |
| 默认图不许变（红线） | AC-19：`git worktree add --detach 1490f6d` 挂 I1.3 树，同一 root 先后跑同一命令再归一化 diff | AC-19 |

`_fixtures.mjs` 把这些配方封成 `startCodeLoopRetest` / `startCodeLoopPaused` / `startTaskLoopWriter` /
`startCodeLoopWithDshHost` / `writeSingleHost` / `runSingleChain`，新用例直接用，别复制时序。

**等待一律 `waitUntil` 轮询磁盘**，不要等进程 stdout（产品日志会被管道吞）。注意：`after_accepted` 暂停只挡推进、
**不挡 `saveLive`**，快照可能早于会话落盘——要比 `state.json` 里 `node.sessionId`，先 `waitUntil` 它出现（AC-22 踩过）。

## 4. 写用例的约定

1. 结构固定：`const c = makeCase('AC-NN') → 构造 → c.ok(...) → finally 收尾 → return finish(c)`。
   `finish` 只在最外层调用一次；`try` 里不要提前 `return`。
2. **断言只来自 `requirement.md`**。代码与需求冲突时判不通过 + 登记 `probe/acc5-f-blockers.md`，
   **不许把断言改成代码现状**（AC-27 即此例，缺陷 D-1）。
3. 逐字基线放 `_baselines.mjs`（A-2 列表 16 行、A-3 的 6 行、A-5 的 8 行、两张 counts 表、键集合、禁用词表），
   用例里不要就地写字符串字面量。
4. 不能只断言「出现了」：AC-42 还机检「失败项必须全匹配 `NFR-`」，AC-43 反查「扫描目标 ≥5 个文件且不含 `labels.js`」——防假绿。
5. 每条 AC ≥4 个非空证据文件；`saveEvidence` 会落 `state.json` / `events.jsonl` / `meta.json` / `output.json` / `status.txt`。
   夹具侧的自述行（如驱动输出的 `{"ok":true,"root":…}`）不算产品输出，比对前要剔除。

ESM 注意事项：本目录全是 `.mjs`，**没有 `require`**（用 `import fs from 'node:fs'`）；
`__dirname` 不存在，路径用 `acc5-f-lib.mjs` 导出的 `REPO` / `NODE` / `ORCH` 拼接。

## 5. 新增一条 AC

```bash
cp probe/acc5-cases/_template.mjs probe/acc5-cases/acNN.mjs
# 改 ac / title / face，写断言
node probe/acc5-f-run.mjs AC-NN
```

`_template.mjs` 里已给出最小骨架与三个常用夹具调用示例。
