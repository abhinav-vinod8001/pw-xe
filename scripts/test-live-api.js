const fs = require('fs');

async function testApi() {
  const text = `MUTUAL NON-DISCLOSURE AGREEMENT
This Mutual Non-Disclosure Agreement ("Agreement") is entered into on September 25, 2026, by and between:
PARTY A Elena Rodriguez
1204 Pine Street, Seattle, WA
Phone: 555-019-8822
PARTY B David Chen
8803 Maple Avenue, Portland, OR
Phone: 555-014-7731
1. PURPOSE OF AGREEMENT
Both parties wish to explore a potential business collaboration (the "Purpose"). During these discussions, it may
be necessary for either party to share proprietary or confidential information with the other.
2. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any data, business plans, or technical specifications disclosed by one party to
the other that is explicitly marked as "Confidential" or would reasonably be understood to be confidential.
3. MUTUAL OBLIGATIONS
Each party agrees to protect the other party's Confidential Information with the same degree of care it uses to
protect its own similar information, but in no event less than a reasonable standard of care. Neither party shall
use the information for any purpose outside of the stated Purpose.
4. STANDARD EXCLUSIONS
Confidential Information does not include information that: (a) is or becomes publicly known through no fault of
the receiving party; (b) was already in the receiving party's possession prior to disclosure; or (c) is independently
developed by the receiving party without using the disclosed information.
5. TERM AND DURATION
This Agreement shall remain in effect for one (1) year from the effective date. The obligation to protect
Confidential Information disclosed during this period shall survive for two (2) years following the termination of
this Agreement.
6. RETURN OR DESTRUCTION OF MATERIALS
Upon written request by the disclosing party, the receiving party shall promptly return or securely destroy all
copies of the Confidential Information and provide written certification of such destruction.
7. NO FURTHER OBLIGATION
Nothing in this Agreement obligates either party to proceed with any business transaction, partnership, or further
agreement. Each party bears its own costs incurred during these preliminary discussions.
SIGNATURES
Party A Signature:
Date:
Party B Signature:
Date:`;

  const res = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      mode: 'pdf'
    })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

testApi();
