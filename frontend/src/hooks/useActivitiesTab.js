import { useState, useCallback } from 'react';
import client from '../api/client';

export function useActivitiesTab(student, studentId, showToast) {
  const [activities, setActivities] = useState(student?.extra_curricular || []);
  const [awards, setAwards] = useState(student?.awards || []);
  const [saving, setSaving] = useState(false);
  const [activityOpen, setActivityOpen] = useState(() =>
    (student?.extra_curricular || []).map((a) => !a.activity)
  );
  const [awardOpen, setAwardOpen] = useState(() =>
    (student?.awards || []).map((a) => !a.title)
  );

  const toggleActivity = useCallback((index) => {
    setActivityOpen((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  const toggleAward = useCallback((index) => {
    setAwardOpen((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  const handleSaveActivities = useCallback(async () => {
    setSaving(true);
    try {
      await client.post(`/api/v1/students/${studentId}/extracurricular`, activities).then((r) => r.data);
      showToast('Activities saved.', 'success');
    } catch {
      showToast('Failed to save activities.', 'error');
    } finally {
      setSaving(false);
    }
  }, [activities, studentId, showToast]);

  const handleSaveAwards = useCallback(async () => {
    setSaving(true);
    try {
      await client.post(`/api/v1/students/${studentId}/awards`, awards).then((r) => r.data);
      showToast('Awards saved.', 'success');
    } catch {
      showToast('Failed to save awards.', 'error');
    } finally {
      setSaving(false);
    }
  }, [awards, studentId, showToast]);

  const addActivity = useCallback(() => {
    setActivities((prev) => [...prev, { activity: '', role: '', years: '', achievement: '' }]);
    setActivityOpen((prev) => [...prev, true]);
  }, []);

  const updateActivity = useCallback((index, field, value) => {
    setActivities((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }, []);

  const removeActivity = useCallback((index) => {
    setActivities((prev) => prev.filter((_, i) => i !== index));
    setActivityOpen((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addAward = useCallback(() => {
    setAwards((prev) => [...prev, { title: '', awarding_body: '', level: 'School', year: '' }]);
    setAwardOpen((prev) => [...prev, true]);
  }, []);

  const updateAward = useCallback((index, field, value) => {
    setAwards((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }, []);

  const removeAward = useCallback((index) => {
    setAwards((prev) => prev.filter((_, i) => i !== index));
    setAwardOpen((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    activities,
    awards,
    saving,
    activityOpen,
    awardOpen,
    toggleActivity,
    toggleAward,
    handleSaveActivities,
    handleSaveAwards,
    addActivity,
    updateActivity,
    removeActivity,
    addAward,
    updateAward,
    removeAward,
  };
}
