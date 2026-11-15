# probe/acc10-cases —— I1.10a S3 逐 AC 用例注册表

一条 AC 一个文件（`ac01.mjs` ~ `ac44.mjs`，不带 `-f`）。用例内容由
`node ../acc10-f-gen.mjs` 从 `docs/iterations/iteration-10a/requirement.md` v4 §3.1
**逐字抽取**：AC 号 / 标题 / 场景类型 / Given / When / Then / 机检 / 夹具 / 架构检查原文。
生成器不放宽、不改写、不合并任何 Then；`--check` 可核对已生成用例与需求逐字一致。

## 复跑方式（仓库根，NODE_ENV=test）

```bash
node probe/acc10-f-run.mjs AC-01          # 单条
node probe/acc10-f-run.mjs --batch a      # AC-01~10
node probe/acc10-f-run.mjs --batch b      # AC-11~20
node probe/acc10-f-run.mjs --batch c      # AC-21~30
node probe/acc10-f-run.mjs --batch d      # AC-31~37
node probe/acc10-f-run.mjs --batch r      # AC-38~44（发布面，r = release）
node probe/acc10-f-final.mjs              # 重建汇总 / 验收报告
```

## 纪律（硬约束）

- **只读产品**：不改 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。
- **F-16 机检模板**：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`，
  断言 `# pass ≥ 1`、`# fail 0`、退出码 0；禁用全量 glob 代替（文件缺失会假通过）。
- **同文件多 AC 串扰**：整文件 F-16 失败时，按需求 §3.3「每个 AC 使用独立项目根」补跑
  `--test-name-pattern "<AC>"` 的 AC 级隔离机检（仍 `test -f` + 单文件 `--test`）；
  整文件、各 attempt、隔离机检的原始 TAP 帧**全部保留**，隔离结果只用于本 AC 判定，不掩盖整文件失败、不改任何断言。
  典型：`instance-list.test.js` 同时承载 AC-03/04，R-08 已登记时序竞态在整文件形态下会串扰。
- **一个 AC 一个独立项目根**：runner 注入 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，
  契约测试内部 `os.tmpdir()` 自动落在该目录下；证据 `fixture-roots.json` 记录实际根目录。
- **NODE_OPTIONS 不剥离**：需求 §3.3 只强制 `NODE_ENV=test`。保留本机默认的 `NODE_OPTIONS` 预加载；
  剥离会让 mock 宿主一轮完成过快，触发 R-08 已登记时序竞态（AC-04 `running`→`completed`）。
  全量回归门禁仍按裁决 V 用 `env -u NODE_OPTIONS`，其失败集合按判定基线 9 条核算、差集 0。
- **文本扫描**一律 `grep -E` / `grep -RE`（ERE）或 Node 扫描，禁 BRE `\|` 交替。
- **skip 口径（R-13）**：壳面用例 skip 时必须在 parts 与本台账写明需
  `env -u NODE_OPTIONS npm run desktop:build` 重建产物，不得静默吞掉。
- **证据分级**：`mock 实测` / `mock 实测（结构断言）` / `阻塞`；真实 DSH 取证属本机保留项，不在本迭代判定。
- **每条 AC ≥ 4 份原始帧**：`unit-*.log`、`unit-*.summary.json`、`unit-*.test-names.json`、
  `arch-checks.json`、`then-map.json`、`requirement.json`、`fixture-roots.json`、`result.json`。

## 架构检查的环境偏差（如实登记，不伪造零命中）

需求 AC-05 / AC-11 的架构检查原文为 `grep -R ... desktop/`。本机已构建 Tauri bundle，
`desktop/src-tauri/target/release/bundle/**/Resources/src/**` 内是产品源码副本，
按原文扫描会命中。这两条按「原文形态留证 + 界面层作用域 `desktop/ui/ desktop/harness/` 零命中判定」执行，
偏差原因写在 `acc10-f-parts/` 与 `acc10-f-blockers.md`，不放宽断言、不改需求。

## R-12（AC-22）

真实壳内拖拽仍是结构断言（写入端 `config.rs` 无窗口级自动化用例）。AC-22 单列证据等级
`mock 实测（结构断言）`，不冒充真实宿主实测；S3 补 `view-state.test.js` + `config.rs` 路径常量证据。
