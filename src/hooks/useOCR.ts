/**
 * useOCR Hook — Vision-based OCR via Groq API with Preprocessing & High-Contrast Fallback
 * 
 * 1. Resizes camera photos client-side to max 1800px dimension and converts to JPEG (~300KB).
 * 2. Primary: Sends preprocessed image to /api/ocr using Groq's vision model (qwen/qwen3.8-27b).
 * 3. Fallback: If server OCR is unavailable, applies contrast enhancement and runs client-side Tesseract.js.
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
      // 1. Prepare and optimize image client-side
      setProgress(15);
      const { standardDataUrl, enhancedDataUrl } = await prepareImage(imageFile);
      setProgress(30);

      // 2. Try server-side vision OCR first (dramatically more accurate)
      try {
        const text = await visionOCR(standardDataUrl, setProgress);
        setIsExtracting(false);
        return text;
      } catch (visionErr: any) {
        console.warn('Vision OCR failed, attempting enhanced Tesseract fallback:', visionErr.message);
      }

      // 3. Fallback: Run Tesseract.js on the high-contrast preprocessed canvas
      setProgress(40);
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(enhancedDataUrl, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(40 + Math.round(m.progress * 55));
          }
        },
      });

      setIsExtracting(false);
      const cleaned = data.text.trim();
      if (!cleaned || cleaned.length < 15) {
        throw new Error('Unable to extract clear text. Please position the camera closer or improve lighting.');
      }
      return cleaned;
    } catch (err) {
      setIsExtracting(false);
      throw err;
    }
  }, []);

  return { extractText, progress, isExtracting };
}

/**
 * Preprocesses camera image using HTML5 Canvas:
 * - Downscales large phone camera photos (max dimension 1800px)
 * - Standardizes orientation and compresses to clean JPEG
 * - Generates a contrast-enhanced grayscale version for Tesseract fallback
 */
async function prepareImage(file: File): Promise<{ standardDataUrl: string; enhancedDataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const MAX_DIM = 1800;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to basic FileReader if Canvas 2D is unavailable
          fileToDataURL(file).then(dataUrl => resolve({ standardDataUrl: dataUrl, enhancedDataUrl: dataUrl })).catch(reject);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Standard JPEG for Groq Vision
        const standardDataUrl = canvas.toDataURL('image/jpeg', 0.88);

        // Enhanced high-contrast grayscale for Tesseract
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // Boost contrast by stretching around midpoint
          const factor = 1.35;
          const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
          d[i] = adjusted;
          d[i + 1] = adjusted;
          d[i + 2] = adjusted;
        }
        ctx.putImageData(imgData, 0, 0);
        const enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.90);

        resolve({ standardDataUrl, enhancedDataUrl });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image file.'));
    };

    img.src = url;
  });
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
  onProgress(45);
  
  const res = await fetch(getOcrUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData }),
  });

  onProgress(85);

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
