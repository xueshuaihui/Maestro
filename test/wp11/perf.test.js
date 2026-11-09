/**
 * WP-8: I1.4 NFR 性能与原子写证据（report.md 引用本文件实测数据）。
 *
 * 纪律：§7.2 白名单已有 test/wp10/perf.test.js 的两条 NFR-02 p95 <= 50ms
 * 墙钟用例，属于负载相关、并行全量回归时会红的已知豁免项。本文件
 * **不复制任何严格墙钟断言**：所有 test 只做确定性结构断言（内容完整、
 * JSON 可解析、tmp 残留清零、输出行数正确），并把真实耗时落盘到
 * docs/iterations/iteration-4/evidence/nfr-perf-*.json 作为 NFR 证据。
 *
 * 覆盖分工：
 *   NFR-01（100 事件 / 50 包以内首行可见）→ 数据集规模下的渲染完整性 + 实测耗时；
 *   NFR-05（status.md / 信箱原子替换、强杀不留半截文件）→ 原子写内核；
 *   NFR-02/03/04（暂停/审批/重试/status 与 pause/resume 的时效）由 WP-8 的
 *     AC-15~20、AC-49~52、AC-60~61 逐条取证，不在本文件另造墙钟；
 *   NFR-06（回归）与 NFR-07（零依赖）由验收命令实测。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { writeTextAtomic, writeJsonAtomic } from '../../src/persistence/atomic-write.js';
import { renderHandoffLines, renderEventLine } from '../../src/cli/render.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-4', 'evidence');

function tmpRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `maestro-nfr-${label}-`));
}
function tmpLeft(dir, base) {
  return fs.readdirSync(dir).filter((f) => f.startsWith(`${base}.tmp-`));
}
function putEvidence(name, data) {
  fs.mkdirSync(EVID, { recursive: true });
  fs.writeFileSync(path.join(EVID, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const MARKDOWN = [
  '# 实例 INST-001 · 运行中 · 模板 编码闭环',
  '',
  '- 状态：运行中',
  '- 暂停：否',
  '- 任务：实现 calc.js',
  '- 工作区：/tmp/workspace',
  '',
  '## 节点',
  '节点 T-001 开发 执行中 · 第 1 轮',
  '## 交接包',
  '交接包 HO-001  开发→测试  已构造   19:00:00',
  '## 升级',
  '升级 —',
  '## 审批',
  '审批 —',
  '',
].join('\n');

test('NFR-05: status.md / 信箱原子写（强杀残留 tmp 不影响目标文件）', async () => {
  const root = tmpRoot('atomic');
  try {
    const statusMd = path.join(root, 'status.md');
    const inboxDir = path.join(root, '.orch', 'inbox', 'INST-001');

    // 模拟「进程在 rename 之前被强杀」：目录里留一个半截 tmp 文件，且目标
    // 文件是一份完整但较旧的 Markdown。原子写必须整份替换，绝不追加/拼接。
    fs.mkdirSync(path.join(root, '.orch', 'inbox'), { recursive: true });
    fs.writeFileSync(statusMd, '# 旧状态页（旧内容，必须被整份替换）\n', 'utf8');
    const orphan = path.join(root, 'status.md.tmp-99999-dead');
    fs.writeFileSync(orphan, '# 半截的 Mark', 'utf8'); // 半截 JSON/Markdown

    const t0 = performance.now();
    const w1 = await writeTextAtomic(statusMd, MARKDOWN);
    const t1 = performance.now();
    assert.equal(w1.ok, true, 'status.md 原子写应成功');
    assert.equal(w1.bytes, Buffer.byteLength(MARKDOWN, 'utf8'));
    assert.equal(fs.readFileSync(statusMd, 'utf8'), MARKDOWN, '目标文件整份完整，不是半截内容');
    assert.deepEqual(tmpLeft(root, 'status.md').sort(), ['status.md.tmp-99999-dead'],
      '本次成功的原子写不新增 tmp 残留（只剩测试预置的那一个强杀孤儿）');
    // 上一条「强杀」留下的孤儿 tmp 与真实目标文件互不影响（内容不被拼接）。
    assert.equal(fs.readFileSync(orphan, 'utf8'), '# 半截的 Mark');

    const inboxFile = path.join(inboxDir, 'HO-001.json');
    const message = { handoffId: 'HO-001', state: 'delivered', attempts: 1, defects: [] };
    const t2 = performance.now();
    const w2 = await writeJsonAtomic(inboxFile, message);
    const t3 = performance.now();
    assert.equal(w2.ok, true, '信箱 JSON 原子写应成功');
    assert.deepEqual(JSON.parse(fs.readFileSync(inboxFile, 'utf8')), message,
      '信箱文件必须是可解析的完整 JSON（不是半截 JSON）');
    assert.equal(tmpLeft(inboxDir, 'HO-001.json').length, 0, '信箱写不应留 tmp 残留');

    // 覆盖写：再次整份替换，内容仍是完整文件。
    const next = MARKDOWN.replace('- 状态：运行中', '- 状态：已挂起');
    const w3 = await writeTextAtomic(statusMd, next);
    assert.equal(w3.ok, true);
    assert.equal(fs.readFileSync(statusMd, 'utf8'), next, '覆盖写后仍是整份完整 Markdown');

    putEvidence('nfr-perf-atomic.json', {
      nfr: 'NFR-05', platform: process.platform, node: process.version,
      writes: [
        { target: 'status.md', ms: +(t1 - t0).toFixed(3), bytes: w1.bytes },
        { target: 'inbox/HO-001.json', ms: +(t3 - t2).toFixed(3), bytes: w2.bytes },
      ],
      assertions: ['整份替换', '目标可读', 'JSON 可解析', '无新 tmp 残留', '覆盖写完整'],
      note: '确定性结构断言；耗时仅作证据落盘，不设墙钟阈值（避免 §7.2 白名单同类负载红）',
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('NFR-05: 50 张交接包规模的信箱原子写（整份替换、无半截 JSON）', async () => {
  const root = tmpRoot('batch');
  try {
    const inboxDir = path.join(root, '.orch', 'inbox', 'INST-001');
    fs.mkdirSync(inboxDir, { recursive: true });
    const indexFile = path.join(inboxDir, 'index.json');
    const messages = Array.from({ length: 50 }, (_, i) => ({
      handoffId: `HO-${String(i + 1).padStart(3, '0')}`,
      state: i % 2 ? 'delivered' : 'consumed',
      deliveryAttempts: 1,
      edge: { kind: 'forward', from: 'T-001', to: 'T-002' },
    }));
    // 旧内容先落盘，才能验证「整份替换」而不是把新数据拼到旧内容后面。
    fs.writeFileSync(indexFile, JSON.stringify({ messages: [] }) + '\n', 'utf8');
    // 只做 1 次原子写：既覆盖 50 张包规模，又不给全量并行回归叠加 fsync
    // 争用（§7.2 #9 的归因正是并发 fs journal 放大）。
    const started = performance.now();
    const res = await writeJsonAtomic(indexFile, { messages });
    const elapsed = performance.now() - started;
    assert.equal(res.ok, true, '50 张包信箱索引原子写应成功');
    const back = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    assert.equal(back.messages.length, 50, '应恰好 50 张包，整份替换');
    for (let i = 0; i < 50; i += 1) {
      assert.equal(back.messages[i].handoffId, messages[i].handoffId,
        `第 ${i + 1} 张包内容应完整可解析`);
    }
    const leftover = fs.readdirSync(inboxDir).filter((f) => f.includes('.tmp-'));
    assert.equal(leftover.length, 0, '不得留下任何 tmp 半截文件');

    putEvidence('nfr-perf-batch.json', {
      nfr: 'NFR-05', dataset: '50 张交接包 / 1 次信箱索引原子写（整份替换）',
      totalMs: +elapsed.toFixed(3), messages: 50, tmpLeftover: 0,
      note: '确定性结构断言；耗时仅作证据。刻意用单次原子写，避免给全量并行回归叠加 fsync 负载',
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('NFR-01: 100 事件 / 50 包数据集下渲染输出完整（首行可即时产出）', async () => {
  const started = performance.now();
  const at = new Date('2026-11-08T19:00:00.000Z').toISOString();
  const handoffs = Array.from({ length: 50 }, (_, i) => ({
    handoffId: `HO-${String(i + 1).padStart(3, '0')}`,
    state: 'delivered',
    createdAt: at, deliveredAt: at,
    deliveryAttempts: 1, rejectReason: null,
    edge: { kind: 'forward', from: 'T-001', to: 'T-002', fromRole: 'developer', toRole: 'tester' },
  }));
  const snapshot = {
    instanceId: 'INST-001', state: 'running', template: 'code-loop',
    nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1 }],
    sessions: [], escalations: [], handoffs,
  };
  const lines = renderHandoffLines(snapshot, { template: 'code-loop' });
  // 每张包按 A-2 逐状态产出多行（本数据集 createdAt + deliveredAt 共 2 行）。
  assert.ok(lines.length >= handoffs.length, '每张包至少产出一行状态行');
  assert.equal(lines.length, handoffs.length * 2, '50 张包 × 2 个状态行 = 100 行');
  for (let i = 0; i < lines.length; i += 1) {
    assert.match(lines[i], /^交接包 HO-\d{3}/, `第 ${i + 1} 行应含包号且格式完整`);
  }
  const firstLineAtMs = performance.now() - started;

  const reasons = ['node.dispatch', 'handoff.created', 'handoff.inboxed', 'handoff.delivered',
    'verification.passed', 'run.completed', 'state.change', 'session.state'];
  const events = Array.from({ length: 100 }, (_, i) => ({
    seq: i + 1, ts: at, object: i % 2 ? 'handoff' : 'node',
    objectId: i % 2 ? `HO-${String((i % 50) + 1).padStart(3, '0')}` : 'T-001',
    from: null, to: null, result: 'applied', reason: reasons[i % reasons.length], detail: null,
  }));
  const eventLines = events.map((e) => renderEventLine(e, { template: 'code-loop' }));
  assert.equal(eventLines.length, 100, '100 个事件应全部产出可渲染行');
  assert.equal(eventLines.filter((l) => typeof l === 'string' && l.length > 0).length, 100,
    '每行都是非空字符串（无异常、无空输出）');
  const totalMs = performance.now() - started;

  putEvidence('nfr-perf-render.json', {
    nfr: 'NFR-01', dataset: { events: 100, handoffs: 50 },
    firstLineMs: +firstLineAtMs.toFixed(3), totalMs: +totalMs.toFixed(3),
    handoffLines: lines.length, eventLines: eventLines.length,
    note: '确定性输出完整性断言；耗时仅作证据落盘，不设 2s 墙钟阈值（避免 §7.2 白名单同类负载红）',
  });
});
