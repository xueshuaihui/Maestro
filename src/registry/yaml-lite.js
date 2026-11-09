/**
 * Minimal YAML subset reader (zero dependency).
 *
 * Supported (requirement D-2): block mappings with space indentation, block
 * sequences, inline sequences `[a, b]`, plain / single-quoted / double-quoted
 * scalars, `true` / `false`, integers, empty values (`key:` -> null), UTF-8
 * scalars, whole-line and trailing comments (`#` after whitespace only).
 *
 * Not supported, reported as `unsupported-token`: block scalars (`|`, `>`),
 * anchors / aliases (`&`, `*`), inline mappings (`{...}`), tab indentation,
 * document separators (`---`) and the merge key (`<<`).
 *
 * The reader never produces a natural-language sentence: it returns a machine
 * `detailKey` plus `detailParams`, and the CLI assembles the Chinese text from
 * `labels.js` (D-3). Parsing stops at the first error (D-2).
 */

const ERROR_KEYS = Object.freeze({
  INDENT: 'inconsistent-indentation',
  TOKEN: 'unsupported-token',
  DUPLICATE: 'duplicate-key',
  MISSING_VALUE: 'missing-value'
});

const UNSUPPORTED_LEADERS = Object.freeze(['|', '>', '&', '*', '{', '<<']);

const KEY_PATTERN = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(?:\s+(.*))?$/;
const KEY_HEAD_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*\s*:/;

class YamlError extends Error {
  constructor(line, detailKey, detailParams = {}) {
    super(detailKey);
    this.line = line;
    this.detailKey = detailKey;
    this.detailParams = detailParams;
  }
}

function fail(err) {
  return { ok: false, line: err.line, detailKey: err.detailKey, detailParams: err.detailParams };
}

/** Cut a trailing comment, ignoring `#` inside quotes and not preceded by space. */
function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

function tokenOf(text) {
  return text.trim().split(/\s+/)[0].slice(0, 20);
}

function coerceScalar(text, line) {
  const raw = text.trim();
  if (raw === '') return null;
  if (raw[0] === '"' || raw[0] === "'") {
    const quote = raw[0];
    if (raw.length < 2 || raw[raw.length - 1] !== quote) {
      throw new YamlError(line, ERROR_KEYS.TOKEN, { token: quote });
    }
    return raw.slice(1, -1).replace(new RegExp(`\\\\${quote}`, 'g'), quote);
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw.includes('{')) throw new YamlError(line, ERROR_KEYS.TOKEN, { token: '{' });
  return raw;
}

function splitInlineList(inner, line) {
  const parts = [];
  let current = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (quote) throw new YamlError(line, ERROR_KEYS.TOKEN, { token: quote });
  parts.push(current);
  return parts.map((part) => coerceScalar(part, line));
}

function parseInlineValue(text, line) {
  const raw = text.trim();
  if (raw[0] === '[') {
    if (raw[raw.length - 1] !== ']') throw new YamlError(line, ERROR_KEYS.TOKEN, { token: '[' });
    const inner = raw.slice(1, -1).trim();
    if (inner === '') return [];
    return splitInlineList(inner, line);
  }
  for (const leader of UNSUPPORTED_LEADERS) {
    if (raw.startsWith(leader)) {
      throw new YamlError(line, ERROR_KEYS.TOKEN, { token: leader });
    }
  }
  return coerceScalar(raw, line);
}

function parseBlock(items, pos, indent) {
  if (items[pos].text.startsWith('-')) return parseSequence(items, pos, indent);
  return parseMapping(items, pos, indent);
}

function parseMapping(items, pos, indent, target = null) {
  const map = target ?? {};
  let index = pos;
  while (index < items.length) {
    const item = items[index];
    if (item.indent < indent) break;
    if (item.indent > indent) throw new YamlError(item.line, ERROR_KEYS.INDENT);
    if (item.text.startsWith('-')) throw new YamlError(item.line, ERROR_KEYS.INDENT);
    if (item.text.startsWith('<<')) {
      throw new YamlError(item.line, ERROR_KEYS.TOKEN, { token: '<<' });
    }
    const match = item.text.match(KEY_PATTERN);
    if (!match) throw new YamlError(item.line, ERROR_KEYS.TOKEN, { token: tokenOf(item.text) });
    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      throw new YamlError(item.line, ERROR_KEYS.DUPLICATE, { key });
    }
    const rest = (match[2] ?? '').trim();
    index += 1;
    if (rest === '') {
      if (index < items.length && items[index].indent > indent) {
        const nestedIndent = items[index].indent;
        const [nested, next] = parseBlock(items, index, nestedIndent);
        map[key] = nested;
        index = next;
      } else {
        map[key] = null;
      }
      continue;
    }
    map[key] = parseInlineValue(rest, item.line);
    if (index < items.length && items[index].indent > indent) {
      throw new YamlError(items[index].line, ERROR_KEYS.INDENT);
    }
  }
  return [map, index];
}

function parseSequence(items, pos, indent) {
  const list = [];
  let index = pos;
  while (index < items.length) {
    const item = items[index];
    if (item.indent < indent) break;
    if (item.indent > indent) throw new YamlError(item.line, ERROR_KEYS.INDENT);
    if (!item.text.startsWith('-')) throw new YamlError(item.line, ERROR_KEYS.INDENT);
    const content = item.text.slice(1).trim();
    index += 1;
    if (content === '') {
      if (index < items.length && items[index].indent > indent) {
        const [nested, next] = parseBlock(items, index, items[index].indent);
        list.push(nested);
        index = next;
      } else {
        list.push(null);
      }
      continue;
    }
    if (KEY_HEAD_PATTERN.test(content)) {
      const entry = {};
      const match = content.match(KEY_PATTERN);
      if (!match) throw new YamlError(item.line, ERROR_KEYS.TOKEN, { token: tokenOf(content) });
      const key = match[1];
      const rest = (match[2] ?? '').trim();
      if (rest === '') throw new YamlError(item.line, ERROR_KEYS.MISSING_VALUE, { key });
      entry[key] = parseInlineValue(rest, item.line);
      if (index < items.length && items[index].indent > indent) {
        const [nested, next] = parseMapping(items, index, items[index].indent, entry);
        index = next;
      }
      list.push(entry);
      continue;
    }
    list.push(parseInlineValue(content, item.line));
    if (index < items.length && items[index].indent > indent) {
      throw new YamlError(items[index].line, ERROR_KEYS.INDENT);
    }
  }
  return [list, index];
}

/**
 * @param {string} text raw file content
 * @returns {{ok:true,value:object}|{ok:false,line:number,detailKey:string,detailParams:object}}
 */
export function parseYaml(text) {
  const rawLines = String(text ?? '').split(/\r?\n/);
  const items = [];
  // A lexical problem is held back instead of failing fast: a syntax error on an
  // earlier line must still win (D-2 reports the first error of the file).
  let pending = null;
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    const line = i + 1;
    const indentMatch = raw.match(/^[ \t]*/);
    const indentText = indentMatch ? indentMatch[0] : '';
    if (indentText.includes('\t')) {
      pending = new YamlError(line, ERROR_KEYS.TOKEN, { token: '\\t' });
      break;
    }
    const body = stripComment(raw.slice(indentText.length)).replace(/\s+$/, '');
    if (body.trim() === '') continue;
    if (body.trim() === '---') {
      pending = new YamlError(line, ERROR_KEYS.TOKEN, { token: '---' });
      break;
    }
    if (indentText.length % 2 !== 0) {
      pending = new YamlError(line, ERROR_KEYS.INDENT);
      break;
    }
    items.push({ indent: indentText.length, text: body, line });
  }
  if (items.length === 0) {
    return pending ? fail(pending) : { ok: true, value: {} };
  }
  try {
    const [value, next] = parseBlock(items, 0, 0);
    if (next !== items.length) {
      return fail(new YamlError(items[next].line, ERROR_KEYS.INDENT));
    }
    if (pending) return fail(pending);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return fail(new YamlError(items[0].line, ERROR_KEYS.TOKEN, { token: tokenOf(items[0].text) }));
    }
    return { ok: true, value };
  } catch (err) {
    if (err instanceof YamlError) return fail(err);
    throw err;
  }
}
