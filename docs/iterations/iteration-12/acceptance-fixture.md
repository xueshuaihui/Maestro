# I1.12 验收取证夹具（acceptance fixture）

> 本文件由 `probe/acc12-f-final.mjs` 合并 `acc12-f-results.jsonl`（批次 A）与 `acc12-f-results-b.jsonl`（批次 B）
> + `acc12-f-parts/` + `evidence/` 重建，人工不直接编辑。A 段由批次 A 验收产出，B 段取自 `acceptance-fixture-b.md` 原文。
> 合并时仓库 HEAD=`2c53d40`；批次 B 取证时点为 `d20fccc`，A 批 AC-01 已在 `2c53d40` 按裁决 E 修复后复跑。

**总判：23 通过 / 0 不通过 / 0 阻塞**

| 批次 | 范围 | 通过 | 不通过 | 阻塞 | 核对项 | 原始证据（unique 文件名） |
|---|---|---|---|---|---|---|
| 批次 A | AC-01~AC-12 | 12 | 0 | 0 | 194/194 | 79 |
| 批次 B | AC-13~AC-23 | 11 | 0 | 0 | 144/144 | 82 |
| 总计 | AC-01~AC-23 | 23 | 0 | 0 | 338/338 | 161 |

- 核对项：A 批 194/194（AC-01 按裁决 E 修复后 22/22）+ B 批 144/144 = 338/338；逐条判定见下方 A/B 段与 `probe/acc12-f-blockers.md`。
- 阻塞：无。真实宿主面 AC-21 已按用户 2026-11-21 裁决补采（50 会话/20 并发、p95 1097ms < 2s、级别 `PERF_LEVEL_REAL`），重判记录见 `docs/iterations/iteration-12/ac21-realhost-reverify.md`；S3 阻塞帧保留在 `evidence/` 与 `evidence/acc21-real/`，未删改。

<!-- BATCH-A:START -->
## 批次 A（AC-01~AC-12）验收取证

- 生成时间：2026-11-21T17:48:26.170Z
- 证据分级：全部 `mock 实测`（本批次仅 mock / 夹具面，未声称真实宿主）
- 判定统计：通过 12 / 不通过 0 / 阻塞 0
- 核对项：194/194 通过
- 通过 AC：AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12
- 不通过 AC：（无）
- 阻塞 AC：（无）

| AC | 判定 | 证据分级 | 核对项 | 原始证据数 | 核对表 |
|---|---|---|---|---|---|
| AC-01 | 通过 | mock 实测 | 22/22 | 9 | [核对表](../../../probe/acc12-f-parts/AC-01.md) |
| AC-02 | 通过 | mock 实测 | 21/21 | 5 | [核对表](../../../probe/acc12-f-parts/AC-02.md) |
| AC-03 | 通过 | mock 实测 | 10/10 | 4 | [核对表](../../../probe/acc12-f-parts/AC-03.md) |
| AC-04 | 通过 | mock 实测 | 16/16 | 4 | [核对表](../../../probe/acc12-f-parts/AC-04.md) |
| AC-05 | 通过 | mock 实测 | 7/7 | 6 | [核对表](../../../probe/acc12-f-parts/AC-05.md) |
| AC-06 | 通过 | mock 实测 | 23/23 | 8 | [核对表](../../../probe/acc12-f-parts/AC-06.md) |
| AC-07 | 通过 | mock 实测 | 16/16 | 8 | [核对表](../../../probe/acc12-f-parts/AC-07.md) |
| AC-08 | 通过 | mock 实测 | 15/15 | 7 | [核对表](../../../probe/acc12-f-parts/AC-08.md) |
| AC-09 | 通过 | mock 实测 | 16/16 | 5 | [核对表](../../../probe/acc12-f-parts/AC-09.md) |
| AC-10 | 通过 | mock 实测 | 15/15 | 7 | [核对表](../../../probe/acc12-f-parts/AC-10.md) |
| AC-11 | 通过 | mock 实测 | 15/15 | 8 | [核对表](../../../probe/acc12-f-parts/AC-11.md) |
| AC-12 | 通过 | mock 实测 | 18/18 | 8 | [核对表](../../../probe/acc12-f-parts/AC-12.md) |

### 失败核对项

- （无）

### 阻塞/缺陷台账

- （无阻塞、无不通过缺陷；AC-01 按裁决 E 修复后复验 22/22 通过）

### 原始证据索引

- `docs/iterations/iteration-12/evidence/AC-01.fixture.events-bad.jsonl`（2718 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.fixture.events-good.jsonl`（2718 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.meta.result.json`（10480 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.run.status.txt`（59 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.run.stdout.txt`（782 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.summary.status.txt`（113 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.verify.bad.stdout.txt`（56 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.verify.good.stdout.txt`（23 bytes）
- `docs/iterations/iteration-12/evidence/AC-01.verify.module-result.json`（428 bytes）
- `docs/iterations/iteration-12/evidence/AC-02.fixture.after.events.jsonl`（1148 bytes）
- `docs/iterations/iteration-12/evidence/AC-02.fixture.baseline.events.jsonl`（665 bytes）
- `docs/iterations/iteration-12/evidence/AC-02.meta.fingerprints.json`（548 bytes）
- `docs/iterations/iteration-12/evidence/AC-02.summary.status.txt`（69 bytes）
- `docs/iterations/iteration-12/evidence/AC-02.verify.result.json`（206 bytes）
- `docs/iterations/iteration-12/evidence/AC-03.decision.allow.json`（466 bytes）
- `docs/iterations/iteration-12/evidence/AC-03.fixture.roles.json`（270 bytes）
- `docs/iterations/iteration-12/evidence/AC-03.meta.result.json`（15771 bytes）
- `docs/iterations/iteration-12/evidence/AC-03.summary.status.txt`（66 bytes）
- `docs/iterations/iteration-12/evidence/AC-04.decision.deny.json`（718 bytes）
- `docs/iterations/iteration-12/evidence/AC-04.fixture.roles.json`（270 bytes）
- `docs/iterations/iteration-12/evidence/AC-04.meta.result.json`（4289 bytes）
- `docs/iterations/iteration-12/evidence/AC-04.summary.status.txt`（129 bytes）
- `docs/iterations/iteration-12/evidence/AC-05.fixture.artifact-ok.md`（10 bytes）
- `docs/iterations/iteration-12/evidence/AC-05.fixture.handoff.json`（439 bytes）
- `docs/iterations/iteration-12/evidence/AC-05.meta.result.json`（1521 bytes）
- `docs/iterations/iteration-12/evidence/AC-05.summary.status.txt`（76 bytes）
- `docs/iterations/iteration-12/evidence/AC-05.verify.freshness.json`（37 bytes）
- `docs/iterations/iteration-12/evidence/AC-05.verify.full-chain.json`（18 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.fixture.artifact-F0.md`（10 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.fixture.artifact-F1.md`（10 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.fixture.handoff-mismatch.json`（442 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.fixture.handoff-missing.json`（443 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.meta.result.json`（5608 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.summary.status.txt`（113 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.verify.decision-mismatch.json`（296 bytes）
- `docs/iterations/iteration-12/evidence/AC-06.verify.decision-missing.json`（289 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.fixture.workflow-filled.json`（460 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.fixture.workflow-missing.json`（311 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.meta.result.json`（3964 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.summary.status.txt`（108 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.verify.review-cli.stdout.txt`（153 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.verify.review-filled.json`（122 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.verify.review-missing.json`（138 bytes）
- `docs/iterations/iteration-12/evidence/AC-07.verify.start-blocked.json`（299 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.fixture.workflow.json`（312 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.meta.result.json`（4056 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.summary.status.txt`（132 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.verify.decision-approved.json`（135 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.verify.decision-awaiting.json`（141 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.verify.review-after-ruling.json`（59 bytes）
- `docs/iterations/iteration-12/evidence/AC-08.verify.review-pending.json`（287 bytes）
- `docs/iterations/iteration-12/evidence/AC-09.fixture.events.jsonl`（758 bytes）
- `docs/iterations/iteration-12/evidence/AC-09.meta.result.json`（3337 bytes）
- `docs/iterations/iteration-12/evidence/AC-09.summary.status.txt`（117 bytes）
- `docs/iterations/iteration-12/evidence/AC-09.verify.primary-audit.json`（696 bytes）
- `docs/iterations/iteration-12/evidence/AC-09.verify.types.json`（130 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.fixture.events.jsonl`（699 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.meta.result.json`（3641 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.summary.status.txt`（214 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.verify.aggregate-recomputed.json`（91 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.verify.handoff-state-keys.json`（47 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.verify.primary-audit.json`（609 bytes）
- `docs/iterations/iteration-12/evidence/AC-10.verify.types.json`（113 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.fixture.parallel.json`（453 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.meta.result.json`（3572 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.summary.status.txt`（56 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.verify.decision-backfill.json`（210 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.verify.decision-initial.json`（242 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.verify.gate-waiting.json`（129 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.verify.state-after-backfill.json`（454 bytes）
- `docs/iterations/iteration-12/evidence/AC-11.verify.state-after-initial.json`（455 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.fixture.budget.json`（573 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.meta.result.json`（4197 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.summary.status.txt`（80 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.verify.decision-resume.json`（64 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.verify.decision-suspend.json`（77 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.verify.gate-suspend.json`（81 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.verify.state-resumed.json`（631 bytes）
- `docs/iterations/iteration-12/evidence/AC-12.verify.state-suspended.json`（632 bytes）

<!-- BATCH-A:END -->

<!-- BATCH-B:START -->

> **B 段时点说明**：B 段为批次 B 在 S3（取证时点 `d20fccc`）的原文，其中 AC-21 记「阻塞」。该条已由用户 2026-11-21 裁决补采真实宿主面并按 `PERF_LEVEL_REAL` 帧重判为**通过**（21/21 核对项，p95 1097ms < 2s），重判记录见 `docs/iterations/iteration-12/ac21-realhost-reverify.md`。B 段原文不改写，以保留审计链。

## 批次 B（AC-13~AC-23）验收取证

- 仓库根：`D:/WWW/Maestro`，HEAD=`d20fccc`
- 证据分级：AC-13~AC-20/AC-22/AC-23 = `mock 实测`；AC-21 = `阻塞`（真实宿主面未取证，不算失败）
- 判定统计：通过 10 / 不通过 0 / 阻塞 1
- 核对项：128/128 通过
- 通过 AC：AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-22, AC-23
- 不通过 AC：（无）
- 阻塞 AC：AC-21

| AC | 判定 | 证据分级 | 核对项 | 原始证据数 | 核对表 |
|---|---|---|---|---|---|
| AC-13 | 通过 | mock 实测 | 15/15 | 6 | [核对表](../../../probe/acc12-f-parts/AC-13.md) |
| AC-14 | 通过 | mock 实测 | 8/8 | 6 | [核对表](../../../probe/acc12-f-parts/AC-14.md) |
| AC-15 | 通过 | mock 实测 | 10/10 | 6 | [核对表](../../../probe/acc12-f-parts/AC-15.md) |
| AC-16 | 通过 | mock 实测 | 14/14 | 9 | [核对表](../../../probe/acc12-f-parts/AC-16.md) |
| AC-17 | 通过 | mock 实测 | 12/12 | 6 | [核对表](../../../probe/acc12-f-parts/AC-17.md) |
| AC-18 | 通过 | mock 实测 | 13/13 | 9 | [核对表](../../../probe/acc12-f-parts/AC-18.md) |
| AC-19 | 通过 | mock 实测 | 15/15 | 4 | [核对表](../../../probe/acc12-f-parts/AC-19.md) |
| AC-20 | 通过 | mock 实测 | 12/12 | 6 | [核对表](../../../probe/acc12-f-parts/AC-20.md) |
| AC-21 | 阻塞 | 阻塞 | 5/5 | 4 | [核对表](../../../probe/acc12-f-parts/AC-21.md) |
| AC-22 | 通过 | mock 实测 | 13/13 | 8 | [核对表](../../../probe/acc12-f-parts/AC-22.md) |
| AC-23 | 通过 | mock 实测 | 11/11 | 4 | [核对表](../../../probe/acc12-f-parts/AC-23.md) |

### 失败核对项

- （无）

### 阻塞/缺陷台账

- **AC-21（阻塞）**：真实宿主（DSH 0.2.2-rc.1）性能面未取证 → level=PERF_LEVEL_PENDING / blocked=true / 附 triedPaths；按裁决 A 第 3 条判阻塞，不得用 AC-20 的 mock 实测顶替、不得伪通过。详见 `probe/acc12-blockers-b.md` 与 `acceptance-product.md`。
- 其余 AC：无阻塞、无缺陷。

### 原始证据索引（批次 B，68 份 + 复用主控 AC-22 帧 3 份）

- `docs/iterations/iteration-12/evidence/AC-13.given.registry.json`（850 bytes）
- `docs/iterations/iteration-12/evidence/AC-13.meta.result.json`（3592 bytes）
- `docs/iterations/iteration-12/evidence/AC-13.then.import.json`（398 bytes）
- `docs/iterations/iteration-12/evidence/AC-13.then.negative-controls.json`（411 bytes）
- `docs/iterations/iteration-12/evidence/AC-13.when.build-workflow.stdout.txt`（641 bytes）
- `docs/iterations/iteration-12/evidence/AC-13.when.build.stdout.txt`（952 bytes）
- `docs/iterations/iteration-12/evidence/AC-14.given.package.json`（545 bytes）
- `docs/iterations/iteration-12/evidence/AC-14.meta.result.json`（1885 bytes）
- `docs/iterations/iteration-12/evidence/AC-14.summary.status.txt`（99 bytes）
- `docs/iterations/iteration-12/evidence/AC-14.then.confirm.txt`（77 bytes）
- `docs/iterations/iteration-12/evidence/AC-14.then.import.json`（178 bytes）
- `docs/iterations/iteration-12/evidence/AC-14.when.verify.stdout.txt`（103 bytes）
- `docs/iterations/iteration-12/evidence/AC-15.given.baseline.json`（101 bytes）
- `docs/iterations/iteration-12/evidence/AC-15.given.packages.json`（1102 bytes）
- `docs/iterations/iteration-12/evidence/AC-15.meta.result.json`（2924 bytes）
- `docs/iterations/iteration-12/evidence/AC-15.then.assets-after.json`（101 bytes）
- `docs/iterations/iteration-12/evidence/AC-15.then.import.txt`（355 bytes）
- `docs/iterations/iteration-12/evidence/AC-15.when.verify.txt`（355 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.meta.result.json`（3654 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.then.recheck.txt`（52 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.then.references.yaml`（140 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.then.summary.txt`（258 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.when.apply.status.txt`（26 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.when.apply.stdout.txt`（147 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.when.plan.json`（367 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.when.plan.status.txt`（26 bytes）
- `docs/iterations/iteration-12/evidence/AC-16.when.plan.stdout.txt`（130 bytes）
- `docs/iterations/iteration-12/evidence/AC-17.meta.result.json`（3331 bytes）
- `docs/iterations/iteration-12/evidence/AC-17.then.idem.txt`（457 bytes）
- `docs/iterations/iteration-12/evidence/AC-17.when.bad.status.txt`（26 bytes）
- `docs/iterations/iteration-12/evidence/AC-17.when.bad.stdout.txt`（99 bytes）
- `docs/iterations/iteration-12/evidence/AC-17.when.latest.status.txt`（26 bytes）
- `docs/iterations/iteration-12/evidence/AC-17.when.latest.stdout.txt`（20 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.given.before.json`（376 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.given.events.jsonl`（288 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.given.traces.jsonl`（240 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.meta.result.json`（3382 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.then.after.json`（358 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.then.arch-scan.txt`（39 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.then.exported.json`（1350 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.when.export.status.txt`（26 bytes）
- `docs/iterations/iteration-12/evidence/AC-18.when.export.stdout.txt`（104 bytes）
- `docs/iterations/iteration-12/evidence/AC-19.given.inputs.json`（2311 bytes）
- `docs/iterations/iteration-12/evidence/AC-19.meta.result.json`（3687 bytes）
- `docs/iterations/iteration-12/evidence/AC-19.then.arch-scan.txt`（28 bytes）
- `docs/iterations/iteration-12/evidence/AC-19.when.signals.json`（773 bytes）
- `docs/iterations/iteration-12/evidence/AC-20.given.events.jsonl`（12589 bytes）
- `docs/iterations/iteration-12/evidence/AC-20.meta.result.json`（2343 bytes）
- `docs/iterations/iteration-12/evidence/AC-20.summary.status.txt`（101 bytes）
- `docs/iterations/iteration-12/evidence/AC-20.then.report.json`（156 bytes）
- `docs/iterations/iteration-12/evidence/AC-20.then.tiers.txt`（104 bytes）
- `docs/iterations/iteration-12/evidence/AC-20.when.samples.json`（5752 bytes）
- `docs/iterations/iteration-12/evidence/AC-21.given.contract.json`（236 bytes）
- `docs/iterations/iteration-12/evidence/AC-21.meta.result.json`（1974 bytes）
- `docs/iterations/iteration-12/evidence/AC-21.perf-check.stdout.json`（825 bytes）
- `docs/iterations/iteration-12/evidence/AC-21.summary.status.txt`（243 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.check.deps.txt`（14 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.check.purity.txt`（456 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.check.usage.txt`（19 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.diffset.txt`（2236 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.full-suite.log`（358813 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.index.counts.json`（65 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.index.diffset.txt`（2236 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.index.full-suite.log`（3512 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.index.main-chains.log`（2098 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.main-chains.log`（2098 bytes）
- `docs/iterations/iteration-12/evidence/AC-22.meta.result.json`（6905 bytes）
- `docs/iterations/iteration-12/evidence/AC-23.given.decisions.json`（621 bytes）
- `docs/iterations/iteration-12/evidence/AC-23.meta.result.json`（2759 bytes）
- `docs/iterations/iteration-12/evidence/AC-23.then.git-diff.txt`（1807 bytes）
- `docs/iterations/iteration-12/evidence/AC-23.then.meta-diff.json`（2220 bytes）
<!-- BATCH-B:END -->

### 合并口径说明

- 证据计数按 `evidence/` 内唯一文件名去重、排除 0 字节；当前 161 份（A 79 + B 82），无重复名、无空文件。
- 批次 B 段保留 `acceptance-fixture-b.md` 原文（含其核对表、证据索引与取证时点记录），本脚本未改写其判定与数字；其 AC-22 行「8」为本批新采数，另有 3 份复用主控历史帧（`AC-22.index.*`），合并计数按 11 计入 B 批合计。
- 总计表与总判由 A/B 两份 results 逐条计算；任一 AC 缺记录、判定非法或证据为空时脚本直接非零退出，不落盘。
