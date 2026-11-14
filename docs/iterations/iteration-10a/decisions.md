# I1.10a 主控决策留痕

> 依据执行模板 §2.8：自主裁决必须留痕（触发点 / 依据 / 决定 / 影响面）。本文件只由主控维护。

## 裁决 A（S0 round1 → 修复）｜F-07 `core serve` 内部矛盾

- **触发点**：round1 F-07（阻断）。v1 附录 D-1 要求新增 `node bin/orch.js core serve --desktop`，与 D-10「不得修改 `src/cli/main.js`」、D-13「命令表 / `USAGE_LINES` 冻结」互斥；源码事实 `src/cli/main.js:68` `COMMANDS`、`:207` `core: ['stop']`、`:333` 子命令校验决定了不改 main.js 就不存在 `core serve`。
- **依据**：桌面通道属新增能力，不必借用 CLI 命令面；`src/daemon/serve-entry.js` 真实存在。
- **决定**：走「方案二」——桌面入口为 `node src/daemon/serve-entry.js --project <root> --desktop`（等价 `createServer({ http: true })`），**不触碰** `src/cli/main.js` 命令表、两层子命令表与 `USAGE_LINES`；D-11 授权断言修改清单保持「无」。
- **影响面**：附录 D-1/D-10/D-11/D-13 已重写一致（v2）；S2 WP 拆分时 daemon 桌面通道挂 `serve-entry.js`，CLI 零改动。

## 裁决 B（S0 round1 → 修复）｜F-14 AC-29 自带运行时

- **触发点**：round1 F-14（建议）。v1 把「自带 Node 运行时 + 收窄 PATH 启动」写进 AC 判定，属把实现方案升格为验收条件。
- **依据**：基线 §1.3 只要求「阶段一必须交付可双击启动的桌面应用」；模板硬约束 2（第三部分只写用户可见）。
- **决定**：AC-29 的 Then 保持用户视角（未预装 Node、未配置环境变量的机器上双击即可用）；实现细节收进附录 D-14 并注明不进验收判定。
- **影响面**：S1 拆分前必须先做**最短打包验证**（解释器 + `bin/` + `src/` 能否进 app bundle，见 round2 ⑥-1）；若两条实现路径都落不进 bundle，回来改需求，不许在实现里悄悄消化。

## 裁决 C（S0 round2 PASS 后）｜U-9 `graph.json` 不落盘豁免

- **触发点**：round2 ⑥-2 提请主控确认。
- **依据**：基线 §5.2 数据布局不含 `instances/<id>/graph.json`；图是 `state.json` + 事件链的**只读投影**，按需即时生成，落盘反而引入与 `rev` 一致性的第二个事实源；`.orch/desktop.json` / `.orch/desktop/views/` / `.orch/desktop/projects.json` 已在需求 §1.3 与附录 B 登记。
- **决定**：**豁免成立**——本迭代不新增 `instances/<id>/graph.json` 落盘；图投影只在内存/响应体中存在。若后续迭代需要落盘（如崩溃恢复视图），走需求修订。
- **影响面**：S1 拆分文档 §3（数据模型）按此写；实现不得私改数据布局。

## 裁决 D（S0 round2 PASS 后）｜F-15~F-19（5 条建议级）处置

- **触发点**：round2 总判 PASS（阻断 0 / 建议 5）。
- **依据**：S0 Gate 只要求阻断清零；F-15~F-19 均为编辑一致性 / 机检形态加固类，不改变 AC 判定强度。
- **决定**：随 **S1 拆分消化**，不在 S0 再开一轮修订循环：
  - F-16（`test -f` 内联）→ 固化进 S3 验收脚手架的机检模板（round2 ⑥-3 的「固化进验收脚本」一并落实）；
  - F-17（「正在连接守护进程…」瞬态）/ F-18（BR-06 2 秒断言）/ F-19（AC-33 可比对集）→ 拆分文档 §8「与需求的对齐声明」必须逐条给落点；若拆分评审认为需补 AC，按 §1.2「只能补」走需求修订；
  - F-15（判定口径标题计数）→ 拆分阶段顺手修正（属笔误类，模板 §1.2 允许）。
- **影响面**：S1 拆分评审必须核对本条落点；S3 验收 Agent 必须执行固化后的机检模板。

## 环境事实更正（供 S1 选型）

- `docs/index.md` 698 行「Tauri 需 Rust/MSVC（本机没有、只能 CI 构建）」是 **Windows 机器的旧结论**。当前开发机为 macOS 26.6.2 (x86_64)：`rustc/cargo 1.98.1` 可用、Xcode 就位、npm 10.9.7（registry npmmirror）。Tauri 本机可构建；Electron 路线在本机反而需要镜像。S1 选型按当前机器事实重判，不受 698 行预判约束。

## 核查记录（S0 收口前，主控实跑）- **registry 四类 `node_type` 前提成立**（需求理解纪要 §5 黄色警示 2 解除）：`src/cli/labels.js:552` `WORKFLOW_NODE_TYPE_INVALID` 明示合法取值 `role / human / escalate / subworkflow`；`src/cli/workflows.js` 已有 `node_type` 透传（:170/:515）、`subworkflow` 带 `workflow` 引用（:180/:223）、`human` 出边条件校验（`humanCondition` :61/:578）、`escalate` 禁正向出边（`escalateOutbound` :60/:577）。AC-07/13/14/26 的夹具 yaml 可以直接用四类节点构造，**无需改 registry/校验器**（与 D-13 冻结一致）。
- **DoR 机械扫描全绿**（v2）：头部版本=附录 C 末行=v2；37 AC 连续、三件套与 Then 零缺、锚点零缺；32 BR 连续、双向覆盖零悬空；purity 完整词表命令出现 2 处；`deny` 0 次 / `reject` 5 次（无同义混用）。
- **基线数字记录**（DoR 9）：I1.9 收口基线 = `70277df` 后 **1157 tests / 8 条已知失败 / 失败集合差集 = 0**；本迭代全量判定沿用「差集 = 0」口径，不以零失败为判据。

## 裁决 E（S2 批次 1）｜WP-7 键表落位

- **触发点**：拆分 r2 WP-7 契约写「`src/cli/labels.js` 末尾追加 DESKTOP_* 键」，主控任务书又禁改 cli 侧——两处冲突，实现 Agent 按 D-10 授权清单落 `src/daemon/http/labels.js` 并上报待裁决。
- **依据**：需求 D-10 授权新增文件本就含 `src/daemon/http/labels.js`；D-13 冻结 cli 侧；拆分 C-03 许可 daemon 只读 import CLI 文案模块做同源平铺。daemon 单文件方案两全，且冻结测试（键集合精确相等 + 占位符纪律 + 附录 A 逐字）不需改断言逻辑。
- **决定**：**采纳 daemon 侧单文件方案**（`e4f22d0` 现状）：新增 61 键（`DESKTOP_*`）落 `src/daemon/http/labels.js`，复用 83 键经只读 import 平铺下发；`src/cli/labels.js` 零改动。若后续评审要求中文物理回归 cli 侧，只需搬运键值、键名零变化。
- **影响面**：下游 WP-2/3/8 经 `labelKeysPayload()` 取键；平铺键名口径（`表名_成员名`）为冻结契约，见批次 1 回执 ⑥。

## 裁决 F（S2 批次 1）｜并行跑全量的失败集合归因口径

- **触发点**：批次 1 两包并行期间全量出现 9~14 条超基线失败（两包互相看到对方在途测试文件 + 本机负载抖动），逐文件复跑全绿。
- **依据**：I1.9 L-1 已证明本机并行全量有负载型 flake；失败集合差集 = 0 口径必须以**串行单跑**为准。
- **决定**：批次评审与 S3 验收的全量判定一律**串行单跑**（不开并行任务）；任何超基线失败先单独复跑所属文件再归因，不许直接计入差集。
- **影响面**：所有批次门禁与 S3 脚手架照此执行。

## 裁决 G（S2 批次 1 评审后）｜labels-route.js 越权 + 键名两处偏差

- **触发点**：批次 1 评审 B-01（阻断）/ B-03 / B-04（建议）。
- **B-01 决定**：删除 `src/daemon/http/labels-route.js`（不在 D-10 授权文件集 `{server,routes,stream,labels}.js` 内）；其 40 行路由组装（`createLabelsRoute` / `respondUiLabels` / `UI_LABELS_PATH`）**并入** `src/daemon/http/labels.js`（授权文件）。WP-2 接 `handler 表` 时直接消费 `labels.js` 导出，不改形状。
- **B-03 决定**：按需求附录 A-14 口径，看板列名拆为 7 个独立键 `DESKTOP_BOARD_COLUMN_*`（废除 `DESKTOP_BOARD_COLUMNS` 单键），文案逐字不变；冻结测试期望清单同步。
- **B-04 决定**：A-2 空态/不可读两行，A-14 写「复用既有键」但既有键不存在——**保留实现新造的两键**（值与 A-2 基线逐字一致），登记为对 A-14 的补充而非偏差；不回改需求（值无变化，输出基线不受影响）。
- **影响面**：键全集总数由 144 变为 144−1+7=150（去掉 COLUMNS、加 7 列键，空态两键维持）；冻结测试键集合断言随之更新；WP-5/WP-3 消费时按新键名取值。

> **更正（主控取证）**：B-03 系评审误读——`git show e4f22d0:src/daemon/http/labels.js` L95–101 证明原始提交**已是 7 个** `DESKTOP_BOARD_COLUMN_*` 键，键名后缀 `BLOCKED/READY/RUNNING/REVIEW/DONE/FAILED/ESCALATED`、值与 A-12 七列（被阻塞/可调度/执行中/待校验/已完成/失败/已升级）逐字对应，不存在 `DESKTOP_BOARD_COLUMNS` 单键。上文「144→150」算术作废：**键总数维持 144**，B-03 零键改动；裁决 G 中仍成立的只有 B-01（labels-route.js 并入 labels.js）与 B-04（空态两键保留）。


## 裁决 H（S2 批次 3）｜503 接缝演进 + AC-21 口径 + SSE 首帧

- **触发点**：WP-3（`5b5640c`）routes.js 落地后，批次 2 的 `test/wp13/http-channel.test.js` 中「WP-3 路由降级 503 NOT_READY」断言确定性失效；WP-5（`baf23f8`）报告 AC-21 锚点与附录 D-4 口径互斥；WP-3 报告 `handleListStream` 无首帧/未 flushHeaders。
- **503 接管授权（依需求附录 D-11 条款）**：授权修改 `test/wp13/http-channel.test.js` 的 NOT_READY 断言段（只改该断言与其期望值，不动其它用例）——routes.js 经 `registerRoutes` 注入后接管 503 路径是拆分 §2.1/S-02 的**设计意图**，非回归。修改后差集口径恢复。
- **AC-21 口径**：按裁决优先级「AC 的 Then > 附录 D 实现约束」，以 AC-21 锚点原文为准（可见恰 `[B,C,D]`，A、E 隐藏）；WP-5 实现的 `⌊hops/2⌋` 深度窗口**维持**，不改。
- **SSE 首帧（WP-2 `stream.js`）**：登记为整合期观察项——消费方已适配，不阻断批次 3 收口；WP-9 批次 6 整合与 S3 验收时评估是否补 `flushHeaders`/首帧（属 WP-2 文件，届时按 D-11 条款另行授权）。
- **影响面**：批次 3 评审以「503 断言已授权修改」为前提核差集；AC-21 不再是评审争议点。


## 裁决 I（S2 批次 3 评审后 B-07~B-15 处置）

批次 3 评审 **PASS**（阻断 0 / 建议 9）。逐条处置如下。

- **B-07（修）**：`desktop/ui/graph/legend.js` 的 `renderLegend` 入参与 JSDoc 不一致（写「`/ui/labels` payload 可直传」，实际只吃平铺键表）。改为**两种形状都接受**（`{keys:{...}}` 或平铺表），并修正 JSDoc——批 4 补 legend 段时不允许静默产 `lines:[null,null]`。
- **B-08（后移）**：AC-32 的 `deriveHealthReasonVars` 缺端到端断言，并入批 6（WP-9）整合与 S3 取证，不在本批返工。
- **B-09（修）**：裁决 H 授权改写的 503 用例，形态一须显式恢复「`startRun` 零调用」断言；同时在注释里注明该形态生产不可达（仅作降级语义守护），不删形态二。
- **B-10（修，契约偏差）**：`POST /instances` 成功体按 D-2 逐字改为 **`{instanceId}`**（现为 `{ok:true, instanceId}`），同步改 `test/wp13` 里断言该体的用例。
- **B-11（不改，登记）**：`layout.js` 同层排序用数组下标。AC-17 锚点是「按声明顺序」，数组下标即声明顺序，`order` 字段非契约要求 → 非缺陷，登记备查。
- **B-12（修，边界）**：`desktop/harness/board-dump.mjs` 直连 `src/daemon/http/labels.js` 违反 D-9「harness 均只 import `desktop/ui` 的纯模块」。改为从 `payload.labels` 或 `--labels <file>` 取键表，缺失即报错退出。
- **B-13（口径）**：验收期 `grep -Rn "startRun" desktop/` 会被 `desktop/src-tauri/target/**` 构建产物打红（源码侧零命中）。S3 机械检查一律加 `--exclude-dir=target`，本条写入验收口径。
- **B-14 / B-15（后移）**：AC-06 缺产物行端到端、AC-22 写入端 `config.rs` 零测试 → 并入批 6 整合与 S3 取证（真实壳链路由 WP-9 覆盖）。
- **门禁基线（复核锁定）**：串行 `--test-concurrency=1` 全量 = **1291 tests / 1286 pass / 4 fail**（主控实测），失败集合 ⊂ 基线 8 条，差集 = 0。评审复跑得 6 fail 亦全 ∈ 基线（含 2 条负载型，单跑已归因）。**默认并发并发跑必假 flake（实测 12 fail），不作为判定依据。**


## 裁决 J（S2 批次 4）｜graph-dump 全量导出检查点授权

- **依据**：拆分 r2 S-03 已定 `graph-dump.mjs` 分阶段交付——`legend` 段由 WP-5 `legend.js`（已落 `baf23f8`/`e76f111`）、`hover` 段由 WP-6 `highlight.js`（本批）补齐，经**惰性动态 import** 接入，不计入 DAG 边。
- **授权**：批 4 允许对 `desktop/harness/graph-dump.mjs` 做**仅限**「补全 legend/hover 两段」的最小改动（`await import('../ui/graph/legend.js')` / `await import('../ui/graph/highlight.js')`，缺文件时该段仍为 `null` 且不抛错）。除此之外该文件零改动。
- **校验**：批 4 检查点必须实跑 `node desktop/harness/graph-dump.mjs --project <tmp-root> --instance <id> --payload <out>.json` 后断言 `legend.lines` 为长度 2 的字符串数组、`hover` 段由 `hoverSet` 产出且非空（含 `opaqueIds`/`dimIds`）。
- **影响面**：批 4 的 WP-6 文件集合仍为 12 个；`graph-dump.mjs` 记入「检查点授权改动」而非 WP-6 交付清单（与 C-08 同类登记）。


## 裁决 K（S2 批次 4 评审后）｜AC-19 组名来源 + B-16~B-21 处置

批次 4 评审 **FAIL**（阻断 1 / 建议 5）。阻断为**需求缺口**而非实现错误：AC-19 Then 要求组节点逐字「分组 编码工程 · 8 角色」「分组 研究分析 · 5 角色」，但 A-14 只登记了模板键 `DESKTOP_GROUP_ROW`，144 键表里没有任何组显示名；`src/registry/role-schema.js` 的 `GROUPS` 仅英文枚举（`coordinator/research/writing/coding/ops`），夹具无法自写中文。测试自造 `GROUP_LABEL_*` 键属自证，必须清掉。

- **B-16（修，阻断）｜组显示名以「A-14 补充」下发**（依 B-04 先例，不回改需求正文）：
  - `src/daemon/http/labels.js` 追加 3 键——`GROUP_LABEL_CODING='编码工程'`、`GROUP_LABEL_RESEARCH='研究分析'`、`GROUP_LABEL_UNGROUPED='未分组'`；**键总数 144 → 147**，`test/wp13/labels-desktop.test.js` 的精确集合断言同步。
  - 只登记 AC 文本已给出的两个组名 + 未分组兜底；`coordinator/writing/ops` **不臆造中文名**，渲染层回退原始 group id（登记为已知限制，后续迭代补名时零结构改动）。取此策略的另一硬约束：`coordinator` 在 31 词禁词表内，若为它建键会让 `src/daemon` 扫描报红。
  - `node-rows.js` 的 `groupNameOf` 改为查 `GROUP_LABEL_<UPPER(group)>` → `GROUP_LABEL_UNGROUPED`（缺失 group）→ 原始 id。
- **B-17（修，建议）**：未分组桶显示改为逐字「分组 未分组 · 3 角色」，测试期望随改。
- **B-18（修，建议）**：`renderRoleRow` / `renderSpecialRow` / `renderEdgeRow` 与 `renderLegend` 统一——键表入参**两种形状都接受**（`{keys:{...}}` 或平铺表），缺键抛错而非静默 `null`；JSDoc 声明形状。
- **B-19（修，建议）**：`graph-dump.mjs` 的 `--payload` 分支允许 `--project` 作为标签源（读 `.orch/desktop.json` 走 `GET /ui/labels`），并在用法注释里写明「无标签源时 `legend/hover` 保持 `null`」。
- **B-20（修，建议）**：`abnormal-style.test.js` 补 AC-23 的 `visual.badge === 'escalated'` 断言，凑齐锚点四项。
- **B-21（修，建议）**：`collapse.js` 的 `buildView` 对 `node.type === 'subworkflow'` 归一 `collapsed: true`，并用 `collapsed:false` 输入反向断言（防投影漂移时静默画成展开）。
- **影响面**：本批修复涉及 `src/daemon/http/labels.js`、`test/wp13/labels-desktop.test.js`（WP-7 文件，D-10 授权清单内）+ WP-6 的 `node-rows.js`/`edge-rows.js`/`collapse.js`/`graph-dump.mjs` + 相关 wp13 测试。修复后重评批次 4 再进批 5。

> **补充授权（裁决 K 执行时追认）**：B-16 把键总数改为 147，使 `test/wp13/http-channel.test.js` 对 `/ui/labels` 的 144 硬断言必然失败；修复时连带改了该文件 **1 个断言 + 2 处注释**（`aca57d6`）。主控**追认**此改动（属键集变更的直接派生，非新改动面），并要求重评时按「144→147 的连带更新」核对，不计越权。


## 裁决 L（S2 批次 4 复评后）｜R-01 / R-02 处置

批次 4 复评 **PASS**（阻断 0 / 建议 2），B-16~B-21 六项闭合（B-19 部分闭合：`--payload` 分支已支持 `--project` 标签源，但 `emit` 的合并顺序会让输入里显式 `legend:null/hover:null` 覆盖新值）。

- **R-01（后移，批 6 必修）**：`desktop/harness/graph-dump.mjs` 的 `emit({...segments, ...source})` 合并顺序反了——二次导出仍得 `null`。S-03 要求「批 4 起全量导出」，因此**必须在批 6（WP-9）留档前修**并补一条「输入显式 null 时仍被补齐」的断言；不在批 4 返工。
- **R-02（不改，登记）**：`node-rows.js` / `edge-rows.js` 各有一份 `requireLabelTable`/`textOf`，建议下沉 `labels/labels.js`。行为一致、无契约影响 → 登记为后续重构项，WP-8 直接用各模块导出，不做下沉。
- **门禁基线更新**：串行全量 **1328 tests / 1321~1322 pass / 5~6 fail / 1 skip**，5~6 条全部 ⊂ 基线 8 条（含 2 条 NFR-02 负载型，单跑通过），差集 = 0。


## 裁决 M（S2 批次 5）｜B-25 / 批次 2 B-05 WebView 凭据送达

- **事实**：`desktop/src-tauri/src/spawn.rs:177` 导航裸 `http://127.0.0.1:<port>/ui/`，而 `src/daemon/http/server.js:322` 对**所有**请求强制 `Authorization: Bearer`；WebView 导航无法带自定义头 → 真实窗口必 401（B-05 自批次 2 挂起）。
- **决定（方案 b）**：`GET` 且**将被解析为 `staticRoot` 内真实静态文件**的请求，允许以 `?token=<token>` 作为 Bearer 的等价凭据；其余一切接口（含 `/ui/labels`、REST、SSE）**只认 Bearer**，query token 一律 401。壳侧导航改为 `http://127.0.0.1:<port>/ui/?token=<token>`；页面启动时从 `location.search` 取 token 存内存（不落 localStorage/sessionStorage）并 `history.replaceState` 抹除 query。
- **理由**：不放松任何数据面鉴权；静态资源本身无秘密；token 不出现在任何日志（daemon 不记请求行）。init-script 注入方案（不把 token 放 URL）登记为后续加固项，本迭代不做（Tauri 需改窗口创建方式，超出 WP-1 冻结面）。
- **影响文件**：`src/daemon/http/server.js`（鉴权分支）、`desktop/src-tauri/src/spawn.rs`（导航 URL）、`desktop/ui/app.js`（bootstrap）、`test/wp13/http-channel.test.js`（三态断言：静态+query token 200 / 静态无凭据 401 / `/ui/labels` 带 query token 仍 401）。

## 裁决 N（S2 批次 5）｜B-24 装配层几何重复

- **决定**：删除 `app.js` 的 `ARC_LIFT` 导入与本地二次贝塞尔公式；弧线控制点改由 `layout.js` 已返回的 `placed.path.ctrl` 经**同一屏幕变换**（与节点坐标同一 `zoom/pan` 线性变换）得到。装配层只做坐标变换，不做几何构造。
- **依据**：拆分 §4 WP-8 门禁附加「装配层不新增渲染逻辑」+ 需求 §3.1 判定口径 1。

## 裁决 O（S2 批次 5）｜B-26 看板输入形状（数据面缺口）

- **事实**：看板 7 列需要节点 9 态（`pending/running/done/failed/escalated/cancelled…`），而图投影只给角色五 token；装配层把角色 status 喂 `projectBoard` → 全落 `unknown → blocked`。
- **决定**：图 payload 增 `stateNodes: [{nodeId, state}]`（**D-2 补充**，不改既有字段），由 `src/daemon/graph.js` 从快照 `state.nodes` 投影（纯数据搬运，不新增计算）；装配层 `projectBoard({state:{nodes: payload.stateNodes}})`。缺 `stateNodes` 时按现状降级（不抛错）。
- **影响文件**：`src/daemon/graph.js`、`test/wp13/graph-projection.test.js`、`desktop/ui/app.js`。
- **理由**：不允许 UI 伪造 `state.nodes`（评审明确反对）；harness 面已能通过，窗口面必须同源。

## 裁决 P（S2 批次 5）｜B-27~B-32 处置

- **B-27（修）**：`app.js` 的本地 `fill()` 删除，统一用 `labels/labels.js` 的 `fillTemplate`。
- **B-28（修）**：节点描边改取 `node.visual.statusColor`（A-9 五 token），`abnormal` 只负责角标与脉冲。
- **B-29（修）**：`app.js` 注入 `fromTitle/toTitle` 时，节点 `type === 'group'` 走组名解析（复用 `GROUP_LABEL_*` 键），不改 `collapse.js`。
- **B-30（修）**：流正常 EOF（`'closed'`）与 `'error'` 同路径（`disconnect()` + `scheduleReconnect()`），保留主动 `destroy()` 的区分。
- **B-31（修）**：`errors.test.js` 补三条接缝用例——SSE 原文（`event: graph.snapshot\ndata: {...}`）解析到 `setGraph`；`invoke('write_view_command')` 实参形状；重开实例读回偏移。
- **B-32（修）**：删除 `app.js` 末尾多余空行（`git show --check` 必须 exit 0）。


## 裁决 Q（S2 批次 5 收口）｜project root 送达 + stateNodes 绑定字段

批次 5 修复后仍有两个 S3 必踩缺口（由修复 Agent 主动上报，非评审项）：

- **Q-1（project root 未送达，阻断窗口面）**：`desktop/ui/index.html` 只从 `window.__MAESTRO_DESKTOP__` 取 project，而壳侧对该全局零命中；`spawn.rs` 的 B-25 修复只带 `?token=` → 窗口内 `project.root === null`，`persistOffsets/readOffsets` 全 no-op，AC-22/AC-31 窗口面不可验收。
  **决定**：壳侧导航 URL 追加 `&project=<urlencoded 项目根>`（用 `tauri::Url::query_pairs_mut().append_pair` 自动编码，不手拼）；`takeLocationCredentials()` 一并捕获 `project` 并在 `history.replaceState` 里抹除；`mountApp` 的 `project` 优先级 = 显式入参 > 注入全局 > 查询参数。不改 `__MAESTRO_DESKTOP__` 全局的既有约定（作为备用通道保留）。
- **Q-2（stateNodes 缺绑定字段，看板列退化）**：`board.js` 的 `displayIndex` 用 `snapshotNodes[].roleId` 把显示节点绑到快照节点（`board.js:87`）；`graph.js` 的 `stateNodes` 只投影 `{nodeId,state}` → 角色卡无法绑定、`pending` 的 gating 退化为全 `ready`，AC-24/35 与 harness 面不一致。
  **决定**：`graph.js` 的 `stateNodes` 每项改为 `{nodeId, roleId, state}`（`roleId` 取快照节点的 `roleId`，缺失为 `null`；仍是纯搬运）；`graph-projection.test.js` 同步断言。
- **影响文件**：`desktop/src-tauri/src/spawn.rs`、`desktop/ui/app.js`、`desktop/ui/index.html`、`src/daemon/graph.js`、`test/wp13/graph-projection.test.js`、`test/wp13/errors.test.js`（补 project 注入用例）。


## 裁决 R（S2 批次 5 复评后）｜R-03 静态子资源 401：改静态面免鉴权

- **触发点**：批次 5 复评 R-03（阻断）。裁决 M 的 `?token=` 只作用于**顶层文档**请求；`index.html` 的 `import './app.js'` 解析为不带 query 的 `/ui/app.js` → 401 → 模块图不加载、页面白屏。即「凭据随 URL 走一跳」的方案在 ES module 子资源上不成立。
- **决定（改为静态面整体免鉴权）**：
  1. `GET` 且解析为 `staticRoot` 内**真实文件**、且**未被 handler 表认领**的请求，**无需任何凭据**（含 `/ui/app.js`、`/ui/**` 全部静态资源）。这是对 D-1「所有请求强制 Bearer」的**显式例外**，理由：静态资源是界面代码、零实例数据、零秘密；安全边界在数据面。
  2. 数据面**完全不动**：`/ui/labels`、REST、SSE 仍只认 `Authorization: Bearer`；无凭据/错凭据一律 401（`/ui/labels?token=` 也必须 401）。
  3. `?token=` 仍被接受（壳导航继续带），由页面读入内存；**放宽 M 的存储禁令**：token 允许写入 `sessionStorage` 单键（`maestro.desktop.token`），用于页面 reload / 重新导航后恢复；**禁止** `localStorage`、禁止打印、地址栏仍 `replaceState` 抹除。
- **R-06（同批必修）**：窗口内无 project root 时必须渲染 project 提示页（`DESKTOP_PROJECT_MISSING` / `DESKTOP_PROJECT_INVALID`），不许停在列表空态（AC-31 窗口面）。
- **R-04（随 1.2 闭合）**：`sessionStorage` 恢复后 reload 不再丢凭据。
- **R-05 / R-07 / R-08（登记，不修）**：`claimedByHandler` 的 `fallbackDispatcher` 兜底在未来整路径 dispatcher 下会误伤 static query（当前无此用法）；`closed→reconnect` 缺 DOM 级用例（静态判定已覆盖）；`AC-04` 时序竞态在批次前快照 `aca57d6` 上同样失败，**登记为已知基线项**（失败集合扩为 9 条）。
- **影响文件**：`src/daemon/http/server.js`、`desktop/ui/app.js`、`test/wp13/http-channel.test.js`、`test/wp13/errors.test.js`。

> **R-09 / R-10 已修（`799b792`）**：token 来源优先级改为 `query > sessionStorage > 注入全局 > 内存缓存`（注入源回退恢复）；project root 同样落 `maestro.desktop.project` 单键，重载后不再退化成「项目 未指定」提示页。新增两条用例（`errors.test.js` 24 条全绿）。


## 裁决 S（S2 批次 6）｜AC-26 探针链补齐 + bundle 时效

- **事实**：AC-26 机检原文要求「探针 `ready → rows → graph-shown(nodes=..., edges=..., dangling=0) → closed(visible=false)`」。当前壳只发 `ready` / `close-window` / `tray-still-present` / `graph-shown`（**不带计数**），且 `desktop/ui/app.js` 的 `buildGraphShownProbe` 写入 `window.__MAESTRO_PROBE__` —— 全仓无 Rust 侧读取，属死代码。B-34：`Maestro.app` 构建于 11-13 02:15，早于 WP-6/8 与裁决 Q/R，包内 `Resources/desktop/ui` 缺失、`server.js` 只认 Bearer。
- **B-33 决定（补桥接，不改渲染归属）**：
  1. 壳新增 Tauri 命令 `probe_emit`（入参 JSON 字符串，追加一行到 `--probe` 文件；未传 `--probe` 时静默 no-op），注册进 `invoke_handler`；
  2. `desktop/ui/app.js` 在**列表渲染完成后**发 `{event:'rows', rows:[...]}`、在**图渲染完成后**发 `{event:'graph-shown', instanceId, nodes, edges, dangling}`（复用既有 `buildGraphShownProbe` 形状，dangling 由边端点缺席计算）；只有在 `window.__TAURI__?.core?.invoke` 可用时调用（能力探测，不是测试分支）；
  3. 行文本仍由 `desktop/ui/list` 纯模块产出，壳不重算——探针只记录，不渲染。
- **B-34 决定**：S3 前**必须**执行 `npm run desktop:build` 重建，并在 `acceptance-e2e.test.js`/`regression.test.js` 增加**产物时效断言**：包内存在 `Contents/Resources/desktop/ui/index.html`、`Contents/Resources/src/daemon/http/server.js` 含静态面免鉴权标记；壳面用例的 skip 条件改为「产物缺失**或**产物不含 UI 资源」，并在 skip 消息里写明需重建。
- **B-35~B-40 处置**：B-35（壳面用例改为**只启动壳**、断言 `ready.daemon.pid > 0` 且与关窗后同 pid）、B-37（补 `/instances/:id/graph/stream` 401）、B-38（`regression.test.js` 记录条数与差集口径，不递归跑全量）、B-39（基线清单扩为 9 条含 AC-04）、B-40（skip 判定含产物时效）→ **本批修**；B-36（真实拖拽）→ 登记，S3 用窗口级自动化或接受结构断言并注明。
- **影响文件**：`desktop/src-tauri/src/{probe.rs,main.rs,spawn.rs}`、`desktop/ui/app.js`、`test/wp13/{acceptance-e2e,readonly-local,regression}.test.js`。


## 裁决 T（S2 批次 6 收口）｜429 中断后半成品处置 + B-33 真实链路实现口径

- **429 现场**：派发「裁决 S 收口修复 Agent」时平台返回 429，工作区只留下 `desktop/src-tauri/src/probe.rs` 的**未提交半成品**（新增 `probe_emit`，另有三段无人调用的 dead code：`eval_in_window`/`ctl_refresh_list`/`ctl_open_instance`），`main.rs` 未注册、`app.js` 未发事件、三个测试未改。主控改为主控直接实现，**保留 probe_emit、清掉 dead code**，半成品不作独立提交。
- **授权扩展（裁决 S 清单外）**：`desktop/src-tauri/src/tray.rs` 允许四处最小改动——① `handle_open_instance` 删除合成的**不带计数** `graph-shown`，改发 `graph-open-request` 并 `win.eval` 请求窗口打开实例；② `tray-open` 分支 eval `refresh-list`；③ `close_to_tray` 补一条 `closed`（`window.visible=false`），与既有 `close-window`/`tray-still-present` 并存；④ 不改 quit 流程。理由：AC-26 锚点逐字要求 `ready → rows → graph-shown(...) → closed(visible=false)`，合成事件会掩盖真实窗口链路。
- **时序硬事实（主控实测）**：空根预置 `INST-001/state.json` 再起 `serve-entry --desktop`，`desktop.json` 正常落盘但 **state.json 被 boot 对账改写**（前后字节不等）。因此 B-35 的「只启动壳」不能沿用「启动前写夹具」铁序；改为：**壳启动 → `ready`（`daemon.pid>0`）→ 写夹具 → ctl `tray-open` 触发窗口 `refresh-list` → 探针 `rows` 两行 → ctl `open-instance` → 探针 `graph-shown` 带计数**。窗口侧 `app.js` 注册 `__MAESTRO_CTL__`（能力探测，非测试分支）。
- **产物时效标记**：`src/daemon/http/server.js:9` 注释串 `decision R` / `the static face is public`；B-40 的 skip 判定 = `SHELL` 不存在、或包内缺 `Resources/desktop/ui/index.html`、或包内 `server.js` 不含该标记。
- **B-39 口径**：历史 `docs/iterations/iteration-7/baseline-failures.txt` 仍为 8 条（D-13 冻结，不改文件）；`regression.test.js` 断言「物理 8 条 + R-08 允许的 AC-04 一项」= 判定口径 **9 条**，并在说明里写清，不伪造全量结果。
- **B-38**：新增「测试文件数 ≥ 1157 条基线」的**结构性断言**（统计 `test/**/*.test.js` 的 `test(` 总数），不递归跑全量。


## 裁决 U（S2 收口）｜迭代文档与 Rust 依赖树入库

- **触发点**：进度汇报时核证发现 `docs/iterations/iteration-10a/` 下仅 `wp1-bundle-verdict.md` 入库，需求 v2 / 拆分 r2 / 理解纪要 / `decisions.md` / 16 份评审记录全部 `??` 未跟踪；批次 2 建议项 B-06 提出的 `desktop/src-tauri/Cargo.lock` 与 `gen/` 仍未处置。
- **决定**：① 本迭代全部文档（17 个 `.md`）统一入库，作为 S3 逐 AC 取证的判据链；② `desktop/src-tauri/Cargo.lock`（4999 行，应用仓库锁定依赖树）入库；③ `.gitignore` 追加 `desktop/src-tauri/gen/`（Tauri 生成的 ACL schemas，属构建派生产物，不入库）；④ `desktop/src-tauri/target/` 已由既有 `target/` 规则覆盖，保持忽略。
- **理由**：S3 验收需按 `requirement.md` 与 `decisions.md` 逐条复核，未入库文档会造成证据链断裂；Cargo.lock 保证 CI 与本机 release 构建可复现。不改任何产品代码语义。


## 裁决 V（S2 批次 6 实跑后）｜WebView → Tauri invoke 桥接缺失（B-33 二次阻断）

- **事实**：重建 bundle（`2026-11-14 11:48`，`env -u NODE_OPTIONS npm run desktop:build`，46s）后真跑 AC-26 壳面用例，探针文件只有壳侧事件 `launch / ready / tray-created / ctl-fired / tray-open × 20`，**窗口侧 `probe_emit` 零命中**。根因：`desktop/src-tauri/tauri.conf.json` 的 `app` 段没有 `"withGlobalTauri": true`，Tauri 2 默认不注入 `window.__TAURI__`；而 `desktop/ui/app.js` 的 `tauriInvoke()` 只认 `window.__TAURI__`，因此 `write_view_command` / `probe_emit` 在真实窗口里全部静默 no-op（这也是 B-14 所说 AC-22 写入端零测试的根因）。
- **决定**：① `tauri.conf.json` 的 `app` 段加 `"withGlobalTauri": true`（官方配置，注入 `window.__TAURI__.core.invoke`）；② `tauriInvoke()` 追加 `window.__TAURI_INTERNALS__?.invoke` 兼容通道（Tauri 2 内部 IPC，配置未生效时仍可用）；③ 不改 `probe_emit` 命令形状、不改事件语义。
- **授权扩展**：`desktop/src-tauri/tauri.conf.json`（裁决 S/T 清单外，一处配置键）。
- **构建口径**：桌面构建必须 `env -u NODE_OPTIONS npm run desktop:build`——平台注入的 `NODE_OPTIONS` safe-delete shim 会拦截 build.mjs 的 `fs.rmSync(APP)`（bulk-delete 62 > 阈值 50），首次重建因此 `BUILD_EXIT=1`，去掉注入后 46s 成功。
- **夹具修正（同批）**：`runCtl` 建立的是**目录**，清理 `.done` 必须 `fs.rmSync(..., { recursive: true, force: true })`，否则第二次 ctl 重试报 `EISDIR`。


## 裁决 W（S2 批次 6 实跑后）｜外部 http origin 无 Tauri IPC：改 HTTP 探针上报

- **诊断证据（主控实跑，诊断版 bundle）**：`ui-current-url` 探针显示 WebView 已在 `/ui/`（导航成功），但 `win.eval` 里的 `__TAURI__`/`__TAURI_INTERNALS__.invoke` 均不存在、`ctl-eval-reached` 零命中；包内静态面 `/ui/` `/ui/app.js` 200 且 `Content-Type: text/javascript`、`/ui/labels` 401；`tauri.conf.json` 加 `withGlobalTauri` 后仍零窗口事件。本地 `tauri-2.12.5` 源码 grep 确认 v2 已移除远程域 IPC 配置项（`manager/webview.rs` 的 init script 只对 app origin 生效）。
- **决定（接缝，不改渲染归属）**：窗口侧 `probe` 事件改走**双通道**——优先 Tauri invoke（app origin 场景），同时 `POST /__test__/window-probe`（仅 `NODE_ENV=test` 注册、Bearer 保护）；daemon 把事件原样 append 到 `<root>/.orch/window-probe.jsonl`；壳 `probe.rs` 起一个 100ms 轮询线程把新行**原样搬运**到 `--probe` 文件。事件内容仍由窗口渲染层产出（rows 文本来自 `desktop/ui/list`、graph-shown 计数来自 `buildGraphShownProbe`），壳不合成、不重算。
- **AC-27 边界**：新端点仅 `NODE_ENV=test` 存在，生产零注册；写的是验收探针产物，不触碰实例状态/事件链/追踪；`readonly-local` 用例不触发该端点，`.orch` 文件面断言不受影响。
- **授权面**：`src/daemon/http/server.js`（D-10 清单内）、`desktop/ui/app.js`、`desktop/src-tauri/src/{probe.rs,main.rs,tray.rs,spawn.rs}`、`test/wp13/acceptance-e2e.test.js`。诊断期的 `ui-navigate` / `ui-current-url` / `ctl-eval-reached` 三段临时代码在实现落地后删除。
