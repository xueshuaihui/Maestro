# 集成后回归报告 — I1.6 及之前实现（2026-11-09）

> **被测对象**：`main` @ `3f35bfa`（I1.4 + I1.5 + I1.6 并行迭代集成收尾；与 `origin/main` 一致，回归执行前 `git status --porcelain` 为空）
> **权威口径**：`docs/index.md:711`「回归红线」、`docs/iterations/iteration-4.md` §7.2（9 条既有失败白名单）、`docs/iterations/integration-2026-11-09.md` §4/§5（门禁与遗留）
> **环境**：Darwin (macOS) / Node v22.22.2 / `core.autocrlf` 未设置。I1.3、I1.5、I1.6 的原验收跑在 Windows 11 Git Bash，本报告是**异平台回归**，失败归因已区分「集成破坏」与「环境差异」。
> **原始证据**：`docs/iterations/regression-2026-11-09/evidence/`（6 份未加工执行日志，见 §8）
> **复核**：已由只读独立子 Agent 逐项核对数字、白名单编号、D-9 命令与引用路径，并按其 MINOR 意见补齐证据与修正措辞。

## 0. 总判

**PASS — 集成未引入新增功能回归。** 但**两条「三主链逐字不变」AC 在集成版不通过**，属集成说明 O-I2 与 `index.md:711` 已预告的「基线需以集成版重建」，不是功能退化；不阻断后续迭代以 `3f35bfa` 为新基线。

| 判据 | 实测 | 验证状态 |
|---|---|---|
| 全量单测失败集合 ⊆ §7.2 九条白名单（差集 0） | 7 条失败全部命中 #2/#3/#4/#5/#6/#7/#8 | ✅ 已实测 |
| 成功数 ≥ 409 | 984 | ✅ 已实测 |
| 既有测试条数只增不减 | 641 → 992 | ✅ 已实测 |
| D-9 四条纯净扫描 + 零依赖 | 四条 exit 0、依赖键数 0 | ✅ 已实测（`evidence/gates.log`） |
| 双 `workflow` 分流 + 资产 CLI | 分流形状正确、`role list`/`workflow list` exit 0 | ✅ 已实测（`evidence/gates.log`） |
| 三主链逐字不变（对 `1490f6d` / `0cd113b` 基线） | AC-19 19/27、AC-49 15/21 不通过 | ❌ **预期内变化**，见 §4 |
| 真实宿主面 | 0 条 | ⛔ 阻塞（本机无 DSH，见 §5） |

## 1. 门禁一：全量单测

命令：`node --test --test-concurrency=4 "test/**/*.test.js"`（与集成说明 §6 同参），耗时 4m9s，原始输出 `evidence/full-node-test.log`。

| | 用例 | 通过 | 失败 | 跳过 | 出处 / 口径 |
|---|---|---|---|---|---|
| 集成版 `3f35bfa`（本机 macOS，本次） | 992 | 984 | 7 | 1 | `evidence/full-node-test.log` 末尾 TAP 汇总 |
| 集成说明记录的 Windows 集成分支 | 992 | 987 | 5 | 0 | `integration-2026-11-09.md:61` |
| I1.4 收口本机基线（`8af970d`） | 641 | 631 | 9 | 1 | `iteration-4/report.md:126`「加固后主线独占复跑」，**并发参数与本次不同，仅用于白名单集合对照** |

**7 条失败逐条对照 `iteration-4.md` §7.2 白名单（按用例标题前缀匹配）**：

| 失败用例 | location | 白名单 # | 归因 |
|---|---|---|---|
| `NFR-02: verifyProducts({sha256:true}) p95 <= 50ms` | `test/wp10/perf.test.js:97` | #2 | 负载相关墙钟断言，实测 p95=65.84ms |
| `早返回：turn-delay 3000ms 下 startRun 1s 内 resolve…` | `test/wp7/wp7.test.js:113` | #3 | 负载相关，实测 2113ms |
| `task-loop 审核提示词给绝对路径…` | `test/wp4/orchestrator.test.js:1512` | #4 | macOS `/var` → `/private/var` realpath 差异 |
| `core.stop：先回包再断连…` | `test/wp5/ipc-server.test.js:387` | #5 | 断言观测点早于 `dispose()`（既有测试缺陷） |
| `自动拉起：detached 起真进程…` | `test/wp5/lifecycle.test.js:47` | #6 | 既有 known-bug：`core.json` 晚于 `listen` |
| `main：--cwd 相对当前 shell 目录解析…` | `test/wp6/main.test.js:81` | #7 | win32 路径断言未在 macOS 跳过（期望 `D:\work\...`） |
| `cursor.json 并发消费 20 次不重复` | `test/wp6/loop-fixture.test.js:148` | #8 | `cursor.lock` 等待超时（夹具缺陷） |

- 白名单内 #1（`readReview p95`，日志 `:597` 显示 `ok 100`）、#9（`cancel 立即落终态`）本次在负载下通过，按 §7.2「缺席不计为异常」合法。
- **失败集合差集 = 0**；7 条全部落在 `wp4/wp5/wp6/wp7/wp10` 老测试文件，**无一条来自 I1.4~I1.6 新增的 `wp11`/`wp12`**。
- 本机 7 条 vs Windows 记录的 5 条，多出的 2 条是 macOS `/private/var` 与 win32 路径断言未跳过等平台差异，已逐条归因，**不是集成破坏**。
- 未修改任何白名单用例、未放宽断言、未把失败改成 skip。

## 2. 门禁二：红线与命令面

完整执行输出（含 exit code）见 `evidence/gates.log`；命令逐字副本见 `iteration-6/requirement.md:1657-1674`。

| 门禁 | 实测输出 | 结论 |
|---|---|---|
| D-9 #1 `src/core,src/daemon` 31 词 | `OK: 扫描 21 个文件 … 零命中`，exit 0 | ✅ |
| D-9 #2 `src/registry` 30 词 | `OK: 扫描 11 个文件 … 零命中`，exit 0 | ✅ |
| D-9 #3 `roles.js/skills.js/workflows.js` 31 词 | `OK: 扫描 3 个文件 … 零命中`，exit 0 | ✅ |
| D-9 #4 新增实现零 CJK | `OK: no CJK`，exit 0 | ✅ |
| `package.json.dependencies` | `0` | ✅ |
| 双 `workflow` 分流 | `pause` → `{ok,command,sub:"pause",positionals:["I"],flags}`（I1.4 运行时形）；`list` → `{ok,command,sub:"list",flags,positional:null}`（I1.6 资产形） | ✅ |
| 资产 CLI 实跑 | `role list` → 16 角色 exit 0；`workflow list` → 3 工作流 exit 0 | ✅ |
| I1.4 命令注册静态核对 | `src/cli/main.js:546-572` 六组命令 + `RUNTIME_WORKFLOW_SUBS` 均在；`render.js` 60 个导出 | ✅ |

## 3. 门禁三：定向 AC 重跑（13 条）

在隔离工作树（detached `3f35bfa`，先后用 `/tmp/maestro-reg-i16` 与 `/tmp/maestro-reg-i16b`）重跑，**不覆盖主工作区已提交的各迭代验收证据**。挑选原则：受集成改动（`main.js` / `render.js` 双解析分流、用法块并集）影响最大的命令面、逐字基线与注册表门禁。

| 迭代 | AC | 判定 | 核对项 | 说明 | verdict 证据 |
|---|---|---|---|---|---|
| I1.4 | AC-07 | ✅ 通过 | 59/59 | 工作区 + 提示词上下文 | `ac-rerun-batch1.log` |
| I1.4 | AC-28 | ✅ 通过 | 24/24 | 架构纯净 11 词 | 同上 |
| I1.4 | AC-41 | ✅ 通过 | 15/15 | `instance graph --format json` 11 键 | 同上 |
| I1.4 | AC-47 | ✅ 通过 | 29/29 | CLI 输出逐字 | 同上 |
| I1.4 | AC-64 | ✅ 通过 | 14/14 | `--approval` 取值白名单 | 同上 |
| I1.4 | AC-66 | ✅ 通过 | 16/16 | resume 复用 `created` 包三重门控 | 同上 |
| I1.5 | AC-19 | ❌ 不通过 | 19/27 | 三主链逐字（基线 `1490f6d`），见 §4 | 同上 |
| I1.5 | AC-42 | ✅ 通过 | 5/5 | 既有 418 条测试全绿（架构检查面） | `ac-rerun-supp.log`（分节判定摘录，见下注） |
| I1.6 | AC-11 | ✅ 通过 | 8/8 | 工作流 YAML `id` 与文件名一致 | `ac-rerun-batch3.log` |
| I1.6 | AC-43 | ✅ 通过 | 7/7 | 用法块 25 行逐字基线 | `ac-rerun-supp.log`（补留 verdict） |
| I1.6 | AC-49 | ❌ 不通过 | 15/21 | 三主链逐字（基线 `0cd113b`），见 §4 | `ac-rerun-batch2.log` |
| I1.6 | AC-51 | ✅ 通过 | 11/11 | D-9 四条架构检查命令 | 同上 |
| I1.6 | AC-59 | ✅ 通过 | 22/22 | `--applies-to` 五分组闭集 | `ac-rerun-batch3.log` |

**合计 11 通过 / 2 不通过**，两条不通过均为同一类逐字基线变更。

> **证据强度差异（如实标注）**：11 条有 runner stdout 的 `[AC-xx] 通过/不通过 n/m` 行；**AC-42 与 AC-43 两条经二次补跑留证**——AC-43 有完整 verdict 行；AC-42 的 runner 在清理阶段挂起、stdout 未 flush 出 verdict，判定取自**隔离树 `/tmp/maestro-reg-i16b/probe/acc5-f-parts/AC-42.md`** 的「判定：通过（核对 5/5 通过）」一行，已连同 watchdog 超时记录一并落 `ac-rerun-supp.log`。注意**主工作区同名的** `probe/acc5-f-parts/AC-42.md` 是 I1.5 的 Windows 历史验收分节（恰有逐字相同的判定行），**不是本次证据**，复核时勿混用。
>
> **执行插曲（非产品缺陷）**：首批批量脚本在 `### acc5 AC-42` 标题后即无 verdict 行（`ac-rerun-batch1.log` 末行），任务于脚手架清理阶段停滞约 22 分钟后被终止；余下 AC 改用「单条 + 硬超时包装」完成。这是验收脚手架在 macOS 的进程回收问题，建议 I1.7 对清理阶段也加超时。

## 4. 关键发现：两条逐字基线为何不通过

**在本次留存的 diff 摘录范围内：差异表现为 I1.4 合入后提示词与会话状态帧的变化，业务行逐字一致，属预期内的基线重建需求。**

1. **`single` 链零变化**：AC-19 #5/#6、AC-49 #5/#6/#7 均为 `0 行差异`；AC-49 另证 `0cd113b` 树现跑输出与存量基线 `diff` 为空（#7/#13/#19 三条基线出处自证全部 ✅）——**基线文件本身无误，差异确实来自集成版代码**。
2. **`code-loop` / `task-loop` 的会话帧多一行**：归一化后 diff 11~20 行，首处差异均为新增 `会话 执行中 · 调用工具（write） · `，其后各行只是整体下移一行；**节点行、交接包行、升级行的文案与顺序逐字相同**。摘录（AC-19 `code-loop-diff-normalized.txt`）：
   ```
   #6
   - 会话 执行中 · 
   + 会话 执行中 · 调用工具（write） · 
   #7
   - 会话 等待下游 · 产出已提交
   + 会话 执行中 · 
   #8
   - 会话 空闲
   + 会话 等待下游 · 产出已提交
   ```
3. **提示词 task 文本变化是 I1.4 功能生效的正向证据**：AC-49 #14/#20 期望旧提示词，实测多出
   `工作区：<abs>/workspace` / `共享区（只读）：<abs>/shared` / `本节点阶段区：…`——正是 I1.4 A-6 要求对多节点图追加的工作区上下文；I1.4 AC-07 在同版 59/59 通过，互相印证。
4. **判定**：`integration-2026-11-09.md:80-82` 的 O-I2 已写明「I1.4 改写了交接包/升级/审批渲染，三主链相对 `0cd113b` 基线预期会有变化，建议 I1.7 起以集成版重建逐字基线」；`index.md:711` 补充「当前以全量单测 + 与 `origin/main` 的失败集合差集为 0 作为回归门禁」。两条 AC 的失败**不改写、不删除、不豁免**，只登记为基线变更。
5. **未收敛项（诚实标注）**：「多一行会话帧」与提示词变更同批出现，但**具体由哪一处事件/渲染改动引入尚未逐帧定位**；本报告不把它写成「已完全符合 O-I2 预期」。I1.7 重建基线时应同时固定新的帧序列并逐帧说明。

> **证据来源与局限**：上述 diff 与核对项摘自**隔离树内** `/tmp/maestro-reg-i16/probe/acc5-f-parts/AC-19.md`、`/tmp/maestro-reg-i16/probe/acc6-f-parts/AC-49.md` 及 `AC-19.*-diff-normalized.txt`（当时工具输出的原文），这些文件**已随该隔离工作树删除**，§8 的日志只留存 verdict 行、不含 diff 正文；按 §7 命令可重生成。
> 注意：**主工作区同名的** `probe/acc5-f-parts/AC-19.md` / `probe/acc6-f-parts/AC-49.md` 是 I1.5 / I1.6 的 Windows 历史验收分节（AC-19 判定「通过 27/27」），**不是本次集成版证据**，不要据此复核 §4。

## 5. 覆盖范围与未覆盖

| 范围 | 覆盖方式 | 状态 |
|---|---|---|
| I1.1~I1.3 夹具面 | 992 条全量单测含 `wp1`~`wp9` 全部既有测试，除 7 条白名单外全绿 | ✅ 已覆盖 |
| I1.1~I1.3 真实宿主面 | `docs/index.md:703` 规定「真实面证据只在本机可取，无环境同学不得重跑其真实面或改写验收结论」；本机 macOS 无 DSH | ⛔ 未执行（合规，非遗漏） |
| I1.4 | 6 条定向 AC + 70 条历史 AC 报告 + `wp11` 全量单测 | ✅ 已覆盖 |
| I1.5 | 2 条定向 AC（1 通过 / 1 基线变化）+ `wp11` 注册表单测 | ✅ 已覆盖（定向） |
| I1.6 | 5 条定向 AC（4 通过 / 1 基线变化）+ `wp12` 全量单测 | ✅ 已覆盖（定向） |
| `acc2` / `acc3` / 各迭代历史 AC 全集 | 未逐条重跑：各自分支的历史证据仍有效，且集成改动集中在 CLI 层与新增注册表，核心逻辑由单测门禁覆盖 | ⚠️ 未执行，可按需补跑 |

**未做全量 AC 重跑的理由**：单条 case 7~42s、三链类需挂载基线 worktree，五套脚手架全部 AC 约需数小时；本次以「全量单测 + 失败集合差集 + 受集成影响面定向 AC」达到 `index.md:711` 的回归门禁。若需逐条复核，见 §7。

## 6. 残留风险（沿用集成说明，不新增）

- **O-I1**：用法块 25 行未列 I1.4 六组命令（命令本身可用，AC-43 逐字基线锁定）。
- **O-I2 / 本轮 §4**：三主链逐字基线需以 `3f35bfa` 重建；「多一行会话帧」引入点未定位。
- **O-I3**：`workflow` 一词双语义靠命令字分流，建议 I1.7 统一命令树。
- **I1.4 遗留**：AC-66 resume 仍走旁路直调 `dispatchInState`，未收编到 `planAdvance` 的 `reuseHandoffId`（见 `iteration-4/report.md:118`）。
- **真实宿主面 0**：非代码待办，环境限制。

## 7. 复现

```bash
# 全量单测门禁（本机 macOS 实测 992/984/7/1）
node --test --test-concurrency=4 "test/**/*.test.js"

# D-9 四条：完整命令与输出见 evidence/gates.log；
#   词表与命令逐字副本见 docs/iterations/iteration-6/requirement.md:1657-1674

# 定向 AC（务必在隔离工作树跑，避免覆盖已提交证据）
git worktree add --detach /tmp/maestro-reg-i16 3f35bfa
cd /tmp/maestro-reg-i16
node probe/acc4-f-run.mjs AC-07          # acc5 / acc6 runner 同形
node probe/acc5-f-run.mjs AC-19          # 逐字基线，预期不通过
node probe/acc6-f-run.mjs AC-43          # 用法块 25 行，预期通过
node probe/acc6-f-run.mjs AC-49          # 逐字基线，预期不通过
# 建议对每条加硬超时：runner 的清理阶段在 macOS 可能挂起
# 清理前先把需要的 parts / diff 复制到报告证据目录
cd - && git worktree remove --force /tmp/maestro-reg-i16 && git worktree prune

# 失败集合与白名单比对
grep -E '^not ok [0-9]+ -' docs/iterations/regression-2026-11-09/evidence/full-node-test.log
```

## 8. 证据清单与验证状态

| 文件 | 内容 | 状态 |
|---|---|---|
| `evidence/full-node-test.log` | 全量单测 992 条完整 TAP 输出（含 7 条失败堆栈） | 已实测 |
| `evidence/gates.log` | D-9 四条扫描、依赖、双 `workflow` 分流、资产 CLI 的完整输出与 exit code | 已实测 |
| `evidence/ac-rerun-batch1.log` | acc4 六条 + acc5 AC-19 的 verdict；AC-42 **仅留下标题行、无 verdict**（见下） | 已实测 |
| `evidence/ac-rerun-batch2.log` | acc6 AC-49 / AC-51 verdict | 已实测 |
| `evidence/ac-rerun-batch3.log` | acc6 AC-11 / AC-59 verdict | 已实测 |
| `evidence/ac-rerun-supp.log` | 补留 AC-43 verdict；AC-42 分节判定摘录 + watchdog 超时记录 | 已实测（AC-42 为分节摘录） |

**证据分级**：真实宿主实测 0 / mock 与本地夹具实测 13 条 AC（其中 11 条有 runner verdict、1 条补留 verdict、1 条为分节判定摘录）+ 992 条单测 / 阻塞 1 类（真实宿主面，环境限制）。
**改动**：本轮**未修改任何 `src/**`、测试或既有验收证据**；主工作区原有 3 个 `nfr-perf-*.json` 被全量测试重写，已 `git checkout --` 还原（复核时 `git status --short -- docs/iterations/iteration-4/evidence/nfr-perf-*.json` 为空）。回归结束后 `git status --short` 仅有 3 项差异：` M .workbuddy/memory/2026-11-09.md`（已跟踪的项目日志，本轮追加）、`?? docs/iterations/regression-2026-11-09.md`、`?? docs/iterations/regression-2026-11-09/`（后两项为本轮新增报告与证据）；**三项均因本轮回归产生，且均未提交**。
