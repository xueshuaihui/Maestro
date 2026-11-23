# A1 缺陷 / 阻塞台账

> 由 `probe/accA1-f-final.mjs` 从 results.jsonl 重建；只登记非「通过」条目。
> 判定三档：通过 / 不通过 / 阻塞；证据分级三档：mock 实测 / 待本机实测 / 已实测（真实宿主面）。

## 总览：通过 14 / 不通过 0 / 阻塞 1

## AC-12 · 阻塞（证据分级：待本机实测（需装有目标 CLI 的机器））

**未成立 / 阻塞的核对项**

- Given：一台装有目标 Agent CLI 且其可执行在命令搜索路径中的机器：`本机 PATH 实测无 codex/claude/gemini 可执行；仅有应用/home 安装标记，不具有可执行载体（AD-08 / D-2 / D-4）。`
- Then：清单自动列出该目标 CLI，名称/路径/版本/连接状态四项与实际一致：`无真实宿主可执行可供 scan 发现，无法取得 which <bin> / <bin> --version 实测对照；隔离夹具对三个目标的 probe 全部「未找到 CLI」（exit 1）。`
- When：在该机器启动应用执行扫描并查看清单：`本机隔离夹具扫描 0 项可驱动目标；该项须在装有目标 CLI 的取证机上执行。`
- 用户不需要任何手写配置或命令行参数：`目标 CLI 不存在，真实宿主面该可观测性无法在本机取证（mock 面 AC-14 的证明不得顶替）。`

**取证说明 / 备注**

- 需求要求：在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且名称/路径/版本/连接状态四项与实际一致（规划 385 行，AC-12 Then 不写 orch 字面）。
- 试过路径：PATH 扫描（40 目录 × codex/claude/gemini）：未检出可执行；应用目录证据：/Applications/WorkBuddy.app；本机 WorkBuddy.app 仅安装标记、不在 PATH 且无可执行；home 标记证据：未检出
- 为什么观测不到：本机 PATH 无真实 codex/claude/gemini 可执行；/Applications/WorkBuddy.app 仅为安装标记、不在 PATH 且无可执行；无真实宿主握手现场（mock 面 AC-14 仅供逻辑复现，不构成真实宿主达标）。
- 升级建议：请主控按 D-4 在装有目标 CLI 的机器上取证（独立项目根执行 NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan，对照 which <bin> / <bin> --version）；收口若仍阻塞，按执行模板 §4.5 升级用户书面豁免，豁免前不判通过。

### AC-12 取证前提与升级建议

- 取证前提：一台装有目标 Agent CLI 且其可在命令搜索路径中执行的机器（D-4 / P-4）。
- 升级建议：收口时若仍阻塞，按执行模板 §4.5 升级用户书面豁免；豁免前 AC-12 不判通过，AC-14 的 mock 实测不得写成真实宿主达标。
- 取证动作：在取证机独立项目根执行 `NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan`，断言四项字段与 `which <bin>` / `<bin> --version` 实测一致。

---
