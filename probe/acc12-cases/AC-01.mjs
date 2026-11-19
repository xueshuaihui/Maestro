/**
 * AC-01 · 篡改一条记录，链式哈希校验失败（mock / 夹具面）。
 * 真实跑 orch run 得 ≥3 条事件；原件/篡改副本分别 verify；逐字 A-1/A-2。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  ACC12_PATHS, freshRoot, orch, readEvents, eventsPath, sha256File, cleanupRoot,
  loadLabels, fillCount,
} from '../acc12-f-lib.mjs';
import {
  makeCase, eq, includes, check, verify, evidence, note, finish,
} from '../acc12-f-common.mjs';
import { verifyChain } from '../../src/core/audit-verify.js';

const INSTANCE = 'INST-001';
const TAMPER_SEQ = 2;

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-01', { scenario: 'verify', title: '篡改一条记录，链式哈希校验失败' });
  c.root = freshRoot('verify-ac01');

  try {
    const runResult = orch(c.root, ['run', '--cwd', '.', '--template', 'single', '--task', '写一份说明']);
    evidence(c, 'run', 'stdout.txt', runResult.stdout || '(empty stdout)');
    evidence(c, 'run', 'status.txt', [
      `exitCode=${runResult.exitCode}`,
      `timedOut=${runResult.timedOut}`,
      `durationMs=${runResult.durationMs}`,
      `stderr=${runResult.stderr || '(empty)'}`,
    ].join('\n'));

    const events = readEvents(c.root, INSTANCE);
    verify(c, 'Given：真实 orch run 得到不少于 3 条事件日志', events.length, (n) => n >= 3, '>= 3');
    if (events.length < 3) {
      note(c, '事件不足 3 条，后续断言无法进行');
      return finish(c);
    }

    const srcFile = eventsPath(c.root, INSTANCE);
    const originalHash = sha256File(srcFile);
    const goodRoot = path.join(c.root, 'good');
    const badRoot = path.join(c.root, 'bad');
    for (const dest of [goodRoot, badRoot]) {
      const destDir = path.join(dest, '.orch', 'instances', INSTANCE);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcFile, path.join(destDir, 'events.jsonl'));
    }

    const goodFile = eventsPath(goodRoot, INSTANCE);
    const badFile = eventsPath(badRoot, INSTANCE);
    const goodBefore = fs.readFileSync(goodFile, 'utf8');
    const badLines = goodBefore.trimEnd().split(/\r?\n/);
    const target = JSON.parse(badLines[TAMPER_SEQ - 1]);
    eq(c, '夹具：被改动记录序号为第 2 条', target.seq, TAMPER_SEQ);
    const head = target.prev_event_hash[0];
    target.prev_event_hash = (head === '0' ? '1' : '0') + target.prev_event_hash.slice(1);
    badLines[TAMPER_SEQ - 1] = JSON.stringify(target);
    fs.writeFileSync(badFile, `${badLines.join('\n')}\n`, 'utf8');

    evidence(c, 'fixture', 'events-good.jsonl', goodBefore);
    evidence(c, 'fixture', 'events-bad.jsonl', fs.readFileSync(badFile, 'utf8'));

    const goodBeforeHash = sha256File(goodFile);
    const badBeforeHash = sha256File(badFile);
    const goodVerify = orch(goodRoot, ['verify', INSTANCE]);
    const badVerify = orch(badRoot, ['verify', INSTANCE]);
    evidence(c, 'verify', 'good.stdout.txt', goodVerify.stdout || '(empty stdout)');
    evidence(c, 'verify', 'bad.stdout.txt', badVerify.stdout || '(empty stdout)');

    const expectedOk = fillCount(labels.CHAIN_COMPLETE, events.length);
    const expectedBroken = fillCount(labels.CHAIN_BROKEN, TAMPER_SEQ);
    includes(c, 'Then：原件输出含 A-1「链完整，共 N 条」', goodVerify.stdout, expectedOk);
    eq(c, 'Then：原件校验退出码 0', goodVerify.exitCode, 0);
    includes(c, 'Then：副本输出含 A-2「链已断：第 N 条记录与前一条指纹不匹配」', badVerify.stdout, expectedBroken);
    verify(c, 'Then：副本校验退出码非 0', badVerify.exitCode, (x) => x !== 0, '!= 0');
    includes(c, 'Then：A-2 指出第一条失配序号（逐字）', badVerify.stdout, `第 ${TAMPER_SEQ} 条`);

    // 取证分层：核心模块返回的首个失配序号 vs CLI 实际渲染值，用于定位缺陷归属。
    const moduleResult = await verifyChain({ root: badRoot, instanceId: INSTANCE, fs: fsp });
    evidence(c, 'verify', 'module-result.json', JSON.stringify(moduleResult, null, 2));
    eq(c, '机检：核心模块 verifyChain 首处失配序号为 2（D-2 口径）', moduleResult.firstMismatch, TAMPER_SEQ);
    const cliRenderedSeq = Number((badVerify.stdout.match(/第 (\d+) 条/) || [])[1] || 0);
    eq(c, '机检：CLI 渲染的失配序号应等于核心 firstMismatch', cliRenderedSeq, moduleResult.firstMismatch);
    if (cliRenderedSeq !== moduleResult.firstMismatch) {
      note(c, `缺陷：src/cli/verify.js:133 取 result.count（断点前已验条数=${moduleResult.count}）而非 result.firstMismatch=${moduleResult.firstMismatch} 渲染 A-2，导致 CLI 报「第 ${cliRenderedSeq} 条」；核心判定正确`);
    }

    eq(c, 'Then：原件日志校验前后 sha256 相等（未被改写）', sha256File(goodFile), goodBeforeHash);
    eq(c, '机检：副本日志校验前后 sha256 相等（校验只读）', sha256File(badFile), badBeforeHash);
    eq(c, '机检：原件与 run 产出字节哈希相等', goodBeforeHash, originalHash);

    const goodAfterLines = fs.readFileSync(goodFile, 'utf8').trimEnd().split(/\r?\n/);
    const badAfterLines = fs.readFileSync(badFile, 'utf8').trimEnd().split(/\r?\n/);
    eq(c, 'Then：篡改后行数不变', badAfterLines.length, goodAfterLines.length);
    for (let i = 0; i < goodAfterLines.length; i += 1) {
      if (i === TAMPER_SEQ - 1) continue;
      eq(c, `旧行字节/序号/前序指纹不变：line ${i + 1}`, badAfterLines[i], goodAfterLines[i]);
    }
    const tampered = JSON.parse(badAfterLines[TAMPER_SEQ - 1]);
    eq(c, '篡改行仍是合法 JSON 且 seq 不变', tampered.seq, TAMPER_SEQ);
    check(c, '篡改行仅 prev_event_hash 字段变化',
      tampered.prev_event_hash !== JSON.parse(goodAfterLines[TAMPER_SEQ - 1]).prev_event_hash,
      'only prev_event_hash changed');

    note(c, `orch run 退出码 ${runResult.exitCode}（mock 面无 API key，但事件链仍由真实落盘路径产生）`);
    evidence(c, 'meta', 'result.json', JSON.stringify({
      instance: INSTANCE,
      eventCount: events.length,
      originalHash,
      goodBeforeHash,
      goodAfterHash: sha256File(goodFile),
      badBeforeHash,
      badAfterHash: sha256File(badFile),
      goodExit: goodVerify.exitCode,
      badExit: badVerify.exitCode,
      expectedOk,
      expectedBroken,
      tamperSeq: TAMPER_SEQ,
      checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `verdict-pending; checks=${c.checks.length}`,
      `A-1=${expectedOk}`,
      `A-2=${expectedBroken}`,
    ].join('\n'));
  } finally {
    try { orch(c.root, ['core', 'stop'], { timeout: 15_000 }); } catch { /* 停核心失败不掩盖判定 */ }
    cleanupRoot(c.root);
  }
  return finish(c);
}
