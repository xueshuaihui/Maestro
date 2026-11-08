/**
 * Role contract checks over in-memory registry objects (split doc 2.2, WP-2).
 *
 * Covers C-08 steps 8..11 only; steps 1..7 (required keys, id/file name, group,
 * artifact_type, side_effect, max_concurrent_sessions, skill references) stay in
 * `role-schema.js` / `index.js` and are not repeated here. The seven reason codes
 * are verbatim from A-15:
 *
 *   ROLE_TOOL_UNKNOWN / ROLE_PERMISSION_MISMATCH  (step 8: tool values + closure)
 *   ROLE_WAKE_UNKNOWN / ROLE_WAKE_SELF            (step 9: wake whitelist)
 *   ROLE_DERIVE_MISSING / ROLE_DERIVE_CYCLE       (step 10: derive chain)
 *   ROLE_CONTRACT_UNBOUND                         (step 11: field-level binding)
 *
 * Pure function: no IO, no CJK, no concrete asset id. Each issue matches the
 * loader's 6-key error shape (`makeError` in `index.js`) so the CLI layer can
 * merge both lists unchanged; `line` is always `null` here because no file is
 * parsed at this layer. The Chinese detail sentences live in
 * `src/cli/labels.js` (`ROLE_REASON_TEXT` / `ROLE_PERMISSION_TEXT`); this module
 * only selects the sentence via the English `params.reason` key and fills the
 * `{tool}` slot via `params.tool`.
 *
 * Input shape: role objects carry snake_case asset keys (`side_effect`,
 * `wake_allow`, `derived_from`, `inputs`, `outputs`, ...). As a wiring fallback
 * the camelCase aliases used by `loadRegistry` definitions (`sideEffect`,
 * `wakeAllow`, `derivedFrom`) are also read; callers that need contract checks
 * against `inputs` / `outputs` must pass those keys through, since the loader
 * definitions do not carry them.
 */

const TOOL_VALUES = Object.freeze(['read', 'write', 'edit', 'bash']);
const WRITE_TOOLS = Object.freeze(['write', 'edit']);

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** First present key among the aliases (snake_case asset key wins). */
function pick(obj, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function strArray(value) {
  return isStringArray(value) ? value.slice() : [];
}

function makeIssue(code, file, field, params) {
  return { code, file, scope: 'role', field, line: null, params };
}

/**
 * Accept an array, a `Map` or a plain object keyed by workflow id, so the caller
 * may pass either the `loadWorkflows` collection or its `workflowMap`.
 */
function normalizeWorkflows(workflows) {
  if (Array.isArray(workflows)) return workflows;
  if (workflows instanceof Map) return [...workflows.values()];
  if (workflows && typeof workflows === 'object') return Object.values(workflows);
  return [];
}

function flowIndex(workflows) {
  const flows = [];
  for (const workflow of normalizeWorkflows(workflows)) {
    const source = workflow && typeof workflow === 'object' ? workflow : {};
    const nodes = Array.isArray(source.nodes) ? source.nodes : [];
    const edges = Array.isArray(source.edges) ? source.edges : [];
    const byId = new Map();
    for (const node of nodes) {
      if (node && typeof node === 'object' && typeof node.id === 'string') byId.set(node.id, node);
    }
    flows.push({ nodes, edges, byId });
  }
  return flows;
}

/** C-08 step 8: tool values first, then the three fixed closure sentences. */
function checkToolsAndPermissions(role, file, out) {
  const tools = strArray(pick(role, 'tools'));
  for (const tool of tools) {
    if (!TOOL_VALUES.includes(tool)) {
      out.push(makeIssue('ROLE_TOOL_UNKNOWN', file, 'tools', { value: tool }));
      break;
    }
  }
  const validTools = tools.filter((tool) => TOOL_VALUES.includes(tool));
  const sideEffect = pick(role, 'side_effect', 'sideEffect');
  if (sideEffect === 'read') {
    const writeTool = tools.find((tool) => WRITE_TOOLS.includes(tool));
    if (writeTool !== undefined) {
      out.push(
        makeIssue('ROLE_PERMISSION_MISMATCH', file, 'tools', {
          tool: writeTool,
          reason: 'readWithWriteTool'
        })
      );
    }
  } else if (sideEffect === 'exec') {
    if (!validTools.includes('bash')) {
      out.push(
        makeIssue('ROLE_PERMISSION_MISMATCH', file, 'tools', {
          tool: 'bash',
          reason: 'execNeedsCommandTool'
        })
      );
    }
  } else if (sideEffect === 'none') {
    if (tools.length > 0) {
      out.push(
        makeIssue('ROLE_PERMISSION_MISMATCH', file, 'tools', {
          tool: tools[0],
          reason: 'noneWithAnyTool'
        })
      );
    }
  }
}

/** C-08 step 9: every wake entry must exist and must not be the role itself. */
function checkWake(role, file, idSet, out) {
  const self = pick(role, 'id');
  const wakeAllow = strArray(pick(role, 'wake_allow', 'wakeAllow'));
  for (const entry of wakeAllow) {
    if (entry === self) {
      out.push(makeIssue('ROLE_WAKE_SELF', file, 'wake_allow', { role: entry }));
    } else if (!idSet.has(entry)) {
      out.push(makeIssue('ROLE_WAKE_UNKNOWN', file, 'wake_allow', { role: entry }));
    }
  }
}

/**
 * C-08 step 10: the derive target must exist, and the chain must be acyclic.
 * Only roles sitting on the cycle report `ROLE_DERIVE_CYCLE` (BR-06: one issue
 * per file on the cycle), each with the closed chain rotated to start at itself.
 */
function checkDerive(role, file, byId, out) {
  const from = pick(role, 'derived_from', 'derivedFrom');
  if (typeof from !== 'string' || from === '') return;
  if (!byId.has(from)) {
    out.push(makeIssue('ROLE_DERIVE_MISSING', file, 'derived_from', { role: from }));
    return;
  }
  const path = [pick(role, 'id')];
  let current = from;
  while (typeof current === 'string' && byId.has(current) && !path.includes(current)) {
    path.push(current);
    current = pick(byId.get(current), 'derived_from', 'derivedFrom');
  }
  if (typeof current === 'string' && path.includes(current) && path[0] === current) {
    const chain = path.slice();
    chain.push(current);
    out.push(makeIssue('ROLE_DERIVE_CYCLE', file, 'derived_from', { chain }));
  }
}

/** A binding edge enters a node declared by this role. */
function entersRole(flow, edge, roleId) {
  const target = flow.byId.get(edge.to);
  return target !== undefined && target.role === roleId;
}

/** A binding edge leaves a node declared by this role. */
function leavesRole(flow, edge, roleId) {
  const source = flow.byId.get(edge.from);
  return source !== undefined && source.role === roleId;
}

/**
 * BR-13 field by field: an input is bound when some edge into this role maps to
 * the field or its upstream node declares the same output; an output is bound
 * when some edge out of this role maps `<node>.<field>` or its downstream node
 * declares the same input. Only roles referenced by at least one workflow node
 * are checked. Same code per file reports once: inputs first, then outputs.
 */
function checkContracts(role, file, flows, out) {
  const roleId = pick(role, 'id');
  const referenced = flows.some((flow) => flow.nodes.some((node) => node && node.role === roleId));
  if (!referenced) return;
  for (const field of strArray(pick(role, 'inputs'))) {
    const bound = flows.some((flow) =>
      flow.edges.some((edge) => {
        if (!edge || typeof edge !== 'object' || !entersRole(flow, edge, roleId)) return false;
        if (edge.map && edge.map.to === field) return true;
        const upstream = flow.byId.get(edge.from);
        return upstream !== undefined && Array.isArray(upstream.outputs)
          ? upstream.outputs.includes(field)
          : false;
      })
    );
    if (!bound) {
      out.push(makeIssue('ROLE_CONTRACT_UNBOUND', file, 'inputs', { field, side: 'source' }));
      return;
    }
  }
  for (const field of strArray(pick(role, 'outputs'))) {
    const bound = flows.some((flow) =>
      flow.edges.some((edge) => {
        if (!edge || typeof edge !== 'object' || !leavesRole(flow, edge, roleId)) return false;
        if (edge.map && edge.map.from === `${edge.from}.${field}`) return true;
        const downstream = flow.byId.get(edge.to);
        return downstream !== undefined && Array.isArray(downstream.inputs)
          ? downstream.inputs.includes(field)
          : false;
      })
    );
    if (!bound) {
      out.push(makeIssue('ROLE_CONTRACT_UNBOUND', file, 'outputs', { field, side: 'destination' }));
      return;
    }
  }
}

/**
 * @param {{roles?:Array, workflows?:Array|Map|object}} [input]
 * @returns {Array<{code:string, file:string, scope:'role', field:string, line:null, params:object}>}
 *          ordered by file (stable), C-08 8..11 order inside one file, and the
 *          same reason code reported only once per file.
 */
export function checkRoleContracts({ roles, workflows } = {}) {
  const list = Array.isArray(roles) ? roles : [];
  const byId = new Map();
  for (const role of list) {
    if (!role || typeof role !== 'object') continue;
    const id = pick(role, 'id');
    if (typeof id === 'string' && id !== '') byId.set(id, role);
  }
  const idSet = new Set(byId.keys());
  const flows = flowIndex(workflows);

  const issues = [];
  for (const role of list) {
    if (!role || typeof role !== 'object') continue;
    const id = pick(role, 'id');
    const file = typeof role.file === 'string' ? role.file : typeof id === 'string' ? id : '';
    checkToolsAndPermissions(role, file, issues); // C-08 8
    checkWake(role, file, idSet, issues); // C-08 9
    if (typeof id === 'string') {
      checkDerive(role, file, byId, issues); // C-08 10
      checkContracts(role, file, flows, issues); // C-08 11
    }
  }

  issues.sort((a, b) => compareText(a.file, b.file));
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.file}\u0000${issue.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
