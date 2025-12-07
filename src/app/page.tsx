'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, Database, Zap, ArrowRight, Upload, Bot, Download } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="w-full min-h-[calc(100vh-72px)] overflow-hidden flex flex-col items-center relative">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-orange-500/10 blur-[140px]" />
      </div>

      <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-10 py-16 md:py-20 flex flex-col items-center gap-12 relative z-10">
        {/* Hero */}
        <section className="flex flex-col items-center text-center gap-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300">
            <Sparkles className="h-4 w-4 text-purple-300" />
            Complete LoRA Training Platform
          </div>
          <div className="space-y-6 max-w-4xl">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight bg-clip-text text-transparent bg-linear-to-r from-purple-300 via-white to-orange-300"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Manage Models, Prepare Datasets, Train LoRAs
            </h1>
            <p className="text-lg sm:text-xl text-gray-300/90 leading-relaxed">
              Download and manage AI models. Prepare datasets with AI captioning. Export ready-to-train packages. All in one unified platform.
            </p>
          </div>

          {/* Discord CTA */}
          <a
            href="https://discord.gg/9jVnQHDx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/30 hover:bg-[#5865F2]/25 hover:border-[#5865F2]/50 transition-all group"
          >
            <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <div className="text-left">
              <span className="text-sm font-medium text-white block">Join our Discord</span>
              <span className="text-xs text-gray-400">Support, free resources & early model access</span>
            </div>
          </a>
        </section>

        {/* Feature highlights */}
        <section className="w-full max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Card 1 - Model Manager */}
            <div className="group relative rounded-lg border border-purple-500/30 bg-linear-to-br from-purple-900/20 to-purple-950/10 p-6 text-center hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                <Database className="h-6 w-6 text-purple-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                Model Manager
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Browse and download AI models. Flux, SDXL, Z-Image, and custom models supported.
              </p>
            </div>

            {/* Card 2 - Dataset Upload */}
            <div className="group relative rounded-lg border border-blue-500/30 bg-linear-to-br from-blue-900/20 to-blue-950/10 p-6 text-center hover:border-blue-400/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                Dataset Upload
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Upload ZIP files with your training images. Automatic extraction and organization.
              </p>
            </div>

            {/* Card 3 - AI Captioning */}
            <div className="group relative rounded-lg border border-orange-500/30 bg-linear-to-br from-orange-900/20 to-orange-950/10 p-6 text-center hover:border-orange-400/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
                <Bot className="h-6 w-6 text-orange-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                AI Captioning
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Qwen 2.5 VL generates detailed captions. Customize prompts and word replacements.
              </p>
            </div>

            {/* Card 4 - Export */}
            <div className="group relative rounded-lg border border-green-500/30 bg-linear-to-br from-green-900/20 to-green-950/10 p-6 text-center hover:border-green-400/50 hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-green-500/20 border border-green-400/30 flex items-center justify-center">
                <Download className="h-6 w-6 text-green-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                Export & Train
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Export to AI Toolkit format. Select your base model and start training.
              </p>
            </div>
          </div>
        </section>

        {/* Quick Links Section */}
        <section className="w-full max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/models')}
              className="group p-6 bg-gradient-to-br from-purple-900/40 to-purple-950/20 border border-purple-500/30 rounded-xl hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)] transition-all text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <Database className="w-8 h-8 text-purple-300" />
                <ArrowRight className="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                Browse Models
              </h3>
              <p className="text-gray-400 text-sm">
                Download Z-Image, Flux, SDXL, or add your own custom models
              </p>
            </button>

            <button
              onClick={() => router.push('/upload')}
              className="group p-6 bg-gradient-to-br from-blue-900/40 to-blue-950/20 border border-blue-500/30 rounded-xl hover:border-blue-400/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <Upload className="w-8 h-8 text-blue-300" />
                <ArrowRight className="w-5 h-5 text-blue-300 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                Upload Dataset
              </h3>
              <p className="text-gray-400 text-sm">
                Upload your training images as a ZIP file to get started
              </p>
            </button>
          </div>
        </section>

        {/* Start Here Button - Bottom */}
        <section className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4">
          <button
            onClick={() => router.push('/models')}
            className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center gap-3"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            <Database className="w-6 h-6" />
            Start Here: Model Manager
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-sm text-gray-500">
            First time? Start by downloading the models you need for training
          </p>
        </section>
      </div>
    </div>
  );
}

