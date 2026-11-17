/**
 * I1.11 WP-9 shell contract tests (AC-01/02/03/04/07/35/36/37/48, D-8/D-9).
 *
 * Two layers:
 *  - Static contract layer (always runs): reads the Rust sources and Cargo
 *    metadata to lock the seams the acceptance harness depends on — the seven
 *    ctl actions in probe.rs, the untouched `tray-quit-confirm` channel, the
 *    `--no-notify` delivery switch, the D-9 probe event names, the single
 *    `handle_notify_open` click path called from main.rs, the notify-rust
 *    dependency, the label-backed config fields and the 2s tray poller.
 *  - Real probe layer (gated): requires a release shell binary built from the
 *    current sources. When the bundled binary predates main.rs (the common
 *    freshly-checked-out case), the test is skipped with an explicit reason;
 *    build with `npm run desktop:build` to enable it. It drives the ctl seam
 *    end-to-end and asserts probe events + `.done` renames, U-13 style.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(REPO, 'desktop', 'src-tauri', 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const MAIN = read('main.rs');
const TRAY = read('tray.rs');
const PROBE = read('probe.rs');
const CONFIG = read('config.rs');
const CARGO_TOML = fs.readFileSync(
  path.join(REPO, 'desktop', 'src-tauri', 'Cargo.toml'),
  'utf8',
);

// ---------------------------------------------------------------------------
// Layer 1: static contract
// ---------------------------------------------------------------------------

test('ctl 七动作清单：probe.rs 分发表恰好含既有三 + 新增四', () => {
  const decl = PROBE.match(/const CTL_ACTIONS:\s*\[&str;\s*(\d+)\]\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(decl, 'probe.rs 必须声明 CTL_ACTIONS 常量');
  assert.equal(Number(decl[1]), 7, 'CTL_ACTIONS 长度必须为 7');
  const actions = [...decl[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(actions, [
    'close-window',
    'tray-open',
    'tray-quit',
    'notify-open',
    'tray-pause',
    'tray-resume',
    'queue-open',
  ]);
});

test('tray-quit-confirm 通道不动：不在 CTL_ACTIONS，只由 wait_ctl_file 单独消费', () => {
  const decl = PROBE.match(/const CTL_ACTIONS:[\s\S]*?\];/)[0];
  assert.ok(!decl.includes('tray-quit-confirm'), 'tray-quit-confirm 不得进入分发器');
  assert.match(
    PROBE,
    /name\s*===\s*"tray-quit-confirm"|name\s*==\s*"tray-quit-confirm"/,
    '探针轮询必须显式跳过 tray-quit-confirm',
  );
  assert.match(
    TRAY,
    /wait_ctl_file\(&dir,\s*"tray-quit-confirm",\s*30_000\)/,
    '退出确认仍由 tray.rs 的 wait_ctl_file 单独消费',
  );
});

test('ctl 四动作双处分发：probe.rs 登记 + tray.rs 调真实处理函数', () => {
  for (const [action, fn] of [
    ['notify-open', 'handle_notify_open'],
    ['tray-pause', 'pause_all'],
    ['tray-resume', 'resume_all'],
    ['queue-open', 'handle_queue_open'],
  ]) {
    assert.match(PROBE, new RegExp(`"${action}"`), `probe.rs 缺 ${action}`);
    const branch = TRAY.match(
      new RegExp(`"${action}"\\s*=>\\s*([A-Za-z_]+)\\(`),
    );
    assert.ok(branch, `tray.rs handle_ctl 缺 ${action} 分支`);
    assert.equal(branch[1], fn, `${action} 必须调用 ${fn}（与真实菜单/点击同函数）`);
  }
  assert.ok(!/handle_ctl[\s\S]{0,4000}tray-quit-confirm/.test(TRAY));
});

test('--no-notify 只关投递层：开关置 false 但 SSE 订阅仍无条件启动', () => {
  assert.match(MAIN, /"--no-notify"\s*=>\s*args\.no_notify\s*=\s*true/);
  assert.match(
    MAIN,
    /notify_enabled:\s*AtomicBool::new\(!args\.no_notify\)/,
    '投递层开关必须置 false',
  );
  // SSE 订阅调用不得位于任何 `args.no_notify` 条件分支内。
  const idx = MAIN.indexOf('start_notify_stream(');
  assert.ok(idx > 0);
  assert.ok(!/if\s+!?args\.no_notify[\s\S]{0,120}start_notify_stream/.test(MAIN));
  assert.ok(!/if\s+args\.no_notify[\s\S]{0,120}start_notify_stream/.test(MAIN));
  assert.match(MAIN, /if\s+!\s*app\.state::<ShellState>\(\)\.notify_enabled[\s\S]{0,80}delivery_failed/);
});

test('D-9 探针事件名齐全（壳层拥有部分）', () => {
  const all = `${MAIN}\n${TRAY}\n${PROBE}`;
  for (const name of [
    'notify',
    'notify-delivered',
    'notify-open',
    'nav',
    'tray-status',
    'tray-pause',
    'ctl-fired',
    'ctl-error',
    'tray-created',
  ]) {
    assert.match(all, new RegExp(`"${name}"`), `缺探针事件名 ${name}`);
  }
  // notify 逐字转发字段 + 投递结果字段
  assert.match(MAIN, /probe::event\("notify",\s*intent\.clone\(\)\)/);
  assert.match(MAIN, /"delivered":\s*false/);
  assert.match(MAIN, /"reason":\s*reason/);
  // nav(view/selected) 在 tray.rs 落盘
  assert.match(TRAY, /probe::event\("nav",\s*json!\(\{\s*"view":\s*"queue",\s*"selected"/);
});

test('点击通知只走已落盘 handle_notify_open：main.rs 以 Some(id_override) 调用', () => {
  assert.match(
    MAIN,
    /tray::handle_notify_open\(&app,\s*Some\(/,
    'main.rs 必须直接调用 handle_notify_open(&app, Some(...))，不得另写分支',
  );
  assert.match(TRAY, /pub fn handle_notify_open\(app: &AppHandle, id_override: Option<&str>\)/);
  assert.match(TRAY, /"notify-open"\s*=>\s*handle_notify_open\(app,\s*None\)/);
});

test('通知依赖已宣告：Cargo.toml + Cargo.lock 均含 notify-rust 4 / preview-macos-un', () => {
  assert.match(CARGO_TOML, /notify-rust\s*=\s*\{\s*version\s*=\s*"4"/);
  assert.match(CARGO_TOML, /features\s*=\s*\["preview-macos-un"\]/);
  const lock = fs.readFileSync(
    path.join(REPO, 'desktop', 'src-tauri', 'Cargo.lock'),
    'utf8',
  );
  assert.match(lock, /name = "notify-rust"/);
  assert.match(lock, /version = "4\./);
});

test('config.rs：托盘六字段 + 通知不可用提示，均经 pick 覆盖且有中文默认值', () => {
  for (const field of [
    'tray_status',
    'tray_status_disconnected',
    'tray_pause',
    'tray_resume',
    'tray_pause_summary',
    'tray_pause_none',
    'notify_unavailable',
  ]) {
    assert.match(CONFIG, new RegExp(`pub\\s+${field}:\\s*String`), `缺字段 ${field}`);
  }
  assert.match(CONFIG, /pick\("DESKTOP_NOTIFY_UNAVAILABLE"\)/);
  assert.match(CONFIG, /pick\("DESKTOP_TRAY_PAUSE_SUMMARY"\)/);
  assert.match(CONFIG, /notify_unavailable:\s*"通知不可用 · 队列仍可用"\.into\(\)/);
  // 中文只允许出现在 config.rs 的 baked-in 默认值（tray.rs 不得出现）。
  assert.ok(!/[\u4e00-\u9fff]/.test(TRAY), 'tray.rs 不得含中文字面量');
});

test('D-8 托盘数字刷新：main.rs 每 2 秒经 /instances 调 update_status', () => {
  assert.match(MAIN, /fn start_tray_status_poller/);
  assert.match(MAIN, /start_tray_status_poller\(app\.handle\(\)\.clone\(\)/);
  assert.match(MAIN, /Duration::from_secs\(2\)/);
  assert.match(MAIN, /http_get_json\(port,\s*"\/instances",\s*&token\)/);
  assert.match(MAIN, /tray::update_status\(&app,\s*instances,\s*pending,\s*running_ids\)/);
  assert.match(TRAY, /pub fn update_status\(/);
});

test('暂停汇总 + 退出语义：pause/resume 走 /control，core.stop 只一处', () => {
  assert.match(TRAY, /http_post_json\(port,\s*"\/control\/pause",\s*token\)/);
  assert.match(TRAY, /http_post_json\(port,\s*"\/control\/resume",\s*token\)/);
  assert.match(TRAY, /fn quit_after_confirm[\s\S]*wait_ctl_file\(&dir,\s*"tray-quit-confirm"/);
  const stops = TRAY.match(/core\.stop/g) ?? [];
  assert.equal(stops.length, 1, 'core.stop 必须恰好一处');
  const at = TRAY.indexOf('core.stop');
  assert.ok(/fn quit/.test(TRAY.slice(Math.max(0, at - 300), at)), 'core.stop 须在 quit 附近');
  assert.ok(!/paused\s*=\s*true/.test(TRAY), '不得在壳层直写暂停状态');
});

test('SSE 任务随 app 退出取消：stop 标志由 run 循环在 Exit 时翻转', () => {
  assert.match(MAIN, /if let tauri::RunEvent::Exit = event/);
  assert.match(MAIN, /stop_run\.store\(true,\s*Ordering::Relaxed\)/);
  assert.match(MAIN, /while\s+!stop\.load\(Ordering::Relaxed\)/);
});

// ---------------------------------------------------------------------------
// Layer 2: real probe (gated on a binary built from the current sources)
// ---------------------------------------------------------------------------

const RELEASE_BIN = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'maestro');
const MAIN_RS = path.join(SRC, 'main.rs');

function realProbeSkipReason() {
  if (!fs.existsSync(RELEASE_BIN)) return '未发现 release 壳层二进制';
  try {
    if (fs.statSync(RELEASE_BIN).mtimeMs < fs.statSync(MAIN_RS).mtimeMs) {
      return 'release 壳层二进制早于 main.rs（本轮改动未构建）；静态契约层已覆盖接缝';
    }
  } catch {
    return '无法比较二进制与源码时间戳';
  }
  return false;
}

function readProbe(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

async function waitFor(makeValue, timeoutMs = 20_000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

test(
  '真实探针层：ctl 四动作触发事件并改名 .done（需当前源码构建产物）',
  { skip: realProbeSkipReason() },
  async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp9-shell-'));
    const ctlDir = path.join(root, 'ctl');
    const probeFile = path.join(root, 'probe.jsonl');
    fs.mkdirSync(ctlDir);
    const child = spawn(
      RELEASE_BIN,
      ['--project', root, '--probe', probeFile, '--ctl', ctlDir, '--no-notify'],
      { env: { ...process.env, NODE_ENV: 'test' }, stdio: 'ignore' },
    );
    try {
      assert.ok(
        await waitFor(() => readProbe(probeFile).some((e) => e.event === 'ready')),
        '壳层未就绪',
      );
      for (const action of ['notify-open', 'tray-pause', 'tray-resume', 'queue-open']) {
        fs.mkdirSync(path.join(ctlDir, action), { recursive: true });
        assert.ok(
          await waitFor(() => fs.existsSync(path.join(ctlDir, `${action}.done`))),
          `${action} 未改名 .done`,
        );
      }
      const events = readProbe(probeFile);
      const fired = events.filter((e) => e.event === 'ctl-fired').map((e) => e.action);
      assert.deepEqual(
        ['notify-open', 'tray-pause', 'tray-resume', 'queue-open'].filter((a) => !fired.includes(a)),
        [],
        '四个新动作都必须被探针记录',
      );
      assert.ok(events.some((e) => e.event === 'notify-open'));
      assert.ok(events.some((e) => e.event === 'nav' && e.view === 'queue'));
      assert.ok(events.some((e) => e.event === 'tray-pause'));
      // --no-notify 只让投递失败，不跳过 SSE；不产生 delivered=true。
      assert.ok(!events.some((e) => e.event === 'notify-delivered' && e.delivered === true));
    } finally {
      child.kill('SIGTERM');
    }
  },
);
