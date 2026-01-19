import React from 'react';

interface TermsOfServiceProps {
  onBack?: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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
                    <linearGradient id="pulse-grad-terms" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e"/>
                      <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                  </defs>
                  <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-terms)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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
            Terms of Service
          </h1>
          <p className="text-zinc-500 mb-8">Last updated: {currentDate}</p>

          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                By accessing or using Pulse ("the Service"), provided by Logos Vision LLC ("we," "us," or "our"),
                you agree to be bound by these Terms of Service. If you disagree with any part of these terms,
                you may not access the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">2. Description of Service</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Pulse is an AI-powered communication and productivity platform that provides messaging,
                calendar integration, meeting management, and AI-assisted features to help users
                communicate and collaborate more effectively.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">3. User Accounts</h2>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must notify us immediately of any unauthorized access to your account</li>
                <li>You are responsible for all activities that occur under your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">4. Acceptable Use</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Transmit spam, malware, or other malicious content</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Use the Service to infringe on intellectual property rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">5. User Content</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                You retain ownership of content you create or upload. By using the Service, you grant us
                a license to use, store, and process your content as necessary to provide the Service.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                You are solely responsible for your content and must ensure it does not violate any
                laws or third-party rights.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">6. Third-Party Integrations</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                The Service integrates with third-party services (e.g., Google Calendar, Google OAuth).
                Your use of these integrations is subject to the respective third-party terms of service.
                We are not responsible for the availability or functionality of third-party services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">7. AI Features</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                The Service includes AI-powered features. While we strive for accuracy, AI-generated
                content may contain errors. You should review and verify AI suggestions before acting
                on them. We are not liable for decisions made based on AI-generated content.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">8. Intellectual Property</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                The Service, including its design, features, and content, is owned by Logos Vision LLC
                and protected by intellectual property laws. You may not copy, modify, distribute, or
                create derivative works without our express permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">9. Disclaimer of Warranties</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
                WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">10. Limitation of Liability</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF
                THE SERVICE.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">11. Termination</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                We may terminate or suspend your account at any time for violation of these terms.
                You may terminate your account at any time by contacting us. Upon termination,
                your right to use the Service will cease immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">12. Changes to Terms</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                We reserve the right to modify these terms at any time. We will notify users of
                significant changes. Continued use of the Service after changes constitutes
                acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">13. Governing Law</h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                These terms shall be governed by and construed in accordance with the laws of the
                United States, without regard to conflict of law principles.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">14. Contact</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                For questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-6">
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">Logos Vision LLC</p>
                <p className="text-zinc-600 dark:text-zinc-400">Email: legal@logosvision.org</p>
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
            <a href="/privacy" className="hover:text-rose-500 transition">Privacy Policy</a>
            <span>|</span>
            <a href="mailto:legal@logosvision.org" className="hover:text-rose-500 transition">Contact</a>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Logos Vision LLC. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
