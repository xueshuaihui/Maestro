/** ACP 统一错误类型：把 JSON-RPC error 收敛成可判定的结构 */
export class AcpError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'AcpError';
    this.code = code;
    this.data = data;
  }
  get isMethodNotFound() {
    return this.code === -32601;
  }
  get isResourceNotFound() {
    return this.code === -32002;
  }
}

/**
 * 所有 transport 必须实现的接口（唯一不变量，核心只依赖它）：
 *
 *   connect()                      -> Promise<void>
 *   request(method, params, opts)   -> Promise<result>        // 5 原语里的请求
 *   notify(method, params)         -> Promise<void>           // session/cancel 这类通知
 *   onNotification(cb)             -> void                    // agent -> client 通知（session/update）
 *   onRequest(cb)                  -> void                    // agent -> client 请求（session/request_permission）
 *   close()                        -> Promise<void>
 */
export class TransportBase {
  get kind() {
    return 'abstract';
  }
  async connect() {
    throw new Error('connect() not implemented');
  }
  async request() {
    throw new Error('request() not implemented');
  }
  async notify() {
    throw new Error('notify() not implemented');
  }
  onNotification(cb) {
    this._onNotification = cb;
  }
  onRequest(cb) {
    this._onRequest = cb;
  }
  async close() {}
  _dispatchNotification(method, params) {
    this._onNotification?.(method, params);
  }
  _dispatchRequest(method, params) {
    if (!this._onRequest) return Promise.resolve({});
    return this._onRequest(method, params);
  }
}
