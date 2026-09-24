'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp, Info } from 'lucide-react';
import { calculateFairnessScore, type FairnessAssessment } from '@/lib/fairnessScore';
import type { Clause } from '@/lib/constants';

interface FairnessGaugeProps {
  clauses: Clause[];
}

export default function FairnessGauge({ clauses }: FairnessGaugeProps) {
  const assessment: FairnessAssessment = calculateFairnessScore(clauses);
  const { overallScore, grade, verdict, summary, industryBenchmark, categories } = assessment;

  // Color mapping
  const getColor = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-700', stroke: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (score >= 65) return { text: 'text-amber-700', stroke: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200' };
    if (score >= 45) return { text: 'text-orange-700', stroke: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200' };
    return { text: 'text-red-700', stroke: '#dc2626', bg: 'bg-red-50', border: 'border-red-200' };
  };

  const color = getColor(overallScore);
  const strokeDashoffset = 251.2 - (251.2 * overallScore) / 100;

  return (
    <div className="bg-white border border-[#e5e3df] rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#f2f1ee]">
        {/* Left: Gauge and Score */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f2f1ee"
                strokeWidth="10"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={color.stroke}
                strokeWidth="10"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${color.text}`}>{overallScore}</span>
              <span className="text-[10px] text-[#a8a29e] -mt-1">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${color.bg} ${color.border} ${color.text}`}>
                Grade {grade}
              </span>
              <span className="font-semibold text-sm text-[#1a1917]">{verdict}</span>
            </div>
            <p className="text-xs text-[#57534e] mt-1 leading-relaxed max-w-sm">
              {summary}
            </p>
          </div>
        </div>

        {/* Right: Industry Benchmark Callout */}
        <div className="sm:max-w-[210px] bg-[#f8f7f4] border border-[#e5e3df] rounded-xl p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-[#1a1917] mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#57534e]" />
            <span>Market Benchmark</span>
          </div>
          <p className="text-[#57534e] leading-snug">{industryBenchmark}</p>
        </div>
      </div>

      {/* Sub-category Health Bars */}
      {categories.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wider">
              Pillar Breakdown
            </span>
            <span className="text-[11px] text-[#a8a29e]">Category Balance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {categories.map((cat) => {
              const catColor = getColor(cat.score);
              return (
                <div key={cat.category} className="bg-[#fcfbf9] border border-[#e5e3df] p-2.5 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-[#1a1917] truncate">{cat.category}</span>
                    <span className={`font-semibold ${catColor.text}`}>{cat.score}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e5e3df] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: catColor.stroke }}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.score}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
