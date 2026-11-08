/**
 * Split a `SKILL.md` into front matter metadata and body text.
 *
 * Layout: line 1 must be `---`, a second `---` closes the metadata block, and
 * everything after it is the body (internal blank lines preserved). The body is
 * returned verbatim; whether it is empty is a business rule owned by the
 * registry loader, not by this module.
 *
 * YAML errors from the metadata block are passed through with the file level
 * 1-based line number (metadata starts on line 2, hence the +1 offset). No
 * natural-language text is produced here: only `detailKey` / `detailParams`.
 */
import { parseYaml } from './yaml-lite.js';

const FRONT_MATTER_KEY = 'missing-front-matter';

function fail(line, detailKey, detailParams = {}) {
  return { ok: false, line, detailKey, detailParams };
}

/**
 * @param {string} text raw file content
 * @returns {{ok:true,meta:object,body:string}|{ok:false,line:number,detailKey:string,detailParams:object}}
 */
export function parseSkillFile(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return fail(1, FRONT_MATTER_KEY, {});
  }
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return fail(1, FRONT_MATTER_KEY, {});
  const metaText = lines.slice(1, close).join('\n');
  const parsed = parseYaml(metaText);
  if (!parsed.ok) {
    return fail(parsed.line + 1, parsed.detailKey, parsed.detailParams);
  }
  const body = lines.slice(close + 1).join('\n');
  return { ok: true, meta: parsed.value, body };
}
