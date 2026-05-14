// REQ-B4: Bulk edit grades page for cohort members
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import GradeGrid from '../../components/GradeGrid/GradeGrid';
import { getAccount } from '@schoolchoice/ui/api/account';
import client from '@schoolchoice/ui/api/client';
import { useTranslation } from '@schoolchoice/ui/i18n';

const SITTINGS = ['MOCK', 'TRIAL', 'OFFICIAL'];

function BulkEdit() {
  const { t } = useTranslation();  const { cohortId } = useParams();
  const [sitting, setSitting] = useState('MOCK');

  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: getAccount,
  });

  const { data: cohort, isLoading: cohortLoading } = useQuery({
    queryKey: ['cohort', cohortId],
    queryFn: () => client.get(`/api/v1/cohorts/${cohortId}`).then((r) => r.data),
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => client.get('/api/v1/grades/subjects').then((r) => r.data),
  });

  const members = cohort?.members ?? [];
  const memberIds = members.map((m) => m.id);

  const {
    data: gradesMap,
    isLoading: gradesLoading,
    refetch: refetchGrades,
  } = useQuery({
    queryKey: ['cohort-grades', cohortId, sitting, memberIds.join(',')],
    queryFn: async () => {
      if (memberIds.length === 0) return {};
      const results = {};
      await Promise.all(
        memberIds.map(async (studentId) => {
          try {
            const res = await client.get(
              `/api/v1/students/${studentId}/grades`,
              { params: { sitting } }
            );
            const grades = res.data?.grades ?? res.data ?? [];
            const gradesBySubject = {};
            for (const g of Array.isArray(grades) ? grades : []) {
              gradesBySubject[g.subject_code] = {
                id: g.id,
                raw_grade: g.raw_grade,
              };
            }
            results[studentId] = gradesBySubject;
          } catch {
            results[studentId] = {};
          }
        })
      );
      return results;
    },
    enabled: memberIds.length > 0,
  });

  const isLoading = cohortLoading || subjectsLoading || gradesLoading;

  // Build subjects list
  const subjects = (subjectsData ?? []).map((s) => ({
    id: s.id,
    code: s.code ?? s.subject_code,
    name: s.name ?? s.subject_name ?? s.code,
  }));

  // Build students list with grades
  const students = members.map((m) => ({
    id: m.id,
    name: m.full_name,
    grades: gradesMap?.[m.id] ?? {},
  }));

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

  const sittingBtnStyle = (active) => ({
    padding: 'var(--space-2) var(--space-4)',
    border: active
      ? '2px solid var(--color-primary)'
      : 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    background: active ? 'rgba(37,99,235,0.08)' : 'var(--color-surface)',
    color: active ? 'var(--color-primary)' : 'var(--color-text-primary)',
    fontWeight: active
      ? 'var(--font-weight-medium)'
      : 'var(--font-weight-normal)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-base)',
  });

  return (
    <div
      style={{
        background: 'var(--color-background)',
        minHeight: '100vh',
        fontFamily: 'var(--font-family-base)',
      }}
    >
      <NavBarV2 account={account} />
      <Link to={`/cohorts/${cohortId}`} style={backLinkStyle}>
        {t('bulkEdit.backToCohort')}
      </Link>

      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: 'var(--space-4) var(--space-8)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <h1
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {t('bulkEdit.title')}{cohort ? ` — ${cohort.name}` : ''}
          </h1>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {SITTINGS.map((s) => (
              <button
                key={s}
                onClick={() => setSitting(s)}
                style={sittingBtnStyle(s === sitting)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <LoadingSpinner label={t("bulkEdit.loading")} />}

        {!isLoading && students.length === 0 && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            No students in this cohort. Add students from the cohort detail
            page.
          </p>
        )}

        {!isLoading && students.length > 0 && subjects.length > 0 && (
          <GradeGrid
            students={students}
            subjects={subjects}
            sitting={sitting}
            onSaved={refetchGrades}
          />
        )}
      </div>
    </div>
  );
}

export default BulkEdit;
