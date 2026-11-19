# WP-7 末批 · 阻塞与未通过清单

- 生成时间：2026-11-19T17:02:55.303Z
- 条目：9 条（通过 5 / 不通过 2 / 阻塞 2）

## 阻塞（NFR-08：如实登记，不伪造）

- **AC-26** 真实 DSH：重启不重复已完成节点
  - 原因：AC-26 第二条机检（`workspace/artifacts/**` 产物 mtime 不因恢复变化）在本机实跑场景下不可取证：编码闭环实例没有 `workspace/artifacts/**`（产物在 I1.7 worktree / stage 区，强杀窗口内 stage 为空）。按 NFR-08 判「阻塞」，不用空集冒充通过、不用替代目录冒充通过；第一条机检（已完成节点无第二次 node.dispatch）已实测通过。
  - 备注：机检锚点空转：实例 C:\Users\xuesh\AppData\Local\Temp\maestro-i18-realhost\flow-ac25\project\.orch\instances\INST-001 下不存在 workspace/artifacts/**（编码闭环的产物落在 worktrees/ 与 stage/，且 stage/ 在强杀窗口内为空）；该锚点在本场景**无法取证**，不据此宣称「产物未变」，也不用替代目录冒充通过。 / 阻塞：AC-26 第二条机检（`workspace/artifacts/**` 产物 mtime 不因恢复变化）在本机实跑场景下不可取证：编码闭环实例没有 `workspace/artifacts/**`（产物在 I1.7 worktree / stage 区，强杀窗口内 stage 为空）。按 NFR-08 判「阻塞」，不用空集冒充通过、不用替代目录冒充通过；第一条机检（已完成节点无第二次 node.dispatch）已实测通过。
- **AC-27** 第三方 load 方言：真实可用则真验，否则阻塞
  - 原因：`dsh-acp-server@0.14.4` 已在 %TEMP% 真实安装（npm install 成功，95 包 / 51s），但其 ACP 服务端在本机无法启动：本机没有 `dsh` CLI（只有 Electron + app.asar/bin.js），入口直接抛错（见 AC-27.probe.third-party-boot.txt）。按需求 AC-27 判「阻塞」，load 语义由 AC-20 夹具覆盖；**不用夹具结果冒充真实面**。
  - 备注：npm 入口：C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node_modules\npm\bin\npm-cli.js / 阻塞：`dsh-acp-server@0.14.4` 已在 %TEMP% 真实安装（npm install 成功，95 包 / 51s），但其 ACP 服务端在本机无法启动：本机没有 `dsh` CLI（只有 Electron + app.asar/bin.js），入口直接抛错（见 AC-27.probe.third-party-boot.txt）。按需求 AC-27 判「阻塞」，load 语义由 AC-20 夹具覆盖；**不用夹具结果冒充真实面**。 / 尝试路径：npm view 0.14.4 → npm install 0.14.4（成功）→ node C:\Users\xuesh\AppData\Local\Temp\maestro-i18\ac27-npm\node_modules\dsh-acp-server\bin\dsh-acp.mjs --version → exit 1 / 仓库未被污染：安装目录 C:\Users\xuesh\AppData\Local\Temp\maestro-i18\ac27-npm 在仓库外（%TEMP%）。

## 不通过（核对项未满足）

- **AC-53** 全量测试回归门禁：失败集合差集为 0
  - C02 新增失败集合（差集）为空：期望 `[]`，实测 `["--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）","reconcileOnBoot：v2 旧 generation 运行中实例按实例记录恢复；v1 保持原样"]`
- **AC-56** I1.7 已合入：恢复实现不依赖 worktree / 产物隔离（按裁-12 重判）
  - C04 grep -R -E "artifact_type.*dir|merge.*order" src/core src/daemon | wc -l = 0：期望 `0`，实测 `2`
