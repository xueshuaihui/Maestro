/**
 * I1.12 WP-3 / AC-11 + AC-12 contract: parallelism ceiling and budget quota.
 *
 * Discipline: pure decisions only. Fixtures live under os.tmpdir() (%TEMP% on
 * Windows), NODE_ENV=test is injected, no existing file is modified. The small
 * caller-side harnesses below stand in for the wiring package: they apply a
 * decision to a fixture state without ever writing a failure node or event.
 * All assertions use code names / keys, never localized wording.
 *
 * Coverage:
 *   - AC-11: 5 ready nodes with ceiling 2 -> at most 2 running, at least 3
 *     waiting, one slot backfilled on completion, zero failed nodes.
 *   - AC-12: exhausted budget -> suspended with budget_exhausted, resume from
 *     the original round, no failed node and no failed event.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decideParallelism, decideBudget } from '../../src/core/budget.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BUDGET_SRC = path.join(REPO, 'src', 'core', 'budget.js');

const REASON_EXHAUSTED = 'budget_exhausted';
const REASON_INVALID = 'invalid_limit';
const SUSPENDED = 'suspended';

let fixtureRoot;

test.before(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-budget-'));
  const parallel = {
    instanceId: 'INST-001',
    nodes: ['T-001', 'T-002', 'T-003', 'T-004', 'T-005'].map((id) => ({
      id,
      state: 'ready',
      round: 4
    }))
  };
  const exhausted = {
    instanceId: 'INST-001',
    state: 'running',
    round: 4,
    budget: { remaining: 0, nextCost: 1 },
    events: [],
    nodes: [
      { id: 'T-001', state: 'running', round: 4 },
      { id: 'T-002', state: 'running', round: 4 },
      { id: 'T-003', state: 'ready', round: 4 },
      { id: 'T-004', state: 'ready', round: 4 },
      { id: 'T-005', state: 'ready', round: 4 }
    ]
  };
  fs.writeFileSync(path.join(fixtureRoot, 'parallel.json'), JSON.stringify(parallel, null, 2), 'utf8');
  fs.writeFileSync(path.join(fixtureRoot, 'exhausted.json'), JSON.stringify(exhausted, null, 2), 'utf8');
});

test.after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));
}

function byState(stateData, wanted) {
  return stateData.nodes.filter((node) => node.state === wanted);
}

// Caller-side stand-in for dispatch: only 'ready' -> 'running', never 'failed'.
function dispatch(stateData, config) {
  const decision = decideParallelism({
    readyNodes: byState(stateData, 'ready'),
    runningNodes: byState(stateData, 'running'),
    maxConcurrent: config.maxConcurrent,
    instanceBudget: config.instanceBudget
  });
  for (const id of decision.allowed) {
    const node = stateData.nodes.find((item) => item.id === id);
    node.state = 'running';
  }
  return {
    decision,
    running: byState(stateData, 'running').length,
    waiting: byState(stateData, 'ready').length,
    failed: byState(stateData, 'failed').length
  };
}

// Caller-side stand-in for the existing suspend / resume path.
function applyBudget(stateData, decision) {
  if (decision.suspend) {
    stateData.state = SUSPENDED;
    stateData.pauseReason = decision.reason;
    stateData.resumeRound = decision.resumeRound;
  } else if (stateData.state === SUSPENDED) {
    stateData.state = 'running';
    stateData.round = decision.resumeRound ?? stateData.round;
  }
  return stateData;
}

test('AC-11 #1: 5 ready nodes with ceiling 2 run at most 2 and queue at least 3', () => {
  const stateData = loadFixture('parallel');
  const config = {
    maxConcurrent: 2,
    instanceBudget: { roles: [{ id: 'role-a', max_concurrent_sessions: 2 }] }
  };
  const outcome = dispatch(stateData, config);

  assert.ok(outcome.running <= 2, 'running nodes must stay within the ceiling');
  assert.ok(outcome.waiting >= 3, 'remaining ready nodes must stay queued');
  assert.equal(outcome.decision.allowed.length, 2);
  assert.equal(outcome.decision.queued.length, 3);
  assert.equal(outcome.decision.limit, 2);
  assert.equal(outcome.decision.reason, null);
  assert.equal(outcome.failed, 0);
});

test('AC-11 #2: completing one node backfills exactly one queued node', () => {
  const stateData = loadFixture('parallel');
  const config = { maxConcurrent: 2, instanceBudget: {} };
  const first = dispatch(stateData, config);
  assert.equal(first.decision.allowed.length, 2);

  const completed = stateData.nodes.find((node) => node.state === 'running');
  completed.state = 'done';
  const second = dispatch(stateData, config);

  assert.equal(second.decision.allowed.length, 1, 'one freed slot backfills one node');
  assert.equal(second.decision.queued.length, 2, 'queued count drops by one');
  assert.equal(second.failed, 0);
  assert.equal(stateData.nodes.some((node) => node.state === 'failed'), false);
});

test('AC-11 #3: effective ceiling is the smaller of instance and role limits', () => {
  const stateData = loadFixture('parallel');
  const outcome = dispatch(stateData, {
    maxConcurrent: 5,
    instanceBudget: { maxConcurrent: 3, roles: [{ id: 'role-a', max_concurrent_sessions: 2 }] }
  });

  assert.equal(outcome.decision.limit, 2);
  assert.ok(outcome.running <= 2);
  assert.equal(outcome.failed, 0);
});

test('D-6 #1: illegal or missing limits dispatch nothing', () => {
  const stateData = loadFixture('parallel');
  const outcome = dispatch(stateData, { maxConcurrent: 0, instanceBudget: {} });

  assert.equal(outcome.decision.limit, 0);
  assert.equal(outcome.decision.reason, REASON_INVALID);
  assert.deepEqual(outcome.decision.allowed, []);
  assert.equal(outcome.decision.queued.length, 5);
  assert.equal(outcome.running, 0);
  assert.equal(outcome.failed, 0);
});

test('AC-12 #1: exhausted budget suspends with the budget_exhausted reason', () => {
  const stateData = loadFixture('exhausted');
  const originalEvents = stateData.events.length;
  const decision = decideBudget({
    remainingBudget: stateData.budget.remaining,
    nextCost: stateData.budget.nextCost,
    state: stateData
  });
  applyBudget(stateData, decision);

  assert.equal(decision.suspend, true);
  assert.equal(decision.reason, REASON_EXHAUSTED);
  assert.equal(stateData.state, SUSPENDED, 'the existing state word is reused');
  assert.equal(stateData.pauseReason, REASON_EXHAUSTED);
  assert.equal(stateData.nodes.some((node) => node.state === 'failed'), false);
  assert.equal(stateData.events.length, originalEvents, 'no failed event is appended');
});

test('AC-12 #2: restoring budget resumes from the original round', () => {
  const stateData = loadFixture('exhausted');
  const suspend = decideBudget({ remainingBudget: 0, nextCost: 1, state: stateData });
  applyBudget(stateData, suspend);
  assert.equal(stateData.state, SUSPENDED);
  assert.equal(suspend.resumeRound, 4);

  stateData.budget.remaining = 10;
  const resume = decideBudget({
    remainingBudget: stateData.budget.remaining,
    nextCost: stateData.budget.nextCost,
    state: stateData
  });
  applyBudget(stateData, resume);

  assert.equal(resume.suspend, false);
  assert.equal(resume.reason, null);
  assert.equal(resume.resumeRound, 4, 'resume keeps the original round');
  assert.equal(stateData.state, 'running');
  assert.equal(stateData.round, 4);
  assert.equal(stateData.nodes.every((node) => node.round === 4), true);
  assert.equal(stateData.nodes.some((node) => node.state === 'failed'), false);
});

test('D-6 #2: missing budget fields are conservative and keep the round', () => {
  const decision = decideBudget({ state: { state: 'running', round: 3 } });

  assert.equal(decision.suspend, true);
  assert.equal(decision.reason, REASON_EXHAUSTED);
  assert.equal(decision.resumeRound, 3);
});

test('D-6 #3: decision shape is fixed and carries no failure node', () => {
  const exhausted = decideBudget({ remainingBudget: 0, nextCost: 1, state: { round: 4 } });
  const healthy = decideBudget({ remainingBudget: 9, nextCost: 1, state: { round: 4 } });

  assert.deepEqual(Object.keys(exhausted).sort(), ['reason', 'resumeRound', 'suspend']);
  assert.deepEqual(Object.keys(healthy).sort(), ['reason', 'resumeRound', 'suspend']);
  assert.equal(healthy.resumeRound, null);
  assert.equal(exhausted.suspend, true);
  assert.equal(healthy.suspend, false);
});

test('architecture: budget module is pure and reuses the suspended state word', () => {
  const source = fs.readFileSync(BUDGET_SRC, 'utf8');

  assert.equal(/\bsaveState\b/.test(source), false);
  assert.equal(/transit\(/.test(source), false);
  assert.match(source, /'suspended'/);
  assert.equal(/[\u4e00-\u9fff]/.test(source), false, 'no localized literal in the module');
});
