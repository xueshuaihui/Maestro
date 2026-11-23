# A1 / S2 实现评审报告（独立评审，只读）

- **评审对象**：S2 五个 WP 的全部 diff（commit `4044869` / `b50a582` / `ee65043` / `8305b38` / `34dd418`，基线 `9a57fd2`）
- **判据**：`docs/iterations/iteration-A1/requirement.md` v2（15 AC，尤其 F-01 落地的 AC-09 五维）；`docs/iterations/iteration-A1.md` §2 文件级契约 / §4 WP 职责 / §6 CP-Freeze 六项；`docs/templates/execution-template.md` §0.1 铁律 3/4、§2.5 四件套、§3.4 判定纪律、§5 硬约束 5/6/7/10
- **评审性质**：独立评审；不参与实现；全程只读；未修任何缺陷、未放宽任何断言。唯一写入 = 本报告。
- **日期**：2026-11-23

---

## §0 总判

**PASS（阻断 0 / 建议 5）**

- 9 条评审清单核心判据全部 PASS：AC-09 五维、AC-05/10 用户配置第四来源、AC-11 只读、AC-07/08 ACP 握手、AC-12/14 证据隔离、文件级契约、领域层约束、回归红线、缺陷处置均落地且可复现。
- 实跑硬数字：`wp16 47/47`（exit 0）；`D-9 冻结文案 69/69`（exit 0）；purity exit 0；依赖数 0；领域层零 CJK 6/6；符号链接判重实跑有效。
- 5 条建议均为「测试锁定 / 环境耦合 / 台账备注」层面的改进项，不阻断 AC 判定，不要求回退实现，详见 §2。

---

## §1 逐条判定表

| # | 评审项 | 判据 | 判定 | 依据（行号 / 命令输出） |
|---|---|---|---|---|
| 1 | **AC-09 五维（F-01 核心）** | 五维恰好 5 项且顺序与 `docs/index.md` §2.2:128 / §5:223 一致；findings 五字段 null 起步；`buildMatrixData` 原值透传；cli list 渲染五维；缺维判红 | **PASS** | `capability-matrix.js:13-19` `MATRIX_DIMENSIONS = [acp, transport, resume_dialect, max_concurrent_sessions, evidence_hook]`，与 `docs/index.md:128`（ACP/stdio/会话恢复方言/并发上限/证据钩子）及 `:223`（ACP/transport/恢复方言/并发/证据钩子）逐项同序；`:22-33` 仅逐字段 `cli?.field` 透传，不填默认、不落盘。`discover.js:122-126` 与 `:203-207` 五字段 `null` 起步；`cli-matrix-data.test.js:26-33`（A1-M1 冻结/恰好 5/顺序/无 capabilities/再导出同一常量）、`:35-72`（A1-M2 原值含 false/''/0/null）、`:74-83`（缺字段为 undefined 不臆造）、`:85-106`（无第二数据源、无缓存）、`:116-124`（零 CJK）；`cli-discovery.js:46-52,113-126` 由同一冻结数组渲染五列，`CLI-C1`（`cli-command.test.js:70-126`）断言六列表头原序 + 五列表头冻结 + probed 真实值 + unprobed 五维全「未探测」；缺维即触发 A1-M1 `length===5`/`deepEqual(BASELINE)` 与 CLI-C1 五列硬编码红。实跑 wp16 47/47。 |
| 2 | **AC-05/10 用户配置第四来源** | discover 支持 `userConfig`；`user_config` 段持久化；重扫/probe 回写不丢；cli add 合法/重复/非法三类；realpath 归一化判重 | **PASS** | `discover.js:98-133` 用户项→finding（idle/not_on_path=false/evidence `user-config`）、`:216-220` 第四来源合并；`registry.js:36-101,126-131` 按 evidence 拆分重算 `user_config`，`:112` 旧文件兼容 `[]`；`cli-discovery.js:197-198` scan 传 `userConfig`、`:310-315` probe 回写不传 opts 由 `resolveUserConfig` 从磁盘读回——重扫/probe 均不丢。`WP1-04/WP1-05`（`cli-discovery.test.js`）断言重扫与「无 opts 保存」后 user_config 保留；`CLI-A1~A4`（`cli-add.test.js:51-158`）覆盖合法/重复/非法四类/重扫保留。判重 `cli-discovery.js:138-145` `canonicalPath` = `path.resolve` + `fs.realpathSync`，`:244-251` 归一化后比较；实跑：原路径 add exit 0、其符号链接 add exit 1「已存在」、`user_config_count=1`（见 §3）。 |
| 3 | **AC-11 只读纪律** | discover.js 零 fs 写；scan 只写 `cli-registry.json`；无 autoProbe/setInterval | **PASS** | `grep -REn 'writeFile\|mkdir\|appendFile' discover.js` → exit 1（零命中）；唯一写入点 `registry.js:155` `fs.writeFile(temp)` + `:156` rename（原子写）落 `.orch/cli-registry.json`；`grep -REn 'autoProbe\|setInterval' src/adapter/cli-discovery src/cli/cli-discovery.js` → exit 1（零命中）；`cli-acceptance.test.js:485-495` ACC-9 双重断言（grep exit 1 + `tokenHits()===[]`）。 |
| 4 | **AC-07/08 ACP 握手** | NDJSON initialize；acp 落位（失败=null 不写 false）；零 throw；不臆造 transport/resume/evidence_hook | **PASS** | `probe.js:119-133` 发 `{id:1,method:'initialize'}` NDJSON（仅 `--acp`），`:136-144` 逐行解析仅认 `id===1 && result`，无 `session/new`/`session/prompt`（仅注释命中）；`:186` `acpVerdict = acp?.ok===true && typeof acp.acp==='boolean' ? acp.acp : null`，失败/超时写 `null` 不写 `false`；`:192-194` `transport/resume_dialect/evidence_hook` 恒 null；`grep -nE 'throw new\|throw ' probe.js` → exit 1（零 throw），失败统一 `{ok:false,code,params}`（`:24-26,38-40,65-70`），5s/10s 硬超时 kill（`:46-51`）。WP-2 四断言含「never false」「real timeout→null」「三字段 stay null」全绿。 |
| 5 | **AC-12/14 证据隔离** | AC-12 真实宿主面判阻塞 + 试过路径 + mock 0 次冒充；AC-14 mock 面可复现、级别不同 | **PASS** | `cli-acceptance.test.js:176-197` `ac12BlockerRecord()`：本机无目标 CLI 时 `status='阻塞'`、`evidence='pending'`、`prerequisite` 前置、3 条 `triedPaths`、`mockPosedAsReal=0`；ACC-4（`:355-377`）断言阻塞 + PENDING + WorkBuddy 应用证据 + 0 冒充；ACC-5（`:379-416`）隔离夹具无 runnable target、probe 全 NOT_FOUND、无 ACP 成功泄漏；ACC-6（`:418-438`）台账分列 AC-12/AC-14，AC-12 mock 0 次、REAL 0 次；ACC-7（`:440-448`）两级不同。AC-14：`mockAgent()`（`:87-115`）Speaking-NDJSON，ACC-2（`:269-325`）add→scan→list→probe 端到端四项准确且三字段 null，标 `mock 实测`。证据三态逐字取 labels（ACC-1 `:254-267`）。**附带建议 D-2**：ACC-4/5 硬编码本机观测，见 §2。 |
| 6 | **文件级契约一致性** | 每个 WP 只动授权文件；labels 25 旧键逐字不变；index.js 既有导出顺序不变 | **PASS**（附建议 D-5） | `git show --stat`：WP-1=discover/registry/cli-discovery.test；WP-2=probe/cli-probe.test；WP-3=capability-matrix/index/cli-matrix-data.test；WP-4=cli-discovery/labels/cli-add.test/cli-command.test；WP-5=cli-acceptance.test——与 §4 交付物集合一致，未触碰 known-agents.js / bin/orch.js / D-9 四处冻结表。`labels.js:1254-1279` 旧 25 键取值逐字未变（`git show 8305b38 -- labels.js` 仅 `REGISTRY_INVALID` 行补逗号，逗号不算改值；`T.USAGE` 经 CLI-C5 `:213` 逐字断言）；新键仅追加 `:1280-1298`。`index.js:5-8` 既有导出原序，`:9` 仅追加一行 re-export。`numstat` 既有测试文件均 0 deletions。**偏差**：index.js（§2.3/§4 归 WP-1）的 export 行落在 WP-3 commit；S1 评审建议（`9a57fd2` commit message）已载「待 WP-3 建文件后再落盘（ESM 时序）」，且内容合规，不阻断。 |
| 7 | **领域层零 CJK / 文案唯一来源 / 零依赖 / purity** | 实跑验证 | **PASS** | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <11 词>` → `OK: 扫描 45 个文件…零命中`，exit 0；`node -e "Object.keys(p.dependencies).length"` → `0`；node 正则 `[\u3400-\u9fff]` 检 6 文件（discover/probe/registry/capability-matrix/index/cli-discovery）→ 全 `OK`；所有中文新增仅在 `labels.js` 的 `CLI_DISCOVERY_TEXT`，`capability-matrix.test.js:116-124`（M6）与 `cli-discovery.test.js` A1-07 同步断言。 |
| 8 | **回归红线** | A1-01~13 逐字不改；wp16 全绿；D-9 冻结文案不红 | **PASS** | `git diff --numstat 9a57fd2 HEAD`：`cli-discovery.test.js 163/0`、`cli-probe.test.js 78/0`——既有断言零删除（A1-01~13 逐字保留）；实跑 `NODE_ENV=test node --test --test-concurrency=1 test/wp16/*.test.js` → `# tests 47 / # pass 47 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0`，exit 0；D-9 四表所在文件 `wp2/labels`、`wp9/i19-labels`、`wp15/regression`、`wp14/labels-drill`、`wp13/checkpoint` 实跑 → `# tests 69 / # pass 69 / # fail 0`，exit 0。**说明**：AD-06 全量门禁未在本评审执行（本机历史并发 EXIT 137 / flaky 20→21，需求 P-6 已如实标注）；新增红差集由「既有测试 0 deletions + 五 commit 仅动授权文件」静态确认为 0，详见建议 D-4。 |
| 9 | **缺陷处置** | 符号链接判重自报修复是否真实合理；有无未登记新缺陷 | **PASS**（附 5 条建议） | `canonicalPath`/`fs.realpathSync`（`cli-discovery.js:138-145`）与重复判断（`:244-251`）确由 WP-4 commit `8305b38` 新增（`git show 8305b38 -- cli-discovery.js` 命中 `+function canonicalPath` / `+ realpathSync`）；独立实跑（独立临时根，不碰仓库）：原路径 add exit 0 → 同文件符号链接 add exit 1「已存在」→ `user_config_count=1`，修复真实有效。新增未见阻断级缺陷；5 条改进项登记于 §2（D-1~D-5）。 |

---

## §2 FAIL / 缺陷清单（按严重度）

> 无 FAIL / 阻断项。以下均为建议级（P2 中 / P3 低），不要求回退实现、不放宽断言。

| ID | 严重度 | 现象 | 位置 | 影响 | 建议处置 |
|---|---|---|---|---|---|
| D-1 | P2（中） | 符号链接判重修复**无回归测试锁定**：`cli-add.test.js` 的重复用例只测「同路径」与相对别名 `sub/../mytool`（`path.resolve` 即可处理），未测 `realpathSync` 所针对的符号链接场景 | `cli-discovery.js:138-145,244-251`；`cli-add.test.js:81-105` | 修复本身经实跑有效，但未来重构若退化 `canonicalPath` 为 `path.resolve` 不会被测试捕获，符号链接缺陷可复发 | 在 `cli-add.test.js` 追加 1 条「真实文件 add 成功 → 指向它的符号链接 add 被拒」用例，不改产品代码 |
| D-2 | P2（中） | AC-12 阻塞记录测试把**本机偶然观测硬编码为断言**：`assert targetsOnPath.length===0` 且 `triedPaths` 必须含 `WorkBuddy`；ACC-5 断言对 `codex/claude/gemini` 的 probe 必为 NOT_FOUND | `cli-acceptance.test.js:355-377`（ACC-4）、`:379-416`（ACC-5） | 在需求指定的「装有目标 CLI 的取证机器」上运行会误红（此时应为「需重新取证」而非失败）；在无 WorkBuddy.app 的非 macOS 环境亦必红 | 将硬编码断言改为条件分支：检出目标时验证「需重新取证 + REAL 可用」，未检出时验证阻塞；WorkBuddy 断言改为「若存在则记录」 |
| D-3 | P3（低） | `cli-add.test.js` 的 `run(root, args)` 只接受 2 参数，CLI-A4 传入第三参数 `{PATH:'',HOME:...}` 被静默忽略，环境隔离意图未生效 | `cli-add.test.js:30-38,141` | 该用例仍因独立临时根通过，但「隔离发现来源」的意图未真正落地 | 对齐 `cli-command.test.js:28-36` 的 `run(root, args, extraEnv)` 签名 |
| D-4 | P3（低） | WP-5 的 AD-06 门禁为**构造数据自检**（`affected`/`baseline` 为字面量对象），未真实执行全量串行 + git worktree 基线对照 | `cli-acceptance.test.js:450-483`（ACC-8） | 封装函数逻辑正确（下限写法/红差集/参数化基线均自检），但「新增红差集 0」尚非实跑产物 | S3 按 AD-06 / 需求 P-6 执行受影响面串行 + worktree 对照并落报告；本评审以 diff 静态核对（既有测试 0 deletions）为等效证据 |
| D-5 | P3（低） | index.js 文件归属时序偏差：拆分 §2.3/§4 归 WP-1，实际 export 行落在 WP-3 commit `ee65043` | `index.js:9`；commit `ee65043` | 仅追加 1 行、既有导出原序未变、内容符合契约；S1 评审建议已载 ESM 时序依据，无功能/回归影响 | 在 S2 台账备注「依 S1 建议由 WP-3 落盘 re-export」，后续 WP 归属严格按 §4 执行 |

---

## §3 实跑命令与输出摘要

| 命令 | 关键输出 | 结论 |
|---|---|---|
| `NODE_ENV=test node --test --test-concurrency=1 test/wp16/*.test.js` | `1..47` `# tests 47` `# pass 47` `# fail 0` `# cancelled 0` `# skipped 0` `# todo 0` `# duration_ms ≈12095` | exit 0，47/47 全绿 |
| `NODE_ENV=test node --test test/wp2/labels.test.js test/wp9/i19-labels.test.js test/wp15/regression.test.js test/wp14/labels-drill.test.js test/wp13/checkpoint.test.js` | `1..69` `# tests 69` `# pass 69` `# fail 0` | exit 0，D-9 冻结文案全不红 |
| `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator` | `OK: 扫描 45 个文件…零命中` | exit 0 |
| `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies\|\|{}).length)"` | `0` | 零运行时依赖 |
| `node -e "<正则 [\u3400-\u9fff] 扫 6 文件>"` | discover / probe / registry / capability-matrix / index / cli-discovery 均 `OK` | 领域层零 CJK |
| `grep -REn 'writeFile\|mkdir\|appendFile' src/adapter/cli-discovery/discover.js` | 零命中（exit 1） | discover 只读 |
| `grep -REn 'autoProbe\|setInterval' src/adapter/cli-discovery src/cli/cli-discovery.js` | 零命中（exit 1） | 无后台自动探测 |
| `grep -nE 'throw new\|throw ' src/adapter/cli-discovery/probe.js` | 零命中（exit 1） | 探测零抛异常 |
| `grep -REn 'install\|chmod' src/cli/cli-discovery.js` | 零命中（exit 1） | add 不安装/不改写 |
| `grep -REn 'saveCliRegistry\|writeFile' src/adapter/cli-discovery/*.js` | 唯一 `writeFile` 在 `registry.js:155` | 唯一写入点 = cli-registry.json |
| `git show --stat <5 commits>` + `git diff --numstat 9a57fd2 HEAD` | 13 个交付文件与 §5 清单吻合；既有测试 `163/0`、`78/0`（0 deletions） | 文件边界合规、A1-01~13 逐字不改 |
| 符号链接判重独立实跑（独立临时根） | 首次 add `exit 0`；符号链接 add `exit 1`「已存在」；`user_config_count=1 clis_userconfig=1` | 自报修复真实有效 |

> 本机限制如实标注：AD-06 全量门禁本次未执行（历史并发 EXIT 137、flaky 20→21、全量非零退出，需求 P-6 已记录实测基线 1947/1923/21）；本报告不写「全量全绿」。
