// AC-51 · 基线 477 连线侧的改道判定：红色/橙色连接线进交接包面板，不进升级面板（BR-43）
import fs from 'node:fs';
import path from 'node:path';
import { standardCase } from './_shared.mjs';
import { REPO } from '../acc10b-f-common.mjs';

// 裁决 L：语义等价检测——「view !== LIT」这一断言语义可由两种等价写法承载：
//   assert.notEqual(<x>, 'LIT')   或   assert.ok(<x> !== 'LIT')
// 两种写法都要求 LIT 落在断言右侧（主语须含 view），核的是完整断言结构，
// 不是「仅出现字面量」，故不会恒真；核对项本身保留，未删项、未放宽 Then。
function assertsViewNot(src, lit) {
  const L = `['"]${lit}['"]`;
  const subj = `[^();]*\\bview\\b[^();]*?`;
  const byNotEqual = new RegExp(`assert\\.notEqual\\s*\\(\\s*${subj},\\s*${L}\\s*\\)`);
  const byOk = new RegExp(`assert\\.ok\\s*\\(\\s*${subj}\\s*!==\\s*${L}\\s*\\)`);
  return byNotEqual.test(src) || byOk.test(src);
}

export const cases = [standardCase('AC-51', {
  testFile: 'connection-panel.test.js',
  arch: [
    { label: '连接线的点击目标只有交接包面板（handoff-panel.js 无 escalation）',
      pattern: 'escalation', target: 'desktop/ui/drill/handoff-panel.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(panel.target, 'connection-panel');",
    'assert.ok(panel.title.includes(word));',
    'assert.equal(panel.rows[0].reason, reason);',
    "['rejected', '已拒绝', '下游拒绝'],",
    "['expired', '已过期', '交接已过期'],",
    "['delivered', '已投递', ''],",
    "assert.ok(!source.includes('escalation'));",
  ],
  extra(c, { src }) {
    // 需求机检（requirement.md:997）明文要求三次落点在 app 视图层判定：
    //   view === 'connection-panel' / view !== 'escalation-panel' / view !== 'drill'
    //   且 stateHashBefore === stateHashAfter（三次点击都不改编排状态）。
    // 逐字核对：机检源码必须承载这些断言，否则机检并未判到 Then 的落点口径。
    c.check("机检要求：三次落点断言在 app 视图层（源码含 createApp 与 view==='connection-panel'）",
      src.includes('createApp') && src.includes("'connection-panel'"),
      `test.source 中 view 出现次数=${(src.match(/view/g) ?? []).length}，createApp 出现次数=${(src.match(/createApp/g) ?? []).length}；实测仅 panel.target==='connection-panel'（模块静态属性）`);
    c.check("机检要求：断言 view !== 'escalation-panel'",
      assertsViewNot(src, 'escalation-panel'),
      `test.source 中 'escalation-panel' 出现次数=${(src.match(/escalation-panel/g) ?? []).length}；语义等价检测（assert.notEqual(x, 'escalation-panel') 或 assert.ok(x !== 'escalation-panel')，右侧字面量为 'escalation-panel'）${assertsViewNot(src, 'escalation-panel') ? '命中' : '未命中'}`);
    c.check("机检要求：断言 view !== 'drill'（三次点击不进角色下钻）",
      assertsViewNot(src, 'drill'),
      `语义等价检测（assert.notEqual(x, 'drill') 或 assert.ok(x !== 'drill')，右侧字面量为 'drill'）${assertsViewNot(src, 'drill') ? '命中' : '未命中'}`);
    c.check('机检要求：stateHashBefore === stateHashAfter（三次点击不改编排状态）',
      src.includes('stateHashBefore') && src.includes('stateHashAfter'),
      `test.source 中 stateHash 出现次数=${(src.match(/stateHash/g) ?? []).length}`);
    // 改道判定：连接线点击须路由到交接包面板，不得复制第二套跳转分支
    const appSrc = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'app.js'), 'utf8');
    c.includes('ctl 委托含 open-connection（连接线点击进交接包面板的路由）',
      appSrc, "action === 'open-connection'");
  },
  notes: [
    'Then 逐字锚点（requirement.md:996）：三次都打开同一个交接包面板（左侧交接包列表、行内给拒绝/过期原因），任何一次都不进升级面板、也不进角色下钻；升级入口只有升级节点（AC-21）与 escalated 角标（AC-49）两处；三次点击都不改编排状态。',
    '需求机检（requirement.md:997）：connection-panel.test.js 断言三次 view === connection-panel、view !== escalation-panel、view !== drill，标题聚合词依次为已拒绝/已过期/已投递，红/橙两次行内含拒绝/过期原因词。',
    '取证发现（不通过依据）：实际 connection-panel.test.js 的 AC-51 用例只调用 buildHandoffPanel 纯模块、断言 panel.target === "connection-panel"（静态属性），源码无 view / createApp / escalation-panel / stateHash 任一机检断言；app.js 亦无 open-connection 点击路由（openConnectionPanel 已定义但无 click 委托调用）。故机检未覆盖 Then 的落点与不改状态口径。',
    '架构检查：handoff-panel.js 零 escalation（交接包面板不复制升级跳转分支）成立。',
  ],
})];
