import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { QueryBoundary } from '@schoolchoice/ui';
import EntityListView from '../../components/EntityListView/EntityListView';
import { EmptyState } from '@schoolchoice/ui';
import { ActionBar } from '@schoolchoice/ui';
import { SearchFilterBar } from '@schoolchoice/ui';
import { getEntitySchema, getEntityList, exportEntityCSV } from '../../api/entities';
import { getAccount } from '@schoolchoice/ui/api/account';

const pageStyle = {
  background: 'var(--color-background)',
  minHeight: '100vh',
  fontFamily: 'var(--font-family-base)',
};

const contentStyle = {
  paddingTop: 'var(--space-6)',
  paddingBottom: 'var(--space-6)',
};

const headingStyle = {
  fontSize: 'var(--font-size-2xl)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-4)',
  textTransform: 'capitalize',
};

/**
 * Build filter params object from the filters state map.
 * Converts range objects ({ from, to } and { min, max }) to __gte/__lte params.
 */
function buildFilterParams(filters) {
  const activeFilters = {};
  for (const [key, val] of Object.entries(filters)) {
    if (val == null || val === '') continue;
    if (typeof val === 'object') {
      if (val.from) activeFilters[`${key}__gte`] = val.from;
      if (val.to) activeFilters[`${key}__lte`] = val.to;
      if (val.min) activeFilters[`${key}__gte`] = val.min;
      if (val.max) activeFilters[`${key}__lte`] = val.max;
    } else if (typeof val === 'string') {
      activeFilters[key] = val;
    }
  }
  return activeFilters;
}

export default function EntityListPage() {
  const { name } = useParams();
  const navigate = useNavigate();

  // Search and filter state
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search text by 300ms
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(handle);
  }, [searchText]);

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const schemaQuery = useQuery({
    queryKey: ['schema', name],
    queryFn: () => getEntitySchema(name),
  });

  const listQuery = useQuery({
    queryKey: ['entities', name, debouncedSearch, filters],
    queryFn: () => {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      const activeFilters = buildFilterParams(filters);
      if (Object.keys(activeFilters).length > 0) {
        params.filters = JSON.stringify(activeFilters);
      }
      return getEntityList(schemaQuery.data?.table || name, params);
    },
    enabled: !!schemaQuery.data,
  });

  const handleExportFiltered = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      const activeFilters = buildFilterParams(filters);
      if (Object.keys(activeFilters).length > 0) {
        params.filters = JSON.stringify(activeFilters);
      }
      await exportEntityCSV(name, params);
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [name, debouncedSearch, filters]);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportEntityCSV(name, {});
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [name]);

  const rows = listQuery.data ?? [];
  const hasActiveSearch = debouncedSearch.length > 0 || Object.keys(filters).some((k) => {
    const v = filters[k];
    if (v == null || v === '') return false;
    if (typeof v === 'object') return Object.values(v).some((x) => x != null && x !== '');
    return true;
  });
  const showEmptyState = !listQuery.isLoading && rows.length === 0 && hasActiveSearch;

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main id="main-content" className="px-4 md:px-8 overflow-x-auto" style={contentStyle}>
        <h1 style={headingStyle}>{name}</h1>

        {/* Action bar: Import + Export above the list */}
        <ActionBar
          entityName={name}
          onExportFiltered={handleExportFiltered}
          onExportAll={handleExportAll}
          isExporting={isExporting}
        />

        {/* Search + filter bar */}
        <SearchFilterBar
          schema={schemaQuery.data}
          searchText={searchText}
          onSearchChange={setSearchText}
          filters={filters}
          onFilterChange={setFilters}
        />

        <QueryBoundary
          isLoading={schemaQuery.isLoading || listQuery.isLoading}
          isError={schemaQuery.isError || listQuery.isError}
          error={schemaQuery.error || listQuery.error}
          refetch={() => { schemaQuery.refetch(); listQuery.refetch(); }}
          resourceName={name}
        >
          {showEmptyState ? (
            <EmptyState message="No results found. Try adjusting your search or filters." />
          ) : (
            <EntityListView
              schema={schemaQuery.data}
              rows={rows}
              onRowClick={(id) => navigate(`/entities/${name}/${id}`)}
            />
          )}
        </QueryBoundary>
      </main>
    </div>
  );
}
