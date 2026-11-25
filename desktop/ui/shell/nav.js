/**
 * Information architecture (beta.4 menu redesign).
 *
 * The sidebar is organised by the job a user is doing, not by the screen the
 * code happens to own:
 *
 *   run   - what is happening now (instances, queue, notifications, occupancy)
 *   team  - who does the work (org builder, resource library, builtin assets)
 *   flow  - how the work is ordered (workflow list, canvas)
 *   govern- what happened and whether it was allowed (audit)
 *   setup - where it runs and how it behaves (project, preferences)
 *
 * Every section owns one persistent tab strip, so a user never has to go back
 * to the sidebar to switch between two screens of the same job. Views keep
 * their historical ids: routing, deep links and the frozen label keys stay
 * valid, only the entry point changes.
 *
 * This module is data only: no DOM, no wording (labels are keys resolved by
 * the label table through `ctx.t`), so the zero-CJK gate keeps passing.
 */

const SECTIONS = Object.freeze([
  Object.freeze({
    id: 'run',
    key: 'DESKTOP_SECTION_RUN',
    glyph: '\u25a3',
    counter: 'queue',
    // Landing view of the section, and the page a bare section click opens.
    view: 'instances',
    tabs: Object.freeze([
      // `instancesLabel` is the projection-supplied name of the list, so the
      // tab reads the same word as the page heading.
      Object.freeze({ view: 'instances', label: 'instances' }),
      Object.freeze({ view: 'queue', key: 'DESKTOP_TAB_QUEUE', counter: 'queue' }),
      Object.freeze({ view: 'notifications', key: 'DESKTOP_TAB_NOTIFY', counter: 'notify' }),
      Object.freeze({ view: 'occupancy', key: 'DESKTOP_TAB_OCCUPANCY' }),
    ]),
  }),
  Object.freeze({
    id: 'team',
    key: 'DESKTOP_SECTION_TEAM',
    glyph: '\u25c8',
    view: 'studio',
    tabs: Object.freeze([
      Object.freeze({ view: 'studio', key: 'DESKTOP_TAB_ORG' }),
      Object.freeze({ view: 'resources', key: 'DESKTOP_TAB_RESOURCES' }),
      Object.freeze({ view: 'assets', key: 'DESKTOP_TAB_BUILTIN' }),
    ]),
  }),
  Object.freeze({
    id: 'flow',
    key: 'DESKTOP_SECTION_FLOW',
    glyph: '\u2317',
    view: 'flows',
    tabs: Object.freeze([
      Object.freeze({ view: 'flows', key: 'DESKTOP_TAB_FLOWS' }),
      Object.freeze({ view: 'canvas', key: 'DESKTOP_TAB_CANVAS' }),
    ]),
  }),
  Object.freeze({
    id: 'govern',
    key: 'DESKTOP_SECTION_GOVERN',
    glyph: '\u2696',
    view: 'governance',
    tabs: Object.freeze([
      Object.freeze({ view: 'governance', key: 'DESKTOP_TAB_AUDIT' }),
    ]),
  }),
  Object.freeze({
    id: 'setup',
    key: 'DESKTOP_SECTION_SETUP',
    glyph: '\u2699',
    view: 'project',
    tabs: Object.freeze([
      Object.freeze({ view: 'project', key: 'DESKTOP_TAB_PROJECT' }),
      Object.freeze({ view: 'settings', key: 'DESKTOP_TAB_PREFS' }),
    ]),
  }),
]);

export { SECTIONS };

/**
 * View -> section. Transient screens (the new-instance form, the instance
 * workspace: graph / board / drill / node detail / panels) belong to the
 * section that opened them, so the strip stays highlighted while the user is
 * inside an instance.
 */
const SECTION_OF_VIEW = Object.freeze({
  instances: 'run',
  queue: 'run',
  notifications: 'run',
  occupancy: 'run',
  new: 'run',
  overview: 'run',
  graph: 'run',
  board: 'run',
  drill: 'run',
  'node-detail': 'run',
  'escalation-panel': 'run',
  'connection-panel': 'run',
  'subflow': 'run',
  studio: 'team',
  resources: 'team',
  assets: 'team',
  flows: 'flow',
  canvas: 'flow',
  governance: 'govern',
  evidence: 'govern',
  project: 'setup',
  settings: 'setup',
});

export function sectionOf(view) {
  return SECTION_OF_VIEW[view] ?? 'run';
}

export function sectionById(id) {
  return SECTIONS.find((section) => section.id === id) ?? null;
}

export function sectionOfView(view) {
  return sectionById(sectionOf(view));
}

/** Tab entries of the section that owns `view` (empty when unavailable). */
export function tabsOf(view) {
  const section = sectionOfView(view);
  return section === null ? [] : section.tabs;
}

/**
 * True when `view` is one of the section's own tabs (as opposed to a transient
 * screen such as an instance workspace). Only tab views are remembered as a
 * section's last position: coming back to "run" must land on the list, never
 * inside whatever instance was open last week.
 */
export function isTabView(view) {
  return tabsOf(view).some((tab) => tab.view === view);
}

/** The tab a click on the section entry should open. */
export function landingView(section, remembered) {
  if (typeof remembered === 'string' && isTabView(remembered) && sectionOf(remembered) === section.id) {
    return remembered;
  }
  return section.view;
}

/** Label key of a tab, or null when the tab borrows a projection label. */
export function tabKey(view) {
  const tab = tabsOf(view).find((entry) => entry.view === view) ?? null;
  return tab?.key ?? null;
}
