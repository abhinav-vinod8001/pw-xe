'use client';

import { motion } from 'framer-motion';
import { Save, CheckCircle, AlertTriangle, FileText, ArrowLeft, RotateCcw } from 'lucide-react';
import { RISK_CONFIG, type Clause } from '@/lib/constants';

interface RiskResultsProps {
  clauses: Clause[];
  summary?: string | null;
  saved: boolean;
  onSave: () => void;
  onScanAnother: () => void;
  onBackToReview?: () => void;
}

/**
 * Risk Results View
 * 
 * Displays the AI-analyzed clauses grouped by risk level with:
 * - Executive summary highlighting overall risk posture
 * - A summary bar showing counts per risk level
 * - Individual clause cards with risk badges and explanations
 * - Informative empty state if no clauses were detected
 * - "Save to history" button for local persistence
 */
export default function RiskResults({ 
  clauses, 
  summary,
  saved, 
  onSave, 
  onScanAnother,
  onBackToReview,
}: RiskResultsProps) {
  const redClauses = clauses.filter(c => c.riskLevel === 'RED');
  const yellowClauses = clauses.filter(c => c.riskLevel === 'YELLOW');
  const greenClauses = clauses.filter(c => c.riskLevel === 'GREEN');

  const hasHighRisk = redClauses.length > 0;

  return (
    <motion.div 
      key="result" 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-6 pb-12"
      role="region"
      aria-label="Document analysis results"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a1917]">Scan Results</h2>
        <div className="flex items-center gap-2">
          {onBackToReview && (
            <button
              onClick={onBackToReview}
              className="text-xs font-medium text-[#57534e] hover:text-[#1a1917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917] rounded px-2.5 py-1.5 border border-[#e5e3df] bg-white hover:bg-[#f8f7f4] flex items-center gap-1 transition-colors"
              aria-label="View or edit extracted text"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Review text</span>
            </button>
          )}
          <button 
            onClick={onScanAnother} 
            className="text-xs font-medium text-[#57534e] hover:text-[#1a1917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917] rounded px-2.5 py-1.5 border border-[#e5e3df] bg-white hover:bg-[#f8f7f4] flex items-center gap-1 transition-colors"
            aria-label="Scan another document"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Scan another</span>
          </button>
        </div>
      </div>

      {/* Executive Summary Card */}
      {summary && (
        <div 
          className={`p-4 rounded-2xl border text-sm leading-relaxed ${
            hasHighRisk 
              ? 'bg-red-50/80 border-red-200 text-red-900' 
              : 'bg-white border-[#e5e3df] text-[#1a1917]'
          }`}
          role="region"
          aria-label="Executive summary"
        >
          <div className="flex items-center gap-2 font-medium mb-1 text-xs uppercase tracking-wider">
            {hasHighRisk ? (
              <span className="text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> High Risk Alert
              </span>
            ) : (
              <span className="text-[#78716c] flex items-center gap-1">
                <FileText className="w-4 h-4" /> Document Summary
              </span>
            )}
          </div>
          <p>{summary}</p>
        </div>
      )}

      {/* Risk Summary Bar */}
      <div className="flex gap-3 text-xs" role="list" aria-label="Risk level summary">
        {[
          { count: redClauses.length, label: 'High risk', cls: 'bg-red-50 border-red-200 text-red-700' },
          { count: yellowClauses.length, label: 'Review', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
          { count: greenClauses.length, label: 'Standard', cls: 'bg-green-50 border-green-200 text-green-700' },
        ].map(item => (
          <div 
            key={item.label} 
            className={`flex-1 text-center py-3 rounded-xl border font-medium ${item.cls}`}
            role="listitem"
            aria-label={`${item.count} ${item.label} clauses`}
          >
            <div className="text-lg font-semibold">{item.count}</div>
            <div className="text-[11px] opacity-80 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Empty State if no clauses were detected */}
      {clauses.length === 0 && (
        <div className="bg-white border border-[#e5e3df] rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1a1917] text-base">No Standard Clauses Identified</h3>
            <p className="text-sm text-[#57534e] mt-1 max-w-md mx-auto">
              The AI was unable to match recognizable contract clauses. This usually happens if the photo was blurry, angled, or had uneven lighting.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {onBackToReview && (
              <button
                onClick={onBackToReview}
                className="px-4 py-2.5 rounded-xl border border-[#e5e3df] text-[#1a1917] text-xs font-medium hover:bg-[#f8f7f4] transition-colors"
              >
                Review or Edit Scanned Text
              </button>
            )}
            <button
              onClick={onScanAnother}
              className="px-4 py-2.5 rounded-xl bg-[#1a1917] text-white text-xs font-medium hover:bg-[#2a2926] transition-colors"
            >
              Take Clearer Photo
            </button>
          </div>
        </div>
      )}

      {/* Clause Cards */}
      {clauses.length > 0 && (
        <div className="space-y-3" role="list" aria-label="Analyzed clauses">
          {clauses.map((clause, i) => {
            const cfg = RISK_CONFIG[clause.riskLevel];
            return (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`border rounded-2xl p-4 bg-white ${cfg.card}`}
                role="listitem"
                aria-label={`${cfg.label} clause: ${clause.category || 'General'}`}
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
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Save Button */}
      {clauses.length > 0 && (
        <div className="pt-4">
          {!saved ? (
            <button 
              id="btn-save-scan"
              onClick={onSave} 
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] text-white text-sm font-medium transition-colors shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917]"
              aria-label="Save this analysis to your local history"
            >
              <Save className="w-4 h-4" aria-hidden="true" /> Save to history
            </button>
          ) : (
            <div 
              className="flex items-center justify-center gap-2 py-4 rounded-xl bg-green-50 text-green-700 text-sm font-medium border border-green-200"
              role="status"
              aria-label="Analysis saved successfully"
            >
              <CheckCircle className="w-5 h-5" aria-hidden="true" /> Saved successfully
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
