// AC-49 · escalated 角标直达本实例升级处理面板（view==='escalation-panel' 且 !=='drill'；基线 477 角标侧落点）
import fs from 'node:fs';
import path from 'node:path';
import { standardCase } from './_shared.mjs';
import { REPO } from '../acc10b-f-common.mjs';

export const cases = [standardCase('AC-49', {
  testFile: 'special-node-jump.test.js',
  arch: [
    { label: '面板标题只在一处产出（DRILL_ESC_TITLE 恰 1 条，| wc -l 口径）',
      pattern: 'DRILL_ESC_TITLE', target: 'desktop/ui/drill/', expect: 'exact:1' },
  ],
  literals: [
    "assert.equal(st.view, 'escalation-panel');",
    "assert.notEqual(st.view, 'drill');",
    "assert.equal(v.breadcrumb, '实例 INST-001 / 升级处理');",
    "assert.equal(v.escalations.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'));",
    "assert.deepEqual(v.escalations.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002']);",
    "assert.deepEqual(v.escalations.actions, ['继续', '取消']);",
    'assert.equal(hash(stateFile), beforeHash);',
  ],
  extra(c, { src }) {
    // 入口口径：升级节点与 escalated 角标两处共用同一 openEscalationPanel，不进 drill
    const appSrc = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'app.js'), 'utf8');
    c.includes('ctl 委托含 open-escalation（升级节点/角标共用入口）',
      appSrc, "action === 'open-escalation'");
    c.includes('openEscalationPanel 把 view 置为 escalation-panel',
      appSrc, "state.view = 'escalation-panel'");
    c.check('Then 逐字：角标入口面包屑逐字为「实例 INST-001 / 升级处理」',
      src.includes("'实例 INST-001 / 升级处理'"),
      "实例 INST-001 / 升级处理");
    // 内部断言：state.json 字节哈希不变（本批用临时 state.json 前后 hash 代理）
    c.includes('内部断言：hash(stateFile) === beforeHash', src, 'hash(stateFile), beforeHash');
  },
  notes: [
    'Then 逐字锚点（requirement.md:974-977）：直接进入本实例升级处理面板（不经过角色下钻、不进入角色下钻）；面包屑「实例 INST-001 / 升级处理」；标题「升级处理」、计数「本实例待处理升级 2 个」；两条依次列出；可操作项只有「继续」「取消」；不出现 INST-002；返回后缩放/折叠保持；全过程不改编排状态（stateHashBefore === stateHashAfter）。',
    '机检：view === escalation-panel 且 view !== drill；items 恰 [ESC-001, ESC-002]；actions 逐项 [继续, 取消]；zoom/pan/collapsed 进入前后相等。',
    '入口口径（基线 477 角标侧落点）：升级面板入口仅两处——升级节点（AC-21）与角色节点 escalated 角标（AC-49）；两处复用同一面板导出，架构检查 DRILL_ESC_TITLE 恰 1 处。',
  ],
})];
