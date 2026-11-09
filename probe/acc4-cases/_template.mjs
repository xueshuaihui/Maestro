// ============================================================================
// WP-8 / I1.4 验收 case 模块模板（以 _ 开头，runner 不会加载它）。
//
// 【文件命名】probe/acc4-cases/acNN.mjs，NN 为两位零填充的 AC 序号（ac21.mjs ~ ac70.mjs）。
// 【发现规则】acc4-f-run.mjs 扫描 acc4-cases/ac*.mjs（跳过 _*.mjs），动态 import 后读
//             `export const cases`；并校验每条 entry.ac 必须与文件名一致
//             （ac21.mjs 只能声明 AC-21），否则跳过并打印告警。
// 【分批】a=AC-01~15 / b=AC-16~30 / c=AC-31~45 / d=AC-46~60 / e=AC-61~70，
//         由 run.mjs 的固定区间决定；--batch a 只跑 01~15，绝不越界。
//
// ---------------------------------------------------------------------------
// 【导出接口 · 必选】
//   export const cases = [{
//     ac:    'AC-21',                  // 必填 /^AC-\d{2}$/，且与文件名一致
//     title: requirementTitle('AC-21'), // 需求原文标题（common.mjs 提供）
//     face:  'mock 夹具面',             // 验证面描述
//     grade: 'mock 实测',               // 证据分级三选一：
//                                     //   '已实测（真实宿主）' | 'mock 实测' | '阻塞'
//     run:   async (ctx) => { ... },  // 必填，返回 finish(c) 的判定对象
//   }];
//   也允许简写：export const ac='AC-21'; export async function run(ctx){...}
//   （runner 会包装成单条 cases 条目）。但推荐用 cases 数组，便于同一文件放多条。
//
// 【run 的 ctx】runner 调用 entry.run({ ac, entry })：
//   ctx.ac    当前 AC 号；ctx.entry 注册条目（含 ac/title/face/grade/run/file）。
//   绝大多数 case 不用 ctx，直接用 makeCase(ac, {...}) 构造 c 对象即可。
//
// 【c 对象方法】（makeCase 返回，见 acc4-f-common.mjs:562）
//   c.add(root)                  登记独立项目根（os.tmpdir()/maestro-acc-p4/<AC>）
//   c.note(msg)                 追加备注（会进 evidence/meta/results/parts）
//   c.check(label, ok, actual)  一条可执行断言（label 建议抄需求原文 Then/机检）
//   c.eq(label, actual, expected)          Object.is 相等
//   c.includes(label, hay, needle)         含子串
//   c.notIncludes(label, hay, needle)      不含子串
//   c.matches(label, hay, re)              正则匹配
//   c.cmd(res, label)           登记一条命令（argv/cwd/exitCode/duration/stdout/stderr）
//   c.keep(label, handle)       登记长驻进程输出
//   c.snap(root, label)         追加一份断言时刻的 state 快照（<AC>.<label>.json）
//   c.block(label, reason)      判「阻塞」：必须真实宿主/环境不具备时用，写清原因与已尝试路径
//   字段：c.roots / c.evidence / c.commands / c.checks / c.notes / c.grade / c.face
//
// 【判定收敛】summarize(c)：任一 c.block → 阻塞；否则全通过且非空 → 通过；其余 → 不通过。
//   空 checks 也会判「阻塞」，所以每条 AC 至少要有一条真实断言。
//
// 【收尾 · 二选一，必须调用】
//   return finish(c);                    // evidence/ + parts/ + results.jsonl 一次落盘
//   return await conclude(c, roots);     // 先 core stop + forceKillCore，再 finish
//
// 【公共 helper（全部从 '../acc4-f-common.mjs' 引入，无需额外文件）】
//   独立根：freshRoot(ac)、baseEnv(extra)、runCmd/orch/launch/forceKillCore
//   场景：runScene(root,{scenario}) / liveScene / prepareScene / runProduct /
//         pauseAtOutput / badHandoff / holdApproval / suspend... /
//         writeLocalTaskScenario / runLocalTaskScene / retrySteps
//   读取：readState / readEvents / readStatusMd / readInbox(All) / readPrompts /
//         readAttemptFiles / instanceIds / statePath / eventsPath / workspacePath
//   CLI：statusText / statusEvents / statusAll / instanceStatus / instanceLog /
//        instanceGraph / escalateList / escalateResolve / approve / handoffList /
//        handoffShow / workflow / cancel / coreStop
//   接缝：seam(root,call,opts) / seamJson / delivery / whenDeliveryHeld / attachHold
//   断言组：checkWorkspace / checkStatusMd / checkA6 / checkBadPackage /
//           cloneState / mutateState / escalationRow / approvalRow / conclude
//   小工具：nodeOf / handoffOf / escalationOf / approvalOf / reasonsOf / eventsOf /
//           text / lines / nonEmptyLines / exists / sleep / waitUntil / ensureDir /
//           normalizeVolatile / graphJson / requirementTitle / requirementLines
//
// 【禁止】不许改 src/**；不许在仓库目录里跑产品（一律 freshRoot 到 os.tmpdir()）；
//         不许只 includes 一个词就标通过；不许把多条 AC 合并进一个 case；
//         不许把结论写进 state.json 再读回来当证据（视图 Given 只允许改快照数组）。
// ============================================================================
import {
  makeCase, freshRoot, runScene, statusText, readState, readEvents, nodeOf,
  text, lines, requirementTitle, finish, coreStop, forceKillCore,
} from '../acc4-f-common.mjs';

const AC = 'AC-xx'; // TODO：改成真实 AC 号，且与文件名一致

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: 'mock 夹具面',
  grade: 'mock 实测',
  async run(ctx) {
    // ctx = { ac, entry }；下面用 AC 常量，忽略 ctx 也可。
    const c = makeCase(AC, {
      title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
    });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given / When：选一种构造 ---
    // 1) 整场景同步跑完：c.cmd(runScene(root, { scenario: 'pass' }), 'code-loop pass 跑完');
    // 2) 停在中间态 / 接缝：pauseAtOutput / badHandoff / liveScene / seam / holdApproval。
    // 3) 多实例：两次 runScene 之间 resetCursor(root)，并用不同 cwd 规避 DIR_BUSY。
    c.cmd(runScene(root, { scenario: 'pass' }), '夹具场景 code-loop pass 完整跑完');

    // --- Then / And：一条需求原文一条核对项（机检一律落到 state/events/文件）---
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.includes('输出含「……」（照抄需求原文）', text(st), '……');

    const s = readState(root);
    c.eq('机检：state 为 completed', s?.state, 'completed');
    c.eq('机检：T-001 state=done', nodeOf(s, 'T-001')?.state, 'done');

    // 观测不到时（真实宿主专属等）——如实标阻塞，并写清原因，严禁伪造通过：
    // c.block('核对项', '原因：需要 Windows DSH 真实宿主；已尝试：...');

    // --- 收尾：停核心（证据里的状态是稳定快照），再 finish 落盘 ---
    c.cmd(coreStop(root), 'orch core stop');
    await forceKillCore(root);
    return finish(c);
  },
}];
