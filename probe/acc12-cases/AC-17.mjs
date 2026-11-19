/**
 * AC-17 · orch migrate 无迁移项 / 坏引用 / 二次幂等。
 * 最新：无需迁移且不写文件；坏目标：可见错误保原资产；二次执行无新增改写。
 */
import fs from 'node:fs';
import path from 'node:path';

import { freshRoot, cleanupRoot, orch, sha256File } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, eq, finish } from '../acc12-f-common.mjs';
import { cli } from './AC-13.mjs';

function writeAsset(root, rel, text) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text, 'utf8');
  return f;
}
function snapFiles(root) {
  const out = {};
  for (const rel of ['.orch/roles/derived.yaml', '.orch/workflows/wf.yaml']) {
    const f = path.join(root, rel);
    if (fs.existsSync(f)) out[rel] = { text: fs.readFileSync(f, 'utf8'), sha256: sha256File(f) };
  }
  return out;
}

export async function run() {
  const c = makeCase('AC-17', { scenario: 'migrate-edge', title: 'orch migrate 无迁移项/坏引用/幂等' });
  c.root = freshRoot('migrate-edge-ac17');
  try {
    // ---- 对照一：已是最新 ----
    const latestRoot = path.join(c.root, 'latest');
    writeAsset(latestRoot, '.orch/roles/parent.yaml', 'id: parent\nversion: 2\n');
    const latestFile = writeAsset(latestRoot, '.orch/roles/derived.yaml', 'id: derived\nderived_from: parent@2\n');
    const latestBefore = { hash: sha256File(latestFile), text: fs.readFileSync(latestFile, 'utf8') };
    const latestOut = orch(latestRoot, ['migrate', '--yes']);
    evidence(c, 'when', 'latest.stdout.txt', latestOut.stdout || '(empty)');
    evidence(c, 'when', 'latest.status.txt', `exitCode=${latestOut.exitCode}\nstderr=${latestOut.stderr || '(empty)'}\n`);
    eq(c, '最新对照：退出码 0', latestOut.exitCode, 0);
    includes(c, 'Then：最新版本给出「无需迁移」提示', latestOut.stdout, 'NO MIGRATION NEEDED');
    eq(c, '机检：最新对照文件字节哈希前后一致', sha256File(latestFile), latestBefore.hash);
    eq(c, '机检：最新对照文件文本不变', fs.readFileSync(latestFile, 'utf8'), latestBefore.text);

    // ---- 对照二：引用目标不存在 ----
    const badRoot = path.join(c.root, 'bad');
    writeAsset(badRoot, '.orch/roles/derived.yaml', 'id: derived\nderived_from: ghost@1\n');
    const badFile = path.join(badRoot, '.orch/roles/derived.yaml');
    const badBefore = { hash: sha256File(badFile), text: fs.readFileSync(badFile, 'utf8') };
    const badOut = orch(badRoot, ['migrate', '--yes']);
    evidence(c, 'when', 'bad.stdout.txt', badOut.stdout || '(empty)');
    evidence(c, 'when', 'bad.status.txt', `exitCode=${badOut.exitCode}\nstderr=${badOut.stderr || '(empty)'}\n`);
    verify(c, 'Then：坏引用退出码非 0', badOut.exitCode, (x) => x !== 0, '!= 0');
    includes(c, 'Then：坏引用给出可见错误（不静默改写）', badOut.stdout + badOut.stderr, 'MIGRATION');
    includes(c, 'Then：坏引用错误含目标定位（ghost）', badOut.stdout, 'ghost');
    eq(c, '机检：坏对照原资产哈希不变', sha256File(badFile), badBefore.hash);
    eq(c, '机检：坏对照原资产文本不变', fs.readFileSync(badFile, 'utf8'), badBefore.text);

    // ---- 二次幂等：迁移一次后再迁移 ----
    const idemRoot = path.join(c.root, 'idem');
    writeAsset(idemRoot, '.orch/roles/parent.yaml', 'id: parent\nversion: 2\n');
    writeAsset(idemRoot, '.orch/roles/derived.yaml', 'id: derived\nderived_from: parent@1\n');
    const first = orch(idemRoot, ['migrate', '--yes']);
    const afterFirst = snapFiles(idemRoot);
    const second = orch(idemRoot, ['migrate', '--yes']);
    const afterSecond = snapFiles(idemRoot);
    evidence(c, 'then', 'idem.txt', [
      `first=${first.stdout.trim()}`, `second=${second.stdout.trim()}`,
      `afterFirst=${JSON.stringify(afterFirst)}`, `afterSecond=${JSON.stringify(afterSecond)}`,
    ].join('\n'));
    eq(c, '机检：首次迁移成功', first.exitCode, 0);
    includes(c, 'Then：二次执行给出无需迁移', second.stdout, 'NO MIGRATION NEEDED');
    eq(c, '机检：二次执行文件快照无新增改写', JSON.stringify(afterSecond), JSON.stringify(afterFirst));

    evidence(c, 'meta', 'result.json', JSON.stringify({
      latest: { exitCode: latestOut.exitCode, stdout: latestOut.stdout, hashEqual: sha256File(latestFile) === latestBefore.hash },
      bad: { exitCode: badOut.exitCode, stdout: badOut.stdout, hashEqual: sha256File(badFile) === badBefore.hash },
      idem: { first: first.stdout, second: second.stdout, unchanged: JSON.stringify(afterFirst) === JSON.stringify(afterSecond) },
      checks: c.checks,
    }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-17', run, import.meta.url);
