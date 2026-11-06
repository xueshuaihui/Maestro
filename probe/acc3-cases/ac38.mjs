// AC-38 通用任务闭环与编码闭环共用同一引擎（架构检查）。
// 只读源码做结构性取证：7 词零命中 + 推进链唯一 + 状态词单一来源 + 图只从模板目录注入。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, REPO, purity, text, requirementTitle, finish
} from '../acc3-f-common.mjs';
import { NODE_STATES, createNodeSM } from '../../src/core/state-machine.js';

const AC = 'AC-38';
const WORDS = ['task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者'];

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/** 取一个顶层函数体（到下一个同缩进的 `function` / `async function` 为止）。 */
function bodyOf(src, name) {
  const marker = `function ${name}(`;
  const at = src.indexOf(`  async ${marker}`) >= 0 ? src.indexOf(`  async ${marker}`) : src.indexOf(`  ${marker}`);
  if (at < 0) return '';
  const rest = src.slice(at);
  const rel = rest.slice(1).search(/\n {2}(async )?function /);
  return rel < 0 ? rest : rest.slice(0, rel + 1);
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '通用任务闭环与编码闭环共用同一引擎',
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });

    // 1) 7 词全表扫描（含注释）
    const scan = c.cmd(purity({ dirs: 'src/core,src/daemon', forbid: WORDS.join(',') }),
      `purity-check --dirs src/core,src/daemon --forbid ${WORDS.join(',')}`);
    c.eq('Then 7 词扫描退出码 0（零命中）', scan.exitCode, 0);
    c.includes('Then 扫描覆盖 src/core 与 src/daemon 全目录', text(scan), 'src/core, src/daemon');

    // 2) 推进入口链：driveGraph → finishGraphNode → advance → planAdvance
    const orch = read('src/core/orchestrator.js');
    const drive = bodyOf(orch, 'driveGraph');
    const advance = bodyOf(orch, 'advance');
    const advanceLocked = bodyOf(orch, 'advanceLocked');
    c.check('And orchestrator.js 有 driveGraph 定义', drive.length > 0, `${drive.length} 字符`);
    c.check('And driveGraph 内调用 finishGraphNode(', drive.includes('finishGraphNode('), 'driveGraph 函数体');
    c.check('And driveGraph 内调用 advance(', drive.includes('advance('), 'driveGraph 函数体');
    c.check('And advance 定义存在且委托 advanceLocked（同一把锁）', advance.includes('advanceLocked('), advance.slice(0, 200));
    c.check('And advanceLocked 内调用 planAdvance(', advanceLocked.includes('planAdvance('), 'advanceLocked 函数体');
    c.check('And planAdvance 由 src/core/advance.js 提供并被 orchestrator 导入',
      /import \{[^}]*planAdvance[^}]*\} from '\.\/advance\.js'/.test(orch), 'import { checkWakeGate, classifyNodeOutcome, planAdvance }');

    // 3) 两图共用一个入口：core 不按模板名分支、不出现模板名字面量
    const coreFiles = [];
    for (const dir of ['src/core', 'src/daemon']) {
      for (const name of fs.readdirSync(path.join(REPO, dir))) {
        if (!name.endsWith('.js')) continue;
        coreFiles.push({ rel: `${dir}/${name}`, body: read(`${dir}/${name}`) });
      }
    }
    const namedHits = coreFiles.filter((f) => /task-loop|code-loop/.test(f.body)).map((f) => f.rel);
    c.eq('And core/daemon 全目录不含 task-loop / code-loop 字面量', namedHits.join(',') || '（零命中）', '（零命中）');
    c.check('And 只有一处 advance 定义（两图共用同一推进入口）',
      (orch.match(/async function advance\(/g) ?? []).length === 1,
      `advance 定义 ${(orch.match(/async function advance\(/g) ?? []).length} 处`);
    c.check('And 只有一处 driveGraph 定义',
      (orch.match(/async function driveGraph\(/g) ?? []).length === 1,
      `driveGraph 定义 ${(orch.match(/async function driveGraph\(/g) ?? []).length} 处`);

    // 4) 节点状态词唯一来源：state-machine.js 的 NODE_STATES
    c.eq('And NODE_STATES 恰为 7 个节点状态', NODE_STATES.join(','), 'pending,running,review,done,failed,cancelled,escalated');
    const sm = createNodeSM();
    c.eq('And createNodeSM().states 与 NODE_STATES 逐字一致', sm.states.join(','), NODE_STATES.join(','));
    const legal = [
      ['pending', 'running'], ['running', 'review'], ['review', 'done'],
      ['done', 'running'], ['failed', 'running'], ['review', 'cancelled'], ['escalated', 'cancelled']
    ];
    c.check('And 迁移合法性由该表定义（回流唤醒 done→running、复测 failed→running、取消 escalated→cancelled 均合法）',
      legal.every(([from, to]) => sm.can(from, to).ok),
      legal.filter(([f, t]) => !sm.can(f, t).ok).map(([f, t]) => `${f}->${t}`).join(',') || '全部合法');
    c.check('And 表外迁移被拒（done→cancelled 非法）', sm.can('done', 'cancelled').ok === false, JSON.stringify(sm.can('done', 'cancelled')));
    const templates = read('src/templates/index.js');
    c.check('And 两图节点初始态取自 NODE_STATES（initialNodes 写 state=\'pending\'，pending ∈ NODE_STATES）',
      templates.includes("state: 'pending'") && NODE_STATES.includes('pending'), "initialNodes: state: 'pending'");

    // 5) 新图只通过 src/templates/index.js 注入
    c.check('And GRAPHS 在 src/templates/index.js 中登记 single / code-loop / task-loop',
      /export const GRAPHS = Object\.freeze\(\{ single, 'code-loop': codeLoop, 'task-loop': taskLoop \}\)/.test(templates),
      'GRAPHS = { single, code-loop, task-loop }');
    const coreImports = coreFiles
      .flatMap((f) => [...f.body.matchAll(/from '([^']*templates[^']*)'/g)].map((m) => `${f.rel} -> ${m[1]}`));
    c.check('And core/daemon 只从 ../templates/index.js 取图（不直接 import 单图文件）',
      coreImports.length > 0 && coreImports.every((s) => s.endsWith("templates/index.js'") || s.endsWith('templates/index.js')),
      coreImports.join('、'));
    c.check('And 引擎按实例的 template 名解析图（graphForState → resolveTemplate），不按图写分支',
      /function graphForState\(state\) \{\s*\n\s*const byName = resolveTemplate\(state\?\.template\);/.test(orch),
      'graphForState: resolveTemplate(state?.template)');

    // 6) review.js 不出现模板名或角色名
    const review = read('src/core/review.js');
    const leak = [...WORDS, 'code-loop', 'developer', 'tester', 'coordinator']
      .filter((w) => review.includes(w));
    c.eq('And src/core/review.js 不出现任何模板名或角色名', leak.join(',') || '（零命中）', '（零命中）');

    return finish(c);
  }
}];
