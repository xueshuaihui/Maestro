/** workflow/v1 -> engine graph adapter tests (wp20). */

import assert from 'node:assert/strict';
import test from 'node:test';

import { workflowToGraph, mergeProjectGraphs } from '../../src/templates/workflow-graph.js';
import { GRAPHS } from '../../src/templates/index.js';

const workflow = {
  schema: 'workflow/v1',
  id: 'custom-flow',
  name: 'Custom Flow',
  entry: 's1',
  terminal: 's2',
  nodes: [
    { id: 's1', node_type: 'role', role: 'dev', title: 'Build' },
    { id: 's2', node_type: 'role', role: 'qa', title: 'Verify' }
  ],
  edges: [{ from: 's1', to: 's2', kind: 'forward', when: 'always', join: 'all' }]
};

test('workflowToGraph maps a declarative workflow to an engine graph', () => {
  const result = workflowToGraph(workflow);
  assert.equal(result.ok, true);
  const graph = result.graph;
  assert.equal(graph.id, 'custom-flow');
  assert.equal(graph.entry, 's1');
  assert.equal(graph.terminal, 's2');
  assert.deepEqual(graph.roles, ['dev', 'qa']);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.nodes[0].nodeId, 's1');
  assert.equal(graph.nodes[0].roleId, 'dev');
  assert.equal(graph.nodes[1].wakeFrom[0], 's1');
  assert.equal(graph.edges[0].kind, 'forward');
  assert.deepEqual(graph.maxRounds, { s1: 1, s2: 1 });
});

test('workflowToGraph rejects malformed input without throwing', () => {
  assert.equal(workflowToGraph(null).ok, false);
  assert.equal(workflowToGraph({}).ok, false);
});

test('mergeProjectGraphs never overwrites a built-in graph', () => {
  const builtinSnapshot = JSON.stringify(GRAPHS);
  const merged = mergeProjectGraphs(GRAPHS, [workflow, { ...workflow, id: 'single' }]);
  assert.equal(merged['custom-flow'].id, 'custom-flow');
  assert.equal(merged.single, GRAPHS.single);
  assert.equal(JSON.stringify(GRAPHS), builtinSnapshot);
});
