/**
 * useOCR Hook — Vision-based OCR via Groq API
 * 
 * Sends the captured image to /api/ocr which uses a Groq vision model
 * to extract text. This is dramatically more accurate than Tesseract.js
 * for phone camera photos with perspective distortion, shadows, etc.
 * 
 * Falls back to client-side Tesseract.js only if the server OCR fails.
 */

'use client';

import { useState, useCallback } from 'react';
import { getOcrUrl } from '@/lib/api';

interface UseOCRResult {
  extractText: (imageFile: File) => Promise<string>;
  progress: number;
  isExtracting: boolean;
}

export function useOCR(): UseOCRResult {
  const [progress, setProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);

  const extractText = useCallback(async (imageFile: File): Promise<string> => {
    setIsExtracting(true);
    setProgress(0);

    try {
      // Convert file to base64 data URL
      setProgress(10);
      const imageData = await fileToDataURL(imageFile);
      setProgress(20);

      // Try server-side vision OCR first (much more accurate)
      try {
        const text = await visionOCR(imageData, setProgress);
        setIsExtracting(false);
        return text;
      } catch (visionErr: any) {
        console.warn('Vision OCR failed, falling back to Tesseract:', visionErr.message);
      }

      // Fallback: client-side Tesseract.js
      setProgress(30);
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(imageData, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(30 + Math.round(m.progress * 70));
          }
        },
      });

      setIsExtracting(false);
      return data.text.trim();
    } catch (err) {
      setIsExtracting(false);
      throw err;
    }
  }, []);

  return { extractText, progress, isExtracting };
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

async function visionOCR(
  imageData: string,
  onProgress: (p: number) => void
): Promise<string> {
  onProgress(30);
  
  const res = await fetch(getOcrUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData }),
  });

  onProgress(80);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `OCR server returned ${res.status}`);
  }

  const result = await res.json();
  onProgress(100);

  if (!result.text || result.text.trim().length < 10) {
    throw new Error('No readable text found in the image.');
  }

  return result.text.trim();
}
