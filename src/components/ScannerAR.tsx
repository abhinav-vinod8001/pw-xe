'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Camera, X, AlertTriangle } from 'lucide-react';
import { scrubPIIWithDetails, type ScrubbingStats } from '@/lib/scrubPII';
import { saveContract } from '@/lib/db';
import type { Clause } from '@/lib/constants';
import { getAnalyzeUrl } from '@/lib/api';
import { useOCR } from '@/hooks/useOCR';

// Sub-components (single-responsibility)
import CameraCapture from './scanner/CameraCapture';
import ExtractingView from './scanner/ExtractingView';
import ReviewScrubbedText from './scanner/ReviewScrubbedText';
import AnalyzingView from './scanner/AnalyzingView';
import RiskResults from './scanner/RiskResults';

interface ScannerARProps { onClose: () => void; }

type ScannerStep = 'camera' | 'extracting' | 'review' | 'analyzing' | 'result';

/**
 * ScannerAR — Orchestrator Component
 * 
 * Manages the state machine for the document scanning flow:
 *   camera → extracting → review → analyzing → result
 * 
 * Each step is rendered by a dedicated sub-component.
 * OCR is offloaded to a Web Worker via the useOCR hook.
 */
export default function ScannerAR({ onClose }: ScannerARProps) {
  const [step, setStep] = useState<ScannerStep>('camera');
  
  // Data state
  const [rawText, setRawText] = useState('');
  const [scrubbedText, setScrubbedText] = useState('');
  const [scrubStats, setScrubStats] = useState<ScrubbingStats | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { extractText, progress } = useOCR();

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      abortControllerRef.current?.abort();
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [onClose, previewImage]);

  // Step 1 → 2: User selects a file
  const handleFileSelected = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewImage(url);
    setStep('extracting');
    setError(null);
    setClauses([]);
    setSummary(null);

    try {
      const extracted = await extractText(file);
      if (!extracted || extracted.length < 15) {
        throw new Error('No readable text detected. Please ensure the document is well-lit and in focus.');
      }

      setRawText(extracted);
      const { scrubbedText: scrubbed, stats } = scrubPIIWithDetails(extracted);
      setScrubbedText(scrubbed);
      setScrubStats(stats);
      setStep('review');
    } catch (err: any) {
      console.error('OCR error:', err);
      setError(err.message || 'Text extraction failed. Please try again.');
      setStep('camera');
      URL.revokeObjectURL(url);
      setPreviewImage(null);
    }
  }, [extractText]);

  // Allow user to edit extracted text in review screen
  const handleUpdateText = useCallback((newText: string) => {
    setRawText(newText);
    const { scrubbedText: scrubbed, stats } = scrubPIIWithDetails(newText);
    setScrubbedText(scrubbed);
    setScrubStats(stats);
  }, []);

  // Step 3 → 4: User approves scrubbed text
  const handleAnalyze = useCallback(async () => {
    setStep('analyzing');
    setError(null);

    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const res = await fetch(getAnalyzeUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scrubbedText, mode: 'scan' }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const result = await res.json();
      setClauses(result.clauses || []);
      setSummary(result.summary || null);
      setStep('result');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed. Please try again.');
      setStep('review');
    }
  }, [scrubbedText]);

  // Save to IndexedDB
  const handleSave = useCallback(async () => {
    if (!rawText || clauses.length === 0) return;
    try {
      await saveContract({
        title: `Camera Scan — ${new Date().toLocaleString()}`,
        createdAt: new Date(),
        documentType: 'scan',
        rawText,
        scrubbedText,
        clauses: clauses.map(c => ({ text: c.text, riskLevel: c.riskLevel, summary: c.summary, category: c.category })),
        overallRisk: clauses.some(c => c.riskLevel === 'RED') ? 'RED'
          : clauses.some(c => c.riskLevel === 'YELLOW') ? 'YELLOW' : 'GREEN',
      });
      setSaved(true);
    } catch { /* ignore */ }
  }, [rawText, scrubbedText, clauses]);

  // Reset to camera
  const handleScanAnother = useCallback(() => {
    setStep('camera');
    setSaved(false);
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
    }
  }, [previewImage]);

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f7f4] flex flex-col overflow-y-auto" role="dialog" aria-modal="true" aria-label="Document scanner">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#f8f7f4] border-b border-[#e5e3df]">
        <div className="flex items-center gap-2 text-[#1a1917]">
          <Camera className="w-4 h-4 opacity-80" aria-hidden="true" />
          <span className="text-sm font-medium">Scan Document</span>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 rounded-full hover:bg-[#e5e3df] text-[#1a1917] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917]"
          aria-label="Close scanner"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 flex flex-col">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'camera' && (
            <CameraCapture onFileSelected={handleFileSelected} />
          )}

          {step === 'extracting' && (
            <ExtractingView progress={progress} previewImage={previewImage} />
          )}

          {step === 'review' && scrubStats && (
            <ReviewScrubbedText
              scrubbedText={scrubbedText}
              rawText={rawText}
              stats={scrubStats}
              onAnalyze={handleAnalyze}
              onUpdateText={handleUpdateText}
              onRetake={() => {
                setStep('camera');
                if (previewImage) URL.revokeObjectURL(previewImage);
                setPreviewImage(null);
              }}
            />
          )}

          {step === 'analyzing' && (
            <AnalyzingView />
          )}

          {step === 'result' && (
            <RiskResults
              clauses={clauses}
              summary={summary}
              saved={saved}
              onSave={handleSave}
              onScanAnother={handleScanAnother}
              onBackToReview={() => setStep('review')}
              scrubbedText={scrubbedText}
              documentTitle="Camera Scanned Document"
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
