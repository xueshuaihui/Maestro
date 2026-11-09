---
schema: skill/v1
id: test-run
name: 测试执行
summary: 运行测试并把结果落成报告，不掩盖失败用例
applies_to: [coding]
commands: ["node --test"]
---

### 工作方法

1. 先跑一遍全量测试，记下基线。
2. 只跑与本次改动相关的用例时，说明为什么。
3. 把失败用例原样贴进报告，不做删减。
