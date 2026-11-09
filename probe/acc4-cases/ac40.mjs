// AC-40 instance log --format json 输出原始事件数组（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, instanceLog, readEvents, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-40';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（含回流与升级）');

    const res = c.cmd(instanceLog(root, 'INST-001', 'json'), 'orch instance log INST-001 --format json');
    let arr = null;
    try { arr = JSON.parse(text(res)); } catch { /* 下面断言 */ }
    c.check('Then：stdout 是可解析的 JSON 数组', Array.isArray(arr), String(text(res)).slice(0, 300));
    c.eq('Then：退出码 0', res.exitCode, 0);
    const ev = readEvents(root);
    c.eq('机检：数组长度等于 events.jsonl 可解析行数', arr?.length, ev.length);
    c.eq('Then：顺序一致（seq 与 events.jsonl 相同）', JSON.stringify((arr ?? []).map((e) => e.seq)), JSON.stringify(ev.map((e) => e.seq)));
    c.eq('Then：元素字段与事件日志一致（首条 reason）', arr?.[0]?.reason, ev[0]?.reason);
    c.eq('Then：元素字段与事件日志一致（首条 object/objectId）', `${arr?.[0]?.object}/${arr?.[0]?.objectId}`, `${ev[0]?.object}/${ev[0]?.objectId}`);
    c.check('Then：元素含 gen / ts / detail 等原始字段', Boolean(arr?.[0] && 'gen' in arr[0] && 'ts' in arr[0] && 'detail' in arr[0]), JSON.stringify(arr?.[0]).slice(0, 300));
    return conclude(c, root);
  },
}];
