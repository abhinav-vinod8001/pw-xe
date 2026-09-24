'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, X, Shield, Sparkles, User, Bot, Loader2, Copy, Check
} from 'lucide-react';
import type { Clause } from '@/lib/constants';

interface AskLexARChatProps {
  isOpen: boolean;
  onClose: () => void;
  scrubbedText: string;
  clauses: Clause[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SAMPLE_QUESTIONS = [
  'Can I work on outside projects?',
  'What happens if I terminate early?',
  'Is my liability capped?',
  'Who pays legal fees if there is a dispute?',
];

export default function AskLexARChat({
  isOpen,
  onClose,
  scrubbedText,
  clauses,
}: AskLexARChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your LexAR contract copilot. Ask me any specific question about your agreement, and I will answer directly based on your contract terms.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    setInput('');
    const userMsg: Message = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrubbedText,
          question: q,
          clauses,
          history: messages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get an answer.');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${err.message || 'Unable to generate an answer at this time.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end" 
      role="dialog" 
      aria-modal="true" 
      aria-label="Ask LexAR Chat"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#f8f7f4] h-full flex flex-col shadow-2xl border-l border-[#e5e3df]"
      >
        {/* Header */}
        <div className="p-4 bg-white border-b border-[#e5e3df] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1a1917] text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#1a1917]">Ask LexAR Copilot</h3>
              <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                <Shield className="w-3 h-3" /> Zero-knowledge context
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#57534e] hover:bg-[#f2f1ee] transition-colors"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => {
            const isBot = m.role === 'assistant';
            return (
              <div
                key={i}
                className={`flex gap-2.5 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs ${
                    isBot ? 'bg-[#1a1917] text-white' : 'bg-[#e5e3df] text-[#1a1917]'
                  }`}
                >
                  {isBot ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed relative group ${
                    isBot
                      ? 'bg-white border border-[#e5e3df] text-[#1a1917] shadow-xs'
                      : 'bg-[#1a1917] text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {isBot && i > 0 && (
                    <button
                      onClick={() => copyMessage(m.content, i)}
                      className="absolute bottom-1.5 right-1.5 p-1 rounded bg-[#f8f7f4] border border-[#e5e3df] text-[#78716c] hover:text-[#1a1917] opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Copy response"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2.5 items-center text-[#78716c] text-xs">
              <div className="w-7 h-7 rounded-lg bg-[#1a1917] text-white flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="bg-white border border-[#e5e3df] p-3 rounded-2xl">
                Consulting contract terms…
              </div>
            </div>
          )}
        </div>

        {/* Suggested Quick Questions */}
        <div className="px-4 py-2 bg-[#f2f1ee]/50 border-t border-[#e5e3df]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78716c] mb-1.5">
            Suggested Questions:
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="whitespace-nowrap text-[11px] px-2.5 py-1 bg-white border border-[#e5e3df] rounded-lg hover:border-[#a8a29e] text-[#1a1917] transition-colors shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-[#e5e3df]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question about this contract…"
              disabled={loading}
              className="flex-1 bg-[#f8f7f4] border border-[#e5e3df] rounded-xl px-3 py-2.5 text-xs text-[#1a1917] focus:outline-none focus:ring-1 focus:ring-[#1a1917]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-[#1a1917] text-white disabled:opacity-40 hover:bg-[#2a2926] transition-colors"
              aria-label="Send question"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
