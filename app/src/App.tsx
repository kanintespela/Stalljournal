import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AnimalIcon, GroupIcon, JournalIcon, MoreIcon, PlaceIcon } from './components/icons'
import { backgroundSync } from './sync/sync'

const TABS = [
  { to: '/', label: 'Djur', Icon: AnimalIcon, end: true },
  { to: '/grupper', label: 'Grupper', Icon: GroupIcon },
  { to: '/journal', label: 'Journal', Icon: JournalIcon },
  { to: '/platser', label: 'Platser', Icon: PlaceIcon },
  { to: '/mer', label: 'Mer', Icon: MoreIcon },
]

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000

export default function App() {
  useEffect(() => {
    backgroundSync()
    const interval = setInterval(backgroundSync, AUTO_SYNC_INTERVAL_MS)
    window.addEventListener('online', backgroundSync)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', backgroundSync)
    }
  }, [])

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
            <t.Icon className="tab-icon" />
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
