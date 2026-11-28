/**
 * V3.2 CLI pool HTTP route fragment.
 *
 * createV32CliRoutes(deps) is side-effect free: no disk IO, no store creation
 * and no throw at construction time. The store/pool is created on the first
 * request and cached, because the daemon swallows route factory exceptions.
 *
 * Responses are JSON. Domain failures keep the {ok:false, code, params}
 * shape with 400 / 404 / 409 status codes.
 */

import { readBody } from '../stream.js';
import { fail } from '../../../org/contracts.js';
import { createCliPool } from '../../../org/cli-pool.js';

const BODY_LIMIT = 128 * 1024;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  return res.end(text);
}

function statusFor(code) {
  if (code === 'ORG_NOT_FOUND') return 404;
  if (code === 'ORG_REV_CONFLICT' || code === 'ORG_DUPLICATE_ID' || code === 'ORG_CLI_UNAVAILABLE') return 409;
  return 400;
}

function sendFailure(res, result) {
  const code = result?.code ?? 'ORG_INVALID_INPUT';
  return sendJson(res, statusFor(code), {
    ok: false,
    code,
    params: result?.params ?? {}
  });
}

/**
 * @param {object} deps
 * @param {string} [deps.root] absolute project root (lazy store creation)
 * @param {Function} [deps.now] ISO clock
 * @param {object} [deps.cliPool] injected pool (tests / T15 composition)
 * @param {object} [deps.discovery] discover.js overrides
 * @param {object} [deps.probe] probe.js overrides
 * @param {object} [deps.discoveryOptions] discovery options
 * @param {object} [deps.probeOptions] probe options
 * @param {Function} [deps.readBody] body reader override (tests)
 */
export function createV32CliRoutes(deps = {}) {
  let cachedPool = deps.cliPool ?? null;

  const getPool = () => {
    if (cachedPool) return cachedPool;
    cachedPool = createCliPool({
      root: deps.root,
      now: deps.now,
      discovery: deps.discovery,
      probe: deps.probe,
      discoveryOptions: deps.discoveryOptions,
      probeOptions: deps.probeOptions
    });
    return cachedPool;
  };

  const readJson = async (req) => {
    const read = deps.readBody ?? readBody;
    const buffer = await read(req, BODY_LIMIT);
    if (Buffer.isBuffer(buffer)) {
      const text = buffer.toString('utf8').trim();
      if (text.length === 0) return {};
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    if (buffer && typeof buffer === 'object' && !Buffer.isBuffer(buffer)) return buffer;
    return {};
  };

  const wrapped = async (res, fn) => {
    try {
      const result = await fn();
      return result?.ok === false ? sendFailure(res, result) : sendJson(res, 200, result);
    } catch (error) {
      return sendFailure(res, fail('ORG_INVALID_INPUT', {
        field: 'request', message: String(error?.message ?? error)
      }));
    }
  };

  return [
    {
      method: 'GET',
      pattern: '/org/cli',
      handler(_req, res) {
        return wrapped(res, () => {
          const pool = getPool();
          return {
            ok: true,
            value: pool.list(),
            scan: pool.scanStatus(),
            stats: {
              discovered: pool.scanStatus().discovered,
              available: pool.scanStatus().available,
              unhealthy: pool.scanStatus().unhealthy
            }
          };
        });
      }
    },
    {
      method: 'POST',
      pattern: '/org/cli',
      async handler(req, res) {
        return wrapped(res, async () => {
          const body = await readJson(req);
          const result = getPool().addManual(body);
          return result.ok
            ? { ...result, value: result.value.install, deduplicated: result.value.deduplicated }
            : result;
        });
      }
    },
    {
      method: 'POST',
      pattern: '/org/cli/scan',
      async handler(req, res) {
        return wrapped(res, async () => {
          const body = await readJson(req);
          const mode = body.mode === undefined ? 'full' : body.mode;
          return getPool().scan({ mode });
        });
      }
    },
    {
      method: 'POST',
      pattern: '/org/cli/:id/health',
      async handler(_req, res, _url, params) {
        return wrapped(res, () => getPool().checkHealth({ id: params.id }));
      }
    },
    {
      method: 'GET',
      pattern: '/org/cli/:id/capabilities',
      handler(_req, res, _url, params) {
        return wrapped(res, () => getPool().capabilitiesOf(params.id));
      }
    }
  ];
}
