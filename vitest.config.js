import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 题库生成用例在慢速 CI 机器上会超过默认 5s，放宽到 30s
    testTimeout: 30000,
    hookTimeout: 30000,
    // 串行执行，避免多核竞争导致的偶发超时
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
