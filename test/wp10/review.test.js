/**
 * WP-2: `review.js` unit tests — the eleven steps of requirement D-7.
 *
 * Steps 3 (file exists but cannot be read) and 5 (top level is an array / null) have no
 * fixture scenario, so they are covered here with an injected `fs` stub as required by
 * D-7 / NFR-10.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { REVIEW_PATH, parseReview, readReview } from '../../src/core/review.js';

const DOC = 'artifacts/docs/release-notes.v1.md';

function tmpDir(prefix = 'maestro-wp10-review-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Prepare `<root>/out/review.json` + `<root>/workspace/artifacts/docs/release-notes.v1.md`. */
function setup({ review = null, mtimeOffsetMs = 0, doc = '# v1\n正文\n' } = {}) {
  const root = tmpDir();
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(path.join(workspace, 'artifacts', 'docs'), { recursive: true });
  if (doc !== null) fs.writeFileSync(path.join(workspace, DOC), doc, 'utf8');

  const reviewPath = path.join(root, REVIEW_PATH);
  if (review !== null) {
    fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
    const text = typeof review === 'string' ? review : JSON.stringify(review, null, 2);
    fs.writeFileSync(reviewPath, text, 'utf8');
    if (mtimeOffsetMs !== 0) {
      const stamp = new Date(Date.now() + mtimeOffsetMs);
      fs.utimesSync(reviewPath, stamp, stamp);
    }
  }
  return { root, workspace, reviewPath };
}

function cleanup(...dirs) {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
}

const pass = { decision: 'pass', artifact: DOC, defects: [] };
const reject = {
  decision: 'reject',
  artifact: DOC,
  defects: [
    { summary: '缺少「回滚方案」一节', evidence: `${DOC}#L1` },
    { summary: '升级步骤没写旧数据迁移', evidence: `${DOC}#L18` }
  ],
  revisionRequirement: '补写「回滚方案」一节'
};

test('步 1：文件不存在 → REVIEW_MISSING / review_missing', async () => {
  const ctx = setup({ review: null });
  try {
    const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'REVIEW_MISSING');
    assert.equal(result.stage, 'missing');
    assert.equal(result.reasonCode, 'review_missing');
    assert.equal(result.reasonDetail, '核对失败：未找到审核文件 out/review.json');
    assert.equal(result.reviewPath, 'out/review.json');
    assert.deepEqual(result.detail, {
      stage: 'missing',
      reasonCode: 'review_missing',
      message: '核对失败：未找到审核文件 out/review.json'
    });
  } finally {
    cleanup(ctx.root);
  }
});

test('步 2：mtime 早于本轮 → REVIEW_STALE / review_stale', async () => {
  const ctx = setup({ review: pass, mtimeOffsetMs: -120_000 });
  try {
    const result = await readReview({
      cwd: ctx.root,
      workspaceDir: ctx.workspace,
      expectedArtifact: DOC,
      roundStartedAt: new Date().toISOString()
    });
    assert.equal(result.code, 'REVIEW_STALE');
    assert.equal(result.stage, 'stale');
    assert.equal(result.reasonCode, 'review_stale');
    assert.equal(result.reasonDetail, '核对失败：审核文件不是本轮新写 out/review.json');
  } finally {
    cleanup(ctx.root);
  }
});

test('步 3：文件存在但读不出 → unreadable / review_invalid（注入 fs 桩）', async () => {
  const stub = {
    stat: async () => ({ size: 40, mtimeMs: Date.now() + 1_000 }),
    readFile: async () => {
      throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
    }
  };
  const result = await readReview({ cwd: 'D:/whatever', fs: stub, expectedArtifact: DOC });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'REVIEW_UNPARSABLE');
  assert.equal(result.stage, 'unreadable');
  assert.equal(result.reasonCode, 'review_invalid');
  assert.equal(result.reasonDetail, '核对失败：审核文件不可解析');
});

test('步 4：不是 JSON → unparsable / review_invalid', async () => {
  const ctx = setup({ review: '{' });
  try {
    const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_UNPARSABLE');
    assert.equal(result.stage, 'unparsable');
    assert.equal(result.reasonCode, 'review_invalid');
    assert.equal(result.reasonDetail, '核对失败：审核文件不可解析');
  } finally {
    cleanup(ctx.root);
  }
});

test('步 5：顶层是数组或 null → schema / review_invalid', async () => {
  for (const sample of ['[1,2]', 'null', '"pass"']) {
    const ctx = setup({ review: sample });
    try {
      const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
      assert.equal(result.code, 'REVIEW_SCHEMA_INVALID', `样本 ${sample}`);
      assert.equal(result.stage, 'schema', `样本 ${sample}`);
      assert.equal(result.reasonCode, 'review_invalid', `样本 ${sample}`);
      assert.equal(result.reasonDetail, '核对失败：审核文件不可解析', `样本 ${sample}`);
    } finally {
      cleanup(ctx.root);
    }
  }
});

test('步 6：结论非法 → REVIEW_DECISION_INVALID / decision', async () => {
  const ctx = setup({ review: { decision: 'maybe', artifact: DOC, defects: [] } });
  try {
    const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_DECISION_INVALID');
    assert.equal(result.stage, 'decision');
    assert.equal(result.reasonCode, 'review_invalid');
    assert.equal(result.reasonDetail, '核对失败：审核结论只能是 pass 或 reject');
  } finally {
    cleanup(ctx.root);
  }
});

test('步 7：没写 artifact → REVIEW_ARTIFACT_MISSING', async () => {
  const ctx = setup({ review: { decision: 'pass', defects: [] } });
  try {
    const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_ARTIFACT_MISSING');
    assert.equal(result.stage, 'artifact_missing');
    assert.equal(result.reasonCode, 'review_artifact_missing');
    assert.equal(result.reasonDetail, '核对失败：审核未引用本轮文档');
  } finally {
    cleanup(ctx.root);
  }
});

test('步 8：引用了别的文档 → REVIEW_ARTIFACT_MISMATCH，原值逐字回显', async () => {
  const ctx = setup({ review: { decision: 'pass', artifact: 'artifacts/docs/orphan.md', defects: [] } });
  try {
    const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_ARTIFACT_MISMATCH');
    assert.equal(result.stage, 'artifact_mismatch');
    assert.equal(result.reasonCode, 'review_artifact_mismatch');
    assert.equal(result.reasonDetail, '核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md');
  } finally {
    cleanup(ctx.root);
  }
});

test('步 9：pass 带缺陷 / reject 无缺陷两种自相矛盾', async () => {
  const passCtx = setup({ review: { decision: 'pass', artifact: DOC, defects: reject.defects } });
  try {
    const result = await readReview({ cwd: passCtx.root, workspaceDir: passCtx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_PASS_WITH_DEFECTS');
    assert.equal(result.stage, 'pass_with_defects');
    assert.equal(result.reasonCode, 'review_pass_with_defects');
    assert.equal(result.reasonDetail, '核对失败：审核为通过，但缺陷清单非空');
  } finally {
    cleanup(passCtx.root);
  }

  const rejectCtx = setup({ review: { decision: 'reject', artifact: DOC, defects: [] } });
  try {
    const result = await readReview({ cwd: rejectCtx.root, workspaceDir: rejectCtx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_REJECT_NO_DEFECTS');
    assert.equal(result.stage, 'reject_no_defects');
    assert.equal(result.reasonCode, 'review_reject_no_defects');
    assert.equal(result.reasonDetail, '核对失败：审核为驳回，但没有缺陷清单');
  } finally {
    cleanup(rejectCtx.root);
  }
});

test('步 10：缺陷缺证据 → REVIEW_DEFECT_SHAPE（整份无效，不回传部分缺陷）', async () => {
  const ctx = setup({
    review: { decision: 'reject', artifact: DOC, defects: [{ summary: '只有摘要' }] }
  });
  try {
    const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
    assert.equal(result.code, 'REVIEW_DEFECT_SHAPE');
    assert.equal(result.stage, 'defect_shape');
    assert.equal(result.reasonCode, 'review_defect_shape');
    assert.equal(result.reasonDetail, '核对失败：审核缺陷缺少摘要或证据');
    assert.equal(result.review, undefined);
  } finally {
    cleanup(ctx.root);
  }
});

test('步 11：证据指向不存在的文件 / 越界 / 绝对路径 → REVIEW_EVIDENCE_UNREADABLE', async () => {
  const samples = [
    'artifacts/docs/missing.md#L3',
    '../outside.md#L1',
    'C:\\Windows\\win.ini#L1',
    '/etc/passwd#L1'
  ];
  for (const evidence of samples) {
    const ctx = setup({
      review: { decision: 'reject', artifact: DOC, defects: [{ summary: '缺陷', evidence }] }
    });
    try {
      const result = await readReview({ cwd: ctx.root, workspaceDir: ctx.workspace, expectedArtifact: DOC });
      assert.equal(result.code, 'REVIEW_EVIDENCE_UNREADABLE', `样本 ${evidence}`);
      assert.equal(result.stage, 'evidence_unreadable', `样本 ${evidence}`);
      assert.equal(result.reasonCode, 'review_evidence_unreadable', `样本 ${evidence}`);
      assert.equal(result.reasonDetail, `核对失败：缺陷证据不可解析 ${evidence}`, `样本 ${evidence}`);
    } finally {
      cleanup(ctx.root);
    }
  }
});

test('成功路径：pass → defectCount 0、默认修改要求', async () => {
  const ctx = setup({ review: pass, mtimeOffsetMs: 60_000 });
  try {
    const now = () => 1_760_000_000_000;
    const result = await readReview({
      cwd: ctx.root,
      workspaceDir: ctx.workspace,
      expectedArtifact: DOC,
      roundStartedAt: new Date(Date.now() - 60_000).toISOString(),
      now
    });
    assert.equal(result.ok, true);
    assert.equal(result.review.decision, 'pass');
    assert.equal(result.review.artifact, DOC);
    assert.deepEqual(result.review.defects, []);
    assert.equal(result.review.defectCount, 0);
    assert.equal(result.review.revisionRequirement, '请按缺陷清单逐条修改后交出新版本');
    assert.equal(result.review.reviewPath, 'out/review.json');
    assert.equal(result.review.readAt, new Date(now()).toISOString());
  } finally {
    cleanup(ctx.root);
  }
});

test('成功路径：reject → 缺陷原文、#L 剥离后定位、修改要求取文件里的值', async () => {
  const ctx = setup({ review: reject, mtimeOffsetMs: 60_000 });
  try {
    const result = await readReview({
      cwd: ctx.root,
      workspaceDir: ctx.workspace,
      expectedArtifact: DOC,
      roundStartedAt: new Date(Date.now() - 60_000).toISOString()
    });
    assert.equal(result.ok, true);
    assert.equal(result.review.decision, 'reject');
    assert.equal(result.review.defectCount, 2);
    // 证据原文保留 #L 提示（渲染「缺陷 …（证据 …）」直接用）
    assert.deepEqual(result.review.defects, [
      { summary: '缺少「回滚方案」一节', evidence: `${DOC}#L1` },
      { summary: '升级步骤没写旧数据迁移', evidence: `${DOC}#L18` }
    ]);
    assert.equal(result.review.revisionRequirement, '补写「回滚方案」一节');
  } finally {
    cleanup(ctx.root);
  }
});

test('成功路径：未知字段忽略、行号范围与无 #L 的证据都能定位', async () => {
  const ctx = setup({
    review: {
      decision: 'reject',
      artifact: DOC,
      defects: [
        { summary: 'A', evidence: `${DOC}#L1-L9`, extra: 'ignored' },
        { summary: 'B', evidence: DOC }
      ],
      unknownField: { nested: true },
      comment: '随便写的东西'
    },
    mtimeOffsetMs: 60_000
  });
  try {
    const result = await readReview({
      cwd: ctx.root,
      workspaceDir: ctx.workspace,
      expectedArtifact: DOC,
      roundStartedAt: new Date(Date.now() - 60_000).toISOString()
    });
    assert.equal(result.ok, true);
    assert.equal(result.review.defectCount, 2);
    assert.deepEqual(result.review.defects[0], { summary: 'A', evidence: `${DOC}#L1-L9` });
  } finally {
    cleanup(ctx.root);
  }
});

test('parseReview 是纯函数：不碰磁盘，expectedArtifact 缺省时跳过步 8', () => {
  const ok = parseReview(JSON.stringify(pass));
  assert.equal(ok.ok, true);
  assert.equal(ok.review.artifact, DOC);

  const mismatch = parseReview(JSON.stringify(pass), { expectedArtifact: 'artifacts/docs/other.md' });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, 'REVIEW_ARTIFACT_MISMATCH');
  assert.equal(mismatch.reviewPath, 'out/review.json');

  assert.equal(parseReview('{').code, 'REVIEW_UNPARSABLE');
  assert.equal(parseReview('[]').code, 'REVIEW_SCHEMA_INVALID');
});

test('步 8 先于步 9/10：同时错时报引用不一致', () => {
  const document = JSON.stringify({
    decision: 'pass',
    artifact: 'artifacts/docs/orphan.md',
    defects: [{ summary: '只写摘要' }]
  });
  const result = parseReview(document, { expectedArtifact: DOC });
  assert.equal(result.code, 'REVIEW_ARTIFACT_MISMATCH');
});
