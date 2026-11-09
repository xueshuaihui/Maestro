// AC-48 I1.5 的 role 三命令逐字不变（回归 + D-7b 追加断言）
// 基线来源（两条腿）：
//  ① 需求点名的存量证据 docs/iterations/iteration-5/evidence/：
//     role list ↔ AC-01.list.txt；role show developer ↔ AC-02.show.txt；
//     role validate ↔ AC-12.validate.txt（I1.5 里唯一「全新根干净校验」基线，
//     AC-04/AC-05 的 validate.txt 是带坏夹具的输出、不对应本 AC 的命令）；
//     role list --format json ↔ AC-01.payload.json；role validate --format json ↔ AC-12.payload.json；
//     role show developer --format json ↔ AC-45.output.json 中该命令的 stdout
//     （I1.5 AC-45 的根只多了一份项目技能覆盖，role 对象不含技能明细，payload 逐字节等价于全新根产出）。
//  ② 0cd113b 基线代码树（git worktree，I1.5 AC-19 同款方法）：I1.5 存量证据没有
//     内置 researcher / writer 的 show 文本与三条 show --format json，按 I1.5 收口提交
//     0cd113b 现跑取基线（BASELINE_COMMIT，acc6-f-lib 导出）。
// D-7b 追加断言（只加不减）：可唤醒两行逐字新值 + 其余行与 I1.5 逐字节相同 +
// JSON 与 I1.5 逐字节相同（10 键、无 wake/wakeAllow）+ 资产比对恰好两处 wake_allow 差异。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, BASE, BASELINE_COMMIT, makeCase, freshRoot, runCmd, orchOf, nodeTest, exists, readText,
  roleList, roleShow, roleValidate, jsonOf, diffLines, nonEmptyLines, clean,
  text, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-48';
const I15_EVID = path.join(REPO, 'docs', 'iterations', 'iteration-5', 'evidence');
const WAKE_RESEARCHER = '  可唤醒：writer';
const WAKE_WRITER = '  可唤醒：editor, reviewer';
// 0cd113b 基线侧的可唤醒行（D-7b 改动前）：researcher 的 wake_allow 为 [] → 「—」；
// writer 的 wake_allow 在 0cd113b 里是块列表 `wake_allow:\n  - editor` → 「editor」。
const BASE_WAKE = { researcher: '  可唤醒：—', writer: '  可唤醒：editor' };

const treeDir = () => path.join(BASE, `${AC}-baseline`);

function ensureBaselineTree() {
  const dir = treeDir();
  if (exists(dir)) runCmd(['git', 'worktree', 'remove', '--force', dir], { cwd: REPO });
  runCmd(['git', 'worktree', 'prune'], { cwd: REPO });
  const add = runCmd(['git', 'worktree', 'add', '--detach', dir, BASELINE_COMMIT], { cwd: REPO, timeout: 120000 });
  return { dir, add };
}

function dropBaselineTree() {
  const dir = treeDir();
  runCmd(['git', 'worktree', 'remove', '--force', dir], { cwd: REPO });
  runCmd(['git', 'worktree', 'prune'], { cwd: REPO });
  fs.rmSync(dir, { recursive: true, force: true });
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  timeoutMs: 420_000,
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);
    c.note(`基线来源：① docs/iterations/iteration-5/evidence/ 存量证据（AC-01.list / AC-02.show / AC-12.validate 及对应 payload；AC-45.output.json 抽取 show developer --format json）；② ${BASELINE_COMMIT} 基线代码树（git worktree）现跑补齐 I1.5 证据缺失的内置 researcher/writer show 文本与三条 show --format json。切取规则：存量 .txt/.json 证据去掉尾随空行后逐行比对（diffLines，行首尾不改）。`);

    const { dir: tree, add } = ensureBaselineTree();
    try {
      c.eq('Given 基线代码树挂载成功（git worktree 0cd113b）', add.exitCode, 0);
      c.check('Given 基线树 bin/orch.js 存在', exists(path.join(tree, 'bin', 'orch.js')), tree);

      // ---------------- ① 六条主命令 vs I1.5 存量证据 ----------------
      // role list
      const list = c.cmd(roleList(root), 'orch role list');
      c.evText('list', text(list));
      c.eq('Then role list 退出 0', list.exitCode, 0);
      const baseList = clean(readText(path.join(I15_EVID, 'AC-01.list.txt')) ?? '');
      const dList = diffLines(clean(text(list)), baseList);
      c.evText('diff-list', dList.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
      c.check('Then role list 与 I1.5 基线（AC-01.list.txt）逐字节相同', dList.same,
        `${dList.diffs.length} 行差异：${JSON.stringify(dList.diffs.slice(0, 3))}`);

      // role show developer
      const show = c.cmd(roleShow(root, 'developer'), 'orch role show developer');
      c.evText('show-developer', text(show));
      c.eq('Then role show developer 退出 0', show.exitCode, 0);
      const baseShow = clean(readText(path.join(I15_EVID, 'AC-02.show.txt')) ?? '');
      const dShow = diffLines(clean(text(show)), baseShow);
      c.evText('diff-show-developer', dShow.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
      c.check('Then role show developer 与 I1.5 基线（AC-02.show.txt）逐字节相同', dShow.same,
        `${dShow.diffs.length} 行差异：${JSON.stringify(dShow.diffs.slice(0, 3))}`);

      // role validate（全新根干净校验 → I1.5 AC-12 是唯一干净基线）
      const validate = c.cmd(roleValidate(root), 'orch role validate');
      c.evText('validate', text(validate));
      c.eq('Then role validate 退出 0', validate.exitCode, 0);
      const baseValidate = clean(readText(path.join(I15_EVID, 'AC-12.validate.txt')) ?? '');
      const dValidate = diffLines(clean(text(validate)), baseValidate);
      c.evText('diff-validate', dValidate.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
      c.check('Then role validate 与 I1.5 基线（AC-12.validate.txt，全新根干净校验）逐字节相同', dValidate.same,
        `${dValidate.diffs.length} 行差异：${JSON.stringify(dValidate.diffs.slice(0, 3))}`);

      // role list --format json
      const listJson = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
      c.evText('list-json', text(listJson));
      c.eq('Then role list --format json 退出 0', listJson.exitCode, 0);
      const baseListJson = clean(readText(path.join(I15_EVID, 'AC-01.payload.json')) ?? '');
      const dListJson = diffLines(clean(text(listJson)), baseListJson);
      c.evText('diff-list-json', dListJson.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
      c.check('Then role list --format json 与 I1.5 基线（AC-01.payload.json）逐字节相同', dListJson.same,
        `${dListJson.diffs.length} 行差异：${JSON.stringify(dListJson.diffs.slice(0, 3))}`);

      // role validate --format json
      const valJson = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
      c.evText('validate-json', text(valJson));
      c.eq('Then role validate --format json 退出 0', valJson.exitCode, 0);
      const baseValJson = clean(readText(path.join(I15_EVID, 'AC-12.payload.json')) ?? '');
      const dValJson = diffLines(clean(text(valJson)), baseValJson);
      c.evText('diff-validate-json', dValJson.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
      c.check('Then role validate --format json 与 I1.5 基线（AC-12.payload.json）逐字节相同', dValJson.same,
        `${dValJson.diffs.length} 行差异：${JSON.stringify(dValJson.diffs.slice(0, 3))}`);

      // role show developer --format json（I1.5 AC-45.output.json 中的 stdout 抽取）
      const showJson = c.cmd(roleShow(root, 'developer', ['--format', 'json']), 'orch role show developer --format json');
      c.evText('show-developer-json', text(showJson));
      c.eq('Then role show developer --format json 退出 0', showJson.exitCode, 0);
      const ac45Out = JSON.parse(readText(path.join(I15_EVID, 'AC-45.output.json')) ?? '{}');
      const baseShowJson = clean(ac45Out?.commands?.find((x) => String(x.label ?? '').includes('show developer --format json'))?.stdout ?? '');
      c.check('Given I1.5 AC-45.output.json 里能抽到 show developer --format json 的 stdout', baseShowJson.length > 0, String(baseShowJson).slice(0, 80));
      const dShowJson = diffLines(clean(text(showJson)), baseShowJson);
      c.evText('diff-show-developer-json', dShowJson.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
      c.check('Then role show developer --format json 与 I1.5 基线逐字节相同', dShowJson.same,
        `${dShowJson.diffs.length} 行差异：${JSON.stringify(dShowJson.diffs.slice(0, 3))}`);

      // ---------------- ② D-7b 追加断言（基线代码树现跑补齐） ----------------
      const pairs = [
        ['researcher', WAKE_RESEARCHER, 'role show researcher'],
        ['writer', WAKE_WRITER, 'role show writer']
      ];
      // 逐键集合对比辅助：removed = 基线有而当前无；added = 当前有而基线无（语义级差异，不受行对齐影响）。
      const setDiff = (baseText, curText) => {
        const a = nonEmptyLines(baseText);
        const b = nonEmptyLines(curText);
        return { removed: a.filter((l) => !b.includes(l)), added: b.filter((l) => !a.includes(l)) };
      };
      for (const [id, wakeLine, label] of pairs) {
        // 文本：当前 vs 基线树 —— 期望恰好「可唤醒」一行不同
        const cur = c.cmd(roleShow(root, id), `${label}（当前 HEAD）`);
        const bas = c.cmd(orchOf(tree, root, ['role', 'show', id]), `${label}（${BASELINE_COMMIT} 基线树）`);
        c.evText(`show-${id}`, text(cur));
        c.evText(`show-${id}-baseline`, text(bas));
        c.eq(`Then ${label} 退出 0`, cur.exitCode, 0);
        const d = diffLines(clean(text(cur)), clean(text(bas)));
        c.eq(`机检：${label} 与 I1.5 基线恰好一行差异（唯一例外：可唤醒行）`, d.diffs.length, 1);
        c.eq(`机检：${label} 基线侧的可唤醒行是 D-7b 改动前的值`,
          (d.diffs.find((x) => String(x.b).startsWith('  可唤醒：')) ?? {}).b ?? null, BASE_WAKE[id]);
        c.lineEq(`Then ${label} 的可唤醒行逐字（D-7b 新值）`,
          (d.diffs.find((x) => String(x.a).startsWith('  可唤醒：')) ?? {}).a ?? null, wakeLine);
        c.check(`Then ${label} 其余行仍与 I1.5 逐字节相同（差异只有可唤醒行）`,
          d.diffs.every((x) => String(x.a).startsWith('  可唤醒：') && String(x.b).startsWith('  可唤醒：')),
          `${d.diffs.length} 行差异：${JSON.stringify(d.diffs)}`);

        // JSON：与基线树逐字节相同 + 10 键 + 无 wake/wakeAllow
        const curJson = c.cmd(roleShow(root, id, ['--format', 'json']), `${label} --format json（当前 HEAD）`);
        const basJson = c.cmd(orchOf(tree, root, ['role', 'show', id, '--format', 'json']), `${label} --format json（${BASELINE_COMMIT} 基线树）`);
        c.evText(`show-${id}-json`, text(curJson));
        c.evText(`show-${id}-json-baseline`, text(basJson));
        c.eq(`Then ${label} --format json 退出 0`, curJson.exitCode, 0);
        c.eq(`机检：${label} --format json 与 I1.5 基线逐字节相同（toRoleJson 不含 wakeAllow，不受 D-7b 改动影响）`,
          clean(text(curJson)), clean(text(basJson)));
        const role = jsonOf(curJson)?.role;
        c.deepEq(`机检：${label} 的 role 对象恰是 toRoleJson 的 10 键且不含 wake/wakeAllow`,
          Object.keys(role ?? {}).sort(),
          ['artifactType', 'file', 'group', 'groupLabel', 'id', 'maxConcurrentSessions', 'name', 'sideEffect', 'skills', 'source']);
      }

      // ---------------- ③ 机检（D-7b 资产比对） ----------------
      const ls = c.cmd(runCmd(['git', 'ls-files', 'assets/'], { cwd: REPO }), 'git ls-files assets/');
      const files = nonEmptyLines(clean(ls.stdout));
      const assetDiffs = [];
      const showCache = {}; // file → 0cd113b 版全文（供 removed/added 集合断言）
      for (const f of files) {
        const show = runCmd(['git', 'show', `${BASELINE_COMMIT}:${f}`], { cwd: REPO });
        if (show.exitCode !== 0) continue; // 机检原文：|| continue（无基线的新文件跳过）
        showCache[f] = clean(show.stdout);
        const d = diffLines(showCache[f], clean(readText(path.join(REPO, ...f.split('/'))) ?? ''));
        if (!d.same) assetDiffs.push({ file: f, diffs: d.diffs });
      }
      c.evJson('assets-diff', assetDiffs);
      c.eq('机检：assets/** 与 0cd113b 有差异的文件恰好两个', assetDiffs.map((x) => x.file).sort().join(','),
        'assets/roles/researcher.yaml,assets/roles/writer.yaml');
      // 切取规则：0cd113b 的 writer.yaml 用块列表（`wake_allow:` + `  - editor`），当前是行内
      // `[editor, reviewer]`，故按「removed/added 行集合」断言语义差异，恰为 D-7b 授权的取值变化。
      const rDiff = assetDiffs.find((x) => x.file === 'assets/roles/researcher.yaml');
      const wDiff = assetDiffs.find((x) => x.file === 'assets/roles/writer.yaml');
      const rSet = rDiff ? setDiff(showCache['assets/roles/researcher.yaml'] ?? '', clean(readText(path.join(REPO, 'assets', 'roles', 'researcher.yaml')) ?? '')) : null;
      const wSet = wDiff ? setDiff(showCache['assets/roles/writer.yaml'] ?? '', clean(readText(path.join(REPO, 'assets', 'roles', 'writer.yaml')) ?? '')) : null;
      c.deepEq('机检：researcher.yaml 差异逐字（wake_allow: [] → [writer]）',
        { removed: rSet?.removed ?? null, added: rSet?.added ?? null },
        { removed: ['wake_allow: []'], added: ['wake_allow: [writer]'] });
      c.deepEq('机检：writer.yaml 差异逐字（wake_allow: [editor] → [editor, reviewer]，基线为块列表）',
        { removed: wSet?.removed ?? null, added: wSet?.added ?? null },
        { removed: ['wake_allow:', '  - editor'], added: ['wake_allow: [editor, reviewer]'] });

      // ---------------- ④ 机检：test/wp11/cli-role.test.js 全绿 ----------------
      const t = c.cmd(nodeTest(['test/wp11/cli-role.test.js'], { timeout: 360000 }), 'node --test test/wp11/cli-role.test.js');
      const tail = nonEmptyLines(clean(t.stdout)).slice(-12).join('\n');
      c.evText('cli-role-test-tap', tail);
      const mTests = /^# tests (\d+)$/m.exec(t.stdout);
      const mPass = /^# pass (\d+)$/m.exec(t.stdout);
      const mFail = /^# fail (\d+)$/m.exec(t.stdout);
      c.eq('机检：test/wp11/cli-role.test.js fail === 0', mFail ? Number(mFail[1]) : null, 0);
      c.check('机检：test/wp11/cli-role.test.js 全绿（pass === tests 且 tests > 0）',
        Boolean(mTests && mPass && Number(mPass[1]) === Number(mTests[1]) && Number(mTests[1]) > 0),
        `tests=${mTests?.[1]} pass=${mPass?.[1]} fail=${mFail?.[1]}`);
    } finally {
      dropBaselineTree();
      c.note('基线工作树已移除（git worktree remove --force + prune），仓库工作区未被改动。');
    }

    c.check('And 收尾后没有残留的基线工作树', !exists(treeDir()), treeDir());
    return finish(c);
  }
}];
