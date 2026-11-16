// 用例模板：复制为 acNN.mjs 后填 AC 号与核对项。下划线开头，runner 不加载。
// 本批统一走 _shared.mjs::standardCase：机检 F-16 + 需求原文架构检查 + Then 逐字字面量核对。
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-xx', {
  testFile: 'wp14-xxx.test.js',
  face: 'mock 实测', // 通过档证据分级：mock 实测 / 已实测（真实宿主）；阻塞档：阻塞
  arch: [
    // { label: '需求原文描述', pattern: 'ERE 正则', target: '相对路径', expect: 'zero' | 'min1' | 'exact:N' }
  ],
  literals: [
    // 需求 Then / 附录 A 的逐字片段，必须在机检源码出现（机检确由该 Then 承载）
  ],
  literalAbsent: [
    // 必须不出现的逐字禁项（如「已关闭」）
  ],
  notes: ['Then 逐字锚点说明', '内部断言说明'],
})];
