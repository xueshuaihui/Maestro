/**
 * Capability matrix data projection (A1 / WP-3).
 *
 * Single source of truth: the registry `clis` array passed in by the caller.
 * Each row projects the finding fields verbatim (bool / string / number / null).
 * A null stays null so the CLI layer can render it as not probed; no Chinese,
 * no invented defaults, no disk write and no second data source here.
 *
 * Five frozen dimensions are fixed by the baseline (docs/index.md sections
 * 2.2 and 5); removing or merging any of them breaks AC-09.
 */

export const MATRIX_DIMENSIONS = Object.freeze([
  'acp',
  'transport',
  'resume_dialect',
  'max_concurrent_sessions',
  'evidence_hook'
]);

/** Pure projection: clis (registry array, read-only) -> { dimensions, rows }. */
export function buildMatrixData(clis) {
  const rows = (Array.isArray(clis) ? clis : []).map((cli) => ({
    cli_id: cli?.cli_id,
    name: cli?.name,
    acp: cli?.acp,
    transport: cli?.transport,
    resume_dialect: cli?.resume_dialect,
    max_concurrent_sessions: cli?.max_concurrent_sessions,
    evidence_hook: cli?.evidence_hook
  }));
  return { dimensions: MATRIX_DIMENSIONS, rows };
}
