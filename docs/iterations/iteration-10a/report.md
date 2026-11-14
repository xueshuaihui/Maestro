# I1.10a 实现与验收报告 — 桌面应用壳 + 全局实例列表 + 角色流程图基础

> **需求**：`docs/iterations/iteration-10a/requirement.md` **v2**（37 条 AC / 32 条 BR / 附录 A-0~A-14 + B + C + D-1~D-14）。
> **拆分**：`docs/iterations/iteration-10a.md` **r2**（WP-1 ~ WP-9，6 个 S2 批次，DAG 汇合点）。
> **裁决**：`docs/iterations/iteration-10a/decisions.md` A~Z（裁决 Z 固定 S3 脚手架口径、NODE_OPTIONS 环境根因、R-12/R-13 处置）。
> **S2**：6 批逐批独立评审收口（终值 1370 tests / 1365 pass / 4 fail / 1 skip，差集 0），HEAD `7949e8a`。
> **S3 验收记录**：`acceptance-a.md`（AC-01~19）、`acceptance-b.md`（AC-20~37）、`evidence/`（37 目录 / 353 份原始帧）、`results.jsonl`、`summary.json`。
> **生成时刻**：2026-11-14T05:05:26.340Z（由 `node probe/acc10-f-final.mjs` 重建）。

---

## 0. 总体结论

**S3 判定：PASS。** 37 条 AC 逐条取证完成，37 通过 / 0 不通过 / 0 阻塞；
282/282 条核对项通过，40 条 Then 逐字核对项均已登记；每条 AC 至少 4 份原始帧（实际 353 份 / 37 条）。

| 项 | 数值 |
|---|---|
| AC 判定 | **37 通过 / 0 不通过 / 0 阻塞** |
| 核对项 | 282/282（100.0%）；其中 0 项为整文件 F-16 失败留证项，由 AC 级隔离机检判定（需求 §3.3） |
| 逐字 Then | 40 条（需求 §3.1 逐字抽取，`acc10-f-gen.mjs --check` 37/37 一致） |
| 证据 | 37 个 AC 目录 / 353 份原始帧 / 最少 4 份每条（不足项：无） |
| 全量回归 | `1370 tests / 1365 pass / 4 fail / 1 skipped`；失败集合与判定基线 9 条**差集 0**；条数 ≥ 1157（是） |
| 静态门禁 | 11/11 通过（31 词两轮、零依赖、CJK 零命中、AC 37 条、USAGE_LINES 25、无宿主分支、产物时效、提交卫生） |
| 壳面 SKIP | 0 条（R-13：skip 需写明重建产物） |
| 复跑 AC | 0 条（每次 attempt 原始帧全保留，断言未改） |

## 1. 验收范围与判定口径

- **B 类验收**（需求 §3.3）：mock 宿主 + 真实 core / daemon + 真实 Tauri 壳；不接真实 DSH、不需模型凭据。真实宿主取证属本机保留项，不在本迭代判定。
- **证据三档**：`mock 实测` / `mock 实测（结构断言）`（仅 AC-22，R-12）/ `阻塞`。
- **F-16 机检模板**：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`，断言退出码 0 / `# pass ≥ 1` / `# fail 0`；禁全量 glob 代替。
- **Then 逐字口径**：判据原文由生成器从需求 §3.1 逐字抽取进 37 个用例文件，逐字断言由同名契约测试承载（拆分文档 §4），S3 用 F-16 机检 + 架构检查独立复核。
- **夹具隔离**：runner 注入 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，契约测试内部 `os.tmpdir()` 落在该目录；`fixture-roots.json` 记录实际子根。
- **环境口径（裁决 Z 决定 2）**：逐 AC F-16 保留本机默认 `NODE_OPTIONS` 预加载（需求 §3.3 只强制 `NODE_ENV=test`）；全量回归门禁按裁决 V 用 `env -u NODE_OPTIONS`。剥离预加载会让 mock 宿主一轮完成过快，触发 R-08 已登记时序竞态（AC-04 `running`→`completed`）；两种环境原始帧都留证，全量失败集合按判定基线 9 条核算、差集 0。
- **文本扫描**：一律 `grep -E` / `grep -RE`（ERE），禁 BRE `\|` 交替（本机 toybox shim 会假通过）。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `probe/acc10-f-{lib,common,run,final,gen,gates}.mjs` | S3 验收脚手架六件（拆分文档 §5 四件套 + 生成器 + 门禁取证，可复跑） |
| `probe/acc10-cases/ac01..ac37.mjs` + `README.md` | 逐 AC 用例（判据原文逐字，`--check` 37/37 与需求一致） |
| `probe/acc10-f-parts/AC-xx.md` | 37 份逐 AC 核对表（判据原文 / 核对项 / 命令与退出码 / 证据 sha256） |
| `probe/acc10-f-results.jsonl` / `-summary.json` / `-blockers.md` | 结果流水 / 汇总 / 缺陷台账 |
| `docs/iterations/iteration-10a/evidence/AC-xx/` | 逐 AC 原始帧（TAP 日志、摘要、用例名、架构检查输出、Then 映射、判据原文、夹具根、结果） |
| `docs/iterations/iteration-10a/evidence/gates/` | 全量回归日志 + 静态门禁原始输出 + `gates.json` |
| `acceptance-a.md` / `acceptance-b.md` / `results.jsonl` / `summary.json` / `report.md` / `final-verification.md` | S3 验收报告与 S4 终验台账 |

## 3. 全量回归门禁（NF-6 / 判定基线 9 条）

```text
env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
# tests 1370  # pass 1365  # fail 4  # skipped 1
```

失败集合：

- `AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新`
- `task-loop 审核提示词给绝对路径：基址与 readReview 同源，避免宿主写进实例工作区`
- `core.stop：先回包再断连，5s 内收敛，core.json 仍可读`
- `main：--cwd 相对当前 shell 目录解析，不作为项目根`

全部 ⊆ 判定基线 9 条（历史 8 条 + 裁决 R 的 AC-04 允许项），**差集 = 0**；条数 1370 ≥ 1157。
历史 `docs/iterations/iteration-7/baseline-failures.txt` 不改，不以「零失败」判定（需求 §3.3 / 裁决 T B-39）。

## 4. 证据分级与残留项

- **R-12（AC-22）**：真实壳内拖拽仍是结构断言（写入端 `config.rs` 零窗口级自动化用例）。本轮单列 `mock 实测（结构断言）`，补 `view-state.test.js` + `config.rs` 路径常量结构证据，不冒充真实宿主实测。
- **R-13**：`bundleFreshness()` 与 `regression.test.js` 判据面一致，不为对齐削弱任一侧；本轮壳面实测 0 条 skip，脚手架统一按「skip 必须写明需 `env -u NODE_OPTIONS npm run desktop:build`」执行。
- **环境偏差**：AC-05 / AC-11 的原文 `grep -R ... desktop/` 命中 bundle 构建产物内产品源码副本，按「原文留证 + 界面层作用域零命中判定」处置，详见 `probe/acc10-f-blockers.md` ③。
- **基线项与环境根因**：全量门禁按裁决 V 用 `env -u NODE_OPTIONS`，AC-04 因剥离预加载后 mock 宿主完成过快而触发 R-08 时序竞态（`running`→`completed`）；逐 AC F-16 按需求 §3.3 只注入 `NODE_ENV=test`、保留默认 `NODE_OPTIONS`，同文件 `2p/0f` 稳定通过。两种环境原始帧均留证，判定基线 9 条、差集 0 不变；余下 3 条全量失败（`task-loop 审核提示词` / `core.stop` / `main --cwd`）均属历史基线。

## 5. 退出标准逐条核对（需求 §3.1 判定口径 / 拆分文档 §0）

| # | 退出标准 | 实测 | 结论 |
|---|---|---|---|
| 1 | 37 条 AC 100% 通过 / 0 不通过 / 0 阻塞 | 37/0/0 | PASS |
| 2 | 每条 AC 至少 4 份原始帧，按「AC 号 + 阶段 + 类型」落 evidence/ | 37 目录 / 353 份 / 不足项 0 | PASS |
| 3 | 结论三档取「通过」（mock 实测），收口不带阻塞 | {"mock 实测":36,"mock 实测（结构断言）":1} | PASS |
| 4 | 全量测试失败集合差集 0、条数只增不减 | 差集 0 / 1370 ≥ 1157 | PASS |
| 5 | 31 词两轮 purity / 零依赖 / 中文唯一来源 | 11/11 静态门禁通过 | PASS |
| 6 | 规划逐字验收句（857 行）由 AC-26 在夹具现场实跑通过 | AC-26 通过（`acceptance-e2e.test.js` 三段壳面探针） | PASS |

## 6. 复跑方式

```bash
cd /Users/xuesh/www/Maestro
node probe/acc10-f-gen.mjs --check                 # 用例与需求逐字一致
node probe/acc10-f-run.mjs --batch a              # AC-01~10（b/c/d 同理）
ACC10_FULL_LOG=/tmp/i10a-s3-full.log node probe/acc10-f-gates.mjs
node probe/acc10-f-final.mjs                      # 重建全部报告与台账
```
