'use client';

import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';
import { Sparkles, Image as ImageIcon, Send, ArrowDown } from 'lucide-react';

export default function UploadPage() {
  const router = useRouter();

  const handleUploadComplete = (datasetId: string) => {
    router.push(`/caption?dataset=${datasetId}`);
  };

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
            Effortless LoRA dataset prep
          </div>
          <div className="space-y-6 max-w-4xl">
          <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight bg-clip-text text-transparent bg-linear-to-r from-purple-300 via-white to-orange-300"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Upload, caption, and export datasets without friction
          </h1>
            <p className="text-lg sm:text-xl text-gray-300/90 leading-relaxed">
              Drop your images once, let the pipeline handle captioning, and export in the exact format your LoRA training needs.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="h-px w-10 bg-gray-700" />
            Start below
            <ArrowDown className="h-4 w-4 text-purple-200" />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 - ZIP Upload */}
            <div className="group relative rounded-lg border border-purple-500/30 bg-linear-to-br from-purple-900/20 to-purple-950/10 p-6 text-center hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-purple-300" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                ZIP In, Ready Out
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Upload a single ZIP containing your images (and captions, if you have them).
              </p>
            </div>

            {/* Card 2 - AI Captioning */}
            <div className="group relative rounded-lg border border-orange-500/30 bg-linear-to-br from-orange-900/20 to-orange-950/10 p-6 text-center hover:border-orange-400/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-orange-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                AI Captioning
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Leverage local models to generate consistent, rich captions automatically.
              </p>
            </div>

            {/* Card 3 - Export */}
            <div className="group relative rounded-lg border border-purple-500/30 bg-linear-to-br from-purple-900/20 via-purple-950/10 to-orange-950/10 p-6 text-center hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)] transition-all duration-300">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                <Send className="h-6 w-6 text-purple-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                One-Click Export
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Ship your dataset to your training toolkit with a single export.
              </p>
            </div>
          </div>
        </section>

        {/* Upload section */}
        <section
          id="upload"
          className="w-full max-w-2xl mx-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] px-6 sm:px-8 pt-6 sm:pt-8 pb-8 sm:pb-10 flex flex-col items-center gap-6"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-purple-200 bg-purple-500/10 border border-purple-400/20 px-3 py-1 rounded-full">
              <Sparkles className="h-4 w-4" />
              Upload & Process
        </div>
            <div className="flex flex-col gap-2">
              <h2
                className="text-2xl sm:text-3xl font-semibold text-white"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                Drop your dataset ZIP
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-3xl">
                Include optional .txt captions alongside images. We’ll handle extraction, captioning (if needed), and prepare an export for training.
              </p>
        </div>
      </div>
          <UploadZone onUploadComplete={handleUploadComplete} />
        </section>
      </div>
    </div>
  );
}

