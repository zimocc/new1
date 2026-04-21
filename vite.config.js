import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: './', // 使用相对路径，兼容 Live Server 和子目录部署
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
      '/api/youdao': {
        target: 'https://dict.youdao.com',
        changeOrigin: true,
        secure: true,
        headers: {
          Referer: 'https://dict.youdao.com/',
          Origin: 'https://dict.youdao.com',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
        rewrite: (path) => path.replace(/^\/api\/youdao/, '/dictvoice'),
      },
      '/api/google': {
        target: 'https://ssl.gstatic.com',
        changeOrigin: true,
        secure: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
        rewrite: (path) => {
           const url = new URL(path, 'http://localhost');
           const text = url.searchParams.get('text') || '';
           const word = text.toLowerCase().trim();
           return `/dictionary/static/sounds/oxford/${encodeURIComponent(word)}--_us_1.mp3`;
        }
      },
      '/api/google_dy': {
        target: 'https://translate.google.com',
        changeOrigin: true,
        secure: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
        },
        rewrite: (path) => {
           const url = new URL(path, 'http://localhost');
           const text = url.searchParams.get('text') || '';
           return `/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(text)}`;
        }
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
