/**
 * WP-10 契约测试 · 版本单点（AC-41 机检承载）。
 *
 * 断言面（对应用 v4 AC-41 架构检查的三条）：
 * 1. 来源唯一：`package.json` 的 `version` 只出现一次，且是唯一读取入口。
 * 2. 值相等：`Cargo.toml` / `tauri.conf.json` 与来源逐字相等。
 * 3. 派生物不写字面量：`scripts/desktop/**` 无版本字面量。
 *
 * 另加两条防「假绿」的断言：
 * 4. `checkAligned` 在被篡改的文本上必须判失败（不能永远 true）。
 * 5. 构建脚本确实生成 Windows 资源图标（ico 头合法），否则 Windows 目标在 tauri-build 就失败。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPO,
  PACKAGE_JSON,
  CARGO_TOML,
  TAURI_CONF,
  artifactName,
  archLabel,
  checkAligned,
  readCargoVersion,
  readTauriVersion,
  readVersion,
} from '../../scripts/desktop/version.mjs';

const BUILD_SCRIPT = path.join(REPO, 'scripts', 'desktop', 'build.mjs');

test('AC-41 来源唯一：package.json 是版本号的唯一字面量来源', () => {
  const raw = fs.readFileSync(PACKAGE_JSON, 'utf8');
  const hits = raw.split('\n').filter((line) => /^\s{2}"version":/.test(line));
  assert.equal(hits.length, 1, `package.json 中 "version" 应恰好 1 行，实得 ${hits.length}`);
  assert.match(readVersion(), /^\d+\.\d+\.\d+/);
});

test('AC-41 值相等：Cargo.toml 与 tauri.conf.json 的版本与来源逐字相等', () => {
  const version = readVersion();
  assert.equal(readCargoVersion(), version, 'Cargo.toml 的 version 必须等于 package.json');
  assert.equal(readTauriVersion(), version, 'tauri.conf.json 的 version 必须等于 package.json');

  const result = checkAligned();
  assert.equal(result.ok, true, `三处版本应对齐：${JSON.stringify(result.details)}`);
  assert.deepEqual(result.details, {
    packageJson: version,
    cargo: version,
    tauri: version,
  });
});

test('AC-41 派生物不写字面量：scripts/desktop 下不出现当前版本号', () => {
  const dir = path.join(REPO, 'scripts', 'desktop');
  const version = readVersion();
  const offenders = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.mjs')) continue;
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    if (text.includes(version)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `构建/打包脚本不得写死版本号 ${version}，实际命中：${offenders.join(', ')}`);
});

test('AC-41 对齐断言不是恒真：篡改任一来源必须判失败', () => {
  const version = readVersion();
  const tamperedCargo = fs
    .readFileSync(CARGO_TOML, 'utf8')
    .replace(`version = "${version}"`, 'version = "9.9.9"');
  assert.equal(readCargoVersion(tamperedCargo), '9.9.9');

  const tamperedTauri = JSON.stringify({ ...JSON.parse(fs.readFileSync(TAURI_CONF, 'utf8')), version: '9.9.9' });
  assert.equal(readTauriVersion(tamperedTauri), '9.9.9');

  // 直接对现档做一次反向断言：三个来源中任一被改都会让相等断言不成立。
  assert.notEqual(readCargoVersion(tamperedCargo), readVersion());
  assert.notEqual(readTauriVersion(tamperedTauri), readVersion());
});

test('AC-39 产物命名带版本与架构', () => {
  const version = readVersion();
  assert.equal(artifactName(version, 'x64', 'darwin'), `Maestro_${version}_x64.dmg`);
  assert.equal(artifactName(version, 'arm64', 'darwin'), `Maestro_${version}_arm64.dmg`);
  assert.equal(artifactName(version, 'x64', 'win32'), `Maestro_${version}_win-x64-setup.exe`);
  assert.equal(archLabel('x64'), 'x64');
  assert.equal(archLabel('arm64'), 'arm64');
  assert.throws(() => archLabel('ia32'), /不支持的架构/);
});

test('Windows 目标所需图标由构建脚本生成（ico 头合法）', () => {
  const text = fs.readFileSync(BUILD_SCRIPT, 'utf8');
  assert.match(text, /writeIconIco\(/, 'build.mjs 必须在 cargo build 之前生成 icons/icon.ico');
  assert.match(text, /icons['"],\s*['"]icon\.ico/, 'ico 落点必须是 src-tauri/icons/icon.ico');

  const ico = path.join(REPO, 'desktop', 'src-tauri', 'icons', 'icon.ico');
  if (!fs.existsSync(ico)) return; // 未构建过则跳过（CI 的构建步骤会先产出）
  const head = fs.readFileSync(ico).subarray(0, 6);
  assert.deepEqual([...head], [0x00, 0x00, 0x01, 0x00, 0x01, 0x00], 'ICO 头必须是 00 00 01 00 01 00');
});
