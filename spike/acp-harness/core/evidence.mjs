/**
 * 证据引用构造（VP-4）—— 纯函数，零宿主感知。
 *
 * 三要素 ↔ 字段：
 *   产物指纹： artifactRef + fingerprint
 *   审核确认： confirmedBy + confirmedAt
 *   时效依据： producedAt
 *
 * 每个字段标注来源等级：
 *   event-stream       事件流可直接得到
 *   agent-declared     Agent 自己上报（需协议/角色约定，不能自证真实性）
 *   role-convention    需角色在 final message 附机器可读清单，由适配器解析
 *   missing            完全不可得
 */
export function buildEvidence(updates) {
  const evidence = { artifactRef: null, fingerprint: null, producedAt: null, confirmedBy: null, confirmedAt: null };
  const sources = {
    artifactRef: 'missing',
    fingerprint: 'missing',
    producedAt: 'missing',
    confirmedBy: 'missing',
    confirmedAt: 'missing',
  };

  // 1) 产物指纹：取最后一次 tool_call_update 的 diff / rawOutput
  const toolCompleted = updates.filter(
    (u) => u.sessionUpdate === 'tool_call_update' && u.status === 'completed',
  );
  const last = toolCompleted.at(-1);
  if (last) {
    const diff = (last.content ?? []).find((c) => c.type === 'diff');
    if (diff?.path) {
      evidence.artifactRef = diff.path;
      sources.artifactRef = 'event-stream';
    }
    if (last.rawOutput?.path && !evidence.artifactRef) {
      evidence.artifactRef = last.rawOutput.path;
      sources.artifactRef = 'agent-declared';
    }
    if (last.rawOutput?.sha256) {
      evidence.fingerprint = `sha256:${last.rawOutput.sha256}`;
      sources.fingerprint = 'agent-declared';
    }
    if (last.receivedAt) {
      evidence.producedAt = last.receivedAt;
      sources.producedAt = 'event-stream';
    }
  }

  // 2) 审核确认：final agent message 里的机器可读清单
  const agentText = updates
    .filter((u) => u.sessionUpdate === 'agent_message_chunk')
    .map((u) => u.content?.text ?? '')
    .join('\n');
  const fenced = [...agentText.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  });
  const payload = fenced.filter(Boolean).at(-1);
  if (payload?.review?.confirmedBy) {
    evidence.confirmedBy = payload.review.confirmedBy;
    sources.confirmedBy = 'role-convention';
  }
  if (payload?.review?.confirmedAt) {
    evidence.confirmedAt = payload.review.confirmedAt;
    sources.confirmedAt = 'role-convention';
  }
  if (payload?.artifacts?.[0]?.fingerprint && !evidence.fingerprint) {
    evidence.fingerprint = payload.artifacts[0].fingerprint;
    sources.fingerprint = 'role-convention';
  }

  const missing = Object.entries(evidence)
    .filter(([, v]) => v === null || v === undefined || v === '')
    .map(([k]) => k);

  return { evidence, sources, missing };
}

/** 三要素是否齐备：artifactRef+fingerprint / confirmedBy+confirmedAt / producedAt */
export function isEvidenceComplete({ missing }) {
  return missing.length === 0;
}
