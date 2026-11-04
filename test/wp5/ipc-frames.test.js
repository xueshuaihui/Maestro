import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_FRAME_BYTES,
  createFrameDecoder,
  encodeFrame,
  validateFrame,
} from '../../src/daemon/ipc-frames.js';

const req = (id, method = 'core.ping') => ({ v: 1, kind: 'req', id, method, params: {} });

test('encodeFrame：JSON + 换行，可被解码器还原', () => {
  const buf = encodeFrame(req('c-1'));
  assert.equal(buf.at(-1), 0x0a);
  const frames = createFrameDecoder().push(buf);
  assert.deepEqual(frames, [req('c-1')]);
});

test('半帧拼接：两次 push 才拼出一帧，半帧不出结果', () => {
  const decoder = createFrameDecoder();
  const buf = encodeFrame(req('c-2'));
  const cut = Math.floor(buf.length / 2);

  assert.deepEqual(decoder.push(buf.subarray(0, cut)), []);
  assert.deepEqual(decoder.push(buf.subarray(cut)), [req('c-2')]);
});

test('多帧一次到：按 0x0a 全切开，空行跳过', () => {
  const decoder = createFrameDecoder();
  const chunk = Buffer.concat([
    Buffer.from('\n'),
    encodeFrame(req('c-3')),
    Buffer.from('\r\n'),
    encodeFrame(req('c-4', 'instance.list')),
    Buffer.from('\n'),
  ]);

  const frames = decoder.push(chunk);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].id, 'c-3');
  assert.equal(frames[1].method, 'instance.list');
});

test('坏 JSON：产出 IPC_BAD_FRAME 标记帧，且不影响后续合法帧', () => {
  const decoder = createFrameDecoder();
  const frames = decoder.push(Buffer.from('{"v":1,"kind":\n'));

  assert.equal(frames.length, 1);
  assert.equal(frames[0].__error, 'IPC_BAD_FRAME');

  const more = decoder.push(encodeFrame(req('c-5')));
  assert.deepEqual(more, [req('c-5')]);
});

test('非对象 JSON（数组/字面量）同样视为坏帧', () => {
  const decoder = createFrameDecoder();
  const frames = decoder.push(Buffer.from('[1,2,3]\nnull\n'));
  assert.deepEqual(
    frames.map((f) => f.__error),
    ['IPC_BAD_FRAME', 'IPC_BAD_FRAME'],
  );
});

test('超长帧：返回 IPC_FRAME_TOO_LARGE 标记并丢弃缓冲', () => {
  const decoder = createFrameDecoder({ maxBytes: 64 });
  const big = Buffer.from(`${JSON.stringify({ v: 1, kind: 'req', id: 'c-6', method: 'x', pad: 'a'.repeat(200) })}\n`);
  const frames = decoder.push(big);

  assert.equal(frames.length, 1);
  assert.equal(frames[0].__error, 'IPC_FRAME_TOO_LARGE');

  // 缓冲已清空：下一帧不受污染。
  assert.deepEqual(decoder.push(encodeFrame(req('c-7'))), [req('c-7')]);
});

test('无换行的半帧积压超过 maxBytes：也按超限处理', () => {
  const decoder = createFrameDecoder({ maxBytes: 32 });
  const frames = decoder.push(Buffer.alloc(33, 0x61));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].__error, 'IPC_FRAME_TOO_LARGE');
});

test('reset() 丢弃半帧', () => {
  const decoder = createFrameDecoder();
  decoder.push(Buffer.from('{"v":1,"kind":"req"'));
  decoder.reset();
  assert.deepEqual(decoder.push(encodeFrame(req('c-8'))), [req('c-8')]);
});

test('validateFrame：三类帧的形状校验', () => {
  assert.deepEqual(validateFrame(req('c-9')), { ok: true });
  assert.deepEqual(validateFrame({ v: 1, kind: 'res', id: 'c-9', ok: true, result: {} }), { ok: true });
  assert.deepEqual(
    validateFrame({ v: 1, kind: 'evt', stream: 'instance:INST-001', seq: 3, event: { object: 'node' } }),
    { ok: true },
  );

  const bad = [
    null,
    [],
    { v: 2, kind: 'req', id: 'c-1', method: 'core.ping' },
    { v: 1, kind: 'nope', id: 'c-1' },
    { v: 1, kind: 'req', method: 'core.ping' },
    { v: 1, kind: 'req', id: 'c-1' },
    { v: 1, kind: 'res', id: 'c-1' },
    { v: 1, kind: 'evt', stream: 'instance:INST-001', seq: 1 },
    { v: 1, kind: 'evt', stream: 'instance:INST-001', seq: '1', event: {} },
  ];
  for (const frame of bad) {
    const result = validateFrame(frame);
    assert.equal(result.ok, false, `应当拒绝：${JSON.stringify(frame)}`);
    assert.equal(result.code, 'IPC_BAD_FRAME');
  }
});

test('默认上限是 8 MiB', () => {
  assert.equal(DEFAULT_MAX_FRAME_BYTES, 8 * 1024 * 1024);
});
