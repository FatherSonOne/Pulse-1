/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

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
              // React core - immediate load
              if (id.includes('node_modules/react') ||
                  id.includes('node_modules/react-dom') ||
                  id.includes('node_modules/react-router-dom')) {
                return 'vendor-react';
              }

              // AI SDKs - lazy load by provider (largest dependencies)
              if (id.includes('node_modules/openai')) {
                return 'vendor-ai-openai';
              }
              if (id.includes('node_modules/@anthropic-ai/sdk')) {
                return 'vendor-ai-anthropic';
              }
              if (id.includes('node_modules/@google/genai')) {
                return 'vendor-ai-google';
              }

              // UI libraries - split for optimal caching
              if (id.includes('node_modules/framer-motion')) {
                return 'vendor-ui-motion';
              }
              if (id.includes('node_modules/lucide-react') ||
                  id.includes('node_modules/react-icons')) {
                return 'vendor-ui-icons';
              }
              if (id.includes('node_modules/react-markdown')) {
                return 'vendor-ui-markdown';
              }

              // Supabase - needed for auth/data
              if (id.includes('node_modules/@supabase/supabase-js')) {
                return 'vendor-supabase';
              }

              // Utilities
              if (id.includes('node_modules/uuid') ||
                  id.includes('node_modules/date-fns') ||
                  id.includes('node_modules/fuse.js') ||
                  id.includes('node_modules/immer')) {
                return 'vendor-utils';
              }

              // Message Enhancement Bundles - lazy load by feature
              if (id.includes('MessageEnhancements/BundleAI')) {
                return 'enhancements-ai';
              }
              if (id.includes('MessageEnhancements/BundleAnalytics')) {
                return 'enhancements-analytics';
              }
              if (id.includes('MessageEnhancements/BundleCollaboration')) {
                return 'enhancements-collaboration';
              }
              if (id.includes('MessageEnhancements/BundleProductivity')) {
                return 'enhancements-productivity';
              }
              if (id.includes('MessageEnhancements/BundleIntelligence')) {
                return 'enhancements-intelligence';
              }
              if (id.includes('MessageEnhancements/BundleProactive')) {
                return 'enhancements-proactive';
              }
              if (id.includes('MessageEnhancements/BundleCommunication')) {
                return 'enhancements-communication';
              }
              if (id.includes('MessageEnhancements/BundleAutomation')) {
                return 'enhancements-automation';
              }
              if (id.includes('MessageEnhancements/BundleSecurity')) {
                return 'enhancements-security';
              }
              if (id.includes('MessageEnhancements/BundleMultimedia')) {
                return 'enhancements-multimedia';
              }

              // Core MessageEnhancements loaded immediately
              if (id.includes('MessageEnhancements') &&
                  !id.includes('Bundle')) {
                return 'enhancements-core';
              }
            }
          }
        },
        chunkSizeWarningLimit: 500,
        target: 'es2020',
        minify: isProduction ? 'terser' : 'esbuild',
        terserOptions: isProduction ? {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug', 'console.info']
          },
          mangle: {
            safari10: true
          },
          format: {
            comments: false
          }
        } : undefined,
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
          '@anthropic-ai/sdk',
          'openai',
          '@google/genai'
        ]
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg'],
          manifest: {
            name: 'Pulse - AI Communication Dashboard',
            short_name: 'Pulse',
            description: 'AI-native communication dashboard for teams',
            theme_color: '#09090b',
            background_color: '#09090b',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            icons: [
              {
                src: '/icons/icon-192.svg',
                sizes: '192x192',
                type: 'image/svg+xml'
              },
              {
                src: '/icons/icon-512.svg',
                sizes: '512x512',
                type: 'image/svg+xml'
              },
              {
                src: '/icons/icon-512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api\//],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                // Supabase API - Network First with cache fallback
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'supabase-api-cache',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 // 24 hours
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  },
                  networkTimeoutSeconds: 10
                }
              },
              {
                // Supabase Storage - Cache First
                urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'supabase-storage-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                // Image CDNs - Cache First
                urlPattern: /^https:\/\/(images\.unsplash\.com|cdn\.jsdelivr\.net)\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'image-cdn-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
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
