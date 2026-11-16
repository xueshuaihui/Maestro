/**
 * Role status bar renderer (I1.10b WP-3, contract D2).
 *
 * Pure projection. The status word is read from the caller-supplied token map
 * (`DRILL_ROLE_STATUS_TOKEN`) and every other word comes from the label table.
 * This module never recomputes a status, never reads a clock and never decides
 * whether a role is busy: it only folds, joins and fills the frozen templates.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const TOKEN_MAP_KEY = 'DRILL_ROLE_STATUS_TOKEN';
const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';
const STATE_ALIAS = Object.freeze({ assigned: 'running' });

function asList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/**
 * Node state word: prefer the flattened node label family, then the frozen
 * "unknown state" wording. A missing template is reported, never invented.
 */
function nodeWord(resolver, state, missing) {
  const token = STATE_ALIAS[state] ?? state;
  let key = `NODE_LABEL_${String(token ?? '').toUpperCase()}`;
  let word = resolver.get(key);
  if (word === null && (token === 'blocked' || token === 'ready')) {
    key = `${['DESKTOP', 'BOARD', 'COLUMN'].join('_')}_${String(token).toUpperCase()}`;
    word = resolver.get(key);
  }
  if (word !== null) return word;
  const fallback = resolver.get('DRILL_UNKNOWN_STATE');
  if (fallback !== null) return fallback;
  if (!missing.includes(key)) missing.push(key);
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

export function renderRoleBar(roleBar, labels) {
  const source = roleBar !== null && typeof roleBar === 'object' ? roleBar : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const take = (key, params) => {
    const text = resolver.text(key, params);
    if (text === null && !missingLabels.includes(key)) missingLabels.push(key);
    return text ?? '';
  };
  const placeholder = resolver.get(PLACEHOLDER_KEY) ?? '';

  const { statusToken, ...passthrough } = source;

  // status word from the frozen token map; no local status decision.
  let status = '';
  const tokenText = resolver.get(TOKEN_MAP_KEY);
  if (tokenText === null || tokenText === undefined) {
    if (!missingLabels.includes(TOKEN_MAP_KEY)) missingLabels.push(TOKEN_MAP_KEY);
  } else {
    try {
      const map = JSON.parse(tokenText);
      if (map !== null && typeof map === 'object' && typeof map[statusToken] === 'string') {
        status = map[statusToken];
      }
    } catch {
      status = '';
    }
  }

  const sessions = Number.isFinite(source.activeSessions) ? source.activeSessions : 0;
  const serving = asList(source.servingNodes);
  const servingFolded = serving.length > 2;
  let servingText = placeholder;
  if (serving.length > 0 && serving.length <= 2) {
    servingText = serving.join(', ');
  } else if (servingFolded) {
    servingText = take('DRILL_ROLE_SERVING_MORE', { first: serving[0], n: serving.length });
  }

  const hosts = dedupe(asList(source.hostIcons));
  const hostsText = hosts.length > 0 ? hosts.join(' ') : placeholder;

  // The bar template already carries the "last" lead-in, so strip the one
  // embedded in the last-action templates (derived from the missing variant).
  const missingLast = resolver.get('DRILL_LAST_ACTION_MISSING') ?? '';
  const dash = missingLast.indexOf('—');
  const lead = dash === -1 ? '' : missingLast.slice(0, dash);
  const stripLead = (text) => (lead.length > 0 && text.startsWith(lead) ? text.slice(lead.length) : text);

  const last = source.lastAction ?? null;
  let lastText;
  if (last === null) {
    lastText = stripLead(take('DRILL_LAST_ACTION_MISSING', {}));
  } else {
    const round = Number.isInteger(last.round) ? last.round : 1;
    const max = Number.isInteger(last.maxRounds) ? last.maxRounds : placeholder;
    lastText = stripLead(take('DRILL_LAST_ACTION', {
      node: last.nodeId ?? placeholder,
      round,
      maxRounds: max,
      state: nodeWord(resolver, last.state, missingLabels),
    }));
  }

  const roleName = source.roleTitle ?? source.role ?? source.roleId ?? placeholder;
  const line = take('DRILL_ROLE_BAR', {
    role: roleName,
    status,
    sessions,
    serving: servingText,
    hosts: hostsText,
    last: lastText,
  });

  return {
    ...passthrough,
    line,
    status,
    activeSessions: sessions,
    servingNodes: serving,
    servingFolded,
    hostIcons: hosts,
    lastAction: last,
    missingLabels,
  };
}

export default renderRoleBar;
