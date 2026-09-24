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

// No mock classifier — forcing real Groq API usage

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

Return ONLY valid JSON. Extract up to 10 key clauses. You MUST include a balanced mix of RED, YELLOW, and GREEN clauses (if they exist in the text) so the user sees both the risky and the standard/safe parts of their document. Preserve exact text from the document.`;


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

    // 2b. Validate mode is one of the expected values
    if (mode && !['pdf', 'scan'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "pdf" or "scan".' },
        { status: 400 }
      );
    }

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

        const modelsToTry = [
          process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
        ];

        let completion;
        let lastError: any;

        for (const model of modelsToTry) {
          try {
            completion = await groq.chat.completions.create({
              model,
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
            if (completion) break;
          } catch (modelErr: any) {
            console.warn(`Groq model ${model} attempt failed:`, modelErr?.message || modelErr);
            lastError = modelErr;
          }
        }

        if (!completion) {
          throw lastError || new Error('Failed to get a response from Groq models.');
        }

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
      } catch (groqError: any) {
        console.error('Groq API error:', groqError);
        return NextResponse.json(
          { error: `Groq AI Error: ${groqError.message}` },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'GROQ_API_KEY environment variable is missing on the server.' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Analyze route error:', err);
    return NextResponse.json(
      { error: 'Internal server error during analysis.' },
      { status: 500 }
    );
  }
}
