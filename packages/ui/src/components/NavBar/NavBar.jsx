import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function NavBar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
  };

  const brandStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const logoutStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    padding: 0,
    fontFamily: 'var(--font-family-base)',
  };

  return (
    <nav style={navStyle} role="navigation" aria-label="Main navigation">
      <strong style={brandStyle}>Academic Advisor</strong>
      <button
        style={logoutStyle}
        onClick={handleLogout}
        aria-label="Log out"
      >
        Logout
      </button>
    </nav>
  );
}

export default NavBar;
