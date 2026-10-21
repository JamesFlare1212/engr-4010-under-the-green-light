import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**', '**/materials/**', '**/data/**', '**/content/**'] },
    proxy: {
      // 字符串简写会默认启用 changeOrigin，局域网 HTTP 请求会因此被后端误判为跨源。
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false },
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true, changeOrigin: false, rewriteWsOrigin: false }
    }
  }
});
