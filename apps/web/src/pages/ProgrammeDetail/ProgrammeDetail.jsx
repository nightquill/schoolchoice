import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner, ErrorMessage } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getProgrammeStudents } from '../../api/jupas';

// Derive tier from flat admission_stats { median, upper_quartile, lower_quartile }
function getTierFromStats(stats) {
  if (!stats || stats.median == null) {
    return { label: 'Accessible', bg: '#eff6ff', color: '#1e40af' };
  }
  const m = Number(stats.median);
  if (m >= 28) return { label: 'Very Competitive', bg: '#fef2f2', color: '#dc2626' };
  if (m >= 24) return { label: 'Competitive', bg: '#fef3c7', color: '#92400e' };
  if (m >= 20) return { label: 'Moderate', bg: '#d1fae5', color: '#065f46' };
  return { label: 'Accessible', bg: '#eff6ff', color: '#1e40af' };
}

function matchColor(score) {
  if (score == null) return 'var(--color-text-secondary)';
  if (score >= 0.75) return '#059669';
  if (score >= 0.50) return '#a16207';
  return '#dc2626';
}

function EligibilityBadge({ eligible }) {
  const style = {
    display: 'inline-block',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: '600',
    background: eligible ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
    color: eligible ? '#059669' : '#dc2626',
    border: `1px solid ${eligible ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}`,
  };
  return <span style={style}>{eligible ? 'Eligible' : 'Ineligible'}</span>;
}

function StudentRow({ student }) {
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
      <td style={{ ...tdBase, fontWeight: '600', color: matchColor(student.match_score) }}>
        {matchPct}
      </td>
      <td style={tdBase}>{student.weighted_score != null ? student.weighted_score : '—'}</td>
      <td style={tdBase}>
        <EligibilityBadge eligible={student.eligible} />
      </td>
    </tr>
  );
}

function TierSection({ title, students, bgColor, textColor, defaultOpen = true }) {
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

  return (
    <div style={{ marginBottom: '16px', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={headerStyle}>
        <span style={labelStyle}>{title} — {students.length} student{students.length !== 1 ? 's' : ''}</span>
        {!defaultOpen && (
          <button
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
            {open ? 'hide' : 'show'}
          </button>
        )}
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-background)' }}>
              {['Name', 'Class', 'Match', 'Weighted Score', 'Eligibility'].map((h) => (
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
              <StudentRow key={s.student_id} student={s} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ProgrammeDetail() {
  const { schoolId, code } = useParams();
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
        setError(err?.response?.data?.detail || 'Failed to load programme data');
      })
      .finally(() => setLoading(false));
  }, [code]);

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
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
        <LoadingSpinner label="Loading programme…" />
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
            ← Back to school
          </Link>
        </div>
      </div>
    );
  }

  const { programme, students = [], total } = data || {};
  const stats = programme?.admission_stats || {};
  const minReq = programme?.minimum_requirements || {};
  const tier = getTierFromStats(stats);

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
        ← {programme?.institution_code || 'School'} / Programmes
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
        </div>
        <h1
          style={{
            margin: '0 0 6px 0',
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--color-text-primary)',
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

      <div style={{ padding: '24px 32px', maxWidth: '1100px' }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={cardStyle}>
            <div style={statNumStyle('#059669')}>{stats.median ?? '—'}</div>
            <div style={statLabelStyle}>Median Score</div>
          </div>
          <div style={cardStyle}>
            <div style={statNumStyle('#2563eb')}>{stats.upper_quartile ?? '—'}</div>
            <div style={statLabelStyle}>Upper Quartile</div>
          </div>
          <div style={cardStyle}>
            <div style={statNumStyle('#d97706')}>{stats.lower_quartile ?? '—'}</div>
            <div style={statLabelStyle}>Lower Quartile</div>
          </div>
          <div style={cardStyle}>
            <div style={statNumStyle('var(--color-text-primary)')}>{minReq.general || '—'}</div>
            <div style={statLabelStyle}>Min Requirement</div>
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
            Entry Requirements
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            {/* General */}
            {minReq.general && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                General: <strong style={{ color: 'var(--color-text-primary)' }}>{minReq.general}</strong>
              </div>
            )}
            {/* Required subjects */}
            {Object.keys(subjectSpecific).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Required:</span>
                {Object.entries(subjectSpecific).map(([subj, grade]) => (
                  <span
                    key={subj}
                    style={{
                      background: 'rgba(220,38,38,0.08)',
                      border: '1px solid rgba(220,38,38,0.2)',
                      borderRadius: '4px',
                      padding: '2px 7px',
                      fontSize: '12px',
                      color: '#dc2626',
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
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Preferred:</span>
                {preferredSubjects.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(37,99,235,0.08)',
                      border: '1px solid rgba(37,99,235,0.2)',
                      borderRadius: '4px',
                      padding: '2px 7px',
                      fontSize: '12px',
                      color: '#2563eb',
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
              }}
            >
              Your Students — Scored against this programme
            </h2>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {total ?? students.length} total
            </span>
          </div>

          <TierSection
            title="Strong Candidates"
            students={strong}
            bgColor="#f0fdf4"
            textColor="#059669"
            defaultOpen={true}
          />
          <TierSection
            title="Possible"
            students={possible}
            bgColor="#fefce8"
            textColor="#a16207"
            defaultOpen={true}
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
                  background: '#f8fafc',
                  borderRadius: stretchOpen ? '6px 6px 0 0' : '6px',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: '#64748b' }}>
                  Stretch — {stretch.length} student{stretch.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setStretchOpen((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    color: '#64748b',
                    padding: '0',
                  }}
                >
                  {stretchOpen ? 'hide' : 'show'}
                </button>
              </div>
              {stretchOpen && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-background)' }}>
                      {['Name', 'Class', 'Match', 'Weighted Score', 'Eligibility'].map((h) => (
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
                      <StudentRow key={s.student_id} student={s} />
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
                  No Grade Data — {noScore.length} student{noScore.length !== 1 ? 's' : ''}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-background)' }}>
                    {['Name', 'Class', 'Match', 'Weighted Score', 'Eligibility'].map((h) => (
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
                    <StudentRow key={s.student_id} student={s} />
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
              No students have been scored against this programme yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
