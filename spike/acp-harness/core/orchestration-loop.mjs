/**
 * 编排循环（单节点最小版）—— 阶段一 I1.1「硬编码单节点任务」的探针形态。
 *
 * 本文件是 VP-1 的被测对象：**编排循环**。它只依赖 ACP 五原语包装后的 client API，
 * 不允许出现任何宿主名、transport 名、恢复方言名。切换宿主只改 hosts/*.json。
 *
 * 允许出现的适配器契约名：resumeOrCreate（方言收敛在适配器内的中性入口）。
 */
export async function runSingleNode(client, task) {
  const startedAt = Date.now();
  const capabilities = await client.initialize({ name: 'maestro-core', version: '0.1.0' });

  const session = await client.resumeOrCreate({
    sessionId: task.sessionId ?? null,
    cwd: task.cwd,
  });

  const updates = [];
  const unsubscribe = client.onUpdate((update) => updates.push(update));

  let promptResult;
  let error = null;
  try {
    promptResult = await client.prompt(session.id, task.prompt);
  } catch (err) {
    error = { code: err.code ?? -32603, message: err.message };
  } finally {
    unsubscribe();
  }

  const stopReason = promptResult?.stopReason ?? null;
  return {
    sessionId: session.id,
    restored: session.restored,
    nodeStatus: classify(stopReason, error),
    stopReason,
    error,
    updateCount: updates.length,
    updates,
    capabilities,
    elapsedMs: Date.now() - startedAt,
  };
}

/** Agent 的完成声明只是输入；状态由核心按 stopReason 裁决（对齐需求基线能力域 5） */
function classify(stopReason, error) {
  if (error) return 'failed';
  switch (stopReason) {
    case 'end_turn':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    case 'refusal':
      return 'escalated';
    case 'max_tokens':
    case 'max_turn_requests':
      return 'failed';
    default:
      return 'failed';
  }
}
