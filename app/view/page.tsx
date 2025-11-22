'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import FaceUploadModal from '@/components/FaceUploadModal';
import { Upload, RefreshCw, X, Filter, Download, Maximize2 } from 'lucide-react';

export default function ViewPage() {
  // Core state
  const [code, setCode] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [allMedia, setAllMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Face-filter state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterProgress, setFilterProgress] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  // Full screen state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Swipe state for full screen
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const minSwipeDistance = 50;

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

  // Perform face-based filtering using the descriptor from the modal
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
        // Skip videos – they cannot be processed with face-api in the browser
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

  // Download handler for images
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = url.split('/').pop()?.split('?')[0] || `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed', error);
      // Fallback: try direct download (may open tab if CORS issue)
      const a = document.createElement('a');
      a.href = url;
      a.download = url.split('/').pop()?.split('?')[0] || `image-${Date.now()}.jpg`;
      a.target = '_blank'; // This might open tab, but better than nothing
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Full screen handlers
  const openFullScreen = (index: number) => {
    setCurrentIndex(index);
    setIsFullScreen(true);
  };

  const closeFullScreen = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIsFullScreen(false);
    setCurrentIndex(0);
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.target instanceof Element && e.target.closest('button')) return; // Ignore if touching button
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      nextImage();
    }
    if (isRightSwipe) {
      prevImage();
    }
  };

  // Click handler for modal background to close
  const handleModalClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeFullScreen();
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
            {allMedia.length > 0 && !loading && media.length === allMedia.length && (
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
              >
                <Filter size={20} />
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
              ) : null}
              {isFiltering && (
                <div className="w-full max-w-md mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Scanning photos...</span>
                    <span>{Math.round(filterProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-300"
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
                <div key={i} className="relative group">
                  <Image
                    src={url}
                    alt=""
                    width={600}
                    height={600}
                    className="w-full h-auto rounded-xl shadow-lg object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
                    onClick={() => openFullScreen(i)}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(url);
                      }}
                      className="bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openFullScreen(i);
                      }}
                      className="bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition"
                      title="Full Screen"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                </div>
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
      {/* Full Screen Modal */}
      {isFullScreen && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
          onClick={handleModalClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={closeFullScreen}
            className="absolute top-4 right-4 text-white text-2xl hover:opacity-80 transition z-10"
          >
            <X size={32} />
          </button>
          <button
            onClick={prevImage}
            className="absolute left-4 text-white text-4xl hover:opacity-80 transition z-10"
          >
            ‹
          </button>
          <button
            onClick={nextImage}
            className="absolute right-4 text-white text-4xl hover:opacity-80 transition z-10"
          >
            ›
          </button>
          <div className="relative w-full h-full flex items-center justify-center">
            {media[currentIndex].includes('/video/') ? (
              <video 
                controls 
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              >
                <source src={media[currentIndex]} />
              </video>
            ) : (
              <Image
                key={media[currentIndex]} // Key to force reload if needed
                src={media[currentIndex]}
                alt=""
                fill
                priority
                className="object-contain cursor-pointer"
                sizes="100vw"
                onClick={nextImage}
                onError={(e) => {
                  console.error('Image load error:', media[currentIndex]);
                  // Fallback or handle error
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}