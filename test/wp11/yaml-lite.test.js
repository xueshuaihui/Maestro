import test from 'node:test';
import assert from 'node:assert/strict';

import { parseYaml } from '../../src/registry/yaml-lite.js';

const ok = (text) => {
  const result = parseYaml(text);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
};

const bad = (text) => {
  const result = parseYaml(text);
  assert.equal(result.ok, false, JSON.stringify(result));
  return result;
};

test('parses a flat mapping with string, integer and boolean scalars', () => {
  const value = ok('id: worker\ncount: 3\nflag: true\noff: false\n');
  assert.deepEqual(value, { id: 'worker', count: 3, flag: true, off: false });
});

test('keeps UTF-8 scalars as-is', () => {
  const value = ok('name: 撰写者\nsummary: 按研究笔记撰写完整文档');
  assert.equal(value.name, '撰写者');
  assert.equal(value.summary, '按研究笔记撰写完整文档');
});

test('supports single and double quoted scalars', () => {
  const value = ok("a: 'x y'\nb: \"z\"");
  assert.deepEqual(value, { a: 'x y', b: 'z' });
});

test('keeps a hash inside quotes and cuts a hash after whitespace', () => {
  const value = ok('a: "x # y"\nb: plain # trailing');
  assert.equal(value.a, 'x # y');
  assert.equal(value.b, 'plain');
});

test('skips whole-line comments and counts them in line numbers', () => {
  const result = parseYaml('# first\n# second\na: 1\na: 2');
  assert.equal(result.ok, false);
  assert.equal(result.line, 4);
  assert.equal(result.detailKey, 'duplicate-key');
});

test('returns an empty object for whitespace-only input', () => {
  assert.deepEqual(ok('   \n\n# only a comment\n'), {});
});

test('parses an inline sequence of strings', () => {
  assert.deepEqual(ok('skills: [doc-draft, test-run]'), {
    skills: ['doc-draft', 'test-run']
  });
});

test('parses an empty inline sequence', () => {
  assert.deepEqual(ok('skills: []'), { skills: [] });
});

test('parses an inline sequence with quoted items containing commas', () => {
  assert.deepEqual(ok('commands: ["node --test", "a,b"]'), {
    commands: ['node --test', 'a,b']
  });
});

test('parses a block sequence of scalars', () => {
  assert.deepEqual(ok('skills:\n  - doc-draft\n  - test-run\n'), {
    skills: ['doc-draft', 'test-run']
  });
});

test('parses nested mappings two spaces at a time', () => {
  const value = ok('graph:\n  nodes:\n    - id: T-001\n      role: dev\n');
  assert.deepEqual(value, { graph: { nodes: [{ id: 'T-001', role: 'dev' }] } });
});

test('treats a key without content as null', () => {
  assert.deepEqual(ok('dispatchable:\ntools:'), { dispatchable: null, tools: null });
});

test('reads explicit null and tilde as null', () => {
  assert.deepEqual(ok('a: null\nb: ~'), { a: null, b: null });
});

test('rejects a duplicate key with its line and key', () => {
  const result = bad('id: a\nid: b');
  assert.equal(result.detailKey, 'duplicate-key');
  assert.equal(result.line, 2);
  assert.deepEqual(result.detailParams, { key: 'id' });
});

test('rejects tab indentation', () => {
  const result = bad('\tid: a');
  assert.equal(result.detailKey, 'unsupported-token');
  assert.equal(result.line, 1);
  assert.equal(result.detailParams.token, '\\t');
});

test('rejects an odd indentation width', () => {
  const result = bad('a:\n   b: 1');
  assert.equal(result.detailKey, 'inconsistent-indentation');
  assert.equal(result.line, 2);
});

test('rejects a block scalar marker', () => {
  const result = bad('summary: |');
  assert.equal(result.detailKey, 'unsupported-token');
  assert.equal(result.detailParams.token, '|');
});

test('rejects a folded scalar marker', () => {
  const result = bad('summary: >');
  assert.equal(result.detailParams.token, '>');
});

test('rejects an anchor', () => {
  const result = bad('a: &base 1');
  assert.equal(result.detailParams.token, '&');
});

test('rejects an alias', () => {
  const result = bad('a: *base');
  assert.equal(result.detailParams.token, '*');
});

test('rejects an inline mapping', () => {
  const result = bad('a: {b: 1}');
  assert.equal(result.detailParams.token, '{');
});

test('rejects the merge key', () => {
  const result = bad('<<: 1');
  assert.equal(result.detailParams.token, '<<');
});

test('rejects a document separator line', () => {
  const result = bad('a: 1\n---\nb: 2');
  assert.equal(result.detailKey, 'unsupported-token');
  assert.equal(result.line, 2);
  assert.equal(result.detailParams.token, '---');
});

test('rejects two indentation widths at the same level', () => {
  const result = bad('a:\n  b: 1\n    c: 2');
  assert.equal(result.detailKey, 'inconsistent-indentation');
  assert.equal(result.line, 3);
});

test('rejects a nested line after a scalar value', () => {
  const result = bad('a: 1\n  b: 2');
  assert.equal(result.detailKey, 'inconsistent-indentation');
  assert.equal(result.line, 2);
});

test('rejects a sequence item whose key has no value', () => {
  const result = bad('skills:\n  - name:');
  assert.equal(result.detailKey, 'missing-value');
  assert.equal(result.line, 2);
  assert.deepEqual(result.detailParams, { key: 'name' });
});

test('reports the AC-09 fixture shape at line 4', () => {
  const text = ['# fixture for AC-09', '# indent error on purpose', 'schema: role/v1', '    id: broken'].join('\n');
  const result = bad(text);
  assert.equal(result.detailKey, 'inconsistent-indentation');
  assert.equal(result.line, 4);
});

test('rejects a file that starts indented', () => {
  const result = bad('    id: broken');
  assert.equal(result.detailKey, 'inconsistent-indentation');
  assert.equal(result.line, 1);
});

test('rejects a line without a key separator', () => {
  const result = bad('just-a-word');
  assert.equal(result.detailKey, 'unsupported-token');
  assert.equal(result.line, 1);
});

test('handles CRLF line endings', () => {
  assert.deepEqual(ok('a: 1\r\nb: 2\r\n'), { a: 1, b: 2 });
});

test('stops at the first error only', () => {
  const result = bad('a: 1\na: 2\n\tb: 3');
  assert.equal(result.detailKey, 'duplicate-key');
  assert.equal(result.line, 2);
});
