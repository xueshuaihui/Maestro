// AC-56 架构纯净与零依赖（架构检查 / 静态源码面）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, runCmd, baseEnv, readJson, NODE, PURITY_CHECK, REPO,
  text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const FORBID = 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator';

const AC = 'AC-56';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: '架构检查（静态源码 + 命令）', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查（静态源码 + 命令）' });
    const root = freshRoot(AC); c.add(root);

    // When：purity-check（I1.2 四词 + I1.3 七词并集，不用脚本默认四词表）
    const r = c.cmd(runCmd([NODE, PURITY_CHECK, '--dirs', 'src/core,src/daemon', '--forbid', FORBID],
      { cwd: REPO, env: baseEnv() }), `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid ${FORBID}`);
    c.eq('Then：退出码 0', r.exitCode, 0);
    c.matches('Then：扫描文件数 > 0', text(r), /扫描 [1-9]\d* 个文件/);
    c.includes('Then：零命中', text(r), '零命中');

    // Then：package.json.dependencies 不存在或为空对象
    const pkg = readJson(path.join(REPO, 'package.json'));
    c.check('Then：package.json.dependencies 不存在或为空对象',
      !pkg?.dependencies || Object.keys(pkg.dependencies).length === 0,
      JSON.stringify(pkg?.dependencies ?? null));

    // 架构检查①：status.md 状态词与 labels.js 的逐词对照断言
    const labelsTest = path.join(REPO, 'test', 'wp2', 'labels.test.js');
    const ltSrc = fs.existsSync(labelsTest) ? fs.readFileSync(labelsTest, 'utf8') : '';
    c.check('架构检查：test/wp2/labels.test.js 存在', fs.existsSync(labelsTest), labelsTest);
    c.includes('架构检查：labels.test.js 含逐词对照断言（assert.equal）', ltSrc, 'assert.equal');
    c.includes('架构检查：labels.test.js 对照 labels.js 的状态词表（INSTANCE_LABEL）', ltSrc, 'INSTANCE_LABEL');
    c.includes('架构检查：labels.test.js 引用 labels.js 文案表', ltSrc, 'src/cli/labels.js');

    // 架构检查②：三个模板的交接包构造与校验都只经 src/core/handoff-schema.js（源码 import 检查）
    const adv = fs.readFileSync(path.join(REPO, 'src', 'core', 'advance.js'), 'utf8');
    const orc = fs.readFileSync(path.join(REPO, 'src', 'core', 'orchestrator.js'), 'utf8');
    const schema = fs.readFileSync(path.join(REPO, 'src', 'core', 'handoff-schema.js'), 'utf8');
    c.includes('架构检查：src/core/handoff-schema.js 定义唯一校验出口 validateHandoff', schema, 'export async function validateHandoff');
    c.includes('架构检查：orchestrator.js 只从 ./handoff-schema.js 引入校验', orc, "import { validateHandoff } from './handoff-schema.js'");
    c.notIncludes('架构检查：advance.js 只负责构造、不内联校验（无 validateHandoff 字面量）', adv, 'validateHandoff');
    const tplDir = path.join(REPO, 'src', 'templates');
    const inline = fs.readdirSync(tplDir).filter((f) => f.endsWith('.js')).filter((f) =>
      /validateHandoff|invalid_payload|EVIDENCE_UNREADABLE/.test(fs.readFileSync(path.join(tplDir, f), 'utf8')));
    c.check('架构检查：src/templates/** 不内联交接包校验（零命中）', inline.length === 0, inline.join(',') || '（无）');
    const idx = fs.readFileSync(path.join(tplDir, 'index.js'), 'utf8');
    c.notIncludes('架构检查：src/templates/index.js 不内联 import（构造/校验不在模板内）', idx, 'import ');
    for (const t of ['single', 'code-loop', 'task-loop']) {
      c.includes(`架构检查：模板 ${t} 定义存在`, idx, t);
    }
    return conclude(c, root);
  },
}];
