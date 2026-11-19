# I1.11 需求理解（v7）

> 读者：S1 拆分与 S2 实现方。本文是**理解摘要与速查卡**，不是第二份需求；一切逐字文案、断言命令以 `requirement.md`（v7，1422 行，49 AC / 37 BR / 8 NF）原文为准。所有基线数字均已在本机（分支 `feat/i1.11-notify-queue-assets`，HEAD `b23303a`，基线 `66e5a6b`）实跑复核，复核记录见 §8。

## 1. 范围

### 1.1 In scope（对应需求 §1.3，按能力域一句话）

| 能力域 | 一句话 |
|---|---|
| 托盘通知（§2.2） | 升级待处理 / 实例完成 / 实例异常三类事件 ≤2 秒触达系统托盘通知，五段固定段序正文；点击定位到队列条目；总开关 + 三类分项开关按本机记住（写 `.orch/desktop/prefs.json`）；10s/60s 去重合并；通知不可用不阻断。 |
| 人工干预队列（§2.3） | 跨实例合并全部待处理升级与待审批为一个队列；每行统一八字段（按 ` · ` 切 7 段）；固定排序；空态「待处理 无」；新条目 2 秒内自行出现；断线保留旧内容并标注。 |
| 五种决策动作与处理后续跑（§2.4） | 升级：继续 / 重派 / 终止（实例级取消，二次确认）；审批：允许 / 拒绝。一次只处置一条（批量已按 D-01 移出范围）；处理完最后一条后实例 5 秒内自动续跑。 |
| 三类资产库浏览（§2.5） | 角色 / 技能 / 工作流的列表（名称、来源、校验状态；角色与技能另有分组，工作流另有节点数与边数）+ 详情 + 中文降级；完全只读。 |
| 角色库运行时子视图（§2.6） | 按角色聚合跨实例占用：参与实例数、活跃会话数、服务节点（≤2 逐个、>2 折叠「等 N 个」）、宿主；空态「角色占用 无」；只列有运行时记录的角色 + 注册表角色标「未参与」。 |
| 工作流画布只读（§2.7） | 按定义画角色图（含人工 / 升级 / 子工作流节点与回流弧线），复用既有 `computeLayout`；降级分工：「定义 空」vs「定义不可读 · 仅显示可解析部分」vs「校验不通过」标签。 |
| 证据浏览独立视图（§2.8） | 按节点五项：命令、退出码、关键输出行数、日志引用、产物引用（含校验时间）；多次尝试取最近一次；缺项「未提供」；引用不可读单项标注；不展示日志正文。 |
| 托盘交互（§2.9） | 信息行「实例 N · 待处理升级 M」（只读菜单项，D-09）2 秒内更新；暂停 / 继续（逐实例走既有 `workflow.pause`）；退出语义与 I1.10a 逐字一致。 |
| 本机偏好落点 | **只**写 `.orch/desktop/prefs.json` 的四个开关键（D-42）；唯一写入方 = 新增 `src/daemon/prefs.js`；入口固定在队列页顶部设置区。 |

### 1.2 Out of scope（逐条 + 去向）

| 项 | 去向 |
|---|---|
| 角色下钻、局部 DAG、任务卡片、节点详情、连接线展开、subworkflow 下钻、跳转宿主、角色状态栏 | I1.10b（`origin/feat/i1.10b-drilldown` 与基线 `66e5a6b` 差异 = 0，实测）。本迭代任何 AC 不得以其为前置（BR-30 / AC-43）。 |
| 治理与签名（审计哈希、权限拦截、证据过期、人工终审、预算配额、包导出、`orch migrate`、可观测性导出等） | I1.12 |
| Web 入口、远程查看、多宿主视图 | I2.4（阶段二） |
| IM 通知（企业微信 / 邮件 / Webhook）、面板轮询作为独立触达 | 后续迭代（U-2） |
| 资产新建 / 编辑 / 导入 / 导出 / 校验触发 | 仍只在 CLI；面板零写入口 |
| 队列已处理条目的历史视图 | I1.12 审计面（队列只列待处理，D-10） |
| 多选与批量处置 | 按 D-01 移出；I1.12 或更后另立需求 |
| 跨项目根 / 跨机器的角色占用聚合 | 需全局索引，数据布局变更，后续迭代（D-07） |
| 「只终止该节点、实例继续跑」 | 新语义，后续迭代（终止 = 实例级取消，D-08） |
| 通知偏好跨机器同步、通知声音 / 免打扰、通知历史中心 | 后续迭代 |
| 证据导出、产物内容预览、完整日志查看 | I1.12 |
| 画布编辑、拖拽保存、运行时叠加、节点下钻 | I1.10b / 后续 |
| 真实宿主取证（真实 DSH / 凭据） | 本机保留项；验收为 B 类（mock 宿主） |

**回归红线（全文）**：三条主链与既有 CLI / HTTP 面逐字不变；`dependencies` 恒 `{}`、无打包器；中文唯一来源分层（BR-26）；`src/core` / `src/daemon` 零 31 词禁词；全量失败集合差集 0 + 条数只增不减；全部 AC 在 `66e5a6b` 上可独立跑通。

## 2. AC 清单与分面

> 49 条，编号连续。判定方式三档：**机检**（`test/wp14/<file>.test.js` 先断言存在再 `node --test`，断言 `# pass ≥ 1` / `# fail 0`）、**架构检查**（`grep -RE` 锚点，基线已实跑核对，见 §8）、**夹具现场**（`/tmp/maestro-i11-*` 独立项目根 + `NODE_ENV=test` + `--host mock`）。

| 域 | AC | 一句话 | 关键夹具现场 |
|---|---|---|---|
| 通知 | AC-01 | 升级待处理 2 秒内托盘通知，正文五段逐字；触发前后五组状态逐值不变（规划验收句第 1 句） | `single` 实例 + `POST /__test__/escalations`（reasonCode `execution_failed`） |
| 通知 | AC-02 | 实例完成通知一次，正文 `升级 —` 段不省略 | `single` 自然跑完 |
| 通知 | AC-03 | 实例异常通知（停核重启 → 已中断，需关注），只一次 | `single` + `core stop` + 重启 |
| 通知 | AC-04 | 点击通知唤前 + 停队列 + 选中条目 | `ctl/notify-open` |
| 通知 | AC-05 | 通知开关总 / 分项，按本机记住（prefs.json） | 队列页设置区 + `POST /__test__/notify-trigger` + `--project` 重启 |
| 通知 | AC-06 | 10s 同一升级一次、60s 同类异常合并「共 N 次」；注入时钟覆盖 9999/10001ms 边界 | `notify-trigger` 按间隔触发 |
| 通知 | AC-07 | 通知不可用：只提示一次「通知不可用 · 队列仍可用」，3 条 `delivered=false` 不阻断 | `--no-notify` + 3 个不同升级 |
| 队列 | AC-08 | 队列合并、排序（升级前 → 编号升序 → 实例号升序）、新行 2 秒、空态；审批行同八字段；无筛选 / 搜索 / 自定义列 | 3 实例手写 state.json；`APR-009`（nodeId=null）独立项目根降级断言 |
| 队列 | AC-09 | 「继续」：终态节点 → 实例已完成；非终态节点 → 运行中且下游唤醒（D-39） | `INST-001` single / `INST-002` 对照 / `INST-003` code-loop |
| 队列 | AC-10 | 「重派」：轮次 +1、绑会话、回运行中 | 同 AC-09 点重派 |
| 队列 | AC-11 | 「终止」：二次确认后实例已取消；先取消不改状态 | 确认框两次点按 |
| 队列 | AC-12 | 审批「允许」/「拒绝」2 秒生效 | `POST /__test__/approvals` × 2 |
| 队列 | AC-13 | 跨实例分别处置互不影响；三处数字序列 `[[2,1,1,1],[1,0,0,1],[0,0,0,0]]` | 1 升级 + 1 审批分属两实例 |
| 队列 | AC-14 | 处理后续跑：条目消失后 5 秒内实例自动续跑，三处计数同步（规划验收句第 2 句收尾） | `single` + mock 失败 + 重派 |
| 队列 | AC-15 | 已被别处处理：提示「已处理（{结论}），无需再次处理」，不二次写入 | 先 CLI `resolve --decision retry` 再面板点「继续」 |
| 队列 | AC-16 | 三条异常文案逐字 + 状态词不变 + 动作恰 5 种、无 fail / round / timeout / concurrency 入口 | 错配 / 已恢复 / 会话已结束 |
| 队列 | AC-17 | 队列与 CLI 同源：条目集合与字段值一致；CLI 行按两空格拆 5 段、桌面行按 ` · ` 拆 7 段（D-37）；审批行只比 `{编号, 状态词, 动作}` | harness 导出与 CLI 间隔 < 1s |
| 队列 | AC-18 | 三处数字一致 + `pendingEscalations` 计数口径（界面 / 壳层零计算，daemon 只许 `shapeSnapshot` 内，D-36） | 4 条目（2 升级 + 2 审批）；内嵌 Node 切块脚本 |
| 资产 | AC-19 | 三分页列表 + 计数行自洽（total = 内置 + 项目）；缺失技能的资产标「不通过」 | 2 项目角色（其一 `skills: [not-exist]`） |
| 资产 | AC-20 | 角色详情：契约要点 + 缺失标「缺失」+ 校验原因与 CLI 原文相同 | 分组 / 产物 code / 副作用 high / 并发 2 |
| 资产 | AC-21 | 技能列表与详情；正文摘要 ≤ 20 行（`BODY_PREVIEW_LINES = 20` 常量在 src/daemon） | 40 行正文的项目技能 |
| 资产 | AC-22 | 工作流列表与详情：`release-flow` 7 节点 / 8 条边 / 回流 2（与 A-5 / A-7 / AC-29 同一份定义） | `release-flow.yaml` + `sub-flow.yaml` + 内置角色 id |
| 资产 | AC-23 | 校验不通过的资产照常可浏览并给原因（CLI validate 原文） | 3 个坏资产 |
| 资产 | AC-24 | 目录不可读「资产不可读 · {目录}」与引用缺失「缺失」两条降级 | `chmod 000 .orch/roles`（取证后恢复） |
| 资产 | AC-25 | 库浏览只读：哈希不变、无写按钮、`writes=0`；`/assets/` 路由 ≥ 6 且无 POST/PUT/DELETE | 全文件哈希 + 1 运行中实例 |
| 占用 | AC-26 | 全局角色占用跨实例聚合：开发 2 实例 3 会话未折叠；审核者 3 节点折叠「等 3 个」（规划验收句第 3 句） | 2 实例手写 state.json（roleId 用内置 id，hostId `mock`） |
| 占用 | AC-27 | 空态「角色占用 无」；干净实例全部「未参与」；损坏实例「1 个实例状态不可读，已跳过」；无 release / kick 动作 | 空 / 干净 / 损坏三现场 |
| 占用 | AC-28 | 占用 2 秒内随运行时更新且与流程图同源；夹具**禁用** `graph/pulse`（D-40） | 手写 state + `test.dispatch` 真实派发 |
| 画布 | AC-29 | 定义态角色图：7 节点 8 边、回流弧线、层号映射、两次打开坐标 deepEqual；`partial-flow` 部分可解析**不**显示「定义不可读」 | `release-flow` + `partial-flow`（`node_type: mystery`） |
| 画布 | AC-30 | 画布只读：拖动不保存、点击只选中、无下钻；views/ 哈希不变 | 缩放 / 平移 / 拖 / 点 / 双击 |
| 画布 | AC-31 | 三现场降级：整体不可解析 / 文件不存在 / 悬空边校验失败 | `{{{{` / 删文件 / 悬空边 |
| 证据 | AC-32 | 五项按最近一次展示并标注轮次；不出现第 1 轮内容 | 两轮尝试的 `T-003` |
| 证据 | AC-33 | 缺项「未提供」×5；引用不可读单项标注 | 未执行 / 产物不存在 / 日志不可读 |
| 证据 | AC-34 | 不展示日志正文与会话文本；单次渲染 ≤ 64 KB；无 export / preview / openLog 入口 | 5000 行日志 |
| 托盘 | AC-35 | 信息行「实例 N · 待处理升级 M」2 秒更新；断开置「—」；菜单恰 4 项、无逐实例条目 | 3 实例 + 新增实例与升级 + `core stop` |
| 托盘 | AC-36 | 暂停 / 继续：2 暂停 1 跳过逐字提示；菜单项文本切换 | 3 运行中实例（其一 state.json 损坏）+ `ctl/tray-pause` |
| 托盘 | AC-37 | 暂停不产生新通知；退出确认句与 I1.10a 逐字一致；`core.stop` 只在 `fn quit` 内 | `ctl/tray-pause` + `tray-quit` + `tray-quit-confirm` |
| 规划验收 | AC-38 | 888 行三句端到端：通知 → 点入队列 → 看证据 → 重派 → 续跑 → 占用行 | `single` + code-loop 实例组合 |
| 安全 | AC-39 | 只读与本地性：写操作数 = 2、状态写入 = 3、其余 0；prefs 四键单独计数；监听仅 127.0.0.1 | 路由表 method/pattern 断言（基线 3 行） |
| 非功能 | AC-40 | 零依赖 / 无打包器 / 中文唯一来源（CJK 分层）/ 31 词纯净 | 仓库静态检查 |
| 非功能 | AC-41 | 无回归：CLI / HTTP 逐字快照、`USAGE_LINES === 25`、全量差集 0 + `tests >= 1425`（复用 `scripts/desktop/gate.mjs` 口径，D-21） | `test/wp14/regression.test.js` |
| 异常 | AC-42 | 七种异常提示逐字、不白屏、不丢内容 | 七份独立现场 |
| 范围 | AC-43 | 不依赖 I1.10b：点击只展开；`git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown` = 0 | 单一项目根 |
| 队列 | AC-44 | 「继续」仅轮次超限可用：置灰 + 悬停文案 + 强点不生效 | `execution_failed` vs `rounds_exceeded` |
| 画布 | AC-45 | 空定义（`nodes: []` 与 0 字节文件）都显示「定义 空」 | `empty-flow` + `blank-flow` |
| 资产 | AC-46 | 单个资产不可解析：仅该行「角色 broken-role · 不可读」，计数仍含它 | 3 角色文件（其一 `{{{{`） |
| 队列 | AC-47 | 断线保留 2 行并标注、托盘置「—」；恢复 2 秒补齐 3 行 | `core stop` + 离线写 `ESC-002` + 重启 |
| 托盘 | AC-48 | 无运行中实例点暂停：置灰 +「没有可暂停的实例」，不变「继续」 | 已完成 single 实例 |
| 通知 | AC-49 | 点击通知时条目已被处理：仍停队列 +「已处理（重新分配）…」，不二次裁决 | 先 CLI 处置再 `ctl/notify-open` |

## 3. BR / NF 契约清单

### 3.1 BR（37 条，按域分组一句话）

- **通知（BR-01~05）**：三类事件 ≤2 秒触达且不改编排状态（01）；点击定位 + 已处理提示（02）；总 / 分项开关按本机记住、入口在队列页顶部（03）；10s / 60s 去重合并（04）；通知不可用只提示一次、不阻断不重试（05）。
- **队列（BR-06~12）**：跨实例合并待处理项、八字段同构（06）；固定排序 + 空态（07）；五动作与类型严格匹配，「继续」仅轮次超限，终态 → 已完成 / 非终态 → 运行中（08）；已处理 / 未挂起 / 会话失效 / 错配四种固定提示不改原状态（09）；最后一条处理完 5 秒内自动续跑（10）；终止二次确认带实例号（11）；三处数字同源同步、审批减少不影响托盘升级数（12）。
- **只读与呈现（BR-13~21）**：浏览 / 占用 / 画布 / 证据 / 托盘信息行全部只读（13）；三类库列表给来源 + 校验状态，工作流无分组列（14）；详情给契约要点与引用，缺失标「缺失」（15）；占用按角色聚合、全局 = 本机 + 本项目根（16）；只列有运行时记录的角色 + 「未参与」不冒充「不可用」（17）；画布定义态只读、无运行时字段（18）；画布降级按「有没有可解析输入」分工（19）；证据五项 + 最近一次 + 缺项「未提供」（20）；引用不可读单项标注、不展示正文（21）。
- **托盘（BR-22~24）**：信息行 2 秒更新、断开置「—」（22）；暂停逐实例、菜单项变「继续」、无可暂停提示（23）；退出语义与 I1.10a 完全一致（24）。
- **安全与一致性（BR-25~31）**：面板写操作只有三类——五种处置（一次一条）、托盘暂停 / 继续、prefs 四键通知开关（25）；中文唯一来源分层（26）；状态词沿用基线不自造（27）；零第三方依赖、零打包器（28）；全部数据走本机回环（29）；不假设 I1.10b 存在（30）；既有 CLI / HTTP 逐字不变（31）。
- **异常与时效（BR-32~37）**：五处失败路径中文提示、界面保持可用（32）；通知正文固定五段段序（33）；动作点击 2 秒内反馈（34）；暂停期间不产生新完成 / 异常通知（35）；断线保留旧内容并标注、不冒充最新、恢复自动补全（36）；队列新行与占用刷新 2 秒时效、无需手动刷新（37，v6 新增）。

### 3.2 NF（8 条，含阈值）

| NF | 阈值 / 口径 |
|---|---|
| NF-1 通知及时性 | 事件 → 通知 ≤ 2 秒；同一升级 10s 不重复；同类异常 60s 合并 |
| NF-2 处置反馈 | 点击 → 结果或「处理中」≤ 2 秒；最后一条处理完 → 实例续跑 ≤ 5 秒 |
| NF-3 数字与新鲜度 | 三处数字 2 秒内一致；队列新行与占用刷新 ≤ 2 秒（BR-37） |
| NF-4 首屏速度 | 50 资产 + 20 待处理条目下，任一资产分页 / 证据视图 ≤ 1 秒首屏 |
| NF-5 稳定性 | 连续 20 次处置 + 30 次切换不崩；暂停 / 继续各 10 次后仍可推进 |
| NF-6 无回归与零依赖 | 三主链逐字不变；`dependencies` = `{}`；全量失败集合差集 0 |
| NF-7 只读与本地性 | 写操作仅五动作 + 托盘暂停 / 继续 + prefs 通知开关；仅回环监听 |
| NF-8 中文唯一来源 | 新增中文全落 `src/cli/labels.js`；`desktop/ui` / `desktop/harness` 零中文；壳层仅 `config.rs` baked-in |

## 4. 附录 A / D 索引

### 4.1 附录 A（输出基线）与 AC 引用

| 小节 | 内容 | 被哪些 AC 逐字引用 |
|---|---|---|
| A-0 | 可变值约定 + 样例值声明（`T-001 执行者` / `第 1 轮` 是 single 实际值；`T-003 开发` / `第 2 轮` 只是示例值，D-38） | 全部 |
| A-1 | 三类通知标题 + 五段正文 + 合并形态 | AC-01, 02, 03, 06, 38 |
| A-2 | 通知开关组、`通知不可用 · 队列仍可用`、`已处理（{结论}），无需再次处理` | AC-05, 07, 15, 42, 49 |
| A-3 | 队列行（7 段）、空态、`已断开 · 正在重连…`、`实例 {id} · 状态不可读` | AC-04, 08, 17, 18, 38, 42, 47, 49 |
| A-4 | 五按钮、终止确认句、结果行 | AC-09~13, 38, 44 |
| A-5 | 队列异常三条 + 资产行 / 计数行 / 详情块（`release-flow` 唯一份） | AC-13, 16, 19~24, 42, 46 |
| A-6 | 占用行、空态、跳过提示 | AC-26, 27, 28, 38 |
| A-7 | 画布标题、`校验不通过`、两条降级文案 | AC-29, 31, 42, 45 |
| A-8 | 证据五项行、`完整日志留在宿主` | AC-32, 33, 34, 42 |
| A-9 | 托盘菜单、断开信息行、暂停提示 | AC-35, 36, 37, 42, 47, 48 |
| A-10 / A-11 | 小节 ↔ AC 映射表；文案键与归属（`DESKTOP_*` 全落 `labels.js`，审批行用自有模板 `DESKTOP_QUEUE_ROW_APR`） | 逐字断言的键来源 |

### 4.2 附录 D（实现约束）D-1 ~ D-13 一句话

- **D-1**：新增只读接口 9 条（`/queue`、`/queue/stream`、`/assets/*` 6 条、`/occupancy/roles`、`/workflows/:id/canvas`、`/evidence/*` 2 条、`/notifications/stream`）；写接口只允许 5 条（escalations/decisions、approvals/decisions、`/instances/:id/cancel`、`/control/pause`、`/control/resume`），必须经 CAS 路径。
- **D-2**：通知检测点只落在守护进程对既有事件总线的订阅；去重键 `escalationId`(10s) / `(instanceId, kind)`(60s) / `instanceId`(完成一次)；窗口必须可注入时钟。
- **D-3**：队列投影只读 `state.escalations/approvals` 的 `pending`；动作映射 继续→`pass`（仅 `rounds_exceeded`）/ 重派→`retry` / 终止→实例取消 / 允许→`allow` / 拒绝→`deny`，**不暴露 `fail`**；错误码映射固定。
- **D-4**：资产投影复用注册表与校验输出，不重跑 schema、不复制 CLI 渲染；只读。
- **D-5**：占用聚合 = 遍历本机实例 × `buildRoleInstances` × 按 `roleId` 合并；注册表为空不判 `unavailable`；不落盘。
- **D-6**：画布投影 `{nodes, edges, title}`；布局复用 `computeLayout`；`readable` / `valid` 正交三态（无可解析输入按 `readable=true` + 零节点，I-01 已闭合）。
- **D-7**：证据 = `artifactRefs` + 最近一次 `execution.summary` + 节点 `round`；只 `stat` 不 `readFile`；缺项 `null` → 「未提供」。
- **D-8**：托盘信息行由守护进程投影下发、壳层只渲染；暂停逐实例、收集成功 / 跳过；退出路径原样。
- **D-9**：探针事件 9 种；`--ctl` 分发只新增 4 动作（notify-open / tray-pause / tray-resume / queue-open）；**`tray-quit-confirm` 不得移入分发器**（`tray.rs:194` 的 `wait_ctl_file` 单独消费）。
- **D-10**：服务端测试接缝 `NODE_ENV=test` 才注册（`/__test__/escalations|approvals|notify-trigger`）；既有 `graph/pulse` 语义不改。
- **D-11**：授权修改清单点名到文件与段落；**不得修改** `src/core/**`、`src/cli/main.js`、`src/cli/render.js`、`src/persistence/**`、`src/templates/**`、`src/registry/**`；新增文件清单 7 个 daemon 模块 + 6 个 ui 目录 + 5 个 harness dump + `test/wp14/**`。
- **D-12**：授权断言修改清单 = **无**（追加文案键不算改断言）。
- **D-13**：编号形态 AC-01~49 / BR-01~37 / NF-1~8 连续；机械取号 `grep -cE '^\*\*AC-'` 等。

## 5. 关键裁决摘要（实现方必须知道的口径，15 条）

1. **D-01（与直觉相反）**：批量处置已删除——不存在多选、批量接口、批量确认句；`grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/` 必须零命中（AC-13）。
2. **D-07**：「全局角色占用」= 本机当前守护进程所辖 + 本项目根下全部实例按 `roleId` 聚合；没有跨项目索引，注册表只补中文名不充数。
3. **D-08（与直觉相反）**：「终止」= 实例级取消（等价 `orch cancel`），不是把节点标失败；节点级「判失败」**不作为面板动作**（不暴露 `fail`）。
4. **D-09**：托盘数字用**只读菜单项文本**承载（`实例 N · 待处理升级 M`），不做图标角标、不改窗口标题——为了可被探针逐字断言。
5. **D-10**：队列只列待处理，无「显示已处理」开关；历史归事件日志与 CLI `--all`。
6. **D-13 / D-32**：「已处理」提示用**新键** `DESKTOP_QUEUE_ALREADY_RESOLVED`（逐字 `已处理（{结论}），无需再次处理`，**不带** `升级 {id}` 前缀——跨实例编号会重号）；结论词表**不含「已终止」**，终止类结论统一用 `已取消`；既有 CLI 模板不改。
7. **D-17 / D-23**：画布降级分工按「有没有可解析输入」：文件不存在 / 无读权限 / 内容为空 / 解析成功零节点 → 「定义 空」；文件在但不可解析 → 「定义不可读 · 仅显示可解析部分」；校验失败但可解析 → 照常画 + 标「校验不通过」。部分可解析（`readable=false && nodes>0`）**不**显示「定义不可读」（B-1 三态）。
8. **D-19**：审批行的「第 N 轮」由 `nodeId` 反查 `state.nodes[].round`（`approvals[]` 既有字段没有轮次，不许新增字段）；无 `nodeId` 时渲染 `节点 — · 第 — 轮`，段数仍 7。
9. **D-21（与直觉相反）**：门禁判据**禁写 `fail === 0`**——基线本身有 4 条已裁决失败（历史 8 条 + R-08 的 AC-04）；判据 = 失败集合与判定基线差集 0 + `tests >= 1425`（下限、不写死总数）。
10. **D-22 / D-37**：AC-17 两侧行**各按本侧分隔符拆**——CLI 升级行按两个空格（`\s{2,}`）拆 5 段、桌面行按 ` · ` 拆 7 段；审批行只比 `{编号, 状态词, 动作}`，**禁止「审批行字符串相等」断言**。
11. **D-24 / D-35 / D-36（与直觉相反）**：`pendingEscalations` 全仓共 **3 处计数**（core `orchestrator.js:4180`、persistence `instance-store.js:482–485`、daemon `shapeSnapshot` 回退 `server.js:905`）+ daemon 5 行命中。断言只锁「`desktop/ui` 与 `desktop/src-tauri/src` 零计算 + daemon 计数只许在 `shapeSnapshot` 内」；**单行 grep 判零计数已被禁用**（`905` 是跨行表达式，行级假阴性），必须用 `-A3` 多行检查或 AC-18 内嵌的函数体切块脚本；**不许**为凑「一处」改 `shapeSnapshot` 或 core / persistence。
12. **D-38**：A-0/A-1 里的 `T-003 开发`、`第 2 轮` 是**示例值**；AC-01/02/03/38 的实际现场是 `single` 模板 → `T-001` / 角色 `worker`（中文名「执行者」）/ 第 1 轮。需要「第 2 轮」只能用 `code-loop` 先回流 / 超限一次。
13. **D-39（与直觉相反）**：「继续」（判通过）后的实例状态**不是一律运行中**：终态节点 → 实例「已完成」；非终态节点 → 保持「运行中」且下游被唤醒（与 `orchestrator.js` 的 `pass && terminal ? 'completed' : 'running'` 一致）。
14. **D-40（与直觉相反）**：占用视图数据必须来自真实 `state.json`——**禁用 `POST /__test__/graph/pulse` 造占用**（pulse 只写 `overlayByInstance` 贴图投影，不写 state，占用投影读不到）；改用 `test.dispatch` 真实派发。
15. **D-42**：`prefs.json` 的唯一写入方 = 新增 `src/daemon/prefs.js`，只读写四个开关键（总开关 + 三类分项）、原子写入；写其它键即判失败（AC-39）；界面层不直接碰盘。

## 6. 未决问题与假设

继承需求附录 B-2 共 13 条，**v7 状态：无一阻塞开工**：

- **已裁决闭环**：U-3（D-07 全局口径）、U-6（D-08 终止语义）、U-8（D-09 托盘菜单项）、U-10（D-03/`prefs.json` 只存通知开关，「上次所在视图」已删）、U-11（D-10 队列只列待处理）。
- **已定口径、不阻塞**：U-4（暂停 = 既有 `workflow pause`，菜单项逆操作「继续」）、U-5（「继续」仅轮次超限可用）、U-12（暂停期间不产生新通知是推论非抑制逻辑）、U-13（无头 / CI 只判探针意图 + 投递结果，弹窗为人工核验项）、U-7（10s/60s 窗口常量集中配置，改数值只影响注入时钟断言）。
- **接口约定、不阻塞**：U-1（I1.10b 差异 = 0，本迭代不假设其存在；将来从队列跳节点详情属 I1.10b 侧新增）、U-2（IM 通知留后续）、U-9（证据独立视图与将来 I1.10b 节点详情的两入口并存，届时以后者为主）。

结论：**S0 评审第 4 轮已 PASS（0 阻断 / 6 建议 I-01~I-06，v7 已全部闭合），无未决阻塞项，可直接进入 S1 拆分。**

## 7. Given 可构造性核查

### 7.0 通用前置（每个 AC 都一样）

```bash
export MAESTRO_REPO=/Users/xuesh/www/Maestro
mkdir /tmp/maestro-i11-<场景> && cd /tmp/maestro-i11-<场景>
mkdir -p .orch/hosts
cat > .orch/hosts/mock.json <<'EOF'          # mock 宿主指向仓库内夹具（已核实存在）
{ "kind": "mock", "launch": { "command": "node",
  "args": ["$MAESTRO_REPO/test/fixtures/mock-acp-agent.js"] } }
EOF
# 快照夹具顺序（§3.3，必须照做）：核心启动会把上一代 created/running 判为已中断，
# 所以必须【先在空目录拉起核心】→ 再写 state.json/events.jsonl/资产 → 最后开界面：
node "$MAESTRO_REPO/bin/orch.js" instance status INST-001   # 返回"不存在"即核心就绪
# 之后写盘的 state.json 统一带 schemaVersion: 2
```

界面 / harness 取数：读 `.orch/desktop.json` 的 `{port, token}`（已核实由守护进程原子写入、退出即删），请求头 `Authorization: Bearer <token>`。等待一律「条件成立即继续」轮询（100ms / 上限 30s），禁固定 sleep 判定。

### 7.1 测试接缝清单（全部实跑核对，见 §8）

- **核心 RPC（`NODE_ENV=test` 才注册，`src/daemon/server.js:337` 守卫）**：`test.dispatch`（→ `dispatchToNode`，真实写 state）、`test.escalate`（→ `escalateOnce`，支持 `reasonCode` / `artifactRefs`；节点不存在返回 `UNKNOWN_STATE`）、`test.handoff`、`test.delivery`（+ `test.delivery.whenHeld`）。
- **服务端 HTTP**：既有 `POST /__test__/graph/pulse`（只写 overlay，**禁用于占用**）与 `POST /__test__/window-probe`；S2 新建（`NODE_ENV=test`）：`POST /__test__/escalations`（内部调 `test.escalate`）、`POST /__test__/approvals`、`POST /__test__/notify-trigger`（只推意图不改状态）。
- **壳层**：`--probe <file>`（JSON Lines 追加）、`--ctl <dir>`（既有动作 `close-window` / `tray-open` / `tray-quit` / `tray-quit-confirm`（单独通道，不动）/ `open-instance/<id>`；本迭代新增 `notify-open` / `tray-pause` / `tray-resume` / `queue-open`，需同步改 `probe.rs` 分发表与 `tray.rs::handle_ctl` 两处）、`--no-notify`（新增，强制投递失败）、`--project`（既有，`main.rs:49`）。

### 7.2 通知域（AC-01~07、49）——模板一律 `single`（D-38）

```bash
cd /tmp/maestro-i11-notify
NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --host mock \
  --task "写一份说明"          # → INST-001，唯一节点 T-001（终态）、worker/执行者、第 1 轮
# 壳层启动带：--probe /tmp/probe.jsonl --ctl /tmp/ctl --no-notify(仅 AC-07/42 用)
# When（升级）：NODE_ENV=test 下 POST /__test__/escalations
#   {"instanceId":"INST-001","nodeId":"T-001","reasonCode":"execution_failed"}
#   ——内部走 test.escalate，必须用真实存在的节点（UNKNOWN_STATE 兜底，已核实）
# When（完成）：等实例自然跑完（轮询 orch instance status ≤ 30s）
# When（异常）：node "$MAESTRO_REPO/bin/orch.js" core stop → 重启守护进程 → 等"已中断"
# When（开关）：POST /__test__/notify-trigger 只推意图；prefs 重启用 --project 再启动
# When（点击）：mkdir /tmp/maestro-i11-notify/ctl/notify-open
# 判定：探针 notify/notify-delivered/nav 事件 + 时延断言；CI 允许 delivered=false
```

### 7.3 队列域（AC-08~18、44、47）——`single` 为主，第 2 轮才用 `code-loop`

```bash
cd /tmp/maestro-i11-queue && 先拉核心（见 7.0）
# 三实例现场（AC-08）：先起核，再分别写三份 state.json（schemaVersion:2），
#   内嵌 escalations[]/approvals[] 的 pending 记录（字段名对齐 src/core/approvals.js 的
#   buildApproval：approvalId/instanceId/nodeId/sessionId/action/state/createdAt）。
# 升级 / 审批也可经接缝造（需实例真实存在）：
#   POST /__test__/escalations {"instanceId":"INST-001","nodeId":"T-001","reasonCode":"rounds_exceeded"}
#   POST /__test__/approvals   {"instanceId":"INST-002","action":"write", ...}
#   降级行 APR-009：nodeId:null（buildApproval 默认即 null，已核实）→ 独立项目根，不入 3 行队列
# 处置：harness 调用与按钮相同的动作入口（等价 orch escalate resolve|orch approve）
# AC-09 双现场：INST-001 = single（T-001 终态 → 判通过后实例已完成）；
#              INST-003 = code-loop（T-001 developer 非终态 → 判通过后运行中 + T-002 tester 被唤醒）
# AC-47：core stop → 离线期在 INST-003 的 state.json 写 ESC-002 → 重启 → 2 秒补齐 3 行
```

### 7.4 资产域（AC-19~25、46）——纯写文件，无需实例

```bash
cd /tmp/maestro-i11-assets && 先拉核心（见 7.0）
mkdir -p .orch/roles .orch/skills/<id> .orch/workflows
# 角色：.orch/roles/*.yaml 写 2 个项目角色，其一 skills: [not-exist] → 校验不通过
# 技能：.orch/skills/<id>/SKILL.md 正文 40 行 → 正文摘要 ≤ 20 行（BODY_PREVIEW_LINES=20）
# 工作流：release-flow.yaml（7 节点 / 8 边）+ sub-flow.yaml（S-001 引用，必须真实存在，
#   否则 WORKFLOW_SUB_UNKNOWN）；5 个角色节点的 role 取注册表内置 id
#   developer/tester/reviewer/code-reviewer/writer（否则 WORKFLOW_ROLE_UNKNOWN）
# 校验原文对照：node "$MAESTRO_REPO/bin/orch.js" role|skill|workflow validate ...
# 目录级降级：chmod 000 .orch/roles（取证后必须恢复）；单文件级：坏 yaml 写 {{{{
```

### 7.5 占用域（AC-26~28）——手写 state + `test.dispatch`，**禁 pulse**

```bash
cd /tmp/maestro-i11-occupy && 先拉核心（见 7.0）
# 写两份 instances/INST-00x/state/state.json（schemaVersion:2）：
#   template: code-loop；nodes[].roleId 直接写 developer/reviewer/tester（内置 id）；
#   sessions[].hostId 写 "mock"；节点 / 会话数量按 AC-26 的占用数字。
# 注意：code-loop 声明的 coordinator 会作为「未参与」行出现，属预期（AC-26 只断言三行）。
# When（AC-28 动态变化）：经既有 test.dispatch 真实派发（真实写 state.json）：
#   NODE_ENV=test 下调用 methods['test.dispatch'] {"instanceId":"INST-001","nodeId":"T-001"}
#   → orchestrator.dispatchToNode → dispatchInState；T-001 完成后下游 T-002 自动派发
# 禁止：POST /__test__/graph/pulse（只写 overlayByInstance 贴图投影，D-40）
```

### 7.6 画布域（AC-29~31、45）——纯定义文件

```bash
cd /tmp/maestro-i11-canvas && 先拉核心（见 7.0）
# release-flow.yaml：T-001~T-005（角色）+ H-001（人工）+ S-001（subworkflow，workflow: sub-flow）；
#   正向 6 条 + 回流 2 条（kind: backflow）= 8 边（与 A-5/A-7/AC-22 同一份，D-31）
# partial-flow.yaml：4 节点，其一 node_type: mystery（未知类型 → valid=false，可解析部分照画）
# 现场一（AC-31）：写 {{{{  → 「定义不可读 · 仅显示可解析部分」
# 现场二：删文件或 chmod 000 → 「定义 空」
# 现场三：悬空边 → 照画 + 「校验不通过」
# AC-45：empty-flow.yaml 写 nodes: [] / edges: []；blank-flow.yaml 0 字节 → 都显示「定义 空」
# 判定：desktop/harness/canvas-dump.mjs 导出坐标 / 层号，两次打开 deepEqual
```

### 7.7 证据域（AC-32~34）——state.json + events.jsonl

```bash
cd /tmp/maestro-i11-evidence && 先拉核心（见 7.0）
# state.json：节点 T-003 带 artifactRefs（含 verifiedAt）；events.jsonl 按时间序追加该节点
#   两轮 execution.summary 事件（command/exitCode/keyOutputLines/logRef，第 2 轮在后）
# AC-33：三节点 = 从未执行 / 产物路径不存在（/tmp/.../nope.js）/ 日志引用不可读
# AC-34：日志文件造 5000 行 + 一条含对话文本的会话事件 → 断言正文零泄露、≤ 65536 字节
```

### 7.8 托盘域（AC-35~37、48）

```bash
cd /tmp/maestro-i11-tray
# 起实例：orch run --cwd . --template single --host mock；壳层带 --probe/--ctl
# 暂停/继续/退出：mkdir ctl/tray-pause、ctl/tray-resume、ctl/tray-quit（确认等 ctl/tray-quit-confirm）
# AC-36：3 个运行中实例，其一写非法 state.json → 「2 个实例已暂停，1 个已跳过」
# AC-48：只留一个已完成 single 实例 → pauseItem.enabled === false
# 断开（AC-35/47）：node "$MAESTRO_REPO/bin/orch.js" core stop → 信息行「实例 — · 待处理升级 —」
```

### 7.9 E2E / 横切（AC-38~43、49）

AC-38 串联 7.2（通知）→ 队列行展开与证据（7.7 现场）→ 重派 → 续跑 → 占用（7.5 现场），一次跑完三段；AC-39 走「浏览（零写入）→ 一次允许 + 一个暂停/继续周期」并断言路由表 method/pattern；AC-40/41 是仓库根静态检查与全量回归（见 §8）；AC-43 断言 `git rev-list --count 66e5a6b..origin/feat/i1.10b-drilldown` = 0；AC-49 = 7.2 现场先 `orch escalate resolve ESC-001 --decision retry` 再 `ctl/notify-open`。

**模板选择速查（D-38 / D-39）**：AC-01/02/03/38 用 `single`（T-001 终态、第 1 轮可构造）；AC-09 终态现场用 `single`、非终态现场用 `code-loop`；一切需要「第 2 轮」的现场只能 `code-loop`（先回流 / 超限一次）。`task-loop` 不在本迭代任何夹具中使用。

## 8. 与上一迭代的契约差异与回归红线

I1.10a 收口基线（`66e5a6b`，实测 HEAD `b23303a` 与基线的 src/、test/ 无差异）上，本迭代新增文件将触碰的**既有精确断言**，全部逐条实跑核对：

| 红线 | 基线实测（本机实跑） | 实现后要求 |
|---|---|---|
| `single` 逐字红线 | 三主链 / `escalate|approve|role|skill|workflow|status|instance` 输出快照不变；`USAGE_LINES === 25`（实跑 25） | 逐字不变；D-12 授权断言修改清单 = **无** |
| purity 词表 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` exit 0（实跑通过，30 文件零命中）；`desktop/ui` 同命令须 exit 0 | 新增 daemon 文件自动进入扫描，零命中保持 |
| USAGE_LINES 25 | `labels.js` 实跑 25 | 只在文件末尾**追加** `DESKTOP_*` 键，不改既有键与 `USAGE_LINES` |
| gate.mjs 门禁口径 | `scripts/desktop/gate.mjs` 存在：TAP 解析 + 判定基线 9 条差集 0 + 条数下限 + 文件级 flake 确认；⚠️ 其 `BASELINE_TESTS = 1157`（见下方冲突 1） | 判据复用其**口径**：差集 0 + `tests >= 1425`，**禁 `fail === 0`**（D-21） |
| CLI 分隔符 | `renderEscalationListRow` 尾部 `[...].join('  ')`（两空格，约 1276 行）；`parts.join(' · ')` 全文 4 处（231/291/565/**1155 = renderApprovalLine**） | CLI 侧不改（D-11 禁改 `render.js`）；桌面行走自有模板 `DESKTOP_QUEUE_ROW_ESC/APR` |
| pendingEscalations 基线 | `src/daemon` 5 行（server.js 897 注释 / 903 / 904 / 910 + routes.js:156）；`shapeSnapshot` 函数体 **900–912**（v7 已把 I-06 的 901–912 改对）；全仓 3 处计数（core 4180 / persistence 482–485 / daemon 905 回退）；`desktop/ui` + 壳层 0 命中 | 界面与壳层零计算；daemon 新增读接口只复用 `shapeSnapshot` 输出；**禁单行 grep 判零计数**（跨行表达式假阴性，D-36） |
| CJK 分层 | `desktop/ui` + `desktop/harness` CJK 0 文件；壳层中文仅 `config.rs`（7 条默认值；`spawn.rs` 19 行中文注释属既有事实不在禁令内） | 分层口径保持（BR-26 / AC-40 三条扫描） |
| 依赖零新增 | `package.json` dependencies 实跑 `0`；无打包器关键词、无裸 import | 恒 `{}`；只许 Cargo 侧加通知依赖（D-11），`package.json` 不得变 |
| 桌面四视图 setView | `desktop/ui/app.js:433` `setView(view)` 现仅接受 `graph` / `board` / `instances`（+ `project` 阻断态） | **授权范围**（D-11）：只新增 `queue` / `assets` / `occupancy` / `canvas` / `evidence` 五个视图键 + `queue` 顶部通知设置区；既有四视图行为不改；通知开关**不新增**独立设置视图键、不新增菜单项 |
| ctl 接缝现状 | `probe.rs:126` 分发 `["close-window","tray-open","tray-quit"]` + `open-instance/` 子目录；`tray.rs:194` `wait_ctl_file("tray-quit-confirm", 30_000)` 单独消费；`fn quit`（159）内 `core.stop`（163） | 只新增 4 动作且两处同步；`tray-quit-confirm` 通道不动；退出路径不改 |
| 既有 HTTP 面 | 路由表实跑 3 行（`GET /instances` / `POST /instances` / `GET /workflows`）；`server.js` 的 `'POST' && pathname ===` 4 行（pulse × 2 + window-probe × 2）；`/assets/` 合计 0 | 只做加法；新增 POST 字面量只落 D-1 名单；测试接缝一律 `/__test__/` 前缀 |
| 既有测试文件 | 不得修改：`git diff --name-only 66e5a6b -- test/` 只允许 `test/wp14/` | 全量 `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1`，差集 0 + `tests >= 1425`（基线实测 1425 / 1420 / 4 / 1） |

### 需求与代码现状的冲突 / 注意点（不改需求，建议 S1 裁决）

1. **gate.mjs 的条数下限常量是旧值**：`scripts/desktop/gate.mjs:18` 写死 `BASELINE_TESTS = 1157`（I1.10a 时代的下限），而本迭代 AC-41 / §3.3 要求 `tests >= 1425`。需求只说「复用该口径」（四件套同形），未说复用该脚本文件本身；且 `scripts/` 不在 D-11 授权修改清单内。**建议 S1 裁决**：由 `test/wp14/regression.test.js` 自行断言 `tests >= 1425`（推荐，不动既有文件），或显式授权把 gate.mjs 的常量更新为 1425。
2. **AC-26 括注行号轻微偏差（不影响判定）**：需求引 `src/registry/role-instances.js:131–138` 描述「定义声明 ∪ 节点绑定」，实测该合并逻辑（含 C-04 注释）在约 130–141 行，区间端点略有出入；语义锚点存在、`buildRoleInstances` 可用，无需改需求。
3. 其余全部锚点与需求所写**逐项一致**（含 v7 修正后的 `shapeSnapshot` 900–912、CLI 分隔符两处括注、路由表 3 行、`'POST' && pathname` 4 行、`/assets/` 基线 0、`--no-notify` 基线不存在属新增、`rev-list --count` = 0、`single`/`code-loop` 模板结构、`pass && terminal` 落定、`buildApproval` 默认 `nodeId: null`、mock 宿主夹具文件存在）。
