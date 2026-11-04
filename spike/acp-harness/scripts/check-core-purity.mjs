#!/usr/bin/env node
/**
 * 核心纯度检查（VP-1 的判定工具）。
 *
 * 编排循环与核心模块里出现宿主名 / transport 名 / 恢复方言名，就意味着抽象漏了。
 * 唯一允许的方言相关标识是适配器中性契约 `resumeOrCreate`（其内部实现差异在 src/client.mjs）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE_DIR = path.resolve(HERE, '../core');

export const FORBIDDEN = [
  'host',
  'transport',
  'stdio',
  'http',
  'sse',
  'dsh',
  'cursor',
  'workbuddy',
  'codex',
  'replay',
  'replayMode',
  'dialect',
];

export function checkCorePurity(dir = CORE_DIR) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  const hits = [];
  for (const file of files) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    // 注释里说明「不得出现 transport」是自证的，不算违规；只扫代码与字符串字面量
    const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
    code.split('\n').forEach((line, i) => {
      const lower = line.toLowerCase();
      for (const token of FORBIDDEN) {
        if (lower.includes(token)) hits.push({ file, line: i + 1, token, text: line.trim() });
      }
    });
  }
  return {
    coreDir: dir,
    files,
    forbiddenTokens: FORBIDDEN,
    hits,
    violations: hits.length,
    pass: hits.length === 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = checkCorePurity();
  process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  process.exit(r.pass ? 0 : 1);
}
