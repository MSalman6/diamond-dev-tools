export const BONUS_SCORE_CONFIG = {
  // Standardized score change values
  SCORE_CHANGES: {
    StandByBonus: 20,
    NoStandByPenalty: -15,
    NoKeyWritePenalty: -100,
    BadPerformancePenalty: -100
  },
  
  // Score boundaries
  BOUNDARIES: {
    MIN_SCORE: 1,
    MAX_SCORE: 1000
  }
} as const;

/**
 * Applies score boundaries to ensure scores stay within valid range
 * @param currentScore Current validator score
 * @param scoreChange Proposed score change
 * @returns Object with enforcedScore and actualChange
 */
export function enforceScoreBoundaries(currentScore: number, scoreChange: number): {
  enforcedScore: number;
  actualChange: number;
} {
  const proposedScore = currentScore + scoreChange;
  
  let enforcedScore: number;
  
  if (proposedScore < BONUS_SCORE_CONFIG.BOUNDARIES.MIN_SCORE) {
    enforcedScore = BONUS_SCORE_CONFIG.BOUNDARIES.MIN_SCORE;
  } else if (proposedScore > BONUS_SCORE_CONFIG.BOUNDARIES.MAX_SCORE) {
    enforcedScore = BONUS_SCORE_CONFIG.BOUNDARIES.MAX_SCORE;
  } else {
    enforcedScore = proposedScore;
  }
  
  const actualChange = enforcedScore - currentScore;
  
  return {
    enforcedScore,
    actualChange
  };
}

/**
 * Gets the standardized score change for a given reason
 * @param reason The bonus score change reason
 * @returns The standardized score change value
 */
export function getStandardizedScoreChange(reason: keyof typeof BONUS_SCORE_CONFIG.SCORE_CHANGES): number {
  return BONUS_SCORE_CONFIG.SCORE_CHANGES[reason];
}
