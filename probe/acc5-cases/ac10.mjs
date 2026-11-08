// AC-10 注册表不合法时发起前停住（夹具 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, prepareCodeLoop, writeRole, orch, text, exists, listFiles,
  requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-10';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：mock 宿主已配好（prepare-only 只写 .mock/ 与 .orch/hosts/mock.json，不启核心）
    c.cmd(prepareCodeLoop(root, 'pass'), '夹具：code-loop 驱动 --prepare-only --reset（配好 mock 宿主）');
    const roleFile = writeRole(root, 'ghost-skill', {
      id: 'ghost-skill',
      name: '幽灵技能',
      group: 'coding',
      summary: '引用了不存在的技能',
      artifactType: 'code',
      sideEffect: 'write',
      skills: ['no-such-skill'],
      tools: ['read'],
      wakeAllow: [],
      max: 1
    });
    c.noteFixture('写 .orch/roles/ghost-skill.yaml（技能不存在）', roleFile);
    fs.mkdirSync(path.join(root, 'demo'), { recursive: true });

    const res = c.cmd(orch(root, ['run', '--cwd', './demo', '--task', '写下说明', '--host', 'mock'], { timeout: 90000 }),
      'orch run --cwd ./demo --task 写下说明');
    const out = text(res);
    c.evText('run', out);

    c.eq('Then 退出码 3', res.exitCode, 3);
    c.includes('Then 终端出现「注册表不合法：」', out, '注册表不合法：');
    c.includes('Then 加第一条错误明细（A-5 版式，不带 - 前缀）', out,
      '注册表不合法：roles/ghost-skill.yaml：引用的技能不存在：no-such-skill（ROLE_SKILL_NOT_FOUND）');

    const instancesDir = path.join(root, '.orch', 'instances');
    const coreFile = path.join(root, '.orch', 'core.json');
    const prompts = listFiles(path.join(root, '.mock', 'prompts'));
    c.evJson('side-effects', {
      instancesDirExists: exists(instancesDir),
      coreJsonExists: exists(coreFile),
      prompts,
      orchTree: listFiles(path.join(root, '.orch'))
    });
    c.check('机检：.orch/instances 目录不存在', !exists(instancesDir), String(exists(instancesDir)));
    c.check('机检：.orch/core.json 不存在（没有启动核心）', !exists(coreFile), String(exists(coreFile)));
    c.eq('机检：./demo 下没有 .mock/prompts 帧', prompts.length, 0);

    return finish(c);
  }
}];
