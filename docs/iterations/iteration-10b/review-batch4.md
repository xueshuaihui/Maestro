# I1.10b 实现评审 · 批次 4（WP-6 回归与端到端架构守门 + 需求 v6.1 C1 补注）

> 评审对象：`test/wp14/acceptance-drill-e2e.test.js`、`test/wp14/regression-drill.test.js`（新增）；
> `docs/iterations/iteration-10b/evidence/flake-frames/**`（新增）；`requirement.md` v6.1（C1 补注）。
> 上下文：干净只读评审；分支 `feat/i1.10b-drilldown`，HEAD `18438d6`，WP-6 + 需求 v6.1 未提交。唯一可写文件为本报告。
> 判据来源：`iteration-10b.md` §4 WP-6 / 检查点 4；`requirement.md` v6.1 的 AC-29/AC-30/AC-34；`decisions.md` 裁决 G/J-3/H（含 10a 裁决 R-08）；`review-batch3.md` §5；`baseline-failures-win32.txt`。

---

## ① 总判

**PASS（阻断 0 / 建议 2）。**

七个维度全部达标：AC-29 九步探针与七条 Then 逐条机检、无终端/CLI、注入时钟内部断言；AC-34 三主链/两格式/USAGE_LINES/命令表哨兵齐备，未硬编码条数、用差值等价语义，允许集合结构与差集判定正确；AC-30 31 词双目录字面与需求逐字相等、零依赖、purity 自跑 exit 0；全量差集独立复核 `tests 1524 ≥ 1425`、16 条失败全部落在允许集合、差集 = 0；flake 两条环境红留原始 TAP 与隔离复跑结论；需求 v6.1 仅 3 处文档补注、Then 判定行与 HEAD 完全相同。两条建议均为证据/自洽补强（traceId flake 补帧、`nfr-perf` 证据恢复），不改任何 AC 判定强度。

---

## ② 七维逐维一行

| # | 维度 | 结论 | 证据（行号 / 实跑输出） |
|---|---|---|---|
| 1 | **AC-29** 九步/七 Then/无终端/注入时钟 | **PASS** | 九步 `PROBE_ORDER`（测试 :43-53）与 `requirement.md:751` 逐字一致；七条 Then 七机检（:316-398，逐条 `graph-shown`/`drill-shown`/`detail-shown`/`evidence-shown`/`escalation-shown`/`continued`/`subflow-shown`+`graph-restored`）；无终端/CLI（:56 正则 + :376-386 序列+spawn/exec 字段零命中）；内部断言注入时钟（:165-168 `now/advance`，:369-373 ≤2000 且标「内部断言」）；架构检查 `grep -REn "NODE_ENV === 'test'" desktop/ui/drill/` 实跑 exit 1（零命中）。8 test 全绿。 |
| 2 | **AC-34** 主链/格式/哨兵/口径 | **PASS** | 三主链 `CHAINS`（:138-190）、两格式 `STATUS_BASELINE`/`GRAPH_TEXT_BASELINE`/`GRAPH_JSON_BASELINE`（:265-316）、`USAGE_LINES.length===25`（:323）、命令表哨兵（:337-353）；**未硬编码测试条数**：`judgeRun`（:490-506）用 `tests >= baseline`，:488 明注「不比较单次 fail 绝对值」；允许集合 `loadAllowedFailures`（:470-482）+ 结构断言（:515-524）+ 差集 `failNames ∖ allowed`（:496）正确。 |
| 3 | **AC-30** 31 词/零依赖/自跑 | **PASS** | `WORDS_31`（:41-48）与 `FORBID_LITERAL`（:450-456）比对 `requirement.md:764` 逐字相等（脚本核 31 词、相等 true）；零依赖测试（:441-445）+ 自跑 `node -p ...dependencies.length` = `0`；purity 双目录自跑均 `OK … 零命中` exit 0。 |
| 4 | **差集独立复核** | **PASS（0 阻断；traceId 补帧列建议）** | 自跑全量（串行 `--test-concurrency=1 --test-force-exit`）得 `tests 1524 / pass 1499 / fail 16 / skipped 9`，计数自洽 1499+16+9=1524，≥1425；16 条失败逐条核对：13 条逐字命中 win32 登记项（`baseline-failures-win32.txt:23-35`）+ AC-04（10a `report.md:66` 裁决 R-08）+ symlink（`review-round3.md:464-467` 环境红）+ traceId（本次隔离复跑 2/2 PASS，EBUSY 环境 flake）。实体差集 = 0。 |
| 5 | **flake 留帧** | **PASS** | AC-04 帧 41 行原始 TAP（`not ok 2`…`expected running/actual completed`，`# fail 1`）；symlink 帧 281 行（`not ok 12 … EPERM`，`# fail 3`）；`_index.md:10-13` 命令/归属/结论齐全，隔离复跑「仍红」如实记录（测试 :560-565 `isolatedPass=false`，未要求翻绿、未弱化断言）；`git status` 仅新增 `evidence/`，既有 evidence 未改。 |
| 6 | **需求 v6.1 C1 补注** | **PASS** | `git diff` 仅 3 处：版本行 `v6→v6.1`、附录 C 新增 v6.1 行、C1 补注（:1683）；计数实核 `AC 51 / BR 43 / NF 7` 不变；Then 判定行 69 行 `diff` 与 HEAD 完全相同（exit 0）；补注明写「不回填为 AC 判据、不改任何 AC 判定强度」（:1683）。 |
| 7 | **文件边界与回归** | **PASS** | `git status`：产品代码零改动，只新增 2 测试 + `evidence/flake-frames/` + 需求 3 处文档补注 + 既有 memory/nfr-perf（后者为本评审跑全量覆盖，见建议 2）；51 AC 判定面未改（Then diff 0）；两测试 `tests 16 / pass 16 / fail 0` 全绿。 |

---

## ③ 全量差集独立复核结果（数字）

- 命令：`NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"`
- **tests = 1524**（≥ 基线 1425，条数只增不减）；**pass = 1499**；**fail = 16**；**skipped = 9**；计数自洽 `1499+16+9=1524`。
- 16 条失败归属：win32 登记项字面命中 **13** 条；AC-04 允许项 **1** 条（10a 裁决 R-08）；symlink 环境红 **1** 条（round3 已定性）；traceId 环境 flake **1** 条（本次隔离复跑 2/2 PASS 确认）。
- **失败集合 ⊆ 允许集合；差集（集合外新增红）= 0。**
- 副作用：本次全量覆盖改写了 `docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json`（内容改写，非仅 CRLF）；本评审只读未恢复，交主控按 HEAD 恢复。

---

## ④ B4 阻断标题行

**无。**

（无序列/Then 缺失、无硬编码测试条数、无允许集合口径错误、差集 = 0、无测试弱化、既有 evidence 未被实现方改动、需求 Then 与 HEAD 完全相同、门禁与两测试全绿。）

---

## 建议清单（文风一律建议）

- **S-B4-01（traceId flake 未建档留帧、未纳入允许名单——严格字面差集未归零）**：本次全量观测到 `实例创建即有 state.traceId…`（`test/wp9/i19-orchestrator.test.js:171`，失败因 `EBUSY: … rmdir`，Windows 时序类）。该条为 `review-batch3.md` S-B3-03 已登记的 flake，本评审两次文件级隔离复跑均 **PASS**（未出现在 `not ok` 清单），实体确认为 flake，故实体差集 = 0、不判阻断。但 `flake-frames/` 目录当前只有 AC-04、symlink 两条帧，`_index.md:15-17` 亦注明「该条如在全量中观测到…另行留帧」，实现方尚未给它建原始帧；`regression-drill.test.js` 的 `REGISTERED_ENV_REDS`/`loadAllowedFailures` 也未纳入它。建议主控补建该条隔离复跑原始帧并同步进 `_index.md` 名单与测试 `allowed`，使按裁决 G「允许项须附原始帧」的**严格字面差集也归零**，保持 B3 移交事项闭合。此建议不改判定强度。
- **S-B4-02（nfr-perf evidence 被本评审全量运行覆盖）**：本评审按任务要求跑全量后，`nfr-perf-{atomic,batch,render}.json` 的 SHA256 由跑前值改变且为内容改写（逐字节去 CRLF 后与 HEAD 不一致）。依任务约定「评审只读、主控恢复」，本评审未恢复。建议主控按 `HEAD` 还原这 3 个文件后再收口，避免把评审取数副作用误计入交付改动。

---

## ⑤ 移交 S3 验收注意事项（2 条）

1. **traceId flake 补帧与严格字面差集归零**：S3 收口前确认 `docs/iterations/iteration-10b/evidence/flake-frames/` 已补 `实例创建即有 state.traceId…` 的文件级隔离复跑原始帧（本评审 2/2 PASS 可作参照），并同步 `_index.md` 与 `regression-drill.test.js` 的允许集合；届时按裁决 G 严格字面口径复核 `diff = observedFail ∖ allowed = 0`，勿因单次红数（本次 16）或 flake 成员翻转放宽断言，禁用 `--no-flake-confirm` 一类开关。
2. **恢复 `nfr-perf` 证据 + 确认写入边界**：S3 验收前将 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 按 `HEAD` 还原（本评审全量取数覆盖，非交付方改动）；并复核 `git status` 中交付方实际写入仅为 2 个新测试 + `evidence/flake-frames/` + 需求 3 处文档补注，产品代码与既有 51 AC 判定面（Then 行）零改动。
