import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/minimalSetupTests.ts'],
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@components': resolve(__dirname, './components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@services': resolve(__dirname, './src/services'),
      '@context': resolve(__dirname, './src/context'),
      '@lib': resolve(__dirname, './lib'),
      '@utils': resolve(__dirname, './src/utils'),
      '@ui': resolve(__dirname, './components/ui')
    }
  }
})
