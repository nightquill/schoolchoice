import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useNotesTab(student, studentId, showToast) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(student?.notes || '');
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const debounceRef = useRef(null);
  const fadeRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (value) => client.put(`/api/v1/students/${studentId}/profile`, { notes: value }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus(null), 3000);
    },
    onError: () => {
      setSaveStatus(null);
      showToast('Auto-save failed.', 'error');
    },
  });

  const autoSave = useCallback((value) => {
    setSaveStatus('saving');
    mutation.mutate(value);
  }, [mutation]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setNotes(value);
    clearTimeout(debounceRef.current);
    clearTimeout(fadeRef.current);
    debounceRef.current = setTimeout(() => autoSave(value), 1500);
  }, [autoSave]);

  // Cleanup timeouts on unmount
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
