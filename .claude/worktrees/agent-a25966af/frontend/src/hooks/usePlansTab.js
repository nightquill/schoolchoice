import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlanHistory, deletePlanHistory } from '../api/plan';

export function usePlansTab(studentId, showToast) {
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    getPlanHistory(studentId)
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => showToast('Failed to load plan history.', 'error'))
      .finally(() => setLoading(false));
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(async (e, planId) => {
    e.stopPropagation();
    setDeleting(planId);
    try {
      await deletePlanHistory(studentId, planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      if (selected?.id === planId) setSelected(null);
      showToast('Plan deleted.', 'success');
    } catch {
      showToast('Failed to delete plan.', 'error');
    } finally {
      setDeleting(null);
    }
  }, [studentId, selected, showToast]);

  const selectPlan = useCallback((plan) => {
    setSelected(plan);
  }, []);

  const clearSelected = useCallback(() => {
    setSelected(null);
  }, []);

  return {
    plans,
    loading,
    selected,
    deleting,
    handleDelete,
    selectPlan,
    clearSelected,
  };
}
