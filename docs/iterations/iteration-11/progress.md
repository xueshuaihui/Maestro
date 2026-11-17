# I1.11 进度台账

> 主控维护。每行一个任务；`门禁数字` 列写实测值，不写「通过」。评审与执行不得是同一个 SubAgent。

| 阶段 | 任务 / WP | 执行 Agent | 评审 Agent | 状态 | 门禁数字 | 证据路径 | 结论 | 下一步 |
|---|---|---|---|---|---|---|---|---|
| S0 | 需求撰写（三件套 → requirement.md） | req-writer | — | 完成 | v1 / 1296 行 / AC 43 / BR 36 / NF 8 | `docs/iterations/iteration-11/requirement.md` | 机械自检全绿（AC 连续、BR 全覆盖、无悬空引用、无括号指引） | 交独立评审 |
| S0 | 需求评审 round1（干净上下文） | — | req-review-1 | 完成 | 阻断 8 / 建议 10；覆盖表 10 行全「覆盖」 | `docs/iterations/iteration-11/review-round1.md` | **FAIL** | 主控裁决 → 修复 |
| S0 | 主控裁决 F-01~F-18 | 主控 | — | 完成 | D-01~D-15 | `docs/iterations/iteration-11/decisions.md` | 批量处置判越界删除；通知细化保留并标来源；D-12 结构断言行为优先 | 派修复 |
| S0 | 需求修复 → v2 | req-fixer | — | 完成 | v2 / 1366 行 / AC 48 / BR 35 / NF 8 | `docs/iterations/iteration-11/requirement.md` | 阻断 8 项全部回执已修；新增 AC-44~48 | 补 D-16~D-20 口径 |
| S0 | 补全量基线实测 → v3 | req-fixer | — | 完成 | v3：§3.3 补 1425/1420/4/1 差集 0 | `requirement.md` §3.3 | DoR 第 9 条闭合；AC/BR 未动 | 交第二轮评审 |
| S0 | 需求评审 round2（干净上下文） | — | req-review-2 | 完成 | 阻断 6 / 建议 12；上轮 18 条：已修 11 / 未修 1（F-14）/ 引入新问题 6 | `review-round2.md` | **FAIL**（改一处漏三处典型：F-01 五处只改三处等） | 主控裁决 → 修复 |
| S0 | 主控裁决 G-01~G-18 | 主控 | — | 完成 | D-21~D-34（D-21 门禁禁写 `fail === 0`；D-22 AC-17 只比字段值；D-29 新增 BR-36） | `decisions.md` | — | 派修复 |
| S0 | 需求修复 → v4 | req-fixer | — | 完成 | v4 / 49 AC / 36 BR（G-11 补 AC-49） | `requirement.md` | 18/18 回执已修；G-03/04/05 的口径回执有出入 | 主控实测校正 |
| S0 | 主控实测校正 AC-18 → v5 | 主控 | — | 完成 | D-35：`pendingEscalations` 实测 core+persistence 两处计算、daemon 透传 | `requirement.md` AC-18 | AC-18 「计算点 1 处」与实测不符，按 D-35 修正 | 交第三轮评审 |
| S0 | 需求评审 round3（干净上下文） | — | req-review-3 | 完成 | 阻断 5（H-01~H-05）/ 建议 14（H-06~H-19）；基线锚点实跑对照：AC-18 写「2 条」实测 **5 行** | `review-round3.md` | **FAIL**（H-01 数字失实 + 单行 grep 假阴性等） | 主控逐条复现 → 裁决 |
| S0 | 主控复现 5 项阻断 + 裁决 | 主控 | — | 完成 | D-36~D-43（D-36 改多行感知检查；D-37 两侧行各按本侧分隔符拆；D-38 `single` 可构造现场；D-39 终态/非终态分流；D-40 占用禁用 pulse；D-41 引用再校正；D-42 prefs 授权；D-43 批量字样收敛） | `decisions.md` | 5 项全部经 `grep`/`sed`/`node` 逐条复现 | 修复 → v6 |
| S0 | 需求修复 → v6（限流后主控亲自执行） | 主控 | — | 完成 | v6 / 49 AC / **37 BR**（新增 BR-37）/ 8 NF；H-01~H-19 全闭合 | `requirement.md` | 机械自检全绿（编号连续、引用无悬空、版本 v6=v6、`fail===0` 零命中、批量 9 处全在允许语境）；AC-17/18 六条锚点基线实跑与声称一致（5 行 / 0 / 1 / 0 / 1 / 4） | 进入 S0 终审 |
| S0 | 补充裁决 D-16~D-20 | 主控 | — | 完成 | 5 条 | `docs/iterations/iteration-11/decisions.md` | 工作流无分组按事实写；空/不可读分工；审批轮次兜底「—」 | 落 §3.3 基线条数 |
| S0 | 基线全量实测（DoR 9） | 主控 | — | 进行中 | — | `/tmp/i11-baseline.log` | — | 取条数写 §3.3 |
| S0 | 需求评审 round2（干净上下文） | — | req-review-2 | 待开始 | — | `review-round2.md` | — | 逐条复核 F + 全量重扫 |
| S0 | 需求理解纪要 | — | — | 待开始 | — | `requirement-understanding.md` | — | round2 PASS 后 |
| S1 | 任务拆分 `iteration-11.md` | — | — | 待开始 | — | — | — | S0 Gate 后 |
| S1 | 拆分与契约评审 | — | — | 待开始 | — | `split-review.md` | — | — |
| S2 | WP 实现 | — | — | 待开始 | — | — | — | — |
| S3 | 逐 AC 取证 | — | — | 待开始 | — | `probe/acc11-*` / `evidence/` | — | — |
| S4 | 终验与收口 | — | — | 待开始 | — | `final-verification.md` / `report.md` | — | — |

## 分支与并行边界

- 工作分支：`feat/i1.11-notify-queue-assets`，从 `main`（`66e5a6b`）拉出。
- `feat/i1.10b-drilldown` 由另一同学并行实现，**当前与 `66e5a6b` 无差异**（`git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown` = 0）。
- I1.11 一律不假设 I1.10b 能力存在（D-15）；合入时预期冲突面在 `desktop/ui/app.js` 的视图键与 `desktop/src-tauri/src/probe.rs` 的 ctl 分发器，届时按「谁先合入谁保留结构、后者按 D-9 加动作」处理。

## S0 收口与 S1 拆分（2026-11-16 追加）

| 阶段 | 内容 | 角色 | 结果 | 产物 |
|---|---|---|---|---|
| S0 | round2 评审 → 修复 v3~v5 → round3 评审 → 修复 v6 → **round4 评审 PASS**（0 阻断 / 6 建议 I-01~I-06） | 独立评审 ×4 | **PASS** | `review-round2~4.md` |
| S0 | v7 按 I-01~I-06 只补不减闭合（B-1/D-6 取不到输入口径、BR-25 三类、--no-notify 授权、删弱引 BR-12、A-4 括注、行号 900–912） | 主控 | 机械自检全绿 | requirement.md **v7**（49/37/8） |
| S0 | 派单 C 需求理解（335 行 / 15 条关键裁决 / 接缝清单） | req-understanding | 完成 | `requirement-understanding.md` |
| S0 | S0 Gate 13 条 DoR 全绿；D-44 裁决（条数下限归 test/wp14，不改 gate.mjs） | 主控 | **通过** | `decisions.md`（D-01~D-44） |
| S1 | 拆分 `iteration-11.md`（8 节骨架 / 10 个 WP / 28 文件零重叠 / AC→WP 满覆盖映射 / 六批次 DAG） | 主控 | §1.5 自检全绿 | `docs/iterations/iteration-11.md` |


## S2 批次 A 开工（2026-11-16）

- 派出 WP-1（通知域：notify.js + prefs.js）与 WP-2（队列域：queue.js）两个并行 Agent，六段式任务书，门禁四件套（全量差集 0 + tests>=1425、purity 31 词、零依赖、自带契约测试）。
- 契约先冻结点：`iteration-11.md` §2.1~§2.3 签名；决策入口实锚 `orchestrator.resolveEscalation`（orchestrator.js:5022）。

## S2 批次 A 收口（2026-11-16）

- **WP-1 通知域**（c1072a5）：notify.js 502 行 + prefs.js 99 行 + 测试 32 条全绿。异常合并经主控裁决 D-46 改「首条即发 + 并入更新」（mergedCount [1,2,3,4] 单调递增，首条 0ms < 2s，AC-03 与 AC-06 同时成立）；需求 v8 补 AC-06 判读句。
- **WP-2 队列域**（325f6bd）：queue.js 339 行 + 测试 16 条全绿。五动作全走既有 RPC（escalation.resolve / approval.resolve / instance.cancel）；totals 零重算（D-36）；错误映射带 hint + reasonCode；夹具口径 D-45。
- **批次 A 门禁**：全量 1473 / 1468 pass / 4 fail（AC-04 + core.stop + main --cwd + task-loop 审核提示词）全部落在判定基线，差集 0；tests >= 1425 ✓；purity 31 词 exit 0；deps 0。


## S2 批次 B 开工（2026-11-16）

- 派出 WP-3（资产库投影 assets-view.js）与 WP-4（全局角色占用 occupancy.js）两个并行 Agent。
- 任务书红线：D-40 禁 pulse 造占用；D-4 资产接口零写入；校验失败原因与 CLI 逐字一致（复用注册表校验输出）。
- 全量门禁下限升至 tests >= 1473（批次 A 合入 48 条用例后）。

## S2 批次 B 收口（2026-11-16）

- **WP-3 资产库**（8493f52）：assets-view.js 844 行 + 测试 10 条全绿；校验原因零复刻（import CLI detailOf）；零写入 sha256 锚定；AC-46 经 builtinRoot 隔离。D-47 登记收敛路径。
- **WP-4 全局占用**（5bac7f4）：occupancy.js 249 行 + 测试 4 条全绿；三方同源断言（buildOccupancy/buildRoleInstances/buildGraph）；禁 pulse（D-40）；D-48 补 hosts 第 8 字段（A-6 第 6 段逐字所需），拆分文档 §2.5 签名同步修正。
- **批次 B 门禁**：全量 1487 / 1482 pass / 4 fail（同一基线集合）差集 0；tests >= 1473 ✓；purity exit 0；deps 0。

## S2 批次 C 开工（2026-11-16）

- 派出 WP-5（工作流画布投影 canvas.js）与 WP-6（证据投影 evidence.js）两个并行 Agent。
- **WP-5 画布**（f197bcf）：canvas.js 291 行 + 测试 13 条全绿；三态×valid 12 行矩阵；内置回退（D-49）；零写入+零运行时字段双锚定。
- **WP-6 证据**（da28bb6）：evidence.js 193 行 + 测试 5 条（约 60 断言）全绿；只 stat 零 readFile（源码级断言）；防体积护栏；真实运行端到端补充。
- **批次 C 门禁**：全量 1505 / 1500 pass / 4 fail 差集 0；tests >= 1487 ✓。

## S2 批次 D 开工（2026-11-16）

- 派出 WP-7（HTTP 面唯一负责人：server.js/routes.js/labels.js + 通知器生产接线 + __test__ 三接缝 + D-47 收敛）。契约冻结点：六模块签名已全部合入。
- **WP-7 HTTP 面**（9305408）：routes.js +738 行挂 D-1 全量（只读 9 组 + 两条 SSE + 五条写接口经既有 CAS）；通知器生产接线（clock 注入 + D-46 替换呈现）；labels.js +140 行 A-11 键块、六模块 CJK 字面量归零；D-47 收敛（workflowDetailOf 导出）；18 测试 173 断言全绿；D-50（approvals 接缝覆盖层不入 totals + closeAllConnections 停机配套）。
- **批次 D 门禁**：全量 1523 / 1518 pass / 4 fail 差集 0；tests >= 1505 ✓。

## S2 批次 E 开工（2026-11-16）

- 派出 WP-8（桌面 UI 五视图 + harness dump）与 WP-9（壳层托盘/通知/ctl 四动作）并行。

### 批次 E 补记：429 中断后主控接管（2026-11-16）

- WP-8/WP-9 首轮 Agent 因平台 429 额度耗尽中断（非代码问题）——已落盘成果不丢弃，配额恢复后单批续派补齐。
- **WP-8**（ca5aed6）：视图模型 6 个纯函数模块 + app.js 五视图接线 + 5 个 harness + 30 条 UI 测试；D-51（/ui/labels 下发 95 个新键，154→249 + 五导航键）修复生产文案链路缺陷；D-52（open-queue ctl 分支）修复通知点击导航断点。
- **WP-9**（02fdbca）：main.rs SSE 订阅 + (kind,instanceId) 替换投递 + --no-notify + 托盘 2s 轮询；11 静态契约测试 + 1 真实探针 SKIP（旧二进制）；cargo check exit 0。
- **批次 E 门禁**：全量 1567 / 1561 pass / 4 fail 差集 0；tests >= 1554 ✓；purity ×2 exit 0；deps 0。

## S2 批次 F 开工（2026-11-16）

- 派 WP-11（回归红线 + 整合验收：test/wp14/regression.test.js + contract.test.js + e2e.test.js）。
- **WP-11**（本批提交）：35 测试全绿；三主链 6/6 逐字 diff 0；全量 1602 / 1595 pass / 4 fail 差集 0；D-53 四条口径裁决（读时健康度重算不计面板写 / live 快照不用于 AC-18/38 / shapeSnapshot 函数体锚点 / 对象表不入白名单）。

## S2 收口 / S3 开工

- S2 十个 WP 全部合入；进入 S3 逐 AC 取证（49 条）。

### S3 开工（2026-11-16）

- 派出验收 Agent：建 `acc11-f-*` 四件套 + `acc11-cases/`（**用例目录不带 -f**，I1.3 命名陷阱），先跑批次 A（AC-01~13）。
- 验收口径：证据分级（真实宿主/mock 实测/阻塞）、每条 AC ≥4 原始帧、判定三档不放宽、D-46/D-52/D-53 口径。

### S3 批次 A 收口（2026-11-16）

- 脚手架 acc11-f-* 五件套 + cases 13 条建好；批次 A 初跑 11 通过 / 2 不通过（AC-12/13）。
- 主控复跑并裁决 **D-54**：AC-12 会话校验锚点归位核心（D-11 禁改核心，queue.js 只转发）；AC-13 批量词 grep 排除否定语境注释 + fixture 按 Given 对调（INST-001 升级 / INST-002 真实审批，序列逐字一致）；需求升 v11；脚手架 grep 管道去 head -1（退出码陷阱）。
- 复跑 **13/13 全部通过**（每条 ≥5 原始帧，0 空文件）；已提交 bb60fb9 + 2af47e8 并推送。
- 派出批次 B（AC-14~26）。

### S3 批次 B 收口（2026-11-17）

- 初跑 11 通过 / 2 不通过（AC-15/18）；主控复跑裁决 **D-55**：AC-15 错误码/结论词锚点归位核心（queue.js 同源引用结论表，行为判定不变）；AC-18 pendingEscalations 字面零命中改零自算（排除 //、///、* 注释与 D-9 要求探针字段，计数断言不放宽）；需求升 v12。
- 环境假阴性：AC-14/18 的 EADDRINUSE 系 macOS socket 104 字节上限，短 TMPDIR 修复，断言未改。
- 复跑 **13/13 全通过**；A+B 累计 26/26、证据 291 个；提交 a0004c4 + e846e36 已推送。
- 派出批次 C（AC-27~38）。

### S3 批次 C 收口（2026-11-17）

- 初跑 11 通过 / 1 不通过（AC-27）；裁决 **D-56**：unavailable 锚点排除词表键引用（五档排序必需）+ 断言 FALLBACK_WORD=inactive。
- 自报缺口 AC-30：机检四件事（拖拽坐标/views 目录/事件名/选中态）未实现 → 裁决 **D-57** 补 `canvas-interaction.test.js`（369 行/4 用例），复跑 14/14。
- 批次 C 12/12；A+B+C 累计 **38/38**、证据 439 个；提交 9cec1e3 + cf2d463 已推送。
- 派出批次 D（AC-39~49，最后一批）。

### S3/S4 收口（2026-11-17）

- S3 四批取证全部完成：AC-01~49 **49/49 通过 / 0 不通过 / 0 阻塞**，704 核对项、588 证据文件；5 条裁决（D-54~D-58）+ 1 条接缝补齐（D-57）全部闭环复跑。
- 独立终验 Agent 六项校验全 PASS（`final-verification.md`）；未由实现/验收 Agent 兼任。
- S4 收口文档齐备：`report.md`（§4.1 骨架 0~6 节 + 附录）、`acceptance-product.md`（无真实宿主面说明）、`summary.head` 刷新至 0b0b9ff；四处数字一致（49/0/0、588、1606）。
- **I1.11 Done**：需求 49 AC 全部通过、零失败零阻塞、门禁全绿、三主链 diff 0、终验 PASS。
