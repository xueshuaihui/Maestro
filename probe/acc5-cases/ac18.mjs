// AC-18 模板角色全在注册表且中文名一致（架构检查）
// 需求原文：由 test/wp11/assets.test.js 的两个对照用例承担；本用例跑该用例 + 独立复算同一判定。
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  makeCase, freshRoot, nodeTest, REPO, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-18';

const SEVEN = ['worker', 'developer', 'tester', 'researcher', 'writer', 'reviewer', 'coordinator'];
const SIX = ['developer', 'tester', 'researcher', 'writer', 'reviewer', 'coordinator'];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    const root = freshRoot(AC);
    c.add(root); // 独立根占位；本用例不启核心、不建实例

    // ① 需求指定的载体：test/wp11/assets.test.js 的两个对照用例
    const suite = c.cmd(nodeTest(['test/wp11/assets.test.js'], { timeout: 120000 }), 'node --test test/wp11/assets.test.js');
    const out = text(suite);
    c.evText('assets-test', out);
    const mTests = /^# tests (\d+)$/m.exec(out);
    const mFail = /^# fail (\d+)$/m.exec(out);
    c.eq('架构检查：assets.test.js 退出码 0', suite.exitCode, 0);
    c.eq('架构检查：fail = 0', Number(mFail?.[1] ?? -1), 0);
    c.check('架构检查：用例条数 ≥ 2（含两条对照用例）', Number(mTests?.[1] ?? -1) >= 2, String(mTests?.[1]));

    // ② 独立复算：直接读产品模块，不依赖测试文件的自述
    const templates = await import(pathToFileURL(path.join(REPO, 'src', 'templates', 'index.js')).href);
    const registryMod = await import(pathToFileURL(path.join(REPO, 'src', 'registry', 'index.js')).href);
    const labels = await import(pathToFileURL(path.join(REPO, 'src', 'cli', 'labels.js')).href);
    const registry = registryMod.loadRegistry({ root });

    const graphNodes = new Set();
    for (const graph of Object.values(templates.GRAPHS)) {
      for (const node of graph.nodes ?? []) graphNodes.add(node.roleId);
      for (const roleId of graph.roles ?? []) graphNodes.add(roleId);
    }
    const declared = [...Object.keys(templates.ROLES)];
    c.evJson('roles-cross-check', {
      graphRoleIds: [...graphNodes].sort(),
      rolesKeys: declared.sort(),
      registryIds: [...registry.roleMap.keys()].sort(),
      roleLabels: labels.ROLE_LABEL
    });

    for (const id of SEVEN) {
      c.check(`Then 图形/角色表里的 ${id} 存在于注册表`, registry.roleMap.has(id), String(registry.roleMap.has(id)));
    }
    const missingFromGraphs = [...graphNodes, ...declared].filter((id) => !registry.roleMap.has(id));
    c.deepEq('Then 三种模板的节点角色集合全部存在于注册表（缺口为空）', missingFromGraphs, []);

    // ③ 6 个既有角色的中文名与 ROLE_LABEL 逐字一致（worker 不在 ROLE_LABEL 里）
    const nameMismatch = [];
    for (const id of SIX) {
      const role = registry.roleMap.get(id);
      if (!role) { nameMismatch.push(`${id}:缺失`); continue; }
      if (role.name !== labels.ROLE_LABEL[id]) nameMismatch.push(`${id}:${role.name}≠${labels.ROLE_LABEL[id]}`);
    }
    c.deepEq('Then 6 个既有角色的中文名与 labels.js 的 ROLE_LABEL 逐字一致', nameMismatch, []);
    c.check('机检：worker 不在 ROLE_LABEL 里（只有 6 个既有角色在其中）',
      !Object.prototype.hasOwnProperty.call(labels.ROLE_LABEL, 'worker'),
      JSON.stringify(Object.keys(labels.ROLE_LABEL)));

    return finish(c);
  }
}];
