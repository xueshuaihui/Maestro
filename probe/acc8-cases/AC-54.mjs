/**
 * AC-54 · 架构纯净：31 词扫描 exit 0、零依赖。
 *
 * 机检（需求 `:810~836`、附录 D-11）：五条命令**逐字**执行（三文件口径不得收窄），
 * 全部 exit 0；第 4 条输出 `0`；第 5 条输出 `OK: no CJK`。
 */
import path from 'node:path';

import { makeCase, evidence, eq, includes, check, note, finish } from '../acc8-f-common.mjs';
import { GRADING_ARCH, REPO, runCmd, writeText, EVID } from '../acc8-f-lib.mjs';

const COMMON = 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check';

/** 附录 D-11 的五条命令（逐字；`$COMMON` / `$NOCOORD` 由前置两行定义）。 */
const COMMANDS = [
  'node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"',
  'node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"',
  'node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"',
  'node -e "console.log(Object.keys(require(\'./package.json\').dependencies ?? {}).length)"',
  'node -e "const fs=require(\'fs\'),p=require(\'path\');const roots=[\'src/registry\',\'src/cli/roles.js\',\'src/cli/skills.js\',\'src/cli/workflows.js\'];const bad=[];const cjk=t=>[...t].some(c=>{const n=c.codePointAt(0);return n>=0x4e00&&n<=0x9fff;});const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(cjk(fs.readFileSync(d,\'utf8\')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join(\'\\n\'));process.exit(1);}console.log(\'OK: no CJK\');"',
];

export async function run() {
  const c = makeCase('AC-54', {
    scenario: 'architecture-purity',
    title: '架构纯净：31 词扫描 exit 0、零依赖',
    grading: GRADING_ARCH,
  });
  c.root = REPO;

  const prelude = `COMMON="${COMMON}"\nNOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')\n`;
  const results = [];
  for (let i = 0; i < COMMANDS.length; i += 1) {
    const script = `${prelude}${COMMANDS[i]}\n`;
    const r = runCmd(['bash', '-lc', script], { cwd: REPO, timeout: 300_000, env: { ...process.env } });
    results.push({
      index: i + 1,
      command: COMMANDS[i],
      exitCode: r.exitCode,
      stdout: r.stdout.trim(),
      stderr: r.stderr.trim(),
    });
  }

  evidence(c, 'machine', 'gates.txt', results.map((r) => [
    `# ${r.index}) ${r.command}`,
    `exit=${r.exitCode}`,
    `stdout: ${r.stdout || '(empty)'}`,
    `stderr: ${r.stderr || '(empty)'}`,
    '',
  ].join('\n')).join('\n'));
  evidence(c, 'given', 'commands.txt', `${prelude}\n${COMMANDS.join('\n')}\n`);

  for (const r of results) {
    eq(c, `第 ${r.index} 条命令 exit 0`, r.exitCode, 0);
  }
  eq(c, '第 4 条输出 `0`（dependencies 键数）', results[3]?.stdout ?? null, '0');
  eq(c, '第 5 条输出 `OK: no CJK`', results[4]?.stdout ?? null, 'OK: no CJK');
  check(c, '第 3 条按三文件口径（roles/skills/workflows）', COMMANDS[2].includes('src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js'), COMMANDS[2]);
  note(c, '五条命令逐字取自需求附录 D-11（三文件口径不得收窄）；COMMON/NOCOORD 前置两行同为 D-11 原文。');

  return finish(c);
}
