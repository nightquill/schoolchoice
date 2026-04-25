import { useState, useCallback } from 'react';
import client from '../api/client';

export function useLanguageTab(student, studentId, showToast, onSaved) {
  const [ielts, setIelts] = useState({
    ielts_score: student?.ielts_score || '',
    ielts_listening: student?.ielts_listening || '',
    ielts_reading: student?.ielts_reading || '',
    ielts_writing: student?.ielts_writing || '',
    ielts_speaking: student?.ielts_speaking || '',
    ielts_date: student?.ielts_date || '',
  });
  const [otherScores, setOtherScores] = useState(student?.other_language_scores || []);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await client.post(`/api/v1/students/${studentId}/language-scores`, {
        ...ielts,
        other_language_scores: otherScores,
      }).then((r) => r.data);
      onSaved(updated);
      showToast('Language scores saved.', 'success');
    } catch {
      showToast('Failed to save language scores.', 'error');
    } finally {
      setSaving(false);
    }
  }, [ielts, otherScores, studentId, onSaved, showToast]);

  const addOtherScore = useCallback(() => {
    setOtherScores((prev) => [...prev, { label: '', score: '', date: '' }]);
  }, []);

  const removeOtherScore = useCallback((index) => {
    setOtherScores((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateOtherScore = useCallback((index, field, value) => {
    setOtherScores((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }, []);

  const updateIelts = useCallback((field, value) => {
    setIelts((prev) => ({ ...prev, [field]: value }));
  }, []);

  return {
    ielts,
    otherScores,
    saving,
    handleSave,
    addOtherScore,
    removeOtherScore,
    updateOtherScore,
    updateIelts,
  };
}
