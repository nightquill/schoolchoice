import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { getEntities } from '../../api/entities';

// NavBarV2 — extended navigation bar for v2 pages
// Adds Dashboard, School Directory, Account Settings links; Data Refresh for admin
function NavBarV2({ account }) {
  const { logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e) => { setIsMobile(e.matches); setMobileMenuOpen(false); };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const qc = useQueryClient();
  const handleLogout = () => {
    logout();
    qc.clear();
    navigate('/login');
  };

  const entitiesQuery = useQuery({
    queryKey: ['entities'],
    queryFn: getEntities,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = account?.role === 'admin';
  const isStudent = account?.role === 'student';
  const displayName = account?.display_name || account?.email || '';

  const navStyle = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-3) var(--space-6)',
    boxShadow: 'var(--shadow-md)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    gap: 'var(--space-4)',
  };

  const brandStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    textDecoration: 'none',
    flexShrink: 0,
  };

  const centreLinksStyle = {
    gap: 'var(--space-4)',
    alignItems: 'center',
  };

  const rightStyle = {
    gap: 'var(--space-3)',
    alignItems: 'center',
    flexShrink: 0,
  };

  const getLinkStyle = (path) => {
    const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
    return {
      fontSize: 'var(--font-size-sm)',
      fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
      color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
      textDecoration: 'none',
      padding: 'var(--space-1) var(--space-2)',
      borderRadius: 'var(--border-radius-sm)',
      fontFamily: 'var(--font-family-base)',
      background: isActive ? 'var(--color-info-bg)' : 'transparent',
      transition: 'background 0.15s, color 0.15s',
      whiteSpace: 'nowrap',
    };
  };

  const getMobileLinkStyle = (path) => {
    const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
    return {
      display: 'block',
      padding: '12px 24px',
      minHeight: '44px',
      lineHeight: '20px',
      fontSize: 'var(--font-size-sm)',
      fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
      color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      textDecoration: 'none',
      fontFamily: 'var(--font-family-base)',
    };
  };

  const logoutStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-family-base)',
  };

  const userStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const entityLinks = entitiesQuery.data?.filter((e) => e.auto_crud) || [];

  return (
    <nav style={{ ...navStyle, position: 'relative' }} role="navigation" aria-label="Main navigation">
      <Link to="/dashboard" style={brandStyle}>
        {t('nav.appName')}
      </Link>

      {/* Hamburger button — visible only on mobile */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={mobileMenuOpen}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--color-text-primary)' }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Desktop links — hidden on mobile */}
      {!isMobile && (
        <div style={{ ...centreLinksStyle, display: 'flex' }}>
          <Link to="/dashboard" style={getLinkStyle('/dashboard')}>
            {t('nav.dashboard')}
          </Link>
          {isStudent && (
            <Link to="/my-submissions" style={getLinkStyle('/my-submissions')}>
              {t('nav.mySubmissions')}
            </Link>
          )}
          {isStudent && (
            <Link to="/my-plan" style={getLinkStyle('/my-plan')}>{t('nav.myPlan')}</Link>
          )}
          {isStudent && (
            <Link to="/schools" style={getLinkStyle('/schools')}>{t('nav.schoolDirectory')}</Link>
          )}
          {!isStudent && (
            <>
              <Link to="/students" style={getLinkStyle('/students')}>
                {t('nav.students')}
              </Link>
              <Link to="/schools" style={getLinkStyle('/schools')}>
                {t('nav.schoolDirectory')}
              </Link>
              <Link to="/data-analysis" style={getLinkStyle('/data-analysis')}>
                {t('nav.dataAnalysis')}
              </Link>
              <Link to="/submissions" style={getLinkStyle('/submissions')}>
                {t('nav.submissions')}
              </Link>
            </>
          )}
          {isAdmin && (
            <Link to="/admin/manage" style={getLinkStyle('/admin/manage')}>
              {t('nav.manage')}
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin/data-refresh" style={getLinkStyle('/admin/data-refresh')}>
              {t('nav.dataRefresh')}
            </Link>
          )}
          {!isStudent && entityLinks.map((entity) => (
            <Link key={entity.name} to={`/entities/${entity.name}`} style={getLinkStyle(`/entities/${entity.name}`)}>
              {entity.name}
            </Link>
          ))}
        </div>
      )}

      {!isMobile && (
        <div style={{ ...rightStyle, display: 'flex' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {displayName && <span style={userStyle}>{displayName}</span>}
            {account?.organisation_name && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary, var(--color-text-secondary))', lineHeight: 1.2 }}>
                {account.organisation_name}
              </span>
            )}
          </div>
          <Link
            to="/account/settings"
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontFamily: 'var(--font-family-base)',
            }}
          >
            {t('nav.accountSettings')}
          </Link>
          <button
            style={logoutStyle}
            onClick={handleLogout}
            aria-label={t('nav.logout')}
          >
            {t('nav.logout')}
          </button>
        </div>
      )}

      {/* Mobile menu — shown when mobileMenuOpen */}
      {mobileMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--color-surface)',
          borderBottom: 'var(--border-width) solid var(--color-border)',
          padding: 'var(--space-2) 0',
          zIndex: 50,
          boxShadow: 'var(--shadow-md)',
        }}>
          <Link to="/dashboard" style={getMobileLinkStyle('/dashboard')} onClick={() => setMobileMenuOpen(false)}>{t('nav.dashboard')}</Link>
          {isStudent && (
            <Link to="/my-submissions" style={getMobileLinkStyle('/my-submissions')} onClick={() => setMobileMenuOpen(false)}>{t('nav.mySubmissions')}</Link>
          )}
          {isStudent && (
            <Link to="/my-plan" style={getMobileLinkStyle('/my-plan')} onClick={() => setMobileMenuOpen(false)}>{t('nav.myPlan')}</Link>
          )}
          {isStudent && (
            <Link to="/schools" style={getMobileLinkStyle('/schools')} onClick={() => setMobileMenuOpen(false)}>{t('nav.schoolDirectory')}</Link>
          )}
          {!isStudent && (
            <>
              <Link to="/students" style={getMobileLinkStyle('/students')} onClick={() => setMobileMenuOpen(false)}>{t('nav.students')}</Link>
              <Link to="/schools" style={getMobileLinkStyle('/schools')} onClick={() => setMobileMenuOpen(false)}>{t('nav.schoolDirectory')}</Link>
              <Link to="/data-analysis" style={getMobileLinkStyle('/data-analysis')} onClick={() => setMobileMenuOpen(false)}>{t('nav.dataAnalysis')}</Link>
              <Link to="/submissions" style={getMobileLinkStyle('/submissions')} onClick={() => setMobileMenuOpen(false)}>{t('nav.submissions')}</Link>
            </>
          )}
          {isAdmin && (
            <Link to="/admin/manage" style={getMobileLinkStyle('/admin/manage')} onClick={() => setMobileMenuOpen(false)}>{t('nav.manage')}</Link>
          )}
          {isAdmin && (
            <Link to="/admin/data-refresh" style={getMobileLinkStyle('/admin/data-refresh')} onClick={() => setMobileMenuOpen(false)}>{t('nav.dataRefresh')}</Link>
          )}
          {!isStudent && entityLinks.map((entity) => (
            <Link key={entity.name} to={`/entities/${entity.name}`} style={getMobileLinkStyle(`/entities/${entity.name}`)} onClick={() => setMobileMenuOpen(false)}>
              {entity.name}
            </Link>
          ))}
          <div style={{ borderTop: 'var(--border-width) solid var(--color-border)', margin: 'var(--space-2) 0' }} />
          {displayName && <span style={{ display: 'block', padding: '8px 24px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{displayName}</span>}
          {account?.organisation_name && (
            <span style={{ display: 'block', padding: '0 24px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {account.organisation_name}
            </span>
          )}
          <Link to="/account/settings" style={getMobileLinkStyle('/account/settings')} onClick={() => setMobileMenuOpen(false)}>{t('nav.accountSettings')}</Link>
          <button
            style={{ ...logoutStyle, display: 'block', padding: '12px 24px', minHeight: '44px', width: '100%', textAlign: 'left' }}
            onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
            aria-label={t('nav.logout')}
          >
            {t('nav.logout')}
          </button>
        </div>
      )}
    </nav>
  );
}

export default NavBarV2;
