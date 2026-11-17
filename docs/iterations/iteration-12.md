# I1.12 任务拆分与文件级契约（治理加固 + 预算配额 + 生态能力 + 性能基线）

> 需求依据：`docs/iterations/iteration-12/requirement.md` **v2**（715 行，23 条 AC / 19 条 BR / 5 条 NF / 附录 A~D；round1 PASS、round2 PASS 阻断 0 / 建议 6）。**本拆分以定稿 v2 为唯一验收依据：不增 / 不删 / 不合并 AC，不放宽任何 Then，不把范围条目挪到范围外。**
> 上游基线：分支 `feat/i1.12-governance`，基线 HEAD `5406790`（S0 已 PASS）。I1.10b 51 AC + I1.9 27 AC 共 78 条只增不改；全量基线 `tests ≥ 1425`，允许集合 = `baseline-failures-win32.txt` 16 项 ∪ 已留帧 flake，差集 0。
> 裁决依据：`docs/iterations/iteration-12/decisions.md` **裁决 A**（命令名冻结 / AC-21 版本指代 / reason 码），效力高于需求正文自我声明。
> 评审与理解依据：`review-round2.md` §6 的 F2-01~F2-06（全部落 §7）、`requirement-understanding.md`（§6 逐 AC Given 可构造性、D-13 契约锚点、§9 五条移交注意）、`progress.md`（S0 收口要点）。
> 拆分自检口径：模板 `docs/templates/execution-template.md` §1.3（0~8 骨架）/ §1.4（四硬规则 + WP 五字段 + §4 末尾满覆盖表）/ §1.5（10 条自检）/ §1.6（可复制骨架）；格式样例 `docs/iterations/iteration-10b.md`。
> 契约优先级：`AC 的 Then / And > 附录 A 输出基线 > 附录 D 实现约束 > BR/NF > 规划文档 > 代码现状`。代码现状只用于核对签名与行段，不作需求来源（冲突一律进 §8）。
> **环境约束**：CWD 为 Windows（win32 tool-bash disabled），夹具一律用跨平台 `node "$MAESTRO_REPO/bin/orch.js" ...` 形态，**禁止硬编码 `bash` / `bash -c` 作为夹具执行器**；落盘一律用 write。

---

## 0. 迭代定位、范围与退出标准

**一句话目标**：把「看得见、点得进、能跳转」之后的「信得过、管得住、带得走、扛得住」补齐——事件日志能当场验篡改、越权唤醒与过期证据在路由层被拦下并留痕、高风险节点必须人工终审、审计只记该记的、并行与预算有上限且耗尽可恢复、包带依赖闭包导出并经签名与版本校验后导入、`orch migrate` 升级引用、日志与追踪导出为 OpenTelemetry、反模式有只读信号，并在 20 并发实例 / 50 活跃会话下给出可核对的 handoff 延迟（对齐需求 §1.2 第 10 行）。

**In scope**（逐条对应需求 §1.3「范围内」12 条，落位到 WP）：

| # | 范围条目（需求 §1.3 / 规划行） | 需求 §2 落点 | AC | 主责 WP | 协作 WP |
|---|---|---|---|---|---|
| 1 | 链式哈希审计加固（篡改检测 + 校验报告，衔接 I1.9 不重建链，规划 894） | §2.2 | AC-01、AC-02 | WP-1 | WP-7 |
| 2 | 路由层权限拦截（唤醒白名单决策点校验，拒绝并留痕，规划 895） | §2.3 | AC-03、AC-04 | WP-2 | WP-7 |
| 3 | 证据过期检测（指纹不一致拒交接，产出判定供 I1.11 消费，规划 896） | §2.4 | AC-05、AC-06 | WP-3 | WP-7 |
| 4 | 高风险节点人工终审（治理侧审计规则，不重做 UI，规划 897） | §2.5 | AC-07、AC-08 | WP-2 | WP-7 |
| 5 | 审计粒度规则（node/handoff 进主审计；connection/role/session 不单独审计，规划 898） | §2.6 | AC-09、AC-10 | WP-2 | WP-7 |
| 6 | 预算与配额（并行度上限排队；预算耗尽挂起可恢复，规划 899） | §2.7 | AC-11、AC-12 | WP-3 | WP-7 |
| 7 | 角色包 / 工作流包导出（含技能 / 派生父 / 子工作流闭包，规划 900） | §2.8 | AC-13 | WP-4 | WP-7 |
| 8 | 签名校验 + 版本兼容检查（先验后写，坏包不污染资产，规划 901） | §2.9 | AC-14、AC-15 | WP-4 | WP-7 |
| 9 | 版本迁移工具 `orch migrate`（列变更项 → 升级引用 → 可校验，规划 902） | §2.10 | AC-16、AC-17 | WP-4 | WP-7 |
| 10 | 可观测性导出（事件 / 追踪 → OpenTelemetry，只读，规划 903） | §2.11 | AC-18 | WP-5 | WP-7 |
| 11 | 反模式监控（文档瓶颈 / 串行化退化 / 确认偏误，只读提示，规划 904） | §2.12 | AC-19 | WP-5 | — |
| 12 | 性能基线（≥20 并发 / ≥50 会话 / handoff <2s，分级取证，规划 905） | §2.13 | AC-20、AC-21 | WP-6 | — |

边界回归 AC-22（回归红线）主责 WP-7，AC-23（与 I1.11 零交集）主责 WP-2、协作 WP-7；两条按 §4 映射表落位，**不新增范围条目**。

**Out of scope**（摘要，全表见需求 §1.3 第 62–71 行；本拆分不重排、不收窄）：

- **I1.11（并行迭代 `feat/i1.11-*`）**：通知托盘、人工干预队列界面、角色 / 技能 / 工作流库浏览、角色库运行时子视图、工作流画布、证据浏览独立视图、托盘交互。本迭代对证据过期与高风险终审**只产出治理侧判定结果**（AC-06/07/23），不定义任何 UI、按钮、文案位置或交互；实现文件与 I1.11 零交集（D-1 / AC-23 机检）。
- **真实宿主（本机 DSH 0.2.2-rc.1）性能取证**：留本机，证据级别 `已实测（真实宿主面）`；mock 面任何环境可做、标 `mock 实测`，不得互相顶替（§3.3 第 3 条 / AC-20/21 / U-01）。
- **链式哈希从零建链 / 其他链语义改写**：append-only、序号不复用、首条固定起点、每条带前序指纹由 I1.9 交付；本迭代只加校验命令与断点报告，不改格式、不重写历史、不重置起点（A-0 / AC-02 / D-2）。
- **I1.13 及以后**：`pending → expired` 交接包 TTL 自动过期及随之而来的升级（I1.9 需求 55/168 行已排除）；I2.4 Web 入口；I2.x 多宿主跳转；I3.3 多宿主治理一致性取证（index 992 行）——本迭代只在 DSH 单宿主口径落地、规则按宿主无关设计。
- **证据真实性的宿主侧执行**：宿主内核层单次文件写入拦截由宿主原生机制负责；核心只判引用存在、未过期、与声明产物一致。
- **桌面窗口内可视交互 / Web 入口 / 多宿主跳转**：按 I1.10a / I1.10b 既有口径登记人工核验，判据走纯模块与 CLI 可核对面。
- **规划外新能力**：不新增 12 子项之外的能力（自动修复篡改、自动回滚坏包、自动生成终审结论等），反向扫描无来源条目即视为夹带。

**本拆分明确不改的既有逐字基线**（D-1 / BR-19 / AC-22）：`test/templates/**`、`USAGE_LINES` 既有 25 行、`renderGraphJson` / `renderGraphText`、三条主链逐字输出、I1.9 / I1.10b 附录 A 文案键取值、78 条上游 AC 判据、`orchestrator.transit()` 唯一入口、事件先落盘再广播、`dependencies` 恒 `{}`。

**退出标准**（逐条可判定，含数字或逐字口径）：

1. **AC 23 条 100% 通过 / 0 不通过 / 0 阻塞**：AC-01~AC-23 每条 `**Then**` 均有对应机检 / 夹具 / 架构检查断言通过，证据按「AC 号 + 阶段 + 类型」落 `docs/iterations/iteration-12/evidence/`；唯一例外 **AC-21 真实宿主面未取证判 `阻塞`（不算失败）**，附本机试过路径，不得用 `mock 实测` 顶替、不得判伪通过（裁决 A 第 3 条 / 483 行契约 / 484 行阻塞出口锚点）；mock 面 AC-20 可先收口。
2. **AC → WP 满覆盖 23/23，差集 0**：§4 映射表每行恰好一个主责 WP，编号连续无缺号 / 重号 / 合并；WP 文件清单两两交集为空（脚本核验输出见返回 ④）。
3. **回归红线不破（裁决 G 三段式）**：全量 `NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"` 满足 `tests ≥ 1425` 且失败集合与允许集合（win32 16 项 ∪ 已登记 flake 留帧）**差集 = 0**；集合外新红先单文件独占复跑、留帧，仍失败判红；**不以某次绝对失败数作判据**。
4. **架构门禁 purity 0 命中**：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词全表>` 与 `--dirs desktop/ui,desktop/harness --forbid <31 词全表>` 均 `exit 0`（D-12）；新增中文只经 `src/cli/labels.js`，`desktop/ui/**` / `desktop/harness/**` CJK 零命中；`node -p "Object.keys(require('./package.json').dependencies||{}).length"` 输出 `0`。
5. **命令表与 USAGE_LINES 25 行**：`orch --help` 既有 25 行逐字不变；三新增命令以**独立用法块追加**（D-13 / 裁决 A 第 2 条）；顶层命令 `run/status/cancel/core/instance/attach/escalate/approve/handoff/workflow/trace` 与 `FAMILY_MODULES` 既有 `skill` / `workflow` 两条映射逐字不动；新增 `verify` / `migrate` / `export` 三条挂载、`RUNTIME_COMMANDS` 三条顶层命令。
6. **reason 码与状态词口径**：`REASON_LABEL` 追加 `wake.not-whitelisted`（`labels.js:388` 既有 `wake.rejected` 键值逐字不动，裁决 A 第 4 条）；预算耗尽状态词沿用 `suspended` / 已挂起（index §3.6），不新造第三种实例状态；判定结构按 D-4 / D-5 最小字段，不含任何视图字段。
7. **性能证据分级 100% 标注**：AC-20 报告级别为 `mock 实测`，AC-21 为 `已实测（真实宿主面）` 或 `待本机实测`（未取证 → 阻塞）；三值不混用，mock 结果不进入真实宿主达标判据；报告含逐档中位 / P95 / 最大与未达标瓶颈点（D-11）。
8. **I1.11 零交集（AC-23）**：`git diff --name-only <基线>..HEAD | grep -i "i1.11\|notify\|intervention\|evidence-view"` 零命中；判定结果结构含原因 + 关联节点、可被消费且无 UI 文案落入本迭代产物。

---

## 1. 技术选型（结论 + 被否决项）

### 1.1 链哈希校验：独立只读模块 `src/core/audit-verify.js`，不混进 appendEvent

**结论**：新增只读模块 `src/core/audit-verify.js`，`verifyChain({root, instanceId, fs})` 按 `seq` 升序遍历 `events.jsonl`，用与落盘同源的规范化指纹逐条重算并与前一条记录的规范化指纹比对，首条与 `ZERO_HASH`（64 个 0）比对；首处失配即返回 A-2 文案 + 失配序号 + 非 0 退出。事件总线 `event-bus.js` 仅新增导出 `ZERO_HASH` / `canonicalizeEvent` / `eventFingerprint`（镜像 `instance-store.js` 私有 `canonicalize` 口径），**不改** `appendEvent` 失败不广播、单实例串行化的既有段落（D-2 / D-13:708）。
**理由**：① AC-01 架构检查要求校验实现只读，`grep -REn "writeFile|appendFile|unlink" src/core/audit-verify.js` 对事件日志路径零命中；② 校验是「读 + 重算 + 比对」，与写入路径的职责相反，混进 `emit` 会让 AC-02 的「不重写历史、不重置起点」失去静态可证明性；③ `canonicalize` 在 `instance-store.js:53` 是私有函数（未导出），只读模块镜像实现 + 对拍测试是保持文件零交集与「只读基线不改」的唯一合规解。
**被否决**：
- **把校验塞进 `event-bus.js::emit` / `store.appendEvent`**：写路径每次发事件都全链重算，破坏单实例串行化与落盘先行纪律，且 AC-01「校验只读、不追加新事件」无法成立。
- **改 `instance-store.js` 导出 `canonicalize` / `hashRecord` 复用**：该文件不在 D-13 授权修改清单、属只读基线，改动会扩大授权面并触碰 78 条 AC 回归红线（见 §8 冲突 6）。

### 1.2 权限拦截：在唤醒决策点单点判定，不在路由层之外散落

**结论**：白名单判定收敛为纯函数 `src/core/governance.js::decideWake`，由 `src/core/orchestrator.js` 在**唤醒决策点**（构造交接包 → `session/prompt` 之前，现网锚点约 4435 行 `wake.rejected` 分支与 `advance.js::checkWakeGate`）调用一次；拒绝时复用 `src/core/escalation.js::commitEscalation` 既有 `pendingHandoff` 拒绝落库 + `emitMany` 审计模式（244–348 行），reason 由调用侧传 `wake.not-whitelisted`（D-3）。
**理由**：① AC-03 架构检查 `grep -REn "whitelist|allowWake" src/core` 有命中且被路由决策调用；② AC-04 架构检查要求 daemon 无 `if host == '...'` 分支、宿主层不做白名单判定；③ 单点判定才能让「越权漏拦 0、每次拒绝可追溯」成为可核对断言。
**被否决**：
- **在 adapter / daemon 多处各判一次**：散落分支必然产生判定漂移与重复审计，AC-04「拒绝审计恰 1 条」无法保证。
- **复用既有 `wake.rejected` 表达白名单拦截**：裁决 A 第 4 条明令既有 `wake.rejected`（`labels.js:388`）语义不动；新场景必须用冻结新码 `wake.not-whitelisted`（`wake.denied` 因冲突已否决）。
- **把工作流加载期 step 13 的静态 wake 校验（registry/workflows.js:594-604）当成运行时拦截**：它只在加载期校验边权限、不产出 reason 码事件，不能替代路由决策点判定（见 §8 冲突 8）。

### 1.3 证据过期：指纹一致性追加到既有校验链末尾，产出独立治理判定结构

**结论**：在 `src/core/handoff-schema.js::validateHandoff` 既有链（字段 → 边/目标 → 证据 → 回流完整性，D-13:707 点名 305–311 行）**末尾追加** `validateEvidenceFreshness` 步骤，用 `src/core/doc-artifact.js::sha256Of`（237 行）对声明产物重算指纹；返回 `{instanceId, handoffId, nodeId, stale, reason:'fingerprint_mismatch'|'evidence_missing'|'hash_unavailable'}`（D-4），拒绝走既有 `commitEscalation` 的 `pendingHandoff` 路径，不新增交接包状态。
**理由**：① D-4 明确「既有失败码与顺序不动」，追加步骤是唯一不破坏 I1.9 / 上游回归的落点；② 现状 `validateHandoffEvidence` 已含 `HANDOFF_HASH_MISMATCH`（handoff-schema.js:265-275，仅对 `source === 'previous'` 引用比对），本迭代的治理判定结构与它并存、由同一 WP 唯一负责，避免两套校验互相覆盖（见 §8 冲突 7）；③ 判定结构只供 I1.11 消费，不含视图字段（AC-06 / AC-23）。
**被否决**：
- **新建第二套交接校验器**：会与既有 `CODES` / 失败顺序冲突，破坏 AC-22 回归。
- **把判定写进 `state.json` / 新增交接包状态**：越界写编排状态，违反「只读 / 派生边界不放宽」（需求 §1.3 回归红线）。

### 1.4 包签名：Ed25519 + 本地分发公钥 + 先验后写原子导入

**结论**：新模块 `src/core/pack.js` 采用 Ed25519 对 `manifest` 签名、公钥随安装包本地分发（D-7 / U-02）；`verifyPackage` 先验签名再校验版本兼容区间 `[min,max]`，任一失败在**任何写操作前**返回；`importPackage` 临时目录校验通过后再原子落库，不覆盖同名资产、不留半安装（AC-14/15）。
**理由**：① BR-14「先验签名有效 + 版本兼容才写入」是硬门禁；② 非对称签名让「这包是谁给的」可核对，单纯校验和无法防篡改来源；③ D-7 明确 Ed25519 为建议方案且「若组织已有体系只改 D-7、不改 BR-14 判定」，选型可替换而不动用户需求。
**被否决**：
- **无签名只校验和**：产物被改动后重新计算校验和即可通过，AC-15「签名被改动即拒」无法判定。
- **对称 HMAC / 共享密钥**：无法区分来源真伪，且密钥分发等于公开，不满足「第三方包来源判断」。
- **先写后验 / 覆盖式导入**：AC-15 要求资产库前后一致、无半安装残留，直接否决。

### 1.5 OpenTelemetry 导出：独立 exporter 模块，不混进日志写入

**结论**：新增 `src/core/otel-export.js`，`exportOtel({events, spans, instanceId, out, fs})` 把 `traces.jsonl` 每个 span 映为 OTLP trace span、`events.jsonl` 每条映为 OTLP log record，资源属性带 `instanceId`；不可读行跳过并计数，导出前后对事件 / 追踪文件做 sha256 比对（AC-18 / D-9）。CLI 载体为冻结名 `orch export <类型>`，handler 挂载 `src/cli/otel.js::exportCommand`（D-13:704）。
**理由**：① AC-18 架构检查 `grep -REn "writeFile|appendFile" src/core/otel-export.js` 对事件 / 追踪路径零命中，必须独立只读模块；② 混进 `event-bus.emit` / `trace.appendSpan` 会污染写路径，违反「导出只读、不改状态、不追加审计」。
**被否决**：
- **在落盘时顺手写 OTLP 文件**：既破坏只读边界，又让导出前后哈希不变（AC-18 机检）失去意义。
- **推送远端 / 引入 OTel SDK 依赖**：`dependencies` 恒 `{}`（零第三方运行时依赖），本迭代只做本地文件导出（§2.11 边界说明）。

### 1.6 性能取证：mock 与真实宿主面分层，不以 mock 宣称达标

**结论**：新增 `src/core/perf-baseline.js` 统一采集口径（D-11：handoff 延迟 = 交接包进入 `delivered` 到目标会话首个 ACP 事件的墙钟耗时；中位 / P95 / 最大；并发 20 / 会话 ≥50），报告证据级别字段三值不混用；mock 面 fixture 用仓库内 `test/fixtures/mock-acp-agent.js`（实存 45957 字节）在任意环境采集，真实宿主面用只读探针 `probe/acc12-perf.mjs` 留本机取证，**未取证判 `阻塞`**（裁决 A 第 3 条 / 484 行阻塞出口锚点）。
**理由**：① 分派表 701 行明确 mock 任何环境可做、真实宿主留本机；② 三值分级是 AC-21「不得 mock 顶替、不得伪通过」的唯一可执行判据；③ mock 面先收口可解 U-01 取证窗口未定的阻塞（DoR-7 黄项，不阻塞开工）。
**被否决**：
- **只跑 mock 并宣称真实宿主达标**：AC-21 机检「mock 结果不出现在真实宿主达标判据中」直接判红，且违反裁决 A。
- **未取证判 `失败`**：需求明确「阻塞不算失败、伪通过才是」（§3.3 第 3 条），判失败会错误阻断收口。

### 1.7 治理判定模块拆分：`governance.js` + `budget.js` + handoff-schema 追加段

**结论**：D-1 建议的单一 `governance.js` 按能力拆为三处：`src/core/governance.js`（WP-2：白名单拦截 / 高风险终审 / 审计粒度裁决）、`src/core/budget.js`（WP-3：并行度 / 预算配额判定）、`src/core/handoff-schema.js` 追加段（WP-3：证据过期判定，D-4 点名）。三者均为纯判定函数，写路径由 orchestrator 既有 `transit()` 统一承担。
**理由**：① 模板 §1.4 硬规则 3「按能力切不按目录切」，单一治理模块会把 AC-03~12 全压进一个 WP，破坏「每 WP 一组可独立验证 AC」；② D-1 原文明说「具体文件划分由拆分文档定」；③ 三个判定各自有独立 Given 夹具与机检，可并行开发。
**被否决**：
- **所有治理判定塞进一个 `governance.js`**：文件只能有一个负责人，会导致 WP-2 / WP-3 文件重叠，违反硬规则 1。
- **每个判定一个模块（过度碎片化）**：白名单 / 终审 / 审计粒度共享「治理侧判定结构」与文案键，拆散后冻结点过多，联调成本大于收益。

### 1.8 大文件唯一负责人：命令表 / 事件链 / 编排器 / 文案表归 WP-7 单线接线

**结论**：4 个大文件 `src/cli/main.js`（1698 行）、`src/cli/labels.js`（882 行）、`src/core/orchestrator.js`（5247 行）、`src/core/escalation.js`（454 行）各指定**唯一负责人 WP-7**；`src/core/event-bus.js`（158 行）归 WP-1、`src/core/handoff-schema.js`（314 行）归 WP-3。所有能力 WP 只交付纯模块与包内契约测试，不改变这些大文件；WP-7 在 DAG 汇合前单线完成 D-13 全部钩子挂载。
**理由**：① 模板 §1.4 硬规则 1 点名 `main.js` / `labels.js` / `event-bus.js` 必须唯一负责人；② `orchestrator.js` 的唤醒决策点、validateHandoff 调用点（3099）、派发前门禁（1689/3190）分属不同 AC，若多包共改必然互相覆盖；③ 接线后置使能力包可先按冻结签名并行开发。
**被否决**：
- **各 WP 自己往 main.js / orchestrator.js 加一行**：文件零交集被破坏，与 I1.10b WP-4 单线负责 `app.js` 的已验证做法相反。
- **把接线拆成多个「小接线包」**：同一文件的多负责人等于没有负责人，D-13 授权段无法逐 WP 核对。

### 1.9 三命令共用 `verify` handler 按目标分派，不建第二套分派表

**结论**：按裁决 A 第 1 条，`verify` → `src/cli/verify.js::verifyCommand` **共用同一 handler**，按目标分派四种调用形态：`verify <实例>` → 链校验（WP-1）、`verify <包>` → 签名 / 版本校验（WP-4）、`verify import <包>` → 验后原子导入（WP-4）、`verify review <工作流>` → 高风险终审路径校验（WP-2）；`migrate` → `src/cli/migrate.js::migrateCommand`、`export` → `src/cli/otel.js::exportCommand` 各自独立。三者只在 `FAMILY_MODULES` 追加三条挂载（D-13:704），既有 `skill` / `workflow` 不动。
**理由**：① D-13 冻结名只有三个，不新增第四个子命令体系；② 共用 handler 让「命令表回归口径」收敛到一处（AC-22 的 25 行断言不放宽）；③ 既有 `orch role import` / `orch workflow export` 行为零改动，避免回归（见 §8 冲突 9）。
**被否决**：
- **新增顶层 `chain` / `sign` / `import` 命令**：超出裁决 A 冻结的三个名字面，属规划外夹带。
- **在 `FAMILY_MODULES` 之外另建第二套分派**：D-13:704 明令禁止。

### 1.10 测试目录新开 `test/wp15/**`，不并入既有冻结面

**结论**：I1.12 新增测试全部落 `test/wp15/`（新目录），与 I1.10b `test/wp14/`（17 文件冻结面）、I1.12 需求目录 `docs/iterations/iteration-12/**` 分离；真实宿主性能探针落 `probe/acc12-perf.mjs`；夹具根一律 `%TEMP%/maestro-i112-<场景>` + `NODE_ENV=test`（D-12）。
**理由**：① I1.10b 把新测试从 wp13 分出 wp14 的先例；② 每 WP 自带契约测试且文件零交集，新目录可逐包划分；③ win32 夹具用 `node` 跨平台命令，不硬编码 `bash`。
**被否决**：
- **并入 `test/wp14/`**：I1.10b 冻结面不得改动，且会造成 WP 间测试文件混淆。
- **夹具用 `bash -c` 包裹**：win32 tool-bash disabled，夹具不可移植。

---

## 2. 模块划分与文件级接口契约

> 逐文件给出「新增 / 改、导出签名、入参出参、归属 WP」。标注「改」的 8 个既有文件（`event-bus.js` / `handoff-schema.js` / `roles.js` / `workflows.js` / `main.js` / `labels.js` / `orchestrator.js` / `escalation.js`）均为 D-13 / 需求 Then 点名的最小改动面，各自唯一负责 WP。全部新增 / 改文件：零新建中文硬编码（文案只经 `labels.js`）、零 31 禁词、零 `if host ==` 分支、零第三方依赖。
> **D-13 冻结清单落点总表**：三命令名 → §2.7 `main.js`；handler 挂载 → §2.7 `FAMILY_MODULES`；reason 码 `wake.not-whitelisted` → §2.7 `labels.js`；独立用法块 → §2.7 `USAGE_LINES`；`handoff-schema.js` 追加段 → §2.3；`event-bus.js` 只读接入 → §2.1；`escalation.js` 复用 → §2.8；`orchestrator.js` 门禁 → §2.8。

### 2.1 WP-1 负责文件

- `src/core/audit-verify.js`（**新增**，WP-1）—— 导出 `verifyChain({root, instanceId, fs}) → {ok:true, total:number, firstMismatch:null, badLines:number} | {ok:false, code:'CHAIN_BROKEN', seq:number, detail:string, expected:string, actual:string, total:number}`；`verifyChainText(result, labels) → string`（按 A-1 / A-2 键拼文案，自身无中文字面）。入参 `root` 为实例根、`instanceId` 为实例号、`fs` 可注入；实现只 import `createStore` 的 `readEvents`（只读），**对事件日志路径零写**。约束：`grep -REn "writeFile|appendFile|unlink" src/core/audit-verify.js` 零命中（AC-01 架构检查）；不可读行 / 序号空洞按 I1.9「历史」口径跳过并计数、不算断点（AC-02 / D-2）。
- `src/core/event-bus.js`（**改**，WP-1 唯一负责人）—— D-13:708 授权段：在 `ZERO_HASH` 常量（13 行）附近**新增导出** `canonicalizeEvent(record)`（递归按键名排序、无空白，镜像 `instance-store.js:53`）、`eventFingerprint(record)`（SHA-256 hex）、`ZERO_HASH`（由 const 提为导出）。`emit` / `replay` / `enqueue` / 落盘失败不广播 / 单实例串行化段落**逐字不动**。约束：新增导出与 `instance-store.js` 私有 `hashRecord` 的对拍断言由 WP-1 契约测试承担（§8 冲突 6）。

### 2.2 WP-2 负责文件

- `src/core/governance.js`（**新增**，WP-2）—— 纯判定模块，导出：
  - `decideWake({sourceRole, targetRole, roles, now}) → {allowed:boolean, reason:'wake.not-whitelisted'|null, detail:{from, to, reason, at}}`；白名单未声明 / 配置不可读 / 目标角色不存在一律从严拒绝（AC-03/04 / D-3）。
  - `validateHighRiskReview({workflow, roles, graph}) → {ok:boolean, needsHumanReview:boolean, blocked:boolean, reason:string|null, nodeIds:string[]}`（D-5 判定结构 + 高风险节点定位；识别 = 标记 ∪ 副作用 high）。
  - `reviewDecision({instanceId, nodeId, needsHumanReview, blocked, reason}) → {instanceId, nodeId, needsHumanReview, blocked, reason}`（供 I1.11 消费的终审判定副本）。
  - `isPrimaryAuditEvent(event) → boolean`（白名单：`node.state.change` / `handoff.*` / `health.changed` / `core.suspend` / `run.halted`；其余派生 / 会话事件不进主审计）。
  - 约束：不产生中文字面、不含视图字段、不调用状态迁移；`grep -REn "emit\(|saveState|transit\(" src/core/governance.js` 零命中（AC-04/07/23）。

### 2.3 WP-3 负责文件

- `src/core/handoff-schema.js`（**改**，WP-3 唯一负责人）—— D-13:707 授权段：在 `validateHandoff`（305–311 行）既有链末尾追加 `validateEvidenceFreshness` 步骤，既有 `CODES` 顺序与失败码不动。新增导出 `validateEvidenceFreshness(handoff, {workspaceDir, cwd, sourceNode, graph, fs, sha256Of}) → {ok:true, stale:false} | {ok:false, code:'EVIDENCE_STALE', detail:string, decision:{instanceId, handoffId, nodeId, stale:true, reason:'fingerprint_mismatch'|'evidence_missing'|'hash_unavailable'}}`；指纹用 `doc-artifact.js::sha256Of`（237 行，只读）。约束：既有 `validateHandoffEvidence` 的 `HANDOFF_HASH_MISMATCH` 路径不删不改（§8 冲突 7）。
- `src/core/budget.js`（**新增**，WP-3）—— 纯判定模块，导出：
  - `decideParallelism({readyNodes, runningNodes, maxConcurrent, instanceBudget}) → {allowed:string[], queued:string[], limit:number, reason:null|string}`；上限取实例配置与角色 `max_concurrent_sessions` 较小值；字段缺失 / 上限非法按最保守口径（不新增派发）。
  - `decideBudget({remainingBudget, nextCost, state}) → {suspend:boolean, reason:'budget_exhausted'|null, resumeRound:number|null}`；耗尽返回既有状态词 `suspended` 语义，不新造枚举。
  - 约束：只返回判定，写路径由 `orchestrator.transit()` 承担；`grep -REn "saveState|transit\(" src/core/budget.js` 零命中（AC-11/12 / D-6）。

### 2.4 WP-4 负责文件

- `src/core/pack.js`（**新增**，WP-4）—— 导出：
  - `buildPackage({asset, registry, root}) → {ok:true, manifest, files} | {ok:false, code, detail}`；沿技能 / 派生父 / 子工作流递归收录、检测并拒绝循环，只收真实依赖（AC-13）。
  - `verifyPackage({pkg, publicKey, systemVersion}) → {ok:true, signatureValid:true, versionCompatible:true} | {ok:false, code:'SIGNATURE_INVALID'|'VERSION_INCOMPATIBLE', detail}`（先验签后校验版本，D-7）。
  - `importPackage({pkg, publicKey, systemVersion, root, fs}) → {ok:true, installed:string[]} | {ok:false, code, detail}`；校验在任何写前返回，临时目录原子落库、不覆盖、无残留（AC-14/15）。
  - `listMigrations({root, registry}) → {items:[{from, to, file, field}], total}`；`applyMigrations({root, plan, backupDir, fs}) → {ok:true, changed:number, summary} | {ok:false, code, detail}`；只改引用字段、先备份、失败保原资产、幂等（AC-16/17 / D-8）。
  - 约束：`grep -REn "writeFile|appendFile" src/core/pack.js` 仅允许出现在 importPackage / applyMigrations 的原子写路径，verify / list / build 路径零命中。
- `src/cli/roles.js`（**改**，WP-4，依裁决 B 授权段：`exportRole` / `importRole` handler、`roleCommand` 的 export/import 分发子段，以符号锚点定位）—— 只在导出 handler 调 `pack.buildPackage`、导入 handler 调 `pack.importPackage` 前加门禁；只加不改，既有 `role export` / `role import` 命令的对外行为、既有文案键（`ROLE_WRITE_TEXT` 等）与既有失败码逐字不变（A-6 新文案经 labels.js 下发）。
- `src/cli/workflows.js`（**改**，WP-4，依裁决 B 授权段：`workflowCommand` 中与工作流包 export/import 相关的子段，以符号锚点定位）—— 只把工作流导出改调 `pack.buildPackage`；只加不改，既有 `workflowCommand` 其他分支的对外行为、文案键与失败码逐字不动（授权范围与裁决出处见 §8 冲突 9，裁决 B 已授权）。
- `src/cli/migrate.js`（**新增**，WP-4）—— `export async function migrateCommand(parsed, ctx) → number`（退出码）；调 `pack.listMigrations` 展示变更清单，确认后 `pack.applyMigrations`，摘要条数 = 清单条数（AC-16）。

### 2.5 WP-5 负责文件

- `src/core/otel-export.js`（**新增**，WP-5）—— `exportOtel({events, spans, instanceId, out, fs}) → {ok:true, count:{events, spans}, out:string} | {ok:false, code, badLines:number}`；span → OTLP trace span（`trace_id` / `span_id` / `start_time` / `end_time` / `status` / `handoff_ids`）、event → OTLP log record、资源属性带 `instance_id`；不可读行跳过并计数；导出前后 sha256 比对由调用侧断言。约束：`grep -REn "writeFile|appendFile" src/core/otel-export.js` 对事件 / 追踪路径零命中（AC-18 架构检查）。
- `src/core/antipattern.js`（**新增**，WP-5）—— `detectAntipatterns({graph, state, traces, events, config}) → {signals:[{type:'doc_bottleneck'|'serialization_regression'|'confirmation_bias', instanceId, nodeId, detailKey}], insufficientData:boolean}`；样本不足不产信号、给「数据不足」；只读，不调用状态迁移 / 升级接口（AC-19 / D-10）。
- `src/cli/otel.js`（**新增**，WP-5）—— `export async function exportCommand(parsed, ctx) → number`；按 `<类型>` 分派 events / traces / pack 的 OTEL 导出，调 `exportOtel`；退出码与输出条数由 A-7 / labels.js 文案键承载。

### 2.6 WP-6 负责文件

- `src/core/perf-baseline.js`（**新增**，WP-6）—— `collectHandoffLatency({events, spans, round}) → {samples:[{instanceId, sessionId, handoffId, latencyMs}], stats:{median:number, p95:number, max:number}}`；`buildPerfReport({samples, evidenceLevel, target}) → {ok:boolean, level:'mock 实测'|'已实测（真实宿主面）'|'待本机实测', stats, bottleneck:string|null, blocked:boolean}`；`blocked` 仅当真实宿主面 `level === '待本机实测'` 为真（AC-20/21 / D-11）。约束：不写产品状态文件、不碰用户 `~/.dsh`。
- `probe/acc12-perf.mjs`（**新增**，WP-6）—— `export async function main(argv) → number`；只读采样本机 DSH 0.2.2-rc.1 的 20 实例 / 50 会话 handoff，输出报告 JSON 到 stdout 或 `--out`；不写死期望值、不为达标造假、不硬编码 `bash`。

### 2.7 WP-7 负责文件（命令表 / 文案 / 接线）

- `src/cli/main.js`（**改**，WP-7 唯一负责人）—— D-13 授权段：
  - 188–192 `FAMILY_MODULES` 逐字追加三条：`verify → ./verify.js / verifyCommand`、`migrate → ./migrate.js / migrateCommand`、`export → ./otel.js / exportCommand`；既有 `skill` / `workflow` 不动；未实现沿用 `notImplemented` 模式。
  - 199–204 `RUNTIME_COMMANDS` 追加顶层 `migrate` / `verify` / `export`；206–213 `RUNTIME_SUBS` 追加 `verify: ['import','review']`（既有映射不动）；215–218 flags 白名单只追加新命令所需 flag。
  - 不在表外另建第二套分派（D-13:704）。
- `src/cli/labels.js`（**改**，WP-7 唯一负责人）—— 183–209 `USAGE_LINES` **追加独立用法块**，既有 25 行逐字不改（AC-22 断言不放宽）；354 起 `REASON_LABEL` 追加 `wake.not-whitelisted`，既有键值（含 388 行 `wake.rejected`）逐字不动；按 A-0~A-7 下发全部新增中文文案键（中文唯一来源）。
- `src/cli/verify.js`（**新增**，WP-7）—— `export async function verifyCommand(parsed, ctx) → number`；按目标分派：`verify <实例>` → `audit-verify.verifyChain`、`verify <包>` → `pack.verifyPackage`、`verify import <包>` → `pack.importPackage`、`verify review <工作流>` → `governance.validateHighRiskReview`；返回退出码与文案键（裁决 A 第 1 条 / D-13:704）。
- `src/core/orchestrator.js`（**改**，WP-7 唯一负责人）—— D-13:710 授权段，只追加 4 处门禁调用：唤醒决策点（约 4435）调 `decideWake`；`validateHandoff` 后（3099）调 `validateEvidenceFreshness`；派发前（1689 / 3190）调 `decideParallelism` / `decideBudget`；高风险节点到达交接点时调 `validateHighRiskReview`。`transit()` 仍为唯一入口，不新增第二套迁移实现。
- `src/core/escalation.js`（**改**，WP-7 唯一负责人）—— D-13:709 授权段：244–348 既有 `emitMany` / `commitEscalation` 判定不重写；新 reason 码由调用侧传入（`wake.not-whitelisted` / 证据 / 预算），复用既有 `pendingHandoff` 拒绝落库与审计事件结构，不改事件总线落盘纪律。

### 2.8 测试与探针归属（逐文件见 §4 / §5）

- `test/wp15/**`：新增 16 个契约测试文件，按 WP-1~WP-7 文件清单逐包归属（§4）；每包自带契约测试、不依赖下游文件、缺字段按契约兼容缺省。
- `test/fixtures/purity-check.mjs`、`test/fixtures/mock-acp-agent.js`、`test/wp13/**`、`test/wp14/**`、`bin/orch.js`：**只读基线，不改、不算任何 WP 负责文件**；AC-22 回归门禁复用之。

---

## 3. 数据模型

> **唯一事实来源（对齐裁决 A 与基线状态词）**：
> - 事件链字段（`seq` / `ts` / `prev_event_hash` / `ZERO_HASH`）与 append-only / 序号不复用：`src/core/event-bus.js`、`src/persistence/instance-store.js:53-66`（I1.9 基线）+ A-0；本迭代只镜像不重写。
> - reason 码语义：`src/cli/labels.js::REASON_LABEL` + 裁决 A 第 4 条（`wake.rejected` 既有语义不动，新码 `wake.not-whitelisted`）。
> - 命令名：`orch migrate` / `orch verify <包>` / `orch verify <实例>` / `orch export <类型>` —— 裁决 A 第 1 条正式冻结（U-06 已关闭）。
> - 实例状态词：`suspended` / 已挂起 —— index §3.6 基线；预算耗尽走既有挂起 / 恢复路径，不新造第三种状态。
> - 证据判定 `{instanceId,handoffId,nodeId,stale,reason}`：D-4；终审判定 `{instanceId,nodeId,needsHumanReview,blocked,reason}`：D-5；均不含视图字段。
> - 性能证据分级三值 `mock 实测` / `已实测（真实宿主面）` / `待本机实测`：需求 §3.3 第 3 条 + D-11 + 裁决 A 第 3 条；AC-21 判定效力由 483 行契约 + 484 行阻塞出口锚点承担。
> - 用户可见中文：A-0~A-7 + `src/cli/labels.js` 唯一来源。
> 以下样例为形状说明，时间戳 / 实例号为示意值；异常态字段显式列出。

### 3.1 事件链 `events.jsonl`（正常 + 篡改 + 不可读行 + 历史旧记录）

```json
{"seq":1,"ts":"2026-11-18T00:00:00.000Z","prev_event_hash":"0000000000000000000000000000000000000000000000000000000000000000","object":"run","result":"applied","reason":"run.started"}
{"seq":2,"ts":"2026-11-18T00:00:01.000Z","prev_event_hash":"<H1=sha256(canonicalize(record1))>","object":"node","objectId":"T-002","from":"ready","to":"running","result":"applied","reason":"state.change"}
{"seq":3,"ts":"2026-11-18T00:00:02.000Z","prev_event_hash":"<H2=sha256(canonicalize(record2))>","object":"handoff","objectId":"HO-003","from":null,"to":"delivered","result":"applied","reason":"handoff.delivered"}
```

异常态（同一文件内，机检分夹具构造、不混放第二条异常）：
- **篡改**：副本第 2 条 `to` 由 `running` 改为 `frozen`（仍合法 JSON），`verifyChain` 重算 H1' ≠ 原 H1 → 返回 `{ok:false, code:'CHAIN_BROKEN', seq:2, ...}` + A-2 文案；原件前后 sha256 相等（AC-01）。
- **不可读行 / 序号空洞**：某行非 JSON 或 `seq` 跳号 → `badLines + 1`、按 I1.9「历史」口径跳过，不算断点、不回填（D-2）。
- **历史旧记录**：升级前无 `prev_event_hash` 的行按「历史」对待，不校验、不算断点（A-0 / AC-02）。

### 3.2 治理侧判定结果（越权 / 证据 / 终审，含异常态）

```json
{
  "wake":  {"allowed":false,"reason":"wake.not-whitelisted","detail":{"from":"角色甲","to":"角色丙","at":"2026-11-18T00:00:03.000Z"}},
  "stale": {"instanceId":"INST-001","handoffId":"HO-003","nodeId":"T-002","stale":true,"reason":"fingerprint_mismatch"},
  "review":{"instanceId":"INST-001","nodeId":"T-004","needsHumanReview":true,"blocked":true,"reason":"missing_human_gate"}
}
```

异常态：`reason` 另可为 `evidence_missing` / `hash_unavailable`（D-4）；白名单未声明 / 配置不可读 / 目标不存在 → `allowed:false` + 同一新码（从严，不静默放行）；数据不足的高风险识别 → `blocked:true` 且提示含节点定位（AC-07 异常情况）；三类结构**均不含 UI / 按钮 / 文案位置字段**（AC-06/07/23）。

### 3.3 权限白名单配置（角色契约 `wake_allow`）

```json
{"id":"role-a","wake_allow":["role-b"],"side_effect":"low","max_concurrent_sessions":2}
```

异常态：`wake_allow` 缺失 → 从严拒绝（新码）；`wake_allow` 不可读 / 目标角色不存在 → 拒绝并生成升级（§2.3 异常情况）；**不拦截宿主内核层单次文件写入**（BR-04）。既有的工作流加载期 step 13 静态校验（registry/workflows.js:594-604）与此运行时判定互补、互不替代（§8 冲突 8）。

### 3.4 预算与配额字段（`state.json` 节选：耗尽挂起 + 并行上限）

```json
{
  "instanceId":"INST-001","schemaVersion":2,"state":"suspended","rev":7,
  "pauseReason":"预算耗尽","budget":{"remaining":0,"nextCost":1},
  "concurrency":{"maxConcurrent":2,"ready":5,"running":2,"queued":3},
  "roles":[{"id":"role-a","max_concurrent_sessions":2}]
}
```

异常态：`maxConcurrent` 为 0 / 非法、预算字段缺失 → 最保守口径（不新增派发，D-6）；已开始执行的节点继续到本轮结束、只暂停新派发（U-04 建议口径）；恢复后从 `resumeRound` 接续，**无 failed 节点、无新增失败事件**（AC-12）。

### 3.5 包签名结构（manifest + 签名块，含无效 / 不兼容态）

```json
{
  "manifest": {
    "type":"role","id":"role-a","version":3,
    "deps":[{"name":"skill-x","version":2},{"name":"role-parent","version":1}],
    "files":{"role-a.yaml":"<sha256>","skill-x.yaml":"<sha256>"}
  },
  "signature":{"alg":"Ed25519","publicKeyId":"local-main","sig":"<base64>"},
  "compat":{"min":2,"max":3}
}
```

异常态：`sig` 被改动 → `code:'SIGNATURE_INVALID'`（AC-15 第一份）；`systemVersion` 落在 `[min,max]` 外（如 `V=4`）→ `code:'VERSION_INCOMPATIBLE'`（AC-15 第二份）；两者均在任何写前返回，资产库前后字节 / 清单一致、无临时残留；依赖缺失 / 派生链循环 → `buildPackage` 返回失败并定位（AC-13 对照）。

### 3.6 OTel 导出映射（span → trace span，event → log record）

```json
{
  "resource":{"instance_id":"INST-001"},
  "traceSpans":[{"trace_id":"<t>","span_id":"<s>","start_time":"...","end_time":"...","status":"ok","handoff_ids":["HO-003"]}],
  "logRecords":[{"severity":"INFO","body":"handoff.delivered","attributes":{"seq":3,"handoffId":"HO-003"}}],
  "skipped":{"badLines":1}
}
```

异常态：实例无追踪数据 → `traceSpans:[]`、不中断；事件日志有不可读行 → `skipped.badLines` 计数提示、不崩溃；导出前后实例状态深比较相等、日志文件 sha256 相等、事件条数不变（AC-18）。

### 3.7 性能采样数据（三值分级 + 未达标瓶颈）

```json
{
  "load":{"concurrentInstances":20,"activeSessions":50},
  "samples":[{"instanceId":"INST-001","sessionId":"SES-001","handoffId":"HO-003","latencyMs":412}],
  "stats":{"median":405,"p95":980,"max":1310},
  "report":{"level":"mock 实测","handoffUnder2s":true,"bottleneck":null,"blocked":false}
}
```

异常态：真实宿主面未取证 → `level:'待本机实测'`、`blocked:true`、附本机试过路径，判 `阻塞` 而非失败（AC-21 / 484 行锚点）；mock 超 2s / 会话不足 → `handoffUnder2s:false` + `bottleneck` 定位，不伪造达标（AC-20）；`已实测（真实宿主面）` 仅由本机实际取证产生，mock 结果永不进入该判据。

---

## 4. 工作包拆分（WP-1 ~ WP-7，文件互不重叠）

> 切分依据四条硬规则（模板 §1.4）：① 文件清单互不重叠（35 个登记文件两两零交集，脚本核验见返回 ④）；② 依赖成 DAG，每包自带契约测试、不依赖下游文件、缺字段按契约兼容缺省；③ 按能力切不按目录切（每 WP 对应一组可独立验证的 AC）；④ AC → WP 满覆盖（23/23，映射表在 §4 末尾）。
> 切分取舍说明：**接线后置**——`main.js` / `labels.js` / `orchestrator.js` / `escalation.js` 四个多 AC 交汇的大文件归 WP-7 单线负责，能力包只交付纯模块与包内测试，按 §6 冻结签名并行开发；**审计粒度 / 终审 / 白名单同属治理判定**归 WP-2，**证据 / 预算**因 D-4 点名 handoff-schema 与 D-6 派发前门禁归 WP-3，两者不共享文件；**包导出 / 签名 / migrate 共用 pack.js** 归 WP-4，CLI 挂载归 WP-7。

### WP-1 事件链加固与篡改检测（依赖：无；批次 1）

- **负责文件（4）**：`src/core/audit-verify.js`（新）、`src/core/event-bus.js`（改，唯一负责人）、`test/wp15/chain-verify.test.js`（新）、`test/wp15/chain-compat.test.js`（新）
- **依赖**：无（叶子）。事件记录形状取自 `event-bus.js:111` 既有 `record` 与 `instance-store.js:53-66` 规范化口径，冻结点见 §6 ①。
- **交付**：`verifyChain` / `verifyChainText`（A-1 / A-2 文案键）两导出；`event-bus.js` 新增导出 `ZERO_HASH` / `canonicalizeEvent` / `eventFingerprint`，写路径零改；`chain-verify.test.js`（篡改单条 → 首处失配序号 + 非 0 退出 + 原件前后 sha256 相等；原件「链完整，共 N 条」）；`chain-compat.test.js`（旧 N 行字节哈希前后不变、新行 seq 从 N+1、prev 等于旧末条规范化指纹、断点 0；canonicalizeEvent 与 instance-store 私有 hashRecord 对拍）。
- **验收口径**：主责 **AC-01 / AC-02**；`test/wp15/chain-verify.test.js` + `chain-compat.test.js` 独立跑通（`NODE_ENV=test node --test test/wp15/chain-verify.test.js` 等）；逐字断言 A-1「链完整，共 [N] 条」、A-2「链已断：第 [N] 条记录与前一条指纹不匹配」；架构检查 `grep -REn "writeFile|appendFile|unlink" src/core/audit-verify.js` 零命中。
- **可否并行**：可 —— 无上游文件依赖，元数据取只读基线。

### WP-2 权限拦截 + 审计粒度 + 人工终审 + 边界判定（依赖：无；批次 1）

- **负责文件（5）**：`src/core/governance.js`（新）、`test/wp15/governance-wake.test.js`（新）、`test/wp15/governance-review.test.js`（新）、`test/wp15/governance-granularity.test.js`（新）、`test/wp15/boundary-i111.test.js`（新）
- **依赖**：无（纯判定模块）；判定结构与文案键字面为 §6 冻结点 ②，冻住后 WP-7 接线可并行。
- **交付**：`decideWake` / `validateHighRiskReview` / `reviewDecision` / `isPrimaryAuditEvent` 四导出（§2.2 全签名）；`governance-wake.test.js`（白名单内投递、白名单外恰 1 条 `wake.not-whitelisted` 拒绝、目标会话未创建、既有 `wake.rejected` 不变）；`governance-review.test.js`（缺终审校验不通过 + 节点定位、补齐后通过、未裁决不推进下游、裁决被记录）；`governance-granularity.test.js`（node/handoff/health 进主审计、connection/role/session 无独立审计类型、聚合可由交接包重算）；`boundary-i111.test.js`（判定结构含原因 + 关联节点、无 UI 文案、改动清单与 I1.11 路径特征零交集）。
- **验收口径**：主责 **AC-03 / AC-04 / AC-07 / AC-08 / AC-09 / AC-10 / AC-23**；协作 AC-22（31 词扫描部分由 WP-7 收口）。契约测试四个独立文件；架构检查 `grep -REn "whitelist|allowWake" src/core` 有命中且被路由决策调用（接线由 WP-7 完成）、daemon 无 `if host ==` 分支、无 I1.11 界面文件改动。
- **可否并行**：可 —— 只产出纯判定与判定测试，不触碰大文件。

### WP-3 证据过期 + 预算配额（依赖：无；批次 1）

- **负责文件（4）**：`src/core/handoff-schema.js`（改，唯一负责人）、`src/core/budget.js`（新）、`test/wp15/evidence-stale.test.js`（新）、`test/wp15/budget.test.js`（新）
- **依赖**：无；`validateEvidenceFreshness` 的 `decision` 结构与既有 `CODES` 顺序为 §6 冻结点 ③。
- **交付**：`handoff-schema.js` 校验链末尾追加指纹一致性步骤（既有失败码 / 顺序不动）；`validateEvidenceFreshness` 导出（D-4 判定结构）；`budget.js` 导出 `decideParallelism` / `decideBudget`（D-6，复用既有 `suspended` / resume）；`evidence-stale.test.js`（一致放行 / 指纹不一致拒绝 / 引用缺失拒绝、升级各 1 次、判定含关联节点）；`budget.test.js`（5 就绪上限 2 → 执行 ≤2 等待 ≥3 补位、无失败；耗尽 → suspended + 预算耗尽原因 + 恢复从原轮次继续 + 无 failed 节点）。
- **验收口径**：主责 **AC-05 / AC-06 / AC-11 / AC-12**；契约测试两文件独立；架构检查指纹判定在投递前门禁内、预算暂停走既有挂起 / 恢复路径不新增状态枚举（`grep -REn "saveState|transit\(" src/core/budget.js` 零命中）。
- **可否并行**：可 —— 与 WP-2 无共享文件，仅共用冻结的判定结构字面。

### WP-4 包导出 + 签名版本校验 + migrate（依赖：无；批次 2）

- **负责文件（7）**：`src/core/pack.js`（新）、`src/cli/roles.js`（改，依裁决 B 授权段：`exportRole` / `importRole` / `roleCommand` export-import 子段）、`src/cli/workflows.js`（改，依裁决 B 授权段：`workflowCommand` export/import 子段）、`src/cli/migrate.js`（新）、`test/wp15/pack-closure.test.js`（新）、`test/wp15/pack-sign.test.js`（新）、`test/wp15/migrate.test.js`（新）
- **依赖**：包格式（manifest / signature / compat）与 reason 码字面为 §6 冻结点 ④；CLI 命令挂载依赖 WP-7（但包内契约测试直调 pack.js，不依赖 WP-7）。
- **交付**：`buildPackage` / `verifyPackage` / `importPackage` / `listMigrations` / `applyMigrations` 五导出（§2.4 全签名）；`migrateCommand` 接线；三个契约测试覆盖闭包齐全 / 缺失循环对照、有效签名 + 兼容版本导入成功、无效签名与不兼容版本均拒绝且资产库前后一致、migrate 清单与改写一一对应 / 最新无需迁移 / 坏引用保原资产 / 幂等。
- **验收口径**：主责 **AC-13 / AC-14 / AC-15 / AC-16 / AC-17**；协作 AC-22（既有 `orch role import` / export 逐字行为由 WP-7 回归守门）。架构检查校验失败路径在任何写前返回、无半安装残留；roles.js / workflows.js 依裁决 B 授权段接入、只加不改既有行为，授权范围见 §8 冲突 9（裁决 B 已授权）。
- **可否并行**：可 —— 与 WP-1/2/3 无共享文件；roles.js / workflows.js 依裁决 B 授权段（符号锚点见 §2.4），仅限 export / import 相关 handler 子段、只加不改。

### WP-5 OTel 导出 + 反模式监控（依赖：无；批次 2）

- **负责文件（5）**：`src/core/otel-export.js`（新）、`src/core/antipattern.js`（新）、`src/cli/otel.js`（新）、`test/wp15/otel-export.test.js`（新）、`test/wp15/antipattern.test.js`（新）
- **依赖**：OTLP 映射字段与三类信号 `detailKey` 为 §6 冻结点 ⑤；handler 挂载依赖 WP-7（包内测试直调模块）。
- **交付**：`exportOtel` / `detectAntipatterns` / `exportCommand`（§2.5 全签名）；两个契约测试覆盖事件 + 跨度导出、前后状态 / 哈希 / 条数不变、无追踪数据 / 不可读行跳过；三类信号各命中带定位、数据不足不误报、查看前后节点状态与升级计数不变。
- **验收口径**：主责 **AC-18 / AC-19**；架构检查 `grep -REn "writeFile|appendFile" src/core/otel-export.js` 对事件 / 追踪路径零命中；`grep -REn "emit\(|transit\(|escalat" src/core/antipattern.js` 零命中（只读）。
- **可否并行**：可 —— 与其余能力包无共享文件。

### WP-6 性能基线 mock + 真实面探针（依赖：无；批次 2）

- **负责文件（3）**：`src/core/perf-baseline.js`（新）、`test/wp15/perf-mock.test.js`（新）、`probe/acc12-perf.mjs`（新）
- **依赖**：D-11 口径与证据分级三值为 §6 冻结点 ⑥；AC-21 真实宿主取证窗口由主控安排（U-01），mock 面可先收口。
- **交付**：`collectHandoffLatency` / `buildPerfReport`（§2.6 全签名）；`perf-mock.test.js` 用仓库内 mock ACP 夹具（test/fixtures/mock-acp-agent.js，只读基线）构造 20 实例 / 50 会话，断言并发 =20 / 会话 ≥50 / handoff <2s / 逐档数据 / 级别 `mock 实测`，不碰 `~/.dsh`；`probe/acc12-perf.mjs` 只读采样本机真实宿主面、输出报告、未取证标 `待本机实测` + `blocked:true` + 试过路径。
- **验收口径**：主责 **AC-20 / AC-21**；AC-21 未取证判 `阻塞`（不算失败），mock 不得顶替 / 伪通过（裁决 A 第 3 条 / 484 行锚点）；报告三值分级不混用。
- **可否并行**：可 —— probe 独立文件、mock 测试独立；真实宿主面取证由主控排期，不阻塞本包交付。

### WP-7 命令表 / 文案 / 决策点接线与回归守门（依赖：WP-1 ~ WP-6 全部契约冻结；批次 3，单线）

- **负责文件（7）**：`src/cli/main.js`（改，唯一负责人）、`src/cli/labels.js`（改，唯一负责人）、`src/cli/verify.js`（新）、`src/core/orchestrator.js`（改，唯一负责人）、`src/core/escalation.js`（改，唯一负责人）、`test/wp15/wiring.test.js`（新）、`test/wp15/regression.test.js`（新）
- **依赖**：WP-1（audit-verify 签名 / 链字段）、WP-2（decideWake / validateHighRiskReview / reviewDecision 结构）、WP-3（validateEvidenceFreshness / decideParallelism / decideBudget）、WP-4（pack 五导出 / migrateCommand）、WP-5（exportCommand / exportOtel）、WP-6（perf 报告结构）；实际合入在六包契约冻结后单线进行。
- **交付**：D-13 冻结清单全部落地——三命令名 + `FAMILY_MODULES` 三条挂载 + `RUNTIME_COMMANDS` 三条 + `RUNTIME_SUBS` verify 两子命令 + flags 追加；`USAGE_LINES` 独立用法块（既有 25 行逐字不动）+ `REASON_LABEL` 追加 `wake.not-whitelisted` + A-0~A-7 文案键；`verifyCommand` 四目标分派；`orchestrator.js` 四处门禁调用（transit 唯一入口不变）；`escalation.js` 复用既有拒绝 / 升级路径；`wiring.test.js` 断言三条挂载 / 25 行不变 / 新 reason 加键 / 四目标分派 / 四门禁调用点；`regression.test.js` 断言全量 ≥1425 + 差集 0、purity 双目录 31 词 exit 0、deps 0、三主链逐字、`transit(` 唯一入口。
- **验收口径**：主责 **AC-22**；协作 AC-01/02（命令载体）、AC-03/04/07/08/09/10/23（决策点接线与边界机检）、AC-05/06/11/12（门禁接线）、AC-13/14/15/16/17/18（CLI 载体）。逐字断言 `orch --help` 25 行、命令表 / 两层子命令表既有成员不变、`wake.rejected` 键值不变、三主链逐字输出不变。`wiring.test.js` 对四目标分派 / 四门禁调用点采用冻结签名的 stub 注入或静态源码断言，只校验接线形状、不 require 能力包实现产物，**包内契约测试可独立跑通**（`NODE_ENV=test node --test test/wp15/wiring.test.js`），能力包仅冻结签名未落盘时亦可独立跑通、本包验收不依赖它们，满足模板 §1.4 硬规则 2（对齐 I1.10b 拆分行 358 写法）。
- **可否并行**：否 —— 四个大文件唯一负责人、DAG 汇合点前的单线接线（模板硬规则 1）。

**AC → WP 满覆盖映射**

| AC | 主责 WP | 协作 WP | 备注（机检文件 / 判定锚点） |
|---|---|---|---|
| AC-01 | WP-1 | WP-7 | 篡改单条 → 首处失配序号 + A-2 逐字 + 原件哈希不变；`chain-verify.test.js`；`verify <实例>` 载体 WP-7 |
| AC-02 | WP-1 | WP-7 | 旧行字节不变、新行 seq N+1、无第二起点；`chain-compat.test.js` |
| AC-03 | WP-2 | WP-7 | 白名单内投递、拒绝事件 0；`governance-wake.test.js`；决策点接线 WP-7 |
| AC-04 | WP-2 | WP-7 | 恰 1 条 `wake.not-whitelisted`、目标会话未创建、既有 `wake.rejected` 不动；`governance-wake.test.js` |
| AC-05 | WP-3 | WP-7 | 指纹一致照常投递、过期拒绝 0；`evidence-stale.test.js` |
| AC-06 | WP-3 | WP-7 | 不一致 / 缺失均拒绝 + 升级各 1 + 判定含关联节点 + 零 UI；`evidence-stale.test.js` / `boundary-i111.test.js` |
| AC-07 | WP-2 | WP-7 | 缺终审校验不通过 + 节点定位、补齐后通过；`governance-review.test.js` |
| AC-08 | WP-2 | WP-7 | 未裁决不推进下游、裁决被记录；`governance-review.test.js` |
| AC-09 | WP-2 | WP-7 | node/handoff/health 进主审计；`governance-granularity.test.js` |
| AC-10 | WP-2 | — | connection/role/session 无独立审计、聚合可重算；`governance-granularity.test.js` |
| AC-11 | WP-3 | WP-7 | 5 就绪上限 2 → 执行 ≤2 排队补位、无失败；`budget.test.js` |
| AC-12 | WP-3 | WP-7 | 耗尽 → suspended + 预算耗尽原因 + 原轮次恢复、无 failed；`budget.test.js` |
| AC-13 | WP-4 | WP-7 | 闭包成员齐全 / 缺失循环对照失败定位；`pack-closure.test.js` |
| AC-14 | WP-4 | WP-7 | 有效签名 + 兼容版本导入成功、确认含「签名有效 / 版本兼容」；`pack-sign.test.js`；`verify <包>` WP-7 |
| AC-15 | WP-4 | WP-7 | 签名无效 / 版本不兼容均拒绝、资产库前后一致无残留；`pack-sign.test.js` |
| AC-16 | WP-4 | WP-7 | `orch migrate` 清单与改写一一对应、摘要条数=清单条数；`migrate.test.js`；handler WP-7 |
| AC-17 | WP-4 | WP-7 | 最新无需迁移不写文件、坏引用保原资产、二次幂等；`migrate.test.js` |
| AC-18 | WP-5 | WP-7 | 事件 + 跨度 OTLP 导出、前后哈希 / 状态 / 条数不变；`otel-export.test.js`；`export <类型>` WP-7 |
| AC-19 | WP-5 | — | 三类信号带定位、数据不足不误报、只读；`antipattern.test.js` |
| AC-20 | WP-6 | — | mock 20 并发 / 50 会话 handoff <2s、级别 `mock 实测`；`perf-mock.test.js` |
| AC-21 | WP-6 | — | 真实宿主面未取证判 `阻塞`、不得 mock 顶替 / 伪通过；perf 报告分级 + probe 采样器（归 WP-6） |
| AC-22 | WP-7 | WP-1~WP-6 | 78 条上游 AC 只增不改、≥1425 + 差集 0、purity 0、USAGE 25 行、三主链逐字、deps 0；`regression.test.js` |
| AC-23 | WP-2 | WP-7 | 治理侧只产出判定结构（原因 + 关联节点）、与 I1.11 文件零交集、无 UI 文案；`boundary-i111.test.js` + `regression.test.js` |

> 覆盖核对：AC-01~AC-23 连续编号、一行一条、无缺号 / 重号 / 合并；每行恰好一个主责 WP，合计 **23/23**。主责分布：WP-1（AC-01/02）、WP-2（AC-03/04/07/08/09/10/23）、WP-3（AC-05/06/11/12）、WP-4（AC-13~17）、WP-5（AC-18/19）、WP-6（AC-20/21）、WP-7（AC-22）。机检 / 契约测试文件 16 个全部登记归属：WP-1×2、WP-2×4、WP-3×2、WP-4×3、WP-5×2、WP-6×1、WP-7×2（另有 probe 真实面采样器 1 个归 WP-6）。

---

## 5. 交付物清单

| 路径 | 内容 | 包 |
|---|---|---|
| `src/core/audit-verify.js` | 只读链校验 `verifyChain` / `verifyChainText`（A-1/A-2） | WP-1 |
| `src/core/event-bus.js`（改） | 新增导出 ZERO_HASH / canonicalizeEvent / eventFingerprint，写路径零改 | WP-1 |
| `test/wp15/chain-verify.test.js` | AC-01 篡改检测 + 原件哈希不变 + A-2 逐字 | WP-1 |
| `test/wp15/chain-compat.test.js` | AC-02 I1.9 衔接 + canonicalize 对拍 | WP-1 |
| `src/core/governance.js` | 白名单 / 终审 / 粒度四判定导出 | WP-2 |
| `test/wp15/governance-wake.test.js` | AC-03/04 拦截与 `wake.not-whitelisted` 留痕 | WP-2 |
| `test/wp15/governance-review.test.js` | AC-07/08 缺终审挡下 + 裁决前后 | WP-2 |
| `test/wp15/governance-granularity.test.js` | AC-09/10 主审计白名单 + 派生视图 | WP-2 |
| `test/wp15/boundary-i111.test.js` | AC-23 判定结构 + 零 UI + I1.11 零交集 | WP-2 |
| `src/core/handoff-schema.js`（改） | 校验链末尾追加 `validateEvidenceFreshness`（D-4） | WP-3 |
| `src/core/budget.js` | `decideParallelism` / `decideBudget`（D-6） | WP-3 |
| `test/wp15/evidence-stale.test.js` | AC-05/06 一致放行 / 不一致 / 缺失拒交接 | WP-3 |
| `test/wp15/budget.test.js` | AC-11/12 排队补位 + 耗尽挂起恢复 | WP-3 |
| `src/core/pack.js` | 闭包导出 / 验签 / 原子导入 / migrate 五导出（D-7/D-8） | WP-4 |
| `src/cli/roles.js`（改） | `exportRole` / `importRole` / `roleCommand` export-import 子段接 pack 门禁（依裁决 B 授权段，只加不改） | WP-4 |
| `src/cli/workflows.js`（改） | `workflowCommand` export/import 子段接 pack 闭包（依裁决 B 授权段，只加不改） | WP-4 |
| `src/cli/migrate.js` | `migrateCommand`（AC-16/17 载体） | WP-4 |
| `test/wp15/pack-closure.test.js` | AC-13 闭包齐全 / 缺失循环对照 | WP-4 |
| `test/wp15/pack-sign.test.js` | AC-14/15 有效 / 无效签名 + 版本兼容 | WP-4 |
| `test/wp15/migrate.test.js` | AC-16/17 清单 / 升级 / 幂等 / 坏引用 | WP-4 |
| `src/core/otel-export.js` | `exportOtel`（OTLP trace span + log record，D-9） | WP-5 |
| `src/core/antipattern.js` | `detectAntipatterns`（三类信号 + 数据不足，D-10） | WP-5 |
| `src/cli/otel.js` | `exportCommand`（AC-18 载体） | WP-5 |
| `test/wp15/otel-export.test.js` | AC-18 导出 + 前后哈希 / 状态 / 条数不变 | WP-5 |
| `test/wp15/antipattern.test.js` | AC-19 三类信号 + 只读 | WP-5 |
| `src/core/perf-baseline.js` | `collectHandoffLatency` / `buildPerfReport`（D-11） | WP-6 |
| `test/wp15/perf-mock.test.js` | AC-20 mock 20/50 handoff <2s + `mock 实测` | WP-6 |
| `probe/acc12-perf.mjs` | AC-21 真实宿主只读采样 + 阻塞出口 | WP-6 |
| `src/cli/main.js`（改） | 三命令表 + handler 挂载 + flags（D-13） | WP-7 |
| `src/cli/labels.js`（改） | 独立用法块 + `wake.not-whitelisted` + A-0~A-7 文案键 | WP-7 |
| `src/cli/verify.js` | `verifyCommand` 四目标分派（裁决 A 第 1 条） | WP-7 |
| `src/core/orchestrator.js`（改） | 四处门禁调用，transit 唯一入口不变（D-13:710） | WP-7 |
| `src/core/escalation.js`（改） | 复用 emitMany / commitEscalation，新 reason 调用侧传入（D-13:709） | WP-7 |
| `test/wp15/wiring.test.js` | D-13 落地：三挂载 / 25 行 / 新 reason 加键 / 分派 / 四门禁 | WP-7 |
| `test/wp15/regression.test.js` | AC-22 全量 + purity + deps + 三主链 + AC-23 零交集机检 | WP-7 |

合计 **35 个登记文件**（新增 27 + 修改 8）；夹具现场一律 `%TEMP%/maestro-i112-<场景>` + `NODE_ENV=test` + `node "$MAESTRO_REPO/bin/orch.js" ...`（跨平台，不硬编码 `bash`）；flake 留帧落 `docs/iterations/iteration-12/flake-frames/`（收口产物，不属 WP 负责文件）。**只读基线不改、不算负责文件**：`test/wp13/**`、`test/wp14/**`、`test/fixtures/**`、`test/templates/**`、`bin/orch.js`、`docs/index.md`、需求目录、模板、I1.11 相关文件。

---

## 6. 依赖与并行策略

```
契约先冻结（§6 冻结点 ①~⑥，S2 开工首日由主控锁定）
        │
批次 1 ──► WP-1 事件链加固 ──────┐
批次 1 ──► WP-2 治理判定 ────────┤（三者并行，均无上游文件依赖）
批次 1 ──► WP-3 证据 + 预算 ─────┘
        │
批次 2 ──► WP-4 包 / 签名 / migrate（依赖冻结点 ④）
批次 2 ──► WP-5 OTEL / 反模式（依赖冻结点 ⑤；与 WP-4 并行，无共享文件）
批次 2 ──► WP-6 性能基线 mock / 真实面探针（依赖冻结点 ⑥；并行）
        │
批次 3 ──► WP-7 命令表 / 文案 / 决策点接线与回归守门（单线；依赖 WP-1~WP-6 全部契约冻结）
```

- **DAG 边**：WP-7 → {WP-1, WP-2, WP-3, WP-4, WP-5, WP-6}；WP-1~WP-6 之间**无边**（纯能力包，各自独立验收）。无环；WP-7 是唯一汇合点。每边均为「能力包导出的纯函数 / 判定结构被 WP-7 import 并接线」的静态依赖。
- **分批顺序**：批次 1（WP-1/2/3 并行）→ 批次 2（WP-4/5/6 并行）→ 批次 3（WP-7 单线）。批次 1/2 的 6 个能力包可同时在 ≤2 个执行 Agent 内轮转（平台 429 约束），每包分批落盘证据。
- **契约先冻结点（六处，冻住后各包并行，联调不互相改接口）**：
  1. **事件记录形状与链字段（WP-1 产出）**：`seq` / `ts` / `prev_event_hash` / `ZERO_HASH` / `canonicalizeEvent` 的规范化口径（必须字节级对齐 `instance-store.js:53-66`）、A-1/A-2 文案键。
  2. **治理判定结构（WP-2 产出）**：`decideWake` / `validateHighRiskReview` / `reviewDecision` / `isPrimaryAuditEvent` 的返回字段与 reason 字面（`wake.not-whitelisted`），D-4/D-5 结构不含 UI 字段。
  3. **证据 / 预算判定结构（WP-3 产出）**：`validateEvidenceFreshness` 的 `decision` 三字段 + reason 三值、`decideParallelism` / `decideBudget` 的返回字段与 `suspended` 状态词；既有 `CODES` 顺序不动。
  4. **包格式与 reason 码（WP-4 产出）**：manifest（type / id / version / deps / files）、signature（alg / publicKeyId / sig）、compat（min / max）、`SIGNATURE_INVALID` / `VERSION_INCOMPATIBLE`；migrate 清单字段与摘要口径。
  5. **OTLP 映射与信号键（WP-5 产出）**：trace span / log record 字段、`instance_id` 资源属性、`skipped.badLines`；三类信号 `type` 与 `detailKey`、数据不足形状。
  6. **压测口径与证据分级（WP-6 产出）**：handoff 延迟定义、中位 / P95 / 最大、负载 20/50、三值分级 `mock 实测` / `已实测（真实宿主面）` / `待本机实测`、阻塞出口 `blocked:true`。
  > 六个冻结点覆盖任务要求的「先冻结 D-13 命令签名与事件链字段，再并行治理 / 生态 / 性能」：命令签名字面由裁决 A 与 D-13 在 S0 已冻结，冻结点 ①~⑥ 落字段 / 返回结构；`main.js` / `labels.js` 的接线产物归 WP-7，不在能力包内重复冻结。
- **整合检查点（3 个）**：
  - **检查点 1（批次 1 末）**：WP-1/2/3 共 8 个契约测试全绿；链字段与判定结构对拍通过；`grep -REn "writeFile|appendFile|unlink" src/core/audit-verify.js` 零命中；`grep -REn "saveState|transit\(" src/core/governance.js src/core/budget.js` 零命中；既有全量零回归（≥1425 + 差集 0）。
  - **检查点 2（批次 2 末）**：WP-4/5/6 共 6 个契约测试全绿；`probe/acc12-perf.mjs` 真实面取证或明确登记 `阻塞`；mock 报告级别 `mock 实测` 已产出；purity 双目录 31 词 `exit 0`。
  - **检查点 3（批次 3 末，收口）**：WP-7 `wiring.test.js` + `regression.test.js` 全绿；D-13 冻结清单逐条落地复核（三命令名 / 三挂载 / 25 行不变 / `wake.not-whitelisted` 加键 / 四门禁调用点 / `transit(` 唯一入口）；全量四步判定（取数 → 差集 → 逐文件 → 新红复核）；23 条 AC 架构检查全表复核；AC-21 真实宿主面未取证按 `阻塞` 登记、不伪通过。

---

## 7. 风险与降级

| # | 风险 | 影响 | 处置（点名文件 / 函数） |
|---|---|---|---|
| F2-01 | **契约锚点运行时取证未覆盖**（round2 §6 建议，移交 S1 §7） | `orch verify/migrate/export`、白名单拦截、证据过期判定、预算挂起、OTEL 导出、反模式信号在 S2 前无法跑通，S3 复核易把「未落地」误记失败 | S2 按 §2 落地后由 S3 逐条取证；本拆分只核 D-13 登记一致性（已核齐）；各能力包契约测试先行，未落地路径按「未落地、不计通过、不判红」处理；检查点 3 逐条复核 |
| F2-02 | **AC-21 真实宿主面取证（U-01）**（round2 §6 建议） | 本机 DSH 0.2.2-rc.1 未取证时真实面无证据，不能判达标 | 未取证判 `阻塞`（非失败）并附本机试过路径，不得用 `mock 实测` 顶替 / 判伪通过（484 行锚点）；mock 面 AC-20 先收口；取证窗口由主控安排 |
| F2-03 | **性能数值 `<2s` / ≥20 / ≥50 分级**（round2 §6 建议） | mock 与真实宿主混用、或以 mock 宣称真实达标 | `perf-baseline.js::buildPerfReport` 三值分级字段强校验，mock 结果不进入真实宿主判据；报告含逐档中位 / P95 / 最大与未达标瓶颈点；不伪造达标 |
| F2-04 | **新 reason 码在 REASON_LABEL 同步加键**（round2 §6 建议） | 缺键会按 `labels.js:354` 注释输出原始英文 reason | WP-7 在 `src/cli/labels.js` 的 `REASON_LABEL` 追加 `wake.not-whitelisted`，既有键值（含 388 行 `wake.rejected`）逐字不动；`wiring.test.js` 断言新键存在且既有键零改 |
| F2-05 | **全量测试失败差集随每次回归重算**（round2 §6 建议） | 失败条数在 15/16 摆动、成员翻转，误判新红或误放真红 | `regression.test.js` 按裁决 G 三段式：`tests ≥ 1425` + 允许集合（win32 16 项 ∪ 留帧 flake）差集 0；集合外新红单文件独占复跑、留帧到 `flake-frames/`；不以绝对失败数作判据 |
| F2-06 | **独立用法块追加时保持既有 25 行逐字不变**（round2 §6 建议） | 新增命令改写原 25 行 → AC-22 / NF-4 回归判红 | `src/cli/labels.js::USAGE_LINES` 只追加独立用法块；`wiring.test.js` + `regression.test.js` 双重断言 `orch --help` 25 行逐字、命令表 / 两层子命令表既有成员不变（裁决 A 第 2 条） |
| 7 | **AC-21 真实宿主取证依赖本机 DSH 凭据 / 窗口**（U-01，DoR-7 黄项） | 凭据或窗口未定导致验收期无法取证，误判迭代不通过 | `probe/acc12-perf.mjs` 只读采样、输出报告 JSON；未取证登记 `阻塞` 不登记失败；U-01 由主控排期，不阻塞 WP-1~WP-6 开工与收口（需求 §3.3 第 3 条 / 裁决 A 第 3 条） |
| 8 | **与 I1.11 并行零交集**（需求 §1.3 / D-1 / AC-23） | 两迭代同时改同一文件导致合并冲突或 UI 文案混入 | `boundary-i111.test.js` + `regression.test.js` 用 `git diff --name-only <基线>..HEAD \| grep -i "i1.11\|notify\|intervention\|evidence-view"` 零命中；治理侧只产出 D-4/D-5 判定结构，不含 UI 字段；开工前与主控确认基线 commit 与文件边界 |
| 9 | **全量测试平台 flake（差集口径）**（progress.md 移交回归纪律） | 本机 win32 16 项稳定红 + 3 条 flake 留帧成员翻转，误杀或误放 | 只按三段式 + 允许集合判定（见 F2-05）；`http-channel` / `readonly-local` 等登记项豁免、不得要求 `# fail 0`；禁 `--no-flake-confirm` 一类跳过开关 |
| 10 | **历史证据被覆盖写需恢复**（progress.md 过程留痕） | 全量测试跑 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 时被覆盖写，证据失真 | 历史证据目录只读复用；如被覆盖，按已验证口径 `git -c core.autocrlf=false checkout-index -f` 恢复并核 diff 空；本迭代证据一律写 `docs/iterations/iteration-12/evidence/`，不与历史目录交叉 |
| 11 | **canonicalize 私有未导出，链校验无法直接复用**（代码现状） | `instance-store.js:53` 的 `canonicalize` / `hashRecord` 未导出，只读模块若自行实现口径漂移会导致误报 / 漏报 | `event-bus.js` 新增导出 `canonicalizeEvent` / `eventFingerprint` 镜像实现；`chain-compat.test.js` 用同一组记录对拍 `eventFingerprint(record)` 与 `store.appendEvent` 写入的 `prev_event_hash`，证明字节级一致；不改 `instance-store.js`（§8 冲突 6） |
| 12 | **`orchestrator.js` 大文件多 AC 交汇**（5247 行，4 处门禁） | WP-2/3/4/5 若各自去加钩子会互相覆盖，破坏 transit 唯一入口 | 唯一负责人 WP-7；能力包只交付纯函数，四门禁由 WP-7 按 D-13:710 单点追加；每 WP 回收 `git show --stat` 核授权文件；`regression.test.js` 断言 `grep -REn "transit\(" src/core` 命中点与基线一致 |
| 13 | **D-13 未点名 roles.js / workflows.js 的 import/export 段**（已由裁决 B 闭合） | WP-4 接入验签 / 闭包时改到未授权段，被评审判越界 | 依裁决 B 授权段，以符号锚点定位：`exportRole` / `importRole` / `roleCommand` 的 export/import 分发子段、`workflowCommand` 的 export/import 子段；只加不改既有命令对外行为 / 文案键 / 失败码，逐字文案与其他命令零改（§8 冲突 9，裁决 B 已授权，SR-01 闭合） |
| 14 | **既有 `wake.rejected` 语义不得被新码替换**（裁决 A 第 4 条） | 误把既有唤醒门拒绝改成 `wake.not-whitelisted` → 上游 AC 回归 | `governance.js::decideWake` 只在新白名单场景返回新码；`orchestrator.js:4435` 既有 `wake.rejected` 分支不动；`governance-wake.test.js` 断言两码并存、互不替代 |
| 15 | **既有 `HANDOFF_HASH_MISMATCH` 与新指纹判定并存**（handoff-schema.js:265-275） | 两套校验互相覆盖或重复拒绝，AC-05 正常交接被误伤 | WP-3 唯一负责 `handoff-schema.js`；`validateEvidenceFreshness` 追加在既有链末尾、既有 `CODES` 与顺序不动；`evidence-stale.test.js` 同时断言一致放行与不一致拒绝两条路径 |
| 16 | **win32 夹具禁 `bash` / 中文唯一来源 / 31 词纯度**（D-12 / AC-22） | 夹具硬编码 `bash` 在 win32 无法执行；新增模块混入中文或角色字面量导致 purity 红 | 夹具一律 `node "$MAESTRO_REPO/bin/orch.js" ...` 跨平台形态；新增中文只经 `labels.js`；能力包模块零 31 禁词、零 `if host ==`；`regression.test.js` 双目录 purity `exit 0` |

> §7 覆盖统计：**16 条**（F2-01~F2-06 六条 + AC-21 取证依赖 + I1.11 边界 + flake 差集 + 历史证据恢复 + 代码现状 6 条）。每条均点名文件 / 函数 / 命令。

---

## 8. 与需求 v2 的对齐声明

本文档不新增需求条目、不删改任何 AC / BR / NF、不放宽任何 Then、不把范围条目挪到范围外；所有逐字文案、状态名、错误码、AC 编号、判定强度均以 `docs/iterations/iteration-12/requirement.md` **v2**（23 AC / 19 BR / 5 NF）为准；两者冲突时**以需求为准**并在实现结论中指出。裁决 A（`decisions.md`）效力高于需求正文自我声明，本拆分逐条执行、不再二次裁决。

### 8.1 裁决 A 逐条落地

| 裁决 | 落点 |
|---|---|
| 第 1 条：命令名冻结 `orch migrate` / `orch verify <包>` / `orch export <类型>`，链校验 `orch verify <实例>` 共用 handler | §0 退出标准 5 / §1.9 / §2.7 `main.js` + `verify.js` / WP-7；U-06 已关闭，不再标「待裁决」 |
| 第 2 条：`USAGE_LINES` 既有 25 行逐字不变、三命令独立用法块追加、25 行断言不放宽 | §0 退出标准 5 / §2.7 `labels.js` / F2-06 / `wiring.test.js` |
| 第 3 条：AC-21「v1 阶段」历史措辞按 Then 零改动保留，效力由 483 行契约 + §3.3 第 3 条承担，不视为降级 | §0 退出标准 1、7 / §1.6 / §3.7 / F2-02 / WP-6；**不要求改 Then** |
| 第 4 条：`wake.not-whitelisted` 冻结、否决 `wake.denied`、既有 `wake.rejected` 语义不动 | §0 退出标准 6 / §1.2 / §2.2 / §2.7 `labels.js` / F2-04 / F2-14 |

### 8.2 需求与代码现状的冲突及裁决出处

| # | 冲突 | 现状实点（本轮实读） | 需求落点与裁决出处 |
|---|---|---|---|
| 1 | 需求 v2 附录 D-13 / U-06 曾以「主控裁决」名义冻结命令名但无独立凭据 | `decisions.md` 裁决 A 第 1 条正式冻结；`main.js:199-204` 顶层命令无 verify/migrate/export，三名字面无冲突 | 以裁决 A 为准，本拆分按冻结字面接线（§2.7 / §1.9），不再标待裁决 |
| 2 | AC-21 Then 正文残留「v1 阶段…待本机实测」与头部 v2 不一致 | 需求 482 行原文；483 行契约 + 484 行阻塞锚点 + §3.3 第 3 条 | 裁决 A 第 3 条：Then 零改动铁律保留历史措辞，效力由契约行承担，不视为放宽 / 降级（§8.1 第 3 条） |
| 3 | 新 reason 码候选 `wake.denied` 与既有 `wake.rejected`（`labels.js:388`）语义冲突 | `labels.js::REASON_LABEL` 现有键无新码；`wake.denied` 未落地 | 裁决 A 第 4 条冻结 `wake.not-whitelisted`、否决 `wake.denied`、既有键不动（§2.2 / §2.7） |
| 4 | `progress.md` 头部记基线 HEAD `0b12bd8`，与本任务书 / 实跑 HEAD `5406790` 不一致 | 本轮 `git rev-parse --short HEAD` = `5406790`，分支 `feat/i1.12-governance` | 以本任务书给定基线 `5406790` 为准（S0 文档中的旧哈希属过程记录），本拆分不改需求文件 |
| 5 | D-13 行号漂移：点名 `event-bus.js:111-116` 为校验逻辑接入段，实读该段是 `record` 构造与落盘 | `event-bus.js:111` = `{ ...rest, seq, ts, prev_event_hash }`；落盘在 114–117 | 附录 D 前言「文件 / 行号为现状定位，漂移以只改授权清单所列段、保持逐字基线为准」；**裁决 B 第 4 条（SR-03）**：行号以符号锚点为准，新增导出落在 ZERO_HASH 附近若属同一只读校验模块的合理落点即可，不死守 111-116。WP-1 只在 ZERO_HASH 常量附近新增导出、不改写路径（§2.1） |
| 6 | D-2 要求用同一 `canonicalize` 重算，但 `instance-store.js:53-66` 的 `canonicalize` / `hashRecord` 是私有函数未导出 | `grep` 确认未 `export`；该文件不在 D-13 授权清单、属只读基线 | 不改 `instance-store.js`；`event-bus.js` 新增镜像导出 + `chain-compat.test.js` 字节级对拍（§1.1 / §2.1 / §7 风险 11） |
| 7 | `handoff-schema.js` 已有 `HANDOFF_HASH_MISMATCH`（265–275，`source==='previous'` 比对），D-4 又要求追加「指纹一致性」步骤 | 实读 `validateHandoffEvidence` 已含该码与比对；`validateHandoff` 链顺序 306–313 | 两者并存不冲突：既有码属于交接包字段校验，新判定是 D-4 治理侧 `{stale,reason}` 结构；WP-3 唯一负责、追加在链末尾、既有 `CODES` 与顺序不动（§1.3 / §2.3 / §7 风险 15） |
| 8 | `registry/workflows.js:594-604` step 13 已有 wake permissions 静态校验，需求 AC-03/04 要求路由决策点运行时拦截 + reason 事件 | 实读 step 13 只在加载期校验 forward 边权限、不产事件；`orchestrator.js:4435` 既有 `wake.rejected` 属另一场景 | 两者互补、互不替代：静态校验不改，运行时拦截由 `governance.decideWake` + WP-7 接线新增；既有 `wake.rejected` 语义不动（§1.2 / §7 风险 14） |
| 9 | D-13 授权修改清单未点名 `src/cli/roles.js` / `workflows.js`，但 AC-13/14 要求导出闭包与导入验签门禁 | 实读 `roles.js` 的 `exportRole` / `importRole` / `roleCommand` export-import 分发子段、`workflows.js` 的 `workflowCommand` export/import 子段为既有入口 | **裁决 B 已授权**（2026-11-18，效力高于需求正文自声明）：正式扩 D-13 授权清单，授权范围 = `src/cli/roles.js` 的 `exportRole` / `importRole` / `roleCommand` 的 export/import 分发子段、`src/cli/workflows.js` 的 `workflowCommand` 中与工作流包 export/import 相关的子段；**只加不改**——既有 `role export` / `role import` / `workflow` 命令的对外行为、既有文案键、既有失败码逐字保持不变，新增校验以链末尾追加方式接入、不放宽既有断言。WP-4 维持既定交付，SR-01 据此闭合（§2.4 / §7 风险 13） |
| 10 | D-1 建议单一 `governance.js` 承载五类判定，与模板 §1.4「文件零交集 / 一 AC 一组」张力 | D-1 原文「具体文件划分由拆分文档定」 | 拆为 `governance.js`（WP-2）+ `budget.js`（WP-3）+ handoff-schema 追加段（WP-3，D-4 点名），三者无共享文件（§1.7） |

### 8.3 拆分范围自查

- 本拆分的 35 个登记文件与 D-1（新增模块建议）/ D-13（授权修改清单，含裁决 B 扩段）/ AC-13/14 的 Then 需求逐一对得上，**没有超出授权清单的文件**（冲突 9 由裁决 B 正式扩 D-13 授权清单闭合，SR-01 已消解）；没有为绕过 AC 新增「测试专用分支」；没有把任何范围条目挪到范围外。
- round2 六条建议 F2-01~F2-06 全部进 §7 并给出点名处置；AC-21 取证依赖、I1.11 零交集、flake 差集、历史证据恢复全部进 §7；未决 U-01~U-05（不阻塞）按现状假设承接，U-06 已冻结不再列为未决。
- 全量测试条数下限 `≥1425`、purity 31 词双目录、`USAGE_LINES` 25 行、中文唯一来源、零依赖、`transit()` 唯一入口、事件先落盘等不变量全部照旧（BR-19 / NF-4 / AC-22）。

---

## 附录：拆分质量自检结果（模板 §1.5，交付前逐条勾）

| # | 检查 | 结果 |
|---|---|---|
| 1 | 8 节齐全、标题与顺序一致（§0~§8） | PASS（`grep -n "^## " docs/iterations/iteration-12.md` 输出 0~8 共 9 个节标题，节号与顺序与模板 §1.3 一致） |
| 2 | 每条 AC 都出现在某个 WP 的「验收口径」/ 映射表里 | PASS（AC-01~AC-23 在 §4 映射表 23 行全覆盖，主责 WP 唯一） |
| 3 | 每条 AC 都能在需求里找到同号 Then | PASS（需求 v2 AC-01~AC-23 连续，映射表编号连续无缺号无重号） |
| 4 | 所有 WP 的负责文件两两无交集 | PASS（脚本核验：7 个 WP 的负责文件合计 35 条路径，两两交集为空，输出见交付回执 ④） |
| 5 | 依赖图无环，且每个 WP 的依赖编号都存在 | PASS（DAG 边 WP-7 → {1,2,3,4,5,6}，其余无边；人工 + 脚本核验无环） |
| 6 | §0 退出标准逐条可判定 | PASS（8 条均有数字或逐字口径：23/23、差集 0、purity 0、USAGE 25 行、三命令表、状态词 / reason 码、性能三值分级、I1.11 零交集） |
| 7 | §2 每个文件都标注了归属 WP | PASS（35 文件逐条标 WP-1~WP-7；只读基线段显式声明不改、不算负责文件） |
| 8 | §6 有「契约先冻结点」与「整合检查点」 | PASS（冻结点 ①~⑥ + 检查点 1~3） |
| 9 | §7 每条风险都有具体处置（点名文件 / 函数） | PASS（16 条风险全部点名文件 / 函数 / 命令，含 F2 六条与四项移交风险） |
| 10 | §8 声明「不新增需求条目，冲突以需求为准」 | PASS（§8 开头显式声明 + 10 条冲突逐条给裁决出处） |
