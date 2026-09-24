import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/ocr — Vision-based OCR endpoint
 * 
 * Accepts a base64-encoded image and uses a Groq vision model
 * to extract text from it. This replaces client-side Tesseract.js
 * which produces garbage output on phone camera photos.
 * 
 * NOTE: The raw image is sent to Groq for OCR. PII scrubbing
 * happens client-side AFTER this endpoint returns the extracted text,
 * and BEFORE the text is sent to /api/analyze.
 */

const OCR_SYSTEM_PROMPT = `You are a document OCR engine. Your ONLY job is to extract ALL text from the provided image, preserving the original formatting as closely as possible.

RULES:
1. Output ONLY the extracted text. No commentary, no analysis, no summaries.
2. Preserve paragraph breaks and section numbering.
3. If text is unclear, make your best effort — do NOT skip sections.
4. Do NOT add any text that is not visible in the image.
5. If no readable text is found, respond with exactly: [NO_TEXT_FOUND]`;

// Reuse the same rate limiter logic from analyze route
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 8;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
  validTimestamps.push(now);
  rateLimitStore.set(ip, validTimestamps);
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { image } = body as { image?: string };

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'No image data provided.' },
        { status: 400 }
      );
    }

    // Validate it looks like a data URL or base64
    if (!image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid image format. Expected a base64 data URL.' },
        { status: 400 }
      );
    }

    // Check size (~4MB base64 limit for Groq)
    const sizeBytes = Math.ceil(image.length * 0.75);
    if (sizeBytes > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 4MB.' },
        { status: 413 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY environment variable is missing.' },
        { status: 500 }
      );
    }

    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey });

    // Vision models to try
    const visionModels = [
      process.env.GROQ_VISION_MODEL || 'qwen/qwen-2.5-vl-32b-instruct',
      'meta-llama/llama-4-scout-17b-16e-instruct',
    ];

    let result: string | null = null;
    let lastError: any;

    for (const model of visionModels) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: OCR_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: image },
                },
                {
                  type: 'text',
                  text: 'Extract all text from this document image.',
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 4096,
        });

        const text = completion.choices[0]?.message?.content?.trim() || '';
        if (text && text !== '[NO_TEXT_FOUND]') {
          result = text;
          break;
        }
      } catch (err: any) {
        console.warn(`Vision model ${model} failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!result) {
      if (lastError) {
        return NextResponse.json(
          { error: `Vision OCR failed: ${lastError.message}` },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: 'No readable text found in the image.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: result });
  } catch (err: any) {
    console.error('OCR route error:', err);
    return NextResponse.json(
      { error: 'Internal server error during OCR.' },
      { status: 500 }
    );
  }
}
