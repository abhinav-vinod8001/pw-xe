/**
 * Contract Fairness Index Calculator
 * 
 * Computes a standardized 0–100 contract fairness score, sub-category health ratings,
 * benchmark percentiles, and actionable risk verdicts based on identified clauses.
 */

import type { Clause, RiskLevel } from './constants';

export interface CategoryScore {
  category: string;
  score: number; // 0 to 100
  status: 'safe' | 'caution' | 'danger';
  count: number;
}

export interface FairnessAssessment {
  overallScore: number; // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  verdict: 'Excellent Balance' | 'Standard & Fair' | 'Moderate Caution' | 'Unfavorable Terms' | 'Predatory Agreement';
  summary: string;
  industryBenchmark: string;
  categories: CategoryScore[];
  redFlagCount: number;
  reviewCount: number;
  standardCount: number;
}

/**
 * Calculates contract fairness assessment
 */
export function calculateFairnessScore(clauses: Clause[]): FairnessAssessment {
  if (!clauses || clauses.length === 0) {
    return {
      overallScore: 50,
      grade: 'C',
      verdict: 'Moderate Caution',
      summary: 'No recognized clauses were analyzed to generate a definitive score.',
      industryBenchmark: 'Insufficient data for benchmark comparison.',
      categories: [],
      redFlagCount: 0,
      reviewCount: 0,
      standardCount: 0,
    };
  }

  const redClauses = clauses.filter(c => c.riskLevel === 'RED');
  const yellowClauses = clauses.filter(c => c.riskLevel === 'YELLOW');
  const greenClauses = clauses.filter(c => c.riskLevel === 'GREEN');

  // Baseline calculation: Start at 100
  // Each RED clause deducts 22 points (heavy penalty)
  // Each YELLOW clause deducts 9 points (moderate penalty)
  // Each GREEN clause adds 3 points back (cushions balance)
  let score = 100;
  score -= redClauses.length * 22;
  score -= yellowClauses.length * 9;
  score += Math.min(10, greenClauses.length * 3);

  // Clamp score strictly between 5 and 99
  let overallScore = Math.max(5, Math.min(99, Math.round(score)));

  // CRITICAL FIX: A single RED toxic clause makes the contract inherently dangerous.
  // Cap the maximum score at 64 (Grade C) if any RED clauses exist.
  // If multiple RED clauses exist, cap it at 44 (Grade D).
  if (redClauses.length >= 2 && overallScore > 44) {
    overallScore = 44;
  } else if (redClauses.length === 1 && overallScore > 64) {
    overallScore = 64;
  }

  // Determine Grade & Verdict
  let grade: FairnessAssessment['grade'] = 'F';
  let verdict: FairnessAssessment['verdict'] = 'Predatory Agreement';
  let summary = '';
  let industryBenchmark = '';

  if (overallScore >= 90) {
    grade = 'A+';
    verdict = 'Excellent Balance';
    summary = 'This agreement contains fair, mutual terms with standard industry protections.';
    industryBenchmark = 'Top 10% — Significantly safer than standard freelance contracts.';
  } else if (overallScore >= 80) {
    grade = 'A';
    verdict = 'Standard & Fair';
    summary = 'Terms are largely balanced with few minor clauses requiring standard review.';
    industryBenchmark = 'Safer than 75% of commercial agreements in this category.';
  } else if (overallScore >= 65) {
    grade = 'B';
    verdict = 'Moderate Caution';
    summary = 'Contains several terms requiring clarification and negotiation before signing.';
    industryBenchmark = 'Average commercial contract. In line with 50% of market terms.';
  } else if (overallScore >= 45) {
    grade = 'C';
    verdict = 'Unfavorable Terms';
    summary = 'Weighted substantially toward the counterparty. Multiple terms pose financial or legal risks.';
    industryBenchmark = 'More restrictive than 70% of standard contractor agreements.';
  } else if (overallScore >= 25) {
    grade = 'D';
    verdict = 'Predatory Agreement';
    summary = 'Contains dangerous, highly one-sided provisions (e.g. uncapped liability, severe non-competes).';
    industryBenchmark = 'More hazardous than 88% of reviewed contracts. Renegotiation mandatory.';
  } else {
    grade = 'F';
    verdict = 'Predatory Agreement';
    summary = 'Extreme high-risk terms identified. Signing without comprehensive redlines is strongly advised against.';
    industryBenchmark = 'Bottom 3% — Draconian and predatory terms present.';
  }

  // Calculate Category Breakdowns
  const categoryGroups: { [key: string]: Clause[] } = {};
  for (const c of clauses) {
    const rawCat = c.category?.trim() || 'General Terms';
    // Normalize into broad legal pillars
    let pillar = 'General Provisions';
    if (/liab|indemn/i.test(rawCat)) pillar = 'Liability & Indemnity';
    else if (/intellect|ip|patent|invent/i.test(rawCat)) pillar = 'Intellectual Property';
    else if (/compete|solicit|restrict/i.test(rawCat)) pillar = 'Restraints & Non-Compete';
    else if (/terminat|cancel/i.test(rawCat)) pillar = 'Termination & Exit';
    else if (/pay|fee|compens/i.test(rawCat)) pillar = 'Payment & Fees';
    else if (/dispute|arbitr|govern|law/i.test(rawCat)) pillar = 'Dispute Resolution';

    if (!categoryGroups[pillar]) categoryGroups[pillar] = [];
    categoryGroups[pillar].push(c);
  }

  const categories: CategoryScore[] = Object.entries(categoryGroups).map(([pillar, items]) => {
    let catScore = 100;
    const catRed = items.filter(c => c.riskLevel === 'RED').length;
    const catYellow = items.filter(c => c.riskLevel === 'YELLOW').length;
    catScore -= catRed * 35;
    catScore -= catYellow * 15;
    catScore = Math.max(10, Math.min(100, catScore));

    const status: 'safe' | 'caution' | 'danger' = catScore < 50 ? 'danger' : catScore < 75 ? 'caution' : 'safe';

    return {
      category: pillar,
      score: catScore,
      status,
      count: items.length,
    };
  }).sort((a, b) => a.score - b.score);

  return {
    overallScore,
    grade,
    verdict,
    summary,
    industryBenchmark,
    categories,
    redFlagCount: redClauses.length,
    reviewCount: yellowClauses.length,
    standardCount: greenClauses.length,
  };
}
