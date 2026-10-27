import type { Judgment, ProposalScore } from './types';

/**
 * Calculate the green_score and red_score for a proposal based on its judgments.
 *
 * Score mapping (degrees 1-10):
 *   1 → green 1.0    6 → red 0.2
 *   2 → green 0.8    7 → red 0.4
 *   3 → green 0.6    8 → red 0.6
 *   4 → green 0.4    9 → red 0.8
 *   5 → green 0.2   10 → red 1.0
 *
 * Binary: up = green +1, down = red +1
 *
 * Ordering rules:
 *   red_score >= 1.0 → red section (higher red = less visible)
 *   red_score < 1.0  → green section (higher green = more visible)
 */

function validateJudgment(j: Judgment): void {
  if (j.type === 'binary') {
    if (j.value !== 0 && j.value !== 1) {
      throw new RangeError(`Binary judgment value must be 0 or 1, got ${j.value}`);
    }
  } else {
    if (!Number.isInteger(j.value) || j.value < 1 || j.value > 10) {
      throw new RangeError(`Degrees judgment value must be integer 1-10, got ${j.value}`);
    }
  }
}

export function calculateProposalScore(
  judgments: Judgment[],
  chainDepth: number = 0,
): ProposalScore {
  let greenScore = 0;
  let redScore = 0;

  for (const j of judgments) {
    validateJudgment(j);

    if (j.type === 'binary') {
      if (j.value === 1) greenScore += 1;
      else redScore += 1;
    } else {
      if (j.value <= 5) {
        greenScore += (6 - j.value) / 5;
      } else {
        redScore += (j.value - 5) / 5;
      }
    }
  }

  const total = judgments.length || 1;

  return {
    messageId: '',
    greenScore: greenScore / total,
    redScore: redScore / total,
    judgmentCount: judgments.length,
    chainDepth,
    lastUpdated: new Date(),
  };
}

/**
 * Determine which section a proposal belongs to in the output chat.
 */
export function getProposalSection(score: ProposalScore): 'green' | 'red' | 'pending' {
  if (score.judgmentCount === 0) return 'pending';
  if (score.redScore >= 1.0) return 'red';
  return 'green';
}
