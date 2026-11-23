// AC-15 · 空态与来源概览可见（mock 面：罗列 / 异常空态）
// Then：明确空态提示 + 「请安装一个 Agent CLI 后重新扫描」引导 + 来源概览（扫描了哪些来源、各自 0 项），不是空白页。
// 四类来源全空按 P-3 用注入接缝构造，避免扫到真实本机 PATH/HOME//Applications。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, orch, injectedScan, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-15';
const FACE = 'mock 面（罗列：空态 + 来源概览）';

export const cases = [{
  ac: AC,
  title: '空态与来源概览可见（§2.3 / §2.6 异常）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'empty' });
    const root = freshRoot(AC); c.add(root);
    noteFixture(c, '四类来源夹具均为空（PATH/app/npm/home 全空）', root);

    const scan = c.cmd(injectedScan(root, {
      pathEntries: [], appDirs: [], npmGlobalRoot: null, home: path.join(root, 'home')
    }, { writeRegistry: true }), '注入接缝扫描全空来源');
    const listed = c.cmd(orch(root, ['list']), 'orch cli list（空态）');
    const scanDoc = JSON.parse(scan.stdout);
    const t = listed.stdout;

    c.eq('扫描退出码 0', scan.exitCode, 0);
    c.eq('无证据即无 finding（误报 0）', scanDoc.findings.length, 0);
    c.eq('list 退出码 0', listed.exitCode, 0);
    c.check('明确空态提示「未发现可用的 Agent CLI」', t.includes('未发现可用的 Agent CLI'), t.split('\n').slice(0, 5).join(' / '));
    c.check('安装后重新扫描的引导（逐字）',
      t.includes('请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描'),
      t.split('\n').filter((l) => l.includes('请安装')).join(''));
    c.check('修复建议可见（手动添加路径）', t.includes('修复建议：'), t.split('\n').filter((l) => l.includes('修复建议')).join(''));
    c.check('来源概览可见（扫描了哪些来源）', t.includes('来源概览:'), t.split('\n').filter((l) => l.includes('来源概览')).join(''));
    c.check('各来源均发现 0 项', /path:0\s+home:0\s+app:0\s+npm-global:0\s+user-config:0/.test(t),
      t.split('\n').filter((l) => l.includes('来源概览')).join(''));
    c.check('不是空白页（含标题 + 空态 + 引导 + 来源概览）',
      t.includes('本机 Agent CLI') && t.length > 100, `${t.length} 字节 / ${t.split('\n').length} 行`);
    c.check('五列矩阵表头仍在空态显示',
      t.includes('ACP  |  stdio·transport  |  会话恢复方言  |  并发上限  |  证据钩子'),
      t.split('\n').filter((l) => l.includes('ACP')).join(''));

    c.mid = { fixtureRoot: root, scanStdout: scan.stdout, findings: scanDoc.findings, listStdout: t };
    c.note('空态判定走 CLI_DISCOVERY_TEXT.NONE / NONE_HINT / HINT_ADD_PATH 文案键，不依赖真实本机 PATH/HOME。');
    return finish(c);
  }
}];
