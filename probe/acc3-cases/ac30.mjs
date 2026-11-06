// AC-30 升级写不进去时不假装挂起（MAESTRO_FAULT=state_write:escalation 接缝，见 src/core/orchestrator.js:293）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, prepareOnly, startKeep, text, lines, readState, nodeOf, exists,
  coreStop, forceKillCore, requirementTitle, finish, baseEnv, sleep, EVID, ensureDir
} from '../acc3-f-common.mjs';

const AC = 'AC-30';
const SCENARIO = 'review-missing';
const LIMIT_MS = 10000;

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '升级写不进去时不假装挂起',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    let h = null;
    try {
      // Given：prepare-only 备现场，且核心已停
      const prep = c.cmd(prepareOnly(root, SCENARIO), 'driver --scenario review-missing --prepare-only（备现场）');
      c.eq('Given 前置：--prepare-only 退出码 0', prep.exitCode, 0);
      c.cmd(coreStop(root), 'orch core stop（确认核心已停）');

      // When：MAESTRO_FAULT=state_write:escalation 下跑完整场景
      const env = baseEnv({ MAESTRO_FAULT: 'state_write:escalation' });
      h = startKeep(root, SCENARIO, [], env, 60000);

      // halt 一落盘就把当时的 state.json 抢下来（`core stop` 之后会对账成 interrupted，
      // 终态文件观测不到 requirement 要求的 running+halted）。
      let halted = null;
      let haltedAt = null;
      const watch = (async () => {
        for (let i = 0; i < 750; i += 1) {
          const s = readState(root);
          if (s && s.halted === true) {
            halted = s;
            haltedAt = Date.now() - h.startedAt;
            return;
          }
          if (h.exited) return;
          await sleep(20);
        }
      })();

      await h.done;
      const durationMs = Date.now() - h.startedAt;
      await watch;

      // Then：10 秒内结束，退出码 5
      c.check(`Then 命令在 ${LIMIT_MS / 1000} 秒内结束（实测 ${durationMs}ms）`, durationMs <= LIMIT_MS, `${durationMs}ms`);
      c.eq('Then 退出码 5', h.exitCode, 5);
      c.note(`halt 落盘距启动 ${haltedAt}ms；driver 进程总耗时 ${durationMs}ms`);

      const t = text({ stdout: h.stdout, stderr: h.stderr });
      c.includes('Then 输出含「无法记录升级：」', hitLine(t, '无法记录升级：'), '无法记录升级：');
      c.includes('Then 输出含「；已停止推进」', hitLine(t, '；已停止推进'), '；已停止推进');
      c.includes('Then 输出含「运行中 · 已停止推进」', hitLine(t, '运行中 · 已停止推进'), '运行中 · 已停止推进');
      c.notIncludes('Then 输出不含「已挂起」', t, '已挂起');
      c.includes(
        'Then 输出含「节点 T-003 审核者 待校验（升级未记录） · 第 1 轮」',
        hitLine(t, '节点 T-003 审核者 待校验（升级未记录） · 第 1 轮'),
        '节点 T-003 审核者 待校验（升级未记录） · 第 1 轮'
      );
      const handoffLines = lines(t).filter((l) => l.trim().startsWith('交接包 HO-'));
      c.eq('Then 输出不含以「交接包 HO-」开头的行', handoffLines.join(' | ') || '（无）', '（无）');

      // And 机检（halt 瞬间快照）
      if (!halted) {
        c.block(
          "And 机检：state='running'，halted=true，escalations 为空",
          '未在 driver 退出的 `core stop` 之前抓到 halted 落盘；终态文件已按既有口径对账成 interrupted'
        );
      } else {
        ensureDir(EVID);
        const snapPath = path.join(EVID, `${AC}.state.halted.json`);
        fs.writeFileSync(snapPath, JSON.stringify(halted, null, 2) + '\n', 'utf8');
        c.evidence.push(snapPath);
        c.eq("And 机检：halt 瞬间 state='running'", halted.state, 'running');
        c.eq('And 机检：halted=true', halted.halted, true);
        c.eq('And 机检：escalations 为空', (halted.escalations ?? []).length, 0);
        c.eq("And 机检：T-003 state='review'（不是 failed，也不是 escalated）", nodeOf(halted, 'T-003')?.state, 'review');
        c.eq('And 机检：haltCause=state_write:escalation', halted.haltCause, 'state_write:escalation');
      }
      c.note(
        `终态 state.json 的实例状态是 \`${readState(root)?.state}\`：driver 退出前会执行 \`orch core stop\`，`
        + '核心停止会把非终态实例对账成 interrupted（src/daemon/server.js:369 → orchestrator.interruptAll），'
        + '因此 requirement 要求的 running+halted 只能从 halt 落盘瞬间取证（见 evidence 的 state.halted.json）。'
      );
      c.snap(root, 'state.after-stop');

      // 佐证：交接包现场（供报告解释「输出不含交接包行」是渲染口径，不是状态为空）
      c.note(
        `halt 时 state.handoffs=${(halted?.handoffs ?? []).map((x) => `${x.handoffId}:${x.state}`).join(',') || '（空）'}；`
        + '审核节点在 consume 之前就升级失败，故 HO-002 停在 accepted；`renderRunTail` 的停止推进分支不打印交接包行，所以输出里没有「交接包 HO-」行。'
      );
      c.check('佐证：工作区存在（场景确实推进过）', exists(`${root}/.orch/instances/INST-001`), `${root}/.orch/instances/INST-001`);
    } finally {
      if (h) {
        await h.stop();
        c.keep('driver --scenario review-missing --keep（MAESTRO_FAULT=state_write:escalation）', h, h.argv);
      }
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
