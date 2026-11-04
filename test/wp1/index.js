/**
 * 目录入口。
 *
 * Node 22 的 `--test <目录>` 不会递归展开目录（目录参数支持在 Node 23 才加入），
 * 而是把目录当模块加载。这里显式汇总本工作包的测试文件，保证
 * `node --test test/wp1/` 可直接跑；单独跑 `node --test test/wp1/*.test.js` 也照常工作。
 */
import './paths.test.js';
import './atomic-write.test.js';
import './instance-store.test.js';
import './event-bus.test.js';
