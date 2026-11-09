/**
 * WP-2 / AC-07：多节点提示词末尾的「工作区上下文」段（需求附录 A-6）。
 *
 * 追加段的四行文案按 requirement.md:1383-1387 的样例逐字硬编码，不从
 * src/templates/index.js 的 WORKSPACE_CONTEXT_LINES 反推预期。生产派发路径
 * 「必须带 graph」用静态源码断言锁定（A-6:1392 / AC-07 机检）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PROMPT_TEMPLATES,
  defaultGraph,
  getGraph,
  promptFor
} from '../../src/templates/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const WS = '/abs/path/.orch/instances/INST-001/workspace';
const TASK = '实现 calc.js，产物：calc.js';

const codeLoop = getGraph('code-loop');
const taskLoop = getGraph('task-loop');
const nodeOf = (graph, id) => graph.nodes.find((item) => item.id === id);

/** A-6 段前必须是空一行；返回追加段按行拆分（保证正文一字未改）。 */
function contextTail(body, full) {
  assert.ok(full.startsWith(body), 'A-6 不得改动模板正文');
  const rest = full.slice(body.length);
  assert.equal(rest.slice(0, 2), '\n\n', 'A-6 段前必须空一行（两个换行）');
  return rest.slice(2).split('\n');
}

test('A-6 追加段逐字对齐需求样例：四行文案 + 路径格式（空一行 + 4 行）', () => {
  const node = nodeOf(codeLoop, 'T-002');
  const handoff = { edge: { from: 'T-001', to: 'T-002', kind: 'forward' } };
  const body = promptFor({ node, handoff, task: TASK });
  const full = promptFor({ graph: codeLoop, node, handoff, task: TASK, workspaceDir: WS });
  // requirement.md:1383-1387 的四行，按 WS / T-002 / T-001 填充。
  assert.deepEqual(contextTail(body, full), [
    `工作区：${WS}`,
    `共享区（只读）：${WS}/shared`,
    `本节点阶段区：${WS}/stage/T-002`,
    `上游阶段区（只读）：${WS}/stage/T-001`
  ]);
});

test('A-6 入口节点（无上游交接包）：只追加前三行，逐字', () => {
  const node = nodeOf(codeLoop, 'T-001');
  const body = promptFor({ node, task: TASK });
  const full = promptFor({ graph: codeLoop, node, task: TASK, workspaceDir: WS });
  assert.deepEqual(contextTail(body, full), [
    `工作区：${WS}`,
    `共享区（只读）：${WS}/shared`,
    `本节点阶段区：${WS}/stage/T-001`
  ]);
  assert.equal(full.includes('上游阶段区'), false, '入口不得出现上游阶段区行');
});

test('A-6 非入口且只传 handoff：由 graph 解析目标节点，四行逐字', () => {
  // 生产调用形态之一：不传 node，靠 graph + handoff.edge.to 解析目标（A-6:1395）。
  const text = promptFor({
    graph: taskLoop,
    handoff: { edge: { from: 'T-003', to: 'T-002', kind: 'backflow' } },
    task: TASK,
    defects: [{ summary: '缺少回滚方案', evidence: 'artifacts/docs/x.v1.md#L1' }],
    revisionRequirement: '补写回滚方案',
    researchRef: 'artifacts/reports/research-notes.v1.md',
    previousRef: 'artifacts/docs/x.v1.md',
    docRef: 'artifacts/docs/x.v2.md',
    writePath: `${WS}/artifacts/docs/x.v2.md`,
    workspaceDir: WS,
    round: 2
  });
  assert.ok(text.includes('上一轮审核不通过'), '正文仍为撰写回流模板');
  assert.ok(
    text.endsWith(
      `\n\n工作区：${WS}\n` +
        `共享区（只读）：${WS}/shared\n` +
        `本节点阶段区：${WS}/stage/T-002\n` +
        `上游阶段区（只读）：${WS}/stage/T-003`
    )
  );
});

test('A-6 审核模板正文已含工作区行：不重复该行，只追加后三行', () => {
  const node = nodeOf(taskLoop, 'T-003');
  const handoff = { edge: { from: 'T-002', to: 'T-003', kind: 'forward' } };
  const vars = { node, handoff, task: TASK, docRef: 'artifacts/docs/x.v1.md', workspaceDir: WS, round: 1 };
  const body = promptFor(vars);
  const full = promptFor({ graph: taskLoop, ...vars });
  assert.ok(body.includes(`\n工作区：${WS}\n`), '审核模板正文自带工作区行');
  assert.deepEqual(contextTail(body, full), [
    `共享区（只读）：${WS}/shared`,
    `本节点阶段区：${WS}/stage/T-003`,
    `上游阶段区（只读）：${WS}/stage/T-002`
  ]);
  // AC-07 机检：审核提示词中的工作区行只有一条。
  assert.equal(full.split('工作区：').length - 1, 1);
});

test('single 图只有 1 个节点：不追加，提示词逐字不变（I1.1 / A-6:1390）', () => {
  const single = defaultGraph();
  assert.equal(single.nodes.length, 1);
  const text = promptFor({ graph: single, task: TASK, workspaceDir: WS });
  assert.equal(text, `${TASK}\n\n完成后直接结束，不需要额外说明。`);
  assert.equal(text.includes('工作区：'), false);
  assert.equal(text.includes('共享区'), false);
});

test('只传 node、不带 graph：不追加，输出与 I1.2 / I1.3 逐字一致', () => {
  const research = promptFor({
    node: nodeOf(taskLoop, 'T-001'),
    task: TASK,
    writePath: `${WS}/artifacts/reports/research-notes.v1.md`,
    workspaceDir: WS
  });
  assert.equal(
    research,
    `${TASK}\n\n研究笔记：artifacts/reports/research-notes.v1.md\n` +
      `写入路径：${WS}/artifacts/reports/research-notes.v1.md\n只交研究笔记，不写最终文档。`
  );
  assert.equal(research.includes('工作区：'), false);

  const backflow = promptFor({
    node: nodeOf(codeLoop, 'T-001'),
    handoff: { edge: { from: 'T-002', to: 'T-001', kind: 'backflow' } },
    task: TASK,
    defects: [{ summary: 'division by zero', evidence: 'out/log.txt' }],
    retestRequirement: 'guard b === 0',
    workspaceDir: WS
  });
  assert.equal(
    backflow,
    `${TASK}\n\n上一轮判定不通过，请按下列缺陷修正：\n` +
      '缺陷 1：division by zero（证据 out/log.txt）\n复测要求：guard b === 0'
  );
  assert.equal(backflow.includes('共享区'), false);
});

test('graph 多节点但 workspaceDir 为空或缺失：不追加', () => {
  const node = nodeOf(codeLoop, 'T-001');
  const body = promptFor({ node, task: TASK });
  const missing = promptFor({ graph: codeLoop, node, task: TASK });
  const empty = promptFor({ graph: codeLoop, node, task: TASK, workspaceDir: '' });
  assert.equal(missing, body);
  assert.equal(empty, body);
  assert.equal(missing.includes('工作区：'), false);
  assert.equal(empty.includes('共享区'), false);
});

test('A-6 段不进 PROMPT_TEMPLATES：模板表一字未改（A-6:1394）', () => {
  assert.equal(PROMPT_TEMPLATES.single, '{task}\n\n完成后直接结束，不需要额外说明。');
  assert.equal(PROMPT_TEMPLATES.forward, '{task}');
  for (const [key, template] of Object.entries(PROMPT_TEMPLATES)) {
    for (const seg of ['共享区（只读）', '本节点阶段区', '上游阶段区（只读）']) {
      assert.equal(template.includes(seg), false, `${key} 不应含 A-6 段 ${seg}`);
    }
  }
  // 审核模板正文自带的工作区占位行是 I1.3 既有文案，不是 A-6 追加段。
  assert.ok(PROMPT_TEMPLATES.review.includes('工作区：{workspaceDir}'));
});

test('A-6 路径格式：尾斜杠与反斜杠归一为 / 分隔的绝对路径', () => {
  const node = nodeOf(codeLoop, 'T-001');
  const trailing = promptFor({ graph: codeLoop, node, task: TASK, workspaceDir: `${WS}/` });
  assert.ok(trailing.includes(`共享区（只读）：${WS}/shared\n`));
  assert.equal(trailing.includes(`${WS}//shared`), false);

  const windows = promptFor({
    graph: codeLoop,
    node,
    task: TASK,
    workspaceDir: 'D:\\tmp\\inst\\workspace'
  });
  assert.ok(windows.includes('共享区（只读）：D:/tmp/inst/workspace/shared'));
});

/**
 * 抽出源码里每个 promptFor({...}) 调用的参数对象（含行号、是否带 graph 键）。
 * 各调用点的参数值均为变量或表达式，无含花括号的字符串字面量，可用花括号
 * 平衡计数精确配对；字符串内容一律跳过，防止引号里的花括号干扰计数。
 */
function promptForCalls(source) {
  const marker = 'promptFor({';
  const calls = [];
  let from = 0;
  for (;;) {
    const idx = source.indexOf(marker, from);
    if (idx < 0) break;
    const brace = idx + 'promptFor('.length;
    let depth = 0;
    let end = brace;
    let quote = null;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (quote !== null) {
        if (ch === '\\') {
          end++;
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    const objectText = source.slice(brace, end);
    // workspaceDir may be shorthand (`workspaceDir,`) or a key with a value
    // (`workspaceDir: workspaceDirOf(state)`); an empty literal does not count.
    const wd =
      /(?:^|[,{\s])workspaceDir\s*:\s*([^,\n}]+)/.exec(objectText) ??
      /(?:^|[,{\s])workspaceDir\s*,/.exec(objectText);
    const wdValue = wd ? (wd[1] ?? 'workspaceDir').trim() : null;
    calls.push({
      start: idx,
      line: source.slice(0, idx).split('\n').length,
      hasGraph: /(?:^|[,{\s])graph\s*[,:]/.test(objectText),
      hasWorkspaceDir: wdValue !== null && !["''", '""', 'null', 'undefined'].includes(wdValue)
    });
    from = end;
  }
  return calls;
}

/** 调用点之前最近的具名函数，用于识别 A-6 豁免的单元构造调用。 */
function ownerOf(source, startIndex) {
  const re = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let owner = null;
  let match;
  while ((match = re.exec(source)) !== null) {
    if (match.index > startIndex) break;
    owner = match[1];
  }
  return owner;
}

const RELS = ['src/core/advance.js', 'src/core/orchestrator.js'];

test('A-6 生产派发路径必须带 graph 与非空 workspaceDir（A-6:1392 / AC-07 机检）', () => {
  const sources = {};
  const sites = [];
  for (const rel of RELS) {
    const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    sources[rel] = source;
    for (const call of promptForCalls(source)) sites.push({ file: rel, ...call });
  }

  // 遍历全部 promptFor 调用点做结构断言，不按文件硬编码数量：未来新增合规
  // 调用点（如 WP-6 的 retryPromptText）不会假红。强度不降：漏传 graph、
  // 漏传 workspaceDir、多出豁免点、生产调用点被删到 4 个以下都会被抓到。
  const unit = sites.filter((s) => !s.hasGraph);

  // A-6:1391 豁免：graph=false 的调用点恰好 1 个，且落在 advance.js 的
  // buildBackflowHandoff 内（只传 node 的单元构造调用，不追加 A-6 段）。
  assert.equal(unit.length, 1, `graph=false 豁免点应恰好 1 个，实际 ${unit.length}`);
  const exempt = unit[0];
  assert.equal(exempt.file, 'src/core/advance.js');
  assert.equal(
    ownerOf(sources['src/core/advance.js'], exempt.start),
    'buildBackflowHandoff'
  );

  // AC-07 硬要求：其余每个调用点都必须带 graph 且带非空 workspaceDir，
  // 否则 A-6「工作区上下文」段会被整段丢掉。逐点校验，不用总数代替。
  const prod = sites.filter((s) => s !== exempt);
  for (const site of prod) {
    assert.equal(site.hasGraph, true, `${site.file}:${site.line} 漏传 graph`);
    assert.equal(site.hasWorkspaceDir, true,
      `${site.file}:${site.line} 的 graph=true 生产调用漏传 workspaceDir`);
  }

  // 兜底：只防「调用点被整体删光」，不替代上面的逐点校验。
  assert.ok(prod.length >= 5, `graph=true 生产调用点不应少于 5，实际 ${prod.length}`);
});

test('A-6 豁免证据：buildBackflowHandoff 的 promptText 不进入生产派发', () => {
  // 全 src 内除 advance.js 自身定义外没有 buildBackflowHandoff 的调用者，
  // 它仅由 test/templates/fake-graph.test.js 直接单测，故不带 graph 不影响 A-6。
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));
  const own = path.join(ROOT, 'src/core/advance.js');
  const callers = files.filter(
    (file) => file !== own && fs.readFileSync(file, 'utf8').includes('buildBackflowHandoff')
  );
  assert.deepEqual(callers, []);
});
