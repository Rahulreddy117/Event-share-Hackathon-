// app/view/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';

export default function ViewPage() {
  const [code, setCode] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-load last code and media on mount
  useEffect(() => {
    const lastCode = localStorage.getItem('lastEventCode') || localStorage.getItem('activeEventCode');
    if (lastCode && lastCode.length === 5) {
      setCode(lastCode);
      loadCachedMedia(lastCode);
    }
  }, []);

  // Try to load cached media (instant, no network)
  const loadCachedMedia = async (currentCode: string) => {
    const cached = localStorage.getItem(`cachedMedia_${currentCode}`);
    const cacheTime = localStorage.getItem(`cacheTime_${currentCode}`);
    
    if (cached && cacheTime) {
      const now = Date.now();
      const cacheAge = now - parseInt(cacheTime);
      if (cacheAge < 24 * 60 * 60 * 1000) { // 24h cache
        setMedia(JSON.parse(cached));
        // Double-check expiry via quick fetch
        await fetchEvent();
        return;
      }
    }
    // No valid cache: fetch fresh
    await fetchEvent();
  };

  const fetchEvent = async () => {
    if (code.length !== 5) return;

    setLoading(true);
    setError('');
    setMedia([]);

    try {
      const docRef = doc(db, 'events', code);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError('Invalid or expired code');
        clearCache();
        setLoading(false);
        return;
      }

      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate?.();

      if (!expiresAt) {
        setError("This event has no expiry or is corrupted");
        clearCache();
        setLoading(false);
        return;
      }

      const now = new Date();
      if (now > expiresAt) {
        setError('This event has expired');
        clearCache();
        setLoading(false);
        return;
      }

      const newMedia = data.urls || [];
      setMedia(newMedia);

      // Cache for future reloads
      localStorage.setItem(`cachedMedia_${code}`, JSON.stringify(newMedia));
      localStorage.setItem(`cacheTime_${code}`, Date.now().toString());
      localStorage.setItem('lastViewedCode', code); // Track last viewed

    } catch (err) {
      console.error(err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Clear cache for this code
  const clearCache = () => {
    localStorage.removeItem(`cachedMedia_${code}`);
    localStorage.removeItem(`cacheTime_${code}`);
  };

  // Auto-fetch if code changes (e.g., manual edit)
  useEffect(() => {
    if (code.length === 5) {
      fetchEvent();
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center pt-12 mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-linear-to-r from-black to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
            View Your Event
          </h1>

          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 5))
              }
              placeholder="12345"
              className="text-6xl text-center font-mono tracking-widest w-64 p-6 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black"
              maxLength={5}
              autoFocus
            />
            {code && (
              <button
                onClick={() => { setCode(''); setMedia([]); clearCache(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500 text-xl"
              >
                +ù
              </button>
            )}
          </div>

          <button
            onClick={fetchEvent}
            disabled={loading || code.length !== 5}
            className="mt-6 px-8 py-4 bg-black text-white rounded-full font-medium hover:bg-zinc-800 disabled:opacity-50 transition"
          >
            {loading ? 'Loading...' : 'View Photos'}
          </button>

          {error && <p className="text-red-500 mt-4 text-lg">{error}</p>}
        </div>

        {media.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-12">
            {media.map((url, i) =>
              url.includes('/video/') ? (
                <video key={i} controls className="w-full rounded-xl shadow-lg">
                  <source src={url} />
                </video>
              ) : (
                <Image
                  key={i}
                  src={url}
                  alt=""
                  width={600}
                  height={600}
                  className="w-full h-auto rounded-xl shadow-lg object-cover"
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
