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
