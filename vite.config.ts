import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@/lib/ui-localization',
        replacement: fileURLToPath(new URL('./src/lib/ui-localization-complete.ts', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/pdf-lib/') || id.includes('/pdfjs-dist/')) return 'vendor-pdf';
          if (id.includes('/jszip/')) return 'vendor-archive';
          return 'vendor-misc';
        },
      },
    },
  },
});
