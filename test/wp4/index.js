/**
 * 目录入口：Node 22 的 `--test <目录>` 不会递归展开目录，
 * 这里显式汇总本工作包的测试文件，保证 `node --test test/wp4/` 可跑。
 */
import './verify-artifact.test.js';
import './orchestrator.test.js';
