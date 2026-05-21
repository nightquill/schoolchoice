// REQ-094: School Directory Page
import { useState, useEffect, useCallback } from 'react';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import SchoolCard from '../../components/SchoolCard/SchoolCard';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchSchools } from '../../api/schoolsV2';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSfInstitutions } from '../../api/selfFinancing';
import { useTranslation } from '@schoolchoice/ui/i18n';

const LIMIT = 20;

function SchoolDirectory() {
  const { t } = useTranslation();
  const [account, setAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('jupas'); // 'jupas' | 'sf'
  const [schools, setSchools] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAccount().then(setAccount).catch(() => {});
    fetchSchools(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSchools = useCallback(async (pageNum) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: LIMIT,
        offset: (pageNum - 1) * LIMIT,
      };
      const result = await searchSchools(params);
      const items = Array.isArray(result) ? result : (result.items ?? []);
      const count = result.total ?? items.length;
      setSchools(items);
      setTotal(count);
      setPage(pageNum);
    } catch (err) {
      setError(err?.response?.data?.detail || t('schools.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    padding: 'var(--space-6) var(--space-8)',
  };

  const countStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-4)',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 'var(--space-6)',
    marginBottom: 'var(--space-6)',
  };

  const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    justifyContent: 'center',
    padding: 'var(--space-4) 0',
  };

  const pageIndicatorStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const tabStyle = (isActive) => ({
    padding: 'var(--space-2) var(--space-5)',
    background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
    color: isActive ? '#fff' : 'var(--color-text-secondary)',
    border: `var(--border-width) solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
    borderRadius: 0,
    transition: 'all 0.15s',
  });

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      {/* JUPAS / Self-financing tab switcher */}
      <div style={{
        background: 'var(--color-surface)',
        borderBottom: 'var(--border-width) solid var(--color-border)',
        padding: 'var(--space-4) var(--space-8)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
          {t('schools.directoryTitle')}
        </h1>
        <div style={{ display: 'flex', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', marginLeft: 'auto' }}>
          <button type="button" onClick={() => setActiveTab('jupas')} style={{ ...tabStyle(activeTab === 'jupas'), borderRadius: 'var(--border-radius-sm) 0 0 var(--border-radius-sm)' }}>
            {t('schools.jupasTab')}
          </button>
          <button type="button" onClick={() => setActiveTab('sf')} style={{ ...tabStyle(activeTab === 'sf'), borderRadius: '0 var(--border-radius-sm) var(--border-radius-sm) 0' }}>
            {t('schools.sfTab')}
          </button>
        </div>
      </div>

      <main id="main-content" style={contentStyle}>
        {activeTab === 'jupas' && (
          <>
            {loading && <LoadingSpinner label={t("schools.searching")} />}
            {error && <ErrorMessage message={error} />}

            {!loading && !error && (
              <>
                <p style={countStyle}>
                  {t('schools.showing', { count: schools.length, total })}
                </p>
                {schools.length === 0 ? (
                  <EmptyState message={t('schools.noMatch')} />
                ) : (
                  <div style={gridStyle} role="list" aria-label="School results">
                    {schools.map((school) => (
                      <div key={school.id} role="listitem">
                        <SchoolCard school={school} />
                      </div>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div style={paginationStyle} role="navigation" aria-label="Pagination">
                    <Button variant="outline" disabled={page <= 1} onClick={() => fetchSchools(page - 1)}>
                      {t('schools.previous')}
                    </Button>
                    <span style={pageIndicatorStyle}>{t('schools.pageOf', { page, total: totalPages })}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => fetchSchools(page + 1)}>
                      {t('schools.next')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'sf' && <SfInstitutionsSection />}
      </main>
    </div>
  );
}

function SfInstitutionsSection() {
  const { t } = useTranslation();
  const sfQuery = useQuery({ queryKey: ['sf-institutions'], queryFn: getSfInstitutions, staleTime: 60000 });
  const institutions = sfQuery.data?.institutions ?? [];

  if (sfQuery.isLoading || institutions.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '2px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
          {t('schools.sfTitle')}
        </h2>
        <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
          {t('schools.sfBadge')}
        </span>
      </div>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4)' }}>
        {t('schools.sfDesc')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {institutions.map((inst) => (
          <Link
            key={inst.id}
            to={`/sf/${inst.code}`}
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)',
              transition: 'border-color 0.15s',
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#7c3aed'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = ''}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
                  {inst.name}
                </div>
                {inst.name_zh && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{inst.name_zh}</div>}
                {inst.parent_university && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                    {inst.parent_university}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  {t('schools.tier', { tier: inst.tier })}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {inst.articulation_rate != null && (
                <span>{t('schools.articulation', { pct: Math.round(inst.articulation_rate * 100) })}</span>
              )}
              {inst.location && <span>{inst.location}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default SchoolDirectory;
