import { useEffect, useRef } from 'react';

const AUTOSAVE_DELAY = 2000;

/**
 * Autosave form data to localStorage with debounce.
 * @param {string} key - localStorage key
 * @param {object} data - current form state
 * @param {{ enabled?: boolean }} options
 */
export function useAutosave(key, data, { enabled = true } = {}) {
  const timerRef = useRef(null);
  useEffect(() => {
    if (!enabled || !key) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch { /* localStorage full — silently ignore */ }
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timerRef.current);
  }, [key, data, enabled]);
}

/**
 * Load a saved draft from localStorage.
 * @param {string} key
 * @param {number} maxAgeMs - default 24 hours
 * @returns {object|null}
 */
export function loadDraft(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

/**
 * Clear a saved draft.
 * @param {string} key
 */
export function clearDraft(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
