# I1.1 验收记录（合并版）

> 执行人：独立验收子 Agent（产品命令面 + 夹具面双路独立执行）｜ 依据：`requirement.md` **v5** §3.1 / §3.2 / §3.3
> 验收时间：2026-11-04 23:45 ~ 2026-11-05 00:10（本地）
> 本文件是**索引与总判**；逐条原始记录见：
> - 产品命令面（AC-01~AC-14 + NFR-01/02/07/08）→ `acceptance-product.md`
> - 夹具面（AC-15~AC-26 + NFR-03/04/06）→ `acceptance-fixture.md`
> 原始证据 → `evidence/`（137 个文件，每条 AC 四份：`meta.json` / `output.{txt,json}` / `state.json` / `events.jsonl`，全部脚本落盘，未手抄）

## 0. 总判

| 面 | 通过 | 不通过 | 阻塞 |
|---|---|---|---|
| AC-01 ~ AC-14（真实 DSH + 真实模型） | **14** | 0 | 0 |
| AC-15 ~ AC-26（夹具） | **12** | 0 | 0 |
| **合计 26 条 AC** | **26** | **0** | **0** |

| 非功能项 | 结论 | 实测值 |
|---|---|---|
| NFR-01 热启动 ≤5s / 冷启动 ≤30s | **达标** | 热 10 次最大 **3598ms**；冷 3 次最大 **3387ms**（冷启动只测 3 次，机器级冷启动无法构造，已如实标注） |
| NFR-02 状态变化可见延迟 ≤1s | **达标** | 6 个样本最大 **83ms** |
| NFR-03 连续 10 个任务 0 错乱 0 缺失 | **达标（10/10）** | 10/10 全部执行，五类信息齐全，每实例 15 条事件，总耗时 4.4s |
| NFR-04 强杀后重启 5 项仍可查 | **达标** | 强杀后 `status` 仍列出 2 个实例，实例/节点/会话/交接包/事件全部可查 |
| NFR-06 中断后重开不偷偷重跑 | **达标** | 重启后事件 8→8，`run.started` 仅 1 次 |
| NFR-07 关掉 CLI 任务不被带走 | **达标** | `taskkill /F` 杀掉 CLI（PID 消失），核心 pid 不变，`status` 两次仍见「执行中」 |
| NFR-08 取消后 ≤5s 不再显示执行中 | **达标** | `cancel` 269ms 返回，**359ms** 后已无「执行中」 |

**一句话结论**：需求 v5 的 26 条验收标准在真实宿主与夹具两个面**逐条实跑全部成立**，非功能 7 项全部达标；未发现不通过项，也没有「无法构造因而跳过」的场景（唯一无法构造的是机器级冷启动，已用 3 次近似并标注）。

## 1. 逐条 AC 判定

### 1.1 产品命令面（真实 DSH `0.2.1-rc.5` + 真实模型 `deepseek-account/deepseek-flash`）

| AC | 结论 | 关键实测 |
|---|---|---|
| AC-01 一条命令跑通单节点任务 | 通过 | 热启动 **2338ms** 打出三行；节点「已完成 · 耗时 47s」；**632B 真实落盘** |
| AC-02 任务结束后能查到全部状态 | 通过 | 四类状态齐全；`core stop` 后 `status` 自动拉起新核心（pid 32316→31480），佐证走 IPC 而非读文件 |
| AC-03 执行中显示已运行时长 | 通过 | 两次独立进程 `status`：`已运行 5s → 9s`，严格递增；采样序列 5s/10s/12s/13s/19s/20s/25s |
| AC-04 交接包依次走完四步 | 通过 | 已构造→已投递→已接受→已完成，时间戳单调，与事件 `seq` 顺序一致 |
| AC-05 已接受与已完成是两个不同时刻 | 通过 | accepted `16:03:51.757` 早于 consumed `16:04:31.436`（差 39.7s），中间节点停在「待校验」 |
| AC-06 节点经「待校验」才到「已完成」 | 通过 | `running→review`(seq18) → `review→done`(seq19)；review 期间会话为「等待下游」，无「会话 已完成」 |
| AC-07 重复发起同实例同节点被拒 | 通过 | 同 cwd 连同一核心，第二次 **108ms** 返回「该节点正在执行，本次未发起」，exit 1，无「会话已失效」，sessionId 唯一 |
| AC-08 被拒后原来那次照常跑完 | 通过 | 原执行跑到「已完成」exit 0；`run.started` 仅 1 条，`node→done` 仅 1 条 |
| AC-09 DSH 起不来时不留半截 | 通过 | `无法启动 DSH：… ENOENT`，exit 3，无「会话已创建」，`status` 显示「不存在」，无实例目录 |
| AC-10 工作目录不可写时直接失败 | 通过 | `icacls` 真拒绝写（探针 EPERM）→ `工作目录不可写：<路径>`，exit 3，无会话 |
| AC-11 取消后不残留 | 通过 | **226ms** 会话回空闲；节点已取消、交接包已拒绝（已撤回），三对象无中间态 |
| AC-12 重启后能查但不偷偷重跑 | 通过 | `已中断 ｜ 停在节点 执行中/会话 执行中`；status 前后事件 8→8，无自动重跑 |
| AC-13 状态损坏不静默清空 | 通过 | 提示含 `状态不可读，已备份为 state.json.corrupt` + 真实路径；`state.json` 仍为 `{"broken`（8B **逐字节不变**） |
| AC-14 状态变化可追溯 | 通过 | 32 条事件 = `events.jsonl` 32 行，全部带时间/对象；31 条带 `from→to`，1 条为创建事件（`from=null`） |

### 1.2 夹具面

| AC | 结论 | 夹具开关 | 关键实测 |
|---|---|---|---|
| AC-15 会话建好但没接任务是空闲 | 通过 | `--hold-session` | `会话 空闲`，且**无** `session→thinking` 事件 |
| AC-16 调工具时看得见工具名 | 通过 | `--slow-tool write` | `会话 执行中 · 调用工具（write） · 已运行 1s`；探针 `toolName=write` |
| AC-17 等待审批时节点仍在执行中 | 通过 | `--permission=ask` + `MAESTRO_PERMISSION_POLICY=hold` | `等待审批：write` 且 `节点 执行中`；磁盘 `node.state=running` |
| AC-18 审批被拒时交接包是已拒绝 | 通过 | `--permission=ask` + `policy=reject` | `审批被拒绝，任务中止于 write`；`handoff=rejected/permission_denied` |
| AC-19 只有对方真开始干活才算已接受 | 通过 | `--noise-on-session-new` / `--noise-on-prompt` | 噪声后仍「已投递」；`accepted` 由 `agent_thought_chunk` 触发，ambiguity 3011ms |
| AC-20 会话失效与「正在执行」是两条提示 | 通过 | `--session-missing` | `会话已失效，需要重新创建`，与「该节点正在执行，本次未发起」逐字不同，无「未知错误」 |
| AC-21 执行失败保留宿主原文 | 通过 | `--host-error` | `执行失败：mock-host: … (code 500)`，原文未改写未截断 |
| AC-22 没见过的错误原样透出 | 通过 | `--unknown-error` | `未知错误：mock-host: E_QUASAR_7719 …`，原文完整 |
| AC-23 长时间没动静不判失败 | 通过 | `--turn-delay-ms 12000` | 静默 10.8s → `会话 执行中 · 已运行 11s · 无新事件`，无「失败」「已失效」 |
| AC-24 目标迟迟不开始也不判过期 | 通过 | `--accept-delay-ms 3000` | `已投递   等待目标响应 · 已等待 1s`，全程无「已过期」，节点未失败 |
| AC-25 上一个任务的收尾不影响下一个 | 通过 | `--slow-tool` + `cancel` | 取消后迟到 update 未把会话改回「执行中」，无串台 |
| AC-26 非法状态迁移被拒绝 | 通过 | `attempt-transition.mjs` | exit 0（拒绝成功）；`events.jsonl` 有 `result:"rejected"`，磁盘状态仍 `done` |

## 2. 环境与口径声明

| 项 | 产品命令面 | 夹具面 |
|---|---|---|
| 宿主 | 真实 DSH `0.2.1-rc.5` + 真实模型（**未使用任何 mock**） | `test/fixtures/mock-acp-agent.js`（独立 ACP 进程） |
| DSH_HOME | 隔离 `%TEMP%\maestro-acc-p\dsh-home`，`cordis.patch.yml` 改两行 provider/model，`--dump-config` 复核 | 不需要（夹具不连 DSH） |
| 项目根 | `%TEMP%\maestro-acc-p\proj`（**不在** `D:\WWW\Maestro`，规避 DSH 的 pwsh 权限修复把 turn 从 5s 拉到 24.8s） | `%TEMP%\maestro-acc-f\proj\<case>\`，每条 AC 独立根 |
| 清理 | 凭据副本与 DSH_HOME 已删，`~/.dsh` 未改动，无孤儿核心 | 临时目录已清理，无 mock/核心残留 |

**夹具可信度**：mock 走的是产品同一条链路 —— `host-config.launch` → `createStdioTransport(spawn)` → `createAcpClient`（NDJSON），`state-machine` / `handoff-tracker` / `event-bus` / `instance-store` 全是产品实现，CLI→IPC→核心→适配器一段未绕过。`probe-adapter.mjs` 仅用于 AC-15/16/19 这类观察窗口过窄的场景，且打印的是归一化器**真实观测值**；`attempt-transition.mjs` 仅用于 AC-26，且写同一份 `events.jsonl`。

## 3. 非阻断观察（不影响任何 AC 判定，登记给后续迭代）

| # | 现象 | 来源 | 处置建议 |
|---|---|---|---|
| O-1 | 失败收尾时失败文案会打印两次（节点行 + 收尾行） | 夹具面实测（AC-20 输出末两行同为「会话已失效，需要重新创建」） | 属显示冗余，I1.4 统一输出层时收敛 |
| O-2 | `store.save` 的「读检查 → rename」跨进程 TOCTOU：在极窄窗口内人工改盘可能被覆盖 | 二轮评审 B-3 边角 | 单写者架构下不可达；若未来多写者，需引入文件锁 |
| O-3 | 需求 §3.3 登记的 `--illegal-transition` 开关在 mock 中不存在，AC-26 实际用 `attempt-transition.mjs` | 夹具面 | 语义已覆盖（写同一 events.jsonl），建议 v6 修订夹具表 |
| O-4 | `INSTANCE_TERMINAL` 是需求 2.6 九条之外的第 10 条用户可见文案 | 二轮评审 C-6 | **主 Agent 裁决保留**：终态不重跑是独立原因，按 BR-13 不得并入九条；已登记于 `iteration-1.md` |
| O-5 | `--hold-session` 探针在归一化器无记录时以字面量 `idle` 兜底，但同时输出 `observedState:null` 不自证 | 二轮评审 B-5 附注 | 产品级证据已由 `test/wp8/f5-hold.test.js` 承担，探针仅辅助 |
| O-6 | AC-05 边界：节点→`done` 比交接包→`consumed` 早 2ms（同一核对动作内先后） | 产品面 | 需求只要求「已接受早于已完成」，成立；如未来要求严格串行，需在核对后显式落事件 |

## 4. 证据索引

```
evidence/
  AC-01 … AC-14   *.meta.json / *.output.txt / *.state.json / *.events.jsonl   （产品面）
  AC-15 … AC-26   *.meta.json / *.output.json / *.state.json / *.events.jsonl  （夹具面）
  AC-25.supplement.*                                                          （AC-25 补测）
  NFR-01/02/07/08.*                                                           （产品面）
  NFR-03/04/06.*                                                              （夹具面）
  _fixture-run-summary.json                                                   （夹具面批量执行摘要）
```

采集脚本（`probe/`，产品外，不参与运行）：`acc-p-ac.mjs` / `acc-p-nfr.mjs`（产品面）、`acc-f-run.mjs` / `acc-f-lib.mjs` / `acc-f-summary.mjs`（夹具面）。

## 5. 验收结论

需求 v5 §3.1 的 **26 条 AC 全部通过**（真实面 14 / 夹具面 12），§3.2 的 **7 条非功能项全部达标**，证据可复核、可重现。本迭代满足退出标准，**准予收口**。
