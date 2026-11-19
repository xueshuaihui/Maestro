# I1.12 迭代进度台账

> 治理加固 + 预算配额 + 生态能力 + 性能基线。分支 `feat/i1.12-governance`，基线 HEAD `0b12bd8`。I1.11（通知/干预队列/资产库/画布/证据浏览）由其他同学并行实现，本迭代不碰其文件。

## 阶段总览

| 阶段 | 任务 | 负责角色 | 开始 | 结束 | 结论 | 产物 | 评审 |
|---|---|---|---|---|---|---|---|
| S0 | 需求生成与评审闭环 | 撰写/修复/理解 Agent | 2026-11-17 | 2026-11-18 | **PASS**（DoR 12 绿/1 黄/0 红，S0 Gate 满足） | `requirement.md` v2（23 AC / 19 BR / 5 NF）、`decisions.md`（裁决 A）、`review-round1/2.md`、`requirement-understanding.md` | round1 PASS（0 阻断/6 建议）→ 吸收建议出 v2 → round2 PASS（0 阻断/6 建议移交 S1 §7） |
| S1 | 拆分 / 选型（8 节 + AC→WP 满覆盖） | 拆分 Agent | 2026-11-18 | 2026-11-18 | **PASS**（round1 FAIL 1 阻断 → 裁决 B 扩授权 → round2 PASS 0 阻断） | `iteration-12.md`（7 WP / 35 文件零交集 / 23/23 覆盖）、`split-review.md`、`split-review-round2.md` | round1 FAIL（SR-01 roles.js/workflows.js 授权缺口）→ 裁决 B → 修复 → round2 PASS（0 阻断/1 建议）|
| S2 | 分批次实现（WP-1~WP-7） | 实现 / 修复 Agent | 2026-11-18 | 2026-11-19 | **PASS**（批次1/2/3 均评审 PASS；WP-7 三轮评审，最终 round3 阻断 0 / 建议 0） | `src/**` `test/wp15/**` `probe/acc12-perf.mjs` | `review-batch1*.md`、`review-batch2*.md`、`s2-review-wp7*.md` |
| S3 | 验收逐条取证 | 验收 Agent | 2026-11-19 | 2026-11-19 | **PASS（22 通过 / 0 不通过 / 1 阻塞）**：AC-21 真实宿主未取证，按裁决 A 判阻塞、不用 mock 顶替 | `acceptance-fixture.md`、`acceptance-product.md`、`evidence/`、`probe/acc12-f-*` | 主控复跑 AC-01（22/22）、summary 22/0/1、322/322、150 证据 |
| S4 | 终验与收口 | 终验 Agent | 2026-11-19 | — | 进行中 | `final-verification.md` `report.md` `summary.json` | 六项校验 |

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
- 2026-11-19：S3 验收完成。批次 A（AC-01~12）12/12 通过（AC-01 首轮发现 CLI 序号误报 → 裁决 E 修复 `d1fce53` → 复跑 22/22）；批次 B（AC-13~23）10 通过 / AC-21 阻塞 / 0 不通过。合并总判 **22 通过 / 0 不通过 / 1 阻塞**，核对项 **322/322**，唯一证据 **150** 份；AC-21 真实宿主未取证，保留 `PERF_LEVEL_PENDING/blocked`，未用 mock 顶替。
