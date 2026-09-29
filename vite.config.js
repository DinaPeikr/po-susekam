import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: {
      // Токены и миксины доступны в каждом компоненте без ручного @use
      scss: { additionalData: '@use "@/styles/variables" as *;\n' },
    },
  },
  server: {
    port: 5173,
    // Функции Pages живут в wrangler pages dev (npm run dev:api)
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
});
