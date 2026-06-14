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
      // `vite preview` (prod-mode local server) is pinned to 5173 so it reuses
      // the same Google OAuth redirect URI as the dev server — strictPort makes
      // it fail loudly instead of drifting to 4173 (which isn't a registered
      // redirect). Stop the dev server first; only one can hold 5173.
      preview: {
        port: Number(env.VITE_PORT) || 5173,
        strictPort: true,
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
                // React core — must be isolated so it loads before any chunk that calls React.memo
                if (id.includes('/node_modules/react/') ||
                    id.includes('/node_modules/react-dom/') ||
                    id.includes('/node_modules/react-is/') ||
                    id.includes('/node_modules/scheduler/')) {
                  return 'react-core';
                }

                // Framer Motion - heavy animation library
                if (id.includes('framer-motion')) {
                  return 'framer-motion';
                }

                // UI Icons
                if (id.includes('lucide-react')) {
                  return 'lucide-icons';
                }

                // Router
                if (id.includes('react-router')) {
                  return 'router';
                }

                // Supabase - backend client
                if (id.includes('@supabase')) {
                  return 'supabase';
                }

                // AI/ML Libraries - heavy, rarely needed on initial load
                if (id.includes('@anthropic-ai/sdk') ||
                    id.includes('openai') ||
                    id.includes('@google/genai')) {
                  return 'ai-providers';
                }

                // Chart Libraries - only needed on analytics pages
                if (id.includes('recharts') ||
                    id.includes('chart.js') ||
                    id.includes('d3')) {
                  return 'charts';
                }

                // Office document processors - large, rarely used
                if (id.includes('exceljs') ||
                    id.includes('docx') ||
                    id.includes('pdfjs')) {
                  return 'office-processors';
                }

                // MapLibre renderer — heavy (~200KB gz), only reached behind the
                // mapLibreRenderer flag via the lazy MapLibreCanvas. Keep it OUT
                // of the always-loaded vendor chunk so the default (Google) map
                // path doesn't pay for it. NOTE: match only `maplibre-gl` itself,
                // not its deps — some (e.g. supercluster) are shared with the
                // Google clustering and must stay in vendor.
                if (id.includes('/node_modules/maplibre-gl/')) {
                  return 'maplibre';
                }

                // Date/time utilities
                if (id.includes('date-fns') || id.includes('dayjs')) {
                  return 'date-utils';
                }

                // Everything else - smaller utilities
                return 'vendor';
              }

              // Split application bundles by feature
              if (id.includes('/src/components/')) {
                // Heavy feature components
                if (id.includes('/Messages')) return 'feature-messages';
                if (id.includes('/Relay')) return 'feature-relay';
                if (id.includes('/LiveDashboard')) return 'feature-dashboard';
                if (id.includes('/Email')) return 'feature-email';
                if (id.includes('/Analytics')) return 'feature-analytics';
                if (id.includes('/Calendar')) return 'feature-calendar';
                if (id.includes('/Decisions') || id.includes('/DecisionTask')) return 'feature-decisions';
                if (id.includes('/AILab') || id.includes('/AiLab')) return 'feature-ailab';
              }

              // Services layer — split into domain groups to avoid one 768 kB blob.
              //
              // CRITICAL: svc-core (the catchall) MUST NOT statically import any other
              // svc-* chunk at runtime, or chunks will form an init cycle and trip TDZ
              // ("Cannot access 'X' before initialization") on first load. When you add
              // a service that imports across domains, either co-locate it in the
              // importee's chunk via an explicit pattern below, OR convert the import
              // to `import type` if it is type-only.
              if (id.includes('/src/services/')) {
                // Voice / Relay — heavy, only needed in voice features
                if (id.includes('/relay/') ||
                    id.includes('voiceCommand') || id.includes('voiceIntelligence') ||
                    id.includes('voiceGuardrail') || id.includes('voiceRoom') ||
                    id.includes('voiceSearch') || id.includes('audioVoice') ||
                    id.includes('audioService') || id.includes('assemblyService') ||
                    id.includes('whisperService') || id.includes('elevenLabs') ||
                    id.includes('nativeVoice')) {
                  return 'svc-voice';
                }

                // AI / ML inference services
                // agentHandoffService and conversationIntelligenceService are pinned
                // here because they statically import realtimeAgentService /
                // geminiService at runtime — would otherwise create svc-core -> svc-ai.
                if (id.includes('geminiService') || id.includes('openAiService') ||
                    id.includes('anthropicService') || id.includes('perplexity') ||
                    id.includes('unifiedAIService') || id.includes('advancedAI') ||
                    id.includes('conversationalAI') || id.includes('ragService') ||
                    id.includes('realtimeAgent') || id.includes('aiInsights') ||
                    id.includes('aiFormatting') || id.includes('aiLab') ||
                    id.includes('smartCompose') || id.includes('proactiveSuggestions') ||
                    id.includes('toolRegistry') ||
                    id.includes('agentHandoffService') ||
                    id.includes('conversationIntelligenceService')) {
                  return 'svc-ai';
                }

                // Email domain
                // bulkOperations, emailCampaign, labelService, webhookService are
                // pinned here because they statically import emailSyncService /
                // gmailService / unifiedInboxService at runtime — would otherwise
                // create svc-core -> svc-email.
                if (id.includes('emailSync') || id.includes('emailAI') ||
                    id.includes('emailFilter') || id.includes('emailMeet') ||
                    id.includes('emailSearch') || id.includes('emailSignature') ||
                    id.includes('emailTemplate') || id.includes('emailAccounts') ||
                    id.includes('gmailService') || id.includes('enhancedEmail') ||
                    id.includes('offlineEmail') || id.includes('confidentialEmail') ||
                    id.includes('vacationResponder') || id.includes('emailService') ||
                    id.includes('unifiedInbox') ||
                    id.includes('bulkOperationsService') ||
                    id.includes('emailCampaignService') ||
                    id.includes('labelService') ||
                    id.includes('webhookService')) {
                  return 'svc-email';
                }

                // Calendar domain
                // videoConferencingService is pinned here because it statically
                // imports outlookCalendarService at runtime — would otherwise create
                // svc-core -> svc-calendar.
                if (id.includes('googleCalendar') || id.includes('calendarAI') ||
                    id.includes('customEventTypes') || id.includes('conflictDetection') ||
                    id.includes('meetingDetection') || id.includes('postMeeting') ||
                    id.includes('inviteService') || id.includes('briefingService') ||
                    id.includes('outlookCalendar') || id.includes('unifiedCalendar') ||
                    id.includes('videoConferencingService')) {
                  return 'svc-calendar';
                }

                // Messaging domain
                if (id.includes('messageChannel') || id.includes('messageService') ||
                    id.includes('messageAuto') || id.includes('messageEnhance') ||
                    id.includes('messageSummariz') || id.includes('messagesExport') ||
                    id.includes('pulseService') || id.includes('collaborationService') ||
                    id.includes('notificationService') || id.includes('notificationRule') ||
                    id.includes('pushNotification') || id.includes('attentionService') ||
                    id.includes('channelExport')) {
                  return 'svc-messaging';
                }

                // CRM / contacts / analytics
                // Note: contactCircle, contactSearchAI, todayFeed are co-located here
                // because they statically import relationshipIntelligenceService /
                // relationshipAlertService — keeping them in the same chunk avoids
                // the svc-core <-> svc-crm-analytics circular chunk dependency.
                // weeklyBriefingService and relationshipAutopilotService are pinned
                // here for the same reason (they statically import analyticsService,
                // relationshipHealthService, recognitionService, predictiveAnalyticsService,
                // contactGoalTypes runtime values).
                if (id.includes('/crm/') || id.includes('crmService') ||
                    id.includes('crmActions') || id.includes('leadScoring') ||
                    id.includes('contactEnrich') || id.includes('googleContacts') ||
                    id.includes('userContact') || id.includes('relationshipHealth') ||
                    id.includes('relationshipIntelligence') || id.includes('relationshipAlert') ||
                    id.includes('analyticsService') || id.includes('analyticsCollector') ||
                    id.includes('analyticsExport') || id.includes('decisionAnalytics') ||
                    id.includes('predictiveAnalytics') || id.includes('teamHealth') ||
                    id.includes('teamService') || id.includes('recognitionService') ||
                    id.includes('achievementService') || id.includes('outcomeService') ||
                    id.includes('contactCircle') || id.includes('contactSearchAI') ||
                    id.includes('contactGoal') || id.includes('todayFeed') ||
                    id.includes('weeklyBriefingService') ||
                    id.includes('relationshipAutopilotService')) {
                  return 'svc-crm-analytics';
                }

                // Storage / data / export — large but rarely on critical path.
                // authService and meetingService are pinned here because they
                // statically import dataService at runtime — would otherwise create
                // svc-core -> svc-storage. (This was the cycle that caused the
                // "Cannot access 'Ze' before initialization" deploy regression.)
                if (id.includes('dataService') || id.includes('dbService') ||
                    id.includes('archiveService') || id.includes('dataExport') ||
                    id.includes('dataPrivacy') || id.includes('dataRetention') ||
                    id.includes('backupSync') || id.includes('googleDrive') ||
                    id.includes('fileUpload') || id.includes('fileSecurity') ||
                    id.includes('virusScan') || id.includes('encryptionService') ||
                    id.includes('encryption.ts') || id.includes('warRoom') ||
                    id.includes('brainstorm') || id.includes('contextBank') ||
                    id.includes('savedSearch') || id.includes('/documentProcessors/') ||
                    id.includes('authService') || id.includes('meetingService')) {
                  return 'svc-storage';
                }

                // Everything else (settings, search, etc.)
                return 'svc-core';
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
          '@supabase/supabase-js',
          '@react-google-maps/api',
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
            globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
            // Inject the Web Push handlers (push / notificationclick /
            // notificationclose) into the GENERATED Workbox service worker.
            // VitePWA (generateSW) produces the active sw.js in production, so a
            // hand-written public/sw.js would be overwritten — the handlers have
            // to be imported here. sw-notifications.js self-registers its
            // listeners on import; without this, send-push (#101) delivers but
            // nothing displays the notification.
            importScripts: ['sw-notifications.js'],
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
            navigateFallback: null, // Vercel handles SPA routing; no SW nav fallback needed
            navigateFallbackDenylist: [] // empty — navigateFallback is disabled
          },
          devOptions: {
            enabled: false, // Enable in dev if needed
            type: 'module'
          }
        })
      ],
      define: {
        // GEMINI_API_KEY is intentionally NOT exposed to the client bundle.
        // All Gemini calls are routed through Supabase edge functions
        // (ai-router, gemini-embed, gemini-proxy, gemini-live-token) which
        // hold the master key as a server-side secret. Re-introducing these
        // defines would inline the key into every browser bundle at build time.
        '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '2.4.0'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom'],
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
