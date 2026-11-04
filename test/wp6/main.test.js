import test from 'node:test';
import assert from 'node:assert/strict';

import { exitCodeFor, main, parseArgs } from '../../src/cli/main.js';

const silent = () => {};

test('parseArgs：run 需要 --cwd 与 --task', () => {
  const ok = parseArgs(['run', '--cwd', './demo', '--task', '写一段产品说明', '--instance', 'INST-001']);
  assert.equal(ok.ok, true);
  assert.equal(ok.command, 'run');
  assert.deepEqual(ok.flags, { cwd: './demo', task: '写一段产品说明', instance: 'INST-001' });

  assert.equal(parseArgs(['run', '--cwd', './demo']).ok, false);
  assert.equal(parseArgs(['run', '--task', 'x']).ok, false);
  assert.equal(parseArgs(['run']).ok, false);
});

test('parseArgs：status 支持 --instance 与 --events', () => {
  assert.equal(parseArgs(['status']).ok, true);
  const parsed = parseArgs(['status', '--instance', 'INST-001', '--events']);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.flags, { instance: 'INST-001', events: true });
});

test('parseArgs：cancel 需要 --instance；core 只接受 stop', () => {
  assert.equal(parseArgs(['cancel']).ok, false);
  assert.equal(parseArgs(['cancel', '--instance', 'INST-001']).ok, true);

  assert.equal(parseArgs(['core']).ok, false);
  assert.equal(parseArgs(['core', 'stop']).ok, true);
  // `core serve` 由 bin/orch.js 截走，不该走到 main 的命令表
  assert.equal(parseArgs(['core', 'serve', '--project', 'D:/x']).ok, false);
});

test('parseArgs：未知命令 / 未知参数 / 缺值都是用法错误', () => {
  assert.equal(parseArgs([]).ok, false);
  assert.equal(parseArgs(['bogus']).ok, false);
  assert.equal(parseArgs(['status', '--nope']).ok, false);
  assert.equal(parseArgs(['status', '--instance']).ok, false);
  assert.equal(parseArgs(['run', '--cwd']).ok, false);
  assert.equal(parseArgs(['status', 'extra']).ok, false);
});

test('parseArgs：--key=value 形式可用', () => {
  const parsed = parseArgs(['run', '--cwd=./demo', '--task=hello world']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.flags.cwd, './demo');
  assert.equal(parsed.flags.task, 'hello world');
});

test('exitCodeFor：三类开始前失败是 3，其余是 1', () => {
  assert.equal(exitCodeFor('DSH_SPAWN_FAILED'), 3);
  assert.equal(exitCodeFor('CWD_NOT_WRITABLE'), 3);
  assert.equal(exitCodeFor('CORE_START_FAILED'), 3);
  assert.equal(exitCodeFor('NODE_BUSY'), 1);
  assert.equal(exitCodeFor('SESSION_INVALID'), 1);
  assert.equal(exitCodeFor('PERMISSION_DENIED'), 1);
  assert.equal(exitCodeFor('HOST_ERROR'), 1);
  assert.equal(exitCodeFor('VERIFY_FAILED'), 1);
  assert.equal(exitCodeFor('UNKNOWN_ERROR'), 1);
  assert.equal(exitCodeFor('STATE_CORRUPT'), 1);
  assert.equal(exitCodeFor('INSTANCE_TERMINAL'), 1);
});

test('main：用法错误退出码 2，且只打用法摘要（不连核心）', async () => {
  const cases = [[], ['bogus'], ['run', '--cwd', 'x'], ['run'], ['cancel'], ['core'], ['status', '--nope']];
  for (const argv of cases) {
    const lines = [];
    const code = await main(argv, { out: (line) => lines.push(line), createClient: () => assert.fail('用法错误不得连核心') });
    assert.equal(code, 2, `argv=${JSON.stringify(argv)}`);
    assert.ok(lines.some((line) => line.includes('orch run|status|cancel|core')), '应打印用法摘要');
  }
});

test('main：--cwd 相对当前 shell 目录解析，不作为项目根', async () => {
  const calls = [];
  const fake = {
    connect: async () => ({ ok: true, coldStart: false, elapsedMs: 0, pid: 1, generation: 'gen' }),
    request: async (method, params) => {
      calls.push({ method, params });
      if (method === 'run.start') return { ok: false, code: 'NODE_BUSY', params: {} };
      return { ok: true, result: {} };
    },
    subscribe: () => () => {},
    close: async () => {},
  };

  const lines = [];
  const code = await main(['run', '--cwd', 'demo', '--task', 't'], {
    cwd: 'D:/work/demo-project',
    out: (line) => lines.push(line),
    createClient: (root) => {
      assert.equal(root, 'D:\\work\\demo-project');
      return fake;
    },
  });

  assert.equal(code, 1);
  // 命令面只允许出现“该节点正在执行”，绝不能出现“会话已失效”（AC-07）
  assert.deepEqual(lines, ['该节点正在执行，本次未发起']);
  const started = calls.find((call) => call.method === 'run.start');
  assert.equal(started.params.cwd, 'D:\\work\\demo-project\\demo');
  assert.ok(!calls.some((call) => call.method === 'instance.subscribe'));
});
