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
