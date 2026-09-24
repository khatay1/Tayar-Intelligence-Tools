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
          if (id.includes('/src/modules/website-builder/v2-ui/BuilderLegacySidebar.tsx') ||
              id.includes('/src/modules/website-builder/v2-ui/BuilderLegacyInspector.tsx')) return 'website-builder-legacy-editor';
          if (id.includes('/src/modules/website-builder/core/editor-operation-policy.ts') ||
              id.includes('/src/modules/website-builder/core/editor-native-operation.ts') ||
              id.includes('/src/modules/website-builder/core/editor-value-safety.ts') ||
              id.includes('/src/modules/website-builder/core/editor-inspector-model.ts') ||
              id.includes('/src/modules/website-builder/core/editor-command-adapters.ts')) return 'website-builder-operations';
          if (id.includes('/src/modules/website-builder/core/website-builder-rendering.ts') ||
              id.includes('/src/modules/website-builder/core/website-builder-output.ts') ||
              id.includes('/src/modules/website-builder/core/website-builder-config.ts')) return 'website-builder-rendering';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/pdf-lib/')) return 'vendor-pdf-lib';
          if (id.includes('/pdfjs-dist/')) return 'vendor-pdfjs';
          if (id.includes('/jszip/')) return 'vendor-archive';
          return 'vendor-misc';
        },
      },
    },
  },
});
