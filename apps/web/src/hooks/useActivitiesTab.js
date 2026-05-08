import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import client from '@schoolchoice/ui/api/client';

export function useActivitiesTab(student, studentId) {
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
    mutationFn: (data) =>
      client.post(`/api/v1/students/${studentId}/extracurricular`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      toast.success('Activities saved.');
    },
    onError: () => {
      toast.error('Failed to save activities.');
    },
  });

  const awardsMutation = useMutation({
    mutationFn: (data) =>
      client.post(`/api/v1/students/${studentId}/awards`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      toast.success('Awards saved.');
    },
    onError: () => {
      toast.error('Failed to save awards.');
    },
  });

  const toggleActivity = useCallback((index) => {
    setActivityOpen((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  const toggleAward = useCallback((index) => {
    setAwardOpen((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  const handleSaveActivities = useCallback(() => {
    activitiesMutation.mutate(activities);
  }, [activities, activitiesMutation]);

  const handleSaveAwards = useCallback(() => {
    awardsMutation.mutate(awards);
  }, [awards, awardsMutation]);

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
    saving: activitiesMutation.isPending || awardsMutation.isPending,
    savingActivities: activitiesMutation.isPending,
    savingAwards: awardsMutation.isPending,
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
