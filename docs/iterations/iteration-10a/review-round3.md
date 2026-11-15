# I1.10a 需求评审 · 第 3 轮（独立评审 · v3 新增发布面）

- 评审对象：`docs/iterations/iteration-10a/requirement.md`（版本 **v3**，1388 行；v3 新增 §2.16、BR-33~BR-39、AC-38~AC-44、NF-8~NF-10、U-13~U-17、D-15）
- 评审范围：**仅 v3 新增部分**（发布面）。v2 的 AC-01~37 已于 `review-round2.md` PASS 并经 S3/S4 收口，本轮不重开；只核对「新增条款是否破坏既有判据」。
- 判据：`docs/index.md`（§1.3 App 形态与「桌面应用可独立完成日常操作」、`#### I1.10a` 范围、`#### I1.10b`/`I1.11` 范围外归属、675 行「真实面不得降级为静态文件存在」、710 行第 3 条）+ `docs/templates/requirement-template.md`（8 节 + 三条用户视角硬约束）+ 参考实现 `xueshuaihui/agent-task-board`（已实测跑通，见 §3.1）
- 评审人立场：不采信文档自述的「已完成/可执行」，每条 AC 的机检命令都**实跑一次**；每条关于本机与远端的事实都**实测取证**；不把「参考项目能跑」当作「本仓能跑」。

---

## §0 总判

**FAIL** — 阻断 **5** 项（F-20 / F-21 / F-22 / F-23 / F-26）、建议 **4** 项（F-24 / F-25 / F-27 / F-28）。

| 维度 | 结论 | 依据 |
|---|---|---|
| 规划符合性（新增能力是否该在本迭代） | **通过** | 发布能力是 §1.3「用户机器上不需要预装运行时、双击可用」的兑现前提；`docs/index.md` 710 行把「桌面壳 CI 构建」列为本机保留项，本轮按主控裁决转为需求（用户指令原文：「如果没有需要先补充相关需求」） |
| 罗列全面性 | **通过** | 触发通道 / 产物集合 / 校验和 / 通道判定 / 试跑 / 幂等 / 门禁 / 版本单点 / 开箱即用 九个面各有 BR 与 AC，无孤儿 BR（§2.1） |
| AC 可构造性 | **不通过（5 阻断）** | 三条机检命令不可执行或自相矛盾（F-21 / F-22 / F-23）、一条对 Windows 产物无判定定义（F-20）、一条把未交付脚本当既有工具（F-26） |
| 与本机事实一致性 | **不通过（1 阻断）** | Windows 侧壳层为 Unix-only 实现，需求未登记该缺口，导致 AC-39/AC-44 在 CI 上的首个失败点被隐藏（F-20） |
| 与既有 AC 自洽性 | **通过** | AC-01~37 判据零改动；NF-8 显式要求差集仍为 0；§1.3 原有 11 项范围外一条未删（§2.2） |
| 模板合规 | **通过** | 8 节齐全、三条用户视角硬约束满足、编号连续（AC 44 / BR 39 / NF 10 / U 17 / D 15）（§5） |

判定纪律：**v3 不进入 S1 拆分**。F-20~F-23、F-26 必须写回需求（预计升 v4）后重审；F-24/F-25/F-27/F-28 可作为建议在同一次修订内一并处理。

---

## §1 上轮结论复核（v2 收口事实未被动摇）

| 检查点 | 证据 | 结论 |
|---|---|---|
| AC-01~37 判据是否被改动 | `git diff 96f00cb..HEAD -- docs/iterations/iteration-10a/requirement.md` 只新增、`**AC-0`/`**AC-1`/`**AC-2`/`**AC-3[0-7]` 段零删除 | 未改动 |
| AC / BR / NF 编号连续性 | 实跑脚本（§5 扫描 1）：AC 44 条 `AC-01`~`AC-44`、BR 39 条 `BR-01`~`BR-39`、NF 10 条 `NF-1`~`NF-10`，均连续无重号 | 通过 |
| v2 终验效力 | `final-verification.md` 已加「适用范围收窄到 AC-01~37」声明；生成模板 `probe/acc10-f-final.mjs` 同步 | 通过 |
| §1.3 原有范围外条目 | 11 条全部保留，v3 在其后追加 3 条（Developer ID/公证、Windows 真机安装、Universal/Linux/auto-update） | 通过 |

---

## §2 规划符合性与覆盖

### 2.1 九面覆盖表（新增 BR → AC 双向）

| 面 | BR | AC | 反向（AC → BR） |
|---|---|---|---|
| 推 tag 即发布、零个人凭据 | BR-33 / BR-35 / BR-39 | AC-38 | AC-38 → BR-33/35/39 ✓ |
| 三平台产物 + 校验和 | BR-34 / BR-38 | AC-39 | AC-39 → BR-34/38 ✓ |
| 门禁与冒烟前置 | BR-37 | AC-40 | AC-40 → BR-37 ✓ |
| 通道判定与版本单点 | BR-35 / BR-34 | AC-41 | AC-41 → BR-35/34 ✓ |
| 试跑草稿 | BR-36 | AC-42 | AC-42 → BR-36 ✓ |
| 幂等与重跑 | BR-37 / BR-39 | AC-43 | AC-43 → BR-37/39 ✓ |
| 开箱即用 | BR-38 / BR-02 / BR-34 | AC-44 | AC-44 → BR-38/02/34 ✓ |

**无孤儿 BR**：BR-33~39 每条至少被一条 AC 引用（实跑 `grep -o 'BR-[0-9]\+'` 统计，见 §5 扫描 3）。

### 2.2 反向扫描：v3 新增内容是否夹带范围外的实现承诺

| 新增段 | 是否越界 | 说明 |
|---|---|---|
| §2.16「预期效果/异常情况」 | 否 | 全部是用户可见结论（能下载到什么、看到什么标记） |
| AC-38~44 的 Then | 否 | 均为用户视角句子；实现级表述只出现在「机检/架构检查」，符合模板「Then 不写实现」约束 |
| D-15 | 否 | 已显式标注「不进入验收判定」，且与 §3.1 无交叉引用 |
| §1.2 第 7 条（成功衡量） | 否 | 可观测（Releases 页出现条目、能下载到对应包） |

**无越界**。v3 未把 Linux 产物、自动更新、公证、真机安装纳入判定，与 §1.3 新增的 3 条范围外自洽。

---

## §3 与本机 / 远端事实的一致性（实测）

### 3.1 参考实现可跑通（已核）

| 检查 | 命令 | 结果 |
|---|---|---|
| 参考仓 release 数 | `GET /repos/xueshuaihui/agent-task-board/releases` | 18 个，含 `*_x64.dmg` / `*_arm64.dmg` / `*_x64-setup.exe` / `SHA256SUMS.txt` |
| runner 矩阵 | `grep runs-on` | `macos-15-intel` / `macos-15` / `windows-latest` |
| 签名与镜像 | `grep codesign\|hdiutil` | ad-hoc 签名 + `--verify --deep --strict` + `hdiutil create` 重出 dmg |
| 本机工具链 | `command -v hdiutil` / `codesign --verify --deep --strict Maestro.app` | `/usr/bin/hdiutil`；严格验签 **exit 0** |

> 结论：D-15 所述链路可信；AC-44 要求的 `codesign --verify --deep --strict` 在本仓现有 ad-hoc 产物上**实测 exit 0**，不是不可达判据。

### 3.2 本仓远端现状（v3 的出发点）

| 检查 | 结果 |
|---|---|
| `GET /repos/xueshuaihui/Maestro/releases` | **0** |
| `GET /repos/xueshuaihui/Maestro/tags` | **0**（本地亦 0） |
| `GET /actions/workflows` | **`total_count=0`** |
| `GET /actions/runs` | **`total_runs=0`**（Actions 从未运行过） |
| `GET /contents/.github` | **404** |
| 仓库属性 | `private:false`、`default_branch:main`、`permissions.push:true` |

> 结论：v3 描述的是**从零建立发布通道**，不是修补既有流水线。这意味着 AC-38~43 的首次真实取证同时承担「验证 + 建通道」两件事，任何一次 CI 失败都要算作 S2 未完成，不能算「环境问题」。

### 3.3 **阻断事实：Windows 侧壳层当前不可编译**（F-20 依据）

| 文件:行 | 内容 | 影响 |
|---|---|---|
| `desktop/src-tauri/src/spawn.rs:7` | `use std::os::unix::net::UnixStream;` | Windows 上无此模块，`cargo build` 直接编译失败 |
| `desktop/src-tauri/src/spawn.rs:64/104/112` | `UnixStream::connect(...)` 三处 | 同上 |
| `desktop/src-tauri/src/spawn.rs:148` | `Command::new("/bin/kill")` | Windows 无 `/bin/kill` |
| `desktop/src-tauri/src/spawn.rs:137` | 管道路径 `<root>/.orch/core.sock` | Windows 核心监听的是 `\\.\pipe\maestro-<sha256(...)>`（`src/persistence/paths.js:135-142`），端点形态不同 |

同时确认可用的替代面：

- `src/daemon/server.js:410-416` 的 `.orch/core.json` 内含 `pipeName`，但 **409 行明确写着「客户端禁止据此决定连接地址」**——壳层不能读它来连管道。
- `src/daemon/http/routes.js:310/317` 已有 `GET /instances`，桌面 HTTP 通道（`.orch/desktop.json` 的 `port`+`token`）完全跨平台。

> 结论：AC-39/AC-44 要求 Windows 安装包，但需求 §3.3 的前置条件只写 macOS，**没有登记「壳层需新增 Windows 分支」这个真实工作量与风险**，也没说明「本机无法产出/验证 Windows 二进制，唯一证明面是 CI」。这是本轮最严重的可构造性缺口——不写进需求，S2 一定在第一次 CI 上撞墙。

**实测补充（评审期间实跑 `cargo check --target x86_64-pc-windows-msvc`，共两轮，耗时 22m42s + 增量）**：

| 轮次 | 结果 | 阻断点 |
|---|---|---|
| 第 1 轮 | `exit 101` | `tauri-build`：`` `desktop/src-tauri/icons/icon.ico` not found; required for generating a Windows Resource file `` |
| 第 2 轮（补 ico 后） | `exit 101` | `tauri-winres-0.3.7` panic：`NotAttempted("llvm-rc")`（本机无 `llvm-rc`、未装 LLVM toolchain） |

> 修正本轮初稿的判断：我原以为「本机可用 `cargo check` 做 Windows 语法级预演」，**实测不成立**。Windows 侧在本机完全无法预演，唯一证明面是 `windows-latest`。这一条必须写进需求（F-20 的 (d) 项已据此改写）。


### 3.4 版本号分布（F-21 依据）

```
package.json:3                     "version": "0.1.0"
desktop/src-tauri/Cargo.toml:3     version = "0.1.0"
desktop/src-tauri/tauri.conf.json:4  "version": "0.1.0"
scripts/desktop/build.mjs:150      CFBundleShortVersionString ... 0.1.0
scripts/desktop/build.mjs:151      CFBundleVersion ... 0.1.0
```

`Cargo.toml` 的 `version` 是 **cargo 必需元数据**（不可省略、不能为空），因此 AC-41「除唯一来源外零命中」按字面**无法达成**。

---

## §4 机检命令可执行性（逐条实跑）

| AC | 机检命令 | 实跑结论 |
|---|---|---|
| AC-38 | `grep -REn "secrets\.[A-Z]" .github/` 零命中 | **不可执行**：GitHub Actions 上传 Release 的通行写法是 `secrets.GITHUB_TOKEN`；若按此实现必然命中。需允许 `${{ github.token }}` 或 `permissions:` 声明（F-22） |
| AC-39 | `grep -REn "universal\|fat-binary" .github/ scripts/` 零命中 | **自撞**：为解释「为何不做跨架构装配」必然在注释里出现该词；且 `grep -RE` 用的是 ERE，`\|` 是字面竖线而非交替（F-23） |
| AC-40 | 断言「门禁在打包之前、冒烟在上传之前」 | 可执行（对 workflow 静态结构断言），但「构造一次故意失败的试跑」成本极高且会在 Actions 留红记录；需给出可执行的最小失败构造方式（F-24） |
| AC-41 | `grep -REn "0\.1\.0" <四文件>` 除唯一来源外零命中 | **不可执行**：见 §3.4，`Cargo.toml` 无法免写版本（F-21） |
| AC-42 | `node probe/acc10-release-verify.mjs <dryrun-tag> --check draft` | 脚本尚不存在，需求把它当既有工具（F-26） |
| AC-43 | `node probe/acc10-release-verify.mjs <tag> --check idempotent` | 同上 |
| AC-44 | `codesign --verify --deep --strict` + 镜像挂载后复验 | macOS 侧**实测可执行**（§3.1）；但 **Windows 侧无任何可自动化的判定定义**（NSIS 安装流程被 §1.3 列为范围外，那 AC-44 的 Windows Then 靠什么判？）（F-20 的连带项） |

补充：本机 `makensis` 不存在（`command -v makensis` 空），Windows 安装包**无法在本机产出**，只能在 `windows-latest` 上产出——这一点需求同样未登记。

---

## §5 模板合规与机械扫描

扫描 1（编号连续性，实跑）：

```
AC 44 条 / AC-01..AC-44 连续 = true
BR 39 条 / BR-01..BR-39 连续 = true
NF 10 条 / NF-1..NF-10   连续 = true
```

扫描 2（AC 三件套完整性）：AC-38~44 每条均含 场景类型 / 风险 / 引用 / Given / When / Then / 机检 / 夹具 / 架构检查 九项，**7/7 完整**。

扫描 3（BR 双向覆盖）：`BR-33`~`BR-39` 在 AC 段落中出现次数分别为 1/1/1/1/1/2/2，**无孤儿 BR**。

扫描 4（模板三条用户视角硬约束）：

| 约束 | 结论 |
|---|---|
| Then 只写用户可观测结果，不写实现 | 通过（实现级表述全部在「机检/架构检查」） |
| 每条 AC 有可执行机检 | **不通过**（F-21 / F-22 / F-23 / F-26） |
| 边界说明写清「不做什么」 | 通过（§2.16 边界说明 + §1.3 三条新增范围外） |

扫描 5（BRE 残留）：全文 `\|` 仅出现在 §4 的禁令说明与 AC-39 架构检查的 ERE 中，**无 BRE 可执行锚点**。

---

## §6 修复清单

### 阻断（必须修，修完重审）

**F-20 · Windows 侧可构建性缺口未登记**
- 位置：§3.3 验收前置条件（869 行起）、AC-39（790 行）、AC-44（845 行）
- 问题：壳层 `spawn.rs` 为 Unix-only（§3.3 证据），需求只写 macOS 环境，读者会以为「本机能做全部 AC」。实际：Windows 产物**只能**在 CI 产出，且需要壳层新增 `#[cfg(windows)]` 分支（IPC 端点形态不同：Unix socket vs 命名管道）。
- 要求：§3.3 增「跨平台构建前置条件」段，写明（a）Windows 二进制无法在本机产出/验证，唯一证明面是 `windows-latest`；（b）允许为 Windows 新增条件编译分支，**Unix 路径行为必须逐字不变**；（c）Windows 侧自动化冒烟只覆盖「解包后可执行 + 启动探针 ready + 无凭据 401」，NSIS 安装流程属人工核验；（d）`icons/icon.ico` 由打包脚本生成、不提交二进制，并如实登记本机实测的两级阻断（缺 ico / 缺 `llvm-rc`），**不得把「cargo check 预演」写成可用证据**。

**F-21 · AC-41 版本单点机检不可执行**
- 位置：AC-41 架构检查（820 行）
- 问题：`Cargo.toml` 的 `version` 是 cargo 必需字段，无法「零命中」。
- 要求：改为三句可执行断言：① `package.json` 是唯一字面量来源（`grep -c '"version"' package.json` == 1）；② `Cargo.toml` / `tauri.conf.json` 的值**必须等于** `package.json` 的值（`node -e` 比对，非 grep）；③ 产物文件名与包内元数据由同一来源派生（构建脚本读 `package.json`，不得再写字面量：`grep -REn '0\.1\.0' scripts/desktop/` 零命中）。同时裁决 U-13。

**F-22 · AC-38 凭据机检与 GitHub 通行写法冲突**
- 位置：AC-38 机检与架构检查（788 行）
- 要求：明确「允许且仅允许 `${{ github.token }}` 与 workflow 级 `permissions:` 声明」，把机检改为 `grep -REn 'secrets\.' .github/` 零命中（连 `GITHUB_TOKEN` 都不走 `secrets.`），并补一条正向断言「存在 `permissions:` 块且只含 `contents: write`」。

**F-23 · AC-39 架构检查自撞 + ERE 写法错误**
- 位置：AC-39 架构检查（799 行）
- 问题：`grep -REn "universal|fat-binary"`（ERE 下 `|` 才是交替，`\|` 是字面量）且解释性注释必然命中。
- 要求：改为禁**具体装配动作**：`grep -REn "lipo|--target universal-apple-darwin|--target universal2-apple-darwin" .github/ scripts/` 零命中；并在需求里注明「注释中解释性的『不做跨架构装配』不算命中」（判定口径写明即可）。

**F-26 · 把未交付脚本当既有工具**
- 位置：AC-38/39/40/41/42/43 机检（788/799/810/820/831/843 行）
- 问题：`probe/acc10-release-verify.mjs` 在 S2 之前不存在；需求用「运行它」作判据，等同预设交付物已存在。
- 要求：在 §2.16 或 D-15 增一句「本迭代交付 `probe/acc10-release-verify.mjs`，其为只读 REST 校验器；**它只能读取远端事实，不得写死期望值**；其自身正确性由 `release-contract.test.js` 对它做纯函数单测（给定响应体 → 给定判定）覆盖」。并把「凭据不入证据」写成机检：`grep -REn 'ghp_\|github_pat_' docs/iterations/iteration-10a/evidence/` 零命中。

### 建议（可与阻断项同批修）

**F-24 · AC-40 的「故意失败试跑」成本与判定点**
- 建议：明确「失败构建的判定点 = 该 run 未创建/未更新 Release，且 Release 资产数在 run 前后相等」；失败构造允许两次实现任选一次（本地 `act` 不可用时不强制），但**至少要有一条真实红色 run 的原始帧**，否则该 AC 判 `阻塞` 而非 `通过`。

**F-25 · AC-39 未点明安装包格式**
- 建议：AC-39 Then 补「macOS 为可挂载磁盘映像（`.dmg`），Windows 为可执行安装程序（`.exe`）」，与 AC-44 的「挂载安装包」严格对齐。

**F-27 · 试跑的并发组会互相取消**
- 建议：D-15 补一句「试跑通道的并发组必须与 tag 通道区分（否则同名 ref 的两次试跑会互相取消）」。

**F-28 · AC-42 草稿清理的可验证性**
- 建议：把「删除动作留证」写成机检（删除后 `GET /releases` 中该 tag 计数为 0，且该 REST 响应落证据），避免「查不到 = 没发过」。

---

## §7 待裁决项（U-13 / U-14 / U-16 / U-17）建议

| 项 | 建议裁决 | 理由 |
|---|---|---|
| **U-13** 版本单点 | **`package.json` 为唯一来源**；`Cargo.toml` / `tauri.conf.json` 的值必须与它相等（由契约测试断言）；产物名与 Info.plist 由构建脚本读它派生。**tag 与包版本不强制数字相等**，但 tag 必须 annotated 且正文写明对应版本，产物名里出现的是包版本 | 构建脚本本来就是 Node 进程，读 `package.json` 零成本；`tauri.conf.json` 作单点会要求 Node 脚本去解析 JSON5 配置，反而多一层；cargo 必需字段的客观限制使「零字面量」不可行，只能「值相等 + 单一派生源」 |
| **U-14** `v1+` 真机门禁 | **不设自动门禁**，但 `v1.0.0` 及以上的 tag 必须在正文列出人工核验清单（真机安装 × 2 平台、Gatekeeper、SmartScreen），发布前由维护者签字确认；本迭代不为它写 AC | 自动门禁无法验证真机安装（§1.3 已排除），硬写会造出「假通过」的判据 |
| **U-16** Windows 签名 | **不签名**（无证书），以「可安装程序」为唯一判据；SmartScreen 引导属人工核验 | 与参考项目一致；签名会在无证书时引入不可满足的前置 |
| **U-17** 打包路径 | **保留手工脚本 + 补安装包生成**（不切 tauri-bundler） | 本仓 `dependencies` 必须为 `{}`、界面零 npm 包；切 tauri-bundler 需 `@tauri-apps/cli`（devDependency），触碰 BR-22 红线的解释成本更高。手工脚本在本机已实测产出可验签的 `.app`（§3.1），补 `hdiutil` 出 dmg 与 `makensis` 出 exe 即可 |

---

## 附：本轮实跑命令清单

```bash
# 1. 远端事实
curl -s --noproxy '*' -H "Authorization: Bearer $PAT" https://api.github.com/repos/xueshuaihui/Maestro/releases      # []
curl -s --noproxy '*' -H "Authorization: Bearer $PAT" https://api.github.com/repos/xueshuaihui/Maestro/tags           # []
curl -s --noproxy '*' -H "Authorization: Bearer $PAT" https://api.github.com/repos/xueshuaihui/Maestro/actions/workflows  # total_count=0
curl -s --noproxy '*' -H "Authorization: Bearer $PAT" "https://api.github.com/repos/xueshuaihui/Maestro/actions/runs?per_page=1"  # total_runs=0

# 2. 本机工具链与判据可达性
codesign --verify --deep --strict desktop/src-tauri/target/release/bundle/macos/Maestro.app   # exit 0
command -v hdiutil        # /usr/bin/hdiutil
command -v makensis       # 空（Windows 安装包只能 CI 产出）
rustup target list --installed   # x86_64-apple-darwin, x86_64-pc-windows-msvc

# 3. 壳层平台缺口
grep -rn "std::os::unix\|UnixStream\|/bin/kill" desktop/src-tauri/src/    # spawn.rs:7/64/104/112/148
grep -n "pipeName" src/daemon/server.js | head                            # 409 行「客户端禁止据此决定连接地址」；410-416 写入 core.json
grep -n "pattern: '/instances'" src/daemon/http/routes.js                  # 310 / 317

# 4. 版本号分布
grep -rn "0\.1\.0" package.json desktop/src-tauri/Cargo.toml desktop/src-tauri/tauri.conf.json scripts/desktop/build.mjs
```

---

**评审结论：FAIL（5 阻断 / 4 建议）**。v3 的**能力定义与规划一致、覆盖全面、模板合规**，问题全部集中在「机检可执行性」与「Windows 面的事实缺口」两类，属可修的表述级与判据级缺陷，不涉及能力范围变更。修完升 v4 后进入 S1 拆分。
