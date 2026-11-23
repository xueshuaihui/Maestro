// AC-02 · 版本信息准确（mock 面：能力探测之版本维度）
// Then：版本显示为探测实际读到的版本文本、与自报一致；未探测前显示占位而非编造。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, versionAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-02';
const FACE = 'mock 面（能力探测：版本）';

export const cases = [{
  ac: AC,
  title: '版本信息准确（规划验收句「信息准确」的版本维度）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'probe' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const bin = versionAgent(path.join(root, 'bin'), 'codex', 'codex 1.2.3');
    noteFixture(c, 'PATH 夹具 codex 自报版本 codex 1.2.3', bin);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    c.cmd(orch(root, ['scan'], { env }), 'orch cli scan');
    const beforeList = c.cmd(orch(root, ['list'], { env }), 'orch cli list（探测前）');
    const beforeReg = readRegistry(root);
    const beforeF = (beforeReg?.clis ?? []).find((x) => x.cli_id === 'codex');
    const probed = c.cmd(orch(root, ['probe', 'codex'], { env }), 'orch cli probe codex（版本维度）');
    const afterList = c.cmd(orch(root, ['list'], { env }), 'orch cli list（探测后）');
    const afterReg = readRegistry(root);
    const afterF = (afterReg?.clis ?? []).find((x) => x.cli_id === 'codex');

    c.eq('未探测前版本为占位 null（不编造）', beforeF?.version, null);
    c.check('探测前清单版本列为占位「-」',
      beforeList.stdout.includes('codex  |  Codex CLI  |  -'),
      beforeList.stdout.split('\n').filter((l) => l.includes('codex')).join(' / '));
    c.eq('probe 退出码为 0', probed.exitCode, 0);
    c.eq('探测后版本=实际读到的文本，与可执行文件自报一致', afterF?.version, 'codex 1.2.3');
    c.check('探测后清单版本列显示 codex 1.2.3',
      afterList.stdout.includes('codex 1.2.3'),
      afterList.stdout.split('\n').filter((l) => l.includes('codex')).join(' / '));
    c.eq('版本取首个非空行（A1-11 口径）', afterF?.version?.split('\n')[0], 'codex 1.2.3');
    c.check('发现阶段不自动探测：beforeF.verified_at 为 null', beforeF?.verified_at === null, JSON.stringify(beforeF?.verified_at));
    c.check('探测刷新 verified_at', Boolean(afterF?.verified_at), JSON.stringify(afterF?.verified_at));

    c.mid = {
      beforeFinding: beforeF, probeStdout: probed.stdout,
      afterFinding: afterF, beforeListSnippet: beforeList.stdout.split('\n').filter((l) => l.includes('codex')),
      afterListSnippet: afterList.stdout.split('\n').filter((l) => l.includes('codex'))
    };
    c.note('版本探测成功但 ACP 握手对纯 shell 脚本返回「不支持」，故探测后状态为未就绪；本 AC 只判版本维度。');
    return finish(c);
  }
}];
