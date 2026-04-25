import { useActivitiesTab } from '../../hooks/useActivitiesTab';
import Button from '../../components/Button/Button';

export default function ActivitiesTab({ student, studentId, showToast }) {
  const {
    activities,
    awards,
    activityOpen,
    awardOpen,
    savingActivities,
    savingAwards,
    toggleActivity,
    toggleAward,
    updateActivity,
    addActivity,
    removeActivity,
    handleSaveActivities,
    updateAward,
    addAward,
    removeAward,
    handleSaveAwards,
  } = useActivitiesTab(student, studentId, showToast);

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
      <h3 style={sectionHeadingStyle}>Extracurricular Activities</h3>
      {activities.map((act, index) => (
        <div key={index} style={cardStyle}>
          <div style={collapsibleHeaderStyle} onClick={() => toggleActivity(index)}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
              {act.activity || 'New Activity'}
            </span>
            <button style={toggleBtnStyle} aria-label={activityOpen[index] ? 'Collapse' : 'Expand'}>
              {activityOpen[index] ? '\u25B2' : '\u25BC'}
            </button>
          </div>
          {activityOpen[index] && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Activity</label>
                  <input value={act.activity || ''} onChange={(e) => updateActivity(index, 'activity', e.target.value)} style={inputStyle} aria-label="Activity name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Role</label>
                  <input value={act.role || ''} onChange={(e) => updateActivity(index, 'role', e.target.value)} style={inputStyle} aria-label="Role" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Years</label>
                  <input value={act.years || ''} onChange={(e) => updateActivity(index, 'years', e.target.value)} style={inputStyle} aria-label="Years participated" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Achievement</label>
                  <input value={act.achievement || ''} onChange={(e) => updateActivity(index, 'achievement', e.target.value)} style={inputStyle} aria-label="Achievement" />
                </div>
              </div>
              <button onClick={() => removeActivity(index)} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>Remove</button>
            </div>
          )}
        </div>
      ))}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
        <Button label="Add Activity" variant="secondary" onClick={addActivity} />
        <Button label="Save Activities" onClick={handleSaveActivities} loading={savingActivities} />
      </div>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <h3 style={sectionHeadingStyle}>Awards</h3>
        {awards.map((aw, index) => (
          <div key={index} style={cardStyle}>
            <div style={collapsibleHeaderStyle} onClick={() => toggleAward(index)}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {aw.title || 'New Award'}
              </span>
              <button style={toggleBtnStyle} aria-label={awardOpen[index] ? 'Collapse' : 'Expand'}>
                {awardOpen[index] ? '\u25B2' : '\u25BC'}
              </button>
            </div>
            {awardOpen[index] && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Title</label>
                    <input value={aw.title || ''} onChange={(e) => updateAward(index, 'title', e.target.value)} style={inputStyle} aria-label="Award title" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Awarding Body</label>
                    <input value={aw.awarding_body || ''} onChange={(e) => updateAward(index, 'awarding_body', e.target.value)} style={inputStyle} aria-label="Awarding body" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Level</label>
                    <select value={aw.level || 'School'} onChange={(e) => updateAward(index, 'level', e.target.value)} style={inputStyle} aria-label="Award level">
                      <option value="School">School</option>
                      <option value="District">District</option>
                      <option value="Regional">Regional</option>
                      <option value="International">International</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>Year</label>
                    <input type="number" value={aw.year || ''} onChange={(e) => updateAward(index, 'year', e.target.value)} style={inputStyle} aria-label="Year received" />
                  </div>
                </div>
                <button onClick={() => removeAward(index)} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}>Remove</button>
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button label="Add Award" variant="secondary" onClick={addAward} />
          <Button label="Save Awards" onClick={handleSaveAwards} loading={savingAwards} />
        </div>
      </div>
    </div>
  );
}
