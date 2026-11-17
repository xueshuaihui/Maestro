# I1.10b 进度台账（主控维护，execution-template §2.0）

> 迭代：I1.10b 桌面端实例下钻（看板 → 角色下钻 → 节点详情三级视图）
> 分支：`feat/i1.10b-drilldown` ｜ 基线 HEAD：`66e5a6b` ｜ 需求定稿：v5（`e8a4412f6bb6fb71`）

## S0 需求生成与评审闭环

| 阶段 | 任务 | 执行 Agent | 评审 Agent | 状态 | 门禁数字 | 证据路径 | 结论 | 下一步 |
|---|---|---|---|---|---|---|---|---|
| S0 | 撰写完整需求 v1 | 需求撰写 Agent | — | 完成 | 30 AC / 30 BR | `requirement.md`（v1，附录 C） | 8 节齐全 | 进评审 |
| S0 | 评审 round1 | — | 需求评审 Agent（干净上下文） | 完成 | 阻断 10 / 建议 11；覆盖 11/13（2 部分） | `review-round1.md` | **FAIL** | 修复 |
| S0 | 裁决 A~F + 修复 v2 | 主控裁决 + 修复 Agent | — | 完成 | 47 AC / 40 BR；开工基线实跑 1425 条 | `decisions.md` A~F、`review-round1.md` §5 | 21 项逐条处置 | 重评 |
| S0 | 评审 round2 | — | 需求评审 Agent（干净上下文） | 完成 | 阻断 4 / 建议 14；覆盖 13/13 | `review-round2.md` | **FAIL**（F2-01/02 指向回归基线口径不可复现） | 主控裁决 G |
| S0 | 裁决 G + 修复 v3 | 主控裁决 + 修复 Agent | — | 完成 | 49 AC / 42 BR | `decisions.md` G、`review-round2.md` §1 | F2 18 项处置 | 重评 |
| S0 | 评审 round3 | — | 需求评审 Agent（干净上下文） | 完成 | 阻断 5 / 建议 10；覆盖 13/13；锚点抽查 24 组（4 不符） | `review-round3.md` | **FAIL**（判据与真实投影/接缝不符） | 主控裁决 H/I |
| S0 | 裁决 H/I + 修复 v4 | 主控裁决 + 修复 Agent | — | 完成 | 51 AC / 43 BR；裁决 H 事实表 4 行实跑复核一致 | `decisions.md` H/I、`review-round3.md` §1 | F3 15 项处置 | 重评（主控设定阻断判据边界） |
| S0 | 评审 round4 | — | 需求评审 Agent（干净上下文） | 完成 | 阻断 4 / 建议 10；覆盖 13/13；锚点 30 组实跑 | `review-round4.md` | **FAIL**（4 项均为内部矛盾类） | 修复 |
| S0 | 修复 v5 | 修复 Agent | — | 完成 | 51 AC / 43 BR（无新增） | `requirement.md`（v5）、`review-round4.md` §1 | F4 14 项处置 | 重评 |
| S0 | 评审 round5 | — | 需求评审 Agent（干净上下文） | 完成 | 阻断 **0** / 建议 3；覆盖 13/13；锚点 30 组全符合 | `review-round5.md` | **PASS** | 理解纪要 |
| S0 | 需求理解纪要 + 13 条 DoR | 需求理解 Agent | — | 完成 | DoR 12 绿 + 1 黄（D-14 C1 待验事实，裁决 I，不阻塞） | `requirement-understanding.md` | **S0 Gate 满足** | 进 S1 |

## S0 收口要点（移交 S1）

- 覆盖表 13/13（10 子项 + 验收句 3 段）无 `部分 / 缺漏 / 越界 / 收窄`；反向扫描无夹带。
- 裁决 A~I 全部落盘 `decisions.md`；A（一键跳转三段口径）、G（回归基线三段式）、H（判据落在真实投影与接缝）、I（会话标识核对）为后续必守。
- round5 建议 3 条（F5-01 竞态实验 / F5-02 滚动指标模拟承载 / F5-03 目录名待验）→ S1 拆分文档 §7 风险与降级。
- 契约锚点纪律：D-14 表 A（5 条）+ 表 D（15 条）S2 落地后逐条复核；`exit 2` 记「未落地不计通过」，不判失败。
- 真实面：AC-25 / AC-33 依赖本机 DSH 0.2.2-rc.1，不可用判阻塞；窗口前置/剪贴板为人工核验项。

## S1 拆分与选型

| 阶段 | 任务 | 执行 Agent | 评审 Agent | 状态 | 门禁数字 | 证据路径 | 结论 | 下一步 |
|---|---|---|---|---|---|---|---|---|
| S1 | 拆分 / 选型（8 节 + AC→WP 满覆盖映射） | 拆分 Agent | — | 完成 | 6 WP / 35 文件零交集 / AC 覆盖 51/51 | `iteration-10b.md` | — | 拆分评审 |
| S1 | 拆分评审 round1 | — | 拆分评审 Agent（干净上下文） | 完成 | 阻断 1（SR-01 WP-2 独立可验收）/ 建议 4；行号抽查 30 处全吻合 | `iteration-10b/split-review.md` | **FAIL** | 修复 |
| S1 | 修复 SR-01~05 | 拆分修复 Agent | — | 完成 | 35 文件零交集不变 / 51 覆盖不变 | `iteration-10b.md`（修订版） | SR-01 断言并入 drill-fixtures.test.js | 复评 |
| S1 | 拆分评审 round2 | — | 拆分评审 Agent（干净上下文） | 完成 | 阻断 **0** / 建议 3；17 处行号抽查全吻合；零交集与 51 覆盖脚本实测通过 | `iteration-10b/split-review-round2.md` | **PASS**，S1 Gate 满足 | 进 S2 |

## S1 收口要点（移交 S2）

- 6 个 WP：WP-1 文案键底座(1) / WP-2 daemon 下钻数据面(2) / WP-3 下钻 UI 纯模块(32) / WP-4 装配导航实时接缝(10) / WP-5 一键跳转(4) / WP-6 回归守门(2)。
- 契约先冻结：下钻投影取数路径与 D-14 表 A 五条签名在批次 1 前冻死；`app.js` 唯一负责人 = WP-4。
- round2 建议 3 条（SR2-01 subworkflow 形状依据 §2.1 契约 / SR2-02 投影断言五条齐全 / 行号漂移按符号锚点复核）随批次 1 交给实现方。
- S2 首日两件事：① F5-01 竞态最小实验（WP-2 批次 1 第一步）；② D-14 表 C1 `sessionId`↔目录名实测。

## S2 实现

| 阶段 | 任务 / WP | 执行 Agent | 评审 Agent | 状态 | 门禁数字 | 证据路径 | 结论 | 下一步 |
|---|---|---|---|---|---|---|---|---|
| S2 | 批次 1：WP-1 文案键底座 | impl-wp1 | — | 完成 | 63 新增键 / 210 总数；契约测试 33/33 | `test/wp14/labels-drill.test.js` | 交付 | 随批次评审 |
| S2 | 批次 1：WP-2 daemon 下钻数据面 | impl-wp2 | — | 完成 | 五投影 + 7 端点；契约测试 9/9→10/10 | `src/daemon/drill.js`、`test/wp14/drill-fixtures.test.js` | 交付 | 随批次评审 |
| S2 | 批次 1 实现评审 round1 | — | review-batch1 | 完成 | 阻断 1（B1-01 continue message 落 UNKNOWN_ERROR 兜底）/ 建议 5 | `review-batch1.md` | **FAIL** | 修复 |
| S2 | 需求 v6 补授权（D-11 两处精确断言） | 需求修订 Agent | review-v6 | 完成 | 10+/1-；AC 51 / BR 43 / NF 7 与全部 Then 零改动 | `requirement.md` v6、`review-v6.md` | **PASS** | 允许修复既有断言 |
| S2 | B1-01 + 两条授权断言修复 | impl-wp2 + impl-wp1 | — | 完成 | message 取 COMMAND_ERROR 原文；`147 + 63` 精确断言 | `server.js`、`errors.test.js`、`http-channel.test.js` | 交付 | 复评 |
| S2 | 批次 1 复评 round2 | — | review-batch1-round2 | 完成 | 阻断 **0** / 建议 5；8 维回归无退化；差集 ∅ | `review-batch1-round2.md` | **PASS** | 进批次 2 |

### 批次 1 关键事实
- F5-01 竞态实验已实证：核心对有活跃 run 的实例的后续写盘会用内存态覆盖外部替换（`rev` 从磁盘现值续写、外部字段被抹）。回改：`drill-fixtures.test.js` 静态场景先起核再写盘且核心不驱动；行为场景走产品路径 + 既有接缝；**`test.escalate` 在活跃实例上不可用**，AC-23 改用产品路径自然升级（评审判定判定强度不降）。
- 续错文案从 `ERROR_TEMPLATE.UNKNOWN_ERROR` 改为 `COMMAND_ERROR` 原文（`server.js:75-82`），`messageKey` 不变；测试断言升格为逐字（期望值从常量派生、零手写中文）。
- 全量回归：1442 条（基线 1425 + 新增 17），16 条红全部落在允许集合；新红两条按 v6 D-11 扩授权修复，复评 `errors 24/24`、`http-channel` 唯一 lsof 平台红、差集 ∅。
- 历史证据 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 曾被全量测试覆盖写，已用 `git -c core.autocrlf=false checkout-index -f` 恢复（内容 diff 空）。

| S2 | 批次 2：WP-3 下钻 UI 纯模块 + drill-dump | impl-wp3 | review-batch2 | 完成 | 9 模块 + drill-dump + 5 契约测试（25/25）；全量 1468 条差集 0 | `review-batch2.md` | **PASS**（0 阻断 / 4 建议） | 进批次 3 |

### 批次 2 关键事实
- `createDrillView` 承载 `scrollTarget`（`index.js:93/99`），`buildDag` 无该字段；8 档 `rank[1..8,8]`、`assigned` 独立第 5 档且显示词折叠「执行中」；`host-jump.js` 只交付不判定（AC-25/26/33/46 归 WP-5）。
- 63 键中纯模块直接用 53 个、10 个留下游宿主层（WP-4）消费；无增删键、无缺键。
- 评审用干净 HEAD worktree 实跑证明新红 = 0，测试 1443→1468（+25 全来自 WP-3 且全绿）。
- 建议 4 条移交批次 3/4：消费实际模块契约（第三参 options / breadcrumb 渲染层拼行）；两条环境/时序红补隔离帧纳入允许集合。

| S2 | 批次 3：WP-4 装配导航 + WP-5 一键跳转 | impl-wp4 / impl-wp5 | review-batch3 | 完成 | 40/40 测试；全量 1508 差集 0；C1 实测 8/8 一致 | `review-batch3.md` | **PASS**（0 阻断 / 4 建议） | 进批次 4 |
| S2 | 批次 4：WP-6 回归守门 + D-14 C1 补注 | impl-wp6 / 需求补注 | review-batch4 | 完成 | 16/16；全量 1524 差集 0；flake 留帧 2 条 | `review-batch4.md` | **PASS**（0 阻断 / 2 建议） | 进 S3 |

### S2 关键事实
- 裁决 J：J-1 `sessionTag` 修法让 `button.label` 逐字含 id；J-2 daemon `continue` 响应新增 `stateLabel`（取 CLI `ESCALATION_LABEL.resolved`），UI 逐字 `升级 ESC-001 已处理 · 状态 已处理`，63 键冻结不变；J-3 C1 8/8 实测一致仅补注不回填判据。
- 全量测试基线随新增测试增长：1425 → 1508 → 1524 → 1526（S4 实跑）；失败集合按裁决 G/K 差集始终 0。

## S3 验收 / S4 终验

| 阶段 | 任务 | 执行 Agent | 评审 Agent | 状态 | 门禁数字 | 证据路径 | 结论 | 下一步 |
|---|---|---|---|---|---|---|---|---|
| S3 | 四件套脚手架 + 批次 a（AC-01~15） | 验收 Agent | — | 完成 | 15/15；209 核对项；120 帧 | `acceptance-a.md` | 通过 | — |
| S3 | 批次 b（AC-16~30 除 25） | 验收 Agent | — | 完成 | 14/14；231 核对项；114 帧 | `acceptance-b.md` | 通过 | — |
| S3 | 批次 c（AC-31~45 除 33） | 验收 Agent | — | 完成 | 初判 12/14 → 复判 **14/14** | `acceptance-c.md` | 通过（AC-34 裁决 K、AC-37 stateSince 补齐） | — |
| S3 | 批次 d（AC-46~51） | 验收 Agent | — | 完成 | 初判 5/6 → 复判 **6/6**；107 核对项 | `acceptance-d.md` | 通过（AC-46 真实映射、AC-51 裁决 L） | — |
| S3 | 批次 e（AC-25/33 真实宿主） | 验收 Agent | — | 完成 | 2/2；32 自动核对项；真实 PID 0→1 | `acceptance-e.md` | 通过（人工核验项单列） | — |
| S3 | 主控独立复跑 | 主控 | — | 完成 | AC-01/02/08/22/23/29 共 6/6 全绿 | `probe/acc10b-f-results.jsonl` | 与验收自述一致 | 进 S4 |
| S4 | 终验（§3.6 六项） | 终验 Agent | 主控复核 | 完成 | 初判 5 PASS / 1 FAIL（提交卫生）→ 整改后 **6 PASS** | `final-verification.md`、`summary.json`、`report.md` | **PASS** | 收口 |

### S4 收口事实
- results.jsonl 51 unique AC、51 通过 / 0 不通过 / 0 阻塞；766/766 核对项；425 证据引用、每 AC ≥4 帧、零空帧。
- 门禁：1526 tests / 1500 pass / 17 fail / 9 skipped，差集 0；purity 双目录 31 词 exit 0；零依赖；三主链 8/8。
- 终验第 6 项整改：备份 `backup/i1.10b-pre-hygiene` → 从 `c0e46aa` 重放功能提交并过滤 `probe/**`/`evidence/**` → 验收产物归 S3 提交 → 树内容逐字节一致（`git diff --stat HEAD backup/...` 空）；本地领先远端 9 提交、未 push。
