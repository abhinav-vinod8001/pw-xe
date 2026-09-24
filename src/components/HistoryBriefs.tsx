'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Loader2, AlertTriangle, Zap, CheckCircle,
  ChevronRight, Trash2, Printer, Clock, Sparkles, Copy, Check,
  MessageSquare, FileEdit
} from 'lucide-react';
import { getAllContracts, deleteContract, getContractById, type Contract } from '@/lib/db';
import { RISK_CONFIG, type Clause, type RiskLevel } from '@/lib/constants';

import FairnessGauge from './scanner/FairnessGauge';
import AskLexARChat from './scanner/AskLexARChat';
import RedlineDiffModal from './scanner/RedlineDiffModal';

interface HistoryBriefsProps {
  onClose: () => void;
}

export default function HistoryBriefs({ onClose }: HistoryBriefsProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRedlineOpen, setIsRedlineOpen] = useState(false);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try { setContracts(await getAllContracts()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  const openContract = async (id: number) => {
    const c = await getContractById(id);
    if (c) setSelectedContract(c);
  };

  const handleDelete = async (e: React.MouseEvent, id: number, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    setDeleting(id);
    try {
      await deleteContract(id);
      setContracts(p => p.filter(c => c.id !== id));
      if (selectedContract?.id === id) setSelectedContract(null);
    } finally { setDeleting(null); }
  };

  const redClauses = selectedContract?.clauses.filter((c: Clause) => c.riskLevel === 'RED') || [];
  const yellowClauses = selectedContract?.clauses.filter((c: Clause) => c.riskLevel === 'YELLOW') || [];
  const greenClauses = selectedContract?.clauses.filter((c: Clause) => c.riskLevel === 'GREEN') || [];

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={selectedContract ? () => setSelectedContract(null) : onClose}
            className="p-1.5 rounded-lg hover:bg-[#e5e3df] text-[#57534e] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-[#1a1917]">
            {selectedContract ? selectedContract.title : 'History'}
          </h2>
        </div>
        {selectedContract && (
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#57534e] border border-[#e5e3df] rounded-lg hover:bg-[#f2f1ee] transition-colors"
            aria-label="Print brief"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* List */}
        {!selectedContract && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[#a8a29e]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-8 h-8 text-[#ccc9c3] mx-auto mb-3" />
                <p className="text-[#57534e] text-sm font-medium">No documents yet</p>
                <p className="text-[#a8a29e] text-xs mt-1">Upload or scan a document to get started</p>
              </div>
            ) : (
              <ul className="space-y-2" role="list">
                {contracts.map(contract => {
                  const risk = RISK_CONFIG[(contract.overallRisk as RiskLevel) || 'GREEN'];
                  const redCount = contract.clauses.filter((c: Clause) => c.riskLevel === 'RED').length;
                  return (
                    <li key={contract.id} role="listitem">
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full text-left flex items-center gap-3 bg-white border border-[#e5e3df] rounded-xl p-4 hover:border-[#ccc9c3] hover:bg-[#fafaf9] transition-colors group relative"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${risk.dot}`} />
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => contract.id && openContract(contract.id)}
                            className="text-[#1a1917] text-sm font-medium truncate text-left focus:outline-none before:absolute before:inset-0"
                            aria-label={`View ${contract.title}`}
                          >
                            {contract.title}
                          </button>
                          <p className="text-[#a8a29e] text-xs mt-0.5">
                            {new Date(contract.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                            {' · '}{contract.documentType === 'scan' ? 'Scan' : 'PDF'}
                            {redCount > 0 && <span className="text-red-600"> · {redCount} high-risk</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 relative z-10">
                          <button
                            onClick={e => contract.id && handleDelete(e, contract.id, contract.title)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#ccc9c3] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label={`Delete document ${contract.title}`}
                          >
                            {deleting === contract.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                          <ChevronRight className="w-4 h-4 text-[#ccc9c3]" />
                        </div>
                      </motion.div>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}

        {/* Brief Detail */}
        {selectedContract && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Print header */}
            <div className="print-only hidden">
              <h1 className="text-xl font-bold text-[#1a1917]">Consultation Brief</h1>
              <p className="text-[#57534e] text-sm mt-0.5">{selectedContract.title}</p>
              <p className="text-[#a8a29e] text-xs mt-0.5">
                {new Date(selectedContract.createdAt).toLocaleString()}
              </p>
              <p className="text-emerald-700 text-xs mt-1">Generated with local PII scrubbing — LexAR</p>
              <hr className="my-4 border-[#e5e3df]" />
            </div>

            {/* Contract Fairness Meter */}
            <FairnessGauge clauses={selectedContract.clauses} />

            {/* Quick Actions: Ask Copilot & View Redlines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
              <button
                onClick={() => setIsChatOpen(true)}
                className="flex items-center justify-between p-3.5 bg-white border border-[#e5e3df] hover:border-[#1a1917] rounded-2xl shadow-xs transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#1a1917] text-white flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1a1917] group-hover:text-black">
                      Ask Copilot
                    </p>
                    <p className="text-[11px] text-[#78716c]">Ask questions about this saved contract</p>
                  </div>
                </div>
                <span className="text-xs text-[#78716c] font-bold">→</span>
              </button>

              <button
                onClick={() => setIsRedlineOpen(true)}
                className="flex items-center justify-between p-3.5 bg-white border border-[#e5e3df] hover:border-[#1a1917] rounded-2xl shadow-xs transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center shrink-0">
                    <FileEdit className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1a1917] group-hover:text-black">
                      Redlines & Export
                    </p>
                    <p className="text-[11px] text-[#78716c]">Visual diff & email amendment draft</p>
                  </div>
                </div>
                <span className="text-xs text-[#78716c] font-bold">→</span>
              </button>
            </div>

            {/* Risk summary */}
            <div className="flex gap-2">
              {[
                { count: redClauses.length, label: 'High risk', cfg: RISK_CONFIG.RED },
                { count: yellowClauses.length, label: 'Review', cfg: RISK_CONFIG.YELLOW },
                { count: greenClauses.length, label: 'Standard', cfg: RISK_CONFIG.GREEN },
              ].map(item => (
                <div
                  key={item.label}
                  className={`flex-1 text-center py-3 rounded-xl border print-card ${item.cfg.badge}`}
                >
                  <div className="text-lg font-semibold">{item.count}</div>
                  <div className="text-[10px] opacity-70">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Clauses by section */}
            {[
              { clauses: redClauses, risk: RISK_CONFIG.RED, heading: 'High-Risk Clauses' },
              { clauses: yellowClauses, risk: RISK_CONFIG.YELLOW, heading: 'Clauses to Review' },
              { clauses: greenClauses, risk: RISK_CONFIG.GREEN, heading: 'Standard Clauses' },
            ].map(({ clauses: sectionClauses, risk, heading }) =>
              sectionClauses.length > 0 ? (
                <div key={heading}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${risk.section}`}>
                    {heading} ({sectionClauses.length})
                  </p>
                  <div className="space-y-2">
                    {sectionClauses.map((clause: Clause, i: number) => (
                      <ClauseCard key={i} clause={clause} />
                    ))}
                  </div>
                </div>
              ) : null
            )}

            {/* Print footer */}
            <div className="print-only hidden text-center text-xs text-[#a8a29e] border-t border-[#e5e3df] pt-4">
              Generated by LexAR. This brief is for informational purposes only and does not constitute legal advice.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copilot Chat & Redline Modals */}
      {selectedContract && (
        <>
          <AskLexARChat
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            scrubbedText={selectedContract.scrubbedText || selectedContract.rawText}
            clauses={selectedContract.clauses}
          />
          <RedlineDiffModal
            isOpen={isRedlineOpen}
            onClose={() => setIsRedlineOpen(false)}
            clauses={selectedContract.clauses}
            documentTitle={selectedContract.title}
          />
        </>
      )}
    </div>
  );
}

function ClauseCard({ clause }: { clause: Clause }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const risk = RISK_CONFIG[clause.riskLevel];
  const text = clause.text;
  const isLong = text.length > 140;

  const copyText = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isRed = clause.riskLevel === 'RED';
  const hasCounter = Boolean(clause.counterProposal || clause.negotiationTip);

  return (
    <div className={`border rounded-xl p-4 print-card ${risk.card}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${risk.badge}`}>
          {risk.icon} {risk.label}
        </span>
        {clause.category && <span className="text-[#a8a29e] text-[11px]">{clause.category}</span>}
      </div>
      <p className="text-[#1a1917] text-sm leading-relaxed">
        {expanded || !isLong ? text : text.slice(0, 140) + '…'}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-1 text-[#57534e] underline-offset-2 underline text-xs"
          >
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </p>
      <p className="text-[#57534e] text-xs mt-1.5 leading-relaxed">{clause.summary}</p>

      {/* Safe Counter-Proposal & Negotiation Strategy */}
      {isRed && hasCounter && (
        <div className="mt-3 pt-3 border-t border-red-200/80 bg-white/80 rounded-xl p-3 space-y-2.5">
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
                  onClick={() => copyText(clause.counterProposal!, 'rev')}
                  className="text-[11px] font-medium text-red-700 hover:text-red-900 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-red-100/50"
                  aria-label="Copy proposed counter clause"
                >
                  {copiedId === 'rev' ? (
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
              <p className="text-xs text-[#1a1917] bg-[#f8f7f4] border border-[#e5e3df] p-2 rounded leading-relaxed font-mono">
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
                  onClick={() => copyText(clause.negotiationTip!, 'tip')}
                  className="text-[11px] font-medium text-red-700 hover:text-red-900 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-red-100/50"
                  aria-label="Copy negotiation talking point"
                >
                  {copiedId === 'tip' ? (
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
              <p className="text-xs text-[#44403c] italic bg-amber-50/70 border border-amber-200/70 p-2 rounded leading-relaxed">
                &ldquo;{clause.negotiationTip}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
