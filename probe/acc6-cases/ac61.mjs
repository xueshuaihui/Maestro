// AC-61 三条内置工作流回归门禁：invalid=0，资产被改坏时先红（边界 + 机检）
// Given：独立项目根（无 .orch，只有内置三图），仓库 assets/roles 按 D-7b 对齐。
// When：validate（文本 + json）；随后把 assets/roles/writer.yaml 的 wake_allow 改回 [editor]，
//       再 validate 一次变红；验完立即还原（try/finally），末尾断言 git status --porcelain assets 为空。
// 纪律：本用例是唯一允许触碰仓库资产的用例；读写用 node fs，执行窗口最短（改完立刻验、验完立刻还原）。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, makeCase, freshRoot, runCmd, workflowValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-61';
const WRITER_FILE = path.join(REPO, 'assets', 'roles', 'writer.yaml');
const DENIED_LINE = '- 内置 task-loop：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    c.eq('Given 独立项目根无 .orch（只有内置三图）', fs.existsSync(path.join(root, '.orch')), false);

    // --- Given：对齐基线自证（D-7b）---
    const writerOriginal = fs.readFileSync(WRITER_FILE, 'utf8');
    c.check('Given assets/roles/writer.yaml 已读取（原文留存用于还原）', writerOriginal.includes('wake_allow: [editor, reviewer]'),
      writerOriginal.split('\n').find((l) => l.includes('wake_allow')) ?? '');
    const researcherText = fs.readFileSync(path.join(REPO, 'assets', 'roles', 'researcher.yaml'), 'utf8');
    c.check('Given assets/roles/researcher.yaml 对齐为 wake_allow: [writer]', researcherText.includes('wake_allow: [writer]'), 'D-7b');

    // --- When ①②：对齐后的 validate（文本 + json）---
    const okText = c.cmd(workflowValidate(root), 'orch workflow validate');
    const okRows = nonEmptyLines(clean(text(okText)));
    c.evText('validate-ok', text(okText));
    c.eq('Then ① 退出码 0', okText.exitCode, 0);
    c.lineEq('Then ① 首行逐字', okRows[0], '校验工作流 3 个：全部通过');

    const okJson = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const okPayload = jsonOf(okJson);
    c.evJson('payload-ok', okPayload);
    c.eq('Then ② 退出码 0', okJson.exitCode, 0);
    c.eq('机检：对齐后 counts.invalid === 0', okPayload?.counts?.invalid, 0);
    c.eq('机检：对齐后 counts.assets === 3', okPayload?.counts?.assets, 3);
    c.eq('机检：对齐后 counts.builtin === 3', okPayload?.counts?.builtin, 3);
    c.deepEq('机检：对齐后 errors 为空', okPayload?.errors ?? [], []);

    // --- When ③：临时把 writer.yaml 的 wake_allow 改回 [editor]，validate 变红，finally 立即还原 ---
    let restored = false;
    try {
      const broken = writerOriginal.replace('wake_allow: [editor, reviewer]', 'wake_allow: [editor]');
      c.check('夹具自检：writer.yaml 已临时改为 wake_allow: [editor]',
        broken !== writerOriginal && broken.includes('wake_allow: [editor]') && !broken.includes('reviewer'),
        'replace applied');
      fs.writeFileSync(WRITER_FILE, broken, 'utf8'); // 改完立刻验
      const badText = c.cmd(workflowValidate(root), 'orch workflow validate（writer wake_allow 改回 [editor] 后）');
      const badRows = nonEmptyLines(clean(text(badText)));
      c.evText('validate-broken', text(badText));
      c.eq('Then ③ 退出码 1', badText.exitCode, 1);
      c.lineEq('Then ③ 首行逐字', badRows[0], '校验工作流 3 个：1 个不合法');
      c.eq('Then ③ 变红行恰好一条', badRows.length, 2);
      c.lineEq('Then ③ 变红行逐字（A-9 的 内置 <id> 句式，内置 前缀参与排序）', badRows[1], DENIED_LINE);

      const badJson = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json（writer 改坏后）');
      const badPayload = jsonOf(badJson);
      c.evJson('payload-broken', badPayload);
      c.eq('机检：改回后 counts.invalid === 1', badPayload?.counts?.invalid, 1);
      c.eq('机检：改回后 errors[0].code === WORKFLOW_WAKE_DENIED', badPayload?.errors?.[0]?.code, 'WORKFLOW_WAKE_DENIED');
      c.check('机检：errors[0].file 以 内置  开头', String(badPayload?.errors?.[0]?.file ?? '').startsWith('内置 '),
        badPayload?.errors?.[0]?.file ?? '');
      c.includes('机检：errors[0].detail 含 writer → reviewer', badPayload?.errors?.[0]?.detail ?? '', 'writer → reviewer');
    } finally {
      // 验完立刻还原（执行窗口 = 两次 validate）
      fs.writeFileSync(WRITER_FILE, writerOriginal, 'utf8');
      restored = fs.readFileSync(WRITER_FILE, 'utf8') === writerOriginal;
    }
    c.eq('finally：assets/roles/writer.yaml 已逐字节还原', restored, true);

    // --- 机检：还原后 git status 干净 ---
    const git = runCmd(['git', 'status', '--porcelain', 'assets'], { cwd: REPO, label: 'git status --porcelain assets' });
    c.evText('git-status-assets', `${text(git)}(exit=${git.exitCode})`);
    c.eq('机检：git status --porcelain assets 输出为空', clean(text(git)).trim(), '');

    return finish(c);
  }
}];
