import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { getGroupPermissions, setGroupPermissions } from '../../api/teacherGroups';

export default function GroupPermissions({ groupId }) {
  const { t } = useTranslation();

  const TOOLS = [
    { key: 'programme_choices', label: t('groupPermissions.programmes') },
    { key: 'grades', label: t('groupPermissions.grades') },
    { key: 'plan_generation', label: t('groupPermissions.plans') },
    { key: 'submissions', label: t('groupPermissions.submissions') },
    { key: 'reports', label: t('groupPermissions.reports') },
    { key: 'cohort_management', label: t('groupPermissions.cohortMgmt') },
    { key: 'data_import', label: t('groupPermissions.dataImport') },
    { key: 'account_assignment', label: t('groupPermissions.accountAssign') },
    { key: 'student_delete', label: t('groupPermissions.studentDelete') },
    { key: 'student_profile', label: t('groupPermissions.studentProfile') },
  ];

  const ACCESS_OPTIONS = [
    { value: 'none', label: t('groupPermissions.none') },
    { value: 'read_only', label: t('groupPermissions.view') },
    { value: 'read_write', label: t('groupPermissions.edit') },
  ];
  const [localPerms, setLocalPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['group-permissions', groupId],
    queryFn: () => getGroupPermissions(groupId),
    enabled: !!groupId,
  });

  useEffect(() => {
    if (data?.permissions) {
      setLocalPerms(data.permissions.map(p => ({ ...p })));
      setDirty(false);
    }
  }, [data]);

  const updatePerm = (cohortId, field, value) => {
    setLocalPerms(prev => prev.map(p => {
      if (p.cohort_id !== cohortId) return p;
      return { ...p, [field]: value };
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setGroupPermissions(groupId, localPerms);
      toast.success(t('groupPermissions.saved'));
      setDirty(false);
    } catch {
      toast.error(t('groupPermissions.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div style={{ padding: 'var(--space-4)' }}><LoadingSpinner label={t('groupPermissions.loading')} /></div>;

  if (!localPerms.length) {
    return (
      <div style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        {t('groupPermissions.noCohorts')}
      </div>
    );
  }

  const thStyle = {
    padding: 'var(--space-2) var(--space-3)',
    textAlign: 'left',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-primary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const selectStyle = (disabled) => ({
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    fontFamily: 'var(--font-family-base)',
    background: disabled ? 'var(--color-background)' : 'var(--color-surface)',
    color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>{t('groupPermissions.cohort')}</th>
              <th scope="col" style={{ ...thStyle, textAlign: 'center' }}>{t('groupPermissions.visible')}</th>
              {TOOLS.map(t => (
                <th scope="col" key={t.key} style={{ ...thStyle, textAlign: 'center' }}>{t.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localPerms.map(p => {
              const isHidden = !p.visible;
              return (
                <tr key={p.cohort_id} style={{ background: isHidden ? 'var(--color-background)' : 'transparent' }}>
                  <td style={{ ...tdStyle, fontWeight: 'var(--font-weight-medium)' }}>
                    {p.cohort_name || p.cohort_id}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!p.visible}
                      onChange={(e) => updatePerm(p.cohort_id, 'visible', e.target.checked)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      aria-label={`Toggle visibility for ${p.cohort_name || p.cohort_id}`}
                    />
                  </td>
                  {TOOLS.map(tool => (
                    <td key={tool.key} style={{ ...tdStyle, textAlign: 'center' }}>
                      <select
                        value={p[tool.key] || 'none'}
                        onChange={(e) => updatePerm(p.cohort_id, tool.key, e.target.value)}
                        disabled={isHidden}
                        style={selectStyle(isHidden)}
                        aria-label={`${tool.label} access for ${p.cohort_name || p.cohort_id}`}
                      >
                        {ACCESS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: 'var(--border-width) solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? t('groupPermissions.saving') : t('groupPermissions.save')}
        </Button>
      </div>
    </div>
  );
}
