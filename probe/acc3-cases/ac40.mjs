// AC-40 真实宿主上的「审核驳回 → 改稿 → 通过」（真实面 / 证据机检型用例）。
//
// 本用例**不启动任何进程、不跑夹具**：真实 DSH 一次闭环 5 分钟以上，重跑不产生新信息。
// 它只读 docs/iterations/iteration-3/evidence/AC-40b.* 做机检，把需求 AC-40 的每条 Then/And
// 变成可重复执行的核对项。AC-40b.* 是修复 150c7c6（审核提示词给绝对路径）之后的真机复验，
// 属主证据；AC-40.*（修复前 3 次尝试）只作对照，本用例不改写其中任何文件。
//
// 判定纪律：证据文件缺失 / 字段读不出 / JSON 解析失败 → 该核对项记「阻塞」并写明缺哪个文件，
// 不许因为「看着像通过」而放行。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, requirementTitle, finish, EVID, sha256File
} from '../acc3-f-common.mjs';

const AC = 'AC-40';

// 证据文件表：key → evidence/ 下的文件名（全部只读）。
const FILES = {
  events: 'AC-40b.final.events.jsonl',
  state: 'AC-40b.final.state.json',
  meta: 'AC-40b.meta.json',
  host: 'AC-40b.host.json',
  prompt: 'AC-40b.prompt.review.txt',
  probe: 'AC-40b.workspace-probe.txt',
  out: 'AC-40b.run.output.txt',
  timing: 'AC-40b.run.timing.txt',
  review1: 'AC-40b.review.round1.json',
  review2: 'AC-40b.review.round2.json',
  v1: 'AC-40b.v1.md',
  v2: 'AC-40b.v2.md'
};

/** 修复前对照证据里与本用例自动落盘同名的两个文件：finish() 会写同名，写完按字节还原。 */
const PRESERVE = ['AC-40.meta.json', 'AC-40.status.txt'];

const evPath = (key) => path.join(EVID, FILES[key]);
const byBase = (name) => path.join(EVID, name);

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}
function readJson(file) {
  const t = readText(file);
  if (t === null) return null;
  try { return JSON.parse(t); } catch { return null; }
}
function readJsonl(file) {
  const t = readText(file);
  if (t === null) return null;
  const out = [];
  for (const raw of t.split('\n')) {
    if (!raw.trim()) continue;
    try { out.push(JSON.parse(raw)); } catch { return null; }
  }
  return out.length ? out : null;
}
function lineCount(t) {
  if (typeof t !== 'string') return -1;
  const parts = t.split(/\r?\n/);
  return parts.length - (t.endsWith('\n') ? 1 : 0);
}
function winNorm(p) {
  return path.win32.normalize(String(p)).toLowerCase();
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '真实宿主上的「审核驳回 → 改稿 → 通过」',
  face: '真实面',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '真实面' });

    const src = {
      events: readJsonl(evPath('events')),
      state: readJson(evPath('state')),
      meta: readJson(evPath('meta')),
      host: readJson(evPath('host')),
      prompt: readText(evPath('prompt')),
      probe: readText(evPath('probe')),
      out: readText(evPath('out')),
      timing: readText(evPath('timing')),
      review1: readJson(evPath('review1')),
      review2: readJson(evPath('review2')),
      v1: readText(evPath('v1')),
      v2: readText(evPath('v2'))
    };

    const items = [];
    const eq = (label, needs, expected, fn) => items.push({ kind: 'eq', label, needs, expected, fn });
    const ok = (label, needs, fn) => items.push({ kind: 'ok', label, needs, fn });

    // ------------------------------------------------------------ 证据上下文
    const st = src.state ?? {};
    const nodes = st.nodes ?? [];
    const n1 = nodes.find((n) => n.nodeId === 'T-001') ?? null;
    const n2 = nodes.find((n) => n.nodeId === 'T-002') ?? null;
    const n3 = nodes.find((n) => n.nodeId === 'T-003') ?? null;
    const evs = src.events ?? [];
    const reason = (r) => evs.filter((e) => e.reason === r);
    const backflows = (st.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow');
    const bf = backflows[0] ?? null;
    const v1Sha = sha256File(evPath('v1'));
    const v2Sha = sha256File(evPath('v2'));
    const outLines = (src.out ?? '').split(/\r?\n/).map((l) => l.trim());
    const probeLines = (src.probe ?? '').split(/\r?\n/).map((l) => l.trim());

    // ------------------------------------------------------------ Given
    eq('Given 真实 DSH 版本为 0.2.2-rc.1', ['meta'], '0.2.2-rc.1',
      () => src.meta?.env?.dshVersion ?? null);
    eq('Given 模型路由为 deepseek-account → deepseek-flash', ['meta'], 'deepseek-account/deepseek-flash',
      () => `${src.meta?.env?.provider ?? '?'}/${src.meta?.env?.model ?? '?'}`);
    ok('Given 真实宿主经 stdio 拉起（非 mock）', ['host'], () => {
      const h = src.host ?? {};
      const cmd = String(h.launch?.command ?? '');
      const good = h.transport === 'stdio' && cmd.endsWith('DeepSeek Harness.exe') && Array.isArray(h.launch?.args);
      return { ok: good, actual: `${h.transport} ${cmd} ${(h.launch?.args ?? []).join(' ')}` };
    });
    ok('Given 任务文本逐字取需求 Given（三节 + 故意不写回滚方案 + 产物行）', ['state', 'meta'], () => {
      const task = String(st.task ?? '');
      const good = task === String(src.meta?.taskText ?? '')
        && ['「新功能」', '「升级步骤」', '「回滚方案」'].every((s) => task.includes(s))
        && task.includes('故意不要写「回滚方案」')
        && task.includes('产物：release-notes.md');
      return { ok: good, actual: task.replace(/\n/g, '⏎').slice(0, 240) };
    });

    // ------------------------------------------------------------ Then 1：10 分钟内结束，退出码 0
    ok('Then 命令在 10 分钟内结束（DURATION ≤ 600s）', ['timing'], () => {
      const m = /DURATION\s+([\d.]+)s/.exec(src.timing ?? '');
      const sec = m ? Number(m[1]) : NaN;
      return {
        ok: Number.isFinite(sec) && sec > 0 && sec <= 600,
        actual: m ? `${sec}s（上限 600s）` : `（未解析到 DURATION）${String(src.timing).slice(0, 200)}`
      };
    });
    eq('Then 退出码 0', ['timing'], '0', () => {
      const m = /EXIT=(-?\d+)/.exec(src.timing ?? '');
      return m ? m[1] : null;
    });

    // ------------------------------------------------------------ Then 2：T-003 第 2 轮「审核 通过」行
    ok('Then 输出含「节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过」', ['out'], () => {
      const re = /^节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 \S+ · 审核 通过$/u;
      const hit = outLines.find((l) => re.test(l));
      return { ok: Boolean(hit), actual: hit ?? `（未命中）${outLines.filter((l) => l.startsWith('节点 ')).join(' / ').slice(0, 300)}` };
    });

    // ------------------------------------------------------------ Then 3：v1/v2 共存，v1 sha256 与第 1 轮记录一致
    ok('And 机检：v1 与 v2 同时存在且都非空', ['v1', 'v2'], () => ({
      ok: lineCount(src.v1) > 0 && lineCount(src.v2) > 0,
      actual: `v1 ${lineCount(src.v1)} 行 / v2 ${lineCount(src.v2)} 行`
    }));
    eq('And 机检：v1 的 sha256 与第 1 轮记录一致', ['v1', 'state'], n2?.artifactHistory?.[0]?.sha256 ?? null, () => v1Sha);
    eq('And 机检：v2 的 sha256 与第 2 轮记录一致', ['v2', 'state'], n2?.artifactHistory?.[1]?.sha256 ?? null, () => v2Sha);
    eq('And 机检：T-002 的 artifactHistory 恰好两条（第 1/2 轮）', ['state'], '1,2',
      () => (n2?.artifactHistory ?? []).map((h) => h.round).join(','));
    ok('And 机检：v1 与 v2 内容不同，且第 2 轮确实补上了「回滚方案」', ['v1', 'v2'], () => {
      const differ = v1Sha !== v2Sha && src.v1 !== src.v2;
      const added = !String(src.v1).includes('回滚方案') && String(src.v2).includes('回滚方案');
      return { ok: differ && added, actual: `sha 不同=${differ}；v1 含回滚方案=${String(src.v1).includes('回滚方案')}；v2 含回滚方案=${String(src.v2).includes('回滚方案')}` };
    });

    // ------------------------------------------------------------ Then 4：1 条 backflow，defects ≥ 1，证据可解析
    eq('And 机检：edge.kind=\'backflow\' 的交接包恰好 1 条', ['state'], 'HO-003:T-003→T-002',
      () => backflows.map((h) => `${h.handoffId}:${h.edge?.from}→${h.edge?.to}`).join(',') || '（无）');
    ok('And 机检：该回流交接包的 defects 至少 1 条', ['state'], () => {
      const n = bf?.defects?.length ?? 0;
      return { ok: n >= 1, actual: `${n} 条：${(bf?.defects ?? []).map((d) => d.summary).join(' / ').slice(0, 240)}` };
    });
    ok('And 机检：缺陷证据可解析（<ref>#L<n>，ref 指向 v1、行号在 v1 范围内）', ['state', 'v1'], () => {
      const d = bf?.defects?.[0] ?? null;
      const m = d ? /^(.+)#L(\d+)$/.exec(String(d.evidence ?? '')) : null;
      const ref = m ? m[1] : null;
      const ln = m ? Number(m[2]) : -1;
      const refOk = ref === bf?.artifactRefs?.previous?.ref && ref === n2?.artifactHistory?.[0]?.ref;
      const rangeOk = ln >= 1 && ln <= lineCount(src.v1);
      return { ok: Boolean(m) && refOk && rangeOk, actual: `evidence=${d?.evidence ?? '（无）'}；ref 指向 v1=${refOk}；1 ≤ ${ln} ≤ ${lineCount(src.v1)}=${rangeOk}` };
    });
    eq('And 机检：回流携带的 previous.sha256 等于 v1 的 sha256', ['state', 'v1'],
      v1Sha, () => bf?.artifactRefs?.previous?.sha256 ?? null);
    ok('And 机检：回流携带非空 revisionRequirement（改稿要求可追溯）', ['state'], () => ({
      ok: Boolean(String(bf?.revisionRequirement ?? '').trim()),
      actual: String(bf?.revisionRequirement ?? '（空）').slice(0, 160)
    }));

    // ------------------------------------------------------------ Then 5：没有升级
    eq('And 机检：没有升级（escalations 为空）', ['state'], '0',
      () => String((st.escalations ?? []).length));
    ok('Then 输出末段含「升级 —」且不含「升级 ESC-」', ['out'], () => {
      const all = outLines.filter((l) => l.startsWith('升级'));
      return { ok: all.includes('升级 —') && !all.some((l) => l.startsWith('升级 ESC-')), actual: all.join(' / ') || '（无升级行）' };
    });

    // ------------------------------------------------------------ 修复验证点：两轮审核判定与 seq 先后
    eq('机检：review.read 恰好 2 条（第 1/2 轮各一次）', ['events'], '2',
      () => String(reason('review.read').length));
    eq('机检：第 1 轮 review.read 为 reject / results=1', ['events'], 'reject:1',
      () => {
        const d = reason('review.read')[0]?.detail ?? {};
        return `${d.decision}:${d.results}`;
      });
    eq('机检：第 2 轮 review.read 为 pass / results=0', ['events'], 'pass:0',
      () => {
        const d = reason('review.read')[1]?.detail ?? {};
        return `${d.decision}:${d.results}`;
      });
    eq('机检：两轮 review.read 的 detail.path 均为 out/review.json', ['events'], 'out/review.json,out/review.json',
      () => reason('review.read').map((e) => e.detail?.path).join(','));
    ok('机检：seq 先后 review.rejected → 第 2 轮 node.dispatch(T-002 round=2) → review.passed', ['events'], () => {
      const seqs = (list) => list.map((e) => Number(e.seq)).filter(Number.isFinite);
      const rejected = seqs(reason('review.rejected'));
      const dispatch2 = seqs(evs.filter((e) => e.reason === 'node.dispatch'
        && e.detail?.nodeId === 'T-002' && e.detail?.round === 2));
      const passed = seqs(reason('review.passed'));
      const rMin = rejected.length ? Math.min(...rejected) : NaN;
      const dMin = dispatch2.length ? Math.min(...dispatch2) : NaN;
      const pMin = passed.length ? Math.min(...passed) : NaN;
      return {
        ok: Number.isFinite(rMin) && Number.isFinite(dMin) && Number.isFinite(pMin) && rMin < dMin && dMin < pMin,
        actual: `${rMin} < ${dMin} < ${pMin}`
      };
    });
    eq('机检：review.passed 恰好 1 条', ['events'], '1', () => String(reason('review.passed').length));
    eq('机检：零 review.invalid / 零 review_missing（本次修复的验证点）', ['events'], '0/0',
      () => `${reason('review.invalid').length}/${evs.filter((e) => JSON.stringify(e.detail ?? {}).includes('review_missing')).length}`);
    eq('机检：review.round1.json 为 reject 且 defects=1', ['review1'], 'reject:1',
      () => `${src.review1?.decision}:${(src.review1?.defects ?? []).length}`);
    eq('机检：review.round2.json 为 pass 且 defects=0', ['review2'], 'pass:0',
      () => `${src.review2?.decision}:${(src.review2?.defects ?? []).length}`);

    // ------------------------------------------------------------ 终态字段
    eq('机检：实例 state=completed', ['state'], 'completed', () => st.state ?? null);
    eq('机检：三节点全部 done', ['state'], 'T-001:done,T-002:done,T-003:done',
      () => nodes.map((n) => `${n.nodeId}:${n.state}`).join(','));
    eq('机检：T-002 / T-003 的 round=2（T-001 仍第 1 轮）', ['state'], 'T-001:1,T-002:2,T-003:2',
      () => nodes.map((n) => `${n.nodeId}:${n.round}`).join(','));
    eq('机检：T-003 review.decision=pass / defectCount=0 / reviewPath=out/review.json', ['state'],
      'pass:0:out/review.json',
      () => `${n3?.review?.decision}:${n3?.review?.defectCount}:${n3?.review?.reviewPath}`);
    ok('机检：state.counters.dispatchCount 与 events 的 node.dispatch 条数一致', ['state', 'events'], () => {
      const n = reason('node.dispatch').length;
      return { ok: n === st.counters?.dispatchCount, actual: `state=${st.counters?.dispatchCount} / events=${n}` };
    });
    eq('机检：末条事件为 instance run.completed → completed', ['events'], 'instance:run.completed:completed',
      () => {
        const last = evs[evs.length - 1] ?? {};
        return `${last.object}:${last.reason}:${last.to}`;
      });

    // ------------------------------------------------------------ 修复验证点：绝对路径提示词 + 落盘位置
    eq('机检：审核提示词共 2 轮（每轮一条「审核文件写入路径」）', ['prompt'], '2',
      () => String((String(src.prompt).match(/审核文件写入路径：/g) ?? []).length));
    ok('机检：两轮审核文件路径均为绝对路径', ['prompt'], () => {
      const list = [...String(src.prompt).matchAll(/审核文件写入路径：(.+)/g)].map((m) => m[1].trim());
      const flags = list.map((p) => path.win32.isAbsolute(p));
      return { ok: list.length === 2 && flags.every(Boolean), actual: list.map((p, i) => `#${i + 1} ${p}（绝对=${flags[i]}）`).join(' / ') };
    });
    eq('机检：两轮路径解析后等于 <任务目录>/out/review.json', ['prompt', 'state'],
      (() => {
        const exp = winNorm(path.win32.join(String(st.cwd ?? ''), 'out', 'review.json'));
        return `${exp},${exp}`;
      })(),
      () => [...String(src.prompt).matchAll(/审核文件写入路径：(.+)/g)]
        .map((m) => winNorm(m[1].trim())).join(','));
    ok('机检：workspace-probe 终态——任务目录 out/review.json 存在（PRESENT）', ['probe', 'state'], () => {
      const expect = winNorm(path.win32.join(String(st.cwd ?? ''), 'out', 'review.json'));
      const hit = probeLines.find((l) => /^PRESENT\s+/.test(l) && winNorm(l.replace(/^PRESENT\s+/, '')) === expect);
      return { ok: Boolean(hit), actual: hit ?? `（未命中）${probeLines.filter((l) => /^(PRESENT|ABSENT)/.test(l)).join(' | ').slice(0, 300)}` };
    });
    ok('机检：workspace-probe 终态——实例工作区 out/review.json 不存在（工作区没有 out/）', ['probe', 'state'], () => {
      const ws = winNorm(path.win32.join(String(st.cwd ?? ''), '..', '.orch', 'instances', 'INST-001', 'workspace', 'out', 'review.json'));
      const absent = probeLines.filter((l) => /^ABSENT\s+/.test(l) && winNorm(l.replace(/^ABSENT\s+/, '')) === ws);
      const presentBad = probeLines.filter((l) => /^PRESENT\s+/.test(l) && winNorm(l).includes('\\workspace\\out\\'));
      const noOut = String(src.probe).includes('实例工作区顶层目录（没有 out/）');
      return {
        ok: absent.length >= 1 && presentBad.length === 0 && noOut,
        actual: `ABSENT 命中 ${absent.length} 条 / 工作区 PRESENT 误命中 ${presentBad.length} 条 / 顶层目录声明 ${noOut}`
      };
    });

    // ------------------------------------------------------------ 重试条款（AC-40 最后一条 And）
    ok('And 重试条款：本次 0 次重试（1 次即通过，条款未触发）', ['meta'], () => {
      const list = src.meta?.attempts ?? [];
      const good = list.length === 1 && list.every((a) => a.exitCode === 0);
      return { ok: good, actual: `attempts=${list.length}，exitCode=${list.map((a) => a.exitCode).join(',')}（上限 3 次）` };
    });

    // ------------------------------------------------------------ 逐项落判定
    for (const it of items) {
      const lacking = it.needs.filter((k) => src[k] === null || src[k] === undefined);
      if (lacking.length) {
        c.block(it.label, `缺少或无法解析证据文件：${lacking.map((k) => `evidence/${FILES[k]}`).join('、')}`);
        continue;
      }
      let got;
      try {
        got = it.fn();
      } catch (err) {
        c.block(it.label, `读取证据时出错：${err?.message ?? err}`);
        continue;
      }
      if (it.kind === 'eq') {
        c.check(`${it.label}（期望 ${JSON.stringify(it.expected)}）`, Object.is(got, it.expected), JSON.stringify(got));
      } else {
        c.check(it.label, Boolean(got?.ok), got?.actual ?? null);
      }
    }

    // finish() 会写 evidence/AC-40.{state.json,events.jsonl,meta.json,output.json,status.txt}；
    // 其中 meta.json / status.txt 与修复前对照证据同名——先按字节暂存，写完立即还原，保证「证据只读」。
    const shadows = PRESERVE.map((name) => {
      const p = byBase(name);
      const buf = fs.existsSync(p) ? fs.readFileSync(p) : null;
      return { name, p, buf, sha: buf ? sha256File(p) : null };
    });
    const kept = shadows.filter((s) => s.buf).map((s) => `${s.name}（${s.buf.length} B / ${s.sha}）`);

    c.note('本用例是「证据机检型」：不启进程、不跑夹具，只读 evidence/AC-40b.*（修复 150c7c6 后的真机复验，'
      + '5m14s / exit 0 / 313.586s）。逐项核对覆盖需求 AC-40 的 Given/When/Then/And，并额外机检本次修复的两个验证点：'
      + '审核提示词两轮均为绝对路径且等于 <任务目录>/out/review.json；任务目录有 review.json、实例工作区没有 out/。');
    c.note('修复前对照证据 evidence/AC-40.*（3 次尝试：2 次 review_missing 挂起 exit 4、第 3 次通过）未参与判定，'
      + `亦未被改动；与本用例自动落盘同名、已按字节还原的是：${kept.join('、') || '（无同名文件）'}。`);
    c.note('证据表末尾的 AC-40.{state.json,events.jsonl,meta.json,output.json,status.txt} 是本用例自动落盘的占位'
      + '（无项目根、无实例，state.json 为 null）；其中 meta.json / status.txt 落盘后立即被还原成修复前对照证据，'
      + '故表里显示的是落盘瞬间的字节数，磁盘上的实际大小以上面 kept 列表为准。核对明细同时落在本文件与 probe/acc3-f-results.jsonl。');
    c.note(`证据只读校验：v1 sha256=${v1Sha}，v2 sha256=${v2Sha}，与 state.nodes[T-002].artifactHistory 记录一致；`
      + `v1 ${lineCount(src.v1)} 行、v2 ${lineCount(src.v2)} 行。`);

    // 证据清单与命令清单：本用例没有自己的运行命令，列的是「产出这些证据的那次真机运行」，
    // 并明确标注未重跑；命令原文取自 AC-40b.meta.json，退出码/耗时同样取自证据。
    for (const key of Object.keys(FILES)) c.evidence.push(evPath(key));
    c.commands.push({
      label: '真实宿主复验（证据来源，本次未重跑）',
      argv: [src.meta?.command ?? '（见 evidence/AC-40b.meta.json）'],
      cwd: src.meta?.env?.projectRoot ?? null,
      exitCode: src.meta?.attempts?.[0]?.exitCode ?? null,
      timedOut: false,
      durationMs: src.meta?.attempts?.[0]?.durationMs ?? 0,
      stdout: `（本次为证据机检：不启动进程。原始 stdout 见 evidence/AC-40b.run.output.txt；`
        + `耗时 313.586s 见 AC-40b.run.timing.txt）`,
      stderr: ''
    });

    let sum;
    try {
      sum = finish(c);
    } finally {
      for (const s of shadows) if (s.buf) fs.writeFileSync(s.p, s.buf);
      for (const s of shadows) {
        if (s.buf && sha256File(s.p) !== s.sha) {
          throw new Error(`修复前证据 ${s.name} 还原失败（sha256 不一致）`);
        }
      }
    }
    return sum;
  }
}];
