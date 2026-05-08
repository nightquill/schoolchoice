import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import client from '@schoolchoice/ui/api/client';

export function useNotesTab(student, studentId, onSaved) {
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState(student?.notes || '');
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const debounceRef = useRef(null);
  const fadeRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (value) =>
      client.put(`/api/v1/students/${studentId}/profile`, { notes: value }).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      onSaved(updated);
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus(null), 3000);
    },
    onError: () => {
      setSaveStatus(null);
      toast.error('Auto-save failed.');
    },
  });

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setNotes(value);
    clearTimeout(debounceRef.current);
    clearTimeout(fadeRef.current);
    setSaveStatus(null);
    debounceRef.current = setTimeout(() => {
      setSaveStatus('saving');
      mutation.mutate(value);
    }, 1500);
  }, [mutation]);

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
