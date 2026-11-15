# I1.10a S3 验收 · C 组（发布面）（AC-38 ~ AC-44）

> 判据来源：`docs/iterations/iteration-10a/requirement.md` v4 §3.1 同号 AC 全文 + 附录 A-0~A-14 / C / D-15；
> `docs/iterations/iteration-10a.md` r3 §4（F-16 机检模板）与 §5（交付物）；`decisions.md` 裁决 A~AA。
> 取证脚手架：`probe/acc10-f-{lib,common,run,final,gen,gates}.mjs` + `probe/acc10-cases/`（逐字抽取，`--check` 44/44 一致）。
> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。

## ① 环境与复跑

| 项 | 值 |
|---|---|
| 仓库 HEAD | `a093ede` |
| 验收级别 | B 类（mock 宿主 + 真实 core / daemon + 真实 Tauri 壳；不接真实 DSH、不需模型凭据，需求 §3.3） |
| 环境变量 | 全部命令 `NODE_ENV=test`；保留本机默认 `NODE_OPTIONS` 预加载（需求 §3.3 未要求剥离；剥离会触发 R-08 时序竞态），仅清 `ELECTRON_RUN_AS_NODE` |
| 夹具根 | 每 AC 独立 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，绝不进仓库 |
| 证据根 | `docs/iterations/iteration-10a/evidence/<AC>/` |
| 复跑 | `node probe/acc10-f-run.mjs AC-xx` / `--batch a|b|c|d|r`；`node probe/acc10-f-final.mjs` 重建本文件 |

## ② 逐 AC 判定表

| AC | 结论 | 证据等级 | 机检（F-16） | 核对项 | Then | 证据 | 判定依据 |
|---|---|---|---|---|---|---|---|
| AC-38 | **通过** | 已实测（真实 GitHub 面） | `release-contract.test.js` 18p/0f（架构 4 项） | 13/13 | 4 | 12 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-39 | **通过** | 已实测（真实 GitHub 面） | `release-contract.test.js` 18p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-40 | **通过** | 已实测（真实 GitHub 面） | `release-contract.test.js` 18p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-41 | **通过** | 已实测（真实 GitHub 面） | `release-contract.test.js` 18p/0f（架构 2 项） | 11/11 | 4 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-42 | **通过** | 已实测（真实 GitHub 面） | `release-contract.test.js` 18p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-43 | **通过** | 已实测（真实 GitHub 面） | `release-contract.test.js` 18p/0f（架构 2 项） | 8/8 | 1 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |
| AC-44 | **通过** | 已实测（真实 GitHub 面） | `release-smoke.test.js` 4p/0f（架构 2 项） | 11/11 | 4 | 10 份 | F-16 机检 exit 0 / #pass≥1 / #fail0；架构检查按需求原文判定；Then 逐字断言由同名契约测试承载 |

## ②.1 真实面（GitHub Actions / Releases）

> 本组 AC 的 Then 含「真实 GitHub 面」要求，夹具面自证不算数。下表是真实运行记录与只读校验器对远端的判定，
> 与上表（夹具面）**分开记账、不互相折抵**。

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

## ③ 逐 AC 取证明细

### AC-38 · 推 tag 即发布：维护者不需要手工传包

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：功能 / 发布主路径（v3 新增） ｜ **取证时刻**：2026-11-15T11:23:55.311Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-38/requirement.json` 与 `probe/acc10-f-parts/AC-38.md` ① 节；本 AC 共 4 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-38/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` → exit 0，# pass 18 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "secrets\." .github/` → exit 1（期望 1） ✅
- `grep -REn "permissions:" .github/workflows/release.yml` → exit 0（期望 0） ✅
- `grep -REn "ghp_\|github_pat_\|password\|token:" .github/` → exit 1（期望 1） ✅
- `grep -REn "github[.]token" .github/workflows/release.yml` → exit 0（期望 0） ✅

**证据清单**（12 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-38/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-3.log`
- `arch-4.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-contract.test.js.attempt-1.log`
- `unit-release-contract.test.js.log`
- `unit-release-contract.test.js.summary.json`
- `unit-release-contract.test.js.test-names.json`

**备注**：

- 证据分级：`已实测（真实 GitHub 面）` 需一次真实 tag 推送 + Actions 记录 + Release 存在；静态契约（release-contract.test.js）只能证明「定义里写了什么」，不得单独判本条通过。
- 零个人凭据的判定点：`.github/` 内 `secrets.` 零命中 + `permissions:` 只含 `contents: write`；令牌表达式为 `${{ github.token }}`。
- 真实面：推 `v0.0.1` tag → run `43720924036` 三平台 success → `--check publish` 返回 `draft=false`、id=446096645；草稿通道 dryrun-eff4e2f 只作对照，不据此判本条。取证后两个 Release 与 tag 均已删除（见 verify-absent.json）。

### AC-39 · 三平台安装包与校验和齐全且对得上

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：功能 / 产物分发（v3 新增） ｜ **取证时刻**：2026-11-15T11:23:56.626Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-39/requirement.json` 与 `probe/acc10-f-parts/AC-39.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-39/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` → exit 0，# pass 18 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "lipo\|-target universal-apple-darwin\|universal2-apple-darwin" .github/ scripts/` → exit 1（期望 1） ✅
- `grep -REn "macos-15-intel\|macos-15\|windows-latest" .github/workflows/release.yml` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-39/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-contract.test.js.attempt-1.log`
- `unit-release-contract.test.js.log`
- `unit-release-contract.test.js.summary.json`
- `unit-release-contract.test.js.test-names.json`

**备注**：

- 静态契约由 release-contract.test.js 的 `judgeAssets` 单测承载（三平台 + 清单共 4 项、资产数恰为 4）；真实面由 `acc10-release-verify.mjs --check assets` 取远端资产名与字节数并本地重算 SHA-256。
- 禁止用仓内文件冒充远端资产（`docs/index.md` 710 行第 3 条）；缺任一平台即判不通过，不得用「另外两个平台已过」折抵。
- 真实面：`--check assets` 在 `v0.0.1` 上得 4 项（x64.dmg / arm64.dmg / win-x64-setup.exe / SHA256SUMS.txt），字节数直接取自 REST 响应体；`--dir` 下载后本地重算 SHA-256 与清单一致。

### AC-40 · 门禁与产物冒烟不过就不出包

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：非功能 / 发布可靠性（v3 新增） ｜ **取证时刻**：2026-11-15T11:23:57.525Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-40/requirement.json` 与 `probe/acc10-f-parts/AC-40.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-40/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` → exit 0，# pass 18 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "skip-smoke\|skip-gates" .github/ scripts/` → exit 1（期望 1） ✅
- `grep -REn "gate[.]mjs" .github/workflows/release.yml` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-40/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-contract.test.js.attempt-1.log`
- `unit-release-contract.test.js.log`
- `unit-release-contract.test.js.summary.json`
- `unit-release-contract.test.js.test-names.json`

**备注**：

- 失败判定点（需求 v4 F-24）：该次 run `conclusion=failure` 且同名 Release 资产数在 run 前后相等；构造不出真实红色 run 时本条判 `阻塞`，不得用静态断言替代真实失败帧。
- 真实面：失败构建 run `43717589144`（conclusion=failure）前后同名 Release 资产数 0 → 0；成功构建 run `43720924036` 才产出 4 项——「门禁在前、产物在后」由两次真实帧对比证明。

### AC-41 · 版本与通道：包内版本一致、预发布与正式版不串档

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：功能 / 版本管理（v3 新增） ｜ **取证时刻**：2026-11-15T11:23:58.362Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-41/requirement.json` 与 `probe/acc10-f-parts/AC-41.md` ① 节；本 AC 共 4 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-41/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` → exit 0，# pass 18 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "0[.]1[.]0" scripts/desktop/` → exit 1（期望 1） ✅
- `grep -REn "assertAligned\|readVersion" scripts/desktop/version.mjs` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-41/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-contract.test.js.attempt-1.log`
- `unit-release-contract.test.js.log`
- `unit-release-contract.test.js.summary.json`
- `unit-release-contract.test.js.test-names.json`

**备注**：

- 静态契约三条（来源唯一 / 值相等 / 派生物零字面量）由 release-version.test.js 承载；真实面由 `--check channel` 断言 `v0.* → prerelease`、`v1+ → 正式`。
- 真实面：`--check channel v0.0.1` → 期望 `prerelease=true`、实际 `true`，v0.* 走预发布档已实证；四处版本一致由 CI 的「版本对齐校验」步骤在真实 runner 上复核。
- 口径披露：`v1+ → 正式` 分支未在真实 tag 上跑过（需把产品版本改成 1.0.0，超出本迭代范围），由静态契约的 else 支路断言承载，不冒充已实测。

### AC-42 · 试跑不污染正式发布

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：功能 / 试运行通道（v3 新增） ｜ **取证时刻**：2026-11-15T11:23:59.182Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-42/requirement.json` 与 `probe/acc10-f-parts/AC-42.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-42/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` → exit 0，# pass 18 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "dryrun-" .github/workflows/release.yml` → exit 0（期望 0） ✅
- `grep -REn "[-][-]draft" .github/workflows/release.yml` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-42/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-contract.test.js.attempt-1.log`
- `unit-release-contract.test.js.log`
- `unit-release-contract.test.js.summary.json`
- `unit-release-contract.test.js.test-names.json`

**备注**：

- 真实面：`workflow_dispatch` 一次 → 草稿 `draft=true` 且正式条目数不增；清理后必须 `--check absent` 计数归零，删除前后的 REST 响应双向落证（F-28）。
- 真实面收尾：取证后执行 3 次 DELETE（两个 Release + tag ref）全 204，再跑 `--check absent` 两个 tag 均返回计数 0；删除前的响应体与删除后的空集同处 verify-absent.json，构成 F-28 要求的双向证据。

### AC-43 · 失败重跑与重复 tag 不产生重复 Release

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：非功能 / 幂等与可恢复（v3 新增） ｜ **取证时刻**：2026-11-15T11:24:00.017Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-43/requirement.json` 与 `probe/acc10-f-parts/AC-43.md` ① 节；本 AC 共 1 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-43/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` → exit 0，# pass 18 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "gh release view\|[-][-]clobber" .github/workflows/release.yml` → exit 0（期望 0） ✅
- `grep -REn "fail-fast:[[:space:]]*false" .github/workflows/release.yml` → exit 0（期望 0） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-43/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-contract.test.js.attempt-1.log`
- `unit-release-contract.test.js.log`
- `unit-release-contract.test.js.summary.json`
- `unit-release-contract.test.js.test-names.json`

**备注**：

- 真实面：同名 Release 计数为 1 且资产齐全；静态契约断言「已存在则补传 / 否则创建」与 `--clobber` 覆盖式上传。
- 真实面：`--check idempotent v0.0.1` → 同名条目数 1、4 项资产齐全；草稿通道与正式通道并存期间未产生重复条目。
- 口径披露：未对同名 tag 做第二次推送；「重跑是补传而非新建」的实时帧取自 10 次 workflow_dispatch 重跑（始终只有 1 个 Release 条目），不冒充 tag 重推。

### AC-44 · 下载的包能装、能开，且与本机双击是同一个应用

**结论**：通过 ｜ **证据等级**：已实测（真实 GitHub 面） ｜ **场景类型**：功能 / 开箱即用（v3 新增，与 AC-29 衔接） ｜ **取证时刻**：2026-11-15T11:24:00.847Z

**Then（需求 §3.1 逐字）**：见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-44/requirement.json` 与 `probe/acc10-f-parts/AC-44.md` ① 节；本 AC 共 4 条 Then 核对项，逐条状态见 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-44/then-map.json`。

**机检（F-16 固化模板）**：

- `test -f test/wp13/release-smoke.test.js && NODE_ENV=test node --test test/wp13/release-smoke.test.js` → exit 0，# pass 4 / # fail 0 / # skipped 0，attempt 1/1

**架构检查（需求同号原文，ERE / 禁 BRE `\|`）**：

- `grep -REn "hdiutil.*verify\|镜像内应用复验" scripts/desktop/smoke.mjs` → exit 0（期望 0） ✅
- `grep -REn "0[.]0[.]0[.]0\|listen.*all" scripts/desktop/smoke.mjs` → exit 1（期望 1） ✅

**证据清单**（10 份，均落 `/Users/xuesh/www/Maestro/docs/iterations/iteration-10a/evidence/AC-44/`）：

- `arch-1.log`
- `arch-2.log`
- `arch-checks.json`
- `fixture-roots.json`
- `requirement.json`
- `then-map.json`
- `unit-release-smoke.test.js.attempt-1.log`
- `unit-release-smoke.test.js.log`
- `unit-release-smoke.test.js.summary.json`
- `unit-release-smoke.test.js.test-names.json`

**备注**：

- 本机 macOS 面可实测（冒烟四件套已跑通）；Windows 面只能由 `windows-latest` 证明（本机无 `makensis`、无 `llvm-rc`），macOS 面通过不得替 Windows 面签字（需求 v4 F-20 连带项）。
- 真机安装/首启、Gatekeeper 放行、SmartScreen 引导属人工核验，不计入自动通过数。
- 真实面（CI 两面分别记账）：run `43718725345` macOS x64 冒烟 5/5（含 `hdiutil verify` 与挂载复验）、macOS arm64 success、Windows 冒烟 4/4（静默安装 / ready daemon 非 0 / 401 / 包内可执行存在）。


## ④ 结论口径

- **证据四档**：`已实测（真实 GitHub 面）`（C 组 7 条：真实 Actions 构建 + 真实 Release + 只读 REST 判定，另见 ②.1）/ `mock 实测`（B 类：mock 宿主 + 真实 core/daemon）/ `mock 实测（结构断言）`（R-12 的 AC-22）/ `阻塞`。真实 DSH 取证属本机保留项，不在本迭代判定。
- **逐字边界**：Then 不放宽、不合并、不改写；逐字断言由同名契约测试文件承载（拆分文档 §4），S3 以 F-16 机检 + 架构检查做独立复核。
- **命令形态**：所有机检先 `test -f` 再单文件 `--test`，禁全量 glob 代替（文件缺失会假通过）。
