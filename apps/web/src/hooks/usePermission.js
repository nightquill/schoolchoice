import { useQuery } from '@tanstack/react-query';
import { getMyPermissions } from '../api/teacherGroups';

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: getMyPermissions,
    staleTime: 5 * 60 * 1000,
  });
  return { permissions: data?.cohorts ?? [], isLoading };
}

export function usePermission(cohortId, feature) {
  const { permissions, isLoading } = usePermissions();
  if (isLoading) return 'read_write';
  if (!cohortId) {
    const rank = { none: 0, read_only: 1, read_write: 2 };
    let best = 'none';
    for (const p of permissions) {
      if (!p.visible) continue;
      const val = p[feature] || 'none';
      if ((rank[val] || 0) > (rank[best] || 0)) best = val;
    }
    return best;
  }
  const perm = permissions.find(p => p.cohort_id === cohortId);
  if (!perm || !perm.visible) return 'none';
  return perm[feature] || 'none';
}

export function useCohortVisible(cohortId) {
  const { permissions } = usePermissions();
  if (!cohortId) return true;
  const perm = permissions.find(p => p.cohort_id === cohortId);
  return perm ? perm.visible : true;
}
