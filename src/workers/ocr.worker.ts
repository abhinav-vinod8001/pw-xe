/**
 * OCR Web Worker for LexAR
 * 
 * Offloads Tesseract.js OCR processing to a background thread 
 * so the main UI thread stays responsive during text extraction.
 */

// Web Workers can't use ES module imports directly for Tesseract.
// We use importScripts-style dynamic import within the worker.

self.onmessage = async (event: MessageEvent) => {
  const { imageData } = event.data;
  
  try {
    // Dynamically import Tesseract inside the worker
    const Tesseract = await import('tesseract.js');
    
    const { data } = await Tesseract.recognize(imageData, 'eng', {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          self.postMessage({ 
            type: 'progress', 
            progress: Math.round(m.progress * 100) 
          });
        }
      },
    });

    self.postMessage({ 
      type: 'result', 
      text: data.text.trim() 
    });
  } catch (err: any) {
    self.postMessage({ 
      type: 'error', 
      error: err.message || 'OCR processing failed.' 
    });
  }
};
