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
