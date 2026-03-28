// REQ-094: School Directory Page
import { useState, useEffect, useCallback, useRef } from 'react';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import SchoolCard from '../../components/SchoolCard/SchoolCard';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import Button from '../../components/Button/Button';
import { searchSchools, createSchool, deleteSchool } from '../../api/schoolsV2';
import { getAccount } from '../../api/account';

const LIMIT = 20;

function SchoolDirectory() {
  const [account, setAccount] = useState(null);
  const [schools, setSchools] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ q: '', type: '', location: '' });
  const debounceRef = useRef(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', name_zh: '', type: 'UNIVERSITY', location: '', description: '', website: '', minimum_entry_score: '', notable_programs: '', notes: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
      setError(err?.response?.data?.detail || 'Failed to load schools.');
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

  const handleDeleteSchool = async (school) => {
    setDeletingId(school.id);
    try {
      await deleteSchool(school.id);
      setSchools((prev) => prev.filter((s) => s.id !== school.id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete school.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddSchool = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) { setAddError('School name is required.'); return; }
    setAddLoading(true);
    setAddError('');
    try {
      const payload = {
        name: addForm.name.trim(),
        name_zh: addForm.name_zh.trim() || null,
        type: addForm.type || null,
        location: addForm.location.trim() || null,
        description: addForm.description.trim() || null,
        website: addForm.website.trim() || null,
        minimum_entry_score: addForm.minimum_entry_score !== '' ? parseFloat(addForm.minimum_entry_score) : null,
        notable_programs: addForm.notable_programs ? addForm.notable_programs.split(',').map((s) => s.trim()).filter(Boolean) : null,
        notes: addForm.notes.trim() || null,
        is_custom: true,
      };
      await createSchool(payload);
      setShowAddModal(false);
      setAddForm({ name: '', name_zh: '', type: 'UNIVERSITY', location: '', description: '', website: '', minimum_entry_score: '', notable_programs: '', notes: '' });
      fetchSchools(1, filters);
    } catch (err) {
      setAddError(err?.response?.data?.detail || 'Failed to create school.');
    } finally {
      setAddLoading(false);
    }
  };

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

      <div style={filterBarStyle} role="search" aria-label="School search filters">
        <div style={fieldGroupStyle}>
          <label htmlFor="school-search-q" style={labelStyle}>Search</label>
          <input
            id="school-search-q"
            value={filters.q}
            onChange={(e) => handleFilterChange('q', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="School name\u2026"
            style={inputStyle}
          />
        </div>
        <div style={fieldGroupStyle}>
          <label htmlFor="school-search-type" style={labelStyle}>Type</label>
          <select
            id="school-search-type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="UNIVERSITY">University</option>
            <option value="POLYTECHNIC">Polytechnic</option>
            <option value="COMMUNITY_COLLEGE">Community College</option>
            <option value="VOCATIONAL">Vocational</option>
            <option value="HIGH_SCHOOL">High School</option>
          </select>
        </div>
        <div style={fieldGroupStyle}>
          <label htmlFor="school-search-location" style={labelStyle}>Location</label>
          <input
            id="school-search-location"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Location\u2026"
            style={inputStyle}
          />
        </div>
        <Button label="Search" onClick={handleSearch} loading={loading} />
        <Button label="+ Add Custom School" variant="secondary" onClick={() => setShowAddModal(true)} />
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', padding: 'var(--space-6)', width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>Add Custom School</h2>
            <form onSubmit={handleAddSchool} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { label: 'Name *', field: 'name', placeholder: 'School full name' },
                { label: 'Chinese Name', field: 'name_zh', placeholder: 'Optional' },
                { label: 'Location', field: 'location', placeholder: 'e.g. Hong Kong' },
                { label: 'Website', field: 'website', placeholder: 'https://...' },
                { label: 'Min. Entry Score', field: 'minimum_entry_score', placeholder: 'Numeric', type: 'number' },
                { label: 'Notable Programs', field: 'notable_programs', placeholder: 'Comma-separated' },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{label}</label>
                  <input
                    type={type || 'text'}
                    value={addForm[field]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>Type</label>
                <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))} style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>
                  <option value="UNIVERSITY">University</option>
                  <option value="POLYTECHNIC">Polytechnic</option>
                  <option value="COMMUNITY_COLLEGE">Community College</option>
                  <option value="VOCATIONAL">Vocational</option>
                  <option value="HIGH_SCHOOL">High School</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>Description</label>
                <textarea value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Optional description" style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes" style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)', resize: 'vertical' }} />
              </div>
              {addError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', margin: 0 }}>{addError}</p>}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <Button label="Cancel" variant="secondary" onClick={() => { setShowAddModal(false); setAddError(''); }} disabled={addLoading} />
                <Button label={addLoading ? 'Saving…' : 'Create School'} variant="primary" type="submit" disabled={addLoading} onClick={() => {}} />
              </div>
            </form>
          </div>
        </div>
      )}

      <main id="main-content" style={contentStyle}>
        {loading && <LoadingSpinner label="Searching schools..." />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && (
          <>
            <p style={countStyle}>
              Showing {schools.length} of {total} school{total !== 1 ? 's' : ''}.
            </p>
            {schools.length === 0 ? (
              <EmptyState message="No schools match your filters. Try adjusting the search criteria." />
            ) : (
              <div style={gridStyle} role="list" aria-label="School results">
                {schools.map((school) => (
                  <div key={school.id} role="listitem" style={{ position: 'relative' }}>
                    {school.is_custom === true && (
                      <div style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)', zIndex: 10, display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', background: '#7c3aed', color: '#fff', padding: '2px 7px', borderRadius: '8px' }}>Custom</span>
                        {confirmDeleteId === school.id ? (
                          <>
                            <span style={{ fontSize: '11px', color: 'var(--color-error)', fontFamily: 'var(--font-family-base)' }}>Delete?</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteSchool(school); setConfirmDeleteId(null); }}
                              style={{ background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: '11px', padding: '2px 7px', fontFamily: 'var(--font-family-base)' }}
                            >Yes</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: '11px', padding: '2px 7px', fontFamily: 'var(--font-family-base)' }}
                            >No</button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(school.id); }}
                            disabled={deletingId === school.id}
                            style={{ background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', fontSize: '11px', padding: '2px 7px', fontFamily: 'var(--font-family-base)' }}
                            aria-label={`Delete ${school.name}`}
                          >
                            {deletingId === school.id ? '…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                    <SchoolCard school={school} />
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div style={paginationStyle} role="navigation" aria-label="Pagination">
                <Button
                  label="Previous"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => fetchSchools(page - 1, filters)}
                />
                <span style={pageIndicatorStyle}>Page {page} of {totalPages}</span>
                <Button
                  label="Next"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => fetchSchools(page + 1, filters)}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default SchoolDirectory;
