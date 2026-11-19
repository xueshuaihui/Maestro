/**
 * AC-15 · 签名无效 / 版本不兼容包被拒绝且不污染资产（验签在写前）。
 * 记录资产库基线，导入两份坏包，断言前后字节/清单一致、无 .pack-stage 残留。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { freshRoot, cleanupRoot, loadLabels, sha256File } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, eq, finish } from '../acc12-f-common.mjs';
import { verifyPackage, importPackage } from '../../src/core/pack.js';
import { keypair, cli } from './AC-13.mjs';

function snapshot(root) {
  const out = {};
  const walk = (dir, rel = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = `${rel}${e.name}`;
      if (e.isDirectory()) walk(abs, `${r}/`);
      else out[r] = sha256File(abs);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

/** 计算包内所有资产的 sha256，回填 manifest.files。 */
function finalize(manifest, files) {
  for (const rel of Object.keys(files)) {
    manifest.files[rel] = crypto.createHash('sha256').update(files[rel]).digest('hex');
  }
  return manifest;
}

export async function run() {
  const c = makeCase('AC-15', { scenario: 'import-bad', title: '签名无效/版本不兼容被拒绝且不污染资产' });
  c.root = freshRoot('import-bad-ac15');
  try {
    const labels = await loadLabels();
    const key = keypair();
    // 已有资产基线。
    fs.mkdirSync(path.join(c.root, '.orch/roles'), { recursive: true });
    fs.writeFileSync(path.join(c.root, '.orch/roles/existing.yaml'), 'id: existing\nversion: 1\nkeep: true\n', 'utf8');
    const baseline = snapshot(c.root);

    const baseFiles = { '.orch/roles/new-role.yaml': 'id: new-role\nversion: 1\n' };
    const goodManifest = finalize({ type: 'role', id: 'new-role', version: 1, deps: [], files: {} }, baseFiles);

    // 坏包 1：签名被改动。
    const badSig = {
      manifest: goodManifest, files: baseFiles, compat: { min: 1, max: 3 },
      signature: { alg: 'Ed25519', sig: key.corrupt(key.sign(goodManifest)) },
    };
    // 坏包 2：版本不兼容（systemVersion 超区间）。
    const badVer = {
      manifest: goodManifest, files: baseFiles, compat: { min: 1, max: 2 },
      signature: { alg: 'Ed25519', sig: key.sign(goodManifest) },
    };
    evidence(c, 'given', 'baseline.json', JSON.stringify(baseline, null, 2));
    evidence(c, 'given', 'packages.json', JSON.stringify({ badSig, badVer }, null, 2));

    const vSig = verifyPackage({ pkg: badSig, publicKey: key.publicKey, systemVersion: 2 });
    const vVer = verifyPackage({ pkg: badVer, publicKey: key.publicKey, systemVersion: 9 });
    evidence(c, 'when', 'verify.txt', JSON.stringify({ badSig: vSig, badVer: vVer }, null, 2));
    eq(c, '第一份：签名无效 code', vSig.code, 'SIGNATURE_INVALID');
    eq(c, '第二份：版本不兼容 code', vVer.code, 'VERSION_INCOMPATIBLE');
    includes(c, '第一份：原因文案含「签名无效」（逐字）', labels[vSig.labelKey], '签名无效');
    includes(c, '第二份：原因文案含「版本不兼容」（逐字）', labels[vVer.labelKey], '版本不兼容');

    const rSig = await importPackage({ pkg: badSig, publicKey: key.publicKey, systemVersion: 2, root: c.root });
    const rVer = await importPackage({ pkg: badVer, publicKey: key.publicKey, systemVersion: 9, root: c.root });
    evidence(c, 'then', 'import.txt', JSON.stringify({ badSig: rSig, badVer: rVer }, null, 2));
    verify(c, '机检：两份导入均失败', rSig.ok === false && rVer.ok === false, (x) => x === true, 'both ok=false');
    eq(c, '机检：第一份失败在写前（签名无效）', rSig.code, 'SIGNATURE_INVALID');
    eq(c, '机检：第二份失败在写前（版本不兼容）', rVer.code, 'VERSION_INCOMPATIBLE');

    const after = snapshot(c.root);
    evidence(c, 'then', 'assets-after.json', JSON.stringify(after, null, 2));
    check(c, '机检：资产库前后清单/字节一致', JSON.stringify(baseline) === JSON.stringify(after), 'baseline == after');
    check(c, '机检：无半安装残留（未出现新资产）',
      !fs.existsSync(path.join(c.root, '.orch/roles/new-role.yaml')), 'no new-role.yaml');
    const stages = [];
    const findStages = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && (e.name.startsWith('.pack-stage-') || e.name.startsWith('.migrate-'))) stages.push(e.name);
      }
    };
    findStages(path.join(c.root, '.orch'));
    eq(c, '机检：临时 stage 目录数为 0', stages.length, 0);

    evidence(c, 'meta', 'result.json', JSON.stringify({
      verify: { badSig: vSig, badVer: vVer }, import: { badSig: rSig, badVer: rVer },
      baseline, after, stages, checks: c.checks,
    }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-15', run, import.meta.url);
