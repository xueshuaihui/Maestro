/**
 * Error classification. No display text lives here: every case resolves to a key
 * of the labels table (see ERROR_TEXT_KEY), the wording itself lives in src/cli/labels.js.
 *
 * Cross-boundary convention: this module returns {code, params}; it never throws.
 */

export const CODES = Object.freeze({
  DSH_SPAWN_FAILED: 'DSH_SPAWN_FAILED',
  CWD_NOT_WRITABLE: 'CWD_NOT_WRITABLE',
  CORE_START_FAILED: 'CORE_START_FAILED',
  NODE_BUSY: 'NODE_BUSY',
  SESSION_INVALID: 'SESSION_INVALID',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  HOST_ERROR: 'HOST_ERROR',
  VERIFY_FAILED: 'VERIFY_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  STATE_CORRUPT: 'STATE_CORRUPT',
  INSTANCE_TERMINAL: 'INSTANCE_TERMINAL'
});

/** JSON-RPC codes that carry a double meaning and must be split by message text. */
const RPC_INVALID_PARAMS = -32602;
const RPC_INTERNAL_ERROR = -32603;
const RPC_INVALID_REQUEST = -32002;

const NODE_BUSY_PATTERN = /already in flight/i;

/** Preflight stage -> code. Used before a run starts. */
const STAGE_CODES = Object.freeze({
  spawn: CODES.DSH_SPAWN_FAILED,
  cwd: CODES.CWD_NOT_WRITABLE,
  core: CODES.CORE_START_FAILED,
  busy: CODES.NODE_BUSY
});

function textOf(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

function isNodeBusyMessage(message) {
  return NODE_BUSY_PATTERN.test(textOf(message));
}

/**
 * Classify an error returned by session/prompt (after the run started).
 * The double-meaning -32602 is decided by message text, never by code alone.
 */
export function classifyPromptError({ code, message, sessionKnown } = {}) {
  if (sessionKnown === false) {
    return { code: CODES.SESSION_INVALID, params: { raw: message } };
  }
  if (code === RPC_INVALID_PARAMS) {
    if (isNodeBusyMessage(message)) {
      return { code: CODES.NODE_BUSY, params: {} };
    }
    return { code: CODES.SESSION_INVALID, params: { raw: message } };
  }
  if (code === RPC_INVALID_REQUEST) {
    return { code: CODES.SESSION_INVALID, params: { raw: message } };
  }
  if (code === RPC_INTERNAL_ERROR) {
    return { code: CODES.HOST_ERROR, params: { raw: message } };
  }
  return { code: CODES.UNKNOWN_ERROR, params: { raw: message } };
}

/** Classify a failure detected before the run starts. */
export function classifyPreflightError({ stage, cause } = {}) {
  const code = STAGE_CODES[stage];
  if (code === CODES.DSH_SPAWN_FAILED || code === CODES.CORE_START_FAILED) {
    return { code, params: { cause } };
  }
  if (code === CODES.CWD_NOT_WRITABLE) {
    return { code, params: { path: cause } };
  }
  if (code === CODES.NODE_BUSY) {
    return { code, params: {} };
  }
  return { code: CODES.UNKNOWN_ERROR, params: { raw: cause } };
}

/** True when the failure means the session has to be recreated. */
export function isSessionInvalid({ code, message } = {}) {
  if (code === CODES.SESSION_INVALID) return true;
  if (code === RPC_INVALID_REQUEST) return true;
  if (code === RPC_INVALID_PARAMS) return !isNodeBusyMessage(message);
  return false;
}

/**
 * Every classification result maps onto exactly one labels key.
 * Key names match the codes; the wording lives only in src/cli/labels.js.
 */
export const ERROR_TEXT_KEY = Object.freeze({
  DSH_SPAWN_FAILED: 'DSH_SPAWN_FAILED',
  CWD_NOT_WRITABLE: 'CWD_NOT_WRITABLE',
  CORE_START_FAILED: 'CORE_START_FAILED',
  NODE_BUSY: 'NODE_BUSY',
  SESSION_INVALID: 'SESSION_INVALID',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  HOST_ERROR: 'HOST_ERROR',
  VERIFY_FAILED: 'VERIFY_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  STATE_CORRUPT: 'STATE_CORRUPT',
  INSTANCE_TERMINAL: 'INSTANCE_TERMINAL'
});

/** Preflight stage -> labels key (same key space as ERROR_TEXT_KEY). */
export const STAGE_TEXT_KEY = Object.freeze({
  spawn: ERROR_TEXT_KEY.DSH_SPAWN_FAILED,
  cwd: ERROR_TEXT_KEY.CWD_NOT_WRITABLE,
  core: ERROR_TEXT_KEY.CORE_START_FAILED,
  busy: ERROR_TEXT_KEY.NODE_BUSY
});
