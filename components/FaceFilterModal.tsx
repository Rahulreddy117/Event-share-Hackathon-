'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';

interface FaceFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (descriptor: Float32Array) => void;
}

export default function FaceFilterModal({ isOpen, onClose, onScan }: FaceFilterModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');
    const modelsLoaded = useRef(false);
    const hasScanned = useRef(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            hasScanned.current = false;
            setScanning(false);
            setError('');
            setLoading(true);
        }
    }, [isOpen]);

    // Start camera
    const startCamera = async () => {
        try {
            if (typeof window !== 'undefined' && !window.isSecureContext) {
                setError('Camera requires HTTPS or localhost. Open http://localhost:3000');
                setLoading(false);
                return;
            }
            if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } else {
                setError('Camera not available in this browser.');
                setLoading(false);
            }
        } catch (e: any) {
            console.error('Camera error', e);
            setError(e.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access.' : 'Could not access camera.');
            setLoading(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    };

    // Load face-api models once
    const loadModels = async () => {
        if (modelsLoaded.current) {
            setLoading(false);
            return;
        }
        try {
            const faceapi = await import('@vladmandic/face-api');
            // @ts-ignore
            await faceapi.tf.setBackend('webgl');
            // @ts-ignore
            await faceapi.tf.ready();
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
            ]);
            modelsLoaded.current = true;
            setLoading(false);
        } catch (e) {
            console.error('Model load error', e);
            setError('Failed to load face detection models');
            setLoading(false);
        }
    };

    // Initialize camera and models when modal opens
    useEffect(() => {
        if (isOpen) {
            startCamera();
            loadModels();
        } else {
            stopCamera();
        }
        return stopCamera;
    }, [isOpen]);

    // Auto-scan when face is detected
    useEffect(() => {
        if (!isOpen || loading || hasScanned.current) return;

        let running = true;
        const detectAndScan = async () => {
            if (!videoRef.current || !running || hasScanned.current) return;

            try {
                const faceapi = await import('@vladmandic/face-api');
                const detection = await faceapi
                    .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection && !hasScanned.current) {
                    hasScanned.current = true;
                    setScanning(true);

                    // Give visual feedback before scanning
                    await new Promise(resolve => setTimeout(resolve, 500));

                    onScan(detection.descriptor);
                    setTimeout(() => {
                        onClose();
                    }, 800);
                    return;
                }
            } catch (e) {
                console.error('Detection error', e);
            }

            if (running && !hasScanned.current) {
                requestAnimationFrame(detectAndScan);
            }
        };

        requestAnimationFrame(detectAndScan);
        return () => { running = false; };
    }, [isOpen, loading, onScan, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                        {scanning ? 'Scanning...' : 'Position Your Face'}
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 bg-black/70">
                            <Loader2 className="animate-spin mb-2" size={40} />
                            <p className="text-lg">Loading camera...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center text-red-400 bg-black/90 z-20 p-6 text-center">
                            <div>
                                <p className="text-lg font-medium mb-2">⚠️ {error}</p>
                                <button
                                    onClick={onClose}
                                    className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {scanning && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 z-15">
                            <div className="bg-white dark:bg-zinc-900 rounded-full p-6 shadow-2xl">
                                <CheckCircle size={64} className="text-green-500 animate-pulse" />
                            </div>
                        </div>
                    )}

                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    />

                    {/* Face detection guide overlay */}
                    {!loading && !error && !scanning && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-4 border-blue-500 rounded-full opacity-50 animate-pulse"></div>
                        </div>
                    )}
                </div>

                <div className="p-6 text-center">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {scanning ? '✅ Face detected! Filtering photos...' : '👤 Look at the camera - scanning will start automatically'}
                    </p>
                </div>
            </div>
        </div>
    );
}
