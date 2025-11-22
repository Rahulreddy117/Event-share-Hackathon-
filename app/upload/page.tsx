// app/upload/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createEvent } from '@/actions/createEvent';
import { Upload, Copy, Eye, Clock, CheckCircle2, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// NSFW safety imports
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';

// Doodle SVG filter for hand-drawn effect
const DoodleFilter = () => (
  <svg className="absolute w-0 h-0">
    <defs>
      <filter id="squiggly">
        <feTurbulence baseFrequency="0.02" numOctaves="3" result="noise" seed="0" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
      </filter>
    </defs>
  </svg>
);

// Animated doodle border component
const DoodleBorder = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`relative ${className}`}>
    <motion.div
      className="absolute inset-0 rounded-2xl"
      style={{
        border: '3px dashed #4ade80',
        filter: 'url(#squiggly)',
      }}
      animate={{
        borderColor: ['#4ade80', '#22d3ee', '#a78bfa', '#4ade80'],
      }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
    />
    {children}
  </div>
);

// Wiggle animation variants
const wiggle = {
  hover: {
    rotate: [0, -2, 2, -2, 0],
    transition: { duration: 0.4, repeat: Infinity },
  },
};

// Scribble loading bar
const ScribbleProgress = ({ progress }: { progress: number }) => (
  <div className="relative h-6 w-full bg-slate-800/50 rounded-full overflow-hidden border-2 border-dashed border-green-400/50">
    <motion.div
      className="h-full bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.3 }}
      style={{ filter: 'url(#squiggly)' }}
    />
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
    />
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute top-1/2 w-2 h-2 bg-white rounded-full"
        style={{ left: `${progress - 5}%` }}
        animate={{
          y: [-10, 10],
          opacity: [0, 1, 0],
          scale: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.2,
        }}
      />
    ))}
  </div>
);

// Hand-drawn button component
const DoodleButton = ({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) => (
  <motion.button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`relative overflow-hidden ${className}`}
    whileHover={{ scale: disabled ? 1 : 1.02 }}
    whileTap={{ scale: disabled ? 1 : 0.98 }}
    variants={wiggle}
  >
    <motion.div
      className="absolute inset-0 rounded-xl"
      style={{ border: '3px solid transparent' }}
      animate={{
        borderColor: disabled
          ? '#475569'
          : ['#4ade80', '#22d3ee', '#a78bfa', '#4ade80'],
        borderStyle: 'dashed',
      }}
      transition={{ duration: 2, repeat: Infinity }}
    />
    {children}
  </motion.button>
);

// VHS scan line effect
const VHSScanLines = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
    <div
      className="absolute inset-0 opacity-5"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
      }}
    />
    <motion.div
      className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent"
      animate={{ y: ['0%', '100%'] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
    />
  </div>
);

export default function UploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [duration, setDuration] = useState(6);
  const [uploading, setUploading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dateStr, setDateStr] = useState<string>('');

  // NSFW model state
  const [nsfwModel, setNsfwModel] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Load NSFW model on page load
  useEffect(() => {
    const loadModel = async () => {
      try {
        const model = await nsfwjs.load();
        setNsfwModel(model);
      } catch (err) {
        console.error('Error loading NSFW model', err);
      }
    };
    loadModel();
  }, []);

  // Simple popup for unsafe images
  const showUnsafePopup = () => {
    alert(
      '⚠️ This image is flagged as inappropriate or disturbing.\n\nFor safety, EventShare does not allow such content to be uploaded.'
    );
  };

  // Check if a single image file is safe
  async function isImageSafe(file: File): Promise<boolean> {
    if (!nsfwModel) return true; // if model not ready, don't block

    // Only check images, skip videos
    if (!file.type.startsWith('image/')) return true;

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      img.onload = async () => {
        try {
          const predictions = await nsfwModel.classify(img);

          const unsafe = predictions.some(
            (p: any) =>
              ['Porn', 'Hentai', 'Sexy', 'Violence', 'Graphic'].includes(
                p.className
              ) && p.probability > 0.55
          );

          resolve(!unsafe);
        } catch (err) {
          console.error('Error classifying image', err);
          resolve(true);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(true);
      };
    });
  }

  // Handle file selection with safety check
  const handleFileSelect = async (e: any) => {
    const selected = e.target.files as FileList | null;
    if (!selected || selected.length === 0) return;

    setIsScanning(true);

    // Check all selected files
    for (const file of Array.from(selected)) {
      const safe = await isImageSafe(file);
      if (!safe) {
        setIsScanning(false);
        e.target.value = '';
        showUnsafePopup();
        return;
      }
    }

    setIsScanning(false);
    setFiles(selected);
  };

  // On mount: check if user has an active event in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('activeEventCode');
    if (saved) {
      setCode(saved);
    }
    setDateStr(new Date().toLocaleDateString());
  }, []);

  // Simulate progress during upload
  useEffect(() => {
    if (uploading) {
      const interval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 15, 90));
      }, 300);
      return () => clearInterval(interval);
    } else {
      setUploadProgress(0);
    }
  }, [uploading]);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'upload_preset',
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
    );
    formData.append('folder', 'events');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: formData }
    );
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;

    setUploading(true);
    setCode(null);

    try {
      const urls = await Promise.all(Array.from(files).map(uploadToCloudinary));
      setUploadProgress(100);
      const result = await createEvent(urls, duration);

      if (result.success && result.code) {
        setCode(result.code);
        localStorage.setItem('activeEventCode', result.code);
        localStorage.setItem('lastEventCode', result.code);

        const history = JSON.parse(
          localStorage.getItem('eventHistory') || '[]'
        );
        const newEntry = {
          code: result.code,
          duration,
          uploadedAt: new Date().toISOString(),
          fileCount: files.length,
        };
        localStorage.setItem(
          'eventHistory',
          JSON.stringify([newEntry, ...history.slice(0, 9)])
        );
      }
    } catch (err) {
      alert('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  // Safe clipboard copy with fallback
  const copyToClipboard = async () => {
    if (!code) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      alert('Code copied to clipboard!');
    } catch (err) {
      const copied = prompt('Copy this code:', code);
      if (copied) alert('Code copied!');
    }
  };

  const startNewUpload = () => {
    setCode(null);
    setFiles(null);
    localStorage.removeItem('activeEventCode');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-6">
      <DoodleFilter />

      {/* Retro grid background */}
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

      {/* Floating doodle elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl"
            style={{
              left: `${15 + i * 15}%`,
              top: `${10 + (i % 3) * 30}%`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          >
            {['✦', '✧', '◇', '○', '△', '□'][i]}
          </motion.div>
        ))}
      </div>

      {/* Glowing orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full"
        style={{ filter: 'url(#squiggly)' }}
      >
        {/* Animated dashed border */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <motion.rect
            x="2"
            y="2"
            width="calc(100% - 4px)"
            height="calc(100% - 4px)"
            rx="24"
            fill="none"
            stroke="url(#borderGradient)"
            strokeWidth="3"
            strokeDasharray="10 5"
            animate={{ strokeDashoffset: [0, -30] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <defs>
            <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>

        <VHSScanLines />

        <div className="relative z-10">
          {/* Back button */}
          <motion.a
            href="/"
            className="group inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors mb-6"
            whileHover={{ x: -5 }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono">← BACK</span>
          </motion.a>

          {/* Title */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center gap-3 mb-3"
              animate={{ rotate: [-1, 1, -1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-6 h-6 text-green-400" />
              <h1 className="text-3xl font-bold font-mono tracking-wider">
                <span className="text-green-400">[</span>
                <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  UPLOAD
                </span>
                <span className="text-green-400">]</span>
              </h1>
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </motion.div>
            <p className="text-slate-400 font-mono text-xs tracking-widest">
              ~~~ SHARE YOUR MEMORIES ~~~
            </p>
          </div>

          <AnimatePresence mode="wait">
            {code ? (
              // Success state
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-6"
              >
                <motion.div
                  className="flex items-center justify-center gap-2 text-green-400"
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </motion.div>
                  <p className="font-mono text-lg">EVENT IS LIVE!</p>
                </motion.div>

                <DoodleBorder className="p-1">
                  <motion.div
                    className="bg-slate-800/80 p-8 rounded-xl"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(74, 222, 128, 0.3)',
                        '0 0 40px rgba(34, 211, 238, 0.3)',
                        '0 0 20px rgba(167, 139, 250, 0.3)',
                        '0 0 20px rgba(74, 222, 128, 0.3)',
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <motion.p
  className="
    text-4xl
    sm:text-5xl 
    md:text-7xl 
    font-mono font-black
    tracking-[0.15em] 
    sm:tracking-[0.2em]
    md:tracking-[0.3em]
    break-words text-center
  "
  style={{ wordBreak: "break-all" }}
  animate={{ scale: [1, 1.02, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  {code}
</motion.p>

                  </motion.div>
                </DoodleBorder>

                <div className="space-y-3">
                  <DoodleButton
                    onClick={copyToClipboard}
                    className="w-full py-4 px-6 bg-gradient-to-r from-green-600/80 to-cyan-600/80 rounded-xl font-mono text-white flex items-center justify-center gap-3"
                  >
                    <Copy className="w-5 h-5" />
                    COPY CODE
                  </DoodleButton>

                  <motion.a
                    href="/view"
                    className="block w-full py-4 px-6 border-2 border-dashed border-green-500/50 hover:border-green-400 rounded-xl font-mono text-green-400 hover:text-green-300 transition-colors flex items-center justify-center gap-3"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Eye className="w-5 h-5" />
                    OPEN VIEWER
                  </motion.a>

                  <button
                    onClick={startNewUpload}
                    className="w-full py-2 text-sm font-mono text-slate-500 hover:text-green-400 transition-colors"
                  >
                    + new upload
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>expires in {duration}h • saved locally</span>
                </div>
              </motion.div>
            ) : (
              // Upload form
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* File input with doodle styling */}
                <DoodleBorder className="p-1">
                  <motion.label
                    htmlFor="file-upload"
                    className="block bg-slate-800/50 rounded-xl p-6 cursor-pointer"
                    whileHover={{ backgroundColor: 'rgba(30, 41, 59, 0.7)' }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Upload className="w-10 h-10 text-green-400" />
                      </motion.div>

                      <div className="text-center">
                        <p className="text-green-400 font-mono text-sm mb-1">
                          {isScanning
                            ? 'Scanning files for safety...'
                            : 'Click to choose files'}
                        </p>
                        <p className="text-slate-500 font-mono text-xs">
                          or drag and drop
                        </p>
                      </div>

                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading || isScanning}
                      />

                      <AnimatePresence>
                        {files && !isScanning && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-dashed border-cyan-500/50"
                          >
                            ✓ {files.length} file
                            {files.length > 1 ? 's' : ''} selected
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.label>
                </DoodleBorder>

                {/* Duration selector */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-mono text-slate-400">
                    <Clock className="w-4 h-4 text-green-400" />
                    disappears after:
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border-2 border-dashed border-green-500/30 text-green-400 font-mono focus:border-green-400 focus:outline-none transition-colors cursor-pointer hover:border-green-500/50"
                    disabled={uploading}
                  >
                    <option value={6}>⏱ 6 Hours</option>
                    <option value={12}>⏱ 12 Hours</option>
                    <option value={24}>⏱ 24 Hours</option>
                  </select>
                </div>

                {/* Progress bar (visible during upload) */}
                <AnimatePresence>
                  {uploading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <ScribbleProgress progress={uploadProgress} />
                      <p className="text-xs font-mono text-center text-slate-500">
                        {Math.round(uploadProgress)}% uploaded...
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button with doodle animation */}
                <DoodleButton
                  type="submit"
                  disabled={uploading || !files || isScanning}
                  className="w-full py-5 rounded-xl font-mono font-bold text-white bg-gradient-to-r from-green-600/80 via-cyan-600/80 to-purple-600/80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <motion.span
                    className="flex items-center justify-center gap-3"
                    animate={
                      uploading || isScanning
                        ? { opacity: [1, 0.5, 1] }
                        : {}
                    }
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {uploading ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        />
                        UPLOADING...
                      </>
                    ) : isScanning ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        />
                        SCANNING FOR SAFETY...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        UPLOAD & GENERATE CODE
                      </>
                    )}
                  </motion.span>
                </DoodleButton>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 text-green-500/30 font-mono text-xs">
        REC ●
      </div>
      <div className="absolute top-4 right-4 text-cyan-500/30 font-mono text-xs">
        {dateStr}
      </div>
      <div className="absolute bottom-4 left-4 text-purple-500/30 font-mono text-xs">
        ▶ PLAY
      </div>
      <div className="absolute bottom-4 right-4 text-green-500/30 font-mono text-xs">
        ◉ LIVE
      </div>
    </div>
  );
}
