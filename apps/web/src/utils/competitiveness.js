/**
 * Derive competitiveness tier from JUPAS programme admission_stats.
 * Uses latest-year median score.
 *
 * Thresholds (HKDSE best-5, max ~35):
 *   Very Competitive: median >= 28
 *   Competitive:      median 24-27.9
 *   Moderate:         median 20-23.9
 *   Accessible:       median < 20 or no data
 */

const TIERS = [
  { id: 'very_competitive', label: 'Very Competitive', min: 28, bg: '#fef2f2', color: '#dc2626' },
  { id: 'competitive',      label: 'Competitive',      min: 24, bg: '#fef3c7', color: '#92400e' },
  { id: 'moderate',          label: 'Moderate',          min: 20, bg: '#d1fae5', color: '#065f46' },
  { id: 'accessible',       label: 'Accessible',       min: 0,  bg: '#eff6ff', color: '#1e40af' },
];

export function getCompetitivenessTier(admissionStats) {
  // Default: accessible (no data)
  if (!admissionStats || typeof admissionStats !== 'object') {
    return { ...TIERS[3], median: null, uq: null, lq: null };
  }

  let stats = admissionStats;
  if (typeof stats === 'string') {
    try { stats = JSON.parse(stats); } catch { return { ...TIERS[3], median: null, uq: null, lq: null }; }
  }

  const years = Object.keys(stats).sort();
  if (years.length === 0) {
    return { ...TIERS[3], median: null, uq: null, lq: null };
  }

  const latest = stats[years[years.length - 1]];
  if (!latest || typeof latest !== 'object') {
    return { ...TIERS[3], median: null, uq: null, lq: null };
  }

  const median = latest.median != null ? Number(latest.median) : null;
  const uq = latest.upper_quartile != null ? Number(latest.upper_quartile) : null;
  const lq = latest.lower_quartile != null ? Number(latest.lower_quartile) : null;

  if (median == null) {
    return { ...TIERS[3], median, uq, lq };
  }

  const tier = TIERS.find(t => median >= t.min) || TIERS[3];
  return { ...tier, median, uq, lq };
}
