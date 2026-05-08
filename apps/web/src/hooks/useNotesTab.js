import { useState, useEffect, useCallback, useRef } from 'react';
import client from '@schoolchoice/ui/api/client';

export function useNotesTab(student, studentId, showToast, onSaved) {
  const [notes, setNotes] = useState(student?.notes || '');
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const debounceRef = useRef(null);
  const fadeRef = useRef(null);

  const autoSave = useCallback(async (value) => {
    setSaveStatus('saving');
    try {
      const updated = await client.put(`/api/v1/students/${studentId}/profile`, { notes: value }).then((r) => r.data);
      onSaved(updated);
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus(null);
      showToast('Auto-save failed.', 'error');
    }
  }, [studentId, onSaved, showToast]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setNotes(value);
    clearTimeout(debounceRef.current);
    clearTimeout(fadeRef.current);
    debounceRef.current = setTimeout(() => autoSave(value), 1500);
  }, [autoSave]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    clearTimeout(fadeRef.current);
  }, []);

  return {
    notes,
    saveStatus,
    handleChange,
  };
}
