# A1 自主裁决台账（主控维护，执行模板 §2.8）

> 格式：触发点 / 依据 / 决定 / 影响面。裁决优先级：AC Then/And > 附录A输出基线 > 附录D实现约束 > M/C契约 > 规划文档 > 代码现状。

| # | 触发点 | 依据 | 决定 | 影响面 |
|---|---|---|---|---|
| DR-01 | 拆分评审 S1：WP-1 的 index.js 要在契约冻结时重导出 capability-matrix.js，但该文件由 WP-3 后建，提前落盘会 ESM 加载失败 | 拆分评审 review-split.md S1；ESM 静态导入语义 | 派单时明确 WP-1 不追加该 re-export，改由 WP-3 建好文件后追加；内容仍符合契约 | WP-1/3 派单；wp16 全绿无 ERR_MODULE_NOT_FOUND |
| DR-02 | WP-4 报告 `grep -P` 在 macOS BSD grep 不支持（exit 2） | 本机实测；需求 AC 架构检查实际用 node 正则 | 本机门禁一律用 `node -e` 正则做零 CJK 检查，不用 grep -P；判据强度不变 | 六迭代门禁命令；A-phase-decisions AD-04 |
| DR-03 | 实现评审 D-2（P2）：AC-12 阻塞测试硬编码本机观测，换取证机误红 | review-impl.md D-2；需求 Given 可构造性 | 派单修复为环境自适应：无 CLI→判阻塞，有 CLI→走真实 NDJSON 握手给 EVIDENCE_LEVEL_REAL，不写死也不 mock 顶替 | ACC-4~7 + 新增 ACC-10；两分支实测通过 |
| DR-04 | 实现评审 D-1（P2）：符号链接判重的 realpath 修复无回归锁定 | review-impl.md D-1 | 派单补 symlink 真实用例：symlink 路径 add 应判重复且 user_config 仍 1 条 | cli-add.test.js CLI-A5 |
| DR-05 | 实现评审 D-3/4/5（P3 建议）：run() 第三参忽略 / AD-06 未真跑worktree / index.js 归属时序 | review-impl.md；不扩大改动面纪律 | 不修只留痕；D-4 由主控在全量门禁按 AD-06 口径处理（旧用例红差集 0） | final-verification §状态 |
| DR-06 | 终验 Done 第4/5/6项因 report/progress/复跑留痕未产出而 FAIL | 终验 final-verification.md；主控职责（§0.4/§2.6/§4.1） | 主控补 progress.md / decisions.md / report.md，并把独立复跑 AC-09/13/12 的结果写进 report §4 与 progress | 本目录三份收口文档 |
| DR-07 | AC-12 真实宿主面阻塞，本机三方观测穷尽无目标 CLI；不满足无条件 Done | §4.5「阻塞不是结项合法状态」；D-4 未取证 | 判「条件性 PASS」：除 AC-12 外全 Done；AC-12 需用户在取证机器补测或书面豁免；不把 mock 写成真实、不宣布无条件结束 | 最终汇报第7项「待用户处理」；report §5 遗留 |
| DR-08 | 全量测试非全绿（1983/1963/17 fail，均旧用例；wp16 无红） | 终验实跑；AD-06；P-6 基线 1947/1923/21 | 按「新增红差集 0」判门禁通过，如实标注全量非全绿与旧用例既有失败形态，不放宽 wp16 判据 | report §4/§5；final-verification 第4项 |
