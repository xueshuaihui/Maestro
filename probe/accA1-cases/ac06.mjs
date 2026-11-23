// AC-06 · 不可达 CLI 被保留并给出诊断（mock 面：诊断之不可达）
// Then：仍在清单 + 「已安装但不在 PATH」可见原因与修复提示 + 连接测试失败显示原因 + 状态未就绪 + 不空态。
// home 标记隔离按 P-3 用注入接缝；随后 probe 走真实 orch 命令面。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, orch, injectedScan, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-06';
const FACE = 'mock 面（诊断：不可达 / 注入接缝）';

export const cases = [{
  ac: AC,
  title: '不可达 CLI 被保留并给出诊断（规划子项：不可达诊断；§2.6 异常）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'diagnose' });
    const root = freshRoot(AC); c.add(root);
    const marker = path.join(root, 'home', '.codex');
    fs.mkdirSync(marker, { recursive: true });
    noteFixture(c, '仅 .codex home 标记，codex 不在命令搜索路径', marker);

    const scan = c.cmd(injectedScan(root, {
      home: path.join(root, 'home'), pathEntries: [], appDirs: []
    }, { writeRegistry: true }), '注入接缝 discoverAgentClis({home,pathEntries:[],appDirs:[]})');
    const listBefore = c.cmd(orch(root, ['list']), 'orch cli list（查看不可达诊断）');
    const probe = c.cmd(orch(root, ['probe', 'codex']), 'orch cli probe codex（不可达项连接测试）');
    const listAfter = c.cmd(orch(root, ['list']), 'orch cli list（探测后）');
    const reg = readRegistry(root);
    const f = (reg?.clis ?? []).find((x) => x.cli_id === 'codex');
    const scanDoc = JSON.parse(scan.stdout);
    const sf = scanDoc.findings.find((x) => x.cli_id === 'codex');

    c.eq('注入扫描退出码为 0', scan.exitCode, 0);
    c.eq('home marker 单独也列出：cli_id=codex', sf?.cli_id, 'codex');
    c.eq('executable=null（无可执行）', sf?.executable, null);
    c.eq('not_on_path=true', sf?.not_on_path, true);
    c.eq('connection_status=unreachable（用户可见「未就绪」）', sf?.connection_status, 'unreachable');
    c.check('清单保留该项且显示「已安装但不在 PATH」可见原因',
      listBefore.stdout.includes('codex') && listBefore.stdout.includes('已安装但不在 PATH'),
      listBefore.stdout.split('\n').filter((l) => l.includes('codex')).join(' / '));
    c.check('不是「什么都没扫到」的空态', !listBefore.stdout.includes('未发现可用的 Agent CLI'),
      listBefore.stdout.split('\n').slice(0, 6).join(' / '));
    c.eq('不可达项连接测试返回失败（exit 1）', probe.exitCode, 1);
    c.check('显示「探测失败 + 具体原因」', probe.stdout.includes('Codex CLI 探测失败：已安装但不在 PATH'), probe.stdout.trim());
    c.eq('探测后状态保持 unreachable', f?.connection_status, 'unreachable');
    c.check('探测不伪造 ACP 支持', f?.acp !== true, JSON.stringify(f?.acp));
    c.check('清单仍保留该项（探测后不空态）', listAfter.stdout.includes('codex'),
      listAfter.stdout.split('\n').filter((l) => l.includes('codex')).join(' / '));

    c.mid = { marker, finding: sf, probeStdout: probe.stdout, afterFinding: f, listStdout: listBefore.stdout };
    c.note('修复提示口径：状态列「已安装但不在 PATH」即 §2.3 允许的不可达提示形态；CLI_DISCOVERY_TEXT.HINT_ADD_PATH 文案提供手动登记建议（本迭代空态段展示）。逐项修复建议的独立呈现属 D-1 差距④，另案跟进，不放宽本 AC 判据。');
    return finish(c);
  }
}];
