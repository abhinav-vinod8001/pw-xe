import React from 'react';
import { AlertTriangle, Zap, CheckCircle } from 'lucide-react';

export type RiskLevel = 'RED' | 'YELLOW' | 'GREEN';
export type DocumentType = 'scan' | 'pdf';

export interface Clause {
  id?: string;
  text: string;
  riskLevel: RiskLevel;
  summary: string;
  category?: string;
  counterProposal?: string;
  negotiationTip?: string;
}

export const RISK_CONFIG = {
  RED: {
    label: 'High Risk',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    section: 'text-red-700',
    card: 'border-red-200 bg-[#fef2f2]',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    heading: 'text-red-800',
    overlay: 'bg-red-500/20 border-red-400',
  },
  YELLOW: {
    label: 'Review',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    section: 'text-amber-700',
    card: 'border-amber-200 bg-[#fffbeb]',
    icon: <Zap className="w-3.5 h-3.5" />,
    heading: 'text-amber-800',
    overlay: 'bg-amber-400/20 border-amber-400',
  },
  GREEN: {
    label: 'Standard',
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border-green-200',
    section: 'text-green-700',
    card: 'border-[#e5e3df] bg-white',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    heading: 'text-[#57534e]',
    overlay: 'bg-emerald-400/20 border-emerald-400',
  },
} as const;
