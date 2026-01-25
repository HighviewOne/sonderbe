import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, profile, signOut, isAdmin } = useAuth()
  const location = useLocation()

  const isHomePage = location.pathname === '/'
  const isPortalPage = location.pathname.startsWith('/portal')
  const isAdminPage = location.pathname.startsWith('/admin')

  const handleSignOut = async () => {
    await signOut()
    setMobileMenuOpen(false)
  }

  return (
    <header className="header">
      <nav className="nav">
        <Link to="/" className="logo">Sonder<span>Be</span></Link>
        <ul className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
          {isHomePage && (
            <>
              <li><a href="#steps" onClick={() => setMobileMenuOpen(false)}>Get Started</a></li>
              <li><a href="#options" onClick={() => setMobileMenuOpen(false)}>Your Options</a></li>
              <li><a href="#checklist" onClick={() => setMobileMenuOpen(false)}>Documents</a></li>
              <li><a href="#resources" onClick={() => setMobileMenuOpen(false)}>Resources</a></li>
              <li><a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a></li>
              <li><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a></li>
            </>
          )}
          {(isPortalPage || isAdminPage) && (
            <li><Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link></li>
          )}
          {user ? (
            <>
              {!isPortalPage && (
                <li><Link to="/portal" onClick={() => setMobileMenuOpen(false)}>My Portal</Link></li>
              )}
              {isAdmin && !isAdminPage && (
                <li><Link to="/admin" onClick={() => setMobileMenuOpen(false)}>Admin</Link></li>
              )}
              <li className="nav-user-info">
                <span className="user-name">{profile?.full_name || user.email}</span>
              </li>
              <li>
                <button onClick={handleSignOut} className="nav-link-button">
                  Sign Out
                </button>
              </li>
            </>
          ) : (
            <>
              <li><Link to="/login" onClick={() => setMobileMenuOpen(false)}>Login</Link></li>
              <li><Link to="/signup" className="btn btn-primary btn-small" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link></li>
            </>
          )}
        </ul>
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </nav>
    </header>
  )
}
