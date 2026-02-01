/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa'; // Temporarily disabled for build fix

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    const isDevelopment = mode === 'development';

    return {
      server: {
        port: Number(env.VITE_PORT) || 5173,
        host: '0.0.0.0',
      },
      build: {
        sourcemap: !isProduction, // Disable sourcemaps in production for smaller bundle
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                // React core - loads first
                if (id.includes('/react-dom/') || id.includes('/react/') ||
                    id.includes('scheduler') || id.match(/\/react\/[^\/]*\.js$/)) {
                  return 'react-vendor';
                }
                // lucide-react - separate chunk
                if (id.includes('lucide-react')) {
                  return 'lucide-icons';
                }
                // Router
                if (id.includes('react-router')) {
                  return 'router';
                }
                // Everything else
                return 'vendor';
              }
              // Application code stays in main bundle (no splitting)
            }
          }
        },
        chunkSizeWarningLimit: 600,
        target: 'es2020',
        minify: 'esbuild',
        esbuild: {
          drop: ['console', 'debugger'],
          keepNames: false,
        },
        reportCompressedSize: true,
        cssCodeSplit: true,
        assetsInlineLimit: 4096 // Inline assets smaller than 4kb
      },
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          '@supabase/supabase-js'
        ],
        exclude: [
          'lucide-react',
          '@anthropic-ai/sdk',
          'openai',
          '@google/genai',
          'exceljs'
        ]
      },
      plugins: [
        react(),
        // PWA plugin temporarily disabled for build fix - re-enable after resolving exceljs package issue
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          exclude: [
            'node_modules/',
            'src/test/',
            '**/*.d.ts',
            '**/*.config.*',
            '**/mockData.ts',
            '**/mock*.ts',
          ],
        },
      },
    };
});
