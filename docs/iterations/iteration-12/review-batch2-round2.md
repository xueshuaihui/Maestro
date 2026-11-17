# I1.12 批次 2（WP-4/5/6）实现评审 · review-batch2-round2.md

> 评审角色：实现评审 Agent（批次 2 round 2，干净上下文，只读）；唯一可写文件 = 本文件。
> 仓库根 `D:/WWW/Maestro`，分支 `feat/i1.12-governance`，基线 HEAD `a0d1be4b9f808d11c3b171d039b6d1b5d9decfc1`。
> 评审对象：批次 2 当前工作树 15 个文件（2 改 + 13 新），重点 `src/core/perf-baseline.js` / `test/wp15/perf-mock.test.js` / `probe/acc12-perf.mjs`（B2-01 修复）。
> 判据来源：`requirement.md` v2.1（A-0/A-7、535/588 行三值逐字）、`iteration-12.md`、`decisions.md` 裁决 A 第 3 条 / C 第 3 条、上轮 `review-batch2.md`、上游只读基线 `a0d1be4`。
> 本轮只读纪律：除本文件外零写入；全量测试触发风险 10 覆盖的历史证据已按口径恢复（见 §5 #11）。

---

## §0 总判

**总判：PASS。阻断 0 条，建议 6 条（S-01~S-06 全部维持建议，移交 WP-7 批次 3）。**

判定式：**B2-01 闭合 + 回归无新增 = PASS**（本轮允许判 PASS 的硬约束条件已满足）。

- B2-01：三值已由 Unicode 码点转义的中文改为 ASCII 机器键；`buildPerfReport` / probe 同步上报机器键；三文件 CJK + 码点 grep 实测零命中；probe 实跑 `level=PERF_LEVEL_PENDING` / `blocked=true` / `exit 0`；测试断言改为机器键且**未弱化，反而增强**（双向锚定机器键字面）。→ **闭合**。
- 回归：上轮六维（文件边界 / 授权段 / 只读 / 签名 / AC 强度 / 测试门禁）均无退化；授权段 diff 仍零删除；42/42 契约测试全绿；全量 16 条失败经逐条差集 + 重跑确认为 baseline/flake，差集 0。→ **无新增阻断**。
- S-01~S-06 均为跨 WP 移交项（labels 补键、签名接线、CLI flags、OTel 中文键、history 守卫、差集口径），按阻断判据边界**一律建议，本轮不阻断**。

**实跑命令清单**（完整输出摘要见 §5）：

1. `git status --short` / `git rev-parse HEAD` / `git branch --show-current`
2. CJK + 码点 grep（`grep -nP` 同时匹配 CJK 区间与反斜杠 u 四十六进制转义）三重点文件
3. `node probe/acc12-perf.mjs --check` + 管道解析 `level/blocked/ok/conclusion/readOnly/observed/triedPaths/note`
4. `git diff --stat` / `--numstat` / 删除行 grep 重核 roles.js / workflows.js 授权段
5. `NODE_ENV=test node --test` 6 契约文件（42 测试）
6. 只读/写点 grep 组（pack / otel-export / antipattern / perf-baseline / probe）
7. 全部新增源码 CJK 静态门禁（`grep -lP`）与码点 grep（`grep -nE`）
8. `node test/fixtures/purity-check.mjs --dirs ...` ×3 目录 + `node -p deps` + I1.11 差集 grep
9. 全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` + 失败列表解析
10. `node --test --test-name-pattern` 重跑 1565（`live 取消`）×3（flake 复核）
11. `git -c core.autocrlf=false checkout -- <3 个 nfr-perf-*.json>` 恢复历史证据 + 核对工作树
12. labels.js / roles.js / workflows.js / main.js 状态 grep（S-01~S-04）

---

## §1 B2-01 + S-01~S-06 三态复核（行号 + 实跑证据）

### 1.1 B2-01 —— 三态：上轮 FAIL 阻断 → 本轮 PASS 闭合 → 判定非阻断

**修前（上轮 `review-batch2.md` §5.1 / §6 记录）**：`perf-baseline.js:16-20` 的 `PERF_LEVELS` 三值为反斜杠 u 码点转义的中文（解码后即 `mock 实测` / `已实测（真实宿主面）` / `待本机实测`）；`buildPerfReport` 把解码后的中文直接放进 `level`（旧 `:213, 227`）；probe 原样上报 stdout（旧 `:211, 219-245`）。

**修后（本轮实跑，逐行核对）**：

| 位置 | 修后内容 | 判定 |
|---|---|---|
| `perf-baseline.js:8-14` | 头部契约注释声明「one of three frozen ASCII machine keys」「Levels are ASCII machine keys; all user-facing Chinese is owned by labels.js via PERF_LEVEL_LABEL_KEYS」 | 机器键语义自证 |
| `perf-baseline.js:16-20` | `PERF_LEVELS = Object.freeze({ mock:'PERF_LEVEL_MOCK', real:'PERF_LEVEL_REAL', pending:'PERF_LEVEL_PENDING' })` | **三值改 ASCII 机器键** |
| `perf-baseline.js:22-32` | 新增 `PERF_LEVEL_LABEL_KEYS`（mock/real/pending → 同一机器键），注释明列裁决 C 第 3 条：能力包只产键、WP-7 拥有逐字中文值、缺键抛错、不回落硬编码中文 | **WP-7 三键移交清单清晰** |
| `perf-baseline.js:210-212` | `validLevel()` 按机器键判定（=== PERF_LEVELS.mock/real/pending） | 同步 |
| `perf-baseline.js:220-239` | `level = validLevel(...) ? evidenceLevel : PERF_LEVELS.pending`（`:225`）；`blocked = level === PERF_LEVELS.pending`（`:226`）；`ok = !blocked && bottleneck === null && stats.p95 !== null`（`:238`） | `buildPerfReport` 同步；fail-closed 与「仅 pending 阻塞」语义不变 |
| `probe/acc12-perf.mjs:8-12` | 注释声明 `level` 为 ASCII machine key、中文归 labels.js、never hardcoded | 同步 |
| `probe/acc12-perf.mjs:27-32` | import `PERF_LEVELS, PERF_TARGETS, collectHandoffLatency, buildPerfReport` | 同步 |
| `probe/acc12-perf.mjs:213` | `evidenceLevel = evidenceCollected ? PERF_LEVELS.real : PERF_LEVELS.pending` | 机器键判定 |
| `probe/acc12-perf.mjs:215-244` | `buildPerfReport({samples, evidenceLevel, target})` → report 展开 `...base`；`level` 为机器键；`conclusion` / `note` 均为英文 | probe 上报同步，无中文硬编码 |
| `probe/acc12-perf.mjs:246-252` | 唯一写点 `--out` dump；`:252 return 0` | 只读 + 阻塞退出 0 不变 |

**测试断言改为机器键且未弱化（反而增强）**：

| 位置 | 断言 | 强度 |
|---|---|---|
| `perf-mock.test.js:139-155` | `report.level === PERF_LEVELS.mock`（`:147`）且 `=== 'PERF_LEVEL_MOCK'`（`:148`）；`notEqual real / 'PERF_LEVEL_REAL'`（`:149-150`）；`ok=true`（`:151`）、`blocked=false`（`:152`）、`bottleneck=null`（`:153`）、`stats` 深比较（`:154`） | **双向锚定**：既锚常量又锚字面，比上轮更强 |
| `perf-mock.test.js:157-182` | `PERF_LEVELS` 字面深比较三键（`:162-166`）；`blocked=[false,false,true]`（`:168`）、`level` 三键数组（`:169-174`）；mock 不产 real（`:176`）；`UNKNOWN → pending → blocked`（`:178-181`） | **三值不混 + fail-closed 全在** |
| `perf-mock.test.js:184-214` | 三类瓶颈定位（实例不足 / 会话不足 / 延迟超预算）逐一断言，不伪造 pass | 未弱化 |
| `perf-mock.test.js:246-255` | 核心模块禁词零命中（`:248-250`）；no-CJK 自检（`:253-254`） | 只读 + CJK 门禁自证 |

**WP-7 三键移交清单（清晰）**：`perf-baseline.js:22-32` 的 `PERF_LEVEL_LABEL_KEYS` 明确三键名 `PERF_LEVEL_MOCK` / `PERF_LEVEL_REAL` / `PERF_LEVEL_PENDING`，键名与报告 `level` 机器键一致；注释（`:23-27`）写明由 WP-7 在 `labels.js` 注册三键、取值逐字为 `requirement.md:535/588` 的三中文、缺键抛错不回落（对照表见 §3.3）。

**实跑证据**：CJK + 码点 grep 三文件 `exit 1` 零命中（§3.1）；probe 实跑 `level=PERF_LEVEL_PENDING`、`blocked=true`、`exit 0`（§3.2）。

### 1.2 S-01~S-06 —— 三态均为「上轮建议 → 本轮仍建议 → 非阻断（移交 WP-7）」

| 编号 | 上轮状态 | 本轮实测状态（行号/命令） | 本轮判定 |
|---|---|---|---|
| **S-01** labels 补键 | 建议：`labels.js` 补 `PACK_IMPORT_OK`/`MIGRATE_TEXT.*`/`OTEL_TEXT.*`/`SIGNAL_*`/`PERF_LEVEL_*` | `grep -nE` 匹配上述键于 `src/cli/labels.js` → **exit 1 零命中**；`git status --short src/cli/labels.js` 空（本轮未改 labels.js，符合「不改 labels.js 授权约束」） | 建议，移交 WP-7；`PERF_LEVEL_*` 三键名已由 `perf-baseline.js:28-32` 交付 |
| **S-02** 签名往返 | 建议：export 无 `signature`，import 门禁要求三者齐全 | `roles.js:872-873` / `workflows.js:840-841` 导出 payload = `{manifest, files, compat}`（无 signature）；`roles.js:917` / `workflows.js:866` 导入门禁要求 `candidate.signature`；`roles.js:933` / `workflows.js:884` 调 `verifyPackage`；往返仍不通 | 建议，移交 WP-7 接线层；pack.js 保持不签名（冻结签名不含 privateKey） |
| **S-03** CLI flags | 建议：`main.js` 白名单追加新 flags / 子命令 | `main.js:206-213` `RUNTIME_SUBS` 中 `workflow:['pause','resume','abort']`（无 export/import）；`:215-218` `RUNTIME_VALUE_FLAGS` 无 `--package/--public-key/--out/--yes/--backup/--version`；`:189-192` `FAMILY_MODULES` 仅 skill/workflow 既有映射；`git status --short src/cli/main.js` 空 | 建议，移交 WP-7；模块级测试全绿但 CLI 端到端未验证 |
| **S-04** OTel 中文键 | 建议：`labels.js` 补 `OTEL_TEXT.*`/`EXPORT_TEXT.*` | 同 S-01 的 labels grep：零命中；`otel.js:24-42` 走 ASCII fallback（上轮记录，本轮未改） | 建议，移交 WP-7 |
| **S-05** history 证据 | 建议：全量回归覆盖 `iteration-4/evidence`（风险 10），应设只读守卫 | 本轮全量测试再次覆盖 3 个 `nfr-perf-*.json`；已 `git -c core.autocrlf=false checkout --` 恢复，`git diff --stat -- docs/iterations/iteration-4/evidence/` 空；守卫仍未建立 | 建议，移交 WP-7/主控；本轮已恢复、无越界残留 |
| **S-06** 差集口径 | 建议：产物骨架「8 个测试文件」措辞与批次 2 实际 6 个不符 | 批次 2 仍为 6 个契约文件（WP-4×3 / WP-5×2 / WP-6×1），42/42 全绿；措辞差异未修 | 建议，主控批次 3 汇总统一 |

---

## §2 六维回归扫描

| # | 维度 | 本轮结论 | 行号 / 命令输出证据 |
|---|---|---|---|
| 1 | **文件边界** | **PASS（无退化）** | `git status --short` 恰 15 文件（2 M + 13 ??），与上轮一致；I1.11 差集 `{git diff --name-only a0d1be4; git ls-files --others --exclude-standard} \| sort -u \| grep -iE ...` → exit 1 零命中 |
| 2 | **授权段** | **PASS（无退化）** | `git diff --numstat a0d1be4 -- roles.js workflows.js` → `80 0` / `83 0`（零删除）；删除行 grep（`^-[^-]`）→ exit 1 零命中；符号锚点 `exportRole`/`importRole`/`roleCommand`/`workflowCommand` 与既有键/码/行为零改 |
| 3 | **只读** | **PASS（无退化）** | pack 写点仅 `:400/:578/:590/:613`（import/restore/backup/staged）；otel-export 仅 `:189 io.writeFile(out,...)`；antipattern `emit\|transit\|escalat` grep exit 1；perf 核心禁词（writeFile/appendFile/unlink/.dsh/spawn/exec）grep exit 1；probe 仅 `:250 fs.writeFileSync(opts.out)` |
| 4 | **签名** | **PASS（无退化）** | 导出签名与冻结一致：`buildPackage({asset,registry,root})` / `verifyPackage({pkg,publicKey,systemVersion})` / `importPackage(...)` / `listMigrations` / `applyMigrations` 位置与返回结构未变；`pack-sign.test.js` 有效/篡改/版本三态实测；签名往返缺口属 S-02 建议 |
| 5 | **AC 强度** | **PASS（无退化）** | AC-13~21 判定行号与上轮 §4 表一致；AC-20/21 由 42 契约测试覆盖，B2-01 修复后断言双向锚定机器键、blocked/stats/三值不混/fail-closed 全在，无弱化；AC-21 probe 真实面 blocked 合规（§3.2） |
| 6 | **测试门禁** | **PASS（无退化）** | 6 契约 `42/42`；全量 `1631 tests / 1606 pass / 16 fail / 9 skip`；16 失败逐条差集 = baseline/flake 登记内，**差集 0**；purity 三目录 exit 0；deps=0 |

**附加门禁**：purity `src/core`（27 文件）/`src/daemon`（11 文件）/`desktop/ui,desktop/harness`（25 文件）三目录 exit 0（均零命中）；`node -p deps` = 0；I1.11 差集零命中。

---

## §3 CJK/码点 grep + probe 实跑 + 机器键对照表

### 3.1 CJK + 码点 grep（三重点文件，用户指定命令）

```
grep -nP '[CJK 区间]|[反斜杠]u 四十六进制转义' \
  src/core/perf-baseline.js test/wp15/perf-mock.test.js probe/acc12-perf.mjs
→ grep exit=1（零命中，无 stdout）
```

（实际执行命令按用户给定正则：`grep -nP '[\x{4e00}-\x{9fff}]|\\u[0-9a-fA-F]{4}'` 三文件。）

**三文件零命中实测确认**：CJK 字面 + 码点双重静态门禁均零命中，B2-01 的中文硬编码/码点规避已消除。

**全新增源码扫描补充**：CJK 静态门禁（`grep -lP`）命中 `test/wp15/chain-compat.test.js` / `chain-verify.test.js` / `governance-wake.test.js`（均为批次 1 既有文件，不在本轮 15 评审对象内，且是测试内验证中文文案的正当字面）；批次 2 六文件零命中。码点 grep（`grep -nE`）命中项均为：控制符 `antipattern.js:134` 的 NUL 转义（非中文）、各测试内 CJK 检测正则的 ASCII 写法（`\u3400-\u9fff` / `\u4e00-\u9fff`，非中文内容）——与本轮三重点文件及 B2-01 无关。

### 3.2 probe 实跑（`node probe/acc12-perf.mjs --check`）

- **exit 0**（阻塞出口按「阻塞不算失败」设计，裁决 A 第 3 条 / 483 行）。
- `level = PERF_LEVEL_PENDING`（**机器键，非中文**）
- `blocked = true`，`ok = false`
- `conclusion = BLOCKED_UNCOLLECTED`，`readOnly = true`
- `observed`：`dshSessionRecords=9`、`dshRecordsWithHandoff=0`、`dshTimedHandoffs=0`、`handoffSamples=0`（未取证即阻塞，无伪造达标）
- `triedPaths = 11` 条（含 `.dsh/sessions` 与各 `session.v4.jsonl.zstd`、`.orch/instances`）
- `note = 'Real-host handoff evidence not collected; blocked, not failed. Mock data never substituted.'`（明示 mock 不顶替）

### 3.3 机器键对照表（三中文逐字来自 `requirement.md:535` / `:588`）

| 机器键（`PERF_LEVELS` / 报告 `level` / probe 上报） | labels 中文逐字值（WP-7 待在 `labels.js` 注册） | 阻塞语义 |
|---|---|---|
| `PERF_LEVEL_MOCK` | `mock 实测` | 不阻塞（mock 永不顶替 real） |
| `PERF_LEVEL_REAL` | `已实测（真实宿主面）` | 不阻塞 |
| `PERF_LEVEL_PENDING` | `待本机实测` | **阻塞**（未知值 fail-closed → pending → blocked） |

> `requirement.md:535` 把三值列入「统一由 `src/cli/labels.js` 下发，不出现硬编码字面量」清单；`:588` 要求 A-7 性能行逐字呈现 `证据级别 [mock 实测 | 已实测（真实宿主面） | 待本机实测]`。本轮机器键交付 + `PERF_LEVEL_LABEL_KEYS` 移交清单已满足「能力包只产键」；三中文逐字落地由 WP-7 批次 3 接线。

---

## §4 修复清单 B2R

**无。** 阻断 0 条。B2-01 已闭合；S-01~S-06 按阻断判据边界均为建议，不构成 B2R。

---

## §5 实跑命令与输出摘要

| # | 命令 | 输出摘要 |
|---|---|---|
| 1 | `git branch --show-current` / `git rev-parse HEAD` / `git status --short` | 分支 `feat/i1.12-governance`；HEAD `a0d1be4b9f808d11c3b171d039b6d1b5d9decfc1`；15 文件（2 M + 13 ??） |
| 2 | CJK + 码点 grep（`grep -nP`）三重点文件 | exit 1，零命中；CJK + 码点双门禁通过 |
| 3 | `node probe/acc12-perf.mjs --check` + 管道 JSON 解析 | exit 0；`level=PERF_LEVEL_PENDING`、`blocked=true`、`ok=false`、`conclusion=BLOCKED_UNCOLLECTED`、`readOnly=true`、`dshSessionRecords=9`、`dshTimedHandoffs=0`、`handoffSamples=0`、`triedPaths=11`、`note` 明示 mock 不顶替 |
| 4 | `git diff --stat` / `--numstat` / 删除行 grep（roles/workflows） | `80 insertions/0 deletions`、`83 insertions/0 deletions`；删除行 grep exit 1 零命中 |
| 5 | `NODE_ENV=test node --test` 6 契约文件 | `# tests 42 / pass 42 / fail 0 / skipped 0 / todo 0` |
| 6 | 只读/写点 grep 组 | pack 4 写点、otel 1 写点、probe 1 写点（`--out`）；antipattern/perf 禁词 grep exit 1 |
| 7 | 新增源码 CJK 门禁（`grep -lP`）+ 码点 grep（`grep -nE`） | 批次 2 六文件 CJK 零命中；码点命中均为控制符或 CJK 检测正则 ASCII 写法 |
| 8 | `purity-check.mjs --dirs` ×3 + `node -p deps` + I1.11 差集 grep | 三目录 exit 0（27/11/25 文件零命中）；deps=0；I1.11 差集 exit 1 零命中 |
| 9 | 全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` | `# tests 1631 / pass 1606 / fail 16 / skipped 9 / fail_count 16` |
| 10 | 16 条失败解析 + baseline 比对 + `node --test --test-name-pattern` 重跑 1565 ×3 | baseline 登记命中 14 条（183/184/230/232/736/802/849/1559/1563/1564/1566/1567/1568）+ flake 2 条（211/807，flake-frames 登记）+ 1565 重跑 3/3 `ok 1`、`fail 0` → flake；**差集 0** |
| 11 | `git -c core.autocrlf=false checkout --` 3 个 `nfr-perf-*.json` + 核对 | 恢复后 `git status --short` 回到 15 评审对象；`git diff --stat -- docs/iterations/iteration-4/evidence/` 空 |
| 12 | labels/roles/workflows/main 状态 grep（S-01~S-04） | labels 新增键零命中（exit 1）；导出 payload 无 signature；`RUNTIME_SUBS` 无 export/import；main.js/labels.js 本轮未改 |

> 说明：全量测试（#9）触发 `iteration-12.md:500` 风险 10——覆盖写历史证据 3 个 JSON；已按口径恢复（#11），工作树除评审对象 15 文件与本文件外无改动。本文件为本轮唯一新增的非评审对象文件，符合只读约束。
