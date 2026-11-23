// AC-11 · 扫描只读，不改动用户机器（mock 面：只读 / 安全；BR-01）
// Then：被扫目录与用户 CLI 配置前后字节不变；不安装、不写用户系统目录；唯一允许写入 .orch/cli-registry.json。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, makeCase, freshRoot, orch, injectedScan, versionAgent, readRegistry,
  sha256File, noteFixture, finish
} from '../accA1-f-common.mjs';

const AC = 'AC-11';
const FACE = 'mock 面（只读 / 安全）';

function treeDigest(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const key = rel ? `${rel}/${name}` : name;
      const st = fs.statSync(p);
      if (st.isDirectory()) { out[`${key}/`] = 'dir'; walk(p, key); }
      else out[key] = sha256File(p);
    }
  };
  walk(dir, '');
  return out;
}

export const cases = [{
  ac: AC,
  title: '扫描只读，不改动用户机器（BR-01；§8 边界）',
  face: FACE,
  async run() {
    const c = makeCase(AC, { face: FACE, level: 'mock', phase: 'readonly' });
    const root = freshRoot(AC); c.add(root);
    const bin = path.join(root, 'bin');
    const apps = path.join(root, 'apps');
    const home = path.join(root, 'home');
    fs.mkdirSync(bin, { recursive: true });
    fs.mkdirSync(path.join(apps, 'Probe.app'), { recursive: true });
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    versionAgent(bin, 'codex', 'codex 1.2.3');
    noteFixture(c, '待扫夹具树：bin/codex + apps/Probe.app + home/.codex', `${bin} / ${apps} / ${home}`);

    const beforeBin = treeDigest(bin);
    const beforeApps = treeDigest(apps);
    const beforeHome = treeDigest(home);
    const scan = c.cmd(injectedScan(root, {
      pathEntries: [bin], appDirs: [apps], home, npmGlobalRoot: null
    }, { writeRegistry: true }), '注入接缝扫描夹具树（全部来源指向夹具）');
    const afterBin = treeDigest(bin);
    const afterApps = treeDigest(apps);
    const afterHome = treeDigest(home);

    c.eq('扫描退出码 0', scan.exitCode, 0);
    c.eq('被扫 bin 目录字节不变', JSON.stringify(afterBin), JSON.stringify(beforeBin));
    c.eq('被扫 apps 目录字节不变', JSON.stringify(afterApps), JSON.stringify(beforeApps));
    c.eq('被扫 home 目录字节不变', JSON.stringify(afterHome), JSON.stringify(beforeHome));
    const orchFiles = fs.readdirSync(path.join(root, '.orch')).sort();
    c.eq('唯一写入是 .orch/cli-registry.json', orchFiles.join(','), 'cli-registry.json');
    c.check('注册表可读（写入成功）', Boolean(readRegistry(root)), JSON.stringify(Boolean(readRegistry(root))));
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    c.eq('零运行时依赖（NF-4）', Object.keys(pkg.dependencies ?? {}).length, 0);
    const discoverSrc = fs.readFileSync(path.join(REPO, 'src', 'adapter', 'cli-discovery', 'discover.js'), 'utf8');
    c.eq('发现阶段无写操作（writeFile|mkdir|appendFile 零命中）',
      (discoverSrc.match(/writeFile|mkdir|appendFile/g) ?? []).length, 0);
    c.eq('领域层零 CJK（中文唯一来源 labels.js）',
      /[\u4e00-\u9fff]/.test(discoverSrc), false);

    c.snap('before', { bin: beforeBin, apps: beforeApps, home: beforeHome });
    c.snap('after', { bin: afterBin, apps: afterApps, home: afterHome, orchFiles });
    c.mid = { before: { bin: beforeBin, apps: beforeApps, home: beforeHome },
      after: { bin: afterBin, apps: afterApps, home: afterHome, orchFiles } };
    c.note('只读硬约束：扫描不 spawn、不写扫描目录；缓存写入仅在 registry.js 的 saveCliRegistry（原子写）。');
    return finish(c);
  }
}];
