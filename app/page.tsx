// app/page.tsx
'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { Upload, Eye, Trash2, Clock, Image, Sparkles, ArrowRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EventHistory {
  code: string;
  duration: number;
  uploadedAt: string;
  fileCount: number;
}

// 🎨 Doodle SVG filter for hand-drawn effect
const DoodleFilter = () => (
  <svg className="absolute w-0 h-0">
    <defs>
      <filter id="squiggly-home">
        <feTurbulence baseFrequency="0.02" numOctaves="3" result="noise" seed="0" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
      </filter>
    </defs>
  </svg>
);

// 🎨 VHS scan line effect
const VHSScanLines = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
      }}
    />
    <motion.div
      className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent"
      animate={{ y: ['0%', '100%'] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
    />
  </div>
);

// 🎨 Animated doodle border component
const DoodleBorder = ({ children, className = '', color = 'green' }: { children: React.ReactNode; className?: string; color?: string }) => {
  const colors = {
    green: ['#4ade80', '#22d3ee', '#a78bfa', '#4ade80'],
    red: ['#f87171', '#fb923c', '#f87171', '#fb923c'],
  };
  return (
    <div className={`relative ${className}`}>
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          border: '3px dashed #4ade80',
          filter: 'url(#squiggly-home)',
        }}
        animate={{
          borderColor: colors[color as keyof typeof colors] || colors.green,
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      {children}
    </div>
  );
};

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
    // 🎨 Retro dark background with grid
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      <DoodleFilter />
      <VHSScanLines />

      {/* 🎨 Retro grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* 🎨 Floating doodle symbols */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['✦', '✧', '◇', '○', '△', '□', '✶', '⬡'].map((symbol, i) => (
          <motion.div
            key={i}
            className="absolute text-3xl md:text-4xl"
            style={{
              left: `${10 + i * 12}%`,
              top: `${5 + (i % 4) * 25}%`,
              color: ['#4ade80', '#22d3ee', '#a78bfa', '#f0abfc'][i % 4],
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 15, -15, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          >
            {symbol}
          </motion.div>
        ))}
      </div>

      {/* 🎨 Glowing orbs with retro colors */}
      <motion.div
        className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-green-500/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.2, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.3, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, delay: 1 }}
      />

      {/* 🎨 Corner VHS decorations */}
      <div className="absolute top-4 left-4 text-green-500/50 font-mono text-xs z-20">
        REC ●
      </div>
      <div className="absolute top-4 right-4 text-cyan-500/50 font-mono text-xs z-20">
        PLAY ▶
      </div>
      <div className="absolute bottom-4 left-4 text-purple-500/50 font-mono text-xs z-20">
        ◉ LIVE
      </div>
      <div className="absolute bottom-4 right-4 text-green-500/50 font-mono text-xs z-20">
        00:00:00
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-20">
        <div className="text-center max-w-4xl">
          {/* 🎨 Hero section with retro doodle styling */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-4 mb-6">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-green-400" />
              </motion.div>
              
              {/* 🎨 Main title with doodle effect */}
              <motion.h1
                className="text-5xl md:text-8xl font-black font-mono tracking-tight"
                animate={{ rotate: [-0.5, 0.5, -0.5] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <span className="text-green-400">[</span>
                <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Event Share
                </span>
                <span className="text-green-400">]</span>
              </motion.h1>
              
              <motion.div
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              >
                <Zap className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
              </motion.div>
            </div>
          </motion.div>

          {/* 🎨 Subtitle with doodle card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <DoodleBorder className="max-w-2xl mx-auto mb-16">
              <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl">
                <p className="text-lg md:text-xl text-slate-300 font-mono leading-relaxed">
                  Share photos & videos that disappear after 6, 12 or 24 hours.<br />
                  <span className="text-cyan-400">No signup. No login.</span> Just a{' '}
                  <span className="font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded">5-digit code</span>.
                </p>
              </div>
            </DoodleBorder>
          </motion.div>

          {/* 🎨 CTA buttons with doodle styling */}
          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {/* 🎨 Upload button */}
            <Link href="/upload">
              <motion.div
                className="group relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Animated border */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <motion.rect
                    x="2"
                    y="2"
                    width="calc(100% - 4px)"
                    height="calc(100% - 4px)"
                    rx="16"
                    fill="none"
                    stroke="url(#btnGradient1)"
                    strokeWidth="3"
                    strokeDasharray="10 5"
                    animate={{ strokeDashoffset: [0, -30] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                  <defs>
                    <linearGradient id="btnGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="relative px-10 py-5 bg-gradient-to-r from-green-600/80 to-cyan-600/80 rounded-2xl font-mono font-bold text-xl text-white flex items-center gap-3">
                  <Upload className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                  Upload Photos
                </div>
              </motion.div>
            </Link>

            {/* 🎨 View button */}
            <Link href="/view">
              <motion.div
                className="group relative px-10 py-5 border-3 border-dashed border-green-500/50 hover:border-cyan-400 rounded-2xl font-mono font-bold text-xl text-green-400 hover:text-cyan-300 flex items-center gap-3 transition-all bg-slate-900/50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Eye className="w-6 h-6 group-hover:scale-110 transition-transform" />
                View Event
              </motion.div>
            </Link>
          </motion.div>

          {/* 🎨 Recent Events Section */}
          <AnimatePresence>
            {history.length > 0 && (
              <motion.div
                className="mt-20 max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                {/* 🎨 Section header with doodle styling */}
                <DoodleBorder className="mb-8">
                  <div className="flex justify-between items-center bg-slate-900/60 backdrop-blur-sm p-5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      >
                        <Clock className="w-6 h-6 text-green-400" />
                      </motion.div>
                      <h2 className="text-xl font-bold font-mono text-green-400">
                        [ RECENT EVENTS ]
                      </h2>
                    </div>
                    <button
                      onClick={clearHistory}
                      className="group flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-red-400 transition-colors"
                      title="Clear history"
                    >
                      <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="hidden md:inline">Clear</span>
                    </button>
                  </div>
                </DoodleBorder>

                {/* 🎨 Event cards with doodle styling */}
                <div className="grid gap-4">
                  {history.map((event, index) => {
                    const expired = isLikelyExpired(event.uploadedAt, event.duration);
                    return (
                      <motion.div
                        key={event.code}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <DoodleBorder color={expired ? 'red' : 'green'}>
                          <motion.div
                            className={`group relative overflow-hidden rounded-2xl transition-all ${
                              expired
                                ? 'bg-red-950/30'
                                : 'bg-slate-900/60'
                            }`}
                            whileHover={{ scale: 1.01 }}
                          >
                            <div className="relative flex items-center justify-between p-5">
                              <div className="flex items-center gap-5">
                                {/* 🎨 Icon */}
                                <div className={`p-3 rounded-xl border-2 border-dashed ${
                                  expired
                                    ? 'border-red-500/50 bg-red-500/10'
                                    : 'border-green-500/50 bg-green-500/10'
                                }`}>
                                  <Image className={`w-6 h-6 ${expired ? 'text-red-400' : 'text-green-400'}`} />
                                </div>

                                <div>
                                  {/* 🎨 Event code */}
                                  <p className="text-2xl font-black font-mono tracking-[0.2em] bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                                    {event.code}
                                  </p>
                                  {/* 🎨 Event details */}
                                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Image className="w-3 h-3" />
                                      {event.fileCount} file{event.fileCount > 1 ? 's' : ''}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatTime(event.uploadedAt)}
                                    </span>
                                    <span>•</span>
                                    <span>{event.duration}h</span>
                                    {expired && (
                                      <span className="flex items-center gap-1 text-red-400">
                                        <Zap className="w-3 h-3" />
                                        expired
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* 🎨 Open button */}
                              <Link
                                href="/view"
                                onClick={() => {
                                  localStorage.setItem('lastEventCode', event.code);
                                  localStorage.setItem('lastViewedCode', event.code);
                                }}
                                className={`opacity-0 group-hover:opacity-100 flex items-center gap-2 px-5 py-2 rounded-xl font-mono font-medium text-sm transition-all border-2 border-dashed ${
                                  expired
                                    ? 'border-red-500 text-red-400 hover:bg-red-500/20'
                                    : 'border-green-500 text-green-400 hover:bg-green-500/20'
                                }`}
                              >
                                Open
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </Link>
                            </div>
                          </motion.div>
                        </DoodleBorder>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 🎨 Footer with doodle styling */}
          <motion.footer
            className="mt-32"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <DoodleBorder>
              <div className="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl text-center">
                <div className="flex items-center justify-center gap-2 mb-2 text-green-400 font-mono text-sm">
                  <motion.div
                    animate={{ rotate: [0, 180, 360] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                  <span>~~~ Photos auto-delete ~~~</span>
                </div>
                <p className="text-slate-500 font-mono text-xs">
                  Built with Next.js, Firebase & Cloudinary
                </p>
              </div>
            </DoodleBorder>
          </motion.footer>
        </div>
      </div>
    </div>
  );
}