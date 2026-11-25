/**
 * Unified resource platform HTTP API.
 *
 * Additive table, registered after the frozen v1 and studio tables:
 *   GET  /resources                     list (type/source/archived filters)
 *   GET  /resources/:type/:id           get one
 *   POST /resources                     create
 *   PATCH /resources/:type/:id          update
 *   POST /resources/:type/:id/archive   archive
 *   POST /resources/:type/:id/restore   restore
 *   DELETE /resources/:type/:id         remove (?force=1&archive=0)
 *   POST /resources/:type/:id/clone     clone
 *   POST /resources/:type/:id/fork      builtin -> project copy
 *   GET  /resources/:type/:id/export    export envelope
 *   POST /resources/import              import envelope
 *   GET  /resources/:type/:id/refs      reference integrity
 *   GET  /resources/labels              localized labels (CJK single source)
 *
 * Errors travel as `{ok:false, code, params}` with HTTP 200, matching the
 * studio convention so the UI renders localized text without a second table.
 */

import { readBody } from './stream.js';
import { STUDIO_TEXT as T } from '../../cli/labels.js';
import {
  listResources,
  getResource,
  createResource,
  updateResource,
  archiveResource,
  restoreResource,
  removeResource,
  cloneResource,
  forkResource,
  exportResource,
  importResource,
  collectRefs
} from '../../resources/index.js';

const BODY_LIMIT = 128 * 1024;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

function fail(res, result) {
  return sendJson(res, 200, {
    ok: false,
    code: result?.code ?? 'RESOURCE_FAILED',
    params: result?.params ?? {},
    labelKey: `ERR_${result?.code ?? 'RESOURCE_FAILED'}`
  });
}

async function bodyOf(req) {
  try {
    const buffer = await readBody(req, BODY_LIMIT);
    const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer?.text ?? '');
    const parsed = JSON.parse(text.length > 0 ? text : '{}');
    return { ok: true, value: parsed !== null && typeof parsed === 'object' ? parsed : {} };
  } catch {
    return { ok: false, code: 'RESOURCE_BODY_INVALID', params: {} };
  }
}

function queryOf(url) {
  if (!url || typeof url.searchParams === 'undefined') return {};
  const out = {};
  for (const [key, value] of url.searchParams.entries()) out[key] = value;
  return out;
}

export function createResourceRoutes({ root }) {
  const wrapped = async (res, fn) => {
    try {
      const result = await fn();
      return result?.ok === false ? fail(res, result) : sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { ok: false, code: 'RESOURCE_ROUTE_FAILED', message: err?.message ?? String(err) });
    }
  };

  return [
    {
      method: 'GET',
      pattern: '/resources/labels',
      handler(_req, res) {
        return sendJson(res, 200, { ok: true, labels: T });
      }
    },
    {
      method: 'GET',
      pattern: '/resources',
      async handler(req, res, url) {
        return wrapped(res, () => {
          const q = queryOf(url);
          const types = typeof q.types === 'string' && q.types.length > 0 ? q.types.split(',') : undefined;
          return listResources(root, {
            types,
            source: typeof q.source === 'string' ? q.source : null,
            includeArchived: q.archived === '1' || q.includeArchived === '1'
          });
        });
      }
    },
    {
      method: 'GET',
      pattern: '/resources/:type/:id/refs',
      async handler(_req, res, _url, params) {
        return wrapped(res, () => collectRefs(root, params.type, params.id));
      }
    },
    {
      method: 'GET',
      pattern: '/resources/:type/:id/export',
      async handler(_req, res, _url, params) {
        return wrapped(res, () => exportResource(root, params.type, params.id));
      }
    },
    {
      method: 'GET',
      pattern: '/resources/:type/:id',
      async handler(_req, res, _url, params) {
        return wrapped(res, () => getResource(root, params.type, params.id));
      }
    },
    {
      method: 'POST',
      pattern: '/resources',
      async handler(req, res) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return fail(res, parsed);
        const { type, input } = parsed.value;
        return wrapped(res, () => createResource(root, type, input));
      }
    },
    {
      method: 'POST',
      pattern: '/resources/import',
      async handler(req, res) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return fail(res, parsed);
        return wrapped(res, () => importResource(root, parsed.value.payload ?? parsed.value));
      }
    },
    {
      method: 'PATCH',
      pattern: '/resources/:type/:id',
      async handler(req, res, _url, params) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return fail(res, parsed);
        return wrapped(res, () => updateResource(root, params.type, params.id, parsed.value.patch ?? parsed.value));
      }
    },
    {
      method: 'POST',
      pattern: '/resources/:type/:id/archive',
      async handler(_req, res, _url, params) {
        return wrapped(res, () => archiveResource(root, params.type, params.id));
      }
    },
    {
      method: 'POST',
      pattern: '/resources/:type/:id/restore',
      async handler(_req, res, _url, params) {
        return wrapped(res, () => restoreResource(root, params.type, params.id));
      }
    },
    {
      method: 'POST',
      pattern: '/resources/:type/:id/clone',
      async handler(req, res, _url, params) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return fail(res, parsed);
        return wrapped(res, () => cloneResource(root, params.type, params.id, parsed.value));
      }
    },
    {
      method: 'POST',
      pattern: '/resources/:type/:id/fork',
      async handler(req, res, _url, params) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return fail(res, parsed);
        return wrapped(res, () => forkResource(root, params.type, params.id, parsed.value));
      }
    },
    {
      method: 'DELETE',
      pattern: '/resources/:type/:id',
      async handler(req, res, url, params) {
        const q = queryOf(url);
        return wrapped(res, () => removeResource(root, params.type, params.id, {
          force: q.force === '1' || q.force === 'true',
          archive: q.archive !== '0'
        }));
      }
    }
  ];
}
