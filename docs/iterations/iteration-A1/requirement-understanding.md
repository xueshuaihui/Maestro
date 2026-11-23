# A1 — 需求理解纪要（S0 评审 PASS 后产出）

> **产物定位**：执行模板 §1.0.5 派单 C 产物。读定稿需求产出理解纪要，**不修改需求正文**（不改 `requirement.md` / 评审记录 / 三件套 / `src/**` / `test/**`）。
> **输入基线**：
> - 定稿需求 `docs/iterations/iteration-A1/requirement.md` **v2**（15 AC / 11 BR / 5 NF；头部版本 = 附录 C 末行 v2）。
> - 评审记录 `review-round1.md`（F-01~F-06）→ `review-round2.md` **总判 PASS**：阻断 0 / 建议 0 / 新增 FAIL 0，上轮 F 项全部「已修」，回归扫描无新增。
> - 适配裁决 `docs/iterations/A-phase-decisions.md` AD-01~AD-10（尤其 AD-05 已有实现仅作现状参考、AD-06 全量门禁等效口径、AD-07 purity 口径、AD-08 真实 CLI 未取证判阻塞）。
> **引用行号**：下列 `requirement.md:Lxxx` 均指 v2 定稿文件行号，便于逐条复核。

---

## 1. 范围 In / Out（逐条对应需求 §1.3，L40–L61）

### 1.1 范围内（本次让用户获得的新能力，7 条）

| # | 范围内条目 | 规划落点 | 对应 AC | 需求行 |
|---|---|---|---|---|
| IN-1 | **自动扫描本机 Agent CLI**：覆盖 PATH / 应用目录 / 包管理器 / 用户配置四类来源，首次启动即执行 | 383 行 | AC-01/03/04/05 | L42（§2.2+§2.7 L124–131） |
| IN-2 | **CLI 清单罗列**：展示名称 / 路径 / 版本 / 连接状态，附来源提示 | 383 行 | AC-01/02/15 | L43（§2.3 L88–95） |
| IN-3 | **能力探测与连接测试**：显式、只读、带超时的轻量握手，结论用户可见 | 384 行 | AC-07/08 | L44（§2.4 L97–104） |
| IN-4 | **CLI 能力矩阵**：把各 CLI 可驱动能力横向呈现，供 A2 选 CLI 用 | 384 行 | AC-09 | L45（§2.5 L106–113） |
| IN-5 | **重新扫描与不可达诊断**：手动重扫刷新；不可达 CLI 给原因与修复建议、不静默丢弃 | 384 行 | AC-06/10 | L46（§2.6 L115–122） |
| IN-6 | **手动添加自定义 CLI**：登记自定义可执行路径，覆盖/补充自动发现，出现在清单并可连接测试 | 385 行 | AC-13 | L47（§2.7 L124–131） |
| IN-7 | **真实宿主验收句与证据前提**：规划 385/386 行逐字落到 AC-12 / AC-14，不降级、不收窄 | 385/386 行 | AC-12（真实面，阻塞）/ AC-13 / AC-14（mock 面） | L48（§2.8 L133–137） |

### 1.2 范围外（本次不覆盖，9 项）

| # | 范围外条目 | 留待 / 归属 | 需求行 |
|---|---|---|---|
| OUT-1 | 桌面壳与 CLI 发现页视觉设计、交互细化、系统托盘、后台 daemon 常驻 | C1（阶段 C / v1 I1.10a）；A1 只保证用户可见语义与可复现接缝 | L52 |
| OUT-2 | 基于 CLI 创建角色与员工、一角色多员工、部门归属、角色能力校验 | A2；A1 只产出「可选择的 CLI 清单 + 能力信息」 | L53 |
| OUT-3 | Agent Team 拖拽搭建、团队模板 | A3 | L54 |
| OUT-4 | 12 阶段工作流创建器、门禁、三种运行模式 | A4 | L55 |
| OUT-5 | 按能力调度任务到员工、真实 ACP 会话驱动、一角色多员工并行 | A5 与阶段 B（B1）；A1 只产出能力矩阵供调度器消费 | L56 |
| OUT-6 | 多 CLI 混跑、同一 Team 多 CLI 员工、跨项目复用 | D1 / D2 / D3 | L57 |
| OUT-7 | 替用户安装软件、修改用户 CLI 配置、写入用户系统目录 | 永久范围外（§2.2 / §8 第 3 条：扫描只读） | L58 |
| OUT-8 | 网页版客户端控制 | 永久范围外（§8 第 2 条） | L59 |
| OUT-9 | 把 `npx geiger-scan` 作为运行时硬依赖 | 永久范围外（§5 能力域 0：本地零依赖） | L60 |
| OUT-10 | 真实宿主取证机器 | 本机无真实 CLI（AD-08 / D-2 / D-4），由主控/用户安排；未取证前相关 AC 判阻塞、不判通过、不用 mock 顶替 | L61 |

> 说明：范围外共 10 行（OUT-1~OUT-10），其中 OUT-10 为取证前提而非功能项。

---

## 2. AC 清单与分面（15 条，L161–L324）

**面类型口径**：
- **真实宿主面**：需在装有目标 CLI 的机器上取证，未取证判阻塞（AD-08）——仅 **AC-12**。
- **mock 面**：在 `NODE_ENV=test` + 独立项目根夹具上可复现——其余 **14 条**（AC-01~AC-11、AC-13~AC-15）；其中 **AC-14** 是 AC-12 规划验收句①的 mock 支撑面，证据级别「mock 实测」，**不得冒充真实宿主达标**（附录 A-7）。

| AC | 一句话场景 | 分面（主） | 面类型 | 需求行 |
|---|---|---|---|---|
| AC-01 | 专属 PATH 放入 `codex` 可执行，扫描后清单自动列出（名称/路径/状态/来源） | 发现 + 罗列 | mock 面 | L161–170 |
| AC-02 | 探测 `codex` 版本，清单版本列由占位变为实际版本文本 | 能力探测（版本） | mock 面 | L172–181 |
| AC-03 | 应用目录放 `WorkBuddy.app` 标记但不在 PATH，扫描后列为 `unreachable` + 来源 app | 发现（应用目录） | mock 面 | L183–192 |
| AC-04 | npm 全局包目录有 `opencode-ai` 但不在 PATH，扫描后列为来源 npm-global | 发现（包管理器） | mock 面 | L194–203 |
| AC-05 | 手动添加自定义 CLI 后重新扫描，用户配置条目保留、不被覆盖 | 重扫 / 用户配置 | mock 面 | L205–214 |
| AC-06 | 仅 `.codex` home 标记（不在 PATH），不可达项保留并给「已安装但不在 PATH」诊断 | 诊断（不可达） | mock 面 | L216–225 |
| AC-07 | 对 ACP 方言模拟 CLI 连接测试，展示 ACP 支持与会话能力、状态转 connected | 能力探测（握手） | mock 面 | L227–236 |
| AC-08 | 卡住/崩溃 CLI 连接测试在硬超时内以 `{ok:false,code}` 返回，不抛异常、不卡死 | 诊断（探测失败/超时） | mock 面 | L238–247 |
| AC-09 | 两个 CLI（一个已探测、一个未探测）横向对比五维矩阵，未探出显示「未探测」 | 矩阵 | mock 面 | L249–258 |
| AC-10 | 新放一个 CLI 后重新扫描，清单 N→N+1、扫描时间更新、手加条目仍在 | 重扫 | mock 面 | L260–269 |
| AC-11 | 扫描前后被扫目录字节不变、零运行时依赖、唯一写入 `.orch/cli-registry.json` | 只读 / 安全 | mock 面 | L271–280 |
| AC-12 | **真实宿主面**：装了目标 CLI 的机器启动应用扫描，自动列出且四项信息准确 | 真实宿主（阻塞） | **真实宿主面（AD-08 阻塞）** | L282–291 |
| AC-13 | 手动添加自定义可执行路径后出现在清单、可连接测试，重复/非法被拒 | 手加 | mock 面 | L293–302 |
| AC-14 | **AC-12 的 mock 支撑面**：夹具「装了至少一种 CLI」扫描+探测，四项信息与夹具一致 | mock（验收句支撑） | mock 面 | L304–313 |
| AC-15 | 四类来源夹具全空时显示空态引导 + 来源概览，而非空白页 | 罗列 / 异常（空态） | mock 面 | L315–324 |

### 2.1 分面统计（按主分面归类，合计 15）

| 分面 | AC | 条数 |
|---|---|---|
| 发现 / 罗列 | AC-01、AC-03、AC-04、AC-15 | 4 |
| 能力探测 | AC-02、AC-07 | 2 |
| 矩阵 | AC-09 | 1 |
| 重扫 / 用户配置 | AC-05、AC-10 | 2 |
| 诊断（不可达 / 失败超时） | AC-06、AC-08 | 2 |
| 只读 / 安全 | AC-11 | 1 |
| 手加 | AC-13 | 1 |
| 真实宿主面（阻塞） | AC-12 | 1 |
| mock 支撑面（AC-12 验收句①） | AC-14 | 1 |
| **合计** | | **15** |

### 2.2 面类型统计

- **真实宿主面：1 条**（AC-12）——按 AD-08 阻塞，本机无 CLI，造现场需装目标 CLI 的机器。
- **mock 面：14 条**（AC-01~AC-11、AC-13~AC-15）——其中 AC-14 为 AC-12 的 mock 复现出口，证据分级见附录 A-7。

---

## 3. BR / NF / M / C 契约清单

### 3.1 业务规则 BR-01~BR-11（11 条，§2.9 L141–151）

| BR | 摘要 | 需求行 |
|---|---|---|
| BR-01 | 扫描只读——不装软件、不改用户 CLI 配置、不写用户系统目录 | L141 |
| BR-02 | 自动扫描覆盖 PATH / 应用目录 / 包管理器三类来源；用户配置为第四类 | L142 |
| BR-03 | 清单至少展示名称 / 路径 / 版本 / 连接状态四项，并标注来源与扫描时间 | L143 |
| BR-04 | 已安装但不在 PATH、或探测失败的 CLI 必须保留并给可读原因与修复建议，不得静默丢弃 | L144 |
| BR-05 | 版本与能力信息必须来自实际探测；未探出的显示占位/「未探测」，不得编造 | L145 |
| BR-06 | 能力探测与连接测试显式、只读、带硬超时；失败以可读结果呈现，不抛异常、不卡住 | L146 |
| BR-07 | 能力矩阵按实际探测结论、**完整五类维度**（ACP / stdio·transport / 会话恢复方言 / 并发上限 / 证据钩子）横向可比；未探测显示「未探测」、失败按「未探出」、不因缺实现删维 | L147 |
| BR-08 | 重新扫描刷新清单与扫描时间，不覆盖用户手动添加条目；扫描失败保留上一次清单 | L148 |
| BR-09 | 用户可手动添加自定义 CLI（名称+路径），添加后出现在清单并可连接测试；非法/重复被拒且不写入 | L149 |
| BR-10 | 装有至少一种 CLI 的机器启动应用必须自动列出且四项准确；真实宿主取证须在该机器上进行，未取证判阻塞 | L150 |
| BR-11 | CLI 清单与能力矩阵是配置项、不硬编码固定 CLI 集合；不同机器清单随实际安装变化 | L151 |

> 评审复核：`review-round2.md` D③ 实跑 BR 双向覆盖 0 遗漏 0 悬空（11 条均被 AC 引用）。

### 3.2 非功能验收 NF-1~NF-5（5 条，§3.2 L328–332）

| NF | 摘要 | 需求行 |
|---|---|---|
| NF-1 | 用户可感知的响应：扫描/连接测试数秒内出结果或「检测中/探测中」反馈；连接测试带硬超时 | L328 |
| NF-2 | 只读安全：扫描后本机 CLI 与用户配置无可见变化，不静默安装/改写 | L329 |
| NF-3 | 证据分级真实：结果按「mock 实测 / 待本机实测 / 已实测」分级；未取证真实宿主面判阻塞，mock 0 次冒充真实达标 | L330 |
| NF-4 | 零依赖 / 纯净：不依赖用户机器 Node/npx 或联网拉包；新增中文只经 `src/cli/labels.js`；领域层零 CJK、文案唯一来源 | L331 |
| NF-5 | 基线不回归：按 AD-06 等效口径（受影响面串行 + git worktree 基线树对照，新增红差集 0），不放宽任何 AC 判据 | L332 |

### 3.3 M / C 契约

**本迭代未定义 M/C 契约。** 需求 §2/§3 仅定义 BR-01~BR-11、AC-01~AC-15、NF-1~NF-5 与前置条件 P-1~P-6；无独立 M（里程碑）契约与 C（契约）契约条目。附录 D 的 D-1~D-11 是实现建议/约束，不充当 M/C 契约。

---

## 4. 附录 A / D 索引

### 4.1 附录 A 输出基线（用户可见文案，L345–L411）

- **A-0 可变值约定**：占位符 `[N]/[名称]/[路径]/[版本]/[状态]/[来源]/[时间]/[原因]/[位置]` 取证时按实际替换；状态词映射 `idle=可用 / connected=已连接 / unreachable=未就绪 / probing=检测中`（L349、L352）。
- **不变文案基线（25 键，逐字沿用 commit `a80af4f`，L350–L351）**：`本机 Agent CLI`、`扫描时间`、`未发现可用的 Agent CLI`、`请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描`、`用法：orch cli list|scan|probe <cli_id> [--format json]`、`未知子命令：{sub}`、`未找到 CLI：{id}`、`扫描完成，发现 {n} 个 Agent CLI`、`标识`、`名称`、`版本`、`路径`、`状态`、`来源`、`可用`、`已连接`、`未就绪`、`检测中`、`已安装但不在 PATH`、`{name} 探测完成：ACP {acp}`、`{name} 探测失败：{cause}`、`支持`、`不支持`、`扫描结果已保存至 {path}`、`CLI 注册表格式不正确`。新增手动添加/矩阵文案只在该表末尾追加，不改既有键值（D-7）。
- **A-1 清单表头与空态 / A-2 扫描完成与保存 / A-3 连接测试成功 / A-4 失败/不可达诊断 / A-5 重新扫描 / A-6 手动添加 / A-7 证据分级**（L354–L411）：A-7 证据级别三态 `mock 实测 | 待本机实测（需装有目标 CLI 的机器） | 已实测（真实宿主面）`，未取证真实宿主面一律写「待本机实测」并判阻塞。

### 4.2 附录 D 实现约束要点（D-1~D-11，L442–L513）

- **D-1 差距清单（已有实现 vs 本需求，5 项，L448–L450）**：
  - 已具备（现状参考、不作需求来源）：PATH/home 标记/应用目录/npm 全局发现（discover.js）、版本与 ACP 握手（probe.js）、`.orch/cli-registry.json` 缓存（registry.js）、`orch cli list|scan|probe`（cli-discovery.js）、`CLI_DISCOVERY_TEXT`（labels.js:1254）、`test/wp16/cli-discovery.test.js` / `cli-probe.test.js`。
  - 差距（S2 补齐）：① 用户配置第四类来源 + 重扫保留（AC-05/BR-02/BR-08）；② 手动添加命令与入口（AC-13/BR-09）；③ 能力矩阵数据呈现（AC-09/BR-07）；④ 已安装但不在 PATH 修复建议与不可达诊断可读呈现（AC-06/BR-04）；⑤ 真实宿主取证（AC-12，阻塞）。不得因「已有代码」跳过任何 AC 判定（AD-05）。
- **D-2 发现来源与只读纪律**：四类来源 + evidence（type=path|home|app|npm-global）；有 evidence 即列出、标记者不静默 continue；发现阶段不 spawn/不写扫描目录，缓存写入仅 `saveCliRegistry` 原子写（L452–L456）。
- **D-3 探测与连接测试**：`probeVersion` / `probeAcp` 两个独立按需探测；硬超时 version 5s / acp 10s，超时 `{ok:false,code:'CLI_PROBE_TIMEOUT'}`，失败以数据返回不抛；ACP 握手收敛 adapter 层、不进核心（L458–L462）。
- **D-4 能力矩阵数据**：固定五类维度、不引入第二份能力数据、直接消费 finding 字段；证据钩子当前无实现支撑属 S2 差距（D-1），按规划列示、不删维、不臆造；矩阵视图由 C1 交付（L464–L467）。
- **D-5 重新扫描与不可达诊断**：重扫覆盖写注册表（`scanned_at` 更新）但用户配置合并保留；诊断文案经 `CLI_DISCOVERY_TEXT` 下发、不自动探测；缓存损坏返回 `CLI_REGISTRY_INVALID`（L469–L473）。
- **D-6 手动添加与用户配置（最大差距，闭合 U-05，L475–L479）**：`orch cli add --name <名称> --path <路径>` 为**实现建议、非规划原文**，仅供机检/夹具/附录使用，`cli add` 字面不改 BR-09/AC-13 用户判定；在 `SUBS` 追加 `add`，校验名称/路径非空、文件存在可执行、重复路径拒绝；用户配置独立持久化、重扫合并不覆盖。**闭合项**：U-05 已闭合，命令字面非规划强制。
- **D-7 中文文案与基线**：`CLI_DISCOVERY_TEXT` 现有 25 键逐字不变、末尾追加新键；状态中文映射固定；领域层零 CJK（L481–L484）。
- **D-8 测试与夹具接缝（全局）**：独立项目根 `mktemp -d /tmp/maestro-a1-<场景>.XXXXXX`（macOS 用 os.tmpdir，AD-04）、统一 `NODE_ENV=test`；发现类用 `discoverAgentClis(options)` 注入、探测类用 mock ACP agent；全量门禁 AD-06 等效口径（L486–L490）。
- **D-9 授权断言修改清单（点名文件+行号+只改哪段，「只加不改」，L492–L503）**：
  1. `src/cli/cli-discovery.js:29`（`SUBS`）——只追加 `add` 成员。
  2. `src/cli/cli-discovery.js:79-101`——追加 `add` 分支与 `--name`/`--path` 解析，既有分支与 `--format` 解析不动。
  3. `src/cli/labels.js:1254-1280`——末尾追加新键，现有 25 键逐字不动。
  4. `src/adapter/cli-discovery/discover.js:112-185`——追加用户配置合并逻辑，既有四来源发现与「有 evidence 即列出」不动。
  5. `src/adapter/cli-discovery/registry.js:47-77`——追加用户配置持久化合并不覆盖自动发现，既有原子写与 schema 校验不动。
  6. `src/adapter/cli-discovery/index.js:5-8`——如新增导出，只追加 export。
  7. `test/wp16/cli-discovery.test.js` / `cli-probe.test.js`——追加新断言，既有 A1-01~A1-13 逐字不改、不放宽。
  8. **已核明确不改的精确断言**：`test/wp2/labels.test.js:271`（`REASON_LABEL` 49 键）、`test/wp9/i19-labels.test.js:293` / `test/wp15/regression.test.js:156`（`USAGE_LINES` 25 行）、`test/wp14/labels-drill.test.js:303-312`（`DESKTOP_LABEL_KEYS` 64+63 键）、`test/wp13/checkpoint.test.js:105`（checkpoint 全键冻结）——若变红属越界，回退实现而非放宽断言。
- **D-10 编号与标题形态**：BR-01~11 / AC-01~15 / NF-1~5 连续、三件套+锚点齐全、BR 双向覆盖；规划 382–386 行逐字映射（L505–L508）。
- **D-11 A1「启动应用」可运行用户面（闭合 U-04，L510–L513）**：A1 可运行面 = `orch cli` 命令面（`cli scan/list/probe/add`），桌面壳+发现页首屏属 C1；AC-12 的 GWT 保持用户视角，`orch cli` 字面只在锚点/机检/夹具出现，**不写进 AC-12 的 Then**；不因桌面壳由 C1 交付而放宽 AC-12。**闭合项**：U-04 已闭合，不留悬置。

---

## 5. 未决问题与假设（附录 B-2，L427–L433）

| ID | 状态 | 是否阻塞开工 | 摘要 | 依据 |
|---|---|---|---|---|
| U-01 | 待取证（阻塞） | **阻塞 AC-12 真实宿主面；不阻塞其余 14 条 mock 面开工** | 本机无真实 Agent CLI（AD-08/D-2/D-4），AC-12 的真实宿主 Given 在本机不可构造、判阻塞并附试过路径；mock 面 AC-14 可全量复现。请主控按 D-4 安排装有目标 CLI 的机器，或按 §4.5 升级用户书面豁免；豁免前 AC-12 不判通过 | L429 |
| U-02 | 待确认（不阻塞） | 不阻塞 | D-2 待用户确认首版优先接入的 CLI 清单；需求判定为「发现器通用、清单是配置项、按实际安装变化」，不绑定具体清单；仅影响 D 识别表维护，不放宽 AC | L430 |
| U-03 | 已闭合（不阻塞） | 不阻塞 | 规划「能力矩阵」按 §2.2:128 / §5:223 展开为完整五类；F-01 已补回第五类 stdio·transport（§2.5/BR-07/AC-09/D-4 同步）；维度再增删须同步改四处，不放宽判据 | L431 |
| U-04 | 已闭合（不阻塞） | 不阻塞 | A1「启动应用」可运行面 = `orch cli`，桌面首屏属 C1；已写入 D-11，AC-12 Then 保持用户视角；无需再评审 | L432（D-11 L510–L513） |
| U-05 | 已闭合（不阻塞） | 不阻塞 | `cli add --name --path` 为内部实现建议字面、非规划原文；BR-09/AC-13 用户判定不依赖该字面；已写入 D-6；无需再评审 | L433（D-6 L475–L479） |

**阻塞开工的未决问题清单**：仅 **U-01**，且仅阻塞 **AC-12 真实宿主面**（需装目标 CLI 的机器或用户书面豁免），不阻塞其余 14 条 mock 面开工。U-02~U-05 均为「不阻塞 / 已闭合」。

---

## 6. Given 可构造性核查（逐条造现场，L159 + 各 AC Given/夹具）

**统一接缝（§3.1 判定锚点约定 L159、P-1~P-5 L336–L340）**：
- 仓库根 `$MAESTRO_REPO=/Users/xuesh/www/Maestro`（P-1 HEAD `f2b5742`、macOS/zsh/Node v22.22.2）。
- 每条 AC 独立项目根 `ROOT=$(mktemp -d /tmp/maestro-a1-<场景>.XXXXXX)`，统一注入 `NODE_ENV=test`（P-2）。
- 用户可见操作 `node "$MAESTRO_REPO/bin/orch.js" cli list|scan|probe|add`（`add` 见 D-6）；隔离单一来源用适配器注入接缝 `discoverAgentClis(options)`（注入 `pathEntries/appDirs/npmGlobalRoot/home/clock`，P-3）；能力握手用 `mockAcpScript()`（P-5）。

| AC | 造现场步骤（独立 root + NODE_ENV=test + 具体动作） | 可构造性 |
|---|---|---|
| AC-01 | `ROOT=$(mktemp -d /tmp/maestro-a1-path.XXXXXX)`；`mkdir -p "$ROOT/bin"`；写 `codex` 可执行到 `$ROOT/bin/`；`cd "$ROOT" && PATH="$ROOT/bin" NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan` | ✅ 可构造 |
| AC-02 | 同 AC-01 夹具（`codex` 返回 `codex 1.2.3`）；`cli probe codex` 后查清单版本列由占位变 `codex 1.2.3` | ✅ 可构造 |
| AC-03 | `ROOT=$(mktemp -d /tmp/maestro-a1-app.XXXXXX)`；`mkdir -p "$ROOT/apps/WorkBuddy.app"`；注入 `discoverAgentClis({appDirs:[$ROOT/apps],home:$ROOT/home,pathEntries:[]})` | ✅ 可构造 |
| AC-04 | `ROOT=$(mktemp -d /tmp/maestro-a1-npm.XXXXXX)`；`mkdir -p "$ROOT/npm/opencode-ai"`；注入 `discoverAgentClis({npmGlobalRoot:$ROOT/npm,pathEntries:[],home:$ROOT/home})` | ✅ 可构造 |
| AC-05 | `ROOT=$(mktemp -d /tmp/maestro-a1-userconf.XXXXXX)`；`cli add --name MyCLI --path $ROOT/bin/mytool` → `cli scan` → `cli list`，比对重扫前后条目 | ✅ 可构造 |
| AC-06 | `ROOT=$(mktemp -d /tmp/maestro-a1-unreach.XXXXXX)`；`mkdir -p "$ROOT/home/.codex"`；注入 `discoverAgentClis({home:$ROOT/home,pathEntries:[],appDirs:[]})` | ✅ 可构造 |
| AC-07 | `NODE_ENV=test node --test test/wp16/cli-probe.test.js`（`mockAcpScript()` 生成 speaking-NDJSON 模拟 agent，`process.execPath` 作 executable） | ✅ 可构造 |
| AC-08 | 同上测试（`probeVersion` 用 `setTimeout` 卡死、timeout 300ms，`{ok:false,code:'CLI_PROBE_TIMEOUT'}`） | ✅ 可构造 |
| AC-09 | `ROOT=$(mktemp -d /tmp/maestro-a1-matrix.XXXXXX)`；`cli probe <已发现CLI>` → `cli list`；矩阵以清单/探测数据为源（视图细节 C1） | ✅ 可构造 |
| AC-10 | `ROOT=...`；`cli list` 记 N；新建 `$ROOT/bin/newcli` 可执行 → `cli scan` → `cli list` 期望 N+1、`scanned_at` 更新 | ✅ 可构造 |
| AC-11 | `ROOT=$(mktemp -d /tmp/maestro-a1-readonly.XXXXXX)`；记录 sha256 → `cli scan` → 比对扫描 target sha256 不变、dependencies=0 | ✅ 可构造 |
| **AC-12** | **本机无 CLI，按 AD-08 判阻塞，造现场需装目标 CLI 的机器**：取证机器 `cd <独立项目根> && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan`，断言四项与 `which <bin>` / `<bin> --version` 实测一致；本机须显式记录「本机无目标 CLI → 阻塞」并附试过路径（PATH 实测无 codex/claude/gemini，仅 WorkBuddy.app）；本机仅用 AC-14 mock 证明逻辑可复现，**不得作为真实宿主达标证据** | ⛔ 需真实机器（阻塞） |
| AC-13 | `ROOT=$(mktemp -d /tmp/maestro-a1-add.XXXXXX)`；写 `mytool` 可执行 → `cli add --name MyCLI --path $ROOT/mytool` → `cli list`；重复/非法输入被拒 | ✅ 可构造 |
| AC-14 | AC-01 + AC-02 + AC-07 三夹具串联（专属 PATH 中 `codex` + 版本 + ACP 握手），证据标注「mock 实测」，与 AC-12「待取证」严格分开 | ✅ 可构造 |
| AC-15 | `ROOT=$(mktemp -d /tmp/maestro-a1-empty.XXXXXX)`；空来源接缝运行 `cli scan` → `cli list`，查 `CLI_DISCOVERY_TEXT.NONE/NONE_HINT` 空态与来源概览 | ✅ 可构造 |

**Given 可构造性核查结论**：15 条 AC 中 **可构造 14 条**（AC-01~AC-11、AC-13~AC-15，均在独立项目根 + `NODE_ENV=test` 夹具/接缝上可复现）、**需真实机器 1 条（AC-12，按 AD-08 判阻塞）**。P-1~P-5 的命令、接缝、夹具均为需求已定义的真实锚点；无「历史会话为空闲或已隔离」式不可复现状态。

---

## 7. 与上一迭代的契约差异与回归红线

A1 是 v2 阶段 A 的首个迭代（相对 v1 I1.x 引擎）。边界与回归红线如下，逐条有据：

1. **不碰 `src/core` / `src/daemon`（领域层纯净）**：全部 A1 实现落在 `src/adapter/cli-discovery/`、`src/org/**`（后续迭代）与 CLI 命令层；purity 扫描口径不变——`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator`（11 词并集，AD-07）→ exit 0。AC-01~AC-15 每条架构检查均含此命令。能力探测收敛 adapter 层，不打进控制核心：`grep -REn "if host ==|if\(host" src/core src/daemon` → 零命中（AC-07）；daemon 不出现 `if host == '...'`（D-3）。
2. **中文只在 `src/cli/labels.js`（零 CJK）**：新增领域层零 CJK，唯一中文来源 `CLI_DISCOVERY_TEXT`（labels.js:1254）；`node -e` CJK 检测对 `discover.js`/`probe.js`/`registry.js` 输出 OK（AC-01/03/09/14 架构检查）；现有 25 键取值逐字不变、测试精确计数断言（`REASON_LABEL` 49 / `USAGE_LINES` 25 / `DESKTOP_LABEL_KEYS` 64+63 / checkpoint 全键）不得变红（D-7 / D-9 / NF-4）。
3. **CLI 命令独立分流，不碰 `main.js` 冻结 parser**：`bin/orch.js` 对 `argv[0]==='cli'` 独立调 `cliDiscoveryMain(argv.slice(1))`，与冻结的 I1.x `main()` 命令面隔离（已核 `bin/orch.js` 注释与分流逻辑）；新增命令只在 `src/cli/cli-discovery.js` 的 `SUBS` 追加 `add` 并追加分派/flag 分支，`main.js` 既有 parser 不动（D-6 / D-9）。
4. **已有实现仅作现状参考、不跳过 S0→S4**：A1 已有实现（commit `a80af4f`，AD-05）先于本编排完成；S2 做差距核对与补齐（D-1 五项），不重复造轮子，但不得因已有代码跳过任何 AC 判定。
5. **全量门禁等效口径（AD-06）**：本机全量并发有 EXIT 137 史、实测 `# tests 1947 / # pass 1923 / # fail 21`、flaky 20→21、非零退出——**不得写「全量全绿」**；采用受影响面串行 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` + git worktree 基线树对照、新增红差集 0（NF-5 / P-6）。
6. **AC 判定强度不因范围外而放宽**：桌面壳/发现页首屏属 C1（OUT-1），但 AC-12 的 GWT 保持「启动应用执行扫描 → 自动列出且信息准确」用户视角，`orch cli` 字面不写进 Then（D-11 / U-04）；五类能力维度不因证据钩子无实现而删维（D-4 / U-03）；`cli add` 字面非规划强制但不改 BR-09/AC-13 用户判定（D-6 / U-05）。

> 以上红线来自需求 §1.3 / §3.1 架构检查 / 附录 D-7/D-9/D-11 与 AD 台账；评审 round2 已确认上轮 PASS 条目未被改坏、AC 仍 15 / BR 仍 11 / Then 未放宽。本纪要仅作理解与索引，不新增、不改、不删任何需求条目。
