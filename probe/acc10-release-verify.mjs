#!/usr/bin/env node
/**
 * 发布面只读校验器——需求 AC-38~AC-43（§2.16「验收工具」）。
 *
 * 纪律：
 * 1. **只读**：只发 GET，不改远端任何状态。
 * 2. **不写死期望值**：资产名与字节数一律从响应体推导，不预置清单。
 * 3. **凭据不入证据**：令牌从 `git credential fill` 现取，只用于 Authorization 头，
 *    不打印、不落盘；证据里只保留响应体的脱敏副本。
 * 4. 判定逻辑是**纯函数**并导出，供 `test/wp13/release-contract.test.js` 单测覆盖
 *    （给定模拟响应体 → 给定判定），避免「校验器自己错了也不知道」。
 *
 * 用法：
 *   node probe/acc10-release-verify.mjs <tag> --check publish|assets|gating|channel|draft|absent|idempotent
 *        [--repo owner/name] [--out <dir>] [--dir <下载目录>] [--baseline <非草稿数>]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REPO = 'xueshuaihui/Maestro';
const SUMS = 'SHA256SUMS.txt';
const PLATFORM_PATTERNS = [
  { label: 'macOS x64', re: /_x64\.dmg$/ },
  { label: 'macOS arm64', re: /_arm64\.dmg$/ },
  { label: 'Windows x64', re: /_win-x64-setup\.exe$/ },
];

// ------------------------------------------------------------------ 判定（纯函数）

export function findReleases(releases, tag) {
  return (releases ?? []).filter((r) => r && r.tag_name === tag);
}

/** AC-38：该 tag 的 Release 存在且不是草稿。 */
export function judgePublish(releases, tag) {
  const hit = findReleases(releases, tag).find((r) => r.draft === false);
  return {
    ok: Boolean(hit),
    detail: hit ? `release ${hit.tag_name} 存在（draft=false，id=${hit.id}）` : `未找到 ${tag} 的非草稿 Release`,
  };
}

/** AC-39：三平台包 + 清单共 4 项齐全、架构后缀齐全。 */
export function judgeAssets(release) {
  if (!release) return { ok: false, detail: '无 Release 可查' };
  const names = (release.assets ?? []).map((a) => a.name);
  const missingPlatforms = PLATFORM_PATTERNS.filter((p) => !names.some((n) => p.re.test(n))).map((p) => p.label);
  const hasSums = names.includes(SUMS);
  const ok = missingPlatforms.length === 0 && hasSums && names.length === 4;
  const parts = [];
  if (missingPlatforms.length) parts.push(`缺平台：${missingPlatforms.join(' / ')}`);
  if (!hasSums) parts.push(`缺 ${SUMS}`);
  if (names.length !== 4) parts.push(`资产数为 ${names.length}（应为 4）`);
  return { ok, detail: ok ? `4 项齐全：${names.join(', ')}` : parts.join('；'), names };
}

/** AC-41：预发布标记与 tag 前缀一致（v0.* → prerelease，v1+ → 正式）。 */
export function judgeChannel(release, tag) {
  if (!release) return { ok: false, detail: '无 Release 可查' };
  const [, major] = /^v(\d+)\./.exec(tag) ?? [];
  if (major === undefined) return { ok: false, detail: `tag 形态不合法：${tag}` };
  const expectPre = Number(major) === 0;
  const actual = Boolean(release.prerelease);
  return {
    ok: expectPre === actual,
    detail: `tag=${tag} 期望 prerelease=${expectPre}，实际=${actual}`,
  };
}

/** AC-42：试跑落在草稿，且草稿标识不以 v 开头（不会自我触发）。 */
export function judgeDraft(releases, tag, baselinePublic) {
  const hits = findReleases(releases, tag);
  const draft = hits.find((r) => r.draft === true);
  const startsWithV = /^v/.test(tag);
  const publicCount = (releases ?? []).filter((r) => r.draft === false).length;
  const countOk = baselinePublic === undefined ? true : publicCount === baselinePublic;
  const ok = Boolean(draft) && !startsWithV && countOk;
  const parts = [];
  if (!draft) parts.push(`未找到草稿 ${tag}`);
  if (startsWithV) parts.push('草稿标识以 v 开头（会再次命中 tag 触发）');
  if (!countOk) parts.push(`正式 Release 数由 ${baselinePublic} 变为 ${publicCount}`);
  return { ok, detail: ok ? `草稿 ${tag} 存在，非草稿数仍为 ${publicCount}` : parts.join('；'), publicCount };
}

/** AC-42：清理后该 tag 在 Releases 列表中计数为 0。 */
export function judgeAbsent(releases, tag) {
  const hits = findReleases(releases, tag);
  return { ok: hits.length === 0, detail: hits.length === 0 ? `已清理：${tag} 计数 0` : `${tag} 仍有 ${hits.length} 个条目` };
}

/** AC-43：同名 Release 计数为 1 且资产齐全（幂等）。 */
export function judgeIdempotent(releases, tag) {
  const hits = findReleases(releases, tag);
  const assets = hits.length === 1 ? judgeAssets(hits[0]) : { ok: false, detail: '' };
  const ok = hits.length === 1 && assets.ok;
  return {
    ok,
    detail: hits.length === 1 ? `条目数 1；${assets.detail}` : `同名条目数为 ${hits.length}（应为 1）`,
  };
}

/** AC-40：失败构建不得新增可下载资产。 */
export function judgeGating(run, assetsBefore, assetsAfter) {
  const conclusion = run?.conclusion ?? null;
  const sameCount = assetsBefore === assetsAfter;
  const ok = conclusion === 'failure' && sameCount;
  return {
    ok,
    detail: `run conclusion=${conclusion}；资产数 ${assetsBefore} → ${assetsAfter}`,
  };
}

/** AC-39 本地对账：逐行重算 SHA-256 与清单比对。 */
export function judgeChecksums(dir) {
  const sumsPath = path.join(dir, SUMS);
  if (!fs.existsSync(sumsPath)) return { ok: false, detail: `未找到 ${SUMS}` };
  const lines = fs.readFileSync(sumsPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const problems = [];
  for (const line of lines) {
    const m = /^([0-9a-f]{64})\s+(.+)$/.exec(line);
    if (!m) {
      problems.push(`清单行格式非法：${line}`);
      continue;
    }
    const file = path.join(dir, m[2]);
    if (!fs.existsSync(file)) {
      problems.push(`清单有但本地缺文件：${m[2]}`);
      continue;
    }
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (digest !== m[1]) problems.push(`校验和不符：${m[2]}`);
  }
  return { ok: problems.length === 0, detail: problems.length ? problems.join('；') : `${lines.length} 行逐行一致`, lines: lines.length };
}

// ------------------------------------------------------------------ REST 只读

function readToken() {
  const r = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  });
  const m = /^password=(.+)$/m.exec(r.stdout ?? '');
  return m ? m[1].trim() : null;
}

function apiGet(apiPath, token) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: 'api.github.com',
        path: apiPath,
        method: 'GET',
        headers: {
          'User-Agent': 'maestro-release-verify',
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode, body: parsed, raw: body });
        });
      },
    );
    req.setTimeout(20_000, () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ status: 0, body: null, raw: String(err.message) }));
    req.end();
  });
}

/** 证据脱敏：只保留判定所需字段，绝不写入令牌。 */
function redact(releases) {
  return (releases ?? []).map((r) => ({
    id: r.id,
    tag_name: r.tag_name,
    draft: r.draft,
    prerelease: r.prerelease,
    created_at: r.created_at,
    assets: (r.assets ?? []).map((a) => ({ name: a.name, size: a.size })),
  }));
}

async function main() {
  const argv = process.argv.slice(2);
  const tag = argv.find((a) => !a.startsWith('--'));
  const checkIdx = argv.indexOf('--check');
  const check = checkIdx >= 0 ? argv[checkIdx + 1] : null;
  const repoIdx = argv.indexOf('--repo');
  const repo = repoIdx >= 0 ? argv[repoIdx + 1] : DEFAULT_REPO;
  const outIdx = argv.indexOf('--out');
  const dirIdx = argv.indexOf('--dir');
  const baseIdx = argv.indexOf('--baseline');

  if (!tag || !check) {
    process.stderr.write('用法：node probe/acc10-release-verify.mjs <tag> --check <publish|assets|gating|channel|draft|absent|idempotent>\n');
    process.exit(2);
  }

  const token = readToken();
  if (!token) {
    process.stderr.write('[verify] 未取到 GitHub 凭据（git credential fill 为空）\n');
    process.exit(2);
  }

  const res = await apiGet(`/repos/${repo}/releases?per_page=100`, token);
  if (res.status !== 200 || !Array.isArray(res.body)) {
    process.stderr.write(`[verify] Releases 读取失败：HTTP ${res.status}\n`);
    process.exit(2);
  }
  const releases = res.body;

  let verdict;
  switch (check) {
    case 'publish':
      verdict = judgePublish(releases, tag);
      break;
    case 'assets':
      verdict = judgeAssets(findReleases(releases, tag)[0]);
      if (dirIdx >= 0 && argv[dirIdx + 1]) {
        const sums = judgeChecksums(path.resolve(argv[dirIdx + 1]));
        verdict = { ok: verdict.ok && sums.ok, detail: `${verdict.detail}；本地对账：${sums.detail}` };
      }
      break;
    case 'channel':
      verdict = judgeChannel(findReleases(releases, tag)[0], tag);
      break;
    case 'draft':
      verdict = judgeDraft(releases, tag, baseIdx >= 0 ? Number(argv[baseIdx + 1]) : undefined);
      break;
    case 'absent':
      verdict = judgeAbsent(releases, tag);
      break;
    case 'idempotent':
      verdict = judgeIdempotent(releases, tag);
      break;
    case 'gating': {
      const runs = await apiGet(`/repos/${repo}/actions/runs?per_page=50`, token);
      const run = (runs.body?.workflow_runs ?? []).find((r) => r.head_branch === tag || r.name === tag);
      const hit = findReleases(releases, tag)[0];
      verdict = judgeGating(run, 0, (hit?.assets ?? []).length);
      break;
    }
    default:
      process.stderr.write(`[verify] 未知检查项：${check}\n`);
      process.exit(2);
  }

  const payload = {
    repo,
    tag,
    check,
    at: new Date().toISOString(),
    verdict,
    releases: redact(releases.filter((r) => r.tag_name === tag)),
  };
  if (outIdx >= 0 && argv[outIdx + 1]) {
    const outDir = path.resolve(argv[outIdx + 1]);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `verify-${check}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(payload.verdict)}\n`);
  if (!payload.verdict.ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
