'use client';

import { motion } from 'framer-motion';
import { Loader2, FileText } from 'lucide-react';

interface ExtractingViewProps {
  progress: number;
  previewImage: string | null;
}

/**
 * Extracting View
 * 
 * Shows while Tesseract OCR is running:
 * - A dimmed preview of the captured image
 * - A progress bar for text extraction
 * - An aria-live region for screen reader announcements
 */
export default function ExtractingView({ progress, previewImage }: ExtractingViewProps) {
  return (
    <motion.div
      key="extracting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 py-20"
      role="status"
      aria-label="Extracting text from document"
    >
      {previewImage && (
        <div className="relative w-48 h-64 rounded-2xl overflow-hidden shadow-md mb-4 border border-[#e5e3df] bg-white">
          <img 
            src={previewImage} 
            alt="Document being processed" 
            className="w-full h-full object-cover opacity-60 grayscale" 
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 animate-spin text-white drop-shadow-md" aria-hidden="true" />
          </div>
        </div>
      )}
      
      <div className="text-center">
        <p className="font-medium text-[#1a1917] text-base" aria-live="polite">
          {progress < 30 ? 'Preparing image…' : progress < 80 ? 'Reading document with AI vision…' : 'Finalizing extraction…'}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[#57534e] text-xs">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <span>AI-powered text extraction</span>
        </div>
      </div>

      <div 
        className="w-48 h-1.5 bg-[#e5e3df] rounded-full overflow-hidden" 
        role="progressbar" 
        aria-valuenow={progress} 
        aria-valuemin={0} 
        aria-valuemax={100}
        aria-label={`Text extraction progress: ${progress}%`}
      >
        <motion.div 
          className="h-full bg-[#1a1917] rounded-full" 
          animate={{ width: `${progress}%` }} 
          transition={{ type: 'spring' }} 
        />
      </div>
    </motion.div>
  );
}
