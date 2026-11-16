// 批次 a 用例共享底座（下划线开头，runner 不加载为用例）。
// 纪律：用例只读产品；机检走 wp14 测试 + 需求原文架构检查；判定引用需求 Then 逐字，
//       不采信测试自述——故把「逐字字面量必须在测试源码出现」与「机检 F-16 通过」并列为核对项。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, finish, requirementTitle, freshRoot, coreStop, runNodeTest, checkF16,
  grepCheck, renderArchFrame, checkArch
} from '../acc10b-f-common.mjs';

/**
 * standardCase(ac, cfg)
 * cfg: {
 *   face, testFile, arch:[{label,pattern,target,expect}],
 *   literals:[str]        // 需求 Then / 附录 A 的逐字片段，必须出现在测试源码
 *   literalAbsent:[str]   // 必须不出现（如「已关闭」「undefined」）
 *   extra(c, {src, checks}) // 追加 AC 专属核对
 *   notes:[str]
 * }
 */
export function standardCase(ac, cfg) {
  return {
    ac,
    title: requirementTitle(ac),
    face: cfg.face ?? 'mock 实测',
    async run() {
      const c = makeCase(ac, { title: requirementTitle(ac), face: cfg.face ?? 'mock 实测' });
      const root = freshRoot(ac);
      c.add(root);
      c.noteFixture('独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）', root);

      // 1) 机检 F-16：先 test -f，再 node --test；保留 stdout 原始帧与测试源。
      const t = runNodeTest(cfg.testFile, { label: `node --test test/wp14/${cfg.testFile}` });
      c.cmd(t.res, t.res.label);
      checkF16(c, t, `机检 F-16（test/wp14/${cfg.testFile}）`);
      c.frame('tests.stdout', 'txt', t.res.stdout + (t.res.stderr ? `\n--- stderr ---\n${t.res.stderr}` : ''));
      c.frame('test.source', 'txt', t.src);

      // 2) 架构检查（需求同号原文，grep -REn / ERE）。
      const checks = (cfg.arch ?? []).map((a) => grepCheck(a.label, a.pattern, a.target, a.expect));
      checkArch(c, checks);
      c.frame('arch.stdout', 'txt', renderArchFrame(checks));

      // 3) 判定引用需求 Then 逐字：逐字字面量必须在机检源码里出现（机检确由该 Then 承载）。
      for (const lit of (cfg.literals ?? [])) {
        c.includes(`Then 逐字：${lit}`, t.src, lit);
      }
      for (const lit of (cfg.literalAbsent ?? [])) {
        c.notIncludes(`Then 逐字禁项：${lit}`, t.src, lit);
      }

      // 4) AC 专属追加核对（数量/时序/字段级）。
      if (typeof cfg.extra === 'function') await cfg.extra(c, { src: t.src, checks, root });

      // 5) 该 AC 独立根收尾 + 原始帧。
      const stop = coreStop(root);
      c.cmd(stop);
      c.frame('corestop', 'txt', `exit=${stop.exitCode}\n${stop.stdout}\n${stop.stderr}`);
      // 纯投影机检面无落盘实例：写带说明的 state/events 原始帧，保证 ≥4 文件且非空。
      if (!c.frames.some((f) => f.name === 'state')) {
        c.frame('state', 'json', JSON.stringify({
          __note: '本 AC 走 createApp/createDrillView 纯投影机检面；夹具指纹见 test.source 与 tests.stdout',
          ac, NODE_ENV: 'test', host: 'mock', root
        }, null, 2));
      }
      if (!c.frames.some((f) => f.name === 'events')) {
        c.frame('events', 'jsonl', JSON.stringify({ __note: '纯投影机检面无落盘事件帧', ac }) + '\n');
      }

      for (const n of (cfg.notes ?? [])) c.note(n);
      return finish(c);
    }
  };
}
