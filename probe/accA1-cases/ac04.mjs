// AC-04 · 包管理器全局包被识别（mock 面：发现之包管理器）
// Then：清单出现 OpenCode / 来源 npm-global / 路径显示全局包位置 / 状态未就绪并提示不在 PATH。
// 命令面无 npmGlobalRoot 注入参数，按 P-3 用适配器注入接缝隔离该来源。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, orch, injectedScan, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-04';
const FACE = 'mock 面（发现：包管理器 / 注入接缝）';

export const cases = [{
  ac: AC,
  title: '包管理器全局包被识别（规划子项：扫描包管理器）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'scan' });
    const root = freshRoot(AC); c.add(root);
    const pkg = path.join(root, 'npm', 'opencode-ai');
    fs.mkdirSync(pkg, { recursive: true });
    noteFixture(c, 'npm 全局根夹具放入 opencode-ai 包目录（不加入 PATH）', pkg);

    const scan = c.cmd(injectedScan(root, {
      npmGlobalRoot: path.join(root, 'npm'), home: path.join(root, 'home'),
      pathEntries: [], appDirs: []
    }, { writeRegistry: true }), '注入接缝 discoverAgentClis({npmGlobalRoot,home,pathEntries:[],appDirs:[]})');
    const listed = c.cmd(orch(root, ['list']), 'orch cli list');
    const scanDoc = JSON.parse(scan.stdout);
    const reg = readRegistry(root);
    const f = scanDoc.findings.find((x) => x.cli_id === 'opencode');
    const rf = (reg?.clis ?? []).find((x) => x.cli_id === 'opencode');

    c.eq('注入扫描退出码为 0', scan.exitCode, 0);
    c.eq('清单出现对应 OpenCode：name 逐字', f?.name, 'OpenCode');
    c.eq('路径/全局包位置来自 npm-global evidence', f?.evidence?.find((e) => e.type === 'npm-global')?.value, pkg);
    c.check('来源标注为包管理器全局包（evidence type=npm-global）',
      (f?.evidence ?? []).some((e) => e.type === 'npm-global'), JSON.stringify(f?.evidence));
    c.eq('不在 PATH → 状态 unreachable（用户可见「未就绪」）', f?.connection_status, 'unreachable');
    c.eq('not_on_path=true 且提示不在 PATH', f?.not_on_path, true);
    c.check('清单行含「未就绪 (已安装但不在 PATH)」',
      listed.stdout.includes('opencode') && listed.stdout.includes('未就绪 (已安装但不在 PATH)'),
      listed.stdout.split('\n').filter((l) => l.includes('opencode')).join(' / '));
    c.check('来源概览计入 npm-global', listed.stdout.includes('npm-global:1'),
      listed.stdout.split('\n').filter((l) => l.includes('来源概览')).join(''));
    c.check('注册表保留该全局包项', Boolean(rf), JSON.stringify(rf?.cli_id ?? null));

    c.mid = { fixturePkg: pkg, finding: f, registryFinding: rf, listStdout: listed.stdout };
    c.note('默认 npmGlobalRoot=null 时不臆造全局包发现；本 AC 通过注入接缝提供夹具全局根。');
    return finish(c);
  }
}];
