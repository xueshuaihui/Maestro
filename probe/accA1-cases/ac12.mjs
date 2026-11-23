// AC-12 · 规划验收句①（真实宿主面）：装了至少一种 Agent CLI 的机器启动应用自动列出且信息准确。
// AD-08：本机无目标 CLI，Given 不可构造 → 判阻塞，不判通过、不用 mock 顶替（附录 A-7：待本机实测）。
// 本用例只做只读观测 + 隔离夹具上的「未找到」取证，附试过路径；不构造 ACP 成功现场。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EVIDENCE_LEVELS, makeCase, freshRoot, orch, injectedScan, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-12';
const FACE = '真实宿主面（AD-08 阻塞）';
const TARGET_BINS = ['codex', 'claude', 'gemini'];

/** 只读观测：PATH / 应用目录 / home 标记；不 spawn、不写用户机器。 */
function observeHost(env) {
  const home = env.HOME ?? env.USERPROFILE ?? os.homedir();
  const entries = String(env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const onPath = [];
  for (const dir of entries) {
    for (const bin of TARGET_BINS) {
      const p = path.join(dir, bin);
      try {
        fs.accessSync(p, fs.constants.X_OK);
        if (fs.statSync(p).isFile() && !onPath.includes(p)) onPath.push(p);
      } catch { /* 不存在或不可执行 */ }
    }
  }
  const apps = [];
  for (const dir of ['/Applications', path.join(home, 'Applications')]) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (/workbuddy/i.test(name)) apps.push(path.join(dir, name));
      }
    } catch { /* 目录不可读 */ }
  }
  const homes = [];
  for (const m of ['.codex', '.claude', '.gemini']) {
    const p = path.join(home, m);
    try { fs.accessSync(p); homes.push(p); } catch { /* 无标记 */ }
  }
  return { home, pathEntryCount: entries.length, bins: TARGET_BINS, onPath, apps, homes };
}

export const cases = [{
  ac: AC,
  title: '规划验收句①（真实宿主面）：装了至少一种 Agent CLI 的机器启动应用自动列出且信息准确',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'pending', phase: 'blocked' });
    const root = freshRoot(AC); c.add(root);

    // ① 只读观测真实宿主（取证前提是否满足）
    const obs = observeHost(process.env);
    c.snap('host-observation', obs);
    const triedPaths = [
      `PATH 扫描（${obs.pathEntryCount} 目录 × ${obs.bins.join('/')}）：${obs.onPath.length ? obs.onPath.join(', ') : '未检出可执行'}`,
      `应用目录证据：${obs.apps.length ? obs.apps.join(', ') : '未检出'}；本机 WorkBuddy.app 仅安装标记、不在 PATH 且无可执行`,
      `home 标记证据：${obs.homes.length ? obs.homes.join(', ') : '未检出'}`
    ];

    // ② 隔离夹具上取证：四类来源全空 → 任何目标 CLI 均无法被列出/握手
    const scan = c.cmd(injectedScan(root, {
      pathEntries: [], appDirs: [], npmGlobalRoot: null, home: path.join(root, 'home')
    }, { writeRegistry: true }), '隔离夹具扫描（PATH/app/home/npm 全空）');
    const probes = TARGET_BINS.map((id) =>
      c.cmd(orch(root, ['probe', id]), `orch cli probe ${id}（隔离夹具目标）`));

    // ③ 按 AD-08 逐条判阻塞（不是产品不通过，而是本机 Given 无法构造）
    c.block('Given：一台装有目标 Agent CLI 且其可执行在命令搜索路径中的机器',
      `本机 PATH 实测无 ${obs.bins.join('/')} 可执行；仅有应用/home 安装标记，不具有可执行载体（AD-08 / D-2 / D-4）。`);
    c.block('Then：清单自动列出该目标 CLI，名称/路径/版本/连接状态四项与实际一致',
      `无真实宿主可执行可供 scan 发现，无法取得 which <bin> / <bin> --version 实测对照；隔离夹具对三个目标的 probe 全部「未找到 CLI」（exit 1）。`);
    c.block('When：在该机器启动应用执行扫描并查看清单',
      '本机隔离夹具扫描 0 项可驱动目标；该项须在装有目标 CLI 的取证机上执行。');
    c.block('用户不需要任何手写配置或命令行参数',
      '目标 CLI 不存在，真实宿主面该可观测性无法在本机取证（mock 面 AC-14 的证明不得顶替）。');

    c.check('未用 mock 冒充真实宿主达标：证据级别为待本机实测',
      c.evidenceLevel === EVIDENCE_LEVELS.pending && obs.onPath.length === 0,
      `${c.evidenceLevel}；onPath=${JSON.stringify(obs.onPath)}`);
    c.check('留下只读观测原始证据（PATH/应用/home 均记录）', triedPaths.length === 3, triedPaths.join(' ｜ '));

    c.mid = { observation: obs, triedPaths, scanStdout: scan.stdout,
      probes: probes.map((p) => ({ id: p.argv.at(-1), exitCode: p.exitCode, stdout: p.stdout.trim() })) };
    c.note('需求要求：在一台装了至少一种 Agent CLI 的机器上，启动应用能自动列出该 CLI 且名称/路径/版本/连接状态四项与实际一致（规划 385 行，AC-12 Then 不写 orch 字面）。');
    c.note('试过路径：' + triedPaths.join('；'));
    c.note('为什么观测不到：本机 PATH 无真实 codex/claude/gemini 可执行；/Applications/WorkBuddy.app 仅为安装标记、不在 PATH 且无可执行；无真实宿主握手现场（mock 面 AC-14 仅供逻辑复现，不构成真实宿主达标）。');
    c.note('升级建议：请主控按 D-4 在装有目标 CLI 的机器上取证（独立项目根执行 NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan，对照 which <bin> / <bin> --version）；收口若仍阻塞，按执行模板 §4.5 升级用户书面豁免，豁免前不判通过。');
    return finish(c);
  }
}];
