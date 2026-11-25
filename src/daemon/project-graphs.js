/**
 * Collect project workflows into the injected graph table.
 *
 * Sources (in priority order, project wins over built-in but never replaces a
 * built-in id):
 *   1. `.orch/workflows/*.yaml`  - CLI/asset authored workflow definitions.
 *   2. `.orch/studio.json` flows - compiled through the existing compileStudio.
 *
 * The built-in GRAPHS object is never mutated, so the frozen default graph
 * output (I1.1 red line) stays byte-identical.
 */

import path from 'node:path';

import { loadWorkflows } from '../registry/workflows.js';
import { loadRegistry } from '../registry/index.js';
import { loadStudio } from '../studio/store.js';
import { compileStudio } from '../studio/compile.js';
import { GRAPHS } from '../templates/index.js';
import { TEMPLATE_LABEL } from '../cli/labels.js';
import { mergeProjectGraphs } from '../templates/workflow-graph.js';

/**
 * @param {string} root project root
 * @returns {Promise<{ok:true, graphs:object, ids:string[], errors:Array}>}
 */
export async function loadProjectGraphs(root) {
  const base = typeof root === 'string' && root.length > 0 ? path.resolve(root) : process.cwd();
  const errors = [];
  const registry = loadRegistry({ root: base });
  const roles = registry.ok ? registry.roles : [];

  const assetLoad = loadWorkflows({
    root: base,
    builtinGraphs: GRAPHS,
    roles,
    builtinNames: TEMPLATE_LABEL
  });
  errors.push(...(assetLoad.errors ?? []));
  const workflows = [...(assetLoad.workflows ?? [])];

  // Studio flows need a team to resolve role codes. Any team that references
  // the flow is enough; compileStudio only needs doc/team/flow to map codes.
  const studio = await loadStudio(base);
  if (studio.ok) {
    const doc = studio.doc;
    for (const flow of doc.flows ?? []) {
      const teams = (doc.teams ?? []).filter((team) => team.flowId === flow.id);
      const team = teams[0] ?? {
        id: `flow-${flow.id}`,
        roleIds: (doc.roles ?? []).map((role) => role.id)
      };
      const compiled = compileStudio({ doc, team, flow });
      if (!compiled.ok) {
        errors.push({ code: compiled.code, file: `studio/flows/${flow.id}`, params: compiled.params ?? {} });
        continue;
      }
      if (!workflows.some((item) => item?.id === compiled.workflow.id)) {
        workflows.push(compiled.workflow);
      }
    }
  }

  const graphs = mergeProjectGraphs(GRAPHS, workflows);
  const builtinIds = new Set(Object.keys(GRAPHS));
  const ids = Object.keys(graphs).filter((id) => !builtinIds.has(id));
  return { ok: true, graphs, ids, errors };
}
