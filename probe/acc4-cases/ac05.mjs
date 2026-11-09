// AC-05 人工修改 status.md 会被下一次刷新覆盖（边界 / mock 夹具面）
import fs from 'node:fs';
import {
  makeCase, freshRoot, pauseAtOutput, readStatusMd, statusMdPath, sleep,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-05';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // 停在 after_output:T-001（开发产出后、测试派发前），此时实例正在运行
    const { h, paused } = await pauseAtOutput(root, 'T-001', { scenario: 'pass' });
    c.check('夹具：实例运行到暂停接缝（.mock/paused）', paused, String(paused));
    const marker = '- 待办：修 calc.js';
    const before = readStatusMd(root);
    c.check('Given：暂停时 status.md 是核心生成的可读 Markdown', typeof before === 'string' && before.startsWith('# '), String(before).slice(0, 80));
    fs.appendFileSync(statusMdPath(root), `${marker}\n`, 'utf8');
    c.includes('Given：手工写入一行后文件确实含该字符串', readStatusMd(root), '待办：修 calc.js');

    // 放行：下一个节点状态变化发生 → 触发刷新
    h.release();
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run（放行后前台收尾）', h);

    const mdFinal = readStatusMd(root);
    c.notIncludes('Then：该手写行消失', mdFinal, '待办：修 calc.js');
    c.includes('Then：status.md 恢复为核心生成的内容', mdFinal, '# INST-001 编码闭环');
    c.notIncludes('机检：刷新后的文件不含我写的字符串', mdFinal, '待办：修 calc.js');
    c.includes('机检：刷新后仍是原子替换的完整结构（含节点段）', mdFinal, '## 节点');
    await h.stop();
    return conclude(c, root);
  },
}];
