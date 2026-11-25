/**
 * Shell label wiring gate (beta.4 menu redesign).
 *
 * A key the shell asks for but the server never delivers renders as an empty
 * string: an empty table header, an invisible button, a blank toast. Functionally
 * the handler still runs, so nothing fails — the product just looks like a shell.
 * This test makes that class of defect impossible to ship again.
 *
 * Rules:
 *   1. every `ctx.t('KEY')` / `labelText('KEY')` in `desktop/ui/**` (the studio
 *      sub-app owns its own table and is excluded) must be delivered by
 *      `GET /ui/labels`;
 *   2. keys resolved through the studio table (`ctx.st`) are exempt: they come
 *      from `STUDIO_TEXT`, not from the desktop table.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UI_ROOT = path.join(REPO_ROOT, 'desktop', 'ui');
// The studio sub-app (`./studio.html`) loads its own table through
// `STUDIO_TEXT`; every other module in `desktop/ui` resolves through
// `GET /ui/labels`.
const EXCLUDED_DIRS = new Set(['studio']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

/** Keys the shell resolves through the desktop table (ctx.t / labelText). */
function referencedKeys(file) {
  const source = fs.readFileSync(file, 'utf8');
  const keys = [];
  for (const pattern of [
    /ctx\.t\('([A-Z0-9_]+)'/g,
    /labelText\('([A-Z0-9_]+)'/g,
  ]) {
    let match;
    while ((match = pattern.exec(source)) !== null) keys.push(match[1]);
  }
  return keys;
}

test('外壳引用的每个文案键都由 /ui/labels 下发（空文案不再上得了线）', () => {
  const delivered = new Set(Object.keys(UI_LABEL_KEYS));
  const missing = new Map();
  let referenced = 0;
  for (const file of walk(UI_ROOT)) {
    for (const key of referencedKeys(file)) {
      referenced += 1;
      if (delivered.has(key)) continue;
      const short = path.relative(UI_ROOT, file);
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key).add(short);
    }
  }
  assert.ok(referenced > 100, `扫描到的引用键过少（${referenced}），说明扫描器失效了`);
  const report = [...missing.entries()].map(([key, files]) => `${key} <- ${[...files].join(',')}`);
  assert.deepEqual(report, [], `以下键被引用但未下发：\n${report.join('\n')}`);
});
