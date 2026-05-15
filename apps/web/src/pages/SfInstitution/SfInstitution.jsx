// Self-financing Institution profile — completely separate from JUPAS SchoolProfile
import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSfInstitution } from '../../api/selfFinancing';

const LEVEL_LABELS = {
  associate_degree: { label: 'Associate Degree', short: 'AD', bg: '#dbeafe', color: '#1e40af' },
  higher_diploma: { label: 'Higher Diploma', short: 'HD', bg: '#fef3c7', color: '#92400e' },
  diploma: { label: 'Diploma', short: 'Dip', bg: '#f1f5f9', color: '#475569' },
  self_financing_degree: { label: 'Degree', short: 'Deg', bg: '#d1fae5', color: '#065f46' },
};

function getTierStyle(mean) {
  if (mean == null) return { label: '—', bg: '#f1f5f9', color: '#64748b' };
  if (mean >= 16) return { label: 'Competitive', bg: '#fef3c7', color: '#92400e' };
  if (mean >= 14) return { label: 'Moderate', bg: '#d1fae5', color: '#065f46' };
  return { label: 'Accessible', bg: '#eff6ff', color: '#1e40af' };
}

export default function SfInstitution() {
  const { code } = useParams();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const instQuery = useQuery({
    queryKey: ['sf-institution', code],
    queryFn: () => getSfInstitution(code),
  });

  const account = accountQuery.data ?? null;
  const data = instQuery.data;
  const inst = data?.institution;
  const allProgs = data?.programmes ?? [];

  const levels = useMemo(() => [...new Set(allProgs.map(p => p.level))].sort(), [allProgs]);
  const faculties = useMemo(() => [...new Set(allProgs.map(p => p.faculty).filter(Boolean))].sort(), [allProgs]);

  const filteredProgs = useMemo(() => {
    let progs = allProgs;
    if (levelFilter) progs = progs.filter(p => p.level === levelFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      progs = progs.filter(p => p.name.toLowerCase().includes(q) || (p.faculty || '').toLowerCase().includes(q));
    }
    return progs;
  }, [allProgs, levelFilter, search]);

  const thStyle = { padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-4) var(--space-6)' }}>
        <Link to="/schools" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 'var(--font-size-sm)' }}>
          ← Back to Directory
        </Link>

        {instQuery.isLoading && <LoadingSpinner label="Loading..." />}
        {instQuery.error && <ErrorMessage message="Failed to load institution" />}

        {inst && (
          <>
            {/* Hero */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-5) var(--space-6)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Sub-degree</span>
                    <span style={{ background: '#f0fdf4', color: '#059669', padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Tier {inst.tier}</span>
                  </div>
                  <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 'var(--space-2) 0 0' }}>
                    {inst.name}
                  </h1>
                  {inst.name_zh && <div style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{inst.name_zh}</div>}
                  {inst.parent_university && (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', marginTop: 'var(--space-1)', fontWeight: 'var(--font-weight-medium)' }}>
                      Under {inst.parent_university}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {inst.location && <span>{inst.location}</span>}
                    {inst.website && <a href={inst.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Website ↗</a>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div style={{ background: '#f0fdf4', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--border-radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#059669' }}>
                      {inst.articulation_rate != null ? `${Math.round(inst.articulation_rate * 100)}%` : 'N/A'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Articulation Rate</div>
                  </div>
                  <div style={{ background: '#eff6ff', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--border-radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#2563eb' }}>{data.total}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Programmes</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', margin: 0, color: 'var(--color-text-primary)' }}>Programmes</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search programmes..."
                style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', width: '220px' }}
              />
              {levels.length > 1 && (
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                >
                  <option value="">All Levels</option>
                  {levels.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]?.label ?? l}</option>)}
                </select>
              )}
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {filteredProgs.length} of {allProgs.length}
              </span>
            </div>

            {/* Programme table */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '60px' }}>Level</th>
                    <th style={thStyle}>Programme</th>
                    <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Mean</th>
                    <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>LQ</th>
                    <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>UQ</th>
                    <th style={{ ...thStyle, width: '100px', textAlign: 'right' }}>Competitiveness</th>
                    <th style={{ ...thStyle, width: '30px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProgs.map((p) => {
                    const lvl = LEVEL_LABELS[p.level] ?? { short: '?', bg: '#f1f5f9', color: '#475569' };
                    const tier = getTierStyle(p.admission_score_mean);
                    return (
                      <tr key={p.id} style={{ borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', verticalAlign: 'middle' }}>
                          <span style={{ background: lvl.bg, color: lvl.color, padding: '2px 8px', borderRadius: '10px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{lvl.short}</span>
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                          <Link
                            to={`/sf/${code}/programmes/${p.id}`}
                            style={{ color: 'var(--color-text-primary)', textDecoration: 'none', fontWeight: 'var(--font-weight-medium)' }}
                          >
                            {p.name}
                          </Link>
                          {p.faculty && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '1px' }}>{p.faculty}</div>}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', textAlign: 'center', fontWeight: 'var(--font-weight-bold)' }}>
                          {p.admission_score_mean ?? '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                          {p.admission_score_lq ?? '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                          {p.admission_score_uq ?? '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                          <span style={{ background: tier.bg, color: tier.color, padding: '2px 10px', borderRadius: '12px', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{tier.label}</span>
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>
                          <Link to={`/sf/${code}/programmes/${p.id}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>→</Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProgs.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>No programmes match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
              Scores are best-5 HKDSE subjects · Source: {allProgs[0]?.data_source || 'CSPE/iPASS'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
