/**
 * Path helpers for the role / skill asset tree (split doc 2.4).
 *
 * These functions only join paths. They never touch the file system: existence
 * checks belong to `index.js` (a missing built-in root is an error, a missing
 * project directory simply means "no project assets"), and the loader must stay
 * read-only (requirement C-03 / AC-44).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

let repositoryRoot = null;

function repoRoot() {
  if (repositoryRoot === null) {
    repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  }
  return repositoryRoot;
}

/** Absolute path of the built-in asset root (`<repo>/assets`). */
export function assetsRoot() {
  return path.join(repoRoot(), 'assets');
}

/** Absolute path of the built-in role directory (`<repo>/assets/roles`). */
export function builtinRolesDir() {
  return path.join(assetsRoot(), 'roles');
}

/** Absolute path of the built-in skill directory (`<repo>/assets/skills`). */
export function builtinSkillsDir() {
  return path.join(assetsRoot(), 'skills');
}

/** Absolute path of a project role directory (`<root>/.orch/roles`). */
export function projectRolesDir(root) {
  return path.join(root, '.orch', 'roles');
}

/** Absolute path of a project skill directory (`<root>/.orch/skills`). */
export function projectSkillsDir(root) {
  return path.join(root, '.orch', 'skills');
}
