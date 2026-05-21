import { usePermissionGate } from '../../hooks/usePermission';
import { useTranslation } from '@schoolchoice/ui/i18n';

export default function PermissionGate({ feature, requiredLevel = 'read_only', children }) {
  const { t } = useTranslation();
  const { allowed, isLoading } = usePermissionGate(feature, requiredLevel);

  if (isLoading) return null;
  if (!allowed) {
    return (
      <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)' }}>
        {t('permission.noAccess')}
      </div>
    );
  }
  return children;
}
