/**
 * WP-12 契约测试 · 发布流水线（AC-38 / AC-39 / AC-40 / AC-42 / AC-43 机检承载）。
 *
 * 两层断言：
 * A. **结构层**：解析 `.github/workflows/release.yml` 文本，断言触发条件、矩阵、
 *    步骤相对顺序、凭据口径、幂等分支、并发组区分、以及三条「零命中」红线。
 * B. **判定层**：对 `probe/acc10-release-verify.mjs` 导出的纯函数做单测——
 *    给定模拟 REST 响应体 → 给定判定。这层保证「校验器自己不会永远说 ok」。
 *
 * 全部为静态断言，不联网、不需要仓库凭据，可在任意平台跑。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  judgeAbsent,
  judgeAssets,
  judgeChannel,
  judgeDraft,
  judgeGating,
  judgeIdempotent,
  judgePublish,
} from '../../probe/acc10-release-verify.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'release.yml');
const SMOKE = path.join(REPO, 'scripts', 'desktop', 'smoke.mjs');
const GATE = path.join(REPO, 'scripts', 'desktop', 'gate.mjs');

const workflow = fs.readFileSync(WORKFLOW, 'utf8');

function indexOfStep(label) {
  const idx = workflow.indexOf(`- name: ${label}`);
  assert.notEqual(idx, -1, `workflow 缺少步骤：${label}`);
  return idx;
}

// ------------------------------------------------------------------ A. 结构层

test('AC-38 触发条件：v* tag 与手动试跑双通道', () => {
  assert.match(workflow, /tags:\s*\['v\*'\]/, 'tag 通道必须是 v* 触发');
  assert.match(workflow, /workflow_dispatch/, '必须保留手动试跑通道');
});

test('AC-38 凭据口径：只用仓库自带令牌，全文件无 secrets. 引用', () => {
  const secretHits = workflow.split('\n').filter((line) => /secrets\./.test(line));
  assert.deepEqual(secretHits, [], `发布定义不得出现 secrets. 引用，实际：${secretHits.join(' | ')}`);
  assert.match(workflow, /github\.token/, '应使用 ${{ github.token }} 表达式');
});

test('AC-38 权限：permissions 声明恰好一处且只含 contents: write', () => {
  const lines = workflow.split('\n');
  const permLines = lines.filter((line) => /^permissions:/.test(line));
  assert.equal(permLines.length, 1, `permissions 应恰好 1 处，实得 ${permLines.length}`);
  const start = lines.findIndex((line) => /^permissions:/.test(line));
  const block = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\S/.test(lines[i]) && lines[i].trim() !== '') break;
    if (lines[i].trim() !== '') block.push(lines[i].trim());
  }
  assert.deepEqual(block, ['contents: write'], `permissions 块只应含 contents: write，实得 ${JSON.stringify(block)}`);
});

test('AC-39 矩阵：三平台各自在自家 runner 产出', () => {
  for (const runner of ['macos-15-intel', 'macos-15', 'windows-latest']) {
    assert.ok(workflow.includes(runner), `矩阵缺少 runner：${runner}`);
  }
  assert.match(workflow, /fail-fast:\s*false/, '任一平台失败不得阻塞其它平台产出（AC-43 架构检查）');
});

test('AC-40 步骤顺序：门禁在打包之前、冒烟在上传之前', () => {
  const gate = indexOfStep('质量门禁（复用仓库既有判定）');
  const packager = indexOfStep('生成安装包');
  const smoke = indexOfStep('产物冒烟');
  const upload = indexOfStep('上传中间产物');
  assert.ok(gate < packager, `门禁(${gate}) 必须在打包(${packager}) 之前`);
  assert.ok(smoke < upload, `冒烟(${smoke}) 必须在上传(${upload}) 之前`);
  assert.ok(packager < smoke, `打包(${packager}) 必须在冒烟(${smoke}) 之前`);
});

test('AC-40 门禁复用既有判定，且无跳过旁路', () => {
  assert.ok(workflow.includes('scripts/desktop/gate.mjs'), '门禁必须调用仓库既有判定脚本');
  const gateText = fs.readFileSync(GATE, 'utf8');
  assert.match(gateText, /baseline-failures\.txt/, '门禁必须按判定基线做差集');
  assert.match(gateText, /purity-check\.mjs/, '门禁必须复用 31 词纯净扫描');

  const bypass = /skip-smoke|skip-gates/;
  assert.equal(bypass.test(workflow), false, 'workflow 不得出现跳过门禁/冒烟的开关');
  assert.equal(bypass.test(fs.readFileSync(SMOKE, 'utf8')), false, '冒烟脚本不得提供跳过开关');
});

test('AC-42 试跑通道：草稿且标识不以 v 开头', () => {
  assert.match(workflow, /dryrun-/, '试跑必须使用 dryrun- 前缀的草稿标识');
  assert.match(workflow, /--draft/, '试跑必须产出草稿');
});

test('AC-43 幂等：已存在则补传、否则创建，且覆盖式上传', () => {
  assert.match(workflow, /gh release view/, '必须先判断 Release 是否已存在');
  assert.match(workflow, /--clobber/, '补传必须覆盖式上传');
  assert.match(workflow, /gh release create/, '不存在时必须创建');
});

test('AC-43 并发：试跑与 tag 两条通道的并发组必须区分（F-27）', () => {
  assert.match(workflow, /format\('dryrun-\{0\}'/, '试跑通道并发组需独立');
  assert.match(workflow, /format\('release-\{0\}'/, 'tag 通道并发组需独立');
});

test('AC-39 架构检查：不做跨架构装配（禁架构合并工具与 universal target）', () => {
  const forbidden = /lipo|-target universal-apple-darwin|universal2-apple-darwin/;
  const offenders = [];
  for (const file of [WORKFLOW, SMOKE, GATE]) {
    if (forbidden.test(fs.readFileSync(file, 'utf8'))) offenders.push(path.relative(REPO, file));
  }
  assert.deepEqual(offenders, [], `不得出现跨架构装配命令，实际命中：${offenders.join(', ')}`);
});

test('AC-40 冒烟覆盖四项：启动 / 鉴权 / 签名 / 镜像', () => {
  const smoke = fs.readFileSync(SMOKE, 'utf8');
  assert.match(smoke, /探针 ready/, '冒烟必须含启动探针');
  assert.match(smoke, /401/, '冒烟必须含无凭据 401');
  assert.match(smoke, /codesign', \['--verify', '--deep', '--strict'/, '冒烟必须含严格验签');
  assert.match(smoke, /hdiutil', \['verify'/, '冒烟必须含镜像完整性校验');
  assert.match(smoke, /镜像内应用复验/, '冒烟必须对镜像里那份应用再次验签');
});

// ------------------------------------------------------------------ B. 判定层

const releaseWithAll = {
  id: 1,
  tag_name: 'v0.1.0',
  draft: false,
  prerelease: true,
  assets: [
    { name: 'Maestro_0.1.0_x64.dmg', size: 1 },
    { name: 'Maestro_0.1.0_arm64.dmg', size: 1 },
    { name: 'Maestro_0.1.0_win-x64-setup.exe', size: 1 },
    { name: 'SHA256SUMS.txt', size: 1 },
  ],
};

test('AC-38 判定：存在非草稿 Release 才算发布成功', () => {
  assert.equal(judgePublish([releaseWithAll], 'v0.1.0').ok, true);
  assert.equal(judgePublish([{ ...releaseWithAll, draft: true }], 'v0.1.0').ok, false);
  assert.equal(judgePublish([], 'v0.1.0').ok, false);
});

test('AC-39 判定：三平台包 + 清单共 4 项，缺一即失败', () => {
  assert.equal(judgeAssets(releaseWithAll).ok, true);

  const missingWin = { ...releaseWithAll, assets: releaseWithAll.assets.filter((a) => !a.name.includes('win-x64')) };
  const verdict = judgeAssets(missingWin);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /Windows/);

  const noSums = { ...releaseWithAll, assets: releaseWithAll.assets.filter((a) => a.name !== 'SHA256SUMS.txt') };
  assert.equal(judgeAssets(noSums).ok, false);

  const extra = { ...releaseWithAll, assets: [...releaseWithAll.assets, { name: 'extra.zip', size: 1 }] };
  assert.equal(judgeAssets(extra).ok, false, '资产数不为 4 也要判失败（清单与页面必须一一对应）');
});

test('AC-41 判定：v0.* 必须预发布，v1+ 必须正式', () => {
  assert.equal(judgeChannel(releaseWithAll, 'v0.1.0').ok, true);
  assert.equal(judgeChannel({ ...releaseWithAll, prerelease: false }, 'v0.1.0').ok, false);
  assert.equal(judgeChannel({ ...releaseWithAll, prerelease: false, tag_name: 'v1.0.0' }, 'v1.0.0').ok, true);
  assert.equal(judgeChannel({ ...releaseWithAll, prerelease: true, tag_name: 'v1.0.0' }, 'v1.0.0').ok, false);
});

test('AC-42 判定：草稿存在、标识不以 v 开头、正式条目数不增', () => {
  const draft = { ...releaseWithAll, tag_name: 'dryrun-abc1234', draft: true };
  assert.equal(judgeDraft([draft, releaseWithAll], 'dryrun-abc1234', 1).ok, true);
  assert.equal(judgeDraft([draft, releaseWithAll], 'v0.1.0', 1).ok, false, '草稿标识以 v 开头必须判失败');
  assert.equal(judgeDraft([draft, releaseWithAll], 'dryrun-abc1234', 0).ok, false, '正式条目数变化必须判失败');
});

test('AC-42 判定：清理后计数归零才算删干净', () => {
  assert.equal(judgeAbsent([releaseWithAll], 'dryrun-abc1234').ok, true);
  assert.equal(judgeAbsent([releaseWithAll, { ...releaseWithAll, tag_name: 'dryrun-abc1234', draft: true }], 'dryrun-abc1234').ok, false);
});

test('AC-43 判定：同名 Release 计数为 1 且资产齐全', () => {
  assert.equal(judgeIdempotent([releaseWithAll], 'v0.1.0').ok, true);
  assert.equal(judgeIdempotent([releaseWithAll, { ...releaseWithAll, id: 2 }], 'v0.1.0').ok, false);
  const incomplete = { ...releaseWithAll, assets: releaseWithAll.assets.slice(0, 2) };
  assert.equal(judgeIdempotent([incomplete], 'v0.1.0').ok, false);
});

test('AC-40 判定：失败构建且资产数不变才算门禁生效', () => {
  assert.equal(judgeGating({ conclusion: 'failure' }, 0, 0).ok, true);
  assert.equal(judgeGating({ conclusion: 'success' }, 0, 0).ok, false);
  assert.equal(judgeGating({ conclusion: 'failure' }, 0, 3).ok, false, '失败构建却新增资产必须判失败');
  assert.equal(judgeGating({ conclusion: 'cancelled' }, 0, 0).ok, false);
});
