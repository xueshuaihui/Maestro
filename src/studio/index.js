/**
 * Studio public surface (v2 A2~A6 + B bridge + D multi-project).
 *
 * The CLI and the desktop HTTP routes consume this barrel only; none of them
 * reach into individual modules, so the store layout stays swappable.
 */

export {
  STUDIO_SCHEMA_VERSION,
  STUDIO_FILE,
  DEPARTMENT_SEEDS,
  ROLE_CODES,
  RUN_MODES,
  GATE_KINDS,
  TASK_STATUS,
  TASK_EXCEPTIONS,
  CAPABILITY_DIMENSIONS,
  emptyStudio,
  departmentLabelKey,
  stageLabelKey,
  artifactLabelKey,
  slugify,
  isId
} from './schema.js';

export { studioPath, loadStudio, saveStudio, updateStudio, findById, indexBy } from './store.js';

export {
  addRole,
  updateRole,
  removeRole,
  addEmployee,
  updateEmployee,
  removeEmployee,
  openSession,
  closeSession,
  employeesOfRole,
  resolveRole,
  checkOrganization
} from './org.js';

export { createTeam, updateTeam, removeTeam, checkTeam, teamMembers, exportTeam, resolveTeam } from './team.js';

export {
  buildRd12,
  createFlow,
  updateFlow,
  addStage,
  updateStage,
  removeStage,
  addFlowEdge,
  removeFlowEdge,
  validateFlow,
  topoOrder,
  flowRoleCodes,
  roleCoverage,
  resolveStageRole,
  removeFlow
} from './flow.js';

export { compileStudio, roleDocFromRole } from './compile.js';

export { planRun, startRun, advanceRun, approveRun, prepareEngine, engineRun } from './run.js';

export {
  addTask,
  transitionTask,
  recordException,
  addDefect,
  resolveDefect,
  raiseRequirementGap,
  reviewChange,
  canTransition
} from './tasks.js';

export {
  projectsFile,
  loadProjects,
  addProject,
  listProjects,
  useProject,
  removeProject,
  hostMatrix
} from './projects.js';
