# WP-1 最短打包验证结论（裁决 B 一页）

> I1.10a WP-1（批次 2）· 裁决 B 硬动作：本包第一步完成「解释器 + `bin/` + `src/` 进
> bundle、双击可用」验证并落此一页结论。两条实现路径（① bundle 内解释器 /
> ② 编译进壳）按拆分 §1.1 选定 **路径 ①（bundle 内解释器，可选项 B）**，一次走通，
> 无需回退路径 ②，未触发「两路径都失败 → 需求修订」。

## 结论（一段话）

**选路径 ①（bundle 内自带 node 解释器）一次成功，全程未卡壳。** 构建命令
`npm run desktop:build`（= `scripts/desktop/build.mjs` 纯 Node 脚本：生成编译期占位
UI 与图标 → `cargo build --release` → 手写组装 `.app`（Info.plist/PkgInfo/资源复制）→
ad-hoc 签名）。解释器在构建期从本机 Node 22.22.2（`process.execPath`）复制进
`Contents/Resources/runtime/node`（112 MB，bundle 总 121 MB），运行时壳以**包内绝对
路径** spawn `runtime/node src/daemon/serve-entry.js --project <root> --desktop`
（裁决 A 入口），不读用户 PATH、不读 shell 配置；`bin/` 与 `src/` 复制进
`Contents/Resources/{bin,src}`。收窄环境（`env -i PATH=/usr/bin:/bin`、无
NODE_ENV/MAESTRO_* 变量）直接执行 `Contents/MacOS/maestro`（黄色警示 1 口径，禁
`open -na`）：launch → ready 实测 1077 ms（≤3000）、`tray-created`、daemon 子进程
`core.json` 落盘、ctl `tray-quit` → `quit(daemonStopped=true)` 全链成立。
**cargo 未配置任何镜像**：本机代理（HTTPS_PROXY）下 crates.io sparse index 与
crate 下载直连可用；首次 `cargo fetch + build` 实测约 42 min（461 crates，x86_64
release），此后增量构建约 60 s。签名 ad-hoc（`codesign --sign -`）通过，未涉及
notarization（本迭代不要求）；CSP 设为 null（壳仅加载本地占位页与回环 HTTP，
无远程内容），WebView 兼容性未遇问题，未触发 D-6 的 Electron 回退条款。

## 路径与命令

- **构建方式**：`cargo build` 直接驱动 src-tauri + `scripts/desktop/build.mjs` 手写
  bundling（未安装 tauri-cli，避免 `cargo install` 长耗时与 npm 依赖红线）。
- **构建命令**：`cd "$MAESTRO_REPO" && npm run desktop:build`
- **产物路径**：`desktop/src-tauri/target/release/bundle/macos/Maestro.app`
- **应用二进制**：`Maestro.app/Contents/MacOS/maestro`
- **bundle 结构**：
  ```
  Contents/MacOS/maestro                    cargo 产物（strip）
  Contents/Resources/runtime/node           本机 node 22.22.2 副本（112 MB）
  Contents/Resources/bin/orch.js            仓库 bin/ 复制
  Contents/Resources/src/**                 仓库 src/ 复制（daemon 入口在内）
  Contents/Resources/desktop/ui/**          存在时复制（WP-8 落地后自动进包）
  Contents/Info.plist / PkgInfo             手写（CFBundleExecutable=maestro）
  ```
- **编译期资源**：占位 UI（`target/ui-placeholder/index.html`）与窗口图标
  （`target/icon.png`）由 build.mjs 生成到 `target/` 内（gitignore 覆盖，不入库），
  `tauri.conf.json` 的 `frontendDist` / `bundle.icon` 指向二者——`src-tauri/` 下不
  产生任何超出 16 文件清单的仓库文件。

## 复现步骤

```bash
cd "$MAESTRO_REPO"
npm run desktop:build                                   # 构建产物 + ad-hoc 签名
ROOT=$(mktemp -d /tmp/maestro-i10a-bundle-XXXX); mkdir -p "$ROOT/ctl"
APP="$MAESTRO_REPO/desktop/src-tauri/target/release/bundle/macos/Maestro.app"
"$APP/Contents/Resources/runtime/node" -e "console.log('bundled-node-ok')"   # 包内解释器可执行
env -i PATH=/usr/bin:/bin HOME="$ROOT" TMPDIR=/tmp \
  "$APP/Contents/MacOS/maestro" --project "$ROOT" --probe "$ROOT/probe.jsonl" --ctl "$ROOT/ctl" &
# 轮询 $ROOT/probe.jsonl 出现 {"event":"ready",...}（实测 launch→ready ≈ 1.1s）
# 轮询 $ROOT/.orch/core.json 出现（daemon 子进程已起，pid 字段）
mkdir "$ROOT/ctl/tray-quit"   # 0 运行实例 → 直接退出，probe 出现 quit(daemonStopped=true)
```

机检承载：`test -f test/wp13/bundle.test.js && NODE_ENV=test node --test test/wp13/bundle.test.js`
（构建产物存在 + 包内 node 可执行 + `which node` 在 PATH=/usr/bin:/bin 下非零 +
收窄环境 spawn 壳 + ready ≤3000 + tray-created + open-instance 接缝 view=graph +
quit(daemonStopped=true)）。

## 实测数据

| 项 | 值 |
|---|---|
| bundle 总体积 | 121 MB（其中 node 解释器 112 MB） |
| 壳二进制 | strip 后 release 产物 |
| 首次 cargo 构建（含 fetch） | ≈42 min / 461 crates（x86_64，本机代理直连 crates.io，未配镜像） |
| 增量构建 | ≈60 s |
| launch → ready（收窄环境） | ≈1.1 s（判据 ≤3 s） |
| 签名 | ad-hoc（`codesign --sign -`），Gatekeeper 验证不属本迭代范围 |

## 途中修复的实现问题（不影响结论）

1. `libc = "0.3"` 在当前 crates.io 快照无 stable 版本（仅 1.0 alpha）→ 去依赖，改用
   `/bin/kill` 绝对路径发送 TERM/KILL（不触 PATH，AC-29 架构检查不受影响）。
2. tauri-build 编译期需要窗口图标 → build.mjs 纯 Node 生成 PNG 到 `target/`。
3. 项目根解析分支 `Ok(None)`（无任何根）误标 `instances` → 修正为
   `project-missing`（AC-31 现场一）。
4. `tauri-plugin-single-instance` 的 callback 运行在**主实例**而非第二实例 →
   `activated` 探针改从第二实例 argv 解析 probe 文件写入；主实例只激活窗口，绝不退出。
5. ctl watcher 的 `run_on_main_thread` 在部分场景下闭包丢失（rename 成功但 handler
   未执行）→ 改为 watcher 线程直调 handler（Tauri 2 窗口方法线程安全，内部自行
   dispatch 到主线程）。
6. AC-02 附加机检要求 `core.stop` 字面量位于 `pub fn quit` 8 行内（`-B8` 可见），
   初始实现相距 44 行 → 将停止帧构造上提至 `quit` 开头（4 行内），确认/停止/
   reap 流程拆入 `quit_after_confirm`；行为不变，机检「恰 1 条 + `fn quit` 可见」
   双双满足。
7. 退出收尾的 `child.wait()` 为无限阻塞：daemon 关闭 IPC 管道（`daemonStopped=true`
   已成立）后进程善终速度不受壳控制 → 改 `try_wait` 轮询 8 s 窗口，超时 SIGKILL
   兜底后正常退出（停止请求本身已送达，壳不替 daemon 的退出速度买单）；并发回归
   3 轮 4/4 全绿。排查中发现 `node build.mjs | tail && npm test` 管道吞掉构建脚本
   的非零退出码（构建在沙箱内静默失败时旧 bundle 继续被测试），属运维陷阱，非
   代码缺陷——机检命令均不经过管道串联构建。

## 边界与协作依赖（登记）

- `serve-entry.js --desktop` 参数当前被既有 `parseArgs` 接受为布尔旗标并忽略
  （桌面 HTTP 通道属 WP-2）。因此 bundle 内 daemon 可起、IPC 管道可用
  （`core.json` 落盘），但 `.orch/desktop.json` 尚未出现——该断言属 WP-2 的
  `http-channel.test.js`。壳已实现 `desktop.json` 出现后的接续逻辑（读凭据 →
  `GET /ui/labels` 刷新托盘文案 → 窗口导航到 `http://127.0.0.1:<port>/ui/`），
  WP-2 落地后自动生效，无需改壳。
- 托盘/确认/项目提示文案当前使用壳内兜底常量（与 A-3/A-6 基线逐字一致）；
  `desktop.json` 通道就绪后经 `GET /ui/labels`（DESKTOP_TRAY_* / DESKTOP_QUIT_* /
  DESKTOP_PROJECT_*）覆盖。AC-31 架构检查只扫 `desktop/ui`、`desktop/harness`，
  壳内兜底不违反零 CJK 红线（且中文唯一来源仍是 labels 模块的值域）。
- `probe.rows`（A-1 列表行）与真实实例点进的 `graph-shown` 数据面属 WP-3/WP-8；
  本批 `graph-shown` 由壳层视图状态记录（ctl 接缝），S3 全量验收时随 UI 批次补全。
- `desktop/src-tauri/Cargo.lock` 与 `gen/schemas/*.json`（tauri-build 编译期自动
  生成）不在 16 文件清单内，不随本批提交：前者留在本地保证本机增量构建可复现，
  评审侧 `cargo build` 会重新解析依赖（crates.io 快照直连可用，见结论段）；后者
  每次 `cargo build` 自动再生，入库反而制造跨批次噪音。

## 门禁四件套（本批实测）

1. 全量 `NODE_ENV=test node --test "test/**/*.test.js"` → 1247 tests / 8 条基线
   逐字命中 / 超基线 4 条（AC-37、AC-09 live、cancel、C-2 端到端）按裁决 F 逐
   文件串行复跑全部转绿（负载型 flake，批 1 评审同款）→ **差集 = 0，条数
   1247 > 1157 只增 ✓**
2. `purity-check.mjs --dirs src/core,src/daemon --forbid <31 词全表>` → 28 文件
   零命中，exit 0 ✓
3. `Object.keys(dependencies||{}).length === 0` → 0（devDependencies 亦 0）✓
4. `bundle.test.js` 全链（构建产物 + 包内 node + 收窄环境壳 + 接缝 + quit）
   多轮全绿 ✓；附加：AC-29 grep 零命中、AC-02 `core.stop` 恰 1 条且 `-B8` 可见
   `fn quit` ✓
