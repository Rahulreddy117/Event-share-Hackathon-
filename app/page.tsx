// app/page.tsx
'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

interface EventHistory {
  code: string;
  duration: number;
  uploadedAt: string;
  fileCount: number;
}

export default function Home() {
  const [history, setHistory] = useState<EventHistory[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('eventHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    return date.toLocaleDateString();
  };

  const isLikelyExpired = (uploadedAt: string, duration: number) => {
    const uploadDate = new Date(uploadedAt);
    const expiry = new Date(uploadDate.getTime() + duration * 60 * 60 * 1000);
    return new Date() > expiry;
  };

  const clearHistory = () => {
    if (confirm('Clear all recent events? This won\'t delete your actual events.')) {
      localStorage.removeItem('eventHistory');
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-white dark:from-black dark:to-zinc-950">
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="text-center max-w-4xl">
          <h1 className="text-7xl md:text-9xl font-black tracking-tight mb-8 bg-linear-to-r from-black to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
            Event Share
          </h1>

          <p className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 mb-16 max-w-2xl mx-auto leading-relaxed">
            Share photos & videos that disappear after 6, 12 or 24 hours.<br />
            No signup. No login. Just a 5-digit code.
          </p>

          <div className="flex flex-col sm:flex-row gap-8 justify-center mb-20">
            <Link
              href="/upload"
              className="px-12 py-6 bg-black text-white text-2xl font-bold rounded-2xl hover:bg-zinc-800 transition transform hover:scale-105 shadow-2xl"
            >
              Upload Photos
            </Link>

            <Link
              href="/view"
              className="px-12 py-6 border-4 border-black dark:border-white text-2xl font-bold rounded-2xl hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition transform hover:scale-105 shadow-2xl"
            >
              View Event
            </Link>
          </div>

          {/* Recent Events Section */}
          {history.length > 0 && (
            <div className="mt-20 max-w-2xl mx-auto relative">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  Your Recent Events
                </h2>
                <button
                  onClick={clearHistory}
                  onMouseDown={() => setTimeout(clearHistory, 1000)} // Long-press to clear (safety)
                  className="text-xs text-zinc-500 hover:text-red-500 underline hidden md:block"
                  title="Hold to clear history"
                >
                  Clear All
                </button>
              </div>
              <div className="grid gap-4">
                {history.map((event) => (
                  <div
                    key={event.code}
                    className={`group flex items-center justify-between p-6 bg-white dark:bg-zinc-900/50 backdrop-blur-sm border rounded-2xl hover:shadow-xl transition-all ${
                      isLikelyExpired(event.uploadedAt, event.duration)
                        ? 'border-red-200 dark:border-red-800 bg-red-50/50'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div>
                      <p className="text-3xl font-black font-mono tracking-wider text-black dark:text-white">
                        {event.code}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {event.fileCount} file{event.fileCount > 1 ? 's' : ''} • {formatTime(event.uploadedAt)} • Expires in {event.duration}h
                        {isLikelyExpired(event.uploadedAt, event.duration) && (
                          <span className="ml-2 text-red-500">⚠️ Likely expired</span>
                        )}
                      </p>
                    </div>
                    <Link
                      href="/view"
                      onClick={() => {
                        localStorage.setItem('lastEventCode', event.code);
                        localStorage.setItem('lastViewedCode', event.code);
                      }}
                      className="opacity-0 group-hover:opacity-100 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-full font-medium transition"
                    >
                      Open →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <footer className="mt-32 text-sm text-zinc-500">
            Photos auto-delete • Built with Next.js, Firebase & Cloudinary
          </footer>
        </div>
      </div>
    </div>
  );
}