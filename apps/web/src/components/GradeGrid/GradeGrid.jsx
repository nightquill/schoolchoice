// REQ-B4: Spreadsheet-style grade grid with Excel paste support
import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import client from '@schoolchoice/ui/api/client';
import { useTranslation } from '@schoolchoice/ui/i18n';

const cellStyle = {
  padding: 0,
  borderRight: 'var(--border-width) solid var(--color-border)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
};

const inputStyle = {
  width: '64px',
  padding: 'var(--space-1) var(--space-2)',
  border: 'none',
  outline: 'none',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-base)',
  background: 'transparent',
  textAlign: 'center',
  boxSizing: 'border-box',
};

const editedInputStyle = {
  ...inputStyle,
  background: '#fef9c3',
};

const stickyHeaderStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: 'var(--space-2) var(--space-3)',
  textAlign: 'center',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  background: 'var(--color-surface)',
  borderBottom: '2px solid var(--color-border)',
  borderRight: 'var(--border-width) solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const stickyNameStyle = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
  borderRight: '2px solid var(--color-border)',
  borderBottom: 'var(--border-width) solid var(--color-border)',
  whiteSpace: 'nowrap',
  minWidth: '140px',
};

const stickyCornerStyle = {
  position: 'sticky',
  top: 0,
  left: 0,
  zIndex: 3,
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--color-surface)',
  borderBottom: '2px solid var(--color-border)',
  borderRight: '2px solid var(--color-border)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
};

function GradeGrid({ students, subjects, sitting, onSaved }) {
  const { t } = useTranslation();
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const tableRef = useRef(null);

  // Count unsaved changes
  const changeCount = Object.values(edits).reduce(
    (sum, subMap) => sum + Object.keys(subMap).length,
    0
  );

  const handleChange = useCallback((studentId, subjectCode, value) => {
    setEdits((prev) => {
      const next = { ...prev };
      if (!next[studentId]) next[studentId] = {};
      next[studentId] = { ...next[studentId], [subjectCode]: value };
      return next;
    });
  }, []);

  const handleDiscard = useCallback(() => {
    setEdits({});
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    let saved = 0;
    let failed = 0;

    try {
      for (const [studentId, subMap] of Object.entries(edits)) {
        const student = students.find((s) => String(s.id) === String(studentId));
        if (!student) continue;

        for (const [subjectCode, newGrade] of Object.entries(subMap)) {
          const existing = student.grades?.[subjectCode];
          try {
            if (existing?.id) {
              // Update existing grade
              await client.put(`/api/v1/grades/${existing.id}`, {
                raw_grade: newGrade,
              });
            } else {
              // Create new grade
              await client.post(`/api/v1/students/${studentId}/grades`, {
                subject_code: subjectCode,
                sitting,
                raw_grade: newGrade,
              });
            }
            saved++;
          } catch {
            failed++;
          }
        }
      }

      if (failed > 0) {
        toast.error(t('gradeGrid.saveFailed', { count: failed }));
      }
      if (saved > 0) {
        toast.success(t('gradeGrid.saveSuccess', { count: saved }));
        setEdits({});
        if (onSaved) onSaved();
      }
    } finally {
      setSaving(false);
    }
  }, [edits, students, sitting, onSaved]);

  const handlePaste = useCallback(
    (e, startRowIdx, startColIdx) => {
      const pasteData = e.clipboardData.getData('text/plain');
      if (!pasteData) return;

      const rows = pasteData.split(/\r?\n/).filter((r) => r.length > 0);
      if (rows.length === 0) return;

      // Only intercept multi-cell paste (tabs or multiple rows)
      const hasTabs = rows.some((r) => r.includes('\t'));
      if (!hasTabs && rows.length === 1) return; // let normal single-cell paste work

      e.preventDefault();

      setEdits((prev) => {
        const next = { ...prev };
        rows.forEach((row, rOffset) => {
          const studentIdx = startRowIdx + rOffset;
          if (studentIdx >= students.length) return;
          const student = students[studentIdx];
          const cells = row.split('\t');
          cells.forEach((cell, cOffset) => {
            const subjectIdx = startColIdx + cOffset;
            if (subjectIdx >= subjects.length) return;
            const subjectCode = subjects[subjectIdx].code;
            if (!next[student.id]) next[student.id] = {};
            next[student.id] = {
              ...next[student.id],
              [subjectCode]: cell.trim(),
            };
          });
        });
        return next;
      });
    },
    [students, subjects]
  );

  const getCellValue = (student, subjectCode) => {
    if (edits[student.id]?.[subjectCode] !== undefined) {
      return edits[student.id][subjectCode];
    }
    return student.grades?.[subjectCode]?.raw_grade ?? '';
  };

  const isEdited = (studentId, subjectCode) => {
    return edits[studentId]?.[subjectCode] !== undefined;
  };

  return (
    <div>
      {/* Unsaved changes banner */}
      {changeCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
            background: '#fef9c3',
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: 'var(--space-3)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-base)',
          }}
        >
          <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
            {t('gradeGrid.unsavedChanges', { count: changeCount })}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={handleDiscard}
              disabled={saving}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                border: 'var(--border-width) solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                background: 'var(--color-surface)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-base)',
              }}
            >
              {t('gradeGrid.discard')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--font-size-sm)',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-family-base)',
              }}
            >
              {saving ? t('gradeGrid.saving') : t('gradeGrid.saveAll')}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '70vh',
          border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
        }}
      >
        <table
          ref={tableRef}
          style={{
            borderCollapse: 'collapse',
            minWidth: '100%',
          }}
        >
          <thead>
            <tr>
              <th style={stickyCornerStyle}>{t('gradeGrid.student')}</th>
              {subjects.map((subj) => (
                <th key={subj.code} style={stickyHeaderStyle} title={subj.name}>
                  {subj.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, rowIdx) => (
              <tr key={student.id}>
                <td style={stickyNameStyle}>{student.name}</td>
                {subjects.map((subj, colIdx) => (
                  <td key={subj.code} style={cellStyle}>
                    <input
                      type="text"
                      value={getCellValue(student, subj.code)}
                      onChange={(e) =>
                        handleChange(student.id, subj.code, e.target.value)
                      }
                      onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                      style={
                        isEdited(student.id, subj.code)
                          ? editedInputStyle
                          : inputStyle
                      }
                      aria-label={`${student.name} ${subj.code} grade`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default GradeGrid;
