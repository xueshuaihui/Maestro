// 会话适配器工厂：把「宿主配置 → 进程传输 → ACP 客户端 → 会话」这条胶水补齐。
//
// 装配顺序（与 orchestrator 已有消费方式一致）：
//   1. loadHostConfig({root,hostId,env}) —— 读 <root>/.orch/hosts/<hostId>.json，
//      这就是验收时把宿主指向 mock agent 的入口（launch.command/args 覆盖）。
//   2. createStdioTransport({...}) → spawn()
//   3. createAcpClient({transport,limits}) → initialize() → newSession({cwd})
//   4. createNormalizer() / createHandoffTracker()
//
// 会话在 create() 内**立即建立**；返回的 adapter 仍暴露 initialize/newSession
// （幂等缓存），因此 orchestrator 现有的 create → initialize → newSession 调用序列
// 无需改动即可复用同一个会话。
//
// 失败一律返回 {ok:false, code, params:{cause}}，不抛裸异常。

import { createAcpClient } from './acp-client.js';
import { createHandoffTracker } from './handoff-tracker.js';
import { loadHostConfig } from './host-config.js';
import { createNormalizer } from './session-state.js';
import { createStdioTransport } from './stdio-transport.js';

const DEFAULT_HANDOFF_ID = 'HO-001';

function failure(code, cause, extra = {}) {
  const message = typeof cause === 'string' && cause.length > 0 ? cause : '会话装配失败';
  return {
    ok: false,
    code: code ?? 'DSH_SPAWN_FAILED',
    params: { cause: message, ...extra },
    // orchestrator 会把 created.error 抛出；这里给它一个可读的 message。
    error: { code: code ?? 'DSH_SPAWN_FAILED', message },
  };
}

/**
 * @param {{
 *   root: string,
 *   hostId?: string,
 *   env?: Record<string, string|undefined>,
 *   clock?: () => number,
 * }} options
 */
export function createAdapterFactory({ root, hostId = 'dsh', env = process.env, clock = () => Date.now() } = {}) {
  return {
    /**
     * @param {{hostId?: string, cwd?: string}} args
     * @returns {Promise<{ok:true, adapter:object} | {ok:false, code:string, params:{cause:string}}>}
     */
    async create({ hostId: requestedHostId, cwd } = {}) {
      const id = typeof requestedHostId === 'string' && requestedHostId.length > 0 ? requestedHostId : hostId;

      if (typeof cwd !== 'string' || cwd.length === 0) {
        return failure('DSH_SPAWN_FAILED', 'create 需要绝对路径 cwd');
      }

      const cfg = await loadHostConfig({ root, hostId: id, env });
      if (!cfg || cfg.ok !== true) {
        const cause = cfg?.params?.cause ?? cfg?.message ?? `宿主配置不可用（hostId=${id}）`;
        // 统一归类为 DSH_SPAWN_FAILED（配置层细节放 causeCode），不向调用方抛裸异常。
        return failure('DSH_SPAWN_FAILED', cause, { hostId: id, causeCode: cfg?.code ?? null });
      }

      let transport;
      try {
        transport = createStdioTransport({
          command: cfg.launch.command,
          args: cfg.launch.args,
          env: cfg.launch.env,
          cwd,
        });
      } catch (err) {
        return failure('DSH_SPAWN_FAILED', err?.message ?? String(err), { hostId: id });
      }

      let client = null;
      try {
        const spawned = await transport.spawn();
        if (!spawned || spawned.ok !== true) {
          return failure(spawned?.code ?? 'DSH_SPAWN_FAILED', spawned?.params?.cause ?? '进程拉起失败', {
            hostId: id,
            bin: cfg.launch.bin ?? null,
          });
        }

        client = createAcpClient({ transport, limits: cfg.limits, clock });

        const initialized = await client.initialize();
        if (!initialized || initialized.ok !== true) {
          await safeDispose(client);
          return failure(
            initialized?.error?.code ?? 'DSH_SPAWN_FAILED',
            initialized?.error?.message ?? 'initialize 失败',
            { hostId: id, stage: 'initialize' },
          );
        }

        const session = await client.newSession({ cwd, mcpServers: [] });
        if (!session || session.ok !== true) {
          await safeDispose(client);
          return failure(
            session?.error?.code ?? 'DSH_SPAWN_FAILED',
            session?.error?.message ?? 'session/new 失败',
            { hostId: id, stage: 'session/new' },
          );
        }

        return { ok: true, adapter: buildAdapter({ client, transport, cfg, cwd, session, initialized, clock }) };
      } catch (err) {
        await safeDispose(client);
        try {
          await transport.dispose();
        } catch {
          // 清理失败不改变错误分类
        }
        return failure('DSH_SPAWN_FAILED', err?.message ?? String(err), { hostId: id });
      }
    },
  };
}

function buildAdapter({ client, transport, cfg, cwd, session, initialized, clock }) {
  const normalizer = createNormalizer({ clock });
  const tracker = createHandoffTracker({ handoffId: DEFAULT_HANDOFF_ID, startedAt: clock(), clock });

  let initResult = initialized;
  let createdSession = { cwd, response: session };

  function initOk() {
    if (!initResult) initResult = client.initialize();
    return initResult;
  }

  function newSession(params = {}) {
    const target = typeof params.cwd === 'string' && params.cwd.length > 0 ? params.cwd : cwd;
    if (createdSession && createdSession.cwd === target) {
      return Promise.resolve(createdSession.response);
    }
    return client.newSession({ ...params, cwd: target }).then((res) => {
      if (res && res.ok === true) createdSession = { cwd: target, response: res };
      return res;
    });
  }

  return {
    hostId: cfg.id,
    cwd,
    launch: cfg.launch,
    config: { transport: cfg.transport, source: cfg.source, configPath: cfg.configPath },
    client,
    transport,
    normalizer,
    tracker,
    initialize: initOk,
    newSession,
    prompt: (sessionId, blocks) => client.prompt(sessionId, blocks),
    cancel: (sessionId) => client.cancel(sessionId),
    closeSession: (sessionId) => client.closeSession(sessionId),
    listSessions: () => client.listSessions(),
    onUpdate: (cb) => client.onUpdate(cb),
    onPermission: (cb) => client.onPermission(cb),
    quietWindow: (opts) => client.quietWindow(opts),
    get sessionId() {
      return createdSession?.response?.result?.sessionId ?? null;
    },
    stats: () => client.stats(),
    dispose: () => client.dispose(),
  };
}

async function safeDispose(client) {
  if (!client) return;
  try {
    await client.dispose();
  } catch {
    // dispose 失败不影响错误分类
  }
}
