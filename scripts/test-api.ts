import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/analyze/route';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- RUNNING LEXAR API INTEGRATION TESTS ---');

async function createMockRequest(body: any, headers: Record<string, string> = {}) {
  const reqHeaders = new Headers(headers);
  return new NextRequest('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
  });
}

import * as fs from 'fs';
import * as path from 'path';

// Auto-load .env.local if not already present in environment
if (!process.env.GROQ_API_KEY) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          process.env[match[1]] = match[2]?.trim() || '';
        }
      }
    }
  } catch (e) {
    // Ignore error
  }
}

async function runTests() {
  // 1. Test empty text rejection
  let req = await createMockRequest({ text: '' });
  let res = await POST(req);
  assert(res.status === 400, 'Rejects empty text with 400');

  // 2. Test short text rejection
  req = await createMockRequest({ text: 'too short' });
  res = await POST(req);
  assert(res.status === 400, 'Rejects short text (< 10 chars) with 400');

  // 3. Test non-string rejection
  req = await createMockRequest({ text: 12345 });
  res = await POST(req);
  assert(res.status === 400, 'Rejects non-string input with 400');

  // 4. Test payload size limit
  req = await createMockRequest({ text: 'Valid text long enough' }, { 'content-length': '50001' });
  res = await POST(req);
  assert(res.status === 413, 'Rejects payload over 50KB with 413 Payload Too Large');

  // 5. Test live Groq AI analysis
  const legalText = `
    NON-DISCLOSURE AND INDEMNITY AGREEMENT
    1. Confidentiality: The Recipient shall hold and maintain the Confidential Information in strict confidence.
    2. Non-Compete: The Recipient shall not engage in any competitive enterprise for a period of 12 months following termination.
    3. Indemnification: The Recipient shall indemnify and hold harmless the Disclosing Party against unlimited liabilities, damages, and claims arising from any breach without any monetary cap.
  `;
  req = await createMockRequest({ text: legalText });
  res = await POST(req);
  assert(res.status === 200, 'Returns 200 for valid analysis request');
  
  const data = await res.json();
  assert(Array.isArray(data.clauses), 'Returns an array of clauses');
  assert(data.clauses.length >= 1, 'Extracted at least one clause');
  
  for (const clause of data.clauses) {
    assert(['RED', 'YELLOW', 'GREEN'].includes(clause.riskLevel), `Clause riskLevel is valid (${clause.riskLevel})`);
    assert(typeof clause.summary === 'string' && clause.summary.length > 0, 'Clause has a summary');
  }

  console.log(`\nProcessed ${data.clauses.length} clauses successfully. Summary: "${data.summary}"`);
  console.log('\n🎉 ALL API TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
