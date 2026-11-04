/**
 * VP-8 · 桌面壳可行性 spike（Electron 路径）
 *
 * 只验证需求基线里点名的三件事：
 *   1. 系统托盘（含菜单、tooltip、关闭窗口缩到托盘、托盘退出）
 *   2. WebSocket 客户端（渲染进程直连 daemon，收 graph.snapshot + 增量 role_instance.updated）
 *   3. 多窗口（主窗口 + 次级流程图窗口，独立 webContents）
 *
 * 不作为产品代码；阶段一 I1.10a 的产品壳另起。smoke 模式自动跑完写证据并退出。
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');

const SMOKE = process.env.SMOKE === '1';
const EVIDENCE = process.env.EVIDENCE_PATH || path.join(process.cwd(), 'evidence.json');
const DAEMON = process.env.DAEMON_URL || 'http://127.0.0.1:4319';
const WS_URL = DAEMON.replace(/^http/, 'ws') + '/instances/INST-001/graph/stream';

const ev = {
  startedAt: new Date().toISOString(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: `${process.platform} ${process.arch}`,
  checks: {},
  windows: [],
  tray: null,
  renderer: null,
  errors: [],
};

/** 16x16 纯色 PNG（避免依赖图标文件） */
function makeIcon(rgba) {
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };

  const W = 16;
  const H = 16;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y += 1) {
    const off = y * (W * 4 + 1);
    raw[off] = 0;
    for (let x = 0; x < W; x += 1) {
      const p = off + 1 + x * 4;
      raw[p] = rgba[0];
      raw[p + 1] = rgba[1];
      raw[p + 2] = rgba[2];
      raw[p + 3] = rgba[3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let tray = null;
let mainWindow = null;
let graphWindow = null;
let quitRequested = false;

function createWindow(name, { width = 980, height = 700, show = !SMOKE } = {}) {
  const win = new BrowserWindow({
    width,
    height,
    show,
    title: `Maestro · ${name}`,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  const query = `?ws=${encodeURIComponent(WS_URL)}&window=${encodeURIComponent(name)}`;
  win.loadFile(path.join(__dirname, 'renderer.html'), { search: query });
  ev.windows.push({ name, id: win.id, pid: win.webContents.getOSProcessId(), show });
  win.on('close', (e) => {
    // 关闭缩到托盘：有窗口时阻止退出，符合需求基线 §1.3
    if (!quitRequested && name === 'main') {
      e.preventDefault();
      win.hide();
      ev.checks.closeToTray = true;
    }
  });
  return win;
}

app.whenReady().then(async () => {
  try {
    const icon = nativeImage.createFromBuffer(makeIcon([0x2f, 0x6f, 0xed, 0xff]));
    tray = new Tray(icon);
    tray.setToolTip('Maestro · 0 个运行中实例 · 0 待处理升级');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '打开控制台', click: () => mainWindow && mainWindow.show() },
        { label: '暂停全部实例', enabled: false },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            quitRequested = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on('click', () => mainWindow && mainWindow.show());
    ev.tray = {
      created: true,
      destroyed: tray.isDestroyed(),
      tooltipSet: true,
      bounds: tray.getBounds(),
      menuItems: 3,
    };
    ev.checks.tray = true;

    mainWindow = createWindow('main');
    graphWindow = createWindow('graph', { width: 760, height: 560 });
    ev.checks.multiWindow = BrowserWindow.getAllWindows().length >= 2;

    ipcMain.on('renderer:report', (_e, payload) => {
      ev.renderer = payload;
    });
    ipcMain.on('renderer:smoke-done', () => {
      if (!SMOKE) return;
      // 关闭主窗口应缩到托盘而不是退出（需求基线 §1.3）
      mainWindow.close();
      ev.checks.closeToTray = !mainWindow.isDestroyed() && !mainWindow.isVisible();
      ev.checks.websocket = (ev.renderer?.messages ?? 0) > 0;
      ev.checks.daemonHttp = !!ev.renderer?.snapshot;
      ev.checks.rendererDom = !!ev.renderer?.domNodes;
      ev.memory = process.memoryUsage();
      ev.metrics = app.getAppMetrics().map((m) => ({ type: m.type, pid: m.pid, workingSetMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024) }));
      ev.endedAt = new Date().toISOString();
      ev.durationMs = Date.parse(ev.endedAt) - Date.parse(ev.startedAt);
      ev.windows.forEach((w) => {
        const win = BrowserWindow.fromId(w.id);
        w.alive = !!win && !win.isDestroyed();
      });
      fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
      fs.writeFileSync(EVIDENCE, JSON.stringify(ev, null, 2), 'utf8');
      quitRequested = true;
      setTimeout(() => app.quit(), 150);
    });

    if (SMOKE) {
      setTimeout(() => {
        ev.timeout = true;
        ev.endedAt = new Date().toISOString();
        fs.writeFileSync(EVIDENCE, JSON.stringify(ev, null, 2), 'utf8');
        quitRequested = true;
        app.quit();
      }, 20_000);
    }
  } catch (err) {
    ev.errors.push({ where: 'whenReady', message: err.message, stack: err.stack });
    fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
    fs.writeFileSync(EVIDENCE, JSON.stringify(ev, null, 2), 'utf8');
    app.exit(1);
  }
});

app.on('window-all-closed', () => {
  // 关闭全部窗口不退出：daemon 继续驻留（需求基线 §1.3）
  ev.checks.survivesAllWindowsClosed = !quitRequested;
});

process.on('uncaughtException', (err) => {
  ev.errors.push({ where: 'uncaughtException', message: err.message });
  fs.writeFileSync(EVIDENCE, JSON.stringify(ev, null, 2), 'utf8');
  app.exit(1);
});
