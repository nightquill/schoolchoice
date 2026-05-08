import { useState, useEffect, useRef, useCallback } from 'react';
import { getGrades, createGrade, deleteGrade } from '../api/grades';
import { uploadTranscript, getTranscript } from '../api/transcripts';

export function useGradesTab(studentId, showToast) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [transcriptState, setTranscriptState] = useState('idle'); // idle|parsing|complete|failed
  const [parsedGrades, setParsedGrades] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    getGrades(studentId)
      .then((data) => setGrades(Array.isArray(data) ? data : (data.grades || [])))
      .catch(() => setError('Failed to load grades.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleUpload = useCallback(async (file) => {
    setUploadProgress(0);
    try {
      await uploadTranscript(studentId, file);
      setUploadProgress(100);
      setTranscriptState('parsing');
      showToast('Transcript uploaded. Parsing in progress…', 'info');
      pollRef.current = setInterval(async () => {
        try {
          const result = await getTranscript(studentId);
          if (result.parse_status === 'complete') {
            clearInterval(pollRef.current);
            setTranscriptState('complete');
            setParsedGrades(result.parsed_data || []);
            showToast('Transcript parsed. Review suggested grades below.', 'success');
          } else if (result.parse_status === 'failed') {
            clearInterval(pollRef.current);
            setTranscriptState('failed');
            showToast('Transcript parsing failed. Please enter grades manually.', 'error');
          }
        } catch {
          clearInterval(pollRef.current);
          setTranscriptState('failed');
        }
      }, 3000);
    } catch {
      setUploadProgress(null);
      showToast('Upload failed.', 'error');
    }
  }, [studentId, showToast]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleAcceptSuggestion = useCallback(async (suggestion) => {
    try {
      const created = await createGrade(studentId, {
        subject_name: suggestion.subject,
        raw_grade: suggestion.grade,
        sitting: 'OFFICIAL',
        transcript_uploaded: true,
      });
      setGrades((prev) => [...prev, created]);
      setParsedGrades((prev) => prev.filter((g) => g !== suggestion));
      showToast('Grade added.', 'success');
    } catch {
      showToast('Failed to add grade.', 'error');
    }
  }, [studentId, showToast]);

  const handleDeleteGrade = useCallback(async (gradeId) => {
    try {
      await deleteGrade(studentId, gradeId);
      setGrades((prev) => prev.filter((g) => g.id !== gradeId));
      showToast('Grade deleted.', 'success');
    } catch {
      showToast('Failed to delete grade.', 'error');
    }
  }, [studentId, showToast]);

  const handleSaveNewRow = useCallback(async () => {
    if (!newRow?.subject_name) return;
    try {
      const created = await createGrade(studentId, newRow);
      setGrades((prev) => [...prev, created]);
      setNewRow(null);
      showToast('Grade added.', 'success');
    } catch {
      showToast('Failed to save grade.', 'error');
    }
  }, [newRow, studentId, showToast]);

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
