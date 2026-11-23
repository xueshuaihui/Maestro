// AC-05 · 用户配置 CLI 在扫描后保留（mock 面：重扫 / 用户配置）
// Then：重扫后该自定义 CLI 仍在清单中、信息与添加时一致，不被自动发现覆盖或抹掉。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, versionAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-05';
const FACE = 'mock 面（重扫 / 用户配置保留）';

export const cases = [{
  ac: AC,
  title: '用户配置 CLI 在扫描后保留（规划子项：扫描用户配置）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'rescan' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const tool = versionAgent(path.join(root, 'bin'), 'mytool', 'mytool 0.1');
    noteFixture(c, '自定义可执行 mytool（自动发现识别表不含该名字）', tool);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    const added = c.cmd(orch(root, ['add', '--name', 'MyCLI', '--path', tool], { env }), 'orch cli add --name MyCLI --path <tool>');
    const afterAdd = readRegistry(root);
    const ucAdd = (afterAdd?.user_config ?? []).find((x) => x.name === 'MyCLI');
    const fAdd = (afterAdd?.clis ?? []).find((x) => x.cli_id === 'mycli');

    const rescanned = c.cmd(orch(root, ['scan'], { env }), 'orch cli scan（重新扫描）');
    const afterScan = readRegistry(root);
    const ucScan = (afterScan?.user_config ?? []).find((x) => x.name === 'MyCLI');
    const fScan = (afterScan?.clis ?? []).find((x) => x.cli_id === 'mycli');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list');

    c.eq('add 退出码为 0', added.exitCode, 0);
    c.check('添加成功写入 user_config', Boolean(ucAdd), JSON.stringify(ucAdd ?? null));
    c.eq('添加时 name=MyCLI', ucAdd?.name, 'MyCLI');
    c.eq('添加时 path=夹具路径', ucAdd?.executable, tool);
    c.eq('添加即出现在清单（cli_id=mycli）', fAdd?.cli_id, 'mycli');
    c.eq('重扫退出码为 0', rescanned.exitCode, 0);
    c.eq('重扫后 cli_id 不变', ucScan?.cli_id, ucAdd?.cli_id);
    c.eq('重扫后 path 不变（与添加时一致）', ucScan?.executable, tool);
    c.eq('重扫后 user_config 唯一（未产生重复项）',
      (afterScan?.user_config ?? []).filter((x) => x.executable === tool).length, 1);
    c.eq('重扫后清单条目 cli_id 不变', fScan?.cli_id, 'mycli');
    c.eq('重扫后清单 path 不变', fScan?.executable, tool);
    c.check('重扫后清单仍含该项（未被抹掉）',
      listed.stdout.includes('MyCLI') && listed.stdout.includes(tool),
      listed.stdout.split('\n').filter((l) => l.includes('MyCLI')).join(' / '));
    c.check('清单中该条目 evidence type=user-config',
      (fScan?.evidence ?? []).some((e) => e.type === 'user-config'), JSON.stringify(fScan?.evidence));
    c.snap('after-add', { userConfig: afterAdd?.user_config, finding: fAdd });
    c.snap('after-rescan', { userConfig: afterScan?.user_config, finding: fScan });

    c.mid = { afterAdd: { userConfig: afterAdd?.user_config, finding: fAdd },
      afterScan: { userConfig: afterScan?.user_config, finding: fScan }, listStdout: listed.stdout };
    c.note('user_config 为第四类来源，registry 中以独立段持久化；重扫只刷新自动发现部分，不合写覆盖用户登记项。');
    return finish(c);
  }
}];
