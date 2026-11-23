/**
 * A1 / WP-3: capability matrix data projection (AC-09, data side).
 *
 * Baseline five dimensions: docs/index.md section 2.2:128 (ACP / stdio /
 * resume dialect / concurrency / evidence hook) and section 5:223
 * (ACP / transport / resume dialect / concurrency / evidence hook).
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  MATRIX_DIMENSIONS,
  buildMatrixData
} from '../../src/adapter/cli-discovery/index.js';
import {
  MATRIX_DIMENSIONS as directDimensions,
  buildMatrixData as directBuild
} from '../../src/adapter/cli-discovery/capability-matrix.js';

const BASELINE = ['acp', 'transport', 'resume_dialect', 'max_concurrent_sessions', 'evidence_hook'];
const ROW_KEYS = ['cli_id', 'name', ...BASELINE];

test('A1-M1: dimensions are frozen, exactly five, in baseline order', () => {
  assert.equal(Object.isFrozen(MATRIX_DIMENSIONS), true);
  assert.equal(MATRIX_DIMENSIONS.length, 5);
  assert.deepEqual(Array.from(MATRIX_DIMENSIONS), BASELINE);
  assert.equal(MATRIX_DIMENSIONS.includes('capabilities'), false);
  assert.equal(MATRIX_DIMENSIONS, directDimensions, 're-export is the same constant');
  assert.equal(buildMatrixData, directBuild, 're-export is the same function');
});

test('A1-M2: row values are projected verbatim, including null', () => {
  const clis = [
    {
      cli_id: 'codex', name: 'Codex CLI', acp: true, transport: 'stdio',
      resume_dialect: 'resume', max_concurrent_sessions: 3, evidence_hook: false,
      capabilities: ['resume']
    },
    {
      cli_id: 'cli-false', name: 'FalseCLI', acp: false, transport: '',
      resume_dialect: '', max_concurrent_sessions: 0, evidence_hook: true,
      capabilities: []
    },
    {
      cli_id: 'workbuddy', name: 'WorkBuddy', acp: null, transport: null,
      resume_dialect: null, max_concurrent_sessions: null, evidence_hook: null,
      capabilities: []
    }
  ];

  const data = buildMatrixData(clis);
  assert.equal(data.dimensions, MATRIX_DIMENSIONS);
  assert.equal(data.rows.length, clis.length);
  assert.deepEqual(Object.keys(data.rows[0]), ROW_KEYS);
  assert.deepEqual(data.rows[0], {
    cli_id: 'codex', name: 'Codex CLI', acp: true, transport: 'stdio',
    resume_dialect: 'resume', max_concurrent_sessions: 3, evidence_hook: false
  });

  assert.strictEqual(data.rows[1].acp, false);
  assert.strictEqual(data.rows[1].transport, '');
  assert.strictEqual(data.rows[1].resume_dialect, '');
  assert.strictEqual(data.rows[1].max_concurrent_sessions, 0);
  assert.strictEqual(data.rows[1].evidence_hook, true);

  for (const dimension of MATRIX_DIMENSIONS) {
    assert.strictEqual(data.rows[2][dimension], null, `${dimension} stays null`);
  }
});

test('A1-M3: absent fields are undefined, not fabricated defaults', () => {
  const data = buildMatrixData([{ cli_id: 'partial', name: 'Partial' }]);
  const row = data.rows[0];
  assert.strictEqual(row.cli_id, 'partial');
  assert.strictEqual(row.name, 'Partial');
  for (const dimension of MATRIX_DIMENSIONS) {
    assert.equal(Object.hasOwn(row, dimension), true, `${dimension} key is present`);
    assert.strictEqual(row[dimension], undefined, `${dimension} has no default`);
  }
});

test('A1-M4: capabilities is not a dimension and no second source is read', () => {
  const source = fs.readFileSync(
    new URL('../../src/adapter/cli-discovery/capability-matrix.js', import.meta.url),
    'utf8'
  );
  assert.equal(
    /node:fs|readFile|loadCliRegistry|KNOWN_AGENT_CLI|cli-registry|process\.env/.test(source),
    false,
    'projection reads only its clis argument'
  );

  const clis = [{ cli_id: 'x', name: 'X', capabilities: ['resume', 'close'], acp: null }];
  const data = buildMatrixData(clis);
  assert.deepEqual(Object.keys(data.rows[0]), ROW_KEYS);
  assert.equal(Object.hasOwn(data.rows[0], 'capabilities'), false);
  assert.equal(data.dimensions.includes('capabilities'), false);

  clis[0].acp = true;
  const refreshed = buildMatrixData(clis);
  assert.strictEqual(data.rows[0].acp, null, 'first projection is not cached');
  assert.strictEqual(refreshed.rows[0].acp, true, 'second projection reads the same single source');
});

test('A1-M5: non-array input does not throw and yields empty rows', () => {
  for (const bad of [undefined, null, {}]) {
    const data = buildMatrixData(bad);
    assert.equal(data.dimensions, MATRIX_DIMENSIONS);
    assert.deepEqual(data.rows, []);
  }
});

test('A1-M6: domain layer contains no CJK literals', () => {
  for (const relative of [
    'src/adapter/cli-discovery/capability-matrix.js',
    'src/adapter/cli-discovery/index.js'
  ]) {
    const source = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    assert.equal(/[\u3400-\u9fff]/.test(source), false, `${relative} has CJK`);
  }
});
