// REQ-095: School Profile Page
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { getSchoolV2 } from '../../api/schoolsV2';
import { getAllProgrammes } from '../../api/jupas';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { getCompetitivenessTier } from '../../utils/competitiveness';
import { getRequirementBadges } from '../../utils/requirementBadges';
import { useLocalizedName } from '../../utils/localizedName';

function SchoolProfile() {
  const { t } = useTranslation();
  const ln = useLocalizedName();
  const { id } = useParams();
  const [search, setSearch] = useState('');
  const [faculty, setFaculty] = useState('');

  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: getAccount,
  });

  const { data: school, isLoading: schoolLoading, error: schoolError } = useQuery({
    queryKey: ['school', id],
    queryFn: () => getSchoolV2(id),
    enabled: !!id,
  });

  const { data: programmesData, isLoading: programmesLoading } = useQuery({
    queryKey: ['jupas-all'],
    queryFn: getAllProgrammes,
    enabled: !!id,
  });

  const isLoading = schoolLoading || programmesLoading;
  const error = schoolError?.response?.data?.detail || (schoolError ? t('schoolProfile.loadFailed') : null);

  // Filter programmes for this school
  const allProgrammes = programmesData?.programmes ?? [];
  const schoolProgrammes = allProgrammes.filter((p) => p.school_id === id);

  // Unique faculties from school's programmes
  const faculties = [...new Set(schoolProgrammes.map((p) => p.faculty).filter(Boolean))].sort();

  // Apply search + faculty filters, then sort by jupas_code
  const filtered = schoolProgrammes
    .filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.name_zh && p.name_zh.toLowerCase().includes(q)) ||
        (p.jupas_code && p.jupas_code.toLowerCase().includes(q));
      const matchesFaculty = !faculty || p.faculty === faculty;
      return matchesSearch && matchesFaculty;
    })
    .sort((a, b) => (a.jupas_code ?? '').localeCompare(b.jupas_code ?? ''));

  // Styles
  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100dvh',
    fontFamily: 'var(--font-family-base)',
  };

  const heroStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-6) var(--space-8)',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 'var(--space-4)',
  };

  const schoolNameStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: '0 0 var(--space-1) 0',
    textWrap: 'balance',
  };

  const schoolNameZhStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-normal)',
    color: 'var(--color-text-secondary)',
    margin: '0 0 var(--space-3) 0',
  };

  const heroRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-4)',
    marginTop: 'var(--space-3)',
  };

  const metaRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
  };

  const typeBadgeStyle = {
    display: 'inline-block',
    background: 'var(--color-background)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
  };

  const metaTextStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const statsRowStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
  };

  const statCardBase = {
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-3) var(--space-4)',
    minWidth: '100px',
    textAlign: 'center',
  };

  const contentStyle = {
    padding: 'var(--space-6) var(--space-8)',
    maxWidth: '100%',
  };

  const headerRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-4)',
  };

  const h2Style = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
    textWrap: 'balance',
  };

  const filterRowStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
  };

  const inputStyle = {
    padding: 'var(--space-2) var(--space-3)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    width: '220px',
  };

  const selectStyle = {
    padding: 'var(--space-2) var(--space-3)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
  };

  const cardStackStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  };

  const cardLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: 'var(--space-3) var(--space-4)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  };

  const jupasCodeStyle = {
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-xs)',
    background: 'var(--color-background)',
    borderRadius: '4px',
    padding: '2px 8px',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minWidth: '64px',
    textAlign: 'center',
  };

  const progNameColStyle = {
    flex: 1,
    minWidth: 0,
  };

  const progNameStyle = {
    fontWeight: 'var(--font-weight-bold)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const facultyStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    display: 'block',
    marginTop: '2px',
  };

  const medianColStyle = {
    textAlign: 'center',
    minWidth: '64px',
    flexShrink: 0,
  };

  const medianValueStyle = {
    fontWeight: 'var(--font-weight-bold)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    display: 'block',
    fontVariantNumeric: 'tabular-nums',
  };

  const medianLabelStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
  };

  const tierBadgeBase = {
    display: 'inline-block',
    borderRadius: '999px',
    padding: '2px 10px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const arrowStyle = {
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-sm)',
    flexShrink: 0,
    marginLeft: 'auto',
  };

  const emptyStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    padding: 'var(--space-6) 0',
    textAlign: 'center',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      {isLoading && <LoadingSpinner label={t('schoolProfile.loading')} />}
      {error && (
        <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
          <ErrorMessage message={error} />
          <Link to="/schools" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>
            {t('schoolProfile.backToDirectory')}
          </Link>
        </div>
      )}

      {!isLoading && !error && school && (
        <>
          {/* Hero */}
          <div style={heroStyle}>
            <Link to="/schools" style={backLinkStyle}>← {t('schoolProfile.backToDirectory')}</Link>
            <h1 style={schoolNameStyle}>{school.name}</h1>
            {school.name_zh && <p style={schoolNameZhStyle}>{school.name_zh}</p>}

            <div style={heroRowStyle}>
              <div style={metaRowStyle}>
                {school.type && <span style={typeBadgeStyle}>{school.type}</span>}
                {school.location && <span style={metaTextStyle}>📍 {school.location}</span>}
                {school.website && (
                  <a
                    href={school.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none' }}
                  >
                    {t('schoolProfile.website')}
                  </a>
                )}
              </div>

              <div style={statsRowStyle}>
                <div style={{ ...statCardBase, background: 'var(--color-success-bg)' }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {school.acceptance_rate != null ? `${Math.round(school.acceptance_rate * 100)}%` : 'N/A'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success-text)', marginTop: '2px' }}>{t('schoolProfile.acceptanceRate')}</div>
                </div>
                <div style={{ ...statCardBase, background: 'var(--color-info-bg)' }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-info-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {school.average_admitted_score != null ? school.average_admitted_score : 'N/A'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-info-text)', marginTop: '2px' }}>{t('schoolProfile.avgAdmittedScore')}</div>
                </div>
                <div style={{ ...statCardBase, background: 'var(--color-purple-bg)' }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-purple-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {filtered.length}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-purple-text)', marginTop: '2px' }}>{t('schoolProfile.programs')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Programme list */}
          <div style={contentStyle}>
            <div style={headerRowStyle}>
              <h2 style={h2Style}>{t('schoolProfile.programs')}</h2>
              <div style={filterRowStyle}>
                <input
                  type="text"
                  placeholder={t('schoolProfile.searchProgrammes')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={inputStyle}
                  aria-label={t('schoolProfile.searchProgrammes')}
                />
                <select
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  style={selectStyle}
                  aria-label={t('schoolProfile.filterByFaculty')}
                >
                  <option value="">{t('schoolProfile.allFaculties')}</option>
                  {faculties.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p style={emptyStyle}>{t('schoolProfile.noProgrammesFound')}</p>
            ) : (
              <div style={cardStackStyle}>
                {filtered.map((prog) => {
                  const tier = getCompetitivenessTier(prog.admission_stats);
                  return (
                    <Link
                      key={prog.jupas_code}
                      to={`/schools/${id}/programmes/${prog.jupas_code}`}
                      style={cardLinkStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    >
                      <span style={jupasCodeStyle}>{prog.jupas_code}</span>

                      <div style={progNameColStyle}>
                        <span style={progNameStyle}>{ln(prog, 'name')}</span>
                        {prog.faculty && <span style={facultyStyle}>{prog.faculty}</span>}
                      </div>

                      <div style={medianColStyle}>
                        <span style={medianValueStyle}>{tier.median ?? '—'}</span>
                        <span style={medianLabelStyle}>{t('schoolProfile.median')}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', minWidth: '100px', justifyContent: 'flex-end' }}>
                        <span
                          style={{
                            ...tierBadgeBase,
                            background: tier.bg,
                            color: tier.color,
                          }}
                        >
                          {t(`programmeDetail.${tier.id === 'very_competitive' ? 'veryCompetitive' : tier.id}`)}
                        </span>
                        {getRequirementBadges(prog.non_grade_requirements, true).map((badge) => (
                          <span key={badge.label} style={{ ...tierBadgeBase, background: badge.bg, color: badge.color, fontSize: '10px' }}>
                            {badge.label}
                          </span>
                        ))}
                      </div>

                      <span style={arrowStyle}>→</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default SchoolProfile;
