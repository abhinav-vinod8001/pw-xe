'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, X, Loader2, Shield, AlertTriangle, CheckCircle,
  Zap, Save, FlipHorizontal
} from 'lucide-react';
import { scrubPIIWithDetails } from '@/lib/scrubPII';
import { saveContract } from '@/lib/db';
import { RISK_CONFIG, type RiskLevel } from '@/lib/constants';
import { getAnalyzeUrl } from '@/lib/api';

interface BBox { x0: number; y0: number; x1: number; y1: number; }

interface ScannedClause {
  text: string;
  riskLevel: RiskLevel;
  summary: string;
  bbox?: BBox;
}

interface ScannerARProps { onClose: () => void; }



export default function ScannerAR({ onClose }: ScannerARProps) {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanning, setScanning] = useState(false);
  const [clauses, setClauses] = useState<ScannedClause[]>([]);
  const [selected, setSelected] = useState<ScannedClause | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [ocrProgress, setOcrProgress] = useState(0);
  const [rawText, setRawText] = useState('');
  const [scrubbedText, setScrubbedText] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [videoDevices, setVideoDevices] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: r.width, h: r.height });
      }
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      obs.disconnect();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const captureAndScan = useCallback(async () => {
    if (!webcamRef.current) return;
    setScanning(true);
    setError(null);
    setClauses([]);
    setOcrProgress(0);

    // Capture at native resolution for maximum OCR quality
    const img = webcamRef.current.getScreenshot();
    if (!img) {
      setError('Could not capture image. Grant camera permissions and try again.');
      setScanning(false);
      return;
    }

    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(img, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const extracted = data.text.trim();
      if (!extracted || extracted.length < 20) {
        setError('No readable text detected. Hold the camera steady over the document with good lighting.');
        setScanning(false);
        return;
      }

      setRawText(extracted);
      const { scrubbedText: scrubbed } = scrubPIIWithDetails(extracted);
      setScrubbedText(scrubbed);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const res = await fetch(getAnalyzeUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scrubbed, mode: 'scan' }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const result = await res.json();
      const apiClauses: ScannedClause[] = result.clauses || [];

      interface TessLine { text: string; bbox: BBox; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lines: TessLine[] = ((data as any).lines as TessLine[]) || [];

      const mapped = apiClauses.map((clause, i) => {
        const match = lines.find((l: TessLine) =>
          clause.text && l.text && l.text.toLowerCase().includes(clause.text.slice(0, 20).toLowerCase())
        );
        const fallback = lines[i % Math.max(lines.length, 1)];
        const bbox: BBox = match?.bbox || fallback?.bbox || {
          x0: 50 + (i % 2) * 200, y0: 80 + i * 70,
          x1: 300 + (i % 2) * 200, y1: 140 + i * 70,
        };
        return { ...clause, bbox };
      });

      setClauses(mapped);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Scan error:', err);
      setError(err.message || 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleSave = async () => {
    if (!rawText) return;
    try {
      await saveContract({
        title: `Scan — ${new Date().toLocaleString()}`,
        createdAt: new Date(),
        documentType: 'scan',
        rawText,
        scrubbedText,
        clauses: clauses.map(c => ({ text: c.text, riskLevel: c.riskLevel, summary: c.summary })),
        overallRisk: clauses.some(c => c.riskLevel === 'RED') ? 'RED'
          : clauses.some(c => c.riskLevel === 'YELLOW') ? 'YELLOW' : 'GREEN',
      });
      setSaved(true);
    } catch { /* ignore */ }
  };

  // Dynamic AR scaling based on actual video stream dimensions
  const videoEl = webcamRef.current?.video;
  const nativeW = videoEl?.videoWidth || 1280;
  const nativeH = videoEl?.videoHeight || 720;

  // object-cover math: compute rendered size and crop offsets for AR alignment
  const containerAspect = containerSize.w / (containerSize.h || 1);
  const videoAspect = nativeW / (nativeH || 1);
  let renderW: number, renderH: number, offsetX: number, offsetY: number;

  if (videoAspect > containerAspect) {
    renderH = containerSize.h;
    renderW = containerSize.h * videoAspect;
    offsetX = (renderW - containerSize.w) / 2;
    offsetY = 0;
  } else {
    renderW = containerSize.w;
    renderH = containerSize.w / videoAspect;
    offsetX = 0;
    offsetY = (renderH - containerSize.h) / 2;
  }

  const sx = (x: number) => (x / nativeW) * renderW - offsetX;
  const sy = (y: number) => (y / nativeH) * renderH - offsetY;

  // Request high resolution to force the main camera (not ultrawide)
  const videoConstraints: MediaTrackConstraints = {
    facingMode,
    width: { ideal: 3840, min: 1280 },
    height: { ideal: 2160, min: 720 },
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Camera header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-4 h-4 opacity-80" />
          <span className="text-sm font-medium">Scan Document</span>
        </div>
        <div className="flex items-center gap-2">
          {clauses.length > 0 && !saved && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#1a1917] text-xs font-medium rounded-full transition-colors hover:bg-gray-100"
            >
              <Save className="w-3 h-3" /> Save
            </button>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              <CheckCircle className="w-3 h-3" /> Saved
            </span>
          )}
          {videoDevices > 1 && (
            <button
              onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera feed */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-black">
        {hasCamera ? (
          <Webcam
            key={facingMode}
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            videoConstraints={videoConstraints}
            onUserMedia={() => {
              setHasCamera(true);
              navigator.mediaDevices.enumerateDevices().then((devices) => {
                const videoInputs = devices.filter((device) => device.kind === 'videoinput');
                setVideoDevices(videoInputs.length);
              }).catch(() => { /* ignore */ });
            }}
            onUserMediaError={() => setHasCamera(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1917] text-[#57534e]">
            <Camera className="w-10 h-10 opacity-30" />
            <p role="alert" className="text-sm text-center text-[#a8a29e] px-8">Camera unavailable. It may be in use by another app, lacking permissions, or disconnected.</p>
          </div>
        )}

        {/* AR overlays */}
        {clauses.map((clause, i) => {
          if (!clause.bbox) return null;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`absolute border-2 rounded cursor-pointer ${RISK_CONFIG[clause.riskLevel].overlay}`}
              style={{
                left: sx(clause.bbox.x0),
                top: sy(clause.bbox.y0),
                width: Math.max(sx(clause.bbox.x1) - sx(clause.bbox.x0), 80),
                height: Math.max(sy(clause.bbox.y1) - sy(clause.bbox.y0), 22),
              }}
              onClick={() => setSelected(clause)}
            />
          );
        })}

        {/* Scan guide frame */}
        {!scanning && clauses.length === 0 && hasCamera && (
          <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40 text-xs text-center">
              Align document within frame
            </span>
          </div>
        )}

        {/* OCR progress */}
        <AnimatePresence>
          {scanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-4"
            >
              <Loader2 className="w-7 h-7 animate-spin text-white" />
              <div className="text-center">
                <p className="text-white text-sm font-medium">
                  {ocrProgress < 100 ? `Reading text… ${ocrProgress}%` : 'Analyzing…'}
                </p>
                <p className="text-white/50 text-xs mt-1 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" /> PII scrubbing active
                </p>
              </div>
              <div 
                className="w-36 h-1 bg-white/20 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={ocrProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <motion.div className="h-full bg-white rounded-full" animate={{ width: `${ocrProgress}%` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-10 pt-4">
        {error && (
          <p role="alert" className="mb-3 text-center text-xs text-white/70 bg-white/10 rounded-xl px-3 py-2">{error}</p>
        )}
        <button
          id="btn-capture-scan"
          onClick={captureAndScan}
          disabled={scanning || !hasCamera}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white hover:bg-gray-100 disabled:opacity-40 text-[#1a1917] font-semibold text-sm transition-all active:scale-[0.98]"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {scanning ? 'Analyzing…' : clauses.length > 0 ? 'Scan again' : 'Capture & analyze'}
        </button>
      </div>

      {/* Clause detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-60 bg-white rounded-t-2xl p-5 pb-10 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${RISK_CONFIG[selected.riskLevel].badge}`}>
                {RISK_CONFIG[selected.riskLevel].icon}
                {RISK_CONFIG[selected.riskLevel].label}
              </span>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-[#f2f1ee] text-[#57534e]" aria-label="Close clause detail">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#1a1917] text-sm font-medium leading-relaxed mb-2">{selected.text}</p>
            <p className="text-[#57534e] text-xs leading-relaxed">{selected.summary}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
