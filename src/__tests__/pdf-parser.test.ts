/**
 * Unit Tests: PDF Parser Validation Logic
 */

describe('PDF Parser — Validation Logic', () => {
  function validatePDFFile(file: { type: string; name: string; size: number }): { valid: boolean; error?: string } {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'Only PDF documents are supported.' };
    }
    if (file.size > 25 * 1024 * 1024) {
      return { valid: false, error: 'File too large. Maximum size is 25 MB.' };
    }
    return { valid: true };
  }

  it('should reject non-PDF file types', () => {
    expect(validatePDFFile({ type: 'image/png', name: 'contract.png', size: 1024 })).toEqual({
      valid: false,
      error: 'Only PDF documents are supported.',
    });
    expect(validatePDFFile({ type: 'text/plain', name: 'notes.txt', size: 500 })).toEqual({
      valid: false,
      error: 'Only PDF documents are supported.',
    });
  });

  it('should accept valid PDF files by MIME type or extension', () => {
    expect(validatePDFFile({ type: 'application/pdf', name: 'agreement.pdf', size: 50000 })).toEqual({
      valid: true,
    });
    expect(validatePDFFile({ type: '', name: 'agreement.PDF', size: 50000 })).toEqual({
      valid: true,
    });
  });

  it('should reject files exceeding 25MB', () => {
    expect(validatePDFFile({ type: 'application/pdf', name: 'huge.pdf', size: 26 * 1024 * 1024 })).toEqual({
      valid: false,
      error: 'File too large. Maximum size is 25 MB.',
    });
  });

  it('should accept files within the 25MB limit', () => {
    expect(validatePDFFile({ type: 'application/pdf', name: 'reasonable.pdf', size: 24 * 1024 * 1024 })).toEqual({
      valid: true,
    });
  });
});
