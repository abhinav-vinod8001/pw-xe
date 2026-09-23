'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Camera, FileText, Clock, Shield, ChevronRight, AlertTriangle } from 'lucide-react';
import ZeroKnowledgePill from '@/components/ZeroKnowledgePill';
import { getAllContracts } from '@/lib/db';
import type { Contract } from '@/lib/db';

const ScannerAR = dynamic(() => import('@/components/ScannerAR'), { ssr: false });
const DocumentUpload = dynamic(() => import('@/components/DocumentUpload'), { ssr: false });
const HistoryBriefs = dynamic(() => import('@/components/HistoryBriefs'), { ssr: false });

type ActiveView = 'dashboard' | 'scanner' | 'upload' | 'history';

export default function HomePage() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [contracts, setContracts] = useState<Contract[]>([]);

  const refreshStats = useCallback(() => {
    getAllContracts().then(setContracts).catch(console.error);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const redCount = contracts.filter(c => c.overallRisk === 'RED').length;
  const totalCount = contracts.length;

  if (activeView === 'scanner') {
    return (
      <ScannerAR
        onClose={() => { setActiveView('dashboard'); refreshStats(); }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f8f7f4]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f8f7f4] border-b border-[#e5e3df]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1a1917] flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-[#1a1917] tracking-tight">LexAR</span>
          </div>
          <ZeroKnowledgePill />
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 w-full flex-1">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10 items-start h-full pt-8">
          
          {/* Left Column (Navigation / Dashboard) */}
          <div className={`col-span-5 xl:col-span-4 ${activeView !== 'dashboard' ? 'hidden lg:block' : 'block'}`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {/* Hero */}
              <div className="pb-6">
                <h1 className="text-2xl lg:text-3xl font-semibold text-[#1a1917] leading-snug tracking-tight">
                  Analyze legal documents.<br />
                  <span className="text-[#57534e] font-normal">Nothing leaves your device.</span>
                </h1>
              </div>

              {/* Saved docs strip */}
              {totalCount > 0 && (
                <button
                  onClick={() => setActiveView('history')}
                  className="w-full flex items-center justify-between mb-5 px-4 py-3 bg-white border border-[#e5e3df] rounded-xl text-sm hover:border-[#ccc9c3] transition-colors"
                >
                  <span className="flex items-center gap-2 text-[#57534e]">
                    <Clock className="w-4 h-4" />
                    {totalCount} document{totalCount !== 1 ? 's' : ''} saved
                    {redCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {redCount} high-risk
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#a8a29e]" />
                </button>
              )}

              {/* Action Cards */}
              <nav aria-label="Main Navigation" className="space-y-3">
                {/* Scan */}
                <button
                  id="btn-open-scanner"
                  onClick={() => setActiveView('scanner')}
                  className="w-full group text-left bg-[#1a1917] text-white rounded-2xl p-5 hover:bg-[#2a2926] transition-colors active:scale-[0.99]"
                  aria-label="Open AR legal document scanner"
                >
                  <div className="flex items-start justify-between">
                    <Camera className="w-5 h-5 text-white/70" />
                    <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Camera</span>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold text-base">Quick Scan</p>
                    <p className="text-sm text-white/60 mt-0.5">Point at any contract. Risk levels appear as overlays.</p>
                  </div>
                </button>

                {/* Upload */}
                <button
                  id="btn-open-upload"
                  onClick={() => setActiveView('upload')}
                  aria-current={activeView === 'upload' ? 'page' : undefined}
                  className={`w-full group text-left rounded-2xl p-5 border transition-colors active:scale-[0.99] ${
                    activeView === 'upload' 
                      ? 'bg-[#e5e3df] border-[#ccc9c3]' 
                      : 'bg-white border-[#e5e3df] hover:border-[#ccc9c3] hover:bg-[#fafaf9]'
                  }`}
                  aria-label="Upload and analyze a PDF document"
                >
                  <div className="flex items-start justify-between">
                    <FileText className={`w-5 h-5 ${activeView === 'upload' ? 'text-[#1a1917]' : 'text-[#57534e]'}`} />
                    <span className="text-xs text-[#a8a29e] font-medium uppercase tracking-wider">PDF</span>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold text-base text-[#1a1917]">Upload Document</p>
                    <p className="text-sm text-[#57534e] mt-0.5">Parsed locally. AI reviews scrubbed text only.</p>
                  </div>
                </button>

                {/* History */}
                <button
                  id="btn-open-history"
                  onClick={() => { setActiveView('history'); refreshStats(); }}
                  aria-current={activeView === 'history' ? 'page' : undefined}
                  className={`w-full group text-left rounded-2xl p-5 border transition-colors active:scale-[0.99] ${
                    activeView === 'history' 
                      ? 'bg-[#e5e3df] border-[#ccc9c3]' 
                      : 'bg-white border-[#e5e3df] hover:border-[#ccc9c3] hover:bg-[#fafaf9]'
                  }`}
                  aria-label="View saved documents and consultation briefs"
                >
                  <div className="flex items-start justify-between">
                    <Clock className={`w-5 h-5 ${activeView === 'history' ? 'text-[#1a1917]' : 'text-[#57534e]'}`} />
                    <span className="text-xs text-[#a8a29e] font-medium uppercase tracking-wider">
                      {totalCount > 0 ? `${totalCount} saved` : 'Empty'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold text-base text-[#1a1917]">History & Briefs</p>
                    <p className="text-sm text-[#57534e] mt-0.5">Review past analyses. Export consultation briefs.</p>
                  </div>
                </button>
              </nav>

              {/* Footer note */}
              <p className="mt-8 text-xs text-[#a8a29e] leading-relaxed max-w-sm">
                Documents are parsed and stored in your browser's local storage. Only anonymized text is sent to the AI model for analysis.
              </p>
            </motion.div>
          </div>

          {/* Right Column (Active Content) */}
          <div 
            className={`col-span-7 xl:col-span-8 ${activeView === 'dashboard' ? 'hidden lg:flex' : 'block'}`}
            aria-live="polite"
            role="main"
          >
            <AnimatePresence mode="wait">
              {activeView === 'dashboard' && (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-[600px] border-2 border-dashed border-[#e5e3df] rounded-3xl flex flex-col items-center justify-center text-center px-6"
                >
                  <Shield className="w-16 h-16 text-[#ccc9c3] mb-4" />
                  <h3 className="text-lg font-medium text-[#1a1917]">Ready to analyze</h3>
                  <p className="text-[#a8a29e] mt-1 text-sm max-w-sm">
                    Select a tool from the menu to upload a document or scan a contract in real-time.
                  </p>
                </motion.div>
              )}

              {activeView === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="w-full bg-white border border-[#e5e3df] rounded-3xl p-6 lg:p-8 shadow-sm min-h-[600px]"
                >
                  <DocumentUpload
                    onClose={() => setActiveView('dashboard')}
                    onSaved={() => { setActiveView('dashboard'); refreshStats(); }}
                  />
                </motion.div>
              )}

              {activeView === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                  className="w-full bg-white border border-[#e5e3df] rounded-3xl p-6 lg:p-8 shadow-sm min-h-[600px]"
                >
                  <HistoryBriefs
                    onClose={() => { setActiveView('dashboard'); refreshStats(); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </main>
    </div>
  );
}
