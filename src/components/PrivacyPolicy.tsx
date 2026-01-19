import React from 'react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <i className="fa-solid fa-arrow-left text-zinc-500"></i>
              </button>
            )}
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-6 h-6">
                  <defs>
                    <linearGradient id="pulse-grad-privacy" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e"/>
                      <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                  </defs>
                  <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-privacy)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Pulse</span>
            </a>
          </div>
          <a
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Back to App
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 md:p-12 shadow-sm">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-zinc-500 mb-8">Last updated: {currentDate} (Pulse Version 26.0.0)</p>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">1. Introduction</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Welcome to Pulse ("we," "our," or "us"). Pulse is an AI-powered communication platform developed by Logos Vision LLC.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
                application and services.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                By accessing or using Pulse, you agree to this Privacy Policy. If you do not agree with the terms of this
                Privacy Policy, please do not access the application.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">2. Information We Collect</h2>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">2.1 Information You Provide</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 mb-4 space-y-2">
                <li><strong>Account Information:</strong> When you sign up, we collect your name, email address, and profile picture through Google OAuth or other authentication providers.</li>
                <li><strong>Messages and Communications:</strong> Content you create, send, or receive through our messaging features.</li>
                <li><strong>Contacts:</strong> Contact information you choose to import or create within the app.</li>
                <li><strong>Calendar Data:</strong> When you connect your Google Calendar, we access your calendar events to provide scheduling features.</li>
                <li><strong>Email Data:</strong> When you connect your Gmail account, we access your emails to display them in the unified inbox and enable you to send, reply, and manage messages.</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">2.2 Documents and Knowledge Base</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 mb-4 space-y-2">
                <li><strong>Uploaded Documents:</strong> Files you upload to War Room projects including PDFs, Word documents, spreadsheets, images, and text files. We extract and store text content for AI analysis and search functionality.</li>
                <li><strong>Document Annotations:</strong> Highlights, notes, and annotations you create on documents.</li>
                <li><strong>Tags and Collections:</strong> Organizational metadata you create to categorize your documents.</li>
                <li><strong>AI-Generated Content:</strong> Summaries, keywords, and insights generated by AI from your documents.</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">2.3 Information Collected Automatically</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 mb-4 space-y-2">
                <li><strong>Usage Data:</strong> Information about how you interact with our app, including features used and time spent.</li>
                <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers.</li>
                <li><strong>Log Data:</strong> IP address, access times, and pages viewed.</li>
                <li><strong>Offline Cache Data:</strong> When you enable offline mode, we cache documents and app data locally on your device using IndexedDB and browser storage.</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">2.4 Device Permissions (Mobile App)</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                When using the Pulse mobile app, we may request access to certain device features. You can manage these permissions in your device settings at any time.
              </p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 mb-4 space-y-2">
                <li><strong>Microphone:</strong> Required for voice recording features including Vox modes (voice messages), real-time voice agents, meeting transcription, and voice commands. Audio is processed in real-time and voice recordings are only stored when you explicitly save them.</li>
                <li><strong>Camera:</strong> Required for Pulse Meetings video calls and Video Vox messages. Camera access is only activated when you explicitly join a video meeting or record a video message. Video streams are transmitted in real-time during calls and are not stored unless you explicitly enable recording. We do not access your camera in the background or when the app is not in use.</li>
                <li><strong>SMS (Send, Read, Receive):</strong> Required for sending and receiving text messages to contacts who are not on Pulse. This enables you to communicate with anyone directly from the Pulse app. SMS messages are processed through your device's native messaging system. We only access SMS when you explicitly use the messaging feature, and message content is not stored on our servers.</li>
                <li><strong>Contacts:</strong> Required to display your device contacts for quick recipient selection when composing messages or SMS. Contact data is accessed locally on your device and is not uploaded to our servers unless you explicitly choose to sync contacts to your Pulse account.</li>
                <li><strong>Vibration:</strong> Used for haptic feedback during interactions such as button presses and notifications.</li>
                <li><strong>Network State:</strong> Used to detect connectivity status and optimize data synchronization.</li>
                <li><strong>Wake Lock:</strong> Used to keep your device awake during active voice sessions, video calls, and audio playback to prevent interruptions.</li>
              </ul>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                <strong>Important:</strong> All device permissions are optional. Core features of Pulse work without granting these permissions. You will be prompted to grant permissions only when you attempt to use a feature that requires them, and you can deny or revoke permissions at any time through your device's settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">3. How We Use Your Information</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li>Provide, operate, and maintain our services</li>
                <li>Improve, personalize, and expand our services</li>
                <li>Enable AI-powered features such as smart replies, meeting summaries, voice transcription, and scheduling assistance</li>
                <li>Process and sync your calendar events for scheduling features</li>
                <li>Display, send, and manage your emails through our unified inbox</li>
                <li>Aggregate communications from multiple platforms (Gmail, Slack, SMS) in one view</li>
                <li>Process uploaded documents to extract text content using OCR and file parsing technologies</li>
                <li>Generate AI-powered summaries, keywords, and insights from your documents</li>
                <li>Enable full-text search across your document library</li>
                <li>Facilitate document sharing and collaboration with other users</li>
                <li>Cache content locally on your device for offline access</li>
                <li>Communicate with you about updates, security alerts, and support</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">4. Google API Services</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Pulse uses Google API Services, including Google OAuth for authentication, Google Calendar API for
                calendar synchronization, Gmail API for email integration, Google People API for contacts, and
                Google Drive API for archive export. Our use and transfer of information received from Google APIs adheres to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-500 hover:text-rose-600 underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Specifically, we only request the minimum permissions necessary for each feature:
              </p>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2 mt-4">4.1 Authentication Permissions</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
                <li><strong>email:</strong> To identify your account and display your email address</li>
                <li><strong>profile:</strong> To display your name and profile photo within the app</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">4.2 Google Calendar Permissions</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
                <li><strong>calendar.readonly:</strong> To read your calendar events for AI-powered scheduling insights and display your schedule</li>
                <li><strong>calendar.events:</strong> To create, update, and delete calendar events on your behalf when you use the calendar features</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">4.3 Gmail Permissions</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
                <li><strong>gmail.readonly:</strong> To read your email messages and display them in the unified inbox</li>
                <li><strong>gmail.send:</strong> To send emails on your behalf when you compose and send messages through Pulse</li>
                <li><strong>gmail.compose:</strong> To create and save email drafts</li>
                <li><strong>gmail.modify:</strong> To manage your emails including marking as read/unread, starring, archiving, and organizing with labels</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">4.4 Google Contacts Permissions</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
                <li><strong>contacts.readonly:</strong> To import and display your Google contacts, enabling quick recipient selection when composing emails and providing contact information within the app</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">4.5 Google Drive Permissions</h3>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-4">
                <li><strong>drive.file:</strong> To export and backup your archived content (message transcripts, meeting notes, AI summaries, Vox recordings) to your Google Drive. This permission only allows access to files and folders created by Pulse - we cannot access any other files in your Drive</li>
              </ul>

              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-2">4.6 Data Handling</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Your Google data is accessed in real-time and is not permanently stored on our servers. Email and calendar
                data is cached locally in your browser for performance and offline access. You can revoke Pulse's access
                to your Google account at any time through your account settings or directly at{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-500 hover:text-rose-600 underline"
                >
                  Google Account Permissions
                </a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">5. Data Sharing and Disclosure</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li><strong>Service Providers:</strong> With trusted third-party services that help us operate our platform (e.g., Supabase for database, Google for authentication)</li>
                <li><strong>AI Processing:</strong> Anonymized or pseudonymized data may be processed by AI services (Google Gemini, OpenAI, Anthropic, AssemblyAI, ElevenLabs) to provide intelligent features including text generation, voice transcription, and text-to-speech</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">6. Document Sharing and Collaboration</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Pulse allows you to share documents and projects with other users. When you use sharing features:
              </p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li><strong>Direct Sharing:</strong> When you share a document or project with specific users, they can access the content according to the permissions you set (view, comment, or edit).</li>
                <li><strong>Public Links:</strong> You can create public links to documents. Anyone with the link can access the document without signing in, subject to the permissions you configure.</li>
                <li><strong>Collaboration Data:</strong> When sharing is enabled, we store sharing permissions, activity logs, and collaboration metadata to facilitate teamwork.</li>
                <li><strong>Expiration:</strong> You can set expiration dates for shares. Expired shares are automatically revoked.</li>
                <li><strong>Revocation:</strong> You can revoke sharing access at any time through the document or project settings.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">7. Data Security</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li>All data is encrypted in transit using TLS/SSL</li>
                <li>Data at rest is encrypted using AES-256 encryption</li>
                <li>We use secure authentication through OAuth 2.0</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication for all internal systems</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">8. Offline Storage and PWA</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Pulse can be installed as a Progressive Web App (PWA) and supports offline functionality:
              </p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li><strong>Local Storage:</strong> We use IndexedDB and browser localStorage to cache your documents, messages, and app data for offline access.</li>
                <li><strong>Service Worker:</strong> A service worker caches app assets and enables offline functionality. You can clear this cache through your browser settings.</li>
                <li><strong>Sync:</strong> When you reconnect to the internet, any changes made offline are synchronized with our servers.</li>
                <li><strong>Control:</strong> You can disable offline caching through the app settings or by uninstalling the PWA.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">9. Data Retention</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                We retain your data for as long as your account is active or as needed to provide services.
                You can request deletion of your account and associated data at any time by contacting us.
                Some data may be retained for legal compliance purposes. Uploaded documents and their extracted
                content are retained until you delete them or delete your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">10. Your Rights</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify inaccurate personal data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to processing of your personal data</li>
                <li>Withdraw consent at any time</li>
                <li>Delete individual documents or entire projects</li>
                <li>Revoke sharing access you have granted to others</li>
                <li>Clear locally cached data through browser settings</li>
                <li>Disconnect third-party integrations (Google Calendar, Gmail, etc.) through your account settings</li>
                <li>Revoke Pulse's access to your Google account entirely via your account menu or at{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-500 hover:text-rose-600 underline"
                  >
                    Google Account Permissions
                  </a>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">11. Children's Privacy</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Pulse is not intended for use by children under 13 years of age. We do not knowingly collect
                personal information from children under 13. If you become aware that a child has provided
                us with personal information, please contact us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">12. Changes to This Policy</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                We may update this Privacy Policy from time to time. We will notify you of any changes by
                posting the new Privacy Policy on this page and updating the "Last updated" date.
                You are advised to review this Privacy Policy periodically.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">13. Contact Us</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-6">
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">Logos Vision LLC</p>
                <p className="text-zinc-600 dark:text-zinc-400">Email: privacy@logosvision.org</p>
                <p className="text-zinc-600 dark:text-zinc-400">Website: https://logosvision.org</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
            <a href="/" className="hover:text-rose-500 transition">Home</a>
            <span>|</span>
            <a href="/terms" className="hover:text-rose-500 transition">Terms of Service</a>
            <span>|</span>
            <a href="mailto:privacy@logosvision.org" className="hover:text-rose-500 transition">Contact</a>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Logos Vision LLC. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
