import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Djur', icon: '🐑', end: true },
  { to: '/grupper', label: 'Grupper', icon: '👥' },
  { to: '/journal', label: 'Journal', icon: '📋' },
  { to: '/platser', label: 'Platser', icon: '🗺️' },
  { to: '/mer', label: 'Mer', icon: '⋯' },
]

export default function App() {
  return (
    <div className="app">
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
