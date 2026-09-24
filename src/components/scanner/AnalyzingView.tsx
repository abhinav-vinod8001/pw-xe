'use client';

import { motion } from 'framer-motion';
import { Loader2, Shield } from 'lucide-react';

/**
 * Analyzing View
 * 
 * Displayed while the Groq AI model is processing the secured text.
 * Shows a spinner and a trust confirmation message.
 */
export default function AnalyzingView() {
  return (
    <motion.div
      key="analyzing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 py-20"
      role="status"
      aria-label="Analyzing document with AI"
    >
      <Loader2 className="w-10 h-10 animate-spin text-[#1a1917]" aria-hidden="true" />
      <div className="text-center">
        <p className="font-medium text-[#1a1917] text-base" aria-live="polite">
          Analyzing risk clauses with AI…
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-emerald-700 text-xs font-medium">
          <Shield className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Only secured text was transmitted.</span>
        </div>
      </div>
    </motion.div>
  );
}
