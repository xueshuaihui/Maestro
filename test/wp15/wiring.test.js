/**
 * I1.12 WP-7 / D-13 wiring contract tests.
 *
 * "Three commands + one shared verify handler + four gate hooks + all new
 * label keys" are asserted here WITHOUT loading any capability package:
 *  - command tables / gate points are static source assertions;
 *  - the four verify targets are exercised with frozen-signature stubs
 *    injected through ctx.deps, so no dynamic import of a capability module
 *    is ever executed (template hard rule 2 / WP-7 acceptance line 375).
 *
 * This file deliberately carries no CJK literal and no inline unicode escape:
 * every expected Chinese string is parsed at runtime from requirement.md
 * appendix A (the single source of truth), then compared verbatim to labels.js.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import * as labels from '../../src/cli/labels.js';
import {
  verifyCommand,
  resolveTarget,
  requireLabel,
  VERIFY_TARGETS,
  VERIFY_LABEL_KEYS,
} from '../../src/cli/verify.js';
import {
  wakeGate,
  parallelismGate,
  budgetGate,
  reviewGate,
  classifyGovernanceEvent,
} from '../../src/core/orchestrator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

// ASCII-only CJK detector: no CJK literal and no inline unicode escape here.
const CJK = new RegExp(
  '[' + String.fromCharCode(0x4e00) + '-' + String.fromCharCode(0x9fff) + ']',
);

/** Expected strings come from the spec, never from a hardcoded test literal. */
function requirement() {
  return read('docs/iterations/iteration-12/requirement.md');
}

/** Lines inside the first fenced block following an ASCII section prefix. */
function codeBlockAfter(text, asciiHeadingPrefix) {
  const at = text.indexOf(asciiHeadingPrefix);
  assert.notEqual(at, -1, `missing section ${asciiHeadingPrefix}`);
  const rest = text.slice(at + asciiHeadingPrefix.length);
  const open = rest.indexOf('```');
  assert.notEqual(open, -1, `missing fenced block after ${asciiHeadingPrefix}`);
  const start = rest.indexOf('\n', open) + 1;
  const end = rest.indexOf('```', start);
  assert.notEqual(end, -1, `unterminated fenced block after ${asciiHeadingPrefix}`);
  return rest.slice(start, end).split('\n').map((s) => s.trim()).filter(Boolean);
}

/** A-0 vocabulary: backtick terms on the bullet that references labels.js. */
function a0Vocabulary(text) {
  const section = text.slice(text.indexOf('### A-0'));
  const line = section.split('\n').find(
    (s) => s.startsWith('- ') && s.includes('src/cli/labels.js'),
  );
  assert.ok(line, 'A-0 vocabulary line not found');
  const terms = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((s) => CJK.test(s));
  return terms;
}

/** Verbatim reason text of the frozen wake.rejected key (requirement D-3). */
function frozenWakeRejected(text) {
  const match = /wake\.rejected[^\n]*= '([^']+)'/.exec(text);
  assert.ok(match, 'frozen wake.rejected text not found in requirement');
  return match[1];
}

// ---------------------------------------------------------------------------
// 1. Three commands mounted in the single command table (no second dispatch)
// ---------------------------------------------------------------------------

test('three commands mounted in FAMILY_MODULES / RUNTIME_COMMANDS / RUNTIME_SUBS / flags', () => {
  const main = read('src/cli/main.js');
  // Appended mounts, exactly as D-13 froze them.
  assert.ok(main.includes("verify: { specifier: './verify.js', exportName: 'verifyCommand'"));
  assert.ok(main.includes("migrate: { specifier: './migrate.js', exportName: 'migrateCommand'"));
  assert.ok(main.includes("export: { specifier: './otel.js', exportName: 'exportCommand'"));
  assert.ok(main.includes("'migrate', 'verify', 'export',"));
  assert.ok(main.includes("verify: ['import', 'review'],"));
  // D-4: the frozen workflow mapping is restored; package/yes are boolean only.
  assert.ok(main.includes("workflow: ['pause', 'resume', 'abort'],"));
  assert.ok(main.includes("const RUNTIME_BOOLEAN_FLAGS = new Set(['events', 'all', 'package', 'yes']);"));
  assert.ok(!/RUNTIME_VALUE_FLAGS[\s\S]*?'version'/.test(main), 'version flag must be removed');
  for (const flag of ['public-key', 'out', 'backup']) {
    assert.ok(main.includes(`'${flag}',`), `flag whitelist missing --${flag}`);
  }
  // Existing members byte-for-byte unchanged.
  assert.ok(main.includes("skill: { specifier: './skills.js', exportName: 'skillCommand'"));
  assert.ok(main.includes("workflow: { specifier: './workflows.js', exportName: 'workflowCommand'"));
  assert.ok(main.includes("const COMMANDS = new Set(['run', 'status', 'cancel', 'core', 'role', 'skill', 'workflow']);"));
  assert.ok(main.includes("role: new Set(['list', 'show', 'validate', 'create', 'edit', 'export', 'import', 'diff'])"));
  assert.ok(main.includes("skill: new Set(['list', 'show', 'create', 'validate', 'export', 'import'])"));
  assert.ok(main.includes("workflow: new Set(['list', 'show', 'create', 'validate', 'diff', 'dry-run'])"));
});

// ---------------------------------------------------------------------------
// 2. USAGE_LINES frozen 25 lines + independent appended block
// ---------------------------------------------------------------------------

test('USAGE_LINES stays 25 frozen lines; I112 block appended separately', () => {
  assert.equal(labels.USAGE_LINES.length, 25);
  assert.ok(labels.USAGE_LINES[0].includes('orch run|status|cancel|core'));
  assert.ok(labels.USAGE_LINES[24].includes('orch workflow dry-run'));
  for (const line of labels.USAGE_LINES) {
    assert.ok(!/^  orch (verify|migrate|export)\b/.test(line), 'new command leaked into frozen block');
  }
  const block = labels.USAGE_LINES_I112;
  assert.equal(Array.isArray(block) ? block.length : 0, 6);
  assert.ok(block.some((line) => /^  orch verify <instance>/.test(line) === false)); // ASCII tokens only
  assert.ok(block.some((line) => /^  orch verify\b/.test(line)));
  assert.ok(block.some((line) => /^  orch migrate\b/.test(line)));
  assert.ok(block.some((line) => /^  orch export\b/.test(line)));
  assert.ok(block.some((line) => /verify import/.test(line)));
  assert.ok(block.some((line) => /verify review/.test(line)));
});

test('--help prints the frozen 25 lines verbatim followed by the 6-line I112 block', () => {
  const cli = path.join(REPO, 'bin', 'orch.js');
  const res = spawnSync(process.execPath, [cli, '--help'], {
    cwd: REPO,
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(res.status, 2, `--help exit code changed:\n${res.stderr}`);
  const lines = res.stdout.replace(/\r\n/g, '\n').trimEnd().split('\n');
  assert.equal(lines.length, 31, `--help must be 25+6 lines, got ${lines.length}`);
  assert.deepEqual(lines.slice(0, 25), [...labels.USAGE_LINES]);
  assert.deepEqual(lines.slice(25), [...labels.USAGE_LINES_I112]);
});

// ---------------------------------------------------------------------------
// 3. New reason key added, frozen key untouched, wake.denied never introduced
// ---------------------------------------------------------------------------

test('REASON_LABEL adds wake.not-whitelisted; wake.rejected value unchanged', () => {
  const text = requirement();
  assert.equal(labels.REASON_LABEL['wake.rejected'], frozenWakeRejected(text));
  assert.equal(labels.REASON_LABEL['wake.not-whitelisted'], labels.I112_VOCAB.wakeNotWhitelisted);
  assert.ok(CJK.test(labels.REASON_LABEL['wake.not-whitelisted']));
  assert.equal(Object.hasOwn(labels.REASON_LABEL, 'wake.denied'), false);
});

// ---------------------------------------------------------------------------
// 4. All new label keys exist and equal appendix A verbatim
// ---------------------------------------------------------------------------

test('all new label keys exist and match requirement appendix A-0~A-7 verbatim', () => {
  const text = requirement();
  const a0 = a0Vocabulary(text);
  assert.equal(a0.length, 24, 'A-0 vocabulary must have 24 terms');

  // A-0: the vocabulary object's value set equals the spec term set exactly.
  const vocabValues = Object.values(labels.I112_VOCAB);
  assert.equal(vocabValues.length, a0.length);
  for (const term of a0) {
    assert.ok(vocabValues.includes(term), `I112_VOCAB missing term: ${term}`);
  }
  for (const value of vocabValues) {
    assert.ok(a0.includes(value), `I112_VOCAB extra term: ${value}`);
  }

  const a1 = codeBlockAfter(text, '### A-1');
  const a2 = codeBlockAfter(text, '### A-2');
  const a3 = codeBlockAfter(text, '### A-3');
  const a4 = codeBlockAfter(text, '### A-4');
  const a5 = codeBlockAfter(text, '### A-5');
  const a6 = codeBlockAfter(text, '### A-6');
  const a7 = codeBlockAfter(text, '### A-7');

  // A-1 / A-2
  assert.equal(labels.CHAIN_COMPLETE, a1[0]);
  assert.equal(labels.CHAIN_BROKEN, a2[0]);
  // A-3 / A-4 / A-5
  assert.equal(labels.WAKE_NOT_WHITELISTED_TEXT, a3[0]);
  assert.equal(labels.EVIDENCE_STALE_MISMATCH, a4[0]);
  assert.equal(labels.EVIDENCE_STALE_MISSING, a4[1]);
  assert.equal(labels.HIGH_RISK_MISSING_REVIEW, a5[0]);
  assert.equal(labels.BUDGET_EXHAUSTED, a5[1]);
  // A-6 signature / migration
  assert.equal(labels.PACK_IMPORT_OK, a6[0]);
  assert.equal(labels.PACK_SIGNATURE_INVALID, a6[1]);
  assert.equal(labels.PACK_VERSION_INCOMPATIBLE, a6[2]);
  assert.equal(labels.MIGRATE_NONE, a6[3]);
  assert.equal(labels.MIGRATE_DONE, a6[4]);
  // A-7 signals / evidence line
  assert.equal(labels.SIGNAL_DOC_BOTTLENECK, a7[0]);
  assert.equal(labels.SIGNAL_SERIALIZATION_REGRESSION, a7[1]);
  assert.equal(labels.SIGNAL_CONFIRMATION_BIAS, a7[2]);
  assert.equal(labels.SIGNAL_INSUFFICIENT_DATA, a7[3]);
  assert.equal(labels.PERF_EVIDENCE_LINE, a7[4]);

  // A-7 perf levels, parsed from the last bracket group of the evidence line.
  const groups = a7[4].match(/\[([^\]]+)\]/g) ?? [];
  assert.ok(groups.length >= 2);
  const levels = groups[groups.length - 1].slice(1, -1).split('|').map((s) => s.trim());
  assert.equal(levels.length, 3);
  assert.equal(labels.PERF_LEVEL_MOCK, levels[0]);
  assert.equal(labels.PERF_LEVEL_REAL, levels[1]);
  assert.equal(labels.PERF_LEVEL_PENDING, levels[2]);

  // Every remaining frozen key is a non-empty string (missing key must throw).
  const flat = [
    'PACK_BUILD_CYCLE', 'PACK_BUILD_MISSING', 'MIGRATE_LIST', 'MIGRATE_BAD_REFERENCE',
    'VERIFY_REVIEW_PASSED',
  ];
  for (const key of flat) assert.equal(typeof labels[key], 'string', `flat key missing: ${key}`);
  for (const key of ['VERIFY_CLI_TEXT', 'MIGRATE_CLI_TEXT', 'EXPORT_CLI_TEXT']) {
    assert.equal(typeof labels[key].notImplemented, 'string', `notImplemented missing: ${key}`);
  }
  for (const key of ['migrateRow', 'migrateCancelled', 'migrateBadReference', 'migrateNone', 'migrateDone']) {
    assert.equal(typeof labels.MIGRATE_TEXT[key], 'string');
  }
  for (const key of ['EXPORT_DONE', 'EXPORT_FAILED', 'EXPORT_USAGE']) {
    assert.equal(typeof labels.OTEL_TEXT[key], 'string');
  }
  // The CLI render contracts for migrate/export stay ASCII (frozen upstream
  // assertions noCjk + MIGRATE/EXPORT prefixes); A-6 Chinese lives in flat keys.
  assert.ok(labels.MIGRATE_TEXT.migrateDone.startsWith('MIGRATION DONE'));
  assert.ok(labels.OTEL_TEXT.EXPORT_DONE.startsWith('EXPORT OK'));
});

test('missing label key throws instead of falling back to a hardcoded literal', () => {
  assert.throws(() => requireLabel({}, 'NO_SUCH_KEY'), TypeError);
  assert.throws(() => requireLabel(null, 'NO_SUCH_KEY'), TypeError);
  assert.equal(requireLabel({ K: 'v' }, 'K'), 'v');
  assert.equal(Object.values(VERIFY_LABEL_KEYS).every((k) => typeof labels[k] === 'string'), true);
});

// ---------------------------------------------------------------------------
// 5. Four-target dispatch with frozen-signature stubs (no capability require)
// ---------------------------------------------------------------------------

function stubCtx(calls, lines, extra = {}) {
  return {
    cwd: '/fixture/root',
    out: (line) => lines.push(line),
    deps: {
      fs: { kind: 'injected-fs' },
      publicKey: 'injected-key',
      systemVersion: 3,
      verifyChain: async (input) => {
        calls.push(['chain', input]);
        return { ok: true, count: 3 };
      },
      verifyPackage: (input) => {
        calls.push(['package', input]);
        return { ok: true };
      },
      importPackage: async (input) => {
        calls.push(['import', input]);
        return { ok: false, code: 'SIGNATURE_INVALID' };
      },
      validateHighRiskReview: (input) => {
        calls.push(['review', input]);
        return { ok: true, needsHumanReview: false, blocked: false };
      },
      ...extra,
    },
  };
}

test('four targets resolve from one handler without sub-command tokens', () => {
  assert.equal(resolveTarget({ positionals: ['INST-001'], flags: {} }), VERIFY_TARGETS.CHAIN);
  assert.equal(resolveTarget({ positionals: ['pkg.json'], flags: { package: true } }), VERIFY_TARGETS.PACKAGE);
  assert.equal(resolveTarget({ sub: 'import', positionals: ['pkg.json'] }), VERIFY_TARGETS.IMPORT);
  assert.equal(resolveTarget({ sub: 'review', positionals: ['wf'] }), VERIFY_TARGETS.REVIEW);
});

test('verify <instance> calls verifyChain with the frozen signature', async () => {
  const calls = [];
  const lines = [];
  const code = await verifyCommand({ sub: null, positionals: ['INST-001'], flags: {} }, stubCtx(calls, lines));
  assert.equal(code, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'chain');
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['fs', 'instanceId', 'root']);
  assert.equal(calls[0][1].root, '/fixture/root');
  assert.equal(calls[0][1].instanceId, 'INST-001');
  assert.equal(calls[0][1].fs.kind, 'injected-fs');
  assert.equal(lines.length, 1);
});

test('verify <package> calls verifyPackage; bad signature and version return non-zero', async () => {
  const calls = [];
  const lines = [];
  const ctx = stubCtx(calls, lines);
  assert.equal(await verifyCommand({ sub: null, positionals: ['pkg.json'], flags: { package: true } }, ctx), 0);
  assert.equal(calls[0][0], 'package');
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['pkg', 'publicKey', 'systemVersion']);
  assert.equal(calls[0][1].pkg, 'pkg.json');

  calls.length = 0;
  const badSig = stubCtx(calls, lines, {
    verifyPackage: (input) => { calls.push(['package', input]); return { ok: false, code: 'SIGNATURE_INVALID' }; },
  });
  assert.notEqual(await verifyCommand({ sub: null, positionals: ['p'], flags: { package: true } }, badSig), 0);

  calls.length = 0;
  const badVer = stubCtx(calls, lines, {
    verifyPackage: (input) => { calls.push(['package', input]); return { ok: false, code: 'VERSION_INCOMPATIBLE' }; },
  });
  assert.notEqual(await verifyCommand({ sub: null, positionals: ['p'], flags: { package: true } }, badVer), 0);
});

test('verify import <package> calls importPackage with the frozen signature', async () => {
  const calls = [];
  const lines = [];
  assert.notEqual(
    await verifyCommand({ sub: 'import', positionals: ['pkg.json'], flags: {} }, stubCtx(calls, lines)),
    0,
  );
  assert.equal(calls[0][0], 'import');
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['fs', 'pkg', 'publicKey', 'root', 'systemVersion']);
  assert.equal(calls[0][1].pkg, 'pkg.json');
});

test('verify review <workflow> calls validateHighRiskReview with the frozen signature', async () => {
  const calls = [];
  const lines = [];
  const ctx = stubCtx(calls, lines, {
    validateHighRiskReview: (input) => {
      calls.push(['review', input]);
      return { ok: false, needsHumanReview: true, blocked: true, reason: 'missing_human_gate', nodeIds: ['T-004'] };
    },
  });
  assert.notEqual(await verifyCommand({ sub: 'review', positionals: ['wf'], flags: {} }, ctx), 0);
  assert.equal(calls[0][0], 'review');
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['graph', 'roles', 'workflow']);
  assert.equal(calls[0][1].workflow, 'wf');
});

test('verify review: a configured human path passes; missing human gate still fails', async () => {
  const calls = [];
  const lines = [];
  const withPath = stubCtx(calls, lines, {
    validateHighRiskReview: (input) => {
      calls.push(['review', input]);
      return { ok: true, needsHumanReview: true, blocked: false, reason: null, nodeIds: ['T-004'] };
    },
  });
  assert.equal(
    await verifyCommand({ sub: 'review', positionals: ['wf'], flags: {} }, withPath),
    0,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'review');
  assert.equal(lines.length, 1);
  assert.equal(lines[0], labels.VERIFY_REVIEW_PASSED);

  calls.length = 0;
  lines.length = 0;
  const missingPath = stubCtx(calls, lines, {
    validateHighRiskReview: (input) => {
      calls.push(['review', input]);
      return {
        ok: false, needsHumanReview: true, blocked: true,
        reason: 'missing_human_gate', nodeIds: ['T-004'],
      };
    },
  });
  assert.notEqual(
    await verifyCommand({ sub: 'review', positionals: ['wf'], flags: {} }, missingPath),
    0,
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0], labels.HIGH_RISK_MISSING_REVIEW);
});

// ---------------------------------------------------------------------------
// 6. Four orchestrator gate points: real control flow + injectable behaviour
// ---------------------------------------------------------------------------

test('four gate decisions enter control flow; no advisory void sentinel remains', () => {
  const orch = read('src/core/orchestrator.js');
  const count = (needle) => (orch.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
  assert.equal(/void\s+(wakeDecision|freshness|parallelism|budgetDecision|review)\s*;/.test(orch), false);

  // Gate 1: appended after the frozen wake.rejected branch; drives the
  // governance rejection builder, the escalation path and one reason event.
  assert.ok(orch.includes("reason: 'wake.rejected'"));
  assert.ok(orch.includes('const wakeHandoff = (state.handoffs ?? []).find('));
  assert.ok(orch.includes('const { verdict } = wakeGate({'));
  assert.ok(orch.includes('escalationMod.buildGovernanceRejection({'));
  assert.ok(orch.includes("code: 'WAKE_NOT_WHITELISTED'"));
  // Gate 2: no duplicate freshness call; the decision is exposed for I1.11.
  assert.equal(count('validateEvidenceFreshness('), 0);
  assert.ok(orch.includes('handoff.freshnessDecision = check.decision'));
  // Gate 4: blocked / unruled review stops the handoff and records the verdict.
  assert.ok(orch.includes('const { verdict } = reviewGate({'));
  assert.ok(orch.includes('handoff.reviewDecision = verdict.decision'));
  assert.ok(orch.includes("code: 'HIGH_RISK_REVIEW_BLOCKED'"));
  // Gate 3a / 3b: verdicts gate dispatch; writes only via escalateState.
  assert.ok(orch.includes('const { verdict } = parallelismGate({'));
  assert.ok(orch.includes('const { verdict } = budgetGate({'));
  assert.ok(orch.includes("code: 'BUDGET_EXHAUSTED'"));
  assert.ok(orch.includes('escalateState({'));
  // Primary-audit classification is really wired for new governance events.
  assert.ok(orch.includes('classifyGovernanceEvent(governance,'));
  assert.ok(orch.includes('governance.isPrimaryAuditEvent(event)'));
  // Capability loader: injected deps win, otherwise lazy real import.
  assert.ok(orch.includes('deps[key]'));
  assert.ok(orch.includes('CAPABILITY_SPECIFIERS'));
  assert.ok(orch.includes("governance: './governance.js'"));
  assert.ok(orch.includes("budget: './budget.js'"));
});

test('wake gate: injected rejection denies with one visible event, no session/dispatch verdict', () => {
  const calls = [];
  const governance = {
    decideWake: (input) => {
      calls.push(input);
      return {
        allowed: false,
        reason: 'wake.not-whitelisted',
        detail: { from: 'role-a', to: 'role-c', reason: 'wake.not-whitelisted', at: 'TS' },
      };
    },
    isPrimaryAuditEvent: () => true,
  };
  const input = { sourceRole: 'role-a', targetRole: 'role-c', roles: [{ id: 'role-a' }] };
  const { decision, verdict } = wakeGate({ governance, input, at: 'TS' });
  assert.equal(decision.allowed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceRole, 'role-a');
  assert.equal(calls[0].targetRole, 'role-c');
  assert.equal(verdict.reasonCode, 'wake.not-whitelisted');
  assert.equal(verdict.from, 'role-a');
  assert.equal(verdict.to, 'role-c');
  assert.equal(verdict.at, 'TS');
  // The single governance rejection event carries source / target / reason / time.
  const event = classifyGovernanceEvent(governance, {
    object: 'instance',
    objectId: 'INST-1',
    result: 'rejected',
    reason: verdict.reasonCode,
    detail: { from: verdict.from, to: verdict.to, reason: verdict.reason, at: verdict.at },
  });
  assert.equal(event.reason, 'wake.not-whitelisted');
  assert.deepEqual(Object.keys(event.detail).sort(), ['at', 'from', 'primaryAudit', 'reason', 'to']);
  assert.equal(event.detail.primaryAudit, true);
  // An allowed decision must not block.
  assert.equal(
    wakeGate({ governance: { decideWake: () => ({ allowed: true, reason: null, detail: {} }) }, input }).verdict,
    null,
  );
});

test('budget gate: exhausted budget blocks with suspended reason and resumeRound, no failed node', () => {
  const seen = [];
  const budget = {
    decideBudget: (input) => {
      seen.push(input);
      return { suspend: true, reason: 'budget_exhausted', resumeRound: 4 };
    },
  };
  const { verdict } = budgetGate({
    budget,
    input: { remainingBudget: 0, nextCost: 1, state: { state: 'running', round: 4 } },
    explicit: true,
  });
  assert.equal(seen.length, 1);
  assert.equal(verdict.blocked, true);
  assert.equal(verdict.reasonCode, 'budget_exhausted');
  assert.equal(verdict.resumeRound, 4);
  assert.equal('failed' in verdict, false);
  // Contract-compatible default: no explicit budget field means no new block.
  assert.equal(budgetGate({ budget, input: {}, explicit: false }).verdict, null);
  const healthy = {
    decideBudget: () => ({ suspend: false, reason: null, resumeRound: null }),
  };
  assert.equal(budgetGate({ budget: healthy, input: {}, explicit: true }).verdict, null);
});

test('review gate: blocked / unruled verdicts stop downstream; a ruling allows progress', () => {
  const blocked = reviewGate({
    governance: {
      validateHighRiskReview: () => ({
        ok: false, needsHumanReview: true, blocked: true,
        reason: 'missing_human_gate', nodeIds: ['T-004'],
      }),
      reviewDecision: (input) => Object.freeze(input),
    },
    input: {}, nodeId: 'T-004', instanceId: 'INST-1',
  });
  assert.equal(blocked.verdict.blocked, true);
  assert.equal(blocked.verdict.code, 'HIGH_RISK_REVIEW_BLOCKED');
  assert.deepEqual(blocked.verdict.nodeIds, ['T-004']);
  assert.equal(blocked.verdict.decision.reason, 'missing_human_gate');
  assert.equal(blocked.verdict.decision.nodeId, 'T-004');

  const reviewPath = {
    validateHighRiskReview: () => ({
      ok: true, needsHumanReview: true, blocked: false, reason: null, nodeIds: ['T-004'],
    }),
    reviewDecision: (input) => Object.freeze(input),
  };
  const waiting = reviewGate({
    governance: reviewPath, input: {}, nodeId: 'T-004', instanceId: 'INST-1', hasHumanRuling: false,
  });
  assert.equal(waiting.verdict.code, 'HIGH_RISK_REVIEW_PENDING');
  assert.equal(waiting.verdict.decision.instanceId, 'INST-1');
  // A recorded human ruling from the existing approval/escalation path lets it advance.
  assert.equal(
    reviewGate({
      governance: reviewPath, input: {}, nodeId: 'T-004', instanceId: 'INST-1', hasHumanRuling: true,
    }).verdict,
    null,
  );
});

test('parallelism gate: over-limit target stays queued, never failed; explicit only', () => {
  const budget = {
    decideParallelism: () => ({
      allowed: ['T-001', 'T-002'],
      queued: ['T-003', 'T-004', 'T-005'],
      limit: 2,
      reason: null,
    }),
  };
  const blocked = parallelismGate({ budget, input: {}, nodeId: 'T-003', explicit: true });
  assert.equal(blocked.verdict.blocked, true);
  assert.equal(blocked.verdict.code, 'PARALLEL_LIMIT');
  assert.equal(blocked.verdict.limit, 2);
  assert.equal(blocked.verdict.queued.length, 3);
  assert.equal('failed' in blocked.verdict, false);
  // Within the ceiling and non-explicit instances stay contract-compatible.
  assert.equal(parallelismGate({ budget, input: {}, nodeId: 'T-001', explicit: true }).verdict, null);
  assert.equal(parallelismGate({ budget, input: {}, nodeId: 'T-003', explicit: false }).verdict, null);
});

test('transit() remains the single state-migration entry', () => {
  const all = ['src/core/orchestrator.js', 'src/core/state-machine.js']
    .map((f) => read(f).split('\n').filter((line) => line.includes('transit(')).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(all, 6, 'transit( hit set must match the frozen baseline');
  const orch = read('src/core/orchestrator.js');
  assert.equal((orch.match(/async function transit\(/g) ?? []).length, 1);
});

test('escalation reuses emitMany / commitEscalation / pendingHandoff without rewriting', () => {
  const esc = read('src/core/escalation.js');
  assert.ok(esc.includes('function emitMany('));
  assert.ok(esc.includes('export async function commitEscalation('));
  assert.ok(esc.includes('pendingHandoff'));
  assert.ok(esc.includes('export function buildGovernanceRejection('));
  assert.ok(esc.includes('buildEscalation({'));
});

// ---------------------------------------------------------------------------
// 7. New source file carries no CJK literal and no inline unicode escape
// ---------------------------------------------------------------------------

test('verify.js and this test carry no CJK literal and no unicode escape', () => {
  for (const rel of ['src/cli/verify.js', 'test/wp15/wiring.test.js']) {
    const source = read(rel);
    assert.equal(CJK.test(source), false, `${rel} contains a CJK literal`);
    const marker = String.fromCharCode(92) + 'u';
    assert.equal(source.includes(marker), false, `${rel} contains an inline unicode escape`);
  }
});
