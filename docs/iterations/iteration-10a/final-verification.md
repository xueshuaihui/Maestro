# I1.10a 终验（S4）— 阶段门、退出标准与交付物核对

> 生成时刻 2026-11-14T05:05:26.348Z · HEAD `7949e8a` · 由 `node probe/acc10-f-final.mjs` 重建（只读汇总，不改产品代码）。
> 判据：`docs/index.md` 迭代基线、`docs/iterations/iteration-10a/requirement.md` v2 §0/§3、`docs/iterations/iteration-10a.md` r2 §0/§5、`decisions.md` 裁决 A~Z。

## 0. 终验结论

**PASS** — S0 需求 v2、S1 拆分 r2、S2 六批实现与逐批独立评审、S3 逐 AC-01~37 取证均已完成；
37 条 AC 37 通过 / 0 不通过 / 0 阻塞，282/282 核对项通过，
全量回归差集 0、静态门禁 11/11，交付物 56/56 齐备。

## 1. 阶段门逐项核对

| 阶段 | 产物 | 结论 | 证据 |
|---|---|---|---|
| S0 需求 | `iteration-10a/requirement.md` v2（37 AC / 32 BR / 附录 A~D） | PASS | `review-round1.md`、`review-round2.md`、`requirement-understanding.md` |
| S1 拆分 | `iteration-10a.md` r2（WP-1~9 / 6 批 / DAG） | PASS | `split-review.md`、`split-review-round2.md`（PASS） |
| S2 实现 | 9 个 WP 分 6 批合入 + 逐批独立评审 | PASS | `review-batch1..6*.md`、`decisions.md` A~Y、HEAD `7949e8a` |
| S3 验收 | 逐 AC-01~37 取证 + 全量回归 | **PASS** | `acceptance-a.md`、`acceptance-b.md`、`evidence/`（37 目录 / 353 份） |
| S4 终验 | 阶段门 / 退出标准 / 交付物核对 | **PASS** | 本文件 + `summary.json` + `gates/gates.json` |

## 2. 退出标准逐条核对（拆分文档 §0）

| # | 标准 | 实测 | 结论 |
|---|---|---|---|
| 1 | 37 条 AC 100% 通过 / 0 不通过 / 0 阻塞 | 37 / 0 / 0 | PASS |
| 2 | 每条 AC 至少 4 份原始帧，按「AC 号 + 阶段 + 类型」落 evidence/ | 353 份 / 不足项 0 | PASS |
| 3 | 结论三档取「通过」（mock 实测），收口不带阻塞 | {"mock 实测":36,"mock 实测（结构断言）":1} | PASS |
| 4 | 全量失败集合差集 0、条数只增不减（≥1157） | 1370 tests / 差集 0 | PASS |
| 5 | 31 词两轮 / 零依赖 / 中文唯一来源 / 产物时效 | 11/11 | PASS |
| 6 | 规划逐字验收句（857 行）由 AC-26 现场实跑 | 通过 | PASS |
| 7 | 交付物清单（拆分文档 §5）齐备 | 56/56 | PASS |

## 3. 交付物清单核对（拆分文档 §5，S3 部分）

| 路径 | 存在 |
|---|---|
| `probe/acc10-f-lib.mjs` | ✅ |
| `probe/acc10-f-common.mjs` | ✅ |
| `probe/acc10-f-run.mjs` | ✅ |
| `probe/acc10-f-final.mjs` | ✅ |
| `probe/acc10-f-gen.mjs` | ✅ |
| `probe/acc10-f-gates.mjs` | ✅ |
| `probe/acc10-cases/README.md` | ✅ |
| `probe/acc10-cases/ac01.mjs` | ✅ |
| `probe/acc10-cases/ac37.mjs` | ✅ |
| `probe/acc10-f-results.jsonl` | ✅ |
| `probe/acc10-f-summary.json` | ✅ |
| `probe/acc10-f-blockers.md` | ✅ |
| `docs/iterations/iteration-10a/acceptance-a.md` | ✅ |
| `docs/iterations/iteration-10a/acceptance-b.md` | ✅ |
| `docs/iterations/iteration-10a/results.jsonl` | ✅ |
| `docs/iterations/iteration-10a/summary.json` | ✅ |
| `docs/iterations/iteration-10a/report.md` | ✅ |
| `docs/iterations/iteration-10a/evidence/gates/gates.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/gates/full-suite.log` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-01/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-02/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-03/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-04/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-05/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-06/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-07/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-08/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-09/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-10/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-11/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-12/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-13/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-14/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-15/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-16/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-17/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-18/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-19/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-20/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-21/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-22/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-23/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-24/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-25/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-26/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-27/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-28/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-29/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-30/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-31/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-32/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-33/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-34/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-35/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-36/result.json` | ✅ |
| `docs/iterations/iteration-10a/evidence/AC-37/result.json` | ✅ |

**无缺失。**

## 4. 证据分级与本机保留项

- 本迭代 B 类验收：mock 宿主 + 真实 core / daemon + 真实 Tauri 壳；**不接真实 DSH、不需模型凭据**（需求 §3.3）。真实宿主取证属本机保留项。
- R-12：AC-22 证据等级 `mock 实测（结构断言）`，真实壳内拖拽的窗口级自动化补证留待后续迭代，不冒充真实宿主实测。
- R-13：壳面 skip 判据两侧一致；本轮实测 0 条 skip，重建命令 `env -u NODE_OPTIONS npm run desktop:build` 已写进脚手架纪律。
- 已知基线 9 条（历史 8 + R-08 的 AC-04）不改历史文件，不以「零失败」判定；详情 `probe/acc10-f-blockers.md`。

## 5. 工作区卫生

- `.workbuddy/memory/*.md` 与历史 `docs/iterations/regression-2026-11-09*` 属会话/历史材料，**不纳入本迭代提交**。
- 全量测试改写的 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 已用 `git checkout --` 还原，未混入交付。
- 本迭代新增文件只含 `probe/acc10-*`、`docs/iterations/iteration-10a/evidence/` 与 `docs/iterations/iteration-10a/` 下的 S3/S4 报告与裁决。

## 6. 复跑方式

```bash
cd /Users/xuesh/www/Maestro
node probe/acc10-f-gen.mjs --check
node probe/acc10-f-run.mjs --all
ACC10_FULL_LOG=/tmp/i10a-s3-full.log node probe/acc10-f-gates.mjs
node probe/acc10-f-final.mjs
```
