import { NextRequest, NextResponse } from 'next/server';
import type { Clause } from '@/lib/constants';

interface AnalyzeRequest {
  text: string;
  mode?: 'pdf' | 'scan';
  fileName?: string;
}

interface AnalyzeResponse {
  clauses: Clause[];
  summary?: string;
}

// In-memory rate limiting map: IP -> array of timestamps
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }
  
  validTimestamps.push(now);
  rateLimitStore.set(ip, validTimestamps);
  
  // Cleanup occasionally (optional, but good for memory)
  if (Math.random() < 0.1) {
    for (const [key, times] of rateLimitStore.entries()) {
      const valid = times.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, valid);
    }
  }
  return true;
}

// Sanitize filename to prevent directory traversal or injection in prompt
function sanitizeFileName(name?: string): string {
  if (!name) return '';
  return name.replace(/[^a-zA-Z0-9.\-_ ]/g, '').slice(0, 100);
}

// Heuristic keyword-based mock classifier used when GROQ_API_KEY is missing
function mockClassifyClauses(text: string): AnalyzeResponse {
  const HIGH_RISK_KEYWORDS = [
    'unlimited liability', 'indemnif', 'hold harmless', 'waive all rights',
    'non-compete', 'non compete', 'irrevocable', 'perpetual license',
    'at any time without notice', 'sole discretion', 'unilateral',
    'liquidated damages', 'penalty', 'arbitration mandatory',
    'class action waiver', 'termination for convenience',
    'all intellectual property', 'assign all rights',
  ];
  const MODERATE_RISK_KEYWORDS = [
    'exclusive', 'limitation of liability', 'as is', 'no warranty',
    'automatic renewal', 'auto-renew', 'change without notice',
    'right to modify', 'governing law', 'jurisdiction',
    'confidential', 'nondisclosure', 'retain the right',
    'reasonable fee', 'subject to change',
  ];

  const sentences = text
    .split(/[.!?;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 1500);

  const clauses: Clause[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const key = lower.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);

    const isHighRisk = HIGH_RISK_KEYWORDS.some(kw => lower.includes(kw));
    const isModerate = !isHighRisk && MODERATE_RISK_KEYWORDS.some(kw => lower.includes(kw));

    if (isHighRisk) {
      clauses.push({
        text: sentence,
        riskLevel: 'RED',
        summary: 'This clause may significantly limit your rights, expose you to unbounded liability, or grant excessive power to the other party. Review with a licensed attorney.',
        category: HIGH_RISK_KEYWORDS.find(kw => lower.includes(kw))?.replace(/-/g, ' ') || 'High-Risk Clause',
      });
    } else if (isModerate) {
      clauses.push({
        text: sentence,
        riskLevel: 'YELLOW',
        summary: 'This clause warrants careful review. It may restrict your options, modify warranty rights, or impose conditions that should be understood before signing.',
        category: MODERATE_RISK_KEYWORDS.find(kw => lower.includes(kw))?.replace(/-/g, ' ') || 'Moderate Clause',
      });
    } else if (clauses.length < 8 && sentence.length > 40) {
      clauses.push({
        text: sentence,
        riskLevel: 'GREEN',
        summary: 'Standard boilerplate clause with low risk. Typical legal language used in most agreements.',
        category: 'Standard Clause',
      });
    }

    if (clauses.length >= 15) break;
  }

  return {
    clauses,
    summary: `Analyzed ${sentences.length} text segments. Found ${clauses.filter(c => c.riskLevel === 'RED').length} high-risk, ${clauses.filter(c => c.riskLevel === 'YELLOW').length} moderate-risk, and ${clauses.filter(c => c.riskLevel === 'GREEN').length} standard clauses.`,
  };
}

const GROQ_SYSTEM_PROMPT = `You are LexAR, an elite, pragmatic legal AI assistant. Your task is to analyze the provided legal text and extract its clauses, categorizing them by risk level.

CRITICAL INSTRUCTIONS:
1. Do NOT hallucinate risks. You must be highly conservative and pragmatic.
2. Context is key: A confidentiality clause in a Non-Disclosure Agreement is perfectly standard (GREEN). Do not flag standard, customary, or expected clauses as risky unless they are highly unusual or heavily one-sided.
3. Only flag clauses as RED or YELLOW if they pose a genuine, unexpected, or disproportionate threat to a signing party.

Return a valid JSON object with this exact structure:
{
  "clauses": [
    {
      "text": "The exact clause text from the document",
      "riskLevel": "RED" | "YELLOW" | "GREEN",
      "summary": "Plain-English explanation of the clause.",
      "category": "Type of clause (e.g., Liability, Indemnification, Term)"
    }
  ],
  "summary": "Brief overall summary of the document's risk profile"
}

Risk level guidelines:
- RED (High Risk): Highly unusual, predatory, or extremely one-sided terms (e.g., unlimited liability, uncompensated IP assignment, draconian non-competes, hidden auto-renewal traps).
- YELLOW (Moderate Risk): Clauses that require careful review but aren't necessarily predatory (e.g., unusual governing law, tight indemnification loops, non-standard warranty disclaimers).
- GREEN (Standard/Low Risk): Customary clauses expected for the document type (e.g., confidentiality in an NDA, standard definitions, recitals, severability, mutual obligations).

Return ONLY valid JSON. Extract up to 10 most important clauses. Preserve exact text from the document.`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Rate Limiting
    // In App Router, we can attempt to get IP from headers or fallback
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // 2. Input Size Limit (50KB approx 50000 chars of text, but let's check content-length if available)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 50000) {
      return NextResponse.json(
        { error: 'Payload too large. Maximum size is 50KB.' },
        { status: 413 }
      );
    }

    const body: AnalyzeRequest = await request.json();
    const { text, mode = 'pdf', fileName } = body;

    // 3. Input Validation
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Invalid or empty text provided.' },
        { status: 400 }
      );
    }

    const safeFileName = sanitizeFileName(fileName);

    // Truncate text to ~12k chars to stay within token limits
    const truncatedText = text.slice(0, 12000);

    const apiKey = process.env.GROQ_API_KEY;

    // --- Live Groq API path ---
    if (apiKey) {
      try {
        const { default: Groq } = await import('groq-sdk');
        const groq = new Groq({ apiKey });

        const completion = await groq.chat.completions.create({
          model: 'llama3-8b-8192',
          messages: [
            { role: 'system', content: GROQ_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Analyze this legal document${safeFileName ? ` (${safeFileName})` : ''} scanned via ${mode} mode:\n\n${truncatedText}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawContent) as AnalyzeResponse;
        
        // Output validation
        if (!parsed || !Array.isArray(parsed.clauses)) {
           throw new Error("Invalid response format from Groq API");
        }

        // Sanitize risk levels to prevent UI crashes from non-deterministic LLM casing
        parsed.clauses = parsed.clauses.map(c => {
          let risk = (c.riskLevel || '').toUpperCase().trim();
          if (!['RED', 'YELLOW', 'GREEN'].includes(risk)) risk = 'GREEN';
          return { ...c, riskLevel: risk as 'RED' | 'YELLOW' | 'GREEN' };
        });

        return NextResponse.json(parsed);
      } catch (groqError) {
        console.error('Groq API error, falling back to mock:', groqError);
        // Fall through to mock
      }
    }

    // --- Mock Fallback path ---
    const mockResult = mockClassifyClauses(truncatedText);
    return NextResponse.json({ ...mockResult, _source: 'mock' });
  } catch (err) {
    console.error('Analyze route error:', err);
    return NextResponse.json(
      { error: 'Internal server error during analysis.' },
      { status: 500 }
    );
  }
}
