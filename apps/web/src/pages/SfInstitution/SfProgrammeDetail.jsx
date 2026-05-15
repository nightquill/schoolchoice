// Self-financing Programme Detail — separate from JUPAS ProgrammeDetail
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSfProgrammeStudents } from '../../api/selfFinancing';

const LEVEL_LABELS = {
  associate_degree: 'Associate Degree',
  higher_diploma: 'Higher Diploma',
  diploma: 'Diploma',
  self_financing_degree: 'Self-financing Degree',
};

export default function SfProgrammeDetail() {
  const { code, progId } = useParams();
  const [stretchOpen, setStretchOpen] = useState(false);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const progQuery = useQuery({
    queryKey: ['sf-prog-students', progId],
    queryFn: () => getSfProgrammeStudents(progId),
  });

  const account = accountQuery.data ?? null;
  const data = progQuery.data;
  const prog = data?.programme;
  const students = data?.students ?? [];

  const strong = students.filter(s => s.match_score != null && s.match_score >= 0.75);
  const possible = students.filter(s => s.match_score != null && s.match_score >= 0.50 && s.match_score < 0.75);
  const stretch = students.filter(s => s.match_score != null && s.match_score < 0.50);
  const noData = students.filter(s => s.match_score == null);

  const thStyle = { padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' };
  const tdStyle = { padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', verticalAlign: 'middle' };

  const renderStudentRows = (list) => list.map(s => (
    <tr key={s.student_id}>
      <td style={tdStyle}>
        <Link to={`/students/${s.student_id}/profile`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'var(--font-weight-medium)' }}>
          {s.student_name}
        </Link>
      </td>
      <td style={tdStyle}>{s.class_name}</td>
      <td style={tdStyle}>
        {s.match_score != null ? (
          <span style={{ fontWeight: 'var(--font-weight-bold)', color: s.match_score >= 0.75 ? '#059669' : s.match_score >= 0.50 ? '#d97706' : '#dc2626' }}>
            {Math.round(s.match_score * 100)}%
          </span>
        ) : '—'}
      </td>
      <td style={tdStyle}>{s.best5_score ?? '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        {s.eligible === true && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Eligible</span>}
        {s.eligible === false && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Ineligible</span>}
      </td>
    </tr>
  ));

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-4) var(--space-6)' }}>
        <Link to={`/sf/${code}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 'var(--font-size-sm)' }}>
          ← {prog?.institution_code || code} / Programmes
        </Link>

        {progQuery.isLoading && <LoadingSpinner label="Loading..." />}
        {progQuery.error && <ErrorMessage message="Programme not found" />}

        {prog && (
          <>
            {/* Header */}
            <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  {LEVEL_LABELS[prog.level] ?? prog.level}
                </span>
                {prog.programme_code && (
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 'var(--font-size-xs)', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                    {prog.programme_code}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                {prog.name}
              </h1>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {prog.faculty && `${prog.faculty} · `}{prog.institution_name}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: 'MEAN SCORE', value: prog.admission_score_mean, color: '#059669' },
                { label: 'UPPER QUARTILE', value: prog.admission_score_uq, color: '#2563eb' },
                { label: 'LOWER QUARTILE', value: prog.admission_score_lq, color: '#d97706' },
                { label: 'HIGHEST', value: prog.admission_score_highest, color: '#0f172a' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: '1 1 120px', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value ?? '—'}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px', letterSpacing: '0.5px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Students */}
            <div style={{ background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                  Your Students — Scored against this programme
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{data.total} total</span>
              </div>

              {/* Strong */}
              {strong.length > 0 && (
                <>
                  <div style={{ padding: 'var(--space-2) var(--space-4)', background: '#f0fdf4', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#059669', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Strong Candidates — {strong.length} students</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Class</th><th style={thStyle}>Match</th><th style={thStyle}>Best 5</th><th style={{ ...thStyle, textAlign: 'right' }}>Eligibility</th></tr></thead>
                    <tbody>{renderStudentRows(strong)}</tbody>
                  </table>
                </>
              )}

              {/* Possible */}
              {possible.length > 0 && (
                <>
                  <div style={{ padding: 'var(--space-2) var(--space-4)', background: '#fefce8', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#a16207', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Possible — {possible.length} students</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Class</th><th style={thStyle}>Match</th><th style={thStyle}>Best 5</th><th style={{ ...thStyle, textAlign: 'right' }}>Eligibility</th></tr></thead>
                    <tbody>{renderStudentRows(possible)}</tbody>
                  </table>
                </>
              )}

              {/* Stretch */}
              {stretch.length > 0 && (
                <>
                  <div
                    style={{ padding: 'var(--space-2) var(--space-4)', background: '#f8fafc', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#64748b', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setStretchOpen(!stretchOpen)}
                  >
                    <span>Stretch — {stretch.length} students</span>
                    <span style={{ textDecoration: 'underline' }}>{stretchOpen ? 'hide' : 'show'}</span>
                  </div>
                  {stretchOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Class</th><th style={thStyle}>Match</th><th style={thStyle}>Best 5</th><th style={{ ...thStyle, textAlign: 'right' }}>Eligibility</th></tr></thead>
                      <tbody>{renderStudentRows(stretch)}</tbody>
                    </table>
                  )}
                </>
              )}

              {/* No data */}
              {noData.length > 0 && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', borderTop: 'var(--border-width) solid var(--color-border)' }}>
                  {noData.length} student(s) with no grade data
                </div>
              )}
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
              Scores are best-5 HKDSE subjects · Source: {prog.data_source || 'CSPE/iPASS'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
