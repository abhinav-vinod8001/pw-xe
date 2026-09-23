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

  // 5. Test mock fallback classification
  const mockText = "This agreement contains a non-compete clause. It also has a limitation of liability to the amount paid. This is a very standard and customary boilerplate legal clause used often.";
  req = await createMockRequest({ text: mockText });
  res = await POST(req);
  assert(res.status === 200, 'Returns 200 for valid analysis request');
  
  const data = await res.json();
  assert(Array.isArray(data.clauses), 'Returns an array of clauses');
  
  // High risk should be found (non-compete)
  const redClauses = data.clauses.filter((c: any) => c.riskLevel === 'RED');
  assert(redClauses.length >= 1, 'Correctly identifies RED (high-risk) clauses');

  // Moderate risk should be found (limits liability)
  const yellowClauses = data.clauses.filter((c: any) => c.riskLevel === 'YELLOW');
  assert(yellowClauses.length >= 1, 'Correctly identifies YELLOW (moderate-risk) clauses');

  // Standard clause should be found (boilerplate)
  const greenClauses = data.clauses.filter((c: any) => c.riskLevel === 'GREEN');
  assert(greenClauses.length >= 1, 'Correctly identifies GREEN (standard) clauses');

  console.log('\n🎉 ALL API TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
