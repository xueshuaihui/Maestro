/**
 * 本地 IPC 帧编解码（拆分文档 §1.3 / §2.13）。
 *
 * 线格式与 ACP 一致：NDJSON，一帧 = 一个 JSON 对象 + `\n`（0x0a），无任何头部。
 * 三类帧：
 *   req  {"v":1,"kind":"req","id":"c-1","method":"run.start","params":{…}}
 *   res  {"v":1,"kind":"res","id":"c-1","ok":true,"result":{…}}
 *   evt  {"v":1,"kind":"evt","stream":"instance:INST-001","seq":42,"event":{…}}
 *
 * 坏帧策略（**全仓只此一种**）：解码器从不抛异常，而是产出一个标记帧向下传递——
 *   - JSON 解析失败 / 空对象：`{__error:'IPC_BAD_FRAME'}`。连接不断，上层记日志并忽略该行
 *     （与 ACP 的 `enqueueLine` 行为对齐，单行噪声不得炸掉核心）。
 *   - 单帧超过 `maxBytes`：`{__error:'IPC_FRAME_TOO_LARGE'}`，解码器随即丢弃缓冲，
 *     上层必须断开该连接（拆分文档 §1.3“超限断开”）。
 * 上层（server / client）必须同时处理这两种标记；两处口径一致。
 */

/** 单帧默认上限 8 MiB（拆分文档 §1.3）。 */
export const DEFAULT_MAX_FRAME_BYTES = 8 * 1024 * 1024;

const LF = 0x0a;
const KINDS = new Set(['req', 'res', 'evt']);

/** 编码一帧为可写 Buffer（`JSON.stringify` + `'\n'`，UTF-8）。 */
export function encodeFrame(frame) {
  return Buffer.from(`${JSON.stringify(frame)}\n`, 'utf8');
}

/**
 * 流式解码器：自管半帧缓冲，按 `0x0a` 切行。
 *
 * @param {{maxBytes?: number}} [options]
 * @returns {{push(chunk: Buffer|Uint8Array|string): object[], reset(): void}}
 */
export function createFrameDecoder({ maxBytes = DEFAULT_MAX_FRAME_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('createFrameDecoder: maxBytes 必须是正整数');
  }

  let buffered = Buffer.alloc(0);

  function reset() {
    buffered = Buffer.alloc(0);
  }

  function push(chunk) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (bytes.length > 0) buffered = buffered.length === 0 ? bytes : Buffer.concat([buffered, bytes]);

    const frames = [];
    for (;;) {
      const nl = buffered.indexOf(LF);
      if (nl === -1) break;

      const line = buffered.subarray(0, nl);
      buffered = buffered.subarray(nl + 1);

      // 单个超长行：不清空已切出的合法帧，但必须丢弃剩余缓冲并让上层断开。
      if (line.length > maxBytes) {
        frames.push({ __error: 'IPC_FRAME_TOO_LARGE', bytes: line.length });
        reset();
        return frames;
      }

      const text = line.toString('utf8').trim();
      if (text === '') continue; // 空行跳过

      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        frames.push({ __error: 'IPC_BAD_FRAME', detail: { line: truncate(text) } });
        continue;
      }
      if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
        frames.push({ __error: 'IPC_BAD_FRAME', detail: { line: truncate(text) } });
        continue;
      }
      frames.push(frame);
    }

    // 半帧积压超过上限：永远等不到换行，按超限处理。
    if (buffered.length > maxBytes) {
      const bytes = buffered.length;
      reset();
      frames.push({ __error: 'IPC_FRAME_TOO_LARGE', bytes });
    }

    return frames;
  }

  return { push, reset };
}

/**
 * 帧结构校验（形状层面，不做业务校验）。
 *
 * @returns {{ok:true} | {ok:false, code:'IPC_BAD_FRAME', params:{reason:string}}}
 */
export function validateFrame(frame) {
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
    return bad('frame 必须是对象');
  }
  if (frame.v !== 1) return bad('v 必须为 1');
  if (!KINDS.has(frame.kind)) return bad('kind 必须是 req/res/evt');

  if (frame.kind === 'req') {
    if (typeof frame.id !== 'string' || frame.id.length === 0) return bad('req.id 必填');
    if (typeof frame.method !== 'string' || frame.method.length === 0) return bad('req.method 必填');
    return { ok: true };
  }

  if (frame.kind === 'res') {
    if (typeof frame.id !== 'string' || frame.id.length === 0) return bad('res.id 必填');
    if (typeof frame.ok !== 'boolean') return bad('res.ok 必须是布尔值');
    return { ok: true };
  }

  if (typeof frame.stream !== 'string' || frame.stream.length === 0) return bad('evt.stream 必填');
  if (!Number.isInteger(frame.seq)) return bad('evt.seq 必须是整数');
  if (frame.event === null || typeof frame.event !== 'object' || Array.isArray(frame.event)) {
    return bad('evt.event 必须是对象');
  }
  return { ok: true };
}

function bad(reason) {
  return { ok: false, code: 'IPC_BAD_FRAME', params: { reason } };
}

function truncate(text, limit = 200) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
