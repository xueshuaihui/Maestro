/**
 * 最小产出核对（拆分文档 §2.9）。
 *
 * 规则只有两条：
 * 1. 任务**声明了**产出路径 → 每个都必须存在且 `bytes > 0`，否则 MISSING / EMPTY；
 * 2. **未声明** → `ok:true` + `note:'NO_DECLARATION'`，由调用方补一条
 *    `verification.skipped` 事件（需求 2.4 边界说明）。
 *
 * `sha256` 恒为 null：产物指纹校验属 I1.12，本迭代不计算，也不写空串。
 * `observedRefs` 只用于日志，不参与判定。
 *
 * 路径提取规则刻意保持“可解释、可测试”：
 * - 只在中文引导词（保存到 / 保存为 / 另存为 / 输出到 / 生成到 / 写入 / 存到 / 写到）的
 *   从句里，才允许不带分隔符的文件名（`notes.txt` 这种）；
 * - 从句之外的裸 token 必须含路径分隔符（`/` 或 `\`），所以 `Node.js` 不算声明产出；
 * - 绝对路径与含 `..` 的越界路径一律丢弃，返回空。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** 中文引导词：把“保存到 out/intro.md”这类短语里的路径抓出来。 */
const LEAD_WORDS = /(?:保存到|保存为|另存为|输出到|生成到|写入|存到|写到)/g;

/** 从句结束于句末标点；逗号 / 顿号不算（它们分隔多个路径）。 */
const CLAUSE_END = /[。；;！!？?\n]/;

/** 路径候选 token：空白与中英文标点切分，`和` / `及` 再单独切开。 */
const PATH_TOKEN = /[^\s，。；、,;：:！!？?"'“”‘’（）()【】\[\]]+/g;

const COORDINATORS = new Set(['和', '及']);

// 路径字符集保持 ASCII：中文短语（如“字的产品说明”）因此永远不会被当成路径。
const PATH_CHARS = /^[A-Za-z0-9_.\-/]+$/;

// 扩展名必须以字母开头（`intro.md` 命中，版本号 `v1.2` 不命中）。
const EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,7}$/;

function isAbsoluteLike(token) {
  return (
    path.posix.isAbsolute(token) ||
    path.win32.isAbsolute(token) ||
    /^[A-Za-z]:/.test(token) ||
    token.startsWith('\\\\')
  );
}

/**
 * 归一化为 POSIX 风格相对路径；不可信输入返回 null。
 * 拒绝：绝对路径、盘符、`..` 越界、非 ASCII、既无分隔符也无扩展名。
 */
export function normalizeDeclaredPath(raw) {
  if (typeof raw !== 'string') return null;
  let token = raw
    .trim()
    .replace(/^["'“”‘’（(【\[]+/, '')
    .replace(/["'“”‘’）)】\]]+$/, '')
    .replace(/\\/g, '/');
  if (token.length === 0) return null;
  if (isAbsoluteLike(token)) return null;

  const segments = token.split('/').filter((s) => s.length > 0 && s !== '.');
  if (segments.length === 0) return null;
  if (segments.some((s) => s === '..')) return null;

  const normalized = segments.join('/');
  if (!PATH_CHARS.test(normalized)) return null;
  const hasSeparator = segments.length > 1;
  const hasExtension = EXTENSION.test(normalized) && normalized.lastIndexOf('.') > 0;
  if (!hasSeparator && !hasExtension) return null;
  return normalized;
}

/**
 * 从任务描述里提取声明产出（保持出现顺序、去重）。
 *
 * @param {string} taskText
 * @returns {string[]}
 */
export function extractDeclaredArtifacts(taskText) {
  if (typeof taskText !== 'string' || taskText.length === 0) return [];

  /** @type {Array<{index:number, raw:string}>} */
  const occurrences = [];

  // ① 引导词从句：从句内允许 `、` / `和` / `及` / `，` / `,` / 空白分隔的多个路径。
  const lead = new RegExp(LEAD_WORDS.source, 'g');
  let match;
  while ((match = lead.exec(taskText)) !== null) {
    const start = lead.lastIndex;
    const rest = taskText.slice(start);
    const stop = rest.search(CLAUSE_END);
    const clause = stop >= 0 ? rest.slice(0, stop) : rest;
    for (const token of clause.matchAll(PATH_TOKEN)) {
      if (COORDINATORS.has(token[0])) continue;
      occurrences.push({ index: start + token.index, raw: token[0] });
    }
  }

  // ② 从句之外的裸 token：只有含路径分隔符才当路径（`Node.js` 不是）。
  for (const token of taskText.matchAll(PATH_TOKEN)) {
    if (!/[\\/]/.test(token[0])) continue;
    occurrences.push({ index: token.index, raw: token[0] });
  }

  // 保持出现顺序（同一位置时，从句里的先于裸 token 计入）。
  occurrences.sort((a, b) => a.index - b.index);

  const found = [];
  const seen = new Set();
  for (const { raw } of occurrences) {
    const normalized = normalizeDeclaredPath(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    found.push(normalized);
  }

  return found;
}

async function inspect(absPath) {
  try {
    const stat = await fs.stat(absPath);
    return { exists: true, bytes: stat.size };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function refFor(baseDir, absPath) {
  const relative = path.relative(baseDir, absPath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return toPosix(relative);
  }
  return toPosix(absPath);
}

/**
 * @param {{cwd: string, declared?: string[], observedRefs?: string[]}} options
 * @returns {Promise<{
 *   ok: boolean,
 *   refs: Array<{ref:string,absPath:string,declared:boolean,exists:boolean,bytes:number,sha256:null}>,
 *   note?: 'NO_DECLARATION',
 *   failure?: {code:'MISSING'|'EMPTY', ref:string, message:string}
 * }>}
 */
export async function verifyArtifacts({ cwd, declared = [], observedRefs = [] } = {}) {
  const baseDir = path.resolve(cwd ?? '.');
  const declaredRefs = [];
  const seen = new Set();

  for (const raw of Array.isArray(declared) ? declared : []) {
    const normalized = normalizeDeclaredPath(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    declaredRefs.push(normalized);
  }

  const refs = [];
  let failure = null;

  for (const ref of declaredRefs) {
    const absPath = path.resolve(baseDir, ref);
    const stat = await inspect(absPath);
    refs.push({ ref, absPath, declared: true, exists: stat.exists, bytes: stat.bytes, sha256: null });
    if (!failure) {
      if (!stat.exists) {
        failure = { code: 'MISSING', ref, message: `未找到声明的产出 ${ref}` };
      } else if (!(stat.bytes > 0)) {
        failure = { code: 'EMPTY', ref, message: `声明的产出为空 ${ref}` };
      }
    }
  }

  for (const raw of Array.isArray(observedRefs) ? observedRefs : []) {
    if (typeof raw !== 'string' || raw.length === 0) continue;
    const absPath = path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
    const ref = refFor(baseDir, absPath);
    if (seen.has(ref)) continue;
    seen.add(ref);
    const stat = await inspect(absPath);
    refs.push({ ref, absPath, declared: false, exists: stat.exists, bytes: stat.bytes, sha256: null });
  }

  if (declaredRefs.length === 0) {
    return { ok: true, refs, note: 'NO_DECLARATION' };
  }
  if (failure) {
    return { ok: false, refs, failure };
  }
  return { ok: true, refs };
}

/* ------------------------------------------------------------------------- *
 * Fixed-format branch (I1.2). Only used by templates that declare products in
 * the task text (`产物：<path>`, full-width colon). The two functions above stay
 * untouched so the single-node template keeps its I1.1 heuristic behaviour.
 * ------------------------------------------------------------------------- */

/** Full-width marker only; the half-width form counts as "not declared" (M-11). */
export const PRODUCT_LINE = /产物：/;

const PRODUCT_MARKER = '产物：';

/** Separators inside a product line: whitespace, Chinese/ASCII commas, semicolons. */
const PRODUCT_SEPARATOR = /[\s、,，;；]+/;

const PRODUCT_CONJUNCTIONS = new Set(['和', '及', '与']);

/**
 * Normalize one declared product to a POSIX relative reference.
 * `./calc.js` and `calc.js` are the same; backslashes are normalized.
 * Absolute paths and `..` escapes return null.
 */
export function normalizeProductRef(raw, cwd = null) {
  void cwd;
  if (typeof raw !== 'string') return null;
  const token = raw
    .trim()
    .replace(/^["'“”‘’（(【\[]+/, '')
    .replace(/["'“”‘’）)】\]]+$/, '')
    .replace(/[。，,；;]+$/, '')
    .replace(/\\/g, '/');
  if (token.length === 0) return null;
  if (isAbsoluteLike(token)) return null;

  const segments = token.split('/').filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === '..')) return null;

  const normalized = segments.join('/');
  const hasSeparator = segments.length > 1;
  const hasExtension = EXTENSION.test(normalized) && normalized.lastIndexOf('.') > 0;
  if (!hasSeparator && !hasExtension) return null;
  return normalized;
}

/**
 * Extract the declared products from a task text.
 *
 * One line may carry several products (`产物：calc.js out/util.js`); several lines
 * are allowed. Only the full-width `产物：` marker is recognised — a half-width
 * `产物:` means "not declared" and returns PRODUCT_LINE_MISSING, so the caller can
 * print the readable D-5 message.
 *
 * @param {string} taskText
 * @returns {{ok:true, refs:string[]}|{ok:false, code:'PRODUCT_LINE_MISSING'}}
 */
export function extractProductLines(taskText) {
  if (typeof taskText !== 'string' || taskText.length === 0) {
    return { ok: false, code: 'PRODUCT_LINE_MISSING' };
  }

  const refs = [];
  const seen = new Set();

  for (const line of taskText.split(/\r?\n/)) {
    let cursor = 0;
    while (cursor < line.length) {
      const marker = line.indexOf(PRODUCT_MARKER, cursor);
      if (marker < 0) break;
      const tail = line.slice(marker + PRODUCT_MARKER.length);
      for (const token of tail.split(PRODUCT_SEPARATOR)) {
        if (token.length === 0 || PRODUCT_CONJUNCTIONS.has(token)) continue;
        const ref = normalizeProductRef(token);
        if (!ref || seen.has(ref)) continue;
        seen.add(ref);
        refs.push(ref);
      }
      cursor = marker + PRODUCT_MARKER.length;
    }
  }

  if (refs.length === 0) return { ok: false, code: 'PRODUCT_LINE_MISSING' };
  return { ok: true, refs };
}

/** Singular spelling kept as an alias (task sheet uses this name). */
export const extractProductsLine = extractProductLines;

function startedAtMsOf(roundStartedAt) {
  if (roundStartedAt === null || roundStartedAt === undefined) return null;
  if (typeof roundStartedAt === 'number' && Number.isFinite(roundStartedAt)) return roundStartedAt;
  const parsed = Date.parse(String(roundStartedAt));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Verify declared products (D-7): each must exist, be non-empty and be newer than
 * the current round's dispatch time. Messages are verbatim D-5.
 *
 * @param {{cwd?:string, products?:string[], roundStartedAt?:string|number|null,
 *          fs?:object, now?:Function}} options
 * @returns {Promise<{ok:true, refs:Array<object>}
 *   |{ok:false, code:'MISSING'|'EMPTY'|'STALE', ref:string, message:string}>}
 */
export async function verifyProducts({
  cwd = null,
  products = [],
  roundStartedAt = null,
  fs: io = fs,
  now = () => Date.now()
} = {}) {
  const baseDir = path.resolve(cwd ?? '.');
  const startedMs = startedAtMsOf(roundStartedAt);
  const list = Array.isArray(products) ? products : [];
  const refs = [];

  const toRef = (value) => normalizeProductRef(value) ?? (typeof value === 'string' ? value : null);

  for (const raw of list) {
    const ref = toRef(raw);
    if (ref === null) continue;

    const absPath = path.resolve(baseDir, ref);
    let stat = null;
    try {
      stat = await io.stat(absPath);
    } catch {
      stat = null;
    }

    if (stat === null) {
      return { ok: false, code: 'MISSING', ref, message: `未找到声明的产出 ${ref}` };
    }
    if (!(stat.size > 0)) {
      return { ok: false, code: 'EMPTY', ref, message: `产出为空 ${ref}` };
    }
    if (startedMs !== null && stat.mtimeMs < startedMs) {
      return { ok: false, code: 'STALE', ref, message: `产出不是本轮新写 ${ref}` };
    }

    refs.push({
      ref,
      absPath,
      exists: true,
      bytes: stat.size,
      mtime: stat.mtime instanceof Date ? stat.mtime.toISOString() : new Date(stat.mtimeMs).toISOString(),
      verifiedAt: new Date(now()).toISOString()
    });
  }

  return { ok: true, refs };
}

/** Split-doc spelling kept as an alias so either import name wires up. */
export const verifyDeclaredArtifacts = verifyProducts;
