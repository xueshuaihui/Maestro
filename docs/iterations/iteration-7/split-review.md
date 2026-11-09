# I1.7 拆分与契约评审 · split-review.md

> 评审对象：`docs/iterations/iteration-7.md`（拆分文档）
> 判据唯一来源：`docs/iterations/iteration-7/requirement.md` v2 + `docs/iterations/iteration-7/requirement-understanding.md`（R-1~R-6）
> 评审模板：`docs/templates/execution-template.md` §1.3 / §1.4 / §1.5
> 评审方式：只读；机械脚本实跑复核文件交集与 AC 覆盖；不采信拆分自述
> 评审日期：2026-11-09

---

## 0. 总判

**总判：FAIL**（结构骨架 10/12 自检项通过，但判据 12「需求与拆分的冲突核对」FAIL）。

- **阻断项：2 项** —— F-01（orchestrator.js 越出 D-7 授权且被大幅改造、§8 未裁决）、F-02（§8 冲突清单未覆盖全部授权外修改点，render.js / status-text.js 同样越权且未列 §8）。
- **建议项：1 项** —— F-03（候选 A 范围澄清：可见性追加须显式声明仅作用于 `orch instance status`/`graph`/`status.md`，不回灌三主链运行期输出与回归快照）。

> 一句话：8 节骨架、AC→WP 14/14 满覆盖、WP 文件零交集、DAG 无环等结构性判据均 PASS；但拆分把合并编排核心逻辑写进 **D-7 授权清单未列的 `src/core/orchestrator.js`**，且对 `src/cli/render.js`、`src/core/status-text.js` 的改动也越出 D-7 授权、又未进 §8 冲突清单裁决——违反判据 12 与候选 B，属阻断。

---

## 1. 10 条自检逐条结论（依据 execution-template.md §1.5）

| # | 检查 | 结论 | 依据 |
|---|---|---|---|
| 1 | 8 节齐全、标题与顺序一致（§0~§8） | ✅ PASS | 文档含 §0 迭代定位 / §1 技术选型 / §2 模块划分 / §3 数据模型 / §4 工作包拆分 / §5 交付物清单 / §6 依赖与并行 / §7 风险与降级 / §8 对齐声明；§9 为额外自检节，不破坏 0~8 顺序 |
| 2 | 每条 AC 都出现在某个 WP 的「验收口径」里 | ✅ PASS | §4 末尾映射表 14 行（AC-01~AC-14 连续），且每个 WP 的「验收口径」字段逐字列 AC 号（脚本核对见 §2） |
| 3 | 每条 AC 都能在需求里找到同号 Then | ✅ PASS | 需求 §3.1 含 AC-01~AC-14 各自 `**Then**` 段；脚本确认 14/14 均存在 |
| 4 | 所有 WP 的负责文件两两无交集 | ✅ PASS | 脚本逐 WP 取路径集合求交，无任意两 WP 共享同一 `src/**`/`test/**` 文件（§3 输出） |
| 5 | 依赖图无环，且每个 WP 的依赖编号都存在 | ✅ PASS | 依赖仅 WP-1 / WP-1+2+3 / WP-1..5 / 无；编号 WP-1~WP-6 全部存在，DAG 无环 |
| 6 | §0 退出标准逐条可判定（有数字或逐字口径） | ✅ PASS | 含 `tests >= 992`、失败集合差集 = 0、`dependencies` 键数 0、`purity-check --forbid <31词>` exit 0、三主链逐字 diff 为空 |
| 7 | §2 每个文件都标注了归属 WP | ✅ PASS | 每个文件标题后标注（WP-x）；测试文件于 §2.10 归属 |
| 8 | §6 有「契约先冻结点」与「整合检查点」 | ✅ PASS | §6 含 5 项契约先冻结点 + 6 组整合检查点命令 |
| 9 | §7 每条风险都有具体处置（点名文件/函数） | ✅ PASS | 14 条风险均点名文件/函数/AC（如 R-6 点名 `ROLES.developer`/`test/wp4/orchestrator.test.js`） |
| 10 | §8 声明「不新增需求条目，冲突以需求为准」 | ✅ PASS | §8 首句声明 + 6 条冲突裁决 |
| 11 | AC→WP 映射表完整性（14 行、每行≥1 主责 WP、跨包标协作） | ✅ PASS | 映射表 14 行，每行均有主责 WP + 协作 WP（§2 / §4） |
| 12 | 需求与拆分的冲突核对（§8 覆盖 D 所有修改点；拆分新增修改点在 D-7 授权内或 §8 裁决） | ❌ **FAIL** | §8 仅裁决 D-7 授权内的 6 处（index/paths/workspace/doc-artifact/labels/code-isolation）；拆分实际改动的 `src/core/orchestrator.js`、`src/cli/render.js`、`src/core/status-text.js` **均不在 D-7 授权清单，且 §8 未点名裁决**（详见 §4-B / §5 F-01、F-02） |

---

## 2. AC→WP 满覆盖核对（脚本输出）

**脚本**：提取需求 `^AC-(\d+)` 得到 14 条 AC 编号区间 1~14（连续无缺）；提取拆分文档各 `### WP-N` 块内反引号路径与 `AC-\d+` 引用；映射表行提取。

```
需求 AC 编号范围: 1 ~ 14 | 去重计数: 14 | 连续? true
WP 数: 6 | 登记文件总数: 15
  WP-1 → src/persistence/paths.js, test/wp7/i17-paths.test.js
  WP-2 → src/core/code-isolation.js, test/wp7/i17-code-isolation.test.js
  WP-3 → src/core/doc-artifact.js, src/templates/index.js, test/wp7/i17-code-strategy.test.js
  WP-4 → src/core/workspace.js, src/core/orchestrator.js, test/wp4/orchestrator.test.js
  WP-5 → src/cli/labels.js, src/cli/render.js, src/core/status-text.js, test/wp7/i17-labels.test.js
  WP-6 → test/wp7/i17-regression.test.js

§4 映射表存在: 是
映射表 AC 行数: 14 | 缺号: 无（AC-01~AC-14 连续 14 行）
逐 WP「验收口径」AC 引用核对: 14/14 各至少命中一个 WP 验收口径（映射表主责/协作与验收口径一致）
```

**结论**：AC→WP 14/14 满覆盖成立（判据 2 / 判据 11 PASS）。注意：AC 编号在拆分文档中以零填充 `AC-01..AC-14` 书写，机械比对须用零填充正则，否则会产生「AC-2 未覆盖」的假阴性（已校正）。

---

## 3. 文件零交集脚本核对（含 D-7 授权交叉核对）

**WP 间零交集**（判据 4）：将 6 个 WP 的负责文件路径求交，结果**无任意两 WP 共享文件**。orchestrator.js 仅属 WP-4，render.js / status-text.js 仅属 WP-5，workspace.js 仅属 WP-4，无重叠。✅

**D-7 授权交叉核对**（判据 12 关键）：D-7 授权修改清单（`requirement.md` L371~377）仅点名 6 个文件：

```
授权内（D-7 点名）:
  src/templates/index.js            ✅ 拆分 §2.4 改
  src/persistence/paths.js          ✅ 拆分 §2.1 改
  src/core/workspace.js             ✅ 拆分 §2.5 改
  src/core/doc-artifact.js          ✅ 拆分 §2.3 改
  src/cli/labels.js                 ✅ 拆分 §2.7 改
  src/core/code-isolation.js(新增)  ✅ 拆分 §2.2 新增
```

```
越出 D-7 授权、且 §8 未裁决（判据12 FAIL 根因）:
  src/core/orchestrator.js          ❌ D-7 未列；拆分 §2.6 大改（合并队列/worktree 派发/写 branch+mergeStatus/escalate 重投）；§8 未点名
  src/cli/render.js                 ❌ D-7 未列；拆分 §2.8 改（instance status/graph 节点行追加分支+合并状态）；§8 未点名
  src/core/status-text.js           ❌ D-7 未列；拆分 §2.9 改（renderStatusDoc 对 code 节点追加分支+合并状态）；§8 未点名
```

> WP 间零交集（判据 4）与「是否越出 D-7 授权」（判据 12）是两个独立维度：前者 PASS，后者 FAIL。

---

## 4. 候选问题 A / B 的独立判定与修法

### 4-A · 三主链逐字红线 vs 可见性渲染（独立判定）

**结论：PASS（实质无冲突），建议补一处范围澄清（见 F-03）。**

判定链条（不采信拆分自述，实跑代码路径核实）：

1. **R-1 / AC-11 的逐字范围被需求自身限定为「运行期输出」**。`requirement-understanding.md` L238 明确：三主链输出逐字不变指 `code-loop 的用户可见编排输出（节点态、handoff、CLI 文案）必须不变`。回归抓手是 `code-loop-driver.mjs` 捕获 `bin/orch.js run` 的 **stdout+stderr**，归一化后与基线 `3f35bfa` 逐字 diff（拆分 §6 第 4 组命令）——**该快照不含 `orch instance status` 输出，也不含 `status.md` 内容**。
2. **可见性追加落在与运行期输出相互独立的代码路径**：
   - §2.8 改动 `src/cli/render.js`，但其范围被显式限定为 `orch instance status` / `orch instance graph --format json` 的节点行渲染（`iteration-7.md` L122）；
   - §2.9 改动 `src/core/status-text.js` 的 `renderStatusDoc`，产出 `status.md`（由 `workspace.js` L101/138 与 `orchestrator.js` L447/473/3157/3323/3326 在落盘快照时写入）。
   - `orch instance status`/`graph` 与三主链 `run` 命令是**不同命令**；`status.md` 是运行副产物，不被 driver 的逐字快照捕获。两处渲染均未进入「节点态/handoff/CLI 文案」运行期输出。
3. **因此 `code-loop` 的 developer（内置 code 角色）节点在 `orch instance status`/`graph`/`status.md` 多出的 branch/mergeStatus 文字，不会污染三主链逐字回归快照** —— 不破 AC-11 / R-1。
4. **但拆分未把上述「范围隔离」写成显式约束**：§8 冲突 #6 只裁决了 `resolveNodeProducts` 路径变化的「扩清单」处理（D-7 L369），完全没有提可见性新增文字只作用于三视图、绝不回灌运行期输出。若实现侧误把 branch/mergeStatus 渲染接到 `run` 命令共用的节点行渲染函数（假设两者共享 `renderNodeRow`），则会泄漏进逐字快照 → 变成真实冲突。

**修法（建议级，F-03）**：在 §2.8 / §2.9 / §8 冲突 #6 显式补充「branch/mergeStatus 的可见性追加**仅**作用于 `orch instance status` / `orch instance graph` / `status.md` 三处视图，绝不进入三主链运行期输出（节点态/handoff/CLI 文案）与回归快照；并要求实现侧确认 `run` 命令节点渲染路径与 `instance status` 节点渲染路径相互独立，或在共用渲染函数上加 `includeBranch` 开关防止回灌」。属 WP-5 范畴，不影响既有逐字断言。

> 判定不受提示词预设带偏：结论基于「R-1 范围=运行期输出」「driver 快照=run stdout」两条实测事实，而非「可见性必然破坏逐字」的假设。实质无冲突，风险仅在文档未声明隔离边界。

### 4-B · `orchestrator.js` 修改授权（独立判定）

**结论：FAIL（阻断），F-01。**

判定：

1. D-7 授权清单（L371~377）点名的 6 个文件**不含 `src/core/orchestrator.js`**。D-7 L377 更明确新增 `src/core/code-isolation.js` 负责「**合并队列、冲突检测**」。
2. 拆分 §2.6 却把**合并队列、code 节点派发 worktree、写 `branch`/`mergeStatus` 字段、escalate resolve 重投**等核心新行为写进 `orchestrator.js`，并列为 WP-4 负责文件（L105~112、L262、L316）。
3. 拆分 §8 冲突清单共 6 条（L429~434），仅裁决 D-7 授权内的 index/paths/workspace/doc-artifact/labels 与 developer artifact_type 透明性，**完全未点名 `orchestrator.js`**，既未声明其越权、也未给出裁决。
4. 这与判据 12 第二项「拆分新增的修改点（特别是是否修改了 `src/core/orchestrator.js`）是否在 D-7 授权清单内，或是否已在 §8 冲突点名裁决」直接冲突——`orchestrator.js` 既不在授权内、也未在 §8 裁决 → **FAIL**。

**修法（阻断，F-01）**：将合并编排逻辑**移回新增的 `src/core/code-isolation.js`**（D-7 已授权该模块拥有「合并队列、冲突检测」）：
- 在 `code-isolation.js` 增加合并队列管理（按确定顺序逐个 `mergeIntoIntegration`+`detectConflict`、冲突 `abortMerge`+升级、异常 `merge_aborted` 升级）、`branch`/`mergeStatus` 字段生命周期、escalate resolve 重投触发；
- `orchestrator.js` **仅通过 §2.2 契约调用** `code-isolation.js` 的派发/合并入口，自身不再进 D-7 未列文件；
- 若 `orchestrator.js` 必须保留一个最小状态写入钩子（把 `branch`/`mergeStatus` 经既有 `transit()`/`save` 落盘），则该钩子须**显式列入 §8 冲突清单并裁决**，但优先方案是让 `code-isolation.js` 内部经注入的 state 回调写回，使 `orchestrator.js` 退出「新增/改」文件清单。

> 关联发现：同样越出 D-7 授权且未进 §8 的还有 `src/cli/render.js`（§2.8）、`src/core/status-text.js`（§2.9）——见 F-02。

---

## 5. 修复清单（F-01 ~ F-03）

### F-01 · orchestrator.js 越出 D-7 授权且被大幅改造、§8 未裁决
- **位置**：`iteration-7.md` §2.6（L105~112）、§4 WP-4 负责文件（L262）、§5 交付物（L316）、§8 冲突清单（L423~434，无 orchestrator.js 条目）
- **原文**：「`src/core/orchestrator.js`（改，WP-4）——唯一负责人；改动内容：合并队列、code 节点派发 worktree、写 branch/mergeStatus、escalate resolve 重投」
- **违反哪条**：判据 12（候选 B）；D-7 L371~377 授权清单未含 orchestrator.js，却授权 code-isolation.js 负责「合并队列、冲突检测」
- **建议修法**：把合并队列、worktree 派发、branch/mergeStatus 字段生命周期、escalate 重投逻辑整体移入 `src/core/code-isolation.js`；orchestrator.js 仅经 §2.2 契约调用，退出「新增/改」清单；如须最小钩子则显式补进 §8 裁决
- **严重度**：**阻断**

### F-02 · §8 冲突清单未覆盖全部授权外修改点（render.js / status-text.js 越权未裁决）
- **位置**：`iteration-7.md` §2.8（L120~123，render.js 改）、§2.9（L125~128，status-text.js 改）、§8（L423~434，未列此二文件）
- **原文**：§2.8「`render.js`……对 code 角色节点追加分支名+合并状态」；§2.9「`status-text.js`……`renderStatusDoc` 对 code 节点追加分支/合并状态」
- **违反哪条**：判据 12（拆分新增修改点须要么在 D-7 授权内、要么在 §8 点名裁决）；D-7 授权清单未含 render.js / status-text.js，§8 亦未裁决
- **建议修法**：将 `src/cli/render.js`、`src/core/status-text.js` 作为「AC-12 可见性必需、但 D-7 授权外」的修改点，补入 §8 冲突清单并显式裁决（仅追加 code 节点分支/合并状态片段、零禁词、零中文、非 code 节点逐字不变 → 不触 R-1/R-4）；或走需求修订把两文件补进 D-7 授权清单（需对应 requirement.md 同步）
- **严重度**：**阻断**

### F-03 · 可见性追加范围未显式隔离（候选 A 澄清）
- **位置**：`iteration-7.md` §2.8 / §2.9 / §8 冲突 #6（L434）
- **原文**：§2.8/§2.9 描述在 instance status/graph 与 status.md 追加 branch/mergeStatus，但全文未声明「这些新增文字不进入三主链运行期输出与回归快照」
- **违反哪条**：判据 12 精神 / R-1 风险缓释（非硬失败，属文档精度缺口）
- **建议修法**：在 §2.8、§2.9、§8 冲突 #6 显式补一句——「branch/mergeStatus 可见性追加仅作用于 `orch instance status` / `orch instance graph` / `status.md` 三视图，绝不回灌三主链运行期输出（节点态/handoff/CLI 文案）与回归快照；实现侧须确认 run 命令节点渲染路径与 instance status 节点渲染路径相互独立，或加 `includeBranch` 开关」；归 WP-5
- **严重度**：**建议**

---

## 附：复核实跑命令（可复现）

```bash
# AC 编号 + WP 文件归属 + 零交集 + 映射表
node -e '
const fs=require("fs");
const req=fs.readFileSync("docs/iterations/iteration-7/requirement.md","utf8");
const sp=fs.readFileSync("docs/iterations/iteration-7.md","utf8");
const wps=[...sp.matchAll(/^### (WP-\d+)([\s\S]*?)(?=^### |^## )/gm)];
const owner=new Map();
for(const [_,id,body] of wps){
  const files=[...body.matchAll(/`([^`]+)`/g)].map(m=>m[1]).filter(f=>/^(src|test|bin)\//.test(f));
  for(const f of files){ if(owner.has(f)&&owner.get(f)!==id) console.log("重叠:",f,owner.get(f),id); owner.set(f,id); }
}
console.log("WP 数:",wps.length,"| 文件数:",owner.size);
const hasMap=/AC\s*→\s*WP\s*满覆盖映射/.test(sp);
const mb=sp.match(/AC → WP 满覆盖映射[\s\S]*?\n\n([\s\S]*?)\n\n/);
const rows=mb?[...mb[1].matchAll(/\| (AC-\d+)/g)].map(m=>m[1]):[];
console.log("映射表存在:",hasMap,"| 行数:",rows.length);
'
# D-7 授权文件 vs 拆分改动文件（判据12）
grep -n "授权修改清单" docs/iterations/iteration-7/requirement.md
grep -n "（改，\|（新增，" docs/iterations/iteration-7.md
```
