# I1.6 验收记录（夹具面）

> 依据：`docs/iterations/iteration-6/requirement.md` v7 §3.1（AC-01~AC-65，逐条 Given/When/Then）、附录 A-1~A-15（输出逐字版式、JSON 结构）、附录 D-2/D-3/D-6/D-7a/D-7b/D-9/D-10（YAML 子集、校验顺序、参数白名单、授权断言、内置资产对齐、架构扫描、测试约束）；裁决裁-11 ~ 裁-15（`decisions.md` 第十一~十三节）。
> 执行：win32 / Node v22.22.2 / 仓库 `d:\WWW\Maestro`（HEAD baf975e）；每条 AC 一个独立项目根 `%TEMP%/maestro-acc-p6/<AC>/`，命令面 AC 不启核心。
> 已披露的实现口径：R-9（AC-24 按全量 validate 取证）、R-10（workflow create 缺省形 / diff map 路径）、R-11（doc-fanout 夹具在 T-001 补节点级 `wake_allow: [writer, editor]`）——均见 decisions.md 裁-13 ~ 裁-15。
> 生成：`probe/acc6-f-run.mjs` 逐条取证（evidence + parts + results.jsonl）→ `probe/acc6-f-final.mjs` 重建本文件。判定只认需求原文的 Then/And/机检；每条证据均可独立复核（原始输出与状态全文落盘）。

## 0. 总判

**65 条：通过 65 / 不通过 0 / 阻塞 0**

- 已产出证据：65 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-6/evidence/` 下 547 个（覆盖 65 条 AC；每条 AC 至少 4 个——不足的：无）。
- 不通过 / 阻塞条目：无。
- 机器可读汇总：`probe/acc6-f-summary.json`；单条中间结论：`probe/acc6-f-parts/<AC>.md`；缺陷记录：`probe/acc6-f-blockers.md`。
- 判定口径：`通过` = 该 AC 的全部 Then/And/机检核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为无法在夹具上观测（或超时），必须在 parts 里写明原因与已尝试路径。

## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 判定）

> 「原始输出」全文在 `evidence/<AC>.output.json`（每条命令的 stdout+stderr 原样）与 `status.txt`（可读转录）；「状态证据」在 `evidence/<AC>.state.json` 与 `events.jsonl`；「命令级原始帧」在 `evidence/<AC>.*.txt|json`。

#### AC-01 从零建出一个能通过校验的角色

- 判定：**通过**（核对 13/13 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-01`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-01 | exit=0 | 112ms
[orch role list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-01 | exit=0 | 114ms
[orch role list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-01 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-01.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根（无 `.orch`）
When 我执行 `orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run`
Then 终端恰好三行：`已创建项目角色：.orch/roles/lead-dev.yaml`、契约行 `- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1`、`校验：通过`；退出码 0；随后 `orch role list` 首行是 `角色 17 个（内置 16 · 项目 1）`
机检：`test -f "$ROOT/.orch/roles/lead-dev.yaml"` 为真；文件首行 `schema: role/v1`，含 `max_concurrent_sessions: 1`；`node "$REPO/bin/orch.js" role list --format json` 的 `counts.project === 1`、`counts.total === 17`、`roles` 中 `lead-dev` 的 `source === 'project'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-01.create.txt` | 148 B |
| `docs/iterations/iteration-6/evidence/AC-01.list.txt` | 1452 B |
| `docs/iterations/iteration-6/evidence/AC-01.lead-dev.yaml.txt` | 174 B |
| `docs/iterations/iteration-6/evidence/AC-01.payload.json` | 6546 B |
| `docs/iterations/iteration-6/evidence/AC-01.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-01.meta.json` | 904 B |
| `docs/iterations/iteration-6/evidence/AC-01.output.json` | 13873 B |
| `docs/iterations/iteration-6/evidence/AC-01.status.txt` | 9196 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 终端恰好三行（期望 3） | ✅ | `3` |
| 3 | Then 第 1 行逐字（期望逐字 "已创建项目角色：.orch/roles/lead-dev.yaml"） | ✅ | `"已创建项目角色：.orch/roles/lead-dev.yaml"` |
| 4 | Then 第 2 行契约行逐字（期望逐字 "- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1"） | ✅ | `"- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1"` |
| 5 | Then 第 3 行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 6 | Then role list 退出码 0（期望 0） | ✅ | `0` |
| 7 | Then role list 首行 = 角色 17 个（内置 16 · 项目 1）（期望逐字 "角色 17 个（内置 16 · 项目 1）"） | ✅ | `"角色 17 个（内置 16 · 项目 1）"` |
| 8 | 机检：test -f .orch/roles/lead-dev.yaml 为真 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-01\.orch\roles\lead-dev.yaml` |
| 9 | 机检：文件首行 schema: role/v1（期望逐字 "schema: role/v1"） | ✅ | `"schema: role/v1"` |
| 10 | 机检：文件含 max_concurrent_sessions: 1（期望含 "max_concurrent_sessions: 1"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 首席开发<br>group: coding<br>summary : ''<br>artifact_type: code<br>side_effect: write<br>skills: [code-change, test-run]<br>max_concurrent_sessions: 1<br>` |
| 11 | 机检：counts.project === 1（期望 1） | ✅ | `1` |
| 12 | 机检：counts.total === 17（期望 17） | ✅ | `17` |
| 13 | 机检：lead-dev 的 source === project（期望 "project"） | ✅ | `"project"` |

**⑤ 判定**：通过

---

#### AC-02 从零创建缺必填参数是用法错误

- 判定：**通过**（核对 10/10 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-02`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）；三条命令都不带 --from] "(fixture) 全新项目根（无 .orch）；三条命令都不带 --from"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role create lead-dev] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-02 | exit=2 | 90ms
[orch role create lead-dev --group coding] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --group coding   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-02 | exit=2 | 94ms
[orch role create lead-dev --name 首席开发 --group coding --artifact-type code] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-02 | exit=2 | 86ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-02.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根（以下三条命令都不带 `--from`；带 `--from` 时这四个参数可省略，见 AC-04、BR-38）
When 依次执行 `orch role create lead-dev`、`orch role create lead-dev --group coding`、`orch role create lead-dev --name 首席开发 --group coding --artifact-type code`
Then 三次都打印用法块并追加一行原因（分别是 `（role create 需要 --name）`、`（role create 需要 --name）`、`（role create 需要 --side-effect）`），退出码都是 2，且都没有建文件
机检：三次退出码 2；`test -e "$ROOT/.orch"` 为假
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-02.usage-1.txt` | 1766 B |
| `docs/iterations/iteration-6/evidence/AC-02.usage-2.txt` | 1766 B |
| `docs/iterations/iteration-6/evidence/AC-02.usage-3.txt` | 1773 B |
| `docs/iterations/iteration-6/evidence/AC-02.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-02.meta.json` | 876 B |
| `docs/iterations/iteration-6/evidence/AC-02.output.json` | 9266 B |
| `docs/iterations/iteration-6/evidence/AC-02.status.txt` | 6359 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 第 1 次退出码 2（期望 2） | ✅ | `2` |
| 2 | Then 第 2 次退出码 2（期望 2） | ✅ | `2` |
| 3 | Then 第 3 次退出码 2（期望 2） | ✅ | `2` |
| 4 | Then 第 1 次输出 = 用法块 25 行 + 原因行（共 26 行）（期望 26） | ✅ | `26` |
| 5 | Then 第 2 次输出 = 用法块 25 行 + 原因行（共 26 行）（期望 26） | ✅ | `26` |
| 6 | Then 第 3 次输出 = 用法块 25 行 + 原因行（共 26 行）（期望 26） | ✅ | `26` |
| 7 | Then 第 1 次原因行（期望逐字 "  （role create 需要 --name）"） | ✅ | `"  （role create 需要 --name）"` |
| 8 | Then 第 2 次原因行（期望逐字 "  （role create 需要 --name）"） | ✅ | `"  （role create 需要 --name）"` |
| 9 | Then 第 3 次原因行（期望逐字 "  （role create 需要 --side-effect）"） | ✅ | `"  （role create 需要 --side-effect）"` |
| 10 | 机检：test -e "$ROOT/.orch" 为假（没建文件） | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-02\.orch` |

**⑤ 判定**：通过

---

#### AC-03 目标已存在时拒绝，`--force` 才覆盖

- 判定：**通过**（核对 13/13 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-03`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[（Given）orch role create lead-dev --name 首席开发 …（同 AC-01）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-03 | exit=0 | 97ms
[夹具：预置 .orch/roles/lead-dev.yaml（AC-01 同款命令）] "(fixture) 预置 .orch/roles/lead-dev.yaml（AC-01 同款命令）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-03 | exit=1 | 95ms
[orch role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write --force] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write --force   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-03 | exit=0 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-03.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given `.orch/roles/lead-dev.yaml` 已存在（由 AC-01 的同一条命令建出），内容为 `summary` 为空
When 我先执行 `orch role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write`，再执行同一条命令加 `--force`
Then 第一次输出 `已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）`、退出码 1，文件内容不变；第二次成功、退出码 0，契约行的名字变成 `另一个名字`
机检：第一次后 `grep -c '另一个名字' "$ROOT/.orch/roles/lead-dev.yaml"` 为 0；第二次后为 1
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-03.deny.txt` | 81 B |
| `docs/iterations/iteration-6/evidence/AC-03.force.txt` | 151 B |
| `docs/iterations/iteration-6/evidence/AC-03.lead-dev.yaml.txt` | 156 B |
| `docs/iterations/iteration-6/evidence/AC-03.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-03.meta.json` | 881 B |
| `docs/iterations/iteration-6/evidence/AC-03.output.json` | 5705 B |
| `docs/iterations/iteration-6/evidence/AC-03.status.txt` | 1788 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：预置 lead-dev.yaml 成功（期望 0） | ✅ | `0` |
| 2 | Given：文件内容为 summary 为空（summary : ''）（期望含 "summary : ''"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 首席开发<br>group: coding<br>summary : ''<br>artifact_type: code<br>side_effect: write<br>skills: [code-change, test-run]<br>max_concurrent_sessions: 1<br>` |
| 3 | Then 第一次退出码 1（期望 1） | ✅ | `1` |
| 4 | Then 第一次输出恰好一行（期望 1） | ✅ | `1` |
| 5 | Then 第一次输出逐字（期望逐字 "已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）"） | ✅ | `"已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）"` |
| 6 | 机检：第一次后文件 sha256 不变（期望 "966936a972232c8df8a601300bdf49c67adc34ee12b02e67a2a21d624dd27443"） | ✅ | `"966936a972232c8df8a601300bdf49c67adc34ee12b02e67a2a21d624dd27443"` |
| 7 | 机检：第一次后 grep -c 另一个名字 = 0（期望 0） | ✅ | `0` |
| 8 | Then 第二次退出码 0（期望 0） | ✅ | `0` |
| 9 | Then 第二次输出恰好三行（期望 3） | ✅ | `3` |
| 10 | Then 第二次第 1 行逐字（期望逐字 "已创建项目角色：.orch/roles/lead-dev.yaml"） | ✅ | `"已创建项目角色：.orch/roles/lead-dev.yaml"` |
| 11 | Then 第二次契约行的名字变成 另一个名字（期望匹配 /^- lead-dev 另一个名字 · /） | ✅ | `- lead-dev 另一个名字 · 编码工程 · code · write · 技能 0 · 并发 1` |
| 12 | Then 第二次第 3 行校验通过（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 13 | 机检：第二次后 grep -c 另一个名字 = 1（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-04 从内置派生：继承、覆盖与「派生自」

- 判定：**通过**（核对 22/22 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-04`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role create lead-dev --from developer --skills test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --from developer --skills test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-04 | exit=0 | 106ms
[orch role show lead-dev] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show lead-dev   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-04 | exit=0 | 95ms
[orch role show lead-dev --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show lead-dev --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-04 | exit=0 | 89ms
[orch role list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-04 | exit=0 | 97ms
[node --test test/wp11/cli-role.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test --test-concurrency=4 test/wp11/cli-role.test.js   | cwd=d:\WWW\Maestro | exit=0 | 314ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-04.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch role create lead-dev --from developer --skills test-run`（不写 `--name`，也不写 `--group` / `--artifact-type` / `--side-effect`），再执行 `orch role show lead-dev`
Then 命令成功、退出码 0（不会因为缺四个必填项退 2）；文件里写下 `derived_from: developer`；中文名默认是 `开发（派生）`；技能是 `test-run`（覆盖），工具是 `read, write, edit, bash`、可唤醒是 `tester`、并发上限是 1、产物类型是 `code`、分组是 `编码工程`（全部继承）；`role show` 在来源行之后多一行 `派生自：developer`，其余行与内置 `developer` 的版式一致
机检：`orch role show lead-dev --format json` 的 `role` 对象仍是 10 个键（派生信息不进 JSON）；文本输出第 7 行等于 `  派生自：developer`；`test/wp11/cli-role.test.js` 全绿（内置角色的 6 行基线不变）
机操：`orch role list --format json` 中 `lead-dev.maxConcurrentSessions === 1`、`lead-dev.artifactType === 'code'`、`lead-dev.skills` 等于 `['test-run']`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-04.create.txt` | 154 B |
| `docs/iterations/iteration-6/evidence/AC-04.lead-dev.yaml.txt` | 293 B |
| `docs/iterations/iteration-6/evidence/AC-04.show.txt` | 295 B |
| `docs/iterations/iteration-6/evidence/AC-04.show-payload.json` | 369 B |
| `docs/iterations/iteration-6/evidence/AC-04.list-payload.json` | 6529 B |
| `docs/iterations/iteration-6/evidence/AC-04.wp11-test.txt` | 99 B |
| `docs/iterations/iteration-6/evidence/AC-04.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-04.meta.json` | 976 B |
| `docs/iterations/iteration-6/evidence/AC-04.output.json` | 23623 B |
| `docs/iterations/iteration-6/evidence/AC-04.status.txt` | 14502 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（缺四个必填不退 2）（期望 0） | ✅ | `0` |
| 2 | Then 输出恰好三行（期望 3） | ✅ | `3` |
| 3 | Then 第 1 行逐字（期望逐字 "已创建项目角色：.orch/roles/lead-dev.yaml"） | ✅ | `"已创建项目角色：.orch/roles/lead-dev.yaml"` |
| 4 | Then 契约行（中文名默认 开发（派生））（期望逐字 "- lead-dev 开发（派生） · 编码工程 · code · write · 技能 1 · 并发 1"） | ✅ | `"- lead-dev 开发（派生） · 编码工程 · code · write · 技能 1 · 并发 1"` |
| 5 | Then 第 3 行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 6 | 机检：文件含 derived_from: developer（期望含 "derived_from: developer"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 7 | 机检：文件含 skills: [test-run]（继承/覆盖）（期望含 "skills: [test-run]"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 8 | 机检：文件含 tools: [read, write, edit, bash]（继承/覆盖）（期望含 "tools: [read, write, edit, bash]"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 9 | 机检：文件含 wake_allow: [tester]（继承/覆盖）（期望含 "wake_allow: [tester]"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 10 | 机检：文件含 artifact_type: code（继承/覆盖）（期望含 "artifact_type: code"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 11 | 机检：文件含 group: coding（继承/覆盖）（期望含 "group: coding"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 12 | 机检：文件含 max_concurrent_sessions: 1（继承/覆盖）（期望含 "max_concurrent_sessions: 1"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 13 | Then role show 退出码 0（期望 0） | ✅ | `0` |
| 14 | Then role show 来源行（期望逐字 "  来源：项目 .orch/roles/lead-dev.yaml"） | ✅ | `"  来源：项目 .orch/roles/lead-dev.yaml"` |
| 15 | Then role show 第 7 行 = 派生自：developer（期望逐字 "  派生自：developer"） | ✅ | `"  派生自：developer"` |
| 16 | 机检：role 对象仍是 10 个键（期望 10） | ✅ | `10` |
| 17 | 机检：role 对象不含派生信息键（期望 0） | ✅ | `0` |
| 18 | 机操：maxConcurrentSessions === 1（期望 1） | ✅ | `1` |
| 19 | 机操：artifactType === code（期望 "code"） | ✅ | `"code"` |
| 20 | 机操：skills === [test-run]（期望 ["test-run"]） | ✅ | `["test-run"]` |
| 21 | 机检：test/wp11/cli-role.test.js 全绿（# fail 0）（期望匹配 /# fail 0\b/） | ✅ | `# tests 30<br># suites 0<br># pass 30<br># fail 0<br># cancelled 0<br># skipped 0<br># todo 0<br># duration_ms 242.8707` |
| 22 | 机检：wp11 有通过用例（# pass N>0）（期望匹配 /# pass [1-9]\d*/） | ✅ | `# tests 30<br># suites 0<br># pass 30<br># fail 0<br># cancelled 0<br># skipped 0<br># todo 0<br># duration_ms 242.8707` |

**⑤ 判定**：通过

---

#### AC-05 派生角色改技能引用后，三处行为同时变化

- 判定：**通过**（核对 11/11 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[（Given）orch role create lead-dev --from developer --skills test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --from developer --skills test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 105ms
[夹具：预置 lead-dev（--from developer --skills test-run，同 AC-04）] "(fixture) 预置 lead-dev（--from developer --skills test-run，同 AC-04）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role show lead-dev --format json（改前）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show lead-dev --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 97ms
[orch role edit lead-dev --set skills=test-run,code-review] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit lead-dev --set skills=test-run,code-review   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 104ms
[orch role show lead-dev] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show lead-dev   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 93ms
[orch role list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 94ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 103ms
[orch role show lead-dev --format json（改后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show lead-dev --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 106ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-05 | exit=0 | 108ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-05.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given AC-04 建出的 `lead-dev`（技能 `['test-run']`）
When 我执行 `orch role edit lead-dev --set skills=test-run,code-review`，然后分别执行 `orch role show lead-dev`、`orch role list`、`orch role validate`
Then ① `role show` 的技能行从 `  技能：test-run` 变成 `  技能：test-run, code-review`；② `role list` 中 `lead-dev` 那一行的技能数从 `技能 1` 变成 `技能 2`；③ `role validate` 仍然全部通过、退出码 0
机检：改前改后 `role show --format json` 的 `role.skills` 分别为 `['test-run']` 与 `['test-run','code-review']`；`role list` 文本行改后以 `· 技能 2 · 并发 1` 结尾；`role validate` 的 `counts.invalid === 0`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-05.skills-before.json` | 369 B |
| `docs/iterations/iteration-6/evidence/AC-05.edit.txt` | 203 B |
| `docs/iterations/iteration-6/evidence/AC-05.show-after.txt` | 308 B |
| `docs/iterations/iteration-6/evidence/AC-05.list-after.txt` | 1458 B |
| `docs/iterations/iteration-6/evidence/AC-05.validate-after.txt` | 64 B |
| `docs/iterations/iteration-6/evidence/AC-05.skills-after.json` | 390 B |
| `docs/iterations/iteration-6/evidence/AC-05.validate-payload.json` | 145 B |
| `docs/iterations/iteration-6/evidence/AC-05.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-05.meta.json` | 1024 B |
| `docs/iterations/iteration-6/evidence/AC-05.output.json` | 9593 B |
| `docs/iterations/iteration-6/evidence/AC-05.status.txt` | 5279 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：派生 lead-dev 建出（期望 0） | ✅ | `0` |
| 2 | 机检：改前 role.skills = [test-run]（期望 ["test-run"]） | ✅ | `["test-run"]` |
| 3 | When：role edit 退出码 0（期望 0） | ✅ | `0` |
| 4 | Then ① role show 退出码 0（期望 0） | ✅ | `0` |
| 5 | Then ① 技能行变成 `  技能：test-run, code-review`（期望逐字 "  技能：test-run, code-review"） | ✅ | `"  技能：test-run, code-review"` |
| 6 | Then ② role list 退出码 0（期望 0） | ✅ | `0` |
| 7 | Then ② lead-dev 行以 · 技能 2 · 并发 1 结尾 | ✅ | `- lead-dev 开发（派生） · 编码工程 · code · write · 技能 2 · 并发 1` |
| 8 | Then ③ role validate 退出码 0（期望 0） | ✅ | `0` |
| 9 | Then ③ 校验行 = 全部通过（期望匹配 /全部通过/） | ✅ | `校验资产 27 个：全部通过（角色 17 · 技能 10）` |
| 10 | 机检：改后 role.skills = [test-run, code-review]（期望 ["test-run","code-review"]） | ✅ | `["test-run","code-review"]` |
| 11 | 机检：role validate 的 counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-06 派生链缺失与成环被拒

- 判定：**通过**（核对 11/11 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-06`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 .orch/roles/a1.yaml（derived_from: b1）与 b1.yaml（derived_from: a），其余字段合法] "(fixture) 预置 .orch/roles/a1.yaml（derived_from: b1）与 b1.yaml（derived_from: a），其余字段合法"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate --format json（第一次：环）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-06 | exit=1 | 111ms
[orch role validate（文本，第一次）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-06 | exit=1 | 103ms
[夹具：把 b1.yaml 的 derived_from 改成 ghost] "(fixture) 把 b1.yaml 的 derived_from 改成 ghost"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate --format json（第二次：ghost）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-06 | exit=1 | 110ms
[orch role validate（文本，第二次）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-06 | exit=1 | 98ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-06.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置两份项目角色：`.orch/roles/a.yaml`（`derived_from: b`）与 `.orch/roles/b.yaml`（`derived_from: a`），其余字段合法
When 我执行 `orch role validate`；随后把 `b.yaml` 的 `derived_from` 改成 `ghost` 再执行一次
Then 第一次报两条 `ROLE_DERIVE_CYCLE`（环上每个文件各一条，明细给出环上的角色名），退出 1；第二次只报一条 `ROLE_DERIVE_MISSING`，明细给出 `ghost`，退出 1
机检：第一次 `errors.map(e => e.code)` 全为 `ROLE_DERIVE_CYCLE`、长度 2、`errors[0].file === 'roles/a.yaml'`（按文件名字典序）；第二次 `errors.length === 1`、`errors[0].code === 'ROLE_DERIVE_MISSING'`、`errors[0].file === 'roles/b.yaml'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-06.cycle-payload.json` | 545 B |
| `docs/iterations/iteration-6/evidence/AC-06.cycle-text.txt` | 176 B |
| `docs/iterations/iteration-6/evidence/AC-06.missing-payload.json` | 350 B |
| `docs/iterations/iteration-6/evidence/AC-06.missing-text.txt` | 111 B |
| `docs/iterations/iteration-6/evidence/AC-06.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-06.meta.json` | 907 B |
| `docs/iterations/iteration-6/evidence/AC-06.output.json` | 6050 B |
| `docs/iterations/iteration-6/evidence/AC-06.status.txt` | 2586 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 第一次退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 第一次 errors 长度 2（期望 2） | ✅ | `2` |
| 3 | 机检：codes 全为 ROLE_DERIVE_CYCLE（期望 ["ROLE_DERIVE_CYCLE"]） | ✅ | `["ROLE_DERIVE_CYCLE"]` |
| 4 | 机检：errors[0].file === roles/a1.yaml（按文件名字典序）（期望 "roles/a1.yaml"） | ✅ | `"roles/a1.yaml"` |
| 5 | Then 明细给出环上的角色名（期望含 "a"） | ✅ | `派生链成环：a1 → b1` |
| 6 | Then 文本含两条 ROLE_DERIVE_CYCLE（期望匹配 /ROLE_DERIVE_CYCLE/g） | ✅ | `校验资产 28 个：2 个不合法<br>- roles/a1.yaml：派生链成环：a1 → b1（ROLE_DERIVE_CYCLE）<br>- roles/b1.yaml：派生链成环：b1 → a1（ROLE_DERIVE_CYCLE）<br>` |
| 7 | Then 第二次退出码 1（期望 1） | ✅ | `1` |
| 8 | Then 第二次 errors 长度 1（期望 1） | ✅ | `1` |
| 9 | 机检：errors[0].code === ROLE_DERIVE_MISSING（期望 "ROLE_DERIVE_MISSING"） | ✅ | `"ROLE_DERIVE_MISSING"` |
| 10 | 机检：errors[0].file === roles/b1.yaml（期望 "roles/b1.yaml"） | ✅ | `"roles/b1.yaml"` |
| 11 | Then 明细给出 ghost（期望含 "ghost"） | ✅ | `派生来源不存在：ghost` |

**⑤ 判定**：通过

---

#### AC-07 导出再导入，角色在另一个项目里可用

- 判定：**通过**（核对 13/13 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-A`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-B`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[（Given）[A] orch role create lead-dev --from developer --skills test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --from developer --skills test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-A | exit=0 | 121ms
[夹具：项目根 A 预置 lead-dev（--from developer --skills test-run）；项目根 B 为空] "(fixture) 项目根 A 预置 lead-dev（--from developer --skills test-run）；项目根 B 为空"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[[A] orch role export lead-dev --out exports/lead-dev.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role export lead-dev --out exports/lead-dev.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-A | exit=0 | 101ms
[夹具：把 exports/lead-dev.yaml 拷到 B 的根下（lead-dev.yaml）] "(fixture) 把 exports/lead-dev.yaml 拷到 B 的根下（lead-dev.yaml）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[[B] orch role import lead-dev.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import lead-dev.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-B | exit=0 | 108ms
[[B] orch role list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-B | exit=0 | 89ms
[[B] orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-B | exit=0 | 113ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-07.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 项目根 A（含 AC-04 的 `lead-dev`）与项目根 B（空）
When 我在 A 里执行 `orch role export lead-dev --out exports/lead-dev.yaml`，把它拷到 B 的根下，在 B 里执行 `orch role import lead-dev.yaml`，再执行 `orch role list` 与 `orch role validate`
Then 导出回一行 `已导出角色 lead-dev 到 exports/lead-dev.yaml`、退出 0；B 里导入回 `已安装项目角色：.orch/roles/lead-dev.yaml` 与 `校验：通过`、退出 0；B 的 `role list` 首行 `角色 17 个（内置 16 · 项目 1）`
机检：A 导出的文件里含 `derived_from: developer`；B 的 `.orch/roles/lead-dev.yaml` 与 A 导出的文件逐字节相同；B 的 `role validate` `counts.invalid === 0`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-07.export.txt` | 52 B |
| `docs/iterations/iteration-6/evidence/AC-07.exported.yaml.txt` | 293 B |
| `docs/iterations/iteration-6/evidence/AC-07.import.txt` | 67 B |
| `docs/iterations/iteration-6/evidence/AC-07.list-B.txt` | 1458 B |
| `docs/iterations/iteration-6/evidence/AC-07.validate-B.json` | 145 B |
| `docs/iterations/iteration-6/evidence/AC-07.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-07.meta.json` | 1064 B |
| `docs/iterations/iteration-6/evidence/AC-07.output.json` | 8119 B |
| `docs/iterations/iteration-6/evidence/AC-07.status.txt` | 3671 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：A 里建出 lead-dev（期望 0） | ✅ | `0` |
| 2 | Then 导出回一行、退出 0（期望 0） | ✅ | `0` |
| 3 | Then 导出输出恰好一行（期望 1） | ✅ | `1` |
| 4 | Then 导出行逐字（期望逐字 "已导出角色 lead-dev 到 exports/lead-dev.yaml"） | ✅ | `"已导出角色 lead-dev 到 exports/lead-dev.yaml"` |
| 5 | 机检：A 导出的文件存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-07-A\exports\lead-dev.yaml` |
| 6 | 机检：A 导出的文件里含 derived_from: developer（期望含 "derived_from: developer"） | ✅ | `schema: role/v1<br>id: lead-dev<br>name: 开发（派生）<br>group: coding<br>summary: 按任务修改代码，交出声明的产物文件<br>artifact_type: code<br>side_effect: write<br>derived_from: developer<br>skills: [test-run]<br>tools: [read, write, edit, bash]<br>wake_allow: [tester]<br>max_conc` |
| 7 | Then 导入退出 0（期望 0） | ✅ | `0` |
| 8 | Then 导入输出恰好两行（期望 2） | ✅ | `2` |
| 9 | Then 导入第 1 行逐字（期望逐字 "已安装项目角色：.orch/roles/lead-dev.yaml"） | ✅ | `"已安装项目角色：.orch/roles/lead-dev.yaml"` |
| 10 | Then 导入第 2 行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 11 | Then B 的 role list 首行 = 角色 17 个（内置 16 · 项目 1）（期望逐字 "角色 17 个（内置 16 · 项目 1）"） | ✅ | `"角色 17 个（内置 16 · 项目 1）"` |
| 12 | 机检：B 的 lead-dev.yaml 与 A 导出文件 sha256 相同（逐字节）（期望 "b7ef68f678392b3afeaadf19dd19ed98908952024ba44f218b1a6ecbf3b6e8f7"） | ✅ | `"b7ef68f678392b3afeaadf19dd19ed98908952024ba44f218b1a6ecbf3b6e8f7"` |
| 13 | 机检：B 的 role validate counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-08 导入被拒的两种情形都不落盘

- 判定：**通过**（核对 9/9 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-08`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置根下 ghost.yaml（技能 no-such）与 lead-dev.yaml（合法）；.orch/roles/lead-dev.yaml 已存在] "(fixture) 预置根下 ghost.yaml（技能 no-such）与 lead-dev.yaml（合法）；.orch/roles/lead-dev.yaml 已存在"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role import ghost.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import ghost.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-08 | exit=1 | 97ms
[orch role import lead-dev.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import lead-dev.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-08 | exit=1 | 112ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-08.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置两份文件：`ghost.yaml`（技能为 `no-such`）、`lead-dev.yaml`（合法，技能 `test-run`）；同时项目里已有 `.orch/roles/lead-dev.yaml`
When 我依次执行 `orch role import ghost.yaml`、`orch role import lead-dev.yaml`
Then 第一次输出 `导入被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）`、退出 1，`.orch/roles/` 下没有任何新文件；第二次输出 `已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）`、退出 1，文件内容不变
机检：两次退出码都是 1；`.orch/roles` 下文件清单在两次执行前后逐字相同；第一次执行后 `test -e "$ROOT/.orch/roles/ghost.yaml"` 为假
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-08.deny.txt` | 77 B |
| `docs/iterations/iteration-6/evidence/AC-08.dup.txt` | 81 B |
| `docs/iterations/iteration-6/evidence/AC-08.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-08.meta.json` | 834 B |
| `docs/iterations/iteration-6/evidence/AC-08.output.json` | 4090 B |
| `docs/iterations/iteration-6/evidence/AC-08.status.txt` | 1050 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 第一次退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 第一次输出恰好一行（期望 1） | ✅ | `1` |
| 3 | Then 第一次输出逐字（期望逐字 "导入被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）"） | ✅ | `"导入被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）"` |
| 4 | 机检：.orch/roles 文件清单在第一次执行前后逐字相同（期望 {"lead-dev.yaml":{"sha256":"0d458f7ac2ca06155a1b8c007d178d0a89db018596832f211ee22dd104f29a6f","bytes":186,"mtimeIso":"2026-11-09T12:22:34.832Z"}}） | ✅ | `{"lead-dev.yaml":{"sha256":"0d458f7ac2ca06155a1b8c007d178d0a89db018596832f211ee22dd104f29a6f","bytes":186,"mtimeIso":"2026-11-09T12:22:34.832Z"}}` |
| 5 | 机检：第一次执行后 test -e "$ROOT/.orch/roles/ghost.yaml" 为假 | ✅ | `ghost.yaml 不存在` |
| 6 | Then 第二次退出码 1（期望 1） | ✅ | `1` |
| 7 | Then 第二次输出恰好一行（期望 1） | ✅ | `1` |
| 8 | Then 第二次输出逐字（期望逐字 "已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）"） | ✅ | `"已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）"` |
| 9 | 机检：.orch/roles 文件清单在两次执行前后逐字相同（期望 {"lead-dev.yaml":{"sha256":"0d458f7ac2ca06155a1b8c007d178d0a89db018596832f211ee22dd104f29a6f","bytes":186,"mtimeIso":"2026-11-09T12:22:34.832Z"}}） | ✅ | `{"lead-dev.yaml":{"sha256":"0d458f7ac2ca06155a1b8c007d178d0a89db018596832f211ee22dd104f29a6f","bytes":186,"mtimeIso":"2026-11-09T12:22:34.832Z"}}` |

**⑤ 判定**：通过

---

#### AC-09 就地编辑与内置角色只读

- 判定：**通过**（核对 13/13 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-09`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[（Given）orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-09 | exit=0 | 102ms
[夹具：预置 lead-dev（同 AC-01 命令，artifact_type: code）] "(fixture) 预置 lead-dev（同 AC-01 命令，artifact_type: code）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role edit lead-dev --set artifact_type=document] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit lead-dev --set artifact_type=document   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-09 | exit=0 | 100ms
[orch role edit developer --set artifact_type=document] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit developer --set artifact_type=document   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-09 | exit=1 | 112ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-09.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given AC-01 建出的 `lead-dev`（`artifact_type: code`）
When 我执行 `orch role edit lead-dev --set artifact_type=document`，再执行 `orch role edit developer --set artifact_type=document`
Then 第一次回四行（`已更新项目角色：…`、契约行中产物类型变 `document`、`校验：通过`、`（已按规范格式重写，注释不保留）`）、退出 0；第二次回 `内置角色不可编辑：先 orch role create <新角色> --from developer`、退出 1
机检：第一次后 `grep -c 'artifact_type: document' "$ROOT/.orch/roles/lead-dev.yaml"` 为 1，且 `assets/roles/developer.yaml` 的 `sha256` 前后相同；第二次退出码 1
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-09.edit.txt` | 201 B |
| `docs/iterations/iteration-6/evidence/AC-09.deny.txt` | 78 B |
| `docs/iterations/iteration-6/evidence/AC-09.lead-dev.yaml.txt` | 178 B |
| `docs/iterations/iteration-6/evidence/AC-09.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-09.meta.json` | 867 B |
| `docs/iterations/iteration-6/evidence/AC-09.output.json` | 5355 B |
| `docs/iterations/iteration-6/evidence/AC-09.status.txt` | 1616 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：lead-dev 建出（期望 0） | ✅ | `0` |
| 2 | Then 第一次退出码 0（期望 0） | ✅ | `0` |
| 3 | Then 第一次输出恰好四行（期望 4） | ✅ | `4` |
| 4 | Then 第 1 行 = 已更新项目角色：…（期望匹配 /^已更新项目角色：\.orch\/roles\/lead-dev\.yaml$/） | ✅ | `已更新项目角色：.orch/roles/lead-dev.yaml` |
| 5 | Then 第 2 行契约行（产物类型变 document）（期望逐字 "- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1"） | ✅ | `"- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1"` |
| 6 | Then 第 3 行校验通过（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 7 | Then 第 4 行（已按规范格式重写，注释不保留）（期望逐字 "（已按规范格式重写，注释不保留）"） | ✅ | `"（已按规范格式重写，注释不保留）"` |
| 8 | Then 第二次退出码 1（期望 1） | ✅ | `1` |
| 9 | Then 第二次输出恰好一行（期望 1） | ✅ | `1` |
| 10 | Then 第二次输出逐字（期望逐字 "内置角色不可编辑：先 orch role create <新角色> --from developer"） | ✅ | `"内置角色不可编辑：先 orch role create <新角色> --from developer"` |
| 11 | 机检：grep -c "artifact_type: document" = 1（期望 1） | ✅ | `1` |
| 12 | 机检：assets/roles/developer.yaml 的 sha256 前后相同（期望 "4925b351c1040765f354cf6e6ba5ed1098a6a7eba256c8070baaeb6bc50fe905"） | ✅ | `"4925b351c1040765f354cf6e6ba5ed1098a6a7eba256c8070baaeb6bc50fe905"` |
| 13 | 机检：第二次退出码 1（复核）（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-10 差异清单与「无差异」

- 判定：**通过**（核对 14/14 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-10`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[（Given）orch role create lead-dev --from developer --skills test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --from developer --skills test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-10 | exit=0 | 99ms
[夹具：预置 .orch/roles/developer.yaml = assets/roles/developer.yaml 逐字节拷贝（逐字段相同的项目覆盖文件）] "(fixture) 预置 .orch/roles/developer.yaml = assets/roles/developer.yaml 逐字节拷贝（逐字段相同的项目覆盖文件）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role diff lead-dev] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role diff lead-dev   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-10 | exit=0 | 100ms
[orch role diff developer（逐字段相同的项目覆盖）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role diff developer   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-10 | exit=0 | 102ms
[orch role diff lead-dev --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role diff lead-dev --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-10 | exit=0 | 92ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-10.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given AC-04 的 `lead-dev`（与 `developer` 相比：名字、技能、派生来源三处不同），以及一份与内置 `developer` 逐字段相同的项目覆盖文件
When 我执行 `orch role diff lead-dev`，再对那份逐字段相同的角色执行 `orch role diff`
Then 第一次打印 `对比角色 lead-dev（项目）与基线 developer（内置）` + 三行差异（`+ derived_from：developer`、`~ name：开发 → 开发（派生）`、`~ skills：code-change, test-run → test-run`）+ `差异 3 项`，退出 0；第二次末行是 `无差异`
机检：第一次输出行数 5、末行逐字匹配 `差异 3 项`；`--format json` 的顶层键恰为 `base`/`target`/`changes`，`changes` 长度 3 且 `kind` 集合为 `{added, changed}`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-10.diff-lead-dev.txt` | 191 B |
| `docs/iterations/iteration-6/evidence/AC-10.diff-developer.txt` | 77 B |
| `docs/iterations/iteration-6/evidence/AC-10.diff-payload.json` | 481 B |
| `docs/iterations/iteration-6/evidence/AC-10.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-10.meta.json` | 883 B |
| `docs/iterations/iteration-6/evidence/AC-10.output.json` | 6045 B |
| `docs/iterations/iteration-6/evidence/AC-10.status.txt` | 2258 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：lead-dev 建出（期望 0） | ✅ | `0` |
| 2 | Then 第一次退出码 0（期望 0） | ✅ | `0` |
| 3 | 机检：第一次输出行数 5（期望 5） | ✅ | `5` |
| 4 | Then 第 1 行逐字（期望逐字 "对比角色 lead-dev（项目）与基线 developer（内置）"） | ✅ | `"对比角色 lead-dev（项目）与基线 developer（内置）"` |
| 5 | Then 差异行 1（期望逐字 "+ derived_from：developer"） | ✅ | `"+ derived_from：developer"` |
| 6 | Then 差异行 2（期望逐字 "~ name：开发 → 开发（派生）"） | ✅ | `"~ name：开发 → 开发（派生）"` |
| 7 | Then 差异行 3（期望逐字 "~ skills：code-change, test-run → test-run"） | ✅ | `"~ skills：code-change, test-run → test-run"` |
| 8 | Then 末行逐字 = 差异 3 项（期望逐字 "差异 3 项"） | ✅ | `"差异 3 项"` |
| 9 | Then 第二次退出码 0（期望 0） | ✅ | `0` |
| 10 | Then 第二次输出恰好 2 行（期望 2） | ✅ | `2` |
| 11 | Then 第二次末行 = 无差异（期望逐字 "无差异"） | ✅ | `"无差异"` |
| 12 | 机检：顶层键恰为 base/target/changes（期望 ["base","changes","target"]） | ✅ | `["base","changes","target"]` |
| 13 | 机检：changes 长度 3（期望 3） | ✅ | `3` |
| 14 | 机检：changes 的 kind 集合 = {added, changed}（期望 ["added","changed"]） | ✅ | `["added","changed"]` |

**⑤ 判定**：通过

---

#### AC-11 角色校验器的五项各有专属原因码

- 判定：**通过**（核对 8/8 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-11`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置五份坏角色 m1/s1/c1/p1/d1 + 工作流 use-c1.yaml（c1 只作入口，没有任何边给它 brief）] "(fixture) 预置五份坏角色 m1/s1/c1/p1/d1 + 工作流 use-c1.yaml（c1 只作入口，没有任何边给它 brief）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-11 | exit=1 | 101ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-11 | exit=1 | 97ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-11.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置五份坏角色与一条引用它们的工作流：`m.yaml`（缺 `max_concurrent_sessions`）、`s.yaml`（技能 `no-such`）、`c.yaml`（声明 `inputs: [brief]`）、`p.yaml`（`side_effect: read` + `tools: [write]`）、`d.yaml`（`derived_from: d`）；工作流 `.orch/workflows/use-c.yaml`：`T-001`（`c`，入口）→ `T-002`（`reviewer`），`terminal: T-002`（`c` 只作入口，没有任何边给它 `brief`）
When 我执行 `orch role validate --format json`
Then 五条错误，原因码恰好是 `ROLE_SCHEMA_MISSING`、`ROLE_SKILL_NOT_FOUND`、`ROLE_CONTRACT_UNBOUND`、`ROLE_PERMISSION_MISMATCH`、`ROLE_DERIVE_CYCLE`；退出码 1
机检：`counts.assets === 31`（16 角色 + 10 技能 + 5 个坏文件）、`counts.roles === 16`、`counts.skills === 10`、`counts.invalid === 5`；`errors.map(e => e.code)` 排序后与上面五个逐字相同；每条 `errors[]` 仍只有 6 个键
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-11.payload.json` | 1206 B |
| `docs/iterations/iteration-6/evidence/AC-11.validate-text.txt` | 455 B |
| `docs/iterations/iteration-6/evidence/AC-11.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-11.meta.json` | 989 B |
| `docs/iterations/iteration-6/evidence/AC-11.output.json` | 4805 B |
| `docs/iterations/iteration-6/evidence/AC-11.status.txt` | 2396 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 恰好五条错误（期望 5） | ✅ | `5` |
| 3 | 机检：errors.map(code) 排序后与五个专属码逐字相同（期望 ["ROLE_CONTRACT_UNBOUND","ROLE_DERIVE_CYCLE","ROLE_PERMISSION_MISMATCH","ROLE_SCHEMA_MISSING","ROLE_SKILL_NOT_FOUND"]） | ✅ | `["ROLE_CONTRACT_UNBOUND","ROLE_DERIVE_CYCLE","ROLE_PERMISSION_MISMATCH","ROLE_SCHEMA_MISSING","ROLE_SKILL_NOT_FOUND"]` |
| 4 | 机检：counts.assets === 31（16 角色 + 10 技能 + 5 个坏文件）（期望 31） | ✅ | `31` |
| 5 | 机检：counts.roles === 16（期望 16） | ✅ | `16` |
| 6 | 机检：counts.skills === 10（期望 10） | ✅ | `10` |
| 7 | 机检：counts.invalid === 5（期望 5） | ✅ | `5` |
| 8 | 机检：每条 errors[] 仍只有 6 个键（期望 "code,detail,field,file,line,scope"） | ✅ | `"code,detail,field,file,line,scope"` |

**⑤ 判定**：通过

**备注**

- 裁-16a/R-12：Given 单字符 id 与 C-01 互斥，本用例按 2 字符 id（m1/s1/c1/p1/d1）取证，Then 语义不变。

---

#### AC-12 契约连通：输入没人给、输出没人要

- 判定：**通过**（核对 15/15 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-12`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 scout/scribe 与工作流 solo（T-001→T-002 带 map T-001.notes → notes；T-001 声明 outputs/wake_allow、T-002 声明 inputs，见文件头说明）] "(fixture) 预置 scout/scribe 与工作流 solo（T-001→T-002 带 map T-001.notes → notes；T-001 声明 outputs/wake_allow、T-002 声明 inputs，见文件头说明）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[（自证）orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-12 | exit=0 | 104ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-12 | exit=1 | 117ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-12 | exit=1 | 97ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-12.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置两个角色与一条工作流：`scout`（`inputs: [brief]`、`outputs: [notes]`）、`scribe`（`inputs: [notes]`、`outputs: [digest]`）；工作流 `solo`：`T-001`（`scout`，入口）→ `T-002`（`scribe`，终点），这条边上带 `map: T-001.notes → notes`
When 我执行 `orch role validate`
Then 恰好两行：`- roles/scout.yaml：…（ROLE_CONTRACT_UNBOUND）`（明细含 `brief`，说的是「输入没来源」）与 `- roles/scribe.yaml：…（ROLE_CONTRACT_UNBOUND）`（明细含 `digest`，说的是「输出没去处」），退出 1；`notes` 两边都不报——`scout` 的 `notes` 被 `T-001 → T-002` 的 `map.from` 消费，`scribe` 的 `notes` 由同一映射提供（字段级口径，F-05）
机检：`--format json` 的 `errors.length === 2`、`errors.map(e => e.code)` 全为 `ROLE_CONTRACT_UNBOUND`、`errors[0].file === 'roles/scout.yaml'` 且 `errors[0].detail` 含 `brief`、`errors[1].file === 'roles/scribe.yaml'` 且 `errors[1].detail` 含 `digest`；两处 `detail` 都不含 `notes`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-12.workflow-validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-12.validate-text.txt` | 210 B |
| `docs/iterations/iteration-6/evidence/AC-12.payload.json` | 568 B |
| `docs/iterations/iteration-6/evidence/AC-12.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-12.meta.json` | 893 B |
| `docs/iterations/iteration-6/evidence/AC-12.output.json` | 5976 B |
| `docs/iterations/iteration-6/evidence/AC-12.status.txt` | 1886 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 自证：workflow solo 合法（校验工作流 4 个）（期望 0） | ✅ | `0` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 恰好两行错误（- 开头）（期望 2） | ✅ | `2` |
| 4 | Then 错误行 1 逐字（期望逐字 "- roles/scout.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）"） | ✅ | `"- roles/scout.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）"` |
| 5 | Then 错误行 2 逐字（期望逐字 "- roles/scribe.yaml：契约不连通：digest 没有去处（ROLE_CONTRACT_UNBOUND）"） | ✅ | `"- roles/scribe.yaml：契约不连通：digest 没有去处（ROLE_CONTRACT_UNBOUND）"` |
| 6 | Then notes 两边都不报（错误行 1）（期望不含 "notes"） | ✅ | `- roles/scout.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）` |
| 7 | Then notes 两边都不报（错误行 2）（期望不含 "notes"） | ✅ | `- roles/scribe.yaml：契约不连通：digest 没有去处（ROLE_CONTRACT_UNBOUND）` |
| 8 | 机检：errors.length === 2（期望 2） | ✅ | `2` |
| 9 | 机检：errors.map(code) 全为 ROLE_CONTRACT_UNBOUND（期望 ["ROLE_CONTRACT_UNBOUND"]） | ✅ | `["ROLE_CONTRACT_UNBOUND"]` |
| 10 | 机检：errors[0].file === roles/scout.yaml（期望 "roles/scout.yaml"） | ✅ | `"roles/scout.yaml"` |
| 11 | 机检：errors[0].detail 含 brief（期望含 "brief"） | ✅ | `契约不连通：brief 没有来源` |
| 12 | 机检：errors[1].file === roles/scribe.yaml（期望 "roles/scribe.yaml"） | ✅ | `"roles/scribe.yaml"` |
| 13 | 机检：errors[1].detail 含 digest（期望含 "digest"） | ✅ | `契约不连通：digest 没有去处` |
| 14 | 机检：errors[0].detail 不含 notes（期望不含 "notes"） | ✅ | `契约不连通：brief 没有来源` |
| 15 | 机检：errors[1].detail 不含 notes（期望不含 "notes"） | ✅ | `契约不连通：digest 没有去处` |

**⑤ 判定**：通过

---

#### AC-13 权限闭环：工具集与副作用等级对不上

- 判定：**通过**（核对 12/12 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-13`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 r1（read+write）/ r2（exec+read）/ r3（none+read），其余字段合法] "(fixture) 预置 r1（read+write）/ r2（exec+read）/ r3（none+read），其余字段合法"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-13 | exit=1 | 101ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-13 | exit=1 | 98ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-13.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置三份坏角色：`r1.yaml`（`side_effect: read` + `tools: [read, write]`）、`r2.yaml`（`side_effect: exec` + `tools: [read]`）、`r3.yaml`（`side_effect: none` + `tools: [read]`）
When 我执行 `orch role validate`
Then 三条错误，原因码都是 `ROLE_PERMISSION_MISMATCH`，明细分别是「副作用等级为 read 的角色不能带写工具 write」「副作用等级为 exec 的角色必须带能执行命令的工具 bash」「副作用等级为 none 的角色不能带任何工具」，退出 1
机检：`errors.map(e => e.code)` 全为 `ROLE_PERMISSION_MISMATCH`、长度 3、按文件名排序；`counts.invalid === 3`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-13.validate-text.txt` | 367 B |
| `docs/iterations/iteration-6/evidence/AC-13.payload.json` | 845 B |
| `docs/iterations/iteration-6/evidence/AC-13.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-13.meta.json` | 861 B |
| `docs/iterations/iteration-6/evidence/AC-13.output.json` | 5739 B |
| `docs/iterations/iteration-6/evidence/AC-13.status.txt` | 1893 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 恰好三条错误（- 开头）（期望 3） | ✅ | `3` |
| 3 | Then 第 1 条错误明细 = 固定句（副作用等级为 read …）（期望含 "副作用等级为 read 的角色不能带写工具 write"） | ✅ | `- roles/r1.yaml：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）` |
| 4 | Then 第 1 条错误带原因码 ROLE_PERMISSION_MISMATCH（期望含 "（ROLE_PERMISSION_MISMATCH）"） | ✅ | `- roles/r1.yaml：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）` |
| 5 | Then 第 2 条错误明细 = 固定句（副作用等级为 exec …）（期望含 "副作用等级为 exec 的角色必须带能执行命令的工具 bash"） | ✅ | `- roles/r2.yaml：副作用等级为 exec 的角色必须带能执行命令的工具 bash（ROLE_PERMISSION_MISMATCH）` |
| 6 | Then 第 2 条错误带原因码 ROLE_PERMISSION_MISMATCH（期望含 "（ROLE_PERMISSION_MISMATCH）"） | ✅ | `- roles/r2.yaml：副作用等级为 exec 的角色必须带能执行命令的工具 bash（ROLE_PERMISSION_MISMATCH）` |
| 7 | Then 第 3 条错误明细 = 固定句（副作用等级为 none …）（期望含 "副作用等级为 none 的角色不能带任何工具"） | ✅ | `- roles/r3.yaml：副作用等级为 none 的角色不能带任何工具（ROLE_PERMISSION_MISMATCH）` |
| 8 | Then 第 3 条错误带原因码 ROLE_PERMISSION_MISMATCH（期望含 "（ROLE_PERMISSION_MISMATCH）"） | ✅ | `- roles/r3.yaml：副作用等级为 none 的角色不能带任何工具（ROLE_PERMISSION_MISMATCH）` |
| 9 | 机检：errors 长度 3（期望 3） | ✅ | `3` |
| 10 | 机检：errors.map(code) 全为 ROLE_PERMISSION_MISMATCH（期望 ["ROLE_PERMISSION_MISMATCH"]） | ✅ | `["ROLE_PERMISSION_MISMATCH"]` |
| 11 | 机检：errors 按文件名排序（期望 ["roles/r1.yaml","roles/r2.yaml","roles/r3.yaml"]） | ✅ | `["roles/r1.yaml","roles/r2.yaml","roles/r3.yaml"]` |
| 12 | 机检：counts.invalid === 3（期望 3） | ✅ | `3` |

**⑤ 判定**：通过

---

#### AC-14 权限闭环：白名单悬空与自唤醒

- 判定：**通过**（核对 7/7 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-14`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 w1（wake_allow: [ghost]）与 w2（wake_allow: [w2]），其余字段合法] "(fixture) 预置 w1（wake_allow: [ghost]）与 w2（wake_allow: [w2]），其余字段合法"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-14 | exit=1 | 116ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-14 | exit=1 | 99ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-14.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置 `w1.yaml`（`wake_allow: [ghost]`）与 `w2.yaml`（id 为 `w2`，`wake_allow: [w2]`），其余字段合法
When 我执行 `orch role validate`
Then 两条错误：`ROLE_WAKE_UNKNOWN`（明细含 `ghost`）与 `ROLE_WAKE_SELF`（明细含 `w2`），退出 1
机检：`errors.map(e => e.code)` 排序后等于 `['ROLE_WAKE_SELF','ROLE_WAKE_UNKNOWN']`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-14.validate-text.txt` | 201 B |
| `docs/iterations/iteration-6/evidence/AC-14.payload.json` | 566 B |
| `docs/iterations/iteration-6/evidence/AC-14.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-14.meta.json` | 851 B |
| `docs/iterations/iteration-6/evidence/AC-14.output.json` | 3659 B |
| `docs/iterations/iteration-6/evidence/AC-14.status.txt` | 1446 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 恰好两条错误（- 开头）（期望 2） | ✅ | `2` |
| 3 | Then 有 ROLE_WAKE_UNKNOWN 一行 | ✅ | `- roles/w1.yaml：唤醒白名单里的角色不存在：ghost（ROLE_WAKE_UNKNOWN）` |
| 4 | Then 有 ROLE_WAKE_SELF 一行 | ✅ | `- roles/w2.yaml：唤醒白名单不能包含自己：w2（ROLE_WAKE_SELF）` |
| 5 | Then ROLE_WAKE_UNKNOWN 明细含 ghost（期望含 "ghost"） | ✅ | `- roles/w1.yaml：唤醒白名单里的角色不存在：ghost（ROLE_WAKE_UNKNOWN）` |
| 6 | Then ROLE_WAKE_SELF 明细含 w2（期望含 "w2"） | ✅ | `- roles/w2.yaml：唤醒白名单不能包含自己：w2（ROLE_WAKE_SELF）` |
| 7 | 机检：codes 排序后等于 [ROLE_WAKE_SELF, ROLE_WAKE_UNKNOWN]（期望 ["ROLE_WAKE_SELF","ROLE_WAKE_UNKNOWN"]） | ✅ | `["ROLE_WAKE_SELF","ROLE_WAKE_UNKNOWN"]` |

**⑤ 判定**：通过

---

#### AC-15 26 个内置资产仍然全通过（I1.5 基线不变）

- 判定：**通过**（核对 10/10 通过）
- 验证面：回归
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-15`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（没有任何项目资产、也没有工作流）] "(fixture) 全新项目根（没有任何项目资产、也没有工作流）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-15 | exit=0 | 101ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-15 | exit=0 | 105ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-15.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根（没有任何项目资产、也没有工作流）
When 我执行 `orch role validate` 与 `orch role validate --format json`
Then 文本输出恰好一行 `校验资产 26 个：全部通过（角色 16 · 技能 10）`、退出码 0；JSON 的 `counts` 仍是 6 键，`assets === 26`、`roles === 16`、`skills === 10`、`invalid === 0`、`errors` 为空
机检：与 I1.5 收口提交 `0cd113b` 的同一条命令输出逐字节 diff 为空（`git stash` 不参与；直接对比 `docs/iterations/iteration-5/evidence/` 中的基线文本）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-15.validate.txt` | 64 B |
| `docs/iterations/iteration-6/evidence/AC-15.payload.json` | 145 B |
| `docs/iterations/iteration-6/evidence/AC-15.baseline-diff.txt` | 22 B |
| `docs/iterations/iteration-6/evidence/AC-15.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-15.meta.json` | 892 B |
| `docs/iterations/iteration-6/evidence/AC-15.output.json` | 3199 B |
| `docs/iterations/iteration-6/evidence/AC-15.status.txt` | 910 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 文本输出恰好一行（期望 1） | ✅ | `1` |
| 3 | Then 该行逐字（期望逐字 "校验资产 26 个：全部通过（角色 16 · 技能 10）"） | ✅ | `"校验资产 26 个：全部通过（角色 16 · 技能 10）"` |
| 4 | Then JSON counts 仍是 6 键（期望 6） | ✅ | `6` |
| 5 | Then counts.assets === 26（期望 26） | ✅ | `26` |
| 6 | Then counts.roles === 16（期望 16） | ✅ | `16` |
| 7 | Then counts.skills === 10（期望 10） | ✅ | `10` |
| 8 | Then counts.invalid === 0（期望 0） | ✅ | `0` |
| 9 | Then errors 为空（期望 []） | ✅ | `[]` |
| 10 | 机检：与 0cd113b 基线（iteration-5 evidence/AC-12.validate.txt）逐字节 diff 为空 | ✅ | `diff 为空` |

**⑤ 判定**：通过

---

#### AC-16 技能清单可列且格式稳定

- 判定：**通过**（核对 8/8 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-16`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch skill list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-16 | exit=0 | 93ms
[orch skill list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-16 | exit=0 | 107ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-16.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch skill list`
Then 首行 `技能 10 个（内置 10 · 项目 0）`，随后 10 行，每行形如 `- code-change 代码修改 · 编码工程 · 命令 1`；按 id 字典序；退出码 0
机检：总行数 11；`--format json` 顶层键恰为 `counts`/`skills`，`counts` 4 键（`total`/`builtin`/`project`/`invalid`），`skills` 长度 10，每个技能对象恰 7 键（`id`/`name`/`appliesTo`/`appliesToLabels`/`commands`/`source`/`file`）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-16.list.txt` | 596 B |
| `docs/iterations/iteration-6/evidence/AC-16.payload.json` | 2991 B |
| `docs/iterations/iteration-6/evidence/AC-16.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-16.meta.json` | 839 B |
| `docs/iterations/iteration-6/evidence/AC-16.output.json` | 8057 B |
| `docs/iterations/iteration-6/evidence/AC-16.status.txt` | 4203 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 首行 = 技能 10 个（内置 10 · 项目 0）（期望逐字 "技能 10 个（内置 10 · 项目 0）"） | ✅ | `"技能 10 个（内置 10 · 项目 0）"` |
| 3 | Then 随后 10 行逐字（A-6，id 字典序）（期望 ["- code-change 代码修改 · 编码工程 · 命令 1","- code-review 代码审查 · 编码工程 · 命令 0","- compliance-check 合规审查 · 业务运营 · 命令 0","- coordination 编排协调 · 通用协调 · 命令 0","- data-analysis 数据分析 · | ✅ | `["- code-change 代码修改 · 编码工程 · 命令 1","- code-review 代码审查 · 编码工程 · 命令 0","- compliance-check 合规审查 · 业务运营 · 命令 0","- coordination 编排协调 · 通用协调 · 命令 0","- data-analysis 数据分析 · 研究分析 · 命令 1","- doc-draft 文档撰写 · 内容创作 · 命令 0","- doc-review 文档审核 · 内容创作 · 命令 0","- fact-c` |
| 4 | 机检：总行数 11（期望 11） | ✅ | `11` |
| 5 | 机检：顶层键恰为 counts/skills（期望 ["counts","skills"]） | ✅ | `["counts","skills"]` |
| 6 | 机检：counts 恰 4 键（total/builtin/project/invalid）（期望 ["builtin","invalid","project","total"]） | ✅ | `["builtin","invalid","project","total"]` |
| 7 | 机检：skills 长度 10（期望 10） | ✅ | `10` |
| 8 | 机检：每个技能对象恰 7 键（期望 "appliesTo,appliesToLabels,commands,file,id,name,source"） | ✅ | `"appliesTo,appliesToLabels,commands,file,id,name,source"` |

**⑤ 判定**：通过

---

#### AC-17 技能详情含正文

- 判定：**通过**（核对 14/14 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-17`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch skill show code-change] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill show code-change   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-17 | exit=0 | 102ms
[orch skill show code-change --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill show code-change --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-17 | exit=0 | 102ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-17.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch skill show code-change`
Then 前 6 行是契约行、`  摘要：…`、`  命令：node --test`、`  适用：编码工程`、`  来源：内置 assets/skills/code-change/SKILL.md`、`  正文：`；第 7 行是 `  ### 工作方法`；退出码 0
机检：`lines.length > 7`；`lines[5] === '  正文：'`、`lines[6] === '  ### 工作方法'`；`--format json` 顶层键恰为 `skill`/`body`，`body` 含 `### 工作方法`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-17.show.txt` | 454 B |
| `docs/iterations/iteration-6/evidence/AC-17.payload.json` | 503 B |
| `docs/iterations/iteration-6/evidence/AC-17.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-17.meta.json` | 828 B |
| `docs/iterations/iteration-6/evidence/AC-17.output.json` | 5182 B |
| `docs/iterations/iteration-6/evidence/AC-17.status.txt` | 1622 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 第 1 行契约行（期望逐字 "- code-change 代码修改 · 编码工程 · 命令 1"） | ✅ | `"- code-change 代码修改 · 编码工程 · 命令 1"` |
| 3 | Then 第 2 行摘要（期望匹配 /^  摘要：.+$/） | ✅ | `  摘要：定位到要改的文件，做最小改动，并写清改了什么` |
| 4 | Then 第 3 行命令（期望逐字 "  命令：node --test"） | ✅ | `"  命令：node --test"` |
| 5 | Then 第 4 行适用（期望逐字 "  适用：编码工程"） | ✅ | `"  适用：编码工程"` |
| 6 | Then 第 5 行来源（期望逐字 "  来源：内置 assets/skills/code-change/SKILL.md"） | ✅ | `"  来源：内置 assets/skills/code-change/SKILL.md"` |
| 7 | Then 第 6 行正文头（期望逐字 "  正文："） | ✅ | `"  正文："` |
| 8 | Then 第 7 行 = `  ### 工作方法`（期望逐字 "  ### 工作方法"） | ✅ | `"  ### 工作方法"` |
| 9 | 机检：lines.length > 7 | ✅ | `实际 10 行` |
| 10 | 机检：lines[5] === "  正文："（期望逐字 "  正文："） | ✅ | `"  正文："` |
| 11 | 机检：lines[6] === "  ### 工作方法"（期望逐字 "  ### 工作方法"） | ✅ | `"  ### 工作方法"` |
| 12 | 机检：顶层键恰为 skill/body（期望 ["body","skill"]） | ✅ | `["body","skill"]` |
| 13 | 机检：body 含 ### 工作方法（期望含 "### 工作方法"） | ✅ | `<br>### 工作方法<br><br>1. 先读任务里「产物：」那一行，确认要改的文件。<br>2. 只改必要位置，不动无关文件。<br>3. 改完说明：改了哪个文件、为什么这样改。<br>` |
| 14 | 机检：skill 对象恰 7 键（期望 7） | ✅ | `7` |

**⑤ 判定**：通过

---

#### AC-18 建技能并立即通过校验

- 判定：**通过**（核对 14/14 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-18`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-18 | exit=0 | 103ms
[orch skill validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-18 | exit=0 | 98ms
[orch skill validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-18 | exit=0 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-18.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing`
Then 三行：`已创建项目技能：.orch/skills/quote/SKILL.md`、契约行 `- quote 引用规范 · 内容创作 · 命令 0`、`校验：通过`，退出 0；随后 `orch skill validate` 首行是 `校验技能 11 个：全部通过`
机检：文件以 `---` 开头且含 `schema: skill/v1`、`id: quote`；正文去掉空白后非空（`skill validate` `counts.invalid === 0`）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-18.create.txt` | 118 B |
| `docs/iterations/iteration-6/evidence/AC-18.validate.txt` | 36 B |
| `docs/iterations/iteration-6/evidence/AC-18.SKILL.md.txt` | 226 B |
| `docs/iterations/iteration-6/evidence/AC-18.validate-payload.json` | 128 B |
| `docs/iterations/iteration-6/evidence/AC-18.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-18.meta.json` | 900 B |
| `docs/iterations/iteration-6/evidence/AC-18.output.json` | 5731 B |
| `docs/iterations/iteration-6/evidence/AC-18.status.txt` | 1305 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 输出恰好三行（期望 3） | ✅ | `3` |
| 3 | Then 第 1 行逐字（期望逐字 "已创建项目技能：.orch/skills/quote/SKILL.md"） | ✅ | `"已创建项目技能：.orch/skills/quote/SKILL.md"` |
| 4 | Then 第 2 行契约行（期望逐字 "- quote 引用规范 · 内容创作 · 命令 0"） | ✅ | `"- quote 引用规范 · 内容创作 · 命令 0"` |
| 5 | Then 第 3 行校验通过（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 6 | Then skill validate 退出码 0（期望 0） | ✅ | `0` |
| 7 | Then validate 首行 = 校验技能 11 个：全部通过（期望逐字 "校验技能 11 个：全部通过"） | ✅ | `"校验技能 11 个：全部通过"` |
| 8 | 机检：文件以 --- 开头 | ✅ | `---` |
| 9 | 机检：文件含 schema: skill/v1（期望含 "schema: skill/v1"） | ✅ | `---<br>schema: skill/v1<br>id: quote<br>name: 引用规范<br>summary: 给结论配上可核对的出处<br>applies_to: [writing]<br>---<br>### 工作方法<br><br>1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。<br>` |
| 10 | 机检：文件含 id: quote（期望含 "id: quote"） | ✅ | `---<br>schema: skill/v1<br>id: quote<br>name: 引用规范<br>summary: 给结论配上可核对的出处<br>applies_to: [writing]<br>---<br>### 工作方法<br><br>1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。<br>` |
| 11 | 机检：正文去掉空白后非空 | ✅ | `37 个非空白字符` |
| 12 | 机检：默认正文第 1 行逐字（A-7）（期望含 "### 工作方法"） | ✅ | `---<br>schema: skill/v1<br>id: quote<br>name: 引用规范<br>summary: 给结论配上可核对的出处<br>applies_to: [writing]<br>---<br>### 工作方法<br><br>1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。<br>` |
| 13 | 机检：默认正文第 3 行逐字（A-7）（期望含 "1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。"） | ✅ | `---<br>schema: skill/v1<br>id: quote<br>name: 引用规范<br>summary: 给结论配上可核对的出处<br>applies_to: [writing]<br>---<br>### 工作方法<br><br>1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。<br>` |
| 14 | 机检：skill validate counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-19 技能校验定位到具体文件

- 判定：**通过**（核对 7/7 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-19`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 .orch/skills/half/SKILL.md（缺 summary）与 .orch/skills/empty/SKILL.md（正文只有空行）] "(fixture) 预置 .orch/skills/half/SKILL.md（缺 summary）与 .orch/skills/empty/SKILL.md（正文只有空行）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch skill validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-19 | exit=1 | 97ms
[orch skill validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-19 | exit=1 | 117ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-19.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置 `.orch/skills/half/SKILL.md`（缺 `summary`）与 `.orch/skills/empty/SKILL.md`（正文只有空行）
When 我执行 `orch skill validate`
Then 首行 `校验技能 12 个：2 个不合法`，随后两行 `- skills/half/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）` 与 `- skills/empty/SKILL.md：技能正文为空：empty（SKILL_BODY_EMPTY）`，退出 1
机检：`--format json` 的 `codes` 排序后等于 `['SKILL_BODY_EMPTY','SKILL_SCHEMA_MISSING']`，`counts.assets === 12`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-19.validate.txt` | 193 B |
| `docs/iterations/iteration-6/evidence/AC-19.payload.json` | 532 B |
| `docs/iterations/iteration-6/evidence/AC-19.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-19.meta.json` | 837 B |
| `docs/iterations/iteration-6/evidence/AC-19.output.json` | 3714 B |
| `docs/iterations/iteration-6/evidence/AC-19.status.txt` | 1452 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 输出恰好三行（期望 3） | ✅ | `3` |
| 3 | Then 首行逐字（期望逐字 "校验技能 12 个：2 个不合法"） | ✅ | `"校验技能 12 个：2 个不合法"` |
| 4 | Then 有 half 行（缺 summary，逐字） | ✅ | `- skills/empty/SKILL.md：技能正文为空：empty（SKILL_BODY_EMPTY） \|\| - skills/half/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）` |
| 5 | Then 有 empty 行（正文为空，逐字） | ✅ | `- skills/empty/SKILL.md：技能正文为空：empty（SKILL_BODY_EMPTY） \|\| - skills/half/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）` |
| 6 | 机检：codes 排序后等于 [SKILL_BODY_EMPTY, SKILL_SCHEMA_MISSING]（期望 ["SKILL_BODY_EMPTY","SKILL_SCHEMA_MISSING"]） | ✅ | `["SKILL_BODY_EMPTY","SKILL_SCHEMA_MISSING"]` |
| 7 | 机检：counts.assets === 12（期望 12） | ✅ | `12` |

**⑤ 判定**：通过

---

#### AC-20 技能导出再导入

- 判定：**通过**（核对 12/12 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-A`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-B`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根 A 与另一个空项目根 B] "(fixture) 全新项目根 A 与另一个空项目根 B"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[[A] orch skill export code-change --out exports/code-change.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill export code-change --out exports/code-change.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-A | exit=0 | 99ms
[夹具：把导出文件拷进 B 根下（code-change.md）] "(fixture) 把导出文件拷进 B 根下（code-change.md）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[[B] orch skill import code-change.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill import code-change.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-B | exit=0 | 100ms
[[B] orch skill list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-B | exit=0 | 101ms
[[B] orch skill validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-B | exit=0 | 94ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-20.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根 A 与另一个空项目根 B
When 在 A 里 `orch skill export code-change --out exports/code-change.md`，把文件拷进 B 后 `orch skill import code-change.md`
Then A 回 `已导出技能 code-change 到 exports/code-change.md`、退出 0；B 回 `已安装项目技能：.orch/skills/code-change/SKILL.md` 与 `校验：通过`、退出 0；B 的 `skill list` 首行 `技能 10 个（内置 9 · 项目 1）`
机检：B 的 `.orch/skills/code-change/SKILL.md` 与 A 导出的文件逐字节相同；B 的 `skill validate` `counts.invalid === 0`、`counts.project === 1`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-20.export.txt` | 56 B |
| `docs/iterations/iteration-6/evidence/AC-20.import.txt` | 75 B |
| `docs/iterations/iteration-6/evidence/AC-20.list-B.txt` | 595 B |
| `docs/iterations/iteration-6/evidence/AC-20.validate-B.json` | 127 B |
| `docs/iterations/iteration-6/evidence/AC-20.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-20.meta.json` | 1003 B |
| `docs/iterations/iteration-6/evidence/AC-20.output.json` | 6051 B |
| `docs/iterations/iteration-6/evidence/AC-20.status.txt` | 2355 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then A 导出退出 0（期望 0） | ✅ | `0` |
| 2 | Then A 导出输出恰好一行（期望 1） | ✅ | `1` |
| 3 | Then A 导出行逐字（期望逐字 "已导出技能 code-change 到 exports/code-change.md"） | ✅ | `"已导出技能 code-change 到 exports/code-change.md"` |
| 4 | 机检：A 导出的文件存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-20-A\exports\code-change.md` |
| 5 | Then B 导入退出 0（期望 0） | ✅ | `0` |
| 6 | Then B 导入输出恰好两行（期望 2） | ✅ | `2` |
| 7 | Then B 导入第 1 行逐字（期望逐字 "已安装项目技能：.orch/skills/code-change/SKILL.md"） | ✅ | `"已安装项目技能：.orch/skills/code-change/SKILL.md"` |
| 8 | Then B 导入第 2 行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 9 | Then B 的 skill list 首行 = 技能 10 个（内置 9 · 项目 1）（期望逐字 "技能 10 个（内置 9 · 项目 1）"） | ✅ | `"技能 10 个（内置 9 · 项目 1）"` |
| 10 | 机检：B 的 SKILL.md 与 A 导出文件 sha256 相同（逐字节）（期望 "92db6c207c59de341e4ed09a8cb8d90c7f62018968df0f356a0bb4066fe92194"） | ✅ | `"92db6c207c59de341e4ed09a8cb8d90c7f62018968df0f356a0bb4066fe92194"` |
| 11 | 机检：B 的 skill validate counts.invalid === 0（期望 0） | ✅ | `0` |
| 12 | 机检：B 的 skill validate counts.project === 1（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-21 内置工作流可列出

- 判定：**通过**（核对 10/10 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-21`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-21 | exit=0 | 94ms
[orch workflow list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-21 | exit=0 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-21.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch workflow list`
Then 首行 `工作流 3 个（内置 3 · 项目 0）`，随后三行 `- code-loop 编码闭环 · 2 节点 · 3 边 · 内置`、`- single 单节点 · 1 节点 · 0 边 · 内置`、`- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置`；退出码 0
机检：总行数 4；`--format json` 顶层键恰为 `counts`/`workflows`，`counts.total === 3`、`workflows[0]` 恰 6 键（`id`/`name`/`nodeCount`/`edgeCount`/`source`/`file`），`source === 'builtin'`、`file === null`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-21.list.txt` | 211 B |
| `docs/iterations/iteration-6/evidence/AC-21.payload.json` | 586 B |
| `docs/iterations/iteration-6/evidence/AC-21.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-21.meta.json` | 831 B |
| `docs/iterations/iteration-6/evidence/AC-21.output.json` | 4303 B |
| `docs/iterations/iteration-6/evidence/AC-21.status.txt` | 1425 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 首行 = 工作流 3 个（内置 3 · 项目 0）（期望逐字 "工作流 3 个（内置 3 · 项目 0）"） | ✅ | `"工作流 3 个（内置 3 · 项目 0）"` |
| 3 | Then 随后三行逐字（A-8）（期望 ["- code-loop 编码闭环 · 2 节点 · 3 边 · 内置","- single 单节点 · 1 节点 · 0 边 · 内置","- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置"]） | ✅ | `["- code-loop 编码闭环 · 2 节点 · 3 边 · 内置","- single 单节点 · 1 节点 · 0 边 · 内置","- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置"]` |
| 4 | 机检：总行数 4（期望 4） | ✅ | `4` |
| 5 | 机检：顶层键恰为 counts/workflows（期望 ["counts","workflows"]） | ✅ | `["counts","workflows"]` |
| 6 | 机检：counts.total === 3（期望 3） | ✅ | `3` |
| 7 | 机检：workflows[0] 恰 6 键（期望 6） | ✅ | `6` |
| 8 | 机检：workflows[0] 键集合（期望 ["edgeCount","file","id","name","nodeCount","source"]） | ✅ | `["edgeCount","file","id","name","nodeCount","source"]` |
| 9 | 机检：workflows[0].source === builtin（期望 "builtin"） | ✅ | `"builtin"` |
| 10 | 机检：workflows[0].file === null（期望 null） | ✅ | `null` |

**⑤ 判定**：通过

---

#### AC-22 工作流详情给出节点、边与类型

- 判定：**通过**（核对 9/9 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-22`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow show code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-22 | exit=0 | 104ms
[orch workflow show code-loop --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-22 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-22.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch workflow show code-loop`
Then 首行 `- code-loop 编码闭环 · 2 节点 · 3 边 · 内置`；随后 `  入口：T-001 · 终点：T-002`、`  节点：`、两行节点（`    T-001 开发 · 角色节点 developer · 超时 — · 重试 0`）、`  边：`、三行边（含 `    T-002 → T-001 回流 · 轮次上限 2`）；退出码 0
机检：`--format json` 的 `nodes` 长度 2，每个节点恰 11 键（`id`/`nodeType`/`role`/`title`/`timeout`/`retry`/`maxRounds`/`parallelScope`/`scope`/`inputs`/`outputs`），`nodes[0].nodeType === 'role'`；`edges` 长度 3，`edges[1].kind === 'backflow'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-22.show.txt` | 347 B |
| `docs/iterations/iteration-6/evidence/AC-22.payload.json` | 1137 B |
| `docs/iterations/iteration-6/evidence/AC-22.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-22.meta.json` | 848 B |
| `docs/iterations/iteration-6/evidence/AC-22.output.json` | 5529 B |
| `docs/iterations/iteration-6/evidence/AC-22.status.txt` | 2153 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then show 全文 9 行逐字（A-8）（期望 ["- code-loop 编码闭环 · 2 节点 · 3 边 · 内置","  入口：T-001 · 终点：T-002","  节点：","    T-001 开发 · 角色节点 developer · 超时 — · 重试 0","    T-002 测试 · 角色节点 tester · 超时 — · 重试 0","  边：","    T- | ✅ | `["- code-loop 编码闭环 · 2 节点 · 3 边 · 内置","  入口：T-001 · 终点：T-002","  节点：","    T-001 开发 · 角色节点 developer · 超时 — · 重试 0","    T-002 测试 · 角色节点 tester · 超时 — · 重试 0","  边：","    T-001 → T-002 正向","    T-002 → T-001 回流 · 轮次上限 2","    T-001 → T-002 复测"]` |
| 3 | Then 首行逐字（期望逐字 "- code-loop 编码闭环 · 2 节点 · 3 边 · 内置"） | ✅ | `"- code-loop 编码闭环 · 2 节点 · 3 边 · 内置"` |
| 4 | Then 边含回流行逐字（期望逐字 "    T-002 → T-001 回流 · 轮次上限 2"） | ✅ | `"    T-002 → T-001 回流 · 轮次上限 2"` |
| 5 | 机检：nodes 长度 2（期望 2） | ✅ | `2` |
| 6 | 机检：每个节点恰 11 键（期望 "id,inputs,maxRounds,nodeType,outputs,parallelScope,retry,role,scope,timeout,title"） | ✅ | `"id,inputs,maxRounds,nodeType,outputs,parallelScope,retry,role,scope,timeout,title"` |
| 7 | 机检：nodes[0].nodeType === role（期望 "role"） | ✅ | `"role"` |
| 8 | 机检：edges 长度 3（期望 3） | ✅ | `3` |
| 9 | 机检：edges[1].kind === backflow（期望 "backflow"） | ✅ | `"backflow"` |

**⑤ 判定**：通过

---

#### AC-23 项目工作流覆盖同名内置

- 判定：**通过**（核对 12/12 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-23`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 .orch/workflows/code-loop.yaml（3 节点 4 边，覆盖同名内置）] "(fixture) 预置 .orch/workflows/code-loop.yaml（3 节点 4 边，覆盖同名内置）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-23 | exit=0 | 108ms
[orch workflow show code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-23 | exit=0 | 110ms
[orch workflow list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-23 | exit=0 | 97ms
[orch workflow show code-loop --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-23 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-23.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置 `.orch/workflows/code-loop.yaml`（3 节点、4 边，结构与内置不同但合法）
When 我执行 `orch workflow list` 与 `orch workflow show code-loop`
Then `workflow list` 首行 `工作流 3 个（内置 2 · 项目 1）`；`workflow show code-loop` 首行是 `- code-loop 编码闭环 · 3 节点 · 4 边 · 项目`，节点数为 3
机检：`--format json` 中 `counts.builtin === 2`、`counts.project === 1`，同名条目的 `source === 'project'`、`file === '.orch/workflows/code-loop.yaml'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-23.list.txt` | 211 B |
| `docs/iterations/iteration-6/evidence/AC-23.show.txt` | 466 B |
| `docs/iterations/iteration-6/evidence/AC-23.payload.json` | 614 B |
| `docs/iterations/iteration-6/evidence/AC-23.show-payload.json` | 1559 B |
| `docs/iterations/iteration-6/evidence/AC-23.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-23.meta.json` | 893 B |
| `docs/iterations/iteration-6/evidence/AC-23.output.json` | 8335 B |
| `docs/iterations/iteration-6/evidence/AC-23.status.txt` | 4581 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 首行 = 工作流 3 个（内置 2 · 项目 1）（期望逐字 "工作流 3 个（内置 2 · 项目 1）"） | ✅ | `"工作流 3 个（内置 2 · 项目 1）"` |
| 3 | Then code-loop 条目行逐字（期望逐字 "- code-loop 编码闭环 · 3 节点 · 4 边 · 项目"） | ✅ | `"- code-loop 编码闭环 · 3 节点 · 4 边 · 项目"` |
| 4 | Then 总行数 4（首行 + 三条目）（期望 4） | ✅ | `4` |
| 5 | Then show 退出码 0（期望 0） | ✅ | `0` |
| 6 | Then show 首行逐字（期望逐字 "- code-loop 编码闭环 · 3 节点 · 4 边 · 项目"） | ✅ | `"- code-loop 编码闭环 · 3 节点 · 4 边 · 项目"` |
| 7 | 机检：counts.builtin === 2（期望 2） | ✅ | `2` |
| 8 | 机检：counts.project === 1（期望 1） | ✅ | `1` |
| 9 | 机检：同名条目 source === project（期望 "project"） | ✅ | `"project"` |
| 10 | 机检：同名条目 file === .orch/workflows/code-loop.yaml（期望 ".orch/workflows/code-loop.yaml"） | ✅ | `".orch/workflows/code-loop.yaml"` |
| 11 | 机检：show 的 workflow.nodeCount === 3（期望 3） | ✅ | `3` |
| 12 | 机检：show 的 nodes 长度 3（期望 3） | ✅ | `3` |

**⑤ 判定**：通过

---

#### AC-24 四类节点齐备的工作流校验通过

- 判定：**通过**（核对 11/11 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-24`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-1/A-13 的 doc-fanout（writeDocFanout，含 T-001 节点级 wake_allow）] "(fixture) 预置附录 A-1/A-13 的 doc-fanout（writeDocFanout，含 T-001 节点级 wake_allow）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-24 | exit=0 | 116ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-24 | exit=0 | 111ms
[orch workflow show doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-24 | exit=0 | 93ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-24.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置附录 A-1/A-13 的 `doc-fanout`（6 节点，含 `role`/`human`/`escalate`/`subworkflow` 四类；`T-005` 是升级终点、`T-004` 是人工节点）
When 我执行 `orch workflow validate doc-fanout`
Then `校验工作流 4 个：全部通过`，退出码 0（`T-005` 没有出边也不算不可达：它是升级终点，BR-35）
机检：`--format json` 的 `counts.invalid === 0`、`counts.assets === 4`；`workflow show doc-fanout --format json` 的 `nodes.map(n => n.nodeType)` 去重后等于 `['escalate','human','role','subworkflow']`，`subworkflow` 节点（`T-006`）多一个 `workflow` 键且值等于 `'code-loop'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-24.validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-24.payload.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-24.show-payload.json` | 3071 B |
| `docs/iterations/iteration-6/evidence/AC-24.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-24.meta.json` | 878 B |
| `docs/iterations/iteration-6/evidence/AC-24.output.json` | 8705 B |
| `docs/iterations/iteration-6/evidence/AC-24.status.txt` | 5389 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 恰好一行（期望 1） | ✅ | `1` |
| 3 | Then 该行逐字（期望逐字 "校验工作流 4 个：全部通过"） | ✅ | `"校验工作流 4 个：全部通过"` |
| 4 | 机检：counts.invalid === 0（期望 0） | ✅ | `0` |
| 5 | 机检：counts.assets === 4（期望 4） | ✅ | `4` |
| 6 | 机检：counts.builtin === 3（期望 3） | ✅ | `3` |
| 7 | 机检：counts.project === 1（期望 1） | ✅ | `1` |
| 8 | 机检：nodeType 去重集合（期望 ["escalate","human","role","subworkflow"]） | ✅ | `["escalate","human","role","subworkflow"]` |
| 9 | 机检：T-006 多一个 workflow 键且值 code-loop（期望 "code-loop"） | ✅ | `"code-loop"` |
| 10 | 机检：非 subworkflow 节点不带 workflow 键（期望 0） | ✅ | `0` |
| 11 | 机检：T-006 键数 = 11 + workflow（期望 12） | ✅ | `12` |

**⑤ 判定**：通过

---

#### AC-25 非法节点类型与类型必填字段被拒

- 判定：**通过**（核对 10/10 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-25`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 bad-type.yaml / no-title.yaml / no-role.yaml（各自单节点、entry=terminal=T-001）] "(fixture) 预置 bad-type.yaml / no-title.yaml / no-role.yaml（各自单节点、entry=terminal=T-001）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-25 | exit=1 | 105ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-25 | exit=1 | 110ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-25.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置三份工作流：`bad-type.yaml`（`node_type: script`）、`no-title.yaml`（`node_type: human` 且无 `title`）、`no-role.yaml`（`node_type: role` 且无 `role`）
When 我执行 `orch workflow validate`
Then 三条错误，原因码分别是 `WORKFLOW_NODE_TYPE_INVALID`（明细列出四个合法类型）、`WORKFLOW_NODE_FIELD_MISSING`（明细含 `title`）、`WORKFLOW_NODE_FIELD_MISSING`（明细含 `role`），退出 1
机检：`errors.map(e => e.code)` 排序后等于 `['WORKFLOW_NODE_FIELD_MISSING','WORKFLOW_NODE_FIELD_MISSING','WORKFLOW_NODE_TYPE_INVALID']`，按文件名排序且 `errors[0].file` 是 `workflows/bad-type.yaml`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-25.validate.txt` | 389 B |
| `docs/iterations/iteration-6/evidence/AC-25.payload.json` | 843 B |
| `docs/iterations/iteration-6/evidence/AC-25.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-25.meta.json` | 850 B |
| `docs/iterations/iteration-6/evidence/AC-25.output.json` | 5832 B |
| `docs/iterations/iteration-6/evidence/AC-25.status.txt` | 1952 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 恰好四行（计数头 + 三条错误）（期望 4） | ✅ | `4` |
| 3 | Then 明细列出四个合法类型（期望含 "合法取值：role / human / escalate / subworkflow"） | ✅ | `校验工作流 6 个：3 个不合法<br>- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）<br>- workflows/no-role.yaml：节点 T-001 缺少必填字段：role（WORKFLOW_NODE_FIELD_MISSING）<br>- workflows/no-title.yaml：节点 T-001 缺少必填字段：titl` |
| 4 | Then no-title 明细含 title（期望匹配 /缺少必填字段：title/） | ✅ | `校验工作流 6 个：3 个不合法<br>- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）<br>- workflows/no-role.yaml：节点 T-001 缺少必填字段：role（WORKFLOW_NODE_FIELD_MISSING）<br>- workflows/no-title.yaml：节点 T-001 缺少必填字段：titl` |
| 5 | Then no-role 明细含 role（期望匹配 /缺少必填字段：role/） | ✅ | `校验工作流 6 个：3 个不合法<br>- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）<br>- workflows/no-role.yaml：节点 T-001 缺少必填字段：role（WORKFLOW_NODE_FIELD_MISSING）<br>- workflows/no-title.yaml：节点 T-001 缺少必填字段：titl` |
| 6 | 机检：codes 排序后（期望 ["WORKFLOW_NODE_FIELD_MISSING","WORKFLOW_NODE_FIELD_MISSING","WORKFLOW_NODE_TYPE_INVALID"]） | ✅ | `["WORKFLOW_NODE_FIELD_MISSING","WORKFLOW_NODE_FIELD_MISSING","WORKFLOW_NODE_TYPE_INVALID"]` |
| 7 | 机检：errors[0].file === workflows/bad-type.yaml（期望 "workflows/bad-type.yaml"） | ✅ | `"workflows/bad-type.yaml"` |
| 8 | 机检：errors[0].code === WORKFLOW_NODE_TYPE_INVALID（期望 "WORKFLOW_NODE_TYPE_INVALID"） | ✅ | `"WORKFLOW_NODE_TYPE_INVALID"` |
| 9 | 机检：counts.assets === 6（内置 3 + 项目 3）（期望 6） | ✅ | `6` |
| 10 | 机检：counts.invalid === 3（期望 3） | ✅ | `3` |

**⑤ 判定**：通过

---

#### AC-26 子工作流引用必须存在且不得成环

- 判定：**通过**（核对 7/7 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-26`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 sub-ghost.yaml（workflow: ghost）与 sub-self.yaml（workflow: sub-self）] "(fixture) 预置 sub-ghost.yaml（workflow: ghost）与 sub-self.yaml（workflow: sub-self）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-26 | exit=1 | 104ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-26 | exit=1 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-26.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置 `sub-ghost.yaml`（`node_type: subworkflow` + `workflow: ghost`）与 `sub-self.yaml`（`workflow: sub-self`）
When 我执行 `orch workflow validate`
Then 两条错误：`WORKFLOW_SUB_UNKNOWN`（明细含 `ghost`）与 `WORKFLOW_SUB_CYCLE`（明细含 `sub-self`），退出 1
机检：`errors.map(e => e.code)` 排序后等于 `['WORKFLOW_SUB_CYCLE','WORKFLOW_SUB_UNKNOWN']`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-26.validate.txt` | 216 B |
| `docs/iterations/iteration-6/evidence/AC-26.payload.json` | 534 B |
| `docs/iterations/iteration-6/evidence/AC-26.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-26.meta.json` | 849 B |
| `docs/iterations/iteration-6/evidence/AC-26.output.json` | 3920 B |
| `docs/iterations/iteration-6/evidence/AC-26.status.txt` | 1446 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 恰好三行（计数头 + 两条错误）（期望 3） | ✅ | `3` |
| 3 | Then SUB_UNKNOWN 明细含 ghost（期望含 "引用的子工作流不存在：ghost"） | ✅ | `校验工作流 5 个：2 个不合法<br>- workflows/sub-ghost.yaml：引用的子工作流不存在：ghost（WORKFLOW_SUB_UNKNOWN）<br>- workflows/sub-self.yaml：子工作流成环：sub-self（WORKFLOW_SUB_CYCLE）<br>` |
| 4 | Then SUB_CYCLE 明细含 sub-self（期望含 "子工作流成环：sub-self"） | ✅ | `校验工作流 5 个：2 个不合法<br>- workflows/sub-ghost.yaml：引用的子工作流不存在：ghost（WORKFLOW_SUB_UNKNOWN）<br>- workflows/sub-self.yaml：子工作流成环：sub-self（WORKFLOW_SUB_CYCLE）<br>` |
| 5 | 机检：codes 排序后（期望 ["WORKFLOW_SUB_CYCLE","WORKFLOW_SUB_UNKNOWN"]） | ✅ | `["WORKFLOW_SUB_CYCLE","WORKFLOW_SUB_UNKNOWN"]` |
| 6 | 机检：errors[0].file 是 sub-ghost（文件名字典序在前）（期望 "workflows/sub-ghost.yaml"） | ✅ | `"workflows/sub-ghost.yaml"` |
| 7 | 机检：counts.invalid === 2（期望 2） | ✅ | `2` |

**⑤ 判定**：通过

---

#### AC-27 并行 fan-out / fan-in 通过校验并在预演中成组

- 判定：**通过**（核对 12/12 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-27`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-27 | exit=0 | 98ms
[orch workflow dry-run doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-27 | exit=0 | 108ms
[orch workflow dry-run doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-27 | exit=0 | 106ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-27.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 附录 A-13 的 `doc-fanout`（`T-002`/`T-003` 同属并行组 `draft`，同进同出）
When 我执行 `orch workflow validate doc-fanout` 与 `orch workflow dry-run doc-fanout`
Then 校验 `全部通过`；预演里出现一行 `2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all`，且这两个节点不在同一层的两行里分别出现
机检：预演 JSON 的 `layers[1].parallel === true`、`layers[1].nodes` 等于 `['T-002','T-003']`；`layers` 里不存在第二个同时含 `T-002` 的层；`nodeCount === 6`、`edgeCount === 7`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-27.validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-27.dry-run.txt` | 702 B |
| `docs/iterations/iteration-6/evidence/AC-27.payload.json` | 1116 B |
| `docs/iterations/iteration-6/evidence/AC-27.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-27.meta.json` | 887 B |
| `docs/iterations/iteration-6/evidence/AC-27.output.json` | 6606 B |
| `docs/iterations/iteration-6/evidence/AC-27.status.txt` | 2770 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 校验全部通过、退出 0（期望 true） | ✅ | `true` |
| 2 | Then 校验首行含 全部通过（期望含 "全部通过"） | ✅ | `校验工作流 1 个：全部通过<br>` |
| 3 | Then dry-run 退出码 0（期望 0） | ✅ | `0` |
| 4 | Then 层行逐字（含 · 汇合：all）（期望含 "2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all"） | ✅ | `编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流<br>1. T-001 研究（角色节点 researcher）<br>2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all<br>3. T-004 人工确认（人工节点）<br>4. T-006 代码闭环（子工作流 code-loop · 2 节点）<br>5. T-005 升级（升级节点）<br>条件分支：<br>- T-004 → T-` |
| 5 | Then T-002 只出现在一个层行（期望 1） | ✅ | `1` |
| 6 | Then T-003 只出现在一个层行（期望 1） | ✅ | `1` |
| 7 | Then 两个节点同属并行组那一行（期望 true） | ✅ | `true` |
| 8 | 机检：layers[1].parallel === true（期望 true） | ✅ | `true` |
| 9 | 机检：layers[1].nodes（期望 ["T-002","T-003"]） | ✅ | `["T-002","T-003"]` |
| 10 | 机检：不存在第二个含 T-002 的层（期望 1） | ✅ | `1` |
| 11 | 机检：nodeCount === 6（期望 6） | ✅ | `6` |
| 12 | 机检：edgeCount === 7（期望 7） | ✅ | `7` |

**⑤ 判定**：通过

---

#### AC-28 条件分支可表达并在预演中逐条列出

- 判定：**通过**（核对 7/7 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-28`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow dry-run doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-28 | exit=0 | 97ms
[orch workflow dry-run doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-28 | exit=0 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-28.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 附录 A-13 的 `doc-fanout`（`T-004` 有两条出边：人工通过→子工作流、人工驳回→升级；`T-006` 失败→升级）
When 我执行 `orch workflow dry-run doc-fanout`
Then 输出含 `条件分支：` 段与三行：`- T-004 → T-006 当 人工通过`、`- T-004 → T-005 当 人工驳回`、`- T-006 → T-005 当 判定不通过`
机检：预演 JSON 的 `branches` 长度 3，元素为 `{from,to,when}` 三键，`when` 集合等于 `{human_approved,human_rejected,failed}`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-28.dry-run.txt` | 702 B |
| `docs/iterations/iteration-6/evidence/AC-28.payload.json` | 1116 B |
| `docs/iterations/iteration-6/evidence/AC-28.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-28.meta.json` | 851 B |
| `docs/iterations/iteration-6/evidence/AC-28.output.json` | 5917 B |
| `docs/iterations/iteration-6/evidence/AC-28.status.txt` | 2491 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then dry-run 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 输出含 条件分支： 段（期望匹配 /条件分支：/） | ✅ | `编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流<br>1. T-001 研究（角色节点 researcher）<br>2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all<br>3. T-004 人工确认（人工节点）<br>4. T-006 代码闭环（子工作流 code-loop · 2 节点）<br>5. T-005 升级（升级节点）<br>条件分支：<br>- T-004 → T-` |
| 3 | Then 条件段三行逐字（A-10）（期望 ["- T-004 → T-006 当 人工通过","- T-004 → T-005 当 人工驳回","- T-006 → T-005 当 判定不通过"]） | ✅ | `["- T-004 → T-006 当 人工通过","- T-004 → T-005 当 人工驳回","- T-006 → T-005 当 判定不通过"]` |
| 4 | 机检：branches 长度 3（期望 3） | ✅ | `3` |
| 5 | 机检：每个分支恰 from/to/when 三键（期望 "from,to,when"） | ✅ | `"from,to,when"` |
| 6 | 机检：when 集合（期望 ["failed","human_approved","human_rejected"]） | ✅ | `["failed","human_approved","human_rejected"]` |
| 7 | 机检：branches 全文（A-10 序）（期望 [{"from":"T-004","to":"T-006","when":"human_approved"},{"from":"T-004","to":"T-005","when":"human_rejected"},{"from":"T-006","to":"T-005","when":"failed"}]） | ✅ | `[{"from":"T-004","to":"T-006","when":"human_approved"},{"from":"T-004","to":"T-005","when":"human_rejected"},{"from":"T-006","to":"T-005","when":"failed"}]` |

**⑤ 判定**：通过

---

#### AC-29 超时与重试：取值合法可用，越界被拒

- 判定：**通过**（核对 10/10 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-29`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 timeout-ok.yaml（timeout 600 / retry 2）与 timeout-bad.yaml（timeout 0 / retry 9）] "(fixture) 预置 timeout-ok.yaml（timeout 600 / retry 2）与 timeout-bad.yaml（timeout 0 / retry 9）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate timeout-ok] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate timeout-ok   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-29 | exit=0 | 106ms
[orch workflow validate timeout-bad] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate timeout-bad   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-29 | exit=1 | 100ms
[orch workflow dry-run timeout-ok] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run timeout-ok   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-29 | exit=0 | 101ms
[orch workflow dry-run timeout-ok --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run timeout-ok --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-29 | exit=0 | 102ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-29.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置 `timeout-ok.yaml`（某节点 `timeout: 600`、`retry: 2`）与 `timeout-bad.yaml`（`timeout: 0`、另一节点 `retry: 9`）
When 我分别执行 `orch workflow validate timeout-ok` 与 `orch workflow validate timeout-bad`，再对合法的那个执行 `orch workflow dry-run timeout-ok`
Then 第一个 `校验工作流 1 个：全部通过`、退出 0；第二个报 `WORKFLOW_TIMEOUT_INVALID` 与 `WORKFLOW_RETRY_INVALID`、退出 1；预演输出含 `- <节点> 超时 600s · 重试 2`
机检：预演 JSON 的 `policies` 含 `{nodeId, timeout:600, retry:2}`；`timeout` 合法范围为 1~86400 的整数、`retry` 为 0~5 的整数
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-29.validate-ok.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-29.validate-bad.txt` | 272 B |
| `docs/iterations/iteration-6/evidence/AC-29.dry-run.txt` | 229 B |
| `docs/iterations/iteration-6/evidence/AC-29.payload.json` | 317 B |
| `docs/iterations/iteration-6/evidence/AC-29.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-29.meta.json` | 914 B |
| `docs/iterations/iteration-6/evidence/AC-29.output.json` | 6528 B |
| `docs/iterations/iteration-6/evidence/AC-29.status.txt` | 2098 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 第一个退出 0（期望 0） | ✅ | `0` |
| 2 | Then 校验工作流 1 个：全部通过（期望逐字 "校验工作流 1 个：全部通过"） | ✅ | `"校验工作流 1 个：全部通过"` |
| 3 | Then 第二个退出 1（期望 1） | ✅ | `1` |
| 4 | Then 报 WORKFLOW_TIMEOUT_INVALID（期望含 "（WORKFLOW_TIMEOUT_INVALID）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/timeout-bad.yaml：超时取值非法：0；合法范围：1~86400 的整数（WORKFLOW_TIMEOUT_INVALID）<br>- workflows/timeout-bad.yaml：重试取值非法：9；合法范围：0~5 的整数（WORKFLOW_RETRY_INVALID）<br>` |
| 5 | Then 报 WORKFLOW_RETRY_INVALID（期望含 "（WORKFLOW_RETRY_INVALID）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/timeout-bad.yaml：超时取值非法：0；合法范围：1~86400 的整数（WORKFLOW_TIMEOUT_INVALID）<br>- workflows/timeout-bad.yaml：重试取值非法：9；合法范围：0~5 的整数（WORKFLOW_RETRY_INVALID）<br>` |
| 6 | Then 预演输出策略行（期望含 "- T-001 超时 600s · 重试 2"） | ✅ | `编排计划 timeout-ok · 1 节点 · 0 边 · 0 个并行组 · 0 个子工作流<br>1. T-001 开发（角色节点 developer）<br>超时与重试：<br>- T-001 超时 600s · 重试 2<br>结论：编排可执行，未启动任何会话<br>` |
| 7 | 机检：policies 含 {nodeId, timeout:600, retry:2}（期望 [{"nodeId":"T-001","timeout":600,"retry":2}]） | ✅ | `[{"nodeId":"T-001","timeout":600,"retry":2}]` |
| 8 | 机检：policies[] 恰 nodeId/timeout/retry 三键（期望 "nodeId,retry,timeout"） | ✅ | `"nodeId,retry,timeout"` |
| 9 | 机检：timeout 合法范围 1~86400（期望含 "合法范围：1~86400 的整数"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/timeout-bad.yaml：超时取值非法：0；合法范围：1~86400 的整数（WORKFLOW_TIMEOUT_INVALID）<br>- workflows/timeout-bad.yaml：重试取值非法：9；合法范围：0~5 的整数（WORKFLOW_RETRY_INVALID）<br>` |
| 10 | 机检：retry 合法范围 0~5（期望含 "合法范围：0~5 的整数"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/timeout-bad.yaml：超时取值非法：0；合法范围：1~86400 的整数（WORKFLOW_TIMEOUT_INVALID）<br>- workflows/timeout-bad.yaml：重试取值非法：9；合法范围：0~5 的整数（WORKFLOW_RETRY_INVALID）<br>` |

**⑤ 判定**：通过

---

#### AC-30 字段映射可表达并可核对

- 判定：**通过**（核对 8/8 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-30`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-30 | exit=0 | 108ms
[orch workflow dry-run doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-30 | exit=0 | 111ms
[orch workflow dry-run doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-30 | exit=0 | 168ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-30.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 附录 A-13 的 `doc-fanout`（`T-001.research.notes` 映射到 `T-002.brief` 与 `T-003.brief`）
When 我执行 `orch workflow dry-run doc-fanout`
Then 输出含 `字段映射：` 段与两行 `- T-001.research.notes → T-002.brief`、`- T-001.research.notes → T-003.brief`
机检：预演 JSON 的 `mappings` 长度 2、元素恰 3 键（`from`/`to`/`edge`），`mappings[0].from === 'T-001.research.notes'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-30.validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-30.dry-run.txt` | 702 B |
| `docs/iterations/iteration-6/evidence/AC-30.payload.json` | 1116 B |
| `docs/iterations/iteration-6/evidence/AC-30.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-30.meta.json` | 862 B |
| `docs/iterations/iteration-6/evidence/AC-30.output.json` | 6413 B |
| `docs/iterations/iteration-6/evidence/AC-30.status.txt` | 2771 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 自证：validate doc-fanout 全部通过（期望 true） | ✅ | `true` |
| 2 | Then dry-run 退出码 0（期望 0） | ✅ | `0` |
| 3 | Then 输出含 字段映射： 段（期望匹配 /字段映射：/） | ✅ | `编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流<br>1. T-001 研究（角色节点 researcher）<br>2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all<br>3. T-004 人工确认（人工节点）<br>4. T-006 代码闭环（子工作流 code-loop · 2 节点）<br>5. T-005 升级（升级节点）<br>条件分支：<br>- T-004 → T-` |
| 4 | Then 映射段两行逐字（A-10）（期望 ["- T-001.research.notes → T-002.brief","- T-001.research.notes → T-003.brief"]） | ✅ | `["- T-001.research.notes → T-002.brief","- T-001.research.notes → T-003.brief"]` |
| 5 | 机检：mappings 长度 2（期望 2） | ✅ | `2` |
| 6 | 机检：每个映射恰 from/to/edge 三键（期望 "edge,from,to"） | ✅ | `"edge,from,to"` |
| 7 | 机检：mappings[0].from === T-001.research.notes（期望 "T-001.research.notes"） | ✅ | `"T-001.research.notes"` |
| 8 | 机检：mappings 全文（A-10 序）（期望 [{"from":"T-001.research.notes","to":"brief","edge":"T-001→T-002"},{"from":"T-001.research.notes","to":"brief","edge":"T-001→T-003"}]） | ✅ | `[{"from":"T-001.research.notes","to":"brief","edge":"T-001→T-002"},{"from":"T-001.research.notes","to":"brief","edge":"T-001→T-003"}]` |

**⑤ 判定**：通过

---

#### AC-31 契约不连通的工作流被拒绝（规划验收）

- 判定：**通过**（核对 10/10 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-31`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：把 T-002.inputs 改成 [brief, outline]（无任何边提供 outline）] "(fixture) 把 T-002.inputs 改成 [brief, outline]（无任何边提供 outline）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-31 | exit=1 | 100ms
[orch workflow validate doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-31 | exit=1 | 100ms
[夹具：在 T-001→T-002 的 map 补一条 {from: T-001.research.notes, to: outline}] "(fixture) 在 T-001→T-002 的 map 补一条 {from: T-001.research.notes, to: outline}"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout（补映射后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-31 | exit=0 | 115ms
[orch workflow validate doc-fanout --format json（补映射后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-31 | exit=0 | 101ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-31.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 把附录 A-13 的 `T-002.inputs` 改成 `[brief, outline]`，但没有任何边提供 `outline`
When 我执行 `orch workflow validate doc-fanout`
Then 报一条 `WORKFLOW_MAPPING_INCOMPLETE`，明细为 `T-002 的输入 outline 没有来源`，退出 1；把映射补上后同一命令 `全部通过`
机检：失败时 `errors[0].code === 'WORKFLOW_MAPPING_INCOMPLETE'`、`errors[0].detail` 含 `outline`；补上后 `counts.invalid === 0`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-31.validate-broken.txt` | 140 B |
| `docs/iterations/iteration-6/evidence/AC-31.payload-broken.json` | 334 B |
| `docs/iterations/iteration-6/evidence/AC-31.validate-fixed.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-31.payload-fixed.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-31.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-31.meta.json` | 937 B |
| `docs/iterations/iteration-6/evidence/AC-31.output.json` | 5841 B |
| `docs/iterations/iteration-6/evidence/AC-31.status.txt` | 2271 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具自检：T-002 inputs 已改为 [brief, outline] | ✅ | `replace applied` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 报 WORKFLOW_MAPPING_INCOMPLETE（期望含 "（WORKFLOW_MAPPING_INCOMPLETE）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：T-002 的输入 outline 没有来源（WORKFLOW_MAPPING_INCOMPLETE）<br>` |
| 4 | Then 明细为 T-002 的输入 outline 没有来源（期望含 "T-002 的输入 outline 没有来源"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：T-002 的输入 outline 没有来源（WORKFLOW_MAPPING_INCOMPLETE）<br>` |
| 5 | 机检：errors[0].code === WORKFLOW_MAPPING_INCOMPLETE（期望 "WORKFLOW_MAPPING_INCOMPLETE"） | ✅ | `"WORKFLOW_MAPPING_INCOMPLETE"` |
| 6 | 机检：errors[0].detail 含 outline（期望含 "outline"） | ✅ | `T-002 的输入 outline 没有来源` |
| 7 | 夹具自检：outline 映射已补上 | ✅ | `replace applied` |
| 8 | Then 补上映射后退出 0（期望 0） | ✅ | `0` |
| 9 | Then 补上映射后全部通过（期望含 "全部通过"） | ✅ | `校验工作流 1 个：全部通过<br>` |
| 10 | 机检：补上后 counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-32 可达性

- 判定：**通过**（核对 7/7 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-32`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：追加节点 T-007（node_type: role、role: tester，无任何边指向）] "(fixture) 追加节点 T-007（node_type: role、role: tester，无任何边指向）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-32 | exit=1 | 108ms
[orch workflow validate doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-32 | exit=1 | 102ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-32.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 附录 A-13 的 `doc-fanout` 追加一个谁都不指向的节点 `T-007`（`node_type: role`、`role: tester`）
When 我执行 `orch workflow validate doc-fanout`
Then 报 `WORKFLOW_UNREACHABLE`，明细含 `T-007`，退出 1
机检：`errors[0].code === 'WORKFLOW_UNREACHABLE'`、`errors[0].detail` 含 `T-007`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-32.validate.txt` | 120 B |
| `docs/iterations/iteration-6/evidence/AC-32.payload.json` | 314 B |
| `docs/iterations/iteration-6/evidence/AC-32.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-32.meta.json` | 813 B |
| `docs/iterations/iteration-6/evidence/AC-32.output.json` | 3572 B |
| `docs/iterations/iteration-6/evidence/AC-32.status.txt` | 1326 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具自检：T-007 已追加 | ✅ | `replace applied` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 报 WORKFLOW_UNREACHABLE（期望含 "（WORKFLOW_UNREACHABLE）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：节点不可达：T-007（WORKFLOW_UNREACHABLE）<br>` |
| 4 | Then 明细含 T-007（期望含 "节点不可达：T-007"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：节点不可达：T-007（WORKFLOW_UNREACHABLE）<br>` |
| 5 | 机检：errors[0].code === WORKFLOW_UNREACHABLE（期望 "WORKFLOW_UNREACHABLE"） | ✅ | `"WORKFLOW_UNREACHABLE"` |
| 6 | 机检：errors[0].detail 含 T-007（期望含 "T-007"） | ✅ | `节点不可达：T-007` |
| 7 | 机检：counts.invalid === 1（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-33 回流边必须有轮次上限

- 判定：**通过**（核对 8/8 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-33`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：追加边 T-003 → T-002（kind: backflow、when: failed）] "(fixture) 追加边 T-003 → T-002（kind: backflow、when: failed）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-33 | exit=1 | 98ms
[orch workflow validate doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-33 | exit=1 | 116ms
[夹具：给 T-002 补上 max_rounds: 2] "(fixture) 给 T-002 补上 max_rounds: 2"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout（补 max_rounds 后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-33 | exit=0 | 103ms
[orch workflow validate doc-fanout --format json（补 max_rounds 后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-33 | exit=0 | 101ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-33.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 附录 A-13 的 `doc-fanout` 追加一条 `T-003 → T-002` 的 `backflow` 边（`kind: backflow`、`when: failed`；源 `T-003` 是 `role` 节点、不是 `human`，符合 BR-25 / BR-36，且只加边、不改任何 `scope`，不与 AC-34 的 `T-002` / `T-003` scope 夹具互相污染），`T-002` 仍是回边目标且没有声明 `max_rounds`
When 我执行 `orch workflow validate doc-fanout`
Then 报 `WORKFLOW_BACKFLOW_NO_LIMIT`，明细含 `T-002`；给 `T-002` 补上 `max_rounds: 2` 后同一命令通过
机检：失败时 `errors[0].code === 'WORKFLOW_BACKFLOW_NO_LIMIT'`；补上后 `counts.invalid === 0`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-33.validate-broken.txt` | 141 B |
| `docs/iterations/iteration-6/evidence/AC-33.payload-broken.json` | 335 B |
| `docs/iterations/iteration-6/evidence/AC-33.validate-fixed.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-33.payload-fixed.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-33.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-33.meta.json` | 912 B |
| `docs/iterations/iteration-6/evidence/AC-33.output.json` | 5388 B |
| `docs/iterations/iteration-6/evidence/AC-33.status.txt` | 2233 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 报 WORKFLOW_BACKFLOW_NO_LIMIT（期望含 "（WORKFLOW_BACKFLOW_NO_LIMIT）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：回流目标缺少轮次上限：T-002（WORKFLOW_BACKFLOW_NO_LIMIT）<br>` |
| 3 | Then 明细含 T-002（期望含 "回流目标缺少轮次上限：T-002"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：回流目标缺少轮次上限：T-002（WORKFLOW_BACKFLOW_NO_LIMIT）<br>` |
| 4 | 机检：errors[0].code === WORKFLOW_BACKFLOW_NO_LIMIT（期望 "WORKFLOW_BACKFLOW_NO_LIMIT"） | ✅ | `"WORKFLOW_BACKFLOW_NO_LIMIT"` |
| 5 | 夹具自检：T-002 已补 max_rounds: 2 | ✅ | `replace applied` |
| 6 | Then 补上后退出 0（期望 0） | ✅ | `0` |
| 7 | Then 补上后全部通过（期望含 "全部通过"） | ✅ | `校验工作流 1 个：全部通过<br>` |
| 8 | 机检：补上后 counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-34 并行组内作用域不得重复

- 判定：**通过**（核对 10/10 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-34`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：把 T-002 与 T-003 的 scope 都改成 draft] "(fixture) 把 T-002 与 T-003 的 scope 都改成 draft"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout（scope 重复）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-34 | exit=1 | 97ms
[orch workflow validate doc-fanout --format json（scope 重复）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-34 | exit=1 | 104ms
[夹具：去掉 T-003 的 parallel_scope（并行组 draft 只剩 T-002）] "(fixture) 去掉 T-003 的 parallel_scope（并行组 draft 只剩 T-002）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout（并行组只剩一个节点）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-34 | exit=1 | 101ms
[orch workflow validate doc-fanout --format json（并行组只剩一个节点）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-34 | exit=1 | 96ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-34.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 把附录 A-13 的 `T-002` 与 `T-003` 的 `scope` 都改成 `draft`
When 我执行 `orch workflow validate doc-fanout`
Then 报 `WORKFLOW_SCOPE_OVERLAP`，明细同时含 `T-002`、`T-003`、`draft`；把并行组 `draft` 改成只剩一个节点时改报 `WORKFLOW_SCOPE_INVALID`
机检：两次的 `errors[0].code` 分别为 `WORKFLOW_SCOPE_OVERLAP` 与 `WORKFLOW_SCOPE_INVALID`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-34.validate-overlap.txt` | 168 B |
| `docs/iterations/iteration-6/evidence/AC-34.payload-overlap.json` | 362 B |
| `docs/iterations/iteration-6/evidence/AC-34.validate-invalid.txt` | 133 B |
| `docs/iterations/iteration-6/evidence/AC-34.payload-invalid.json` | 327 B |
| `docs/iterations/iteration-6/evidence/AC-34.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-34.meta.json` | 922 B |
| `docs/iterations/iteration-6/evidence/AC-34.output.json` | 6419 B |
| `docs/iterations/iteration-6/evidence/AC-34.status.txt` | 2627 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具自检：两处 scope 均已改为 draft | ✅ | `replace applied` |
| 2 | Then 第一段退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 报 WORKFLOW_SCOPE_OVERLAP（期望含 "（WORKFLOW_SCOPE_OVERLAP）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：并行组 draft 内的 T-002 与 T-003 使用了同一作用域 draft（WORKFLOW_SCOPE_OVERLAP）<br>` |
| 4 | Then 明细同时含 T-002/T-003/draft（期望含 "并行组 draft 内的 T-002 与 T-003 使用了同一作用域 draft"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：并行组 draft 内的 T-002 与 T-003 使用了同一作用域 draft（WORKFLOW_SCOPE_OVERLAP）<br>` |
| 5 | 机检：第一段 errors[0].code（期望 "WORKFLOW_SCOPE_OVERLAP"） | ✅ | `"WORKFLOW_SCOPE_OVERLAP"` |
| 6 | 夹具自检：T-003 的 parallel_scope 已去掉 | ✅ | `replace applied` |
| 7 | Then 第二段退出码 1（期望 1） | ✅ | `1` |
| 8 | Then 改报 WORKFLOW_SCOPE_INVALID（期望含 "（WORKFLOW_SCOPE_INVALID）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：并行组 draft 只有 1 个节点（WORKFLOW_SCOPE_INVALID）<br>` |
| 9 | 机检：第二段 errors[0].code（期望 "WORKFLOW_SCOPE_INVALID"） | ✅ | `"WORKFLOW_SCOPE_INVALID"` |
| 10 | 机检：第二段明细（期望含 "并行组 draft 只有 1 个节点"） | ✅ | `并行组 draft 只有 1 个节点` |

**⑤ 判定**：通过

---

#### AC-35 变量引用无效

- 判定：**通过**（核对 7/7 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-35`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：把 T-001→T-002 的映射改成 from: T-003.research.notes] "(fixture) 把 T-001→T-002 的映射改成 from: T-003.research.notes"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-35 | exit=1 | 102ms
[orch workflow validate doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-35 | exit=1 | 96ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-35.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 把附录 A-13 的 `T-001 → T-002` 映射改成 `from: T-003.research.notes`（`T-003` 不是该边的上游）
When 我执行 `orch workflow validate doc-fanout`
Then 报 `WORKFLOW_VAR_UNKNOWN`，明细含 `T-003.research.notes`，退出 1
机检：`errors[0].code === 'WORKFLOW_VAR_UNKNOWN'`、`errors[0].detail` 含 `T-003.research.notes`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-35.validate.txt` | 144 B |
| `docs/iterations/iteration-6/evidence/AC-35.payload.json` | 338 B |
| `docs/iterations/iteration-6/evidence/AC-35.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-35.meta.json` | 822 B |
| `docs/iterations/iteration-6/evidence/AC-35.output.json` | 3763 B |
| `docs/iterations/iteration-6/evidence/AC-35.status.txt` | 1343 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具自检：map.from 已改为 T-003.research.notes | ✅ | `replace applied` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 报 WORKFLOW_VAR_UNKNOWN（期望含 "（WORKFLOW_VAR_UNKNOWN）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：变量引用无法解析：T-003.research.notes（WORKFLOW_VAR_UNKNOWN）<br>` |
| 4 | Then 明细含 T-003.research.notes（期望含 "变量引用无法解析：T-003.research.notes"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：变量引用无法解析：T-003.research.notes（WORKFLOW_VAR_UNKNOWN）<br>` |
| 5 | 机检：errors[0].code === WORKFLOW_VAR_UNKNOWN（期望 "WORKFLOW_VAR_UNKNOWN"） | ✅ | `"WORKFLOW_VAR_UNKNOWN"` |
| 6 | 机检：errors[0].detail 含 T-003.research.notes（期望含 "T-003.research.notes"） | ✅ | `变量引用无法解析：T-003.research.notes` |
| 7 | 机检：counts.invalid === 1（期望 1） | ✅ | `1` |

**⑤ 判定**：通过

---

#### AC-36 节点状态转换合法性

- 判定：**通过**（核对 11/11 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-36`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：追加边 T-005 → T-006（forward，升级节点不得有正向出边）] "(fixture) 追加边 T-005 → T-006（forward，升级节点不得有正向出边）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout（升级出边）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-36 | exit=1 | 103ms
[orch workflow validate doc-fanout --format json（升级出边）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-36 | exit=1 | 101ms
[夹具：去掉 T-004 两条出边的 when（缺省 always，人工节点出边必须写人工条件）] "(fixture) 去掉 T-004 两条出边的 when（缺省 always，人工节点出边必须写人工条件）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate doc-fanout（人工出边无条件）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-36 | exit=1 | 94ms
[orch workflow validate doc-fanout --format json（人工出边无条件）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-36 | exit=1 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-36.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 附录 A-13 的 `doc-fanout` 追加一条 `T-005 → T-006` 的 `forward` 边（升级节点不得有正向出边）
When 我执行 `orch workflow validate doc-fanout`
Then 报 `WORKFLOW_TRANSITION_ILLEGAL`，明细含 `T-005`；把 `T-004` 的两条出边的 `when` 去掉后，改报 `WORKFLOW_TRANSITION_ILLEGAL` 且明细含 `人工条件`
机检：两次的 `errors[0].code` 均为 `WORKFLOW_TRANSITION_ILLEGAL`，`detail` 分别含 `T-005` 与 `人工条件`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-36.validate-escalate.txt` | 144 B |
| `docs/iterations/iteration-6/evidence/AC-36.payload-escalate.json` | 338 B |
| `docs/iterations/iteration-6/evidence/AC-36.validate-human.txt` | 153 B |
| `docs/iterations/iteration-6/evidence/AC-36.payload-human.json` | 347 B |
| `docs/iterations/iteration-6/evidence/AC-36.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-36.meta.json` | 914 B |
| `docs/iterations/iteration-6/evidence/AC-36.output.json` | 6869 B |
| `docs/iterations/iteration-6/evidence/AC-36.status.txt` | 2724 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 第一段退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 报 WORKFLOW_TRANSITION_ILLEGAL（期望含 "（WORKFLOW_TRANSITION_ILLEGAL）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：升级节点 T-005 不能有正向出边（WORKFLOW_TRANSITION_ILLEGAL）<br>` |
| 3 | Then 明细含 T-005（期望含 "升级节点 T-005 不能有正向出边"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：升级节点 T-005 不能有正向出边（WORKFLOW_TRANSITION_ILLEGAL）<br>` |
| 4 | 机检：第一段 errors[0].code（期望 "WORKFLOW_TRANSITION_ILLEGAL"） | ✅ | `"WORKFLOW_TRANSITION_ILLEGAL"` |
| 5 | 机检：第一段 detail 含 T-005（期望含 "T-005"） | ✅ | `升级节点 T-005 不能有正向出边` |
| 6 | 夹具自检：T-004 两条出边的 when 已去掉 | ✅ | `replace applied` |
| 7 | Then 第二段退出码 1（期望 1） | ✅ | `1` |
| 8 | Then 改报 WORKFLOW_TRANSITION_ILLEGAL（期望含 "（WORKFLOW_TRANSITION_ILLEGAL）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：人工节点 T-004 的出边必须写人工条件（WORKFLOW_TRANSITION_ILLEGAL）<br>` |
| 9 | Then 明细含 人工条件（期望含 "人工节点 T-004 的出边必须写人工条件"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/doc-fanout.yaml：人工节点 T-004 的出边必须写人工条件（WORKFLOW_TRANSITION_ILLEGAL）<br>` |
| 10 | 机检：第二段 errors[0].code（期望 "WORKFLOW_TRANSITION_ILLEGAL"） | ✅ | `"WORKFLOW_TRANSITION_ILLEGAL"` |
| 11 | 机检：第二段 detail 含 人工条件（期望含 "人工条件"） | ✅ | `人工节点 T-004 的出边必须写人工条件` |

**⑤ 判定**：通过

---

#### AC-37 角色对唤醒权限

- 判定：**通过**（核对 9/9 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-37`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 wake.yaml（T-001 role: writer 节点级 wake_allow: [editor] → T-002 role: reviewer）] "(fixture) 预置 wake.yaml（T-001 role: writer 节点级 wake_allow: [editor] → T-002 role: reviewer）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate wake] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-37 | exit=1 | 100ms
[orch workflow validate wake --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-37 | exit=1 | 101ms
[夹具：把 T-002 的 role 换成 editor（writer 的节点级白名单含 editor）] "(fixture) 把 T-002 的 role 换成 editor（writer 的节点级白名单含 editor）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate wake（下游换 editor 后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-37 | exit=0 | 99ms
[orch workflow validate wake --format json（下游换 editor 后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-37 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-37.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置工作流 `wake.yaml`：`T-001`（`role: writer`，`wake_allow` 为 `[editor]`）→ `T-002`（`role: reviewer`），`terminal: T-002`
When 我执行 `orch workflow validate wake`
Then 报 `WORKFLOW_WAKE_DENIED`，明细含 `writer`、`reviewer`，退出 1；把下游换成 `editor` 后同一命令通过
机检：失败时 `errors[0].code === 'WORKFLOW_WAKE_DENIED'`；换成 `editor` 后 `counts.invalid === 0`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-37.validate-denied.txt` | 137 B |
| `docs/iterations/iteration-6/evidence/AC-37.payload-denied.json` | 331 B |
| `docs/iterations/iteration-6/evidence/AC-37.validate-fixed.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-37.payload-fixed.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-37.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-37.meta.json` | 903 B |
| `docs/iterations/iteration-6/evidence/AC-37.output.json` | 5688 B |
| `docs/iterations/iteration-6/evidence/AC-37.status.txt` | 2391 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 报 WORKFLOW_WAKE_DENIED（期望含 "（WORKFLOW_WAKE_DENIED）"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/wake.yaml：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）<br>` |
| 3 | Then 明细含 writer（期望含 "writer"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/wake.yaml：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）<br>` |
| 4 | Then 明细含 reviewer（期望含 "唤醒不在白名单内：writer → reviewer"） | ✅ | `校验工作流 1 个：1 个不合法<br>- workflows/wake.yaml：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）<br>` |
| 5 | 机检：errors[0].code === WORKFLOW_WAKE_DENIED（期望 "WORKFLOW_WAKE_DENIED"） | ✅ | `"WORKFLOW_WAKE_DENIED"` |
| 6 | 夹具自检：下游角色已换成 editor | ✅ | `replace applied` |
| 7 | Then 换成 editor 后退出 0（期望 0） | ✅ | `0` |
| 8 | Then 换成 editor 后全部通过（期望含 "全部通过"） | ✅ | `校验工作流 1 个：全部通过<br>` |
| 9 | 机检：换成 editor 后 counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-38 工作流校验的文本与 JSON 一致

- 判定：**通过**（核对 12/12 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-38`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（只有内置三张图）] "(fixture) 全新项目根（只有内置三张图）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-38 | exit=0 | 111ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-38 | exit=0 | 109ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-38.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根（只有内置三张图）
When 我执行 `orch workflow validate` 与 `orch workflow validate --format json`
Then 文本恰好一行 `校验工作流 3 个：全部通过`、退出 0；JSON 顶层恰两键 `counts`/`errors`
机检：`counts` 恰 4 键（`assets`/`builtin`/`project`/`invalid`），`assets === 3`、`builtin === 3`、`invalid === 0`、`errors` 为空；`errors[]` 出现时恰 6 键（`code`/`file`/`scope`/`field`/`line`/`detail`），`scope === 'workflow'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-38.validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-38.payload.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-38.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-38.meta.json` | 844 B |
| `docs/iterations/iteration-6/evidence/AC-38.output.json` | 3408 B |
| `docs/iterations/iteration-6/evidence/AC-38.status.txt` | 815 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 恰好一行（期望 1） | ✅ | `1` |
| 3 | Then 该行逐字（期望逐字 "校验工作流 3 个：全部通过"） | ✅ | `"校验工作流 3 个：全部通过"` |
| 4 | Then JSON 退出码 0（期望 0） | ✅ | `0` |
| 5 | Then JSON 顶层恰两键（期望 ["counts","errors"]） | ✅ | `["counts","errors"]` |
| 6 | 机检：counts 恰 4 键（期望 ["assets","builtin","invalid","project"]） | ✅ | `["assets","builtin","invalid","project"]` |
| 7 | 机检：counts.assets === 3（期望 3） | ✅ | `3` |
| 8 | 机检：counts.builtin === 3（期望 3） | ✅ | `3` |
| 9 | 机检：counts.project === 0（期望 0） | ✅ | `0` |
| 10 | 机检：counts.invalid === 0（期望 0） | ✅ | `0` |
| 11 | 机检：errors 为空数组（期望 []） | ✅ | `[]` |
| 12 | 机检：文本行数与 counts.invalid 一致（0 条错误行）（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-39 工作流差异与「无差异」

- 判定：**通过**（核对 15/15 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-39`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch workflow create fork --name 分叉版 --from code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create fork --name 分叉版 --from code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-39 | exit=0 | 113ms
[夹具：把 fork.yaml 的 nodes[0].title 从 开发 改为 开发（改）] "(fixture) 把 fork.yaml 的 nodes[0].title 从 开发 改为 开发（改）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow diff fork --against code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow diff fork --against code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-39 | exit=0 | 106ms
[orch workflow diff fork --against code-loop --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow diff fork --against code-loop --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-39 | exit=0 | 98ms
[orch workflow create copy --name 复制版 --from code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create copy --name 复制版 --from code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-39 | exit=0 | 124ms
[orch workflow diff copy] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow diff copy   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-39 | exit=0 | 108ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-39.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 项目工作流 `fork.yaml` 由 `orch workflow create fork --name 分叉版 --from code-loop` 生成后再改一个节点标题
When 我执行 `orch workflow diff fork --against code-loop`；再新建 `copy`（`--from code-loop` 后一字不改）并执行 `orch workflow diff copy`
Then 第一次打印 `对比工作流 fork（项目）与基线 code-loop（内置）` + 一行 `~ nodes[0].title：开发 → 开发（改）` + `差异 1 项`，退出 0；第二次末行 `无差异`
机检：第一次的 `--format json` 顶层键恰 `base`/`target`/`changes`，`changes.length === 1` 且 `changes[0].field === 'nodes[0].title'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-39.create-fork.txt` | 70 B |
| `docs/iterations/iteration-6/evidence/AC-39.diff-fork.txt` | 124 B |
| `docs/iterations/iteration-6/evidence/AC-39.payload.json` | 194 B |
| `docs/iterations/iteration-6/evidence/AC-39.create-copy.txt` | 70 B |
| `docs/iterations/iteration-6/evidence/AC-39.diff-copy.txt` | 75 B |
| `docs/iterations/iteration-6/evidence/AC-39.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-39.meta.json` | 924 B |
| `docs/iterations/iteration-6/evidence/AC-39.output.json` | 6302 B |
| `docs/iterations/iteration-6/evidence/AC-39.status.txt` | 2085 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：create fork 退出 0（期望 0） | ✅ | `0` |
| 2 | 夹具自检：nodes[0].title 已改为 开发（改） | ✅ | `replace applied` |
| 3 | Then 退出码 0（期望 0） | ✅ | `0` |
| 4 | Then 恰好三行（期望 3） | ✅ | `3` |
| 5 | Then 首行逐字（期望逐字 "对比工作流 fork（项目）与基线 code-loop（内置）"） | ✅ | `"对比工作流 fork（项目）与基线 code-loop（内置）"` |
| 6 | Then 差异行逐字（期望逐字 "~ nodes[0].title：开发 → 开发（改）"） | ✅ | `"~ nodes[0].title：开发 → 开发（改）"` |
| 7 | Then 末行逐字（期望逐字 "差异 1 项"） | ✅ | `"差异 1 项"` |
| 8 | 机检：顶层键恰 base/target/changes（期望 ["base","changes","target"]） | ✅ | `["base","changes","target"]` |
| 9 | 机检：changes.length === 1（期望 1） | ✅ | `1` |
| 10 | 机检：changes[0].field === nodes[0].title（期望 "nodes[0].title"） | ✅ | `"nodes[0].title"` |
| 11 | Given：create copy 退出 0（期望 0） | ✅ | `0` |
| 12 | Then diff copy 退出码 0（期望 0） | ✅ | `0` |
| 13 | Then diff copy 恰两行（期望 2） | ✅ | `2` |
| 14 | Then diff copy 末行 = 无差异（期望逐字 "无差异"） | ✅ | `"无差异"` |
| 15 | Then diff copy 首行（裁-14①：定义体全等回退到内置基线）（期望逐字 "对比工作流 copy（项目）与基线 code-loop（内置）"） | ✅ | `"对比工作流 copy（项目）与基线 code-loop（内置）"` |

**⑤ 判定**：通过

---

#### AC-40 从内置工作流生成项目工作流

- 判定：**通过**（核对 25/25 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch workflow create fork --name 分叉版 --from code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create fork --name 分叉版 --from code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=0 | 107ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=0 | 98ms
[orch workflow list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=0 | 109ms
[orch workflow create fork --name 另一个名字（不带 --force）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create fork --name 另一个名字   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=1 | 103ms
[orch workflow create fork --name 另一个名字 --force] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create fork --name 另一个名字 --force   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=0 | 113ms
[orch workflow validate fork --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate fork --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=0 | 101ms
[夹具：把 fork.yaml 换成不合法内容（node_type: script）] "(fixture) 把 fork.yaml 换成不合法内容（node_type: script）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow create fork --name 另一个名字 --force（待覆盖内容不合法）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create fork --name 另一个名字 --force   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-40 | exit=1 | 101ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-40.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch workflow create fork --name 分叉版 --from code-loop`
Then 回两行 `已创建项目工作流：.orch/workflows/fork.yaml` 与 `校验：通过`，退出 0；随后 `orch workflow validate` 首行 `校验工作流 4 个：全部通过`
机检：生成文件含 `schema: workflow/v1`、`id: fork`、两个 `- id: T-00` 节点与三条边；`workflow list --format json` 的 `counts.project === 1`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-40.create.txt` | 70 B |
| `docs/iterations/iteration-6/evidence/AC-40.validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-40.fork.yaml.txt` | 392 B |
| `docs/iterations/iteration-6/evidence/AC-40.list-payload.json` | 759 B |
| `docs/iterations/iteration-6/evidence/AC-40.dup-no-force.txt` | 84 B |
| `docs/iterations/iteration-6/evidence/AC-40.force-ok.txt` | 70 B |
| `docs/iterations/iteration-6/evidence/AC-40.fork-after-force.yaml.txt` | 140 B |
| `docs/iterations/iteration-6/evidence/AC-40.validate-fork-payload.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-40.force-invalid.txt` | 137 B |
| `docs/iterations/iteration-6/evidence/AC-40.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-40.meta.json` | 1072 B |
| `docs/iterations/iteration-6/evidence/AC-40.output.json` | 11217 B |
| `docs/iterations/iteration-6/evidence/AC-40.status.txt` | 3464 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 恰好两行（期望 2） | ✅ | `2` |
| 3 | Then 第 1 行逐字（期望逐字 "已创建项目工作流：.orch/workflows/fork.yaml"） | ✅ | `"已创建项目工作流：.orch/workflows/fork.yaml"` |
| 4 | Then 第 2 行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 5 | Then validate 首行（期望逐字 "校验工作流 4 个：全部通过"） | ✅ | `"校验工作流 4 个：全部通过"` |
| 6 | Then validate 退出 0（期望 0） | ✅ | `0` |
| 7 | 机检：文件含 schema: workflow/v1（期望含 "schema: workflow/v1"） | ✅ | `schema: workflow/v1<br>id: fork<br>name: 分叉版<br>entry: T-001<br>terminal: T-002<br>nodes:<br>  - id: T-001<br>    node_type: role<br>    role: developer<br>    title: 开发<br>    max_rounds: 2<br>  - id: T-002<br>    node_type: role<br>    role: tester<br>    ti` |
| 8 | 机检：文件含 id: fork（期望匹配 /^id: fork$/m） | ✅ | `schema: workflow/v1<br>id: fork<br>name: 分叉版<br>entry: T-001<br>terminal: T-002<br>nodes:<br>  - id: T-001<br>    node_type: role<br>    role: developer<br>    title: 开发<br>    max_rounds: 2<br>  - id: T-002<br>    node_type: role<br>    role: tester<br>    ti` |
| 9 | 机检：两个 - id: T-00 节点（期望 2） | ✅ | `2` |
| 10 | 机检：三条边（期望 3） | ✅ | `3` |
| 11 | 机检：counts.project === 1（期望 1） | ✅ | `1` |
| 12 | Then 第一次退出码 1（期望 1） | ✅ | `1` |
| 13 | Then 第一次输出逐字（期望逐字 "已存在同名项目工作流：.orch/workflows/fork.yaml（加 --force 覆盖）"） | ✅ | `"已存在同名项目工作流：.orch/workflows/fork.yaml（加 --force 覆盖）"` |
| 14 | 机检：第一次后 grep -c 另一个名字 为 0（AC-40 机检逐字）（期望 0） | ✅ | `0` |
| 15 | 机检：第一次后文件不变（期望 "ddd3549c0a48cb3e3d180d6a0ee93fe7898f0254f2c18680cd10eccef834c625"） | ✅ | `"ddd3549c0a48cb3e3d180d6a0ee93fe7898f0254f2c18680cd10eccef834c625"` |
| 16 | Then 第二次退出码 0（期望 0） | ✅ | `0` |
| 17 | Then 第二次第 1 行逐字（期望逐字 "已创建项目工作流：.orch/workflows/fork.yaml"） | ✅ | `"已创建项目工作流：.orch/workflows/fork.yaml"` |
| 18 | Then 第二次第 2 行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 19 | 机检：第二次后 grep -c 另一个名字 为 1（AC-40 机检逐字；实测见 blockers D-3）（期望 1） | ✅ | `1` |
| 20 | 机检：第二次后 counts.invalid === 0（期望 0） | ✅ | `0` |
| 21 | Then 第三次退出码 1（期望 1） | ✅ | `1` |
| 22 | Then 第三次恰好一行（创建被拒：<明细>（<原因码>））（期望 1） | ✅ | `1` |
| 23 | Then 第三次句式 创建被拒：（期望含 "创建被拒："） | ✅ | `创建被拒：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）` |
| 24 | Then 第三次带原因码收尾（期望匹配 /（WORKFLOW_[A-Z_]+）$/） | ✅ | `创建被拒：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）` |
| 25 | 机检：第三次后目标文件 sha256 与覆盖前相同（期望 "d3cf60d64caad07d71ba3ea4937bb1029df7db4266a83883bc6a1d506e8e2d6c"） | ✅ | `"d3cf60d64caad07d71ba3ea4937bb1029df7db4266a83883bc6a1d506e8e2d6c"` |

**⑤ 判定**：通过

---

#### AC-41 预演不启动会话、不建实例（规划验收）

- 判定：**通过**（核对 8/8 通过）
- 验证面：边界
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-41`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow dry-run doc-fanout（第 1 次）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-41 | exit=0 | 133ms
[orch workflow dry-run doc-fanout（第 2 次）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-41 | exit=0 | 142ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-41.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，预置附录 A-13 的 `doc-fanout`，并记录执行前 `.orch` 的目录清单与 `sha256` 清单
When 我执行 `orch workflow dry-run doc-fanout`
Then 末行是 `结论：编排可执行，未启动任何会话`，退出码 0；执行后 `.orch` 下没有 `instances/`、没有 `core.json`，所有既有文件的 `sha256` 与执行前相同
机检：`test -e "$ROOT/.orch/instances"` 为假、`test -e "$ROOT/.orch/core.json"` 为假；`find "$ROOT/.orch" -type f -exec sha256sum {} +` 前后逐字相同；同一命令连续执行两次 stdout 逐字节相同
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-41.snapshot-before.json` | 185 B |
| `docs/iterations/iteration-6/evidence/AC-41.dry-run-1.txt` | 702 B |
| `docs/iterations/iteration-6/evidence/AC-41.dry-run-2.txt` | 702 B |
| `docs/iterations/iteration-6/evidence/AC-41.snapshot-after.json` | 185 B |
| `docs/iterations/iteration-6/evidence/AC-41.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-41.meta.json` | 927 B |
| `docs/iterations/iteration-6/evidence/AC-41.output.json` | 4636 B |
| `docs/iterations/iteration-6/evidence/AC-41.status.txt` | 2079 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 自检：执行前 .orch 里是工作流夹具（期望匹配 /workflows\/doc-fanout\.yaml/） | ✅ | `workflows/doc-fanout.yaml` |
| 2 | Then 退出码 0（期望 0） | ✅ | `0` |
| 3 | Then 末行逐字（期望逐字 "结论：编排可执行，未启动任何会话"） | ✅ | `"结论：编排可执行，未启动任何会话"` |
| 4 | 机检：test -e .orch/instances 为假 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-41\.orch\instances` |
| 5 | 机检：test -e .orch/core.json 为假 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-41\.orch\core.json` |
| 6 | 机检：.orch 快照前后逐字相同（含 sha256）（期望 {"workflows/doc-fanout.yaml":{"sha256":"bb9c048c546b4d4f9f12fba8d9b4db31df083be5eab71688b0f089c0da39fbf3","bytes":1202,"mtimeIso":"2026-11-09T12:23:10.717Z"}}） | ✅ | `{"workflows/doc-fanout.yaml":{"sha256":"bb9c048c546b4d4f9f12fba8d9b4db31df083be5eab71688b0f089c0da39fbf3","bytes":1202,"mtimeIso":"2026-11-09T12:23:10.717Z"}}` |
| 7 | 机检：两次 stdout 逐字节相同 | ✅ | `len1=424 len2=424` |
| 8 | 机检：第二次退出码同为 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-42 预演对不合法工作流直接拒绝

- 判定：**通过**（核对 8/8 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-42`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-13 的 doc-fanout（writeDocFanout）] "(fixture) 预置附录 A-13 的 doc-fanout（writeDocFanout）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[夹具：把 T-001 的 role 改成不存在的 ghost-role] "(fixture) 把 T-001 的 role 改成不存在的 ghost-role"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow dry-run doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-42 | exit=1 | 99ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-42.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 把附录 A-13 的 `T-001` 的 `role` 改成不存在的 `ghost-role`
When 我执行 `orch workflow dry-run doc-fanout`
Then 输出 `预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）` 与提示 `执行 orch workflow validate 查看全部问题`，退出码 1；没有任何编排计划行
机检：stdout 不含 `编排计划`；退出码 1；`.orch/instances` 不存在
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-42.dry-run.txt` | 130 B |
| `docs/iterations/iteration-6/evidence/AC-42.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-42.meta.json` | 816 B |
| `docs/iterations/iteration-6/evidence/AC-42.output.json` | 3061 B |
| `docs/iterations/iteration-6/evidence/AC-42.status.txt` | 695 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具自检：T-001 的 role 已改为 ghost-role | ✅ | `replace applied` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 恰好两行（期望 2） | ✅ | `2` |
| 4 | Then 第 1 行逐字（期望逐字 "预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）"） | ✅ | `"预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）"` |
| 5 | Then 第 2 行逐字（期望逐字 "执行 orch workflow validate 查看全部问题"） | ✅ | `"执行 orch workflow validate 查看全部问题"` |
| 6 | Then 没有任何编排计划行（期望不含 "编排计划"） | ✅ | `预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）<br>执行 orch workflow validate 查看全部问题<br>` |
| 7 | 机检：stdout 不含 编排计划（期望不含 "编排计划"） | ✅ | `预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）<br>执行 orch workflow validate 查看全部问题<br>` |
| 8 | 机检：.orch/instances 不存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-42\.orch\instances` |

**⑤ 判定**：通过

---

#### AC-43 用法块：25 行，前 8 行逐字不变

- 判定：**通过**（核对 7/7 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-43`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role bogus] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role bogus   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-43 | exit=2 | 96ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-43.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我执行 `orch role bogus`
Then 打印的用法块共 25 行，前 8 行与 I1.5 逐字相同（首行仍是 `用法：orch run|status|cancel|core`），第 9~25 行依次是 17 条新子命令；最后再追加一行 `  （未知的 role 子命令：bogus）`；退出码 2
机检：`USAGE_LINES.length === 25` 且 `USAGE_LINES.slice(0,8)` 与 I1.5 基线逐字相同；整块行数 26（25 + 原因行）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-43.usage.txt` | 1773 B |
| `docs/iterations/iteration-6/evidence/AC-43.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-43.meta.json` | 822 B |
| `docs/iterations/iteration-6/evidence/AC-43.output.json` | 8515 B |
| `docs/iterations/iteration-6/evidence/AC-43.status.txt` | 2155 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 2（期望 2） | ✅ | `2` |
| 2 | Then 整块行数 26（25 + 原因行）（期望 26） | ✅ | `26` |
| 3 | Then 原因行逐字（期望逐字 "  （未知的 role 子命令：bogus）"） | ✅ | `"  （未知的 role 子命令：bogus）"` |
| 4 | 机检：USAGE_LINES.length === 25（整块前 25 行逐字）（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号> | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 5 | 机检：USAGE_LINES.slice(0,8) 与 I1.5 基线逐字（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [ | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 6 | 机检：首行仍是 用法：orch run\|status\|cancel\|core（期望 "用法：orch run\|status\|cancel\|core"） | ✅ | `"用法：orch run\|status\|cancel\|core"` |
| 7 | 机检：第 9~25 行是 17 条新子命令（期望 17） | ✅ | `17` |

**⑤ 判定**：通过

---

#### AC-44 三族命令的用法错误矩阵

- 判定：**通过**（核对 62/62 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）；12 条命令依次执行] "(fixture) 全新项目根（无 .orch）；12 条命令依次执行"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role bogus] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role bogus   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 89ms
[orch skill bogus] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill bogus   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 95ms
[orch workflow bogus] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow bogus   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 104ms
[orch role list --nope] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list --nope   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 98ms
[orch skill list --nope] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill list --nope   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 85ms
[orch workflow list --nope] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list --nope   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 88ms
[orch skill show x --instance y] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill show x --instance y   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 85ms
[orch workflow list --group x] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list --group x   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 98ms
[orch role show x --group coding] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show x --group coding   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 89ms
[orch skill show（缺位置参数）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill show   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 89ms
[orch workflow show（缺位置参数）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 91ms
[orch role show（缺位置参数）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-44 | exit=2 | 97ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-44.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我对 `skill` / `workflow` / `role` 三族各执行四类错误：未知子命令（`skill bogus`、`workflow bogus`、`role bogus`）、未知参数（各加 `--nope`）、标志用错子命令（`skill show x --instance y`、`workflow list --group x`、`role show x --group coding`）、缺必填位置参数（`skill show`、`workflow show`、`role show`）
Then 十二次都是打印用法块 + 一行具体原因，退出码都是 2，且原因文案分别是 `未知的 <族> 子命令：bogus`、`未知参数：--nope`、`--<键> 不适用于 <族> <子命令>`，缺位置参数的三次分别是 `role show 需要角色 id`、`skill show 需要技能 id`、`workflow show 需要工作流 id`
机检：十二次退出码均为 2；`grep -c '（' ` 每条原因各出现一次；用法块行数恒为 25
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-44.role-bogus.txt` | 1773 B |
| `docs/iterations/iteration-6/evidence/AC-44.skill-bogus.txt` | 1774 B |
| `docs/iterations/iteration-6/evidence/AC-44.workflow-bogus.txt` | 1777 B |
| `docs/iterations/iteration-6/evidence/AC-44.role-list---nope.txt` | 1762 B |
| `docs/iterations/iteration-6/evidence/AC-44.skill-list---nope.txt` | 1762 B |
| `docs/iterations/iteration-6/evidence/AC-44.workflow-list---nope.txt` | 1762 B |
| `docs/iterations/iteration-6/evidence/AC-44.skill-show-x---instance-y.txt` | 1775 B |
| `docs/iterations/iteration-6/evidence/AC-44.workflow-list---group-x.txt` | 1775 B |
| `docs/iterations/iteration-6/evidence/AC-44.role-show-x---group-coding.txt` | 1771 B |
| `docs/iterations/iteration-6/evidence/AC-44.skill-show缺位置参数.txt` | 1767 B |
| `docs/iterations/iteration-6/evidence/AC-44.workflow-show缺位置参数.txt` | 1773 B |
| `docs/iterations/iteration-6/evidence/AC-44.role-show缺位置参数.txt` | 1766 B |
| `docs/iterations/iteration-6/evidence/AC-44.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-44.meta.json` | 1242 B |
| `docs/iterations/iteration-6/evidence/AC-44.output.json` | 82253 B |
| `docs/iterations/iteration-6/evidence/AC-44.status.txt` | 24129 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then role bogus 退出码 2（期望 2） | ✅ | `2` |
| 2 | Then role bogus 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 3 | Then role bogus 原因行逐字（期望逐字 "  （未知的 role 子命令：bogus）"） | ✅ | `"  （未知的 role 子命令：bogus）"` |
| 4 | 机检：role bogus 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 5 | 机检：role bogus 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]", | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 6 | Then skill bogus 退出码 2（期望 2） | ✅ | `2` |
| 7 | Then skill bogus 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 8 | Then skill bogus 原因行逐字（期望逐字 "  （未知的 skill 子命令：bogus）"） | ✅ | `"  （未知的 skill 子命令：bogus）"` |
| 9 | 机检：skill bogus 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 10 | 机检：skill bogus 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]" | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 11 | Then workflow bogus 退出码 2（期望 2） | ✅ | `2` |
| 12 | Then workflow bogus 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 13 | Then workflow bogus 原因行逐字（期望逐字 "  （未知的 workflow 子命令：bogus）"） | ✅ | `"  （未知的 workflow 子命令：bogus）"` |
| 14 | 机检：workflow bogus 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 15 | 机检：workflow bogus 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--event | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 16 | Then role list --nope 退出码 2（期望 2） | ✅ | `2` |
| 17 | Then role list --nope 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 18 | Then role list --nope 原因行逐字（期望逐字 "  （未知参数：--nope）"） | ✅ | `"  （未知参数：--nope）"` |
| 19 | 机检：role list --nope 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 20 | 机检：role list --nope 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--eve | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 21 | Then skill list --nope 退出码 2（期望 2） | ✅ | `2` |
| 22 | Then skill list --nope 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 23 | Then skill list --nope 原因行逐字（期望逐字 "  （未知参数：--nope）"） | ✅ | `"  （未知参数：--nope）"` |
| 24 | 机检：skill list --nope 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 25 | 机检：skill list --nope 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--ev | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 26 | Then workflow list --nope 退出码 2（期望 2） | ✅ | `2` |
| 27 | Then workflow list --nope 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 28 | Then workflow list --nope 原因行逐字（期望逐字 "  （未知参数：--nope）"） | ✅ | `"  （未知参数：--nope）"` |
| 29 | 机检：workflow list --nope 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 30 | 机检：workflow list --nope 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [- | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 31 | Then skill show x --instance y 退出码 2（期望 2） | ✅ | `2` |
| 32 | Then skill show x --instance y 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 33 | Then skill show x --instance y 原因行逐字（期望逐字 "  （--instance 不适用于 skill show）"） | ✅ | `"  （--instance 不适用于 skill show）"` |
| 34 | 机检：skill show x --instance y 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 35 | 机检：skill show x --instance y 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号 | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 36 | Then workflow list --group x 退出码 2（期望 2） | ✅ | `2` |
| 37 | Then workflow list --group x 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 38 | Then workflow list --group x 原因行逐字（期望逐字 "  （--group 不适用于 workflow list）"） | ✅ | `"  （--group 不适用于 workflow list）"` |
| 39 | 机检：workflow list --group x 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 40 | 机检：workflow list --group x 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 41 | Then role show x --group coding 退出码 2（期望 2） | ✅ | `2` |
| 42 | Then role show x --group coding 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 43 | Then role show x --group coding 原因行逐字（期望逐字 "  （--group 不适用于 role show）"） | ✅ | `"  （--group 不适用于 role show）"` |
| 44 | 机检：role show x --group coding 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 45 | 机检：role show x --group coding 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例 | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 46 | Then skill show（缺位置参数） 退出码 2（期望 2） | ✅ | `2` |
| 47 | Then skill show（缺位置参数） 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 48 | Then skill show（缺位置参数） 原因行逐字（期望逐字 "  （skill show 需要技能 id）"） | ✅ | `"  （skill show 需要技能 id）"` |
| 49 | 机检：skill show（缺位置参数） 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 50 | 机检：skill show（缺位置参数） 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--ev | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 51 | Then workflow show（缺位置参数） 退出码 2（期望 2） | ✅ | `2` |
| 52 | Then workflow show（缺位置参数） 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 53 | Then workflow show（缺位置参数） 原因行逐字（期望逐字 "  （workflow show 需要工作流 id）"） | ✅ | `"  （workflow show 需要工作流 id）"` |
| 54 | 机检：workflow show（缺位置参数） 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 55 | 机检：workflow show（缺位置参数） 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [- | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 56 | Then role show（缺位置参数） 退出码 2（期望 2） | ✅ | `2` |
| 57 | Then role show（缺位置参数） 用法块 25 行 + 原因行（期望 26） | ✅ | `26` |
| 58 | Then role show（缺位置参数） 原因行逐字（期望逐字 "  （role show 需要角色 id）"） | ✅ | `"  （role show 需要角色 id）"` |
| 59 | 机检：role show（缺位置参数） 含（的行恰 1 行且即原因行（期望 true） | ✅ | `true` |
| 60 | 机检：role show（缺位置参数） 前 25 行 = 用法块（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--eve | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 61 | 机检：十二次退出码均为 2 | ✅ | `12/2` |
| 62 | 机检：共 12 条命令（期望 12） | ✅ | `12` |

**⑤ 判定**：通过

---

#### AC-45 只读命令不建 `.orch`、不连核心

- 判定：**通过**（核对 4/4 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch role list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 93ms
[orch role show developer] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show developer   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 91ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 105ms
[orch skill list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 104ms
[orch skill show code-change] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill show code-change   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 106ms
[orch skill validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 102ms
[orch workflow list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 96ms
[orch workflow show code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 106ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 99ms
[orch workflow diff code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow diff code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-45 | exit=0 | 104ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-45.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根（无 `.orch`）
When 我依次执行 `role list`、`role show developer`、`role validate`、`skill list`、`skill show code-change`、`skill validate`、`workflow list`、`workflow show code-loop`、`workflow validate`、`workflow diff code-loop`（全部只读；`workflow diff` 对内置自比无差异）
Then 十条命令都退出 0 或 0/1（仅因资产不合法），项目根下 `.orch` 目录始终不存在，没有任何进程被拉起
机检：执行后 `test -e "$ROOT/.orch"` 为假；`assets/` 的 `sha256` 清单前后逐字相同
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-45.assets-manifest-before.txt` | 2355 B |
| `docs/iterations/iteration-6/evidence/AC-45.role-list.txt` | 1371 B |
| `docs/iterations/iteration-6/evidence/AC-45.role-show-developer.txt` | 275 B |
| `docs/iterations/iteration-6/evidence/AC-45.role-validate.txt` | 64 B |
| `docs/iterations/iteration-6/evidence/AC-45.skill-list.txt` | 596 B |
| `docs/iterations/iteration-6/evidence/AC-45.skill-show-code-change.txt` | 454 B |
| `docs/iterations/iteration-6/evidence/AC-45.skill-validate.txt` | 36 B |
| `docs/iterations/iteration-6/evidence/AC-45.workflow-list.txt` | 211 B |
| `docs/iterations/iteration-6/evidence/AC-45.workflow-show-code-loop.txt` | 347 B |
| `docs/iterations/iteration-6/evidence/AC-45.workflow-validate.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-45.workflow-diff-code-loop.txt` | 80 B |
| `docs/iterations/iteration-6/evidence/AC-45.summaries.txt` | 336 B |
| `docs/iterations/iteration-6/evidence/AC-45.assets-manifest-after.txt` | 2355 B |
| `docs/iterations/iteration-6/evidence/AC-45.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-45.meta.json` | 1409 B |
| `docs/iterations/iteration-6/evidence/AC-45.output.json` | 13864 B |
| `docs/iterations/iteration-6/evidence/AC-45.status.txt` | 5643 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 项目根下不存在 .orch（期望 false） | ✅ | `false` |
| 2 | Then 十条只读命令全部退出 0（Given 无坏资产，Then 的 0/1 档取严断 0） | ✅ | `role list: exit=0 lines=17；role show developer: exit=0 lines=6；role validate: exit=0 lines=1；skill list: exit=0 lines=11；skill show code-change: exit=0 lines=10；skill validate: exit=0 lines=1；workflow list: exit=0 lines=4；workflow show code-loop: exit=0 lines=` |
| 3 | 机检：执行后 test -e "$ROOT/.orch" 为假（期望 false） | ✅ | `false` |
| 4 | 机检：assets/** sha256 清单执行前后逐字相同（期望 "roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d8371ac4 | ✅ | `"roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d8371ac4cbd7becf84a\nroles/compliance-reviewer.yaml  f8877b9d2106b6c6166c45d2bcdce90ddcf728ab208546759` |

**⑤ 判定**：通过

**备注**

- 机检口径：assets/** 指仓库根 assets/（内置资产只读红线 BR-30/BR-01）；清单 = 递归相对路径 + sha256，执行前后逐字比对。

---

#### AC-46 写命令只写 `.orch`，内置资产一字不动

- 判定：**通过**（核对 20/20 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：写 fixtures/body.md（skill create 的 --body-file 夹具，验收侧自放、非产品落盘）] "(fixture) 写 fixtures/body.md（skill create 的 --body-file 夹具，验收侧自放、非产品落盘）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 108ms
[orch role create junior-dev --from lead-dev] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create junior-dev --from lead-dev   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 104ms
[orch role export lead-dev --out exports/lead-dev.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role export lead-dev --out exports/lead-dev.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 116ms
[orch role import exports/lead-dev.yaml --force] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import exports/lead-dev.yaml --force   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 117ms
[orch role edit junior-dev --set summary=协助开发] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit junior-dev --set summary=协助开发   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 105ms
[orch skill create note-taker --name 记录员 --summary 记录结论与可核对的出处 --applies-to writing --body-file fixtures/body.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create note-taker --name 记录员 --summary 记录结论与可核对的出处 --applies-to writing --body-file fixtures/body.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 119ms
[orch skill export code-change --out exports/code-change.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill export code-change --out exports/code-change.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 112ms
[orch skill import exports/code-change.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill import exports/code-change.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 105ms
[orch workflow create fork --name 分叉版 --from code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow create fork --name 分叉版 --from code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-46 | exit=0 | 126ms
[git status --porcelain assets] git status --porcelain assets   | cwd=d:\WWW\Maestro | exit=0 | 46ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-46.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根，执行前记录 `assets/` 的 `sha256` 清单
When 我依次执行 `role create`、`role create --from`、`role export --out`、`role import`、`role edit`、`skill create`、`skill export --out`、`skill import`、`workflow create`
Then 九条命令全部成功（退出 0），新增文件只出现在 `.orch/roles`、`.orch/skills`、`.orch/workflows` 与显式 `--out` 指定的目录里；`assets/` 的 `sha256` 清单前后逐字相同
机检：`find assets -type f -exec sha256sum {} +` 前后一致；`git status --porcelain assets` 为空；`test -e "$ROOT/.orch/core.json"` 为假（写命令不连核心）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-46.assets-manifest-before.txt` | 2355 B |
| `docs/iterations/iteration-6/evidence/AC-46.exits.txt` | 220 B |
| `docs/iterations/iteration-6/evidence/AC-46.role-create.txt` | 148 B |
| `docs/iterations/iteration-6/evidence/AC-46.role-create---from.txt` | 164 B |
| `docs/iterations/iteration-6/evidence/AC-46.role-export---out.txt` | 52 B |
| `docs/iterations/iteration-6/evidence/AC-46.role-import.txt` | 67 B |
| `docs/iterations/iteration-6/evidence/AC-46.role-edit.txt` | 213 B |
| `docs/iterations/iteration-6/evidence/AC-46.skill-create.txt` | 125 B |
| `docs/iterations/iteration-6/evidence/AC-46.skill-export---out.txt` | 56 B |
| `docs/iterations/iteration-6/evidence/AC-46.skill-import.txt` | 75 B |
| `docs/iterations/iteration-6/evidence/AC-46.workflow-create.txt` | 70 B |
| `docs/iterations/iteration-6/evidence/AC-46.touched-files.json` | 230 B |
| `docs/iterations/iteration-6/evidence/AC-46.assets-manifest-after.txt` | 2355 B |
| `docs/iterations/iteration-6/evidence/AC-46.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-46.meta.json` | 1665 B |
| `docs/iterations/iteration-6/evidence/AC-46.output.json` | 14880 B |
| `docs/iterations/iteration-6/evidence/AC-46.status.txt` | 4146 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then role create 退出 0（期望 0） | ✅ | `0` |
| 2 | Then role create --from 退出 0（期望 0） | ✅ | `0` |
| 3 | Then role export --out 退出 0（期望 0） | ✅ | `0` |
| 4 | Then role import 退出 0（期望 0） | ✅ | `0` |
| 5 | Then role edit 退出 0（期望 0） | ✅ | `0` |
| 6 | Then skill create 退出 0（期望 0） | ✅ | `0` |
| 7 | Then skill export --out 退出 0（期望 0） | ✅ | `0` |
| 8 | Then skill import 退出 0（期望 0） | ✅ | `0` |
| 9 | Then workflow create 退出 0（期望 0） | ✅ | `0` |
| 10 | Then 落点存在：.orch/roles/lead-dev.yaml | ✅ | `.orch/roles/lead-dev.yaml` |
| 11 | Then 落点存在：.orch/roles/junior-dev.yaml | ✅ | `.orch/roles/junior-dev.yaml` |
| 12 | Then 落点存在：.orch/skills/note-taker/SKILL.md | ✅ | `.orch/skills/note-taker/SKILL.md` |
| 13 | Then 落点存在：.orch/skills/code-change/SKILL.md | ✅ | `.orch/skills/code-change/SKILL.md` |
| 14 | Then 落点存在：.orch/workflows/fork.yaml | ✅ | `.orch/workflows/fork.yaml` |
| 15 | Then 落点存在：exports/lead-dev.yaml | ✅ | `exports/lead-dev.yaml` |
| 16 | Then 落点存在：exports/code-change.md | ✅ | `exports/code-change.md` |
| 17 | 机检：新增/变更文件全部落在 .orch/**、exports/** 与 fixtures/**（夹具）之内（期望 ""） | ✅ | `""` |
| 18 | 机检：assets/** sha256 清单前后逐字相同（期望 "roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d8371ac4cb | ✅ | `"roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d8371ac4cbd7becf84a\nroles/compliance-reviewer.yaml  f8877b9d2106b6c6166c45d2bcdce90ddcf728ab208546759` |
| 19 | 机检：git status --porcelain assets 为空（期望 ""） | ✅ | `""` |
| 20 | 机检：.orch/core.json 不存在（期望 false） | ✅ | `false` |

**⑤ 判定**：通过

**备注**

- fixtures/body.md 是验收夹具自放文件（skill create 的 --body-file），单独登记于「新增/变更文件」白名单；产品九条命令的落点全部在 .orch/** 与显式 --out 目录 exports/**。
- role import 用 --force：同一根里 exports/lead-dev.yaml 的 id（lead-dev）与第 1 条已建的项目角色重名，按 BR-08/09 --force 覆盖项目资产；内置 id 的只读拒绝由 AC-58 覆盖。

---

#### AC-47 工作流不能被 `orch run` 实例化（范围边界）

- 判定：**通过**（核对 7/7 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-47`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：写 .orch/workflows/doc-fanout.yaml（A-1 + 裁-15 的 T-001 wake_allow 行，见 _fixtures.mjs）] "(fixture) 写 .orch/workflows/doc-fanout.yaml（A-1 + 裁-15 的 T-001 wake_allow 行，见 _fixtures.mjs）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch run --cwd ./demo --task 写下说明 --template doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js run --cwd ./demo --task 写下说明 --template doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-47 | exit=1 | 102ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-47.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 项目里存在合法的项目工作流 `doc-fanout`
When 我执行 `orch run --cwd ./demo --task "写下说明" --template doc-fanout`
Then 输出 `未知模板：doc-fanout`，退出码 1；没有启动核心、没有建实例
机检：`.orch/instances` 不存在、`.orch/core.json` 不存在；`assets` 与 `.orch/workflows` 的文件字节不变
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-47.run.txt` | 27 B |
| `docs/iterations/iteration-6/evidence/AC-47.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-47.meta.json` | 830 B |
| `docs/iterations/iteration-6/evidence/AC-47.output.json` | 7527 B |
| `docs/iterations/iteration-6/evidence/AC-47.status.txt` | 587 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given doc-fanout.yaml 已写入 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-47\.orch\workflows\doc-fanout.yaml` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 输出 未知模板：doc-fanout（期望含 "未知模板：doc-fanout"） | ✅ | `未知模板：doc-fanout` |
| 4 | 机检：.orch/instances 不存在（期望 false） | ✅ | `false` |
| 5 | 机检：.orch/core.json 不存在（期望 false） | ✅ | `false` |
| 6 | 机检：assets/** 文件字节不变（sha256 清单前后一致）（期望 "roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d837 | ✅ | `"roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d8371ac4cbd7becf84a\nroles/compliance-reviewer.yaml  f8877b9d2106b6c6166c45d2bcdce90ddcf728ab208546759` |
| 7 | 机检：.orch/workflows 文件字节不变（快照前后一致）（期望 "{\"doc-fanout.yaml\":{\"sha256\":\"bb9c048c546b4d4f9f12fba8d9b4db31df083be5eab71688b0f089c0da39fbf3\",\"bytes\":1202,\"mtimeIso\":\"2026-11-09T12:23:24.814Z\"}}"） | ✅ | `"{\"doc-fanout.yaml\":{\"sha256\":\"bb9c048c546b4d4f9f12fba8d9b4db31df083be5eab71688b0f089c0da39fbf3\",\"bytes\":1202,\"mtimeIso\":\"2026-11-09T12:23:24.814Z\"}}"` |

**⑤ 判定**：通过

---

#### AC-48 I1.5 的 role 三命令逐字不变

- 判定：**通过**（核对 37/37 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch role list] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 112ms
[orch role show developer] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show developer   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 111ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 124ms
[orch role list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 105ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 108ms
[orch role show developer --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show developer --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 117ms
[role show researcher（当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show researcher   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 107ms
[role show researcher（0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48-baseline\bin\orch.js role show researcher   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 159ms
[role show researcher --format json（当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show researcher --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 126ms
[role show researcher --format json（0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48-baseline\bin\orch.js role show researcher --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 110ms
[role show writer（当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show writer   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 97ms
[role show writer（0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48-baseline\bin\orch.js role show writer   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 106ms
[role show writer --format json（当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show writer --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 91ms
[role show writer --format json（0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48-baseline\bin\orch.js role show writer --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48 | exit=0 | 126ms
[git ls-files assets/] git ls-files assets/   | cwd=d:\WWW\Maestro | exit=0 | 34ms
[node --test test/wp11/cli-role.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test --test-concurrency=4 test/wp11/cli-role.test.js   | cwd=d:\WWW\Maestro | exit=0 | 393ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-48.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个全新项目根
When 我依次执行 `role list`、`role show developer`、`role validate`、`role list --format json`、`role show developer --format json`、`role validate --format json`、`role show researcher`、`role show writer`、`role show researcher --format json`、`role show writer --format json`
Then 六条输出与 I1.5 收口提交 `0cd113b` 的同一条命令输出逐字节相同（唯一允许的差异是用法块所在命令的输出，本 AC 不涉及）
机检：六条输出分别与 `docs/iterations/iteration-5/evidence/` 中的基线文本做 `diff`，全部为空；`test/wp11/cli-role.test.js` 全绿
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-48.list.txt` | 1371 B |
| `docs/iterations/iteration-6/evidence/AC-48.diff-list.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-developer.txt` | 275 B |
| `docs/iterations/iteration-6/evidence/AC-48.diff-show-developer.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-48.validate.txt` | 64 B |
| `docs/iterations/iteration-6/evidence/AC-48.diff-validate.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-48.list-json.txt` | 6188 B |
| `docs/iterations/iteration-6/evidence/AC-48.diff-list-json.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-48.validate-json.txt` | 146 B |
| `docs/iterations/iteration-6/evidence/AC-48.diff-validate-json.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-developer-json.txt` | 382 B |
| `docs/iterations/iteration-6/evidence/AC-48.diff-show-developer-json.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-researcher.txt` | 269 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-researcher-baseline.txt` | 266 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-researcher-json.txt` | 376 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-researcher-json-baseline.txt` | 376 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-writer.txt` | 268 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-writer-baseline.txt` | 258 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-writer-json.txt` | 364 B |
| `docs/iterations/iteration-6/evidence/AC-48.show-writer-json-baseline.txt` | 364 B |
| `docs/iterations/iteration-6/evidence/AC-48.assets-diff.json` | 552 B |
| `docs/iterations/iteration-6/evidence/AC-48.cli-role-test-tap.txt` | 148 B |
| `docs/iterations/iteration-6/evidence/AC-48.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-48.meta.json` | 2099 B |
| `docs/iterations/iteration-6/evidence/AC-48.output.json` | 36937 B |
| `docs/iterations/iteration-6/evidence/AC-48.status.txt` | 21411 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 基线代码树挂载成功（git worktree 0cd113b）（期望 0） | ✅ | `0` |
| 2 | Given 基线树 bin/orch.js 存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48-baseline` |
| 3 | Then role list 退出 0（期望 0） | ✅ | `0` |
| 4 | Then role list 与 I1.5 基线（AC-01.list.txt）逐字节相同 | ✅ | `0 行差异：[]` |
| 5 | Then role show developer 退出 0（期望 0） | ✅ | `0` |
| 6 | Then role show developer 与 I1.5 基线（AC-02.show.txt）逐字节相同 | ✅ | `0 行差异：[]` |
| 7 | Then role validate 退出 0（期望 0） | ✅ | `0` |
| 8 | Then role validate 与 I1.5 基线（AC-12.validate.txt，全新根干净校验）逐字节相同 | ✅ | `0 行差异：[]` |
| 9 | Then role list --format json 退出 0（期望 0） | ✅ | `0` |
| 10 | Then role list --format json 与 I1.5 基线（AC-01.payload.json）逐字节相同 | ✅ | `0 行差异：[]` |
| 11 | Then role validate --format json 退出 0（期望 0） | ✅ | `0` |
| 12 | Then role validate --format json 与 I1.5 基线（AC-12.payload.json）逐字节相同 | ✅ | `0 行差异：[]` |
| 13 | Then role show developer --format json 退出 0（期望 0） | ✅ | `0` |
| 14 | Given I1.5 AC-45.output.json 里能抽到 show developer --format json 的 stdout | ✅ | `{<br>  "role": {<br>    "id": "developer",<br>    "name": "开发",<br>    "group": "coding",<br>  ` |
| 15 | Then role show developer --format json 与 I1.5 基线逐字节相同 | ✅ | `0 行差异：[]` |
| 16 | Then role show researcher 退出 0（期望 0） | ✅ | `0` |
| 17 | 机检：role show researcher 与 I1.5 基线恰好一行差异（唯一例外：可唤醒行）（期望 1） | ✅ | `1` |
| 18 | 机检：role show researcher 基线侧的可唤醒行是 D-7b 改动前的值（期望 "  可唤醒：—"） | ✅ | `"  可唤醒：—"` |
| 19 | Then role show researcher 的可唤醒行逐字（D-7b 新值）（期望逐字 "  可唤醒：writer"） | ✅ | `"  可唤醒：writer"` |
| 20 | Then role show researcher 其余行仍与 I1.5 逐字节相同（差异只有可唤醒行） | ✅ | `1 行差异：[{"i":4,"a":"  可唤醒：writer","b":"  可唤醒：—"}]` |
| 21 | Then role show researcher --format json 退出 0（期望 0） | ✅ | `0` |
| 22 | 机检：role show researcher --format json 与 I1.5 基线逐字节相同（toRoleJson 不含 wakeAllow，不受 D-7b 改动影响）（期望 "{\n  \"role\": {\n    \"id\": \"researcher\",\n    \"name\": \"研究员\",\n    \"group\": \"research\",\n     | ✅ | `"{\n  \"role\": {\n    \"id\": \"researcher\",\n    \"name\": \"研究员\",\n    \"group\": \"research\",\n    \"groupLabel\": \"研究分析\",\n    \"artifactType\": \"report\",\n    \"sideEffect\": \"write\",\n    \"skills\": [\n      \"research-brief\"\n    ],\n    \"m` |
| 23 | 机检：role show researcher 的 role 对象恰是 toRoleJson 的 10 键且不含 wake/wakeAllow（期望 ["artifactType","file","group","groupLabel","id","maxConcurrentSessions","name","sideEffect","skills","source"]） | ✅ | `["artifactType","file","group","groupLabel","id","maxConcurrentSessions","name","sideEffect","skills","source"]` |
| 24 | Then role show writer 退出 0（期望 0） | ✅ | `0` |
| 25 | 机检：role show writer 与 I1.5 基线恰好一行差异（唯一例外：可唤醒行）（期望 1） | ✅ | `1` |
| 26 | 机检：role show writer 基线侧的可唤醒行是 D-7b 改动前的值（期望 "  可唤醒：editor"） | ✅ | `"  可唤醒：editor"` |
| 27 | Then role show writer 的可唤醒行逐字（D-7b 新值）（期望逐字 "  可唤醒：editor, reviewer"） | ✅ | `"  可唤醒：editor, reviewer"` |
| 28 | Then role show writer 其余行仍与 I1.5 逐字节相同（差异只有可唤醒行） | ✅ | `1 行差异：[{"i":4,"a":"  可唤醒：editor, reviewer","b":"  可唤醒：editor"}]` |
| 29 | Then role show writer --format json 退出 0（期望 0） | ✅ | `0` |
| 30 | 机检：role show writer --format json 与 I1.5 基线逐字节相同（toRoleJson 不含 wakeAllow，不受 D-7b 改动影响）（期望 "{\n  \"role\": {\n    \"id\": \"writer\",\n    \"name\": \"撰写者\",\n    \"group\": \"writing\",\n    \"groupLa | ✅ | `"{\n  \"role\": {\n    \"id\": \"writer\",\n    \"name\": \"撰写者\",\n    \"group\": \"writing\",\n    \"groupLabel\": \"内容创作\",\n    \"artifactType\": \"document\",\n    \"sideEffect\": \"write\",\n    \"skills\": [\n      \"doc-draft\"\n    ],\n    \"maxConcur` |
| 31 | 机检：role show writer 的 role 对象恰是 toRoleJson 的 10 键且不含 wake/wakeAllow（期望 ["artifactType","file","group","groupLabel","id","maxConcurrentSessions","name","sideEffect","skills","source"]） | ✅ | `["artifactType","file","group","groupLabel","id","maxConcurrentSessions","name","sideEffect","skills","source"]` |
| 32 | 机检：assets/** 与 0cd113b 有差异的文件恰好两个（期望 "assets/roles/researcher.yaml,assets/roles/writer.yaml"） | ✅ | `"assets/roles/researcher.yaml,assets/roles/writer.yaml"` |
| 33 | 机检：researcher.yaml 差异逐字（wake_allow: [] → [writer]）（期望 {"removed":["wake_allow: []"],"added":["wake_allow: [writer]"]}） | ✅ | `{"removed":["wake_allow: []"],"added":["wake_allow: [writer]"]}` |
| 34 | 机检：writer.yaml 差异逐字（wake_allow: [editor] → [editor, reviewer]，基线为块列表）（期望 {"removed":["wake_allow:","  - editor"],"added":["wake_allow: [editor, reviewer]"]}） | ✅ | `{"removed":["wake_allow:","  - editor"],"added":["wake_allow: [editor, reviewer]"]}` |
| 35 | 机检：test/wp11/cli-role.test.js fail === 0（期望 0） | ✅ | `0` |
| 36 | 机检：test/wp11/cli-role.test.js 全绿（pass === tests 且 tests > 0） | ✅ | `tests=30 pass=30 fail=0` |
| 37 | And 收尾后没有残留的基线工作树 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-48-baseline` |

**⑤ 判定**：通过

**备注**

- 基线来源：① docs/iterations/iteration-5/evidence/ 存量证据（AC-01.list / AC-02.show / AC-12.validate 及对应 payload；AC-45.output.json 抽取 show developer --format json）；② 0cd113b 基线代码树（git worktree）现跑补齐 I1.5 证据缺失的内置 researcher/writer show 文本与三条 show --format json。切取规则：存量 .txt/.json 证据去掉尾随空行后逐行比对（diffLines，行首尾不改）。
- 基线工作树已移除（git worktree remove --force + prune），仓库工作区未被改动。

---

#### AC-49 三条主链逐字回归

- 判定：**通过**（核对 21/21 通过）
- 验证面：混合
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49`
- 实例：INST-001

**① 完整命令（逐条可复跑）**

```
[orch run（single，0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline\bin\orch.js run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md" --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49 | exit=0 | 679ms
[orch run（single，当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md" --host dsh   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49 | exit=0 | 541ms
[orch run（code-loop，0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49 --scenario pass   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline | exit=0 | 1269ms
[orch run（code-loop，当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49 --scenario pass   | cwd=d:\WWW\Maestro | exit=0 | 1246ms
[orch run（task-loop，0cd113b 基线树）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49 --scenario doc-pass   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline | exit=0 | 1693ms
[orch run（task-loop，当前 HEAD）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\test\fixtures\task-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49 --scenario doc-pass   | cwd=d:\WWW\Maestro | exit=0 | 1594ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-49.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 独立项目根（`%TEMP%/maestro-acc-p6/AC-49/`）+ 仓库内 mock ACP agent，`NODE_ENV=test`
When 依次跑 `single`、`code-loop`、`task-loop` 三条主链
Then 三条都是退出码 0，且终端输出在去掉「已运行 Ns」片段与 `HH:mm:ss` 时间戳后与 `0cd113b` 的基线逐字一致
夹具：`NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$ROOT" --scenario <内置场景>`（`task-loop` 用 `task-loop-driver.mjs`；`single` 用 `bin/orch.js run` 直跑）
机检：`sed -E 's/已运行 [0-9]+s//g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}//g'` 归一化后 `diff` 为空；`.mock/prompts/*.json` 的 `task` 文本与基线一致
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-49.single-current.txt` | 352 B |
| `docs/iterations/iteration-6/evidence/AC-49.single-baseline-tree.txt` | 352 B |
| `docs/iterations/iteration-6/evidence/AC-49.single-diff-vs-stored.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.single-diff-vs-stored-full.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.single-diff-baseline-tree-vs-stored.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.code-loop-current.txt` | 1315 B |
| `docs/iterations/iteration-6/evidence/AC-49.code-loop-baseline-tree.txt` | 1315 B |
| `docs/iterations/iteration-6/evidence/AC-49.code-loop-diff-vs-stored.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.code-loop-diff-vs-stored-full.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.code-loop-diff-baseline-tree-vs-stored.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.task-loop-current.txt` | 1134 B |
| `docs/iterations/iteration-6/evidence/AC-49.task-loop-baseline-tree.txt` | 1134 B |
| `docs/iterations/iteration-6/evidence/AC-49.task-loop-diff-vs-stored.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.task-loop-diff-vs-stored-full.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.task-loop-diff-baseline-tree-vs-stored.txt` | 16 B |
| `docs/iterations/iteration-6/evidence/AC-49.state.json` | 6807 B |
| `docs/iterations/iteration-6/evidence/AC-49.events.jsonl` | 8353 B |
| `docs/iterations/iteration-6/evidence/AC-49.meta.json` | 1924 B |
| `docs/iterations/iteration-6/evidence/AC-49.output.json` | 17650 B |
| `docs/iterations/iteration-6/evidence/AC-49.status.txt` | 7630 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 基线代码树挂载成功（git worktree 0cd113b）（期望 0） | ✅ | `0` |
| 2 | Given 基线树 bin/orch.js 与驱动存在 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline` |
| 3 | Then single 基线树退出码 0（期望 0） | ✅ | `0` |
| 4 | Then single 当前退出码 0（期望 0） | ✅ | `0` |
| 5 | 机检：single 归一化后与 I1.5 存量基线（AC-19.single-baseline.txt）diff 为空（输出主体） | ✅ | `0 行差异：[]` |
| 6 | 机检：single 归一化后与存量基线整输出 diff 为空（含驱动 JSON 行，路径/计时归一化） | ✅ | `0 行差异：[]` |
| 7 | 机检：single 0cd113b 树现跑输出与存量基线也 diff 为空（基线出处自证） | ✅ | `0 行差异：[]` |
| 8 | 机检：single 的 .mock/prompts task 文本与 0cd113b 基线一致（期望 []） | ✅ | `[]` |
| 9 | Then code-loop 基线树退出码 0（期望 0） | ✅ | `0` |
| 10 | Then code-loop 当前退出码 0（期望 0） | ✅ | `0` |
| 11 | 机检：code-loop 归一化后与 I1.5 存量基线（AC-19.code-loop-baseline.txt）diff 为空（输出主体） | ✅ | `0 行差异：[]` |
| 12 | 机检：code-loop 归一化后与存量基线整输出 diff 为空（含驱动 JSON 行，路径/计时归一化） | ✅ | `0 行差异：[]` |
| 13 | 机检：code-loop 0cd113b 树现跑输出与存量基线也 diff 为空（基线出处自证） | ✅ | `0 行差异：[]` |
| 14 | 机检：code-loop 的 .mock/prompts task 文本与 0cd113b 基线一致（期望 ["给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js","给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js\n\n完成后把结构化判定 | ✅ | `["给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js","给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js\n\n完成后把结构化判定写到 out/verdict.json：{\"verdict\":\"pass\"\|\"fail\",\"defects\":[{\"summary\":\"一句话缺陷\",\"evidence\":\"证据文件路径\"}]}` |
| 15 | Then task-loop 基线树退出码 0（期望 0） | ✅ | `0` |
| 16 | Then task-loop 当前退出码 0（期望 0） | ✅ | `0` |
| 17 | 机检：task-loop 归一化后与 I1.5 存量基线（AC-19.task-loop-baseline.txt）diff 为空（输出主体） | ✅ | `0 行差异：[]` |
| 18 | 机检：task-loop 归一化后与存量基线整输出 diff 为空（含驱动 JSON 行，路径/计时归一化） | ✅ | `0 行差异：[]` |
| 19 | 机检：task-loop 0cd113b 树现跑输出与存量基线也 diff 为空（基线出处自证） | ✅ | `0 行差异：[]` |
| 20 | 机检：task-loop 的 .mock/prompts task 文本与 0cd113b 基线一致（期望 ["写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md\n\n研究笔记：artifacts/reports/research-notes.v1.md\n写入路径：C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p6 | ✅ | `["写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md\n\n研究笔记：artifacts/reports/research-notes.v1.md\n写入路径：C:/Users/xuesh/AppData/Local/Temp/maestro-acc-p6/AC-49/.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md\n只交研究笔记，不写最终文档。","写一篇发布说明，覆盖背景、变更` |
| 21 | And 收尾后没有残留的基线工作树 | ✅ | `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-49-baseline` |

**⑤ 判定**：通过

**备注**

- 基线来源与切取规则见文件头注：I1.5 存量 AC-19 三份 baseline.txt（1490f6d 树产出、驱动零改动故代表 0cd113b）为需求点名基线；0cd113b 工作树现跑三链作交叉验证与 prompts 基线；归一化 = 需求两条（已运行 Ns、HH:mm:ss）+ 夹具侧两条（mock-sess 会话号、耗时 Ns）+ 剔除驱动收尾 JSON 行。
- 基线工作树已移除（git worktree remove --force + prune），仓库工作区未被改动。

---

#### AC-50 全量测试全绿且不低于 611

- 判定：**通过**（核对 6/6 通过）
- 验证面：机检
- 项目根：（无）
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[node --test --test-concurrency=4 test/**/*.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test --test-concurrency=4 test/**/*.test.js   | cwd=d:\WWW\Maestro | exit=0 | 15568ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-50.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 实现完成后的源码树
When 执行 `node --test --test-concurrency=4 "test//*.test.js"`
Then `fail === 0`、`pass === tests`、`tests >= 611`
机检：用下限断言 `fail === 0 && pass === tests && tests >= 611`，不写死条数；既有断言修改仅限附录 D-7 点名的两行
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-50.tap-tail.txt` | 273 B |
| `docs/iterations/iteration-6/evidence/AC-50.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-50.meta.json` | 834 B |
| `docs/iterations/iteration-6/evidence/AC-50.output.json` | 158938 B |
| `docs/iterations/iteration-6/evidence/AC-50.status.txt` | 152796 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：TAP 尾部 summary 行齐全（tests/pass/fail/cancelled/skipped） | ✅ | `  ...<br># Subtest: S-2 越界与绝对路径仍然一律拒绝<br>ok 769 - S-2 越界与绝对路径仍然一律拒绝<br>  ---<br>  duration_ms: 0.2871<br>  type: 'test'<br>  ...<br>1..769<br># tests 769<br># suites 0<br># pass 769<br># fail 0<br># cancelled 0<br># skipped 0<br># todo 0<br># duration_ms 15469` |
| 2 | 机检：fail === 0（期望 0） | ✅ | `0` |
| 3 | 机检：cancelled === 0（期望 0） | ✅ | `0` |
| 4 | 机检：pass === tests（期望 769） | ✅ | `769` |
| 5 | 机检：tests >= 611（下限断言，不写死条数） | ✅ | `tests=769` |
| 6 | Then 退出码 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

**备注**

- 整跑约几分钟：用例限时 600s，runCmd 超时 540s；TAP summary 取 stdout 尾部 `# tests / # pass / # fail` 行。

---

#### AC-51 架构纯净：无资产名、无游离中文

- 判定：**通过**（核对 11/11 通过）
- 验证面：架构检查
- 项目根：（无）
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\test\fixtures\purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check   | cwd=d:\WWW\Maestro | exit=0 | 93ms
[node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\test\fixtures\purity-check.mjs --dirs src/registry --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check   | cwd=d:\WWW\Maestro | exit=0 | 85ms
[node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\test\fixtures\purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check   | cwd=d:\WWW\Maestro | exit=0 | 93ms
[node -e "<D-9 第 4 条逐字脚本>"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe -e "const fs=require('fs'),p=require('path');const roots=['src/registry','src/cli/roles.js','src/cli/skills.js','src/cli/workflows.js'];const bad=[];const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(/[\\u4e00-\\u9fff]/.test(fs.readFileSync(d,'utf8')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join('\\n'));process.exit(1);}console.log('OK: no CJK');"   | cwd=d:\WWW\Maestro | exit=0 | 84ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-51.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 实现完成后的源码树
When 按下方「架构检查：」段给出的四条完整命令执行扫描（该段为附录 D-9 的逐字副本）
Then 四条命令都退出 0：前三条输出 `OK: 扫描 N 个文件…零命中`，第四条输出 `OK: no CJK`
架构检查：以下为附录 D-9 的 `$COMMON` / `$NOCOORD` 词表定义与四条完整命令的逐字副本（D-9 为唯一权威、不得改动），四条都必须退出 0：
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-51.purity-core.txt` | 445 B |
| `docs/iterations/iteration-6/evidence/AC-51.purity-registry.txt` | 424 B |
| `docs/iterations/iteration-6/evidence/AC-51.purity-cli.txt` | 481 B |
| `docs/iterations/iteration-6/evidence/AC-51.no-cjk.txt` | 12 B |
| `docs/iterations/iteration-6/evidence/AC-51.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-51.meta.json` | 1070 B |
| `docs/iterations/iteration-6/evidence/AC-51.output.json` | 8118 B |
| `docs/iterations/iteration-6/evidence/AC-51.status.txt` | 3883 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：$COMMON 恰 31 词（D-9「与 I1.5 完全相同的 31 词」）（期望 31） | ✅ | `31` |
| 2 | 机检：$NOCOORD 恰 30 词（去 coordinator）（期望 30） | ✅ | `30` |
| 3 | 机检：$NOCOORD 与 $COMMON 的差异恰是 coordinator（期望 "coordinator"） | ✅ | `"coordinator"` |
| 4 | Then 第 1 条退出 0（期望 0） | ✅ | `0` |
| 5 | Then 第 1 条输出 OK: 扫描 N 个文件…零命中（期望匹配 /^OK: 扫描 \d+ 个文件，.+零命中$/） | ✅ | `OK: 扫描 16 个文件，src/core, src/daemon 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, coordinator, arbiter, planner, summarizer, worker, data-analyst, fact-checker, editor, code-reviewer, compliance-reviewer, requirement-cl` |
| 6 | Then 第 2 条退出 0（期望 0） | ✅ | `0` |
| 7 | Then 第 2 条输出 OK: 扫描 N 个文件…零命中（期望匹配 /^OK: 扫描 \d+ 个文件，.+零命中$/） | ✅ | `OK: 扫描 11 个文件，src/registry 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, arbiter, planner, summarizer, worker, data-analyst, fact-checker, editor, code-reviewer, compliance-reviewer, requirement-clarifier, research-bri` |
| 8 | Then 第 3 条退出 0（期望 0） | ✅ | `0` |
| 9 | Then 第 3 条输出 OK: 扫描 N 个文件…零命中（期望匹配 /^OK: 扫描 \d+ 个文件，.+零命中$/） | ✅ | `OK: 扫描 3 个文件，src/cli/roles.js, src/cli/skills.js, src/cli/workflows.js 内 task-loop, researcher, writer, reviewer, 研究员, 撰写者, 审核者, code-loop, developer, tester, coordinator, arbiter, planner, summarizer, worker, data-analyst, fact-checker, editor, code-reviewer,` |
| 10 | Then 第 4 条退出 0（期望 0） | ✅ | `0` |
| 11 | Then 第 4 条输出逐字 OK: no CJK（期望 "OK: no CJK"） | ✅ | `"OK: no CJK"` |

**⑤ 判定**：通过

**备注**

- 四条命令为附录 D-9 逐字副本：1/3 条用 $COMMON（31 词），第 2 条用 $NOCOORD（30 词，去 coordinator）；第 4 条 node -e 的 JS 源逐字照抄、改经 argv 传入以规避 Windows shell 引号转义，扫描语义与词表不变。

---

#### AC-52 零运行时依赖

- 判定：**通过**（核对 3/3 通过）
- 验证面：架构检查
- 项目根：（无）
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"   | cwd=d:\WWW\Maestro | exit=0 | 88ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-52.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 实现完成后的 `package.json`
When 读取 `dependencies`
Then 键数量为 0
架构检查：`node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"` 输出必须是 `0`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-52.package-json.json` | 218 B |
| `docs/iterations/iteration-6/evidence/AC-52.node-e-out.txt` | 3 B |
| `docs/iterations/iteration-6/evidence/AC-52.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-52.meta.json` | 718 B |
| `docs/iterations/iteration-6/evidence/AC-52.output.json` | 1066 B |
| `docs/iterations/iteration-6/evidence/AC-52.status.txt` | 303 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then dependencies 键数量为 0（期望 0） | ✅ | `0` |
| 2 | 机检：架构检查命令退出 0（期望 0） | ✅ | `0` |
| 3 | 机检：架构检查命令输出必须是 0（逐字）（期望 "0"） | ✅ | `"0"` |

**⑤ 判定**：通过

---

#### AC-53 能力域 1 三项顺延落地：一次 role validate 全数报出且同文件多类各一行

- 判定：**通过**（核对 8/8 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-53`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置三份坏角色 c1/p1/d1 + 工作流 use-c.yaml（入口 T-001 引用 c1，没有任何边给它 brief）] "(fixture) 预置三份坏角色 c1/p1/d1 + 工作流 use-c.yaml（入口 T-001 引用 c1，没有任何边给它 brief）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-53 | exit=1 | 106ms
[orch role validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-53 | exit=1 | 97ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-53.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-53/`，无 `.orch`；命令面 AC，只读写项目资产与终端输出，不注入 `NODE_ENV=test`），预置三份坏角色与一条工作流：`c.yaml`（`inputs: [brief]`，被 `.orch/workflows/use-c.yaml` 的入口节点引用，但没有任何边给它 `brief`）、`p.yaml`（`side_effect: read` + `tools: [write]` + `wake_allow: [ghost]`）、`d.yaml`（`derived_from: d`）；三份文件都不缺必填键
When 我执行 `orch role validate`，再执行 `orch role validate --format json`
Then 错误行恰好四条：`- roles/c.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）`、`- roles/p.yaml：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）`、`- roles/p.yaml：唤醒白名单里的角色不存在：ghost（ROLE_WAKE_UNKNOWN）`、`- roles/d.yaml：派生链成环：d（ROLE_DERIVE_CYCLE）`，退出码 1；同一文件（`p.yaml`）多类问题各一行、互不吞并，谁先被报由 C-08 的检查顺序固定；命令名、首行文案、计数口径与 I1.5 完全一致
机检：`node "$REPO/bin/orch.js" role validate --format json` 的 `errors.map(e => e.code)` 排序后等于 `['ROLE_CONTRACT_UNBOUND','ROLE_DERIVE_CYCLE','ROLE_PERMISSION_MISMATCH','ROLE_WAKE_UNKNOWN']`、`errors.filter(e => e.file === 'roles/p.yaml').length === 2`、`counts.invalid === 3`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-53.validate-text.txt` | 374 B |
| `docs/iterations/iteration-6/evidence/AC-53.payload.json` | 988 B |
| `docs/iterations/iteration-6/evidence/AC-53.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-53.meta.json` | 1288 B |
| `docs/iterations/iteration-6/evidence/AC-53.output.json` | 5338 B |
| `docs/iterations/iteration-6/evidence/AC-53.status.txt` | 2097 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 首行（计数口径与 I1.5 一致：16 角色 + 10 技能 + 3 坏文件）（期望逐字 "校验资产 29 个：3 个不合法"） | ✅ | `"校验资产 29 个：3 个不合法"` |
| 3 | Then 错误行恰好四条且逐字（同文件 p.yaml 多类各一行、顺序由 C-08 固定）（期望 ["- roles/c1.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）","- roles/d1.yaml：派生链成环：d1（ROLE_DERIVE_CYCLE）","- roles/p1.yaml：副作用等级为 read 的角色不能带写工具 write（R | ✅ | `["- roles/c1.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）","- roles/d1.yaml：派生链成环：d1（ROLE_DERIVE_CYCLE）","- roles/p1.yaml：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）","- roles/p1.yaml：唤醒白名单里的角色不存在：ghost（ROLE_WAKE_UNKNOWN）"]` |
| 4 | Then 输出恰为首行 + 四条错误行（期望 5） | ✅ | `5` |
| 5 | 机检：errors.map(code) 排序后与四个原因码逐字相同（期望 ["ROLE_CONTRACT_UNBOUND","ROLE_DERIVE_CYCLE","ROLE_PERMISSION_MISMATCH","ROLE_WAKE_UNKNOWN"]） | ✅ | `["ROLE_CONTRACT_UNBOUND","ROLE_DERIVE_CYCLE","ROLE_PERMISSION_MISMATCH","ROLE_WAKE_UNKNOWN"]` |
| 6 | 机检：errors.filter(file === roles/p1.yaml).length === 2（同文件两类各一行、互不吞并）（期望 2） | ✅ | `2` |
| 7 | 机检：counts.invalid === 3（期望 3） | ✅ | `3` |
| 8 | 机检：counts.assets === 29（期望 29） | ✅ | `29` |

**⑤ 判定**：通过

**备注**

- 裁-16a/R-12（AC-11 先例）：Given 的单字符 id 与 C-01 互斥，本用例按 2 字符 id（c1/p1/d1）取证，Then 的明细语义逐字不变。
- use-c 的 T-001 写节点级 wake_allow: [reviewer]（AC-11/AC-37 先例）：否则该工作流被 WAKE_DENIED 剔出 workflowMap，契约连通检查看不到 c1 的引用、ROLE_CONTRACT_UNBOUND 造不出来。

---

#### AC-54 role create 四个必填参数取值非法是用法错误、不建文件

- 判定：**通过**（核对 19/19 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-54`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：全新项目根（无 .orch）] "(fixture) 全新项目根（无 .orch）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role create lead-dev --group nope …] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group nope --artifact-type code --side-effect write   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-54 | exit=2 | 87ms
[orch role create lead-dev --artifact-type doc …] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type doc --side-effect write   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-54 | exit=2 | 86ms
[orch role create lead-dev --side-effect heavy …] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect heavy   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-54 | exit=2 | 102ms
[orch role bogus] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role bogus   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-54 | exit=2 | 95ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-54.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-54/`，无 `.orch`）
When 我依次执行 `orch role create lead-dev --name 首席开发 --group nope --artifact-type code --side-effect write`、`orch role create lead-dev --name 首席开发 --group coding --artifact-type doc --side-effect write`、`orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect heavy`
Then 三次都打印 25 行用法块并各追加一行 `  （<原因>）`（A-12 的用法错误句式，合计 26 行），其中 `--group` 那条逐字为 `  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）`，另两条同句式、各自列出合法取值；三次退出码都是 2，且都没有建文件
机检：三次退出码均为 2；`test -e "$ROOT/.orch"` 为假；`node "$REPO/bin/orch.js" role bogus` 输出的用法块行数恒为 25
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-54.orch-role-create-lead-dev---group-nope-….txt` | 1839 B |
| `docs/iterations/iteration-6/evidence/AC-54.orch-role-create-lead-dev---artifact-type-doc-….txt` | 1811 B |
| `docs/iterations/iteration-6/evidence/AC-54.orch-role-create-lead-dev---side-effect-heavy-….txt` | 1801 B |
| `docs/iterations/iteration-6/evidence/AC-54.role-bogus.txt` | 1773 B |
| `docs/iterations/iteration-6/evidence/AC-54.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-54.meta.json` | 1053 B |
| `docs/iterations/iteration-6/evidence/AC-54.output.json` | 29050 B |
| `docs/iterations/iteration-6/evidence/AC-54.status.txt` | 8569 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then orch role create lead-dev --group nope … 退出码 2（期望 2） | ✅ | `2` |
| 2 | Then orch role create lead-dev --group nope … 整块行数 26（25 + 原因行）（期望 26） | ✅ | `26` |
| 3 | Then orch role create lead-dev --group nope … 前 25 行为 A-12 用法块逐字（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch  | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 4 | Then orch role create lead-dev --group nope … 原因行逐字（期望逐字 "  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）"） | ✅ | `"  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）"` |
| 5 | Then orch role create lead-dev --group nope … 后 test -e "$ROOT/.orch" 为假（期望 false） | ✅ | `false` |
| 6 | Then orch role create lead-dev --artifact-type doc … 退出码 2（期望 2） | ✅ | `2` |
| 7 | Then orch role create lead-dev --artifact-type doc … 整块行数 26（25 + 原因行）（期望 26） | ✅ | `26` |
| 8 | Then orch role create lead-dev --artifact-type doc … 前 25 行为 A-12 用法块逐字（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]"," | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 9 | Then orch role create lead-dev --artifact-type doc … 原因行逐字（期望逐字 "  （role create 的 --artifact-type 只接受 code/document/dataset/report）"） | ✅ | `"  （role create 的 --artifact-type 只接受 code/document/dataset/report）"` |
| 10 | Then orch role create lead-dev --artifact-type doc … 后 test -e "$ROOT/.orch" 为假（期望 false） | ✅ | `false` |
| 11 | Then orch role create lead-dev --side-effect heavy … 退出码 2（期望 2） | ✅ | `2` |
| 12 | Then orch role create lead-dev --side-effect heavy … 整块行数 26（25 + 原因行）（期望 26） | ✅ | `26` |
| 13 | Then orch role create lead-dev --side-effect heavy … 前 25 行为 A-12 用法块逐字（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]"," | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 14 | Then orch role create lead-dev --side-effect heavy … 原因行逐字（期望逐字 "  （role create 的 --side-effect 只接受 none/read/write/exec）"） | ✅ | `"  （role create 的 --side-effect 只接受 none/read/write/exec）"` |
| 15 | Then orch role create lead-dev --side-effect heavy … 后 test -e "$ROOT/.orch" 为假（期望 false） | ✅ | `false` |
| 16 | 机检：--group 原因行逐字（需求原文）（期望逐字 "  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）"） | ✅ | `"  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）"` |
| 17 | 机检：orch role bogus 输出的用法块行数恒为 25（前 25 行逐字）（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例 | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 18 | 机检：orch role bogus 整块仍为 25 行用法块 + 1 行原因（期望 26） | ✅ | `26` |
| 19 | 机检：orch role bogus 后 .orch 仍不存在（期望 false） | ✅ | `false` |

**⑤ 判定**：通过

---

#### AC-55 导入非角色文件被拒且不落盘

- 判定：**通过**（核对 10/10 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-55`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 not-role.yaml（缺 schema）与 wrong-schema.yaml（schema: workflow/v1）] "(fixture) 预置 not-role.yaml（缺 schema）与 wrong-schema.yaml（schema: workflow/v1）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role import not-role.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import not-role.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-55 | exit=1 | 100ms
[orch role import wrong-schema.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import wrong-schema.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-55 | exit=1 | 92ms
[orch role list --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role list --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-55 | exit=0 | 112ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-55.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-55/`，无 `.orch`），预置 `not-role.yaml`（缺 `schema` 的一段 YAML）与 `wrong-schema.yaml`（`schema: workflow/v1`）
When 我执行 `orch role import not-role.yaml`，再执行 `orch role import wrong-schema.yaml`
Then 两次都只回一行 `导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）`，退出码都是 1；`import` 只装单个文件，两次都没有在 `.orch/roles/` 下留下任何文件
机检：两次退出码 1；`test -e "$ROOT/.orch/roles/not-role.yaml"` 与 `test -e "$ROOT/.orch/roles/wrong-schema.yaml"` 都为假；`node "$REPO/bin/orch.js" role list --format json` 的 `counts.total === 16`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-55.import-not-role.txt` | 69 B |
| `docs/iterations/iteration-6/evidence/AC-55.import-wrong-schema.txt` | 69 B |
| `docs/iterations/iteration-6/evidence/AC-55.role-list-payload.json` | 6187 B |
| `docs/iterations/iteration-6/evidence/AC-55.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-55.meta.json` | 898 B |
| `docs/iterations/iteration-6/evidence/AC-55.output.json` | 11033 B |
| `docs/iterations/iteration-6/evidence/AC-55.status.txt` | 7261 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then not-role.yaml 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then not-role.yaml 只回一行（期望 1） | ✅ | `1` |
| 3 | Then not-role.yaml 拒绝行逐字（期望逐字 "导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）"） | ✅ | `"导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）"` |
| 4 | Then wrong-schema.yaml 退出码 1（期望 1） | ✅ | `1` |
| 5 | Then wrong-schema.yaml 只回一行（期望 1） | ✅ | `1` |
| 6 | Then wrong-schema.yaml 拒绝行逐字（期望逐字 "导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）"） | ✅ | `"导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）"` |
| 7 | 机检：test -e "$ROOT/.orch/roles/not-role.yaml" 为假（期望 false） | ✅ | `false` |
| 8 | 机检：test -e "$ROOT/.orch/roles/wrong-schema.yaml" 为假（期望 false） | ✅ | `false` |
| 9 | 机检：.orch/roles/ 下没有留下任何文件（期望 []） | ✅ | `[]` |
| 10 | 机检：role list 的 counts.total === 16（import 只装单个文件，注册表仍是内置 16 角色）（期望 16） | ✅ | `16` |

**⑤ 判定**：通过

---

#### AC-56 role edit 的 --set / --unset 用法错误不改动文件

- 判定：**通过**（核对 22/22 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-56`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch role create lead-dev …] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-56 | exit=0 | 108ms
[orch role edit lead-dev --set nope=1] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit lead-dev --set nope=1   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-56 | exit=2 | 103ms
[orch role edit lead-dev --unset name] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit lead-dev --unset name   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-56 | exit=2 | 101ms
[orch role edit lead-dev --set artifact_type=document --unset summary] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit lead-dev --set artifact_type=document --unset summary   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-56 | exit=0 | 106ms
[orch role show lead-dev] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role show lead-dev   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-56 | exit=0 | 98ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-56.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-56/`，无 `.orch`），先执行 `orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run` 建出 `lead-dev`（三条路径产出的都是普通项目角色文件，`edit` 对它一视同仁）
When 我依次执行 `orch role edit lead-dev --set nope=1`、`orch role edit lead-dev --unset name`、`orch role edit lead-dev --set artifact_type=document --unset summary`
Then 第一次打印用法块并追加 `  （未知字段：nope）`、退出码 2、文件内容不变；第二次追加 `  （role edit 不能删除必填字段：name）`、退出码 2、文件内容不变；第三次成功、退出 0，回四行（含 `（已按规范格式重写，注释不保留）`），`orch role show lead-dev` 的产物类型变 `document`、职责行变空
机检：前两次退出码 2、`grep -c 'nope:' "$ROOT/.orch/roles/lead-dev.yaml"` 为 0；第三次后 `grep -c 'artifact_type: document' "$ROOT/.orch/roles/lead-dev.yaml"` 为 1、`grep -c 'summary:'` 为 0
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-56.edit-set-nope.txt` | 1760 B |
| `docs/iterations/iteration-6/evidence/AC-56.edit-unset-name.txt` | 1782 B |
| `docs/iterations/iteration-6/evidence/AC-56.edit-success.txt` | 201 B |
| `docs/iterations/iteration-6/evidence/AC-56.show-after.txt` | 208 B |
| `docs/iterations/iteration-6/evidence/AC-56.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-56.meta.json` | 938 B |
| `docs/iterations/iteration-6/evidence/AC-56.output.json` | 15502 B |
| `docs/iterations/iteration-6/evidence/AC-56.status.txt` | 5458 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given role create lead-dev 退出码 0（期望 0） | ✅ | `0` |
| 2 | Given lead-dev.yaml 已落盘 | ✅ | `read ok` |
| 3 | Then --set nope=1 退出码 2（期望 2） | ✅ | `2` |
| 4 | Then --set nope=1 整块行数 26（25 行用法块 + 原因行）（期望 26） | ✅ | `26` |
| 5 | Then --set nope=1 前 25 行为 A-12 用法块逐字（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [- | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 6 | Then --set nope=1 原因行逐字（期望逐字 "  （未知字段：nope）"） | ✅ | `"  （未知字段：nope）"` |
| 7 | Then --set nope=1 文件内容不变（期望 "schema: role/v1\nid: lead-dev\nname: 首席开发\ngroup: coding\nsummary : ''\nartifact_type: code\nside_effect: write\nskills: [code-change, test-run]\nmax_concurrent_sessions:  | ✅ | `"schema: role/v1\nid: lead-dev\nname: 首席开发\ngroup: coding\nsummary : ''\nartifact_type: code\nside_effect: write\nskills: [code-change, test-run]\nmax_concurrent_sessions: 1\n"` |
| 8 | Then --unset name 退出码 2（期望 2） | ✅ | `2` |
| 9 | Then --unset name 原因行逐字（期望逐字 "  （role edit 不能删除必填字段：name）"） | ✅ | `"  （role edit 不能删除必填字段：name）"` |
| 10 | Then --unset name 文件内容不变（期望 "schema: role/v1\nid: lead-dev\nname: 首席开发\ngroup: coding\nsummary : ''\nartifact_type: code\nside_effect: write\nskills: [code-change, test-run]\nmax_concurrent_sessions:  | ✅ | `"schema: role/v1\nid: lead-dev\nname: 首席开发\ngroup: coding\nsummary : ''\nartifact_type: code\nside_effect: write\nskills: [code-change, test-run]\nmax_concurrent_sessions: 1\n"` |
| 11 | Then 第三次退出码 0（期望 0） | ✅ | `0` |
| 12 | Then 第三次回四行（期望 4） | ✅ | `4` |
| 13 | Then 第三次首行逐字（期望逐字 "已更新项目角色：.orch/roles/lead-dev.yaml"） | ✅ | `"已更新项目角色：.orch/roles/lead-dev.yaml"` |
| 14 | Then 第三次契约行逐字（A-3）（期望逐字 "- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1"） | ✅ | `"- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1"` |
| 15 | Then 第三次校验行逐字（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 16 | Then 第三次重写注记逐字（期望逐字 "（已按规范格式重写，注释不保留）"） | ✅ | `"（已按规范格式重写，注释不保留）"` |
| 17 | Then show 退出码 0（期望 0） | ✅ | `0` |
| 18 | Then show 契约行（产物类型 document）（期望逐字 "- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1"） | ✅ | `"- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1"` |
| 19 | Then show 职责行变空（冒号后无值，需求原文「职责行变空」）（期望逐字 "  职责："） | ✅ | `"  职责："` |
| 20 | 机检：grep -c 'nope:' 为 0（前两次未改动文件）（期望 0） | ✅ | `0` |
| 21 | 机检：grep -c 'artifact_type: document' 为 1（期望 1） | ✅ | `1` |
| 22 | 机检：grep -c 'summary:' 为 0（--unset summary 后键被删除）（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

---

#### AC-57 改不存在的角色与 diff 缺对比基线

- 判定：**通过**（核对 22/22 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-57`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 .orch/roles/my-role.yaml（除 name 外与 developer 逐字段相同）与 .orch/workflows/my-wf.yaml] "(fixture) 预置 .orch/roles/my-role.yaml（除 name 外与 developer 逐字段相同）与 .orch/workflows/my-wf.yaml"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role edit ghost-id --set summary=x] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role edit ghost-id --set summary=x   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-57 | exit=1 | 103ms
[orch role diff my-role] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role diff my-role   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-57 | exit=1 | 99ms
[orch workflow diff my-wf] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow diff my-wf   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-57 | exit=1 | 100ms
[orch role diff my-role --against developer] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role diff my-role --against developer   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-57 | exit=0 | 99ms
[orch role diff my-role --against developer --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role diff my-role --against developer --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-57 | exit=0 | 113ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-57.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-57/`，无 `.orch`），预置 `.orch/roles/my-role.yaml`（合法角色，id `my-role`，无同名内置角色）与 `.orch/workflows/my-wf.yaml`（合法工作流，id `my-wf`，无同名内置工作流）
When 我依次执行 `orch role edit ghost-id --set summary=x`、`orch role diff my-role`、`orch workflow diff my-wf`、`orch role diff my-role --against developer`
Then 第一次回 `找不到角色：ghost-id` 与 `可用角色：执行 orch role list 查看`、退出 1；第二、三次分别回 `缺少对比基线：my-role（用 --against 指定内置角色或文件）` 与 `缺少对比基线：my-wf（用 --against 指定内置工作流或文件）`、退出 1；第四次按 §2.4 / BR-11 的角色 `diff` 口径（忽略 `id`，`name` 与其余键全比，缺省键按缺省值比较）给出 `差异 N 项` 或 `无差异`、退出 0
机检：前三次退出码 1；`node "$REPO/bin/orch.js" role diff my-role --against developer --format json` 顶层键恰 `base`/`target`/`changes`，`changes` 中不存在 `field === 'id'` 的项；若 `changes` 中存在 `field === 'name'` 的项，其 `base` / `target` 值须分别等于内置 `developer` 资产与 `.orch/roles/my-role.yaml` 里的 `name` 字段（按附录 A-14 的 `changes[]` 四键结构核对，为净增的正向断言，只增不减）；且文本末行的 N 仍等于 `changes.length`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-57.edit-ghost.txt` | 72 B |
| `docs/iterations/iteration-6/evidence/AC-57.diff-role-nobaseline.txt` | 77 B |
| `docs/iterations/iteration-6/evidence/AC-57.diff-wf-nobaseline.txt` | 78 B |
| `docs/iterations/iteration-6/evidence/AC-57.diff-against-developer.txt` | 111 B |
| `docs/iterations/iteration-6/evidence/AC-57.diff-payload.json` | 184 B |
| `docs/iterations/iteration-6/evidence/AC-57.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-57.meta.json` | 971 B |
| `docs/iterations/iteration-6/evidence/AC-57.output.json` | 7664 B |
| `docs/iterations/iteration-6/evidence/AC-57.status.txt` | 2041 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 夹具自检：developer 与 my-role 的 name 均可读 | ✅ | `开发 / 我的角色` |
| 2 | Then ① 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then ① 首行逐字（期望逐字 "找不到角色：ghost-id"） | ✅ | `"找不到角色：ghost-id"` |
| 4 | Then ① 提示行逐字（期望逐字 "可用角色：执行 orch role list 查看"） | ✅ | `"可用角色：执行 orch role list 查看"` |
| 5 | Then ② 退出码 1（期望 1） | ✅ | `1` |
| 6 | Then ② 只回一行（期望 1） | ✅ | `1` |
| 7 | Then ② 逐字（期望逐字 "缺少对比基线：my-role（用 --against 指定内置角色或文件）"） | ✅ | `"缺少对比基线：my-role（用 --against 指定内置角色或文件）"` |
| 8 | Then ③ 退出码 1（期望 1） | ✅ | `1` |
| 9 | Then ③ 只回一行（期望 1） | ✅ | `1` |
| 10 | Then ③ 逐字（期望逐字 "缺少对比基线：my-wf（用 --against 指定内置工作流或文件）"） | ✅ | `"缺少对比基线：my-wf（用 --against 指定内置工作流或文件）"` |
| 11 | Then ④ 退出码 0（期望 0） | ✅ | `0` |
| 12 | Then ④ 首行逐字（A-5 句式）（期望逐字 "对比角色 my-role（项目）与基线 developer（内置）"） | ✅ | `"对比角色 my-role（项目）与基线 developer（内置）"` |
| 13 | Then ④ 恰一条差异行（期望 3） | ✅ | `3` |
| 14 | Then ④ 差异行逐字（期望逐字 "~ name：开发 → 我的角色"） | ✅ | `"~ name：开发 → 我的角色"` |
| 15 | Then ④ 末行为 差异 N 项 或 无差异（期望匹配 /^(差异 \d+ 项\|无差异)$/） | ✅ | `差异 1 项` |
| 16 | Then ④ 末行 N 与 changes.length 一致（期望 "差异 1 项"） | ✅ | `"差异 1 项"` |
| 17 | 机检：退出码 0（期望 0） | ✅ | `0` |
| 18 | 机检：顶层键恰 base/target/changes（期望 ["base","changes","target"]） | ✅ | `["base","changes","target"]` |
| 19 | 机检：changes 中不存在 field === id 的项（diff 忽略 id）（期望 false） | ✅ | `false` |
| 20 | 机检：changes[] 每项恰四键 field/kind/base/target（期望 ["base","field","kind","target"]） | ✅ | `["base","field","kind","target"]` |
| 21 | 机检：name 项 base 等于内置 developer 资产的 name 字段（期望 "开发"） | ✅ | `"开发"` |
| 22 | 机检：name 项 target 等于 my-role.yaml 的 name 字段（期望 "我的角色"） | ✅ | `"我的角色"` |

**⑤ 判定**：通过

---

#### AC-58 内置资产只读：导入 / 创建 / --force 都不动内置

- 判定：**通过**（核对 18/18 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-58`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 developer.yaml（id: developer 的合法角色文件）与项目技能 .orch/skills/quote/SKILL.md] "(fixture) 预置 developer.yaml（id: developer 的合法角色文件）与项目技能 .orch/skills/quote/SKILL.md"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch role import developer.yaml] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js role import developer.yaml   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-58 | exit=1 | 119ms
[orch skill create code-change --name 冒名 --summary 占位 --force] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create code-change --name 冒名 --summary 占位 --force   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-58 | exit=1 | 98ms
[orch skill create quote --name 冒名 --summary 占位] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote --name 冒名 --summary 占位   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-58 | exit=1 | 124ms
[orch skill create quote --name 冒名 --summary 占位 --force] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote --name 冒名 --summary 占位 --force   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-58 | exit=0 | 105ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-58.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-58/`，无 `.orch`），预置 `developer.yaml`（一份 `id: developer` 的合法角色文件）与项目技能 `.orch/skills/quote/SKILL.md`；执行前记录 `assets/` 的 `sha256` 清单
When 我依次执行 `orch role import developer.yaml`、`orch skill create code-change --name 冒名 --summary 占位 --force`、`orch skill create quote --name 冒名 --summary 占位`、`orch skill create quote --name 冒名 --summary 占位 --force`
Then 第一次回 `导入被拒：内置角色只读：developer（ASSET_READONLY）`、退出 1；第二次回 `创建被拒：内置技能只读：code-change（ASSET_READONLY）`、退出 1（`--force` 也不豁免内置）；第三次回 `已存在同名项目技能：.orch/skills/quote/SKILL.md（加 --force 覆盖）`、退出 1、文件不变；第四次成功、退出 0（契约行 + `校验：通过`），`--force` 只覆盖项目里的同名资产；四次后 `assets/` 一个字节都没变
机检：前三次退出码 1、第四次退出码 0；`git status --porcelain assets` 为空；`find assets -type f -exec sha256sum {} +` 前后逐字相同；第二次执行后 `test -e "$ROOT/.orch/skills/code-change/SKILL.md"` 为假
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-58.assets-manifest-before.txt` | 2355 B |
| `docs/iterations/iteration-6/evidence/AC-58.import-developer.txt` | 67 B |
| `docs/iterations/iteration-6/evidence/AC-58.create-builtin-force.txt` | 69 B |
| `docs/iterations/iteration-6/evidence/AC-58.create-project-exists.txt` | 83 B |
| `docs/iterations/iteration-6/evidence/AC-58.create-project-force.txt` | 103 B |
| `docs/iterations/iteration-6/evidence/AC-58.assets-manifest-after.txt` | 2355 B |
| `docs/iterations/iteration-6/evidence/AC-58.git-status-assets.txt` | 9 B |
| `docs/iterations/iteration-6/evidence/AC-58.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-58.meta.json` | 1078 B |
| `docs/iterations/iteration-6/evidence/AC-58.output.json` | 11604 B |
| `docs/iterations/iteration-6/evidence/AC-58.status.txt` | 1724 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 项目技能 quote 已落盘 | ✅ | `read ok` |
| 2 | Then ① 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then ① 只回一行（期望 1） | ✅ | `1` |
| 4 | Then ① 逐字（期望逐字 "导入被拒：内置角色只读：developer（ASSET_READONLY）"） | ✅ | `"导入被拒：内置角色只读：developer（ASSET_READONLY）"` |
| 5 | Then ② 退出码 1（期望 1） | ✅ | `1` |
| 6 | Then ② 只回一行（期望 1） | ✅ | `1` |
| 7 | Then ② 逐字（期望逐字 "创建被拒：内置技能只读：code-change（ASSET_READONLY）"） | ✅ | `"创建被拒：内置技能只读：code-change（ASSET_READONLY）"` |
| 8 | Then ③ 退出码 1（期望 1） | ✅ | `1` |
| 9 | Then ③ 只回一行（期望 1） | ✅ | `1` |
| 10 | Then ③ 逐字（期望逐字 "已存在同名项目技能：.orch/skills/quote/SKILL.md（加 --force 覆盖）"） | ✅ | `"已存在同名项目技能：.orch/skills/quote/SKILL.md（加 --force 覆盖）"` |
| 11 | Then ③ 文件不变（期望 "---\nschema: skill/v1\nid: quote\nname: 引用规范\nsummary: 给结论配上可核对的出处\napplies_to: [writing]\ncommands: []\n---\n\n### 工作方法\n\n1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。\n"） | ✅ | `"---\nschema: skill/v1\nid: quote\nname: 引用规范\nsummary: 给结论配上可核对的出处\napplies_to: [writing]\ncommands: []\n---\n\n### 工作方法\n\n1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。\n"` |
| 12 | Then ④ 退出码 0（期望 0） | ✅ | `0` |
| 13 | Then ④ 首行逐字（期望逐字 "已创建项目技能：.orch/skills/quote/SKILL.md"） | ✅ | `"已创建项目技能：.orch/skills/quote/SKILL.md"` |
| 14 | Then ④ 末行为 校验：通过（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 15 | 机检：assets/** sha256 清单执行前后逐字相同（四次后一个字节都没变）（期望 "roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db67 | ✅ | `"roles/arbiter.yaml  9bbd4e51c45d3ec8faccbffdf15198bb9ed521dea8647f9e9393b417b1bd0276\nroles/code-reviewer.yaml  89ccc6e011c442a9db10891b9db7d7e655f58db6723e4d8371ac4cbd7becf84a\nroles/compliance-reviewer.yaml  f8877b9d2106b6c6166c45d2bcdce90ddcf728ab208546759` |
| 16 | 机检：git status --porcelain assets 输出为空（期望 ""） | ✅ | `""` |
| 17 | 机检：第二次执行后 test -e "$ROOT/.orch/skills/code-change/SKILL.md" 为假（期望 false） | ✅ | `false` |
| 18 | 机检：--force 只覆盖项目里的同名资产（quote 正文已换成冒名内容）（期望 true） | ✅ | `true` |

**⑤ 判定**：通过

---

#### AC-59 skill create 的 --applies-to / --commands / --body-file 与取值错误口径

- 判定：**通过**（核对 22/22 通过）
- 验证面：用户可见
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 body.md（一段技能正文）与 empty.md（空文件）] "(fixture) 预置 body.md（一段技能正文）与 empty.md（空文件）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch skill create quote --name 引用规范 --summary … --applies-to writing,coding --commands "node --test" --body-file body.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing,coding --commands "node --test" --body-file body.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59 | exit=0 | 112ms
[orch skill show quote] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill show quote   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59 | exit=0 | 103ms
[orch skill create quote2 --name 坏组 --summary x --applies-to nope] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote2 --name 坏组 --summary x --applies-to nope   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59 | exit=2 | 106ms
[orch skill create quote3 --name 缺摘要 --body-file empty.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote3 --name 缺摘要 --body-file empty.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59 | exit=2 | 89ms
[orch skill create quote4 --name 空正文 --summary x --body-file empty.md] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill create quote4 --name 空正文 --summary x --body-file empty.md   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59 | exit=1 | 98ms
[orch skill validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js skill validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-59 | exit=0 | 108ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-59.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-59/`，无 `.orch`），预置 `body.md`（一段技能正文）与 `empty.md`（空文件）
When 我依次执行 `orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing,review --commands "node --test" --body-file body.md`、`orch skill create quote2 --name 坏组 --summary x --applies-to nope`、`orch skill create quote3 --name 缺摘要 --body-file empty.md`、`orch skill create quote4 --name 空正文 --summary x --body-file empty.md`
Then 第一次回 `已创建项目技能：.orch/skills/quote/SKILL.md` + 契约行 + `校验：通过`、退出 0，`orch skill show quote` 的「命令」行是 `node --test`、「适用」行含两个分组、正文是 `body.md` 的内容；第二次打印用法块 + 一行取值原因、退出 2、不建文件（取值非法属用法错误）；第三次打印用法块 + `  （skill create 需要 --summary）`、退出 2、不建文件；第四次回 `创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）`、退出 1、不建文件（资产问题退 1）
机检：第一次后 `grep -c 'node --test' "$ROOT/.orch/skills/quote/SKILL.md"` 为 1、`node "$REPO/bin/orch.js" skill validate --format json` 的 `counts.invalid === 0`；第二、三、四次退出码分别为 2 / 2 / 1，且 `test -e "$ROOT/.orch/skills/quote2/SKILL.md"`、`test -e "$ROOT/.orch/skills/quote3/SKILL.md"`、`test -e "$ROOT/.orch/skills/quote4/SKILL.md"` 都为假
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-59.create-quote.txt` | 132 B |
| `docs/iterations/iteration-6/evidence/AC-59.show-quote.txt` | 326 B |
| `docs/iterations/iteration-6/evidence/AC-59.create-badgroup.txt` | 1837 B |
| `docs/iterations/iteration-6/evidence/AC-59.create-nosummary.txt` | 1770 B |
| `docs/iterations/iteration-6/evidence/AC-59.create-emptybody.txt` | 66 B |
| `docs/iterations/iteration-6/evidence/AC-59.validate-payload.json` | 128 B |
| `docs/iterations/iteration-6/evidence/AC-59.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-59.meta.json` | 1348 B |
| `docs/iterations/iteration-6/evidence/AC-59.output.json` | 15805 B |
| `docs/iterations/iteration-6/evidence/AC-59.status.txt` | 6307 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then ① 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then ① 首行逐字（期望逐字 "已创建项目技能：.orch/skills/quote/SKILL.md"） | ✅ | `"已创建项目技能：.orch/skills/quote/SKILL.md"` |
| 3 | Then ① 末行为 校验：通过（期望逐字 "校验：通过"） | ✅ | `"校验：通过"` |
| 4 | Then ① 命令行逐字（期望逐字 "  命令：node --test"） | ✅ | `"  命令：node --test"` |
| 5 | Then ① 适用行含两个分组 | ✅ | `  适用：内容创作, 编码工程` |
| 6 | Then ① 正文是 body.md 的内容 | ✅ | `body content check` |
| 7 | Then ① 契约行的适用段有两个分组（期望 true） | ✅ | `true` |
| 8 | Then ② 退出码 2（期望 2） | ✅ | `2` |
| 9 | Then ② 用法块 + 一行取值原因（26 行）（期望 26） | ✅ | `26` |
| 10 | Then ② 前 25 行为 A-12 用法块逐字（期望 ["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]"," | ✅ | `["用法：orch run\|status\|cancel\|core","  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]","  orch status [--instance <实例号>] [--events]","  orch cancel --instance <实例号>","  orch core stop","  orch role list [--group <组>] [--ins` |
| 11 | Then ② 取值原因行逐字（既有原因码 SKILL_GROUP_INVALID，I1.5 口径）（期望逐字 "  （适用分组取值非法：nope；合法取值：coordinator / research / writing / coding / ops）"） | ✅ | `"  （适用分组取值非法：nope；合法取值：coordinator / research / writing / coding / ops）"` |
| 12 | Then ③ 退出码 2（期望 2） | ✅ | `2` |
| 13 | Then ③ 原因行逐字（期望逐字 "  （skill create 需要 --summary）"） | ✅ | `"  （skill create 需要 --summary）"` |
| 14 | Then ③ 整块仍为 26 行（期望 26） | ✅ | `26` |
| 15 | Then ④ 退出码 1（期望 1） | ✅ | `1` |
| 16 | Then ④ 只回一行（期望 1） | ✅ | `1` |
| 17 | Then ④ 逐字（期望逐字 "创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）"） | ✅ | `"创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）"` |
| 18 | 机检：quote2 不建文件（期望 false） | ✅ | `false` |
| 19 | 机检：quote3 不建文件（期望 false） | ✅ | `false` |
| 20 | 机检：quote4 不建文件（期望 false） | ✅ | `false` |
| 21 | 机检：grep -c 'node --test' 为 1（期望 1） | ✅ | `1` |
| 22 | 机检：skill validate 的 counts.invalid === 0（期望 0） | ✅ | `0` |

**⑤ 判定**：通过

**备注**

- 裁-17（需求侧 R-14）：When ① 的样例值勘误 writing,review → writing,coding（需求闭集互斥，见文件头注释），Then「适用行含两个分组」语义不变；依据 = AC-59 第二场景预设闭集存在 + AC-54/§2.2.1 五分组逐字文案 + I1.5 SKILL_GROUP_INVALID 基线。

---

#### AC-60 工作流校验器补充面：变量引用 / 状态转换 / 唤醒权限

- 判定：**通过**（核对 18/18 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置四条工作流 task-var / backflow-target / wake-empty / retest-ok + 源角色 r-src（wake_allow: []）；wake-empty 与 retest-ok 节点上都不补 wake_allow：forward 边才受白名单约束（retest 由核心回流触发、不受白名单约束），因此 retest-ok 只留一条 retest 边] "(fixture) 预置四条工作流 task-var / backflow-target / wake-empty / retest-ok + 源角色 r-src（wake_allow: []）；wake-empty 与 retest-ok 节点上都不补 wake_allow：forward 边才受白名单约束（retest 由核心回流触发、不受白名单约束），因此 retest-ok 只留一条 retest 边"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate task-var] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate task-var   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=0 | 108ms
[orch workflow validate task-var --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate task-var --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=0 | 110ms
[orch workflow validate backflow-target] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate backflow-target   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=1 | 104ms
[orch workflow validate backflow-target --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate backflow-target --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=1 | 102ms
[orch workflow validate wake-empty] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake-empty   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=1 | 104ms
[orch workflow validate wake-empty --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake-empty --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=1 | 107ms
[orch workflow validate retest-ok] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate retest-ok   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=0 | 105ms
[orch workflow validate retest-ok --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate retest-ok --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=0 | 120ms
[orch workflow validate backflow-target（复跑取文本）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate backflow-target   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=1 | 102ms
[orch workflow validate wake-empty（复跑取文本）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate wake-empty   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-60 | exit=1 | 101ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-60.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-60/`，无 `.orch`），预置四条工作流：`task-var.yaml`（映射 `from: task.brief`）、`backflow-target.yaml`（`kind: backflow` 指向 `human` 节点）、`wake-empty.yaml`（源角色 `wake_allow: []`，有一条 `forward` 边指向 `role` 节点）、`retest-ok.yaml`（`kind: retest` 指向 `role` 节点，白名单为空）
When 我依次执行 `orch workflow validate task-var`、`orch workflow validate backflow-target`、`orch workflow validate wake-empty`、`orch workflow validate retest-ok`
Then 第一次 `校验工作流 1 个：全部通过`（`task.<字段>` 作任务输入恒合法，字段映射完整）；第二次报 `WORKFLOW_TRANSITION_ILLEGAL`、明细为 `{node} 不能成为回流目标`；第三次报 `WORKFLOW_WAKE_DENIED`（`wake_allow: []` = 不允许主动唤醒任何角色）；第四次 `校验工作流 1 个：全部通过`（`backflow` / `retest` 由核心回流触发、不受白名单约束，但目标必须是 `role` 节点）
机检：四次 `counts.invalid` 分别为 `0` / `1` / `1` / `0`；第二次 `errors[0].code === 'WORKFLOW_TRANSITION_ILLEGAL'`、`errors[0].detail` 含 `回流目标`；第三次 `errors[0].code === 'WORKFLOW_WAKE_DENIED'`、`errors[0].detail` 含 `白名单`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-60.validate-task-var.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-60.payload-task-var.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-60.validate-backflow-target.txt` | 137 B |
| `docs/iterations/iteration-6/evidence/AC-60.payload-backflow-target.json` | 331 B |
| `docs/iterations/iteration-6/evidence/AC-60.validate-wake-empty.txt` | 143 B |
| `docs/iterations/iteration-6/evidence/AC-60.payload-wake-empty.json` | 337 B |
| `docs/iterations/iteration-6/evidence/AC-60.validate-retest-ok.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-60.payload-retest-ok.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-60.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-60.meta.json` | 1126 B |
| `docs/iterations/iteration-6/evidence/AC-60.output.json` | 10875 B |
| `docs/iterations/iteration-6/evidence/AC-60.status.txt` | 4777 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 第一次（task-var）退出码 0（期望 0） | ✅ | `0` |
| 2 | Then 第一次（task-var）首行逐字（期望逐字 "校验工作流 1 个：全部通过"） | ✅ | `"校验工作流 1 个：全部通过"` |
| 3 | 机检：task-var counts.invalid === 0（期望 0） | ✅ | `0` |
| 4 | Then 第二次（backflow-target）退出码 1（期望 1） | ✅ | `1` |
| 5 | 机检：backflow-target counts.invalid === 1（期望 1） | ✅ | `1` |
| 6 | 机检：backflow-target errors[0].code（期望 "WORKFLOW_TRANSITION_ILLEGAL"） | ✅ | `"WORKFLOW_TRANSITION_ILLEGAL"` |
| 7 | Then 第三次（wake-empty）退出码 1（期望 1） | ✅ | `1` |
| 8 | 机检：wake-empty counts.invalid === 1（期望 1） | ✅ | `1` |
| 9 | 机检：wake-empty errors[0].code（期望 "WORKFLOW_WAKE_DENIED"） | ✅ | `"WORKFLOW_WAKE_DENIED"` |
| 10 | Then 第四次（retest-ok）退出码 0（期望 0） | ✅ | `0` |
| 11 | Then 第四次（retest-ok）首行逐字（期望逐字 "校验工作流 1 个：全部通过"） | ✅ | `"校验工作流 1 个：全部通过"` |
| 12 | 机检：retest-ok counts.invalid === 0（期望 0） | ✅ | `0` |
| 13 | Then 第二次明细为 {node} 不能成为回流目标（含 回流目标）（期望 true） | ✅ | `true` |
| 14 | 机检：backflow-target errors[0].detail 含 回流目标（期望含 "回流目标"） | ✅ | `T-H 不能成为回流目标` |
| 15 | Then 第三次报 WORKFLOW_WAKE_DENIED（wake_allow: [] = 不允许主动唤醒任何角色）（期望 true） | ✅ | `true` |
| 16 | 机检：wake-empty errors[0].detail 含 白名单（期望含 "白名单"） | ✅ | `唤醒不在白名单内：r-src → developer` |
| 17 | 机检：wake-empty 明细为 唤醒不在白名单内：r-src → developer（期望 "唤醒不在白名单内：r-src → developer"） | ✅ | `"唤醒不在白名单内：r-src → developer"` |
| 18 | 机检：retest-ok 的 errors 为空（期望 []） | ✅ | `[]` |

**⑤ 判定**：通过

---

#### AC-61 三条内置工作流回归门禁：invalid=0，资产被改坏时先红

- 判定：**通过**（核对 21/21 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-61`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-61 | exit=0 | 105ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-61 | exit=0 | 100ms
[orch workflow validate（writer wake_allow 改回 [editor] 后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-61 | exit=1 | 107ms
[orch workflow validate --format json（writer 改坏后）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-61 | exit=1 | 96ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-61.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-61/`，无 `.orch`，只有内置三图），对齐后的 `assets/roles/researcher.yaml` 为 `wake_allow: [writer]`、`assets/roles/writer.yaml` 为 `wake_allow: [editor, reviewer]`（附录 D-7b）
When 我执行 `orch workflow validate` 与 `orch workflow validate --format json`；随后把 `assets/roles/writer.yaml` 的 `wake_allow` 改回 `[editor]`，再执行一次 `orch workflow validate`（验完立即还原）
Then 前两次都是 `校验工作流 3 个：全部通过`、退出 0；第三次变红：`校验工作流 3 个：1 个不合法` 与一行 `唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）`（按 A-9 的 `内置 <id>` 句式、`内置 ` 前缀参与排序）、退出 1
机检：对齐后 `node "$REPO/bin/orch.js" workflow validate --format json` 的 `counts.invalid === 0`、`counts.assets === 3`、`counts.builtin === 3`、`errors` 为空；改回后 `counts.invalid === 1`、`errors[0].code === 'WORKFLOW_WAKE_DENIED'`、`errors[0].file` 以 `内置 ` 开头、`errors[0].detail` 含 `writer → reviewer`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-61.validate-ok.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-61.payload-ok.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-61.validate-broken.txt` | 134 B |
| `docs/iterations/iteration-6/evidence/AC-61.payload-broken.json` | 328 B |
| `docs/iterations/iteration-6/evidence/AC-61.git-status-assets.txt` | 9 B |
| `docs/iterations/iteration-6/evidence/AC-61.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-61.meta.json` | 984 B |
| `docs/iterations/iteration-6/evidence/AC-61.output.json` | 6420 B |
| `docs/iterations/iteration-6/evidence/AC-61.status.txt` | 1605 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given 独立项目根无 .orch（只有内置三图）（期望 false） | ✅ | `false` |
| 2 | Given assets/roles/writer.yaml 已读取（原文留存用于还原） | ✅ | `wake_allow: [editor, reviewer]` |
| 3 | Given assets/roles/researcher.yaml 对齐为 wake_allow: [writer] | ✅ | `D-7b` |
| 4 | Then ① 退出码 0（期望 0） | ✅ | `0` |
| 5 | Then ① 首行逐字（期望逐字 "校验工作流 3 个：全部通过"） | ✅ | `"校验工作流 3 个：全部通过"` |
| 6 | Then ② 退出码 0（期望 0） | ✅ | `0` |
| 7 | 机检：对齐后 counts.invalid === 0（期望 0） | ✅ | `0` |
| 8 | 机检：对齐后 counts.assets === 3（期望 3） | ✅ | `3` |
| 9 | 机检：对齐后 counts.builtin === 3（期望 3） | ✅ | `3` |
| 10 | 机检：对齐后 errors 为空（期望 []） | ✅ | `[]` |
| 11 | 夹具自检：writer.yaml 已临时改为 wake_allow: [editor] | ✅ | `replace applied` |
| 12 | Then ③ 退出码 1（期望 1） | ✅ | `1` |
| 13 | Then ③ 首行逐字（期望逐字 "校验工作流 3 个：1 个不合法"） | ✅ | `"校验工作流 3 个：1 个不合法"` |
| 14 | Then ③ 变红行恰好一条（期望 2） | ✅ | `2` |
| 15 | Then ③ 变红行逐字（A-9 的 内置 <id> 句式，内置 前缀参与排序）（期望逐字 "- 内置 task-loop：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）"） | ✅ | `"- 内置 task-loop：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）"` |
| 16 | 机检：改回后 counts.invalid === 1（期望 1） | ✅ | `1` |
| 17 | 机检：改回后 errors[0].code === WORKFLOW_WAKE_DENIED（期望 "WORKFLOW_WAKE_DENIED"） | ✅ | `"WORKFLOW_WAKE_DENIED"` |
| 18 | 机检：errors[0].file 以 内置  开头 | ✅ | `内置 task-loop` |
| 19 | 机检：errors[0].detail 含 writer → reviewer（期望含 "writer → reviewer"） | ✅ | `唤醒不在白名单内：writer → reviewer` |
| 20 | finally：assets/roles/writer.yaml 已逐字节还原（期望 true） | ✅ | `true` |
| 21 | 机检：git status --porcelain assets 输出为空（期望 ""） | ✅ | `""` |

**⑤ 判定**：通过

---

#### AC-62 node_type 四类取值异常与子工作流引用 / 跨工作流环

- 判定：**通过**（核对 15/15 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-62`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置六份坏工作流 bad-type / esc-no-title / sub-no-wf / sub-ghost / sub-a / sub-b（sub-a↔sub-b 跨工作流成环；全部 id 与文件名一致）] "(fixture) 预置六份坏工作流 bad-type / esc-no-title / sub-no-wf / sub-ghost / sub-a / sub-b（sub-a↔sub-b 跨工作流成环；全部 id 与文件名一致）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-62 | exit=1 | 100ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-62 | exit=1 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-62.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-62/`，无 `.orch`），预置 `bad-type.yaml`（`node_type: script`）、`esc-no-title.yaml`（`node_type: escalate` 缺 `title`）、`sub-no-wf.yaml`（`node_type: subworkflow` 缺 `workflow`）、`sub-ghost.yaml`（`node_type: subworkflow` + `workflow: ghost`）、`sub-a.yaml` / `sub-b.yaml`（`sub-a` 引用 `sub-b`、`sub-b` 引用 `sub-a`，跨工作流成环）
When 我执行 `orch workflow validate` 与 `orch workflow validate --format json`
Then 四类原因码各至少一行：`WORKFLOW_NODE_TYPE_INVALID`（明细逐字含 `节点类型取值非法：script；合法取值：role / human / escalate / subworkflow`）、`WORKFLOW_NODE_FIELD_MISSING`（明细含 `title` 与 `workflow`）、`WORKFLOW_SUB_UNKNOWN`（明细含 `ghost`）、`WORKFLOW_SUB_CYCLE`（明细给出 `sub-a` / `sub-b` 的环），退出 1；同一原因码在同一文件只报第一条，报哪一条由 C-09 的 ①~⑬ 顺序固定
机检：`errors.map(e => e.code)` 去重后含 `WORKFLOW_NODE_TYPE_INVALID` / `WORKFLOW_NODE_FIELD_MISSING` / `WORKFLOW_SUB_UNKNOWN` / `WORKFLOW_SUB_CYCLE`；`errors[0].file === 'workflows/bad-type.yaml'`（按文件名字典序）、`errors[0].detail` 含 `合法取值：role / human / escalate / subworkflow`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-62.validate-text.txt` | 665 B |
| `docs/iterations/iteration-6/evidence/AC-62.payload.json` | 1495 B |
| `docs/iterations/iteration-6/evidence/AC-62.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-62.meta.json` | 877 B |
| `docs/iterations/iteration-6/evidence/AC-62.output.json` | 8935 B |
| `docs/iterations/iteration-6/evidence/AC-62.status.txt` | 3004 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 退出码 1（期望 1） | ✅ | `1` |
| 2 | Then 报 WORKFLOW_NODE_TYPE_INVALID（明细逐字含 合法取值清单）（期望含 "节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）"） | ✅ | `校验工作流 9 个：6 个不合法<br>- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）<br>- workflows/esc-no-title.yaml：节点 T-001 缺少必填字段：title（WORKFLOW_NODE_FIELD_MISSING）<br>- workflows/sub-a.yaml：子工作流成环：sub-a → su` |
| 3 | Then 报 WORKFLOW_NODE_FIELD_MISSING：缺 title 与 workflow 两类（期望 true） | ✅ | `true` |
| 4 | Then 报 WORKFLOW_SUB_UNKNOWN（明细含 ghost）（期望含 "引用的子工作流不存在：ghost（WORKFLOW_SUB_UNKNOWN）"） | ✅ | `校验工作流 9 个：6 个不合法<br>- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）<br>- workflows/esc-no-title.yaml：节点 T-001 缺少必填字段：title（WORKFLOW_NODE_FIELD_MISSING）<br>- workflows/sub-a.yaml：子工作流成环：sub-a → su` |
| 5 | Then 报 WORKFLOW_SUB_CYCLE（明细给出 sub-a / sub-b 的环）（期望含 "子工作流成环："） | ✅ | `校验工作流 9 个：6 个不合法<br>- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）<br>- workflows/esc-no-title.yaml：节点 T-001 缺少必填字段：title（WORKFLOW_NODE_FIELD_MISSING）<br>- workflows/sub-a.yaml：子工作流成环：sub-a → su` |
| 6 | Then SUB_CYCLE 明细给出 sub-a 与 sub-b 的环 | ✅ | `- workflows/sub-a.yaml：子工作流成环：sub-a → sub-b（WORKFLOW_SUB_CYCLE）` |
| 7 | 机检：errors.map(code) 去重后含 WORKFLOW_NODE_TYPE_INVALID（期望 true） | ✅ | `true` |
| 8 | 机检：errors.map(code) 去重后含 WORKFLOW_NODE_FIELD_MISSING（期望 true） | ✅ | `true` |
| 9 | 机检：errors.map(code) 去重后含 WORKFLOW_SUB_UNKNOWN（期望 true） | ✅ | `true` |
| 10 | 机检：errors.map(code) 去重后含 WORKFLOW_SUB_CYCLE（期望 true） | ✅ | `true` |
| 11 | 机检：errors[0].file === workflows/bad-type.yaml（按文件名字典序）（期望 "workflows/bad-type.yaml"） | ✅ | `"workflows/bad-type.yaml"` |
| 12 | 机检：errors[0].detail 含 合法取值清单（期望含 "合法取值：role / human / escalate / subworkflow"） | ✅ | `节点类型取值非法：script；合法取值：role / human / escalate / subworkflow` |
| 13 | 机检：counts.invalid === 6（六份坏文件各计 1）（期望 6） | ✅ | `6` |
| 14 | 机检：counts.assets === 9（内置 3 + 项目 6）（期望 9） | ✅ | `9` |
| 15 | 机检：counts.builtin === 3（期望 3） | ✅ | `3` |

**⑤ 判定**：通过

---

#### AC-63 11 项完整原语逐项可表达且逐项可见

- 判定：**通过**（核对 33/33 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置附录 A-1/A-13 的 doc-fanout（writeDocFanout：A-1 逐字 + T-001 节点级 wake_allow: [writer, editor]，裁-15/R-11）] "(fixture) 预置附录 A-1/A-13 的 doc-fanout（writeDocFanout：A-1 逐字 + T-001 节点级 wake_allow: [writer, editor]，裁-15/R-11）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 95ms
[orch workflow validate --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 99ms
[orch workflow validate doc-fanout（scoped 旁证，裁决 AC-63-1）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 111ms
[orch workflow dry-run doc-fanout] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 137ms
[orch workflow dry-run doc-fanout --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow dry-run doc-fanout --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 104ms
[orch workflow show code-loop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 95ms
[orch workflow show code-loop --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show code-loop --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-63 | exit=0 | 98ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-63.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-63/`，无 `.orch`），预置附录 A-1 / A-13 的 `doc-fanout`（统一按 11 项枚举：顺序、并行 fan-out/fan-in（算 1 项）、条件分支、回流循环、轮次上限、超时、重试、人工节点、子工作流、升级、终止；字段映射按能力域 2 单列）
When 我执行 `orch workflow validate doc-fanout`、`orch workflow dry-run doc-fanout`，再执行 `orch workflow show code-loop`
Then 校验 `校验工作流 4 个：全部通过`、退出 0；预演首行逐字为 `编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流`，11 项原语逐项可见：顺序（层 1/3/4/5）、并行 fan-out/fan-in（层 2 并行组一行）、条件分支（`条件分支：` 三行）、超时 / 重试（`- T-001 超时 600s · 重试 2`）、人工节点（`3. T-004 人工确认（人工节点）`）、子工作流（`4. T-006 代码闭环（子工作流 code-loop · 2 节点）`）、升级（`5. T-005 升级（升级节点）`）、终止（升级终点），回流循环与轮次上限在 `orch workflow show code-loop` 的 `    T-002 → T-001 回流 · 轮次上限 2` 一行可见；末行 `结论：编排可执行，未启动任何会话`
机检：`node "$REPO/bin/orch.js" workflow dry-run doc-fanout --format json` 的 `layers` / `branches` / `mappings` / `policies` 四段齐全，`nodeCount === 6`、`edgeCount === 7`；预演文本中 `1 个子工作流` 出现 1 次且层行 `4. T-006 代码闭环（子工作流 code-loop · 2 节点）` 存在；`node "$REPO/bin/orch.js" workflow show code-loop --format json` 的 `edges[1].kind === 'backflow'`、`nodes` 中存在 `maxRounds === 2`；`counts.invalid === 0`；预演文本的并行组行显示 `汇合：all`（`join` 缺省 `all` 时 fan-in 的汇合条件用户可见，F-19）
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-63.validate-all.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-63.payload-validate.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-63.validate-scoped.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-63.dry-run.txt` | 702 B |
| `docs/iterations/iteration-6/evidence/AC-63.payload-dry-run.json` | 1116 B |
| `docs/iterations/iteration-6/evidence/AC-63.show-code-loop.txt` | 347 B |
| `docs/iterations/iteration-6/evidence/AC-63.payload-show-code-loop.json` | 1137 B |
| `docs/iterations/iteration-6/evidence/AC-63.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-63.meta.json` | 1031 B |
| `docs/iterations/iteration-6/evidence/AC-63.output.json` | 15950 B |
| `docs/iterations/iteration-6/evidence/AC-63.status.txt` | 5547 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then 校验退出码 0（全量：项目 1 + 内置 3 = 4 个，裁决 AC-63-1）（期望 0） | ✅ | `0` |
| 2 | Then 校验首行逐字（4 个：全部通过）（期望逐字 "校验工作流 4 个：全部通过"） | ✅ | `"校验工作流 4 个：全部通过"` |
| 3 | 机检：counts.invalid === 0（期望 0） | ✅ | `0` |
| 4 | 机检：counts.assets === 4（期望 4） | ✅ | `4` |
| 5 | 裁决 AC-63-1 旁证：scoped 校验首行为 1 个口径（期望逐字 "校验工作流 1 个：全部通过"） | ✅ | `"校验工作流 1 个：全部通过"` |
| 6 | Then dry-run 退出码 0（期望 0） | ✅ | `0` |
| 7 | Then 预演全文逐字（A-10；首行 + 11 项原语 + 结论行）（期望 ["编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流","1. T-001 研究（角色节点 researcher）","2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all","3. T-00 | ✅ | `["编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流","1. T-001 研究（角色节点 researcher）","2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all","3. T-004 人工确认（人工节点）","4. T-006 代码闭环（子工作流 code-loop · 2 节点）","5. T-005 升级（升级节点）","条件分支：","- T-004 → T-006 当` |
| 8 | 原语·顺序（层 1）（期望逐字 "1. T-001 研究（角色节点 researcher）"） | ✅ | `"1. T-001 研究（角色节点 researcher）"` |
| 9 | 原语·并行 fan-out/fan-in（层 2 并行组一行 + 汇合：all，F-19）（期望逐字 "2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all"） | ✅ | `"2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all"` |
| 10 | 原语·条件分支（标题 + 三行）（期望 true） | ✅ | `true` |
| 11 | 原语·人工节点（层 3）（期望逐字 "3. T-004 人工确认（人工节点）"） | ✅ | `"3. T-004 人工确认（人工节点）"` |
| 12 | 原语·子工作流（层 4）（期望逐字 "4. T-006 代码闭环（子工作流 code-loop · 2 节点）"） | ✅ | `"4. T-006 代码闭环（子工作流 code-loop · 2 节点）"` |
| 13 | 原语·升级（层 5）（期望逐字 "5. T-005 升级（升级节点）"） | ✅ | `"5. T-005 升级（升级节点）"` |
| 14 | 原语·终止（升级终点：T-005 无正向出边，条件分支与层行均无 T-005 作源）（期望 true） | ✅ | `true` |
| 15 | 原语·超时 / 重试（超时与重试段一行）（期望逐字 "- T-001 超时 600s · 重试 2"） | ✅ | `"- T-001 超时 600s · 重试 2"` |
| 16 | 原语·字段映射（能力域 2 单列：两行映射）（期望 true） | ✅ | `true` |
| 17 | Then 末行逐字（期望逐字 "结论：编排可执行，未启动任何会话"） | ✅ | `"结论：编排可执行，未启动任何会话"` |
| 18 | 机检：预演文本中 1 个子工作流 恰出现 1 次（期望 1） | ✅ | `1` |
| 19 | 机检：层行 4. T-006 代码闭环（子工作流 code-loop · 2 节点） 存在（期望 true） | ✅ | `true` |
| 20 | Then show code-loop 退出码 0（期望 0） | ✅ | `0` |
| 21 | 原语·回流循环 + 轮次上限（show 的回边一行）（期望 true） | ✅ | `true` |
| 22 | 机检：dry-run json 顶层恰 8 键（期望 ["branches","edgeCount","id","layers","mappings","name","nodeCount","policies"]） | ✅ | `["branches","edgeCount","id","layers","mappings","name","nodeCount","policies"]` |
| 23 | 机检：nodeCount === 6（期望 6） | ✅ | `6` |
| 24 | 机检：edgeCount === 7（期望 7） | ✅ | `7` |
| 25 | 机检：layers 段齐全（非空数组） | ✅ | `len=5` |
| 26 | 机检：branches 段齐全（非空数组） | ✅ | `len=3` |
| 27 | 机检：mappings 段齐全（非空数组） | ✅ | `len=2` |
| 28 | 机检：policies 段齐全（非空数组） | ✅ | `len=1` |
| 29 | 机检：branches[] 恰三键 from/to/when 且三行条件分支（期望 ["T-004 → T-006 human_approved","T-004 → T-005 human_rejected","T-006 → T-005 failed"]） | ✅ | `["T-004 → T-006 human_approved","T-004 → T-005 human_rejected","T-006 → T-005 failed"]` |
| 30 | 机检：并行组行显示 汇合：all（join 缺省 all 时 fan-in 汇合条件用户可见，F-19）（期望 true） | ✅ | `true` |
| 31 | 机检：show code-loop 退出码 0（期望 0） | ✅ | `0` |
| 32 | 机检：edges[1].kind === backflow（期望 "backflow"） | ✅ | `"backflow"` |
| 33 | 机检：nodes 中存在 maxRounds === 2（期望 true） | ✅ | `true` |

**⑤ 判定**：通过

---

#### AC-64 可达性终态定义：human / escalate 也是终点

- 判定：**通过**（核对 13/13 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 human-end / escalate-end / no-end 三条工作流（T-001 → T-END 与 → 侧节点；T-H 人工、T-E 升级、T-R 普通 role 无出边且不在 terminal）] "(fixture) 预置 human-end / escalate-end / no-end 三条工作流（T-001 → T-END 与 → 侧节点；T-H 人工、T-E 升级、T-R 普通 role 无出边且不在 terminal）"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate human-end] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate human-end   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=0 | 102ms
[orch workflow validate human-end --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate human-end --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=0 | 97ms
[orch workflow validate escalate-end] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate escalate-end   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=0 | 99ms
[orch workflow validate escalate-end --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate escalate-end --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=0 | 100ms
[orch workflow validate no-end] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate no-end   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=1 | 115ms
[orch workflow validate no-end --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate no-end --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=1 | 106ms
[orch workflow show human-end --format json] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow show human-end --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-64 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-64.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-64/`，无 `.orch`），预置 `human-end.yaml`（`entry: T-001` → `T-END`（`role`，`terminal: T-END`）与 → `T-H`（`human`，无出边））、`escalate-end.yaml`（同结构、把 `T-H` 换成 `escalate` 节点 `T-E`）、`no-end.yaml`（把 `T-H` / `T-E` 换成普通 `role` 节点 `T-R`，无出边且不在 `terminal`）；三条工作流所有节点都从入口可达
When 我依次执行 `orch workflow validate human-end`、`orch workflow validate escalate-end`、`orch workflow validate no-end`
Then 前两次都是 `校验工作流 1 个：全部通过`、退出 0（`human` / `escalate` 天然是终态，流程可以停在这两类节点上）；第三次报 `WORKFLOW_UNREACHABLE`，明细为 `节点不可达：T-R`，退出 1
机检：前两次 `counts.invalid === 0`；第三次 `errors[0].code === 'WORKFLOW_UNREACHABLE'`、`errors[0].detail` 含 `T-R`；`node "$REPO/bin/orch.js" workflow show human-end --format json` 的 `nodes` 里 `T-H` 的 `nodeType === 'human'`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-64.validate-human-end.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-64.payload-human-end.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-64.validate-escalate-end.txt` | 38 B |
| `docs/iterations/iteration-6/evidence/AC-64.payload-escalate-end.json` | 108 B |
| `docs/iterations/iteration-6/evidence/AC-64.validate-no-end.txt` | 114 B |
| `docs/iterations/iteration-6/evidence/AC-64.payload-no-end.json` | 308 B |
| `docs/iterations/iteration-6/evidence/AC-64.payload-show-human-end.json` | 1315 B |
| `docs/iterations/iteration-6/evidence/AC-64.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-64.meta.json` | 1063 B |
| `docs/iterations/iteration-6/evidence/AC-64.output.json` | 8947 B |
| `docs/iterations/iteration-6/evidence/AC-64.status.txt` | 4205 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Then human-end 退出码 0（期望 0） | ✅ | `0` |
| 2 | Then human-end 首行逐字（human / escalate 天然是终态）（期望逐字 "校验工作流 1 个：全部通过"） | ✅ | `"校验工作流 1 个：全部通过"` |
| 3 | 机检：human-end counts.invalid === 0（期望 0） | ✅ | `0` |
| 4 | Then escalate-end 退出码 0（期望 0） | ✅ | `0` |
| 5 | Then escalate-end 首行逐字（human / escalate 天然是终态）（期望逐字 "校验工作流 1 个：全部通过"） | ✅ | `"校验工作流 1 个：全部通过"` |
| 6 | 机检：escalate-end counts.invalid === 0（期望 0） | ✅ | `0` |
| 7 | Then no-end 退出码 1（期望 1） | ✅ | `1` |
| 8 | Then no-end 首行 1 个不合法（期望 "校验工作流 1 个：1 个不合法"） | ✅ | `"校验工作流 1 个：1 个不合法"` |
| 9 | Then no-end 错误行逐字（A-15：节点不可达：{node}）（期望逐字 "- workflows/no-end.yaml：节点不可达：T-R（WORKFLOW_UNREACHABLE）"） | ✅ | `"- workflows/no-end.yaml：节点不可达：T-R（WORKFLOW_UNREACHABLE）"` |
| 10 | 机检：no-end errors[0].code === WORKFLOW_UNREACHABLE（期望 "WORKFLOW_UNREACHABLE"） | ✅ | `"WORKFLOW_UNREACHABLE"` |
| 11 | 机检：no-end errors[0].detail 含 T-R（期望含 "T-R"） | ✅ | `节点不可达：T-R` |
| 12 | 机检：show human-end 退出码 0（期望 0） | ✅ | `0` |
| 13 | 机检：nodes 里 T-H 的 nodeType === human（期望 "human"） | ✅ | `"human"` |

**⑤ 判定**：通过

---

#### AC-65 校验顺序与错误排序固定（BR-40）

- 判定：**通过**（核对 10/10 通过）
- 验证面：机检
- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-65`
- 实例：（无）

**① 完整命令（逐条可复跑）**

```
[夹具：预置 bad-type.yaml（node_type: script）与 wake.yaml（researcher → editor 的 forward 边，源角色白名单 [writer] 不含 editor）；节点上不补 wake_allow] "(fixture) 预置 bad-type.yaml（node_type: script）与 wake.yaml（researcher → editor 的 forward 边，源角色白名单 [writer] 不含 editor）；节点上不补 wake_allow"   | cwd=d:\WWW\Maestro | exit=0 | 0ms
[orch workflow validate --format json（第 1 次）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-65 | exit=1 | 103ms
[orch workflow validate --format json（第 2 次）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate --format json   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-65 | exit=1 | 106ms
[orch workflow validate（文本）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe d:\WWW\Maestro\bin\orch.js workflow validate   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-p6\AC-65 | exit=1 | 106ms
```

> 每条命令 stdout+stderr 全文见 `docs/iterations/iteration-6/evidence/AC-65.output.json`；`status.txt` 是可读转录。

**② 需求原文（Given / When / Then / 机检，逐字）**

```gherkin
Given 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-65/`，无 `.orch`），预置 `bad-type.yaml`（`node_type: script`）与 `wake.yaml`（一条 `forward` 边的源角色白名单不含目标角色），内置三图按附录 D-7b 对齐后合法
When 我连续两次执行 `orch workflow validate --format json`，再执行 `orch workflow validate`（文本）
Then 文本首行逐字为 `校验工作流 5 个：2 个不合法`，随后两行按「文件名字典序 + 同文件内 C-09 ①~⑬ 顺序」固定：第一条逐字是 `- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）`，随后是 `- workflows/wake.yaml：…（WORKFLOW_WAKE_DENIED）`，退出 1；两次 JSON 输出逐字节相同，第一条错误不依赖实现的遍历巧合
机检：`node "$REPO/bin/orch.js" workflow validate --format json` 连续两次经 `sha256sum` 结果相同；`errors.map(e => e.file + ':' + e.code)` 等于 `['workflows/bad-type.yaml:WORKFLOW_NODE_TYPE_INVALID','workflows/wake.yaml:WORKFLOW_WAKE_DENIED']`；`errors[0].code === 'WORKFLOW_NODE_TYPE_INVALID'`、`counts.assets === 5`、`counts.invalid === 2`
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-6/evidence/AC-65.json-run-1-sha256.txt` | 66 B |
| `docs/iterations/iteration-6/evidence/AC-65.json-run-2-sha256.txt` | 66 B |
| `docs/iterations/iteration-6/evidence/AC-65.payload.json` | 613 B |
| `docs/iterations/iteration-6/evidence/AC-65.validate-text.txt` | 288 B |
| `docs/iterations/iteration-6/evidence/AC-65.state.json` | 5 B |
| `docs/iterations/iteration-6/evidence/AC-65.meta.json` | 924 B |
| `docs/iterations/iteration-6/evidence/AC-65.output.json` | 6304 B |
| `docs/iterations/iteration-6/evidence/AC-65.status.txt` | 2678 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 机检：连续两次 JSON 输出经 sha256 逐字节相同（期望 "c28ca564e5da6577bd0a2b243a02c5a4a5423f8f4f8ffd87bc45b4b091af35f8"） | ✅ | `"c28ca564e5da6577bd0a2b243a02c5a4a5423f8f4f8ffd87bc45b4b091af35f8"` |
| 2 | Then 退出码 1（期望 1） | ✅ | `1` |
| 3 | Then 首行逐字（期望逐字 "校验工作流 5 个：2 个不合法"） | ✅ | `"校验工作流 5 个：2 个不合法"` |
| 4 | Then 随后两行（共三行输出）（期望 3） | ✅ | `3` |
| 5 | Then 第一条逐字（bad-type 在前）（期望逐字 "- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）"） | ✅ | `"- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）"` |
| 6 | Then 第二条逐字（wake.yaml，A-15 明细模板）（期望逐字 "- workflows/wake.yaml：唤醒不在白名单内：researcher → editor（WORKFLOW_WAKE_DENIED）"） | ✅ | `"- workflows/wake.yaml：唤醒不在白名单内：researcher → editor（WORKFLOW_WAKE_DENIED）"` |
| 7 | 机检：errors.map(file + ':' + code) 逐字等于两元素数组（期望 ["workflows/bad-type.yaml:WORKFLOW_NODE_TYPE_INVALID","workflows/wake.yaml:WORKFLOW_WAKE_DENIED"]） | ✅ | `["workflows/bad-type.yaml:WORKFLOW_NODE_TYPE_INVALID","workflows/wake.yaml:WORKFLOW_WAKE_DENIED"]` |
| 8 | 机检：errors[0].code === WORKFLOW_NODE_TYPE_INVALID（期望 "WORKFLOW_NODE_TYPE_INVALID"） | ✅ | `"WORKFLOW_NODE_TYPE_INVALID"` |
| 9 | 机检：counts.assets === 5（内置 3 + 项目 2）（期望 5） | ✅ | `5` |
| 10 | 机检：counts.invalid === 2（期望 2） | ✅ | `2` |

**⑤ 判定**：通过

---

## 2. 未通过 / 阻塞项汇总

（无未通过 / 阻塞项）

## 3. 证据索引

共 547 个文件；每条 AC 至少 `state.json` / `meta.json` / `output.json` / `status.txt`（无实例时 state 为 null，events 为空）。

| AC | 文件数 | 证据文件 |
|---|---|---|
| AC-01 | 8 | `evidence/AC-01.create.txt`<br>`evidence/AC-01.lead-dev.yaml.txt`<br>`evidence/AC-01.list.txt`<br>`evidence/AC-01.meta.json`<br>`evidence/AC-01.output.json`<br>`evidence/AC-01.payload.json`<br>`evidence/AC-01.state.json`<br>`evidence/AC-01.status.txt` |
| AC-02 | 7 | `evidence/AC-02.meta.json`<br>`evidence/AC-02.output.json`<br>`evidence/AC-02.state.json`<br>`evidence/AC-02.status.txt`<br>`evidence/AC-02.usage-1.txt`<br>`evidence/AC-02.usage-2.txt`<br>`evidence/AC-02.usage-3.txt` |
| AC-03 | 7 | `evidence/AC-03.deny.txt`<br>`evidence/AC-03.force.txt`<br>`evidence/AC-03.lead-dev.yaml.txt`<br>`evidence/AC-03.meta.json`<br>`evidence/AC-03.output.json`<br>`evidence/AC-03.state.json`<br>`evidence/AC-03.status.txt` |
| AC-04 | 10 | `evidence/AC-04.create.txt`<br>`evidence/AC-04.lead-dev.yaml.txt`<br>`evidence/AC-04.list-payload.json`<br>`evidence/AC-04.meta.json`<br>`evidence/AC-04.output.json`<br>`evidence/AC-04.show-payload.json`<br>`evidence/AC-04.show.txt`<br>`evidence/AC-04.state.json`<br>`evidence/AC-04.status.txt`<br>`evidence/AC-04.wp11-test.txt` |
| AC-05 | 11 | `evidence/AC-05.edit.txt`<br>`evidence/AC-05.list-after.txt`<br>`evidence/AC-05.meta.json`<br>`evidence/AC-05.output.json`<br>`evidence/AC-05.show-after.txt`<br>`evidence/AC-05.skills-after.json`<br>`evidence/AC-05.skills-before.json`<br>`evidence/AC-05.state.json`<br>`evidence/AC-05.status.txt`<br>`evidence/AC-05.validate-after.txt`<br>`evidence/AC-05.validate-payload.json` |
| AC-06 | 8 | `evidence/AC-06.cycle-payload.json`<br>`evidence/AC-06.cycle-text.txt`<br>`evidence/AC-06.meta.json`<br>`evidence/AC-06.missing-payload.json`<br>`evidence/AC-06.missing-text.txt`<br>`evidence/AC-06.output.json`<br>`evidence/AC-06.state.json`<br>`evidence/AC-06.status.txt` |
| AC-07 | 9 | `evidence/AC-07.export.txt`<br>`evidence/AC-07.exported.yaml.txt`<br>`evidence/AC-07.import.txt`<br>`evidence/AC-07.list-B.txt`<br>`evidence/AC-07.meta.json`<br>`evidence/AC-07.output.json`<br>`evidence/AC-07.state.json`<br>`evidence/AC-07.status.txt`<br>`evidence/AC-07.validate-B.json` |
| AC-08 | 6 | `evidence/AC-08.deny.txt`<br>`evidence/AC-08.dup.txt`<br>`evidence/AC-08.meta.json`<br>`evidence/AC-08.output.json`<br>`evidence/AC-08.state.json`<br>`evidence/AC-08.status.txt` |
| AC-09 | 7 | `evidence/AC-09.deny.txt`<br>`evidence/AC-09.edit.txt`<br>`evidence/AC-09.lead-dev.yaml.txt`<br>`evidence/AC-09.meta.json`<br>`evidence/AC-09.output.json`<br>`evidence/AC-09.state.json`<br>`evidence/AC-09.status.txt` |
| AC-10 | 7 | `evidence/AC-10.diff-developer.txt`<br>`evidence/AC-10.diff-lead-dev.txt`<br>`evidence/AC-10.diff-payload.json`<br>`evidence/AC-10.meta.json`<br>`evidence/AC-10.output.json`<br>`evidence/AC-10.state.json`<br>`evidence/AC-10.status.txt` |
| AC-11 | 6 | `evidence/AC-11.meta.json`<br>`evidence/AC-11.output.json`<br>`evidence/AC-11.payload.json`<br>`evidence/AC-11.state.json`<br>`evidence/AC-11.status.txt`<br>`evidence/AC-11.validate-text.txt` |
| AC-12 | 7 | `evidence/AC-12.meta.json`<br>`evidence/AC-12.output.json`<br>`evidence/AC-12.payload.json`<br>`evidence/AC-12.state.json`<br>`evidence/AC-12.status.txt`<br>`evidence/AC-12.validate-text.txt`<br>`evidence/AC-12.workflow-validate.txt` |
| AC-13 | 6 | `evidence/AC-13.meta.json`<br>`evidence/AC-13.output.json`<br>`evidence/AC-13.payload.json`<br>`evidence/AC-13.state.json`<br>`evidence/AC-13.status.txt`<br>`evidence/AC-13.validate-text.txt` |
| AC-14 | 6 | `evidence/AC-14.meta.json`<br>`evidence/AC-14.output.json`<br>`evidence/AC-14.payload.json`<br>`evidence/AC-14.state.json`<br>`evidence/AC-14.status.txt`<br>`evidence/AC-14.validate-text.txt` |
| AC-15 | 7 | `evidence/AC-15.baseline-diff.txt`<br>`evidence/AC-15.meta.json`<br>`evidence/AC-15.output.json`<br>`evidence/AC-15.payload.json`<br>`evidence/AC-15.state.json`<br>`evidence/AC-15.status.txt`<br>`evidence/AC-15.validate.txt` |
| AC-16 | 6 | `evidence/AC-16.list.txt`<br>`evidence/AC-16.meta.json`<br>`evidence/AC-16.output.json`<br>`evidence/AC-16.payload.json`<br>`evidence/AC-16.state.json`<br>`evidence/AC-16.status.txt` |
| AC-17 | 6 | `evidence/AC-17.meta.json`<br>`evidence/AC-17.output.json`<br>`evidence/AC-17.payload.json`<br>`evidence/AC-17.show.txt`<br>`evidence/AC-17.state.json`<br>`evidence/AC-17.status.txt` |
| AC-18 | 8 | `evidence/AC-18.SKILL.md.txt`<br>`evidence/AC-18.create.txt`<br>`evidence/AC-18.meta.json`<br>`evidence/AC-18.output.json`<br>`evidence/AC-18.state.json`<br>`evidence/AC-18.status.txt`<br>`evidence/AC-18.validate-payload.json`<br>`evidence/AC-18.validate.txt` |
| AC-19 | 6 | `evidence/AC-19.meta.json`<br>`evidence/AC-19.output.json`<br>`evidence/AC-19.payload.json`<br>`evidence/AC-19.state.json`<br>`evidence/AC-19.status.txt`<br>`evidence/AC-19.validate.txt` |
| AC-20 | 8 | `evidence/AC-20.export.txt`<br>`evidence/AC-20.import.txt`<br>`evidence/AC-20.list-B.txt`<br>`evidence/AC-20.meta.json`<br>`evidence/AC-20.output.json`<br>`evidence/AC-20.state.json`<br>`evidence/AC-20.status.txt`<br>`evidence/AC-20.validate-B.json` |
| AC-21 | 6 | `evidence/AC-21.list.txt`<br>`evidence/AC-21.meta.json`<br>`evidence/AC-21.output.json`<br>`evidence/AC-21.payload.json`<br>`evidence/AC-21.state.json`<br>`evidence/AC-21.status.txt` |
| AC-22 | 6 | `evidence/AC-22.meta.json`<br>`evidence/AC-22.output.json`<br>`evidence/AC-22.payload.json`<br>`evidence/AC-22.show.txt`<br>`evidence/AC-22.state.json`<br>`evidence/AC-22.status.txt` |
| AC-23 | 8 | `evidence/AC-23.list.txt`<br>`evidence/AC-23.meta.json`<br>`evidence/AC-23.output.json`<br>`evidence/AC-23.payload.json`<br>`evidence/AC-23.show-payload.json`<br>`evidence/AC-23.show.txt`<br>`evidence/AC-23.state.json`<br>`evidence/AC-23.status.txt` |
| AC-24 | 7 | `evidence/AC-24.meta.json`<br>`evidence/AC-24.output.json`<br>`evidence/AC-24.payload.json`<br>`evidence/AC-24.show-payload.json`<br>`evidence/AC-24.state.json`<br>`evidence/AC-24.status.txt`<br>`evidence/AC-24.validate.txt` |
| AC-25 | 6 | `evidence/AC-25.meta.json`<br>`evidence/AC-25.output.json`<br>`evidence/AC-25.payload.json`<br>`evidence/AC-25.state.json`<br>`evidence/AC-25.status.txt`<br>`evidence/AC-25.validate.txt` |
| AC-26 | 6 | `evidence/AC-26.meta.json`<br>`evidence/AC-26.output.json`<br>`evidence/AC-26.payload.json`<br>`evidence/AC-26.state.json`<br>`evidence/AC-26.status.txt`<br>`evidence/AC-26.validate.txt` |
| AC-27 | 7 | `evidence/AC-27.dry-run.txt`<br>`evidence/AC-27.meta.json`<br>`evidence/AC-27.output.json`<br>`evidence/AC-27.payload.json`<br>`evidence/AC-27.state.json`<br>`evidence/AC-27.status.txt`<br>`evidence/AC-27.validate.txt` |
| AC-28 | 6 | `evidence/AC-28.dry-run.txt`<br>`evidence/AC-28.meta.json`<br>`evidence/AC-28.output.json`<br>`evidence/AC-28.payload.json`<br>`evidence/AC-28.state.json`<br>`evidence/AC-28.status.txt` |
| AC-29 | 8 | `evidence/AC-29.dry-run.txt`<br>`evidence/AC-29.meta.json`<br>`evidence/AC-29.output.json`<br>`evidence/AC-29.payload.json`<br>`evidence/AC-29.state.json`<br>`evidence/AC-29.status.txt`<br>`evidence/AC-29.validate-bad.txt`<br>`evidence/AC-29.validate-ok.txt` |
| AC-30 | 7 | `evidence/AC-30.dry-run.txt`<br>`evidence/AC-30.meta.json`<br>`evidence/AC-30.output.json`<br>`evidence/AC-30.payload.json`<br>`evidence/AC-30.state.json`<br>`evidence/AC-30.status.txt`<br>`evidence/AC-30.validate.txt` |
| AC-31 | 8 | `evidence/AC-31.meta.json`<br>`evidence/AC-31.output.json`<br>`evidence/AC-31.payload-broken.json`<br>`evidence/AC-31.payload-fixed.json`<br>`evidence/AC-31.state.json`<br>`evidence/AC-31.status.txt`<br>`evidence/AC-31.validate-broken.txt`<br>`evidence/AC-31.validate-fixed.txt` |
| AC-32 | 6 | `evidence/AC-32.meta.json`<br>`evidence/AC-32.output.json`<br>`evidence/AC-32.payload.json`<br>`evidence/AC-32.state.json`<br>`evidence/AC-32.status.txt`<br>`evidence/AC-32.validate.txt` |
| AC-33 | 8 | `evidence/AC-33.meta.json`<br>`evidence/AC-33.output.json`<br>`evidence/AC-33.payload-broken.json`<br>`evidence/AC-33.payload-fixed.json`<br>`evidence/AC-33.state.json`<br>`evidence/AC-33.status.txt`<br>`evidence/AC-33.validate-broken.txt`<br>`evidence/AC-33.validate-fixed.txt` |
| AC-34 | 8 | `evidence/AC-34.meta.json`<br>`evidence/AC-34.output.json`<br>`evidence/AC-34.payload-invalid.json`<br>`evidence/AC-34.payload-overlap.json`<br>`evidence/AC-34.state.json`<br>`evidence/AC-34.status.txt`<br>`evidence/AC-34.validate-invalid.txt`<br>`evidence/AC-34.validate-overlap.txt` |
| AC-35 | 6 | `evidence/AC-35.meta.json`<br>`evidence/AC-35.output.json`<br>`evidence/AC-35.payload.json`<br>`evidence/AC-35.state.json`<br>`evidence/AC-35.status.txt`<br>`evidence/AC-35.validate.txt` |
| AC-36 | 8 | `evidence/AC-36.meta.json`<br>`evidence/AC-36.output.json`<br>`evidence/AC-36.payload-escalate.json`<br>`evidence/AC-36.payload-human.json`<br>`evidence/AC-36.state.json`<br>`evidence/AC-36.status.txt`<br>`evidence/AC-36.validate-escalate.txt`<br>`evidence/AC-36.validate-human.txt` |
| AC-37 | 8 | `evidence/AC-37.meta.json`<br>`evidence/AC-37.output.json`<br>`evidence/AC-37.payload-denied.json`<br>`evidence/AC-37.payload-fixed.json`<br>`evidence/AC-37.state.json`<br>`evidence/AC-37.status.txt`<br>`evidence/AC-37.validate-denied.txt`<br>`evidence/AC-37.validate-fixed.txt` |
| AC-38 | 6 | `evidence/AC-38.meta.json`<br>`evidence/AC-38.output.json`<br>`evidence/AC-38.payload.json`<br>`evidence/AC-38.state.json`<br>`evidence/AC-38.status.txt`<br>`evidence/AC-38.validate.txt` |
| AC-39 | 9 | `evidence/AC-39.create-copy.txt`<br>`evidence/AC-39.create-fork.txt`<br>`evidence/AC-39.diff-copy.txt`<br>`evidence/AC-39.diff-fork.txt`<br>`evidence/AC-39.meta.json`<br>`evidence/AC-39.output.json`<br>`evidence/AC-39.payload.json`<br>`evidence/AC-39.state.json`<br>`evidence/AC-39.status.txt` |
| AC-40 | 13 | `evidence/AC-40.create.txt`<br>`evidence/AC-40.dup-no-force.txt`<br>`evidence/AC-40.force-invalid.txt`<br>`evidence/AC-40.force-ok.txt`<br>`evidence/AC-40.fork-after-force.yaml.txt`<br>`evidence/AC-40.fork.yaml.txt`<br>`evidence/AC-40.list-payload.json`<br>`evidence/AC-40.meta.json`<br>`evidence/AC-40.output.json`<br>`evidence/AC-40.state.json`<br>`evidence/AC-40.status.txt`<br>`evidence/AC-40.validate-fork-payload.json`<br>`evidence/AC-40.validate.txt` |
| AC-41 | 8 | `evidence/AC-41.dry-run-1.txt`<br>`evidence/AC-41.dry-run-2.txt`<br>`evidence/AC-41.meta.json`<br>`evidence/AC-41.output.json`<br>`evidence/AC-41.snapshot-after.json`<br>`evidence/AC-41.snapshot-before.json`<br>`evidence/AC-41.state.json`<br>`evidence/AC-41.status.txt` |
| AC-42 | 5 | `evidence/AC-42.dry-run.txt`<br>`evidence/AC-42.meta.json`<br>`evidence/AC-42.output.json`<br>`evidence/AC-42.state.json`<br>`evidence/AC-42.status.txt` |
| AC-43 | 5 | `evidence/AC-43.meta.json`<br>`evidence/AC-43.output.json`<br>`evidence/AC-43.state.json`<br>`evidence/AC-43.status.txt`<br>`evidence/AC-43.usage.txt` |
| AC-44 | 16 | `evidence/AC-44.meta.json`<br>`evidence/AC-44.output.json`<br>`evidence/AC-44.role-bogus.txt`<br>`evidence/AC-44.role-list---nope.txt`<br>`evidence/AC-44.role-show-x---group-coding.txt`<br>`evidence/AC-44.role-show缺位置参数.txt`<br>`evidence/AC-44.skill-bogus.txt`<br>`evidence/AC-44.skill-list---nope.txt`<br>`evidence/AC-44.skill-show-x---instance-y.txt`<br>`evidence/AC-44.skill-show缺位置参数.txt`<br>`evidence/AC-44.state.json`<br>`evidence/AC-44.status.txt`<br>`evidence/AC-44.workflow-bogus.txt`<br>`evidence/AC-44.workflow-list---group-x.txt`<br>`evidence/AC-44.workflow-list---nope.txt`<br>`evidence/AC-44.workflow-show缺位置参数.txt` |
| AC-45 | 17 | `evidence/AC-45.assets-manifest-after.txt`<br>`evidence/AC-45.assets-manifest-before.txt`<br>`evidence/AC-45.meta.json`<br>`evidence/AC-45.output.json`<br>`evidence/AC-45.role-list.txt`<br>`evidence/AC-45.role-show-developer.txt`<br>`evidence/AC-45.role-validate.txt`<br>`evidence/AC-45.skill-list.txt`<br>`evidence/AC-45.skill-show-code-change.txt`<br>`evidence/AC-45.skill-validate.txt`<br>`evidence/AC-45.state.json`<br>`evidence/AC-45.status.txt`<br>`evidence/AC-45.summaries.txt`<br>`evidence/AC-45.workflow-diff-code-loop.txt`<br>`evidence/AC-45.workflow-list.txt`<br>`evidence/AC-45.workflow-show-code-loop.txt`<br>`evidence/AC-45.workflow-validate.txt` |
| AC-46 | 17 | `evidence/AC-46.assets-manifest-after.txt`<br>`evidence/AC-46.assets-manifest-before.txt`<br>`evidence/AC-46.exits.txt`<br>`evidence/AC-46.meta.json`<br>`evidence/AC-46.output.json`<br>`evidence/AC-46.role-create---from.txt`<br>`evidence/AC-46.role-create.txt`<br>`evidence/AC-46.role-edit.txt`<br>`evidence/AC-46.role-export---out.txt`<br>`evidence/AC-46.role-import.txt`<br>`evidence/AC-46.skill-create.txt`<br>`evidence/AC-46.skill-export---out.txt`<br>`evidence/AC-46.skill-import.txt`<br>`evidence/AC-46.state.json`<br>`evidence/AC-46.status.txt`<br>`evidence/AC-46.touched-files.json`<br>`evidence/AC-46.workflow-create.txt` |
| AC-47 | 5 | `evidence/AC-47.meta.json`<br>`evidence/AC-47.output.json`<br>`evidence/AC-47.run.txt`<br>`evidence/AC-47.state.json`<br>`evidence/AC-47.status.txt` |
| AC-48 | 26 | `evidence/AC-48.assets-diff.json`<br>`evidence/AC-48.cli-role-test-tap.txt`<br>`evidence/AC-48.diff-list-json.txt`<br>`evidence/AC-48.diff-list.txt`<br>`evidence/AC-48.diff-show-developer-json.txt`<br>`evidence/AC-48.diff-show-developer.txt`<br>`evidence/AC-48.diff-validate-json.txt`<br>`evidence/AC-48.diff-validate.txt`<br>`evidence/AC-48.list-json.txt`<br>`evidence/AC-48.list.txt`<br>`evidence/AC-48.meta.json`<br>`evidence/AC-48.output.json`<br>`evidence/AC-48.show-developer-json.txt`<br>`evidence/AC-48.show-developer.txt`<br>`evidence/AC-48.show-researcher-baseline.txt`<br>`evidence/AC-48.show-researcher-json-baseline.txt`<br>`evidence/AC-48.show-researcher-json.txt`<br>`evidence/AC-48.show-researcher.txt`<br>`evidence/AC-48.show-writer-baseline.txt`<br>`evidence/AC-48.show-writer-json-baseline.txt`<br>`evidence/AC-48.show-writer-json.txt`<br>`evidence/AC-48.show-writer.txt`<br>`evidence/AC-48.state.json`<br>`evidence/AC-48.status.txt`<br>`evidence/AC-48.validate-json.txt`<br>`evidence/AC-48.validate.txt` |
| AC-49 | 20 | `evidence/AC-49.code-loop-baseline-tree.txt`<br>`evidence/AC-49.code-loop-current.txt`<br>`evidence/AC-49.code-loop-diff-baseline-tree-vs-stored.txt`<br>`evidence/AC-49.code-loop-diff-vs-stored-full.txt`<br>`evidence/AC-49.code-loop-diff-vs-stored.txt`<br>`evidence/AC-49.events.jsonl`<br>`evidence/AC-49.meta.json`<br>`evidence/AC-49.output.json`<br>`evidence/AC-49.single-baseline-tree.txt`<br>`evidence/AC-49.single-current.txt`<br>`evidence/AC-49.single-diff-baseline-tree-vs-stored.txt`<br>`evidence/AC-49.single-diff-vs-stored-full.txt`<br>`evidence/AC-49.single-diff-vs-stored.txt`<br>`evidence/AC-49.state.json`<br>`evidence/AC-49.status.txt`<br>`evidence/AC-49.task-loop-baseline-tree.txt`<br>`evidence/AC-49.task-loop-current.txt`<br>`evidence/AC-49.task-loop-diff-baseline-tree-vs-stored.txt`<br>`evidence/AC-49.task-loop-diff-vs-stored-full.txt`<br>`evidence/AC-49.task-loop-diff-vs-stored.txt` |
| AC-50 | 5 | `evidence/AC-50.meta.json`<br>`evidence/AC-50.output.json`<br>`evidence/AC-50.state.json`<br>`evidence/AC-50.status.txt`<br>`evidence/AC-50.tap-tail.txt` |
| AC-51 | 8 | `evidence/AC-51.meta.json`<br>`evidence/AC-51.no-cjk.txt`<br>`evidence/AC-51.output.json`<br>`evidence/AC-51.purity-cli.txt`<br>`evidence/AC-51.purity-core.txt`<br>`evidence/AC-51.purity-registry.txt`<br>`evidence/AC-51.state.json`<br>`evidence/AC-51.status.txt` |
| AC-52 | 6 | `evidence/AC-52.meta.json`<br>`evidence/AC-52.node-e-out.txt`<br>`evidence/AC-52.output.json`<br>`evidence/AC-52.package-json.json`<br>`evidence/AC-52.state.json`<br>`evidence/AC-52.status.txt` |
| AC-53 | 6 | `evidence/AC-53.meta.json`<br>`evidence/AC-53.output.json`<br>`evidence/AC-53.payload.json`<br>`evidence/AC-53.state.json`<br>`evidence/AC-53.status.txt`<br>`evidence/AC-53.validate-text.txt` |
| AC-54 | 8 | `evidence/AC-54.meta.json`<br>`evidence/AC-54.orch-role-create-lead-dev---artifact-type-doc-….txt`<br>`evidence/AC-54.orch-role-create-lead-dev---group-nope-….txt`<br>`evidence/AC-54.orch-role-create-lead-dev---side-effect-heavy-….txt`<br>`evidence/AC-54.output.json`<br>`evidence/AC-54.role-bogus.txt`<br>`evidence/AC-54.state.json`<br>`evidence/AC-54.status.txt` |
| AC-55 | 7 | `evidence/AC-55.import-not-role.txt`<br>`evidence/AC-55.import-wrong-schema.txt`<br>`evidence/AC-55.meta.json`<br>`evidence/AC-55.output.json`<br>`evidence/AC-55.role-list-payload.json`<br>`evidence/AC-55.state.json`<br>`evidence/AC-55.status.txt` |
| AC-56 | 8 | `evidence/AC-56.edit-set-nope.txt`<br>`evidence/AC-56.edit-success.txt`<br>`evidence/AC-56.edit-unset-name.txt`<br>`evidence/AC-56.meta.json`<br>`evidence/AC-56.output.json`<br>`evidence/AC-56.show-after.txt`<br>`evidence/AC-56.state.json`<br>`evidence/AC-56.status.txt` |
| AC-57 | 9 | `evidence/AC-57.diff-against-developer.txt`<br>`evidence/AC-57.diff-payload.json`<br>`evidence/AC-57.diff-role-nobaseline.txt`<br>`evidence/AC-57.diff-wf-nobaseline.txt`<br>`evidence/AC-57.edit-ghost.txt`<br>`evidence/AC-57.meta.json`<br>`evidence/AC-57.output.json`<br>`evidence/AC-57.state.json`<br>`evidence/AC-57.status.txt` |
| AC-58 | 11 | `evidence/AC-58.assets-manifest-after.txt`<br>`evidence/AC-58.assets-manifest-before.txt`<br>`evidence/AC-58.create-builtin-force.txt`<br>`evidence/AC-58.create-project-exists.txt`<br>`evidence/AC-58.create-project-force.txt`<br>`evidence/AC-58.git-status-assets.txt`<br>`evidence/AC-58.import-developer.txt`<br>`evidence/AC-58.meta.json`<br>`evidence/AC-58.output.json`<br>`evidence/AC-58.state.json`<br>`evidence/AC-58.status.txt` |
| AC-59 | 10 | `evidence/AC-59.create-badgroup.txt`<br>`evidence/AC-59.create-emptybody.txt`<br>`evidence/AC-59.create-nosummary.txt`<br>`evidence/AC-59.create-quote.txt`<br>`evidence/AC-59.meta.json`<br>`evidence/AC-59.output.json`<br>`evidence/AC-59.show-quote.txt`<br>`evidence/AC-59.state.json`<br>`evidence/AC-59.status.txt`<br>`evidence/AC-59.validate-payload.json` |
| AC-60 | 12 | `evidence/AC-60.meta.json`<br>`evidence/AC-60.output.json`<br>`evidence/AC-60.payload-backflow-target.json`<br>`evidence/AC-60.payload-retest-ok.json`<br>`evidence/AC-60.payload-task-var.json`<br>`evidence/AC-60.payload-wake-empty.json`<br>`evidence/AC-60.state.json`<br>`evidence/AC-60.status.txt`<br>`evidence/AC-60.validate-backflow-target.txt`<br>`evidence/AC-60.validate-retest-ok.txt`<br>`evidence/AC-60.validate-task-var.txt`<br>`evidence/AC-60.validate-wake-empty.txt` |
| AC-61 | 9 | `evidence/AC-61.git-status-assets.txt`<br>`evidence/AC-61.meta.json`<br>`evidence/AC-61.output.json`<br>`evidence/AC-61.payload-broken.json`<br>`evidence/AC-61.payload-ok.json`<br>`evidence/AC-61.state.json`<br>`evidence/AC-61.status.txt`<br>`evidence/AC-61.validate-broken.txt`<br>`evidence/AC-61.validate-ok.txt` |
| AC-62 | 6 | `evidence/AC-62.meta.json`<br>`evidence/AC-62.output.json`<br>`evidence/AC-62.payload.json`<br>`evidence/AC-62.state.json`<br>`evidence/AC-62.status.txt`<br>`evidence/AC-62.validate-text.txt` |
| AC-63 | 11 | `evidence/AC-63.dry-run.txt`<br>`evidence/AC-63.meta.json`<br>`evidence/AC-63.output.json`<br>`evidence/AC-63.payload-dry-run.json`<br>`evidence/AC-63.payload-show-code-loop.json`<br>`evidence/AC-63.payload-validate.json`<br>`evidence/AC-63.show-code-loop.txt`<br>`evidence/AC-63.state.json`<br>`evidence/AC-63.status.txt`<br>`evidence/AC-63.validate-all.txt`<br>`evidence/AC-63.validate-scoped.txt` |
| AC-64 | 11 | `evidence/AC-64.meta.json`<br>`evidence/AC-64.output.json`<br>`evidence/AC-64.payload-escalate-end.json`<br>`evidence/AC-64.payload-human-end.json`<br>`evidence/AC-64.payload-no-end.json`<br>`evidence/AC-64.payload-show-human-end.json`<br>`evidence/AC-64.state.json`<br>`evidence/AC-64.status.txt`<br>`evidence/AC-64.validate-escalate-end.txt`<br>`evidence/AC-64.validate-human-end.txt`<br>`evidence/AC-64.validate-no-end.txt` |
| AC-65 | 8 | `evidence/AC-65.json-run-1-sha256.txt`<br>`evidence/AC-65.json-run-2-sha256.txt`<br>`evidence/AC-65.meta.json`<br>`evidence/AC-65.output.json`<br>`evidence/AC-65.payload.json`<br>`evidence/AC-65.state.json`<br>`evidence/AC-65.status.txt`<br>`evidence/AC-65.validate-text.txt` |
