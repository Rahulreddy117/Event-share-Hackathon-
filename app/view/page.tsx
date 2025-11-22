'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import FaceUploadModal from '@/components/FaceUploadModal';
import { Upload, RefreshCw, X, Filter, Download, Maximize2, Eye } from 'lucide-react';

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

  // Render UI - REDESIGNED WITH NEON THEME
  return (
    <div className="min-h-screen bg-[#0a0e27] relative overflow-hidden">
      {/* Animated background effects - UI ONLY */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
      
      {/* Floating orbs - UI ONLY */}
      <div className="absolute top-20 left-10 w-48 h-48 md:w-72 md:h-72 bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-64 h-64 md:w-96 md:h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      
      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Section - REDESIGNED */}
          <div className="text-center pt-8 md:pt-16 mb-12 md:mb-16">
            {/* Title with neon gradient - UI ONLY - RESPONSIVE */}
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-6">
              <Eye className="w-6 h-6 md:w-8 md:h-8 lg:w-12 lg:h-12 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]" />
              <h1 className="text-3xl md:text-5xl lg:text-7xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                  View Event
                </span>
              </h1>
            </div>
            
            {/* Subtitle - UI ONLY */}
            <p className="text-cyan-300/80 text-sm md:text-base font-mono mb-12">
              Enter your <span className="text-green-400 font-bold">5-digit code</span> to access event media
            </p>
            
            {/* Code Input Container - REDESIGNED + RESPONSIVE FIX */}
            <div className="relative max-w-md mx-auto mb-8 px-4">
              {/* Glowing border container - UI ONLY */}
              <div className="relative p-[2px] rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-[0_0_40px_rgba(34,211,238,0.6)]">
                <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-6">
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="00000"
                    className="text-4xl md:text-5xl lg:text-7xl text-center font-mono tracking-[0.3em] md:tracking-[0.5em] w-full bg-transparent border-none outline-none text-cyan-300 placeholder-cyan-900/50 caret-cyan-400 pr-12 md:pr-0"
                    maxLength={5}
                    autoFocus
                  />
                  {/* Filter button - REDESIGNED but logic untouched - RESPONSIVE FIX */}
                  {allMedia.length > 0 && !loading && media.length === allMedia.length && (
                    <button
                      onClick={() => setIsFilterModalOpen(true)}
                      className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full p-2 md:p-3 hover:shadow-[0_0_30px_rgba(34,211,238,0.8)] transition-all duration-300 hover:scale-110"
                      title="Filter by face"
                    >
                      <Filter size={18} className="md:w-5 md:h-5" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Decorative lines - UI ONLY - Hide on mobile */}
              <div className="hidden md:block absolute -left-8 top-1/2 w-6 h-[2px] bg-gradient-to-r from-transparent to-cyan-500"></div>
              <div className="hidden md:block absolute -right-8 top-1/2 w-6 h-[2px] bg-gradient-to-l from-transparent to-purple-500"></div>
            </div>
            
            {/* View Button - REDESIGNED + RESPONSIVE */}
            <button
              onClick={fetchEvent}
              disabled={loading || code.length !== 5}
              className="group relative px-8 md:px-10 py-4 md:py-5 text-base md:text-lg lg:text-xl font-bold text-white rounded-full overflow-hidden transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {/* Button gradient background - UI ONLY */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-cyan-500 to-blue-500 group-hover:shadow-[0_0_40px_rgba(34,211,238,0.8)] transition-all duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative flex items-center gap-2">
                <Eye className="w-5 h-5 md:w-6 md:h-6" />
                {loading ? 'Loading...' : 'View Photos'}
              </span>
            </button>
            
            {/* Filter Controls - REDESIGNED */}
            {allMedia.length > 0 && !loading && (
              <div className="mt-10 flex flex-col items-center gap-6">
                {media.length !== allMedia.length ? (
                  <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                    <p className="text-cyan-300 font-mono text-sm md:text-base">
                      Found <span className="text-green-400 font-bold text-xl">{filteredCount}</span> photos with your face
                    </p>
                    <button
                      onClick={clearFilter}
                      className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-full text-sm font-semibold text-white transition-all duration-300 flex items-center gap-2 border border-slate-500 hover:shadow-[0_0_20px_rgba(148,163,184,0.5)]"
                    >
                      <X size={18} />
                      Show All Photos
                    </button>
                  </div>
                ) : null}
                
                {/* Progress bar - REDESIGNED */}
                {isFiltering && (
                  <div className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                    <div className="flex justify-between text-sm font-mono mb-3 text-cyan-300">
                      <span>Scanning photos...</span>
                      <span className="text-green-400 font-bold">{Math.round(filterProgress)}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800/80 rounded-full overflow-hidden border border-cyan-900/50">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.8)]"
                        style={{ width: `${filterProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Error message - REDESIGNED */}
            {error && (
              <div className="mt-8 bg-red-950/60 backdrop-blur-xl border border-red-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <p className="text-red-400 text-lg font-mono">{error}</p>
              </div>
            )}
          </div>
          
          {/* Media Grid - REDESIGNED */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-12">
              {media.map((url, i) =>
                url.includes('/video/') ? (
                  <div key={i} className="relative group">
                    {/* Video with neon border - UI ONLY */}
                    <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300">
                      <video 
                        controls 
                        className="w-full rounded-2xl shadow-2xl bg-slate-900"
                      >
                        <source src={url} />
                      </video>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="relative group">
                    {/* Image with neon border and glow - UI ONLY */}
                    <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 hover:shadow-[0_0_40px_rgba(34,211,238,0.7)] transition-all duration-300 group-hover:scale-[1.02]">
                      <div className="relative rounded-2xl overflow-hidden bg-slate-900">
                        <Image
                          src={url}
                          alt=""
                          width={600}
                          height={600}
                          className="w-full h-auto object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
                          onClick={() => openFullScreen(i)}
                        />
                        {/* Action buttons - REDESIGNED but logic untouched */}
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(url);
                            }}
                            className="bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-full p-2.5 hover:shadow-[0_0_20px_rgba(34,211,238,0.8)] transition-all duration-300 hover:scale-110"
                            title="Download"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFullScreen(i);
                            }}
                            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full p-2.5 hover:shadow-[0_0_20px_rgba(168,85,247,0.8)] transition-all duration-300 hover:scale-110"
                            title="Full Screen"
                          >
                            <Maximize2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Face Upload Modal - Logic untouched */}
      <FaceUploadModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onScan={handleFaceScan}
      />
      
      {/* Full Screen Modal - REDESIGNED */}
      {isFullScreen && (
        <div
          className="fixed inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
          onClick={handleModalClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Close button - REDESIGNED */}
          <button
            onClick={closeFullScreen}
            className="absolute top-6 right-6 text-white text-2xl hover:text-cyan-400 transition-all z-20 bg-slate-900/60 backdrop-blur-xl rounded-full p-3 border border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.8)] hover:scale-110"
          >
            <X size={32} />
          </button>
          
          {/* Navigation buttons - REDESIGNED */}
          <button
            onClick={prevImage}
            className="absolute left-6 text-white text-5xl hover:text-cyan-400 transition-all z-20 bg-slate-900/60 backdrop-blur-xl rounded-full w-14 h-14 flex items-center justify-center border border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.8)] hover:scale-110"
          >
            ‹
          </button>
          <button
            onClick={nextImage}
            className="absolute right-6 text-white text-5xl hover:text-cyan-400 transition-all z-20 bg-slate-900/60 backdrop-blur-xl rounded-full w-14 h-14 flex items-center justify-center border border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.8)] hover:scale-110"
          >
            ›
          </button>
          
          {/* Media viewer with neon glow - UI ONLY */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative max-w-[90vw] max-h-[90vh] p-[3px] rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 shadow-[0_0_60px_rgba(34,211,238,0.8)]">
              <div className="relative bg-slate-950 rounded-3xl overflow-hidden">
                {media[currentIndex].includes('/video/') ? (
                  <video 
                    controls 
                    className="max-w-full max-h-[85vh] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <source src={media[currentIndex]} />
                  </video>
                ) : (
                  <Image
                    key={media[currentIndex]}
                    src={media[currentIndex]}
                    alt=""
                    fill
                    priority
                    className="object-contain cursor-pointer"
                    sizes="90vw"
                    onClick={nextImage}
                    onError={(e) => {
                      console.error('Image load error:', media[currentIndex]);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}