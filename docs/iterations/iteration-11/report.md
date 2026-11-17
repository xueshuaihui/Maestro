# I1.11 实现报告 · 通知、人工干预队列与只读浏览面

## 抬头

| 项 | 内容 |
|---|---|
| 依据 | `docs/iterations/iteration-11/requirement.md` **v14**（49 AC / 37 BR / 8 NF；附录 C v1~v14 只补不减） |
| 拆分与契约 | `docs/iterations/iteration-11.md`（10 WP：WP-1~6 投影层 → WP-7 HTTP 面 → WP-8/9 并行 UI/壳层 → WP-11 回归整合）；§2.1~2.11 冻结的模块签名零偏差 |
| 验收记录 | `acceptance-fixture.md`（49 节）；`probe/acc11-f-{results.jsonl,summary.json,blockers.md}`；`probe/acc11-f-parts/`；`docs/iterations/iteration-11/evidence/`（49 目录 / 588 文件）；`final-verification.md`（终验六项 PASS） |
| 评审记录 | `review-round1.md`（FAIL 8 阻断）→ `round2.md`（FAIL 6）→ `round3.md`（FAIL 5）→ `round4.md`（**PASS**，0 阻断 / 6 建议）；共 **4 轮**，最终 PASS 轮号 = 4 |
| 环境 | macOS（darwin），Node ≥ 22，Tauri 2 / notify-rust 4；基线 `66e5a6b`；分支 `feat/i1.11-notify-queue-assets` |
| 完成时间 | 2026-11-17 |

## 0. 总体结论

**达成退出标准**——49/49 AC 全部通过、零不通过、零阻塞；全量测试 1606 条（失败集合与判定基线差集 0）、31 词 purity 双扫 exit 0、零第三方依赖、三主链逐字 diff 0；独立终验六项全 PASS。

| 判定项 | 结果 |
|---|---|
| AC | **49 通过 / 0 不通过 / 0 阻塞**（704 条核对项、588 份证据） |
| 全量测试 | **1606 / 1600 pass / 4 fail / 2 skip**；4 条失败全在判定基线内，差集 0；条数 ≥ 1425（D-21 禁 `fail===0`） |
| 架构扫描 | 31 词 × `src/core,src/daemon`（37 文件）+ `desktop/ui`（22 文件）均 exit 0；CJK 代码行 0；deps 0；`cargo check` exit 0 |
| 回归红线 | `single` / `code-loop` / `task-loop` 三主链各 ×2，A-0 归一化逐字命中基线 **6/6，diff 0**；既有 8 条 HTTP 路径与 `shapeSnapshot` 函数体逐字未改 |
| 阻断级缺陷 | **0**；S3 期 5 条初判不通过（AC-12/13/15/18/27/39）与 1 条接缝缺口（AC-30）全部裁决闭环并复跑通过 |

**能力结论**：本机新增三类通知（升级/完成/异常）与 10s/60s 双窗口去重、跨实例人工干预队列与五动作经既有 CAS 的安全处置、角色/技能/工作流资产库只读浏览、跨实例角色占用、定义态工作流画布、节点证据只读投影——桌面五视图与壳层托盘/通知投递全部接通，未引入任何产品第三方依赖。

**最难一条实测证据**：AC-38 三段端到端（`notify` SSE 意图 → `/queue` 投影 → 真 CAS 重派 → `/evidence` 与三处数字同步）在短 TMPDIR 下 **21/21 核对项通过**，原始帧见 `evidence/AC-38/`（17 文件）。

## 1. 交付物

- **产品代码**：基线 `66e5a6b` 起 74 文件变更、约 23,441 行新增；新增 7 个 daemon 投影模块（`notify.js` / `prefs.js` / `queue.js` / `assets-view.js` / `occupancy.js` / `canvas.js` / `evidence.js`）、HTTP 路由 738 行、桌面视图模型 6 个、`app.js` 五视图接线、Tauri 托盘/探针/配置/通知链路（`main.rs` 548 行）；**dependencies 0**。
- **测试与夹具**：`test/wp14/` 14 个测试文件（域测试 + UI + shell + 回归整合），新增用例合计 1606 条（含既有 1425 基线）；5 个 harness dump（queue/assets/occupancy/canvas/evidence）；`probe/acc11-cases/` 49 用例 + `_template`。
- **验收产物**：49 目录 / 588 份原始帧（TAP / state / events / arch log / check.json / meta.json），704 条核对项，0 空文件。

## 2. AC 逐条判定 / 需求范围对照

49 条 AC 逐条判定见 `acceptance-fixture.md` 与 `probe/acc11-f-parts/AC-01.md`~`AC-49.md`。汇总：

| 范围 | AC 编号 | 结论 |
|---|---|---|
| 通知（A-1、A-2） | AC-01~07、AC-42、AC-43、AC-49 | 13/13 通过（AC-06 按 D-46 判读：意图组去重计数 1、`mergedCount` `[1,2,3,4]` 单调递增） |
| 队列与处置（A-3、A-4） | AC-08~18、AC-44、AC-47 | 14/14 通过 |
| 资产库（A-5） | AC-19~25、AC-46 | 8/8 通过 |
| 占用（A-6） | AC-26~28 | 3/3 通过 |
| 画布（A-7） | AC-29~31、AC-45 | 4/4 通过（AC-30 补交互断言后 14/14 核对项） |
| 证据（A-8） | AC-32~34 | 3/3 通过 |
| 壳层（A-9） | AC-35~37、AC-48 | 4/4 通过（U-13 真探针按旧二进制 SKIP，证据降级非阻塞） |
| 整合/非功能 | AC-38~41 | 4/4 通过（AC-40 三主链 6/6 diff 0） |

需求 §1.3 范围内条目与 10 个 WP 交付项 100% 有结论；详细覆盖表见 `final-verification.md` 校验 1。

## 3. 验收中发现并修复的缺陷 / 证据分级

| # | 现象 | 根因 | 处置（commit / 裁决） | 复验 |
|---|---|---|---|---|
| 1 | AC-12/13 初判不通过 | 架构锚点写在 daemon 层，但事实在核心/否定语境注释；AC-13 fixture 角色与 Given 对调 | **D-54**：锚点归位核心、排除注释行；`queue.test.js` fixture 按 Given 整改；需求 v11 | 13/13 批次 A 全绿 |
| 2 | AC-15/18 初判不通过 | 错误码/结论词事实在核心；`tray-status` 探针字段名是需求自身要求下发 | **D-55**：AC-15 锚点归位核心 + 结论表；AC-18 零命中改零自算；需求 v12 | 13/13 批次 B 全绿 |
| 3 | AC-27 初判不通过 | `unavailable` 命中是五档排序词表键引用（非自造状态） | **D-56**：排除词表键引用 + 断言 `FALLBACK_WORD=inactive`；需求 v13 | 17/17 |
| 4 | AC-30 接缝缺口 | 机检四件事（拖拽/views/事件名/选中态）只有数据侧用例覆盖 | **D-57**：补 `canvas-interaction.test.js`（369 行/4 用例），不放宽 | 14/14 |
| 5 | AC-39 初判不通过 | `/ui/prefs` 是 D-42/D-51 授权写，D-1 名单字面漏同步 | **D-58**：名单纳入 `/ui/prefs`（仅四键、不计入三数字）；需求 v14 | 28/28 |
| 6 | AC-14/18/35/38 `EADDRINUSE` | macOS socket `sun_path` 104 字节上限，长 TMPDIR 叠加到 119 字节 | 验收夹具改短 TMPDIR（`/tmp/m11*`），**断言一条未改** | 复跑全绿 |

**证据分级**：本机无真实宿主面（Cursor 无 `cursor-agent` CLI；DSH 凭据隔离与真实会话耗时不适合 49 条 AC 逐条取证），**全部 49 条为 `mock 实测`**；U-13 的 shell 真探针按旧二进制条件 SKIP，显式登记为证据降级，未伪写「已实测（真实宿主）」。原始帧见 `evidence/AC-XX/`。

## 4. 门禁与复现

```bash
# 全量测试（1606/1600/4/2skip；失败集合与基线差集 0，禁 fail===0）
env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"
# purity 双扫（31 词，exit 0）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check
node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid <同上 31 词>
# 壳层编译（exit 0）
cargo check --manifest-path desktop/src-tauri/Cargo.toml
# 三主链（exit 0/4/4 与基线一致，A-0 归一化逐字 diff 0；详见 test/wp14/regression.test.js）
node bin/orch.js run --cwd <tmp> --template single|code-loop|task-loop --host mock --task <task>
# 逐 AC 验收（49/49；批次 a=01~13 / b=14~26 / c=27~38 / d=39~49）
node probe/acc11-f-run.mjs AC-XX
node probe/acc11-f-run.mjs --batch a|b|c|d
node probe/acc11-f-final.mjs
```

## 5. 遗留问题与边界

1. **真实宿主面未逐 AC 取证**：本迭代 49 AC 全部为 `mock 实测`（见上节证据分级）；AC-35/36/48 的 shell 真探针因本机 release 二进制早于 `main.rs` 改动而 SKIP——静态契约 11 条已覆盖分发/事件/退出语义，`npm run desktop:build` 后真实层用例自动启用。不影响本迭代结论（U-13 允许无头环境降级）。
2. **AC-30 手势手感**：机检四件事已补（`canvas-interaction.test.js` 4/4）；真实鼠标缩放/平移的体感按 U-13 留人工核验，不属机检范围。
3. **读时健康度受控写**（D-53）：挂起+待处理现场纯浏览 `/queue` 会触发 `getStatus` 的首次健康度写（I1.9 D-17 既有行为）；AC-39 Given 限「运行中且 health 已计算」，该受控写不计面板写。核心未改。
4. **live/磁盘快照脱节**（D-45）：失败重派路径下 live 快照可能滞后磁盘；AC-18/38 数据侧断言统一用磁盘快照 + `buildQueue`，引擎行为不在本迭代修。
5. **判定基线 4 条**：AC-04（R-08 允许项）、`task-loop 审核提示词`、`core.stop`、`main --cwd` 为历史允许失败，差集 0 口径成立；非本迭代引入。

## 6. 与前序迭代的关系

- **复用**：I1.10a 桌面 UI 基座（`app.js` / `connection.js` / `graph/layout.js` / labels 下发通道）、I1.9 追踪与健康度、I1.8 实例恢复、I1.1~I1.3 的 ACP 核心与 CAS 状态机；通知/队列/资产/占用/画布/证据六个投影层全部只读复用既有注册表、事件总线与 store，**零核心行为改动**。
- **改契约**：`/ui/labels` 键表 154→249（A-11 顶层 `DESKTOP_*` 95 键 + 5 导航键，D-51）；D-1 写名单五条→六条（`/ui/prefs`，D-58）；占用行增第 8 字段 `hosts`（A-6 第 6 段所需，D-48）；AC-12/15/18/27/39 架构锚点归位（D-54~D-58）——均为只补不减，AC/BR/NF 数量未变。
- **回归保证**：三主链逐字 6/6 diff 0（A-0 归一化）；既有 8 条 HTTP 路径与 `shapeSnapshot` 函数体逐字未改；31 词 purity 双扫 exit 0；全量 1606 测试失败集合与历史基线差集 0；终验 `final-verification.md` 六项 PASS。

## 附录 · 命令速查

| 目的 | 命令 |
|---|---|
| 全量门禁 | `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"` |
| 单域测试 | `node --test test/wp14/{notify,prefs,queue,assets,occupancy,canvas,evidence,http-contract,ui-views,shell-notify,regression,contract,e2e,canvas-interaction}.test.js` |
| 逐 AC / 批次 | `node probe/acc11-f-run.mjs AC-12` / `--batch a\|b\|c\|d` |
| 重建验收报告 | `node probe/acc11-f-final.mjs` |
| 壳层校验 | `cargo check --manifest-path desktop/src-tauri/Cargo.toml` |
| 裁决台账 | `docs/iterations/iteration-11/decisions.md`（D-01~D-58） |
