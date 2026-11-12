/**
 * `GET /ui/labels` 响应体组装（I1.10a WP-7 / 需求 D-2）。
 *
 * 职责只有一件事：把 `./labels.js` 的键值全集序列化为 HTTP JSON 响应。
 * 鉴权（Bearer）、静态资源、生命周期与 desktop.json 归 `http/server.js`（WP-2，
 * S-02 容缺接缝）：本文件导出的路由描述符合注入式 handler 表形状
 * `{ method, pattern, handler }`，可经 `registerRoutes(table)` 注入，也可由
 * server 侧惰性动态 import 后按 `pattern` 承接。
 */

import { labelKeysPayload } from './labels.js';

/** 本路由的唯一路径常量（与需求 D-2 接口表一致）。 */
export const UI_LABELS_PATH = '/ui/labels';

/** 响应体 JSON 字符串（每次调用现算，键值为冻结表，无内部可变状态）。 */
export function labelsResponseBody() {
  return JSON.stringify(labelKeysPayload());
}

/** 写出 200 + JSON 响应体；`res` 为 `node:http` 的 ServerResponse。 */
export function respondUiLabels(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(labelsResponseBody());
  return res;
}

/** 路由描述（handler 表形状，见模块头注释）。 */
export function createLabelsRoute() {
  return {
    method: 'GET',
    pattern: UI_LABELS_PATH,
    handler(req, res) {
      respondUiLabels(res);
    }
  };
}
