/**
 * AC-47 · 崩溃与运行慢的两类提示不混用（BR-36）。
 *
 * Given：一次 crash-rebuild、一次 slow（同一 labels.js 的两个不同键）。
 * When：比较两次 orch instance log 输出。
 * Then：崩溃场景只有「会话进程已退出 / 正在重建」，慢场景只有「无进展 / 判定为运行慢 / 不重建」。
 * 机检：崩溃输出不含「判定为运行慢」；慢输出不含「正在重建会话」；关键短语各计数 1。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { SESSION_FAILURE_TEXT, fill } from '../../src/cli/labels.js';
import { driveRecoveryScenario } from './AC-42.mjs';

const count = (text, needle) => (String(text).match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

export async function run() {
  const c = makeCase('AC-47', {
    scenario: 'crash-vs-slow-wording',
    title: '崩溃与运行慢的两类提示不混用',
    grading: GRADING_MOCK,
  });
  const rootCrash = freshRoot('AC-47-crash');
  const rootSlow = freshRoot('AC-47-slow');
  c.root = rootCrash;
  try {
    const crash = driveRecoveryScenario(rootCrash, 'crash-rebuild');
    const slow = driveRecoveryScenario(rootSlow, 'slow', {
      MAESTRO_MOCK_SLOW: '1', MAESTRO_TEST_SLOW_MS: '100',
    });
    evidence(c, 'given', 'crash-events.jsonl', crash.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'given', 'slow-events.jsonl', slow.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'crash-instance-log.txt', crash.log);
    evidence(c, 'then', 'slow-instance-log.txt', slow.log);

    check(c, '夹具：两个场景都跑通', crash.summary?.ok === true && slow.summary?.ok === true,
      JSON.stringify({ crash: crash.summary?.ok, slow: slow.summary?.ok }));
    check(c, '文案来源：SESSION_FAILURE_TEXT.crash 与 .slow 是两个不同的 labels 键',
      SESSION_FAILURE_TEXT.crash !== SESSION_FAILURE_TEXT.slow,
      JSON.stringify({ crash: SESSION_FAILURE_TEXT.crash, slow: SESSION_FAILURE_TEXT.slow }));

    const crashDetail = crash.events.find((e) => e.reason === 'session.crash')?.detail ?? {};
    const slowDetail = slow.events.find((e) => e.reason === 'session.slow')?.detail ?? {};
    const crashLine = fill(SESSION_FAILURE_TEXT.crash, crashDetail);
    const slowLine = fill(SESSION_FAILURE_TEXT.slow, {
      nodeId: slowDetail.nodeId ?? '', minutes: Math.floor((Number(slowDetail.waitedMs) || 0) / 60000),
    });
    evidence(c, 'then', 'rendered-labels.txt', JSON.stringify({ crashLine, slowLine }, null, 2));
    includes(c, 'Then：崩溃日志逐字等于 labels.crash 渲染行', crash.log, crashLine);
    includes(c, 'Then：慢日志逐字等于 labels.slow 渲染行', slow.log, slowLine);

    includes(c, 'Then：崩溃日志含「会话进程已退出 / 正在重建会话」', crash.log, '正在重建会话');
    includes(c, 'Then：慢日志含「无进展 / 判定为运行慢 / 不重建」', slow.log, '判定为运行慢');
    includes(c, 'Then：慢日志含「不重建会话」', slow.log, '不重建会话');
    excludes(c, '机检：崩溃输出不含「判定为运行慢」', crash.log, '判定为运行慢');
    excludes(c, '机检：慢输出不含「正在重建会话」', slow.log, '正在重建会话');
    excludes(c, '机检：慢输出不含「会话进程已退出」', slow.log, '会话进程已退出');
    excludes(c, '机检：崩溃输出不含「会话无进展」', crash.log, '会话无进展');

    eq(c, '机检：崩溃日志「正在重建会话」计数 1', count(crash.log, '正在重建会话'), 1);
    eq(c, '机检：崩溃日志「会话进程已退出」计数 1', count(crash.log, '会话进程已退出'), 1);
    eq(c, '机检：慢日志「判定为运行慢」计数 1', count(slow.log, '判定为运行慢'), 1);
    eq(c, '机检：慢日志「不重建会话」计数 1', count(slow.log, '不重建会话'), 1);
    eq(c, '机检：慢日志「正在重建会话」计数 0', count(slow.log, '正在重建会话'), 0);
    eq(c, '机检：崩溃日志「判定为运行慢」计数 0', count(crash.log, '判定为运行慢'), 0);

    note(c, '中文唯一来源：崩溃行取 SESSION_FAILURE_TEXT.crash、慢行取 SESSION_FAILURE_TEXT.slow，'
      + '断言由 events.jsonl 明细 fill() 渲染后的整行逐字出现在对应日志。');
    note(c, '两个场景各自独立 freshRoot，避免 crash-count / 会话标记互相污染。');
  } finally {
    cleanupRoot(rootCrash);
    cleanupRoot(rootSlow);
  }
  return finish(c);
}
