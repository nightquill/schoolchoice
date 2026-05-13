import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './en.json';
import zhHK from './zh-HK.json';

const translations = { en, 'zh-HK': zhHK };

const I18nContext = createContext({ locale: 'en', t: (key) => key, setLocale: () => {} });

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export function I18nProvider({ children, initialLocale = 'en' }) {
  const [locale, setLocale] = useState(initialLocale);

  const t = useCallback((key, params) => {
    const dict = translations[locale] || translations.en;
    let value = getNestedValue(dict, key);
    // Fallback to English if key missing in current locale
    if (value === undefined) {
      value = getNestedValue(translations.en, key);
    }
    // Still missing — return key itself
    if (value === undefined) return key;
    // Interpolate {param} placeholders
    if (params && typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    }
    return value;
  }, [locale]);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export { I18nContext };
