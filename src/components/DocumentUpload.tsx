'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Loader2, Shield, AlertTriangle, ChevronLeft
} from 'lucide-react';
import { scrubPIIWithDetails, type ScrubbingStats } from '@/lib/scrubPII';
import { saveContract } from '@/lib/db';
import type { Clause } from '@/lib/constants';
import { getAnalyzeUrl } from '@/lib/api';
import { usePDFParser } from '@/hooks/usePDFParser';

// Reusable sub-components shared with Scanner
import ReviewScrubbedText from './scanner/ReviewScrubbedText';
import RiskResults from './scanner/RiskResults';

interface DocumentUploadProps {
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'idle' | 'parsing' | 'review' | 'analyzing' | 'result';

/**
 * DocumentUpload Component
 * 
 * Orchestrates client-side PDF parsing and AI legal risk analysis.
 * Reuses ReviewScrubbedText and RiskResults for zero code duplication.
 */
export default function DocumentUpload({ onClose, onSaved }: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [scrubbedText, setScrubbedText] = useState('');
  const [scrubStats, setScrubStats] = useState<ScrubbingStats | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const { parsePDF, isParsing, parseProgress } = usePDFParser();

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Handle uploaded file
  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setStep('parsing');

    try {
      const text = await parsePDF(file);
      setRawText(text);

      const { scrubbedText: scrubbed, stats } = scrubPIIWithDetails(text);
      setScrubbedText(scrubbed);
      setScrubStats(stats);
      setStep('review');
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setError(err.message || 'Could not parse this PDF. Please ensure it is an unencrypted, text-based PDF.');
      setStep('idle');
    }
  }, [parsePDF]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // Update text when user edits in review screen
  const handleUpdateText = useCallback((newText: string) => {
    setRawText(newText);
    const { scrubbedText: scrubbed, stats } = scrubPIIWithDetails(newText);
    setScrubbedText(scrubbed);
    setScrubStats(stats);
  }, []);

  // Run AI analysis
  const analyzeDocument = async () => {
    setStep('analyzing');
    setError(null);
    
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch(getAnalyzeUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scrubbedText, mode: 'pdf', fileName }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setClauses(data.clauses || []);
      setSummary(data.summary || null);
      setStep('result');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed. Please try again.');
      setStep('review');
    }
  };

  // Save to IndexedDB
  const handleSave = async () => {
    try {
      await saveContract({
        title: fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || 'Uploaded PDF Document',
        createdAt: new Date(),
        documentType: 'pdf',
        rawText,
        scrubbedText,
        clauses,
        overallRisk: clauses.some(c => c.riskLevel === 'RED') ? 'RED'
          : clauses.some(c => c.riskLevel === 'YELLOW') ? 'YELLOW' : 'GREEN',
        summaryNotes: summary || undefined,
      });
      setSaved(true);
      setTimeout(onSaved, 900);
    } catch { /* ignore */ }
  };

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#e5e3df] text-[#57534e] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917]"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-semibold text-[#1a1917]">
          {step === 'result' ? 'Document Analysis' : 'Upload Document'}
        </h2>
      </div>

      {/* Global Error Banner */}
      {error && step !== 'idle' && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Idle — Drop zone */}
        {step === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              id="pdf-drop-zone"
              aria-label="Upload Dropzone"
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                isDragOver ? 'border-[#1a1917] bg-[#f2f1ee]' : 'border-[#ccc9c3] bg-white hover:border-[#a8a29e]'
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <div className="p-4 rounded-full bg-[#f2f1ee]">
                <Upload className="w-6 h-6 text-[#57534e]" />
              </div>
              <div className="text-center">
                <p className="font-medium text-[#1a1917] text-sm">Drop a PDF here</p>
                <p className="text-[#a8a29e] text-xs mt-1">or click to browse · max 25 MB</p>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                <Shield className="w-3.5 h-3.5" />
                Parsed entirely on your device
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </div>
            {error && <p role="alert" className="mt-3 text-red-600 text-xs text-center">{error}</p>}
          </motion.div>
        )}

        {/* Step 2: Parsing Progress */}
        {step === 'parsing' && (
          <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-5 py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#57534e]" />
            <div className="text-center">
              <p className="font-medium text-[#1a1917] text-sm">Reading PDF locally…</p>
              <p className="text-[#a8a29e] text-xs mt-1 max-w-[200px] truncate">{fileName}</p>
            </div>
            <div 
              className="w-48 h-1.5 bg-[#e5e3df] rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={parseProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full bg-[#1a1917] rounded-full"
                animate={{ width: `${parseProgress}%` }}
                transition={{ type: 'spring', stiffness: 80 }}
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: Review Scrubbed Text (Reuses ReviewScrubbedText) */}
        {step === 'review' && scrubStats && (
          <ReviewScrubbedText
            scrubbedText={scrubbedText}
            rawText={rawText}
            stats={scrubStats}
            onAnalyze={analyzeDocument}
            onUpdateText={handleUpdateText}
            onRetake={() => {
              setStep('idle');
              setRawText('');
              setScrubbedText('');
              setScrubStats(null);
            }}
          />
        )}

        {/* Step 4: Analyzing Spinner */}
        {step === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5 py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#57534e]" />
            <div className="text-center">
              <p className="font-medium text-[#1a1917] text-sm">Analyzing clauses with AI…</p>
              <p className="text-[#a8a29e] text-xs mt-1">Only scrubbed, zero-knowledge text is evaluated</p>
            </div>
          </motion.div>
        )}

        {/* Step 5: Risk Results (Reuses RiskResults) */}
        {step === 'result' && (
          <RiskResults
            clauses={clauses}
            summary={summary}
            saved={saved}
            onSave={handleSave}
            onScanAnother={() => {
              setStep('idle');
              setSaved(false);
              setClauses([]);
              setSummary(null);
            }}
            onBackToReview={() => setStep('review')}
            scrubbedText={scrubbedText}
            documentTitle={fileName || 'Uploaded PDF Document'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
