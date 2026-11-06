# probe/acc3-cases —— I1.3 验收用例注册表

一条 AC 一个文件（或一个文件里 `export const cases = [...]` 多条）。**放在本目录的 `.mjs` 会被 `probe/acc3-f-run.mjs` 自动加载**；`_` 开头的文件（模板/草稿）不加载。

## 新增一条 AC 用例：5 步

1. **照抄需求原文**：打开 `docs/iterations/iteration-3/requirement.md` §3.1，找到该 AC 的 `Given / When / Then / And`。**一个 Then/And 至少一条核对项**，逐字照抄期望值，不许放宽、不许合并。
2. **建文件**：`cp probe/acc3-cases/_template.mjs probe/acc3-cases/acNN.mjs`（NN 两位；也可直接写 `export const cases = [{ac,title,face,run}]`）。
3. **填 `run()`**：
   - `const c = makeCase('AC-xx', { title: requirementTitle('AC-xx'), face })`
   - `const root = freshRoot('AC-xx'); c.add(root)` —— **一个 AC 一个独立根**（`%TEMP%/maestro-acc-p3/AC-xx`）；同 AC 需要"另起全新根"时用 `freshRoot('AC-xx-b')` 再 `c.add(...)`。
   - 构造 Given/When：`prepareOnly` / `runSync(root, '场景名')` / `startKeep(root, '场景名', ['--stop-after','2'])` + `await h.waitMarker(2)` 或 `await h.waitFile('paused')`；产品命令用 `statusText` / `statusEvents` / `cancel` / `coreStop` / `runProduct`。
   - 每条断言：`c.eq / c.includes / c.notIncludes / c.matches / c.check`；机检读 `readState` / `readEvents` / `readJson(promptOf(root, n))`。
   - **观测不到就 `c.block('核对项', '原因 + 已尝试的路径')`**（例如真实宿主专属），不要为了"过"而改断言。
   - `finally` 里 `await h.stop()` + `c.cmd(coreStop(root))` + `await forceKillCore(root)`；最后 `return finish(c)`。
4. **补证据**：`finish(c)` 自动落 `docs/iterations/iteration-3/evidence/AC-xx.{state.json,events.jsonl,meta.json,output.json,status.txt}`、`probe/acc3-f-parts/AC-xx.md`、追加 `probe/acc3-f-results.jsonl`。断言时刻的中间态用 `c.snap(root, 'state.live')` 另存快照。
5. **跑 + 复核**：
   ```bash
   node probe/acc3-f-run.mjs AC-xx      # 单条；退出码 0 只代表"跑完并落了判定"
   node probe/acc3-f-run.mjs --batch a  # 整批
   node probe/acc3-f-final.mjs          # 重建 docs/iterations/iteration-3/acceptance-fixture.md
   ```
   打开 `probe/acc3-f-parts/AC-xx.md` 自检：命令可复跑、证据清单非空、核对表逐项有实测值。

## 批次划分（固定）

| 批 | 范围 | 命令 |
|---|---|---|
| a | AC-01 ~ AC-12 | `node probe/acc3-f-run.mjs --batch a` |
| b | AC-13 ~ AC-21 | `node probe/acc3-f-run.mjs --batch b` |
| c | AC-22 ~ AC-35 | `node probe/acc3-f-run.mjs --batch c` |
| d | AC-36 ~ AC-39 + AC-41 ~ AC-45 | `node probe/acc3-f-run.mjs --batch d` |
| e | AC-40（真实宿主） | `node probe/acc3-f-run.mjs --batch e` |

## 可用的原语（都在 `../acc3-f-common.mjs`）

- 环境/路径：`REPO` `BASE` `EVID` `ACC3_PATHS` `freshRoot` `baseEnv`（已注入 `NODE_ENV=test`、清 `ELECTRON_RUN_AS_NODE`）
- 夹具：`scenario(name)` `scenarioStep(name, n)` `scenarioNames()` `promptOf(root, n)` `runSync` `prepareOnly` `startKeep` `noteKeep` `noteFixture`
- 产品：`statusText(root,{events:true})` `statusEvents` `statusAll` `cancel` `coreStop` `runProduct`
- 读状态：`readState` `readEvents` `instanceIds` `nodeOf` `handoffOf` `backflowOf` `escalationOf` `eventSeqs` `sha256File` `fileInfo` `wsPath` `taskDir`
- I1.2 / 架构回归（AC-36~38）：`codeLoopDriver`（code-loop 驱动）、`nodeTest(['test/**/*.test.js'])`、`purity({dirs,forbid})`（purity-check）、`installLegacyV1(root,'OLD-001')` + `legacyV1Hashes()`（AC-37 旧格式只读）
- 用例：`makeCase` → `check/eq/includes/notIncludes/matches/block/snap/cmd/keep/note` → `finish(c)`

## 纪律（硬约束）

- **只读产品**：不修改 `src/**`、`test/**`、`bin/**`。发现产品缺陷写 `probe/acc3-f-blockers.md`，不修。
- 单条 AC ≤ 90s（runner 到时强杀并记 `阻塞`）；判 `阻塞` 必须写原因与已尝试路径。
- 每个 AC 跑完 `orch core stop` + `forceKillCore`；runner 在场景累计满 10 个时自动回收（已知连跑 20+ 会让 mock 的 `session/new` 全失败）。
- 同一 AC 的两个分支要"另起全新根"，且**分支顺序不能反**（如 AC-45 先停核心后取消，`interrupted` 已是终态）。
- 并行跑不同批次时，`results.jsonl` 是**追加**写、`final` 按 AC 取最后一条；建议各批次的 runner 串行收尾，全部跑完再执行一次 `node probe/acc3-f-final.mjs`。
