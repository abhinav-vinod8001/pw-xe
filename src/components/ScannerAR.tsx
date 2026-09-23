'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, X, Loader2, Shield, CheckCircle,
  Save, FlipHorizontal, AlertTriangle
} from 'lucide-react';
import { scrubPIIWithDetails } from '@/lib/scrubPII';
import { saveContract } from '@/lib/db';
import { RISK_CONFIG, type Clause } from '@/lib/constants';
import { getAnalyzeUrl } from '@/lib/api';

interface ScannerARProps { onClose: () => void; }

type ScannerStep = 'camera' | 'analyzing' | 'result';

export default function ScannerAR({ onClose }: ScannerARProps) {
  const webcamRef = useRef<Webcam>(null);
  const [step, setStep] = useState<ScannerStep>('camera');
  
  // Camera State
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasCamera, setHasCamera] = useState(true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>();
  
  // OCR & Analysis State
  const [ocrProgress, setOcrProgress] = useState(0);
  const [rawText, setRawText] = useState('');
  const [scrubbedText, setScrubbedText] = useState('');
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Get all video devices to allow switching if ultrawide is selected
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const vids = devices.filter((device) => device.kind === 'videoinput');
      setVideoDevices(vids);
    }).catch(() => { /* ignore */ });
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [onClose]);

  const cycleCamera = () => {
    if (videoDevices.length <= 1) {
      setFacingMode(f => f === 'environment' ? 'user' : 'environment');
      return;
    }
    
    const currentIndex = videoDevices.findIndex(d => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setActiveDeviceId(videoDevices[nextIndex].deviceId);
    
    // Also toggle facing mode as fallback
    setFacingMode(f => f === 'environment' ? 'user' : 'environment');
  };

  const captureAndScan = useCallback(async () => {
    if (!webcamRef.current) return;
    setStep('analyzing');
    setError(null);
    setClauses([]);
    setOcrProgress(0);

    // Capture at high resolution
    const img = webcamRef.current.getScreenshot();
    if (!img) {
      setError('Could not capture image. Grant camera permissions and try again.');
      setStep('camera');
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
        throw new Error('No readable text detected. Hold the camera steady over the document with good lighting.');
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
      setClauses(result.clauses || []);
      setStep('result');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Scan error:', err);
      setError(err.message || 'Scan failed. Please try again.');
      setStep('camera');
    }
  }, []);

  const handleSave = async () => {
    if (!rawText || clauses.length === 0) return;
    try {
      await saveContract({
        title: `Scan — ${new Date().toLocaleString()}`,
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
  };

  const redClauses = clauses.filter(c => c.riskLevel === 'RED');
  const yellowClauses = clauses.filter(c => c.riskLevel === 'YELLOW');
  const greenClauses = clauses.filter(c => c.riskLevel === 'GREEN');

  // Video constraints
  const videoConstraints: MediaTrackConstraints = activeDeviceId 
    ? { deviceId: { exact: activeDeviceId }, width: { ideal: 3840 }, height: { ideal: 2160 } }
    : { facingMode, width: { ideal: 3840 }, height: { ideal: 2160 } };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f7f4] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#f8f7f4] border-b border-[#e5e3df]">
        <div className="flex items-center gap-2 text-[#1a1917]">
          <Camera className="w-4 h-4 opacity-80" />
          <span className="text-sm font-medium">Scan Document</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-[#e5e3df] text-[#1a1917] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full p-4 flex flex-col">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'camera' && (
            <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <div className="relative flex-1 rounded-2xl overflow-hidden bg-black shadow-inner min-h-[50vh]">
                {hasCamera ? (
                  <Webcam
                    key={activeDeviceId || facingMode}
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.95}
                    videoConstraints={videoConstraints}
                    onUserMedia={() => setHasCamera(true)}
                    onUserMediaError={() => setHasCamera(false)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1917] text-[#57534e]">
                    <Camera className="w-10 h-10 opacity-30" />
                    <p role="alert" className="text-sm text-center text-[#a8a29e] px-8">Camera unavailable.</p>
                  </div>
                )}

                {/* Camera controls overlay */}
                <div className="absolute top-4 right-4 z-10">
                  {videoDevices.length > 1 && (
                    <button
                      onClick={cycleCamera}
                      className="p-3 rounded-full bg-black/40 backdrop-blur hover:bg-black/60 text-white transition-colors"
                      title="Switch Camera Lens"
                    >
                      <FlipHorizontal className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                <div className="absolute inset-8 border-2 border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
                   <span className="bg-black/50 backdrop-blur px-3 py-1 rounded-full text-white/80 text-xs">Align document in frame</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  id="btn-capture-scan"
                  onClick={captureAndScan}
                  disabled={!hasCamera}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] disabled:opacity-40 text-white font-medium text-sm transition-colors shadow-lg"
                >
                  <Camera className="w-5 h-5" />
                  Capture Photo
                </button>
              </div>
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center gap-6 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#57534e]" />
              <div className="text-center">
                <p className="font-medium text-[#1a1917] text-base">
                  {ocrProgress < 100 ? `Reading text… ${ocrProgress}%` : 'Analyzing clauses with AI…'}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-2 text-[#57534e] text-xs">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PII scrubbing active.</span>
                </div>
              </div>
              <div className="w-48 h-1.5 bg-[#e5e3df] rounded-full overflow-hidden">
                <motion.div className="h-full bg-[#1a1917] rounded-full" animate={{ width: `${ocrProgress}%` }} transition={{ type: 'spring' }} />
              </div>
            </motion.div>
          )}

          {step === 'result' && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1a1917]">Scan Results</h2>
                <button onClick={() => { setStep('camera'); setSaved(false); }} className="text-sm font-medium text-[#57534e] hover:text-[#1a1917]">
                  Scan another
                </button>
              </div>

              <div className="flex gap-3 text-xs">
                {[
                  { count: redClauses.length, label: 'High risk', cls: 'bg-red-50 border-red-200 text-red-700' },
                  { count: yellowClauses.length, label: 'Review', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { count: greenClauses.length, label: 'Standard', cls: 'bg-green-50 border-green-200 text-green-700' },
                ].map(item => (
                  <div key={item.label} className={`flex-1 text-center py-3 rounded-xl border font-medium ${item.cls}`}>
                    <div className="text-lg font-semibold">{item.count}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {clauses.map((clause, i) => {
                  const cfg = RISK_CONFIG[clause.riskLevel];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`border rounded-2xl p-4 bg-white ${cfg.card}`}
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badge}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {clause.category && (
                          <span className="text-[#a8a29e] text-xs">{clause.category}</span>
                        )}
                      </div>
                      <p className="text-[#1a1917] text-sm leading-relaxed">{clause.text}</p>
                      <div className="mt-3 pt-3 border-t border-[#e5e3df]">
                        <p className="text-[#57534e] text-sm leading-relaxed">{clause.summary}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="pt-4">
                {!saved ? (
                  <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] text-white text-sm font-medium transition-colors shadow-md">
                    <Save className="w-4 h-4" /> Save to history
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-4 rounded-xl bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                    <CheckCircle className="w-5 h-5" /> Saved successfully
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
