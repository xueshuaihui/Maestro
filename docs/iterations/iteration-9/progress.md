# I1.9 进度台账（三层日志 + 健康度计算）

> 主控维护。判据来源：`docs/templates/execution-template.md` §0.2 五阶段 Gate、§2.0 派单循环、§4.5 Done。
> 迭代依据：`docs/index.md` 第二部分 `#### I1.9`（行 828-836）；基线 HEAD `70277df`。

## 阶段总表

| 阶段 | 状态 | 门禁数字 | 证据 | 结论 |
|---|---|---|---|---|
| S0 需求生成与评审 | ✅ 收口 | 需求 **v7**（1060 行 / 27 AC / 25 BR / 附录 A0~A14 + B1~B5 + C + D1~D11）；**7 轮独立评审**，最终 `review-round7.md` **PASS（阻断 0 / 建议 0）**，规划原文 12/12 覆盖、反向扫描无夹带；DoR 13 条 **12 绿 + 1 口径偏离**（第 9 条按 D-2 裁决沿用「失败集合差集=0」） | `review-round1..7.md`、`requirement-understanding.md`（359 行）、`decisions.md` D-1/D-2/D-3 | S0 Gate 通过，准出 S1 |
| S1 拆分与选型 | ✅ 收口 | `iteration-9.md` **r2 / 751 行**；9 WP / 23 负责文件零交集 / **AC→WP 27/27**；`split-review.md` **PASS（阻断 0 / 建议 3）**，3 条建议由 r2 纯增 32 行全闭合 | `iteration-9.md`、`split-review.md`、`b6f646b` | S1 Gate 通过，准出 S2 |
| S2 实现 | ⏳ 进行中（6 批中 **3 批收口**） | 批次 1~3 的 5 个 WP 契约测试全绿；主控独立复跑 `i19-render`+`status-doc` **40/40**、`wp9/**` **85/85**、`labels-sync`/`cli-assets`/`purity`/`cli-e2e` **45/45**；deps **0** / `USAGE_LINES` **25** / purity **24 文件零命中 exit 0**；4 份独立评审全部 **PASS（阻断 0）** | `8beb6ca`…`3078c83`、`review-wp1-wp3.md` / `review-wp2-wp4.md` / `review-wp5.md` / `review-wp6.md` | 批次 4（WP-7）待开发，批次 5/6 未开始 |
| S3 验收 | ⏳ 未开始 | — | — | — |
| S4 终验与收口 | ⏳ 未开始 | — | — | — |

## 基线（HEAD `70277df`，2026-11-10 实测）

- 全量测试：`node --test "test/**/*.test.js"` → **1028 tests / 1019 pass / 8 fail / 1 skipped**。
- **8 条失败均为预存在、环境敏感（性能/真进程/并发/时序）**，与本迭代无关：NFR-02 readReview p95、NFR-02 verifyProducts p95、`core.stop` 5s 收敛、自动拉起 detached 真进程、`cursor.json` 并发消费、`main --cwd` 相对解析、task-loop 审核提示词绝对路径（`/private/var` vs `/var`）、早返回 turn-delay 时序。
- **回归门禁口径（沿用 I1.7 已确立口径，与 AC 的「差集=0」一致）**：收口时以**失败集合差集 = 0** 判定（不得新增超出基线 8 条的失败），且测试条数只增不减。基线失败集见 `docs/iterations/iteration-7/baseline-failures.txt`。
- 架构扫描：`purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` → exit 0。
- 零依赖：`dependencies` 键数 = 0。

## 现状勘察（主控预读，供撰写/拆分参考；不作为需求来源）

- **本迭代要新增的能力当前在 `src/**` 完全不存在**：`health` / `traces.jsonl` / `trace_id` / `prev_event_hash` 在 `src` 全域零命中。
- 现有事件落盘：`src/persistence/instance-store.js`（`events.jsonl` 整行追加）+ `src/core/event-bus.js`（`emit` 支持可选 `ts`、`seq` 单调）。
- 现有路径工厂：`src/persistence/paths.js` 导出 `eventsPath` / `statePath` / `instanceDir` 等，**尚无 traces 路径函数**。
- `node.timeout` / `workflow.timeout` 目前只是**定义态字段**（`src/cli/workflows.js` 读写），核心侧未见超时判定逻辑。
- 中文唯一来源：`src/cli/labels.js`；CLI 命令表在 `src/cli/main.js`（`instance: ['status','log','graph']`）。

## 决策留痕

| # | 触发点 | 依据 | 决定 | 影响面 |
|---|---|---|---|---|
| D-0 | 用户要求「开始 I1.9」，而 `docs/index.md` 迭代顺序为 …→I1.7→I1.8→I1.9，I1.8 状态「未开始」 | `docs/index.md` 行 696-697（I1.8 预判 C 类、真实面必须本机；I1.9 预判 B 类、纯核心侧） | 按用户指定直接做 I1.9；I1.9 的规划条目与基线要求**不引用** I1.8 的崩溃恢复/检查点/session resume 能力，故不阻塞。若需求或拆分阶段发现 I1.9 条目实际依赖 I1.8 能力，立即书面升级给用户裁决，不自行扩范围 | 需求范围、拆分 DAG、验收前置条件 |

## S0 闭环记录（2026-11-10 ~ 11 实跑）

| 轮次 | 需求版本 | 独立评审（干净上下文） | 结论 |
|---|---|---|---|
| 1 | v1（714 行） | `review-round1.md` | **FAIL**：阻断 6 / 建议 11（F-01 §2.4 衔接节被写成功能点口径、审计粒度反写基线、AC↔基线互斥、异常路径缺 BR/AC 等） |
| 2 | v2（843 行 / AC 24） | `review-round2.md` | **FAIL**：阻断 1 / 建议 7（AC-09 与附录 A-2/A-10 基线冲突） |
| 3 | v3（897 行 / AC 25） | `review-round3.md` | PASS（阻断 0 / 建议 7）；主控按「只能补不能减」继续采纳 3 项会卡验收的建议 |
| 4 | v4（968 行 / AC 27） | `review-round4.md` | **FAIL**：阻断 1 / 建议 8（AC-27 节点号写死 `T-003`，code-loop 实际 `T-001`） |
| 5 | v5（1010 行） | `review-round5.md` | **FAIL**：阻断 4（`single` 输出无角色名、冻结态 `consumed`、无运行期 timeout 注入、`backflow-once` 只回流 1 次） |
| 6 | v6（1030 行） | `review-round6.md` | **FAIL**：阻断 2（30s 默认超时抢在 P90 前触发、15:00 等值边界在真实时钟下必被 δ 推过） |
| 7 | **v7（1060 行）** | `review-round7.md` | **PASS（阻断 0 / 建议 0）**：round6 F-01~F-10 全部闭合（10/0/0）、前六轮已修项无回归、覆盖 12/12、无夹带、无不可构造判据 |

- **v7 关键设计**：精确等值边界下沉到 `computeHealth({ state, now })` 单元级注入 `now`；CLI 级只用安全余量（31s vs 30s、70s/30s vs P90 50s、15:05/14:55 vs 15:00）；AC-14 显式把 `health.nodeTimeoutMs` 提到 300000 避免红档抢先。
- **DoR 13 条机检（主控独立实跑，不采信自述）**：头部 v7 == 附录 C 末行 v7；27 AC 连续 01..27；Then/三件套/锚点 27/27；BR 25 条定义齐全、无悬空引用；附录 A 15 节 / D 11 节；D-7 含文件+行号；U 9 项全标不阻塞；§1.3 范围外齐全；完整 `--forbid` 31 词表在正文可复制；7 轮评审最终 PASS；括号指引残留 0。**第 9 条按 D-2 裁决沿用「失败集合差集=0」**（如实登记偏离，非放宽）。
- **主控裁决 3 条**（`decisions.md`）：D-1 确认 U-4/U-7 豁免（健康度不改路由、存量会话发射点清退归 I1.12）；D-2 DoR 第 9 条口径；D-3 夹具命令行统一带 `--host mock`（以 §3.3 总口径为准，不改任何 Then/附录 A 基线）。
- **理解纪要**：`requirement-understanding.md`（359 行），9 节齐全；27/27 AC 判「在声明层级可构造」；回归红线 R-1~R-14。

## S1 拆分与评审（2026-11-11 已收口）

| 项 | 结果 |
|---|---|
| `docs/iterations/iteration-9.md` | **r2 / 751 行**，0~8 节齐全；9 个 WP / 23 负责文件**零交集**；**AC→WP 满覆盖 27/27**；§6 契约先冻结点 7 条 + 6 批 DAG（每批 ≤2 并行）+ 5 类整合检查点；§7 17 条风险逐条点名文件/函数；§8 冲突表 C-01~C-23（D-7 12/12 文件、D-8 6/6 断言、decisions D-1/D-2/D-3 3/3） |
| 独立评审 | `split-review.md` **PASS（阻断 0 / 建议 3）**；A~H 八维度全 PASS；D-7/D-8 核对表 20/20 通过；反向扫描 48 路径无夹带、27 AC 无缺漏；源码实测 `object:'session'` 12 处、`USAGE_LINES` 25 行、D-7 抽样行号（3141/3157/3746-3747/4036/paths 47-53）全真实 |
| 建议闭合（r2） | F-01 §6 补可复制的 `--stop-after 3 --keep` 冻结窗口命令 + A-3 逐字预期；F-02 §3 补「示意值 vs 逐字输出」统一说明（对齐附录 A-0）；F-03 `i19-render.test.js` 补全路径 `test/wp9/`。纯增 32 行、无删行、判据零改动 |
| 主控复核 | 独立复算：9 节标题、映射表 27 行无缺号重号、23 文件零交集、§8 冲突表 23 行、尖括号残留 0、冻结/检查点齐备 |

**S1 Gate 通过 → 准出 S2**。批次顺序（拆分 §6）：
1. WP-1（路径+trace 基座）+ WP-3（health 纯函数）
2. WP-2（尾读+审计链）+ WP-4（文案键）
3. WP-5（夹具开关）+ WP-6（渲染纯函数）
4. WP-7（orchestrator 核心集成，单线大文件）
5. WP-8（CLI + daemon，单线）
6. WP-9（回归守护，末批汇合点）

## S2 批次 1（WP-1 + WP-3，已收口）

| WP | commit | 文件 | 门禁（主控独立复跑） | 独立评审 |
|---|---|---|---|---|
| WP-1 | `8beb6ca` | `src/persistence/paths.js`（+2 函数，既有函数体零改）、`src/core/trace.js`（新建 185 行）、`test/wp9/i19-trace.test.js`（6 用例） | `i19-trace` 6/6、`test/wp9/**` 28/28、purity exit 0、deps 0 | `review-wp1-wp3.md` **PASS**（阻断 0 / 建议 2） |
| WP-3 | `42fffd1` | `src/core/health.js`（新建 202 行）、`test/wp12/health.test.js`（32 用例） | `health` 32/32、`test/wp12/**` 190/190、purity exit 0、deps 0 | 同上 |

- **评审独立复算（不采信测试自述）**：三组等值边界注入固定 `now` 全部成立（30000/30001、P90 50000/50001 与样本<5、TTL 900000/900001/899999）；`deriveHandoffIds` 用真实 `buildHandoff` 造冻结窗口，输出 `['HO-001']` / `['HO-001','HO-002']` / `['HO-002']`，`HO-002` 未漏。
- **主控裁决**：`decisions.md` D-4（`appendSpan` 返回形状）、D-5（`session_crash` 兜底与红档不并列黄码）已留痕，非缺陷；两处不影响任何 AC 判据。`7aae1a2` 提交。
- **建议 2 条（非阻断）**：F-01 `overlayRunningSpans` 附加 `running:true` 键、F-02 `paths.js:60` 注释措辞 —— 记录，不改判据。

## S2 批次 2（WP-2 + WP-4，已收口）

| WP | commit | 文件 | 门禁（主控独立复跑） | 独立评审 |
|---|---|---|---|---|
| WP-2 | `36f3be3` | `src/core/event-bus.js`（emit 链 + replay badLines）、`src/persistence/instance-store.js`（`readTailForChain` 同一次尾读）、`test/wp9/i19-chain.test.js`（7 用例） | `i19-chain` 7/7、wp9 49/49、`wp1/event-bus` 7/7、purity exit 0、deps 0 | `review-wp2-wp4.md` **PASS**（阻断 0 / 建议 3） |
| WP-4 | `cdb8fc6` | `src/cli/labels.js`（末尾 +90 行 / 23 导出）、`test/wp9/i19-labels.test.js`（14 用例） | `i19-labels` 14/14、`labels-sync`+`cli-assets` 32/32、wp9 49/49 | 同上 |

- **评审独立实跑**：3 条链逐条复算（首条 64 个 0、第 N 条 == 第 N-1 条完整 record 规范化 SHA-256）、monkey-patch 证单次尾读、截断前溯 `seq=3`、整份损坏重起链；A-1~A-14 文案逐字核对 **41/42 一致**，唯一差异为 A-8 `HEALTH_EVENT_LINE` 不含 `{ts}`（A-0 可变值 + D-9 已裁决，判建议 F-01 不阻断）。
- **主控裁决**：`decisions.md` D-6（`replay` 恒返回数组 + 非枚举 `badLines`，**WP-8 须从 `events.badLines` 取并置入 `result.badLines`**）、D-7（`LAYER_HEALTH.health`）、D-8（`HEALTH_REASON[code]` 单表）、D-9（以 WP-4 实际导出名为冻结契约）。`c57a609` 提交。
- **转达批次 3/5**：WP-6/WP-8 渲染 `health.changed` 文本行须自行在 `HEALTH_EVENT_LINE` 前拼 `HH:MM:SS` + 2 半角空格；WP-5 的 AC-21 截断夹具须用不可解析半行且独立成行带 `\n`。
- **已还原**全量测试改写的 3 个 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`，未纳入提交。

## S2 批次 3（WP-5 + WP-6，已收口）

| WP | commit | 文件 | 门禁（主控独立复跑） | 独立评审 |
|---|---|---|---|---|
| WP-5 | `e4b4888` | `test/fixtures/mock-acp-agent.js`（+55/-13，新增全在 `failToolMode` 守卫内）、`test/wp9/i19-fixture.test.js`（8 用例，真实 spawn + NDJSON） | `i19-fixture` **8/8**、`wp9/**` **85/85**、deps **0**；`loop-fixture` 1 条失败经核为基线第 4 行，按 D-2 差集口径判非回归 | `review-wp5.md` **PASS（阻断 0 / 建议 4）** |
| WP-6 | `efbc658` | `src/cli/render.js`（+243）、`src/core/status-text.js`（+85）、`test/wp9/i19-render.test.js`（28 用例 / 721 行）、`test/wp11/status-doc.test.js`（按 D-8 只改 2 行） | `i19-render`+`status-doc` **40/40**、`wp9/**` **85/85**、`labels-sync`+`cli-assets`+`purity`+`cli-e2e` **45/45**、purity **exit 0 / 24 文件零命中**、deps **0**、`USAGE_LINES` **25** | `review-wp6.md` **PASS（阻断 0 / 建议 4）** |

- **主控独立复核发现 1 个阻断缺陷并打回修复（D-12）**：`computeHealth` 按需求 D-3 L964 返回**纯码值数组** `reasons: string[]`，而 `HEALTH_REASON` 模板带 `{nodeId}` 等占位符、`replaceAll` 缺参填空串；WP-6 首版只在 `reasons` 为 `{code,...实参}` 对象时才填得进，A-6 附 8 行测试**全靠测试夹具传对象**通过，用真实核心输出会渲染成 `节点  执行超时`（双空格），AC-13/14/15 逐字判据会全挂。裁决：**纯码值数组不变**（不改 `health.js` / 事件形状 / A-8 JSON），由**渲染层从快照既有字段推导占位符实参**，并强制补「真实 `computeHealth` 输出 + 真实快照」的逐字用例。修复后主控与评审各自独立复算，A-6 附 8 行逐字全命中、CLI 与 `status.md` 两输出一致。
- **主控裁决 4 条**（`3078c83`）：
  - **D-10** 摘要四要素上报载体：`tool_call.execution={command}` + `tool_call_update.execution={exitCode,keyOutputLines?,logRef?}`；`--fail-tool-no-refs` 只报命令+退出码、`title` 恒 `write` 不得冒充命令；`stopReason` 仍 `end_turn`。
  - **D-11** `renderTraceShow` payload 冻结契约：`{instanceId,exists,traceId,spans,backflows,badLines}`，中文数据串由 WP-8 从 `labels.js` 既有表与图 title 组装。
  - **D-12** 原因句占位符实参来源（上述阻断缺陷）+「事件文本行无快照」已知边界。
  - **D-13** WP-5 三个开放点：`host-logs/T-001.log` 归属 S3 脚手架；接受新开关组合边界、不扩范围；`cursor.json 并发消费` 属基线第 4 行、判非缺陷。
- **评审独立实跑证据**：WP-5 用 `git show HEAD:` 取改动前版本，14 组 argv 完整帧 JSON 逐字 diff = 0、43 项 D-10 字段核对全绿；WP-6 用 13 个既有事件样本做 HEAD 输出 diff = 0、6 个既有函数体零改、`status-doc.test.js` 仅 2 行变更、8 个零改文件确认零改；两份报告均声明未改产品/测试代码、未提交。
- **转达批次 4 / 5**：
  - WP-7：①按 **D-10** 在 `handleUpdate` 内按帧名合并 `execution` 到会话级摘要缓存，缺项存 `null`，**不得**用 `toolName` 或默认值补齐；②`state.health.reasons` / `detail.reasons` 恒为**纯码值数组**，不得改对象数组；③如需事件文本行显示带占位符原因的实参，可**可选**提供 `health.reasonVars` / `detail.reasonVars`（WP-6 已支持优先读取），不提供则按 D-12 降级，A-8 不受影响；④AC-04/05/26 的夹具**不得**把 `--fail-tool*` 与 `--permission` / `--host-error` / `--hold-session` 等既有分支组合（D-13）。
  - WP-8：按 **D-11** payload 形状组装 `trace show`；健康度事件行 `{layer}` 取 `LAYER_HEALTH.health`（D-7）；`HEALTH_EVENT_LINE` 不含 `{ts}`，渲染层自补 `HH:MM:SS` + 2 半角空格（D-9 / F-01）。
- **建议 8 条（非阻断，记录不改判据）**：WP-5 四条（`--help` 多 1 行、`pickFrames` 末帧健壮性、测试超时兜底、双开关布尔收敛为枚举）；WP-6 四条（事件文本行占位符码需 `reasonVars`、「首个」匹配口径登记、注释中文最严字面口径观察、对象形态兼容用例可收敛为纯码值形态）。D-7/D-8/D-9/D-11/D-12④/D-13 已裁决项不得重新升格为阻断。
