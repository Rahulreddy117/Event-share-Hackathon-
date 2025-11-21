// app/upload/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createEvent } from '@/actions/createEvent';

export default function UploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [duration, setDuration] = useState(6);
  const [uploading, setUploading] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  // On mount: check if user has an active event in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('activeEventCode');
    if (saved) {
      setCode(saved);
    }
  }, []);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
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
      const result = await createEvent(urls, duration);

      if (result.success && result.code) {
        setCode(result.code);
        localStorage.setItem('activeEventCode', result.code);
        localStorage.setItem('lastEventCode', result.code);

        // Save to history (persistent across sessions)
        const history = JSON.parse(localStorage.getItem('eventHistory') || '[]');
        const newEntry = {
          code: result.code,
          duration,
          uploadedAt: new Date().toISOString(),
          fileCount: files.length,
        };
        localStorage.setItem('eventHistory', JSON.stringify([newEntry, ...history.slice(0, 9)])); // Keep last 10
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
        // Fallback for non-secure/older browsers
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
      // Ultimate fallback: prompt the user
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-black rounded-3xl shadow-2xl p-10 max-w-lg w-full">
        <a href="/" className="text-sm text-zinc-500 hover:underline inline-block mb-6">← Back</a>

        <h1 className="text-4xl font-bold text-center mb-10 bg-linear-to-r from-black to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
          Upload Event Photos
        </h1>

        {code ? (
          <div className="text-center animate-in fade-in slide-in-from-bottom duration-700">
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">Your event is live!</p>
            
            <div className="inline-flex items-center justify-center p-10 bg-linear-to-br from-black to-zinc-800 dark:from-zinc-200 dark:to-zinc-400 rounded-3xl shadow-2xl mb-10">
              <p className="text-8xl font-black tracking-widest text-white dark:text-black">
                {code}
              </p>
            </div>

            <div className="space-y-4">
              <button onClick={copyToClipboard} className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-semibold hover:opacity-90 transition">
                Copy Code
              </button>
              <a href="/view" className="block w-full py-5 border-2 border-black dark:border-white rounded-2xl font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition">
                Open Viewer
              </a>
              <button onClick={startNewUpload} className="text-sm text-zinc-500 hover:text-zinc-700 underline">
                + Upload another event
              </button>
            </div>

            <p className="mt-8 text-xs text-zinc-500">Expires in {duration} hours • Saved in your browser</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setFiles(e.target.files)}
                className="w-full text-sm file:mr-4 file:py-4 file:px-8 file:rounded-full file:border-0 file:bg-black file:text-white file:font-medium"
                required
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Photos disappear after:</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-5 py-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                disabled={uploading}
              >
                <option value={6}>6 Hours</option>
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={uploading || !files}
              className="w-full py-5 bg-black text-white rounded-2xl font-bold hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {uploading ? 'Uploading...' : 'Upload & Generate Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}