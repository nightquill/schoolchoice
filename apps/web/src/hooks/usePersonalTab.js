import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import client from '@schoolchoice/ui/api/client';
import { useAutosave, loadDraft, clearDraft } from './useAutosave';

export function usePersonalTab(student, studentId, onSaved) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    full_name: student?.full_name || '',
    preferred_name: student?.preferred_name || '',
    name_zh: student?.name_zh || '',
    date_of_birth: student?.date_of_birth || '',
    gender: student?.gender || '',
    address: student?.address || '',
    phone: student?.phone || '',
    email: student?.email || '',
    class_name: student?.class_name || '',
    year_of_study: student?.year_of_study ?? '',
    candidate_number: student?.candidate_number || '',
    financial_aid_flag: student?.financial_aid_flag || false,
    preferred_language: student?.preferred_language || 'en',
    personal_statement: student?.personal_statement || '',
  });
  const [errors, setErrors] = useState({});

  const draftKey = studentId ? `draft:personal:${studentId}` : null;
  useAutosave(draftKey, form);

  useEffect(() => {
    if (draftKey) {
      const draft = loadDraft(draftKey);
      if (draft) setForm((prev) => ({ ...prev, ...draft }));
    }
  }, [draftKey]);

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || '',
        preferred_name: student.preferred_name || '',
        name_zh: student.name_zh || '',
        date_of_birth: student.date_of_birth || '',
        gender: student.gender || '',
        address: student.address || '',
        phone: student.phone || '',
        email: student.email || '',
        class_name: student.class_name || '',
        year_of_study: student.year_of_study ?? '',
        candidate_number: student.candidate_number || '',
        financial_aid_flag: student.financial_aid_flag || false,
        preferred_language: student.preferred_language || 'en',
        personal_statement: student.personal_statement || '',
      });
    }
  }, [student]);

  const calcAge = useCallback((dob) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const mutation = useMutation({
    mutationFn: (payload) =>
      client.put(`/api/v1/students/${studentId}/profile`, payload).then((r) => r.data),
    onSuccess: (updated) => {
      clearDraft(draftKey);
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      onSaved(updated);
      toast.success('Profile saved successfully.');
    },
    onError: (err) => {
      const detail = err?.response?.data;
      if (err?.response?.status === 422) {
        toast.error(`Validation error: ${JSON.stringify(detail?.detail || detail)}`);
      } else {
        toast.error('Failed to save profile.');
      }
    },
  });

  const handleSave = useCallback(() => {
    setErrors({});
    const payload = {
      ...form,
      year_of_study: form.year_of_study === '' || form.year_of_study === null ? null : parseInt(form.year_of_study, 10),
      date_of_birth: form.date_of_birth === '' ? null : form.date_of_birth,
      personal_statement: form.personal_statement === '' ? null : form.personal_statement,
    };
    mutation.mutate(payload);
  }, [form, mutation]);

  return { form, saving: mutation.isPending, errors, handleChange, handleSave, calcAge };
}
