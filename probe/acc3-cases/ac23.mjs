// AC-23 发起前拦截非法产物名（五个非法形状逐条跑，输出整行逐字比对）。
import {
  makeCase, freshRoot, runProduct, text, lines, instanceIds,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-23';
const PREFIX = '通用任务闭环的产物名不合法：';
const SUFFIX = '（只写文件名，.md 结尾，不带目录与版本号）';

const NAMES = [
  'docs/release-notes.md',
  '../release-notes.md',
  'C:\\release-notes.md',
  'release-notes.txt',
  'release-notes.v1.md'
];

/** 取出「产物名不合法」那一行；冒号与「（」之间的名字单独摘出。 */
function invalidLine(t) {
  const line = lines(t).find((l) => l.trim().startsWith(PREFIX));
  if (!line) return { line: `（未出现）${String(t).slice(0, 300)}`, name: null };
  const body = line.trim();
  const name = body.startsWith(PREFIX) && body.endsWith(SUFFIX)
    ? body.slice(PREFIX.length, body.length - SUFFIX.length)
    : null;
  return { line: body, name };
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '发起前拦截非法产物名',
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      for (const name of NAMES) {
        const task = `写发布说明。产物：${name}`;
        const res = c.cmd(
          runProduct(root, { task }),
          `orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：${name}"`
        );
        const got = invalidLine(text(res));
        c.eq(`Then 整行逐字等于「${PREFIX}${name}${SUFFIX}」`, got.line, `${PREFIX}${name}${SUFFIX}`);
        c.eq(`Then 冒号与「（」之间的内容逐字等于 ${JSON.stringify(name)}`, got.name, name);
        c.eq(`Then 退出码 1（${name}）`, res.exitCode, 1);
      }

      // And：五次之后 .orch/instances 仍为空
      c.eq('And 机检：五次之后 .orch/instances 仍为空', instanceIds(root).join(',') || '（空）', '（空）');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
