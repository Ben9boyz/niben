import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, transformWithOxc, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'
import { mockApi } from './server/mockApi.ts'

// The service worker is TypeScript (src/sw/sw.ts) but must be served as one plain file called /sw.js,
// so it is compiled on its own instead of going through the app bundle.
function serviceWorker(): Plugin {
  const src = fileURLToPath(new URL('./src/sw/sw.ts', import.meta.url))
  const compile = async (): Promise<string> => (await transformWithOxc(readFileSync(src, 'utf8'), src, { target: 'es2020' })).code
  return {
    name: 'niben-service-worker',
    configureServer(server) {
      server.middlewares.use('/sw.js', (_req, res) => {
        compile().then((code) => { res.setHeader('Content-Type', 'text/javascript'); res.end(code) }, () => { res.statusCode = 500; res.end() })
      })
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: await compile() })
    },
  }
}

// NIBEN_API=http://127.0.0.1:8099 npm run dev: use a real api.php (e.g. `php -S` with a test database) instead of the mock
const realApi = process.env.NIBEN_API

export default defineConfig({
  // CSS is bundled into the JS file: the web host's FTP server rejects our .css uploads
  plugins: [vue(), cssInjectedByJs(), serviceWorker(), ...(realApi ? [] : [mockApi()])],
  server: realApi ? { proxy: { '/api.php': realApi, '/thumb.php': realApi, '/uploads': realApi } } : {},
  base: './',
  // ffmpeg.wasm spins up its own worker; pre-bundling breaks that
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  build: {
    chunkSizeWarningLimit: 2500,
    assetsDir: '',
    // build stamp in the name so browsers never reuse an older copy
    rollupOptions: {
      output: {
        // pages and the 3D room load on demand (fast start). deploy.sh uploads index.html last and only when
        // every chunk arrived, so a chunk the host refuses (451) can't blank the site – it keeps the old version
        entryFileNames: `index-[hash]-${Date.now().toString(36)}.js`,
        // the host's upload filter answers 451 for a file called "_plugin-vue_export-helper-…" (it looks like a
        // WordPress plugin to it) – give shared chunks plain names
        chunkFileNames: (chunk) => `${chunk.name.replace(/^_+/, '').replace('plugin-vue_export-helper', 'vue-helper')}-[hash].js`,
      },
    },
  },
})
