// app/view/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  index: number;
}

export default function ViewPage() {
  const [code, setCode] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showSelection, setShowSelection] = useState(false);
  const [lightbox, setLightbox] = useState<{ open: boolean; startIndex: number; selectedOnly?: boolean }>({ open: false, startIndex: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    setSelected(new Set());

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
      localStorage.setItem('lastViewedCode', code);

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

  // Auto-fetch if code changes
  useEffect(() => {
    if (code.length === 5) {
      fetchEvent();
    }
  }, [code]);

  // Toggle selection for an item
  const toggleSelect = (index: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
    setShowSelection(newSelected.size > 0);
  };

  // Handle long press for mobile (simplified: use touch events)
  const handleLongPressStart = (index: number) => {
    const timer = setTimeout(() => {
      toggleSelect(index);
    }, 500); // 500ms long press

    const handleTouchEnd = () => {
      clearTimeout(timer);
    };

    document.addEventListener('touchend', handleTouchEnd, { once: true });
    document.addEventListener('touchmove', handleTouchEnd, { once: true });
  };

  // Download single or multiple
  const downloadMedia = async (urls: string[], filenamePrefix = 'event-share') => {
    for (const [idx, url] of urls.entries()) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        const ext = url.includes('video') ? 'mp4' : 'jpg';
        a.download = `${filenamePrefix}-${Date.now()}-${idx + 1}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(urlObj);
        document.body.removeChild(a);
      } catch (err) {
        console.error('Download failed:', err);
        alert('Download failed for one or more files.');
      }
    }
  };

  // Get media items with types
  const mediaItems: MediaItem[] = media.map((url, index) => ({
    url,
    type: url.includes('/video/') ? 'video' : 'image',
    index,
  }));

  // Selected media
  const selectedMedia = Array.from(selected).map(i => mediaItems[i].url);

  // Lightbox handlers
  const closeLightbox = () => setLightbox({ open: false, startIndex: 0 });
  const goPrev = () => {
    const items = lightbox.selectedOnly ? selectedMedia.map(u => ({ url: u, type: u.includes('/video/') ? 'video' : 'image', index: 0 })) : mediaItems;
    setLightbox({
      open: true,
      startIndex: lightbox.startIndex === 0 ? items.length - 1 : lightbox.startIndex - 1,
      selectedOnly: lightbox.selectedOnly,
    });
  };
  const goNext = () => {
    const items = lightbox.selectedOnly ? selectedMedia.map(u => ({ url: u, type: u.includes('/video/') ? 'video' : 'image', index: 0 })) : mediaItems;
    setLightbox({
      open: true,
      startIndex: lightbox.startIndex === items.length - 1 ? 0 : lightbox.startIndex + 1,
      selectedOnly: lightbox.selectedOnly,
    });
  };

  const currentLightboxItem = (lightbox.selectedOnly 
    ? selectedMedia.map((u, i) => ({ url: u, type: u.includes('/video/') ? 'video' : 'image', index: i })) 
    : mediaItems
  )[lightbox.startIndex] || mediaItems[0];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 relative">
      <div className="max-w-2xl mx-auto">
        <div className="text-center pt-12 mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-linear-to-r from-black to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
            View Your Event
          </h1>

          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="12345"
              className="text-6xl text-center font-mono tracking-widest w-64 p-6 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black"
              maxLength={5}
              autoFocus
            />
            {code && (
              <button
                onClick={() => { setCode(''); setMedia([]); clearCache(); setSelected(new Set()); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500 text-xl"
              >
                ×
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
          <>
            {/* Selection Toolbar */}
            {showSelection && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xl max-w-sm w-full md:w-auto">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    {selected.size} {selected.size === 1 ? 'item' : 'items'} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        downloadMedia(selectedMedia);
                        setShowSelection(false);
                        setSelected(new Set());
                      }}
                      className="flex items-center gap-1 px-3 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-medium hover:opacity-90 transition"
                    >
                      <span className="text-lg">⬇️</span>
                      Download
                    </button>
                    <button
                      onClick={() => {
                        setLightbox({ open: true, startIndex: 0, selectedOnly: true });
                        setShowSelection(false);
                      }}
                      className="flex items-center gap-1 px-3 py-2 border-2 border-black dark:border-white rounded-xl text-sm font-medium hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition"
                    >
                      <span className="text-lg">⛶</span>
                      Full Screen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Media Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-12 relative">
              {mediaItems.map((item) => {
                const isSelected = selected.has(item.index);
                return (
                  <div
                    key={item.index}
                    className={`relative group rounded-xl shadow-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-xl'
                    }`}
                    onClick={() => !showSelection && setLightbox({ open: true, startIndex: item.index })}
                  >
                    {item.type === 'video' ? (
                      <video
                        src={item.url}
                        className="w-full h-48 md:h-64 object-cover"
                        onTouchStart={() => handleLongPressStart(item.index)}
                      />
                    ) : (
                      <Image
                        src={item.url}
                        alt=""
                        width={600}
                        height={600}
                        className="w-full h-48 md:h-64 object-cover"
                        onTouchStart={() => handleLongPressStart(item.index)}
                      />
                    )}

                    {/* Checkbox for Desktop */}
                    {!isMobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.index);
                        }}
                        className={`absolute top-2 left-2 z-10 p-1 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition ${
                          isSelected ? 'bg-blue-500 text-white' : 'text-zinc-600'
                        }`}
                      >
                        <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-700 rounded">
                          {isSelected && <div className="w-full h-full bg-white dark:bg-black rounded-sm" />}
                        </div>
                      </button>
                    )}

                    {/* Action Icons Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition opacity-0 group-hover:opacity-100 flex items-end justify-end p-3 gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadMedia([item.url]);
                        }}
                        className="p-2 bg-white/90 dark:bg-black/90 rounded-full text-black dark:text-white hover:bg-white dark:hover:bg-black transition"
                        title="Download"
                      >
                        <span className="text-lg">⬇️</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightbox({ open: true, startIndex: item.index });
                        }}
                        className="p-2 bg-white/90 dark:bg-black/90 rounded-full text-black dark:text-white hover:bg-white dark:hover:bg-black transition"
                        title="Full Screen"
                      >
                        <span className="text-lg">⛶</span>
                      </button>
                    </div>

                    {/* Mobile Long Press Hint */}
                    {isMobile && !showSelection && (
                      <div className="absolute bottom-2 right-2 text-xs text-white/80 bg-black/50 rounded px-2 py-1">
                        Long press to select
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightbox.open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition"
          >
            ‹
          </button>
          <div
            className="relative max-w-4xl max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {currentLightboxItem.type === 'video' ? (
              <video
                src={currentLightboxItem.url}
                controls
                className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
                autoPlay
              />
            ) : (
              <Image
                src={currentLightboxItem.url}
                alt=""
                width={1200}
                height={800}
                className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
              />
            )}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition"
            >
              ×
            </button>
            <span className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
              {lightbox.startIndex + 1} / {lightbox.selectedOnly ? selected.size : mediaItems.length}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition"
          >
            ›
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadMedia([currentLightboxItem.url]);
            }}
            className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition"
          >
            <span className="text-lg">⬇️</span>
          </button>
        </div>
      )}
    </div>
  );
}