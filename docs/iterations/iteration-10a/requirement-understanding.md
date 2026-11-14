# I1.10a 需求理解纪要（基于 requirement.md v2）

- 理解对象：`docs/iterations/iteration-10a/requirement.md`（v2，1249 行，37 AC / 32 BR）
- 评审依据：`review-round2.md`（总判 PASS，阻断 0，建议 F-15~F-19）+ `decisions.md`（裁决 A~D + 环境事实更正）
- 本纪要只整理与核查，不改需求正文；编号一律与源文件一致。
- 适用读者：S1 拆分 Agent。§5（Given 可构造性核查）可直接作为夹具设计输入。

---

## 1. 范围（In / Out）

### 1.1 In（本迭代交付）

1. **桌面应用壳与托盘**：Tauri 优先的可双击启动应用（产物 `desktop/src-tauri/target/release/bundle/macos/Maestro.app`，二进制 `Contents/MacOS/maestro`）；主窗口；系统托盘常驻；关闭窗口缩到托盘、守护进程继续运行；托盘菜单固定两项「打开主窗口 / 退出」，退出前对运行中实例确认一次；重复双击单实例激活已有窗口；用户机器无需预装 Node / Rust / Python（用户可见结论，实现路径见需求 D-14，不进验收判定）。
2. **全局实例列表**：每行六项固定顺序（实例 ID / 工作流 / 阶段 / 进度 / 待处理数 / 健康度）；按健康度四档「需关注 → 慢 → 正常 → 已结束」分档置顶、同档按最近更新时间倒序；空态「实例 无」、损坏实例行「状态不可读」不阻断其它行；新实例与状态变化 2 秒内自动反映，无刷新按钮；悬停健康度显示 I1.9 八类原因句（无原因只显「健康度 正常」）。
3. **新建实例入口**：面板「选工作流（单节点 / 编码闭环 / 通用任务闭环，默认单节点）→ 填任务说明 → 启动」；成功（「已启动 {id}」+ 2 秒内列表出现）、校验失败（「请选择工作流」「请填写任务说明」、缺产物行显示 ERROR_TEMPLATE 原文）、启动失败（`启动失败 · <既有错误原文>`）三条路径全有中文反馈，面板不关闭、不产生实例（校验/失败时）、不白屏。这是本迭代唯一会新增实例（写状态）的操作。
4. **本机数据通道与实时推送**：只读 HTTP 接口（`GET /instances`、`GET /instances/:id/graph`、`GET /workflows`、`GET /ui/labels`、`GET /ui/*`）+ `POST /instances`（透传 `run.start`）+ 两条 SSE 推送（`GET /instances/stream`、`GET /instances/:id/graph/stream`）；监听 `127.0.0.1:0` 临时端口，凭据原子写 `<root>/.orch/desktop.json`（`{port, token, pid, generation, startedAt}`）、退出即删；无凭据一律 401；只读边界由 AC-27 架构检查兜底。
5. **角色流程图（基础）**，共九块：
   - 角色节点五要素：状态色（可用绿/服务中蓝/冷却中灰/不可用红/未参与灰弱化）、活跃会话数（>1 角标堆叠 `×N`）、服务节点（`, ` 分隔、>2 折叠为「服务 T-001 等 N 个」）、宿主图标（多宿主空格并列）、异常角标（红色感叹号 + 计数）。
   - 三类特殊节点：人工（灰色盾牌）、升级（红色感叹号 + 待处理脉冲）、子工作流（折叠组「子工作流：{name} · N 角色」）；全部参与拓扑、悬空端点 0；未知 `node_type` 按 role 渲染不丢节点。
   - 连接线 7 态视觉编码（A-11 token 表逐项固定）+ 正向/回流分开画 + 回流恒为反向弧线 + 同向并行合并「N 并行交接」+ 聚合优先级 `rejected > expired > pending > delivered > accepted > consumed > not_started` + 未开始默认隐藏可开关。
   - 布局：拓扑层次从左到右、同层并行上下并排、回流不改层次、同一数据两次打开坐标逐字节一致、异常置顶只提 z 不动坐标、图例固定左下角两行。
   - 交互：缩放 50%–200% 夹取、平移、一键复位（100%/回原点/清拖拽偏移）、双击聚焦 2 跳（Esc 或再双击退出）、可见角色 >12 按分组折叠（组节点「分组 {group} · N 角色」可展开收起）、手动拖拽按实例记入 `.orch/desktop/views/<instanceId>.json`。
   - 异常高亮：角标 + 红色脉冲浮最上层，位置/宽/高四项不变、其它节点不挪位、解除立即消失。
   - 节点看板：7 列固定（被阻塞/可调度/执行中/待校验/已完成/失败/已升级）只读；`pending` 按「上游全部 done → 可调度否则被阻塞」派生；已取消折入已完成列「已取消 N」；未知状态落被阻塞并标「状态未知」；切回流程图缩放/平移/拖拽/折叠全保留。
   - 标签策略：默认只显异常标签（已拒绝/已过期/待投递），正常态悬停才显示；`accepted` 悬停标签为「已接受 · 处理中」。
   - 推送节流：角色变化实时（≤500ms）；连接线 1 秒窗口合并（窗口从首变起算、不后延、推最后一次状态）；会话变化只走 `session.indicator` 通道（≤5 帧）、不重绘不重排不推进 `rev`；两类变化互不阻塞都不丢。
6. **只读与本地性**：面板除「新建实例」外不改节点/会话/交接包/升级状态、不追加审计事件；数据通道只绑本机回环。
7. **本机偏好与配置落点**（已登记的新数据布局）：视图偏好 `.orch/desktop/views/<instanceId>.json`；通道端口与凭据 `.orch/desktop.json`（原子写/退出删）；已记住的项目根 `MAESTRO_CONFIG_DIR` 下 `projects.json`。三者只服务界面自身。`instances/<id>/graph.json` **不落盘**（裁决 C 豁免成立）。

### 1.2 Out（范围外 + 归属，逐项核对自需求 §1.3，无出入）

| # | 范围外条目 | 归属 |
|---|---|---|
| 1 | 角色下钻视图、局部 DAG、任务卡片、卡片与 DAG 联动、节点详情、连接线点击展开交接包列表、特殊节点点击跳转人工任务/升级队列、子工作流下钻、一键跳转宿主会话、角色状态栏 | **I1.10b**（index.md 861–874）。本迭代点击角色节点/特殊节点/连接线不跳转不下钻，只做选中与高亮 |
| 2 | 任务卡片上的会话状态指示器（卡片本身） | **I1.10b**。本迭代只落「会话状态变化不触发流程图重排」这半条，并按 `session.indicator` 预留事件类型（BR-19、U-6 已裁决） |
| 3 | 通知（托盘/面板）、人工干预队列界面、角色库/技能库/工作流库浏览、工作流画布、证据浏览独立视图、托盘显示实例数与待处理升级数、托盘「暂停」 | **I1.11**（878–888）。本迭代托盘只有「打开主窗口 / 退出」 |
| 4 | 点击红色/橙色连接线或 escalated 角标 → 跳转升级处理面板（基线能力域 5.2 交互第 6 条） | **I1.11**（881 行）。本迭代连接线与角标只选中高亮，点击不跳转（§2.8/§2.11 同口径） |
| 5 | 可选 Web 入口（`localhost:<port>`）、多宿主视图、远程查看 | **I2.4**（952–960，阶段二） |
| 6 | 把带人工/子工作流节点的工作流真正跑起来（运行时推进 `human`/`escalate`/`subworkflow`、`orch run --workflow` 绑定资产） | 留待后续迭代。本迭代只保证这类实例的**流程图被完整呈现**，实例数据由夹具构造；不阻塞开工（U-4 已裁决） |
| 7 | 真实宿主取证（真实 DSH 上跑桌面应用、真实模型、真实凭据） | **本机保留项**。验收为 B 类（mock 宿主 + 真实 core/daemon，不接真实 DSH） |
| 8 | 多项目窗口 / 项目切换 / 文件夹选择器 | 后续迭代（U-1）。一个窗口对应一个项目根 |
| 9 | 节点看板拖动排序、列内筛选、批量操作 | 后续迭代。本迭代看板只读 |
| 10 | `instances/<id>/graph.json` 落盘快照 | 本迭代不落盘（U-9 → 裁决 C 豁免）；若后续需要，独立迭代处理 |
| 11 | 缩放/拖拽偏好的跨机器同步 | 后续。只在本机、按实例保存 |

---

## 2. AC 清单与分面

> 37 条，编号连续（AC-01~AC-37），每条均有 场景类型/风险/引用 三件套与 机检/夹具/架构检查 三锚点（round2 扫描 2 确认 MISS 空）。分面取该 AC 场景类型的主面；判定锚点列给出机检测试文件（均在 `test/wp13/`）。

| AC | 一句话 | 分面 | 机检锚点 | 架构检查要点 |
|---|---|---|---|---|
| 01 | 双击图标 3 秒内主窗口出现、停实例列表、两行逐字 A-1 | 功能（桌面壳） | desktop-shell.test.js | purity-check 31 词 ×（src/core,src/daemon）exit 0 |
| 02 | 关窗缩托盘 daemon 不停（pid 不变、状态仍推进）；托盘退出确认后才停 | 功能（桌面壳/规划验收） | desktop-shell.test.js | `grep -REn "core[.]stop" desktop/src-tauri/src/` 恰 1 条且在 quit 函数内 |
| 03 | 列表六项齐全、按需关注→慢→正常→已结束分档 | 功能 | instance-list.test.js | 列表只消费 instance.list+get，不重算健康度 |
| 04 | 空态/损坏行「状态不可读」/新实例 2 秒出现（由 instances.changed 触发） | 功能（边界） | instance-list.test.js | 复用 renderInstanceUnreadable 文案不新造 |
| 05 | 新建实例成功路径：已启动 {id}、2 秒入列表、与 CLI 启动逐词同构 | 功能 | new-instance.test.js | 复用 run.start；`grep -Rn startRun desktop/` 零命中 |
| 06 | 新建实例校验与失败三+1 条提示逐字 A-5，面板不关、不产生实例 | 功能（异常） | new-instance.test.js | 文案只取 labels.js ERROR_TEMPLATE |
| 07 | 快照 8 节点 9 边一次画全、悬空 0、图例 A-8 | 功能 | graph-projection.test.js | `grep -REn "saveState|emit\(" src/daemon/graph.js` 零命中（ERE） |
| 08 | 推送先全量、角色变化 ≤500ms、断线重连补全量 | 功能（实时） | graph-stream.test.js | `grep -REn "new EventEmitter" src/daemon/http/` 零命中；推送源自既有事件总线 |
| 09 | 连接线 1 秒内 5 变只推 1 帧且为最后态 | 功能（节流） | graph-throttle.test.js | 可注入时钟纯调度器，禁 setTimeout 硬等 |
| 10 | 会话 5 连变：rev 不变、role/connection 帧 0、indicator ≤5、坐标尺寸逐项不变 | 功能（节流/边界） | graph-throttle.test.js | session 事件不入 rev 白名单 |
| 11 | 角色节点五要素逐字 A-9、token 断言（blue/escalated/计数/hostIcons 顺序） | 功能 | role-node.test.js | 状态由既有投影派生；`grep -R decideStatus desktop/` 零命中 |
| 12 | 服务节点 >2 折叠、会话 >1 堆叠 ×3、宽度不变 180 | 功能（边界） | role-node.test.js | 折叠只在渲染层 |
| 13 | 人工/升级/子工作流三类视觉与标签逐字 A-10 | 功能 | special-node.test.js | 类型只读定义层 node_type，不按标题猜 |
| 14 | 含人工+子工作流拓扑完整：4 节点 4 边、悬空 0、层号固定、回流为弧 | 功能（规划验收） | graph-projection.test.js + graph-layout.test.js | 未知 node_type 不丢节点 |
| 15 | 7 态视觉 token 表逐项 + not_started 默认隐藏可开关 | 功能（视觉编码） | edge-visual.test.js | 视觉只由聚合状态映射 |
| 16 | 聚合优先级、正/回流分线、并行合并「2 并行交接」 | 功能（聚合） | edge-aggregate.test.js | 复用基线优先级常量，两份实现由测试锁同一顺序 |
| 17 | 层次布局：层号/x=layer×240/同层 y 不等/回流不改层/两次逐字节相同 | 功能（布局） | graph-layout.test.js | `grep -REn "Date[.]now|fs[.]" desktop/ui/graph/layout.js` 零命中；布局纯函数 |
| 18 | 异常置顶不破坏布局：坐标尺寸 diff 空、z={B:1}、解除还原 | 功能（布局/边界） | graph-layout.test.js | 异常态不入层号/坐标计算 |
| 19 | 13 角色（8+5）折叠为 2 组、展开/收起三态 2/10/2、层号不漂 | 功能（布局/折叠） | graph-collapse.test.js | 分组键只取角色 group，缺失落「未分组」 |
| 20 | 缩放 50–200% 夹取、平移、复位一键归零 | 功能（交互） | view-state.test.js | 缩放只动变换矩阵 |
| 21 | 双击聚焦 2 跳（B/C/D）、Esc 恢复全集 | 功能（交互） | focus-mode.test.js | 只过滤可见集合不改坐标 |
| 22 | 拖拽按实例保存于 views json、跨实例隔离、实例文件字节哈希不变 | 功能（持久化/只读） | view-state.test.js | `grep -REn "instanceDir|statePath" desktop/ui/` 零命中 |
| 23 | 异常角标+脉冲：w/h/x/y 四项相等、token pulse、线红 back | 功能（视觉/边界） | abnormal-style.test.js | 脉冲只是 CSS/变换层效果 |
| 24 | 看板 7 列只读、已取消折「已取消 2」、切回视图状态逐字段相等 | 功能（视图切换） | board.test.js | 列只由状态+上游派生 |
| 25 | 默认只显异常标签 3 条、悬停 +1、移开恢复 | 功能（交互） | labels-policy.test.js | 可见性由状态+悬停键决定 |
| 26 | 规划验收句端到端逐字三段：列表→拓扑完整图→关窗 daemon 活 | 规划验收（核心） | acceptance-e2e.test.js | 禁测试专用渲染分支，与 07/14 同批模块 |
| 27 | 只读与本地性：实例文件哈希不变、401、监听仅 127.0.0.1 | 功能（安全/边界） | readonly-local.test.js | `grep -REn "saveState|instance-store|appendSpan" src/daemon/http/` 零命中；startRun 命中全落 POST /instances 文件 |
| 28 | 零依赖/中文唯一来源/31 词纯净/无宿主分支/全量基线差集 0 | 非功能（架构） | labels-desktop.test.js | purity-check 31 词 ×（src/core,src/daemon）与 × desktop/ui 均 exit 0 |
| 29 | 清空环境（无 node、无配置）双击可用、tray-created、点进实例画出图 | 非功能（开箱即用） | bundle.test.js | `grep -REn "env::var\(\"PATH\"\)|Command::new\(\"node\"\)" desktop/src-tauri/src/` 零命中 |
| 30 | 六种异常提示逐字（不存在/定义不可读/角色数未知/守护失败/重连中/不可读） | 功能（异常） | errors.test.js | 降级不删正常元素；未知定义按内置模板回退 |
| 31 | 项目未指定/不可用停提示页，写入记住目录后第三次启动进列表 | 功能（异常/首次体验） | project-guard.test.js | 文案只取 DESKTOP_PROJECT_*；`grep -REn "项目 未指定|项目 不可用" desktop/` 零命中（ERE 含中文） |
| 32 | 健康度悬停 8 类逐字 A-7、normal 只显「健康度 正常」 | 功能（文案基线） | health-hover.test.js | 只透传 health.reasons；`grep -REn "P90|TTL|崩溃" desktop/ui/` 零命中 |
| 33 | 悬停角色高亮上下游集合、悬停线高亮两端、移开恢复、坐标不变 | 功能（交互） | hover-highlight.test.js | 高亮集合由邻接派生，不按坐标猜 |
| 34 | 图例固定左下角、三视图态下文本与锚点不变、画布最上层 | 功能（视觉） | legend.test.js | `grep -REn "Date[.]now|fs[.]" desktop/ui/graph/` 零命中 |
| 35 | 看板未知状态落被阻塞 +「状态未知」，不丢卡片 | 功能（边界） | board-unknown.test.js | 未知值只影响看板投影，显式默认分支 |
| 36 | 重复双击无第二窗口/守护进程、tray-open 激活已有窗口 | 功能（桌面壳） | single-instance.test.js | 应用级单实例锁；第二进程激活后自行退出 |
| 37 | 同 1 秒窗角色+连接线齐变：角色 ≤500ms 到、线合并 1 帧最终态 ≤1200ms、都不丢 | 功能（节流/实时） | graph-parallel.test.js | 两类推送互不共享队列；调度器同 AC-09 |

非功能 NF-1~NF-7（开屏 ≤3s、实时 ≤500ms、重连 ≤5s、稳定 10 开关/20 切换、资源、无回归、零依赖）已逐条映射进 AC-01/08/09/26/28/29 的机检判定，无独立 NF-AC。

---

## 3. 契约清单（BR / M / C）

### 3.1 BR 逐条（32 条，源：requirement.md §2.15，292–323 行）

| BR | 一句话 | 被 AC 引用 |
|---|---|---|
| BR-01 | 3 秒开窗停列表；关窗只缩托盘不停 daemon；托盘退出才停；有运行中实例先确认 | AC-01/02/26/36 |
| BR-02 | 自带运行环境免预装；只经本机回环访问 daemon | AC-01/27/29 |
| BR-03 | 列表每行固定六项固定顺序，缺一即不合规 | AC-01/03/26 |
| BR-04 | 分档排序 需关注→慢→正常→已结束，同档按更新时间倒序 | AC-03 |
| BR-05 | 空态「实例 无」；损坏行「状态不可读」不隐藏不阻断 | AC-04 |
| BR-06 | 新实例/状态/健康度变化 2 秒内反映，无需手动刷新 | AC-04/05 |
| BR-07 | 新建必须选工作流+填说明；缺项中文提示留在面板；失败中文原因不产生实例不崩溃 | AC-05/06 |
| BR-08 | 先全量快照后推送；断线显示重连中，重连后取全量不叠加 | AC-08/30 |
| BR-09 | 角色节点五要素；N 个活跃会话/服务节点 `, ` 分隔/>2 折叠/堆叠角标 | AC-11/12/26 |
| BR-10 | 特殊节点三类齐全且参与拓扑，禁悬空端点 | AC-13/14/26 |
| BR-11 | 7 态固定视觉；正/回流分线；回流恒反弧；并行合并；固定优先级 | AC-15/16/23 |
| BR-12 | 层次布局从左到右；回流不改层次；同层并排；两次打开坐标一致 | AC-14/17/18 |
| BR-13 | 异常角标+脉冲浮最上层，位置尺寸不变，其它节点不挪 | AC-18/23 |
| BR-14 | 缩放 50–200%；平移；一键复位；双击 2 跳聚焦、Esc/再双击退出 | AC-20/21 |
| BR-15 | >12 角色按分组折叠，组节点「分组 {group} · N 角色」可展开收起；子工作流恒折叠 | AC-19 |
| BR-16 | 拖拽按实例记住，跨实例隔离；不写实例状态不追加审计 | AC-22 |
| BR-17 | 切换流程图/看板不丢视图状态；看板 7 列只读 | AC-24/35 |
| BR-18 | 默认只显异常标签；正常态悬停显示；角色节点内容不受影响 | AC-25 |
| BR-19 | 角色实时 ≤500ms；连接线 1 秒合并最后态；会话只走指示器通道不重绘不挪位；真变才升级为角色更新 | AC-08/09/10/26/37 |
| BR-20 | 面板只读；新建实例是唯一新增实例操作 | AC-02/10/22/27 |
| BR-21 | 全部中文来自 labels.js；界面层无中文字面量不自造同义词 | AC-28 |
| BR-22 | dependencies 恒 `{}`；界面层零 npm 包；CLI/用法块/RPC 方法表不动、三主链逐字不变 | AC-28 |
| BR-23 | 健康度四档、角色六态、交接包七态、节点九态全用既有中文词，不自造 | AC-03/11/24 |
| BR-24 | 六种异常情况全有中文提示且界面可用，不白屏不打堆栈 | AC-04/06/30/31 |
| BR-25 | 项目未指定/不可用停提示页（A-3 逐字），填可用目录后进列表 | AC-31 |
| BR-26 | 健康度悬停只复用 I1.9 八类原因句；无原因只显「健康度 正常」 | AC-32 |
| BR-27 | 悬停角色高亮全部上下游线与两端节点，其余降不透明度 | AC-33 |
| BR-28 | 悬停连接线高亮两端角色，其余降不透明度 | AC-33 |
| BR-29 | 图例两行固定左下角，与 A-8 逐字一致，缩放平移不改锚点 | AC-34 |
| BR-30 | 看板未知状态落被阻塞 +「状态未知」，不丢卡片不崩溃 | AC-35 |
| BR-31 | 重复双击单实例激活已有窗口；托盘「打开主窗口」同 | AC-36 |
| BR-32 | 同 1 秒角色+连接线齐变：角色立即、线合并后到，互不阻塞都不丢 | AC-37 |

BR 双向覆盖由 round2 扫描 3 确认：悬空 0、未被引用 0。

### 3.2 M-xx / C-xx

**需求 v2 全文未出现 M-xx / C-xx 编号**（与 I1.7 等带里程碑契约的迭代不同）。本迭代契约面全部由 BR 表达 + 附录 D 实现约束（D-10/D-11 承担「授权修改/授权断言」职责）。S1 拆分不需要解析 M/C 清单；若拆分文档要引入 M-xx 编号体系，属于拆分自身的组织手段，不得与需求编号混用。

---

## 4. 附录索引

### 4.1 附录 A（A-0~A-14）→ 被哪些 AC 消费

| 小节 | 内容 | 消费的 AC |
|---|---|---|
| A-0 | 可变值约定（逐字边界：六套状态词、分隔符 ` · `/`→`/`：`、`—`/`等 N 个`/`×N`/`已取消 N`/`, `/全角冒号、方向词 正向/回流、INST-001~999） | 全部文案断言型 AC：01/03/04/05/06/11/12/13/14/15/16/19/24/25/26/30/31/32 |
| A-1 | 主窗口实例列表行 4 行样例（已按 F-01 重排） | AC-01（第 1、4 行）、AC-03（四行逐字）、AC-05（行模板）、AC-26（两行逐字） |
| A-2 | 空态「实例 无」/不可读行 | AC-04、AC-30（第 6 态） |
| A-3 | 项目 未指定 / 项目 不可用 | AC-31 |
| A-4 | 连接三态（正在连接…/已断开·正在重连…/连接失败） | AC-30（后两态）；**第一态「正在连接守护进程…」无 AC 断言（F-17，随 S1 消化）** |
| A-5 | 新建实例面板、字段、工作流三选项、校验与反馈、错误原文两例 | AC-05、AC-06 |
| A-6 | 托盘菜单两项 + 运行中退出确认三行（N=0 不确认） | AC-02 |
| A-7 | 健康度悬停八类原因句 | AC-32 |
| A-8 | 图例两行（● 五状态 / ▲!▤ 特殊节点 + 正向/回流） | AC-07、AC-14、AC-26、AC-34 |
| A-9 | 角色节点行 5 例 + 折叠/堆叠形态 1 例 | AC-11、AC-12 |
| A-10 | 特殊节点行 5 例（人工/升级/子工作流/分组/角色数未知） | AC-13、AC-14（子工作流行）、AC-19（分组行）、AC-30（角色数未知行） |
| A-11 | 连接线文本投影 4 行 + 7 态视觉 token 表 + accepted 悬停「已接受 · 处理中」 | AC-15、AC-16、AC-23（红 back）、AC-25 |
| A-12 | 视图控件 9 项 + 看板 7 列名 + 折叠标记（已取消 N/状态未知） | AC-20（复位视图）、AC-21（聚焦标题）、AC-24（看板列/已取消 2）、AC-35（状态未知） |
| A-13 | 图数据异常三行 | AC-30（前三态） |
| A-14 | 文案键与归属表（全部落 labels.js） | AC-28（GET /ui/labels 覆盖断言）、AC-31（DESKTOP_PROJECT_*） |

### 4.2 附录 B · 未决问题（U-1~U-12）状态

逐条状态见 §7；此处不重复。补充术语面（B-1）：**折叠组**（>12 角色按 group 聚合，「分组」前缀）与 **子工作流折叠组**（「子工作流」前缀）是两个概念，拆分与实现命名时严禁混用；**图版本号 rev** 只由白名单事件推进；**指示器事件**（session.indicator）不推进 rev。

### 4.3 附录 C · 版本链

- v1（2026-11-12）：首次产出，BR-01~24 / AC-01~30。
- v2（2026-11-12）：按 review-round1 F-01~F-14 修订——A-1 重排、新增 AC-31~37 + BR-25~32、§2.14 降级分支标 AC、D-1 改走 serve-entry.js、U-4/U-6 转已裁决、A-9/A-10 措辞对齐基线、判定口径 5 统一 test -f、升级跳转归属复核、数据布局登记复核、§2 移除版本号字样、AC-29 解耦实现路径（D-14）、D-12 更新为 37/32。
- 头部版本 v2 与附录 C 末行一致（round2 扫描 6 确认）。

### 4.4 附录 D（D-1~D-14）→ 对应 WP 的约束

| 小节 | 内容 | 约束的 WP / 拆分落点 |
|---|---|---|
| D-1 | 桌面通道不经 CLI 命令表：`node src/daemon/serve-entry.js --project <root> --desktop`；127.0.0.1:0 + desktop.json 原子写/退出删；Bearer 401；先 listen 后写文件 | daemon 通道 WP（改 serve-entry.js + server.js） |
| D-2 | 8 条接口与 SSE 帧契约、rev 白名单、nodes/edges 字段、错误码沿用既有语义、POST 上限 32KB | HTTP routes/stream WP |
| D-3 | 图投影只读派生：graph.js 不读盘不写盘不取时间；定义解析顺序 workflowRef→内置模板→空图；role/human/escalate/subworkflow/group 五类节点；边聚合与优先级；健康度直读 state.health 不重算 | graph.js WP |
| D-4 | 布局与视图纯函数模块（layout.js/view.js/board.js/labels.js）禁 DOM/fs/Date.now/window；常量 180/80/240/140/弧高 40；折叠/聚焦/拖拽/看板/标签口径 | desktop/ui 纯模块 WP |
| D-5 | 推送节流三规则 + 注入时钟实现要求 | stream/调度器 WP |
| D-6 | Tauri 优先回退 Electron；托盘两项；关窗=隐藏；单实例锁；打包资源含自带运行时用包内绝对路径；--probe/--ctl 接缝规格 | 桌面壳 WP |
| D-7 | 中文只追加 labels.js 末尾；desktop/ui 与 desktop/harness 禁 CJK（含注释）；src/core、src/daemon 禁宿主分支；31 词表全文；禁 UI 框架/构建器/WebSocket 库/YAML 解析库 | labels WP + 全局扫描（AC-28） |
| D-8 | 数据来源与只读边界：health 直读、trace 只读投影、事件唯一源、除 POST /instances 外禁写方法 | HTTP WP 红线 |
| D-9 | test/wp13/ 全覆盖；harness 五脚本（collect/render-list/graph-dump/layout-dump/board-dump）；POST /__test__/graph/pulse 仅 NODE_ENV=test 注册；夹具 yaml 要求 | 测试 WP |
| D-10 | 授权修改清单（见 §6.1） | 全部 WP 的文件边界 |
| D-11 | 授权断言修改清单 = **无** | 回归 WP |
| D-12 | AC 37 / BR 32 编号形态与机械取号命令 | 拆分后的对账工具 |
| D-13 | 明确不动的既有行为清单 | 全部 WP |
| D-14 | 运行时打包两条可选路径，不进验收判定；若打包可行性阻塞拆分，先做最短打包验证再回填 | 拆分选型（裁决 B） |

---

## 5. Given 可构造性核查（重点，逐条）

### 5.0 通用夹具前提（每条 AC 复用，不再逐条重复）

- **独立项目根**：`/tmp/maestro-i10a-<suffix>`，绝不进仓库；每 AC 独立。
- **环境注入**：一律 `NODE_ENV=test`；`MAESTRO_CONFIG_DIR` 指向夹具内 config 目录（`projects.json` 由夹具直接写入）；`--project` 参数优先于配置目录。
- **mock 宿主**：夹具根写 `.orch/hosts/mock.json`，`launch.command/args` 指向仓库内 `test/fixtures/mock-acp-agent.js`；`orch run` 必须带 `--cwd .` 与 `--host mock`。
- **快照夹具铁序（§3.3，769 行）**：先在空目录拉起核心（`node "$MAESTRO_REPO/bin/orch.js" instance status INST-001` 返回「不存在」即可）→ 再写 `state.json` / `traces.jsonl` / 工作流定义 → 最后才打开界面；快照带 `schemaVersion: 2`。原因：核心启动时把非本核心代的 created/running 实例判为已中断。
- **等待口径**：一律「条件成立即继续」轮询（100ms 一次，上限 30 秒），禁固定 sleep；1 秒合并窗口边界用注入时钟单测，不做真实时间赛跑。
- **CLI 命令口径**：`node "$MAESTRO_REPO/bin/orch.js" ...` 在夹具目录内执行；路径断言只用相对路径或结尾匹配。
- **依赖桌面壳的 AC 需先执行**：`cd "$MAESTRO_REPO" && npm run desktop:build`，产物 `desktop/src-tauri/target/release/bundle/macos/Maestro.app`。构建链（rustc/cargo 1.98.1 + Xcode）本机已核实可用（§3.3 764 行 + decisions.md 环境更正）。

### 5.1 ⚠️ 全局接缝警示（影响多条 AC，拆分必须在夹具设计时明确）

1. **`open -na` 不继承 shell 环境变量**。macOS 的 `open(1)` 经 LaunchServices 启动 .app，`NODE_ENV=test` 与 `MAESTRO_CONFIG_DIR=...` **传不进去**。需求夹具多处写 `open -na ... --args --project ... --probe ... --ctl ...`（AC-01/26/31/36），argv 可达但 env 不可达。可行解：改用直接执行 bundle 内二进制 `Maestro.app/Contents/MacOS/maestro --project ... --probe ... --ctl ...`（继承当前 shell 环境，仍是「双击等价命令」，AC-29 的机检本就要求 `env -i` 启动、只有直接执行才能控制环境）。**这不算缺接缝（有替代路径且不改变判定强度），但拆分文档必须把各 AC 的启动命令统一成可直接执行二进制的形态，否则 AC-01/26/31/36 按字面夹具跑会因 NODE_ENV 未注入而走生产路径。** AC-29 的夹具同理必须直接执行二进制（`env -i ... /path/Maestro.app/Contents/MacOS/maestro ...`）。
2. **registry 对 `node_type: human/escalate/subworkflow` 的接受度需先核查**。AC-07/13/14 的夹具直接写 `.orch/workflows/release-flow.yaml`（含四类 node_type 与 `kind: backflow` 边），图投影解析复用 `src/registry` 既有实现（D-7）。夹具写盘不经 `orch workflow` 校验器（校验器行为 D-13 冻结不动），但若 registry 解析层对 node_type 有枚举白名单且不含这三类，投影层将读不到特殊节点 → AC-13/14 判定失败。D-3 已写「未知 node_type 按 role 渲染」，但 human/escalate/subworkflow 必须被**识别**而非按 role。拆分 S1 必须先读 `src/registry` 的 node_type 处理现状并给出结论；若确需扩展解析接受面，属「新增能力」落在 graph.js 侧（不动校验器），或按 §1.2 走需求修订。
3. **探针/ctl 接缝的生效条件**（§3.3 771 行、D-6）：`--probe`/`--ctl` 只在显式传参时启用，生产启动不写探针；ctl 文件「出现即触发、触发后改名 `.done`」。夹具清理逻辑要处理 `.done` 残留，避免二次运行误触发。
4. **pulse 接缝只动内存**（D-9）：`POST /__test__/graph/pulse` 仅 `NODE_ENV=test` 注册、只改内存测试投影不写盘。因此 AC-08/09/10/37 的推数场景**不会污染实例文件**——AC-27 的哈希断言与它们天然兼容，但**不要在同一项目根里同时跑 AC-27 与 pulse 类 AC 的判定**（时序上 AC-27 的 When 含界面操作与三次刷新，混入 pulse 会让帧计数断言失真）；每 AC 保持独立项目根即可。
5. **本机 node 安装位置与 AC-29 的 `which node` 断言**：AC-29 要求 `env -i PATH=/usr/bin:/bin` 下 `which node` 非零。若本机 node 恰好装在 `/usr/bin` 或 `/bin`（极不常见），需改用更窄 PATH；本机 node v22.22.2 按常规安装不在 `/usr/bin:/bin`，断言可成立。拆分夹具落定时实测一次即可。

### 5.2 逐条核查

> 分类：**[壳]** = 依赖桌面壳运行本身（Maestro.app + --probe/--ctl 接缝）；**[夹具]** = 纯夹具数据 / harness 直驱纯模块 / 服务端测试接缝，不依赖窗口；**[混合]** = 判定主体不依赖窗口但 Given 含界面动作、需 harness 等价驱动。

**AC-01 [壳]** — 造法：`/tmp/maestro-i10a-shell` 先起核再写两份 state.json（一运行中需关注、一已完成，health.level/updatedAt 交错）；`npm run desktop:build`；config 目录写 `projects.json` 指向项目根；直接执行二进制（见 5.1-1）带 `--project/--probe/--ctl`。判定：探针 `{"event":"ready",...,"view":"instances"}` 且 `ready.t-launch.t≤3000`；`probe.rows` 与 A-1 第 1、4 行逐字。构造性：✅（环境注入方式必须按 5.1-1 修正）。探针接缝：`--probe`。

**AC-02 [壳]** — 造法：AC-01 现场 + `--host mock` 启动一个真实运行中实例（`orch run --cwd . --template single --host mock --task "写一份说明"`，mock 宿主保证关窗后仍在推进）；记 daemon pid（core.json）。操作全走 ctl：`mkdir ctl/close-window` → 读探针 → `mkdir ctl/tray-quit` → 读探针见确认句 → `mkdir ctl/tray-quit-confirm`。判定：事件序列 ready→close-window→tray-still-present→quit-confirm-shown→quit(daemonStopped=true)；pid 不变；两次 `instance status` 的 updatedAt 不同（或节点推进一次）；退出后 daemon.alive=false。构造性：✅。探针接缝：`--probe` + `--ctl` 三文件。注意「关闭前后两次 updatedAt 不同」依赖 mock 宿主真实推进，间隔要留足推进周期。

**AC-03 [夹具]** — 造法：`/tmp/maestro-i10a-list` 先起核再写四份 state.json（四档 health.level + updatedAt 交错）；`collect.mjs --project ... --out instances.json` 从真实接口取数 → `render-list.mjs --payload ...` 输出四行 vs A-1 四行逐字 + 排序序列 attention/slow/normal/ended。构造性：✅，纯数据+harness，不依赖壳。依赖接口：`GET /instances`（需 daemon 通道已实现）。

**AC-04 [夹具]** — 造法：`/tmp/maestro-i10a-list-live` 三阶段同根：①空根起核开列表（「实例 无」）；②写一份非法 `state.json`（损坏实例，I1.9 corrupt 语义会备份 state.json.corrupt，原行仍现）等 2 秒；③`orch run --cwd . --template single --host mock --task "写一份说明"` 起新实例等 2 秒。判定：三次渲染 = A-2 空态/含不可读行/含新行；新行由 `instances.changed` 推送触发（探针记 refetch 次数 ≥1 且无周期性重复）。构造性：✅。阶段②的非法 state.json 写法需与 I1.9 损坏判定一致（非法 JSON 即可）。

**AC-05 [夹具]** — 造法：`/tmp/maestro-i10a-new` mock 项目根；经 `POST /instances`（Authorization: Bearer <desktop.json 的 token>，body `{template:'code-loop', task:'实现 calc.js\n产物：calc.js'}`）启动；对照实例用 CLI 同参启动（`$'实现 calc.js\n产物：calc.js'` 的 zsh ANSI-C 引用转真换行）。判定：回包成功、GET /instances 含新实例、渲染行匹配 A-1 模板、2 秒内出现、与 CLI 实例状态词/健康度词逐词相等、只新增一例。构造性：✅。依赖接缝：HTTP POST + desktop.json。

**AC-06 [夹具]** — 造法：AC-05 现场 + 第二个坏现场（mock.json 的 launch.command 指向不存在解释器）；四步操作依次为 不选工作流/单节点+空说明/编码闭环缺产物行/坏现场启动。判定：四条提示逐字 A-5（前三为校验行、第四为 `启动失败 · <原文>`），面板 open=true、实例数两次不变、无堆栈。构造性：✅。缺产物行的期望原文在 A-5 有逐字样例；「启动失败」原文随坏现场的真实错误而定，断言形态（前缀 `启动失败 · `）而非全文——拆分注意 A-5 最后一条的「例如」是示例，判定锚是形态前缀 + ERROR_TEMPLATE 来源。

**AC-07 [夹具]** — 造法：`/tmp/maestro-i10a-graph` 先起核 → 写 `state.json`（8 节点状态、3 交接包、workflowRef: release-flow）+ `.orch/workflows/release-flow.yaml`（node_type 覆盖 role/human/escalate/subworkflow、9 边含 1 条 `kind: backflow`）→ 打开界面取快照。判定：graph-dump.mjs 输出 nodes=8/edges=9/悬空 0/每节点带类型状态/每线带方向与聚合状态/图例两行 A-8。构造性：✅，但**受 5.1-2 警示约束**（registry 对三类 node_type 的识别）。

**AC-08 [夹具]** — 造法：AC-07 现场 + `GET /instances/:id/graph/stream` 连上 → `POST /__test__/graph/pulse`（kind:role）翻一次角色状态 → 主动断流再重连。判定：首帧 graph.snapshot 全量、`t_role-t_pulse≤500ms` 一帧角色更新（蓝色服务中、其它节点不闪）、重连首帧仍 snapshot 且节点数一致。构造性：✅。依赖接缝：pulse（NODE_ENV=test）+ SSE。

**AC-09 [夹具]** — 造法：单边 E-01（开发→测试）当前已投递；pulse kind:connection、count:5、intervalMs:40（200ms 内 5 变：已接受→待投递→已拒绝→已完成→已过期）；静默 1.5 秒。判定：该 key 恰 1 帧 connection.updated、aggregateStatus=expired、窗口 1000ms 自首变起算。构造性：✅。合并调度器可注入时钟，边界用单测（1000ms 不推、1001ms 推）。

**AC-10 [夹具]** — 造法：AC-07 现场记全节点坐标/尺寸/rev；pulse kind:session 5 连变（空闲→执行中→调用工具中→执行中→空闲），不改节点状态。判定：rev 不变、roleFrames=0、connectionFrames=0、indicatorFrames≤5、两帧布局坐标尺寸逐项相等。构造性：✅。

**AC-11 [夹具]** — 造法：直接写实例快照（2 节点、2 会话宿主 dsh+cursor、1 个升级节点挂在「开发」上），不派发真实会话。判定：行文本=A-9 服务中示例、statusColor=blue、badge=escalated、badgeCount=1、hostIcons=['dsh','cursor']。构造性：✅。会话对象需带 node 绑定与 hostId 以支撑投影，具体字段以 D-3 角色投影为准。

**AC-12 [夹具]** — 造法：快照 3 服务节点、3 会话、单宿主 mock。判定：A-9 折叠示例逐字、sessionStack=3、width=180（D-4 常量）。构造性：✅。

**AC-13 [夹具]** — 造法：工作流定义（human「人工验收」pending、escalate「人工裁决」escalated、subworkflow「发布子流程」指向一个声明的子工作流资产含 3 角色）+ 快照。判定：A-10 三行逐字（子工作流行含全角冒号）、shape=shield/alert/group、color=gray/red/green。构造性：✅，受 5.1-2 警示。子工作流资产 yaml 也由夹具直接写盘。

**AC-14 [夹具]** — 造法：`/tmp/maestro-i10a-topology`，定义 T-001→H-001→S-001→T-002 + T-002→T-001 回流，快照 workflowRef 指向该定义（先起核再写盘）；中文节点标题来自夹具数据（不属界面硬编码）。判定：四类节点齐、4 边全画、dangling=0、path.kind=arc、层号 {T-001:0,H-001:1,S-001:2,T-002:3}、同层 x 等 y 不等。构造性：✅，受 5.1-2 警示。这是规划验收句「拓扑完整」的直接判据，夹具数据质量优先级最高。

**AC-15 [夹具]** — 造法：快照写 7 条交接包分别落 7 态。判定：6 条 token 表逐项相等、not_started 默认 hidden=true、开「显示未开始连接线」后 false。构造性：✅。

**AC-16 [夹具]** — 造法：快照：测试→开发 3 包（rejected/accepted/consumed，edge.kind=backflow）、开发→测试 2 并行已投递。判定：该对边数=2、backflow.aggregateStatus=rejected、forward.parallelCount=2、label 含「2 并行交接」+ 7 态两两组合表驱动优先级。构造性：✅。

**AC-17 [夹具]** — 造法：纯图数据不经接口（A→B、A→C、B→D、D→B 回流、C→D），`layout-dump.mjs --payload graph.json` 连续布局两次。判定：层号 A=0/B=1/C=1/D=2、x=0/240/240/480、B/C y 不同、回流 kind=arc 且 B 不被推层、两次 JSON 字节相等。构造性：✅，完全不经守护进程。

**AC-18 [夹具]** — 造法：AC-17 图两份（仅 B 状态不同：正常 vs 已升级）。判定：逐节点 diff 坐标尺寸差集空、z 差集 {B:1}、相连边 z 提升、解除后 z 回 0 坐标不变。构造性：✅。

**AC-19 [夹具]** — 造法：夹具根写 `.orch/roles/*.yaml` 13 个角色（8 个 group: coding、5 个 group: research）+ 工作流定义 13 角色节点 1 条跨组边 + 快照。判定：三态可见节点 2/10/2、组节点标签「分组 编码工程 · 8 角色」「分组 研究分析 · 5 角色」逐字、折叠态边数=1、展开后成员回原层。构造性：✅。角色 yaml 直接写盘（group 字段在注册表 schema 中存在，main.js GROUP_LABEL 可证）；若注册表读盘路径对角色文件有额外要求（如必须经 orch role create），拆分需实测一次。

**AC-20 [夹具]** — 造法：纯视图状态模块（不依赖接口）驱动 zoom/pan 到 150%/(+120,-40)，复位，再试 10%/300%。判定：屏幕宽 270=180×1.5、复位归零、夹取 0.5/2.0。构造性：✅。

**AC-21 [夹具]** — 造法：纯图数据 A→B→C→D→E + A→E，双击 C。判定：可见 [B,C,D]、边两端可见、标题「聚焦 C（2 跳）」、Esc 恢复全集。构造性：✅。

**AC-22 [夹具]** — 造法：`/tmp/maestro-i10a-drag` 两实例项目根；记 state.json/events.jsonl 字节哈希；经视图状态模块写偏移（等价界面拖拽结束写入）到 `.orch/desktop/views/INST-001.json`；重开实例一、再开实例二。判定：B 坐标=基础+(40,60)、实例二不受影响、偏移文件内容正确、两份哈希前后相等。构造性：✅，纯文件系统+harness，窗口无关。

**AC-23 [夹具]** — 造法：两份图数据（角色正常→挂已升级节点；线已完成→已拒绝）。判定：w/h/x/y 四项相等、animation=pulse、badge=escalated、线 color=red/arrow=back、其它节点坐标不变。构造性：✅。

**AC-24 [夹具]** — 造法：快照 10 节点（2 待执行其一上游未完成、1 执行中、1 待校验、2 已完成、1 失败、1 已升级、2 已取消）；先经视图状态模块设好拖拽/缩放再切看板、切回。判定：7 列名顺序逐字、列-卡片集合、折叠标记「已取消 2」、切回前后视图状态对象逐字段相等。构造性：✅。「上游未完成」用 forward 前驱非 done 构造。

**AC-25 [夹具]** — 造法：图数据 6 线（已完成/已接受/已投递/待投递/已过期/已拒绝）+ 纯标签投影。判定：visibleLabels 三次集合 3/4/3、新增键=已完成那条、角色节点内容三次均在。构造性：✅。

**AC-26 [壳]** — 造法：`/tmp/maestro-i10a-acceptance`：构建 app + 记住项目根；INST-001 由夹具构造（4 节点 4 边，含人工+子工作流，workflowRef yaml 同 AC-07 口径；**运行时不会推进 human/subworkflow，U-4 已裁决夹具满足拓扑完整**）；INST-002 已完成单节点。操作：直接执行二进制启动（5.1-1）→ ctl/open-instance/INST-001 → ctl/close-window。判定：探针 ready→rows→graph-shown(nodes/edges/dangling=0)→closed(visible=false)；pid 前后相等；instance status 成功。构造性：✅，受 5.1-1/5.1-2 双警示。禁测试专用渲染分支——INST-001 的图必须与 AC-07/14 同批模块渲染。

**AC-27 [混合]** — 造法：mock 项目根起一运行实例 + 通道就绪（desktop.json 可读）；记 state.json/events.jsonl 哈希与节点/会话/交接包/升级四组状态。操作：界面动作序列（开列表/进图/缩放/拖拽/聚焦/切看板/开关/刷新×3）**经 harness 等价驱动**（同 AC-22 的「拖拽经视图状态模块完成」模式）；无凭据请求直连 HTTP；`lsof -nP -iTCP:<port> -sTCP:LISTEN` 查监听。判定：哈希相等、四组状态深比较相等、401、lsof 每行 127.0.0.1:<port>、0.0.0.0 通配零命中（ERE）；http 层禁写方法零命中、startRun 命中全落 POST /instances 文件。构造性：✅。HTTP/回环部分纯服务端可测；界面动作部分不依赖真实窗口（harness 同批模块），但拆分要把「界面动作的 harness 等价映射表」写清楚。

**AC-28 [夹具]** — 造法：仓库静态检查，无业务夹具、不读写 /tmp 业务数据。判定：dependencies 键数=0、labels-desktop.test.js 断言 desktop/ui 与 desktop/harness CJK=0 + /ui/labels 覆盖界面键集合、purity-check 31 词两轮（src/core,src/daemon 与 desktop/ui）exit 0、全量测试基线差集 0。构造性：✅（实现完成后自然成立）。注意「全量测试」判据以 I1.9 收口 1157 tests 为对照、失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 差集为 0，不判零失败。

**AC-29 [壳]** — 造法：`/tmp/maestro-i10a-bundle` 项目根 + 预置 config + 一个实例；`env -i PATH=/usr/bin:/bin HOME=/tmp/maestro-i10a-bundle/home` 下**直接执行 bundle 内二进制**启动（open 不继承 env，5.1-1）。判定：探针 ready≤3000ms + tray-created、同 PATH 下 which node 非零、点进实例后 probe.view=graph。判定**不检查**包内目录结构/解释器位置/启动方式（D-14）。构造性：✅。前置依赖裁决 B 的最短打包验证（见 §9）。

**AC-30 [混合]** — 造法：六份现场逐条：① INST-999 不存在（请求不存在实例的图/列表）；② INST-001 的 workflowRef 指向不存在文件；③ 子工作流 workflow 指向不存在资产；④ 停掉守护进程（core.stop 或 kill）；⑤ 断开推送连接（关 SSE）；⑥ state.json 损坏（写非法 JSON）。判定：六条提示逐字（A-13 前三 + A-4 失败句 + A-4 重连句 + A-2 不可读行），全部不白屏不打堆栈、「界面仍可继续操作」有探针/渲染态断言。构造性：✅。①②③⑥ 纯投影/harness 可测；④⑤ 涉及连接态渲染，机检断言点为渲染输出，harness 可驱动（不强依赖真实窗口），但拆分要给④的「守护进程不在 + 界面在场」构造步骤。

**AC-31 [壳]** — 造法：`/tmp/maestro-i10a-proj`：现场一 config 目录为空且不带 --project 启动；现场二带 `--project /tmp/maestro-i10a-proj/nope`；现场三夹具直接写 projects.json 后再启动。判定：三次探针 view = project-missing/project-invalid/instances、前两次文本与 A-3 逐字（可变值按 A-0 替换为实际路径）、visible=true、无未捕获异常事件。构造性：✅，受 5.1-1 警示。宿主配置不参与判定。

**AC-32 [夹具]** — 造法：`/tmp/maestro-i10a-health` 先起核再写 9 份 state.json（8 份按 A-7 八类构造 health.level+health.reasons——**reasons 直接取 I1.9 判定结果，夹具不重算**（D-8）；1 份 level:normal 且 reasons 空）。判定：harness 导出 9 行悬停文本，前 8 与 A-7 逐字（可变值替换）、第 9 行=「健康度 正常」；原因句由 /ui/labels 的 HEALTH_LINE/HEALTH_REASON 模板 + health.reasons 参数渲染；desktop/ui 禁 P90|TTL|崩溃 字样。构造性：✅。

**AC-33 [夹具]** — 造法：`/tmp/maestro-i10a-hover` 夹具构造快照：节点 A/B/C/D + 边 A→B、B→C、C→D、D→B（回流）；graph-dump 同批模块对四种状态（默认/悬停 B/默认/悬停 B→C）导出不透明度集合。判定：悬停 B 的全不透明集合={A→B,B→C,D→B 三线 + A,B,C,D 四点}、悬停 B→C={该线+B,C}、两次移开恢复全集、坐标尺寸不变。构造性：✅。⚠️ **F-19 已裁定的问题**：此夹具下悬停 B 恰好覆盖全部 4 节点 4 边，「其余元素降低不透明度」前半段无可比对集（断言真空）——拆分必须给落点（加一个与 B 不相邻的节点 E 或边 C→E，使「悬停 B 时 E 降透明度」成为可裁决断言），否则该 AC 的前半段判定强度是空的。

**AC-34 [夹具]** — 造法：`/tmp/maestro-i10a-legend` 流程图已渲染；视图状态模块驱动 150%/(+120,-40) → 复位 → 折叠一个分组（或无分组图默认态）。判定：三态下 legend.anchor=bottom-left、legend.lines=A-8 两行逐字、层级画布最上层。构造性：✅，纯模块 harness 驱动；项目根仅保证与真实界面同批模块。

**AC-35 [夹具]** — 造法：`/tmp/maestro-i10a-board-x` 先起核再写盘：3 节点（执行中/已完成/"status":"mystery"，schemaVersion 仍 2）。判定：board-dump 导出未知节点 column=blocked、标注含「状态未知」、卡片总数=3、切回流程图后视图状态对象不变。构造性：✅。

**AC-36 [壳]** — 造法：`/tmp/maestro-i10a-single` mock 项目根；第一次直接执行二进制启动（记探针与 pid）；第二次同参再执行（模拟重复双击）；ctl/close-window 隐藏窗口；ctl/tray-open 打开。判定：无第二个 ready、出现 activated、pid 相等、tray-open 后探针 {"event":"tray-open","window":{"visible":true}} 且视图仍 instances。构造性：✅。探针文件追加式共用一份。**注意「再次执行启动」在单实例锁生效后第二进程自行退出——测试要容忍第二进程的退出码差异。**

**AC-37 [夹具]** — 造法：AC-07 现场已进流程图、SSE 已连；同一 1 秒窗先 pulse kind:role 一次、再 200ms 内 pulse kind:connection count:5 intervalMs:40；静默 1.5 秒。判定：roleFrames=1 且 ≤500ms 到达、connectionFrames=1 且为最后态 ≤1200ms、两类帧都到。构造性：✅。与 AC-09 共用调度器实现，注入时钟。

### 5.3 核查结论汇总

| 类别 | 数量 | 编号 |
|---|---|---|
| 依赖桌面壳运行本身（app + probe/ctl） | **6** | AC-01、AC-02、AC-26、AC-29、AC-31、AC-36 |
| 混合（判定主体不依赖窗口，界面动作经 harness 等价驱动） | **2** | AC-27、AC-30 |
| 纯夹具 / 纯模块 / 服务端接缝 | **29** | AC-03~25（除 26）、AC-28、AC-32~35、AC-37 |
| 标红（缺接缝不可构造） | **0** | 无 |

**标红 0 条，但有 3 条黄色警示（不缺接缝、不改判定强度，拆分必须落定做法）**：

1. **5.1-1 `open -na` 环境继承**（波及 AC-01/26/29/31/36）：统一改为直接执行 `Maestro.app/Contents/MacOS/maestro`，否则 NODE_ENV/MAESTRO_CONFIG_DIR 注不进去。
2. **5.1-2 registry 对 human/escalate/subworkflow 三类 node_type 的识别**（波及 AC-07/13/14/26）：S1 先核查 `src/registry` 现状，给出投影层如何读出这三类的结论。
3. **AC-33 断言真空**（F-19，裁决 D 已定随 S1 消化）：夹具必须加不相邻元素。

---

## 6. 与上一迭代的契约差异与回归红线

### 6.1 本迭代的改动边界（对照裁决 A：serve-entry 新桌面通道、main.js 零改动）

**授权修改清单（D-10，逐文件）**：

| 文件 | 允许改动 |
|---|---|
| `src/daemon/server.js` | 只新增可选参数 `http`（默认 false）+ 启动/关闭 HTTP 监听挂钩；`methods` 表、错误映射、`shapeSnapshot`、`instance.trace`、事件订阅逻辑一行不改 |
| `src/daemon/serve-entry.js` | 只新增 `--desktop` 参数解析并传给 createServer；`loadOrchestrator` 与降级桩不改 |
| `src/cli/labels.js` | 只在文件末尾追加 A-14 的键；既有键、USAGE_LINES、健康度/追踪文案不改 |
| `package.json` | 只允许追加 `scripts.desktop:*`；dependencies/devDependencies 保持为空/不存在 |
| 新增 | `src/daemon/graph.js`、`src/daemon/http/{server,routes,stream,labels}.js`、`desktop/ui/**`、`desktop/harness/**`、`desktop/src-tauri/**`、`test/wp13/**` |

**不得修改**：`src/core/**`（health.js/trace.js/orchestrator.js）、`src/cli/main.js`、`src/cli/render.js`、`src/persistence/**`、`src/templates/**`、`src/registry/**`。本迭代没有任何「必须改核心」的理由；实现中发现必须改 → 先回来改需求。

**新增数据布局**：`.orch/desktop.json`（原子写/退出删）、`.orch/desktop/views/<instanceId>.json`、`MAESTRO_CONFIG_DIR/projects.json`；**不新增** `instances/<id>/graph.json`（裁决 C）。

**新增事件/接口**：SSE `instances.changed`、`graph.snapshot`、`role_instance.updated`、`connection.updated`、`special_node.updated`、`session.indicator`（预留 I1.10b）；`POST /__test__/graph/pulse` 仅 NODE_ENV=test；`GET /ui/labels`。rev 白名单 = 节点/交接包/升级/实例状态/特殊节点事件，session.state、execution.summary、health.changed 不推进。

### 6.2 既有门禁逐条确认（「不动」或「新增覆盖」）

| 门禁 | 现状锚点 | 本迭代处置 |
|---|---|---|
| 三条主链（single/code-loop/task-loop）终端输出逐字不变 | src/templates/**、核心编排 | **不动**（D-13）；AC-05 的逐词比较是新增覆盖，不改 CLI |
| `orch instance status` / `instance graph` 两种既有格式 | src/cli/render.js | **不动**；桌面列表与 CLI 行不是同一条行（A-1 明确：CLI 行不打印 single 模板名、不显健康度；桌面列表始终打印中文名）——**不得反向修改 CLI 行** |
| CLI 命令表 / 两层子命令表 / USAGE_LINES 25 行 | main.js:68 `COMMANDS`（7 命令）、main.js:206-207 `RUNTIME_SUBS`（`core: ['stop']`）、labels.js:183 | **不动**；桌面通道不经 CLI 命令表（裁决 A），不新增任何 CLI 子命令，无需豁免 |
| 核心 RPC 方法表 + instance.get 读取时重算路径 | src/daemon/server.js methods | **不动**（D-10/D-13） |
| labels.js 既有键 | labels.js（882 行） | **不动**，只末尾追加 DESKTOP_* 等新键 |
| 零依赖：dependencies = {} | package.json（现无 dependencies 字段） | **不动**；AC-28 机检 `node -p "Object.keys(...).length"` 输出 0；界面层禁 npm 包；壳依赖只在 Cargo 侧 |
| 31 词纯净扫描 | test/wp11/purity.test.js WORDS_31（purity-check.mjs） | **不动且新增覆盖**：src/daemon 新增文件自动进扫描范围（覆盖扩大非断言修改，D-11）；desktop/ui 加一轮同表扫描（AC-28） |
| 中文唯一来源 | src/cli/labels.js | **新增覆盖**：desktop/ui 与 desktop/harness 禁任何 CJK（含注释），AC-28 机检 |
| 全量测试失败集合与 I1.9 收口基线差集 0、条数只增不减 | 1157 tests、docs/iterations/iteration-7/baseline-failures.txt | **不动**；新增 test/wp13/** 只增不减；既有测试文件不修改（D-9） |
| 健康度四档判定 + 八类原因码 | src/core/health.js HEALTH_REASONS（32 行冻结表） | **不动**；桌面侧只读 state.health 不重算（D-3/D-8），AC-32 逐字消费 |
| trace 跨度落盘与读取口径 | src/core/trace.js | **不动**；lastActivity 只读投影（D-3） |
| 角色注册表 / 工作流校验器 / 资产 CLI | src/registry/**、src/cli/workflows.js 等 | **不动**（D-13）；AC-19/07 的夹具 yaml 直接写盘不经校验器（受 5.1-2 警示约束） |

---

## 7. 未决问题与假设

### 7.1 U-1~U-12 最终状态

| 编号 | 主题 | 最终状态 |
|---|---|---|
| U-1 | 项目根绑定方式，无系统文件夹选择器 | 不阻塞。口径已定（`--project` > 环境变量 > 已记住项目 > 首次填写）；若改需文件夹选择器须追加依赖评估 |
| U-2 | 壳内嵌运行时方式（带 Node 二进制 vs 编译进壳） | 不阻塞，**S1 选型必答**。裁决 B 附加硬动作：拆分前先做最短打包验证；两条路径都进不了 bundle 就回来改需求 |
| U-3 | 文案经 GET /ui/labels 下发而非构建期复制 | 不阻塞。取下发方式（新增文案只改一处） |
| U-4 | 「拓扑完整」可由夹具构造的实例满足（运行时不推进 human/subworkflow） | **已裁决**（round1 写回需求 1086 行）；AC-26 的 INST-001 已标注夹具构造 |
| U-5 | 推送取 SSE 而非 WebSocket | 不阻塞。已定 SSE（零依赖、重连语义与全量快照对齐） |
| U-6 | 会话指示器只交付节流+事件分类，卡片渲染归 I1.10b | **已裁决**（round1 写回 1088 行）；`session.indicator` 事件类型预留 |
| U-7 | 异常置顶 = 层级提升 + 高亮、坐标不变 | 不阻塞。round2 维持认可（基线 466 行依据）；若按「移到每层最上方」理解则 AC-18 与布局需改写——按现口径执行 |
| U-8 | 看板「被阻塞/可调度」由单一 pending 派生；已取消折入已完成列 | 不阻塞。round2 维持认可（基线 144/166 行依据） |
| U-9 | graph.json 不落盘 | **已裁决**（主控裁决 C：豁免成立）；实现不得私改数据布局 |
| U-10 | 折叠阈值固定「可见角色 >12」、分组键取 group、缺失落「未分组」 | 不阻塞。已补全口径 |
| U-11 | 托盘退出确认属本迭代；计数徽标/暂停/通知归 I1.11 | 不阻塞。归属清晰无重叠 |
| U-12 | 架构扫描 31 词口径（非「11 词」） | 不阻塞。按仓库实际 31 词（purity.test.js WORDS_31）执行，round2 确认维持 |

**统计：已裁决 3（U-4/U-6/U-9）· 不阻塞 9 · 阻塞 0。** 无任何未决问题阻塞开工。

### 7.2 F-15~F-19（round2 建议，裁决 D：随 S1 消化）逐条落点

| 编号 | 内容 | S1 必须落点的位置 |
|---|---|---|
| F-15 | requirement.md 331 行口径标题「三条」实列五条 | 拆分阶段顺手修正（笔误类，模板 §1.2 允许）：标题改「五条」或注明 4/5 为 v2 追加 |
| F-16 | AC-03/10/26/27/28 五条机检未内联 `test -f` 前缀（370/447/627/638/649 行） | **固化进 S3 验收脚手架的机检模板**：全部机检统一为 `test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js` + 断言 `# pass ≥ 1`、`# fail 0` |
| F-17 | 「正在连接守护进程…」瞬态（A-4 第一态）无 BR/AC 断言 | 拆分文档 §8「与需求的对齐声明」逐条给落点；建议在 AC-30 守护进程分支加中间断言（核心未就绪期间出现该文案、超时转失败句）；若需补 AC 按 §1.2「只能补」走需求修订 |
| F-18 | BR-06 中段「实例状态或健康度变化后 2 秒内该行更新」无直接 AC | 同上进拆分文档 §8；建议 AC-04 增阶段四（测试接缝推进一次节点状态，断言 2 秒内行更新且由 instances.changed 触发） |
| F-19 | AC-33 夹具悬停 B 覆盖全图、断言真空 | 拆分文档 §8 给落点：图加与 B 不相邻的节点/边（如独立节点 E 或边 C→E）；**本纪要 §5.2 AC-33 已标注** |

### 7.3 本纪要新增的假设（非需求矛盾，属执行层补充）

1. **A-5「启动失败」的判定形态**：A-5 最后一条是「例如」，非逐字断言对象；AC-06 机检写「`启动失败 · <既有错误原文>` 形态」。拆分按「前缀逐字 + 来源为 ERROR_TEMPLATE/COMMAND_ERROR 原文」判定，不硬编码具体错误句。
2. **AC-04 损坏实例的写法**：写入非法 JSON 的 `state.json`（I1.9 corrupt 语义：备份 state.json.corrupt、原行仍现）。需求已指明「写入非法 state.json 构造」，无歧义。
3. **AC-36 第二进程退出码**：单实例锁生效后第二次启动进程「激活既有窗口后自行退出」（AC-36 架构检查），其退出码不在断言范围。
4. 未发现需求自相矛盾点需要标红上报：v2 经 round2 全量复核（规划覆盖 14/14、反向扫描零缺漏、源码四方一致），本纪要通读未发现新的编号错位、口径冲突或断言矛盾。唯一编辑瑕疵即 F-15（已裁决随 S1 修正）。

---

## 8. 主控裁决摘要

| 裁决 | 一句话 | 对拆分的直接指令 |
|---|---|---|
| **A** | 桌面入口走 `node src/daemon/serve-entry.js --project <root> --desktop`（等价 createServer({http:true})），不触碰 main.js 命令表/两层子命令表/USAGE_LINES；D-11 保持「无」 | daemon 桌面通道 WP 挂 serve-entry.js；CLI 零改动；不产生任何既有断言修改 |
| **B** | AC-29 保持用户视角（清空环境双击可用），实现细节收进 D-14 不进验收判定 | S1 拆分前必须先做**最短打包验证**（解释器 + bin/ + src/ 能否进 app bundle）；两条实现路径都进不了 bundle → 回来改需求，不许实现里悄悄消化 |
| **C** | U-9 豁免成立：本迭代不新增 instances/<id>/graph.json 落盘，图只在内存/响应体 | 拆分文档 §3（数据模型）按此写；实现不得私改数据布局 |
| **D** | F-15~F-19 五条建议随 S1 拆分消化，S0 不再开修订循环 | F-16 固化进 S3 机检模板；F-17/18/19 必须逐条进拆分文档 §8 对齐声明（需补 AC 则走需求修订）；F-15 顺手修正；S1 拆分评审必须核对本条落点 |
| **环境事实更正** | index.md 698 行「Tauri 需 Rust/MSVC 只能 CI 构建」是 Windows 旧结论；当前 macOS 26.6.2 x86_64 上 rustc/cargo 1.98.1 + Xcode 就位，Tauri 本机可构建 | S1 选型按当前机器事实重判，不受 698 行预判约束；Electron 路线在本机反而需要镜像 |

---

## 9. S1 拆分输入清单（硬输入，逐条必须带进拆分文档）

1. **最短打包验证先行（裁决 B）**：任何 WP 拆分定稿前，先验证「解释器 + `bin/` + `src/` 塞进 `Maestro.app` bundle、子进程用包内绝对路径启动」可行；不可行则触发需求修订流程，不许带病拆分。
2. **U-9 豁免已裁决（裁决 C）**：数据模型节（拆分 §3）按「graph.json 不落盘、图是 state.json + 事件链的内存只读投影」撰写；新增落盘面仅 `.orch/desktop.json`、`.orch/desktop/views/<id>.json`、`MAESTRO_CONFIG_DIR/projects.json`。
3. **机检模板固化（F-16 + 裁决 D）**：全部机检统一形态 `test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`，断言 `# pass ≥ 1`、`# fail 0`；禁全量 glob 代替（文件缺失时 Node 22 假通过）；S3 验收脚手架照此生成。
4. **toybox BRE 禁令**：本机 grep 是 toybox 0.8.13 shim，`\|` 恒不匹配会假通过；所有文本扫描一律 `grep -E`/`grep -RE`（ERE 交替）或 `rg`，每条架构检查写明期望结果与退出码（零命中 exit 1 / 恰 N 条 exit 0）；含中文扫描同样走 `grep -RE` 或 `rg`。
5. **桌面壳夹具启动方式**：所有依赖壳的 AC（01/02/26/29/31/36）统一用直接执行 `Maestro.app/Contents/MacOS/maestro`（继承 shell 环境）而非 `open -na`，保证 `NODE_ENV=test`/`MAESTRO_CONFIG_DIR` 注入；`--probe`/`--ctl` 只在显式传参时启用、ctl 文件触发后改名 `.done`。
6. **31 词扫描新文件自动覆盖**：`src/daemon` 新增文件（graph.js、http/*）自动进入既有扫描范围，属覆盖扩大非断言修改（D-11）；desktop/ui 另加一轮同表扫描 + CJK 零命中；`--forbid` 词表从 D-7 原样复制（31 词，见 U-12）。
7. **既有面零改动清单**：main.js（COMMANDS/RUNTIME_SUBS/coreCommand 只认 stop）、USAGE_LINES（labels.js:183）、labels.js 既有键、src/core/**、src/cli/render.js、src/persistence/**、src/registry/**、src/templates/** 全部不动；D-11 授权断言修改清单为「无」；既有测试文件不修改；三条主链与 instance status/graph 格式逐字不变；桌面列表行不得反向改 CLI 行。
8. **F-17/F-18/F-19 落点进拆分文档 §8**：对齐声明逐条给落点（瞬态文案断言、BR-06 中段 2 秒断言、AC-33 加不相邻元素）；F-15 笔误顺手修正。
9. **SSE/节流实现约束**：推送唯一触发源是既有事件总线（禁 new EventEmitter 于 http 层）；连接线合并为可注入时钟纯调度器（禁 setTimeout 硬等）；rev 白名单不含 session/execution.summary/health.changed；`session.indicator` 事件类型为 I1.10b 预留。
10. **AC-26 禁测试专用渲染分支**：端到端 AC 与 AC-07/14 必须同一批渲染模块；夹具 INST-001 的 4 节点 4 边拓扑（含人工+子工作流）是规划验收句的直接判据，夹具数据质量优先级最高。
