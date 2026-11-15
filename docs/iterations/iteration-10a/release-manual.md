# Maestro 发布手册（I1.10a v4 发布面）

> 适用范围：`docs/iterations/iteration-10a/requirement.md` v4 的 AC-38~AC-44。
> 实现：`.github/workflows/release.yml` + `scripts/desktop/{version,build,gate,package-mac,package-win,smoke}.mjs` + `probe/acc10-release-verify.mjs`。

---

## 0. 两条通道

| 通道 | 触发 | 产物可见性 | 用途 |
|---|---|---|---|
| 正式 | `git push origin vX.Y.Z` | Releases 页公开 | 对外分发 |
| 试跑 | Actions 页 **Run workflow** | **草稿，访客看不到** | 正式打 tag 前验证流水线 |

- 正式通道：`v0.*` 一律标**预发布**，`v1.0.0` 起标**正式版**。
- 试跑通道：草稿 tag 名 `dryrun-<sha7>`，**刻意不以 `v` 开头**——否则会再次命中 `push.tags: v*` 形成自我触发循环。
- 两条通道的并发组不同名（`release-<tag>` / `dryrun-<ref>`），互不取消。

---

## 1. 正式发版

```bash
# 1) 确认版本号（唯一来源 = package.json 的 version）
node -e "import('./scripts/desktop/version.mjs').then(m => console.log(m.assertAligned()))"

# 2) 打 annotated tag 并推送（正文写明包版本与已知限制）
git tag -a v0.1.0 -m "v0.1.0 · 包版本 0.1.0
已知限制：ad-hoc 签名（首次打开可能需手工放行）；Windows 包未签名（SmartScreen 会拦一次）"
git push origin v0.1.0

# 3) 等 Actions 三个 job 全绿 → Releases 页出现该版本
```

构建矩阵：`macos-15-intel`（x64 dmg）/ `macos-15`（arm64 dmg）/ `windows-latest`（x64 setup.exe）。

产物命名（带版本与架构）：

```
Maestro_<version>_x64.dmg
Maestro_<version>_arm64.dmg
Maestro_<version>_win-x64-setup.exe
SHA256SUMS.txt
```

---

## 2. 试跑与清理

```bash
# Actions 页 → Release → Run workflow（分支选 main）
# 跑完后草稿只在“包括草稿”视图里可见；正式 Releases 页条数不变

# 验证完清理（tag 一并删掉）
gh release delete dryrun-<sha7> --cleanup-tag --yes
```

清理后必须复核「真的没了」：

```bash
node probe/acc10-release-verify.mjs dryrun-<sha7> --check absent
```

### 2.1 真实 tag 取证后的清理（2026-11-15 实做）

为 AC-38 / AC-41 取真实面时推过一个临时 `v0.0.1`（用完即删），完整动作与响应：

```bash
# 1) 删前先抓一份 REST 快照（双向留证的前一半）
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/releases?per_page=30" -o /tmp/pre-releases.json

# 2) 删草稿、删正式 Release、删 tag ref —— 三步都应返回 204
curl -X DELETE .../releases/<draft-id>    # 204
curl -X DELETE .../releases/<release-id>  # 204
curl -X DELETE .../git/refs/tags/v0.0.1   # 204

# 3) 删后复抓（双向留证的后一半）+ 两遍 absent
curl -sS ... /releases?per_page=30 -o /tmp/post-releases.json   # 条数 0
curl -sS ... /git/ref/tags/v0.0.1                                # 404
node probe/acc10-release-verify.mjs v0.0.1 --check absent
node probe/acc10-release-verify.mjs dryrun-<sha7> --check absent
```

**为什么要留两半**：只留「删后查不到」无法区分「发过并已清理」与「根本没发过」。删前响应体（含
`draft` / `prerelease` / 四项资产名与字节数）+ 删后空集 + 三次 204 写进同一个
`evidence/release/verify-absent.json`，才是 AC-42 要求的双向证据。`gh release delete --cleanup-tag`
等价，但不会留下删前响应体。

---

## 3. 只读校验（取证用）

```bash
# 该 tag 的 Release 存在且不是草稿
node probe/acc10-release-verify.mjs v0.1.0 --check publish

# 四件资产齐全 + 本地对账（--dir 指向下载目录）
node probe/acc10-release-verify.mjs v0.1.0 --check assets --dir ./download

# 预发布标记与 tag 前缀一致
node probe/acc10-release-verify.mjs v0.1.0 --check channel

# 同名 Release 只有一个且资产齐全
node probe/acc10-release-verify.mjs v0.1.0 --check idempotent

# 试跑草稿确实对访客不可见（需给出清理前的正式条目数）
node probe/acc10-release-verify.mjs dryrun-<sha7> --check draft --baseline 0
```

凭据由 `git credential fill` 现取，**只进 Authorization 头，不打印、不落证据**。

---

## 4. 失败处理

| 现象 | 判定 | 处理 |
|---|---|---|
| 门禁红 | 该次不产生任何可下载资产（AC-40） | 看 `gate.mjs` 输出的失败项；**不得**用跳过参数绕过 |
| 单个平台红 | 另两平台产物保留，但汇总发布不创建 Release（NF-10） | 修好后**重跑同一 workflow**，同名 Release 会被覆盖式补传而不是新建（AC-43） |
| 冒烟红（应用起不来/401 失效/验签失败） | 同上，不出包 | 本地复跑 `node scripts/desktop/smoke.mjs --app <app> [--dmg <dmg>]` 复现 |
| Windows job 编译失败 | 属**真实缺陷**，不是环境问题 | 需求 §3.3 已写明 Windows 面唯一证明面是 CI；本机无法预演（缺 `llvm-rc`），红一次改一次 |
| 试跑看起来"莫名失败" | 大概率是并发组撞了 | 本版本已把两条通道分组；确认用的是最新 workflow |

---

## 5. 人工核验清单（不自动化，不计入 AC 自动通过数）

首次正式发版（`v1.0.0` 起）前，逐项人工确认并在 tag 正文签字：

- [ ] macOS Apple Silicon 真机：下载 dmg → 挂载 → 拖入应用目录 → 双击能开（可能需「系统设置 → 隐私与安全性 → 仍要打开」一次）
- [ ] macOS Intel 真机：同上
- [ ] Windows 真机：运行 setup.exe → 安装完成 → 开始菜单启动 → SmartScreen 首次拦截时按「更多信息 → 仍要运行」
- [ ] 三个平台安装后均停留在**实例列表**页，无需预装 Node / Rust
- [ ] 卸载路径可用（Windows：`Uninstall.exe`；macOS：删除 .app）

**明确不在自动化范围**：Developer ID 签名、Apple 公证、Gatekeeper 无拦截放行（需求 §1.3 范围外、附录 B 的 U-15）。

---

## 6. 已知限制

1. **仅 ad-hoc 签名**：macOS 包验签能过，但换机器首次打开仍可能被 Gatekeeper 拦一次；没有公证。
2. **Windows 包未签名**：无证书，SmartScreen 会拦一次（U-16 已裁决）。
3. **只出 x64 / arm64 两个 macOS 架构与 win-x64**：不做跨架构合成，无 Linux 包，无自动更新（§1.3 范围外）。
4. **版本号只改一处**：`package.json`。`Cargo.toml` / `tauri.conf.json` 必须同步改成同一个值（`release-version.test.js` 会挡）。
5. **本机不能产出 Windows 包**：`makensis` 与 `llvm-rc` 都不在本机，`package-win.mjs` 在非 Windows 平台会**显式报错退出**。

---

## 7. 首次真实运行踩到的坑（2026-11-15，全部已修进脚本）

| 现象 | 根因 | 现在的处置 |
|---|---|---|
| Windows job 在「生成安装包」exit 1：`未找到 makensis` | windows-latest **预装** NSIS，但不在 `PATH`（实际在 `C:\Program Files (x86)\NSIS\makensis.exe`） | `package-win.mjs` 的 `resolveMakensis()` 先试 PATH，再探测 `ProgramFiles` / `ProgramFiles(x86)` / `ProgramW6432` 下的 `NSIS` 目录；工作流另加一步「准备 NSIS」（已预装则跳过，否则 `choco install nsis`）。找不到仍**硬失败**。 |
| Windows 冒烟：应用能启动、ready 探针正常，但 10s 等不到 401（`desktop.json` 不出现） | 壳把子进程路径原样交给 `CreateProcess`，`\\?\` 逐字前缀被 Node 解析成盘符，daemon 启动即崩：`EISDIR: illegal operation on a directory, lstat 'C:'` | `spawn.rs` 的 `win_path_arg()`：剥 `\\?\`（含 `\\?\UNC\`）并统一正斜杠后再传给 node。daemon 的 stderr 现在落到 `<root>/.orch/daemon-spawn.log`，另在探针流写 `daemon-spawn` / `daemon-exit` 事件。 |
| macOS 门禁把 AC-04 判成意外失败 | gate 只读了历史 `baseline-failures.txt` 的 8 条，漏掉裁决 R-08 登记后的 9 条口径 | gate 内置 `ADJUDICATED_ALLOW`（AC-04），与 `probe/acc10-f-gates.mjs`、`regression.test.js` 同源。 |
| Windows 门禁 16 条红 | 既有测试面里平台敏感的断言（`lsof` / LF 逐字节 / POSIX 信号 / 时钟粒度） | `baseline-failures-win32.txt` 逐条登记 + 归因分类，**只在 win32 加载**；登记 ≠ 通过，新出现的失败照旧判红。 |
| 同一条真壳/托盘用例时而红、时而绿（x64 与 arm64 轮换命中） | 无头 runner 上真壳启动抖动（负载型 flake） | gate 对意外失败做**文件级**隔离复跑：确认通过记 flake 并打印名单，确认失败照旧判红；判红时回显该用例的 TAP 断言与堆栈。 |
| 本机 `git push` 到 github.com 不通（`Empty reply` / HTTP2 framing / 超时） | 本机网络对 github.com 的 smart-HTTP 隧道不稳，`api.github.com` 直连正常 | 用 Git Data API 重放提交（blob → tree → commit → PATCH ref）；判据以远端 `main` 为准，本地 sha 因时区写法不同而不等、tree 逐字相同。取日志/资产同样走 REST。 |

**排障顺序建议**：先看 `gate.mjs` / `smoke.mjs` 的 PASS/FAIL 逐项输出 → 冒烟红且症状是「ready 正常但 401 等不到」时，直接看 `<root>/.orch/daemon-spawn.log` 与探针流里的 `daemon-spawn` / `daemon-exit` 事件，不要先怀疑核心逻辑。
