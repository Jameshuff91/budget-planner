import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/minimalSetupTests.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/e2e/**/*.spec.ts', // Exclude Playwright e2e tests
      '**/e2e/**/*.spec.tsx', // Exclude Playwright e2e tests (tsx)
      '**/playwright-report/**',
      '**/playwright/**',
      '**/*.spec.ts', // Exclude all .spec.ts files (Playwright tests)
      '**/*.spec.tsx', // Exclude all .spec.tsx files if any
      '**/backend/**', // Exclude backend tests (they use Jest)
    ],
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@components': resolve(__dirname, './components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@services': resolve(__dirname, './src/services'),
      '@context': resolve(__dirname, './src/context'),
      '@lib': resolve(__dirname, './lib'),
      '@utils': resolve(__dirname, './src/utils'),
      '@ui': resolve(__dirname, './components/ui'),
    },
  },
});
