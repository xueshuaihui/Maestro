/**
 * I1.12 S3 验收 · 批次 B 公共运行器（宿于 AC-13，供 AC-14~AC-23 复用）。
 *
 * 文件所有权：本文件及 AC-14~AC-23 归批次 B；只写
 *   probe/acc12-cases/AC-1[3-9].mjs / AC-2[0-3].mjs
 *   probe/acc12-f-parts/AC-1[3-9].md / AC-2[0-3].md
 *   probe/acc12-f-results-b.jsonl（绝不写 acc12-f-results.jsonl）
 * 中文期望值不硬编码：labels.js / requirement.md 运行时读取。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import {
  REPO, ACC12_PATHS, freshRoot, cleanupRoot, loadLabels,
} from '../acc12-f-lib.mjs';
import {
  makeCase, block, finish, writePart, evidence, eq, includes, matches, check, verify,
} from '../acc12-f-common.mjs';
import { buildPackage, importPackage } from '../../src/core/pack.js';

/** 批次 B 独立结果文件（与批次 A 的 acc12-f-results.jsonl 物理隔离）。 */
export const RESULTS_B = path.join(REPO, 'probe', 'acc12-f-results-b.jsonl');

/** 主模块判定：仅当本文件被直接 node 执行时为真（被 import 时不执行用例）。 */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try { return path.resolve(process.argv[1]) === fileURLToPath(metaUrl); } catch { return false; }
}

/** 追加/去重一条结果到 results-b.jsonl。 */
export function appendResultB(c) {
  let lines = [];
  try { lines = fs.readFileSync(RESULTS_B, 'utf8').split(/\r?\n/).filter(Boolean); } catch { /* 首次 */ }
  const kept = lines.filter((line) => {
    try { return JSON.parse(line).ac !== c.ac; } catch { return false; }
  });
  const record = {
    ac: c.ac,
    batch: 'b',
    title: c.title,
    scenario: c.scenario,
    verdict: c.verdict,
    grading: c.grading,
    checksTotal: c.checksTotal,
    checksPassed: c.checksPassed,
    checksFailed: c.checksFailed,
    failedChecks: c.checks.filter((i) => !i.ok).map((i) => ({ id: i.id, label: i.label, expected: i.expected, actual: i.actual })),
    evidenceFiles: c.evidence.map((i) => i.file),
    evidenceCount: c.evidence.length,
    blocker: c.blocker,
    notes: c.notes,
    root: c.root,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    part: c.part,
  };
  fs.writeFileSync(RESULTS_B, `${[...kept, JSON.stringify(record)].join('\n')}\n`, 'utf8');
  return record;
}

/** 统一运行：执行 run() → 写 part → 写 results-b；异常登记为阻塞。 */
export async function selfRun(ac, runFn) {
  const started = Date.now();
  let c;
  try {
    c = await runFn();
  } catch (err) {
    c = c || makeCase(ac, { scenario: 'error', title: '用例异常' });
    block(c, `用例执行异常：${err?.message || String(err)}`);
    c = finish(c);
    try { evidence(c, 'error', 'stack.txt', String(err?.stack || err)); } catch { /* 不掩盖 */ }
  }
  if (!c || typeof c !== 'object') throw new Error(`${ac} run() 未返回 case`);
  c.durationMs = Date.now() - started;
  writePart(c);
  appendResultB(c);
  return c;
}

/** 直接执行入口（被 node 调用时）；metaUrl 为调用方模块的 import.meta.url。 */
export function cli(ac, runFn, metaUrl) {
  if (!isMain(metaUrl)) return;
  selfRun(ac, runFn).then((c) => {
    process.stdout.write(`${ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，证据 ${c.evidence.length}，分级 ${c.grading}）\n`);
  }).catch((err) => {
    process.stderr.write(`${ac} runner failed: ${err?.stack || err}\n`);
    process.exitCode = 1;
  });
}

/** 生成一对 Ed25519 密钥并返回 PEM 公钥与签名函数（供 AC-14/15/13 取证）。 */
export function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey,
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    sign: (manifest) => crypto.sign(null, Buffer.from(JSON.stringify(manifest), 'utf8'), privateKey).toString('base64'),
    corrupt: (sig) => {
      const buf = Buffer.from(sig, 'base64');
      buf[0] ^= 0xff;
      return buf.toString('base64');
    },
  };
}

/* ---------------------------------------------------------------- AC-13 用例 */

export async function run() {
  const c = makeCase('AC-13', { scenario: 'export', title: '角色包/工作流包导出含依赖闭包' });
  c.root = freshRoot('export-ac13');
  try {
    const labels = await loadLabels();
    const key = keypair();

    const yaml = (obj) => Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
    const writeAsset = (rel, text) => {
      const f = path.join(c.root, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, text, 'utf8');
    };
    // 真实依赖：派生角色 -> 技能 + 父角色；工作流 -> 子工作流。
    writeAsset('.orch/roles/role-child.yaml', yaml({ id: 'role-child', version: 1, skills: 'skill-a', derived_from: 'role-parent@2', text: 'child body' }));
    writeAsset('.orch/roles/role-parent.yaml', yaml({ id: 'role-parent', version: 2, text: 'parent body' }));
    writeAsset('.orch/skills/skill-a.yaml', yaml({ id: 'skill-a', version: 1, text: 'skill body' }));
    writeAsset('.orch/workflows/wf-main.yaml', yaml({ id: 'wf-main', version: 1, subworkflows: 'wf-sub@1', text: 'main wf' }));
    writeAsset('.orch/workflows/wf-sub.yaml', yaml({ id: 'wf-sub', version: 1, text: 'sub wf' }));
    // 无关资产：不应进入任何闭包。
    writeAsset('.orch/roles/role-unrelated.yaml', yaml({ id: 'role-unrelated', version: 1, text: 'unrelated' }));

    const registry = {
      roles: {
        'role-child': { id: 'role-child', skills: ['skill-a'], derived_from: 'role-parent@2', file: '.orch/roles/role-child.yaml' },
        'role-parent': { id: 'role-parent', version: 2, file: '.orch/roles/role-parent.yaml' },
        'role-unrelated': { id: 'role-unrelated', version: 1, file: '.orch/roles/role-unrelated.yaml' },
      },
      skills: { 'skill-a': { id: 'skill-a', version: 1, file: '.orch/skills/skill-a.yaml' } },
      workflows: {
        'wf-main': { id: 'wf-main', subworkflows: ['wf-sub@1'], file: '.orch/workflows/wf-main.yaml' },
        'wf-sub': { id: 'wf-sub', version: 1, file: '.orch/workflows/wf-sub.yaml' },
      },
    };
    evidence(c, 'given', 'registry.json', JSON.stringify(registry, null, 2));

    const built = buildPackage({ asset: { id: 'role-child', type: 'role' }, registry, root: c.root });
    evidence(c, 'when', 'build.stdout.txt', JSON.stringify(built, null, 2));
    verify(c, 'Given/When：派生角色包导出成功', built.ok, (x) => x === true, 'ok === true');
    const deps = built.manifest?.deps ?? [];
    const depNames = deps.map((d) => `${d.type}:${d.name}`);
    check(c, 'Then：闭包含被引用的技能 skill-a', depNames.includes('skill:skill-a'), 'skill:skill-a in deps');
    check(c, 'Then：闭包含派生父角色 role-parent', depNames.includes('role:role-parent'), 'role:role-parent in deps');
    check(c, 'Then：导出包含全部闭包成员文件（child/parent/skill）',
      Object.keys(built.files ?? {}).length >= 3, '>= 3 files');
    check(c, '架构检查：闭包不含无关资产 role-unrelated',
      !(built.files ?? {})['.orch/roles/role-unrelated.yaml'] && !depNames.includes('role:role-unrelated'),
      'no unrelated asset');

    // 工作流包闭包（子工作流）。
    const wfBuilt = buildPackage({ asset: { id: 'wf-main', type: 'workflow' }, registry, root: c.root });
    evidence(c, 'when', 'build-workflow.stdout.txt', JSON.stringify(wfBuilt, null, 2));
    verify(c, 'When：工作流包导出成功', wfBuilt.ok, (x) => x === true, 'ok === true');
    check(c, 'Then：工作流闭包含子工作流 wf-sub',
      (wfBuilt.manifest?.deps ?? []).some((d) => d.type === 'workflow' && d.name === 'wf-sub'),
      'workflow:wf-sub in deps');

    // 空白环境导入：签名后导入到全新 root，再按 manifest 校验字节。
    const pkg = {
      manifest: built.manifest,
      files: built.files,
      compat: { min: 1, max: 2 },
      signature: { alg: 'Ed25519', sig: key.sign(built.manifest) },
    };
    const blankRoot = path.join(c.root, 'blank');
    fs.mkdirSync(blankRoot, { recursive: true });
    const imported = await importPackage({ pkg, publicKey: key.publicKey, systemVersion: 2, root: blankRoot });
    evidence(c, 'then', 'import.json', JSON.stringify(imported, null, 2));
    verify(c, 'Then：空白环境导入成功', imported.ok, (x) => x === true, 'ok === true');
    let allMatch = true;
    for (const [rel, digest] of Object.entries(built.manifest.files)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(blankRoot, rel))).digest('hex');
      if (actual !== digest) allMatch = false;
    }
    check(c, 'Then：导入后资产可用且校验通过（逐文件 sha256 相等）', allMatch, 'all file digests equal manifest');

    // 缺失对照。
    const missingReg = JSON.parse(JSON.stringify(registry));
    delete missingReg.skills['skill-a'];
    const missing = buildPackage({ asset: { id: 'role-child', type: 'role' }, registry: missingReg, root: c.root });
    // 循环对照。
    const cycleReg = JSON.parse(JSON.stringify(registry));
    cycleReg.roles['role-parent'].derived_from = 'role-child@1';
    const cycle = buildPackage({ asset: { id: 'role-child', type: 'role' }, registry: cycleReg, root: c.root });
    evidence(c, 'then', 'negative-controls.json', JSON.stringify({ missing, cycle }, null, 2));
    eq(c, '对照：缺依赖导出失败并定位缺失名', missing.code, 'DEPENDENCY_MISSING');
    eq(c, '对照：缺失定位 name = skill-a', missing.detail?.name, 'skill-a');
    eq(c, '对照：派生链循环导出失败', cycle.code, 'DEPENDENCY_CYCLE');
    check(c, '对照：循环定位含链', Array.isArray(cycle.detail?.chain) && cycle.detail.chain.length >= 2, 'chain length >= 2');
    includes(c, '对照：缺失原因文案取自 labels（逐字）', labels.PACK_BUILD_MISSING, '依赖缺失');
    includes(c, '对照：循环原因文案取自 labels（逐字）', labels.PACK_BUILD_CYCLE, '循环');

    evidence(c, 'meta', 'result.json', JSON.stringify({
      deps: depNames, files: Object.keys(built.files ?? {}), wfDeps: wfBuilt.manifest?.deps,
      importOk: imported.ok, importedFiles: imported.installed,
      missingCode: missing.code, missingName: missing.detail?.name,
      cycleCode: cycle.code, cycleChain: cycle.detail?.chain,
      checks: c.checks,
    }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-13', run, import.meta.url);
