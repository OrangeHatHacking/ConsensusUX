import { describe, it, expect } from 'vitest';
import { calculateProposalScore, getProposalSection } from './scoring';
import type { Judgment } from './types';

function makeJudgment(overrides: Partial<Judgment> & Pick<Judgment, 'type' | 'value'>): Judgment {
  return {
    id: 'j-1',
    messageId: 'm-1',
    judgeId: 'u-1',
    reasoningCiphertext: 'encrypted-test-reasoning',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('calculateProposalScore', () => {
  it('returns zero scores for empty judgments', () => {
    const score = calculateProposalScore([]);
    expect(score.greenScore).toBe(0);
    expect(score.redScore).toBe(0);
    expect(score.judgmentCount).toBe(0);
  });

  it('scores a single binary thumbs up', () => {
    const judgments = [makeJudgment({ type: 'binary', value: 1 })];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBe(1);
    expect(score.redScore).toBe(0);
    expect(score.judgmentCount).toBe(1);
  });

  it('scores a single binary thumbs down', () => {
    const judgments = [makeJudgment({ type: 'binary', value: 0 })];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBe(0);
    expect(score.redScore).toBe(1);
  });

  it('normalises mixed binary judgments', () => {
    const judgments = [
      makeJudgment({ type: 'binary', value: 1, judgeId: 'u-1' }),
      makeJudgment({ type: 'binary', value: 1, judgeId: 'u-2' }),
      makeJudgment({ type: 'binary', value: 0, judgeId: 'u-3' }),
    ];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBeCloseTo(2 / 3);
    expect(score.redScore).toBeCloseTo(1 / 3);
    expect(score.judgmentCount).toBe(3);
  });

  it('maps degree 1 to green 1.0', () => {
    const judgments = [makeJudgment({ type: 'degrees', value: 1 })];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBe(1.0);
    expect(score.redScore).toBe(0);
  });

  it('maps degree 5 to green 0.2', () => {
    const judgments = [makeJudgment({ type: 'degrees', value: 5 })];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBeCloseTo(0.2);
    expect(score.redScore).toBe(0);
  });

  it('maps degree 6 to red 0.2', () => {
    const judgments = [makeJudgment({ type: 'degrees', value: 6 })];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBe(0);
    expect(score.redScore).toBeCloseTo(0.2);
  });

  it('maps degree 10 to red 1.0', () => {
    const judgments = [makeJudgment({ type: 'degrees', value: 10 })];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBe(0);
    expect(score.redScore).toBe(1.0);
  });

  it('normalises mixed degrees judgments', () => {
    const judgments = [
      makeJudgment({ type: 'degrees', value: 1, judgeId: 'u-1' }),
      makeJudgment({ type: 'degrees', value: 10, judgeId: 'u-2' }),
    ];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBeCloseTo(0.5);
    expect(score.redScore).toBeCloseTo(0.5);
  });

  it('handles mixed binary and degrees', () => {
    const judgments = [
      makeJudgment({ type: 'binary', value: 1, judgeId: 'u-1' }),
      makeJudgment({ type: 'degrees', value: 8, judgeId: 'u-2' }),
    ];
    const score = calculateProposalScore(judgments);
    expect(score.greenScore).toBeCloseTo(0.5);
    expect(score.redScore).toBeCloseTo(0.3);
  });

  it('preserves chain depth', () => {
    const score = calculateProposalScore([], 3);
    expect(score.chainDepth).toBe(3);
  });
});

describe('getProposalSection', () => {
  it('returns pending when no judgments', () => {
    const score = calculateProposalScore([]);
    score.messageId = 'm-1';
    expect(getProposalSection(score)).toBe('pending');
  });

  it('returns green when redScore < 1.0', () => {
    const score = calculateProposalScore([
      makeJudgment({ type: 'binary', value: 1 }),
    ]);
    score.messageId = 'm-1';
    expect(getProposalSection(score)).toBe('green');
  });

  it('returns red when redScore >= 1.0', () => {
    const score = calculateProposalScore([
      makeJudgment({ type: 'binary', value: 0 }),
    ]);
    score.messageId = 'm-1';
    expect(getProposalSection(score)).toBe('red');
  });

  it('returns red when all judgments are strong dissent', () => {
    const judgments = [
      makeJudgment({ type: 'degrees', value: 10, judgeId: 'u-1' }),
      makeJudgment({ type: 'degrees', value: 10, judgeId: 'u-2' }),
    ];
    const score = calculateProposalScore(judgments);
    score.messageId = 'm-1';
    expect(getProposalSection(score)).toBe('red');
  });

  it('returns green for mild dissent (not enough to cross threshold)', () => {
    const judgments = [
      makeJudgment({ type: 'degrees', value: 1, judgeId: 'u-1' }),
      makeJudgment({ type: 'degrees', value: 6, judgeId: 'u-2' }),
    ];
    const score = calculateProposalScore(judgments);
    score.messageId = 'm-1';
    expect(getProposalSection(score)).toBe('green');
  });
});
