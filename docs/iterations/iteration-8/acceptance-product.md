# I1.8 真实宿主面验收（ACP 恢复方言）

| 项 | 内容 |
|---|---|
| 宿主 | DeepSeek Harness 内置 acp app，实测版本 **`0.2.2-rc.5`**（需求记 `0.2.2-rc.1`，按裁-13f 实测优先） |
| 入口 | `ELECTRON_RUN_AS_NODE=1 "<dir>/DeepSeek Harness.exe" "<dir>/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"`（本机**无** `dsh` CLI） |
| 隔离 | `DSH_HOME` 指向 `%TEMP%` 新建目录，复制 `~/.dsh/.credentials.yaml`（用完删除）；patch 层把 `agent-default-model` 与 `acp` 两行 provider 改为 `deepseek-account`；**不动用户 `~/.dsh`** |
| 分帧 | NDJSON（按 `\n` 切行），**不是** LSP `Content-Length` |
| 驱动 | `probe/acc8-realhost.mjs` 的 `realCrashRecovery()`（真跑一次，三条 AC 共用） |
| 证据 | `evidence/acc8/AC-25.*` / `AC-26.*` / `AC-27.*` / `AC-57.*` / `docs/iterations/iteration-8/evidence/wp7/**`（S2 阶段 43 帧） |

## 逐条核对

### AC-25 真实 DSH：只广告 resume、不广告 load，恢复走 resume —— **通过**

| 核对点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| `initialize` 的 `sessionCapabilities` 键集 | 含 `close`/`list`/`resume`，不含 `load` | 一致 | ✅ |
| `instance log` 方言行 | 只含 `session/resume` | 一致 | ✅ |
| 实例状态 | 运行中 | 一致 | ✅ |
| 已完成节点 | 不再重跑 | `node.dispatch` 无第二次 | ✅ |

证据：`AC-25.then.dialect.json`、`AC-25.then.status.txt`、`AC-25.then.prompt-log.ndjson`。

### AC-26 真实 DSH：重启不重复已完成节点 —— **阻塞**

| 核对点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 已完成节点无第二次 `node.dispatch` | 0 | 0 | ✅ |
| 恢复前后 `workspace/artifacts/**` 的 mtime/sha256 不变 | 逐条不变 | **该目录不存在**（产物在 I1.7 `worktrees/` 与 `stage/`，强杀窗口内 `stage/` 为空） | ⛔ 不可取证 |
| 恢复摘要可见 | 有 | 有 | ✅ |

**判定：阻塞**。按 NFR-08 不用空集冒充通过、不用替代目录冒充（裁-20 与终验 §3 一致）。修复：`test/fixtures/recovery-driver.mjs` 需在强杀窗口内保留 `workspace/artifacts/**`，或在编码闭环下改锚点到 `stage/`。

### AC-27 第三方 `load` 方言：真实可用则真验，否则阻塞 —— **阻塞**

| 核对点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| `dsh-acp-server` 可安装 | 是 | `added 95 packages`（v0.14.4） | ✅ |
| bin 可启动 | 是 | `ERR_UNSUPPORTED_ESM_URL_SCHEME … Received protocol 'c:'` | ⛔ |
| `session/load` 真实往返 | 可观测 | 进程未起来，无法观测 | ⛔ |

**判定：阻塞**。根因：本机只有 Electron + `app.asar/bin.js`，无 `dsh` CLI，第三方包按 `dsh` 可执行文件假设启动。**未用夹具冒充**。原始 stderr 已落帧。

### AC-57 真实宿主写 cwd 内文件不触发 `session/request_permission` —— **通过**

| 核对点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 写 cwd 内文件 | 不产生审批请求 | 一致 | ✅ |
| 「等待审批」只由夹具触发 | 是 | 一致 | ✅ |

证据：`AC-57.then.events.jsonl`、`AC-57.then.permissions.json`。

## 耗时

耗时**未逐项计时**。单条真实宿主 AC 的起止时间以 `_acc8-f-results.jsonl` 的 `startedAt` / `endedAt` 为准（AC-25/26/57 共用一次真跑，`realCrashRecovery` 有进程内缓存）。

**边界**：真实模型输出不可完全复现，故真实面只断言「结构化事实」（方言选择、节点不重跑、状态），不对模型文本做逐字断言。
