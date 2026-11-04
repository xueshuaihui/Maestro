/**
 * 原始帧录制器 —— 所有实验的「原始证据」来源。
 *
 * 每个 run 一个目录：runs/<runId>/<transport>.jsonl
 * 每行一条：{ seq, ts, dir, method, id, frame }
 *   dir = out（client -> agent）/ in（agent -> client）/ err（子进程 stderr）
 */
import fs from 'node:fs';
import path from 'node:path';

export class FrameRecorder {
  constructor({ dir, runId, transport }) {
    this.dir = dir;
    this.runId = runId;
    this.transport = transport;
    this.seq = 0;
    this.counts = { out: 0, in: 0 };
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${transport}.jsonl`);
    this.fd = fs.openSync(this.file, 'w');
  }

  record(dir, frame, extra = {}) {
    this.seq += 1;
    if (dir === 'out' || dir === 'in') this.counts[dir] += 1;
    const line = JSON.stringify({
      seq: this.seq,
      ts: new Date().toISOString(),
      dir,
      method: frame?.method ?? extra.method ?? null,
      id: frame?.id ?? null,
      frame,
      ...extra,
    });
    fs.writeSync(this.fd, line + '\n');
  }

  close() {
    try {
      fs.closeSync(this.fd);
    } catch {
      /* ignore */
    }
  }
}

export class NullRecorder {
  record() {}
  close() {}
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
