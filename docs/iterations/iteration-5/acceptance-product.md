# I1.5 真实宿主面验收（acceptance-product.md）

## 结论

**本轮无真实宿主面验收。** 依据：`docs/iterations/iteration-5/requirement.md` 的 45 条 AC 里，
场景类型只出现「正常路径 / 异常 / 边界 / 回归」四类，**没有一条要求接真实 DSH 宿主**；
需求 §3.3 的夹具说明第 4 条亦明确「实例类 AC 使用仓库内 `test/fixtures/mock-acp-agent.js`，
AC-42 是全量测试、不需要宿主」。

按模板 §4.4「真实宿主面验收（若无真实面则注明）」的要求，在此注明：本迭代的真实面覆盖由
**夹具面 + 全量回归 + 默认图逐字红线**承担，见 `acceptance-fixture.md` 的 AC-19（默认图逐字回归）
与 AC-42（599 条既有测试）。

## 本迭代为什么不需要真实面

I1.5 的交付物是**纯读取侧的注册表与视图**：

| 交付物 | 性质 | 与宿主的关系 |
|---|---|---|
| `src/registry/**`（6 个文件） | 纯函数：解析 yaml-lite / skill 文件、校验角色 schema、加载合并、派生角色实例视图 | 不读时钟、不发请求、不看宿主；输入是磁盘上的资产文件与 `state.json` 快照 |
| `src/cli/roles.js` + `render.js` + `labels.js` | 只读 CLI：`role list` / `role show` / `role validate` | 通过既有核心 IPC 读快照，不新增与宿主的交互 |
| `assets/roles/*.yaml`（16）+ `assets/skills/**`（10） | 数据 | — |

宿主交互面（ACP 会话、审批、取消）本轮**一行改动都没有**，唯一的核心改动是
`orchestrator.js` 单链成功收尾从 `quiesceSession` 改成 `idleSession`（缺陷 D-1，见
`probe/acc5-f-blockers.md`），该路径已被 AC-19（默认图逐字回归）与 AC-27（single 主链跑完后
`role show`）覆盖。

## 真实面替代证据（夹具面内）

| 证据 | 位置 | 说明 |
|---|---|---|
| 默认图逐字回归 | `acceptance-fixture.md` → AC-19 | worktree 挂 `1490f6d` 基线树，同一项目根先后跑 `single` / `code-loop` / `task-loop` 三条主链，输出逐字 diff = 0 |
| single 主链真实终态 | 同上 → AC-27 | 真跑一次 `single`（mock 宿主写产物），实例 `completed` 后 `role show worker --instance INST-001` → `已关闭 · 活跃会话 0/1 · 服务节点 — · 宿主 —` |
| 三图中间态 | 同上 → AC-20~26、AC-28~31 | 用运行时抽帧接缝取确定性中间态（`after_output` / `after_accepted` / `retest-slow` / `rounds-exceeded`），不是靠 sleep 猜时序 |
| 既有宿主交互回归 | 同上 → AC-42 | 599 条既有测试（含 wp3 传输层、wp8 权限门、wp10 性能、wp11 注册表） |

## 若后续要补真实面，建议的最小用例

1. 用真实 DSH 宿主跑一次 `code-loop`（需要 `~/.dsh/.credentials.yaml` 的账号令牌，隔离 `DSH_HOME`），
   停在 T-002 running，确认 `role show tester --instance INST-001` 显示「服务中 · 活跃会话 1/1 ·
   服务节点 T-002 · 宿主 dsh」——这正是需求 §1.2 场景 5 的原话，但需求没有为它设 AC。
2. 跑完后再确认同一实例的角色状态收敛（`cooldown` / `retired`），验证真实宿主的迟到帧
   不会把角色状态翻回 `busy`。

以上两条属于「加了更安心、不加也不缺需求覆盖」的范围，故本轮未纳入判定。
