import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRADE_TO_NUM = { '5**': 7, '5*': 6, '5': 5, '4': 4, '3': 3, '2': 2, '1': 1, 'U': 0, 'A': 6, 'B': 4, 'C': 3 };

function gradeToNum(grade) {
  if (!grade) return 0;
  return GRADE_TO_NUM[grade] ?? (typeof grade === 'number' ? grade : 0);
}

/**
 * Radar chart comparing student grades vs Band A benchmark.
 * @param {object} props
 * @param {object} props.gradesByCode — { MATH: '5*', PHYS: '5', ... }
 * @param {object} props.benchmarkByCode — { MATH: 6.2, PHYS: 5.5, ... } (numeric, from admission_stats median)
 * @param {string[]} props.subjects — subject codes to show
 */
export default function PlanRadarChart({ gradesByCode, benchmarkByCode, subjects }) {
  const { t } = useTranslation();

  if (!subjects || subjects.length < 3) return null;

  const data = subjects.map(code => {
    const translated = t(`subjects.${code}`);
    return {
      subject: translated !== `subjects.${code}` ? translated : code,
      student: gradeToNum(gradesByCode?.[code]),
      benchmark: benchmarkByCode?.[code] ?? 0,
    };
  });

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)' }}>
      <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
        {t('plan.academicStrengths')}
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fontWeight: 500 }} />
          <PolarRadiusAxis angle={90} domain={[0, 7]} tick={{ fontSize: 11 }} tickCount={8} />
          <Radar name={t('plan.yourGrades')} dataKey="student" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} strokeWidth={2} />
          <Radar name={t('plan.bandABenchmark')} dataKey="benchmark" stroke="var(--color-error)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
