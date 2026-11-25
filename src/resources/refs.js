/**
 * Reference integrity for unified resources.
 *
 * Answers two questions before a delete: what does this resource depend on,
 * and who depends on it. Returns stable `{type,id,field}` descriptors so the
 * UI can render a precise warning instead of a generic "in use".
 *
 * Pure over the studio document; no natural-language copy (CJK-free).
 */

import { findById } from '../studio/store.js';
import { studioField } from './types.js';

function descriptor(type, id, field) {
  return { type, id, field };
}

/** Incoming references: resources that point at this one. */
export function refsInDoc(doc, type, id) {
  const incoming = [];
  if (type === 'role') {
    for (const emp of doc.employees ?? []) {
      if (emp.roleId === id) incoming.push(descriptor('employee', emp.id, 'roleId'));
    }
    for (const team of doc.teams ?? []) {
      if ((team.roleIds ?? []).includes(id)) incoming.push(descriptor('team', team.id, 'roleIds'));
    }
    for (const flow of doc.flows ?? []) {
      for (const stage of flow.stages ?? []) {
        if ((stage.roleCodes ?? []).includes(id)) incoming.push(descriptor('flow', flow.id, `stages.${stage.id}.roleCodes`));
      }
    }
  }
  if (type === 'department') {
    for (const role of doc.roles ?? []) {
      if (role.departmentId === id) incoming.push(descriptor('role', role.id, 'departmentId'));
    }
  }
  if (type === 'team') {
    for (const run of doc.runs ?? []) {
      if (run.teamId === id) incoming.push(descriptor('run', run.id, 'teamId'));
    }
  }
  if (type === 'flow') {
    for (const team of doc.teams ?? []) {
      if (team.flowId === id) incoming.push(descriptor('team', team.id, 'flowId'));
    }
    for (const run of doc.runs ?? []) {
      if (run.flowId === id) incoming.push(descriptor('run', run.id, 'flowId'));
    }
  }
  if (type === 'employee') {
    for (const session of doc.sessions ?? []) {
      if (session.employeeId === id) incoming.push(descriptor('run', session.id, 'employeeId'));
    }
  }
  return incoming;
}

/** Outgoing references: resources this one points at. */
export function outgoingInDoc(doc, type, id) {
  const outgoing = [];
  const field = studioField(type);
  const row = field ? findById(doc[field], id) : null;
  if (row === null) return outgoing;
  if (type === 'role') {
    if (row.departmentId) outgoing.push(descriptor('department', row.departmentId, 'departmentId'));
    for (const skill of row.skills ?? []) outgoing.push(descriptor('skill', skill, 'skills'));
  }
  if (type === 'employee') {
    if (row.roleId) outgoing.push(descriptor('role', row.roleId, 'roleId'));
  }
  if (type === 'team') {
    for (const role of row.roleIds ?? []) outgoing.push(descriptor('role', role, 'roleIds'));
    if (row.flowId) outgoing.push(descriptor('flow', row.flowId, 'flowId'));
  }
  if (type === 'flow') {
    for (const stage of row.stages ?? []) {
      for (const code of stage.roleCodes ?? []) outgoing.push(descriptor('role', code, `stages.${stage.id}.roleCodes`));
    }
  }
  return outgoing;
}

/** Async facade used by removeResource; loads the studio document once. */
export async function collectRefs(root, type, id) {
  const { loadStudio } = await import('../studio/store.js');
  const loaded = await loadStudio(root);
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    incoming: refsInDoc(loaded.doc, type, id),
    outgoing: outgoingInDoc(loaded.doc, type, id)
  };
}

/** Remove dangling references after a forced delete. */
export async function detachRefs(root, type, id) {
  const { updateStudio } = await import('../studio/store.js');
  return updateStudio(root, (doc) => {
    if (type === 'role') {
      doc.employees = (doc.employees ?? []).filter((emp) => emp.roleId !== id);
      for (const team of doc.teams ?? []) {
        team.roleIds = (team.roleIds ?? []).filter((role) => role !== id);
      }
      for (const flow of doc.flows ?? []) {
        for (const stage of flow.stages ?? []) {
          stage.roleCodes = (stage.roleCodes ?? []).filter((code) => code !== id);
        }
      }
    }
    if (type === 'department') {
      for (const role of doc.roles ?? []) {
        if (role.departmentId === id) role.departmentId = 'product';
      }
    }
    if (type === 'flow') {
      for (const team of doc.teams ?? []) {
        if (team.flowId === id) team.flowId = null;
      }
    }
    return { ok: true };
  });
}
