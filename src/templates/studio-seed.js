/**
 * Seed table for the built-in R&D organization (v2 A2/A3).
 *
 * Role literals are only allowed under `src/templates/**` (purity gate), so the
 * one authoritative table lives here and both the CLI (`orch org seed`) and the
 * Studio HTTP API import it. Each row is `[roleCode, labelKey, departmentId]`
 * in stage order, so a seeded org reads like the workflow it will run.
 */

export const STUDIO_SEED_ROLES = Object.freeze([
  Object.freeze(['product-lead', 'ROLE_PRODUCT_LEAD', 'product']),
  Object.freeze(['product-analyst', 'ROLE_PRODUCT_ANALYST', 'product']),
  Object.freeze(['user-researcher', 'ROLE_USER_RESEARCHER', 'product']),
  Object.freeze(['competitor-analyst', 'ROLE_COMPETITOR_ANALYST', 'product']),
  Object.freeze(['product-reviewer', 'ROLE_PRODUCT_REVIEWER', 'product']),
  Object.freeze(['eng-lead', 'ROLE_ENG_LEAD', 'engineering-management']),
  Object.freeze(['architect', 'ROLE_ARCHITECT', 'engineering-management']),
  Object.freeze(['tech-reviewer', 'ROLE_TECH_REVIEWER', 'engineering-management']),
  Object.freeze(['data-architect', 'ROLE_DATA_ARCHITECT', 'engineering-management']),
  Object.freeze(['frontend-lead', 'ROLE_FRONTEND_LEAD', 'frontend']),
  Object.freeze(['frontend-dev', 'ROLE_FRONTEND_DEV', 'frontend']),
  Object.freeze(['frontend-reviewer', 'ROLE_FRONTEND_REVIEWER', 'frontend']),
  Object.freeze(['backend-lead', 'ROLE_BACKEND_LEAD', 'backend']),
  Object.freeze(['backend-dev', 'ROLE_BACKEND_DEV', 'backend']),
  Object.freeze(['backend-reviewer', 'ROLE_BACKEND_REVIEWER', 'backend']),
  Object.freeze(['qa-lead', 'ROLE_QA_LEAD', 'qa']),
  Object.freeze(['qa-functional', 'ROLE_QA_FUNCTIONAL', 'qa']),
  Object.freeze(['qa-api', 'ROLE_QA_API', 'qa']),
  Object.freeze(['qa-automation', 'ROLE_QA_AUTOMATION', 'qa']),
  Object.freeze(['qa-performance', 'ROLE_QA_PERFORMANCE', 'qa']),
  Object.freeze(['qa-security', 'ROLE_QA_SECURITY', 'qa']),
  Object.freeze(['devops', 'ROLE_DEVOPS', 'platform-security']),
  Object.freeze(['security-reviewer', 'ROLE_SECURITY_REVIEWER', 'platform-security'])
]);

/** Seed the org (roles + one employee per role) into an in-memory document. */
export function seedOrganization(doc, { cliId, perRole = 1, addRole, addEmployee, employeesOfRole, label }) {
  let roles = 0;
  let employees = 0;
  for (const [code, labelKey, departmentId] of STUDIO_SEED_ROLES) {
    const name = typeof label === 'function' ? label(labelKey, code) : code;
    const existing = (doc.roles ?? []).find((role) => role.code === code) ?? null;
    let role = existing;
    if (!role) {
      const created = addRole(doc, { name, code, departmentId, duty: name });
      if (!created.ok) continue;
      role = created.role;
      roles += 1;
    }
    const have = employeesOfRole(doc, role.id).length;
    for (let i = have; i < perRole; i += 1) {
      const added = addEmployee(doc, { name: `${role.name} ${i + 1}`, roleId: role.id, cliId });
      if (added.ok) employees += 1;
    }
  }
  return { roles, employees };
}
