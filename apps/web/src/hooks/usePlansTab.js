import { useState, useEffect, useCallback } from 'react';
import { getPlanHistory, deletePlanHistory } from '../api/plan';

export function usePlansTab(studentId, showToast) {
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
      setSelected((prev) => (prev?.id === planId ? null : prev));
      showToast('Plan deleted.', 'success');
    } catch {
      showToast('Failed to delete plan.', 'error');
    } finally {
      setDeleting(null);
    }
  }, [studentId, showToast]);

  return {
    plans,
    loading,
    selected,
    setSelected,
    deleting,
    handleDelete,
  };
}
