// AC-46 写命令只写 `.orch`，内置资产一字不动（边界 + 机检）
// Given 全新项目根 + assets/** 清单；When 九条写命令依次执行；
// 机检：九条全部退出 0；新增文件只在 .orch/** 与显式 --out 目录（夹具自放的 fixtures/ 除外，见 note）；
// assets sha256 清单前后逐字相同；git status --porcelain assets 为空；.orch/core.json 不存在。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, makeCase, freshRoot, listFiles, sha256File, readText, runCmd, exists,
  roleCreate, roleExport, roleImport, roleEdit, skillCreate, skillExport, skillImport, workflowCreate,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-46';

function assetManifest() {
  return listFiles(path.join(REPO, 'assets'))
    .map((rel) => `${rel}  ${sha256File(path.join(REPO, 'assets', ...rel.split('/')))}`)
    .join('\n');
}

/** 根目录快照：rel → sha256（夹具自放文件不计入「产品新增」判定，单独登记）。 */
function rootSnapshot(root) {
  const map = {};
  for (const rel of listFiles(root)) map[rel] = sha256File(path.join(root, ...rel.split('/')));
  return map;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：全新项目根 + assets 清单 + 技能正文夹具（fixtures/body.md，验收侧自放） ---
    const manifestBefore = assetManifest();
    c.evText('assets-manifest-before', manifestBefore);
    const bodyFile = path.join(root, 'fixtures', 'body.md');
    fs.mkdirSync(path.dirname(bodyFile), { recursive: true });
    fs.writeFileSync(bodyFile, '### 工作方法\n\n1. 记录结论与可核对的出处。\n', 'utf8');
    c.noteFixture('写 fixtures/body.md（skill create 的 --body-file 夹具，验收侧自放、非产品落盘）', '');
    const snapBefore = rootSnapshot(root);

    // --- When：九条写命令依次执行（参数形状按需求 §2.3 / A-4 / A-12） ---
    const r1 = c.cmd(roleCreate(root, 'lead-dev', ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'write', '--skills', 'code-change,test-run']),
      'orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run');
    const r2 = c.cmd(roleCreate(root, 'junior-dev', ['--from', 'lead-dev']),
      'orch role create junior-dev --from lead-dev');
    const r3 = c.cmd(roleExport(root, 'lead-dev', ['--out', 'exports/lead-dev.yaml']),
      'orch role export lead-dev --out exports/lead-dev.yaml');
    const r4 = c.cmd(roleImport(root, 'exports/lead-dev.yaml', ['--force']),
      'orch role import exports/lead-dev.yaml --force');
    const r5 = c.cmd(roleEdit(root, 'junior-dev', ['--set', 'summary=协助开发']),
      'orch role edit junior-dev --set summary=协助开发');
    const r6 = c.cmd(skillCreate(root, 'note-taker', ['--name', '记录员', '--summary', '记录结论与可核对的出处', '--applies-to', 'writing', '--body-file', 'fixtures/body.md']),
      'orch skill create note-taker --name 记录员 --summary 记录结论与可核对的出处 --applies-to writing --body-file fixtures/body.md');
    const r7 = c.cmd(skillExport(root, 'code-change', ['--out', 'exports/code-change.md']),
      'orch skill export code-change --out exports/code-change.md');
    const r8 = c.cmd(skillImport(root, 'exports/code-change.md'),
      'orch skill import exports/code-change.md');
    const r9 = c.cmd(workflowCreate(root, 'fork', ['--name', '分叉版', '--from', 'code-loop']),
      'orch workflow create fork --name 分叉版 --from code-loop');

    const all = [['role create', r1], ['role create --from', r2], ['role export --out', r3], ['role import', r4],
      ['role edit', r5], ['skill create', r6], ['skill export --out', r7], ['skill import', r8], ['workflow create', r9]];
    const exits = all.map(([label, res]) => `${label}: exit=${res.exitCode}`).join('；');
    c.evText('exits', exits);
    for (const [label, res] of all) c.evText(label.replace(/\s+/g, '-'), text(res));

    // --- Then：九条全部退出 0 ---
    c.eq('Then role create 退出 0', r1.exitCode, 0);
    c.eq('Then role create --from 退出 0', r2.exitCode, 0);
    c.eq('Then role export --out 退出 0', r3.exitCode, 0);
    c.eq('Then role import 退出 0', r4.exitCode, 0);
    c.eq('Then role edit 退出 0', r5.exitCode, 0);
    c.eq('Then skill create 退出 0', r6.exitCode, 0);
    c.eq('Then skill export --out 退出 0', r7.exitCode, 0);
    c.eq('Then skill import 退出 0', r8.exitCode, 0);
    c.eq('Then workflow create 退出 0', r9.exitCode, 0);

    // --- Then：九条写命令的落点恰在预期路径（.orch/roles、.orch/skills、.orch/workflows、--out） ---
    for (const rel of ['.orch/roles/lead-dev.yaml', '.orch/roles/junior-dev.yaml', '.orch/skills/note-taker/SKILL.md',
      '.orch/skills/code-change/SKILL.md', '.orch/workflows/fork.yaml', 'exports/lead-dev.yaml', 'exports/code-change.md']) {
      c.check(`Then 落点存在：${rel}`, exists(path.join(root, ...rel.split('/'))), rel);
    }

    // --- 机检：新增/变更文件只出现在 .orch/**、exports/**（--out）与 fixtures/**（夹具自放） ---
    const snapAfter = rootSnapshot(root);
    const touched = Object.keys(snapAfter)
      .filter((rel) => snapBefore[rel] !== snapAfter[rel])
      .concat(Object.keys(snapBefore).filter((rel) => !(rel in snapAfter)))
      .sort();
    c.evJson('touched-files', touched);
    const outside = touched.filter((rel) => !(rel.startsWith('.orch/') || rel.startsWith('exports/') || rel.startsWith('fixtures/')));
    c.eq('机检：新增/变更文件全部落在 .orch/**、exports/** 与 fixtures/**（夹具）之内', outside.join(','), '');

    // --- 机检：assets/** sha256 清单前后逐字相同；git status --porcelain assets 为空 ---
    const manifestAfter = assetManifest();
    c.evText('assets-manifest-after', manifestAfter);
    c.eq('机检：assets/** sha256 清单前后逐字相同', manifestAfter, manifestBefore);
    const st = c.cmd(runCmd(['git', 'status', '--porcelain', 'assets'], { cwd: REPO }), 'git status --porcelain assets');
    c.eq('机检：git status --porcelain assets 为空', clean(text(st)).trim(), '');

    // --- 机检：写命令不连核心 → .orch/core.json 不存在 ---
    c.eq('机检：.orch/core.json 不存在', exists(path.join(root, '.orch', 'core.json')), false);
    c.note('fixtures/body.md 是验收夹具自放文件（skill create 的 --body-file），单独登记于「新增/变更文件」白名单；产品九条命令的落点全部在 .orch/** 与显式 --out 目录 exports/**。');
    c.note('role import 用 --force：同一根里 exports/lead-dev.yaml 的 id（lead-dev）与第 1 条已建的项目角色重名，按 BR-08/09 --force 覆盖项目资产；内置 id 的只读拒绝由 AC-58 覆盖。');

    return finish(c);
  }
}];
