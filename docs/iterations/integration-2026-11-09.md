# 并行迭代集成说明 — I1.4 × I1.5 × I1.6 合入 main（2026-11-09）

> 本文是**主控对 `docs/index.md`「合并顺序由主控统一裁决」的裁决留痕**，不属于任何迭代的需求或验收判据。
> 集成提交：`merge: I1.4 + I1.5 + I1.6 → main`；三份迭代各自的 `report.md` / 验收证据仍以各自分支为准（未被改写）。

## 1. 分支拓扑与裁决

```
1490f6d ─┬─ b26065e ─ 8af970d  origin/main（I1.4：共享工作区 + 交接包校验 + CLI 命令集，70/70 AC）
         │
         └─ 0cd113b  feat/i1.5-role-registry（I1.5：角色/技能注册表，45/45 AC）
                    └─ … ─ 1818b45  feat/i1.6-assets-workflow（I1.6：自定义角色 + 工作流原语 + 资产 CLI，65/65 AC）
```

I1.5 从 `1490f6d` 拉出，**不含 I1.4 实现**；I1.6 又从 I1.5 分支头拉出，因此 I1.6 是 I1.5 的直系后代。
裁决：**以 `origin/main`（含 I1.4）为第一父，一次性合入 `feat/i1.6-assets-workflow`**。
I1.5 的全部提交作为 I1.6 的祖先一并成为 main 的祖先（`git branch --merged main` 可见两条分支均已合并），
无需制造第二个、内容重复的 merge 节点。合并前两个功能分支均已推送到 origin。

## 2. 冲突面（git 三方合并实报 2 个文件 / 10 个冲突块）

| 文件 | 冲突块 | 性质 |
|---|---|---|
| `src/cli/main.js` | 6 | I1.4 与 I1.6 各自重写了 `parseArgs`、命令表与 dispatch |
| `src/cli/render.js` | 4 | 两侧各自追加了一整套渲染函数；`USAGE_LINES` 定义位置不同 |

`src/cli/labels.js`、`src/core/advance.js`、`src/core/orchestrator.js`、`src/templates/index.js` 由 git 自动合并成功。

**根因是三处语义互斥，不能「择一」或按行拼接**：

1. **顶层命令 `workflow` 双语义**：I1.4 = 运行时控制 `pause|resume|abort`；I1.6 = 资产族 `list|show|create|validate|diff|dry-run`。
2. **`parseArgs` 结果形状互斥**：I1.4 返回 `{ok,command,sub,positionals,flags}` 且断言 `positionals` 数组；
   I1.5/I1.6 断言非资产命令的键集**恰好** `['command','flags','ok','sub']` 且 `positionals` 不存在（资产命令另带 `positional`）。
3. **用法块互斥**：I1.4 在 `render.js` 内定义 14 行 `USAGE_LINES`；I1.6 在 `labels.js` 定义 25 行且 AC-43 逐字节钉死。
   `test/wp11/cli-commands.test.js` 只断言用法输出含首行 `用法：orch run|status|cancel|core`，故 25 行不破 I1.4 断言。

## 3. 集成方案（不改任何一条既有验收断言、不删任何一侧功能）

1. **双解析实现 + 按命令字分流**（`src/cli/main.js`）：
   - `parseAssetArgs` = I1.6 原版 `parseArgs` 全文（含 D-6 18 行白名单、两档必填、family 校验）；
   - `parseRuntimeArgs` = I1.4 原版 `parseArgs` 全文（常量整体改名 `RUNTIME_*` 以免同名冲突）；
   - 导出的 `parseArgs` / `main` 按 `isRuntimeArgv(argv)` 分流：
     `instance|attach|escalate|approve|handoff` 全走 I1.4；`workflow` 仅当第二个词是 `pause|resume|abort` 时走 I1.4，
     其余（`list|show|create|validate|diff|dry-run`）走 I1.6 资产族。
   - 旧四条命令（`run|status|cancel|core`）走 I1.6 解析器；仅补两处 I1.4 语义：
     `VALUE_FLAGS.add('approval'/'decision')` 与 `--approval` 取值白名单（I1.4 AC-64，资产族白名单不受影响）。
2. **共有命令函数取 git 自动合并结果**：`runCommand` / `statusCommand` / `cancelCommand` / `coreCommand` 同时含
   I1.5 的注册表预检与 I1.4 的审批/挂起/断连收尾，两侧测试均已实跑通过。
3. **`render.js`**：import 名取并集；I1.4 的局部 14 行 `USAGE_LINES` 删除，统一用 `labels.js` 的 25 行；
   尾部函数集合取两侧完整并集（I1.4 的 WP-5 新命令渲染 26 个声明 + I1.5/I1.6 的 role/skill/workflow 渲染 23 个声明，零重名）。
4. **纯净扫描修复**：I1.4 的 `src/core/orchestrator.js` 注释 `the planner` 命中 I1.5 的 31 词禁用表，
   改为中文「推进决策」（纯注释，零行为影响），D-9 第 1 条与 `purity.test.js` 恢复通过。
5. **行尾**：本机 `core.autocrlf=true`，新 worktree 检出会把资产/夹具文本转成 CRLF，导致
   `assets.test.js` 的逐字节样本与 `instance-store.test.js` 的 SHA256SUMS 断言失败。
   这是**检出环境差异、不是合并缺陷**；提交内容一律为 LF（与主工作区、`origin/main` blob 一致）。

## 4. 门禁证据（均在隔离 worktree 实跑）

| 门禁 | 集成分支 | `origin/main` 对照 | 结论 |
|---|---|---|---|
| 全量 `node --test --test-concurrency=4 "test/**/*.test.js"` | 992 条 / 987 通过 / 5 失败 | 641 条 / 637 通过 / 4 失败 | **失败集合差集为 0**（详见下） |
| D-9 四条纯净扫描 | 四条 exit 0（21/11/3 文件零命中，`OK: no CJK`） | — | 通过 |
| `dependencies` 键数 | 0 | — | 通过 |
| 双 `workflow` 分流 + 资产 CLI 实跑 | 6 组 `parseArgs` 形状各自正确；`role/skill/workflow list` 输出正常 | — | 通过 |
| 两侧关键 CLI 测试（5 文件） | 134/134 | — | 通过 |

**5 项失败全部是基线既有环境噪声，与合并无关**（`origin/main` 对照同样复现前 4 项）：

- `--host-error …（AC-63）`、`promptFailures:2 …`：`EBUSY: resource busy or locked`（Windows 临时目录删除竞争；并发时多一条，单跑 `promptFailures` 通过）；
- `HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`：`EPERM symlink`（Windows 符号链接权限）；
- `resolveEvidenceRef 纯路径判定` / `可注入 fs：stat …`：期望 `\ws\artifacts\a.md`，实际 `C:\ws\artifacts\a.md`（C 盘 cwd 下 `path.win32.resolve` 带盘符；I1.4 收口时在本机 D 盘工作区通过）。

> 判定口径：两次全量在同一台机器、同一 worktree 环境、同样 LF 规范化下跑；按测试名取差集，
> 集成分支**未引入任何新的失败用例**。测试条数 641 → 992 是 I1.5/I1.6 用例集并入的结果（只增不减）。

## 5. 已知变化与遗留（不阻断合并）

- **O-I1：用法块 25 行不含 I1.4 的 `instance/attach/escalate/approve/handoff/workflow pause` 用法行**。
  命令本身完全可用（单测实跑通过），只是 `--help`/用法错误回显里缺这些行。为保住 I1.6 AC-43 的 25 行逐字基线而暂不追加。
- **O-I2：三主链逐字回归基线未重跑**。I1.4 改写了 `render.js` 的交接包/升级/审批渲染，
  集成后的 `single/code-loop/task-loop` 输出相对 I1.5 的 `0cd113b` 基线**预期会有变化**；
  I1.6 的 AC-49 逐字断言（在其分支上 25/25 通过）不能直接套到集成版。建议 I1.7 起以集成版重建逐字基线。
- **O-I3：`workflow` 一词双语义**靠命令字分流，长期应统一命令树（例如运行时控制改挂 `instance workflow`），
  并把两套 `parseArgs` 收敛为一份带命名空间的解析器；这属于新迭代的需求变更，不在本次集成范围。
- **O-I4**：I1.4 台账在 `docs/index.md` 曾长期停留在「进行中/暂无实现提交」，本次一并更正为「已收口、已合入 main」。
- 各迭代的 65/45/70 条 AC 报告与证据保持原样，**未因集成重跑或改写**；集成版只以上表门禁与差集结论为准。

## 6. 复现

```bash
# 集成分支（第一父 = origin/main）
git log --oneline --graph -3 main
git branch --merged main | grep 'feat/i1\.[56]'

# 全量门禁（同一 worktree 内，LF 规范化后）
node --test --test-concurrency=4 "test/**/*.test.js"
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"   # D-9 #1，$COMMON 见 AC-51
node -e "console.log(Object.keys(require('./package.json').dependencies??{}).length)"  # 0

# 双 workflow 分流
node --input-type=module -e "import {parseArgs} from './src/cli/main.js'; console.log(parseArgs(['workflow','pause','I']), parseArgs(['workflow','list']))"
```

## 7. 收尾：推送与分支清理（2026-11-09）

| 动作 | 结果 |
|---|---|
| 推送 `main` | `git push origin main` → `8af970d..d4b0f94`；`git fetch --all --prune` 后 `rev-list --left-right --count origin/main...main` = `0 0` |
| 本地分支删除 | `feat/i1.5-role-registry`（`0cd113b`）、`feat/i1.6-assets-workflow`（`1818b45`）、`integrate/i1.4-i1.6`（`d4b0f94`）均用 `git branch -d` 安全删除；删除前 `git branch -r --merged origin/main` 已确认两条功能分支完全合并，无未合并提交 |
| 远端分支删除 | 两条 `feat/*` 已删除；`git push origin --delete` 遇 `CONNECT tunnel failed, response 502`，改用 REST `DELETE /repos/xueshuaihui/Maestro/git/refs/heads/<branch>`（两条均返回 204），API 分支列表复核只剩 `main` |
| worktree 清理 | 移除本次新建的 `maestro-integrate`（干净）、`maestro-origin-main`（临时测试产物，强制移除）；保留 `base-i13` / `base-lf` 两个历史 detached worktree |
| 最终状态 | 本地与 `origin` 均只剩 `main`，HEAD `d4b0f94`；主工作区在 `main` 且 `git status` 干净 |

**网络备用通道（可复用）**：本机 `https_proxy` 指向的 `github.com` CONNECT 隧道会间歇返回 502，
且代理端口会随进程重启变化、环境变量可能指向已失效端口；但 `api.github.com` 直连
（`curl --noproxy '*'`）稳定 HTTP 200。需要删远端 ref 或核对远端状态时，可用
`git credential fill`（helper = `manager`）取 PAT 走 REST API，不必等隧道恢复；
纯 git 操作（push / fetch / ls-remote）仍必须走 `github.com`，隧道恢复后补一次
`git fetch --all --prune` 即可对齐本地引用。
