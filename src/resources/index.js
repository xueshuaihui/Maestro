/** Unified resource platform public surface. */

export {
  RESOURCE_TYPES,
  STUDIO_TYPES,
  ASSET_TYPES,
  META_KEYS,
  isType,
  isStudioType,
  studioField,
  projectMeta,
  compareResources,
  deriveId
} from './types.js';

export {
  listResources,
  getResource,
  createResource,
  updateResource,
  archiveResource,
  restoreResource,
  removeResource,
  cloneResource,
  forkResource,
  exportResource,
  importResource
} from './facade.js';

export { collectRefs, refsInDoc, outgoingInDoc, detachRefs } from './refs.js';
