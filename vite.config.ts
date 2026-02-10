/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    const isDevelopment = mode === 'development';

    // Build-time validation for production
    if (isProduction) {
      if (!env.VITE_SUPABASE_URL) {
        console.error('\n❌ PRODUCTION BUILD ERROR:');
        console.error('Missing: VITE_SUPABASE_URL\n');
        throw new Error('Cannot build without VITE_SUPABASE_URL');
      }
      if (!env.VITE_SUPABASE_ANON_KEY) {
        console.error('\n❌ PRODUCTION BUILD ERROR:');
        console.error('Missing: VITE_SUPABASE_ANON_KEY\n');
        throw new Error('Cannot build without VITE_SUPABASE_ANON_KEY');
      }
      console.log('✅ Supabase environment variables validated for production build');
    }

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
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
          manifest: {
            name: 'Pulse - Team Communication',
            short_name: 'Pulse',
            description: 'Advanced team communication and collaboration platform',
            theme_color: '#10b981',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait-primary',
            scope: '/',
            start_url: '/',
            icons: [
              {
                src: '/icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/icons/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/icons/icon-192x192-maskable.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: '/icons/icon-512x512-maskable.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ],
            shortcuts: [
              {
                name: 'New Message',
                short_name: 'Message',
                description: 'Start a new conversation',
                url: '/messages?action=new',
                icons: [{ src: '/icons/message-shortcut.png', sizes: '96x96' }]
              },
              {
                name: 'Voice Room',
                short_name: 'Voice',
                description: 'Join voice room',
                url: '/voice',
                icons: [{ src: '/icons/voice-shortcut.png', sizes: '96x96' }]
              }
            ],
            share_target: {
              action: '/share',
              method: 'POST',
              enctype: 'multipart/form-data',
              params: {
                title: 'title',
                text: 'text',
                url: 'url',
                files: [
                  {
                    name: 'file',
                    accept: ['image/*', 'video/*', 'audio/*', 'application/pdf']
                  }
                ]
              }
            }
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            maximumFileSizeToCacheInBytes: 5000000, // 5MB - allow larger vendor chunks
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'supabase-api',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 // 24 hours
                  },
                  networkTimeoutSeconds: 10
                }
              },
              {
                urlPattern: /^https:\/\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-stylesheets'
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  }
                }
              }
            ],
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api/, /^\/auth/]
          },
          devOptions: {
            enabled: false, // Enable in dev if needed
            type: 'module'
          }
        })
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
