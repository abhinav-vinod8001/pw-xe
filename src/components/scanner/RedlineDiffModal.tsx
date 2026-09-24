'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, FileDown, Shield, MinusCircle, PlusCircle } from 'lucide-react';
import type { Clause } from '@/lib/constants';

interface RedlineDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  clauses: Clause[];
  documentTitle?: string;
}

export default function RedlineDiffModal({
  isOpen,
  onClose,
  clauses,
  documentTitle = 'Contract Agreement',
}: RedlineDiffModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const redClauses = clauses.filter(c => c.riskLevel === 'RED' && (c.counterProposal || c.negotiationTip));

  // Build a formal email amendment notice
  const buildAmendmentText = () => {
    let output = `Subject: Proposed Revisions to ${documentTitle}\n\n`;
    output += `Dear Team,\n\nThank you for sharing the draft for ${documentTitle}. Having reviewed the terms, I would like to propose a few standard amendments to align the agreement with customary market practices:\n\n`;

    redClauses.forEach((c, idx) => {
      output += `--------------------------------------------------\n`;
      output += `${idx + 1}. ${c.category || 'Contract Clause'}\n`;
      output += `CURRENT WORDING:\n"${c.text}"\n\n`;
      if (c.counterProposal) {
        output += `PROPOSED REVISION:\n"${c.counterProposal}"\n\n`;
      }
      if (c.negotiationTip) {
        output += `RATIONALE:\n${c.negotiationTip}\n\n`;
      }
    });

    output += `--------------------------------------------------\n`;
    output += `Please let me know if these adjustments work for you so we can finalize the agreement.\n\nBest regards,\n`;
    return output;
  };

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(buildAmendmentText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Redline Diff and Counter-Contract View"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-[#e5e3df] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#e5e3df] flex items-center justify-between bg-[#fcfbf9]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#1a1917]">Redline Counter-Contract</h3>
              <p className="text-xs text-[#78716c]">Visual diff & formal amendment draft</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#e5e3df] text-[#57534e] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
            <strong>Redline Summary:</strong> Identified <strong>{redClauses.length}</strong> predatory or uncapped clauses. Below is the proposed redline striking out hazardous terms and substituting fair, balanced provisions.
          </div>

          {redClauses.length === 0 ? (
            <div className="text-center py-10 text-[#78716c] text-sm">
              No high-risk clauses requiring redline revisions were found in this document.
            </div>
          ) : (
            <div className="space-y-4">
              {redClauses.map((c, i) => (
                <div key={i} className="border border-[#e5e3df] rounded-2xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1a1917] tracking-tight">
                      {i + 1}. {c.category || 'Clause'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">
                      RED RISK
                    </span>
                  </div>

                  {/* Original Strikethrough */}
                  <div className="bg-red-50/50 border border-red-200/70 rounded-xl p-3 text-xs">
                    <div className="flex items-center gap-1.5 text-red-700 font-semibold mb-1">
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>Original Unfavorable Text (Strike Out):</span>
                    </div>
                    <p className="line-through text-red-900/80 leading-relaxed">
                      {c.text}
                    </p>
                  </div>

                  {/* Proposed Safe Revision */}
                  {c.counterProposal && (
                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-semibold mb-1">
                        <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Proposed Safe Revision (Insert):</span>
                      </div>
                      <p className="text-emerald-950 font-medium leading-relaxed font-mono">
                        {c.counterProposal}
                      </p>
                    </div>
                  )}

                  {/* Rationale */}
                  {c.negotiationTip && (
                    <p className="text-[11px] text-[#78716c] italic px-1">
                      💡 <strong>Negotiation Script:</strong> &ldquo;{c.negotiationTip}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#e5e3df] bg-[#fcfbf9] flex flex-col sm:flex-row gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#e5e3df] text-[#57534e] hover:bg-white text-xs font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCopyNotice}
            disabled={redClauses.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a1917] hover:bg-[#2a2926] text-white text-xs font-medium transition-colors shadow-md disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span>Copied Formal Amendment Notice!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Formal Amendment Email Draft</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
