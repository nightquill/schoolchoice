import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useLanguageTab(student, studentId, showToast) {
  const queryClient = useQueryClient();
  const [ielts, setIelts] = useState({
    ielts_score: student?.ielts_score || '',
    ielts_listening: student?.ielts_listening || '',
    ielts_reading: student?.ielts_reading || '',
    ielts_writing: student?.ielts_writing || '',
    ielts_speaking: student?.ielts_speaking || '',
    ielts_date: student?.ielts_date || '',
  });
  const [otherScores, setOtherScores] = useState(student?.other_language_scores || []);

  const mutation = useMutation({
    mutationFn: (payload) => client.post(`/api/v1/students/${studentId}/language-scores`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      showToast('Language scores saved.', 'success');
    },
    onError: () => {
      showToast('Failed to save language scores.', 'error');
    },
  });

  const handleSave = useCallback(() => {
    mutation.mutate({
      ...ielts,
      other_language_scores: otherScores,
    });
  }, [ielts, otherScores, mutation]);

  const updateIelts = useCallback((field, value) => {
    setIelts((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addOtherScore = useCallback(() => {
    setOtherScores((prev) => [...prev, { label: '', score: '', date: '' }]);
  }, []);

  const removeOtherScore = useCallback((index) => {
    setOtherScores((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateOtherScore = useCallback((index, field, value) => {
    setOtherScores((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, []);

  return {
    ielts,
    otherScores,
    saving: mutation.isPending,
    updateIelts,
    handleSave,
    addOtherScore,
    removeOtherScore,
    updateOtherScore,
  };
}
