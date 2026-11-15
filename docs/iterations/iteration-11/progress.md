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
