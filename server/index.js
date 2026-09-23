const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk').default;

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({
  origin: '*', // Allow any origin (Vercel, localhost, etc.)
  methods: ['POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '50kb' }));

// --- Rate Limiting ---
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];
  const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= MAX_REQUESTS_PER_WINDOW) return false;
  valid.push(now);
  rateLimitStore.set(ip, valid);
  return true;
}

// --- Helpers ---
function sanitizeFileName(name) {
  if (!name) return '';
  return name.replace(/[^a-zA-Z0-9.\-_ ]/g, '').slice(0, 100);
}

// --- System Prompt ---
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

// --- Mock Fallback Classifier ---
function mockClassifyClauses(text) {
  const HIGH_RISK = [
    'unlimited liability', 'indemnif', 'hold harmless', 'waive all rights',
    'non-compete', 'non compete', 'irrevocable', 'perpetual license',
    'at any time without notice', 'sole discretion', 'unilateral',
    'liquidated damages', 'penalty', 'arbitration mandatory',
    'class action waiver', 'termination for convenience',
    'all intellectual property', 'assign all rights',
  ];
  const MODERATE = [
    'exclusive', 'limitation of liability', 'as is', 'no warranty',
    'automatic renewal', 'auto-renew', 'change without notice',
    'right to modify', 'governing law', 'jurisdiction',
    'confidential', 'nondisclosure', 'retain the right',
    'reasonable fee', 'subject to change',
  ];

  const sentences = text.split(/[.!?;]/).map(s => s.trim()).filter(s => s.length > 20 && s.length < 500);
  const clauses = [];
  const seen = new Set();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const key = lower.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);

    const isHigh = HIGH_RISK.some(kw => lower.includes(kw));
    const isMod = !isHigh && MODERATE.some(kw => lower.includes(kw));

    if (isHigh) {
      clauses.push({ text: sentence, riskLevel: 'RED', summary: 'This clause may significantly limit your rights.', category: HIGH_RISK.find(kw => lower.includes(kw)) || 'High-Risk' });
    } else if (isMod) {
      clauses.push({ text: sentence, riskLevel: 'YELLOW', summary: 'This clause warrants careful review.', category: MODERATE.find(kw => lower.includes(kw)) || 'Moderate' });
    } else if (clauses.length < 8 && sentence.length > 40) {
      clauses.push({ text: sentence, riskLevel: 'GREEN', summary: 'Standard boilerplate clause with low risk.', category: 'Standard Clause' });
    }

    if (clauses.length >= 15) break;
  }

  return {
    clauses,
    summary: `Found ${clauses.filter(c => c.riskLevel === 'RED').length} high-risk, ${clauses.filter(c => c.riskLevel === 'YELLOW').length} moderate, and ${clauses.filter(c => c.riskLevel === 'GREEN').length} standard clauses.`,
  };
}

// --- Health Check ---
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'LexAR Backend', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Main Analyze Endpoint ---
app.post('/api/analyze', async (req, res) => {
  try {
    // Rate limit
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { text, mode = 'pdf', fileName } = req.body;

    // Validate
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ error: 'Invalid or empty text provided.' });
    }

    const safeFileName = sanitizeFileName(fileName);
    const truncatedText = text.slice(0, 12000);
    const apiKey = process.env.GROQ_API_KEY;

    // --- Live Groq API path ---
    if (apiKey) {
      try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-20b',
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
        const parsed = JSON.parse(rawContent);

        if (!parsed || !Array.isArray(parsed.clauses)) {
          throw new Error('Invalid response format from Groq API');
        }

        // Sanitize risk levels
        parsed.clauses = parsed.clauses.map(c => {
          let risk = (c.riskLevel || '').toUpperCase().trim();
          if (!['RED', 'YELLOW', 'GREEN'].includes(risk)) risk = 'GREEN';
          return { ...c, riskLevel: risk };
        });

        return res.json(parsed);
      } catch (groqError) {
        console.error('Groq API error, falling back to mock:', groqError.message);
        // Fall through to mock
      }
    }

    // --- Mock Fallback ---
    const mockResult = mockClassifyClauses(truncatedText);
    return res.json({ ...mockResult, _source: 'mock' });

  } catch (err) {
    console.error('Analyze error:', err);
    return res.status(500).json({ error: 'Internal server error during analysis.' });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`✅ LexAR Backend running on port ${PORT}`);
  console.log(`   Groq API Key: ${process.env.GROQ_API_KEY ? '✓ configured' : '✗ missing (mock mode)'}`);
});
