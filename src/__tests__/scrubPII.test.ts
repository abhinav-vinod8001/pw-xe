/**
 * Unit Tests: PII Scrubber
 * 
 * Tests the core scrubPIIWithDetails function for correctness,
 * edge cases, and false positive prevention.
 */
import { scrubPII, scrubPIIWithDetails } from '@/lib/scrubPII';

describe('scrubPIIWithDetails', () => {
  describe('Name Redaction', () => {
    it('should redact names after party designations', () => {
      const input = 'Party A: Alice Johnson\nParty B: Bob Smith';
      const result = scrubPIIWithDetails(input);
      expect(result.scrubbedText).not.toContain('Alice Johnson');
      expect(result.scrubbedText).not.toContain('Bob Smith');
      expect(result.stats.names).toBeGreaterThanOrEqual(2);
    });

    it('should redact names with honorifics', () => {
      const input = 'Mr. John Davis and Dr. Sarah Miller agreed.';
      const result = scrubPIIWithDetails(input);
      expect(result.scrubbedText).not.toContain('John Davis');
      expect(result.scrubbedText).not.toContain('Sarah Miller');
    });

    it('should redact names in "by and between" patterns', () => {
      const input = 'This agreement entered into between Alice Johnson and Bob Smith.';
      const result = scrubPIIWithDetails(input);
      expect(result.scrubbedText).not.toContain('Alice Johnson');
      expect(result.scrubbedText).not.toContain('Bob Smith');
    });
  });

  describe('Currency Redaction', () => {
    it('should redact USD dollar amounts', () => {
      const result = scrubPIIWithDetails('Payment of $15,000.00 upon completion.');
      expect(result.scrubbedText).not.toContain('$15,000.00');
      expect(result.stats.currencies).toBeGreaterThanOrEqual(1);
    });

    it('should redact international currencies', () => {
      const input = 'Amounts: £10,000 and €750.50 and ₹500,000';
      const result = scrubPIIWithDetails(input);
      expect(result.scrubbedText).not.toContain('£10,000');
      expect(result.scrubbedText).not.toContain('€750.50');
      expect(result.scrubbedText).not.toContain('₹500,000');
      expect(result.stats.currencies).toBeGreaterThanOrEqual(3);
    });

    it('should redact amounts with currency suffixes', () => {
      const result = scrubPIIWithDetails('Deposit of 25000 USD required.');
      expect(result.scrubbedText).not.toContain('25000 USD');
    });
  });

  describe('Contact Information Redaction', () => {
    it('should redact email addresses', () => {
      const result = scrubPIIWithDetails('Contact alice@lawfirm.com for details.');
      expect(result.scrubbedText).not.toContain('alice@lawfirm.com');
      expect(result.stats.emails).toBe(1);
    });

    it('should redact phone numbers', () => {
      const result = scrubPIIWithDetails('Call +1 (555) 234-5678 for info.');
      expect(result.scrubbedText).not.toContain('555');
      expect(result.stats.phones).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Identifier Redaction', () => {
    it('should redact SSNs', () => {
      const result = scrubPIIWithDetails('SSN: 123-45-6789');
      expect(result.scrubbedText).not.toContain('123-45-6789');
      expect(result.stats.identifiers).toBeGreaterThanOrEqual(1);
    });

    it('should redact EINs', () => {
      const result = scrubPIIWithDetails('EIN: 12-3456789');
      expect(result.scrubbedText).not.toContain('12-3456789');
    });
  });

  describe('Address Redaction', () => {
    it('should redact street addresses', () => {
      const result = scrubPIIWithDetails('Located at 742 Evergreen Terrace');
      expect(result.scrubbedText).not.toContain('742 Evergreen Terrace');
      expect(result.stats.addresses).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = scrubPIIWithDetails('');
      expect(result.scrubbedText).toBe('');
      expect(result.stats.totalRedactions).toBe(0);
    });

    it('should handle null input', () => {
      const result = scrubPIIWithDetails(null as unknown as string);
      expect(result.scrubbedText).toBe('');
      expect(result.stats.totalRedactions).toBe(0);
    });

    it('should handle undefined input', () => {
      const result = scrubPIIWithDetails(undefined as unknown as string);
      expect(result.scrubbedText).toBe('');
    });
  });

  describe('False Positive Prevention', () => {
    it('should not redact generic "Party A" labels', () => {
      const result = scrubPII('Party A and Party B agree to Section 5.');
      expect(result).toContain('Party A');
      expect(result).toContain('Section 5');
    });

    it('should not redact non-currency numbers', () => {
      const result = scrubPII('I paid 500 apples.');
      expect(result).toContain('500 apples');
    });

    it('should not redact invalid phone formats', () => {
      const result = scrubPII('Call me at 555-XYZ-1234.');
      expect(result).toContain('555-XYZ-1234');
    });
  });

  describe('Stats Aggregation', () => {
    it('should correctly count total redactions', () => {
      const input = 'Party A: Alice Johnson. Payment of $5,000. Email: test@test.com';
      const result = scrubPIIWithDetails(input);
      expect(result.stats.totalRedactions).toBe(
        result.stats.names + result.stats.currencies + 
        result.stats.emails + result.stats.phones + 
        result.stats.identifiers + result.stats.addresses
      );
    });
  });
});
