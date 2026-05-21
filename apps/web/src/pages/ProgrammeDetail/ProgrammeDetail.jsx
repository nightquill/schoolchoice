import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '@schoolchoice/ui/i18n';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner, ErrorMessage } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getProgrammeStudents } from '../../api/jupas';
import { getRequirementBadges } from '../../utils/requirementBadges';

// Derive tier from flat admission_stats { median, upper_quartile, lower_quartile }
function getTierFromStats(stats, t) {
  if (!stats || stats.median == null) {
    return { label: t('programmeDetail.accessible'), bg: 'var(--color-info-bg)', color: 'var(--color-info-text)' };
  }
  const m = Number(stats.median);
  if (m >= 28) return { label: t('programmeDetail.veryCompetitive'), bg: 'var(--color-error-bg)', color: 'var(--color-error-text)' };
  if (m >= 24) return { label: t('programmeDetail.competitive'), bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' };
  if (m >= 20) return { label: t('programmeDetail.moderate'), bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' };
  return { label: t('programmeDetail.accessible'), bg: 'var(--color-info-bg)', color: 'var(--color-info-text)' };
}

function matchColor(score) {
  if (score == null) return 'var(--color-text-secondary)';
  if (score >= 0.75) return 'var(--color-success)';
  if (score >= 0.50) return 'var(--color-warning)';
  return 'var(--color-error)';
}

function EligibilityBadge({ eligible, t }) {
  const style = {
    display: 'inline-block',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: '600',
    background: eligible ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
    color: eligible ? 'var(--color-success-text)' : 'var(--color-error-text)',
    border: `1px solid ${eligible ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
  };
  return <span style={style}>{eligible ? t('programmeDetail.eligible') : t('programmeDetail.ineligible')}</span>;
}

function StudentRow({ student, t }) {
  const matchPct = student.match_score != null ? Math.round(student.match_score * 100) + '%' : '—';
  const tdBase = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  };
  return (
    <tr>
      <td style={tdBase}>
        <Link
          to={`/students/${student.student_id}/profile`}
          style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
        >
          {student.student_name}
        </Link>
      </td>
      <td style={tdBase}>{student.class_name || '—'}</td>
      <td style={{ ...tdBase, fontWeight: '600', color: matchColor(student.match_score), fontVariantNumeric: 'tabular-nums' }}>
        {matchPct}
      </td>
      <td style={tdBase}>{student.weighted_score != null ? student.weighted_score : '—'}</td>
      <td style={tdBase}>
        <EligibilityBadge eligible={student.eligible} t={t} />
      </td>
    </tr>
  );
}

function TierSection({ title, students, bgColor, textColor, defaultOpen = true, t }) {
  const [open, setOpen] = useState(defaultOpen);

  if (students.length === 0) return null;

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: bgColor,
    borderRadius: '6px 6px 0 0',
    borderBottom: '1px solid var(--color-border)',
  };
  const labelStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: '600',
    color: textColor,
  };

  const columnHeaders = [
    t('programmeDetail.name'),
    t('programmeDetail.class'),
    t('programmeDetail.match'),
    t('programmeDetail.weightedScore'),
    t('programmeDetail.eligibility'),
  ];

  return (
    <div style={{ marginBottom: '16px', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={headerStyle}>
        <span style={labelStyle}>{title} — {students.length} {t('programmeDetail.students')}</span>
        {!defaultOpen && (
          <button
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              color: textColor,
              padding: '0',
            }}
          >
            {open ? t('programmeDetail.hide') : t('programmeDetail.show')}
          </button>
        )}
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-background)' }}>
              {columnHeaders.map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <StudentRow key={s.student_id} student={s} t={t} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ProgrammeDetail() {
  const { schoolId, code } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stretchOpen, setStretchOpen] = useState(false);

  useEffect(() => {
    Promise.all([getProgrammeStudents(code), getAccount()])
      .then(([programmeData, accountData]) => {
        setData(programmeData);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || t('programmeDetail.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [code]);

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100dvh',
    fontFamily: 'var(--font-family-base)',
  };

  const breadcrumbStyle = {
    padding: '12px 32px',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <NavBarV2 account={account} />
        <LoadingSpinner label={t('programmeDetail.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <NavBarV2 account={account} />
        <div style={{ padding: '24px 32px' }}>
          <ErrorMessage message={error} />
          <Link to={`/schools/${schoolId}`} style={{ ...breadcrumbStyle, padding: '8px 0' }}>
            {t('programmeDetail.backToSchool')}
          </Link>
        </div>
      </div>
    );
  }

  const { programme, students = [], total } = data || {};
  const stats = programme?.admission_stats || {};
  const minReq = programme?.minimum_requirements || {};
  const tier = getTierFromStats(stats, t);

  // Partition students
  const withScore = students.filter((s) => s.match_score != null);
  const noScore = students.filter((s) => s.match_score == null);
  const strong = withScore.filter((s) => s.match_score >= 0.75);
  const possible = withScore.filter((s) => s.match_score >= 0.5 && s.match_score < 0.75);
  const stretch = withScore.filter((s) => s.match_score < 0.5);

  // Entry requirements parsing
  const subjectSpecific = minReq.subject_specific || {};
  const preferredSubjects = minReq.preferred_subjects || [];

  const cardStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    flex: '1',
  };

  const statNumStyle = (color) => ({
    fontSize: '28px',
    fontWeight: '700',
    color,
    lineHeight: '1.1',
    marginBottom: '4px',
    fontVariantNumeric: 'tabular-nums',
  });

  const statLabelStyle = {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      {/* Breadcrumb */}
      <Link to={`/schools/${schoolId}`} style={breadcrumbStyle}>
        ← {programme?.institution_code || 'School'} / {t('programmeDetail.programmes')}
      </Link>

      {/* Header */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '20px 32px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          {/* JUPAS code badge */}
          <span
            style={{
              fontFamily: 'monospace',
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {programme?.jupas_code || code}
          </span>
          {/* Competitiveness tier badge */}
          <span
            style={{
              background: tier.bg,
              color: tier.color,
              borderRadius: '999px',
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            {tier.label}
          </span>
          {getRequirementBadges(programme?.non_grade_requirements).map((badge) => (
            <span key={badge.label} style={{ background: badge.bg, color: badge.color, borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }}>
              {badge.label}
            </span>
          ))}
        </div>
        <h1
          style={{
            margin: '0 0 6px 0',
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--color-text-primary)',
            textWrap: 'balance',
          }}
        >
          {programme?.name || code}
        </h1>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {programme?.faculty && <span>{programme.faculty}</span>}
          {programme?.faculty && programme?.institution_code && <span> · </span>}
          {programme?.institution_code && <span>{programme.institution_code}</span>}
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: '100%' }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={cardStyle}>
            <div style={statNumStyle('var(--color-success)')}>{stats.median ?? '—'}</div>
            <div style={statLabelStyle}>{t('programmeDetail.medianScore')}</div>
          </div>
          <div style={cardStyle}>
            <div style={statNumStyle('var(--color-primary)')}>{stats.upper_quartile ?? '—'}</div>
            <div style={statLabelStyle}>{t('programmeDetail.upperQuartile')}</div>
          </div>
          <div style={cardStyle}>
            <div style={statNumStyle('var(--color-warning)')}>{stats.lower_quartile ?? '—'}</div>
            <div style={statLabelStyle}>{t('programmeDetail.lowerQuartile')}</div>
          </div>
          <div style={cardStyle}>
            <div style={statNumStyle('var(--color-text-primary)')}>{minReq.general || '—'}</div>
            <div style={statLabelStyle}>{t('programmeDetail.minRequirement')}</div>
          </div>
        </div>

        {/* Entry Requirements card */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: 'var(--color-text-primary)',
              marginBottom: '10px',
            }}
          >
            {t('programmeDetail.entryRequirements')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            {/* General */}
            {minReq.general && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {t('programmeDetail.general')} <strong style={{ color: 'var(--color-text-primary)' }}>{minReq.general}</strong>
              </div>
            )}
            {/* Required subjects */}
            {Object.keys(subjectSpecific).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginRight: '4px' }}>{t('programmeDetail.required')}</span>
                {Object.entries(subjectSpecific).map(([subj, grade]) => (
                  <span
                    key={subj}
                    style={{
                      background: 'var(--color-error-bg)',
                      border: '1px solid var(--color-error-border)',
                      borderRadius: '4px',
                      padding: '2px 7px',
                      fontSize: '12px',
                      color: 'var(--color-error-text)',
                    }}
                  >
                    {subj} ≥ {grade}
                  </span>
                ))}
              </div>
            )}
            {/* Preferred subjects */}
            {preferredSubjects.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginRight: '4px' }}>{t('programmeDetail.preferred')}</span>
                {preferredSubjects.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'var(--color-info-bg)',
                      border: '1px solid var(--color-info-border)',
                      borderRadius: '4px',
                      padding: '2px 7px',
                      fontSize: '12px',
                      color: 'var(--color-info-text)',
                    }}
                  >
                    {typeof s === 'string' ? s : s.subject_code}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Student matches */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                color: 'var(--color-text-primary)',
                textWrap: 'balance',
              }}
            >
              {t('programmeDetail.yourStudents')}
            </h2>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {total ?? students.length} {t('programmeDetail.total')}
            </span>
          </div>

          <TierSection
            title={t('programmeDetail.strongCandidates')}
            students={strong}
            bgColor="var(--color-success-bg)"
            textColor="var(--color-success-text)"
            defaultOpen={true}
            t={t}
          />
          <TierSection
            title={t('programmeDetail.possible')}
            students={possible}
            bgColor="var(--color-warning-bg)"
            textColor="var(--color-warning-text)"
            defaultOpen={true}
            t={t}
          />

          {/* Stretch — collapsible */}
          {stretch.length > 0 && (
            <div style={{ marginBottom: '16px', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--color-background)',
                  borderRadius: stretchOpen ? '6px 6px 0 0' : '6px',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                  {t('programmeDetail.stretch')} — {stretch.length} {t('programmeDetail.students')}
                </span>
                <button
                  aria-expanded={stretchOpen}
                  onClick={() => setStretchOpen((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    padding: '0',
                  }}
                >
                  {stretchOpen ? t('programmeDetail.hide') : t('programmeDetail.show')}
                </button>
              </div>
              {stretchOpen && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-background)' }}>
                      {[t('programmeDetail.name'), t('programmeDetail.class'), t('programmeDetail.match'), t('programmeDetail.weightedScore'), t('programmeDetail.eligibility')].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stretch.map((s) => (
                      <StudentRow key={s.student_id} student={s} t={t} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* No Grade Data */}
          {noScore.length > 0 && (
            <div style={{ marginBottom: '16px', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--color-background)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                  {t('programmeDetail.noGradeData')} — {noScore.length} {t('programmeDetail.students')}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-background)' }}>
                    {[t('programmeDetail.name'), t('programmeDetail.class'), t('programmeDetail.match'), t('programmeDetail.weightedScore'), t('programmeDetail.eligibility')].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {noScore.map((s) => (
                    <StudentRow key={s.student_id} student={s} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {students.length === 0 && (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
              }}
            >
              {t('programmeDetail.noStudentsScored')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
