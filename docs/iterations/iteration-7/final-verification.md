# I1.7 终验（S4）

> 判据来源：`iteration-7.md` 「退出标准」5 条 + `requirement.md` AC-01~14。
> 终验代码 HEAD：`0fc70a9`；基线 HEAD：`3f35bfa`。

## 1. 退出标准逐条

| # | 判据 | 结论 | 证据 |
|---|---|---|---|
| 1 | 14 条 AC 均有判定；AC-07/AC-08 规划验收句夹具现场实跑；AC-13/AC-14 故障注入通过 | ✅（AC-12 端到端待补，见 §3） | `acceptance.md`；`i17-code-isolation::AC-07/08/13/14` |
| 2 | 回归基线不破：失败集合差集 = 0、tests >= 992、三主链逐字、`ROLES.developer` 仅增 `artifact_type` | ✅ | 全量 1028/1019/8，差集 = 0；`i17-regression::R-1`；`templates/index.js` 仅 +2 行 |
| 3 | 回归红线 R-1~R-6 | ✅ | 三主链逐字（regression）；doc-single 14/14；`dependencies`=0；purity exit 0；既有用例只增不减（992→1028）；`resolveNodeProducts` 既有 5 分支语义不变（`i17-code-strategy` R-6 用例 + `doc-artifact` 14/14） |
| 4 | 架构扫描：31 禁词 exit 0；`code-isolation.js` 无 31 词、无 `if host ==`；角色/图字面量只在 `src/templates/**` | ✅ | purity 实跑「扫描 22 文件零命中」exit 0；`code-isolation.js` CJK=0 / `if host ==`=0 |
| 5 | NFR：冲突绝不静默覆盖、合并顺序/进度可见、零新增依赖 | ✅ | `AC-08`（abort+升级）；`AC-06`（`maxActive=1` + 状态词）；`deps=0` |

## 2. 门禁实跑（复核命令）

```bash
node --test "test/**/*.test.js"                       # 1028/1019/8/1（差集=0）
node --test "test/wp7/*.test.js"                      # 37/37
node --test test/wp10/doc-artifact.test.js            # 14/14
node --test "test/templates/**/*.test.js"             # 28/28
node --test test/wp4/orchestrator.test.js             # 37 用例 36 绿；唯一失败=基线 #6
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>   # exit 0
node -e "console.log(Object.keys(require('./package.json').dependencies||{}).length)"  # 0
```

## 3. 未闭合项（明确登记）

1. **AC-12 端到端探针未跑**：`orch instance status` 的真实输出未落证据；渲染层（`includeBranch` 真/假）与 `main.js` 接线已由 `i17-labels::(c)` 覆盖。补法：在 `%TEMP%` 隔离根起 core + 造 code 节点含 `branch/mergeStatus` 的实例，运行 `orch instance status` 断言包含分支名与「已合并/冲突待升级」。
2. **真实宿主面未验证**：worktree 隔离在真实 DSH 会话中的执行面（B/C 类预判 B），I1.7 以本地 git 夹具为准。
3. **评审建议遗留（非阻断）**：F-02/F-08 及健壮性建议，见 `report.md §4`。

## 4. 终验结论

- 除 **AC-12 端到端探针** 一项外，退出标准 1~5 全部满足；S2 实现与 S3 回归门禁通过。
- **判定：条件通过（Conditional PASS）**——补齐 AC-12 端到端探针后转为 PASS。
