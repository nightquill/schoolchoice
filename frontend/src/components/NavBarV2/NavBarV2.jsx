import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// NavBarV2 — extended navigation bar for v2 pages
// Adds Dashboard, School Directory, Account Settings links; Data Refresh for admin
function NavBarV2({ account }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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

  return (
    <nav style={navStyle} role="navigation" aria-label="Main navigation">
      <Link to="/dashboard" style={brandStyle}>
        Academic Advisor
      </Link>

      <div style={centreLinksStyle}>
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
      </div>

      <div style={rightStyle}>
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
    </nav>
  );
}

export default NavBarV2;
