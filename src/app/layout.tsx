import type { Metadata } from "next";
import { Outfit, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UltraMuse Dataset + Model Manager",
  description: "Comprehensive tool for dataset preparation, AI captioning, and model management for LoRA training",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <div className="min-h-screen w-full flex flex-col bg-gradient-to-b from-[#0a0612] via-[#120a1c] to-[#0a0612]">
          <header className="glass sticky top-0 z-50 px-6 py-4 border-b border-[var(--color-border)]">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-orange)] flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h1
                    className="text-xl font-bold bg-gradient-to-r from-[var(--color-accent-purple-light)] to-[var(--color-accent-orange)] bg-clip-text text-transparent"
                    style={{ fontFamily: "var(--font-outfit)" }}
                  >
                    UltraMuse
                  </h1>
                  <p className="text-xs text-[var(--color-text-muted)]">Dataset + Model Manager</p>
                </div>
              </div>
              <nav className="flex items-center gap-4 sm:gap-6">
                <a
                  href="/models"
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-purple-light)] transition-colors font-medium"
                >
                  Models
                </a>
                <a
                  href="/upload"
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-purple-light)] transition-colors"
                >
                  Upload
                </a>
                <a
                  href="/caption"
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-purple-light)] transition-colors"
                >
                  Caption
                </a>
                <a
                  href="/train"
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-purple-light)] transition-colors"
                >
                  Train
                </a>
                <a
                  href="https://discord.gg/9jVnQHDx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/30 hover:border-[#5865F2]/60 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span className="hidden sm:inline">Discord</span>
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1 w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
