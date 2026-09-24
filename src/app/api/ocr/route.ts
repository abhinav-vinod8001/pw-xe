import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

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

const OCR_SYSTEM_PROMPT = `You are a high-precision document OCR transcription engine.
Transcribe ALL legible text from the provided document image verbatim.
Preserve paragraph structure, clause headings, numbering, and exact wording.
Do NOT add any conversational preamble, commentary, greetings, or markdown code block fences (like \`\`\`text or \`\`\`markdown).
Output ONLY the raw transcribed text.`;



export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { allowed } = checkRateLimit(request, 60000, 20);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
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

    // Check size limit (~8MB base64)
    const sizeBytes = Math.ceil(image.length * 0.75);
    if (sizeBytes > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 8MB.' },
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

    // Active Groq vision models. qwen/qwen3.8-27b has confirmed vision support.
    const visionModels = [
      process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
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
                  text: 'Transcribe all text from this document image.',
                },
              ],
            },
          ],
          temperature: 0.1,
          // Groq on-demand OTPM limit for vision models is 1000 tokens/min.
          // Keeping max_tokens <= 850 prevents rate limit rejections while allowing ~3500 chars of text.
          max_tokens: 850,
        });

        let text = completion.choices[0]?.message?.content?.trim() || '';
        
        // Strip markdown code block wrappers if any
        if (text.startsWith('```')) {
          text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
        }
        // Strip common conversational preambles
        text = text.replace(/^(here is the (extracted|transcribed) text[:\n]*)/i, '').trim();

        if (text && text.length > 5) {
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
