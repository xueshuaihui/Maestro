# Nimbus SDK v1.2.0 发布说明

发布日期：2026-11-06 ｜ 适用版本：v1.1.x → v1.2.0 ｜ 预计升级耗时：30–60 分钟

v1.2.0 已发布。本次为 minor 更新，新增流式响应、结构化错误与自动重试等能力；最低运行时要求提升至 Node.js 18。以下内容面向已集成 v1.1 的开发者，建议按「升级步骤」逐项执行。

## 新功能

### 1. 流式响应：`client.stream()`

首字节返回时间从「整段生成完」缩短到百毫秒级，适合对话、长文生成与实时日志场景。

- 返回 `AsyncIterable<StreamEvent>`，事件类型为 `start`、`delta`、`done`、`error`。
- 断线后不会自动续传，需按 `event.id` 去重；调用 `controller.abort()` 会抛出 `AbortError`，服务端同时停止计费。

```js
const stream = await client.stream({ model: "nimbus-1", input: prompt });

for await (const event of stream) {
  if (event.type === "delta") process.stdout.write(event.text);
  if (event.type === "done") console.log("\ntokens:", event.usage.totalTokens);
}
```

> **注意**：流式与非流式共用配额；`stream()` 不支持 `responseFormat: "json"`，需要结构化输出时仍用 `request()`。

### 2. 结构化错误与自动重试

错误可编程判断，重试策略内置，减少手写 `try/catch + sleep` 样板代码。

- 所有错误继承 `NimbusError`，字段包括 `code`、`status`、`retryable`、`requestId`、`retryAfterMs`。
- 默认对 `429`、`5xx` 和网络超时重试 3 次，指数退避 + 抖动；`401`、参数校验失败等 `retryable: false` 的错误不重试。
- `maxRetries`、`retryBaseDelayMs` 可覆盖默认值，设为 `0` 可完全关闭。

```js
import { NimbusError } from "@nimbus/sdk";

try {
  await client.request({ path: "/v1/generate", body });
} catch (err) {
  if (err instanceof NimbusError) {
    logger.warn({ code: err.code, requestId: err.requestId });
    if (!err.retryable) throw err;
  }
  throw err;
}
```

> **注意**：重试只保证请求被再次发送，不保证幂等；写操作请自行传 `idempotencyKey`。

### 3. 令牌自动刷新与并发单飞

长驻服务不再因为 access token 过期出现周期性 `401`。

- `auth.refresh()` 可手动刷新；`autoRefresh` 默认开启，在过期前 60 秒自动刷新。
- 并发请求共享同一次刷新（single-flight），不会打出刷新风暴。
- 刷新失败会清空缓存并抛出 `NimbusAuthError`，需重新走授权流程。

```js
const client = new NimbusClient({
  auth: { clientId, clientSecret, autoRefresh: true },
});
```

> **注意**：多实例部署时每个进程各自缓存，属预期行为；如需全局一致，请接入共享缓存适配器（v1.2 未内置）。

### 4. 可观测性钩子

无需改业务代码即可采集请求耗时、重试次数与错误码，并兼容 OpenTelemetry。

- 新增 `instrumentation` 配置，回调事件：`request.start`、`request.end`、`retry`、`stream.end`。
- 事件对象包含 `requestId`、`attempt`、`durationMs`、`status`，不包含请求体与响应体。
- 可直接对接 `@opentelemetry/api` 的 tracer。

```js
new NimbusClient({
  instrumentation: {
    onEvent: (e) => metrics.record(e.name, e.durationMs, { status: e.status }),
  },
});
```

> **注意**：回调在请求关键路径上同步执行，禁止放入阻塞逻辑；回调异常会被吞掉并计数，不影响主流程。

### 5. 类型与工具链增强

减少 `any` 与手写类型断言，并提供官方迁移命令。

- 导出 `NimbusClientOptions`、`StreamEvent`、`NimbusErrorCode` 等公共类型。
- `client.request<T>()` 的 `T` 会校验路径字面量，需 TypeScript >= 4.9。
- 新增 CLI：`nimbus migrate`（配置迁移，自动备份）与 `nimbus codemod`（批量改写弃用 API）。
- 双格式发布，`import { NimbusClient } from "@nimbus/sdk"` 可直接使用，CJS 侧 `require` 行为不变。

```bash
npx nimbus codemod timeout-to-timeoutMs src
```

> **注意**：codemod 只处理静态字面量，动态拼接的配置需人工复核；执行前保持工作区干净，便于用 `git diff` 回看。

## 升级步骤

按顺序执行以下 8 步；每步附预期结果与失败处理。

### 1. 前置检查

```bash
node -v          # 必须 >= 18
npm -v           # 建议 >= 9
git status --short
```

预期工作区干净且 Node 版本达标。若仍为 Node 16，先升级运行时并同步 CI 镜像，否则 `npm ci` 会因 `engines` 字段直接失败。

### 2. 备份

```bash
cp package-lock.json package-lock.v1.1.bak.json
cp nimbus.config.json nimbus.config.v1.1.bak.json
```

迁移命令也会自动备份，手工备份用于覆盖迁移中断的场景。

### 3. 升级依赖

```bash
npm install @nimbus/sdk@1.2.0
# pnpm add @nimbus/sdk@1.2.0
# yarn add @nimbus/sdk@1.2.0
```

私有 registry 需先同步 `@nimbus/sdk@1.2.0`，否则本步会返回 404。

### 4. 迁移配置

```bash
npx nimbus migrate --from 1.1 --to 1.2 --dry-run
npx nimbus migrate --from 1.1 --to 1.2
```

先执行 dry-run，核对将改写的字段（如 `timeout` → `timeoutMs`）后再正式执行；正式执行会生成 `nimbus.config.v1.1.bak.json`。

### 5. 替换弃用 API

```bash
npx nimbus codemod timeout-to-timeoutMs src
npx nimbus codemod requestRaw-to-request src
```

执行后务必 `git diff` 复核，codemod 不保证语义等价。

### 6. 类型检查与测试

```bash
npx tsc --noEmit
npm test
```

重点回归错误处理分支：原先依赖 `err.response.status` 的代码需改为 `err.status`，否则会得到 `undefined`，导致错误分类静默失效。同时检查超时配置与鉴权刷新。

> **注意**：`timeout` 仍可用但会打印一次警告；CI 若开启 `--fail-on-warn`，本步会失败。

### 7. 灰度发布

先放 1 个实例或 5% 流量，观察 30 分钟。关键指标：5xx 比例、P95 延迟、`NimbusError.code` 分布、`401` 次数。可用环境变量 `NIMBUS_STREAMING=0` 临时关闭流式能力，不影响其他新功能。

### 8. 全量与观察

指标平稳后逐步放量。旧版本镜像保留至少 24 小时，确认稳定后再清理。
