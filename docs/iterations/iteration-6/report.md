# I1.6 实现报告 — 自定义角色 + 工作流完整原语 + 校验器 + CLI 资产命令集

> **依据**：`docs/iterations/iteration-6/requirement.md`（v7 定稿，2026-11-09；65 AC / 41 BR / M-1~M-7 / C-01~C-14 / 附录 A~D）
> **拆分与契约**：`docs/iterations/iteration-6.md`（8 WP，文件零交集）；裁决台账 `decisions.md`（裁-1~裁-17）
> **验收记录**：`acceptance-fixture.md`（夹具面 65 AC，547 份证据）；**真实宿主面：无**（需求 §3.3 把验收面限定为「静态资产 + 终端输出 + 仓库内夹具」，B 类零 DSH，与规划预判一致）
> **评审记录**：需求 `review-round1~3.md`（3 轮，最终第 3 轮 PASS）→ 拆分 `split-review-round1~2.md`（第 2 轮 PASS）→ 实现 `impl-review.md`（FAIL→处置清零）→ 终验 `final-verification.md`（PASS）
> **环境**：Windows 11（Git Bash）· Node v22.22.2 · 零运行时依赖 · S3 收口 HEAD `6215df2`
> **完成时间**：2026-11-09

## 0. 总体结论

**I1.6 达成退出标准（Done 七项全满足）**：65 条 AC 全部通过、0 不通过、0 阻塞；全量测试 769/769；架构纯净四扫描 exit 0；零运行时依赖；三条主链与 I1.5 基线逐字回归。

| 判定项 | 结果 |
|---|---|
| AC | **65 / 65 通过**（0 不通过、0 阻塞），871 条核对项 |
| 全量测试 | **769 / 769**（基线 611 + 新增 158；既有断言仅 D-7a 授权三行改动） |
| 架构扫描 | D-9 四条命令 exit 0（31 词引擎 / 30 词注册表 / 逐文件命令族 / 零 CJK） |
| 零依赖 | `package.json` `dependencies` 键数 **0** |
| 回归红线 | 三主链（single / code-loop / task-loop）归一化后与 `0cd113b` 基线 **diff 为空**；AC-48 六命令与 I1.5 存量证据逐字节相同 |
| 阻断级缺陷 | **0**（验收期 D-1~D-3 + AC-59 全部收口，见 §3） |

**能力结论**：项目现在可以用 `.orch/roles|skills|workflows` 三族资产自定义角色（含派生链）、技能与工作流（11 项编排原语 + 13 项变量映射），并拥有一套固定顺序、固定排序、可机检的三族校验器与 17 条资产命令；`workflow dry-run` 在不起核心、不建会话的前提下给出编排可执行结论。

**最难一条的实测证据**（AC-49 三主链逐字回归）：`NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root %TEMP%/maestro-acc-p6/AC-49 --scenario code-loop` 等三条链 exit 0，输出经 `sed -E 's/已运行 [0-9]+s//g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}//g'` 归一化后与 I1.5 存量基线 `AC-19.*-baseline.txt` diff 为空（证据 `AC-49.*`，20 份），另附 0cd113b 干净工作树现跑交叉验证一致。

## 1. 交付物

| 类别 | 内容 |
|---|---|
| 产品代码 | S2 八个工作包共 **23 个文件**：注册表新增 `src/registry/{workflow-schema,workflows,workflow-plan,contracts,asset-write}.js`，CLI 新增 `src/cli/{skills,workflows}.js` + `src/cli/{main,labels,render,roles}.js` 扩展（既有函数零删除），`bin/orch.js` 接入；`src/bin` 合计 19,529 行；**`dependencies` 键数 0** |
| 测试与夹具 | `test/wp12/` 8 个契约测试文件（零交集分工，D-10）；全量 **769** 条（611 基线 + 158 新增）；仓库夹具 `test/fixtures/{code-loop,task-loop}-driver.mjs` 与 mock ACP agent 复用 I1.5 存量（零改动） |
| 验收产物 | `probe/acc6-f-{lib,common,run,final}.mjs` 四件套 + `probe/acc6-cases/` **65 个逐 AC 用例** + `_fixtures.mjs`；`probe/acc6-f-parts/` 65 份核对表；`probe/acc6-f-results.jsonl`（追加式）+ `acc6-f-summary.json`；`docs/iterations/iteration-6/evidence/` **547 份原始证据**（覆盖 65 条，无 0 字节文件） |
| 文档 | 需求 v7、拆分文档、三轮需求评审 + 两轮拆分评审 + 实现评审、`decisions.md`（裁-1~裁-17）、`progress.md`、`acceptance-fixture.md`、本报告 |

## 2. AC 逐条判定（65 条）

| AC | 场景类型 | 判定 | 核对项 | 证据 |
|---|---|---|---|---|
| AC-01 | 用户可见 | 通过 | 13 | 8 |
| AC-02 | 用户可见 | 通过 | 10 | 7 |
| AC-03 | 用户可见 | 通过 | 13 | 7 |
| AC-04 | 用户可见 | 通过 | 22 | 10 |
| AC-05 | 用户可见 | 通过 | 11 | 11 |
| AC-06 | 机检 | 通过 | 11 | 8 |
| AC-07 | 用户可见 | 通过 | 13 | 9 |
| AC-08 | 机检 | 通过 | 9 | 6 |
| AC-09 | 用户可见 | 通过 | 13 | 7 |
| AC-10 | 用户可见 | 通过 | 14 | 7 |
| AC-11 | 机检 | 通过 | 8 | 6 |
| AC-12 | 机检 | 通过 | 15 | 7 |
| AC-13 | 机检 | 通过 | 12 | 6 |
| AC-14 | 机检 | 通过 | 7 | 6 |
| AC-15 | 回归 | 通过 | 10 | 7 |
| AC-16 | 用户可见 | 通过 | 8 | 6 |
| AC-17 | 用户可见 | 通过 | 14 | 6 |
| AC-18 | 用户可见 | 通过 | 14 | 8 |
| AC-19 | 机检 | 通过 | 7 | 6 |
| AC-20 | 用户可见 | 通过 | 12 | 8 |
| AC-21 | 用户可见 | 通过 | 10 | 6 |
| AC-22 | 用户可见 | 通过 | 9 | 6 |
| AC-23 | 用户可见 | 通过 | 12 | 8 |
| AC-24 | 机检 | 通过 | 11 | 7 |
| AC-25 | 机检 | 通过 | 10 | 6 |
| AC-26 | 机检 | 通过 | 7 | 6 |
| AC-27 | 机检 | 通过 | 12 | 7 |
| AC-28 | 机检 | 通过 | 7 | 6 |
| AC-29 | 混合 | 通过 | 10 | 8 |
| AC-30 | 机检 | 通过 | 8 | 7 |
| AC-31 | 机检 | 通过 | 10 | 8 |
| AC-32 | 机检 | 通过 | 7 | 6 |
| AC-33 | 机检 | 通过 | 8 | 8 |
| AC-34 | 机检 | 通过 | 10 | 8 |
| AC-35 | 机检 | 通过 | 7 | 6 |
| AC-36 | 机检 | 通过 | 11 | 8 |
| AC-37 | 机检 | 通过 | 9 | 8 |
| AC-38 | 机检 | 通过 | 12 | 6 |
| AC-39 | 混合 | 通过 | 15 | 9 |
| AC-40 | 用户可见 | 通过 | 25 | 13 |
| AC-41 | 边界 | 通过 | 8 | 8 |
| AC-42 | 机检 | 通过 | 8 | 5 |
| AC-43 | 用户可见 | 通过 | 7 | 5 |
| AC-44 | 机检 | 通过 | 62 | 16 |
| AC-45 | 机检 | 通过 | 4 | 17 |
| AC-46 | 混合 | 通过 | 20 | 17 |
| AC-47 | 混合 | 通过 | 7 | 5 |
| AC-48 | 混合 | 通过 | 37 | 26 |
| AC-49 | 混合 | 通过 | 21 | 20 |
| AC-50 | 机检 | 通过 | 6 | 5 |
| AC-51 | 架构检查 | 通过 | 11 | 8 |
| AC-52 | 架构检查 | 通过 | 3 | 6 |
| AC-53 | 机检 | 通过 | 8 | 6 |
| AC-54 | 用户可见 | 通过 | 19 | 8 |
| AC-55 | 机检 | 通过 | 10 | 7 |
| AC-56 | 用户可见 | 通过 | 22 | 8 |
| AC-57 | 机检 | 通过 | 22 | 9 |
| AC-58 | 机检 | 通过 | 18 | 11 |
| AC-59 | 用户可见 | 通过 | 22 | 10 |
| AC-60 | 机检 | 通过 | 18 | 12 |
| AC-61 | 机检 | 通过 | 21 | 9 |
| AC-62 | 机检 | 通过 | 15 | 6 |
| AC-63 | 机检 | 通过 | 33 | 11 |
| AC-64 | 机检 | 通过 | 13 | 11 |
| AC-65 | 机检 | 通过 | 10 | 8 |

> 核对项合计 **871**；证据合计 **547** 份（`probe/acc6-f-summary.json` 与 `results.jsonl` 同源）。判定只认逐 AC 用例的实跑核对表，`summary.json` 为唯一汇总出口。

## 3. 验收中发现并修复的缺陷 / 证据分级

| # | 级别 | 现象 → 根因 | 修法与 commit | 复验 |
|---|---|---|---|---|
| D-1 | 需求侧矛盾（裁-16a，R-12） | AC-06/AC-11 Given 点名单字符角色 id，被 C-01（2~32 字符）拒绝，五个专属原因码不可观测；`ROLE_ID_MISMATCH` 明细「文件 c / 声明 c」文案自相矛盾 | 用例改 2 字符 id（a1/b1、m1/s1/c1/p1/d1），Then 语义不变；产品零改动；文案矛盾留后续迭代 | `node probe/acc6-f-run.mjs AC-06 AC-11` → 8/8、8/8 |
| D-2 | **产品缺陷**（裁-16b，O-4 登记不修） | `role diff` 基线解析走 roleMap（项目优先），被同名项目覆盖文件顶掉：基线标签误标「项目」、`无差异` 不可达 | `roles.js` 新增 `builtinRoleObject(id)` 从内置资产树直读；diff 默认基线三态；role-write.test.js 追加 1 块单测（既有断言零改动）→ commit `7a46149` | AC-10 复跑全过；全量 769/769 |
| D-3 | **产品缺陷**（裁-16c，R-13） | `workflow create` 无 `--from` 缺省形把 `title` 填成 `--name` 值，AC-40 机检 `grep -c` 期望 1 实测 2 | 缺省形节点 `title` 改为节点 id `T-001`（AC-40 三段 Then 不变）→ commit `7a46149` | AC-40 复跑 25/25 |
| D-4 | 验收夹具根因 | AC-11 夹具工作流文件名 `use-c1.yaml` 与 YAML `id: use-c` 不一致，触发 `WORKFLOW_ID_MISMATCH`（致命级）整条被剔出 `workflowMap` → `ROLE_CONTRACT_UNBOUND` 不可观测、c1 被计为合法角色 | 修用例：`id` 与文件名对齐 + 入口节点补节点级 `wake_allow`（裁-15 先例） | AC-11 复跑 8/8 |
| D-5 | 需求侧矛盾（裁-17，R-14） | AC-59 When 样例 `--applies-to writing,review` 与需求自身预设的五分组闭集（§2.2.1 / AC-54 逐字文案 / I1.5 `SKILL_GROUP_INVALID`）互斥 | 判样例值 `review` 为笔误；用例按勘误值 `writing,coding` 取证（「含两个分组」语义不变）；v7 正文与产品零改动 | AC-59 复跑 22/22 |
| P-01/P-05 | S2 实现评审阻断+建议 | skill 默认正文英文占位、`--body-file` 缺失文案英文 | labels.js 新增 `SKILL_DEFAULT_BODY` 等中文键（裁-12 通道）→ commit `3efe0fa` | skill-assets 用例全绿 |

**证据分级**（验收面 = 需求 §3.3 的 B 类）：

- **已实测（真实宿主）**：0 条 —— 本迭代验收面不含真实 DSH 宿主（资产命令不接模型；`orch run --workflow` 明确范围外，R-3）。
- **夹具 / CLI 实测**：65 条 —— 全部用例为真实 Node 子进程执行 `bin/orch.js`（非 mock 判定）；三主链经仓库 mock ACP agent 实跑（与 I1.5 同一口径）；逐字/逐字节比对类断言直接对 `0cd113b` 基线取证。
- **阻塞**：0 条（过程中的 AC-59 三项阻塞已由裁-17 收口）。

## 4. 门禁与复现

```bash
# 1) 全量测试（预期 tests=769 pass=769 fail=0）
node --test --test-concurrency=4 "test/**/*.test.js"

# 2) 架构纯净四扫描（D-9 逐字，预期四条 exit 0）
COMMON="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
NOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"
node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"
node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"
node -e "/* 零 CJK 扫描，命令原文见需求 AC-51 */"   # 预期 OK: no CJK

# 3) 零依赖（预期输出 0）
node -e "console.log(Object.keys(require('./package.json').dependencies ?? {}).length)"

# 4) 验收三批（预期 22/22 + 22/22 + 21/21，合计 65/65）+ 报告重建
node probe/acc6-f-run.mjs --batch a
node probe/acc6-f-run.mjs --batch b
node probe/acc6-f-run.mjs --batch c
node probe/acc6-f-final.mjs          # 预期：通过 65 / 不通过 0 / 阻塞 0；871 核对项；547 证据

# 5) 三条主链（预期 exit 0，归一化后与 0cd113b 基线 diff 为空）
NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$TMP/maestro-acc-p6/AC-49" --scenario pass
NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root "$TMP/maestro-acc-p6/AC-49" --scenario doc-pass
# single 链：先在项目根写 mock 宿主（.orch/hosts/dsh.json 指向 test/fixtures/mock-acp-agent.js，
# 同 probe/acc6-cases/ac49.mjs 的 writeSingleHost），再直跑：
NODE_ENV=test node bin/orch.js run --cwd "$TMP/maestro-acc-p6/AC-49/work" --task "写一段 200 字的产品说明，保存到 out/intro.md" --host dsh
```

## 5. 遗留问题与边界（均不影响结论）

| 项 | 内容 | 为何不阻断 |
|---|---|---|
| R-8~R-14 需求侧披露 | R-8（D-7a `:356` 机械连带）、R-9（AC-24 When 参数笔误，全量 validate 口径）、R-10（A-11 map 路径笔误 + `workflow create` 缺省形未定义）、R-11（A-1 漏列节点级 `wake_allow`）、R-12（AC-06/11 单字符 id 与 C-01 互斥 + `ROLE_ID_MISMATCH` 文案自相矛盾）、R-13（缺省形 title 语义未定义）、R-14（AC-59 样例值与五分组闭集互斥） | 全部为需求文本层矛盾，按裁决以用例/实现最小口径收口，AC 判定语义不变 |
| O-1 空字符串序列化 | `role create` 无 `--summary` 落盘 `summary : ''`（既定口径，yaml-lite 可加载） | 建议后续在 C-07 补一句；AC-03 按此形态取证通过 |
| O-2 role validate 计数头 | 有错时文本首行是 I1.5 既有计数头，错误行按 `- ` 计 | 与 I1.5 形态一致，AC-12/13 按此读法通过 |
| O-3 `workflow create --from` 丢弃节点级 `wake_allow` | 复制清单（B-06）不含该键；连带仅靠节点级白名单合法的源无法拷贝 | 无 AC 钉住该形态；建议 I1.7+ 补进复制清单 |
| O-4 `role diff --against <被覆盖内置 id>` | 与 D-2 同根因（roleMap 要求 source==='builtin'），无 AC 依赖 | 留后续迭代 |
| R-3 范围边界 | `orch run` 不接工作流（`--template` 仍只认三内建名，AC-47 实证） | 需求明确本迭代验收面是 `dry-run`；接运行时留后续迭代（并行/超时/重试/子工作流派发） |

## 6. 与前序迭代的关系

- **复用**：验收脚手架沿 I1.3 先例（分批落盘 + final 重建）；`purity-check.mjs`、mock ACP agent、三链 driver 全部零改动复用；I1.5 的 26 资产基线、`loadRegistry`、既有渲染函数签名与输出逐字保持（M-3 / 裁-9）。
- **契约变更**：M-1~M-7（工作流资产与加载器独立、用法块 25 行、`derived_from` 可选键等）+ C-01~C-14 补充契约，全部按需求落地；既有契约未列处一律未动。
- **回归保证**：AC-48（六命令 + JSON 与 I1.5 存量证据逐字节）、AC-49（三主链归一化 diff 空 + 0cd113b 工作树交叉验证）、AC-50（769/769，既有断言仅 D-7a 授权三行）、AC-21（`single` 图逐字红线）四层门禁，任何一层变红即判回归。

## 附录：命令速查

```bash
node bin/orch.js role list|show|validate|create|edit|export|import|diff
node bin/orch.js skill list|show|validate|create|export|import
node bin/orch.js workflow list|show|validate|create|diff|dry-run
node probe/acc6-f-run.mjs AC-11          # 单条 AC
node probe/acc6-f-run.mjs --batch c      # 批次
node probe/acc6-f-final.mjs              # 重建 acceptance-fixture.md + summary.json
```
