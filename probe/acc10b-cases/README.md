# probe/acc10b-cases — I1.10b S3 批次 a 逐 AC 用例

- 目录名**不带 `-f`**（脚手架文件才带 `-f`）；runner：`node probe/acc10b-f-run.mjs --batch a`。
- 一个 AC 一个文件（`ac01.mjs` … `ac15.mjs`），统一调用 `_shared.mjs::standardCase`。
- `_shared.mjs` / `_template.mjs` 以下划线开头，runner 不加载为用例。
- 每条用例固定结构：独立 `%TEMP%` 根（`NODE_ENV=test`、mock 宿主）→ 机检 F-16（先 `test -f` 再 `node --test`）→ 需求原文架构检查（`grep -REn` / ERE）→ Then/附录 A 逐字字面量核对 → `orch core stop` → `finish`。
- 判定纪律：只认需求原文 Then/And，不采信测试自述；文案逐字、数量核对数组长度、时序实测毫秒；观测不到判「阻塞」不判「通过」。
- 证据原始帧：`docs/iterations/iteration-10b/evidence/AC-XX.*`（tests.stdout / test.source / arch.stdout / state / events / corestop / meta / status），每条 ≥4 文件、无空文件。
