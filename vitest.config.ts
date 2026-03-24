import { defineConfig } from 'vitest/config';
import path from 'path';

// Threshold dinámico: +10% por día desde el inicio del proyecto
// Día 1 = 30%, Día 2 = 40%, ... Día 7+ = 100% (cap)
const PROJECT_START = new Date('2026-03-16');
const daysSinceStart = Math.floor(
  (Date.now() - PROJECT_START.getTime()) / (1000 * 60 * 60 * 24)
);
const BASE_THRESHOLD = 30;
const DAILY_INCREMENT = 10;
const threshold = Math.min(100, BASE_THRESHOLD + daysSinceStart * DAILY_INCREMENT);

console.log(`\n📊 Coverage threshold: ${threshold}% (día ${daysSinceStart + 1} del proyecto)\n`);

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'tests/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/modules/**/*.ts', 'src/lib/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: threshold,
        functions: threshold,
        branches: threshold,
        statements: threshold,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
