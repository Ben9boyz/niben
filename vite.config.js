import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'
import { mockApi } from './server/mockApi.js'

export default defineConfig({
  // CSS is bundled into the JS file: the web host's FTP server rejects our .css uploads
  plugins: [vue(), cssInjectedByJs(), mockApi()],
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
