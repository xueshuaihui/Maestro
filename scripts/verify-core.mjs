#!/usr/bin/env node
/**
 * Pre-release core-journey verification (v2 beta.4 gate).
 *
 * One command that replays exactly what a user does in the Studio page, in an
 * isolated temp project:
 *
 *   scan CLI -> seed org -> create 12-stage flow -> create team ->
 *   run (semi) -> hit PRD gate -> approve x3 -> complete ->
 *   compile engine assets -> engine-side schema validation ->
 *   QA requirement-gap loop -> knowledge-base artifacts
 *
 * Exit code 0 only when every step passes. No network, no real model, no
 * writes inside the repository (the fixture root lives under os.tmpdir()).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORCH = path.join(REPO, 'bin', 'orch.js');

const steps = [];

// Isolate `~/.maestro/*` (project registry) so the check never touches the
// user's real list of projects.
const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-home-'));

function orch(root, args) {
  const result = spawnSync(process.execPath, [ORCH, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', HOME: fixtureHome }
  });
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function step(name, fn) {
  const started = Date.now();
  let outcome;
  try {
    outcome = fn();
  } catch (err) {
    outcome = { ok: false, detail: `threw: ${err?.message ?? err}` };
  }
  steps.push({ name, ok: outcome.ok, detail: outcome.detail ?? '', ms: Date.now() - started });
  const mark = outcome.ok ? 'PASS' : 'FAIL';
  process.stdout.write(`[${mark}] ${name}${outcome.detail ? ` — ${outcome.detail}` : ''}\n`);
  return outcome;
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-core-'));
  process.stdout.write(`fixture: ${root}\n`);

  step('A1 CLI 扫描（本机）', () => {
    const r = orch(root, ['cli', 'scan']);
    return { ok: r.code === 0, detail: r.stdout.trim().split('\n')[0] ?? '' };
  });

  let cliId = 'unbound';
  step('A2 组织种子（23 角色）', () => {
    const scan = json(orch(root, ['cli', 'list', '--format', 'json']).stdout);
    const list = Array.isArray(scan) ? scan : (scan?.clis ?? []);
    cliId = list.find((cli) => cli.executable)?.cli_id ?? list[0]?.cli_id ?? 'unbound';
    const r = orch(root, ['org', 'seed', '--cli', cliId, '--per', '2']);
    const roles = json(orch(root, ['org', 'role', 'list', '--format', 'json']).stdout) ?? [];
    const employees = json(orch(root, ['org', 'emp', 'list', '--format', 'json']).stdout) ?? [];
    return {
      ok: r.code === 0 && roles.length === 23 && employees.length >= 23,
      detail: `角色 ${roles.length} / 员工 ${employees.length} / CLI ${cliId}`
    };
  });

  step('A4 12 阶段工作流', () => {
    const r = orch(root, ['flow', 'create', '--name', 'rd', '--template', 'rd-12', '--run-mode', 'semi']);
    const flow = json(orch(root, ['flow', 'show', 'rd-12', '--format', 'json']).stdout);
    return {
      ok: r.code === 0 && flow?.stages?.length === 12 && flow?.gates?.length === 3,
      detail: `阶段 ${flow?.stages?.length ?? 0} / 门禁 ${flow?.gates?.length ?? 0}`
    };
  });

  let teamName = 'core-team';
  step('A3 团队搭出并校验就绪', () => {
    const roles = json(orch(root, ['org', 'role', 'list', '--format', 'json']).stdout) ?? [];
    const codes = roles.map((role) => role.code).filter(Boolean).join(',');
    const created = orch(root, [
      'team', 'create', '--name', teamName, '--lead', 'eng-lead', '--roles', codes,
      '--flow', 'rd-12', '--run-mode', 'semi'
    ]);
    const check = orch(root, ['team', 'check', teamName]);
    return {
      ok: created.code === 0 && check.code === 0,
      detail: (check.stdout.trim().split('\n').pop() ?? '').slice(0, 80)
    };
  });

  let runId = null;
  step('A5 运行被门禁拦截（半自动）', () => {
    const r = orch(root, ['studio', 'run', '--team', teamName, '--mode', 'simulate']);
    const runs = json(orch(root, ['studio', 'list', '--format', 'json']).stdout) ?? [];
    runId = runs[0]?.id ?? null;
    return {
      ok: r.code === 0 && /门禁拦截/.test(r.stdout),
      detail: runId ? `${runId} 停在首道门禁` : '未生成运行记录'
    };
  });

  step('A6 需求缺失回退产品评审', () => {
    const r = orch(root, ['task', 'change', '--run', runId, '--stage', 's08', '--summary', 'acceptance missing']);
    const state = json(orch(root, ['studio', 'show', runId, '--format', 'json']).stdout);
    const changes = (json(orch(root, ['task', 'list', '--format', 'json']).stdout) ?? []);
    void state;
    void changes;
    return { ok: r.code === 0 && /退回产品评审/.test(r.stdout), detail: r.stdout.trim().split('\n').pop() ?? '' };
  });

  step('A5 逐级批准三道门禁后完成', () => {
    let completed = false;
    for (let i = 0; i < 5; i += 1) {
      const runs = json(orch(root, ['studio', 'list', '--format', 'json']).stdout) ?? [];
      const run = runs.find((item) => item.id === runId);
      if (run?.status === 'completed') {
        completed = true;
        break;
      }
      orch(root, ['studio', 'approve', runId]);
    }
    const runs = json(orch(root, ['studio', 'list', '--format', 'json']).stdout) ?? [];
    const run = runs.find((item) => item.id === runId);
    return {
      ok: completed && run?.stages?.every((stage) => stage.status === 'done'),
      detail: `${run?.stages?.filter((stage) => stage.status === 'done').length ?? 0}/${run?.stages?.length ?? 0} 阶段完成`
    };
  });

  step('A5 知识库产物落盘', () => {
    const dir = path.join(root, '.orch', 'kb', runId ?? '');
    if (!fs.existsSync(dir)) return { ok: false, detail: '知识库目录不存在' };
    const count = (function walk(current) {
      return fs.readdirSync(current, { withFileTypes: true }).reduce((sum, entry) => (
        entry.isDirectory() ? sum + walk(path.join(current, entry.name)) : sum + 1
      ), 0);
    })(dir);
    return { ok: count >= 20, detail: `${count} 个产物文件` };
  });

  step('A6 任务全部完成', () => {
    const tasks = json(orch(root, ['task', 'list', '--format', 'json']).stdout) ?? [];
    const done = tasks.filter((task) => task.status === 'done').length;
    return { ok: tasks.length === 12 && done === 12, detail: `${done}/${tasks.length}` };
  });

  step('B 引擎资产编译 + 引擎侧 schema 校验', () => {
    const compiled = orch(root, ['studio', 'compile', '--team', teamName]);
    if (compiled.code !== 0) return { ok: false, detail: compiled.stdout.trim().split('\n').pop() ?? '' };
    const roleDir = path.join(root, '.orch', 'roles');
    const roles = fs.existsSync(roleDir) ? fs.readdirSync(roleDir).filter((f) => f.endsWith('.yaml')) : [];
    const bad = roles.filter((file) => {
      const id = file.replace(/\.yaml$/, '');
      const r = orch(root, ['role', 'validate', id]);
      return r.code !== 0;
    });
    const flowCheck = orch(root, ['workflow', 'validate', 'rd-12']);
    return {
      ok: roles.length >= 12 && bad.length === 0 && flowCheck.code === 0,
      detail: `角色 ${roles.length} 个（不合规 ${bad.length}），工作流校验 ${flowCheck.code === 0 ? '通过' : '失败'}`
    };
  });

  step('D 多项目登记', () => {
    const added = orch(root, ['project', 'add', '.', '--name', 'fixture']);
    const listed = json(orch(root, ['project', 'list', '--format', 'json']).stdout);
    return { ok: added.code === 0 && (listed?.projects?.length ?? 0) >= 1, detail: `${listed?.projects?.length ?? 0} 个项目` };
  });

  const failed = steps.filter((s) => !s.ok);
  process.stdout.write(`\ncore journey: ${steps.length - failed.length}/${steps.length} steps passed\n`);
  if (failed.length > 0) {
    process.stdout.write(`failed: ${failed.map((s) => s.name).join(' | ')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('CORE_JOURNEY_OK\n');
  if (process.env.MAESTRO_KEEP_FIXTURE !== '1') {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(fixtureHome, { recursive: true, force: true });
  } else {
    process.stdout.write(`fixture kept: ${root}\n`);
  }
}

await main();
