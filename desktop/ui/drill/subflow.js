/**
 * Sub-workflow level renderer (I1.10b WP-3, contract D9).
 *
 * One call projects one level. The caller owns the level stack and passes the
 * levels already traversed back in `options.levels`; this module only reads
 * them, pushes the current reference onto a local copy for cycle detection and
 * can pop one level for a single-step return. Layout comes from the existing
 * pure graph layout module; nothing is recomputed here.
 */

import { computeLayout } from '../graph/layout.js';
import { fillTemplate, resolveLabels } from '../labels/labels.js';

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

function rootCrumb(resolver, id, missing) {
  const text = resolver.get('DRILL_CRUMB_ROLE');
  if (text === null) {
    if (!missing.includes('DRILL_CRUMB_ROLE')) missing.push('DRILL_CRUMB_ROLE');
    return resolver.get(PLACEHOLDER_KEY) ?? '';
  }
  const at = text.indexOf(' / ');
  return fillTemplate(at === -1 ? text : text.slice(0, at), { id: id ?? '' });
}

function titleOf(def, placeholder) {
  return typeof def?.title === 'string' && def.title.length > 0 ? def.title : placeholder;
}

export function buildSubflow(input, labels, options = {}) {
  const source = input !== null && typeof input === 'object' ? input : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const placeholder = resolver.get(PLACEHOLDER_KEY) ?? '';
  const ref = typeof source.ref === 'string' ? source.ref : '';
  const defs = source.workflowDef !== null && typeof source.workflowDef === 'object'
    ? source.workflowDef
    : {};
  const def = Object.prototype.hasOwnProperty.call(defs, ref) ? defs[ref] : null;

  const levels = Array.isArray(options.levels) ? options.levels.slice() : [];
  const stack = [];
  for (const level of levels) {
    const levelRef = level && typeof level === 'object' ? level.ref : level;
    if (typeof levelRef === 'string' && levelRef.length > 0) stack.push(levelRef);
  }
  const cycle = stack.includes(ref);
  if (!cycle) stack.push(ref);

  const crumbRoot = rootCrumb(resolver, source.instanceId ?? placeholder, missingLabels);
  const breadcrumb = [crumbRoot];
  const crumbLevels = levels.length > 0 ? levels.slice(1) : [];
  for (const level of crumbLevels) {
    const levelRef = level && typeof level === 'object' ? level.ref : level;
    const levelTitle = level && typeof level === 'object' && level.title !== undefined
      ? level.title
      : levelRef;
    breadcrumb.push(take(resolver, 'DRILL_CRUMB_SUBFLOW', { title: levelTitle ?? '' }, missingLabels));
  }

  const legend = [
    take(resolver, 'DESKTOP_LEGEND_ROLE', {}, missingLabels),
    take(resolver, 'DESKTOP_LEGEND_SPECIAL', {}, missingLabels),
  ];

  const degraded = { kind: null, text: null };

  if (cycle) {
    degraded.kind = 'cycle';
    degraded.text = take(resolver, 'DRILL_SUBFLOW_CYCLE', {}, missingLabels);
  } else if (def === null || def === undefined) {
    degraded.kind = 'missing';
    degraded.text = take(resolver, 'DESKTOP_SUBFLOW_UNKNOWN', { id: ref }, missingLabels);
  }

  const sourceNodes = degraded.kind === null && Array.isArray(def?.nodes)
    ? def.nodes
    : [];
  const sourceEdges = degraded.kind === null && Array.isArray(def?.edges)
    ? def.edges
    : [];

  const nodes = [];
  const edges = [];
  for (const item of sourceNodes) {
    if (item === null || typeof item !== 'object') continue;
    const id = item.id ?? item.nodeId;
    if (typeof id !== 'string' || id.length === 0) continue;
    nodes.push({
      nodeId: id,
      title: typeof item.title === 'string' && item.title.length > 0 ? item.title : null,
      type: item.node_type ?? item.nodeType ?? 'role',
      roleId: item.role ?? item.roleId ?? null,
      status: item.status ?? 'pending',
      round: item.round ?? null,
    });
  }
  for (const item of sourceEdges) {
    if (item === null || typeof item !== 'object') continue;
    const from = item.from;
    const to = item.to;
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    edges.push({
      id: item.id ?? `SE-${edges.length + 1}`,
      from,
      to,
      direction: item.kind === 'backflow' ? 'backflow' : 'forward',
    });
  }

  if (degraded.kind === null && nodes.length === 0) {
    degraded.kind = 'empty';
    degraded.text = take(resolver, 'DRILL_EMPTY_ROLE', {}, missingLabels);
  }

  const layoutInput = {
    nodes: nodes.map((node) => ({ id: node.nodeId, title: node.title, type: node.type })),
    edges: edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, direction: edge.direction })),
  };
  const layout = computeLayout(layoutInput);
  const positioned = nodes.map((node) => {
    const hit = layout.nodes.find((entry) => entry.id === node.nodeId) ?? null;
    return {
      ...node,
      x: hit?.x ?? 0,
      y: hit?.y ?? 0,
      layer: hit?.layer ?? 0,
      z: hit?.z ?? 0,
    };
  });

  const title = degraded.kind === null ? titleOf(def, placeholder) : placeholder;
  const current = { ref, title };
  const nextLevels = cycle ? levels.slice() : [...levels, current];
  const depth = nextLevels.length;
  if (depth > 1) {
    breadcrumb.push(take(resolver, 'DRILL_CRUMB_SUBFLOW', { title }, missingLabels));
  }

  return {
    ref,
    nodes: positioned,
    edges: edges.map((edge) => {
      const hit = layout.edges.find((entry) => entry.id === edge.id) ?? null;
      return { ...edge, path: hit?.path ?? { kind: 'straight' }, z: hit?.z ?? 0 };
    }),
    breadcrumb,
    legend,
    degraded: degraded.kind === null ? null : degraded,
    workflow: {
      ref,
      readable: degraded.kind === null,
      title: degraded.kind === null ? title : null,
    },
    depth,
    returnCount: levels.length,
    levels: nextLevels,
    back() {
      if (stack.length === 0) return this;
      const popped = stack.pop();
      const target = levels[levels.length - 1];
      const targetRef = target !== null && typeof target === 'object' ? target.ref : target;
      return buildSubflow(
        { ...source, ref: targetRef ?? popped },
        labels,
        { ...options, levels: levels.slice(0, -1) },
      );
    },
    missingLabels,
  };
}

export default buildSubflow;
