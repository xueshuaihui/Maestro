import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSkillFile } from '../../src/registry/skill-file.js';

const ok = (text) => {
  const result = parseSkillFile(text);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};

const bad = (text) => {
  const result = parseSkillFile(text);
  assert.equal(result.ok, false, JSON.stringify(result));
  return result;
};

const SAMPLE = [
  '---',
  'schema: skill/v1',
  'id: code-change',
  'name: 代码修改',
  'summary: 定位到要改的文件并做最小改动',
  'applies_to: [coding]',
  'commands: ["node --test"]',
  '---',
  '',
  '### 工作方法',
  '',
  '1. 先读产物行。',
  '2. 只改必要位置。'
].join('\n');

test('splits front matter and body', () => {
  const result = ok(SAMPLE);
  assert.equal(result.meta.id, 'code-change');
  assert.equal(result.meta.name, '代码修改');
  assert.deepEqual(result.meta.applies_to, ['coding']);
  assert.deepEqual(result.meta.commands, ['node --test']);
  assert.equal(result.body.startsWith('\n### 工作方法'), true);
  assert.equal(result.body.includes('2. 只改必要位置。'), true);
});

test('reports missing front matter on line 1', () => {
  const result = bad('schema: skill/v1\nid: x\n---\nbody');
  assert.equal(result.detailKey, 'missing-front-matter');
  assert.equal(result.line, 1);
});

test('reports missing closing separator on line 1', () => {
  const result = bad('---\nid: x\nbody without close');
  assert.equal(result.detailKey, 'missing-front-matter');
  assert.equal(result.line, 1);
});

test('reports an empty file as missing front matter', () => {
  const result = bad('');
  assert.equal(result.detailKey, 'missing-front-matter');
  assert.equal(result.line, 1);
});

test('accepts a separator line with surrounding spaces', () => {
  const result = ok('  ---  \nid: x\n---\nbody');
  assert.equal(result.meta.id, 'x');
});

test('keeps internal blank lines of the body', () => {
  const result = ok('---\nid: x\n---\nline1\n\nline2\n');
  assert.equal(result.body, 'line1\n\nline2\n');
});

test('returns an empty body when nothing follows the separator', () => {
  const result = ok('---\nid: x\n---');
  assert.equal(result.body, '');
});

test('offsets a YAML error by the front matter start line', () => {
  const result = bad('---\nid: a\nid: b\n---\nbody');
  assert.equal(result.detailKey, 'duplicate-key');
  assert.equal(result.line, 3);
  assert.deepEqual(result.detailParams, { key: 'id' });
});

test('offsets an indentation error by the front matter start line', () => {
  const result = bad('---\nid: a\n   summary: b\n---\nbody');
  assert.equal(result.detailKey, 'inconsistent-indentation');
  assert.equal(result.line, 3);
});

test('reports an unsupported token inside the metadata block', () => {
  const result = bad('---\nid: x\nsummary: |\n---\nbody');
  assert.equal(result.detailKey, 'unsupported-token');
  assert.equal(result.line, 3);
  assert.equal(result.detailParams.token, '|');
});

test('parses a CRLF file', () => {
  const result = ok('---\r\nid: x\r\n---\r\nbody\r\n');
  assert.equal(result.meta.id, 'x');
  assert.equal(result.body, 'body\n');
});

test('does not judge an empty body as a business error', () => {
  const result = ok('---\nid: x\n---\n   \n');
  assert.equal(result.ok, true);
  assert.equal(result.body.trim(), '');
});

test('returns the metadata block as a plain object', () => {
  const result = ok('---\nid: x\ntools:\n  - read\n  - write\n---\nbody');
  assert.deepEqual(result.meta.tools, ['read', 'write']);
});
