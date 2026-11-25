# 统一资源平台：把四个「壳子」接成一条可维护的闭环

> 2026-11-25。用户定性：四个模块都只有展示壳，缺少「可维护、可沉淀」的完整闭环。
> 本文是施工蓝图，不是验收报告。结论均来自 grounded 源码核对（见 §1）。

## 1. 现状：三套数据域，四个半闭环

| 数据域 | 位置 | 谁能写 | 谁能删 | 谁能回流 |
|---|---|---|---|---|
| 内置资产 | `assets/roles`(16) / `assets/skills`(10) / `assets/workflows` | 无人（HTTP 全 GET） | 无 | 仅 CLI `--from` 派生 |
| 项目编排 | `.orch/studio.json`（单文档原子写） | domain 全可写，HTTP/UI 只暴露增改 | domain 有 `remove*`，HTTP/UI 一条没接 | 只编译期单向导出到 YAML |
| 引擎执行 | `.orch/instances/<id>/*`（完整落盘） | 建/暂停/继续/取消 | 无 delete/archive/clone | 无 instance→template，UI 导出仅 toast |

结果：用户建得出东西，但删不掉、归档不了、导不出、也带不到下一段。运行按钮 `run.start` UI 写死 `simulate`，产物正文自述 `contains no model output`。

## 2. 目标形态

**一个项目资源库 + 一层统一门面 + 四条闭环链路**。不是新数据库，是把 `.orch/studio.json` 升级成项目资源真相源，内置资产以只读镜像挂进同一个视图。

### 2.1 统一资源类型与 meta

类型：`department / role / skill / employee / team / flow / instance / run`。

每个资源在统一视图里带一组稳定 meta（不改动各域原有内部结构，用投影产生）：

| 字段 | 含义 |
|---|---|
| `id` / `type` | 资源标识与类型 |
| `name` / `description` | 展示名与说明 |
| `source` | `builtin`（只读镜像）/ `project`（本项目可写） |
| `origin` | 派生来源（fork 自哪个 builtin id），无则 null |
| `archived` | 归档标记（归档=可恢复，不物理删除） |
| `createdAt` / `updatedAt` | 时间戳 |

### 2.2 四条闭环链路

1. **资产 ↔ 项目**：`fork(asset)` 把内置角色/技能/工作流复制成项目可编辑副本；项目资源 `export` 成可导入包；引用追踪谁用了谁。
2. **项目 → 实例**：`flow.run` 把 Studio flow 编译成执行图（复用 `compileStudio` + 新增 YAML→graph 适配），注入 orchestrator 的 graphs，真正启动实例。
3. **实例 → 资产**：完成的实例 `saveAsTemplate` 生成工作流模板 / 技能草稿；导出走真实 OTLP（CLI `orch export` 已实现，接到 UI）。
4. **全资源生命周期**：list / get / create / update / remove（归档式）/ archive / restore / clone / export / import，UI 与 HTTP 一一对应。

## 3. 分层与文件规划

```
src/resources/           新增：统一门面（本项目唯一的新增域）
  types.js               资源类型常量 + meta 投影
  facade.js              list/get/create/update/remove/archive/restore/fork/clone/export/import
  refs.js                引用完整性（删除前检查谁引用了它）
  index.js               barrel

src/daemon/http/resources-routes.js  新增：/resources 路由，转调 facade
src/daemon/http/server.js            挂载（与 createStudioRoutes 并列）

src/cli/labels.js         新增文案键（中文唯一来源）
desktop/ui/               零 CJK 字面量；文案走 /ui/labels + /studio/labels
```

**兼容纪律**：旧 `/studio/action` 的 21 个 action 形状逐字保留，内部转调 facade；不碰 `src/core,src/daemon` 的图/角色字面量纯净门禁；不碰 I1.1 默认图逐字输出。

## 4. 施工顺序（依赖驱动）

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0 | 资源门面 + 统一 meta + 引用检查 + 单测 | `node --test test/wp20/*.test.js` |
| P1 | HTTP 路由 + 旧 action 转调兼容 | HTTP 契约测试，21 action 形状不变 |
| P2 | 搭建台 CRUD 接线（部门放开 + remove + 真实运行） | 真实浏览器全链路 |
| P3 | 角色库可维护（fork / CRUD / 导入导出 / 双向同步） | 真实浏览器全链路 |
| P4 | 画布→实例（编译适配 + daemon 加载 + 启动） | 端到端真实 CLI 实例 |
| P5 | 实例维护与沉淀（delete/archive/clone/rename/export/saveAsTemplate） | 真实浏览器 + 单测 |
| P6 | 统一资源平台 UI | 五套真实浏览器验收 |
| P7 | 全量差集 + 文档 + 发版 | 新增红 0；Release 匿名核验 |

## 5. 明确不做

- 不重写编排引擎：状态迁移、事件、证据、四层状态全保留。
- 不把 `assets/` 内置资产改为可写：内置只读，改动只能发生在 fork 出来的项目副本上。
- 不在 UI 写图/角色字面量：走 labels（`code-loop` / `task-loop` 这类字面量曾被 AC-28 门禁抓到过）。
- 不靠重试掩盖失败：任何一次 `STORE_CONFLICT`、`FAIL` 都要先定位再判。
