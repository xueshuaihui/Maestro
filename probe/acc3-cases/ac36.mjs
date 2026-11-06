// AC-36 编码闭环与单节点输出不回归（红线：输出逐字一致）。
//
// 对照口径：
//  - `code-loop` 中间态 = I1.2 验收 AC-05 的实测样例（`docs/iterations/iteration-2/acceptance-fixture.md:440-455`，
//    `--scenario backflow-once --stop-after 3 --keep`），只允许 耗时/时间戳 变化（该样例自身就带变量）。
//  - `single` 的 run/status = I1.2 附录 A-1 / A-2 的 `single` 列（= I1.1 版式），
//    段序与每段字段种类逐字固定，只有实例号/会话号/耗时/时间戳可变。
//  - `code-loop` 的 A-3（成功）/ A-4（挂起）同附录，逐行核对段序与文案。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  makeCase, freshRoot, REPO, NODE, CODE_DRIVER, codeLoopDriver, nodeTest, orch,
  statusText, text, lines, nonEmptyLines, readState, nodeOf, handoffOf,
  coreStop, forceKillCore, waitMarker, sleep, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-36';
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

/** 本地长驻 code-loop 驱动（startDriver 绑死 task-loop 驱动，这里按同一形状自建）。 */
function startCodeLoop(root, args) {
  const argv = [NODE, CODE_DRIVER, '--root', root, ...args];
  const child = spawn(argv[0], argv.slice(1), {
    cwd: REPO, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const h = { argv, child, stdout: '', stderr: '', exited: false, exitCode: null, startedAt: Date.now() };
  child.stdout.on('data', (c) => { h.stdout += c.toString('utf8'); });
  child.stderr.on('data', (c) => { h.stderr += c.toString('utf8'); });
  h.done = new Promise((resolve) => {
    child.once('exit', (code) => { h.exited = true; h.exitCode = code; resolve(code); });
    child.once('error', () => { h.exited = true; resolve(-1); });
  });
  h.stop = async () => {
    await sleep(0);
    coreStop(root);
    await forceKillCore(root);
    if (!h.exited) { try { child.kill('SIGKILL'); } catch { /* ignore */ } }
    await Promise.race([h.done, sleep(3000)]);
  };
  return h;
}

/** single 图的最小宿主：mock 在会话 cwd 里写 out/intro.md（I1.1 wp9 同款）。 */
function writeSingleHost(root) {
  fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'work'), { recursive: true });
  fs.writeFileSync(path.join(root, '.orch', 'hosts', 'dsh.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: NODE, args: [MOCK, '--write-ref', 'out/intro.md'] },
    limits: {
      initializeTimeoutMs: 15000, requestTimeoutMs: 15000, promptTimeoutMs: 30000,
      quietIdleMs: 30, quietCapMs: 200
    }
  }, null, 2), 'utf8');
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '编码闭环与单节点输出不回归',
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const rootA = freshRoot(`${AC}-a`); // code-loop 中间态
    const rootB = freshRoot(`${AC}-b`); // single run/status
    const rootC = freshRoot(`${AC}-c`); // code-loop 成功（A-3）
    const rootD = freshRoot(`${AC}-d`); // code-loop 挂起（A-4）
    c.add(rootA); c.add(rootB); c.add(rootC); c.add(rootD);

    let keep = null;
    try {
      // ---------------------------------------------------------------- Given 1
      const suite = c.cmd(nodeTest(), 'node --test "test/**/*.test.js"（I1.2 完整测试集）');
      const out = text(suite);
      const mTests = /^# tests (\d+)$/m.exec(out);
      const mPass = /^# pass (\d+)$/m.exec(out);
      const mFail = /^# fail (\d+)$/m.exec(out);
      c.eq('Then 全部通过（退出码 0）', suite.exitCode, 0);
      c.eq('Then 全部通过（fail=0）', Number(mFail?.[1] ?? -1), 0);
      c.check('Then 全部通过（fail=0，条数不低于 416 基线）',
        Number(mFail?.[1] ?? -1) === 0
          && Number(mPass?.[1] ?? -1) === Number(mTests?.[1] ?? -2)
          && Number(mTests?.[1] ?? -1) >= 416,
        `tests=${mTests?.[1]} pass=${mPass?.[1]} fail=${mFail?.[1]}`);
      c.note('回归对照口径：code-loop 定格用 I1.2 验收 AC-05 的实测样例（同一命令 backflow-once --stop-after 3 --keep）；'
        + 'single 用 I1.2 附录 A-1 / A-2 的 single 列（= I1.1 版式）；code-loop 成功/挂起用 A-3 / A-4。'
        + '只允许 实例号/会话号/耗时/时间戳 变化（I1.2 附录对这些字段本身就是变量）。');
      c.note('条数下限断言：要求 pass = tests 且 tests ≥ 416（HEAD 基线），只禁止条数减少，'
        + '不禁止后续迭代新增用例——新增测试全绿仍算通过。');

      // ---------------------------------------------------------------- code-loop 中间态
      keep = startCodeLoop(rootA, ['--scenario', 'backflow-once', '--stop-after', '3', '--keep']);
      const marker = await waitMarker(rootA, 3, { timeout: 40000 });
      c.check('Given 机检：.mock/stopped-after-3 存在（停在开发第 2 轮完成、复测未派发）', Boolean(marker),
        `${Date.now() - keep.startedAt}ms`);

      const st = c.cmd(statusText(rootA), 'orch status --instance INST-001（code-loop 定格）');
      const t = text(st);
      c.includes('Then 输出含「节点 T-002 测试 失败（等待复测） · 第 1 轮」',
        hitLine(t, '节点 T-002 测试 失败（等待复测） · 第 1 轮'), '节点 T-002 测试 失败（等待复测） · 第 1 轮');
      c.notIncludes('Then 输出不含「待校验（等待下游）」', t, '待校验（等待下游）');

      // 与 I1.2 附录 A-2 / 验收 AC-05 的实测样例逐行对照（只有 耗时/时间戳 可变）
      const gl = nonEmptyLines(t);
      const exact = [
        [/^实例 INST-001 · 运行中 · 模板 编码闭环$/, '实例行'],
        [/^节点 T-001 开发 已完成 · 第 2 轮 · 耗时 \S+$/, 'T-001 节点行'],
        [/^节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条$/, 'T-002 节点行'],
        [/^会话 空闲$/, '会话行'],
        [/^交接包 HO-001 {2}开发→测试 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/, 'HO-001 已构造'],
        [/^交接包 HO-001 {2}开发→测试 {2}已投递 {3}\d{2}:\d{2}:\d{2}$/, 'HO-001 已投递'],
        [/^交接包 HO-001 {2}开发→测试 {2}已接受 {3}\d{2}:\d{2}:\d{2}$/, 'HO-001 已接受'],
        [/^交接包 HO-001 {2}开发→测试 {2}已完成 {3}\d{2}:\d{2}:\d{2}$/, 'HO-001 已完成'],
        [/^交接包 HO-002 {2}测试→开发（回流） {2}已构造 {3}\d{2}:\d{2}:\d{2}$/, 'HO-002 已构造'],
        [/^交接包 HO-002 {2}测试→开发（回流） {2}已投递 {3}\d{2}:\d{2}:\d{2}$/, 'HO-002 已投递'],
        [/^交接包 HO-002 {2}测试→开发（回流） {2}已接受 {3}\d{2}:\d{2}:\d{2}$/, 'HO-002 已接受'],
        [/^交接包 HO-002 {2}测试→开发（回流） {2}已完成 {3}\d{2}:\d{2}:\d{2}$/, 'HO-002 已完成'],
        [/^升级 —$/, '升级块']
      ];
      c.check('And code-loop 中间态段序与行数 = I1.2 A-2 样例（13 行）', gl.length === exact.length,
        `${gl.length} 行：${gl.slice(0, 3).join(' / ')} …`);
      for (let i = 0; i < Math.min(exact.length, gl.length); i += 1) {
        c.matches(`And code-loop 第 ${i + 1} 行逐字（${exact[i][1]}）`, gl[i], exact[i][0]);
      }

      // ---------------------------------------------------------------- single run + status
      writeSingleHost(rootB);
      const run = c.cmd(
        orch(rootB, ['run', '--cwd', './work', '--task', '写一段 200 字的产品说明，保存到 out/intro.md']),
        'orch run --cwd ./work --task "写一段 200 字的产品说明，保存到 out/intro.md"（single）'
      );
      const rt = text(run);
      c.eq('Then single 的 orch run 退出码 0', run.exitCode, 0);
      const rl = nonEmptyLines(rt);
      const SESSION_RE = /^会话 (空闲|执行中 · 已运行 \S+|执行中 · 调用工具（.+?）( · 已运行 \S+)?|等待审批：.+|等待下游( · 产出已提交)?|已升级)$/;
      c.matches('And single run 第 1 行「实例 INST-001 · 运行中」（仅开头一次，无模板）', rl[0], /^实例 INST-001 · 运行中$/);
      c.matches('And single run 第 2 行「会话已创建 <id>」', rl[1], /^会话已创建 \S+$/);
      c.eq('And single run 第 3 行「任务已投递」', rl[2], '任务已投递');
      const rNodeAt = rl.findIndex((l) => l.startsWith('节点 '));
      c.check('And single run 有节点行（A-1 第 6 段）', rNodeAt > 3, `节点行在第 ${rNodeAt + 1} 行`);
      const midSessions = rl.slice(3, rNodeAt);
      c.check('And single run 中段全是会话行（A-1 第 4 段，1..N 行）',
        midSessions.length >= 1 && midSessions.every((l) => SESSION_RE.test(l)),
        `${midSessions.length} 行：${midSessions.join(' / ')}`);
      c.check('And single run 含「会话 等待下游 · 产出已提交」（A-1 第 5 段）',
        rl.includes('会话 等待下游 · 产出已提交'), rl.slice(3, rNodeAt).join(' / '));
      c.matches('And single run 节点行逐字（A-1 第 6 段）', rl[rNodeAt], /^节点 已完成 · 耗时 \S+$/);
      const rHandoffs = rl.slice(rNodeAt + 1);
      const singleHandoffs = [
        [/^交接包 HO-001 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/, '交接包已构造'],
        [/^交接包 HO-001 {2}已投递 {3}\d{2}:\d{2}:\d{2}$/, '交接包已投递'],
        [/^交接包 HO-001 {2}已接受 {3}\d{2}:\d{2}:\d{2}$/, '交接包已接受'],
        [/^交接包 HO-001 {2}已完成 {3}\d{2}:\d{2}:\d{2}$/, '交接包已完成']
      ];
      c.check('And single run 交接包 4 行（A-1 第 7 段，无方向）', rHandoffs.length === singleHandoffs.length,
        `${rHandoffs.length} 行：${rHandoffs.join(' / ')}`);
      for (let i = 0; i < Math.min(singleHandoffs.length, rHandoffs.length); i += 1) {
        c.matches(`And single run 交接包第 ${i + 1} 行逐字（${singleHandoffs[i][1]}）`, rHandoffs[i], singleHandoffs[i][0]);
      }
      c.notIncludes('And single run 全文不出现「模板」', rt, '模板');
      c.notIncludes('And single run 节点行不带轮次', rt, ' · 第 ');
      c.notIncludes('And single run 不带事件序号', rt, '[#');

      const sst = c.cmd(statusText(rootB), 'orch status --instance INST-001（single）');
      const stt = text(sst);
      const sl = nonEmptyLines(stt);
      const singleStatus = [
        [/^实例 INST-001 · 已完成$/, '实例行'],
        [/^节点 已完成 · 耗时 \S+$/, '节点行'],
        [/^会话 空闲$/, '会话行'],
        [/^交接包 HO-001 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/, '交接包已构造'],
        [/^交接包 HO-001 {2}已投递 {3}\d{2}:\d{2}:\d{2}$/, '交接包已投递'],
        [/^交接包 HO-001 {2}已接受 {3}\d{2}:\d{2}:\d{2}$/, '交接包已接受'],
        [/^交接包 HO-001 {2}已完成 {3}\d{2}:\d{2}:\d{2}$/, '交接包已完成']
      ];
      c.check('And single status 段序与行数 = I1.2 A-2 的 single 列（7 行）', sl.length === singleStatus.length,
        `${sl.length} 行：${sl.join(' / ')}`);
      for (let i = 0; i < Math.min(singleStatus.length, sl.length); i += 1) {
        c.matches(`And single status 第 ${i + 1} 行逐字（${singleStatus[i][1]}）`, sl[i], singleStatus[i][0]);
      }
      c.notIncludes('And single status 全文不出现「模板」', stt, '模板');
      c.notIncludes('And single status 不出现方向箭头', stt, '→');
      c.notIncludes('And single status 不出现「升级」块', stt, '升级');

      // 状态侧证（code-loop 中间态仍是运行中；必须在停核心之前读，否则会被对账成 interrupted）
      const live = readState(rootA);
      c.eq("机检：code-loop 定格时实例 state='running'", live?.state, 'running');
      c.eq("机检：T-002 state='failed'、round=1", `${nodeOf(live, 'T-002')?.state}/${nodeOf(live, 'T-002')?.round}`, 'failed/1');
      c.eq('机检：只有 HO-001、HO-002', (live?.handoffs ?? []).map((h) => h.handoffId).join(','), 'HO-001,HO-002');
      c.eq("机检：HO-001 终态 'consumed'", handoffOf(live, 'HO-001')?.state, 'consumed');

      await keep.stop();
      keep = null;
      c.keep('code-loop driver --scenario backflow-once --stop-after 3 --keep（长驻，已停核心回收）', {
        argv: [NODE, CODE_DRIVER, '--root', rootA, '--scenario', 'backflow-once', '--stop-after', '3', '--keep'],
        stdout: `状态定格行数 ${gl.length}；marker=stopped-after-3`, stderr: ''
      }, [NODE, CODE_DRIVER, '--root', rootA, '--scenario', 'backflow-once', '--stop-after', '3', '--keep']);

      // ---------------------------------------------------------------- code-loop A-3（成功）
      // 注：code-loop 驱动把 `orch run` 的输出写到 stderr，自己在 stdout 打一行 JSON 摘要（exitCode 在 JSON 里）。
      const pass = c.cmd(codeLoopDriver(rootC, ['--scenario', 'code-pass']), 'code-loop-driver --scenario code-pass（A-3 成功路径）');
      const passJson = JSON.parse(String(pass.stdout).trim() || '{}');
      const pt = String(pass.stderr ?? '');
      c.eq('And code-loop A-3 的 orch run 退出码 0', passJson.exitCode, 0);
      const pl = nonEmptyLines(pt);
      c.matches('And A-3 第 1 行「实例 … · 运行中 · 模板 编码闭环」', pl[0], /^实例 INST-001 · 运行中 · 模板 编码闭环$/);
      c.matches('And A-3 第 2 行「会话已创建 <id>」', pl[1], /^会话已创建 \S+$/);
      c.eq('And A-3 第 3 行「任务已投递」', pl[2], '任务已投递');
      const nodeAt = pl.findIndex((l) => l.startsWith('节点 T-001 '));
      c.check('And A-3 结束段从两行节点开始', nodeAt > 0, `节点段起始行 ${nodeAt + 1}`);
      c.matches('And A-3 两行节点逐字（A-2 第 3 段）', `${pl[nodeAt]}\n${pl[nodeAt + 1]}`,
        /^节点 T-001 开发 已完成 · 第 1 轮 · 耗时 \S+\n节点 T-002 测试 已完成 · 第 1 轮 · 耗时 \S+ · 判定 通过$/);
      c.eq('And A-3 最后一行「升级 —」', pl.at(-1), '升级 —');
      c.notIncludes('And A-3 全文不出现「未知错误」', pt, '未知错误');
      c.notIncludes('And A-3 全文不出现「核对失败」', pt, '核对失败');

      // ---------------------------------------------------------------- code-loop A-4（挂起）
      const susp = c.cmd(codeLoopDriver(rootD, ['--scenario', 'backflow-twice']), 'code-loop-driver --scenario backflow-twice（A-4 挂起收尾）');
      const suspJson = JSON.parse(String(susp.stdout).trim() || '{}');
      const xt = String(susp.stderr ?? '');
      const xl = nonEmptyLines(xt);
      c.eq('And code-loop A-4 的 orch run 退出码 4', suspJson.exitCode, 4);
      const tail3 = xl.slice(-3);
      c.check('And A-4 收尾正好三行（不含流式会话行）', xl.length >= 3 && tail3.filter((l) => /^(实例|升级|下一步)/.test(l)).length === 3,
        `共 ${xl.length} 行，末三行：${tail3.join(' / ')}`);
      c.matches('And A-4 第 1 行「实例 … · 已挂起 · 模板 编码闭环」', tail3[0], /^实例 INST-001 · 已挂起 · 模板 编码闭环$/);
      c.matches('And A-4 第 2 行「升级 … 待处理 · 节点 T-002 测试 · 第 2 轮」', tail3[1], /^升级 ESC-\d+ 待处理 · 节点 T-002 测试 · 第 2 轮$/);
      c.eq('And A-4 第 3 行「下一步：…」', tail3[2],
        '下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001');
      c.notIncludes('And A-4 不打印节点表其余行/交接包行', xt, '交接包 HO-');
    } finally {
      if (keep) await keep.stop();
      for (const r of [rootA, rootB, rootC, rootD]) {
        c.cmd(coreStop(r), `orch core stop（${path.basename(r)}）`);
        await forceKillCore(r);
      }
    }
    return finish(c);
  }
}];
