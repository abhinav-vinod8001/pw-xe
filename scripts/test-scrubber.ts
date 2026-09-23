import { scrubPII, scrubPIIWithDetails } from '../src/lib/scrubPII';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- RUNNING LEXAR PII SCRUBBER UNIT TESTS ---');

// Test Case 1: Masking Name and Dollar Amount
const sampleContractText = `
This Non-Disclosure Agreement is entered into by and between Alice Johnson and Bob Smith.
Party A: Alice Johnson
Party B: Bob Smith
The Consultant shall receive a monthly retainer of $15,000.00 and an upfront deposit of 25000 USD.
In case of breach, liquidated damages shall equal $100,000.
For notices, contact: alice.johnson@corporate-legal.com or call +1 (555) 234-5678.
SSN: 123-45-6789. Address: 742 Evergreen Terrace, Springfield, OR 97477.
`;

const result = scrubPIIWithDetails(sampleContractText);

console.log('\n--- ORIGINAL TEXT SAMPLE ---');
console.log(sampleContractText.trim());

console.log('\n--- SCRUBBED OUTPUT ---');
console.log(result.scrubbedText.trim());

console.log('\n--- REDACTION STATS ---');
console.log(JSON.stringify(result.stats, null, 2));

// Assertions:
// 1. Names must be redacted
assert(!result.scrubbedText.includes('Alice Johnson'), 'Name "Alice Johnson" must NOT exist in scrubbed text');
assert(!result.scrubbedText.includes('Bob Smith'), 'Name "Bob Smith" must NOT exist in scrubbed text');

// 2. Dollar amounts must be redacted
assert(!result.scrubbedText.includes('$15,000.00'), 'Amount "$15,000.00" must NOT exist in scrubbed text');
assert(!result.scrubbedText.includes('25000 USD'), 'Amount "25000 USD" must NOT exist in scrubbed text');
assert(!result.scrubbedText.includes('$100,000'), 'Amount "$100,000" must NOT exist in scrubbed text');

// 3. Email and Phone must be redacted
assert(!result.scrubbedText.includes('alice.johnson@corporate-legal.com'), 'Email must NOT exist in scrubbed text');
assert(!result.scrubbedText.includes('555'), 'Phone number must NOT exist in scrubbed text');

// 4. SSN must be redacted
assert(!result.scrubbedText.includes('123-45-6789'), 'SSN must NOT exist in scrubbed text');

// 5. Total redactions count > 0
assert(result.stats.names >= 2, 'Should identify and redact at least 2 name occurrences');
assert(result.stats.currencies >= 3, 'Should identify and redact at least 3 currency occurrences');
assert(result.stats.emails >= 1, 'Should identify and redact at least 1 email');
assert(result.stats.phones >= 1, 'Should identify and redact at least 1 phone number');
assert(result.stats.identifiers >= 1, 'Should identify and redact SSN identifier');

// 6. Test simple helper scrubPII(text)
const simpleScrubbed = scrubPII('Payment of $50,000 to Mr. John Davis upon completion.');
assert(!simpleScrubbed.includes('$50,000'), 'simple scrubPII masks currency');
assert(!simpleScrubbed.includes('John Davis'), 'simple scrubPII masks name');

// 7. Edge Cases
const emptyScrub = scrubPIIWithDetails('');
assert(emptyScrub.scrubbedText === '', 'Empty string returns empty string');
assert(emptyScrub.stats.totalRedactions === 0, 'Empty string has 0 redactions');

const nullScrub = scrubPIIWithDetails(null as unknown as string);
assert(nullScrub.scrubbedText === '', 'Null input returns empty string');
assert(nullScrub.stats.totalRedactions === 0, 'Null input has 0 redactions');

const undefinedScrub = scrubPIIWithDetails(undefined as unknown as string);
assert(undefinedScrub.scrubbedText === '', 'Undefined input returns empty string');

// 8. False Positives Check
const falsePositiveText = "Party A and Party B agree to Section 5. I paid 500 apples. Call me at 555-XYZ-1234.";
const fpScrub = scrubPII(falsePositiveText);
assert(fpScrub.includes('Party A'), 'Should not redact generic "Party A"');
assert(fpScrub.includes('Section 5'), 'Should not redact "Section 5"');
assert(fpScrub.includes('500 apples'), 'Should not redact generic number "500 apples"');
assert(fpScrub.includes('555-XYZ-1234'), 'Should not redact invalid phone number format');

// 9. International Formats
const intlText = "Payment of £10,000 or €750.50 or ₹500,000. Call +44 20 7946 0958.";
const intlScrub = scrubPIIWithDetails(intlText);
assert(!intlScrub.scrubbedText.includes('£10,000'), 'Redacts UK Pound');
assert(!intlScrub.scrubbedText.includes('€750.50'), 'Redacts Euro');
assert(!intlScrub.scrubbedText.includes('₹500,000'), 'Redacts Indian Rupee');
assert(!intlScrub.scrubbedText.includes('+44 20 7946 0958'), 'Redacts UK Phone number');
assert(intlScrub.stats.currencies >= 3, 'Counts 3 international currencies');
assert(intlScrub.stats.phones >= 1, 'Counts 1 international phone');

console.log('\n🎉 ALL PII SCRUBBER TESTS PASSED SUCCESSFULLY!\n');
