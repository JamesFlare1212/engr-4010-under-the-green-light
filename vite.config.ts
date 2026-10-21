import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**', '**/materials/**', '**/data/**', '**/content/**'] },
    proxy: {
      // String shorthand enables changeOrigin by default, causing the backend to reject LAN HTTP requests as cross-origin.
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false },
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true, changeOrigin: false, rewriteWsOrigin: false }
    }
  }
});
