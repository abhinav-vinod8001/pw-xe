/**
 * LexAR Zero-Knowledge PII Scrubber Utility
 * 
 * Strictly replaces Personally Identifiable Information (PII) including:
 * - Names and legal party signatories
 * - Currency amounts and financial values
 * - Email addresses
 * - Telephone / mobile numbers
 * - Social Security Numbers (SSN), Tax IDs, and National Identification
 * - Physical street addresses and postal zip codes
 * 
 * Replaces sensitive values with [REDACTED] prior to any external LLM processing.
 */

export interface ScrubbingStats {
  totalRedactions: number;
  names: number;
  currencies: number;
  emails: number;
  phones: number;
  identifiers: number;
  addresses: number;
}

export interface ScrubResult {
  scrubbedText: string;
  stats: ScrubbingStats;
}

/**
 * Main scrubber function to redact sensitive PII
 */
export function scrubPII(rawText: string): string {
  return scrubPIIWithDetails(rawText).scrubbedText;
}

/**
 * Detailed scrubber function returning both scrubbed text and breakdown stats
 */
export function scrubPIIWithDetails(rawText: string): ScrubResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      scrubbedText: '',
      stats: {
        totalRedactions: 0,
        names: 0,
        currencies: 0,
        emails: 0,
        phones: 0,
        identifiers: 0,
        addresses: 0,
      },
    };
  }

  let text = rawText;
  const stats: ScrubbingStats = {
    totalRedactions: 0,
    names: 0,
    currencies: 0,
    emails: 0,
    phones: 0,
    identifiers: 0,
    addresses: 0,
  };

  // 1. Scrub Emails (e.g., john.doe@example.com, alice_smith@lawcorp.org)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  text = text.replace(emailRegex, () => {
    stats.emails++;
    stats.totalRedactions++;
    return '[REDACTED]';
  });

  // 2. Scrub SSN & Tax Identifiers (e.g. 123-45-6789, EIN 12-3456789)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  text = text.replace(ssnRegex, () => {
    stats.identifiers++;
    stats.totalRedactions++;
    return '[REDACTED]';
  });

  const einRegex = /\b\d{2}-\d{7}\b/g;
  text = text.replace(einRegex, () => {
    stats.identifiers++;
    stats.totalRedactions++;
    return '[REDACTED]';
  });

  // 3. Scrub Currency Amounts (e.g. $1,500.00, $500,000, 25,000 USD, €750.50, £10,000, 500 dollars)
  // Run before phone numbers to prevent currency numbers being treated as phones
  const currencyRegex = /(?:[\$€£¥₹]\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|INR|CAD|AUD|dollars|cents)\b)/gi;
  text = text.replace(currencyRegex, () => {
    stats.currencies++;
    stats.totalRedactions++;
    return '[REDACTED]';
  });

  // 4. Scrub Phone Numbers (e.g., +1-555-123-4567, (555) 123-4567, 555.123.4567, +44 20 7946 0958)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g;
  text = text.replace(phoneRegex, (match) => {
    const cleanDigits = match.replace(/\D/g, '');
    if (cleanDigits.length >= 7 && cleanDigits.length <= 15) {
      stats.phones++;
      stats.totalRedactions++;
      return '[REDACTED]';
    }
    return match;
  });

  // 5. Scrub Common Physical Address patterns
  const addressRegex = /\b\d{1,5}\s+[A-Z][a-zA-Z0-9\s.,'-]+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Highway|Hwy\.?|Terrace|Trce\.?)(?:\s*,?\s*(?:Suite|Ste|Apt|Unit|Floor|Fl)\.?\s*#?\w+)?/gi;
  text = text.replace(addressRegex, () => {
    stats.addresses++;
    stats.totalRedactions++;
    return '[REDACTED]';
  });

  const zipCodeRegex = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;
  text = text.replace(zipCodeRegex, () => {
    stats.addresses++;
    stats.totalRedactions++;
    return '[REDACTED]';
  });

  // 6. Scrub Legal Signatories, Prefixes, and Named Entities
  // Restrict name matching to horizontal space only [^\S\r\n] so names don't span multiple lines!
  const designatedPartyRegex = /\b(Party\s+[A-Z]|Employee|Employer|Consultant|Client|Contractor|Principal|Agent|Landlord|Tenant|Disclosing\s+Party|Receiving\s+Party|Buyer|Seller|Borrower|Lender|Assignor|Assignee|Witness|Name|Signed\s+by|Signature|Printed\s+Name)\s*:\s*([A-Z][a-z]+(?:[^\S\r\n]+[A-Z][a-z]+)+)/g;
  text = text.replace(designatedPartyRegex, (match, prefix, nameGroup) => {
    stats.names++;
    stats.totalRedactions++;
    return `${prefix}: [REDACTED]`;
  });

  const honorificNameRegex = /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Attorney|Counselor)[^\S\r\n]+([A-Z][a-z]+(?:[^\S\r\n]+[A-Z][a-z]+)+)/g;
  text = text.replace(honorificNameRegex, (match, title, nameGroup) => {
    stats.names++;
    stats.totalRedactions++;
    return `${title} [REDACTED]`;
  });

  const partiesIntroRegex = /(by\s+and\s+between|entered\s+into\s+between|agreement\s+between)[^\S\r\n]+([A-Z][a-z]+(?:[^\S\r\n]+[A-Z][a-z]+)+)[^\S\r\n]+(and|&)[^\S\r\n]+([A-Z][a-z]+(?:[^\S\r\n]+[A-Z][a-z]+)+)/gi;
  text = text.replace(partiesIntroRegex, (match, intro, p1, conj, p2) => {
    stats.names += 2;
    stats.totalRedactions += 2;
    return `${intro} [REDACTED] ${conj} [REDACTED]`;
  });

  const individualDesignationRegex = /\b([A-Z][a-z]+(?:[^\S\r\n]+[A-Z][a-z]+)+),\s*(?:an\s+individual|residing\s+at)/g;
  text = text.replace(individualDesignationRegex, (match, nameGroup) => {
    stats.names++;
    stats.totalRedactions++;
    return match.replace(nameGroup, '[REDACTED]');
  });

  return {
    scrubbedText: text,
    stats,
  };
}
