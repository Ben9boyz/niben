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
    rollupOptions: { output: { entryFileNames: `index-[hash]-${Date.now().toString(36)}.js` } },
  },
})
