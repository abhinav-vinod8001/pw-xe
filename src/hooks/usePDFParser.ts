/**
 * usePDFParser Hook — Client-side PDF text extraction via PDF.js
 * 
 * Extracts raw text page-by-page entirely in the user's browser,
 * ensuring zero bytes of the unparsed file leave the local device.
 */

'use client';

import { useState, useCallback } from 'react';

interface UsePDFParserResult {
  parsePDF: (file: File) => Promise<string>;
  isParsing: boolean;
  parseProgress: number;
  error: string | null;
  resetParser: () => void;
}

export function usePDFParser(): UsePDFParserResult {
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resetParser = useCallback(() => {
    setIsParsing(false);
    setParseProgress(0);
    setError(null);
  }, []);

  const parsePDF = useCallback(async (file: File): Promise<string> => {
    setIsParsing(true);
    setParseProgress(0);
    setError(null);

    // Basic file validation
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      const err = 'Only PDF documents are supported.';
      setError(err);
      setIsParsing(false);
      throw new Error(err);
    }

    if (file.size > 25 * 1024 * 1024) {
      const err = 'File too large. Maximum size is 25 MB.';
      setError(err);
      setIsParsing(false);
      throw new Error(err);
    }

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      if (numPages === 0) {
        throw new Error('PDF document has no pages.');
      }

      let fullText = '';
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');

        fullText += pageText + '\n\n';
        setParseProgress(Math.round((pageNum / numPages) * 100));
      }

      const trimmed = fullText.trim();
      if (!trimmed || trimmed.length < 20) {
        throw new Error('No readable text found. The PDF may be scanned as an image or password-protected.');
      }

      setIsParsing(false);
      return trimmed;
    } catch (err: any) {
      const msg = err.message || 'Could not parse this PDF. Please ensure it is a valid, unencrypted file.';
      setError(msg);
      setIsParsing(false);
      throw new Error(msg);
    }
  }, []);

  return { parsePDF, isParsing, parseProgress, error, resetParser };
}
