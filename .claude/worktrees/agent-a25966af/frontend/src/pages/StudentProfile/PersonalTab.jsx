import { usePersonalTab } from '../../hooks/usePersonalTab';
import Button from '../../components/Button/Button';
import TextInput from '../../components/TextInput/TextInput';

export default function PersonalTab({ student, studentId, showToast }) {
  const { form, saving, errors, handleChange, handleSave, calcAge } = usePersonalTab(student, studentId, showToast);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-4) var(--space-6)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-1)',
  };

  const checkboxRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-4)',
  };

  const age = calcAge(form.date_of_birth);

  return (
    <div>
      <div style={gridStyle}>
        <TextInput label="Full Name" name="full_name" value={form.full_name} onChange={handleChange} error={errors.full_name} />
        <TextInput label="Preferred Name" name="preferred_name" value={form.preferred_name} onChange={handleChange} />
        <div>
          <label style={labelStyle}>Date of Birth</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(() => {
              const dobParts = form.date_of_birth ? form.date_of_birth.split('-') : ['', '', ''];
              const dobYear = dobParts[0] || '';
              const dobMonth = dobParts[1] || '';
              const dobDay = dobParts[2] || '';
              const currentYear = new Date().getFullYear();
              const selectSt = { padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' };
              const rebuildDob = (y, m, d) => {
                if (!y || !m || !d) return '';
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              };
              return (
                <>
                  <select
                    aria-label="Day of birth"
                    value={dobDay}
                    onChange={(e) => handleChange({ target: { name: 'date_of_birth', value: rebuildDob(dobYear, dobMonth, e.target.value) } })}
                    style={selectSt}
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Month of birth"
                    value={dobMonth}
                    onChange={(e) => handleChange({ target: { name: 'date_of_birth', value: rebuildDob(dobYear, e.target.value, dobDay) } })}
                    style={selectSt}
                  >
                    <option value="">Month</option>
                    {[['01','January'],['02','February'],['03','March'],['04','April'],['05','May'],['06','June'],['07','July'],['08','August'],['09','September'],['10','October'],['11','November'],['12','December']].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Year of birth"
                    value={dobYear}
                    onChange={(e) => handleChange({ target: { name: 'date_of_birth', value: rebuildDob(e.target.value, dobMonth, dobDay) } })}
                    style={selectSt}
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 26 }, (_, i) => currentYear - i).map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </>
              );
            })()}
          </div>
          {age !== null && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0' }}>Age: {age}</p>
          )}
        </div>
        <TextInput label="Gender" name="gender" value={form.gender} onChange={handleChange} />
        <div style={{ gridColumn: '1 / -1' }}>
          <TextInput label="Address" name="address" value={form.address} onChange={handleChange} />
        </div>
        <TextInput label="Phone" name="phone" value={form.phone} onChange={handleChange} />
        <TextInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
        <TextInput label="Class" name="class_name" value={form.class_name} onChange={handleChange} />
        <TextInput label="Year of Study" name="year_of_study" type="number" value={form.year_of_study} onChange={handleChange} />
        <TextInput label="Candidate Number" name="candidate_number" value={form.candidate_number} onChange={handleChange} />
        <div>
          <label style={labelStyle}>Preferred Language</label>
          <select
            name="preferred_language"
            value={form.preferred_language}
            onChange={handleChange}
            style={{ padding: 'var(--space-2)', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', width: '100%' }}
          >
            <option value="en">English</option>
            <option value="zh">Chinese (中文)</option>
          </select>
        </div>
      </div>
      <div style={checkboxRowStyle}>
        <input
          type="checkbox"
          id="financial_aid_flag"
          name="financial_aid_flag"
          checked={form.financial_aid_flag}
          onChange={handleChange}
        />
        <label htmlFor="financial_aid_flag" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
          Financial Aid Applicant
        </label>
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="personal_statement" style={labelStyle}>Personal Statement</label>
        <textarea
          id="personal_statement"
          name="personal_statement"
          value={form.personal_statement}
          onChange={handleChange}
          placeholder="Write a personal statement for university applications..."
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 'var(--space-2)',
            border: 'var(--border-width) solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family-base)',
            resize: 'vertical',
            lineHeight: '1.5',
          }}
        />
      </div>
      <Button label="Save" onClick={handleSave} loading={saving} />
    </div>
  );
}
