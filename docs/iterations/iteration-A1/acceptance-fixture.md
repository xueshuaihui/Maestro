# A1 验收记录（CLI 命令面 / mock 面 + 真实宿主面阻塞）

> 依据：`docs/iterations/iteration-A1/requirement.md` v2 §3.1（AC-01~AC-15，逐条 Given/When/Then）、附录 A-7（证据分级）、`docs/iterations/A-phase-decisions.md`（AD-01 命名 / AD-06 门禁口径 / AD-08 真实宿主判阻塞）。
> 执行：darwin / Node v22.22.2 / 仓库 `/Users/xuesh/www/Maestro`；每条 AC 一个独立项目根 `../../../../var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/<AC>/`，注入 `NODE_ENV=test`。
> 生成：`probe/accA1-f-run.mjs` 逐条取证（evidence + parts + results.jsonl，每跑完一条立即落盘）→ `probe/accA1-f-final.mjs` 重建本文件。判定只认需求原文的 Then/And；每条证据均为原始帧（stdout + registry + 中间态 + meta），可独立复核。
> 判定三档：通过 / 不通过 / 阻塞；证据分级三档：mock 实测 / 待本机实测（需装有目标 CLI 的机器）/ 已实测（真实宿主面）。

## 0. 总判

**15 条：通过 14 / 不通过 0 / 阻塞 1**

- 已产出证据：15 条；未登记或未执行：无。
- 证据文件：`docs/iterations/iteration-A1/evidence/` 下 84 个（覆盖 15 条 AC，每条 ≥4）。
- 不通过 / 阻塞条目：AC-12（阻塞）。
- 机器可读汇总：`probe/accA1-f-summary.json`；单条中间结论：`probe/accA1-f-parts/<AC>.md`；缺陷台账：`docs/iterations/iteration-A1/blockers.md`。
- 口径：`通过` = 该 AC 全部 Then/And 核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为本机无法观测（AC-12 按 AD-08：本机无目标 CLI，须在取证机上补测，mock 不顶替）。

## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 核对 / 判定）

> 原始输出全文在 `evidence/<AC>.<阶段>.stdout.txt` 与 `...output.json`；注册表快照 `...registry.json`；中间态 `...mid.json`；元信息 `AC-XX.meta.json`。

#### AC-01 PATH 上的 CLI 被自动发现并罗列（规划子项：扫描 PATH + 罗列名称/路径/状态）

- 判定：**通过**（核对 8/8 通过）
- 验证面：mock 面（发现 + 罗列）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01`

**① 完整命令（逐条可复跑）**

```
[夹具：PATH 专属目录放入 codex 可执行] "(fixture) PATH 专属目录放入 codex 可执行"   | cwd=null | exit=0 | 0ms
[orch cli scan（PATH 仅含夹具 bin）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01 | exit=0 | 125ms
[orch cli list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01 | exit=0 | 138ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-01.scan.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在一台独立临时机器上，把名为 `codex` 的可执行文件放进一个专属目录并把该目录作为唯一的命令搜索路径，`NODE_ENV=test`。
When 用户在该机器上启动应用执行扫描，随后查看 CLI 清单。
Then 清单自动出现该项，名称显示为 Codex CLI，路径显示为刚放入的可执行文件位置，连接状态显示为「可用」，来源标注为命令搜索路径；用户不需要输入任何路径。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-01.before.json` | 23 B |
| `docs/iterations/iteration-A1/evidence/AC-01.scan.stdout.txt` | 1843 B |
| `docs/iterations/iteration-A1/evidence/AC-01.scan.output.json` | 4341 B |
| `docs/iterations/iteration-A1/evidence/AC-01.scan.registry.json` | 1645 B |
| `docs/iterations/iteration-A1/evidence/AC-01.scan.mid.json` | 2087 B |
| `docs/iterations/iteration-A1/evidence/AC-01.meta.json` | 1176 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | scan 退出码为 0（期望 0） | ✅ | `0` |
| 2 | 清单自动出现该项：名称显示为 Codex CLI（期望 "Codex CLI"） | ✅ | `"Codex CLI"` |
| 3 | 路径显示为刚放入的可执行文件位置（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01/bin/codex"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01/bin/codex"` |
| 4 | 连接状态显示为「可用」（内部 idle）（期望 "idle"） | ✅ | `"idle"` |
| 5 | not_on_path=false（在 PATH 上）（期望 false） | ✅ | `false` |
| 6 | 来源标注为命令搜索路径（evidence type=path） | ✅ | `[{"type":"path","value":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01/bin/codex","note":"codex"}]` |
| 7 | 清单行含名称 / 路径 / 可用 / path | ✅ | `codex  \|  Codex CLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-01/bin/codex  \|  path` |
| 8 | 用户不需要输入任何路径：scan 未带 --path / --name | ✅ | `/Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 本机 /Applications 可能额外命中 WorkBuddy.app（unreachable），不影响 codex 行的 Then 判据；PATH/HOME 已隔离到夹具根。

---

#### AC-02 版本信息准确（规划验收句「信息准确」的版本维度）

- 判定：**通过**（核对 8/8 通过）
- 验证面：mock 面（能力探测：版本）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02`

**① 完整命令（逐条可复跑）**

```
[夹具：PATH 夹具 codex 自报版本 codex 1.2.3] "(fixture) PATH 夹具 codex 自报版本 codex 1.2.3"   | cwd=null | exit=0 | 0ms
[orch cli scan] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02 | exit=0 | 131ms
[orch cli list（探测前）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02 | exit=0 | 121ms
[orch cli probe codex（版本维度）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe codex   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02 | exit=0 | 424ms
[orch cli list（探测后）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02 | exit=0 | 115ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-02.probe.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在 AC-01 的夹具机器上，`codex` 可执行对被版本查询返回一行可识别的版本文本，`NODE_ENV=test`。
When 用户对该项执行一次探测，再查看清单。
Then 清单中该 CLI 的版本显示为探测实际读到的版本文本，与可执行文件自报版本一致；未探测前版本显示为占位而非编造值。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-02.probe.stdout.txt` | 3059 B |
| `docs/iterations/iteration-A1/evidence/AC-02.probe.output.json` | 5791 B |
| `docs/iterations/iteration-A1/evidence/AC-02.probe.registry.json` | 1684 B |
| `docs/iterations/iteration-A1/evidence/AC-02.probe.mid.json` | 1882 B |
| `docs/iterations/iteration-A1/evidence/AC-02.meta.json` | 1150 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 未探测前版本为占位 null（不编造）（期望 null） | ✅ | `null` |
| 2 | 探测前清单版本列为占位「-」 | ✅ | `codex  \|  Codex CLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02/bin/codex  \|  path` |
| 3 | probe 退出码为 0（期望 0） | ✅ | `0` |
| 4 | 探测后版本=实际读到的文本，与可执行文件自报一致（期望 "codex 1.2.3"） | ✅ | `"codex 1.2.3"` |
| 5 | 探测后清单版本列显示 codex 1.2.3 | ✅ | `codex  \|  Codex CLI  \|  codex 1.2.3  \|  未就绪  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-02/bin/codex  \|  path` |
| 6 | 版本取首个非空行（A1-11 口径）（期望 "codex 1.2.3"） | ✅ | `"codex 1.2.3"` |
| 7 | 发现阶段不自动探测：beforeF.verified_at 为 null | ✅ | `null` |
| 8 | 探测刷新 verified_at | ✅ | `"2026-11-23T14:42:54.878Z"` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 版本探测成功但 ACP 握手对纯 shell 脚本返回「不支持」，故探测后状态为未就绪；本 AC 只判版本维度。

---

#### AC-03 应用目录中的 CLI 被识别（规划子项：扫描应用目录）

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 面（发现：应用目录 / 注入接缝）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03`

**① 完整命令（逐条可复跑）**

```
[夹具：应用目录夹具放入 WorkBuddy.app 安装标记（不加入 PATH）] "(fixture) 应用目录夹具放入 WorkBuddy.app 安装标记（不加入 PATH）"   | cwd=null | exit=0 | 0ms
[注入接缝 discoverAgentClis({appDirs,home,pathEntries:[]})] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node --input-type=module -e "const idx = await import(\"file:///Users/xuesh/www/Maestro/src/adapter/cli-discovery/index.js\");\nconst scan = idx.discoverAgentClis({\"appDirs\":[\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03/apps\"],\"home\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03/home\",\"pathEntries\":[]});\nawait idx.saveCliRegistry(process.cwd(), scan, { userConfig: [] });\nprocess.stdout.write(JSON.stringify(scan));"   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03 | exit=0 | 104ms
[orch cli list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03 | exit=0 | 120ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-03.scan.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，于应用目录夹具中放置一个 `WorkBuddy.app` 安装标记，但没有把它放进命令搜索路径，`NODE_ENV=test`。
When 用户执行扫描并查看清单。
Then 清单出现 WorkBuddy，来源标注为应用目录，路径显示安装位置；因不在命令搜索路径，其连接状态显示为「未就绪」并带「已安装但不在 PATH」提示，而不是被丢弃。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-03.scan.stdout.txt` | 2267 B |
| `docs/iterations/iteration-A1/evidence/AC-03.scan.output.json` | 5115 B |
| `docs/iterations/iteration-A1/evidence/AC-03.scan.registry.json` | 953 B |
| `docs/iterations/iteration-A1/evidence/AC-03.scan.mid.json` | 1946 B |
| `docs/iterations/iteration-A1/evidence/AC-03.meta.json` | 1202 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 注入扫描退出码为 0（期望 0） | ✅ | `0` |
| 2 | 清单出现 WorkBuddy：name 逐字（期望 "WorkBuddy"） | ✅ | `"WorkBuddy"` |
| 3 | 路径/安装位置来自 app evidence（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03/apps/WorkBuddy.app"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03/apps/WorkBuddy.app"` |
| 4 | 来源标注为应用目录（evidence type=app） | ✅ | `[{"type":"app","value":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-03/apps/WorkBuddy.app"}]` |
| 5 | 不在 PATH → 状态 unreachable（用户可见「未就绪」）（期望 "unreachable"） | ✅ | `"unreachable"` |
| 6 | not_on_path=true（未被丢弃）（期望 true） | ✅ | `true` |
| 7 | executable 为 null（仅安装标记）（期望 null） | ✅ | `null` |
| 8 | 清单行含「未就绪 (已安装但不在 PATH)」原因（§2.3 允许的路径展示形态） | ✅ | `workbuddy  \|  WorkBuddy  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  app` |
| 9 | 来源概览计入 app | ✅ | `来源概览: path:0  home:0  app:1  npm-global:0  user-config:0` |
| 10 | 注册表保留该不可达项（未静默丢弃） | ✅ | `"workbuddy"` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 「路径显示安装位置」按 §2.3 口径核对：app evidence 指向夹具安装目录，清单状态列显示「已安装但不在 PATH」；未伪造 executable 路径。

---

#### AC-04 包管理器全局包被识别（规划子项：扫描包管理器）

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 面（发现：包管理器 / 注入接缝）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04`

**① 完整命令（逐条可复跑）**

```
[夹具：npm 全局根夹具放入 opencode-ai 包目录（不加入 PATH）] "(fixture) npm 全局根夹具放入 opencode-ai 包目录（不加入 PATH）"   | cwd=null | exit=0 | 0ms
[注入接缝 discoverAgentClis({npmGlobalRoot,home,pathEntries:[],appDirs:[]})] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node --input-type=module -e "const idx = await import(\"file:///Users/xuesh/www/Maestro/src/adapter/cli-discovery/index.js\");\nconst scan = idx.discoverAgentClis({\"npmGlobalRoot\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04/npm\",\"home\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04/home\",\"pathEntries\":[],\"appDirs\":[]});\nawait idx.saveCliRegistry(process.cwd(), scan, { userConfig: [] });\nprocess.stdout.write(JSON.stringify(scan));"   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04 | exit=0 | 105ms
[orch cli list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04 | exit=0 | 116ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-04.scan.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，包管理器全局根目录夹具中存在一个已知 CLI 的全局包目录（如 `opencode-ai`），且该 CLI 不在命令搜索路径，`NODE_ENV=test`。
When 用户执行扫描并查看清单。
Then 清单出现对应的 OpenCode，来源标注为包管理器全局包，路径显示全局包位置，状态为「未就绪」并提示不在 PATH。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-04.scan.stdout.txt` | 2355 B |
| `docs/iterations/iteration-A1/evidence/AC-04.scan.output.json` | 5040 B |
| `docs/iterations/iteration-A1/evidence/AC-04.scan.registry.json` | 1026 B |
| `docs/iterations/iteration-A1/evidence/AC-04.scan.mid.json` | 1951 B |
| `docs/iterations/iteration-A1/evidence/AC-04.meta.json` | 1126 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 注入扫描退出码为 0（期望 0） | ✅ | `0` |
| 2 | 清单出现对应 OpenCode：name 逐字（期望 "OpenCode"） | ✅ | `"OpenCode"` |
| 3 | 路径/全局包位置来自 npm-global evidence（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04/npm/opencode-ai"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04/npm/opencode-ai"` |
| 4 | 来源标注为包管理器全局包（evidence type=npm-global） | ✅ | `[{"type":"npm-global","value":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-04/npm/opencode-ai"}]` |
| 5 | 不在 PATH → 状态 unreachable（用户可见「未就绪」）（期望 "unreachable"） | ✅ | `"unreachable"` |
| 6 | not_on_path=true 且提示不在 PATH（期望 true） | ✅ | `true` |
| 7 | 清单行含「未就绪 (已安装但不在 PATH)」 | ✅ | `opencode  \|  OpenCode  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  npm-global` |
| 8 | 来源概览计入 npm-global | ✅ | `来源概览: path:0  home:0  app:0  npm-global:1  user-config:0` |
| 9 | 注册表保留该全局包项 | ✅ | `"opencode"` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 默认 npmGlobalRoot=null 时不臆造全局包发现；本 AC 通过注入接缝提供夹具全局根。

---

#### AC-05 用户配置 CLI 在扫描后保留（规划子项：扫描用户配置）

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 面（重扫 / 用户配置保留）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05`

**① 完整命令（逐条可复跑）**

```
[夹具：自定义可执行 mytool（自动发现识别表不含该名字）] "(fixture) 自定义可执行 mytool（自动发现识别表不含该名字）"   | cwd=null | exit=0 | 0ms
[orch cli add --name MyCLI --path <tool>] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name MyCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05 | exit=0 | 121ms
[orch cli scan（重新扫描）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05 | exit=0 | 117ms
[orch cli list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05 | exit=0 | 117ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-05.rescan.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，先按 §2.7 手动添加一个自定义 CLI 并确认成功，此时清单中有该项，`NODE_ENV=test`。
When 用户执行一次重新扫描。
Then 该自定义 CLI 仍在清单中、信息与添加时一致，不被自动发现结果覆盖或抹掉。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-05.after-add.json` | 980 B |
| `docs/iterations/iteration-A1/evidence/AC-05.after-rescan.json` | 980 B |
| `docs/iterations/iteration-A1/evidence/AC-05.rescan.stdout.txt` | 2279 B |
| `docs/iterations/iteration-A1/evidence/AC-05.rescan.output.json` | 6138 B |
| `docs/iterations/iteration-A1/evidence/AC-05.rescan.registry.json` | 1888 B |
| `docs/iterations/iteration-A1/evidence/AC-05.rescan.mid.json` | 2923 B |
| `docs/iterations/iteration-A1/evidence/AC-05.meta.json` | 1166 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | add 退出码为 0（期望 0） | ✅ | `0` |
| 2 | 添加成功写入 user_config | ✅ | `{"cli_id":"mycli","name":"MyCLI","executable":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool","version_args":["--version"],"added_at":"2026-11-23T14:42:57.687Z"}` |
| 3 | 添加时 name=MyCLI（期望 "MyCLI"） | ✅ | `"MyCLI"` |
| 4 | 添加时 path=夹具路径（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"` |
| 5 | 添加即出现在清单（cli_id=mycli）（期望 "mycli"） | ✅ | `"mycli"` |
| 6 | 重扫退出码为 0（期望 0） | ✅ | `0` |
| 7 | 重扫后 cli_id 不变（期望 "mycli"） | ✅ | `"mycli"` |
| 8 | 重扫后 path 不变（与添加时一致）（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"` |
| 9 | 重扫后 user_config 唯一（未产生重复项）（期望 1） | ✅ | `1` |
| 10 | 重扫后清单条目 cli_id 不变（期望 "mycli"） | ✅ | `"mycli"` |
| 11 | 重扫后清单 path 不变（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"` |
| 12 | 重扫后清单仍含该项（未被抹掉） | ✅ | `mycli  \|  MyCLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool  \|  user-config / MyCLI:` |
| 13 | 清单中该条目 evidence type=user-config | ✅ | `[{"type":"user-config","value":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-05/bin/mytool"}]` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- user_config 为第四类来源，registry 中以独立段持久化；重扫只刷新自动发现部分，不合写覆盖用户登记项。

---

#### AC-06 不可达 CLI 被保留并给出诊断（规划子项：不可达诊断；§2.6 异常）

- 判定：**通过**（核对 12/12 通过）
- 验证面：mock 面（诊断：不可达 / 注入接缝）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-06`

**① 完整命令（逐条可复跑）**

```
[夹具：仅 .codex home 标记，codex 不在命令搜索路径] "(fixture) 仅 .codex home 标记，codex 不在命令搜索路径"   | cwd=null | exit=0 | 0ms
[注入接缝 discoverAgentClis({home,pathEntries:[],appDirs:[]})] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node --input-type=module -e "const idx = await import(\"file:///Users/xuesh/www/Maestro/src/adapter/cli-discovery/index.js\");\nconst scan = idx.discoverAgentClis({\"home\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-06/home\",\"pathEntries\":[],\"appDirs\":[]});\nawait idx.saveCliRegistry(process.cwd(), scan, { userConfig: [] });\nprocess.stdout.write(JSON.stringify(scan));"   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-06 | exit=0 | 97ms
[orch cli list（查看不可达诊断）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-06 | exit=0 | 118ms
[orch cli probe codex（不可达项连接测试）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe codex   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-06 | exit=1 | 125ms
[orch cli list（探测后）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-06 | exit=0 | 121ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-06.diagnose.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，仅存在 `.codex` 主目录标记而 `codex` 不在命令搜索路径，清单中出现一个「未就绪」的 Codex，`NODE_ENV=test`。
When 用户查看该不可达项的诊断信息，并对它发起一次连接测试。
Then 该项仍在清单中，显示「已安装但不在 PATH」的可见原因与修复提示；连接测试失败时显示「探测失败 + 具体原因」，状态保持「未就绪」；不出现「什么都没扫到」的空态。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-06.diagnose.stdout.txt` | 3152 B |
| `docs/iterations/iteration-A1/evidence/AC-06.diagnose.output.json` | 6752 B |
| `docs/iterations/iteration-A1/evidence/AC-06.diagnose.registry.json` | 943 B |
| `docs/iterations/iteration-A1/evidence/AC-06.diagnose.mid.json` | 1980 B |
| `docs/iterations/iteration-A1/evidence/AC-06.meta.json` | 1350 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 注入扫描退出码为 0（期望 0） | ✅ | `0` |
| 2 | home marker 单独也列出：cli_id=codex（期望 "codex"） | ✅ | `"codex"` |
| 3 | executable=null（无可执行）（期望 null） | ✅ | `null` |
| 4 | not_on_path=true（期望 true） | ✅ | `true` |
| 5 | connection_status=unreachable（用户可见「未就绪」）（期望 "unreachable"） | ✅ | `"unreachable"` |
| 6 | 清单保留该项且显示「已安装但不在 PATH」可见原因 | ✅ | `codex  \|  Codex CLI  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  home` |
| 7 | 不是「什么都没扫到」的空态 | ✅ | `本机 Agent CLI / 扫描时间: 2026-11-23T14:42:58.658Z /  / 标识  \|  名称  \|  版本  \|  状态  \|  路径  \|  来源 / ------------------------------------- / codex  \|  Codex CLI  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  home` |
| 8 | 不可达项连接测试返回失败（exit 1）（期望 1） | ✅ | `1` |
| 9 | 显示「探测失败 + 具体原因」 | ✅ | `Codex CLI 探测失败：已安装但不在 PATH` |
| 10 | 探测后状态保持 unreachable（期望 "unreachable"） | ✅ | `"unreachable"` |
| 11 | 探测不伪造 ACP 支持 | ✅ | `null` |
| 12 | 清单仍保留该项（探测后不空态） | ✅ | `codex  \|  Codex CLI  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  home` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 修复提示口径：状态列「已安装但不在 PATH」即 §2.3 允许的不可达提示形态；CLI_DISCOVERY_TEXT.HINT_ADD_PATH 文案提供手动登记建议（本迭代空态段展示）。逐项修复建议的独立呈现属 D-1 差距④，另案跟进，不放宽本 AC 判据。

---

#### AC-07 能力探测握手成功并展示能力（规划子项：能力探测）

- 判定：**通过**（核对 11/11 通过）
- 验证面：mock 面（能力探测：ACP 握手）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-07`

**① 完整命令（逐条可复跑）**

```
[夹具：speaking-NDJSON 模拟 agent（initialize 应答 close/list/resume）] "(fixture) speaking-NDJSON 模拟 agent（initialize 应答 close/list/resume）"   | cwd=null | exit=0 | 0ms
[orch cli add --name MockCLI --path <mock>] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name MockCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-07/bin/codex-mock   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-07 | exit=0 | 124ms
[orch cli probe mockcli（ACP 握手）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe mockcli   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-07 | exit=0 | 685ms
[orch cli list（探测后）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-07 | exit=0 | 117ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-07.probe.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，有一个按 ACP 方言应答 `initialize` 的迷你模拟 CLI 作为探测目标，`NODE_ENV=test`（真实宿主握手见 AC-14）。
When 用户对该 CLI 执行连接测试。
Then 用户看到「探测完成：ACP 支持」的结论，并能看到该 CLI 声明的会话能力（如会话恢复/关闭/列表）；状态更新为「已连接」，最近探测时间被刷新。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-07.before-probe.json` | 707 B |
| `docs/iterations/iteration-A1/evidence/AC-07.probe.stdout.txt` | 1659 B |
| `docs/iterations/iteration-A1/evidence/AC-07.probe.output.json` | 4621 B |
| `docs/iterations/iteration-A1/evidence/AC-07.probe.registry.json` | 1323 B |
| `docs/iterations/iteration-A1/evidence/AC-07.probe.mid.json` | 2304 B |
| `docs/iterations/iteration-A1/evidence/AC-07.meta.json` | 1154 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | add 退出码为 0（期望 0） | ✅ | `0` |
| 2 | probe 退出码为 0（期望 0） | ✅ | `0` |
| 3 | 用户看到「探测完成：ACP 支持」结论 | ✅ | `MockCLI 探测完成：ACP 支持` |
| 4 | acp=true（握手成功）（期望 true） | ✅ | `true` |
| 5 | 能看到声明的会话能力 close/list/resume | ✅ | `["close","list","resume"]` |
| 6 | 状态更新为 connected（用户可见「已连接」）（期望 "connected"） | ✅ | `"connected"` |
| 7 | 最近探测时间被刷新（探测前 null → 探测后非空） | ✅ | `null → "2026-11-23T14:43:00.612Z"` |
| 8 | 清单状态列显示「已连接」 | ✅ | `mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连接  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-07/bin/codex-mock  \|  user-config / MockCLI:` |
| 9 | 未探出的维度不臆造：transport=null（期望 null） | ✅ | `null` |
| 10 | 未探出的维度不臆造：resume_dialect=null（期望 null） | ✅ | `null` |
| 11 | 未探出的维度不臆造：evidence_hook=null（期望 null） | ✅ | `null` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 握手只发 initialize，不创建真实任务会话（§2.4 / D-3）；会话能力取自 initialize 响应的 sessionCapabilities。

---

#### AC-08 探测失败/超时以可读结果呈现（§2.4 异常）

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 面（诊断：探测失败 / 超时）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08`

**① 完整命令（逐条可复跑）**

```
[夹具：卡死不响应的 CLI（sleep 8，探测默认超时 5s/10s）] "(fixture) 卡死不响应的 CLI（sleep 8，探测默认超时 5s/10s）"   | cwd=null | exit=0 | 0ms
[orch cli add --name HungCLI --path <hung>] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name HungCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08/bin/hung   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08 | exit=0 | 121ms
[orch cli probe hungcli（卡死目标）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe hungcli   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08 | exit=0 | 10127ms
[orch cli list（超时后）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08 | exit=0 | 121ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-08.timeout.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，有一个卡住不响应或崩溃的 CLI 作为探测目标，`NODE_ENV=test`。
When 用户对该 CLI 执行连接测试。
Then 应用在硬超时内返回，用户看到「探测失败 + 具体原因」，状态标为「未就绪」，清单保留该项；应用不卡死、不弹出异常堆栈。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-08.timeout.stdout.txt` | 1666 B |
| `docs/iterations/iteration-A1/evidence/AC-08.timeout.output.json` | 4145 B |
| `docs/iterations/iteration-A1/evidence/AC-08.timeout.registry.json` | 1219 B |
| `docs/iterations/iteration-A1/evidence/AC-08.timeout.mid.json` | 1572 B |
| `docs/iterations/iteration-A1/evidence/AC-08.meta.json` | 1175 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 在硬超时内返回（<20s，未无限期卡住） | ✅ | `10127ms` |
| 2 | 未抛异常堆栈 | ✅ | `（stderr 空）` |
| 3 | 用户看到「探测失败 + 具体原因」 | ✅ | `HungCLI 探测完成：ACP 不支持<br>HungCLI 探测失败：probe timed out` |
| 4 | 失败按数据返回：acp=null（不写 false 冒充不支持）（期望 null） | ✅ | `null` |
| 5 | 状态标为 unreachable（用户可见「未就绪」）（期望 "unreachable"） | ✅ | `"unreachable"` |
| 6 | 清单保留该项（不静默丢弃） | ✅ | `hungcli  \|  HungCLI  \|  -  \|  未就绪  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08/bin/hung  \|  user-config / HungCLI:` |
| 7 | 探测失败不伪造 ACP 支持 | ✅ | `hungcli  \|  HungCLI  \|  -  \|  未就绪  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-08/bin/hung  \|  user-config / HungCLI:` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- probeVersion 默认 5s、probeAcp 默认 10s 硬超时，二者并行；超时 kill 子进程并返回 {ok:false,code:CLI_PROBE_TIMEOUT}，不抛异常。

---

#### AC-09 CLI 能力矩阵横向对比（规划子项：CLI 能力矩阵）

- 判定：**通过**（核对 13/13 通过）
- 验证面：mock 面（矩阵 / 五维数据）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09`

**① 完整命令（逐条可复跑）**

```
[夹具：两个 CLI：MockCLI 已探测、StubCLI 未探测] "(fixture) 两个 CLI：MockCLI 已探测、StubCLI 未探测"   | cwd=null | exit=0 | 0ms
[add MockCLI] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name MockCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09/bin/codex-mock   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09 | exit=0 | 243ms
[add StubCLI] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name StubCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09/bin/stub   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09 | exit=0 | 227ms
[orch cli scan] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09 | exit=0 | 231ms
[orch cli probe mockcli（仅探测一个）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe mockcli   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09 | exit=0 | 780ms
[orch cli list（矩阵）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09 | exit=0 | 134ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-09.matrix.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，清单中至少有两个 CLI，其中一个已探测出 ACP/会话恢复能力、另一个尚未探测，`NODE_ENV=test`。
When 用户查看能力矩阵。
Then 矩阵按 CLI 横向展示 **ACP 支持 / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子五个维度**，已探测 CLI 的每个维度显示其真实结论，未探测 CLI 的每个维度均显示「未探测」而非空白或「不支持」；五类维度齐全、缺任一维度判不通过；矩阵结论与清单的探测结果一致，无自相矛盾。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-09.matrix.stdout.txt` | 3385 B |
| `docs/iterations/iteration-A1/evidence/AC-09.matrix.output.json` | 12752 B |
| `docs/iterations/iteration-A1/evidence/AC-09.matrix.registry.json` | 2997 B |
| `docs/iterations/iteration-A1/evidence/AC-09.matrix.mid.json` | 2632 B |
| `docs/iterations/iteration-A1/evidence/AC-09.meta.json` | 1208 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | probe 退出码为 0（期望 0） | ✅ | `0` |
| 2 | 矩阵恰好包含五类维度（逐字表头） | ✅ | `ACP  \|  stdio·transport  \|  会话恢复方言  \|  并发上限  \|  证据钩子` |
| 3 | 矩阵含维度「ACP」（期望含 "ACP"） | ✅ | `本机 Agent CLI<br>扫描时间: 2026-11-23T14:44:16.103Z<br><br>标识  \|  名称  \|  版本  \|  状态  \|  路径  \|  来源<br>-------------------------------------<br>workbuddy  \|  WorkBuddy  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  app<br>mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连` |
| 4 | 矩阵含维度「stdio·transport」（期望含 "stdio·transport"） | ✅ | `本机 Agent CLI<br>扫描时间: 2026-11-23T14:44:16.103Z<br><br>标识  \|  名称  \|  版本  \|  状态  \|  路径  \|  来源<br>-------------------------------------<br>workbuddy  \|  WorkBuddy  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  app<br>mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连` |
| 5 | 矩阵含维度「会话恢复方言」（期望含 "会话恢复方言"） | ✅ | `本机 Agent CLI<br>扫描时间: 2026-11-23T14:44:16.103Z<br><br>标识  \|  名称  \|  版本  \|  状态  \|  路径  \|  来源<br>-------------------------------------<br>workbuddy  \|  WorkBuddy  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  app<br>mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连` |
| 6 | 矩阵含维度「并发上限」（期望含 "并发上限"） | ✅ | `本机 Agent CLI<br>扫描时间: 2026-11-23T14:44:16.103Z<br><br>标识  \|  名称  \|  版本  \|  状态  \|  路径  \|  来源<br>-------------------------------------<br>workbuddy  \|  WorkBuddy  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  app<br>mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连` |
| 7 | 矩阵含维度「证据钩子」（期望含 "证据钩子"） | ✅ | `本机 Agent CLI<br>扫描时间: 2026-11-23T14:44:16.103Z<br><br>标识  \|  名称  \|  版本  \|  状态  \|  路径  \|  来源<br>-------------------------------------<br>workbuddy  \|  WorkBuddy  \|  -  \|  未就绪 (已安装但不在 PATH)  \|  -  \|  app<br>mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连` |
| 8 | 已探测 CLI 行显示真实结论：ACP=支持 | ✅ | `mockcli  \|  MockCLI  \|  codex 1.2.3  \|  已连接  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09/bin/codex-mock  \|  user-config / 未探测  \|  未探测  \|  未探测  \|  未探测  \|  未探测 / MockCLI: / 支持  \|  未探测  \|  未探测  \|  未探测  \|  未探测` |
| 9 | 已探测 CLI 未探出的维度显示「未探测」而非臆造 | ✅ | `未探测  \|  未探测  \|  未探测  \|  未探测  \|  未探测 / 支持  \|  未探测  \|  未探测  \|  未探测  \|  未探测 / 未探测  \|  未探测  \|  未探测  \|  未探测  \|  未探测` |
| 10 | 未探测 CLI 五维均为「未探测」而非空白或「不支持」 | ✅ | `stubcli  \|  StubCLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-09/bin/stub  \|  user-config / 未探测  \|  未探测  \|  未探测  \|  未探测  \|  未探测 / StubCLI: / 未探测  \|  未探测  \|  未探测  \|  未探测  \|  未探测` |
| 11 | 矩阵数据源与清单一致：已探测项 acp=true（期望 true） | ✅ | `true` |
| 12 | 矩阵数据源与清单一致：未探测项 acp=null（期望 null） | ✅ | `null` |
| 13 | 无「清单不支持而矩阵支持」的反向冲突 | ✅ | `mock.acp=true stub.acp=null` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 证据钩子维度当前无实现支撑（D-1 差距），按规划列示并显示「未探测」，不删维、不臆造；矩阵视图细节由 C1 交付，A1 判数据可支撑横向对比。

---

#### AC-10 重新扫描刷新清单（规划子项：重新扫描）

- 判定：**通过**（核对 7/7 通过）
- 验证面：mock 面（重扫刷新）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10`

**① 完整命令（逐条可复跑）**

```
[夹具：初始夹具：bin/codex + 用户手加 mytool] "(fixture) 初始夹具：bin/codex + 用户手加 mytool"   | cwd=null | exit=0 | 0ms
[orch cli add MyCLI] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name MyCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10/mytool   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10 | exit=0 | 135ms
[orch cli scan（第一次，记 N）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10 | exit=0 | 128ms
[夹具：重扫前在命令搜索路径新放 gemini] "(fixture) 重扫前在命令搜索路径新放 gemini"   | cwd=null | exit=0 | 0ms
[orch cli scan（重新扫描）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10 | exit=0 | 123ms
[orch cli list（重扫后）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10 | exit=0 | 115ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-10.rescan.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上先扫描得到清单 N 项，随后在命令搜索路径夹具中新放一个此前未发现的 CLI，`NODE_ENV=test`。
When 用户执行重新扫描并查看清单。
Then 清单项数变为 N+1，新 CLI 出现，扫描时间更新为本次；用户手动添加的条目仍在（BR-08）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-10.first-scan.json` | 121 B |
| `docs/iterations/iteration-A1/evidence/AC-10.second-scan.json` | 135 B |
| `docs/iterations/iteration-A1/evidence/AC-10.rescan.stdout.txt` | 4031 B |
| `docs/iterations/iteration-A1/evidence/AC-10.rescan.output.json` | 7964 B |
| `docs/iterations/iteration-A1/evidence/AC-10.rescan.registry.json` | 3387 B |
| `docs/iterations/iteration-A1/evidence/AC-10.rescan.mid.json` | 2778 B |
| `docs/iterations/iteration-A1/evidence/AC-10.meta.json` | 1140 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 第一次 scan 退出码 0（期望 0） | ✅ | `0` |
| 2 | 第二次 scan 退出码 0（期望 0） | ✅ | `0` |
| 3 | 清单项数 N→N+1（期望 4） | ✅ | `4` |
| 4 | 新 CLI 出现（gemini，来源 path） | ✅ | `{"cli_id":"gemini","name":"Gemini CLI","executable":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10/bin/gemini","version":null,"detected_at":"2026-11-23T14:43:14.900Z","capabilities":[],"acp":null,"transport":null,"resume_dialect":null,"` |
| 5 | 扫描时间更新为本次（scanned_at 变化） | ✅ | `"2026-11-23T14:43:14.777Z" → "2026-11-23T14:43:14.900Z"` |
| 6 | 用户手加条目仍在（BR-08：cli_id=mycli，path 不变） | ✅ | `{"cli_id":"mycli","name":"MyCLI","executable":"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10/mytool","version":null,"detected_at":"2026-11-23T14:43:14.649Z","capabilities":[],"acp":null,"transport":null,"resume_dialect":null,"evidence_h` |
| 7 | 清单可见新 CLI 与手加 CLI | ✅ | `gemini  \|  Gemini CLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10/bin/gemini  \|  path / mycli  \|  MyCLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-10/mytool  \|  user-` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 重扫覆盖写唯一缓存 .orch/cli-registry.json；自动发现部分刷新，user_config 段合并保留，不触碰 .orch 下其他文件。

---

#### AC-11 扫描只读，不改动用户机器（BR-01；§8 边界）

- 判定：**通过**（核对 9/9 通过）
- 验证面：mock 面（只读 / 安全）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-11`

**① 完整命令（逐条可复跑）**

```
[夹具：待扫夹具树：bin/codex + apps/Probe.app + home/.codex] "(fixture) 待扫夹具树：bin/codex + apps/Probe.app + home/.codex"   | cwd=null | exit=0 | 0ms
[注入接缝扫描夹具树（全部来源指向夹具）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node --input-type=module -e "const idx = await import(\"file:///Users/xuesh/www/Maestro/src/adapter/cli-discovery/index.js\");\nconst scan = idx.discoverAgentClis({\"pathEntries\":[\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-11/bin\"],\"appDirs\":[\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-11/apps\"],\"home\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-11/home\",\"npmGlobalRoot\":null});\nawait idx.saveCliRegistry(process.cwd(), scan, { userConfig: [] });\nprocess.stdout.write(JSON.stringify(scan));"   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-11 | exit=0 | 97ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-11.readonly.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上有一个待扫描的夹具目录树，记录其初始内容，`NODE_ENV=test`。
When 用户执行扫描。
Then 被扫描的目录与用户 CLI 配置前后字节不变；应用不安装软件、不写用户系统目录；唯一允许写入的是本项目缓存 `.orch/cli-registry.json`。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-11.before.json` | 178 B |
| `docs/iterations/iteration-A1/evidence/AC-11.after.json` | 224 B |
| `docs/iterations/iteration-A1/evidence/AC-11.readonly.stdout.txt` | 1932 B |
| `docs/iterations/iteration-A1/evidence/AC-11.readonly.output.json` | 4184 B |
| `docs/iterations/iteration-A1/evidence/AC-11.readonly.registry.json` | 1189 B |
| `docs/iterations/iteration-A1/evidence/AC-11.readonly.mid.json` | 476 B |
| `docs/iterations/iteration-A1/evidence/AC-11.meta.json` | 1136 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 扫描退出码 0（期望 0） | ✅ | `0` |
| 2 | 被扫 bin 目录字节不变（期望 "{\"codex\":\"46930c4f61304d72daf844403664ba700b6c425a5c53959c02c6f51737958a4f\"}"） | ✅ | `"{\"codex\":\"46930c4f61304d72daf844403664ba700b6c425a5c53959c02c6f51737958a4f\"}"` |
| 3 | 被扫 apps 目录字节不变（期望 "{\"Probe.app/\":\"dir\"}"） | ✅ | `"{\"Probe.app/\":\"dir\"}"` |
| 4 | 被扫 home 目录字节不变（期望 "{\".codex/\":\"dir\"}"） | ✅ | `"{\".codex/\":\"dir\"}"` |
| 5 | 唯一写入是 .orch/cli-registry.json（期望 "cli-registry.json"） | ✅ | `"cli-registry.json"` |
| 6 | 注册表可读（写入成功） | ✅ | `true` |
| 7 | 零运行时依赖（NF-4）（期望 0） | ✅ | `0` |
| 8 | 发现阶段无写操作（writeFile\|mkdir\|appendFile 零命中）（期望 0） | ✅ | `0` |
| 9 | 领域层零 CJK（中文唯一来源 labels.js）（期望 false） | ✅ | `false` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 只读硬约束：扫描不 spawn、不写扫描目录；缓存写入仅在 registry.js 的 saveCliRegistry（原子写）。

---

#### AC-12 规划验收句①（真实宿主面）：装了至少一种 Agent CLI 的机器启动应用自动列出且信息准确

- 判定：**阻塞**（核对 2/6 通过，阻塞 4）
- 验证面：真实宿主面（AD-08 阻塞）
- 证据分级：**待本机实测（需装有目标 CLI 的机器）**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-12`

**① 完整命令（逐条可复跑）**

```
[隔离夹具扫描（PATH/app/home/npm 全空）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node --input-type=module -e "const idx = await import(\"file:///Users/xuesh/www/Maestro/src/adapter/cli-discovery/index.js\");\nconst scan = idx.discoverAgentClis({\"pathEntries\":[],\"appDirs\":[],\"npmGlobalRoot\":null,\"home\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-12/home\"});\nawait idx.saveCliRegistry(process.cwd(), scan, { userConfig: [] });\nprocess.stdout.write(JSON.stringify(scan));"   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-12 | exit=0 | 206ms
[orch cli probe codex（隔离夹具目标）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe codex   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-12 | exit=1 | 169ms
[orch cli probe claude（隔离夹具目标）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe claude   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-12 | exit=1 | 136ms
[orch cli probe gemini（隔离夹具目标）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe gemini   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-12 | exit=1 | 133ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-12.blocked.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given **需一台装有目标 Agent CLI 的机器**（如装有 Codex CLI 且其在命令搜索路径中）。本机当前无真实 Agent CLI（AD-08 / D-2 / D-4），此 Given 在本机不可构造；未取得该机器前本 AC 判**阻塞**，不判通过、不用 mock 顶替。
When 用户在该机器上启动应用执行一次扫描，随后查看 CLI 清单。
Then 清单自动列出该目标 CLI，名称、路径、版本、连接状态与实际安装情况一致；用户不需要任何手写配置或命令行参数。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-12.host-observation.json` | 192 B |
| `docs/iterations/iteration-A1/evidence/AC-12.blocked.stdout.txt` | 1518 B |
| `docs/iterations/iteration-A1/evidence/AC-12.blocked.output.json` | 4424 B |
| `docs/iterations/iteration-A1/evidence/AC-12.blocked.registry.json` | 284 B |
| `docs/iterations/iteration-A1/evidence/AC-12.blocked.mid.json` | 1082 B |
| `docs/iterations/iteration-A1/evidence/AC-12.meta.json` | 2131 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | Given：一台装有目标 Agent CLI 且其可执行在命令搜索路径中的机器 | ⛔ 阻塞 | `本机 PATH 实测无 codex/claude/gemini 可执行；仅有应用/home 安装标记，不具有可执行载体（AD-08 / D-2 / D-4）。` |
| 2 | Then：清单自动列出该目标 CLI，名称/路径/版本/连接状态四项与实际一致 | ⛔ 阻塞 | `无真实宿主可执行可供 scan 发现，无法取得 which <bin> / <bin> --version 实测对照；隔离夹具对三个目标的 probe 全部「未找到 CLI」（exit 1）。` |
| 3 | When：在该机器启动应用执行扫描并查看清单 | ⛔ 阻塞 | `本机隔离夹具扫描 0 项可驱动目标；该项须在装有目标 CLI 的取证机上执行。` |
| 4 | 用户不需要任何手写配置或命令行参数 | ⛔ 阻塞 | `目标 CLI 不存在，真实宿主面该可观测性无法在本机取证（mock 面 AC-14 的证明不得顶替）。` |
| 5 | 未用 mock 冒充真实宿主达标：证据级别为待本机实测 | ✅ | `待本机实测（需装有目标 CLI 的机器）；onPath=[]` |
| 6 | 留下只读观测原始证据（PATH/应用/home 均记录） | ✅ | `PATH 扫描（40 目录 × codex/claude/gemini）：未检出可执行 ｜ 应用目录证据：/Applications/WorkBuddy.app；本机 WorkBuddy.app 仅安装标记、不在 PATH 且无可执行 ｜ home 标记证据：未检出` |

**⑤ 判定**：阻塞　|　**证据分级**：待本机实测（需装有目标 CLI 的机器）

**备注**

- 需求要求：在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且名称/路径/版本/连接状态四项与实际一致（规划 385 行，AC-12 Then 不写 orch 字面）。
- 试过路径：PATH 扫描（40 目录 × codex/claude/gemini）：未检出可执行；应用目录证据：/Applications/WorkBuddy.app；本机 WorkBuddy.app 仅安装标记、不在 PATH 且无可执行；home 标记证据：未检出
- 为什么观测不到：本机 PATH 无真实 codex/claude/gemini 可执行；/Applications/WorkBuddy.app 仅为安装标记、不在 PATH 且无可执行；无真实宿主握手现场（mock 面 AC-14 仅供逻辑复现，不构成真实宿主达标）。
- 升级建议：请主控按 D-4 在装有目标 CLI 的机器上取证（独立项目根执行 NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan，对照 which <bin> / <bin> --version）；收口若仍阻塞，按执行模板 §4.5 升级用户书面豁免，豁免前不判通过。

---

#### AC-13 规划验收句②：手动添加自定义 CLI 可执行

- 判定：**通过**（核对 18/18 通过）
- 验证面：mock 面（手动添加）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13`

**① 完整命令（逐条可复跑）**

```
[夹具：自定义可执行 mytool（speaking agent，自动发现不识别）] "(fixture) 自定义可执行 mytool（speaking agent，自动发现不识别）"   | cwd=null | exit=0 | 0ms
[orch cli add --name MyCLI --path <mytool>] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name MyCLI --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=0 | 241ms
[orch cli list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=0 | 168ms
[orch cli probe mycli（连接测试）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe mycli   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=0 | 773ms
[orch cli add 重复路径] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name MyCLI2 --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=1 | 138ms
[orch cli add 空名称] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name  --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=1 | 128ms
[orch cli add 空路径] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name X --path    | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=1 | 130ms
[orch cli add 不存在文件] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli add --name X --path /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/nope   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13 | exit=1 | 130ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-13.add.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上有一个自定义可执行文件（自动发现不会识别），准备添加它，`NODE_ENV=test`。
When 用户执行添加，提供名称与该可执行文件路径，随后查看清单。
Then 该自定义 CLI 出现在清单中，名称与路径与用户填写一致；用户可对它执行连接测试并看到结果；重复添加同一路径被拒绝且不产生重复项；非法输入（空名称、空路径、不存在文件）被拒绝并给出原因、不写入清单。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-13.add.stdout.txt` | 2942 B |
| `docs/iterations/iteration-A1/evidence/AC-13.add.output.json` | 8146 B |
| `docs/iterations/iteration-A1/evidence/AC-13.add.registry.json` | 1302 B |
| `docs/iterations/iteration-A1/evidence/AC-13.add.mid.json` | 867 B |
| `docs/iterations/iteration-A1/evidence/AC-13.meta.json` | 1108 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | add 退出码 0（期望 0） | ✅ | `0` |
| 2 | 添加成功提示含名称与路径 | ✅ | `已添加 MyCLI  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool` |
| 3 | 清单中该 CLI 名称与用户填写一致（期望 "MyCLI"） | ✅ | `"MyCLI"` |
| 4 | 清单中该 CLI 路径与用户填写一致（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool"` |
| 5 | 出现在清单中 | ✅ | `mycli  \|  MyCLI  \|  -  \|  可用  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool  \|  user-config / MyCLI:` |
| 6 | 可连接测试：probe 退出码 0（期望 0） | ✅ | `0` |
| 7 | 连接测试结果可见（ACP 支持） | ✅ | `MyCLI 探测完成：ACP 支持` |
| 8 | 探测结果写入该项（acp=true）（期望 true） | ✅ | `true` |
| 9 | 重复添加同路径被拒绝（exit 1）（期望 1） | ✅ | `1` |
| 10 | 重复添加给出「已存在」原因 | ✅ | `已存在：/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-13/bin/mytool（未重复添加）` |
| 11 | 重复添加不产生重复项：user_config 仍为 1（期望 1） | ✅ | `1` |
| 12 | 空名称被拒绝（期望 1） | ✅ | `1` |
| 13 | 空名称给出原因 | ✅ | `添加失败：名称为空` |
| 14 | 空路径被拒绝（期望 1） | ✅ | `1` |
| 15 | 空路径给出原因 | ✅ | `添加失败：路径为空` |
| 16 | 不存在文件被拒绝（期望 1） | ✅ | `1` |
| 17 | 不存在文件给出原因 | ✅ | `添加失败：文件不存在` |
| 18 | 非法输入均不写入清单：user_config 恒为 1（期望 1） | ✅ | `1` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- add 只登记路径，不安装、不修改该 CLI 自身配置；非法/重复输入返回失败数据，不改变注册表。

---

#### AC-14 规划验收句①的 mock 可复现面：自动发现 + 四项信息准确

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 面（验收句支撑：AC-01+02+07 串联）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14`

**① 完整命令（逐条可复跑）**

```
[夹具：夹具「装了至少一种 Agent CLI」：PATH 专属目录 codex（版本 + ACP）] "(fixture) 夹具「装了至少一种 Agent CLI」：PATH 专属目录 codex（版本 + ACP）"   | cwd=null | exit=0 | 0ms
[orch cli scan（PATH 专属夹具，无参数）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14 | exit=0 | 127ms
[orch cli probe codex（显式连接测试）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe codex   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14 | exit=0 | 714ms
[orch cli list] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14 | exit=0 | 125ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-14.flow.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，用夹具构造一个「装了至少一种 Agent CLI」的环境：专属命令搜索路径中有一个返回可识别版本的 `codex` 可执行，`NODE_ENV=test`。
When 用户启动应用执行扫描，随后对发现的项执行连接测试，再查看清单。
Then 清单自动列出 Codex CLI，名称、路径、版本、连接状态四项与夹具实际值一致（路径=夹具可执行位置、版本=夹具自报版本、状态探测后为「已连接」），用户无需输入任何配置。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-14.flow.stdout.txt` | 2146 B |
| `docs/iterations/iteration-A1/evidence/AC-14.flow.output.json` | 5310 B |
| `docs/iterations/iteration-A1/evidence/AC-14.flow.registry.json` | 1738 B |
| `docs/iterations/iteration-A1/evidence/AC-14.flow.mid.json` | 2478 B |
| `docs/iterations/iteration-A1/evidence/AC-14.meta.json` | 1208 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | scan 退出码 0（期望 0） | ✅ | `0` |
| 2 | probe 退出码 0（期望 0） | ✅ | `0` |
| 3 | ①名称：清单自动列出 Codex CLI（与夹具一致）（期望 "Codex CLI"） | ✅ | `"Codex CLI"` |
| 4 | ②路径：=夹具可执行位置（期望 "/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14/bin/codex"） | ✅ | `"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14/bin/codex"` |
| 5 | ③版本：=夹具自报版本 codex 1.2.3（期望 "codex 1.2.3"） | ✅ | `"codex 1.2.3"` |
| 6 | ④状态：探测后为已连接（connected）（期望 "connected"） | ✅ | `"connected"` |
| 7 | 发现阶段不探测：探测前状态 idle（期望 "idle"） | ✅ | `"idle"` |
| 8 | 清单四项同时可见 | ✅ | `codex  \|  Codex CLI  \|  codex 1.2.3  \|  已连接  \|  /var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-14/bin/codex  \|  path` |
| 9 | 用户无需输入任何配置：scan/probe 未带 --name/--path | ✅ | `/Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli scan ｜ /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli probe codex` |
| 10 | 证据分级严格为 mock 实测（不冒充 AC-12 真实宿主）（期望 "mock 实测"） | ✅ | `"mock 实测"` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 本 AC 为 AC-12 规划验收句①的 mock 支撑面（AC-01 + AC-02 + AC-07 三夹具串联）；证据级别 mock 实测，按附录 A-7 与 AC-12 待本机实测严格分开。

---

#### AC-15 空态与来源概览可见（§2.3 / §2.6 异常）

- 判定：**通过**（核对 10/10 通过）
- 验证面：mock 面（罗列：空态 + 来源概览）
- 证据分级：**mock 实测**
- 项目根：`/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-15`

**① 完整命令（逐条可复跑）**

```
[夹具：四类来源夹具均为空（PATH/app/npm/home 全空）] "(fixture) 四类来源夹具均为空（PATH/app/npm/home 全空）"   | cwd=null | exit=0 | 0ms
[注入接缝扫描全空来源] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node --input-type=module -e "const idx = await import(\"file:///Users/xuesh/www/Maestro/src/adapter/cli-discovery/index.js\");\nconst scan = idx.discoverAgentClis({\"pathEntries\":[],\"appDirs\":[],\"npmGlobalRoot\":null,\"home\":\"/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-15/home\"});\nawait idx.saveCliRegistry(process.cwd(), scan, { userConfig: [] });\nprocess.stdout.write(JSON.stringify(scan));"   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-15 | exit=0 | 100ms
[orch cli list（空态）] /Users/xuesh/.workbuddy/binaries/node/versions/22.22.2-6/bin/node /Users/xuesh/www/Maestro/bin/orch.js cli list   | cwd=/var/folders/d0/57v137rs2mdfkc6yx8pslf6h0000gn/T/maestro-acc-a1/AC-15 | exit=0 | 114ms
```

> 每条命令 stdout+stderr 原始帧见 `docs/iterations/iteration-A1/evidence/AC-15.empty.stdout.txt` 与 `...output.json`。

**② 需求原文（Given / When / Then，逐字）**

```
Given 用户在独立临时机器上，四类来源夹具均为空（没有可执行、没有应用标记、没有全局包、没有用户配置），`NODE_ENV=test`。
When 用户执行扫描并查看清单。
Then 用户看到明确的空态提示与「请安装一个 Agent CLI 后重新扫描」的引导，而不是空白页；同时看到来源概览（扫描了哪些来源、各自发现 0 项）。
```

**③ 实测证据文件清单**

| 文件 | 大小 |
|---|---|
| `docs/iterations/iteration-A1/evidence/AC-15.empty.stdout.txt` | 1663 B |
| `docs/iterations/iteration-A1/evidence/AC-15.empty.output.json` | 4345 B |
| `docs/iterations/iteration-A1/evidence/AC-15.empty.registry.json` | 284 B |
| `docs/iterations/iteration-A1/evidence/AC-15.empty.mid.json` | 901 B |
| `docs/iterations/iteration-A1/evidence/AC-15.meta.json` | 1119 B |

**④ 逐项核对表**

| # | 核对项 | 结果 | 实测 |
|---|---|---|---|
| 1 | 扫描退出码 0（期望 0） | ✅ | `0` |
| 2 | 无证据即无 finding（误报 0）（期望 0） | ✅ | `0` |
| 3 | list 退出码 0（期望 0） | ✅ | `0` |
| 4 | 明确空态提示「未发现可用的 Agent CLI」 | ✅ | `本机 Agent CLI / 扫描时间: 2026-11-23T14:43:21.671Z /  / 未发现可用的 Agent CLI / 请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描` |
| 5 | 安装后重新扫描的引导（逐字） | ✅ | `请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描` |
| 6 | 修复建议可见（手动添加路径） | ✅ | `修复建议：可用 orch cli add --name <名称> --path <可执行路径> 手动登记该 CLI` |
| 7 | 来源概览可见（扫描了哪些来源） | ✅ | `来源概览: path:0  home:0  app:0  npm-global:0  user-config:0` |
| 8 | 各来源均发现 0 项 | ✅ | `来源概览: path:0  home:0  app:0  npm-global:0  user-config:0` |
| 9 | 不是空白页（含标题 + 空态 + 引导 + 来源概览） | ✅ | `351 字节 / 13 行` |
| 10 | 五列矩阵表头仍在空态显示 | ✅ | `ACP  \|  stdio·transport  \|  会话恢复方言  \|  并发上限  \|  证据钩子` |

**⑤ 判定**：通过　|　**证据分级**：mock 实测

**备注**

- 空态判定走 CLI_DISCOVERY_TEXT.NONE / NONE_HINT / HINT_ADD_PATH 文案键，不依赖真实本机 PATH/HOME。

---

## 2. 未通过 / 阻塞项汇总

| AC | 判定 | 证据分级 | 未成立 / 阻塞的核对项 | 备注 |
|---|---|---|---|---|
| AC-12 | 阻塞 | 待本机实测（需装有目标 CLI 的机器） | - Given：一台装有目标 Agent CLI 且其可执行在命令搜索路径中的机器：`本机 PATH 实测无 codex/claude/gemini 可执行；仅有应用/home 安装标记，不具有可执行载体（AD-08 / D-2 / D-4）。`<br>- Then：清单自动列出该目标 CLI，名称/路径/版本/连接状态四项与实际一致：`无真实宿主可执行可供 scan 发现，无法取得 which <bin> / <bin> --version 实测对照；隔离夹具对三个目标的 probe 全部「未找到 CLI」（exit 1）。`<br>- When：在该机器启动应用执行扫描并查看清单：`本机隔离夹具扫描 0 项可驱动目标；该项须在装有目标 CLI 的取证机上执行。`<br>- 用户不需要任何手写配置或命令行参数：`目标 CLI 不存在，真实宿主面该可观测性无法在本机取证（mock 面 AC-14 的证明不得顶替）。` | 需求要求：在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且名称/路径/版本/连接状态四项与实际一致（规划 385 行，AC-12 Then 不写 orch 字面）。；试过路径：PATH 扫描（40 目录 × codex/claude/gemini）：未检出可执行；应用目录证据：/Applications/WorkBuddy.app；本机 WorkBuddy.app |

## 3. 证据索引

共 84 个文件；每条 AC 至少 `stdout.txt` / `output.json` / `registry.json` / `mid.json` / `meta.json`。

| AC | 判定 | 证据分级 | 文件数 | 证据文件 |
|---|---|---|---|---|
| AC-01 | 通过 | mock 实测 | 6 | `evidence/AC-01.before.json`<br>`evidence/AC-01.meta.json`<br>`evidence/AC-01.scan.mid.json`<br>`evidence/AC-01.scan.output.json`<br>`evidence/AC-01.scan.registry.json`<br>`evidence/AC-01.scan.stdout.txt` |
| AC-02 | 通过 | mock 实测 | 5 | `evidence/AC-02.meta.json`<br>`evidence/AC-02.probe.mid.json`<br>`evidence/AC-02.probe.output.json`<br>`evidence/AC-02.probe.registry.json`<br>`evidence/AC-02.probe.stdout.txt` |
| AC-03 | 通过 | mock 实测 | 5 | `evidence/AC-03.meta.json`<br>`evidence/AC-03.scan.mid.json`<br>`evidence/AC-03.scan.output.json`<br>`evidence/AC-03.scan.registry.json`<br>`evidence/AC-03.scan.stdout.txt` |
| AC-04 | 通过 | mock 实测 | 5 | `evidence/AC-04.meta.json`<br>`evidence/AC-04.scan.mid.json`<br>`evidence/AC-04.scan.output.json`<br>`evidence/AC-04.scan.registry.json`<br>`evidence/AC-04.scan.stdout.txt` |
| AC-05 | 通过 | mock 实测 | 7 | `evidence/AC-05.after-add.json`<br>`evidence/AC-05.after-rescan.json`<br>`evidence/AC-05.meta.json`<br>`evidence/AC-05.rescan.mid.json`<br>`evidence/AC-05.rescan.output.json`<br>`evidence/AC-05.rescan.registry.json`<br>`evidence/AC-05.rescan.stdout.txt` |
| AC-06 | 通过 | mock 实测 | 5 | `evidence/AC-06.diagnose.mid.json`<br>`evidence/AC-06.diagnose.output.json`<br>`evidence/AC-06.diagnose.registry.json`<br>`evidence/AC-06.diagnose.stdout.txt`<br>`evidence/AC-06.meta.json` |
| AC-07 | 通过 | mock 实测 | 6 | `evidence/AC-07.before-probe.json`<br>`evidence/AC-07.meta.json`<br>`evidence/AC-07.probe.mid.json`<br>`evidence/AC-07.probe.output.json`<br>`evidence/AC-07.probe.registry.json`<br>`evidence/AC-07.probe.stdout.txt` |
| AC-08 | 通过 | mock 实测 | 5 | `evidence/AC-08.meta.json`<br>`evidence/AC-08.timeout.mid.json`<br>`evidence/AC-08.timeout.output.json`<br>`evidence/AC-08.timeout.registry.json`<br>`evidence/AC-08.timeout.stdout.txt` |
| AC-09 | 通过 | mock 实测 | 5 | `evidence/AC-09.matrix.mid.json`<br>`evidence/AC-09.matrix.output.json`<br>`evidence/AC-09.matrix.registry.json`<br>`evidence/AC-09.matrix.stdout.txt`<br>`evidence/AC-09.meta.json` |
| AC-10 | 通过 | mock 实测 | 7 | `evidence/AC-10.first-scan.json`<br>`evidence/AC-10.meta.json`<br>`evidence/AC-10.rescan.mid.json`<br>`evidence/AC-10.rescan.output.json`<br>`evidence/AC-10.rescan.registry.json`<br>`evidence/AC-10.rescan.stdout.txt`<br>`evidence/AC-10.second-scan.json` |
| AC-11 | 通过 | mock 实测 | 7 | `evidence/AC-11.after.json`<br>`evidence/AC-11.before.json`<br>`evidence/AC-11.meta.json`<br>`evidence/AC-11.readonly.mid.json`<br>`evidence/AC-11.readonly.output.json`<br>`evidence/AC-11.readonly.registry.json`<br>`evidence/AC-11.readonly.stdout.txt` |
| AC-12 | 阻塞 | 待本机实测（需装有目标 CLI 的机器） | 6 | `evidence/AC-12.blocked.mid.json`<br>`evidence/AC-12.blocked.output.json`<br>`evidence/AC-12.blocked.registry.json`<br>`evidence/AC-12.blocked.stdout.txt`<br>`evidence/AC-12.host-observation.json`<br>`evidence/AC-12.meta.json` |
| AC-13 | 通过 | mock 实测 | 5 | `evidence/AC-13.add.mid.json`<br>`evidence/AC-13.add.output.json`<br>`evidence/AC-13.add.registry.json`<br>`evidence/AC-13.add.stdout.txt`<br>`evidence/AC-13.meta.json` |
| AC-14 | 通过 | mock 实测 | 5 | `evidence/AC-14.flow.mid.json`<br>`evidence/AC-14.flow.output.json`<br>`evidence/AC-14.flow.registry.json`<br>`evidence/AC-14.flow.stdout.txt`<br>`evidence/AC-14.meta.json` |
| AC-15 | 通过 | mock 实测 | 5 | `evidence/AC-15.empty.mid.json`<br>`evidence/AC-15.empty.output.json`<br>`evidence/AC-15.empty.registry.json`<br>`evidence/AC-15.empty.stdout.txt`<br>`evidence/AC-15.meta.json` |
