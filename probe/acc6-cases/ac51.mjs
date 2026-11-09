// AC-51 架构纯净：无资产名、无游离中文（架构检查 / D-9 逐字副本）
// 附录 D-9 是唯一权威：$COMMON / $NOCOORD 词表 + 四条命令逐字执行，全部退出 0。
// 前三条 stdout 形如 `OK: 扫描 N 个文件，<scope> 内 <词表> 零命中`，第四条 `OK: no CJK`。
// Windows 下第 4 条的 node -e 以单 argv 传整段 JS（spawnSync 无 shell 转义问题），
// JS 源文逐字照抄 D-9（含词表、roots、/[\u4e00-\u9fff]/ 正则与输出语义）。
import {
  REPO, NODE, PURITY, makeCase, runCmd, nonEmptyLines, clean, text, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-51';

// 附录 D-9 词表逐字（31 词，逗号分隔）。
const COMMON = 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check';
const NOCOORD = COMMON.replace(',coordinator', ''); // sed 's/,coordinator//' 的等价

// D-9 第 4 条的 node -e 脚本逐字（唯一改写：经 argv 传入，不经 shell 双引号）。
const NO_CJK_SCRIPT = "const fs=require('fs'),p=require('path');const roots=['src/registry','src/cli/roles.js','src/cli/skills.js','src/cli/workflows.js'];const bad=[];const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(/[\\u4e00-\\u9fff]/.test(fs.readFileSync(d,'utf8')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join('\\n'));process.exit(1);}console.log('OK: no CJK');";

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    c.note('四条命令为附录 D-9 逐字副本：1/3 条用 $COMMON（31 词），第 2 条用 $NOCOORD（30 词，去 coordinator）；第 4 条 node -e 的 JS 源逐字照抄、改经 argv 传入以规避 Windows shell 引号转义，扫描语义与词表不变。');

    // 词表自证
    c.eq('机检：$COMMON 恰 31 词（D-9「与 I1.5 完全相同的 31 词」）', COMMON.split(',').length, 31);
    c.eq('机检：$NOCOORD 恰 30 词（去 coordinator）', NOCOORD.split(',').length, 30);
    c.eq('机检：$NOCOORD 与 $COMMON 的差异恰是 coordinator', COMMON.split(',').filter((w) => !NOCOORD.split(',').includes(w)).join(','), 'coordinator');

    // 1) 引擎：src/core,src/daemon，31 词
    const r1 = c.cmd(runCmd([NODE, PURITY, '--dirs', 'src/core,src/daemon', '--forbid', COMMON], { cwd: REPO }),
      'node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"');
    c.evText('purity-core', text(r1));
    c.eq('Then 第 1 条退出 0', r1.exitCode, 0);
    c.matches('Then 第 1 条输出 OK: 扫描 N 个文件…零命中', clean(r1.stdout).trim(), /^OK: 扫描 \d+ 个文件，.+零命中$/);

    // 2) 注册表实现：src/registry，30 词
    const r2 = c.cmd(runCmd([NODE, PURITY, '--dirs', 'src/registry', '--forbid', NOCOORD], { cwd: REPO }),
      'node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"');
    c.evText('purity-registry', text(r2));
    c.eq('Then 第 2 条退出 0', r2.exitCode, 0);
    c.matches('Then 第 2 条输出 OK: 扫描 N 个文件…零命中', clean(r2.stdout).trim(), /^OK: 扫描 \d+ 个文件，.+零命中$/);

    // 3) 三族命令实现：逐文件扫
    const r3 = c.cmd(runCmd([NODE, PURITY, '--files', 'src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js', '--forbid', COMMON], { cwd: REPO }),
      'node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"');
    c.evText('purity-cli', text(r3));
    c.eq('Then 第 3 条退出 0', r3.exitCode, 0);
    c.matches('Then 第 3 条输出 OK: 扫描 N 个文件…零命中', clean(r3.stdout).trim(), /^OK: 扫描 \d+ 个文件，.+零命中$/);

    // 4) 新增实现零 CJK
    const r4 = c.cmd(runCmd([NODE, '-e', NO_CJK_SCRIPT], { cwd: REPO }),
      'node -e "<D-9 第 4 条逐字脚本>"');
    c.evText('no-cjk', text(r4));
    c.eq('Then 第 4 条退出 0', r4.exitCode, 0);
    c.eq('Then 第 4 条输出逐字 OK: no CJK', clean(r4.stdout).trim(), 'OK: no CJK');

    return finish(c);
  }
}];
