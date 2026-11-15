/**
 * I1.10a S3 · 逐 AC 用例生成器（只新增，不改产品代码）。
 *
 *   node probe/acc10-f-gen.mjs            # 生成 probe/acc10-cases/acNN.mjs
 *   node probe/acc10-f-gen.mjs --check    # 核对已生成用例与 requirement.md v2 §3.1 逐字一致
 *
 * 用例内容（AC 号 / 标题 / 场景类型 / Given / When / Then / 机检 / 夹具 / 架构检查原文）
 * 全部从 `docs/iterations/iteration-10a/requirement.md` §3.1 **逐字抽取**，生成器不放宽、
 * 不改写、不合并任何 Then。机检测试文件从「机检：」行按 `test/wp13/<file>.test.js` 抽取；
 * 架构检查命令按需求原文（含 `grep -RE` ERE 形态）登记，散文式静态声明登记为「留证不判」。
 *
 * 生成的用例文件不含 `-f` 前缀（拆分文档 §5 交付物清单口径）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO, REQUIREMENT, requirementBlocks, jsq, WORDS_31 } from './acc10-f-lib.mjs';

const CASES_DIR = path.join(REPO, 'probe', 'acc10-cases');
const PURITY_CORE = `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "${WORDS_31}"`;
const PURITY_UI = `node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid "${WORDS_31}"`;

/** expect：0 = 有命中（exit 0）；1 = 零命中（exit 1）；null = 静态核对，留证不判。 */
const z = (cmd, note) => ({ cmd, expect: 1, note });            // 零命中
const h = (cmd, note) => ({ cmd, expect: 0, note });            // 有命中
const l = (cmd, lines, note, contains) => ({ cmd, expect: 0, lines, contains, note }); // 恰好 N 条
const c = (cmd, contains, note) => ({ cmd, expect: 0, contains, note }); // 输出含指定串
const n = (cmd, note) => ({ cmd, expect: null, note });         // 留证不判

/** 架构检查命令表：有可执行命令的 AC 按需求原文登记；散文式声明登记为静态核对。 */
const ARCH = {
  'AC-01': [h(PURITY_CORE, '31 词全表，src/core+src/daemon 零命中（需求 AC-01 架构检查原文）')],
  'AC-02': [
    l('grep -REn "core[.]stop" desktop/src-tauri/src/', 1, '恰好 1 条命中（exit 0）'),
    c('grep -REn -B8 "core[.]stop" desktop/src-tauri/src/', 'fn quit', '-B8 上下文可见退出处理函数 fn quit'),
    n('grep -REn "close-window|close_to_tray" desktop/src-tauri/src/tray.rs', '关窗路径不得调用核心停止（行为断言由契约测试兜底）'),
  ],
  'AC-03': [z('grep -REn "saveState|computeHealth" desktop/ui/list/', '列表只读：不新增状态字段、不重算健康度')],
  'AC-04': [
    h('grep -REn "renderListUnreadable" desktop/ui/list/list.js', '不可读行复用既有渲染函数（需求写作 renderInstanceUnreadable，实现导出名为 renderListUnreadable）'),
    z('grep -REn "状态不可读" desktop/ui/list/', '界面层不得硬编码中文（走 /ui/labels）'),
  ],
  'AC-05': [
    n('grep -Rn "startRun" desktop/', '需求原文形态；本机 bundle 构建产物内有产品源码副本，命中仅作留证'),
    z('grep -REn "startRun" desktop/ui/ desktop/harness/', '界面层零命中：新建实例只能经接口，不得重写 run.start'),
  ],
  'AC-06': [z('grep -REn "[一-龥]" desktop/ui/', '错误文案只从 labels.js / /ui/labels 取，界面层零中文字面量')],
  'AC-07': [z('grep -REn "saveState|emit\\(" src/daemon/graph.js', '图投影只读（零命中 exit 1；ERE 形态，非 BRE \\|）')],
  'AC-08': [z('grep -REn "new EventEmitter" src/daemon/http/', '推送只来自既有事件总线，不为界面单开数据源')],
  'AC-09': [
    n('grep -REn "setTimeout" src/daemon/http/stream.js', '调度器内部定时器留证；窗口边界由注入时钟单测覆盖'),
    h('grep -REn "now" src/daemon/http/stream.js', '合并调度器 now 可注入'),
  ],
  'AC-10': [
    h('grep -REn "REV_WHITELIST" src/daemon/graph.js', '版本号白名单存在'),
    z('grep -REn "\'session\'|\'execution\'|\'health\'" src/daemon/graph.js', '白名单数组不含 session / execution / health 字面量（注释里用反引号说明排除语义，故只扫带引号的数组成员）'),
  ],
  'AC-11': [
    n('grep -R "decideStatus" desktop/', '需求原文形态；bundle 构建产物含 src/core 副本，命中仅作留证'),
    z('grep -REn "decideStatus" desktop/ui/ desktop/harness/', '界面层零命中：不重算状态机'),
  ],
  'AC-12': [z('grep -REn "saveState|emit\\(" desktop/ui/graph/', '折叠只发生在渲染层，不改图数据')],
  'AC-13': [h('grep -REn "node_type|nodeType" src/daemon/graph.js', '特殊节点类型只从定义层 node_type 读')],
  'AC-14': [
    h('grep -REn "Unknown node_type|未知" src/daemon/graph.js', '未知 node_type 按角色节点渲染并保留 ID'),
    z('grep -REn "saveState|emit\\(" src/daemon/graph.js', '图投影只读'),
  ],
  'AC-15': [h('grep -REn "aggregateStatus" desktop/ui/graph/edge-rows.js', '视觉 token 只由聚合状态映射')],
  'AC-16': [h('grep -REn "AGGREGATE_PRIORITY" src/daemon/graph.js', '聚合复用基线优先级顺序常量')],
  'AC-17': [z('grep -REn "Date[.]now|fs[.]" desktop/ui/graph/layout.js', '布局是纯函数：不读文件、不取系统时间')],
  'AC-18': [h('grep -REn "abnormal" desktop/ui/graph/layout.js', 'z 只由 abnormal 决定，不进入层号/坐标计算')],
  'AC-19': [h('grep -REn "group" desktop/ui/graph/collapse.js', '分组键只取角色 group')],
  'AC-20': [z('grep -REn "saveState|writeFile" desktop/ui/graph/view.js', '缩放只影响变换矩阵，不回写布局坐标')],
  'AC-21': [h('grep -REn "focus|visible" desktop/ui/graph/view.js', '聚焦只过滤可见集合')],
  'AC-22': [
    z('grep -REn "instanceDir|statePath" desktop/ui/', '视图偏好只写 .orch/desktop/views/'),
    h('grep -REn "views" desktop/src-tauri/src/config.rs', '写入端路径常量（R-12：结构断言补证）'),
  ],
  'AC-23': [h('grep -REn "pulse" desktop/ui/graph/style.js', '脉冲是 CSS/变换层 token，不改几何尺寸常量')],
  'AC-24': [h('grep -REn "column|blocked" desktop/ui/board/board.js', '看板列由状态 + 上游完成度派生')],
  'AC-25': [h('grep -REn "visibleLabels|hover" desktop/ui/labels/labels.js', '标签可见性由状态与悬停键决定')],
  'AC-26': [
    z('grep -REn "process[.]env[.]NODE_ENV|__TEST__[ ]*=|isTest[ ]*=" desktop/ui/', '不得使用测试专用渲染分支（扫实际代码分支；注释中的否定陈述不算命中）'),
    h('grep -REn "probe_emit|window-probe" desktop/ui/app.js', '探针只记录渲染结果，不合成、不重算'),
  ],
  'AC-27': [
    z('grep -REn "saveState|instance-store|appendSpan" src/daemon/http/', 'HTTP 层不得直接写状态 / 追加审计'),
    n('grep -REn "startRun" src/daemon/http/', '新建实例经 orchestrator.startRun，命中须落在 POST /instances 处理器文件'),
    n('grep -REn "0[.]0[.]0[.]0" src/daemon/http/', '监听地址不出现 0.0.0.0（lsof 输出由契约测试断言）'),
  ],
  'AC-28': [
    h(PURITY_CORE, '31 词全表，src/core+src/daemon 零命中'),
    h(PURITY_UI, '31 词全表，desktop/ui 零命中'),
    l('node -p "Object.keys(require(\'./package.json\').dependencies||{}).length"', 1, '输出 0（零运行时依赖）', '0'),
    z('grep -REn "[一-龥]" desktop/ui/ desktop/harness/', '界面层与 harness 零中文字面量'),
  ],
  'AC-29': [z('grep -REn \'env::var\\("PATH"\\)|Command::new\\("node"\\)\' desktop/src-tauri/src/', '壳层不得从用户 PATH 找 node')],
  'AC-30': [
    z('grep -REn "[一-龥]" desktop/ui/', '异常文案不硬编码中文'),
    h('grep -REn "fallback|内置模板" src/daemon/graph.js', '未知定义按内置模板回退'),
  ],
  'AC-31': [z('grep -REn "项目 未指定|项目 不可用" desktop/ui desktop/harness', '提示文案只从 labels.js 取')],
  'AC-32': [z('grep -REn "P90|TTL|崩溃" desktop/ui/', '悬停原因只透传 health.reasons，不重算、不拼接')],
  'AC-33': [z('grep -REn "Math[.]" desktop/ui/graph/highlight.js', '高亮由邻接关系派生，模块零数学运算（不按坐标邻近猜测）')],
  'AC-34': [z('grep -REn "Date[.]now|fs[.]" desktop/ui/graph/', '图例锚点只由画布尺寸决定，纯模块禁时钟与 fs')],
  'AC-35': [h('grep -REn "default|未知" desktop/ui/board/board.js', '未知状态有显式默认分支')],
  'AC-36': [h('grep -REn "SingleInstance|single_instance|activate" desktop/src-tauri/src/', '单实例用应用级锁；二次启动激活已有窗口')],
  'AC-37': [h('grep -REn "now" src/daemon/http/stream.js', '合并调度器仍为可注入时钟的纯调度器（同 AC-09）')],
  // ---- 发布面（需求 v4 AC-38~44；以真实 GitHub 面 + 静态契约双向取证）----
  'AC-38': [
    z('grep -REn "secrets\\." .github/', '整份发布定义零密钥引用（exit 1）'),
    l('grep -REn "permissions:" .github/workflows/release.yml', 1, 'permissions 声明恰好 1 处'),
    z('grep -REn "ghp_|github_pat_|password|token:" .github/', '无字面密钥前缀与 token: 赋值形态'),
    h('grep -REn "github[.]token" .github/workflows/release.yml', '令牌走 ${{ github.token }} 表达式'),
  ],
  'AC-39': [
    z('grep -REn "lipo|-target universal-apple-darwin|universal2-apple-darwin" .github/ scripts/', '不做跨架构装配（禁具体命令形态）'),
    h('grep -REn "macos-15-intel|macos-15|windows-latest" .github/workflows/release.yml', '三平台各自在自家 runner 产出'),
  ],
  'AC-40': [
    z('grep -REn "skip-smoke|skip-gates" .github/ scripts/', '无跳过门禁/冒烟的旁路开关'),
    h('grep -REn "gate[.]mjs" .github/workflows/release.yml', '门禁调用仓库既有判定脚本'),
  ],
  'AC-41': [
    z('grep -REn "0[.]1[.]0" scripts/desktop/', '派生物不写版本字面量（唯一来源 = package.json）'),
    h('grep -REn "assertAligned|readVersion" scripts/desktop/version.mjs', '版本模块提供唯一读取入口与对齐断言'),
  ],
  'AC-42': [
    h('grep -REn "dryrun-" .github/workflows/release.yml', '草稿标识不以 v 开头（dryrun- 前缀）'),
    h('grep -REn "[-][-]draft" .github/workflows/release.yml', '试跑产出草稿'),
  ],
  'AC-43': [
    h('grep -REn "gh release view|[-][-]clobber" .github/workflows/release.yml', '已存在则补传、覆盖式上传'),
    h('grep -REn "fail-fast:[[:space:]]*false" .github/workflows/release.yml', '任一平台失败不阻塞其它平台产出'),
  ],
  'AC-44': [
    h('grep -REn "hdiutil.*verify|镜像内应用复验" scripts/desktop/smoke.mjs', '镜像完整性与挂载后复验'),
    z('grep -REn "0[.]0[.]0[.]0|listen.*all" scripts/desktop/smoke.mjs', '冒烟不绑定通配地址'),
  ],
};

/** 证据等级：默认 mock 实测；R-12 的 AC-22 单列结构断言等级。 */
const LEVEL = {
  'AC-22': 'mock 实测（结构断言）',
};
const NOTES = {
  'AC-22': 'R-12：B-36 真实壳内拖拽仍为结构断言（写入端 config.rs 零窗口级自动化用例）。本条按「mock 实测（结构断言）」判定，不冒充真实宿主实测；S3 以 view-state.test.js + config.rs 路径常量补结构证据。',
  'AC-26': '规划逐字验收句（857 行）由 acceptance-e2e.test.js 在真实 Tauri 壳 + mock 宿主 + 真实 core/daemon 下跑完三段；不接真实 DSH。',
  'AC-29': 'env -i PATH=/usr/bin:/bin 等价夹具；判定不检查包内目录结构（附录 D-14）。',
  'AC-04': 'R-08 已登记的时序竞态基线项；单文件机检若失败，须保留全部 attempt 原始帧并在 blockers 台账登记，不得改断言。',
  'AC-05': '需求架构检查原文 `grep -Rn "startRun" desktop/` 在本机包含 bundle 构建产物（`desktop/src-tauri/target/**` 内为产品源码副本）；判定以界面层作用域 `desktop/ui/ desktop/harness/` 零命中为准，原文形态仅留证。',
  'AC-11': '同上：需求 `grep -R "decideStatus" desktop/` 命中构建产物副本，判定以界面层作用域零命中为准。',
  // ---- 发布面（v4 AC-38~44）：证据分级按需求 §3.3「发布面证据分级」----
  'AC-38': [
    '证据分级：`已实测（真实 GitHub 面）` 需一次真实 tag 推送 + Actions 记录 + Release 存在；静态契约（release-contract.test.js）只能证明「定义里写了什么」，不得单独判本条通过。',
    '零个人凭据的判定点：`.github/` 内 `secrets.` 零命中 + `permissions:` 只含 `contents: write`；令牌表达式为 `${{ github.token }}`。',
  ],
  'AC-39': [
    '静态契约由 release-contract.test.js 的 `judgeAssets` 单测承载（三平台 + 清单共 4 项、资产数恰为 4）；真实面由 `acc10-release-verify.mjs --check assets` 取远端资产名与字节数并本地重算 SHA-256。',
    '禁止用仓内文件冒充远端资产（`docs/index.md` 710 行第 3 条）；缺任一平台即判不通过，不得用「另外两个平台已过」折抵。',
  ],
  'AC-40': [
    '失败判定点（需求 v4 F-24）：该次 run `conclusion=failure` 且同名 Release 资产数在 run 前后相等；构造不出真实红色 run 时本条判 `阻塞`，不得用静态断言替代真实失败帧。',
  ],
  'AC-41': [
    '静态契约三条（来源唯一 / 值相等 / 派生物零字面量）由 release-version.test.js 承载；真实面由 `--check channel` 断言 `v0.* → prerelease`、`v1+ → 正式`。',
  ],
  'AC-42': [
    '真实面：`workflow_dispatch` 一次 → 草稿 `draft=true` 且正式条目数不增；清理后必须 `--check absent` 计数归零，删除前后的 REST 响应双向落证（F-28）。',
  ],
  'AC-43': [
    '真实面：同名 Release 计数为 1 且资产齐全；静态契约断言「已存在则补传 / 否则创建」与 `--clobber` 覆盖式上传。',
  ],
  'AC-44': [
    '本机 macOS 面可实测（冒烟四件套已跑通）；Windows 面只能由 `windows-latest` 证明（本机无 `makensis`、无 `llvm-rc`），macOS 面通过不得替 Windows 面签字（需求 v4 F-20 连带项）。',
    '真机安装/首启、Gatekeeper 放行、SmartScreen 引导属人工核验，不计入自动通过数。',
  ],
};

function fileList(jijian) {
  return [...new Set([...jijian.matchAll(/test\/wp13\/([\w.-]+\.test\.js)/g)].map((m) => m[1]))];
}

/**
 * 发布面兜底（S3 口径，不改需求判据）：
 * AC-39/42/43 的机检行以 `probe/acc10-release-verify.mjs`（真实面只读校验）为主，
 * 未内联 `test/wp13/*.test.js`。这三条的**静态契约**由 `release-contract.test.js`
 * 的纯函数单测承载（judgeAssets / judgeDraft / judgeIdempotent），故在此登记兜底，
 * 避免生成器把「真实面校验器」误判成「没有测试」。
 */
const STATIC_FALLBACK = {
  'AC-39': ['release-contract.test.js'],
  'AC-42': ['release-contract.test.js'],
  'AC-43': ['release-contract.test.js'],
};

function caseSource(b) {
  const ac = b.ac;
  const spec = {
    ac,
    title: b.title,
    face: b.scene || '功能',
    level: LEVEL[ac] || 'mock 实测',
    refs: b.refs,
    risk: b.risk,
    given: b.given,
    when: b.when,
    then: b.then,
    judgement: b.judgement,
    jijian: b.jijian,
    fixture: b.fixture,
    archText: b.archText,
    files: fileList(b.jijian).length ? fileList(b.jijian) : STATIC_FALLBACK[ac] || [],
    arch: ARCH[ac] || [],
    notes: [].concat(NOTES[ac] ?? []),
    source: `docs/iterations/iteration-10a/requirement.md §3.1 ${ac}`,
  };
  return [
    `// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 ${ac}。`,
    `// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。`,
    `import { runCase } from '../acc10-f-common.mjs';`,
    ``,
    `export const spec = ${JSON.stringify(spec, null, 2)};`,
    ``,
    `export const cases = [{`,
    `  ac: spec.ac,`,
    `  title: spec.title,`,
    `  face: spec.face,`,
    `  run: () => runCase(spec),`,
    `}];`,
    ``,
  ].join('\n');
}

const blocks = requirementBlocks();
if (blocks.length !== 44) throw new Error(`AC 数量异常：${blocks.length}（期望 44）`);
for (const b of blocks) if (b.then.length === 0) throw new Error(`${b.ac} 未抽到 Then`);
for (const b of blocks) {
  const files = fileList(b.jijian);
  if (files.length === 0 && !STATIC_FALLBACK[b.ac]) throw new Error(`${b.ac} 未抽到机检测试文件`);
}

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const b of blocks) {
    const p = path.join(CASES_DIR, `${b.ac.toLowerCase().replace('-', '')}.mjs`);
    const want = caseSource(b);
    const got = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (got !== want) { console.error(`MISMATCH ${p}`); bad++; }
  }
  console.log(`check: ${blocks.length - bad}/${blocks.length} 用例与 requirement.md v4 §3.1 逐字一致`);
  process.exit(bad ? 1 : 0);
}

fs.mkdirSync(CASES_DIR, { recursive: true });
for (const b of blocks) {
  const p = path.join(CASES_DIR, `${b.ac.toLowerCase().replace('-', '')}.mjs`);
  fs.writeFileSync(p, caseSource(b));
}
const readme = [
  '# probe/acc10-cases —— I1.10a S3 逐 AC 用例注册表',
  '',
  '一条 AC 一个文件（`ac01.mjs` ~ `ac44.mjs`，不带 `-f`）。用例内容由',
  '`node ../acc10-f-gen.mjs` 从 `docs/iterations/iteration-10a/requirement.md` v4 §3.1',
  '**逐字抽取**：AC 号 / 标题 / 场景类型 / Given / When / Then / 机检 / 夹具 / 架构检查原文。',
  '生成器不放宽、不改写、不合并任何 Then；`--check` 可核对已生成用例与需求逐字一致。',
  '',
  '## 复跑方式（仓库根，NODE_ENV=test）',
  '',
  '```bash',
  'node probe/acc10-f-run.mjs AC-01          # 单条',
  'node probe/acc10-f-run.mjs --batch a      # AC-01~10',
  'node probe/acc10-f-run.mjs --batch b      # AC-11~20',
  'node probe/acc10-f-run.mjs --batch c      # AC-21~30',
  'node probe/acc10-f-run.mjs --batch d      # AC-31~37',
  'node probe/acc10-f-run.mjs --batch r      # AC-38~44（发布面，r = release）',
  'node probe/acc10-f-final.mjs              # 重建汇总 / 验收报告',
  '```',
  '',
  '## 纪律（硬约束）',
  '',
  '- **只读产品**：不改 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。',
  '- **F-16 机检模板**：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`，',
  '  断言 `# pass ≥ 1`、`# fail 0`、退出码 0；禁用全量 glob 代替（文件缺失会假通过）。',
  '- **同文件多 AC 串扰**：整文件 F-16 失败时，按需求 §3.3「每个 AC 使用独立项目根」补跑',
  '  `--test-name-pattern "<AC>"` 的 AC 级隔离机检（仍 `test -f` + 单文件 `--test`）；',
  '  整文件、各 attempt、隔离机检的原始 TAP 帧**全部保留**，隔离结果只用于本 AC 判定，不掩盖整文件失败、不改任何断言。',
  '  典型：`instance-list.test.js` 同时承载 AC-03/04，R-08 已登记时序竞态在整文件形态下会串扰。',
  '- **一个 AC 一个独立项目根**：runner 注入 `TMPDIR=/tmp/maestro-i10a-acc10/<AC>`，',
  '  契约测试内部 `os.tmpdir()` 自动落在该目录下；证据 `fixture-roots.json` 记录实际根目录。',
  '- **NODE_OPTIONS 不剥离**：需求 §3.3 只强制 `NODE_ENV=test`。保留本机默认的 `NODE_OPTIONS` 预加载；',
  '  剥离会让 mock 宿主一轮完成过快，触发 R-08 已登记时序竞态（AC-04 `running`→`completed`）。',
  '  全量回归门禁仍按裁决 V 用 `env -u NODE_OPTIONS`，其失败集合按判定基线 9 条核算、差集 0。',
  '- **文本扫描**一律 `grep -E` / `grep -RE`（ERE）或 Node 扫描，禁 BRE `\\|` 交替。',
  '- **skip 口径（R-13）**：壳面用例 skip 时必须在 parts 与本台账写明需',
  '  `env -u NODE_OPTIONS npm run desktop:build` 重建产物，不得静默吞掉。',
  '- **证据分级**：`mock 实测` / `mock 实测（结构断言）` / `阻塞`；真实 DSH 取证属本机保留项，不在本迭代判定。',
  '- **每条 AC ≥ 4 份原始帧**：`unit-*.log`、`unit-*.summary.json`、`unit-*.test-names.json`、',
  '  `arch-checks.json`、`then-map.json`、`requirement.json`、`fixture-roots.json`、`result.json`。',
  '',
  '## 架构检查的环境偏差（如实登记，不伪造零命中）',
  '',
  '需求 AC-05 / AC-11 的架构检查原文为 `grep -R ... desktop/`。本机已构建 Tauri bundle，',
  '`desktop/src-tauri/target/release/bundle/**/Resources/src/**` 内是产品源码副本，',
  '按原文扫描会命中。这两条按「原文形态留证 + 界面层作用域 `desktop/ui/ desktop/harness/` 零命中判定」执行，',
  '偏差原因写在 `acc10-f-parts/` 与 `acc10-f-blockers.md`，不放宽断言、不改需求。',
  '',
  '## R-12（AC-22）',
  '',
  '真实壳内拖拽仍是结构断言（写入端 `config.rs` 无窗口级自动化用例）。AC-22 单列证据等级',
  '`mock 实测（结构断言）`，不冒充真实宿主实测；S3 补 `view-state.test.js` + `config.rs` 路径常量证据。',
  '',
].join('\n');
fs.writeFileSync(path.join(CASES_DIR, 'README.md'), readme);
console.log(`generated ${blocks.length} case files in ${CASES_DIR}`);
console.log(`arch checks: ${Object.values(ARCH).reduce((s, a) => s + a.length, 0)} entries`);
