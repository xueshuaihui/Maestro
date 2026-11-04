import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CODES,
  ERROR_TEXT_KEY,
  STAGE_TEXT_KEY,
  classifyPromptError,
  classifyPreflightError,
  isSessionInvalid
} from '../../src/core/error-map.js';

const readCore = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('-32602 with "already in flight" is NODE_BUSY', () => {
  const res = classifyPromptError({
    code: -32602,
    message: 'Invalid params: a prompt is already in flight for this session'
  });
  assert.equal(res.code, CODES.NODE_BUSY);
  assert.equal(res.code, 'NODE_BUSY');
});

test('-32602 with any other message is SESSION_INVALID', () => {
  const res = classifyPromptError({ code: -32602, message: 'unknown session' });
  assert.equal(res.code, 'SESSION_INVALID');
});

test('-32603 keeps the full original text in params.raw', () => {
  const res = classifyPromptError({ code: -32603, message: 'boom' });
  assert.equal(res.code, 'HOST_ERROR');
  assert.equal(res.params.raw, 'boom');
});

test('an unregistered code is UNKNOWN_ERROR and preserves the raw text', () => {
  const raw = '怪东西';
  const res = classifyPromptError({ code: -32099, message: raw });
  assert.equal(res.code, 'UNKNOWN_ERROR');
  assert.equal(res.params.raw, raw);
});

test('sessionKnown === false forces SESSION_INVALID', () => {
  const res = classifyPromptError({
    code: -32603,
    message: 'anything',
    sessionKnown: false
  });
  assert.equal(res.code, 'SESSION_INVALID');
});

test('-32002 is SESSION_INVALID regardless of wording', () => {
  assert.equal(
    classifyPromptError({ code: -32002, message: 'a prompt is already in flight' }).code,
    'SESSION_INVALID'
  );
});

test('raw text is never trimmed, rewritten or truncated', () => {
  const raw = '  internal failure: {"detail":"x"}  -- tail kept  ';
  const res = classifyPromptError({ code: -32603, message: raw });
  assert.equal(res.params.raw, raw);
  assert.equal(res.params.raw.length, raw.length);
});

test('preflight stages map onto the four pre-run codes', () => {
  assert.deepEqual(classifyPreflightError({ stage: 'spawn', cause: 'no binary' }), {
    code: 'DSH_SPAWN_FAILED',
    params: { cause: 'no binary' }
  });
  assert.deepEqual(classifyPreflightError({ stage: 'cwd', cause: 'D:/demo/out' }), {
    code: 'CWD_NOT_WRITABLE',
    params: { path: 'D:/demo/out' }
  });
  assert.deepEqual(classifyPreflightError({ stage: 'core', cause: 'timeout' }), {
    code: 'CORE_START_FAILED',
    params: { cause: 'timeout' }
  });
  assert.deepEqual(classifyPreflightError({ stage: 'busy' }), {
    code: 'NODE_BUSY',
    params: {}
  });
  assert.equal(classifyPreflightError({ stage: 'other', cause: 'x' }).code, 'UNKNOWN_ERROR');
});

test('isSessionInvalid distinguishes busy from gone', () => {
  assert.equal(
    isSessionInvalid({ code: -32602, message: 'a prompt is already in flight' }),
    false
  );
  assert.equal(isSessionInvalid({ code: -32602, message: 'unknown session' }), true);
  assert.equal(isSessionInvalid({ code: -32002, message: 'anything' }), true);
  assert.equal(isSessionInvalid({ code: -32603, message: 'boom' }), false);
  assert.equal(isSessionInvalid({ code: 'SESSION_INVALID' }), true);
});

test('CODES carries the nine documented codes plus two store codes', () => {
  const nine = [
    'DSH_SPAWN_FAILED',
    'CWD_NOT_WRITABLE',
    'CORE_START_FAILED',
    'NODE_BUSY',
    'SESSION_INVALID',
    'PERMISSION_DENIED',
    'HOST_ERROR',
    'VERIFY_FAILED',
    'UNKNOWN_ERROR'
  ];
  for (const code of nine) {
    assert.equal(CODES[code], code);
  }
  assert.equal(CODES.STATE_CORRUPT, 'STATE_CORRUPT');
  assert.equal(CODES.INSTANCE_TERMINAL, 'INSTANCE_TERMINAL');
});

test('every code has exactly one labels key', () => {
  for (const code of Object.values(CODES)) {
    assert.equal(typeof ERROR_TEXT_KEY[code], 'string');
    assert.equal(ERROR_TEXT_KEY[code], code);
  }
  assert.equal(STAGE_TEXT_KEY.spawn, 'DSH_SPAWN_FAILED');
  assert.equal(STAGE_TEXT_KEY.cwd, 'CWD_NOT_WRITABLE');
  assert.equal(STAGE_TEXT_KEY.core, 'CORE_START_FAILED');
  assert.equal(STAGE_TEXT_KEY.busy, 'NODE_BUSY');
});

test('core files hold no Chinese and no forbidden lowercase tokens', () => {
  const files = ['../../src/core/error-map.js', '../../src/core/state-machine.js'];
  const cjk = /[\u3400-\u9fff]/;
  const taboo = /\b(dsh|host|transport|stdio)\b/;

  for (const rel of files) {
    const source = readCore(rel);
    assert.equal(cjk.test(source), false, `${rel} must not contain Chinese`);
    assert.equal(taboo.test(source), false, `${rel} must not contain forbidden tokens`);
  }
});
