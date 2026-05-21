/**
 * Pick the locale-appropriate name from an object that has both
 * `name` (English) and `name_zh` (Chinese) fields.
 *
 * Usage:
 *   const ln = useLocalizedName();
 *   ln(programme, 'name')        → name_zh when zh-HK, name otherwise
 *   ln(school, 'school_name')    → school_name_zh when zh-HK, school_name otherwise
 */
import { useTranslation } from '@schoolchoice/ui/i18n';
import { useCallback } from 'react';

export function useLocalizedName() {
  const { locale } = useTranslation();
  const isZh = locale === 'zh-HK';

  return useCallback((obj, field = 'name') => {
    if (!obj) return '—';
    if (isZh) {
      const zhField = field + '_zh';
      if (obj[zhField]) return obj[zhField];
    }
    return obj[field] || '—';
  }, [isZh]);
}
