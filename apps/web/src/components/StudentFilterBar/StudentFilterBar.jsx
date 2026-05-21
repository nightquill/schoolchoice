import { useTranslation } from '@schoolchoice/ui/i18n';
import { Input } from '@schoolchoice/ui/primitives/input';
import { Search } from 'lucide-react';

const HKDSE_ELECTIVES = [
  'BIOL', 'CHEM', 'ECON', 'PHYS', 'ICT', 'M2', 'BAFS', 'GEOG', 'HIST',
  'CHIH', 'CHIL', 'VART', 'MUSC', 'ERS', 'M1', 'DAT', 'HMSC', 'TL', 'TOUR',
];

const BEST5_PRESETS = [
  { label: '30+', min: 30, max: undefined },
  { label: '25-29', min: 25, max: 29 },
  { label: '20-24', min: 20, max: 24 },
  { label: '<20', min: undefined, max: 19 },
];

function StudentFilterBar({ filters, onFiltersChange, classOptions = [], yearOptions = [] }) {
  const { t } = useTranslation();

  const set = (key, value) => onFiltersChange({ ...filters, [key]: value });

  const selectStyle = {
    padding: '6px 10px',
    borderRadius: 'var(--border-radius-sm)',
    border: 'var(--border-width) solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    minHeight: 36,
    cursor: 'pointer',
  };

  const presetBtnStyle = (active) => ({
    padding: '4px 10px',
    borderRadius: 'var(--border-radius-sm)',
    border: 'var(--border-width) solid var(--color-border)',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-xs)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-family-base)',
  });

  const toggleBtnStyle = (active) => ({
    padding: '6px 12px',
    borderRadius: 'var(--border-radius-sm)',
    border: 'var(--border-width) solid var(--color-border)',
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-family-base)',
  });

  const isPresetActive = (preset) => {
    return filters.best5_min === preset.min && filters.best5_max === preset.max;
  };

  const handlePreset = (preset) => {
    if (isPresetActive(preset)) {
      onFiltersChange({ ...filters, best5_min: undefined, best5_max: undefined });
    } else {
      onFiltersChange({ ...filters, best5_min: preset.min, best5_max: preset.max });
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3)',
      alignItems: 'center',
      marginBottom: 'var(--space-4)',
      padding: 'var(--space-3)',
      background: 'var(--color-surface)',
      border: 'var(--border-width) solid var(--color-border)',
      borderRadius: 'var(--border-radius-md)',
    }}>
      {/* Name search */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 10, color: 'var(--color-text-secondary)', pointerEvents: 'none', zIndex: 1 }}>
          <Search size={14} />
        </span>
        <Input
          type="text"
          role="searchbox"
          aria-label={t('filters.searchByName')}
          placeholder={t('filters.searchByName')}
          value={filters.q || ''}
          onChange={(e) => set('q', e.target.value)}
          style={{ maxWidth: 200, minHeight: 36, paddingLeft: 30, fontSize: 'var(--font-size-sm)' }}
        />
      </div>

      {/* Class dropdown */}
      <select
        value={filters.class_name || ''}
        onChange={(e) => set('class_name', e.target.value || undefined)}
        style={selectStyle}
        aria-label={t('filters.class')}
      >
        <option value="">{t('filters.all')} {t('filters.class')}</option>
        {classOptions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Year dropdown */}
      <select
        value={filters.year_of_study ?? ''}
        onChange={(e) => set('year_of_study', e.target.value ? Number(e.target.value) : undefined)}
        style={selectStyle}
        aria-label={t('filters.year')}
      >
        <option value="">{t('filters.all')} {t('filters.year')}</option>
        {yearOptions.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Subject dropdown */}
      <select
        value={filters.subject_code || ''}
        onChange={(e) => set('subject_code', e.target.value || undefined)}
        style={selectStyle}
        aria-label={t('filters.subject')}
      >
        <option value="">{t('filters.all')} {t('filters.subject')}</option>
        {HKDSE_ELECTIVES.map((s) => (
          <option key={s} value={s}>{t(`subjects.${s}`)}</option>
        ))}
      </select>

      {/* Best-5 range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          {t('filters.best5')}:
        </span>
        <Input
          type="number"
          min={0}
          max={35}
          placeholder={t('filters.min')}
          value={filters.best5_min ?? ''}
          onChange={(e) => set('best5_min', e.target.value ? Number(e.target.value) : undefined)}
          style={{ width: 56, minHeight: 32, fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
          aria-label={t('filters.min')}
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>–</span>
        <Input
          type="number"
          min={0}
          max={35}
          placeholder={t('filters.max')}
          value={filters.best5_max ?? ''}
          onChange={(e) => set('best5_max', e.target.value ? Number(e.target.value) : undefined)}
          style={{ width: 56, minHeight: 32, fontSize: 'var(--font-size-xs)', textAlign: 'center' }}
          aria-label={t('filters.max')}
        />
      </div>

      {/* Quick presets */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {BEST5_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            style={presetBtnStyle(isPresetActive(preset))}
            onClick={() => handlePreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Unaccounted toggle */}
      <button
        type="button"
        style={toggleBtnStyle(!!filters.unaccounted)}
        onClick={() => set('unaccounted', !filters.unaccounted)}
      >
        {t('filters.unaccounted')}
      </button>
    </div>
  );
}

export default StudentFilterBar;
