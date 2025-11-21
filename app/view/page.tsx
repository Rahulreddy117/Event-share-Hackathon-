'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import FaceUploadModal from '@/components/FaceUploadModal';
import { Upload, RefreshCw, X } from 'lucide-react';

export default function ViewPage() {
  // Core state
  const [code, setCode] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [allMedia, setAllMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Face‑filter state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterProgress, setFilterProgress] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  // Helper: clear cached data for the current event code
  const clearCache = () => {
    if (code) {
      localStorage.removeItem(`cachedMedia_${code}`);
      localStorage.removeItem(`cacheTime_${code}`);
    }
  };

  // Load cached media on mount (if any) and keep code in sync with localStorage
  useEffect(() => {
    const lastCode = localStorage.getItem('lastEventCode') || localStorage.getItem('activeEventCode');
    if (lastCode && lastCode.length === 5) {
      setCode(lastCode);
      loadCachedMedia(lastCode);
    }
  }, []);

  // Load cached media or fetch fresh data when needed
  const loadCachedMedia = async (currentCode: string) => {
    const cached = localStorage.getItem(`cachedMedia_${currentCode}`);
    const cacheTime = localStorage.getItem(`cacheTime_${currentCode}`);
    if (cached && cacheTime) {
      const now = Date.now();
      const age = now - parseInt(cacheTime);
      if (age < 24 * 60 * 60 * 1000) {
        const cachedMedia = JSON.parse(cached) as string[];
        setMedia(cachedMedia);
        setAllMedia(cachedMedia);
        // Verify expiry quickly
        await fetchEvent();
        return;
      }
    }
    await fetchEvent();
  };

  // Fetch event data from Firestore
  const fetchEvent = async () => {
    if (code.length !== 5) return;
    setLoading(true);
    setError('');
    setMedia([]);
    setAllMedia([]);
    try {
      const docRef = doc(db, 'events', code);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setError('Invalid or expired code');
        clearCache();
        return;
      }
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate?.();
      if (!expiresAt) {
        setError('This event has no expiry or is corrupted');
        clearCache();
        return;
      }
      if (new Date() > expiresAt) {
        setError('This event has expired');
        clearCache();
        return;
      }
      const newMedia = (data.urls || []) as string[];
      setMedia(newMedia);
      setAllMedia(newMedia);
      // Cache for future loads
      localStorage.setItem(`cachedMedia_${code}`, JSON.stringify(newMedia));
      localStorage.setItem(`cacheTime_${code}`, Date.now().toString());
      localStorage.setItem('lastViewedCode', code);
    } catch (e) {
      console.error(e);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Reset filter to show all photos again
  const clearFilter = () => {
    setMedia(allMedia);
    setFilteredCount(0);
  };

  // Perform face‑based filtering using the descriptor from the modal
  const handleFaceScan = async (userDescriptor: Float32Array) => {
    setIsFiltering(true);
    setFilterProgress(0);
    const matches: string[] = [];
    try {
      const faceapi = await import('@vladmandic/face-api');
      // Ensure TF backend is ready (safety net)
      // @ts-ignore
      await faceapi.tf.setBackend('webgl');
      // @ts-ignore
      await faceapi.tf.ready();
      // Load models if they haven't been loaded yet
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);

      const total = allMedia.length;
      for (let i = 0; i < total; i++) {
        const url = allMedia[i];
        // Skip videos – they cannot be processed with face‑api in the browser
        if (url.includes('/video/')) {
          setFilterProgress(((i + 1) / total) * 100);
          continue;
        }
        try {
          const img = document.createElement('img');
          img.crossOrigin = 'anonymous';
          img.src = url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
          const isMatch = detections.some(d => {
            const distance = faceapi.euclideanDistance(d.descriptor, userDescriptor);
            return distance < 0.6; // reasonable threshold
          });
          if (isMatch) matches.push(url);
        } catch (e) {
          console.error('Error processing image', url, e);
        }
        setFilterProgress(((i + 1) / total) * 100);
      }
      setMedia(matches);
      setFilteredCount(matches.length);
    } catch (e) {
      console.error('Filtering error', e);
      setError('Failed to filter photos.');
    } finally {
      setIsFiltering(false);
    }
  };

  // Render UI
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
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="12345"
              className="text-6xl text-center font-mono tracking-widest w-64 p-6 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black"
              maxLength={5}
              autoFocus
            />
            {code && (
              <button
                onClick={() => { setCode(''); setMedia([]); setAllMedia([]); clearCache(); }}
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

          {/* Filter Controls */}
          {allMedia.length > 0 && !loading && (
            <div className="mt-8 flex flex-col items-center gap-4">
              {media.length !== allMedia.length ? (
                <div className="flex items-center gap-4">
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Found {filteredCount} photos with your face
                  </p>
                  <button
                    onClick={clearFilter}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-full text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition flex items-center gap-2"
                  >
                    <X size={16} />
                    Show All Photos
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Upload size={20} />
                  Upload My Photo
                </button>
              )}

              {isFiltering && (
                <div className="w-full max-w-md mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Scanning photos...</span>
                    <span>{Math.round(filterProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${filterProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 mt-4 text-lg">{error}</p>}
        </div>

        {/* Media Grid */}
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

      {/* Face Upload Modal */}
      <FaceUploadModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onScan={handleFaceScan}
      />
    </div>
  );
}