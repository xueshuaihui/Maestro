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
