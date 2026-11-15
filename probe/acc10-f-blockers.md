# I1.10a S3 · 缺陷 / 偏差台账（acc10-f-blockers.md）

> 生成时刻 2026-11-15T14:07:42.846Z · HEAD `2ee6d2c` · 逐 AC 44 条 · 结论 44 通过 / 0 不通过 / 0 阻塞。
> 本台账由 `node probe/acc10-f-final.mjs` 重建；判据原文见 `docs/iterations/iteration-10a/requirement.md` §3.1。

## ① 逐 AC 未通过项

**无**：44/44 条 AC 判定为「通过」，0 不通过、0 阻塞。

## ② 已知基线项（不由 S3 修，判定基线 9 条）

- `AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新`
- `task-loop 审核提示词给绝对路径：基址与 readReview 同源，避免宿主写进实例工作区`
- `core.stop：先回包再断连，5s 内收敛，core.json 仍可读`
- `main：--cwd 相对当前 shell 目录解析，不作为项目根`

全量失败集合与判定基线 **9 条** 差集 = **0**。历史 `docs/iterations/iteration-7/baseline-failures.txt` 物理 8 条不改；裁决 R（R-08）把 AC-04 时序竞态登记为允许项，构成第 9 条。

## ③ 环境偏差（如实登记，不伪造零命中）

- **AC-05 / AC-11**：需求架构检查原文为 `grep -R ... desktop/`。本机已构建 Tauri bundle，`desktop/src-tauri/target/release/bundle/**/Resources/src/**` 内是产品源码副本，按原文扫描会命中（非界面层代码）。处置：原文形态**留证**，判定改用界面层作用域 `desktop/ui/ desktop/harness/` 零命中（ERE），不放宽断言、不改需求。原始输出见 `evidence/AC-05/arch-*.log`、`evidence/AC-11/arch-*.log`。
- **AC-04**：需求原文 `renderInstanceUnreadable`；实现导出名为 `renderListUnreadable`（`desktop/ui/list/list.js`）。属需求措辞与实现命名差异，文案复用语义一致，登记为观察项，不改产品、不改断言。
- **R-08 时序竞态的物理根因（S3 实跑定位）**：`instance-list.test.js`（AC-03 / AC-04）在**剥离 `NODE_OPTIONS`** 的环境下 AC-04 触发 `assert.equal(newRow.phase, "running")` 实得 `completed`（整文件 1.7s / `# fail 1`）；保留本机默认 `NODE_OPTIONS` 预加载时同一整文件稳定 `2p/0f`（约 10.4s）。差异来自预加载改变 mock 宿主一轮完成速度，非断言缺陷。需求 §3.3 只强制 `NODE_ENV=test`，故逐 AC F-16 用默认环境；全量回归门禁仍按裁决 V 用 `env -u NODE_OPTIONS`，AC-04 作为 R-08 允许项留在判定基线 9 条（差集 0）。两种环境原始帧均留证，详见 `decisions.md` 裁决 Z 决定 2。
- **AC 级隔离机检（安全网）**：脚手架保留 `--test-name-pattern "<AC>"` 的 AC 级隔离机检（仍是 `test -f` + 单文件 `--test`，最多 3 次 attempt 全部留证），供「同文件多 AC 串扰」形态下按需求 §3.3 独立判定；本轮终版环境口径下未触发。
- **架构检查注释误判（脚手架自查修正）**：AC-10 / AC-26 / AC-33 初版扫描把「注释里声明禁止」的否定陈述当成命中；已改为只扫代码分支 / 引号内白名单成员 / `Math.` 运算，`acc10-f-gen.mjs --check` 44/44 逐字一致、架构命令预检 0 失败。不改产品代码与需求。

## ④ 复跑记录

无复跑：44 条 AC 的 F-16 机检均在第一次 attempt 达成（每次 attempt 原始 TAP 日志仍全部保留）。

## ⑤ 残留项（裁决 Y 后移 S3，本轮处置）

- **R-12**：AC-22 真实壳内拖拽仍为结构断言（写入端 `config.rs` 无窗口级自动化用例）。S3 单列证据等级 `mock 实测（结构断言）`，补 `view-state.test.js` + `config.rs` 路径常量结构证据，**不冒充真实宿主实测**；真实 DSH 取证仍属本机保留项。
- **R-13**：`bundleFreshness()` 与 `regression.test.js` 判据面一致，不为对齐削弱任一侧；S3 脚手架统一按「skip 必须写明需 `env -u NODE_OPTIONS npm run desktop:build`」执行。本轮壳面用例实测 **0 条 skip**（零 skip，产物时效门槛有效）。
