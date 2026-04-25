import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useEvaluationsTab(studentId, showToast) {
  const queryClient = useQueryClient();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(`/api/v1/students/${studentId}/teacher-evaluations`)
      .then((r) => setEvaluations(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEvaluations([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  const saveMutation = useMutation({
    mutationFn: (updatedList) => client.put(`/api/v1/students/${studentId}/teacher-evaluations`, updatedList).then((res) => res.data),
    onSuccess: (data) => {
      setEvaluations(Array.isArray(data) ? data : evaluations);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      showToast('Evaluations saved.', 'success');
    },
    onError: () => {
      showToast('Failed to save evaluations.', 'error');
    },
  });

  const saveAll = useCallback((updatedList) => {
    saveMutation.mutate(updatedList);
  }, [saveMutation]);

  const addEval = useCallback(() => {
    setEvaluations((prev) => [...prev, { subject_code: '', teacher_name: '', rating: 0, comment: '', date: '' }]);
  }, []);

  const updateEval = useCallback((index, field, value) => {
    setEvaluations((prev) => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }, []);

  const removeEval = useCallback((index) => {
    const next = evaluations.filter((_, i) => i !== index);
    saveAll(next);
  }, [evaluations, saveAll]);

  return {
    evaluations,
    loading,
    saving: saveMutation.isPending,
    saveAll,
    addEval,
    updateEval,
    removeEval,
  };
}
