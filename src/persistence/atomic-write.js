/**
 * 原子写与备份复制（拆分文档 §2.2 / §1.4）。
 *
 * 写入顺序固定：open(tmp,'wx') → write → fsync → close → rename(覆盖目标)。
 * Windows 上 rename 会被杀软/索引占用而返回 EPERM/EBUSY/EACCES，重试 3 次后失败，
 * **不降级为"直接覆盖目标"**——降级会让崩溃窗口里出现半截文件。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// 第 1 次失败后依次等待 20 / 50 / 120ms，共 3 次重试（合计 4 次尝试）。
const RENAME_RETRY_DELAYS_MS = [20, 50, 120];
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function writeFailed(err, filePath) {
  return {
    ok: false,
    code: 'STORE_WRITE_FAILED',
    params: { errno: err?.code ?? null, path: filePath },
  };
}

async function removeQuietly(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // 清理失败不影响返回值：真正要报的是写入失败的原因。
  }
}

/**
 * 原子写 JSON。
 *
 * `value.updatedAt` 由调用方（store.save）负责更新，这里只回报最终落盘的时间戳。
 *
 * @returns {Promise<{ok:true, bytes:number, updatedAt:string|null}
 *   | {ok:false, code:'STORE_WRITE_FAILED', params:{errno:string|null, path:string}}>}
 */
export async function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(
    dir,
    `${path.basename(filePath)}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`,
  );
  const buf = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');

  let handle = null;
  try {
    await fs.mkdir(dir, { recursive: true });
    handle = await fs.open(tmpPath, 'wx'); // 1) 独占创建，撞名即失败
    let offset = 0;
    while (offset < buf.length) {
      const { bytesWritten } = await handle.write(buf, offset, buf.length - offset, null);
      if (bytesWritten <= 0) {
        const err = new Error('短写：write 未推进偏移');
        err.code = 'EIO';
        throw err;
      }
      offset += bytesWritten;
    }
    await handle.sync(); // 3) fsync：确保内容真的落盘而不只是进 page cache
    await handle.close(); // 4) 关句柄后才能 rename（Windows 上句柄未关会 EPERM）
    handle = null;
  } catch (err) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // 关句柄失败无需上抛，主因是写入失败。
      }
    }
    await removeQuietly(tmpPath);
    return writeFailed(err, filePath);
  }

  const renamed = await renameWithRetry(tmpPath, filePath);
  if (!renamed.ok) {
    await removeQuietly(tmpPath);
    return writeFailed(renamed.err, filePath);
  }

  const updatedAt = typeof value?.updatedAt === 'string' ? value.updatedAt : null;
  return { ok: true, bytes: buf.length, updatedAt };
}

/**
 * 把 `srcPath` 复制为 `dstPath`（AC-13：原文件必须仍在，所以是复制而不是重命名）。
 *
 * @returns {Promise<{ok:true, copiedBytes:number}
 *   | {ok:false, code:'STORE_BACKUP_FAILED', params:{errno:string|null, path:string, target:string}}>}
 */
export async function copyToBackup(srcPath, dstPath) {
  try {
    await fs.mkdir(path.dirname(dstPath), { recursive: true });
    await fs.copyFile(srcPath, dstPath);
    const stat = await fs.stat(dstPath);
    return { ok: true, copiedBytes: stat.size };
  } catch (err) {
    return {
      ok: false,
      code: 'STORE_BACKUP_FAILED',
      params: { errno: err?.code ?? null, path: srcPath, target: dstPath },
    };
  }
}

async function renameWithRetry(tmpPath, dstPath) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RENAME_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await fs.rename(tmpPath, dstPath);
      return { ok: true };
    } catch (err) {
      lastErr = err;
      const retryable = RETRYABLE_RENAME_CODES.has(err?.code);
      const hasRetryLeft = attempt < RENAME_RETRY_DELAYS_MS.length;
      if (!retryable || !hasRetryLeft) break;
      await sleep(RENAME_RETRY_DELAYS_MS[attempt]);
    }
  }
  return { ok: false, err: lastErr };
}
