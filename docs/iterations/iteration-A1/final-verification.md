# A1 迭代 · 终验报告（final-verification）

> **对象**：Maestro A1 迭代（Agent CLI 发现与罗列）全量结果——「这个迭代能不能算结束」。
> **判据**：`docs/templates/execution-template.md` §3.6（终验六项）/ §4.5（Done 七项，含「阻塞」张力条款）/ §4.2（必须出现的数字）；定稿需求 `requirement.md` v2（15 AC）；`docs/iterations/A-phase-decisions.md`（AD-06 门禁等效口径 / AD-08 真实宿主判阻塞）。
> **环境**：darwin / zsh / Node v22.22.2（`/Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node`）；仓库根 `/Users/xuesh/www/Maestro`，HEAD `0cc69c2`。
> **时间**：2026-11-23（终验 Agent 独立派单；只读复核，不采信他人结论）。
> **独立性声明**：本报告全部判定由终验 Agent 自己实跑命令、抽查原始证据帧得出；未由实现 / 验收 Agent 兼任，未复述其结论。

---

## 1. 终验六项逐项判定（§3.6）

| # | 校验项 | 判定 | 复核依据（自跑） |
|---|---|---|---|
| 1 | 结果完整性 | **PASS**（附口径说明） | summary `perAc`=15，覆盖 AC-01~15；聚合复核 14 通过 / 0 不通过 / 1 阻塞（AC-12）；核对项共 **151** 条；需求 §1.3 七项范围内条目与拆分 5 WP 的 13 个源码/测试交付项均有结论 |
| 2 | 证据支撑性 | **PASS** | evidence 实盘 **84** 帧、零空文件；抽查 AC-09/13/12 原始帧均真支撑判定 |
| 3 | 判定未被放宽 | **PASS** | fixture 的 Then 与需求 v2 §3.1 逐字一致；AC-12 严守阻塞、未写成通过；AC-09 五维为收严而非放宽 |
| 4 | 门禁与回归 | **PASS**（按 AD-06 等效口径，附偏差标注） | wp16 实跑 **49/49**、exit 0；purity exit 0；零依赖 **0**；全量 EXIT 1、17 fail 均为旧迭代用例，wp16 无红、新增红差集 0 |
| 5 | 缺陷与遗留 | **PASS**（附 report 缺失标注） | blockers.md 唯一项 AC-12 有取证前提 / 试过路径 / 升级建议 / 取证动作；report.md §5 尚未产出，留主控收口 |
| 6 | 提交范围 | **PASS** | 功能 6 commit（4044869~9ccf8b3）diff 无 `evidence/**`、`probe/**`；验收 commit `0cc69c2` 单独；四处可用数字均 14/0/1 |

### 逐项复核明细

**① 结果完整性 — PASS**
只读重演 `final.mjs` 的 `map.set(r.ac, r)`（后跑覆盖先跑）聚合 55 行原始记录，得 15 AC / 14 通过 / 0 不通过 / 1 阻塞（AC-12），与 `summary.json` 及 `acceptance-fixture.md` §0 完全一致；核对项 151 条逐 AC 分布 8/8/10/9/13/12/11/7/13/7/9/6/18/10/10。需求 §1.3 七项范围内条目全部落到 AC-01~15（详见 requirement.md:42-48、D-10:508）；拆分 §4 的 WP-1~WP-5 共 13 个交付文件全部有落地结论（review-split 文件零重叠 + review-impl §1 逐项确认 + wp16 49/49 实跑）。
*口径说明*：模板 §3.6 字面要求「阻塞 = 0」，本项按任务书给定的 14/0/1 适配口径判 PASS；AC-12 作为结项状态的合法性不在本项消解，交由 §2 与 §3 判定。

**② 证据支撑性 — PASS**
- 实盘 84 帧（每 AC 5~7 帧），`find evidence -type f -size 0` 空结果，无「只有结论无原始帧」。
- AC-09（`matrix.stdout.txt`）：表头逐字 `ACP | stdio·transport | 会话恢复方言 | 并发上限 | 证据钩子`，MockCLI 行 `支持 | 未探测 | …`、StubCLI 全 `未探测`，真实支撑五维判定。
- AC-13（`add.stdout.txt`）：add exit 0、清单可见 MyCLI/user-config、probe exit 0、重复/空名/空路径/不存在文件各 exit 1 并给原因，18/18 有原始帧支撑。
- AC-12（`host-observation.json` + `blocked.stdout.txt`）：PATH 40 目录 × codex/claude/gemini `onPath=[]`，apps 仅 `/Applications/WorkBuddy.app`（无可执行），homes 空；三目标 probe 全部 exit 1「未找到 CLI」——真实支撑「阻塞」而非「通过」，也非空结论。
- meta 证据分级：AC-09/13 = `mock 实测`，AC-12 = `待本机实测（需装有目标 CLI 的机器）`，未混淆。

**③ 判定未被放宽 — PASS**
fixture §②「需求原文」块与 `requirement.md` v2 §3.1 的 Then 逐字段一致（AC-09:255 五维、AC-12:288 四项一致 + 无需配置、AC-13:299）。AC-09 由 v1 四类改为五类并加「缺任一维度判不通过」「无自相矛盾」，属收严；AC-12 的 Given/When/Then 四核对项全 `blocked:true`，佐证项仅「未用 mock 冒充」「留只读观测」两条 `ok:true`。results.jsonl 早期的 flow 阻塞（AC-01/02/05，夹具 ENOENT）与不通过（AC-03/04/08）均为修复前快照，被后续重跑按「后跑覆盖先跑」正常覆盖，不是把阻塞改写为通过。

**④ 门禁与回归 — PASS（AD-06 等效口径，如实标注偏差）**
- `NODE_ENV=test node --test --test-concurrency=1 test/wp16/*.test.js` → `# tests 49 / # pass 49 / # fail 0`，exit 0。
- purity（11 词并集扫 `src/core,src/daemon`）→ `OK: 扫描 45 个文件…零命中`，exit 0。
- 零运行时依赖 → `0`；领域层 6 文件零 CJK → 全 OK。
- 全量 `node --test "test/**/*.test.js"` **实跑两次**（约 5 分钟/次）：`FULL_EXIT=1`，`# tests 1983 / # pass 1963 / # fail 17 / # skipped 3`。17 个失败项逐条核对为 copyToBackup、NFR-02 性能、desktop-shell、AC-26/36/37/43/44、task-loop、core.stop、cursor.json、main cwd、turn-delay 等**旧迭代桌面壳/核心用例**，无一属于 wp16；新增红差集 0。
- **偏差标注（不得省略）**：本机本次全量为 **EXIT 1 / 17 fail，不是历史记录的 EXIT 137，也不是「全量全绿」**；与需求 P-6 基线 1947/1923/21 同属「旧用例既有失败 + flaky」形态（测试数因 A1 新增增至 1983、fail 21→17）。按 AD-06 等效口径接受，不放宽任何 AC 判据。
- `report.md` 尚未产出，故「数字与 report 一致」无法核对，如实标注。

**⑤ 缺陷与遗留 — PASS（附标注）**
`blockers.md` 仅登记 AC-12，四项未成立核对项逐条给出本机实测原因，且写明「取证前提（D-4 取证机）/ 试过路径 / 为什么观测不到 / 升级建议 / 取证动作（独立项目根 `cli scan` 对照 `which`/`--version`）」。第 24~28 行专节「AC-12 取证前提与升级建议」满足「写明取证前提与升级路径」。report.md §5 未产出，待主控收口时确保只列观察项、不把 AC-12 写成「不影响结论」。

**⑥ 提交范围 — PASS**
`git log`：功能提交 6 个 `4044869`(WP-1) → `b50a582`(WP-2) → `ee65043`(WP-3) → `8305b38`(WP-4) → `34dd418`(WP-5) → `9ccf8b3`(D-1/D-2 修复)；`git diff --name-only 4044869~1..9ccf8b3 | grep -E "evidence/|probe/"` 空结果。`evidence/**` 与 `probe/accA1-f-summary.json` 首次且仅见于验收 commit `0cc69c2`。数字四处一致：summary / results 聚合 / fixture §0 / blockers 均 14/0/1，证据数 84 与实盘一致；report.md 缺失部分同上标注。

---

## 2. Done 七项逐项判定（§4.5）

| # | 条件 | 判定 | 依据 |
|---|---|---|---|
| 1 | 需求里的任务全部通过 | **FAIL** | 14/15 通过，AC-12 阻塞；未达「100% 通过」 |
| 2 | 零失败、零阻塞 | **FAIL** | `不通过=0` 满足，但 `阻塞=1`（AC-12）不满足 |
| 3 | 门禁全绿 | **PASS** | 按 AD-06 等效口径：wp16 49/49、purity 0、零依赖 0、新增红差集 0；标注全量 EXIT 1 / 17 fail（旧用例）/ 非全绿 |
| 4 | 缺陷与遗留收口 | **FAIL** | blockers 每项有处置，但 `report.md` §5 未产出、无法核对；且 AC-12 为未完成 AC，不满足「不含未完成 AC」的前提 |
| 5 | 终验与复核 | **FAIL** | 终验总判定为「条件性 PASS」而非无条件 PASS；未见主控独立复跑 3~5 条关键 AC 的记录，且 `progress.md` 未产出 |
| 6 | 数字一致 | **FAIL** | `report.md` 未产出，四处（report / acceptance / summary / results）无法对齐；其余三处 14/0/1 与 84 帧一致 |
| 7 | 需求评审闭环已 PASS | **PASS** | `review-round1` 总判 FAIL（阻断 F-01 + 建议 F-02~F-06）→ v2 逐项修复 → `review-round2` 总判 PASS、F-01~F-06 三态全「已修」；规划逐句覆盖表 13/13 PASS，无「部分/缺漏/越界/收窄」，反向扫描无夹带；头部版本 `v2` = 附录 C 变更记录末行 `v2`（requirement.md:8、:440）；`review-split`（PASS）、`review-impl`（PASS）齐全 |

**张力直面（§4.5 原文）**：`阻塞` 是过程中合法状态，但**不是结项时**的合法状态；收口时仍有阻塞，只有「补齐观测路径重判」或「升级用户取得书面豁免」两条路，不许带着阻塞宣布结束，也不许把阻塞改写成通过。本机已按 P-4 完成 PATH（40 目录 × 3 目标）、应用目录（`/Applications/WorkBuddy.app` 仅安装标记）、home 三方只读观测，`onPath=[]`、三目标 probe 全部 exit 1，**确实无目标 CLI，观测路径无法在本机补齐**。

---

## 3. 总判定：**条件性 PASS**

**结论**：A1 迭代**不能无条件宣布结束**。终验六项均 PASS（按任务书 / AD-06 适配口径），交付物层面「除 AC-12 外全部 Done」；但按 §4.5 逐项判定，Done 第 1/2/4/5/6 项 FAIL，第 3/7 项 PASS。所有失败根因收敛且单一——**AC-12 真实宿主面阻塞 + 收口文档（report.md / progress.md）与主控复跑尚未产出**。本机三方观测已穷尽，无法补齐 AC-12 的观测路径，因此不满足「无条件 Done」。

**AC-12 阻塞的处置建议（二选一，豁免前不判通过）**：
1. **补测重判（首选）**：由主控/用户在 D-4 取证机器（装有至少一种目标 Agent CLI 且其可执行在命令搜索路径中）的独立项目根执行：
   `NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan` → `cli list`，断言清单含目标 CLI 且名称/路径/版本/连接状态四项与 `which <bin>` / `<bin> --version` 实测一致；取证后按 same 口径重跑 `final.mjs`，AC-12 改判通过，六项与 Done 重算。
2. **书面豁免**：若暂不安排取证机，由用户按 §4.5 对 AC-12 出具书面豁免，明确「接受 AC-12 留待 D-4 补测、不阻断本次收口」；豁免落盘前**不得**把 AC-12 写成通过，也不得用 AC-14 的 mock 实测冒充真实宿主达标。

**收口附带事项**（非 AC 判据，主控 S4 动作）：产出 `report.md`（§4.1 骨架，§4.2 数字含 15 AC / 151 核对项 / 84 证据 / 49/49 / 全量实况 / 2 轮评审最终 PASS 轮号）与 `progress.md`，完成主控独立复跑 3~5 条关键 AC 留痕，并主动向用户汇报。

---

## 4. 实跑命令汇总

| # | 命令 | 结果 |
|---|---|---|
| 1 | `NODE_ENV=test node --test --test-concurrency=1 test/wp16/*.test.js` | `# tests 49 / # pass 49 / # fail 0`，exit 0 |
| 2 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <11 词并集>` | `OK: 扫描 45 个文件…零命中`，exit 0 |
| 3 | `node -e "console.log(Object.keys(require('./package.json').dependencies\|\|{}).length)"` | `0` |
| 4 | `node -e "/[\u4e00-\u9fff]/.test(fs.readFileSync(f))"` × 6 领域文件 | 全 `OK`（零 CJK） |
| 5 | `NODE_ENV=test node --test "test/**/*.test.js"`（两次） | `FULL_EXIT=1`；`# tests 1983 / # pass 1963 / # fail 17 / # skipped 3`；17 fail 全为旧迭代用例，wp16 无红 |
| 6 | `python3` 重演 `final.mjs` 聚合（`map.set` 后跑覆盖） | 15 AC / 14 通过 / 0 不通过 / 1 阻塞，与 summary 一致 |
| 7 | `find evidence -type f -size 0` / `find evidence -type f \| wc -l` | 空 / `84` |
| 8 | `git diff --name-only 4044869~1..9ccf8b3 \| grep -E "evidence/\|probe/"` | 空（功能提交未卷入验收产物） |
| 9 | `git show --stat 0cc69c2` / `git log --oneline -25` | 验收产物仅见 `0cc69c2`；功能 6 commit 独立 |
| 10 | `head -8 requirement.md` / `sed -n '438,441p' requirement.md` | 头部 `v2` = 附录 C 末行 `v2` |

> 报告结束。终验 Agent 判定：**条件性 PASS**；AC-12 须按 D-4 补测或取得书面豁免，豁免前迭代不算无条件结束。
