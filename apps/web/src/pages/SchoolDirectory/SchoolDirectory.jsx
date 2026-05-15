// REQ-094: School Directory Page
import { useState, useEffect, useCallback, useRef } from 'react';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import SchoolCard from '../../components/SchoolCard/SchoolCard';
import { LoadingSpinner, ActionBar } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchSchools } from '../../api/schoolsV2';
import { exportEntityCSV } from '../../api/entities';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSfInstitutions } from '../../api/selfFinancing';
import { useTranslation } from '@schoolchoice/ui/i18n';

const LIMIT = 20;

function SchoolDirectory() {
  const { t } = useTranslation();
  const [account, setAccount] = useState(null);
  const [schools, setSchools] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ q: '', type: '', location: '' });
  const debounceRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportFiltered = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.type) params.filters = JSON.stringify({ type: filters.type });
      await exportEntityCSV('school', params);
      toast.success(t('schools.exportSuccess'));
    } catch {
      toast.error(t('schools.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportEntityCSV('school', {});
      toast.success(t('schools.exportSuccess'));
    } catch {
      toast.error(t('schools.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, []);

  useEffect(() => {
    getAccount().then(setAccount).catch(() => {});
    fetchSchools(1, filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSchools = useCallback(async (pageNum, currentFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: LIMIT,
        offset: (pageNum - 1) * LIMIT,
        ...(currentFilters.q && { q: currentFilters.q }),
        ...(currentFilters.type && { type: currentFilters.type }),
        ...(currentFilters.location && { location: currentFilters.location }),
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

  const handleSearch = () => {
    fetchSchools(1, filters);
  };

  const handleFilterChange = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field === 'q') {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSchools(1, next), 300);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const filterBarStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-4) var(--space-8)',
    display: 'flex',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  };

  const fieldGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    minWidth: '160px',
  };

  const labelStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
  };

  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
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

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />

      <ActionBar
        entityName="school"
        onExportFiltered={handleExportFiltered}
        onExportAll={handleExportAll}
        isExporting={isExporting}
        hideImport
      />

      <div style={filterBarStyle} role="search" aria-label="School search filters">
        <div style={fieldGroupStyle}>
          <label htmlFor="school-search-q" style={labelStyle}>{t('schools.search')}</label>
          <input
            id="school-search-q"
            value={filters.q}
            onChange={(e) => handleFilterChange('q', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t("schools.schoolNamePlaceholder")}
            style={inputStyle}
          />
        </div>
        <div style={fieldGroupStyle}>
          <label htmlFor="school-search-type" style={labelStyle}>{t('schools.type')}</label>
          <select
            id="school-search-type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            style={inputStyle}
          >
            <option value="">{t('schools.all')}</option>
            <option value="UNIVERSITY">{t('schools.university')}</option>
            <option value="POLYTECHNIC">{t('schools.polytechnic')}</option>
            <option value="COMMUNITY_COLLEGE">{t('schools.communityCollege')}</option>
            <option value="VOCATIONAL">{t('schools.vocational')}</option>
            <option value="HIGH_SCHOOL">{t('schools.highSchool')}</option>
          </select>
        </div>
        <div style={fieldGroupStyle}>
          <label htmlFor="school-search-location" style={labelStyle}>{t('schools.location')}</label>
          <input
            id="school-search-location"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t("schools.locationPlaceholder")}
            style={inputStyle}
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? t('schools.searching') : t('schools.search')}
        </Button>
      </div>

      <main id="main-content" style={contentStyle}>
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
                <Button variant="outline" disabled={page <= 1} onClick={() => fetchSchools(page - 1, filters)}>
                  {t('schools.previous')}
                </Button>
                <span style={pageIndicatorStyle}>{t('schools.pageOf', { page, total: totalPages })}</span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => fetchSchools(page + 1, filters)}>
                  {t('schools.next')}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Self-financing / Sub-degree section — separate from JUPAS */}
        <SfInstitutionsSection />
      </main>
    </div>
  );
}

function SfInstitutionsSection() {
  const sfQuery = useQuery({ queryKey: ['sf-institutions'], queryFn: getSfInstitutions, staleTime: 60000 });
  const institutions = sfQuery.data?.institutions ?? [];

  if (sfQuery.isLoading || institutions.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '2px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
          Sub-degree &amp; Self-financing
        </h2>
        <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
          副學士 · 高級文憑
        </span>
      </div>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4)' }}>
        Associate Degree, Higher Diploma, and self-financing programmes — separate from JUPAS.
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
                  Tier {inst.tier}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {inst.articulation_rate != null && (
                <span>{Math.round(inst.articulation_rate * 100)}% articulation</span>
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
