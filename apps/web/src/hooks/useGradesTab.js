import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getGrades, createGrade, deleteGrade } from '../api/grades';
import { uploadTranscript, getTranscript } from '../api/transcripts';

export function useGradesTab(studentId) {
  const queryClient = useQueryClient();

  // --- Grades query ---
  const gradesQuery = useQuery({
    queryKey: ['grades', studentId],
    queryFn: () => getGrades(studentId),
    enabled: !!studentId,
  });

  const grades = Array.isArray(gradesQuery.data)
    ? gradesQuery.data
    : (gradesQuery.data?.grades || []);
  const loading = gradesQuery.isLoading;
  const error = gradesQuery.error ? 'Failed to load grades.' : null;

  // --- Local UI state ---
  const [newRow, setNewRow] = useState(null);
  const [transcriptState, setTranscriptState] = useState('idle'); // idle|parsing|complete|failed
  const [parsedGrades, setParsedGrades] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const pollRef = useRef(null);

  // --- Mutations ---
  const createGradeMutation = useMutation({
    mutationFn: (payload) => createGrade(studentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', studentId] });
    },
  });

  const deleteGradeMutation = useMutation({
    mutationFn: (gradeId) => deleteGrade(studentId, gradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', studentId] });
    },
  });

  // --- Transcript upload with polling ---
  const handleUpload = useCallback(async (file) => {
    setUploadProgress(0);
    try {
      await uploadTranscript(studentId, file);
      setUploadProgress(100);
      setTranscriptState('parsing');
      toast.info('Transcript uploaded. Parsing in progress…');
      pollRef.current = setInterval(async () => {
        try {
          const result = await getTranscript(studentId);
          if (result.parse_status === 'complete') {
            clearInterval(pollRef.current);
            setTranscriptState('complete');
            setParsedGrades(result.parsed_data || []);
            toast.success('Transcript parsed. Review suggested grades below.');
          } else if (result.parse_status === 'failed') {
            clearInterval(pollRef.current);
            setTranscriptState('failed');
            toast.error('Transcript parsing failed. Please enter grades manually.');
          }
        } catch {
          clearInterval(pollRef.current);
          setTranscriptState('failed');
        }
      }, 3000);
    } catch {
      setUploadProgress(null);
      toast.error('Upload failed.');
    }
  }, [studentId]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // --- Handlers ---
  const handleAcceptSuggestion = useCallback(async (suggestion) => {
    try {
      await createGradeMutation.mutateAsync({
        subject_name: suggestion.subject,
        raw_grade: suggestion.grade,
        sitting: 'OFFICIAL',
        transcript_uploaded: true,
      });
      setParsedGrades((prev) => prev.filter((g) => g !== suggestion));
      toast.success('Grade added.');
    } catch {
      toast.error('Failed to add grade.');
    }
  }, [createGradeMutation]);

  const handleDeleteGrade = useCallback(async (gradeId) => {
    try {
      await deleteGradeMutation.mutateAsync(gradeId);
      toast.success('Grade deleted.');
    } catch {
      toast.error('Failed to delete grade.');
    }
  }, [deleteGradeMutation]);

  const handleSaveNewRow = useCallback(async () => {
    if (!newRow?.subject_name) return;
    try {
      await createGradeMutation.mutateAsync(newRow);
      setNewRow(null);
      toast.success('Grade added.');
    } catch {
      toast.error('Failed to save grade.');
    }
  }, [newRow, createGradeMutation]);

  const dismissParsedGrade = useCallback((index) => {
    setParsedGrades((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  return {
    grades,
    loading,
    error,
    newRow,
    setNewRow,
    transcriptState,
    parsedGrades,
    uploadProgress,
    handleUpload,
    handleAcceptSuggestion,
    handleDeleteGrade,
    handleSaveNewRow,
    dismissParsedGrade,
  };
}
