import { useState } from 'react';
import { TextInput } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui';

function StudentForm({ initialData = {}, onSubmit, onCancel, loading = false, submitLabel = 'Save' }) {
  const parseGrades = (gradesObj) => {
    if (!gradesObj || typeof gradesObj !== 'object') return [];
    return Object.entries(gradesObj).map(([subject, grade]) => ({ subject, grade: String(grade) }));
  };

  const [name, setName] = useState(initialData.name || '');
  const [gradeRows, setGradeRows] = useState(() => {
    const rows = parseGrades(initialData.grades);
    return rows.length > 0 ? rows : [];
  });
  const [interests, setInterests] = useState(
    Array.isArray(initialData.interests) ? initialData.interests.join(', ') : (initialData.interests || '')
  );
  const [strengthsWeaknesses, setStrengthsWeaknesses] = useState(initialData.strengths_weaknesses || '');
  const [targetRegion, setTargetRegion] = useState(initialData.target_region || '');
  const [errors, setErrors] = useState({});

  const addGradeRow = () => {
    setGradeRows([...gradeRows, { subject: '', grade: '' }]);
  };

  const removeGradeRow = (index) => {
    setGradeRows(gradeRows.filter((_, i) => i !== index));
  };

  const updateGradeRow = (index, field, value) => {
    const updated = gradeRows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    setGradeRows(updated);
  };

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Student name is required.';
    if (!targetRegion) newErrors.targetRegion = 'Please select a target region.';
    if (!strengthsWeaknesses.trim()) newErrors.strengthsWeaknesses = 'Please describe the student\'s strengths and weaknesses.';
    gradeRows.forEach((row, index) => {
      if (row.subject.trim() && !row.grade.trim()) {
        newErrors[`grade_${index}`] = `Please enter a grade for ${row.subject}.`;
      }
      if (!row.subject.trim() && row.grade.trim()) {
        newErrors[`subject_${index}`] = 'Please enter a subject name.';
      }
    });
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const gradesObj = {};
    gradeRows.forEach((row) => {
      if (row.subject.trim()) {
        gradesObj[row.subject.trim()] = row.grade.trim();
      }
    });

    const interestsArray = interests
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onSubmit({
      name: name.trim(),
      grades: gradesObj,
      interests: interestsArray,
      strengths_weaknesses: strengthsWeaknesses.trim(),
      target_region: targetRegion,
    });
  };

  const fieldGroupStyle = { marginBottom: 'var(--space-4)' };
  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-2)',
  };
  const gradeRowStyle = {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-2)',
  };
  const gradeInputStyle = {
    flex: 1,
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-family-base)',
  };
  const removeButtonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-error)',
    fontSize: 'var(--font-size-md)',
    padding: 'var(--space-2)',
    lineHeight: 1,
  };
  const textareaStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: 'var(--space-2)',
    border: `var(--border-width) solid ${errors.strengthsWeaknesses ? 'var(--color-error)' : 'var(--color-border)'}`,
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    fontFamily: 'var(--font-family-base)',
    minHeight: '80px',
    resize: 'vertical',
  };
  const regionButtonStyle = (region) => ({
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--border-radius-md)',
    border: 'var(--border-width) solid var(--color-border)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-family-base)',
    fontWeight: 'var(--font-weight-medium)',
    marginRight: 'var(--space-3)',
    background: targetRegion === region ? 'var(--color-primary)' : 'transparent',
    color: targetRegion === region ? 'var(--color-surface)' : 'var(--color-text-primary)',
  });
  const errorTextStyle = {
    display: 'block',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-error)',
    marginTop: 'var(--space-1)',
  };
  const footerStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    marginTop: 'var(--space-4)',
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <TextInput
        label="Student Name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        error={errors.name}
      />

      <div style={fieldGroupStyle}>
        <span style={labelStyle}>Grades</span>
        {gradeRows.map((row, index) => (
          <div key={index} style={gradeRowStyle}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Subject"
                value={row.subject}
                onChange={(e) => updateGradeRow(index, 'subject', e.target.value)}
                style={{
                  ...gradeInputStyle,
                  borderColor: errors[`subject_${index}`] ? 'var(--color-error)' : 'var(--color-border)',
                }}
                aria-label={`Subject name for row ${index + 1}`}
                disabled={loading}
              />
              {errors[`subject_${index}`] && <span style={errorTextStyle}>{errors[`subject_${index}`]}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Grade"
                value={row.grade}
                onChange={(e) => updateGradeRow(index, 'grade', e.target.value)}
                style={{
                  ...gradeInputStyle,
                  borderColor: errors[`grade_${index}`] ? 'var(--color-error)' : 'var(--color-border)',
                }}
                aria-label={`Grade for ${row.subject || `row ${index + 1}`}`}
                disabled={loading}
              />
              {errors[`grade_${index}`] && <span style={errorTextStyle}>{errors[`grade_${index}`]}</span>}
            </div>
            <button
              type="button"
              style={removeButtonStyle}
              onClick={() => removeGradeRow(index)}
              aria-label={`Remove grade row ${index + 1}`}
              disabled={loading}
            >
              &times;
            </button>
          </div>
        ))}
        <Button
          label="Add Subject"
          variant="secondary"
          onClick={addGradeRow}
          disabled={loading}
        />
      </div>

      <TextInput
        label="Interests"
        name="interests"
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        error={errors.interests}
      />

      <div style={fieldGroupStyle}>
        <label htmlFor="strengths_weaknesses" style={labelStyle}>
          Strengths and Weaknesses <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="strengths_weaknesses"
          name="strengths_weaknesses"
          value={strengthsWeaknesses}
          onChange={(e) => setStrengthsWeaknesses(e.target.value)}
          style={textareaStyle}
          required
          aria-required="true"
          aria-invalid={!!errors.strengthsWeaknesses}
          disabled={loading}
        />
        {errors.strengthsWeaknesses && <span style={errorTextStyle}>{errors.strengthsWeaknesses}</span>}
      </div>

      <div style={fieldGroupStyle}>
        <span style={labelStyle}>Target Region <span aria-hidden="true">*</span></span>
        <div>
          <button
            type="button"
            style={regionButtonStyle('local')}
            onClick={() => setTargetRegion('local')}
            aria-pressed={targetRegion === 'local'}
            disabled={loading}
          >
            Local
          </button>
          <button
            type="button"
            style={regionButtonStyle('international')}
            onClick={() => setTargetRegion('international')}
            aria-pressed={targetRegion === 'international'}
            disabled={loading}
          >
            International
          </button>
        </div>
        {errors.targetRegion && <span style={errorTextStyle}>{errors.targetRegion}</span>}
      </div>

      <div style={footerStyle}>
        <Button label={submitLabel} variant="primary" type="submit" onClick={() => {}} loading={loading} disabled={loading} />
        {onCancel && (
          <Button label="Cancel" variant="secondary" onClick={onCancel} disabled={loading} />
        )}
      </div>
    </form>
  );
}

export default StudentForm;
