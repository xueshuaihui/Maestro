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
