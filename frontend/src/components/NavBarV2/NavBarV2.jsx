import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, X, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getEntities } from '../../api/entities';

// NavBarV2 — extended navigation bar for v2 pages
// Adds Dashboard, School Directory, Account Settings links; Data Refresh for admin
function NavBarV2({ account }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const entitiesQuery = useQuery({
    queryKey: ['entities'],
    queryFn: getEntities,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = account?.role === 'admin';
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
    display: 'flex',
    flexDirection: 'row',
    gap: 'var(--space-4)',
    alignItems: 'center',
  };

  const rightStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: 'var(--space-3)',
    alignItems: 'center',
    flexShrink: 0,
  };

  const getLinkStyle = (path) => {
    const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
    return {
      fontSize: 'var(--font-size-sm)',
      fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
      color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      textDecoration: 'none',
      padding: 'var(--space-1) var(--space-2)',
      borderRadius: 'var(--border-radius-sm)',
      fontFamily: 'var(--font-family-base)',
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
        Academic Advisor
      </Link>

      {/* Hamburger button — visible only below 768px */}
      <button
        className="md:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--color-text-primary)' }}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Desktop links — hidden on mobile */}
      <div className="hidden md:flex" style={centreLinksStyle}>
        <Link to="/dashboard" style={getLinkStyle('/dashboard')}>
          Dashboard
        </Link>
        <Link to="/schools" style={getLinkStyle('/schools')}>
          School Directory
        </Link>
        <Link to="/cohorts" style={getLinkStyle('/cohorts')}>
          Cohorts
        </Link>
        <Link to="/data-analysis" style={getLinkStyle('/data-analysis')}>
          Data Analysis
        </Link>
        {isAdmin && (
          <Link to="/admin/data-refresh" style={getLinkStyle('/admin/data-refresh')}>
            Data Refresh
          </Link>
        )}
        {isAdmin && (
          <Link to="/settings" style={{ ...getLinkStyle('/settings'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Settings size={18} />
            Settings
          </Link>
        )}
        {entityLinks.map((entity) => (
          <Link key={entity.name} to={`/entities/${entity.name}`} style={getLinkStyle(`/entities/${entity.name}`)}>
            {entity.name}
          </Link>
        ))}
      </div>

      <div className="hidden md:flex" style={rightStyle}>
        {displayName && <span style={userStyle}>{displayName}</span>}
        <Link
          to="/account/settings"
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontFamily: 'var(--font-family-base)',
          }}
        >
          Account Settings
        </Link>
        <button
          style={logoutStyle}
          onClick={handleLogout}
          aria-label="Log out"
        >
          Logout
        </button>
      </div>

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
          <Link to="/dashboard" style={getMobileLinkStyle('/dashboard')} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
          <Link to="/schools" style={getMobileLinkStyle('/schools')} onClick={() => setMobileMenuOpen(false)}>School Directory</Link>
          <Link to="/cohorts" style={getMobileLinkStyle('/cohorts')} onClick={() => setMobileMenuOpen(false)}>Cohorts</Link>
          <Link to="/data-analysis" style={getMobileLinkStyle('/data-analysis')} onClick={() => setMobileMenuOpen(false)}>Data Analysis</Link>
          {isAdmin && (
            <Link to="/admin/data-refresh" style={getMobileLinkStyle('/admin/data-refresh')} onClick={() => setMobileMenuOpen(false)}>Data Refresh</Link>
          )}
          {isAdmin && (
            <Link to="/settings" style={{ ...getMobileLinkStyle('/settings'), display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setMobileMenuOpen(false)}>
              <Settings size={18} />
              Settings
            </Link>
          )}
          {entityLinks.map((entity) => (
            <Link key={entity.name} to={`/entities/${entity.name}`} style={getMobileLinkStyle(`/entities/${entity.name}`)} onClick={() => setMobileMenuOpen(false)}>
              {entity.name}
            </Link>
          ))}
          <div style={{ borderTop: 'var(--border-width) solid var(--color-border)', margin: 'var(--space-2) 0' }} />
          {displayName && <span style={{ display: 'block', padding: '8px 24px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{displayName}</span>}
          <Link to="/account/settings" style={getMobileLinkStyle('/account/settings')} onClick={() => setMobileMenuOpen(false)}>Account Settings</Link>
          <button
            style={{ ...logoutStyle, display: 'block', padding: '12px 24px', minHeight: '44px', width: '100%', textAlign: 'left' }}
            onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
            aria-label="Log out"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default NavBarV2;
