'use client';

import { useState, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface FaceUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (descriptor: Float32Array) => void;
}

export default function FaceUploadModal({ isOpen, onClose, onScan }: FaceUploadModalProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelsLoaded = useRef(false);

    const loadModels = async () => {
        if (modelsLoaded.current) return;
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
        } catch (e) {
            console.error('Model load error', e);
            throw new Error('Failed to load face detection models');
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file');
            return;
        }

        // Reset states
        setError('');
        setSuccess(false);
        setLoading(true);

        try {
            // Create image preview
            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageUrl = event.target?.result as string;
                setSelectedImage(imageUrl);

                // Load models and detect face
                await loadModels();
                await detectFace(imageUrl);
            };
            reader.readAsDataURL(file);
        } catch (e: any) {
            console.error('File read error', e);
            setError('Failed to read image file');
            setLoading(false);
        }
    };

    const detectFace = async (imageUrl: string) => {
        try {
            const faceapi = await import('@vladmandic/face-api');

            // Create image element
            const img = document.createElement('img');
            img.src = imageUrl;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Failed to load image'));
            });

            // Detect face
            const detection = await faceapi
                .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setError('No face detected in this photo. Please choose a photo with a clear face.');
                setLoading(false);
                return;
            }

            // Success!
            setSuccess(true);
            setLoading(false);

            // Wait a moment for user to see success, then trigger filtering
            setTimeout(() => {
                onScan(detection.descriptor);
                onClose();
                // Reset for next use
                setSelectedImage(null);
                setSuccess(false);
                setError('');
            }, 1000);

        } catch (e: any) {
            console.error('Face detection error', e);
            setError('Failed to detect face. Please try a different photo.');
            setLoading(false);
        }
    };

    const handleChoosePhoto = () => {
        fileInputRef.current?.click();
    };

    const handleReset = () => {
        setSelectedImage(null);
        setError('');
        setSuccess(false);
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                        Upload Your Photo
                    </h2>
                    <button
                        onClick={() => { onClose(); handleReset(); }}
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* File Input (Hidden) */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Upload Area or Preview */}
                    {!selectedImage ? (
                        <div
                            onClick={handleChoosePhoto}
                            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition"
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <ImageIcon size={40} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
                                        Choose a photo with your face
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        Click to browse or drag and drop
                                    </p>
                                </div>
                                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition flex items-center gap-2">
                                    <Upload size={20} />
                                    Select Photo
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Image Preview */}
                            <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                <img
                                    src={selectedImage}
                                    alt="Selected"
                                    className="w-full h-auto max-h-96 object-contain"
                                />

                                {/* Loading Overlay */}
                                {loading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <div className="text-white text-center">
                                            <Loader2 className="animate-spin mx-auto mb-2" size={40} />
                                            <p className="text-lg font-medium">Detecting face...</p>
                                        </div>
                                    </div>
                                )}

                                {/* Success Overlay */}
                                {success && (
                                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                        <div className="bg-white dark:bg-zinc-900 rounded-full p-6 shadow-2xl">
                                            <CheckCircle size={64} className="text-green-500" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                    <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Success Message */}
                            {success && (
                                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                                    <CheckCircle size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        Face detected! Filtering photos...
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReset}
                                    disabled={loading || success}
                                    className="flex-1 px-6 py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Choose Different Photo
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-6 pb-6">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                        💡 Tip: Choose a photo with a clear, well-lit face for best results
                    </p>
                </div>
            </div>
        </div>
    );
}
