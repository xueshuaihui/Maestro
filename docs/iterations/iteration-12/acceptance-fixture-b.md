<!-- 本段由批次 B 验收产出，供合并到 acceptance-fixture.md 的 BATCH-B 区块；人工不直接编辑主文件 -->
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
