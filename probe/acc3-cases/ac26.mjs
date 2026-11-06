// AC-26 编码闭环与通用任务闭环同目录互斥（双向都试）。
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  makeCase, freshRoot, startKeep, runProduct, text, lines, instanceIds, readState,
  coreStop, forceKillCore, requirementTitle, finish, REPO, NODE, CODE_DRIVER, baseEnv,
  waitUntil, sleep, exists
} from '../acc3-f-common.mjs';

const AC = 'AC-26';
const TASK_LOOP_SCENARIO = 'doc-hold-research';
const DIR_BUSY = '该目录已有未结束的实例 INST-001，本次未发起';

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

/** 长驻 code-loop 驱动（`--keep`）；脚手架 startDriver 固定用 task-loop 驱动，这里本地起一个。 */
function startCodeLoopKeep(root, cwdAbs, scenario = 'hold-forever') {
  const argv = [NODE, CODE_DRIVER, '--root', root, '--scenario', scenario, '--cwd', cwdAbs, '--keep'];
  const child = spawn(argv[0], argv.slice(1), {
    cwd: REPO, env: baseEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const h = { argv, root, child, stdout: '', stderr: '', exited: false, exitCode: null, startedAt: Date.now() };
  child.stdout.on('data', (c) => { h.stdout += c.toString('utf8'); });
  child.stderr.on('data', (c) => { h.stderr += c.toString('utf8'); });
  h.done = new Promise((resolve) => { child.once('exit', (code) => { h.exited = true; h.exitCode = code; resolve(code); }); });
  h.stop = async () => {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    await Promise.race([h.done, sleep(3000)]);
  };
  return h;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '编码闭环与通用任务闭环同目录互斥',
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const rootA = freshRoot(AC);
    const rootB = freshRoot(`${AC}-b`);
    c.add(rootA);
    c.add(rootB);

    // ---- 方向一：task-loop 占住 demo-doc → code-loop 被拒
    const h = startKeep(rootA, TASK_LOOP_SCENARIO, [], undefined, 30000);
    let cl = null;
    try {
      const paused = await h.waitFile('paused', 20000);
      c.check('Given（方向一）：task-loop 的 INST-001 已停在 T-001 prompt 前', Boolean(paused), `${Date.now() - h.startedAt}ms`);

      const r1 = c.cmd(
        runProduct(rootA, { template: 'code-loop', task: '写一个计算器。产物：calc.js' }),
        'orch run --template code-loop --cwd ./demo-doc --task "…产物：calc.js"'
      );
      c.includes('Then（方向一）输出含「该目录已有未结束的实例 INST-001，本次未发起」', hitLine(text(r1), DIR_BUSY), DIR_BUSY);
      c.eq('Then（方向一）退出码 1', r1.exitCode, 1);
      c.eq('And（方向一）机检：没有生成第二个实例', instanceIds(rootA).join(','), 'INST-001');
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-hold-research --keep（方向一，长驻进程由脚手架终止）', h, h.argv);
      c.cmd(coreStop(rootA), 'orch core stop（方向一）');
      await forceKillCore(rootA);
    }

    // ---- 方向二：code-loop 占住 demo-doc → task-loop 被拒
    // 用 `hold-test`（第 2 次派发停在 session/new）而不是 `hold-forever`（第 1 次派发就停）：
    // 后者的第 1 次派发还在目录锁内，任何同目录的第二次发起都会排在锁上直到 IPC 超时，
    // 观测到的不是「目录已占用」这条业务拒绝（该现象另记 probe/acc3-f-blockers.md）。
    const demoDocB = path.join(rootB, 'demo-doc');
    cl = startCodeLoopKeep(rootB, demoDocB, 'hold-test');
    try {
      const ready = await waitUntil(() => {
        if (exists(path.join(rootB, '.mock', 'paused'))) {
          const s = readState(rootB);
          if (s && s.state === 'running' && typeof s.cwd === 'string'
            && path.resolve(s.cwd).toLowerCase() === path.resolve(demoDocB).toLowerCase()) return true;
        }
        return false;
      }, { timeout: 25000, interval: 100, label: 'code-loop 就位' });
      const liveB = readState(rootB);
      c.check(
        'Given（方向二）：code-loop 的 INST-001 在 demo-doc 目录运行',
        Boolean(ready),
        `state=${liveB?.state} cwd=${liveB?.cwd} 期望 ${demoDocB}`
      );
      c.eq('Given（方向二）机检：实例号是 INST-001', liveB?.instanceId, 'INST-001');

      const r2 = c.cmd(
        runProduct(rootB, { task: '写一篇发布说明。产物：release-notes.md' }),
        'orch run --template task-loop --cwd ./demo-doc --task "…产物：release-notes.md"（code-loop 占目录时）'
      );
      c.includes('Then（方向二）输出含「该目录已有未结束的实例 INST-001，本次未发起」', hitLine(text(r2), DIR_BUSY), DIR_BUSY);
      c.eq('Then（方向二）退出码 1', r2.exitCode, 1);
      c.eq('And（方向二）机检：没有生成第二个实例', instanceIds(rootB).join(','), 'INST-001');
      c.note(
        '补充观测（不计入本 AC 判据）：若占用方停在**第 1 次派发**（code-loop `hold-forever` 在 session/new 内暂停），'
        + '同目录的第二次 `orch run` 会排在 `@dir` 锁上直到 60s 握手超时，输出「未知错误：IPC_TIMEOUT」而不是 DIR_BUSY。'
        + '复现已写入 probe/acc3-f-blockers.md。'
      );
    } finally {
      if (cl) await cl.stop();
      c.cmd(coreStop(rootB), 'orch core stop（方向二）');
      await forceKillCore(rootB);
    }

    return finish(c);
  }
}];
