import { svelte } from '@sveltejs/vite-plugin-svelte'
import { threlteStudio } from '@threlte/studio/vite'
import { defineConfig } from 'vite'
import { resolve } from 'path'

// E2E test stub: when VITE_E2E_STUB_SPARK is set, alias Spark to a test stub
const sparkStub = process.env.VITE_E2E_STUB_SPARK === 'true'
  ? {
      find: '@sparkjsdev/spark',
      replacement: resolve(__dirname, 'tests/fixtures/spark-stub.ts'),
    }
  : undefined

export default defineConfig({
  plugins: [threlteStudio(), svelte()],
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
      ...(sparkStub ? { '@sparkjsdev/spark': sparkStub.replacement } : {}),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
