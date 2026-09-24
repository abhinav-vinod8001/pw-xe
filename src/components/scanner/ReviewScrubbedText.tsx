'use client';

import { motion } from 'framer-motion';
import { Shield, ArrowRight } from 'lucide-react';
import type { ScrubbingStats } from '@/lib/scrubPII';

interface ReviewScrubbedTextProps {
  scrubbedText: string;
  stats: ScrubbingStats;
  onAnalyze: () => void;
}

/**
 * Review Scrubbed Text Step
 * 
 * Trust-building UI that shows the user exactly what PII was removed
 * before any data leaves the device. Features:
 * - A green trust banner with a breakdown of redaction categories
 * - The scrubbed text with [REDACTED] tokens highlighted in high-contrast blocks
 * - A confirmation button to proceed to AI analysis
 */
export default function ReviewScrubbedText({ scrubbedText, stats, onAnalyze }: ReviewScrubbedTextProps) {
  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col py-4 max-h-full"
      role="region"
      aria-label="Review redacted document"
    >
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#1a1917] mb-1">Verify Secured Text</h2>
        <p className="text-sm text-[#57534e]">Review the scrubbed document before it leaves your device.</p>
      </div>

      {/* Trust Summary Card */}
      <div 
        className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm"
        role="status"
        aria-label="Privacy protection summary"
      >
        <div className="flex items-center gap-2 text-emerald-800 font-medium">
          <Shield className="w-5 h-5 text-emerald-600" aria-hidden="true" />
          <span>Zero-Knowledge Protection Active</span>
        </div>
        {stats.totalRedactions > 0 ? (
          <p className="text-sm text-emerald-700">
            Removed <strong>{stats.totalRedactions}</strong> sensitive item{stats.totalRedactions !== 1 ? 's' : ''} (
            {buildStatsSummary(stats)}).
          </p>
        ) : (
          <p className="text-sm text-emerald-700">No sensitive PII patterns detected in the text.</p>
        )}
      </div>

      {/* Scrubbed Text Display */}
      <div 
        className="flex-1 bg-white border border-[#e5e3df] rounded-2xl p-4 overflow-y-auto mb-6 shadow-inner text-sm leading-relaxed text-[#1a1917] whitespace-pre-wrap font-mono min-h-[30vh]"
        role="document"
        aria-label="Redacted document text"
        tabIndex={0}
      >
        {renderScrubbedText(scrubbedText)}
      </div>

      <button
        id="btn-analyze-secure"
        onClick={onAnalyze}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] text-white font-medium text-base transition-colors shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917]"
        aria-label="Proceed to analyze the secured text with AI"
      >
        Analyze Secure Text <ArrowRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

/** Render text with highlighted [REDACTED] blocks */
function renderScrubbedText(text: string) {
  const parts = text.split(/(\[REDACTED\])/g);
  return parts.map((part, i) => {
    if (part === '[REDACTED]') {
      return (
        <span 
          key={i} 
          className="inline-block bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded mx-0.5 tracking-wider align-middle select-none"
          role="img"
          aria-label="Redacted personal information"
        >
          REDACTED
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Build a human-readable summary of what was scrubbed */
function buildStatsSummary(stats: ScrubbingStats): string {
  return [
    stats.names > 0 && `${stats.names} name${stats.names !== 1 ? 's' : ''}`,
    stats.currencies > 0 && `${stats.currencies} currenc${stats.currencies !== 1 ? 'ies' : 'y'}`,
    stats.emails > 0 && `${stats.emails} email${stats.emails !== 1 ? 's' : ''}`,
    stats.phones > 0 && `${stats.phones} phone${stats.phones !== 1 ? 's' : ''}`,
    stats.identifiers > 0 && `${stats.identifiers} ID${stats.identifiers !== 1 ? 's' : ''}`,
    stats.addresses > 0 && `${stats.addresses} address${stats.addresses !== 1 ? 'es' : ''}`,
  ].filter(Boolean).join(', ');
}
