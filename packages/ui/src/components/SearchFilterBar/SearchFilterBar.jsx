import { Search } from 'lucide-react';
import { Input } from '../../primitives/input';
import FilterControl from '../FilterControl/FilterControl';

const FILTERABLE_TYPES = ['enum', 'date', 'int', 'decimal'];

const barStyle = {
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'center',
  marginBottom: 'var(--space-4)',
  flexWrap: 'wrap',
};

const searchWrapStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const searchIconStyle = {
  position: 'absolute',
  left: '10px',
  color: 'var(--color-text-secondary)',
  pointerEvents: 'none',
  zIndex: 1,
};

const clearBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-primary)',
  padding: 'var(--space-1) var(--space-2)',
  fontFamily: 'var(--font-family-base)',
  textDecoration: 'underline',
  whiteSpace: 'nowrap',
};

/**
 * Search bar + schema-driven filter controls.
 *
 * Props:
 *   schema          — entity schema ({ name, fields: [{ name, type, choices }] })
 *   searchText      — current search text string
 *   onSearchChange  — callback(newText)
 *   filters         — current filter map { [fieldName]: value }
 *   onFilterChange  — callback(newFilters)
 */
export default function SearchFilterBar({ schema, searchText, onSearchChange, filters, onFilterChange }) {
  const filterableFields = (schema?.fields ?? []).filter((f) => FILTERABLE_TYPES.includes(f.type));

  const hasActiveFilters =
    (searchText && searchText.length > 0) ||
    Object.values(filters ?? {}).some((v) => {
      if (v == null || v === '') return false;
      if (typeof v === 'object') return Object.values(v).some((x) => x != null && x !== '');
      return true;
    });

  const handleClear = () => {
    onSearchChange('');
    onFilterChange({});
  };

  return (
    <div style={barStyle}>
      {/* Search input */}
      <div style={searchWrapStyle}>
        <span style={searchIconStyle}>
          <Search size={16} />
        </span>
        <Input
          type="text"
          role="searchbox"
          aria-label={`Search ${schema?.name || ''}`.trim()}
          placeholder={`Search ${schema?.name || ''}…`.trim()}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ maxWidth: 320, minHeight: 44, paddingLeft: 34 }}
        />
      </div>

      {/* Per-field filter controls */}
      {filterableFields.map((field) => (
        <FilterControl
          key={field.name}
          field={field}
          value={filters?.[field.name] ?? null}
          onChange={(val) => onFilterChange({ ...(filters ?? {}), [field.name]: val })}
        />
      ))}

      {/* Clear filters button — visible only when any filter is active */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          style={clearBtnStyle}
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
