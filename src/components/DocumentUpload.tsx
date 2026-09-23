'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Loader2, Shield, AlertTriangle, Zap,
  CheckCircle, X, ChevronLeft, Save, Eye, EyeOff
} from 'lucide-react';
import { scrubPIIWithDetails } from '@/lib/scrubPII';
import { saveContract } from '@/lib/db';
import { RISK_CONFIG, type Clause } from '@/lib/constants';
import { getAnalyzeUrl } from '@/lib/api';

interface DocumentUploadProps {
  onClose: () => void;
  onSaved: () => void;
}



type Step = 'idle' | 'parsing' | 'review' | 'analyzing' | 'result';

export default function DocumentUpload({ onClose, onSaved }: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [scrubbedText, setScrubbedText] = useState('');
  const [redactionStats, setRedactionStats] = useState<{
    totalRedactions: number; names: number; currencies: number;
    emails: number; phones: number; identifiers: number; addresses: number;
  } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const parsePDF = useCallback(async (file: File) => {
    setStep('parsing');
    setFileName(file.name);
    setError(null);
    setParseProgress(0);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      let fullText = '';
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
        fullText += pageText + '\n\n';
        setParseProgress(Math.round((pageNum / numPages) * 100));
      }

      if (!fullText.trim() || fullText.trim().length < 20) {
        setError('No readable text found. The PDF may be image-only or password-protected.');
        setStep('idle');
        return;
      }

      setRawText(fullText);
      const result = scrubPIIWithDetails(fullText);
      setScrubbedText(result.scrubbedText);
      setRedactionStats(result.stats);
      setStep('review');
    } catch {
      setError('Could not parse this PDF. Please ensure it is a valid, unencrypted file.');
      setStep('idle');
    }
  }, []);

  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('File too large. Maximum size is 20 MB.'); return; }
    parsePDF(file);
  }, [parsePDF]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const analyzeDocument = async () => {
    setStep('analyzing');
    setError(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch(getAnalyzeUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scrubbedText, mode: 'pdf', fileName }),
        signal: abortControllerRef.current.signal,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClauses(data.clauses || []);
      setStep('result');
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Ignore aborts
      setError('Analysis failed. Please try again.');
      setStep('review');
    }
  };

  const handleSave = async () => {
    try {
      await saveContract({
        title: fileName.replace('.pdf', '').replace(/_/g, ' ') || 'Uploaded Document',
        createdAt: new Date(),
        documentType: 'pdf',
        rawText,
        scrubbedText,
        clauses,
        overallRisk: clauses.some(c => c.riskLevel === 'RED') ? 'RED'
          : clauses.some(c => c.riskLevel === 'YELLOW') ? 'YELLOW' : 'GREEN',
      });
      setSaved(true);
      setTimeout(onSaved, 900);
    } catch { /* ignore */ }
  };

  const redClauses = clauses.filter(c => c.riskLevel === 'RED');
  const yellowClauses = clauses.filter(c => c.riskLevel === 'YELLOW');
  const greenClauses = clauses.filter(c => c.riskLevel === 'GREEN');

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#e5e3df] text-[#57534e] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-semibold text-[#1a1917]">Upload Document</h2>
      </div>

      <AnimatePresence mode="wait">
        {/* Idle — drop zone */}
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
                <p className="text-[#a8a29e] text-xs mt-1">or click to browse · max 20 MB</p>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
                <Shield className="w-3 h-3" />
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

        {/* Parsing */}
        {step === 'parsing' && (
          <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-5 py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#57534e]" />
            <div className="text-center">
              <p className="font-medium text-[#1a1917] text-sm">Reading PDF…</p>
              <p className="text-[#a8a29e] text-xs mt-1 max-w-[180px] truncate">{fileName}</p>
            </div>
            <div 
              className="w-40 h-1 bg-[#e5e3df] rounded-full overflow-hidden"
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

        {/* Review — PII scrub summary */}
        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Scrub summary */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4" role="status" aria-live="polite">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-emerald-700" />
                <span className="text-emerald-800 font-medium text-sm">Personal info removed</span>
              </div>
              {redactionStats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: 'Names', count: redactionStats.names },
                    { label: 'Amounts', count: redactionStats.currencies },
                    { label: 'Emails', count: redactionStats.emails },
                    { label: 'Phones', count: redactionStats.phones },
                    { label: 'IDs', count: redactionStats.identifiers },
                    { label: 'Addresses', count: redactionStats.addresses },
                  ].map(s => (
                    <div key={s.label} className="bg-white border border-emerald-100 rounded-lg p-2 text-center">
                      <div className="font-semibold text-[#1a1917]">{s.count}</div>
                      <div className="text-[#a8a29e]">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-emerald-700 text-xs mt-3">
                {redactionStats?.totalRedactions || 0} items redacted. Only anonymized text goes to AI.
              </p>
            </div>

            {/* Text preview */}
            <div className="bg-white border border-[#e5e3df] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e3df]">
                <span className="text-[#57534e] text-xs font-medium">Text preview</span>
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="flex items-center gap-1 text-xs text-[#a8a29e] hover:text-[#57534e] transition-colors"
                >
                  {showOriginal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showOriginal ? 'Scrubbed' : 'Original'}
                </button>
              </div>
              <div className="p-3 max-h-36 overflow-y-auto">
                <pre className="text-[#57534e] text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {(showOriginal ? rawText : scrubbedText).slice(0, 700)}
                  {rawText.length > 700 && '\n…'}
                </pre>
              </div>
            </div>

            {error && <p role="alert" className="text-red-600 text-xs">{error}</p>}

            <button
              id="btn-analyze-document"
              onClick={analyzeDocument}
              className="w-full py-3 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] text-white text-sm font-medium transition-colors"
            >
              Analyze with AI
            </button>
          </motion.div>
        )}

        {/* Analyzing */}
        {step === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5 py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#57534e]" />
            <div className="text-center">
              <p className="font-medium text-[#1a1917] text-sm">Analyzing clauses…</p>
              <p className="text-[#a8a29e] text-xs mt-1">Only scrubbed text is sent</p>
            </div>
          </motion.div>
        )}

        {/* Result */}
        {step === 'result' && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Summary row */}
            <div className="flex gap-2 text-xs">
              {[
                { count: redClauses.length, label: 'High risk', cls: 'bg-red-50 border-red-200 text-red-700' },
                { count: yellowClauses.length, label: 'Review', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                { count: greenClauses.length, label: 'Standard', cls: 'bg-green-50 border-green-200 text-green-700' },
              ].map(item => (
                <div key={item.label} className={`flex-1 text-center py-2 rounded-lg border font-medium ${item.cls}`}>
                  <div className="text-base font-semibold">{item.count}</div>
                  <div className="text-[10px] opacity-80">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Clause list */}
            <div className="space-y-2">
              {[...redClauses, ...yellowClauses, ...greenClauses].map((clause, i) => {
                const cfg = RISK_CONFIG[clause.riskLevel];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`border rounded-xl p-4 ${cfg.card}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {clause.category && (
                        <span className="text-[#a8a29e] text-[11px]">{clause.category}</span>
                      )}
                    </div>
                    <p className="text-[#1a1917] text-sm leading-relaxed line-clamp-3">{clause.text}</p>
                    <p className="text-[#57534e] text-xs mt-1.5 leading-relaxed">{clause.summary}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Save */}
            {!saved ? (
              <button
                id="btn-save-contract"
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#e5e3df] bg-white hover:bg-[#f2f1ee] text-[#1a1917] text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" /> Save to history
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                <CheckCircle className="w-4 h-4" /> Saved
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
