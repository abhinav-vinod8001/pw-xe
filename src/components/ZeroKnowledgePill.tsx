'use client';

export default function ZeroKnowledgePill({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      On-device only
    </span>
  );
}
