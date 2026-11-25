/**
 * Instance maintenance HTTP routes (additive, after frozen tables).
 *   GET    /instances/:id/export       real OTLP-shaped export
 *   POST   /instances/:id/clone        copy an instance into a new id
 *   PATCH  /instances/:id              rename the display title
 *   POST   /instances/:id/save-template  instance -> workflow asset
 *   DELETE /instances/:id              archive (soft remove, resumable)
 */

import { readBody } from './stream.js';
import {
  archiveInstance,
  cloneInstance,
  renameInstance,
  exportInstance,
  saveInstanceAsTemplate
} from '../instance-maintenance.js';

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

async function bodyOf(req) {
  try {
    const buffer = await readBody(req, 64 * 1024);
    const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer?.text ?? '');
    const value = JSON.parse(text.length > 0 ? text : '{}');
    return { ok: true, value: value !== null && typeof value === 'object' ? value : {} };
  } catch {
    return { ok: false, code: 'INSTANCE_BODY_INVALID' };
  }
}

export function createInstanceMaintenanceRoutes({ root }) {
  const run = async (res, fn) => {
    try {
      const result = await fn();
      return result?.ok === false
        ? sendJson(res, 200, { ...result, labelKey: `ERR_${result.code}` })
        : sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { ok: false, code: 'INSTANCE_MAINTENANCE_FAILED', message: err?.message ?? String(err) });
    }
  };

  return [
    {
      method: 'GET',
      pattern: '/instances/:id/export',
      async handler(_req, res, _url, params) {
        return run(res, () => exportInstance(root, params.id));
      }
    },
    {
      method: 'POST',
      pattern: '/instances/:id/clone',
      async handler(req, res, _url, params) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return sendJson(res, 200, parsed);
        return run(res, () => cloneInstance(root, params.id, parsed.value));
      }
    },
    {
      method: 'PATCH',
      pattern: '/instances/:id',
      async handler(req, res, _url, params) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return sendJson(res, 200, parsed);
        return run(res, () => renameInstance(root, params.id, parsed.value.name));
      }
    },
    {
      method: 'POST',
      pattern: '/instances/:id/save-template',
      async handler(req, res, _url, params) {
        const parsed = await bodyOf(req);
        if (!parsed.ok) return sendJson(res, 200, parsed);
        return run(res, () => saveInstanceAsTemplate(root, params.id, parsed.value));
      }
    },
    {
      method: 'DELETE',
      pattern: '/instances/:id',
      async handler(_req, res, _url, params) {
        return run(res, () => archiveInstance(root, params.id));
      }
    }
  ];
}
