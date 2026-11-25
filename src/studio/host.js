/**
 * 运行宿主（host）的配置面：`<root>/.orch/hosts/<id>.json`
 *
 * 读取端是 `src/adapter/host-config.js`（形状 `{transport:'stdio', launch:{command,args}}`），
 * 本模块只负责**写**与**列**，让「扫描到本机有 opencode」这一步能落到一个真正可启动的宿主上。
 *
 * 约束：
 * - 不猜命令：`command` 必须是一个已存在且可执行的绝对路径，找不到就报 `STUDIO_HOST_EXEC_MISSING`。
 * - 不做半成品：`transport` 只接受 `stdio`（与读取端一致）。
 * - 幂等：同一个 id 再绑一次等于覆盖，不产生第二份配置。
 */
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWrite } from '../registry/asset-write.js';
import { hostConfigPath, PERMISSION_POLICIES } from '../adapter/host-config.js';
import { fail } from './schema.js';

/** 宿主 id 会变成文件名，限制在安全字符集内。 */
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** 一次扫描最多接受这么多参数，避免把整条命令行塞进配置。 */
const MAX_ARGS = 16;

/** 把 CLI 的 `cli_id` 收敛成合法宿主 id。 */
export function hostIdForCli(cliId) {
  const raw = typeof cliId === 'string' ? cliId.trim().toLowerCase() : '';
  const cleaned = raw.replace(/[^a-z0-9._-]/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 32);
  return cleaned.length > 0 ? cleaned : 'host';
}

async function readHostFile(root, id) {
  const file = hostConfigPath(root, id);
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const launch = parsed.launch && typeof parsed.launch === 'object' ? parsed.launch : {};
    return {
      id,
      file,
      transport: typeof parsed.transport === 'string' ? parsed.transport : 'stdio',
      command: typeof launch.command === 'string' ? launch.command : '',
      args: Array.isArray(launch.args) ? launch.args.filter((a) => typeof a === 'string') : [],
      permissionPolicy: parsed.limits?.permissionPolicy ?? null,
      unreadable: false,
    };
  } catch {
    // 坏文件照样列出来：用户需要知道它存在且不能用，而不是凭空消失。
    return { id, file, transport: 'stdio', command: '', args: [], permissionPolicy: null, unreadable: true };
  }
}

/**
 * 列出已配置的宿主。
 *
 * `usable` 只有在 command 指向一个真实可执行文件时才为 true —— 这正是
 * 「配置了但机器上没这个 CLI」与「能直接跑」的区别。
 */
export async function listHosts(root) {
  const dir = path.join(root, '.orch', 'hosts');
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return { ok: true, hosts: [] };
  }
  const hosts = [];
  for (const name of names.sort()) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    const entry = await readHostFile(root, id);
    if (!entry) continue;
    let usable = false;
    if (!entry.unreadable && entry.command.length > 0) {
      try {
        const stat = await fs.stat(entry.command);
        usable = stat.isFile();
        await fs.access(entry.command, fsConstants.X_OK);
      } catch {
        usable = false;
      }
    }
    hosts.push({ ...entry, usable });
  }
  return { ok: true, hosts };
}

/**
 * 绑定（或覆盖）一个宿主。
 *
 * @param {{id?: string, cliId?: string, command: string, args?: string[],
 *          permissionPolicy?: string}} options
 */
export async function bindHost(root, options = {}) {
  const command = typeof options.command === 'string' ? options.command.trim() : '';
  if (!path.isAbsolute(command)) return fail('STUDIO_HOST_EXEC_INVALID', { path: command });

  let stat = null;
  try {
    stat = await fs.stat(command);
  } catch {
    return fail('STUDIO_HOST_EXEC_MISSING', { path: command });
  }
  if (!stat.isFile()) return fail('STUDIO_HOST_EXEC_INVALID', { path: command });
  try {
    await fs.access(command, fsConstants.X_OK);
  } catch {
    return fail('STUDIO_HOST_EXEC_NOT_EXECUTABLE', { path: command });
  }

  const id = typeof options.id === 'string' && options.id.length > 0
    ? options.id
    : hostIdForCli(options.cliId ?? path.basename(command));
  if (!ID_RE.test(id)) return fail('STUDIO_HOST_ID_INVALID', { id });

  const rawArgs = Array.isArray(options.args) ? options.args : [];
  if (rawArgs.length > MAX_ARGS) return fail('STUDIO_HOST_ARGS_INVALID', { count: rawArgs.length });
  const args = [];
  for (const arg of rawArgs) {
    if (typeof arg !== 'string') return fail('STUDIO_HOST_ARGS_INVALID', { count: rawArgs.length });
    // 每个参数都必须是单个 argv 元素：含换行或全空白的参数一律拒绝，
    // 免得把 shell 片段当成一个参数带进 stdio 启动。
    if (arg.trim().length === 0) return fail('STUDIO_HOST_ARGS_INVALID', { count: rawArgs.length });
    if (/[\n\r]/.test(arg)) return fail('STUDIO_HOST_ARGS_INVALID', { count: rawArgs.length });
    args.push(arg);
  }

  const policy = options.permissionPolicy ?? null;
  if (policy !== null && !PERMISSION_POLICIES.includes(policy)) {
    return fail('STUDIO_HOST_POLICY_INVALID', { policy: String(policy) });
  }

  const payload = {
    transport: 'stdio',
    launch: { command, args },
    limits: policy === null ? {} : { permissionPolicy: policy },
  };
  const target = hostConfigPath(root, id);
  const written = await atomicWrite({ target, text: `${JSON.stringify(payload, null, 2)}\n` });
  if (!written || written.ok === false) {
    return fail('STUDIO_HOST_WRITE_FAILED', { path: target });
  }
  return { ok: true, host: { id, command, args, permissionPolicy: policy, usable: true } };
}

/** 删掉一个宿主配置。不存在时报错，避免「看起来删了其实没删」。 */
export async function removeHost(root, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return fail('STUDIO_HOST_ID_INVALID', { id: String(id ?? '') });
  const target = hostConfigPath(root, id);
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return fail('STUDIO_HOST_UNKNOWN', { id });
    return fail('STUDIO_HOST_WRITE_FAILED', { path: target });
  }
  return { ok: true, id };
}
