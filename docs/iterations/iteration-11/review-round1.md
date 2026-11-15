# I1.11 需求评审记录 · 第 1 轮（独立评审）

## §0 总判

- **总判：FAIL**
- **阻断 8 项 / 建议 10 项**（F-01 ~ F-08 阻断；F-09 ~ F-18 建议）。
- **评审对象**：`docs/iterations/iteration-11/requirement.md` **v1**，1296 行；头部 `版本：v1`（第 7 行）与附录 C 末行 `v1（2026-11-15）`（第 1166 行）一致。
- **评审依据**：`docs/index.md` 第一部分 1–631 行；第二部分 I1.11（878–889 行，含 888 行验收句）、阶段一退出条件（911–913）、固定产出（1023–1030）、关键判断点（1035–1046）；`docs/templates/requirement-template.md`；`docs/templates/execution-template.md` §1.0.3 / §1.1 / §1.0.4；格式参照 `docs/iterations/iteration-10a/requirement.md`。
- **复核方式（实跑，不凭印象）**：
  - 机械计数：`grep -cE '^\*\*AC-'` → 43；`grep -c '^- \*\*BR-'` → 36；`grep -c '^- \*\*NF-'` → 8；脚本核 AC/BR 连续性、悬空引用、BR 反向引用、三件套与锚点。
  - 路径存在性：对需求中所有反引号路径逐个 `fs.existsSync`，区分「既有」与「S2 才创建」。
  - 既有能力核对：`src/daemon/http/server.js` + `routes.js` 路由清点；`desktop/src-tauri/src/tray.rs`、`probe.rs`、`config.rs` 逐段阅读；`desktop/ui/graph/layout.js` 函数名；`src/cli/labels.js` 既有错误模板；`package.json` 依赖；`USAGE_LINES` 行数；`git` 分支与基线。
  - 对既有文件实跑 AC 中的架构检查（结果见 §6），专门找「锚点写错导致假失败」。
- **总体结论**：第二部分对规划的 7 个子项 + 888 行三句验收句做了完整落点，方向正确；但第三部分出现多处**不可执行/自相矛盾的判定锚点**（AC-29、AC-25、AC-31），附录 A-3 的审批行与 BR-06/AC-08 的字段要求直接冲突，附录 D 有两处会误导编码（D-9 的 `tray-quit-confirm`、D-11 漏 `config.rs`）。按「判定只取覆盖、锚点必须可执行」的口径，不能判 PASS。

---

## §1 规划原文逐句覆盖表（强制）+ 反向扫描

### 1.1 规划原文逐句覆盖表

> 规划来源：`docs/index.md` 878–889 行。888 行验收句按 `；` 拆为三句。判定列只取「覆盖」为 PASS。

| # | 规划原文（逐字 + `index.md` 行号） | 需求 §2 落点（节号） | 需求 §3 落点（AC 号） | 符合性 | 覆盖判定 |
|---|---|---|---|---|---|
| 1 | `- 通知机制：托盘通知（升级待处理、实例完成、实例异常）`（880） | §2.2 | AC-01、AC-02、AC-03、AC-38 | 一致 | 覆盖 |
| 2 | `- 人工干预队列界面：升级和审批统一队列，一键继续/重派/终止/允许/拒绝`（881） | §2.3、§2.4 | AC-08、AC-09、AC-10、AC-11、AC-12、AC-13、AC-14、AC-15、AC-16、AC-38 | 一致（同一子项拆为「看得见 / 点得动」两面；批量处置见 F-18 待裁决） | 覆盖 |
| 3 | `- 角色库/技能库/工作流库浏览`（882） | §2.5 | AC-19、AC-20、AC-21、AC-22、AC-23、AC-24、AC-25 | 一致（字段级 AC 缺口见 F-04） | 覆盖 |
| 4 | `- 角色库运行时子视图：全局角色资源占用`（883） | §2.6 | AC-26、AC-27、AC-28 | 一致 | 覆盖 |
| 5 | `- 工作流画布（只读）：复用角色流程图布局算法，展示定义态角色图`（884） | §2.7 | AC-29、AC-30、AC-31 | 一致（锚点错误见 F-02、F-03） | 覆盖 |
| 6 | `- 证据浏览独立视图：按节点查看产出证据（命令、退出码、产物引用）`（885） | §2.8 | AC-32、AC-33、AC-34 | 一致（增补「关键输出行数 / 日志引用」，基线 503–507 行有据） | 覆盖 |
| 7 | `- 托盘交互：实例数/待处理升级数、暂停/退出`（886） | §2.9 | AC-35、AC-36、AC-37 | 一致（「继续」为「暂停」的同项逆操作，U-4 有据） | 覆盖 |
| 8 | 验收句第 1 句：`升级请求触发托盘通知`（888） | §2.2 | AC-01、AC-38 | 一致 | 覆盖 |
| 9 | 验收句第 2 句：`人在面板上完整走"发现问题→查看证据→处理升级→实例继续"`（888） | §2.10（串联）、§2.4（处理后续跑） | AC-38（「实例继续」由 AC-14 单独立判） | 一致 | 覆盖 |
| 10 | 验收句第 3 句：`角色库运行时子视图显示全局角色占用`（888） | §2.6 | AC-26、AC-27 | 一致 | 覆盖 |

**表级结论**：10 行全部为「覆盖 / 一致」。规划没有「范围外 / 留待后续」子项被写成范围内；I1.10b（861–874）与 I1.12（892–907）的能力在 §1.3 第 57–69 行被明确排除。**但表级覆盖不等于 AC 可判定**：第 2 行的字段级矛盾（F-01/F-04/F-07）、第 5 行的锚点错误（F-02/F-03）在 §3 判 FAIL。

### 1.2 反向扫描 ①：§2 功能点 / §3 AC 反查规划来源

| 需求条目 | 规划来源 | 结论 |
|---|---|---|
| §2.2 通知开关（总开关 + 三类分项）、10s/60s 去重、点击通知定位 | 880 只写「托盘通知（三类）」 | **细化**：属同一通知能力的可用性控制，不是新能力域；不判夹带，但建议在 §1.3 注明「880 的实现细化」 |
| §2.4 批量处置（多选 + 逐条结果） | 881 只写「一键继续/重派/终止/允许/拒绝」 | **规划外交互**：新增多选与批量回报，属独立交互能力；是否算「夹带」需主控裁决（F-18） |
| §2.4 处理后续跑（5 秒自动续跑） | 888 第 2 句「实例继续」 | 有来源，不判夹带 |
| §2.5 三类资产计数、详情字段、校验状态 | 882「浏览」+ 基线 307–325 / 329–344 | 细化，不判夹带 |
| §2.6 「涉及宿主」列 | 883「全局角色资源占用」+ 基线 208–222 角色实例模型 | 细化，不判夹带 |
| §2.7 缩放 / 平移 / 复位、降级显示 | 884「只读」+ 基线 462–469 布局算法 | 细化，不判夹带 |
| §2.8 「关键输出行数 / 日志引用」 | 885 只列三项；基线 503–507「执行日志摘要」四要素 | 有基线来源，不判夹带 |
| §2.9 「继续」 | 886 只写「暂停/退出」 | U-4 明确为暂停的逆操作，不判夹带 |
| AC-39（只读与本地性）、AC-40（零依赖/中文来源）、AC-41（无回归）、AC-43（不依赖 I1.10b） | 规划未逐条写；来自基线 §6 第 7/9/10 条、`index.md` 629/913 行、回归红线 | 跨切面约束，不判夹带 |
| §1.3 第 55 行 / U-10「上次所在视图」写 `.orch/desktop/prefs.json` | 规划与基线均无此能力 | **夹带**：§1.3 承诺了「上次所在视图」，但 §2 无功能点、§3 无 AC；建议删除该字段或补 AC（F-13） |

### 1.3 反向扫描 ②：基线相关状态词 / 能力域反查 §2 落点

| 基线项 | 需求落点 | 结论 |
|---|---|---|
| §3.1 节点 9 态 / 看板 7 列（129–168） | §2.4（节点推进 / 挂起）、§2.8（按节点看证据）；A-0 用 7 个显示词 | 无缺漏；A-0 的 7 词与 I1.10a BR-23 既有口径一致（`待执行/执行中/待校验/已完成/失败/已取消/已升级`），未自造词 |
| §3.2 会话 6 态（170–193） | 仅 §2.6「活跃会话数」 | 不相关：会话状态展示属 I1.10a 图 / I1.10b 节点详情，本迭代不交付；不判缺漏 |
| §3.3 角色 6 态（195–222） | §2.6 五态（可用/服务中/冷却中/不可用/未参与）；`retired` 按基线「不显示」 | 无缺漏；与 I1.10a BR-23 口径一致 |
| §3.4 交接包 7 态（224–246） | 本迭代不展示运行时交接包；§2.7 明确「不显示连接线聚合状态」 | 不相关，不判缺漏 |
| §4 能力域 1 角色/技能资产（307–325） | §2.5、§2.6 | 有落点 |
| §4 能力域 2 工作流（329–344） | §2.7 | 有落点 |
| §5.4 产物存储（498–501） | §2.8 产物引用 | 有落点 |
| §5.5 三层日志（503–507） | §2.8 五项证据 | 有落点 |
| §5.6 人工干预队列与通知（509–512） | §2.2、§2.3、§2.4 | 有落点（「面板和 CLI 均可处理」：面板新增，CLI 不动） |
| §5.2 数据布局（600–614） | §1.3 第 55 行、U-10（新增 `prefs.json`） | 有落点；但「上次所在视图」无 §2/AC（见 1.2） |
| §6 第 7/9/10 条（626–629） | §2.7（定义态、无运行时叠加）、§1.3（不增 Web 入口） | 有落点 |

**反向扫描结论**：基线相关能力域与状态词无「缺漏」；唯一无来源的实质承诺是 §1.3/U-10 的「上次所在视图」。批量处置待主控裁决。

---

## §2 第二部分：符合规划 / 罗列全面

### 2.1 符合规划（A）

| 判据 | 判定 | 依据 |
|---|---|---|
| A① 规划条目逐字 → §2 功能点，语义不降级/收窄/换名/合并 | **PASS** | 880→§2.2；881→§2.3+§2.4（两面，未合并）；882→§2.5；883→§2.6；884→§2.7；885→§2.8；886→§2.9。§2.1 第 98 行自映射与逐行比对一致。 |
| A② 「用户操作 / 预期效果 / 异常情况 / 边界说明」与规划能力语义一致 | **PASS** | §2.2–§2.9 六段齐全（第 100–214 行）；每段都有使用角色、场景、操作、预期、异常、边界。 |
| A③ 规划写「范围外 / 留待后续」的没被写成范围内 | **PASS** | I1.10b 全部能力在第 59 行排除；I1.12（治理/签名/迁移）第 60 行排除；Web 第 61 行排除；IM 第 62 行排除；资产写操作第 64 行排除；已处理历史第 65 行排除。 |
| A④ 旧行为不变的落点 | **PASS** | 第 73–79 行回归红线；§2.9 第 212/214 行「退出语义与 I1.10a 完全一致」「不改变单击托盘图标行为」。 |
| A⑤ 没有夹带规划外的新能力 | **PASS（附 1 项待裁决）** | 批量处置（§2.4 第 141 行、AC-13）在 881 行无逐字来源，属新增交互；其余（通知开关/去重/点击定位、占用宿主、画布缩放）均为规划能力的可用性细化。批量处置请主控裁决（F-18）。 |

### 2.2 罗列全面（B）

| 判据 | 判定 | 依据 |
|---|---|---|
| B① 规划条目数 vs §2.1 功能点数逐项对账，零缺漏（含子项、888 三句） | **PASS** | 7 个子项 + 888 三句 → §2.1 八行功能点（881 拆两面）；第 98 行逐项映射；无缺项。 |
| B② 基线相关 §3 状态词、§4 能力域、§5.2 数据布局、§6 边界在 §2 有落点 | **PASS** | 见 §1.3；角色态、节点显示词、能力域 1/2、5.4/5.5/5.6 均有落点；会话/交接包态属 I1.10a/b，不判缺漏。 |
| B③ §2.10 衔接覆盖完整流程（含失败路径） | **PASS** | 第 220–228 行 9 步 happy path；第 230–235 行 4 条降级分支（通知不可用、条目已处理、资产/画布/证据不可读、守护进程断开），并逐条点名 AC-07/15/24/31/33/42。 |
| B④ §2.11 的 BR 覆盖每条用户可见规则 | **PASS** | 36 条 BR（第 241–276 行）覆盖通知、队列、五动作、续跑、批量、资产库、占用、画布、证据、托盘、只读、本地性、中文来源、回归。字段级遗漏在 §3 判（F-01/F-04），不在 §2 判。 |

**§2 结论：PASS**。第二部分本身符合规划且罗列全面；问题集中在第三部分的可判定性与附录 A/D 的一致性。

---

## §3 第三部分：符合规划 / 罗列全面

### 3.1 符合规划（C）

| 判据 | 判定 | 依据 / AC 号 |
|---|---|---|
| C① 888 行验收句逐句 → 至少一条 AC，语义不弱化 | **PASS** | 第 1 句→AC-01、AC-38；第 2 句→AC-38（AC-14 单判「实例继续」）；第 3 句→AC-26、AC-27。AC-38 第 706 行逐字引用三句。 |
| C② 每条 AC 的 Given/When/Then 是用户可见状态与操作 | **PASS（附 1 项）** | 43 条 AC 的 G/W/T 均为界面/托盘/通知/队列可见状态；技术细节放在「机检 / 夹具 / 架构检查」。AC-13 的 Given「3 条待处理升级（其中 1 条已处置）」自相矛盾（队列只显示待处理），见 F-16。 |
| C③ 失败 / 异常 / 超限路径有对应 AC | **FAIL** | 多数异常有 AC（AC-03/07/15/16/23/24/27/31/33/36/42），但 **BR-08 的「继续仅轮次超限可用，其余置灰 + 悬停文案」无任何 AC**（仅 §2.4 第 134 行、A-4 第 935 行有文字）；**BR-12 的「批量终止确认句带条数」无 AC**（AC-11 只测单条终止，AC-13 只测批量重派）；**§2.7「一个节点都解析不出 → 定义 空」无 AC**（AC-31 只测不可读/校验失败）；**§2.2「点击已处理条目 → 提示已处理」无 AC**（AC-04 只测正常点击）。见 F-07、F-14、F-17。 |
| C④ 每条 AC 有 `场景类型 / 风险 / 引用` 三件套与可执行锚点 | **FAIL** | 三件套 43/43 齐全（脚本核）。锚点「有」但不是「可执行/正确」：AC-29 第 612 行 `grep -REn "function layout" desktop/ui/` **实测 0 条**（既有函数是 `computeLayout`，`desktop/ui/graph/layout.js:45`），既不能证明复用、也会让正确实现判失败（F-02）；AC-25 第 568 行要求 `src/daemon/http/server.js` 中 `/assets/` ≥6 条，但既有路由在 `routes.js`，D-11 也授权 routes.js（F-08）；AC-31 第 632 行要求「文件被删除」现场 `nodes.length ≥ 1`，逻辑上不可能（F-03）。 |

### 3.2 罗列全面（D）

| 判据 | 判定 | 依据 / AC 号 |
|---|---|---|
| D① §2 每个功能点（含异常、边界）→ 至少一条 AC，反向零缺漏 | **FAIL** | §2.5「三个分页各有计数」「列表每行给出来源」在 AC-21/AC-22 未落（AC-21 只测名称/分组/命令数/校验，AC-22 只测名称/节点数/边数/校验；A-5 技能行、工作流行也没有来源）→ F-04。§2 另有若干异常/边界无 AC：单个资产坏标「不可读」（第 161 行）、画布「定义 空」（第 187 行）、队列新条目 2 秒出现 / 断线自动补全 / 不做筛选搜索（第 122、125、126 行）、托盘「没有可暂停的实例」文案（第 213 行）、画布两次打开坐标一致（第 184 行）、证据不做导出/预览（第 201 行）、占用不提供释放/踢会话（第 175 行）、通知不改变状态（第 112 行）→ F-14。 |
| D② 规划每个条目 → 至少一条 AC | **PASS** | 880→AC-01/02/03；881→AC-08~AC-16；882→AC-19~AC-25；883→AC-26~AC-28；884→AC-29~AC-31；885→AC-32~AC-34；886→AC-35~AC-37；888→AC-38/AC-14/AC-26。 |
| D③ BR 双向覆盖（每条 BR 被引用、每条引用真实存在） | **PASS（机械）** | 脚本：36 条 BR 全部至少被 1 条 AC 引用；43 条 AC 的 `引用：` 无悬空编号。语义级缺口（BR-08/BR-12）已计入 C③。 |
| D④ §3.2 非功能、§3.3 前置条件齐全且为用户视角 | **PASS（附注）** | NF-1~NF-8 齐全；§3.3 覆盖环境、B 类验收、基线、夹具、接缝、等待口径、回归基线、人工核验。附注：DoR 9 要求「全量测试当前基线数字已记录且为全绿」，§3.3 只写「与 iteration-7/baseline-failures.txt 差集为 0」，未记录当前条数与全绿事实（不影响开工，但拆分前需补）。 |
| D⑤ AC 编号连续无重复 | **PASS** | 43 条，AC-01~AC-43 连续，无重复、无缺号（脚本）。 |

**§3 结论：FAIL**。核心问题是 3 个锚点不可执行/自相矛盾，以及 BR-08/BR-12 的固定用户可见规则无 AC。

---

## §4 基线与需求模板合规

| 判据 | 判定 | 依据 |
|---|---|---|
| E① 第二部分不写接口/字段/表结构/内部状态机；第三部分不写接口返回字段/日志内容（除非用户直接看到） | **FAIL（轻）** | §2.4 第 134–135 行直接写「对应既有 `pass` 语义」「对应既有 `retry` 语义」——`pass`/`retry` 是内部裁决码，不是用户语言；应改为「判该轮通过」「重新分配」，或移到附录 D。其余 §2 基本保持用户视角；§3 的技术细节集中在「机检/夹具/架构检查」，符合本项目既有形态。 |
| E② 状态词、术语与基线 §3 一致 | **PASS** | A-0 第 809–810 行：实例七态、升级三态、审批四态、角色五态（`retired` 按基线「不显示」）、节点显示七词、资产校验两态；未出现 `frozen`；`（已暂停）` 是 I1.4 既有后缀（`src/cli/labels.js:417`），不是新造状态。 |
| E③ 括号指引删净；附录 C 与头部版本一致；附录 D 可指导编码 | **FAIL** | 括号指引已删净（无模板占位符）；附录 C v1 = 头部 v1。但附录 D 有两处会误导编码：**D-9 第 1254 行把既有的 `tray-quit-confirm` 列入「待加入 probe.rs 分发器」的新动作**——它实际由 `tray.rs:194` 的 `wait_ctl_file` 消费，若按 D-9 移入分发器，会在 `quit_after_confirm` 等待前被改名消费，退出确认失效（F-05）；**D-11 授权清单漏 `desktop/src-tauri/src/config.rs`**，而新增托盘信息行/暂停/继续文案必须落到该文件的 `Labels` 结构（现有 7 个中文默认值在 `config.rs:30–36`），否则只能在 `tray.rs` 写中文字面量、违反 BR-27（F-06）。另 D-11 第 1269 行说「四条写接口」，D-1 实际列 5 条路由（escalation/approval/cancel/pause/resume），建议对齐措辞。 |
| E④ 未决问题若影响开工须标阻塞 | **PASS** | U-1/U-2/U-3/U-9/U-11 均给「不阻塞开工」并给出默认口径；U-3（跨实例占用的数据来源）有具体做法（遍历本机实例 + `buildRoleInstances` 合并），不构成开工阻塞。U-1 的「阻塞判定：不阻塞开工」措辞自相矛盾，建议改为「是否阻塞：否」。 |

**补充：DoR 13 条中与本轮相关的观察**
- DoR 2/3/4/5/8/12 满足（机械核 + 附录 A/D 基本齐全）。
- DoR 7（前置条件里的命令与夹具真实存在）：`AC-43` 的 `git log --oneline feat/i1.10b-drilldown` 在本仓库**直接报 `fatal: ambiguous argument`**（本地无该分支，只有 `origin/feat/i1.10b-drilldown`，且其与 `66e5a6b` 相同、领先 0 个提交）→ F-10。
- DoR 9（当前基线数字已记录且全绿）：未记录当前全量测试条数/全绿结论，只写差集口径。
- DoR 10（Given 可构造）：AC-31 现场一（文件删除但要求 `nodes.length ≥ 1`）不可构造 → F-03；AC-13（3 条待处理里 1 条已处置）自相矛盾 → F-16。

---

## §5 修复清单

> 位置均指 `docs/iterations/iteration-11/requirement.md` 当前 v1 行号。严重度：**阻断** = 不修则 AC 不可判定/越界/会破坏既有行为；**建议** = 不影响方向但会造成歧义或验收争议。

### 阻断（8）

| 编号 | 位置 | 原文 / 事实 | 违反的规划或基线 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| **F-01** | A-3 第 877–879 行；BR-06 第 246 行；§2.3 第 120 行；AC-08 第 378 行 | A-3 审批行只有 `审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write`（4 个成分），**没有实例号、轮次/次数、原因摘要、产生时间**；但 §2.3/BR-06 要求每行 8 个字段，AC-08 明确断言「每行字段逐字匹配附录 A-3 模板（类型、编号、实例、节点与角色或动作、轮次/次数、状态词、原因、时间）」。第 887 行还要求「审批行逐字复用既有 CLI 审批行，不改造」；`src/cli/render.js:1143` 的 `renderApprovalLine` 在 `single` 模板下连节点都不输出。 | 违反基线 511 行「统一队列」的可用性，也违反本需求自己的 BR-06/AC-08；跨实例下 `APR-001` 可能重号，缺实例号无法区分。 | 二选一：① 让审批行也带实例号/轮次/原因/时间，另立 `DESKTOP_QUEUE_ROW_APR` 文案，不再复用 CLI 行；② 把 BR-06/AC-08 降为「升级行 8 字段、审批行 4 字段」。推荐 ①，并删掉 A-11 中「复用 `renderApprovalLine`」的冲突表述。 | 阻断 |
| **F-02** | AC-29 第 612 行 | 架构检查写 `grep -REn "function layout" desktop/ui/` **恰好 1 条命中（exit 0）**。实跑：**0 条**。既有布局函数是 `export function computeLayout`（`desktop/ui/graph/layout.js:45`），文件里没有 `function layout`。 | 违反 C④「可执行判定锚点」；按 D-6「复用既有布局纯函数」，正确实现反而判失败，另写一个 `function layout` 才「通过」，与「不得复制第二套」相反。 | 改为 `grep -REn "export function computeLayout" desktop/ui/graph/layout.js` **恰好 1 条**，并加一条「`desktop/ui/canvas/**` 不得出现 `function .*layout` 的第二套实现」；或直接断言 canvas 模块 import 了 `computeLayout`。 | 阻断 |
| **F-03** | AC-31 第 629–632 行 | Given ①「工作流文件被删除」；Then ①「仍能解析出的节点照常画出」；机检「现场一 `nodes.length ≥ 1`」。文件已删除 → 无输入可解析，`nodes.length ≥ 1` 不可能成立。 | 违反 C② Given/Then 一致性、DoR 10「Given 可构造」。 | 现场一改为「文件存在但内容整体不可解析（如 `{{{{`）」或「文件读权限 000」，才能同时验证「定义不可读 · 仅显示可解析部分」与「可解析节点照常画」；若坚持「删除」，Then 改为 `nodes.length === 0` 且显示「定义 空」。 | 阻断 |
| **F-04** | BR-15 第 255 行；§2.5 第 156 行；AC-21 第 521 行；AC-22 第 532 行；A-5 第 961–963 行 | BR-15/§2.5 要求三类库每行都列「来源（内置/项目）、分组、校验状态」；A-5 的技能行 `技能 doc-draft · 内容创作 · 命令 1 · 通过` 没有来源，工作流行 `工作流 release-flow · 7 节点 · 8 条边 · 通过` 既没有来源也没有分组；AC-21/AC-22 的 Then 也未断言来源/分组，AC-19/21/22 均未断言技能/工作流分页的计数行。 | 违反 B「规划条目逐字落点」与 D「§2 每个功能点（含字段）→ AC」；技能/工作流的「来源」在验收中无判据。 | A-5 技能/工作流行补「· 内置/项目」与分组；AC-21/AC-22 的 Then 增加来源、分组与计数行断言；AC-19 的计数断言扩到三个分页。 | 阻断 |
| **F-05** | D-9 第 1253–1257 行 | D-9 说「当前通道只认三个固定文件名 + `open-instance/` 子目录」，又把 `tray-quit-confirm` 列入「把新动作名加入 probe.rs 分发」的精确匹配清单。事实：`probe.rs:126` 的分发器只轮询 `close-window / tray-open / tray-quit`；`tray-quit-confirm` 由 `tray.rs:194` 的 `probe::wait_ctl_file` 在 `quit_after_confirm` 内消费。若按 D-9 把 `tray-quit-confirm` 加进分发器，文件会在等待前被改名 `.done`，退出确认永远等不到。 | 违反 E③「D 可指导编码」；按 D-9 实现会破坏 I1.10a 既有退出确认（回归红线）。 | D-9 改为：「分发器新增 `notify-open` / `tray-pause` / `tray-resume` / `queue-open`；`tray-quit-confirm` 维持 `tray.rs` 的 `wait_ctl_file` 通道，不得移入分发器」；「当前通道只认三个固定文件名」改为「三个分发动作 + `tray-quit-confirm`（wait_ctl_file）+ `open-instance/`」。 | 阻断 |
| **F-06** | BR-27 第 267 行；§1.3 第 76 行；D-11 第 1266–1276 行；`desktop/src-tauri/src/config.rs:13–36` | 需求称「所有新增中文只来自 `src/cli/labels.js`；桌面层不出现中文字面量」。但托盘/退出确认的壳层文案实际由 `config.rs` 的 `Labels` 结构承载，已有 7 个中文默认值（`tray_open`/`tray_quit`/`quit_confirm`/`quit_confirm_quit`/`quit_confirm_cancel`/`project_missing`/`project_invalid`），再由 `/ui/labels` 覆盖。新增「实例 N · 待处理升级 M」「暂停」「继续」「N 个实例已暂停，M 个已跳过」必须落到该结构；D-11 的授权修改清单**没有 `config.rs`**。 | 违反 E③「D 可指导编码」；若实现者绕开 `config.rs` 在 `tray.rs` 写中文，则违反 BR-27；若改 `config.rs`，则超出 D-11 授权。 | D-11 增列 `desktop/src-tauri/src/config.rs`，只允许在 `Labels` 增加字段 + `merge_payload` 增加 `pick("DESKTOP_TRAY_*")` + 与既有同形态的中文默认值；并把 BR-27 精确化为「`desktop/ui` 与 `desktop/harness` 零 CJK；壳层仅沿用既有 baked-in 默认 + `/ui/labels` 覆盖」。 | 阻断 |
| **F-07** | BR-08 第 248 行；§2.4 第 134 行；A-4 第 935 行 | 规则「『继续』仅对轮次超限类升级可用；其余升级上该按钮置灰并说明『该升级只能重派或终止』」在 §2.4/A-4 有文字，但 43 条 AC 中**没有任何一条**验证：对非 `rounds_exceeded` 升级「继续」置灰、悬停文案逐字、且不能误发 `pass`。AC-16 只断言动作集合恰为 5 个。 | 违反 C③「失败/异常/超限路径有对应 AC」；这是用户可见的固定文案（A-4），无判定锚点。 | 在 AC-16 或新增 AC 中加现场：`reasonCode: "execution_failed"` 的升级行，「继续」为 disabled，悬停文案逐字「该升级只能重派或终止」，点击无效、`resolution` 不变；并断言 `pass` 只出现在 `rounds_exceeded` 行。 | 阻断 |
| **F-08** | AC-25 第 568 行；AC-39 第 723 行 | AC-25：`grep -REc "/assets/" src/daemon/http/server.js` 必须 **≥ 6**。实跑当前 `server.js` 为 **0**；既有 REST 路由表在 `src/daemon/http/routes.js`（`GET/POST /instances`、`GET /workflows` 在 `routes.js:309–323`），D-11 第 1269 行也授权「`server.js` / `routes.js` 只新增 D-1 接口」。实现者按既有模式把资产路由加在 `routes.js`，该 AC 必失败。AC-39：`grep -REn "method === 'POST'" -A1 src/daemon/http/server.js \| grep -vE "/queue/\|/control/\|/cancel\|/instances\|__test__"` 必须零命中；**在未改动的基线上实跑返回 5 行（exit 0）**，因为 `-A1` 把注释行、`if (process.env.NODE_ENV !== 'test')` 和 `/workflows` 行也带出来，这些行不匹配排除正则。 | 违反 C④「可执行锚点」；两个锚点都绑定了错误文件/错误的 grep 形态，基线即假失败。 | AC-25 改为对 `server.js` + `routes.js` 合计计数；AC-39 去掉 `-A1`，或改为「提取路由表后按 `method`/`pattern` 断言」，并对 `routes.js` 一并扫描。 | 阻断 |

### 建议（10）

| 编号 | 位置 | 原文 / 事实 | 建议修法 | 严重度 |
|---|---|---|---|---|
| **F-09** | AC-39 第 719–723 行 | Given 一个运行实例；When「一次『允许』审批 + 一次托盘暂停/继续」；机检「写操作计数恰为 2」。审批 1 次 + 暂停 1 次 + 继续 1 次 = **3 次状态写入**（`workflow.pause` / `workflow.resume` 各一次）。 | 明确计数口径：要么「操作数 2（审批、暂停/继续周期）」并单列写入 3 次，要么把继续排除在计数外；否则 AC 不可判定。 | 建议 |
| **F-10** | AC-43 第 765 行 | `git log --oneline feat/i1.10b-drilldown`「输出为空」。实跑：`fatal: ambiguous argument 'feat/i1.10b-drilldown': unknown revision`（本地无分支；`origin/feat/i1.10b-drilldown` 存在且 `rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown` = 0）。 | 改为 `git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown` 输出 `0`，或 `git branch -a --list '*i1.10b*'` + `git merge-base --is-ancestor` 判定；不要依赖本地分支存在。 | 建议 |
| **F-11** | §2.2 第 106 行；BR-34 第 274 行；AC-01 第 301 行；A-1 第 835–846 行 | §2.2/BR-34 说通知正文「只带实例号、编号与原因摘要」「只含实例号、编号与原因摘要」；A-1 升级正文实际含「节点 T-003 开发 · 第 2 轮 · 执行失败：测试未通过」，AC-01 也断言正文含节点与角色。 | 把「只带」改为「只带实例号、编号、节点与轮次、原因摘要」；BR-34 同步，明确「不含会话内容/日志正文/产物内容」才是禁止项。 | 建议 |
| **F-12** | A-2 第 868 行；AC-13 第 433 行；AC-15 第 455 行；`src/cli/labels.js:336` | 需求写「已处理（重新分配），无需再次处理」；既有 `ESCALATION_NOT_PENDING` 原文是 `升级 {id} 已处理（{state}），无需再次处理`（含「升级 {id} 」前缀且 `{state}` 是「已处理」的中文标签）。A-11 又说队列异常「复用 `ERROR_TEMPLATE`/`COMMAND_ERROR`」。按复用实现，实际文本会多出 `升级 ESC-001 ` 前缀，AC-13/AC-15 的「逐字」会失败。 | 二选一：① 明确使用新键 `DESKTOP_QUEUE_ALREADY_RESOLVED`，文案定为无前缀版本；② A-2/AC-13/AC-15 按既有模板逐字写全（`升级 {id} 已处理（重新分配），无需再次处理`）。 | 建议 |
| **F-13** | §2.2 第 110 行；§1.3 第 55 行；U-10 第 1157 行；D-11 第 1270 行 | §2.2 说「设置里有总开关与三类分项」，但 D-11 的 `app.js` 只新增 `queue/assets/occupancy/canvas/evidence` 五个视图键，没有「设置」入口/视图；AC-05 的 Given「设置里三项默认全开」没有可构造的用户路径。另 §1.3/U-10 承诺 `prefs.json` 存「上次所在视图」，但 §2/§3 无此功能与 AC。 | 明确通知设置的落点（新设置视图 / 队列页顶部设置区 / 托盘子菜单），并在 D-11 登记；删除「上次所在视图」或补功能点 + AC。 | 建议 |
| **F-14** | §2.2 第 112 行；§2.3 第 122/125/126 行；§2.5 第 161/162 行；§2.6 第 175 行；§2.7 第 184/187 行；§2.8 第 201 行；§2.9 第 213/214 行；AC-31 第 632 行；A-7 第 1031 行 | 以下 §2 异常/边界无对应 AC：① 通知不改变任何编排状态（第 112 行）；② 队列新条目 2 秒出现、断线恢复自动补全、不做筛选/搜索/自定义列（第 122/125/126 行）；③ 单个资产文件坏 → 行标「不可读」、列表/详情结论一致（第 161/162 行，A-5 无该文案）；④ 占用不提供释放/踢会话（第 175 行）；⑤ 画布两次打开坐标一致、一个节点都解析不出 → 「定义 空」（第 184/187 行，AC-31 未覆盖「空」）；⑥ 证据不做导出/预览/完整日志（第 201 行）；⑦ 托盘「没有可暂停的实例」文案、不提供逐实例操作、不改变单击图标行为（第 213/214 行）；⑧ 通知点击已处理条目的提示（第 108 行）。 | 逐条补 AC 或在 AC 中加断言；至少补「定义 空」、单个资产「不可读」、断线自动补全、托盘「没有可暂停的实例」四项有固定文案的。 | 建议 |
| **F-15** | §2.4 第 134–135 行 | 「（对应既有 `pass` 语义…）」「（对应既有 `retry` 语义…）」出现在第二部分；`pass`/`retry` 是内部裁决码。 | 删除括号内的内部码，保留用户语言「判该轮通过」「重新分配」；内部映射只放附录 D-3。 | 建议 |
| **F-16** | AC-13 第 431–433 行 | Given「同一实例的 3 条**待处理**升级（其中 1 条在你点之前已被终端处置）」——已处置就不是待处理；§2.3 第 126 行/BR-06 说队列只显示待处理。若队列 2 秒内刷新，第三行已消失，「全选 3 条」不可构造。 | 改为「队列里仍显示 3 条（1 条是刷新前的陈旧行，已由终端处置）」，并明确如何冻结刷新（或在 2 秒刷新前完成全选）；或改为 2 条成功 + 1 条陈旧行。 | 建议 |
| **F-17** | BR-12 第 252 行；A-4 第 910–916 行 | BR-12 要求「批量终止的确认句带条数」，A-4 给了「终止 3 个实例？…」，但 AC-11 只测单条终止确认，AC-13 的批量动作是「重派」。批量终止确认句无 AC。 | 在 AC-11 或 AC-13 增加批量终止现场，断言「终止 3 个实例？终止后这些实例不再继续」逐字、取消不改状态、确认后 3 个实例「已取消」。 | 建议 |
| **F-18** | 第 881 行；§1.3 第 47 行；§2.4 第 141 行；BR-09 第 249 行；AC-13 | 规划 881 只写「一键继续/重派/终止/允许/拒绝」，未写多选与批量；需求新增「批量执行并逐条回报」（AC-13/BR-09），属规划外新增交互能力。 | 请主控裁决：若接受为 881 的队列可用性细化，在 §1.3 注明「批量属 881 的实现细化，不新增能力域」；若不接受，删除批量相关 BR/AC 或移到后续迭代。 | 建议 |

---

## §6 实跑命令与输出摘要（含机械扫描结果）

> 全部在 `/Users/xuesh/www/Maestro`、分支 `feat/i1.11-notify-queue-assets`、HEAD `66e5a6b` 上执行。

### 6.1 文档规模与编号

```text
$ wc -l docs/iterations/iteration-11/requirement.md
1296 docs/iterations/iteration-11/requirement.md      # v1，与评审任务书一致

$ grep -cE '^\*\*AC-' docs/iterations/iteration-11/requirement.md
43
$ grep -c '^- \*\*BR-' docs/iterations/iteration-11/requirement.md
36
$ grep -c '^- \*\*NF-' docs/iterations/iteration-11/requirement.md
8
```

脚本（Node）核：
- AC 编号：`1..43`，`missing: none`，`dup: none`。
- BR 编号：`1..36`，`missing: none`，`dup: none`。
- AC 三件套：43/43 含 `场景类型 / 风险 / 引用`；43/43 含 `**Then**`；43/43 至少含 `机检 / 夹具 / 架构检查` 之一。
- BR 双向：`BR not cited by any AC: none`；`dangling refs: none`；每条 BR 引用次数 1~6（BR-08 5 次、BR-13 5 次、BR-28 6 次）。

### 6.2 仓库路径存在性（需求中反引号路径逐个 `existsSync`）

```text
EXISTS   desktop/ui/app.js
EXISTS   desktop/ui/graph/layout.js
EXISTS   src/cli/labels.js
EXISTS   src/daemon/http/server.js
EXISTS   src/daemon/http/routes.js
EXISTS   test/fixtures/mock-acp-agent.js
EXISTS   test/fixtures/purity-check.mjs
EXISTS   bin/orch.js
EXISTS   package.json
EXISTS   docs/iterations/iteration-7/baseline-failures.txt
MISSING  desktop/harness/{queue-dump,assets-dump,occupancy-dump,canvas-dump,evidence-dump}.mjs
MISSING  src/daemon/{queue,notify,occupancy,assets-view,evidence,canvas}.js
MISSING  test/wp14/
```

结论：缺失项全部是 D-11 明列的 **S2 才创建**产物，需求没有把「还没实现的东西」写成「已有」；未发现虚假的「既有文件」声明。

### 6.3 既有能力事实核对

**HTTP 面（`src/daemon/http/server.js` + `routes.js`）**

生产路径实为 8 条，与需求第 74 行/BR-32 的清单一致：

1. `GET /ui/labels`（`server.js:414`）
2. `GET /instances/stream`（`server.js:422`）
3. `GET /instances/:id/graph/stream`（`server.js:426`）
4. `GET /instances/:id/graph`（`server.js:438`）
5. `GET /ui/*` 静态（`server.js:491`）
6. `GET /instances`（`routes.js:309`）
7. `POST /instances`（`routes.js:316`）
8. `GET /workflows`（`routes.js:323`）

另有 2 条 **`NODE_ENV=test` 才注册**的测试接缝：`POST /__test__/graph/pulse`（`server.js:451`）、`POST /__test__/window-probe`（`server.js:459`）。需求把「既有 8 条」限定为生产面，成立；但 BR-32 说「既有 8 条」时未提这两条测试接缝，建议在 D-10 说明「测试接缝不计入 8 条」。

**托盘（`desktop/src-tauri/src/tray.rs`）**

- 现有菜单恰为两项：`tray-open`（打开主窗口）、`tray-quit`（退出）——与需求第 25 行「托盘只有两项」一致。
- 退出确认计数 `running_instance_count` 统计 `running | suspended`（`spawn.rs:181–197`），与需求第 212 行「有运行中或已挂起实例时先确认」一致。
- 确认句默认值 `有 {n} 个实例正在运行，退出将停止守护进程` / `退出` / `取消`（`config.rs:32–34`），与需求 A-9 第 1097 行引用 I1.10a A-6 一致。

**ctl 通道（`probe.rs` / `tray.rs`）**

- `probe.rs:126` 分发器只轮询 `["close-window", "tray-open", "tray-quit"]`；`open-instance/<id>` 在 `probe.rs:136–151`。
- `tray-quit-confirm` **不在分发器**，由 `tray.rs:194` 的 `probe::wait_ctl_file(&dir, "tray-quit-confirm", 30_000)` 在 `quit_after_confirm` 内消费。
- 因此需求 §3.3 第 788 行「既有 `tray-quit-confirm`」的说法成立，但 **D-9 第 1254 行把它列为「待加入 probe.rs 分发器」的新动作是错的**（F-05）。

**布局函数**

```text
$ grep -REn "function layout" desktop/ui/ | wc -l
0
$ grep -n "export function" desktop/ui/graph/layout.js
45:export function computeLayout(graph, options = {}) {
```

→ AC-29 第 612 行的「恰好 1 条」实测为 0（F-02）。

**文案来源**

```text
desktop/ui  CJK 命中: 0
desktop/harness CJK 命中: 0
desktop/src-tauri/src CJK 命中: 26
  config.rs:30  tray_open: "打开主窗口"
  config.rs:31  tray_quit: "退出"
  config.rs:32  quit_confirm: "有 {n} 个实例正在运行，退出将停止守护进程"
  config.rs:33  quit_confirm_quit: "退出"
  config.rs:34  quit_confirm_cancel: "取消"
  config.rs:35  project_missing: "项目 未指定 · 请填写项目目录"
  config.rs:36  project_invalid: "项目 不可用 · {path}"
```

→ `desktop/ui` / `desktop/harness` 零 CJK 成立；壳层 `config.rs` 有 7 个中文默认值，需求「桌面层零中文字面量」的口径与现状不一致（F-06）。`desktop/ui/labels/labels.js` 只做解析/替换，不含文案，职责与 `src/cli/labels.js` 不冲突。

**其余架构检查（对既有文件实跑）**

```text
$ grep -REn '"(vite|webpack|rollup|esbuild|parcel)"' package.json | wc -l
0
$ grep -REn "if host ==|switch [(]host[)]" src/ | wc -l
0
$ grep -REn "saveState|appendEvent|store[.]save" src/daemon/http/ | wc -l
0
$ grep -REn "PATCH" src/daemon/http/ | wc -l
0
$ grep -REn "core[.]stop" desktop/src-tauri/src/ | wc -l
1                       # tray.rs:163，位于 pub fn quit 内；AC-37 的 -B8 可见 fn quit，成立
$ grep -REc "/assets/" src/daemon/http/server.js
0                       # AC-25 要求 ≥6，冲突（F-08）
$ grep -REn "paused = true" desktop/src-tauri/src/ | wc -l
0
$ grep -REn "escalations[.]filter" desktop/src-tauri/src/ | wc -l
0
$ grep -REn "console[.]error" desktop/ui | wc -l
0
$ grep -REn "fs[.]write|writeFile" desktop/ui | wc -l
0
```

**依赖与既有输出基线**

```text
$ node -p "JSON.stringify(require('./package.json').dependencies||{})"
{}
$ node -e 'import("./src/cli/labels.js").then(m=>console.log(m.USAGE_LINES.length))'
25
```

**环境（§3.3 的「本机已核实」）**

```text
$ node -v
v22.22.2
$ rustc --version
rustc 1.98.1 (48a229cea 2026-09-01)
$ cargo --version
cargo 1.98.1 (797e8a9bc 2026-08-05)
$ sw_vers
ProductName:    macOS
ProductVersion: 26.6.2
BuildVersion:   25G83
$ xcode-select -p
/Applications/Xcode.app/Contents/Developer
```

与需求 §3.3 第 782 行逐项一致。

**基线 / 并行分支（AC-43）**

```text
$ git log -1 --oneline 66e5a6b
66e5a6b chore(memory): 登记 I1.10a 收口与发布面 6 条必守约束
$ git rev-parse --short origin/feat/i1.10b-drilldown
66e5a6b
$ git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown
0
$ git log --oneline feat/i1.10b-drilldown
fatal: ambiguous argument 'feat/i1.10b-drilldown': unknown revision or path not in the working tree.
```

→ 「I1.10b 无提交」的事实成立（`origin/...` 与 `66e5a6b` 相同、领先 0），但 AC-43 的本地分支命令不可执行（F-10）。

**既有错误模板核对**

```text
src/cli/labels.js:336  ESCALATION_NOT_PENDING: '升级 {id} 已处理（{state}），无需再次处理'
src/cli/labels.js:337  ESCALATION_DECISION_INVALID: '升级 {id} 不支持「{decision}」；可选：{allowed}'
src/cli/labels.js:339  INSTANCE_NOT_SUSPENDED: '实例 {id} 当前不是挂起状态，不能处理升级'
src/cli/labels.js:343  APPROVAL_SESSION_GONE: '审批 {id} 已失效：会话不在运行'
```

→ AC-16 的「实例…不能处理升级」「审批…已失效」与既有原文一致；「升级 ESC-002 不支持该动作」是新文案（A-11 已登记新键）；AC-15/AC-13 的「已处理（重新分配），无需再次处理」与既有模板前缀不一致（F-12）。

**核心约束核对**

```text
src/core/orchestrator.js:5054  // BR-19: only a rounds_exceeded escalation may be passed.
src/core/orchestrator.js:5055  if (decision === 'pass' && entry.reasonCode !== 'rounds_exceeded')
```

→ 需求 U-5/BR-08「继续仅轮次超限可用」有核心依据；但如 F-07 所述，没有 AC 验证置灰与悬停文案。

```text
src/core/approvals.js:  allow → 'approved'; deny → 'denied'
src/cli/labels.js:52–57 APPROVAL_LABEL: 待处理 / 已通过 / 已拒绝 / 已作废
```

→ AC-12 的状态词与既有实现一致。

### 6.4 未能观测到的项（说明试过的路径）

- 「I1.10b 完全没有提交」：本地无 `feat/i1.10b-drilldown` 分支；已查 `origin/feat/i1.10b-drilldown`（指向 66e5a6b、领先 0）。结论按 `origin/*` 成立。
- 「托盘菜单在真实桌面的排版 / 通知点击手感」：无头环境无法观测；需求 §3.3 已登记为人工核验项，不作为 AC 判据，本轮不判。
- 「A-5 示例值（开发/技能/工具/命令数）是否与内置资产一致」：实跑 `orch role show developer` / `skill list` 显示内置 `developer` 的技能是 `code-change, test-run`、工具 `read/write/edit/bash`、并发 1，`doc-draft` 的命令数是 0，与 A-5 示例不同。A-0 允许「角色名/资产计数」随夹具变，故不作为阻断；但建议在 A-5 明确「本块为夹具示例，不是内置资产基线」，避免下游误当真实值。

---

## §7 给主控的口径问题（需裁决）

1. **批量处置是否算 881 的队列细化**（F-18）：规划只写「一键……」，需求新增多选 + 批量回报 + 部分失败。若接受，请在 §1.3 明确「批量属 881 的实现细化」；若不接受，应删除 AC-13/BR-09/BR-12 的批量部分。
2. **通知开关 / 去重窗口 / 点击定位是否算 880 的细化**：规划只写「托盘通知（三类）」，需求新增总开关 + 三分项 + 10s/60s 去重 + 点击定位。当前判为「细化、非新能力域」，但若主控按严格口径判夹带，需要把这些从范围内移出或补规划来源。
3. **§1.3/U-10「上次所在视图」**：既非规划能力，也非本迭代 §2/§3 的功能；建议直接删除，或补一条「记住上次视图」的功能点 + AC。当前判为「夹带（建议级）」。
4. **「桌面层零中文字面量」的边界**：现有壳层 `config.rs` 已有中文默认值。建议统一口径为「`desktop/ui` 与 `desktop/harness` 零 CJK；壳层允许与 `/ui/labels` 同源的 baked-in 默认值」，否则 BR-27 从基线起就不成立（F-06）。
