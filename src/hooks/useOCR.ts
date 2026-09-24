/**
 * useOCR Hook — Manages OCR extraction via a Web Worker
 * 
 * Offloads Tesseract.js to a background thread so the UI 
 * remains smooth during text extraction from images.
 * Falls back to main-thread OCR if Web Workers are unavailable.
 */

'use client';

import { useState, useCallback, useRef } from 'react';

interface UseOCRResult {
  extractText: (imageFile: File) => Promise<string>;
  progress: number;
  isExtracting: boolean;
}

export function useOCR(): UseOCRResult {
  const [progress, setProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const extractText = useCallback(async (imageFile: File): Promise<string> => {
    setIsExtracting(true);
    setProgress(0);

    // Convert File to a data URL so it can be sent to the worker
    const imageData = await fileToDataURL(imageFile);

    // Try Web Worker first for non-blocking OCR
    if (typeof Worker !== 'undefined') {
      try {
        const text = await runInWorker(imageData, setProgress);
        setIsExtracting(false);
        return text;
      } catch {
        // Fall through to main-thread fallback
        console.warn('Web Worker OCR failed, falling back to main thread.');
      }
    }

    // Fallback: run on main thread
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(imageData, 'eng', {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });

    setIsExtracting(false);
    return data.text.trim();
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

function runInWorker(
  imageData: string, 
  onProgress: (p: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/ocr.worker.ts', import.meta.url)
    );
    
    worker.onmessage = (e: MessageEvent) => {
      const { type, progress, text, error } = e.data;
      
      if (type === 'progress') {
        onProgress(progress);
      } else if (type === 'result') {
        worker.terminate();
        resolve(text);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ imageData });
  });
}
