# I1.12 迭代进度台账

> 治理加固 + 预算配额 + 生态能力 + 性能基线。分支 `feat/i1.12-governance`，基线 HEAD `0b12bd8`。I1.11（通知/干预队列/资产库/画布/证据浏览）由其他同学并行实现，本迭代不碰其文件。

## 阶段总览

| 阶段 | 任务 | 负责角色 | 开始 | 结束 | 结论 | 产物 | 评审 |
|---|---|---|---|---|---|---|---|
| S0 | 需求生成与评审闭环 | 撰写/修复/理解 Agent | 2026-11-17 | 2026-11-18 | **PASS**（DoR 12 绿/1 黄/0 红，S0 Gate 满足） | `requirement.md` v2（23 AC / 19 BR / 5 NF）、`decisions.md`（裁决 A）、`review-round1/2.md`、`requirement-understanding.md` | round1 PASS（0 阻断/6 建议）→ 吸收建议出 v2 → round2 PASS（0 阻断/6 建议移交 S1 §7） |
| S1 | 拆分 / 选型（8 节 + AC→WP 满覆盖） | 拆分 Agent | 2026-11-18 | 2026-11-18 | **PASS**（round1 FAIL 1 阻断 → 裁决 B 扩授权 → round2 PASS 0 阻断） | `iteration-12.md`（7 WP / 35 文件零交集 / 23/23 覆盖）、`split-review.md`、`split-review-round2.md` | round1 FAIL（SR-01 roles.js/workflows.js 授权缺口）→ 裁决 B → 修复 → round2 PASS（0 阻断/1 建议）|
| S2 | 分批次实现（WP-1~WP-7） | 实现 / 修复 Agent | 2026-11-18 | 2026-11-19 | **PASS**（批次1/2/3 均评审 PASS；WP-7 三轮评审，最终 round3 阻断 0 / 建议 0） | `src/**` `test/wp15/**` `probe/acc12-perf.mjs` | `review-batch1*.md`、`review-batch2*.md`、`s2-review-wp7*.md` |
| S3 | 验收逐条取证 | 验收 Agent | 2026-11-19 | 2026-11-19 | **PASS（S3 时点 22 通过 / 0 不通过 / 1 阻塞）**：AC-21 真实宿主未取证，按裁决 A 判阻塞、不用 mock 顶替。**2026-11-21 补采后 → 23 通过 / 0 不通过 / 0 阻塞**（AC-21 重判 21/21） | `acceptance-fixture.md`、`acceptance-product.md`、`ac21-realhost-reverify.md`、`evidence/`+`evidence/acc21-real/`、`probe/acc12-f-*` | 主控复跑 AC-01（22/22）、AC-04（16/16）、AC-12（18/18）、AC-21（21/21）；summary 23/0/0、338/338、161 |
| S4 | 终验与收口 | 终验 Agent / 主控 | 2026-11-19 | 2026-11-21 | v1 终验六项 + 需求评审闭环全 PASS，但 §4.5 Done **不满足**（仅 AC-21 阻塞）→ 用户 2026-11-21 裁决补采 → AC-21 转通过 → **v2 口径 Done 全部满足、本迭代收口** | `final-verification.md`（v1）、`final-verification-v2.md`（v2）、`report.md`、`probe/acc12-f-{summary.json,blockers.md}` | 主控复核四处数字一致（23/0/0、338/338、161、全量 1927/1895/21/11 差集 0） |

## 需求基线要点（S0 定稿）

- **23 AC / 19 BR / 5 NF**；规划 12 子项 + 验收句 6 点逐字覆盖，覆盖表 18/18，反向夹带 0。
- **裁决 A**（`decisions.md`）：命令名冻结 `orch migrate` / `orch verify <包>` / `orch export <类型>`（+ `verify <实例>` 链校验）；AC-21 Then「v1 阶段」措辞按 Then 零改动铁律保留、由新增契约行统一口径、不视为降级；reason 码 `wake.not-whitelisted` 冻结（既有 `wake.rejected` 不动）。
- **性能证据分级**：AC-20 mock 压测任何环境可做（mock 实测）；AC-21 真实宿主（本机 DSH 0.2.2-rc.1）取证留本机，未取证判**阻塞**（不算失败），mock 不得顶替、不得伪通过。
- **I1.11 边界**：证据过期检测/人工终审只做治理侧判定结果，不定义 UI/按钮/文案；实现文件零交集（AC-23 机检）。
- **回归红线**：I1.10b 51 AC + I1.9 27 AC 只增不改；USAGE_LINES 25 行不变；purity 31 词；中文唯一来源 `src/cli/labels.js`。

## 移交 S1 的注意事项（round2 六条建议 + DoR 黄项）

1. F2-01~F2-06 六条建议全部落 S1 §7 风险，不得当阻断回退需求。
2. S2 先落地 D-13 冻结清单（三命令 + reason 码 + handler 挂载 + 独立用法块 + REASON_LABEL 加键），既有 25 行不改。
3. AC-21 取证窗口由主控安排；mock 面先收口。
4. DoR-9 按裁决 G 每轮重算「≥1425 + 允许集合差集 0」。
5. 全程守回归红线与 I1.11 零交集。

## 过程留痕

- 2026-11-17：创建分支 `feat/i1.12-governance`（基线 `0b12bd8`），未带入 I1.11 改动。
- 2026-11-17：S0 需求 v1（23 AC）→ round1 PASS（0 阻断/6 建议）→ 吸收建议出 v2 + 裁决 A → round2 PASS（0 阻断）。
- 2026-11-18：需求理解纪要完成，13 条 DoR 12 绿/1 黄/0 红，S0 Gate 满足。
- 2026-11-18：S1 拆分 round1 FAIL（SR-01：WP-4 用 roles.js/workflows.js 但 D-13 未授权）→ 裁决 B 正式扩 D-13 授权（只授权 export/import handler 段、只加不改）→ 需求 v2→v2.1 补授权 + 拆分修复 → round2 PASS（0 阻断）。修正拆分文档 4 处错误码笔误 `HAND_OFF_HASH_MISMATCH`→`HANDOFF_HASH_MISMATCH`（真实码，handoff-schema.js:24）。
- 历史证据 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 曾被评审跑全量测试覆盖写，已用 `git -c core.autocrlf=false checkout-index -f` 恢复（内容 diff 空）。
- 2026-11-18：S2 批次 1（WP-1/2/3）提交 `a0d1be4`，`review-batch1.md` B1-01 FAIL → `review-batch1-round2.md` PASS（裁决 C 恢复 verifyChain 冻结签名）。
- 2026-11-18：S2 批次 2（WP-4/5/6）提交 `fc384ef`，`review-batch2.md` B2-01 FAIL → `review-batch2-round2.md` PASS（WP-6 三值改 ASCII 机器键，中文移交 labels）。
- 2026-11-19：S2 批次 3（WP-7 接线包）三轮评审：`s2-review-wp7.md` FAIL（四门禁 advisory no-op 等 9 项）→ 裁决 D 扩授权 + 修复 → `s2-review-wp7-round2.md` FAIL（N-01 `verify review` 误判已配终审路径）→ 二次修复 → `s2-review-wp7-round3.md` PASS（阻断 0 / 建议 0）。主控复跑定向 57/57、`--help` 25+6 行、purity 双目录 exit 0、deps 0、diff-check 0；批次 3 提交 `d20fccc`。
- 2026-11-19：全量门禁实跑最终帧 `tests 1660 / pass 1637 / fail 14 / skipped 9 ≥ 1425`；14 条失败全部落允许集合（12 条 win32 16 项登记 + `HANDOFF_EVIDENCE_ESCAPE` / `AC-04` 两条裁决 K S0 既有红），**差集 0**；原始帧 `evidence/AC-22.full-suite.final.log`。过程出现一次 `三主链` 负载 flake，单文件隔离 8/8 全绿留帧，最终全量未复现。历史性能证据已恢复。
- 2026-11-19：S3 验收完成。批次 A（AC-01~12）12/12 通过（AC-01 首轮发现 CLI 序号误报 → 裁决 E 修复 `d1fce53` → 复跑 22/22）；批次 B（AC-13~23）10 通过 / AC-21 阻塞 / 0 不通过。合并总判 **22 通过 / 0 不通过 / 1 阻塞**，核对项 **322/322**，唯一证据 **153** 份；AC-21 真实宿主未取证，保留 `PERF_LEVEL_PENDING/blocked`，未用 mock 顶替。
- 2026-11-19：S3 证据计数口径统一为 **153**（`progress.md`、`acceptance-merge.md` 原写 150/71，实盘 A 79 + B 74 = 153），提交 `3ea10ba`；Done 条件 6 由此满足。
- 2026-11-19：S4 收口产物落盘——`final-verification.md`（独立终验）、`report.md`（§0~§6 + 附录）、`summary.json`（迭代级，与 `probe/acc12-f-summary.json` 同源）、`probe/acc12-f-consistency.txt`（四处数字一致性核对，0 不一致）、`probe/acc12-f-s4-gates.txt`（purity 双目录 exit 0 / deps 0 / diff-check 0 / USAGE_LINES 25+6 / help 31 行）。
- 2026-11-19：主控复核终验时发现一处**归因错误并修正**：终验 §1.4 把最终帧 14 条失败写成「win32 11 + S0 既有红 2 + flake 1」，与 `evidence/AC-22.diffset.txt` 及 `AC-22.full-suite.final.log` 的 `^not ok` 逐行清单不符；实际为 **win32 登记 12 + S0 既有红 2 = 14，最终帧不含 flake**（`live 取消` 的隔离复跑是过程帧「三主链」flake 的证伪性诊断）。已同步修正 `final-verification.md` §1.4/§2、`report.md` §0/§4、`summary.json` 的 `gate.allowedSet/inAllowedSet`，计数结论（差集 0）不变。
- 2026-11-19：**I1.12 最终状态 = 22 通过 / 0 不通过 / 1 阻塞（AC-21）**。按 `execution-template.md` §4.5，Done 条件 1/2/5 不满足，**不宣布结束、不把阻塞写成通过、不抹去 `blocked=1`**；等待用户就 AC-21 二选一裁决：①安排本机真实宿主取证窗口（附录 D-11，20 实例/50 会话 → `PERF_LEVEL_REAL`）后复判；②书面豁免并保留 §5.1 登记。
- 2026-11-19：AC-21 阻塞根因复核（S4 补充诊断）。`probe/acc12-cases/AC-21.mjs` 未复用产品 `resolveDshLaunch()`，只探三个本机不存在的 `dsh.exe` 路径并硬编码 `PERF_LEVEL_PENDING`；改走产品宿主发现后真实宿主可跑通（`0.2.2-rc.3`）：1 会话 **743.8ms**、5 会话/2 并发 **5/5**（547/665/726/1008/1473ms，均 <2s）。帧落 `probe/acc12-perf-pilot{,-5}.json`，**不计入 S3 的 153 份证据**（S3 证据集已随 `3470241` 冻结）。
- 2026-11-19：用户裁决「**停在试点，不再跑全量**」（`decisions.md` 裁决 F）→ AC-21 **维持阻塞**（试点未达 20 实例/50 会话口径，`PERF_LEVEL` 不升）；阻塞定性由「本机无真实宿主面」修正为「取证脚手架未使用产品宿主发现逻辑，导致未取证」，判定与 §4.5 Done 结论均不变。`report.md` §5.1.1/§5.2、`summary.json.pilotDiagnostics`、`probe/acc12-f-blockers.md` 已同步。
- 2026-11-19：**合入 I1.11**（`origin/main` 已推进至 `b1fb82c`）。唯一文本冲突 `src/cli/labels.js`（双方均在文件末尾追加导出块）按「两者都保留」解决；复核 216 导出无重名、`USAGE_LINES` 25 行不变、`REASON_LABEL` 49 键、`--help` 31 行。合并提交 `10af3c2`。
- 2026-11-19：合并引入**一处语义冲突**——I1.11 的 D-14 冻结锚点 `test/wp14/regression.test.js`（`RUNTIME_COMMANDS` 恰 11 条 / `RUNTIME_SUBS` 恰 6 组）与 I1.12 按裁决 A/D-13 的合法扩项冲突。出**裁决 G**：锚点改为「前 11 条逐字不变 + 尾部恰为 `migrate/verify/export`」，`verify` 子命令组单列断言，不放松为子集；产品代码零改动。
- 2026-11-19：**集成回归差集口径**改为「对照 `origin/main` 基线树红名单」（裁决 G）。基线树 `b1fb82c`：1707 / 1671 pass / **25 fail** / 11 skip；合并树：1841 / 1808 pass / **22 fail** / 11 skip；**新增红 0 条**，另有 3 条基线红消失。帧：`probe/acc12-merge{,-baseline}-full.log`、`probe/acc12-merge-diffset.txt`。
- 2026-11-19：其余门禁复跑——purity 双目录 exit 0（45 + 42 文件）、deps 0、`git diff --check` 0、三主链隔离 8/8。`report.md` 判定表/§4/§6 与 `summary.json.gate` 已同步为合并后数字（S3 帧保留为 `s3Frame`，不覆盖历史）。
- **2026-11-21：用户改判「跑满 20/50 真实取证」（推翻裁决 F 第 1 条的「停在试点」，其余纪律保留）→ AC-21 解除。** 步骤：① 先修 `probe/acc12-perf-pilot.mjs` 的 `waitFirstEvent` 并发事件归属缺陷（原取 `sentAt` 之后任意会话的首条 `session/update`，并发下会串台、低估延迟），改为按 `params.sessionId` 过滤并落 `firstEventRaw` 原始帧；② 1 会话冒烟确认 `session/update.params.sessionId` 存在且归属一致（901.7ms）；③ 8 会话/4 并发验证（8/8、串台 0、max 1081ms）；④ 真实 DSH **`0.2.2-rc.5`** 跑 **50 会话 / 20 并发**（隔离 `DSH_HOME`，未碰用户 `~/.dsh`，用完即删）：**50/50 成功、0 串台、0 error、distinctInstances=50、distinctSessions=50、min 436 / median 695 / p95 1097 / max 1353 ms、over2s=0**，`perfLevel=PERF_LEVEL_REAL`、`blocked=false`。
- **2026-11-21：AC-21 独立验收重判（干净上下文 Agent）→ 通过 21/21、`grading=已实测（真实宿主面）`。** 用例改动仅「取证来源」：从硬编码 `samples:[]`+`PENDING` 改为读正式帧并经产品 `buildPerfReport`/`statsOf` 复算；**阻塞出口保留**（帧缺失/PENDING/不达标仍判阻塞，负控实测 8/21、9/21 均判阻塞）；Then 目标值文案逐字未动；S3 冻结的 4 份阻塞帧与 `results-b.jsonl` 旧行一字未改。回执 `ac21-realhost-reverify.md`。主控复核：用产品 `statsOf` 独立复算 p95 = **1097ms**（验收 Agent 指出原报 1077 为漏线性插值的低位取值，已更正；两者均 <2s）。
- **2026-11-21：I1.12 收口。** 汇总器 `probe/acc12-f-final.mjs` 的 AC-21 硬编码阻塞文案改为动态渲染（不改判定逻辑），追加 AC-21 重判记录到 `results-b.jsonl`（last-per-ac 取新记录），新证据以 `AC-21.real.*` 前缀平铺到 `evidence/` 避免与 S3 旧帧同名冲突。重生成结果：**23 通过 / 0 不通过 / 0 阻塞、核对项 338/338、证据 161 份、空文件 0**。B 段保留 S3 原文并加「B 段时点说明」，不改写历史判定。
- **2026-11-21：修 `test/wp13/session-failure.test.js` 的 AC-63/64 升级落盘时序 flake。** 现象：`waitFor(session.rebuild_failed)` 后立即读盘断言 `escalations.length`，事件广播早于升级落盘（不变量 37「等迁移落定再取证」），全量中 6/8、8/8、6/8 波动。修法：只补「等升级落定」等待，**断言一字未改**。修后 4/4 稳定，全量回到 1927/1895/21/11、差集 EXTRA=0。
