/**
 * Studio page (v2 A2~A6 / B / D) — the in-app authoring surface.
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

let L = {};
let S = null;
let busy = false;

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

// ------------------------------------------------------------------ render --

function stepCli(state) {
  const box = card(t('UI_STEP_CLI'), `${state.clis.length}`);
  const rows = state.clis.map((cli) => [
    cli.id,
    cli.name,
    cli.version ?? '-',
    badge(cli.executable ? t('STATUS_IDLE', cli.status) : t('STATUS_UNREACHABLE'), cli.executable ? 'ok' : 'warn'),
    cli.acp === null ? '-' : String(cli.acp),
    cli.executable ?? '-'
  ]);
  box.body.appendChild(table(
    [t('COL_ID'), t('COL_NAME'), t('COL_VERSION'), t('COL_STATUS'), t('COL_ACP'), t('COL_PATH')],
    rows,
    t('UI_EMPTY_CLI')
  ));
  return box;
}

function stepOrg(state) {
  const box = card(t('UI_STEP_ORG'), `${state.roles.length} / ${state.employees.length}`);

  const acpOptions = [
    { value: '', label: t('UI_OPTION_UNSET') },
    { value: 'true', label: t('UI_OPTION_REQUIRED') },
    { value: 'false', label: t('UI_OPTION_FORBIDDEN') }
  ];

  // The role form is shared by add and edit. `editId` is null in add mode.
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

  const roleRows = state.roles.map((role) => [
    role.name,
    role.code ?? '-',
    role.department,
    (role.skills ?? []).join(', ') || '-',
    String(role.employeeCount),
    role.employeeCount === 0 ? badge(t('UI_BLOCKED'), 'warn') : badge(t('UI_READY'), 'ok'),
    button(t('UI_EDIT_ROLE'), () => { fillForm(role); }, 'btn small')
  ]);
  box.body.appendChild(table(
    [t('COL_NAME'), t('COL_CODE'), t('COL_DEPT'), t('UI_SKILLS'), t('COL_EMPLOYEES'), t('COL_STATUS'), t('UI_EDIT_ROLE')],
    roleRows,
    t('UI_EMPTY_ROLE')
  ));
  box.body.appendChild(form);

  // Custom skill creation (writes .orch/skills/<id>/SKILL.md via the same
  // registry validators the CLI uses; /assets/* stays read-only).
  const skillForm = el('div', 'form-row skill-form');
  const skId = input(t('UI_SKILL_ID'));
  const skName = input(t('UI_SKILL_NAME'));
  const skSummary = input(t('UI_SUMMARY'));
  const skGroups = input(t('UI_APPLIES_TO'));
  const skCommands = input(t('UI_COMMANDS'));
  skillForm.appendChild(field(t('UI_SKILL_ID'), skId));
  skillForm.appendChild(field(t('UI_SKILL_NAME'), skName));
  skillForm.appendChild(field(t('UI_SUMMARY'), skSummary));
  skillForm.appendChild(field(t('UI_APPLIES_TO'), skGroups));
  skillForm.appendChild(field(t('UI_COMMANDS'), skCommands));
  skillForm.appendChild(button(t('UI_ADD_SKILL'), async () => {
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
  box.body.appendChild(el('h3', 'sub', t('UI_ADD_SKILL')));
  box.body.appendChild(skillForm);

  const empForm = el('div', 'form-row');
  const empName = input(t('UI_NAME'));
  let roleId = state.roles[0]?.id ?? '';
  const roleSel = select(
    state.roles.map((role) => ({ value: role.id, label: role.name })),
    roleId,
    (value) => { roleId = value; }
  );
  let cliId = state.clis.find((cli) => cli.executable)?.id ?? state.clis[0]?.id ?? '';
  const cliSel = select(
    state.clis.map((cli) => ({ value: cli.id, label: `${cli.name} (${cli.id})` })),
    cliId,
    (value) => { cliId = value; },
    t('UI_SELECT_PLACEHOLDER')
  );
  empForm.appendChild(field(t('UI_NAME'), empName));
  empForm.appendChild(field(t('UI_ROLE'), roleSel));
  empForm.appendChild(field(t('UI_CLI'), cliSel));
  empForm.appendChild(button(t('UI_ADD_EMP'), async () => {
    if (!roleId || !cliId) {
      showToast(t('ERR_CLI_REQUIRED'));
      return;
    }
    await act('emp.add', {
      name: empName.value.trim() || undefined,
      roleId,
      cliId
    });
  }));
  box.body.appendChild(empForm);

  const employees = state.employees.map((emp) => [emp.name, emp.roleName, emp.cliId, String(emp.maxConcurrentSessions)]);
  box.body.appendChild(el('h3', 'sub', t('COL_EMPLOYEES')));
  box.body.appendChild(table(
    [t('COL_NAME'), t('COL_ROLE'), t('COL_CLI'), t('COL_MAX')],
    employees,
    t('NO_EMPLOYEES')
  ));
  return box;
}

function stepTeam(state) {
  const box = card(t('UI_STEP_TEAM'), `${state.teams.length}`);
  const rows = state.teams.map((team) => [
    team.name,
    team.leadName,
    String(team.roleCount),
    String(team.employeeCount),
    state.runModeLabels?.[team.runMode] ?? team.runMode,
    team.flowId ?? '-',
    team.ready ? badge(t('UI_READY'), 'ok') : badge(t('UI_BLOCKED'), 'warn')
  ]);
  box.body.appendChild(table(
    [t('COL_NAME'), t('UI_LEAD'), t('COL_ROLES'), t('COL_EMPLOYEES'), t('UI_RUN_MODE'), t('UI_FLOW'), t('COL_STATUS')],
    rows,
    t('UI_EMPTY_TEAM')
  ));

  if (state.roles.length === 0) {
    box.body.appendChild(el('p', 'hint', t('UI_EMPTY_ROLE')));
    return box;
  }

  const form = el('div', 'form-row');
  const name = input(t('UI_NAME'));
  let lead = state.roles.find((role) => role.code === 'eng-lead')?.id ?? state.roles[0].id;
  const leadSel = select(
    state.roles.map((role) => ({ value: role.id, label: role.name })),
    lead,
    (value) => { lead = value; }
  );
  let flowId = state.flows[0]?.id ?? '';
  const flowSel = select(
    state.flows.map((flow) => ({ value: flow.id, label: flow.name })),
    flowId,
    (value) => { flowId = value; },
    t('UI_SELECT_PLACEHOLDER')
  );
  let runMode = 'semi';
  const modeSel = select(
    (state.runModes ?? ['auto', 'semi', 'manual']).map((value) => ({
      value,
      label: state.runModeLabels?.[value] ?? value
    })),
    runMode,
    (value) => { runMode = value; }
  );

  form.appendChild(field(t('UI_NAME'), name));
  form.appendChild(field(t('UI_LEAD'), leadSel));
  form.appendChild(field(t('UI_FLOW'), flowSel));
  form.appendChild(field(t('UI_RUN_MODE'), modeSel));
  form.appendChild(button(t('UI_CREATE_TEAM'), async () => {
    if (!name.value.trim()) {
      showToast(t('ERR_TEAM_NAME_REQUIRED'));
      return;
    }
    await act('team.create', {
      name: name.value.trim(),
      leadRoleId: lead,
      roleIds: state.roles.map((role) => role.id),
      flowId: flowId || null,
      runMode
    });
  }));
  box.body.appendChild(form);
  return box;
}

function stepFlow(state) {
  const box = card(t('UI_STEP_FLOW'), `${state.flows.length}`);
  const rows = state.flows.map((flow) => [
    flow.name,
    flow.kind,
    String(flow.stageCount),
    String(flow.gates.length),
    flow.stages.some((stage) => stage.gate) ? t('GATE_PRD_FREEZE') + '…' : t('GATE_NONE')
  ]);
  box.body.appendChild(table(
    [t('COL_NAME'), 'kind', t('COL_STAGE'), t('COL_GATE'), t('GATE_PENDING')],
    rows,
    t('UI_EMPTY_FLOW')
  ));

  for (const flow of state.flows) {
    const detail = el('details', 'flow-detail');
    detail.appendChild(el('summary', null, `${flow.name} · ${flow.stageCount}`));
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
    box.body.appendChild(detail);
  }

  const form = el('div', 'form-row');
  const name = input(t('UI_NAME'));
  const custom = el('textarea', 'input textarea');
  custom.placeholder = t('UI_CUSTOM_FLOW_HINT');
  form.appendChild(field(t('UI_NAME'), name));
  form.appendChild(button(t('UI_CREATE_FLOW'), async () => {
    await act('flow.create', { name: name.value.trim() || undefined, template: 'rd-12' });
  }));
  box.body.appendChild(form);

  const customRow = el('div', 'form-row');
  customRow.appendChild(field(t('UI_STAGES'), custom));
  customRow.appendChild(button(t('UI_CREATE_FLOW'), async () => {
    const stages = String(custom.value ?? '')
      .split('|')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [id, roles] = chunk.split(':').map((part) => (part ?? '').trim());
        return { id, roleCodes: String(roles ?? '').split(',').map((r) => r.trim()).filter(Boolean) };
      });
    if (stages.length === 0) {
      showToast(t('ERR_FLOW_SPEC_REQUIRED'));
      return;
    }
    const edges = stages.slice(1).map((stage, index) => ({ from: stages[index].id, to: stage.id }));
    await act('flow.create', { name: name.value.trim() || undefined, stages, edges });
  }, 'btn ghost'));
  box.body.appendChild(el('p', 'hint', t('UI_CUSTOM_FLOW_HINT')));
  box.body.appendChild(customRow);
  return box;
}

function stepRun(state) {
  const box = card(t('UI_STEP_RUN'), `${state.runs.length}`);

  if (state.teams.length > 0) {
    const form = el('div', 'form-row');
    let teamId = state.teams[0].id;
    const teamSel = select(
      state.teams.map((team) => ({ value: team.id, label: team.name })),
      teamId,
      (value) => { teamId = value; }
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
    form.appendChild(button(t('UI_START_RUN'), async () => {
      await act('run.start', { teamId, mode });
    }, 'btn primary'));
    box.body.appendChild(form);
  }

  if (state.runs.length === 0) {
    box.body.appendChild(el('p', 'empty', t('UI_EMPTY_RUN')));
    return box;
  }

  for (const run of state.runs.slice(0, 5)) {
    const line = el('div', 'run-head');
    line.appendChild(el('strong', null, run.id));
    line.appendChild(badge(`${run.progress.done}/${run.progress.total}`, 'ok'));
    line.appendChild(badge(run.status, run.status === 'completed' ? 'ok' : run.status === 'blocked' ? 'warn' : ''));
    line.appendChild(el('span', 'card-sub', `${run.mode} · ${run.teamId} · ${run.flowId}`));
    box.body.appendChild(line);

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
    box.body.appendChild(table(
      [t('COL_STAGE'), t('COL_NAME'), t('COL_STATUS'), t('COL_ARTIFACTS'), t('COL_GATE'), ''],
      stageRows,
      ''
    ));
    box.body.appendChild(el('p', 'hint', t('UI_RUNNING_HINT')));
  }
  return box;
}

function stepTask(state) {
  const box = card(t('UI_STEP_TASK'), `${state.tasks.length}`);

  const rows = state.tasks.slice(-30).map((task) => [
    task.id,
    task.stageId ?? '-',
    task.status,
    task.roleId ?? '-'
  ]);
  box.body.appendChild(table(
    [t('COL_ID'), t('COL_STAGE'), t('COL_STATUS'), t('COL_ROLE')],
    rows,
    t('TASK_NO_TASKS')
  ));

  const run = state.runs[0] ?? null;
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

  if ((state.changes ?? []).length > 0) {
    box.body.appendChild(el('h3', 'sub', t('UI_CHANGE')));
    box.body.appendChild(table(
      [t('COL_ID'), t('COL_STAGE'), t('COL_STATUS')],
      state.changes.map((change) => [change.id, change.stageId ?? '-', change.status]),
      ''
    ));
  }
  return box;
}

function render() {
  app.replaceChildren();
  if (!S) return;
  document.getElementById('root').textContent = S.root ?? '';
  app.appendChild(stepCli(S));
  app.appendChild(stepOrg(S));
  app.appendChild(stepTeam(S));
  app.appendChild(stepFlow(S));
  app.appendChild(stepRun(S));
  app.appendChild(stepTask(S));

  const issues = el('section', 'card issues');
  issues.appendChild(el('div', 'card-head')).appendChild(el('h2', null, t('UI_WARNINGS')));
  const body = el('div', 'card-body');
  const list = [
    ...(S.readiness?.errors ?? []).map((item) => ({ tone: 'err', text: item.code, params: item.params })),
    ...(S.readiness?.warnings ?? []).map((item) => ({ tone: 'warn', text: item.code, params: item.params }))
  ];
  if (list.length === 0) body.appendChild(el('p', 'hint', t('UI_READY')));
  for (const item of list) {
    body.appendChild(el('p', `issue ${item.tone}`, `${item.text} ${JSON.stringify(item.params ?? {})}`));
  }
  issues.appendChild(body);
  app.appendChild(issues);
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
  document.getElementById('btn-demo').title = t('UI_DEMO_HINT2', '');
  setLoading('');
  render();
}

async function demo() {
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
}

document.getElementById('btn-scan').addEventListener('click', async () => {
  await act('cli.scan', {}, t('SCAN_DONE', ''));
});
document.getElementById('btn-demo').addEventListener('click', demo);
document.getElementById('btn-refresh').addEventListener('click', load);

if (!token()) {
  app.replaceChildren(el('p', 'empty', 'TOKEN'));
  setLoading('TOKEN');
} else {
  load().catch((err) => {
    app.replaceChildren(el('p', 'empty', String(err?.message ?? err)));
  });
}
