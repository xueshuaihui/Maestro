# I1.11 批次 A 验收用例（AC-01~AC-13）

本目录与 `probe/acc11-f-{lib,common,run,final}.mjs` 配套。用例只读产品代码，不改 `src/**`/`desktop/**`/`test/**`。

## 结构

- `ac01.mjs` ~ `ac13.mjs`：每条 AC 一个用例文件，`export const cases = [{ ac, title, face, run }]`。
- `_template.mjs`：模板（runner 跳过 `_` 开头）。
- 判定三档：**通过 / 不通过 / 阻塞**；证据分级：**已实测（真实宿主）/ mock 实测 / 阻塞**。

## 用例骨架（固定）

```
makeCase → machineChecks（test -f + node --test + 架构检查）→ 取原始帧 → 逐字断言 → finish
```

- 一个 Then/And 至少一条核对项，期望值逐字照抄需求 Then / 附录 A-1~A-4，不许改成代码现状。
- A-0 可变值：实例号/编号/节点/角色/轮次等按夹具实际值替换；`T-003 开发`、`第 2 轮` 只是示例。
- 观测不到判「阻塞」并写明「需求要求什么 / 已试哪些路径 / 为什么观测不到」，不写「通过（人工确认）」。
- 通知类判据以探针/意图事件为判据，不以「人眼看有没有弹」为判据（需求判定口径 2）。

## 机检口径（需求判定口径 4/5）

- 文本扫描一律 `grep -E` / `grep -RE`（ERE），禁 `\|` 交替。
- 点名测试文件先 `test -f test/wp14/<file>.test.js` 再 `NODE_ENV=test node --test`，断言 `# pass≥1`/`# fail 0`；`queue-actions.test.js`/`queue-cross.test.js` 在本分支合并进 `queue.test.js`，用例按实际文件名机检并在备注登记。
- 每条 AC 独立 TMPDIR、单 AC 限时 90s、结束 `orch core stop` 清理。

## 关键 AC 口径

- **AC-01~03** A-1 五段固定段序逐字（` · ` 切 5 段，缺段渲染 `—`）；单模板 `T-001 执行者 / 第 1 轮`。
- **AC-04** D-52：`open-queue` 真窗口不可用 → `app.js` 源码锚点 + `followNotification` 行为断言，标注证据分级；架构检查零命中。
- **AC-06** D-46：异常按 `(kind,instanceId)` 意图组**去重后计数 1**、`mergedCount=[1,2,3,4]` 单调递增、末条含「共 4 次」。
- **AC-09** D-39 两现场：`single` 终态 pass → `completed`；`code-loop` 非终态 pass → `running` + 下游被唤醒。
- **AC-13** 三处数字 `[[2,1,1,1],[1,0,1,0],[0,0,0,0]]`（ WP-2 用例已有，复跑取证据）。

## 执行

```bash
node probe/acc11-f-run.mjs --batch a
node probe/acc11-f-final.mjs
```

证据：`docs/iterations/iteration-11/evidence/<AC>/`（`test-stdout.txt`/`meta.json`/`state.json`/`check.json`/`output.json` + `*.log`/`*.tap.json`/`arch-*.log`）。
