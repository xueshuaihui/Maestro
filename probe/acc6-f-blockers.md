# I1.6 S3 验收缺陷登记（批次 a）

> 登记纪律：发现产品缺陷 / 需求侧矛盾 → 只登记，不改 `src/**`、`test/**`、`assets/**`、
> 不放宽用例断言。编号 D-1 起；每条含复现命令（在 `%TEMP%/maestro-acc-p6/` 下的独立项目根执行，
> `orch` = `node D:/WWW/Maestro/bin/orch.js`）。关联 AC 判「不通过」并留全量证据。

## D-1 单字符角色 id 被 `ROLE_ID_MISMATCH` 拒绝，AC-06 / AC-11 的 Given 夹具不可达（需求侧矛盾 + 明细文案自相矛盾）

- **关联 AC**：AC-06、AC-11（均判不通过）。
- **现象**：需求 AC-11 Given 点名五份坏角色 `m.yaml` / `s.yaml` / `c.yaml` / `p.yaml` / `d.yaml`，
  AC-06 Given 点名 `.orch/roles/a.yaml`（`derived_from: b`）与 `b.yaml`（`derived_from: a`）——
  全部是**单字符 id**。产品按 C-01（`id` 长度 2~32）拒绝，把长度违规折进 `ROLE_ID_MISMATCH`，
  且**明细文案自相矛盾**：`角色 id 与文件名不一致：文件 c / 声明 c`（两边都是 c，显然不是「不一致」）。
- **连带后果**：
  - AC-11：`errors` 里混入 5 条 `ROLE_ID_MISMATCH`（期望恰好 5 条五个专属码），且 `c.yaml` 的
    `ROLE_CONTRACT_UNBOUND`、`p.yaml` 的 `ROLE_PERMISSION_MISMATCH`、`d.yaml` 的
    `ROLE_DERIVE_CYCLE` 全部被 ② 号检查截断不再报出——AC-11 要验证的五个专属码不可观测。
  - AC-06：成环 / 缺失两个场景都只报 `ROLE_ID_MISMATCH`，`ROLE_DERIVE_CYCLE` /
    `ROLE_DERIVE_MISSING` 不可达。
- **需求侧矛盾**：C-01（长度 2~32）与 AC-06 / AC-11 的 Given（单字符 id）在同一份 v7 定稿里互斥；
  实现取 C-01 无错，但 AC 的 Then 因此不可达，属 R 系列登记项（建议记 R-12）。
- **复现**（AC-06 第一段）：

```bash
ROOT="$TMP/maestro-acc-p6/AC-06"   # Windows: %TEMP%\maestro-acc-p6\AC-06
mkdir -p "$ROOT/.orch/roles"
cat > "$ROOT/.orch/roles/a.yaml" <<'EOF'
schema: role/v1
id: a
name: 甲
group: coding
summary: 测试
artifact_type: code
side_effect: write
skills: [test-run]
tools: [read]
derived_from: b
max_concurrent_sessions: 1
EOF
# b.yaml 同构（id: b、derived_from: a）
cd "$ROOT" && node D:/WWW/Maestro/bin/orch.js role validate
# 实测：校验资产 28 个：2 个不合法
# - roles/a.yaml：角色 id 与文件名不一致：文件 a / 声明 a（ROLE_ID_MISMATCH）
# - roles/b.yaml：角色 id 与文件名不一致：文件 b / 声明 b（ROLE_ID_MISMATCH）
# 期望（AC-06 Then）：两条 ROLE_DERIVE_CYCLE，明细给出环上角色名
```

- **修复建议**（供实现侧参考，不在 S3 擅自改）：① 需求侧把 AC-06/AC-11 Given 的角色 id 改为
  2 字符以上；或 ② 产品侧为长度违规引入独立明细（如「id 长度非法：a（合法长度 2~32）」），
  并让 ② 号检查失败不再截断 ⑥~⑪ 的后续检查（C-08 只规定「同一原因码只报第一条」，
  未授权跨项截断）。

## D-2 `role diff` 的基线解析被同名项目覆盖文件顶掉：基线标签误标「项目」、逐字段覆盖的「无差异」不可达

- **关联 AC**：AC-10（判不通过，两段失败同根因）。
- **现象**：AC-10 Given 在同一项目根里同时放 AC-04 的 `lead-dev` 与一份**与内置 developer
  逐字段相同的项目覆盖文件** `.orch/roles/developer.yaml`。
  - 第一段：`orch role diff lead-dev` 打印 `对比角色 lead-dev（项目）与基线 developer（项目）`，
    A-5 / Then 逐字要求 `…与基线 developer（内置）`——基线应为内置 `assets/roles/developer.yaml`，
    产品却解析到了项目覆盖文件（差异内容恰好一致所以三行差异仍对，但标签违反逐字口径）。
  - 第二段：`orch role diff developer` 报 `缺少对比基线：developer（用 --against 指定内置角色或文件）`
    退出 1——Then 要求末行 `无差异`、退出 0。内置 `developer` 明明存在（`assets/roles/developer.yaml`），
    项目覆盖把 roleMap 里的同名项顶掉后，diff 找不到内置基线即报 `BASELINE_MISSING`。
- **复现**：

```bash
ROOT="$TMP/maestro-acc-p6/AC-10"
cd "$ROOT"
node D:/WWW/Maestro/bin/orch.js role create lead-dev --from developer --skills test-run
cp D:/WWW/Maestro/assets/roles/developer.yaml .orch/roles/developer.yaml   # 逐字段相同的项目覆盖
node D:/WWW/Maestro/bin/orch.js role diff lead-dev
# 实测：对比角色 lead-dev（项目）与基线 developer（项目）   ← 期望「基线 developer（内置）」
node D:/WWW/Maestro/bin/orch.js role diff developer
# 实测：缺少对比基线：developer（用 --against 指定内置角色或文件） exit=1
#       期望：对比角色 developer（项目）与基线 developer（内置） + 无差异 exit=0
```

- **修复建议**：diff 的基线解析应固定读内置资产（`assets/roles/<id>.yaml`），与
  「项目优先」的读路径解耦；基线标签（内置）随来源标注。或需求侧把 AC-10 的基线解析
  口径写死（记 R 系列登记项）。

## D-3 `workflow create` 无 `--from` 的最小合法形落盘 `name` 与 `title` 两处 `--name` 值：AC-40 机检 `grep -c` 期望 1、实测 2（需求侧矛盾，关联裁-14② / R-10）

- **关联 AC**：AC-40（判不通过；仅机检「第二次后 grep -c 为 1」这一项失败，Then 三段全部通过）。
- **现象**：AC-40 `--force` 追加用例第二段用无 `--from` 的 `orch workflow create fork --name 另一个名字 --force`
  覆盖同名文件。需求未定义缺省形（R-10），裁-14② 裁定为「单 `human` 节点最小合法形」，
  实现把 `title` 也填成 `--name` 的值（`human` 节点必填 `title`，A-1）。落盘内容：

```yaml
schema: workflow/v1
id: fork
name: 另一个名字
entry: T-001
terminal: T-001
nodes:
  - id: T-001
    node_type: human
    title: 另一个名字
```

  AC-40 机检逐字要求 `grep -c '另一个名字' "$ROOT/.orch/workflows/fork.yaml"` 第二次后**为 1**；
  实测 `name:` 与 `title:` 两行都含该词，`grep -c` = **2**（按行计数）。
- **矛盾定位**：AC-40 机检写于缺省形未定义之前（隐含假设「`--name` 值只出现一次」）；
  裁-14② 之后的实现无论把 `title` 填成什么——填 `--name` 值 → 计数 2；填别的值（如 `T-001`）
  → 计数 1 但节点标题与 `--name` 无关、用户语义更差。属需求侧矛盾（建议记 R-13）：
  要么把机检改成 `>= 1`（或改为钉 `name:` 行），要么明确缺省形的 `title` 语义。
- **复现**：

```bash
ROOT="$TMP/maestro-acc-p6/AC-40"
cd "$ROOT"
node D:/WWW/Maestro/bin/orch.js workflow create fork --name 分叉版 --from code-loop   # 第一段，成功
node D:/WWW/Maestro/bin/orch.js workflow create fork --name 另一个名字 --force        # 第二段，退出 0
grep -c '另一个名字' .orch/workflows/fork.yaml
# 实测：2（name: 另一个名字 + title: 另一个名字）
# 期望（AC-40 机检逐字）：1
```

- **修复建议**（供参考，不在 S3 擅自改）：① 需求侧把 AC-40 该机检改为「第二次后
  `grep -c '另一个名字'` ≥ 1 且文件含 `name: 另一个名字`」；或 ② 实现侧把缺省形节点的
  `title` 改为节点 id（`title: T-001`）使计数为 1——两者取一，S4 报告披露。
- **其余机检不受影响**：第二次后 `workflow validate fork --format json` 的
  `counts.invalid === 0` 实测通过；第三次（待覆盖内容不合法）退 1、`sha256` 不变实测通过。


## 观察项（不判缺陷，S4 报告披露）

- **O-1 空字符串序列化**：`role create`（无 `--summary`）落盘写成 `summary : ''`
  （冒号前有一个空格，`src/registry/asset-write.js:26,183-185` 注释声明这是既定口径，
  为保持 yaml-lite 可加载）。AC-03 Given「summary 为空」按此形态取证。建议需求侧在
  C-07 里补一句，避免后续验收把它当笔误。
- **O-2 role validate 文本计数头**：`role validate` 有错误的文本输出首行是计数头
  （`校验资产 N 个：M 个不合法`，I1.5 既有形态），AC-12 的「恰好两行」/ AC-13 的
  「三条错误」按 `- ` 错误行计（与 AC-19 显式点名首行的写法互补）。S4 报告披露该读法。
- **O-3 `workflow create --from` 丢弃节点级 `wake_allow`**（批次 b 探针发现，无 AC 钉住，
  不判缺陷）：`--from` 拷贝的是 `workflowMap` 里的规范化节点，节点级 `wake_allow`
  不在 B-06 的复制清单（节点、边、超时、重试、映射、并行组、作用域）里，落盘副本不含该键。
  连带：仅靠节点级 `wake_allow` 合法的源工作流无法被拷贝——沙箱校验按角色资产回退后报
  `创建被拒：唤醒不在白名单内：writer → tester（WORKFLOW_WAKE_DENIED）`（源本身
  `workflow validate` 全通过）。裁-15/R-11 已确立节点级 `wake_allow` 是合法可选键，
  建议 I1.7+ 把它补进 B-06 复制清单；复现：源 `up.yaml`（T-001 role: writer +
  节点级 `wake_allow: [tester]` → T-002 role: tester）validate 通过，
  `workflow create down --name 下游 --from up` 退 1。

## 处置注记（批次 c 追加）

- **AC-59 三项阻塞（批次 c2 登记，已闭合）**：需求 AC-59 When ① 样例 `--applies-to writing,review`
  与五分组闭集互斥，`quote` 创建被拒（退 2），依赖成功路径的 3 个核对项按阻塞登记。
  **处置 = 裁-17（需求侧 R-14）**：判样例值 `review` 为笔误，`ac59.mjs` 按勘误值
  `writing,coding` 取证，产品零改动；复跑 22/22 全通过（2026-11-09）。原阻塞登记作废，
  以最新一次运行结果为准。
- **D-1 / D-2 / D-3 已闭合**：分别由裁-16a / 裁-16b / 裁-16c 处置（见 decisions.md 第十四节），
  本文件保留原始登记作审计线索，AC 判定以复跑后的最新结果为准。
