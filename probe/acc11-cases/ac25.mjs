// AC-25 库浏览只读：机检 assets.test.js（AC-25 目录哈希前后不变）+ /assets/ 路由两文件合计≥6 且写方法零命中。
// AC-25 sha256 目录哈希锚定；需求机检原文点名 assets-readonly.test.js（本分支不存在），合并进 assets.test.js。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-25';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '只读 / 安全 / 机检',
  async run() {
    const c = makeCase(AC, { face: '只读 / 安全 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "fs[.]write|fs[.]unlink|assets-write" desktop/ui/assets/', expect: 1, note: 'AC-25 架构①：界面资产层无直写盘，零命中（exit 1）' },
        { cmd: 'cat src/daemon/http/server.js src/daemon/http/routes.js | grep -Ec "/assets/"', expect: 0, note: 'AC-25 架构②：/assets/ 两文件合计 ≥6（列表 3 + 详情 3；基线实跑 7，exit 0），计数须两文件合计不单看 server.js' },
        { cmd: 'grep -REn "/assets/" src/daemon/http/server.js src/daemon/http/routes.js | grep -E "POST|PUT|DELETE"', expect: 1, note: 'AC-25 架构③：资产路径上无写方法，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    c.check('AC-25 只读用例存在：浏览三分页/打开详情/切占用后，三个资产目录 sha256 哈希集合前后相等',
      Boolean(a?.subtests?.some((x) => /AC-25 库浏览只读/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-25/.test(x)).join(' | ') || '（未找到）',
      'hashTree(roles/skills/workflows) after === before；hashTree 按字节 sha256');
    c.check('界面没有新建/编辑/导入/导出/删除/校验按钮（只读动作清单），实例状态与事件日志不变',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      '只读接口；无写接口被调用；探针 writes=0');
    // 架构②两文件合计计数（≥6）逐字核对：从 arch-2 原始输出读数字断言。
    const sum = c.arch.find((x) => x.index === 2);
    c.check('/assets/ 两文件合计计数 ≥6（列表 3 + 详情 3），基线实跑 7',
      Number(sum?.stdout?.trim()) >= 6,
      `实测合计 ${sum?.stdout?.trim() ?? '（未取到）'}`,
      '≥ 6');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/assets-readonly.test.js（本分支不存在），AC-25 只读断言合并进 test/wp14/assets.test.js「AC-25 库浏览只读：调用前后三个资产目录的哈希不变」用例。按实际文件机检并登记说明，不放宽。');
    c.note('sha256 目录哈希锚定：hashTree 对 .orch/roles / .orch/skills / .orch/workflows 下全部文件按字节 sha256（路径→哈希），浏览三分页 + 打开若干详情 + 切占用 + 回列表后 after 深等于 before。架构路由计数按任务书用 server.js + routes.js 两文件合计（≥6，基线实跑 7），不单看 server.js；写方法零命中。');
    return finish(c);
  }
}];
