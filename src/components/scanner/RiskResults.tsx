'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Save, CheckCircle, AlertTriangle, FileText, ArrowLeft,
  RotateCcw, Sparkles, Copy, Check, MessageSquare, FileEdit, Languages
} from 'lucide-react';
import { RISK_CONFIG, type Clause } from '@/lib/constants';
import { SUPPORTED_LANGUAGES, LEGAL_TRANSLATIONS, type SupportedLanguage } from '@/lib/translations';

// New Advanced Modules
import FairnessGauge from './FairnessGauge';
import AskLexARChat from './AskLexARChat';
import RedlineDiffModal from './RedlineDiffModal';

interface RiskResultsProps {
  clauses: Clause[];
  summary?: string | null;
  saved: boolean;
  onSave: () => void;
  onScanAnother: () => void;
  onBackToReview?: () => void;
  scrubbedText?: string;
  documentTitle?: string;
}

export default function RiskResults({ 
  clauses, 
  summary,
  saved, 
  onSave, 
  onScanAnother,
  onBackToReview,
  scrubbedText = '',
  documentTitle = 'Contract Document',
}: RiskResultsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRedlineOpen, setIsRedlineOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<SupportedLanguage>('en');

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(prev => (prev === id ? null : prev));
    }, 2000);
  }, []);

  const redClauses = clauses.filter(c => c.riskLevel === 'RED');
  const yellowClauses = clauses.filter(c => c.riskLevel === 'YELLOW');
  const greenClauses = clauses.filter(c => c.riskLevel === 'GREEN');
  const hasHighRisk = redClauses.length > 0;

  // Translation helper
  const getTranslatedSummary = (clause: Clause) => {
    if (activeLang === 'en') return clause.summary;

    const lower = `${clause.category || ''} ${clause.text || ''}`.toLowerCase();
    let key = '';
    if (lower.includes('liab') || lower.includes('indemn')) key = 'unlimited_liability';
    else if (lower.includes('patent') || lower.includes('intellect') || lower.includes('invent')) key = 'ip_assignment';
    else if (lower.includes('compete') || lower.includes('restraint')) key = 'non_compete';
    else if (lower.includes('terminat')) key = 'unilateral_termination';
    else if (lower.includes('arbitrat') || lower.includes('dispute')) key = 'foreign_arbitration';

    if (key && LEGAL_TRANSLATIONS[key]?.[activeLang]) {
      return LEGAL_TRANSLATIONS[key][activeLang];
    }
    return clause.summary;
  };

  return (
    <motion.div 
      key="result" 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-6 pb-12"
      role="region"
      aria-label="Document analysis results"
    >
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1917]">Contract Intelligence</h2>
          <p className="text-xs text-[#78716c]">Comprehensive risk analysis & redlines</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToReview && (
            <button
              onClick={onBackToReview}
              className="text-xs font-medium text-[#57534e] hover:text-[#1a1917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917] rounded-xl px-3 py-1.5 border border-[#e5e3df] bg-white hover:bg-[#f8f7f4] flex items-center gap-1.5 transition-colors"
              aria-label="View or edit extracted text"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Review text</span>
            </button>
          )}
          <button 
            onClick={onScanAnother} 
            className="text-xs font-medium text-[#57534e] hover:text-[#1a1917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1917] rounded-xl px-3 py-1.5 border border-[#e5e3df] bg-white hover:bg-[#f8f7f4] flex items-center gap-1.5 transition-colors"
            aria-label="Scan another document"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New scan</span>
          </button>
        </div>
      </div>

      {/* Contract Fairness Health Index (Feature 1) */}
      <FairnessGauge clauses={clauses} />

      {/* Quick Action Floating Bar: Ask LexAR & Redline Diff (Features 2 & 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setIsChatOpen(true)}
          className="flex items-center justify-between p-3.5 bg-white border border-[#e5e3df] hover:border-[#1a1917] rounded-2xl shadow-xs transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1a1917] text-white flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a1917] group-hover:text-black">
                Ask LexAR Copilot
              </p>
              <p className="text-[11px] text-[#78716c]">Ask any specific question about your terms</p>
            </div>
          </div>
          <span className="text-xs text-[#78716c] group-hover:translate-x-0.5 transition-transform font-bold">
            →
          </span>
        </button>

        <button
          onClick={() => setIsRedlineOpen(true)}
          className="flex items-center justify-between p-3.5 bg-white border border-[#e5e3df] hover:border-[#1a1917] rounded-2xl shadow-xs transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center shrink-0">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a1917] group-hover:text-black">
                View Redlines & Export
              </p>
              <p className="text-[11px] text-[#78716c]">Visual diff & email amendment draft</p>
            </div>
          </div>
          <span className="text-xs text-[#78716c] group-hover:translate-x-0.5 transition-transform font-bold">
            →
          </span>
        </button>
      </div>

      {/* Language & Plain English Toggle (Feature 4) */}
      <div className="flex items-center justify-between p-3 bg-[#f8f7f4] border border-[#e5e3df] rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-medium text-[#57534e]">
          <Languages className="w-4 h-4" />
          <span>Explanation Style / Language:</span>
        </div>
        <select
          value={activeLang}
          onChange={e => setActiveLang(e.target.value as SupportedLanguage)}
          className="bg-white border border-[#e5e3df] rounded-xl px-2.5 py-1 text-xs text-[#1a1917] focus:outline-none focus:ring-1 focus:ring-[#1a1917]"
          aria-label="Select explanation language"
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
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
              <span className="text-red-700 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-4 h-4" /> High Risk Alert
              </span>
            ) : (
              <span className="text-[#78716c] flex items-center gap-1 font-semibold">
                <FileText className="w-4 h-4" /> Executive Summary
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

      {/* Clause Cards */}
      {clauses.length > 0 && (
        <div className="space-y-4" role="list" aria-label="Analyzed clauses">
          {clauses.map((clause, i) => {
            const cfg = RISK_CONFIG[clause.riskLevel];
            const isRed = clause.riskLevel === 'RED';
            const hasCounter = Boolean(clause.counterProposal || clause.negotiationTip);

            return (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`border rounded-2xl p-4 bg-white ${cfg.card} shadow-xs`}
                role="listitem"
                aria-label={`${cfg.label} clause: ${clause.category || 'General'}`}
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badge}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    {clause.category && (
                      <span className="text-[#78716c] text-xs font-medium">{clause.category}</span>
                    )}
                  </div>
                </div>

                {/* Original Clause Text */}
                <p className="text-[#1a1917] text-sm leading-relaxed">{clause.text}</p>
                
                {/* Plain-English Explanation (Supports Translations) */}
                <div className="mt-3 pt-3 border-t border-[#e5e3df]">
                  <p className="text-[#57534e] text-sm leading-relaxed">
                    {getTranslatedSummary(clause)}
                  </p>
                </div>

                {/* Safe Counter-Proposal & Negotiation Strategy on RED clauses */}
                {isRed && hasCounter && (
                  <div className="mt-4 pt-3 border-t border-red-200/80 bg-white/80 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
                      <Sparkles className="w-3.5 h-3.5 text-red-600" />
                      <span>Recommended Negotiation Strategy</span>
                    </div>

                    {clause.counterProposal && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                            Safe Counter-Clause Revision
                          </span>
                          <button
                            onClick={() => copyToClipboard(clause.counterProposal!, `rev-${i}`)}
                            className="text-[11px] font-medium text-red-700 hover:text-red-900 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-red-100/50"
                            aria-label="Copy proposed counter clause"
                          >
                            {copiedId === `rev-${i}` ? (
                              <>
                                <Check className="w-3 h-3 text-green-600" />
                                <span className="text-green-700 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Revision</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-[#1a1917] bg-[#f8f7f4] border border-[#e5e3df] p-2.5 rounded-lg leading-relaxed font-mono">
                          {clause.counterProposal}
                        </p>
                      </div>
                    )}

                    {clause.negotiationTip && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
                            Diplomatic Talking Point
                          </span>
                          <button
                            onClick={() => copyToClipboard(clause.negotiationTip!, `tip-${i}`)}
                            className="text-[11px] font-medium text-red-700 hover:text-red-900 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-red-100/50"
                            aria-label="Copy negotiation talking point"
                          >
                            {copiedId === `tip-${i}` ? (
                              <>
                                <Check className="w-3 h-3 text-green-600" />
                                <span className="text-green-700 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Script</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-[#44403c] italic bg-amber-50/70 border border-amber-200/70 p-2.5 rounded-lg leading-relaxed">
                          &ldquo;{clause.negotiationTip}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}
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

      {/* Modals */}
      <AskLexARChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        scrubbedText={scrubbedText}
        clauses={clauses}
      />

      <RedlineDiffModal
        isOpen={isRedlineOpen}
        onClose={() => setIsRedlineOpen(false)}
        clauses={clauses}
        documentTitle={documentTitle}
      />
    </motion.div>
  );
}
