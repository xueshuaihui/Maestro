# I1.2 验收记录（夹具面）

> 依据：`docs/iterations/iteration-2/requirement.md` **v15** §3.1（AC-01~46，AC-17/AC-30 作废）、§3.2 NFR、§3.3 前置条件、附录 A（输出基线）/ D（文案与错误码逐字表）。
> 执行：Windows / Git Bash / Node v22.22.2；项目根一律 `%TEMP%/maestro-acc-f2/proj/<case>/`；**mock 宿主**（`--host mock`），无真实模型凭据、不设 `DSH_HOME`。
> 本文件由 `probe/acc2-f-*.mjs` 分 4 批生成，每批结束即落 `evidence/AC-xx.*` 与分节中间结论，本脚本补 §0/§2/§3/§4 并规范化重排。

## 0. 总判

**39 条：通过 39 / 不通过 0 / 阻塞 0 ｜ NFR（夹具可测 6 项：通过 6 / 不通过 0）**

- 范围：除 AC-01 / AC-03 / AC-21 / AC-22 / AC-45（真实面，由并行 Agent 负责）外的全部 39 条 AC；AC-17 / AC-30 已作废不在内。
- 证据文件：`evidence/AC-xx.{meta.json,output.json,state.json,events.jsonl}` 共 171 个，另 `evidence/NFR-xx.*`。
- 不通过 / 阻塞条目：无。
- NFR：NFR-04 → AC-09、NFR-05 → AC-10、NFR-06 → AC-11/AC-42、NFR-09 → AC-12 已在对应 AC 中真跑覆盖；NFR-01a/01b(热)/02/03/07/08 单独真跑；NFR-01b「冷启动 30 秒」以真实 DSH 未拉起为前提，属真实面，夹具面不覆盖。

### 复验说明（首轮 34 通过 / 4 不通过 / 1 阻塞 → 修复后 39 通过）

首轮按 **v15** 逐条真跑，5 条未通过。主 Agent 按「不伪造、不放宽断言」原则定位根因并修复后，重跑批 2 / 批 3 并重建本报告：

| AC | 首轮 | 根因归属 | 处置 | 复验 |
|---|---|---|---|---|
| AC-14 | 不通过 | 产品 + 夹具 | `parseVerdict` 去掉 `result` 别名（§3.3 要求 `verdict` 严格 pass/fail）；`verdict-no-field` / `verdict-maybe` 拆成两个独立样本 | 通过 24/24 |
| AC-15 | 不通过 | 需求观测点不可构造 | 需求升 **v16**：`When` 改为 `--stop-after 3` 中间态（终态会覆盖第 1 轮判定），4 条 Then 逐字保留 | 通过 8/8 |
| AC-25 | 阻塞 | 夹具 | `attempt-transition.mjs` 的 `readObjectState` 适配 v2 `nodes[]` / `handoffs[]` 并按 `--node` 定位 | 通过 3/3 |
| AC-31 | 不通过 | 产品锁粒度 | `startRun` 在取目录锁前对活 `code-loop` 实例无锁快拒 `INSTANCE_RUNNING`（`single` 保持 I1.1 `NODE_BUSY`） | 通过 14/14 |
| AC-32 | 不通过 | 产品锁粒度 | `seamDispatch` 在取实例锁前读磁盘判定 `isNodeBusyState`，无锁快拒 `NODE_BUSY` | 通过 5/5 |

另有独立评审的 2 个阻断项（BLK-01 AC-28 架构扫描、BLK-02 AC-42 二次取消文案）已在验收前修复并纳入本轮重跑；处置详见 `review-round2.md`。
**证据分级**：本文件 39 条全部为 **mock 实测**（产品 CLI `bin/orch.js` + mock 宿主经 `host-config → stdio NDJSON → acp-client` 同一链路）；真实宿主结论见 `acceptance-product.md`（5/5 通过）。
**版本口径**：除 AC-15 按 v16 复验外，其余 38 条仍按 v15 首轮证据 + 修复后重跑证据；两条验收报告的头部保留各自执行时的依据版本，不追溯改写。

## 1. AC 逐条记录（命令 / 原始输出 / 状态证据 / 判定）

> 「原始输出」全文在 `evidence/AC-xx.output.json`（每条命令的 stdout+stderr 原样）；「状态证据」全文在 `evidence/AC-xx.state.json` 与 `evidence/AC-xx.events.jsonl`。下文为关键行/字段摘录与逐字判定。

#### AC-02 顺序推进，执行区间不重叠

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac02`（叙事实例号 `INST-201`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（mock 宿主复现产品成功路径 + 产品命令 status --events）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario code-pass] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac02 --scenario code-pass   | cwd=D:\WWW\Maestro | exit=0 | 1291ms
[orch status --instance INST-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac02 | exit=0 | 217ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-02.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac02","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac02\\demo-code-pass","scenario":"code-pass","resolvedScenario":"pass","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"done"}],"handoffs":1,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":890,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 done","ok":true},{"name":"handoffs=1 forward","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:06:12
交接包 HO-001  开发→测试  已投递   21:06:13
交接包 HO-001  开发→测试  已接受   21:06:13
交接包 HO-001  开发→测试  已完成   21:06:13
实例 INST-001 · 已完成 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过
会话 空闲
交接包 HO-001  开发→测试  已构造   21:06:12
交接包 HO-001  开发→测试  已投递   21:06:13
交接包 HO-001  开发→测试  已接受   21:06:13
交接包 HO-001  开发→测试  已完成   21:06:13
[#1] 21:06:12  实例 INST-001  已创建 → 运行中  原因 开始运行
[#2] 21:06:12  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮
[#3] 21:06:12  会话 mock-sess-16372-1  空闲 → 执行中  原因 会话状态
[#4] 21:06:12  会话 mock-sess-16372-1  执行中 → 执行中（tool_call）  原因 会话状态
[#5] 21:06:12  会话 mock-sess-16372-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#6] 21:06:12  会话 mock-sess-16372-1  执行中 → 等待下游  原因 产出已提交
[#7] 21:06:12  节点 T-001  执行中 → 待校验  原因 产出已提交
[#8] 21:06:12  节点 T-001  待校验 → 已完成  原因 核对通过
[#9] 21:06:12  会话 mock-sess-16372-1  等待下游 → 空闲  原因 运行完成
[#10] 21:06:12  交接包 HO-001  已构造  原因 构造交接
[#11] 21:06:12  节点 T-002  派发 → 执行中  原因 派发 · 第 1 轮
[#12] 21:06:13  交接包 HO-001  已构造 → 已投递  原因 交接已投递
[#13] 21:06:13  会话 mock-sess-27492-1  空闲 → 执行中  原因 会话状态
[#14] 21:06:13  交接包 HO-001  已投递 → 已接受  原因 首个事件
[#15] 21:06:13  会话 mock-sess-27492-1  执行中 → 执行中（tool_call）  原因 会话状态
[#16] 21:06:13  会话 mock-sess-27492-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#17] 21:06:13  会话 mock-sess-27492-1  执行中 → 等待下游  原因 产出已提交
[#18] 21:06:13  节点 T-002  执行中 → 待校验  原因 产出已提交
[#19] 21:06:13  节点 T-002  verdict.read  原因 读取判定
[#20] 21:06:13  节点 T-002  待校验 → 已完成  原因 核对通过
[#21] 21:06:13  交接包 HO-001  已接受 → 已完成  原因 产出核对通过
[#22] 21:06:13  会话 mock-sess-27492-1  等待下游 → 空闲  原因 运行完成
[#23] 21:06:13  实例 INST-001  运行中 → 已完成  原因 运行完成
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-02.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 23,
  "counters": {
    "eventSeq": 22,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:06:13.149Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-16372-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-27492-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:12.885Z",
      "deliveredAt": "2026-11-05T13:06:13.107Z",
      "acceptedAt": "2026-11-05T13:06:13.111Z",
      "consumedAt": "2026-11-05T13:06:13.155Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-02.events.jsonl`）：

```
ac02/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-e7163e05c270e0d0","seq":1,"ts":"2026-11-05T13:06:12.590Z"}
ac02/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-e7163e05c270e0d0","seq":2,"ts":"2026-11-05T13:06:12.596Z"}
ac02/INST-001 {"object":"session","objectId":"mock-sess-16372-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-e7163e05c270e0d0","seq":6,"ts":"2026-11-05T13:06:12.844Z"}
ac02/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-e7163e05c270e0d0","seq":7,"ts":"2026-11-05T13:06:12.852Z"}
ac02/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-e7163e05c270e0d0","seq":8,"ts":"2026-11-05T13:06:12.866Z"}
ac02/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-e7163e05c270e0d0","seq":11,"ts":"2026-11-05T13:06:12.896Z"}
ac02/INST-001 {"object":"session","objectId":"mock-sess-27492-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-e7163e05c270e0d0","seq":17,"ts":"2026-11-05T13:06:13.134Z"}
ac02/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-e7163e05c270e0d0","seq":18,"ts":"2026-11-05T13:06:13.142Z"}
ac02/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-e7163e05c270e0d0","seq":19,"ts":"2026-11-05T13:06:13.149Z"}
ac02/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-e7163e05c270e0d0","seq":20,"ts":"2026-11-05T13:06:13.154Z"}
ac02/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883973155},"gen":"gen-e7163e05c270e0d0","seq":21,"ts":"2026-11-05T13:06:13.155Z"}
ac02/INST-001 {"object":"session","objectId":"mock-sess-27492-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-e7163e05c270e0d0","seq":22,"ts":"2026-11-05T13:06:13.160Z"}
ac02/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-e7163e05c270e0d0","seq":23,"ts":"2026-11-05T13:06:13.178Z"}
```

**④ 判定**：通过（断言 4/4 通过）

- ✅ 输出里恰有 2 行匹配「节点 T-00n  派发 → 执行中  原因 派发 · 第 N 轮」（期望 2）
- ✅ 两行 n 依次为 1、2（期望 "1,2"）
- ✅ 两行的 [#序号] 严格递增
- ✅ 不存在 [#序号] 更小、含「节点 T-002」且含「执行中」的行出现在「节点 T-001」的「待校验 → 已完成」之前



---

#### AC-04 节点表能看全两行、轮次与两条方向的交接包

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac04`（叙事实例号 `INST-202`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合（夹具推进 + 产品命令 status）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-hold --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac04 --scenario retest-hold --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac04 | exit=0 | 95ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-04.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 执行中 · 第 2 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   21:06:14
交接包 HO-001  开发→测试  已投递   21:06:14
交接包 HO-001  开发→测试  已接受   21:06:14
交接包 HO-001  开发→测试  已完成   21:06:14
交接包 HO-002  测试→开发（回流）  已构造   21:06:14
交接包 HO-002  测试→开发（回流）  已投递   21:06:15
交接包 HO-002  测试→开发（回流）  已接受   21:06:15
交接包 HO-002  测试→开发（回流）  已完成   21:06:15
交接包 HO-003  开发→测试（复测）  已构造   21:06:15
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-04.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 38,
  "counters": {
    "eventSeq": 40,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "running",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:06:14.788Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-34012-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-15108-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33920-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-22112-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "tool_running",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:14.461Z",
      "deliveredAt": "2026-11-05T13:06:14.695Z",
      "acceptedAt": "2026-11-05T13:06:14.699Z",
      "consumedAt": "2026-11-05T13:06:14.791Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:14.822Z",
      "deliveredAt": "2026-11-05T13:06:15.055Z",
      "acceptedAt": "2026-11-05T13:06:15.061Z",
      "consumedAt": "2026-11-05T13:06:15.105Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:06:14.822Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "accepted",
      "createdAt": "2026-11-05T13:06:15.124Z",
      "deliveredAt": "2026-11-05T13:06:15.571Z",
      "acceptedAt": "2026-11-05T13:06:15.576Z",
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-04.events.jsonl`）：

```
ac04/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-93b5ba12d3f18738","seq":1,"ts":"2026-11-05T13:06:14.142Z"}
ac04/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-93b5ba12d3f18738","seq":2,"ts":"2026-11-05T13:06:14.149Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-34012-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-93b5ba12d3f18738","seq":6,"ts":"2026-11-05T13:06:14.415Z"}
ac04/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-93b5ba12d3f18738","seq":7,"ts":"2026-11-05T13:06:14.423Z"}
ac04/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-93b5ba12d3f18738","seq":8,"ts":"2026-11-05T13:06:14.436Z"}
ac04/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-93b5ba12d3f18738","seq":11,"ts":"2026-11-05T13:06:14.479Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-15108-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-93b5ba12d3f18738","seq":17,"ts":"2026-11-05T13:06:14.770Z"}
ac04/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-93b5ba12d3f18738","seq":18,"ts":"2026-11-05T13:06:14.779Z"}
ac04/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-93b5ba12d3f18738","seq":19,"ts":"2026-11-05T13:06:14.789Z"}
ac04/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883974791},"gen":"gen-93b5ba12d3f18738","seq":20,"ts":"2026-11-05T13:06:14.791Z"}
ac04/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-93b5ba12d3f18738","seq":21,"ts":"2026-11-05T13:06:14.805Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-15108-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-93b5ba12d3f18738","seq":22,"ts":"2026-11-05T13:06:14.807Z"}
ac04/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-93b5ba12d3f18738","seq":24,"ts":"2026-11-05T13:06:14.831Z"}
ac04/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-93b5ba12d3f18738","seq":25,"ts":"2026-11-05T13:06:14.838Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-33920-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-93b5ba12d3f18738","seq":31,"ts":"2026-11-05T13:06:15.085Z"}
ac04/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-93b5ba12d3f18738","seq":32,"ts":"2026-11-05T13:06:15.093Z"}
ac04/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-93b5ba12d3f18738","seq":33,"ts":"2026-11-05T13:06:15.103Z"}
ac04/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883975105},"gen":"gen-93b5ba12d3f18738","seq":34,"ts":"2026-11-05T13:06:15.105Z"}
ac04/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-93b5ba12d3f18738","seq":37,"ts":"2026-11-05T13:06:15.135Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-22112-1","from":"idle","to":"thinking","result":"applied","reason":"session.state","detail":{"event":"agent_thought_chunk"},"gen":"gen-93b5ba12d3f18738","seq":39,"ts":"2026-11-05T13:06:15.576Z"}
ac04/INST-001 {"object":"handoff","objectId":"HO-003","from":"delivered","to":"accepted","result":"applied","reason":"turn.first_event","detail":{"event":"agent_thought_chunk","ambiguityWindowMs":5},"gen":"gen-93b5ba12d3f18738","seq":40,"ts":"2026-11-05T13:06:15.580Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-22112-1","from":"thinking","to":"tool_running","result":"applied","reason":"session.state","detail":{"event":"tool_call"},"gen":"gen-93b5ba12d3f18738","seq":41,"ts":"2026-11-05T13:06:15.602Z"}
ac04/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 running / 会话 idle"},"gen":"gen-93b5ba12d3f18738","seq":42,"ts":"2026-11-05T13:06:15.611Z"}
ac04/INST-001 {"object":"session","objectId":"mock-sess-22112-1","from":"tool_running","to":"thinking","result":"applied","reason":"session.state","detail":{"event":"agent_message_chunk"},"gen":"gen-93b5ba12d3f18738","seq":43,"ts":"2026-11-05T13:06:15.612Z"}
```

**④ 判定**：通过（断言 10/10 通过）

- ✅ 夹具停在「测试第 2 轮执行中」（.mock/paused 存在）
- ✅ grep -c '^节点 T-'（期望 2）
- ✅ 开发行含「第 2 轮」（期望包含 "第 2 轮"）
- ✅ 测试行含「第 2 轮」（期望包含 "第 2 轮"）
- ✅ grep '^交接包 HO-' 同时能找到「开发→测试」与「测试→开发（回流）」
- ✅ 节点行与实例行都不匹配 \d{2}:\d{2}:\d{2}（期望 0）
- ✅ 交接包行匹配时间戳
- ✅ 输出段序符合附录 A-2（实例 → 节点 ×2 → 会话 → 交接包 → 升级）（期望 "实例>节点>会话>交接包>升级"）
- ✅ grep -c '节点 T-001 开发 已完成'（期望 1）
- ✅ grep -c '交接包 HO-001  开发→测试  已' 大于 0



---

#### AC-05 测试不通过时自动回流，开发确实收到缺陷

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac05`（叙事实例号 `INST-203`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具 ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_TEST_STOP_AFTER=3`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once --keep --stop-after 3（长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac05 --scenario backflow-once --keep --stop-after 3   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac05 | exit=0 | 101ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-05.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   21:06:17
交接包 HO-001  开发→测试  已投递   21:06:17
交接包 HO-001  开发→测试  已接受   21:06:17
交接包 HO-001  开发→测试  已完成   21:06:17
交接包 HO-002  测试→开发（回流）  已构造   21:06:17
交接包 HO-002  测试→开发（回流）  已投递   21:06:17
交接包 HO-002  测试→开发（回流）  已接受   21:06:17
交接包 HO-002  测试→开发（回流）  已完成   21:06:17
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-05.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 36,
  "counters": {
    "eventSeq": 37,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "running",
      "note": "stopped at node running / session idle",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:06:17.323Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-26432-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-32744-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-12708-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:17.048Z",
      "deliveredAt": "2026-11-05T13:06:17.273Z",
      "acceptedAt": "2026-11-05T13:06:17.279Z",
      "consumedAt": "2026-11-05T13:06:17.324Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:17.362Z",
      "deliveredAt": "2026-11-05T13:06:17.586Z",
      "acceptedAt": "2026-11-05T13:06:17.590Z",
      "consumedAt": "2026-11-05T13:06:17.638Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:06:17.362Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "created",
      "createdAt": "2026-11-05T13:06:17.897Z",
      "deliveredAt": null,
      "acceptedAt": null,
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-05.events.jsonl`）：

```
ac05/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-eba58d4b60756325","seq":1,"ts":"2026-11-05T13:06:16.726Z"}
ac05/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-eba58d4b60756325","seq":2,"ts":"2026-11-05T13:06:16.732Z"}
ac05/INST-001 {"object":"session","objectId":"mock-sess-26432-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-eba58d4b60756325","seq":6,"ts":"2026-11-05T13:06:17.011Z"}
ac05/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-eba58d4b60756325","seq":7,"ts":"2026-11-05T13:06:17.018Z"}
ac05/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-eba58d4b60756325","seq":8,"ts":"2026-11-05T13:06:17.030Z"}
ac05/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-eba58d4b60756325","seq":11,"ts":"2026-11-05T13:06:17.058Z"}
ac05/INST-001 {"object":"session","objectId":"mock-sess-32744-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-eba58d4b60756325","seq":17,"ts":"2026-11-05T13:06:17.307Z"}
ac05/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-eba58d4b60756325","seq":18,"ts":"2026-11-05T13:06:17.316Z"}
ac05/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-eba58d4b60756325","seq":19,"ts":"2026-11-05T13:06:17.323Z"}
ac05/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883977324},"gen":"gen-eba58d4b60756325","seq":20,"ts":"2026-11-05T13:06:17.325Z"}
ac05/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-eba58d4b60756325","seq":21,"ts":"2026-11-05T13:06:17.341Z"}
ac05/INST-001 {"object":"session","objectId":"mock-sess-32744-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-eba58d4b60756325","seq":22,"ts":"2026-11-05T13:06:17.342Z"}
ac05/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-eba58d4b60756325","seq":24,"ts":"2026-11-05T13:06:17.372Z"}
ac05/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-eba58d4b60756325","seq":25,"ts":"2026-11-05T13:06:17.380Z"}
ac05/INST-001 {"object":"session","objectId":"mock-sess-12708-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-eba58d4b60756325","seq":31,"ts":"2026-11-05T13:06:17.617Z"}
ac05/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-eba58d4b60756325","seq":32,"ts":"2026-11-05T13:06:17.624Z"}
ac05/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-eba58d4b60756325","seq":33,"ts":"2026-11-05T13:06:17.637Z"}
ac05/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883977638},"gen":"gen-eba58d4b60756325","seq":34,"ts":"2026-11-05T13:06:17.639Z"}
ac05/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-eba58d4b60756325","seq":37,"ts":"2026-11-05T13:06:17.918Z"}
ac05/INST-001 {"object":"session","objectId":"mock-sess-12708-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-eba58d4b60756325","seq":35,"ts":"2026-11-05T13:06:17.646Z"}
ac05/INST-001 {"object":"handoff","objectId":"HO-003","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-eba58d4b60756325","seq":36,"ts":"2026-11-05T13:06:17.906Z"}
ac05/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 running / 会话 idle"},"gen":"gen-eba58d4b60756325","seq":38,"ts":"2026-11-05T13:06:18.016Z"}
```

**④ 判定**：通过（断言 18/18 通过）

- ✅ 驱动停在「开发第 2 轮产出已核对通过、复测尚未派发」（.mock/stopped-after-3 存在）
- ✅ 夹具：.mock/prompts/3.json 存在
- ✅ 夹具：prompts/3.json 的 task 含「div 在除数为 0 时返回 Infinity，未抛错」（期望包含 "div 在除数为 0 时返回 Infinity，未抛错"）
- ✅ 夹具：prompts/3.json 的 task 含「out/test-log.txt」（期望包含 "out/test-log.txt"）
- ✅ 夹具：prompts/3.json 的 task 含「div 在整除场景存在浮点误差」（期望包含 "div 在整除场景存在浮点误差"）
- ✅ 夹具：prompts/3.json 的 task 含「out/test-log-2.txt」（期望包含 "out/test-log-2.txt"）
- ✅ 机检：存在 edge.kind=backflow 的交接包
- ✅ 机检：backflow 包 defects[] 恰好 2 条（期望 2）
- ✅ 机检：缺陷证据可打开且非空 out/test-log.txt
- ✅ 机检：缺陷证据可打开且非空 out/test-log-2.txt
- ✅ 机检：nodes[0].state=done（期望 "done"）
- ✅ 机检：nodes[0].round=2（期望 2）
- ✅ 机检：nodes[1].state=failed（期望 "failed"）
- ✅ 机检：nodes[1].round=1（期望 1）
- ✅ 机检：backflow 包 state=consumed（期望 "consumed"）
- ✅ 机检：backflow 包 wakeConsumedAt 非空
- ✅ 机检：sessions 里 nodeId=T-001 的两条记录 sessionId 不同
- ✅ orch status 输出含「节点 T-001 开发 已完成 · 第 2 轮」（期望包含 "节点 T-001 开发 已完成 · 第 2 轮"）



---

#### AC-06 回流不新建节点卡片

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac06`（叙事实例号 `INST-204`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once --keep --stop-after 3（长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac06 --scenario backflow-once --keep --stop-after 3   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac06 | exit=0 | 100ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-06.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   21:06:19
交接包 HO-001  开发→测试  已投递   21:06:19
交接包 HO-001  开发→测试  已接受   21:06:19
交接包 HO-001  开发→测试  已完成   21:06:19
交接包 HO-002  测试→开发（回流）  已构造   21:06:19
交接包 HO-002  测试→开发（回流）  已投递   21:06:19
交接包 HO-002  测试→开发（回流）  已接受   21:06:19
交接包 HO-002  测试→开发（回流）  已完成   21:06:20
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-06.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 35,
  "counters": {
    "eventSeq": 35,
    "runCount": 1,
    "dispatchCount": 3
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": "stopped at node done / session idle",
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "failed",
      "note": "等待复测",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:06:19.674Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-7140-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-29560-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-20952-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:19.393Z",
      "deliveredAt": "2026-11-05T13:06:19.615Z",
      "acceptedAt": "2026-11-05T13:06:19.618Z",
      "consumedAt": "2026-11-05T13:06:19.676Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:19.705Z",
      "deliveredAt": "2026-11-05T13:06:19.958Z",
      "acceptedAt": "2026-11-05T13:06:19.965Z",
      "consumedAt": "2026-11-05T13:06:20.008Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:06:19.706Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-06.events.jsonl`）：

```
ac06/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-57ae66749c2cf82a","seq":1,"ts":"2026-11-05T13:06:19.073Z"}
ac06/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-57ae66749c2cf82a","seq":2,"ts":"2026-11-05T13:06:19.082Z"}
ac06/INST-001 {"object":"session","objectId":"mock-sess-7140-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-57ae66749c2cf82a","seq":6,"ts":"2026-11-05T13:06:19.356Z"}
ac06/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-57ae66749c2cf82a","seq":7,"ts":"2026-11-05T13:06:19.363Z"}
ac06/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-57ae66749c2cf82a","seq":8,"ts":"2026-11-05T13:06:19.377Z"}
ac06/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-57ae66749c2cf82a","seq":11,"ts":"2026-11-05T13:06:19.407Z"}
ac06/INST-001 {"object":"session","objectId":"mock-sess-29560-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-57ae66749c2cf82a","seq":17,"ts":"2026-11-05T13:06:19.651Z"}
ac06/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-57ae66749c2cf82a","seq":18,"ts":"2026-11-05T13:06:19.661Z"}
ac06/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-57ae66749c2cf82a","seq":19,"ts":"2026-11-05T13:06:19.674Z"}
ac06/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883979676},"gen":"gen-57ae66749c2cf82a","seq":20,"ts":"2026-11-05T13:06:19.676Z"}
ac06/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-57ae66749c2cf82a","seq":21,"ts":"2026-11-05T13:06:19.689Z"}
ac06/INST-001 {"object":"session","objectId":"mock-sess-29560-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-57ae66749c2cf82a","seq":22,"ts":"2026-11-05T13:06:19.691Z"}
ac06/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-57ae66749c2cf82a","seq":24,"ts":"2026-11-05T13:06:19.715Z"}
ac06/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-57ae66749c2cf82a","seq":25,"ts":"2026-11-05T13:06:19.723Z"}
ac06/INST-001 {"object":"session","objectId":"mock-sess-20952-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-57ae66749c2cf82a","seq":31,"ts":"2026-11-05T13:06:19.989Z"}
ac06/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-57ae66749c2cf82a","seq":32,"ts":"2026-11-05T13:06:19.995Z"}
ac06/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-57ae66749c2cf82a","seq":33,"ts":"2026-11-05T13:06:20.007Z"}
ac06/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883980008},"gen":"gen-57ae66749c2cf82a","seq":34,"ts":"2026-11-05T13:06:20.008Z"}
ac06/INST-001 {"object":"session","objectId":"mock-sess-20952-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-57ae66749c2cf82a","seq":35,"ts":"2026-11-05T13:06:20.013Z"}
ac06/INST-001 {"object":"handoff","objectId":"HO-003","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-57ae66749c2cf82a","seq":36,"ts":"2026-11-05T13:06:20.253Z"}
ac06/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 done / 会话 idle"},"gen":"gen-57ae66749c2cf82a","seq":37,"ts":"2026-11-05T13:06:20.258Z"}
```

**④ 判定**：通过（断言 4/4 通过）

- ✅ 夹具停在「开发 done/round2、测试 failed/round1」
- ✅ grep -c '^节点 T-' 仍是 2（期望 2）
- ✅ 开发行含「第 2 轮」（期望包含 "第 2 轮"）
- ✅ 机检：state.json 的 nodes.length 仍是 2（期望 2）



---

#### AC-07 第 2 次仍不通过就停止回流

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac07`（叙事实例号 `INST-205`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（含真实 60 秒静默观察）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac07 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1818ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac07 | exit=0 | 215ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac07 | exit=0 | 98ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-07.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac07","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac07\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1440,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:06:21
交接包 HO-001  开发→测试  已投递   21:06:21
交接包 HO-001  开发→测试  已接受   21:06:21
交接包 HO-001  开发→测试  已完成   21:06:21
交接包 HO-002  测试→开发（回流）  已构造   21:06:21
交接包 HO-002  测试→开发（回流）  已投递   21:06:22
交接包 HO-002  测试→开发（回流）  已接受   21:06:22
交接包 HO-002  测试→开发（回流）  已完成   21:06:22
交接包 HO-003  开发→测试（复测）  已构造   21:06:22
交接包 HO-003  开发→测试（复测）  已投递   21:06:22
交接包 HO-003  开发→测试（复测）  已接受   21:06:22
交接包 HO-003  开发→测试（复测）  已完成   21:06:22
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:06:21
交接包 HO-001  开发→测试  已投递   21:06:21
交接包 HO-001  开发→测试  已接受   21:06:21
交接包 HO-001  开发→测试  已完成   21:06:21
交接包 HO-002  测试→开发（回流）  已构造   21:06:21
交接包 HO-002  测试→开发（回流）  已投递   21:06:22
交接包 HO-002  测试→开发（回流）  已接受   21:06:22
交接包 HO-002  测试→开发（回流）  已完成   21:06:22
交接包 HO-003  开发→测试（复测）  已构造   21:06:22
交接包 HO-003  开发→测试（复测）  已投递   21:06:22
交接包 HO-003  开发→测试（复测）  已接受   21:06:22
交接包 HO-003  开发→测试（复测）  已完成   21:06:22
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-07.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:06:22.447Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-19212-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-32664-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-10692-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-19676-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:21.580Z",
      "deliveredAt": "2026-11-05T13:06:21.793Z",
      "acceptedAt": "2026-11-05T13:06:21.801Z",
      "consumedAt": "2026-11-05T13:06:21.858Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:21.897Z",
      "deliveredAt": "2026-11-05T13:06:22.123Z",
      "acceptedAt": "2026-11-05T13:06:22.126Z",
      "consumedAt": "2026-11-05T13:06:22.172Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:06:21.897Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:06:22.191Z",
      "deliveredAt": "2026-11-05T13:06:22.406Z",
      "acceptedAt": "2026-11-05T13:06:22.410Z",
      "consumedAt": "2026-11-05T13:06:22.448Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-07.events.jsonl`）：

```
ac07/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-1dffa015f3a06140","seq":1,"ts":"2026-11-05T13:06:21.270Z"}
ac07/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-1dffa015f3a06140","seq":2,"ts":"2026-11-05T13:06:21.279Z"}
ac07/INST-001 {"object":"session","objectId":"mock-sess-19212-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":6,"ts":"2026-11-05T13:06:21.542Z"}
ac07/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":7,"ts":"2026-11-05T13:06:21.548Z"}
ac07/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-1dffa015f3a06140","seq":8,"ts":"2026-11-05T13:06:21.560Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-1dffa015f3a06140","seq":11,"ts":"2026-11-05T13:06:21.590Z"}
ac07/INST-001 {"object":"session","objectId":"mock-sess-32664-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":17,"ts":"2026-11-05T13:06:21.838Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":18,"ts":"2026-11-05T13:06:21.850Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-1dffa015f3a06140","seq":19,"ts":"2026-11-05T13:06:21.857Z"}
ac07/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883981858},"gen":"gen-1dffa015f3a06140","seq":20,"ts":"2026-11-05T13:06:21.859Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-1dffa015f3a06140","seq":21,"ts":"2026-11-05T13:06:21.875Z"}
ac07/INST-001 {"object":"session","objectId":"mock-sess-32664-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-1dffa015f3a06140","seq":22,"ts":"2026-11-05T13:06:21.877Z"}
ac07/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-1dffa015f3a06140","seq":24,"ts":"2026-11-05T13:06:21.908Z"}
ac07/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-1dffa015f3a06140","seq":25,"ts":"2026-11-05T13:06:21.916Z"}
ac07/INST-001 {"object":"session","objectId":"mock-sess-10692-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":31,"ts":"2026-11-05T13:06:22.153Z"}
ac07/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":32,"ts":"2026-11-05T13:06:22.158Z"}
ac07/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-1dffa015f3a06140","seq":33,"ts":"2026-11-05T13:06:22.171Z"}
ac07/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883982172},"gen":"gen-1dffa015f3a06140","seq":34,"ts":"2026-11-05T13:06:22.172Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-1dffa015f3a06140","seq":37,"ts":"2026-11-05T13:06:22.203Z"}
ac07/INST-001 {"object":"session","objectId":"mock-sess-19676-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":43,"ts":"2026-11-05T13:06:22.433Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1dffa015f3a06140","seq":44,"ts":"2026-11-05T13:06:22.441Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-1dffa015f3a06140","seq":45,"ts":"2026-11-05T13:06:22.447Z"}
ac07/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793883982448},"gen":"gen-1dffa015f3a06140","seq":46,"ts":"2026-11-05T13:06:22.448Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-1dffa015f3a06140","seq":47,"ts":"2026-11-05T13:06:22.454Z"}
ac07/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-1dffa015f3a06140","seq":48,"ts":"2026-11-05T13:06:22.460Z"}
ac07/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-1dffa015f3a06140","seq":51,"ts":"2026-11-05T13:06:22.464Z"}
ac07/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-1dffa015f3a06140","seq":49,"ts":"2026-11-05T13:06:22.461Z"}
ac07/INST-001 {"object":"session","objectId":"mock-sess-19676-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-1dffa015f3a06140","seq":50,"ts":"2026-11-05T13:06:22.463Z"}
```

**④ 判定**：通过（断言 10/10 通过）

- ✅ 机检：state.json 的 state=suspended（期望 "suspended"）
- ✅ 机检：nodes[1].state=escalated（期望 "escalated"）
- ✅ 机检：nodes[1].round=2（期望 2）
- ✅ 机检：nodes[0].round=2（期望 2）
- ✅ 机检：T-002 存在 from=review、to=escalated 的事件
- ✅ 机检：不存在 from=running、to=escalated 的事件（期望 0）
- ✅ 机检：events.jsonl 的行数在 60 秒前后相同（期望 51）
- ✅ 第 1 次查询的第一行含「已挂起」（期望包含 "已挂起"）
- ✅ 两次查询的第 2 次第一行含「已挂起」（期望包含 "已挂起"）
- ✅ 机检：不存在 round=3 的节点记录（期望 0）



---

#### AC-08 升级挂在具体节点上，说得清为什么

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac08`（叙事实例号 `INST-206`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac08 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1913ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac08 | exit=0 | 198ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-08.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac08","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac08\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1537,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:07:23
交接包 HO-001  开发→测试  已投递   21:07:23
交接包 HO-001  开发→测试  已接受   21:07:23
交接包 HO-001  开发→测试  已完成   21:07:24
交接包 HO-002  测试→开发（回流）  已构造   21:07:24
交接包 HO-002  测试→开发（回流）  已投递   21:07:24
交接包 HO-002  测试→开发（回流）  已接受   21:07:24
交接包 HO-002  测试→开发（回流）  已完成   21:07:24
交接包 HO-003  开发→测试（复测）  已构造   21:07:24
交接包 HO-003  开发→测试（复测）  已投递   21:07:24
交接包 HO-003  开发→测试（复测）  已接受   21:07:24
交接包 HO-003  开发→测试（复测）  已完成   21:07:24
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-08.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:07:24.627Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-17272-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-32900-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-26688-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-20608-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:07:23.729Z",
      "deliveredAt": "2026-11-05T13:07:23.950Z",
      "acceptedAt": "2026-11-05T13:07:23.954Z",
      "consumedAt": "2026-11-05T13:07:24.022Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:07:24.056Z",
      "deliveredAt": "2026-11-05T13:07:24.292Z",
      "acceptedAt": "2026-11-05T13:07:24.296Z",
      "consumedAt": "2026-11-05T13:07:24.343Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:07:24.056Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:07:24.363Z",
      "deliveredAt": "2026-11-05T13:07:24.586Z",
      "acceptedAt": "2026-11-05T13:07:24.592Z",
      "consumedAt": "2026-11-05T13:07:24.628Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-08.events.jsonl`）：

```
ac08/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":1,"ts":"2026-11-05T13:07:23.440Z"}
ac08/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-262a35ba3ad0c0fb","seq":2,"ts":"2026-11-05T13:07:23.446Z"}
ac08/INST-001 {"object":"session","objectId":"mock-sess-17272-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":6,"ts":"2026-11-05T13:07:23.695Z"}
ac08/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":7,"ts":"2026-11-05T13:07:23.703Z"}
ac08/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":8,"ts":"2026-11-05T13:07:23.712Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-262a35ba3ad0c0fb","seq":11,"ts":"2026-11-05T13:07:23.740Z"}
ac08/INST-001 {"object":"session","objectId":"mock-sess-32900-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":17,"ts":"2026-11-05T13:07:24.008Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":18,"ts":"2026-11-05T13:07:24.014Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-262a35ba3ad0c0fb","seq":19,"ts":"2026-11-05T13:07:24.021Z"}
ac08/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884044022},"gen":"gen-262a35ba3ad0c0fb","seq":20,"ts":"2026-11-05T13:07:24.023Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-262a35ba3ad0c0fb","seq":21,"ts":"2026-11-05T13:07:24.040Z"}
ac08/INST-001 {"object":"session","objectId":"mock-sess-32900-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":22,"ts":"2026-11-05T13:07:24.042Z"}
ac08/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-262a35ba3ad0c0fb","seq":24,"ts":"2026-11-05T13:07:24.070Z"}
ac08/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-262a35ba3ad0c0fb","seq":25,"ts":"2026-11-05T13:07:24.079Z"}
ac08/INST-001 {"object":"session","objectId":"mock-sess-26688-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":31,"ts":"2026-11-05T13:07:24.325Z"}
ac08/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":32,"ts":"2026-11-05T13:07:24.330Z"}
ac08/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":33,"ts":"2026-11-05T13:07:24.342Z"}
ac08/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884044343},"gen":"gen-262a35ba3ad0c0fb","seq":34,"ts":"2026-11-05T13:07:24.344Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-262a35ba3ad0c0fb","seq":37,"ts":"2026-11-05T13:07:24.378Z"}
ac08/INST-001 {"object":"session","objectId":"mock-sess-20608-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":43,"ts":"2026-11-05T13:07:24.617Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":44,"ts":"2026-11-05T13:07:24.622Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-262a35ba3ad0c0fb","seq":45,"ts":"2026-11-05T13:07:24.627Z"}
ac08/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884044628},"gen":"gen-262a35ba3ad0c0fb","seq":46,"ts":"2026-11-05T13:07:24.628Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-262a35ba3ad0c0fb","seq":47,"ts":"2026-11-05T13:07:24.632Z"}
ac08/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-262a35ba3ad0c0fb","seq":48,"ts":"2026-11-05T13:07:24.642Z"}
ac08/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":51,"ts":"2026-11-05T13:07:24.646Z"}
ac08/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":49,"ts":"2026-11-05T13:07:24.644Z"}
ac08/INST-001 {"object":"session","objectId":"mock-sess-20608-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-262a35ba3ad0c0fb","seq":50,"ts":"2026-11-05T13:07:24.645Z"}
```

**④ 判定**：通过（断言 9/9 通过）

- ✅ 输出含「节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条」（期望包含 "节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条"）
- ✅ 输出含「升级 ESC-001 待处理」（期望包含 "升级 ESC-001 待处理"）
- ✅ 输出含「原因：回流超上限：测试已派发 2 次仍未通过」（期望包含 "原因：回流超上限：测试已派发 2 次仍未通过"）
- ✅ 输出含「节点：T-002 测试 · 第 2 轮」（期望包含 "节点：T-002 测试 · 第 2 轮"）
- ✅ 输出含「缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）」（期望包含 "缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）"）
- ✅ 机检：escalations.length=1（期望 1）
- ✅ 机检：escalations[0].nodeId=T-002（期望 "T-002"）
- ✅ 机检：escalations[0].round=2（期望 2）
- ✅ 机检：escalations[0].state=pending（期望 "pending"）



---

#### AC-09 挂起后不再自动继续

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac09`（叙事实例号 `INST-207`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（核心 --keep 在跑 + 真实 60 秒静默）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac09 --scenario retest-fail --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac09 | exit=0 | 93ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac09 | exit=0 | 90ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-09.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:07:25
交接包 HO-001  开发→测试  已投递   21:07:26
交接包 HO-001  开发→测试  已接受   21:07:26
交接包 HO-001  开发→测试  已完成   21:07:26
交接包 HO-002  测试→开发（回流）  已构造   21:07:26
交接包 HO-002  测试→开发（回流）  已投递   21:07:26
交接包 HO-002  测试→开发（回流）  已接受   21:07:26
交接包 HO-002  测试→开发（回流）  已完成   21:07:26
交接包 HO-003  开发→测试（复测）  已构造   21:07:26
交接包 HO-003  开发→测试（复测）  已投递   21:07:26
交接包 HO-003  开发→测试（复测）  已接受   21:07:26
交接包 HO-003  开发→测试（复测）  已完成   21:07:26
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
实例 INST-001 · 已挂起 · 模板 编码闭环 · 待处理升级 1 · 节点 已完成 · 会话 已升级 · 耗时 1s · 更新 21:07:26
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-09.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:07:26.776Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-34304-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-31020-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-18256-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-23668-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:07:25.875Z",
      "deliveredAt": "2026-11-05T13:07:26.105Z",
      "acceptedAt": "2026-11-05T13:07:26.110Z",
      "consumedAt": "2026-11-05T13:07:26.170Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:07:26.209Z",
      "deliveredAt": "2026-11-05T13:07:26.433Z",
      "acceptedAt": "2026-11-05T13:07:26.439Z",
      "consumedAt": "2026-11-05T13:07:26.482Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:07:26.209Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:07:26.500Z",
      "deliveredAt": "2026-11-05T13:07:26.728Z",
      "acceptedAt": "2026-11-05T13:07:26.737Z",
      "consumedAt": "2026-11-05T13:07:26.777Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-09.events.jsonl`）：

```
ac09/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-4be743adfeefb676","seq":1,"ts":"2026-11-05T13:07:25.562Z"}
ac09/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4be743adfeefb676","seq":2,"ts":"2026-11-05T13:07:25.576Z"}
ac09/INST-001 {"object":"session","objectId":"mock-sess-34304-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":6,"ts":"2026-11-05T13:07:25.841Z"}
ac09/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":7,"ts":"2026-11-05T13:07:25.848Z"}
ac09/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4be743adfeefb676","seq":8,"ts":"2026-11-05T13:07:25.859Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4be743adfeefb676","seq":11,"ts":"2026-11-05T13:07:25.888Z"}
ac09/INST-001 {"object":"session","objectId":"mock-sess-31020-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":17,"ts":"2026-11-05T13:07:26.147Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":18,"ts":"2026-11-05T13:07:26.155Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-4be743adfeefb676","seq":19,"ts":"2026-11-05T13:07:26.166Z"}
ac09/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884046170},"gen":"gen-4be743adfeefb676","seq":20,"ts":"2026-11-05T13:07:26.170Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-4be743adfeefb676","seq":21,"ts":"2026-11-05T13:07:26.190Z"}
ac09/INST-001 {"object":"session","objectId":"mock-sess-31020-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-4be743adfeefb676","seq":22,"ts":"2026-11-05T13:07:26.193Z"}
ac09/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-4be743adfeefb676","seq":24,"ts":"2026-11-05T13:07:26.218Z"}
ac09/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4be743adfeefb676","seq":25,"ts":"2026-11-05T13:07:26.226Z"}
ac09/INST-001 {"object":"session","objectId":"mock-sess-18256-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":31,"ts":"2026-11-05T13:07:26.462Z"}
ac09/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":32,"ts":"2026-11-05T13:07:26.470Z"}
ac09/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4be743adfeefb676","seq":33,"ts":"2026-11-05T13:07:26.481Z"}
ac09/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884046482},"gen":"gen-4be743adfeefb676","seq":34,"ts":"2026-11-05T13:07:26.483Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4be743adfeefb676","seq":37,"ts":"2026-11-05T13:07:26.512Z"}
ac09/INST-001 {"object":"session","objectId":"mock-sess-23668-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":43,"ts":"2026-11-05T13:07:26.762Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4be743adfeefb676","seq":44,"ts":"2026-11-05T13:07:26.770Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-4be743adfeefb676","seq":45,"ts":"2026-11-05T13:07:26.776Z"}
ac09/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884046777},"gen":"gen-4be743adfeefb676","seq":46,"ts":"2026-11-05T13:07:26.777Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-4be743adfeefb676","seq":47,"ts":"2026-11-05T13:07:26.781Z"}
ac09/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-4be743adfeefb676","seq":48,"ts":"2026-11-05T13:07:26.789Z"}
ac09/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-4be743adfeefb676","seq":51,"ts":"2026-11-05T13:07:26.793Z"}
ac09/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-4be743adfeefb676","seq":49,"ts":"2026-11-05T13:07:26.791Z"}
ac09/INST-001 {"object":"session","objectId":"mock-sess-23668-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-4be743adfeefb676","seq":50,"ts":"2026-11-05T13:07:26.792Z"}
```

**④ 判定**：通过（断言 9/9 通过）

- ✅ 夹具 retest-fail 跑完且核心仍在跑（--keep），实例已挂起
- ✅ 机检：events.jsonl 行数不变（期望 51）
- ✅ 机检：sessions.length 不变（期望 4）
- ✅ 机检：这 60 秒内没有新增 reason=node.dispatch（期望 4）
- ✅ 机检：这 60 秒内没有新增 reason=escalation.created（期望 1）
- ✅ 机检：state.json 的 state 仍是 'suspended'（期望 "suspended"）
- ✅ orch status 第一行含「已挂起」（期望包含 "已挂起"）
- ✅ 列表里 INST-001 那行含「已挂起」（期望包含 "已挂起"）
- ✅ 列表里 INST-001 那行含「待处理升级 1」（期望包含 "待处理升级 1"）



---

#### AC-10 重启后仍挂起，轮次与升级都在

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac10`（叙事实例号 `INST-208`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac10 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1925ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac10 | exit=0 | 80ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac10 | exit=0 | 208ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-10.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac10","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac10\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1549,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:08:28
交接包 HO-001  开发→测试  已投递   21:08:28
交接包 HO-001  开发→测试  已接受   21:08:28
交接包 HO-001  开发→测试  已完成   21:08:28
交接包 HO-002  测试→开发（回流）  已构造   21:08:28
交接包 HO-002  测试→开发（回流）  已投递   21:08:29
交接包 HO-002  测试→开发（回流）  已接受   21:08:29
交接包 HO-002  测试→开发（回流）  已完成   21:08:29
交接包 HO-003  开发→测试（复测）  已构造   21:08:29
交接包 HO-003  开发→测试（复测）  已投递   21:08:29
交接包 HO-003  开发→测试（复测）  已接受   21:08:29
交接包 HO-003  开发→测试（复测）  已完成   21:08:29
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-10.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:08:29.414Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-20836-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-23548-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-31164-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-28152-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:28.495Z",
      "deliveredAt": "2026-11-05T13:08:28.725Z",
      "acceptedAt": "2026-11-05T13:08:28.732Z",
      "consumedAt": "2026-11-05T13:08:28.784Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:28.818Z",
      "deliveredAt": "2026-11-05T13:08:29.051Z",
      "acceptedAt": "2026-11-05T13:08:29.054Z",
      "consumedAt": "2026-11-05T13:08:29.104Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:08:28.818Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:29.133Z",
      "deliveredAt": "2026-11-05T13:08:29.365Z",
      "acceptedAt": "2026-11-05T13:08:29.373Z",
      "consumedAt": "2026-11-05T13:08:29.416Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-10.events.jsonl`）：

```
ac10/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-c558c8f69d6db962","seq":1,"ts":"2026-11-05T13:08:28.168Z"}
ac10/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-c558c8f69d6db962","seq":2,"ts":"2026-11-05T13:08:28.175Z"}
ac10/INST-001 {"object":"session","objectId":"mock-sess-20836-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":6,"ts":"2026-11-05T13:08:28.455Z"}
ac10/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":7,"ts":"2026-11-05T13:08:28.463Z"}
ac10/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-c558c8f69d6db962","seq":8,"ts":"2026-11-05T13:08:28.477Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-c558c8f69d6db962","seq":11,"ts":"2026-11-05T13:08:28.505Z"}
ac10/INST-001 {"object":"session","objectId":"mock-sess-23548-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":17,"ts":"2026-11-05T13:08:28.766Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":18,"ts":"2026-11-05T13:08:28.774Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-c558c8f69d6db962","seq":19,"ts":"2026-11-05T13:08:28.783Z"}
ac10/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884108784},"gen":"gen-c558c8f69d6db962","seq":20,"ts":"2026-11-05T13:08:28.785Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-c558c8f69d6db962","seq":21,"ts":"2026-11-05T13:08:28.798Z"}
ac10/INST-001 {"object":"session","objectId":"mock-sess-23548-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-c558c8f69d6db962","seq":22,"ts":"2026-11-05T13:08:28.801Z"}
ac10/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-c558c8f69d6db962","seq":24,"ts":"2026-11-05T13:08:28.826Z"}
ac10/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-c558c8f69d6db962","seq":25,"ts":"2026-11-05T13:08:28.834Z"}
ac10/INST-001 {"object":"session","objectId":"mock-sess-31164-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":31,"ts":"2026-11-05T13:08:29.080Z"}
ac10/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":32,"ts":"2026-11-05T13:08:29.086Z"}
ac10/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-c558c8f69d6db962","seq":33,"ts":"2026-11-05T13:08:29.101Z"}
ac10/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884109104},"gen":"gen-c558c8f69d6db962","seq":34,"ts":"2026-11-05T13:08:29.105Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-c558c8f69d6db962","seq":37,"ts":"2026-11-05T13:08:29.150Z"}
ac10/INST-001 {"object":"session","objectId":"mock-sess-28152-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":43,"ts":"2026-11-05T13:08:29.401Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c558c8f69d6db962","seq":44,"ts":"2026-11-05T13:08:29.407Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-c558c8f69d6db962","seq":45,"ts":"2026-11-05T13:08:29.414Z"}
ac10/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884109416},"gen":"gen-c558c8f69d6db962","seq":46,"ts":"2026-11-05T13:08:29.416Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-c558c8f69d6db962","seq":47,"ts":"2026-11-05T13:08:29.421Z"}
ac10/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-c558c8f69d6db962","seq":48,"ts":"2026-11-05T13:08:29.428Z"}
ac10/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-c558c8f69d6db962","seq":51,"ts":"2026-11-05T13:08:29.433Z"}
ac10/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-c558c8f69d6db962","seq":49,"ts":"2026-11-05T13:08:29.429Z"}
ac10/INST-001 {"object":"session","objectId":"mock-sess-28152-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-c558c8f69d6db962","seq":50,"ts":"2026-11-05T13:08:29.431Z"}
```

**④ 判定**：通过（断言 9/9 通过）

- ✅ 第一行含「已挂起」（期望包含 "已挂起"）
- ✅ 第一行不含「已中断」（期望不含 "已中断"）
- ✅ 输出含「节点 T-002 测试 已升级 · 第 2 轮」（期望包含 "节点 T-002 测试 已升级 · 第 2 轮"）
- ✅ 输出含「升级 ESC-001 待处理」（期望包含 "升级 ESC-001 待处理"）
- ✅ 机检：events.jsonl 的 sha256 与 stop 前相同（期望 "e134390a46fda6e692d78068731386261a9d2b5db7e34e817410e10aaf334efd"）
- ✅ 机检：state 仍是 suspended（期望 "suspended"）
- ✅ 机检：halted 不变（false）（期望 false）
- ✅ 机检：轮次仍为 2（期望 2）
- ✅ 机检：升级仍在（期望 1）



---

#### AC-11 运行中取消，5 秒内收干净

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac11`（叙事实例号 `INST-209`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-slow --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac11 --scenario retest-slow --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac11 | exit=0 | 102ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac11 | exit=0 | 116ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac11 | exit=0 | 92ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-11.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 执行中 · 第 2 轮 · 判定 不通过 · 缺陷 2 条
会话 执行中 · 调用工具（write） · 已运行 1s
交接包 HO-001  开发→测试  已构造   21:08:30
交接包 HO-001  开发→测试  已投递   21:08:30
交接包 HO-001  开发→测试  已接受   21:08:30
交接包 HO-001  开发→测试  已完成   21:08:31
交接包 HO-002  测试→开发（回流）  已构造   21:08:31
交接包 HO-002  测试→开发（回流）  已投递   21:08:31
交接包 HO-002  测试→开发（回流）  已接受   21:08:31
交接包 HO-002  测试→开发（回流）  已完成   21:08:31
交接包 HO-003  开发→测试（复测）  已构造   21:08:31
交接包 HO-003  开发→测试（复测）  已投递   21:08:31
交接包 HO-003  开发→测试（复测）  已接受   21:08:31
会话 空闲
会话 空闲
会话 空闲
会话 空闲
节点 T-001 开发 已完成
节点 T-002 测试 已取消
交接包 HO-001 已完成
交接包 HO-002 已完成
交接包 HO-003 已拒绝（已撤回）
实例 INST-001 · 已取消 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已取消 · 第 2 轮 · 耗时 1s · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   21:08:30
交接包 HO-001  开发→测试  已投递   21:08:30
交接包 HO-001  开发→测试  已接受   21:08:30
交接包 HO-001  开发→测试  已完成   21:08:31
交接包 HO-002  测试→开发（回流）  已构造   21:08:31
交接包 HO-002  测试→开发（回流）  已投递   21:08:31
交接包 HO-002  测试→开发（回流）  已接受   21:08:31
交接包 HO-002  测试→开发（回流）  已完成   21:08:31
交接包 HO-003  开发→测试（复测）  已构造   21:08:31
交接包 HO-003  开发→测试（复测）  已投递   21:08:31
交接包 HO-003  开发→测试（复测）  已接受   21:08:31
交接包 HO-003  开发→测试（复测）  已拒绝   21:08:31  原因 已撤回
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-11.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "cancelled",
  "template": "code-loop",
  "halted": false,
  "rev": 39,
  "counters": {
    "eventSeq": 41,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "cancelled",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:08:31.035Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-26596-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33344-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33356-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33796-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:30.753Z",
      "deliveredAt": "2026-11-05T13:08:30.984Z",
      "acceptedAt": "2026-11-05T13:08:30.988Z",
      "consumedAt": "2026-11-05T13:08:31.037Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:31.077Z",
      "deliveredAt": "2026-11-05T13:08:31.312Z",
      "acceptedAt": "2026-11-05T13:08:31.319Z",
      "consumedAt": "2026-11-05T13:08:31.359Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:08:31.077Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "rejected",
      "createdAt": "2026-11-05T13:08:31.388Z",
      "deliveredAt": "2026-11-05T13:08:31.607Z",
      "acceptedAt": "2026-11-05T13:08:31.613Z",
      "consumedAt": null,
      "rejectedAt": "2026-11-05T13:08:31.845Z",
      "rejectReason": "withdrawn",
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-11.events.jsonl`）：

```
ac11/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-979e97829c215ad7","seq":1,"ts":"2026-11-05T13:08:30.451Z"}
ac11/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-979e97829c215ad7","seq":2,"ts":"2026-11-05T13:08:30.460Z"}
ac11/INST-001 {"object":"session","objectId":"mock-sess-26596-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-979e97829c215ad7","seq":6,"ts":"2026-11-05T13:08:30.715Z"}
ac11/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-979e97829c215ad7","seq":7,"ts":"2026-11-05T13:08:30.722Z"}
ac11/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-979e97829c215ad7","seq":8,"ts":"2026-11-05T13:08:30.736Z"}
ac11/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-979e97829c215ad7","seq":11,"ts":"2026-11-05T13:08:30.764Z"}
ac11/INST-001 {"object":"session","objectId":"mock-sess-33344-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-979e97829c215ad7","seq":17,"ts":"2026-11-05T13:08:31.019Z"}
ac11/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-979e97829c215ad7","seq":18,"ts":"2026-11-05T13:08:31.026Z"}
ac11/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-979e97829c215ad7","seq":19,"ts":"2026-11-05T13:08:31.035Z"}
ac11/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884111037},"gen":"gen-979e97829c215ad7","seq":20,"ts":"2026-11-05T13:08:31.038Z"}
ac11/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-979e97829c215ad7","seq":21,"ts":"2026-11-05T13:08:31.055Z"}
ac11/INST-001 {"object":"session","objectId":"mock-sess-33344-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-979e97829c215ad7","seq":22,"ts":"2026-11-05T13:08:31.057Z"}
ac11/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-979e97829c215ad7","seq":24,"ts":"2026-11-05T13:08:31.087Z"}
ac11/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-979e97829c215ad7","seq":25,"ts":"2026-11-05T13:08:31.094Z"}
ac11/INST-001 {"object":"session","objectId":"mock-sess-33356-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-979e97829c215ad7","seq":31,"ts":"2026-11-05T13:08:31.340Z"}
ac11/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-979e97829c215ad7","seq":32,"ts":"2026-11-05T13:08:31.346Z"}
ac11/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-979e97829c215ad7","seq":33,"ts":"2026-11-05T13:08:31.358Z"}
ac11/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884111359},"gen":"gen-979e97829c215ad7","seq":34,"ts":"2026-11-05T13:08:31.359Z"}
ac11/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-979e97829c215ad7","seq":37,"ts":"2026-11-05T13:08:31.402Z"}
ac11/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"rejected","result":"applied","reason":"handoff.rejected","detail":{"reason":"withdrawn"},"gen":"gen-979e97829c215ad7","seq":44,"ts":"2026-11-05T13:08:31.863Z"}
ac11/INST-001 {"object":"session","objectId":"mock-sess-33796-1","from":"thinking","to":"tool_running","result":"applied","reason":"session.state","detail":{"event":"tool_call"},"gen":"gen-979e97829c215ad7","seq":41,"ts":"2026-11-05T13:08:31.622Z"}
ac11/INST-001 {"object":"session","objectId":"mock-sess-33796-1","from":"tool_running","to":"idle","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-979e97829c215ad7","seq":42,"ts":"2026-11-05T13:08:31.861Z"}
ac11/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-979e97829c215ad7","seq":43,"ts":"2026-11-05T13:08:31.862Z"}
ac11/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-979e97829c215ad7","seq":45,"ts":"2026-11-05T13:08:31.865Z"}
```

**④ 判定**：通过（断言 9/9 通过）

- ✅ 夹具推进到「测试第 2 轮执行中」（step4 delayMs=30000，HO-003 已接受）
- ✅ 取消前输出含「交接包 HO-003  开发→测试（复测）  已接受」（期望包含 "交接包 HO-003  开发→测试（复测）  已接受"）
- ✅ orch cancel 在 5 秒内返回
- ✅ 第一行含「已取消」（期望包含 "已取消"）
- ✅ 输出含「节点 T-001 开发 已完成 · 第 2 轮」（已完成不倒推）（期望包含 "节点 T-001 开发 已完成 · 第 2 轮"）
- ✅ 机检：nodes[1].state='cancelled'（原 'running'）（期望 "cancelled"）
- ✅ 机检：HO-003 的 state='rejected'（期望 "rejected"）
- ✅ 机检：HO-003 的 rejectReason='withdrawn'（期望 "withdrawn"）
- ✅ 输出含「会话 空闲」（期望包含 "会话 空闲"）



---

#### AC-12 挂起时 orch run 自己结束，不报错

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac12`（叙事实例号 `INST-210`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（--prepare-only 构造现场 + 产品命令 orch run）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail --prepare-only] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac12 --scenario retest-fail --prepare-only   | cwd=D:\WWW\Maestro | exit=0 | 98ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac12 | exit=0 | 210ms
[orch run --cwd ./demo-code-pass --template code-loop --host mock --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --template code-loop --host mock --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac12 | exit=4 | 1287ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-12.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"prepareOnly":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac12","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac12\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","cursorPath":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac12\\.mock\\cursor.json","hostPath":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac12\\.orch\\hosts\\mock.json","cursor":{"next":1},"host":{"id":"mock","transport":"stdio","launch":{"command":"C:\\Users\\xuesh\\.workbuddy\\binaries\\node\\versions\\22.22.2-6\\node.exe","args":["D:\\WWW\\Maestro\\test\\fixtures\\mock-acp-agent.js","--root","C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac12","--scenario","retest-fail"]}}}
实例 无
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-12.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:08:34.294Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-24556-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-14540-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-13328-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-26200-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:33.418Z",
      "deliveredAt": "2026-11-05T13:08:33.635Z",
      "acceptedAt": "2026-11-05T13:08:33.644Z",
      "consumedAt": "2026-11-05T13:08:33.697Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:33.729Z",
      "deliveredAt": "2026-11-05T13:08:33.962Z",
      "acceptedAt": "2026-11-05T13:08:33.967Z",
      "consumedAt": "2026-11-05T13:08:34.025Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:08:33.729Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:08:34.045Z",
      "deliveredAt": "2026-11-05T13:08:34.257Z",
      "acceptedAt": "2026-11-05T13:08:34.261Z",
      "consumedAt": "2026-11-05T13:08:34.295Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-12.events.jsonl`）：

```
ac12/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":1,"ts":"2026-11-05T13:08:33.131Z"}
ac12/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-9c8fe47e42694ec6","seq":2,"ts":"2026-11-05T13:08:33.141Z"}
ac12/INST-001 {"object":"session","objectId":"mock-sess-24556-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":6,"ts":"2026-11-05T13:08:33.381Z"}
ac12/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":7,"ts":"2026-11-05T13:08:33.389Z"}
ac12/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":8,"ts":"2026-11-05T13:08:33.403Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-9c8fe47e42694ec6","seq":11,"ts":"2026-11-05T13:08:33.428Z"}
ac12/INST-001 {"object":"session","objectId":"mock-sess-14540-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":17,"ts":"2026-11-05T13:08:33.679Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":18,"ts":"2026-11-05T13:08:33.686Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-9c8fe47e42694ec6","seq":19,"ts":"2026-11-05T13:08:33.694Z"}
ac12/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884113697},"gen":"gen-9c8fe47e42694ec6","seq":20,"ts":"2026-11-05T13:08:33.698Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-9c8fe47e42694ec6","seq":21,"ts":"2026-11-05T13:08:33.713Z"}
ac12/INST-001 {"object":"session","objectId":"mock-sess-14540-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":22,"ts":"2026-11-05T13:08:33.714Z"}
ac12/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-9c8fe47e42694ec6","seq":24,"ts":"2026-11-05T13:08:33.737Z"}
ac12/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-9c8fe47e42694ec6","seq":25,"ts":"2026-11-05T13:08:33.745Z"}
ac12/INST-001 {"object":"session","objectId":"mock-sess-13328-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":31,"ts":"2026-11-05T13:08:34.006Z"}
ac12/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":32,"ts":"2026-11-05T13:08:34.013Z"}
ac12/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":33,"ts":"2026-11-05T13:08:34.024Z"}
ac12/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884114025},"gen":"gen-9c8fe47e42694ec6","seq":34,"ts":"2026-11-05T13:08:34.025Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-9c8fe47e42694ec6","seq":37,"ts":"2026-11-05T13:08:34.056Z"}
ac12/INST-001 {"object":"session","objectId":"mock-sess-26200-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":43,"ts":"2026-11-05T13:08:34.282Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":44,"ts":"2026-11-05T13:08:34.287Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-9c8fe47e42694ec6","seq":45,"ts":"2026-11-05T13:08:34.294Z"}
ac12/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884114295},"gen":"gen-9c8fe47e42694ec6","seq":46,"ts":"2026-11-05T13:08:34.295Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-9c8fe47e42694ec6","seq":47,"ts":"2026-11-05T13:08:34.300Z"}
ac12/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-9c8fe47e42694ec6","seq":48,"ts":"2026-11-05T13:08:34.307Z"}
ac12/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":51,"ts":"2026-11-05T13:08:34.311Z"}
ac12/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":49,"ts":"2026-11-05T13:08:34.309Z"}
ac12/INST-001 {"object":"session","objectId":"mock-sess-26200-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-9c8fe47e42694ec6","seq":50,"ts":"2026-11-05T13:08:34.310Z"}
```

**④ 判定**：通过（断言 10/10 通过）

- ✅ 命令在 10 秒内返回
- ✅ 退出码是 4（期望 4）
- ✅ 倒数第 3 行匹配 ^实例 INST-\d+ · 已挂起 · 模板 编码闭环$（期望匹配 /^实例 INST-\d+ · 已挂起 · 模板 编码闭环$/）
- ✅ 倒数第 2 行匹配 ^升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮$（期望匹配 /^升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮$/）
- ✅ 最后一行匹配 ^下一步：查看详情 .*；本版本不能继续，要终止请执行 orch cancel --instance INST-\d+$（期望匹配 /^下一步：查看详情 .*；本版本不能继续，要终止请执行 orch cancel --instance INST-\d+$/）
- ✅ 全部输出不含以「节点 T-」开头的行（期望 0）
- ✅ 全部输出不含以「交接包 HO-」开头的行（期望 0）
- ✅ 全部输出不含「未知错误」（期望不含 "未知错误"）
- ✅ 全部输出不含「执行失败」（期望不含 "执行失败"）
- ✅ 全部输出不含「核对失败」（期望不含 "核对失败"）



---

#### AC-13 判定文件缺失不回流，直接升级

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac13`（叙事实例号 `INST-211`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario verdict-missing] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac13 --scenario verdict-missing   | cwd=D:\WWW\Maestro | exit=0 | 1265ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac13 | exit=0 | 212ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-13.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac13","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac13\\demo-code-pass","scenario":"verdict-missing","resolvedScenario":"verdict-missing","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_missing"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":883,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_missing","ok":true,"detail":"verdict_missing"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:18
交接包 HO-001  开发→测试  已投递   22:00:18
交接包 HO-001  开发→测试  已接受   22:00:18
升级 ESC-001 待处理
  原因：核对失败：未找到判定文件 out/verdict.json
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-13.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 20,
  "counters": {
    "eventSeq": 19,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "escalated",
      "note": null,
      "verdict": null,
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-24132-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-9744-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "accepted",
      "createdAt": "2026-11-05T14:00:18.162Z",
      "deliveredAt": "2026-11-05T14:00:18.387Z",
      "acceptedAt": "2026-11-05T14:00:18.394Z",
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 1,
      "reasonCode": "verdict_missing",
      "reasonDetail": "核对失败：未找到判定文件 out/verdict.json",
      "state": "pending",
      "defects": []
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-13.events.jsonl`）：

```
ac13/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-54afc33200916566","seq":1,"ts":"2026-11-05T14:00:17.876Z"}
ac13/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-54afc33200916566","seq":2,"ts":"2026-11-05T14:00:17.884Z"}
ac13/INST-001 {"object":"session","objectId":"mock-sess-24132-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-54afc33200916566","seq":6,"ts":"2026-11-05T14:00:18.127Z"}
ac13/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-54afc33200916566","seq":7,"ts":"2026-11-05T14:00:18.136Z"}
ac13/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-54afc33200916566","seq":8,"ts":"2026-11-05T14:00:18.148Z"}
ac13/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-54afc33200916566","seq":11,"ts":"2026-11-05T14:00:18.174Z"}
ac13/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-54afc33200916566","seq":18,"ts":"2026-11-05T14:00:18.424Z"}
ac13/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_missing"},"gen":"gen-54afc33200916566","seq":20,"ts":"2026-11-05T14:00:18.444Z"}
ac13/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-54afc33200916566","seq":23,"ts":"2026-11-05T14:00:18.448Z"}
ac13/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_missing","stage":"missing","message":"核对失败：未找到判定文件 out/verdict.json"},"gen":"gen-54afc33200916566","seq":19,"ts":"2026-11-05T14:00:18.431Z"}
ac13/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-54afc33200916566","seq":21,"ts":"2026-11-05T14:00:18.445Z"}
ac13/INST-001 {"object":"session","objectId":"mock-sess-9744-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-54afc33200916566","seq":22,"ts":"2026-11-05T14:00:18.446Z"}
```

**④ 判定**：通过（断言 6/6 通过）

- ✅ 机检：nodes[1].state='escalated'（期望 "escalated"）
- ✅ 机检：escalations[0].reasonCode='verdict_missing'（期望 "verdict_missing"）
- ✅ orch status 输出含「核对失败：未找到判定文件 out/verdict.json」（期望包含 "核对失败：未找到判定文件 out/verdict.json"）
- ✅ 机检：nodes[0].state=done（期望 "done"）
- ✅ 机检：nodes[0].round=1（期望 1）
- ✅ 机检：不存在 edge.kind=backflow 的交接包（期望 0）



---

#### AC-14 判定不可解析的四种样本都不回流

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-bad-json`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-no-field`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-maybe`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-pass-with-defects`（叙事实例号 `INST-212`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（4 个独立项目根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario verdict-bad-json --reset] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-bad-json --scenario verdict-bad-json --reset   | cwd=D:\WWW\Maestro | exit=0 | 1258ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-bad-json | exit=0 | 218ms
[driver --scenario verdict-no-field --reset] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-no-field --scenario verdict-no-field --reset   | cwd=D:\WWW\Maestro | exit=0 | 1272ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-no-field | exit=0 | 216ms
[driver --scenario verdict-maybe --reset] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-maybe --scenario verdict-maybe --reset   | cwd=D:\WWW\Maestro | exit=0 | 1243ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-maybe | exit=0 | 217ms
[driver --scenario verdict-pass-with-defects --reset] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-pass-with-defects --scenario verdict-pass-with-defects --reset   | cwd=D:\WWW\Maestro | exit=0 | 1224ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac14-verdict-pass-with-defects | exit=0 | 199ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-14.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-bad-json","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-bad-json\\demo-code-pass","scenario":"verdict-bad-json","resolvedScenario":"verdict-bad-json","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_invalid"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":875,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_invalid","ok":true,"detail":"verdict_invalid"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:19
交接包 HO-001  开发→测试  已投递   22:00:19
交接包 HO-001  开发→测试  已接受   22:00:19
升级 ESC-001 待处理
  原因：核对失败：判定文件不可解析
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-no-field","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-no-field\\demo-code-pass","scenario":"verdict-no-field","resolvedScenario":"verdict-schema","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_invalid"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":875,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_invalid","ok":true,"detail":"verdict_invalid"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:21
交接包 HO-001  开发→测试  已投递   22:00:21
交接包 HO-001  开发→测试  已接受   22:00:21
升级 ESC-001 待处理
  原因：核对失败：判定文件不可解析
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-maybe","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-maybe\\demo-code-pass","scenario":"verdict-maybe","resolvedScenario":"verdict-maybe","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_invalid"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":879,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_invalid","ok":true,"detail":"verdict_invalid"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:22
交接包 HO-001  开发→测试  已投递   22:00:22
交接包 HO-001  开发→测试  已接受   22:00:22
升级 ESC-001 待处理
  原因：核对失败：判定文件不可解析
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-pass-with-defects","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac14-verdict-pass-with-defects\\demo-code-pass","scenario":"verdict-pass-with-defects","resolvedScenario":"verdict-pass-with-defects","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_invalid"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":877,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_invalid","ok":true,"detail":"verdict_invalid"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:24
交接包 HO-001  开发→测试  已投递   22:00:24
交接包 HO-001  开发→测试  已接受   22:00:24
升级 ESC-001 待处理
  原因：核对失败：判定为通过，但缺陷清单非空
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-14.state.json`）：

```json
[
  {
    "__root": "ac14-verdict-bad-json",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 20,
      "counters": {
        "eventSeq": 19,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-12004-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-5692-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T14:00:19.706Z",
          "deliveredAt": "2026-11-05T14:00:19.939Z",
          "acceptedAt": "2026-11-05T14:00:19.943Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 1,
          "reasonCode": "verdict_invalid",
          "reasonDetail": "核对失败：判定文件不可解析",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac14-verdict-no-field",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 20,
      "counters": {
        "eventSeq": 19,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-16904-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-13500-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T14:00:21.198Z",
          "deliveredAt": "2026-11-05T14:00:21.423Z",
          "acceptedAt": "2026-11-05T14:00:21.433Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 1,
          "reasonCode": "verdict_invalid",
          "reasonDetail": "核对失败：判定文件不可解析",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac14-verdict-maybe",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 20,
      "counters": {
        "eventSeq": 19,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-20568-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-23176-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T14:00:22.668Z",
          "deliveredAt": "2026-11-05T14:00:22.883Z",
          "acceptedAt": "2026-11-05T14:00:22.889Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 1,
          "reasonCode": "verdict_invalid",
          "reasonDetail": "核对失败：判定文件不可解析",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac14-verdict-pass-with-defects",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 20,
      "counters": {
        "eventSeq": 19,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-19440-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-12076-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T14:00:24.161Z",
          "deliveredAt": "2026-11-05T14:00:24.388Z",
          "acceptedAt": "2026-11-05T14:00:24.392Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 1,
          "reasonCode": "verdict_invalid",
          "reasonDetail": "核对失败：判定为通过，但缺陷清单非空",
          "state": "pending",
          "defects": []
        }
      ]
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-14.events.jsonl`）：

```
ac14-verdict-bad-json/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-2ba197b57181061b","seq":1,"ts":"2026-11-05T14:00:19.398Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-2ba197b57181061b","seq":2,"ts":"2026-11-05T14:00:19.411Z"}
ac14-verdict-bad-json/INST-001 {"object":"session","objectId":"mock-sess-12004-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2ba197b57181061b","seq":6,"ts":"2026-11-05T14:00:19.659Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2ba197b57181061b","seq":7,"ts":"2026-11-05T14:00:19.669Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-2ba197b57181061b","seq":8,"ts":"2026-11-05T14:00:19.684Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-2ba197b57181061b","seq":11,"ts":"2026-11-05T14:00:19.719Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2ba197b57181061b","seq":18,"ts":"2026-11-05T14:00:19.984Z"}
ac14-verdict-bad-json/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_invalid"},"gen":"gen-2ba197b57181061b","seq":20,"ts":"2026-11-05T14:00:20.001Z"}
ac14-verdict-bad-json/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-2ba197b57181061b","seq":23,"ts":"2026-11-05T14:00:20.007Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_invalid","stage":"unparsable","message":"核对失败：判定文件不可解析"},"gen":"gen-2ba197b57181061b","seq":19,"ts":"2026-11-05T14:00:19.991Z"}
ac14-verdict-bad-json/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-2ba197b57181061b","seq":21,"ts":"2026-11-05T14:00:20.003Z"}
ac14-verdict-bad-json/INST-001 {"object":"session","objectId":"mock-sess-5692-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-2ba197b57181061b","seq":22,"ts":"2026-11-05T14:00:20.005Z"}
ac14-verdict-no-field/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":1,"ts":"2026-11-05T14:00:20.895Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-2aeb3c521eba9a62","seq":2,"ts":"2026-11-05T14:00:20.907Z"}
ac14-verdict-no-field/INST-001 {"object":"session","objectId":"mock-sess-16904-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":6,"ts":"2026-11-05T14:00:21.158Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":7,"ts":"2026-11-05T14:00:21.167Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":8,"ts":"2026-11-05T14:00:21.180Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-2aeb3c521eba9a62","seq":11,"ts":"2026-11-05T14:00:21.209Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":18,"ts":"2026-11-05T14:00:21.480Z"}
ac14-verdict-no-field/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_invalid"},"gen":"gen-2aeb3c521eba9a62","seq":20,"ts":"2026-11-05T14:00:21.494Z"}
ac14-verdict-no-field/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":23,"ts":"2026-11-05T14:00:21.499Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_invalid","stage":"schema","message":"核对失败：判定文件不可解析"},"gen":"gen-2aeb3c521eba9a62","seq":19,"ts":"2026-11-05T14:00:21.486Z"}
ac14-verdict-no-field/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":21,"ts":"2026-11-05T14:00:21.495Z"}
ac14-verdict-no-field/INST-001 {"object":"session","objectId":"mock-sess-13500-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-2aeb3c521eba9a62","seq":22,"ts":"2026-11-05T14:00:21.496Z"}
ac14-verdict-maybe/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-c836670b2dafd3a4","seq":1,"ts":"2026-11-05T14:00:22.384Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-c836670b2dafd3a4","seq":2,"ts":"2026-11-05T14:00:22.390Z"}
ac14-verdict-maybe/INST-001 {"object":"session","objectId":"mock-sess-20568-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c836670b2dafd3a4","seq":6,"ts":"2026-11-05T14:00:22.633Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c836670b2dafd3a4","seq":7,"ts":"2026-11-05T14:00:22.640Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-c836670b2dafd3a4","seq":8,"ts":"2026-11-05T14:00:22.652Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-c836670b2dafd3a4","seq":11,"ts":"2026-11-05T14:00:22.677Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-c836670b2dafd3a4","seq":18,"ts":"2026-11-05T14:00:22.920Z"}
ac14-verdict-maybe/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_invalid"},"gen":"gen-c836670b2dafd3a4","seq":20,"ts":"2026-11-05T14:00:22.941Z"}
ac14-verdict-maybe/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-c836670b2dafd3a4","seq":23,"ts":"2026-11-05T14:00:22.948Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_invalid","stage":"schema","message":"核对失败：判定文件不可解析"},"gen":"gen-c836670b2dafd3a4","seq":19,"ts":"2026-11-05T14:00:22.926Z"}
ac14-verdict-maybe/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-c836670b2dafd3a4","seq":21,"ts":"2026-11-05T14:00:22.943Z"}
ac14-verdict-maybe/INST-001 {"object":"session","objectId":"mock-sess-23176-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-c836670b2dafd3a4","seq":22,"ts":"2026-11-05T14:00:22.946Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":1,"ts":"2026-11-05T14:00:23.864Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-933c5ebb8f8ad725","seq":2,"ts":"2026-11-05T14:00:23.877Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"session","objectId":"mock-sess-19440-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":6,"ts":"2026-11-05T14:00:24.123Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":7,"ts":"2026-11-05T14:00:24.131Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":8,"ts":"2026-11-05T14:00:24.144Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-933c5ebb8f8ad725","seq":11,"ts":"2026-11-05T14:00:24.172Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":18,"ts":"2026-11-05T14:00:24.451Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_invalid"},"gen":"gen-933c5ebb8f8ad725","seq":20,"ts":"2026-11-05T14:00:24.468Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":23,"ts":"2026-11-05T14:00:24.473Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_invalid","stage":"pass_with_defects","message":"核对失败：判定为通过，但缺陷清单非空"},"gen":"gen-933c5ebb8f8ad725","seq":19,"ts":"2026-11-05T14:00:24.459Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":21,"ts":"2026-11-05T14:00:24.470Z"}
ac14-verdict-pass-with-defects/INST-001 {"object":"session","objectId":"mock-sess-12076-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-933c5ebb8f8ad725","seq":22,"ts":"2026-11-05T14:00:24.471Z"}
```

**④ 判定**：通过（断言 24/24 通过）

- ✅ [verdict-bad-json] 四次都出现「已升级」（期望包含 "已升级"）
- ✅ [verdict-bad-json] 原因原文以「核对失败：」开头（期望包含 "原因：核对失败："）
- ✅ [verdict-bad-json] nodes[0].state=done（期望 "done"）
- ✅ [verdict-bad-json] nodes[0].round=1（期望 1）
- ✅ [verdict-bad-json] 不存在 edge.kind=backflow 的交接包（期望 0）
- ✅ [verdict-bad-json] escalations[0].reasonCode=verdict_invalid（期望 "verdict_invalid"）
- ✅ [verdict-no-field] 四次都出现「已升级」（期望包含 "已升级"）
- ✅ [verdict-no-field] 原因原文以「核对失败：」开头（期望包含 "原因：核对失败："）
- ✅ [verdict-no-field] nodes[0].state=done（期望 "done"）
- ✅ [verdict-no-field] nodes[0].round=1（期望 1）
- ✅ [verdict-no-field] 不存在 edge.kind=backflow 的交接包（期望 0）
- ✅ [verdict-no-field] escalations[0].reasonCode=verdict_invalid（期望 "verdict_invalid"）
- ✅ [verdict-maybe] 四次都出现「已升级」（期望包含 "已升级"）
- ✅ [verdict-maybe] 原因原文以「核对失败：」开头（期望包含 "原因：核对失败："）
- ✅ [verdict-maybe] nodes[0].state=done（期望 "done"）
- ✅ [verdict-maybe] nodes[0].round=1（期望 1）
- ✅ [verdict-maybe] 不存在 edge.kind=backflow 的交接包（期望 0）
- ✅ [verdict-maybe] escalations[0].reasonCode=verdict_invalid（期望 "verdict_invalid"）
- ✅ [verdict-pass-with-defects] 四次都出现「已升级」（期望包含 "已升级"）
- ✅ [verdict-pass-with-defects] 原因原文以「核对失败：」开头（期望包含 "原因：核对失败："）
- ✅ [verdict-pass-with-defects] nodes[0].state=done（期望 "done"）
- ✅ [verdict-pass-with-defects] nodes[0].round=1（期望 1）
- ✅ [verdict-pass-with-defects] 不存在 edge.kind=backflow 的交接包（期望 0）
- ✅ [verdict-pass-with-defects] escalations[0].reasonCode=verdict_invalid（期望 "verdict_invalid"）



---

#### AC-15 判定以文件为准，不以对话为准

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac15`（叙事实例号 `INST-213`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac15 | exit=0 | 97ms
[orch status --instance INST-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac15 | exit=0 | 112ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-15.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:00:25
交接包 HO-001  开发→测试  已投递   22:00:25
交接包 HO-001  开发→测试  已接受   22:00:25
交接包 HO-001  开发→测试  已完成   22:00:25
交接包 HO-002  测试→开发（回流）  已构造   22:00:25
交接包 HO-002  测试→开发（回流）  已投递   22:00:26
交接包 HO-002  测试→开发（回流）  已接受   22:00:26
交接包 HO-002  测试→开发（回流）  已完成   22:00:26
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:00:25
交接包 HO-001  开发→测试  已投递   22:00:25
交接包 HO-001  开发→测试  已接受   22:00:25
交接包 HO-001  开发→测试  已完成   22:00:25
交接包 HO-002  测试→开发（回流）  已构造   22:00:25
交接包 HO-002  测试→开发（回流）  已投递   22:00:26
交接包 HO-002  测试→开发（回流）  已接受   22:00:26
交接包 HO-002  测试→开发（回流）  已完成   22:00:26
[#1] 22:00:25  实例 INST-001  已创建 → 运行中  原因 开始运行
[#2] 22:00:25  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮
[#3] 22:00:25  会话 mock-sess-29896-1  空闲 → 执行中  原因 会话状态
[#4] 22:00:25  会话 mock-sess-29896-1  执行中 → 执行中（tool_call）  原因 会话状态
[#5] 22:00:25  会话 mock-sess-29896-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#6] 22:00:25  会话 mock-sess-29896-1  执行中 → 等待下游  原因 产出已提交
[#7] 22:00:25  节点 T-001  执行中 → 待校验  原因 产出已提交
[#8] 22:00:25  节点 T-001  待校验 → 已完成  原因 核对通过
[#9] 22:00:25  会话 mock-sess-29896-1  等待下游 → 空闲  原因 运行完成
[#10] 22:00:25  交接包 HO-001  已构造  原因 构造交接
[#11] 22:00:25  节点 T-002  派发 → 执行中  原因 派发 · 第 1 轮
[#12] 22:00:25  交接包 HO-001  已构造 → 已投递  原因 交接已投递
[#13] 22:00:25  会话 mock-sess-15860-1  空闲 → 执行中  原因 会话状态
[#14] 22:00:25  交接包 HO-001  已投递 → 已接受  原因 首个事件
[#15] 22:00:25  会话 mock-sess-15860-1  执行中 → 执行中（tool_call）  原因 会话状态
[#16] 22:00:25  会话 mock-sess-15860-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#17] 22:00:25  会话 mock-sess-15860-1  执行中 → 等待下游  原因 产出已提交
[#18] 22:00:25  节点 T-002  执行中 → 待校验  原因 产出已提交
[#19] 22:00:25  节点 T-002  verdict.read  原因 读取判定
[#20] 22:00:25  交接包 HO-001  已接受 → 已完成  原因 产出核对通过
[#21] 22:00:25  节点 T-002  待校验 → 失败  原因 核对失败
[#22] 22:00:25  会话 mock-sess-15860-1  等待下游 → 空闲  原因 核对失败
[#23] 22:00:25  交接包 HO-002  已构造  原因 构造交接
[#24] 22:00:25  交接包 HO-002  backflow.constructed  原因 构造回流
      缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
      缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）
      复测要求：按上方每条缺陷修正后重新提交产物
[#25] 22:00:25  节点 T-001  派发 → 执行中  原因 派发 · 第 2 轮
[#26] 22:00:26  交接包 HO-002  已构造 → 已投递  原因 交接已投递
[#27] 22:00:26  会话 mock-sess-3884-1  空闲 → 执行中  原因 会话状态
[#28] 22:00:26  交接包 HO-002  已投递 → 已接受  原因 首个事件
[#29] 22:00:26  会话 mock-sess-3884-1  执行中 → 执行中（tool_call）  原因 会话状态
[#30] 22:00:26  会话 mock-sess-3884-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#31] 22:00:26  会话 mock-sess-3884-1  执行中 → 等待下游  原因 产出已提交
[#32] 22:00:26  节点 T-001  执行中 → 待校验  原因 产出已提交
[#33] 22:00:26  节点 T-001  待校验 → 已完成  原因 核对通过
[#34] 22:00:26  交接包 HO-002  已接受 → 已完成  原因 产出核对通过
[#35] 22:00:26  会话 mock-sess-3884-1  等待下游 → 空闲  原因 运行完成
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-15.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "running",
  "template": "code-loop",
  "halted": false,
  "rev": 33,
  "counters": {
    "eventSeq": 35,
    "runCount": 1,
    "dispatchCount": 3
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "failed",
      "note": "等待复测",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:00:25.941Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-29896-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-15860-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-3884-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:25.643Z",
      "deliveredAt": "2026-11-05T14:00:25.873Z",
      "acceptedAt": "2026-11-05T14:00:25.877Z",
      "consumedAt": "2026-11-05T14:00:25.942Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:25.973Z",
      "deliveredAt": "2026-11-05T14:00:26.199Z",
      "acceptedAt": "2026-11-05T14:00:26.203Z",
      "consumedAt": "2026-11-05T14:00:26.259Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T14:00:25.973Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-15.events.jsonl`）：

```
ac15/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":1,"ts":"2026-11-05T14:00:25.331Z"}
ac15/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-d3faf8c3fd91810e","seq":2,"ts":"2026-11-05T14:00:25.340Z"}
ac15/INST-001 {"object":"session","objectId":"mock-sess-29896-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":6,"ts":"2026-11-05T14:00:25.605Z"}
ac15/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":7,"ts":"2026-11-05T14:00:25.612Z"}
ac15/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":8,"ts":"2026-11-05T14:00:25.626Z"}
ac15/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-d3faf8c3fd91810e","seq":11,"ts":"2026-11-05T14:00:25.656Z"}
ac15/INST-001 {"object":"session","objectId":"mock-sess-15860-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":17,"ts":"2026-11-05T14:00:25.918Z"}
ac15/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":18,"ts":"2026-11-05T14:00:25.931Z"}
ac15/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-d3faf8c3fd91810e","seq":19,"ts":"2026-11-05T14:00:25.941Z"}
ac15/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887225942},"gen":"gen-d3faf8c3fd91810e","seq":20,"ts":"2026-11-05T14:00:25.942Z"}
ac15/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-d3faf8c3fd91810e","seq":21,"ts":"2026-11-05T14:00:25.954Z"}
ac15/INST-001 {"object":"session","objectId":"mock-sess-15860-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":22,"ts":"2026-11-05T14:00:25.956Z"}
ac15/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-d3faf8c3fd91810e","seq":24,"ts":"2026-11-05T14:00:25.982Z"}
ac15/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-d3faf8c3fd91810e","seq":25,"ts":"2026-11-05T14:00:25.990Z"}
ac15/INST-001 {"object":"session","objectId":"mock-sess-3884-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":31,"ts":"2026-11-05T14:00:26.241Z"}
ac15/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":32,"ts":"2026-11-05T14:00:26.246Z"}
ac15/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":33,"ts":"2026-11-05T14:00:26.258Z"}
ac15/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887226259},"gen":"gen-d3faf8c3fd91810e","seq":34,"ts":"2026-11-05T14:00:26.260Z"}
ac15/INST-001 {"object":"session","objectId":"mock-sess-3884-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-d3faf8c3fd91810e","seq":35,"ts":"2026-11-05T14:00:26.266Z"}
```

**④ 判定**：通过（断言 8/8 通过）

- ✅ 夹具停在「开发第 2 轮核对完成、复测派发前」（.mock/stopped-after-3 出现）
- ✅ 输出含「判定 不通过」（期望包含 "判定 不通过"）
- ✅ 机检：存在 edge.kind=backflow 的交接包（说明触发了回流）
- ✅ 机检：events 有一条 reason='verdict.read'
- ✅ 机检：detail.source='file'（期望 "file"）
- ✅ 机检：detail.path='out/verdict.json'（期望 "out/verdict.json"）
- ✅ 机检：detail.verdict='fail'（期望 "fail"）
- ✅ orch status --events 输出含「原因 读取判定」（期望包含 "原因 读取判定"）



---

#### AC-16 判定文件不是本轮新写 → 单独的原因，不误报「未找到」

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac16-stale`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac16-stale-retest`（叙事实例号 `INST-214`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（2 个独立项目根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario verdict-stale] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac16-stale --scenario verdict-stale   | cwd=D:\WWW\Maestro | exit=0 | 1273ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac16-stale | exit=0 | 232ms
[driver --scenario verdict-stale-retest] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac16-stale-retest --scenario verdict-stale-retest   | cwd=D:\WWW\Maestro | exit=1 | 1906ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac16-stale-retest | exit=0 | 219ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-16.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac16-stale","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac16-stale\\demo-code-pass","scenario":"verdict-stale","resolvedScenario":"verdict-stale","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_stale"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":879,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_stale","ok":true,"detail":"verdict_stale"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:27
交接包 HO-001  开发→测试  已投递   22:00:28
交接包 HO-001  开发→测试  已接受   22:00:28
升级 ESC-001 待处理
  原因：核对失败：判定文件不是本轮新写 out/verdict.json
{"ok":false,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac16-stale-retest","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac16-stale-retest\\demo-code-pass","scenario":"verdict-stale-retest","resolvedScenario":"verdict-stale-retest","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_stale"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1541,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_stale","ok":true,"detail":"verdict_stale"},{"name":"无 backflow 交接包","ok":false}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 2 条
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:29
交接包 HO-001  开发→测试  已投递   22:00:29
交接包 HO-001  开发→测试  已接受   22:00:29
交接包 HO-001  开发→测试  已完成   22:00:29
交接包 HO-002  测试→开发（回流）  已构造   22:00:29
交接包 HO-002  测试→开发（回流）  已投递   22:00:29
交接包 HO-002  测试→开发（回流）  已接受   22:00:29
交接包 HO-002  测试→开发（回流）  已完成   22:00:29
交接包 HO-003  开发→测试（复测）  已构造   22:00:30
交接包 HO-003  开发→测试（复测）  已投递   22:00:30
交接包 HO-003  开发→测试（复测）  已接受   22:00:30
升级 ESC-001 待处理
  原因：核对失败：判定文件不是本轮新写 out/verdict.json
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-16.state.json`）：

```json
[
  {
    "__root": "ac16-stale",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 20,
      "counters": {
        "eventSeq": 19,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-14020-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-10828-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T14:00:27.873Z",
          "deliveredAt": "2026-11-05T14:00:28.092Z",
          "acceptedAt": "2026-11-05T14:00:28.100Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 1,
          "reasonCode": "verdict_stale",
          "reasonDetail": "核对失败：判定文件不是本轮新写 out/verdict.json",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac16-stale-retest",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 42,
      "counters": {
        "eventSeq": 45,
        "runCount": 1,
        "dispatchCount": 4
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 2,
          "state": "escalated",
          "note": null,
          "verdict": {
            "value": "fail",
            "defectCount": 2,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:00:29.684Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-34052-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-18144-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-25404-1",
          "nodeId": "T-001",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-27596-1",
          "nodeId": "T-002",
          "round": 2,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:29.391Z",
          "deliveredAt": "2026-11-05T14:00:29.618Z",
          "acceptedAt": "2026-11-05T14:00:29.625Z",
          "consumedAt": "2026-11-05T14:00:29.687Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:29.715Z",
          "deliveredAt": "2026-11-05T14:00:29.946Z",
          "acceptedAt": "2026-11-05T14:00:29.952Z",
          "consumedAt": "2026-11-05T14:00:29.994Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T14:00:29.715Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        },
        {
          "handoffId": "HO-003",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "retest"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T14:00:30.013Z",
          "deliveredAt": "2026-11-05T14:00:30.242Z",
          "acceptedAt": "2026-11-05T14:00:30.247Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 2,
          "reasonCode": "verdict_stale",
          "reasonDetail": "核对失败：判定文件不是本轮新写 out/verdict.json",
          "state": "pending",
          "defects": []
        }
      ]
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-16.events.jsonl`）：

```
ac16-stale/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-f6d9ab82820921b3","seq":1,"ts":"2026-11-05T14:00:27.568Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-f6d9ab82820921b3","seq":2,"ts":"2026-11-05T14:00:27.579Z"}
ac16-stale/INST-001 {"object":"session","objectId":"mock-sess-14020-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-f6d9ab82820921b3","seq":6,"ts":"2026-11-05T14:00:27.832Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-f6d9ab82820921b3","seq":7,"ts":"2026-11-05T14:00:27.841Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-f6d9ab82820921b3","seq":8,"ts":"2026-11-05T14:00:27.853Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-f6d9ab82820921b3","seq":11,"ts":"2026-11-05T14:00:27.889Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-f6d9ab82820921b3","seq":18,"ts":"2026-11-05T14:00:28.140Z"}
ac16-stale/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_stale"},"gen":"gen-f6d9ab82820921b3","seq":20,"ts":"2026-11-05T14:00:28.164Z"}
ac16-stale/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-f6d9ab82820921b3","seq":23,"ts":"2026-11-05T14:00:28.174Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_stale","stage":"stale","message":"核对失败：判定文件不是本轮新写 out/verdict.json"},"gen":"gen-f6d9ab82820921b3","seq":19,"ts":"2026-11-05T14:00:28.151Z"}
ac16-stale/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-f6d9ab82820921b3","seq":21,"ts":"2026-11-05T14:00:28.168Z"}
ac16-stale/INST-001 {"object":"session","objectId":"mock-sess-10828-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-f6d9ab82820921b3","seq":22,"ts":"2026-11-05T14:00:28.172Z"}
ac16-stale-retest/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-9dbd5f939a672dac","seq":1,"ts":"2026-11-05T14:00:29.091Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-9dbd5f939a672dac","seq":2,"ts":"2026-11-05T14:00:29.103Z"}
ac16-stale-retest/INST-001 {"object":"session","objectId":"mock-sess-34052-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":6,"ts":"2026-11-05T14:00:29.354Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":7,"ts":"2026-11-05T14:00:29.361Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-9dbd5f939a672dac","seq":8,"ts":"2026-11-05T14:00:29.375Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-9dbd5f939a672dac","seq":11,"ts":"2026-11-05T14:00:29.405Z"}
ac16-stale-retest/INST-001 {"object":"session","objectId":"mock-sess-18144-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":17,"ts":"2026-11-05T14:00:29.663Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":18,"ts":"2026-11-05T14:00:29.677Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-9dbd5f939a672dac","seq":19,"ts":"2026-11-05T14:00:29.684Z"}
ac16-stale-retest/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887229687},"gen":"gen-9dbd5f939a672dac","seq":20,"ts":"2026-11-05T14:00:29.688Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-9dbd5f939a672dac","seq":21,"ts":"2026-11-05T14:00:29.698Z"}
ac16-stale-retest/INST-001 {"object":"session","objectId":"mock-sess-18144-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-9dbd5f939a672dac","seq":22,"ts":"2026-11-05T14:00:29.701Z"}
ac16-stale-retest/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-9dbd5f939a672dac","seq":24,"ts":"2026-11-05T14:00:29.722Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-9dbd5f939a672dac","seq":25,"ts":"2026-11-05T14:00:29.727Z"}
ac16-stale-retest/INST-001 {"object":"session","objectId":"mock-sess-25404-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":31,"ts":"2026-11-05T14:00:29.975Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":32,"ts":"2026-11-05T14:00:29.983Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-9dbd5f939a672dac","seq":33,"ts":"2026-11-05T14:00:29.993Z"}
ac16-stale-retest/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887229994},"gen":"gen-9dbd5f939a672dac","seq":34,"ts":"2026-11-05T14:00:29.994Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-9dbd5f939a672dac","seq":37,"ts":"2026-11-05T14:00:30.027Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9dbd5f939a672dac","seq":44,"ts":"2026-11-05T14:00:30.287Z"}
ac16-stale-retest/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"verdict_stale"},"gen":"gen-9dbd5f939a672dac","seq":46,"ts":"2026-11-05T14:00:30.301Z"}
ac16-stale-retest/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-9dbd5f939a672dac","seq":49,"ts":"2026-11-05T14:00:30.309Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_stale","stage":"stale","message":"核对失败：判定文件不是本轮新写 out/verdict.json"},"gen":"gen-9dbd5f939a672dac","seq":45,"ts":"2026-11-05T14:00:30.293Z"}
ac16-stale-retest/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-9dbd5f939a672dac","seq":47,"ts":"2026-11-05T14:00:30.302Z"}
ac16-stale-retest/INST-001 {"object":"session","objectId":"mock-sess-27596-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-9dbd5f939a672dac","seq":48,"ts":"2026-11-05T14:00:30.304Z"}
```

**④ 判定**：通过（断言 10/10 通过）

- ✅ [stale] 机检：escalations[0].reasonCode='verdict_stale'（期望 "verdict_stale"）
- ✅ [stale] 输出含「核对失败：判定文件不是本轮新写 out/verdict.json」（期望包含 "核对失败：判定文件不是本轮新写 out/verdict.json"）
- ✅ [stale] 输出不含「未找到判定文件」（期望不含 "未找到判定文件"）
- ✅ [stale] 机检：nodes[0].state=done（期望 "done"）
- ✅ [stale] 机检：nodes[0].round=1（期望 1）
- ✅ [stale] 机检：无回流交接包（期望 0）
- ✅ [stale-retest] 机检：escalations[0].reasonCode='verdict_stale'（期望 "verdict_stale"）
- ✅ [stale-retest] 机检：nodes[1].round=2（期望 2）
- ✅ [stale-retest] 机检：nodes[1].state='escalated'（期望 "escalated"）
- ✅ [stale-retest] 输出含「核对失败：判定文件不是本轮新写 out/verdict.json」（期望包含 "核对失败：判定文件不是本轮新写 out/verdict.json"）



---

#### AC-18 不通过但没有缺陷清单，不回流

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac18`（叙事实例号 `INST-215`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario verdict-no-defects] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac18 --scenario verdict-no-defects   | cwd=D:\WWW\Maestro | exit=0 | 1254ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac18 | exit=0 | 205ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-18.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac18","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac18\\demo-code-pass","scenario":"verdict-no-defects","resolvedScenario":"verdict-no-defects","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_invalid"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":872,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_invalid","ok":true,"detail":"verdict_invalid"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:31
交接包 HO-001  开发→测试  已投递   22:00:31
交接包 HO-001  开发→测试  已接受   22:00:31
升级 ESC-001 待处理
  原因：核对失败：判定为不通过，但没有缺陷清单
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-18.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 20,
  "counters": {
    "eventSeq": 19,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "escalated",
      "note": null,
      "verdict": null,
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-1344-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-28876-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "accepted",
      "createdAt": "2026-11-05T14:00:31.534Z",
      "deliveredAt": "2026-11-05T14:00:31.763Z",
      "acceptedAt": "2026-11-05T14:00:31.770Z",
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 1,
      "reasonCode": "verdict_invalid",
      "reasonDetail": "核对失败：判定为不通过，但没有缺陷清单",
      "state": "pending",
      "defects": []
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-18.events.jsonl`）：

```
ac18/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":1,"ts":"2026-11-05T14:00:31.242Z"}
ac18/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-2a3aaa1e52c41d59","seq":2,"ts":"2026-11-05T14:00:31.248Z"}
ac18/INST-001 {"object":"session","objectId":"mock-sess-1344-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":6,"ts":"2026-11-05T14:00:31.495Z"}
ac18/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":7,"ts":"2026-11-05T14:00:31.504Z"}
ac18/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":8,"ts":"2026-11-05T14:00:31.516Z"}
ac18/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-2a3aaa1e52c41d59","seq":11,"ts":"2026-11-05T14:00:31.546Z"}
ac18/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":18,"ts":"2026-11-05T14:00:31.812Z"}
ac18/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_invalid"},"gen":"gen-2a3aaa1e52c41d59","seq":20,"ts":"2026-11-05T14:00:31.831Z"}
ac18/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":23,"ts":"2026-11-05T14:00:31.839Z"}
ac18/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_invalid","stage":"no_defects","message":"核对失败：判定为不通过，但没有缺陷清单"},"gen":"gen-2a3aaa1e52c41d59","seq":19,"ts":"2026-11-05T14:00:31.821Z"}
ac18/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":21,"ts":"2026-11-05T14:00:31.833Z"}
ac18/INST-001 {"object":"session","objectId":"mock-sess-28876-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-2a3aaa1e52c41d59","seq":22,"ts":"2026-11-05T14:00:31.837Z"}
```

**④ 判定**：通过（断言 5/5 通过）

- ✅ [AC-18] 机检：escalations[0].reasonCode=verdict_invalid（期望 "verdict_invalid"）
- ✅ [AC-18] 输出含「核对失败：判定为不通过，但没有缺陷清单」（期望包含 "核对失败：判定为不通过，但没有缺陷清单"）
- ✅ [AC-18] 机检：nodes[0].state=done（期望 "done"）
- ✅ [AC-18] 机检：nodes[0].round=1（期望 1）
- ✅ [AC-18] 机检：不存在 edge.kind=backflow 的交接包（期望 0）



---

#### AC-19 缺陷证据打不开，也不回流

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac19`（叙事实例号 `INST-216`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario verdict-missing-evidence] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac19 --scenario verdict-missing-evidence   | cwd=D:\WWW\Maestro | exit=0 | 1249ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac19 | exit=0 | 217ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-19.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac19","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac19\\demo-code-pass","scenario":"verdict-missing-evidence","resolvedScenario":"verdict-evidence-unreadable","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_invalid"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":879,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_invalid","ok":true,"detail":"verdict_invalid"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 1 轮
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:33
交接包 HO-001  开发→测试  已投递   22:00:33
交接包 HO-001  开发→测试  已接受   22:00:33
升级 ESC-001 待处理
  原因：核对失败：缺陷证据不可解析
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-19.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 20,
  "counters": {
    "eventSeq": 19,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "escalated",
      "note": null,
      "verdict": null,
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-28784-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-20756-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "accepted",
      "createdAt": "2026-11-05T14:00:33.018Z",
      "deliveredAt": "2026-11-05T14:00:33.241Z",
      "acceptedAt": "2026-11-05T14:00:33.246Z",
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 1,
      "reasonCode": "verdict_invalid",
      "reasonDetail": "核对失败：缺陷证据不可解析",
      "state": "pending",
      "defects": []
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-19.events.jsonl`）：

```
ac19/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-ade35ab7f4f45551","seq":1,"ts":"2026-11-05T14:00:32.713Z"}
ac19/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-ade35ab7f4f45551","seq":2,"ts":"2026-11-05T14:00:32.719Z"}
ac19/INST-001 {"object":"session","objectId":"mock-sess-28784-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ade35ab7f4f45551","seq":6,"ts":"2026-11-05T14:00:32.969Z"}
ac19/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ade35ab7f4f45551","seq":7,"ts":"2026-11-05T14:00:32.979Z"}
ac19/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-ade35ab7f4f45551","seq":8,"ts":"2026-11-05T14:00:32.993Z"}
ac19/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-ade35ab7f4f45551","seq":11,"ts":"2026-11-05T14:00:33.032Z"}
ac19/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ade35ab7f4f45551","seq":18,"ts":"2026-11-05T14:00:33.287Z"}
ac19/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_invalid"},"gen":"gen-ade35ab7f4f45551","seq":20,"ts":"2026-11-05T14:00:33.306Z"}
ac19/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-ade35ab7f4f45551","seq":23,"ts":"2026-11-05T14:00:33.311Z"}
ac19/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_invalid","stage":"evidence_unreadable","message":"核对失败：缺陷证据不可解析"},"gen":"gen-ade35ab7f4f45551","seq":19,"ts":"2026-11-05T14:00:33.294Z"}
ac19/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-ade35ab7f4f45551","seq":21,"ts":"2026-11-05T14:00:33.308Z"}
ac19/INST-001 {"object":"session","objectId":"mock-sess-20756-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-ade35ab7f4f45551","seq":22,"ts":"2026-11-05T14:00:33.309Z"}
```

**④ 判定**：通过（断言 5/5 通过）

- ✅ [AC-19] 机检：escalations[0].reasonCode=verdict_invalid（期望 "verdict_invalid"）
- ✅ [AC-19] 输出含「核对失败：缺陷证据不可解析」（期望包含 "核对失败：缺陷证据不可解析"）
- ✅ [AC-19] 机检：nodes[0].state=done（期望 "done"）
- ✅ [AC-19] 机检：nodes[0].round=1（期望 1）
- ✅ [AC-19] 机检：不存在 edge.kind=backflow 的交接包（期望 0）



---

#### AC-20 旧格式实例只读可查（含「看也不改」）

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20`（叙事实例号 `INST-217`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合（夹具造 v1 现场 + 产品命令查询）

**① 完整命令 + 夹具场景/开关**

```
[夹具：mkdir -p .orch/instances/OLD-001 OLD-002 并拷入 legacy-v1 四个文件] "(fixture) mkdir -p .orch/instances/OLD-001 OLD-002 并拷入 legacy-v1 四个文件"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[orch status --instance OLD-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance OLD-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20 | exit=0 | 224ms
[orch status --instance OLD-002 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance OLD-002 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20 | exit=0 | 94ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20 | exit=0 | 189ms
[orch status --instance OLD-002 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance OLD-002 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20 | exit=0 | 204ms
[orch cancel --instance OLD-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance OLD-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20 | exit=1 | 84ms
[夹具：mkdir -p ./demo（保证 run 的 cwd 可写，使检查能走到 LEGACY_READ_ONLY）] "(fixture) mkdir -p ./demo（保证 run 的 cwd 可写，使检查能走到 LEGACY_READ_ONLY）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[orch run --cwd ./demo --instance OLD-002 --task …] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo --instance OLD-002 --task …   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac20 | exit=1 | 89ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-20.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 OLD-001 · 已完成
会话 空闲
交接包 HO-001  已构造   17:00:04
交接包 HO-001  已投递   17:00:04
交接包 HO-001  已接受   17:00:05
交接包 HO-001  已完成   17:00:05
17:00:00  实例 OLD-001  已创建 → 运行中  原因 run.started
17:12:00  节点 T-001  执行中 → 待校验  原因 output.submitted
实例 OLD-002 · 运行中
会话 执行中 · 已运行 50638m34s · 无新事件
交接包 HO-001  已构造   18:00:04
交接包 HO-001  已投递   18:00:04
交接包 HO-001  已接受   18:00:05
18:00:00  实例 OLD-002  已创建 → 运行中  原因 run.started
18:02:00  节点 T-001  执行中 → 待校验  原因 output.submitted
实例 OLD-002 · 运行中
会话 执行中 · 已运行 50638m35s · 无新事件
交接包 HO-001  已构造   18:00:04
交接包 HO-001  已投递   18:00:04
交接包 HO-001  已接受   18:00:05
18:00:00  实例 OLD-002  已创建 → 运行中  原因 run.started
18:02:00  节点 T-001  执行中 → 待校验  原因 output.submitted
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-20.state.json`）：

```json
[
  {
    "__root": "ac20",
    "instanceId": "OLD-001",
    "state": {
      "instanceId": "OLD-001",
      "state": "completed",
      "counters": {
        "eventSeq": 18,
        "runCount": 1
      },
      "nodes": [],
      "sessions": [],
      "handoffs": [],
      "escalations": []
    }
  },
  {
    "__root": "ac20",
    "instanceId": "OLD-002",
    "state": {
      "instanceId": "OLD-002",
      "state": "running",
      "counters": {
        "eventSeq": 7,
        "runCount": 1
      },
      "nodes": [],
      "sessions": [],
      "handoffs": [],
      "escalations": []
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-20.events.jsonl`）：

```
ac20/OLD-001 {"object":"instance","objectId":"OLD-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-legacy","seq":1,"ts":"2026-10-01T09:00:00.000Z"}
ac20/OLD-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-legacy","seq":2,"ts":"2026-10-01T09:12:00.000Z"}
ac20/OLD-002 {"object":"instance","objectId":"OLD-002","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-legacy","seq":1,"ts":"2026-10-01T10:00:00.000Z"}
ac20/OLD-002 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-legacy","seq":2,"ts":"2026-10-01T10:02:00.000Z"}
```

**④ 判定**：通过（断言 24/24 通过）

- ✅ 夹具：OLD-001/state.json 的 sha256 与交付物 SHA256SUMS 一致（期望 "95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"）
- ✅ 夹具：OLD-001/events.jsonl 的 sha256 与交付物 SHA256SUMS 一致（期望 "3ef710cc9a4f2f28601af66f43ee68907e4a3538467e94062056a58c38e5b2d9"）
- ✅ 夹具：OLD-002/state.json 的 sha256 与交付物 SHA256SUMS 一致（期望 "029e7b6a055cd276c1b53a5b7fd96957b534063459a27f66a875f1557b2fa742"）
- ✅ 夹具：OLD-002/events.jsonl 的 sha256 与交付物 SHA256SUMS 一致（期望 "f459831a5ead94abd7fc68f207d4d4a7e003fdef7e6228f8822255472fb88d1d"）
- ✅ OLD-001 能看到「节点」行（期望包含 "节点 "）
- ✅ OLD-001 能看到事件记录（v1 事件行为 I1.1 版式，不带 [#seq]）
- ✅ OLD-002 能看到「节点」行（期望包含 "节点 "）
- ✅ OLD-002 能看到事件记录（v1 事件行为 I1.1 版式，不带 [#seq]）
- ✅ OLD-001 不显示「模板」（期望不含 "模板"）
- ✅ OLD-001 不显示「第 n 轮」（期望 0）
- ✅ OLD-002 不显示「模板」（期望不含 "模板"）
- ✅ OLD-002 不显示「第 n 轮」（期望 0）
- ✅ OLD-002 仍显示「运行中」（期望包含 "运行中"）
- ✅ OLD-002 没有被对账改成「已中断」（期望不含 "已中断"）
- ✅ 重启后 OLD-002 仍显示「运行中」（期望包含 "运行中"）
- ✅ 重启后 OLD-002 仍未被改成「已中断」（期望不含 "已中断"）
- ✅ cancel OLD-001 看到「该实例为旧格式，本版本只支持查看」（期望包含 "该实例为旧格式，本版本只支持查看"）
- ✅ cancel OLD-001 退出码 1（期望 1）
- ✅ run --instance OLD-002 看到同样提示（期望包含 "该实例为旧格式，本版本只支持查看"）
- ✅ run --instance OLD-002 退出码 1（期望 1）
- ✅ 夹具：OLD-001/state.json 四个文件 sha256 与拷贝时完全一致（期望 "95f4a7ba3de34ef57e3f9d07ebca54f32526d3229258164f3251efcccfb78d9a"）
- ✅ 夹具：OLD-001/events.jsonl 四个文件 sha256 与拷贝时完全一致（期望 "3ef710cc9a4f2f28601af66f43ee68907e4a3538467e94062056a58c38e5b2d9"）
- ✅ 夹具：OLD-002/state.json 四个文件 sha256 与拷贝时完全一致（期望 "029e7b6a055cd276c1b53a5b7fd96957b534063459a27f66a875f1557b2fa742"）
- ✅ 夹具：OLD-002/events.jsonl 四个文件 sha256 与拷贝时完全一致（期望 "f459831a5ead94abd7fc68f207d4d4a7e003fdef7e6228f8822255472fb88d1d"）



---

#### AC-23 发起前拦截三种注定跑不通的请求

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac23`（叙事实例号 `INST-218`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：产品命令（夹具根，mock 现场，未派发）

**① 完整命令 + 夹具场景/开关**

```
[orch run --cwd ./demo-code-pass --template no-such-template --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --template no-such-template --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac23 | exit=1 | 316ms
[orch run --cwd ./demo-code-pass --template code-loop --task    ] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --template code-loop --task "   "   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac23 | exit=1 | 105ms
[orch run --cwd ./demo-code-pass --template code-loop --task 给 calc.js 补 div] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --template code-loop --task "给 calc.js 补 div"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac23 | exit=1 | 146ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-23.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
（无输出）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-23.state.json`）：

（无 state.json）

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-23.events.jsonl`）：

（无 events.jsonl）

**④ 判定**：通过（断言 8/8 通过）

- ✅ ① 输出含「未知模板：no-such-template」（期望包含 "未知模板：no-such-template"）
- ✅ ② 输出含「任务描述不能为空」（期望包含 "任务描述不能为空"）
- ✅ ③ 输出含「编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）」（期望包含 "编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）"）
- ✅ ① 退出码是 1（不是 2）（期望 1）
- ✅ ② 退出码是 1（不是 2）（期望 1）
- ✅ ③ 退出码是 1（不是 2）（期望 1）
- ✅ `ls .orch/instances | wc -l` 与执行前相同（期望 0）
- ✅ 机检：events.jsonl 没有被创建（三个目录都不存在）（期望 0）



---

#### AC-24 事件记录里有轮次与升级

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac24`（叙事实例号 `INST-219`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac24 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1927ms
[orch status --instance INST-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac24 | exit=0 | 217ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-24.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac24","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac24\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1519,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:36
交接包 HO-001  开发→测试  已投递   22:00:36
交接包 HO-001  开发→测试  已接受   22:00:36
交接包 HO-001  开发→测试  已完成   22:00:36
交接包 HO-002  测试→开发（回流）  已构造   22:00:36
交接包 HO-002  测试→开发（回流）  已投递   22:00:36
交接包 HO-002  测试→开发（回流）  已接受   22:00:36
交接包 HO-002  测试→开发（回流）  已完成   22:00:36
交接包 HO-003  开发→测试（复测）  已构造   22:00:36
交接包 HO-003  开发→测试（复测）  已投递   22:00:36
交接包 HO-003  开发→测试（复测）  已接受   22:00:36
交接包 HO-003  开发→测试（复测）  已完成   22:00:36
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
[#1] 22:00:35  实例 INST-001  已创建 → 运行中  原因 开始运行
[#2] 22:00:35  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮
[#3] 22:00:35  会话 mock-sess-2172-1  空闲 → 执行中  原因 会话状态
[#4] 22:00:35  会话 mock-sess-2172-1  执行中 → 执行中（tool_call）  原因 会话状态
[#5] 22:00:36  会话 mock-sess-2172-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#6] 22:00:36  会话 mock-sess-2172-1  执行中 → 等待下游  原因 产出已提交
[#7] 22:00:36  节点 T-001  执行中 → 待校验  原因 产出已提交
[#8] 22:00:36  节点 T-001  待校验 → 已完成  原因 核对通过
[#9] 22:00:36  会话 mock-sess-2172-1  等待下游 → 空闲  原因 运行完成
[#10] 22:00:36  交接包 HO-001  已构造  原因 构造交接
[#11] 22:00:36  节点 T-002  派发 → 执行中  原因 派发 · 第 1 轮
[#12] 22:00:36  交接包 HO-001  已构造 → 已投递  原因 交接已投递
[#13] 22:00:36  会话 mock-sess-25844-1  空闲 → 执行中  原因 会话状态
[#14] 22:00:36  交接包 HO-001  已投递 → 已接受  原因 首个事件
[#15] 22:00:36  会话 mock-sess-25844-1  执行中 → 执行中（tool_call）  原因 会话状态
[#16] 22:00:36  会话 mock-sess-25844-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#17] 22:00:36  会话 mock-sess-25844-1  执行中 → 等待下游  原因 产出已提交
[#18] 22:00:36  节点 T-002  执行中 → 待校验  原因 产出已提交
[#19] 22:00:36  节点 T-002  verdict.read  原因 读取判定
[#20] 22:00:36  交接包 HO-001  已接受 → 已完成  原因 产出核对通过
[#21] 22:00:36  节点 T-002  待校验 → 失败  原因 核对失败
[#22] 22:00:36  会话 mock-sess-25844-1  等待下游 → 空闲  原因 核对失败
[#23] 22:00:36  交接包 HO-002  已构造  原因 构造交接
[#24] 22:00:36  交接包 HO-002  backflow.constructed  原因 构造回流
      缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
      缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）
      复测要求：按上方每条缺陷修正后重新提交产物
[#25] 22:00:36  节点 T-001  派发 → 执行中  原因 派发 · 第 2 轮
[#26] 22:00:36  交接包 HO-002  已构造 → 已投递  原因 交接已投递
[#27] 22:00:36  会话 mock-sess-4888-1  空闲 → 执行中  原因 会话状态
[#28] 22:00:36  交接包 HO-002  已投递 → 已接受  原因 首个事件
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-24.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:00:36.968Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-2172-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-25844-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-4888-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33560-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:36.052Z",
      "deliveredAt": "2026-11-05T14:00:36.276Z",
      "acceptedAt": "2026-11-05T14:00:36.283Z",
      "consumedAt": "2026-11-05T14:00:36.339Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:36.371Z",
      "deliveredAt": "2026-11-05T14:00:36.607Z",
      "acceptedAt": "2026-11-05T14:00:36.611Z",
      "consumedAt": "2026-11-05T14:00:36.665Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T14:00:36.371Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:36.686Z",
      "deliveredAt": "2026-11-05T14:00:36.916Z",
      "acceptedAt": "2026-11-05T14:00:36.919Z",
      "consumedAt": "2026-11-05T14:00:36.971Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-24.events.jsonl`）：

```
ac24/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-bc14fec322add989","seq":1,"ts":"2026-11-05T14:00:35.766Z"}
ac24/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-bc14fec322add989","seq":2,"ts":"2026-11-05T14:00:35.774Z"}
ac24/INST-001 {"object":"session","objectId":"mock-sess-2172-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":6,"ts":"2026-11-05T14:00:36.011Z"}
ac24/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":7,"ts":"2026-11-05T14:00:36.018Z"}
ac24/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-bc14fec322add989","seq":8,"ts":"2026-11-05T14:00:36.031Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-bc14fec322add989","seq":11,"ts":"2026-11-05T14:00:36.064Z"}
ac24/INST-001 {"object":"session","objectId":"mock-sess-25844-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":17,"ts":"2026-11-05T14:00:36.320Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":18,"ts":"2026-11-05T14:00:36.327Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-bc14fec322add989","seq":19,"ts":"2026-11-05T14:00:36.337Z"}
ac24/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887236339},"gen":"gen-bc14fec322add989","seq":20,"ts":"2026-11-05T14:00:36.339Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-bc14fec322add989","seq":21,"ts":"2026-11-05T14:00:36.351Z"}
ac24/INST-001 {"object":"session","objectId":"mock-sess-25844-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-bc14fec322add989","seq":22,"ts":"2026-11-05T14:00:36.353Z"}
ac24/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-bc14fec322add989","seq":24,"ts":"2026-11-05T14:00:36.381Z"}
ac24/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-bc14fec322add989","seq":25,"ts":"2026-11-05T14:00:36.389Z"}
ac24/INST-001 {"object":"session","objectId":"mock-sess-4888-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":31,"ts":"2026-11-05T14:00:36.641Z"}
ac24/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":32,"ts":"2026-11-05T14:00:36.649Z"}
ac24/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-bc14fec322add989","seq":33,"ts":"2026-11-05T14:00:36.663Z"}
ac24/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887236665},"gen":"gen-bc14fec322add989","seq":34,"ts":"2026-11-05T14:00:36.666Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-bc14fec322add989","seq":37,"ts":"2026-11-05T14:00:36.702Z"}
ac24/INST-001 {"object":"session","objectId":"mock-sess-33560-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":43,"ts":"2026-11-05T14:00:36.949Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-bc14fec322add989","seq":44,"ts":"2026-11-05T14:00:36.960Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-bc14fec322add989","seq":45,"ts":"2026-11-05T14:00:36.969Z"}
ac24/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887236971},"gen":"gen-bc14fec322add989","seq":46,"ts":"2026-11-05T14:00:36.971Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-bc14fec322add989","seq":47,"ts":"2026-11-05T14:00:36.979Z"}
ac24/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-bc14fec322add989","seq":48,"ts":"2026-11-05T14:00:36.990Z"}
ac24/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-bc14fec322add989","seq":51,"ts":"2026-11-05T14:00:36.994Z"}
ac24/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-bc14fec322add989","seq":49,"ts":"2026-11-05T14:00:36.991Z"}
ac24/INST-001 {"object":"session","objectId":"mock-sess-33560-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-bc14fec322add989","seq":50,"ts":"2026-11-05T14:00:36.993Z"}
```

**④ 判定**：通过（断言 6/6 通过）

- ✅ 输出里有 2 行匹配「节点 T-001  派发 → 执行中  原因 派发 · 第 N 轮」（期望 2）
- ✅ 机检：这 2 条事件的 detail.round 分别是 1 和 2（期望 "[1,2]"）
- ✅ 输出里有 1 行匹配「升级 ESC-001  待处理  原因 创建升级」（期望 1）
- ✅ 输出含「缺陷 1：」（期望包含 "缺陷 1："）
- ✅ 输出含「复测要求：」（期望包含 "复测要求："）
- ✅ 所有状态迁移行都匹配 ^\[#\d+\] \d{2}:\d{2}:\d{2}  \S+ \S+  .+  原因 .+$（期望 0）



---

#### AC-25 非法迁移被拒绝

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac25`（叙事实例号 `INST-220`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac25 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1971ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac25 | exit=0 | 251ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac25 | exit=0 | 189ms
[attempt-transition node cancelled->running] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\attempt-transition.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac25 --instance INST-001 --object node --from cancelled --to running --node T-002   | cwd=D:\WWW\Maestro | exit=0 | 94ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-25.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac25","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac25\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1534,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
会话 空闲
会话 空闲
会话 空闲
会话 空闲
节点 T-001 开发 已完成
节点 T-002 测试 已取消
交接包 HO-001 已完成
交接包 HO-002 已完成
交接包 HO-003 已完成
升级 ESC-001 已作废
  "ok": false,
  "code": "ILLEGAL_TRANSITION",
已拒绝：node cancelled -> running（ILLEGAL_TRANSITION）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-25.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "cancelled",
  "template": "code-loop",
  "halted": false,
  "rev": 44,
  "counters": {
    "eventSeq": 51,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "cancelled",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:00:39.238Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-29104-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-12936-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-8236-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-25720-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:38.330Z",
      "deliveredAt": "2026-11-05T14:00:38.550Z",
      "acceptedAt": "2026-11-05T14:00:38.554Z",
      "consumedAt": "2026-11-05T14:00:38.600Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:38.629Z",
      "deliveredAt": "2026-11-05T14:00:38.861Z",
      "acceptedAt": "2026-11-05T14:00:38.871Z",
      "consumedAt": "2026-11-05T14:00:38.942Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T14:00:38.630Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:38.963Z",
      "deliveredAt": "2026-11-05T14:00:39.187Z",
      "acceptedAt": "2026-11-05T14:00:39.194Z",
      "consumedAt": "2026-11-05T14:00:39.240Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "voided",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-25.events.jsonl`）：

```
ac25/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-45e941493d954eea","seq":1,"ts":"2026-11-05T14:00:37.993Z"}
ac25/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-45e941493d954eea","seq":2,"ts":"2026-11-05T14:00:38.003Z"}
ac25/INST-001 {"object":"session","objectId":"mock-sess-29104-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":6,"ts":"2026-11-05T14:00:38.288Z"}
ac25/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":7,"ts":"2026-11-05T14:00:38.295Z"}
ac25/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-45e941493d954eea","seq":8,"ts":"2026-11-05T14:00:38.313Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-45e941493d954eea","seq":11,"ts":"2026-11-05T14:00:38.342Z"}
ac25/INST-001 {"object":"session","objectId":"mock-sess-12936-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":17,"ts":"2026-11-05T14:00:38.582Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":18,"ts":"2026-11-05T14:00:38.590Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-45e941493d954eea","seq":19,"ts":"2026-11-05T14:00:38.598Z"}
ac25/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887238600},"gen":"gen-45e941493d954eea","seq":20,"ts":"2026-11-05T14:00:38.600Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-45e941493d954eea","seq":21,"ts":"2026-11-05T14:00:38.612Z"}
ac25/INST-001 {"object":"session","objectId":"mock-sess-12936-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-45e941493d954eea","seq":22,"ts":"2026-11-05T14:00:38.614Z"}
ac25/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-45e941493d954eea","seq":24,"ts":"2026-11-05T14:00:38.637Z"}
ac25/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-45e941493d954eea","seq":25,"ts":"2026-11-05T14:00:38.644Z"}
ac25/INST-001 {"object":"session","objectId":"mock-sess-8236-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":31,"ts":"2026-11-05T14:00:38.919Z"}
ac25/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":32,"ts":"2026-11-05T14:00:38.926Z"}
ac25/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-45e941493d954eea","seq":33,"ts":"2026-11-05T14:00:38.940Z"}
ac25/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887238942},"gen":"gen-45e941493d954eea","seq":34,"ts":"2026-11-05T14:00:38.943Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-45e941493d954eea","seq":37,"ts":"2026-11-05T14:00:38.976Z"}
ac25/INST-001 {"object":"session","objectId":"mock-sess-25720-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":43,"ts":"2026-11-05T14:00:39.224Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-45e941493d954eea","seq":44,"ts":"2026-11-05T14:00:39.230Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-45e941493d954eea","seq":45,"ts":"2026-11-05T14:00:39.239Z"}
ac25/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887239240},"gen":"gen-45e941493d954eea","seq":46,"ts":"2026-11-05T14:00:39.240Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-45e941493d954eea","seq":47,"ts":"2026-11-05T14:00:39.248Z"}
ac25/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-45e941493d954eea","seq":48,"ts":"2026-11-05T14:00:39.256Z"}
ac25/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-45e941493d954eea","seq":51,"ts":"2026-11-05T14:00:39.260Z"}
ac25/INST-001 {"object":"escalation","objectId":"ESC-001","from":"pending","to":"voided","result":"applied","reason":"escalation.voided","detail":{"escalationId":"ESC-001"},"gen":"gen-fea02a04086c26dd","seq":54,"ts":"2026-11-05T14:00:39.759Z"}
ac25/INST-001 {"gen":"gen-45e941493d954eea","object":"node","objectId":"T-002","from":"cancelled","to":"running","result":"rejected","reason":"illegal_transition","detail":{"source":"fixture/attempt-transition","message":"node: cancelled -> running is not in the transition table"},"seq":56,"ts":"2026-11-05T14:00:40.046Z"}
ac25/INST-001 {"object":"session","objectId":"mock-sess-25720-1","from":"escalated","to":"idle","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-fea02a04086c26dd","seq":52,"ts":"2026-11-05T14:00:39.756Z"}
ac25/INST-001 {"object":"node","objectId":"T-002","from":"escalated","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-fea02a04086c26dd","seq":53,"ts":"2026-11-05T14:00:39.758Z"}
ac25/INST-001 {"object":"instance","objectId":"INST-001","from":"suspended","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-fea02a04086c26dd","seq":55,"ts":"2026-11-05T14:00:39.760Z"}
```

**④ 判定**：通过（断言 3/3 通过）

- ✅ 机检：events.jsonl 新增一条 result='rejected'、reason='illegal_transition' 的记录
- ✅ 机检：detail.message 含 'not in the transition table'（期望包含 "not in the transition table"）
- ✅ 机检：T-002 的 state 仍为 'cancelled'（期望 "cancelled"）



---

#### AC-26 编排层按门控拒绝越权的唤醒

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac26`（叙事实例号 `INST-221`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once --keep --stop-after 3（长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac26 --scenario backflow-once --keep --stop-after 3   | cwd=D:\WWW\Maestro | exit=null | 0ms
[seam dispatchToNode T-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\call-seam.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac26 --instance INST-001 --call dispatchToNode --node T-001   | cwd=D:\WWW\Maestro | exit=1 | 94ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-26.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":false,"code":"WAKE_REJECTED","detail":{"code":"NO_PENDING_BACKFLOW"}}
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-26.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 36,
  "counters": {
    "eventSeq": 38,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "running",
      "note": "stopped at node running / session idle",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:00:41.463Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-5728-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-10116-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-20152-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:41.192Z",
      "deliveredAt": "2026-11-05T14:00:41.414Z",
      "acceptedAt": "2026-11-05T14:00:41.419Z",
      "consumedAt": "2026-11-05T14:00:41.465Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:41.490Z",
      "deliveredAt": "2026-11-05T14:00:41.713Z",
      "acceptedAt": "2026-11-05T14:00:41.717Z",
      "consumedAt": "2026-11-05T14:00:41.765Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T14:00:41.490Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "created",
      "createdAt": "2026-11-05T14:00:41.993Z",
      "deliveredAt": null,
      "acceptedAt": null,
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-26.events.jsonl`）：

```
ac26/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-6e13d4f72f380583","seq":1,"ts":"2026-11-05T14:00:40.880Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-6e13d4f72f380583","seq":2,"ts":"2026-11-05T14:00:40.888Z"}
ac26/INST-001 {"object":"session","objectId":"mock-sess-5728-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6e13d4f72f380583","seq":6,"ts":"2026-11-05T14:00:41.154Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6e13d4f72f380583","seq":7,"ts":"2026-11-05T14:00:41.161Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-6e13d4f72f380583","seq":8,"ts":"2026-11-05T14:00:41.175Z"}
ac26/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-6e13d4f72f380583","seq":11,"ts":"2026-11-05T14:00:41.201Z"}
ac26/INST-001 {"object":"session","objectId":"mock-sess-10116-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6e13d4f72f380583","seq":17,"ts":"2026-11-05T14:00:41.447Z"}
ac26/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6e13d4f72f380583","seq":18,"ts":"2026-11-05T14:00:41.455Z"}
ac26/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-6e13d4f72f380583","seq":19,"ts":"2026-11-05T14:00:41.463Z"}
ac26/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887241465},"gen":"gen-6e13d4f72f380583","seq":20,"ts":"2026-11-05T14:00:41.466Z"}
ac26/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-6e13d4f72f380583","seq":21,"ts":"2026-11-05T14:00:41.477Z"}
ac26/INST-001 {"object":"session","objectId":"mock-sess-10116-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-6e13d4f72f380583","seq":22,"ts":"2026-11-05T14:00:41.478Z"}
ac26/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-6e13d4f72f380583","seq":24,"ts":"2026-11-05T14:00:41.498Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-6e13d4f72f380583","seq":25,"ts":"2026-11-05T14:00:41.505Z"}
ac26/INST-001 {"object":"session","objectId":"mock-sess-20152-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6e13d4f72f380583","seq":31,"ts":"2026-11-05T14:00:41.746Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6e13d4f72f380583","seq":32,"ts":"2026-11-05T14:00:41.751Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-6e13d4f72f380583","seq":33,"ts":"2026-11-05T14:00:41.764Z"}
ac26/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887241765},"gen":"gen-6e13d4f72f380583","seq":34,"ts":"2026-11-05T14:00:41.765Z"}
ac26/INST-001 {"object":"node","objectId":"T-001","from":null,"to":null,"result":"rejected","reason":"wake.rejected","detail":{"code":"NO_PENDING_BACKFLOW"},"gen":"gen-6e13d4f72f380583","seq":36,"ts":"2026-11-05T14:00:41.893Z"}
ac26/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-6e13d4f72f380583","seq":38,"ts":"2026-11-05T14:00:42.015Z"}
ac26/INST-001 {"object":"session","objectId":"mock-sess-20152-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-6e13d4f72f380583","seq":35,"ts":"2026-11-05T14:00:41.771Z"}
ac26/INST-001 {"object":"handoff","objectId":"HO-003","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-6e13d4f72f380583","seq":37,"ts":"2026-11-05T14:00:42.009Z"}
ac26/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 running / 会话 idle"},"gen":"gen-6e13d4f72f380583","seq":39,"ts":"2026-11-05T14:00:42.045Z"}
```

**④ 判定**：通过（断言 4/4 通过）

- ✅ 停在「开发已完成第 2 轮，没有待唤醒的回流包」，且核心在跑
- ✅ 机检：events.jsonl 新增一条 reason='wake.rejected' 且 detail.code='NO_PENDING_BACKFLOW'
- ✅ 机检：nodes[0].state 没有变化（期望 "done"）
- ✅ 机检：nodes[0].round 没有变化（期望 2）



---

#### AC-27 一次挂起只有一条升级

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac27`（叙事实例号 `INST-222`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac27 --scenario retest-fail --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[seam escalateOnce T-002] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\call-seam.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac27 --instance INST-001 --call escalateOnce --node T-002   | cwd=D:\WWW\Maestro | exit=0 | 79ms
[seam escalateOnce T-002] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\call-seam.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac27 --instance INST-001 --call escalateOnce --node T-002   | cwd=D:\WWW\Maestro | exit=0 | 100ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac27 | exit=0 | 96ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-27.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"escalationId":"ESC-001","reused":true}
{"ok":true,"escalationId":"ESC-001","reused":true}
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   22:00:43
交接包 HO-001  开发→测试  已投递   22:00:43
交接包 HO-001  开发→测试  已接受   22:00:43
交接包 HO-001  开发→测试  已完成   22:00:43
交接包 HO-002  测试→开发（回流）  已构造   22:00:43
交接包 HO-002  测试→开发（回流）  已投递   22:00:43
交接包 HO-002  测试→开发（回流）  已接受   22:00:43
交接包 HO-002  测试→开发（回流）  已完成   22:00:43
交接包 HO-003  开发→测试（复测）  已构造   22:00:44
交接包 HO-003  开发→测试（复测）  已投递   22:00:44
交接包 HO-003  开发→测试（复测）  已接受   22:00:44
交接包 HO-003  开发→测试（复测）  已完成   22:00:44
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-27.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:00:44.284Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-7648-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-23164-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-924-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-13768-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:43.408Z",
      "deliveredAt": "2026-11-05T14:00:43.630Z",
      "acceptedAt": "2026-11-05T14:00:43.638Z",
      "consumedAt": "2026-11-05T14:00:43.686Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:43.715Z",
      "deliveredAt": "2026-11-05T14:00:43.942Z",
      "acceptedAt": "2026-11-05T14:00:43.945Z",
      "consumedAt": "2026-11-05T14:00:43.990Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T14:00:43.715Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:00:44.011Z",
      "deliveredAt": "2026-11-05T14:00:44.240Z",
      "acceptedAt": "2026-11-05T14:00:44.244Z",
      "consumedAt": "2026-11-05T14:00:44.285Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-27.events.jsonl`）：

```
ac27/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-123f3b27541572ae","seq":1,"ts":"2026-11-05T14:00:43.115Z"}
ac27/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-123f3b27541572ae","seq":2,"ts":"2026-11-05T14:00:43.121Z"}
ac27/INST-001 {"object":"session","objectId":"mock-sess-7648-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":6,"ts":"2026-11-05T14:00:43.360Z"}
ac27/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":7,"ts":"2026-11-05T14:00:43.370Z"}
ac27/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-123f3b27541572ae","seq":8,"ts":"2026-11-05T14:00:43.381Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-123f3b27541572ae","seq":11,"ts":"2026-11-05T14:00:43.419Z"}
ac27/INST-001 {"object":"session","objectId":"mock-sess-23164-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":17,"ts":"2026-11-05T14:00:43.667Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":18,"ts":"2026-11-05T14:00:43.677Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-123f3b27541572ae","seq":19,"ts":"2026-11-05T14:00:43.684Z"}
ac27/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887243686},"gen":"gen-123f3b27541572ae","seq":20,"ts":"2026-11-05T14:00:43.686Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-123f3b27541572ae","seq":21,"ts":"2026-11-05T14:00:43.700Z"}
ac27/INST-001 {"object":"session","objectId":"mock-sess-23164-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-123f3b27541572ae","seq":22,"ts":"2026-11-05T14:00:43.702Z"}
ac27/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-123f3b27541572ae","seq":24,"ts":"2026-11-05T14:00:43.723Z"}
ac27/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-123f3b27541572ae","seq":25,"ts":"2026-11-05T14:00:43.734Z"}
ac27/INST-001 {"object":"session","objectId":"mock-sess-924-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":31,"ts":"2026-11-05T14:00:43.970Z"}
ac27/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":32,"ts":"2026-11-05T14:00:43.976Z"}
ac27/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-123f3b27541572ae","seq":33,"ts":"2026-11-05T14:00:43.989Z"}
ac27/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887243990},"gen":"gen-123f3b27541572ae","seq":34,"ts":"2026-11-05T14:00:43.991Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-123f3b27541572ae","seq":37,"ts":"2026-11-05T14:00:44.024Z"}
ac27/INST-001 {"object":"session","objectId":"mock-sess-13768-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":43,"ts":"2026-11-05T14:00:44.270Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-123f3b27541572ae","seq":44,"ts":"2026-11-05T14:00:44.277Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-123f3b27541572ae","seq":45,"ts":"2026-11-05T14:00:44.284Z"}
ac27/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887244285},"gen":"gen-123f3b27541572ae","seq":46,"ts":"2026-11-05T14:00:44.285Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-123f3b27541572ae","seq":47,"ts":"2026-11-05T14:00:44.291Z"}
ac27/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-123f3b27541572ae","seq":48,"ts":"2026-11-05T14:00:44.298Z"}
ac27/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-123f3b27541572ae","seq":51,"ts":"2026-11-05T14:00:44.302Z"}
ac27/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-123f3b27541572ae","seq":49,"ts":"2026-11-05T14:00:44.300Z"}
ac27/INST-001 {"object":"session","objectId":"mock-sess-13768-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-123f3b27541572ae","seq":50,"ts":"2026-11-05T14:00:44.301Z"}
```

**④ 判定**：通过（断言 8/8 通过）

- ✅ retest-fail --keep 跑完（已有 ESC-001），且核心在跑
- ✅ 第 1 次 stdout 含 "ESC-001"（期望包含 "ESC-001"）
- ✅ 第 1 次 stdout 含 "reused":true（期望包含 "\"reused\":true"）
- ✅ 第 2 次 stdout 含 "ESC-001"（期望包含 "ESC-001"）
- ✅ 第 2 次 stdout 含 "reused":true（期望包含 "\"reused\":true"）
- ✅ 机检：escalations.length=1（期望 1）
- ✅ 机检：escalationId 仍是 'ESC-001'（期望 "ESC-001"）
- ✅ orch status 只出现一个以「升级 ESC-」开头的块（期望 1）



---

#### AC-28 引擎不内嵌编码模板（架构检查）

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac28`（叙事实例号 `INST-223`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：架构检查（非用户面）

**① 完整命令 + 夹具场景/开关**

```
[purity-check] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\purity-check.mjs --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator   | cwd=D:\WWW\Maestro | exit=0 | 85ms
[node --test test/templates/fake-graph.test.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe --test test/templates/fake-graph.test.js   | cwd=D:\WWW\Maestro | exit=0 | 184ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-28.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
OK: 扫描 14 个文件，src/core, src/daemon 内 code-loop, developer, tester, coordinator 零命中
# Subtest: planAdvance：判定不通过且未超上限 → backflow（回开发第 2 轮）
ok 3 - planAdvance：判定不通过且未超上限 → backflow（回开发第 2 轮）
# Subtest: buildHandoff / buildBackflowHandoff：D-6 字段齐全且缺陷带证据
ok 9 - buildHandoff / buildBackflowHandoff：D-6 字段齐全且缺陷带证据
# tests 12
# pass 12
# fail 0
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-28.state.json`）：

（无 state.json）

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-28.events.jsonl`）：

（无 events.jsonl）

**④ 判定**：通过（断言 5/5 通过）

- ✅ purity-check 退出码 0（期望 0）
- ✅ stdout 含「零命中」（期望包含 "零命中"）
- ✅ 扫描范围只有 --dirs src/core,src/daemon（stdout 回显）（期望包含 "src/core, src/daemon"）
- ✅ stdout 报告扫描文件数（14 个）
- ✅ node --test fake-graph.test.js 退出码 0（通过）（期望 0）


> 白名单 `src/templates/**` / `test/**` / `docs/**` 与「命中白名单或扫描范围外不算失败」由 purity-check 实现保证；本条只按 AC 原文断言 `--dirs src/core,src/daemon`、四词零命中、退出码 0 与注入图单测通过。

---

#### AC-29 开发产出缺失、为空、或不是本轮新写时不进「已完成」

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-missing`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-empty`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-stale`（叙事实例号 `INST-224`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（3 个独立项目根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario artifact-missing] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-missing --scenario artifact-missing   | cwd=D:\WWW\Maestro | exit=0 | 939ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-missing | exit=0 | 222ms
[driver --scenario artifact-empty] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-empty --scenario artifact-empty   | cwd=D:\WWW\Maestro | exit=0 | 933ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-empty | exit=0 | 209ms
[driver --scenario artifact-stale] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-stale --scenario artifact-stale   | cwd=D:\WWW\Maestro | exit=0 | 1044ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac29-artifact-stale | exit=0 | 203ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-29.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac29-artifact-missing","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac29-artifact-missing\\demo-code-pass","scenario":"artifact-missing","resolvedScenario":"product-missing","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"escalated"},{"nodeId":"T-002","round":0,"state":"pending"}],"handoffs":0,"escalations":[{"escalationId":"ESC-001","reasonCode":"artifact_missing"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":550,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"存在升级","ok":true},{"name":"reason 属于产物核对","ok":true,"detail":"artifact_missing"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已升级 · 第 1 轮
节点 T-002 测试 待执行
会话 已升级
升级 ESC-001 待处理
  原因：核对失败：未找到声明的产出 calc.js
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac29-artifact-empty","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac29-artifact-empty\\demo-code-pass","scenario":"artifact-empty","resolvedScenario":"product-empty","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"escalated"},{"nodeId":"T-002","round":0,"state":"pending"}],"handoffs":0,"escalations":[{"escalationId":"ESC-001","reasonCode":"artifact_empty"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":556,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"存在升级","ok":true},{"name":"reason 属于产物核对","ok":true,"detail":"artifact_empty"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已升级 · 第 1 轮
节点 T-002 测试 待执行
会话 已升级
升级 ESC-001 待处理
  原因：核对失败：产出为空 calc.js
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac29-artifact-stale","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac29-artifact-stale\\demo-code-pass","scenario":"artifact-stale","resolvedScenario":"product-stale","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"escalated"},{"nodeId":"T-002","round":0,"state":"pending"}],"handoffs":0,"escalations":[{"escalationId":"ESC-001","reasonCode":"artifact_stale"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":656,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"存在升级","ok":true},{"name":"reason 属于产物核对","ok":true,"detail":"artifact_stale"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已升级 · 第 1 轮
节点 T-002 测试 待执行
会话 已升级
升级 ESC-001 待处理
  原因：核对失败：产出不是本轮新写 calc.js
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-29.state.json`）：

```json
[
  {
    "__root": "ac29-artifact-missing",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 10,
      "counters": {
        "eventSeq": 7,
        "runCount": 1,
        "dispatchCount": 1
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 0,
          "state": "pending",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-29616-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-001",
          "round": 1,
          "reasonCode": "artifact_missing",
          "reasonDetail": "核对失败：未找到声明的产出 calc.js",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac29-artifact-empty",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 10,
      "counters": {
        "eventSeq": 7,
        "runCount": 1,
        "dispatchCount": 1
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 0,
          "state": "pending",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-13628-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-001",
          "round": 1,
          "reasonCode": "artifact_empty",
          "reasonDetail": "核对失败：产出为空 calc.js",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac29-artifact-stale",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 10,
      "counters": {
        "eventSeq": 7,
        "runCount": 1,
        "dispatchCount": 1
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 0,
          "state": "pending",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-3448-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-001",
          "round": 1,
          "reasonCode": "artifact_stale",
          "reasonDetail": "核对失败：产出不是本轮新写 calc.js",
          "state": "pending",
          "defects": []
        }
      ]
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-29.events.jsonl`）：

```
ac29-artifact-missing/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-ab6a6611b2c45362","seq":1,"ts":"2026-11-05T14:00:45.989Z"}
ac29-artifact-missing/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-ab6a6611b2c45362","seq":2,"ts":"2026-11-05T14:00:45.999Z"}
ac29-artifact-missing/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ab6a6611b2c45362","seq":7,"ts":"2026-11-05T14:00:46.251Z"}
ac29-artifact-missing/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-001","round":1,"reasonCode":"artifact_missing"},"gen":"gen-ab6a6611b2c45362","seq":8,"ts":"2026-11-05T14:00:46.266Z"}
ac29-artifact-missing/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-ab6a6611b2c45362","seq":11,"ts":"2026-11-05T14:00:46.273Z"}
ac29-artifact-missing/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-ab6a6611b2c45362","seq":9,"ts":"2026-11-05T14:00:46.269Z"}
ac29-artifact-missing/INST-001 {"object":"session","objectId":"mock-sess-29616-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-ab6a6611b2c45362","seq":10,"ts":"2026-11-05T14:00:46.271Z"}
ac29-artifact-empty/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-4e974752919fbf97","seq":1,"ts":"2026-11-05T14:00:47.202Z"}
ac29-artifact-empty/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4e974752919fbf97","seq":2,"ts":"2026-11-05T14:00:47.209Z"}
ac29-artifact-empty/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4e974752919fbf97","seq":7,"ts":"2026-11-05T14:00:47.455Z"}
ac29-artifact-empty/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-001","round":1,"reasonCode":"artifact_empty"},"gen":"gen-4e974752919fbf97","seq":8,"ts":"2026-11-05T14:00:47.470Z"}
ac29-artifact-empty/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-4e974752919fbf97","seq":11,"ts":"2026-11-05T14:00:47.473Z"}
ac29-artifact-empty/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-4e974752919fbf97","seq":9,"ts":"2026-11-05T14:00:47.471Z"}
ac29-artifact-empty/INST-001 {"object":"session","objectId":"mock-sess-13628-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-4e974752919fbf97","seq":10,"ts":"2026-11-05T14:00:47.472Z"}
ac29-artifact-stale/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-31d60190c0834380","seq":1,"ts":"2026-11-05T14:00:48.338Z"}
ac29-artifact-stale/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-31d60190c0834380","seq":2,"ts":"2026-11-05T14:00:48.350Z"}
ac29-artifact-stale/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-31d60190c0834380","seq":7,"ts":"2026-11-05T14:00:48.607Z"}
ac29-artifact-stale/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-001","round":1,"reasonCode":"artifact_stale"},"gen":"gen-31d60190c0834380","seq":8,"ts":"2026-11-05T14:00:48.619Z"}
ac29-artifact-stale/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-31d60190c0834380","seq":11,"ts":"2026-11-05T14:00:48.623Z"}
ac29-artifact-stale/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-31d60190c0834380","seq":9,"ts":"2026-11-05T14:00:48.620Z"}
ac29-artifact-stale/INST-001 {"object":"session","objectId":"mock-sess-3448-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-31d60190c0834380","seq":10,"ts":"2026-11-05T14:00:48.622Z"}
```

**④ 判定**：通过（断言 12/12 通过）

- ✅ [artifact-missing] T-001 事件先 running→review 再 review→escalated
- ✅ [artifact-missing] state.json 的 state=suspended（期望 "suspended"）
- ✅ [artifact-missing] 输出含「核对失败：未找到声明的产出 」（期望包含 "核对失败：未找到声明的产出 "）
- ✅ [artifact-missing] 不存在 edge.kind=backflow 的交接包（期望 0）
- ✅ [artifact-empty] T-001 事件先 running→review 再 review→escalated
- ✅ [artifact-empty] state.json 的 state=suspended（期望 "suspended"）
- ✅ [artifact-empty] 输出含「核对失败：产出为空 」（期望包含 "核对失败：产出为空 "）
- ✅ [artifact-empty] 不存在 edge.kind=backflow 的交接包（期望 0）
- ✅ [artifact-stale] T-001 事件先 running→review 再 review→escalated
- ✅ [artifact-stale] state.json 的 state=suspended（期望 "suspended"）
- ✅ [artifact-stale] 输出含「核对失败：产出不是本轮新写 」（期望包含 "核对失败：产出不是本轮新写 "）
- ✅ [artifact-stale] 不存在 edge.kind=backflow 的交接包（期望 0）



---

#### AC-31 同一实例重复发起被拒

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-running`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-suspended`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-completed`（叙事实例号 `INST-225`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合（3 个独立项目根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario hold-forever --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-running --scenario hold-forever --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-running | exit=1 | 97ms
[driver --scenario retest-fail --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-suspended --scenario retest-fail --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-suspended | exit=1 | 86ms
[driver --scenario code-pass --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-completed --scenario code-pass --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --instance INST-001 --template code-loop --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac31-completed | exit=1 | 95ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-31.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
该实例已挂起，不能再次发起；如要重来请新建实例
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-31.state.json`）：

```json
[
  {
    "__root": "ac31-running",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "interrupted",
      "template": "code-loop",
      "halted": false,
      "rev": 11,
      "counters": {
        "eventSeq": 7,
        "runCount": 1,
        "dispatchCount": 1
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "review",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 0,
          "state": "pending",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-28544-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "waiting_dependency",
          "hostId": "mock"
        }
      ],
      "handoffs": [],
      "escalations": []
    }
  },
  {
    "__root": "ac31-suspended",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 43,
      "counters": {
        "eventSeq": 47,
        "runCount": 1,
        "dispatchCount": 4
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 2,
          "state": "escalated",
          "note": null,
          "verdict": {
            "value": "fail",
            "defectCount": 1,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:00:52.133Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-25916-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-31228-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-17752-1",
          "nodeId": "T-001",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-17988-1",
          "nodeId": "T-002",
          "round": 2,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:51.251Z",
          "deliveredAt": "2026-11-05T14:00:51.489Z",
          "acceptedAt": "2026-11-05T14:00:51.492Z",
          "consumedAt": "2026-11-05T14:00:51.534Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:51.565Z",
          "deliveredAt": "2026-11-05T14:00:51.786Z",
          "acceptedAt": "2026-11-05T14:00:51.793Z",
          "consumedAt": "2026-11-05T14:00:51.841Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T14:00:51.566Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        },
        {
          "handoffId": "HO-003",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "retest"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:51.860Z",
          "deliveredAt": "2026-11-05T14:00:52.082Z",
          "acceptedAt": "2026-11-05T14:00:52.090Z",
          "consumedAt": "2026-11-05T14:00:52.135Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 2,
          "reasonCode": "rounds_exceeded",
          "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
          "state": "pending",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            }
          ]
        }
      ]
    }
  },
  {
    "__root": "ac31-completed",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "completed",
      "template": "code-loop",
      "halted": false,
      "rev": 23,
      "counters": {
        "eventSeq": 22,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": {
            "value": "pass",
            "defectCount": 0,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:00:53.908Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-4752-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-16276-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:53.642Z",
          "deliveredAt": "2026-11-05T14:00:53.860Z",
          "acceptedAt": "2026-11-05T14:00:53.867Z",
          "consumedAt": "2026-11-05T14:00:53.914Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": []
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-31.events.jsonl`）：

```
ac31-running/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-ce23a56a958f5873","seq":1,"ts":"2026-11-05T14:00:49.596Z"}
ac31-running/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-ce23a56a958f5873","seq":2,"ts":"2026-11-05T14:00:49.608Z"}
ac31-running/INST-001 {"object":"session","objectId":"mock-sess-28544-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ce23a56a958f5873","seq":6,"ts":"2026-11-05T14:00:49.857Z"}
ac31-running/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ce23a56a958f5873","seq":7,"ts":"2026-11-05T14:00:49.866Z"}
ac31-running/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-ce23a56a958f5873","seq":8,"ts":"2026-11-05T14:00:49.880Z"}
ac31-running/INST-001 {"object":"session","objectId":"mock-sess-28544-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-ce23a56a958f5873","seq":9,"ts":"2026-11-05T14:00:49.881Z"}
ac31-running/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 review / 会话 waiting_dependency"},"gen":"gen-ce23a56a958f5873","seq":10,"ts":"2026-11-05T14:00:49.886Z"}
ac31-suspended/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-29b438dbeeacc386","seq":1,"ts":"2026-11-05T14:00:50.934Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-29b438dbeeacc386","seq":2,"ts":"2026-11-05T14:00:50.947Z"}
ac31-suspended/INST-001 {"object":"session","objectId":"mock-sess-25916-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":6,"ts":"2026-11-05T14:00:51.211Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":7,"ts":"2026-11-05T14:00:51.217Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-29b438dbeeacc386","seq":8,"ts":"2026-11-05T14:00:51.230Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-29b438dbeeacc386","seq":11,"ts":"2026-11-05T14:00:51.265Z"}
ac31-suspended/INST-001 {"object":"session","objectId":"mock-sess-31228-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":17,"ts":"2026-11-05T14:00:51.516Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":18,"ts":"2026-11-05T14:00:51.523Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-29b438dbeeacc386","seq":19,"ts":"2026-11-05T14:00:51.531Z"}
ac31-suspended/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887251534},"gen":"gen-29b438dbeeacc386","seq":20,"ts":"2026-11-05T14:00:51.535Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-29b438dbeeacc386","seq":21,"ts":"2026-11-05T14:00:51.549Z"}
ac31-suspended/INST-001 {"object":"session","objectId":"mock-sess-31228-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-29b438dbeeacc386","seq":22,"ts":"2026-11-05T14:00:51.550Z"}
ac31-suspended/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-29b438dbeeacc386","seq":24,"ts":"2026-11-05T14:00:51.572Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-29b438dbeeacc386","seq":25,"ts":"2026-11-05T14:00:51.581Z"}
ac31-suspended/INST-001 {"object":"session","objectId":"mock-sess-17752-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":31,"ts":"2026-11-05T14:00:51.819Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":32,"ts":"2026-11-05T14:00:51.825Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-29b438dbeeacc386","seq":33,"ts":"2026-11-05T14:00:51.837Z"}
ac31-suspended/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887251841},"gen":"gen-29b438dbeeacc386","seq":34,"ts":"2026-11-05T14:00:51.841Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-29b438dbeeacc386","seq":37,"ts":"2026-11-05T14:00:51.873Z"}
ac31-suspended/INST-001 {"object":"session","objectId":"mock-sess-17988-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":43,"ts":"2026-11-05T14:00:52.117Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-29b438dbeeacc386","seq":44,"ts":"2026-11-05T14:00:52.125Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-29b438dbeeacc386","seq":45,"ts":"2026-11-05T14:00:52.133Z"}
ac31-suspended/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887252135},"gen":"gen-29b438dbeeacc386","seq":46,"ts":"2026-11-05T14:00:52.135Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-29b438dbeeacc386","seq":47,"ts":"2026-11-05T14:00:52.141Z"}
ac31-suspended/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-29b438dbeeacc386","seq":48,"ts":"2026-11-05T14:00:52.147Z"}
ac31-suspended/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-29b438dbeeacc386","seq":51,"ts":"2026-11-05T14:00:52.151Z"}
ac31-suspended/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-29b438dbeeacc386","seq":49,"ts":"2026-11-05T14:00:52.148Z"}
ac31-suspended/INST-001 {"object":"session","objectId":"mock-sess-17988-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-29b438dbeeacc386","seq":50,"ts":"2026-11-05T14:00:52.150Z"}
ac31-completed/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-b7da7ebf407b6424","seq":1,"ts":"2026-11-05T14:00:53.327Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-b7da7ebf407b6424","seq":2,"ts":"2026-11-05T14:00:53.335Z"}
ac31-completed/INST-001 {"object":"session","objectId":"mock-sess-4752-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-b7da7ebf407b6424","seq":6,"ts":"2026-11-05T14:00:53.587Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-b7da7ebf407b6424","seq":7,"ts":"2026-11-05T14:00:53.602Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-b7da7ebf407b6424","seq":8,"ts":"2026-11-05T14:00:53.622Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-b7da7ebf407b6424","seq":11,"ts":"2026-11-05T14:00:53.653Z"}
ac31-completed/INST-001 {"object":"session","objectId":"mock-sess-16276-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-b7da7ebf407b6424","seq":17,"ts":"2026-11-05T14:00:53.891Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-b7da7ebf407b6424","seq":18,"ts":"2026-11-05T14:00:53.898Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-b7da7ebf407b6424","seq":19,"ts":"2026-11-05T14:00:53.908Z"}
ac31-completed/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-b7da7ebf407b6424","seq":20,"ts":"2026-11-05T14:00:53.913Z"}
ac31-completed/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887253914},"gen":"gen-b7da7ebf407b6424","seq":21,"ts":"2026-11-05T14:00:53.914Z"}
ac31-completed/INST-001 {"object":"session","objectId":"mock-sess-16276-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-b7da7ebf407b6424","seq":22,"ts":"2026-11-05T14:00:53.919Z"}
ac31-completed/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-b7da7ebf407b6424","seq":23,"ts":"2026-11-05T14:00:53.939Z"}
```

**④ 判定**：通过（断言 14/14 通过）

- ✅ [Given1] hold-forever 让 INST-001 正在执行，核心在跑
- ✅ [Given1] 输出含「该实例正在执行，本次未发起」（期望包含 "该实例正在执行，本次未发起"）
- ✅ [Given1] 退出码 1（期望 1）
- ✅ [Given1] 机检：sessions.length 没有增加（期望 0）
- ✅ [Given1] 机检：原实例 nodes[0].round 没有变化（期望 1）
- ✅ [Given2] retest-fail --keep 让 INST-001 已挂起，核心在跑
- ✅ [Given2] 输出含「该实例已挂起，不能再次发起；如要重来请新建实例」（期望包含 "该实例已挂起，不能再次发起；如要重来请新建实例"）
- ✅ [Given2] 退出码 1（期望 1）
- ✅ [Given2] 机检：sessions.length 没有增加（期望 4）
- ✅ [Given2] 机检：state 仍是 'suspended'（期望 "suspended"）
- ✅ [Given3] code-pass --keep 让 INST-001 已完成，核心在跑
- ✅ [Given3] 输出含「实例已结束（已完成），本迭代不支持重跑」（期望包含 "实例已结束（已完成），本迭代不支持重跑"）
- ✅ [Given3] 退出码 1（期望 1）
- ✅ [Given3] 机检：sessions.length 没有增加（期望 2）



---

#### AC-32 同一实例的同一节点被二次投递时被拒

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac32`（叙事实例号 `INST-226`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario hold-test --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac32 --scenario hold-test --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[seam dispatchToNode T-002] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\call-seam.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac32 --instance INST-001 --call dispatchToNode --node T-002   | cwd=D:\WWW\Maestro | exit=1 | 112ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-32.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":false,"code":"NODE_BUSY","detail":{}}
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-32.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 20,
  "counters": {
    "eventSeq": 19,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "escalated",
      "note": null,
      "verdict": null,
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-31588-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-17576-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "accepted",
      "createdAt": "2026-11-05T14:00:55.616Z",
      "deliveredAt": "2026-11-05T14:00:56.066Z",
      "acceptedAt": "2026-11-05T14:00:56.071Z",
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 1,
      "reasonCode": "verdict_missing",
      "reasonDetail": "核对失败：未找到判定文件 out/verdict.json",
      "state": "pending",
      "defects": []
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-32.events.jsonl`）：

```
ac32/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":1,"ts":"2026-11-05T14:00:55.290Z"}
ac32/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-0c9dc59ba261eec1","seq":2,"ts":"2026-11-05T14:00:55.299Z"}
ac32/INST-001 {"object":"session","objectId":"mock-sess-31588-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":6,"ts":"2026-11-05T14:00:55.570Z"}
ac32/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":7,"ts":"2026-11-05T14:00:55.582Z"}
ac32/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":8,"ts":"2026-11-05T14:00:55.596Z"}
ac32/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-0c9dc59ba261eec1","seq":11,"ts":"2026-11-05T14:00:55.628Z"}
ac32/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":18,"ts":"2026-11-05T14:00:56.112Z"}
ac32/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":1,"reasonCode":"verdict_missing"},"gen":"gen-0c9dc59ba261eec1","seq":20,"ts":"2026-11-05T14:00:56.126Z"}
ac32/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":23,"ts":"2026-11-05T14:00:56.133Z"}
ac32/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.invalid","detail":{"reasonCode":"verdict_missing","stage":"missing","message":"核对失败：未找到判定文件 out/verdict.json"},"gen":"gen-0c9dc59ba261eec1","seq":19,"ts":"2026-11-05T14:00:56.119Z"}
ac32/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":21,"ts":"2026-11-05T14:00:56.127Z"}
ac32/INST-001 {"object":"session","objectId":"mock-sess-17576-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-0c9dc59ba261eec1","seq":22,"ts":"2026-11-05T14:00:56.130Z"}
```

**④ 判定**：通过（断言 5/5 通过）

- ✅ hold-test --keep 让 T-002 处于执行中，核心在跑
- ✅ stdout 含 "ok":false（期望包含 "\"ok\":false"）
- ✅ stdout 含 "code":"NODE_BUSY"（期望包含 "\"code\":\"NODE_BUSY\""）
- ✅ 机检：sessions.length 没有变化（期望 1）
- ✅ 机检：nodes[1].round 没有变化（期望 1）



---

#### AC-33 派发时会话建不起来（三个样本）

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-first`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-backflow`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-retest`（叙事实例号 `INST-227`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合（3 个独立项目根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario dispatch-fail-first] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-first --scenario dispatch-fail-first   | cwd=D:\WWW\Maestro | exit=0 | 810ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-first | exit=0 | 224ms
[driver --scenario dispatch-fail-backflow] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-backflow --scenario dispatch-fail-backflow   | cwd=D:\WWW\Maestro | exit=0 | 1486ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-backflow | exit=0 | 274ms
[driver --scenario dispatch-fail-retest] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-retest --scenario dispatch-fail-retest   | cwd=D:\WWW\Maestro | exit=0 | 1798ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac33-retest | exit=0 | 219ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-33.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac33-first","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac33-first\\demo-code-pass","scenario":"dispatch-fail-first","resolvedScenario":"dispatch-fail","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":1,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"escalated"},{"nodeId":"T-002","round":0,"state":"pending"}],"handoffs":0,"escalations":[{"escalationId":"ESC-001","reasonCode":"dispatch_failed"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":445,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=dispatch_failed","ok":true,"detail":"dispatch_failed"}]}
实例 ? · 运行中 · 模板 编码闭环
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已升级 · 第 1 轮
节点 T-002 测试 待执行
升级 ESC-001 待处理
  原因：派遣失败：目标会话不可用
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac33-backflow","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac33-backflow\\demo-code-pass","scenario":"dispatch-fail-backflow","resolvedScenario":"dispatch-fail-backflow","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"escalated"},{"nodeId":"T-002","round":1,"state":"failed"}],"handoffs":2,"escalations":[{"escalationId":"ESC-001","reasonCode":"dispatch_failed"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1096,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=dispatch_failed","ok":true,"detail":"dispatch_failed"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-001 开发 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已升级 · 第 2 轮
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:00:58
交接包 HO-001  开发→测试  已投递   22:00:58
交接包 HO-001  开发→测试  已接受   22:00:58
交接包 HO-001  开发→测试  已完成   22:00:58
交接包 HO-002  测试→开发（回流）  已构造   22:00:58
升级 ESC-001 待处理
  原因：派遣失败：目标会话不可用
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac33-retest","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac33-retest\\demo-code-pass","scenario":"dispatch-fail-retest","resolvedScenario":"dispatch-fail-retest","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"dispatch_failed"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1431,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=dispatch_failed","ok":true,"detail":"dispatch_failed"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:01:00
交接包 HO-001  开发→测试  已投递   22:01:00
交接包 HO-001  开发→测试  已接受   22:01:00
交接包 HO-001  开发→测试  已完成   22:01:00
交接包 HO-002  测试→开发（回流）  已构造   22:01:00
交接包 HO-002  测试→开发（回流）  已投递   22:01:00
交接包 HO-002  测试→开发（回流）  已接受   22:01:00
交接包 HO-002  测试→开发（回流）  已完成   22:01:00
交接包 HO-003  开发→测试（复测）  已构造   22:01:00
升级 ESC-001 待处理
  原因：派遣失败：目标会话不可用
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-33.state.json`）：

```json
[
  {
    "__root": "ac33-first",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 4,
      "counters": {
        "eventSeq": 2,
        "runCount": 1,
        "dispatchCount": 1
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 0,
          "state": "pending",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [],
      "handoffs": [],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-001",
          "round": 1,
          "reasonCode": "dispatch_failed",
          "reasonDetail": "派遣失败：目标会话不可用",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac33-backflow",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 25,
      "counters": {
        "eventSeq": 25,
        "runCount": 1,
        "dispatchCount": 3
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "failed",
          "note": "等待复测",
          "verdict": {
            "value": "fail",
            "defectCount": 2,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:00:58.795Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-6384-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-33944-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:00:58.504Z",
          "deliveredAt": "2026-11-05T14:00:58.732Z",
          "acceptedAt": "2026-11-05T14:00:58.737Z",
          "consumedAt": "2026-11-05T14:00:58.799Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "created",
          "createdAt": "2026-11-05T14:00:58.832Z",
          "deliveredAt": null,
          "acceptedAt": null,
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T14:00:58.832Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-001",
          "round": 2,
          "reasonCode": "dispatch_failed",
          "reasonDetail": "派遣失败：目标会话不可用",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "ac33-retest",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 36,
      "counters": {
        "eventSeq": 37,
        "runCount": 1,
        "dispatchCount": 4
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 2,
          "state": "escalated",
          "note": null,
          "verdict": {
            "value": "fail",
            "defectCount": 2,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:01:00.573Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-20596-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-9192-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-20568-1",
          "nodeId": "T-001",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:01:00.294Z",
          "deliveredAt": "2026-11-05T14:01:00.524Z",
          "acceptedAt": "2026-11-05T14:01:00.528Z",
          "consumedAt": "2026-11-05T14:01:00.575Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:01:00.603Z",
          "deliveredAt": "2026-11-05T14:01:00.834Z",
          "acceptedAt": "2026-11-05T14:01:00.840Z",
          "consumedAt": "2026-11-05T14:01:00.887Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T14:01:00.603Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        },
        {
          "handoffId": "HO-003",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "retest"
          },
          "state": "created",
          "createdAt": "2026-11-05T14:01:00.909Z",
          "deliveredAt": null,
          "acceptedAt": null,
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 2,
          "reasonCode": "dispatch_failed",
          "reasonDetail": "派遣失败：目标会话不可用",
          "state": "pending",
          "defects": []
        }
      ]
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-33.events.jsonl`）：

```
ac33-first/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-6ea3c3be9d68e91b","seq":1,"ts":"2026-11-05T14:00:57.146Z"}
ac33-first/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-6ea3c3be9d68e91b","seq":2,"ts":"2026-11-05T14:00:57.152Z"}
ac33-first/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-001","round":1,"reasonCode":"dispatch_failed"},"gen":"gen-6ea3c3be9d68e91b","seq":3,"ts":"2026-11-05T14:00:57.338Z"}
ac33-first/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-6ea3c3be9d68e91b","seq":5,"ts":"2026-11-05T14:00:57.341Z"}
ac33-first/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-6ea3c3be9d68e91b","seq":4,"ts":"2026-11-05T14:00:57.340Z"}
ac33-backflow/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-7f4b00d62826fc55","seq":1,"ts":"2026-11-05T14:00:58.208Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-7f4b00d62826fc55","seq":2,"ts":"2026-11-05T14:00:58.215Z"}
ac33-backflow/INST-001 {"object":"session","objectId":"mock-sess-6384-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7f4b00d62826fc55","seq":6,"ts":"2026-11-05T14:00:58.466Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7f4b00d62826fc55","seq":7,"ts":"2026-11-05T14:00:58.473Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-7f4b00d62826fc55","seq":8,"ts":"2026-11-05T14:00:58.485Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-7f4b00d62826fc55","seq":11,"ts":"2026-11-05T14:00:58.523Z"}
ac33-backflow/INST-001 {"object":"session","objectId":"mock-sess-33944-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7f4b00d62826fc55","seq":17,"ts":"2026-11-05T14:00:58.780Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7f4b00d62826fc55","seq":18,"ts":"2026-11-05T14:00:58.788Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-7f4b00d62826fc55","seq":19,"ts":"2026-11-05T14:00:58.796Z"}
ac33-backflow/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887258799},"gen":"gen-7f4b00d62826fc55","seq":20,"ts":"2026-11-05T14:00:58.799Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-7f4b00d62826fc55","seq":21,"ts":"2026-11-05T14:00:58.814Z"}
ac33-backflow/INST-001 {"object":"session","objectId":"mock-sess-33944-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-7f4b00d62826fc55","seq":22,"ts":"2026-11-05T14:00:58.816Z"}
ac33-backflow/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-7f4b00d62826fc55","seq":24,"ts":"2026-11-05T14:00:58.843Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-7f4b00d62826fc55","seq":25,"ts":"2026-11-05T14:00:58.851Z"}
ac33-backflow/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-001","round":2,"reasonCode":"dispatch_failed"},"gen":"gen-7f4b00d62826fc55","seq":26,"ts":"2026-11-05T14:00:59.035Z"}
ac33-backflow/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-7f4b00d62826fc55","seq":29,"ts":"2026-11-05T14:00:59.040Z"}
ac33-backflow/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-7f4b00d62826fc55","seq":27,"ts":"2026-11-05T14:00:59.037Z"}
ac33-backflow/INST-001 {"object":"session","objectId":"mock-sess-6384-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-7f4b00d62826fc55","seq":28,"ts":"2026-11-05T14:00:59.038Z"}
ac33-retest/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-4b48b22537efb50d","seq":1,"ts":"2026-11-05T14:00:59.980Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4b48b22537efb50d","seq":2,"ts":"2026-11-05T14:00:59.987Z"}
ac33-retest/INST-001 {"object":"session","objectId":"mock-sess-20596-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4b48b22537efb50d","seq":6,"ts":"2026-11-05T14:01:00.250Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4b48b22537efb50d","seq":7,"ts":"2026-11-05T14:01:00.260Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4b48b22537efb50d","seq":8,"ts":"2026-11-05T14:01:00.276Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4b48b22537efb50d","seq":11,"ts":"2026-11-05T14:01:00.307Z"}
ac33-retest/INST-001 {"object":"session","objectId":"mock-sess-9192-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4b48b22537efb50d","seq":17,"ts":"2026-11-05T14:01:00.555Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4b48b22537efb50d","seq":18,"ts":"2026-11-05T14:01:00.561Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-4b48b22537efb50d","seq":19,"ts":"2026-11-05T14:01:00.573Z"}
ac33-retest/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887260575},"gen":"gen-4b48b22537efb50d","seq":20,"ts":"2026-11-05T14:01:00.575Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-4b48b22537efb50d","seq":21,"ts":"2026-11-05T14:01:00.585Z"}
ac33-retest/INST-001 {"object":"session","objectId":"mock-sess-9192-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-4b48b22537efb50d","seq":22,"ts":"2026-11-05T14:01:00.586Z"}
ac33-retest/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-4b48b22537efb50d","seq":24,"ts":"2026-11-05T14:01:00.611Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4b48b22537efb50d","seq":25,"ts":"2026-11-05T14:01:00.617Z"}
ac33-retest/INST-001 {"object":"session","objectId":"mock-sess-20568-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4b48b22537efb50d","seq":31,"ts":"2026-11-05T14:01:00.866Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4b48b22537efb50d","seq":32,"ts":"2026-11-05T14:01:00.873Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4b48b22537efb50d","seq":33,"ts":"2026-11-05T14:01:00.886Z"}
ac33-retest/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887260887},"gen":"gen-4b48b22537efb50d","seq":34,"ts":"2026-11-05T14:01:00.887Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4b48b22537efb50d","seq":37,"ts":"2026-11-05T14:01:00.919Z"}
ac33-retest/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"dispatch_failed"},"gen":"gen-4b48b22537efb50d","seq":38,"ts":"2026-11-05T14:01:01.102Z"}
ac33-retest/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-4b48b22537efb50d","seq":41,"ts":"2026-11-05T14:01:01.105Z"}
ac33-retest/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-4b48b22537efb50d","seq":39,"ts":"2026-11-05T14:01:01.103Z"}
ac33-retest/INST-001 {"object":"session","objectId":"mock-sess-9192-1","from":"idle","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-4b48b22537efb50d","seq":40,"ts":"2026-11-05T14:01:01.104Z"}
```

**④ 判定**：通过（断言 22/22 通过）

- ✅ [first] nodes[0].state=escalated（期望 "escalated"）
- ✅ [first] nodes[0].round=1（期望 1）
- ✅ [first] escalations[0].reasonCode=dispatch_failed（期望 "dispatch_failed"）
- ✅ [first] state=suspended（期望 "suspended"）
- ✅ [first] 输出含「节点 T-001 开发 已升级 · 第 1 轮」（期望包含 "节点 T-001 开发 已升级 · 第 1 轮"）
- ✅ [first] 输出含「原因：派遣失败：目标会话不可用」（期望包含 "原因：派遣失败：目标会话不可用"）
- ✅ [first] 输出含「节点：T-001 开发 · 第 1 轮」（期望包含 "节点：T-001 开发 · 第 1 轮"）
- ✅ [first] nodes[0] 在 round=1 只有 1 条 reason=node.dispatch（不重试）（期望 1）
- ✅ [backflow] nodes[0].state=escalated（期望 "escalated"）
- ✅ [backflow] nodes[0].round=2（期望 2）
- ✅ [backflow] nodes[1].state=failed（期望 "failed"）
- ✅ [backflow] nodes[1].round=1（期望 1）
- ✅ [backflow] 输出含「节点 T-001 开发 已升级 · 第 2 轮」（期望包含 "节点 T-001 开发 已升级 · 第 2 轮"）
- ✅ [backflow] 输出含「原因：派遣失败：目标会话不可用」（期望包含 "原因：派遣失败：目标会话不可用"）
- ✅ [backflow] nodes[0] 在 round=2 只有 1 条 reason=node.dispatch（期望 1）
- ✅ [retest] nodes[1].state=escalated（期望 "escalated"）
- ✅ [retest] nodes[1].round=2（期望 2）
- ✅ [retest] nodes[0].state=done（期望 "done"）
- ✅ [retest] nodes[0].round=2（期望 2）
- ✅ [retest] 输出含「节点 T-002 测试 已升级 · 第 2 轮」（期望包含 "节点 T-002 测试 已升级 · 第 2 轮"）
- ✅ [retest] 输出含「原因：派遣失败：目标会话不可用」（期望包含 "原因：派遣失败：目标会话不可用"）
- ✅ [retest] nodes[1] 在 round=2 只有 1 条 reason=node.dispatch（期望 1）



---

#### AC-34 已接受与已完成是两个不同时刻

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac34`（叙事实例号 `INST-228`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（核心侧暂停点 after_accepted:T-002） ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_TEST_PAUSE=after_accepted:T-002`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario code-pass --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac34 --scenario code-pass --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac34 | exit=0 | 130ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-34.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 执行中 · 第 1 轮
会话 执行中 · 已运行 1s
交接包 HO-001  开发→测试  已构造   22:01:02
交接包 HO-001  开发→测试  已投递   22:01:02
交接包 HO-001  开发→测试  已接受   22:01:02
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-34.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 23,
  "counters": {
    "eventSeq": 22,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:01:02.843Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-5984-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-30136-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:01:02.364Z",
      "deliveredAt": "2026-11-05T14:01:02.592Z",
      "acceptedAt": "2026-11-05T14:01:02.597Z",
      "consumedAt": "2026-11-05T14:01:02.852Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-34.events.jsonl`）：

```
ac34/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-4aea5ae44de136f2","seq":1,"ts":"2026-11-05T14:01:02.081Z"}
ac34/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4aea5ae44de136f2","seq":2,"ts":"2026-11-05T14:01:02.087Z"}
ac34/INST-001 {"object":"session","objectId":"mock-sess-5984-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4aea5ae44de136f2","seq":6,"ts":"2026-11-05T14:01:02.324Z"}
ac34/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4aea5ae44de136f2","seq":7,"ts":"2026-11-05T14:01:02.332Z"}
ac34/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4aea5ae44de136f2","seq":8,"ts":"2026-11-05T14:01:02.346Z"}
ac34/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4aea5ae44de136f2","seq":11,"ts":"2026-11-05T14:01:02.374Z"}
ac34/INST-001 {"object":"session","objectId":"mock-sess-30136-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4aea5ae44de136f2","seq":17,"ts":"2026-11-05T14:01:02.827Z"}
ac34/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4aea5ae44de136f2","seq":18,"ts":"2026-11-05T14:01:02.836Z"}
ac34/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-4aea5ae44de136f2","seq":19,"ts":"2026-11-05T14:01:02.843Z"}
ac34/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4aea5ae44de136f2","seq":20,"ts":"2026-11-05T14:01:02.851Z"}
ac34/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887262852},"gen":"gen-4aea5ae44de136f2","seq":21,"ts":"2026-11-05T14:01:02.853Z"}
ac34/INST-001 {"object":"session","objectId":"mock-sess-30136-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-4aea5ae44de136f2","seq":22,"ts":"2026-11-05T14:01:02.858Z"}
ac34/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-4aea5ae44de136f2","seq":23,"ts":"2026-11-05T14:01:02.884Z"}
```

**④ 判定**：通过（断言 8/8 通过）

- ✅ 核心在 T-002 会话被接受后停住（.mock/paused 存在）
- ✅ 输出含「交接包 HO-001  开发→测试  已接受」（期望包含 "交接包 HO-001  开发→测试  已接受"）
- ✅ 输出含「节点 T-002 测试 执行中 · 第 1 轮」（期望包含 "节点 T-002 测试 执行中 · 第 1 轮"）
- ✅ 输出不含「交接包 HO-001  开发→测试  已完成」（期望不含 "交接包 HO-001  开发→测试  已完成"）
- ✅ 写 .mock/release 放行后场景结束
- ✅ 机检：HO-001 的 state='consumed'（期望 "consumed"）
- ✅ 机检：HO-001 的 consumedAt 晚于 acceptedAt
- ✅ 机检：consumed 对应事件 seq 大于 T-002 进入 review 的 seq



---

#### AC-35 运行中核心消失 → 已中断

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac35`（叙事实例号 `INST-229`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-hold --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac35 --scenario backflow-hold --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[taskkill /PID 14392 /F] taskkill /PID 14392 /F   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac35 | exit=0 | 269ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac35 | exit=0 | 214ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-35.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 空闲
节点 T-001 开发 执行中 · 第 2 轮
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:01:04
交接包 HO-001  开发→测试  已投递   22:01:04
交接包 HO-001  开发→测试  已接受   22:01:04
交接包 HO-001  开发→测试  已完成   22:01:04
交接包 HO-002  测试→开发（回流）  已构造   22:01:04
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-35.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 25,
  "counters": {
    "eventSeq": 25,
    "runCount": 1,
    "dispatchCount": 3
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "running",
      "note": "stopped at node running / session idle",
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "failed",
      "note": "等待复测",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T14:01:04.756Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-28152-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-25392-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T14:01:04.485Z",
      "deliveredAt": "2026-11-05T14:01:04.709Z",
      "acceptedAt": "2026-11-05T14:01:04.714Z",
      "consumedAt": "2026-11-05T14:01:04.758Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "created",
      "createdAt": "2026-11-05T14:01:04.787Z",
      "deliveredAt": null,
      "acceptedAt": null,
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T14:01:04.787Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-35.events.jsonl`）：

```
ac35/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-91ea4b9287ed5656","seq":1,"ts":"2026-11-05T14:01:04.187Z"}
ac35/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-91ea4b9287ed5656","seq":2,"ts":"2026-11-05T14:01:04.196Z"}
ac35/INST-001 {"object":"session","objectId":"mock-sess-28152-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-91ea4b9287ed5656","seq":6,"ts":"2026-11-05T14:01:04.449Z"}
ac35/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-91ea4b9287ed5656","seq":7,"ts":"2026-11-05T14:01:04.455Z"}
ac35/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-91ea4b9287ed5656","seq":8,"ts":"2026-11-05T14:01:04.467Z"}
ac35/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-91ea4b9287ed5656","seq":11,"ts":"2026-11-05T14:01:04.497Z"}
ac35/INST-001 {"object":"session","objectId":"mock-sess-25392-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-91ea4b9287ed5656","seq":17,"ts":"2026-11-05T14:01:04.743Z"}
ac35/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-91ea4b9287ed5656","seq":18,"ts":"2026-11-05T14:01:04.749Z"}
ac35/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-91ea4b9287ed5656","seq":19,"ts":"2026-11-05T14:01:04.756Z"}
ac35/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887264758},"gen":"gen-91ea4b9287ed5656","seq":20,"ts":"2026-11-05T14:01:04.758Z"}
ac35/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-91ea4b9287ed5656","seq":21,"ts":"2026-11-05T14:01:04.771Z"}
ac35/INST-001 {"object":"session","objectId":"mock-sess-25392-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-91ea4b9287ed5656","seq":22,"ts":"2026-11-05T14:01:04.773Z"}
ac35/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-91ea4b9287ed5656","seq":24,"ts":"2026-11-05T14:01:04.796Z"}
ac35/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-91ea4b9287ed5656","seq":25,"ts":"2026-11-05T14:01:04.806Z"}
ac35/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.gone","detail":{"note":"停在节点 running / 会话 idle"},"gen":"gen-efbc86b62650f2de","seq":26,"ts":"2026-11-05T14:01:05.440Z"}
ac35/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-91ea4b9287ed5656","seq":23,"ts":"2026-11-05T14:01:04.794Z"}
```

**④ 判定**：通过（断言 6/6 通过）

- ✅ backflow-hold --keep 推进到「开发第 2 轮执行中」，核心在跑（.orch/core.json 存在）
- ✅ 取到 .orch/core.json 的进程号
- ✅ 第一行含「已中断」（期望包含 "已中断"）
- ✅ 输出含「第 2 轮」，没有被重置为第 1 轮（期望包含 "第 2 轮"）
- ✅ 机检：不存在「实例状态为 interrupted 但有节点被重新派发」的记录（events 无新 node.dispatch）（期望 3）
- ✅ taskkill 成功（退出码 0 或进程已消失）



---

#### AC-36 已挂起、已升级、失败三者在同一实例的三个时刻

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-a`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-b`（叙事实例号 `INST-230`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（核心侧 after_verdict + 2 个独立根） ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_TEST_PAUSE=after_verdict`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-twice --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-a --scenario backflow-twice --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-a | exit=0 | 90ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-a | exit=0 | 106ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-a | exit=0 | 89ms
[driver --scenario backflow-twice --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-b --scenario backflow-twice --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac36-b | exit=0 | 96ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-36.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:01:06
交接包 HO-001  开发→测试  已投递   22:01:07
交接包 HO-001  开发→测试  已接受   22:01:07
交接包 HO-001  开发→测试  已完成   22:01:07
交接包 HO-002  测试→开发（回流）  已构造   22:01:07
会话 空闲
会话 空闲
会话 空闲
会话 空闲
节点 T-001 开发 已完成
节点 T-002 测试 已取消
交接包 HO-001 已完成
交接包 HO-002 已完成
交接包 HO-003 已完成
升级 ESC-001 已作废
实例 INST-001 · 已取消 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已取消 · 第 2 轮 · 耗时 1s · 判定 不通过 · 缺陷 1 条
会话 空闲
交接包 HO-001  开发→测试  已构造   22:01:06
交接包 HO-001  开发→测试  已投递   22:01:07
交接包 HO-001  开发→测试  已接受   22:01:07
交接包 HO-001  开发→测试  已完成   22:01:07
交接包 HO-002  测试→开发（回流）  已构造   22:01:07
交接包 HO-002  测试→开发（回流）  已投递   22:01:07
交接包 HO-002  测试→开发（回流）  已接受   22:01:07
交接包 HO-002  测试→开发（回流）  已完成   22:01:07
交接包 HO-003  开发→测试（复测）  已构造   22:01:07
交接包 HO-003  开发→测试（复测）  已投递   22:01:07
交接包 HO-003  开发→测试（复测）  已接受   22:01:07
交接包 HO-003  开发→测试（复测）  已完成   22:01:08
升级 ESC-001 已作废
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
会话 空闲
会话 空闲
节点 T-001 开发 已完成
节点 T-002 测试 已取消
交接包 HO-001 已完成
交接包 HO-002 已拒绝（已撤回）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-36.state.json`）：

```json
[
  {
    "__root": "ac36-a",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "cancelled",
      "template": "code-loop",
      "halted": false,
      "rev": 44,
      "counters": {
        "eventSeq": 51,
        "runCount": 1,
        "dispatchCount": 4
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 2,
          "state": "cancelled",
          "note": null,
          "verdict": {
            "value": "fail",
            "defectCount": 1,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:01:08.017Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-21936-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-12772-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-31736-1",
          "nodeId": "T-001",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-16260-1",
          "nodeId": "T-002",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:01:06.910Z",
          "deliveredAt": "2026-11-05T14:01:07.135Z",
          "acceptedAt": "2026-11-05T14:01:07.138Z",
          "consumedAt": "2026-11-05T14:01:07.183Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:01:07.219Z",
          "deliveredAt": "2026-11-05T14:01:07.664Z",
          "acceptedAt": "2026-11-05T14:01:07.672Z",
          "consumedAt": "2026-11-05T14:01:07.716Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T14:01:07.219Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        },
        {
          "handoffId": "HO-003",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "retest"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:01:07.733Z",
          "deliveredAt": "2026-11-05T14:01:07.956Z",
          "acceptedAt": "2026-11-05T14:01:07.964Z",
          "consumedAt": "2026-11-05T14:01:08.019Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 2,
          "reasonCode": "rounds_exceeded",
          "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
          "state": "voided",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            }
          ]
        }
      ]
    }
  },
  {
    "__root": "ac36-b",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "cancelled",
      "template": "code-loop",
      "halted": false,
      "rev": 24,
      "counters": {
        "eventSeq": 24,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "cancelled",
          "note": "等待复测",
          "verdict": {
            "value": "fail",
            "defectCount": 2,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T14:01:09.989Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-34544-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-6804-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T14:01:09.708Z",
          "deliveredAt": "2026-11-05T14:01:09.934Z",
          "acceptedAt": "2026-11-05T14:01:09.941Z",
          "consumedAt": "2026-11-05T14:01:09.990Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "rejected",
          "createdAt": "2026-11-05T14:01:10.017Z",
          "deliveredAt": null,
          "acceptedAt": null,
          "consumedAt": null,
          "rejectedAt": "2026-11-05T14:01:10.186Z",
          "rejectReason": "withdrawn",
          "wakeConsumedAt": "2026-11-05T14:01:10.017Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        }
      ],
      "escalations": []
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-36.events.jsonl`）：

```
ac36-a/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-be03ba3ae914b164","seq":1,"ts":"2026-11-05T14:01:06.621Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-be03ba3ae914b164","seq":2,"ts":"2026-11-05T14:01:06.627Z"}
ac36-a/INST-001 {"object":"session","objectId":"mock-sess-21936-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":6,"ts":"2026-11-05T14:01:06.873Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":7,"ts":"2026-11-05T14:01:06.879Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-be03ba3ae914b164","seq":8,"ts":"2026-11-05T14:01:06.891Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-be03ba3ae914b164","seq":11,"ts":"2026-11-05T14:01:06.921Z"}
ac36-a/INST-001 {"object":"session","objectId":"mock-sess-12772-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":17,"ts":"2026-11-05T14:01:07.167Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":18,"ts":"2026-11-05T14:01:07.175Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-be03ba3ae914b164","seq":19,"ts":"2026-11-05T14:01:07.182Z"}
ac36-a/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887267183},"gen":"gen-be03ba3ae914b164","seq":20,"ts":"2026-11-05T14:01:07.183Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-be03ba3ae914b164","seq":21,"ts":"2026-11-05T14:01:07.197Z"}
ac36-a/INST-001 {"object":"session","objectId":"mock-sess-12772-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-be03ba3ae914b164","seq":22,"ts":"2026-11-05T14:01:07.199Z"}
ac36-a/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-be03ba3ae914b164","seq":24,"ts":"2026-11-05T14:01:07.225Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-be03ba3ae914b164","seq":25,"ts":"2026-11-05T14:01:07.451Z"}
ac36-a/INST-001 {"object":"session","objectId":"mock-sess-31736-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":31,"ts":"2026-11-05T14:01:07.697Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":32,"ts":"2026-11-05T14:01:07.703Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-be03ba3ae914b164","seq":33,"ts":"2026-11-05T14:01:07.715Z"}
ac36-a/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887267716},"gen":"gen-be03ba3ae914b164","seq":34,"ts":"2026-11-05T14:01:07.716Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-be03ba3ae914b164","seq":37,"ts":"2026-11-05T14:01:07.743Z"}
ac36-a/INST-001 {"object":"session","objectId":"mock-sess-16260-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":43,"ts":"2026-11-05T14:01:08.004Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-be03ba3ae914b164","seq":44,"ts":"2026-11-05T14:01:08.011Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-be03ba3ae914b164","seq":45,"ts":"2026-11-05T14:01:08.018Z"}
ac36-a/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887268019},"gen":"gen-be03ba3ae914b164","seq":46,"ts":"2026-11-05T14:01:08.019Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-be03ba3ae914b164","seq":47,"ts":"2026-11-05T14:01:08.025Z"}
ac36-a/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-be03ba3ae914b164","seq":48,"ts":"2026-11-05T14:01:08.037Z"}
ac36-a/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-be03ba3ae914b164","seq":51,"ts":"2026-11-05T14:01:08.041Z"}
ac36-a/INST-001 {"object":"escalation","objectId":"ESC-001","from":"pending","to":"voided","result":"applied","reason":"escalation.voided","detail":{"escalationId":"ESC-001"},"gen":"gen-be03ba3ae914b164","seq":54,"ts":"2026-11-05T14:01:08.155Z"}
ac36-a/INST-001 {"object":"session","objectId":"mock-sess-16260-1","from":"escalated","to":"idle","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-be03ba3ae914b164","seq":52,"ts":"2026-11-05T14:01:08.153Z"}
ac36-a/INST-001 {"object":"node","objectId":"T-002","from":"escalated","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-be03ba3ae914b164","seq":53,"ts":"2026-11-05T14:01:08.154Z"}
ac36-a/INST-001 {"object":"instance","objectId":"INST-001","from":"suspended","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-be03ba3ae914b164","seq":55,"ts":"2026-11-05T14:01:08.156Z"}
ac36-b/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":1,"ts":"2026-11-05T14:01:09.397Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-9ad372e967a6c0a8","seq":2,"ts":"2026-11-05T14:01:09.409Z"}
ac36-b/INST-001 {"object":"session","objectId":"mock-sess-34544-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":6,"ts":"2026-11-05T14:01:09.668Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":7,"ts":"2026-11-05T14:01:09.678Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":8,"ts":"2026-11-05T14:01:09.690Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-9ad372e967a6c0a8","seq":11,"ts":"2026-11-05T14:01:09.722Z"}
ac36-b/INST-001 {"object":"session","objectId":"mock-sess-6804-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":17,"ts":"2026-11-05T14:01:09.976Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":18,"ts":"2026-11-05T14:01:09.982Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-9ad372e967a6c0a8","seq":19,"ts":"2026-11-05T14:01:09.989Z"}
ac36-b/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793887269990},"gen":"gen-9ad372e967a6c0a8","seq":20,"ts":"2026-11-05T14:01:09.991Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-9ad372e967a6c0a8","seq":21,"ts":"2026-11-05T14:01:10.004Z"}
ac36-b/INST-001 {"object":"session","objectId":"mock-sess-6804-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":22,"ts":"2026-11-05T14:01:10.005Z"}
ac36-b/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-9ad372e967a6c0a8","seq":24,"ts":"2026-11-05T14:01:10.023Z"}
ac36-b/INST-001 {"object":"handoff","objectId":"HO-002","from":"created","to":"rejected","result":"applied","reason":"handoff.rejected","detail":{"reason":"withdrawn"},"gen":"gen-9ad372e967a6c0a8","seq":26,"ts":"2026-11-05T14:01:10.191Z"}
ac36-b/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":23,"ts":"2026-11-05T14:01:10.022Z"}
ac36-b/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":25,"ts":"2026-11-05T14:01:10.190Z"}
ac36-b/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-9ad372e967a6c0a8","seq":27,"ts":"2026-11-05T14:01:10.193Z"}
```

**④ 判定**：通过（断言 19/19 通过）

- ✅ [时刻1] after_verdict 停在第 1 次判定不通过，核心在跑
- ✅ [时刻1] 机检：state='running'（期望 "running"）
- ✅ [时刻1] 机检：nodes[1].state='failed'（期望 "failed"）
- ✅ [时刻1] 机检：nodes[1].round=1（期望 1）
- ✅ [时刻1] 机检：escalations.length=0（期望 0）
- ✅ [时刻1] 输出含「节点 T-002 测试 失败（等待复测） · 第 1 轮」（期望包含 "节点 T-002 测试 失败（等待复测） · 第 1 轮"）
- ✅ [时刻2] 写 release 后场景继续跑完到第 2 次仍不通过
- ✅ [时刻2] 机检：state='suspended'（期望 "suspended"）
- ✅ [时刻2] 机检：nodes[1].state='escalated'（期望 "escalated"）
- ✅ [时刻2] 机检：round=2（期望 2）
- ✅ [时刻2] 机检：escalations.length=1（期望 1）
- ✅ [时刻3] 机检：state='cancelled'（期望 "cancelled"）
- ✅ [时刻3] 机检：nodes[1].state='cancelled'（期望 "cancelled"）
- ✅ [时刻3] 机检：escalations[0].state='voided'（期望 "voided"）
- ✅ [段B] 独立根重跑，停在「第 1 次判定不通过、测试 failed、复测尚未派发」
- ✅ [段B] 机检：nodes[1].state='failed'（原状态）（期望 "failed"）
- ✅ [段B] 机检：state='cancelled'（期望 "cancelled"）
- ✅ [段B] 机检：nodes[1].state='cancelled'（原 'failed'）（期望 "cancelled"）
- ✅ [段B] 机检：nodes[1].round=1（期望 1）



---

#### AC-37 取消优先：判定已读到、回流未投递

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac37`（叙事实例号 `INST-231`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（核心侧 after_verdict） ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_TEST_PAUSE=after_verdict`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac37 --scenario backflow-once --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac37 | exit=0 | 116ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-37.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
会话 空闲
会话 空闲
节点 T-001 开发 已完成
节点 T-002 测试 已取消
交接包 HO-001 已完成
交接包 HO-002 已拒绝（已撤回）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-37.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "cancelled",
  "template": "code-loop",
  "halted": false,
  "rev": 24,
  "counters": {
    "eventSeq": 24,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "cancelled",
      "note": "等待复测",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:16:50.283Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-31016-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-5488-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:50.017Z",
      "deliveredAt": "2026-11-05T13:16:50.234Z",
      "acceptedAt": "2026-11-05T13:16:50.241Z",
      "consumedAt": "2026-11-05T13:16:50.284Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "rejected",
      "createdAt": "2026-11-05T13:16:50.308Z",
      "deliveredAt": null,
      "acceptedAt": null,
      "consumedAt": null,
      "rejectedAt": "2026-11-05T13:16:50.474Z",
      "rejectReason": "withdrawn",
      "wakeConsumedAt": "2026-11-05T13:16:50.308Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-37.events.jsonl`）：

```
ac37/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-7e377f7dc0c55552","seq":1,"ts":"2026-11-05T13:16:49.694Z"}
ac37/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-7e377f7dc0c55552","seq":2,"ts":"2026-11-05T13:16:49.701Z"}
ac37/INST-001 {"object":"session","objectId":"mock-sess-31016-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7e377f7dc0c55552","seq":6,"ts":"2026-11-05T13:16:49.979Z"}
ac37/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7e377f7dc0c55552","seq":7,"ts":"2026-11-05T13:16:49.986Z"}
ac37/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-7e377f7dc0c55552","seq":8,"ts":"2026-11-05T13:16:50.000Z"}
ac37/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-7e377f7dc0c55552","seq":11,"ts":"2026-11-05T13:16:50.030Z"}
ac37/INST-001 {"object":"session","objectId":"mock-sess-5488-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7e377f7dc0c55552","seq":17,"ts":"2026-11-05T13:16:50.268Z"}
ac37/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7e377f7dc0c55552","seq":18,"ts":"2026-11-05T13:16:50.276Z"}
ac37/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-7e377f7dc0c55552","seq":19,"ts":"2026-11-05T13:16:50.283Z"}
ac37/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884610284},"gen":"gen-7e377f7dc0c55552","seq":20,"ts":"2026-11-05T13:16:50.284Z"}
ac37/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-7e377f7dc0c55552","seq":21,"ts":"2026-11-05T13:16:50.296Z"}
ac37/INST-001 {"object":"session","objectId":"mock-sess-5488-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-7e377f7dc0c55552","seq":22,"ts":"2026-11-05T13:16:50.297Z"}
ac37/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-7e377f7dc0c55552","seq":24,"ts":"2026-11-05T13:16:50.316Z"}
ac37/INST-001 {"object":"handoff","objectId":"HO-002","from":"created","to":"rejected","result":"applied","reason":"handoff.rejected","detail":{"reason":"withdrawn"},"gen":"gen-7e377f7dc0c55552","seq":26,"ts":"2026-11-05T13:16:50.481Z"}
ac37/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-7e377f7dc0c55552","seq":23,"ts":"2026-11-05T13:16:50.315Z"}
ac37/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-7e377f7dc0c55552","seq":25,"ts":"2026-11-05T13:16:50.480Z"}
ac37/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-7e377f7dc0c55552","seq":27,"ts":"2026-11-05T13:16:50.482Z"}
```

**④ 判定**：通过（断言 6/6 通过）

- ✅ test -f .mock/paused：核心停在「读完判定、回流包已构造但未投递」
- ✅ 暂停中 backflow 包已构造（created）
- ✅ 机检：backflow 交接包 state='rejected'（期望 "rejected"）
- ✅ 机检：backflow 交接包 rejectReason='withdrawn'（期望 "withdrawn"）
- ✅ 机检：nodes[0].state=done 且 nodes[0].round=1（开发没有被拉起）（期望 "done/1"）
- ✅ 机检：events.jsonl 有一条 reason='handoff.rejected' 且 detail.reason='withdrawn'



---

#### AC-38 状态写不进去时不假装挂起

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac38`（叙事实例号 `INST-232`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（--prepare-only + MAESTRO_FAULT 冷启动） ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_FAULT=state_write:escalation`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail --prepare-only] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac38 --scenario retest-fail --prepare-only   | cwd=D:\WWW\Maestro | exit=0 | 85ms
[夹具：核心已停（全新根，未执行任何会拉起核心的命令）] "(fixture) 核心已停（全新根，未执行任何会拉起核心的命令）"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
[orch run --cwd ./demo-code-pass --template code-loop --host mock --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --template code-loop --host mock --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac38 | exit=5 | 1454ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac38 | exit=0 | 191ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac38 | exit=0 | 215ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-38.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"prepareOnly":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac38","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac38\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","cursorPath":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac38\\.mock\\cursor.json","hostPath":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac38\\.orch\\hosts\\mock.json","cursor":{"next":1},"host":{"id":"mock","transport":"stdio","launch":{"command":"C:\\Users\\xuesh\\.workbuddy\\binaries\\node\\versions\\22.22.2-6\\node.exe","args":["D:\\WWW\\Maestro\\test\\fixtures\\mock-acp-agent.js","--root","C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac38","--scenario","retest-fail"]}}}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
实例 INST-001 · 运行中 · 已停止推进 · 模板 编码闭环
节点 T-002 测试 待校验（升级未记录） · 第 2 轮 · 判定 不通过 · 缺陷 1 条
实例 INST-001 · 已中断 ｜ 停在节点 已完成 / 会话 等待下游
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 待校验（升级未记录） · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 等待下游
交接包 HO-001  开发→测试  已构造   21:16:53
交接包 HO-001  开发→测试  已投递   21:16:53
交接包 HO-001  开发→测试  已接受   21:16:53
交接包 HO-001  开发→测试  已完成   21:16:53
交接包 HO-002  测试→开发（回流）  已构造   21:16:53
交接包 HO-002  测试→开发（回流）  已投递   21:16:53
交接包 HO-002  测试→开发（回流）  已接受   21:16:53
交接包 HO-002  测试→开发（回流）  已完成   21:16:54
交接包 HO-003  开发→测试（复测）  已构造   21:16:54
交接包 HO-003  开发→测试（复测）  已投递   21:16:54
交接包 HO-003  开发→测试（复测）  已接受   21:16:54
交接包 HO-003  开发→测试（复测）  已完成   21:16:54
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-38.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": true,
  "rev": 44,
  "counters": {
    "eventSeq": 48,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "review",
      "note": "stopped at node review / session waiting_dependency",
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:16:54.307Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-21660-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-11512-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-17976-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-32592-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "waiting_dependency",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:53.406Z",
      "deliveredAt": "2026-11-05T13:16:53.624Z",
      "acceptedAt": "2026-11-05T13:16:53.629Z",
      "consumedAt": "2026-11-05T13:16:53.700Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:53.737Z",
      "deliveredAt": "2026-11-05T13:16:53.968Z",
      "acceptedAt": "2026-11-05T13:16:53.972Z",
      "consumedAt": "2026-11-05T13:16:54.025Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:16:53.738Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:54.048Z",
      "deliveredAt": "2026-11-05T13:16:54.267Z",
      "acceptedAt": "2026-11-05T13:16:54.274Z",
      "consumedAt": "2026-11-05T13:16:54.309Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-38.events.jsonl`）：

```
ac38/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-0b6c801e153dda52","seq":1,"ts":"2026-11-05T13:16:53.098Z"}
ac38/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-0b6c801e153dda52","seq":2,"ts":"2026-11-05T13:16:53.106Z"}
ac38/INST-001 {"object":"session","objectId":"mock-sess-21660-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":6,"ts":"2026-11-05T13:16:53.373Z"}
ac38/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":7,"ts":"2026-11-05T13:16:53.380Z"}
ac38/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-0b6c801e153dda52","seq":8,"ts":"2026-11-05T13:16:53.392Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-0b6c801e153dda52","seq":11,"ts":"2026-11-05T13:16:53.416Z"}
ac38/INST-001 {"object":"session","objectId":"mock-sess-11512-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":17,"ts":"2026-11-05T13:16:53.673Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":18,"ts":"2026-11-05T13:16:53.683Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-0b6c801e153dda52","seq":19,"ts":"2026-11-05T13:16:53.698Z"}
ac38/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884613700},"gen":"gen-0b6c801e153dda52","seq":20,"ts":"2026-11-05T13:16:53.701Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-0b6c801e153dda52","seq":21,"ts":"2026-11-05T13:16:53.719Z"}
ac38/INST-001 {"object":"session","objectId":"mock-sess-11512-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-0b6c801e153dda52","seq":22,"ts":"2026-11-05T13:16:53.721Z"}
ac38/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-0b6c801e153dda52","seq":24,"ts":"2026-11-05T13:16:53.744Z"}
ac38/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-0b6c801e153dda52","seq":25,"ts":"2026-11-05T13:16:53.751Z"}
ac38/INST-001 {"object":"session","objectId":"mock-sess-17976-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":31,"ts":"2026-11-05T13:16:54.004Z"}
ac38/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":32,"ts":"2026-11-05T13:16:54.011Z"}
ac38/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-0b6c801e153dda52","seq":33,"ts":"2026-11-05T13:16:54.023Z"}
ac38/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884614025},"gen":"gen-0b6c801e153dda52","seq":34,"ts":"2026-11-05T13:16:54.025Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-0b6c801e153dda52","seq":37,"ts":"2026-11-05T13:16:54.061Z"}
ac38/INST-001 {"object":"session","objectId":"mock-sess-32592-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":43,"ts":"2026-11-05T13:16:54.296Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-0b6c801e153dda52","seq":44,"ts":"2026-11-05T13:16:54.301Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-0b6c801e153dda52","seq":45,"ts":"2026-11-05T13:16:54.308Z"}
ac38/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884614309},"gen":"gen-0b6c801e153dda52","seq":46,"ts":"2026-11-05T13:16:54.309Z"}
ac38/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-0b6c801e153dda52","seq":47,"ts":"2026-11-05T13:16:54.315Z"}
ac38/INST-001 {"object":"instance","objectId":"INST-001","from":null,"to":null,"result":"applied","reason":"run.halted","detail":{"halted":true,"cause":"state_write:escalation","at":"2026-11-05T13:16:54.323Z"},"gen":"gen-0b6c801e153dda52","seq":48,"ts":"2026-11-05T13:16:54.323Z"}
ac38/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 review / 会话 waiting_dependency"},"gen":"gen-0b6c801e153dda52","seq":49,"ts":"2026-11-05T13:16:54.463Z"}
```

**④ 判定**：通过（断言 14/14 通过）

- ✅ 命令在 10 秒内返回
- ✅ 退出码是 5（期望 5）
- ✅ 输出含「无法记录升级：」（期望包含 "无法记录升级："）
- ✅ 输出含「；已停止推进」（期望包含 "；已停止推进"）
- ✅ 输出含「运行中 · 已停止推进」（期望包含 "运行中 · 已停止推进"）
- ✅ 输出不含「已挂起」（期望不含 "已挂起"）
- ✅ 输出含「节点 T-002 测试 待校验（升级未记录） · 第 2 轮」（期望包含 "节点 T-002 测试 待校验（升级未记录） · 第 2 轮"）
- ✅ 最后一行含「下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消」（期望包含 "下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消"）
- ✅ 全部输出不含以「交接包 HO-」开头的行（期望 0）
- ✅ 机检：state='running'（期望 "running"）
- ✅ 机检：halted=true（期望 true）
- ✅ 机检：escalations 为空（期望 0）
- ✅ 机检：nodes[1].state='review'（不是 failed 也不是 escalated）（期望 "review"）
- ✅ 第一行含「已中断」（期望包含 "已中断"）



---

#### AC-39 升级时目标会话显示为已升级

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac39`（叙事实例号 `INST-233`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac39 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1915ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac39 | exit=0 | 247ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-39.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac39","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac39\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1536,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:16:55
交接包 HO-001  开发→测试  已投递   21:16:55
交接包 HO-001  开发→测试  已接受   21:16:55
交接包 HO-001  开发→测试  已完成   21:16:55
交接包 HO-002  测试→开发（回流）  已构造   21:16:55
交接包 HO-002  测试→开发（回流）  已投递   21:16:56
交接包 HO-002  测试→开发（回流）  已接受   21:16:56
交接包 HO-002  测试→开发（回流）  已完成   21:16:56
交接包 HO-003  开发→测试（复测）  已构造   21:16:56
交接包 HO-003  开发→测试（复测）  已投递   21:16:56
交接包 HO-003  开发→测试（复测）  已接受   21:16:56
交接包 HO-003  开发→测试（复测）  已完成   21:16:56
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-39.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:16:56.365Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-30780-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33548-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-20992-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-8572-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:55.450Z",
      "deliveredAt": "2026-11-05T13:16:55.671Z",
      "acceptedAt": "2026-11-05T13:16:55.679Z",
      "consumedAt": "2026-11-05T13:16:55.750Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:55.783Z",
      "deliveredAt": "2026-11-05T13:16:56.013Z",
      "acceptedAt": "2026-11-05T13:16:56.017Z",
      "consumedAt": "2026-11-05T13:16:56.074Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:16:55.783Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:56.096Z",
      "deliveredAt": "2026-11-05T13:16:56.323Z",
      "acceptedAt": "2026-11-05T13:16:56.330Z",
      "consumedAt": "2026-11-05T13:16:56.367Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-39.events.jsonl`）：

```
ac39/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-293af4ff3aa241f0","seq":1,"ts":"2026-11-05T13:16:55.161Z"}
ac39/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-293af4ff3aa241f0","seq":2,"ts":"2026-11-05T13:16:55.169Z"}
ac39/INST-001 {"object":"session","objectId":"mock-sess-30780-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":6,"ts":"2026-11-05T13:16:55.414Z"}
ac39/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":7,"ts":"2026-11-05T13:16:55.421Z"}
ac39/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-293af4ff3aa241f0","seq":8,"ts":"2026-11-05T13:16:55.433Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-293af4ff3aa241f0","seq":11,"ts":"2026-11-05T13:16:55.463Z"}
ac39/INST-001 {"object":"session","objectId":"mock-sess-33548-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":17,"ts":"2026-11-05T13:16:55.729Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":18,"ts":"2026-11-05T13:16:55.741Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-293af4ff3aa241f0","seq":19,"ts":"2026-11-05T13:16:55.748Z"}
ac39/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884615750},"gen":"gen-293af4ff3aa241f0","seq":20,"ts":"2026-11-05T13:16:55.750Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-293af4ff3aa241f0","seq":21,"ts":"2026-11-05T13:16:55.766Z"}
ac39/INST-001 {"object":"session","objectId":"mock-sess-33548-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-293af4ff3aa241f0","seq":22,"ts":"2026-11-05T13:16:55.768Z"}
ac39/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-293af4ff3aa241f0","seq":24,"ts":"2026-11-05T13:16:55.790Z"}
ac39/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-293af4ff3aa241f0","seq":25,"ts":"2026-11-05T13:16:55.799Z"}
ac39/INST-001 {"object":"session","objectId":"mock-sess-20992-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":31,"ts":"2026-11-05T13:16:56.050Z"}
ac39/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":32,"ts":"2026-11-05T13:16:56.060Z"}
ac39/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-293af4ff3aa241f0","seq":33,"ts":"2026-11-05T13:16:56.073Z"}
ac39/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884616074},"gen":"gen-293af4ff3aa241f0","seq":34,"ts":"2026-11-05T13:16:56.074Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-293af4ff3aa241f0","seq":37,"ts":"2026-11-05T13:16:56.107Z"}
ac39/INST-001 {"object":"session","objectId":"mock-sess-8572-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":43,"ts":"2026-11-05T13:16:56.352Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-293af4ff3aa241f0","seq":44,"ts":"2026-11-05T13:16:56.359Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-293af4ff3aa241f0","seq":45,"ts":"2026-11-05T13:16:56.366Z"}
ac39/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884616367},"gen":"gen-293af4ff3aa241f0","seq":46,"ts":"2026-11-05T13:16:56.367Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-293af4ff3aa241f0","seq":47,"ts":"2026-11-05T13:16:56.373Z"}
ac39/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-293af4ff3aa241f0","seq":48,"ts":"2026-11-05T13:16:56.381Z"}
ac39/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-293af4ff3aa241f0","seq":51,"ts":"2026-11-05T13:16:56.385Z"}
ac39/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-293af4ff3aa241f0","seq":49,"ts":"2026-11-05T13:16:56.382Z"}
ac39/INST-001 {"object":"session","objectId":"mock-sess-8572-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-293af4ff3aa241f0","seq":50,"ts":"2026-11-05T13:16:56.383Z"}
```

**④ 判定**：通过（断言 4/4 通过）

- ✅ 输出含「节点 T-002 测试 已升级」（期望包含 "节点 T-002 测试 已升级"）
- ✅ 输出含独立行「会话 已升级」（期望包含 "会话 已升级"）
- ✅ 输出里没有「会话 执行中」（期望不含 "会话 执行中"）
- ✅ 机检：sessions 里 nodeId='T-002' 且 round=2 的那条 state='escalated'（期望 "escalated"）



---

#### AC-40 同一目录不能同时跑两个闭环

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac40`（叙事实例号 `INST-234`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：混合

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac40 --scenario retest-fail --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch run --cwd ./demo-code-pass --template code-loop --task 给 calc.js 补一个 div 函数，让 node --test 全绿。
改动写在 calc.js
产物：calc.js] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js run --cwd ./demo-code-pass --template code-loop --task "给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js"   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac40 | exit=1 | 110ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-40.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
该目录已有未结束的实例 INST-001，本次未发起
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-40.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:16:58.627Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-29452-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-29520-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-19120-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-32176-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:57.721Z",
      "deliveredAt": "2026-11-05T13:16:57.942Z",
      "acceptedAt": "2026-11-05T13:16:57.945Z",
      "consumedAt": "2026-11-05T13:16:58.001Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:58.032Z",
      "deliveredAt": "2026-11-05T13:16:58.256Z",
      "acceptedAt": "2026-11-05T13:16:58.262Z",
      "consumedAt": "2026-11-05T13:16:58.334Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:16:58.032Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:16:58.354Z",
      "deliveredAt": "2026-11-05T13:16:58.584Z",
      "acceptedAt": "2026-11-05T13:16:58.590Z",
      "consumedAt": "2026-11-05T13:16:58.629Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-40.events.jsonl`）：

```
ac40/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":1,"ts":"2026-11-05T13:16:57.444Z"}
ac40/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-fcd116ea7f59cc50","seq":2,"ts":"2026-11-05T13:16:57.450Z"}
ac40/INST-001 {"object":"session","objectId":"mock-sess-29452-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":6,"ts":"2026-11-05T13:16:57.687Z"}
ac40/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":7,"ts":"2026-11-05T13:16:57.694Z"}
ac40/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":8,"ts":"2026-11-05T13:16:57.706Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-fcd116ea7f59cc50","seq":11,"ts":"2026-11-05T13:16:57.731Z"}
ac40/INST-001 {"object":"session","objectId":"mock-sess-29520-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":17,"ts":"2026-11-05T13:16:57.977Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":18,"ts":"2026-11-05T13:16:57.987Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-fcd116ea7f59cc50","seq":19,"ts":"2026-11-05T13:16:58.000Z"}
ac40/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884618001},"gen":"gen-fcd116ea7f59cc50","seq":20,"ts":"2026-11-05T13:16:58.002Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-fcd116ea7f59cc50","seq":21,"ts":"2026-11-05T13:16:58.016Z"}
ac40/INST-001 {"object":"session","objectId":"mock-sess-29520-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":22,"ts":"2026-11-05T13:16:58.017Z"}
ac40/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-fcd116ea7f59cc50","seq":24,"ts":"2026-11-05T13:16:58.038Z"}
ac40/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-fcd116ea7f59cc50","seq":25,"ts":"2026-11-05T13:16:58.044Z"}
ac40/INST-001 {"object":"session","objectId":"mock-sess-19120-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":31,"ts":"2026-11-05T13:16:58.311Z"}
ac40/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":32,"ts":"2026-11-05T13:16:58.321Z"}
ac40/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":33,"ts":"2026-11-05T13:16:58.333Z"}
ac40/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884618334},"gen":"gen-fcd116ea7f59cc50","seq":34,"ts":"2026-11-05T13:16:58.334Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-fcd116ea7f59cc50","seq":37,"ts":"2026-11-05T13:16:58.368Z"}
ac40/INST-001 {"object":"session","objectId":"mock-sess-32176-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":43,"ts":"2026-11-05T13:16:58.614Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":44,"ts":"2026-11-05T13:16:58.621Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-fcd116ea7f59cc50","seq":45,"ts":"2026-11-05T13:16:58.628Z"}
ac40/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884618629},"gen":"gen-fcd116ea7f59cc50","seq":46,"ts":"2026-11-05T13:16:58.629Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-fcd116ea7f59cc50","seq":47,"ts":"2026-11-05T13:16:58.635Z"}
ac40/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-fcd116ea7f59cc50","seq":48,"ts":"2026-11-05T13:16:58.643Z"}
ac40/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":51,"ts":"2026-11-05T13:16:58.649Z"}
ac40/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":49,"ts":"2026-11-05T13:16:58.645Z"}
ac40/INST-001 {"object":"session","objectId":"mock-sess-32176-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-fcd116ea7f59cc50","seq":50,"ts":"2026-11-05T13:16:58.646Z"}
```

**④ 判定**：通过（断言 5/5 通过）

- ✅ retest-fail --keep 让 INST-001 处于「已挂起」，绑定目录 demo-code-pass，核心在跑
- ✅ 输出含「该目录已有未结束的实例 INST-001，本次未发起」（期望包含 "该目录已有未结束的实例 INST-001，本次未发起"）
- ✅ 退出码 1（期望 1）
- ✅ `ls .orch/instances | wc -l` 与执行前相同（期望 1）
- ✅ 机检：INST-001 的 state 仍是 'suspended'（新闭环不会解除挂起）（期望 "suspended"）



---

#### AC-41 每条边每次派发一张交接包，编号连续

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac41`（叙事实例号 `INST-235`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac41 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1934ms
[orch status --instance INST-001 --events] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001 --events   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac41 | exit=0 | 225ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-41.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac41","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac41\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1548,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
实例 INST-001 · 已挂起 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已升级 · 第 2 轮 · 判定 不通过 · 缺陷 1 条
会话 已升级
交接包 HO-001  开发→测试  已构造   21:17:00
交接包 HO-001  开发→测试  已投递   21:17:00
交接包 HO-001  开发→测试  已接受   21:17:00
交接包 HO-001  开发→测试  已完成   21:17:00
交接包 HO-002  测试→开发（回流）  已构造   21:17:00
交接包 HO-002  测试→开发（回流）  已投递   21:17:00
交接包 HO-002  测试→开发（回流）  已接受   21:17:00
交接包 HO-002  测试→开发（回流）  已完成   21:17:00
交接包 HO-003  开发→测试（复测）  已构造   21:17:00
交接包 HO-003  开发→测试（复测）  已投递   21:17:01
交接包 HO-003  开发→测试（复测）  已接受   21:17:01
交接包 HO-003  开发→测试（复测）  已完成   21:17:01
升级 ESC-001 待处理
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
[#1] 21:16:59  实例 INST-001  已创建 → 运行中  原因 开始运行
[#2] 21:16:59  节点 T-001  派发 → 执行中  原因 派发 · 第 1 轮
[#3] 21:17:00  会话 mock-sess-31820-1  空闲 → 执行中  原因 会话状态
[#4] 21:17:00  会话 mock-sess-31820-1  执行中 → 执行中（tool_call）  原因 会话状态
[#5] 21:17:00  会话 mock-sess-31820-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#6] 21:17:00  会话 mock-sess-31820-1  执行中 → 等待下游  原因 产出已提交
[#7] 21:17:00  节点 T-001  执行中 → 待校验  原因 产出已提交
[#8] 21:17:00  节点 T-001  待校验 → 已完成  原因 核对通过
[#9] 21:17:00  会话 mock-sess-31820-1  等待下游 → 空闲  原因 运行完成
[#10] 21:17:00  交接包 HO-001  已构造  原因 构造交接
[#11] 21:17:00  节点 T-002  派发 → 执行中  原因 派发 · 第 1 轮
[#12] 21:17:00  交接包 HO-001  已构造 → 已投递  原因 交接已投递
[#13] 21:17:00  会话 mock-sess-19264-1  空闲 → 执行中  原因 会话状态
[#14] 21:17:00  交接包 HO-001  已投递 → 已接受  原因 首个事件
[#15] 21:17:00  会话 mock-sess-19264-1  执行中 → 执行中（tool_call）  原因 会话状态
[#16] 21:17:00  会话 mock-sess-19264-1  执行中 → 执行中（agent_message_chunk）  原因 会话状态
[#17] 21:17:00  会话 mock-sess-19264-1  执行中 → 等待下游  原因 产出已提交
[#18] 21:17:00  节点 T-002  执行中 → 待校验  原因 产出已提交
[#19] 21:17:00  节点 T-002  verdict.read  原因 读取判定
[#20] 21:17:00  交接包 HO-001  已接受 → 已完成  原因 产出核对通过
[#21] 21:17:00  节点 T-002  待校验 → 失败  原因 核对失败
[#22] 21:17:00  会话 mock-sess-19264-1  等待下游 → 空闲  原因 核对失败
[#23] 21:17:00  交接包 HO-002  已构造  原因 构造交接
[#24] 21:17:00  交接包 HO-002  backflow.constructed  原因 构造回流
      缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
      缺陷 2：div 在整除场景存在浮点误差（证据 out/test-log-2.txt）
      复测要求：按上方每条缺陷修正后重新提交产物
[#25] 21:17:00  节点 T-001  派发 → 执行中  原因 派发 · 第 2 轮
[#26] 21:17:00  交接包 HO-002  已构造 → 已投递  原因 交接已投递
[#27] 21:17:00  会话 mock-sess-9472-1  空闲 → 执行中  原因 会话状态
[#28] 21:17:00  交接包 HO-002  已投递 → 已接受  原因 首个事件
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-41.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "halted": false,
  "rev": 43,
  "counters": {
    "eventSeq": 47,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:01.133Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-31820-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-19264-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-9472-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-24276-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "escalated",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:00.250Z",
      "deliveredAt": "2026-11-05T13:17:00.475Z",
      "acceptedAt": "2026-11-05T13:17:00.478Z",
      "consumedAt": "2026-11-05T13:17:00.527Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:00.560Z",
      "deliveredAt": "2026-11-05T13:17:00.786Z",
      "acceptedAt": "2026-11-05T13:17:00.790Z",
      "consumedAt": "2026-11-05T13:17:00.834Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:17:00.560Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:00.852Z",
      "deliveredAt": "2026-11-05T13:17:01.082Z",
      "acceptedAt": "2026-11-05T13:17:01.090Z",
      "consumedAt": "2026-11-05T13:17:01.136Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "pending",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-41.events.jsonl`）：

```
ac41/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-7791b5e08e71d511","seq":1,"ts":"2026-11-05T13:16:59.959Z"}
ac41/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-7791b5e08e71d511","seq":2,"ts":"2026-11-05T13:16:59.965Z"}
ac41/INST-001 {"object":"session","objectId":"mock-sess-31820-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":6,"ts":"2026-11-05T13:17:00.212Z"}
ac41/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":7,"ts":"2026-11-05T13:17:00.219Z"}
ac41/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-7791b5e08e71d511","seq":8,"ts":"2026-11-05T13:17:00.235Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-7791b5e08e71d511","seq":11,"ts":"2026-11-05T13:17:00.261Z"}
ac41/INST-001 {"object":"session","objectId":"mock-sess-19264-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":17,"ts":"2026-11-05T13:17:00.508Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":18,"ts":"2026-11-05T13:17:00.517Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-7791b5e08e71d511","seq":19,"ts":"2026-11-05T13:17:00.525Z"}
ac41/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884620527},"gen":"gen-7791b5e08e71d511","seq":20,"ts":"2026-11-05T13:17:00.527Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-7791b5e08e71d511","seq":21,"ts":"2026-11-05T13:17:00.543Z"}
ac41/INST-001 {"object":"session","objectId":"mock-sess-19264-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-7791b5e08e71d511","seq":22,"ts":"2026-11-05T13:17:00.545Z"}
ac41/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-7791b5e08e71d511","seq":24,"ts":"2026-11-05T13:17:00.568Z"}
ac41/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-7791b5e08e71d511","seq":25,"ts":"2026-11-05T13:17:00.577Z"}
ac41/INST-001 {"object":"session","objectId":"mock-sess-9472-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":31,"ts":"2026-11-05T13:17:00.815Z"}
ac41/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":32,"ts":"2026-11-05T13:17:00.821Z"}
ac41/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-7791b5e08e71d511","seq":33,"ts":"2026-11-05T13:17:00.833Z"}
ac41/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884620834},"gen":"gen-7791b5e08e71d511","seq":34,"ts":"2026-11-05T13:17:00.834Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-7791b5e08e71d511","seq":37,"ts":"2026-11-05T13:17:00.865Z"}
ac41/INST-001 {"object":"session","objectId":"mock-sess-24276-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":43,"ts":"2026-11-05T13:17:01.118Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-7791b5e08e71d511","seq":44,"ts":"2026-11-05T13:17:01.125Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-7791b5e08e71d511","seq":45,"ts":"2026-11-05T13:17:01.133Z"}
ac41/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884621136},"gen":"gen-7791b5e08e71d511","seq":46,"ts":"2026-11-05T13:17:01.137Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-7791b5e08e71d511","seq":47,"ts":"2026-11-05T13:17:01.145Z"}
ac41/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-7791b5e08e71d511","seq":48,"ts":"2026-11-05T13:17:01.162Z"}
ac41/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-7791b5e08e71d511","seq":51,"ts":"2026-11-05T13:17:01.167Z"}
ac41/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-7791b5e08e71d511","seq":49,"ts":"2026-11-05T13:17:01.164Z"}
ac41/INST-001 {"object":"session","objectId":"mock-sess-24276-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-7791b5e08e71d511","seq":50,"ts":"2026-11-05T13:17:01.165Z"}
```

**④ 判定**：通过（断言 6/6 通过）

- ✅ 机检：handoffs 恰好 3 条（期望 3）
- ✅ 机检：handoffId 依次 HO-001、HO-002、HO-003（无重复、无跳号）（期望 "HO-001,HO-002,HO-003"）
- ✅ 机检：edge.kind 依次 forward、backflow、retest（期望 "forward,backflow,retest"）
- ✅ 机检：三条的 createdAt 都非空
- ✅ 机检：三条的 state 都是 'consumed'（期望 "consumed,consumed,consumed"）
- ✅ orch status --events 里 [#序号] 严格递增、不跳号



---

#### AC-42 取消能把「失败」和「已升级」的节点也收掉

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac42`（叙事实例号 `INST-236`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac42 --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1945ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac42 | exit=0 | 222ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac42 | exit=0 | 87ms
[orch cancel --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js cancel --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac42 | exit=1 | 82ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-42.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac42","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac42\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1540,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
会话 空闲
会话 空闲
会话 空闲
会话 空闲
节点 T-001 开发 已完成
节点 T-002 测试 已取消
交接包 HO-001 已完成
交接包 HO-002 已完成
交接包 HO-003 已完成
升级 ESC-001 已作废
实例 INST-001 · 已取消 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已取消 · 第 2 轮 · 耗时 1s · 判定 不通过 · 缺陷 1 条
会话 空闲
交接包 HO-001  开发→测试  已构造   21:17:02
交接包 HO-001  开发→测试  已投递   21:17:02
交接包 HO-001  开发→测试  已接受   21:17:02
交接包 HO-001  开发→测试  已完成   21:17:02
交接包 HO-002  测试→开发（回流）  已构造   21:17:02
交接包 HO-002  测试→开发（回流）  已投递   21:17:03
交接包 HO-002  测试→开发（回流）  已接受   21:17:03
交接包 HO-002  测试→开发（回流）  已完成   21:17:03
交接包 HO-003  开发→测试（复测）  已构造   21:17:03
交接包 HO-003  开发→测试（复测）  已投递   21:17:03
交接包 HO-003  开发→测试（复测）  已接受   21:17:03
交接包 HO-003  开发→测试（复测）  已完成   21:17:03
升级 ESC-001 已作废
  原因：回流超上限：测试已派发 2 次仍未通过
  缺陷：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）
实例已结束（已取消），无需取消
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-42.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "cancelled",
  "template": "code-loop",
  "halted": false,
  "rev": 44,
  "counters": {
    "eventSeq": 51,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "cancelled",
      "note": null,
      "verdict": {
        "value": "fail",
        "defectCount": 1,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:03.372Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-3588-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-12060-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-28848-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-13912-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:02.480Z",
      "deliveredAt": "2026-11-05T13:17:02.704Z",
      "acceptedAt": "2026-11-05T13:17:02.709Z",
      "consumedAt": "2026-11-05T13:17:02.762Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:02.802Z",
      "deliveredAt": "2026-11-05T13:17:03.032Z",
      "acceptedAt": "2026-11-05T13:17:03.035Z",
      "consumedAt": "2026-11-05T13:17:03.077Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:17:02.803Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:03.103Z",
      "deliveredAt": "2026-11-05T13:17:03.328Z",
      "acceptedAt": "2026-11-05T13:17:03.335Z",
      "consumedAt": "2026-11-05T13:17:03.374Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": [
    {
      "escalationId": "ESC-001",
      "nodeId": "T-002",
      "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "state": "voided",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        }
      ]
    }
  ]
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-42.events.jsonl`）：

```
ac42/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":1,"ts":"2026-11-05T13:17:02.176Z"}
ac42/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4f21ec53c98e0c21","seq":2,"ts":"2026-11-05T13:17:02.182Z"}
ac42/INST-001 {"object":"session","objectId":"mock-sess-3588-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":6,"ts":"2026-11-05T13:17:02.445Z"}
ac42/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":7,"ts":"2026-11-05T13:17:02.452Z"}
ac42/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":8,"ts":"2026-11-05T13:17:02.466Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4f21ec53c98e0c21","seq":11,"ts":"2026-11-05T13:17:02.490Z"}
ac42/INST-001 {"object":"session","objectId":"mock-sess-12060-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":17,"ts":"2026-11-05T13:17:02.740Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":18,"ts":"2026-11-05T13:17:02.748Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-4f21ec53c98e0c21","seq":19,"ts":"2026-11-05T13:17:02.760Z"}
ac42/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884622762},"gen":"gen-4f21ec53c98e0c21","seq":20,"ts":"2026-11-05T13:17:02.762Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-4f21ec53c98e0c21","seq":21,"ts":"2026-11-05T13:17:02.777Z"}
ac42/INST-001 {"object":"session","objectId":"mock-sess-12060-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":22,"ts":"2026-11-05T13:17:02.780Z"}
ac42/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-4f21ec53c98e0c21","seq":24,"ts":"2026-11-05T13:17:02.811Z"}
ac42/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-4f21ec53c98e0c21","seq":25,"ts":"2026-11-05T13:17:02.821Z"}
ac42/INST-001 {"object":"session","objectId":"mock-sess-28848-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":31,"ts":"2026-11-05T13:17:03.057Z"}
ac42/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":32,"ts":"2026-11-05T13:17:03.064Z"}
ac42/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":33,"ts":"2026-11-05T13:17:03.076Z"}
ac42/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884623077},"gen":"gen-4f21ec53c98e0c21","seq":34,"ts":"2026-11-05T13:17:03.077Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-4f21ec53c98e0c21","seq":37,"ts":"2026-11-05T13:17:03.114Z"}
ac42/INST-001 {"object":"session","objectId":"mock-sess-13912-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":43,"ts":"2026-11-05T13:17:03.358Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":44,"ts":"2026-11-05T13:17:03.366Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-4f21ec53c98e0c21","seq":45,"ts":"2026-11-05T13:17:03.373Z"}
ac42/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884623374},"gen":"gen-4f21ec53c98e0c21","seq":46,"ts":"2026-11-05T13:17:03.374Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-4f21ec53c98e0c21","seq":47,"ts":"2026-11-05T13:17:03.382Z"}
ac42/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-4f21ec53c98e0c21","seq":48,"ts":"2026-11-05T13:17:03.394Z"}
ac42/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-4f21ec53c98e0c21","seq":51,"ts":"2026-11-05T13:17:03.400Z"}
ac42/INST-001 {"object":"escalation","objectId":"ESC-001","from":"pending","to":"voided","result":"applied","reason":"escalation.voided","detail":{"escalationId":"ESC-001"},"gen":"gen-9d75e6c32fdcd5ad","seq":54,"ts":"2026-11-05T13:17:03.901Z"}
ac42/INST-001 {"object":"session","objectId":"mock-sess-13912-1","from":"escalated","to":"idle","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-9d75e6c32fdcd5ad","seq":52,"ts":"2026-11-05T13:17:03.898Z"}
ac42/INST-001 {"object":"node","objectId":"T-002","from":"escalated","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-9d75e6c32fdcd5ad","seq":53,"ts":"2026-11-05T13:17:03.900Z"}
ac42/INST-001 {"object":"instance","objectId":"INST-001","from":"suspended","to":"cancelled","result":"applied","reason":"run.cancelled","detail":null,"gen":"gen-9d75e6c32fdcd5ad","seq":55,"ts":"2026-11-05T13:17:03.902Z"}
```

**④ 判定**：通过（断言 10/10 通过）

- ✅ 5 秒内命令返回
- ✅ 第 1 次 cancel 退出码 0（期望 0）
- ✅ 第 1 次 cancel 输出含「会话 空闲」（期望包含 "会话 空闲"）
- ✅ 第一行含「已取消」（期望包含 "已取消"）
- ✅ 机检：nodes[1].state='cancelled'（原 'escalated'）（期望 "cancelled"）
- ✅ 机检：nodes[0].state 仍是 'done'（已完成不倒推）（期望 "done"）
- ✅ 机检：handoffs 三条的 state 仍是 'consumed'（期望 "consumed,consumed,consumed"）
- ✅ 机检：escalations[0].state='voided'（期望 "voided"）
- ✅ 第二次输出逐字含「实例已结束（已取消），无需取消」（期望包含 "实例已结束（已取消），无需取消"）
- ✅ 第 2 次 cancel 退出码 1（期望 1）



---

#### AC-43 正向交接包把任务与产物上下文带到下游

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac43`（叙事实例号 `INST-237`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（核心侧 after_accepted:T-002） ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_TEST_PAUSE=after_accepted:T-002`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario code-pass --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac43 --scenario code-pass --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-43.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
（无输出）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-43.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 22,
  "counters": {
    "eventSeq": 21,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:05.209Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-5728-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-16904-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "waiting_dependency",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "accepted",
      "createdAt": "2026-11-05T13:17:04.836Z",
      "deliveredAt": "2026-11-05T13:17:05.060Z",
      "acceptedAt": "2026-11-05T13:17:05.064Z",
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-43.events.jsonl`）：

```
ac43/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":1,"ts":"2026-11-05T13:17:04.503Z"}
ac43/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-a8dfe13f42eebcc3","seq":2,"ts":"2026-11-05T13:17:04.510Z"}
ac43/INST-001 {"object":"session","objectId":"mock-sess-5728-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":6,"ts":"2026-11-05T13:17:04.787Z"}
ac43/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":7,"ts":"2026-11-05T13:17:04.799Z"}
ac43/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":8,"ts":"2026-11-05T13:17:04.819Z"}
ac43/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-a8dfe13f42eebcc3","seq":11,"ts":"2026-11-05T13:17:04.846Z"}
ac43/INST-001 {"object":"session","objectId":"mock-sess-16904-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":17,"ts":"2026-11-05T13:17:05.188Z"}
ac43/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":18,"ts":"2026-11-05T13:17:05.201Z"}
ac43/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-a8dfe13f42eebcc3","seq":19,"ts":"2026-11-05T13:17:05.210Z"}
ac43/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":20,"ts":"2026-11-05T13:17:05.217Z"}
ac43/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884625218},"gen":"gen-a8dfe13f42eebcc3","seq":21,"ts":"2026-11-05T13:17:05.219Z"}
ac43/INST-001 {"object":"session","objectId":"mock-sess-16904-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-a8dfe13f42eebcc3","seq":22,"ts":"2026-11-05T13:17:05.229Z"}
ac43/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 done / 会话 waiting_dependency"},"gen":"gen-a8dfe13f42eebcc3","seq":23,"ts":"2026-11-05T13:17:05.237Z"}
```

**④ 判定**：通过（断言 12/12 通过）

- ✅ 驱动停在「开发第 1 轮已完成、测试第 1 轮已派发并已接受」（.mock/paused 存在）
- ✅ 夹具：.mock/prompts/2.json 存在
- ✅ 夹具：prompts/2.json 的 task 含「给 calc.js 补一个 div 函数」（期望包含 "给 calc.js 补一个 div 函数"）
- ✅ 夹具：prompts/2.json 的 task 含「产物：calc.js」（期望包含 "产物：calc.js"）
- ✅ 夹具：prompts/2.json 的 task 含「out/verdict.json」（期望包含 "out/verdict.json"）
- ✅ 夹具：prompts/2.json 的 task 含「判定」（期望包含 "判定"）
- ✅ 机检：HO-001 的 edge.kind='forward'（期望 "forward"）
- ✅ 机检：HO-001 的 state='accepted' 或 'consumed'
- ✅ 机检：sessions 里 nodeId='T-001' 与 'T-002' 的 sessionId 不同
- ✅ 夹具：.mock/history/1.txt 存在
- ✅ 夹具：.mock/history/1.txt 含 "DEV-ROUND1"（期望包含 "DEV-ROUND1"）
- ✅ 夹具：.mock/history-leak 不存在（第 2 步没有夹带上一轮对话标记）



---

#### AC-44 核对期间会话显示「等待下游」

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac44`（叙事实例号 `INST-238`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（核心侧 after_output:T-002） ｜ 关键 env：`NODE_ENV=test`、`MAESTRO_TEST_PAUSE=after_output:T-002`

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac44 --scenario backflow-once --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac44 | exit=0 | 96ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-44.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 INST-001 · 运行中 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 待校验 · 第 1 轮
会话 等待下游
交接包 HO-001  开发→测试  已构造   21:17:06
交接包 HO-001  开发→测试  已投递   21:17:06
交接包 HO-001  开发→测试  已接受   21:17:06
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-44.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "interrupted",
  "template": "code-loop",
  "halted": false,
  "rev": 25,
  "counters": {
    "eventSeq": 25,
    "runCount": 1,
    "dispatchCount": 3
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "running",
      "note": "stopped at node running / session idle",
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "failed",
      "note": "等待复测",
      "verdict": {
        "value": "fail",
        "defectCount": 2,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:07.148Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-11252-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-9416-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:06.641Z",
      "deliveredAt": "2026-11-05T13:17:06.863Z",
      "acceptedAt": "2026-11-05T13:17:06.867Z",
      "consumedAt": "2026-11-05T13:17:07.152Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "created",
      "createdAt": "2026-11-05T13:17:07.186Z",
      "deliveredAt": null,
      "acceptedAt": null,
      "consumedAt": null,
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:17:07.186Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-44.events.jsonl`）：

```
ac44/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-8b45003ae39c05c3","seq":1,"ts":"2026-11-05T13:17:06.329Z"}
ac44/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-8b45003ae39c05c3","seq":2,"ts":"2026-11-05T13:17:06.340Z"}
ac44/INST-001 {"object":"session","objectId":"mock-sess-11252-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-8b45003ae39c05c3","seq":6,"ts":"2026-11-05T13:17:06.599Z"}
ac44/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-8b45003ae39c05c3","seq":7,"ts":"2026-11-05T13:17:06.606Z"}
ac44/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-8b45003ae39c05c3","seq":8,"ts":"2026-11-05T13:17:06.618Z"}
ac44/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-8b45003ae39c05c3","seq":11,"ts":"2026-11-05T13:17:06.655Z"}
ac44/INST-001 {"object":"session","objectId":"mock-sess-9416-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-8b45003ae39c05c3","seq":17,"ts":"2026-11-05T13:17:06.907Z"}
ac44/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-8b45003ae39c05c3","seq":18,"ts":"2026-11-05T13:17:06.918Z"}
ac44/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-8b45003ae39c05c3","seq":19,"ts":"2026-11-05T13:17:07.149Z"}
ac44/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884627152},"gen":"gen-8b45003ae39c05c3","seq":20,"ts":"2026-11-05T13:17:07.152Z"}
ac44/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-8b45003ae39c05c3","seq":21,"ts":"2026-11-05T13:17:07.170Z"}
ac44/INST-001 {"object":"session","objectId":"mock-sess-9416-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-8b45003ae39c05c3","seq":22,"ts":"2026-11-05T13:17:07.171Z"}
ac44/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-8b45003ae39c05c3","seq":24,"ts":"2026-11-05T13:17:07.204Z"}
ac44/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-8b45003ae39c05c3","seq":25,"ts":"2026-11-05T13:17:07.217Z"}
ac44/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-8b45003ae39c05c3","seq":23,"ts":"2026-11-05T13:17:07.200Z"}
ac44/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"interrupted","result":"applied","reason":"core.stop","detail":{"note":"停在节点 running / 会话 idle"},"gen":"gen-8b45003ae39c05c3","seq":26,"ts":"2026-11-05T13:17:07.340Z"}
```

**④ 判定**：通过（断言 6/6 通过）

- ✅ test -f .mock/paused：核心停在「测试第 1 轮已出料、尚未核对」
- ✅ 机检：nodes[1].state='review'（期望 "review"）
- ✅ 输出含「节点 T-002 测试 待校验」（期望包含 "节点 T-002 测试 待校验"）
- ✅ 输出含独立行「会话 等待下游」（期望包含 "会话 等待下游"）
- ✅ 输出不含「会话 执行中」（期望不含 "会话 执行中"）
- ✅ 写 .mock/release 放行后 nodes[1].state 不再停在 'review'（进入 failed 或 done）



---

#### AC-46 夹具面：回流后复测通过，两节点闭环完成

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac46`（叙事实例号 `INST-239`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac46 --scenario backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 1930ms
[orch status --instance INST-001] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status --instance INST-001   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\ac46 | exit=0 | 209ms
```

> 每条命令 stdout+stderr 全文见 `evidence/AC-46.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac46","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\ac46\\demo-code-pass","scenario":"backflow-once","resolvedScenario":"backflow","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"done"}],"handoffs":3,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1536,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 round=2 done","ok":true},{"name":"handoffs=3 forward/backflow/retest","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 2 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:17:08
交接包 HO-001  开发→测试  已投递   21:17:08
交接包 HO-001  开发→测试  已接受   21:17:08
交接包 HO-001  开发→测试  已完成   21:17:08
交接包 HO-002  测试→开发（回流）  已构造   21:17:08
交接包 HO-002  测试→开发（回流）  已投递   21:17:09
交接包 HO-002  测试→开发（回流）  已接受   21:17:09
交接包 HO-002  测试→开发（回流）  已完成   21:17:09
交接包 HO-003  开发→测试（复测）  已构造   21:17:09
交接包 HO-003  开发→测试（复测）  已投递   21:17:09
交接包 HO-003  开发→测试（复测）  已接受   21:17:09
交接包 HO-003  开发→测试（复测）  已完成   21:17:09
实例 INST-001 · 已完成 · 模板 编码闭环
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 2 轮 · 耗时 1s · 判定 通过
会话 空闲
交接包 HO-001  开发→测试  已构造   21:17:08
交接包 HO-001  开发→测试  已投递   21:17:08
交接包 HO-001  开发→测试  已接受   21:17:08
交接包 HO-001  开发→测试  已完成   21:17:08
交接包 HO-002  测试→开发（回流）  已构造   21:17:08
交接包 HO-002  测试→开发（回流）  已投递   21:17:09
交接包 HO-002  测试→开发（回流）  已接受   21:17:09
交接包 HO-002  测试→开发（回流）  已完成   21:17:09
交接包 HO-003  开发→测试（复测）  已构造   21:17:09
交接包 HO-003  开发→测试（复测）  已投递   21:17:09
交接包 HO-003  开发→测试（复测）  已接受   21:17:09
交接包 HO-003  开发→测试（复测）  已完成   21:17:09
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/AC-46.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 45,
  "counters": {
    "eventSeq": 48,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:09.571Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-30264-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-29152-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-1368-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-21876-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:08.655Z",
      "deliveredAt": "2026-11-05T13:17:08.875Z",
      "acceptedAt": "2026-11-05T13:17:08.881Z",
      "consumedAt": "2026-11-05T13:17:08.942Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:08.985Z",
      "deliveredAt": "2026-11-05T13:17:09.219Z",
      "acceptedAt": "2026-11-05T13:17:09.223Z",
      "consumedAt": "2026-11-05T13:17:09.266Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:17:08.985Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:09.285Z",
      "deliveredAt": "2026-11-05T13:17:09.515Z",
      "acceptedAt": "2026-11-05T13:17:09.523Z",
      "consumedAt": "2026-11-05T13:17:09.577Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/AC-46.events.jsonl`）：

```
ac46/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-004e41ac99763589","seq":1,"ts":"2026-11-05T13:17:08.350Z"}
ac46/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-004e41ac99763589","seq":2,"ts":"2026-11-05T13:17:08.363Z"}
ac46/INST-001 {"object":"session","objectId":"mock-sess-30264-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":6,"ts":"2026-11-05T13:17:08.624Z"}
ac46/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":7,"ts":"2026-11-05T13:17:08.630Z"}
ac46/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-004e41ac99763589","seq":8,"ts":"2026-11-05T13:17:08.640Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-004e41ac99763589","seq":11,"ts":"2026-11-05T13:17:08.666Z"}
ac46/INST-001 {"object":"session","objectId":"mock-sess-29152-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":17,"ts":"2026-11-05T13:17:08.918Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":18,"ts":"2026-11-05T13:17:08.930Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-004e41ac99763589","seq":19,"ts":"2026-11-05T13:17:08.941Z"}
ac46/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884628942},"gen":"gen-004e41ac99763589","seq":20,"ts":"2026-11-05T13:17:08.943Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-004e41ac99763589","seq":21,"ts":"2026-11-05T13:17:08.961Z"}
ac46/INST-001 {"object":"session","objectId":"mock-sess-29152-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-004e41ac99763589","seq":22,"ts":"2026-11-05T13:17:08.964Z"}
ac46/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-004e41ac99763589","seq":24,"ts":"2026-11-05T13:17:08.994Z"}
ac46/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-004e41ac99763589","seq":25,"ts":"2026-11-05T13:17:09.004Z"}
ac46/INST-001 {"object":"session","objectId":"mock-sess-1368-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":31,"ts":"2026-11-05T13:17:09.247Z"}
ac46/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":32,"ts":"2026-11-05T13:17:09.252Z"}
ac46/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-004e41ac99763589","seq":33,"ts":"2026-11-05T13:17:09.264Z"}
ac46/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884629266},"gen":"gen-004e41ac99763589","seq":34,"ts":"2026-11-05T13:17:09.266Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-004e41ac99763589","seq":37,"ts":"2026-11-05T13:17:09.298Z"}
ac46/INST-001 {"object":"session","objectId":"mock-sess-21876-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":43,"ts":"2026-11-05T13:17:09.557Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-004e41ac99763589","seq":44,"ts":"2026-11-05T13:17:09.564Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-004e41ac99763589","seq":45,"ts":"2026-11-05T13:17:09.571Z"}
ac46/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-004e41ac99763589","seq":46,"ts":"2026-11-05T13:17:09.576Z"}
ac46/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884629577},"gen":"gen-004e41ac99763589","seq":47,"ts":"2026-11-05T13:17:09.577Z"}
ac46/INST-001 {"object":"session","objectId":"mock-sess-21876-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-004e41ac99763589","seq":48,"ts":"2026-11-05T13:17:09.582Z"}
ac46/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-004e41ac99763589","seq":49,"ts":"2026-11-05T13:17:09.602Z"}
```

**④ 判定**：通过（断言 13/13 通过）

- ✅ 机检：state='completed'（期望 "completed"）
- ✅ 机检：nodes[0].round=2 且 state=done（期望 "2/done"）
- ✅ 机检：nodes[1].round=2 且 state=done（期望 "2/done"）
- ✅ 机检：handoffs 恰好 3 条（期望 3）
- ✅ 机检：edge.kind 依次 forward、backflow、retest（期望 "forward,backflow,retest"）
- ✅ 机检：state 都是 'consumed'（期望 "consumed,consumed,consumed"）
- ✅ 夹具：prompts/3.json 的 task 含「div 在除数为 0 时返回 Infinity，未抛错」（期望包含 "div 在除数为 0 时返回 Infinity，未抛错"）
- ✅ 夹具：prompts/3.json 的 task 含「out/test-log.txt」（期望包含 "out/test-log.txt"）
- ✅ 夹具：prompts/3.json 的 task 含「div 在整除场景存在浮点误差」（期望包含 "div 在整除场景存在浮点误差"）
- ✅ 夹具：prompts/3.json 的 task 含「out/test-log-2.txt」（期望包含 "out/test-log-2.txt"）
- ✅ 夹具：prompts/4.json 的 task 含「上一轮缺陷：2 条」（期望包含 "上一轮缺陷：2 条"）
- ✅ orch status 有一行匹配 ^节点 T-002 测试 已完成 · 第 2 轮 · 耗时 \S+ · 判定 通过$（期望匹配 /^节点 T-002 测试 已完成 · 第 2 轮 · 耗时 \S+ · 判定 通过$/m）
- ✅ orch status 输出含「升级 —」（期望包含 "升级 —"）



---


## 2. 非功能项

夹具可测项真跑如下（NFR-01a / 01b热 / 02 / 03 / 07 / 08）；NFR-04/05/06/09 由 AC-09/10/11+42/12 覆盖，结论随对应 AC。

### NFR-01a NFR-01a 核心冷启动 5 秒内 — 通过

- 断言：1/1 通过；项目根 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a`；完整原始输出见 `evidence/NFR-01a.output.json`。

#### NFR-01a NFR-01a 核心冷启动 5 秒内

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a`（叙事实例号 `NFR-01a`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（本地根，无真实 DSH）

**① 完整命令 + 夹具场景/开关**

```
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 80ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 197ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 190ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 198ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 186ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 203ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 190ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 196ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 190ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 217ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 184ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 206ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 187ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 203ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 185ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 223ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 188ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 218ms
[orch core stop] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js core stop   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 187ms
[orch status] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\bin\orch.js status   | cwd=C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01a | exit=0 | 220ms
```

> 每条命令 stdout+stderr 全文见 `evidence/NFR-01a.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
实例 无
实例 无
实例 无
实例 无
实例 无
实例 无
实例 无
实例 无
实例 无
实例 无
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/NFR-01a.state.json`）：

（无 state.json）

events.jsonl 相关行（JSON 原文；完整见 `evidence/NFR-01a.events.jsonl`）：

（无 events.jsonl）

**④ 判定**：通过（断言 1/1 通过）

- ✅ 核心冷启动：10 次取最大 < 5000ms



---


### NFR-01b NFR-01b 首次派发（热启动 5 秒内） — 通过

- 断言：2/2 通过；项目根 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01b`；完整原始输出见 `evidence/NFR-01b.output.json`。

#### NFR-01b NFR-01b 首次派发（热启动 5 秒内）

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01b`（叙事实例号 `NFR-01b`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（mock 宿主热启动）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario code-pass] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr01b --scenario code-pass   | cwd=D:\WWW\Maestro | exit=0 | 1244ms
```

> 每条命令 stdout+stderr 全文见 `evidence/NFR-01b.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr01b","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr01b\\demo-code-pass","scenario":"code-pass","resolvedScenario":"pass","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"done"}],"handoffs":1,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":875,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 done","ok":true},{"name":"handoffs=1 forward","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:17:14
交接包 HO-001  开发→测试  已投递   21:17:14
交接包 HO-001  开发→测试  已接受   21:17:14
交接包 HO-001  开发→测试  已完成   21:17:14
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/NFR-01b.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 23,
  "counters": {
    "eventSeq": 22,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:14.944Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-1488-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-22928-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:14.673Z",
      "deliveredAt": "2026-11-05T13:17:14.890Z",
      "acceptedAt": "2026-11-05T13:17:14.898Z",
      "consumedAt": "2026-11-05T13:17:14.960Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/NFR-01b.events.jsonl`）：

```
nfr01b/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-a0df6680224f6251","seq":1,"ts":"2026-11-05T13:17:14.381Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-a0df6680224f6251","seq":2,"ts":"2026-11-05T13:17:14.389Z"}
nfr01b/INST-001 {"object":"session","objectId":"mock-sess-1488-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a0df6680224f6251","seq":6,"ts":"2026-11-05T13:17:14.638Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a0df6680224f6251","seq":7,"ts":"2026-11-05T13:17:14.645Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-a0df6680224f6251","seq":8,"ts":"2026-11-05T13:17:14.657Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-a0df6680224f6251","seq":11,"ts":"2026-11-05T13:17:14.685Z"}
nfr01b/INST-001 {"object":"session","objectId":"mock-sess-22928-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a0df6680224f6251","seq":17,"ts":"2026-11-05T13:17:14.922Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-a0df6680224f6251","seq":18,"ts":"2026-11-05T13:17:14.933Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-a0df6680224f6251","seq":19,"ts":"2026-11-05T13:17:14.944Z"}
nfr01b/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-a0df6680224f6251","seq":20,"ts":"2026-11-05T13:17:14.957Z"}
nfr01b/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884634960},"gen":"gen-a0df6680224f6251","seq":21,"ts":"2026-11-05T13:17:14.960Z"}
nfr01b/INST-001 {"object":"session","objectId":"mock-sess-22928-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-a0df6680224f6251","seq":22,"ts":"2026-11-05T13:17:14.970Z"}
nfr01b/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-a0df6680224f6251","seq":23,"ts":"2026-11-05T13:17:14.989Z"}
```

**④ 判定**：通过（断言 2/2 通过）

- ✅ events 里能取到 run.started 与首个 node.dispatch
- ✅ 热启动首次派发 < 5000ms（run.started → node.dispatch 的 ts 差）


> 冷启动 30 秒目标以「真实 DSH 未拉起」为前提，属真实面，夹具面不覆盖；此处只测热启动。

---


### NFR-02 NFR-02 判定落地后 1 秒内回流 — 通过

- 断言：2/2 通过；项目根 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr02`；完整原始输出见 `evidence/NFR-02.output.json`。

#### NFR-02 NFR-02 判定落地后 1 秒内回流

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr02`（叙事实例号 `NFR-02`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr02 --scenario backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 1899ms
```

> 每条命令 stdout+stderr 全文见 `evidence/NFR-02.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr02","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr02\\demo-code-pass","scenario":"backflow-once","resolvedScenario":"backflow","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"done"}],"handoffs":3,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1529,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 round=2 done","ok":true},{"name":"handoffs=3 forward/backflow/retest","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 2 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:17:15
交接包 HO-001  开发→测试  已投递   21:17:16
交接包 HO-001  开发→测试  已接受   21:17:16
交接包 HO-001  开发→测试  已完成   21:17:16
交接包 HO-002  测试→开发（回流）  已构造   21:17:16
交接包 HO-002  测试→开发（回流）  已投递   21:17:16
交接包 HO-002  测试→开发（回流）  已接受   21:17:16
交接包 HO-002  测试→开发（回流）  已完成   21:17:16
交接包 HO-003  开发→测试（复测）  已构造   21:17:16
交接包 HO-003  开发→测试（复测）  已投递   21:17:16
交接包 HO-003  开发→测试（复测）  已接受   21:17:16
交接包 HO-003  开发→测试（复测）  已完成   21:17:16
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/NFR-02.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 45,
  "counters": {
    "eventSeq": 48,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:16.841Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-34628-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-18072-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-33604-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-10748-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:15.961Z",
      "deliveredAt": "2026-11-05T13:17:16.191Z",
      "acceptedAt": "2026-11-05T13:17:16.195Z",
      "consumedAt": "2026-11-05T13:17:16.246Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:16.274Z",
      "deliveredAt": "2026-11-05T13:17:16.504Z",
      "acceptedAt": "2026-11-05T13:17:16.507Z",
      "consumedAt": "2026-11-05T13:17:16.552Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:17:16.274Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:16.574Z",
      "deliveredAt": "2026-11-05T13:17:16.801Z",
      "acceptedAt": "2026-11-05T13:17:16.804Z",
      "consumedAt": "2026-11-05T13:17:16.848Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/NFR-02.events.jsonl`）：

```
nfr02/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":1,"ts":"2026-11-05T13:17:15.645Z"}
nfr02/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-af1e5cdcf4fc7af2","seq":2,"ts":"2026-11-05T13:17:15.651Z"}
nfr02/INST-001 {"object":"session","objectId":"mock-sess-34628-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":6,"ts":"2026-11-05T13:17:15.925Z"}
nfr02/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":7,"ts":"2026-11-05T13:17:15.933Z"}
nfr02/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":8,"ts":"2026-11-05T13:17:15.945Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-af1e5cdcf4fc7af2","seq":11,"ts":"2026-11-05T13:17:15.973Z"}
nfr02/INST-001 {"object":"session","objectId":"mock-sess-18072-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":17,"ts":"2026-11-05T13:17:16.228Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":18,"ts":"2026-11-05T13:17:16.235Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-af1e5cdcf4fc7af2","seq":19,"ts":"2026-11-05T13:17:16.244Z"}
nfr02/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884636246},"gen":"gen-af1e5cdcf4fc7af2","seq":20,"ts":"2026-11-05T13:17:16.246Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-af1e5cdcf4fc7af2","seq":21,"ts":"2026-11-05T13:17:16.257Z"}
nfr02/INST-001 {"object":"session","objectId":"mock-sess-18072-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":22,"ts":"2026-11-05T13:17:16.259Z"}
nfr02/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-af1e5cdcf4fc7af2","seq":24,"ts":"2026-11-05T13:17:16.281Z"}
nfr02/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-af1e5cdcf4fc7af2","seq":25,"ts":"2026-11-05T13:17:16.289Z"}
nfr02/INST-001 {"object":"session","objectId":"mock-sess-33604-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":31,"ts":"2026-11-05T13:17:16.534Z"}
nfr02/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":32,"ts":"2026-11-05T13:17:16.541Z"}
nfr02/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":33,"ts":"2026-11-05T13:17:16.551Z"}
nfr02/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884636552},"gen":"gen-af1e5cdcf4fc7af2","seq":34,"ts":"2026-11-05T13:17:16.553Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-af1e5cdcf4fc7af2","seq":37,"ts":"2026-11-05T13:17:16.588Z"}
nfr02/INST-001 {"object":"session","objectId":"mock-sess-10748-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":43,"ts":"2026-11-05T13:17:16.828Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":44,"ts":"2026-11-05T13:17:16.835Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-af1e5cdcf4fc7af2","seq":45,"ts":"2026-11-05T13:17:16.842Z"}
nfr02/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":46,"ts":"2026-11-05T13:17:16.847Z"}
nfr02/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884636848},"gen":"gen-af1e5cdcf4fc7af2","seq":47,"ts":"2026-11-05T13:17:16.849Z"}
nfr02/INST-001 {"object":"session","objectId":"mock-sess-10748-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":48,"ts":"2026-11-05T13:17:16.860Z"}
nfr02/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-af1e5cdcf4fc7af2","seq":49,"ts":"2026-11-05T13:17:16.879Z"}
```

**④ 判定**：通过（断言 2/2 通过）

- ✅ 能定位 verdict.read 与紧随其后的 node.dispatch
- ✅ 判定落地后 1 秒内看到回流开始（ts 差 < 1000ms）



---


### NFR-03 NFR-03 连跑 5 个闭环 0 次乱序 — 通过

- 断言：20/20 通过；项目根 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-code-pass`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-backflow-once`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-retest-fail`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-artifact-missing`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-verdict-missing`；完整原始输出见 `evidence/NFR-03.output.json`。

#### NFR-03 NFR-03 连跑 5 个闭环 0 次乱序

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-code-pass`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-backflow-once`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-retest-fail`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-artifact-missing`、`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-verdict-missing`（叙事实例号 `NFR-03`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（5 个独立项目根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario code-pass] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-code-pass --scenario code-pass   | cwd=D:\WWW\Maestro | exit=0 | 1247ms
[driver --scenario backflow-once] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-backflow-once --scenario backflow-once   | cwd=D:\WWW\Maestro | exit=0 | 1918ms
[driver --scenario retest-fail] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-retest-fail --scenario retest-fail   | cwd=D:\WWW\Maestro | exit=0 | 1925ms
[driver --scenario artifact-missing] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-artifact-missing --scenario artifact-missing   | cwd=D:\WWW\Maestro | exit=0 | 925ms
[driver --scenario verdict-missing] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr03-verdict-missing --scenario verdict-missing   | cwd=D:\WWW\Maestro | exit=0 | 1250ms
```

> 每条命令 stdout+stderr 全文见 `evidence/NFR-03.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-code-pass","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-code-pass\\demo-code-pass","scenario":"code-pass","resolvedScenario":"pass","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"done"}],"handoffs":1,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":888,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 done","ok":true},{"name":"handoffs=1 forward","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:17:17
交接包 HO-001  开发→测试  已投递   21:17:18
交接包 HO-001  开发→测试  已接受   21:17:18
交接包 HO-001  开发→测试  已完成   21:17:18
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-backflow-once","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-backflow-once\\demo-code-pass","scenario":"backflow-once","resolvedScenario":"backflow","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"done"}],"handoffs":3,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1534,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 round=2 done","ok":true},{"name":"handoffs=3 forward/backflow/retest","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 2 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 2 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:17:19
交接包 HO-001  开发→测试  已投递   21:17:19
交接包 HO-001  开发→测试  已接受   21:17:19
交接包 HO-001  开发→测试  已完成   21:17:19
交接包 HO-002  测试→开发（回流）  已构造   21:17:19
交接包 HO-002  测试→开发（回流）  已投递   21:17:19
交接包 HO-002  测试→开发（回流）  已接受   21:17:19
交接包 HO-002  测试→开发（回流）  已完成   21:17:19
交接包 HO-003  开发→测试（复测）  已构造   21:17:19
交接包 HO-003  开发→测试（复测）  已投递   21:17:20
交接包 HO-003  开发→测试（复测）  已接受   21:17:20
交接包 HO-003  开发→测试（复测）  已完成   21:17:20
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-retest-fail","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-retest-fail\\demo-code-pass","scenario":"retest-fail","resolvedScenario":"rounds-exceeded","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":2,"state":"done"},{"nodeId":"T-002","round":2,"state":"escalated"}],"handoffs":3,"escalations":[{"escalationId":"ESC-001","reasonCode":"rounds_exceeded"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":1541,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"nodes[1]=escalated round=2","ok":true},{"name":"escalation reason=rounds_exceeded","ok":true,"detail":"rounds_exceeded"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-artifact-missing","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-artifact-missing\\demo-code-pass","scenario":"artifact-missing","resolvedScenario":"product-missing","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"escalated"},{"nodeId":"T-002","round":0,"state":"pending"}],"handoffs":0,"escalations":[{"escalationId":"ESC-001","reasonCode":"artifact_missing"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":552,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"存在升级","ok":true},{"name":"reason 属于产物核对","ok":true,"detail":"artifact_missing"}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-verdict-missing","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr03-verdict-missing\\demo-code-pass","scenario":"verdict-missing","resolvedScenario":"verdict-missing","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":4,"instanceId":"INST-001","state":"suspended","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"escalated"}],"handoffs":1,"escalations":[{"escalationId":"ESC-001","reasonCode":"verdict_missing"}],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":879,"checks":[{"name":"state=suspended","ok":true,"detail":"suspended"},{"name":"escalation reason=verdict_missing","ok":true,"detail":"verdict_missing"},{"name":"无 backflow 交接包","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 空闲
会话 已升级
实例 INST-001 · 已挂起 · 模板 编码闭环
升级 ESC-001 待处理 · 节点 T-002 测试 · 第 1 轮
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/NFR-03.state.json`）：

```json
[
  {
    "__root": "nfr03-code-pass",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "completed",
      "template": "code-loop",
      "halted": false,
      "rev": 23,
      "counters": {
        "eventSeq": 22,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": {
            "value": "pass",
            "defectCount": 0,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T13:17:18.139Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-26232-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-11664-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:17.873Z",
          "deliveredAt": "2026-11-05T13:17:18.091Z",
          "acceptedAt": "2026-11-05T13:17:18.098Z",
          "consumedAt": "2026-11-05T13:17:18.147Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": []
    }
  },
  {
    "__root": "nfr03-backflow-once",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "completed",
      "template": "code-loop",
      "halted": false,
      "rev": 45,
      "counters": {
        "eventSeq": 48,
        "runCount": 1,
        "dispatchCount": 4
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": {
            "value": "pass",
            "defectCount": 0,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T13:17:20.051Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-24244-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-31800-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-15752-1",
          "nodeId": "T-001",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-32700-1",
          "nodeId": "T-002",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:19.171Z",
          "deliveredAt": "2026-11-05T13:17:19.397Z",
          "acceptedAt": "2026-11-05T13:17:19.404Z",
          "consumedAt": "2026-11-05T13:17:19.442Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:19.470Z",
          "deliveredAt": "2026-11-05T13:17:19.693Z",
          "acceptedAt": "2026-11-05T13:17:19.699Z",
          "consumedAt": "2026-11-05T13:17:19.754Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T13:17:19.470Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        },
        {
          "handoffId": "HO-003",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "retest"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:19.774Z",
          "deliveredAt": "2026-11-05T13:17:20.006Z",
          "acceptedAt": "2026-11-05T13:17:20.012Z",
          "consumedAt": "2026-11-05T13:17:20.060Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": []
    }
  },
  {
    "__root": "nfr03-retest-fail",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 43,
      "counters": {
        "eventSeq": 47,
        "runCount": 1,
        "dispatchCount": 4
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 2,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 2,
          "state": "escalated",
          "note": null,
          "verdict": {
            "value": "fail",
            "defectCount": 1,
            "verdictPath": "out/verdict.json",
            "readAt": "2026-11-05T13:17:21.979Z"
          },
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-26292-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-27964-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-16204-1",
          "nodeId": "T-001",
          "round": 2,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-9380-1",
          "nodeId": "T-002",
          "round": 2,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:21.091Z",
          "deliveredAt": "2026-11-05T13:17:21.332Z",
          "acceptedAt": "2026-11-05T13:17:21.339Z",
          "consumedAt": "2026-11-05T13:17:21.380Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        },
        {
          "handoffId": "HO-002",
          "edge": {
            "from": "T-002",
            "to": "T-001",
            "kind": "backflow"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:21.407Z",
          "deliveredAt": "2026-11-05T13:17:21.627Z",
          "acceptedAt": "2026-11-05T13:17:21.632Z",
          "consumedAt": "2026-11-05T13:17:21.681Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": "2026-11-05T13:17:21.408Z",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            },
            {
              "summary": "div 在整除场景存在浮点误差",
              "evidence": "out/test-log-2.txt"
            }
          ]
        },
        {
          "handoffId": "HO-003",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "retest"
          },
          "state": "consumed",
          "createdAt": "2026-11-05T13:17:21.711Z",
          "deliveredAt": "2026-11-05T13:17:21.941Z",
          "acceptedAt": "2026-11-05T13:17:21.945Z",
          "consumedAt": "2026-11-05T13:17:21.980Z",
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 2,
          "reasonCode": "rounds_exceeded",
          "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
          "state": "pending",
          "defects": [
            {
              "summary": "div 在除数为 0 时返回 Infinity，未抛错",
              "evidence": "out/test-log.txt"
            }
          ]
        }
      ]
    }
  },
  {
    "__root": "nfr03-artifact-missing",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 10,
      "counters": {
        "eventSeq": 7,
        "runCount": 1,
        "dispatchCount": 1
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 0,
          "state": "pending",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-31952-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-001",
          "round": 1,
          "reasonCode": "artifact_missing",
          "reasonDetail": "核对失败：未找到声明的产出 calc.js",
          "state": "pending",
          "defects": []
        }
      ]
    }
  },
  {
    "__root": "nfr03-verdict-missing",
    "instanceId": "INST-001",
    "state": {
      "instanceId": "INST-001",
      "state": "suspended",
      "template": "code-loop",
      "halted": false,
      "rev": 20,
      "counters": {
        "eventSeq": 19,
        "runCount": 1,
        "dispatchCount": 2
      },
      "nodes": [
        {
          "nodeId": "T-001",
          "roleId": "developer",
          "round": 1,
          "state": "done",
          "note": null,
          "verdict": null,
          "failure": null
        },
        {
          "nodeId": "T-002",
          "roleId": "tester",
          "round": 1,
          "state": "escalated",
          "note": null,
          "verdict": null,
          "failure": null
        }
      ],
      "sessions": [
        {
          "sessionId": "mock-sess-12636-1",
          "nodeId": "T-001",
          "round": 1,
          "state": "idle",
          "hostId": "mock"
        },
        {
          "sessionId": "mock-sess-23072-1",
          "nodeId": "T-002",
          "round": 1,
          "state": "escalated",
          "hostId": "mock"
        }
      ],
      "handoffs": [
        {
          "handoffId": "HO-001",
          "edge": {
            "from": "T-001",
            "to": "T-002",
            "kind": "forward"
          },
          "state": "accepted",
          "createdAt": "2026-11-05T13:17:23.927Z",
          "deliveredAt": "2026-11-05T13:17:24.156Z",
          "acceptedAt": "2026-11-05T13:17:24.163Z",
          "consumedAt": null,
          "rejectedAt": null,
          "rejectReason": null,
          "wakeConsumedAt": null,
          "defects": []
        }
      ],
      "escalations": [
        {
          "escalationId": "ESC-001",
          "nodeId": "T-002",
          "round": 1,
          "reasonCode": "verdict_missing",
          "reasonDetail": "核对失败：未找到判定文件 out/verdict.json",
          "state": "pending",
          "defects": []
        }
      ]
    }
  }
]
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/NFR-03.events.jsonl`）：

```
nfr03-code-pass/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":1,"ts":"2026-11-05T13:17:17.576Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-20fe00c08a1a2b4a","seq":2,"ts":"2026-11-05T13:17:17.584Z"}
nfr03-code-pass/INST-001 {"object":"session","objectId":"mock-sess-26232-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":6,"ts":"2026-11-05T13:17:17.837Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":7,"ts":"2026-11-05T13:17:17.844Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":8,"ts":"2026-11-05T13:17:17.857Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-20fe00c08a1a2b4a","seq":11,"ts":"2026-11-05T13:17:17.884Z"}
nfr03-code-pass/INST-001 {"object":"session","objectId":"mock-sess-11664-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":17,"ts":"2026-11-05T13:17:18.124Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":18,"ts":"2026-11-05T13:17:18.132Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-20fe00c08a1a2b4a","seq":19,"ts":"2026-11-05T13:17:18.139Z"}
nfr03-code-pass/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":20,"ts":"2026-11-05T13:17:18.146Z"}
nfr03-code-pass/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884638147},"gen":"gen-20fe00c08a1a2b4a","seq":21,"ts":"2026-11-05T13:17:18.147Z"}
nfr03-code-pass/INST-001 {"object":"session","objectId":"mock-sess-11664-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":22,"ts":"2026-11-05T13:17:18.152Z"}
nfr03-code-pass/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-20fe00c08a1a2b4a","seq":23,"ts":"2026-11-05T13:17:18.174Z"}
nfr03-backflow-once/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":1,"ts":"2026-11-05T13:17:18.852Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-6ed4427d5f3ad92c","seq":2,"ts":"2026-11-05T13:17:18.864Z"}
nfr03-backflow-once/INST-001 {"object":"session","objectId":"mock-sess-24244-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":6,"ts":"2026-11-05T13:17:19.135Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":7,"ts":"2026-11-05T13:17:19.142Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":8,"ts":"2026-11-05T13:17:19.155Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-6ed4427d5f3ad92c","seq":11,"ts":"2026-11-05T13:17:19.182Z"}
nfr03-backflow-once/INST-001 {"object":"session","objectId":"mock-sess-31800-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":17,"ts":"2026-11-05T13:17:19.427Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":18,"ts":"2026-11-05T13:17:19.434Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-6ed4427d5f3ad92c","seq":19,"ts":"2026-11-05T13:17:19.441Z"}
nfr03-backflow-once/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884639442},"gen":"gen-6ed4427d5f3ad92c","seq":20,"ts":"2026-11-05T13:17:19.442Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-6ed4427d5f3ad92c","seq":21,"ts":"2026-11-05T13:17:19.455Z"}
nfr03-backflow-once/INST-001 {"object":"session","objectId":"mock-sess-31800-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":22,"ts":"2026-11-05T13:17:19.456Z"}
nfr03-backflow-once/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-6ed4427d5f3ad92c","seq":24,"ts":"2026-11-05T13:17:19.475Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-6ed4427d5f3ad92c","seq":25,"ts":"2026-11-05T13:17:19.480Z"}
nfr03-backflow-once/INST-001 {"object":"session","objectId":"mock-sess-15752-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":31,"ts":"2026-11-05T13:17:19.737Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":32,"ts":"2026-11-05T13:17:19.742Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":33,"ts":"2026-11-05T13:17:19.752Z"}
nfr03-backflow-once/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884639754},"gen":"gen-6ed4427d5f3ad92c","seq":34,"ts":"2026-11-05T13:17:19.754Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-6ed4427d5f3ad92c","seq":37,"ts":"2026-11-05T13:17:19.790Z"}
nfr03-backflow-once/INST-001 {"object":"session","objectId":"mock-sess-32700-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":43,"ts":"2026-11-05T13:17:20.039Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":44,"ts":"2026-11-05T13:17:20.044Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-6ed4427d5f3ad92c","seq":45,"ts":"2026-11-05T13:17:20.051Z"}
nfr03-backflow-once/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":46,"ts":"2026-11-05T13:17:20.058Z"}
nfr03-backflow-once/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884640060},"gen":"gen-6ed4427d5f3ad92c","seq":47,"ts":"2026-11-05T13:17:20.060Z"}
nfr03-backflow-once/INST-001 {"object":"session","objectId":"mock-sess-32700-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":48,"ts":"2026-11-05T13:17:20.064Z"}
nfr03-backflow-once/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-6ed4427d5f3ad92c","seq":49,"ts":"2026-11-05T13:17:20.082Z"}
nfr03-retest-fail/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-69c35538e48feb8c","seq":1,"ts":"2026-11-05T13:17:20.789Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-69c35538e48feb8c","seq":2,"ts":"2026-11-05T13:17:20.799Z"}
nfr03-retest-fail/INST-001 {"object":"session","objectId":"mock-sess-26292-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":6,"ts":"2026-11-05T13:17:21.051Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":7,"ts":"2026-11-05T13:17:21.059Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-69c35538e48feb8c","seq":8,"ts":"2026-11-05T13:17:21.071Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-69c35538e48feb8c","seq":11,"ts":"2026-11-05T13:17:21.106Z"}
nfr03-retest-fail/INST-001 {"object":"session","objectId":"mock-sess-27964-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":17,"ts":"2026-11-05T13:17:21.366Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":18,"ts":"2026-11-05T13:17:21.372Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-69c35538e48feb8c","seq":19,"ts":"2026-11-05T13:17:21.379Z"}
nfr03-retest-fail/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884641380},"gen":"gen-69c35538e48feb8c","seq":20,"ts":"2026-11-05T13:17:21.381Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-69c35538e48feb8c","seq":21,"ts":"2026-11-05T13:17:21.392Z"}
nfr03-retest-fail/INST-001 {"object":"session","objectId":"mock-sess-27964-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-69c35538e48feb8c","seq":22,"ts":"2026-11-05T13:17:21.394Z"}
nfr03-retest-fail/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-69c35538e48feb8c","seq":24,"ts":"2026-11-05T13:17:21.414Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-69c35538e48feb8c","seq":25,"ts":"2026-11-05T13:17:21.418Z"}
nfr03-retest-fail/INST-001 {"object":"session","objectId":"mock-sess-16204-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":31,"ts":"2026-11-05T13:17:21.656Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":32,"ts":"2026-11-05T13:17:21.664Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-69c35538e48feb8c","seq":33,"ts":"2026-11-05T13:17:21.678Z"}
nfr03-retest-fail/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884641681},"gen":"gen-69c35538e48feb8c","seq":34,"ts":"2026-11-05T13:17:21.681Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-69c35538e48feb8c","seq":37,"ts":"2026-11-05T13:17:21.723Z"}
nfr03-retest-fail/INST-001 {"object":"session","objectId":"mock-sess-9380-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":43,"ts":"2026-11-05T13:17:21.967Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-69c35538e48feb8c","seq":44,"ts":"2026-11-05T13:17:21.972Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-69c35538e48feb8c","seq":45,"ts":"2026-11-05T13:17:21.979Z"}
nfr03-retest-fail/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884641980},"gen":"gen-69c35538e48feb8c","seq":46,"ts":"2026-11-05T13:17:21.980Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"rounds.exceeded","detail":{"round":2,"maxRounds":2},"gen":"gen-69c35538e48feb8c","seq":47,"ts":"2026-11-05T13:17:21.986Z"}
nfr03-retest-fail/INST-001 {"object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"nodeId":"T-002","round":2,"reasonCode":"rounds_exceeded"},"gen":"gen-69c35538e48feb8c","seq":48,"ts":"2026-11-05T13:17:21.996Z"}
nfr03-retest-fail/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"suspended","result":"applied","reason":"core.suspend","detail":null,"gen":"gen-69c35538e48feb8c","seq":51,"ts":"2026-11-05T13:17:22.000Z"}
nfr03-retest-fail/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-69c35538e48feb8c","seq":49,"ts":"2026-11-05T13:17:21.997Z"}
nfr03-retest-fail/INST-001 {"object":"session","objectId":"mock-sess-9380-1","from":"waiting_dependency","to":"escalated","result":"applied","reason":"state.change","detail":null,"gen":"gen-69c35538e48feb8c","seq":50,"ts":"2026-11-05T13:17:21.999Z"}
nfr03-artifact-missing/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-ded2d782c06834e5","seq":1,"ts":"2026-11-05T13:17:22.670Z"}
nfr03-artifact-missing/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-ded2d782c06834e5","seq":2,"ts":"2026-11-05T13:17:22.678Z"}
nfr03-artifact-missing/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-ded2d782c06834e5","seq":7,"ts":"2026-11-05T13:17:22.948Z"}
```

**④ 判定**：通过（断言 20/20 通过）

- ✅ [code-pass] 最终 state=completed（期望 "completed"）
- ✅ [code-pass] 两节点（nodes.length=2）（期望 2）
- ✅ [code-pass] 无 round>2（轮次不错乱）（期望 0）
- ✅ [code-pass] node.dispatch 事件 seq 严格递增（节点不乱序）
- ✅ [backflow-once] 最终 state=completed（期望 "completed"）
- ✅ [backflow-once] 两节点（nodes.length=2）（期望 2）
- ✅ [backflow-once] 无 round>2（轮次不错乱）（期望 0）
- ✅ [backflow-once] node.dispatch 事件 seq 严格递增（节点不乱序）
- ✅ [retest-fail] 最终 state=suspended（期望 "suspended"）
- ✅ [retest-fail] 两节点（nodes.length=2）（期望 2）
- ✅ [retest-fail] 无 round>2（轮次不错乱）（期望 0）
- ✅ [retest-fail] node.dispatch 事件 seq 严格递增（节点不乱序）
- ✅ [artifact-missing] 最终 state=suspended（期望 "suspended"）
- ✅ [artifact-missing] 两节点（nodes.length=2）（期望 2）
- ✅ [artifact-missing] 无 round>2（轮次不错乱）（期望 0）
- ✅ [artifact-missing] node.dispatch 事件 seq 严格递增（节点不乱序）
- ✅ [verdict-missing] 最终 state=suspended（期望 "suspended"）
- ✅ [verdict-missing] 两节点（nodes.length=2）（期望 2）
- ✅ [verdict-missing] 无 round>2（轮次不错乱）（期望 0）
- ✅ [verdict-missing] node.dispatch 事件 seq 严格递增（节点不乱序）



---


### NFR-07 NFR-07 频繁查询不让闭环多跑 — 通过

- 断言：3/3 通过；项目根 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr07`；完整原始输出见 `evidence/NFR-07.output.json`。

#### NFR-07 NFR-07 频繁查询不让闭环多跑

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr07`（叙事实例号 `NFR-07`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（本地根）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario code-pass] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr07 --scenario code-pass   | cwd=D:\WWW\Maestro | exit=0 | 1233ms
[夹具：for i in $(seq 100); do orch status > /dev/null; done] "(fixture) for i in $(seq 100); do orch status > /dev/null; done"   | cwd=D:\WWW\Maestro | exit=0 | 0ms
```

> 每条命令 stdout+stderr 全文见 `evidence/NFR-07.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
{"ok":true,"root":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr07","cwd":"C:\\Users\\xuesh\\AppData\\Local\\Temp\\maestro-acc-f2\\proj\\nfr07\\demo-code-pass","scenario":"code-pass","resolvedScenario":"pass","stopAfter":null,"keep":false,"released":false,"target":"exit","exitCode":0,"instanceId":"INST-001","state":"completed","nodes":[{"nodeId":"T-001","round":1,"state":"done"},{"nodeId":"T-002","round":1,"state":"done"}],"handoffs":1,"escalations":[],"paused":false,"exhausted":false,"historyLeak":false,"durationMs":873,"checks":[{"name":"state=completed","ok":true,"detail":"completed"},{"name":"两节点 done","ok":true},{"name":"handoffs=1 forward","ok":true}]}
实例 INST-001 · 运行中 · 模板 编码闭环
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
会话 执行中 · 已运行 1s
会话 等待下游 · 产出已提交
会话 空闲
节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1s
节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1s · 判定 通过
交接包 HO-001  开发→测试  已构造   21:17:25
交接包 HO-001  开发→测试  已投递   21:17:25
交接包 HO-001  开发→测试  已接受   21:17:25
交接包 HO-001  开发→测试  已完成   21:17:25
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/NFR-07.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 23,
  "counters": {
    "eventSeq": 22,
    "runCount": 1,
    "dispatchCount": 2
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 1,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:25.475Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-9156-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-34180-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:25.181Z",
      "deliveredAt": "2026-11-05T13:17:25.405Z",
      "acceptedAt": "2026-11-05T13:17:25.412Z",
      "consumedAt": "2026-11-05T13:17:25.488Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/NFR-07.events.jsonl`）：

```
nfr07/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-92c53f0c185298a2","seq":1,"ts":"2026-11-05T13:17:24.889Z"}
nfr07/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-92c53f0c185298a2","seq":2,"ts":"2026-11-05T13:17:24.899Z"}
nfr07/INST-001 {"object":"session","objectId":"mock-sess-9156-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-92c53f0c185298a2","seq":6,"ts":"2026-11-05T13:17:25.148Z"}
nfr07/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-92c53f0c185298a2","seq":7,"ts":"2026-11-05T13:17:25.156Z"}
nfr07/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-92c53f0c185298a2","seq":8,"ts":"2026-11-05T13:17:25.167Z"}
nfr07/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-92c53f0c185298a2","seq":11,"ts":"2026-11-05T13:17:25.193Z"}
nfr07/INST-001 {"object":"session","objectId":"mock-sess-34180-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-92c53f0c185298a2","seq":17,"ts":"2026-11-05T13:17:25.449Z"}
nfr07/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-92c53f0c185298a2","seq":18,"ts":"2026-11-05T13:17:25.461Z"}
nfr07/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-92c53f0c185298a2","seq":19,"ts":"2026-11-05T13:17:25.476Z"}
nfr07/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-92c53f0c185298a2","seq":20,"ts":"2026-11-05T13:17:25.486Z"}
nfr07/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884645488},"gen":"gen-92c53f0c185298a2","seq":21,"ts":"2026-11-05T13:17:25.489Z"}
nfr07/INST-001 {"object":"session","objectId":"mock-sess-34180-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-92c53f0c185298a2","seq":22,"ts":"2026-11-05T13:17:25.500Z"}
nfr07/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-92c53f0c185298a2","seq":23,"ts":"2026-11-05T13:17:25.523Z"}
```

**④ 判定**：通过（断言 3/3 通过）

- ✅ 100 次 status 后 sessions.length 不变（期望 2）
- ✅ 100 次 status 后 events 行数不变（期望 23）
- ✅ 100 次 status 后 state 不变（期望 "completed"）



---


### NFR-08 NFR-08 关掉命令窗口闭环不被带走 — 通过

- 断言：5/5 通过；项目根 `C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr08`；完整原始输出见 `evidence/NFR-08.output.json`。

#### NFR-08 NFR-08 关掉命令窗口闭环不被带走

- 项目根：`C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr08`（叙事实例号 `NFR-08`；实际 `state.json` 为 `INST-001`，由产品自动分配）
- 验证面：夹具（常驻核心 + 暂停点）

**① 完整命令 + 夹具场景/开关**

```
[driver --scenario backflow-once --keep （长驻，startDriver 管理）] C:\Users\xuesh\.workbuddy\binaries\node\versions\22.22.2-6\node.exe D:\WWW\Maestro\test\fixtures\code-loop-driver.mjs --root C:\Users\xuesh\AppData\Local\Temp\maestro-acc-f2\proj\nfr08 --scenario backflow-once --keep   | cwd=D:\WWW\Maestro | exit=null | 0ms
```

> 每条命令 stdout+stderr 全文见 `evidence/NFR-08.output.json`；下表为关键行摘录。

**② 原始输出（关键行）**

```
（无输出）
```

**③ 状态证据**

state.json 相关字段（JSON 原文；完整见 `evidence/NFR-08.state.json`）：

```json
{
  "instanceId": "INST-001",
  "state": "completed",
  "template": "code-loop",
  "halted": false,
  "rev": 45,
  "counters": {
    "eventSeq": 48,
    "runCount": 1,
    "dispatchCount": 4
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": null,
      "failure": null
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "done",
      "note": null,
      "verdict": {
        "value": "pass",
        "defectCount": 0,
        "verdictPath": "out/verdict.json",
        "readAt": "2026-11-05T13:17:36.603Z"
      },
      "failure": null
    }
  ],
  "sessions": [
    {
      "sessionId": "mock-sess-1148-1",
      "nodeId": "T-001",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-26620-1",
      "nodeId": "T-002",
      "round": 1,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-17728-1",
      "nodeId": "T-001",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    },
    {
      "sessionId": "mock-sess-19472-1",
      "nodeId": "T-002",
      "round": 2,
      "state": "idle",
      "hostId": "mock"
    }
  ],
  "handoffs": [
    {
      "handoffId": "HO-001",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "forward"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:35.595Z",
      "deliveredAt": "2026-11-05T13:17:35.814Z",
      "acceptedAt": "2026-11-05T13:17:35.821Z",
      "consumedAt": "2026-11-05T13:17:36.005Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    },
    {
      "handoffId": "HO-002",
      "edge": {
        "from": "T-002",
        "to": "T-001",
        "kind": "backflow"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:36.039Z",
      "deliveredAt": "2026-11-05T13:17:36.266Z",
      "acceptedAt": "2026-11-05T13:17:36.273Z",
      "consumedAt": "2026-11-05T13:17:36.316Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T13:17:36.039Z",
      "defects": [
        {
          "summary": "div 在除数为 0 时返回 Infinity，未抛错",
          "evidence": "out/test-log.txt"
        },
        {
          "summary": "div 在整除场景存在浮点误差",
          "evidence": "out/test-log-2.txt"
        }
      ]
    },
    {
      "handoffId": "HO-003",
      "edge": {
        "from": "T-001",
        "to": "T-002",
        "kind": "retest"
      },
      "state": "consumed",
      "createdAt": "2026-11-05T13:17:36.336Z",
      "deliveredAt": "2026-11-05T13:17:36.563Z",
      "acceptedAt": "2026-11-05T13:17:36.568Z",
      "consumedAt": "2026-11-05T13:17:36.611Z",
      "rejectedAt": null,
      "rejectReason": null,
      "wakeConsumedAt": null,
      "defects": []
    }
  ],
  "escalations": []
}
```

events.jsonl 相关行（JSON 原文；完整见 `evidence/NFR-08.events.jsonl`）：

```
nfr08/INST-001 {"object":"instance","objectId":"INST-001","from":"created","to":"running","result":"applied","reason":"run.started","detail":null,"gen":"gen-59ce96d2260bc399","seq":1,"ts":"2026-11-05T13:17:35.287Z"}
nfr08/INST-001 {"object":"node","objectId":"T-001","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-001","roleId":"developer"},"gen":"gen-59ce96d2260bc399","seq":2,"ts":"2026-11-05T13:17:35.297Z"}
nfr08/INST-001 {"object":"session","objectId":"mock-sess-1148-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":6,"ts":"2026-11-05T13:17:35.555Z"}
nfr08/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":7,"ts":"2026-11-05T13:17:35.565Z"}
nfr08/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-59ce96d2260bc399","seq":8,"ts":"2026-11-05T13:17:35.577Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":"pending","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":1,"nodeId":"T-002","roleId":"tester"},"gen":"gen-59ce96d2260bc399","seq":11,"ts":"2026-11-05T13:17:35.604Z"}
nfr08/INST-001 {"object":"session","objectId":"mock-sess-26620-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":17,"ts":"2026-11-05T13:17:35.866Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":18,"ts":"2026-11-05T13:17:35.877Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-59ce96d2260bc399","seq":19,"ts":"2026-11-05T13:17:36.003Z"}
nfr08/INST-001 {"object":"handoff","objectId":"HO-001","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884656005},"gen":"gen-59ce96d2260bc399","seq":20,"ts":"2026-11-05T13:17:36.005Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-59ce96d2260bc399","seq":21,"ts":"2026-11-05T13:17:36.019Z"}
nfr08/INST-001 {"object":"session","objectId":"mock-sess-26620-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"verification.failed","detail":null,"gen":"gen-59ce96d2260bc399","seq":22,"ts":"2026-11-05T13:17:36.022Z"}
nfr08/INST-001 {"object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div 在整除场景存在浮点误差","evidence":"out/test-log-2.txt"}],"retestRequirement":"按上方每条缺陷修正后重新提交产物"},"gen":"gen-59ce96d2260bc399","seq":24,"ts":"2026-11-05T13:17:36.047Z"}
nfr08/INST-001 {"object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-59ce96d2260bc399","seq":25,"ts":"2026-11-05T13:17:36.053Z"}
nfr08/INST-001 {"object":"session","objectId":"mock-sess-17728-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":31,"ts":"2026-11-05T13:17:36.299Z"}
nfr08/INST-001 {"object":"node","objectId":"T-001","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":32,"ts":"2026-11-05T13:17:36.305Z"}
nfr08/INST-001 {"object":"node","objectId":"T-001","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-59ce96d2260bc399","seq":33,"ts":"2026-11-05T13:17:36.315Z"}
nfr08/INST-001 {"object":"handoff","objectId":"HO-002","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884656316},"gen":"gen-59ce96d2260bc399","seq":34,"ts":"2026-11-05T13:17:36.316Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":"failed","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-002","roleId":"tester"},"gen":"gen-59ce96d2260bc399","seq":37,"ts":"2026-11-05T13:17:36.347Z"}
nfr08/INST-001 {"object":"session","objectId":"mock-sess-19472-1","from":"thinking","to":"waiting_dependency","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":43,"ts":"2026-11-05T13:17:36.591Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-59ce96d2260bc399","seq":44,"ts":"2026-11-05T13:17:36.596Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"pass"},"gen":"gen-59ce96d2260bc399","seq":45,"ts":"2026-11-05T13:17:36.603Z"}
nfr08/INST-001 {"object":"node","objectId":"T-002","from":"review","to":"done","result":"applied","reason":"verification.passed","detail":null,"gen":"gen-59ce96d2260bc399","seq":46,"ts":"2026-11-05T13:17:36.610Z"}
nfr08/INST-001 {"object":"handoff","objectId":"HO-003","from":"accepted","to":"consumed","result":"applied","reason":"handoff.consumed","detail":{"atMs":1793884656611},"gen":"gen-59ce96d2260bc399","seq":47,"ts":"2026-11-05T13:17:36.612Z"}
nfr08/INST-001 {"object":"session","objectId":"mock-sess-19472-1","from":"waiting_dependency","to":"idle","result":"applied","reason":"run.completed","detail":null,"gen":"gen-59ce96d2260bc399","seq":48,"ts":"2026-11-05T13:17:36.617Z"}
nfr08/INST-001 {"object":"instance","objectId":"INST-001","from":"running","to":"completed","result":"applied","reason":"run.completed","detail":null,"gen":"gen-59ce96d2260bc399","seq":49,"ts":"2026-11-05T13:17:36.636Z"}
```

**④ 判定**：通过（断言 5/5 通过）

- ✅ 核心常驻（after_output 暂停点模拟「命令窗口已不在」）
- ✅ 取到 .orch/core.json 的进程号
- ✅ 30 秒内闭环自行推进到完成（事件仍有新增）
- ✅ 核心进程号不变（期望 12956）
- ✅ events 行数有新增


> 夹具下用 `after_output:T-002` 暂停 + 常驻核心近似「命令窗口已关闭」；未真正关闭终端窗口（进程由 startDriver 持有），但核心 pid 不变与「放行后 30 秒内事件仍有新增」已真实验证。

---



## 3. 未通过项汇总（ID | 需求原文 Then | 实际 | 根因线索）

（无未通过 / 阻塞项）


## 4. 夹具可信度声明（是否走产品同一链路、有没有绕过）

**是否走产品同一链路：是（唯一替代点是「宿主命令」与需求授权的测试接缝）。**

- 实例一律由产品 CLI 发起：`code-loop-driver.mjs` 调 `node bin/orch.js run --cwd … --template code-loop --host mock --task …`（或由 `orch run` 自己发起，AC-12/38 用 `--prepare-only` 只备现场）；**不 import orchestrator、不写 `state.json` 造中间态、不改 `src/**`/`test/**`/`bin/**`/`package.json`/`requirement.md`**。
- 宿主是**真进程**：`.orch/hosts/mock.json` 的 `launch.command` 指向 `mock-acp-agent.js`，由核心经 `host-config` 以 `stdio` NDJSON spawn，走与真实 DSH 相同的 `spawn → NDJSON → acp-client → orchestrator` 链路；每次派发一个新进程、原子消费 `cursor.json` 一步。
- 所有查询/取消/停核心均为产品命令：`node bin/orch.js status [--instance …] [--events]` / `cancel --instance …` / `core stop`；渲染、状态机、事件总线、持久化（CAS、`rev`、v1 只读）全部是产品实现。
- 中间态由**产品核心侧测试开关**自然产生，非手工改盘：`NODE_ENV=test` + `MAESTRO_TEST_PAUSE`（`after_accepted:T-002` / `after_output:T-002` / `after_verdict`）、`MAESTRO_TEST_STOP_AFTER=3`、`MAESTRO_FAULT=state_write:escalation`，均为需求 §3.3 明确授权、只在 `NODE_ENV=test` 生效的注入点。
- 测试接缝：`call-seam.mjs` 仅经 IPC 调核心 `test.dispatch` / `test.escalate`（M-14，仅 `NODE_ENV=test` 导出），返回值原样单行输出；`attempt-transition.mjs` 直接调 `createNodeSM` 并经 `event-bus` 把 `rejected` 事件写入**同一份** `events.jsonl`（要求核心已 `stop`，避免并发写）。`purity-check.mjs` 是源码架构扫描；`legacy-v1/**` 四个文件整盘只读拷贝并用 `SHA256SUMS` 校验「看也不改」。
- **没有绕过**：`Given` 均真构造（独立项目根、driver 场景、prepare-only、legacy 拷贝、暂停点、故障注入）；`Then` 逐条断言，多断言逐条判；未通过/阻塞如实记录，未修任何实现、未 `git commit`。
- **口径说明**：需求执行规则要求「实例号从 `INST-201` 起编」，但每条 AC 用独立项目根、实例号由产品自动分配为 `INST-001`（需求 §3.1 所有 AC 原文亦写 `INST-001`，强行改成 201 会使 AC 内所有 `INST-001` 断言失效）。故本报告为每条 AC 标注**叙事实例号 `INST-201`~`INST-239`**（仅作索引），`state.json` / `events.jsonl` 中实际 `instanceId` 为 `INST-001`；两者映射见 §1 每条首行。
- **真实面不在本范围**：AC-01 / AC-03 / AC-21 / AC-22 / AC-45 由并行 Agent 用 `%TEMP%/maestro-acc-p2/` 与真实 DSH 验收；本夹具面不使用真实模型凭据，结论只代表「链路 + 状态机 + 渲染 + 持久化」在 mock 宿主下成立，不代表真实推理质量（§3.3 要求写明：本记录用 **mock**）。
- **无法构造 / 部分近似的场景**：① NFR-01b「冷启动 30 秒（DSH 未拉起）」需真实 DSH，夹具面只测热启动；② NFR-08「关掉命令窗口」夹具下用常驻核心 + `after_output` 暂停点近似，未真正关闭终端窗口，但核心 pid 不变与「放行后事件仍有新增」已真实验证；③ 所有需要真实模型「稳定失败」的回流/升级分支按需求 §3.1 本就走夹具（AC-45 除外），非无法构造。
