# I1.10b S3 批次 e 验收 · 真实宿主面（AC-25 / AC-33）

> 验收 Agent：批次 e（真实宿主面，C 类）｜日期：2026-11-17｜仓库根：`D:/WWW/Maestro`
> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 AC-25 / AC-33 全文（Given / When / Then / 机检 / 夹具 / 架构检查）+ `decisions.md` 裁决 A（三段交付、不判「跳到对应会话」）、裁决 I（标识 == `state.sessions[].sessionId`、目录同名不进判据）、裁决 J-3（C1 8/8 已实测一致、补注不回填）、裁决 B（窗口前置/剪贴板为人工核验项）。
> 纪律：只写验收产物（probe / evidence / 报告），未改产品代码 / 测试 / 需求 / 拆分。校验器 `probe/acc10b-jump-verify.mjs` 全程只读；「点击 → 进程 0→1」由受控脚手架 `probe/acc10b-e-live-probe.mjs` 走产品真实 `openHost()` 触发 + 只读观测，完成后仅清理本次新增进程。

---

## 0. 一句话结论

| AC | 判定 | 证据分级 | 自动面核对 | 阻塞 |
|---|---|---|---|---|
| AC-25 | **通过** | 自动面＝`真实宿主实测（进程）+ mock 实测（机检）`；窗口前置/剪贴板＝`人工核验`（不计入自动通过数） | 18/18 | 无 |
| AC-33 | **通过** | 自动面＝`真实宿主实测（进程）+ mock 实测（机检）`；窗口内提示可见性＝`人工核验`（不计入自动通过数） | 14/14 | 无 |

DSH 本体在本机真实存在且可用（`0.2.2-rc.1`，`C:\Users\xuesh\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe`，246,341,104 B），真实进程被成功拉起，故**不判阻塞**；未用 mock 顶替真实面，未写「通过（人工确认）」。

---

## 1. AC-25 · 一键跳转：唤起宿主 + 会话标识可核对

**判定：通过**（自动面 18/18）。
**证据分级**：自动面 = `真实宿主实测（进程 0→≥1）+ mock 实测（机检：同源 / 三态 / 逐字文案）`；窗口前置、剪贴板实际内容 = `人工核验`，单列、不计入自动通过数。

### 1.1 关键实测（自动面）

| 判据 | 实测 | 帧 |
|---|---|---|
| ① 点击前 DSH 进程数 = 0 | `processCount=0, evoked=false` | `AC-25.process-before.txt`、`AC-25.live-before.process.json` |
| ① 真实触发 | 走产品 `openHost({root,hostId:'dsh',instanceId:'INST-001',sessionId})` → `{ok:true, host:'dsh', sessionId:'00c5312e-…', sessionChoice:'most-recent-active'}`；仓库无 `.orch/hosts/` 配置，`resolveDshLaunch` 默认推导到真实 exe，**非 mock** | `AC-25.live-log.json` |
| ① 点击后进程数 ≥ 1 | `+0ms: processCount=1, evoked=true, exactlyOne=true, pids=[11508]`；`+250ms: 1` | `AC-25.live-t0ms.process.json`、`AC-25.live-t250ms.process.json` |
| ② 标识派生（非写常量） | 机检从夹具三条 `lastChangedAt` 取 `maxBy` 得 `expected`（本例 SESS-C=`3333…`/`09:31:10`），不预先点名 | `AC-25-33.host-jump.test.source.txt`（`expectedFrom` / `maxBy`） |
| ② 同源（裁决 I 第 2 条） | `expected.id === state.sessions.find(s=>s.sessionId===expected.id).sessionId`、`button.sessionId===expected.id`、`button.label` 含 id（J-1 恢复）、`toasts` 两行逐字且 line1 含 id | 机检 `AC-25 expected derived…` 用例，test 1 `ok` |
| ③ 三态翻转复检 | `SESS-C(09:31:10) → SESS-A(改 10:05:00) → SESS-C(改回 09:12:03)`，`selected_id` 随之 `SESS-C→SESS-A→SESS-C`，`evidence.length=3` | 机检 `AC-25 order-flip recheck` 用例，test 2 `ok` |
| 架构① | `grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js` → exit=1 零命中（daemon 不认识宿主名） | `AC-25.arch.stdout.txt` |
| 架构② | `grep -REn "hosts/" src/adapter/host-open.js` → exit=0，命中 3 条（打开命令来自宿主配置） | `AC-25.arch.stdout.txt` |
| 机检 F-16 | `NODE_ENV=test node --test test/wp14/host-jump.test.js` → `# tests 6 / # pass 6 / # fail 0` | `AC-25-33.host-jump.tests.stdout.txt` |

**真实面入参不写常量**：校验器的 `sessionId` 由 `acc10b-e-live-probe.mjs::deriveSessionId()` 从本机 `~/.dsh/sessions` 真实目录派生（`00c5312e-783d-4915-982a-6c248a6c65b0`），校验器源码仅回显、不硬编码。`AC-25.process-before.txt` 用机检同源 id `3333…` 另取一帧，两帧进程数一致（0）。

### 1.2 自动面 vs 人工核验项（分列）

**自动面（计入通过，18 项）**：机检 F-16 四项（文件存在 / exit 0 / #pass≥1 / #fail 0）；进程前=0；真实 `openHost` ok；进程后≥1；3 秒内存在（+250ms=1）；无残留；标识 `maxBy` 派生；同源断言；`button.label`/`button.sessionId` 含 id；toasts 逐字；三态翻转；三态片段齐全；入参派生；架构①；架构②。

**人工核验项（不计入自动通过数）**：

| 项 | 需求依据 | 证据分级 | 说明 |
|---|---|---|---|
| 窗口被唤到前台（前置） | AC-25 Then「窗口被唤到前台（人工核验项）」；裁决 B 第 2 条 | `人工核验` | 本机无 Rust/MSVC/Windows SDK、Tauri 壳不可构建（裁决 B 事实），窗口级动作无自动判据；报告不声称已自动验证窗口前置 |
| 剪贴板实际内容 == 标识 | AC-25 Then「剪贴板内容等于该标识（人工核验项）」 | `人工核验` | 剪贴板文本读取属窗口级人工核验；机检只验证「界面显示用值 = sessionId」（同源），不替代剪贴板内容核验 |

### 1.3 D-14 事实补注（非判据，裁决 I / J-3）

`probe/acc10b-jump-verify.mjs <sessionId> --check session-dir` 只读实测：`total=8, compared=8, dirEqualsInternalIdCount=8, c1="一致"`（`AC-25.session-dir.txt`）。按裁决 J-3，此即 C1「已实测一致」的原始帧；按裁决 I，**只作 D-14 表 C1 补注，不回填为 AC-25 判据、不改判定强度**，本报告不据此声称「打开对应会话」。

### 1.4 进程短命事实（如实留帧）

`+0ms/+250ms` 进程数 =1 满足 Then「3 秒内 DSH 进程存在（自动判定）」；`+1000ms/+3000ms` 归零（`AC-25.live-t1000ms.process.json`、`AC-25.live-t3000ms.process.json`）。经查 `src/adapter/host-open.js::launchOpen`：`spawn(detached, stdio:'ignore')` 后仅以 120ms 窗口观察 error 即 `unref`（D-4「不等待、不轮询进程存续」），配合 `ELECTRON_RUN_AS_NODE=1` 的 ACP 启动参数，宿主进程在失去 stdio 后自然退出。这是「唤起成功但进程短命」，**非唤起失败**，也未被误写为「窗口已选中该会话」。清理阶段 `newPids=[]`（脚本未主动 kill，进程已自行退出）、`live-cleanup=0`，未误伤用户原有进程（触发前 PID 集合为空）。

---

## 2. AC-33 · 打开宿主只在点击时发生，连点不产生第二个进程

**判定：通过**（自动面 14/14）。
**证据分级**：自动面 = `真实宿主实测（进程计数）+ mock 实测（机检：autoSpawn / jumpCalls / toasts）`；窗口内提示实际可见性 = `人工核验`，不计入自动通过数。

### 2.1 关键实测（自动面）

| 判据 | 实测 | 帧 |
|---|---|---|
| 停留 10s 不点击，进程恒 0 | `+0s…+10s` 共 11 个采样点，`processCount=0, evoked=false` 全 0；`live-before=0` | `AC-33.stay10s.jsonl`、`AC-33.live-before.process.json` |
| `autoSpawn === 0` | 真实面 11 点全 0 + 机检 `assert.equal(autoSpawn, 0)` | stay10s 帧；机检 test 4 |
| `jumpCalls === 1`（去重后） | 机检 `assert.equal(jumpCallsAfterDedupe, 1)`、`first.jumpCalls=1`、`first.spawnSignals=1` | 机检 test 4；`AC-25-33.host-jump.test.source.txt:250-255` |
| 真实面连点去重 | 两次 `openHost` 间隔 150ms（<200ms），第二次 `sameObjectReused=true`（复用首次结果对象，未起第二进程）；两次均返回同一 `sessionId` | `AC-33.live-log.json` |
| 只一次 toast | 机检 `toastPairs=1`（`first=1 + second=0`）、`second.toastPairs=0`、`second.reused=true` | 机检 test 4；`AC-25-33.host-jump.test.source.txt:245-253` |
| 两次点击 `sessionId` 同源 | 机检 `first.button.sessionId===expected.id && second.button.sessionId===expected.id` | 机检 test 4；`:257-259` |
| 真实面进程恰好 1 | `+0ms: processCount=1, exactlyOne=true, pids=[35104]`（PID 与 AC-25 不同，为独立受控轮次）；`+250ms: 1` | `AC-33.live-t0ms.process.json`、`AC-33.live-t250ms.process.json` |
| 架构检查 | `grep -REn "setInterval|setTimeout\(.*open|useEffect.*open" desktop/ui/drill/host-jump.js` → exit=1 零命中（无自动拉起定时器） | `AC-33.arch.stdout.txt` |
| 机检 F-16 | 同 AC-25：`# tests 6 / # pass 6 / # fail 0` | `AC-25-33.host-jump.tests.stdout.txt` |

### 2.2 自动面 vs 人工核验项（分列）

**自动面（计入通过，14 项）**：机检 F-16 四项；停留 10s 进程恒 0；`autoSpawn=0`（真实 + 机检）；`jumpCalls=1`；真实连点去重 `sameObjectReused=true`；`toasts=1`；两次 sessionId 同源；真实进程恰好 1；停留无自动拉起；架构检查；无残留。

**人工核验项（不计入自动通过数）**：

| 项 | 需求依据 | 证据分级 | 说明 |
|---|---|---|---|
| 窗口内只出现一次结果提示（视觉层） | AC-33 Then「界面只出现一次结果提示……第二次点击复用第一次结果、不弹第二个提示」；裁决 B | `人工核验` | 「第二条 toast 不出现」在纯模块面由 `toastPairs=1 / second.toastPairs=0` 机检断言；窗口内实际渲染可见性属人工核验，不计入自动通过 |

### 2.3 进程短命事实

与 AC-25 同一现象：`+0/+250ms=1`、`+1000ms` 归零（`AC-33.live-t1000ms.process.json`）。此轮 `newPids=[]`、`live-cleanup=0`，无残留、无误伤。不影响「连点不产生第二个进程」判定——关键是停留期恒 0 且点击后仅 1 个 PID（35104）。

---

## 3. 原始帧清单（每 AC ≥4，实际 AC-25=12 / AC-33=10）

全部位于 `docs/iterations/iteration-10b/evidence/`：

| 帧 | 用途 | AC |
|---|---|---|
| `AC-25.process-before.txt` | `--check process` 点击前（机检同源 id `3333…`），processCount=0 | 25 |
| `AC-25.session-dir.txt` | `--check session-dir`，8/8 C1 一致（D-14 补注，非判据） | 25 |
| `AC-25.live-before.process.json` | 真实触发前进程帧（派生 id `00c5312e…`）=0 | 25 |
| `AC-25.live-t0ms.process.json` | 点击后进程=1，PID 11508 | 25 |
| `AC-25.live-t250ms.process.json` | +250ms 进程=1（3 秒内存在） | 25 |
| `AC-25.live-t1000ms.process.json` | +1000ms 进程=0（短命事实） | 25 |
| `AC-25.live-t3000ms.process.json` | +3000ms 进程=0 | 25 |
| `AC-25.live-cleanup.process.json` | 清理后进程=0 | 25 |
| `AC-25.live-log.json` | 真实 `openHost` 返回 + 触发前后 PID/计数完整日志 | 25 |
| `AC-25.arch.stdout.txt` | 架构检查两条原始帧 | 25 |
| `AC-33.stay10s.jsonl` | 停留 10s，11 采样点进程全 0（`autoSpawn=0` 真实面） | 33 |
| `AC-33.live-before.process.json` | 点击前进程=0 | 33 |
| `AC-33.live-t0ms.process.json` | 两次点击后进程=1，PID 35104 | 33 |
| `AC-33.live-t250ms.process.json` | +250ms 进程=1 | 33 |
| `AC-33.live-t1000ms.process.json` | +1000ms 进程=0（短命事实） | 33 |
| `AC-33.live-cleanup.process.json` | 清理后进程=0 | 33 |
| `AC-33.live-log.json` | 两次 `openHost` 返回 + `sameObjectReused=true` + PID/计数日志 | 33 |
| `AC-33.arch.stdout.txt` | 架构检查原始帧 | 33 |
| `AC-25-33.host-jump.tests.stdout.txt` | 机检 6/6 TAP 全文（两 AC 共用） | 25,33 |
| `AC-25-33.host-jump.test.source.txt` | 机检源码逐字断言（两 AC 共用） | 25,33 |

**脚手架（验收产物，probe/）**：`acc10b-jump-verify.mjs`（只读校验器，未改）、`acc10b-e-live-probe.mjs`（受控触发 + 只读观测 + 仅清理新增进程）、`acc10b-e-final.mjs`（由帧构造判定产物）。

**同 AC 多记录取最后一条**：`probe/acc10b-f-results.jsonl` 原无 AC-25/33 记录（批次 b/c 按规则跳过），本批各追加一条并置于文件末尾；final 脚本读取时后跑覆盖先跑，取最后一条。汇总见 `probe/acc10b-f-summary-e.json`，分节见 `probe/acc10b-f-parts/AC-25.md`、`AC-33.md`。

---

## 4. 阻塞项

**无。** DSH 本体在本机真实存在且被成功拉起（AC-25 进程 0→1、AC-33 点击后=1），机检与架构检查全部成立，不存在「需求要求的行为在真实面观测不到」的情形，未触发超时。窗口前置 / 剪贴板内容 / 窗口内提示可见性按裁决 B 与需求归为**人工核验项**（非阻塞、不计自动通过），已单列于 §1.2 / §2.2，不需主控补跑即可完成自动面判定；若主控需要覆盖人工核验面，建议项见 §6。

---

## 5. 判定纪律自查

- ✅ 未宣称「逐字达成规划 874 行后段（打开对应会话）」：按裁决 A 三段口径判「唤起 + 标识可核对」，明确不判「在 DSH 内选中该会话」（AC-25 notes 第 1 条）。
- ✅ 目录同名只作 D-14 事实补注：`--check session-dir` 8/8 一致仅入 §1.3，不回填判据、不改判定强度（裁决 I / J-3）。
- ✅ 判据②为「标识 == `state.sessions[].sessionId`」，同源断言来自机检 `expected.id === …sessionId`，非目录同名、非写常量。
- ✅ 标识从实例状态/data 派生（`maxBy(lastChangedAt)`；真实面入参从 `~/.dsh/sessions` 派生），校验器不硬编码。
- ✅ DSH 可用 → 不判阻塞；未用 mock 顶替真实面；未写「通过（人工确认）」。
- ✅ 人工核验项（窗口前置、剪贴板内容、窗口内 toast 可见性）证据分级 `人工核验`、单列、不计入自动通过数。
- ✅ 每 AC ≥4 原始帧（25=12、33=10）；同 AC 取最后一条；不通过/阻塞需写 blockers.md——本批无此类项，blockers.md 仅追加批次 e 汇总台账（见文件）。
- ✅ 进程短命事实如实留帧并解释，不夸大（未把「进程被拉起」写成「窗口已选中该会话」）。

---

## 6. 给主控的核验建议（非阻塞、属人工核验面）

1. **AC-25 窗口前置与剪贴板**：在有 Tauri 壳的窗口环境人工点击「打开宿主会话」，确认 DSH 窗口被唤到前台、剪贴板文本 == 提示行标识；本报告未自动覆盖此两项。
2. **AC-33 窗口内提示**：窗口内 200ms 连点两次，确认只出现一次结果提示；本报告以纯模块面 `toastPairs=1` 机检断言替代自动面，窗口可见性待人工核验。
3. **进程短命复核**：如需确认 DSH GUI 常驻行为，可在带 GUI 的环境复跑 `acc10b-e-live-probe.mjs`，观察进程是否在 +1s 后仍存活（本机 headless ACP 模式预期退出，属 D-4 既定行为）。
