'use client';

import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';
import { Upload, Sparkles, ArrowLeft } from 'lucide-react';

export default function UploadPage() {
  const router = useRouter();

  const handleUploadComplete = (datasetId: string) => {
    router.push(`/caption?dataset=${datasetId}`);
  };

  return (
    <div className="w-full min-h-[calc(100vh-72px)] overflow-hidden flex flex-col items-center relative">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-purple-500/10 blur-[140px]" />
      </div>

      <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-10 py-16 md:py-20 flex flex-col items-center gap-12 relative z-10">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="self-start flex items-center gap-2 text-sm text-gray-400 hover:text-purple-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        {/* Hero */}
        <section className="flex flex-col items-center text-center gap-6">
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30">
            <Upload className="w-12 h-12 text-blue-300" />
          </div>
          
          <div className="space-y-4 max-w-2xl">
            <h1
              className="text-4xl sm:text-5xl font-bold leading-tight bg-clip-text text-transparent bg-linear-to-r from-blue-300 via-white to-purple-300"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Upload Your Dataset
            </h1>
            <p className="text-lg text-gray-300/90 leading-relaxed">
              Upload a ZIP file containing your training images. Existing .txt captions are preserved, or generate new ones with AI.
            </p>
          </div>
        </section>

        {/* Upload section */}
        <section className="w-full max-w-2xl mx-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] px-6 sm:px-8 pt-6 sm:pt-8 pb-8 sm:pb-10">
          <UploadZone onUploadComplete={handleUploadComplete} />
        </section>

        {/* Instructions */}
        <section className="w-full max-w-2xl mx-auto">
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-300" />
              What Happens Next?
            </h3>
            <ol className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>
                  Your ZIP is extracted and images are organized into a new dataset
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Existing .txt captions are automatically imported alongside images
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>
                  You'll be taken to the Caption page to review, edit, or generate AI captions
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>
                  Export your captioned dataset to AI Toolkit format and start training!
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

