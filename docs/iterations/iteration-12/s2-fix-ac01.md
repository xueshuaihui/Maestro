# I1.12 S2 缺陷修复回执：AC-01 CLI 失配序号误报

- 修复角色：缺陷修复工程师（I1.12）
- HEAD 基线：`d20fccc`
- 依据：`decisions.md` 裁决 E（最高口径）、裁决 C 第 2 条、`requirement.md` AC-01 / A-2 / D-2、`s2-review-wp7-round3.md` N-01 背景
- 唯一交付缺陷：S3 批次 A 验收 AC-01 判不通过（C05 / C07 / C09）——副本 CLI 输出 `链已断：第 1 条记录与前一条指纹不匹配`，而核心 `verifyChain` 返回 `firstMismatch:2`

## 一、根因

`src/cli/verify.js` 原第 133 行的渲染取值链：

```
result?.count ?? result?.total ?? result?.seq ?? result?.badIndex ?? result?.firstMismatch ?? 0
```

`count` 排在最前。核心 `verifyChainCore` 在失配时返回的 `count` 是**断点前已校验条数**（8 条事件、直改第 2 条 `prev_event_hash` 时 `count=1`），而非失配记录序号；`seq` / `firstMismatch` / `badIndex` 均为 2。CLI 取了 `count=1` 去填 A-2 的 `[N]`，于是把失配序号误报成「第 1 条」。核心判定与 D-2 算法正确，缺陷纯在 CLI 渲染层。

## 二、修法

只改 `src/cli/verify.js` CHAIN 分支的**渲染取值优先级**，按 ok 分成两条路径（`src/cli/verify.js:133-138`）：

- 失败分支（broken）：`result.seq` → `result.firstMismatch` → `result.badIndex` → `result.count` → `result.total` → `0` 兜底。
- 成功分支（complete）：仍用 `result.count` → `result.total`，显示「链完整，共 N 条」。

`requireLabel` / `fill` 渲染路径不变；A-2 文案模板 `chainBroken`、A-1 文案 `chainComplete`、退出码 `EXIT_OK=0` / `EXIT_FAILED=1` 逐字未改；`src/core/audit-verify.js`、`src/cli/labels.js`、验收断言、需求与 probe 均未改。

新增真实断言 `test/wp15/wiring.test.js:302-320`：注入 `verifyChain` stub 返回 `{ok:false, seq:2, firstMismatch:2, count:1, code:'CHAIN_BROKEN'}`，断言退出码非 0、输出恰为 `fillN(2)` 且不等于 `fillN(1)`。期望中文仅由 `labels.CHAIN_BROKEN` 经 `[N]`/`{N}` 变量填充得到，测试文件零 CJK 字面、零 `\u` 码点。该断言在旧取值链下必然失败（会渲染成 `第 1 条`），是有效回归断言。

改动文件仅两处：`src/cli/verify.js`、`test/wp15/wiring.test.js`（本回执为新增第三件）。未执行 `git add` / `commit`。

## 三、门禁数字

| 门禁 | 命令 / 口径 | 结果 |
|---|---|---|
| 定向测试 | `NODE_ENV=test node --test test/wp15/wiring.test.js test/wp15/regression.test.js` | `tests 29 / pass 29 / fail 0 / skipped 0`，exit 0（较修复前 28 条 +1） |
| purity 双目录（31 词） | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$FORBID"` | `WORD_COUNT=31`；扫描 38 文件零命中，exit 0 |
| purity 双目录（31 词） | `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid "$FORBID"` | 扫描 31 文件零命中，exit 0 |
| 零依赖 | `node -p "Object.keys(require('./package.json').dependencies||{}).length"` | `0` |
| 空白门禁 | `git diff --check` | exit 0（仅 autocrlf 的 LF→CRLF 提示，无空白错误） |
| 中文唯一来源 | `test/wp15/wiring.test.js`  cleanliness 测试（含 `verify.js` 与本测试） | `verify.js` / `wiring.test.js` 零 CJK 字面、零 `\u`，测试通过 |

未跑全量测试（按指令）；未覆盖任何历史 `evidence/**` / `probe/**`。

## 四、CLI 抽查（独立 %TEMP% 根，真实落盘链）

脚本位置：`C:/Users/xuesh/AppData/Local/Temp/fix-ac01-spotcheck.mjs`（仓库外，不入库）。夹具根：`C:/Users/xuesh/AppData/Local/Temp/maestro-i112-fix-ac01`。

命令序列：

```
run  : node D:/WWW/Maestro/bin/orch.js run --cwd . --template single --task write-a-note   (cwd=%TEMP%/maestro-i112-fix-ac01, NODE_ENV=test, MAESTRO_REPO=D:/WWW/Maestro)
copy : cp -r .orch 到同根下 good/ 与 bad/ 两个副本根
tamper: 将 bad/.orch/instances/INST-001/events.jsonl 第 2 条 prev_event_hash 首字符 0→1（仅该字段变动）
verify(原件): cd .../good && node D:/WWW/Maestro/bin/orch.js verify INST-001
verify(副本): cd .../bad  && node D:/WWW/Maestro/bin/orch.js verify INST-001
cleanup: node D:/WWW/Maestro/bin/orch.js core stop
```

输出摘要：

| 步骤 | 实测输出 | 退出码 |
|---|---|---|
| `run single` | 事件 8 条、首条 `seq=1`、篡改目标 `seq=2`；mock 面无 API key 故 run 自身 exit 1，但事件链由真实落盘路径产生 | 1（预期内） |
| 原件 `verify INST-001` | `链完整，共 8 条` | 0 |
| 副本 `verify INST-001` | `链已断：第 2 条记录与前一条指纹不匹配` | 1 |
| `core stop` | — | 0 |

结论：原件「链完整，共 N 条」exit 0、副本「链已断：第 2 条记录与前一条指纹不匹配」exit 1，与裁决 E / D-2 / AC-01 Then 完全一致；误报已消除。

## 五、未闭合项

- 本修复范围内无未闭合项。
- AC-22 全量 `tests ≥1425 + 差集 0` 与三主链逐字比对，按裁决 D-5 属 S3 取证 / S4 复核，本次按指令只跑定向测试，未做全量。
- 工作区中 `probe/acc12-f-results-b.jsonl`（20:26 生成，批次 B 验收产物）及既有 `decisions.md` / `progress.md` / `evidence/**` / `probe/**` 变更为并发或历史产物，**非本次修复所改**，已按授权边界原样保留、未触碰。
