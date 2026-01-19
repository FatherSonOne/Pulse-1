import React, { useState } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [activeTab, setActiveTab] = useState<'communication' | 'orchestration'>('communication');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogoClick = () => {
    window.location.href = '/?signin';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden selection:bg-rose-500/30 selection:text-rose-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <div className="w-10 h-10 rounded-xl bg-[#0f172a] flex items-center justify-center shadow-lg border border-zinc-800 animate-pulse-slow group-hover:scale-110 transition-transform duration-300">
              <svg viewBox="0 0 64 64" className="w-6 h-6">
                <defs>
                  <linearGradient id="pulse-grad-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
                <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-nav)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">Pulse</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <button onClick={() => scrollToSection('ecosystem')} className="hover:text-white transition">Ecosystem</button>
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition">Features</button>
            <button onClick={() => scrollToSection('scenarios')} className="hover:text-white transition">Scenarios</button>
            <button onClick={() => scrollToSection('download')} className="hover:text-white transition">Download</button>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg text-sm font-semibold transition hover:scale-105 active:scale-95"
            >
              Log In
            </button>
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-lg text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:scale-105 active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-rose-500/10 rounded-full blur-[120px] opacity-50 mix-blend-screen animate-pulse-slow"></div>
          <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] opacity-30 mix-blend-screen animate-float"></div>
          <div className="absolute top-40 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] opacity-30 mix-blend-screen" style={{ animation: 'float 4s ease-in-out infinite', animationDelay: '1s' }}></div>
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-md rounded-full text-sm font-medium text-rose-300 mb-8 border border-rose-500/20 shadow-lg shadow-rose-900/20 animate-fade-in animation-delay-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            The Central Nervous System for High-Performance Teams
          </div>

          {/* Pulsing Glow Behind Hero Text */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[900px] h-[500px] pointer-events-none z-0">
            <div 
              className="absolute inset-0 bg-gradient-to-r from-rose-500/30 via-pink-500/30 to-purple-500/30 rounded-full blur-[120px]"
              style={{
                animation: 'pulse-glow 3s ease-in-out infinite',
              }}
            ></div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold mb-8 leading-[1.15] tracking-tight animate-fade-in animation-delay-200 relative z-10 pb-4">
            Orchestrate Your
            <span className="block bg-gradient-to-r from-rose-400 via-pink-500 to-purple-500 bg-clip-text text-transparent animate-fade-in animation-delay-300 relative z-10 pt-3 pb-1">
              Digital Intelligence
            </span>
          </h1>

          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in animation-delay-400">
            Pulse unifies communication, relationship management, and automation into a single living interface. It's not just a chat app—it's your team's collective brain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-500">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-950 rounded-xl text-lg font-bold hover:bg-zinc-200 transition shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              Launch Pulse
              <i className="fa-solid fa-rocket"></i>
            </button>
            <button
              onClick={() => scrollToSection('ecosystem')}
              className="w-full sm:w-auto px-8 py-4 bg-zinc-900/50 border border-zinc-800 text-white rounded-xl text-lg font-medium hover:bg-zinc-800 transition flex items-center justify-center gap-2 animate-float"
            >
              Explore the Ecosystem
              <i className="fa-solid fa-arrow-down"></i>
            </button>
          </div>
        </div>
      </section>

      {/* The Trinity / Ecosystem Section */}
      <section id="ecosystem" className="py-24 px-6 bg-zinc-900/30 border-y border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6">The Trinity of Productivity</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              Three powerful systems working in perfect harmony to handle every aspect of your business operations.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Pulse Card */}
            <div className="relative group animate-fade-in animation-delay-200">
              <div className="absolute inset-0 bg-rose-500/20 rounded-3xl blur-xl group-hover:bg-rose-500/30 transition duration-500 opacity-0 group-hover:opacity-100"></div>
              <div className="relative h-full bg-zinc-950 border border-zinc-800 rounded-3xl p-8 hover:border-rose-500/50 transition duration-300 flex flex-col hover:-translate-y-2">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-rose-500/50 group-hover:scale-110 transition duration-300">
                  <i className="fa-solid fa-heart-pulse text-2xl text-rose-500"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Pulse</h3>
                <div className="text-sm font-bold text-rose-500 tracking-wider uppercase mb-4">Communication & Intelligence</div>
                <p className="text-zinc-400 mb-6 flex-grow">
                  The voice and ears of your organization. Real-time chat, video, and meetings enhanced by multimodal AI that listens, summarizes, and organizes.
                </p>
                <ul className="space-y-3 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500"></i> Unified Inbox
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500"></i> Gemini Live Voice Rooms
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-rose-500"></i> Context-Aware Synthesis
                  </li>
                </ul>
              </div>
            </div>

            {/* Logos Vision Card */}
            <div className="relative group animate-fade-in animation-delay-300">
              <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl group-hover:bg-blue-500/30 transition duration-500 opacity-0 group-hover:opacity-100"></div>
              <div className="relative h-full bg-zinc-950 border border-zinc-800 rounded-3xl p-8 hover:border-blue-500/50 transition duration-300 flex flex-col hover:-translate-y-2">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-blue-500/50 group-hover:scale-110 transition duration-300">
                  <i className="fa-solid fa-eye text-2xl text-blue-500"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Logos Vision</h3>
                <div className="text-sm font-bold text-blue-500 tracking-wider uppercase mb-4">CRM & Relationships</div>
                <p className="text-zinc-400 mb-6 flex-grow">
                  The memory of your organization. A deep, integrated CRM that tracks every interaction, project, and relationship detail automatically.
                </p>
                <ul className="space-y-3 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-blue-500"></i> Dynamic Client Profiles
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-blue-500"></i> Project Timeline Sync
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-blue-500"></i> Relationship Mapping
                  </li>
                </ul>
              </div>
            </div>

            {/* Entomate Card */}
            <div className="relative group animate-fade-in animation-delay-400">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-3xl blur-xl group-hover:bg-emerald-500/30 transition duration-500 opacity-0 group-hover:opacity-100"></div>
              <div className="relative h-full bg-zinc-950 border border-zinc-800 rounded-3xl p-8 hover:border-emerald-500/50 transition duration-300 flex flex-col hover:-translate-y-2">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-emerald-500/50 group-hover:scale-110 transition duration-300">
                  <i className="fa-solid fa-robot text-2xl text-emerald-500"></i>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Entomate</h3>
                <div className="text-sm font-bold text-emerald-500 tracking-wider uppercase mb-4">Automation & Workflow</div>
                <p className="text-zinc-400 mb-6 flex-grow">
                  The hands of your organization. Intelligent agents that execute tasks, move data between systems, and automate complex workflows.
                </p>
                <ul className="space-y-3 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-emerald-500"></i> Workflow Builders
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-emerald-500"></i> Auto-Task Execution
                  </li>
                  <li className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-emerald-500"></i> Cross-Platform Actions
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categorical Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6 animate-fade-in">
            <div>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">Engineered for Impact</h2>
              <p className="text-zinc-400 text-lg">Comprehensive tools designed for modern digital teams.</p>
            </div>
            
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setActiveTab('communication')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'communication' 
                    ? 'bg-zinc-800 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Communication
              </button>
              <button
                onClick={() => setActiveTab('orchestration')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'orchestration' 
                    ? 'bg-zinc-800 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Orchestration
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
            {activeTab === 'communication' ? (
              <>
                <FeatureCard
                  icon="fa-solid fa-inbox"
                  color="rose"
                  title="Unified Inbox"
                  description="Consolidate Slack, Email, SMS, and internal chats into a single, prioritized stream. Never miss a critical message again."
                  tags={['Email', 'Slack', 'SMS', 'WhatsApp']}
                />
                <FeatureCard
                  icon="fa-solid fa-microphone-lines"
                  color="blue"
                  title="Gemini Live Rooms"
                  description="Drop-in voice and video rooms powered by Google Gemini. Get real-time translation, transcription, and AI moderation."
                  tags={['Voice', 'Video', 'Screen Share', 'AI Host']}
                />
                <FeatureCard
                  icon="fa-solid fa-wand-magic-sparkles"
                  color="purple"
                  title="Context-Aware Chat"
                  description="The AI understands your project history. Get smart replies, instant summaries of long threads, and auto-drafted responses."
                  tags={['Smart Reply', 'Summarization', 'Context Retrieval']}
                />
                <FeatureCard
                  icon="fa-solid fa-file-audio"
                  color="amber"
                  title="Meeting Intelligence"
                  description="Every meeting is transcribed, summarized, and mined for action items. Decisions are automatically logged to the project record."
                  tags={['Transcription', 'Action Items', 'Decision Log']}
                />
              </>
            ) : (
              <>
                <FeatureCard
                  icon="fa-solid fa-chess-board"
                  color="emerald"
                  title="War Room Mode"
                  description="A dedicated high-focus interface for critical incidents or launches. Real-time telemetry, role-based dashboards, and zero distractions."
                  tags={['Focus Mode', 'Real-time', 'Incident Ops']}
                />
                <FeatureCard
                  icon="fa-solid fa-heart-crack"
                  color="red"
                  title="Social Health Monitor"
                  description="AI analyzes communication patterns to detect burnout risks, friction, and siloing before they become personnel issues."
                  tags={['Sentiment Analysis', 'Burnout Detection']}
                />
                <FeatureCard
                  icon="fa-solid fa-gavel"
                  color="indigo"
                  title="Decision Tracking"
                  description="Formalize informal chats. Turn a conversation into a tracked decision with voting, reasoning logs, and outcome monitoring."
                  tags={['Proposals', 'Voting', 'Audit Trail']}
                />
                <FeatureCard
                  icon="fa-solid fa-book-bookmark"
                  color="cyan"
                  title="Channel Artifacts"
                  description="Turn messy chat history into clean, living documentation. The AI compiles links, files, and decisions into a wiki-like view."
                  tags={['Knowledge Base', 'Auto-Wiki', 'File Mgmt']}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Use Case Scenarios */}
      <section id="scenarios" className="py-24 px-6 bg-gradient-to-b from-zinc-900/20 to-zinc-950 border-t border-zinc-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">See It In Action</h2>
            <p className="text-zinc-400 text-lg">Real-world workflows powered by the Pulse ecosystem.</p>
          </div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent -translate-y-1/2 z-0"></div>

            <div className="grid lg:grid-cols-3 gap-8 relative z-10">
              {/* Step 1 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl relative animate-fade-in animation-delay-200 hover:-translate-y-2 transition-transform duration-300">
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-rose-500 font-bold">1</div>
                <div className="text-rose-400 font-bold mb-2">PULSE</div>
                <h4 className="text-xl font-bold text-white mb-2">The Signal</h4>
                <p className="text-zinc-400 text-sm">
                  A high-priority email arrives from a key client about a new grant opportunity. Pulse flags it as "Urgent", summarizes the key requirements, and routes it to the #grants channel.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl relative animate-fade-in animation-delay-300 hover:-translate-y-2 transition-transform duration-300">
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-blue-500 font-bold">2</div>
                <div className="text-blue-400 font-bold mb-2">LOGOS VISION</div>
                <h4 className="text-xl font-bold text-white mb-2">The Context</h4>
                <p className="text-zinc-400 text-sm">
                  The system automatically links the message to the Client Record. It pulls up past grant history, success rates, and the assigned relationship manager, displaying this context alongside the chat.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl relative animate-fade-in animation-delay-400 hover:-translate-y-2 transition-transform duration-300">
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-emerald-500 font-bold">3</div>
                <div className="text-emerald-400 font-bold mb-2">ENTOMATE</div>
                <h4 className="text-xl font-bold text-white mb-2">The Action</h4>
                <p className="text-zinc-400 text-sm">
                  An "Apply" workflow is triggered. Entomate creates a task for the Grant Writer, schedules a kickoff meeting for the team based on availability, and drafts an acknowledgment email.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold mb-8 animate-fade-in">Available Everywhere</h2>
          <p className="text-zinc-400 text-lg mb-12 animate-fade-in animation-delay-200">
            Seamlessly sync your team across all devices. Download the app for your preferred platform.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <DownloadButton 
              icon="fa-brands fa-windows" 
              platform="Windows" 
              subtext="x64 / ARM64" 
              active={false}
            />
            <DownloadButton 
              icon="fa-brands fa-apple" 
              platform="macOS / iOS" 
              subtext="Universal" 
              active={false}
            />
            
            {/* Android Card - Dual Options */}
            <div className="group p-6 rounded-2xl border bg-zinc-800 border-zinc-700 hover:border-rose-500/50 transition duration-300 flex flex-col items-center justify-center gap-4 w-full">
              <i className="fa-brands fa-android text-4xl text-zinc-300 group-hover:text-white transition"></i>
              <div className="text-center">
                <div className="font-bold text-white group-hover:text-rose-400 transition">Android</div>
                <div className="text-xs text-zinc-500">Play Store & APK</div>
              </div>
              
              <div className="flex gap-2 w-full mt-2">
                <a 
                  href="https://play.google.com/store/apps/details?id=io.qntmpulse.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-600 hover:bg-zinc-700 hover:border-green-500/50 text-xs font-medium text-center text-zinc-300 hover:text-white transition flex items-center justify-center gap-2"
                  title="Download from Play Store"
                >
                  <i className="fa-brands fa-google-play"></i>
                  Store
                </a>
                <a 
                  href="/downloads/pulse-android.apk"
                  download
                  onClick={() => {
                    const instructions = document.getElementById('android-instructions');
                    if (instructions) instructions.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex-1 px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-600 hover:bg-zinc-700 hover:border-rose-500/50 text-xs font-medium text-center text-zinc-300 hover:text-white transition flex items-center justify-center gap-2"
                  title="Download APK Package"
                >
                  <i className="fa-solid fa-download"></i>
                  APK
                </a>
              </div>
            </div>

            <DownloadButton 
              icon="fa-solid fa-robot" 
              platform="F-Droid" 
              subtext="Open Source" 
              active={false}
            />
          </div>
          
          {/* Android Instructions */}
          <div id="android-instructions" className="mt-16 max-w-2xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-left">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <i className="fa-brands fa-android text-rose-500"></i>
              How to Install on Android
            </h3>
            
            <div className="mb-8 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
               <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                 <i className="fa-brands fa-google-play text-green-500"></i>
                 Recommended: Play Store
               </h4>
               <p className="text-sm text-zinc-400 mb-3">
                 The easiest way to install Pulse is through the Google Play Store. You'll get automatic updates and security checks.
               </p>
               <a 
                 href="https://play.google.com/store/apps/details?id=io.qntmpulse.app" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 font-medium"
               >
                 Go to Play Store <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
               </a>
            </div>

            <h4 className="font-bold text-white mb-4">Manual APK Installation</h4>
            <ol className="space-y-4 text-zinc-400 relative border-l border-zinc-800 ml-3 pl-8">
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">1</span>
                <strong className="text-white block mb-1">Download the APK</strong>
                Click the "APK" button above to download the <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-rose-400 text-xs">pulse-android.apk</code> file.
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">2</span>
                <strong className="text-white block mb-1">Allow Installation</strong>
                Open the downloaded file. You may see a security warning. Go to Settings and allow installing apps from this source (Chrome/Files).
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">3</span>
                <strong className="text-white block mb-1">Install & Launch</strong>
                Tap "Install" and wait for the process to complete. Once finished, open the Pulse app and log in!
              </li>
            </ol>
            <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-200">
              <i className="fa-solid fa-circle-info mr-2"></i>
              Note: This is a preview release. You may need to disable "Play Protect" if it flags the app as unrecognized.
            </div>
          </div>

          <p className="mt-8 text-sm text-zinc-500">
            * Other download links will be available upon public release.
          </p>
        </div>
      </section>

      {/* Privacy & Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-800 pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center border border-zinc-800">
                  <svg viewBox="0 0 64 64" className="w-5 h-5">
                    <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-nav)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">Pulse</span>
              </div>
              <p className="text-zinc-400 max-w-sm mb-6">
                Empowering teams with AI-driven communication, deep relationship intelligence, and automated workflows.
              </p>
              <div className="flex gap-4">
                <SocialIcon icon="fa-brands fa-twitter" />
                <SocialIcon icon="fa-brands fa-github" />
                <SocialIcon icon="fa-brands fa-discord" />
                <SocialIcon icon="fa-brands fa-linkedin" />
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-rose-500 transition">Features</a></li>
                <li><a href="#" className="hover:text-rose-500 transition">Integrations</a></li>
                <li><a href="#" className="hover:text-rose-500 transition">Pricing</a></li>
                <li><a href="#" className="hover:text-rose-500 transition">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6">Legal & Privacy</h4>
              <ul className="space-y-4 text-sm text-zinc-400">
                <li><a href="/privacy" className="hover:text-rose-500 transition flex items-center gap-2">Privacy Policy <span className="text-xs bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">Updated</span></a></li>
                <li><a href="/terms" className="hover:text-rose-500 transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-rose-500 transition">Security</a></li>
                <li><a href="#" className="hover:text-rose-500 transition">Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} Logos Vision LLC. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span>Made with</span>
              <i className="fa-solid fa-heart text-rose-900"></i>
              <span>by the Logos Vision Team</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper Components

const FeatureCard = ({ icon, color, title, description, tags }: { icon: string, color: string, title: string, description: string, tags: string[] }) => {
  const colorClasses: Record<string, string> = {
    rose: 'text-rose-500 bg-rose-500/10 group-hover:bg-rose-500/20',
    blue: 'text-blue-500 bg-blue-500/10 group-hover:bg-blue-500/20',
    purple: 'text-purple-500 bg-purple-500/10 group-hover:bg-purple-500/20',
    amber: 'text-amber-500 bg-amber-500/10 group-hover:bg-amber-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 group-hover:bg-emerald-500/20',
    red: 'text-red-500 bg-red-500/10 group-hover:bg-red-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 group-hover:bg-indigo-500/20',
    cyan: 'text-cyan-500 bg-cyan-500/10 group-hover:bg-cyan-500/20',
  };

  return (
    <div className="group p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition duration-300 hover:-translate-y-2 hover:shadow-xl animate-fade-in">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition ${colorClasses[color]}`}>
        <i className={`${icon} text-xl`}></i>
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span key={i} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300 border border-zinc-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

const DownloadButton = ({ icon, platform, subtext, active, href, onClick }: { icon: string, platform: string, subtext: string, active: boolean, href?: string, onClick?: () => void }) => {
  const Component = href ? 'a' : 'button';
  return (
    <Component
      href={href}
      onClick={onClick}
      download={href ? true : undefined}
      disabled={!active && !href}
      className={`group p-6 rounded-2xl border transition duration-300 flex flex-col items-center justify-center gap-4 w-full
        ${active 
          ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-rose-500/50 cursor-pointer' 
          : 'bg-zinc-900/50 border-zinc-800 opacity-60 cursor-not-allowed'}
      `}
    >
      <i className={`${icon} text-4xl text-zinc-300 group-hover:text-white transition`}></i>
      <div className="text-center">
        <div className="font-bold text-white group-hover:text-rose-400 transition">{platform}</div>
        <div className="text-xs text-zinc-500">{subtext}</div>
      </div>
      {!active && <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-500 uppercase tracking-wide">Coming Soon</span>}
    </Component>
  );
};

const SocialIcon = ({ icon }: { icon: string }) => (
  <a href="#" className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-rose-500 hover:text-white transition duration-300">
    <i className={icon}></i>
  </a>
);

export default LandingPage;
