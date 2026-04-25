import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function usePersonalTab(student, studentId, showToast) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: student?.full_name || '',
    preferred_name: student?.preferred_name || '',
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

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || '',
        preferred_name: student.preferred_name || '',
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

  const mutation = useMutation({
    mutationFn: (payload) => client.put(`/api/v1/students/${studentId}/profile`, payload).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      showToast('Profile saved successfully.', 'success');
    },
    onError: (err) => {
      const detail = err?.response?.data;
      if (err?.response?.status === 422) {
        showToast(`Validation error: ${JSON.stringify(detail?.detail || detail)}`, 'error');
      } else {
        showToast('Failed to save profile.', 'error');
      }
    },
  });

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

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
