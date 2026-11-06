// AC-37 I1.1 旧格式实例只读可查（v1 / schemaVersion=1）。
// 只读纪律：status / cancel / run --instance 之后，旧实例的 state.json 与 events.jsonl 字节必须不变。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, installLegacyV1, legacyV1Hashes, sha256File, orch, statusText, statusAll, cancel,
  text, lines, nonEmptyLines, coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-37';
const ID = 'OLD-001';
const MSG = '该实例为旧格式，本版本只支持查看';

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || 'I1.1 旧格式实例只读可查',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given 项目根里放入 I1.1 的 v1 实例（schemaVersion=1）
      const dir = installLegacyV1(root, ID);
      const base = legacyV1Hashes();
      const stateFile = path.join(dir, 'state.json');
      const eventsFile = path.join(dir, 'events.jsonl');
      const before = { state: sha256File(stateFile), events: sha256File(eventsFile) };
      const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      c.eq('Given 机检：样本 schemaVersion=1', raw.schemaVersion, 1);
      c.eq('Given 机检：装入的 state.json 与 SHA256SUMS 基线一致', before.state, base[`${ID}/state.json`]);
      c.eq('Given 机检：装入的 events.jsonl 与 SHA256SUMS 基线一致', before.events, base[`${ID}/events.jsonl`]);

      // When 执行 orch status --instance <旧实例号>
      const st = c.cmd(statusText(root, { instance: ID }), `orch status --instance ${ID}`);
      const t = text(st);
      const sl = nonEmptyLines(t);
      c.eq('Then status 退出码 0', st.exitCode, 0);
      c.eq('Then 第 1 行「实例 OLD-001 · 已完成」', sl[0], '实例 OLD-001 · 已完成');
      c.matches('Then 节点行正常显示（旧格式无节点号/角色/轮次）', sl[1], /^节点 已完成 · 耗时 \S+$/);
      c.eq('Then 会话行正常显示', sl[2], '会话 空闲');
      c.matches('Then 交接包行正常显示', sl[3], /^交接包 HO-001 {2}已构造 {3}\d{2}:\d{2}:\d{2}$/);
      c.check('Then 实例行 + 节点行 + 会话行 + 4 行交接包（共 7 行）', sl.length === 7, `${sl.length} 行：${sl.join(' / ')}`);
      c.notIncludes('Then 旧格式不显示模板', t, '模板');
      c.notIncludes('Then 旧格式不显示轮次', t, ' · 第 ');
      c.notIncludes('Then 旧格式不显示升级块', t, '升级');
      c.notIncludes('Then 旧格式交接包不带方向', t, '→');

      // 列表行（0 行列表）也走旧格式投影
      const all = c.cmd(statusAll(root), 'orch status（列表，旧格式投影）');
      const at = text(all);
      c.matches('Then 列表行正常显示（实例 · 状态 · 节点 · 会话 · 耗时 · 更新）', at,
        /^实例 OLD-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 \S+ · 更新 \d{2}:\d{2}:\d{2}$/m);
      c.notIncludes('Then 列表行不显示模板', at, '模板');
      c.notIncludes('Then 列表行不显示「待处理升级」', at, '待处理升级');

      // When 我执行 orch cancel --instance <旧实例号>
      const cc = c.cmd(cancel(root, ID), `orch cancel --instance ${ID}`);
      c.includes(`Then cancel 输出含「${MSG}」`, hitLine(text(cc), MSG), MSG);
      c.eq('Then cancel 退出码 1', cc.exitCode, 1);

      // 或 orch run --instance <旧实例号> …
      fs.mkdirSync(path.join(root, 'work'), { recursive: true });
      const rr = c.cmd(
        orch(root, ['run', '--cwd', './work', '--instance', ID, '--task', '写一段说明，保存到 out/intro.md']),
        `orch run --cwd ./work --instance ${ID} --task "写一段说明，保存到 out/intro.md"`
      );
      c.includes(`Then run --instance 输出含「${MSG}」`, hitLine(text(rr), MSG), MSG);
      c.eq('Then run --instance 退出码 1', rr.exitCode, 1);

      // And 机检：旧实例的 state.json 字节未改变
      const after = { state: sha256File(stateFile), events: sha256File(eventsFile) };
      c.eq('And 机检：state.json sha256 未改变', after.state, before.state);
      c.eq('And 机检：events.jsonl sha256 未改变', after.events, before.events);
      c.eq('And 机检：state.json 仍逐字等于 SHA256SUMS 基线', after.state, base[`${ID}/state.json`]);
      c.check('And 机检：没有出现新实例（旧实例目录仍是唯一目录）',
        fs.readdirSync(path.join(root, '.orch', 'instances')).join(',') === ID,
        fs.readdirSync(path.join(root, '.orch', 'instances')).join(','));
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
