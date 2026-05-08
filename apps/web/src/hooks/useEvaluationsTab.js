import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import client from '@schoolchoice/ui/api/client';

export function useEvaluationsTab(studentId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['evaluations', studentId],
    queryFn: () =>
      client.get(`/api/v1/students/${studentId}/teacher-evaluations`).then((r) =>
        Array.isArray(r.data) ? r.data : []
      ),
  });

  const [evaluations, setEvaluations] = useState([]);

  // Sync query data into local state when it arrives or changes
  useEffect(() => {
    if (query.data) {
      setEvaluations(query.data);
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: (updatedList) =>
      client.put(`/api/v1/students/${studentId}/teacher-evaluations`, updatedList).then((res) => res.data),
    onSuccess: (data) => {
      setEvaluations(Array.isArray(data) ? data : evaluations);
      queryClient.invalidateQueries({ queryKey: ['evaluations', studentId] });
      toast.success('Evaluations saved.');
    },
    onError: () => {
      toast.error('Failed to save evaluations.');
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
    setEvaluations((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveAll(next);
      return next;
    });
  }, [saveAll]);

  return {
    evaluations,
    loading: query.isLoading,
    saving: saveMutation.isPending ? 'all' : null,
    saveAll,
    addEval,
    updateEval,
    removeEval,
  };
}
