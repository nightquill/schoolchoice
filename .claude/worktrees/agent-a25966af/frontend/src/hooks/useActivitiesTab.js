import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useActivitiesTab(student, studentId, showToast) {
  const queryClient = useQueryClient();
  const [activities, setActivities] = useState(student?.extra_curricular || []);
  const [awards, setAwards] = useState(student?.awards || []);
  const [activityOpen, setActivityOpen] = useState(() =>
    (student?.extra_curricular || []).map((a) => !a.activity)
  );
  const [awardOpen, setAwardOpen] = useState(() =>
    (student?.awards || []).map((a) => !a.title)
  );

  const activitiesMutation = useMutation({
    mutationFn: (data) => client.post(`/api/v1/students/${studentId}/extracurricular`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      showToast('Activities saved.', 'success');
    },
    onError: () => {
      showToast('Failed to save activities.', 'error');
    },
  });

  const awardsMutation = useMutation({
    mutationFn: (data) => client.post(`/api/v1/students/${studentId}/awards`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      showToast('Awards saved.', 'success');
    },
    onError: () => {
      showToast('Failed to save awards.', 'error');
    },
  });

  const toggleActivity = useCallback((index) => {
    setActivityOpen((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  const toggleAward = useCallback((index) => {
    setAwardOpen((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  const updateActivity = useCallback((index, field, value) => {
    setActivities((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }, []);

  const addActivity = useCallback(() => {
    setActivities((prev) => [...prev, { activity: '', role: '', years: '', achievement: '' }]);
    setActivityOpen((prev) => [...prev, true]);
  }, []);

  const removeActivity = useCallback((index) => {
    setActivities((prev) => prev.filter((_, i) => i !== index));
    setActivityOpen((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveActivities = useCallback(() => {
    activitiesMutation.mutate(activities);
  }, [activities, activitiesMutation]);

  const updateAward = useCallback((index, field, value) => {
    setAwards((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }, []);

  const addAward = useCallback(() => {
    setAwards((prev) => [...prev, { title: '', awarding_body: '', level: 'School', year: '' }]);
    setAwardOpen((prev) => [...prev, true]);
  }, []);

  const removeAward = useCallback((index) => {
    setAwards((prev) => prev.filter((_, i) => i !== index));
    setAwardOpen((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveAwards = useCallback(() => {
    awardsMutation.mutate(awards);
  }, [awards, awardsMutation]);

  return {
    activities,
    awards,
    activityOpen,
    awardOpen,
    savingActivities: activitiesMutation.isPending,
    savingAwards: awardsMutation.isPending,
    toggleActivity,
    toggleAward,
    updateActivity,
    addActivity,
    removeActivity,
    handleSaveActivities,
    updateAward,
    addAward,
    removeAward,
    handleSaveAwards,
  };
}
