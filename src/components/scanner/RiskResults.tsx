'use client';

import { motion } from 'framer-motion';
import { Save, CheckCircle } from 'lucide-react';
import { RISK_CONFIG, type Clause } from '@/lib/constants';

interface RiskResultsProps {
  clauses: Clause[];
  saved: boolean;
  onSave: () => void;
  onScanAnother: () => void;
}

/**
 * Risk Results View
 * 
 * Displays the AI-analyzed clauses grouped by risk level with:
 * - A summary bar showing counts per risk level
 * - Individual clause cards with risk badges and explanations
 * - A "Save to history" button for local persistence
 */
export default function RiskResults({ clauses, saved, onSave, onScanAnother }: RiskResultsProps) {
  const redClauses = clauses.filter(c => c.riskLevel === 'RED');
  const yellowClauses = clauses.filter(c => c.riskLevel === 'YELLOW');
  const greenClauses = clauses.filter(c => c.riskLevel === 'GREEN');

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
        <button 
          onClick={onScanAnother} 
          className="text-sm font-medium text-[#57534e] hover:text-[#1a1917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917] rounded px-2 py-1"
          aria-label="Scan another document"
        >
          Scan another
        </button>
      </div>

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

      {/* Clause Cards */}
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

      {/* Save Button */}
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
    </motion.div>
  );
}
