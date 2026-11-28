/** V3.2 统一错误码与返回约定（实现约定，非规格断言）。 */

/** 错误码全集：HTTP 层与领域层共用，所有领域失败只能取这里的码。 */
export const ERROR_CODES = Object.freeze([
  'ORG_INVALID_INPUT', 'ORG_NOT_FOUND', 'ORG_REV_CONFLICT', 'ORG_ILLEGAL_TRANSITION',
  'ORG_FORBIDDEN_FIELD', 'ORG_DUPLICATE_ID', 'ORG_DUPLICATE_VERSION', 'ORG_ROLE_NOT_QUALIFIED', 'ORG_ROLE_GAP',
  'ORG_NO_CANDIDATE', 'ORG_SERIAL_QUEUE', 'ORG_ASSIGNMENT_LOCKED', 'ORG_CLI_UNAVAILABLE',
  'ORG_CLI_CAPABILITY_GAP', 'ORG_SESSION_CONFLICT', 'ORG_RECOVERY_UNAVAILABLE',
  'ORG_APPROVER_INVALID', 'ORG_DELIVERY_INCOMPLETE', 'ORG_SNAPSHOT_MISMATCH'
]);

export function isErrorCode(code) {
  return ERROR_CODES.includes(code);
}

/** 成功返回：{ ok:true, value, ...extra }。 */
export function ok(value, extra = {}) {
  return { ok: true, value, ...extra };
}

/** 失败返回：{ ok:false, code, params }；未知码直接抛错，避免拼写漂移。 */
export function fail(code, params = {}) {
  if (!isErrorCode(code)) throw new TypeError(`Unknown V32 error code: ${code}`);
  return { ok: false, code, params };
}

/** 把异常规整成领域失败结果；保留已有 V32 码。 */
export function fromError(error, fallbackCode = 'ORG_INVALID_INPUT') {
  if (error && typeof error === 'object' && isErrorCode(error.code)) {
    return fail(error.code, error.params && typeof error.params === 'object' ? error.params : { message: String(error.message || '') });
  }
  return fail(fallbackCode, { message: error && error.message ? error.message : String(error) });
}
