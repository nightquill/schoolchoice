import { useState, useEffect, useCallback } from 'react';
import client from '@schoolchoice/ui/api/client';

export function useEvaluationsTab(studentId, showToast) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    client.get(`/api/v1/students/${studentId}/teacher-evaluations`)
      .then((r) => setEvaluations(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEvaluations([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  const saveAll = useCallback(async (updatedList) => {
    setSaving('all');
    try {
      const r = await client.put(`/api/v1/students/${studentId}/teacher-evaluations`, updatedList).then((res) => res.data);
      setEvaluations(Array.isArray(r) ? r : updatedList);
      showToast('Evaluations saved.', 'success');
    } catch {
      showToast('Failed to save evaluations.', 'error');
    } finally {
      setSaving(null);
    }
  }, [studentId, showToast]);

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
    loading,
    saving,
    saveAll,
    addEval,
    updateEval,
    removeEval,
  };
}
