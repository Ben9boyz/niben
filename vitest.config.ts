import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests: the pure logic (room keys, which corners a room shows, chords …) and the per-room state of the browser
// stores – run in jsdom, no browser and no server needed. `npm run test:unit`
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    restoreMocks: true,
    setupFiles: ['tests/unit/setup.ts'],
  },
})
