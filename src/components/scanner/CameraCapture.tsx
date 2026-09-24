'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload } from 'lucide-react';

interface CameraCaptureProps {
  onFileSelected: (file: File) => void;
}

/**
 * Camera Capture Step
 * 
 * Renders two buttons:
 * 1. "Open Camera" — triggers the native camera app via <input capture="environment">
 * 2. "Upload from Gallery" — opens the photo gallery picker
 */
export default function CameraCapture({ onFileSelected }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
      setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 1000);
    }
  };

  return (
    <motion.div
      key="camera"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col justify-center items-center py-10"
      role="region"
      aria-label="Document capture"
    >
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef}
        className="hidden" 
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="text-center max-w-sm w-full space-y-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#e5e3df] flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-[#f8f7f4] rounded-full flex items-center justify-center text-[#1a1917]" aria-hidden="true">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1a1917]">Take a Photo</h2>
            <p className="text-sm text-[#57534e] mt-1">Use your native camera app to capture a high-quality photo of the document.</p>
          </div>
        </div>

        <button
          id="btn-open-camera"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] text-white font-medium text-base transition-colors shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917]"
          aria-label="Open native camera to photograph a document"
        >
          <Camera className="w-5 h-5" aria-hidden="true" />
          Open Camera
        </button>
        
        <button
          id="btn-upload-gallery"
          onClick={openGallery}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-[#e5e3df] hover:bg-[#f8f7f4] text-[#1a1917] font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917]"
          aria-label="Upload a document image from your photo gallery"
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          Upload from Gallery
        </button>
      </div>
    </motion.div>
  );
}
