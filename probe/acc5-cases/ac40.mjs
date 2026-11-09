// AC-40 架构纯净：核心与守护进程零角色字面量（架构检查）
import path from 'node:path';
import {
  makeCase, freshRoot, purity, listFiles, REPO, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { FORBID_31, FORBID_30 } from './_baselines.mjs';

const AC = 'AC-40';

const FULL = FORBID_31.join(',');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    const root = freshRoot(AC);
    c.add(root); // 独立根占位；本条只读源码、不启核心

    // ① 第 1 条：引擎（31 词全表）
    const engine = c.cmd(purity({ dirs: 'src/core,src/daemon', forbid: FULL }), 'purity-check --dirs src/core,src/daemon --forbid <31 词>');
    c.evText('engine', text(engine));
    c.eq('Then 第 1 条退出码 0', engine.exitCode, 0);
    c.matches('Then 第 1 条输出「OK: 扫描 N 个文件…零命中」', text(engine), /OK: 扫描 \d+ 个文件.*零命中/);

    // ② 第 2 条：注册表实现（30 词，去掉 coordinator —— D-7 的 v5 修正）
    const registry = c.cmd(purity({ dirs: 'src/registry', forbid: FORBID_30.join(',') }), 'purity-check --dirs src/registry --forbid <30 词>');
    c.evText('registry', text(registry));
    c.eq('Then 第 2 条退出码 0', registry.exitCode, 0);
    c.matches('Then 第 2 条输出「OK: 扫描 N 个文件…零命中」', text(registry), /OK: 扫描 \d+ 个文件.*零命中/);

    // ③ 第 3 条：role 命令实现（31 词全表，只扫这一个文件）
    const roleFile = c.cmd(purity({ files: 'src/cli/roles.js', forbid: FULL }), 'purity-check --files src/cli/roles.js --forbid <31 词>');
    c.evText('roles-js', text(roleFile));
    c.eq('Then 第 3 条退出码 0', roleFile.exitCode, 0);
    c.matches('Then 第 3 条输出「OK: 扫描 N 个文件…零命中」', text(roleFile), /OK: 扫描 \d+ 个文件.*零命中/);

    // ④ 定点断言：coordinator 在 src/registry/** 只出现 1 次，且落在 role-schema.js 的 GROUPS 行
    const files = listFiles(path.join(REPO, 'src', 'registry')).map((rel) => `src/registry/${rel}`);
    const perFile = [];
    for (const file of files) {
      const scan = purity({ files: file, forbid: 'coordinator', json: true });
      const payload = jsonOf(scan);
      perFile.push({ file, hits: payload?.hits?.length ?? null, payload });
    }
    const total = perFile.reduce((n, item) => n + (item.hits ?? 0), 0);
    c.evJson('coordinator-fixed-point', { total, perFile: perFile.map((p) => ({ file: p.file, hits: p.hits })) });
    c.eq('机检：coordinator 在 src/registry/** 只出现 1 次（GROUPS 那一行）', total, 1);
    const hitFile = perFile.find((item) => (item.hits ?? 0) > 0);
    c.eq('机检：命中的文件是 src/registry/role-schema.js', hitFile?.file, 'src/registry/role-schema.js');
    const hitPayload = hitFile?.payload ?? null;
    const snippet = JSON.stringify(hitPayload?.hits?.[0] ?? {});
    c.evJson('coordinator-hit', hitPayload);
    c.includes('机检：命中行含 GROUPS（是分组枚举定义，不是按分组 id 分支）', snippet, 'GROUPS');

    return finish(c);
  }
}];
