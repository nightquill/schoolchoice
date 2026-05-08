import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPlanHistory, deletePlanHistory } from '../api/plan';

export function usePlansTab(studentId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['plans', studentId],
    queryFn: () => getPlanHistory(studentId).then((data) => data.plans ?? []),
  });

  const [selected, setSelected] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (planId) => deletePlanHistory(studentId, planId),
    onSuccess: (_data, planId) => {
      queryClient.invalidateQueries({ queryKey: ['plans', studentId] });
      setSelected((prev) => (prev?.id === planId ? null : prev));
      toast.success('Plan deleted.');
    },
    onError: () => {
      toast.error('Failed to delete plan.');
    },
  });

  const handleDelete = useCallback((e, planId) => {
    e.stopPropagation();
    deleteMutation.mutate(planId);
  }, [deleteMutation]);

  return {
    plans: query.data ?? [],
    loading: query.isLoading,
    selected,
    setSelected,
    deleting: deleteMutation.isPending ? deleteMutation.variables : null,
    handleDelete,
  };
}
