/** V3.2 统一错误码与返回约定（实现约定，非规格断言）。 */

/** 错误码全集：HTTP 层与领域层共用，所有领域失败只能取这里的码。 */
export const ERROR_CODES = Object.freeze([
  'V32_INVALID_INPUT', 'V32_NOT_FOUND', 'V32_REV_CONFLICT', 'V32_ILLEGAL_TRANSITION',
  'V32_FORBIDDEN_FIELD', 'V32_DUPLICATE_ID', 'V32_DUPLICATE_VERSION', 'V32_ROLE_NOT_QUALIFIED', 'V32_ROLE_GAP',
  'V32_NO_CANDIDATE', 'V32_SERIAL_QUEUE', 'V32_ASSIGNMENT_LOCKED', 'V32_CLI_UNAVAILABLE',
  'V32_CLI_CAPABILITY_GAP', 'V32_SESSION_CONFLICT', 'V32_RECOVERY_UNAVAILABLE',
  'V32_APPROVER_INVALID', 'V32_DELIVERY_INCOMPLETE', 'V32_SNAPSHOT_MISMATCH'
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
export function fromError(error, fallbackCode = 'V32_INVALID_INPUT') {
  if (error && typeof error === 'object' && isErrorCode(error.code)) {
    return fail(error.code, error.params && typeof error.params === 'object' ? error.params : { message: String(error.message || '') });
  }
  return fail(fallbackCode, { message: error && error.message ? error.message : String(error) });
}
