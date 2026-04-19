import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0', // 允许局域网设备通过 IP 访问
    proxy: {
      '/api/tts': {
        target: 'https://fanyi.baidu.com',
        changeOrigin: true,
        secure: true,
        headers: {
          Referer: 'https://fanyi.baidu.com/',
          Origin: 'https://fanyi.baidu.com',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
        rewrite: (path) => path.replace(/^\/api\/tts/, '/gettts'),
      },
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
