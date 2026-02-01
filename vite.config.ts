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
                // React core ecosystem - must load first (includes react, react-dom, scheduler, jsx-runtime)
                if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler') ||
                    id.match(/\/react\/[^\/]*\.js$/)) {
                  return 'vendor-react';
                }
                // lucide-react in separate chunk that loads after React
                if (id.includes('lucide-react')) {
                  return 'lucide-icons';
                }
              }

              // Supabase (immediate load for auth)
              if (id.includes('node_modules/@supabase')) {
                return 'vendor-supabase';
              }

              // Router (immediate load)
              if (id.includes('node_modules/react-router')) {
                return 'vendor-router';
              }

              // Document processors (LAZY LOAD - separate chunks)
              if (id.includes('xlsxProcessor')) return 'processor-xlsx';
              if (id.includes('pdfProcessor')) return 'processor-pdf';
              if (id.includes('docxProcessor')) return 'processor-docx';

              // AI SDKs (lazy load when needed)
              if (id.includes('node_modules/openai')) return 'vendor-ai-openai';
              if (id.includes('node_modules/@anthropic-ai/sdk')) return 'vendor-ai-anthropic';
              if (id.includes('node_modules/@google/generative-ai')) return 'vendor-ai-google';

              // Route-specific components (lazy loaded)
              if (id.includes('components/decisions/')) return 'route-decisions';
              if (id.includes('components/WarRoom/')) return 'route-warroom';
              if (id.includes('components/Email')) return 'route-email';
              if (id.includes('components/Calendar')) return 'route-calendar';
              if (id.includes('components/AILab')) return 'route-ailab';
              if (id.includes('components/Messages')) return 'route-messages';
              if (id.includes('components/LiveDashboard')) return 'route-live-dashboard';
              if (id.includes('components/Voxer')) return 'route-voxer';
              if (id.includes('components/SMS')) return 'route-sms';
              if (id.includes('components/Meetings')) return 'route-meetings';
              if (id.includes('components/Contacts')) return 'route-contacts';
              if (id.includes('components/Archives')) return 'route-archives';
              if (id.includes('components/Settings')) return 'route-settings';
              if (id.includes('components/Dashboard')) return 'route-dashboard';
              if (id.includes('components/AdminDashboard')) return 'route-admin';
              if (id.includes('components/MessageAnalytics')) return 'route-analytics';
              if (id.includes('components/UnifiedSearchRedesign')) return 'route-search';
              if (id.includes('components/TestMatrix')) return 'route-test';
              if (id.includes('components/Analytics')) return 'route-analytics-dash';

              // Split utility bundles further
              if (id.includes('src/enhancements/')) {
                if (id.includes('ai/')) return 'enhancements-ai';
                if (id.includes('analytics/')) return 'enhancements-analytics';
                if (id.includes('collaboration/')) return 'enhancements-collab';
                return 'enhancements-utils';
              }

              // Message Enhancement Bundles
              if (id.includes('MessageEnhancements/BundleAI')) return 'enhancements-ai';
              if (id.includes('MessageEnhancements/BundleAnalytics')) return 'enhancements-analytics';
              if (id.includes('MessageEnhancements/BundleCollaboration')) return 'enhancements-collaboration';
              if (id.includes('MessageEnhancements/BundleProductivity')) return 'enhancements-productivity';
              if (id.includes('MessageEnhancements/BundleIntelligence')) return 'enhancements-intelligence';
              if (id.includes('MessageEnhancements/BundleProactive')) return 'enhancements-proactive';
              if (id.includes('MessageEnhancements/BundleCommunication')) return 'enhancements-communication';
              if (id.includes('MessageEnhancements/BundleAutomation')) return 'enhancements-automation';
              if (id.includes('MessageEnhancements/BundleSecurity')) return 'enhancements-security';
              if (id.includes('MessageEnhancements/BundleMultimedia')) return 'enhancements-multimedia';

              // Split MessageEnhancements core components
              if (id.includes('MessageEnhancements/SmartCompose') ||
                  id.includes('MessageEnhancements/AICoach') ||
                  id.includes('MessageEnhancements/SmartComposeEnhanced') ||
                  id.includes('MessageEnhancements/AICoachEnhanced')) {
                return 'enhancements-ai-core';
              }

              if (id.includes('MessageEnhancements/MessageAnalyticsDashboard') ||
                  id.includes('MessageEnhancements/NetworkGraph') ||
                  id.includes('MessageEnhancements/ConversationFlowViz') ||
                  id.includes('MessageEnhancements/SentimentTimeline')) {
                return 'enhancements-analytics-core';
              }

              if (id.includes('MessageEnhancements/MessageMoodBadge') ||
                  id.includes('MessageEnhancements/RichMessageCard') ||
                  id.includes('MessageEnhancements/AnimatedReactions') ||
                  id.includes('MessageEnhancements/EmojiReactions')) {
                return 'enhancements-ui-core';
              }

              if (id.includes('MessageEnhancements/LiveCollaborators') ||
                  id.includes('MessageEnhancements/ThreadCollaboration') ||
                  id.includes('MessageEnhancements/CollaborativeAnnotations')) {
                return 'enhancements-collab-core';
              }

              // Remaining MessageEnhancements
              if (id.includes('MessageEnhancements') && !id.includes('Bundle')) {
                return 'enhancements-utils';
              }

              // UI libraries (lazy load)
              if (id.includes('node_modules/framer-motion')) return 'vendor-ui-motion';
              if (id.includes('node_modules/react-markdown')) return 'vendor-ui-markdown';

              // Utilities
              if (id.includes('node_modules/uuid') ||
                  id.includes('node_modules/date-fns') ||
                  id.includes('node_modules/fuse.js') ||
                  id.includes('node_modules/immer')) {
                return 'vendor-utils';
              }

              // Everything else in vendor
              if (id.includes('node_modules/')) {
                return 'vendor-other';
              }
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
