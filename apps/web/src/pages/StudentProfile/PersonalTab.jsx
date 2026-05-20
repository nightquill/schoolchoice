import { usePersonalTab } from '../../hooks/usePersonalTab';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';

export default function PersonalTab({ studentId, student, onSaved }) {
  const { t } = useTranslation();
  const { form, saving, errors, handleChange, handleSave, calcAge } = usePersonalTab(student, studentId, onSaved);

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
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-full_name" style={labelStyle}>
            {t('personal.fullName')}
          </label>
          <Input
            id="input-full_name"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            aria-invalid={!!errors.full_name}
          />
          {errors.full_name && (
            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: 'var(--space-1)' }} role="alert">
              {errors.full_name}
            </span>
          )}
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-name_zh" style={labelStyle}>
            {t('personal.chineseName')}
          </label>
          <Input
            id="input-name_zh"
            name="name_zh"
            value={form.name_zh || ''}
            onChange={handleChange}
            placeholder="e.g. 陳美玲"
          />
        </div>
        <div>
          <label style={labelStyle}>{t('personal.dateOfBirth')}</label>
          <input
            type="date"
            name="date_of_birth"
            value={form.date_of_birth || ''}
            onChange={handleChange}
            style={{ padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
            aria-label="Date of birth"
          />
          {age !== null && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '0' }}>{t('personal.age', { age })}</p>
          )}
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-gender" style={labelStyle}>
            {t('personal.gender')}
          </label>
          <Input
            id="input-gender"
            name="gender"
            value={form.gender}
            onChange={handleChange}
          />
        </div>
        <div style={{ gridColumn: '1 / -1', marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-address" style={labelStyle}>
            {t('personal.address')}
          </label>
          <Input
            id="input-address"
            name="address"
            value={form.address}
            onChange={handleChange}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-phone" style={labelStyle}>
            {t('personal.phone')}
          </label>
          <Input
            id="input-phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-email" style={labelStyle}>
            {t('personal.email')}
          </label>
          <Input
            id="input-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: 'var(--space-1)' }} role="alert">
              {errors.email}
            </span>
          )}
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-class_name" style={labelStyle}>
            {t('personal.class')}
          </label>
          <Input
            id="input-class_name"
            name="class_name"
            value={form.class_name}
            onChange={handleChange}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-year_of_study" style={labelStyle}>
            {t('personal.yearOfStudy')}
          </label>
          <Input
            id="input-year_of_study"
            name="year_of_study"
            type="number"
            value={form.year_of_study}
            onChange={handleChange}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="input-candidate_number" style={labelStyle}>
            {t('personal.candidateNumber')}
          </label>
          <Input
            id="input-candidate_number"
            name="candidate_number"
            value={form.candidate_number}
            onChange={handleChange}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('personal.preferredLanguage')}</label>
          <select
            name="preferred_language"
            value={form.preferred_language}
            onChange={handleChange}
            style={{ padding: 'var(--space-2)', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-family-base)', width: '100%' }}
          >
            <option value="en">{t('personal.english')}</option>
            <option value="zh">{t('personal.chinese')}</option>
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
          {t('personal.financialAid')}
        </label>
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="personal_statement" style={labelStyle}>{t('personal.personalStatement')}</label>
        <textarea
          id="personal_statement"
          name="personal_statement"
          value={form.personal_statement}
          onChange={handleChange}
          placeholder={t('personal.personalStatementPlaceholder')}
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
      <Button onClick={handleSave} disabled={saving}>
        {saving ? t('personal.loading') : t('personal.save')}
      </Button>
    </div>
  );
}
