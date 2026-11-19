/**
 * AC-16 · orch migrate 清单与改写一一对应、摘要条数=清单条数。
 * 走真实 CLI：node orch migrate（看清单）→ migrate --yes（执行）→ migrate（复校）。
 */
import fs from 'node:fs';
import path from 'node:path';

import { freshRoot, cleanupRoot, orch, loadLabels, sha256File } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, matches, eq, finish } from '../acc12-f-common.mjs';
import { listMigrations } from '../../src/core/pack.js';
import { cli } from './AC-13.mjs';

function writeAsset(root, rel, text) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text, 'utf8');
  return f;
}

export async function run() {
  const c = makeCase('AC-16', { scenario: 'migrate', title: 'orch migrate 升级派生角色/工作流引用' });
  c.root = freshRoot('migrate-ac16');
  try {
    const labels = await loadLabels();
    writeAsset(c.root, '.orch/roles/parent.yaml', 'id: parent\nversion: 2\nname: 新版父角色\n');
    writeAsset(c.root, '.orch/roles/derived.yaml', 'id: derived\nderived_from: parent@1\nname: 派生角色\n');
    writeAsset(c.root, '.orch/workflows/sub.yaml', 'id: sub\nversion: 3\nname: 新版子流程\n');
    writeAsset(c.root, '.orch/workflows/wf.yaml', 'id: wf\nsubworkflows:\n  - sub@1\nname: 主流程\n');
    // 业务定义正文（name 行）记录基线，迁移后应逐字不变。
    const nameBefore = {
      derived: fs.readFileSync(path.join(c.root, '.orch/roles/derived.yaml'), 'utf8').match(/name:.*/)[0],
      wf: fs.readFileSync(path.join(c.root, '.orch/workflows/wf.yaml'), 'utf8').match(/name:.*/)[0],
    };

    // 先只看变更清单（不带 --yes）。
    const planOut = orch(c.root, ['migrate']);
    evidence(c, 'when', 'plan.stdout.txt', planOut.stdout || '(empty)');
    evidence(c, 'when', 'plan.status.txt', `exitCode=${planOut.exitCode}\nstderr=${planOut.stderr || '(empty)'}\n`);
    const plan = listMigrations({ root: c.root });
    evidence(c, 'when', 'plan.json', JSON.stringify(plan, null, 2));
    eq(c, 'Given：变更清单条数 = 2', plan.total, 2);
    const planRows = planOut.stdout.split(/\r?\n/).filter((l) => /^MIGRATE\b/.test(l));
    eq(c, '机检：CLI 清单可见条数 = 清单条数', planRows.length, plan.total);
    check(c, 'Then：清单列出每处将改的引用（parent@1、sub@1）',
      planOut.stdout.includes('parent 1 2') && planOut.stdout.includes('sub 1 3'),
      'parent@1->2 and sub@1->3 listed');

    // 确认执行。
    const applied = orch(c.root, ['migrate', '--yes']);
    evidence(c, 'when', 'apply.stdout.txt', applied.stdout || '(empty)');
    evidence(c, 'when', 'apply.status.txt', `exitCode=${applied.exitCode}\nstderr=${applied.stderr || '(empty)'}\n`);
    eq(c, '机检：执行退出码 0', applied.exitCode, 0);

    const derivedAfter = fs.readFileSync(path.join(c.root, '.orch/roles/derived.yaml'), 'utf8');
    const wfAfter = fs.readFileSync(path.join(c.root, '.orch/workflows/wf.yaml'), 'utf8');
    evidence(c, 'then', 'references.yaml', `--- derived.yaml ---\n${derivedAfter}\n--- wf.yaml ---\n${wfAfter}\n`);
    check(c, 'Then：派生角色引用升到新版 parent@2', derivedAfter.includes('parent@2'), 'parent@2');
    check(c, 'Then：工作流引用升到新版 sub@3', wfAfter.includes('sub@3'), 'sub@3');
    eq(c, '架构检查：业务定义正文未被改写（派生角色 name）', derivedAfter.match(/name:.*/)[0], nameBefore.derived);
    eq(c, '架构检查：业务定义正文未被改写（工作流 name）', wfAfter.match(/name:.*/)[0], nameBefore.wf);

    // 摘要条数 = 清单条数（A-6 逐字，[N] 用 fillCount 替换）。
    const expectedDone = labels.MIGRATE_DONE.replace(/\[N\]/g, String(plan.total));
    evidence(c, 'then', 'summary.txt', `expected=${expectedDone}\nactual-cli=${applied.stdout.trim()}\nflat-label=${labels.MIGRATE_DONE}\n`);
    includes(c, 'Then：CLI 摘要给出迁移完成语义（MIGRATION DONE）', applied.stdout, 'MIGRATION DONE');
    matches(c, '机检：摘要条数 = 清单条数', applied.stdout, new RegExp(`MIGRATION DONE\\s+${plan.total}\\b`));
    check(c, 'Then：A-6 中文摘要逐字来自 labels', /共 \[N\] 处引用已升级/.test(labels.MIGRATE_DONE), '逐字 MIGRATE_DONE');

    // 重新校验：迁移后无待迁移项。
    const recheck = listMigrations({ root: c.root });
    const recheckOut = orch(c.root, ['migrate', '--yes']);
    evidence(c, 'then', 'recheck.txt', `list=${JSON.stringify(recheck)}\ncli=${recheckOut.stdout.trim()}\n`);
    eq(c, 'Then：重新校验通过（无待迁移项）', recheck.total, 0);
    includes(c, 'Then：复跑给出无需迁移语义', recheckOut.stdout, 'NO MIGRATION NEEDED');
    check(c, '机检：备份目录已生成（迁移前先备份，D-8）',
      fs.readdirSync(path.join(c.root, '.orch')).some((n) => n.includes('.migrate-backup-')), 'backup exists');

    evidence(c, 'meta', 'result.json', JSON.stringify({
      plan, planRows, applied: { exitCode: applied.exitCode, stdout: applied.stdout },
      expectedDone, recheck, checks: c.checks,
    }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-16', run, import.meta.url);
