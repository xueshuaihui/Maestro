// AC-13 · 规划验收句②：手动添加自定义 CLI 可执行（mock 面：手加）
// Then：出现在清单且名称/路径一致 + 可连接测试并看到结果 + 重复路径被拒不重复 + 非法输入被拒给出原因不写入。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, baseEnv, orch, speakingAgent, readRegistry, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-13';
const FACE = 'mock 面（手动添加）';

export const cases = [{
  ac: AC,
  title: '规划验收句②：手动添加自定义 CLI 可执行',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'add' });
    const root = freshRoot(AC); c.add(root);
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    const tool = speakingAgent(path.join(root, 'bin'), 'mytool', 'mytool 0.1');
    noteFixture(c, '自定义可执行 mytool（speaking agent，自动发现不识别）', tool);
    const env = baseEnv({ PATH: path.join(root, 'bin'), HOME: path.join(root, 'home') });

    const added = c.cmd(orch(root, ['add', '--name', 'MyCLI', '--path', tool], { env }), 'orch cli add --name MyCLI --path <mytool>');
    const listed = c.cmd(orch(root, ['list'], { env }), 'orch cli list');
    const probed = c.cmd(orch(root, ['probe', 'mycli'], { env }), 'orch cli probe mycli（连接测试）');
    const duplicate = c.cmd(orch(root, ['add', '--name', 'MyCLI2', '--path', tool], { env }), 'orch cli add 重复路径');
    const emptyName = c.cmd(orch(root, ['add', '--name', '', '--path', tool], { env }), 'orch cli add 空名称');
    const emptyPath = c.cmd(orch(root, ['add', '--name', 'X', '--path', ''], { env }), 'orch cli add 空路径');
    const missing = c.cmd(orch(root, ['add', '--name', 'X', '--path', path.join(root, 'nope')], { env }), 'orch cli add 不存在文件');
    const reg = readRegistry(root);
    const uc = reg?.user_config ?? [];
    const f = (reg?.clis ?? []).find((x) => x.cli_id === 'mycli');

    c.eq('add 退出码 0', added.exitCode, 0);
    c.check('添加成功提示含名称与路径', added.stdout.includes('已添加 MyCLI') && added.stdout.includes(tool), added.stdout.trim());
    c.eq('清单中该 CLI 名称与用户填写一致', uc.find((x) => x.name === 'MyCLI')?.name, 'MyCLI');
    c.eq('清单中该 CLI 路径与用户填写一致', uc.find((x) => x.name === 'MyCLI')?.executable, tool);
    c.check('出现在清单中', listed.stdout.includes('MyCLI') && listed.stdout.includes(tool),
      listed.stdout.split('\n').filter((l) => l.includes('MyCLI')).join(' / '));
    c.eq('可连接测试：probe 退出码 0', probed.exitCode, 0);
    c.check('连接测试结果可见（ACP 支持）', probed.stdout.includes('MyCLI 探测完成：ACP 支持'), probed.stdout.trim());
    c.eq('探测结果写入该项（acp=true）', f?.acp, true);
    c.eq('重复添加同路径被拒绝（exit 1）', duplicate.exitCode, 1);
    c.check('重复添加给出「已存在」原因', duplicate.stdout.includes('已存在：') && duplicate.stdout.includes('未重复添加'), duplicate.stdout.trim());
    c.eq('重复添加不产生重复项：user_config 仍为 1', uc.length, 1);
    c.eq('空名称被拒绝', emptyName.exitCode, 1);
    c.check('空名称给出原因', emptyName.stdout.includes('添加失败：名称为空'), emptyName.stdout.trim());
    c.eq('空路径被拒绝', emptyPath.exitCode, 1);
    c.check('空路径给出原因', emptyPath.stdout.includes('添加失败：路径为空'), emptyPath.stdout.trim());
    c.eq('不存在文件被拒绝', missing.exitCode, 1);
    c.check('不存在文件给出原因', missing.stdout.includes('添加失败：文件不存在'), missing.stdout.trim());
    c.eq('非法输入均不写入清单：user_config 恒为 1', uc.length, 1);

    c.mid = { tool, addedStdout: added.stdout, probeStdout: probed.stdout,
      rejects: { duplicate: duplicate.stdout, emptyName: emptyName.stdout, emptyPath: emptyPath.stdout, missing: missing.stdout },
      finalUserConfig: uc };
    c.note('add 只登记路径，不安装、不修改该 CLI 自身配置；非法/重复输入返回失败数据，不改变注册表。');
    return finish(c);
  }
}];
