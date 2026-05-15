/**
 * Renders non-grade requirement badges for JUPAS programmes.
 * Returns array of {label, bg, color, icon} for compulsory requirements.
 */

const BADGE_CONFIG = {
  interview: {
    must: { label: 'Interview', bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
    selective: { label: 'Interview (selective)', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
    may_require: { label: 'Interview (may)', bg: 'var(--color-background)', color: 'var(--color-text-secondary)' },
  },
  portfolio: { label: 'Portfolio', bg: 'var(--color-purple-bg)', color: 'var(--color-purple-text)' },
  aptitude_test: { label: 'Aptitude Test', bg: 'var(--color-info-bg)', color: 'var(--color-info-text)' },
  audition: { label: 'Audition', bg: '#fce7f3', color: '#9d174d' },
};

/**
 * Get badges for a programme's non-grade requirements.
 * @param {object|null} reqs - non_grade_requirements JSON from API
 * @param {boolean} compulsoryOnly - if true, only return "must" interview + required portfolio/audition
 * @returns {Array<{label: string, bg: string, color: string}>}
 */
export function getRequirementBadges(reqs, compulsoryOnly = false) {
  if (!reqs) return [];

  let parsed = reqs;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }

  const badges = [];

  // Interview
  if (parsed.interview) {
    const cfg = BADGE_CONFIG.interview[parsed.interview];
    if (cfg) {
      if (!compulsoryOnly || parsed.interview === 'must') {
        badges.push(cfg);
      }
    }
  }

  // Portfolio
  if (parsed.portfolio) {
    badges.push(BADGE_CONFIG.portfolio);
  }

  // Aptitude test
  if (parsed.aptitude_test) {
    badges.push(BADGE_CONFIG.aptitude_test);
  }

  // Audition
  if (parsed.audition) {
    badges.push(BADGE_CONFIG.audition);
  }

  return badges;
}
