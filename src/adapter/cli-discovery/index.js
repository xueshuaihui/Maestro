/**
 * Public entry point for the CLI discovery module (v2 capability domain 0).
 */

export { discoverAgentClis } from './discover.js';
export { probeVersion, probeAcp, withProbeResults, acpArgsFor } from './probe.js';
export { KNOWN_AGENT_CLI, CLI_STATUS, SCHEMA_VERSION } from './known-agents.js';
export { CLI_REGISTRY_FILE, cliRegistryPath, isMachineRegistry, loadCliRegistry, saveCliRegistry } from './registry.js';
export { MATRIX_DIMENSIONS, buildMatrixData } from './capability-matrix.js';
