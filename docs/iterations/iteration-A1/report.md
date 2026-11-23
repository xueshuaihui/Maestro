# A1 实现报告 — Agent CLI 发现与罗列

> **需求依据**：`requirement.md` v2（15 AC / 11 BR / 5 NF；S0 评审 round1 FAIL → round2 PASS）
> **拆分与契约**：`docs/iterations/iteration-A1.md`（8 节 / 5 WP / 15 AC 满覆盖 / 文件零重叠）
> **验收记录**：`acceptance-fixture.md`（15 节）+ `probe/accA1-f-summary.json`（84 证据 / 151 核对项）
> **评审记录**：`review-round1.md`（FAIL）→ `review-round2.md`（PASS）→ `review-split.md`（PASS）→ `review-impl.md`（PASS）
> **终验**：`final-verification.md`（条件性 PASS）
> **环境**：macOS / zsh / Node v22.22.2 / 零运行时依赖；**完成时间**：2026-11-23

## 0. 总体结论

**A1 达成「除 AC-12 真实宿主面外全部 Done」的条件性收口；AC-12 因本机无目标 Agent CLI 判阻塞，需 D-4 取证机器补测或用户书面豁免，不宣布无条件结束。**

| 判定项 | 结果 |
|---|---|
| AC | 15 条：14 通过 / 0 不通过 / 1 阻塞（AC-12） |
| 核对项 | 151 条（results.jsonl 55 行聚合，最后一条为准） |
| 证据 | 84 份原始帧，零空文件 |
| 测试门禁 | wp16 49/49 全绿；全量 1983/1963/17fail（均旧用例，wp16 无红，新增红差集 0，AD-06 等效口径） |
| 架构扫描 | purity exit 0（45 文件 / 11 词零命中）；零依赖 0；领域层零 CJK |
| 需求评审 | 2 轮（round1 FAIL→round2 PASS，F 项全闭合，规划逐句覆盖无缺漏） |
| 阻断级缺陷 | 0（实现评审 D-1/D-2 两个 P2 已修复闭环） |

**能力结论**：本机 CLI 发现器（PATH/应用目录/包管理器/用户配置四来源）、五维能力矩阵、ACP NDJSON 握手、`orch cli list|scan|probe|add` 命令面全部可用；mock 面实证充分。**最难一条 AC-09（五维矩阵，即 round1 阻断 F-01 的落地）实测 13/13 通过**，证据 `evidence/AC-09.*`。

## 1. 交付物

- **产品代码**：`src/adapter/cli-discovery/`（discover/registry/probe/capability-matrix/known-agents/index，6 文件）+ `src/cli/cli-discovery.js` + `src/cli/labels.js`（追加 18 键，旧 25 键逐字不变）；零第三方依赖。
- **测试与夹具**：`test/wp16/` 5 个测试文件（49 例，A1-01~13 逐字保留）。
- **验收产物**：`probe/accA1-*`（四件套 + 15 用例 + 84 证据 + parts/results/summary）+ 本目录 10+ 收口文档。

## 2. AC 逐条判定（15 条）

| AC | 分面 | 判定 | 证据分级 | 核对项 |
|---|---|---|---|---|
| AC-01 | PATH 发现 | 通过 | mock 实测 | 8 |
| AC-02 | 版本探测 | 通过 | mock 实测 | 8 |
| AC-03 | 应用目录发现 | 通过 | mock 实测 | 10 |
| AC-04 | 包管理器发现 | 通过 | mock 实测 | 9 |
| AC-05 | 用户配置来源+重扫保留 | 通过 | mock 实测 | 13 |
| AC-06 | 不可达诊断 | 通过 | mock 实测 | 12 |
| AC-07 | ACP NDJSON 握手 | 通过 | mock 实测 | 11 |
| AC-08 | 超时/失败数据契约 | 通过 | mock 实测 | 7 |
| AC-09 | 五维能力矩阵（F-01 落地） | 通过 | mock 实测 | 13 |
| AC-10 | 重新扫描 | 通过 | mock 实测 | 7 |
| AC-11 | 只读纪律 | 通过 | mock 实测 | 9 |
| **AC-12** | **真实宿主面** | **阻塞** | **待本机实测（需装目标 CLI 的机器）** | 6（4 blocked） |
| AC-13 | 手动添加自定义 CLI | 通过 | mock 实测 | 18 |
| AC-14 | mock 支撑面 | 通过 | mock 实测 | 10 |
| AC-15 | 空态与来源概览 | 通过 | mock 实测 | 10 |

## 3. 验收中发现并修复的缺陷 / 证据分级

| 缺陷 | 现象 | 根因 | 修法 | commit | 复验 |
|---|---|---|---|---|---|
| S0 F-01（阻断） | 能力矩阵 4 维，删了 stdio/transport | 需求撰写收窄规划 | v2 补回五维并同步 AC-09 Then+锚点 | 文档 v2 | round2 PASS |
| S2 D-1（P2） | realpath 判重无回归锁定 | 测试缺 symlink 场景 | 补 symlink 真实用例 | 9ccf8b3 | CLI-A5 通过 |
| S2 D-2（P2） | AC-12 测试硬编码本机观测 | 未做环境自适应 | 阻塞/真实两分支由环境事实驱动 | 9ccf8b3 | 两分支实测通过 |
| S2 自修 | macOS /var 与 /private/var 符号链接重复添加漏判 | path.resolve 未归一 | 判重改 realpath | 8305b38 | wp16 全绿 |
| 验收脚手架 | 首轮 orch() 缺 cli 前缀、mock 卡死脚本 | 脚手架自身问题 | probe 内修复（非产品缺陷） | 0cc69c2 | 14/0/1 |

证据三档分布：mock 实测 14 条 / 待本机实测 1 条（AC-12） / 已实测真实宿主 0 条。

## 4. 门禁与复现（可直接复制执行）

```bash
cd /Users/xuesh/www/Maestro
NODE_ENV=test node --test --test-concurrency=1 test/wp16/*.test.js   # 49/49，exit 0
NODE_ENV=test node --test "test/**/*.test.js"                        # 1983/1963/17fail（旧用例，wp16无红）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator  # exit 0
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"  # 0
node probe/accA1-f-run.mjs --all                                     # 14通过/0不通过/1阻塞
node probe/accA1-f-final.mjs                                         # 重建报告与汇总
```
主控独立复跑：AC-09 通过 13/13、AC-13 通过 18/18、AC-12 阻塞 2/6——与验收判定一致；AC-07 证据原始帧确为真实命令输出（含时间戳/退出码/中文文案）。

## 5. 遗留问题与边界

1. **AC-12（阻塞，不阻断其余 14 条）**：本机 PATH 40×3 目录、应用目录、home 标记三方观测均无可握手目标 CLI，Given 不可构造。取证前提：一台装有 Codex/Claude Code/Gemini 等目标 CLI 的机器。升级路径：D-4 取证机补测重判，或用户书面豁免。AC-14 mock 面 0 次冒充真实面。
2. **全量非全绿**：17 条 fail 均为旧桌面壳/核心用例既有形态（P-6 基线 1947/1923/21 同类），wp16 无红、新增红差集 0；按 AD-06 等效口径判过，不放宽。
3. **D-3/4/5 建议级**：run() 第三参忽略等 3 项 P3 未修，留痕于 decisions.md，不影响 AC。
4. **A1 可运行面**：命令面 `orch cli`；桌面首屏自动扫描属 C1 范围外（U-04 已闭合为 D-11 实现约束）。

## 6. 与前序迭代的关系

A1 是 v2 阶段 A 首个迭代。复用 v1 引擎底座的持久化/原子写约定（`src/persistence/`）与 purity 门禁；新增领域层 `src/adapter/cli-discovery/` 独立实现，**不碰 `src/core`/`src/daemon`、不改 `main.js` 冻结 parser、中文只在 labels.js**。`known-agents.js` 移植 geiger MIT 识别表（D-2 技术结论），能力握手自研（NDJSON），无运行时第三方依赖。

## 附录：命令速查
见 §4。验收单条：`node probe/accA1-f-run.mjs AC-XX`；批次 `AC-01~05 / 06~10 / 11~15`。
