# I1.10a 实现与验收报告 — 桌面应用壳 + 全局实例列表 + 角色流程图基础

> **需求**：`docs/iterations/iteration-10a/requirement.md` **v4**（44 条 AC / 39 条 BR / 附录 A-0~A-14 + B + C + D-15）。
> **拆分**：`docs/iterations/iteration-10a.md` **r3**（WP-1 ~ WP-12，9 个 S2 批次，DAG 汇合点）。
> **裁决**：`docs/iterations/iteration-10a/decisions.md` A~Z（裁决 Z 固定 S3 脚手架口径、NODE_OPTIONS 环境根因、R-12/R-13 处置）。
> **S2**：6 批逐批独立评审收口（终值 1370 tests / 1365 pass / 4 fail / 1 skip，差集 0），HEAD `a093ede`。
> **S3 验收记录**：`acceptance-a.md`（AC-01~19）、`acceptance-b.md`（AC-20~37）、`acceptance-c.md`（AC-38~44，发布面）、`evidence/`（44 目录 / 425 份原始帧）、`results.jsonl`、`summary.json`。
> **全量基线的条数变化**：S2 终值 1370 条 → 本次 1425 条，差额来自 `origin/main` 并行合入的 I1.7 代码隔离与 I1.8 实例恢复用例（非本迭代新增）；
> 判定仍按「失败集合与基线 9 条差集 = 0」，条数只作下限（≥ 1157），不拿总数涨跌当结论。
> **生成时刻**：2026-11-15T14:08:09.107Z（由 `node probe/acc10-f-final.mjs` 重建）。

---

## 0. 总体结论

**S3 判定：PASS。** 44 条 AC 逐条取证完成，44 通过 / 0 不通过 / 0 阻塞；
349/349 条核对项通过，56 条 Then 逐字核对项均已登记；每条 AC 至少 4 份原始帧（实际 425 份 / 44 条）。

| 项 | 数值 |
|---|---|
| AC 判定 | **44 通过 / 0 不通过 / 0 阻塞** |
| 核对项 | 349/349（100.0%）；其中 0 项为整文件 F-16 失败留证项，由 AC 级隔离机检判定（需求 §3.3） |
| 逐字 Then | 56 条（需求 §3.1 逐字抽取，`acc10-f-gen.mjs --check` 44/44 一致） |
| 证据 | 44 个 AC 目录 / 425 份原始帧 / 最少 4 份每条（不足项：无） |
| 全量回归 | `1425 tests / 1420 pass / 4 fail / 1 skipped`；失败集合与判定基线 9 条**差集 0**；条数 ≥ 1157（是） |
| 静态门禁 | 11/11 通过（31 词两轮、零依赖、CJK 零命中、AC 44 条、USAGE_LINES 25、无宿主分支、产物时效、提交卫生） |
| 壳面 SKIP | 0 条（R-13：skip 需写明重建产物） |
| 复跑 AC | 0 条（每次 attempt 原始帧全保留，断言未改） |

## 1. 验收范围与判定口径

- **B 类验收**（需求 §3.3）：mock 宿主 + 真实 core / daemon + 真实 Tauri 壳；不接真实 DSH、不需模型凭据。真实宿主取证属本机保留项，不在本迭代判定。
- **证据三档**：`mock 实测` / `mock 实测（结构断言）`（仅 AC-22，R-12）/ `阻塞`。
- **F-16 机检模板**：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`，断言退出码 0 / `# pass ≥ 1` / `# fail 0`；禁全量 glob 代替。
- **Then 逐字口径**：判据原文由生成器从需求 §3.1 逐字抽取进 44 个用例文件，逐字断言由同名契约测试承载（拆分文档 §4），S3 用 F-16 机检 + 架构检查独立复核。
- **夹具隔离**：runner 注入 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，契约测试内部 `os.tmpdir()` 落在该目录；`fixture-roots.json` 记录实际子根。
- **环境口径（裁决 Z 决定 2）**：逐 AC F-16 保留本机默认 `NODE_OPTIONS` 预加载（需求 §3.3 只强制 `NODE_ENV=test`）；全量回归门禁按裁决 V 用 `env -u NODE_OPTIONS`。剥离预加载会让 mock 宿主一轮完成过快，触发 R-08 已登记时序竞态（AC-04 `running`→`completed`）；两种环境原始帧都留证，全量失败集合按判定基线 9 条核算、差集 0。
- **文本扫描**：一律 `grep -E` / `grep -RE`（ERE），禁 BRE `\|` 交替（本机 toybox shim 会假通过）。

## 2. 交付物

| 路径 | 内容 |
|---|---|
| `probe/acc10-f-{lib,common,run,final,gen,gates}.mjs` | S3 验收脚手架六件（拆分文档 §5 四件套 + 生成器 + 门禁取证，可复跑） |
| `probe/acc10-cases/ac01..ac44.mjs` + `README.md` | 逐 AC 用例（判据原文逐字，`--check` 44/44 与需求一致） |
| `probe/acc10-f-parts/AC-xx.md` | 44 份逐 AC 核对表（判据原文 / 核对项 / 命令与退出码 / 证据 sha256） |
| `probe/acc10-f-results.jsonl` / `-summary.json` / `-blockers.md` | 结果流水 / 汇总 / 缺陷台账 |
| `docs/iterations/iteration-10a/evidence/AC-xx/` | 逐 AC 原始帧（TAP 日志、摘要、用例名、架构检查输出、Then 映射、判据原文、夹具根、结果） |
| `docs/iterations/iteration-10a/evidence/gates/` | 全量回归日志 + 静态门禁原始输出 + `gates.json` |
| `acceptance-a.md` / `acceptance-b.md` / `results.jsonl` / `summary.json` / `report.md` / `final-verification.md` | S3 验收报告与 S4 终验台账 |

## 3. 全量回归门禁（NF-6 / 判定基线 9 条）

```text
env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
# tests 1425  # pass 1420  # fail 4  # skipped 1
```

失败集合：

- `AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新`
- `task-loop 审核提示词给绝对路径：基址与 readReview 同源，避免宿主写进实例工作区`
- `core.stop：先回包再断连，5s 内收敛，core.json 仍可读`
- `main：--cwd 相对当前 shell 目录解析，不作为项目根`

全部 ⊆ 判定基线 9 条（历史 8 条 + 裁决 R 的 AC-04 允许项），**差集 = 0**；条数 1425 ≥ 1157。
历史 `docs/iterations/iteration-7/baseline-failures.txt` 不改，不以「零失败」判定（需求 §3.3 / 裁决 T B-39）。

## 4. 发布面（AC-38~44）真实面取证

> 真实面记录：`evidence/release/ci-runs.json`（workflow release.yml，仓库 `xueshuaihui/Maestro`）。

| run id | 事件 | 结论 | HEAD | 说明 |
|---|---|---|---|---|
| 43710787428 | workflow_dispatch | **cancelled** | `91016f5` | 首跑：macOS 两个 job 均红在唯一一条 AC-04（裁决 R-08 允许项）——gate 只读了历史 8 条基线，漏掉裁决后的 9 条口径 |
| 43712132192 | workflow_dispatch | **failure** | `2042c97` | Windows 门禁 16 条平台敏感失败首现（lsof / LF 字节 / 信号 / 时钟粒度）；macOS 两平台全绿 |
| 43713458636 | workflow_dispatch | **failure** | `c0fe967` | win32 差集基线生效：Windows 门禁 7/7 通过；卡在 makensis 预装但不在 PATH |
| 43714383565 | workflow_dispatch | **failure** | `33e4515` | NSIS 标准目录探测成功、安装包产出、静默安装通过；arm64 真壳用例负载 flake 判红、Windows 冒烟卡 desktop.json |
| 43714944788 | workflow_dispatch | **cancelled** | `0fab251` | 被含「文件级 flake 确认」的下一轮取代（计划内取消） |
| 43715466845 | workflow_dispatch | **failure** | `0fab251` | macOS 双平台全绿（flake 确认生效）；Windows 冒烟：应用可启动但 .orch 不存在 |
| 43716408317 | workflow_dispatch | **failure** | `3210c0c` | 决定性证据：ready 帧 daemon.pid 非 0（壳确实拉起子进程），但 .orch 未落盘；同一份包内运行时直接起 daemon 完全正常 |
| 43717589144 | workflow_dispatch | **failure** | `5246f3b` | daemon-spawn.log 给出根因：EISDIR lstat 'C:'，node 收到的入口路径被解坏（daemon-exit code=1） |
| 43718725345 | workflow_dispatch | **success** | `eff4e2f` | 三平台全部 success，汇总发布产出草稿 Release dryrun-eff4e2f（4 项资产）；Windows daemon 通道打通 |
| 43720924036 | push | **success** | `958db6f` | 推真实 tag v0.0.1 触发的正式通道：三平台全部 success，汇总发布走 --prerelease 产出非草稿 Release v0.0.1（4 项资产） |

| AC | 真实面判定 | 依据 |
|---|---|---|
| AC-38 | **通过** | 推真实 tag v0.0.1 → run 43720924036 三平台 success → `--check publish` 返回 `release v0.0.1 存在（draft=false，id=446096645）`。草稿通道（dryrun-eff4e2f，draft=true）只作对照，不据此判本条。取证后已删除，见 teardown。 |
| AC-39 | **通过** | `--check assets` → 两个面各 4 项齐全（x64.dmg / arm64.dmg / win-x64-setup.exe / SHA256SUMS.txt），字节数取自 REST 响应体，未预置清单；正式面 `--dir` 本地对账亦通过。 |
| AC-40 | **通过** | `--check gating --run 43717589144 --before 0` → run conclusion=failure 且资产数 0 → 0（失败构建未产出任何新资产）；成功轮 43718725345 / 43720924036 才有 4 项资产，门禁在前、资产在后。 |
| AC-41 | **通过** | 版本单点（package.json 唯一来源 + 三处值相等 + 派生物零字面量）已实测通过；真实 tag 面上 `--check channel v0.0.1` → tag=v0.0.1 期望 prerelease=true，实际=true（v0.* 走预发布通道已实证）。**口径披露**：`v1+ → 正式` 分支未在真实 tag 上跑过——`版本对齐校验` 要求 tag 版本与 package.json 一致，要跑它就得把产品版本改成 1.0.0，超出本迭代范围；该分支由 release-contract.test.js 的结构断言（同一 `if` 前缀判定的 else 支路）承载，不冒充已实测。 |
| AC-42 | **通过** | 清理前：`--check draft --baseline 0` → 草稿 dryrun-eff4e2f 存在、标识不以 v 开头、非草稿条目数仍为 0（不污染正式 Release 页）。清理后：`--check absent` 对 dryrun-eff4e2f 与 v0.0.1 均返回计数 0，删除前后 REST 响应同处 verify-absent.json（F-28 双向留证）。 |
| AC-43 | **通过** | `--check idempotent v0.0.1` → 同名条目数 1 且 4 项资产齐全；草稿通道与正式通道并存期间未产生重复条目。`gh release view` → 有则 `upload --clobber`、无则 `create` 的分支与 `fail-fast: false` 由 release-contract.test.js 的结构断言承载。**口径披露**：未对同名 tag 做第二次推送，「重跑是补传而非新建」的实时帧取自 10 次 workflow_dispatch 重跑（同一 job 反复重跑始终只有一个 Release 条目），不冒充 tag 重推。 |
| AC-44 | **通过** | macOS 面 5/5（ready / 401 / codesign --verify --deep --strict / hdiutil verify / 挂载后复验）；Windows 面 4/4（静默安装 / ready daemon 非 0 / 401 / 包内可执行存在）；两面分别记账，macOS 未替 Windows 签字。 |

- 前 9 轮为 `workflow_dispatch` 试跑通道（不污染正式 Releases 页，产物只落草稿）；第 10 轮 43720924036 是推真实 tag v0.0.1 触发的正式通道验证。
- 两个面取证完毕后已按授权删除（3 次 DELETE 全 204，删后 release 数 0、tag ref 404），双向响应见 verify-absent.json。
- Windows daemon 未启动的根因是壳交给 CreateProcess 的路径形态：`\\?\` 逐字前缀被 node 解析成盘符（`EISDIR lstat 'C:'`）。修复为剥前缀 + 正斜杠后，Windows 冒烟 4/4 通过。
- 真壳/托盘类用例在无头 runner 上有负载型 flake（x64 / arm64 轮换命中），门禁按「文件级隔离复跑确认」处理：确认通过记 flake 并打印名单，确认失败照旧判红（本轮 2 条 flake 名单见 run 43718725345 的 mac-x64 日志）。
- 凭据：全程只用仓库自带 `${{ github.token }}`；只读校验器的令牌由 `git credential fill` 现取，未落盘、未入证据。

## 5. 证据分级与残留项

- **R-12（AC-22）**：真实壳内拖拽仍是结构断言（写入端 `config.rs` 零窗口级自动化用例）。本轮单列 `mock 实测（结构断言）`，补 `view-state.test.js` + `config.rs` 路径常量结构证据，不冒充真实宿主实测。
- **R-13**：`bundleFreshness()` 与 `regression.test.js` 判据面一致，不为对齐削弱任一侧；本轮壳面实测 0 条 skip，脚手架统一按「skip 必须写明需 `env -u NODE_OPTIONS npm run desktop:build`」执行。
- **环境偏差**：AC-05 / AC-11 的原文 `grep -R ... desktop/` 命中 bundle 构建产物内产品源码副本，按「原文留证 + 界面层作用域零命中判定」处置，详见 `probe/acc10-f-blockers.md` ③。
- **基线项与环境根因**：全量门禁按裁决 V 用 `env -u NODE_OPTIONS`，AC-04 因剥离预加载后 mock 宿主完成过快而触发 R-08 时序竞态（`running`→`completed`）；逐 AC F-16 按需求 §3.3 只注入 `NODE_ENV=test`、保留默认 `NODE_OPTIONS`，同文件 `2p/0f` 稳定通过。两种环境原始帧均留证，判定基线 9 条、差集 0 不变；余下 3 条全量失败（`task-loop 审核提示词` / `core.stop` / `main --cwd`）均属历史基线。

## 6. 退出标准逐条核对（需求 §3.1 判定口径 / 拆分文档 §0）

| # | 退出标准 | 实测 | 结论 |
|---|---|---|---|
| 1 | 44 条 AC 100% 通过 / 0 不通过 / 0 阻塞 | 44/0/0 | PASS |
| 2 | 每条 AC 至少 4 份原始帧，按「AC 号 + 阶段 + 类型」落 evidence/ | 44 目录 / 425 份 / 不足项 0 | PASS |
| 3 | 结论三档取「通过」（mock 实测），收口不带阻塞 | {"mock 实测":36,"mock 实测（结构断言）":1,"已实测（真实 GitHub 面）":7} | PASS |
| 4 | 全量测试失败集合差集 0、条数只增不减 | 差集 0 / 1425 ≥ 1157 | PASS |
| 5 | 31 词两轮 purity / 零依赖 / 中文唯一来源 | 11/11 静态门禁通过 | PASS |
| 6 | 规划逐字验收句（857 行）由 AC-26 在夹具现场实跑通过 | AC-26 通过（`acceptance-e2e.test.js` 三段壳面探针） | PASS |

## 7. 复跑方式

```bash
cd /Users/xuesh/www/Maestro
node probe/acc10-f-gen.mjs --check                 # 用例与需求逐字一致
node probe/acc10-f-run.mjs --batch a              # AC-01~10（b/c/d 同理）
ACC10_FULL_LOG=/tmp/i10a-s3-full.log node probe/acc10-f-gates.mjs
node probe/acc10-f-final.mjs                      # 重建全部报告与台账
```
