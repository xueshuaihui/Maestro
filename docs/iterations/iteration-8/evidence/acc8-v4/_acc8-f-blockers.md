# I1.8 S4 · 阻塞与未通过清单（全量 67 条）

- 生成时间：2026-11-21T13:00:09.677Z
- 条目：67 条（通过 65 / 不通过 0 / 阻塞 2）

## 阻塞（NFR-08：如实登记，不伪造）

- **AC-26** 真实 DSH：重启不重复已完成节点
  - 原因：AC-26 第二条机检（`workspace/artifacts/**` 产物 mtime 不因恢复变化）在本机实跑场景下不可取证：编码闭环实例没有 `workspace/artifacts/**`（产物在 I1.7 worktree / stage 区，强杀窗口内 stage 为空）。按 NFR-08 判「阻塞」，不用空集冒充通过、不用替代目录冒充通过；第一条机检（已完成节点无第二次 node.dispatch）已实测通过。
  - 备注：机检锚点空转：实例 C:\Users\xuesh\AppData\Local\Temp\maestro-i18-realhost\flow-ac25\project\.orch\instances\INST-001 下不存在 workspace/artifacts/**（编码闭环的产物落在 worktrees/ 与 stage/，且 stage/ 在强杀窗口内为空）；该锚点在本场景**无法取证**，不据此宣称「产物未变」，也不用替代目录冒充通过。 / 阻塞：AC-26 第二条机检（`workspace/artifacts/**` 产物 mtime 不因恢复变化）在本机实跑场景下不可取证：编码闭环实例没有 `workspace/artifacts/**`（产物在 I1.7 worktree / stage 区，强杀窗口内 stage 为空）。按 NFR-08 判「阻塞」，不用空集冒充通过、不用替代目录冒充通过；第一条机检（已完成节点无第二次 node.dispatch）已实测通过。
- **AC-27** 第三方 load 方言：真实可用则真验，否则阻塞
  - 原因：`dsh-acp-server@0.14.4` 已在 %TEMP% 真实安装（npm install 成功，95 包 / 51s），但其 ACP 服务端在本机无法启动：本机没有 `dsh` CLI（只有 Electron + app.asar/bin.js），入口直接抛错（见 AC-27.probe.third-party-boot.txt）。按需求 AC-27 判「阻塞」，load 语义由 AC-20 夹具覆盖；**不用夹具结果冒充真实面**。
  - 备注：npm 入口：C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\npm\bin\npm-cli.js / 阻塞：`dsh-acp-server@0.14.4` 已在 %TEMP% 真实安装（npm install 成功，95 包 / 51s），但其 ACP 服务端在本机无法启动：本机没有 `dsh` CLI（只有 Electron + app.asar/bin.js），入口直接抛错（见 AC-27.probe.third-party-boot.txt）。按需求 AC-27 判「阻塞」，load 语义由 AC-20 夹具覆盖；**不用夹具结果冒充真实面**。 / 尝试路径：npm view 0.14.4 → npm install 0.14.4（成功）→ node C:\Users\xuesh\AppData\Local\Temp\maestro-i18\ac27-npm\node_modules\dsh-acp-server\bin\dsh-acp.mjs --version → exit 1 / 仓库未被污染：安装目录 C:\Users\xuesh\AppData\Local\Temp\maestro-i18\ac27-npm 在仓库外（%TEMP%）。

## 不通过（核对项未满足）

- （无）

## 处置结论（主控手填；生成器按裁-20w 保留本节之后内容）

- **合并口径**：本清单由 `evidence/acc8-v4/_acc8-f-results.jsonl` 生成。59 条未变 AC 沿用 v3 原始结果与帧（`evidence/acc8/`）；8 条需求冲突按需求 v4 重跑；AC-58 / AC-62 在用户裁-21m 授权下返工夹具后重跑通过（16/16、9/9）。**v3 原始判定与帧未改**，v4 结果不覆盖 v3。
- **合并后判定：67 条 → 65 通过 / 0 不通过 / 2 阻塞**；核对项 **724（723 通过 / 1 失败）**，457 份被引用帧。唯一失败核对项属于阻塞 AC-27（第三方 load 方言不可启动）。
- **AC-26 / AC-27（阻塞 2）**：按用户裁-21b「书面豁免视为满足」在 Done 判定里视作满足；`blocked=2` 如实保留、原始帧保留、**不改判通过**，且未修改模板 §4.5 通用口径。
- **AC-58 夹具返工**：driver 新增 `--kill-when=done-running-created`，以状态驱动的 kill 窗口取代固定 1500ms；恢复后轮询终态并以双快照取证。
  **场景口径披露**：`e2e` 图的 `graphScenario` 由 `backflow` 改为 `pass`——原 backflow 首轮故意失败会回流重测 T-001，与需求 Then「已完成节点不重跑」在同一 kill 点不可兼得；改后由「交接包重投 + 已完成节点保留」承担「回流复测现场」的可验面。**此项为夹具解释，须由独立终验复核是否接受**；若判定偏离 Given，应先改需求再重跑，不得默默放行。
- **AC-62 夹具返工**：根因是 Given 的 T-002 为 `pending` 且未绑定会话，恢复重派发落到真实 DSH，mock 开关从未生效。夹具改为 T-002 `running` 并绑定 mock 会话，mock 新增 `--delivery-failures N`（前 N 次 prompt 在任何 turn 事件前返回 -32603），由**产品核心**按既有逻辑推到 `expired` + 升级；**未伪造 expired**。
- **产品缺陷 = 0**；需求冲突 8 已随需求 v4 消除（四轮独立评审终审 PASS）。Done#1 达成；Done#2 依裁-21b 视作满足。
