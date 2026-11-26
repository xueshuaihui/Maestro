/**
 * Studio page (v2 A2~A6 / B / D) — the in-app authoring surface.
 *
 * Layout: five mutually exclusive tabs (overview / org / teams / flows / runs)
 * instead of six stacked cards. The old page put "scan CLIs", "departments",
 * "roles", "employees", "skills", "teams", "flows", "runs" and "tasks" in one
 * scroll, so creating a team meant scrolling past four unrelated forms and the
 * "new / edit / manage" verbs were scattered over 3000px. Every tab now owns
 * exactly one job, and every create/edit action happens in a side drawer that
 * is opened from the row it affects.
 *
 * Zero CJK: every visible string comes from `/studio/labels` (STUDIO_TEXT in
 * src/cli/labels.js). The page is a thin client: it reads `/studio/state`,
 * posts one `/studio/action` per click, and never derives business rules of
 * its own (readiness, gates and stage order are all computed server-side).
 */

import { readDesktopToken } from './token.js';

const STATE_URL = '/studio/state';
const LABELS_URL = '/studio/labels';
const ACTION_URL = '/studio/action';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const TABS = Object.freeze(['overview', 'org', 'teams', 'flows', 'runs']);

let L = {};
let S = null;
let busy = false;
/** Active tab. `org` by default: a newcomer's first real step after a scan. */
let TAB = 'org';
/** Open side drawer: `null | {kind:'team', id:string|null} | {kind:'employee', roleId}`. */
let PANEL = null;
/** Team preselected by "start run" on a card. */
let RUN_TEAM = null;
/**
 * The one-click demo runs several commands back to back and repaints after
 * each one. While it runs, a form the user already started editing would be
 * replaced under their hands — so the page refuses the demo twice and dims
 * the working surface until it settles.
 */
let DEMO_RUNNING = false;

function token() {
  return readDesktopToken(location.search, {
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
  });
}

async function request(path, init = {}) {
  const headers = { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) };
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function t(key, fallback = '') {
  const value = L[key];
  return typeof value === 'string' ? value : fallback;
}

function fill(template, vars = {}) {
  return String(template ?? '').replace(/\{([^{}]+)\}/g, (match, key) => (
    vars[key] === undefined || vars[key] === null ? match : String(vars[key])
  ));
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function button(text, onClick, cls = 'btn') {
  const node = el('button', cls, text);
  node.type = 'button';
  node.addEventListener('click', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    node.disabled = true;
    try {
      await onClick();
    } catch (err) {
      showToast(String(err?.message ?? err));
    } finally {
      busy = false;
      node.disabled = false;
    }
  });
  return node;
}

function showToast(text, tone = 'err') {
  toastEl.textContent = text;
  toastEl.className = `toast show ${tone}`;
  toastEl.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastEl.hidden = true;
    toastEl.className = 'toast';
  }, 4200);
}

/**
 * Archive a resource after an explicit confirmation. Uses `resource.remove`
 * so the same reference guards apply as on the /resources channel.
 */
function deleteButton(type, id, name) {
  return button(t('UI_DELETE'), async () => {
    if (window.confirm(fill(t('UI_DELETE_CONFIRM'), { name })) !== true) return;
    const result = await act('resource.remove', { type, id });
    if (result) showToast(fill(t('UI_DELETED'), { name }), 'ok');
  }, 'btn small danger');
}

function badge(text, tone) {
  return el('span', `badge ${tone ?? ''}`, text);
}

function card(titleText, subtitle) {
  const box = el('section', 'card');
  const head = el('div', 'card-head');
  head.appendChild(el('h2', null, titleText));
  if (subtitle) head.appendChild(el('span', 'card-sub', subtitle));
  box.appendChild(head);
  box.appendChild(el('div', 'card-body'));
  box.body = box.querySelector('.card-body');
  return box;
}

function table(headers, rows, emptyText) {
  if (rows.length === 0) return el('p', 'empty', emptyText ?? '');
  const wrap = el('div', 'table-wrap');
  const grid = el('table');
  const thead = el('thead');
  const htr = el('tr');
  for (const header of headers) htr.appendChild(el('th', null, header));
  thead.appendChild(htr);
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (const cell of row) {
      const td = el('td');
      if (cell instanceof Node) td.appendChild(cell);
      else td.textContent = cell === null || cell === undefined ? '-' : String(cell);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  grid.appendChild(thead);
  grid.appendChild(tbody);
  wrap.appendChild(grid);
  return wrap;
}

function select(options, value, onChange, placeholder) {
  const node = el('select', 'input');
  if (placeholder) {
    const first = el('option', null, placeholder);
    first.value = '';
    node.appendChild(first);
  }
  for (const option of options) {
    const item = el('option', null, option.label);
    item.value = option.value;
    if (option.value === value) item.selected = true;
    node.appendChild(item);
  }
  if (typeof onChange === 'function') node.addEventListener('change', () => onChange(node.value));
  return node;
}

function input(placeholder, value = '') {
  const node = el('input', 'input');
  node.type = 'text';
  node.placeholder = placeholder ?? '';
  node.value = value;
  return node;
}

function field(labelText, control) {
  const wrap = el('label', 'field');
  wrap.appendChild(el('span', 'field-label', labelText));
  wrap.appendChild(control);
  return wrap;
}

function deptOptions(state) {
  return (state?.departments ?? []).map((dept) => ({ value: dept.id, label: dept.label }));
}

function codeLabel(code) {
  const key = `ROLE_${String(code).replace(/-/g, '_').toUpperCase()}`;
  return t(key, code);
}

function flowName(id) {
  return (S?.flows ?? []).find((flow) => flow.id === id)?.name ?? id;
}

function employeesOf(roleId) {
  return (S?.employees ?? []).filter((emp) => emp.roleId === roleId);
}

function roleName(id) {
  return (S?.roles ?? []).find((role) => role.id === id)?.name ?? id;
}

async function act(action, payload = {}, okText = null) {
  const result = await request(ACTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  if (!result.ok) {
    const key = result.labelKey;
    const message = key ? fill(t(key, key), result.params ?? {}) : (result.code ?? '');
    showToast(message);
    return null;
  }
  if (okText) showToast(okText, 'ok');
  await load();
  return result;
}

// ------------------------------------------------------------------ chrome --

function tabBar() {
  const bar = el('nav', 'tabs');
  bar.setAttribute('role', 'tablist');
  const items = [
    ['overview', t('UI_TAB_OVERVIEW')],
    ['org', t('UI_STEP_ORG')],
    ['teams', t('UI_STEP_TEAM')],
    ['flows', t('UI_STEP_FLOW')],
    ['runs', t('UI_STEP_RUN')],
  ];
  for (const [id, label] of items) {
    const node = button(label, () => {
      TAB = id;
      PANEL = null;
      render();
    }, id === TAB ? 'tab on' : 'tab');
    node.dataset.tab = id;
    node.setAttribute('role', 'tab');
    node.setAttribute('aria-selected', id === TAB ? 'true' : 'false');
    bar.appendChild(node);
  }
  return bar;
}

function tile(label, value, tone = '') {
  const box = el('div', `tile ${tone}`);
  box.appendChild(el('span', 'tile-label', label));
  box.appendChild(el('strong', 'tile-value', value));
  return box;
}

function goTab(id) {
  TAB = id;
  PANEL = null;
  render();
}

// ---------------------------------------------------------------- overview --

function overviewPanel() {
  const frag = document.createDocumentFragment();
  const readyClis = (S.clis ?? []).filter((cli) => cli.executable);
  const readyTeams = (S.teams ?? []).filter((team) => team.ready);

  const tiles = el('div', 'tiles');
  tiles.appendChild(tile(t('UI_STEP_CLI'), `${readyClis.length}/${(S.clis ?? []).length}`, readyClis.length > 0 ? 'ok' : 'warn'));
  tiles.appendChild(tile(`${t('COL_ROLES')} / ${t('COL_EMPLOYEES')}`, `${(S.roles ?? []).length}/${(S.employees ?? []).length}`));
  tiles.appendChild(tile(t('UI_STEP_TEAM'), `${readyTeams.length}/${(S.teams ?? []).length}`, (S.teams ?? []).length > 0 && readyTeams.length === (S.teams ?? []).length ? 'ok' : ''));
  tiles.appendChild(tile(t('UI_STEP_FLOW'), String((S.flows ?? []).length)));
  frag.appendChild(tiles);

  // One next step, chosen by what is actually missing. A wizard that shows
  // every step at once is what made the old page feel like a checklist.
  const next = card(t('UI_OVERVIEW_NEXT'), null);
  next.body.appendChild(el('p', 'hint', t('UI_OVERVIEW_HINT')));
  const actions = el('div', 'row wrap');
  if (readyClis.length === 0) {
    next.body.appendChild(el('p', 'hint', t('UI_OVERVIEW_SCAN_HINT')));
    actions.appendChild(button(t('UI_SCAN'), async () => {
      await act('cli.scan', {}, t('SCAN_DONE', ''));
    }, 'btn primary'));
  } else if ((S.roles ?? []).length === 0) {
    next.body.appendChild(el('p', 'hint', t('UI_OVERVIEW_ROLE_HINT')));
    actions.appendChild(button(t('UI_DEMO'), demo, 'btn primary'));
    actions.appendChild(button(t('UI_STEP_ORG'), () => goTab('org'), 'btn'));
  } else if ((S.teams ?? []).length === 0) {
    next.body.appendChild(el('p', 'hint', t('UI_OVERVIEW_TEAM_HINT')));
    actions.appendChild(button(t('UI_TEAM_NEW'), () => goTab('teams'), 'btn primary'));
  } else {
    next.body.appendChild(el('p', 'hint', t('UI_OVERVIEW_RUN_HINT')));
    actions.appendChild(button(t('UI_STEP_RUN'), () => goTab('runs'), 'btn primary'));
  }
  next.body.appendChild(actions);
  frag.appendChild(next);
  frag.appendChild(issuesCard());
  return frag;
}

/** Readiness issues, sourced verbatim from `/studio/state.readiness`. */
function issuesCard() {
  const box = card(t('UI_WARNINGS'), null);
  const list = [
    ...(S.readiness?.errors ?? []).map((item) => ({ tone: 'err', text: item.code, params: item.params })),
    ...(S.readiness?.warnings ?? []).map((item) => ({ tone: 'warn', text: item.code, params: item.params }))
  ];
  if (list.length === 0) {
    box.body.appendChild(el('p', 'hint', t('UI_READY')));
    return box;
  }
  for (const item of list) {
    box.body.appendChild(el('p', `issue ${item.tone}`, `${item.text} ${JSON.stringify(item.params ?? {})}`));
  }
  return box;
}

// --------------------------------------------------------------------- org --

function employeesCell(role) {
  const cell = el('div', 'chips');
  const staff = employeesOf(role.id);
  if (staff.length === 0) cell.appendChild(el('span', 'tiny muted', t('UI_ROLE_NO_EMP')));
  for (const emp of staff) {
    const chip = el('span', 'chip sm', `${emp.name} · ${emp.cliId}`);
    // '×' rather than a word: the row-level button stays the only control
    // labelled with the delete key, so "delete role" never hits an employee.
    const remove = el('button', 'chip-x', '\u00d7');
    remove.type = 'button';
    remove.title = t('UI_DELETE');
    remove.addEventListener('click', async (event) => {
      event.preventDefault();
      if (window.confirm(fill(t('UI_DELETE_CONFIRM'), { name: emp.name })) !== true) return;
      await act('resource.remove', { type: 'employee', id: emp.id });
    });
    chip.appendChild(remove);
    cell.appendChild(chip);
  }
  cell.appendChild(button(`+ ${t('UI_ROLE_ADD_EMP')}`, () => {
    PANEL = { kind: 'employee', roleId: role.id };
    render();
  }, 'btn small ghost'));
  return cell;
}

function roleEditor(state) {
  const acpOptions = [
    { value: '', label: t('UI_OPTION_UNSET') },
    { value: 'true', label: t('UI_OPTION_REQUIRED') },
    { value: 'false', label: t('UI_OPTION_FORBIDDEN') }
  ];

  const form = el('div', 'form-row role-form');
  const name = input(t('UI_NAME'));
  const code = select(
    (state.roleCodes ?? []).map((value) => ({ value, label: codeLabel(value) })),
    '',
    null,
    t('UI_SELECT_PLACEHOLDER')
  );
  let dept = state.departments[0]?.id ?? 'product';
  const deptSel = select(deptOptions(state), dept, (value) => { dept = value; });
  const duty = input(t('UI_DUTY'));
  const skills = input(t('UI_SKILLS'));
  let acp = '';
  const acpSel = select(acpOptions, '', (value) => { acp = value; });
  const submitBtn = button(t('UI_ADD_ROLE'), async () => {
    if (!name.value.trim() || !code.value) {
      showToast(t('ERR_ROLE_NAME_REQUIRED'));
      return;
    }
    const splitList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
    const payload = {
      name: name.value.trim(),
      code: code.value,
      departmentId: dept,
      duty: duty.value.trim(),
      skills: splitList(skills.value),
      requires: { acp: acp === '' ? null : acp === 'true' }
    };
    const result = editId
      ? await act('role.update', { id: editId, ...payload })
      : await act('role.add', payload);
    if (result) resetForm();
  });
  let editId = null;
  function resetForm() {
    editId = null;
    name.value = ''; code.value = ''; duty.value = ''; skills.value = '';
    dept = state.departments[0]?.id ?? 'product'; deptSel.value = dept;
    acp = ''; acpSel.value = '';
    submitBtn.textContent = t('UI_ADD_ROLE');
  }
  function fillForm(role) {
    editId = role.id;
    name.value = role.name ?? '';
    code.value = role.code ?? '';
    duty.value = role.duty ?? '';
    skills.value = (role.skills ?? []).join(', ');
    dept = role.departmentId ?? 'product'; deptSel.value = dept;
    acp = role.requires?.acp === true ? 'true' : role.requires?.acp === false ? 'false' : '';
    acpSel.value = acp;
    submitBtn.textContent = t('UI_SAVE_ROLE');
  }
  form.appendChild(field(t('UI_NAME'), name));
  form.appendChild(field(t('UI_CODE'), code));
  form.appendChild(field(t('UI_DEPT'), deptSel));
  form.appendChild(field(t('UI_DUTY'), duty));
  form.appendChild(field(t('UI_SKILLS'), skills));
  form.appendChild(field(t('UI_REQUIRES_ACP'), acpSel));
  form.appendChild(submitBtn);
  form.fill = fillForm;
  return form;
}

function skillsCard() {
  const box = card(t('UI_ORG_SKILLS'), null);
  const form = el('div', 'form-row skill-form');
  const skId = input(t('UI_SKILL_ID'));
  const skName = input(t('UI_SKILL_NAME'));
  const skSummary = input(t('UI_SUMMARY'));
  const skGroups = input(t('UI_APPLIES_TO'));
  const skCommands = input(t('UI_COMMANDS'));
  form.appendChild(field(t('UI_SKILL_ID'), skId));
  form.appendChild(field(t('UI_SKILL_NAME'), skName));
  form.appendChild(field(t('UI_SUMMARY'), skSummary));
  form.appendChild(field(t('UI_APPLIES_TO'), skGroups));
  form.appendChild(field(t('UI_COMMANDS'), skCommands));
  form.appendChild(button(t('UI_ADD_SKILL'), async () => {
    if (!skId.value.trim() || !skName.value.trim() || !skSummary.value.trim()) {
      showToast(t('ERR_SKILL_ID_REQUIRED'));
      return;
    }
    const payload = {
      id: skId.value.trim(),
      name: skName.value.trim(),
      summary: skSummary.value.trim()
    };
    const groups = skGroups.value.split(',').map((x) => x.trim()).filter(Boolean);
    if (groups.length > 0) payload.appliesTo = groups;
    const commands = skCommands.value.split(',').map((x) => x.trim()).filter(Boolean);
    if (commands.length > 0) payload.commands = commands;
    const result = await act('skill.create', payload, fill(t('UI_SKILL_CREATED'), { id: payload.id }));
    if (result) { skId.value = ''; skName.value = ''; skSummary.value = ''; }
  }));
  box.body.appendChild(form);
  return box;
}

function orgPanel() {
  const frag = document.createDocumentFragment();

  const deptCard = card(t('UI_ORG_DEPTS'), String((S.departments ?? []).length));
  const deptForm = el('div', 'form-row dept-form');
  const deptId = input(t('UI_DEPT_ID'));
  const deptName = input(t('UI_DEPT_NAME'));
  deptForm.appendChild(deptId);
  deptForm.appendChild(deptName);
  deptForm.appendChild(button(t('UI_ADD_DEPT'), async () => {
    const id = deptId.value.trim();
    const label = deptName.value.trim();
    if (id.length === 0 || label.length === 0) {
      showToast(t('ERR_ROLE_NAME_REQUIRED'));
      return;
    }
    const result = await act('dept.add', { id, name: label });
    if (result) {
      deptId.value = '';
      deptName.value = '';
      showToast(fill(t('UI_DEPT_CREATED'), { name: label }), 'ok');
    }
  }));
  deptCard.body.appendChild(deptForm);
  deptCard.body.appendChild(table(
    [t('UI_DEPT_NAME'), t('COL_ROLES'), t('UI_DELETE')],
    (S.departments ?? []).map((dept) => [
      dept.label,
      String(dept.roleCount),
      deleteButton('department', dept.id, dept.label)
    ]),
    t('UI_EMPTY_ROLE')
  ));
  frag.appendChild(deptCard);

  const roleCard = card(t('UI_ORG_ROLES'), `${(S.roles ?? []).length} / ${(S.employees ?? []).length}`);
  roleCard.body.appendChild(el('p', 'hint', t('UI_ORG_ROLES_HINT')));
  const roleForm = roleEditor(S);
  const roleRows = (S.roles ?? []).map((role) => {
    const staff = employeesOf(role.id);
    const ops = el('div', 'row');
    ops.appendChild(button(t('UI_EDIT_ROLE'), () => {
      roleForm.fill(role);
      roleForm.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 'btn small'));
    ops.appendChild(deleteButton('role', role.id, role.name));
    return [
      role.name,
      role.code ?? '-',
      role.department,
      employeesCell(role),
      staff.length === 0 ? badge(t('UI_BLOCKED'), 'warn') : badge(t('UI_READY'), 'ok'),
      ops
    ];
  });
  roleCard.body.appendChild(table(
    [t('COL_NAME'), t('COL_CODE'), t('COL_DEPT'), t('UI_ROLE_EMPLOYEES'), t('COL_STATUS'), t('UI_OPS')],
    roleRows,
    t('UI_EMPTY_ROLE')
  ));
  roleCard.body.appendChild(el('h3', 'sub', t('UI_ADD_ROLE')));
  roleCard.body.appendChild(roleForm);
  frag.appendChild(roleCard);
  frag.appendChild(skillsCard());
  return frag;
}

// ------------------------------------------------------------------- teams --

function teamCard(team) {
  const box = el('article', 'team-card');
  const head = el('div', 'team-card-head');
  head.appendChild(el('h3', null, team.name));
  head.appendChild(team.ready ? badge(t('UI_READY'), 'ok') : badge(t('UI_BLOCKED'), 'warn'));
  box.appendChild(head);

  const meta = el('div', 'team-meta');
  meta.appendChild(el('span', null, `${t('UI_LEAD')} ${team.leadName}`));
  meta.appendChild(el('span', null, team.flowId
    ? `${t('UI_FLOW')} ${flowName(team.flowId)}`
    : t('UI_TEAM_NO_FLOW')));
  meta.appendChild(el('span', null, (S.runModeLabels ?? {})[team.runMode] ?? team.runMode));
  meta.appendChild(el('span', null, fill(t('UI_TEAM_SUMMARY'), {
    roles: team.roleCount,
    employees: team.employeeCount
  })));
  box.appendChild(meta);

  const coverage = (team.missingCodes ?? []).length > 0
    ? fill(t('UI_TEAM_COVERAGE_MISSING'), { codes: team.missingCodes.join(', ') })
    : t('UI_TEAM_COVERAGE_OK');
  box.appendChild(el('p', (team.missingCodes ?? []).length > 0 ? 'issue warn' : 'hint', coverage));

  const members = el('div', 'chips');
  for (const member of team.members ?? []) {
    const labelText = `${member.roleName}${member.isLead ? ' \u2605' : ''} · ${member.employees.length}`;
    members.appendChild(el('span', `chip sm ${member.employees.length === 0 ? 'warn' : ''}`, labelText));
  }
  box.appendChild(members);

  const ops = el('div', 'row wrap team-ops');
  ops.appendChild(button(t('UI_TEAM_EDIT'), () => {
    PANEL = { kind: 'team', id: team.id };
    render();
  }, 'btn small'));
  ops.appendChild(button(t('UI_TEAM_RUN'), () => {
    RUN_TEAM = team.id;
    goTab('runs');
  }, 'btn small primary'));
  ops.appendChild(deleteButton('team', team.id, team.name));
  box.appendChild(ops);
  return box;
}

function teamsPanel() {
  const frag = document.createDocumentFragment();
  const head = el('div', 'row wrap mb14');
  const hint = el('p', 'hint grow', (S.roles ?? []).length === 0
    ? t('UI_TEAM_NEED_ROLES')
    : t('UI_TEAMS_HINT'));
  head.appendChild(hint);
  head.appendChild(button(t('UI_TEAM_NEW'), () => {
    PANEL = { kind: 'team', id: null };
    render();
  }, 'btn primary'));
  frag.appendChild(head);

  if ((S.teams ?? []).length === 0) {
    frag.appendChild(el('p', 'empty', t('UI_EMPTY_TEAM')));
    return frag;
  }
  const grid = el('div', 'team-grid');
  for (const team of S.teams) grid.appendChild(teamCard(team));
  frag.appendChild(grid);
  return frag;
}

// ------------------------------------------------------------------- flows --

function flowsPanel() {
  const frag = document.createDocumentFragment();
  const box = card(t('UI_STEP_FLOW'), String((S.flows ?? []).length));
  const rows = (S.flows ?? []).map((flow) => [
    flow.name,
    flow.kind,
    String(flow.stageCount),
    String(flow.gates.length),
    flow.stages.some((stage) => stage.gate) ? t('GATE_PRD_FREEZE') + '\u2026' : t('GATE_NONE'),
    deleteButton('flow', flow.id, flow.name)
  ]);
  box.body.appendChild(table(
    [t('COL_NAME'), 'kind', t('COL_STAGE'), t('COL_GATE'), t('GATE_PENDING'), t('UI_DELETE')],
    rows,
    t('UI_EMPTY_FLOW')
  ));

  // Stage detail is reference material, not a primary action: fold it so a
  // 12-stage flow does not push the create form off the screen.
  for (const flow of S.flows) {
    const detail = el('details', 'flow-detail');
    detail.appendChild(el('summary', null, `${t('UI_FLOWS_STAGES')} · ${flow.name}`));
    const stageRows = flow.stages.map((stage) => [
      stage.id,
      stage.title,
      stage.roleCodes.join(','),
      stage.gate ? t(`GATE_${stage.gate.replace(/-/g, '_').toUpperCase()}`, stage.gate) : t('GATE_NONE'),
      stage.artifacts.map((artifact) => artifact.title).join(', ') || '-'
    ]);
    detail.appendChild(table(
      [t('COL_STAGE'), t('COL_NAME'), t('COL_ROLES'), t('COL_GATE'), t('COL_ARTIFACTS')],
      stageRows,
      ''
    ));
    detail.appendChild(el('p', 'hint', `${t('UI_EDGES')}: ${flow.edges.join('  ')}`));
    detail.appendChild(button(t('UI_FLOWS_OPEN_CANVAS'), () => {
      window.parent.postMessage({ action: 'studio-open-canvas', flowId: flow.id }, '*');
    }, 'btn small ghost'));
    box.body.appendChild(detail);
  }
  frag.appendChild(box);

  const templateCard = card(t('UI_FLOWS_NEW'), t('UI_FLOWS_TEMPLATE'));
  const templateForm = el('div', 'form-row');
  const templateName = input(t('UI_NAME'));
  templateForm.appendChild(field(t('UI_NAME'), templateName));
  templateForm.appendChild(button(t('UI_CREATE_FLOW'), async () => {
    const result = await act('flow.create', {
      name: templateName.value.trim() || undefined,
      template: 'rd-12'
    }, fill(t('UI_SKILL_CREATED'), { id: t('FLOW_RD12') }));
    if (result) templateName.value = '';
  }, 'btn primary'));
  templateCard.body.appendChild(templateForm);
  frag.appendChild(templateCard);

  const customCard = card(t('UI_FLOWS_CUSTOM'), t('UI_CUSTOM_FLOW_HINT'));
  const customForm = el('div', 'form-row');
  const customName = input(t('UI_NAME'));
  const custom = el('textarea', 'input textarea');
  custom.placeholder = t('UI_CUSTOM_FLOW_HINT');
  customForm.appendChild(field(t('UI_NAME'), customName));
  customForm.appendChild(field(t('UI_STAGES'), custom));
  customForm.appendChild(button(t('UI_CREATE_FLOW'), async () => {
    const stages = String(custom.value ?? '')
      .split('|')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk, index) => {
        const [rawId, roles] = chunk.split(':').map((part) => (part ?? '').trim());
        // A blank id gets the same `sNN` shape `normalizeStage` would assign,
        // so the generated edges below stay valid.
        const id = rawId || `s${String(index + 1).padStart(2, '0')}`;
        return { id, roleCodes: String(roles ?? '').split(',').map((r) => r.trim()).filter(Boolean) };
      });
    if (stages.length === 0) {
      showToast(t('ERR_FLOW_SPEC_REQUIRED'));
      return;
    }
    const edges = stages.slice(1).map((stage, index) => ({ from: stages[index].id, to: stage.id }));
    const result = await act('flow.create', {
      name: customName.value.trim() || undefined,
      stages,
      edges
    });
    if (result) custom.value = '';
  }, 'btn ghost'));
  customCard.body.appendChild(customForm);
  frag.appendChild(customCard);
  return frag;
}

// -------------------------------------------------------------------- runs --

/**
 * Starting text for the engine's task field, derived from the chosen team's
 * flow: one product line per stage. The engine rejects a task with no product
 * line, so prefilling this is what makes "start" work without teaching the user
 * the syntax first; they only edit what they disagree with.
 */
function scaffoldFor(team) {
  const flow = (S.flows ?? []).find((item) => item.id === team.flowId);
  const lines = [`${t('TASK_GOAL_PREFIX')}${team.name}`];
  for (const stage of flow?.stages ?? []) {
    lines.push(`${t('TASK_PRODUCT_PREFIX')}${stage.title || stage.id}.md`);
  }
  return lines.join('\n');
}

function runsPanel() {
  const frag = document.createDocumentFragment();

  if ((S.teams ?? []).length > 0) {
    const box = card(t('UI_RUNS_NEW'), t('UI_RUNS_HINT'));
    const form = el('div', 'form-row');
    const preferred = (S.teams ?? []).find((team) => team.id === RUN_TEAM)
      ?? (S.teams ?? []).find((team) => team.ready)
      ?? S.teams[0];
    let teamId = preferred.id;
    const teamSel = select(
      S.teams.map((team) => ({ value: team.id, label: `${team.name}${team.ready ? '' : ' \u00b7 !'}` })),
      teamId,
      (value) => {
        teamId = value;
        const next = (S.teams ?? []).find((item) => item.id === value);
        if (next) retarget(next);
      }
    );
    let mode = 'simulate';
    const modeSel = select(
      [
        { value: 'simulate', label: t('MODE_SIMULATE') },
        { value: 'plan', label: t('MODE_PLAN') },
        { value: 'engine', label: t('MODE_ENGINE') }
      ],
      mode,
      (value) => { mode = value; }
    );
    form.appendChild(field(t('COL_NAME'), teamSel));
    form.appendChild(field(t('UI_MODE'), modeSel));
    box.body.appendChild(form);

    const taskArea = el('textarea', 'task-input');
    taskArea.rows = 6;
    taskArea.value = scaffoldFor(preferred);
    let taskDirty = false;
    taskArea.addEventListener('input', () => { taskDirty = true; });
    function retarget(team) {
      if (!taskDirty) taskArea.value = scaffoldFor(team);
    }
    const taskField = field(t('UI_RUN_TASK'), taskArea);
    taskField.appendChild(el('p', 'hint', t('UI_RUN_TASK_HINT')));
    box.body.appendChild(taskField);

    const actions = el('div', 'row mt14');
    actions.appendChild(button(t('UI_START_RUN'), async () => {
      const result = await act('run.start', { teamId, mode, task: taskArea.value });
      if (result) RUN_TEAM = teamId;
    }, 'btn primary'));
    box.body.appendChild(actions);
    frag.appendChild(box);
  }

  const list = card(t('UI_STEP_RUN'), String((S.runs ?? []).length));
  if ((S.runs ?? []).length === 0) {
    list.body.appendChild(el('p', 'empty', t('UI_EMPTY_RUN')));
  }
  for (const run of (S.runs ?? []).slice(0, 5)) {
    const line = el('div', 'run-head');
    line.appendChild(el('strong', null, run.id));
    line.appendChild(badge(`${run.progress.done}/${run.progress.total}`, 'ok'));
    line.appendChild(badge(run.status, run.status === 'completed' ? 'ok' : run.status === 'blocked' ? 'warn' : ''));
    line.appendChild(el('span', 'card-sub', `${run.mode} · ${run.teamId} · ${run.flowId}`));
    // An engine run that really launched says so with its instance id: that id
    // is what the run page and the tray count are about.
    if (run.engine?.launched === true && run.engine.instanceId) {
      line.appendChild(badge(fill(t('UI_RUN_INSTANCE'), { id: run.engine.instanceId }), 'ok'));
    }
    list.body.appendChild(line);

    const stageRows = run.stages.map((stage) => {
      const cells = [stage.id, stage.title, stage.status, stage.artifactCount];
      if (stage.status === 'awaiting-approval') {
        cells.push(button(t('UI_APPROVE'), async () => {
          await act('run.approve', { runId: run.id, stageId: stage.id, approve: true });
        }, 'btn small primary'));
        cells.push(button(t('UI_REJECT'), async () => {
          await act('run.approve', { runId: run.id, stageId: stage.id, approve: false });
        }, 'btn small ghost'));
      } else {
        cells.push(stage.gateStatus ?? '-');
        cells.push('');
      }
      return cells;
    });
    list.body.appendChild(table(
      [t('COL_STAGE'), t('COL_NAME'), t('COL_STATUS'), t('COL_ARTIFACTS'), t('COL_GATE'), ''],
      stageRows,
      ''
    ));
    // A run that prepared but could not start has to say why; otherwise the
    // stage table just sits at "pending" and looks stuck.
    if (run.mode === 'engine' && run.engine && run.engine.launched !== true) {
      const code = run.engine.error;
      const text = run.engine.reason === 'launch_failed' && code
        ? fill(t('UI_RUN_LAUNCH_FAILED'), { code })
        : t('UI_RUN_NO_HOST');
      list.body.appendChild(el('p', 'hint warn', text));
    }
    list.body.appendChild(el('p', 'hint', t('UI_RUNNING_HINT')));
  }
  frag.appendChild(list);
  frag.appendChild(tasksCard());
  return frag;
}

/** Tasks and requirement changes, folded: they matter only inside a run. */
function tasksCard() {
  const box = card(t('UI_TASKS_CHANGES'), String((S.tasks ?? []).length));
  box.body.appendChild(table(
    [t('COL_ID'), t('COL_STAGE'), t('COL_STATUS'), t('COL_ROLE')],
    (S.tasks ?? []).slice(-30).map((task) => [
      task.id,
      task.stageId ?? '-',
      task.status,
      task.roleId ?? '-'
    ]),
    t('TASK_NO_TASKS')
  ));

  const run = (S.runs ?? [])[0] ?? null;
  if (run) {
    const form = el('div', 'form-row');
    let stageId = run.stages[Math.min(run.stages.length - 1, 7)]?.id ?? run.stages[0]?.id ?? '';
    const stageSel = select(
      run.stages.map((stage) => ({ value: stage.id, label: `${stage.id} ${stage.title}` })),
      stageId,
      (value) => { stageId = value; }
    );
    const summary = input(t('UI_CHANGE_SUMMARY'));
    form.appendChild(field(t('COL_STAGE'), stageSel));
    form.appendChild(field(t('UI_CHANGE_SUMMARY'), summary));
    form.appendChild(button(t('UI_CHANGE'), async () => {
      if (!summary.value.trim()) return;
      await act('task.change', { runId: run.id, stageId, summary: summary.value.trim() });
    }, 'btn ghost'));
    box.body.appendChild(form);
  }

  if ((S.changes ?? []).length > 0) {
    box.body.appendChild(el('h3', 'sub', t('UI_CHANGE')));
    box.body.appendChild(table(
      [t('COL_ID'), t('COL_STAGE'), t('COL_STATUS')],
      S.changes.map((change) => [change.id, change.stageId ?? '-', change.status]),
      ''
    ));
  }
  return box;
}

// ------------------------------------------------------------------ drawer --

function drawerShell(titleText) {
  const aside = el('aside', 'drawer');
  const head = el('div', 'drawer-head');
  head.appendChild(el('h2', null, titleText));
  head.appendChild(button(t('UI_CLOSE'), () => {
    PANEL = null;
    render();
  }, 'btn small ghost'));
  aside.appendChild(head);
  const body = el('div', 'drawer-body');
  aside.appendChild(body);
  aside.body = body;
  return aside;
}

/**
 * Team drawer. One form for "new" and "edit": the member set is a checkbox
 * list of roles, because a team is a set of roles (employees follow the role).
 * Saving sends the whole set in one `team.update`, so the page never depends
 * on a sequence of add/remove calls that can half-apply.
 */
function teamDrawer(id) {
  const team = (S.teams ?? []).find((item) => item.id === id) ?? null;
  const aside = drawerShell(team ? t('UI_TEAM_EDIT') : t('UI_TEAM_NEW'));
  if ((S.roles ?? []).length === 0) {
    aside.body.appendChild(el('p', 'hint', t('UI_TEAM_NEED_ROLES')));
    aside.body.appendChild(button(t('UI_STEP_ORG'), () => goTab('org'), 'btn'));
    return aside;
  }

  const form = el('div', 'drawer-form');
  const name = input(t('UI_NAME'), team?.name ?? '');
  form.appendChild(field(t('UI_NAME'), name));

  let lead = team?.leadRoleId ?? (S.roles.find((role) => role.code === 'eng-lead')?.id ?? S.roles[0].id);
  const leadSel = select(
    S.roles.map((role) => ({ value: role.id, label: role.name })),
    lead,
    (value) => {
      lead = value;
      if (!picked.has(value)) {
        picked.add(value);
        renderPicked();
      }
    }
  );
  form.appendChild(field(t('UI_LEAD'), leadSel));

  let flowId = team?.flowId ?? '';
  const flowSel = select(
    (S.flows ?? []).map((flow) => ({ value: flow.id, label: flow.name })),
    flowId,
    (value) => { flowId = value; },
    t('UI_TEAM_NO_FLOW')
  );
  form.appendChild(field(t('UI_FLOW'), flowSel));

  let runMode = team?.runMode ?? 'semi';
  const modeSel = select(
    (S.runModes ?? ['auto', 'semi', 'manual']).map((value) => ({
      value,
      label: S.runModeLabels?.[value] ?? value
    })),
    runMode,
    (value) => { runMode = value; }
  );
  form.appendChild(field(t('UI_RUN_MODE'), modeSel));

  const picked = new Set(team?.roleIds ?? []);
  if (picked.size === 0) picked.add(lead);
  const members = el('div', 'checklist');
  const renderPicked = () => {
    members.replaceChildren();
    for (const role of S.roles) {
      const row = el('label', 'check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = picked.has(role.id);
      box.disabled = role.id === lead;
      box.addEventListener('change', () => {
        if (box.checked) picked.add(role.id);
        else picked.delete(role.id);
      });
      row.appendChild(box);
      row.appendChild(el('span', 'grow', role.name));
      const staff = employeesOf(role.id).length;
      row.appendChild(el('span', `tiny ${staff === 0 ? 'warn' : 'muted'}`, `${t('UI_ROLE_EMPLOYEES')} ${staff}`));
      members.appendChild(row);
    }
  };
  renderPicked();
  form.appendChild(field(t('UI_TEAM_PICK_ROLES'), members));

  form.appendChild(button(team ? t('UI_SAVE') : t('UI_CREATE_TEAM'), async () => {
    if (!name.value.trim()) {
      showToast(t('ERR_TEAM_NAME_REQUIRED'));
      return;
    }
    if (!picked.has(lead)) picked.add(lead);
    const payload = {
      name: name.value.trim(),
      leadRoleId: lead,
      roleIds: [...picked],
      flowId: flowId || null,
      runMode
    };
    const result = team
      ? await act('team.update', { teamId: team.id, ...payload })
      : await act('team.create', payload);
    if (result) {
      PANEL = null;
      render();
    }
  }, 'btn primary'));
  aside.body.appendChild(form);
  return aside;
}

/** Add one employee to a role: the only place an employee is created. */
function employeeDrawer(roleId) {
  const role = (S.roles ?? []).find((item) => item.id === roleId) ?? null;
  const aside = drawerShell(fill(t('UI_EMP_ADD_FOR'), { role: role?.name ?? roleId }));
  if (role === null) return aside;

  const form = el('div', 'drawer-form');
  const name = input(t('UI_NAME'));
  form.appendChild(field(t('UI_NAME'), name));
  const executables = (S.clis ?? []).filter((cli) => cli.executable);
  let cliId = executables[0]?.id ?? (S.clis ?? [])[0]?.id ?? '';
  const cliSel = select(
    (S.clis ?? []).map((cli) => ({ value: cli.id, label: `${cli.name} (${cli.id})` })),
    cliId,
    (value) => { cliId = value; },
    t('UI_SELECT_PLACEHOLDER')
  );
  form.appendChild(field(t('UI_CLI'), cliSel));
  form.appendChild(button(t('UI_ADD_EMP'), async () => {
    if (!cliId) {
      showToast(t('ERR_CLI_REQUIRED'));
      return;
    }
    const result = await act('emp.add', {
      name: name.value.trim() || undefined,
      roleId: role.id,
      cliId
    });
    if (result) {
      PANEL = null;
      render();
    }
  }, 'btn primary'));
  aside.body.appendChild(form);
  return aside;
}

function drawerNode() {
  if (PANEL === null) return null;
  if (PANEL.kind === 'team') return teamDrawer(PANEL.id);
  if (PANEL.kind === 'employee') return employeeDrawer(PANEL.roleId);
  return null;
}

// ------------------------------------------------------------------ render --

function panelFor(tab) {
  if (tab === 'overview') return overviewPanel();
  if (tab === 'org') return orgPanel();
  if (tab === 'teams') return teamsPanel();
  if (tab === 'flows') return flowsPanel();
  return runsPanel();
}

function render() {
  app.replaceChildren();
  if (!S) return;
  document.getElementById('root').textContent = S.root ?? '';
  app.appendChild(tabBar());
  app.appendChild(panelFor(TABS.includes(TAB) ? TAB : 'org'));
  const drawer = drawerNode();
  if (drawer !== null) app.appendChild(drawer);
}

// ------------------------------------------------------------------- boot ---

// render() replaces every child of #app, including the initial #loading node.
// Every later load() must therefore tolerate its absence instead of throwing
// halfway through a wizard action.
function setLoading(text) {
  const node = document.getElementById('loading');
  if (node) node.textContent = text;
}

async function load() {
  if (busy === false) setLoading(t('UI_LOADING'));
  const [labelBody, state] = await Promise.all([
    request(LABELS_URL),
    request(STATE_URL)
  ]);
  if (labelBody?.ok) L = labelBody.labels ?? {};
  S = state?.ok ? state : null;
  document.getElementById('title').textContent = t('TITLE', 'Studio');
  document.getElementById('btn-scan').textContent = t('UI_SCAN', 'scan');
  document.getElementById('btn-demo').textContent = t('UI_DEMO', 'demo');
  document.getElementById('btn-refresh').textContent = t('UI_REFRESH', 'refresh');
  document.getElementById('btn-instances').textContent = t('UI_STUDIO_TO_INSTANCES', 'View instances');
  document.getElementById('btn-demo').title = t('UI_DEMO_HINT2', '');
  setLoading('');
  render();
}

async function demo() {
  if (DEMO_RUNNING) return;
  DEMO_RUNNING = true;
  app.classList.add('is-busy');
  try {
    // Composes the same actions a user clicks: seed -> flow -> team -> run.
    await act('org.seed', { perRole: 1 });
    if (!S?.flows?.length) await act('flow.create', { template: 'rd-12', runMode: 'auto' });
    const refreshed = await request(STATE_URL);
    if (refreshed?.ok) S = refreshed;
    if (!S?.teams?.length) {
      await act('team.create', {
        name: t('FLOW_RD12', 'team'),
        leadRoleId: S.roles.find((role) => role.code === 'eng-lead')?.id ?? S.roles[0]?.id,
        roleIds: S.roles.map((role) => role.id),
        flowId: S.flows[0]?.id ?? null,
        runMode: 'auto'
      });
    }
    const latest = await request(STATE_URL);
    if (latest?.ok) S = latest;
    if (S?.teams?.length) {
      const started = await act('run.start', { teamId: S.teams[0].id, mode: 'simulate' });
      if (started) {
        showToast(fill(t('DEMO_DONE', ''), {
          roles: S.roles?.length ?? 0,
          employees: S.employees?.length ?? 0,
          teams: S.teams?.length ?? 0,
          flows: S.flows?.length ?? 0,
          run: started.run?.id ?? '-'
        }), 'ok');
      }
    }
  } finally {
    DEMO_RUNNING = false;
    app.classList.remove('is-busy');
    render();
  }
}

document.getElementById('btn-scan').addEventListener('click', async () => {
  await act('cli.scan', {}, t('SCAN_DONE', ''));
});
document.getElementById('btn-demo').addEventListener('click', demo);
document.getElementById('btn-refresh').addEventListener('click', load);
document.getElementById('btn-instances').addEventListener('click', () => {
  window.parent.postMessage({ action: 'studio-nav-instances' }, '*');
});

if (!token()) {
  app.replaceChildren(el('p', 'empty', 'TOKEN'));
  setLoading('TOKEN');
} else {
  load().catch((err) => {
    app.replaceChildren(el('p', 'empty', String(err?.message ?? err)));
  });
}
