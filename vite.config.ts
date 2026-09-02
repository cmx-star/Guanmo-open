import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    vue(),
    {
      name: 'guanmo-build-mode',
      enforce: 'pre',
      resolveId(source) {
        if (source === '/src/main.ts') {
          if (mode === 'web') return path.resolve(__dirname, './src/main.web.ts')
          if (mode === 'desktop') return path.resolve(__dirname, './src/main.desktop.ts')
        }
        return null
      },
      transformIndexHtml(html) {
        const entry = mode === 'web'
          ? '/src/main.web.ts'
          : mode === 'desktop'
            ? '/src/main.desktop.ts'
            : '/src/main.ts'
        return html
          .replace('<head>', `<head>\n    <meta name="guanmo-build-mode" content="${mode}" />`)
          .replace('/src/main.ts', entry)
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    fs: {
      allow: ['..'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: mode === 'web'
          ? undefined
          : {
              'vue-core': [
                'vue',
                'vue-i18n',
                'pinia',
                'primevue',
              ],
            },
      },
    },
  },
}))
