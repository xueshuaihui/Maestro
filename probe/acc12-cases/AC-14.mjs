/**
 * AC-14 · 导入第三方包：签名有效 + 版本兼容 → 成功并见确认文案。
 * 验签在写前，用 Ed25519 真实签名；中文期望取自 labels.js（PACK_IMPORT_OK）。
 * 模块直调 verifyPackage/importPackage（CLI verify <包> 载体经 --help 验证存在）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { freshRoot, cleanupRoot, loadLabels } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, eq, finish } from '../acc12-f-common.mjs';
import { verifyPackage, importPackage } from '../../src/core/pack.js';
import { keypair, cli } from './AC-13.mjs';

export async function run() {
  const c = makeCase('AC-14', { scenario: 'import', title: '导入第三方包：签名有效、版本兼容' });
  c.root = freshRoot('import-ac14');
  try {
    const labels = await loadLabels();
    const key = keypair();
    const manifest = {
      type: 'role', id: 'third-party-role', version: 1,
      deps: [], files: { '.orch/roles/third-party-role.yaml': 'abc123digest' },
    };
    const assetText = 'id: third-party-role\nversion: 1\nname: third party\n';
    const files = { '.orch/roles/third-party-role.yaml': assetText };
    const realDigest = (await import('node:crypto')).createHash('sha256').update(assetText).digest('hex');
    manifest.files['.orch/roles/third-party-role.yaml'] = realDigest;

    const pkg = {
      manifest, files, compat: { min: 1, max: 3 },
      signature: { alg: 'Ed25519', sig: key.sign(manifest) },
    };
    evidence(c, 'given', 'package.json', JSON.stringify(pkg, null, 2));

    // 冻结名 orch verify <包> 的签名核验（模块直调，验签在写前）。
    const checked = verifyPackage({ pkg, publicKey: key.publicKey, systemVersion: 2 });
    evidence(c, 'when', 'verify.stdout.txt', JSON.stringify(checked, null, 2));
    verify(c, 'Then：签名有效 + 版本兼容 → 校验通过', checked.ok, (x) => x === true, 'ok === true');
    eq(c, 'Then：signatureValid = true', checked.signatureValid, true);
    eq(c, 'Then：versionCompatible = true', checked.versionCompatible, true);

    // 导入到空白 root。
    const imported = await importPackage({ pkg, publicKey: key.publicKey, systemVersion: 2, root: c.root });
    evidence(c, 'then', 'import.json', JSON.stringify(imported, null, 2));
    verify(c, '机检：导入退出/成功状态 ok', imported.ok, (x) => x === true, 'ok === true');
    check(c, '机检：资产落库（installed 非空）', Array.isArray(imported.installed) && imported.installed.length === 1, '1 installed');
    const landed = fs.readFileSync(path.join(c.root, '.orch/roles/third-party-role.yaml'), 'utf8');
    eq(c, '机检：落库资产字节与包内一致', landed, assetText);

    // 用户可见确认（逐字取自 labels.js A-6）。
    const confirm = labels[imported.labelKey];
    includes(c, 'Then：确认文案含「签名有效」', confirm, '签名有效');
    includes(c, 'Then：确认文案含「版本兼容」', confirm, '版本兼容');
    evidence(c, 'then', 'confirm.txt', `labelKey=${imported.labelKey}\nconfirm=${confirm}\n`);
    evidence(c, 'meta', 'result.json', JSON.stringify({
      verify: checked, imported: { ok: imported.ok, installed: imported.installed, labelKey: imported.labelKey },
      confirm, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', `AC-14 ${c.verdict || 'pending'} · 签名有效+版本兼容 · confirm=${confirm}\n`);
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-14', run, import.meta.url);
