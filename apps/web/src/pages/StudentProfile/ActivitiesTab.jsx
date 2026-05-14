import { useActivitiesTab } from '../../hooks/useActivitiesTab';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { Button } from '@schoolchoice/ui/primitives/button';

export default function ActivitiesTab({ studentId, student }) {
  const {
    activities,
    awards,
    saving,
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
  } = useActivitiesTab(student, studentId);
  const { t } = useTranslation();
  const inputStyle = {
    padding: 'var(--space-2)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    width: '100%',
    boxSizing: 'border-box',
  };

  const cardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-4)',
    marginBottom: 'var(--space-3)',
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
    marginTop: 0,
  };

  const collapsibleHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const toggleBtnStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-base)',
    padding: '0 var(--space-1)',
    flexShrink: 0,
  };

  return (
    <div>
      <h3 style={sectionHeadingStyle}>{t('activities.extracurricular')}</h3>
      {activities.map((act, index) => (
        <div key={index} style={cardStyle}>
          <div style={collapsibleHeaderStyle} onClick={() => toggleActivity(index)}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
              {act.activity || t('activities.addActivity')}
            </span>
            <button style={toggleBtnStyle} aria-label={activityOpen[index] ? 'Collapse' : 'Expand'}>
              {activityOpen[index] ? '\u25B2' : '\u25BC'}
            </button>
          </div>
          {activityOpen[index] && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.activity')}</label>
                  <input value={act.activity || ''} onChange={(e) => updateActivity(index, 'activity', e.target.value)} style={inputStyle} aria-label="Activity name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.role')}</label>
                  <input value={act.role || ''} onChange={(e) => updateActivity(index, 'role', e.target.value)} style={inputStyle} aria-label="Role" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.years')}</label>
                  <input value={act.years || ''} onChange={(e) => updateActivity(index, 'years', e.target.value)} style={inputStyle} aria-label="Years participated" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.achievement')}</label>
                  <input value={act.achievement || ''} onChange={(e) => updateActivity(index, 'achievement', e.target.value)} style={inputStyle} aria-label="Achievement" />
                </div>
              </div>
              <button onClick={() => removeActivity(index)} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>{t('activities.remove')}</button>
            </div>
          )}
        </div>
      ))}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
        <Button variant="secondary" onClick={addActivity}>{t('activities.addActivity')}</Button>
        <Button onClick={handleSaveActivities} disabled={saving}>
          {saving ? t('common.loading') : t('activities.saveActivities')}
        </Button>
      </div>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <h3 style={sectionHeadingStyle}>{t('activities.awards')}</h3>
        {awards.map((aw, index) => (
          <div key={index} style={cardStyle}>
            <div style={collapsibleHeaderStyle} onClick={() => toggleAward(index)}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {aw.title || t('activities.addAward')}
              </span>
              <button style={toggleBtnStyle} aria-label={awardOpen[index] ? 'Collapse' : 'Expand'}>
                {awardOpen[index] ? '\u25B2' : '\u25BC'}
              </button>
            </div>
            {awardOpen[index] && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.title')}</label>
                    <input value={aw.title || ''} onChange={(e) => updateAward(index, 'title', e.target.value)} style={inputStyle} aria-label="Award title" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.awardingBody')}</label>
                    <input value={aw.awarding_body || ''} onChange={(e) => updateAward(index, 'awarding_body', e.target.value)} style={inputStyle} aria-label="Awarding body" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('activities.level')}</label>
                    <select value={aw.level || 'School'} onChange={(e) => updateAward(index, 'level', e.target.value)} style={inputStyle} aria-label="Award level">
                      <option value="School">{t('activities.levelSchool')}</option>
                      <option value="District">{t('activities.levelDistrict')}</option>
                      <option value="Regional">{t('activities.levelRegional')}</option>
                      <option value="International">{t('activities.levelInternational')}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>{t('grades.year')}</label>
                    <input type="number" value={aw.year || ''} onChange={(e) => updateAward(index, 'year', e.target.value)} style={inputStyle} aria-label="Year received" />
                  </div>
                </div>
                <button onClick={() => removeAward(index)} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>{t('activities.remove')}</button>
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={addAward}>{t('activities.addAward')}</Button>
          <Button onClick={handleSaveAwards} disabled={saving}>
            {saving ? t('common.loading') : t('activities.saveAwards')}
          </Button>
        </div>
      </div>
    </div>
  );
}
