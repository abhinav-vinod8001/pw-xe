/**
 * Unit Tests: Contract Fairness Index Calculator
 */

import { calculateFairnessScore } from '../lib/fairnessScore';
import type { Clause } from '../lib/constants';

describe('Fairness Score Calculator', () => {
  it('should return a safe baseline for empty clauses', () => {
    const res = calculateFairnessScore([]);
    expect(res.overallScore).toBe(50);
    expect(res.grade).toBe('C');
    expect(res.verdict).toBe('Moderate Caution');
    expect(res.categories).toHaveLength(0);
  });

  it('should score an all-predatory contract as F / Predatory', () => {
    const predatoryClauses: Clause[] = [
      { text: 'Unlimited liability', riskLevel: 'RED', summary: 'Unlimited liability', category: 'Liability' },
      { text: 'All lifetime IP to client', riskLevel: 'RED', summary: 'Lifetime IP', category: 'Intellectual Property' },
      { text: '5 year global non-compete', riskLevel: 'RED', summary: 'Severe non-compete', category: 'Non-Compete' },
      { text: 'Immediate cancellation without pay', riskLevel: 'RED', summary: 'Unilateral termination', category: 'Termination' },
    ];

    const res = calculateFairnessScore(predatoryClauses);
    expect(res.overallScore).toBeLessThan(35);
    expect(['D', 'F']).toContain(res.grade);
    expect(res.verdict).toBe('Predatory Agreement');
    expect(res.redFlagCount).toBe(4);
  });

  it('should score a balanced agreement with Grade A or A+', () => {
    const balancedClauses: Clause[] = [
      { text: 'Mutual confidentiality', riskLevel: 'GREEN', summary: 'Mutual confidentiality', category: 'Confidentiality' },
      { text: 'Standard severability', riskLevel: 'GREEN', summary: 'Severability', category: 'General' },
      { text: 'Standard 30-day notice', riskLevel: 'GREEN', summary: 'Standard notice', category: 'Termination' },
    ];

    const res = calculateFairnessScore(balancedClauses);
    expect(res.overallScore).toBeGreaterThanOrEqual(80);
    expect(['A', 'A+']).toContain(res.grade);
    expect(res.standardCount).toBe(3);
  });

  it('should categorize legal pillars accurately', () => {
    const mixedClauses: Clause[] = [
      { text: 'Contractor indemnifies client', riskLevel: 'RED', summary: 'Indemnity', category: 'Indemnification' },
      { text: 'Client owns project inventions', riskLevel: 'GREEN', summary: 'Project IP', category: 'Intellectual Property' },
      { text: 'Swiss arbitration', riskLevel: 'YELLOW', summary: 'Foreign arbitration', category: 'Dispute Resolution' },
    ];

    const res = calculateFairnessScore(mixedClauses);
    const categoryNames = res.categories.map(c => c.category);
    expect(categoryNames).toContain('Liability & Indemnity');
    expect(categoryNames).toContain('Intellectual Property');
    expect(categoryNames).toContain('Dispute Resolution');
  });
});
