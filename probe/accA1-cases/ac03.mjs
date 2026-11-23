// AC-03 · 应用目录中的 CLI 被识别（mock 面：发现之应用目录）
// Then：清单出现 WorkBuddy / 来源 app / 路径显示安装位置 / 不在 PATH 状态未就绪 + 「已安装但不在 PATH」提示 / 不被丢弃。
// 命令面无 appDirs 注入参数，按 P-3 用适配器注入接缝隔离该来源（子进程级，非 mock 顶替）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, orch, injectedScan, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-03';
const FACE = 'mock 面（发现：应用目录 / 注入接缝）';

export const cases = [{
  ac: AC,
  title: '应用目录中的 CLI 被识别（规划子项：扫描应用目录）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'scan' });
    const root = freshRoot(AC); c.add(root);
    const app = path.join(root, 'apps', 'WorkBuddy.app');
    fs.mkdirSync(app, { recursive: true });
    noteFixture(c, '应用目录夹具放入 WorkBuddy.app 安装标记（不加入 PATH）', app);

    const scan = c.cmd(injectedScan(root, {
      appDirs: [path.join(root, 'apps')], home: path.join(root, 'home'), pathEntries: []
    }, { writeRegistry: true }), '注入接缝 discoverAgentClis({appDirs,home,pathEntries:[]})');
    const listed = c.cmd(orch(root, ['list']), 'orch cli list');
    const scanDoc = JSON.parse(scan.stdout);
    const reg = readRegistry(root);
    const f = scanDoc.findings.find((x) => x.cli_id === 'workbuddy');
    const rf = (reg?.clis ?? []).find((x) => x.cli_id === 'workbuddy');

    c.eq('注入扫描退出码为 0', scan.exitCode, 0);
    c.eq('清单出现 WorkBuddy：name 逐字', f?.name, 'WorkBuddy');
    c.eq('路径/安装位置来自 app evidence', f?.evidence?.find((e) => e.type === 'app')?.value, app);
    c.check('来源标注为应用目录（evidence type=app）',
      (f?.evidence ?? []).some((e) => e.type === 'app'), JSON.stringify(f?.evidence));
    c.eq('不在 PATH → 状态 unreachable（用户可见「未就绪」）', f?.connection_status, 'unreachable');
    c.eq('not_on_path=true（未被丢弃）', f?.not_on_path, true);
    c.eq('executable 为 null（仅安装标记）', f?.executable, null);
    c.check('清单行含「未就绪 (已安装但不在 PATH)」原因（§2.3 允许的路径展示形态）',
      listed.stdout.includes('workbuddy') && listed.stdout.includes('未就绪 (已安装但不在 PATH)'),
      listed.stdout.split('\n').filter((l) => l.includes('workbuddy')).join(' / '));
    c.check('来源概览计入 app', listed.stdout.includes('app:1'), listed.stdout.split('\n').filter((l) => l.includes('来源概览')).join(''));
    c.check('注册表保留该不可达项（未静默丢弃）', Boolean(rf), JSON.stringify(rf?.cli_id ?? null));

    c.mid = { fixtureApp: app, finding: f, registryFinding: rf, listStdout: listed.stdout };
    c.note('「路径显示安装位置」按 §2.3 口径核对：app evidence 指向夹具安装目录，清单状态列显示「已安装但不在 PATH」；未伪造 executable 路径。');
    return finish(c);
  }
}];
