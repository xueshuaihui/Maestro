// AC-44 注册表加载只读且不联网（边界 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, writeRole, writeSkill, roleValidate, jsonOf, text, REPO,
  dirSnapshot, listFiles, readText, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-44';

const NET_MODULES = ['node:http', 'node:https', 'node:net', 'node:dns', 'node:tls'];

/** 目录树（只到目录层）：用于「执行前后 find -type d 列表相同」。 */
function dirsOf(root) {
  const out = [];
  const walk = (abs, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      out.push(next);
      walk(path.join(abs, e.name), next);
    }
  };
  walk(root, '');
  return out.sort();
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '边界',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '边界' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：一个含项目资产的项目根（合法资产）
    c.noteFixture('写 .orch/roles/researcher.yaml', writeRole(root, 'researcher', {
      id: 'researcher',
      name: '研究员',
      group: 'research',
      summary: '按任务收集事实',
      artifactType: 'report',
      sideEffect: 'write',
      skills: ['research-brief'],
      tools: ['read', 'write'],
      wakeAllow: [],
      max: 1
    }));
    c.noteFixture('写 .orch/skills/project-extra/SKILL.md', writeSkill(root, 'project-extra', {
      id: 'project-extra',
      name: '项目补充技能',
      summary: '项目自己的技能',
      appliesTo: '[research]',
      commands: '[]',
      body: '### 工作方法\n\n1. 做事。\n'
    }));

    const assetsDir = path.join(REPO, 'assets');
    const before = {
      assets: dirSnapshot(assetsDir),
      orch: dirSnapshot(path.join(root, '.orch')),
      dirs: dirsOf(root)
    };
    c.evJson('before', before);

    // When
    const res = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(res);
    c.evJson('payload', payload);
    c.eq('前置：校验通过（退出码 0）', res.exitCode, 0);
    c.eq('前置：counts.invalid === 0', payload?.counts?.invalid, 0);

    // Then
    const after = {
      assets: dirSnapshot(assetsDir),
      orch: dirSnapshot(path.join(root, '.orch')),
      dirs: dirsOf(root)
    };
    c.evJson('after', after);

    c.check('机检：assets/** 与 .orch/** 的 sha256 清单前后逐字相同',
      JSON.stringify(before.assets) === JSON.stringify(after.assets)
      && JSON.stringify(before.orch) === JSON.stringify(after.orch),
      `assets ${Object.keys(before.assets).length} 个 / .orch ${Object.keys(before.orch).length} 个`);
    c.check('机检：所有资产文件的修改时间都不变（含 mtime）',
      JSON.stringify(before.orch) === JSON.stringify(after.orch)
      && Object.entries(before.orch).every(([f, v]) => after.orch[f]?.mtimeIso === v.mtimeIso),
      'mtime 逐项比对');
    c.deepEq('机检：执行前后目录列表相同（没有新建目录）', after.dirs, before.dirs);

    // 静态扫描：src/registry/** 不得 import 网络模块
    const files = listFiles(path.join(REPO, 'src', 'registry')).map((f) => `src/registry/${f}`);
    const offenders = [];
    for (const rel of files) {
      const src = readText(path.join(REPO, ...rel.split('/'))) ?? '';
      for (const line of src.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!/^import\b|^const\s+\w+\s*=\s*require\(/.test(trimmed)) continue;
        for (const mod of NET_MODULES) if (trimmed.includes(`'${mod}'`) || trimmed.includes(`"${mod}"`)) offenders.push(`${rel}: ${trimmed}`);
      }
    }
    c.evJson('network-imports', { files, netModules: NET_MODULES, offenders });
    c.deepEq('机检：src/registry/** 不 import node:http/https/net/dns/tls（命中即判不通过）', offenders, []);

    return finish(c);
  }
}];
