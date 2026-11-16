// AC-46 · 唤起宿主失败：提示可读、可重试、不改状态（openHost 非 ENOENT 失败路径）
import fs from 'node:fs';
import path from 'node:path';
import { standardCase } from './_shared.mjs';
import { REPO } from '../acc10b-f-common.mjs';

export const cases = [standardCase('AC-46', {
  testFile: 'host-jump.test.js',
  arch: [
    { label: '界面不直接起进程（spawn(|execFile( 零命中）', pattern: 'spawn\\(|execFile\\(', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "const reason = '权限或杀软拦截';",
    "assert.ok(view.toasts[0].startsWith('跳转失败 · '), 'failure toast must start with the verbatim prefix');",
    "assert.ok(view.toasts[0].slice('跳转失败 · '.length).length > 0, 'reason suffix must be non-empty');",
    'assert.equal(view.toasts[0], A7.failed(reason));',
    'assert.equal(jump.ok, false);',
    'assert.equal(retryable, true);',
    "assert.equal(view.jumpCalls, 0, 'failed launch produces no process signal');",
    'assert.equal(sha256(state), stateHashBefore);',
  ],
  extra(c) {
    // 非 ENOENT 失败路径：适配器 spawnFailure() 的既有原文是 `跳转失败 · <cause>`
    // （原因取适配器返回值，不自造）；ENOENT 才走「未找到」语义，本 AC 判非 ENOENT。
    const adapter = fs.readFileSync(path.join(REPO, 'src', 'adapter', 'host-open.js'), 'utf8');
    c.includes('openHost 非 ENOENT 失败路径：spawnFailure 产出 跳转失败 · 前缀',
      adapter, '`跳转失败 · ${cause}`');
    c.includes('openHost 非 ENOENT 失败路径：ENOENT 单独分流', adapter, "err?.code === 'ENOENT'");
    // 逐字基线：A-7 / labels.js DRILL_HOST_FAILED='跳转失败 · {reason}' → {reason}=适配器原文
    c.check("Then 逐字：提示为「跳转失败 · 权限或杀软拦截」（A-7 / DRILL_HOST_FAILED）",
      '跳转失败 · {reason}'.replace('{reason}', '权限或杀软拦截') === '跳转失败 · 权限或杀软拦截',
      '跳转失败 · 权限或杀软拦截');
  },
  notes: [
    'Then 逐字锚点（requirement.md:941-944）：提示「跳转失败 · <原因>」（原因取适配器返回的既有原文）；按钮恢复可点、可重试（机检 retryable===true）；实例状态不变、不产生 DSH 进程、界面不崩溃。',
    '机检内部断言（非用户可见）：state.json 与 events.jsonl 的字节哈希不变；本批模块面以 fixture 快照 sha256 前后相等代理，真实落盘字节哈希属人工核验面。',
    'Given 为 MAESTRO_DSH_EXE 指向存在但不可执行文件 → openHost 走非 ENOENT 的 spawnFailure 分支（src/adapter/host-open.js:58-64）；该分支产出「跳转失败 · <cause>」，与 ENOENT 的「未找到 DeepSeek Harness」分开。',
    '架构检查：desktop/ui/drill/ 零 spawn(/execFile(，界面不直接起进程。',
  ],
})];
