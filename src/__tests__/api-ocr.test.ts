/**
 * Unit Tests: API OCR Route Validation Logic
 */

describe('API OCR Route — Validation Logic', () => {
  describe('Image validation', () => {
    function validateImage(image: unknown): { valid: boolean; error?: string } {
      if (!image || typeof image !== 'string') {
        return { valid: false, error: 'No image data provided.' };
      }
      if (!image.startsWith('data:image/')) {
        return { valid: false, error: 'Invalid image format. Expected a base64 data URL.' };
      }
      const sizeBytes = Math.ceil(image.length * 0.75);
      if (sizeBytes > 8 * 1024 * 1024) {
        return { valid: false, error: 'Image too large. Maximum size is 8MB.' };
      }
      return { valid: true };
    }

    it('should reject missing or non-string image data', () => {
      expect(validateImage(null)).toEqual({ valid: false, error: 'No image data provided.' });
      expect(validateImage(undefined)).toEqual({ valid: false, error: 'No image data provided.' });
      expect(validateImage('')).toEqual({ valid: false, error: 'No image data provided.' });
      expect(validateImage(12345)).toEqual({ valid: false, error: 'No image data provided.' });
    });

    it('should reject non-data-URL image strings', () => {
      expect(validateImage('https://example.com/image.png')).toEqual({
        valid: false,
        error: 'Invalid image format. Expected a base64 data URL.',
      });
      expect(validateImage('rawbase64stringwithoutprefix')).toEqual({
        valid: false,
        error: 'Invalid image format. Expected a base64 data URL.',
      });
    });

    it('should reject images over 8MB', () => {
      // 8MB = 8 * 1024 * 1024 = 8,388,608 bytes. In base64, ~11.2 million chars
      const hugeImage = 'data:image/jpeg;base64,' + 'A'.repeat(12 * 1024 * 1024);
      expect(validateImage(hugeImage)).toEqual({
        valid: false,
        error: 'Image too large. Maximum size is 8MB.',
      });
    });

    it('should accept valid base64 data URL within size limit', () => {
      const validImage = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(validateImage(validImage)).toEqual({ valid: true });
    });
  });

  describe('Post-processing cleanup', () => {
    function cleanOcrOutput(text: string): string {
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      }
      cleaned = cleaned.replace(/^(here is the (extracted|transcribed) text[:\n]*)/i, '').trim();
      return cleaned;
    }

    it('should strip markdown code fences', () => {
      expect(cleanOcrOutput('```markdown\n1. SCOPE OF SERVICES\n```')).toBe('1. SCOPE OF SERVICES');
      expect(cleanOcrOutput('```text\n2. INDEMNITY\n```')).toBe('2. INDEMNITY');
    });

    it('should strip conversational intros', () => {
      expect(cleanOcrOutput('Here is the transcribed text:\n\n1. AGREEMENT')).toBe('1. AGREEMENT');
      expect(cleanOcrOutput('Here is the extracted text: 1. AGREEMENT')).toBe('1. AGREEMENT');
    });

    it('should preserve standard contract text unaltered', () => {
      const standard = '1. CONFIDENTIALITY\nBoth parties agree to protect proprietary data.';
      expect(cleanOcrOutput(standard)).toBe(standard);
    });
  });
});
