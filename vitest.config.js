import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['tests/llm.test.js', 'node_modules/**'],
    // Run tests in same thread to allow process.cwd mocking
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'scripts/**/*.js',
        'scripts/markdown-blocks.mjs',
        'scripts/block-scoring.mjs',
        'lib/**/*.js'
      ],
      exclude: [
        'node_modules/',
        'tests/',
        '.cache/',
        'dist/',
        '**/*.config.js',
        'scripts/retrigger-full-catalog.sh'
      ],
      // Thresholds for quality gates (lowered for initial setup)
      thresholds: {
        lines: 25,
        functions: 50,
        branches: 70,
        statements: 25
      }
    },
    testTimeout: 30000,
    hookTimeout: 15000,
    // Retry flaky tests once
    retry: 1,
    // Sequence tests to avoid race conditions
    sequence: {
      shuffle: false
    }
  }
});

